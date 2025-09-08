// API endpoint to fetch nodes.json from Cloudflare R2
export default async function handler(req, res) {
  try {
    // Fetch nodes.json from Cloudflare R2 public URL
    // The exact URL format depends on your R2 bucket configuration
    // This assumes a public bucket with custom domain or the default R2.dev format
    const r2Url = process.env.R2_PUBLIC_URL || 'https://nrp-dashboard.r2.dev/nodes.json';
    
    const response = await fetch(r2Url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch nodes.json: ${response.statusText}`);
    }
    
    const nodes = await response.json();
    
    // Cache the response for 5 minutes to avoid excessive R2 calls
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(nodes);
    
  } catch (error) {
    console.error('Error fetching nodes from Cloudflare R2:', error);
    res.status(500).json({ error: 'Failed to fetch nodes data' });
  }
}