---
name: auspol-cycles-url-state
description: auspol-tracker — main-page URL query-param state all lives in ONE asset (d1a1d215, the tabbed-views layer). The past-cycles tab serialises hidden/lifted terms as a base-36 BITMASK over CYC_META order (?c=b<mask>[-<mask>], shipped inside 8ed7918, 2026-09-19) replacing the legacy dotted-year lists (still parsed for old links); CYC_META must stay append-only or every shared link silently re-decodes. Same scheme later that day for the All-polls multi-selects: w= and h= are now b-prefixed base36 bitmasks over a frozen URL_HOUSES (12 houses, append-only) and POLL_TAGS order — legacy comma-joined values still parse. The `l` param belongs to the All-polls lead filter (a|l|o) since 8ed7918 — the old cycles writer deleted it unconditionally and clobbered archive state across tab switches. Round-trip tests slice the shipped fns out of the asset (test-cycles-url.mjs, test-allpolls-url.mjs).
source: auto-skill
extracted_at: '2026-09-19T00:00:00.000Z'
---

# auspol URL state — one file, one bitmask format, one collision to remember

## Where everything lives

All main-page query-param state lives in exactly ONE file:
`.build/newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js` (the
tabbed-views JSX layer). Two independent writer effects, both
`React.useEffect` + `history.replaceState` with a no-op guard, both
re-parsing `location.search` so foreign params survive:

1. **PastCyclesView** (`c=` — and *formerly* `l=`) — hidden and lifted terms.
2. **AllPollsView** (`q w t h v l f s` + legacy words `who when has vs lead
   view scope`) — the archive filters. Its writer deletes its OWNED list and
   writes only non-defaults; legacy spellings are read then normalised away.

Reads happen ONCE at mount (`useState` initialisers); there is no popstate
subscription. Tab selection is `#snapshot|#cycles|#allpolls|#info` (readHash
in the 73de0c58 layer). Satellite pages use none of this (`/feedback/ ?msg=`,
`/prediction/` `#<asOf>` hashes).

## The cycles bitmask format (current, shipping since 8ed7918)

`?c=b<hiddenMask36>[-<liftedMask36>]`
- Bit *i* ⇔ the *i*-th row of `CYC_META` (`gen-data.mjs`), year-sorted,
  exposed client-side as `D.cycles[].year`. 21 terms as of 2026-09
  (1972…2025), so ≤4 base-36 chars today.
- Hidden (not-shown) terms are what's serialised — "show all" is the
  default and the param vanishes entirely when both masks are empty.
- Hidden MAY include the current term; lifted never does (stripped on
  restore; the lift UI can't produce it).
- Lift-only state writes `b-<lift>` (empty hidden segment). `cycPack`
  returns null when both masks are 0 (param omitted).

Parser/writer pair: `cycBits` / `cycUnpack` / `cycPack`, defined beside
`cycYears` inside PastCyclesView; grammar
`/^b(?:([0-9a-z]{1,6}))?(?:-([0-9a-z]{1,6}))?$/`; bit checks use
modulo/`2**i` (JS bitwise ops break past 31 bits).

## The archive bitmask format (w=, h= — shipped after the cycles one)

`?w=b<mask36>` (pollsters) and `?h=b<mask36>` (data-content tags), generic
helpers `archMask(order, set)` / `archUnpack(raw, order)` at module scope
beside POLL_TAGS in d1a1d215. Grammar `/^b[0-9a-z]+$/` — a mask can never
be mistaken for the comma-joined legacy values because every house name
carries a space or `&` and no tag id is `b`+base36. Two frozen orderings:

- `URL_HOUSES` — the 12 displayed base houses in their alphabetical pill
  order at ship time (Agenda C Synesis … YouGov). **Append new houses at
  the END in arrival order, never re-sort** — the live `houses` list is
  re-sorted every mount, so the mask can never key off it. Base-house
  mapping (`(MRP)`/`(SMS)` stripped) applies on the legacy path only; the
  frozen list already holds base names.
- `POLL_TAGS.map(t => t.id)` — the 9 tag ids, append-only like CYC_META.

The reader (`urlInit.who`/`has`) tries `archUnpack` first and falls back to
the legacy comma split; both results are still filtered against the live
list (stale names/bits dropped, never trusted). The writer emits masks
only; empty sets omit the param entirely (the `if (sel.size)` /
`if (tagSel.size)` guards — `archMask(∅)` returns `"b0"`, never written).
Legacy verbose keys (`who`/`has`) and the OWNED scrub list are unchanged.
Test: `test-allpolls-url.mjs` — same slice-and-eval technique, plus a live
cross-check that every house in the 9f09dca2 data asset has a bit (a
house landing without a URL_HOUSES append fails loudly).

## THE contract that must not break

**CYC_META is append-only.** The next election adds a NEW HIGH BIT (2028 =
bit 21). Never insert, reorder, or renumber rows — bit↔term mapping is the
interchange format of every shared link already out there. Unknown high
bits decode to nothing (forward-tolerant by design). Same "drop unknown
tokens, never trust" policy as the legacy parser.

## Back-compat with pre-bitmask links (read-only, normalised on write)

Legacy `c=1972.1974.….01.10.25`: 4-digit years are literal, 2-digit tokens
are this-century (`90` → 2090 → dropped, which is why pre-2000 terms wrote
themselves out in full); dot OR comma separators; unknown years dropped.
Legacy lifts rode a separate `l=` param in the same year grammar. Both
still restore in `urlCyc` (new form tried first — legacy values can never
match `^b…` since they're digits/dots only), and the writer emits only the
packed form. Same migration idiom as the archive's short scheme.

## The `l` collision (fixed 8ed7918 — remember the ownership)

`l` was double-owned: cycles lifts AND the All-polls lead filter (`a|l|o`).
Both writers deleted `l` before writing, so tabbing clobbered the other
view's state. Fix: cycles lifted terms moved INTO `c`; the cycles writer
deletes `l` only when year-shaped (`/^[0-9.,]+$/`); lead letters are left
alone. `l` now belongs to the archive. If you ever need a new cycles
param, take a fresh letter — do NOT reclaim an archive key.

## Testing technique (reusable pattern for this repo)

`.build/newtracker/test-cycles-url.mjs` — the fns only exist inside a
React layer closure, so no import works. The test:
1. Finds the asset by CONTENT (`const cycBits =` marker) not filename —
   hash names in the layer path are stable but content-search survives
   renames.
2. Slices the source from `const cycBits =` to `const currentYear` and
   evals it via `new Function("cycles", slice + "; return {…};")` with a
   `[{year, current}]` array standing in for `D.cycles`.
3. Derives `cycles` from CYC_META parsed out of `gen-data.mjs`
   (`/\{ year: (\d{4}),/g` between `const CYC_META = [` and `];`) — the
   bit↔term mapping is checked against the REAL list, so a term-list
   edit that silently misaligns links fails the test.

Run: `node .build/newtracker/test-cycles-url.mjs` (un-wired; repo has no
URL-state test harness — standalone scripts are the convention, like
test-np-score.mjs). Assertions cover pack contract, round-trips
(empty/all-hidden/lift-only/mixed, the reported 19-hidden-term URL),
legacy grammar (2-digit/4-digit/commas/dropped unknowns),
legacy→repack→restore lifecycle, unknown-high-bit tolerance, and the
`l`-scrub guard regex.

## Session history footnote

Feature code (copy fix `ppmm "net preference"→"prime minister"` + this
URL rework) was SWEPT into the sibling session's commit 8ed7918 mid-edit
(`${edit tool}` failed on mtime — the tripwire); the test file was the
only piece left un-swept and shipped as 83f4e38. Recovery was just
verify-coherence-and-commit-the-remainder, per `shared-repo-session-race`.
