# Federal map: 1993–2001 and the 2010 vintage correction

The public frames use the Parliamentary Handbook's historical polygons,
extracted by Tim Sherratt, at repository revision
`fb76072cfa5edb6fa52e557694efdc85954ace31`:
https://github.com/wragge/historical-federal-electorate-boundaries.
The original source is the Handbook API, collected in August 2026.

## Boundaries and reuse

The CSV dates are years. Each election is strictly inside the selected
record's interval: 13 March 1993 (147 divisions), 2 March 1996 (148), and
3 October 1998 (148). All names and states match the certified AEC results.
VIC/QLD/ACT change from 1993 to 1996; WA/QLD/ACT change from 1996 to 1998.
The original spatial audit and input hashes are in
`handbook-boundaries-audit.json`. Its ABS comparison is an initial research
snapshot, not the current public dataset. The supposedly 1996 ABS frame
had later WA geometry: Collie was outside Brand. The Handbook frame corrects
that defect. No ABS/Handbook hybrid is published.

The site owner confirmed that AusPolTracker is solely non-commercial.
The publication basis is the Parliament's CC BY-NC-ND 4.0 terms and the
licence's technical-format permission, section 2(a)(4):

- https://www.aph.gov.au/Help/Disclaimer_Privacy_Copyright
- https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.en

The conversion preserves every polygon coordinate (including Z), ring,
hole and island from each selected original. It does **not** run mapshaper's
simplification, snapping, cleaning, quantization, clipping or gap-filling
recipe. Original optional label points are not boundary polygons. The
GeoJSON-to-TopoJSON round trip is checked exactly; each decoded polygon
has its own SHA-256 in the public source manifest. The files themselves and
the visible methods section carry attribution and the licence link.
These assets retain their source licence; the conversion does not relicense
them. The project must revisit this basis before commercial reuse or
publishing modified polygons. No permission enquiry has been sent.

Display projection, ring winding and linear-segment resampling occur in
memory in the browser. Off-mainland parts are outside the main viewport.
The existing island-inset coastlines remain a separate schematic layer;
their 1993–98 seat association comes from the AEC's named polling-place
returns (Sydney for Lord Howe; Northern Territory for Christmas and Cocos).
Norfolk has no division attribution in those frames.

This is a faithful historical digitisation, not a survey-grade boundary
product. Small source overlaps/gaps and a 1993 Dickson self-intersection
remain unmodified and are disclosed. The initial audit measured them with
densification before projection, avoiding false gaps caused by projecting
long undensified latitude segments. See its report for quantities.

## Results and missing information

`build_stats_history.py` reads the committed AEC statistics tables directly.
HCANDS and DIVS supply certified candidates, winners and division totals.
DOP supplies recorded final counts and transfers. Every source first-
preference cell is checked against the independently packed FPV lane.

1993's DOP first preferences differ from HCANDS by at most 17 votes in
75 candidate rows across 23 divisions. The exact discrepancy list is
hash-pinned. Preserve the printed booth figures and certified division
figures separately; do not invent a balancing booth or transfer. Flows
are withheld in affected divisions. The 1993 informal table also has
17 division discrepancies, including missing ordinary-place rows for
Mallee, North Sydney and Wills. Unavailable cells stay null. Its DOP has
no booth-level distribution beyond first preferences, so booth TCP/TPP
and flows stay unavailable.

1998's first preferences reconcile exactly. Its TPP table omits Newcastle;
the map shows the actual Labor–independent final pair and no invented
Labor–Coalition result. Reid's printed booth informal total is 5,465,
against the certified division's 5,468; both are preserved.

The newly extracted files are verbatim members of the already downloaded
AEC archive:
https://www.aec.gov.au/About_AEC/Publications/statistics/files/aec-1993-1996-1998-election-statistics.zip

- `htpp-1993.txt`: `data/import/tables93/HTPPBYPP.TXT`, SHA-256
  `563f4e0673f83bf9e05e97511b6fa1aef18ab21c17cf087a79d0c63b0efed695`.
- `party-codes-1993-1998.txt`: `data/geninfo/tables98/text/CODE.TXT`.
  The AEC's codes distinguish the local Greens parties from similarly
  abbreviated unrelated groups. The full party names are kept on cards.

`historical_booth_locations.py` assigns approximate locations to the three
frames from committed AEC venue records for 2007–2025. The 2004 store's
coordinates were themselves inherited from 2007, so it is not presented
as an earlier coordinate source. Every match retains its source year,
division, booth ID, booth name, venue and original coordinates in
`data/booth-locations-history.json`; source files and boundaries are hashed.

Names are state-scoped, normalized for punctuation/spacing and Mt/Mount,
and stripped of their own division suffix. Exact names win over a restricted
school/hall/church suffix expansion. Every candidate must be inside that
election's original polygon, including its holes. All candidates from the
earliest matching year must agree within 100 metres; no duplicate is silently
discarded. Unresolved names, administrative city returns, special hospital
records and mobile teams remain unlocated. There is no centroid fallback.

This supersedes the 1996 map's previous matching and locality-centroid
estimates. That older builder's pool retained only one same-name candidate
per year, and checked against the superseded ABS geometry. Its legacy
`booth-seifa-1996.json` store remains an upstream input, but the map builder
overrides its coordinates using the new identity-checked location store.
All three years expose the source year and later venue on each matched
place's card. These are approximate locations, not evidence that the same
premises was used in the historical election. Vote counts are unchanged.
Where informal counts are missing, marker size uses the recorded formal
votes while the total count remains unavailable. Census/SEIFA information
remains unavailable. Reused 1993 hospital-team names remain aggregated
under their printed names.

The committed run locates 6,540 of 8,431 records in 1993, 6,757 of 8,463
in 1996, and 6,861 of 8,311 in 1998. Those denominators include mobile and
hospital teams and administrative returns. Each year's full rejection
counts and every unresolved name are retained in the matching store.

Senate votes sum ticket and candidate votes, checked against every separate
ZZ formal/informal/total record. The House-to-Senate place join is exact by
name; Senate hospital/mobile aggregates are not spread across individual
House teams. Matched counts are 7,885 in 1993 and 7,775 in 1998.
Senate membership uses the Handbook's dated service records and is checked
against its independent parliamentary totals. The 1 July 1999 snapshot
has one QLD vacancy, filled on 2 July. Kay Denman's 1998 elected term runs
to 2005 despite the source starting it on 30 June instead of 1 July.

## Rebuild and verification

Use the existing map builder dependencies (`d3`, `topojson-client`,
`polylabel`) plus Python's standard library. The separate spatial audit
also needs Shapely and pyproj, and the original ABS GeoPackage.

```sh
# Shared result calculations; preserve existing label anchors when copying
# rebuilt data-*.json into res-*.json for later frames.
python3 .build/map/build_map_data.py /tmp/map-results
python3 .build/map/build_stats_history.py
python3 .build/map/senate_past.py
node .build/map/handbook_geo.mjs --fetch
# --fetch downloads missing pinned originals; cached runs are offline.
python3 .build/map/historical_booth_locations.py
# Re-derives and applies matches; the result builders also consume the
# committed location store on subsequent rebuilds.
node .build/map/assemble.mjs
node .build/test-map-history.mjs
node .build/test-map-geo.mjs
node .build/test-map-senate.mjs
node .build/test-map-page.mjs
node .build/newtracker/validate.mjs
```

Only `res-*.json` is published; `data-1993.json` and `data-1998.json` are
intermediate build files. Stage new public assets before assembling so
their content hashes enter the page's cache-busting manifest.
`probe-history.mjs` exercises 1280px and 390px browser layouts, every lens,
seat/booth selection and both chambers against a locally served checkout.
The quantized-map island-floor tests apply to 2004 onward; the new
historical test verifies exact source coordinates instead.

## 2001 and 2010 corrections (31 October 2026)

The former 2010 build reused `national-esri-16122011.zip`, which the AEC
labels for **2013**. VIC’s 24 December 2010 and SA’s 16 December 2011
determinations postdate the 21 August 2010 election. The corrected build
uses the separate official `national-esri-2010.zip`, downloaded from:
https://www.aec.gov.au/Electorates/gis/files/national-esri-2010.zip
SHA-256: `eecefadcfe7d2eab56af53768918573b8ef691f68f7bfc9bd8b10eae0c834c52`.
The AEC index explicitly associates the two archives with different elections:
https://www.aec.gov.au/Electorates/gis/gis_datadownload.htm
The source’s area attributes are McEwen 10,669.8664 km², Casey 409.21325 km²
and Kingston 377.26663 km²; the old frame instead drew their 2013 shapes.
`make-boundary-src.mjs` now keeps the 2010 and 2013 recipes separate,
including when 2016’s dependency is built on its own.

The 2001 frame now uses original Handbook geometry, under the same licence
and lossless conversion as 1993–98. `audit-handbook-2001.py` and
`handbook-2001-audit.json` record the exact 150-seat selection (10 November
2001 strictly inside every source interval), file hashes, validity, topology
and comparison against the former published ABS ASGC 2001 frame.
Queensland’s 27 map IDs are identical to the 1998 selection.

The audit confirms the ABS statistical layer’s material shared-boundary
displacements: roughly 9,000 km² between Kennedy and Leichhardt, 5,400 km²
between Grey and Wakefield, and 1,500 km² between Lyons and Franklin.
Coastline digitisation also differs, so pair unions do not agree exactly.
The Handbook follows the expected historical areas much more closely.
Independent AEC 2001 profiles give Kennedy 562,160 km², Leichhardt 150,236,
Grey 897,822, Lyons 40,604 and Franklin 7,933:
https://www.aec.gov.au/Elections/federal_elections/2001/profiles/kennedy.htm
https://www.aec.gov.au/Elections/federal_elections/2001/profiles/leichhardt.htm
https://www.aec.gov.au/Elections/federal_elections/2001/Profiles/Grey.htm
https://www.aec.gov.au/Elections/federal_elections/2001/profiles/lyons.htm
https://www.aec.gov.au/Elections/federal_elections/2001/profiles/franklin.htm

The Handbook is still a historical digitisation: 2001 has small interstate
overlap strips (about 103 km² pairwise nationally), enclosed holes that may
include water, and a Braddon self-intersection. These are diagnosed, not
repaired in the published source. Census figures and election results retain
their original data sources; only geometry, source notes and label anchors
change. `test-map-boundary-vintages.mjs` pins original coordinate hashes,
state counts, remote shared-boundary probe points and 2010 election-day areas.

Targeted rebuild:
```sh
# Audit needs Shapely and pyproj; build uses the normal map dependencies.
python .build/map/audit-handbook-2001.py --fetch
node .build/map/handbook_geo.mjs --years=2001 --fetch
# Put the official 2010 ZIP under STAGE/dl/ and an unchanged copy of
# map/data/res-2010.json at STAGE/data-2010.json.
node .build/map/make-boundary-src.mjs STAGE --years=2010
node .build/map/geo_build.mjs STAGE STAGE map/data --years=2010
node .build/map/assemble.mjs
node .build/test-map-boundary-vintages.mjs
```
