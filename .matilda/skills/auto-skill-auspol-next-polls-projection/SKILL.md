---
name: auspol-next-polls-projection
description: auspol-tracker — map of the "Next expected polls" machinery (pollCadence shipped in the 9f09dca2 data asset → live projection npProject in a11e1559 → TWO render homes, NextPollsPanel and the nav-bar NextPollTicker in d1a1d215). Row flags overdue/missed/loose/winHalf; an unrecorded release must PERSIST as red "N days overdue" in both homes; houses leave the projection only via the hand-declared pollsterRules.stopped flag (the old CAD_MAX_SILENT 1.5x silence gate is gone). Windows are ONE-SIDED (spreadEarly measured, usually 0 — houses slip late, never early); the ticker's targetOf must use the measured early edge, and the panel's when-column mirrors "(or N)" day-counts via dayAlt. Verify with sim-next-polls.mjs against mocked Sydney clocks.
source: auto-skill
extracted_at: '2026-09-01T00:00:00.000Z'
---

# auspol-tracker: Next expected polls — projection, panel, ticker

Feature added 1 Sep 2026: a slot whose expected release moment passes unrecorded holds its place as red **"N days overdue"** until the poll is actually recorded — no silent roll-forward, no disappearance. Worked across `gen-data.mjs`, two asset bundles, polls.json schema, template CSS, copy, and a sim harness.

## Trace chain (top-down)

1. **`gen-data.mjs` ~§cadence (~1289–1610)** computes per-house `pollCadence` rows: `{pollster, site, last, cadence, lag, spread, spreadEarly, spreadLate, releaseDow, releaseMins, loose}`. `spreadEarly`/`spreadLate` are the MEASURED one-sided tails of the release-gap record — every dated weekday house in the 2026 record slips LATE, never early (`spreadEarly 0, spreadLate 7`; loose houses like DemosAU can have both sides non-zero). Shipped in the data asset `.build/newtracker/assets/9f09dca2-….js`. Houses are excluded ONLY by `pollsterRules[firm].stopped` (hand-declared in `data/polls.json`, schema-documented). The old `CAD_MAX_SILENT = 1.5` eviction constant is REMOVED — silence never evicts; genuinely dead houses (Fox & Hedgehog, Freshwater in Sep 2026) are flagged by hand with an explanatory note in polls.json.
2. **Projection runs LIVE in-browser**, not at build time: `npProject()` in a11e1559 (`window.AP.nextPolls`) walks `last + n*cadence`, snaps to the week's `releaseDow` (±3-day snap), and stops a house's walk once a slot is `overdue || loose`. Horizon `NP_HORIZON_DAYS = 28` past the DATA clock (`LATEST_ISO`), not the wall clock. Untimed houses default to `NP_UNTIMED_MINS = 24*60`.
3. **Row flags** every consumer keys off: `overdue` (slot+due-mins ≤ now), `missed` (window tolerance ALSO past — `release + winHalf*DAY < t0`), `loose` (window forecast, e.g. DemosAU), `winHalf` (tolerance half-width; week-quantised via `7*floor((sp+3)/7)` for dated non-loose houses), `inDays/opensIn/closesIn` (rounded days vs t0).
4. **TWO render homes, both in different bundles:**
   - **NextPollsPanel** (a11e1559): sort key `first()` = `missed ? Infinity : loose ? release - spread*DAY : overdue ? release + winHalf*DAY : release` — missed rows park at the FOOT (a latent bug had loose+missed rows floating to the top reading "open now" forever; loose+missed now renders `when(closesIn)`, i.e. "5 days overdue").
   - **NextPollTicker** (d1a1d215, the nav-bar "next polls:" countdown): `overdueItems` (missed rows → red "N days overdue", days counted from `release` for dated rows or `release + winHalf*DAY` for loose rows, most-late first) prepended to `upcomingItems` — non-missed rows with the `targetOf` weekday roll + `(maybe)` hedge, FILTERED to the coming 7 days (`t.byDay ? round((t.at−t0)/DAY) ≤ 7 : t.at ≤ nowMs+7·DAY`; a weekly house may appear twice in a week, that's the honest schedule) — then `slice(0, 3)`. Red comes from `<span className={"tn-when" + (it.overdue ? " tn-overdue" : "")}>` + the `.tn-overdue { color: var(--mood-neg); }` rule in template.html. NEVER remove the `overdue` branch back to a `live`-roll filter — that's the disappearance bug.

## One-sided windows (Sep 2026 phantom-date fix)

`targetOf` (ticker) and `dayAlt` (panel) must use the MEASURED one-sided early edge `spreadEarly`, not the symmetric `winHalf`. The Sep 2026 phantom: the ticker reused `winHalf` (7) as the early edge for Resolve — whose record is `spreadEarly 0 / spreadLate 7` (never early, slips a week twice) — so it counted down to a **SUN 6 SEP THAT COULDN'T HAPPEN** and out-sorted Roy Morgan's real Mon 7 Sep with "5 days". Fix: `earlyHalf = 7*Math.floor((r.spreadEarly * Math.sqrt((r.ahead||0)+1) + 3)/7)` — week-quantised like `winHalf`, drift-widened, symmetric fallback only when `spreadEarly == null`. With `spreadEarly 0` the target lands on the projected date itself (Sun 13), so the `(maybe)` hedge (`t.at - release > 7*DAY`) no longer fires — that matched the spec "navbar should JUST say … tomorrow / 6 days", no hedge.

Panel side: `dayAlt(r)` (lives right after `pmLabel` in a11e1559) mirrors the date-column's "(or Sun 20 Sep)" suffix as a day-count: `when(r.inDays) + (dayAlt(r) || "")`, non-overdue dated rows only:
- `earlyW === 0 && lateW >= 1` → ` (or ${inDays + lateW*7})` — "in 12 days (or 19)" (Resolve), "in 19 days (or 26)" (Newspoll);
- `lateW === 0 && earlyW >= 1 && inDays - earlyW*7 >= 1` → the mirrored early-side clause (long-waiting houses; the `>= 1` guard kills degenerate past/alternative phrasing — a "0 days" alternative was nonsense copy in the first draft).

## Time frame

Everything is in **Sydney wall-clock**: `scen()`-style epoch anchors = `Date.parse(day + "T00:00:00Z") + mins*60000` are SYDNEY day+minutes (the harness pins dayFloor/UTC tricks to the app's own frame). `release` is day-floored after the dow snap; `due = release + releaseMins*60000`.

## Verify

- `node .build/newtracker/sim-next-polls.mjs` (run AFTER a rebuild) — evals the real shipped data asset with `global.window = {}`, replays the exact shipped algorithms (projection + `when`/`ago`/`panelWhen` + ticker item derivation) against mocked clocks: tomorrow→any-moment-now→"N days overdue", recording-reanchors-and-clears, loose-house window-close, stopped houses absent, ticker-most-overdue-first ordering. Exits non-zero on any miss. Mirror of the sim-oppr-labels.mjs convention.
- Built-artifact greps (ASCII-safe only): `tn-overdue` (CSS + JSX span), `"days overdue"`, `missed ? Infinity`; pollCadence firm list via `index.html` regex on `pollCadence = [...]`. Non-overdue dated rows in the panel when-column also append `dayAlt(r)` — grep `dayAlt` in a11e1559.
- Quick live-check without the sim: the 9f09dca2 DATA asset is eval-safe (`global.window = {}` + strip `"use strict";`), the JSX assets (a11e1559, d1a1d215) are NOT (`SyntaxError: Unexpected token '<'` — unbaked JSX). Reproduce `targetOf`/`dayAlt` directly against `window.AUSPOL.pollCadence` rows for a chosen t0 and compare sort + `inDays`/`(or N)` outputs.
- Trends-watch gotcha when writing new sim scenarios: with the data clock pinned, scenarios weeks in the FUTURE make EVERY house's slot blown — assert ticker order by most-overdue, and check a single house's ticker item on `rows.filter(r => r.pollster === ...)`.

## Copy homes for this feature (move together)

Glossary `id: "next-polls"` entry (asset JSX), ticker tooltip `title`, and `PRODUCT.md` "Next expected polls" bullet all state the persist-until-recorded rule and the hand-declared-stops rule. The schema description of `stopped` in `data/polls.schema.json` is the fourth home.

Related: auspol-build-pipeline (never hand-edit index.html; rebuild + validate), auspol-built-html-verification (babel escapes non-ASCII — grep ASCII tokens only).
