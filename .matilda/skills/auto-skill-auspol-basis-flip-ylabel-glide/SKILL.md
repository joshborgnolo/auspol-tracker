---
name: auspol-basis-flip-ylabel-glide
description: auspol-tracker — the hero .hb-toggle basis flip's y-axis label glide (basisMorph window-slide in the 73de0c58 asset, shipped 2026-09-19): {from:[lo,hi],t} lerped in the same yDomain chain as the matchup morph, ticks enumerated from the destination window so label VALUES hold and positions glide; lines/dots swap instantly by design. Verified headless via .matilda/basis-ylabel-probe.mjs. Zero motion is CORRECT when both bases round to the same auto-fit window (classic ALP v L/NP today). Default matchup on fresh load is alp_on (ALP v One Nation), not classic — the classic switch chip is .hero-alt .ha-chip titled "Show Labor v Coalition".
---

# Basis flip y-label glide

Shipped 2026-09-19 in the `73de0c58` hero asset. The `.hb-toggle` basis flip
(`.hero-basis`, implied flows ↔ respondent-allocated) now animates the y-axis
number labels the way the Switch-2PP matchup morph always did.

## Machinery (all in the 73de0c58 asset)

- `basisMorph` state next to the matchup `morph` state, right after
  `morphRaf` (~:778): `{ from: [lo, hi], t }` seeded from the CURRENT on-screen
  `yDomain`, rAF loop `basisRaf` over the shared `MORPH_MS` (320ms) /
  `MORPH_EASE`; honours `prefers-reduced-motion` (sets nothing, no rAF).
- `chooseBasis()` replaces the old inline `onClick={() => setBasis(...)}` on
  the toggle JSX: `setBasis` + `setMorph(null)` + cancel `morphRaf`, then run
  the slide. Lines/dots contain no blend — they swap instantly on the state
  change, as they always have; there is no canonical interpolation between a
  published series and an implied series.
- `yDomain` chain: `blend ? matchup-lerp : basisMorph ? window-lerp : yTarget`.
  `yTicks` enumerates from `yTarget` (destination), so label VALUES hold still
  and only their positions travel — the matchup morph's own trick.
- Mutual cancellation: `chooseMatchup` nulls `basisMorph`+cancels `basisRaf`;
  `chooseBasis` nulls `morph`+cancels `morphRaf`. Unmount effect cancels both
  rAF refs.

## Invariants / gotchas

- Windows that round identically produce ZERO motion — that is correct, not a
  bug. Classic ALP v L/NP rounded to the same window today (both {45,50,55}
  ticks at 2026-09-19); only matchups whose basis windows actually differ
  (implied-offered ALP v ON: {35..65} implied vs {45,50,55} resp) visibly glide.
- The dirty data pipeline: foreign uncommitted `flows.mjs` WIP (ind/oth split
  rates) shifted the implied-series numbers, which CHANGES the auto-fit
  windows — window equality between bases is data-dependent and re-checked at
  probe time, never assumed.
- Fresh-load default matchup is `alp_on` (ALP v One Nation), NOT classic
  alp_lnp. The only `.ha-chip` rendered lives in `.hero-alt` ("Switch 2PP") and
  points to the OTHER contests; on default that's "Show Labor v Coalition".
  Probes must match chips by `title` attribute ("Show …") — textContent has the
  live figure spliced in ("Labor v Coalition51.6–48.4± 1.5").
- Hero svg id in probes: `svg.chart-svg` with viewBox `0 0 1000 (420|700)`.
  Authoritative figure node: `.hero-readout .roll .sr-only`. Basis state:
  `window.AP.tppBasis`.
- TDZ gotcha still applies: bundler + validate + npm test all pass on a
  ReferenceError while the page renders nothing — a headless probe
  (`.matilda/basis-ylabel-probe.mjs`, samples `text.axis-label.y` every 40ms
  for 900ms per flip, exits 0 on glide-detected) is the only real proof.

## Probe outcomes at ship time (2026-09-19)

- ALP v ON, imp→resp: 45% glides 247.5→291, 55% 160.5→117 (window narrows).
- ALP v ON, resp→imp: labels spread outward, 35% enters at 334.5 (window
  widens); per-label cumulative motion monotonic ≈ displacement.
- ALP v L/NP both directions: zero motion (same rounded window) — correct.
