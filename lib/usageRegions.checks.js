/*
 * Behavioural checks for lib/usageRegions, in the same assertions-as-data style
 * as lib/siteClusters.checks.js (the project has no test runner). Run with:
 *
 *   node scripts/run-usage-region-checks.mjs
 *
 * Imports carry explicit .js extensions so plain node can load this file.
 */
import {
  formatWindow,
  getRegion,
  highlightedCodes,
  pointFallbackFeatures,
  regionList,
  shapeCodeSet,
  summarizeRegions,
} from './usageRegions.js';

const USAGE = {
  window: { start: '2023-09-29', end: '2026-09-28' },
  regions: {
    SG: { name: 'Singapore', institutions: ['National University of Singapore', 'Nanyang Technological University', 'Unlocated Institute'] },
    'US-NE': { name: 'Nebraska', institutions: ['Wayne State College', 'University of Nebraska–Lincoln'] },
    KR: { name: 'South Korea', institutions: ['Yonsei University'] },
    'US-CA': { name: 'California', institutions: ['UC San Diego'] },
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
  },
};

const SHAPES = {
  type: 'FeatureCollection',
  features: ['US-NE', 'US-CA', 'KR', 'DE'].map((code) => ({
    type: 'Feature', properties: { code, name: code }, geometry: { type: 'Polygon', coordinates: [] },
  })),
};

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
      ['US-CA', 'US-NE', 'SG', 'KR'],
    ),
    check(
      'regionList counts institutions',
      regionList(USAGE).find((r) => r.code === 'US-NE').institutionCount,
      2,
    ),
    check('highlightedCodes lists every region', highlightedCodes(USAGE).sort(), ['KR', 'SG', 'US-CA', 'US-NE']),
    check(
      'getRegion returns names sorted A–Z',
      getRegion(USAGE, 'US-NE'),
      { code: 'US-NE', name: 'Nebraska', institutions: ['University of Nebraska–Lincoln', 'Wayne State College'] },
    ),
    check('getRegion is null for an unknown or empty code', [getRegion(USAGE, 'US-XX'), getRegion(USAGE, null)], [null, null]),
    check('summarizeRegions splits US states from the rest', summarizeRegions(USAGE), { usStates: 2, otherRegions: 2, institutions: 7 }),
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
    check('empty payloads are safe', [regionList(undefined), highlightedCodes(null), summarizeRegions(undefined)], [[], [], { usStates: 0, otherRegions: 0, institutions: 0 }]),
    check('formatWindow reads as month and year', formatWindow(USAGE.window), 'Sep 2023 – Sep 2026'),
    check('formatWindow is empty without a window', formatWindow(undefined), ''),
  ];
}
