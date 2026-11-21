---
name: auspol-trust-government-entry
description: auspol-tracker — filing a new wave of a trust-in-government survey (Scanlon Mapping Social Cohesion yearly, McKinnon Index, OECD rounds, AES post-election, ANUpoll quarterly) into data/trust-government.json, the hand-filed store behind the National mood Trust view. Covers the store's series/roles/modes anatomy, the verify-then-file recipe against the source PDF, and why a sample-composition change (Scanlon's 2025+ blended Life in Australia + ORU sample) is recorded in the series note, never a new mode.
source: auto-skill
extracted_at: '2026-11-05T11:00:46.725Z'
---

# Trust-in-government hand entry (data/trust-government.json)

When a new reading for a trust/confidence-in-government survey arrives
(e.g. user: "new scanlon says 31% …"), the home is
`data/trust-government.json` — hand-filed, one file for the National mood
section's Trust view. NOT polls.json; validate.mjs has no checks on it.

## Store anatomy (top of the file's `_about`)

`{ series: [ { id, house, question, measure, role, source, note, readings[] } ] }`

- `role`: `line` = ANUpoll only (draws the "Since 2020" line with its 95%
  intervals); `dot` = other surveys floated over it (Essential, McKinnon);
  `long` = draws only in "The long view" tab (Scanlon, AES, OECD).
- Every reading: `{ date: "YYYY-MM" }` = the FIELDWORK month. Optional
  `field` (printed fieldwork window), `n`, `sigChange`, `approxDate`.
  gen-data §5t (~line 2460) is a pure passthrough that only adds `x` per
  reading — no re-derivation, never pooled.
- Scanlon series has `modes`: `tel` (telephone years to 2018) vs `lia`
  (Life in Australia era). **Mode ids have renderer consequences**: in
  `rd-panels.jsx` (~:2034/2051) each mode is drawn as a separate chart
  run, and `tel` readings render as hollow dots; the long-view dek filters
  the online-era readings by `mode === "lia"`. Mode LABELS never render.
- Because the dek, chart runs and hollowing all derive from the data,
  NEVER invent a new mode id for a sampling tweak: Scanlon's 2025–26
  blend (Life in Australia + non-probability ORU panel; Scanlon says the
  time series is unaffected) stays `mode: "lia"` with the blend recorded
  in the series `note`. A new mode would split the line into a third run.
- Scanlon readings are bare `{date, v, mode}` — don't add `n`/`field`
  unless the report prints them (its sample note is ">10,000 adults").

## Verify-then-file recipe

1. Download the report PDF the user cites to /tmp:
   `curl -sL --fail -o /tmp/<f>.pdf <url>` then `pdftotext -layout`.
2. Find the figure (`grep -ni "trusted to do the right thing"` etc.) and
   read the FULL series, not just the new year: cross-check the report's
   trend values against the committed readings year-by-year (the 2026
   report's Figure 8 tail 2024: 33 / 2025: 37 matched; then file 2026: 31).
   Also check the method section — the 2026 report revealed the 2025+26
   surveys are BLENDED samples, which went into the note.
3. Edit: append `{ date, v, mode }` to the series readings; update the
   series `source` URL to the new report (figure number can shift between
   editions — Scanlon's trust figure was Figure 8 in both 2025 and 2026).
4. Nothing downstream hardcodes the level: the long-view dek
   (`rd-panels.jsx` scDek, ~:2003-2013) auto-recomputes the latest %,
   "pandemic high" fallback, and the 2010–18 tel band wording; grep the
   source files for the house name to confirm no static copy needs moving.
5. `node .build/newtracker/validate.mjs` (exits 0; the tail block is
   documented exceptions) then `node .build/newtracker/build.mjs`.
6. Verify the new reading landed in the BUILT bundle:
   `grep '"date":"2026-07","v":31,"mode":"lia"' .build/newtracker/assets/9f09dca2-*.js`
   (the bundle path — repo-root `assets/` is a different tree).
