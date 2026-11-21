---
name: auspol-redbridge-oneoffs-wave
description: auspol-tracker — a new RedBridge/Accent AFR statement has landed (cache in .build/redbridge-src/) and its one-off/battery questions aren't in data/redbridge-one-offs.json yet. Compile the statement's non-channeled tables into the public-opinion store: entry/metadata mechanics, THEME_OF discipline (image-only figures MUST file on the "cut" theme or test-public-opinion's figs||prose assertion trips), and the verification gates. Worked 2026-11-12 on the 2–6 Nov 2026 statement — commit 65b11f1f.
source: auto-skill
extracted_at: '2026-11-12T11:26:52.515Z'
---

# Filing a new RedBridge/Accent statement's one-off battery into public-opinion

The store `data/redbridge-one-offs.json` is HAND-compiled — no extractor
auto-files it; after each statement wave lands, someone must sweep the
statement text and file the battery. Both pieces of the read are already
committed by the poll lane: the pdftotext cache
`.build/redbridge-src/afr…-<month>-<year>-federal-poll.txt` (live-source
page printed in the cache `.json`) and the polls.json row (metadata).

## What does NOT get filed (the store's exit contract, in its `_readme`)

- National direction — machine-owned by extract-redbridge-direction.mjs
  (see auspol-direction-data-entry); an earlier user call DELETED
  direction reads that duplicated the main-site panel from this store.
- Everything channeled: VI/2PP/PPM, leader favourability, vote softness,
  best-party/issue-salience batteries (those feed polls.json / issues).
- Image-only figures get a no-figures STUB entry on the `cut` theme
  (below), never transcribed.
- The rotating figure-favourability double is filed for Trump alone
  (by 2026-10-17 user call); other figures' doubles stay out.

The store's `_about` states the wave coverage window; bump it (and
`generated`) when you file a new wave.

## Entry mechanics (worked on the Nov-2026 statement)

One entry per question per wave, appended chronological-by-waveDate:

- `id` — reuse the EXISTING series id for a recurring question
  (`state-of-politics-system`, `next-generation-outlook`), new kebab
  id for a new ask (`housing-cost-income-share`). Recurring ids need no
  FEATURES/public-opinion.mjs edit — the existing featured blocks and the
  `more` catalogue ingest new waves automatically.
- `waveDate`/`dateStart`/`dateEnd` = fieldwork as printed; `published`,
  `sample`, `url` (= AFR article URL) straight from the polls.json row.
- `sampleEff`: polls.json may carry NONE — take the "effective sample
  size of N" figure printed in the statement's methodology text
  (Nov-2026: "efficiency … 82 per cent … effective sample size of 826").
  Same for subpopulation bases: printed in the figure caption
  ("(N=549)", "(N=351)"…) — carry them into `notes`/`title`, never the
  wave's own n.
- `question` — verbatim series wording (stable across waves; reuse).
- `tables[].entities` — the printed ALL-VOTERS row's cells, in the
  SERIES' established entity order. **Table column order can flip between
  statements** (Nov-2026 Table 43 printed burned/major/minor/fine/sure
  while the Jan-2026 entry's entities are fine/minor/major/burned/sure)
  — map cells to the established entity names; never reorder entities
  for a new wave.
- SELF-VERIFICATION before writing: every printed row you file must sum
  to 100±0.5 (Nov-2026 tables 42–45 all summed exactly; a row that
  doesn't sum means you misread the wrapped columns).
- `title` = the printed caption (keep its wording; append the
  subpopulation N when the base isn't all voters). `source` = project
  page URL + `PDF pp.` (page numbers print as bare lines in the txt near
  each figure/table).

## THEME_OF discipline (`.build/newtracker/adhoc-themes.mjs`)

Every new id MUST land in THEME_OF — readStores calls `themeOf()` on
every entry and throws otherwise (fails the whole build). Two cases:

- **Numerics tables** (live-text values): map to the real topic
  (`cost-of-living` for the Nov-2026 housing-cost share ask).
- **Image-only figures** (the statement prints question text + caption
  but the values exist only as chart images, e.g. Nov-2026 Figures
  52–55 rate/rent pressure): map to `"cut"`. Confirmed empirically:
  EVERY existing image-only id (`news-story-week`,
  `vote-change-reasons`, …) files on `cut`; on any other theme,
  test-public-opinion's `more` assertion
  `q.figs.length || q.prose.length` trips
  (`"<id> (redbridge) opens to figures or the article's words"`) —
  nothing to render, not a payload bug. Ids append under the `//redbridge`
  comment group inside each theme block.

## Verification gates (run in this order)

1. `node .build/test-public-opinion.mjs` — the pin that boxes the
   figs||prose rule above.
2. `node .build/newtracker/validate.mjs` → exit 0.
3. Worktree build+commit (shared checkout carries sibling WIP; see
   auspol-worktree-scratch-files): rebuild, then prove the filing made
   the BUILT payload — grep the reference, don't trust names:
   `grep -o 'assets/oneoffs-source\.[a-f0-9]*\.json' public-opinion/index.html`
   (stale sidecars linger from earlier builds), and in that asset check
   the FEATURED blocks read the new wave's printed figures
   (`topics[].blocks` for the recurring series; `topics[].more` for the
   new id).
4. `node .build/test-menu-lines.mjs` + `node .build/test-tab-pages.mjs`
   (the menu's "Latest entry" line must move to your newest published).

Worked end-to-end 2026-11-12 (commit 65b11f1f): Table 43 politics-system
→ series wave (21 burned / 49 major / 21 minor / 4 fine / 5 not sure, Jan
had been 5/29/44/15/7 — trend sentence for `notes` from the two reads);
Table 44 next-generation → series wave (15/18/67 vs June's 19/19/62);
Table 45 housing-cost income share → NEW cost-of-living id; Figures
52–55 rate/rent pressure → two `cut`-theme image-only stubs
(mortgage-rate-rise-pressure N=351, rent-rise-pressure N=194). The
featured rank/split blocks in `oneoffs-source.json` read wave 2026-11-06
(n=1005, neff=826) with no public-opinion.mjs edits.
