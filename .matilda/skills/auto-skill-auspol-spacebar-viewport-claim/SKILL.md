---
name: auspol-spacebar-viewport-claim
description: auspol-tracker — the SPACEBAR viewport-claim convention (IntersectionObserver visibility claim, NOT pointer hover like auspol-hover-claims-arrows). FIVE claim sites share the one block: All-polls table `#rd-ap-top` (a1c620d), Latest card `#latest-polls`, House-lean `#house-lean` (056c205), the hero `#two-party` matchup step (rd-hero.jsx ~:590-618, gated orderedMatchups.length>1), and the Primary-vote group-menu WALK `#primary-vote` (743ac44, rd-panels.jsx ~:368 — a native <select> stepped in DOM option order with modulo wrap, null ref on /vic/ where no demographics payload exists so Space keeps its scroll day job). The five canonical guards + bail-before-preventDefault + `!e.repeat` split + live-ref pattern (reassign every render, []-deps effect). Probe gotchas: blur after any click; scroll past the WHOLE section; and with ADJACENT claiming sections (snapshot page: hero ends where #primary-vote begins, #latest-polls starts there) park positive checks in the window where ONLY the target claims and run the negative scroll-through somewhere claim-free — for #primary-vote the negative site is BELOW #latest-polls, not offsetTop+height+200. Every new claim also extends the single shared `Space` row in KBD_ROWS (73de0c58 ~:2077).
source: auto-skill
extracted_at: '2026-10-08T12:24:30.482Z'
---

# Spacebar viewport-claim (page-wide family)

Sibling of the pointer-claims-keys pattern (auspol-hover-claims-arrows)
— but where that pattern claims keys by POINTER HOVER, this convention
claims Spacebar by VIEWPORT VISIBILITY: the section's claim is live
while any of it intersects the viewport, regardless of where the
pointer sits. Space is special because its day job (scroll one
viewport) is page-level and valuable, so the claim is scope-limited to
when the control it proxies is actually relevant — and it must HAND
BACK the key the moment that's untrue.

## The canonical block (a1c620d, copied verbatim into RdHouseLean 056c205)

```jsx
const spaceFlip = React.useRef(null);
spaceFlip.current = view === "tpp" ? flipPick : null;   // reassigned EVERY render
React.useEffect(() => {
  const sec = document.getElementById("house-lean");
  if (!sec) return undefined;
  const inView = { current: false };
  const io = new IntersectionObserver(
    (es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
  io.observe(sec);
  const key = (e) => {
    if (!inView.current || e.key !== " ") return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const a = document.activeElement;
    if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (!spaceFlip.current) return;      // bail BEFORE preventDefault
    e.preventDefault();
    if (!e.repeat) spaceFlip.current();  // held-key repeats: swallow, don't act
  };
  document.addEventListener("keydown", key, true);   // CAPTURE phase
  return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
}, []);
```

Load-bearing details, in order of subtlety:

1. **Live-ref over a render-varying callback.** `flipPick` closes over
   current state, so a once-registered listener would go stale.
   `spaceFlip.current = …` at component body level rebinds every render
   and the `[]`-deps effect always calls the freshest closure. (Same
   trick as the vote-cards' `rangeLive.current` in the hover-claims
   skill — the light tool when you can reassign each render; the
   all-polls table's spaceFlip instead re-registers per facet via
   effect deps, the heavy tool.)
2. **Gate the REF, not the effect.** `view === "tpp" ? flipPick : null`
   means on primary views (`"labor"` etc. — views with no ⇄ button) the
   ref is null, so the key falls through to native scroll. Do NOT
   conditionally attach the listener — effect-count churn and stale
   closures; do NOT make spaceFlip a no-op that doesn't preventDefault
   (Space scrolling while claimed would feel broken). Null-ref → clean
   fallthrough.
3. **`e.repeat` split:** `preventDefault` runs even on key-repeat (held
   Space must NOT scroll — that would fight the flip), but the action
   only fires on `!e.repeat` (held Space doesn't machine-gun the
   toggle). Same convention as the page's other key handlers.
4. **Five guards, in order:** defaultPrevented/modifiers (incl. shift)
   · focus BODY/HTML · selection collapsed · in-view claim live · ref
   non-null. Note the hover-claims guard set omits shiftKey; the Space
   claims include it.
5. **Listener priority between overlapping claims:** all claims are
   document-level capture listeners; when two sections intersect
   (house-lean sits inside the all-polls view where the table's own
   spaceFlip is also live), the EARLIER listener in registration order
   fires first and its preventDefault vetoes the rest. RdHouseLean's
   flipPick and the table's flip button render the SAME underlying
   action, so a double-fire there is harmless by construction — when
   adding a new claim, either make the actions identical/idempotent or
   ensure only one can be live (the comment on the house-lean block
   documents this explicitly).

## The five claim sites

- **All-polls table** (a1c620d) — rd-allpolls.jsx ~:2363-2405,
  `#rd-ap-top`: table-level spaceFlip + splitWalk + pubFlip (Space
  walks/flips the table's own controls).
- **Latest card** — rd-polls.jsx:556-575, on section `#latest-polls`
  (spaceFlip gated `facet==="twopp"`; its key handler also owns `p`
  for the published/implied basis while the section is in view).
- **House lean** (056c205, 2026-10-06) — rd-allpolls.jsx ~:3090 in
  `RdHouseLean`, `#house-lean`: Space proxies the panel's own
  "Two-party: Labor v Coalition ⇄" flip button, gated `view==="tpp"`.
  Probe: `.matilda/probe/hl-space-flip.mjs` (port 9007, 14 checks).
- **Hero matchup step** — rd-hero.jsx ~:590-618, `#two-party` body
  card: `spaceStep.current = orderedMatchups.length > 1 ? () =>
  swipeLive.current(1) : null` (Space walks the "Switch 2PP" matchup
  roster like the sideways swipe). Same guards, same canonical block.
- **Primary vote group menu** (743ac44, 2026-10-08) — rd-panels.jsx
  ~:368-401 in `RdPrimary`, `#primary-vote`: Space steps the
  "The primary vote among" `<select>` (rd-pv-sel) — the live ref
  builds the option list as `[""].concat(all group labels)` in the
  SAME DOM order and cycles
  `opts[(opts.indexOf(grpId) + 1) % opts.length]`, so All voters →
  18–34 → 35–54 → … → last group → wrap to All voters. Ref nulled
  when `!T || !T.tabs` — on /vic/ the menu doesn't exist, so Space
  keeps its scroll day job there. Pinned in the pv-group-select probe
  (`== Space walks the group menu ==` block): the 26-option walk in
  DOM order, wrap-around, page never scrolled while claimed, head+dek
  follow the walked selection, FOCUSED select keeps its own Space
  (opening the native menu), and off-claim Space scrolls while leaving
  `select.value` untouched. Keysheet copy rides in the shared `Space`
  row of KBD_ROWS (73de0c58 ~:2077) — extend THAT row for any new
  claim, don't add a second Space row.

## Probe gotchas (first two cost a cycle in hl-space-flip; the rest in pv-group-select)

1. **Blur after any tab/button click before the Space phase.** A probe
   that clicks a measure tab then presses Space will see the button
   natively re-activated (Chrome focuses clicked buttons) — NO scroll,
   and it looks like a claim bug. It's correct behaviour (focused
   controls own Space); the claim correctly stands aside per the
   BODY/HTML guard. `document.activeElement.blur()` in an evaluate
   after every probe click restores the baseline. (Same for a FOCUSED
   `<select>`: Space opens its native menu and no claimant fires —
   that's worth pinning as a check in its own right.)
2. **"Off the viewport" means the WHOLE section.** Scrolling a fixed
   1200px past can leave part of a tall section still intersecting, so
   the claim legitimately fires and the "Space is inert off-screen"
   assertion fails. Scroll by
   `el.offsetTop + el.offsetHeight + 200` and first ASSERT
   `rect.bottom <= 0 || rect.top >= innerHeight` before pressing Space.
3. Assert the negative path too: on a primary view (null ref) Space
   must still scroll the page (`scrollY` increases) — that's the proof
   the gating falls through rather than swallowing the key.
4. **Adjacent claimants eat each other's key.** A claim fires while
   ANY 1px of its section intersects. On the snapshot page the
   claimants are BACK-TO-BACK: `#two-party` (hero) ends where
   `#primary-vote` begins, and `#latest-polls` starts exactly there.
   scrollIntoView({block:"start"})+scrollBy(0,-100) parks the primary
   panel with the hero's last 100px still in view — the HERO's claim
   (registered first; listeners fire in registration order) swallows
   Space, nothing walks, `scrollY` never moves — the debugging symptom
   is "my probe presses Space and literally nothing happens, not even
   a scroll". Diagnose by dumping every claiming section's rect
   (`two-party`, `latest-polls`, `primary-vote`, `house-lean`,
   `rd-ap-top`) at the parked scrollY — one of them will still be
   intersecting. Park positive checks in the window where ONLY the
   target claims: `scrollTo(0, min(prevClaimEnd + 20, nextClaimTop -
   innerHeight - 20))` and ASSERT all neighbours' rects are fully out
   before pressing.
5. **The negative scroll-through must also be claim-LESS.** The
   `offsetTop + offsetHeight + 200` recipe (gotcha 2) worked for
   house-lean, but for `#primary-vote` that point sits INSIDE
   `#latest-polls` — the Latest card's claim then eats the Space and
   "off-claim Space scrolls" fails. Pick the negative site BELOW all
   neighbouring claimants (`latest.offsetTop + latest.offsetHeight +
   200`), then assert scrollY grows AND the walked state (e.g.
   `select.value`) is untouched.
6. **DOM order drives walk assertions.** Read the expected option
   sequence straight from the rendered `<select>`'s `<option>`s —
   it pins both the cycle order and that the walk covers every option
   (26 = All voters + 25 groups on the primary panel).
