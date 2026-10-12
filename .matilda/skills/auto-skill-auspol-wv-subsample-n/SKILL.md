---
name: auspol-wv-subsample-n
description: auspol-tracker — where the Who-votes-for-whom panel's per-subsample sample size (the "n ≈ …" figure on a rug dot or group) comes from, plus its SECOND consumer since 2026-10-08: the Primary-vote panel's group-view dot tooltips (shipped 98283f7), where the same estimate rides individualPolls.grp.n into the TrendChart engine's per-datum `sub` override. It is NOT read back from published crosstabs — gen-data §7g computes group n = rowN(poll) × DEMO_SHARE[group] (gen-data.mjs rows push `n: n * DEMO_SHARE[group]`); rowN is the whole-of-sample n (sampleEff × HL_DEFF if stamped, else min(sample, 3000)), DEMO_SHARE a fixed adult-population share per group (demo-groups.mjs:66). The share cancels out of every pooled figure — it only sizes each group's sampling-error floor — so every sub-sample n on the panel is an approximation, hence the "≈".
source: auto-skill
extracted_at: '2026-10-07T02:09:51.516Z'
---

# The vote-by-group panel's per-subsample n ("n ≈ …")

User question that opened this (2026-10-07): "in the latest Greens YouGov poll
for Gen Z, it has the sample size for each subsample. How does it get that?"

## The formula (ONE line in gen-data.mjs §7g)

Every group row the §7g builder pushes carries:

```js
{ …, n: n * DEMO_SHARE[group], … }
```

(gen-data.mjs, the rows/rowsM push loops right after
`const mid = midMs(p || w), n = rowN(p || { sample: w.sample });`, the
common-group `rows[key(k)].push` and monthly `rowsM[key(k)].push`.)

- **`n` = `rowN(poll)`** — the wave's WHOLE-of-sample base, defined at
  gen-data.mjs:298: `p.sampleEff != null ? p.sampleEff * HL_DEFF
  : min((p && p.sample) || 1200, SAMPLE_CAP)`. The published effective n
  (e.g. YouGov's APC methodology figure, re-inflated onto the raw-n
  convention) if the wave is stamped; otherwise the raw sample capped at
  3,000. Full rowN contract lives in
  auto-skill-auspol-effective-sample.
- **`DEMO_SHARE[group]`** — a FIXED assumed share of the adult
  population per group, defined once in `.build/newtracker/demo-groups.mjs`
  (~:66): Gen Z 0.19, Millennials 0.28, Gen X 0.25, Boomers 0.28; Men
  0.49 / Women 0.51; "18–34" 0.28, "35–54" 0.33, "55+" 0.39, etc.

So a Gen Z dot on a YouGov wave with effective n ≈ 1,500 reads
n ≈ 1,500 × 0.19 ≈ 285. Nothing is parsed out of published crosstab
sample columns.

## Where DEMO_SHARE's numbers come from (demo-groups.mjs header comment)

- Generations / age bands: "rough shares of the adult population".
- States (NSW 0.31, Vic 0.26, Qld 0.20, Rest 0.23): shares of the 2025
  formal vote.
- Location (Inner/Outer metro/Provincial/Rural): RedBridge's own printed
  group sizes (Aug 2026: 280/307/144/196 of 927), the same cut YouGov
  uses.
- Housing and language: the 2021 census (owned outright 31% / mortgage
  35% / rented 31%; English-only at home 72% etc.), each taken to 100.

## Why every house gets the same share for a group — and why that's safe

The DEMO_SHARE comment states the purpose verbatim: "They size each
group's sampling-error floor … and nothing else: every poll's group
carries the same share, so it cancels out of the pooled figure." The
pool itself is weighted by group n, so a constant factor per group
normalises away in the weighted estimate; only the uncertainty
(se/floor) scales with it. A worse real subsample split for one wave
does therefore NOT leak into the pooled point estimate — only into the
margin, and even there it's a standing approximation.

## Display surfaces (all render the derived product, not a lookup)

- The rug-dot tooltip (`WvRug`, rd-panels.jsx ~:1535/:1563):
  `lab = d.f + ", " + d.l + " · " + x + "% · n≈" + d.n` and
  `"n ≈ " + d.n.toLocaleString()` in the `.tip-sub` — deliberately "≈"
  because it is the whole-poll n × DEMO_SHARE approximation (the same
  caveat the vote-by-group-all-voters-anchor skill's `pd.n` note
  carries). The chart's own tooltip, by contrast, shows whole-poll n
  (no ≈).
- The rug payload item is the rounded product:
  `pd = win.map((r) => ({ f, l, n: Math.round(r.n), r }))`
  (gen-data §7g rug block) — `pd.n` per wave.
- The group's pooled `n` (`est.alp.n` in the same block) is the pooled
  n on the display row's title ("Pooled from N polls…" text in
  rd-panels.jsx uses that n as the poll COUNT — different field; check
  which before reporting).
- SECOND consumer, shipped 2026-10-08 (commit 98283f7): the
  Primary-vote panel's GROUP-VIEW poll dots. The DEMO_BY_POLL record
  (gen-data.mjs ~:2737, the block that sets grp on individualPolls)
  carries `n: DEMO_GROUPS.map(g => Math.round(rowN(p) *
  DEMO_SHARE[g]))`, popped in sync with `v` so indices stay aligned;
  rd-panels RdPrimary's group-branch dots set
  `sub: q.grp.n[gi] ? "n ≈ " + … : undefined` and the TrendChart
  engine tips it. The ALL-VOTERS view keeps the engine's default
  whole-poll `n = 1,500` line unchanged.

### The engine's per-datum `sub` override (08b413e7 asset)

The dot tooltip's sub line is
`sub: dot.sub || (dot.meta.sample ? \`n = ${dot.meta.sample.toLocaleString()}\` : "")`
(three-head comment block of `tip =` under "tooltip content"). A
picked dot IS the caller's raw scatter datum — `nearestDot` returns a
`scatter` element and `scatter` is the props array verbatim (only the
travel machinery swaps whole arrays) — so ANY extra field on a scatter
datum reaches the tooltip untouched; `sub` is the honoured one for the
sample line. To give any other chart's dots a custom sub line: put
`sub` on the datum, nothing else. The header doc comment above
TrendChart lists `sub?` in the scatter shape.

## Probe

```js
const D = window.AUSPOL;
D.demographics.tabs[].sets[].groups[].pd   // per-wave {f,l,n,r} — rug
D.demographics.tabs[].sets[].groups[].n    // pooled count shown in titles
D.individualPolls.find(p => p.grp).grp.n   // per-group subsample (grp record)
```

(window.AUSPOL node-load recipe: see auspol-vote-by-group-all-voters-anchor.)

`.matilda/probe/pv-group-select.mjs` assert case 5 pins the three
tooltip states (hover a solid dot): group views show "n ≈ N" matching
`q.grp.n[gi].toLocaleString()` (Gen Z 285 on the Oct-2026 YouGov
1,500-wave), All voters shows the whole-poll "n = 1,500".

## Don't

- Don't try to "fix" a subsample n by looking up the crosstab's printed
  group column — the pipeline never reads one; the figure you see is
  always the deterministic product above.
- Don't change one group's DEMO_SHARE thinking it retunes the pooled
  estimate — it moves ONLY that group's sampling floor/margins (and the
  displayed "n ≈").
