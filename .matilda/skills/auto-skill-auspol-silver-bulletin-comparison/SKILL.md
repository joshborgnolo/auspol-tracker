---
name: auspol-silver-bulletin-comparison
description: auspol-tracker — answering "compare Nate Silver's average/methodology with ours" (worked 2026-10-03). Silver Bulletin (natesilver.net) is US-ONLY (Trump approval, generic congressional ballot, Musk favourability) — NO Australian average, so comparisons are methodology-only. His pages are server-rendered Substack — plain curl + browser UA works (no Chrome piggyback); pages are ~200KB of inline @font-face CSS, so strip tags and search keyword WINDOWS (head-of-file dumps are useless). Methodology explainer is FREE, per-pollster ratings table is PAYWALLED, and no decay constant is published anywhere. Also records the assets/auspol-now.json headline-probe anatomy used to read our side of the comparison.
source: auto-skill
extracted_at: '2026-10-03T13:23:36.995Z'
---

# Comparing Nate Silver's average/methodology with ours (auspol-tracker)

Prompt shape: "Compare Nate Silver's polling average with this site's"
/ "does he publish his methodology? decay rate? quality weighting?"
(worked 2026-10-03). Companion: `auspol-external-aggregate-triage`
(Bonham/BludgerTrack comparators), `auspol-headline-estimator` (our
constructions).

## 1. What Silver Bulletin tracks (as of 2026-10)

US-only. Live trackers: **Trump approval** (net −22.7 on the 2 Oct 2026
update, an all-time low ~−23), **generic congressional ballot** (launched
22 Jan 2026, Dems +5.3 at launch), **Musk favourability**. Nothing on
Australia. Frame every answer as METHOD comparison, never topline-vs-topline
(net approval margin vs our 2PP share are different electorates AND
different measures).

## 2. Where his methodology is published

- FREE: `https://www.natesilver.net/p/silver-bulletin-polling-average-methodology`
  ("How Silver Bulletin calculates our polling averages", Silver &
  McKown-Dawson, 22 Jan 2026) — the weighting explainer. Section anchor:
  `#how-we-weight-polls` (same URL, `/i/185402330/how-we-weight-polls`).
- PAYWALLED: `https://www.natesilver.net/p/pollster-ratings-silver-bulletin`
  (letter grades per pollster, Jan 2026 vintage). Its JSON-LD says
  `"isAccessibleForFree":false` — curl returns only the meta description
  ("letter grades and accuracy ratings for every American pollster") +
  Substack chrome. Do not burn time trying to extract the grade table.
- FAQ-style short version: `…/p/trump-approval-ratings-nate-silver-bulletin`
  (also carries the LIVE topline — regex `(-?\d+\.\d+) net approval`).

## 3. Fetch/extract recipe (Substack)

Plain `curl -sL -A "<browser UA>"` suffices — server-rendered, no
chrome-session-piggyback needed (unlike pollbludger.net). Traps:
- ~150–200KB per page, dominated by inline `@font-face` CSS. Printing the
  first N chars of a tag-strip is USELESS for the same reason (CSS comes
  first). Instead strip tags (`re.sub(r'<[^>]+>',' ',html)` +
  `html.unescape`, collapse whitespace) over the WHOLE file and print
  keyword context windows ('influence score', 'house effect', 'likely
  voter', 'How we weight polls').
- A container regex on `class="body markup"` did NOT isolate the article —
  keyword-window search on the full stripped text is the reliable path.

## 4. His method, as published (cache of the 2026-10-03 read)

- Per-poll **influence score** = pollster rating × sample size × recency.
  Sample size has deliberately diminishing returns ("less difference than
  in theory… determined empirically"). Recency term is "determined
  empirically, based on which settings best predict new polls over the
  subsequent two weeks".
- Smoother: **local polynomial regression (LOESS)**, blend of aggressive +
  conservative settings, calibrated so the current average best predicts
  the next survey. Approval settings MORE aggressive (faster) than generic
  ballot; generic ballot gets more aggressive toward Election Day.
  **No decay constant / half-life is published** — 538's old explicit
  exponential decay is gone.
- Quality = pollster rating: historical accuracy + membership of
  professional orgs promoting transparency/disclosure (538/NCPP/AAPOR
  tradition). Exclusions: banned firms (suspected faked data),
  nonprofessional DIY polls; undisclosed campaign work → auto-"partisan".
  The rating→weight multiplier is NOT in the free article.
- House effects: iterative; proportion adjusted is shrunk by the firm's
  aggregate sample (≈100% for very frequent pollsters, small fraction for
  one-offs); separate adjustments for approve AND disapprove (undecided
  share adjusted too); higher-rated firms weigh more in the "true north"
  target; partisan-sponsored polls excluded from generic-ballot true north.
  Generic ballot uses a slightly different ramp formula than approval.
- Anti-flood: a firm's window weight caps at its aggregate voters
  contacted and is divided among its surveys in the window; extra
  adjustment for overlapping tracking-poll samples.
- Version priority: generic ballot LV > RV > all-adults; approval the
  opposite (plus a separate LV-only approval average); leaners-included
  preferred; multiple turnout models averaged. Updates ~6×/week.

## 5. Our side of the comparison — quick headline probe

All our constants are published in `gen-data.mjs` (21-day window, 7-day
half-life, half-cosine taper, √m wave cap, shrunk house effects, frozen
AEC-2025 flow implied-2PP as the DEFAULT basis since 6cdfa7e). The honest
framing line that worked: "we publish fixed constants; he publishes the
recipe and keeps the constants private (calibrated to predict the next
two weeks of polls)."

Read the CURRENT headline WITHOUT a build via `assets/auspol-now.json`
at REPO ROOT (same PATH-FIRST trap as auspol-bundle-data-probe — it is
NOT under .build/newtracker/assets; another copy lives in
.worktrees/bisect). Minified keys:
- `a` = ALP 2PP headline on the current basis (51.7 on 2026-10-03),
  `b` = rival share, `basis` = basis id ('imp' here), `rival` = pairing
  ('onp'), `dial.leader`/`dial.right` = dial metadata.
- `latest.fact` / `latest.publishedISO` / `latest.pollsTracked` /
  `latest.housesTracked` / `latest.nextElectionDue` = status strip.
- Deploy check: `md5` local vs
  `https://auspoltracker.com/assets/auspol-now.json` — byte-identical =
  deployed build matches the local tree (verified 2026-10-03).

## 6. Answer shape that worked

1. Lead with the catch: he has no Australian average → method comparison.
2. Small table: measure / current figure / default basis / weight inputs.
3. Substance bullets keyed to the user's exact sub-questions (decay,
   quality, weighting) citing what's FREE vs PAYWALLED vs NOT PUBLISHED.
4. One-line philosophy contrast (fixed published constants vs empirical
   two-weeks-ahead calibration). Do NOT attempt divergence triage numbers
   across the two — different electorates make arithmetic gaps meaningless.

## 7. The follow-up push: "test out that predict-the-next-two-weeks method
   for this site" (worked 2026-10-03)

The natural next ask after §4–6 (user's exact words: "test out that
'calibrate against what best predicts the next two weeks of polls' method
for this site"). DO IT as an estimator arms race with a new FWD14 scoring
mode — see `auspol-estimator-arms-race` (FWD14 recipe + train/test split
rules + the NO_AGG_HOUSES replica trap that cost a parity round). Probe:
`.matilda/silver-calibration-backtest.mjs`; dated write-up:
`.matilda/silver-calibration-2026-10.md`.

Outcome worth quoting: Silver's criterion, run on our data, **re-elects
our own constants** (21/7/14). Aggressive decay (≤5d half-life / ≤14d
window) loses out-of-sample with CIs clear of zero under BOTH FWD14 and
LOO; the smooth family is within noise of production out-of-sample
(FWD14 test |ΔMAE| ≤ 0.012). The criterion itself is underpowered at
Australian cadence (~1.3 2PP polls/week vs his dozens — effective sample
collapses because a poll recurs in up to 14 forward windows). The one
Silver-ism that survives: out-of-sample, the data wants MORE smoothing,
never less — and the election anchors already veto that (2026-10-02 race).
Nothing shipped.
