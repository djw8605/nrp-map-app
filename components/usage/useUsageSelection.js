import { useCallback, useMemo, useState } from 'react';

const NO_SELECTION = { code: null, source: null, institution: null };

/*
 * The usage view's selection and hover, shared by the map layer and the panel.
 * Held by the page (both / and /map use it) because the layer renders inside
 * NodeMap's <Map> and the panel outside it, and each drives the other: a panel
 * row lights its region on the map, a hovered region lights its panel row.
 *
 * `source` says where a selection came from. The layer moves the camera for a
 * panel pick (the region may be off-screen or a few pixels wide) but not for a
 * map click, where the visitor is already looking at it. `institution` is set
 * when the pick was an institution search result, so the region view can point
 * at that row.
 */
export function useUsageSelection() {
  const [selection, setSelection] = useState(NO_SELECTION);
  const [panelHoverCode, setPanelHoverCode] = useState(null);
  const [mapHoverCode, setMapHoverCode] = useState(null);

  const selectFromMap = useCallback((code) => {
    setSelection(code ? { code, source: 'map', institution: null } : NO_SELECTION);
  }, []);

  const selectFromPanel = useCallback((code, institution = null) => {
    setPanelHoverCode(null);
    setSelection(code ? { code, source: 'panel', institution } : NO_SELECTION);
  }, []);

  const clear = useCallback(() => {
    setPanelHoverCode(null);
    setSelection(NO_SELECTION);
  }, []);

  return useMemo(() => ({
    selection,
    selectedCode: selection.code,
    panelHoverCode,
    setPanelHoverCode,
    mapHoverCode,
    setMapHoverCode,
    selectFromMap,
    selectFromPanel,
    clear,
  }), [selection, panelHoverCode, mapHoverCode, selectFromMap, selectFromPanel, clear]);
}
