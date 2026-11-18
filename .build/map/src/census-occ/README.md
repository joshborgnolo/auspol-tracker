# census-occ — 2021 Census sub-major occupation counts (manual TableBuilder export)

The GCP packs only publish occupation at 1-digit (B45B/G57B/G60B). The
/map/ census People **Occupation** lens needs sub-major (2-digit) counts
to express its seven Oesch-style classes, and the only ABS product
carrying those at electoral geography is **TableBuilder** — interactive,
one-off, manual. Nothing here is refreshed by a pipeline.

## Required export (run once, commit unedited)

Two files beside this README:

| file | contents |
|---|---|
| `occp-valueset-2021.csv` | ABS's official OCCP 2-digit value dictionary (FactTable metadata) — `occ_lanes.py`'s code/title table is benchmarked against it on every self-test |
| `sa2-2021.csv` | SA2 (2021) × all 43 sub-major groups, persons |
| `ced-2021.csv` | CED (2021) × all 43 sub-major groups, persons |

Table spec for both:
- dataset: **2021 Census** — counting **employed persons aged 15 years
  and over**, place of **usual residence**
- columns: **OCCP — 2 Digit Level (sub-major groups)**, all 43, persons
- rows: all SA2s / all CEDs respectively
- keep ABS's numeric codes and its supplementary rows (Not applicable /
  Not stated — they document themselves; the pipeline excludes them from
  the stated basis deterministically)
- CSV download including totals; **do not** edit, normalise, or sort —
  TableBuilder's random cell perturbation stays in the file (class shares
  are computed inside the file's own stated basis, and the pipeline's
  publication gate checks Σ(43 sub-majors) against GCP G60B's stated
  occupation total within ±3% per division)

Provenance sidecars (`sa2-2021.json` / `ced-2021.json`), hand-written
next to each CSV: `{ "table": "…", "exported": "YYYY-MM-DD", "by": "…" }`.

If TableBuilder access turns out to emit occupation at 1-digit only on
these geographies, stop — do not set the files down; the feature has a
hard no-silent-degradation rule.

`testdata/toy.csv` is a hand-authored miniature of this layout used by
`.build/map/occ_lanes.py`'s self-test; it is not census data.

## Landed 2026-11-19

`sa2-2021.csv` and `ced-2021.csv` came from TableBuilder's *2021 Census -
employment, income and education* dataset: SA2 (UR) / CED (UR) rows ×
"2-digit level OCCP Occupation" (54 items: the 43 sub-majors, the nine
major-level "nfd" cells, `&&` not stated, `@@` not applicable), counting
Person Records, codes on. Not-applicable rows (people not employed) fall
outside the 43-code basis, so the counting universe makes no difference.
The class basis is Σ(43 sub-majors); the nfd cells are excluded from it
and only re-enter for the drift gate, which compares Σ(43 + nfd) per CED
with GCP G60B's eight majors — worst 1.45% across 155 rows at landing.
`gcp_newlanes.load_occ` spreads each SA2's class mix onto its SA1s by
G60B stated workers; the federal voter stores (2016–2025, all on the 2021
census), the 2021-census state frames and the SA1 areas pack read it.
