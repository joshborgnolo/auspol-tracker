---
name: auspol-glossary-terms
description: auspol-tracker — the Info panel's glossary machinery end-to-end (TERMS list in the d1a1d215 asset, ~lines 3891–4080+, entries {id, term, body:(<>…</>)}), term-to-term links via xref(to, from, label) hi-term buttons, renderers open terms with window.AP.openTerm(termId, backLabel); adding a term is ONE insertion in the TERMS list (watch the JSX voice — property-of-the-poll vs property-of-the-pollster) + rebuild; verify in built index.html with ASCII-safe greps (babel \uXXXX-escapes curly typography); commit = the d1a1d215 source + rebuilt index.html (compiles INLINE, no sidecar) — in the shared tree that means the clean-artifact route from shared-repo-session-race.
source: auto-skill
extracted_at: '2026-09-03T11:20:50.740Z'
---

# Info-panel glossary ("Info" → terms) — auspol-tracker

## Where it lives

- ONE list: `TERMS` in `.build/newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js`
  (~lines 3891–4080+, JSX source — edit HERE, never in built index.html).
- Entry shape: `{ id: "poll-lean", term: "Poll lean", body: (<>…</>) }`.
- The glossary compiles INLINE into `index.html` (function `infoTerms(D)`
  region, ~line 17086) — there is no sidecar, so an index.html commit is
  mandatory for the change to ship (see clean-artifact gating in
  auto-skill-shared-repo-session-race before committing in this shared tree).

## Machinery

- Terms open through `window.AP.openTerm(termId, backLabel)` — panels and
  table hints call it (e.g. HouseLeanPanel copy links
  `openTerm("house-effect", "House lean")`; second arg is the back-label).
- Term-to-term links inside a body: `xref("house-effect", "poll-lean",
  "its house effect")` → (to-id, from-id, label); renders as a hi-term
  button and records where the reader came from.
- Existing entries' voice (match it): prose paragraphs in en-dashes and
  curly apostrophes, mechanism-first ("the poll's own figure minus the
  weighted aggregate for the month"), and the recurring
  property-of-the-POLL vs property-of-the-POLLSTER axis — poll lean is a
  property of the one poll (sampling luck alone can produce it), house
  effect/lean are properties of the pollster (repetition is the evidence).

## Live data tables inside an entry — `.info-work` precedent (branch show-your-working, 89b91bc)

Entry bodies may embed DATA-DRIVEN JSX, not just prose: the
`weighted-aggregate` entry defines `primWork`/`tppWork` JSX blocks at
the top of `infoTerms(D)` (after `const sources = …`) and splices
`{primWork}`/`{tppWork}` after the corresponding `.info-p` spans. Data
comes from `D.showWorking`, emitted by gen-data.mjs §8b (see
auto-skill-auspol-headline-estimator for the emission contract and its
build-time self-check). Styling is `.info-work*` rules in template.html
(tabular-nums `white-space:nowrap` tables in an `overflow-x:auto` wrap,
`.info-work-sum` totals row, `.info-work-note` caption). Two lessons from
that build: (1) put every DATE-SENSITIVE claim behind a data-driven
conditional — a shattered wave-closing-date sentence was replaced by a
generic rule + a note rendered only when
`swP.rows.some(r => r.crossed)`; hardcoded dates in glossary copy rot.
(2) A 2-decimal formatter `(+v).toLocaleString("en-AU",
{minimumFractionDigits:2, maximumFractionDigits:2})` keeps row digits
aligned; `toFixed` loses trailing-zero padding differences from the
hero's conventions.

## Adding/changing a term — the 2026-09-03 worked example (commit 6edc631)

1. Insert the entry into `TERMS` (alphabetical-ish neighbours are fine;
   poll-lean/house-lean went between `house-effect` and
   `chance-consistent`). Cross-link new terms to existing ones with
   `xref` both ways where natural.
2. Rebuild: `node .build/newtracker/build.mjs` (runs validate first).
3. Verify in built index.html with ASCII-safe greps — babel emits curly
   quotes/dashes as `\u2019`/`\u2013`, so grep for ids and ASCII
   fragments (`Poll lean is sortable`, `openTerm`, the xref call
   `xref("house-effect", "poll-lean"`), NOT for "poll's own figure".
   The `{id: "…"}` keys compile to plain `id: "poll-lean"` (babel adds a
   space after the colon) — `id:"poll-lean"` with no space returns zero
   matches even on success.
4. Commit the d1a1d215 source + rebuilt index.html together, scoped to
   exactly those two paths (pathspec-commit in the shared tree).

## Cross-checks before declaring a term "undefined"

- The TABLES' hint copy (`~:3745` in d1a1d215) already explains some
  concepts in prose (Poll lean, House effect) — a hint is not a glossary
  entry; the fix is entries, not deleting the hint.
- Panels link terms before they exist (HouseLeanPanel pointed at
  `house-effect` while calling itself "House lean") — check the panel's
  `openTerm` target after adding a nearer-matching entry, but only
  retarget if the label/term semantics actually agree (deliberately left
  pointing at house-effect in 6edc631).

## fp-flows term (7c29292, Sep 2026) — first-principles ALP–ON flow set

The Labor v One Nation figure's preference table got its own term
(`id: "fp-flows"`, placed just before `preference-flows`) after it spent
one cryptic paragraph inside preference-flows and the user judged it
"not explained or clearly identified". The durable lessons:

- **Proper nouns need their own terms.** When page copy references a
  concept as a proper noun ("the first-principles flow set") and link
  text reads like a title, the xref/openTerm target must be a term NAMED
  that noun — a side-paragraph inside a neighbouring term reads as
  unidentified assertion at the end of a two-hop link chain (hero's
  "Implied from primary votes" → implied-2pp → the set).
- The term prints the three cells (Coal→ALP 31.5% ±2.5, GRN→ALP 89% ±3,
  others→ALP 53% ±3) with a LIVE worked example guarded
  `{L.onImp && prim ? … : null}` — parts read off `{prim.*}`
  (= `D.latest.primary`) and the result off `{L.onImp.*}`, so the numbers
  can never rot (proved necessary: polls moved within a day of the edit).
- Copy-trap when printing cell percentages: FP_ON's constants are the
  ALP-side COMPLEMENTS of the published ON-side shares (Coal→ON 68.5 →
  FP_ON.lnp 0.315). The constant NAMES don't say which side they sit on —
  confirm against the consumption line (`impliedOnFp` in gen-data §7f)
  before writing directions into copy. An LLM re-derivation of the sides
  from memory inverted them once in-session.
- implied-2pp's ON branch and the preference-flows entry now cross-link
  to fp-flows; preference-flows keeps only the 2025 ALP–Coalition table.

## Layout hazard — the two-column `.info` media block (12221e0, 2026-09-08)

At ≥1100px `.info` is `columns: 2` with `.info-term { break-inside: avoid }`.
WebKit reports a garbage pre-fragment `getBoundingClientRect()` for a
fragmented term, which silently broke the preference-flows chart's hover
in Safari only. Chart-bearing terms MUST keep
`.info .info-term:has(.info-chart) { column-span: all; }` in
template.html (with the chart directly inside an `.info-chart` wrapper —
if that wrapper class changes, the selector must change with it). Full
quirk anatomy + WebKit probing recipe: auto-skill-auspol-webkit-multicol-hover.
