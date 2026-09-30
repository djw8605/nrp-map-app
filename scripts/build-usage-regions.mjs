/*
 * Builds public/geo/usage-regions.json, the outlines the usage map fills.
 * Run once and commit the output; rerun only if the sources change:
 *
 *   node scripts/build-usage-regions.mjs
 *
 * Sources, fetched from jsDelivr:
 *   - us-atlas states-10m: US states, DC and five territories (FIPS ids)
 *   - world-atlas countries-110m: every other country (ISO numeric ids). The
 *     smallest file; very small countries (e.g. Singapore) are missing, and the
 *     map draws those as a dot instead (lib/usageRegions.js).
 *   - world-countries: ISO numeric -> alpha-2 codes and common names
 *
 * Every feature is tagged { code, name }: `US-XX` for a state, ISO alpha-2 for
 * everything else (including the territories, matching how ROR files them).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const US_ATLAS = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const WORLD_ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const COUNTRY_CODES = 'https://cdn.jsdelivr.net/npm/world-countries@5/countries.json';
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'geo', 'usage-regions.json');

const FIPS_TO_POSTAL = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
};
const FIPS_TERRITORY_TO_ISO = { '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI' };
// Drawn from us-atlas, so dropped from the world file: US, AS, GU, MP, PR, VI.
const WORLD_IDS_FROM_US_ATLAS = new Set(['840', '016', '316', '580', '630', '850']);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

// Minimal TopoJSON -> GeoJSON for Polygon/MultiPolygon: undo the quantised delta
// encoding of the arcs, then stitch each ring from its arc indexes.
function decodeArcs(topology) {
  const { transform, arcs } = topology;
  if (!transform) return arcs;
  const [kx, ky] = transform.scale;
  const [dx, dy] = transform.translate;
  return arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([px, py]) => {
      x += px;
      y += py;
      return [x * kx + dx, y * ky + dy];
    });
  });
}

const round = (value) => Math.round(value * 1000) / 1000;

// Keep longitudes continuous across the antimeridian (Mapbox fills rings as planar).
function unwrap(points) {
  for (let i = 1; i < points.length; i++) {
    while (points[i][0] - points[i - 1][0] > 180) points[i][0] -= 360;
    while (points[i][0] - points[i - 1][0] < -180) points[i][0] += 360;
  }
  // A ring around a pole (Antarctica) no longer closes on itself: close it via the pole.
  const first = points[0];
  const last = points[points.length - 1];
  if (last[0] !== first[0]) {
    const pole = first[1] < 0 ? -90 : 90;
    points.push([last[0], pole], [first[0], pole], [first[0], first[1]]);
  }
  return points;
}

function ring(arcIndexes, arcs) {
  const points = [];
  for (const index of arcIndexes) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    arc.forEach((point, i) => {
      // Consecutive arcs share an endpoint.
      if (i === 0 && points.length) return;
      points.push([round(point[0]), round(point[1])]);
    });
  }
  return unwrap(points);
}

function toGeometry(geometry, arcs) {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.arcs.map((r) => ring(r, arcs)) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.arcs.map((p) => p.map((r) => ring(r, arcs))) };
  }
  return null;
}

const feature = (code, name, geometry) => ({ type: 'Feature', properties: { code, name }, geometry });

const [us, world, countries] = await Promise.all([
  fetchJson(US_ATLAS), fetchJson(WORLD_ATLAS), fetchJson(COUNTRY_CODES),
]);

const features = [];
const usArcs = decodeArcs(us);
for (const geometry of us.objects.states.geometries) {
  const postal = FIPS_TO_POSTAL[geometry.id];
  const code = postal ? `US-${postal}` : FIPS_TERRITORY_TO_ISO[geometry.id];
  const shape = code && toGeometry(geometry, usArcs);
  if (shape) features.push(feature(code, geometry.properties.name, shape));
}

const byNumeric = new Map(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
const worldArcs = decodeArcs(world);
for (const geometry of world.objects.countries.geometries) {
  if (!geometry.id || WORLD_IDS_FROM_US_ATLAS.has(geometry.id)) continue;
  const country = byNumeric.get(geometry.id);
  const shape = toGeometry(geometry, worldArcs);
  if (!country || !shape) {
    console.warn(`Skipping world feature ${geometry.id} (${geometry.properties?.name})`);
    continue;
  }
  features.push(feature(country.cca2, country.name.common, shape));
}

const codes = features.map((f) => f.properties.code);
const duplicates = codes.filter((code, i) => codes.indexOf(code) !== i);
if (duplicates.length) throw new Error(`Duplicate region codes: ${duplicates.join(', ')}`);

const body = JSON.stringify({ type: 'FeatureCollection', features });
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, body);
console.log(`Wrote ${features.length} regions, ${(body.length / 1024).toFixed(0)} KB, to ${OUTPUT}`);
