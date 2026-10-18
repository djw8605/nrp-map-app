# NRP Live Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen `/wall` page that explains the NRP in plain words and animates one day of real GPU work moving from researchers' campuses to the campuses whose GPUs ran it.

**Architecture:** `generate-nodes/generate-wall.js` runs after `generate-usage.js` in the existing CronJob, reads one day from the public accounting API, places both sides of every (user, host) pair with `usage-lib`'s resolver (plus a Netbox fallback for hosts) and uploads `wall.json` to R2. The dashboard proxies it through `/api/wall`; `/wall` draws a static Albers USA outline as SVG and the dots, arcs and particles on a canvas above it.

**Tech Stack:** Node 18 (CronJob image), axios, aws-sdk v2, `node:test`; Next.js 16 pages router, React 18, SWR, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-10-18-nrp-live-wall-design.md`

## Global Constraints

- The map, the usage view and `generate-nodes.js` are not modified. `generate-usage.js` changes only to require the shared `clients.js`.
- No Mapbox and no new runtime dependency for `/wall`.
- On-screen copy: short plain words, no jargon, no em dashes.
- Local work (sides under 10 miles apart) is in the totals and never a flow.
- Publish guards: total GPU hours 0, or no mapped flows, exits non-zero without uploading.
- Commit messages end with the session's Co-Authored-By line.

## File map

| File | Responsibility |
|---|---|
| `generate-nodes/clients.js` | `withRetries`, `callAccounting`, `lookupRor`, `fetchRorOrganization`. |
| `generate-nodes/wall-lib.js` | Pure wall calculations. |
| `generate-nodes/test/wall-lib.test.js` | Tests for the above. |
| `generate-nodes/generate-wall.js` | Fetch, resolve, build, guard, publish. |
| `lib/albersUsa.js` | Projection shared by the build script and the page. |
| `scripts/build-wall-outline.mjs` → `public/geo/us-outline.json` | Static outline. |
| `lib/wall.js`, `lib/wall.checks.js`, `scripts/run-wall-checks.mjs` | Page helpers and their checks. |
| `pages/api/wall.js` | Proxy for the R2 file. |
| `components/wall/*`, `pages/wall.js` | The page. |

---

### Task 1: Shared clients

**Files:** create `generate-nodes/clients.js`; modify `generate-nodes/generate-usage.js`.

- [ ] Move `withRetries`, `callAccounting` (with `ACCOUNTING_API_URL`) and `lookupRor` (with `ROR_API_URL`) into `clients.js`, unchanged. Add `fetchRorOrganization(id)` (`GET /v2/organizations/<id>`).
- [ ] `generate-usage.js` requires them; delete its copies and the now-unused `sleep`.
- [ ] Check: `npm test` passes; `node -e "require('./generate-nodes/clients')"` exits 0; the diff of `generate-usage.js` is only the moves.

### Task 2: `wall-lib.js` with tests

**Files:** create `generate-nodes/wall-lib.js`, `generate-nodes/test/wall-lib.test.js`.

**Produces (CommonJS):**
- `DEFAULT_HOME`, `LOCAL_MILES` (10), `HOURS_PER_YEAR` (8760), `TOKENS_PER_NOVEL` (120000)
- `normalizeName(name): string` (case, dashes, punctuation, leading "The")
- `milesBetween(a, b): number` (great-circle, `{ lat, lng }`)
- `collectPairs(rows): { pairs, gpuHours }` (cleans user names, merges duplicates, keeps unattributed sides as null)
- `sumTokens(rows): number`
- `netboxPlacement(name, sites): { lat, lng, match: 'netbox' } | null`
- `placeFromRorOrganization(org): string | null`
- `buildWallDocument({ day, generatedAt, pairs, gpuHours, llmTokens, locations, places, home })`
- `publishProblem(doc): string | null`

- [ ] Write the tests first: name normalising, miles, pair collection (suffix cleanup, unattributed), Netbox fallback (unique, same-campus multi-site, ambiguous), place labels (US, non-US, missing), the document (local vs flow, same campus under two names, away share, home served hours and partners, sites sort, flow sort and coordinates, unmapped), and both guards.
- [ ] Implement until `npm test` passes.

### Task 3: `generate-wall.js`, CronJob, docs

**Files:** create `generate-nodes/generate-wall.js`; modify `generate-nodes/k8s/cronjob.yaml`, `generate-nodes/README.md`, `README.md`, `.gitignore`.

- [ ] Same CLI shape as `generate-usage.js`: `--dry-run` writes `./wall.json`; otherwise `uploadToR2('wall.json', …)`; `main().catch` sets `process.exitCode = 1`.
- [ ] Env: `ACCOUNTING_API_URL`, `USAGE_PUBLIC_URL`, `NODES_PUBLIC_URL` (default `https://dash-api.nrp.ai/nodes.json`), `WALL_HOME_INSTITUTION`.
- [ ] Log the day, pair count, totals, match counts, every unmapped name and side.
- [ ] CronJob: `node generate-wall.js; wall=$?` after usage, `exit $(( nodes || usage || wall ))`. Check the shell with `sh -c`.
- [ ] `generate-nodes/README.md`: the `wall.json` contract and a Rollout section. `README.md`: `WALL_PUBLIC_URL`, the generator env vars, and a `/wall` section. `.gitignore`: `/generate-nodes/wall.json`.

### Task 4: Outline and projection

**Files:** create `lib/albersUsa.js`, `scripts/build-wall-outline.mjs`, `public/geo/us-outline.json`.

- [ ] `albersUsa({ scale: 1300, translate: [487.5, 305] })` returns `{ lower48, alaska, hawaii, project([lng, lat]) }`; `project` returns null outside CONUS, Alaska and Hawaii.
- [ ] The build script reads `package/states-10m.json` from the pinned us-atlas tarball, drops the territories, projects each state with its own part, simplifies each arc (Douglas-Peucker, 0.35 px), drops slivers, and writes `land` (filled), `coast` (arcs used once) and `borders` (arcs shared by two states).
- [ ] Check: the output is well under 200 KB and Lincoln, NE projects inside Nebraska.

### Task 5: Page helpers and checks

**Files:** create `lib/wall.js`, `lib/wall.checks.js`, `scripts/run-wall-checks.mjs`.

- [ ] Layout (world box with margin columns, fit to a container), point positions (projection or margin slot), arc control point and point-at-t, label placement with collision avoidance, spotlight list (`miles >= 100`, top 10 by hours), and the copy formatters (hours, years, percent, billions, roughly-N novels, miles).
- [ ] Checks run with `node scripts/run-wall-checks.mjs`.

### Task 6: API route and page

**Files:** create `pages/api/wall.js`, `components/wall/useWallData.js`, `components/wall/WallMap.js`, `components/wall/WallTiles.js`, `components/wall/WallSpotlight.js`, `components/wall/WallLegend.js`, `pages/wall.js`.

- [ ] Route: copy `usageByRegion.js`, `WALL_PUBLIC_URL`.
- [ ] `useWallData`: SWR on `/api/wall` with `refreshInterval: 15 min`, `keepPreviousData`, and the outline file.
- [ ] `WallMap`: SVG outline + canvas; static layer (arcs, dots, labels) redrawn on data, layout or spotlight change; animation layer (particles, home pulse) per frame; reduced motion draws once.
- [ ] Spotlight rotates every 7 s and tells the map which flow to brighten.
- [ ] `npm run build` passes.

### Task 7: Verify with real data

- [ ] `cd generate-nodes && node generate-wall.js --dry-run`; review totals, flows and `unmapped`; copy to `public/dev/wall.json`.
- [ ] `WALL_PUBLIC_URL=http://localhost:3000/dev/wall.json` in `.env.development.local`; open `/wall` at 1920×1080 and 3840×2160, with and without reduced motion, and with the route failing.
