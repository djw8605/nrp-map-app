/*
 * Front-page cluster metrics, from the NRP accounting service.
 *
 * These three series used to be instantaneous Prometheus counts sampled hourly
 * over 24h: GPUs carrying a DCGM temperature reading, running `jupyter-*` pods,
 * and namespaces with a GPU. The accounting service only keeps whole days, so
 * each one becomes its daily equivalent over a multi-day window:
 *
 * - `gpus`: GPU-hours / 24, i.e. the time-weighted average number of GPUs
 *   allocated across the day rather than a reading at one instant.
 * - `jupyter_pods`: distinct `jupyter-*` pods that ran at some point that day.
 * - `gpu_namespaces`: namespaces with any GPU usage that day.
 *
 * GPU-hours come back for the whole window in one call. The two counts are
 * distinct-counts, which the API only answers a day at a time, so those fan out
 * one request per day behind a concurrency limit.
 *
 * The route keeps its `?query=clustermetrics` shape, but `date` is now a
 * `YYYY-MM-DD` calendar day instead of a Unix timestamp.
 */
import {
  callAccountingTool,
  eachDay,
  mapWithConcurrency,
  resolveRangeWindow,
} from '../../lib/accountingApi';

const HOURS_PER_DAY = 24;

async function gpuHoursByDate(window) {
  const result = await callAccountingTool('query_resource_usage', {
    start_date: window.start,
    end_date: window.end,
    resource: 'gpu',
    group_by: ['date'],
    limit: Math.max(window.days, 1),
  });

  const byDate = new Map();
  for (const row of result?.rows || []) {
    byDate.set(row.date, parseFloat(row.usage) || 0);
  }
  return byDate;
}

/*
 * `list_*` tools answer with `total_count`, the size of the full match set,
 * which is the number we want. `limit: 1` keeps them from also shipping back
 * every value to get there.
 */
async function countGpuNamespaces(day) {
  const result = await callAccountingTool('list_active_namespaces', {
    start_date: day,
    end_date: day,
    resource: 'gpu',
    limit: 1,
  });
  return result?.total_count || 0;
}

async function countJupyterPods(day) {
  const result = await callAccountingTool('list_filter_values', {
    dimension: 'pod_name',
    granularity: 'pod',
    prefix: 'jupyter-',
    start_date: day,
    end_date: day,
    limit: 1,
  });
  return result?.total_count || 0;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = url.searchParams.get('query');

  if (!query) {
    return res.status(400).send('Missing query parameter');
  }

  if (query !== 'clustermetrics') {
    return res.status(400).json({
      error: `Unsupported query '${query}'. This route serves 'clustermetrics'.`,
    });
  }

  try {
    const window = await resolveRangeWindow(url.searchParams.get('range') || '30d');
    const days = eachDay(window.start, window.end);

    const [gpuHours, namespaceCounts, jupyterCounts] = await Promise.all([
      gpuHoursByDate(window),
      mapWithConcurrency(days, countGpuNamespaces),
      mapWithConcurrency(days, countJupyterPods),
    ]);

    const values = days.map((day, index) => ({
      date: day,
      gpus: (gpuHours.get(day) || 0) / HOURS_PER_DAY,
      jupyter_pods: jupyterCounts[index],
      gpu_namespaces: namespaceCounts[index],
    }));

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ values, updateTime: Date.now() });
  } catch (error) {
    console.error('Error in prommetrics API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
