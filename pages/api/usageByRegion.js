// API endpoint to fetch usage-by-region.json from Cloudflare R2. Written by
// generate-nodes/generate-usage.js; see pages/api/nodes.js for the same pattern.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const url = process.env.USAGE_PUBLIC_URL || 'https://dash-api.nrp.ai/usage-by-region.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch usage-by-region.json: ${response.statusText}`);
    }
    const usage = await response.json();

    // The job only republishes every 6 hours.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(usage);
  } catch (error) {
    console.error('Error fetching usage from Cloudflare R2:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
}
