---
name: auspol-allpolls-ldgap-rail
description: "auspol-tracker — the All-polls Leadership facet's detail right rail ('How it counts') replaced 2PP with the NET LEADER-RATING GAP (shipped 2026-10-01, rd-allpolls.jsx ~:496-683 + RdApDetail isLd branch): RdApLdMini sibling of RdApMini/RdApDirMini/RdApIssMini, same-metric pair gate via a.metricBy (approval∧approval, fav∧fav only), metric-conditional caption ('net approval'/'net favourability'/'net leader ratings'), per-pair house lean from slot-level D.houseEffects.appr {alb,opp,han} (metric+era stratified), facts rows keyed 'The gap in this poll'/'Against {Month}'/'Now'. Probe traps: phone facet tab reads 'Leaders' not 'Leadership'; phone cards have no chevron (key identity by .rd-ap-c1 .rd-ap-firm + .rd-ap-c2 .rd-ap-sub text); chevron aria-labels omit the year so disambiguate open polls via the /feedback/?msg= link's YYYY."
source: auto-skill
extracted_at: '2026-10-01T06:04:05.295Z'
---

# All-polls Leadership rail — net leader-rating gap (RdApLdMini)

Shipped 2026-10-01 (uncommitted at write time, rd-allpolls.jsx +
rebuilt index.html). User brief: in the Leadership facet's open-poll
detail, "How it counts" must show the net leader-rating gap
(**Albanese minus Taylor**, **Albanese minus Hanson**), REPLACING the
2PP rail that leadership used to fall through to — not appending.

## Architecture

Modelled exactly on the existing per-facet rail branches. In
`RdApDetail` (rd-allpolls.jsx ~:856) the rail picks ONE content:

- `isDir` → direction facts + `RdApDirMini`
- `isIss` → issues facts + `RdApIssMini`
- `isLd` (new, `facet === "leadership"`) → leader-gap facts + `RdApLdMini`
- otherwise 2PP — the 2PP mini AND 2PP facts are now both guarded
  `{!isDir && !isIss && !isLd}` (boh guards, separately: the mini
  conditional AND the facts block).

## The pair gate — same metric only

`RD_AP_LD_RIVALS` + `rdApLdPairs(a)` (~:496): two pair slots
(`opp`→Taylor-by-default, actual name from `a.oppName`; `han`→Hanson).
A pair enters ONLY when both sides of it answered the SAME question:

```js
a.metricBy[R.met] === a.metricBy.alb   // "fav" or "approval"
```

and `a[R.net]` / `a.albNet` are present. `p.metricOf` never returns
`"appr"` — only `"fav"` else approval; don't branch on `appr` strings.
`gap = a.albNet − a[R.net]`.

Caption metric word: all pairs in the WINDOW one metric →
`net approval` / `net favourability`; mixed → `net leader ratings`.
Facts "Now" row carries the mixed-metric rider "– favourability and
approval are different questions, so each gap here stays on its own".
Copy uses NO article: "on net approval", not "on the net approval".

## Metric toggle — the second question a release prints (2026-10-01)

A wave's metricBy is NOT its whole story: gen-data buildAppr (~:1627)
emits `appr.alt = {alb,taylor,hanson}: {metric:"fav",net}` when a firm
printed BOTH questions in one release (today ONLY Resolve: its
likeability column, inherited as `detail.fav` by the crosstabs reader
— polls.json approval rows carry no splits.fav). Alt is favourability
only and only at approval-primary firms (`altOf()` returns null where
metricOf is already "fav").

`rdApLdAltPairs(a)` (next to rdApLdPairs) turns alt into pair objects
(met:"fav", gap = alt.alb.net − alt[rival].net). The `ldBoth` trigger
in RdApDetail: the caption's metric word becomes a
`<button class="rd-apd-met">` (chevron-free, tagline-flip style) when
(a) every window wave's PRIMARY pair is approval AND (b) some window
wave's appr.alt pairs a rival — i.e. the house publishes both
questions. Clicking flips the word and RdApLdMini's `met` view;
`met==="fav"` rebuilds the window from rdApLdAltPairs (waves lacking
alt drop out; monthly-average line re-scopes to `_*_fav` via
rdApLdMonthGap). An opened poll without its own alt keeps chart+line
but drops its `.rd-apd-this`/`.rd-apd-ring` marks (svg aria ends
"…own readings are on the other question"). State resets on
`[p.pollster, p.released]`. Default view is approval. Single-question
houses keep the static word; Newspoll (the example in the user's
request) has NO favourability ingested, so it never toggles.

## House lean per pair

Slot-level `D.houseEffects.appr = {alb,opp,han}: {firm:{v,n}}`
(gen-data ~:931-960) is stratified by metric+era, so it is valid for
both questions — the same figures the Leadership dot-plot uses. Lean
per pair = `hA.v − hR.v` on that house's slot rows; copy
"about |v| points Albanese's/{Rival}'s way, taken out before its
figures are averaged with the rest"; fallback when unmeasured:
"Not measured yet: too few readings on the series".

`D.leaderNow` keys are `alb_net/_fav, taylor_net/_fav, hanson_net/_fav`
(suffix picks the metric); facts key "Now".

## RdApLdMini component (~:610 chart, helpers ~:496-610)

Sits beside RdApMini (~:196) / RdApDirMini (~:388) / RdApIssMini
(~:670) — search `function RdApLdMini`. Conventions carried over
(see auspol-allpolls-mini-dots for the shared dot contract):

- own 7-month window per house (`rdApLdWindow`), monthly-average line
  from `rdApLdMonthGap` (Taylor→**Ley** fallback on `_*_net`/`_*_fav`
  leaderMonths keys for pre-Taylor months — names differ but the
  series is one slot);
- favourability series get a DASHED avg line + open-face own dot
  (`fill:var(--surface-2)` + tinted stroke) so at most 2 pairs ×
  2 metrics stay distinguishable without colour;
- own `.rd-apd-this` markers per pair → `ownMarkers === ldOwn.length`;
- per-`<circle class="rd-apd-hit">` r=9 pointer/keyboard/touch contract
  copied from RdApDirMini; click opens
  `AP.openPoll(key, "leadership", "the poll you were reading")` —
  facet arg is `"leadership"` here, not `"twopp"`;
- ALL hooks before the data-empty early return.

Facts keys on the leadership rail: `The gap in this poll`,
`Against {Month}` (delta vs monthly average), `{House}'s usual lean`,
`Now`. No-pair-at-all fallback text exists: `{isLd && !ldOwn.length}`.

## Probe traps that cost real time (2026-10-01)

Probe conventions themselves live in auspol-allpolls-mini-dots and
auspol-headless-geometry-verify; these are NEW:

- **The facet TAB LABEL changes with width**: `FACETS` label is
  "Leadership" desktop but **"Leaders" on phone**
  (`label: phone ? "Leaders" : "Leadership"` ~:1284). A probe matching
  `/leadership/i` against tab text silently clicks nothing on the 390
  rung and every downstream assertion then measures the twopp rail —
  symptom looks exactly like `facet !== "leadership"` in jsx. Match
  `/^leaders?$|^leadership$/i` and ASSERT `aria-pressed="true"` on the
  tab before opening any row. When a phone rung renders the wrong
  facet's rail, suspect the probe's tab click FIRST — `RdApDetail`
  receives the same `facet` prop at every width; the phone card JSX
  (:1630-1640) renders `{detail}` with `facet={facet}` just like the
  desktop row.
- **Phone cards have no chevron** — identity keys are
  `.rd-ap-card .rd-ap-c1 .rd-ap-firm` (strip the ↗ glyph) +
  `.rd-ap-c2 .rd-ap-sub` = `[client, field(with ’YY suffix when
  sorted), sample].filter(Boolean).join(", ")`. Desktop rows key by
  the chevron's aria-label `Show the full poll: {pollster}, {field}`.
- **Aria-labels carry NO year** — multiple years share
  "Essential, 24–29 Sep". Disambiguate an open row by reading the
  detail's "Report an error" link `/feedback/?msg={pollster}, {field}
  {YYYY} – ` and matching `individualPolls` on pollster+field+year.
- Don't put raw `t.toLocaleString()`-style expressions in an in-page
  identity map without replicating the exact `fieldTxt` rule
  (~:1454): sorted views append ` ’YY` to the field.

## Verification

`node .build/newtracker/build.mjs`; grep built index.html for
`Albanese minus`, `net leader ratings`; probe (pattern: serve built
index.html, replay `rdApLdPairs`/window/word rules from
`window.AUSPOL` inside evaluate, assert caption string EXACTLY, facts
keys, own-marker count, hover tip starts `Fieldwork `, mouse click →
`openPoll [key,"leadership","the poll you were reading"]`, touch tap
tips-but-never-opens, BOTH widths) — desktop 1280 and phone 390 with
`hasTouch:true` both ALL PASS. validator clean (pre-existing
primary-sum warnings only). Delete the probe afterwards.
