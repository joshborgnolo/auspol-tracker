---
name: auspol-map-senate-head-primaries
description: auspol-tracker /map/ — the SENATE lens's area-head primaries row reads the pooled SENATE deck, not the House deck every other lens shares (senFpStat in .build/map/app/app-4-story.js, shipped 2026-11-10 after the user asked for a "Senate primaries" label under the senate base; a relabel alone would have mislabelled House figures). Contract (every lens's head = seatStat, figs = stat || seatStat(m, st, ...) in storyArea), the per-lens fpRow swap, the loadSenateDeck pair loader (current + previous-election senate decks for the deltas) and its three app-6-ui call sites, name-matched pooling across redistributions, and the node one-liner that verifies a deck's national shares before shipping.
source: auto-skill
extracted_at: '2026-11-09T22:54:10.488Z'
---

# /map/ — the Senate lens's head primaries row (re-based 2026-11-10)

## Why this skill exists (the mislabel trap)

Every lens's area head carries ONE figures block: `storyArea` lines
`const figs = stat || seatStat(m, st, \`${hed}.\`, …)`, and `seatStat`'s rows
(Seats / Two-party / Primaries) are **House-deck figures in every lens** —
including the Senate lens, until 2026-11-10. The user, reading the Senate
lens's head, reported "Primaries (Labor and the Coalition share 66.4%)" and
asked for a "Senate primaries" label. **Computing both national decks before
editing showed the pasted figures (34.6/31.8, 66.4%) match
`map/data/res-2025.json`'s HOUSE shares to the decimal, while the 2025 SENATE
deck (`map/data/senate-vote-2025.json`) is 35.1/29.9, 65.0%** — so a relabel
alone would have branded House figures as Senate figures. Asked which way to
fix; user chose **re-base the row to the senate deck AND relabel**. Rule of
the episode: an innocuous-looking rename of a figures label is a data-basis
question — verify the displayed numbers against the candidate decks
(`node -e` over `map/data/res-<year>.json` vs `senate-vote-<year>.json`, family
shares = `100*votes[fam]/formal`) before accepting either.

## The machinery

- **`senFpStat(m, idx)`** (`.build/map/app/app-4-story.js`, right after
  statPrimaryGrid/statOthersToggle): builds `{ alp, lnp, grid }` for the
  head's fpRow when `S.lens === "senate" && svYear(m.year) != null` (a state
  election has no Senate deck — the House row stands there). Pools
  `svOf(m)`'s per-division rows over the head's filtered `idx` **excluding
  `d.by` seats** (a by-election has no senate vote — senArea's own mask).
  Mirrors `statPrimaryCols`/`statOthersRows` semantics but NOT by calling
  them (those walk `d.c` House candidates for `party:` minor-party breakouts
  — impossible from the senate deck, which counts family shares only):
  alp/lnp always shown; grn/onp (never ind) earn a column at ≥10%;
  "Others" is the 100−Σ residual; the expander reuses the shared
  `.st-othb`/`.st-othx` markup and the ONE `statScopeOf(m).open` flag (opens
  together with the head row's and the seat card's).
- **Deltas**: `senFpStat` reads the previous election's deck as
  `SV[py] || null` where `py = isNowY(m.year) ? m.res.prev : prevYearOf(m.year)
  ?? (m.res && m.res.prev)` (the storyArea chain — the now frame's deck is
  2025's, so its baseline is 2022's). Both decks pool over the same current
  `idx` **name-matched**: the prev pool reads seats its file can name, so a
  redistribution-new division exits the prev side only (2025: Bullwinkel
  drops out, 149/150 matched) while the current side's headline shares keep
  the full pool. `showChange` gates the smalls row + expander-row smalls on
  the prev deck's presence; 1993 (first YEARS_FED year) renders shares alone.
- **`loadSenateDeck(y, bg)`** (`.build/map/app/app-3b-senate.js`, beside
  loadSenateVote): `Promise.all([loadSenateVote(y, bg),
  loadSenateVote(prevYearOf(svYear(y)), bg)])`; null-safe (state years →
  resolve null). Called in place of loadSenateVote at the three foreground
  sites in `.build/map/app/app-6-ui.js`: lens-switch (~:980 — its
  fire-condition was widened to `!SV[cur] || (prev exists && !SV[prev])`),
  year-walk (~:1084), boot (~:1783). The idle background lane still preloads
  single decks (`loadSenateVote(sy, true)`, pinned separately at
  test-map-page.mjs:725/731 — do not "fix" the pinned string when touching
  loaders).
- **The fpRow swap** lives in `seatStat` (fpA/fpL block): senate lens →
  `` `<span class="st-lab">Senate primaries (Labor and ${coalW()} share ${f1(sf.alp + sf.lnp)}%)</span>${sf.grid}` ``,
  else the House `statPrimaryGrid(m, A, "", true)` row. `sf === null`
  (deck absent) hides the row rather than falling back to House figures
  under a Senate label.

## Verify

- `node .build/map/assemble.mjs && node .build/test-map-page.mjs` — two pins
  cover the swap: the `senFpStat` call + `Senate primaries (Labor and` label
  + `SV[py]` prev-deck read, and `loadSenateDeck` defined and called from
  app-6-ui (`S.year` and `y` sites).
- Sanity-check the printed numbers with the same one-liner recipe as the
  trap check (2025 worked: senate alp 35.1 / lnp 29.9 / grn 11.7 / onp 5.7 /
  ind 1.0 / oth 16.7, deltas vs 2022 +5.0 / −4.3 / −0.8 / +1.3; the
  Others cell delta is −Σ(shown columns') since family shares sum to 100).
- `grep -c "Senate primaries"` on the assembled `map/map.js` (=1) confirms
  the row landed.

Related: auspol-map-head-figure-expanders (the shared Others opener this row
reuses), auspol-map-seat-head-idiom (the seat card's Primaries), and
auspol-map-lc-senpref (the OTHER senate deck — ballot preferences).
