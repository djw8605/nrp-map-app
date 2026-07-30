/*
 * Behavioural checks for lib/siteClusters, run against lib/siteClusters.fixture.
 *
 * A plain array of assertions rather than a Jest/Vitest suite: the project has no
 * test runner and adding one for a single pure module would be more configuration
 * than code. Written as data so the same list can be rendered in the /cluster-test
 * harness — the visual preview and the correctness proof sit on one page, and a
 * regression turns a row red where a reviewer is already looking.
 *
 * Nothing here touches React or the DOM, so if a runner is ever added this file is
 * already the suite: wrap each row in `it(check.name, () => expect(check.pass))`.
 */
import {
  DEFAULT_CLUSTER_RADIUS_KM,
  clusterRadiusForZoom,
  clusterSites,
  deriveGroupLabel,
  describeMembers,
  findGroupForSite,
  haversineKm,
  summarizeGrouping,
  summarizeSites,
} from './siteClusters';
import { FIXTURE_SITES } from './siteClusters.fixture';

const bySlug = (groups, slug) =>
  groups.find((group) => group.members.some((member) => member.slug === slug));

const slugsOf = (group) => (group ? group.members.map((member) => member.slug).sort() : []);

/** Grouping identity independent of array order — used for the determinism check. */
const signatureOf = (groups) =>
  groups
    .map((group) => slugsOf(group).join('+'))
    .sort()
    .join('|');

/**
 * @returns {Array<{name: string, pass: boolean, detail: string}>}
 */
export function runClusterChecks(sites = FIXTURE_SITES) {
  const at2km = clusterSites(sites, { radiusKm: 2 });
  const at1km = clusterSites(sites, { radiusKm: 1 });
  const off = clusterSites(sites, { radiusKm: 0 });

  const totals = summarizeSites(sites);
  const grouped = summarizeGrouping(at2km);
  const groupedTotals = summarizeSites(at2km);

  const denver = bySlug(at2km, 'internet2-denver');
  const frgp = bySlug(at2km, 'frgp-denver');
  const laJolla = bySlug(at2km, 'ucsd-optiputer');
  const laJollaTight = bySlug(at1km, 'ucsd-optiputer');
  const lincoln = bySlug(at2km, 'unl-schorr');
  const unmapped = bySlug(at2km, 'unmapped');

  // The distance that makes the no-chaining check meaningful: FRGP is nearer to a
  // *member* of the Denver group than the radius, but further from its leader.
  const annex = sites.find((site) => site.slug === 'internet2-denver-annex');
  const frgpSite = sites.find((site) => site.slug === 'frgp-denver');
  const denverLeader = denver?.primarySite;

  const outOfRadius = at2km.flatMap((group) =>
    group.members
      .filter((member) => haversineKm(group.primarySite, member) > group.radiusKm + 1e-9)
      .map((member) => `${group.name}/${member.slug}`),
  );

  const duplicateIds = (() => {
    const seen = new Set();
    return at2km.filter((group) => {
      const key = String(group.id);
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  })();

  const reversedSignature = signatureOf(clusterSites([...sites].reverse(), { radiusKm: 2 }));

  // SITE_ZOOM in useSiteDrillIn — where clicking a pin lands.
  const DRILL_IN_ZOOM = 16.5;
  const DENVER_LATITUDE = 39.74;
  const radiusAtOverview = clusterRadiusForZoom(DEFAULT_CLUSTER_RADIUS_KM, 3, DENVER_LATITUDE);
  const radiusAtDrillIn = clusterRadiusForZoom(
    DEFAULT_CLUSTER_RADIUS_KM,
    DRILL_IN_ZOOM,
    DENVER_LATITUDE,
  );
  const atDrillIn = clusterSites(sites, { radiusKm: radiusAtDrillIn });

  const checks = [
    {
      name: 'A radius of 0 merges nothing',
      pass: off.length === sites.length && off.every((group) => group.memberCount === 1),
      detail: `${off.length} pins for ${sites.length} sites`,
    },
    {
      name: 'No site is lost or duplicated by merging',
      pass: grouped.siteCount === sites.length,
      detail: `${sites.length} sites → ${grouped.pinCount} pins, ${grouped.siteCount} members total`,
    },
    {
      name: 'Node, GPU and cache totals survive merging',
      pass:
        groupedTotals.nodeCount === totals.nodeCount &&
        groupedTotals.gpuCount === totals.gpuCount &&
        groupedTotals.cacheCount === totals.cacheCount,
      detail: `${groupedTotals.nodeCount}/${totals.nodeCount} nodes, ` +
        `${groupedTotals.gpuCount}/${totals.gpuCount} GPUs, ` +
        `${groupedTotals.cacheCount}/${totals.cacheCount} caches`,
    },
    {
      name: 'Three Denver sites inside 1.2 km become one pin',
      pass:
        denver?.memberCount === 3 &&
        slugsOf(denver).join(',') ===
          'internet2-denver,internet2-denver-annex,internet2-denver-west',
      detail: `${denver?.memberCount ?? 0} members: ${slugsOf(denver).join(', ')}`,
    },
    {
      name: 'A merged group is labelled by what its members share',
      pass: denver?.name === 'Internet2 Denver',
      detail: `label "${denver?.name}"`,
    },
    {
      name: 'Merging does not chain: near a member is not near enough',
      pass: frgp?.memberCount === 1 && frgp?.slug === 'frgp-denver',
      detail:
        `FRGP is ${haversineKm(annex, frgpSite).toFixed(1)} km from the annex but ` +
        `${haversineKm(denverLeader, frgpSite).toFixed(1)} km from the leader, so it stays ` +
        `its own pin (${frgp?.memberCount ?? 0} member)`,
    },
    {
      name: 'Every member is inside the radius of its own pin',
      pass: outOfRadius.length === 0,
      detail: outOfRadius.length === 0 ? 'all members within radius' : outOfRadius.join(', '),
    },
    {
      name: 'A 1.9 km pair merges at 2 km and splits at 1 km',
      pass: laJolla?.memberCount === 2 && laJollaTight?.memberCount === 1,
      detail: `${laJolla?.memberCount ?? 0} members at 2 km, ${laJollaTight?.memberCount ?? 0} at 1 km`,
    },
    {
      name: 'Unrelated names fall back to naming the primary',
      pass: laJolla?.name === 'UC San Diego +1 more',
      detail: `label "${laJolla?.name}"`,
    },
    {
      name: 'Identical member names are not restated',
      pass: lincoln?.memberCount === 2 && lincoln?.name === 'University of Nebraska–Lincoln',
      detail: `${lincoln?.memberCount ?? 0} members labelled "${lincoln?.name}"`,
    },
    {
      // The failure this guards against: a merged pin whose list is the same
      // string twice, which names nothing and makes the merge look like data loss.
      name: 'Members sharing a name are told apart by their site name',
      pass:
        describeMembers(lincoln?.members || []).map((entry) => entry.label).join(' / ') ===
        'Schorr Center / Nebraska Innovation Campus',
      detail: describeMembers(lincoln?.members || [])
        .map((entry) => entry.label)
        .join(' / '),
    },
    {
      name: 'Members with distinct names keep them, site name as the second line',
      pass:
        describeMembers(denver?.members || []).every(
          (entry) => entry.label === entry.site.name && entry.secondary === entry.site.siteName,
        ),
      detail: describeMembers(denver?.members || [])
        .map((entry) => entry.label)
        .join(' / '),
    },
    {
      name: 'A site with no coordinates still gets a pin',
      pass: unmapped?.memberCount === 1 && unmapped?.slug === 'unmapped',
      detail: unmapped ? `kept as "${unmapped.name}"` : 'missing from the output',
    },
    {
      name: 'A merged pin keeps its primary member’s coordinates',
      pass:
        denver != null &&
        denver.latitude === denver.primarySite.latitude &&
        denver.longitude === denver.primarySite.longitude,
      detail: `pin at ${denver?.latitude}, ${denver?.longitude} (${denver?.primarySite?.slug})`,
    },
    {
      name: 'Merged ids cannot collide with site ids',
      pass:
        duplicateIds.length === 0 &&
        at2km.every((group) =>
          group.memberCount > 1 ? String(group.id).startsWith('cluster:') : true,
        ),
      detail: duplicateIds.length === 0 ? 'all pin ids unique and namespaced' : 'duplicate ids found',
    },
    {
      name: 'Zooming out keeps the configured radius',
      pass: radiusAtOverview === DEFAULT_CLUSTER_RADIUS_KM,
      detail: `${radiusAtOverview.toFixed(2)} km at zoom 3`,
    },
    {
      // The bug this guards: clicking a merged pin flew to street level and still
      // drew one pin, hiding the sites the camera had just gone to look at.
      name: 'Drilling in splits every merged pin back into its sites',
      pass: atDrillIn.length === sites.length && atDrillIn.every((g) => g.memberCount === 1),
      detail:
        `radius falls to ${Math.round(radiusAtDrillIn * 1000)} m at zoom ${DRILL_IN_ZOOM}, ` +
        `giving ${atDrillIn.length} pins for ${sites.length} sites`,
    },
    {
      name: 'Groups come apart gradually, furthest member first',
      // Denver: annex at 1.13 km, west at 0.65 km. Between those two distances the
      // annex must have its own pin while west is still merged with the leader.
      pass: (() => {
        const mid = clusterSites(sites, { radiusKm: 0.9 });
        const denverMid = bySlug(mid, 'internet2-denver');
        return (
          denverMid?.memberCount === 2 &&
          slugsOf(denverMid).join(',') === 'internet2-denver,internet2-denver-west' &&
          bySlug(mid, 'internet2-denver-annex')?.memberCount === 1
        );
      })(),
      detail: 'at 900 m the 1.1 km annex is its own pin, the 645 m west hall is not',
    },
    {
      name: 'Merging off stays off at every zoom',
      pass: [0, 3, 12, 16.5, 22].every((z) => clusterRadiusForZoom(0, z, 40) === 0),
      detail: 'radius 0 is never widened by the zoom calculation',
    },
    {
      name: 'Grouping does not depend on input order',
      pass: reversedSignature === signatureOf(at2km),
      detail: reversedSignature === signatureOf(at2km) ? 'reversed input, same groups' : 'groups differ',
    },
    {
      name: 'Any site can be mapped back to the pin that swallowed it',
      pass: sites.every((site) => findGroupForSite(at2km, site.id) != null),
      detail: `${sites.filter((site) => findGroupForSite(at2km, site.id)).length}/${sites.length} sites resolve to a pin`,
    },
    {
      name: 'Distances are great-circle, not degrees',
      // 1° of longitude is ~111 km at the equator and ~85 km at Denver's latitude.
      // A naive degree-space threshold would put this pair inside 2 "km".
      pass: Math.abs(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111.19) < 0.5,
      detail: `1° at the equator = ${haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }).toFixed(2)} km`,
    },
    {
      name: 'An empty or garbage site list is not a crash',
      pass:
        clusterSites([]).length === 0 &&
        clusterSites(null).length === 0 &&
        // Holes are dropped rather than becoming empty pins.
        clusterSites([null, undefined]).length === 0 &&
        // A site with no `nodes` key still counts as a pin with nothing in it.
        summarizeSites(clusterSites([{ id: 1, name: 'Bare', latitude: 1, longitude: 1 }]))
          .nodeCount === 0 &&
        deriveGroupLabel([]) === 'Unnamed site',
      detail: 'empty, null, holey and node-less inputs all handled',
    },
  ];

  return checks;
}

export const clusterChecksSummary = (checks) => ({
  total: checks.length,
  passed: checks.filter((check) => check.pass).length,
  failed: checks.filter((check) => !check.pass).length,
});
