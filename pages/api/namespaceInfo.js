import jayson from 'jayson';


// Call the NRP portal to get the namespace information and return a promise
async function gatherNamespaces() {

  // Create a promise to return
  return new Promise((resolve, reject) => {


    // Get the namespace information from the NRP portal
    const client = jayson.client.https({
      host: 'portal.nrp-nautilus.io',
      port: 443,
      path: '/rpc',
      withCredentials: true,
    })
    var result2 = null;
    try {
      result2 = client.request('guest.ListNsInfo', [], function (err, error, response) {
        // Catch the error
        if (err) {
          console.log("Rejecting because of err: " + err);
          reject(err);
        }
        
        if (error) {
          console.log("Rejecting because of error: " + error);
          reject(error);
        }

        // Return the namespace information:
        resolve(response);
      });
      //console.log(result2);
    } catch (e) {
      console.log("Rejecting because of exception: " + e);
      reject(e);
    }
  }
  );
}

export default async function handler(req, res) {

  // Get the namespace information from the NRP portal
  var result = null;
  try {
    result = await gatherNamespaces();
  } catch (e) {
    console.log(e);
  }

  // Return the namespace information:
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ values: result, updateTime: Date.now() });


}