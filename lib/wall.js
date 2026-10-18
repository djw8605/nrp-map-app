/*
 * Pure helpers for the /wall page: scene layout, arc geometry, label placement,
 * the spotlight list and the on-screen copy. No DOM and no React, so they are
 * checked by lib/wall.checks.js (node scripts/run-wall-checks.mjs).
 *
 * Positions are in "world" units: the pixels of the outline's 975×610 frame
 * (lib/albersUsa.js). fitBox() turns them into screen pixels.
 *
 * Imports carry explicit .js extensions so plain node can load this file.
 */
import { albersUsa } from './albersUsa.js';

const projection = albersUsa();

// Width of the column added beside the map for places outside the 50 states.
export const MARGIN_WIDTH = 180;
const PAD = 16;
// Room above the outline for the labels of northern campuses.
const TOP_ROOM = 24;
const MARGIN_SPACING = 74;
export const LONG_DISTANCE_MILES = 100;
export const SPOTLIGHT_COUNT = 10;

/*
 * Matching key for one place written two ways, e.g. an en dash against a hyphen
 * in "Nebraska–Lincoln". Same idea as generate-nodes/wall-lib.js normalizeName.
 */
export function nameKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .replace(/^the /, '');
}

// Asia and the Pacific go in the left margin; everything else in the right.
export function marginSide({ lng }) {
  return lng >= 60 || lng < -100 ? 'left' : 'right';
}

const pointKey = ({ lat, lng }) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

/*
 * World positions for every place: projected if it is in the 50 states, else a
 * slot in a margin column, northernmost first, centred on the map's height.
 */
export function positionPlaces(places, bounds) {
  const positions = new Map();
  const margins = { left: [], right: [] };
  for (const place of places) {
    const key = pointKey(place);
    if (positions.has(key)) continue;
    const point = projection.project([place.lng, place.lat]);
    if (point) positions.set(key, { x: point[0], y: point[1], side: null });
    else {
      positions.set(key, null);
      margins[marginSide(place)].push({ key, lat: place.lat });
    }
  }

  const [minX, minY, maxX, maxY] = bounds;
  const middle = (minY + maxY) / 2;
  for (const side of ['left', 'right']) {
    const column = margins[side].sort((a, b) => b.lat - a.lat);
    const spacing = Math.min(MARGIN_SPACING, (maxY - minY - 2 * PAD) / Math.max(1, column.length - 1));
    const x = side === 'left' ? minX - MARGIN_WIDTH / 2 : maxX + MARGIN_WIDTH / 2;
    column.forEach(({ key }, index) => {
      positions.set(key, { x, y: middle + (index - (column.length - 1) / 2) * spacing, side });
    });
  }
  return (place) => positions.get(pointKey(place)) || null;
}

/*
 * Everything the map draws, in world units. Sites are sized by area
 * (radius ∝ √hours); arcs and particle counts by √gpu_hours.
 */
export function buildScene(wall, outline) {
  const located = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);
  const sites = (wall?.sites || []).filter((site) => located(site.lat, site.lng));
  const flows = (wall?.flows || []).filter(
    (flow) => located(flow.from_lat, flow.from_lng) && located(flow.to_lat, flow.to_lng),
  );
  const homeKey = nameKey(wall?.home?.institution);
  const places = [
    ...sites,
    ...flows.flatMap((flow) => [
      { lat: flow.from_lat, lng: flow.from_lng },
      { lat: flow.to_lat, lng: flow.to_lng },
    ]),
  ];
  const at = positionPlaces(places, outline.bounds);
  const hasLeft = places.some((place) => at(place)?.side === 'left');
  const hasRight = places.some((place) => at(place)?.side === 'right');

  const maxHosted = Math.max(1, ...sites.map((site) => site.hosted_hours));
  const sceneSites = sites.map((site) => ({
    ...site,
    ...at(site),
    r: 2.2 + 13 * Math.sqrt(site.hosted_hours / maxHosted),
    isHome: nameKey(site.name) === homeKey,
  }));

  // User campuses that host nothing still need a dot where their arcs start.
  const siteKeys = new Set(sites.map(pointKey));
  const origins = new Map();
  for (const flow of flows) {
    const place = { lat: flow.from_lat, lng: flow.from_lng };
    const key = pointKey(place);
    if (!siteKeys.has(key) && !origins.has(key)) {
      origins.set(key, { name: flow.from, ...at(place), isHome: nameKey(flow.from) === homeKey });
    }
  }

  const maxFlow = Math.max(1, ...flows.map((flow) => flow.gpu_hours));
  const sceneFlows = flows.map((flow, index) => {
    const from = at({ lat: flow.from_lat, lng: flow.from_lng });
    const to = at({ lat: flow.to_lat, lng: flow.to_lng });
    const a = [from.x, from.y];
    const b = [to.x, to.y];
    const c = arcControl(a, b);
    return {
      ...flow,
      index,
      a,
      b,
      c,
      length: arcLength(a, c, b),
      width: 0.5 + 2.6 * Math.sqrt(flow.gpu_hours / maxFlow),
      particles: particleCount(flow.gpu_hours),
    };
  });

  const homeSite = sceneSites.find((site) => site.isHome);
  const homeOrigin = [...origins.values()].find((origin) => origin.isHome);
  return {
    box: worldBox(outline.bounds, { left: hasLeft, right: hasRight }),
    sites: sceneSites,
    origins: [...origins.values()],
    flows: sceneFlows,
    home: homeSite || homeOrigin || null,
  };
}

export function worldBox(bounds, { left = false, right = false } = {}) {
  const x = bounds[0] - PAD - (left ? MARGIN_WIDTH : 0);
  const y = bounds[1] - PAD - TOP_ROOM;
  return {
    x,
    y,
    width: bounds[2] + PAD + (right ? MARGIN_WIDTH : 0) - x,
    height: bounds[3] + PAD - y,
  };
}

// The same transform as SVG's viewBox with preserveAspectRatio="xMidYMid meet".
export function fitBox(box, width, height) {
  const scale = Math.min(width / box.width, height / box.height);
  return {
    scale,
    offsetX: (width - box.width * scale) / 2 - box.x * scale,
    offsetY: (height - box.height * scale) / 2 - box.y * scale,
  };
}

export const toScreen = ([x, y], fit) => [fit.offsetX + x * fit.scale, fit.offsetY + y * fit.scale];

/*
 * A quadratic arc bowing to the left of travel (north for a west-to-east flow),
 * so A→B and B→A draw as two separate arcs.
 */
export function arcControl(a, b, bend = 0.22) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return [(a[0] + b[0]) / 2 + dy * bend, (a[1] + b[1]) / 2 - dx * bend];
}

export function pointOnArc(a, c, b, t) {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
  ];
}

export function arcLength(a, c, b, steps = 24) {
  let length = 0;
  let previous = a;
  for (let i = 1; i <= steps; i++) {
    const point = pointOnArc(a, c, b, i / steps);
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    previous = point;
  }
  return length;
}

export function particleCount(gpuHours) {
  return Math.max(1, Math.min(16, Math.round(Math.sqrt(gpuHours) / 2.5)));
}

/*
 * Places labels in priority order, each at the first of its candidate spots
 * (around its dot) that stays inside `area` and overlaps no earlier label and no
 * obstacle (other dots). Labels with no free spot are dropped. Screen pixels.
 *
 * candidates: { key, x, y, r, width, height, spots? }
 * returns:    { key, x, y, width, height, spot } boxes, top-left corner.
 */
export function placeLabels(candidates, { obstacles = [], area, gap = 6 }) {
  const placed = [];
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const inside = (box) =>
    box.x >= area.x && box.y >= area.y && box.x + box.width <= area.x + area.width &&
    box.y + box.height <= area.y + area.height;

  for (const label of candidates) {
    const { x, y, r, width, height } = label;
    const spots = {
      right: { x: x + r + gap, y: y - height / 2 },
      left: { x: x - r - gap - width, y: y - height / 2 },
      above: { x: x - width / 2, y: y - r - gap - height },
      below: { x: x - width / 2, y: y + r + gap },
    };
    for (const spot of label.spots || ['right', 'left', 'above', 'below']) {
      const box = { ...spots[spot], width, height };
      const blocked = !inside(box) ||
        placed.some((other) => overlaps(box, other)) ||
        obstacles.some((obstacle) => obstacle.key !== label.key && overlaps(box, obstacle));
      if (!blocked) {
        placed.push({ key: label.key, spot, ...box });
        break;
      }
    }
  }
  return placed;
}

// The long-distance flows the spotlight line rotates through, largest first.
export function spotlightFlows(flows, { minMiles = LONG_DISTANCE_MILES, count = SPOTLIGHT_COUNT } = {}) {
  return (flows || [])
    .filter((flow) => flow.miles >= minMiles)
    .sort((a, b) => b.gpu_hours - a.gpu_hours)
    .slice(0, count);
}

// Shorter names for map labels only; the spotlight line uses full names.
export function shortName(name) {
  return (name || '')
    .replace(/^University of California,?\s+/, 'UC ')
    .replace(/^California State University,?\s+/, 'Cal State ')
    .replace(/^The\s+/, '');
}

// Two lines for a long label, split at the space nearest the middle.
export function wrapLabel(text, maxLength = 26) {
  if (text.length <= maxLength) return [text];
  const middle = text.length / 2;
  let split = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (split < 0 || Math.abs(i - middle) < Math.abs(split - middle))) split = i;
  }
  return split < 0 ? [text] : [text.slice(0, split), text.slice(split + 1)];
}

/* On-screen copy. Plain words, US formatting, no em dashes. */

const whole = (value) => Math.round(value).toLocaleString('en-US');
const trimZero = (text) => text.replace(/\.0$/, '');

export function formatDay(day) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatHours(hours) {
  return hours >= 10 ? whole(hours) : trimZero(hours.toFixed(1));
}

// "2.6 years", "14 years", or "7 months" for less than a year.
export function formatYears(years) {
  if (years >= 10) return `${whole(years)} years`;
  if (years >= 1) {
    const text = trimZero(years.toFixed(1));
    return `${text} ${text === '1' ? 'year' : 'years'}`;
  }
  const months = Math.max(1, Math.round(years * 12));
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export function formatPercent(share) {
  return `${Math.round(share * 100)}%`;
}

// "4.6 billion", "820 million", "12,400".
export function formatLarge(value) {
  if (value >= 1e9) return `${trimZero((value / 1e9).toFixed(1))} billion`;
  if (value >= 1e6) return `${trimZero((value / 1e6).toFixed(1))} million`;
  return whole(value);
}

// Two significant figures, for "roughly" numbers: 38,648 → "39,000".
export function formatRoughly(value) {
  if (value < 100) return whole(value);
  const step = 10 ** (Math.floor(Math.log10(value)) - 1);
  return whole(Math.round(value / step) * step);
}

export function formatMiles(miles) {
  return whole(miles >= 100 ? Math.round(miles / 10) * 10 : miles);
}

export function spotlightSentence(flow) {
  const hours = formatHours(flow.gpu_hours);
  return `Researchers at ${flow.from} are running work on GPUs at ${flow.to}, ` +
    `${formatMiles(flow.miles)} miles away: ${hours} GPU ${hours === '1' ? 'hour' : 'hours'} in one day.`;
}
