---
name: auspol-poll-fallback-display
description: auspol-tracker — when a Latest-table cell must fall back to a different measure (primary votes when a poll has no 2PP), never inject the fallback into the shared archLeadInfo — it feeds archive sorting, the held-by filter, and measure counts. Add a display-only opt-in (primaryFallback prop + separate primaryLeadInfo), flag the substitution with facet-flag chips + tooltips. Implemented in commit 1d86c7b.
source: auto-skill
extracted_at: '2026-08-31T05:14:40.463Z'
---

# auspol-tracker: measure-fallback display in the poll tables (opt-in only)

Origin task: "in latest polls table, if 2pp filter is selected and a poll has no 2pp, just put primary votes" (commit 1d86c7b). Newspoll, DemosAU and Resolve rows had no 2PP (`alp2pp`/`lnp2pp` null in the pollsterTable rows of asset 9f09dca2….js); primaries live in `p.p = {alp,lnp,grn,onp,oth}`.

## The architectural trap: archLeadInfo is load-bearing

`archLeadInfo(p, measure)` in `d1a1d215-….js` returns null for a poll with no 2PP — and that null is a FEATURE. The same function drives, in the All-polls archive (~lines 2102, 2135, 2353, 2363):

- column sort values (rows sort on the real 2PP lead, not an invented primary margin),
- the held-by filter,
- measure counts ("3 of 8 with 2PP" style tallies).

**Do not** make `archLeadInfo` synthesise a primary-vote margin — every archive row would silently sort/filter on a different measure than its neighbours. The fallback is **display-only and opt-in**.

## The implementation pattern (mirror it for any future fallback)

1. **Separate info function**: `primaryLeadInfo(p)` (~:1586) returns `{m: alp − strongest-rival signed margin, primary: true, who/lab/color, segs, note: " over <rival> on primary votes – the poll published no after-preferences figure"}`. The rival is the max of `p.p.lnp/onp/grn` — NOT always the Coalition: One Nation's primary tops the L/NP vote in some waves (since the Aug-31 2026 fix, commit "Judge no-2PP fallback leads…"), and an "ALP +10" beside a third-placed Coalition hid that Labor trailed One Nation. Rival short labs follow `archLeadInfo`'s ("L/NP", "ON", "GRN"). It lives beside `archLeadInfo` but never replaces it.
2. **Opt-in prop at the render boundary**: `ArchLead({p, measure, primaryFallback})` (~:1600) does
   `const li = archLeadInfo(p,measure) || (primaryFallback && measure==="lnp" ? primaryLeadInfo(p) : null);`
   Only call sites that pass `primaryFallback` — the Latest table's twopp cell in `a11e1559-….js` (~:2762) — see the fallback. The archive's shared `ArchLead` calls stay untouched.
3. **Unmissable substitution flag**: append `{li.primary && <>{" "}<span className="facet-flag">primary</span></>}` after the net value. The `.facet-flag` chip CSS (9.5px bold ink-3 bordered chip) already existed at `template.html:1858`.
4. **The published-bars cell too**: `ArchPublished({p})` (~:1493) — when `tppContests(p)` is empty, render `primarySegs(p)` as `.apub` dot+numeral segs with a `<span className="facet-flag">Primary</span>`, `aria-label="Primary votes: …"` and `title="No two-party or head-to-head figure in this poll – these are the primary votes"`. Falls to a dash only when `p.p` itself is absent.

## Verification

Headless probe per the headless-browser-verification skill at 1024px (tightest 7-column desktop, just above the ≤1000px hide-md cutoff) and 1440px: `docScrollW === iw` (no overflow), the three no-2PP rows show five primary numerals + the chip and a `±N.N primary` lead cell, and every 2PP row is byte-identical. Signed margins cross-check by hand from the primaries, against the STRONGEST rival (Newspoll 29 vs max(19 LNP, 30 ONP) → −1.0 over ON; DemosAU 26−25 → +1.0, L/NP still strongest; Resolve 28 vs max(23 LNP, 26 ONP) → +2.0 over ON). The 4px table/card width mismatch in the diag is the pre-existing `.table-wrap { margin: 0 -4px }` hover-bleed — not a regression (see the headless skill's geometry pitfall note).
