/*
 * Merging map sites that sit almost on top of each other.
 *
 * Several NRP institutions register more than one Netbox site inside the same
 * campus or the same carrier hotel — Internet2's Denver racks, an institution
 * whose data centre and machine room are separate sites, and so on. At overview
 * zoom those are one pin's worth of screen space, so the pins overlap and only
 * whichever one draws last is clickable.
 *
 * The fix is to merge sites within a small radius into one pin while keeping
 * every member site intact underneath, so the panel and the hover card can still
 * name them individually. Nothing here mutates or copies a member's fields: a
 * group holds references to the original site objects, and the merged view is
 * derived. That is what lets `/api/sitemetrics?site=<slug>` keep working — the
 * panel asks for a real member's slug, never a synthetic merged one.
 *
 * The earlier attempt at this (see the commented-out block in
 * generate-nodes/generate-nodes.js) grouped by a shared 6-character geohash
 * prefix. Geohash prefixes are fixed grid cells, so two sites 200 m apart across
 * a cell boundary never merged while two sites 1.2 km apart inside one cell did.
 * This works in metres instead.
 */

/** Sites closer than this are one pin by default. */
export const DEFAULT_CLUSTER_RADIUS_KM = 2;

/**
 * Screen distance two pins need before they are worth drawing separately.
 *
 * A pin's head is 86% of its box and the box tops out at 34px, so ~30px is the
 * point at which two heads stop touching; 48 leaves a clear gap between them.
 */
export const MIN_PIN_SEPARATION_PX = 48;

const EARTH_RADIUS_KM = 6371.0088;
// Web Mercator ground resolution at zoom 0 for a 512px tile, in metres/pixel.
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03392;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * Netbox hands back latitude/longitude as decimal *strings* ("39.739200"), and
 * they arrive that way in nodes.json, so everything here coerces with Number()
 * rather than trusting the type.
 */
export function haversineKm(a, b) {
  const lat1 = Number(a?.latitude);
  const lon1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude);
  const lon2 = Number(b?.longitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web Mercator ground resolution — how much real distance one pixel covers. */
export function metersPerPixel(zoom, latitude = 0) {
  const scale = 2 ** (Number(zoom) || 0);
  return (METERS_PER_PIXEL_AT_ZOOM_0 * Math.cos(toRadians(Number(latitude) || 0))) / scale;
}

/**
 * The merge radius to actually use at a given zoom.
 *
 * Merging exists to stop pins from covering each other, so it has to stop as soon
 * as they no longer do. Drilling into a site flies to zoom 16.5, where a pixel is
 * about 1.3 m — two sites 1 km apart are then 800 px apart, and keeping them under
 * one pin hides the very thing the camera just flew to.
 *
 * So the configured radius is a *ceiling*, and the working radius is whatever
 * distance is currently smaller than MIN_PIN_SEPARATION_PX on screen. Feeding that
 * back into clusterSites means groups come apart progressively as you zoom — the
 * far member of a group separates before the near one — with no second code path
 * and no special case for the drill-in.
 *
 * `latitude` matters because a Mercator pixel covers less ground away from the
 * equator; pass the camera's centre latitude. Defaulting to 0 errs toward keeping
 * sites merged slightly longer rather than splitting them too early.
 */
export function clusterRadiusForZoom(
  maxRadiusKm,
  zoom,
  latitude = 0,
  separationPx = MIN_PIN_SEPARATION_PX,
) {
  if (!(maxRadiusKm > 0)) return 0;
  if (!Number.isFinite(Number(zoom))) return maxRadiusKm;
  const separationKm = (separationPx * metersPerPixel(zoom, latitude)) / 1000;
  return Math.min(maxRadiusKm, separationKm);
}

export function hasValidCoordinates(site) {
  return Number.isFinite(Number(site?.latitude)) && Number.isFinite(Number(site?.longitude));
}

/** Node/GPU/cache totals over an arbitrary list of sites. */
export function summarizeSites(sites) {
  const list = Array.isArray(sites) ? sites : [];
  let nodeCount = 0;
  let gpuCount = 0;
  let cacheCount = 0;

  for (const site of list) {
    for (const node of site?.nodes || []) {
      nodeCount += 1;
      gpuCount += parseInt(node.gpus, 10) || 0;
      if (node.cache === true) cacheCount += 1;
    }
  }

  return { nodeCount, gpuCount, cacheCount };
}

export const siteHasOsdfCache = (site) => (site?.nodes || []).some((node) => node.cache === true);

/**
 * Rank for leader selection and for member ordering: biggest site first, then
 * the one with GPUs, then by id so the result never depends on input order.
 */
function compareSitesForPrimary(a, b) {
  const aStats = summarizeSites([a]);
  const bStats = summarizeSites([b]);
  if (aStats.nodeCount !== bStats.nodeCount) return bStats.nodeCount - aStats.nodeCount;
  if (aStats.gpuCount !== bStats.gpuCount) return bStats.gpuCount - aStats.gpuCount;
  return String(a?.id).localeCompare(String(b?.id));
}

/**
 * Longest run of whole leading words shared by every name.
 *
 * Word-wise, not character-wise: a character prefix of "Denver" and "Detroit"
 * is "De", which is not a place. Returning "" means the names have nothing in
 * common and the caller should fall back to naming the primary.
 */
function sharedNamePrefix(names) {
  if (names.length === 0) return '';
  const wordLists = names.map((name) => name.trim().split(/\s+/));
  const shortest = Math.min(...wordLists.map((words) => words.length));

  const shared = [];
  for (let i = 0; i < shortest; i += 1) {
    const word = wordLists[0][i];
    if (!wordLists.every((words) => words[i].toLowerCase() === word.toLowerCase())) break;
    shared.push(word);
  }

  // A single shared word that is only a connective ("University", "of") is not a
  // label; require either two words or one substantial one.
  const label = shared.join(' ').replace(/[\s,\-–—/&]+$/, '');
  if (shared.length === 1 && label.length < 4) return '';
  return label;
}

/**
 * Label for a merged group: the shared name when the members agree, otherwise
 * the primary's name with a count of what else is in the group.
 */
export function deriveGroupLabel(members) {
  const names = [...new Set(members.map((site) => site?.name).filter(Boolean))];
  if (names.length === 0) return 'Unnamed site';
  if (names.length === 1) return names[0];

  const shared = sharedNamePrefix(names);
  if (shared) return shared;

  return `${members[0].name} +${names.length - 1} more`;
}

/**
 * Build the site-shaped façade for a group of member sites.
 *
 * The primary member's identity fields are spread first, so a single-member
 * group is behaviourally the original site (same `id`, `slug`, `latitude`) and
 * every existing consumer keeps working untouched. For a real group:
 *
 *  - `id` becomes `cluster:<primary id>` so it can never collide with a site id
 *    and so callers comparing ids do not mistake the group for its primary.
 *  - `latitude`/`longitude` stay the *primary's*, not the centroid. The centroid
 *    of three campus sites is often a car park, and the drill-in tints whatever
 *    building sits under the coordinate — anchoring on the largest member keeps
 *    that landing on a real facility. Members are within `radiusKm` anyway, so
 *    the pin does not visibly move.
 *  - `nodes` is the concatenation, which makes the aggregate node/GPU/cache
 *    counts in the panel and the hover card correct for free.
 *  - `slug` is the primary's. Live metrics are always fetched per member, never
 *    for the group, so this is only an identifier of last resort.
 */
function makeGroup(members, radiusKm) {
  const ordered = [...members].sort(compareSitesForPrimary);
  const primary = ordered[0];
  const isCluster = ordered.length > 1;

  const spanKm = isCluster
    ? Math.max(...ordered.slice(1).map((site) => haversineKm(primary, site)))
    : 0;

  return {
    ...primary,
    id: isCluster ? `cluster:${primary.id}` : primary.id,
    name: isCluster ? deriveGroupLabel(ordered) : primary.name,
    nodes: isCluster ? ordered.flatMap((site) => site.nodes || []) : primary.nodes,
    isCluster,
    members: ordered,
    memberCount: ordered.length,
    primarySite: primary,
    /** Distance from the primary to the furthest member, in km. */
    spanKm,
    radiusKm,
  };
}

/**
 * Group sites so that no two pins are drawn closer than `radiusKm`.
 *
 * Greedy leader clustering, not single-linkage: the largest unassigned site
 * becomes a leader and absorbs every unassigned site within `radiusKm` of *it*.
 * Single-linkage was the obvious choice and is wrong here — it chains, so sites
 * at 1.9 km, 1.9 km and 1.9 km down a road collapse into one 5.7 km-wide group
 * that no longer describes one place. Every member of a leader group is within
 * `radiusKm` of the leader by construction, which bounds a group at 2·radius.
 *
 * O(n²) on purpose: nodes.json carries on the order of a hundred sites, so a
 * spatial index would be more code than the loop it saves.
 *
 * @param {Array<object>} sites Raw sites from /api/nodes.
 * @param {{radiusKm?: number}} [options] `radiusKm <= 0` disables merging.
 * @returns {Array<object>} One group per pin. Always the same shape, whether or
 *   not it merged anything, so callers never branch on "is this a cluster".
 */
export function clusterSites(sites, { radiusKm = DEFAULT_CLUSTER_RADIUS_KM } = {}) {
  const list = Array.isArray(sites) ? sites.filter(Boolean) : [];
  if (list.length === 0) return [];

  // Sites without usable coordinates cannot be measured against anything, so
  // they pass straight through as their own pin rather than being dropped.
  const locatable = list.filter(hasValidCoordinates);
  const unlocatable = list.filter((site) => !hasValidCoordinates(site));

  if (!(radiusKm > 0)) {
    return list.map((site) => makeGroup([site], 0));
  }

  const candidates = [...locatable].sort(compareSitesForPrimary);
  const assigned = new Set();
  const groups = [];

  for (const leader of candidates) {
    if (assigned.has(leader)) continue;
    assigned.add(leader);

    const members = [leader];
    for (const other of candidates) {
      if (assigned.has(other)) continue;
      if (haversineKm(leader, other) <= radiusKm) {
        assigned.add(other);
        members.push(other);
      }
    }

    groups.push(makeGroup(members, radiusKm));
  }

  for (const site of unlocatable) groups.push(makeGroup([site], radiusKm));

  return groups;
}

/**
 * How to name each member of a group so the members can be told apart.
 *
 * nodes.json carries two names per site: `name`, which is the Netbox *region*
 * where one exists, and `siteName`, the site itself. Two sites on one campus
 * therefore very often share `name` — UNL's Schorr Center and Innovation Campus
 * are both "University of Nebraska–Lincoln" — and a member list showing `name`
 * would print that twice and identify nothing.
 *
 * So: use `name` when it is unique inside the group, and fall back to `siteName`
 * when it is not. Decided per group rather than per site, so a three-member list
 * does not mix the two conventions down its rows.
 *
 * @returns {Array<{site: object, label: string, secondary: string}>} `secondary`
 *   is the other name when it adds something, or '' when it would just repeat.
 */
export function describeMembers(members) {
  const list = members || [];
  const names = list.map((site) => site?.name || '');
  const namesAreUnique = new Set(names).size === names.length;

  return list.map((site) => {
    const label = (namesAreUnique ? site?.name : site?.siteName || site?.name) || 'Unnamed site';
    const other = namesAreUnique ? site?.siteName : site?.name;
    return { site, label, secondary: other && other !== label ? other : '' };
  });
}

/**
 * The group a given site ended up in — how the site picker, the regex selection
 * and the multi-select map back onto pins after merging.
 */
export function findGroupForSite(groups, siteId) {
  if (siteId == null) return null;
  const wanted = String(siteId);
  return (
    (groups || []).find((group) =>
      group.members.some((member) => String(member.id) === wanted),
    ) || null
  );
}

/** True when any of `sites` is a member of `group`. Used to highlight pins. */
export function groupContainsAnySite(group, sites) {
  if (!group || !sites || sites.length === 0) return false;
  const wanted = new Set(sites.map((site) => String(site?.id)));
  return group.members.some((member) => wanted.has(String(member.id)));
}

/** Counts for the test harness and for any "merged N sites into M pins" copy. */
export function summarizeGrouping(groups) {
  const list = groups || [];
  const merged = list.filter((group) => group.memberCount > 1);
  return {
    pinCount: list.length,
    siteCount: list.reduce((total, group) => total + group.memberCount, 0),
    mergedGroupCount: merged.length,
    mergedSiteCount: merged.reduce((total, group) => total + group.memberCount, 0),
    maxSpanKm: merged.length ? Math.max(...merged.map((group) => group.spanKm)) : 0,
  };
}
