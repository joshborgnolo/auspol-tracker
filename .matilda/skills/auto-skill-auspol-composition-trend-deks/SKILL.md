---
name: auspol-composition-trend-deks
description: auspol-tracker — the "composition trend" head+dek generator (the RdSub under "Who votes for whom", rd-panels.jsx `const shift` IIFE ~:1340-1500, fed by D.demoTrend = gen-data §7gb). User-dictated sentence SHAPES with live computed figures: stateDek ("…shifted away from X (−x points relative to all …), and towards Y (+y points)"), locDek ("…increased by +x points relative to the overall decrease, rising even as …"), one merged "It has also shifted …" group sentence (sole gender move → "Its relative position among men has shrunk" — the "also" was dropped in the second 2026-09-30 dictate batch, alongside "overall decrease" and the skew tail's "no stronger or weaker"). Dictates arrive as before/after sentences with +X placeholders — change the TEMPLATES, never freeze the figures, and update the block comments that quote the current form in the same edit.
source: auto-skill
extracted_at: '2026-09-30T13:00:00.000Z'
---

# The composition-trend dek generator (rd-panels.jsx `const shift`)

The secondary head+dek under the "Who votes for whom" panel: how the
MAKE-UP of each party's vote has moved since the window start (currently
"Since July 2025"). Shapes are the user's, dictated 2026-09-29 and
re-dictated 2026-09-30 (commit 89fde66 reworked all three builders from
the earlier lead/deficit forms).

## Where things live (rd-panels.jsx, redesign asset)

- `const shift = (() => { … })()` inside RdDemographics, ~:1340-1500 —
  builds `{ head, dek }`; rendered as `<RdSub head={shift.head} dek={shift.dek} glide />`
  (~:1790).
- Wording maps just above, ~:1165-1200: `RD_TREND_NAME` (title case),
  `RD_TREND_NAME_DEK` (lower), `RD_TREND_BARE`, `RD_TREND_SKEW`,
  `RD_TREND_STATE`/`_ORDER`/`_EASTERN`, `RD_TREND_LOC`, `RD_TREND_GROUP`.
- **Two "Own outright" maps exist.** `RD_TREND_GROUP` (~:1190) feeds THIS
  generator ("outright homeowners" per the 2026-09-30 dictate); the
  lookalike at ~:1126 (`"outright owners"`) is the dot-plot/finding
  wording — the dictate landed only on the trend one. Check which map a
  dictate touches before editing both.
- Data: `D.demoTrend`, emitted by gen-data.mjs §7gb (~:2761-2855) as a
  plain `const demoTrend = {...}` literal in the 9f09dca2 data asset —
  grep the ASSET, not index.html, to see current moves. Per party:
  `{windowYm, moves:[{…}], rows:[{…}]}` — moves is the dek's
  significant-only list ({tab,set,setLabel,group,dir,tAbs,tLR,thin,
  months,g0,g1,a0,a1,r0,r1}); rows (2026-10-02) is the FULL battery for
  the Trend-significance table (same shape minus r0/r1, plus from,to,
  rel, sig). g0/g1 fitted group support at window ends, a0/a1 the
  party's national ends, `thin` = seven or fewer monthly points
  (optimistic t on shared samples).

## Emission gates (§7gb) — who gets a move at all

demoTrend's moves list carries ONLY the passers; a group absent from it
failed a gate here, not in rd-panels (the "Selection and significance
regime" below is the DISPLAY regime — separate layer). Per party × set ×
group, on monthly rows with a matching all-voters month
(`demographics.allMonthly` anchor):

- at least 5 monthly points (`if (xs.length < 5) continue`)
- WLS fit of the ABSOLUTE-difference series (g − a over time) — |t| ≥ 1.96
- WLS fit of the LOG-RATIO series log(g/a), zero-ish points skipped —
  |t| ≥ 1.96
- precision weight per month = 1/(max(0.5, row[6+pid])/1.96)² — SE from
  the group's own published 95% margin
- `thin: xs.length <= 7` rides the emitted move; the literal is written
  `const demoTrend = ${JSON.stringify(demoTrend)}` at ~:4609

## The Trend-significance table (shipped 2026-10-02, commit b8f6d02)

A foldaway `<details className="rd-evdrop rd-tsig"><summary>Trend-
significance table</summary>` directly UNDER the trend `RdKey.rd-sm-key`
legend (and above RdFoot) in RdDemographics — it exposes the FULL §7gb
battery (pass AND fail rows) for the selected party as a live table.
User's spec: "underneath the composition-trend legend … add a dropdown …
that puts all these live results in table form".

- **Emitter (§7gb)**: a parallel `rows` array built BEFORE the
  significant-only `moves.push` gate, so `moves` stays byte-identical
  (dek untouched — re-run trend-deks as the regression check). Row
  shape: `{tab,set,setLabel,group,from,to,dir,tAbs,tLR,thin,months,
  g0,g1,a0,a1,rel,sig}` with `rel = rr((g1-g0)-(a1-a0))` and
  `sig = !!(f1 && f2 && Math.abs(f1.t)>=1.96 && Math.abs(f2.t)>=1.96)`.
  g0/g1/a0/a1 are hoisted above the gate and shared by both emitters;
  r0/r1 mover fields keep `Math.exp(f2.at(Math.min/max(...lx)))`.
- **The lx.length<5 trap**: f2 used to be unreachable code below a
  `continue`. Folding the gate INTO the row means f2 can be legitimately
  null (fewer than 5 log-ratio-eligible points after the ≤0.05 floor
  filter) — emit `tLR:null`, sig=false, render "–" in the JSX.
- **Renderer**: `sgn1` formatter (`(v<0?"−":s&&v>0?"+":"")+Math.abs(v)
  .toFixed(1)` — true minus, plus only where signed) plus a `sigSets`
  IIFE grouping `rows` by `tab|set` with min/max window bounds. One
  tbody per set; set subhead
  `{label}<span className="rd-tsig-since">since {rdMonthYear(from)}</span>`;
  7 columns (Group sr-only, Support start→end, All voters start→end,
  Change vs all voters, t gap, t ratio, Significant); sig rows get
  `td.rd-tsig-yes`; thin groups carry " †"; an rd-note under the table
  explains "both trend tests must clear a t statistic of 1.96" and the
  dagger. CSS `.rd-tsig*` in rd.css right after the `.rd-sm-key` rule
  (~:1255); `.rd-tsig-wrap {overflow-x:auto}`, phone rung
  `@media(max-width:640px){.rd-tsig-table{min-width:600px}}` so columns
  scroll INSIDE the wrap (page must not widen).
- **JSX textContent trap (probe-side)**: the set subhead's label and
  since-span are siblings with NO whitespace between them — the visual
  gap is CSS `margin-left:8px` (same idiom as `.rd-chead-meta`). Assert
  `/^By locationsince \w+ \d{4}$/`, never a literal space.
- **Probe**: `.matilda/probe/sig-table.mjs` (committed, force-added past
  the .matilda gitignore, by b8f6d02): serves root on 8953, extracts
  `demoTrend` from the NEWEST 9f09dca2 asset by mtime with the
  depth-matched brace scanner (`depth=0, start=indexOf("{", i)`, end
  when depth returns to 0, then `eval("(" + slice + ")")`), recomputes
  the sgn1/fmtT expectations at RUNTIME and asserts figure-for-figure
  against the DOM — so the probe travels with future data updates
  instead of pinning stale numbers. 43 checks at 1280px + 390px:
  placement, closed-by-default, row counts, four cell-by-cell cases,
  phone containment. First run failed ONE check (the literal-space
  regex above) — shipped markup was correct; fix the probe's assertion,
  not the JSX.
- Existing regression probes stay green: trend-deks (deks byte-identical
  for alp/lnp/oth), validate.mjs exit 0, npm test exit 0.

## "Is move X significant?" — probe recipe (worked 2026-10-02; user ask:
"is the shift away from Labor in outer metro significant?")

demoTrend cannot answer for a failed group (it's just absent) — recompute
from the `demographics` literal in the SAME bundle
(`.build/newtracker/assets/9f09dca2-<uuid>.js`, newest mtime; bundle
caveats in auspol-bundle-data-probe):

1. Extract the literal with a depth-matched brace scanner — init depth 0,
   record start on the FIRST `{`/`[`, end when the count returns to 0.
   Two traps hit live: slicing from `indexOf` leaves the `=` dangling
   (prefix breaks eval), and a matcher that breaks at "depth == start"
   cuts at the first NESTED `}` and evals a fragment.
2. Layout: `demographics.order` = party index (pid); group monthly rows
   under `tabs[].sets[].groups[].monthly` are `[ym...]` with group share
   at `1+pid` and the group's 95% margin at `6+pid`;
   `demographics.allMonthly` mirrors all-voters shares.
3. Copy the `wls()` helper VERBATIM out of gen-data §7gb and run the
   gates above by hand — identical code ⇒ identical t to the emitter.
4. Report BOTH t values, fitted group vs all-voters endpoints
   (`wls(xs,gs)` vs `wls(xs,as)` at min/max x) and the relative move
   (Δg − Δa). Keep the claims apart: "absolute decline in line with the
   national fall" ≠ "significant composition shift".

2026-10-02 ground truth: ALP outer metro, Feb→Sep 2026, 8 months —
tAbs=1.26, tLR=1.35 (both fail 1.96); fitted 30.9→28.4 vs all-voters
30.7→27.1; relative move only +1.15 toward Labor. ALP's emitted moves at
the time: +5.6 rest-of-Australia / −2.8 Qld / −2.4 Own outright.

## The figures

`relPts(m) = sgnPts((g1−g0) − (a1−a0))` — the signed move relative to the
all-voters shift, quoted as `+4.5`/`−2.8` ("± points relative to the
overall decrease" or "… relative to all <party> voters"). `pct` trims
trailing `.0`. All figures in the deks are relPts of the set's best move
(`bestOf` = max |tLR|). Never hardcode a figure — they recompute from
demoTrend every data run.

## The three sentence builders (current dictated shapes)

1. **stateDek(ms, hedged)** — one per state SET (all its moves): "the
   composition of `<voteOf>` has shifted away from `<away list>` (`relPts`
   of best away move `points relative to all <nameD> voters), and towards
   `<toward list>`" PLUS a `(<relPts> points)` parenthetical on the TOWARD
   side only when a toward move exists. A side with no significant move
   names the complement and stays bare. `voteOf` = `"the vote for others &
   independents"` for oth (the name can't carry a possessive — user
   dictate), else `poss(nameD) + " vote"`. Head pole: away side ("losing
   voters faster in …") or toward-only ("gaining in …"); three eastern
   states together name "the eastern-mainland states".
2. **locDek(m)** — two sentences (one sentence when thin): "`<poss>`
   voter base has become more/less `<adj>`" + "`<Support>` in `<ref>` has
   increased/decreased by `<sgnPts>` points relative to the overall
   decrease, `<rising/falling>` `<national>`". `<national>` = "even as the
   national vote has remained flat" when |a1−a0| < 1, else "while the
   national vote has fallen/risen from X% to Y%". The direction word rides
   the national clause; the from–to levels were REMOVED 2026-09-30. The
   "overall decrease" word is a STATIC template constant (dictate batch
   two, same day) — it stays "decrease" even when the national clause
   reads flat; do not re-derive it from `a1−a0`.
3. **groupSentence(gms)** — ALL non-state/non-location moves (carried
   solid + trailing thin) merge into ONE trailing sentence: "It has also
   shifted away from `<group> (+x points)` and towards …", each group
   with its own parenthetical. Sole GENDER move instead: "Its relative
   position among `<men/women>` has shrunk/grown" (shrunk/grown from
   |gap1| vs |gap0|) — the "also" was DROPPED (dictate batch two: a
   gender move can follow an opposite-direction location move, and
   "also" implies a same-direction follow-on; the MULTI-group sentence
   keeps its "also"). Hedge ("also appears to have shifted" for the
   merged sentence / "appears to have …" for the gender form) only when
   EVERY merged move is thin. Assembly guard: if
   no state/location sentence leads, the group sentence OPENS the dek —
   it is lower-cased ("Since …, it has shifted …") and loses the "also".

## Selection and significance regime (unchanged since 2026-09-29)

Sets rank by max |tLR|; top-2 SOLID sets carry the dek, ≤2 thin sets trail
hedged, a set already carried stays out of the trailers. A party with no
solid move renders the unchanged pair: head "The composition of `<poss>`
vote is unchanged", dek "Since `<windowYm>`, no group has moved
significantly towards or away from `<nameD>` relative to all voters." +
optional `RD_TREND_SKEW` sentence (static per-party constants in the map —
onp's reads "…no stronger or weaker now than it was then." since the
second 2026-09-30 dictate; a skew-tail change is a pure map edit, not a
template change). Heads: state → "`<nameT>` is/are
losing voters faster in `<pole>`" / "gaining in `<ref>`"; only-group →
"The composition of `<poss>` vote is shifting".

## Responding to a dictate

The user sends current dek text + replacement, with `+X`/`x` placeholders
for figures to compute (e.g. 2026-09-30: "(+X points)" on the toward
state, "increased by x points relative to the overall change"). That is a
TEMPLATE change request, not a freeze (cf. auspol-curated-panel-copy) —
edit the builder, wire the figure from `relPts`, and generalise the
unobserved branches conservatively (opposite direction, thin moves,
multi-group). Read the dictated punctuation carefully; when two dictates
disagree (one kept `", and towards"`, one dropped the comma), keep the
existing uniform generator style and say so in the report.

## Word-level dictates (second 2026-09-30 batch, the worked pattern)

A dictate can also be a pure WORDING constant with no figure or branch
implication — three landed the same day: locDek "overall change" →
"overall decrease" (:1412), the sole-gender sentence's "also" dropped
(:1426), RD_TREND_SKEW.onp "no stronger" → "no stronger or weaker"
(:1180). The pattern: edit the one string, REBUILD, grep the built
index.html for the new ASCII fragment (all three were all-ASCII, which
greps verbatim — babel escapes only the ≥U+00AB typography), and quote
the built-file line back as proof. Keep the surrounding generator
dynamic — never "fix" a word-level dictate by adding a conditional the
user didn't ask for (e.g. do not derive increase/decrease from a1−a0).
Also update the shape-quoting block comments in the SAME edit (the map
comment ~:1169-1175 and the locDek dictate comment ~:1404 both quote old
wording verbatim; stale comments misquote the shipped shapes).

## Verify

Probe `.matilda/probe/trend-deks.mjs` (committed by 89fde66; serves the
repo root on 8971, clicks the #who-votes party chips, prints each party's
"Since …" dek). Assert the three dictated sentences end to end — do NOT
grep built index.html for the prose (babel escapes the −/–/’ characters;
see auspol-built-html-verification), and don't trust source greps either
since the sentences are template joins. Current-data ground truth at
dictate time: alp +5.6 rest-of-Australia / −2.8 Qld / −2.4 homeowners;
lnp +3.7 inner-metro / −1.4 men; oth −5.8 rest / +4.4 NSW / +4.5 18–34s /
+5.5 other-language.

## Cross-links

- `data/polls.json` untouched — demoTrend is derived by gen-data; rebuild
  with `node .build/newtracker/build.mjs`, validate normally.
- Shared-tree trap (hit 2026-09-30): a sibling's uncommitted rd.jsx /
  rd-allpolls.jsx WIP in the working tree bakes into YOUR rebuilt
  index.html — follow auto-skill-shared-repo-session-race's sources-only
  clause (checkout-discard the artefact, commit sources + probe, artefact
  lands with the next rebuild).
- Headless probe conventions: auto-skill-auspol-headless-geometry-verify.
