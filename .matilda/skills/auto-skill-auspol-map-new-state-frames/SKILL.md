---
name: auspol-map-new-state-frames
description: when a new state-jurisdiction's elections need adding to /map/ as timeline frames (worked 2026-11-05 on Western Australia — wa17/wa21/wa25 landed end-to-end). The split of who serves what data (EIS results API first-party vs ABS SED boundary editions vs venue registers vs Tally Room), the full builder chain in .build/map, every app-wiring home in the map bundle, and the assemble→pin-refresh cycle's two bootstraps that will bite you.
source: auto-skill
extracted_at: '2026-11-05T10:40:01.485Z'
---

# /map/ — landing a new state-election frame family (the WA precedent, 2026-11-05)

Read before adding frames for any jurisdiction. The WA land was wa17/wa21/wa25, Assembly-only, with no LC, no flows rows and no Now overlay.

## 1. The source ladder — verify each rung before writing a line of parser

Do this in the order shown; each step gates the next.

### 1a. Results: WAEC's EIS results API is first-party and deep

`https://eis.waec.wa.gov.au/api/sgElections` (the catalogue), and per election:

```
GET /api/sgElections/sg<yyyy>                     # root: variables, electorates roster
                                                  #   (name/code/Lat/Long/Zoom per district),
                                                  #   LACountProgress count card (enrolled/votes)
GET /api/sgElections/sg<yyyy>/LACandidateParty    # roster: FULL party names + "SURNAME, Given"
GET /api/sgElections/sg<yyyy>/<CODE>/results      # district: resultsCandidates,
                                                  #   resultsPollingPlace (booth rows),
                                                  #   results2CP (2 rows), resultsFullDistribution,
                                                  #   toptotals (NUMBER_ELECTORS, FORMAL/INFORMAL_…)
```

**Results exist for every state election 1996→2025** (sg1996..sg2025 all verified, per-booth rows). sg1993 exists but empty.

The repo already mirrors this **per-district payload** into `.build/state-flow-src/wa/sg<yyyy>/<CODE>.json` via `.build/harvest-wa-state-flows.py` (the state preference-flow machinery's mirror) — **do not re-harvest results**; verify the mirror's 59-file completeness and shape and reference it (harvest-wa-src.py's case 1).
Machine-local extras that mirror CANNOT provide (root + LACandidateParty) go under `.build/map/src/wa/` as `<sg-yyyy>-root.json` / `-candidates.json`, committed by your own harvest script.

EIS payload quirks (all bitten in-session):

- Responses carry the **UTF-8 BOM** — `json.load(open(f, encoding="utf-8-sig"))` only.
- Booth-column headings **strip apostrophes anywhere** in the name: candidate `"O'MALLEY"` heads `"OMALLEY - ALP"`; `"'t HART"` heads `"t HART - ACP"`. Join rule: `col = sur.replace("'","")`.
- **Independents' columns are the bare surname** (no `" - CODE"` suffix).
- Pseudo (never a dot) = `BREAKDOWN_GROUP == "Count Centre"` rows PLUS
  `"Special Institutions,  Hospitals & Remotes"` (2017/2021 era, mind the double
  space) PLUS 2025's plain `"Mobile Polling"` row. Real rows are BREAKDOWN_GROUP
  `"Polling Places"`. Row-level identity assert: `Σcand_cols == Total - Informal` per row.
- Per-district sums identity (assert it): `lane formal (real rows) + pseudo formal == Σcandidates.v == toptotals.FORMAL_…`.
- Oracle formal counts come from `toptotals.FORMAL_LAST_PUBLISHED_NUMBER_ENTERED` and INFORMAL_ — **beware substring traps** when scanning keys (`"formal" in k` matches `"INFORMAL"` too; that bug cost a rebuild here).
- Seat tallies oracle: per-election winner = district 2CP top vote; parties registries per year use SHORT codes that change era to era (`NAT` (2017/2021), `NATS` (2025), `Libertarian` spelled out in 2025); map them through the ab→fam `bucket()` table (lib/nat→lnp per the app's closed FAM set `{alp,lnp,grn,onp,ind,oth}`; we write `ab: "NAT"|"NATS"` and they all land FAM lnp). Long display name comes from the roster's `PARTY_AFFILIATION`, majority-vote assigned as the code's pn.

### 1b. Boundaries: ABS ArcGIS SED, edition-matched to the gazettal

The Landgate "bulk download" endpoints (data-downloads.slip.wa.gov.au) sit behind SSO; the **anonymous** route is the **ABS**, not Landgate:

`https://geo.abs.gov.au/arcgis/rest/services/ASGS<YYYY>/SED/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson`

Folders per edition exist: `ASGS2016..ASGS2026`. The WA district set inside is the gazettal snapshot as at the edition's reference date:

| frame | redistribution gazettal | source |
|---|---|---|
| wa17 | 2015 (Nov 2015) | `ASGS2017` SED |
| wa21 | 2019 (Nov 2019) | `ASGS2021` SED |
| wa25 | 2023 (Dec 2023) | `ASGS2025` SED |

**Roster-gate always**: filter SED features by state code prefix `5` **and** membership in the EIS election roster — ABS editions carry extra `5`-prefixed rows (LC-region leftovers like "MID WEST" that are NOT election districts; the 2021 election had no such district; adjudicate names against the EIS roster, never the GIS row list — a session trap). Normalise the SED `"<Name> (<Region>)"` form to the EIS bare ALL-CAPS name, then the geo_build's letters-only `key()` join takes over.

**wa redistributes EVERY four years** – never assume two election frames share polygons (the qld 93-seat luxury doesn't exist here). Each frame needs its own `n-wa<yy>.geojson` (machine-local, never committed) and its own SA1→district assignment (wa21 and wa25 share the census vintage but NOT the boundaries).

### 1c. Venue coordinates

- **2017**: the official WAEC XLSX on data.wa.gov.au (package `2017-wa-state-government-election-polling-places`, coordinates included; CKAN resources are immutable-GUID URLs — don't truncate the filename).
- **2021/2025**: The Tally Room's dataset zips (`WA-YYYY-Pollingplaces.xlsx`, geolocated) on his Google Drive folders — folder ids ride his `/data` page and (older ones) Wayback snapshots of it. Folder fetch pattern: GET `https://drive.google.com/drive/folders/<id>` and parse `aria-label="<file>" … ssk='5:<x>:<fileid>'` per row (suffix `-0-16` tags are stripped). **Intermittent sign-in walls per folder** — 2025 fetched clean, 2021/2017 walled the whole session (wa21 shipped with an 88%-located lane from the union of the 17+25 registers; unlocated booths draw no dot, the app contract).

### 1d. Per-venue 2CP (one era has it)

`WA-2025-LA-2CP-PollingPlace.xlsx` (Tally Room import of WAEC's product). Verified to 650 of the frame's 743 booths after two guards:

- **Six districts are zero-filled** (Bassendean/Bibra Lake/Central Wheatbelt/Kimberley/Pilbara/Thornlie — the "re-paired after recount" seats whose 2CP WAEC never published; TR's own note covers it). Their booth tcp stays null; district-level EIS 2CP still covers them.
- **Label swaps happen** (Balcatta: the 2CP product swaps the two school names' totals vs the official FP). Parity-check per venue on join: `|TR 2CP sum − EIS FP formal| ≤ max(10, formal//200)`. Inside tolerance → use it; outside → **drop that venue's 2CP** (honest null), log it. Never ffail and never silently accept.

### 1e. Census/SEIFA caches

Everything rides existing caches: GCP SA1 packs + SA1 polygons at `.build/analysis/seat-model/cache/` (2021) and `.matilda/seifa-irsad-abs/` (2016 + all SEIFA cubes). Pods for WA are **prefix "5"**; sentinels pinned after first computation: **2021: {59797979991, …92, …93, 59999949999}; 2016: {5949999, 5979991, 5979992, 5979993}**; sentinel persons **8572 (2021) / 6385 (2016)**; cube WA rows **6064 (2021, of 59421) / 5700 (2016, of 55140)**; SA1 counts **6352 (2021) / 5984 (2016)**. One template trap: the 2021 zip's member names are `…_{table}_AUST_SA1.csv` while the 2016 template is `…_{table}_AUS_SA1.csv` (no T) — a silent `_member` template transcription error fails loud only at zip open.

## 2. The builder chain (all in `.build/map/`)

1. `harvest-wa-src.py` — results-mirror **check**(never refetch), geo export via the roster gate (writes the machine-local `n-wa<yy>.geojson`), `--fetch` fills the venue registers (wa-warns on the walled 2021 one), and `sg<yyyy>-{root,candidates}.json` extras. Run with `--fetch`; re-run is idempotent.
2. `wa_geo.py` (qld_geo's protocol) + `build_wa{17,21,25}_demo.py` — SA1→district joins committed per frame at `.build/map/wa<yy>/assign-sa1.json` (each frame its own join!), demo stores in `data/wa<yy>-demo.json`.
3. `build_wa{17,21,25}_seifa.py` — `data/wa<yy>-seifa.json`.
4. `wa_eis.py` + `build_wa_common.py` + `build_wa{17,21,25}_data.py` → `map/data/data-wa<yy>.json` with **per-frame oracle constants** (seats/formal/informal/enrolled) asserted fail-loud.
5. `build_wa{17,21,25}_past.py` (`build_wa_past_common.py`) — RENAMES/NEW/ABOLISHED tables adjudicated at `.build/map/src/wa/past-adjudication.md`. Remaps confirmed this land: wa17←wa13 {Alfred Cove→Bicton, Ocean Reef→Burns Beach} (new Baldivis/Roe/Thornlie; abolished Eyre/Gosnells/Wagin); wa21 {Girrawheen→Landsdale}; wa25 {Warnbro→Secret Harbour} (new Bibra Lake/Oakford/Mindarie/Girrawheen/Mid-West; abolished Burns Beach/Mirrabooka/Moore/North West Central/Willagee). Adjudicate by **polygon-centroid back-and-forth** between successive SED editions — clean single-hit maps both ways are renames; split merges are abolished+new. Antony Green's Parliamentary Library notional-margin PDFs (parliament.wa.gov.au) sit behind an Azure WAF JS challenge — don't plan on them.
6. `MAPSHAPER="$PWD/node_modules/.bin/mapshaper" node .build/map/geo_build.mjs .build/map/src/wa map/data map/data --years=wa17,wa21,wa25`.
7. `node .build/map/assemble.mjs` (writes core-<frame>.json + stamps) — see §4's bootstrap gotchas.

## 3. App wiring homes (the exhaustive edit list for a new state)

`/.build/map/app/app-1-base.js`: `YEARS` (slot by election date), `YEAR_JUR`, `WA_YEARS`+`YEARS_WA` sets, `YEAR_X`, `FRAME_YEAR`, `STATE_PREV_X.wa` + `WA_PREV_X`, `PREV_YEAR`, `Y2_ST_CAP`, `yearLane` cascade, `LANES`, `GOV`, `PREV_GOV_BY_JUR`, `PM`, `SPEAKER_DIV`.
`app-3b-senate.js`: **exclude the new state from `SEN_YEARS`** unless you actually ship an upper-house lane (WA's 2025 Council is a single 37-member statewide electorate with no machinery analogue — excluded deliberately).
`app-4-story.js`: title fork, commission short form fork (WA→"WAEC"), coalW/oppNameW/possW word forks (**WA: "Liberals"/"Liberal" idiom, never "Coalition"/"LNP" — WA has no state-level Coalition; the Nats ride the lnp fam like Vic's**), Legislative-Assembly chamber noun branch.
`app-6-ui.js`: `stateAdj` adjective arm, the timeline `rows[]` rung + `pitch` divisor count, `rowIx` (wa→5), `rowsOf[]` label layers entry, and the building's aria-label list.
`app-7-full.js`: `FS_LANES` + `FS_LANE_ABBR`.

Counters: SG-date position in YEAR_X is `year + dayOfYear/365`. Premiers risk rotation: speaker seats (wa17 Albany·Watson, wa21 Midland·Roberts, wa25 Forrestfield·Price — Stephen Price elected Speaker 8 Apr 2025). Government history for PREV forks: WA 2008=alp (lost→lnp), 2013=lnp, 2017=alp, 2021=alp.

## 4. Two bootstraps that WILL bite you

1. **`data-stamp.mjs` stamps only git-TTRACKED files.** `git add` the new `map/data/data-wa*`, `res-wa*`, `geo-wa*-{lo,hi}` **BEFORE** first assemble; assemble then writes `core-wa*.json`, which you must **git add and re-assemble** — otherwise map.js ships data stamps missing the core files and `test-map-page` dies on `core-wa… is committed beside res-wa…` (also see the map-data-commit-order skill).
2. **test-map-page.mjs carries literal pins of every wiring table** (YEAR_JUR etc. — they'll fail wholesale, by design). Refresh the pins *with* the app edits in the same land (six-runths: LANES rows, rowIx, the aria-label list, `&& !WA_YEARS.has(y)` SEN_YEARS presence assert), and expect the full-screen stateAdj arm pin (`QLD_YEARS.has(y) ? "Queensland" : "South Australian"`) to break when you insert a new arm — loosen those literal ordered forks to presence checks, keep the semantics.

Full map-cluster checks to green: `.build/test-map-page.mjs`, `test-map-history.mjs`, `test-map-geo.mjs`, `test-map-geo-build.mjs`, `test-map-boundary-vintages.mjs`, `test-map-senate.mjs`.

## 5. Headless frame probes (`puppeteer-core`, clone map-new-state-frames.mjs)

Probe rope taken from the in-session proof (now `.matilda/probe/map-wa-frames.mjs`, gitignored as scratch):

- `G.setYear(t)` is async — give `G.S.year` a beat (`await new Promise(r=>setTimeout(r,50))`) before reading it (first-run race reads like "the frames don't exist"; they do).
- Model field names differ from file rows: read `m.res.prev` (not `m.prev`), candidate swings are `cand.sw` on **deriveDiv model objects** (`c[5]` index semantics belong to files, not models).
- `m.demoYear` is **null for the 2021 vintage** (the qld24 convention — the res file carries no demoYear key for it; explicit only on the 2016 frame). Null is a pass there, never 2021.
- The Azure-WAF-walled parliament.wa.gov.au PDFs aren't fetchable; adjudicate redistributions from geometry, and verify seat-level facts (speakers, gov tables) by web search rather than memory (two candidate-name guesses missed in-session and were caught only because the probe pinned rename-winters).

## 6. Failure triage note (repo-wide runs)

`npm test`'s chained suite aborts at its first failing module — separate its modules' pre-existence from your land's blast radius by running the failing module on a pristine worktree of HEAD (`git worktree add /tmp/headcheck HEAD && cd /tmp/headcheck && node <that test>`). Wa land coincided with an `test-essential-oneoffs-adjudicate` guard failure pre-dating the land on HEAD; the suite's ~40 test groups *after* it ran green when chained manually (`tr '&' '\n' | awk` the test script). Don't inherit someone else's failure in your land unless it actually is yours.
