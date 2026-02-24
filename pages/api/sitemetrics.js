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
    '24h': { label: '1d', ms: 24 * 60 * 60 * 1000 },
    '7d': { label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
    '30d': { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
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
    var nodeRegex = nodes.reduce((acc, val) => acc + "|" + val.name, "").substring(1);
    
    const query = `sum by (resource) (sum_over_time(namespace_allocated_resources{node=~'${nodeRegex}', resource=~'nvidia_com.*|cpu'}[${rangeConfig.label}:1h]))`;
    var multiResults = await Promise.all([
      prom.instantQuery(query),
      prom.instantQuery(query, new Date(new Date().getTime() - rangeConfig.ms))
    ])
    
    var results = multiResults[0];
    var prevResults = multiResults[1];
    let gpuRegex = /nvidia_com.*/;
    let to_return = { 
      "gpuHours": 0,
      "cpuHours": 0,
      "prevGpuHours": 0,
      "prevCpuHours": 0,
    }
    for (var i = 0; i < results.result.length; i++) {
      console.log(results.result[i].metric.labels.resource);
      if (gpuRegex.test(results.result[i].metric.labels.resource)) {
        to_return["gpuHours"] += parseFloat(results.result[i].value.value);
      } else {
        to_return["cpuHours"] += parseFloat(results.result[i].value.value);
      }
    }

    for (var i = 0; i < prevResults.result.length; i++) {
      console.log(prevResults.result[i].metric.labels.resource);
      if (gpuRegex.test(prevResults.result[i].metric.labels.resource)) {
        to_return["prevGpuHours"] += parseFloat(prevResults.result[i].value.value);
      } else {
        to_return["prevCpuHours"] += parseFloat(prevResults.result[i].value.value);
      }
    }
    //console.log(to_return);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(to_return);

  } catch (error) {
    console.error('Error in sitemetrics API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

}