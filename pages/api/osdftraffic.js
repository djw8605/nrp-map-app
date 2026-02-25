import { PrometheusDriver } from 'prometheus-query';
import { getNodesDataFromR2 } from '../../lib/nodesUtils';

const prom = new PrometheusDriver({
  endpoint: 'https://prometheus.nrp-nautilus.io/',
  baseURL: '/api/v1',
  timeout: 60000,
});

const DEFAULT_WINDOW_MINUTES = 60;
const MAX_WINDOW_MINUTES = 360;
const STEP_SECONDS = 60;

const EMPTY_TRAFFIC = {
  perNode: {},
  aggregate: {
    upload: 0,
    download: 0,
    timeseries: [],
  },
};

function normalizeSites(nodesPayload) {
  if (Array.isArray(nodesPayload)) return nodesPayload;
  if (nodesPayload && typeof nodesPayload === 'object') return Object.values(nodesPayload);
  return [];
}

function normalizeNodeId(nodeId) {
  if (typeof nodeId !== 'string') return '';
  return nodeId.replace(/:[0-9]+$/, '');
}

function extractOsdfNodeIds(sites) {
  const nodeIds = new Set();
  for (const site of sites) {
    const nodes = Array.isArray(site?.nodes) ? site.nodes : [];
    for (const node of nodes) {
      if (node?.cache !== true) continue;
      if (typeof node?.name !== 'string' || node.name.length === 0) continue;
      nodeIds.add(normalizeNodeId(node.name));
    }
  }
  return Array.from(nodeIds);
}

function parseRequestedNodeIds(nodeIdsQuery) {
  if (typeof nodeIdsQuery === 'undefined') return [];
  const csv = Array.isArray(nodeIdsQuery) ? nodeIdsQuery.join(',') : nodeIdsQuery;
  if (typeof csv !== 'string') return [];

  const unique = new Set();
  for (const value of csv.split(',')) {
    const normalized = normalizeNodeId(value.trim());
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function escapeRegex(value) {
  // PromQL string literals require escaped backslashes (e.g. "\\.") so the
  // regex engine receives the intended literal metacharacter escape ("\.")
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
}

function buildTrafficQuery(nodeRegex) {
  const filter = `{instance=~"(${nodeRegex})(:[0-9]+)?",device=~"en.*|et.*"}`;

  const perNodeUpload = `
    label_replace(
      label_replace(
        label_replace(
          sum by (instance) (rate(node_network_transmit_bytes_total${filter}[5m])),
          "nodeId", "$1", "instance", "([^:]+)(:[0-9]+)?"
        ),
        "direction", "upload", "__name__", ".*"
      ),
      "scope", "perNode", "__name__", ".*"
    )
  `;

  const perNodeDownload = `
    label_replace(
      label_replace(
        label_replace(
          sum by (instance) (rate(node_network_receive_bytes_total${filter}[5m])),
          "nodeId", "$1", "instance", "([^:]+)(:[0-9]+)?"
        ),
        "direction", "download", "__name__", ".*"
      ),
      "scope", "perNode", "__name__", ".*"
    )
  `;

  const aggregateUpload = `
    label_replace(
      label_replace(
        sum(rate(node_network_transmit_bytes_total${filter}[5m])),
        "direction", "upload", "__name__", ".*"
      ),
      "scope", "aggregate", "__name__", ".*"
    )
  `;

  const aggregateDownload = `
    label_replace(
      label_replace(
        sum(rate(node_network_receive_bytes_total${filter}[5m])),
        "direction", "download", "__name__", ".*"
      ),
      "scope", "aggregate", "__name__", ".*"
    )
  `;

  return `(${perNodeUpload}) or (${perNodeDownload}) or (${aggregateUpload}) or (${aggregateDownload})`;
}

function parseSeriesValues(values) {
  if (!Array.isArray(values)) return [];
  const parsed = values
    .map((point) => {
      const timestamp = new Date(point?.time).getTime();
      const value = Number(point?.value);
      if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return null;
      return { timestamp, value };
    })
    .filter(Boolean);

  parsed.sort((a, b) => a.timestamp - b.timestamp);
  return parsed;
}

function mergeDirectionalSeries(uploadSeries, downloadSeries) {
  const bucket = new Map();

  for (const point of uploadSeries) {
    bucket.set(point.timestamp, {
      timestamp: point.timestamp,
      upload: point.value,
      download: 0,
    });
  }

  for (const point of downloadSeries) {
    const row = bucket.get(point.timestamp) || {
      timestamp: point.timestamp,
      upload: 0,
      download: 0,
    };
    row.download = point.value;
    bucket.set(point.timestamp, row);
  }

  return Array.from(bucket.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((row) => ({
      ...row,
      total: row.upload + row.download,
    }));
}

export default async function handler(req, res) {
  const rawWindow = Number.parseInt(req.query.windowMinutes, 10);
  const windowMinutes = Number.isFinite(rawWindow)
    ? Math.min(Math.max(rawWindow, 5), MAX_WINDOW_MINUTES)
    : DEFAULT_WINDOW_MINUTES;

  try {
    const requestedNodeIds = parseRequestedNodeIds(req.query.nodeIds);
    const hasRequestedNodeIds = typeof req.query.nodeIds !== 'undefined';
    const osdfNodeIds = hasRequestedNodeIds
      ? requestedNodeIds
      : extractOsdfNodeIds(normalizeSites(await getNodesDataFromR2()));

    if (osdfNodeIds.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(EMPTY_TRAFFIC);
      return;
    }

    const nodeRegex = osdfNodeIds.map(escapeRegex).join('|');
    const query = buildTrafficQuery(nodeRegex);
    const end = new Date();
    const start = new Date(end.getTime() - windowMinutes * 60 * 1000);
    const queryResult = await prom.rangeQuery(query, start, end, STEP_SECONDS);

    const traffic = {
      perNode: {},
      aggregate: {
        upload: 0,
        download: 0,
        timeseries: [],
      },
    };

    // Initialize all known OSDF nodes so map rendering can proceed even if Prometheus omits a series.
    for (const nodeId of osdfNodeIds) {
      traffic.perNode[nodeId] = {
        upload: 0,
        download: 0,
        timeseries: [],
      };
    }

    for (const series of queryResult?.result || []) {
      const labels = series?.metric?.labels || {};
      const direction = labels.direction;
      if (direction !== 'upload' && direction !== 'download') continue;

      const seriesValues = parseSeriesValues(series.values);
      const latestValue = seriesValues.length > 0 ? seriesValues[seriesValues.length - 1].value : 0;

      if (labels.scope === 'aggregate' || !labels.nodeId) {
        traffic.aggregate[direction] = latestValue;
        if (direction === 'upload') {
          traffic.aggregate._uploadSeries = seriesValues;
        } else {
          traffic.aggregate._downloadSeries = seriesValues;
        }
        continue;
      }

      const nodeId = normalizeNodeId(labels.nodeId);
      if (!nodeId) continue;

      if (!traffic.perNode[nodeId]) {
        traffic.perNode[nodeId] = {
          upload: 0,
          download: 0,
          timeseries: [],
        };
      }

      traffic.perNode[nodeId][direction] = latestValue;

      if (direction === 'upload') {
        traffic.perNode[nodeId]._uploadSeries = seriesValues;
      } else {
        traffic.perNode[nodeId]._downloadSeries = seriesValues;
      }
    }

    for (const nodeId of Object.keys(traffic.perNode)) {
      const uploadSeries = traffic.perNode[nodeId]._uploadSeries || [];
      const downloadSeries = traffic.perNode[nodeId]._downloadSeries || [];
      traffic.perNode[nodeId].timeseries = mergeDirectionalSeries(uploadSeries, downloadSeries);
      delete traffic.perNode[nodeId]._uploadSeries;
      delete traffic.perNode[nodeId]._downloadSeries;
    }

    const aggregateUploadSeries = traffic.aggregate._uploadSeries || [];
    const aggregateDownloadSeries = traffic.aggregate._downloadSeries || [];
    traffic.aggregate.timeseries = mergeDirectionalSeries(aggregateUploadSeries, aggregateDownloadSeries);
    delete traffic.aggregate._uploadSeries;
    delete traffic.aggregate._downloadSeries;

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(traffic);
  } catch (error) {
    console.error('Error in osdftraffic API:', error);
    res.status(500).json({
      error: 'Failed to fetch OSDF traffic',
      ...EMPTY_TRAFFIC,
    });
  }
}
