import Head from 'next/head'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
//import Map from '../components/map'
import SiteList from '../components/sitelist'
import ProjectUsage from '../components/projectusage'
import LiveMetrics from '../components/livemetrics'

import dynamic from 'next/dynamic'
import { GPUMetrics, CPUMetrics, NamespaceMetrics } from '../components/gpumetrics'

export default function Home() {
  const Map = dynamic(
    () => import('../components/map'), // replace '@components/map' with your component's location
    { ssr: false } // This line is important. It's what prevents server-side render
  )
  return (
    <>
      <Head>
        <title>NRP</title>
        <link rel="icon" type="image/png" href="/GPN_favicon4.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@DerekWeitzel" />
        <meta name="twitter:creator" content="@DerekWeitzel" />
        <meta name="twitter:title" content="National Research Platform" />
        <meta name="twitter:description" content="The National Research Platform is a partnership of more than 50 institutions, led by researchers at
                UC San Diego, University of Nebraska-Lincoln, and UC Berkeley and includes the National Science Foundation, Department of Energy,
                and multiple research universities in the US and around the world." />
        <meta name="twitter:image" content="https://gp-argo.greatplains.net/twitter-card.png" />
      </Head>
      <NavBar></NavBar>


      <section className='top-section'>
        <div className="container mx-auto">
          <div className='grid grid-cols-12 gap-4'>
            <div className='col-span-5'>
              <h1 className='mb-4 font-bold text-4xl'>
                National Research Platform
              </h1>
              <p className='mb-4'>
                The National Research Platform is a partnership of more than 50 institutions, led by researchers at
                UC San Diego, University of Nebraska-Lincoln, and UC Berkeley and includes the National Science Foundation, Department of Energy,
                and multiple research universities in the US and around the world.
              </p>

              <div className='grid grid-cols-2 gap-4 mt-10'>
                <a className="rounded-md bg-green-600 p-3 text-xl text-center" href="https://docs.pacificresearchplatform.org/userdocs/start/get-access/">Get Access</a>
                <a className="rounded-md bg-orange-600 p-3 text-xl text-center" href="https://docs.pacificresearchplatform.org/admindocs/participating/new-contributor-guide/">Add a server to the NRP</a>

              </div>
            </div>
            <div className='col-span-7'>
              <Map />
            </div>
          </div>
        </div>
      </section >
      <section>
        <div className='container mx-auto'>
          <div className='grid grid-cols-3 gap-4'>
            <GPUMetrics />
            <CPUMetrics />
            <NamespaceMetrics />
          </div>
        </div>
      </section>
      <section className='middle-section'>
        <ProjectUsage />
      </section>

      <Footer></Footer>
    </>
  )
}
