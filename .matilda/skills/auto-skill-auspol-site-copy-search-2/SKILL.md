---
name: auspol-site-copy-search
description: auspol-tracker — locating a piece of user-facing copy's source of truth before editing. Live copy homes are ONLY template.html, build.mjs, gen-data.mjs and .build/newtracker/assets/ (rd-*.jsx AND hashed-*.js are both source, concatenated by build.mjs ~:84-93); index.html hits are the compiled bundle. Repo-wide greps drown in OCR-corpus noise (data/trove-text.jsonl, .matilda/bulletin-gallup/issues/*.json) and stale DECOY clones under .matilda/ (redesign-port/ carries the same hashed-asset filenames + its own index.html, snap-faq-260905/, redesign-preview/) — scope the grep to the live homes, then verify on the rebuilt bundle (worked 2026-09-27, the turned-out→ousted rename)
source: auto-skill
extracted_at: '2026-09-27T13:12:56.766Z'
updated_at: '2026-09-30'
---

# Locating user-facing copy in auspol-tracker (grep recipe)

Worked 2026-09-27 during the `turned out` → `ousted` rename: a naive
workspace-wide grep for a copy string printed tens of thousands of OCR
words before the live source turned up. The drill below finds copy's true
home fast.

## The ONLY live copy homes

- `.build/newtracker/template.html` — page shell: inline copy, CSS
  comments, static `<head>` copy.
- `.build/newtracker/build.mjs` — the static-summary article
  (`buildStaticSummary()`), injected `<head>` metas.
- `.build/newtracker/gen-data.mjs` — data-pipeline strings (card subs,
  method copy emitted with the dataset).
- `.build/newtracker/assets/` — BOTH `rd-*.jsx` (the redesign's layer
  sources: rd.jsx, rd-hero, rd-panels, rd-polls, rd-cycles, rd-allpolls,
  wm-story) AND the hashed `*.js` layers (e.g.
  `d1a1d215-370c-…js`, `08b413e7-…js`, `73de0c58-…js`) are SOURCE FILES,
  concatenated by build.mjs in the order listed there (~:84–93). A hashed
  layer is not generated from a .jsx sibling — edit it directly, with the
  same-file-edit-sequencing rule (one edit per file per turn).
- `index.html` hits are the COMPILED BUNDLE — never edit it; verify there
  (auspol-built-html-verification), then fix the source and rebuild.

Grep those paths only:

```
grep -rn "copy string" .build/newtracker/template.html \
  .build/newtracker/build.mjs .build/newtracker/gen-data.mjs \
  .build/newtracker/assets/
```

## Repo-wide greps drown — exclude the noise first

A workspace-wide `grep "turned out"` returned 13 hits, of which the
signal was 7 lines: two live assets plus duplicates inside stale
`.matilda/` clones. The noise classes, in order of volume:

1. **OCR corpus** — `data/trove-text.jsonl` (~460 multi-paragraph
   newspaper articles, one per line) and
   `.matilda/bulletin-gallup/issues/*.json` (whole-issue OCR blocks).
   Any common English phrase hits them. Exclude `trove-text` and
   `bulletin-gallup` — or scope the grep to the live homes above and
   skip exclusion games.
2. **Stale full clones under `.matilda/`** — these LOOK like real
   sources; several contained decoy `index.html` and asset copies about
   1000 built lines behind:
   - `.matilda/redesign-port/` — a complete old `.build/newtracker/`
     tree (same hashed-asset filenames!) plus its own `index.html`.
   - `.matilda/snap-faq-260905/` — stale `d1a1d215.js` +
     `index-my-stale-build.html`.
   - `.matilda/redesign-preview/` — hand-preview HTML screens.
   A "copy still found after my edit" scare is usually a decoy hit in one
   of these. Check the path, not the hit count.
3. **Spec/prose docs** (e.g. `.build/citation-check-spec.md`) and
   **internal code comments** — words in running prose, not copy. Only
   edit if the word itself is being standardised as a term of art; the
   2026-09-27 drill deliberately left a `TURNED OUT` comment in
   d1a1d215 ~:3022 and prose in the citation spec alone.

## After editing: rebuild and assert on the built bundle

`node .build/newtracker/build.mjs`, then on `index.html`:

- `grep -c "<old string>"` → **0**
- `grep -c "<new word>"` → the expected count
- Plain-ASCII search words appear literally in the bundle; curly
  typography (’, —, “”) has been babel-escaped to `\uXXXX` — see
  auspol-built-html-verification before concluding anything is absent.

## Standardising a term of art: the "others & independents" rename

Worked 2026-09-30 (commit af96f41): `others/independents` →
`others & independents` everywhere the site names the stray party.
Three lessons beyond a plain word sweep:

1. **The standard is permanent.** The party's prose name is now
   `others & independents` — lower-case in deks and running prose
   (`voters for others & independents`), capitalised
   `Others & independents` in titles (`RD_TREND_NAME`). All FUTURE copy
   naming that party takes this form; never reintroduce the slash.
2. **The name is GENERATED in several spots, not just written in
   prose** — a party-rename sweep must hit the generator functions too,
   or the old form returns the day that panel renders a fresh wave.
   2026-09-30 homes:
   - `rd-panels.jsx` — `RD_DEMO_HOME` oth line (~:1137),
     `RD_TREND_NAME` + `RD_TREND_NAME_DEK` (~:1173-4), `pName` in the
     composition-trend story (~:1279), prose at ~:1395.
   - asset `a11e1559-…js` — `firmWho(k)` (~:1710), `DEMO_VOTE_FOR.oth`
     (~:2179), the demographics label map's `Others` entry (~:2592).
   `replace_all` on both the lower- and capitalised forms catches the
   lot; two passes.
3. **Internal-only strings stay.** The Newspoll extractor's guard
   `missing others/independents bucket` (.build/extract-newspoll.mjs:590)
   is CI-log output, never user-facing — deliberately left with the old
   spelling, same rule as the `TURNED OUT` comment above.

Verified live: `grep -c "thers & independents"` on https://auspoltracker.com/
→ 11, slash form → 0 (search the `thers` substring; it sidesteps
worrying about how the ampersand/entity was emitted).

## Per-copy-stream skills to consult FIRST

Some copy already has a multi-home map — check before rolling your own
grep: auspol-strapline-copy (ELEVEN homes / three systems),
auspol-copy-two-homes (method bodies + disclaimers), auspol-past-cycles
(outcome vocabulary, rd-cycles.jsx second layer), auspol-tagline-break,
auspol-glossary-terms (Info panel), auspol-static-summary-tables.
