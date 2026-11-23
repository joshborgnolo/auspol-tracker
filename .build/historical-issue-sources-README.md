# Historical issue-data stores

Separate source archives, not inputs to the live Now-page aggregates:

| Store | Producer and test | Actual published coverage / boundary |
|---|---|---|
| `data/aes-issues.json` | `extract-aes-issues.mjs` | 18 AES issue series, 1990–2025: 188 dated national rows, 584 numeric cells. Preferred-party policy stays separate from party-most-capable wording elsewhere. |
| `data/anupoll-issues.json` | `extract-anupoll-issues.mjs` | 19 ANUpoll wave records through 2015; first choice in 18 (409 rows), separately identified second choice in 13 (384 rows). One Food Security wave has no verifiable public problem table; respondent files stay restricted. |
| `data/scanlon-issues.json` | `extract-scanlon-issues.mjs` | 19 annual/split Scanlon waves covering 2011–2026, 325 source-read category rows. Telephone, Life in Australia, hybrid and ORU frames stay distinct. Full distributions through 2021; verifiable selected categories thereafter. |
| `data/roymorgan-issues.json` | `extract-roymorgan-issues.mjs` | Ten complete HTML tables: Australia/world problems, states, demographics and vote splits, plus separate June 2022/September 2024 pick-three waves. Longer 2005–2021 history is not manufactured from PNG charts. |
| `data/gallup-issues.json` | `extract-gallup-issues.mjs` | **Metadata only at present:** 223 archive records inventoried, but no codebook-verified waves. ADA bot/authorisation blocks the codebooks required for coded distributions. This file is not a completed numerical series. |
| `data/jws-issues.json` | `extract-jws-issues.mjs` | 17 surviving core waves, 27–43 (March 2022–November 2026), with five question families each. Older missing PDFs and live 404s remain explicit source gaps. |
| `data/freshwater-issues.json` | `extract-freshwater-issues.mjs` | Freshwater/AFR importance and management through January 2025, including accurate-mode, independently corroborated OCR for December 2022's 57 image cells. Net-lead supplements stay separate from three-response management. |
| `data/vote-compass-issues.json` | `extract-vote-compass-issues.mjs` | 932 published observations, 2013–2025; elected-wave subgroup coverage varies and nonprobability/self-selection sampling is retained. Preliminary 2013 aggregate chart, not a final coded matrix. |
| `data/lowy-issues.json` | `extract-lowy-issues.mjs` | Four waves, 2013/2016/2019/2025: 14 issue labels, 50 split positions, seven response options; 1,496 populated category rows and 700 preserved blank cells. No row-order or availability assumptions. |

Run a single source's tests with `node .build/test-<source>-issues.mjs`.
The `package.json` test chain runs all nine. Generation defaults to cached
inputs so these checks do not network.

## Non-negotiable contracts

- Different questions and response bases are never merged into one national
  issue roll or ownership series. First/second/open nominations, prompted
  limited choices, salience and party-capability are distinct measures.
- Source labels and a concrete response vocabulary are preserved instead of
  silently mapped to the live Snapshots' shared issue keys. Group labels are
  positions, not implicit identities where known states or axes repeat.
- Missing cells remain explicitly missing. Actual zero, blank `""`, null and
  an unoffered option are distinct; no forward filling, sum-derived middles,
  percentage renormalisation or charts-to-monthly interpolation.
- Each store links primary source metadata and has deterministic regeneration
  and fixture tests. A restriction, source 404, missing wave or incomplete
  table is documented rather than inferred away.
- Aggregate-only output follows existing project convention: no respondent
  microdata or restricted deposited records are committed.
- Automated source fetches are only explicit refresh operations. Tests and
  `--check` read their local caches.

### Provenance caveats that must not be edited away

- AES uses only official aggregate chart data, with 2025's last revision
  distinct from the superseded 2022 comparison artifact.
- Gallup cannot become a numeric time series from DataCite's abstracts alone.
  `source.nativeAccess` documents the bot-check failure; aggregates may be
  produced later only by a deposited, question-and-response-verified codebook.
- ANUpoll's restricted cumulative deposit doesn't manufacture variable names
  or raw weights: its numbers come from public ANU aggregate reports instead.
  Scanlon’s 2020 July and November waves and later sample-mode changes are not
  treated as one respondent-level sample.
- Freshwater requires the included coordinate-specific
  `.build/freshwater-issues-src/2022-12-ocr-proof.json`. Two accurate-mode
  OCR reads must agree on both a printed cell's label and value. If one
  witness drops a cell, import fails closed—there is no prose/model fallback.
- Roy Morgan's structured HTML table coverage is imported; long historical
  PNG-only long runs are retained as source/limit metadata, not transcription.
- AES and Lowy supply published aggregate samples/trends without implying
  independent margin-of-error calculations. Vote Compass explicitly cannot
  claim probability-sample confidence intervals from its volunteered n.
