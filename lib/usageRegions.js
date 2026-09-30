/*
 * Pure helpers over the usage-by-region.json payload (built by
 * generate-nodes/usage-lib.js). No React, no DOM: checked by
 * lib/usageRegions.checks.js.
 *
 * Region codes are `US-XX` for a US state (and DC) and ISO alpha-2 for everything
 * else, including the US territories, which ROR files as their own countries.
 */

const US_STATE_PREFIX = 'US-';
const US_TERRITORY_CODES = new Set(['AS', 'GU', 'MP', 'PR', 'VI']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isUsStateCode = (code) => typeof code === 'string' && code.startsWith(US_STATE_PREFIX);

// States, DC and the five territories: what the usage panel counts as "US".
export const isUsRegionCode = (code) => isUsStateCode(code) || US_TERRITORY_CODES.has(code);

const regionsOf = (usage) => usage?.regions || {};

export function regionList(usage) {
  return Object.entries(regionsOf(usage))
    .map(([code, region]) => ({
      code,
      name: region.name || code,
      institutionCount: region.institutions?.length || 0,
      isUsState: isUsStateCode(code),
    }))
    .sort((a, b) => {
      if (a.isUsState !== b.isUsState) return a.isUsState ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function highlightedCodes(usage) {
  return Object.keys(regionsOf(usage));
}

export function getRegion(usage, code) {
  const region = code ? regionsOf(usage)[code] : null;
  if (!region) return null;
  return {
    code,
    name: region.name || code,
    institutions: [...(region.institutions || [])].sort((a, b) => a.localeCompare(b)),
  };
}

// US states and territories, most institutions first, ties A–Z.
export function usRegionList(usage) {
  return regionList(usage)
    .filter((region) => isUsRegionCode(region.code))
    .sort((a, b) => b.institutionCount - a.institutionCount || a.name.localeCompare(b.name));
}

export function usSummary(usage) {
  const list = usRegionList(usage);
  return {
    regions: list.length,
    institutions: list.reduce((total, region) => total + region.institutionCount, 0),
  };
}

// Standard competition ranking (1, 2, 2, 4) by institution count, US only.
export function regionRank(usage, code) {
  if (!isUsRegionCode(code)) return null;
  const list = usRegionList(usage);
  const region = list.find((entry) => entry.code === code);
  if (!region) return null;
  const ahead = list.filter((entry) => entry.institutionCount > region.institutionCount).length;
  return { rank: ahead + 1, total: list.length };
}

export function shapeCodeSet(shapes) {
  return new Set((shapes?.features || []).map((f) => f.properties?.code).filter(Boolean));
}

/*
 * Regions with no outline (countries too small for the 110m world file, e.g.
 * Singapore) become a dot at the mean location of their institutions, so they
 * are still visible and clickable. Computed from the loaded outlines, so a newly
 * appearing small country needs no rebuild of public/geo/usage-regions.json.
 *
 * Coordinates come from `usage.institutions` (keyed by raw accounting name) by
 * each entry's `region`: `regions[].institutions` holds cleaned display names,
 * which are not keys of that map.
 */
export function pointFallbackFeatures(usage, shapeCodes) {
  const locatedByRegion = {};
  for (const entry of Object.values(usage?.institutions || {})) {
    if (!entry?.region || !Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) continue;
    if (!locatedByRegion[entry.region]) locatedByRegion[entry.region] = [];
    locatedByRegion[entry.region].push(entry);
  }

  const features = [];
  for (const [code, region] of Object.entries(regionsOf(usage))) {
    if (shapeCodes.has(code)) continue;
    const located = locatedByRegion[code] || [];
    if (located.length === 0) continue;

    const mean = (key) => located.reduce((total, entry) => total + entry[key], 0) / located.length;
    features.push({
      type: 'Feature',
      properties: { code, name: region.name || code },
      geometry: { type: 'Point', coordinates: [mean('lng'), mean('lat')] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function windowMonths(window) {
  if (!window?.start || !window?.end) return null;
  const format = (iso) => {
    const [year, month] = iso.split('-');
    return `${MONTHS[Number(month) - 1]} ${year}`;
  };
  return { start: format(window.start), end: format(window.end) };
}

export function formatWindow(window) {
  const months = windowMonths(window);
  return months ? `${months.start} – ${months.end}` : '';
}
