import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Layer, Popup, Source, useMap } from 'react-map-gl';
import UsageHoverCard from './UsageHoverCard';
import { useIsDarkMode } from './useIsDarkMode';
import { usageColors } from './usageColors';
import { USAGE_SHEET_MAX_FRACTION } from './UsagePanel';
import { isCompactContainer } from '../map/MapOverlayPanel';
import {
  binColorExpression,
  getRegion,
  highlightedCodes,
  isContiguousUsCode,
  pointFallbackFeatures,
  regionBounds,
  shapeCodeSet,
} from '../../lib/usageRegions';

export const USAGE_FILL_LAYER_ID = 'usage-region-fill';
export const USAGE_LINE_LAYER_ID = 'usage-region-line';
export const USAGE_UNUSED_LAYER_ID = 'usage-region-unused';
export const USAGE_POINT_LAYER_ID = 'usage-region-point';
const INTERACTIVE_LAYER_IDS = [USAGE_FILL_LAYER_ID, USAGE_POINT_LAYER_ID];
const HOVER_CARD_OFFSET_PX = 14;

/*
 * Camera margins on top of the panel reserve NodeMap already puts in the map's
 * padding: the top clears the view toggle, the left the zoom controls.
 */
const FIT_MARGIN = { top: 56, right: 24, bottom: 24, left: 56 };
// At phone widths the controls only take the top-left corner, so the sides can
// be tight: the lower 48 are wide, and width is what limits the zoom.
const COMPACT_FIT_MARGIN = { top: 56, right: 12, bottom: 24, left: 12 };
const FIT_DURATION_MS = 700;
const REGION_MAX_ZOOM = 6;
// Regions drawn as a dot have no outline to fit, so fly to a fixed zoom instead.
const POINT_ZOOM = 4;

// isStyleLoaded() alone can report true while an imported style is being reloaded.
const isStyleFullyLoaded = (map) =>
  Boolean(map && map.isStyleLoaded() && (map.style?.fragments ?? []).every((f) => f.style?._loaded));

const codeIs = (code) => ['==', ['get', 'code'], code ?? ''];

/*
 * The usage view's map content. Rendered inside NodeMap's <Map> (via its
 * `mapChildren` prop), so it shares the camera and controls with the site pins.
 *
 * Regions in the payload are shaded in five steps of institution count
 * (lib/usageRegions INSTITUTION_BINS). US states with no recorded use get a
 * faint outline, so they read as "none" rather than as a gap in the map.
 * Regions too small to have an outline are drawn as dots
 * (lib/usageRegions pointFallbackFeatures).
 *
 * `usageSelection` comes from useUsageSelection, shared with the panel: a
 * hovered panel row lights its region here, and a hovered region is reported
 * back so its row lights up.
 */
export default function UsageMapLayer({ usage, shapes, usageSelection, panelShown = true }) {
  const { current: mapRef } = useMap();
  const isDark = useIsDarkMode();
  const colors = usageColors(isDark);
  const [hover, setHover] = useState(null); // { code, longitude, latitude }
  const [, bumpStyleVersion] = useReducer((n) => n + 1, 0);
  const { selection, panelHoverCode, setMapHoverCode, selectFromMap, clear } = usageSelection;
  const selectedCode = selection.code;

  /*
   * The basemap is an inline style that imports Standard, and react-map-gl adds a
   * <Source> as soon as the root style is loaded. Mapbox then serialises the
   * imports, which throws "Style is not done loading" whenever an import is
   * (re)loading, and that happens after first load too (the basemap config is
   * applied on load). So readiness is read from the map during render, right
   * before the Sources mount, and the map's style events only trigger a re-render.
   */
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return undefined;
    map.on('styledata', bumpStyleVersion);
    map.on('load', bumpStyleVersion);
    map.on('idle', bumpStyleVersion);
    return () => {
      map.off('styledata', bumpStyleVersion);
      map.off('load', bumpStyleVersion);
      map.off('idle', bumpStyleVersion);
    };
  }, [mapRef]);
  // Once the sources are on the map they stay mounted; react-map-gl keeps them in
  // step with any later style reload.
  const sourcesMounted = useRef(false);
  if (!sourcesMounted.current && isStyleFullyLoaded(mapRef?.getMap?.())) sourcesMounted.current = true;
  const styleReady = sourcesMounted.current;

  const usedCodes = useMemo(() => highlightedCodes(usage), [usage]);
  const usedFilter = useMemo(() => ['in', ['get', 'code'], ['literal', usedCodes]], [usedCodes]);
  const unusedFilter = useMemo(
    () => ['all', ['==', ['slice', ['get', 'code'], 0, 3], 'US-'], ['!', usedFilter]],
    [usedFilter],
  );
  const fillColor = useMemo(
    () => binColorExpression(usage, colors.ramp, colors.ramp[0]),
    [usage, colors.ramp],
  );
  const points = useMemo(
    () => pointFallbackFeatures(usage, shapeCodeSet(shapes)),
    [usage, shapes],
  );

  /*
   * Plain map listeners rather than NodeMap's onClick: NodeMap owns that for the
   * pins, and these only exist while the usage view is mounted. Delegated
   * listeners skip layer ids that are not on the map yet, so registering before
   * the data has loaded is safe.
   */
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return undefined;

    const onMove = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = 'pointer';
      setHover({ code: feature.properties.code, longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      setHover(null);
    };
    const onClick = (event) => {
      const layers = INTERACTIVE_LAYER_IDS.filter((id) => map.getLayer(id));
      const [feature] = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : [];
      selectFromMap(feature ? feature.properties.code : null);
    };

    map.on('mousemove', INTERACTIVE_LAYER_IDS, onMove);
    map.on('mouseleave', INTERACTIVE_LAYER_IDS, onLeave);
    map.on('click', onClick);
    return () => {
      map.off('mousemove', INTERACTIVE_LAYER_IDS, onMove);
      map.off('mouseleave', INTERACTIVE_LAYER_IDS, onLeave);
      map.off('click', onClick);
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = '';
    };
  }, [mapRef, selectFromMap]);

  // Report only changes of region, not every mousemove, so the page re-renders
  // once per region crossed.
  const hoverCode = hover?.code ?? null;
  useEffect(() => {
    setMapHoverCode(hoverCode);
  }, [hoverCode, setMapHoverCode]);
  useEffect(() => () => setMapHoverCode(null), [setMapHoverCode]);

  useEffect(() => {
    if (!selectedCode) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCode, clear]);

  /*
   * Camera. fitBounds' `padding` replaces the map's padding rather than adding
   * to it, so the margins are added to the panel reserve NodeMap set, and that
   * reserve is put back when the usage view unmounts: the contributors drill-in
   * relies on it.
   *
   * In a compact container the panel is a bottom sheet up to
   * USAGE_SHEET_MAX_FRACTION of the height, and it opens when a region is
   * selected, so the fit keeps the region above it.
   */
  const basePaddingRef = useRef(null);
  const cameraPadding = (map, { aboveSheet = true } = {}) => {
    const base = basePaddingRef.current ?? map.getPadding();
    const container = map.getContainer();
    const compact = isCompactContainer(container);
    const margin = compact ? COMPACT_FIT_MARGIN : FIT_MARGIN;
    const sheetBottom = aboveSheet && panelShown && compact
      ? container.clientHeight * USAGE_SHEET_MAX_FRACTION + margin.bottom
      : 0;
    return {
      top: base.top + margin.top,
      right: base.right + margin.right,
      left: base.left + margin.left,
      bottom: Math.max(base.bottom + margin.bottom, sheetBottom),
    };
  };

  const fitTo = (map, bounds, { aboveSheet = true, ...options } = {}) => {
    if (!basePaddingRef.current) basePaddingRef.current = map.getPadding();
    map.fitBounds(bounds, {
      padding: cameraPadding(map, { aboveSheet }),
      duration: FIT_DURATION_MS,
      essential: true,
      ...options,
    });
  };

  useEffect(() => {
    const map = mapRef?.getMap?.();
    return () => {
      // The map may already be gone when the whole page unmounts.
      try {
        if (map && basePaddingRef.current) map.setPadding(basePaddingRef.current);
      } catch {
        // Nothing to restore on a removed map.
      }
    };
  }, [mapRef]);

  // NodeMap resets the padding to its reserve on resize; that is the new base.
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return undefined;
    const onResize = () => { basePaddingRef.current = null; };
    map.on('resize', onResize);
    return () => map.off('resize', onResize);
  }, [mapRef]);

  /*
   * First frame of the usage view: frame the lower 48 states that have usage.
   * The fixed zoom-3 camera cut off both coasts at phone widths, which are the
   * two states with the most institutions. Alaska, Hawaii and other countries
   * are left out; the panel lists them, and picking one flies there.
   */
  const overviewBounds = useMemo(
    () => regionBounds(shapes, usedCodes.filter(isContiguousUsCode)),
    [shapes, usedCodes],
  );
  const framedRef = useRef(false);
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map || !styleReady || framedRef.current || !overviewBounds) return;
    framedRef.current = true;
    // The sheet starts collapsed, so the overview frame only clears its header.
    fitTo(map, overviewBounds, { duration: 0, aboveSheet: false });
  }, [mapRef, styleReady, overviewBounds]);

  /*
   * A region picked in the panel may be off-screen or a few pixels wide (DC,
   * Rhode Island), so the camera goes to it. A map click leaves the camera alone
   * unless the bottom sheet is about to cover what was clicked. Clearing a
   * selection the camera moved for goes back to the overview frame.
   */
  const movedForSelection = useRef(false);
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map || !styleReady) return;

    if (!selection.code) {
      if (movedForSelection.current && overviewBounds) fitTo(map, overviewBounds, { aboveSheet: false });
      movedForSelection.current = false;
      return;
    }

    const compactSheet = panelShown && isCompactContainer(map.getContainer());
    if (selection.source !== 'panel' && !compactSheet) return;

    const bounds = regionBounds(shapes, selection.code);
    if (bounds) {
      fitTo(map, bounds, { maxZoom: REGION_MAX_ZOOM });
    } else {
      const point = points.features.find((f) => f.properties.code === selection.code);
      if (!point) return;
      if (!basePaddingRef.current) basePaddingRef.current = map.getPadding();
      map.flyTo({
        center: point.geometry.coordinates,
        zoom: POINT_ZOOM,
        padding: cameraPadding(map),
        duration: FIT_DURATION_MS,
        essential: true,
      });
    }
    movedForSelection.current = true;
    // Keyed on the selection object alone: a new pick is a new object, and the
    // helpers above read the latest shapes and padding when it runs.
  }, [mapRef, styleReady, selection]);

  if (!styleReady || !usage || !shapes) return null;

  const isSelected = codeIs(selectedCode);
  const lit = codeIs(hover?.code ?? panelHoverCode);
  const hasSelection = Boolean(selectedCode);
  const hoverRegion = hover ? getRegion(usage, hover.code) : null;

  /*
   * State order, strongest first: selected, lit (hovered here or in the panel),
   * everything else. With a selection the rest dim, so the one region the panel
   * is describing is the one that reads.
   */
  const fillOpacity = [
    'case',
    isSelected, 0.95,
    lit, 0.95,
    hasSelection ? 0.35 : 0.8,
  ];

  return (
    <>
      <Source id="usage-regions" type="geojson" data={shapes}>
        <Layer
          id={USAGE_UNUSED_LAYER_ID}
          type="line"
          slot="middle"
          filter={unusedFilter}
          paint={{
            'line-color': colors.unused,
            'line-emissive-strength': 1,
            'line-width': 0.75,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2],
          }}
        />
        <Layer
          id={USAGE_FILL_LAYER_ID}
          type="fill"
          slot="middle"
          filter={usedFilter}
          paint={{
            'fill-color': fillColor,
            'fill-emissive-strength': 1,
            'fill-opacity': fillOpacity,
            'fill-opacity-transition': { duration: 150 },
          }}
        />
        <Layer
          id={USAGE_LINE_LAYER_ID}
          type="line"
          slot="middle"
          filter={usedFilter}
          paint={{
            'line-color': ['case', isSelected, colors.selected, lit, colors.hover, colors.line],
            'line-emissive-strength': 1,
            'line-width': ['case', isSelected, 3, lit, 1.75, 0.75],
            'line-opacity': ['case', isSelected, 1, lit, 1, hasSelection ? 0.4 : 0.8],
          }}
        />
      </Source>

      <Source id="usage-region-points" type="geojson" data={points}>
        <Layer
          id={USAGE_POINT_LAYER_ID}
          type="circle"
          slot="middle"
          paint={{
            'circle-radius': ['case', isSelected, 8, lit, 8, 6],
            'circle-color': fillColor,
            'circle-emissive-strength': 1,
            'circle-opacity': ['case', isSelected, 1, lit, 1, hasSelection ? 0.45 : 0.9],
            'circle-stroke-color': ['case', isSelected, colors.selected, lit, colors.hover, colors.pointStroke],
            'circle-stroke-width': ['case', isSelected, 2.5, lit, 2, 1.5],
          }}
        />
      </Source>

      {hoverRegion ? (
        <Popup
          longitude={hover.longitude}
          latitude={hover.latitude}
          anchor="bottom"
          offset={HOVER_CARD_OFFSET_PX}
          closeButton={false}
          closeOnClick={false}
          closeOnMove={false}
          focusAfterOpen={false}
          maxWidth="none"
          className="nrp-hover-popup"
        >
          <UsageHoverCard name={hoverRegion.name} institutionCount={hoverRegion.institutions.length} />
        </Popup>
      ) : null}
    </>
  );
}
