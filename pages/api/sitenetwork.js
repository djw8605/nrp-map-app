import { PrometheusDriver } from 'prometheus-query';
import { getNodesDataFromR2 } from "../../lib/nodesUtils";

const prom = new PrometheusDriver({
  endpoint: "https://thanos.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});


export default async function handler(req, res) {

  // Get the site from the request
  const site = req.query.site;
  const range = req.query.range || '24h';
  if (!site) {
    return res.status(400).send('Missing site parameter');
  }
  const rangeMap = {
    '24h': { ms: 24 * 60 * 60 * 1000, step: 1800 },
    '7d': { ms: 7 * 24 * 60 * 60 * 1000, step: 3600 * 3 },
    '30d': { ms: 30 * 24 * 60 * 60 * 1000, step: 3600 * 12 },
  };
  const rangeConfig = rangeMap[range] || rangeMap['24h'];

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

    // Start date is now - configured range
    let startDate = new Date();
    startDate.setTime(startDate.getTime() - rangeConfig.ms);
    // End date is now
    let endDate = new Date();
    var results = await Promise.all([
      prom.rangeQuery(transmitQuery, startDate, endDate, rangeConfig.step),
      prom.rangeQuery(receiveQuery, startDate, endDate, rangeConfig.step)
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