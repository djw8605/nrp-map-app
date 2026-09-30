import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Layer, Popup, Source, useMap } from 'react-map-gl';
import UsageHoverCard from './UsageHoverCard';
import { useIsDarkMode } from './useIsDarkMode';
import {
  getRegion,
  highlightedCodes,
  pointFallbackFeatures,
  shapeCodeSet,
} from '../../lib/usageRegions';

export const USAGE_FILL_LAYER_ID = 'usage-region-fill';
export const USAGE_LINE_LAYER_ID = 'usage-region-line';
export const USAGE_POINT_LAYER_ID = 'usage-region-point';
const INTERACTIVE_LAYER_IDS = [USAGE_FILL_LAYER_ID, USAGE_POINT_LAYER_ID];
const HOVER_CARD_OFFSET_PX = 14;

/*
 * Sky, to match the site pins and the toggle. The layers also set
 * `*-emissive-strength: 1`: Standard lights everything in its slots, so without it
 * the night preset multiplies these colours down to near-black.
 */
const COLORS = {
  light: { fill: '#0284c7', line: '#0369a1', selected: '#0c4a6e', pointStroke: '#ffffff' },
  dark: { fill: '#38bdf8', line: '#7dd3fc', selected: '#e0f2fe', pointStroke: '#0f172a' },
};

// isStyleLoaded() alone can report true while an imported style is being reloaded.
const isStyleFullyLoaded = (map) =>
  Boolean(map && map.isStyleLoaded() && (map.style?.fragments ?? []).every((f) => f.style?._loaded));

const codeIs = (code) => ['==', ['get', 'code'], code ?? ''];

/*
 * The usage view's map content. Rendered inside NodeMap's <Map> (via its
 * `mapChildren` prop), so it shares the camera and controls with the site pins.
 *
 * A region is filled if it appears in the usage payload at all: one colour,
 * no shading by amount. Regions too small to have an outline are drawn as dots
 * (lib/usageRegions pointFallbackFeatures).
 */
export default function UsageMapLayer({ usage, shapes, selectedCode, onSelectCode }) {
  const { current: mapRef } = useMap();
  const isDark = useIsDarkMode();
  const colors = isDark ? COLORS.dark : COLORS.light;
  const [hover, setHover] = useState(null); // { code, longitude, latitude }
  const [, bumpStyleVersion] = useReducer((n) => n + 1, 0);

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

  const usedFilter = useMemo(
    () => ['in', ['get', 'code'], ['literal', highlightedCodes(usage)]],
    [usage],
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
      onSelectCode(feature ? feature.properties.code : null);
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
  }, [mapRef, onSelectCode]);

  useEffect(() => {
    if (!selectedCode) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onSelectCode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCode, onSelectCode]);

  if (!styleReady || !usage || !shapes) return null;

  const isSelected = codeIs(selectedCode);
  const hoverRegion = hover ? getRegion(usage, hover.code) : null;

  return (
    <>
      <Source id="usage-regions" type="geojson" data={shapes}>
        <Layer
          id={USAGE_FILL_LAYER_ID}
          type="fill"
          slot="middle"
          filter={usedFilter}
          paint={{
            'fill-color': colors.fill,
            'fill-emissive-strength': 1,
            'fill-opacity': ['case', codeIs(hover?.code), 0.55, isSelected, 0.5, 0.3],
          }}
        />
        <Layer
          id={USAGE_LINE_LAYER_ID}
          type="line"
          slot="middle"
          filter={usedFilter}
          paint={{
            'line-color': ['case', isSelected, colors.selected, colors.line],
            'line-emissive-strength': 1,
            'line-width': ['case', isSelected, 2.5, 0.75],
          }}
        />
      </Source>

      <Source id="usage-region-points" type="geojson" data={points}>
        <Layer
          id={USAGE_POINT_LAYER_ID}
          type="circle"
          slot="middle"
          paint={{
            'circle-radius': ['case', isSelected, 8, 6],
            'circle-color': colors.fill,
            'circle-emissive-strength': 1,
            'circle-opacity': 0.85,
            'circle-stroke-color': ['case', isSelected, colors.selected, colors.pointStroke],
            'circle-stroke-width': ['case', isSelected, 2.5, 1.5],
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
