/*
 * Per-namespace GPU and CPU usage, from the NRP accounting service.
 *
 * This used to report instantaneous allocation: GPUs currently carrying a DCGM
 * reading, and CPU requests on running containers. The accounting service deals
 * in whole days, so this reports GPU-hours and CPU core-hours over a date
 * window instead — hence the renamed `gpuHours`/`cpuHours` keys, which are a
 * different quantity from the counts this returned before.
 */
import { callAccountingTool, resolveRangeWindow } from '../../lib/accountingApi';

export default async function handler(req, res) {
  const range = req.query.range || '7d';

  try {
    const window = await resolveRangeWindow(range);
    const result = await callAccountingTool('query_resource_usage', {
      start_date: window.start,
      end_date: window.end,
      resource: ['gpu', 'cpu'],
      group_by: ['namespace', 'resource'],
      limit: 5000,
    });

    const combined = {};
    for (const row of result?.rows || []) {
      const entry = combined[row.namespace] || (combined[row.namespace] = { gpuHours: 0, cpuHours: 0 });
      const usage = parseFloat(row.usage) || 0;
      if (row.resource === 'gpu') {
        entry.gpuHours += usage;
      } else if (row.resource === 'cpu') {
        entry.cpuHours += usage;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      values: combined,
      startDate: window.start,
      endDate: window.end,
      updateTime: Date.now(),
    });
  } catch (error) {
    console.error('Error in namespaceUsage API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
