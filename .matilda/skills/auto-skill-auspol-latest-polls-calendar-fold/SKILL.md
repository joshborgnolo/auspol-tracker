---
name: auspol-latest-polls-calendar-fold
description: auspol-tracker — the Latest-and-next "Release calendar" fold-out (shipped as "Calendar" 79a3ea9 2026-10-09; renamed + pollster-name links same day 855b909 per user: "Rename it 'Release calendar'. and add the links to where it's first published, to the pollster names"). rd-evdrop details block at the END of the RdPolls RdSec (after the projections note), month-headed lists of the widened projection (npProject opts.horizonDays=RD_CAL_DAYS 62 — while panel+ticker keep the default 28; memo keyed on horizon so the widened call never poisons the default), per-DATE coalescing of pollsters, loose-window spans / irregular "About" / overdue "Due, not yet recorded" lead-in; each name links out to the house's first-published page (pollsterRules.site, riding npProject rows via the {...c} spread — NO np-project.js change) with a ↗ plink-mark, houses with no site (Fox & Hedgehog, Freshwater) stay plain text; phone rung wraps with padding-left NOT margin-left (margin adds to flex-basis:100% → 80px overflow); editing np-project.js REQUIRES `node .build/site-shell.mjs` + committing the ten satellites or test-site-shell fails npm test (a feature that only rides fields ALREADY on the rows, like 855b909, edits no shared asset and skips that step). Scope widened same day (e7f2f70) per the user's "the calendar scope should be tracked releases. but i understand if theyre not trackable" call: pollsterRules[firm].tracked:true houses (SEC Newgate's chip now "Mood of the Nation", Ipsos "Issues Monitor") join the fold-out as honestly-labelled LOOSE-WINDOW rows — gen-data mints byHouse rows from non-poll sources (direction[] waves / .build/ipsos-src sidecar uploadedAt clocks) with rows.tracked hung on the array → `tracked` field on the pollCadence entry → np-project's opts.includeTracked admits them (DEFAULT OFF everywhere else); RD_CAL_TRACK chips label WHAT each monitors; probe grew 24→36 checks incl. default-call poll-only purity. Same-day round-3 polish (3d4a16f, four user fixes): chip CSS loses text-transform/letter-spacing (quiet sentence-case text in parens, ::before/::after parens kept) and SEC's chip reads "Mood of the Nation" not "Direction tracker"; calSpanTxt cross-month spans go UNSPACED ("18 Sep–12 Oct"; same-month branch already was); .rd-cal-d becomes a FIXED 96px column (widest text = a cross-month span at 11px) so every house name shares one vertical edge, phone rung .rd-cal-q padding-left tracks label+gap at 108px; SEC Newgate's pollsterRules.site retargets https://www.secnewgate.com.au/news-views/?_category=research — its bare series slug (/sec-newgate-mood-of-the-nation) started 301ing to a 2023 Queensland edition page (link-rot class: a chosen "series' own page" URL can silently become an edition page; verify site URLs resolve to a CURRENT series landing, never a dated edition, and curl the redirect chain before citing one); probe grew to 40 checks (unspaced-span regex, name-column right-edge spread ≤1px + per-cell overflow, renamed chips). Round-4 (843e9fd, same day) per user "add a separate consumer/business confidence release calendar underneath the economic sentiment chart and likewise just call it 'release calendar'. Keep the current release calendar for Polls, Ipsos, and Newgate only": polls fold filters the widened projection to `r.tracked !== "confidence"`; the four confidence gauges (tracked:"confidence" rows minted by gen-data CONF_TRACKS/CONF_SITES, admitted by np-project includeTracked) render in their OWN RdConfCal fold (rd-panels.jsx, mounted in #confidence between the crossfaded chart and the HowTo) reusing every calendar DOM class/semantic plus .rd-conf-cal; probes now BOTH committed (git add -f past the root .gitignore .matilda/* rule): pl-calendar.mjs 42 checks asserts NO confidence name renders under Latest polls, new conf-calendar.mjs 36 checks pins the second fold's placement and projection parity.
source: auto-skill
extracted_at: '2026-10-09T01:09:57.130Z'
---

# auspol-tracker: the Latest-and-next "Release calendar" fold-out

User request (2026-10-09): "Like the trend significance table button, add a
button under the latest and next polls table that just says 'Calendar'. When
you click on it, it drops down a calendar of the next 2 months of poll
releases. The calendar is just in list form." Shipped as **79a3ea9** from a
detached worktree (`.worktrees/np-calendar`; main checkout had sibling WIP —
see auspol-worktree-scratch-files; worktree removed after the push).

Same-day follow-up (**855b909**, pushed to origin/main): "Rename it
'Release calendar'. and add the links to where it's first published, to the
pollster names" — summary relabeled, and every house name in the list
became a link to the house's first-published page (see "Name links"
below).

## Where it lives

- **`.build/newtracker/assets/rd-polls.jsx`** (RdPolls):
  - `const RD_CAL_DAYS = 62;` near `RD_STALE_DAYS` — "two calendar months
    by name": 62d always reaches the 1st of the second-next month.
  - A derivation block immediately before the component's `return (` —
    listed below.
  - The JSX appended at the very END of the RdSec, after the projections
    `<p className="rd-note">`: `<details className="rd-evdrop rd-cal">
    <summary>Calendar</summary>` + `.rd-cal-body` + a closing
    `<p className="rd-note">` inside the details. Rendered only when
    `calMonths.length > 0 || calOver.length > 0`. Disclosure chrome is
    borrowed from `.rd-evdrop` (the events fold + trend-significance table
    share it — the user named the tsig button as the model).
- **`.build/newtracker/assets/rd.css`** — one block right after
  `body.rd .rd-evdrop .rd-evlist { margin-top: 8px; }`.
- **`.build/newtracker/assets/np-project.js`** — the horizon option (see
  the auspol-next-polls-projection skill's consumer list).
- Probe: **`.matilda/probe/pl-calendar.mjs`** — COMMITTED since
  843e9fd (`git add -f` past the root `.gitignore` `.matilda/*` rule,
  which un-ignores only `.matilda/skills/`; the repo convention is
  pinning probes ship with the feature, see auspol-probe-drift-repair).
  In the MAIN checkout — a detached worktree has no `.matilda/`.
  Run `BASE=".worktrees/np-calendar" node .matilda/probe/
  pl-calendar.mjs` FROM THE MAIN CHECKOUT when testing a worktree.
  Grew 24 → 36 → 40 → **42 checks** over desktop 1280 + phone 390
  (the round-4 addition: an in-page assertion that NO confidence-gauge
  name renders anywhere in the polls fold, against
  `tracked:"confidence"` names read off the widened projection — see
  round-4 section below; earlier checks: details exists, summary read,
  starts closed, last child, under the table, opens on click, li count
  == in-page rederived widened projection composition, due-li count,
  month heads, **default `nextPolls()` horizon stays 28d** (the
  memo-poisoning guard), poll-only default call, geometric name-column
  alignment, unspaced dashes, no horizontal overflow, no page errors).

## Composition semantics (the derivation block's contract)

`calProj = window.AP.nextPolls(null, { horizonDays: RD_CAL_DAYS })` (guarded
on `window.AP.nextPolls`, fallback `{rows:[]}`), then:

- **`calOver`** — `r.overdue` rows, sorted by release. At most one per
  house (the walk stops at the first overdue slot). Renders as the lead-in
  section `<h4>Due, not yet recorded</h4>` with red qualifiers
  (`.rd-cal-sec-over .rd-cal-q { color: var(--mood-neg) }`); a missed row
  appends `when(r.closesIn)`.
- **Dated rows** — coalesced PER DATE into `calDays` Map: one li per date,
  `who[]` accumulating every pollster sharing that release date. Sort by
  `at`.
- **Loose window rows** (`r.loose && cadence ≤ 60`): `at = release -
  spread*DAY`, `close = release + spread*DAY`, `win: true`; the date cell
  prints `calSpanTxt(a,b)` — same month `"9–27 Oct"`, else `"30 Nov – 2
  Dec"`; qualifier "window" (or "open now" when already open).
- **Irregular rows** (`cadence > 60`): `irr: true`, date prefix "About ".
- **`it.q`** qualifier strings: "open now", "window", "give or take N
  days", "today", "tomorrow".
- **`calMonths`** groups items by `ym` of `item.at`; heads via
  `rdMonthYear(ym)` (full month name from `window.AUSPOL.monthNameFull`).

## CSS traps learnt at ship time

1. **`flex-basis: 100%; margin-left: 100px` overflows by exactly the
   margin.** First phone rung wrapped `.rd-cal-q` to its own line with a
   margin indent — the debug sweep
   (`.matilda/probe/np-cal-debug.mjs`, one-off: at 390px walk
   `document.querySelectorAll("body *")`, collect rects with
   `right > clientWidth`, print tag+class+left/right) showed the spans at
   right=470px, i.e. the 80px document overflow was MINE. A margin ADDS to
   the full-width basis; **padding sits inside the box**. Fix:
   `padding-left: 98px`. The li itself is `flex-wrap: wrap; gap: 4px
   12px;` under the `@media (max-width: 640px)` rung.
2. **Don't key semantics off `:first-child`.** First draft painted the
   overdue section red via `.rd-cal-sec:first-child` — with no overdue
   rows the FIRST MONTH SECTION would have been painted. Use the explicit
   `.rd-cal-sec-over` class in both JSX and CSS.
3. Baseline check before owning an overflow: run the same probe with
   `BASE="."` on HEAD — the pre-existing 13px `ss-table` overflow was
   exonerated that way (document overflow already ≤ 0 net on HEAD).

## Build-shipping trap: np-project.js is site-shell shared (npm test death)

`np-project.js` is a PLAIN-layer asset bundled into `assets/site-shell.js`
for the ten satellite pages. Build order you MUST follow after editing it:

1. `node .build/newtracker/build.mjs` (regenerates index.html AND
   `assets/site-shell.js`),
2. **`node .build/site-shell.mjs`** — regenerates all ten satellite
   `index.html`s against the new shell; commit them too (they're in the
   shared SITE_FILES list).

Miss step 2 and `test-site-shell.mjs` fails `npm test` with
"a satellite is out of step with its shell — run node
.build/site-shell.mjs and commit the pages" listing all ten satellites.
Nothing in build.mjs warns about this; the failure only shows inside the
full test chain.

## Rebase flow that worked (sibling raced origin mid-build)

Local main advanced under the worktree (sibling commit a5822c6). Sequence
that shipped cleanly (per ci-main-writer-races / shared-repo skills):

1. Commit the worktree branch first (sources + ALL regenerated files).
2. `git fetch origin && git rebase origin/main` — the sibling's
   `index.html` changes were different data, so the textual rebase of the
   GENERATED files appeared to succeed; **do not trust that** — a clean
   textual merge can still be a semantic mixture.
3. Re-run `node .build/newtracker/build.mjs` + `site-shell.mjs` on the
   REBASED tree (generated files must come from the union of sources, not
   from git merging two generations). If status is dirty, `git add -A` +
   `git rebase --continue`.
4. `git log HEAD..origin/main` empty-check, then `git push origin
   HEAD:main` (detached).
5. Fast-forward the main checkout (`git merge --ff-only origin/main`).

## Round-3 follow-ups (3d4a16f, same day, four user fixes)

1. **SEC Newgate's site link rotted into an edition page.** The
   pollsterRules.site chosen at e7f2f70 as "the series' own page" —
   the bare slug `/sec-newgate-mood-of-the-nation` — started 301ing to
   `/sec-newgate-mood-of-the-nation-2023-queensland-edition/` (user:
   "the sec newgate link just points to a 'mood of queensland page'").
   Retargeted to `https://www.secnewgate.com.au/news-views/?_category=
   research` (200; it is the research feed each Mood of the Nation
   release posts to, per extract-secnewgate.mjs; `/news-views/category/
   research/` is a 404 — the query-string form is the live one; six
   "mood of the nation" mentions verified in the body). Lessons: a
   site-identity URL can silently decay from series-landing to dated-
   edition; curl the redirect chain before trusting a "series page",
   and prefer the publisher's feed/category landing over a bare slug.
   The note changed from "Site is the series' own page, which is also
   every wave's url." to "Site is the research feed where each Mood of
   the Nation release posts."
2. **Chip style.** User: "make the '(direction tracker)' text
   non-smallcaps, just sentence case. and call newgate 'mood of the
   nation'." `.rd-cal-track` dropped `text-transform: uppercase` +
   `letter-spacing` (keeps the ::before/::after parens — "quiet
   sentence-case text in parens"); `RD_CAL_TRACK` =
   `{ direction: "Mood of the Nation", issues: "Issues Monitor" }`.
   Sits squarely under the auspol-text-transform-caps convention
   (sentence case in source, any uppercase styling is CSS's choice —
   here the user revoked the CSS's choice for this element).
3. **Unspaced cross-month dash.** calSpanTxt's cross-month branch had
   `dm(a) + " – " + dm(b)` ("26 Oct – 17 Dec") while the same-month
   branch was already unspaced (`"9–27 Oct"`); user: "the en dash here
   should be unspaced". Now `dm(a) + "–" + dm(b)` ("18 Sep–12 Oct").
4. **Names on one vertical line.** li is a flex row whose leading date
   cell varied with text width, so house names stair-stepped. User:
   "the pollster names should be indented the same amount so they all
   sit in one vertical line". `.rd-cal-d` fixed at
   `flex: 0 0 auto; min-width: 96px; white-space: nowrap` — 96px is
   the measured width of the widest date text (a cross-month span,
   "18 Sep–12 Oct", at 11px ink-3), comment in the CSS says so; the
   phone-rung third-column indent tracks as `padding-left: 108px`
   (label+gap; the flex-basis:100% padding-over-margin rule from
   ship time still holds). Probe asserts alignment GEOMETRICALLY:
   `calAlign = max−min of every .rd-cal-d's
   getBoundingClientRect().right ≤ 1px` plus per-cell
   `scrollWidth ≤ clientWidth+1` (catches a future longer span
   bursting the 96px and re-raggeding the column), plus the
   unspaced-dash regex `!/\s–\s/` on every date text. 36→40 checks.

Round-3 also re-confirmed: rd-polls.jsx JSX compiles INLINE into
index.html (855b909's file set — rd-polls.jsx + rd.css + index.html —
is the shape any calendar JSX change produces; NO hashed asset file
changes for it, only the 9f09dca2 data bundle when pollsterRules
changes), and with np-project.js untouched no site-shell re-stamp is
owed (test-site-shell green inside npm test proves it).

## Round-4: the confidence split (6e67977, same day — committed as 843e9fd, rebased over a CI race then amended, so the pushed hash is 6e67977)

1f2f1e8 had added the four confidence gauges INTO this fold (mixed in
with the poll rows); the user redirected: **"Actually add a separate
consumer/business confidence release calendar underneath the economic
sentiment chart and likewise just call it 'release calendar'. Keep the
current release calendar for Polls, Ipsos, and Newgate only."** The
same kind of user U-turn as the mood→confidence rename — a shipped
feature gets partitioned, not deleted.

- **Polls fold (rd-polls.jsx)** — `calRows = calProj.rows.filter((r)
  => r.tracked !== "confidence")` right after calProj; every renderer
  downstream iterates calRows. Fold note reverted to the
  direction/issues-only wording (the confidence sentence from 1f2f1e8
  came back out).
- **Second fold (rd-panels.jsx)** — new `RdConfCal()` component
  sitting after RD_CONF_VIEWS, mounted inside RdConfidence **after
  `</RdCrossfade>` and before `<HowTo>`** (so it lands between the
  chart and the how-to in #confidence). Own constant
  `RD_CONF_CAL_DAYS = 62`. It duplicates the small local helpers
  (DAY, WDs, when, irregular, spanTxt etc.) rather than importing —
  rd-panels.jsx is a separate module from rd-polls.jsx. Renders the
  SAME DOM classes as the polls fold PLUS `.rd-conf-cal`:
  `<details className="rd-evdrop rd-cal rd-conf-cal"><summary>Release
  calendar</summary>…`, Due lead-in, month heads via rdMonthYear,
  names linked to gen-data's CONF_SITES with the ↗ plink-mark, and a
  `.rd-note` naming the four gauges. Diff per series: a freq chip
  `r.cadence <= 10 ? "weekly" : "monthly"` (the polls fold uses
  RD_CAL_TRACK name chips instead; no new CSS — .rd-cal-track covers
  both).
- **Data path** — gen-data ~:5274 mints `tracked:"confidence"` cadence
  rows (CONF_TRACKS: ANZ–Roy Morgan Consumer Confidence, Westpac–MI
  Consumer Sentiment, Roy Morgan Business Confidence, NAB Monthly
  Business Survey + CONF_SITES per-series siteUrl); np-project's
  `opts.includeTracked` admits them. The includeTracked doc comment in
  np-project.js names the split ("The two calendar folds then split
  the tracked rows between them: Latest polls keeps direction/issues,
  Economic sentiment keeps confidence.").
- **Projection row name field is `pollster`, NOT `firm`** — `firm:`
  appears only in np-project's ticker-item projections, never on
  nextPolls rows. A probe that scans for r.firm finds nothing.
- **Probes** — pl-calendar.mjs derives its expectation from the same
  filtered calRows and asserts NO confidence name renders under Latest
  polls (42 checks); new **conf-calendar.mjs** (36 checks, committed
  with the feature) pins placement: #confidence contains EXACTLY ONE
  details.rd-cal (the .rd-conf-cal one), summary "Release calendar",
  starts closed, below `.rd-confidence-chart`, above `.table-hint`,
  not inside #latest-polls; then re-derives li/month-head/due counts
  from `.filter(r => r.tracked === "confidence")` on the widened
  projection, per-series listing, freq chips (weekly iff cadence ≤
  10), https/_blank/plink-mark links, the four-gauges note, overflow
  + page errors, desktop 1280 and phone 390.
- **Two probe-authoring traps hit live**: (a) counting name
  occurrences across cells multiplies by duplicate series names —
  iterate `[...new Set(names)]` with a per-name want-map; (b) comparing
  two want-maps with `JSON.stringify` fails on KEY ORDER alone —
  compare bidirectionally with `Object.keys(a).every(k => …)` both
  ways.
- **Npm test trap confirmed once more**: the round-4 np-project.js
  edit was doc-comment-only and STILL flowed into assets/site-shell.js
  → test-site-shell.mjs failed until `node .build/site-shell.mjs`
  re-stamped the ten satellites (the "Build-shipping trap" section
  above holds for even a comment byte).

## Adjacent

- auspol-next-polls-projection — npProject internals, the horizon memo,
  the render homes.
- auspol-latest-next-polls-table — RdPolls anatomy, facet/pin machinery.
- auspol-mobile-overflow-probe — phone horizontal-pan diagnosis family
  (the element-sweep debug probe here is the same pattern).
