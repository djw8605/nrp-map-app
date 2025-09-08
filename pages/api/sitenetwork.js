import { PrometheusDriver } from 'prometheus-query';
import { getNodesDataFromR2 } from "../../lib/nodesUtils";

const prom = new PrometheusDriver({
  endpoint: "https://prometheus.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});


export default async function handler(req, res) {

  // Get the site from the request
  const site = req.query.site;
  if (!site) {
    return res.status(400).send('Missing site parameter');
  }

  try {
    // Fetch nodes data from R2
    const Nodes = await getNodesDataFromR2();

    // Get the sites
    let nodes;
    for (var i = 0; i < Nodes.length; i++) {
      if (Nodes[i].slug == site) {
        nodes = Nodes[i].nodes;
        break;
      }
    }

    if (!nodes) {
      return res.status(404).send('Site not found');
    }

    // Combine all node names into a regex
    var nodeRegex = nodes.reduce((acc, val) => acc + "|" + val.name, "").substring(1);
    //console.log(nodeRegex);
    var transmitQuery = `sum(rate(node_network_transmit_bytes_total{instance=~"${nodeRegex}", device=~"en.*|et.*"}[5m]))`
    var receiveQuery = `sum(rate(node_network_receive_bytes_total{instance=~"${nodeRegex}", device=~"en.*|et.*"}[5m]))`

    //console.log(transmitQuery);
    //console.log(receiveQuery);
    // Start date is now - 24 hours
    let startDate = new Date();
    // Subtract 1 day
    startDate.setDate(startDate.getDate() - 1);
    // End date is now
    let endDate = new Date();
    var results = await Promise.all([
      prom.rangeQuery(transmitQuery, startDate, endDate, 1800),
      prom.rangeQuery(receiveQuery, startDate, endDate, 1800)
    ]);

    /*
    console.log("Network results");
    console.log(results[0].result[0].values);
    */
    var transmit = []
    for (var i = 0; i < results[0].result[0].values.length; i++) {
      transmit.push({'time': results[0].result[0].values[i].time, 'value': results[0].result[0].values[i].value});
    }
    var receive = []
    for (var i = 0; i < results[1].result[0].values.length; i++) {
      receive.push({'time': results[1].result[0].values[i].time, 'value': results[1].result[0].values[i].value});
    }

    console.log("Network Trasnmit:");
    console.log(transmit);
    console.log("Network Receive:");
    console.log(receive);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ transmit: transmit, receive: receive, updateTime: Date.now() });

  } catch (error) {
    console.error('Error in sitenetwork API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

}