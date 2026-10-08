# Locating user-facing copy in auspol-tracker (grep recipe)

> **The classic design is ARCHIVED (frozen 2026-10-08)** — the `rd ===
> false` branches reachable via `?design=old` (MATILDA.md rule 5). A copy
> string that exists in both designs needs editing in the redesign path
> only; leave the old-design copy exactly as it stands.

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
  layer is not generated from a .jsx sibling — edit it directly.
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
   Any word in English hits them. Exclude `trove-text`, `bulletin-gallup`
   — or scope the grep to the live homes above and skip exclusion games.
2. **Stale full clones under `.matilda/`** — these LOOK like real sources;
   several contained decoy `index.html` and asset copies about 1000 built
   lines behind:
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

## Per-copy-stream skills to consult FIRST

Some copy already has a multi-home map — check before rolling your own
grep: auspol-strapline-copy (ELEVEN homes / three systems),
auspol-copy-two-homes (method bodies + disclaimers), auspol-past-cycles
(outcome vocabulary, rd-cycles.jsx second layer), auspol-tagline-break,
auspol-glossary-terms (Info panel), auspol-static-summary-tables.
