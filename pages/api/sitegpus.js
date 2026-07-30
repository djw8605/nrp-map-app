/*
 * Daily GPU-hours trend for one site, from the NRP accounting service.
 *
 * The Thanos version of this bucketed `namespace_allocated_resources` into
 * hourly points. Accounting data is daily, so this returns one point per UTC
 * day over the requested window instead. Days the site ran nothing produce no
 * row upstream, so they are zero-filled here to keep the bar chart contiguous.
 */
import { getSiteNodeNames } from "../../lib/nodesUtils";
import { addDays, callAccountingTool, resolveRangeWindow } from "../../lib/accountingApi";

export default async function handler(req, res) {

  // Get the site from the request
  const site = req.query.site;
  const range = req.query.range || '30d';
  if (!site) {
    return res.status(400).send('Missing site parameter');
  }

  try {
    const nodes = await getSiteNodeNames(site);

    if (!nodes) {
      return res.status(404).send('Site not found');
    }

    const window = await resolveRangeWindow(range);

    let usageByDate = new Map();
    if (nodes.length > 0) {
      const result = await callAccountingTool('query_resource_usage', {
        start_date: window.start,
        end_date: window.end,
        node: nodes,
        resource: 'gpu',
        group_by: ['date'],
        limit: Math.max(window.days, 1),
      });

      for (const row of result?.rows || []) {
        usageByDate.set(row.date, parseFloat(row.usage) || 0);
      }
    }

    const to_return = [];
    for (let day = window.start; day <= window.end; day = addDays(day, 1)) {
      to_return.push({ time: day, value: usageByDate.get(day) || 0 });
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(to_return);

  } catch (error) {
    console.error('Error in sitegpus API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }

}
