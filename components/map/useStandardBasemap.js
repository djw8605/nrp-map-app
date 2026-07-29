import { BASEMAP_IMPORT_ID, BUILDINGS_TARGET } from './standardStyle';

/**
 * Apply Standard basemap config properties.
 *
 * react-map-gl 7.x has no `config` prop (see its settable-prop list in
 * dist/esm/mapbox/mapbox.js), so runtime config has to go through the raw map
 * instance. Each key is set independently: an unknown or unsupported property
 * must not stop the rest from applying, matching the defensive style of
 * `softenCompetingStyleLayers` in components/osdf/OsdfMap.js.
 */
export function applyBasemapConfig(map, config = {}) {
  if (!map) return;

  for (const [key, value] of Object.entries(config)) {
    try {
      map.setConfigProperty(BASEMAP_IMPORT_ID, key, value);
    } catch (error) {
      // Unsupported config key for this style version — skip it.
    }
  }
}

/**
 * Tint buildings under the cursor using the Standard style's `buildings`
 * featureset and its `highlight` feature state.
 *
 * Unlike the GeoJSON hover in OsdfMap.js, featureset feature state takes the
 * feature object itself rather than a `{source, id}` descriptor.
 *
 * Returns a cleanup function.
 */
export function registerBuildingInteractions(map, { enabled = () => true } = {}) {
  if (!map) return () => {};

  const hoveredRef = { current: null };

  const clearHover = () => {
    if (!hoveredRef.current) return;
    try {
      map.setFeatureState(hoveredRef.current, { highlight: false });
    } catch (error) {
      // Feature no longer rendered — nothing to clear.
    }
    hoveredRef.current = null;
  };

  const interactions = [
    [
      'nrp-building-mouseenter',
      {
        type: 'mouseenter',
        target: BUILDINGS_TARGET,
        handler: ({ feature }) => {
          if (!enabled() || !feature) return;
          clearHover();
          try {
            map.setFeatureState(feature, { highlight: true });
            hoveredRef.current = feature;
          } catch (error) {
            hoveredRef.current = null;
          }
        },
      },
    ],
    [
      'nrp-building-mouseleave',
      {
        // Clear unconditionally: if `enabled()` flipped to false while a building
        // was hovered, the highlight would otherwise stick.
        type: 'mouseleave',
        target: BUILDINGS_TARGET,
        handler: () => {
          clearHover();
        },
      },
    ],
  ];

  for (const [id, spec] of interactions) {
    try {
      map.addInteraction(id, spec);
    } catch (error) {
      // Duplicate id (double-invoked effect) or unsupported target — ignore.
    }
  }

  return () => {
    clearHover();
    for (const [id] of interactions) {
      try {
        map.removeInteraction(id);
      } catch (error) {
        // Already gone.
      }
    }
  };
}

/**
 * Find the building to highlight for a site.
 *
 * Site coordinates in nodes.json are campus/building centroids, not guaranteed
 * building footprints, so query a small box rather than a single point and take
 * the most prominent hit. Returns null when nothing is under the site, which is a
 * normal outcome (rural sites, parking lots, campus greens) and must not throw.
 */
/*
 * Escalating search radii in screen pixels. Many sites (verified: UC Irvine,
 * Internet2 Charlotte) have centroids on lawns, car parks or roads with no
 * footprint within the tight radius, so widen the net before giving up. Ordered
 * tightest-first so an exact hit always wins over a merely nearby one.
 */
const BUILDING_SEARCH_RADII = [26, 64];

export function resolveBuildingAt(map, lngLat, { radii = BUILDING_SEARCH_RADII } = {}) {
  if (!map || !lngLat) return null;

  try {
    const point = map.project(lngLat);

    for (const padding of radii) {
      const hits = map.queryRenderedFeatures(
        [
          [point.x - padding, point.y - padding],
          [point.x + padding, point.y + padding],
        ],
        { target: BUILDINGS_TARGET },
      );
      if (!hits || hits.length === 0) continue;

      // Prefer extruded buildings, then the tallest — the tallest footprint near a
      // campus centroid is the best available proxy for "the building".
      return hits.slice().sort((a, b) => {
        const a3d = a.properties?.group === 'building-3d' ? 1 : 0;
        const b3d = b.properties?.group === 'building-3d' ? 1 : 0;
        if (a3d !== b3d) return b3d - a3d;
        return (Number(b.properties?.height) || 0) - (Number(a.properties?.height) || 0);
      })[0];
    }

    return null; // Genuinely nothing nearby — pin and 3D view still land.
  } catch (error) {
    // Style not loaded, or featureset unavailable on this style.
    return null;
  }
}

/** Toggle the `select` feature state, tolerating features that have since unloaded. */
export function setBuildingSelected(map, feature, selected) {
  if (!map || !feature) return;
  try {
    map.setFeatureState(feature, { select: selected });
  } catch (error) {
    // Feature no longer rendered.
  }
}
