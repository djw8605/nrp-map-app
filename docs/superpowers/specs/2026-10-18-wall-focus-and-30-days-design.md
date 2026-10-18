# NRP Live Wall: pick an institution, and 30-day figures

**Date:** 2026-10-18
**Status:** agreed in conversation; implementation approved
**Branch:** `feat/wall-focus-30-days`
**Builds on:** [2026-10-18-nrp-live-wall-design.md](2026-10-18-nrp-live-wall-design.md)

## Why

`/wall` is used two ways: on people's desks with a mouse, and on the touchscreen
in the UNL Holland Computing Center offices. Today it only speaks for UNL ("Here
at University of Nebraska–Lincoln") and only for one day, which undersells the
platform. People should be able to:

1. **See what a dot is.** Hovering a dot (mouse) shows the institution's name.
2. **Make any institution the focus.** Clicking or tapping a dot moves the amber
   highlight there and turns the amber tile into "Here at the University of
   Missouri", with Missouri's numbers.
3. **See the scale over time.** Every tile shows the day's figure and the last
   30 days' figure side by side, so it is obvious the map is one day and the
   platform does far more over a month.

Also in this change: the AI tile's copy, already edited on this branch, which
did not say the text was chatbot work on NRP GPUs.

## Decisions (from the conversation)

| Question | Decision |
|---|---|
| Hover | Mouse only: pointing at a dot shows the institution's name. |
| Touch | A tap does both jobs: shows the name and picks the institution. *(Claude's call, confirmed in the playback.)* |
| What can be picked | Every dot on the map: host campuses (`sites`) and campuses that only send work (the small dots at arc starts). |
| What changes on a pick | The amber dot, its map label and the legend's amber line move to the pick, and the amber tile shows the pick's numbers. Nothing else on the map changes: same arcs, same particles, same spotlight line. |
| How long a pick lasts | Until someone picks another dot. No idle timer back to the home institution. The 15-minute data refresh keeps the pick (if the picked name is still on the map; otherwise fall back to home). A full page reload starts at home. *(Reload behaviour is Claude's call.)* |
| Institutions that host no GPUs | The amber tile flips direction: "GPU hours our researchers ran on other campuses' GPUs", and how many campuses. |
| 1 day and 30 days | Every one of the five tiles shows both figures, side by side and the same size (option A in the mockups). |
| Column labels | The day's date ("Oct 17") and "Last 30 days", not "Yesterday": the accounting data can lag more than a day. *(Claude's call.)* |
| Map and spotlight line | Stay one day. |

## Part 1: Generator (`generate-nodes/`)

### What changes

`generate-wall.js` builds the same document for two windows, the day (as now)
and the 30 days ending on that day (`day − 29` through `day`, inclusive), and
publishes both in one `wall.json`.

- Query both windows with the same three-step shape already used
  (`query_resource_usage` gpu by `institution` × `node_institution`, and
  `query_llm_token_usage` by `model`). The same row-limit check applies to every
  query. Measured on 2026-10-18: the 30-day GPU query returns 799 rows and the
  LLM query 15, well under 5000.
- Resolve the **union** of names from both windows in one `resolveInstitutions`
  call (and one Netbox fallback pass), so the 30-day window adds lookups only for
  institutions not seen in the day.
- If any 30-day query fails, the run fails and nothing is published, like the
  day queries. The last good `wall.json` stays up.
- `publishProblem` is unchanged (it checks the day: total hours > 0 and at least
  one flow).

### Per-institution figures

The page needs the amber tile's numbers for *any* dot, so the generator
publishes them for every institution that has a dot on the (one-day) map: each
placed `sites[].name` and each flow's `from`. For each, in each window:

- `served_hours`, `served_partners`: GPU hours run on this institution's GPUs for
  users that are not this institution, and how many such users. "Not this
  institution" uses exactly today's home rule: a user is the same institution if
  its normalised name matches or it is placed within `LOCAL_MILES` (10) of it.
  An unplaced user with a different name counts as a partner, as today.
- `away_hours`, `away_hosts`: GPU hours this institution's researchers ran on
  other institutions' GPUs, and how many hosts. "Other" uses the same rule from
  the user's side (host name differs and host not within 10 miles). An unplaced
  host with a different name counts.

This generalises today's `home.served_hours` / `home.partner_count`; for the home
institution the day's `served_*` must equal today's numbers (a test pins this).

A user name and a host name for one campus ("University of California San
Diego" / "University of California, San Diego") are separate names but one dot.
The page picks by dot, and the dot carries one name (the site's name when a site
is there, else the flow's `from`). So for a dot's name, `served_*` must count
hosting under that name and `away_*` must count work by users local to it
(same-name-or-within-10-miles, from the dot's point), so the two spellings of one
campus are not treated as strangers. That is the rule above applied from the
dot's point; the builder should implement "is the same institution" once and use
it for both directions.

### Output: additions to `wall.json`

Everything existing stays, with the same meaning (all one-day). Added:

```json
{
  "month": {
    "start": "2026-09-18",
    "end": "2026-10-17",
    "totals": {
      "gpu_hours": 606687.0, "gpu_years": 69.256, "away_share": 0.7,
      "host_sites": 44, "user_institutions": 69,
      "llm_tokens": 179835260870, "llm_novels": 1498627.2
    }
  },
  "home": {
    "institution": "University of Nebraska–Lincoln",
    "served_hours": 3205.17, "partner_count": 19
  },
  "institutions": {
    "University of Missouri": {
      "hosts": true,
      "day":   { "served_hours": 436.1, "served_partners": 9,  "away_hours": 0,      "away_hosts": 0 },
      "month": { "served_hours": 11159, "served_partners": 30, "away_hours": 2100.5, "away_hosts": 12 }
    },
    "Stanford University": {
      "hosts": false,
      "day":   { "served_hours": 0, "served_partners": 0, "away_hours": 1625.9, "away_hosts": 3 },
      "month": { "served_hours": 0, "served_partners": 0, "away_hours": 57838,  "away_hosts": 33 }
    }
  }
}
```

(Missouri's and Stanford's numbers are illustrative except where measured; the
30-day `away_share` is a placeholder until the generator computes it.)

- `month.totals` has exactly the fields of `totals`, for the 30 days.
- `institutions` is keyed by the exact name the dot carries (as it appears in
  `sites[].name` or `flows[].from`).
- `hosts` is true if the institution hosted any GPU hours in either window. It
  chooses the tile's wording (see Part 2), so a host campus that ran nothing for
  others on the day shows "0 GPU hours our computers ran for others", not the
  flipped wording.
- Hours rounded to two decimals, as elsewhere.

Update `generate-nodes/README.md`'s contract table and the console summary line.

### Tests (`generate-nodes/test/wall-lib.test.js`)

- The day's `served_*` for the home institution equals today's
  `home.served_hours` / `partner_count` on the existing fixtures.
- Two spellings of one campus within 10 miles do not count as each other's
  partners or hosts, in either direction.
- A user-only institution gets `hosts: false`, zero `served_*`, and correct
  `away_*`.
- The month window: `month.totals` built from a second set of pairs, `start` is
  29 days before `end`.

## Part 2: Page

### Picking and hovering (`components/wall/WallMap.js`, `lib/wall.js`)

- **Hit testing.** A pure helper in `lib/wall.js` (checked in `lib/wall.checks.js`)
  finds the dot under a screen point: the nearest site or origin dot whose
  distance is within `max(dot radius, 11px)` in CSS pixels, so small dots stay a
  finger-sized target. Margin-column dots count.
- **Pointer events** on the map container, not the canvas internals:
  `pointermove` with `pointerType === 'mouse'` sets the hovered dot (and
  `cursor: pointer` over a dot); `pointerleave` clears it; a click/tap (pointer
  up without much movement) on a dot picks it. A tap also shows the name.
- **Name tooltip.** A small DOM element absolutely positioned in `.wall-map`,
  next to the dot, kept inside the map's box, styled like the map labels. Mouse:
  shown while hovering. Touch: shown for about 3 s after the tap. Full
  institution name (not `shortName`), shown even when the dot already has a map
  label.
- **Redrawing on a pick.** `buildScene(wall, outline, focusName)` uses
  `focusName` where it uses `wall.home.institution` today (the `isHome` flags and
  `scene.home`). The static layers are redrawn; arcs, particles and the
  spotlight are unchanged.
- **Map label of the amber dot.** For the real home institution keep
  "You are here" + name. For any other pick, show the name alone in the amber
  label style, because "You are here" would be false on the Lincoln screen.
  *(Claude's call.)*

### Focus state (`pages/wall.js`)

- `focus` state, initially `wall.home.institution`. Passed to `WallMap`,
  `WallLegend` and `WallTiles`.
- On a data refresh, keep `focus` if `wall.institutions[focus]` still exists,
  else reset to home.
- Not in the URL, not in storage: a reload starts at home.

### Tiles (`components/wall/WallTiles.js`, CSS)

Layout A: each tile shows two figures side by side, each with a small caption
above it ("Oct 17" and "Last 30 days"), then the tile's label and one note.

| Tile | Day | 30 days | Note |
|---|---|---|---|
| GPU hours | `totals.gpu_hours` | `month.totals.gpu_hours` | 30 days as GPU-years ("like one graphics card running nonstop for 69 years") |
| Ran at another campus | `totals.away_share` | `month.totals.away_share` | as now |
| Campuses shared their GPUs | `totals.host_sites` | `month.totals.host_sites` | user institutions, both windows or the 30-day one |
| AI chatbots (copy as already edited on the branch) | `totals.llm_tokens` | `month.totals.llm_tokens` | novels for 30 days |
| Amber "Here at …" | `institutions[focus].day` | `institutions[focus].month` | partners or hosts for 30 days |

Amber tile wording:

- `hosts: true`: label "GPU hours our computers ran for others", figures
  `served_hours`, note "For researchers at N other organizations" (30-day N).
- `hosts: false`: label "GPU hours our researchers ran on other campuses' GPUs",
  figures `away_hours`, note "On GPUs at N campuses" (30-day N).
- Kicker: "Here at the University of Missouri": insert "the" before names that
  start with "University of"; other names as written ("Here at Stanford
  University"). The kicker is uppercase in CSS, as now.

The exact wording of notes, and how the five tiles fit at 1920×1080 and
3840×2160 without clipping, are the builder's call within this layout.

### Legend and source line (`components/wall/WallLegend.js`)

- Amber line: "Amber: University of Nebraska–Lincoln, where you are" for the
  real home; "Amber: University of Missouri, the campus in the amber box" for any
  other pick. *(Claude's call on wording.)*
- Source line names both windows: "Source: NRP accounting data for October 17,
  2026 and the 30 days before".

### Older `wall.json` (deploy order)

Vercel deploys the page as soon as this merges; the CronJob publishes the new
fields on its next run, up to 6 hours later. Until then `month` and
`institutions` are missing. The page must then render exactly as it does today:
single figures, no picking (hover may still show names). No error, no blank tile.

## Checks

- `npm test` in `generate-nodes/`.
- `node scripts/run-wall-checks.mjs` with new checks for hit testing, the "the"
  rule and the amber-tile wording choice.
- `node generate-wall.js --dry-run` against the live APIs; copy to
  `public/dev/wall.json`; check `/wall` at 1920×1080 and 3840×2160: hover names,
  picking a host (Missouri), a user-only campus (Stanford), a margin dot
  (Daejeon), and back to UNL; the tile fit; an old-format `wall.json` (today's
  file) still renders.
- `npm run build`.

## Out of scope

- Moving or zooming the map on a pick; showing 30 days on the map or in the
  spotlight line.
- An idle reset, URL parameter or saved pick.
- Keyboard selection of dots.
- Any change to `/`, `/map`, the usage view or the OSDF map.
