Node Generation Service
======================

This service generates the nodes.json file by fetching data from Kubernetes and Netbox, then uploads it to Cloudflare R2 storage.

It also runs `generate-usage.js`, which publishes `usage-by-region.json`: every US
state and country home to an institution that used NRP in the last three years,
with the institutions in each (and their CPU, GPU and LLM totals, for future use).

- Usage comes from the public accounting API
  (`https://nrp-accounting-mcp.nrp-nautilus.io/openapi`, override with
  `ACCOUNTING_API_URL`). No token is needed.
- Each institution is placed in a region by, in order: `institution-overrides.json`,
  the previously published file (`USAGE_PUBLIC_URL`, only ROR matches are reused),
  then the ROR affiliation API. Anything left is listed under `unmapped` in the
  output and in the job log — add an override for it.
- `node generate-usage.js --dry-run` writes `./usage-by-region.json` instead of
  uploading. `npm test` runs the unit tests for `usage-lib.js`.

## Requirements

1. Netbox API token (read-only)
2. Kubernetes cluster access with permissions to list nodes
3. Cloudflare R2 credentials:
   - Account ID (CLOUDFLARE_ID)
   - Access Key ID (CLOUDFLARE_ACCESS_KEY) 
   - Secret Access Key (CLOUDFLARE_SECRET_ACCESS_KEY)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
export NETBOX_TOKEN=your_token_here
export CLOUDFLARE_ID=your_account_id
export CLOUDFLARE_ACCESS_KEY=your_access_key
export CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
```

3. Run the script:
```bash
node generate-nodes.js
```

## Kubernetes Deployment

### Using Kustomize (Recommended)

1. Create secrets file:
```bash
cp k8s/secrets.env.example k8s/secrets.env
# Edit with your actual credentials
```

2. Deploy:
```bash
kubectl apply -k k8s/
```

### Manual Deployment

1. Build and push Docker image:
```bash
docker build -t your-registry/generate-nodes:latest .
docker push your-registry/generate-nodes:latest
```

2. Update the image reference in `k8s/cronjob.yaml`

3. Create the secret:
```bash
kubectl create secret generic generate-nodes-secrets \
  --from-literal=NETBOX_TOKEN=your_token \
  --from-literal=CLOUDFLARE_ID=your_account_id \
  --from-literal=CLOUDFLARE_ACCESS_KEY=your_access_key \
  --from-literal=CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
```

4. Apply the manifests:
```bash
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/cronjob.yaml
```

## Output

The script uploads a `nodes.json` file to the `nrp-dashboard` bucket in Cloudflare R2 storage. The file contains an array of site objects with their associated compute nodes.



