---
name: auspol-mood-panel
description: auspol-tracker — the Snapshot's mood panel ("Economic mood" (the "The " article dropped in 7ae7e3e), below Decidedness) end-to-end: FOUR published confidence gauges on ONE plot, windowed from the 3 May 2025 election (x0 = 2025 + 122/365; full history stays in the payload off-screen) (ANZ–RM consumer weekly, Westpac–MI sentiment monthly dashed, RM business monthly, NAB business monthly dashed). .build/mood.mjs → data/mood.json four lanes (nabBusiness carries conditions on the row, not a 5th line); rows ALSO carry per-release n + fieldwork window + business survey month (advisory fields n / fwStart / fwEnd / fwm — ENRICH_TRY_DAYS=40 re-reads each release's own source through per-lane checker seams; `--enrich-all <ISO>` backfills a date bound, and rowsFor() carries advisory fields forward across feed re-surfaces so steady-state/weekly runs never prune the backfill — 2d29d92 backfilled the whole term window: consumer 72/72, westpac 18/18, NAB 15/15, business 14/17 n with fwm 17/17; shipped 3fc015f with the RM Business multi-line grader fix f9c2b9b) feeding the All-polls confidence facet's Sample/Fieldwork columns (display half 5adfeb5, see auspol-allpolls-confidence-facet). NAB is a net balance drawn shifted +100 so the shared 100=neutral line holds while tooltips/read rows print TRUE published figures; lines are a render-side half-life kernel smooth (14d weekly/60d monthly) over raw-print dots (shipped 283984d on top of b42de69's two-lane smoothing). Probe: .matilda/probe/mood-smooth.mjs (LANES table, x scale re-fit off the measured plot box — the window spans a single year tick, 1366/860/390 rungs).
source: auto-skill
extracted_at: '2026-10-06T11:26:54.223Z'
---

# The economic-mood panel — four gauges, one plot, raw prints under smoothed lines

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
- Render: `RdMood` in `rd-panels.jsx` (~:3786–3938).

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
  f9c2b9b grader: parseRmBusinessPost collects pairs PER LINE, trusts
  only lines with 2+ dated pairs, and needs ONE agreed value for the
  survey month across them. The traps it rejects live on the real post:
  a first-match read parks on the long-run trend line ("Dec 2010–Aug
  2026. Average monthly sample … = 1,159" — a 12-month AVERAGE, not a
  wave's n; filed nothing), and a naive any-line read takes the trailing
  quarter's lone pair ("June – August 2026, n=3,300" — a 3-month sum).
  Disagreement (like the cross-check against the trailing interviews
  sentence, whose month word may lag) files nothing. The live three-line
  shape is the 10336 fixture; the 2026-09-08 wave files n=1094.
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
- LANE COLOURS (0b18d04, user call "more interesting and distinctive"):
  subject hues in `template.html` beside `--mood-pos`/`--mood-neg` —
  `--mood-consumer` oklch(0.60 0.115 83) deep gold, `--mood-business`
  oklch(0.50 0.105 305) plum; dark lifts (0.72 / 0.70, same C·H) in the
  dark block. Both gauges of a subject share the hue (the second dashed);
  chosen on the yellow–blue axis so the subjects split under every
  dichromacy, clear of the party palette (gold ≠ ON orange, plum ≠ COA
  blue) and NOT the teal/brick `--mood-pos`/`--mood-neg` VALENCE pair
  (no good/bad read). Lanes pass the var() reference (`color:
  "var(--mood-consumer)"`) as `var(--ink)` did before: TrendChart writes
  it to the DOM as-is and copy-chart.js's `inkVar` resolver handles the
  copy card. The probe's LANES `color` fields pin the same strings.
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

## Disclosure surfaces (move together)

1. Read rows under the chart (per-lane, true figures; NAB row carries the
   conditions figure in text).
2. HowTo para 1 — names the kernel and both half-lives; "the quoted figures
   stay the raw prints".
3. Glossary s-mood (d1a1d215 asset) — "100 is neutral.", "NAB is drawn
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
