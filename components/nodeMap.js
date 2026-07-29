'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  FullscreenControl,
  NavigationControl,
  Marker,
} from 'react-map-gl';
import useSWR from 'swr';
import { fetcher } from '../lib/fetcher';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faUpRightAndDownLeftFromCenter} from "@fortawesome/free-solid-svg-icons";

import SitePinMarker from './map/SitePinMarker';
import { NRP_STANDARD_STYLE, OVERVIEW_CONFIG, resolveLightPreset } from './map/standardStyle';
import { applyBasemapConfig, registerBuildingInteractions } from './map/useStandardBasemap';

// Panel is 360px wide inset 12px from the right edge; reserve it plus a gutter.
const PANEL_RESERVE_PX = 384;
const COMPACT_RESERVE_PX = 56;
// Matches MapOverlayPanel's compact threshold, so padding and layout agree.
const PANEL_RESERVE_MIN_WIDTH = 640;
const LEGEND_PIN_SIZE = 20;

export default function NodeMap({
  setSelectedSite,
  selectedSite,
  // Superseded by the overlay panel. Still accepted so an out-of-date external
  // embed passing it cannot break.
  usePopup = false,
  selectedSites = [],
  setSelectedSites,
  selectionLegendName = 'Selected Sites',
  regexPattern = '',
  handleRegexChange,
  mapRef: externalMapRef,
  isSiteMode = false,
  onEnterSite,
  onExitOverview,
  showExpandLink = true,
  // Off when no panel is rendered (e.g. /map?panel=0) so the map stays centred.
  reservePanelSpace = true,
  children,
}) {
  // Fetch nodes data from API
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);

  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const basemapReadyRef = useRef(false);
  const [zoom, setZoom] = useState(3);

  // Read by the building-hover interaction without re-registering it on each change.
  const isSiteModeRef = useRef(isSiteMode);
  useEffect(() => {
    isSiteModeRef.current = isSiteMode;
  }, [isSiteMode]);

  // Helper to check if a site is selected
  const isSiteSelected = (node) => {
    return selectedSites && selectedSites.some(s => s.id === node.id);
  };

  // Helper to check if a site is OSDF exclusive (all nodes are cache nodes)
  const isOsdfExclusive = (node) => {
    if (!node.nodes || node.nodes.length === 0) return false;
    return node.nodes.every(n => n.cache === true);
  };

  // Helper to toggle site selection
  const toggleSiteSelection = (node) => {
    if (!setSelectedSites) return;
    setSelectedSites(prev => {
      const isSelected = prev.some(s => s.id === node.id);
      if (isSelected) {
        return prev.filter(s => s.id !== node.id);
      } else {
        return [...prev, node];
      }
    });
  };

  /*
   * Reserve the panel's strip so `center` means "centred in the visible map",
   * not "centred under the panel". Mapbox treats padding as part of the camera,
   * so flyTo/easeTo inherit it and the drill-in lands centred too.
   *
   * Keyed off the container width for the same reason MapOverlayPanel is: in a
   * narrow container the panel is a bottom sheet, not a right rail.
   *
   * Declared before onMapLoad, which lists it as a dependency.
   */
  const applyPanelPadding = useCallback((map, animate) => {
    if (!map || !reservePanelSpace) return;
    const width = map.getContainer()?.clientWidth || 0;
    const padding = width >= PANEL_RESERVE_MIN_WIDTH
      ? { top: 0, bottom: 0, left: 0, right: PANEL_RESERVE_PX }
      : { top: 0, bottom: COMPACT_RESERVE_PX, left: 0, right: 0 };

    if (animate) map.easeTo({ padding, duration: 300 });
    else map.setPadding(padding);
  }, [reservePanelSpace]);

  /*
   * Apply the basemap config and register building hover once per style load.
   * react-map-gl 7.x has no `config` prop, so this has to go through the raw map.
   */
  const onMapLoad = useCallback((event) => {
    const map = event.target;
    if (basemapReadyRef.current) return;
    basemapReadyRef.current = true;

    applyBasemapConfig(map, { ...OVERVIEW_CONFIG, lightPreset: resolveLightPreset() });
    registerBuildingInteractions(map, { enabled: () => isSiteModeRef.current });
    applyPanelPadding(map, false);
  }, [applyPanelPadding]);

  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || !reservePanelSpace) return undefined;

    const onResize = () => applyPanelPadding(map, true);
    map.on('resize', onResize);
    return () => map.off('resize', onResize);
  }, [mapRef, reservePanelSpace, applyPanelPadding]);

  /*
   * Re-light the basemap when the theme changes, without rebuilding the style.
   * Watches the `dark` class on <html> (Tailwind darkMode: 'class') rather than
   * prefers-color-scheme, so it also fires for the in-app toggle.
   */
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;

    const observer = new MutationObserver(() => {
      const map = mapRef.current?.getMap?.();
      if (map) applyBasemapConfig(map, { lightPreset: resolveLightPreset() });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [mapRef]);

  const sites = useMemo(() => (Nodes ? Object.values(Nodes) : []), [Nodes]);

  /*
   * Every site gets its own pin — pins were briefly grouped into count bubbles,
   * but that hid most of the map's sites, which is the thing the map is for.
   *
   * The zoom curve is what keeps dense regions workable instead: pins start small
   * enough at world zoom that neighbours stay individually clickable, and reach
   * full size by the time you have zoomed into a region.
   */
  const pins = useMemo(() => {
    if (sites.length === 0) return [];

    // The head is 86% of the pin's box width, so the box runs a little larger
    // than the old circle-plus-tail pin to land on the same visual weight.
    const computedSize = Math.max(Math.min(6.5 * (zoom || 1), 34), 18);
    const computedSelectedSize = Math.max(Math.min(6.5 * (zoom || 1) * 1.22, 40), 22);

    // Render OSDF-exclusive pins last so they stack on top of nearby regular
    // NRP pins (e.g. Internet2 Denver / Boise pairs are registered separately
    // but at almost the same coordinates).
    const sortedSites = [...sites].sort((a, b) => {
      const aOsdf = isOsdfExclusive(a) ? 1 : 0;
      const bOsdf = isOsdfExclusive(b) ? 1 : 0;
      return aOsdf - bOsdf;
    });

    return sortedSites.map((node) => {
      const isSelected = node === selectedSite;
      const isMultiSelected = isSiteSelected(node);
      const highlighted = isSelected || isMultiSelected;
      const finalSize = highlighted ? computedSelectedSize : computedSize;
      const osdfExclusive = isOsdfExclusive(node);

      return (
        <Marker key={node.id}
          longitude={node.longitude}
          latitude={node.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            // Ctrl/Cmd + Click for multi-select, regular click for single select
            if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
              toggleSiteSelection(node);
            } else {
              setSelectedSite(node);
              if (onEnterSite) onEnterSite(node);
            }
          }}
        >
 <SitePinMarker isSelected={highlighted} isOsdfExclusive={osdfExclusive} size={finalSize} title={node.name} />
        </Marker>
      );
    });
  }, [sites, selectedSite, zoom, setSelectedSite, selectedSites, onEnterSite]);

  // Marker clicks stop propagation, so anything reaching here is bare map.
  const onMapClick = useCallback(() => {
    setSelectedSite(null);
    // Clicking bare map is one of the ways out of the drill-in.
    if (isSiteMode && onExitOverview) onExitOverview();
  }, [setSelectedSite, isSiteMode, onExitOverview]);

  // Return loading state if data is not yet available
  if (isLoading) {
    return (
      <div className="loader-wrapper h-full">
        <div className="concentric-loader" aria-hidden="true">
          <div className="loading-ring loading-ring-1"></div>
          <div className="loading-ring loading-ring-2"></div>
          <div className="loading-ring loading-ring-3"></div>
          <div className="loader-text">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-full">Error loading map data</div>;
  }

  if (!Nodes) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const initialViewState = {
    longitude: -97.0739061397193,
    latitude: 39.63517934689119,
    zoom: 3,
    pitch: 0,
    bearing: 0
  }


  // Create the legend
  const Legend = () => {
    return (
      // Bottom-LEFT: the overlay panel occupies the right edge. Swatches render the
      // real SitePinMarker so the legend cannot drift from the pins on the map.
      <div className="map-glass-panel absolute bottom-3 left-3 z-10 px-3 py-2.5">
        <ul className="list-none space-y-2 text-xs text-slate-900 dark:text-slate-100">
          <li className="flex flex-row items-center gap-2.5">
            <SitePinMarker size={LEGEND_PIN_SIZE} interactive={false} />
            NRP Site
          </li>
          <li className="flex flex-row items-center gap-2.5">
            <SitePinMarker isOsdfExclusive size={LEGEND_PIN_SIZE} interactive={false} />
            OSDF Exclusive Site
          </li>
          {selectedSites && selectedSites.length > 0 && (
            <li className="flex flex-row items-center gap-2.5 border-t border-slate-300/60 pt-2 dark:border-slate-600/60">
              <SitePinMarker isSelected size={LEGEND_PIN_SIZE} interactive={false} />
              {selectionLegendName}
            </li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <>
      {/* `nrp-map` scopes the themed Mapbox control chrome in globals.css. */}
      <div className='nrp-map w-full relative h-full'>
      <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          mapStyle={NRP_STANDARD_STYLE}
          initialViewState={initialViewState}
          onLoad={onMapLoad}
          onClick={onMapClick}
          onMove={(e) => {
            setZoom(e.viewState?.zoom ?? zoom);
          }}

        >
          <FullscreenControl position="top-left" />
          <NavigationControl position="top-left" visualizePitch={true} />

          {pins}

        </Map>

        {/* Overlay stack. The legend is noise once zoomed into a single site. */}
        {!isSiteMode && <Legend />}

        {showExpandLink && !isSiteMode && (
          <Link
            href="/map"
            title="Open full-screen map"
            aria-label="Open full-screen map"
            className="map-glass-panel absolute top-3 right-3 z-10 flex items-center justify-center p-2 transition-colors"
          >
            <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} className="h-4 w-4 text-slate-700 dark:text-slate-200" />
          </Link>
        )}

        {children}
      </div>
    </>
  )
}
