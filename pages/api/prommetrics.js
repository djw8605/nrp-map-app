import { PrometheusDriver } from 'prometheus-query';

const prom = new PrometheusDriver({
  endpoint: "https://thanos.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});

export default async function handler(req, res) {
  //console.log(req);
  //console.log(req.url);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = url.searchParams.get('query');

  if (!query) {
    return res.status(400).send('Missing query parameter');
  }

  var pomQuery = ""
  if (query == "gpumetrics") {
    pomQuery = 'count(pod_gpus)';
  } else if (query == "cpumetrics") {
    pomQuery = 'sum(container_spec_cpu_quota{name!~".*prometheus.*", image!="", container_name!="POD"}/container_spec_cpu_period{name!~".*prometheus.*", image!="", container_name!="POD"}) by (pod_name, container_name)';
    //pomQuery = 'sum(kube_node_status_capacity{resource="cpu"})';
  } else if (query == "namespacemetrics") {
    pomQuery = 'count(count by (namespace) (kube_pod_info))'
  }
  const start = new Date().getTime() - 24 * 60 * 60 * 1000;
  const end = new Date();
  const step = 60 * 15;
  prom.rangeQuery(pomQuery, start, end, step);
  const result = await prom.rangeQuery(pomQuery, start, end, step);
  console.log(result.result[0].values);
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({values: result.result[0].values, updateTime: Date.now()});
}