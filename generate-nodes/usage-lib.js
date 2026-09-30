/*
 * Pure helpers for generate-usage.js: no network and no environment access, so
 * everything here is covered by test/usage-lib.test.js. The shape of the document
 * built at the end is described in
 * docs/superpowers/specs/2026-09-29-usage-map-design.md.
 */

const RESOURCE_KEYS = { cpu: 'cpu_core_hours', gpu: 'gpu_hours', llm: 'llm_tokens' };
const WINDOW_YEARS = 3;
const byName = (a, b) => a.localeCompare(b);

function emptyUsage() {
  return { cpu_core_hours: 0, gpu_hours: 0, llm_tokens: 0 };
}

function addUsage(target, usage) {
  for (const key of Object.keys(target)) target[key] += usage[key] || 0;
  return target;
}

const hasAnyUsage = (usage) => Object.values(usage).some((value) => value > 0);

/*
 * Three years ending on the accounting data's latest date, inclusive at both
 * ends. Calculated in UTC so the host's timezone cannot shift it by a day.
 */
function usageWindow(latestDate, years = WINDOW_YEARS) {
  const end = new Date(`${latestDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) throw new Error(`Invalid latest_data_date: ${latestDate}`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  start.setUTCDate(start.getUTCDate() + 1);
  const iso = (date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

// Namespaces without portal metadata are recorded as "Unknown".
function isUnattributed(name) {
  const trimmed = (name || '').trim();
  return trimmed === '' || trimmed === 'Unknown';
}

// Some portal names carry an allocation suffix, e.g. "Purdue University / 0018259".
function cleanInstitutionName(name) {
  return (name || '').split(' / ')[0].trim();
}

function pivotUsage(rows) {
  const byInstitution = {};
  const unattributed = emptyUsage();

  for (const row of rows) {
    const key = RESOURCE_KEYS[row.resource];
    if (!key) continue;
    const usage = Number(row.usage) || 0;
    if (isUnattributed(row.institution)) {
      unattributed[key] += usage;
      continue;
    }
    const name = row.institution.trim();
    if (!byInstitution[name]) byInstitution[name] = emptyUsage();
    byInstitution[name][key] += usage;
  }

  // "Any usage" is what highlights a region, so an all-zero row is no usage.
  for (const name of Object.keys(byInstitution)) {
    if (!hasAnyUsage(byInstitution[name])) delete byInstitution[name];
  }
  return { byInstitution, unattributed };
}

// The server caps `limit`, so a result that reaches it may be missing rows.
function checkRowLimit(response) {
  const { row_count: rowCount, limit } = response || {};
  if (typeof rowCount !== 'number' || typeof limit !== 'number') {
    throw new Error('Accounting API response is missing row_count or limit');
  }
  if (rowCount >= limit) {
    throw new Error(`Accounting API returned ${rowCount} rows at limit ${limit}; the result may be truncated`);
  }
}

/*
 * US institutions are keyed by state (US-NE); everything else by ISO country,
 * which is also how ROR files US territories (GU, PR, ...).
 */
function regionFromRorOrganization(org) {
  const location = org?.locations?.[0]?.geonames_details;
  if (!location || !location.country_code) return null;

  const base = { ror: org.id || null, lat: location.lat ?? null, lng: location.lng ?? null };
  if (location.country_code === 'US') {
    if (!location.country_subdivision_code) return null;
    return {
      ...base,
      region: `US-${location.country_subdivision_code}`,
      regionName: location.country_subdivision_name || location.country_subdivision_code,
    };
  }
  return {
    ...base,
    region: location.country_code,
    regionName: location.country_name || location.country_code,
  };
}

/*
 * ROR's affiliation endpoint marks a confident match as `chosen`. Without one, an
 * exact name is accepted only if every organisation with that name is in the same
 * region: ROR returns same-named organisations (American University in Managua
 * and in Washington) as tied results in no stable order.
 */
function pickRorMatch(items, cleanedName) {
  if (!Array.isArray(items)) return null;
  const chosen = items.find((item) => item.chosen);
  if (chosen) return chosen.organization;

  const wanted = cleanedName.toLowerCase();
  const exact = items
    .map((item) => item.organization)
    .filter((org) => (org?.names || []).some((name) => (name.value || '').toLowerCase() === wanted));
  if (exact.length === 0) return null;

  const regionOf = (org) => regionFromRorOrganization(org)?.region ?? null;
  const region = regionOf(exact[0]);
  return exact.every((org) => regionOf(org) === region) ? exact[0] : null;
}

function resolveFromOverride(overrides, name) {
  const entry = overrides?.[name];
  if (!entry || !entry.region) return null;
  return {
    ror: entry.ror ?? null,
    region: entry.region,
    regionName: entry.regionName || entry.region,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    match: 'override',
  };
}

/*
 * Only ROR matches are reused: an override's answer lives in the overrides file,
 * so deleting the override has to take effect on the next run.
 */
function resolveFromCache(previous, name) {
  const entry = previous?.institutions?.[name];
  if (!entry || entry.match !== 'ror' || !entry.region) return null;
  return {
    ror: entry.ror ?? null,
    region: entry.region,
    regionName: previous.regions?.[entry.region]?.name || entry.region,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    match: 'ror',
  };
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/*
 * override -> cache -> ROR. `lookupRor(cleanedName)` resolves to a ROR
 * organization or null and may throw; a throw leaves the name unmapped for this
 * run, and it is looked up again next run.
 */
async function resolveInstitutions(names, { overrides = {}, previous = null, lookupRor, onLookupError, concurrency = 4 }) {
  const resolved = {};
  const pending = [];

  for (const name of names) {
    const hit = resolveFromOverride(overrides, name) || resolveFromCache(previous, name);
    if (hit) resolved[name] = hit;
    else pending.push(name);
  }

  await mapLimit(pending, concurrency, async (name) => {
    let org = null;
    try {
      org = await lookupRor(cleanInstitutionName(name));
    } catch (error) {
      if (onLookupError) onLookupError(name, error);
    }
    const region = org ? regionFromRorOrganization(org) : null;
    resolved[name] = region ? { ...region, match: 'ror' } : null;
  });

  return resolved;
}

function buildUsageDocument({ window, usageByInstitution, resolved, unattributed, generatedAt }) {
  const regions = {};
  const institutions = {};
  const unmapped = [];

  for (const name of Object.keys(usageByInstitution).sort(byName)) {
    const usage = usageByInstitution[name];
    const hit = resolved[name];
    if (!hit) {
      unmapped.push({ name, usage });
      continue;
    }

    institutions[name] = {
      ror: hit.ror, region: hit.region, lat: hit.lat, lng: hit.lng, match: hit.match, usage,
    };
    if (!regions[hit.region]) {
      regions[hit.region] = { name: hit.regionName, institutions: new Set(), totals: emptyUsage() };
    }
    // The panel shows display names, so "X" and "X / 0087239" are listed once.
    regions[hit.region].institutions.add(cleanInstitutionName(name));
    addUsage(regions[hit.region].totals, usage);
  }

  // Sorted keys keep the published file diffable run to run.
  const sortedRegions = Object.fromEntries(
    Object.keys(regions).sort().map((code) => [
      code,
      { ...regions[code], institutions: [...regions[code].institutions].sort(byName) },
    ]),
  );

  return {
    version: 1,
    generated_at: generatedAt,
    window,
    regions: sortedRegions,
    institutions,
    unmapped,
    unattributed,
  };
}

const countMapped = (doc) => {
  const institutions = doc?.institutions;
  return institutions && typeof institutions === 'object' ? Object.keys(institutions).length : null;
};

/*
 * A run that maps fewer than half as many institutions as the published file is
 * more likely a broken lookup than real change, so it is not published.
 */
function checkMappedDrop(previous, doc) {
  const previousCount = countMapped(previous);
  const currentCount = countMapped(doc) ?? 0;
  const ok = previousCount === null || currentCount * 2 >= previousCount;
  return { ok, previousCount, currentCount };
}

module.exports = {
  RESOURCE_KEYS,
  emptyUsage,
  usageWindow,
  cleanInstitutionName,
  isUnattributed,
  pivotUsage,
  checkRowLimit,
  regionFromRorOrganization,
  pickRorMatch,
  resolveInstitutions,
  buildUsageDocument,
  checkMappedDrop,
};
