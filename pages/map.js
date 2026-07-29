import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import NodeMap from "../components/nodeMap";
import MapOverlayPanel from "../components/map/MapOverlayPanel";
import { MapOverviewContent, MapSiteContent } from "../components/map/MapPanelContent";
import { SiteSelectBox } from "../components/map/SiteSelect";
import { useSiteDrillIn } from "../components/map/useSiteDrillIn";
import { fetcher } from "../lib/fetcher";

/*
 * Full-viewport map. This route is embedded in third-party pages (nrp.ai), so:
 *  - `?panel=0` renders the bare map, giving existing embedders a one-parameter
 *    rollback if the panel is unwanted.
 *  - The panel measures the map container rather than the viewport, so short
 *    iframes get a collapsed sheet instead of a panel covering the whole map.
 */
export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectionLegendName, setSelectionLegendName] = useState('Selected Sites');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexError, setRegexError] = useState('');

  const { data: Nodes } = useSWR('/api/nodes', fetcher);
  // onExitSite keeps the panel in sync with camera exits we do not initiate here
  // (Escape key, clicking bare map).
  const { isSiteMode, enterSite, exitToOverview } = useSiteDrillIn(mapRef, {
    onExitSite: () => setSelectedSite(null),
  });

  const showPanel = router.query.panel !== '0';

  const handleRegexChange = useCallback((pattern) => {
    setRegexPattern(pattern);

    if (!pattern || !Nodes) {
      setRegexError('');
      if (!pattern) setSelectedSites([]);
      return;
    }

    try {
      const regex = new RegExp(pattern, 'i');
      const matchingSites = Object.values(Nodes).filter((value) =>
        regex.test(value.name) || regex.test(value.slug) || (value.description && regex.test(value.description)),
      );
      setSelectedSites(matchingSites);
      setRegexError('');
    } catch (e) {
      setRegexError('Invalid regular expression');
    }
  }, [Nodes]);

  const handleSelectSiteFromPanel = useCallback((site) => {
    if (!site) {
      exitToOverview();
      return;
    }
    setSelectedSite(site);
    enterSite(site);
  }, [enterSite, exitToOverview]);

  return (
    <div className="w-screen h-screen">
      <NodeMap
        mapRef={mapRef}
        setSelectedSite={setSelectedSite}
        selectedSite={selectedSite}
        selectedSites={selectedSites}
        setSelectedSites={setSelectedSites}
        selectionLegendName={selectionLegendName}
        regexPattern={regexPattern}
        handleRegexChange={handleRegexChange}
        isSiteMode={isSiteMode}
        onEnterSite={enterSite}
        onExitOverview={exitToOverview}
        showExpandLink={false}
        reservePanelSpace={showPanel}
      >
        {showPanel ? (
          selectedSite ? (
            /* One picker in the header serves as the title and the switcher; see
               pages/index.js. onClose duplicated onBack, so it is gone. */
            <MapOverlayPanel
              position="right"
              titleNode={
                <SiteSelectBox
                  id="panel-site-select"
                  selectedSite={selectedSite}
                  setSelectedSite={handleSelectSiteFromPanel}
                />
              }
              onBack={exitToOverview}
            >
              <MapSiteContent site={selectedSite} />
            </MapOverlayPanel>
          ) : (
            <MapOverlayPanel position="right">
              <MapOverviewContent
                selectedSite={selectedSite}
                setSelectedSite={handleSelectSiteFromPanel}
                selectedSites={selectedSites}
                setSelectedSites={setSelectedSites}
                selectionLegendName={selectionLegendName}
                setSelectionLegendName={setSelectionLegendName}
                regexPattern={regexPattern}
                handleRegexChange={handleRegexChange}
                regexError={regexError}
              />
            </MapOverlayPanel>
          )
        ) : null}
      </NodeMap>
    </div>
  );
}
