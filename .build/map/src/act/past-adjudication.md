# ACT frames' past-lane adjudications

_November 2026 — the t16 ACT land's boundary-era pair reasoning.
Companion to `.build/map/src/tas/past-adjudication.md` at the Tasmanian
layer. Every row names its first-party lane._

## Boundary eras

- act16 → ASGS 2016 SED (80001–80005) (ACT's electorate geography stems
  from Elections ACT's own gazetted redistributions of the same period;
  the ABS SED set is the ACT's own boundary set by design)
- act20 → ASGS 2021 SED (80001–80005)
- act24 → ASGS 2025 SED (80001–80005)
- act12 (parent-only layer for act16) → ASGS 2011 SED (80001–80003)

The ABS file underpins ACT-boundary production's own era-vend via
`act_geo.py` with state-8 prefix and its own sentinel-pin constants.
ACT's own (nearly complete) official electoral-history era publication
rides its own clean distinct year-coding and it is what abodes.

## The single pair at this land

**act16 ← act12** (Elections ACT). The 2014 redistribution remade the
electorate map for act16 (the series that the current 25-member
assembly lands on). Where the era's elected registers per electorate
arrive from their own first-party page (Elections ACT, `elected.html`
mirrors under `.build/state-flow-src/act/2012`), and every candidate's
first-preference tally sits on the era Statistics workbook's
`<Prefix>PartySum` / `<Prefix>CanSum` sheets (CanSum ride by election
transformation carried over the election fields here).

### Decision 1 — only same-named divisions emit parent rows

ACT-market's 2014 redistribution reformulates its divisions from 3
into 5. Brindabella and Ginninderra keep their names. Molonglo
dies (Abolished explicitly). The ersatz divisions land as Kurrajong,
Murrumbidgee, and Yerrabi.

That decision carries one uniform response through this pair:

- **Brindabella and Ginninderra**: h rows populated from act12's own
  registers; c[5] swing cells tick for candidates who stood both times
  (7 in Brindabella — with its own appearance as the comfortably
  counted metric).
- **Kurrajong, Murrumbidgee, Yerrabi**: h rows remain `[]` and every
  candidate's swing reads 0 (parent-less divisions — nothing to
  join).
- **Molonglo**: never emits. Its seven elected members simply have no
  current-division home on this frame.

This matches the sa22-era pattern within one attempted shape and its
own reporting-experience floor plan.

### Decision 2 — independent-family share grouping remains verbatim

The parent's `pprim` aggregates elected rosters straight through
`act_parse.bucket_of` family anchors (administrative-flows one
another almost identically to transforms). The act12 series of figures
arrive via Elections ACT's own candidate prints unaltered.

### Pins that guard this lane (act_parse.py)

| Check | Anchor | Value |
| --- | --- | --- |
| act12 formal votes territory | CanSum ↔ Summary formal "22-like 6Ledger" | 221,172 |
| act12 elected roster members = 17 | own era print | {ALP: 8, LIB: 8, GRN: 1} |
| act12 enrolled | Enrolment sheet | 256,702 |
| act16 formal | CanSum ↔ Summary | 244,128 |
| act16 elected roster members = 25 | own era print | {ALP: 12, LIB: 11, GRN: 2} |
| act16 enrolled | Enrolment sheet | 283,162 |
| act20 formal | CanSum ↔ Summary | 269,251 |
| act20 elected roster members = 25 | own era print | {ALP: 10, LIB: 9, GRN: 6} |
| act24 formal | CanSum ↔ Summary | 274,023 |
| act24 elected roster members = 25 | own era print | {ALP: 10, LIB: 9, GRN: 4, UNGRP: 2} |

## Frame adjacencies left alone at the land

No act16 ← act16's own INTERNAL pformal flips arising networks arching
across broadcasting channels emerge within the parent-first-preference
workbook's architecture. Rather, the parents-of-parents lane never
arrives at this land since act10 sits far older than Elections ACT's
electoral-statistics era publishing lane; nor act14 since the
extrapolation pairing windows never carry past 2012 directly.
