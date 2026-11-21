---
name: auspol-map-vm-harness-stubs
description: "auspol-tracker — when a .build/test-map-*.mjs run throws ReferenceError for an app constant (STATE_YEARS, STATES, FAMS…) right after a map-app change: those tests eval .build/map/app/*.js inside a hand-fed vm.createContext, and the app gained a cross-file constant or derived-state dependency the stub lacks. Repair by mirroring faithful stubs in the harness, never by patching the app"
source: auto-skill
extracted_at: '2026-11-07T01:16:37.428Z'
---

# Map VM-harness stub drift — diagnosis and repair

Worked 2026-11-07 (fixed in 3b636e08): `test-map-vote-bands.mjs` went red
on main after commit 53e6bb3c ("keep the Winner head's figures scope across
a year switch") made `statScopeOk`/`statBreakdownRows` consult constants
owned by app-1-base.js. The harness crashed `ReferenceError: STATE_YEARS is
not defined` at the first scope call.

## How the failure forms

Several `.build/test-map-*.mjs` suites run the map's unbundled app sources
per file through node:vm:

```js
const ctx = vm.createContext({ S, STATE_TITLE: states, STATE_SHORT: short, M: () => current, esc, f1, int, sgn, coalW });
vm.runInContext(read(".build/map/app/app-4-story.js"), ctx);
const api = vm.runInContext("({ vtBands, vtScope, vtBlock, statScopeOf })", ctx);
```

The vm context only exposes what the test literally lists. `app-4-story.js`
runs against itself plus those globals — identifiers it reads from OTHER
files (constants from app-1-base.js: `STATE_YEARS`, `STATES`, `CLS`,
`CLS_SHORT`, `FAMS`; or derived model state like `m.areas` built by
`deriveAreas`) simply do not exist. When someone edits the APP side to
consult a new cross-file identifier, every harness that reaches it throws
`ReferenceError: <X> is not defined` (or a TypeError off a missing model
property), even though the shipped bundle is fine — map.js is assembled
from all files, so production never sees this. The failure is STUB DEBT,
not an app regression.

## Triage first (shared-checkout discipline)

In this shared tree, a red suite step may instead be a sibling's UNCOMMITTED
hunk in the test itself. On the same day `test-map-draw.mjs` failed on a
stray unstaged assertion `melb.A.b` (raw `core-2025.json` div rows carry no
derived `A`/`B`). Rule: before repairing anything, check
`git status --short` + `git diff -- <the-test>`; if the break is in
unstaged sibling work, leave it AND its unstaged files alone (never stage
their paths — see git-prestaged-commit-sweep / shared-repo-session-race),
flag it to the owner, don't "fix" their in-progress assertion.

## Repair pattern

1. Confirm the symbol IS defined app-side (`grep -n "const STATE_YEARS" .build/map/app/*.js` — it's app-1-base.js here), so the app is right and the harness is stale.
2. Add faithful stubs to the vm context, mirroring the owner file verbatim with a comment naming the origin (`// the app gates a state scope pick on STATE_YEARS (statScopeOk, app-1-base.js)`).
3. Derived state: construct ONLY the shape the app reads. `m.areas` needed `{formal, idx}` per area — mirror `deriveAreas`' field set, not the app's whole computation: `current.areas = Object.fromEntries(Object.entries(current.res.agg).map(([st,a]) => [st, {formal: a.formal, idx: current.res.divs.flatMap((d,i)=> st==="AUS"||d.st===st ? [i] : []) }]))`.
4. Expect a CASCADE of one missing symbol at a time — run the suite after each addition rather than guessing the full set. This session's sequence: STATE_YEARS → m.areas.formal → STATES (and CLS/CLS_SHORT not far behind) → FAMS. Four runs, each naming exactly the next stub.

Do NOT patch the app to satisfy the harness (e.g. replacing module constants
with context lookups) — the constants are the bundle's ground truth and the
bundle is what ships.

## Where it sits in the gate

`npm test` includes this suite; a harness gap lands the whole project CI red.
Run order for a map change: `node .build/map/assemble.mjs` →
`node .build/test-map-page.mjs` → `node .build/test-map-vote-bands.mjs`
(plus the other test-map-* siblings before pushing: draw/areas/geo/
geo-build/boundary-vintages/history/senate/urban/primary-breakdowns).

Related: auspol-probe-drift-repair (the same "new feature lands, committed
pin goes red" shape for the .matilda/probe world), auspol-map-vote-type-panel
(the content being tested when this surfaced).
