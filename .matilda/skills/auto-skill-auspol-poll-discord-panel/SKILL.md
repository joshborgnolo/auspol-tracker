---
name: auspol-poll-discord-panel
description: "auspol-tracker — the Poll disagreement (variance) panel end-to-end: discord engine in ed2260de (DISCORD_MEASURES facets twopp/primary/leadership, recency-weighted sigma vs sampling FLOOR, R ratio bands) + VariancePanel renderer in d1a1d215 mounted per archive facet. Primary trio ALP/L/NP/ON and both 2PP matchups ALREADY exist as measures — before 'adding' a disagreement measure, check DISCORD_MEASURES first."
source: auto-skill
extracted_at: '2026-09-03T06:00:09.740Z'
---

# Poll disagreement (VariancePanel) — discord engine end-to-end

The All-polls tab's **"Poll disagreement"** chart: how far apart the pollsters sit,
measured against the spread sampling error alone would produce. Two files.

## Engine — `.build/newtracker/assets/ed2260de-….js` (`:113-242`)

- **`DISCORD_MEASURES`** (`~:147`) is THE catalogue, keyed by `facet`:
  - `twopp`: `tpp_alp` (ALP v L/NP), `tpp_alpon` (ALP v ON, via `p.tppAlt.alp`)
  - `primary`: `p_alp`, `p_lnp`, `p_onp` — **exactly ALP / Coalition / One Nation, no
    Greens or OTH** (deliberate)
  - `leadership`: `net_alb`, `net_opp`, `net_han` — net approval; each measure entry
    carries `id / label / color / val(p) / share(p)`, plus `net: true` and an optional
    `stratum(p)`.
  - `direction` has NO measures → the panel returns null on that facet.
- **`discordPoints(m)`** (`:174`): per calendar month — Gaussian window `BW: 45` days,
  recency-only weights (NEVER sample-size weighting: that would mute exactly the
  divergent small polls being measured); per-stratum local LINEAR trend (intercept +
  slope, so genuine movement isn't booked as disagreement); pooled residuals →
  `sigma` (weighted SD, dof-corrected), `floor` = `sqrt(Σw·sv/Σw)` where
  `sv = DEFF·p(1−p)/n` (nets use `DEFF·(ENGAGED − net²)/n`), `R = sigma/floor`,
  `excess`, `ci = 1/√(2·(neff−dof))`. Gaps left when `neff < 4`, `< 3` houses, or
  `neff − dof < 1`. Constants: `DEFF 1.6`, `ENGAGED 0.90` (assumed approve+disapprove
  share when a poll publishes only the net), `MIN_STRAT 3`.
- **Leadership strata** (`:162`): residuals pooled only WITHIN era+metric —
  `OPP_SPLICE = "2026-02-13"` splits Ley|Taylor, and `metricOf` splits
  approval/favourability — so handovers never masquerade as pollster discord.
  If a new leader takes office, add a new splice constant here.
- Read faces: `discord(id)` memoised per measure; `discordFacet(facet)` filters by
  facet; `discordRead(R)` → bands `<0.8 herded`, `<1.2 chance-consistent`,
  `<1.6 mild`, else `real disagreement`. All exported on `window.AP` at `:423`.
- Runs entirely client-side off `D.individualPolls` — **filters are ignored by
  design** ("how much do pollsters disagree" is an industry property; the range
  window only reframes the chart).

## Renderer — `VariancePanel` in `d1a1d215-….js` (`:2540-2673`)

- Signature `<VariancePanel facet={facet} rangeId={range} />`, mounted for EVERY
  archive facet at `:3529` — the panel *follows the page's facet tabs* (design
  principle in its header comment: "the measures on screen are the ones the table
  below is showing"). No in-panel measure toggle as of 2026-09-03 (one was DESIGNED
  that day — 2PP | Primaries TextToggle defaulting to the facet — but not shipped;
  measure data needed nothing, it's pure UI state + `key={facet}` remount).
- Measures with zero computable months (e.g. Hanson net — too few houses at once)
  are dropped, never drawn flat. Hidden chips set series `opacity: 0`, not removal.
- **ONE shared chance-floor area**, averaged across visible measures (close enough
  within a facet): `areas=[{id:"floor", color:"var(--ink-faint)", opacity:.14, points:[{x,y0,y1}]}]`
  — classic `{x, y0, y1}` TrendChart area, plus an `extraRows` tooltip row
  "Chance floor …pp". TrendChart key pattern `var-{facet}-{rangeId}`.
- Below the chart: `vr-tile` read cards (name / σ / `vr-pill` coloured by
  discordRead id / R×floor sub-line + unexplained-pp clause). Pills for
  `chance-consistent`/`mild-divergence` are glossary `openTerm` hi-terms.
  Legend chips carry `vr-{read.id}` classes; CSS lives at template.html `:3323`
  (`/* ---------- Poll disagreement (variance) panel ---------- */`).
- House lean panel (`.ap-lean`) reuses these classes wholesale — see
  `auspol-house-lean-chart`; the two read as one family, keep their chrome in sync.

## Copy/commitments

- Card-sub: "…Measured across all N polls; the filters above don't narrow it."
- Note paragraph explains recency-only weighting, the DEFF floor, and the R reads
  (under 0.80× herded / ~1× chance / over 1.20× apart) — `window.AP.DISC.DEFF` is
  interpolated live, so a DEFF change updates the prose.
- Leadership facet appends a clause owning the Ley → Taylor splice.

## When extending

- **New voting measure** (e.g. Greens primary): one `DISCORD_MEASURES` row — no
  gen-data work, the engine reads the per-poll object directly. A measure with
  `share(p)` needs the poll-carried proportion for its floor.
- **House-lean per-primary extension** (designed 2026-09-03, unshipped): gen-data
  `primaryHE[k]` (all 5 keys, est. `:430-438`) already exists and is emitted as
  `houseEffects.primary` (`:1896`); extending `houseLean` to `{tpp, alp, lnp, onp}`
  keyed series is mechanical (same ≥3-evidence gate, same `ymMidMs`/`at` sampling).
  HouseLeanPanel is the SOLE `D.houseLean` consumer.
