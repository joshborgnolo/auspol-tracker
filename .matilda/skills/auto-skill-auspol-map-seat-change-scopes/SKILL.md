---
name: auspol-map-seat-change-scopes
description: auspol-tracker /map/ — when the Winner head's seats change under-line is missing or wrong under a figures scope (st:/cls: on a now frame), or the moved-seats note shows where it shouldn't. Since 92224d04 (2026-11-07) scopeSeatBase derives the base election's per-scope family counts by reverting the overlay's own changes[] chains (first "from" in, last "to" out) off the scope's current tallies — an overlay never moves the seat set, only holders. seatBase stays the aus-scope path; election frames deliberately keep aus-only bases. Trap: FAM("CSA") === "ind" and csa exists only inside holdFam — any change-code→fam mapping outside hold rewrites must mirror that carve. Same head (67f31034): the NOW_AUS_DEK moved-seats note renders only while every seat it names sits inside the figures scope ({t, seats}, gated in seatStat).
source: auto-skill
extracted_at: '2026-11-07T02:25:50.129Z'
---

# /map/ — the Winner head's seats change under-line and its scoped bases

Worked 2026-11-07 (commit 92224d04) on the user report "the NSW figures
view should have seat deltas under the seat figures — the coalition lost
two NSW seats — likewise rural view, both are rural seats". Both premise
checks verified against frame data (New England + Farrer are NSW AND cls
Rural in core-2025.json). Read this before touching the seats row's
change line, scoped bases, or change-code fam mapping anywhere.

## The line and its two base paths

- `seatStat` (app-4-story.js) renders the seats grid with an optional
  under-line: `row("st-seats", seats, base ? ([f,n]) => change(f,n) : null)`.
  `change(f, n)` needs `base = { y, c }` — base-election family counts in
  the SAME fam vocabulary as `cnt` (holdFam keys: alp/lnp/grn/ind/csa/onp/oth).
- `base` is scope-contingent in seatStat:
  - **aus scope** → `seatBase(m, st)` (pre-existing): federal frames read
    `SUM.seats[pv][st]` from summary.json, state elections read
    `META_FACTS.mix[pv]`; `pv` is `NOW_OF[y]` on a now frame (the overlay's
    own base election), else the previous stop on the frame's row.
  - **st:/cls: scope on a now frame** → `scopeSeatBase(m, statSel, idx, cnt)`
    — see below. On election frames it returns null: scoped bases stay
    now-frame-only (a cross-election scoped base would compare two seat
    sets that redistribution can move; aus keeps using seatBase as before).
- `sgn(delta, 0)` renders zeros as "0" — that is the aus line's existing
  convention and deliberately stays for scoped bases; a scope with no
  in-scope chain renders a zeros line, same shape as `aus` already shows.

## scopeSeatBase — revert the overlay's own changelog

On every now frame (`now`, `nswnow`, `qldnow`, `wanow`), `m.changes` —
populated by applyNow from `map/data/data-now*.json` — is the frame's OWN
ledger of holder movements `{div, date, kind, who, from, to, text}`. The
base-election family counts inside ANY scope are derivable without any
summary.json lookup:

1. Restrict to chains whose seat is in the scope (`m.divs[i].n` name-match
   — the same vocabulary `changes[].div` and `m.byName` use).
2. Group entries per seat; the seat's NET movement is the FIRST entry's
   `from` → the LAST entry's `to`. Intermediate states don't matter:
   Farrer's `resigned (LP→null)` + `by-election (null→ON)` nets LP→ON;
   New England's `left (NP→IND)` + `joined (IND→ON)` nets NP→ON.
3. `base.c = { ...cnt }` with `c[from] += 1` and `c[to] −= 1` per chain —
   each seat's current holder walks back to the base election.

This is exact because an overlay never changes the seat set: class
memberships and state membership are identical before and after.

## The CSA fam trap (the one that bites here)

`FAM` (app-1-base.js) maps party CODES to fams — **`FAM("CSA") === "ind"`**.
The `csa` fam exists only inside `holdFam`: `h.ab === "CSA" ? "csa" : h.fam`
(where `h.fam = FAM(h.ab)` at deriveDiv/applyNow time). Every seat counter
(seatStat, areaStats, statScopeArea, statSeatMakeup) runs through holdFam,
so the Wentworth/Warringah founders sit under **csa** in `cnt`. Any OTHER
code→fam mapping — notably one over changes[] from/to — must mirror the
carve: `(ab) => (ab === "CSA" ? "csa" : FAM(ab))`. Note the masking
effect on the federal seats row today: ind and csa both pool into the
"oth" COLUMN (under the 15-seat bloc cut), so a mis-famed revert is
invisible in the displayed deltas — but `base.c`'s KEYS would no longer
match `cnt`'s vocabulary, and any fam-specific consumer or a future
≥15-seat cross party split surfaces the leak. Keep the vocab faithful
regardless of what the pooled column currently hides.

## The moved-seats note's seats gate (67f31034)

The hand-curated sentence under the seats legend on the federal Now frame
("Since the election, One Nation has taken two seats from the Coalition:
New England … Farrer …") is the third scope-coupled seat element in the
same head. Machinery:

- `NOW_AUS_DEK` (areaHedDek's winner case) — one `{t, seats}` entry per
  now frame (now/nswnow/qldnow); `seats` lists the seats the sentence is
  ABOUT, so the gate follows the note, not the whole changes[] ledger
  (the One Nation pair keeps it under Rural and NSW even though two more
  changes — Wentworth/Warringah — live elsewhere).
- `seatStat`'s 4th param is `noteDef` (that entry or null). The span
  emits right after `mk` and renders iff
  `noteDef && (statSel.k === "aus" || noteDef.seats.every((n) => idx.some((i) => m.divs[i].n === n)))`.
- The federal-now note suppresses the visible dek (`dek: noteDef ? "" :
  note`) while the aria label keeps `${hed}. ${dek}` — the text appended
  to dek is for the label, not the column. State nows (nswnow/qldnow)
  carry their note in the DEK, unscoped — that's the existing placement,
  not a bug.
- Rendered pins live in probe-scope.mjs's `noteShown()` helper: present
  at National, st:NSW and cls:Rural; ABSENT at the first cls item (Inner
  Metro) and st:QLD. The negative checks are the point — a gate that
  never falls stays silent until someone scopes their way to it.

## Verifying a scoped delta

- **Node oracle (no browser)**: read `map/data/data-now*.json`, group
  changes per seat in scope, net first-from/last-to through the carved
  famOf — expected display delta is minus the base adjustment. Oracle at
  ship time: NSW → lnp −2, oth +2; Rural → lnp −2, oth +2; Inner Metro →
  all zeros (ind −2 / csa +2 cancel inside the pooled column).
- **Rendered pin**: `.build/map/probe-scope.mjs` (manual Chrome probe over
  `MAP_URL`; see auto-skill-auspol-map-scope-menu for the full manual-probe
  recipe) asserts a non-zero `+/−N` mark under `.st-seats small` for both
  st:NSW and cls:Rural on the Now frame, plus conservation across the line
  (Σ displayed deltas == 0).
- **Source pin**: test-map-page.mjs's scope-menu block pins the
  scopeSeatBase wiring/constants strings. Move pins with deliberate edits
  (auto-skill-auspol-probe-drift-repair).

## Editing etiquette for this head

`seatStat` sits in a head sibling sessions reshape daily (separators/tags/
legend landed and got reverted/re-landed within hours across 2026-11-06/07
— see auto-skill-auspol-reverted-feature-triage). Before extending it:
`git log --oneline -5 -- .build/map/app/app-4-story.js` and read the
CURRENT `seatStat` — do not edit from memory. Regenerate `map/map.js` and
`map/index.html` from a clean worktree whenever the main checkout is busy
(auto-skill-auspol-worktree-scratch-files' generated-file section), since
`assemble.mjs` folds the whole working tree.
