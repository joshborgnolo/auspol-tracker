# New South Wales notional Labor-v-Coalition 2PP — adjudication

Started 2026-11-19 (states sweep; siblings nt/, vic/, qld/, sa/).

## The shape of the record

NSW is optional-preferential (OPCV) since 1980: exhausted ballots crop
the TCP counts — our frames already keep `flExh` rows. NSWEC's VTR
publishes only the final-pair 2CP per district (by venue and as a
check-count table), so 22 of 93 districts at nsw23, 19 at nsw19, 16 at
nsw15 never had a Labor-v-Coalition figure to show.

## What gets published

**NSWEC itself ships the machinery that computes the alternative count,
not its results**: the commission has data-entered every ballot since
2015 and publishes a public **preference-distribution TOOL** — any
pair of candidates may be distributed against each other into a count,
from the ballot file's own data. Antony Green's research paper for the
NSW Parliamentary Library (*2023 New South Wales election: Analysis of
results*, Research Paper 11 of 2023; updated as RP 7 of 2025, which is
what's mirrored) publishes the tool's own outputs per district, and its
document summary says so verbatim (*"Two-party preferred totals in this
publication have been derived from the Commission's on-line tool."*).

The publication class of those numbers then: official tool computes
from the official ballot file (not a model, not an estimate) — filed as
`tppn` (official-ish), `tppe` never marks them. If NSWEC one day
publishes the counts themselves somewhere, that would flip to plain
official — same lane either way.

The 22-district set verified: my live-parse of the pdf's superscript-1
("did not finish as a two-party preferred contest in 2023") rows equals
the live data file's bare set **exactly** (Ballina, Balmain, Barwon,
Cessnock, Kiama, Lake Macquarie, Manly, Murray, Newtown, North Shore,
Orange, Pittwater, Port Macquarie, Shellharbour, Summer Hill, Sydney,
Tamworth, Vaucluse, Wagga Wagga, Wakehurst, Willoughby, Wollondilly).

## NSW15 / NSW19

The 2015- and 2019-era NSWEC tooling records the same candidacy, and
his NSW 2019 analysis sits in the same Parliamentary Library series
(e.g. `antonygreen.com.au/docs/nsw/`); a research item queued beside
sa22, qld17/20, wa17/21/25. Neither shipped yet.
