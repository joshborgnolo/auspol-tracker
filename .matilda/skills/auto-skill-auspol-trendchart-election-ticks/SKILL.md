---
name: auspol-trendchart-election-ticks
description: auspol-tracker — the TrendChart x-axis month-tick machinery and the "missing edge month tick" failure mode. rdXTicks (rd.jsx:910) keeps a JANUARY-PHASED month grid ((month−1)%step===0, desktop long-window step 3 → Jan/Apr/Jul/Oct), so a chart window that opens between grid months (the direction chart's at May 2025) labels its first tick LATE ("Jul 2025") and the user reports "the May 2025 ticker is missing". The shared fix is rdElectionTicks (rd-panels.jsx:31) with elecX as a dx year fraction (2025 + 122/365 = 3 May 2025, day-of-year/365): an "Election" landmark tick + spread algorithm, guarding back to plain month ticks when the election falls outside the range (the 12-month view). Consumers: 2PP hero, RdPrimary, RdMood (14abedc), RdDirection (1a9c681), RdLeadership lchart, RdUndecided main, firm-by-party rd-firm- small multiples, not-firm-by-age rd-soft-age (all four 1f1b44d, via the data-driven base row — new consumers should use D.aggPrimary.find(d=>d.election), never a hardcoded date). The function is vic-aware (span > 2.5y → January-only years; crowd-drop tuned for the November election). RdPrimary GROUP charts (6bc4969) fall back to the all-voters election row for the landmark when the selected group has no own election cut — rings/sub-lines stay gated on the per-group row.
source: auto-skill
extracted_at: '2026-10-06T12:13:14.143Z'
---

# TrendChart x-axis ticks — January-phased grid vs the Election landmark

User report that lands here: "the <panel> chart is missing the <month>
<year> x-axis ticker" — almost always the FIRST month of the chart's
window, and almost always a phased-grid miss, not missing data.

## rdXTicks — the month grid (rd.jsx:910)

```js
function rdXTicks(x0, x1, narrow, opts)
```

- Candidates: every month on the `D.MONTHS` spine in `[x0−0.02, x1]`
  (spine = election month → latest-poll month; `D.mx(ym)` mid-month year
  fraction).
- Keep rule: `(month−1) % step === 0` — the phases are ANCHORED ON
  JANUARY regardless of where `x0` sits. Default step: span>1.1 → 3
  desktop / 6 phone; span>0.6· narrow 3 / desktop 2; shorter → every
  month. `opts.step` overrides.
- Labels: January AND the first kept tick carry the year ("Jan 2026";
  phone "Jan ’26" — the curly apostrophe is deliberate, "Jan 26" reads
  as a date).

**The miss:** an election-anchored window opens at mid-May
(`mx("2025-05") − 0.06`). Step 3 keeps Jan/Apr/Jul/Oct; May and Jun are
filtered out, so the axis's first label is "Jul 2025" and the chart
looks like it lost two months. Nothing is wrong with the data.

## rdElectionTicks — the shared fix (rd-panels.jsx:31)

```js
function rdElectionTicks(x0, x1, narrow, elecX)
```

Delegates to rdXTicks with its own step choice, then grafts the
landmark:

- Step: span > 2.5y → 12 (Januaries: a finer step got labels thinned
  out and the Januaries — which carry the years — went with them, "E,
  Jul, Jul"); span > 1.1y → phone 4 / desktop 2; else default.
- **Guard:** `elecX == null || elecX < x0 − 0.01` → plain rdXTicks, no
  Election mark. This is what keeps the 12-month and narrower ranges
  ticking months exactly as before — verified by simulation before
  1a9c681 shipped.
- Crowd-drop: keeps only ticks with `k.x − elecX > max(0.1, span·0.06)`
  so the landmark has room (tuned against /vic/'s November election
  abutting January).
- The first follow tick drops a repeat of the election's year (handles
  both "Jan 2025" and "Jan ’25" shapes) — "Election" already dates the
  axis.
- Prepends `{x: elecX, label: "Election", strong: true, short: "E"}`;
  `short` is what a small multiple falls back to when "Election" can't
  sit between neighbours.

Companion: `RD_ELECTION_LEAD = "0.5 4"` (rd-panels.jsx ~:52) — the
dotted lead-in bridging the election mark to the first polled month.

## elecX convention — now DATA-DRIVEN (don't copy the old hardcode)

PREFERRED pattern since 1f1b44d (patterned on RdPrimary,
rd-panels.jsx:67) — reads the jurisDICTION's own baseline election row
out of the data (RdMood and RdDirection still carry the older
hardcoded constant; leave them, use this for every NEW consumer):

```jsx
const base = (D.aggPrimary || []).find((d) => d.election) || null;
… rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : null)
```

gen-data unshifts an `election: true` row onto aggPrimary
(gen-data.mjs:896), and `ELECTION = ELECTIONS[JUR ? JUR.baseline :
"e2025"]` (gen-data.mjs:223) — so /vic/ (BUILD_JUR=vic) marks ITS
election through the same code path and the federal constant never
leaks onto a satellite. WITH `base = null` the rdElectionTicks guard
falls back to plain rdXTicks, so the pattern is safe everywhere.
The hardcoded federal form was `year + dayOfYear/365` on gen-data's dx
counting (3 May 2025 = `2025 + 122/365`); grep `122 / 365` in
rd-panels.jsx for any remaining legacy sites.

## Group-mode variant — landmark without a per-group election row (6bc4969, 2026-10-08)

Charts whose election baseline VARIES WITH THE SELECTION break the
`base ? base.x : null` pattern. RdPrimary's group view (the All-voters
dropdown) computes `base` from the SELECTED GROUP's own election row
(`D.demoStateElection`/`D.demoLocElection` keyed by group label); for
gender, age, education, generation, housing and language groups there
IS no own row (`base = null`), and the strict guard dropped the group
chart to the bare January-phased grid — its first tick read
"May 2025" next to the all-voters chart's "Election".

Fix: point the LANDMARK ONLY at the all-voters election row when the
group has none —

```js
xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow,
  base ? base.x : allBase ? allBase.x : null)}
```

The rule to hold: the landmark labels the CALENDAR (when the count was
taken), not a group figure — so it is safe to borrow allBase.x for the
axis. Everything that DISPLAYS a group-election VALUE (the ring marks,
the dek's "lost its election-night vote" clause, "since the election"
sub-lines) must stay gated on the per-group `base` and stay ABSENT for
groups the AEC never cut by — never surface a number for those. The
delta affordance that replaces them ("since July 2025" from the group's
first monthly row) and the dotted ring-to-line lead-in live in
auto-skill-auspol-primary-group-view.

## Worked application — National direction (1a9c681, 2026-10-06)

The direction chart used bare `rdXTicks`; the fix was the one-liner

```jsx
xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, 2025 + 122 / 365)}
```

with a comment explaining the July-open miss. Pre-ship verification was
NODE-LEVEL, not a browser probe: simulate the helpers over the real
`D.MONTHS`/`D.mx` for desktop, phone, and the 12-month range (they're
pure over `window.AUSPOL`), and diff the label lists — desktop
`Election | Jul | Sep | Nov | Jan 2026 | …`, the 12-month range showing
no Election mark. An optional puppeteer probe can follow the
auspol-headless-geometry-verify skeleton but isn't needed for a pure
tick-list change.

## Vic-satellite check

Before shipping any hardcoded federal election x into a shared panel,
confirm the satellite impact: /vic/ (BUILD_JUR=vic on
`data/vic-polls.json`) has no `direction` series, so RdDirection returns
null there and the federal constant was dead code — no regression.
rdElectionTicks itself is already vic-aware (its January-step and
crowd-drop comments name the four-year term and November election), so
prefer routing a satellite chart through it with ITS elecX rather than
bare rdXTicks. Better still, the data-driven base row above makes the
satellite case automatic.

## Worked application — the four remaining charts (1f1b44d, 2026-10-06)

The user asked "are there any charts that should election tick in x
axis that don't". Audit rule: a chart belongs here when its
`rangeDomain("all")` window OPENS AT the election month (the
direction-chart miss shape). Four qualified: RdLeadership's `lchart`,
RdUndecided's main panel, the firm-by-party smalls (`rd-firm-`,
hardcoded `narrow=true` kept), and not-firm-by-age (`rd-soft-age`).
Deliberately EXCLUDED: issues trend (~rd-panels.jsx:3255 — window
starts when issue data starts, election not at the edge),
vote-switching (no xTicks), discord/house-lean in the d1a1d215 asset
(the older `buildXTicks` family, not rdXTicks), past-cycles
`CYC_XTICKS` overlays, and explicit-year arrays. Each edit inserts
`const base = (D.aggPrimary || []).find(d => d.election) || null;`
just above the chart JSX and swaps the xTicks arg.

**Node-simulation gotcha (cost a cycle):** inside
`node --input-type=module -e`, `eval()` is strict-mode and function
declarations scoped INSIDE the eval do NOT leak to module scope —
`eval(src)` then calling `rdElectionTicks(...)` throws
`ReferenceError: rdElectionTicks is not defined`. Fix: make the eval
RETURN the helpers —
`const { rdXTicks, rdElectionTicks } = eval(srcX + "\n" + srcE + "\n({ rdXTicks, rdElectionTicks }))` —
or run as CommonJS. Also verify the regex-extracted function bodies
before eval: a non-greedy `/function rdElectionTicks[\s\S]*?\n\}/`
stops at the FIRST line-starting `}`; these two functions happen to
end their bodies with `\n}` so it works, but for any other helper use
`indexOf` + slice-to-next-`\nfunction `. Expected lists after 1f1b44d
(federal term): desktop All `Election | Jul | Sep | Nov | Jan 2026 |
Mar | May | Jul | Sep`; phone All `Election | Sep | Jan '26 | May |
Sep`; 12-mo range and a 2026-open (vic-style) window and `elecX=null`
all plain month grids, no Election mark.
