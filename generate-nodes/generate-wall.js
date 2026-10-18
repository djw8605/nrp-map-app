/*
 * Publishes wall.json for the /wall kiosk page: one day of GPU work by
 * researcher's institution and by the campus whose GPUs ran it, with both
 * placed on the map, plus totals and per-institution figures for the 30 days
 * ending on that day. Runs after generate-usage.js in the same CronJob.
 *
 *   node generate-wall.js            # publish to R2
 *   node generate-wall.js --dry-run  # write ./wall.json instead
 *
 * See docs/superpowers/specs/2026-10-18-nrp-live-wall-design.md and
 * docs/superpowers/specs/2026-10-18-wall-focus-and-30-days-design.md.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { uploadToR2 } = require('./r2');
const { callAccounting, lookupRor, fetchRorOrganization } = require('./clients');
const usageLib = require('./usage-lib');
const lib = require('./wall-lib');

// The usage map's published file is the institution cache (only ROR matches are
// reused, as in generate-usage.js); nodes.json is the Netbox fallback for hosts.
const USAGE_PUBLIC_URL = process.env.USAGE_PUBLIC_URL || 'https://dash-api.nrp.ai/usage-by-region.json';
const NODES_PUBLIC_URL = process.env.NODES_PUBLIC_URL || 'https://dash-api.nrp.ai/nodes.json';
const HOME = process.env.WALL_HOME_INSTITUTION || lib.DEFAULT_HOME;
const OUTPUT_KEY = 'wall.json';
// The accounting API caps `limit` at 5000; checkRowLimit fails the run if a
// result reaches it.
const ROW_LIMIT = 5000;

const hasPoint = (entry) => Boolean(entry) && Number.isFinite(entry.lat) && Number.isFinite(entry.lng);

async function fetchOptional(url, what) {
  try {
    const response = await axios.get(url, { timeout: 30000 });
    return response.data && typeof response.data === 'object' ? response.data : null;
  } catch (error) {
    console.log(`Could not read ${what} (${error.message}); continuing without it`);
    return null;
  }
}

function loadOverrides() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'institution-overrides.json'), 'utf8'));
}

/*
 * "City, ST" for each placed host, from its ROR record: the one matched this run
 * if there was one, else fetched by id. An override has no ROR record, so its
 * region name stands in; a Netbox match has neither.
 */
async function hostPlaces(hosts, resolved, rorOrganizations) {
  const places = {};
  for (const host of hosts) {
    const entry = resolved[host];
    if (!hasPoint(entry)) continue;
    if (!entry.ror) {
      places[host] = entry.regionName || null;
      continue;
    }
    try {
      const org = rorOrganizations.get(entry.ror) || await fetchRorOrganization(entry.ror);
      places[host] = lib.placeFromRorOrganization(org);
    } catch (error) {
      console.log(`ROR record ${entry.ror} for "${host}" failed: ${error.message}; no place label`);
      places[host] = null;
    }
  }
  return places;
}

/*
 * GPU hours by (user, host) and the LLM token total for start..end inclusive.
 * A result that reaches the row limit, or has no GPU rows, fails the run.
 */
async function queryWindow(start, end) {
  const gpu = await callAccounting('query_resource_usage', {
    start_date: start,
    end_date: end,
    resource: 'gpu',
    group_by: ['institution', 'node_institution'],
    limit: ROW_LIMIT,
  });
  usageLib.checkRowLimit(gpu);
  if (!Array.isArray(gpu.rows) || gpu.rows.length === 0) {
    throw new Error(`Accounting API returned no GPU rows for ${start} to ${end}`);
  }

  const llm = await callAccounting('query_llm_token_usage', {
    start_date: start,
    end_date: end,
    group_by: ['model'],
    limit: ROW_LIMIT,
  });
  usageLib.checkRowLimit(llm);
  if (!Array.isArray(llm.rows)) throw new Error(`Accounting API returned no LLM rows for ${start} to ${end}`);

  return { ...lib.collectPairs(gpu.rows), llmTokens: lib.sumTokens(llm.rows) };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const latest = await callAccounting('get_latest_data_date', {});
  if (!latest?.latest_data_date) throw new Error('Accounting API did not return latest_data_date');
  const day = latest.latest_data_date;
  console.log(`Wall day: ${day}`);

  const dayWindow = await queryWindow(day, day);
  console.log(
    `${dayWindow.pairs.length} user/host pairs, ${dayWindow.gpuHours.toFixed(1)} GPU hours, ` +
    `${Math.round(dayWindow.llmTokens)} LLM tokens`,
  );
  const monthStart = lib.windowStart(day);
  const monthWindow = await queryWindow(monthStart, day);
  console.log(
    `${monthStart} to ${day}: ${monthWindow.pairs.length} user/host pairs, ` +
    `${monthWindow.gpuHours.toFixed(1)} GPU hours, ${Math.round(monthWindow.llmTokens)} LLM tokens`,
  );

  // Both windows are placed together, so the month only adds lookups for names
  // the day did not have.
  const pairs = [...dayWindow.pairs, ...monthWindow.pairs];
  const users = new Set(pairs.map((pair) => pair.user).filter(Boolean));
  const hosts = [...new Set(pairs.map((pair) => pair.host).filter(Boolean))].sort();
  const names = [...new Set([...users, ...hosts])].sort();

  // Keep each organization matched this run, so its host place needs no second call.
  const rorOrganizations = new Map();
  const resolved = await usageLib.resolveInstitutions(names, {
    overrides: loadOverrides(),
    previous: await fetchOptional(USAGE_PUBLIC_URL, 'usage-by-region.json'),
    lookupRor: async (name) => {
      const org = await lookupRor(name);
      if (org?.id) rorOrganizations.set(org.id, org);
      return org;
    },
    onLookupError: (name, error) => console.log(`ROR lookup failed for "${name}": ${error.message}`),
  });

  const unplacedHosts = hosts.filter((host) => !hasPoint(resolved[host]));
  if (unplacedHosts.length > 0) {
    const nodes = await fetchOptional(NODES_PUBLIC_URL, 'nodes.json');
    for (const host of unplacedHosts) {
      resolved[host] = lib.netboxPlacement(host, Array.isArray(nodes) ? nodes : []);
    }
  }

  const locations = Object.fromEntries(
    names.map((name) => [name, hasPoint(resolved[name]) ? { lat: resolved[name].lat, lng: resolved[name].lng } : null]),
  );
  const doc = lib.buildWallDocument({
    day,
    generatedAt: new Date().toISOString(),
    pairs: dayWindow.pairs,
    gpuHours: dayWindow.gpuHours,
    llmTokens: dayWindow.llmTokens,
    locations,
    // Place labels are only drawn for the day's sites.
    places: await hostPlaces(
      hosts.filter((host) => dayWindow.pairs.some((pair) => pair.host === host)),
      resolved,
      rorOrganizations,
    ),
    home: HOME,
    month: { start: monthStart, end: day, ...monthWindow },
  });

  const matches = names.reduce((counts, name) => {
    if (hasPoint(resolved[name])) counts[resolved[name].match] = (counts[resolved[name].match] || 0) + 1;
    return counts;
  }, {});
  const placed = Object.values(matches).reduce((total, count) => total + count, 0);
  console.log(
    `${placed} of ${names.length} institutions placed (${JSON.stringify(matches)}); ` +
    `${doc.unmapped.length} unmapped`,
  );
  for (const { name, side, gpu_hours: hours } of doc.unmapped) {
    console.log(`  unmapped ${side}: ${name} (${hours} GPU hours)`);
  }
  console.log(
    `${doc.sites.length} sites, ${doc.flows.length} flows, away share ${(doc.totals.away_share * 100).toFixed(1)}%; ` +
    `${doc.home.institution} ran ${doc.home.served_hours} GPU hours for ${doc.home.partner_count} other institutions`,
  );
  console.log(
    `30 days: ${doc.month.totals.gpu_hours} GPU hours, away share ${(doc.month.totals.away_share * 100).toFixed(1)}%, ` +
    `${doc.month.totals.host_sites} host sites; figures for ${Object.keys(doc.institutions).length} institutions on the map`,
  );

  const problem = lib.publishProblem(doc);
  if (problem) throw new Error(`${problem}; refusing to publish`);

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
