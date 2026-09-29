/*
 * Publishes usage-by-region.json: every US state and country that is home to an
 * institution with NRP usage in the last three years, with the institutions in
 * each. Runs after generate-nodes.js in the same CronJob.
 *
 *   node generate-usage.js            # publish to R2
 *   node generate-usage.js --dry-run  # write ./usage-by-region.json instead
 *
 * See docs/superpowers/specs/2026-09-29-usage-map-design.md.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { uploadToR2 } = require('./r2');
const lib = require('./usage-lib');

const ACCOUNTING_API_URL = (
  process.env.ACCOUNTING_API_URL || 'https://nrp-accounting-mcp.nrp-nautilus.io/openapi'
).replace(/\/$/, '');
// The last published copy doubles as the ROR cache: the job starts from a fresh
// clone every run, so there is nowhere else to keep it.
const USAGE_PUBLIC_URL = process.env.USAGE_PUBLIC_URL || 'https://dash-api.nrp.ai/usage-by-region.json';
const ROR_API_URL = 'https://api.ror.org/v2/organizations';
const OUTPUT_KEY = 'usage-by-region.json';
// The accounting API caps `limit` at 5000; checkRowLimit fails the run if a
// result reaches it.
const ROW_LIMIT = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries(label, fn, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`${label} failed (attempt ${attempt}): ${error.message}; retrying`);
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

async function callAccounting(tool, body) {
  const response = await withRetries(`Accounting ${tool}`, () =>
    axios.post(`${ACCOUNTING_API_URL}/${tool}`, body, { timeout: 120000 }),
  );
  return response.data;
}

async function fetchPrevious() {
  try {
    const response = await axios.get(USAGE_PUBLIC_URL, { timeout: 30000 });
    return response.data && typeof response.data === 'object' ? response.data : null;
  } catch (error) {
    console.log(`No previous ${OUTPUT_KEY} (${error.message}); resolving every institution fresh`);
    return null;
  }
}

async function lookupRor(name) {
  const response = await withRetries(`ROR "${name}"`, () =>
    axios.get(ROR_API_URL, { params: { affiliation: name }, timeout: 30000 }),
  );
  return lib.pickRorMatch(response.data?.items, name);
}

function loadOverrides() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'institution-overrides.json'), 'utf8'));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const latest = await callAccounting('get_latest_data_date', {});
  if (!latest?.latest_data_date) throw new Error('Accounting API did not return latest_data_date');
  const window = lib.usageWindow(latest.latest_data_date);
  console.log(`Usage window: ${window.start} to ${window.end}`);

  const usage = await callAccounting('query_resource_usage', {
    start_date: window.start,
    end_date: window.end,
    group_by: ['institution', 'resource'],
    resource: Object.keys(lib.RESOURCE_KEYS),
    limit: ROW_LIMIT,
  });
  lib.checkRowLimit(usage);
  if (!Array.isArray(usage.rows) || usage.rows.length === 0) {
    throw new Error('Accounting API returned no usage rows');
  }

  const { byInstitution, unattributed } = lib.pivotUsage(usage.rows);
  const previous = await fetchPrevious();
  const resolved = await lib.resolveInstitutions(Object.keys(byInstitution), {
    overrides: loadOverrides(),
    previous,
    lookupRor,
    onLookupError: (name, error) => console.log(`ROR lookup failed for "${name}": ${error.message}`),
  });

  const doc = lib.buildUsageDocument({
    window,
    usageByInstitution: byInstitution,
    resolved,
    unattributed,
    generatedAt: new Date().toISOString(),
  });

  const regionCount = Object.keys(doc.regions).length;
  const matches = Object.values(doc.institutions).reduce((counts, entry) => {
    counts[entry.match] = (counts[entry.match] || 0) + 1;
    return counts;
  }, {});
  console.log(
    `${Object.keys(doc.institutions).length} institutions in ${regionCount} regions ` +
    `(${JSON.stringify(matches)}); ${doc.unmapped.length} unmapped`,
  );
  for (const { name } of doc.unmapped) console.log(`  unmapped: ${name}`);

  if (regionCount === 0) {
    throw new Error('No institution resolved to a region; refusing to publish an empty map');
  }

  if (dryRun) {
    fs.writeFileSync(path.join(__dirname, OUTPUT_KEY), JSON.stringify(doc, null, 2));
    console.log(`Dry run: wrote ${OUTPUT_KEY}`);
    return;
  }
  await uploadToR2(OUTPUT_KEY, JSON.stringify(doc));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
