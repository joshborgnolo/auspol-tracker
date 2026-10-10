---
name: auspol-leadership-dek
description: "auspol-tracker — the Leadership panel's head+dek generator (RdLeadership story in rd-panels.jsx ~:296-322; dek rewritten to the user-supplied narrowing template in d24f50a, 2026-09-28: 'His lead over the opposition leader has narrowed from +x under Ley to +y under Taylor. Over Hanson his lead is greater (+z), and has held steady since it was first measured.'): all figures COMPUTED from leaderMonths/leaderNow (ley-era mean margin, 6-week-window current leads, ppmHeadToHead Apr 2026 on), gated narrow/steady/greater clauses, signed0 ± formatting; dek is a SINGLE home. Also the ld-panel spacing rule: 48px sub margin parts the STACKED panels, dek clearance is a per-layout-mode 20px so the gap is 28px everywhere — never cut the shared 48px base."
source: auto-skill
extracted_at: '2026-09-28T04:24:16.572Z'
---

# Leadership — head + dek machinery (RdLeadership)

Lives in `RdLeadership`'s `story` IIFE, `.build/newtracker/assets/rd-panels.jsx`
(~:296-322). SINGLE home — the old-design asset has no copy of this sentence
family; the compiled `index.html` only carries template fragments, so
verifying means rendering (below).

## The dek (user-supplied template, d24f50a, 2026-09-28)

> His lead over the opposition leader has narrowed from +18 under Ley to
> +5 under Taylor. Over Hanson his lead is greater (+12), and has held
> steady since it was first measured.

Every figure is COMPUTED, never hard-coded:

- **+x (Ley era)** — `leyLead`: mean of `r.alb_pref − r.ley_pref` over the
  `leaderMonths` rows carrying both (per-era split by `eraOf`; the Ley →
  Taylor splice is `OPP_SPLICE_ISO = "2026-02-13"` in gen-data.mjs).
- **+y (now)** — `leaderNow` six-week-window readings
  `alb_pref − taylor_pref`.
- **+z (Hanson)** — `leaderNow alb_prefH − hanson_prefH`, from
  `D.ppmHeadToHead` — a THIRD question format (asked Apr 2026 on, in its
  own series; never mixable with the two-way or three-way monthly means).
- Signed formatting via the local `signed0(v)` (+/− Unicode minus,
  `Math.round`), same helper the approval dot plot uses.

Gates keep the prose truthful; do not drop them when editing copy:

- the narrow clause requires `leads && leyLead − (a−o) >= 4`; fallback is
  the plain "He leads/trails ‹opp› a–b head to head."
- "held steady since it was first measured" requires the current Hanson
  lead within **±4 of the FIRST monthly reading** (`hanRows[0]`).
- "greater" requires the Hanson lead to out-run the opposition-lead lead;
  otherwise "he leads by +n points".

The pre-d24f50a dek family ("He leads Taylor 42–38 and Hanson 51–39 head to
head, but his lead over the Coalition leader has shrunk from about 20 points
under Ley… His net approval is down about N points since the election, to …")
is wholly GONE, and its scaffolding (`nets`, `lowest`, "the lowest of the
three") went with it — net approval survives only in the `head` sentence.
If an old task transcript references those idioms, they are dead copy, not
an alternate renderer.

## Spacing: why the dek-to-panel gap must be a per-mode override

`.rd-ld-panel .rd-sub { margin-top: 48px }` (rd.css) exists to part the two
leadership panels when they STACK (≤1000px). On laptop both panels sit side
by side directly under the dek, where 48px inflated the clearance. The fix
ship shape (d24f50a): dek-to-panel gap is **28px on EVERY width** —

- 8px from `.rd-ld-grid { margin-top: 8px }`, plus
- 20px of sub margin: the stacked layout gets it from
  `> .rd-ld-panel:first-child` (≤1000px), laptop from an explicit rule
  inside the existing `@media (min-width: 1001px)` block
  (`body.rd .rd-ld-grid > .rd-ld-panel .rd-sub`). The ≤640px 36px rule is
  outrun by first-child for the top panel and only affects the second.

Lesson: when one margin serves both "gap between stacked siblings" and
"clearance under the section header", scope the header clearance to the
layout mode (min-width block / first-child). Cutting the shared base value
would have regressed the between-panel gap on stacked layouts.

## Verifying a change

- **Data figures first**: run the figures you plan to ship through the data
  asset e.g. `.matilda/probe/leadership-dek-figures.mjs` — execute the
  9f09dca2 asset under a window shim and compute from `window.AUSPOL`
  (full recipe in auspol-bundle-data-probe). This turned the user's +x/+y
  placeholders into +18/+5/+12 and confirmed "held steady" (first monthly
  +8.8 vs now +12) before any copy was written.
- **Rendered copy + geometry**: the dek text only exists at runtime.
  Puppeteer probe (`.matilda/probe/leadership-dek-render.mjs`, per the
  auspol-headless-geometry-verify skeleton): read `#leadership .rd-dek`
  `textContent` AND `sub.getBoundingClientRect().top − dek.bottom` at
  1280/1024/760/390 in one pass — one probe proves copy AND spacing.
- Rebuild `node .build/newtracker/build.mjs`; `grep -o 'has narrowed from[^.]*' index.html`
  finds the fragment (ASCII-safe), but only the probe confirms the computed
  numbers.

## Significance gates (2026-10-11)

The head said "Albanese still leads as preferred PM" on a 40.7–38.5 split:
a +2.3 lead whose own margin is ±3.7 (two shares of one sample move
against each other, so the lead's margin is WIDER than the shares'
±2.0 each combined). Now:
- gen-data emits `leaderLead = { taylor, hanson }` ({v, ci95}): each poll's
  own lead pooled with the one-sample variance (pq = 100(a+b) − (a−b)²),
  SPARSE_K window. taylor is the TWO-WAY question only (`ppm2MarginNow`,
  p.han == null): `ppmMarginNow` (Past cycles' ppmm) pools three-way
  readings too and read +9.6 against the two-way +2.3. hanson =
  ppmHMarginNow (its own head-to-head pool).
- RdLeadership's `leadTest(L, ka, kb)`: |L.v| > L.ci95; with no pooled lead
  (/vic/) the shares' se's widened by the multinomial correlation
  ρ = √(pa·pb / ((1−pa)(1−pb))).
- Inside the margin the head reads "Albanese and Taylor are level as
  preferred PM, and Albanese’s net approval has fallen 40 points" (the
  approval clause names Albanese whenever he isn't the one leading, so no
  "his" can read as Taylor's); the dek opens "Albanese’s lead … narrowed
  from +18 under Ley to +2 under Taylor, inside the margin of error";
  "narrowed" needs the Ley-era average down by more than the current
  lead's margin; the approval fall needs ≥10 points AND to clear
  hypot(now ci95, first month's alb_netCi). Hanson: level inside its
  margin ("Head to head with Hanson, the two are level."), "he leads by
  11 points, a lead that has held steady since it was first measured"
  (steady = within the lead's own margin of the first month), "his lead is
  greater (+11)" only beside a significant opposition lead.
- /vic/ (J branch) uses the same test: two Victorian polls (Carroll
  26.8 ± 10.4, Wilson 34.2 ± 9.4) now read "Wilson and Carroll are level
  as preferred Premier".
Pinned by .matilda/probe/sig-gates.mjs (mutated-payload cases: level,
Albanese ahead, Taylor ahead, Hanson level).
