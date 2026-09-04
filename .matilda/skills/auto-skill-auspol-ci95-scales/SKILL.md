---
name: auspol-ci95-scales
description: auspol-tracker — alp2ppCi95 is SHARE-scale (half-width on one party's 2PP share); any figure shown beside the LEAD line must be lead-scale = 2×ci95 (a−b = 2a−100 quadruples variance). Consumer map of every ci95 use site and the matching-copy rule for Info/static summary.
source: auto-skill
extracted_at: '2026-09-02T03:00:00.000Z'
---

# ci95 two-scale rule in auspol-tracker (hero-strip fix, commit 26c520c)

`gen-data.mjs` emits **share-scale** ci95: `ci95: r1(1.96 * r.se)` — the 95% half-width on ONE party's 2PP share (`latest.alp2ppCi95`, `altL.ci95`). The hero lead strip, however, shows a **lead** (a − b). Since a−b = 2a−100, variance quadruples, so the interval beside a lead figure is **2 × ci95** and the lead itself renders to one decimal (`Math.abs(lead).toFixed(1)`).

## Consumer map — which scale each site needs

- **Lead-scale (2×ci95), ONLY here:** the `.hero-interval` strip in `73de0c58` asset — `± {(2 * unc.ci95).toFixed(1)} pts` beside `<RollNum value={Math.abs(lead).toFixed(1)} spinIn />`. `lead = +(latest.a - latest.b).toFixed(1)`. The render-site doubling covers both the real matchup (`D.latest.alp2ppCi95`) and the alt path (`altL.ci95`) because both are share-scale.
- **Share-scale, must NOT change:** HeroGauge (`ci={unc.ci95}`), bandOf, y-window pad, `.ha-ci` alt-chip (sits beside matchup *shares*, not a lead), dynamics tooltip.
- In the strip, `unc` is `{ ci95: D.latest.alp2ppCi95, n: D.latest.method.nPolls, changeSig }` — the datum stays share-scale; doubling happens at render only.

## Copy that must move with the figures

When the strip's ± changes, these echo it and must be edited together:

1. `d1a1d215` glossary **`interval`** entry (~:3042) and **`margin-of-error`** entry (~:3101) — both quote "currently ±X" beside the headline; they now state both scales ("±2.7 on a share, so ±5.4 beside the lead") via `(2 * (L.alp2ppCi95 ?? 0)).toFixed(1)`.
2. `build.mjs` `buildStaticSummary()` — the "${who} leads by …" paragraph quotes the lead to one decimal + `(±5.4 on the lead)` and the share interval as "±2.7 points on each share". (Static summary is React-free text; compute it there too — don't reference `unc`.)

## Verification gotchas (this change)

- RollNum digit-reel innerText probes are noisy — the reel dumps `0 1 2 … 9 . 0 1 …` into `innerText`; use bounding-rect row alignment (`Math.abs(tagTop − rangeTop) <= 2`) and overflow checks, not text matching, to verify the strip.
- Longer strip text ("4.0 ± 5.4") can re-break the ≤480 px one-row phone fit in template.html (`@media (max-width: 480px)` `.lead-tag`/`.hi-range` block ~:1123) — re-probe at 390 px after any length change; 320 px doc-overflow is pre-existing, not caused by the strip.
- Built-index greps: babel escapes ± as `\xB1` in JS strings — see auspol-built-html-verification.
