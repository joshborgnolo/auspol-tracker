---
name: auspol-noagg-aggregate-excluded-row
description: "auspol-tracker — filing a poll row that DISPLAYS in the All-polls archive but joins NO aggregate (the NO_AGG_HOUSES suffix pattern), worked 2026-10-09 TWICE: Roy Morgan finding 10341's 7-month pooled cross-section (7d272f2, 'Roy Morgan (pooled)') and Newspoll's ~11-week quarterly aggregates (a5822c6, 'Newspoll (pooled)', two waves + seven-dim demographic tables handed to auspol-demographics-hand-entry). FIVE homes move in lockstep: gen-data NO_AGG_HOUSES + NO_AGG_NOTE map + houses-inventory fold regex, validate.mjs KNOWN_POLLSTERS, test-allpolls-url.mjs baseHouse regex, rd-allpolls.jsx detail-rail note (p.noAggWhy || SMS-sentence fallback). Use for one-off releases a normal row would poison the estimator with: multi-month pooled averages, SMS/selection-bias marketing polls, state-only federal houses (fourth case EMRS (Tas), 6525c0a — a no-base NEW house: suffix fold regexes stay untouched, housesTracked +1 beside pollsTracked, URL_HOUSES grows bit 18 instead of only the baseHouse alternation, altTpp rides the row cleanly). The ' (suffix)' label folds to the base house everywhere ' (MRP|SMS)' already did — extend every '(MRP|SMS)' regex, don't invent a new string."
source: auto-skill
extracted_at: '2026-10-09T00:00:00.000Z'
---

# Aggregate-excluded poll rows (NO_AGG suffix houses)

Worked 2026-10-09: Roy Morgan finding 10341 ("Voting Intentions by
Country of Birth") carried an all-electors reading — ALP 34, ONP 24,
L-NP 22, GRN 13, Ind/Oth 7, **pooled Jan–Jul 2026 (n=26,418)**,
published 15 Sep 2026. A seven-month pooled average sits across ~30
weekly estimator waves and drags every aggregate it joins backwards, so
it lands in the All-polls archive EXCLUDED from all of them — the
pre-existing `Roy Morgan (SMS)` precedent (NO_AGG_HOUSES) generalised
into a per-house system, shipped as **7d272f2**.

**SECOND INSTANCE, same day, commit a5822c6**: "Newspoll (pooled)" —
Newspoll's ~11-week quarterly aggregate releases (2025-09-11 n=3,811,
2025-11-20 n=3,774), user-requested ("can be added in the same way that
the pooled Roy Morgan has been"). Every home moved exactly as the
checklist below prescribes; the house-inventory and test-allpolls-url
regexes already carried the `(MRP|SMS|pooled)` alternation, so only
NO_AGG_HOUSES + NO_AGG_NOTE (note: "Because this release averages about
ten weeks of interviewing into a single reading…") and validate.mjs
KNOWN_POLLSTERS needed code edits. These rows ALSO carried a full
seven-dim subpopulation table — pair this filing with the
auspol-demographics-hand-entry recipe (NEWSPOLL_DEMO constant + reader
loop) when the release prints one.

**THIRD INSTANCE, same day, commit 2cdf26d**: "RedBridge/Accent
(shifts)" — Accent's April 2026 super-poll report (fieldwork 6–19 Mar
2026, n=5,563, sampleEff 4,614) published state + demographic
breakdowns only, **no national headline figures at all** (Poll Bludger
confirmed none exists), so averaging it would still poison the
estimator window the wrong way and the row files as the FIRST
ALL-NULL-FIGURES NO_AGG row: every share AND both tpp keys `null`.
Two NEW knock-ons over the pooled cases:

- **The RSS feed needs a null guard BEFORE the row goes in.**
  `build.mjs`'s `head` derivation (~:1186) chains `shareLine(p)` for
  the feed item title; on an all-null row it produced an empty string.
  Fix shipped in the same commit: `const prim = shareLine(p)` then the
  head falls through with `prim || (…)`, and the `parts.push` calls
  for Primary vote / Two-party preferred are guarded by `if (prim)`.
  Checklist item for any future all-null row: probe `feed.xml` renders
  the item with a sensible headline, not an empty one.
- **The suffix family grew a fourth alternation.** The houses-inventory
  fold regex (gen-data ~:4189) and test-allpolls-url.mjs `:57`
  baseHouse regex both now read `(MRP|SMS|pooled|shifts)` — when
  adding the next suffix, grep for BOTH regex homes; they are the two
  that drift silently.
- NO_AGG_NOTE records the no-headline fact itself: "Because this
  super-poll release (n=5,563) published state and demographic
  breakdowns only - no national headline figures - it does not count
  towards any aggregates."
- `client: "—"` renders "Self-published" in the bundle as usual;
  the three EARLIER RedBridge rows carrying `methodUrl` to the same
  report PDF rode along in the same diff — a NO_AGG commit can sweep
  adjacent one-field row fixes if they're part of the same source
  documentary.

**FOURTH INSTANCE, 2026-10-09, commit 6525c0a**: "EMRS (Tas)" — two
Tasmanian-only federal waves (16–19 Feb, n=953; 17–18 Aug, n=968)
hand-entered verbatim from EMRS's own PDFs (irregular house, no
extractor; figures from EMRS only, Wikipedia/Bonham as cross-checks).
First noAgg house whose parenthetical is NOT a base-house variant —
`(Tas)` names a state, and EMRS has no national base to fold into — so
three lockstep homes behave DIFFERENTLY from the suffix cases:

- **The suffix fold regexes stay untouched.** Do NOT add `Tas` to
  `(MRP|SMS|pooled|shifts)` — `EMRS (Tas)` IS the house; nothing to
  fold. `housesTracked` legitimately moves 12→13 beside pollsTracked
  174→176, so the second-instance "deep-diff = pollsTracked +N ONLY"
  check generalises to "+1 house iff the row is a wholly new house
  without a national base". The static-summary "N polls by M houses"
  copy bumps with it — several expected index.html hunks.
- **A genuine new house grows URL_HOUSES a bit while `baseHouse`
  stays**: "EMRS (Tas)" appended as the 18th entry ("display-only
  no-aggregate houses still get bits so their archive links survive")
  and the test's frozen list re-pinned 18-strong. The suffix cases
  instead extended only the `baseHouse`/(MRP|SMS) alternations and
  left URL_HOUSES alone.
- **altTpp rides a noAgg house fine.** EMRS prints ALP-v-One-Nation
  (60 Feb, 63 Aug): `altTpp` rows keyed `date|EMRS (Tas)` render on
  the row and the RSS item ("Other two-party contests: ALP 63 – ON
  37") while altRowsFor/driftOnResid's `noAggPoll` gates keep them out
  of every series — no extra exclusion needed.
- **Defensive containment ships filter-side.** gen-data's
  undecidedRows gained `!noAggPoll(r.p)` in the same commit (GF-1 —
  no-op today, EMRS prints no undecided share): any FUTURE consumer
  reading rows straight off POLLS must compose with noAggPoll, not
  trust row flags downstream.
- **Feed-window side-effect when the wave is recent.** A noAgg wave
  whose date falls inside the 40-item RSS window enters the feed AND
  evicts the oldest item (here an Ipsos issues item): feed.xml diffs
  as a ±1 item pair, not the pooled cases' pure +1.
- Hand-entry provenance: file only what the house's own document
  states; EMRS's May-2026 omnibus was state-only and deliberately
  out of scope (no federal figures = no row at all).

## When a row gets this treatment

Ask: would this row mis-state the CURRENT aggregates if the estimator
counted it? Multi-month pooled cross-sections and SMS/selection-bias
basic-campaign polls = yes. Ordinary weekly/fortnightly waves = no
(they're just rows; see auspol-pollsjson-schema). Display-only rows
still render fully in the archive (figures, links, month groups) and
generate an RSS item; they stay out of: tpp/implied/primary/alt/leader
aggregates, pollsterTable, the Latest table's provenance set, houses
inventory (`housesTracked` stays 12).

## The FIVE homes (all five, in lockstep — verified 7d272f2)

1. **`.build/newtracker/gen-data.mjs`** — the set + note + emitters:
   - `const NO_AGG_HOUSES = new Set(["Roy Morgan (SMS)", "Roy Morgan
     (pooled)"])` (~:117, comment explains the exclusion logic lives by
     LABELLING, so the same house name never aggregates).
   - NEW `const NO_AGG_NOTE = { "House (suffix)": "Because …" }` map
     right beside it — pre-10341 the row just flagged `noAgg: true` and
     the DETAIL RAIL always quoted the SMS selection-bias sentence as
     THE reason, which is false for a pooled window. Add your house's
     own causal sentence (one sentence, "Because …", no trailing
     apology).
   - BOTH row emitters spread the flag: `{ noAgg: true, noAggWhy:
     NO_AGG_NOTE[p.pollster] }` — individualPolls (~:2871 region,
     inside the row object) AND pollsterTable (~:3129 region). Emit
     parity matters; check both.
   - Houses-inventory fold (~:4140): `p.pollster.replace(/ \((MRP|SMS|
     pooled)\)$/, "")` — APPEND the suffix here or `housesTracked`
     counts the display row as a 13th house.
2. **`.build/newtracker/validate.mjs`** — `KNOWN_POLLSTERS` (:47
   region): add the exact `"House (suffix)"` string with a one-line
   comment naming the finding, or validate fails with
   "unknown pollster" (and the documented-exceptions count drift can't
   hide it — CI tails the log).
3. **`.build/newtracker/test-allpolls-url.mjs`** — `baseHouse` regex
   (:57): same `(MRP|SMS)` alternation the data asset feeds through for
   the frozen URL_HOUSES ordering. Extend it; the "every live house has
   a bit" assertion then passes. NOTE: this test has a PRE-EXISTING
   independent failure ("URL_HOUSES is the pinned 12-house list",
   identical on a pristine baseline) — don't chase it; if you suspect
   YOUR edit broke it, stash your worktree edits and re-run to prove
   the baseline.
4. **`.build/newtracker/assets/rd-allpolls.jsx`** — the detail-rail
   note (~:1701-1704): `{p.noAggWhy || "Because SMS polls have a strong
   selection bias, they do not count towards any aggregates."}` — the
   `||` fallback preserves the SMS consumer when a row has no recorded
   note. Keep this exact fallback expression; don't branch on
   `p.pollster` here.
5. **The row itself, `data/polls.json`** — normal row shape
   (`auspol-pollsjson-schema`), with the conventions verified for
   10341: `date` = LAST day of the fieldwork window ("2026-07-31" for
   Jan–Jul), `dateStart` = window start ("2026-01-01"), `published`
   with clock time ("2026-09-15T16:39"), `pollster` = the full suffixed
   label, `client: "—"` (renders as Self-published), figures present,
   `oth: null` + `tpp_alp/tpp_lnp: null` when the release prints none
   (the IMPLIED readings still land in the emitted payload as
   `yd.alpImp`/`alpOnImp` — null published 2PP does not suppress them),
   `url` to the source. Insert date-sorted; serialisation stays
   byte-identical (`JSON.stringify(D, null, 2) + "\n"` — let the build
   or the same helper write the file, never hand-format).

## Build + verify checklist (what "green" looked like for 10341)

- `node .build/newtracker/build.mjs` (runs validate): polls 168→169,
  0 errors, exceptions 268 unchanged.
- **Data-asset probe** on `.build/newtracker/assets/9f09dca2-<uuid>.js`:
  row present at the right date position with `noAgg:true`, your
  `noAggWhy` text, figures intact, client rendered "Self-published",
  `ym`/`field` labels ("1 Jan–31 Jul"), `published` string, `url`+links
  present; ABSENT from `pollsterTable` rows; the `Roy Morgan (SMS)` row
  untouched; implied values computed.
- **`assets/auspol-now.json` deep-diff = `$.latest.pollsTracked` +1
  ONLY** — if anything else moved, a fold regex or payload flag is
  wrong.
- `feed.xml` gains one item (`House (suffix), <window> – <figures>`
  headline form — the one-item-per-house-date rule); housesTracked
  still 12 in the built `index.html` copy; the pollster list line there
  gains the label.
- Commit carries: data/polls.json, the five code-home files,
  `index.html`, the `9f09dca2-*` data asset, `feed.xml`,
  `assets/auspol-now.json` — never `git add -A`
  (git-prestaged-commit-sweep). Pushed as a worktree sidecar job
  (auspol-worktree-scratch-files) because the main checkout held a
  sibling's in-flight WIP; a clean checkout can ship the same file set
  straight from main.

## Failure modes seen

- First gen-data edit missed exact-match because the clean file's
  comment text differed from memory — read the actual lines before
  editing; the `NO_AGG_HOUSES` block and its comment sit adjacent with
  no blank line.
- Forgetting the test-allpolls-url `baseHouse` regex: the URL bitmask
  mapping drifts silently until the fixture test fails on the NEXT
  house's add (it pins the live house list against URL_HOUSES).
- The pre-existing `URL_HOUSES` pinned-list failure is NOT yours —
  verify on a pristine baseline (stash → rerun → unstash) before
  owning any test red.
