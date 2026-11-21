---
name: auspol-map-formed-govt-tag
description: auspol-tracker /map/ — the Winner head's govt ink tag plus the two-party figures' side names (placement FORD user calls in one day: ac292cb9 → 72ab2240 → centred 26accd86 → edge cf656274 → FLUSH 4df9b540; now-frame label 2c6e109b): the tag rides the figures' NAMES ROW, absolutely hung flush with the governing family's OUTER edge of the figures (right/left: 100% — no overhang; st-fg-alp/st-fg-lnp suffix classes decide the side), reading "formed govt" on election frames and "govt" on the as-it-stands now frames, ink/bg theme-inverted. ≤560px shrinks the chip and tucks it 12px INWARD to hold the viewport. Homes: fg const + `two` template in seatStat (.build/map/app/app-4-story.js), GOV table (app-1-base.js), coalW for jurisdiction naming, .st-fg/.st-nm rules in page.css; probe .matilda/probe/map-formed-govt.mjs (the app reads #y= at boot only — every frame switch needs page.reload()).
source: auto-skill
updated_at: '2026-11-07'
extracted_at: '2026-11-07T00:33:04.200Z'
---

# /map/ Winner head — "formed govt" tag + two-party side names

Placement history 2026-11-07, all in one day: tag between figures and swing
(ac292cb9) → tightened and raised under the eyebrow beside the names grid
(72ab2240) → onto the names row, centred under the dash (26accd86, user call)
→ off centre to the governing family's OUTSIDE edge (cf656274, user call —
"aligned to outside edge of party forming govt"). The layout below is the
settled contract; the two discarded placements each killed something: its own
line looked orphaned, and centred under the dash is a no-substance position
(the user saw it float between the names and called it out).

## What renders, per frame

Election frames (federal AND state) — the two-party block of `seatStat`:

```
Two-party preferred (margin of 5.2)   <- .st-lab eyebrow
                  55.2 – 44.8          <- .st-tpp figures (grid row 1)
[formed govt]  Labor          Coalition <- .st-nm names row + .st-fg tag
                  +3.1 swing             <- .st-swing
```

- The **tag** renders on every frame with a two-party figure and a governing
  family (2c6e109b): gate is
  `A.tpp != null && (m.gov === "alp" || m.gov === "lnp")`, and the LABEL rides
  the frame — `<b>${isNowY(m.year) ? "govt" : "formed govt"}</b>` ("formed
  govt" where an election delivered the government; "govt" on the
  as-it-stands now frames, which hold rather than won — user call, 2c6e109b).
  Every now frame (now/nswnow/qldnow/wanow) has a `GOV` entry, so the gate
  needs no `!isNowY`.
- It hangs ABSOLUTELY off the figures grid (`.st-tpp` is
  `position: relative`, the figures never reflow for it), names-row height
  (`bottom: 1px`), 6px out past the grid's edge on the government family's
  side: `.st-fg.st-fg-alp { right: calc(100% + 6px) }` (Labor, left) /
  `.st-fg.st-fg-lnp { left: calc(100% + 6px) }` (Coalition, right). The
  family suffix classes are present PURELY for this side placement —
  don't drop them.
- ≤560px rung: the chip shrinks (font 10px, tighter letter-spacing and
  padding) and tucks 12px INWARD (offsets become `calc(100% − 12px)`), or
  it leaves the viewport — the figures columns' outside whitespace eats
  the intrusion harmlessly (the gov-side name lives at the INSIDE edge,
  well clear of 12px). This is why the tag couldn't instead sit inside
  the side columns or be pushed further out: a full-outside absolute
  hang of the full-size chip clips at 320px.
- The names stay NARROWER than their figure and flush with its inside
  edge, so the grid never widens past the figures (`grid-row: 2`,
  `grid-column: 1 justify-self:end` / `grid-column: 3 justify-self:start`)
  — that contract is independent of the tag and the probes still pin it.
- `.st-fg` MUST carry `align-self: end` AND `font-size: 11px` of its own:
  inside the figures' grid context the inherited 50px figure metrics
  stretch a plain span to a row tall (the chip then floats half a row off
  the names — measured rowDY ≈ 15.5px without the fix; absolute + own
  font-size + align-self: end pins the chip's bottom to the names row,
  measured 0.3-0.7px).

- The **names** render on every frame that shows the two-party figures, Now
  frames included — they label the figures, not the outcome.

## Where it lives

**`.build/map/app/app-4-story.js`, `seatStat`** (~:405-420 at 2026-11-07):

- The gate constant sits BEFORE the `if (A.tpp != null)` template build, and the
  tag is spliced INSIDE the figures span, after the names (absolute positioning
  means DOM order doesn't matter, but keep it where it reads):
  `const fg = …<span class="st-fg st-fg-${m.gov}"><b>${isNowY(m.year) ? "govt" : "formed govt"}</b></span>…`
  then `…</span><span class="st-tpp">…${names}${fg}</span>`.
  The return template is a sections array joined on `<span class="st-sep">`
  since cf656274 (see head-stat-rows / the separators contract); the swing
  lives in its OWN `twoSw` variable inside the two-party section.
- The names are emitted INSIDE the figures span, after the two `<b>` figures and
  the `<i>` dash:
  `<span class="st-nm st-nm-l" ${tone("alp")}>Labor</span><span class="st-nm st-nm-r" ${tone("lnp")}>${coalW(1).replace(/^The /, "")}</span>`
  `coalW` (app-4-story.js:26) is jurisdiction-aware — Coalition federally, LNP in
  Queensland, Liberals in SA/VIC/WA — and the `.replace(/^The /, "")` idiom for a
  bare capitalised name is copied from app-2b-draw.js:69 (`axisOpts`). Never
  hardcode "Coalition" for state frames.
- `m.gov` — the governing family, `"alp"`/`"lnp"` — is table-driven:
  `const GOV = { …: "alp"…, qld24: "lnp"… }` in app-1-base.js (~:544), assigned
  `m.gov = GOV[year]` per frame (~:1409). State frames carry their own state's
  government; hung 2010 IS `"alp"`, so the tag sits left with "Labor kept
  government…" copy above.

**`.build/map/app/page.css`** (the /map/ page's ONLY css source):

- Pure theme flip with NO per-theme rule — `.st-fg > b { background: var(--ink);
  color: var(--bg); }` uses the page tokens directly; the probe's theme check
  proves luminance inversion between `sh-light` and `sh-dark` on `<html>`
  (site-shell.js sets those classes).
- Placement by family, absolutely hung: `.st-tpp` carries `position: relative`;
  `.st-fg { position: absolute; bottom: 1px; }` with the side carried by
  `.st-fg.st-fg-alp { right: calc(100% + 6px) }` /
  `.st-fg.st-fg-lnp { left: calc(100% + 6px) }`, and the ≤560px rung resizes
  and re-anchors (`calc(100% − 12px)` + smaller chip). The old flow-based
  rules (`.st-lab + .st-fg`, `.st-fg + .st-tpp`, flex align-self floats) are
  GONE — re-adding them fights the absolute hang.
- `.st-tpp` itself is `display: inline-grid; grid-template-columns: auto auto auto;
  align-items: baseline` — the two `<b>`s and the `<i>` dash auto-place in row 1;
  names carry `grid-row: 2` + explicit columns: `.st-nm-l { grid-column: 1;
  justify-self: end }`, `.st-nm-r { grid-column: 3; justify-self: start }` —
  THAT is the "inside edge" mechanic. Names are narrower than their figure, so
  the grid never widens past the figures; phone overflow stays 0px.
- Cadence rules to keep straight: `.st-lab + .st-tpp { margin-top: 6px }` still
  fires on Now frames (no tag between), `.st-lab + .st-fg` and `.st-fg + .st-tpp`
  (both 6px) cover election frames. `.st-swing { margin-top: 8px }` continues to
  space the whole figures grid off the swing; `.st-swing + .st-lab { margin-top:
  22px }` (:303) restores the block break before Primaries.

## Verification — probe quirks that WILL bite

`.matilda/probe/map-formed-govt.mjs` (22 checks; probe files are tracked by
convention despite `.matilda/*` being gitignored — commit with `git add -f`):

- **`/map/` reads the frame from the hash at boot ONLY** — no `hashchange`
  listener exists. After `page.goto(base/map/#y=<frame>)` you MUST
  `page.reload()` or every later assertion judges the FIRST frame. Frame keys
  used: `2025` (alp, left/tag present), `2013` (lnp, right), `2010` (hung,
  alp-left), `now` (since 2c6e109b: a plain "govt" tag, alp-left, plus its own
  320px phone-rung viewport check), `qld24` (lnp-right, right name reads
  `LNP`).
- Position asserted structurally, not visually: read
  `.st-fg`'s `previousElementSibling`/`nextElementSibling` classNames (eyebrow
  label above; `.st-tpp` below), and the names' flush by comparing
  `getBoundingClientRect()` edges (name.right == figure.right for Labor;
  name.left == figure.left for the Coalition — allow ~2px).
- Theme check swaps `<html>` classes (`sh-light`/`sh-dark`) and compares
  computed oklch luminance of box vs text; don't assert exact equality between
  light ink and dark box values — light --bg (0.975) differs from dark --ink
  (0.94) by design. Parse lightness from the `oklch(L …)` string.
- **The boot-fetch "Failed to fetch" flake (observed 2026-11-07 under python
  `-m http.server`):** across repeated runs of this probe, a page-error
  rejection "Failed to fetch" (thrown from index.html's inline map-data-warm
  script) fires in SOME runs while the server's own log shows every request
  200 — 2 failures in 3 runs at the identical warm-script call, then a clean
  run; curl proves the URLs. Do NOT debug your feature for it: run the
  control against the pristine tree first (`git stash` your edits,
  re-assemble, re-run twice — the pristine tree flaked identically, 1 of 2
  runs), which proves the flake is harness/environmental to the python
  server, not the change. Verdict attribution-by-control then stands;
  flakey page-error fails elsewhere in the map probe fleet deserve the
  same control before any fix work.

Rebuild after edits: `node .build/map/assemble.mjs` (rewrites map/map.js +
map/map.css fully, restamps map/index.html's `?v=` hashes + map-data-warm
hashes). Verify greps on the bundle: `grep -o 'isNowY(m.year) ? "govt" : "formed
govt"' map/map.js` (=1, the label branch), `grep -c "st-nm-l" map/map.js` (=1).
Map suites touching this head:
`test-map-page`, `test-map-draw`, `test-map-vote-bands`,
`test-map-primary-breakdowns` — plus the probe and, in the same head,
`.matilda/probe/map-informal-line.mjs` (the Informal tail row after Seats).

## Shared-tree lesson from the landing session

Don't trust `git diff -- map/index.html` to show generated CONTENT diffs —
its body is only STAMPED by assemble.mjs, so its diff vs HEAD should be EXACTLY
the `?v=` lines when your lane is clean. If it shows body-copy hunks, the file
is carrying a sibling's uncommitted copy edit on top: park the file and
restamp clean before committing (see auspol-clean-artifact-commit twenty-first
case for the full map-assembler parking recipe this session worked through —
assembled bundles read working-tree sources AND stamps read working-tree
`map/data`, so uncommitted sibling source/data edits leak into your map).
