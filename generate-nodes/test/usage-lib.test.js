const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../usage-lib');

const ror = (id, loc) => ({ id, names: [], locations: [{ geonames_details: loc }] });
const NEBRASKA = ror('https://ror.org/043mer456', {
  country_code: 'US', country_name: 'United States',
  country_subdivision_code: 'NE', country_subdivision_name: 'Nebraska',
  lat: 40.8, lng: -96.66696,
});
const GUAM = ror('https://ror.org/00376bg92', {
  country_code: 'GU', country_name: 'Guam', lat: 13.47, lng: 144.75,
});
const SEOUL = ror('https://ror.org/01wjejq96', {
  country_code: 'KR', country_name: 'South Korea',
  country_subdivision_code: '11', country_subdivision_name: 'Seoul', lat: 37.56, lng: 126.93,
});

test('usageWindow covers three years ending on the latest data date', () => {
  assert.deepEqual(lib.usageWindow('2026-09-28'), { start: '2023-09-29', end: '2026-09-28' });
  assert.deepEqual(lib.usageWindow('2026-12-31'), { start: '2024-01-01', end: '2026-12-31' });
  assert.throws(() => lib.usageWindow('not-a-date'), /Invalid latest_data_date/);
});

test('cleanInstitutionName drops allocation suffixes and whitespace', () => {
  assert.equal(lib.cleanInstitutionName('Purdue University / 0018259'), 'Purdue University');
  assert.equal(lib.cleanInstitutionName('  Clemson University  '), 'Clemson University');
  assert.equal(lib.cleanInstitutionName('University of California, Santa Cruz'), 'University of California, Santa Cruz');
});

test('pivotUsage maps resources, sums unattributed rows and drops zero-usage institutions', () => {
  const { byInstitution, unattributed } = lib.pivotUsage([
    { institution: 'A', resource: 'cpu', usage: 10 },
    { institution: 'A', resource: 'gpu', usage: 2 },
    { institution: 'A', resource: 'memory', usage: 999 },
    { institution: 'B', resource: 'llm', usage: 0 },
    { institution: 'Unknown', resource: 'cpu', usage: 5 },
    { institution: '', resource: 'llm', usage: 7 },
  ]);
  assert.deepEqual(byInstitution, { A: { cpu_core_hours: 10, gpu_hours: 2, llm_tokens: 0 } });
  assert.deepEqual(unattributed, { cpu_core_hours: 5, gpu_hours: 0, llm_tokens: 7 });
});

test('checkRowLimit rejects a result that reached the limit', () => {
  assert.doesNotThrow(() => lib.checkRowLimit({ row_count: 394, limit: 5000 }));
  assert.throws(() => lib.checkRowLimit({ row_count: 5000, limit: 5000 }), /truncated/);
  assert.throws(() => lib.checkRowLimit({ rows: [] }), /row_count or limit/);
});

test('regionFromRorOrganization keys US states by postal code and everything else by country', () => {
  assert.deepEqual(lib.regionFromRorOrganization(NEBRASKA), {
    ror: 'https://ror.org/043mer456', lat: 40.8, lng: -96.66696, region: 'US-NE', regionName: 'Nebraska',
  });
  assert.equal(lib.regionFromRorOrganization(GUAM).region, 'GU');
  assert.equal(lib.regionFromRorOrganization(SEOUL).region, 'KR');
  assert.equal(lib.regionFromRorOrganization(SEOUL).regionName, 'South Korea');
  assert.equal(lib.regionFromRorOrganization({ locations: [] }), null);
  assert.equal(
    lib.regionFromRorOrganization(ror('x', { country_code: 'US', country_name: 'United States' })),
    null,
  );
});

test('pickRorMatch prefers the chosen item, then an exact name, else null', () => {
  const named = (value) => ({ id: value, names: [{ value }] });
  assert.equal(
    lib.pickRorMatch([{ chosen: false, organization: named('X') }, { chosen: true, organization: named('Y') }], 'X').id,
    'Y',
  );
  assert.equal(lib.pickRorMatch([{ chosen: false, organization: named('Grinnell College') }], 'grinnell college').id, 'Grinnell College');
  assert.equal(lib.pickRorMatch([{ chosen: false, organization: named('Other') }], 'Grinnell College'), null);
  assert.equal(lib.pickRorMatch(undefined, 'Anything'), null);
});

test('resolveInstitutions applies override, then cache (ror only), then ROR', async () => {
  const overrides = { CENIC: { region: 'US-CA', regionName: 'California', lat: 33.9, lng: -118.0, ror: null } };
  const previous = {
    regions: { 'US-NE': { name: 'Nebraska' }, 'US-TX': { name: 'Texas' } },
    institutions: {
      'University of Nebraska–Lincoln': { ror: 'https://ror.org/043mer456', region: 'US-NE', lat: 40.8, lng: -96.7, match: 'ror' },
      // A previous override must not be reused once it is gone from the overrides file.
      'Old Network': { ror: null, region: 'US-TX', lat: 30, lng: -97, match: 'override' },
      // An override beats a cached ROR match.
      CENIC: { ror: 'https://ror.org/wrong', region: 'US-NV', lat: 0, lng: 0, match: 'ror' },
    },
  };
  const looked = [];
  const lookupRor = async (name) => {
    looked.push(name);
    if (name === 'Purdue University') return ror('https://ror.org/02dqehb95', {
      country_code: 'US', country_subdivision_code: 'IN', country_subdivision_name: 'Indiana', lat: 40.4, lng: -86.9,
    });
    if (name === 'Flaky') throw new Error('ROR down');
    return null;
  };
  const errors = [];
  const resolved = await lib.resolveInstitutions(
    ['CENIC', 'University of Nebraska–Lincoln', 'Old Network', 'Purdue University / 0018259', 'Flaky', 'Nowhere'],
    { overrides, previous, lookupRor, onLookupError: (name) => errors.push(name) },
  );

  assert.equal(resolved.CENIC.region, 'US-CA');
  assert.equal(resolved.CENIC.match, 'override');
  assert.equal(resolved['University of Nebraska–Lincoln'].regionName, 'Nebraska');
  assert.equal(resolved['University of Nebraska–Lincoln'].match, 'ror');
  assert.equal(resolved['Purdue University / 0018259'].region, 'US-IN');
  assert.equal(resolved['Old Network'], null);
  assert.equal(resolved.Flaky, null);
  assert.equal(resolved.Nowhere, null);
  assert.deepEqual(looked.sort(), ['Flaky', 'Nowhere', 'Old Network', 'Purdue University']);
  assert.deepEqual(errors, ['Flaky']);
});

test('buildUsageDocument rolls institutions into sorted regions and lists the unmapped', () => {
  const usage = (cpu, gpu = 0, llm = 0) => ({ cpu_core_hours: cpu, gpu_hours: gpu, llm_tokens: llm });
  const doc = lib.buildUsageDocument({
    window: { start: '2023-09-29', end: '2026-09-28' },
    generatedAt: '2026-09-29T06:00:00.000Z',
    unattributed: usage(1),
    usageByInstitution: {
      'Wayne State College': usage(1, 1),
      'University of Nebraska–Lincoln': usage(10, 2, 3),
      'Yonsei University': usage(4),
      'Mystery Lab': usage(5),
    },
    resolved: {
      'Wayne State College': { ror: 'r1', region: 'US-NE', regionName: 'Nebraska', lat: 42.2, lng: -97.0, match: 'ror' },
      'University of Nebraska–Lincoln': { ror: 'r2', region: 'US-NE', regionName: 'Nebraska', lat: 40.8, lng: -96.7, match: 'ror' },
      'Yonsei University': { ror: 'r3', region: 'KR', regionName: 'South Korea', lat: 37.5, lng: 126.9, match: 'ror' },
      'Mystery Lab': null,
    },
  });

  assert.equal(doc.version, 1);
  assert.equal(doc.generated_at, '2026-09-29T06:00:00.000Z');
  assert.deepEqual(Object.keys(doc.regions), ['KR', 'US-NE']);
  assert.deepEqual(doc.regions['US-NE'], {
    name: 'Nebraska',
    institutions: ['University of Nebraska–Lincoln', 'Wayne State College'],
    totals: usage(11, 3, 3),
  });
  assert.deepEqual(doc.institutions['Yonsei University'], {
    ror: 'r3', region: 'KR', lat: 37.5, lng: 126.9, match: 'ror', usage: usage(4),
  });
  assert.equal(doc.institutions['Mystery Lab'], undefined);
  assert.deepEqual(doc.unmapped, [{ name: 'Mystery Lab', usage: usage(5) }]);
  assert.deepEqual(doc.unattributed, usage(1));
});
