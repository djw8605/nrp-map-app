NRP Dashboard
=============

The NRP Dashboard provides a visualization of the National Research Platform infrastructure, showing compute nodes across multiple sites.

## Architecture

The application consists of two main components:

1. **Next.js Website** - Main dashboard application hosted on Vercel
2. **Node Generator** - Kubernetes CronJob that generates node data and uploads to Cloudflare R2

## Website

Using Next.js and hosted on Vercel. The website fetches node data from Cloudflare R2 storage.

### Local Development

```bash
npm install
npm run dev
```

## Node Generation

The `generate-nodes` directory contains a Node.js script that:
- Fetches node information from Kubernetes API
- Downloads site information from Netbox
- Generates a consolidated nodes.json file
- Uploads the data to Cloudflare R2 storage

### Kubernetes Deployment

The node generator runs as a Kubernetes CronJob every 6 hours.

#### Prerequisites

1. Netbox API token (read-only)
2. Cloudflare R2 credentials:
   - Account ID (CLOUDFLARE_ID)
   - Access Key ID (CLOUDFLARE_ACCESS_KEY)
   - Secret Access Key (CLOUDFLARE_SECRET_ACCESS_KEY)

#### Deployment Steps

1. Navigate to the generate-nodes directory:
```bash
cd generate-nodes
```

2. Build the Docker image:
```bash
docker build -t generate-nodes:latest .
```

3. Create secrets file:
```bash
cp k8s/secrets.env.example k8s/secrets.env
# Edit k8s/secrets.env with your actual credentials
```

4. Deploy using Kustomize:
```bash
kubectl apply -k k8s/
```

#### Resources

The CronJob is configured with:
- CPU: 1 core (1000m)
- Memory: 4GB
- Schedule: Every 6 hours (`0 */6 * * *`)

#### Permissions

The deployment includes RBAC configuration:
- ServiceAccount: `generate-nodes`
- ClusterRole: Read access to nodes
- ClusterRoleBinding: Binds the role to the service account

## Environment Variables

### Website (Next.js)
- `R2_PUBLIC_URL` - Public URL for the Cloudflare R2 bucket (optional, defaults to `https://nrp-dashboard.r2.dev/nodes.json`)

### Node Generator (Kubernetes)
- `NETBOX_TOKEN` - Netbox API token
- `CLOUDFLARE_ID` - Cloudflare account ID
- `CLOUDFLARE_ACCESS_KEY` - Cloudflare R2 access key ID
- `CLOUDFLARE_SECRET_ACCESS_KEY` - Cloudflare R2 secret access key

