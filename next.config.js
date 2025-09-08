/**
 * Next.js configuration — expose R2 public URL to client via NEXT_PUBLIC_R2_URL.
 * Prefer setting R2_PUBLIC_URL in your environment or CI, Next will expose it
 * to the client as NEXT_PUBLIC_R2_URL at build time.
 */
const nextConfig = {
  reactStrictMode: true,
  // Do NOT expose R2_PUBLIC_URL to the client. Access via process.env.R2_PUBLIC_URL
};

module.exports = nextConfig;
