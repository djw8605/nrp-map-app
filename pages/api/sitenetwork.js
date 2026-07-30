import { PrometheusDriver } from 'prometheus-query';
import { getNodesDataFromR2 } from "../../lib/nodesUtils";
import { buildInstanceMatcher, dedupedNodeRate } from "../../lib/networkQuery";

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

    // Match every node at the site, on physical NICs only, with duplicate
    // series for the same node+device collapsed before summing.
    const filter = buildInstanceMatcher(nodes.map((node) => node.name));
    var transmitQuery = `sum(${dedupedNodeRate('node_network_transmit_bytes_total', filter)})`
    var receiveQuery = `sum(${dedupedNodeRate('node_network_receive_bytes_total', filter)})`

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
    // A site with no reporting node-exporter returns no series at all.
    const seriesValues = (result) => (result?.result?.[0]?.values || [])
      .map((point) => ({ 'time': point.time, 'value': point.value }));

    var transmit = seriesValues(results[0]);
    var receive = seriesValues(results[1]);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ transmit: transmit, receive: receive, updateTime: Date.now() });

  } catch (error) {
    console.error('Error in sitenetwork API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

}