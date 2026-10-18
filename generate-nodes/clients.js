/*
 * Network clients shared by generate-usage.js and generate-wall.js: the public
 * accounting API, the ROR organization API, and the retry helper both use.
 *
 * Environment: ACCOUNTING_API_URL (optional, defaults to the public bridge).
 */
const axios = require('axios');
const { pickRorMatch } = require('./usage-lib');

const ACCOUNTING_API_URL = (
  process.env.ACCOUNTING_API_URL || 'https://nrp-accounting-mcp.nrp-nautilus.io/openapi'
).replace(/\/$/, '');
const ROR_API_URL = 'https://api.ror.org/v2/organizations';

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

async function lookupRor(name) {
  const response = await withRetries(`ROR "${name}"`, () =>
    axios.get(ROR_API_URL, { params: { affiliation: name }, timeout: 30000 }),
  );
  return pickRorMatch(response.data?.items, name);
}

// `id` is the full ROR id (https://ror.org/043mer456) or just its last part.
async function fetchRorOrganization(id) {
  const key = String(id).split('/').pop();
  const response = await withRetries(`ROR ${key}`, () =>
    axios.get(`${ROR_API_URL}/${key}`, { timeout: 30000 }),
  );
  return response.data;
}

module.exports = { withRetries, callAccounting, lookupRor, fetchRorOrganization };
