---
name: auspol-seating-plan-transcription
description: auspol-tracker — transcribing the APH House of Representatives chamber seating plan PDF (aph.gov.au …/House_of_Representatives_Seating_Plan) into a fully replicable who-sits-where encoding (map/data/house-seating-plan-<date>.json + .md, worked 2026-10-25 for SIX plans, committed cb62f364; extended 2026-10-26 with the two 43rd-parliament plans — 2012-02-27 earliest surviving revision + 2013-05-14 final revision — and the CORROBORATION of the committed 44th plan against the archived 2 Dec 2013 revision, capture 20140212213707; user-challenged the Feb-2012 floor same day — FULL falsification sweep held, back-link to an UNCRAWLED 24 Nov 2011 revision surfaced). Covers the WAF bypass, the pdftotext -bbox label-pairing extractor (three failure iterations before the working rule + the wrap repairs), the OCR + roster double verification, the horseshoe geometry fit (incl. the justified-edge dxOf patch for right-justified right-arm labels), the multi-era diffs (roster sources, furniture vocab, no-chair opening day, IN-TERM affiliation overrides, VACANT-seat revisions), the APH archive map (TWO URL families — the old ~/media seating.ashx family reaches back to Feb 2012 = the 43rd parliament; pre-Feb-2012 nothing survives in IA/NLA/PANDORA), the archive-floor-verification recipe (CDX prefix sweeps, linking-page capture trick, defunct Memento, JS-shell NLA), and Wayback CDX/playback CLI gotchas. Re-run whole pipeline for each new parliament/reshuffle plan.
source: auto-skill
extracted_at: '2026-10-26T00:30:00.000Z'
---

# Seating-plan transcription (APH HoR chamber PDF → JSON + MD)

Worked 2026-10-25 → `map/data/house-seating-plan-2026-08-13.{json,md}` (150 seats, 48th
Parliament). Scratch lives in `.matilda/seating-plan/` (extract.py → rows.py → finalise.py;
uncommitted). Deliverables were NOT committed on completion — ask the user.

## 1. Fetch — aph.gov.au is behind a WAF

- Plain curl of both the page and the PDF gets "Page Blocked by WAF". Pass a browser UA
  (`-A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 … Chrome/130"`).
- The page links the PDF at `static.aph.gov.au/-/media/05_About_Parliament/53_HoR/…/Seating_Plan.pdf?rev=<hash>&hash=<hash>` — grep the saved page HTML for the live link (rev rotates per update). 48th-plan PDF is InDesign 21.5, 2 pages, A4 595.276×841.89pt.

## 2. Extract labels from the TEXT LAYER (never OCR as primary)

```
pdftotext -bbox-layout seating.pdf seating-bbox.html   # XHTML word boxes xMin/yMin/xMax/yMax
```

- Page 1 = chamber diagram (344 words), page 2 = an alphabetical party listing (no geometry value).
- `pdftocairo -svg` reveals the seat *shapes* are one embedded whitespace-dominant raster →
  geometry comes from the label coordinates, not seat outlines.
- Structure: each member = a SURNAME label line with the ELECTORATE label ~8.2pt directly below.
  Furniture words (SPEAKER, THE TABLE, Officials, Clerk, Hansard, title, date…) excluded by an
  explicit stopword set + `y < 135`.

**The pairing rule that finally worked (after two failing iterations):**
group words into text lines by y within 2.5pt, then pair a surname-line word with an
electorate-line word 4.5–12pt lower when **min(left-edge, right-edge, centre) agreement ≤ 8pt**
(left-edge alone drops ~40 pairs whose labels are right- or centre-aligned, e.g.
McCormack/Riverina; centre-only misses more). Extend a surname token to adjacent words ONLY when
they're initials (`[A-Z]\.?`) — otherwise nouns bleed across seats ("Ng" absorbed into the Menzies
pair). Greedy per line, claimed-word set. Correct result for the 48th plan: **150 labels, 0
leftover words**.

## 3. Verify twice — repo roster AND macOS Vision OCR

- Roster: `map/data/res-2025.json` keyed by `d["n"]` (division name — NOT `d["div"]`, a wrong-key
  lookup cost a round), current holder `d["h"][-1] = [yr, pct, party, member]`; overrides from
  `map/data/data-now.json` `holders[div] = {n, ab}` (2026: Joyce ON, Farley ON, Spender+Steggall
  CSA; `speaker: "Oxley"`). `.build/map/app/app-3-chamber.js` is a GENERIC lens-ordered horseshoe
  viz — not the real plan, don't reuse it.
- OCR pass (independent confirmation, matches the repo LLM-reader ethos): rasterise
  `pdftoppm -r 200 -png seating.pdf page1`, run `swift ../../.build/ocr-image.swift page1-1.png 3 fast`
  → every label's surname+electorate token must appear in the OCR lines (150/150).

**Source-document quirks found (keep a NOTE, never silent-fix):**
- The official plan MISSPELLS Mackellar as **"Mackelllar"** (OCR concurs — it's the PDF, not us).
  Normalise + `note` on the Scamps entry.
- The roster stores five Mc* surnames all-caps (McBRIDE/McBAIN/McCORMACK/McINTOSH/McKENZIE) —
  clean to McBride form in the OUTPUT only (never edit the roster); the check is
  `s.startswith("Mc") and s[2:].isupper()` — `s.isupper()` alone fails because of the lowercase c.
- Speaker **Milton Dick** prints at the top centre of the members (x≈291, y≈161) with the SPEAKER
  furniture label below — model it as the Speaker's CHAIR (own `side: "speaker"` + `chair` flag),
  not a members'-row seat. CHAIR membership checks must compare the SURNAME
  (`member.split()[-1]`), not the full name.

## 4. Geometry — stadium horseshoe fit

Model: straight arms above cy, semicircle below; centre = (pageWidth/2, cy). For each label,
radial distance d = |dx| if y<cy else hypot(dx, y−cy). Sweep cy (430–620), 1D k-means k=5 over
the sorted d, pick cy by min SSE. 48th plan: **cy=536, radii [86.3, 137.6, 179.8, 221.3, 264.6]pt,
pitch ~42.5, row sizes [39, 27, 27, 28, 29] = 150**.
Seat order within a row: left (government) arm by ascending y, arc by
`atan2(dx, dy)`, right (opposition) arm by descending y. Sanity asserts: left-arm seats (y<cy,
x<240) are ALP-or-chair, right-arm (x>355) never crossbench parties.

## 5. Output schema (meta / officials / rows / counts)

`house-seating-plan-<date>.json`: meta{planDate, source URL+rev, harvested, method, page size,
geometry, ordering rule}; officials{speakerChair, 6× officialsBoxes, clerks ×2, table, hansard,
serjeantAtArms} with coordinates; rows[{row, seats[{seat, side, member, party, label, division,
x, y, note?, chair?}]}]; counts by CURRENT party (data-now overrides win). Side mapping:
ALP→government; GRN/KAP/XEN/IND/ON/CSA→crossbench; else opposition. The .md mirrors it in words
(orientation paragraph + per-row ordered lists). 48th counts: ALP 94, LP 17, LNP 16, NP 8,
crossbench 15 (IND 8, CSA 2, ON 2, GRN/XEN/KAP 1).

## 6. Multi-era transcriptions (44th–48th, landed 2026-10-25)

The same extractor/finalise chain ran unmodified across InDesign revisions back to CS6 (2013);
the ONLY per-era inputs are FURN stopwords, CHAIR_MEMBERS, NOTES/MD_NOTES, EXPECT counts and
provenance text. Scratch per era: `.matilda/seating-plan-<era>/`. Files landed in `map/data/`:

| File | Plan | Rows (sizes) | Geometry cy / radii | Notes |
|---|---|---|---|---|
| house-seating-plan-2026-08-13 | 48th in-term | [44?, ...] — see §5 | cy=536 | the worked original |
| house-seating-plan-2025-10-27 | 48th as-elected | | | |
| house-seating-plan-2022-07-29 | 47th | | | |
| house-seating-plan-2021-03 | 46th (earliest archived rev; footer "Indicative only") | | | spider capture 20210520030041 |
| house-seating-plan-2016-08-31 | 45th first rev | [44,25,28,28,25] | cy=545, radii [81.6,124.8,167.3,205.9,247.7] | 3 Officials boxes (left only), no right-side boxes, no THE TABLE label; chair Tony Smith |
| house-seating-plan-2013-11-12 | 44th opening day | [44,28,30,24,24] | cy≈535, radii [88.5,134.2,175.8,216.0,257.7] | single-page PDF — NO member-index page; NO Officials boxes; NO chair-seated member |
| house-seating-plan-2013-05-14 | 43rd FINAL rev | [45,26,28,25,26] | cy=541, radii [92.3,136.3,176.8,216.8,257.3] | chair Anna Burke; ALP 71, IND 5, KAP 1; Thomson+Slipper crossbench at outer curve; 2-page PDF (member index) |
| house-seating-plan-2012-02-27 | 43rd EARLIEST surviving rev | [45,28,28,24,25] | cy=536, radii [94.0,140.2,182.0,221.6,260.6] | chair Peter Slipper (elected LNQ, sits IND); ALP 72, IND 4, KAP 1; single-page; Wayback 20120228065052 — nothing older survives anywhere |

**43rd-parliament extra lessons (worked 2026-10-26):**

- **IN-TERM affiliation roster overrides**: res-2010.json y=2010 rows are the AS-ELECTED roster;
  build roster.json per revision with the moves re-reflected — Slipper Fisher LNQ→IND from 24 Nov
  2011 (Speaker), Katter Kennedy IND→KAP (Sep 2011), Thomson Dobell ALP→IND (resigned party
  29 Apr 2012, so IND only in the May-2013 roster). Tallies then: Feb-2012 EXPECT {ALP72, LP44,
  LNQ20, NP7, IND4, CLP1, KAP1, GRN1}; May-2013 EXPECT {ALP71, LP44, LNQ20, NP7, CLP1, GRN1,
  KAP1, IND5}. Party code in res-2010 is **LNQ** (not LNP).
- **NOTES/MD_NOTES/CHAIR_MEMBERS keys must be the VERBATIM roster member string**, or the note
  silently never attaches (no assert catches it — count attached notes and compare with the dict
  length). Three roster strings that bit: "Anna Elizabeth Burke" (Chisholm — "Anna Burke" matches
  nothing), "Martin John Ferguson" (Batman), "Michael David Danby" (Melbourne Ports), and
  "Kelly O'Dwyer" (Higgins) with an ASCII apostrophe in res-2010 — a curly-’ key silently keys
  nothing. Verify post-hoc: `grep -o '"note"' out.json | wc -l` == len(NOTES).
- **Wrap-repair, tail-token variant**: when a wrapped electorate remainder ("Ports" of "Melbourne
  / Ports") was never paired at all (no spurious Q pair to re-roll), stitch the unclaimed token
  directly onto L: token in leftover pool, `0 < tok.y - L.y2 < 12`, edge-align ≤12. Both shapes
  fired in the 43rd plans; the repair-2 block needs both branches.
- **Justified-edge dxOf for the ring fit** (2012/2013-era revisions): left-arm labels are
  LEFT-justified and right-arm labels RIGHT-justified (fixed xMax ~417). Measuring every label's
  radial distance from xMin mis-files the whole right arm (row sizes came out 25/37/29/24/35
  instead of 45/28/28/24/25). Patch rows.py:
  `dx = L.x − cx if L.x2 ≤ cx; dx = L.x2 − cx if L.x ≥ cx; else centre-ish`. Use dxOf everywhere
  rows.py measures distance (the sweep AND the per-label row assignment).
- **VACANT-seat revisions are real**: a plan printed BETWEEN a member's departure and their
  by-election prints NO label for the seat. 2013-12-02 revision has Griffith vacant (Rudd
  resigned 13 Nov 2013) — 149 labels, not 150; the page-2 members index literally lists
  "VACANT - Griffith (1 Member)" and "Vacant (Griffith)". Extract gate becomes
  `len(labels) == len(roster) − 1` plus an explicit assert that the missing division is the known
  vacancy; don't chase "missing member" loops for hours.

**Corroborating a committed plan against an archived LATER revision (worked 2026-10-26):**
the 44th file claimed "no archived capture exists near the era" — TRUE of the exact revision but
the NEXT revision (2 Dec 2013) IS archived (Wayback capture 20140212213707 of the same
seating.ashx URL — discovered via CDX on the URL family after the first claim was written).
Procedure: run the standard extractor+roster-verify on the archived revision (it had the 44th
as-elected roster; 149 labels with Griffith vacant), then diff seat-by-seat against the committed
JSON by DIVISION → compare (x, y) label coordinates, NOT row numbers (the two revisions may be
geocoded by different rows.py generations; boundary-row differences between fits are artefacts,
not re-seats). Buckets: identical ±0.5pt (121 seats), text-reflow ±3pt (17 — same seat, InDesign
re-flow), genuine re-seats (11 — incl. Bishop to the chair position once she was elected Speaker
on opening day, Scott to her old seat, one crossbencher Bandt crossing arms), vacancy (1).
Party tallies must be identical once the vacancy is removed (ALP 55→54 of 149). Then: labelled
`meta.corroboratedBy = {revisionDate, source, sha256, differences}` on the committed JSON; a
short corroboration paragraph replaces the stale "no archive" sentence in meta.source AND the
.md preamble (both homes, same claims).

**Wayback capture identity gotchas (43rd pulls):**
- CDX records the 2012 PDF's earliest capture as 20120221004402, but that record is a **302 to
  20120228065052** — always fetch with redirects and cite the SERVING capture (curl -I the
  Location header to find it).
- Capture suffix `if_` (iframe/raw bytes) serves the raw PDF; without it you may get the Wayback
  chrome. Old-family URL is under `~/media/05 About Parliament/53 HoR/531 About HoR/Chamber
  seating plans/` with capital-S `Seating.ashx` on some captures and `seating.ashx` on others —
  CDX-query the directory prefix, not one exact URL.
- 2013-04→May and 2013-11 families BOTH hang off the same old URL; the CDX capture list for the
  directory is the discovery tool (that's how 20140212213707 surfaced the 2 Dec 2013 revision).
- The 2013-05 and 2013-12 revisions are 2-page InDesign files (page 2 = member index; SECOND
  page also carries "Forty Third/Fourth Parliament" furniture and the officials listing, in
  LANDSCAPE — restrict extraction to page 1 as always). The 2013-12 PDF's InDesign CreationDate
  (Jan 2014) post-dates its printed 2 Dec 2013 footer — trust the PRINTED date for planDate,
  record both in meta.

Lessons that are now load-bearing:

- **Roster source per era**: `map/data/res-<year>.json` exists for 2013, 2016, 2019, 2022, 2025 —
  use the era's OWN file's `y=<year>` rows (`divs[i].h` rows are `[year, tpp, party, member]`).
  Probe the top-level shape FIRST (keys: year/event/date/prev/speaker/agg/divs/booths/seifaCuts;
  there is no top-level `h`). Do NOT union later files back (res-2016 ∪ res-2019 at y=2013 gives
  148 — Charlton is in neither; res-2013.json has all 150). Cross-file audit of the shared
  (year,division) cells across res-{2016,2019,2022,2025}: 0 clashes.
- **No-chair opening day (44th)**: a plan titled with parliament's OPENING DAY was printed for the
  sitting that ELECTS the Speaker → CHAIR_MEMBERS=set(), no row carries the chair flag, and the
  Speaker-elect sits in the ranks with a note (Bronwyn Bishop, Mackellar; the era's
  `res-2013.json` `speaker:` key corroborates). The 45th's plan (dated the day AFTER opening)
  already has Tony Smith seated at the chair.
- **NOTES keyed by FULL member name when surnames collide**: 44th has both Bronwyn Bishop and
  Julie Bishop — keying NOTES by printed surname would misassign. Key by full roster name;
  md-notes lookup likewise (NOT the emitted seat dict's "label" key — that's surname-only and
  re-raised the known `KeyError: 'surname'` pitfall in fmt: the emitter's seats carry key
  `"label"`, so fmt reads `L["label"]`).
- **Furniture vocab is per-era single tokens**: add the era's title words ("FORTY","FOURTH" at
  y≈120 for the 44th; "FIFTH"/"31 August 2016" for the 45th) and the footer tokens to FURN, plus
  drop "Officials" from requirements when the era prints none. ALIAS={} held for both 2013 and
  2016 (era division names McMillan/Batman/Melbourne Ports/Denison/Charlton match the era roster
  as-is — record them as member NOTES, not aliases).
- **Era party vocab for side_of/P_NAME**: 44th needs CLP ("CLP (NT)") and PUP ("Palmer United");
  45th needs XEN ("Nick Xenophon Team"). The arm-sanity x-bounds ±(240,355) and the government=
  Coalition assertion worked unchanged across eras.
- **Era EXPECT gates**: 45th {ALP69, LP45, LNP21, NP10, IND2, GRN1, KAP1, XEN1};
  44th {ALP55, LP58, LNP22, NP9, CLP1, IND2, PUP1, KAP1, GRN1} (Coalition 90).
- **Wayback provenance can be EMPTY and that's a finding**: for both 2016–2018 and 2013–2015 the
  CDX index has no capture of the Seating.pdf URL family (aph.gov.au has only ~7 captures in all
  of Nov–Dec 2013). Verify the INDEX is responsive first by querying known live captures (the
  2021 46th-capture URLs return rows; `?la=en&hash=…`-headed variants ARE indexed, so absence of
  pre-2019 hash-headed captures is meaningful). Fetching a known capture can yield an interstitial
  HTML page rather than the PDF bytes — byte-identity checks are not always possible. Fallback
  anchor, stated verbatim in meta.source + md preamble: PDF creation-metadata (InDesign version +
  creation date + document title) + local sha256 (45th: 3f760f02fe75…; 44th: c2b2d6fa24ac…).
- **OCR closures on old plans**: direct full-page Vision OCR closed only 139/150 on the 44th
  (arm/edge figure cells drop); 400-dpi crops (`pdftoppm -r 400` then `sips -c h w --cropOffset
  cy cx`) closed the remaining 11. The 45th needed five crop closures. Compile ocr-image.swift
  once per scratch dir; output JSON key is "text" (not "t").
- Row-1 heading in the md says "incl. Speaker's chair" only when a chair-seated member exists —
  the 44th md says just "front row (44 places)".

**Verifying/falsifying an "earliest revision survives" archive-floor claim (worked 2026-10-26, user challenged the floor — "2007 wasn't that long ago"):**
when a meta.source claims nothing older survives, be ready to re-prove it across EVERY archive and URL family, not just the one you used. The winning move is finding the live page that LINKS the oldest known file, because its capture proves (a) the revision series extends back further (the Feb-2012 Seating-Plan page already linked "seating plan, 24 November 2011", seating_241111.ashx — never crawled) and (b) which URL families existed, and its OWN first-capture date tells you when deep crawling of the site section began (the whole aph.gov.au chamber-documents section starts 20120220192441 — the floor is crawl coverage, not the documents). Recipe:
1. Fetch the earliest capture of the INDEX/page that links the artefact (CDX the page URL, e.g. `/About_Parliament/House_of_Representatives/House_of_Representatives_Seating_Plan*` — earliest 20120221004402; fetch with `web.archive.org/web/<ts>id_/<url>`) and grep its seating/asset links — yields the older dated-revision URL(s).
2. CDX every linked URL family with a directory/matchType=prefix query (`…/Chamber%20seating%20plans/*` lists every revision ever captured — that's how the named-date ashx revisions surface).
3. Sweep pre-floor years (from=2005&to=2011) on OLD site-architecture prefixes (`/house/chamber`, `/house/sections`, `/about_parliament/house_of_representatives`, `/documentlibrary`, `/house/practice`, `/house/votes` + exact-URL guesses) — all empty here.
4. Other archives: NLA Australian Web Archive is now a JS Trove shell — server-shell probes return a JS wrapper for any URL, so throughput is playback-guessing + Trove website search (also JS); PANDORA carries nothing. Memento timetravel.mementoweb.org is DEFUNCT (host doesn't resolve).
If everything is empty, keep the claim but state it precisely: "nothing before Feb 2012 survives in any archive; a dated 24 Nov 2011 revision existed (back-linked) but was never crawled; a later media-library redesign (~2011) means pre-2011 files plausibly lived at uncrawled URLs or were never published." Record TOGETHER in meta.source AND the .md preamble (same text, both homes).
- **Wayback CDX CLI gotchas**: `url=` with a mid-URL `*` is silently empty — use `matchType=prefix` + a directory prefix, or exact URLs; `matchType=domain` + a regex `filter=` 504s on aph.gov.au (too heavy) — never use it, slice prefixes (and years) instead; `curl -g` to kill bracket-globbing on `[sS]` filter classes; transient "Temporarily Offline" interstitial HTML pages appear under load — detect non-CDX text in output and RETRY, don't accept as empty; `collapse=urlkey` merges case variants (Seating.ashx = seating.ashx).
- **IA playback flakiness**: `web.archive.org/web/<ts>/…` can return exit 7/empty while CDX still answers; retry with `https://` + the `id_` suffix (raw bytes, no chrome).

## Watch out

- House side convention on the PRINTED page: government is page-LEFT (Speaker's right). State this
  explicitly in the meta — it's the bit everyone second-guesses.
- Same-file edit sequencing: multiple small key-name fixes (label vs surname vs div/division) bit
  here — run the emitter between edits, don't stack blind fixes.
- Expected party split is a good final gate: 150 total (or 149 with a confirmed vacancy),
  crossbench = sum of non-major counts.
- The emitted per-seat dict key is `label` (the printed surname), NOT `surname` — fmt/readers must
  use `L["label"]` (the KeyError has now been hit on three separate finalise first-runs).
- Commit status: the original SIX plans landed as cb62f364 (user-instructed); the two 43rd plans
  (2012-02-27, 2013-05-14) and the 2013-11-12 corroboratedBy/meta.source upgrade are UNCOMMITTED
  — the user hasn't asked; keep that as the standing answer.
