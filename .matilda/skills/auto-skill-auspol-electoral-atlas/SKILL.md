---
name: auspol-electoral-atlas
description: auspol-tracker — the /atlas/ Electoral Atlas satellite page end-to-end (shipped 2026-09-05, branch atlas-feature; 2025 election results appended + "States & territories" card grid added same day as 7e54c25): data pipeline atlas/data/*.csv → .build/refresh-atlas-data.mjs → generated atlas/atlas-data.js (window.ATLAS_DATA, 160 divisions + 8 states + 117 non-classic rows); division STITCHING by short name (AEC file switches "Fenner (fmr Fraser)" ↔ bare "Fenner" mid-lineage; Fenner-ACT vs Fraser-VIC stay distinct); non-classic 2CP overlay keyed short|year; nodeFor keeps MAIN-LINE swing = 2PP row sw even in nc years (nc.swing is often NaN — don't substitute); margin line segmented into per-leading-side colour runs, per-segment positive shading with interpolated zero crossings; QA via .build/qa-atlas.js headless-Chrome CDP DOM probes over LOCAL HTTP (file:// makes /assets/ fonts 404 and read_file can't view PNG screenshots anyway); appending a new federal election = .build/update-atlas-<year>.mjs over AEC FinalResults CSVs (works for 2025, rerun pattern lives there) — appends MUST INSERT "\n" FIRST when the target CSV doesn't already end with one or the first new row fuses onto the old last row (the Adelaide bug).
source: auto-skill
extracted_at: '2026-09-05T12:15:21.588Z'
---

# auspol-tracker: the /atlas/ Electoral Atlas

## Layout

- `atlas/index.html` — hand-maintained satellite page (OUTSIDE .build/newtracker, like the
  /archives/ trio; see auto-skill-auspol-satellite-page-branding). Vanilla JS IIFE +
  hand-rolled SVG, no framework. Crimson Text 400/600 + IBM Plex Sans @font-face, oklch
  palette, `.tabs` strip (Atlas active; five archive links inactive), and since 2026-09-24 the site shell (masthead, main tabs, colophon: .build/site-shell.mjs) in place of the old `.ss-back` pill – the atlas stays UNLINKED from every other page, at the user's request.
- `atlas/atlas-data.js` — **GENERATED, do not hand-edit** (`window.ATLAS_DATA = {…}`,
  ~170 KB). Rebuild: `node .build/refresh-atlas-data.mjs`.
- `atlas/data/*.csv` — canonical AEC inputs, kept verbatim for provenance:
  `all_elections_2PP_by_division.csv` (2004–2025), `all_elections_2PP_by_state.csv`
  (1993–2025), `nonclassic_2CP_divisions.csv`.
- `atlas/data/aec-2025/` — verbatim FinalResults downloads (5 CSVs) the 2025 append was
  built from; `aec-<year>/` is the provenance-dir convention for future elections.
- `.build/update-atlas-2025.mjs` — the 2025 append script (idempotent; pattern for
  future elections — see "Appending a new federal election" below).
- `.build/refresh-atlas-data.mjs` — the generator (no deps; tiny CSV parser; `num()` maps
  non-finite → null, so the CSV's literal `NaN` strings become null).
- `.build/qa-atlas.js` — dev-only QA harness (see below).
- Sitemap entry lives in `.build/newtracker/build.mjs` next to the archive routes
  (ARCHIVE_STAMP lastmod) — sitemap.xml is build output, never hand-edit it.

## Data model

- Division row: `{id, name, short, former, state, series:[{y, party, co, al, sw, nc?}]}`.
- **STITCHING (the bug the R original had)**: the AEC names one lineage in two shapes —
  the full label `Fenner (fmr Fraser)` in early years, then bare `Fenner`. Key on
  `slug(nameInfo(raw).short)` with a same-year dedup guard; otherwise the series splinters
  into two half-length seats. Verified distinct stems must NOT merge: Fenner (ACT) ≠
  Fraser (VIC), Melbourne Ports ≠ Macnamara lineage is handled by the same keying.
- **Non-classic (2CP) rows** join by `short|year`; payload
  `nc:{mine, major, minePct, majorPct, margin, swing, winner}`. Every `mine`/`major`
  label has a PARTY_COLORS entry in the generator (Labor, Coalition, Greens, Independent,
  National, Liberal, Katter's, Palmer United, One Nation, Centre Alliance(fmr NXT));
  add a colour BEFORE adding a new party variant or the fallback grey leaks into legend.
- 150 of 160 divisions have a 2025 row (TABLE_YEAR = 2025); the 10 without are
  legitimately abolished seats (Hawke, Stirling, Higgins, North Sydney…), not data gaps.
  Bullwinkel is a genuine 1-year new seat.

## Appending a new federal election (2025 worked example)

1. Download the AEC FinalResults CSVs into `atlas/data/aec-<year>/` verbatim. For 2025
   (event 31496) they came from
   `https://results.aec.gov.au/31496/Website/Downloads/House*Download-31496.csv`
   (menu: `…/Website/HouseDownloadsMenu-31496-Csv.htm`) with TPP-by-division, TPP-by-state,
   TCP-by-candidate, NonClassicDivisions, MembersElected. The `fe25/remote-data/…` URLs
   are dead; for `aec.gov.au/<cycle>/files/downloads/…` links prepend `files/downloads/`
   and send a browser UA header (`curl -A "Mozilla/5.0 … AppleWebKit/537.36 …"`) or the
   CDN 403s.
2. Run/clone `.build/update-atlas-2025.mjs` (idempotent — aborts if the year is already
   present; appends division +150, state +8, nc rows sorted by Division). Its header
   comment documents the CSV conventions it replicates:
   - div/state CSVs: `Swing` column is COALITION-direction, `New_swing` is
     LABOR-direction (= the Tally Room's own `Swing`, measured vs post-redistribution
     notional margins). Division `Party` = TPP-count winner, not elected member.
   - nc CSV: `Margin` is AEC-perspective (minorPct−50 when the major is Coalition,
     majorPct−50 when Labor); `New_swing` finite ONLY when the exact minor+major pairing
     repeats from the previous election, else literal `NaN`.
3. **Trailing-newline trap**: historical CSVs may not end in `\n`. A bare
   `appendFileSync(rows.join("\n") + "\n")` then fuses the old last line with the first
   new (alphabetical = Adelaide) row; refresh-atlas parses the fused line away and the
   payload silently drops that division's new row (`tableRows` expected−1). The updater
   now inserts `"\n"` first when the file doesn't end with one. If a post-append row-count
   is one short, grep the CSV for the fused double-row line.
4. Refresh + QA per the verification sequence below.

## Renderer semantics (atlas/index.html)

- `nodeFor(yearRow)` — nc years: `val = nc.margin` (margin chart shows the challenger
  contest, †-marked), **but `swing` stays the row's 2PP `sw`**. Do NOT substitute
  `nc.swing`: the 2CP swing column is NaN for most nc rows (Warringah 2019/2022,
  Brisbane 2022), so substituting deletes main-line swing circles wholesale (QA caught
  7→4). The dashed overlay reads `nc.swing` separately.
- Margin-mode main line is segmented into contiguous same-colour runs
  (`run.prevIdx === j-1` continuity: Labor red / Coalition blue / challenger colour in nc
  years) — this replaces the R app's hardcoded Brisbane-2022 special case.
- Positive shading: per-segment polygons, zero crossings split by linear interpolation
  (`t = prev.v / (prev.v − v)`), segment colour at opacity .16.
- Y-range in swing mode must include `nc.swing` overlay values or dashed points clip.
- Labels: sign-based above/below with a collision-stagger loop (Δx<46 & Δy<15 → push 16,
  max 3); swing mode labels ONLY main-line endpoints (the overlay labels its own points).
- Legend is per-mode: margin → "Labor ahead"/"Coalition ahead" + one `(2CP)` key per
  distinct challenger; swing → "2PP swing to Labor" + dashed key per challenger. Never
  fabricate a key from the last node (state charts have no nc nodes — duplicate-key bug).
- Tooltip needs `.card { position:relative }` (page elements need a positioned ancestor);
  `#chart { touch-action:pan-y }` for mobile scroll.
- Sortable seat table: rows from divisions' TABLE_YEAR (2025) rows; holder prefers the nc
  winner; margins/swings prefer nc values with `isFinite` guards; margin sort defaults to
  descending on first click.
- **States & territories card grid** (`#states-grid`, between the chart note and the
  seats-table h2): `renderStateCards()` draws 8 `.state-card` buttons, each a sparkline
  (`.st-spark` svg 0 0 200 56) of the state's 2PP series from `ATLAS_DATA.states`
  on one SHARED symmetric domain (`ceil(maxAbs)+2` so cards cross-compare), dashed zero
  line, endpoint dot coloured by leading side. Click = `seatSel.value = "state:"+id;
  onSelect(); scrollTo(top)` — the grid is a launcher into the existing state view, no
  new chart mode.

## QA: .build/qa-atlas.js

Headless-Chrome CDP DOM-probe harness (raw CDP via `ws`; `npm install --no-save ws` from
`.build/` on a fresh checkout — repo has no package.json). **Serve the repo over local
HTTP first** (`python3 -m http.server 8931`, probe
`http://127.0.0.1:8931/atlas/index.html`): `file://` produces 3 spurious
ERR_FILE_NOT_FOUND errors (favicon + fonts sit at absolute `/assets/…` paths that only
resolve on a server — same pattern as the archives pages). The assistant cannot view
images, so probes assert STRUCTURE: option/row/circle/path/legend-key counts, titles,
nc-note visibility (`†` note unhidden on Brisbane), search/filter/sort interactions, and
`willsDashed ≥ 1` (Wills is the reference seat with ≥2 finite equal-challenger 2CP swings;
Warringah's nc swings are all NaN so its `swingDashed` is legitimately 0 — don't "fix").
Exits non-zero on any console/page error; green run: exit 0, `errors: []`. The state
grid is probed too: `stateCards === 8`, `stateSparks === 8` (one polyline per card), and
the interaction block clicks `.state-card[data-state=tas]` asserting
`cardClickSelect === 'state:tas'` (card→explorer wiring). Fail-zero state-card counts
usually mean `renderStateCards()` threw before renderTable — check console errors first.

Expected green values (2026-09-05, post-2025-append): seatOptions 168, optgroups 9,
tableRows 150 (TABLE_YEAR 2025), chips 150, stateCards 8, stateSparks 8, Warringah
svgPaths 3 (segmented margin line), legendKeys 4 margin / 3 Clark, sortedFirstMargin
after one `margin` sort-click = "+38.4" (Canberra), cardClickTitle "TAS · EP".

## Verification sequence after any renderer/data change

1. `node .build/refresh-atlas-data.mjs` (if CSVs or generator touched).
2. Serve repo root; `node .build/qa-atlas.js http://127.0.0.1:8931/atlas/index.html`.
3. `node .build/newtracker/validate.mjs` + `node .build/newtracker/build.mjs`; confirm the
   atlas `<url>` is still in the regenerated sitemap.xml.
4. Shared-repo rules apply (auto-skill-shared-repo-session-race): stage only owned paths.
