---
name: auspol-theme-toggle-system
description: 'auspol-tracker — the dark-mode/theme-toggle subsystem end-to-end, including the Option+D keyboard shortcut (shipped 2026-10-03). All in the 73de0c58 asset: theme state is useTweaks(TWEAK_DEFAULTS) at ~:2038 (t.theme ∈ light/auto/dark, persisted), isDark resolves auto via a live matchMedia listener ~:2384, applyChrome flips body {dark,editorial,cool} inside document.startViewTransition ~:2402-2431 with the module-level chromeSettled first-paint flag, cycleTheme = () => setTweak("theme", isDark ? "light" : "dark") at :2433, and the rocker UI is Header''s two .seg-btn.theme-cell buttons :479-495 (mouse flips ride the .theme-seg pointer handlers; onClick only fires for e.detail===0 keyboard clicks) with CSS in template.html :815-870 on top of the body.dark token block :149-241. The Option+D handler sits right after cycleTheme (:2436-2456): mount-once document keydown reading cycleTheme through a ref refreshed every render (the swipeRef pattern — a mount-once closure over cycleTheme flips from the FIRST render''s stale isDark and can never flip back), e.code==="KeyD" because macOS Option+D types ∂ into e.key, guards on defaultPrevented/e.repeat (autorepeat strobes the view-transition crossfade)/meta/ctrl/shift/editable fields (INPUT·TEXTAREA·SELECT·isContentEditable keep Option characters), preventDefault to own the combo. TDZ: the listener cannot be defined earlier than cycleTheme''s const in the function body. Probe: .matilda/probe-theme-key.mjs — trusted chords via page.keyboard.down("AltLeft")+down("KeyD"), synthetic document.dispatchEvent(KeyboardEvent) for the guard paths (repeat/meta/bare-D), 700ms settle because the class flip lands inside the view-transition callback, assert document.body.classList.contains("dark"). Satellite pages are SEPARATE: .build/site-shell.mjs''s shell switch toggles :root.sh-dark (dark tokens sit at :root there vs body.dark on main — see auspol-headless-geometry-verify''s page-parity note); the Option+D handler does not exist on satellites, and extending it is its own task. Discoverability was deliberately NOT shipped: no ⌥D hint in the theme-cell title attributes (:481/:490) — if asked, that''s the one-line addition. Windows caveat: Alt+D focuses the address bar in Windows Chrome/Edge (preventDefault claims it); user is macOS-first and asked for it explicitly.'
source: auto-skill
extracted_at: '2026-10-03T13:39:22.257Z'
---

# Theme toggle system — rocker UI, view-transition application, Option+D

Shipped Option+D 2026-10-03 (user ask "wire option+d to dark mode toggle").

## Where everything lives (all main-page, 73de0c58 asset unless noted)

- **State** — `const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)` in App
  (~:2038). `t.theme` is `light` / `auto` / `dark`; persistence is
  useTweaks' business. `const isDark = t.theme === "dark" || (t.theme ===
  "auto" && sysDark)` (~:2384) with `sysDark` fed by a `matchMedia(
  "(prefers-color-scheme: dark)")` change listener kept live (~:2376-2383).
- **Application** — `applyChrome()` toggles body classes
  `{editorial, cool, dark}` from ONE effect (~:2402-2431) wrapped in
  `document.startViewTransition(applyChrome)`. Module-level `chromeSettled`
  flag: the first (page-dressing) application must not fade in, and as a
  component ref it was reset during start-up remounts — keep it module
  scope. reduced-motion, hidden tab, and missing API all fall back to a
  clean cut.
- **Flip** — `const cycleTheme = () => setTweak("theme", isDark ? "light" :
  "dark")` (:2433). Writes an EXPLICIT light/dark — a flip drops an
  `auto` choice, by design.
- **Rocker UI** — `Header` (:168) takes `{ isDark, onToggleTheme }`; two
  `.seg-btn.theme-cell` buttons (:479-495) each
  `onClick={(e) => { if (e.detail === 0) onToggleTheme(); }}` — the click
  path is keyboard-activation only (detail 0); MOUSE flips go through the
  seg's pointer handlers (`onSegDown/Move/Up` on
  `.theme-seg.segmented`, the rocker drag). CSS: template.html :815-870;
  dark tokens: `body.dark` block template.html :149-241; head
  `theme-color` metas emitted by build.mjs (~:864-865, `THEME` consts
  :248) — iOS paints the strip behind the status bar from them.
- **Satellites** — NOT this system. `.build/site-shell.mjs`'s shell header
  switch toggles `:root.sh-dark` and shares the persistence key, so a
  choice made anywhere holds everywhere, but Option+D fires only on the
  main page. Extending the key to satellites is separate work — ask before
  assuming scope.

## Adding a global single-key shortcut (the pattern the handler is)

The Option+D handler (:2436-2456) is the template for "one key, anywhere
on the page":

```jsx
const keyRef = useRef(actionThisRender);   // after the action's const —
keyRef.current = actionThisRender;         // TDZ, cannot anchor earlier
React.useEffect(() => {
  const onKey = (e) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey ||
        e.shiftKey || !e.altKey) return;
    if (e.code !== "KeyD" && e.key !== "d" && e.key !== "D" && e.key !== "∂") return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" ||
        a.tagName === "SELECT" || a.isContentEditable)) return;
    e.preventDefault();
    keyRef.current();
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, []);
```

Non-obvious points, each earned:

- **Ref-refreshed-per-render is mandatory** (same reason `swipeRef.current
  = { tab, goTab }` is assigned in the render body, ~:2139): a mount-once
  effect closure captures the FIRST render's `cycleTheme`, whose `isDark`
  never updates — the first keypress flips to dark and every later
  keypress "flips" from the stale `false` again. Probe symptom would be
  "toggles once, then stuck".
- **`e.code`, not `e.key`** — macOS Option+D types `∂` (layout-dependent)
  into `e.key`; the physical key's `e.code` is `KeyD` on every layout.
  Keep an `e.key` fallback anyway for environments with no `code`.
- **`e.repeat`** must be out: autorepeat flips straight through the
  view-transition crossfade — a strobe.
- **Editable fields keep Option characters** — Option+letter chars are
  legitimate typing on macOS.
- **`preventDefault` after all guards** — on Windows Chrome Alt+D is the
  address-bar chord; claiming it is deliberate (user is macOS-first and
  asked), but do it only when the key actually matched.

## Discoverability — deliberately not shipped

No `⌥D` hint in the title attributes yet ("Light mode" / "Dark mode" at
:481/:490). If the user asks, it's a one-line edit to those two strings
(they are title/aria pairs — keep them in step).

## Verification probe recipe (.matilda/probe-theme-key.mjs, scratch)

- Trusted chord: `page.keyboard.down("AltLeft")` → `down("KeyD")` → ups.
  Puppeteer's trusted path is needed for the happy path; synthetic events
  are fine for GUARD-path asserts.
- Guards: `document.dispatchEvent(new KeyboardEvent("keydown", {bubbles:
  true, cancelable: true, …}))` with `{repeat:true}`, `{metaKey:true}`,
  bare `{code:"KeyD"}` etc. — assert no flip.
- The class flip arrives inside the `startViewTransition` callback — a
  ~700ms settle before reading `document.body.classList.contains("dark")`.
  First ever flip applies WITHOUT the transition (chromeSettled=false),
  the second one transitions — settle after both.
- Editable guard: append a real `<input>`, `.focus()` it, trusted chord,
  assert no flip (and `document.activeElement` still the input), remove.
- Two flips in one probe: initial state read first and everything asserted
  RELATIVE to it (`const start = await isDark()`) — useTweaks persistence
  means the starting theme isn't guaranteed.
