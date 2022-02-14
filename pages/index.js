import Head from 'next/head'
import Link from 'next/link'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
import Map from '../components/map'
import SiteList from '../components/sitelist'
import ProjectUsage from '../components/projectusage'
import { Wrapper } from "@googlemaps/react-wrapper";
import LiveMetrics from '../components/livemetrics'

export default function Home() {
  return (
    <>
      <Head>
        <title>GP-ARGO</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <NavBar></NavBar>


      <section className='top-section'>
        <div className="container">
          <div className='row'>
            <div className='col-md-6'>
              <div className='row'>
                <div className='col-md-12'>
                  <h1>
                    The Great Plains Augmented Regional Gateway to the Open Science Grid
                  </h1>
                </div>
              </div>
              <div className='row room-at-top'>
                
                <LiveMetrics />
                <div className='col-md-12 '>
                  <h3 className='text-center'>
                    Resources contributed to the <a href="https://opensciencegrid.org">Open Science Grid</a>
                  </h3>
                </div>
              </div>
            </div>
            <div className='col-md-6'>
              <Wrapper apiKey={process.env.NEXT_PUBLIC_MAPS_KEY}>
                <Map />
              </Wrapper>

            </div>
          </div>
        </div>
      </section>
      <section className='middle-section'>
        <div className="container">
          <div className='row'>
            <div className='col-md-4'>
              <SiteList />
            </div>
            <div className='col-md-4'>
              <ProjectUsage />
            </div>
            <div className='col-md-4'>
              <div className='embed-responsive embed-responsive-16by9'>
              <iframe className='embed-responsive-item' src="https://gracc.opensciencegrid.org/d-solo/000000079/site-summary?orgId=1&var-interval=7d&var-site=GP-ARGO&var-type=Batch&panelId=22&from=now-6M&to=now" width="100%" height="250" frameBorder="1"></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer></Footer>
    </>
  )
}
