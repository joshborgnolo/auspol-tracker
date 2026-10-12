---
name: auspol-poll-links-list
description: auspol-tracker — the per-poll outbound LINKS list end-to-end (gen-data.mjs linksOf §6a → the `links` array on every row → rdPollLinks in rd-polls.jsx): link kinds release/series/tables/method/cite + pending, OWN_HOSTS/CITE_LABEL/RELEASE_BY/PENDING_AT vocab, the releaseHub rolling-series link (Essential 2026-10-09, Resolve 2026-10-11; label "Running data series" since a2dee69), the tablesUrl demographic-tables PDF link (shipped for Newspoll (pooled) 2026-10-09), the releaseUrl-backfill recipe for rows that cite a report PDF as methodUrl but show no release link (4f8013d, RedBridge/Accent Shifts), the ARCHIVED-COPY twin (2026-10-12: gen-data waybackAnnotate reads data/link-health.json's wayback stamps into l.wb/l.wbTitle; rdPollLinks emits a muted .rd-link-arch "Archived copy" twin — the FIRST per-link render-time adornment in this list, and rdPollLinks' one definition covering both detail homes is exactly why it needed no renderer duplication), the reduced-object call site constraint, and the docs that must move with it
source: auto-skill
extracted_at: '2026-10-11T08:56:45.459Z'
---

# The per-poll outbound links list (linksOf → `links` → rdPollLinks)

Worked 2026-10-09: user asked to add Essential's rolling series page
(`essentialreport.com.au/reports/federal-political-insights`, where the
historical 2PP/primary tables live) "to every Essential poll". Half the
machinery already existed — the task was finding the seam and adding a
new link KIND, not a new field.

## Don't recreate what exists: check pollsterRules + linksOf first

A request like "add link X to every <house> poll" has an established
pattern in this repo. A house-level URL is declared ONCE in
`data/polls.json `pollsterRules.<house>` (like `site`), mapped in
gen-data, and emitted by `linksOf` — never typed onto individual
`polls[]` rows. `releaseHub` (the house's rolling report-collection page,
distinct from each wave's dated release page) was already declared for
Essential and already stamped onto rows for the ARCHIVED old design,
which shows it under the one "Pollster's release" pointer — but the
REDESIGN never showed it, which is why the user thought it was missing.

## Anatomy

- **`linksOf(p)` — gen-data.mjs §6a (~:2808-2836)** builds ONE ordered
  list per poll; gen-data emits it as `links` on both row emitters
  (~:2926 individualPolls, ~:3148 pollsterTable). Order: release,
  series, tables, method, cite — positions are decorative, never
  load-bearing.
  - **release-vs-method gap (worked 4f8013d, 2026-10-09)**: a row whose
    `methodUrl` carries the report PDF but whose `releaseUrl` is null
    renders "APC methodology" with NO release link, unlike its sibling
    waves. Fix is a backfill: set `releaseUrl` = the house's
    report-release page (convention: key sits immediately before
    `methodUrl`). Accent's Shifts report URL is
    `accent-research.com/projects/shifts%3A-shifts-in-vote-intention-since-june-2025`
    — the `%3A` is an ENCODED COLON FOLLOWED BY A HYPHEN; bundle-greps
    for `shifts%3Ashifts` (no hyphen) miss it. `releaseUrl` gets only an
    https-format check in validate.mjs (:177) — no allow-list.
  - kinds: `release` (the house's own page — `p.releaseUrl`, or `p.url`
    itself when its host is in `OWN_HOSTS`), `series` (releaseHub houses),
    `tables` (`p.tablesUrl`, the wave's demographic-tables PDF — today
    only Newspoll (pooled)), `method` (`p.methodUrl` APC statement),
    `cite` (press report, labelled per outlet via `CITE_LABEL` keyed on
    host — "Guardian report" etc.).
  - `pending: true` variants ("…: not yet out") only on the house's
    NEWEST wave and only ≤PENDING_DAYS (60) old, pointing at `PENDING_AT`
    (the page the house files them, e.g. Essential's /methodology).
  - `RELEASE_BY` maps house → short signer (Accent for RedBridge/Accent).
  - Label composes from `by = RELEASE_BY[house] || house` where `house`
    strips ` (SMS)`/` (MRP)` parentheticals — so variant pollsters inherit
    their base house's links.
- **Renderer — `rdPollLinks` (rd-polls.jsx ~:45)**: generic map over the
  array, `l.k` is only the React key + `rd-link-pend` gate. Adding a link
  kind needs NO renderer or CSS work. TWO call sites render it:
  Latest-polls detail (rd-polls.jsx ~:460) and the All-polls opened poll
  (rd-allpolls.jsx ~:1550).
- **`rdPollNameLink` (~:57)** picks only `k === "release"` or `"cite"`
  for where the pollster NAME goes — a new kind is correctly ignored
  there (a pollster's name must never open its series page or statement).

## The Archived-copy twin (2026-10-12)

An ADORNMENT, not a kind — the first per-link render-time adornment in
this list, and the pattern for any future one (never add a kind for
metadata that decorates an existing link):

- **gen-data §6a** loads `data/link-health.json` once (`LINK_HEALTH`
  Map, try/catch → empty so a clone without the file builds as
  before). `waybackAnnotate(l)` runs at the END of linksOf over every
  emitted link. Two branches, both keyed on the link being FAILING
  (verdict `wall`/`moved`/`gone` — `LINK_FALLBACK_VERDICTS`):
  stamped → `l.wb = https://web.archive.org/web/<yyyymmdd>/<href>`
  (the dated playback form resolves to the very capture secured) +
  dated title; unstamped → `https://web.archive.org/web/2/<href>`
  (archive.org's latest-capture form) + a hedged "latest capture it
  holds, if any" title. Healthy/pending/unledgered links get nothing —
  a fallback only makes sense where the live link can fail the reader.
- **rdPollLinks** (its ONE definition serves both detail homes — this
  is why an adornment needs no renderer duplication) emits a twin
  anchor straight after the link when `l.wb` is set:
  `key l.k+"-wb"`, text "Archived copy" ↗, title from `l.wbTitle`.
- **rd.css**: `body.rd .rd-link-arch` (beside `.rd-link-pend`) —
  `--ink-3`, weight 400, dotted underline on `.rd-link-t`. Muted so it
  never competes with the live link.
- The end-to-end chain lives in the auspol-citation-check skill (the
  stamps' provenance: availability pre-check + SPN saves). Ship-state
  proof: ~60 `"wb":"https://web.archive.org/web/…"` strings in the
  9f09dca2 data asset.

## The releaseHub → series link (shipped 2026-10-09; second house 2026-10-11)

- `RELEASE_HUB` map: gen-data ~:2322, built from
  `pollsterRules.*.releaseHub`. Two houses carry it now: Essential
  (Federal Political Insights) and **Resolve** — `pollsterRules.Resolve
  .releaseHub` is SMH's Resolve Political Monitor page, the SAME URL as
  the house's `site` (a hub page can double as both; nothing says the
  two must differ). Adding house #2 was a TWO-LINE data change in
  polls.json plus doc touch-ups — zero renderer/emitter code, exactly
  the generalisation the machinery was built for.
- series entry emitted in `linksOf` whenever `RELEASE_HUB.has(house)` —
  key on the STRIPPED house name, and do NOT condition on `p.releaseUrl`.
  Contrast: the old design's `releaseHub` row-stamp (~:2922/3144) IS
  conditioned on `p.releaseUrl`, because there the hub rides under the
  release pointer. A wave with no dated release page still links the
  series page.
- Label history (user-driven renames LIVE in the one `t:` string at
  linksOf ~:3046 — no other home): "Essential’s poll series" →
  "Running series" (user, 2026-10-09) → "Running data series" (user,
  2026-10-11, a2dee69, along with the Resolve add). House-agnostic on
  purpose; title stays "…rolling report collection – every wave of the
  house's series, the historical vote tables included" and reads fine
  for both houses.
- DOC-CLAIM TRAP when generalising: the schema description's "every
  wave's row.url/releaseUrl points somewhere under it" is TRUE OF
  ESSENTIAL ONLY — Resolve's waves cite smh.com.au article pages, not
  children of the monitor page. That claim was re-scoped to Essential in
  the same commit; don't let it re-globalise.

## The tablesUrl → tables link (shipped 2ce32ed, 2026-10-09)

User: "there should be a link to the pdf the australian publishes to the
demographic data in each newspoll pooled all polls table entry". The
contrast with releaseHub writes the rule for where a link's URL lives:

- **Per-ROW field** (`polls[].tablesUrl`), NOT a house-level
  `pollsterRules` entry — The Australian posts its quarterly pooled
  Newspoll's demographic-breakdown supplement only for SOME waves (2 of
  the first 5: 2025-11-20, 2026-03-26; the others are Infogram-only, see
  the auspol-newspoll-tables-pdf skill), so a house-level constant can't
  carry it. A wave without a tables PDF simply omits the field.
- `linksOf` pushes `{k:"tables", t:"Demographic tables (PDF)"}` right
  after the series slot whenever `p.tablesUrl` is set. For the pooled
  rows there is no `release` link (`p.url` is on theaustralian.com, not
  OWN_HOSTS), so tables renders first, ahead of the cite link.
- A Newspoll (pooled) row's pollster name includes the parenthetical, so
  validate.mjs's new **2c3** pins `tablesUrl` to `pollster ===
  "Newspoll (pooled)"` exactly (plus the usual absolute-https shape
  check) — any other row carrying one fails "tables-url".
- Renderer/CSS untouched: rdPollLinks maps any `l.k` generically, and
  rdPollNameLink ignores kinds other than release/cite as designed.

## The constraint that bites: the reduced-object call site

`linksOf` is ALSO called with only `{ pollster, url, methodUrl, date }`
(gen-data ~:2838) to backfill `links` onto rows built before it
(direction-only, issues-only, confidence-only rows). Any new link kind
must be derivable from THAT subset — pollster is always present, so
house-level lookups (RELEASE_HUB) are safe; figure-sensitive fields may
not be.

## Docs that move with it

- `README.md` Essential bullet (the releaseHub paragraph).
- `data/polls.schema.json` `releaseHub` description (a single very long
  JSON line — when editing, note the edit tool can echo STALE context
  lines; verify with read_file before concluding the edit failed).
- The §6a header comment in gen-data.mjs itself.

## Verify

Data-level change: rebuild, then probe the data bundle
`.build/newtracker/assets/9f09dca2-*.js` (NOT the repo-root assets/) and
count `"k":"series"` — 35 after a2dee69 (17 Essential: 13
individualPolls + 4 Latest-table; 18 Resolve). Older Essential waves
lacking `releaseUrl` still carry it. Clean tree gate: `npm test`
(validate + build + all test-*). Old design needs nothing: rule 5
(archived), and it already showed the hub under "Pollster's release".
