# election-demographics — pre-2025 final-poll demographic stores

Reconstruction of demographic-breakdown polling data (voting intention by
age/gender/state/…) from the FINAL published polls of the 2013, 2016, 2019 and
2022 federal elections, into inert data stores:

    data/demographics-{2013,2016,2019,2022}-election.json

Built 2026-11-10 on request ("scrape it all, store it"). Nothing here is
rendered or read by the site's pipeline yet; the stores mirror the 2025
store's shape (waves of total+dims figures) plus provenance, notes and gaps.
gen-data/validate.mjs know nothing about them — wiring them in is later work.

## Pipeline

    lanes/<house>.json   (agent-scraped, human-audited verbatim figures)
        └── build-stores.mjs  →  data/demographics-<year>-election.json
    manifest.json        (cycles + the lane schema)
    src/<house>/         (verbatim evidence files, one NOTES.md index per dir)
    probe-feeds (removed — outcome folded into this README)

Every figure in a wave is traceable: store → lane file → src/ file → capture
URL. Lanes never invent; a figure that can't be verified in a saved copy is
filed null with a gap note (e.g. the 2019 Q1 Newspoll grid's unreadable VIC
One Nation/Greens cells). OCR-read tables (The Australian's scanned prints)
were gated per printed column: only rows whose filed cells sum to 99–101
were accepted, ambiguities resolved by that sum, and per-cell figures kept
even where one cell stayed null.

## Coverage matrix (waves filed / dims printed)

| House | 2013 | 2016 | 2019 | 2022 |
| --- | --- | --- | --- | --- |
| Newspoll | ✓ election-eve card (state only by that era's layout; sex/age columns did not yet exist in the printed table) | ✓ June pool n 5,385: state, sex, 3×age, metro (all columns gate 100) | ✓ Q1 pool n 6,393 full grid by recovery-OCR (flagged adjacentQuarter; VIC cells nulled) + ✓ Apr–May five-poll state 2PP pool (14 May) | ✓ Q1 pool state/sex/age/income 2PP grid + ✓ election-eve poll (n 2,188, full nationals incl. Others 9) |
| Essential Research | ✓ final wave (n unrecoverable — About page font-mangled) | ✓ special pre-election poll (n 1,212) + printed Have-/Not-voted split | ✓ final wave (n 1,201) | ✗ house published no voting-intention question (suspended after 2019 until late 2023) |
| Roy Morgan | ✓ full pack: state×6, capital/country, 5×age (primaries+2PP), gender 2PP (n 4,937) | ✓ last wave May 28/29 (n 3,099): national + state/age 2PP prose | ✓ final VI wave (n 1,265) | ✓ finals week(s): nationals (2PP 53, respondent alloc 56.5) + state×6 2PP prose (n 1,366) |
| Resolve Strategic | — (house founded 2021) | — | — | ✓ final campaign poll (n 2,049): 3×age primaries, gender-Greens split |
| Ipsos (Fairfax) | — (contract started 2014; finals VI only from 2018) | ✓ final poll (n 1,377: nationals) | ✓ final poll (n 1,842: nationals + voted/not cohort) | ✗ no public VI finals product |
| Galaxy | — | ✓ final poll (n 1,768: nationals only) | — (house absorbed 2017) | — |
| ReachTEL | — | ✓ final 7 News release (leaned primaries incl. PPM gender splits) | ✗ house ceased federal polling (evidenced) | — |

✓/✗/— : wave filed / no such product exists (evidenced) / house not in market.

## Failure classes & findings of record

- **BludgerTrack first (planned source) failed shape-wise**: none of the
  2013–2022 cycle feeds survives in the table shape today's extractor reads —
  no <federal> XML archived anywhere (CDX-verified), the cycle pages'
  archived assets are wayback-rewritten chart junk. No tier above original
  sources paid out for pre-2025 demographics.
- **Newspoll tables recovered from two dead CDNs**: News Corp's legacy assets
  host (resources.news.com.au, 2013 election-eve card) and The Australian's
  later wordpress files mirror (theaustralianatnewscorpau.files.wordpress.com,
  2016 election tables + Q1-2019 tables), both Wayback-only today. The Q1-2019
  scan is image-only — figures obtained via macOS Vision OCR of a 220–400dpi
  render and gated by column sums (repo OCR pattern).
- **The Australian's election-eve 2022 story** was fetched from AMP text —
  that story prints the Others→9 figure that completes the final table.
- **2013 Newspoll has no sex/age breakdowns** in print (joined the layout in
  2016); 2019 Newspoll election-week tables simply aren't on any recovered
  host (Q1 + the five-poll April–May pool are the 2019 record).
- **Partial-2PP carry-over**: Morgan files per-table 2PP forms differ for
  some 2013 state cells (single-table vs trend-table); both preserved in the
  source JSON, noted in the wave.
- Ipsos printed no VI crosstabs in either final release; Essential likewise
  no age/sex/state VI splits (checked full PDF text of all three final weeks);
  Ipsos-2019's printed cells sum 92 — the residue was never printed (filed as
  printed, flagged in notes).

## Re-run: `node .build/analysis/election-demographics/build-stores.mjs`
