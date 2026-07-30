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

### Merging nearby sites (preview)

Several institutions register more than one Netbox site inside one campus or one
carrier hotel, so at overview zoom their pins draw on top of each other and only
the last one painted is clickable. `lib/siteClusters.js` merges sites within a
radius into a single pin that carries a count, while keeping every member site
intact so the overlay panel and the hover card can still name them, count their
nodes and GPUs separately, and fetch each one's live metrics.

The radius is a **ceiling**, not a fixed distance. Merging only exists to stop
pins from covering each other, so the working radius shrinks with the zoom
(`clusterRadiusForZoom`): a group comes apart into individual pins — furthest
member first — as soon as its members are more than ~48px apart on screen, and
is fully separated by the time a drill-in lands at zoom 16.5. The panel keeps
describing the whole location either way, so clicking a pin that split out of
the open group re-aims the camera without discarding the member list.

`/` and `/map` pass `clusterRadiusKm={DEFAULT_CLUSTER_RADIUS_KM}` (2 km).
`NodeMap` defaults the prop to `0`, which disables merging entirely.

Review it at **`/cluster-test`** — a harness with a radius slider, live or fixture
sites, a per-zoom pin-count breakdown, the panel and hover card rendered outside
the map (so they can be judged without a Mapbox token), and the assertions from
`lib/siteClusters.checks.js` running in the page.

### CORS

The API route `/api/nodes` enables permissive CORS to allow access from any origin. This supports external sites embedding or fetching node data directly. Preflight `OPTIONS` requests are handled and the following headers are returned on requests to this route:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

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

