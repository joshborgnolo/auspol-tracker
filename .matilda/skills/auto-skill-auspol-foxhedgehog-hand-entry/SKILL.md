---
name: auspol-foxhedgehog-hand-entry
description: auspol-tracker — Fox & Hedgehog is a fully hand-entered house (no
  extractor, 4 waves Jan/Feb/Mar/May 2026, Daily Telegraph client, flagged
  stopped): the url/releaseUrl/methodUrl triple convention (Tele JA2 story /
  news-den release post / per-wave APC statement tinyurl→Drive), validate.mjs's
  methodUrl allowlist must carry "Fox & Hedgehog", and the `published`
  provenance trap — the ea6d1f6 backfill filed Drive PDF-upload GMT digits as
  Sydney-local times, while the user-approved convention is the F&H news-den
  post's datePublished (F&H publishes before the Tele runs the story).
source: auto-skill
extracted_at: '2026-09-04T22:12:00.000Z'
---

# Fox & Hedgehog hand-entry runbook (auspol-tracker)

F&H polled federally four times for the Daily Telegraph — fieldwork 5–6 Jan,
17–19 Feb, 24–25 Mar, 25–26 May 2026 — then stopped (pollsterRules `stopped`
flag set). **There is no extractor**: every field on its rows is hand-entered,
and `validate.mjs` changes must be made by hand too.

## 1. The link triple (shipped 5dfa673 + rebuild ad435c8, 2026-09-05)

Each VI row carries:

- `url` — the **Telegraph voting-intention story**, kept in the user's
  JA2-encoded form `https://www.dailytelegraph.com.au/news%2Fnsw%2F<slug>%2Fnews-story%2F<id>`
  (encoded links 302→/nocookies for non-browsers — normal; the plain-slash
  equivalent fetches public). When a release post links SEVERAL Tele stories,
  pick the VI story, never a crosstab article (March's post also linked a
  fuel-crisis crosstab — deliberately not used).
- `releaseUrl` — the house release post
  `https://www.foxhedgehog.com.au/news-den/the-daily-telegraph[-<month>-2026]-national-voter-sentiment-survey`
  (Jan slug has NO month).
- `methodUrl` — that wave's APC methodology statement. Jan's is a direct
  `drive.google.com/file/d/14VSwAKi4y0xqvgnHYtm0IP_92OnbNSk9/view` link (its
  report PDF doubles as the statement); Feb/Mar/May are per-wave tinyurls
  (`Feb26FEDPollFoxHedgehogAPC-1`, `APC-LMS-Mar26National-FH`,
  `May2026-Methodology-FH`) resolving to distinct Drive files. Anchor text on
  the release page is "APC Long Methodology Statement" — do NOT confuse it
  with the post's "full report" tinyurl (the report PDF ≠ the statement);
  the pre-relink row `url` values were those full-report Drive links.

`validate.mjs` (~2c2): the `methodUrl` allowlist and its class comment both
name **"Fox & Hedgehog"** (per-wave statement off its news-den release page,
hand-entered, no extractor). The comment's parenthetical house list and the
allowlist array move together — a new methodUrl house needs both, else
validation fails with `method-url` errors.

## 1b. sampleEff — hand-stamped filer (5dfa673, 2026-09-05)

The same APC statements also publish each wave's effective sample, and the
same hand-entry commit stamped `sampleEff` on all four rows: Jan 1608/1038,
Feb 1625/1068, Mar 1810/1041, May 1700/1011 (raw/eff; per-wave DEFF
1.52–1.74, pooled 1.62). F&H is thereby the ONLY sampleEff filer with no
`.build/extract-sampleeff.mjs` leg — its figures enter by hand with the row,
and any future wave (if the house resumes) must be hand-stamped the same
way; there is no pipeline to wait on. The site-wide filers-list copy names
F&H since 3e4b272 — see auspol-effective-sample → Copy homes for the five
homes a sampleEff filer change must sweep.

## 2. `published` provenance trap + the approved convention

- Repo convention is **Sydney-local wall clock** (Newspoll 18:00/20:00 =
  Sunday-evening drops).
- The four F&H rows' `published` values came from commit **ea6d1f6**
  ("Backfill published timestamps on 62 historical polls", 2026-09-01), which
  sourced them from the **Google Drive report-PDF upload event** and recorded
  the **GMT digits as if Sydney-local** — so each reads ~10–11h earlier than
  the real instant and precedes even F&H's own release post. Evidence:
  `curl -sIL "https://drive.google.com/uc?id=<report-id>&export=download" |
  grep -i last-modified` → Jan 13:56 GMT (row 13:26), Feb 22:58 (row 22:56),
  Mar 23:46 (row 23:45), May 06:57 (row 06:42) — always 1–30 min later than
  the filed value (rows captured at/finalising upload).
- F&H genuinely **publishes first**: its news-den post `datePublished`
  (10 Jan 07:17, 22 Feb 10:18, 29 Mar 10:51 AEDT; 1 Jun 05:48 AEST) precedes
  every Tele story timestamp. User-approved convention (2026-09-05):
  **`published` = the F&H news-den release-post time** — i.e. set the four
  values to `2026-01-10T07:17`, `2026-02-22T10:18`, `2026-03-29T10:51`,
  `2026-06-01T05:48`. Proposed to the user at extraction time; CHECK
  data/polls.json before assuming it landed.

## 3. Timestamp-verification toolkit (reusable)

- **News-den posts**: `curl -sL <news-den url> | grep -o 'datePublished[^,}]*'`
  — meta carries the offset in-string (+1100/+1000); appears twice (meta tag +
  JSON-LD).
- **Telegraph stories**: direct curl HEAD gets Akamai **403**; GET with a
  browser UA returns a 200 bounced to `/nocookies` (JA2 challenge). Use
  `node .build/chrome-article.mjs <plain-slash story url>` (see
  chrome-session-piggyback) and grep `"datePublished"`. Beware **synthetic
  midnight stamps** (e.g. 13:00Z/14:00Z = 00:00 Sydney) on some News Corp
  stories — treat as date-only.
- **Drive file upload event**: `uc?export=download` `Last-Modified` header;
  the public `/file/d/<id>/view` page exposes no dates.
- Old polls.json values are recoverable via `git show <commit>^:data/polls.json`
  (e.g. pre-relink F&H Drive urls via `git show 5dfa673^:data/polls.json`).

## 4. The 3-cornered preferred ('3PP') figures

F&H's own survey framework publishes a three-party-preferred on SOME waves —
Feb 2026 (ALP 44 / LNP 27 / ON 29) and May 2026 (ALP 43 / LNP 27 / ON 30,
whose printed deltas (-3/+3/0) corroborate Feb's). Jan announced the
framework only; Mar published no 3-cornered figure. Storage: inline per-poll
`tpp3: { alp, lnp, onp }` on those two rows (absent on the others), shipped
2026-09-05 with `validate.mjs` guard block 2b2 (F&H-only, three slices,
10–70 each, Σ≈100). The canonical `tpp_alp/tpp_lnp` pair on every F&H row is
UNTOUCHED and keeps feeding the 2PP aggregate — 3PP is display-only
passthrough. Figures come from the node BELOW the release post's headline
table on the news-den page ("On a three-party preferred (3PP) basis, Labor
leads on 43%…") — strip `<style>` blocks before text-extracting or the
Squarespace CSS font-face noise swamps the grep. Full machinery map:
auspol-tpp3-lead-measure.

## 5. Editing the rows

F&H is hand-entered, so edits are plain polls.json JSON edits through the
normal pipeline (edit → `node .build/newtracker/validate.mjs` →
`node .build/newtracker/build.mjs` → commit source + rebuild separately →
push from a detached worktree at origin/main — see auspol-build-pipeline and
shared-repo-session-race). This git predates `git worktree remove`: clean up
with `rm -rf <worktree> && git worktree prune`.
