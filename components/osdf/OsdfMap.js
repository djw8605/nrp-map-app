import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, {
  FullscreenControl,
  Layer,
  NavigationControl,
  Popup,
  Source,
} from 'react-map-gl';
import OsdfPopup from './OsdfPopup';

const ENABLE_CLUSTERING = false;
const SOURCE_ID = 'osdf-node-source';
const CLUSTER_SOURCE_ID = 'osdf-node-cluster-source';
const ACTIVE_SOURCE_ID = ENABLE_CLUSTERING ? CLUSTER_SOURCE_ID : SOURCE_ID;

const OUTER_HALO_LAYER_ID = 'osdf-outer-halo-layer';
const MID_HALO_LAYER_ID = 'osdf-mid-halo-layer';
const CORE_LAYER_ID = 'osdf-core-layer';
const PULSE_LAYER_ID = 'osdf-pulse-layer';
const CLUSTER_LAYER_ID = 'osdf-cluster-layer';
const CLUSTER_COUNT_LAYER_ID = 'osdf-cluster-count-layer';

const CLUSTER_MAX_ZOOM = 3;
const CLUSTER_RADIUS = 40;

const TRAFFIC_NORM_EXPRESSION = ['coalesce', ['get', 'trafficNorm'], 0];
const HOVER_EXPRESSION = ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0];
const TRAFFIC_COLOR_EXPRESSION = [
  'interpolate',
  ['linear'],
  TRAFFIC_NORM_EXPRESSION,
  0,
  '#ff9f1c',
  0.55,
  '#ffd166',
  1,
  '#22ff88',
];

function buildPulseRadius(pulseValue) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    1,
    ['+', 28, ['*', TRAFFIC_NORM_EXPRESSION, 4], ['*', pulseValue, 4]],
    5,
    ['+', 34, ['*', TRAFFIC_NORM_EXPRESSION, 5], ['*', pulseValue, 6]],
  ];
}

function buildPulseOpacity(pulseValue) {
  return ['+', 0.03, ['*', pulseValue, 0.08], ['*', TRAFFIC_NORM_EXPRESSION, 0.02]];
}

const pulseLayer = {
  id: PULSE_LAYER_ID,
  type: 'circle',
  ...(ENABLE_CLUSTERING ? { filter: ['!', ['has', 'point_count']] } : {}),
  paint: {
    'circle-color': TRAFFIC_COLOR_EXPRESSION,
    'circle-radius': buildPulseRadius(0),
    'circle-opacity': buildPulseOpacity(0),
    'circle-blur': 0.85,
    'circle-opacity-transition': { duration: 140, delay: 0 },
    'circle-radius-transition': { duration: 140, delay: 0 },
  },
};

const outerHaloLayer = {
  id: OUTER_HALO_LAYER_ID,
  type: 'circle',
  ...(ENABLE_CLUSTERING ? { filter: ['!', ['has', 'point_count']] } : {}),
  paint: {
    'circle-color': TRAFFIC_COLOR_EXPRESSION,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      ['+', 22, ['*', TRAFFIC_NORM_EXPRESSION, 4], ['*', HOVER_EXPRESSION, 1.8]],
      5,
      ['+', 25, ['*', TRAFFIC_NORM_EXPRESSION, 5], ['*', HOVER_EXPRESSION, 2.2]],
    ],
    'circle-opacity': ['+', 0.06, ['*', TRAFFIC_NORM_EXPRESSION, 0.04], ['*', HOVER_EXPRESSION, 0.05]],
    'circle-blur': 0.55,
    'circle-radius-transition': { duration: 140, delay: 0 },
    'circle-opacity-transition': { duration: 140, delay: 0 },
  },
};

const midHaloLayer = {
  id: MID_HALO_LAYER_ID,
  type: 'circle',
  ...(ENABLE_CLUSTERING ? { filter: ['!', ['has', 'point_count']] } : {}),
  paint: {
    'circle-color': TRAFFIC_COLOR_EXPRESSION,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      ['+', 12, ['*', TRAFFIC_NORM_EXPRESSION, 4], ['*', HOVER_EXPRESSION, 1.1]],
      5,
      ['+', 14, ['*', TRAFFIC_NORM_EXPRESSION, 4.5], ['*', HOVER_EXPRESSION, 1.4]],
    ],
    'circle-opacity': ['+', 0.15, ['*', TRAFFIC_NORM_EXPRESSION, 0.1], ['*', HOVER_EXPRESSION, 0.08]],
    'circle-blur': 0.2,
    'circle-radius-transition': { duration: 140, delay: 0 },
    'circle-opacity-transition': { duration: 140, delay: 0 },
  },
};

const coreLayer = {
  id: CORE_LAYER_ID,
  type: 'circle',
  ...(ENABLE_CLUSTERING ? { filter: ['!', ['has', 'point_count']] } : {}),
  paint: {
    'circle-color': TRAFFIC_COLOR_EXPRESSION,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      ['+', 5, ['*', TRAFFIC_NORM_EXPRESSION, 5], ['*', HOVER_EXPRESSION, 1.2]],
      5,
      ['+', 6, ['*', TRAFFIC_NORM_EXPRESSION, 5.5], ['*', HOVER_EXPRESSION, 1.4]],
    ],
    'circle-opacity': ['+', 0.92, ['*', HOVER_EXPRESSION, 0.08]],
    'circle-stroke-color': '#0b1220',
    'circle-stroke-width': ['+', 1.1, ['*', HOVER_EXPRESSION, 0.55]],
    'circle-radius-transition': { duration: 140, delay: 0 },
    'circle-opacity-transition': { duration: 140, delay: 0 },
  },
};

const clusterLayer = {
  id: CLUSTER_LAYER_ID,
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#0f172a',
    'circle-radius': ['step', ['get', 'point_count'], 15, 16, 18, 40, 22],
    'circle-opacity': 0.9,
    'circle-stroke-color': '#22ff88',
    'circle-stroke-width': 1.2,
  },
};

const clusterCountLayer = {
  id: CLUSTER_COUNT_LAYER_ID,
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 11,
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
  },
  paint: {
    'text-color': '#bbf7d0',
  },
};

function enrichNodeTraffic(nodes) {
  const totals = nodes.map((node) => (Number(node.upload) || 0) + (Number(node.download) || 0));
  const min = totals.length > 0 ? Math.min(...totals) : 0;
  const max = totals.length > 0 ? Math.max(...totals) : 0;
  const range = max - min;

  return nodes.map((node) => {
    const totalTraffic = (Number(node.upload) || 0) + (Number(node.download) || 0);
    const trafficNorm = range > 0 ? (totalTraffic - min) / range : totalTraffic > 0 ? 1 : 0;
    return {
      ...node,
      totalTraffic,
      trafficNorm,
    };
  });
}

function softenCompetingStyleLayers(mapInstance) {
  const style = mapInstance.getStyle();
  const layers = style?.layers || [];

  for (const layer of layers) {
    if (layer.id.startsWith('osdf-')) continue;
    try {
      if (layer.type === 'background') {
        mapInstance.setPaintProperty(layer.id, 'background-color', '#060914');
      }

      if (layer.type === 'circle' && /(dot|dots|mesh|grid|point|globe|world)/i.test(layer.id)) {
        const currentOpacity = mapInstance.getPaintProperty(layer.id, 'circle-opacity');
        if (typeof currentOpacity === 'number') {
          mapInstance.setPaintProperty(layer.id, 'circle-opacity', Math.max(0.05, currentOpacity * 0.72));
        } else if (typeof currentOpacity === 'undefined') {
          mapInstance.setPaintProperty(layer.id, 'circle-opacity', 0.3);
        }
      }

      if (layer.type === 'fill' && /land/i.test(layer.id)) {
        const currentFillOpacity = mapInstance.getPaintProperty(layer.id, 'fill-opacity');
        if (typeof currentFillOpacity === 'number' && currentFillOpacity > 0.75) {
          mapInstance.setPaintProperty(layer.id, 'fill-opacity', 0.75);
        }
      }
    } catch (error) {
      // Ignore style-layer-specific paint operations that are unsupported.
    }
  }
}

export default function OsdfMap({
  nodes,
  isNodesLoading,
  isTrafficLoading,
  trafficError,
}) {
  const mapRef = useRef(null);
  const hoveredFeatureIdRef = useRef(null);
  const styleTunedRef = useRef(false);
  const pulseRafRef = useRef(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [popupAnchor, setPopupAnchor] = useState('left');

  useEffect(() => {
    let phase = 0;
    const tick = () => {
      phase = (phase + 0.35) % (Math.PI * 2);
      const pulseValue = 0.5 + 0.5 * Math.sin(phase);
      const map = mapRef.current?.getMap();
      if (map && map.getLayer(PULSE_LAYER_ID)) {
        try {
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-radius', buildPulseRadius(pulseValue));
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', buildPulseOpacity(pulseValue));
        } catch (error) {
          // Safe no-op when layer is not yet ready.
        }
      }
      pulseRafRef.current = requestAnimationFrame(tick);
    };
    pulseRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (pulseRafRef.current != null) {
        cancelAnimationFrame(pulseRafRef.current);
      }
    };
  }, []);

  const enrichedNodes = useMemo(() => enrichNodeTraffic(nodes), [nodes]);
  const nodeByFeatureId = useMemo(
    () => new Map(enrichedNodes.map((node) => [node.id, node])),
    [enrichedNodes],
  );

  const featureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: enrichedNodes.map((node) => ({
        id: node.id,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [node.longitude, node.latitude],
        },
        properties: {
          featureId: node.id,
          nodeId: node.nodeId,
          institution: node.institution,
          trafficTotal: node.totalTraffic,
          trafficNorm: node.trafficNorm,
        },
      })),
    }),
    [enrichedNodes],
  );

  useEffect(() => {
    if (selectedFeatureId && !nodeByFeatureId.has(selectedFeatureId)) {
      setSelectedFeatureId(null);
    }
  }, [selectedFeatureId, nodeByFeatureId]);

  const clearFeatureHover = useCallback(() => {
    const map = mapRef.current?.getMap();
    const previousId = hoveredFeatureIdRef.current;
    if (!map || previousId == null) return;

    try {
      map.setFeatureState({ source: ACTIVE_SOURCE_ID, id: previousId }, { hover: false });
    } catch (error) {
      // Safe no-op when feature/source is not yet available.
    }

    hoveredFeatureIdRef.current = null;
  }, []);

  const setFeatureHover = useCallback(
    (featureId) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const previousId = hoveredFeatureIdRef.current;
      if (previousId === featureId) return;

      if (previousId != null) {
        try {
          map.setFeatureState({ source: ACTIVE_SOURCE_ID, id: previousId }, { hover: false });
        } catch (error) {
          // Safe no-op when feature/source is not yet available.
        }
      }

      if (featureId != null) {
        try {
          map.setFeatureState({ source: ACTIVE_SOURCE_ID, id: featureId }, { hover: true });
          hoveredFeatureIdRef.current = featureId;
          return;
        } catch (error) {
          // Safe no-op when feature/source is not yet available.
        }
      }

      hoveredFeatureIdRef.current = null;
    },
    [],
  );

  useEffect(() => () => clearFeatureHover(), [clearFeatureHover]);

  const selectedNode = selectedFeatureId ? nodeByFeatureId.get(selectedFeatureId) : null;

  const onMapLoad = useCallback((event) => {
    setIsMapLoaded(true);
    if (!styleTunedRef.current) {
      softenCompetingStyleLayers(event.target);
      styleTunedRef.current = true;
    }
  }, []);

  const onMapClick = useCallback(
    (event) => {
      if (ENABLE_CLUSTERING) {
        const clusterFeature = event.features?.find((feature) => feature.layer.id === CLUSTER_LAYER_ID);
        if (clusterFeature) {
          const clusterId = clusterFeature.properties?.cluster_id;
          const map = mapRef.current?.getMap();
          const source = map?.getSource(ACTIVE_SOURCE_ID);
          if (
            source &&
            typeof source.getClusterExpansionZoom === 'function' &&
            typeof clusterId !== 'undefined'
          ) {
            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (error) return;
              const [lng, lat] = clusterFeature.geometry.coordinates;
              map.easeTo({
                center: [lng, lat],
                zoom: Math.min(zoom, 8),
                duration: 450,
              });
            });
          }
          return;
        }
      }

      const clickedFeature = event.features?.find((feature) => feature.layer.id === CORE_LAYER_ID);
      if (!clickedFeature) {
        setSelectedFeatureId(null);
        return;
      }

      const featureId = clickedFeature.properties?.featureId;
      if (typeof featureId === 'string') {
        setSelectedFeatureId(featureId);

        const canvasWidth = event.target?.getCanvas()?.clientWidth || 0;
        const shouldFlipToLeftSide = canvasWidth > 0 && event.point.x > canvasWidth * 0.72;
        setPopupAnchor(shouldFlipToLeftSide ? 'right' : 'left');
      }
    },
    [],
  );

  const onMouseMove = useCallback(
    (event) => {
      const hovered = event.features?.find((feature) => feature.layer.id === CORE_LAYER_ID);
      const hoveredId = hovered?.id ?? null;
      setFeatureHover(hoveredId);

      const canvas = mapRef.current?.getMap()?.getCanvas();
      if (canvas) {
        canvas.style.cursor = hovered ? 'pointer' : '';
      }
    },
    [setFeatureHover],
  );

  const onMouseLeave = useCallback(() => {
    clearFeatureHover();
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) {
      canvas.style.cursor = '';
    }
  }, [clearFeatureHover]);

  return (
    <div className="osdf-map relative min-h-[650px] w-full overflow-hidden bg-slate-950">
      <MapView
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/djw8605/cmm2idej2002r01qo03vef41r"
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 1.8,
        }}
        style={{ width: '100%', height: '100%', minHeight: 600 }}
        interactiveLayerIds={ENABLE_CLUSTERING ? [CORE_LAYER_ID, CLUSTER_LAYER_ID] : [CORE_LAYER_ID]}
        onLoad={onMapLoad}
        onClick={onMapClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />

        {isMapLoaded ? (
          <Source
            id={ACTIVE_SOURCE_ID}
            type="geojson"
            data={featureCollection}
            {...(ENABLE_CLUSTERING
              ? {
                  cluster: true,
                  clusterMaxZoom: CLUSTER_MAX_ZOOM,
                  clusterRadius: CLUSTER_RADIUS,
                }
              : {})}
          >
            {ENABLE_CLUSTERING ? (
              <>
                <Layer {...clusterLayer} />
                <Layer {...clusterCountLayer} />
              </>
            ) : null}
            <Layer {...pulseLayer} />
            <Layer {...outerHaloLayer} />
            <Layer {...midHaloLayer} />
            <Layer {...coreLayer} />
          </Source>
        ) : null}

        {selectedNode ? (
          <Popup
            className="osdf-popup"
            anchor={popupAnchor}
            closeOnClick={true}
            maxWidth="360px"
            longitude={Number(selectedNode.longitude)}
            latitude={Number(selectedNode.latitude)}
            onClose={() => setSelectedFeatureId(null)}
            offset={18}
          >
            <OsdfPopup node={selectedNode} />
          </Popup>
        ) : null}
      </MapView>

      {isNodesLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/45 text-sm font-medium text-slate-200">
          Loading OSDF nodes...
        </div>
      ) : null}

      {isTrafficLoading && !isNodesLoading ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
          Loading traffic overlay...
        </div>
      ) : null}

      {trafficError ? (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-amber-700/50 bg-amber-950/80 px-3 py-1.5 text-xs text-amber-200">
          Prometheus traffic unavailable. Showing node locations only.
        </div>
      ) : null}
    </div>
  );
}
