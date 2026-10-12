---
name: auspol-allpolls-focus-scroll
description: "All-polls archive: the AP.openPoll → focus → scroll-to-row effect (d1a1d215, the \\[focus, open, facet\\] effect after the focus-effect ~:5055-5305) — what 'clear' must clear, why the scroll must re-place until settled, and the headless-probe recipe (no scrollTo patch — re-run ticks while the openPair key on ap-open.js/:tick effect updates). Worked 2026-10-09, commit c56d835: after AllAPView focusEffect a Who-votes rug dot / poll-detail table / Astro dot dot → AP.openPoll(key, facet, from, split) sets focusPoll and jumps to allpolls; the focus effect clears filters, applies facet/split, setOpen(key), and then a second effect scrolls the row under the reader's eye. Two bugs met in the same loop: (1) clear counted only .tabs.sticky's height, NOT the archive's own pinned chrome (.rd-ap-pinbar + sticky .rd-ap-headwrap at top: calc(--rd-pin + 46px desktop / +44px phone) with --rd-pin = tab-bar height), so on a first-trip landing the row landed UNDER the archive's pinned colHead by up to the bar's height; clear is now max(barH, hwTop + hwHeight) where hwTop is read from getComputedStyle(hw).top; (2) the scroll effect fired ONCE on the [focus, open, facet] commit, but the openPair render chain (filters → facet → row open) is still settling, so the scroll formula measured against a TRANSIENT layout and the row's document top kept drifting while the scroll stayed frozen; the effect now places() on each animation frame until the row's document top holds still twice in a row (still<2), capped at 900ms — the table's eventual shape is the one the row lands under."
source: auto-skill
extracted_at: '2026-10-09T03:07:21.458Z'
---

# All-polls focus-scroll — "a little too low" after clicking a dot

The trip: a chart dot / Who-votes rug dot / a heap of call sites fire
`window.AP.openPoll(key, facet, from, split)` (registered in the 73de0c58 asset
~:2401). That sets `focusPoll = {key, facet, split, back:{tab, y, from}}`,
switches to the `allpolls` tab, and updates the hash. Inside `AllPollsView`
(d1a1d215) the **focus effect** (~:5055-5083) clears ALL filters, applies
`focus.facet`/`focus.split` (with `demPairOf` fallback), and `setOpen(focus.key)`.
Then a second effect, the **focus-scroll effect** (~:5097+), measures the row+its
open detail and calls `window.scrollTo` to land the pair under the eye.

## What `clear` must clear

`clear` is how much vertical headroom the scroll formula subtracts so the row
isn't hidden behind pinned chrome. It must account for the worst-case chrome
that can sit pinned at the landing scroll position:

- the site's global tab bar — `.tabs.sticky`, height is `bar.getBoundingClientRect().height`;
- the archive's **own** pinned chrome — `.rd-ap-headwrap` (the sticky container for the pinbar + column headings or the phone scale header). It pins at `top: calc(var(--rd-pin) + 46px)` (desktop) / `+44px` (phone), where `--rd-pin` is set to the tab-bar's height by `fit()` in rd-allpolls.jsx (~:2394). Its computed `top` is therefore the tab-bar height + the pinned-gutter (46 or 44px).

Because `.rd-ap-headwrap`'s computed top already includes the bar height, the
correct `clear` is:

```js
const hw = document.querySelector(".rd-ap-headwrap");
const barH = bar ? bar.getBoundingClientRect().height : 0;
const hwTop = hw ? (parseFloat(getComputedStyle(hw).top) || 0) : 0;
const hwH = hw ? hw.offsetHeight : 0;
const clear = Math.max(barH, hwTop + hwH) + 10;
```

The `max(barH, …)` guards the pre-mount case where hw isn't in the DOM yet.
Don't just add `barH + hwH` separately — `hwTop` already includes the bar
height, and adding it again double-counts the bar.

**Don't hardcode 92 or 87.** Those are desktop/phone values of tab-bar + pinned
gutter at the time of writing, not layout contracts.

## Why the effect re-places every frame until the row's doc-top holds still

The single-scroll version of this effect fired once, on the
`[focus, open, facet]` commit, and measured `row.getBoundingClientRect()` +
`window.scrollY` AT THAT INSTANT. But opening a row on a facet you weren't on
kicks off a settle chain:

1. focus effect commits → filters cleared, facet set, `setOpen(key)`.
2. the row starts rendering `.open`, the matching `rd-ap-open` detail begins to
   mount inside `bodyRef`.
3. while the detail's own effect is still building, the pair's DOM height
   changes; the row's `offsetTop` moves.
4. if you scrolled against (1), your scrollY is now wrong — you're measuring
   against a transient layout.

So the effect now:

```js
let raf = 0, last = -1, still = 0;
const t0 = Date.now();
const tick = () => {
  raf = 0;
  const row = bodyRef.current && bodyRef.current.querySelector("tr.arch-row.open, .rd-ap-row.open, .rd-ap-card.open");
  const top = row ? row.getBoundingClientRect().top + window.scrollY : -1;
  if (top >= 0 && top !== last) { last = top; still = 0; } else still++;
  place();
  if (still < 2 && Date.now() - t0 < 900) raf = requestAnimationFrame(tick);
};
place();
raf = requestAnimationFrame(tick);
return () => { if (raf) cancelAnimationFrame(raf); };
```

- `place()` is the scroll formula, extracted from the effect body so the tick
  loop and the initial call share it.
- The loop schedules another tick only while the row's doc-top is still moving
  (`still < 2`) — once two consecutive samples see the same top, the chain is
  settled; stop.
- 900ms cap is generous — the known settle chain finishes in well under a
  second — and prevents a bug elsewhere (a perpetually growing layout) from
  burning rafs forever.
- The effect's cleanup cancels the raf.

Bonus: `clear` and the five-tab / facet CSS stubs are all inside `place()`, so
the raf ticks re-read them each pass — a probe that sneaks an extra
`.rd-ap-pinbar` in mid-flight is handled.

## The probe recipe (headless Chrome)

See `.matilda/probe-ap-focus-scroll.mjs` (gitignored) for the full skeleton.
Drive a real browser page and record geometry; don't monkey-patch
`window.scrollTo` — in this headless setup the native call ends up applied at
the wrong time (`scrollY` stays 0 while the patched `scrolls` records
`y=3534`), which makes the probe hallucinate.

What the probe measures:

```js
const row = document.querySelector(".rd-ap-table .rd-ap-row.open");
const pair = row && row.nextElementSibling;
const hw = document.querySelector(".rd-ap-headwrap");
const pb = document.querySelector(".rd-ap-pinbar");
const bar = document.querySelector(".tabs.sticky");
// …getBoundingClientRect() for each, plus what's at the row's top-left
// via document.elementFromPoint (should be the row itself, not the pinbar).
```

Pass cases:

- `hw.pinned === true` (headwrap is actually pinned — else the table is
  mid-settle, not yet a landing)
- `row.top > pb.getBoundingClientRect().bottom` (~10px buffer, not deep in
  the pinbar)
- `elementFromPoint(row.left + small, row.top + small)` returns the row
  (or the pair), not the pinbar.

Run at two viewports: the archive changes `.rd-ap-row` → `.rd-ap-card` and
the phone rung's headwrap padding changes at ≤720px, so a desktop-only green
doesn't prove the fix. `VW=390 VH=844 node .matilda/probe-ap-focus-scroll.mjs`.

## Sequencing gotchas

- The `allpolls` tab is a redesign tab, so `body` gets `.rd` and rd.css takes
  over body styles — a scroll probe must scroll `window`, not
  `document.documentElement`.
- The poll you're opening has to actually exist (`individualPolls` is the
  live list; don't hardcode a key the previous session moved). The probe
  script specialises per test — for the rug-dot flow the key is a
  `Newspoll (pooled)` pooled Q2 wave; for the Essential test it picks the
  most recent Essential row at runtime.
- `openPoll` timeout: the effect waits for the row to appear before it can
  compute (`open !== focus.key` gate). Drives with `waitForFunction` on the
  row selector, not a fixed `setTimeout`.
