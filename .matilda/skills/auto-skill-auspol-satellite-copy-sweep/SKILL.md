---
name: auspol-satellite-copy-sweep
description: auspol-tracker — sweeping a copy/punctuation change across ALL satellite pages (worked 2026-09-28 middot→comma/en-dash sweep, commits 95bf5fe main + 428afbd satellites). Three source classes, three workflows: emitter pages (edit .build/refresh-*.mjs, regenerate — morgan --offline, prediction --force replace-in-places today's history record), shell markup (edit site-shell.mjs once, reapply to 10 pages, stage assets/site-shell.js), hand pages (edit in place; atlas body copy lives in its JS string builders; preference-flows is easy to overlook). Includes the site-wide punctuation convention (no middot separators in user-facing copy: commas inline, en-dash " – " in titles/figure dividers), the &#183; entity grep trap, and the intentional middots to keep (empty-cell placeholders, constants comments, console strings).
source: auto-skill
extracted_at: '2026-09-28T05:09:51.119Z'
---

# auspol-tracker: copy sweeps across the satellite pages

Worked 2026-09-28 on "everywhere they appear, swap middot separators for
proper punctuation in that same vein" — main tracker shipped as 95bf5fe,
satellites as 428afbd (18 files, 91 lines). The main-page copy homes are
mapped in auspol-site-copy-search; the satellites have their OWN three
source classes, each with its own edit→regen→verify workflow. Classify
every hit before editing; grepping built HTML tells you WHERE a string
surfaces, never where it lives.

## Class 1: emitter-generated pages — edit the template, regenerate

NEVER hand-edit the built page (tool header comments say so):

| page | emitter | regenerate |
|---|---|---|
| archives/morgan/ | refresh-morgan-archive.mjs | `node .build/refresh-morgan-archive.mjs --offline` — also re-writes data/roymorgan/*.csv from the same cached pages; expect BYTE-IDENTICAL (confirm `git status` shows no data diff) |
| archives/galaxy/ | refresh-galaxy-archive.mjs | arg-less, reads local data only |
| archives/trove/ | refresh-trove-archive.mjs | arg-less, reads `.matilda/trove-harvest/` JSONLs |
| archives/aeforecasts/ | refresh-aeforecasts-archive.mjs | arg-less, reads data/bonham-additional-aeforecasts.csv |
| prediction/ | refresh-prediction.mjs | `--force`. Trap: this REPLACE-IN-PLACEs today's record in data/prediction-history.json — with unchanged data that's a no-op diff, but CHECK `git status` after: the PRED_STATUS `wrote:` array should be only `["prediction/index.html"]`. Loop detail: auspol-prediction-page |

## Class 2: site-shell markup — one source, reapplied

Header/footer copy (sh-meta lines, freshness strings) lives ONCE in
`.build/site-shell.mjs`. Edit the module, then `node .build/site-shell.mjs`
reapplies to all 10 pages and regenerates `assets/site-shell.js` (STAGE IT
— my second commit nearly missed it). Verify: `--check` prints "site shell
current on all 10 pages" and `node .build/test-site-shell.mjs` passes.
Topology: auto-skill-auspol-satellite-page-branding.

## Class 3: hand-maintained pages — edit in place

archives/newspoll, archives/acnielsen, archives/index.html (redirect stub,
title only), atlas/, feedback/, preference-flows/. Traps:
- **preference-flows/ is easy to leave out of the sweep plan** — it's a
  shell page, but its head/body copy is hand-owned like atlas.
- atlas's separators live in JS string builders in its inline `<script>`
  (where-line ~:449-451, tooltip ~:674, sparkline `<title>` ~:779) — grep
  the JS for `" · "` too, not just static markup.
- acnielsen's per-PDF `<span class="note">PDF · wave</span>` style lines
  are one replace_all away.

## The punctuation convention (user, 2026-09-28)

NO middot "·" separators in user-facing copy anywhere (main + satellites):
- commas for inline separators ("Net −36.1 points, ▼ 9.8 on a month ago");
- en-dash " – " for `<title>`/og:title ("Title – auspol tracker", matching
  the main "auspol tracker – Australian federal election polling") and for
  styled figure dividers (the 3PP split, popover pseudo-bullet).
Keep: math-notation middots, empty-cell `·` placeholders, console/report
strings in emitters, HTML comments quoting defunct behaviour or shipped
constants (e.g. preference-flows :14-16 flow-number listing).

## Verify on the BUILT pages, after every regen

```
grep -rn "·\|&#183;" archives/ atlas/ feedback/ prediction/ \
  preference-flows/ --include="*.html" \
  | grep -v 'class="na">·</td>\|<td>·</td>'
```

- **The entity trap**: a literal `·` grep misses HTML entities — build.mjs's
  static-summary separators were `&#183;` and only showed under that grep.
  Sweep for both (and `&middot;`/`&bull;` if bullets are in scope).
- Regenerate FIRST — grepping stale built pages reports already-fixed
  ghosts.
- Intentional placeholders to keep (filter them as above): galaxy `num()`,
  aeforecasts `cell()`, prediction `cellPct()` empty cells — all emit
  `<td>·</td>` or `<td class="na">·</td>`.
- Main-page verification: `.matilda/probe/middot-sweep.mjs` (puppeteer,
  exits 1 while any middot renders; scratch, never commit).

## Commit discipline (shared repo)

Stage only owned paths: the emitters, site-shell.mjs, assets/site-shell.js,
and the page HTMLs. Sibling sessions concurrently churn .matilda/skills
and sometimes newtracker sources — never `git add -A`. Plain `git push`;
if raced, `git pull --rebase --autostash` then push (sibling data rows can
land as exact duplicates of your stash — verify before dropping).
