---
name: auspol-undecided-basis-display
description: auspol-tracker — undecided-share basis system end-to-end (pollsterRules.tppIncludesUndecided flag → gen-data undecidedOf derivation with 3 bases tpp/first/soft → SINGLE renderer note site in PollLedger/tppLines, reached by BOTH expanded views). Shipped via foreign commit 7a3451f (2026-09-02), which landed the "undecided N% inside the pair" 2PP-line note.
source: auto-skill
extracted_at: '2026-09-02T00:00:00.000Z'
---

# Undecided-share basis display (auspol-tracker)

Task origin (2026-09-02): "essential 2pp should say explicitly the undecided percent
in expanded poll table figures." Shipped inside foreign commit `7a3451f` ("Set expanded
poll-breakdown figures in Archivo"; its message credits "the pending undecided-share
change" — see the absorption note at the bottom).

## The three bases

`undecidedBasis` on a poll row means WHERE the uncommitted share went:

- `"tpp"` — Essential. Its published 2PP pair sums to <100 because undecideds are
  still INSIDE the pair. Flag lives at `data/polls.json` line ~28:
  `pollsterRules.Essential.tppIncludesUndecided: true`. The undecided % is DERIVED
  downstream, never stored on the poll row.
- `"first"` — Roy Morgan. Undecideds are set aside before primary votes are reported;
  `undecided` is a stored row field.
- `"soft"` — Resolve. Not-firm share; stored row field, different wording.

## gen-data side — usually needs NO change

`.build/newtracker/gen-data.mjs` ~760–790: `undecidedOf(p)` already derives Essential's
share as `100 - (tpp_alp + tpp_lnp)` when the gap exceeds `TPP_UNDECIDED` (0.5),
tagging basis `"tpp"`. Both payloads already spread `undecided`/`undecidedBasis`:
`individualPolls` (~line 899) and `pollsterTable` (~line 972). Surfacing a new
undecided display is a RENDERER-ONLY job — verify by grepping the built boot data
for a known row before touching gen-data.

## The ONE renderer site — an edit in a11e1559 reaches BOTH expanded views

`.build/newtracker/assets/a11e1559-f455-44d5-8a31-6699de4ef310.js` holds the single
implementation: `PollLedger` / `tppLines(cs, r)` / `TppLine` (~lines 1440–1990,
adjacent to `tppContests`; see the auspol-tpp-pair-labelling skill). The archive
asset `d1a1d215-…js` consumes these via window exports — DO NOT make a parallel edit
in d1a1d215; one change serves both the Latest-polls and All-polls expanded rows.

Current placement logic (post-7a3451f):

1. **Basis "tpp" (Essential): the share is named on the 2PP pair's OWN line**, never
   in the first-preferences tail. In `tppLines`, after the existing `canonical` note
   computation:

```js
const dUnd = r.undecidedBasis === "tpp" && r.undecided != null ? segDelta(r.chg, "und") : null;
// inside the contest loop:
let note = canonical ? "respondent-allocated" : null;
if (c.kind === "2pp" && !c.derived && r.undecidedBasis === "tpp" && r.undecided != null) {
  note = (
    <React.Fragment>
      {note && <React.Fragment>{note}, </React.Fragment>}
      undecided <b>{r.undecided}%</b> inside the pair
      {dUnd && <React.Fragment>, <ChgTag v={dUnd.v} refDate={dUnd.refDate} /></React.Fragment>}
    </React.Fragment>
  );
}
```

   Note the note-MERGE pattern: prepend the existing `"respondent-allocated"` string
   with `", "` separator when both apply — key everything on contest kind + basis,
   NEVER array index (derived 3cp pairs shift positions; same trap as the
   `auspol-tpp-pair-labelling` skill documents). Renders as
   `48% ALP (▲2) vs 47% L/NP (▼2) (undecided 5% inside the pair, ▼1)`.

2. **First-preferences tail** (same asset, ~line 1985): gated
   `{r.undecided != null && r.undecidedBasis !== "tpp" && …}` — the moved share is
   excluded so it isn't reported twice. Basis wording ternary:
   `r.undecidedBasis === "soft" ? "not firm" : "set aside"`. Roy Morgan renders
   `· undecided 6.5% (set aside, –)`; Resolve would say "not firm".

## Verify

- Rebuild: `node .build/newtracker/build.mjs` (validator runs inside).
- Built `index.html` greps: `grep -o 'inside the pair' index.html | wc -l` → 2
  (this note literal + the Info-glossary "Undecided" term in the d1a1d215 asset,
  ~line 2911); `grep -c 'undecidedBasis !== "tpp"' index.html` → 1.
  Babel escapes non-ASCII in the bundle — grep ASCII fragments only.
- Headless probe (scratch, untracked): `.matilda/verify-ticker/probe-tpp-undecided.mjs`
  — serve a build on :8760 (`python3 -m http.server 8760`), open archive, search +
  click-expand `tr.poll-row.arch-row`, read `section.pd-sec` blocks (label `.pd-k`)
  inside `.pd-simple`. Asserts Essential's 2PP section names "undecided N% inside the
  pair" and its primaries omit it; asserts the Roy Morgan reverse. SELECTOR TRAPS hit
  live: the search input is `input[aria-label="Search polls"]`; a MULTI-contest row's
  2PP section is labelled "After preferences", a single-contest row's is
  "Two-party preferred" — match both (`/Two-party preferred|After preferences/`) or
  a Roy Morgan 3-contest row fails its own regression check.

## Foreign-absorption note (shared repo)

This edit was absorbed mid-task by foreign co-authored commit `7a3451f` — proven by
`git show HEAD:<asset> | grep -c 'inside the pair'` = 1 and an empty
`git diff` on the asset. Per the shared-repo-concurrency skill: do NOT rewrite their
commit, do NOT commit an empty duplicate; `index.html` regen dirt left in the tree
was foreign WIP. Working scratch probes under `.matilda/verify-ticker/` stay untracked.
