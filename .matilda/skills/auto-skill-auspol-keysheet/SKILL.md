---
name: auspol-keysheet
description: auspol-tracker — the "?" keyboard-shortcut sheet (shipped 2026-10-03, same pass as hover-c copy and Option+D): KBD_ROWS as a module-scope const in the 73de0c58 asset right before function App(), one state-dependent keydown effect toggling on "?" and closing on Escape, JSX between </main> and <TweaksPanel>, CSS in template.html cloned token-for-token from .term-pop (this repo has NO monospace — chiclets are var(--sans)), and the page-turn arrow veto selector gained ".rd-keysheet". The sheet takes focus on open so every body-focus-guarded key claim on the page stands down behind it free; focus returns to whatever held it on close. MAINTENANCE RULE: every new keyboard shortcut gets a KBD_ROWS row — the sheet is the keys-system state of record. Probes .matilda/probe-keys.mjs + .matilda/probe-keys-poll.mjs.
source: auto-skill
extracted_at: '2026-10-03'
---

# The "?" keys sheet (auspol-tracker)

Shipped 2026-10-03 as the discoverability half of the keyboard-shortcuts
push ("? cheat sheet + hover-c copy — one makes the system legible, the
other monetises the hover-claims precedent", user: "Do those two."). The
other half is `auspol-hover-c-copy`; Option+D lives in
`auspol-theme-toggle-system`.

## Where everything lives

- **Row data** — `const KBD_ROWS = [{ keys: ["⌥","D"], what: "…" }, …]` in
  the 73de0c58 asset at module scope, immediately before `function App()`.
  Keys are sentence-case chips + a one-line description; the chips are
  `<kbd>` elements at render time.
- **Behaviour** — inside `App()`, after the Option+D theme-key effect:
  `const [keySheet, setKeySheet] = useState(false)`, a keydown effect, a
  focus effect. `keySheetEl` ref lands on the sheet div.
- **JSX** — `{keySheet && (<div className="rd-keysheet-scrim">…)}` between
  `</main>` and `<TweaksPanel>` (no portal — z-index 900 scrim sits above
  the app because the term-pop scrim does).
- **CSS** — template.html `.rd-keysheet*` block, inserted immediately
  after the `.term-pop` block; term-pop's scrim/card/head/x tokens cloned
  wholesale so the two popups read as one family. THE REPO HAS NO
  MONOSPACE FACE and no `--mono` token: key chiclets are
  `600 12px var(--sans)` on `--surface-2` with a 1px+2px-bottom border
  pair (that pairing is what sells "keycap" without a mono font).
- **Row count at ship: 8** — page-turn ←/→ · ⌥/Alt D theme · C copy ·
  hover arrow walk · 1–9 chips · all-polls Space matchup flip · all-polls
  P published-only · ? itself. Keep prose one line per row; the sheet is
  the cheat sheet, not the manual.

## The keydown effect design (careful: it changed shape mid-task)

```js
React.useEffect(() => {
  const onKey = (e) => {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
    if (e.key === "?") { e.preventDefault(); e.stopPropagation(); setKeySheet((v) => !v); }
    else if (keySheet && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setKeySheet(false); }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [keySheet]);
```

- **ONE always-on handler, deps `[keySheet]`.** Do not split into an
  open-effect and a close-effect: the first cut shipped only the
  `if (!keySheet) return undefined` close effect and the sheet COULD NOT
  OPEN (the open path had been left in a deleted draft of the split).
  The toggle reads `setKeySheet(v => !v)`, and the Escape branch reads
  the live `keySheet` from closure — re-registering per state change is
  what keeps both honest. Effect ordering means exit-2a doesn't arise:
  this registers cleanup-safe like every other keys effect in the asset.
- **Text fields keep their `?`** — the text-field guard set (INPUT /
  TEXTAREA / SELECT / isContentEditable), same set the Option+D effect
  and the hover-c handler use; this is the repo's LETTER-KEY guard (the
  arrow keys' body/html guard is stricter — see auspol-hover-c-copy for
  why the two differ).
- **`stopPropagation` beside `preventDefault`** so no other document-level
  keydown on the same event (page-turn arrows, hover claims) acts on a `?`
  the sheet consumed.
- **Escape only closes when open** — a term-pop / RdQPop beneath keeps its
  own Escape contract; nothing in the sheet touches those.

## The focus contract (why no pointer/claim interference)

```js
React.useEffect(() => {
  if (!keySheet) return undefined;
  const back = document.activeElement;
  const el = keySheetEl.current;
  if (el) el.focus();                      // the sheet div is tabIndex={-1}
  return () => { if (back && back.focus && back.isConnected) back.focus(); };
}, [keySheet]);
```

Every hover claim and the page-turn arrow walk guard on "focus must be
BODY/HTML", so the focused sheet (a div) silences the ENTIRE keys layer
behind it without a single extra guard — the `?`-and-Escape handler above
is the only listener that acts while it's up. The JSX is
`role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
tabIndex={-1} ref={keySheetEl} onClick={(e) => e.stopPropagation()}`;
the scrim `<div>` carries `onClick={() => setKeySheet(false)}`, so scrim
clicks close and card clicks (stopped) don't. There is deliberately NO
focus trap/focus-lock list — term-pop precedent ships without one.

## The veto list

The page-turn arrow walk's popup veto (73de0c58, the `swipeRef` keys
effect) is a querySelector test, extended to
`".rd-qpanel, .term-pop, .rd-keysheet"`. Adding any new full-page popup:
extend THAT selector too or Left/Right will page-turn behind it.

## Adding a shortcut = three edits max

1. The key handler where it belongs (theme key in 73de0c58; card keys in
   copy-chart.js; row keys in the row component).
2. One `KBD_ROWS` row (keys array + one-line `what`) — the sheet stays
   honest only if this is treated as part of the feature, not docs.
3. If the key opens a popup, extend the arrow-walk veto and the sheet's
   own dismiss story.

## Probes

`.matilda/probe-keys.mjs` (18 checks): open/toggle/Escape/scrim/×,
eight rows render, text-field `?` is typing, arrows vetoed while open,
focus into the dialog on open and back to its previous holder on close.
`.matilda/probe-keys-poll.mjs` covers the hover-c poll branch on
`#allpolls` (see auspol-hover-c-copy). `.matilda/` is gitignored.
