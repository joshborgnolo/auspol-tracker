# Historical federal boundaries: Handbook-first audit

30 October 2026. Initial research snapshot. **Superseded for implementation status by [README-history.md](README-history.md): all three frames now use losslessly converted Handbook geometry.**

The Handbook dataset supplies complete candidate sets for 1993 and 1998. There is no current justification for starting archival reconstruction. The comparison also reveals a material problem with the existing ABS-derived 1996 reference: its Brand geometry resembles the later boundary used in 1998 and excludes Collie, which belonged to Brand at the 1996 election. Retaining supposedly unchanged jurisdictions from that reference is therefore not yet safe.

## Source and election selection

Source: [Tim Sherratt's repository](https://github.com/wragge/historical-federal-electorate-boundaries), pinned to commit `fb76072cfa5edb6fa52e557694efdc85954ace31`. The [author's explanation](https://updates.timsherratt.org/2026/09/15/a-complete-set-of-historical.html) describes API KML extraction and GeoJSON conversion.

Downloaded the CSV index and all 256 distinct GeoJSON files required across the three elections. Every selected file has a SHA-256 recorded in `handbook-boundaries-audit.json`; the index, AEC result store, ABS GeoPackage and relevant published map file are also hashed.

| Election | NSW | VIC | QLD | WA | SA | TAS | ACT | NT | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 13 March 1993 | 50 | 38 | 25 | 14 | 12 | 5 | 2 | 1 | **147** |
| 2 March 1996 | 50 | 37 | 26 | 14 | 12 | 5 | 3 | 1 | **148** |
| 3 October 1998 | 50 | 37 | 27 | 14 | 12 | 5 | 2 | 1 | **148** |

All three name/state sets match `data/division-results.json`, the project's certified AEC results. The one spelling difference is Handbook “Kingsford Smith” versus AEC “Kingsford-Smith”; the canonical name is used in the candidate collections. These totals also agree with [Parliament's election division table](https://www.aph.gov.au/About_Parliament/House_of_Representatives/Powers_practice_and_procedure/Practice7/HTML/Appendices/Appendix11).

**Date precision:** the CSV contains years, not exact effective dates. None of these elections falls in a selected boundary's transition year. Selection uses `start_year < election_year < end_year`, with open-ended records supported; the script deliberately rejects transition-year queries rather than pretending year-level dates are exact. The live Canberra API likewise returns year-valued `DateFrom`/`DateTo` fields. Embedded `Proclaimed` metadata is not used as a substitute for verified legal effective dates.

Comparing selected map IDs confirms that only VIC/QLD/ACT change between the 1993 and 1996 selections, and only WA/QLD/ACT between 1996 and 1998. This agrees with the AEC's [1996 report](https://aec.gov.au/Elections/Federal_Elections/1996/report/introduction.htm) and [1998 report](https://aec.gov.au/Elections/Federal_Elections/1998/report/introduction.htm). It validates the historical shortcut, **conditional on having an accurate 1996 reference**.

One live provenance spot check was completed: Canberra map ID 10824, 1994–1997. The decoded [API KML](https://handbookapi.aph.gov.au/api/ElectorateMaps/ElectorateMap?id=10824) and the repository KML are byte-for-byte identical, SHA-256 `5be279b3715392aa31ab16640c16c27bd92a92e2d67203af2bc4825be41aa995`. This verifies that sample, not every file against the live API.

## Spatial comparison and the 1996 reference problem

Compared the Handbook's 148-division 1996 selection with the original ABS `commonwealth_electoral_division_1996` layer, rather than a simplified map export. All calculations use Australian Albers (EPSG:3577), the existing map's main extent (112°E–154.5°E, 44.5°S–9°S), and 0.01° maximum segment lengths before projection. That last step prevents long sparsely digitised state borders becoming artificial straight chords in the projected comparison. Areas are diagnostic estimates, not legal surveyed areas.

| 1996 division | Handbook area, km² | ABS area, km² | Intersection / union |
| --- | ---: | ---: | ---: |
| Brand | 6,302.11 | 446.85 | 6.08% |
| Cunningham | 356.98 | 105.00 | 27.10% |
| Calwell | 232.27 | 270.34 | 63.44% |
| Namadgi | 1,716.85 | 1,716.91 | 99.74% |

These differences cannot be treated automatically as Handbook errors. For Brand, comparing the same ABS “1996” polygon against the Handbook's **1998-election** polygon gives **98.20% intersection-over-union**, versus 6.08% for the 1996-election polygon. Several other WA divisions also agree much more closely with the later boundary version. This suggests a vintage problem in the ABS layer as used here; it does not establish the precise cause or prove that every WA polygon has the same problem.

Independent election membership evidence supports the Handbook's older Brand outline:

- The committed AEC 1996 WA first-preference product assigns Collie (5010012), Collie Central (5010013) and Collie North (5010014) to **Brand**. There are 33 candidate records for these three places in `.build/aec-flow-src/booth/fpv/1996-WA.csv.gz`.
- A town-location probe at the AEC 2004 Collie coordinate, 116.156801°E / 33.363570°S, falls inside the Handbook's 1996 Brand polygon. It falls outside both the ABS “1996” Brand polygon and the currently published `geo-1996-hi.json` Brand polygon, as well as outside the Handbook's later 1998 Brand outline. The later coordinate locates the town; it does not certify the exact 1996 venue location.
- A [2001 Western Australian parliamentary debate](https://www.parliament.wa.gov.au/hansard/daily/lh/2001-08-29/pdf/download) independently describes Collie as having been in Brand from 1990 to 1996.

The extractor now records this warning. The previous inference from the nominal 1996 edition date plus matching division names is insufficient to establish geometry vintage. NSW/VIC discrepancies such as Cunningham and Calwell remain unadjudicated. Fraser's large area difference includes an external-territory issue: the ABS extractor excludes the Jervis Bay fold-in marker, while the Handbook polygon includes Jervis Bay. It must not be treated simply as an incorrect mainland boundary.

## Validity, overlaps and combined candidates

The source 1996 and 1998 geometries are all valid. The 1993 Dickson geometry has a self-intersection. Original coordinates are preserved in the local candidate collections; `make_valid` is used only in memory for measurements.

| Election | Invalid source divisions | Pairwise overlap, km² | Overlap pairs ≥100 m² | Enclosed hole area, km² |
| --- | ---: | ---: | ---: | ---: |
| 1993 | 1 | 84.09 | 14 | 317.76 |
| 1996 | 0 | 71.09 | 7 | 298.20 |
| 1998 | 0 | 104.58 | 11 | 273.58 |

Most large overlaps are across independently digitised jurisdiction borders. The largest is Northern Territory/Grey, about 64.40 km². Enclosed holes include water bodies or intentional exclusions as well as potential gaps; their total is **not** a count of proven errors. Coastline detail and island treatment also differ between sources. The ABS reference has no overlap pairs over 100 m² and one approximately 0.021 km² enclosed hole.

As requested, both combined candidates were assembled using the three changed jurisdictions from the Handbook and all other jurisdictions from ABS 1996. They retain the correct name/state counts but have about 101.49 km² (1993) and 106.87 km² (1998) of pairwise overlaps. More importantly, the 1993 combination inherits the suspect WA geometry. These candidates are diagnostic artifacts, not approved election maps. Repairs need a deliberate common-border policy; automatic snapping must not be allowed to conceal a wrong historical boundary.

## Reuse assessment

The user confirmed that AusPolTracker is solely non-commercial, with no paid access, advertising or sponsorship.

[Parliament's copyright statement](https://www.aph.gov.au/Help/Disclaimer_Privacy_Copyright) applies CC BY-NC-ND 4.0 generally and preserves third-party rights. The repository does not establish a separate, more permissive map-data licence.

[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.en) permits non-commercial sharing of unchanged material with attribution. Section 2(a)(4) expressly permits necessary technical modifications and format changes without those alone creating Adapted Material. A lossless KML/GeoJSON/TopoJSON conversion is therefore materially different from changing a boundary. NoDerivatives is not an automatic prohibition on all reuse. Non-commercial adapted material may also be produced privately, but sharing adaptations is restricted.

The present map recipe additionally clips, snaps/cleans, fills gaps, simplifies at 60 m / 1 km, quantises coordinates and removes small islands. These operations are not established by the reviewed public terms as mere lossless conversion. Whether particular operations are authorised technical modifications depends on the applicable rights and context. Map-specific third-party ownership also remains unresolved. **I have not established permission to publish this processed geometry under the present recipe.** This is a specific unresolved clearance question, not a claim that permission is always required for format conversion.

A concrete reuse enquiry was prepared privately, including a lossless publication option, the existing map's processing steps, attribution, underlying ownership and the Brand comparison. It has **not been sent**. The official [Handbook help page](https://www.aph.gov.au/Help/Handbook_Online_Help) directs enquiries through its contact form with Parliamentary Handbook selected as the query type.

## Delivered files and next decisions

- Reproducible audit: `.build/map/audit-handbook-boundaries.py`.
- Metrics, selections and hashes: `.build/map/handbook-boundaries-audit.json`.
- Downloaded originals and three complete Handbook candidate frames: `.matilda/handbook-boundaries/source/` and `n-1993-handbook.geojson`, `n-1996-handbook.geojson`, `n-1998-handbook.geojson` in the same cache's parent.
- Two combined candidates: `.matilda/handbook-boundaries/n-1993-hybrid.geojson` and `n-1998-hybrid.geojson`.
- Private comparison graphic: `.matilda/handbook-boundaries/brand-comparison.svg`.
- Warning added to `.build/map/extract-asgc1996-ced.py`; no public boundary assets or year controls changed.

Re-run from the repository root with Python plus Shapely 2.x and pyproj 3.x, and Node with the project's existing `topojson-client` dependency:

```sh
python .build/map/audit-handbook-boundaries.py --fetch  # fetch pinned sources and audit
python .build/map/audit-handbook-boundaries.py          # cached, offline audit
node .build/test-division-results.mjs
```

The local run used Shapely 2.2.0 / pyproj 3.8.0. The existing division-results verification passes all 10,666 checks. The audit's selection assertions, geometry measurements and published Brand probe completed successfully; this means the audit ran, **not** that the geometry passed a publication gate.

The implementation subsequently chose lossless non-commercial publication, preserving the source defects and replacing the mixed-era ABS reference. See README-history.md for that decision, the exact-coordinate checks, remaining source limitations and reproducible build.
