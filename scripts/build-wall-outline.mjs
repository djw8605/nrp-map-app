/*
 * Builds public/geo/us-outline.json, the map under the /wall page: the 50 states
 * and DC in Albers USA (lib/albersUsa.js), as SVG path data in its 975×610 frame.
 * Run once and commit the output; rerun only if the source or the projection
 * changes:
 *
 *   node scripts/build-wall-outline.mjs
 *
 * Source: us-atlas states-10m.json, read from the pinned package tarball on the
 * npm registry. The five territories are dropped (the page puts places outside
 * the 50 states in its margins). Each arc is projected with its state's inset,
 * simplified, and written once:
 *   - land:    every state as one filled path (fill-rule evenodd)
 *   - coast:   arcs used by one state, the outer edge
 *   - borders: arcs shared by two states
 *   - bounds:  [minX, minY, maxX, maxY] of everything drawn (the Aleutians
 *              reach a little left of the frame)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { FRAME, albersUsa } from '../lib/albersUsa.js';

const US_ATLAS = 'https://registry.npmjs.org/us-atlas/-/us-atlas-3.0.1.tgz';
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'geo', 'us-outline.json');
// Douglas-Peucker tolerance and the smallest ring kept, in frame pixels.
const TOLERANCE = 0.35;
const MIN_RING_AREA = 1.5;
const TERRITORIES = new Set(['60', '66', '69', '72', '78']);
const PART_BY_FIPS = { '02': 'alaska', '15': 'hawaii' };

// One file out of a .tgz: 512-byte ustar headers, each followed by its data.
function readTarFile(tar, wanted) {
  const field = (header, start, length) => header.toString('utf8', start, start + length).replace(/\0.*$/s, '');
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = field(header, 0, 100);
    if (!name) break;
    const prefix = field(header, 345, 155);
    const size = parseInt(field(header, 124, 12).trim() || '0', 8);
    const start = offset + 512;
    if ((prefix ? `${prefix}/${name}` : name) === wanted) return tar.subarray(start, start + size).toString('utf8');
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} not found in ${US_ATLAS}`);
}

// Undo TopoJSON's quantised delta encoding of the arcs.
function decodeArcs({ transform, arcs }) {
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

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const distance = length === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const ringArea = (points) => Math.abs(points.reduce((sum, [x, y], i) => {
  const [nx, ny] = points[(i + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

// Relative path data at 0.1 px, deltas taken from rounded points so it cannot
// drift. An arc that rounds to a single point draws nothing and is left out.
const tenth = (value) => Math.round(value * 10);
const number = (tenths) => (tenths / 10).toString().replace(/^(-?)0\./, '$1.');
function pathData(points, close) {
  const rounded = points.map(([x, y]) => [tenth(x), tenth(y)]);
  const steps = [];
  for (let i = 1; i < rounded.length; i++) {
    const dx = rounded[i][0] - rounded[i - 1][0];
    const dy = rounded[i][1] - rounded[i - 1][1];
    if (dx || dy) steps.push(`${number(dx)},${number(dy)}`);
  }
  if (steps.length === 0) return '';
  return `M${number(rounded[0][0])},${number(rounded[0][1])}l${steps.join(' ')}${close ? 'z' : ''}`;
}

const response = await fetch(US_ATLAS);
if (!response.ok) throw new Error(`${US_ATLAS}: ${response.status}`);
const topology = JSON.parse(readTarFile(gunzipSync(Buffer.from(await response.arrayBuffer())), 'package/states-10m.json'));
const projection = albersUsa();
const sourceArcs = decodeArcs(topology);

// Each kept ring as a list of signed arc indexes, and each arc's inset.
const rings = [];
const arcPart = new Map();
for (const geometry of topology.objects.states.geometries) {
  if (TERRITORIES.has(geometry.id)) continue;
  const part = PART_BY_FIPS[geometry.id] || 'lower48';
  const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.type === 'MultiPolygon' ? geometry.arcs : [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const index of ring) arcPart.set(index < 0 ? ~index : index, part);
      rings.push({ state: geometry.id, arcs: ring });
    }
  }
}

const projectedArcs = new Map();
for (const [index, part] of arcPart) {
  projectedArcs.set(index, simplify(sourceArcs[index].map(projection[part]), TOLERANCE));
}

const ringPoints = (arcs) => {
  const points = [];
  for (const index of arcs) {
    const arc = index < 0 ? projectedArcs.get(~index).slice().reverse() : projectedArcs.get(index);
    // Consecutive arcs share an endpoint.
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
};

// Tiny islands are dropped, and so are arcs used only by them.
const land = [];
const arcStates = new Map();
for (const ring of rings) {
  const points = ringPoints(ring.arcs);
  if (points.length < 4 || ringArea(points) < MIN_RING_AREA) continue;
  land.push(pathData(points, true));
  for (const index of ring.arcs) {
    const key = index < 0 ? ~index : index;
    if (!arcStates.has(key)) arcStates.set(key, new Set());
    arcStates.get(key).add(ring.state);
  }
}

const coast = [];
const borders = [];
const bounds = [Infinity, Infinity, -Infinity, -Infinity];
for (const [index, states] of arcStates) {
  const points = projectedArcs.get(index);
  const data = pathData(points, false);
  if (data) (states.size > 1 ? borders : coast).push(data);
  for (const [x, y] of points) {
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }
}

const body = JSON.stringify({
  width: FRAME.width,
  height: FRAME.height,
  bounds: bounds.map((value) => Math.round(value * 10) / 10),
  land: land.join(''),
  coast: coast.join(''),
  borders: borders.join(''),
});
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, body);
console.log(
  `Wrote ${land.length} rings, ${coast.length} coast and ${borders.length} border arcs, ` +
  `${(body.length / 1024).toFixed(0)} KB, to ${OUTPUT}`,
);
