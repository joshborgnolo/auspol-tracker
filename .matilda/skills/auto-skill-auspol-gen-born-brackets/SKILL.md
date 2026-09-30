---
name: auspol-gen-born-brackets
description: auspol-tracker — the "By generation" dot-plot labels in Who votes for whom → Age carry bracketed voter-clamped ages ("Gen Z (aged 18–29)"; RD_GEN_BORN map + RdGenBorn component in rd-panels.jsx, .rd-wv-born in rd.css), hover (mouse only) / tap swaps the bracket to the birth-year range. Pew ranges, matching the Info glossary's "Generations" entry — two copies move together. Covers the pointerType-mouse hover guard, the 18-floor, the scope boundary (brackets on dot-plot labels only, never width-priced chart end-labels), and the gen-born-probe.
source: auto-skill
extracted_at: '2026-09-30T06:30:28.891Z'
---

# Generation birth-year brackets on the vote-by-group labels

## What shipped (2026-09-30; default reversed same day)

The four "By generation" dot-plot row labels in **Who votes for whom → Age**
(rendered by `RdDemographics` in `.build/newtracker/assets/rd-panels.jsx`)
read e.g. "Gen Z (aged 18–29)" — ages by default (user: "reverse the
default - show age by default, not year range"; it shipped birth-years-first
for a few hours). Hover on a desktop pointer or tap on a phone swaps the
bracket to the birth years.

- `RD_GEN_BORN` (~rd-panels.jsx :1060, right after `RD_DEMO_HOME`):
  `{ "Gen Z": [1997, 2012], Millennials: [1981, 1996], "Gen X": [1965, 1980], Boomers: [1946, 1964] }` —
  the usual **Pew** birth years. Neither pollster (YouGov, RedBridge)
  publishes its own.
- `RdGenBorn` (just after the map): per-label toggle component, returns null
  for unmapped labels, so non-generation rows get nothing automatically.
- Render site: the `dotSet` row label cell (~:1361),
  `{g.label}<RdGenBorn label={g.label} />`.
- `.rd-wv-born` in `rd.css` (right after `body.rd .rd-wv-lab`, ~:1007):
  button-reset (`font: inherit; font-size: 13px`), `--ink-3` → `var(--ink)`
  when `.on`, `white-space: nowrap`. Safe in the 180px desktop label column
  ("Millennials (1981–1996)" fits); the phone label cell can wrap to two
  lines harmlessly.

## Interaction mechanics — the landmines

- **Hover must be guarded to real mice.** `onPointerEnter/Leave` with
  `e.pointerType === "mouse"`. Touch taps fire *emulated* pointer events —
  without the guard a tap sticks BOTH the hover and tapped states, needing
  two interactions to revert. Tap itself is `onClick` toggling a `tapped`
  state; `hover || tapped` selects the birth-years text, exposed as
  `aria-pressed`, with an aria-label ("Gen Z, aged 18 to 29, shows the
  birth years").
- **Ages are voter-clamped at 18**: `Math.max(18, y − born[1]) … y − born[0]`
  where `y = new Date().getFullYear()`. Only Gen Z is affected (its cohort
  runs 14–29 this decade). The user chose the clamp over the literal range
  ("a 14-year-old can't vote") — it matches the glossary's "among voters,
  1997 to 2008", and the floor lifts itself in 2030 when 2012-born turns 18.
- **Hooks stay unconditional**: the `if (!born) return null` sits AFTER the
  useState calls, not before.
- Display is the plain en-dash bracket — "(aged 18–29)" at rest,
  "(1997–2012)" while toggled — sentence case in source, same house
  convention as every other literal.

## Scope boundary (user-confirmed choices)

- Brackets live on the **dot-plot labels only**. Chart end-labels and legend
  entries keep short names — adding "(1997–2012)" there would push the
  width-priced right margins (auto-skill-auspol-endlabel-width-pricing).
  Prose (`RD_DEMO_SHORT`, `RD_TREND_GROUP`, findings/deks) keeps short names.
- The legacy `DemoView` in the a11e1559 asset is dormant under the redesign
  (`if (window.AP.rd) return <RdDemographics …>` at :2319) and was NOT
  touched — its generation labels stay bare.

## The glossary twin — two homes for these ranges

The Info glossary entry `id: "generations"` (d1a1d215 asset, ~:6659) already
listed the identical Pew ranges as prose ("Gen Z, born 1997 to 2012 – among
voters, 1997 to 2008…") plus boundary-year and Silent-generation caveats.
`RD_GEN_BORN` is now the SECOND home — the map's comment says so; edit both
if the definitions ever move. Note the site deliberately does NOT use ABS's
census definitions (ABS Snapshots define generations as AGE BANDS at census
night — 2021: Gen Z 10–24, Millennials 25–39, Gen X 40–54, Boomers 55–74,
Interwar 75+ — i.e. rolling birth years); the user supplied Pew ranges
explicitly.

## Verification

`.matilda/gen-born-probe.mjs` (gitignored) drives headless Chrome against the
built page via a local http server (port 8944): four `.rd-wv-born` buttons
and none elsewhere, each bracket's ages computed from the current year,
hover → expected birth years, revert on mouse-out, emulated-touch tap
toggles both ways, no sideways page overflow at 1200/390/360/320px. Run
after `node .build/newtracker/build.mjs` + `validate.mjs` whenever touching
the labels, the map, or `.rd-wv-born`.

## Source-fetch lesson

The ABS page behind the ranges was minified one-line HTML: a regex grep
match returns the whole file, so extract stripped text or use deep-mode
web_search queries pinned to the chart-description sentence ("The population
is made up of … gen…"). Plan-mode lockdown can also kill read-only shell
calls mid-task — have the search path ready.
