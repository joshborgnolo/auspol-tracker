---
name: auspol-publicopinion-new-store
description: auspol-tracker — filing a survey reading onto /public-opinion/ from a source with no one-offs store yet (worked 2026-11-05, Scanlon's 2025/2026 'immigration too high' joined the immigration tracker as its sixth pollster line). The wiring surface (readStores + HOUSES, themeOf, FEATURES refs), the onlyA "one side printed" and YYYY-MM month-precision conventions, and the verification gates.
source: auto-skill
extracted_from_session: '2026-11-05T11:11:12.749Z'
---

# New source → /public-opinion/ store and tracker

When a one-off survey reading belongs on the Public opinion page and no
`*-one-offs.json` store covers its publisher (user: "add to
public-opinion" — worked case: Scanlon Mapping Social Cohesion,
2026-11-05):

## The wiring surface (all five must move)

1. **Store**: `data/<house>-one-offs.json` — shape mirrors data/essential-one-offs.json:
   `_about` (what's in/out; note what channels elsewhere), `generated`,
   `_readme` (verification provenance), `entries[]`, one entry per wave:
   `{id, waveDate, dateStart (null ok), (dateEnd), (published), (sample),
   question, notes, url, tables:[{title, source, rows:[[answer, share]]}]}`
   — recurring question = same `id` across waves.
2. **readStores** in `.build/newtracker/public-opinion.mjs` (~:52): stores
   read in three shape groups; the third (`entries`, `[label, ...values]`
   tables) fits hand-entered stores. Add `["<house>", "<house>-one-offs.json"]`.
3. **HOUSES** in the same file: `{ scanlon: { short: "Scanlon", full: "Scanlon Institute" } }` —
   used by asides/tooltips/findings AND by gen-data §8e's `pubopRowKeys`
   (matches poll rows by pollster name; a non-pollster house matches none,
   so its tracker dots just don't link).
4. **adhoc-themes.mjs**: `"<question-id>": "<topic>"` in the THEME map —
   REQUIRED, `themeOf` throws on any unmapped store id (every id is filed
   or cut; the build fails loud otherwise).
5. **FEATURES** in public-opinion.mjs per topic: a featured ref carves the
   entries out of the `more` catalogue (`used` map, through="9999"); a ref
   to a missing/wrong-striped entry throws ("no store entry").

## Printed-only disciplines learnt the hard way (2026-11-05)

- **`onlyA` series flag** (new in buildTracker): when a publisher prints
  just one side's share (Scanlon prints only the "% too high" agree
  figure), `{ house, id, label, fam, onlyA: true }` nulls b/m on its
  points. Without it "want more" would print 0% — a figure the survey
  never published. Nulls render `–` in the ledger (guards in
  rd-public-opinion.jsx's tracker ledger row and its non-net tooltip row).
  `se` is null (no sample filed) so moved()/movement sentences skip it.
  TRACKER_COPY.immigration treats the series as SILENT: `rng("b")` filters
  nulls and every() margin claims (`major`, `most`) must read no-sample/no-
  sides series as vacuously true — leaving `l.se != null &&` in `major`
  would silently degrade the head from "a majority want…" to "most common
  answer…" the moment a sample-less series joins.
  `splitOf` with the feature's shared `sides: LESS` classifies "Too high"
  to side `a` on its own; an unclassified answer stops the build
  ("unplaced answers …") unless the spec names explicit sides.
- **Month-precision wave dates**: if the report prints only a fieldwork
  month, file `waveDate: "YYYY-MM"`; NEVER fabricate a day. Three helpers
  carry it now: public-opinion.mjs `dx` treats a 2-part ISO as month-END
  (the wave-date-is-fieldwork-end contract); rd-public-opinion.jsx's
  `pubopDay` renders month-only as "**Jul** 2026" (without the patch it
  printed "0 Jul 2026"); the byRow pin in `.build/test-public-opinion.mjs`
  accepts ISO at day OR month precision (`^\d{4}-\d{2}(-\d{2})?$` — that
  test block builds fake rowKeys from EVERY store entry, so a month date
  in any store trips it).
- gen-data §8e comment/doc comments count stores ("nine"→"ten stores" in
  3 spots this landing) — grep for the number after adding a store.

## Verification gates (in order)

1. `node .build/test-public-opinion.mjs` — pins payload invariants against
   the REAL stores (tracker points inside the feature's yDomain, findings
   render, themeOf exhaustive, placement complete, byRow ISO).
2. `node .build/newtracker/validate.mjs` (tail block = documented
   exceptions), then `node .build/newtracker/build.mjs`.
3. `node .build/test-menu-lines.mjs` (the More-menu "Latest entry" date
   moves to your newest `published`) and `node .build/test-tab-pages.mjs`.
4. Inspect the BUILT payload — **watch out for stale sidecars**:
   `ls assets/oneoffs-source.*.json` can show superseded hashes from
   earlier builds. Read the hash the page actually references:
   `grep -o 'assets/oneoffs-source[^"]*' public-opinion/index.html` — then
   check `<topic>/blocks[0]` panels, `head`/`dek`/`finding.meta` in it.
5. The static article (same payload, build.mjs ~:939) lists each panel as
   e.g. "Scanlon Institute, Jul 2026: 59% want less" — grep
   public-opinion/index.html to confirm.

## Worked file list (2026-11-05)

`data/scanlon-one-offs.json` (new), `.build/newtracker/public-opinion.mjs`
(readStores, HOUSES, dx, buildTracker onlyA, FEATURES.immigration series,
TRACKER_COPY.immigration, "ten stores" comment),
`.build/newtracker/adhoc-themes.mjs` (theme + comment),
`.build/newtracker/gen-data.mjs` (comment),
`.build/newtracker/assets/rd-public-opinion.jsx` (pubopDay, ledger +
tooltip null guards), `.build/test-public-opinion.mjs` (month-precision
ISO pin). All verification passed uncommitted in the shared checkout —
per the shared-repo skills, verify `git status` cleanliness for paths you
didn't touch before any commit.

This skill is the NEW-store lane (source with no store). For NEW WAVES
of an EXISTING store — `auspol-redbridge-oneoffs-wave` covers the
RedBridge/Accent statement-energy battery work: THEME_OF curation,
the cut-theme rule and the verification probes are shared territory
(`themeOf` on every entry, the figs||prose `more` assertion, the
oneoffs-source payload probe).
