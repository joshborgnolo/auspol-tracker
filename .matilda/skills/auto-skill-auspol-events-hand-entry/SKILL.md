---
name: auspol-events-hand-entry
description: auspol-tracker — adding a chart EVENT annotation (worked 2026-10-06, RBA cash rate 4.60% commit 6ee15af). Events live in ONE home, data/polls.json's chronological top-level "events" array {date, short, label, desc, major}; gen-data §9 maps them into the 9f09dca2 dataset and no template/asset-source edit is needed. The /vic/ page has its own separate VIC_EVENTS list. Ship with validate + rebuild; index.html diff must be exactly the event hunk (clean-artifact-commit skill if the tree is dirty).
source: auto-skill
extracted_at: '2026-10-06T06:30:00.000Z'
---

# Hand-entering a chart event annotation (federal page)

Chart events are DATA, not code. One edit, one rebuild.

## The one home: data/polls.json `events`

Top-level `events` array in `data/polls.json` (after the elections block,
~line 303; ends just before `"direction"`). Chronological order — a new
latest event is APPENDED at the end. Row shape:

```json
{
  "date": "2026-09-29",
  "short": "RBA hikes to 4.60%",
  "label": "RBA lifts cash rate to 4.60%",
  "desc": "The Reserve Bank raises the cash-rate target to its highest level in 15 years.",
  "major": true
}
```

Field conventions from the existing 13 rows:
- `short` — 2–4 compact words for the chart marker ("2026 Budget",
  "Hormuz crisis", "Taylor leads Libs", "Joyce → ONP").
- `label` — headline form of the event.
- `desc` — one sentence of context; curly typography (’, –) matches the
  existing rows.
- `major` — true renders as a major marker, alongside the 2026 Budget,
  Bondi shooting, Hormuz crisis and both Coalition splits. Leader
  changes, defections, by-elections are `false`. When the user is in the
  conversation, ask (they decided major=true for the RBA hike).

## Pipeline (nothing else to edit)

`gen-data.mjs` §9 (~:4203) maps the array (`dx(date)` adds the x
fraction, `major` coerced to bool) into the `events` payload embedded in
the 9f09dca2 dataset asset → inlined in index.html. No template.html or
rd-asset source change is involved. gen-data logs
`events: N (major: M)` on the rebuild — a cheap confirm.

## The /vic/ page is a SEPARATE list

`VIC_EVENTS` in `.build/vic/to-main-schema.mjs` (~:72) drives the /vic/
page's markers (state-politics events only: premiers, Vic party
leaders). A federal event like an RBA move does NOT flow there. Adding
one to both pages is a user call — in the worked run the user chose
"federal only".

## Ship path

1. `node .build/newtracker/validate.mjs` (exit 0; exceptions listed are
   documented).
2. `node .build/newtracker/build.mjs`.
3. `git diff HEAD -- index.html` must be exactly the event hunk (7 lines
   in the worked run) plus the one-line 9f09dca2 dataset change.
4. Commit `data/polls.json` + `index.html` +
   `.build/newtracker/assets/9f09dca2-*.js` TOGETHER. If the tree carries
   a sibling session's WIP, use the auspol-clean-artifact-commit recipe
   (stash their build inputs first). Worked commit 6ee15af also rode
   out a push race with the sibling's mood-panel commit — see that
   skill's autostash/rebuild-verify field notes.
