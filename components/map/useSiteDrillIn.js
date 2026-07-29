import { useCallback, useEffect, useRef, useState } from 'react';
import { OVERVIEW_CONFIG, SITE_CONFIG } from './standardStyle';
import {
  applyBasemapConfig,
  resolveBuildingAt,
  setBuildingSelected,
} from './useStandardBasemap';

export const SITE_ZOOM = 16.5;
export const SITE_PITCH = 55;
export const SITE_BEARING = -17.6;
const FLY_DURATION_MS = 2200;

/**
 * Drill-in camera + basemap state machine.
 *
 * `overview` is the zoomed-out pin map; `site` is the pitched street-level view
 * with the site's building tinted via the `select` feature state. The overview
 * camera is saved on entry so exiting returns exactly where the user left off.
 */
export function useSiteDrillIn(mapRef, { onExitSite } = {}) {
  const [mode, setMode] = useState('overview');
  const savedCameraRef = useRef(null);
  const selectedBuildingRef = useRef(null);
  const pendingSiteRef = useRef(null);

  // Held in a ref so the Escape listener does not need re-binding on each render.
  const onExitSiteRef = useRef(onExitSite);
  useEffect(() => {
    onExitSiteRef.current = onExitSite;
  }, [onExitSite]);

  const getMap = useCallback(() => mapRef.current?.getMap?.() || null, [mapRef]);

  const clearSelectedBuilding = useCallback(() => {
    const map = getMap();
    if (map && selectedBuildingRef.current) {
      setBuildingSelected(map, selectedBuildingRef.current, false);
    }
    selectedBuildingRef.current = null;
  }, [getMap]);

  /*
   * Buildings only exist as rendered features once the camera has arrived and the
   * street-level tiles are in, so resolution is deferred to `moveend` / `idle`
   * rather than attempted at click time.
   */
  const selectBuildingForPendingSite = useCallback(() => {
    const map = getMap();
    const site = pendingSiteRef.current;
    if (!map || !site) return;

    const feature = resolveBuildingAt(map, [Number(site.longitude), Number(site.latitude)]);
    if (!feature) return; // Open ground — pin and 3D view still land.

    clearSelectedBuilding();
    setBuildingSelected(map, feature, true);
    selectedBuildingRef.current = feature;
    pendingSiteRef.current = null;
  }, [getMap, clearSelectedBuilding]);

  const enterSite = useCallback(
    (site) => {
      const map = getMap();
      if (!map || !site) return;

      const longitude = Number(site.longitude);
      const latitude = Number(site.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

      // Only save the overview camera on the first hop in — going site -> site
      // must not overwrite it with a street-level camera.
      if (mode === 'overview') {
        const center = map.getCenter();
        savedCameraRef.current = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        };
      }

      clearSelectedBuilding();
      pendingSiteRef.current = site;
      setMode('site');

      applyBasemapConfig(map, SITE_CONFIG);
      map.flyTo({
        center: [longitude, latitude],
        zoom: SITE_ZOOM,
        pitch: SITE_PITCH,
        bearing: SITE_BEARING,
        duration: FLY_DURATION_MS,
        essential: true,
      });
    },
    [getMap, mode, clearSelectedBuilding],
  );

  /*
   * Resets the camera AND asks the owner to clear its selected site. Without the
   * callback, keyboard/`Escape` exits would restore the camera while the panel
   * kept showing the old site.
   */
  const exitToOverview = useCallback(() => {
    const map = getMap();
    pendingSiteRef.current = null;
    clearSelectedBuilding();
    setMode('overview');
    if (onExitSiteRef.current) onExitSiteRef.current();

    if (!map) return;

    applyBasemapConfig(map, OVERVIEW_CONFIG);

    const saved = savedCameraRef.current;
    map.flyTo({
      center: saved?.center ?? [-97.0739, 39.6352],
      zoom: saved?.zoom ?? 3,
      pitch: saved?.pitch ?? 0,
      bearing: saved?.bearing ?? 0,
      duration: FLY_DURATION_MS,
      essential: true,
    });
  }, [getMap, clearSelectedBuilding]);

  /*
   * `moveend` fires when the flyTo lands; `idle` covers the case where tiles were
   * still loading at that moment and the building was not yet queryable.
   */
  useEffect(() => {
    const map = getMap();
    if (!map || mode !== 'site') return undefined;

    map.on('moveend', selectBuildingForPendingSite);
    map.on('idle', selectBuildingForPendingSite);

    return () => {
      map.off('moveend', selectBuildingForPendingSite);
      map.off('idle', selectBuildingForPendingSite);
    };
  }, [getMap, mode, selectBuildingForPendingSite]);

  useEffect(() => {
    if (mode !== 'site') return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') exitToOverview();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, exitToOverview]);

  return { mode, enterSite, exitToOverview, isSiteMode: mode === 'site' };
}
