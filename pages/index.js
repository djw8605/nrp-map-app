import Head from 'next/head'
import Link from 'next/link'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
import Map from '../components/map'
import SiteList from '../components/sitelist'
import ProjectUsage from '../components/projectusage'
import { Wrapper } from "@googlemaps/react-wrapper";

export default function Home() {
  return (
    <>
      <Head>
        <title>GP-ARGO</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <NavBar></NavBar>
      <div className="container">


        <div className='row'>
          <div className='col-md-8'>
            <Wrapper apiKey={process.env.NEXT_PUBLIC_MAPS_KEY}>
              <Map />
            </Wrapper>

          </div>
          <div className='col-md-4'>
            <div className='row'>
              <div className='col-md-12'>
                <SiteList />
              </div>
            </div>
          </div>
          <hr className='hr-aftermap' />
          <h1 class="display-6">OSG Usage of the Regional Gateway</h1>
          <div className='row'>
            <div className='col-md-4'>
              <ProjectUsage />
            </div>
            <div className='col-md-4'>
            <iframe src="https://gracc.opensciencegrid.org/d-solo/000000079/site-summary?orgId=1&var-interval=7d&var-site=GP-ARGO&var-type=Batch&panelId=22&from=now-6M&to=now" width="450" height="200" frameborder="0"></iframe>
            </div>
          </div>
        </div>
      </div>
      <Footer></Footer>
      <style jsx>{`
        hr.hr-aftermap {
          border: 0;
          height: 3px;
          background: #333;
          background-image: linear-gradient(to right, #ccc, #333, #ccc);
          margin-top: 0.2em;
          margin-bottom: 0.2em;
        }
      `}</style>
    </>
  )
}
