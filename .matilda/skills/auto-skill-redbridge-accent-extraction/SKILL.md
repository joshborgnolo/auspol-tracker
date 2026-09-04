---
name: redbridge-accent-extraction
description: Extract AFR/RedBridge Group/Accent Research monthly federal polls into data/polls.json — project-page slugs lost their %2C comma prefix with the Aug 2026 wave (PAGE_SLUG_RE accepts both; a wave missing from candidates = slug-format suspect before sitemap lag), pre-flight "already recorded?" check, Wix Thunderbolt SPA PDF discovery via headless-Chrome CDP click on the file-upload-viewer widget (usrfiles.com URL), Table 2 live-text wave table via pdftotext (Figures 1–2 are images; tesseract installed if needed), canonical RedBridge row conventions (respondent-allocated TPP, Other→ind, ppm/approval/altTpp companion rows, tpp_flows shared with Roy Morgan since 2026-08-31 — ALP share of the 2025-flows pair), hand-entered waves can carry placeholder companion figures (check identical-to-previous nets + detail:null), AFR topic-page cross-check for sitemap-lag detection (AFR body paywall-trimmed; figures only from Accent PDF or manual benchmarked ingest).
source: auto-skill
extracted_at: '2026-09-04T00:00:00.000Z'
---

# RedBridge / Accent (AFR) poll extraction → data/polls.json

The AFR-commissioned RedBridge Group/Accent Research monthly federal poll is published at
accent-research.com as a long PDF (100+ pages). Numbers learned from the July 2026 wave
(fieldwork 27–30 Jul 2026, N=1,001, published 2 Aug 2026).

## PRE-FLIGHT: check the wave isn't already recorded (hard-won lesson)

Before extracting ANY wave, prove it isn't already in the dataset:

- `data/polls.json` — search ALL four sections (`polls`, `ppm`, `approval`, `altTpp`) for the
  fieldwork-end date. `polls` rows key on `pollster`, the other three on `firm`.
- `grep "YYYY-MM-DD" index.html` — the built artifact should already embed the dates.
- `git status --short` — if the rows exist and the tracked tree is clean, the work is DONE;
  report the values and stop. Don't rebuild or recommit.

(2026-08-29 session: an in-flight "extract the July poll" task rasterised PDF figure pages and
prepared OCR before discovering Table 2 was live text — and the wave was already committed in
`8abac0f` across all four sections. The extraction was entirely redundant.)

## Source: Wix Thunderbolt SPA, curl is insufficient

- accent-research.com is a Wix Thunderbolt site; `/projects/<slug>` pages are client-rendered
  dynamic-router pages (observed siteRevision 1270, metaSiteId
  `6b72024e-077a-44e2-88f5-dc1a0ed81099`). `/_api/v2/dynamicmodel` POST 403s via curl.
- **Don't guess slugs** — wrong guesses hit Wix "Page Not Found". Enumerate the `/projects`
  index or web-search first. Slugs can contain commas (`/projects/afr%2C-redbridge-group-and-...`).
- **Slug prefix changed 2026-08 (commit 52de606)**: Accent DROPPED the encoded comma from
  the monthly-poll slug prefix with the August 2026 wave — `afr-redbridge-group-and-accent-
  research-august-2026-federal-poll` vs the historical `afr%2C-redbridge-…`. `PAGE_SLUG_RE`
  in extract-redbridge.mjs now accepts both (`/^\/projects\/afr(?:%2C)?-redbridge-…/i`).
  Every run with the comma-only regex had silently listed the page under `skipped_slugs`;
  a wave missing from `candidates` is now a SLUG-FORMAT suspect first, not just sitemap lag.
- Disambiguation: `a-fragmented-electorate` = the **May 2026 MRP** release (seat projections,
  ~6k sample), NOT the monthly poll — different polls.json row (`pollster` gets `(MRP)` suffix).

## PDF URL: only resolves on widget click

The PDF URL appears in NEITHER the hydrated DOM NOR passive network capture — Wix resolves it
only when the viewer widget is clicked:

1. Launch persistent headless Chrome: `Google Chrome --headless=new --remote-debugging-port=9223
   --user-data-dir=/tmp/probe-chrome4 about:blank` as a **managed background task** (plain `&`
   dies when the parent shell exits).
2. Connect puppeteer-core over CDP (`puppeteer.connect({browserURL:"http://127.0.0.1:9223"})`),
   install `browser.on("targetcreated")` + `page.on("request")` listeners, then
   `page.evaluate(() => document.querySelector('[data-hook="file-upload-viewer"] button').click())`.
3. The PDF URL matches `https://{metaSiteId}.usrfiles.com/ugd/...pdf` (40MB+, 130+ pages).
   Existing polls.json rows cite either this usrfiles URL or the AFR article URL as `url`.

macOS/script gotchas: no GNU `timeout`; Bogan mode REFUSES write_file outside the workspace —
put probe scripts under `.matilda/probe/` and `npm i puppeteer-core` there.

The cached `pdfUrl` in `.build/redbridge-src/*.json` now has a SECOND consumer beyond this
extractor: `.build/extract-sampleeff.mjs`'s `legAccentLinks()` re-reads those caches to stamp
`methodUrl` (the wave's APC methodology-report link) onto RedBridge / Accent rows — never delete
or reshape the field. Two Accent pages outside this extractor's sitemap regex (Oct-2025 snapshot,
May-2026 MRP "a fragmented electorate") had their PDF hrefs captured 2026-09-02 by the standalone
probe `.matilda/probe/accent-pdfurl.mjs` and live as a constant inside that leg. See
auto-skill-auspol-effective-sample for the full methodUrl picture.

## Reading the PDF: Table 2 is live text; figures are images

Physical PDF page ≈ internal page + 3 (cover/TOC). Confirm with pdftotext, don't trust offsets.

- **Table 2 "Federal vote intention … by wave"** (internal ~p7) is LIVE TEXT — the ENTIRE wave
  history: ALP / Coalition / One Nation / Greens / Other-primaries plus all three TPP flavours:
  `vs. Coalition (2025 flows)`, `vs. Coalition (respondent allocated)`, `vs. One Nation
  (respondent allocated)`. `pdftotext -layout -f N -l N <pdf> -` gets everything needed for the
  `polls` row. Never OCR this table.
- Figure 1 (summary) and Figure 2 (vote trends with CI bands) are embedded IMAGES
  (`pdfimages -list` shows which pages). Preferred PM (internal ~p91) figures are images too.
  Leader FAVOURABILITY (internal ~p13–47) is **live text tables** ("Table 5/6: Favourability
  ratings of party leaders" + a "Favourability ratings … of institutions" chapter — see
  *Parser eras* below), NOT just images as first assumed — the automated extractor parses ppm
  nets and app/dis detail from them. OCR is only a fallback; **tesseract AND ocrmypdf are
  installed on this machine** (homebrew): `pdftoppm -png -r 110 -f A -l B <pdf> out` then
  `tesseract out-00A.png stdout`.
- Table 1 (text) gives respondent-allocated preference flows by first preference.
- Methodology page (internal p1) text: fieldwork dates, N, rim weighting, effective n, MoE,
  undecided-after-leaner share excluded, both TPP computation methods.

## Canonical polls.json conventions (verified against 15 RedBridge rows)

- `pollster`: `"RedBridge / Accent"` for AFR-commissioned waves; `"Redbridge"` for other clients
  (e.g. Australia Inst.); `"(MRP)"` suffix variants for MRP releases. Two spellings coexist —
  match what the wave's client demands, don't "normalise".
- Row shape: `date` = fieldwork END, `dateStart` = start, `published` = AFR embargo datetime
  hour precision (e.g. `"2026-08-02T18:00"`), `client: "AFR"`, `sample`, primaries, `url`.
  `lnpSplit` ({Lib,LNP,Nat}) appears on some rows — copy if the report gives it.
- **`tpp_alp`/`tpp_lnp` = respondent-allocated ALP-vs-Coalition figure** from Table 2's third
  TPP column (48/52 for Jul 2026) — NOT the headline "2025 flows" column (50/50). Verified:
  committed rows track the respondent-allocated column wave-over-wave. A wave that prints NO
  respondent-allocated vs-Coalition pair keeps `tpp_alp`/`tpp_lnp` legitimately `null` — but
  do NOT cite Aug 2026 as that case: it was initially recorded that way by mistake (the wave
  DOES carry a respondent-allocated pair, 48/52 — see the `tpp_flows` bullet below).
- **`tpp_flows` = 2025-flows vs-Coalition ALP share — now SHARED by Roy Morgan and
  "RedBridge / Accent"** (convention reversed 2026-08-31 at user direction, commit
  `073906a`; the old Morgan-only rule survives only in git history). RedBridge/Accent
  genuinely publishes a 2025-election-flows pair, so: validate.mjs's `flows-pollster`
  allows `["Roy Morgan", "RedBridge / Accent"]` (40–65 ALP-share range unchanged);
  gen-data emits `tppFlows` + the `flows` change-delta generically per house; the
  extractor commits `tpp_flows` from Table 2's `tppHist` column via a conditional spread
  on new waves (absent, not zero, when unprinted), and `--check` runs
  `cmp("tpp_flows", w.tppHist, matchPoll.tpp_flows)` — **any committed wave whose cache
  carries tppHist must carry tpp_flows or check reports a mismatch forever**. Backfilled
  at the reversal straight from the PDF caches: Apr 53, May 52, Jun 55, Jul 50. **Aug 2026
  was hand-entered during the Accent sitemap lag** (now RESOLVED — the page appeared with
  a comma-less slug; `PAGE_SLUG_RE` fixed and the wave cached in `52de606`, 2026-09-04;
  see *Discovery gap*), and an earlier "Aug 48" note here was a misread. The user-corrected
  benchmark (hand-entered 2026-08-31, commit `9fea364`; extractor VERIFIED it against the
  PDF on 2026-09-04 with zero diffs): 2025-flows ALP **52** / LNP 48
  → `tpp_flows: 52`, respondent-allocated ALP 48 / LNP 52 → `tpp_alp`/`tpp_lnp` — i.e.
  BOTH ALP–Coalition pairs exist for Aug 2026; they were hand-entered because automated
  discovery couldn't yet see the wave (it can now, via the comma-less slug fix).
  A hand-entered `tpp_flows` slides between `tpp_lnp` and `url`, matching the Roy Morgan
  key order; the rebuild regenerates the `9f09dca2` boot bundle AND `index.html` —
  stage both in the data commit. TPP stays out of the
  headline respondent-allocated trend (`tpp_alp`/`tpp_lnp`) unless AFR prints that pair.
  (Origin of the saga: the 2026-08-28 ingest first stored `tpp_flows: 48`, the old
  validator correctly rejected it, and the figure was dropped instead of widening the
  gate — the user had to call out the omission.)
- The ALP-vs-One-Nation respondent-allocated 2PP (e.g. **52/48** for Aug 2026) goes to the
  `altTpp` companion row's `alpVsOnp_alp` (see companion-row conventions below), NOT to
  `tpp_alp`. Don't conflate the two ALP headline figures in an AFR release.
- "Other parties and candidates" bucket → `ind`, `oth: null` (same convention as Newspoll).
- Companion rows for each wave: `ppm` `{date, firm, alb, opp, oppName, han, extra}` (three-way
  PPM; oppName Taylor in the current era), `approval` `{date, firm, alb, opp, oppName, han,
  detail}` with NET values plus `detail` app/dis breakdowns when reported, `altTpp` `{date, firm,
  alpVsOnp_alp, lnpVsOnp_lnp}` (ALP-vs-One-Nation respondent-allocated from Table 2's last
  column; lnpVsOnp generally null — RedBridge doesn't publish it).
- Sorted-insert by date within each section; rebuild via `.build/newtracker`
  (index.html is a generated artifact — see auspol-build-pipeline skill), never hand-edit.

## Automated extractor (committed 2026-08-29) — use it, don't hand-extract

`.build/extract-redbridge.mjs` now does the whole pipeline; a launchd agent
(`local.auspol.redbridge`, weekly Sun + daily 28th–4th 06:00) runs
`.build/redbridge-updater.sh` → RB_STATUS → validate → build → commit → push. Hand
extraction is only needed if the agent reports mismatches.

- Contract: exit 0/1/2; final stdout line `RB_STATUS {json}` with
  `{"changed":…,"verified":[…],"mismatches":[…],"notes":[…]}`; `--check` dry-run,
  `--force` re-parse; `RB_LIB=1 node -e "import('/abs/path')"` exposes
  `{parsePdf,parseTable2,parseTable5,parsePpm,sliceBetween,guardNewWave}` for tests
  (`.build/test-redbridge.mjs`, must stay green).
- Parsed-wave caches (JSON+TXT) are committed under `.build/redbridge-src/<slug>.*` —
  commit refreshed caches with parser changes.
- **Never duplicates a wave already recorded under the other label**: history has
  `"Redbridge"` (≤ Apr 2026) and `"RedBridge / Accent"` (May 2026 on); such waves land in
  `notes` with "reconcile labels manually", not in the dataset.

## releaseUrl: the pollster-release link (added 2026-09-01, commit 75bcb18)

Canon rows cite the AFR write-up in `url`; the wave's OWN page on accent-research.com
goes beside it in `releaseUrl` (rendered "Pollster's release" in the expanded poll —
absent, not zero). The extractor keeps each wave's sitemap `<loc>`, sets it on NEW waves,
and fills already-committed rows lacking the field (reported as `status.releaseFilled`;
write gate includes fills even with no new waves). Mirrored fill logic now lives in
extract-news24.mjs too (see news24-extraction skill).

- 2026-09-01: extractor filled 7 waves; `.build/backfill-redbridge-releaseurls.mjs`
  (assertion-guarded, no fetch) set the two pages sitemap discovery can NEVER reach:
  `federal-political-snapshot---october-2025` (2025-10-07) and `a-fragmented-electorate`
  (the 2026-05-14 MRP wave).
- Waves still absent by design (as of 52de606, 2026-09-04): 2025-06-30 / 09-08 / 11-13 /
  11-26 have no Accent page; 2026-03-27 still has no project page at all (never posted to
  the sitemap — no longer mere "lag"); 2026-02-12 is the plain-`Redbridge` Australia Inst.
  series — different pollsterRule key, never matched. **2026-08-28 was REMOVED from this
  list**: its page appeared with the comma-less slug and the extractor filled its
  releaseUrl (+methodUrl via legAccentLinks off the new cache) on 2026-09-04.
- Row dates are FIELDWORK-END, not publication — key backfills by date accordingly (the
  first attempt keyed waves by AFR pub dates like 2026-02-01 and missed; the actual row
  was 2026-01-29).
- The schema validates releaseUrl as absolute https; README documents the convention for
  both houses.

## Discovery gap: AFR topic-page cross-check (added 2026-08-31)

The Accent sitemap/project index can LAG days behind the AFR publication (the 2026-08-28
wave was in the AFR on 2026-08-30 but had NO accent-research.com project slug yet — the
agent silently "missed" the wave and the user had to feed the figures manually).
`extract-redbridge.mjs` main() therefore now also does:

- Plain `fetch()` of `https://www.afr.com/topic/redbridge-accent-poll-6ikd` (override:
  `RB_AFR_TOPIC` env) — works **unauthenticated** (~1 MB HTML); no Chrome needed.
- Finds article links by date code `href="…-(YYYYMMDD)-p…"`, de-dupes, and reports any dated
  NEWER than the max committed `published`/`date` of the POLLSTER's polls.json rows into
  `status.afrTopicNotes` + a `status.notes` flag line. Fetch failure is a NON-FATAL note —
  sitemap discovery is unaffected.
- **DETECTION ONLY**: the AFR article body is paywall-trimmed even via the logged-in-Chrome
  piggyback (chrome-session-piggyback skill) — no figures in DOM, metas, or Flourish embeds.
  Figures still come from the Accent PDF once posted, or from a manual user-benchmarked
  ingest; the cross-check exists so the wave is never *missed*, not so it can be parsed.
- Post-ingest the cross-check is silent as designed (no fresh articles) — that's the healthy
  steady state; verify it stays silent vs falsely flagging the just-ingested wave.
- False-positive noise (seen 2026-09-04): the AFR topic page now carries UNRELATED AFR
  articles under the tag (careers, cars/luxury pieces) — `afrTopicNotes` flags them as
  phantom "waves". Cosmetic wart only; not an extractor error.
- The 2026-08-28 lag case RESOLVED 2026-09-04 (52de606): Accent DID post the project page,
  but with a comma-LESS slug the comma-only `PAGE_SLUG_RE` couldn't match (see the
  slug-prefix bullet) — so "wave in the AFR but not in candidates" has TWO possible causes
  (page not yet posted, or slug-format drift). Triage: check the weekend launchd log's
  `skipped_slugs` for a look-alike slug before hand-ingesting; and when hand-ingesting,
  remember companion rows may get placeholder figures from the AFR coverage (see the
  Aug-2026 approval fix in *Verification-driven data fixes*).

## Parser eras (hard-won probes against the Dec 2025→Jul 2026 wave corpus)

- **Table 2 vote-intention row width changed mid-series**: old print has 11 cells (4
  coalition columns: Lib/Nat/LNP/CLP), new print (Jun 2026 on) has 8 (1 coalition col).
  Derive the offset from the row, never hard-code: `p = cells.length - 7`, then
  `lnp = p===1 ? cells[1] : sum(cells[1..4])`, `onp=cells[1+p]`, `grn=cells[2+p]`,
  `ind=cells[3+p]`, then three TPP cells `cells[4+p..6+p]`. (Symptom of the hard-coded bug:
  July LNP parsed as the Greens' 10 instead of 22.)
- **Favourability heading shape varies**: July 2026 uses surname-only headings ("Albanese",
  "Taylor"), ≤ Apr 2026 uses full names ("Anthony Albanese"). Head regex must accept both
  (`[A-Z][a-z]{2,14}( [A-Z][a-z]{2,14})?`) and key by `heading.split(" ").pop()`.
- **Section-terminator caption varies**: newer PDFs caption the institutions chapter inline;
  April 2026 captions it "Table 15: Favourability ratings and recognition of institutions".
  Terminate on `/\n\s*(Table \d+: )?\s*Favourability ratings.*of institutions/i`.
- **Month token in wave rows is abbreviated** ("Jun", "Sept"): month regex needs
  `Sept?` and the abbr map needs a `Sept: 8` entry alongside `Sep`.
- **Legacy reports (Dec 2025–Feb 2026) have NO "by wave" tables at all** — only demographic
  tables — and their fieldwork sentence omits years. Recover years from the cover line
  `MonthName, YYYY` with a Dec-fieldwork/Jan-release wrap (`fw month > cover month → year-1`
  e.g. Dec 2025 fieldwork under a 2026 cover). These waves were hand-entered under
  `"Redbridge"`; the extractor resolves their dates and skips them as already-committed —
  don't try to make it parse trend data that isn't in the PDFs.
- Physical page ≈ internal page + 3 still holds; confirm with pdftotext, don't trust offsets.

## Verification-driven data fixes (2026-08-29 precedent)

The extractor doubles as an audit tool: `--check` lists `mismatches` between polls.json and
the PDFs. Real fixes it caught: May approval Hanson net was −6 (PDF says **0**) — two
independent PDFs (May's own Table 5 and July's May-row) agreed; June 2026 wave had ppm +
approval rows **missing entirely** from the file; July approval `detail` was eyeballed
(40/59, 30/36, 40/50) vs true Table 5 totals (**30/49, 20/26, 36/46**). When inserting
corrected rows, respect validate.mjs's strict date-order per section — locate neighbours by
querying the array (not by grepping one line) and re-run `validate.mjs` + the extractor's
`--check` until both are clean before rebuilding.

**Hand-entered waves can carry PLACEHOLDER companion figures** (Aug 2026, fixed 2026-09-04
in 52de606): the sitemap-lag hand-ingest copied JULY's approval nets onto the August
approval row (alb −19 / opp −6 / han −10 — bit-for-bit July's, with `detail: null`, because
AFR coverage printed no leadership numbers). The extractor verified the wave's votes
clean but reported the approval trio as mismatches; the Accent PDF's true figures were
alb **−17**, opp **−3**, han **−12** (detail 31/48, 22/25, 36/48) — corrected by hand to
match, since the extractor never overwrites committed rows. Tells of a placeholder row:
companion values IDENTICAL to the previous wave + `detail: null` on a house that always
prints breakdowns. A `detail: null` also silently DISABLES the extractor's detail
comparison (`if (r.detail && w.detail)`), so null-detail rows get only the net check.

## Adjudicated ppm figures (user-verified 2026-09-01, ground truth)

The user adjudicated the legacy preferred-PM series against the Accent PDFs — treat this as
authoritative if `--check` ever flags these rows again:

- Nov 2025 (`2025-11-13`): alb 40, opp 10 (Ley) — was already correct.
- Dec 2025 (`2025-12-12`): alb 41, opp 12 (Ley) — was already correct.
- Jan 2026 (`2026-01-29`): alb **37**, opp **9** (Ley) — polls.json had 42/29; corrected.
- Feb 2026 (`2026-02-27`): alb **34**, opp **10** (Taylor), han **23** — polls.json had 33/14;
  corrected (`han` 23 was already right).

ppm rows carry no undecided field — undecided is the implied remainder of 100 (Nov 50,
Dec 47, Jan 54, Feb 33); nothing to store. Corrections were validated + rebuilt the same day.
NOTE: the old chore claim "four AFR waves still labelled `Redbridge`" was ALREADY STALE by the
time it was recorded — the migration set is empty and the only `Redbridge` row is the
deliberate 2026-02-12 Australia Inst. exception; verify chore lists against a migration
dry-run before acting on them.

## Adjudicated leader-favourability series (user-verified 2026-09-01, commit ff5aac0)

The `approval` section's RedBridge NET favourability trio (alb / opp / han) is adjudicated
ground truth back to Nov 2025; 2025-flows-era figures were cross-checked across THREE
overlapping trend tables (April/May/June report TXT caches under `.build/redbridge-src/` —
each later report reprints the whole history, and they all agree):

- 2025-11-13: alb −2, han −13 (han had −12), detail alb 37/39, han 32/45
- 2025-12-12: alb 1, han −19 (was null), detail alb 39/38, han 31/50
- 2026-01-29: alb −10 (had −13), han −3, detail alb 34/44, han 38/41
- 2026-02-27: alb −13 (had −17), opp −1 (Taylor, had −3), han −2, detail 32/45, 19/20, 38/40
- 2026-03-27: alb −17, opp −3, han −3 — this approval row DID NOT EXIST before this
  session; detail 29/46, 19/22, 40/43
- 2026-04-30: alb −9, opp −2 (Taylor), han −1, detail 34/43, 20/22, 40/41
- 2026-05-28: alb −19, opp −4, han 0 (nets were already right), detail 29/48, 21/25, 40/40

Taylor's favourability was first asked Feb 2026 — rows before that have no `opp` entry
(Ley's Nov–Jan nets stay as recorded under `opp`). Table 5/6 prints NET as
fav−unfav on rounded pc; stored detail is fav/unfav. Users typing from the report
sometimes conflate a wave with its neighbour (the user's "Mar" figures were actually April's)
and occasionally mis-transcribe (−12 for Taylor Apr) — adjudicate EVERY wave against the
trend tables, not just the one asked about, and treat a later report's reprinted history as
corroboration of an earlier report's current-wave table.

Still open (as of 2026-09-01): Jan + Dec-2025 waves have NO `altTpp` rows — the legacy PDFs
have no "by wave" tables, so the ALP-vs-ONP 2PP figures must be hand-entered from the PDFs
(extractor reports them "left for manual entry").
