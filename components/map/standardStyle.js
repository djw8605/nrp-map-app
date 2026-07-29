/*
 * Mapbox Standard basemap, wrapped in an inline import so it is addressable as
 * `basemap`.
 *
 * Pointing `mapStyle` straight at `mapbox://styles/mapbox/standard` does NOT work
 * for what we need: used directly, that style has `imports: []` and puts its
 * `featuresets` and `schema` at the root. There is no import to address, so both
 * `map.setConfigProperty('basemap', ...)` and `{featuresetId, importId: 'basemap'}`
 * fail. Wrapping it in a one-import style is the same shape the OSDF
 * `Dotted-Ground-Earth` style uses, and it keeps the basemap config in git
 * instead of in Studio.
 */

export const BASEMAP_IMPORT_ID = 'basemap';

/** Featureset target for the Standard style's building layers. */
export const BUILDINGS_TARGET = {
  featuresetId: 'buildings',
  importId: BASEMAP_IMPORT_ID,
};

/*
 * Overview (zoomed-out) basemap. `monochrome` keeps the map quiet under the site
 * pins, closely matching the `Monochrome-copy` style this replaces.
 */
export const OVERVIEW_CONFIG = {
  theme: 'monochrome',
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showRoadLabels: false,
  show3dObjects: true,
};

/*
 * Street-level basemap for the drill-in. `monochrome` reads flat and grey up
 * close, so switch to `faded` and turn context labels back on. Config changes are
 * live, so this cross-fades during the flyTo.
 */
export const SITE_CONFIG = {
  theme: 'faded',
  showPointOfInterestLabels: true,
  showRoadLabels: true,
  show3dObjects: true,
};

/*
 * Keep the basemap in step with the app theme; a bright `day` basemap glares
 * against the dark UI.
 *
 * Reads the `dark` class on <html> rather than `prefers-color-scheme`, because
 * Tailwind is configured with darkMode: 'class' and the in-app toggle can override
 * the OS preference.
 */
export function resolveLightPreset() {
  if (typeof document === 'undefined') return 'day';
  return document.documentElement.classList.contains('dark') ? 'night' : 'day';
}

/** Hover / selected building tints, applied via the `highlight` and `select` feature states. */
export const BUILDING_STATE_COLORS = {
  colorBuildingHighlight: '#7dd3fc', // sky-300
  colorBuildingSelect: '#0284c7', // sky-600
};

/**
 * Build the inline style. `mapStyle` must be referentially stable across renders
 * or react-map-gl tears the style down and rebuilds it, so callers should hold
 * this in a module constant or a `useMemo`.
 */
export function buildStandardStyle(configOverrides = {}) {
  return {
    version: 8,
    imports: [
      {
        id: BASEMAP_IMPORT_ID,
        url: 'mapbox://styles/mapbox/standard',
        config: {
          ...OVERVIEW_CONFIG,
          ...BUILDING_STATE_COLORS,
          lightPreset: resolveLightPreset(),
          ...configOverrides,
        },
      },
    ],
    sources: {},
    layers: [],
  };
}

/** Default instance — stable identity, safe to pass straight to `mapStyle`. */
export const NRP_STANDARD_STYLE = buildStandardStyle();
