import '../styles.css'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import 'mapbox-gl/dist/mapbox-gl.css';
//config.autoAddCss = false

//import store from '../redux/store.js';
//import { Provider } from 'react-redux'

import '../styles/globals.css'
import PrometheusErrorToastHost from '../components/prometheusErrorToastHost'


function MyApp({ Component, pageProps }) {
  /*
      <Provider store={store}>
      
    </Provider>
    */
  return (
    <>
      <PrometheusErrorToastHost />
      <Component {...pageProps} />
    </>
  );
}


export default MyApp