# Usage map — design

**Date:** 2026-09-29
**Status:** approved in conversation, pending spec review
**Branch:** `feat/usage-map`

## Goal

Add a second view to the dashboard map that shows **who uses the NRP**: every US
state, and every other country, that is home to an institution with any NRP usage
in the last three years is highlighted. Clicking a region lists the institutions
there. The existing map — sites that **contribute** hardware — stays the default,
and a toggle switches between the two, including inside the iframe nrp.ai embeds.

## Decisions

| Question | Decision |
|---|---|
| What highlights a region | **Any usage.** One highlight colour; no shading by amount, no per-resource filters. |
| What counts as usage | Any CPU, GPU or LLM usage > 0 in the window, attributed by the namespace's institution. |
| Window | Three years ending on the accounting API's `latest_data_date`, recomputed every run. |
| Region panel content | **Institution names only**, sorted A–Z. |
| Usage numbers | Written to the JSON (per institution and per region) for future work; **not displayed**. |
| Geography | US states individually; every other country as a whole. US territories (PR, GU, VI, AS, MP) are their own regions, keyed by ISO code. |
| Where the toggle appears | `/`, `/map`, and therefore the nrp.ai iframe. Default stays Contributors. |
| Data source for usage | The **public OpenAPI** bridge: `https://nrp-accounting-mcp.nrp-nautilus.io/openapi` (no token). |
| Institution → region | ROR matching, cached through the previously published JSON, plus a hand-kept overrides file. |
| ClickHouse | **Unchanged.** Read only, through the OpenAPI bridge. |
| OSDF map | **Unchanged.** `components/osdf/*` and `pages/osdf-nodes.js` are not touched. |

## Architecture

```
generate-nodes CronJob (every 6h, clones this repo)
 ├─ node generate-nodes.js   → R2 nodes.json               (existing)
 └─ node generate-usage.js   → R2 usage-by-region.json     (new)
        │  POST /openapi/get_latest_data_date
        │  POST /openapi/query_resource_usage
        │  GET  previous usage-by-region.json  (cache)
        │  GET  api.ror.org/v2/organizations?affiliation=…  (new names only)
        ▼
dashboard (Vercel)
 ├─ /api/nodes          → nodes.json               (existing)
 ├─ /api/usageByRegion  → usage-by-region.json     (new, fetched only in usage view)
 └─ public/geo/usage-regions.json                  (new, static, fetched only in usage view)
```

The region code is the join key between the JSON and the shapes: `US-XX` for a
state (postal code, including `US-DC`), ISO 3166-1 alpha-2 for everything else.

## Part 1 — Data job (`generate-nodes/`)

### Files

| File | Change |
|---|---|
| `r2.js` | **New.** `uploadToR2(key, body)` moved out of `generate-nodes.js`, with the key as a parameter. `generate-nodes.js` requires it; its behaviour is otherwise unchanged. |
| `generate-usage.js` | **New.** Entry point: fetch, resolve, roll up, upload. Thin — the logic lives in `usage-lib.js`. |
| `usage-lib.js` | **New.** Pure functions: window calculation, name cleanup, ROR result → region code, rollup, cache reuse. No network, no environment access. |
| `institution-overrides.json` | **New.** Hand-kept `{ "<institution name>": { "region": "US-CA", "lat": …, "lng": …, "ror": null } }` for names ROR does not list. |
| `test/usage-lib.test.js` | **New.** `node --test` suite for `usage-lib.js`. |
| `package.json` | Add `"test": "node --test"`. No new dependencies (axios is already present). |
| `k8s/cronjob.yaml` | Run both scripts independently; fail the job if either fails. |
| `README.md` | Document the new script, the file it publishes, and the overrides file. |

### Steps in `generate-usage.js`

1. **Window.** `POST /openapi/get_latest_data_date` with `{}` → `latest_data_date`.
   `end = latest_data_date`; `start = end − 3 years + 1 day`.
2. **Usage.** `POST /openapi/query_resource_usage` with
   `{ start_date, end_date, group_by: ["institution", "resource"], resource: ["cpu", "gpu", "llm"], limit: 5000 }`.
   The server caps `limit` at 5000. If `row_count >= limit`, **fail** (the result
   may be truncated). Today's result is 394 rows covering 190 institutions.
3. **Pivot** rows into `{ institution: { cpu_core_hours, gpu_hours, llm_tokens } }`
   (`cpu` → `cpu_core_hours`, `gpu` → `gpu_hours`, `llm` → `llm_tokens`). Rows whose
   institution is `Unknown` or empty are summed into `unattributed` and excluded
   from the map.
4. **Resolve** each institution to `{ ror, region, lat, lng, match }`, in order:
   1. **Override** — an entry in `institution-overrides.json`. Checked first, so
      correcting a bad match takes effect on the next run.
   2. **Cache** — the entry for the same name in the previously published
      `usage-by-region.json` (fetched from `USAGE_PUBLIC_URL`, default
      `https://dash-api.nrp.ai/usage-by-region.json`), **only if its `match` is
      `ror`**. Override entries are never reused from the cache, so deleting an
      override takes effect on the next run too. A missing or unreadable previous
      file is not an error; everything is resolved fresh.
   3. **ROR** — `GET https://api.ror.org/v2/organizations?affiliation=<name>` with
      the name cleaned first (text after `" / "` removed, whitespace trimmed). Take
      the item with `chosen: true`; otherwise an item one of whose `names` equals
      the cleaned name case-insensitively; otherwise no match. At most 4 requests in
      flight, 3 retries with backoff.
   4. **Unmapped** — listed in `unmapped` with its usage.

   Region code from the ROR record's first location (`geonames_details`):
   `country_code == "US"` → `"US-" + country_subdivision_code`; otherwise the
   `country_code` (so Guam is `GU`, Puerto Rico `PR`). `lat`/`lng` come from the
   same location.
5. **Roll up** into regions: for each region, the sorted institution names and the
   summed usage. Region `name` comes from ROR (`country_subdivision_name` for US
   states, `country_name` otherwise), or from the override.
6. **Publish** `usage-by-region.json` to R2 bucket `nrp-dashboard`, `public-read`,
   `application/json`. With `--dry-run`, write it to `./usage-by-region.json`
   instead and skip the upload.

Order of checks: **override → cache → ROR**. (Overrides first so they can correct a
cached match; the cache before ROR so a run makes ROR calls only for new names.
To force a fresh ROR lookup for one name without an override, it must be absent
from the previous file — there is no other cache to clear.)

### Output schema — `usage-by-region.json`

```json
{
  "version": 1,
  "generated_at": "2026-09-29T06:00:00Z",
  "window": { "start": "2023-09-29", "end": "2026-09-28" },
  "regions": {
    "US-NE": {
      "name": "Nebraska",
      "institutions": ["University of Nebraska–Lincoln"],
      "totals": { "cpu_core_hours": 0, "gpu_hours": 0, "llm_tokens": 0 }
    },
    "KR": { "name": "South Korea", "institutions": ["…"], "totals": { "…": 0 } }
  },
  "institutions": {
    "University of Nebraska–Lincoln": {
      "ror": "https://ror.org/043mer456",
      "region": "US-NE",
      "lat": 40.8, "lng": -96.7,
      "match": "ror",
      "usage": { "cpu_core_hours": 0, "gpu_hours": 0, "llm_tokens": 0 }
    }
  },
  "unmapped": [{ "name": "…", "usage": { "cpu_core_hours": 0, "gpu_hours": 0, "llm_tokens": 0 } }],
  "unattributed": { "cpu_core_hours": 0, "gpu_hours": 0, "llm_tokens": 0 }
}
```

`match` is one of `ror`, `override`. Usage values are numbers (floats); the job does not round them.

### Failure handling

| Failure | Behaviour |
|---|---|
| Accounting API unreachable, non-200, or zero rows | Exit non-zero, upload nothing. The previous file stays live. |
| `row_count >= limit` | Exit non-zero, upload nothing. |
| Previous file missing or unreadable | Log it, resolve every name fresh. |
| ROR unreachable for a name | That name goes to `unmapped` for this run; retried next run. |
| Zero institutions resolved to a region | Exit non-zero, upload nothing (protects against publishing an empty map). |
| R2 upload fails | Exit non-zero. |

### CronJob

```sh
node generate-nodes.js; nodes=$?
node generate-usage.js; usage=$?
exit $(( nodes || usage ))
```

Both scripts always run; the Job is marked failed if either fails.

## Part 2 — Map and panel (dashboard)

### Files

| File | Change |
|---|---|
| `pages/api/usageByRegion.js` | **New.** Same shape as `pages/api/nodes.js`: fetch `USAGE_PUBLIC_URL` (default `https://dash-api.nrp.ai/usage-by-region.json`), permissive CORS, `Cache-Control: s-maxage=3600, stale-while-revalidate`. |
| `components/map/MapViewToggle.js` | **New.** The Contributors / Usage switch. |
| `components/usage/UsageRegionLayers.js` | **New.** Mapbox `Source` + fill and line `Layer`s for the regions, hover and selected state. |
| `components/usage/UsageLegend.js` | **New.** Single-swatch legend with the window dates. |
| `components/usage/UsagePanelContent.js` | **New.** `UsageOverviewContent` and `UsageRegionContent` for `MapOverlayPanel`. |
| `components/usage/UsageHoverCard.js` | **New.** Region name + institution count. |
| `lib/usageRegions.js` | **New.** Pure helpers: sorted region list, highlighted-code list, region lookup, summary counts, point fallback for regions without a shape. |
| `lib/usageRegions.checks.js` | **New.** Assertions-as-data in the style of `lib/siteClusters.checks.js`, runnable with plain `node`. |
| `components/nodeMap.js` | Accept `view` (`'contributors'` default) and `usageLayers` (rendered inside `<Map>`). In usage view, skip pins, the site hover card and the contributors `Legend`. The expand link carries `?view=`. |
| `pages/map.js`, `pages/index.js` | Hold the view state, read `?view=` and `?toggle=`, render the toggle, fetch usage data lazily, swap panel content. |
| `public/geo/usage-regions.json` | **New.** Static region shapes (see below). |
| `scripts/build-usage-regions.mjs` | **New.** One-off builder for the shapes file. |

### Toggle

- A two-option radio group ("Contributors", "Usage") at the top centre of the map,
  in the existing `map-glass-panel` style. Arrow keys move between options; the
  selected option is announced.
- The view is written to the URL with `router.replace(…, { shallow: true })` —
  **replace, not push**, so toggling inside an iframe never adds entries to the
  host page's history.
- Switching view clears the selection of the view being left (selected site or
  selected region) and leaves the camera where it is.

### Usage view

- **Fill layer:** regions whose code is in `regions` are filled with one accent
  colour; others are not drawn. A `match` expression on the `code` property drives
  it. Hovered region: higher fill opacity (feature state). Selected region: a
  stronger outline.
- **Line layer:** thin borders for highlighted regions only.
- Layers use `slot: 'middle'` so basemap labels stay on top.
- **Colours** come from one small token set with light and dark values. The theme
  is class-based (`darkMode: 'class'`), so the layer paint is recomputed when
  `resolveLightPreset()` changes, using the same `MutationObserver` path `NodeMap`
  already uses to re-light the basemap. No `prefers-color-scheme` media queries.
- **Hover card:** "Nebraska · 4 institutions", positioned at the pointer.
- **Legend:** one swatch, "Institutions using NRP", with "Sep 2023 – Sep 2026"
  beneath it, formatted from `window`.
- **Click** selects the region; Escape or a click on empty map clears it.

#### Regions without a shape

A region in the usage JSON whose code has no feature in `usage-regions.json` is
drawn as a small circle (same accent colour, fixed pixel radius) at the mean
`lat`/`lng` of its institutions. It shares the fill layer's hover card, click and
selected behaviour, and appears in the panel like any other region. The lookup is
a pure helper in `lib/usageRegions.js`, computed client-side from the loaded shapes,
so a newly added small country needs no rebuild of the shapes file.

### Panel

Uses `MapOverlayPanel` unchanged (so it is a bottom sheet in small containers).

- **Nothing selected — `UsageOverviewContent`:** "Used in *N* US states and *M*
  other countries", then the regions as a clickable list (US states A–Z, then
  countries A–Z), each with its institution count.
- **Region selected — `UsageRegionContent`:** the region name as the panel title,
  a back button, and the institution names A–Z. Names only.

The panel never shows usage numbers, `unmapped` or `unattributed`.

### Region shapes — `public/geo/usage-regions.json`

Built once by `scripts/build-usage-regions.mjs` and committed; rebuilt only if the
source data changes.

- **US states and DC:** us-atlas `states-10m.json`, FIPS → postal code, tagged
  `US-XX`.
- **US territories** (FIPS 60, 66, 69, 72, 78): from the same us-atlas file,
  tagged with ISO codes `AS`, `GU`, `MP`, `PR`, `VI`.
- **Other countries:** world-atlas `countries-110m.json` (the smallest file),
  ISO numeric → alpha-2, with the US and the five territories removed.
- Each feature carries `{ code, name }` only. No further simplification; the build
  prints the size (expected a few hundred KB uncompressed).
- **Countries too small for the 110m file** (Singapore has an NRP user today) have
  no polygon. Accuracy for them is not a goal; they must still be visible and
  clickable. See "Regions without a shape" below.
- The build script is a dev-time tool: it may use `npx` packages (e.g. mapshaper,
  topojson-client) but adds nothing to the dashboard's `package.json`
  dependencies.

### Lazy loading

`/api/usageByRegion` and `usage-regions.json` are fetched only once the usage view
is first shown (SWR key is `null` until then). A visitor who never toggles loads
exactly what they load today.

### Loading and error states

- While usage data loads: the toggle shows Usage as selected, the legend shows
  "Loading…", no regions are filled.
- If either fetch fails: the legend shows "Usage data unavailable" and the panel
  says so; the Contributors view is unaffected.

## Part 3 — Iframe

- Plain `/map` (what nrp.ai embeds) opens on **Contributors** with the toggle
  visible. No change is needed on nrp.ai.
- `?view=usage` opens on Usage. `?view=contributors` or no parameter opens on
  Contributors. Unknown values fall back to Contributors.
- `?toggle=0` hides the toggle.
- `?panel=0` keeps working. In usage view without a panel, hover still shows the
  hover card; click selects and outlines the region but nothing else opens.
- Layout is checked at 520×390 (the `/distributed-infrastructure` embed), ~700×350
  (the homepage 2:1 embed) and 375 px wide. The toggle must not overlap the
  top-left navigation controls or the bottom sheet, and a region's institution list
  must scroll inside the sheet.
- The home page's "Open full-screen map" link opens `/map?view=<current view>`.

## Testing

- **Job:** `node --test` in `generate-nodes/` covering window calculation, name
  cleanup, ROR record → region code (US state, territory, foreign country),
  override precedence over cache, cache reuse, rollup totals and sorting, and the
  `row_count >= limit` guard. Then one `--dry-run` against the live API and ROR, and
  a review of the resulting JSON (institution count, region count, `unmapped`
  list).
- **Dashboard helpers:** `lib/usageRegions.checks.js` run with `node`, including the point fallback for a region with no shape (Singapore).
- **Map:** in the Browser pane against the dev server, verified through the map
  instance (layer present, `queryRenderedFeatures` returns filled regions, click
  sets the selected region, panel lists the right names), not through screenshots
  alone — the pane does not reliably composite the WebGL canvas. Plus the three
  iframe sizes above, light and dark themes, and `?view=`, `?toggle=0`,
  `?panel=0`.

## Out of scope

- Displaying any usage numbers, per-resource filters or shading by amount.
- Institution pins on the usage map.
- Showing `unmapped` institutions in the UI.
- `postMessage` control from embedding pages; region or camera URL parameters.
- Any change to ClickHouse, the accounting pipeline, the OSDF map, or nrp.ai.
