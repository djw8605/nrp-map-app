/*
 * Behavioural checks for lib/wall.js, in the same assertions-as-data style as
 * lib/usageRegions.checks.js (the project has no test runner). Run with:
 *
 *   node scripts/run-wall-checks.mjs
 *
 * Imports carry explicit .js extensions so plain node can load this file.
 */
import { albersUsa } from './albersUsa.js';
import {
  arcControl,
  buildScene,
  fitBox,
  formatDay,
  formatHours,
  formatLarge,
  formatMiles,
  formatPercent,
  formatRoughly,
  formatYears,
  marginSide,
  nameKey,
  particleCount,
  placeLabels,
  pointOnArc,
  shortName,
  spotlightFlows,
  spotlightSentence,
  toScreen,
  worldBox,
  wrapLabel,
} from './wall.js';

const OUTLINE = { width: 975, height: 610, bounds: [-57.6, 14.4, 957.1, 605.9] };
const LINCOLN = { lat: 40.8, lng: -96.66696 };
const SAN_DIEGO = { lat: 32.71571, lng: -117.16472 };
const STANFORD = { lat: 37.42411, lng: -122.16608 };
const DAEJEON = { lat: 36.3504, lng: 127.3845 };
const SEOUL = { lat: 37.5665, lng: 126.978 };
const PRAGUE = { lat: 50.0755, lng: 14.4378 };

const flow = (from, to, fromAt, toAt, gpuHours, miles) => ({
  from, to, gpu_hours: gpuHours, miles,
  from_lat: fromAt.lat, from_lng: fromAt.lng, to_lat: toAt.lat, to_lng: toAt.lng,
});

const WALL = {
  day: '2026-10-17',
  home: { institution: 'University of Nebraska-Lincoln', served_hours: 30, partner_count: 1 },
  sites: [
    { name: 'University of California, San Diego', place: 'San Diego, CA', ...SAN_DIEGO, hosted_hours: 400 },
    { name: 'University of Nebraska–Lincoln', place: 'Lincoln, NE', ...LINCOLN, hosted_hours: 100 },
    { name: 'Korea Institute of Science & Technology Information', place: 'Daejeon, South Korea', ...DAEJEON, hosted_hours: 25 },
    { name: 'Czech Education and Scientific Network', place: 'Prague, Czechia', ...PRAGUE, hosted_hours: 4 },
    { name: 'Nowhere', place: null, lat: null, lng: null, hosted_hours: 1 },
  ],
  flows: [
    flow('Stanford University', 'University of California, San Diego', STANFORD, SAN_DIEGO, 400, 431),
    flow('Stanford University', 'University of Nebraska–Lincoln', STANFORD, LINCOLN, 100, 1382),
    flow('Yonsei University Health System', 'University of Nebraska–Lincoln', SEOUL, LINCOLN, 25, 6290),
    flow('Stanford University', 'Korea Institute of Science & Technology Information', STANFORD, DAEJEON, 4, 5700),
    flow('University of California San Diego', 'Czech Education and Scientific Network', SAN_DIEGO, PRAGUE, 9, 50),
  ],
};

const round = (point) => point.map((value) => Math.round(value * 10) / 10);

const check = (name, actual, expected) => ({
  name,
  actual,
  expected,
  pass: JSON.stringify(actual) === JSON.stringify(expected),
});

export function runWallChecks() {
  const scene = buildScene(WALL, OUTLINE);
  const projection = albersUsa();
  const site = (name) => scene.sites.find((entry) => entry.name === name);
  const kisti = site('Korea Institute of Science & Technology Information');
  const cesnet = site('Czech Education and Scientific Network');
  const yonsei = scene.origins.find((origin) => origin.name === 'Yonsei University Health System');
  const fit = fitBox({ x: 0, y: 0, width: 100, height: 50 }, 400, 400);

  return [
    check('nameKey matches an en dash and a hyphen', nameKey('University of Nebraska–Lincoln'), nameKey('University of Nebraska - Lincoln')),
    check('marginSide sends Asia left and Europe right', [marginSide(DAEJEON), marginSide(PRAGUE), marginSide({ lat: 18.4, lng: -66.1 })], ['left', 'right', 'right']),
    check(
      'buildScene projects campuses in the 50 states',
      round([site('University of Nebraska–Lincoln').x, site('University of Nebraska–Lincoln').y]),
      round(projection.project([LINCOLN.lng, LINCOLN.lat])),
    ),
    check('buildScene puts off-map campuses in the margins', [kisti.side, cesnet.side, yonsei.side], ['left', 'right', 'left']),
    check(
      'buildScene stacks one margin northernmost first',
      [yonsei.y < kisti.y, kisti.x === yonsei.x, kisti.x < OUTLINE.bounds[0]],
      [true, true, true],
    ),
    check('buildScene adds margin columns only where needed', [scene.box.x < OUTLINE.bounds[0] - 100, scene.box.x + scene.box.width > OUTLINE.bounds[2] + 100], [true, true]),
    check('buildScene reports each margin column and its first slot', [scene.margins.left.x, scene.margins.left.top === yonsei.y, scene.margins.right.top === cesnet.y], [kisti.x, true, true]),
    check('buildScene adds no margin without off-map places', buildScene({ ...WALL, sites: WALL.sites.slice(0, 2), flows: WALL.flows.slice(0, 2) }, OUTLINE).margins, {}),
    check('buildScene drops a site with no coordinates', scene.sites.length, 4),
    check('buildScene finds home by name, whatever the dash', scene.home?.name, 'University of Nebraska–Lincoln'),
    check('buildScene sizes dots by area', [Math.round(site('University of California, San Diego').r * 10), Math.round(site('University of Nebraska–Lincoln').r * 10)], [152, 87]),
    check('buildScene gives user-only campuses an origin dot', scene.origins.map((origin) => origin.name).sort(), ['Stanford University', 'Yonsei University Health System']),
    check('buildScene scales arc width and particles with √hours', scene.flows.map((entry) => [Math.round(entry.width * 100) / 100, entry.particles]), [[3.1, 8], [1.8, 4], [1.15, 2], [0.76, 1], [0.89, 1]]),
    check('worldBox without margins hugs the outline', worldBox(OUTLINE.bounds), { x: -73.6, y: -25.6, width: 1046.7, height: 647.5 }),
    check('fitBox centres like xMidYMid meet', [fit.scale, fit.offsetX, fit.offsetY, toScreen([100, 50], fit)], [4, 0, 100, [400, 300]]),
    check('arcControl bows west-to-east arcs north and east-to-west arcs south', [arcControl([0, 0], [100, 0])[1] < 0, arcControl([100, 0], [0, 0])[1] > 0], [true, true]),
    check('pointOnArc runs from start to end', [pointOnArc([0, 0], [50, -20], [100, 0], 0), pointOnArc([0, 0], [50, -20], [100, 0], 1), pointOnArc([0, 0], [50, -20], [100, 0], 0.5)], [[0, 0], [100, 0], [50, -10]]),
    check('particleCount is at least 1 and at most 16', [0.2, 24, 400, 1e6].map(particleCount), [1, 2, 8, 16]),
    check(
      'placeLabels takes the first free spot and drops a label with none',
      placeLabels(
        [
          { key: 'a', x: 50, y: 50, r: 5, width: 40, height: 10 },
          { key: 'b', x: 60, y: 50, r: 5, width: 40, height: 10 },
          // Wider than the area: every spot falls outside it.
          { key: 'c', x: 100, y: 90, r: 2, width: 240, height: 10 },
        ],
        { area: { x: 0, y: 0, width: 200, height: 100 }, gap: 2 },
      ).map((label) => [label.key, label.spot]),
      [['a', 'right'], ['b', 'left']],
    ),
    check(
      'placeLabels slides a label under a dot near the edge back inside',
      placeLabels(
        [{ key: 'a', x: 10, y: 20, r: 3, width: 60, height: 10, spots: ['below'] }],
        { area: { x: 0, y: 0, width: 200, height: 100 }, gap: 2 },
      ).map((label) => [label.spot, label.x, label.y]),
      [['below', 0, 25]],
    ),
    check(
      'placeLabels keeps labels off other dots',
      placeLabels(
        [{ key: 'a', x: 50, y: 50, r: 5, width: 40, height: 10 }],
        { area: { x: 0, y: 0, width: 200, height: 100 }, obstacles: [{ key: 'z', x: 60, y: 40, width: 20, height: 20 }], gap: 2 },
      ).map((label) => label.spot),
      ['left'],
    ),
    check('spotlightFlows keeps 100+ miles, largest first', spotlightFlows(WALL.flows).map((entry) => entry.gpu_hours), [400, 100, 25, 4]),
    check('spotlightFlows caps the list', spotlightFlows(WALL.flows, { count: 2 }).length, 2),
    check(
      'spotlightSentence reads plainly',
      spotlightSentence(WALL.flows[1]),
      'Researchers at Stanford University are running work on GPUs at University of Nebraska–Lincoln, 1,380 miles away: 100 GPU hours in one day.',
    ),
    check('spotlightSentence says hour for one', spotlightSentence({ ...WALL.flows[1], gpu_hours: 1.04 }).endsWith('1 GPU hour in one day.'), true),
    check('shortName shortens UC and Cal State campuses only', ['University of California, San Diego', 'California State University, Fullerton', 'University of Nebraska–Lincoln'].map(shortName), ['UC San Diego', 'Cal State Fullerton', 'University of Nebraska–Lincoln']),
    check('wrapLabel splits long names near the middle', wrapLabel('Massachusetts Green High Performance Computing Center'), ['Massachusetts Green High', 'Performance Computing Center']),
    check('formatDay reads the date in UTC', formatDay('2026-10-17'), 'October 17, 2026'),
    check('formatHours rounds big numbers and keeps one decimal for small', [22507.58, 9.94, 2.0].map(formatHours), ['22,508', '9.9', '2']),
    check('formatYears', [2.569, 1.0, 14.2, 0.5, 0.01].map(formatYears), ['2.6 years', '1 year', '14 years', '6 months', '1 month']),
    check('formatPercent', [0.7123, 0, 1].map(formatPercent), ['71%', '0%', '100%']),
    check('formatLarge', [4637722063, 820000000, 1250000, 12400.4].map(formatLarge), ['4.6 billion', '820 million', '1.3 million', '12,400']),
    check('formatRoughly keeps two significant figures', [38647.7, 1234, 99.6, 7].map(formatRoughly), ['39,000', '1,200', '100', '7']),
    check('formatMiles rounds long distances to tens', [1382, 99, 2549.4].map(formatMiles), ['1,380', '99', '2,550']),
  ];
}
