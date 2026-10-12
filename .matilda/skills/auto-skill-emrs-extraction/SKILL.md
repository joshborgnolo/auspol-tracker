---
name: emrs-extraction
description: EMRS (Tas) Federal Voting Intentions Report reader (.build/extract-emrs.mjs, shipped 2026-10-10 as c369f1a; same-day 79064d0 added canonWaveFor month-identity, delistedCachedYms re-verification, the publishedOf publication-date ladder and floor-0 guard) — discovery on emrs.com.au/latest-news-and-results, pdftotext -layout; the six PDF quirks the parser is built around (the Aug-2026 exec-summary "August 2025" typo, -layout gluing same-baseline prose before chart labels, electorate-cut Base lines beside the whole-state one, two different 2PP heading forms, a Labor-v-One-Nation 2PP section that is NEVER filed, One Nation's curly apostrophe U+2019). NO_AGG house (~6-monthly cadence, QUIET_DAYS=210, HEAL_DAYS=8); declared 09:00–17:30 weekday window since EMRS stamps dates, never clock times. auspol-tracker.
source: auto-skill
extracted_at: '2026-10-10T12:00:00.000Z'
---

# EMRS (Tas) Federal Voting Intentions Report extraction

EMRS polls Tasmanians on FEDERAL voting intention roughly six-monthly
(Feb 2026 → Aug 2026). Tasmanian-only, so `EMRS (Tas)` sits in
NO_AGG_HOUSES — the rows display in the archive but join no aggregate
(see auspol-noagg-aggregate-excluded-row). Cadence constants:
`QUIET_DAYS=210`, `HEAL_DAYS=8` (rows re-verified against the committed
canon cache `.build/emrs-src/<ym>.{txt,json}` on every run; a guard trip
logs `EMRS_GUARD` to stderr and NEVER rewrites canon).

## Canon identity (79064d0)

EXPORTED `canonWaveFor(canon, w)` names a listed wave's canon row by its
fieldwork-END MONTH first (`w.date.slice(0,7)` vs `e.date.slice(0,7)`) —
waves run ~6 months apart, so the month IS the identity; ±`HEAL_DAYS` is
only the near-window fallback, and a null date matches NO canon row.
Pre-79064d0 the ±8-day window alone was the identity, so an EMRS news
post landing >8 days after fieldwork close tipped a canon wave into the
new-wave guard instead of verifying.
EXPORTED `delistedCachedYms(cands, srcDir)` re-verifies cached waves whose
reports have DROPPED OFF the listing (re-parse from the committed cache,
same guard as a listed wave; a status note names each). Before it, a
delisting silently ended canon verification for that wave.

## Discovery

`https://www.emrs.com.au/latest-news-and-results` — anchor text containing
"Voting Intentions Report" + "Federal" (either order around "and", with or
without "State and"; `<b>`/`<em>`/entity-wrapped forms all occur),
href ending `.pdf`, month+year decoded from the TITLE text (`titleYmOf`),
≥ `EMRS_FIRST="2026-02"`. Media releases and state-only reports are
excluded. Two anchors for one month (e.g. a `-FINAL` re-host) → keep page
order's first, record `variants: 2`. `listFederalReports` also returns
`docDate` (see the publication ladder below) — sliced from a window
anchor→min(next `</article>`, next `<article>`) so a date never leaks in
from a NEIGHBOURING news item — and `pageCount` (all matching pages; a
`>1` count surfaces a status note; `federalPageOf` still reads only the
first).

## The report PDF (pdftotext) — the six quirks

1. **Exec-summary fieldwork typo.** The Aug-2026 report's exec summary
   reads "conducted from the 17th to the 18th of **August 2025**"; its
   methodology bullet correctly says `from 17-18 August 2026`.
   `fieldworkOf` keeps only candidates ending in the title month+year —
   the typo dies there, and both forms parse:
   `from the 16th to the 19th of February 2026` (ordinals) and
   `from 17-18 August 2026` (hyphen). A month-straddling window files
   under its END month. Two same-month "conducted" lines that DISAGREE =
   `fieldwork lines disagree` problem, never a coin flip; a vote with
   only the typo line = `no fieldwork span ending in the title month`
   problem naming the rejected candidate.
2. **`pdftotext -layout` glues same-baseline prose ahead of chart
   labels.** A primaries label can land mid-line after wrapped exec text
   ("…were more likely to indicate a  The Greens  13%"). Labels anchor
   `(?:^| {2,})Label +N%$` — start-of-line OR 2+ spaces — and reject
   trailing junk and prose-you-know-like "(17%)", "23 per cent".
   Decimals (30.5%) read fine.
3. **Electorate-cut Base lines sit beside the whole-state one.** The
   federal page qualifies ONLY as `Base: All respondents who gave a vote
   preference (n=968)` — `All respondents in Bass (n=182)` never qualifies
   (it carries a primary figure on a sub-sample that must not land as the
   state figure). `federalPageOf` returns the 1-based page and the
   gave-preference n as `sample`; fixture text without a leading `\f`
   matches pdftotext output (text first, form-feeds between pages).
4. **The 2PP heading has two forms.** Feb-2026: "Two Party Preferred –
   Labor v Liberal"; Aug-2026: "Two Party Preferred **Order** – Labor
   **and** Liberal". Both slice to the `Labor Ahead` / `Liberal Ahead`
   figures in that section.
5. **A Labor-v-One-Nation 2PP section follows — NEVER file it.** It is
   sliced OFF before the v-Liberal figures are read; a report containing
   ONLY the v-ON section is a problem, not a 2PP. The ALP-v-ON figures
   are interesting but measure a different contest (use the 3PP/tpp_alt
   machinery if ever wanted).
6. **One Nation's apostrophe is curly (U+2019 o')** in the PDFs:
   `Pauline Hanson’s One Nation 26%`. The onp regex char class `[’']`
   takes both forms. (Pinned after a test fixture used the ASCII form
   while the cache proved curly.)

## Figures

Six primaries: Labor, Liberal + National (Nat folds into lnp;
`natFolded` records the Nat line when present, lnp is the Liberal figure
alone when absent), Greens, One Nation, Independent, Other.
`primariesOf` is **all-or-nothing** — any missing non-Nat label nulls the
whole read and names the missing key in `problems` (a lone-label test can
therefore never succeed; derive variants from a full block). Canon
prints 99 and 101, so the sum gate is ≈100±1, and `tpp_alp + tpp_lnp
= 100` exactly on both canon waves.

2PP bases: `tppOf` returns nulls with a problem on a figureless section
("didn't parse") — never fabricate.

EXPORTED `guardNewWave`: per-primary floor is **0** (relaxed from 1 in
79064d0 — a genuine printed 0% primary must not trip; the ±2 sum check
remains the true guard, say so in the floor comment if it moves again);
future fieldwork ends and implausible spans also trip with named errs.

## Publication-date ladder (79064d0)

EMRS's news posts carry no publication clock time; a NEW wave's
`published` comes from EXPORTED
`publishedOf(docDate, lastModified, firstSeen)` → `{published, source}`:
1. **`document-date`** — the listing item's Drupal
   `field--name-field-document-date` `<time datetime="YYYY-MM-DDT…">`
   (the `:T12:00:00Z` stamp is a noon-UTC date-only placeholder, NOT a
   real time). The 2026-02 item carries 2026-02-20, matching canon. A
   docDate EARLIER than the title month (`dt[1] < ym+"-01"`) is
   distrusted.
2. **`last-modified`** — the PDF response's HTTP `Last-Modified` GMT
   header converted to the SYDNEY date (`sydneyDate`; `13:30 GMT` on the
   21st → Sydney date the 22nd). The 2026-08 item has no docDate; its
   `Sat, 22 Aug 2026 04:55:01 GMT` → 2026-08-22, matching canon.
3. **`first-seen`** — the fetch date, when neither exists/parses.

Mechanics: `get(url, out)` captures `out.lastModified` from response
headers (cache MISS only — the header is frozen into the committed
sidecar as `lastModified`); `published`/`publishedSource` are recomputed
EVERY run via `publishedOf`, so a restamped sidecar heals in place. The
fetched-vs-published status note fires only when
`meta.fetched === todaySydney()` (today-and-only-today, so healed
restamps never spam). Canon rows keep their hand-entered `published`
stamps — a ladder/canonical divergence is a fresh-fetch note, never a
rewrite.

## Rows and cache

New wave → sidecar `{url,title,date,dateStart,sample,primaries,tpp,
firstSeen,lastModified,published,publishedSource}` (the last three per
the ladder above) + a provisional row directed at the extractor's
reviewers. Canon (verified each run via canonWaveFor):
- 2026-02: fw 16–19 Feb 2026, n=953, alp 30 lnp 19 grn 13 onp 24 ind 12
  oth 1, tpp 60/40. Sidecar: `lastModified "Sat, 21 Feb 2026 01:18:44 GMT"`,
  `published 2026-02-20 / document-date`.
- 2026-08: fw 17–18 Aug 2026, n=968, alp 29 lnp 17 grn 15 onp 26 ind 13
  oth 1, tpp 57/43. Sidecar: `lastModified "Sat, 22 Aug 2026 04:55:01 GMT"`,
  `published 2026-08-22 / last-modified`.

Both canon waves' LADDER-computed stamps reproduce the hand-entered row
`published` values exactly — the live cache-hit run must exit 0 with
`notes:[]`; a permanent published-note here means the recompute drifted.

`test-emrs.mjs` (in the npm-test chain) pins: the cached wave set, clean
parseWave == canon for both cache files, the typo line present-in-cache,
titleYmOf variants, all fieldwork
forms incl. the typo trap, federalPageOf base rules, the glued-prose
label block + nat fold + all-or-nothing + curly apostrophe, both 2PP
forms + v-ON sliced/only-v-ON/figureless, a synthetic full report, and
polls.json rows == sidecars with published stamps preserved.
79064d0 added: listFederalReports docDate fixtures (`<article>`
isolation between items, a pre-title-month docDate distrusted,
same-month-late accepted, next-article no-leak), pageCount pins,
guardNewWave fixtures (canon wave passes; `oth: 0` passes; `oth: -1`,
`onp: 71`, sample 1501 trip; a 2PP off-by-2 trips the sum check; a FUTURE
end trips — the fixture must move `dateStart` too, else the implausible-
span check fires first and errs[0] isn't the future message),
canonWaveFor (Feb exact, same-month identity past HEAL_DAYS, window
fallback, new-wave/null-date nulls), publishedOf (docDate wins, GMT→
Sydney next-day, unparseable → first-seen), and delistedCachedYms
(listed/missing/no-dir).

CI: `emrs-update.yml` poll-agent caller (probe gates the update job;
`apt_packages: poppler-utils`), 09:00–17:30 weekday comb with declared
window (EMRS stamps dates only — no clock times to measure, the Ipsos
pattern); `35 10 * * *` hand-authored daily evening line covers the
weekend landings (both 2026 waves landed Fri/Sat). agent-repair watches
`emrs-update` with `.build/emrs-repair-prompt.md`; crosstabs' weekly job
runs the backstop pass. No launchd twin — CI-only.
