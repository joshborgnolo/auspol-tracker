---
name: auspol-aec-event-downloads
description: Parsing the AEC event Downloads CSV family (HouseFirstPrefs*/HouseTcp*/HouseTpp*/HouseNonClassic*/HouseMembersElected*Download-<EVENT>.csv) for seat-level results — RFC-4180 quoted fields ("Shooters, Fishers and Farmers Party" embeds commas and silently corrupts vote sums under naive split), the banner+header two-line preamble, Informal pseudo-rows, DivisionID-vs-DivisionId casing drift between files, and the seat-model W3 baseline extraction + GES 150/150 invariant test (worked 2026-10-08, commit 76477c0).
source: auto-skill
extracted_at: '2026-10-08T02:28:12.447Z'
---

# AEC event Downloads CSV family — parsing anatomy (auspol-tracker seat model)

The `https://results.aec.gov.au/<EVENT>/Website/Downloads/` results CSVs
(distinct family from the `*FlowByPartyDownload-*.txt` flow files covered by
`aec-preference-flow-constants` — those are tab-separated, these are QUOTED
CSV). Plain curl works; vendor a provenance copy (seat-model W3 commits them
under `atlas/data/aec-2025/`, sha256 first-16-hex recorded in the consumer's
`_provenance.files`). Event 31496 = 2025 federal.

## THE trap: RFC-4180 quoting, naive split corrupts votes

These files quote fields: `"Shooters, Fishers and Farmers Party"` embeds
commas in **HouseFirstPrefsByCandidateByVoteTypeDownload** and
**HouseNonClassicDivisionsDownload** (grep proven; the TPP/TCP/Members files
are unquoted — but parse all five through the same splitter anyway). A naive
`line.split(",")` silently shifts that row's later columns: the candidate's
vote columns slide off by one and the division's formal total reads ~2k
short. Diagnostic signature observed (W3 tests, 2026-10-08): **TCP final-pair
votes summed HIGHER than formal votes** in the 8 divisions containing a
Shooters candidates (Calare, Farrer, Hunter, Lindsay, Page, Parkes, Riverina)
plus Lyons — because `formal` was read off a shifted row.

Copy the shared splitter verbatim into both extractor and test (it's in
`.build/analysis/seat-model/extract-2025-baseline.mjs`): handles `""` escapes
and treats `"` as opening a quoted field ONLY at cell start (`cur === ""`) —
mid-cell quotes stay literal.

## File anatomy (all five House*Download-31496.csv)

- Line 0 is a BANNER (title text), line 1 the column header, data from line
  2. `extract-2025-baseline.mjs` `read()` helper is the reference.
- `DivisionID` vs `DivisionId`: **casing differs per file** — FirstPrefs/TCP/
  TPP/Members use `DivisionID`, NonClassic uses `DivisionId`. Reaching for
  the wrong one gives `undefined` keys, not an error.
- **Informal is a pseudo-candidate**: FirstPrefs carries one per division
  (`PartyNm === "Informal"`, blank PartyAb); Filter by PartyNm before grouping
  or informal votes pollute the OTH bucket. Same row holds the informal count
  for the seat (`TotalVotes`). `PartyAb` values include the coalition codes
  `LP`, `LNP`, `NP`, `CLP` + `ALP`, `GRN`, `ON`, `IND`, minor codes (CYA, FFP,
  LTP, HMP, KAP, XEN …) — the four coalition codes are held as SEPARATE keys
  in the baseline (no lumping at extraction time; lumping is consumer business).
- TCP final pair is exactly 2 candidate rows per division even in non-classic
  seats; `HouseTppByDivisionDownload` vote counts reconcile EXACTLY with the
  seat's formal total (`alp + coalition === formal`) — percentages are 2dp
  rounded.
- TCP vote total is `<= formal` but not equal (excluded candidates' votes);
  equality is NOT an invariant.

## W3 seat-baseline pattern (shipped 2026-10-08, commit 76477c0)

`.build/analysis/seat-model/extract-2025-baseline.mjs` →
`data/seats-2025-baseline.json` → `test-2025-baseline.mjs`. Per seat:
`{name, state, aecId, primaries{alp,lp,lnp,npl→np…on,grn,oth[,member:key]},
formal, informal, tcp{pair[{group,votes}], classic}, tpp{alp,coalition},
member{party,group,name}}`, seats ordered by state (NSW→ACT, fixed ORDER
table) then name. Raw COUNTS everywhere — shares are model-layer business.

Elected crossbenchers outside the named groups keep a `member:<surname>`
key (10 IND + KAP's Kennedy holder + 1 more IND = 12 named-member seats in
2025). `memberById` joins to HouseMembersElected for winner + TCP label.
TCP labels reuse the same grouping map so the winner group is comparable to
the member row's party.

## GES layer-1 invariant (test contract)

`test-2025-baseline.mjs`: 150 seats; unique names+aecIds; state counts
{NSW:46,VIC:38,QLD:30,SA:10,WA:16,TAS:5,NT:2,ACT:3}; primaries sum EXACTLY
to formal; winner group === member's group for **all 150** (the GES
guarantee — "the model must reproduce 150/150 real 2025 winners as a build
test"); TCP pair size 2 with votes sorted-exact vs the AEC file; TPP exact
and summing to formal; `classic === !nonClassic.has(id)`; named-member seats
=== 12; cross-check against `atlas/data/all_elections_2PP_by_division.csv`
2025 rows (150 rows, names normalised both sides, atlas ALP 2PP within 0.06
of computed — atlas percentages are 2dp rounded). Exit 1 with a `FAIL <label>`
line per breach. Run extractor THEN test from repo root; commit the four
paths together (extractor, test, out JSON, vendored FirstPrefs CSV).

Related: `aec-preference-flow-constants` (flow-TXT family + constant
derivation), `auspol-abs-census-datapack` (the matching W1 demographic frame),
`auspol-electoral-atlas` (2025 rows these sources append to the atlas).
