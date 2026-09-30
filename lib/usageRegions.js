/*
 * Pure helpers over the usage-by-region.json payload (built by
 * generate-nodes/usage-lib.js). No React, no DOM: checked by
 * lib/usageRegions.checks.js.
 *
 * Region codes are `US-XX` for a US state and ISO alpha-2 for everything else.
 */

const US_STATE_PREFIX = 'US-';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isUsStateCode = (code) => typeof code === 'string' && code.startsWith(US_STATE_PREFIX);

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

export function summarizeRegions(usage) {
  const list = regionList(usage);
  const usStates = list.filter((region) => region.isUsState).length;
  return {
    usStates,
    otherRegions: list.length - usStates,
    institutions: list.reduce((total, region) => total + region.institutionCount, 0),
  };
}

export function shapeCodeSet(shapes) {
  return new Set((shapes?.features || []).map((f) => f.properties?.code).filter(Boolean));
}

/*
 * Regions with no outline (countries too small for the 110m world file, e.g.
 * Singapore) become a dot at the mean location of their institutions, so they
 * are still visible and clickable. Computed from the loaded outlines, so a newly
 * appearing small country needs no rebuild of public/geo/usage-regions.json.
 */
export function pointFallbackFeatures(usage, shapeCodes) {
  const features = [];
  for (const [code, region] of Object.entries(regionsOf(usage))) {
    if (shapeCodes.has(code)) continue;
    const located = (region.institutions || [])
      .map((name) => usage.institutions?.[name])
      .filter((entry) => entry && Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
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

export function formatWindow(window) {
  if (!window?.start || !window?.end) return '';
  const format = (iso) => {
    const [year, month] = iso.split('-');
    return `${MONTHS[Number(month) - 1]} ${year}`;
  };
  return `${format(window.start)} – ${format(window.end)}`;
}
