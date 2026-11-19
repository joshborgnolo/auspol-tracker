# census-occ — Census sub-major occupation counts (manual TableBuilder exports)

The GCP/BCP packs only publish occupation at 1-digit (B44B 2006,
B45B 2011, G57B 2016, G60B 2021). The /map/ census People **Occupation**
lens needs sub-major (2-digit) counts to express its seven Oesch-style
classes, and the only ABS product carrying those at electoral geography
is **TableBuilder** — interactive, one-off, manual. Nothing here is
refreshed by a pipeline.

## The exports (run once per census edition, commit unedited)

| file | contents |
|---|---|
| `occp-valueset-2021.csv` | ABS's official OCCP 2-digit value dictionary (FactTable metadata) — `occ_lanes.py`'s code/title table is benchmarked against it on every self-test |
| `sa2-2021.csv` / `ced-2021.csv` | 2021: SA2 / CED × all 43 sub-major groups, persons |
| `sa2-2016.csv` / `ced-2016.csv` | 2016: SA2 / CED × all 43 (ANZSCO, same lattice) |
| `sa2-2011.csv` / `ced-2011.csv` | 2011: SA2 / CED × all 43 |
| `cd-2006.csv` / `ced-2006.csv` | 2006: collection districts (the map's own unit — no spread) / CED (2007-boundary set, rows coded CED07###) × all 43 (OCC06P first edition, same lattice) |

Table spec for every export:
- dataset: that edition's Census — counting **employed persons aged 15
  years and over**, place of **usual residence**
- columns: **OCCP/OCC06P — 2 Digit Level (sub-major groups)**, all 43,
  persons (54 items in the print with the nine major-level "nfd" cells
  and the `&&`/`@@` placeholders — they carry no class)
- rows: all of the edition's units (SA2s in 2011–2021, CDs in 2006; all
  CEDs in each and, for 2006, the CED2007 specialist set)
- keep ABS's numeric codes and its supplementary rows (Not applicable /
  Not stated — they document themselves; the pipeline excludes them from
  the stated basis deterministically)
- CSV download in TableBuilder's original layout; **do not** edit,
  normalise, or sort — TableBuilder's random cell perturbation stays in
  the file (class shares are computed inside the file's own stated
  basis, and each edition's publication gate compares Σ(43 sub-majors +
  nfd) against the edition's own GCP/BCP stated total within ±3%)

Provenance sidecars (`<file>.json`), hand-written next to each CSV.

If TableBuilder access ever regresses to 1-digit only on these
geographies, stop — do not set the files down; the feature has a hard
no-silent-degradation rule.

`testdata/toy.csv` is a hand-authored miniature of this layout used by
`.build/map/occ_lanes.py`'s self-test; it is not census data.

## Landed 2026-11-19 (2021 edition)

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

## Landed 2026-11-19, editions arc (2006/2011/2016)

`sa2-2016` (2,310 SA2s, 9-digit codes) + `ced-2016` (2016 election-era
CEDs, `CED###`): from the *2016 Census - employment, income and
education* dataset, "OCCP — 2 Digit Level" (ANZSCO, the canonical
54-item family). Its state runs wire nsw19, vic18, qld17, wa17, nt16
page-side; act16/tas18's demo *stores* land the same lane (the tas/act
frames present no People select lens, so their /map/ files stay era-null
by contract). `sa2-2011` (2,214 SA2s) + `ced-2011`:
same spec on the *2011 Census* lighting nsw15, vic14 and the
federal 2013 frame (tas14 likewise store-side only); its 7-digit SA1 codes fold to the parent SA2 as the
SA2's state digit plus its trailing 4-digit ordinal
(`SA1[:5] == SA2[0]+SA2[-4:]` — SA1 1100701 belongs to SA2 101021007;
the join is an index keyed off the committed SA2 codes, collision a
hard fail). `cd-2006` (38,713 collection districts — the map's own
unit, no spread needed) + `ced-2006` (150 divisions of the
CED2007-specialist print, rows coded `CED07###` — the export guard
compares it against the 2006 BCP's own B44 totals summed to states):
OCC06P first-edition ANZSCO, the same 54-item family — the federal
2007 and 2010 frames ride it. Drift gates (each edition's export v its
own GCP/BCP profile): 2016 1.01% (gcp-ced-2016.zip), 2011 1.30%
(B45B summed SA1→CED through ABS's own allocation — no 2011 CED
profile survives on the datapacks endpoint), 2006 1.08% (CD B44 sums
at state grain; no CED product at all), 2021 1.45%.

