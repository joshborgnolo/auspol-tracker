---
name: auspol-era-cycle-import
description: auspol-tracker — adding PRE-1987 elections as era-implied cycles (shipped 39de76c, 2026-09-12): buckets 1974–1984 + backfilled 1987 term from the aeforecasts F2F Morgan mirror (~514 rows 1949→, Morgan-only pre-1969). Rows carry an IMPLIED "LEF 2PP" (last-election flows) computed from FLOW_ERAS in .build/newtracker/flows.mjs — tpp_alp = alp + era shares of dem/dlp/oth — with tppEra tagging, cyclePollBases provenance notes citing Bonham's ±0.6 error budget, validate.mjs era lanes (dem/dlp RANGES, Σ watch, OLDEST_ELECTION=1974), and a right-edge backtest gate where opening-election flows beat closing-election flows 6/7 cycles. Accuracy panel ingests the era rows (12→18 elections; 1977 correctly excluded by the 14-day window). Buckets ship EMPTY cycleApproval arrays (no approval/PPM pre-1987 — Newspoll first lands in bucket 1987), which broke the fan's "every term holds every measure" invariant two days later: fixed by hasData-gated fan membership (20ef05e, see auspol-past-cycles); trove-leader-approval.csv is the possible PM-approval backfill, undecided.
source: auto-skill
extracted_at: '2026-09-12T00:00:00.000Z'
---

# Era-cycle import — pre-1987 cycles with implied LEF 2PP (39de76c)

How 1974, 1975, 1977, 1980, 1983, 1984 (new buckets) and the 1984–87
term (bucket 1987, backfilled) entered polls.json from the
bonham-additional-aeforecasts mirror (F2F Morgan voting intention,
no published TPP). **The user approved the method: "Implied LEF 2PP
(Recommended)" — flow-to-ALP shares measured at the election that
OPENED the term, applied to the whole term.** User-facing one-liner
(asked & answered in-thread): era tpp is implied, NOT next-election
preferences; it's last-election flows (LEF), opening-era.

## The LEF machinery in `.build/newtracker/flows.mjs`

`FLOW_ERAS` — era-keyed flow-to-ALP shares, derived and backtested
against official 2PP at each era's election (±0.35 max at the scored
elections):

```js
const FLOW_ERAS = {
  1972: { dlp: .2765,               oth: .45 },
  1974: { dlp: .3032,               oth: .45 },
  1975: { dlp: .1551, dem: .5,      oth: .45 },
  1977: { dlp: .27,   dem: .5033,   oth: .45 },
  1980: { dlp: .27,   dem: .5571,   oth: .45 },
  1983: { dlp: .27,   dem: .584,    oth: .45 },
  1984: { dlp: .27,   dem: .6287,   oth: .45 },
};
implied LEF 2PP = alp + era.dem*dem + era.dlp*dlp + era.oth*oth
```

- Era key = the OPENING election of the term; rows carry
  `tppEra: "<that year>"` at 1dp.
- `TPP_ERA_BY_BUCKET` in the bootstrap maps bucket → opening era:
  `{1974:"1972", 1975:"1974", 1977:"1975", 1980:"1977", 1983:"1980",
    1984:"1983", 1987:"1984"}` — NOTE 1984's bucket is scored on the
  1983-era constants (term 1983–84), and the 1984–87 term rows score
  on the 1984 era.
- Grn/onp/uap/nxt are vacant in this period — the formula omits zero
  columns, doesn't zero them.
- The 0.45 `oth` floor is calibrated, not measured; `dem` (Australian
  Democrats, from 1977) is the era-sensitive column. DLP collapsed
  .2765→.1551 across 1974's double dissolution — era boundaries matter.

## Scripts and data flow

- `.build/bootstrap-pre1987-cycles.mjs` (new, one-shot): adds the six
  CYC_META-era cycles to polls.json (buckets 1974–1984), each carrying
  `cyclePollBases[yr].morgan.note` provenance citing "Implied LEF 2PP
  (Bonham ±0.6 pre–Dec-1983 error budget)" and the FLOW_ERAS source.
- `.build/assimilate-bonham-additional-aeforecasts.mjs` extended with
  era lanes: `eraVi` (pre-1987 rows, era-scoped dedupe `date|firm` —
  NOT term-scoped clash identity; era rows are the sole resident of
  their date), and `eraPartyLane` for 1987-bucket backfill (Morgan
  F2F primaries onto existing rows). IMMEDIATE re-run is idempotent
  (0 inserts) because dedupe is date|firm within the era.
- `.build/aeforecasts-src/assimilate-proof.json` — extended proof file
  (same preferred-trail convention as the original import; rows carry
  no in-polls.json marker).
- Map: `{1974:"1974-05", 1975:"1975-12", 1977:"1977-11", 1980:"1980-10",
  1983:"1983-03", 1984:"1984-12", 1987:"1984-12"}` bucket-year →
  earliest MidDate admitted; 123 Morgan rows before 1974-05 stay
  CSV-only (sparse 1949–72 coverage, user decision).

## Right-edge validation gate (the accuracy argument that sold LEF)

For each era, compute the implied 2PP of the FINAL pre-election poll
and compare to the official election 2PP, using OPENING-era vs
CLOSING-era constants:

| cycle | opening-era | closing-era |
|---|---|---|
| 1974 | −1.34 | −1.24 |
| 1975 | −2.55 | −3.61 |
| 1977 | +5.47 | +3.83 |
| 1980 | +1.40 | −1.36 |
| 1983 | +0.56 | −0.71 |
| 1984 | +3.22 | +2.62 |

Opening beats closing in 6/7 (only 1974 marginally prefers closing) —
within-Bonham-budget evidence that last-election flows is the right
convention. Run this gate BEFORE shipping any future era extension;
the numbers above are the recorded baseline (alternatives considered:
published-TPP — none exists pre-1987; flat-average flows — strictly
worse).

## validate.mjs era lanes (all validatable, all shipped)

- `RANGES.dem = [0,20]`, `RANGES.dlp = [0,20]` (they were absent —
  era rows would have failed every numeric check silently).
- `PARTY_KEYS` Σ-watch includes `dem`/`dlp` only when the bucket is
  an era cycle (otherwise legacy rows that omit them lose coverage).
- `OLDEST_ELECTION` guard: 1987 → **1974** (was the date-sanity floor).
- Era rows are exempt from modern-only checks the same way 1987+ cycle
  rows are; nothing era-specific was weakened (Rule 3 stands).

## Display + accuracy-panel ripple

- Cycle counts/card guards in the build tolerate the new buckets
  unchanged (Newspoll-era card logic is already `[1987…].includes(yr)`
  style).
- Accuracy panel: 12 → 18 elections; era misses scored −1.3, −2.5,
  +1.4, +0.6, **+3.2 (1984, new worstCycle)**, +2.6 (1987). **1977 is
  correctly excluded** — last Morgan wave 20 days pre-election,
  outside ACC_WINDOW_DAYS=14. Hard-coded "twelve" count copy lived in
  THREE comment homes (d1a1d215 asset ~:1952, gen-data.mjs ~:2076,
  template.html :2525) — see auspol-accuracy-panel for the list; grep
  before/after any cycle-count change.
- Everything downstream (cycle-source asset rotation, feed/sitemap)
  is ordinary build output; rebuild once, verify both `index.html`
  copies landed.

## Display fallout — empty approval buckets broke the fan (fixed 20ef05e)

The era buckets ship `cycleApproval` as EMPTY arrays (keys 1972, 1974,
1975, 1977, 1980, 1983, 1984 — the F2F Morgan mirror carries NO
GLApp/GLDis, and preferred-PM is a Newspoll-era question). First
approval data is bucket **1987** (35 rows from 1987-08-23; ppm
readings only 3, from 1990-03-04). So era terms hold primary +
implied-2PP series ONLY — which violated a silent display invariant
("every past term holds every measure") in the Past-cycles fan two
days after ship: card captions claimed approval terms "since 1972"
that could not draw, and the PPM card's strip printed "1980 undefined
v" (`ppmPair: null` → key omitted → `String(undefined)`). Fixed in
CycleChart by hasData-gating all fan membership (commit 20ef05e; see
auspol-past-cycles §measure-aware fan membership): approval/PPM fans
and captions now honestly open at the 1987 term.

Filling the gap is POSSIBLE but UNDECIDED (offered 2026-09-14, user
has not replied): `data/trove-leader-approval.csv` holds 121 curated
PM job-rating rows 1942–85 (Morgan Gallup via Trove; cols
date,leader,role,measure,approve,disapprove,…,pollster) — consumed by
NOTHING in the build today. A backfill would map `measure=job-rating,
role=pm` rows to `pmNet = approve − disapprove` in the 1972–84
`cycleApproval` buckets. Opposition-net and preferred-PM have NO
pre-1987 source at all — even after a PM backfill those cards stay
1987-open. If it ships, the measure-aware fan re-anchors captions to
1972 with zero renderer edits.

## If extending further back (pre-1974)

Blocks to clear first: 1949–1972 Morgan rows exist in the mirror
(~123, CSV-only today) but (a) no DLP split post-1974 collapse
pattern differs, (b) `oth` heterogeneity is larger, (c) election
results before 1949 aren't in OFFICIAL_2PP. The LEF pattern
generalises (opening-era dict + right-edge gate); the constants do
NOT — re-derive from AEC/TUV room sources before importing.
