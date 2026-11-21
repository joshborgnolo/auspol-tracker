---
name: auspol-map-count-noun
description: "auspol-tracker — the /map/ election count label ('93 districts' bug, 2026-11-04): the count word is seatNoun() in app-1-base.js, view-keyed per user call (map=divisions, chamber=seats, list=members; NEVER 'districts'), and it lives in TWO label homes (metaLine eyebrow in app-6-ui.js + storyArea meta in app-4-story.js) — view-dependent eyebrow text requires setView to re-set #mp-meta on every swap and holdEyebrow's hold key to include S.view."
source: auto-skill
extracted_at: '2026-11-04T10:37:54.125Z'
---

# /map/ — the election count noun (divisions / seats / members)

User report 2026-11-04: on a state election frame (e.g. Queensland 2024) the
top-left labels read "93 districts" — "theyre not called districts here".
Follow-up calls landed the contract: **map view → "divisions", chamber view →
"seats", list view → "members"**, counted by view, not by jurisdiction (so a
federal year is also "150 divisions" on the map). Never "districts" in these
labels.

## Where the label lives — TWO homes, edit both

1. **`metaLine()` in `.build/map/app/app-6-ui.js`** — the eyebrow line
   `#mp-meta` above the map ("Queensland election, 26 October 2024 · 93
   divisions · 1,668 polling places"). Visible in all three views (only
   `.fs.v-list .mp-stamp` hides in fullscreen list).
2. **`storyArea()` in `.build/map/app/app-4-story.js`** — the story panel
   title's meta line (`const meta = aus ? ...`). Two branches take the noun:
   the `aus` whole-election branch (`${N} ${seatNoun()}`) and the
   state-drilled branch (`${N} ${seatNoun()} · ${yearLabel(m.year)} election`).
   The `"now"` frames keep their own wording ("%d members" /
   "… seats · members today") — untouched.

The noun itself is one helper:

```js
// app-1-base.js, right after STATE_YEARS
const seatNoun = () => (S.view === "map" ? "divisions" : S.view === "chamber" ? "seats" : "members");
```

## Wiring a view-dependent label takes (learnt the hard way)

Just editing `metaLine` is NOT enough — two follow-ups were needed:

- **`setView` (app-6-ui.js)** used to only re-set `#mp-meta` inside the
  `senate` branch. A view-keyed noun means the eyebrow must be re-worded on
  EVERY view swap: `$("#mp-meta").textContent = metaLine();` now runs
  unconditionally before `holdEyebrow()` there. (The story re-renders on its
  own via `if (!quiet) renderStory(true)` in setView — no wiring needed.)
- **`holdEyebrow()`** keys its per-family height hold at
  `${w}|${S.view}|${fam}` (was `${w}|${ch}|${fam}` with a chamber boolean —
  map and list shared the key but now print different words, and "divisions"
  wraps longer than "seats"/"members"). Keep the `ch` boolean for the
  Senate-lines inclusion logic; only the key needed the full view.

## Gate

Same as every /map/ app edit (the count label is no exception — map.js is
generated):

```
node .build/map/assemble.mjs     # reassembles map.js from .build/map/app/*, re-stamps map/index.html hash
node .build/test-map-page.mjs    # includes the assembled-asset-currency pin
```

## Left out of scope (deliberately)

Other "district" prose strings still exist (SA/NSW modelled-flows deks, the
census-areas "of each district" notes in app-4-story, NSW "re-counts ballots by
district" copy) — the user's rule named the count label, not prose about
geographic areas. Sweep those only if the user asks. The list view's own row
counter (`ls-count`, "N of M seats" in app-5-list.js) is also untouched — it's
not the top-left label.
