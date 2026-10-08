---
name: auspol-mood-panel
description: auspol-tracker — the Snapshot's confidence panel (titled "Economic sentiment" since the 2026-10-08 mood→confidence rename, below Decidedness) end-to-end: FOUR published confidence gauges on ONE plot, windowed from the 3 May 2025 election (x0 = 2025 + 122/365; full history stays in the payload off-screen) (ANZ–RM consumer weekly, Westpac–MI sentiment monthly dashed, RM business monthly, NAB business monthly dashed). .build/mood.mjs → data/mood.json four lanes (nabBusiness carries conditions on the row, not a 5th line); rows ALSO carry per-release n + fieldwork window + business survey month (advisory fields n / fwStart / fwEnd / fwm — ENRICH_TRY_DAYS=40 re-reads each release's own source through per-lane checker seams; `--enrich-all <ISO>` backfills a date bound, and rowsFor() carries advisory fields forward across feed re-surfaces so steady-state/weekly runs never prune the backfill — 2d29d92 backfilled the whole term window: consumer 72/72, westpac 18/18, NAB 15/15, business 14/17 n with fwm 17/17; shipped 3fc015f with the RM Business multi-line grader fix f9c2b9b) feeding the All-polls confidence facet's Sample/Fieldwork columns (display half 5adfeb5, see auspol-allpolls-confidence-facet). NAB is a net balance drawn shifted +100 so the shared 100=neutral line holds while tooltips/read rows print TRUE published figures; lines are a render-side half-life kernel smooth (14d weekly/60d monthly) over raw-print dots (shipped 283984d on top of b42de69's two-lane smoothing). Probe: .matilda/probe/mood-smooth.mjs (LANES table, x scale re-fit off the measured plot box — the window spans a single year tick, 1366/860/390 rungs).
source: auto-skill
extracted_at: '2026-10-06T11:26:54.223Z'
---

# The economic-mood panel — four gauges, one plot, raw prints under smoothed lines

## RENAMED 2026-10-08 — "Economic mood" → "Economic sentiment" (mood → confidence)

The panel keeps this skill's FILE name; on-screen it is the CONFIDENCE
panel. AS OF WRITING (2026-10-08 evening) the rename sits UNCOMMITTED in
the shared working tree as one sibling WIP cluster — staged renames
`.build/mood.mjs`→`confidence.mjs`, `test-mood*`→`test-confidence*`,
`data/mood.json`→`confidence.json`, `data/mood-history.json`→
`confidence-history.json`, probes likewise, PLUS modified rd-panels.jsx
(+259), gen-data.mjs (+172: §5k past-terms band + months-since-election
axis + CSV export + "Draw a past term"), rd.css (+43), 9f09dca2. HEAD is
still `RdMood`-era (`git show HEAD:…rd-panels.jsx | grep -c RdMood` = 2).
If you read this after that lands, the pipeline names below moved with
it. Every claim verified by grep in current sources (2026-10-08):

- JSX (rd-panels.jsx): **`RdConfidence`** (:3864) — `RdMood` no longer
  exists (exported on window only as `RdConfidence`, :4241). `RD_CONF_VIEWS`
  :3863 (labels Consumers/Businesses). `<RdSec id="confidence"
  cls="rd-confidence" title="Economic sentiment" meta="Confidence indices,
  100 = neutral(+', four published series' wide)">` :4111; `<RdTabs swipe pin
  ariaLabel="Confidence of" className="rd-confidence-tabs">` :4116; RdHow
  term hook "confidence" :4235. Tab ids stay consumer/business.
- CSS classes (rd.css): `.rd-confidence-tabs` :1105 (1125 phone),
  `.rd-cc.rd-confidence-cc` :1106 (1126; the draw-board shares the common
  `.rd-cc` stem), `.rd-confidence-draw` :1107, `.rd-confidence-chart` :1108
  (1127) with read-row rule :1634, plus `.rd-confidence-csv` (export
  button). The read-row `.rd-un-*` class stem was NOT renamed (shared with
  the Decidedness panel's same-anatomy rows).
- LANE COLOURS: `--confidence-consumer`/`--confidence-business` in
  template.html (light :100-101, dark :198-199), consumed by the LANE defs
  `color: "var(--confidence-*)"` (rd-panels.jsx :3878/:3881), and by
  rd-allpolls.jsx `confInk` (:2462). This note's RENDER CONTRACT pre-rename
  claimed the vars were `--mood-business`/`--mood-consumer` — those names
  exist NOWHERE in current sources; treat any such reference as pre-rename
  rot (the pre-rename sources did carry them; the rename moved them).
- `--mood-pos`/`--mood-neg` (template.html :87-92 + dark :194-195) are
  NATIONAL-DIRECTION right/wrong-track colours — deliberately NOT renamed;
  consumers are the direction chart (rd-panels.jsx :1310-1346) and the
  All-polls direction facet (rd-allpolls.jsx, the 13 remaining "mood" hits
  in that file are all these valence refs plus the prose keepers
  "mood-only waves" :1051 and "The net mood of" :1829).
- Comment/title cleanup in the same sweep: rd-allpolls.jsx :2108-2111
  (facet list, "confidence file's"), :2450-2466 (meter + calibration notes,
  "the panel chart draws its line up" / "the panel's NICE"), :2535 (Figure
  sort title "the panel chart's dot"); template.html :83-87 (national-mood
  colours comment notes the confidence panel's gauges). rd.css needed
  nothing — its only mood mentions were the legitimate `--mood-*` valence
  consumers.
- Built-page proof (`grep` on index.html 2026-10-08): 0× `rd-mood`,
  `moodTabs`, `Mood gauges`, `id="mood`, `Economic mood`; present
  `rd-confidence-cc` ×3, `-chart` ×10, `-csv` ×1, `-draw` ×2, `-tabs` ×4,
  `Economic sentiment` ×6, ariaLabel `Confidence of`.

Pipeline-side the v1 plan was "keep `.build/mood.mjs`/`data/mood.json` and
payload key `mood`"; the WIP cluster shows the fuller rename coming
(confidence.mjs/confidence.json — once it lands, `mood` mentions ANYWHERE
in pipeline docs below are pre-rename rot). The ARCHIVED classic layer
(rule 5, frozen — never renamed) still bears the old names:
`a11e1559`…js :1539 `function MoodPanel` (non-rd fallback, reads only
M.consumer/M.business) and `73de0c58`…js :1956 `MoodMemo =
React.memo(MoodPanel)`. NOTE its rd-branch is now DANGLING:
`a11e1559`…js :1540 returns `<RdMood rangeId={…}>` and `RdMood` is defined
nowhere — any rd-mode render of classic MoodPanel would throw
ReferenceError. Frozen archived design, so left as-shipped (rule 5); flag
it if the classic design is ever revived rather than "fixing" it here.
GLOSSARY: the Info glossary section keeps anchor id `s-mood` (d1a1d215-*.js
:7365, `{ id: "s-mood", title: "Economic sentiment", nav: "Sentiment", … }`,
lead id "mood") — the rename changed its TITLE but left the anchor, the
usual stable-URL call; compiled into index.html the object literal reads
`id: "s-mood"` (babel spacing), so `grep 'id="s-'`-style patterns MISS it —
grep the bare `s-mood` string.

## Pipeline map

- `.build/mood.mjs` → `data/mood.json` (never hand-edit rows). Four lanes:
  - `consumer` — ANZ–Roy Morgan Consumer Confidence, weekly; read from the
    SAME WordPress findings-search feed as extract-roymorgan.mjs under its
    own `topic[]` filter; dense from Aug 2019.
  - `business` — Roy Morgan Business Confidence, monthly; same feed, own topic.
  - `westpacConsumer` — Westpac–MI Consumer Sentiment, monthly. Discovery:
    Westpac IQ's ROOT sitemap (the /economics/ section sitemap 302s to
    /Error under any UA). The wave month + printed change come from the
    article's meta description ("…to V in Month from F…"); release date is
    the page's DISPLAY stamp — the JSON-LD datePublished is a bulk-migration
    stamp on pre-migration articles and must never gate the survey month.
    Video-only pages carry no figure and are skipped.
  - `nabBusiness` — NAB Monthly Business Survey, monthly; `cond`/`condChg`
    (conditions) ride the same row, never a fifth line. NAB's AEM sitemap
    lists articles → each links the release PDF; `pdftotext -layout`
    extracts month, release date and the measure sentences; the article
    prose is an independent second witness and a PDF/article DISAGREEMENT
    DROPS the wave rather than picking a side.
- Runs from the weekly crosstabs workflow (`.build/crosstabs-updater.sh`).
  Contract like the poll extractors: idempotent, exit 0 ok / 1 fetch-parse
  / 2 guard, final line `MOOD_STATUS {json}`, `--check` dry run,
  `--feed-dir` fixture mode. Grammar shaped offline against a topic dump
  (`.matilda/probe/mood-grammar.mjs`); 5 headline patterns; unparseable
  releases file nothing (the series just skips that period).
- Figure discipline (never fabricate): a value outside the series' band
  never files; title/summary both carrying a value must agree; the printed
  change is kept only when it reconciles with the previous row
  (cadence-gated — a Christmas gap's printed change refers to the last
  release before the gap); RM "unchanged" is a rounding verdict so those
  rows carry no change.
- `gen-data.mjs` §5j MOOD_FILE passthrough (~:1941). The payload keeps the
  RAW published figures — smoothing lives render-side, never in data.
- Render: `RdConfidence` in `rd-panels.jsx` (:3864; renamed from `RdMood`
  2026-10-08 — see RENAMED above).

## Series history — how far back each gauge goes (researched 2026-10-08)

Current lane coverage in data/mood.json: consumer 2016-12→ (348 rows),
business 2019-09→, westpacConsumer 2022-02→, nabBusiness 2025-05→ (15
rows). Everything below is the FULL published history available for
backfill, verified against RBA research papers and the publishers' own
tables (user asked "how far back does it go?"):

- **ANZ–RM consumer** — monthly readings since **Mar 1973**, weekly
  readings since **Aug 2008** (components only from 1996). Source: RBA
  Bulletin Dec 2015 "Consumer Sentiment Surveys", Table 1 ("Commenced:
  Monthly since Mar 1973; weekly since Aug 2008"). The weekly public
  launch was Feb 2014 (ANZ newsroom media release) with history back to
  Aug 2008. Roy Morgan mirrors the ENTIRE monthly ratings table
  **1973–2026** free at /morgan-poll/consumer-confidence-anz-roy-morgan-
  australian-cc-monthly-ratings (title literally "Monthly Ratings
  1973-2026"; a real 1973 table row confirmed in the pageProps payload)
  — the cheap backfill source for the consumer lane. The on-site weekly
  results table itself only shows ~2020→ (paginated).
- **Westpac–MI consumer** — series since **Sep 1974** (same RBA table;
  index standardised so its 1980-onwards average = 100). Ancestry: ONE
  joint Melbourne Institute (IAESR)/Roy Morgan survey, Michigan-modelled,
  begun **1973** (RBA RDP 2001-09); the houses split ~1990, so the two
  consumer series are near-identical before then. Melbourne Institute
  sells the full CSI time series ("Consumer sentiment index time series"
  datasets on researchdata.edu.au / ecommerce.unimelb.edu.au, ~$363
  per-issue — the CSI_QUART_DATA product); Westpac IQ carries only
  recent releases free. melbourneinstitute.unimelb.edu.au is behind a
  Cloudflare challenge for plain curl.
- **RM business** — the house's public mirror table
  (/morgan-poll/consumer-confidence-roy-morgan-business-confidence,
  "Roy Morgan Business Confidence 2010-2026") covers **2010→**; the
  product is older (2007-era releases exist in the findings archive)
  but no full pre-2010 public machine-readable series was found.
- **NAB business** — survey started **1989** (RBA RDP 2001-09: series
  from "1989:Q3, when the NAB survey started"; quarterly per RDP
  2003-01, the monthly survey carries the same 1989 commencement). NAB
  publishes a historical data workbook with each monthly survey —
  the backfill source for a pre-2025 NAB lane.
- Contrast for "oldest Australian business survey" questions:
  ACCI–Westpac Survey of Industrial Trends **1960** (quarterly; some
  expectations series from 1961/1966 per RDP 2003-01), D&B expectations
  1988–2021 (discontinued). Neither is on the panel.

Verification traps on roymorgan.com pages: year greps LIE — nav links
embed "1973-2026" into every page, so extract the table HTML inside the
`__NEXT_DATA__` pageProps payload and check its actual year-header rows.
RBA docs to cite for history: RDP 2001-09 ("What do Sentiment Surveys
Measure?"), RDP 2003-01 + Bulletin Dec 2011 (business surveys),
Bulletin Dec 2015 Table 1 (consumer surveys).

THE BACKFILL SHIPPED 2026-10-08 (adf8abe): the usable deep history is now
committed as `data/mood-history.json` (consumer 1973→, business 2010→,
westpac 2010→ via RBA H3 GICWMICS, NAB conditions DEVIATION 1997→ via H3
GICNBC — NAB's confidence workbook lead above did NOT pan out: the RBA is
contractually barred and only the H3 deviation series is free). Extractor,
dead-ends map (TradingEconomics guest dead, MI CASiE paid) and the
independent-lane fixture lesson: see `auspol-mood-history-backfill`.

## Per-release enrichment (3fc015f + f9c2b9b, 2026-10-07)

Beyond v/chg, each row can carry ADVISORY fields read back from the
release's own source (ENRICH_TRY_DAYS=40: only releases within 40 days
are re-fetched, so back-history stays at lane-level):

- `n` (int) — the release's own printed sample size.
- `fwStart` / `fwEnd` (ISO) — the printed fieldwork window, always
  written together.
- `fwm` "YYYY-MM" (business lanes only) — the survey month IS the window
  for a monthly business survey; files on every such row from the
  release slug with NO fetch.

Per-lane readers and their rejection seams (all fixture-pinned in
test-mood.mjs; any checker failure files NOTHING for that row):

- **ANZ–RM consumer** (post page + release PDF): n 200–4000 from "based
  on N interviews"; window from the "Last week" cell; year resolved
  within 35 d behind / 5 d ahead of release.
- **RM Business**: dated `Single Source, Mon YYYY, n=N` pairs.
  parseRmBusinessPost(txt, survey, prevN) collects pairs PER LINE,
  trusts only lines with 2+ dated pairs, and needs ONE agreed value for
  the survey month across them. The traps it rejects live on real posts:
  a first-match read parks on the long-run trend line ("Dec 2010–Aug
  2026. Average monthly sample … = 1,159" — a 12-month AVERAGE, not a
  wave's n), and a naive any-line read takes the trailing sum line's
  lone pair-shaped match ("June – August 2026, n=3,300" — a multi-month
  sum named by its END month). Two 2026-10-08 repair forms (pinned in
  test-mood.mjs's 1c block): (1) the trailing blockquote ("…results for
  <month> are based on N…") is BOILERPLATE that survives a release
  unedited — live posts 10064/10276 quote the previous wave's n under a
  month-stale word — so it vetoes a pair figure only when its month word
  verifiably names the survey month, and never costs a pair figure
  otherwise; (2) a mislabeled second pair (live 9994: "June 2025" where
  July 2025 should be, so the survey month never appears in the pairs)
  recovers from the two-month sum ending at the survey month minus the
  PREVIOUS committed wave's n, filed only when the derived figure is
  also printed verbatim elsewhere on the post — arithmetic alone never
  files. The live canonical shape is the 10336 fixture; the 2026-09-08
  wave files n=1094.
- **Westpac bulletins**: "latest survey is based on N adults" (400–4000)
  + "week from d Mon to d Mon".
- **NAB PDFs** (`pdftotext -layout`): footer "Survey conducted from
  d Mon to d Mon, covering around N businesses" (100–3000).

`MOOD_STATUS {json}` gains per-lane enrich counts. Consumer:
gen-data.mjs confidenceOnlyPolls (commit 5adfeb5) → the All-polls
confidence facet's Sample and Fieldwork columns — see
auspol-allpolls-confidence-facet for the per-release provenance law the
display side honours (per-release figure, lane constant only where a
house prints one, else em-dash).

## Render contract (as of 283984d)

- Four lanes on ONE axis; the subject's second gauge is dashed (Westpac
  consumer, NAB business). Lane table carries `by` and `hl`.
- LANE COLOURS (0b18d04, user call "more interesting and distinctive";
  var NAMES renamed `--mood-consumer`/`--mood-business` →
  `--confidence-consumer`/`--confidence-business` in the 2026-10-08
  rename, same values — see RENAMED above):
  subject hues in `template.html` beside `--mood-pos`/`--mood-neg` —
  `--confidence-consumer` oklch(0.60 0.115 83) deep gold,
  `--confidence-business` oklch(0.50 0.105 305) plum; dark lifts
  (0.72 / 0.70, same C·H) in the dark block. Both gauges of a subject
  share the hue (the second dashed);
  chosen on the yellow–blue axis so the subjects split under every
  dichromacy, clear of the party palette (gold ≠ ON orange, plum ≠ COA
  blue) and NOT the teal/brick `--mood-pos`/`--mood-neg` VALENCE pair
  (no good/bad read). Lanes pass the var() reference (`color:
  "var(--confidence-consumer)"`) as `var(--ink)` did before: TrendChart
  writes it to the DOM as-is and copy-chart.js's `inkVar` resolver handles
  the copy card. The probe's LANES `color` fields pin the same strings.
- Dots = raw prints (every quoted figure on the page is a published print).
  Lines = symmetric half-life kernel smooth evaluated at each reading's
  date: decay = ln2/(hl/365.25), weight exp(−decay·|Δx|), skip w<0.02.
  Half-lives: 14 d on the weekly consumer index, 60 d on all three monthly
  series. `rows` Map (raw) vs `sePoints` (smoothed); domain and spine come
  from raw.
- NAB is a NET BALANCE (0 = neutral) plotted shifted +100 so the shared
  "100 = neutral" rule line holds. NAB is smoothed on the TRUE balances,
  then shifted — a constant shift commutes through the linear kernel
  (smooth(x+c) ≡ smooth(x)+c), so either order is identical; don't
  "optimise" this away. Payload, read rows and tooltips always print the
  TRUE published figure (e.g. −8 read as −8, plotted at 92).
- TrendChart `fmt` takes (y, point) — a series whose plotted y is a display
  transform prints its true value via `raw` carried on the points. RdKey
  kinds: dot ("One release, as printed"), line ("Smoothed trend of the
  releases"), dash (the second gauge per subject).
- Legacy: the a11e1559 non-rd MoodPanel fallback reads only
  M.consumer/M.business — the four-key payload is harmless to it.
- LEGEND SWATCHES (481a956, user-reported 2026-10-08, probed
  `.matilda/probe-mood-indent.mjs`): each `.rd-un-read` read-row is a
  flex row of a `RdSwatch` svg plus a text div. The NAB and Westpac
  dashed rows read 6–10px left of the two solid rows because the svg
  carried the default `flex-shrink: 1` — NAB's long generated `l.short`
  paragraph inflates the text div's min-content width and the flex row
  compressed the dashed svg toward ITS min-content width (~17.6px
  desktop / ~6.5px phone of its 24px). Fix: `flex-shrink: 0` on
  `body.rd .rd-un-read svg` (rd.css ~:1596), mirroring the existing
  `.rd-key-item svg` convention at :173. General rule: any fixed-width
  swatch/icon svg inside a flex legend row must be unshrinkable. Any
  "legend rows misaligned" report → headless-geometry probe measuring
  per-row swatch/text `getBoundingClientRect()` at 1280/480px, never
  screenshots.
- READ-ROW FIGURE COLUMN (measured 2026-10-08, user question pending
  implementation): inside `.rd-un-rtop { display:flex;
  align-items:baseline; gap:10px }` (rd.css :1607–1614; JSX
  rd-panels.jsx ~:3935) the order is `<b>` lane name → `.rd-un-rhouse`
  publisher → `.rd-un-rv` figure (19px tabular-nums) → `.rd-un-rci`
  change badge, so each row's figure x drifts with the publisher-name
  width — measured figure left edges 215–284px across the four rows at
  1280px (~69px drift; ANZ–Roy Morgan's publisher span is 93px vs
  NAB's 24px, and NAB's "−8" figure is also the narrowest at 22.8px),
  and the publisher+figure crowd the change badge at ≤390px. Fix
  direction discussed with the user: right-align `.rd-un-rv` into a
  shared column — give the publisher span the flex slack
  (`flex: 1; min-width: 0` effectively) or grid `.rd-un-rtop`; the
  SAME anatomy exists in the classic card (rd-panels.jsx ~:3525 /
  a11e1559 ~:1587 region) and must move with it. Geometry probe
  `.matilda/probe/mood-figure-column.mjs` (1280/820/390/320 rungs)
  was written for the measurements — keep/extend it if the alignment
  ships. Note it is content-dependent: a longer publisher string or a
  wider figure re-drifts the rows, so pin the COLUMN GEOMETRY (all
  figures at one x), not the current per-row values.

## Disclosure surfaces (move together)

1. Read rows under the chart (per-lane, true figures; NAB row carries the
   conditions figure in text).
2. HowTo para 1 — names the kernel and both half-lives; "the quoted figures
   stay the raw prints".
3. Glossary `s-mood` (d1a1d215 asset :7365; the ANCHOR kept the old name
   through the 2026-10-08 rename, the entry itself is titled "Economic
   sentiment", nav "Sentiment") — "100 is neutral.", "NAB is drawn
   100 points up.", "Smoothed, not averaged across sources." (never claim
   cross-source averaging — the four series are joined as released, "No
   combining, no adjustment").
4. RdFoot — "Four published gauges … Context, not a predictor."

## The probe

`.matilda/probe/mood-smooth.mjs` (~370 lines, tracked; generalised from
b42de69's two-lane original): LANES table {k, hl, gate, live, color, lab,
shift?}; recomputes each lane's kernel with its shift and asserts every
path vertex ≤0.06 px through it; asserts dots are raw per-print; NAB check
reads "the last print's dot sits exactly on it (…, −8 plotted 92)"; copy
pins (title, dek raw quotes, "(conditions −1)", readout order, key, HowTo,
foot); 1366/860/390 rungs. ANY change to smoothing constants, lane set,
NAB shift, or the four disclosure surfaces must keep this probe green —
extend it, never weaken or orphan it.

## Origin / merge history (for the "why both" question)

b42de69 shipped render-side smoothing for the two-lane RM panel; 283984d
(same-day race) added Westpac + NAB and was landed ON TOP of the smoothing
machinery generalised to four lanes — both features coexist by design.
See the "raced by a complementary feature commit" rung in
`auspol-clean-artifact-commit`.
