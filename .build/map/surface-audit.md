# Surface audit and redesign

Audited 9 November 2026. Implementation is local until published through the site's normal deployment process.

## Findings

The previous Surface used a multiscale blend which eventually filled the whole map. In sparse regions, a location inherited remote towns and then the global average. There was no distance cutoff or indication of local support. Unlocated mobile-team results were allocated to a grid of invented positions in their electorate. Early centres entered the coarser levels although their electorate-wide catchment was not known. Missing booth measures could be replaced with the whole seat's result or with calibrated estimates. These are shared mechanisms, not census-only failures.

Census medians and SEIFA deciles cannot be combined as ordinary weighted shares. Booth demographics describe a venue or the voters attending it, depending on the frame, rather than an observed population at every point between booths. Census percentages also had the wrong spatial weighting: formal votes rather than the relevant population base.

The old election surface used formal House votes as the default weight. That was incorrect for informal rates (denominator is formal plus informal ballots), Senate shares (Senate formal ballots), and final-two or preference-flow shares when some ballots exhausted. These measures now use their own counted denominators. A change or split-ticket gap cannot be pooled exactly from differences alone without both original count bases.

The initial census example was not a copying error: SA1 70201105008 has published income $3,249/week and 72 residents. Areas tooltip identification now includes the SA1 code and makes clear that the value applies to that small area. Surface's former values at 130°E 25°S, 133°E 22°S and 133°E 20°S were approximately $1,782, $1,884 and $1,804; the corresponding Areas values were $1,213, $866 and $1,011. Census Surface links now resolve to Areas (or Seats when the frame has no compatible area pack).

## Implemented contract

- Surface is a descriptive map of nearby **ordinary polling-place results**, not a model of residents, voting intentions or the complete electorate result.
- Only type-1 ordinary places with valid coordinates and the measure's own local result enter the field. No early, hospital, mobile, unlocated or invented points. Missing counts remain missing; no seat-value fallback. Explicitly modelled alternative contests remain available and are labelled modelled.
- Great-circle distances are evaluated on Earth. A point has zero influence at or beyond 25 km. The working radius is twice the distance to the fourth distinct nearby site, bounded to 2–25 km; where fewer than four sites exist it uses 25 km. Co-located booth records count as one bandwidth site while all their ballots enter the count.
- Within radius h, a site's weight is its count denominator multiplied by `(1-d/h)^4 * (1+4*d/h)`. The value is the weighted ratio, preserving bounds and count-weighted arithmetic.
- Below 100 kernel-weighted ballots no estimate is shown. From 100 to 500, the colour fades smoothly into neutral. These are conservative display choices, **not confidence intervals or a calibrated reliability probability**.
- Tooltip and raster sample the same field, independent of zoom and previous requests. Point queries run locally through the same calculation, independently of the rendering worker; they do not wait behind a redraw. Missing raster cells are neutral, including loading and missing-data seats. Tooltips say when there is no supported local estimate and distinguish the whole-seat result.
- Surface markers show only records that contribute to the selected measure. Separate island shapes and insets remain neutral with eligible polling-place markers; island tooltips do not sample the mainland position behind an inset.
- The legend reports the contributing ordinary places and the share of formal House votes cast at those places, for the selected geography. This is input coverage, not population coverage or the effective denominator of a Senate/preference measure. Seat totals continue to include all voting methods.
- Census measures use Areas/Seats, with actual selected drawing indicated. Changes without comparable local count bases, seat type and exhausted-ballot totals use Seats/Balloons. Saved Surface choices return when an eligible election measure is selected again.

## Measure decisions

| Measure | Surface policy | Weight |
|---|---|---|
| Primary vote share | Observed ordinary-place results | Formal House ballots |
| Two-party share | Observed ordinary-place count only | Counted two-party ballots |
| Modelled alternative contest | Explicitly labelled estimates from eligible ordinary places | Model's paired ballot total |
| Final-two winning group | Observed local final-two counts | Counted final-two ballots |
| Informal rate | Observed ordinary-place counts | Formal + informal ballots |
| House preference flow | Observed donor-group continuing split | Ballots assigned to either finalist, excluding exhaustion |
| Senate share | Observed Senate booth count | Formal Senate ballots |
| Senate/upper-house preference split | Observed pair preferences | Donor ballots naming either party |
| TPP swing, primary change, Senate–House gap | No Surface; count bases not both available in this representation | — |
| Census shares, medians, SEIFA ranks | Areas where available, otherwise Seats | Published area measure |
| Seat type, exhausted-ballot measure | Seats | Whole-seat measure |

## Extent across shipped elections

The audit reads all 26 shipped `core-*.json` frames. Counts below are source availability, before the local 100-ballot support rule. A missing TPP count does not stop the same frame's primary-share surface working.

| Frame | Located ordinary places | Share of formal House votes | Places with TPP | Places with TCP |
|---|---:|---:|---:|---:|
| 1993 | 6,538 | 79.87% | 0 | 0 |
| 1996 | 6,756 | 80.05% | 6,756 | 6,756 |
| 1998 | 6,856 | 77.03% | 6,813 | 6,856 |
| 2001 | 7,194 | 80.55% | 7,194 | 7,194 |
| 2004 | 6,849 | 75.15% | 6,849 | 6,849 |
| 2007 | 7,722 | 79.56% | 7,722 | 7,722 |
| 2010 | 7,758 | 75.88% | 7,758 | 7,758 |
| 2013 | 7,696 | 67.37% | 7,696 | 7,696 |
| 2016 | 6,822 | 62.62% | 6,822 | 6,822 |
| 2019 | 7,167 | 53.67% | 7,167 | 7,167 |
| 2022 | 7,041 | 44.73% | 7,041 | 7,041 |
| 2025 | 6,964 | 40.33% | 6,964 | 6,964 |
| nsw15 | 2,382 | 62.90% | 0 | 0 |
| nsw19 | 2,516 | 61.17% | 0 | 0 |
| nsw23 | 2,619 | 50.56% | 0 | 0 |
| qld17 | 1,097 | 37.29% | 0 | 0 |
| qld20 | 1,419 | 27.16% | 0 | 1,419 |
| qld24 | 1,251 | 26.80% | 0 | 1,251 |
| sa22 | 689 | 60.80% | 0 | 689 |
| sa26 | 682 | 43.19% | 0 | 669 |
| vic14 | 1,713 | 58.02% | 0 | 1,713 |
| vic18 | 1,686 | 47.19% | 0 | 1,686 |
| vic22 | 1,755 | 34.75% | 0 | 1,755 |
| wa17 | 736 | 62.46% | 0 | 0 |
| wa21 | 645 | 34.07% | 0 | 0 |
| wa25 | 680 | 42.11% | 0 | 596 |

In 2025, 6,964 ordinary places supply 6,247,958 formal votes, 40.33% of the nationwide formal House total. Lingiari supplies 16 ordinary places and 7,722 of 45,632 formal votes (16.92%). Sydney supplies 48 places and 51,374 of 107,249 votes (47.90%); Riverina supplies 91 and 42,474 of 105,837 (40.13%). These figures explain why a local surface must never stand in for a whole-seat result.

## Sensitivity and validation

`node .build/audit-map-surface.mjs` reproduces the inventory and held-out comparison in `surface-audit.json`. The comparison samples every 29th eligible 2025 record (241 records); each prediction excludes all co-located source records. It predicts the withheld **polling-place** 2PP, not the vote of residents or empty land. It is a diagnostic sensitivity exercise, not a claim of nationally representative validation.

| Maximum radius | Rural places with predictions / 87 | Rural median absolute error | Rural mean absolute error |
|---|---:|---:|---:|
| 10 km | 41 | 4.45 pp | 4.65 pp |
| 25 km | 62 | 4.35 pp | 4.94 pp |
| 50 km | 73 | 4.73 pp | 5.72 pp |

Inner-metropolitan median absolute error was 2.63 pp at all three settings because the adaptive bandwidth was already short. Comparisons have different coverage and therefore are not a controlled proof that one radius is statistically optimal. The 25 km limit is a conservative compromise: 50 km adds rural coverage at greater observed error. Unsupported remote NT examples remain blank even in the 50 km sensitivity check.

Calculation regressions cover distant-outlier immunity, finite support, correct count bases, no synthetic locations, co-location handling, missing inputs, projection inversion with a nonzero centre, class-share conservation, worker/page consistency and zoom-invariant reads. A full great-circle scan independently checks the spatial index, including longitude wrapping and zero-weight exclusions. Browser checks exercise actual 2025 data, sparse NT locations, urban and regional centres, census fallback, mobile layout, historical/state frames, Senate share/preferences, modelled contests, island tooltips and JavaScript errors.

Final local validation:

- Passed: `test-map-draw`, `test-map-areas`, `test-map-chart`, `test-map-primary-breakdowns`, `test-map-vote-bands`, `test-map-senate`, `test-map-islands`, `test-map-history`, and `test-map-surface-browser`.
- Passed: assembly and `git diff --check`. The assembled script includes the starting checkout's previously unassembled Chart/UI changes; source changes remain confined to Surface, its controls and explanations.
- Browser check: no JavaScript errors. Initial Surface appeared in about 1.9 seconds; Sydney's detailed raster in about 2.0 seconds (down from about 10.4 seconds before the final rendering adjustment). These are one local headless-Chrome run, not a cross-device performance guarantee. Detailed rasters sample approximately every two CSS pixels; numeric readings remain exact samples of the defined field.
- Existing baseline failure: `test-map-page` stops at the missing Retro switch and before-paint Retro script. Both are absent in `HEAD:map/index.html` at starting commit `64479eb8`.
- Existing baseline failure: `test-map-ocean` finds `map/data/land.json` stale against its geometry source. The source, generated land, builder and test are unchanged from starting commit `64479eb8`.
- The full repository-wide `npm test` was not run. This report does not claim an entirely passing repository suite.

## Remaining limits

Ordinary booth location is still not voter residence. Distance does not model roads, rivers, community boundaries or catchment overlap. Neighbouring seats may supply different candidates and local campaigns. The display remains incomplete and potentially unrepresentative of all voting methods; the coverage text and separate seat total are essential. Low support is not interchangeable with sampling uncertainty. Sparse territory is intentionally blank.

The initial Areas checks found no mismatches in income median, age median or population across 61,811 areas against the cached ABS source. They also found 187 percentage cells capped at 100% by the existing builder, plus small-cell and denominator interpretation limits. Reproducing a source formula does not establish statistical reliability. This Surface redesign does not resolve those separate Areas issues or certify every census measure.

A future resident-vote model could use AEC SA1 footprint statistics, but those are indicative allocations with rounding, not directly observed secret-ballot results at every residence. The present change does not infer such a model or silently assign mobile/early voters to homes. It also does not rewrite the separate Balloons drawing or historical source data.

## Primary references

- [AEC 2025 downloads and statistics](https://www.aec.gov.au/election/fe25/downloads-statistics.htm): separates election-day, pre-poll and mobile sources; explains the indicative SA1 footprint product and its rounding limitation.
- [ABS confidentiality and relative standard error](https://www.abs.gov.au/statistics/microdata-tablebuilder/tablebuilder/confidentiality-and-relative-standard-error): explains perturbed totals and small-cell limitations. Census data do not have survey RSEs.
