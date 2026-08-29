---
name: aec-preference-flow-constants
description: Derive/refresh national preference-flow constants (GRN/ONP/IND+OTH ALP shares) from any AEC TCP flow-by-party download, compete candidate constant sets against published 2PP, and lock the winner into validate.mjs with provenance. Anchor to the MOST RECENT federal election — current-term pollsters allocate off it. Includes parsing traps and the settled conclusion that global-constant synthetic 2PP is NOT viable as a shipped series.
source: auto-skill
extracted_at: '2026-08-29T10:14:07.173Z'
---

# AEC preference-flow constants — derive, validate, lock in (auspol tracker)

Current shipped state (commits 0d1b264 + c158a89, 2026-08-29): **2025-anchored**
constants now live in `.build/newtracker/flows.mjs` — the SINGLE source,
imported by **both** `validate.mjs` (inversion check) and `gen-data.mjs`
(synth2pp diagnostic series). Values unchanged: `{ grn: 0.868, onp: 0.271,
oth: 0.485 }` (commit 56936b8 chose them). `onp` is the ALP-side share of
One Nation preferences — `impliedAlp()` ADDS `FLOW.onp * p.onp`. Never
"fix" it to the LNP-side value (0.729 in 2025, 0.647 in 2022); that
inverts the check. Refreshes edit flows.mjs ONLY — both consumers follow.

History: 80718de anchored 2022 constants → e4d3861 added SA-2026 evidence →
56936b8 re-anchored to 2025 after the user asked "why not the 2025 flows?"
(Good question — current-term houses allocate off the most recent election,
and ON→ALP had collapsed 8pts between elections, so 2022 constants were
genuinely stale.) If a newer federal election than the anchored one exists,
expect the same question; refreshing is the correct response.

Evidence trail in-repo: `.build/aec-flows.py` (parser — takes any event file
as argv[1], prints validate.mjs-ready buckets) + `.build/flow-validate.mjs`
(competes candidate sets against data/polls.json). Both committed
deliberately as reproducible provenance.

## Refresh procedure (after every federal election)

1. `curl -sL -o /tmp/aec-flow/tcp-flow-<yr>.txt https://results.aec.gov.au/<EVENT>/Website/Downloads/HouseTcpFlowByPartyDownload-<EVENT>.txt`
   — uniform URL pattern (2022 = 27966, 2025 = 31496). Plain curl works, no
   UA spoofing needed for AEC.
2. `python3 .build/aec-flows.py /tmp/aec-flow/tcp-flow-<yr>.txt` — raw
   per-party table, then bucket constants. The bucketing skips the `First`
   aggregate row and major-party self-flows itself.
3. Add the new set to the SETS dict in `.build/flow-validate.mjs` and run it.
   Metric: mean |per-house mean residual| vs published 2PP over current-term
   polls with tpp_alp, houses with n≥5.
4. Pick a winner: prefer lumped IND+OTH over split-IND (won in BOTH 2022 and
   2025) and prefer the freshest election's set when it's within ~0.15 of
   best — current-term pollsters allocate off the latest election, so fresh
   wins ties.
5. Swap the winner into **flows.mjs** (the shared module) with a provenance
   comment — the existing block is the template: both elections' numbers +
   vote counts + bias measurements + "re-derive after the next federal
   election". validate.mjs and gen-data.mjs import it, so one edit
   re-anchors both; then re-run build.mjs so synth2pp regenerates.
6. Gate: `node .build/newtracker/validate.mjs` → 0 errors. ±3 slack means
   real flow drift must NOT trip it; only an inverted column does. (2025
   constants stayed green on polls.json AND all cyclePolls histories.)
7. Commit flows.mjs + both scripts + the rebuilt payload together, message
   naming the event ID; push. Use repeated `git commit -m` flags, not a
   heredoc — an apostrophe ("Ben Raue's", later "table's" in the synth2pp
   commit) inside a heredoc commit message broke the command TWICE in this
   project. **No mid-cycle flow updates: constants change only at federal
   elections**, so the diagnostic stays interpretable against one fixed table.

## AEC TCP flow file parsing traps (2022; confirmed on 2025)

- Tall tab-separated format: header line + column header, then
  `<seat-range> <from-name> … <from-code> … <to…> <votes> <pct-of-from> <pct>`.
- **Skip the `First` aggregate row** (frm === 'First') — first-preference
  totals (5.08M ALP / 4.54M LNP in 2025; 4.47M / 5.07M in 2022) that pollute
  every bucket if summed.
- **Skip from-rows in {LP, LNP, NP, CLP, ALP}** — major-party
  self-reallocations, not minor-party voter flows. Only minor-party `frm`
  codes feed the buckets. (aec-flows.py prints these in its raw table; only
  the bucket section filters them. Don't sum the raw table.)
- Destination collapse: `to` ∈ coalition codes (LP/LNP/NP/CLP) → LNP bucket,
  ALP → ALP bucket; anything else is ignorable.
- macOS `grep -P` does not exist (BSD grep) — use `node -e` / Python for parsing.
- `write_file` refuses `/tmp` under BOGAN approval — keep analysis scripts in
  `.build/` (they're committed as provenance anyway); curl the data files to
  /tmp instead.

## Measured flows (ALP share of each bucket, votes ALP v L·NP)

| bucket | 2022 (Event 27966) | 2025 (Event 31496) | move |
|---|---|---|---|
| GRN → ALP | 83.71% (1,199,015 v 233,317) | 86.83% (1,279,081 v 194,050) | +3.1 |
| ON → ALP  | 35.33% (243,683 v 446,107)   | 27.10% (244,177 v 656,962)   | **−8.2** |
| IND → ALP | 58.32% (174,234 v 124,523)   | 63.56% (294,426 v 168,775)   | +5.2 |
| IND+OTH lumped | 44.30% (661,807 v 832,212) | 48.49% (711,699 v 756,292) | +4.2 |
| OTH excl IND | 40.79% | 41.55% | +0.8 |

Movement this large between elections is exactly why constants are
re-derived per election and only ever back a coarse check, never a series.

## Which AEC cut? — one election, three "official" flow percentages

The AEC publishes the same election's preference flows in three cuts, and
anyone checking the shipped constants against the Tally Room website will
see DIFFERENT percentages. Both figures are correct; they answer different
questions. For 2025 (Event 31496):

| cut | source | GRN→ALP | ON→ALP | what it measures |
|---|---|---|---|---|
| TCP web table | `HouseStateTcpFlow-31496-NAT.htm` | 79.93% | 18.43% | shares across ALL final-two destinations — ALP, Coalition AND GRN/IND/ON/KAP/CA columns |
| TCP download, majors-only renorm (SHIPPED) | `HouseTcpFlowByPartyDownload-31496.txt` via `aec-flows.py` | 86.83% | 27.10% | destinations collapsed to the two majors, then renormalised |
| TPP download | `HouseTppFlowByStateByPartyDownload-31496.txt` | ~88.2% | ~25% | every ballot redistributed ALP v Coalition in all 150 seats — the cut media quote |

The shipped numbers reconcile EXACTLY with the web table, not contradict
it: 86.83 = 79.93 / (79.93 + ~12.1 coalition share) and likewise
27.10 = 18.43 / (18.43 + ~49.6). The web-table percentages look lower
because their denominators include flows to non-major finals — ~8% of
flowed GRN votes and ~32% of flowed ON votes in 2025 landed on
independent/KAP/CA final candidates.

The shipped cut sits below the TPP cut (86.83 vs ~88.2 on GRN) for two
structural reasons: seats where the from-party was never excluded
contribute no TCP flow rows (GRN in Melbourne 2025), and flows landing on
IND/minor finals drop out of the majors-only denominator, implicitly
treated as neutral between the majors.

Quick recognition: **~80/18 = TCP page · 86.8/27.1 = this codebase ·
~88/25 = TPP file.**

Refresh rule: always re-derive from the SAME cut (TCP download,
majors-only) so constants stay comparable across elections. The TPP file
would be the conceptually purest synthetic-2PP input, but re-anchoring to
it is a deliberate change that must go through the `flow-validate.mjs`
competition in the refresh procedure above — never a straight swap. A
cross-project write-up of the three cuts also lives in the user-level
skill `aec-flow-cuts`.

## Validation findings (121 current-term polls, 7 houses, n≥5; mean |house bias|)

| candidate set | bias |
|---|---|
| AEC-2025 lumped {0.868, 0.271, 0.485} | **1.01** ← shipped |
| old placeholder {0.82, 0.35, 0.50}    | 1.14 |
| AEC-2022 lumped {0.837, 0.353, 0.443} | 1.14 |
| AEC-2025 split-IND                    | 1.24 |
| AEC-2022 split-IND                    | 1.80 |
| unconstrained least-squares fit       | 0.89, but needs GRN→ALP 1.15 — never ship |

Lumped IND+OTH beats split-IND in BOTH elections: houses publishing an IND
series aren't split uniformly, and poll-house 2PP is respondent-allocated,
not a raw-flow reconstruction. Essential is the outlier in every config
(−2.6 to −5.1) — its published 2PP includes undecided (`tppIncludesUndecided`
in pollsterRules), so implied-ALP runs systematically high against it; that
is documented behaviour, not a constants problem.

## Settled design conclusions

- **Synthetic 2PP via global constants is viable ONLY as an opt-in
  diagnostic, never as a headline or correction.** This superseded
  (commits 0d1b264 + c158a89) the earlier "NOT viable as a shipped series"
  verdict: what ships is `synth2pp`/`synthLatest` in the payload + an
  off-by-default "Compare implied 2PP" hero checkbox (dashed ALP-colour
  line). The earlier arithmetic still holds — no constant set predicts
  published 2PP within ±1, because poll-house 2PPs are respondent-
  allocated per house (best unconstrained fit needs GRN 1.15 —
  interpretively meaningless) — which is exactly why it can never replace
  the published aggregate, and the copy must say so ("a gap, not a
  verdict"). If asked for MORE than a diagnostic (per-house coefficients,
  respondent-level allocation), say that is the only viable route up
  front.
- **Anchor the series at the implied figure, not the counted one.** The
  election-month point is the flow table read onto the count's OWN
  primaries (2025: implied 54.2 vs counted 55.2) — that −1.0 is the ONE
  measurable error of the table, and anchoring to 55.2 would launder it
  away. A diagnostic whose first point hides its known miss is useless.
- **House effects and monthly machinery REUSE the standard path**: build
  synthetic tppRows from each poll's primaries (require alp/lnp/grn/onp
  all present), run them through `houseEffectsFor` + `monthlyAdj`, emit a
  parallel `synthLatest` nowcast. Do not invent new estimator code.
- **Constants only back the validate.mjs inversion check** (series mean vs
  implied, ±3 slack — caught the real 291-row 2022-25 cycle inversion where
  the L/NP figure sat in tpp_alp).
- External corroboration for coarse-only use — SA 2026 (Tally Room 64676,
  cited in the validate.mjs comment): the same party's preferences
  redistribute by CONTEST and SEAT (GRN ~80%→ALP in ALP–ON contests but
  ~67% in Elizabeth; LIB→ON 53–73.5% by seat; ALP–ON was the modal 2CP,
  25 of 47 seats). The tracker's altTpp (ALP-v-ON) nowcast is the forward
  lens, not a synthetic ALP-v-LNP series.
