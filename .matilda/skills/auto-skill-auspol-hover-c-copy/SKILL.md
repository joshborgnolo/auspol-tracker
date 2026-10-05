---
name: auspol-hover-c-copy
description: auspol-tracker — hover+"c" copies the chart (or expanded poll breakdown) under the pointer (shipped 2026-10-03, the user-endorsed "hover-c copy" half of the shortcuts push): a PLAIN-script pointerover claim + bubble keydown in copy-chart.js (one handler serves .chart AND .poll-detail via `closest()`, querying the card's two direct-child button classes and CLICKING the card's own copy button so key and mouse share copyChart/copyPoll compose → clipboard → download fallback and the flash). THE GUARD ASYMMETRY is the transferable lesson: arrow keys guard on body/html focus but LETTER keys (c, ?, Option+D) guard on the text-field set (INPUT/TEXTAREA/SELECT/isContentEditable) — the all-polls expand row CLICKS leave the row focused, and a body-guard would disarm "c" on exactly the card the user just raised; probe .matilda/probe-keys-poll.mjs failed exactly that way before the guard relaxed. Touch-first devices ((hover: none)) never install the tracker or handler. Keysheet row lives in KBD_ROWS (auspol-keysheet). Probes .matilda/probe-keys.mjs + probe-keys-poll.mjs.
source: auto-skill
extracted_at: '2026-10-03'
---

# Hover + "c" copy (auspol-tracker)

Shipped 2026-10-03 as the action half of the shortcuts push. One PLAIN-
script handler in `.build/newtracker/assets/copy-chart.js` (a PLAIN-list
script — rebuild `build.mjs`, never touch built index.html) covers both
copyable card kinds. Sister skills: `auspol-copy-chart-image`,
`auspol-copy-poll-image` (the compose pipelines it clicks through),
`auspol-hover-claims-arrows` (the React-side pointer-claims family this
is the plain-script sibling of), `auspol-keysheet` (its KBD_ROWS row).

## The whole machinery (appended to copy-chart.js, before the boot block)

```js
if (!(window.matchMedia && window.matchMedia("(hover: none)").matches)) {
  let hoverCopy = null;
  document.addEventListener("pointerover", (e) => {
    hoverCopy = e.target && e.target.closest ? e.target.closest(".chart, .poll-detail") : null;
  });
  document.addEventListener("keydown", (e) => {
    if (!hoverCopy || (e.key !== "c" && e.key !== "C") || e.defaultPrevented || e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (!hoverCopy.isConnected || !hoverCopy.getClientRects().length) { hoverCopy = null; return; }
    const btn = hoverCopy.querySelector(":scope > .chart-copy-btn, :scope > .poll-copy-btn");
    if (!btn) return;
    e.preventDefault();
    btn.click();
  });
}
```

## Why it's shaped this way

- **One handler, both card kinds.** `pointerover` keeps the claim as the
  raw event target bubbles: `e.target.closest(".chart, .poll-detail")` maps
  any inner element to its card (or null — the claim REBUILDS on every
  pointerover, so leaving the card for anything unclaimed clears it; there
  is no pointerleave listener to get wrong). The React claims family uses
  pointerenter/leave + refs for per-component scope; this plain script has
  no component boundaries, and the recompute-on-over achieves the same
  "claim never survives the pointer leaving the card" contract with less
  state.
- **Click the card's OWN button — do not call the composer.** The button
  click reuses the attach-time closure (host binding), the mouse
  preventDefault/stopPropagation pair, `copyChart` clipboard→download
  degrade, and the 1.6s `flash` — zero divergence between key and mouse.
  A direct `copyChart(hoverCopy)` call would duplicate the pipeline
  invocation and skip the disable/label invariants attached to the button.
- **`:scope > .chart-copy-btn, :scope > .poll-copy-btn`** — copy-chart and
  copy-poll attach DIRECT children of the card; nested cards inside a
  `.chart` (none at ship date) must not be matched by a deep selector.
- **Liveness before click** — the MutationObserver re-attach can leave a
  stale claim spanning a re-render; `isConnected && getClientRects().length`
  drops it (the same liveness pair the leadership dual-panel claim uses).
- **`(hover: none)` never installs** — mirrors the mobile-overflow lesson:
  no pointer, no claim, and no dead key handler on touch-first devices.
- **Shift needed for uppercase-C is excluded by `e.shiftKey`** — a held
  Shift also blocks the copy while allowing Cmd+C (browser copy-selection)
  to keep its day job via the modifier line.

## THE GUARD ASYMMETRY — the lesson that cost a probe cycle

Two guard sets exist in this repo and they are NOT interchangeable:

- **Arrow keys** guard on `activeElement` being BODY/HTML — a focused
  control keeps its own arrows (rdTabsKey rows, tabpanel caret moves).
- **Letter keys** (`c`, `?`, ⌥D's inner check) guard on the TEXT-FIELD set
  only: INPUT/TEXTAREA/SELECT/isContentEditable.

The poll probe `.matilda/probe-keys-poll.mjs` shipped with the arrow guard
and FAILED: expanding an all-polls row is a CLICK, and Chrome focus-follows
the click onto the row (`<button>`-role rows are in tab order) — the row
holds focus while its `.poll-detail` is expanded, and the body-guard
disarmed "c" on exactly the card the user had just raised. Symptom: chart
branch ALL PASS, poll branch dead on the same code path. Fix: letter keys
take the text-field guard (commit comment in copy-chart.js names the
distinction). If a future LETTER shortcut copies from a card reachable
only by click, use the text-field set from the start; if a future ARROW
shares its rollout with focusable rows, use body/html.

## Probe pair (`.matilda/`, gitignored)

- `.matilda/probe-keys.mjs` — the keysheet AND the chart branch of hover-c
  from the default view; the clipboard dance needs stubs on
  `evaluateOnNewDocument`: `navigator.clipboard.write` increments a counter,
  `ClipboardItem` classed, `HTMLAnchorElement.prototype.click` counts
  download-fallback clicks (assert both stay at the right path's counter).
  NOTE: the Snapshot view carries NO .poll-detail — the poll branch skips
  there by design; do not read the skip as failure.
- `.matilda/probe-keys-poll.mjs` — `#allpolls`, clicks the first row to
  expand it, waitsForSelector `.poll-copy-btn`, hovers the CENTER of
  `.poll-detail` (scrollIntoView({block:"center"}) — the button intersects
  the pointer but the claim must be the card), synthesises keydown "c",
  polls `__clipWrites` up to 5s (the poll compose is synchronous-but-slow;
  250ms steps), asserts clipboard-path-not-download and the off-card
  disarm. 20×250ms proved enough headroom at 1200px card rasterisation.
