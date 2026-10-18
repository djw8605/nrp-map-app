# NRP Live Wall: design

**Date:** 2026-10-18
**Status:** requested in conversation
**Branch:** `claude/nrp-live-wall-page-5nv5uz`

## Goal

A full-screen page, `/wall`, for the big screen in the UNL Holland Computing
Center offices. The people walking past do not know what the NRP or distributed
computing is, so the page explains itself in plain words and shows one day of
real GPU work moving between campuses across the country.

## Decisions

| Question | Decision |
|---|---|
| What is shown | One day: the accounting API's `latest_data_date`. GPU hours by (user institution, host campus), plus the day's LLM token total. |
| Who is "home" | `WALL_HOME_INSTITUTION`, default `University of Nebraska–Lincoln`. |
| Placing institutions | `usage-lib`'s `resolveInstitutions` unchanged (overrides, then the published `usage-by-region.json`, then ROR). A host it cannot place falls back to Netbox coordinates from the published `nodes.json`, if the name match is unambiguous. |
| Local work | A pair whose two sides are under 10 miles apart is local: counted in the totals, never drawn as a flow. Same-campus pairs often carry different names ("University of California San Diego" as the user, "University of California, San Diego" as the host) and ROR places both at the same city point. The 10-mile margin also absorbs a city point (ROR) against a campus point (Netbox) for one campus. |
| Map | SVG outline of the 50 states (Albers USA, Alaska and Hawaii inset) plus a `<canvas>` overlay. No Mapbox, no token. |
| Off-map places | Anything outside CONUS, Alaska and Hawaii is drawn in a column in the left (Asia, the Pacific, west of 100°W) or right (everything else) margin. |
| Refresh | SWR every 15 minutes; the last good data stays on screen through errors. |
| Existing views | The map, the usage view and `generate-nodes.js` are unchanged. `generate-usage.js` only changes to use the shared client module. |

## Architecture

```
generate-nodes CronJob (every 6h, clones this repo)
 ├─ node generate-nodes.js   → R2 nodes.json             (existing)
 ├─ node generate-usage.js   → R2 usage-by-region.json   (existing)
 └─ node generate-wall.js    → R2 wall.json              (new)
        │  POST /openapi/get_latest_data_date
        │  POST /openapi/query_resource_usage   gpu, by institution × node_institution
        │  POST /openapi/query_llm_token_usage  by model, summed
        │  GET  usage-by-region.json (cache), api.ror.org (new names, host cities)
        │  GET  nodes.json (Netbox fallback for hosts)
        ▼
dashboard (Vercel)
 ├─ /api/wall                 → wall.json (WALL_PUBLIC_URL)
 ├─ public/geo/us-outline.json  (static, built by scripts/build-wall-outline.mjs)
 └─ /wall                     kiosk page, no navbar or footer
```

## Part 1: Generator

### Files

| File | Change |
|---|---|
| `generate-nodes/clients.js` | **New.** `withRetries`, `callAccounting` and `lookupRor` moved out of `generate-usage.js`, plus `fetchRorOrganization(id)`. |
| `generate-nodes/generate-usage.js` | Requires the three helpers from `clients.js`. No behaviour change. |
| `generate-nodes/wall-lib.js` | **New.** Pure: name normalising, great-circle miles, Netbox fallback, place labels, the document build and the publish guards. |
| `generate-nodes/test/wall-lib.test.js` | **New.** `node --test` suite. |
| `generate-nodes/generate-wall.js` | **New.** Network and orchestration; `--dry-run` writes `./wall.json`. |
| `generate-nodes/k8s/cronjob.yaml` | Run `generate-wall.js` after `generate-usage.js`; fold it into the exit code. |

### Steps in `generate-wall.js`

1. `get_latest_data_date` → `day`.
2. `query_resource_usage` `{ start_date: day, end_date: day, resource: "gpu", group_by: ["institution", "node_institution"], limit: 5000 }`. `row_count >= limit` fails the run.
3. `query_llm_token_usage` `{ start_date: day, end_date: day, group_by: ["model"], limit: 5000 }`, `tokens_used` summed. Same row-limit check.
4. User names are cleaned (`cleanInstitutionName`); `Unknown` or empty names on either side count toward totals only.
5. Every user and host name goes through `resolveInstitutions`. Hosts still unplaced are matched by normalised name against `nodes.json` sites (`name` or `siteName`); a match is used only if every matching site is within 50 miles of the first, and then at their mean point.
6. Host place labels: "City, ST" (or "City, Country") from the ROR record, fetched by id when the name was a cache hit; the region name for an override; none for a Netbox match.
7. Build the document, log counts and the `unmapped` list, apply the guards, then upload or (`--dry-run`) write `./wall.json`.

### Output: `wall.json`

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
  "sites": [{ "name": "University of California, San Diego", "place": "San Diego, CA", "lat": 32.71571, "lng": -117.16472, "hosted_hours": 7753.17 }],
  "flows": [{
    "from": "University of California San Diego", "to": "Massachusetts Green High Performance Computing Center",
    "gpu_hours": 1612.92, "miles": 2499,
    "from_lat": 32.71571, "from_lng": -117.16472, "to_lat": 42.20426, "to_lng": -72.6162
  }],
  "unmapped": [{ "name": "The Open Force Field Consortium", "side": "user", "gpu_hours": 72.25 }]
}
```

- `gpu_years` = `gpu_hours / 8760`; `llm_novels` = `llm_tokens / 120000`.
- `away_share`: of the GPU hours whose user and host are both placed, the share
  where they are 10 miles or more apart.
- `host_sites` / `user_institutions`: distinct named hosts and users, placed or not.
- `home.served_hours`: hours hosted at home for users that are neither home by
  name nor placed within 10 miles of it (an unplaced user with another name
  counts); `partner_count` is the number of those users.
- `sites`: placed hosts, sorted by `hosted_hours` (all work run there, local
  included). `place` may be null.
- `flows`: placed pairs 10 or more miles apart, by `gpu_hours` descending.
  `miles` is great-circle, rounded. **Addition to the requested contract:**
  `from_lat`/`from_lng`/`to_lat`/`to_lng`, because a user campus that hosts
  nothing is in no other list and the page has to start its arc somewhere.
- `unmapped`: one entry per name and side that could not be placed, by hours.

### Failure handling

| Failure | Behaviour |
|---|---|
| Accounting API unreachable, non-200, missing `latest_data_date` or rows | Exit non-zero, upload nothing. |
| `row_count >= limit` on either query | Exit non-zero, upload nothing. |
| Total GPU hours is 0 | Exit non-zero, upload nothing. |
| No mapped flows | Exit non-zero, upload nothing. |
| `usage-by-region.json` or `nodes.json` unreadable | Log it and continue without that source. |
| ROR unreachable for a name | That name is unmapped this run. A failed city lookup leaves `place` null. |

## Part 2: Page

### Files

| File | Change |
|---|---|
| `pages/api/wall.js` | **New.** Copy of `usageByRegion.js` reading `WALL_PUBLIC_URL` (default `https://dash-api.nrp.ai/wall.json`). |
| `scripts/build-wall-outline.mjs` | **New.** Builds `public/geo/us-outline.json` from us-atlas `states-10m.json` (npm tarball), projected with `lib/albersUsa.js`. |
| `public/geo/us-outline.json` | **New, generated.** `{ width, height, land, coast, borders }` SVG path data in a 975×610 frame. |
| `lib/albersUsa.js` | **New.** Albers USA projection (d3's parameters), shared by the build script and the page. |
| `lib/wall.js` | **New.** Pure page helpers: layout, margin slots, arc geometry, label placement, spotlight list, copy formatting. |
| `lib/wall.checks.js`, `scripts/run-wall-checks.mjs` | **New.** Assertions-as-data, as for `usageRegions`. |
| `components/wall/*` | **New.** `WallMap` (SVG + canvas), `WallTiles`, `WallSpotlight`, `WallLegend`, `useWallData`. |
| `pages/wall.js` | **New.** The kiosk page. |

### Layout (16:9, sized in `vh`/`vw`)

- Header: kicker "National Research Platform · October 17, 2026", serif headline
  "Every day, scientists share computers across the whole country.", one plain
  sentence on GPUs and the NRP.
- Main: the map (about 70% of the width) with the spotlight line under it, and a
  column of five tiles: GPU hours, away share, host sites and user institutions,
  LLM text, and the home tile in amber.
- Footer: legend (dot size, moving light, amber home) and the source line.

### Map drawing

- Host dots: area scales with `hosted_hours`, with a soft glow. User campuses
  that host nothing get a small dim dot so arcs have a visible start.
- Flows: faint quadratic arcs bowing to the left of travel (so A→B and B→A part),
  width and particle count scaled by `sqrt(gpu_hours)`; particles travel at a
  constant on-screen speed from user to host.
- Home: amber dot, pulsing ring, "You are here" label.
- Labels: home first, then the margin places (their place leads: "Daejeon,
  South Korea"), then the seven largest hosts, each tried right, left, above and
  below its dot. A label above or below slides sideways to stay on screen; one
  that still overlaps an earlier label or another dot is dropped. Labels are
  drawn above the particles, and each margin column is captioned "Outside the US".
- The spotlighted flow's arc and particles are drawn brighter; the rest dim.
- `prefers-reduced-motion`: static arcs, no particles, no pulse, no fade.
- Resize: a `ResizeObserver` relays out; the canvas is sized by
  `devicePixelRatio`.

### States

- Loading: header and outline only.
- Error after data: keep the last good data. SWR's polling pauses while a key
  is in error and its default retries stop, so the page retries forever: 30 s,
  doubling, then every 15 minutes.
- No data ever: "Live data is unavailable right now." under the header.

## Testing

- `npm test` in `generate-nodes/` (usage-lib and wall-lib suites).
- `node scripts/run-wall-checks.mjs` and `node scripts/run-usage-region-checks.mjs`.
- `node generate-wall.js --dry-run` against the live APIs, output copied to
  `public/dev/wall.json`, `/wall` checked in a browser at 1920×1080 and 3840×2160
  with `WALL_PUBLIC_URL` pointed at it.
- `npm run build`.

## Out of scope

- Any change to the map, the usage view, `generate-nodes.js` or the overrides file.
- CPU usage, history beyond one day, interaction on the wall page.
