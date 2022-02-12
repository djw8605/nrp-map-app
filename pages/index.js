import Head from 'next/head'
import Link from 'next/link'
import Footer from '../components/footer'
import NavBar from '../components/navbar'
import Map from '../components/map'
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
        </div>

      

      </div>
      <Footer></Footer>
    </>
  )
}
