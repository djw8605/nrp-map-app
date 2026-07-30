/*
 * Client for the NRP accounting OpenAPI service.
 *
 * The accounting service (https://github.com/djw8605/nrp-clickhouse) runs the
 * daily ETL that reads Kubernetes usage out of Thanos and lands it in
 * ClickHouse, then exposes a read-only MCP server over an `mcpo` OpenAPI
 * bridge. Every MCP tool becomes `POST <base>/<tool_name>` taking the tool's
 * arguments as a JSON body and returning the tool's result object.
 *
 * We use it instead of querying Thanos directly for GPU/CPU hours. The
 * accounting numbers are the ones NRP reports to XDMoD, they are computed from
 * 5-minute samples of `kube_pod_container_resource_requests` gated on the pod
 * actually being Running, and one HTTP call replaces a `sum_over_time` over a
 * multi-hundred-node regex that Thanos frequently timed out on.
 *
 * The tradeoff: this data is daily and lands a day behind, so callers work in
 * whole UTC days anchored on the latest ingested date rather than in
 * "now minus N hours".
 */

const DEFAULT_BASE_URL = 'https://nrp-accounting-mcp.nrp-nautilus.io/openapi';
const DEFAULT_TIMEOUT_MS = 60000;

/** How long to reuse a `get_latest_data_date` answer before asking again. */
const LATEST_DATE_TTL_MS = 15 * 60 * 1000;

let latestDateCache = null;

export function getAccountingBaseUrl() {
  const base = process.env.NRP_ACCOUNTING_API_URL || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

/*
 * mcpo normally answers with the tool's result object, but an MCP tool result
 * can also arrive as a list of content blocks carrying JSON in `text`. Accept
 * both so a bridge upgrade doesn't break the callers.
 */
function unwrapToolResult(payload) {
  if (Array.isArray(payload)) {
    const textBlock = payload.find((block) => block && typeof block.text === 'string');
    if (textBlock) {
      try {
        return JSON.parse(textBlock.text);
      } catch (parseError) {
        return payload;
      }
    }
  }
  return payload;
}

/**
 * Call one accounting tool.
 *
 * @param {string} tool Tool name, e.g. `query_resource_usage`.
 * @param {object} body Tool arguments. Keys with `undefined` values are dropped
 *   so callers can pass optional filters inline.
 */
export async function callAccountingTool(tool, body = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = process.env.NRP_ACCOUNTING_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${getAccountingBaseUrl()}/${tool}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Accounting API ${tool} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Accounting API ${tool} failed with status ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
    );
  }

  return unwrapToolResult(await response.json());
}

/** Format a Date as the `YYYY-MM-DD` the accounting API expects (UTC). */
export function toAccountingDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Shift a `YYYY-MM-DD` string by a whole number of days. */
export function addDays(dateString, days) {
  const shifted = new Date(`${dateString}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toAccountingDate(shifted);
}

/**
 * Most recent ingested accounting date, memoised briefly.
 *
 * The ETL runs once a day, so re-asking on every request buys nothing and adds
 * a round trip to each panel load.
 */
export async function getLatestDataDate() {
  if (latestDateCache && Date.now() - latestDateCache.fetchedAt < LATEST_DATE_TTL_MS) {
    return latestDateCache.date;
  }

  const result = await callAccountingTool('get_latest_data_date', { granularity: 'namespace' });
  const latest = result?.latest_data_date;
  if (!latest) {
    throw new Error('Accounting API did not return a latest_data_date');
  }

  latestDateCache = { date: latest, fetchedAt: Date.now() };
  return latest;
}

/*
 * The UI still speaks in the old Prometheus ranges. Accounting data is daily,
 * so 24h means "the latest full day we have".
 */
export const ACCOUNTING_RANGE_DAYS = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

/**
 * Resolve a UI range into the current and preceding whole-day windows,
 * anchored on the latest ingested accounting date.
 */
export async function resolveRangeWindow(range) {
  const days = ACCOUNTING_RANGE_DAYS[range] || ACCOUNTING_RANGE_DAYS['7d'];
  const end = await getLatestDataDate();
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { days, start, end, prevStart, prevEnd };
}

/**
 * GPU and CPU hours for a set of nodes over one date window.
 *
 * Returns `{ gpuHours, cpuHours }`. A node with no usage in the window simply
 * contributes no rows, so an idle site reports zeroes rather than erroring.
 */
export async function fetchNodeResourceHours(nodeNames, startDate, endDate) {
  const result = await callAccountingTool('query_resource_usage', {
    start_date: startDate,
    end_date: endDate,
    node: nodeNames,
    resource: ['gpu', 'cpu'],
    group_by: ['resource'],
    limit: 100,
  });

  const totals = { gpuHours: 0, cpuHours: 0 };
  for (const row of result?.rows || []) {
    const usage = parseFloat(row.usage) || 0;
    if (row.resource === 'gpu') {
      totals.gpuHours += usage;
    } else if (row.resource === 'cpu') {
      totals.cpuHours += usage;
    }
  }
  return totals;
}
