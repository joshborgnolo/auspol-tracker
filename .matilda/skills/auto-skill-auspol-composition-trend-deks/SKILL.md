---
name: auspol-composition-trend-deks
description: auspol-tracker — the "composition trend" head+dek generator (the RdSub under "Who votes for whom", rd-panels.jsx `const shift` IIFE ~:1340-1500, fed by D.demoTrend = gen-data §7gb). User-dictated sentence SHAPES with live computed figures: stateDek ("…shifted away from X (−x points relative to all …), and towards Y (+y points)"), locDek ("…increased by +x points relative to the overall change, rising even as …"), one merged "It has also shifted …" group sentence (sole gender move → "Its relative position among men has also shrunk"). Dictates arrive as before/after sentences with +X placeholders — change the TEMPLATES, never freeze the figures.
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
- Data: `D.demoTrend`, emitted by gen-data.mjs §7gb (~:2732-2830) as a
  plain `const demoTrend = {...}` literal in the 9f09dca2 data asset —
  grep the ASSET, not index.html, to see current moves. Per party:
  `{windowYm, moves:[{tab,set,setLabel,group,dir,tAbs,tLR,thin,months,
  g0,g1,a0,a1,r0,r1}]}` — g0/g1 fitted group support at window ends,
  a0/a1 the party's national ends, `thin` = seven or fewer monthly
  points (optimistic t on shared samples).

## The figures

`relPts(m) = sgnPts((g1−g0) − (a1−a0))` — the signed move relative to the
all-voters shift, quoted as `+4.5`/`−2.8` ("± points relative to the
overall change" or "… relative to all <party> voters"). `pct` trims
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
   change, `<rising/falling>` `<national>`". `<national>` = "even as the
   national vote has remained flat" when |a1−a0| < 1, else "while the
   national vote has fallen/risen from X% to Y%". The direction word rides
   the national clause; the from–to levels were REMOVED 2026-09-30.
3. **groupSentence(gms)** — ALL non-state/non-location moves (carried
   solid + trailing thin) merge into ONE trailing sentence: "It has also
   shifted away from `<group> (+x points)` and towards …", each group
   with its own parenthetical. Sole GENDER move instead: "Its relative
   position among `<men/women>` has also shrunk/grown" (shrunk/grown from
   |gap1| vs |gap0|). Hedge ("also appears to have shifted" / "appears to
   have also …") only when EVERY merged move is thin. Assembly guard: if
   no state/location sentence leads, the group sentence OPENS the dek —
   it is lower-cased ("Since …, it has shifted …") and loses the "also".

## Selection and significance regime (unchanged since 2026-09-29)

Sets rank by max |tLR|; top-2 SOLID sets carry the dek, ≤2 thin sets trail
hedged, a set already carried stays out of the trailers. A party with no
solid move renders the unchanged pair: head "The composition of `<poss>`
vote is unchanged", dek "Since `<windowYm>`, no group has moved
significantly towards or away from `<nameD>` relative to all voters." +
optional `RD_TREND_SKEW` sentence. Heads: state → "`<nameT>` is/are
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
