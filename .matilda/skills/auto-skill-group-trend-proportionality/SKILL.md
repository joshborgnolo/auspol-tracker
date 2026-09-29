---
name: group-trend-proportionality
description: "Testing whether a subgroup's trend diverges from an all-voters trend (worked 2026-09-29 on auspol-tracker's vote-by-group panel): an absolute point-gap slope flags PROPORTIONAL growth as divergence — a share that grows at the same multiple as everyone else still moves its point-gap because the levels differ (the '60 and 60,000' illusion). Always run the two-stage audit: (1) WLS slope of the absolute gap, (2) re-test the flagged set on the ln(group/anchor) scale and classify: abs-sig + ratio-sig = OUT OF PROPORTION; abs-sig + ratio-quiet = pace-keeping. Carries the demographics monthly payload anatomy, the WLS recipe, multiplicity counting, and the auspol 18–34/55+ ONP cautionary tale (the site's own chip-array comment says exactly this)."
source: auto-skill
extracted_at: '2026-09-29T00:00:00.000Z'
---

# Group-vs-all trend tests: audit proportionality before claiming divergence

Asked whether vote-by-group combos drift from the all-voters line, the
naive test (slope of the point-gap on time) finds 20 of 125 combos
"significant" — the user's proportionality challenge then invalidates
most of the headline ones. The audit splits the set three ways:

1. Absolute point-gap slope ≠ drift. If a party's national share roughly
   triples (ONP 9.7→31.4 fitted), a group keeping the same RATIO to the
   average moves 2.5× its own level (18–34: 7.1→19.6) — its absolute gap
   drifts by mechanics alone. The working script's WLS t = −5.98 said
   "diverging"; the ratio said "mostly keeping pace".
2. Re-test on the multiplicative scale: slope of ln(group_i / anchor_i)
   on time, same weights. Pace-keeping groups hold a constant ratio, so
   their log-ratio slope sits at zero.
3. Classification: |t_abs| ≥ 1.96 AND |t_lr| ≥ 1.96 → OUT OF PROPORTION
   (genuine divergence); |t_abs| sig, ratio quiet → proportionate
   pace-keeping, NOT a story. Borderline |log t| 1.8–2.0 gets called
   borderline, not hidden (ONP 18–34 sat at −1.95: ratio 0.73→0.62,
   real but marginal).

The site's own renderer comment (a11e1559 asset, above DEMO_PARTIES)
makes the same point for DISPLAY panels: "One Nation grew 3.5-fold over
the chart, and a group giving it two-thirds of the national rate sits 3
points under at 8% and 9 under at 27%, so points read growth as a
deepening divide" — this skill is the same lesson for TESTING.

## Recipe (working script: .matilda/demo-trend-test.mjs)

Payload probe first (details in auto-skill
vote-by-group-all-voters-anchor):

```js
globalThis.window = {};
await import("./.build/newtracker/assets/9f09dca2-….js");
const dm = window.AUSPOL.demographics;
// dm.tabs[].sets[].groups[].monthly rows: [ym, 5 shares (dm.order =
// alp,lnp,onp,grn,oth), 5 95%-margins] — NO group n; dm.allMonthly =
// the anchor, [ym, …same party order] (§7g guards allMonthly ≡ aggPrimary).
```

Per set×group×party combo:
- y = group share − anchor share per month; x = month index. The
  monthly row carries NO n (this doc's first draft said row[11] was n;
  the row is 11 long so `row[11] || 1` silently ran UNIFORM weights,
  and `row[row.length - 1]` weights by the oth MARGIN — both wrong).
  The corrected 2026-09-29 recipe takes the precision of the party's
  own 95% margin, which the row does carry:
  `const se = Math.max(0.5, row[6 + k]) / 1.96; w = 1 / (se * se)`
  (margin floored at 0.5). WLS slope, OLS-style t from weighted
  residuals. The weight choice MOVES borderline combos across 1.96 in
  both directions, so pin the estimator before curating examples.
- Skip combos with <5 monthly points (dims with 5–7 waves — housing,
  language, education — still qualify; say so when reporting: those
  CIs are thin and single-house).
- SECOND PASS on flagged combos only: y = ln(group/anchor) with the
  same x and weights; skip months where either share ≤ 0.05.

## Multiplicity counting — do it every time

~125 combos in the vote-by-group case. Report both numbers:
"X of 125 at |t|≥1.96 (chance expects ~6)" and "Y at |t|≥2.58 (expects
~1)". Credible population-level divergence shows as X ≫ 6 AND Y ≫ 1
(here: 20 and 11) — then only the |t|>~3 cells survive per-cell
correction safely. Flag autocorrelation honestly: adjacent pooled
months share polls, so all these t-stats are optimistic.

## 2026-09-29 outcome (caches the shape of a real answer)

Under the first recipe run (uniform weights, the row[11] accident):
ONP 18–34 (−5.98 abs, −1.95 ratio) and ONP 55+ (+4.47 → 1.53) were
pace-keeping illusions; genuine twice-significant outliers were Others
NSW (+3.25), Others rest-of-Aus (−2.64), ALP rest-of-Aus (+3.28),
inner-metro LNP (+2.87), ALP non-English homes (−2.89, tentatively).
Under the corrected precision weights the twice-significant population
re-settled at ELEVEN combos — alp state/Rest-of-Australia +3.8, alp
own-outright −2.36, alp NSW −2.11, lnp inner-metro +2.6, lnp men
−2.03, onp renting +2.39 (thin), oth NSW +3.99, oth other-language
+3.15 (thin), oth rest-of-Aus −2.79, oth rural +2.19, oth 18–34 +2.18.
This is the population gen-data §7gb now emits and the trend block
renders. Note the flips in BOTH directions: ONP went 0→1 move, the ALP
language call dropped out, and several t-statistics moved ~0.5.

The recipe now SHIPS in gen-data: §7gb `demoTrend` (exported onto
window.AUSPOL) runs the same two-stage WLS with the margins-precision
weights, flags moves on ≤7 monthly points as `thin` for hedged copy,
and feeds the Who-votes trend block (shift IIFE in rd-panels.jsx, its
render now mounted in the change-over-time slot between the dot-plot
card and the monthly charts since a same-day 2026-09-29 user
correction — the replaced change-over-time per-tab compositor and its
RD_DEMO_NOUN map were deleted in that edit; probe
.matilda/demo-trend-probe.mjs — pins rendered mechanics, not a
word snapshot). The two scratch auditors .matilda/demo-trend-test.mjs
and .matilda/demo-trend-test-ratio.mjs were updated to the same
weights so all three agree.

## Adjacent facts from the same session

- The vote-by-group party switcher is a FIVE-chip array (DEMO_PARTIES)
  since 69f467e (2026-09-29): `oth` joined as "Others" — for its chip
  and prose naming see auto-skill-auspol-vote-by-group-headlines.
- When reporting subgroup "climbs/falls", quote fitted start→end
  levels for BOTH the group and the anchor side by side — the pair
  makes the proportionality call legible to a reader instantly.
