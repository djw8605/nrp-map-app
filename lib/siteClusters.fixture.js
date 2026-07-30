/*
 * Synthetic sites for the /cluster-test harness.
 *
 * Not a copy of nodes.json — every group here exists to pin down one behaviour of
 * clusterSites(), and the distances are chosen so a reviewer can move the radius
 * slider and watch the expected thing happen:
 *
 *   Denver     three sites inside ~1.2 km, one of which is OSDF-only, plus a
 *              fourth 2.5 km from the leader but only 1.4 km from a *member* —
 *              it must stay its own pin, which is what stops leader clustering
 *              from chaining down a street.
 *   La Jolla   a pair 1.9 km apart with nothing in common in their names, so the
 *              label falls back to "<primary> +1 more". Merges at 2 km, splits
 *              below ~1.8 km.
 *   Lincoln    a pair ~0.9 km apart carrying the identical site name, which is
 *              the case where the merged label should just be that name.
 *   Holyoke/Honolulu/Clemson  ordinary far-apart singletons.
 *   Unmapped   no coordinates at all; has to survive as its own pin.
 *
 * Coordinates are decimal strings because that is how Netbox emits them and
 * therefore how they arrive in nodes.json — the fixture would be lying if it
 * used numbers.
 */

const node = (name, { gpus = 0, gpuType = '', cache = false } = {}) => ({
  name,
  cpus: '128',
  memory: '527998976Ki',
  gpus: String(gpus),
  gpuType,
  cache,
  osgId: '',
});

const gpuNodes = (prefix, count, gpusEach, gpuType) =>
  Array.from({ length: count }, (_, index) =>
    node(`${prefix}-${index + 1}.nrp-nautilus.io`, { gpus: gpusEach, gpuType }),
  );

const cpuNodes = (prefix, count) =>
  Array.from({ length: count }, (_, index) => node(`${prefix}-${index + 1}.nrp-nautilus.io`));

export const FIXTURE_SITES = [
  // ---- Denver: merges to one pin, four sites registered ----
  {
    id: 901,
    name: 'Internet2 Denver',
    siteName: 'Internet2 Denver — Rack A',
    slug: 'internet2-denver',
    latitude: '39.739200',
    longitude: '-104.990300',
    nodes: [...gpuNodes('i2-den-a', 4, 4, 'NVIDIA-A100-SXM4-80GB'), ...cpuNodes('i2-den-a-cpu', 2)],
  },
  {
    id: 902,
    name: 'Internet2 Denver West',
    siteName: 'Internet2 Denver — West Hall',
    slug: 'internet2-denver-west',
    latitude: '39.745000',
    longitude: '-104.990300',
    nodes: gpuNodes('i2-den-w', 2, 2, 'NVIDIA-GeForce-RTX-3090'),
  },
  {
    id: 903,
    name: 'Internet2 Denver Annex',
    siteName: 'Internet2 Denver — OSDF Annex',
    slug: 'internet2-denver-annex',
    latitude: '39.739200',
    longitude: '-105.003500',
    nodes: [node('osdf-den-1.nrp-nautilus.io', { cache: true })],
  },
  {
    // 2.5 km from the Denver leader, 1.4 km from the annex above. Its own pin.
    id: 904,
    name: 'Front Range GigaPoP',
    siteName: 'Front Range GigaPoP — Denver',
    slug: 'frgp-denver',
    latitude: '39.739200',
    longitude: '-105.020000',
    nodes: cpuNodes('frgp-den', 3),
  },

  // ---- La Jolla: 1.9 km apart, unrelated names ----
  {
    id: 911,
    name: 'UC San Diego',
    siteName: 'UCSD — Optiputer',
    slug: 'ucsd-optiputer',
    latitude: '32.884800',
    longitude: '-117.240500',
    nodes: [
      ...gpuNodes('ucsd-gpu', 8, 8, 'NVIDIA-A10'),
      ...cpuNodes('ucsd-cpu', 16),
      node('osdf-ucsd-1.nrp-nautilus.io', { cache: true }),
    ],
  },
  {
    id: 912,
    name: 'San Diego Supercomputer Center',
    siteName: 'SDSC — Machine Room',
    slug: 'sdsc',
    latitude: '32.884800',
    longitude: '-117.260700',
    nodes: gpuNodes('sdsc-gpu', 5, 4, 'NVIDIA-L40'),
  },

  // ---- Lincoln: identical names ~0.9 km apart ----
  {
    id: 921,
    name: 'University of Nebraska–Lincoln',
    siteName: 'Schorr Center',
    slug: 'unl-schorr',
    latitude: '40.820600',
    longitude: '-96.700800',
    nodes: [...gpuNodes('unl-gpu', 6, 4, 'NVIDIA-A100-SXM4-40GB'), ...cpuNodes('unl-cpu', 6)],
  },
  {
    id: 922,
    name: 'University of Nebraska–Lincoln',
    siteName: 'Nebraska Innovation Campus',
    slug: 'unl-nic',
    latitude: '40.829000',
    longitude: '-96.700800',
    nodes: [...cpuNodes('unl-nic', 2), node('osdf-unl-1.nrp-nautilus.io', { cache: true })],
  },

  // ---- Ordinary singletons ----
  {
    id: 931,
    name: 'Massachusetts Green HPCC',
    siteName: 'MGHPCC — Holyoke',
    slug: 'mghpcc',
    latitude: '42.205000',
    longitude: '-72.627600',
    nodes: [...gpuNodes('mghpcc-gpu', 12, 8, 'NVIDIA-A100-SXM4-80GB'), ...cpuNodes('mghpcc-cpu', 6)],
  },
  {
    id: 932,
    name: 'University of Hawaii',
    siteName: 'UH Mānoa',
    slug: 'hawaii',
    latitude: '21.296900',
    longitude: '-157.817100',
    nodes: cpuNodes('hawaii', 4),
  },
  {
    id: 933,
    name: 'Clemson University',
    siteName: 'Clemson — Palmetto',
    slug: 'clemson',
    latitude: '34.683400',
    longitude: '-82.837400',
    nodes: [...cpuNodes('clemson', 5), node('osdf-clemson-1.nrp-nautilus.io', { cache: true })],
  },

  // ---- Nothing to measure: must pass through untouched ----
  {
    id: 941,
    name: 'Unmapped Test Site',
    siteName: 'Unmapped Test Site',
    slug: 'unmapped',
    latitude: null,
    longitude: null,
    nodes: cpuNodes('unmapped', 1),
  },
];

/** Keyed the way /api/nodes is consumed (`Object.values(Nodes)`). */
export const FIXTURE_NODES = FIXTURE_SITES;
