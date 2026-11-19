# South Australia notional Labor-v-Liberal 2PP — adjudication

Started 2026-11-19 (state sweep after NT/VEC/QLD; sa26 is the largest
single lane gap on the map: 34 of 47 districts ended nowhere near the
traditional pair).

## What exists, in what form

- **ECSA's formal distributions** are the finals' own certified pair
  figures (the 13 ALP-LIB finals already in the frame).
- **ECSA DID undertake alternative Labor-Liberal distributions** for
  the seven districts Labor was excluded from the final pair —
  Antony Green's chapter says so verbatim (SA2026 Draft Analysis, p.4:
  "Labor was excluded during the distribution of preferences in the
  other seven seats. ECSA has undertaken a separate two-party
  preferred count in these seats to produce a Labor-Liberal count.")
  BUT the only public product of those counts is the
  `twoPartyPrefDeclarationVotes` lane in ECSA's results-API payload
  (`.build/state-flow-src/sa/2026/change.json`) — a DECLARATION-STAGE
  PARTIAL (e.g. Chaffey 13,517/6,230, far short of formal; Ngadjuri
  breaks at 893/1,059, transparently incomplete), so there's no
  complete official figure to ship and the lane can't file.
- **AG's estimated Labor-Liberal figures** (his per-district card's
  "2-Party Preferred (est)" block and the summary-table '(est)' rows)
  cover those same seven (Chaffey, Finniss, Flinders, MacKillop,
  Mount Gambier, Narungga, Stuart) **plus Kavel** (Labor v Independent
  final) — all est-provenance.
  ⚠ file these as `tpp` + `tppn` + `tppe` (Estimates, exactly the
  nt20/24 class).

## What does NOT exist (the remaining 26 of 34 stay bare)

- The 25 Labor-v-One Nation finals: ECSA undertook no alternative
  distribution for them and AG publishes no labor-liberal figure. The
  frame's honest read-out for those twenty-five is their own Labor-v-ON
  finals (already the tcp lane) — a "Labor v Coalition" headline
  candidate just isn't computable from anything published.
- Croydon (Labor v Greens final): AG's est block for it is its own
  class (estimates Labor-v-One Nation, the "(est)" on the card — its
  footnote class labels estimate Labor-Non-Labor), not a Labor-Lib
  figure under any provenance read of the documents. Nothing files
  here — do NOT reinterpret AG's labor-nonlabor estimates as
  labor-liberal ones.
- sa22's six (Finniss, Flinders, Kavel, Mount Gambier, Narungga,
  Stuart): 2022's exports record ECSA's alternative labours similarly
  inconclusive and its era summary didn't surface in this session's
  sweep; nothing filed there — research item.

## Semantics

The shared contract, with two sa26-specific amplifications:
1. partiel coverage is ORIGINAL — most of the state's bare seats are
   bare by published-books-empty, not by our negligence (the frame
   note / composition reads as-is; no est or noti rows exist to
   trigger the note's override variants).
2. AG's "(est)" marks LABOR-NON-LABOR estimates whose non-labor face
   can be Liberal (filed), or ONE NATION (Croydon — never filed as a
   "labor-liberal" figure by any read of them).
