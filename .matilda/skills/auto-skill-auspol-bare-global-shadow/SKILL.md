---
name: auspol-bare-global-shadow
description: auspol-tracker — page-global constants (window.SM etc.) are consumed as BARE identifiers across the rd-*.jsx sources; a same-named component local silently shadows them, and the break only surfaces inside geometry-gated branches (the phone-only, intermittent symptom class). Includes the diagnosis recipe and the worked 0067ca1 SM case.
source: auto-skill
extracted_at: '2026-10-10T09:58:09.968Z'
---

# Bare-identifier page globals + local-shadow trap (worked 2026-10-10, commit 0067ca1)

## The contract

Session/app globals set on `window` are read as **bare identifiers** from the
compiled JSX sources — no import, no lint, no babel warning. Known smokers:

- `window.SM` — scroll behaviour, set in the `ed2260de` asset:
  `window.SM = window.RD_REDUCED_MOTION ? "auto" : "smooth"`. Consumed as bare
  `SM` in `rd-allpolls.jsx` (Five sites: two reveal effects + two
  jump/scrollIntoView helpers — grep `\bSM\b`), plus `rd.jsx` (rdPinScroll
  ~:1140), `rd-hero.jsx` (snapGo), `rd-cycles.jsx` (goTo).
- `window.AUSPOL` (the data payload), plus the window-exported helpers the
  assets assign to each other (`useNarrow`, `rdTabsKey`, `useRdWidth`, …).

Adding a same-named local in a function that also reads the global silently
shadows it for EVERY closure in that function scope — including `useEffect`
callbacks defined *lexically before* the local's `let`/`const`, because those
closures bind the hoisted declaration. An effect runs after render, so the
binding is already initialised: **no TDZ error, just a silently wrong value**.

## The worked case (phone-only, intermittent menu breakage)

RdHouseLean's sparkline scale was `let SM = 1;`; the tab-reveal effect in the
same function body ran `sc.scrollTo({ left, behavior: SM })` — with `SM`
resolved to that local (a number), not `window.SM`. `behavior` is a WebIDL
`ScrollBehavior` enum; a number throws `TypeError` and the glide never ran.
The React view still switched on tap, the renderer never aborted — the ONLY
symptom was the strip not gliding to show the pressed tab, so the menu looked
"sometimes broken" on the phone.

Why the geometry gate made it phone-only-and-sometimes:

- The tab-strip scroller only exists under a CSS media query (<985px); on the
  laptop the branch containing the poisoned call never fires at all.
- On the phone it fires only when the pressed tab's rect sits outside the
  strip's group rect — i.e. per strip scroll position, hence "sometimes".
- Engine-independent (headless Chrome reproduces it; do not reach for the
  Safari probe ladder for this symptom class first).

Fix pattern (0067ca1): rename the LOCAL (`let SMAX = 1` — four touch points),
not the call sites to `window.SM` (that works but leaves the trap armed for
the next caller in the file). After the rename, re-grep the whole file for
other bare-global uses before rebuilding (`\bSM\b` must show only deliberate
global reads). Lesson is also pinned in the house-lean skill.

## Diagnosis recipe — "works on laptop, intermittently breaks on phone"

1. Map the intermittency to a LAYOUT STATE, not a browser engine: find the
   geometry-gated branch the symptom lives behind (overflowing scroller,
   flex-wrap media query, `useNarrow` rung, pin-when-touch). The "sometimes"
   tracks a live layout quantity (scroll position, fit boundary), so make
   your repro drive that quantity (probe sets `scrollLeft`, presses the
   off-strip tab).
2. Run the area's EXISTING pinning probe before touching source — the
   `hl-tabs-scroll.mjs` probe was red on 6 glide checks the whole week this
   bug lived at 390/360/800px; ALL CHECKS PASSED after the fix. A red probe
   for the exact reported interaction IS your reproduction.
3. For a broken scroll/glide, read every identifier in the effect body and
   ask of each "local or global?" — `grep -n "\bIDENT\b"` the file and check
   no `let/const IDENT` shares the function scope. The bug is a legal,
   warning-free program; static suspicion is cheap, runtime debugging slow.
4. WebIDL enum arguments (`scrollTo.behavior`, scroll `block`/`inline`,
   etc.) THROW on invalid values — an abortive TypeError inside an effect
   leaves the UI half-moved rather than visibly crashed, which is what makes
   these reports description-vague.

Related: `auto-skill-auspol-house-lean-chart` (the panel and its
`.matilda/probe/hl-tabs-scroll.mjs` pinning probe — the reproducer for the
worked case), `auto-skill-auspol-headless-geometry-verify` (assert geometry
headlessly — screenshots are useless to the reviewing model),
`auto-skill-auspol-probe-drift-repair` (the other red-probe discipline:
distinguish legitimate drift from real breakage).
