'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  FullscreenControl,
  NavigationControl,
  Marker,
  Popup,
} from 'react-map-gl';
import useSWR from 'swr';
import { fetcher } from '../lib/fetcher';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faUpRightAndDownLeftFromCenter} from "@fortawesome/free-solid-svg-icons";

import SitePinMarker from './map/SitePinMarker';
import SiteHoverCard from './map/SiteHoverCard';
import { NRP_STANDARD_STYLE, OVERVIEW_CONFIG, resolveLightPreset } from './map/standardStyle';
import { applyBasemapConfig, registerBuildingInteractions } from './map/useStandardBasemap';
import { clusterSites, groupContainsAnySite, siteHasOsdfCache } from '../lib/siteClusters';

// Panel is 360px wide inset 12px from the right edge; reserve it plus a gutter.
const PANEL_RESERVE_PX = 384;
const COMPACT_RESERVE_PX = 56;
// Matches MapOverlayPanel's compact threshold, so padding and layout agree.
const PANEL_RESERVE_MIN_WIDTH = 640;
const LEGEND_PIN_SIZE = 20;

/*
 * Declared at module scope, NOT inside NodeMap.
 *
 * A component defined in the render body is a new type on every render, so React
 * unmounts and remounts it — which recreates the DOM node and replays the glass
 * panel's entrance animation. NodeMap re-renders on every zoom tick and every pin
 * hover, so nested here the legend visibly flickered each time.
 */
const Legend = ({ selectedSites, selectionLegendName, mergeRadiusKm = 0, hasMergedPins = false }) => (
  // Bottom-LEFT: the overlay panel occupies the right edge. Swatches render the
  // real SitePinMarker so the legend cannot drift from the pins on the map.
  <div className="map-glass-panel absolute bottom-3 left-3 z-10 px-3 py-2.5">
    <ul className="list-none space-y-2 text-xs text-slate-900 dark:text-slate-100">
      <li className="flex flex-row items-center gap-2.5">
        <SitePinMarker size={LEGEND_PIN_SIZE} interactive={false} />
        NRP Site
      </li>
      <li className="flex flex-row items-center gap-2.5">
        <SitePinMarker isOsdfCache size={LEGEND_PIN_SIZE} interactive={false} />
        OSDF Cache Site
      </li>
      {/* Only shown when something actually merged, so the legend does not explain
          a badge that is nowhere on screen. */}
      {hasMergedPins && (
        <li className="flex flex-row items-center gap-2.5">
          <SitePinMarker size={LEGEND_PIN_SIZE} count={2} interactive={false} />
          Sites within {mergeRadiusKm} km
        </li>
      )}
      {selectedSites && selectedSites.length > 0 && (
        <li className="flex flex-row items-center gap-2.5 border-t border-slate-300/60 pt-2 dark:border-slate-600/60">
          <SitePinMarker isSelected size={LEGEND_PIN_SIZE} interactive={false} />
          {selectionLegendName}
        </li>
      )}
    </ul>
  </div>
);

/*
 * Zoom -> pin size. Shared by the pins themselves and by the hover card, which
 * has to clear whichever pin it is describing, so the two cannot drift apart.
 */
const pinSizeForZoom = (zoom) => Math.max(Math.min(6.5 * (zoom || 1), 34), 18);
const highlightedPinSizeForZoom = (zoom) => Math.max(Math.min(6.5 * (zoom || 1) * 1.22, 40), 22);
// Mirrors the height multiplier in the .map-pin-marker rule (the 30/24 viewBox).
const PIN_ASPECT = 1.25;
const HOVER_CARD_GAP_PX = 10;

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
  /*
   * Merge sites closer together than this into one pin (see lib/siteClusters).
   * 0 disables it, which is the default: the live pages opt in rather than the
   * behaviour changing under them. See /cluster-test for the preview harness.
   */
  clusterRadiusKm = 0,
  // Render these sites instead of fetching /api/nodes. For the preview harness,
  // which needs to show fixture geometry the live payload does not contain.
  sites: sitesOverride,
  children,
}) {
  // Fetch nodes data from API. Skipped entirely when the caller supplies sites.
  const { data: Nodes, error, isLoading } = useSWR(
    sitesOverride ? null : '/api/nodes',
    fetcher,
  );

  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const basemapReadyRef = useRef(false);
  const [zoom, setZoom] = useState(3);
  const [hoveredSite, setHoveredSite] = useState(null);

  // Read by the building-hover interaction without re-registering it on each change.
  const isSiteModeRef = useRef(isSiteMode);
  useEffect(() => {
    isSiteModeRef.current = isSiteMode;
  }, [isSiteMode]);

  /*
   * Drop any hovered pin when drilling into a site. The card is hidden in site
   * mode anyway, but a site entered from the panel's picker never fires a pin
   * mouseleave, so without this the stale card reappears on the way back out.
   */
  useEffect(() => {
    if (isSiteMode) setHoveredSite(null);
  }, [isSiteMode]);

  /*
   * Selection state is tracked in terms of *sites*, while the map draws *groups*
   * (one group per pin, one or more sites per group — see lib/siteClusters). The
   * three helpers below are the whole translation layer between the two, so
   * `selectedSite`/`selectedSites` keep holding real sites for every consumer
   * outside this file: the regex filter, the pickers, the legend count.
   */

  // A pin is highlighted when the group itself is selected, or any site inside it
  // is — a member picked from the panel's dropdown must light up its merged pin.
  const isGroupSelected = (group) => {
    if (!selectedSite) return false;
    if (String(group.id) === String(selectedSite.id)) return true;
    return group.members.some((member) => String(member.id) === String(selectedSite.id));
  };

  const isSiteSelected = (group) => groupContainsAnySite(group, selectedSites);

  // Ctrl/Cmd-click on a merged pin is all-or-nothing across its members: a pin
  // that is half selected has no way to draw itself.
  const toggleSiteSelection = (group) => {
    if (!setSelectedSites) return;
    setSelectedSites((prev) => {
      const memberIds = new Set(group.members.map((member) => String(member.id)));
      const alreadySelected = prev.some((site) => memberIds.has(String(site.id)));
      if (alreadySelected) {
        return prev.filter((site) => !memberIds.has(String(site.id)));
      }
      return [...prev, ...group.members];
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

  const sites = useMemo(
    () => (sitesOverride ? sitesOverride : Nodes ? Object.values(Nodes) : []),
    [sitesOverride, Nodes],
  );

  /*
   * One pin per *group*. With clusterRadiusKm at 0 a group is exactly one site, so
   * this is the previous behaviour verbatim; above 0, sites within that many
   * kilometres share a pin that carries their count.
   *
   * Memoised on the data and the radius alone — not on selection or zoom — so the
   * group objects (and therefore the pin keys) survive hovering, selecting and
   * zooming. Rebuilding them per render would replay every pin's entrance.
   */
  const groups = useMemo(
    () => clusterSites(sites, { radiusKm: clusterRadiusKm }),
    [sites, clusterRadiusKm],
  );

  const hasMergedPins = useMemo(
    () => groups.some((group) => group.memberCount > 1),
    [groups],
  );

  /*
   * Every group gets its own pin — pins were briefly grouped into count bubbles by
   * region, but that hid most of the map's sites, which is the thing the map is
   * for. Merging strictly by distance is the narrow version of that idea: it only
   * ever folds together pins that were already drawing on top of each other.
   *
   * The zoom curve is what keeps dense regions workable beyond that: pins start
   * small enough at world zoom that neighbours stay individually clickable, and
   * reach full size by the time you have zoomed into a region.
   */
  const pins = useMemo(() => {
    if (groups.length === 0) return [];

    // The head is 86% of the pin's box width, so the box runs a little larger
    // than the old circle-plus-tail pin to land on the same visual weight.
    const computedSize = pinSizeForZoom(zoom);
    const computedSelectedSize = highlightedPinSizeForZoom(zoom);

    // Render OSDF cache pins last so they stack on top of nearby regular
    // NRP pins (e.g. Internet2 Denver / Boise pairs are registered separately
    // but at almost the same coordinates).
    const sortedGroups = [...groups].sort((a, b) => {
      const aOsdf = siteHasOsdfCache(a) ? 1 : 0;
      const bOsdf = siteHasOsdfCache(b) ? 1 : 0;
      return aOsdf - bOsdf;
    });

    return sortedGroups.map((group) => {
      const highlighted = isGroupSelected(group) || isSiteSelected(group);
      const finalSize = highlighted ? computedSelectedSize : computedSize;
      const osdfCache = siteHasOsdfCache(group);
      const label =
        group.memberCount > 1 ? `${group.name} — ${group.memberCount} sites` : group.name;

      return (
        <Marker key={group.id}
          longitude={group.longitude}
          latitude={group.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            // A tap on a touch device fires mouseenter first; clear it so the
            // card does not hang over the drill-in animation.
            setHoveredSite(null);
            // Ctrl/Cmd + Click for multi-select, regular click for single select
            if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
              toggleSiteSelection(group);
            } else {
              setSelectedSite(group);
              if (onEnterSite) onEnterSite(group);
            }
          }}
        >
          <SitePinMarker
            isSelected={highlighted}
            isOsdfCache={osdfCache}
            count={group.memberCount}
            size={finalSize}
            title={label}
            onMouseEnter={() => setHoveredSite(group)}
            onMouseLeave={() => setHoveredSite(null)}
          />
        </Marker>
      );
    });
  }, [groups, selectedSite, zoom, setSelectedSite, selectedSites, setSelectedSites, onEnterSite]);

  // Marker clicks stop propagation, so anything reaching here is bare map.
  const onMapClick = useCallback(() => {
    setSelectedSite(null);
    setHoveredSite(null);
    // Clicking bare map is one of the ways out of the drill-in.
    if (isSiteMode && onExitOverview) onExitOverview();
  }, [setSelectedSite, isSiteMode, onExitOverview]);

  // Return loading state if data is not yet available
  if (!sitesOverride && isLoading) {
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

  if (!sitesOverride && error) {
    return <div className="flex items-center justify-center h-full">Error loading map data</div>;
  }

  if (sites.length === 0) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const initialViewState = {
    longitude: -97.0739061397193,
    latitude: 39.63517934689119,
    zoom: 3,
    pitch: 0,
    bearing: 0
  }


  /*
   * No hover card while drilled into a site, and none for the pin that is
   * already open — the overlay panel is showing all of this and more.
   *
   * Compared by id rather than by reference: `selectedSite` can be a member site
   * chosen from the panel's picker while `hoveredSite` is the merged group drawing
   * that member's pin, and those are two different objects for one pin.
   */
  const hoverCardSite =
    hoveredSite && !isSiteMode && !isGroupSelected(hoveredSite) ? hoveredSite : null;

  // Lift the card clear of the pin it describes, at whatever size this zoom draws it.
  const hoveredPinHeight =
    (hoverCardSite && isSiteSelected(hoverCardSite)
      ? highlightedPinSizeForZoom(zoom)
      : pinSizeForZoom(zoom)) * PIN_ASPECT;

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

          {/*
            * One Popup for whichever pin is hovered, rather than a tooltip nested
            * in each Marker: markers are sibling transformed divs, so a nested
            * card would be trapped in its own stacking context and painted under
            * neighbouring pins. Mapbox's popup container sits above them all.
            * Keyed by site so the entrance animation replays pin to pin.
            */}
          {hoverCardSite && (
            <Popup
              key={hoverCardSite.id}
              longitude={hoverCardSite.longitude}
              latitude={hoverCardSite.latitude}
              anchor="bottom"
              offset={[0, -(hoveredPinHeight + HOVER_CARD_GAP_PX)]}
              closeButton={false}
              closeOnClick={false}
              closeOnMove={false}
              focusAfterOpen={false}
              maxWidth="none"
              className="nrp-hover-popup"
            >
              <SiteHoverCard site={hoverCardSite} />
            </Popup>
          )}

        </Map>

        {/* Overlay stack. The legend is noise once zoomed into a single site. */}
        {!isSiteMode && (
          <Legend
            selectedSites={selectedSites}
            selectionLegendName={selectionLegendName}
            mergeRadiusKm={clusterRadiusKm}
            hasMergedPins={hasMergedPins}
          />
        )}

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
