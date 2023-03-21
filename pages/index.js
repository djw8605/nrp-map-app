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
        <meta name="twitter:title" content="The Great Plains Augmented Regional Gateway to the Open Science Grid
" />
        <meta name="twitter:description" content="GP-ARGO creates a regional distributed Open Science Grid (OSG) Gateway led by the Great Plains Network (GPN) to support computational and data-intensive research across the region through the development of specialized CI resources, workforce training, and cross-support methodologies and agreements." />
        <meta name="twitter:image" content="https://gp-argo.greatplains.net/twitter-card.png" />
      </Head>
      <NavBar></NavBar>


      <section className='top-section'>
        <div className="container">
          <div className='row'>
            <div className='col-md-5'>
              <div className='row'>
                <div className='col-md-12'>
                  <h1 className='mb-4'>
                    National Research Platform
                  </h1>
                  <p className='mb-4'>
                    The National Research Platform is a partnership of more than 50 institutions, led by researchers at
                    UC San Diego, University of Nebraska-Lincoln, and UC Berkeley and includes the National Science Foundation, Department of Energy,
                    and multiple research universities in the US and around the world.
                  </p>
                  <a className="btn btn-success fs-3 mb-3" href="https://docs.pacificresearchplatform.org/userdocs/start/get-access/">Get Access</a>
                  <br />
                  <a className="btn btn-primary fs-3" href="https://docs.pacificresearchplatform.org/admindocs/participating/new-contributor-guide/">Add a server to the NRP</a>


                </div>
              </div>

            </div>
            <div className='col-md-7'>
              <Map />

            </div>
          </div>
        </div>
      </section>
      <section>
        <div className='container'>
          <div className='row'>
            <GPUMetrics />
            <CPUMetrics />
            <NamespaceMetrics />
          </div>
        </div>
      </section>
      <section className='middle-section'>
        <div className="container">
          <div className='row'>
            <div className='col-md-8'>
              <ProjectUsage />
            </div>
          </div>
        </div>
      </section>

      <Footer></Footer>
    </>
  )
}
