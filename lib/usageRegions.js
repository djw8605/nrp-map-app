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
    totals: region.totals || null,
  };
}

/*
 * A usage total for the region panel's cards: compact to three significant
 * digits (15M, 184M, 304B, 1.23M), so the three cards read at one precision
 * whatever their magnitude. "<1" for amounts that round to zero but are not, so
 * a state that ran a few minutes of jobs does not read as no usage at all.
 */
const COMPACT_USAGE = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });
const EXACT_USAGE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUsageAmount(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  if (Math.abs(value) < 1) return '<1';
  return COMPACT_USAGE.format(value);
}

export const USAGE_METRIC_KEYS = ['gpu_hours', 'cpu_core_hours', 'llm_tokens'];

// The full figure behind a compact one, for the tooltip and screen readers.
export function formatUsageExact(value) {
  if (!Number.isFinite(value)) return '';
  if (value !== 0 && Math.abs(value) < 1) return 'less than 1';
  return EXACT_USAGE.format(value);
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

/*
 * Standard competition ranking (1, 2, 2, 4) by institution count, US only.
 * `tied` counts every region on the same count, this one included, so a caller
 * can avoid printing "#34 of 42" for what is really a ten-way tie.
 */
export function regionRank(usage, code) {
  if (!isUsRegionCode(code)) return null;
  const list = usRegionList(usage);
  const region = list.find((entry) => entry.code === code);
  if (!region) return null;
  const ahead = list.filter((entry) => entry.institutionCount > region.institutionCount).length;
  const tied = list.filter((entry) => entry.institutionCount === region.institutionCount).length;
  return { rank: ahead + 1, total: list.length, tied };
}

/*
 * The map's shading: five steps of institution count. Counts, not CPU or GPU
 * hours, on purpose: the shading says who uses NRP, and the amounts are in the
 * region panel, where they are labelled. Fixed
 * breaks rather than quantiles so a region's colour only changes when its own
 * count does, not when some other state gains an institution. The breaks suit
 * today's skew (most states have 1–6, California has 47).
 */
export const INSTITUTION_BINS = [
  { min: 1, max: 1, label: '1' },
  { min: 2, max: 3, label: '2–3' },
  { min: 4, max: 6, label: '4–6' },
  { min: 7, max: 11, label: '7–11' },
  { min: 12, max: Infinity, label: '12+' },
];

export function binIndex(count) {
  if (!(count >= 1)) return -1;
  return INSTITUTION_BINS.findIndex((bin) => count >= bin.min && count <= bin.max);
}

/*
 * A Mapbox `match` expression over `code` that returns the bin's colour. The
 * outlines carry no counts, so the join happens here rather than in the data.
 * `ramp` has one colour per bin; `fallback` paints anything unmatched.
 */
export function binColorExpression(usage, ramp, fallback) {
  const codesByBin = INSTITUTION_BINS.map(() => []);
  for (const [code, region] of Object.entries(regionsOf(usage))) {
    const index = binIndex(region.institutions?.length || 0);
    if (index >= 0) codesByBin[index].push(code);
  }
  const pairs = codesByBin.flatMap((codes, index) => (codes.length ? [codes, ramp[index]] : []));
  return pairs.length ? ['match', ['get', 'code'], ...pairs, fallback] : fallback;
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/*
 * "41 states and DC", "41 states, DC and 2 territories": built from the data so
 * the headline never claims territories that are not there.
 */
export function usHeadline(usage) {
  const list = usRegionList(usage);
  const states = list.filter((r) => isUsStateCode(r.code) && r.code !== 'US-DC').length;
  const hasDc = list.some((r) => r.code === 'US-DC');
  const territories = list.filter((r) => !isUsStateCode(r.code)).length;
  const parts = [
    states ? plural(states, 'state', 'states') : null,
    hasDc ? 'DC' : null,
    territories ? plural(territories, 'territory', 'territories') : null,
  ].filter(Boolean);
  const label = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0] || 'No states';
  return {
    label,
    regions: list.length,
    institutions: list.reduce((total, region) => total + region.institutionCount, 0),
  };
}

// Regions outside the US, most institutions first, ties A–Z.
export function otherRegionList(usage) {
  return regionList(usage)
    .filter((region) => !isUsRegionCode(region.code))
    .sort((a, b) => b.institutionCount - a.institutionCount || a.name.localeCompare(b.name));
}

/*
 * How many of a ranked list to show before "Show all": `limit`, stretched to
 * include everyone tied with the last row shown (up to `ceiling`), so the cut
 * never shows Georgia but hides Maryland on the same count.
 */
export function topCount(list, limit = 10, ceiling = 15) {
  if (list.length <= limit) return list.length;
  let count = limit;
  const last = list[limit - 1].institutionCount;
  while (count < Math.min(list.length, ceiling) && list[count].institutionCount === last) count += 1;
  return count;
}

const normalise = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/*
 * The panel's search: regions by name, and institutions by name (each one
 * pointing at the region it belongs to). Case- and accent-insensitive.
 */
export function searchUsage(usage, query) {
  const needle = normalise(query || '').trim();
  if (!needle) return { regions: [], institutions: [] };

  const regions = [...usRegionList(usage), ...otherRegionList(usage)]
    .filter((region) => normalise(region.name).includes(needle) || region.code.toLowerCase() === needle);

  const institutions = [];
  for (const [code, region] of Object.entries(regionsOf(usage))) {
    for (const name of region.institutions || []) {
      if (normalise(name).includes(needle)) {
        institutions.push({ name, code, regionName: region.name || code });
      }
    }
  }
  institutions.sort((a, b) => a.name.localeCompare(b.name));
  return { regions, institutions };
}

function forEachPosition(geometry, visit) {
  if (!geometry) return;
  const walk = (coords, depth) => {
    if (depth === 0) visit(coords);
    else for (const child of coords || []) walk(child, depth - 1);
  };
  const depths = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  if (geometry.type in depths) walk(geometry.coordinates, depths[geometry.type]);
}

/*
 * [[west, south], [east, north]] around the outlines with these codes, or null.
 *
 * Alaska's Aleutians cross the antimeridian, so a naive min/max spans the whole
 * globe. When it spans more than 180°, the bounds are also measured with
 * longitudes shifted into 0–360 and the narrower of the two wins; the shifted west edge comes back below -180, which
 * Mapbox's fitBounds accepts.
 */
export function regionBounds(shapes, codes) {
  const wanted = new Set(Array.isArray(codes) ? codes : [codes]);
  let south = Infinity; let north = -Infinity;
  let west = Infinity; let east = -Infinity;
  let westShifted = Infinity; let eastShifted = -Infinity;

  for (const feature of shapes?.features || []) {
    if (!wanted.has(feature.properties?.code)) continue;
    forEachPosition(feature.geometry, ([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      south = Math.min(south, lat); north = Math.max(north, lat);
      west = Math.min(west, lng); east = Math.max(east, lng);
      const shifted = lng < 0 ? lng + 360 : lng;
      westShifted = Math.min(westShifted, shifted); eastShifted = Math.max(eastShifted, shifted);
    });
  }
  if (!Number.isFinite(south)) return null;
  if (east - west > 180 && eastShifted - westShifted < east - west) {
    return [[westShifted - 360, south], [eastShifted - 360, north]];
  }
  return [[west, south], [east, north]];
}

// The lower 48 and DC: what the usage camera frames on first load.
const NON_CONTIGUOUS_US = new Set(['US-AK', 'US-HI']);
export const isContiguousUsCode = (code) => isUsStateCode(code) && !NON_CONTIGUOUS_US.has(code);

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
