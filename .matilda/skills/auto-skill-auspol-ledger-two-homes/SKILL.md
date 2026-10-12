---
name: auspol-ledger-two-homes
description: auspol-tracker — a poll's published-figures breakdown ("the poll ledger") has TWO renderer homes that must be edited together (worked 2026-10-10, RedBridge forced-choice splits dd4d173, extended same day to all four cohorts 0a6191e): a11e1559 PollLedger/tppLines serves ONLY the Latest-tab PollDetail, while the All-polls archive drawer is rd-allpolls.jsx RdApDetail with its OWN .rd-apd-grid vocabulary (no .pd-s-* markup at all) — a figure added to tppLines alone never reaches the drawer. Drawer anatomy (.rd-ap-row.open + sibling .rd-ap-open, cols keyed onp/lnp flip with the matchup basis, rdApChg renders ▲/▼, est notes as .rd-apd-note spans), the gen-data CHG_MEASURES chg.d key loop, the "rows already in polls.json need only display plumbing" triage step, and the probe-assertion trap plus the gitignored-probe `git add -f` staging gotcha. 2026-10-12 (1f9c1b6): RdLgPrefs Preferences-line anatomy — region chip defaulting to the enrolment-weighted "All regions", the `.rd-ldg-pgrp` slot grid (13ch label / 4ch tag / 2ch right-aligned tabular figures) that makes wrapped rows read as digit columns, the label-first nationwide flow, and the suffix-inside-cell rule (a `grp` tail argument renders as its own flex item and floats the comma a column-gap off the figure — the innerText flex-item trap, see auspol-headless-geometry-verify same day); probe `.matilda/probe/mrp-prefs.mjs`.
source: auto-skill
extracted_at: '2026-10-10T04:34:54.351Z'
updated_at: '2026-10-12'
---

> **Superseded 2026-10-11 (branch `ledger-redesign`, commit 11e102e, pending push):** the redesign's
> opened poll is ONE renderer now - `RdLedger` in `rd-allpolls.jsx` - used by All polls
> (`RdApDetail` returns it, its rail as the companion) and by the Latest table (`rd-polls.jsx`
> `detail`, the release rhythm as the companion). The `.rd-apd-grid`/`.rd-apd-grid1` fact rows and
> the Latest `.rd-pld-dl` list are gone: the open tab's measure leads (`.rd-ldg-lead`: `RdLgTpp`,
> `RdLgVote` (primaries + decidedness), `RdLgLeaders`, `RdLgDir`, or the issue/group/gauge tables)
> and every other measure is one `.rd-ldg-line` (`rdLgLines`). Add a figure once, in the matching
> `RdLg*` component and its `rdLgLines` unit. Probe: `.matilda/probe/ledger.mjs`.


# The poll ledger has TWO renderer homes — edit both

"The poll's published breakdown" is not one component. When the user says a
figure "should be in the poll ledger" (user's words 2026-10-10), the change is
minimum two renderer edits plus any gen-data emitter work:

1. **Latest tab** — `PollLedger`/`tppLines` in
   `.build/newtracker/assets/a11e1559-…js` (`tppLines` ~:3140, consumed by
   `PollDetail` a11e1559:4126). Alt-basis lines splice after the flows line
   inside `if (c.kind === "2pp")`; notes render as `.pd-s-basis-alt` under the
   `.pd-s` figure paragraphs (~:3632-3670). Deltas via
   `segDelta(r.chg, "<key>")` (mirrored for the second party).
2. **All-polls archive drawer** — `RdApDetail` in
   `.build/newtracker/assets/rd-allpolls.jsx` (function ~:1007, drawer DOM
   `.rd-ap-open`, grid ~:1448-1470). NONE of the `.pd-s-*` PollLedger markup
   exists here — it is a fully separate renderer with its own vocabulary.

The failure that taught it (dd4d173 session): the forced-choice figures were
spliced into `tppLines` and the probe kept failing — a debug dump of the
opened drawer (`.rd-ap-open`) showed NO `forced to choose` text, no
`.pd-s-basis-alt`, because the drawer was RdApDetail all along. The tppLines
edit was correct but half the work.

## RdApDetail drawer anatomy (verified 2026-10-10)

- **Open row + drawer**: the clicked archive row is `tr.rd-ap-row.open`
  (pollster name in `[role=rowheader] b`); the detail drawer is the SIBLING
  `.rd-ap-open` element — query the drawer separately, never inside the row.
- **Matchup grid** `.rd-apd-grid`: header row of column `<th>`s ("v One
  Nation" / "v Coalition") then rowheader `.rd-apd-k` spans with their value
  cells, in DOM order. Shipped rows: "Implied, on {rdElecYear} flows",
  "As {p.pollster} published", optional "<Cohort> voters, if forced to
  choose" ×4 (RedBridge/Accent, 0a6191e), "Better prime minister" (+", three‑way"
  full-width). `cols` is defined at :1024-1030 and **`if (!onM) cols.reverse()`**
  — cells are the `{…, id: "onp" | "lnp"}` objects, so render per-cell by
  matching `k.id`, not position; a cohort-vs-rival figure then travels with
  the matchup basis flip automatically.
  - **Column occupancy is question-driven** (0a6191e): RedBridge pressed
    every cohort on BOTH forced questions, so the Greens and Other rows
    carry a figure in BOTH columns; the Coalition cohort only has the
    v-One-Nation figure and the One Nation cohort only the v-Coalition
    figure, so their rows fill one column and `none` the other. Guard each
    row/cell with `p.splitX != null`, never one flag for the whole row.
  - The corresponding tppLines blocks (a11e1559) follow the same split:
    four `forced, <cohort> voters, ALP v L/NP|ON` lines, each its own
    `if (c.kind === "2pp" && r.FIELD != null)` guard, segs ALP +
    the question's rival with the delta mirrored (`+(-d.v).toFixed(1)`).
- **Figures**: pairs render via the local `pair(a, b, bInk)` →
  `<b className="rd-apd-pair">` with an `rd-ap-dash` separator —
  `pair(rdApNum(v), rdApNum(100 - v), "var(--onp-text)")`; textContent reads
  "41 – 59".
- **Deltas**: `chg = (d, dec) => rdApChg(d, dec)` — `rdApChg` (:76) renders
  "**▲ 9**" / "**▼ 2**" (arrows, never +/−), "0" for a flat
  (|d| < 0.5 at dec 0), null when d == null. Probe assertions must match the
  arrow form. Deltas come from `c = (p.chg && p.chg.d) || {}`.
- **`none`** = the `—` dash placeholder cell.
- **Est/provenance footnotes** ride as
  `<span className="rd-apd-sub rd-apd-note">` siblings AFTER the grid closes
  (`{p.splitCoalEst && …}` — dd4d173), same class the "Primary vote, %."
  note uses.
- Other drawer blocks (all `.rd-apd-grid` variants): primaries strip +
  "Primary vote, %." note, the single-column `rd-apd-grid1` rows
  (Decidedness, Net favourability/approval, "The country is heading"), issues
  salience (`rd-apd-iss`), "Rated best on", links, How-it-counts right rail.
- Response back-label helper: row `chg.r` reference-wave dates drive
  `refIso`/`prev` for the ". Changes are on ‹field› poll." note suffixes
  (refIso reads `chg.r.pOnp || pAlp || impOn || imp`).

## gen-data side (chg keys)

`CHG_MEASURES` in gen-data.mjs (~:2278) is the generic per-pollster
measure-diff loop — add a measure's key once there and it emits
`chg.d.<key>` + `chg.r.<key>` on BOTH row emitters
(`splitCoal`/`splitOnp` added :2300-2301 in dd4d173;
`splitGrn`/`splitGrnOn`/`splitOth`/`splitOthOn` followed in 0a6191e).
The per-wave figure itself still spreads explicitly in BOTH
`individualPolls` (~:3002) AND `pollsterTable` (~:3250) — conditional
spreads, absent-not-zero (`...(p.tpp_split.grn != null ? { splitGrn: … } : {})`)
per auspol-extra-datapoint-pipeline; a one-off
module-scope date set (dd4d173's `HAND_SPLIT_ON ~:2943`, consumed by the
flowForced builder ~:3580) hoists out of the emitters per that skill's
convention.

**Triage first — the payload may already be there** (0a6191e): before
planning extractor or polls.json work for a "add X to the ledger" request,
check whether the canonical rows already carry the field. Every 2026
RedBridge wave already had `tpp_split.grn/.oth` and
`tpp_split_on.grn/.oth` in data/polls.json; the whole change was
display-side plumbing (chg measures + two emitters + two renderers), no
extractor touch, no polls.json diff.

## Probe lessons (rd-forced-charts.mjs, shipped green dd4d173)

- Assert drawer content inside `.rd-ap-open`, never inside `.rd-ap-row.open`.
- NEVER assert `.pd-s-*` classes for drawer content — they're PollLedger-only.
  Assert against `.rd-apd-grid .rd-apd-k` rowheader text + the value cells
  that follow it (walk `nextElementSibling` up to 2 cells; collect BOTH —
  column order flips with the matchup basis, so a single first-sibling read
  is basis-dependent).
- `window.AP.openPoll(key, "twopp", "the <chart name>")` from
  `page.evaluate` opens the same drawer programmatically for content checks
  that don't need a real click (the real-mouse click spec needs one genuine
  `page.mouse.click` to cover the handler; follow-up waves can use
  `openPoll` directly).
- Debug dumps from page.evaluate go in `.matilda/scratch/*.mjs` (repo cwd,
  puppeteer-core resolves); they are scratch — delete before finishing,
  never stage them.

## The Preferences line anatomy (2026-10-12, 1f9c1b6)

`RdLgPrefs` (rd-allpolls.jsx ~:1787-1823) renders the DemosAU MRP
`pref_flows` line as one of the `rdLgLines` lines: a region chip
(`.rd-ldg-cyc`, stacked `.rd-ldg-cycw` names so a press never resizes
the line) whose default is the enrolment-weighted **All regions** state
(`useState(() => Math.max(0, regs.findIndex(([k]) => k === "all")))` —
falls back to index 0, the first printed region, on a wave with no
computed `pf.all`), plus per-contest `grp(title, cells)` groups of
`<em>`(party tag) + `<b>`(figure) cells.

- **The groups share the `.rd-ldg-pgrp` slot grid** (rd.css, the rules
  appended right after `.rd-ldg-grpw`): 13ch labels, 4ch party tags,
  2ch right-aligned tabular figures — so rows wrapping beneath one
  another read as digit columns. The grp class is `rd-ldg-pgrp` on the
  SAME element as `rd-ldg-grp rd-ldg-grpw` (the grid scopes under the
  pgrp class only).
- **The one nationally printed flow is label-first like the other
  groups**: "to ALP v L/NP ON 18, nationwide" (polls.json
  `pref_flows.onp_alp_lnp` → gen-data `p.pf`), via the SAME `grp` call,
  with ", nationwide" carried as the cell tuple's third element
  (`cell(k, v, suffix)`) so it renders inside the figure cell. The
  first attempt passed it as a `tail` argument to `grp` — a separate
  flex item — and the comma floated a column-gap off the 18
  (innerText read it as "ON 18 , nationwide"; the innerText flex-item
  trap is written up in auspol-headless-geometry-verify, same day).
- Probe: `.matilda/probe/mrp-prefs.mjs` (tracked — pinned to the
  All-regions default, the label-first tight-comma text, and the
  wrapped-rows column x-coords). It opens the drawer with
  `window.AP.openPoll(window.AP.pollRowKey({pollster:"DemosAU (MRP)",
  released:"2026-09-19"}))` and steps the chip five times.

## Related

- `auspol-detail-meta-band` — the meta fact line's own two-home rule
  (Latest PollDetail + archive ArchPollDetail metaItems), `releaseMetaRows`,
  `EffLines`. Same "two renderers, keep mirrored" family.
- `auspol-extra-datapoint-pipeline` (user skill) — the passthrough
  convention for the gen-data emitter half.
- `auspol-allpolls-chart-dot-openpoll` (auto-skill) — the chart-side idiom
  the same change rode (dd4d173) to make the dots open this drawer.
