import { PrometheusDriver } from 'prometheus-query';
import Nodes from "../../data/nodes.json"

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

  // Get the sites
  for (var i = 0; i < Nodes.length; i++) {
    if (Nodes[i].slug == site) {
      var nodes = Nodes[i].nodes;
      break;
    }
  }

  // Combine all node names into a regex
  var nodeRegex = nodes.reduce((acc, val) => acc + "|" + val.name, "").substring(1);

  const query = `sum(sum_over_time(namespace_allocated_resources{node=~'${nodeRegex}', resource=~'nvidia_com.*'}[1d:1h]))`;
  var results = await prom.instantQuery(query);

  // Get the current date
  var end = new Date();
  // Get now minus 7 days
  var start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);


  var results = await prom.rangeQuery(query, start, end, 24*3600);
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

}