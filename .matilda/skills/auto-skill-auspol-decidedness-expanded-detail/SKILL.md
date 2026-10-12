---
name: auspol-decidedness-expanded-detail
description: auspol-tracker — the per-poll Decidedness line in expanded poll views (shipped 57d30a3, 2026-10-08) — all FOUR bases (can't-say / not-firm / 2PP residue / RedBridge vote-softness triple as firmAll), gen-data emission, the TWO redesign homes (RdApDetail fact grid + rd-polls rd-pld-dl), and the trap: PollLedger/PollDetail/ArchPollDetail are CLASSIC-ONLY renderers — never route expanded-detail work through a11e1559's PollDetail or d1a1d215's AllPollsView (design frozen per MATILDA.md rule 5)
source: auto-skill
extracted_at: '2026-10-08T09:11:17.738Z'
---

> **Superseded 2026-10-11 (branch `ledger-redesign`, commit 11e102e, pending push):** the redesign's
> opened poll is ONE renderer now - `RdLedger` in `rd-allpolls.jsx` - used by All polls
> (`RdApDetail` returns it, its rail as the companion) and by the Latest table (`rd-polls.jsx`
> `detail`, the release rhythm as the companion). The `.rd-apd-grid`/`.rd-apd-grid1` fact rows and
> the Latest `.rd-pld-dl` list are gone: the open tab's measure leads (`.rd-ldg-lead`: `RdLgTpp`,
> `RdLgVote` (primaries + decidedness), `RdLgLeaders`, `RdLgDir`, or the issue/group/gauge tables)
> and every other measure is one `.rd-ldg-line` (`rdLgLines`). Add a figure once, in the matching
> `RdLg*` component and its `rdLgLines` unit. Probe: `.matilda/probe/ledger.mjs`.


# auspol-tracker: the expanded-poll "Decidedness" line

A per-poll decidedness reading shows in BOTH redesign expanded-poll surfaces,
each house on the basis its own questionnaire supports. Shipped 57d30a3
(2026-10-08), user prompt "did you just say decidedness is already in expanded
poll detail? … looking at latest redbridge i can't see it" — the answer was that
no redesign renderer had a decidedness path at all.

## Don't overclaim: where decidedness does/does not render

Renders in exactly TWO places (both redesign):
- **All-polls expanded detail** (`RdApDetail` in `assets/rd-allpolls.jsx`
  ~:1384 decRow IIFE, render block after the mgmtchup grid ~:1461): a
  `.rd-apd-grid.rd-apd-grid1` fact row, key "Decidedness", head figure +
  basis word + `chg` marker, basis sentence in `.rd-apd-sub`. Facet-gated
  `!isConf` — the confidence facet's detail keeps generic facts out.
- **Latest-and-next row expansion** (`detail(e)` in `assets/rd-polls.jsx`,
  `rd-pld-dl` definition list): a `<dt>Decidedness</dt><dd>{dec}</dd>` row
  sitting after Margin of error and before Preferred PM/Net approval. `dec`
  is an IIFE next to `moeTxt`; change marker via the local
  `plus("und", 1)`/`cgd` machinery.

**THE TRAP (settled here by reading the rd-gates): `PollLedger`, `PollDetail`
(a11e1559) and `ArchPollDetail`, `AllPollsView` (d1a1d215) are CLASSIC-ONLY.**
`PollsterTable` rd-gates at a11e1559 **:4660** (`if (window.AP.rd) return
<RdPolls …>` — the `<PollDetail r={r}/>` table body below it, including the
PollLedger undecided line ~:3910, only runs in `?design=old`); `AllPollsView`
rd-gates at d1a1d215 **:5736** (`return <RdAllPolls …>`; `ArchPollDetail`
:3818, rendered :6163, is likewise classic-only). With rule 5 freezing the
classic design (2026-10-08), expanded-detail work belongs ONLY in
rd-allpolls.jsx / rd-polls.jsx. An older skill
(auspol-detail-meta-band) still describes the pair as "edit together" — that
two-home rule is frozen with the classic design.

## The FOUR bases (data)

`undecidedOf` (gen-data :2199) still derives only the three undecided bases;
the fourth rides beside it, never through it:

| basis | field(s) | houses (as of 2026-10) | word shown |
|---|---|---|---|
| `first` | `undecided`, `undecidedBasis` | Roy Morgan (41), DemosAU (2) — "can't say" | "undecided" |
| `soft` | same fields | Resolve (16) — not-firm share of the decided | "not firm" |
| `tpp` | same fields, TPP_UNDECIDED | Essential (7) — residue inside a printed pair | "undecided" |
| firmness | **`firmAll`** | RedBridge/Accent (14/15 waves) — vote-softness triple | "not firm" |

- **`firmAll` = `p.firmness.all` passthrough**: gen-data emits
  `...(p.firmness && p.firmness.all ? { firmAll: p.firmness.all } : {})` in
  BOTH row emitters (individualPolls ~:2863, pollsterTable ~:3099). It is a
  `[solid, soft, verySoft]` triple; both renderers show the head as
  `f[1]+f[2]`% "not firm" with the triple spelled out in the sub/caption.
  Deliberately NOT routed through `undecidedOf` — the Undecided series and
  its deltas count only the can't-say share, which the softness split isn't.
- Change marker: only undecided-basis rows carry one (`und` is a CHG_MEASURES
  getter at gen-data :2228 — `chg.d.und`, decimal 1). `firmAll` is not a
  change measure: no delta, decRow's `d: null`.
- Per-basis sub-line copy (keep rd-allpolls decRow `s:` and rd-polls `dec`
  tails in step if wording moves):
  - first: "Couldn't name a party when first asked"
  - soft: "Named a party, but might yet change their mind"
  - tpp: "Unallocated inside the printed two-party pair"
  - firmAll: "Solid A, soft B, very soft C – from the wave's own vote-softness
    table" (rd-polls variant: "… – solid A, soft B, very soft C, on the
    wave's own vote-softness table", lowercase parenthetical style of the dl)

Coverage ~80/168 rows (66 undecided-derived + 14 firmAll). The FACET question
was adjudicated NO the same day (levels don't compare cross-house) — see
auspol-allpolls-facet-candidate.

## Probe

`.matilda/probe/ap-decidedness.mjs` (tracked by convention via `git add -f`,
20 assertions): truth-driven from the 9f09dca2 data asset — newest RedBridge
firmAll wave, Roy Morgan first, Resolve soft, Essential tpp, YouGov + the
confidence facet as no-row negatives — asserted against the RdApDetail fact
grid AND the reloaded Latest table (`.rd-pl-row` click → `.rd-pld-dl` dt/dd
pairing; rows collapse by re-click when `aria-expanded="true"`). Rebuild
first; run `node .matilda/probe/ap-decidedness.mjs`.
