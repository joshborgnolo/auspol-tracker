---
name: auspol-direction-data-entry
description: auspol-tracker — hand-entering a ONE-OFF national-direction (right direction/wrong track) reading for a house with no direction pipeline. direction[] rows live in data/polls.json (date-sorted), pollster string must byte-match the poll row for the POLL_BY_KEY sample join, and the built index.html data block is PRETTY-PRINTED multi-line JSON so one-line greps fail — parse the block.
source: auto-skill
extracted_at: '2026-09-28T04:54:02.149Z'
---

# Hand-entering a national-direction reading

Worked 2026-09-28: RedBridge/Accent's one-off 25–28 May 2026 direction wave
(25 right / 63 wrong / 12 unsure). The National-direction panel's data is
NOT wired to any RedBridge extractor — a house that asks the question once
gets a hand-entered row.

## Where the data lives

`data/polls.json` → top-level `"direction": []` array, DATE-SORTED (same
insertion convention as every other array in the file). Row schema:

```json
{ "date": "2026-05-28", "dateStart": "2026-05-25",
  "pollster": "RedBridge/Accent", "right": 25, "wrong": 63, "unsure": 12 }
```

- `date` = fieldwork END; `dateStart` optional but carry it when the wave
  has a fieldwork range (gen-data's `midMs` and the `25–28 May` scatter
  label both use it).
- `pollster` must BYTE-MATCH the poll row's pollster field — gen-data joins
  the sample via `POLL_BY_KEY` (`date + "|" + pollster`, gen-data.mjs ~:733).
  RedBridge in polls[] is `"RedBridge/Accent"`, not `"RedBridge"`. A wave
  with NO matching poll row still plots (sample renders null — the comment
  at gen-data ~:1277 calls these "direction-only waves"), so a join miss is
  silent — and the wave still pools at a DEFAULT n=1200 weight (`rowN`,
  gen-data ~:259-261: `min(sample || 1200, SAMPLE_CAP)`); always key it to
  the poll row when one exists.
- Regular houses feeding this array (2026): Essential, Roy Morgan,
  Spectre Strategy; Freshwater stopped. TWO of the regular feeds are
  pipelines, not hand-entry: Essential's rows arrive through its CSV →
  `assimilate-essential-vi.mjs` national-mood insert pass (~:313-333), and
  Roy Morgan's arrive from `extract-roymorgan.mjs`'s prose-parse direction
  leg (~:263-280, row built ~:434-442 with `unsure = 100−right−wrong`
  rounded to halves, merged at ~:480; `dirPairMissing` warns when the
  sentence vanishes). Spectre/Freshwater/RedBridge one-offs land here by
  hand. SEC Newgate (no-VI house) has its own pipeline design — see
  secnewgate-extraction.

## Constraints (validate.mjs gates)

- `right + wrong + unsure` must be within ±1 of 100 (`direction-sum` check).
- Each share 0–100; `date` ISO YYYY-MM-DD.
- No house-roster gate — a new pollster name in direction[] does NOT need
  allowlisting.

## What adding a row changes (gen-data.mjs §5, ~:1237–1360)

- Monthly line: `monthlyAdj` over `houseEffectsFor(dirRows(...))` per measure
  (right and wrong modelled separately; unsure = 100−right−wrong at month
  level, NOT pooled directly).
- A new house inside its 183-day recency window joins the panel's
  creditHouses() active list and gets a house effect estimable from n=1
  (shrunk by the estimator) — the May monthly estimate and the credit line
  BOTH move. Expected, not a bug.
- Archive rows key the reading onto the poll (`date|pollster` again) with
  change-vs-own-previous — a first-ever reading for the house shows no chg.

## Procedure

1. Find the matching VI poll row (`date`+`dateStart`+pollster) in polls[].
2. Insert the direction row date-sorted with the same key fields.
3. `node .build/newtracker/validate.mjs` → expect `errors 0`.
4. `node .build/newtracker/build.mjs` → rebuild.

## Verification gotcha (cost extra probing)

The data consts in the BUILT index.html are PRETTY-PRINTED multi-line JSON
(`directionPolls = [{\n    "x": ...`), NOT minified one-liners — one-line
greps like `"right":25,"wrong":63` return 0 even when the row shipped, and
the hashed `assets/<hash>.js` layers do NOT hold the directionPolls block.
Parse it instead:

```bash
python3 - <<'EOF'
i = open('index.html').read()
k = i.find('directionPolls = [{'); s = i[k:i.find('];', k)+2]
import re
print([r for r in re.findall(r'\{[^}]*\}', s) if 'RedBridge' in r])
EOF
```

Expect the row with `sample` joined from the poll row and `dateLabel`
formed as `25–28 May` (en-dash). See auspol-direction-dek for the panel's
head/dek copy side; auspol-bundle-data-probe for the analogous minified-
asset probe.
