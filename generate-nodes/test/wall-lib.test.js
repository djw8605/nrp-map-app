const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../wall-lib');

const LINCOLN = { lat: 40.8, lng: -96.66696 };
const SAN_DIEGO = { lat: 32.71571, lng: -117.16472 };
const STANFORD = { lat: 37.42411, lng: -122.16608 };
const UNL = 'University of Nebraska–Lincoln';
const UCSD_HOST = 'University of California, San Diego';
const UCSD_USER = 'University of California San Diego';

test('normalizeName matches one place written several ways', () => {
  assert.equal(lib.normalizeName('University of Nebraska–Lincoln'), 'university of nebraska-lincoln');
  assert.equal(lib.normalizeName('University of Nebraska - Lincoln'), 'university of nebraska-lincoln');
  assert.equal(lib.normalizeName(UCSD_HOST), lib.normalizeName(UCSD_USER));
  assert.equal(lib.normalizeName('The Ohio State University'), 'ohio state university');
  assert.equal(
    lib.normalizeName('Korea Institute of Science & Technology Information'),
    'korea institute of science and technology information',
  );
  assert.equal(lib.normalizeName('  Université de Montréal '), 'universite de montreal');
  assert.equal(lib.normalizeName(null), '');
});

test('milesBetween is great-circle miles', () => {
  assert.equal(Math.round(lib.milesBetween(LINCOLN, SAN_DIEGO)), 1260);
  assert.equal(Math.round(lib.milesBetween(STANFORD, LINCOLN)), 1382);
  assert.equal(lib.milesBetween(LINCOLN, LINCOLN), 0);
});

test('collectPairs cleans user names, merges pairs and keeps unattributed sides as null', () => {
  const { pairs, gpuHours } = lib.collectPairs([
    { institution: 'Purdue University / 0018259', node_institution: UNL, usage: 2 },
    { institution: 'Purdue University', node_institution: ` ${UNL} `, usage: 3 },
    { institution: 'Unknown', node_institution: UNL, usage: 4 },
    { institution: 'Purdue University', node_institution: '', usage: 1 },
    { institution: 'Purdue University', node_institution: UNL, usage: 0 },
    { institution: 'Purdue University', node_institution: UNL, usage: 'not a number' },
  ]);
  assert.equal(gpuHours, 10);
  assert.deepEqual(pairs, [
    { user: 'Purdue University', host: UNL, hours: 5 },
    { user: null, host: UNL, hours: 4 },
    { user: 'Purdue University', host: null, hours: 1 },
  ]);
});

test('sumTokens adds tokens_used across models', () => {
  assert.equal(lib.sumTokens([{ model: 'a', tokens_used: 1.5 }, { model: 'b', tokens_used: 2 }, { model: 'c' }]), 3.5);
  assert.equal(lib.sumTokens([]), 0);
});

test('netboxPlacement uses an unambiguous name match only', () => {
  const sites = [
    { name: 'Florida Agricultural and Mechanical Univerity', siteName: 'FAMU', latitude: 30.4256, longitude: -84.2851 },
    { name: UCSD_HOST, siteName: 'SDSC', latitude: 32.8842, longitude: -117.2392 },
    { name: UCSD_HOST, siteName: 'UCSD Geisel', latitude: 32.8812, longitude: -117.2376 },
    { name: 'Internet2', siteName: 'I2 Chicago', latitude: 41.8781, longitude: -87.6298 },
    { name: 'Internet2', siteName: 'I2 Kansas City', latitude: 39.0997, longitude: -94.5786 },
    { name: 'Missing Coordinates', siteName: 'MC', latitude: null, longitude: null },
  ];
  assert.deepEqual(lib.netboxPlacement('Florida Agricultural and Mechanical Univerity', sites), {
    lat: 30.4256, lng: -84.2851, match: 'netbox',
  });
  assert.deepEqual(lib.netboxPlacement('FAMU', sites), { lat: 30.4256, lng: -84.2851, match: 'netbox' });
  // Two sites on one campus: their mean point.
  assert.deepEqual(lib.netboxPlacement('University of California San Diego', sites), {
    lat: 32.8827, lng: -117.2384, match: 'netbox',
  });
  // Sites hundreds of miles apart: ambiguous.
  assert.equal(lib.netboxPlacement('Internet2', sites), null);
  assert.equal(lib.netboxPlacement('Missing Coordinates', sites), null);
  assert.equal(lib.netboxPlacement('Nowhere', sites), null);
  assert.equal(lib.netboxPlacement('Nowhere', undefined), null);
});

test('placeFromRorOrganization labels US places by state and others by country', () => {
  const org = (details) => ({ locations: [{ geonames_details: details }] });
  assert.equal(
    lib.placeFromRorOrganization(org({ name: 'Lincoln', country_code: 'US', country_subdivision_code: 'NE' })),
    'Lincoln, NE',
  );
  assert.equal(
    lib.placeFromRorOrganization(org({ name: 'Daejeon', country_code: 'KR', country_name: 'South Korea' })),
    'Daejeon, South Korea',
  );
  assert.equal(lib.placeFromRorOrganization(org({ name: 'Somewhere', country_code: 'US' })), 'Somewhere');
  assert.equal(lib.placeFromRorOrganization(org({ country_code: 'US' })), null);
  assert.equal(lib.placeFromRorOrganization(null), null);
});

function fixture(home, month = null) {
  const { pairs, gpuHours } = lib.collectPairs([
    // The same campus under two names, at one point: local.
    { institution: UCSD_USER, node_institution: UCSD_HOST, usage: 100 },
    { institution: 'Stanford University', node_institution: UNL, usage: 30 },
    { institution: 'Stanford University', node_institution: UCSD_HOST, usage: 50 },
    { institution: UNL, node_institution: UCSD_HOST, usage: 20 },
    // Home under another spelling: local by name, and not "another institution".
    { institution: 'University of Nebraska-Lincoln / 0012345', node_institution: UNL, usage: 40 },
    // Another institution two miles from home: local.
    { institution: 'Nebraska Wesleyan University', node_institution: UNL, usage: 5 },
    // Unplaced user at home: counted as served, listed as unmapped.
    { institution: 'Mystery Lab', node_institution: UNL, usage: 8 },
    { institution: 'Unknown', node_institution: UNL, usage: 7 },
    { institution: 'Stanford University', node_institution: 'Ghost Host', usage: 4 },
    { institution: 'Stanford University', node_institution: '', usage: 3 },
    { institution: 'Yonsei University', node_institution: UCSD_HOST, usage: 0 },
  ]);
  return lib.buildWallDocument({
    day: '2026-10-17',
    generatedAt: '2026-10-18T06:00:00.000Z',
    pairs,
    gpuHours,
    llmTokens: 240000.4,
    locations: {
      [UCSD_USER]: SAN_DIEGO,
      [UCSD_HOST]: SAN_DIEGO,
      [UNL]: LINCOLN,
      'University of Nebraska-Lincoln': LINCOLN,
      'Stanford University': STANFORD,
      'Nebraska Wesleyan University': { lat: 40.8384, lng: -96.6503 },
      'Mystery Lab': null,
      'Ghost Host': null,
    },
    places: { [UCSD_HOST]: 'San Diego, CA' },
    home,
    month,
  });
}

// The day's pairs, with more of each, as the 30 days ending on it.
function monthOf(day) {
  const { pairs, gpuHours } = lib.collectPairs([
    { institution: UCSD_USER, node_institution: UCSD_HOST, usage: 3000 },
    { institution: 'Stanford University', node_institution: UNL, usage: 900 },
    { institution: 'Stanford University', node_institution: UCSD_HOST, usage: 1500 },
    { institution: UNL, node_institution: UCSD_HOST, usage: 600 },
    { institution: 'Nebraska Wesleyan University', node_institution: UNL, usage: 150 },
    { institution: 'Mystery Lab', node_institution: UNL, usage: 240 },
  ]);
  return { start: lib.windowStart(day), end: day, pairs, gpuHours, llmTokens: 7200000 };
}

test('buildWallDocument separates flows from local work and counts both in the totals', () => {
  const doc = fixture();

  assert.equal(doc.day, '2026-10-17');
  assert.equal(doc.generated_at, '2026-10-18T06:00:00.000Z');
  assert.deepEqual(doc.totals, {
    gpu_hours: 267,
    gpu_years: 0.03,
    // 100 of the 245 hours with both sides placed crossed campuses.
    away_share: 0.4082,
    host_sites: 3,
    user_institutions: 5,
    llm_tokens: 240000,
    llm_novels: 2,
  });
  assert.deepEqual(doc.sites, [
    { name: UCSD_HOST, place: 'San Diego, CA', lat: SAN_DIEGO.lat, lng: SAN_DIEGO.lng, hosted_hours: 170 },
    { name: UNL, place: null, lat: LINCOLN.lat, lng: LINCOLN.lng, hosted_hours: 90 },
  ]);
  assert.deepEqual(doc.flows, [
    {
      from: 'Stanford University', to: UCSD_HOST, gpu_hours: 50, miles: 431,
      from_lat: STANFORD.lat, from_lng: STANFORD.lng, to_lat: SAN_DIEGO.lat, to_lng: SAN_DIEGO.lng,
    },
    {
      from: 'Stanford University', to: UNL, gpu_hours: 30, miles: 1382,
      from_lat: STANFORD.lat, from_lng: STANFORD.lng, to_lat: LINCOLN.lat, to_lng: LINCOLN.lng,
    },
    {
      from: UNL, to: UCSD_HOST, gpu_hours: 20, miles: 1260,
      from_lat: LINCOLN.lat, from_lng: LINCOLN.lng, to_lat: SAN_DIEGO.lat, to_lng: SAN_DIEGO.lng,
    },
  ]);
  assert.deepEqual(doc.unmapped, [
    { name: 'Mystery Lab', side: 'user', gpu_hours: 8 },
    { name: 'Ghost Host', side: 'host', gpu_hours: 4 },
  ]);
});

test('buildWallDocument counts home work done for other institutions', () => {
  assert.deepEqual(fixture().home, { institution: UNL, served_hours: 38, partner_count: 2 });
  assert.deepEqual(fixture(UCSD_HOST).home, { institution: UCSD_HOST, served_hours: 70, partner_count: 2 });
  assert.deepEqual(fixture('Nowhere University').home, {
    institution: 'Nowhere University', served_hours: 0, partner_count: 0,
  });
});

test('publishProblem refuses an empty day or a map without flows', () => {
  const doc = fixture();
  assert.equal(lib.publishProblem(doc), null);
  assert.equal(lib.publishProblem({ ...doc, totals: { ...doc.totals, gpu_hours: 0 } }), 'Total GPU hours is 0');
  assert.equal(lib.publishProblem({ ...doc, flows: [] }), 'No mapped flows');
  assert.equal(lib.publishProblem(null), 'Total GPU hours is 0');
});

test('windowStart is the first of the 30 days ending on the day', () => {
  assert.equal(lib.windowStart('2026-10-17'), '2026-09-18');
  assert.equal(lib.windowStart('2026-01-10'), '2025-12-12');
  assert.equal(lib.windowStart('2026-10-17', 1), '2026-10-17');
});

test('institutionFigures matches the home figures for any institution', () => {
  const { pairs } = lib.collectPairs([
    { institution: 'Stanford University', node_institution: UNL, usage: 30 },
    { institution: 'Mystery Lab', node_institution: UNL, usage: 8 },
    { institution: 'Nebraska Wesleyan University', node_institution: UNL, usage: 5 },
    { institution: 'University of Nebraska-Lincoln', node_institution: UNL, usage: 40 },
    { institution: 'Unknown', node_institution: UNL, usage: 7 },
  ]);
  const locations = {
    [UNL]: LINCOLN,
    'University of Nebraska-Lincoln': LINCOLN,
    'Stanford University': STANFORD,
    'Nebraska Wesleyan University': { lat: 40.8384, lng: -96.6503 },
    'Mystery Lab': null,
  };
  assert.deepEqual(lib.institutionFigures(pairs, locations, UNL), {
    hosted: true,
    figures: { served_hours: 38, served_partners: 2, away_hours: 0, away_hosts: 0 },
  });
});

test('buildWallDocument adds the month totals and figures for every dot', () => {
  const doc = fixture(undefined, monthOf('2026-10-17'));

  assert.deepEqual(doc.month, {
    start: '2026-09-18',
    end: '2026-10-17',
    totals: {
      gpu_hours: 6390,
      gpu_years: 0.729,
      // 3000 of the 6150 placed hours crossed campuses.
      away_share: 0.4878,
      host_sites: 2,
      user_institutions: 5,
      llm_tokens: 7200000,
      llm_novels: 60,
    },
  });
  // The day's figures for home are the `home` block's.
  assert.equal(doc.institutions[UNL].day.served_hours, doc.home.served_hours);
  assert.equal(doc.institutions[UNL].day.served_partners, doc.home.partner_count);
  assert.deepEqual(Object.keys(doc.institutions), ['Stanford University', UCSD_HOST, UNL]);
  assert.deepEqual(doc.institutions[UNL], {
    hosts: true,
    day: { served_hours: 38, served_partners: 2, away_hours: 20, away_hosts: 1 },
    month: { served_hours: 1140, served_partners: 2, away_hours: 600, away_hosts: 1 },
  });
  // One campus under two names is not its own partner or host.
  assert.deepEqual(doc.institutions[UCSD_HOST], {
    hosts: true,
    day: { served_hours: 70, served_partners: 2, away_hours: 0, away_hosts: 0 },
    month: { served_hours: 2100, served_partners: 2, away_hours: 0, away_hosts: 0 },
  });
  // Hosts nothing: only its work elsewhere, an unplaced host included.
  assert.deepEqual(doc.institutions['Stanford University'], {
    hosts: false,
    day: { served_hours: 0, served_partners: 0, away_hours: 84, away_hosts: 3 },
    month: { served_hours: 0, served_partners: 0, away_hours: 2400, away_hosts: 2 },
  });
});

test('buildWallDocument without a month is the one-day document', () => {
  const doc = fixture();
  assert.equal(doc.month, undefined);
  assert.equal(doc.institutions, undefined);
});
