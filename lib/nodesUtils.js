// Utility function to fetch nodes data for server-side API routes
export async function getNodesData() {
  // For server-side usage, we can fetch from our own API endpoint
  // or directly from R2 if we have the credentials
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
    
  try {
    const response = await fetch(`${baseUrl}/api/nodes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch nodes: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching nodes data:', error);
    throw error;
  }
}

// Alternative: Direct R2 fetch if we have access to environment variables
export async function getNodesDataFromR2() {
  try {
    const r2Url = process.env.NODES_PUBLIC_URL || 'https://dash-api.nrp.ai/nodes.json';
    const response = await fetch(r2Url);
    if (!response.ok) {
      throw new Error(`Failed to fetch nodes from R2: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching nodes from R2:', error);
    throw error;
  }
}