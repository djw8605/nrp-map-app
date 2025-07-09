'use client'
import Head from 'next/head'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
//import Map from '../components/map'
import NodeMap from '../components/nodeMap'
import SiteList from '../components/sitelist'
import ProjectUsage from '../components/projectusage'
import LiveMetrics from '../components/livemetrics'

import dynamic from 'next/dynamic'
import { GPUMetrics, CPUMetrics, NamespaceMetrics, ClusterMetrics } from '../components/gpumetrics'
import MapInfoPanel from '../components/mapInfoPanel'
import { useState } from 'react'
import { Card } from '@tremor/react'

export default function Home() {

  // Use state to save the selected site
  const [selectedSite, setSelectedSite] = useState(null);
  const [mapStyle, setMapStyle] = useState('default');

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


      <section>
        <div className='container mx-auto grid grid-cols-1 md:grid-cols-3 md:gap-2 mt-1'>
          <div className='md:col-span-2 col-span-1 md:min-h-[40em] min-h-[20em] rounded shadow-lg bg-white dark:bg-gray-900'>
            <NodeMap setSelectedSite={setSelectedSite} selectedSite={selectedSite} />
          </div>
          <div className='md:col-span-1 col-span-1 bg-white dark:bg-gray-900'>
            <MapInfoPanel site={selectedSite} setSelectedSite={setSelectedSite} />
          </div>
        </div>

      </section>

      
      
      <section>
        <div className='container mx-auto mt-8'>
          <ClusterMetrics />

        </div>
      </section>


      <Footer></Footer>
    </>
  )
}

/*
          <div className='grid md:grid-cols-3 grid-cols-1 gap-4'>
            <GPUMetrics />
            <CPUMetrics />
            <NamespaceMetrics />
          </div>
          */

/*
      <section className='middle-section'>
        <ProjectUsage />
      </section>

/*
<section className='top-section my-4'>
        <div className="container mx-auto">
          <div className='grid md:grid-cols-12 grid-cols-1 md:gap-4'>
            <div className='col-span-5 mb-4 md:mb-0'>
              <h1 className='mb-4 font-bold text-4xl'>
                National Research Platform
              </h1>
              <p className='mb-4'>
                The National Research Platform is a partnership of more than 50 institutions, led by researchers at
                UC San Diego, University of Nebraska-Lincoln, and UC Berkeley and includes the National Science Foundation, Department of Energy,
                and multiple research universities in the US and around the world.
              </p>

              <div className='grid sm:grid-cols-2 grid-cols-1 gap-4 mt-10'>
                <a className="rounded-md bg-green-600 p-3 text-xl text-center" href="https://docs.nationalresearchplatform.org/userdocs/start/get-access/">Get Access</a>
                <a className="rounded-md bg-orange-600 p-3 text-xl text-center" href="https://docs.nationalresearchplatform.org/admindocs/participating/new-contributor-guide/">Add a server to the NRP</a>

              </div>
            </div>
            <div className='col-span-7'>
              <div className="lg:min-h-[30em] min-h-[20em] w-full h-full rounded-xl drop-shadow-md">

              </div>
            </div>
          </div>
        </div>
      </section >
      */