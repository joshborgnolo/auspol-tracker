---
name: auspol-satellite-data-aside
description: auspol-tracker — adding a LIVE (build-fed) data section to an existing HAND-MAINTAINED satellite page (worked 2026-10-10, #forced on /preference-flows/). The fetch-aside pattern — build.mjs emits assets/<name>.json (dataset-pure, no timestamps, or writeAtomic's always-rewrite dirties the launchd tree), the page fetches at view time with a catch → copy-alone fallback — plus the two traps: a NEW assets/*.json needs NO SITE_FILES wiring (refresh_site's stage_dataset does `git add assets/` whole), and ANY satellite page edit must be followed by `node .build/site-shell.mjs` (it re-scopes dark @media rules to :root:not(.sh-light) and test-site-shell fails on drift otherwise).
source: auto-skill
extracted_at: '2026-10-10T00:00:00.000Z'
---

# auspol-tracker: a live data section on a hand-maintained satellite

Worked 2026-10-10: the #forced "What each party's voters say when forced to
choose" section on /preference-flows/ — RedBridge/Accent's respondent-allocated
2PP splits by first preference (polls.json `tpp_split`/`tpp_split_on`, 7 waves
Feb–Oct 2026), the site's first display consumer of those validated fields.

## The pattern — fetch-aside, build never rewrites the page

Satellites are hand-maintained (the build must NEVER regenerate them — the
updaters' clean-tree rule), yet this section must carry per-wave figures that
move every poll. Resolution, following the /assets/auspol-now.json precedent:

1. **build.mjs emits `assets/<feature>.json`** in the existing `!VIC`
   satellite block, right after the auspol-now.json writeAtomic (the
   proposed-plan source-map is "build.mjs, auspol-now writeAtomic"). Filter
   polls.json to the rows carrying the signal, `writeAtomic` a compact,
   documented shape (`{house, latestPublished, waves:[…]}`).
   **The JSON must be a pure function of the dataset — no build timestamp.**
   `writeAtomic` rewrites unconditionally, so any run-to-run byte drift in
   content dirties the tree for the launchd jobs, which require a clean tree.
2. **The page fetches at view time** (`fetch("/assets/<feature>.json",
   {cache:"no-cache"})`), draws the figures, and a silent `.catch(() => {})`
   leaves the intro footnote as copy alone — the satellite rule that a data
   hiccup never breaks a page.

## Trap 1 — no SITE_FILES wiring for new assets (conflicts resolved via git-push-main.sh)

MATILDA.md's "commits the generated files by the shared SITE_FILES list"
reads as if a new assets/*.json must be registered. It does NOT:
`refresh_site()` → `stage_dataset()` runs `git add assets/` WHOLE
(.build/git-push-main.sh ~:337-360), so auspol-now.json, flow-splits.json and
friends are committed without naming them anywhere. Read the deployment code
(git-push-main.sh itself), not the doc line, before escalating a
"potential gap".

## Trap 2 — after editing a satellite page, re-apply the shell

`npm test` runs node .build/test-site-shell.mjs which fails "a satellite is
out of step with its shell" the moment you touch a satellite page. Run
`node .build/site-shell.mjs` after your edits — it re-scopes your new
`@media (prefers-color-scheme: dark)` rules to `:root:not(.sh-light)` (the
page's own style block precedes <!--shell:head-->), so for a token like a
party-colour var you write BOTH the light `:root` rule and a
`:root:not(.sh-light)`-scoped dark rule plus a `:root.sh-dark` duplicate.
Commit the re-stamped page (the `?v=` link bump).

## Wrong-assumption headless probes

Two of the probe's three initial assertions were wrong against the OWN
renderer, not because the page was broken: the "history lists every EARLIER
wave" assumption (the renderer deliberately lists all waves, latest included)
and "sr text uses %" (it spells "per cent"). When a probe fails on a
hand-maintained page, read the page's renderer before assuming a defect —
the page is the source of truth, the probe must match it.

## Verification (all gates green first run after the shell fix)

- `.build/test-flow-splits.mjs` registered in package.json's test chain —
  asserts the JSON against polls.json verbatim (every tpp_split row exported,
  shares 0-100, buckets verbatim, latest wave carries both splits) and the
  page wiring (h2 id, toc href, exactly the two figure mounts, fetch path,
  headline strings).
- Headless DOM/geometry probe (auspol-headless-geometry-verify): serve the
  repo root over HTTP, load /preference-flows/, assert bar width shares ==
  JSON figures (getBoundingClientRect), ends/captions carry the latest wave's
  figures and the source link, one hollow ".fs-miss" row per wave missing a
  split, no failed requests; screenshots never trusted.
- The `deff-backtest` parity failure that npm test surfaced at the same time
  was SIBLING drift (uncommitted 9f09dca2 asset out of step with gen-data
  copies), unrelated — an `npm test` failure after a data-pipeline change
  must be attributed by reading WHICH gate failed, not assumed ours.
