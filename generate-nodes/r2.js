const AWS = require('aws-sdk');

/*
 * Uploads one public JSON object to the `nrp-dashboard` bucket on Cloudflare R2.
 * Shared by generate-nodes.js (nodes.json) and generate-usage.js
 * (usage-by-region.json).
 *
 * Environment: CLOUDFLARE_ID (account id), CLOUDFLARE_ACCESS_KEY,
 * CLOUDFLARE_SECRET_ACCESS_KEY, and optionally R2_PUBLIC_URL for the log line.
 */
async function uploadToR2(key, body) {
  const s3 = new AWS.S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: `https://${process.env.CLOUDFLARE_ID}.r2.cloudflarestorage.com`,
    s3ForcePathStyle: true,
    region: 'auto',
    signatureVersion: 'v4',
  });

  const params = {
    Bucket: 'nrp-dashboard',
    Key: key,
    Body: body,
    ContentType: 'application/json',
    ACL: 'public-read',
  };

  try {
    const result = await s3.upload(params).promise();
    console.log(`Successfully uploaded ${key} to Cloudflare R2:`, result.Location);
    if (process.env.R2_PUBLIC_URL) {
      console.log(`Public URL for ${key}:`, `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`);
    }
    return result;
  } catch (error) {
    console.error(`Error uploading ${key} to Cloudflare R2:`, error);
    throw error;
  }
}

module.exports = { uploadToR2 };
