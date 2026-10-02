---
name: auspol-external-aggregate-overlays
description: auspol-tracker — the hero 2PP chart's "Compare outside estimates" overlay (shipped 5bf0e64 2026-10-02; restyled same-day for "bumpy Bonham" + thin coloured SOLID lines + Bonham's ON shadow; both comparator lines then month-anchored and labels plain publisher names, same day) END-TO-END — BludgerTrack rides as-published SAMPLED TO MID-MONTH ANCHORS (.build/extract-bludgertrack.mjs → data/bludgertrack-2pp.json, 140 pts since 2025-05-19, gen-data btMidMonth interpolates; AUDITED 2026-10-02, .matilda/bt-line-accuracy-2026-10.md: mirror was bit-exact but of ALP2in = his scatter-DOT series; FIXED SAME-DAY in efbc280 — extractor now mirrors ALP2out, his published trend line/headline, refreshed 4×/day by pollbludger-updater.sh's second duty), Bonham is a REPLICA not a mirror (.build/newtracker/bonham-replica.mjs re-runs his published method over our polls, validated by .build/check-bonham-replica.mjs against 62 as-published anchors in data/bonham-2pp.json — launched 2025-09-26: the launch-day fig is a quoted constant, every earlier non-public value is VACUOUS BY CONSTRUCTION), gen-data §6b emits D.extAgg {bt, bonham:{replica MONTH-ANCHORED + live tail, published, shadow, site}}, rd-hero.jsx draws thin SOLID publisher-coloured lines (EXT_KB #7e52a8 purple / EXT_BT #10998d aquamarine, rdWidth 1.5, no dash) — kbonham+btrack on the Coalition contest, Bonham's shadow-2PP alone (as-published; ALSO primary-derived — "my conversion", his own 2025-preference estimates 72% Coalition / 9% Greens to ON, pooled latest-ten ≤2/house) on the One Nation contest. End labels were pulled the same day (legend below names them); keys wear plain publisher names (both Bonham lines just "Bonham" — the rebuilt/published distinction lives only in RdFoot copy). Also covers the reusable PATTERN: back-derive an aggregator's unpublished history by re-implementing his published method and validating against recovered published stamps.
source: auto-skill
extracted_at: '2026-10-02T04:17:50.527Z'
---

# External-aggregate comparator overlays (hero 2PP chart)

User request (2026-10-02, pushed 5bf0e64): chart Kevin Bonham's and
BludgerTrack's 2PP lines as alternates on the hero, "going back to May
2025". Three subsystems, then the reusable pattern.

## The replica pattern (why Bonham is rebuilt, not scraped)

Bonham publishes only his CURRENT two sidebar figures — no downloadable
history. The pivot ("don't we know bonham's formula? … back-derive his
2pps at each point in time?") landed the method:

1. **His method is published** (methods page 2025-09-26 + update log +
   conversion coefficients in the roundup's "Interim Last-Election
   Preference Flows" block). Re-implement it over OUR poll set →
   `.build/newtracker/bonham-replica.mjs` (age decay ×0.618/wk, 60:40
   youngest:oldest fieldwork weighting with the un-backrun 2025-10-06
   cutover, 2-heaviest-per-house anti-swamp, accuracy weights
   Newspoll 1.35 / RedBridge 1.11 / new-house 0.8, n<900 halved,
   dated rule gates B_RULE_DATES, house effects ≥0.5pt iterated once,
   freeze-fill interpolation, 7-day smooth). All constants + known
   unknowns documented in the module header — keep it the source of truth.
2. **His real published figures are recoverable** — 62 stamp rows in
   `data/bonham-2pp.json` (2025-09-26..2026-09-30, latest 52.3):
   live scrapes + Wayback replays (below) + the 2025-09-26 LAUNCH-DAY
   figure 56.3 quoted in his methods post itself (aggregate launched
   2025-09-26 — nothing he published exists earlier; his own activity
   rule kept the machine dormant through May–June 2025 and he only
   ever quoted ONE informal "Cross-poll estimate 56.3" in the window,
   the 2025-09-17 roundup). These are the VALIDATION data,
   deliberately not charted.
3. **Validate, report, label honestly** — `.build/check-bonham-replica.mjs`
   (exit 0 always, a report not a gate): mean |dev| 0.54 pts, median 0.5,
   max 1.5, signed +0.52 (the unseen per-house accuracy weights lean
   Newspoll-heavy → replica runs ~½pt ALP-high), dead-on at the latest
   stamp. Everywhere it's drawn it's named "rebuilt"/"reconstruction";
   the RdFoot provenance sentence carries the caveat.

Apply the same pattern to any aggregator with a published method and
recoverable spot values. Expect ~½pt tracking, not parity — the recipe
never includes every ingredient.

## The data pipelines

- **BludgerTrack**: `.build/extract-bludgertrack.mjs` mirrors the
  plain-curl XML feed (see auspol-external-aggregate-triage for the feed
  anatomy) → `data/bludgertrack-2pp.json` (140 dated ALP-2PP pts from
  2025-05-19). Rides as-published; `feed` URL travels in the payload.
  **ACCURACY AUDIT 2026-10-02 (`.matilda/bt-line-accuracy-2026-10.md`),
  FIXED SAME-DAY in efbc280**: the mirror was bit-exact (140/140 pts,
  dev 0.0000 vs live feed) but of **ALP2in — his per-release readings
  (the scatter DOTS on his own chart), not his published trend line**.
  BludgerTrack draws ALP2**out** (outlier-excluded) as his line and
  publishes it as his headline figure. Wrong-sibling cost: mean 0.97pt /
  max 3.13pt over the term (2in biased ALP-low, worst Feb–May 2026);
  live legend read 52.4% where he publishes 52.2. The fix: the extractor
  now reads `ALP2out`/`LNC2out` (~1 line, guards unchanged) AND carries
  a SCHEDULED REFRESH in the same change — 2in points are ~immutable so
  a one-shot mirror survived, but 2out back-casts every issue (verified
  across 5 Wayback captures: all old points move, up to 1.8pt), so a
  stale 2out mirror would silently rot. `pollbludger-updater.sh` (the
  fallback agent's wrapper, running 4×/day via poll-agent.yml) runs
  `extract-bludgertrack.mjs --apply --xml .build/pollbludger-src/
  current.xml` as a BEST-EFFORT second duty against the freshly
  validated cache — a comparator wobble logs WARN and can never fail
  the poll agent; BT_CHANGED joins the commit gate so comparator-only
  moves still validate/refresh_site/commit/push (adding
  data/bludgertrack-2pp.json beside the SITE_FILES). The regenerated
  series ends ['2026-09-26',52.2] — matching his published headline to
  the tenth. The mid-month lattice needed no change: its error was mean
  0.94/max 3.42pt against the jumpy 2in but is mean 0.032/max 0.164pt
  against the genuinely smooth 2out.
- **Bonham sidebar live**: `.build/extract-bonham-sidebar.mjs` scrapes
  the sidebar widget, guards figures (figureOk), stamps his "Last update
  D Mon" (year inferred vs NOW), merges atomically.
- **Bonham Wayback backfill**: `.build/bonham-wayback-backfill.mjs` —
  CDX `url=kevinbonham.blogspot.com/` with `collapse=timestamp:8` (daily),
  replay via `web.archive.org/web/{ts}id_/…` (id_ = original bytes, no
  Wayback chrome). Rows keyed on HIS stamp (a week of captures between
  updates collapses to nothing); same stamp + newer capture WINS (he
  corrects in place). `--every-days` default 1 — captures are already
  daily-collapsed, thinning only costs rows (a 2026-08 capture was
  almost lost this way). Full-density `--apply` re-sweeps pay: the
  2026-10-02 re-run of the whole span recovered 12 stamps the first
  pass missed (captures added later / earlier thinnings).
  **Wayback MISLABELS captures**: CDX row 20250926101724 for the front
  page actually carries a 5-Oct widget (bytes verified) — the stamp
  earns a year only in stampDate, and the ONLY legitimate previous-year
  case is a DECEMBER stamp on a JANUARY page (shared-parser stampDate
  comment; the old "any ahead-month ⇒ previous year" rule minted a
  phantom 2024-10-05 that passed date<=capture). A mislabeled stamp
  lands AHEAD of its page month, so the guard skips it. Failed parses
  are skips, not fatal; "parser rot" (exit 2) keys on the `recognised`
  counter (a capture that parses but guards out still proves the
  parser healthy — keeps the Sep-2025 window, whose only capture is
  exactly that mislabel, exit 0). Dry-run default, `--apply`
  writes. **Wayback is sparse mid-2026** (2 captures Jun–Sep): the
  Jun–Aug gap is archive ABSENCE, documented in the data file, not
  fixable by more scraping.
- **SHARED PARSER RULE**: live extractor and backfill both import
  `{stripTags, parseSidebar, stampDate, figureOk}` from
  `.build/bonham-sidebar-shared.mjs` — two readers of the same widget
  must never drift. If the widget changes, fix it there once.
- **schema trap**: `data/polls.json` root is an OBJECT — it is
  `JSON.parse(...).polls`, not iterable directly (crashed the checker
  on first run).

## gen-data §6b → D.extAgg

`.build/newtracker/gen-data.mjs` §6b (after the individualPolls sort,
before §7): `readDataJson` (try/catch → null) reads both JSONs;
`xOfIso(iso) = mx(ymOf(iso)) + (dayOf(iso)−15)/365` — the individualPolls
x convention; emits `const extAgg = …` into the data asset
(9f09dca2-*.js) AND returns `extAgg` (both homes — the asset const at
index.html ~:24993 is the inline copy). Shape:
`{bt: {points:[{x,y}], feed} | null, bonham: {replica:[{x,y}], published:[{x,y}], shadow:[{x,y}], site} | null}`.
Either branch nulls if its file is absent — every consumer must guard.
The replica runs INSIDE gen-data (imports bonhamReplica), so the shipped
line recomputes on every build.

**BOTH COMPARATOR LINES RIDE THE MONTH-ANCHOR LATTICE (2026-10-02, the
"bumpy" fixes)**: the raw ~140-point BludgerTrack daily publish line and
Bonham's ~500-point daily 7-day-MA both drew as jitter beside the
month-anchored house lines. §6b samples each onto
`MONTHS.map(ym => ({x: mx(ym), y}))` + ONE live tail vertex —
BludgerTrack by LINEAR INTERPOLATION between its bracketing published
points at each mid-month (`btMidMonth`, never extrapolates), the Bonham
replica by exact `smByIso.get(ym+"-15")` lookup (drop start months whose
day-15 precedes MA warm-up; a mid-series gap means freeze-fill broke,
investigate). `mx` yields decimal years (mid-July 2025 = 2025.5416…), so
consecutive anchors are exactly 1/12 apart — the probe's month-anchor
assertions key on that. The DAILY series stay the source of truth:
BTRACK untouched on disk, bonham-replica.mjs untouched on return (its
daily output remains check-bonham-replica.mjs's substrate); sampling is
display-only and changes nothing either man published. `shadow` =
KBONHAM.shadow mapped through xOfIso — Bonham's published ALP-v-ON
sidebar stamps.

## The hero overlay (rd-hero.jsx, RdHero)

Contract mirrors the showSynth compare block (`cmpOn = … && !morph …`):

- **State home: local `useState(false)` in RdHero** (`showExt`) — nothing
  but RdHero consumes it (unlike showSynth, which the old+new heroes
  share, hence its parent home). Survives basis/contest morphs because
  RdHero itself doesn't remount.
- **Gate**: `isCoal = shown === "alp_lnp"`, `isOn = shown === "alp_on"`,
  `extAvail = (isCoal && !!(extBt || extKb)) || (isOn && !!extSh)` —
  since 2026-10-02 the checkbox is offered on BOTH contests; BludgerTrack
  publishes no ON pairing so the shadow rides alone there. The series
  follow the gate (kbonham/btrack Coalition-only, kbsh ON-only); state
  persists across round trips. `extOn = showExt && extAvail && !morph`.
- **Series**: pushed AFTER cmp, BEFORE main so the 3px house line sits
  on top, all at **rdWidth 1.5, coloured by PUBLISHER** —
  `EXT_KB = "#7e52a8"` (purple) on kbonham AND kbsh, `EXT_BT = "#10998d"`
  (aquamarine) on btrack — SOLID (user 2026-10-02: "the thinness and
  stand-out colours suffice"; short-lived `dash: "7 4"`/`"1.6 3.4"`
  shipped the morning of the restyle and were pulled the same day).
  TrendChart honours `s.rdWidth` verbatim. Publisher colours keep the
  comparators out of the party-hue family (and the Yes-green of the
  tsig tables is deliberately unused). NO endLabels at any width
  (user 2026-10-02: "get rid of the in-chart bludgertrack and bonham
  labels - there's already a legend below". They briefly carried the
  plain publisher names — "Bonham", "BludgerTrack", per the same-day
  "just say bonham" note — but the engine's every-chart label recipe
  ink-dilutes any colour without a `-text` token 62% colour / 38%
  --ink for glyph contrast, so the aquamarine label visibly greyed
  away from its line; out they came). The names live
  solely in the keyItems / copyKey / narrow in-chart RdKey — and since
  2026-10-02 (user: "in legend, call it Bonham's estimate /
  BludgerTrack's estimate … link them to bonham's website and bludger
  track's website … label should read eg 'Bonham's estimate (current
  estimate figure for Labor)'") every key entry reads "<Publisher>’s
  estimate (N.N%)" — the figure interpolated off that series' last
  point (lblExtBt/lblExtKb/lblExtSh constants beside the series block;
  the desktop BludgerTrack entry keeps its trailing ", as published"
  qualifier AFTER the figure) — and the desktop keyItems + narrow RdKey
  entries are LINKED, BludgerTrack → the pollbludger.net feed URL,
  Bonham → kevinbonham.blogspot.com, both URLs read off D.extAgg's own
  `feed` / `site` fields so they travel with the data. The live keys
  required an RdKey that can LINK: rd.jsx's RdKey gained an optional
  `href` item branch emitting `<a class="rd-key-item" target=_blank
  rel="noopener noreferrer">` around the same swatch+label (rd.css
  styles a.rd-key-item like a quiet content link — var(--ink-2), hover
  underline); copyKey entries carry the same labels but no href (a
  flat SVG legend, nowhere to click) (see
  auto-skill-auspol-endlabel-colour
  before ever touching label colours). points run through
  `filterPts(pts, xDomain[0])`.
- **y-window**: fold the ACTIVE contest's comparator values in OUTSIDE
  the memoised `domainOf` (Coalition: extKb+extBt; ON: extSh) on the
  same 5-pt lattice (floor(min+0.3)/5, ceil(max−0.3)/5) — in practice
  hugging the house line, so ticks almost never move (probe asserts
  invariance per contest).
- **Homes**: desktop RdCheck inside RdTabs after the synth check; narrow
  RdCheck below the chart; keyItems + copyKey + narrow in-chart RdKey
  all gain LINE entries labelled "<Publisher>’s estimate (N.N%)" (BludgerTrack
  desktop adds ", as published" after the figure; the live keys —
  not copyKey, it's a flat image — link out per the RdKey href branch). RdFoot sentences split by
  contest: Coalition carries the rebuilt-method provenance sentence; ON
  carries the true method ("rides as he publishes it: primaries off his
  own estimates of 2025 preferences, pooled as the latest ten polls with
  at most two a house…") — the shadow is PRIMARY-DERIVED too ("my
  conversion", his own 2025-preference estimates of 72% Coalition / 9%
  Greens flow to ON, methods-page update log 28 Jan 26 → latest-ten pool
  11 Mar 26, no weighting/levelling), a different CONVERSION and pool
  from our frozen-2025 implied line, so it need not hug it. The
  respondent-ALLOCATION story belongs to the FIVE POLLSTERS' published
  shadow pairs — his Sep 2026 "flat field" post critiques them; an
  earlier version of this note's foot called HIS shadow
  respondent-allocated, which was wrong (fixed 2026-10-02).
- **NOT charted**: bonham.published (62 anchors) — TrendChart `marks`
  are labelled rings for counts (election results); 62 of them is
  clutter. They stay validation data. The shadow is charted precisely
  BECAUSE it's the only as-published series of the three — don't
  "validate" it point-for-point against the implied-flows main line:
  same basis family (primary-derived), different flow table (his
  estimates, not the counted 2025 one) and no weighting, so honest
  divergence is expected.
- Probe: `.matilda/probe/hero-ext-compare.mjs` (gitignored, 44 checks —
  node-side payload lattice/shadow shapes, both rungs × both contests,
  toggle on/off, basis flip, contest round trip, tick invariance per
  contest, phone no-overflow). Probe traps learned: (1) RdQPop stays
  OPEN across a morph — a helper that "opens" the popover before
  switching the basis must check `.rd-qpanel` isn't already mounted or
  the click TOGGLES it shut (flipBasis-only-if-closed pattern);
  (2) **checkbox presence is no longer a contest marker** — the overlay
  is offered on two contests, so `ensureCoalition` must key off the
  chip-list contract (the ACTIVE contest is absent from the
  `.rd-tpp-switch .rd-chip` row; a "Labor v Coalition" chip means we're
  NOT on it). Probing ON-contest behaviour with the old checkbox test
  passes/halts on the wrong contest.

## Refresh

`data/bludgertrack-2pp.json` grows via extract-bludgertrack.mjs, run
4×/day by `pollbludger-updater.sh` (best-effort second duty, wired
2026-10-02 efbc280 — see the audit note above); `data/bonham-2pp.json`
via extract-bonham-sidebar.mjs (backfill only for gaps; still
unscheduled, a natural follow-up — Bonham's replica recomputes inside
gen-data every build and his stamps are validation-only, so it needs
no cadence). Any replica drift: run
check-bonham-replica.mjs; a step
change in mean dev after a date means one of his rule tweaks (see
B_RULE_DATES / his update log) isn't mirrored yet.
