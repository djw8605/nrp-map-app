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
export const MARGIN_WIDTH = 150;
const PAD = 16;
// Room above the outline for the labels of northern campuses.
const TOP_ROOM = 24;
// Room for a three-line label under each margin dot before the next one.
const MARGIN_SPACING = 96;
export const LONG_DISTANCE_MILES = 100;
export const SPOTLIGHT_COUNT = 10;
// A spotlight worth leading with: across much of the country, or touching home.
export const FEATURE_MILES = 800;

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

// Asia, the Pacific and anything off the map west of 100°W (western Canada and
// Mexico) go in the left margin; everything else, Europe first, in the right.
export function marginSide({ lng }) {
  return lng >= 60 || lng < -100 ? 'left' : 'right';
}

const pointKey = ({ lat, lng }) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

/*
 * World positions for every place: projected if it is in the 50 states, else a
 * slot in a margin column, northernmost first, centred on the map's height.
 * Returns the lookup, and each used margin column's x and first slot's y.
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
  const columns = {};
  for (const side of ['left', 'right']) {
    const column = margins[side].sort((a, b) => b.lat - a.lat);
    if (column.length === 0) continue;
    const spacing = Math.min(MARGIN_SPACING, (maxY - minY - 2 * PAD) / Math.max(1, column.length - 1));
    const x = side === 'left' ? minX - MARGIN_WIDTH / 2 : maxX + MARGIN_WIDTH / 2;
    const top = middle - ((column.length - 1) / 2) * spacing;
    column.forEach(({ key }, index) => positions.set(key, { x, y: top + index * spacing, side }));
    columns[side] = { x, top };
  }
  return { at: (place) => positions.get(pointKey(place)) || null, columns };
}

/*
 * Everything the map draws, in world units. Sites are sized by area
 * (radius ∝ √hours); arcs and particle counts by √gpu_hours.
 */
/*
 * `focus` is the institution drawn in amber: the home institution unless a
 * viewer picked another dot. `here` says whether it is the real home, the one
 * the screen stands in.
 */
export function buildScene(wall, outline, focus = wall?.home?.institution) {
  const located = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);
  const sites = (wall?.sites || []).filter((site) => located(site.lat, site.lng));
  const flows = (wall?.flows || []).filter(
    (flow) => located(flow.from_lat, flow.from_lng) && located(flow.to_lat, flow.to_lng),
  );
  const homeKey = nameKey(focus);
  const places = [
    ...sites,
    ...flows.flatMap((flow) => [
      { lat: flow.from_lat, lng: flow.from_lng },
      { lat: flow.to_lat, lng: flow.to_lng },
    ]),
  ];
  const { at, columns } = positionPlaces(places, outline.bounds);

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
    box: worldBox(outline.bounds, { left: Boolean(columns.left), right: Boolean(columns.right) }),
    margins: columns,
    sites: sceneSites,
    origins: [...origins.values()],
    flows: sceneFlows,
    home: homeSite || homeOrigin || null,
    here: homeKey === nameKey(wall?.home?.institution),
  };
}

// Drawn radius of a user-only campus's dot, in outline pixels.
export const ORIGIN_RADIUS = 2.2;

// Every dot a viewer can point at or pick: host campuses and arc starts.
export function scenePoints(scene) {
  return [
    ...scene.sites.map((site) => ({ name: site.name, x: site.x, y: site.y, r: site.r })),
    ...scene.origins.map((origin) => ({ name: origin.name, x: origin.x, y: origin.y, r: ORIGIN_RADIUS })),
  ];
}

/*
 * The dot under a screen point, or null: the nearest one whose drawn radius,
 * or `minRadius` CSS pixels if that is larger, reaches the point. The minimum
 * keeps small dots a finger-sized target on the touchscreen.
 */
export function hitTest(points, fit, [px, py], minRadius = 11) {
  let best = null;
  for (const point of points) {
    const [x, y] = toScreen([point.x, point.y], fit);
    const r = point.r * fit.scale;
    const distance = Math.hypot(px - x, py - y);
    if (distance <= Math.max(r, minRadius) && (!best || distance < best.distance)) {
      best = { name: point.name, x, y, r, distance };
    }
  }
  return best;
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
 * obstacle (other dots). A label above or below its dot slides sideways to stay
 * inside, so a dot near the edge keeps its label. Labels with no free spot are
 * dropped. Screen pixels.
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
    const centred = Math.min(Math.max(x - width / 2, area.x), area.x + area.width - width);
    const spots = {
      right: { x: x + r + gap, y: y - height / 2 },
      left: { x: x - r - gap - width, y: y - height / 2 },
      above: { x: centred, y: y - r - gap - height },
      below: { x: centred, y: y + r + gap },
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

/*
 * The long-distance flows the spotlight line rotates through. Flows that touch
 * home or cross much of the country lead, largest first, then the rest: a hop
 * inside California is a few millimetres of screen and says little to someone
 * standing in Lincoln.
 */
export function spotlightFlows(flows, { minMiles = LONG_DISTANCE_MILES, count = SPOTLIGHT_COUNT, home = null } = {}) {
  const homeKey = home ? nameKey(home) : null;
  const featured = (flow) =>
    Number(flow.miles >= FEATURE_MILES || (homeKey !== null && [flow.from, flow.to].some((name) => nameKey(name) === homeKey)));
  return (flows || [])
    .filter((flow) => flow.miles >= minMiles)
    .sort((a, b) => featured(b) - featured(a) || b.gpu_hours - a.gpu_hours)
    .slice(0, count);
}

/*
 * One spelling per campus: a researcher's institution written like a host
 * ("University of California San Diego" against "University of California,
 * San Diego") reads as the host's name, so the spotlight never names one
 * campus two ways.
 */
export function canonicalNames(wall) {
  const byKey = new Map((wall?.sites || []).map((site) => [nameKey(site.name), site.name]));
  return (name) => byKey.get(nameKey(name)) || name;
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

// "Oct 17": the column caption beside "Last 30 days" on the tiles.
export function formatShortDay(day) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

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

// "4.6 billion", "180 billion", "820 million", "12,400".
export function formatLarge(value) {
  if (value >= 1e9) return `${trimZero((value / 1e9).toFixed(value >= 1e11 ? 0 : 1))} billion`;
  if (value >= 1e6) return `${trimZero((value / 1e6).toFixed(1))} million`;
  return whole(value);
}

// Two significant figures, for "roughly" numbers: 38,648 → "39,000", and
// 1,498,627 → "1.5 million".
export function formatRoughly(value) {
  if (value < 100) return whole(value);
  const step = 10 ** (Math.floor(Math.log10(value)) - 1);
  const rounded = Math.round(value / step) * step;
  return rounded >= 1e6 ? formatLarge(rounded) : whole(rounded);
}

// "1 campus", "30 campuses".
export const countOf = (value, one, many) => `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

// "the " before "University of Missouri", nothing before "Stanford University".
export function articleFor(name) {
  return /^University of /.test(name || '') ? 'the ' : '';
}

// "the University of Missouri", but "Stanford University": for "Here at …".
export function hereAt(name) {
  return `${articleFor(name)}${name || ''}`;
}

/*
 * How far a day's total had got by this time of day, at that day's average
 * pace: the accounting data has one row per day, so the replay is linear.
 */
export function paceValue(total, date) {
  const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  return Math.floor((total * seconds) / 86400);
}

// "3:40 PM".
export function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/*
 * The amber tile for the institution in focus: its work for others if it hosts
 * GPUs, else its researchers' work on other campuses' GPUs. `month` is null with
 * a wall.json from before the 30-day figures; the home block stands in then.
 */
export function focusTile(wall, focus) {
  const entry = wall?.institutions?.[focus];
  if (!entry) {
    const { institution, served_hours: hours, partner_count: partners } = wall.home;
    return {
      kicker: `Here at ${hereAt(institution)}`,
      label: 'GPU hours our computers ran for others',
      day: hours,
      month: null,
      note: `For researchers at ${countOf(partners, 'other organization', 'other organizations')}.`,
    };
  }
  if (entry.hosts) {
    return {
      kicker: `Here at ${hereAt(focus)}`,
      label: 'GPU hours our computers ran for others',
      day: entry.day.served_hours,
      month: entry.month.served_hours,
      note: `For researchers at ${countOf(entry.month.served_partners, 'other organization', 'other organizations')} over 30 days.`,
    };
  }
  return {
    kicker: `Here at ${hereAt(focus)}`,
    label: "GPU hours our researchers used elsewhere",
    day: entry.day.away_hours,
    month: entry.month.away_hours,
    note: `On GPUs at ${countOf(entry.month.away_hosts, 'campus', 'campuses')} over 30 days.`,
  };
}

export function formatMiles(miles) {
  return whole(miles >= 100 ? Math.round(miles / 10) * 10 : miles);
}

// The spotlight line in pieces, so the page can set the two places in bold.
export function spotlightParts(flow, nameFor = (name) => name) {
  const hours = formatHours(flow.gpu_hours);
  const from = nameFor(flow.from);
  const to = nameFor(flow.to);
  return [
    { text: `Researchers at ${articleFor(from)}` },
    { text: from, strong: true },
    { text: ` are running work on GPUs at ${articleFor(to)}` },
    { text: to, strong: true },
    { text: `, ${formatMiles(flow.miles)} miles away: ${hours} GPU ${hours === '1' ? 'hour' : 'hours'} in one day.` },
  ];
}

export function spotlightSentence(flow, nameFor) {
  return spotlightParts(flow, nameFor).map((part) => part.text).join('');
}
