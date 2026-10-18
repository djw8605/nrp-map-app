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
- A run that maps fewer than half as many institutions as the previously
  published file exits non-zero without publishing; the log shows both counts.

### Rollout

The CronJob runs `generate-usage.js` only once its manifest is re-applied, so
after this change lands:

1. Merge to `main` (the job clones the repository on every run).
2. Re-apply the manifests: `kubectl apply -k generate-nodes/k8s/` (needs
   `k8s/secrets.env`), or just `kubectl apply -f generate-nodes/k8s/cronjob.yaml`.
3. Publish once without waiting for the schedule:
   `kubectl create job --from=cronjob/generate-nodes usage-first-run`.
4. Confirm `https://dash-api.nrp.ai/usage-by-region.json` is served.

Until the file is published, the dashboard's Usage view shows "Usage data
unavailable"; the Contributors view is unaffected.

### Live wall (`generate-wall.js`)

`generate-wall.js` publishes `wall.json` for the `/wall` kiosk page: one day of GPU
work, by the researcher's institution and by the campus whose GPUs ran it, with
both sides placed on the map.

- Data: the same accounting API, for its `latest_data_date`.
  `query_resource_usage` with `resource: "gpu"` grouped by `institution` (the
  researcher's home) and `node_institution` (the campus hosting the hardware),
  and `query_llm_token_usage` grouped by `model`, summed. A result that reaches
  the 5000-row limit fails the run.
- Both sides of every pair are placed the way `generate-usage.js` places
  institutions: `institution-overrides.json`, then the published
  `usage-by-region.json`, then ROR. A host still unplaced takes its Netbox
  coordinates from the published `nodes.json` (`NODES_PUBLIC_URL`) when every
  site matching its name is within 50 miles of the others. Anything left is
  listed under `unmapped` and in the job log; add an override for it.
- Pairs under 10 miles apart are local work: in the totals, never a flow. That
  covers one campus under two names ("University of California San Diego" as the
  user, "University of California, San Diego" as the host), which ROR places on
  the same city point.
- `WALL_HOME_INSTITUTION` names the "you are here" institution (default
  `University of Nebraska–Lincoln`).
- `node generate-wall.js --dry-run` writes `./wall.json` instead of uploading.
  `npm test` also runs the unit tests for `wall-lib.js`.
- A run whose total GPU hours is 0, or that places no flow, exits non-zero
  without publishing.

#### `wall.json`

```json
{
  "generated_at": "2026-10-18T06:00:00.000Z",
  "day": "2026-10-17",
  "totals": {
    "gpu_hours": 22507.58, "gpu_years": 2.569, "away_share": 0.7371,
    "host_sites": 41, "user_institutions": 37,
    "llm_tokens": 4621581990, "llm_novels": 38513.2
  },
  "home": { "institution": "University of Nebraska–Lincoln", "served_hours": 3205.17, "partner_count": 19 },
  "sites": [
    { "name": "University of California, San Diego", "place": "San Diego, CA", "lat": 32.71571, "lng": -117.16472, "hosted_hours": 7753.17 }
  ],
  "flows": [
    {
      "from": "University of California San Diego", "to": "Massachusetts Green High Performance Computing Center",
      "gpu_hours": 1612.92, "miles": 2499,
      "from_lat": 32.71571, "from_lng": -117.16472, "to_lat": 42.20426, "to_lng": -72.6162
    }
  ],
  "unmapped": [{ "name": "The Open Force Field Consortium", "side": "user", "gpu_hours": 72.25 }]
}
```

| Field | Meaning |
|---|---|
| `day` | The accounting API's `latest_data_date`; every number is for that one day. |
| `totals.gpu_hours` | All GPU hours that day, including local work and pairs that could not be placed. |
| `totals.gpu_years` | `gpu_hours / 8760`: one GPU running nonstop for this many years. |
| `totals.away_share` | Of the hours whose two sides are both placed, the share run 10 or more miles from the researcher's institution. |
| `totals.host_sites`, `totals.user_institutions` | Distinct hosting campuses and researcher institutions, placed or not. |
| `totals.llm_tokens`, `totals.llm_novels` | LLM tokens that day, and `llm_tokens / 120000` (about one novel each). |
| `home.served_hours`, `home.partner_count` | GPU hours the home campus hosted for other institutions, and how many there were. A user counts as home if its name matches or it is placed within 10 miles of home. |
| `sites[]` | Placed host campuses, by `hosted_hours` (all work run there). `place` is "City, ST" or "City, Country" from ROR, a region name for an override, or null for a Netbox match. |
| `flows[]` | Placed pairs 10 or more miles apart, by `gpu_hours`. `miles` is great-circle. `from_*`/`to_*` are the two ends' coordinates, so a user campus that hosts nothing can still be drawn. |
| `unmapped[]` | Each name and side that could not be placed, by GPU hours. |

Hours are rounded to two decimals; `lat`/`lng` are as resolved.

#### Rollout

The CronJob runs `generate-wall.js` only once its manifest is re-applied, so
after this change lands:

1. Merge to `main` (the job clones the repository on every run).
2. Re-apply the manifests: `kubectl apply -k generate-nodes/k8s/` (needs
   `k8s/secrets.env`), or just `kubectl apply -f generate-nodes/k8s/cronjob.yaml`.
3. Publish once without waiting for the schedule:
   `kubectl create job --from=cronjob/generate-nodes wall-first-run`, and read
   its log for the `unmapped` list.
4. Confirm `https://dash-api.nrp.ai/wall.json` is served.
5. Open `/wall` on the office screen in a full-screen (kiosk) browser.

Until the file is published, `/wall` shows "Live data is unavailable right now.";
nothing else on the dashboard depends on it.

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



