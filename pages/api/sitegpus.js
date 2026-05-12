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
  const range = req.query.range || '7d';
  if (!site) {
    return res.status(400).send('Missing site parameter');
  }
  const rangeMap = {
    '24h': { bucket: '1h', ms: 24 * 60 * 60 * 1000, step: 3600 },
    '7d': { bucket: '1d', ms: 7 * 24 * 60 * 60 * 1000, step: 24 * 3600 },
    '30d': { bucket: '1d', ms: 30 * 24 * 60 * 60 * 1000, step: 24 * 3600 },
  };
  const rangeConfig = rangeMap[range] || rangeMap['7d'];

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
    var nodeRegex = nodes
      .map((node) => node.name.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'))
      .join('|');

    const query = `sum(sum_over_time(namespace_allocated_resources{node=~'${nodeRegex}', resource=~'nvidia_com.*'}[${rangeConfig.bucket}:1h]))`;

    // Get the current date
    var end = new Date();
    // Get now minus configured range
    var start = new Date(end.getTime() - rangeConfig.ms);

    var results = await prom.rangeQuery(query, start, end, rangeConfig.step);
    var to_return = [];
    if (results.result.length > 0) {
      for (var i = 0; i < results.result[0].values.length; i++) {
        to_return.push({ "time": results.result[0].values[i].time, "value": results.result[0].values[i].value });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(to_return);

  } catch (error) {
    console.error('Error in sitegpus API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

}
