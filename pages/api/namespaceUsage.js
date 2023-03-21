import { PrometheusDriver } from 'prometheus-query';

const prom = new PrometheusDriver({
  endpoint: "https://prometheus.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});


export default async function handler(req, res) {



  var gpuQuery = "count by (exported_namespace) (DCGM_FI_DEV_GPU_TEMP{exported_namespace!=\"\"})"
  var cpuQuery = "sum by (namespace) (sum by(container, pod, namespace) (kube_pod_container_resource_requests{resource=\"cpu\"})  * on(container, pod, namespace) group_right kube_pod_container_status_running)"

  var results = await Promise.all([
    prom.instantQuery(cpuQuery),
    prom.instantQuery(gpuQuery)
  ]);

  // Combine the results on the namespace
  var combined = {};
  for (var i = 0; i < results[0].result.length; i++) {
    var ns = results[0].result[i].metric.labels.namespace;
    var cpu = results[0].result[i].value.value;
    var gpu = 0;
    for (var j = 0; j < results[1].result.length; j++) {
      if (results[1].result[j].metric.labels.exported_namespace == ns) {
        gpu = results[1].result[j].value.value;
        break;
      }
    }
    combined[ns] = {gpu: gpu, cpu: cpu};
  }

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ values: combined, updateTime: Date.now() });


}