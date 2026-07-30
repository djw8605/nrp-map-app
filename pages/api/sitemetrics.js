/*
 * GPU and CPU hours for one site, from the NRP accounting service.
 *
 * This used to run a `sum_over_time(namespace_allocated_resources{node=~...})`
 * against Thanos with every node at the site in one regex. The accounting
 * service already computes the same hours daily from 5-minute samples, so we
 * ask it instead: one call for the current window, one for the window before it
 * to drive the delta badge.
 *
 * The response keeps the `gpuHours`/`cpuHours`/`prevGpuHours`/`prevCpuHours`
 * shape the panel already reads, and adds the resolved date window so the UI
 * can label what it is actually showing.
 */
import { getSiteNodeNames } from "../../lib/nodesUtils";
import { fetchNodeResourceHours, resolveRangeWindow } from "../../lib/accountingApi";

export default async function handler(req, res) {

  // Get the site from the request
  const site = req.query.site;
  const range = req.query.range || '7d';
  if (!site) {
    return res.status(400).send('Missing site parameter');
  }

  try {
    const nodes = await getSiteNodeNames(site);

    if (!nodes) {
      return res.status(404).send('Site not found');
    }

    // A site with no nodes has no usage to account for; skip the round trips.
    if (nodes.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        gpuHours: 0,
        cpuHours: 0,
        prevGpuHours: 0,
        prevCpuHours: 0,
      });
    }

    const window = await resolveRangeWindow(range);
    const [current, previous] = await Promise.all([
      fetchNodeResourceHours(nodes, window.start, window.end),
      fetchNodeResourceHours(nodes, window.prevStart, window.prevEnd),
    ]);

    const to_return = {
      gpuHours: current.gpuHours,
      cpuHours: current.cpuHours,
      prevGpuHours: previous.gpuHours,
      prevCpuHours: previous.cpuHours,
      days: window.days,
      startDate: window.start,
      endDate: window.end,
    };

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(to_return);

  } catch (error) {
    console.error('Error in sitemetrics API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }

}
