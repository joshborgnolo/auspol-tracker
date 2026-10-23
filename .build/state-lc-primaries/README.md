# state-lc-primaries — Vic/SA/WA Legislative Council first-preference banks

Official-commission first-preference counts for the state upper houses,
parsed into one JSON per jurisdiction. Consumed by gen-data.mjs's
`primaryHistory.stateElections` block (the `LC_SRC` loop beside the NSW LC
try/catch) to emit `ste.<jur>.sen` — the "View: Primary votes ⇄" → State
elections → Upper views on /flows-explained/. Full-formal basis: every
family's share of EVERY formal first preference (NSW's own bank in
`.build/nswec-lc-flow-src/counts.json` is the ATL-papers count from the
ballot-level preference files — the two bases are NOT interchangeable, and
the chart captions say which is which; test-flow-splits pins both
wordings). Tasmania's Council sits out on purpose: fifteen
single-member-district Hare-Clark-style counts, no chamber-wide vote.

Landed 2026-10-24 (user: "why only nsw state upper house? are all others
impossible" → "yes" to adding Vic, SA and WA).

## Files

- `parse-<jur>-lc.py` — the parser (run from the repo root,
  `python3 .build/state-lc-primaries/parse-<jur>-lc.py`; sa is stdlib-only,
  vic/wa need `xlrd`, wa also `openpyxl`).
- `<jur>.json` — the bank: `{"events": {year: {formal, byParty, byPartyCase?, byFamily}}}`,
  `byFamily` ∈ ALP / COAL / GRN / ONP / OTHER.
- Raw sources are mirrored in `.build/state-flow-src/<jur>/lc/` (tracked
  alongside these files); the parsers read ONLY the mirrors, never the
  network.

## Family doctrine

Only ALP / COAL / GRN / ONP map out of OTHER. A party code the parser has
no key for is a hard SystemExit — never a silent OTHER. WA's codes are
year-qualified (`{code}:{year}`) because codes recycle across eras: SAP is
the Shooters, Fishers & Farmers in 2013 but the Sustainable Australia
Party in 2025; "ONP" in 2005 is One Nation (WA), a post-split rump that
books OTHER, never PHON's line; NAT is the Nationals from their 2005
re-entry, while 2001's Nationals ride NP. gen-data then applies the
primary view's standing 4% fold to grn/onp alone (a sub-fold family's
share joins `oth`, its own line a null — a gap, never a zero), exactly as
for the assemblies and the federal views.

## Sources

### Vic — Victorian Electoral Commission, 2006–2022

- 2006/2010: the "Final first preference votes" tables on the
  `state<year>result<region>region.html` result pages (the VEC's legacy
  results sites).
- 2014/2018: the same tables on the `<region>region.html` pages.
- 2022: the "Region Votes Received (Details)" workbooks — the REGION TOTAL
  row's per-Group TOTAL columns (the party is the group header's middle
  line).

Guards: per region, the candidate sum must EQUAL the printed Formal Votes
figure (2006–2018); every printed per-row vote percentage must match
votes/formal to its rounding; 2022 has no printed formal — the REGION
TOTAL column sum is the formal count.

### SA — Electoral Commission SA, 2022 & 2026

The JSON API behind result.ecsa.sa.gov.au:

- `GET /LCStatic/<yyyy-mm-dd>` — names each party id;
- `GET /LCChange/<yyyy-mm-dd>/0` — each party's statewide first-preference
  vote total beside the election's `totalFormalVotes`.

The API requires an `Origin` header (browser calls carry it; a bare curl
is refused). Mirrored as `lcstatic-<date>.json` / `lcchange-<date>.json`.
Guards: `electionStatus` must be "final", and the party votes must sum
exactly to `totalFormalVotes`. Ungrouped candidates ride no party entry —
the residual books to OTHER.

### WA — WA Electoral Commission, 2001–2025

Catalogue: `https://eis.waec.wa.gov.au/api/sgElections`. Each State
General election entry links its `ElectionLCResultsStatistics` pages; the
result workbooks sit under
`https://www.elections.wa.gov.au/sites/default/files/waec/sg_elections/LCDetailedResults/<sgYear>/`
(filenames with spaces need URL-encoding). Parse-wa-lc.py's header
documents the seven workbook layout eras (2001/2005 count summaries, the
2008 interleaved status columns, the 2013 detailed-vs-FirstPrefAnalysis
cross-guard, 2017, the 2021 FirstPreferences TOTALS rows, and the 2025
whole-of-state workbook guarded against the Calculation Steps report's
printed formal). Every era's per-region party sum must equal the
printed/derived formal total — a mismatch is a hard stop, never a
patch-up.

## Gotchas

- 2022 VEC workbooks: party names live on the group HEADER row, not the
  TOTAL row.
- WAEC numbers arrive as floats, text digits ('1250'), and multi-line
  progress cells ('0\n13856') depending on the era — `_num()` coerces only
  the first two.
- The 2013/2021/2025 TOTALS rows carry unlabeled trailing
  formal/informal/grand cells; the parser cuts them by POSITION (last
  three numeric cells), never by header label.
