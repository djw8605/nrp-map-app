/*
 * Behavioural checks for lib/usageRegions, in the same assertions-as-data style
 * as lib/siteClusters.checks.js (the project has no test runner). Run with:
 *
 *   node scripts/run-usage-region-checks.mjs
 *
 * Imports carry explicit .js extensions so plain node can load this file.
 */
import {
  binColorExpression,
  binIndex,
  formatUsageAmount,
  formatUsageExact,
  formatWindow,
  getRegion,
  highlightedCodes,
  otherRegionList,
  pointFallbackFeatures,
  regionBounds,
  regionList,
  regionRank,
  searchUsage,
  shapeCodeSet,
  topCount,
  usHeadline,
  usRegionList,
  usSummary,
  windowMonths,
} from './usageRegions.js';

const USAGE = {
  window: { start: '2023-09-29', end: '2026-09-28' },
  regions: {
    SG: { name: 'Singapore', institutions: ['National University of Singapore', 'Nanyang Technological University', 'Unlocated Institute'] },
    'US-NE': { name: 'Nebraska', institutions: ['Wayne State College', 'University of Nebraska–Lincoln'] },
    KR: { name: 'South Korea', institutions: ['Yonsei University'] },
    'US-CA': { name: 'California', institutions: ['UC San Diego'] },
    PR: { name: 'Puerto Rico', institutions: ['University of Puerto Rico'] },
  },
  // Keyed by raw accounting name; `regions[].institutions` holds display names,
  // so the point fallback must join on `region`, not on the name.
  institutions: {
    'National University of Singapore / 0012345': { region: 'SG', lat: 1.3, lng: 103.8 },
    'Nanyang Technological University': { region: 'SG', lat: 1.4, lng: 103.6 },
    'Unlocated Institute': { region: 'SG', lat: null, lng: null },
    'Wayne State College': { region: 'US-NE', lat: 42.2, lng: -97.0 },
    'University of Nebraska–Lincoln': { region: 'US-NE', lat: 40.8, lng: -96.7 },
    'Yonsei University': { region: 'KR', lat: 37.5, lng: 126.9 },
    'UC San Diego': { region: 'US-CA', lat: 32.9, lng: -117.2 },
    'University of Puerto Rico': { region: 'PR', lat: 18.2, lng: -67.1 },
  },
};

const SHAPES = {
  type: 'FeatureCollection',
  features: ['US-NE', 'US-CA', 'PR', 'KR', 'DE'].map((code) => ({
    type: 'Feature', properties: { code, name: code }, geometry: { type: 'Polygon', coordinates: [] },
  })),
};

// Real-shaped outlines for the bounds checks: a box, and an Aleutian-style
// MultiPolygon with parts on both sides of the antimeridian.
const BOUNDS_SHAPES = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { code: 'US-NE' }, geometry: { type: 'Polygon', coordinates: [[[-104, 40], [-95.3, 40], [-95.3, 43], [-104, 43], [-104, 40]]] } },
    { type: 'Feature', properties: { code: 'US-AK' }, geometry: { type: 'MultiPolygon', coordinates: [
      [[[-170, 55], [-140, 55], [-140, 70], [-170, 70], [-170, 55]]],
      [[[172, 52], [179, 52], [179, 53], [172, 53], [172, 52]]],
    ] } },
  ],
};

const rows = (counts) => counts.map((institutionCount, index) => ({ code: `R${index}`, institutionCount }));

const check = (name, actual, expected) => ({
  name,
  actual,
  expected,
  pass: JSON.stringify(actual) === JSON.stringify(expected),
});

export function runUsageRegionChecks() {
  const fallback = pointFallbackFeatures(USAGE, shapeCodeSet(SHAPES));
  return [
    check(
      'regionList puts US states first, each group A–Z',
      regionList(USAGE).map((r) => r.code),
      ['US-CA', 'US-NE', 'PR', 'SG', 'KR'],
    ),
    check(
      'regionList counts institutions',
      regionList(USAGE).find((r) => r.code === 'US-NE').institutionCount,
      2,
    ),
    check('highlightedCodes lists every region', highlightedCodes(USAGE).sort(), ['KR', 'PR', 'SG', 'US-CA', 'US-NE']),
    check(
      'getRegion returns names sorted A–Z',
      getRegion(USAGE, 'US-NE'),
      { code: 'US-NE', name: 'Nebraska', institutions: ['University of Nebraska–Lincoln', 'Wayne State College'], totals: null },
    ),
    check('getRegion is null for an unknown or empty code', [getRegion(USAGE, 'US-XX'), getRegion(USAGE, null)], [null, null]),
    check(
      'usRegionList keeps US states and territories, most institutions first, ties A–Z',
      usRegionList(USAGE).map((r) => r.code),
      ['US-NE', 'US-CA', 'PR'],
    ),
    check('usSummary counts US states and territories and their institutions', usSummary(USAGE), { regions: 3, institutions: 4 }),
    check(
      'regionRank ranks by institution count, ties sharing a rank',
      ['US-NE', 'US-CA', 'PR'].map((code) => regionRank(USAGE, code)),
      [{ rank: 1, total: 3, tied: 1 }, { rank: 2, total: 3, tied: 2 }, { rank: 2, total: 3, tied: 2 }],
    ),
    check('regionRank is null outside the US', [regionRank(USAGE, 'KR'), regionRank(USAGE, null)], [null, null]),
    check(
      'pointFallbackFeatures draws only regions without an outline',
      fallback.features.map((f) => f.properties.code),
      ['SG'],
    ),
    check(
      'pointFallbackFeatures places the dot at the mean location of the located institutions in the region',
      fallback.features[0].geometry.coordinates.map((n) => Math.round(n * 100) / 100),
      [103.7, 1.35],
    ),
    check(
      'empty payloads are safe',
      [regionList(undefined), highlightedCodes(null), usRegionList(undefined), usSummary(null)],
      [[], [], [], { regions: 0, institutions: 0 }],
    ),
    check('binIndex steps 1 · 2–3 · 4–6 · 7–11 · 12+', [0, 1, 2, 3, 4, 6, 7, 11, 12, 47].map(binIndex), [-1, 0, 1, 1, 2, 2, 3, 3, 4, 4]),
    check(
      'binColorExpression groups codes by bin and skips empty bins',
      binColorExpression(USAGE, ['c1', 'c2', 'c3', 'c4', 'c5'], 'none'),
      ['match', ['get', 'code'], ['KR', 'US-CA', 'PR'], 'c1', ['SG', 'US-NE'], 'c2', 'none'],
    ),
    check('binColorExpression falls back to a plain colour with no regions', binColorExpression(null, ['c1'], 'none'), 'none'),
    check('usHeadline names states and territories from the data', usHeadline(USAGE), { label: '2 states and 1 territory', regions: 3, institutions: 4 }),
    check(
      'usHeadline says DC and drops territories that are not there',
      usHeadline({ regions: { 'US-CA': { institutions: ['a'] }, 'US-DC': { institutions: ['b'] } } }).label,
      '1 state and DC',
    ),
    check('otherRegionList is non-US, most institutions first', otherRegionList(USAGE).map((r) => r.code), ['SG', 'KR']),
    check('topCount shows everything when the list is short', topCount(rows([5, 4, 3]), 10), 3),
    check('topCount stretches the cut to include ties', topCount(rows([9, 8, 7, 4, 4, 4, 2]), 4), 6),
    check('topCount stops stretching at the ceiling', topCount(rows([1, 1, 1, 1, 1, 1]), 2, 4), 4),
    check(
      'searchUsage finds regions and institutions, ignoring case and accents',
      [searchUsage(USAGE, 'nebraska').regions.map((r) => r.code), searchUsage(USAGE, 'NEBRASKA–LINC').institutions],
      [['US-NE'], [{ name: 'University of Nebraska–Lincoln', code: 'US-NE', regionName: 'Nebraska' }]],
    ),
    check('searchUsage is empty for a blank query', searchUsage(USAGE, '  '), { regions: [], institutions: [] }),
    check(
      'getRegion passes the region totals through',
      getRegion({ regions: { KR: { name: 'South Korea', institutions: [], totals: { gpu_hours: 2 } } } }, 'KR').totals,
      { gpu_hours: 2 },
    ),
    check(
      'formatUsageAmount is compact to three digits, and never shows real usage as zero',
      [0, 0.125, 7.6, 4200, 1234567, 14993605, 184016563.6, 304196624529, null, undefined].map(formatUsageAmount),
      ['0', '<1', '7.6', '4.2K', '1.23M', '15M', '184M', '304B', '—', '—'],
    ),
    check(
      'formatUsageExact spells the full figure out',
      [184016563.6, 0.125, 0, null].map(formatUsageExact),
      ['184,016,564', 'less than 1', '0', ''],
    ),
    check('regionBounds boxes a polygon', regionBounds(BOUNDS_SHAPES, 'US-NE'), [[-104, 40], [-95.3, 43]]),
    check('regionBounds keeps Alaska on one side of the antimeridian', regionBounds(BOUNDS_SHAPES, 'US-AK'), [[-188, 52], [-140, 70]]),
    check('regionBounds is null for an unknown code', regionBounds(BOUNDS_SHAPES, 'US-XX'), null),
    check('formatWindow reads as month and year', formatWindow(USAGE.window), 'Sep 2023 – Sep 2026'),
    check('formatWindow is empty without a window', formatWindow(undefined), ''),
    check('windowMonths names both ends', windowMonths(USAGE.window), { start: 'Sep 2023', end: 'Sep 2026' }),
    check('windowMonths is null without a window', windowMonths(undefined), null),
  ];
}
