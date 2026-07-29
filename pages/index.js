'use client'
import Head from 'next/head'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
import NodeMap from '../components/nodeMap'
import KpiRow from '../components/kpiRow'

import dynamic from 'next/dynamic'
import { GPUMetrics, CPUMetrics, NamespaceMetrics, ClusterMetrics } from '../components/gpumetrics'
import MapOverlayPanel from '../components/map/MapOverlayPanel'
import { MapOverviewContent, MapSiteContent } from '../components/map/MapPanelContent'
import { SiteSelectBox } from '../components/map/SiteSelect'
import { useSiteDrillIn } from '../components/map/useSiteDrillIn'
import { useCallback, useRef, useState } from 'react'
import { Card } from '@tremor/react'
import useSWR from 'swr'
import { fetcher } from '../lib/fetcher'

export default function Home() {

  // Use state to save the selected site
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectionLegendName, setSelectionLegendName] = useState('Selected Sites');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexError, setRegexError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Fetch nodes for regex matching
  const { data: Nodes } = useSWR('/api/nodes', fetcher);

  const mapRef = useRef(null);
  // onExitSite keeps the panel in sync with camera exits we do not initiate here
  // (Escape key, clicking bare map).
  const { isSiteMode, enterSite, exitToOverview } = useSiteDrillIn(mapRef, {
    onExitSite: () => setSelectedSite(null),
  });

  // Selecting from the panel's dropdown should fly in just like clicking a pin.
  const handleSelectSiteFromPanel = useCallback((site) => {
    if (!site) {
      exitToOverview();
      return;
    }
    setSelectedSite(site);
    enterSite(site);
  }, [enterSite, exitToOverview]);

  // Handle regex pattern change for selection
  const handleRegexChange = (pattern) => {
    setRegexPattern(pattern);
    
    if (!pattern || !Nodes) {
      setRegexError('');
      if (!pattern) {
        setSelectedSites([]);
      }
      return;
    }
    
    try {
      const regex = new RegExp(pattern, 'i');
      const matchingSites = [];
      for (const [key, value] of Object.entries(Nodes)) {
        if (regex.test(value.name) || regex.test(value.slug) || (value.description && regex.test(value.description))) {
          matchingSites.push(value);
        }
      }
      setSelectedSites(matchingSites);
      setRegexError('');
    } catch (e) {
      setRegexError('Invalid regular expression');
    }
  };

  return (
    <>
      <Head>
        <title>National Research Platform</title>
        <link rel="icon" type="image/png" href="/GPN_favicon4.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@DerekWeitzel" />
        <meta name="twitter:creator" content="@DerekWeitzel" />
        <meta name="twitter:title" content="National Research Platform" />
        <meta name="twitter:description" content="The National Research Platform is a partnership of more than 50 institutions, led by researchers at UC San Diego, University of Nebraska-Lincoln, and Massachusetts Green High Performance Computing Center and includes contributions by the National Science Foundation, the Department of Energy, the Department of Defense, and many research universities and R&E networking organizations in the US and around the world." />
        <meta name="twitter:image" content="https://gp-argo.greatplains.net/twitter-card.png" />
      </Head>
      <NavBar></NavBar>

      <section className="mt-4">
        <KpiRow />
      </section>

      <section className="mt-4">
        <div className='container mx-auto px-2 sm:px-0'>
          <div className='md:h-[38em] h-[22em] rounded-xl shadow-sm bg-white dark:bg-slate-900 overflow-hidden relative'>
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
            >
              {selectedSite ? (
                /* The picker in the header is the site's title: it names the open
                   site and switches to another. onClose is omitted deliberately —
                   it did exactly what onBack does. */
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
              )}
            </NodeMap>
          </div>
        </div>
      </section>

      <section className="mt-4 mb-6">
        <div className='container mx-auto px-2 sm:px-0'>
          {/* The freshness stamp reports when these cluster metrics last refreshed,
              so it belongs beside them rather than in a page-wide bar. */}
          {lastUpdated && (
            <p className="mb-2 text-right text-xs text-slate-400 dark:text-slate-500">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
          <ClusterMetrics onLastUpdated={setLastUpdated} />
        </div>
      </section>

      <Footer></Footer>
    </>
  )
}