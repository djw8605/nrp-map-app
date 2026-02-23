'use client'
import Head from 'next/head'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
import NodeMap from '../components/nodeMap'
import GlobalControls from '../components/globalControls'
import KpiRow from '../components/kpiRow'

import dynamic from 'next/dynamic'
import { GPUMetrics, CPUMetrics, NamespaceMetrics, ClusterMetrics } from '../components/gpumetrics'
import MapInfoPanel from '../components/mapInfoPanel'
import { useState } from 'react'
import { Card } from '@tremor/react'
import useSWR from 'swr'

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {

  // Use state to save the selected site
  const [selectedSite, setSelectedSite] = useState(null);
  const [mapStyle, setMapStyle] = useState('default');
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectionLegendName, setSelectionLegendName] = useState('Selected Sites');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexError, setRegexError] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Fetch nodes for regex matching
  const { data: Nodes } = useSWR('/api/nodes', fetcher, {
    onSuccess: () => setLastUpdated(Date.now()),
  });

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

      <GlobalControls
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        lastUpdated={lastUpdated}
      />

      <section>
        <KpiRow />
      </section>

      <section>
        <div className='container mx-auto grid grid-cols-1 md:grid-cols-3 md:gap-2 mt-2'>
          <div className='md:col-span-2 col-span-1 md:h-[40em] h-[20em] rounded shadow-lg bg-white dark:bg-gray-900 overflow-hidden'>
            <NodeMap 
              setSelectedSite={setSelectedSite} 
              selectedSite={selectedSite}
              selectedSites={selectedSites}
              setSelectedSites={setSelectedSites}
              selectionLegendName={selectionLegendName}
              regexPattern={regexPattern}
              handleRegexChange={handleRegexChange}
            />
          </div>
          <div className='md:col-span-1 col-span-1 bg-white dark:bg-gray-900'>
            <MapInfoPanel 
              site={selectedSite} 
              setSelectedSite={setSelectedSite}
              selectedSites={selectedSites}
              setSelectedSites={setSelectedSites}
              selectionLegendName={selectionLegendName}
              setSelectionLegendName={setSelectionLegendName}
              regexPattern={regexPattern}
              handleRegexChange={handleRegexChange}
              regexError={regexError}
              timeRange={timeRange}
            />
          </div>
        </div>

      </section>

      
      
      <section>
        <div className='container mx-auto mt-8'>
          <ClusterMetrics timeRange={timeRange} />

        </div>
      </section>


      <Footer></Footer>
    </>
  )
}