---
name: auspol-allpolls-facet-candidate
description: auspol-tracker — judging "should measure X become an All-polls facet?" (worked 2026-10-08 on decidedness — verdict NO). The facet-column contract is that LEVELS compare across houses; sparse-but-comparable measures ship (direction facet, 113 rows/6 houses), sparse-but-incomparable ones don't. Decidedness has 3 incompatible bases (RM "can't say" ~4% vs Resolve "not firm" ~25–35% vs Essential 2PP residual ~3%) so levels don't travel; only per-house deltas are like-for-like. Alternatives: the dedicated section/panel owns per-house framing, per-poll undecided/undecidedBasis is already on individualPolls+pollsterTable with the PollLedger basis note, and the defensible table form is a delta-first column inside an EXISTING facet (confidence facet's per-release Sample/Fieldwork columns are the precedent). Includes the coverage-count probe recipe (replicate undecidedOf against data/polls.json).
source: auto-skill
extracted_at: '2026-10-08T08:37:22.899Z'
---

# Judging a proposed All-polls facet (auspol-tracker)

Origin (2026-10-08): user asked "should we add a decidedness facet in the
all polls table". Answer given: **no as a top-level facet** — reached by a
reusable test, below.

## The test

A facet's columns sit every house's rows in one grid. That layout asserts
**the LEVELS are cross-house comparable**. Every shipped facet column
qualifies: 2PP, primaries, net approval, net direction.

So two probes, in order:

1. **Coverage** — which polls/houses carry the measure? Sparsity alone is
   NOT disqualifying: the Direction facet shipped with 113/168 rows over
   6 houses (the sparse-facet precedent), and the Confidence facet is
   conditional on data existing at all.
2. **Comparability of levels** — is 30 for house A the same quantity as
   30 for house B? This is the killer criterion. Deltas are a separate
   question: gen-data's CHG_MEASURES only ever compares a house against
   its OWN previous wave, so deltas are like-for-like even when levels
   are not.

Two facet-cost facts to weigh on the other side: the table already runs
7 facets (FACET_IDS in rd-allpolls.jsx ~:2113 = twopp/primary/leadership/
direction/issues/demographics + conditional confidence), and each facet
touches FACET_IDS, FACET_LAB, facet stories, the phone pinned head, sort
keys, month rows and the detail renderer.

## The decidedness instance (the worked example, 2026-10-08)

Coverage after the `undecidedOf` derivation (gen-data.mjs ~:2199; the raw
`undecided` Row field alone is only 43/168 — always measure the DERIVED
form, which adds `soft` rows and the tpp-pair residual):

- 66/168 polls, 4 houses:
  - Roy Morgan 41 — basis `first` ("can't say" beside primaries, ~3–5%)
  - Resolve 16 — basis `soft` (not-firm share of the decided, ~25–35%)
  - Essential 7 — basis `tpp` (shortfall inside the 2PP pair, ~2–6%;
    house flagged via `pollsterRules.*.tppIncludesUndecided`)
  - DemosAU 2 — basis `first`

**Why it fails probe 2**: ~4% (RM) and ~30% (Resolve) are different
concepts — "can't say" out of all voters vs "not firm" out of the
decided. One column holding both invites exactly the wrong comparison.
gen-data's own `und` delta comment says the same: "Each is that house's
own series, so a delta compares like with like" — levels don't travel.

**Verdict and alternatives given** (the standard menu for a failed
facet candidate):

- The dedicated Snapshot section (Decidedness panel — see
  auto-skill-auspol-decidedness-panel) already gives the measure the
  per-house basis framing it needs.
- Per-poll `undecided`/`undecidedBasis` is already spread onto
  individualPolls + pollsterTable rows (gen-data ~:2862/:3093), so the
  expanded poll detail can show it; PollLedger carries the basis note
  (auto-skill-auspol-undecided-basis-display).
- If it must be glanceable IN the table anyway, the defensible form is
  delta-first (change vs the house's previous wave — like-for-like by
  construction) as a column inside an EXISTING facet, not a new top-level
  facet. The Confidence facet's per-release Sample + Fieldwork columns
  (commit 5adfeb5) are the precedent for that lighter route.

## The coverage-count probe (reuse for any measure)

Replicate the gen-data derivation directly on the source JSON — do NOT
read the built bundle for coverage questions (the derivation lives in
gen-data; the bundle just carries its output):

```bash
node -e "
const D=require('./data/polls.json');
const polls=D.polls;
const TPP_UNDECIDED=new Set(Object.entries(D.pollsterRules||{})
  .filter(([,r])=>r&&r.tppIncludesUndecided).map(([f])=>f));
const r1=x=>Math.round(x*10)/10;
const undecidedOf=(p)=>{
  if(p.undecided!=null)return{v:p.undecided,basis:'first'};
  if(p.soft!=null)return{v:p.soft,basis:'soft'};
  if(TPP_UNDECIDED.has(p.pollster)&&p.tpp_alp!=null&&p.tpp_lnp!=null){
    const gap=r1(100-(p.tpp_alp+p.tpp_lnp));
    if(gap>0.5)return{v:gap,basis:'tpp'};
  }
  return null;
};
// count by house + basis
for(const p of polls){const u=undecidedOf(p);if(u)console.log(p.pollster,u.basis);}
" | sort | uniq -c
```

(Keep the probe's logic in lockstep with gen-data.mjs's `undecidedOf` —
two fallbacks: stored field → `soft` field → tpp-pair residual gated
>0.5 so a normalised pair isn't read as a nil undecided.)
