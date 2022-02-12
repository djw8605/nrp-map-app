import 'bootstrap/dist/css/bootstrap.css'; // Add this line
import '../styles.css'

//import '../styles/globals.css'

import { useEffect } from "react";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap");
  }, []);
  return <Component {...pageProps} />
}


export default MyApp