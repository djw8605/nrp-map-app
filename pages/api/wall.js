// API endpoint to fetch wall.json from Cloudflare R2. Written by
// generate-nodes/generate-wall.js; see pages/api/usageByRegion.js for the same pattern.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const url = process.env.WALL_PUBLIC_URL || 'https://dash-api.nrp.ai/wall.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch wall.json: ${response.statusText}`);
    }
    const wall = await response.json();

    // The job only republishes every 6 hours.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(wall);
  } catch (error) {
    console.error('Error fetching wall data from Cloudflare R2:', error);
    res.status(500).json({ error: 'Failed to fetch wall data' });
  }
}
