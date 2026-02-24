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
    '24h': { label: '1d', ms: 24 * 60 * 60 * 1000, step: 3600 },
    '7d': { label: '7d', ms: 7 * 24 * 60 * 60 * 1000, step: 24 * 3600 },
    '30d': { label: '30d', ms: 30 * 24 * 60 * 60 * 1000, step: 24 * 3600 },
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

    // Use increase to get GPU hours consumed per day, not cumulative
    const query = `sum(increase(namespace_allocated_resources{node=~'${nodeRegex}', resource=~'nvidia_com.*'}[1d]))`;

    // Get the current date
    var end = new Date();
    // Get now minus configured range
    var start = new Date(end.getTime() - rangeConfig.ms);

    var results = await prom.rangeQuery(query, start, end, rangeConfig.step);
    let gpuRegex = /nvidia_com.*/;
    console.log("Site GPUs:");
    //console.log(results);
    var to_return = [];
    console.log(results.result[0].values);
    for (var i = 0; i < results.result[0].values.length; i++) {
      console.log(results.result[0].values[i].time);
      to_return.push({ "time": results.result[0].values[i].time, "value": results.result[0].values[i].value });
      //console.log(results.result[i].metric);
      //console.log(results.result[i].values);
    }
    //let to_return = { "gpuHours": 0, "cpuHours": 0}

    /*
    for (var i = 0; i < results.result.length; i++) {
      console.log(results.result[i].metric.labels.resource);
      if (gpuRegex.test(results.result[i].metric.labels.resource)) {
        to_return["gpuHours"] += parseFloat(results.result[i].value.value);
      } else {
        to_return["cpuHours"] += parseFloat(results.result[i].value.value);
      }
      //results.result[i].value.value = parseFloat(results.result[i].value.value);
    }
    */
    //console.log(to_return);
    console.log(to_return);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(to_return);

  } catch (error) {
    console.error('Error in sitegpus API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

}