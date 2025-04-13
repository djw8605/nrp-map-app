import { PrometheusDriver } from 'prometheus-query';
import jayson from 'jayson';

const prom = new PrometheusDriver({
  endpoint: "https://prometheus.nrp-nautilus.io/",
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
    pomQuery = ' count (DCGM_FI_DEV_GPU_TEMP{namespace!=""} * on (namespace, pod) group_left(node) node_namespace_pod:kube_pod_info:)';
  } else if (query == "numpods") {
    pomQuery = 'count(kube_pod_info)';
    //pomQuery = 'sum(kube_node_status_capacity{resource="cpu"})';
  } else if (query == "namespacemetrics") {
    pomQuery = 'count(count by (namespace) (kube_pod_info))'
  } else if (query == "clustermetrics") {
    pomQuery = `
      label_replace(count(kube_pod_info{pod=~"jupyter-.*"}), "type", "jupyter_pods", "", "")
      or
      label_replace(count(count by (namespace) (DCGM_FI_DEV_GPU_TEMP{namespace!="gpu-mon"})), "type", "gpu_namespaces", "", "")
      or
      label_replace(count (DCGM_FI_DEV_GPU_TEMP{namespace!="gpu-mon"} * on (namespace, pod) group_left(node) max by (namespace, pod, node) (node_namespace_pod:kube_pod_info:)), "type", "gpus", "", "")
    `
  }

  
  
  const now = new Date();
  // Round now to the nearest hour, rounding down
  now.setSeconds(0);
  now.setMilliseconds(0);
  now.setMinutes(0);
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);  // 7 days ago
  const end = now;
  const step = 60 * 60; // 1 day

  //prom.rangeQuery(pomQuery, start, end, step);
  var result = null;
  console.log("Querying Prometheus with query: " + pomQuery);
  console.log("Start: " + start);
  console.log("End: " + end);
  console.log("Step: " + step);
  try {
    result = await prom.rangeQuery(pomQuery, start, end, step);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: e })
  }
  if (query == "clustermetrics") {
    console.log(result);
  }

  var total_pods;
  var namespaces;
  var gpus;

  for (let j = 0; j < result.result.length; j++) {
    console.log(result.result[j]);
    console.log(result.result[j].metric);
    console.log(result.result[j].metric.labels.type);
    if (result.result[j].metric.labels.type == "jupyter_pods") {
      total_pods = result.result[j].values;
    } else if (result.result[j].metric.labels.type == "gpu_namespaces") {
      namespaces = result.result[j].values;
    } else if (result.result[j].metric.labels.type == "gpus") {
      gpus = result.result[j].values;
    }
  }

  // Merge the 3 results into a single array
  const mergedResults = [];
  for (let i = 0; i < gpus.length; i++) {

    mergedResults.push({
      date: new Date(gpus[i].time).getTime() / 1000,
      gpus: gpus[i].value,
      jupyter_pods: total_pods[i].value,
      gpu_namespaces: namespaces[i].value
    });
  }
    
  console.log(mergedResults);
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ values: mergedResults, updateTime: Date.now() });
}