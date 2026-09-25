---
name: auspol-static-summary-tables
description: auspol-tracker — the static-summary article's TABLES (ss-primary, ss-table) end-to-end (worked 2026-09-18, commit 82baf5c): buildStaticSummary() in .build/newtracker/build.mjs is their ONLY home (no React twin, unlike the two-homes copy pairs); its two data taps (grab() off the generated asset vs direct fs read of data/polls.json), the ss-table thead styling recipe for new column headers, the reader-engine design constraints, and the multi-line-table grep verification trap.
source: auto-skill
extracted_at: "2026-09-18T02:31:01.782Z"
---

# Static-summary article tables (buildStaticSummary)

Worked example (commit `82baf5c`): user asked for "a column for the 2025
election primary vote values, just in the middle between the party column
and the current-primary column" in the STATIC site version. Ship shape:
three source-file edits + rebuild + scoped commit, exactly as below.

## Where the tables live — ONE home, not two

- The no-JS / reader / freshness-dot article is ONE
  `<article class="static-summary">` emitted by `buildStaticSummary()` in
  `.build/newtracker/build.mjs` (~:363-490) and swapped into template.html
  at the `<!--STATIC_SUMMARY-->` marker (`html.replace(...)` ~:490).
- CRITICAL difference from copy: the footer disclaimer (auspol-disclaimer-copy)
  and methodology prose (user skill auspol-copy-two-homes) each have TWO
  homes that must move together. The TABLES (`.ss-primary` primary-vote,
  `.ss-table` Latest-polls, ss-lead 2PP line) live ONLY here — the React app
  renders its own equivalents. Edit build.mjs + the CSS in template.html;
  there is no asset-JS twin to keep in step.

## The two data taps inside build.mjs

1. **Derived figures** — `grab(name)`: build.mjs slurps the generated
   dataset asset `9f09dca2-….js` as TEXT and JSON.parses each top-level
   `const NAME = {…}` line (indexOf + slice, no eval). `grab("latest")` →
   `L.primary`, `L.alp2pp`, `L.alp2ppCi95`, `L.method.*`; also
   `grab("pollsterTable")`, `grab("individualPolls")`, `grab("accuracy")`.
2. **Canonical repo data** — direct fs read: `ROOT =
   path.resolve(HERE, "..", "..")` (build.mjs is two levels down), then
   `JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"))`.
   The 2025 baseline = `elections.e2025 = {date, lnp, alp, grn, onp, oth,
   tpp_lnp, tpp_alp}` — the SAME object gen-data.mjs anchors on as
   `ELECTION = ELECTIONS.e2025` (~:132), so the static column can never
   drift from the chart anchor. Shape details in auspol-pollsjson-schema §4.
   Don't hardcode the numbers into the template literal.

## Where the table CSS lives (template.html ~:255-280)

- `.ss-primary` block (~:258-268): max-width **320px**, width 100%,
  collapse, 15px; `th,td` 5px vertical padding + border-bottom var(--line-2),
  tabular-nums; `th` left/600 (row headers), `td` right. Comment above it
  states the reader-engine rule: a table, not flex — reader modes keep
  table columns but drop flexbox.
- `.ss-table` (Latest polls) is the **labelled-column precedent** to copy
  when ss-primary gains columns: `thead th { font-size:13px;
  color:var(--ink-3) }` and `th[scope="row"], thead th:first-child {
  text-align:left; font-weight:600 }`. Its table label is a
  `<p class="ss-cap">` PARAGRAPH, not `<caption>` (reader engines indent
  captions oddly inside their own chrome); ss-primary has none — just `<h2>`.

## The shipped column recipe (82baf5c)

1. build.mjs, after `const L = grab("latest"), prim = L.primary;`:
   `const EL25 = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).elections.e2025;`
2. Row template gains the middle cell:
   `<tr><th scope="row">${PARTY[k]}</th><td>${EL25[k].toFixed(1)}%</td><td>${prim[k].toFixed(1)}%</td></tr>`
3. `<thead><tr><th scope="col">Party</th><th scope="col">2025 election</th><th scope="col">Now</th></tr></thead>`
   — REQUIRED once a second numeric column exists (two unlabelled % columns
   are ambiguous in a reader); follows the ss-table thead.
4. CSS: `.ss-primary td + td, .ss-primary thead th + th { padding-left: 14px; }`
   (adjacent right-aligned figures collide without it; the `+` sibling
   selector leaves the party column untouched), plus thead th at
   13px/ink-3/400 with `:first-child` left/600 — the ss-table recipe.

## The ss-lead 2PP blocks — both bases, then the ALP v ON pair

- **Both bases (dadbfd0, 2026-09-23)**: `headlineView(L, S)` in build.mjs
  (~:321-338) merges `synthLatest` over `latest` → `basis:"imp"` with the
  published pair riding along as `L.pub.{alp2pp,lnp2pp,alp2ppCi95}`. The
  ss-lead states the implied pair, then (gated on `L.basis === "imp"`)
  "the pollsters' own respondent-allocated figures read …". The
  Latest-polls ss-row cells likewise read `alpImp` (Newspoll's alp2pp-null
  rows gain figures). Fallback `basis:"pub"` must keep the old single-pair
  text — guard every both-bases clause.
- **ALP v ON implied paragraph (f68bfe1, 2026-09-23)**: `latest.onImp =
  {a, b, band, n, aPrev, changeSe, changeCi95, changeSig}` straight off the
  data bundle — `a` = implied share to Labor, `b` = to One Nation (the
  d1a1d215 glossary renders it "{a} to Labor, {b} to One Nation, ±{band}"),
  `band` = ± on the FIRST-PRINCIPLES flow table, NOT sampling error, and
  NOT the 2025-election AEC flows behind the classic implied pair — any
  sentence quoting it has to own both distinctions. Guarded
  `L.onImp ? … : ""` — null when the series is too thin (the bundle comment
  says exactly that), so no-js text must degrade to absent, never to a
  blank figure. Also on `latest`: `rivalLead` ("alp_on" | "alp_lnp" — which
  contest the hero opens on) and `primaryOrder`.

## Lessons from the session

- **Don't widen the table.** The 320px max-width absorbs a third column
  (real content ≈245px); the session's first pass bumped it to 380px and
  was reverted. When the user asks for "just" a column keep the diff
  surgical — same-file follow-up edits are cheap (see
  auto-skill-same-file-edit-sequencing: run multiple same-file edits as
  SEQUENTIAL calls, not parallel).
- **Grep cannot find the rendered table as one string.** The emitted
  table is multi-line — `grep -o 'ss-primary.*</table>' index.html` matches
  NOTHING. Use `grep -n 'class="ss-primary"' index.html` then `sed -n` the
  range. Bonus trap: `grep -c 'ss-primary thead' index.html` = 3 because
  the THREE new CSS rules in <head> contain the same string — that's not
  the table appearing 3 times.
- **Verify+ship:** `node .build/newtracker/build.mjs` then
  `node .build/newtracker/validate.mjs` (exit 0 = pass; the documented-
  exceptions dump is long and normal). Scoped `git add
  .build/newtracker/build.mjs .build/newtracker/template.html index.html`
  only — feed.xml/sitemap.xml/robots.txt rebuild byte-identical when
  latest data didn't move. Commit via message file in .matilda/
  (out-of-workspace /tmp writes are refused).
