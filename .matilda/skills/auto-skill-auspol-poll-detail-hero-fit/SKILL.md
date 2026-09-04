---
name: auspol-poll-detail-hero-fit
description: auspol-tracker — the expanded-poll headline 2PP line (.pd-s-hero) must hold ONE line down to the 320px phone rung; the .poll-detail type-token map (--pd-hero ladder ≤720/≤560/≤430/≤360, archive detail is 264px wide at 320px vs Latest 320 full-bleed) plus the nowrap-scrollWidth wrap-measurement technique (offsetTop heuristics FALSE-POSITIVE on a line mixing 24px figures with 14px words)
source: auto-skill
extracted_at: '2026-09-03T11:20:30.966Z'
---

# auspol-tracker: expanded-poll hero line phone-fit

The headline figure line of an expanded poll (`.poll-detail p.pd-s-hero`, e.g.
"ALP v L/NP: 45% ALP (▼3) vs 50% L/NP (▲3)") must hold ONE text line on phones.
Sizing fails silently on real devices if you tune it to the wrong width — map
below (shipped becf17a; question pre-becf17a was the pair wrapping to two lines
below 430px).

## Type tokens (all defined on `.poll-detail`, template.html)

Desktop: `--pd-body:13.5px; --pd-note:11.5px; --pd-fig:20px; --pd-hero:40px;
--pd-hero-w:17px; --pd-hero-note:14px` (hero figure size = `--pd-hero`, the
party words scale from `--pd-hero-w`, the movement/note from `--pd-hero-note`).

Media ladder (change ALL THREE hero tokens together — the line mixes them on one
baseline):

| rung | change |
|---|---|
| ≤720px | `--pd-hero:27px; --pd-hero-w:14px` (+ body/note/fig shrink, `--pd-gut:18px`) |
| ≤560px | `.pd-mat{display:block;margin:0 0 2px}` — matchup name above the figures, THAT name plus label "ALP v L/NP:" is what forces a 3rd line |
| ≤430px | `--pd-hero:24px; --pd-gut:14px` |
| ≤360px | `--pd-hero:20px; --pd-hero-w:12px; --pd-hero-note:11.5px; padding:16px sides; .pd-s-hero{word-spacing:5px} .pd-s-hero .pd-grp{word-spacing:7px}` |

Hero markup: `p.pd-s-hero > .pd-mat` (matchup name) + `.pd-grp` (nowrap figure
groups with `b` at `--pd-hero`) + `.pd-vs`. Keep `.pd-grp` nowrap: the wrap
boundary between groups is the only accepted break.

## The width that matters

Design case (becf17a): **archive detail at 320px viewport is only ~264px wide**
(All-polls lives inside `.supplemental`, and the table wrapper has `margin-left:-4px`),
while the Latest detail is full-bleed 320px. At 24px hero the pair needs ~305px —
fits 390/360 but truly overflows ≤320; the 20px/264px combination is the binding
constraint. When shrinking, always solve for archive@320, not Latest.

## Measure wrap correctly: nowrap + scrollWidth, NOT offsetTop

`.pd-s-hero` mixes 24px figures and 14px words on ONE baseline, so children legitimately
sit at different offsetTops — any "2 lines?" heuristic comparing child tops **false-
positives** (cost one wasted iteration in becf17a). Proven probe pattern
(`.matilda/probe/pd-meta-hero.mjs`):

```js
const avail = p.clientWidth;
p.style.whiteSpace = "nowrap";
const need = p.scrollWidth;   // intrinsic one-line width
p.style.whiteSpace = "";
const wraps = need > avail + 1;
```

Probe harness: puppeteer-core with `NODE_PATH="$HOME/node_modules"`, system Chrome
(`/Applications/Google Chrome.app/...`, `headless:"new"`, `--no-sandbox`), serve repo
`index.html` over a local http server, viewport `{width, 844, isMobile:true,
deviceScaleFactor:3}`, expand via `.poll-table .exp-btn` (Latest) and
`.view-allpolls .exp-btn` after `goto "?#allpolls"` (archive). Widths 390/360/320.
Bad probe targets: methodUrl-only rows (YouGov News24, Newspoll, DemosAU) print an
APC-only row; Essential/RedBridge print release+APC — good for the meta-band checks
in the same probe.

## Iteration trap seen once

A first "≤360px" rung at `--pd-hero:22px` + padding/word-tightening STILL wrapped
(271 needed vs 264 avail). If arithmetic says ~4% short, jump a whole rung (20px)
rather than shaving pixels. Verify meta rows in the same run — `.pd-meta-i` values
must share their label's first line (`|v.top − k.top| < 3`).
