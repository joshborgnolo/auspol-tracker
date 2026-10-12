---
name: auspol-filter-commit-transition
description: auspol-tracker — "the All-polls Pollster/Time/Includes select is
  dead for ~2s after a pick" (fixed 2026-10-09, memo sections + React
  startTransition). Chromium could NOT reproduce it — the stall is
  WebKit-biased, so measure in a WKWebView heartbeat probe. Fix = two rungs:
  React.memo on the filter-independent sections below the table (kills ~¾ of
  the JS), then wrap the filter-state setters in React.startTransition so
  the concurrent-root commit is interruptible and the control frees
  immediately (syncYield 72→0ms in WebKit while the table commits in chunks).
source: auto-skill
extracted_at: '2026-10-09T04:45:57.246Z'
---

# Heavy-view commit → startTransition + section memo (All-polls filter lag)

Symptom (user, 2026-10-09): press "Fox & Hedgehog" in the All-polls
Pollster menu; the same control can't be pressed again for ~2s. Fix
landed as two rungs; BOTH are needed — rung 1 removes work, rung 2
makes the remainder yield.

## Diagnosis ladder — don't trust Chromium alone to confirm or clear

- Chromium measurer (`.matilda/probe/ap-filter-lag.mjs`, always exit 0;
  `RATE=4` CPU throttle, longtask collector + 0ms-timeout syncYield per
  pick, `Profiler.enable` self-time dump): unthrottled ~60–90ms per pick,
  longtasks 0, profile = dozens of ~2ms minified React render hits, no hot
  function. Under a `React` concurrency-shaped bug that is "fine".
- WebKit heartbeat measurer (`.matilda/probe-ap-filter-lag-wk.swift`,
  WKWebView = Safari's engine; the user is on Safari). No Longtask API in
  WebKit — the channel is a rAF HEARTBEAT recording inter-frame gaps >40ms
  plus a 0ms-timeout `syncYield`. Pre-fix it showed pick-shaped main-thread
  blocks Chromium barely felt. When Chromium says 100ms and the user says
  2s, build the WKVprobe BEFORE redesigning anything (see
  safari-webkit-probe-ladder for harness traps).
- React version gate: startTransition/deferred need a CONCURRENT root —
  this app mounts `ReactDOM.createRoot` (73de0c58 asset :2818, vendored
  React 18.3.1, `.build/newtracker/vendor/versions.md`), so they work.

## Fix rung 1 — memo the sections that don't consume the filters

`<RdAllPolls>`'s siblings under it — `<RdDisagree/>`, `<RdHouseLean/>`,
`<RdFlows/>` (rd-allpolls.jsx :3440/:3587/:4183, rendered in d1a1d215
:~5794–5796) — read window.AUSPOL engines, none of the filter state, but
re-rendered (three TrendChart sections) on every filter commit. Wrapped
at the window export in rd-allpolls.jsx:

```js
const RdDisagreeM = React.memo(RdDisagree);   // …HouseLean/Flows too
Object.assign(window, { …, RdDisagree: RdDisagreeM, … });
```

Memo trap: `RdHouseLean` gets `onMeasure`, which was an inline closure
re-minted per render — a useless memo. Stabilise FIRST:
`const onMeasure = React.useCallback((mv) => { … }, [])` in d1a1d215
(its captures are both useState setters, always stable). Memo only
skips when every prop is referentially stable; audit each one.

## Fix rung 2 — transition the filter STATE SETTERS, not the render

In d1a1d215 AllPollsView the three selects' state lives in
`sel`/`tagSel`/`range`. Wrapped every path a pick can take:

- `toggleHouse` / `toggleTag` → body inside `React.startTransition(() => setSel(new Set…))`.
- Bare-setter props (`setSel`, `setRange`, `setTagSel`) are handed to
  RdAllPolls — define transition twins and THOSE become the props:
  `const setRangeT = (v) => React.startTransition(() => setRange(v));`
- `clearAll` batches 8 setters: ONE `startTransition` around the whole
  batch — splitting them (some sync, some transitioned) would make TWO
  renders instead of one. `setQ` stays sync (controlled input).
- Pill removals (`off: …`) flow through the same toggles/twins.

Effect shape after: the select's `value=""` snap-back now waits for the
transition commit (label shows the picked option ~200–500ms — cosmetic);
the CONTROL is live instantly (WebKit syncYield 72→0ms; Chromium @4×
CPU ~500ms→16–26ms total); the heavy commit lands in interruptible
chunks (heartbeat gaps show 2× ~50–70ms frames instead of one wall).

Same treatment applies to any "heavy view behind a control" in this
app — the preferred fusion is memo everything the control doesn't
consume, transition the state it does.

## Verification battery

- Functional receipt `.matilda/probe/ap-filter-transition.mjs` (exit 1
  on failure): house pick applies (pill + row-count move), select snaps
  back, URL gets `w=`, pill × removes, time+includes both land, Clear
  all empties. 7/7. Re-run THIS after any further surgery on the
  setter layer — a transition swallowed/broken by a refactor fails here.
- Timing receipts: `node .matilda/probe/ap-filter-lag.mjs`
  (`RATE=1|4`) and recompile+run the WKVprobe against :8735
  (`node .matilda/diag-server.mjs`).
- `node .build/newtracker/build.mjs` rebuilds index.html after source
  edits (`d1a1d215-…js` and `rd-allpolls.jsx` are both SOURCES the build
  compiles); then `node .build/newtracker/validate.mjs` exit 0.
