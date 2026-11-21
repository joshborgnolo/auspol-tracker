# National-direction source and coverage notes

Completeness claims here are about publicly released, readable primary evidence, not unreleased private polling. Figures are taken verbatim from the archived primary documents; no interpolations or derived samples are accepted. Every backfill run applies `rm-samples-*` only to the matching fieldwork end, right/wrong pair and method, and rejects an ambiguous match.

## Roy Morgan

- The consolidated Government Confidence Rating tables are in `gcr-*.html`. Abbreviated-month rows and cross-month/year spans are retained correctly.
- Before 2012, the primary evidence is the transposed annual tables in the original releases: Findings 4259 (2007), 4343 (2008), 4452 (2009), 4519 and 4619 (2010), and 4729 (2011). Their HTML is committed as `gcr-release-*.html`. Blank HTML spacer cells are not figure columns.
- Primary release tables supersede contemporaneous secondary transcriptions for the same date/method. May 2008 keeps 56/25/18; its lone incompatible GCR cell is retained separately as `gcrPrinted: 130`, not copied into `gcr`. The December 2009–January 2010 table has wrong-direction `126`; the same release's prose proves 26, so that corrected figure is kept in `waves-supplement.json` with its primary URL.
- `waves-supplement.json` carries Finding 7559's March 24–April 1, 2018 reading, the four late-2013 releases, and the 2010 straddling wave.
- `rm-samples-2007-2013.json` and `rm-samples-2014-2025.json` preserve the 222 and 167 accepted sample recoveries respectively, including fieldwork, primary URL and quote. The complete audit covered current findings catalogues, archived release sequence IDs, all annual releases and the reprinted complete-table families. Null n remains where there is no usable exact release, the sample is pooled across fieldwork, fieldwork conflicts, or primary n figures contradict one another. Pooling a printed total, treating “Australians” as electors, or copying the newest annual wave's n to the whole table is not permitted.

Repeated current and archived tables, release enumeration and original full-data PDFs support no intermediate publication where these gaps remain: May 2016–February 2018 (apart from the recovered 2018 release), after the early-April 2018 wave to August 2018, September 2018–January 2019, July 2019–February 2020, September 2020, December 2020–January 2021 and April–May 2021. The 2021–22 gap was a parser defect, not a publication gap, and is now filled. The January 2009 gap is also in the independently reprinted complete 2009 table.

## Other house records and negative coverage

- `other-houses-direction.json`: Essential's four exact early-2022 waves including effective samples; nine Freshwater waves; exact fieldwork and n for all 20 older SEC Newgate waves. Essential's 2016–2021 full PDF corpus contained no earlier national direction row: 206 reports from 2016–20 and 23 from 2021 were checked. Freshwater joins the canonical `Freshwater` name, not a second house. SEC Newgate's series explicitly starts with wave 1. The three 2023 Freshwater rows with no printed unsure share are marked `unsureDerived` rather than presented as a printed third response.
- `mckinnon-direction.json`: the exact wording, neutral and don't-know categories, samples and fieldwork for 2025 and 2026 (n=4,416 and 4,273). It is a separately drawn satisfaction-with-heading series, not a right/wrong estimator input, with a chart wording note.
- Spectre Strategy is a new 2025 firm; its complete numbered report/blog corpus and historical trend report begin national direction at 24–28 April 2025, already in the live series. No predecessor has been established: Freshwater is the founder's former employer, not Spectre's inherited series.
- RedBridge/Accent's primary trend explicitly starts in February 2024; SEC Newgate starts in March 2022. JWS/True Issues organisation- and issue-level direction questions are deliberately excluded because they are not national direction.
- Unsure shares are not silently renormalised when published rounded triples sum to 99, 100 or 101 within the established tolerance.

Ipsos's What Worries the World corpus, Australia series, publisher global average and country distributions have their own producer and validation documentation beside `.build/ipsos-direction-src/`.
