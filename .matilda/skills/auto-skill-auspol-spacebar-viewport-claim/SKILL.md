---
name: auspol-spacebar-viewport-claim
description: auspol-tracker — the SPACEBAR viewport-claim convention (IntersectionObserver visibility claim, NOT pointer hover like auspol-hover-claims-arrows). NINE claim sites share the one block: All-polls table `#rd-ap-top` (a1c620d), Latest card `#latest-polls`, House-lean `#house-lean` (056c205), the hero `#two-party` matchup step (rd-hero.jsx ~:590-618, gated orderedMatchups.length>1), the Primary-vote group-menu WALK `#primary-vote` (743ac44, rd-panels.jsx ~:368 — a native <select> stepped in DOM option order with modulo wrap, null ref on /vic/ where no demographics payload exists so Space keeps its scroll day job), the Preference-flows region roll `#flow-drift` (2026-10-15, rd-allpolls.jsx ~:5196 — cycles the ledger's FF_REGIONS menu All voters → Inner metro → Outer metro → Regional → wrap, live ref nulled when FF is falsy so Vic keeps the scroll day job; the same section's contest tabs take the HOVER arrow claim instead), the Who-votes party chips `#who-votes` (2026-10-15, rd-panels.jsx ~:2699 — cycles DEMO_PARTIES onp→alp→lnp→grn→oth modulo wrap, ref nulled without the demographics payload), and the voter-switching panel's title cycler `#switching` (2026-10-15, rd-panels.jsx ~:3263 — GO_NEXT onp→lnp→alp modulo wrap over the came-from/going views, ref nulled when the vote-switching payload is absent so /vic/ keeps the scroll day job). The five canonical guards + bail-before-preventDefault + `!e.repeat` split + live-ref pattern (reassign every render, []-deps effect). Boundary band ownership: the who-votes/switching pair registers with rdSpaceClaimOn/Off and gates on rdSpaceDominant (rd.jsx; 2026-10-15) — where the two share the screen the BIGGER viewport share owns the key, fixing registration order vetoing the lower panel. Probe gotchas: blur after any click; scroll past the WHOLE section; and with ADJACENT claiming sections (snapshot page: hero ends where #primary-vote begins, #latest-polls starts there) park positive checks in the window where ONLY the target claims and run the negative scroll-through somewhere claim-free — for #primary-vote the negative site is BELOW #latest-polls, not offsetTop+height+200; flow-drift is the all-polls LAST section, so it can only be scrolled out ABOVE — but scrolling above puts rd-ap-top/house-lean's OWN Space claims on screen, so they must be parked off first or they (earlier registration) win. Every new claim also extends the single shared `Space` row in KBD_ROWS (73de0c58 ~:2077).
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
   claims include it. EXCEPTION (user call 2026-10-15): in the All-polls
   and Latest facet tables the focus guard admits ONE focused element —
   the facet menu's SELECTED tab
   (`a.getAttribute("aria-pressed") === "true"` inside
   `.rd-ap-tabs [role="group"], .rd-ap-pintabs` resp.
   `.rd-pl-tabs [role="group"]`) — because rdTabFocus puts the click
   focus there and Space would otherwise dead-fire the same facet pick.
   Inactive tabs and every other control keep the key's day job; the
   act-null-before-preventDefault rule still decides. The Past-cycles
   summary (2026-10-15) admits it too, with a twist: a focused
   `aria-pressed="true"` tab in either of `#cyc-summary`'s two
   `.rd-cc-tabs` groups ("Compare with" / "Measure") steps the OTHER
   group (rd-cycles.jsx ~:1158, the Space branch atop the effect's
   key handler) — native Space there would dead-fire a re-pick of the
   tab already picked, so the claim turns the admission into the
   complement step; an UNPRESSED tab keeps native Space.
5. **Listener priority between overlapping claims:** all claims are
   document-level capture listeners; when two sections intersect
   (house-lean sits inside the all-polls view where the table's own
   spaceFlip is also live), the EARLIER listener in registration order
   fires first and its preventDefault vetoes the rest. RdHouseLean's
   flipPick and the table's flip button render the SAME underlying
   action, so a double-fire there is harmless by construction — when
   adding a new claim, either make the actions identical/idempotent or
   ensure only one can be live (the comment on the house-lean block
   documents this explicitly). **Registered pairs arbitrate by viewport
   share instead** (2026-10-15, rd.jsx `rdSpaceClaimOn` /
   `rdSpaceClaimOff` / `rdSpaceDominant`, exported on window): a claim
   that registers its section id adds `if
   (!window.rdSpaceDominant("<id>")) return;` after the in-view check —
   in the boundary band where two registered sections are both
   part-visible, the section occupying the BIGGER share of the viewport
   owns the key, measured at key time off live rects (`>=` keeps a
   literal 50/50 with the earlier listener, which fires first anyway).
   Before the rule, registration order alone settled the band: the
   who-votes chips' last 1px vetoed the whole voter-switching panel
   beneath it (user report 2026-10-15). who-votes and switching are the
   registered pair; unregistered claims keep registration order. Both
   handover directions are pinned in sw-space-cycle.mjs's boundary
   block.

## The nine claim sites

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
- **Preference flows region roll** (2026-10-15) — rd-allpolls.jsx
  ~:5196 in `RdFlows`, section `#flow-drift`: `spaceReg.current` cycles
  the ledger's `FF_REGIONS` <select> All voters → Inner metro → Outer
  metro → Regional → wrap (modulo, `setTip(null)` on a step), and is
  nulled when `FF` is falsy so /vic/ — no forced-choice payload —
  keeps Space's scroll day job. Same canonical IO block; the section's
  contest TAB walk is a HOVER claim instead (see
  auspol-hover-claims-arrows). Probe gotcha specific to this section:
  `#flow-drift` is the all-polls view's LAST section, so it can only
  ever be scrolled out ABOVE — but scrolling above puts the rd-ap-top /
  house-lean Space claims on screen, and THEY win (registered
  earlier). Positive checks must first park inside `#flow-drift` with
  `#rd-ap-top` and `#house-lean` asserted off-screen; the negative
  check is "scrolled clear above → Space leaves the menu untouched",
  not "scrolled below" (impossible). Pinned in the desktop block of
  `.matilda/probe/flows-ledger.mjs`.
- **Who-votes party chips** (2026-10-15) — rd-panels.jsx ~:2699-2735
  in `RdDemographics`, section `#who-votes`: `spaceParty.current`
  steps the party chips in DEMO_PARTIES order — onp One Nation → alp
  Labor → lnp Coalition → grn Greens → oth Others → wrap to onp, the
  same order the 1..5 digit keys number — via `pickParty` (the same
  rdPinScroll + chooseParty morph a chip click runs), modulo:
  `DEMO_PARTIES[(findIndex(party) + 1) % 5]`. Ref nulled when
  `!T || !T.tabs || !T.tabs.length` — the panel never mounts without
  the demographics payload (/vic/), so Space keeps its scroll day job
  there. Same canonical IO block and guards (incl. shift), PLUS the
  registered-pair arbitration: the effect's `rdSpaceClaimOn` /
  `rdSpaceDominant` gate shares the key with `#switching` by bigger
  viewport share (see rule 5). Probe:
  `.matilda/probe/wv-space-party.mjs` (port 9023, 12 checks) — parks
  the page where ONLY `#who-votes` of {two-party, latest-polls,
  primary-vote, who-votes, switching} claims, walks five steps
  asserting the wrap, asserts scrollY never moved, pins that a
  FOCUSED chip natively activates (pressed becomes THAT chip, not the
  next), and finds the negative spot by scanning below the panel —
  INCLUDING `#switching`, the flush section beneath — for a y that is
  both claim-free AND ≥60px above `scrollHeight - innerHeight` (the
  page bottom itself has no scroll left, so the negative check fails
  spuriously if parked there). Keysheet copy rides the shared `Space`
  row of KBD_ROWS.
- **Voter-switching title cycler** (2026-10-15) — rd-panels.jsx
  ~:3263-3297 in `RdSwitching`, section `#switching`: `spaceCyc.current`
  cycles the panel's three title-cycler views via hoisted
  `GO_NEXT = {onp:"lnp",lnp:"alp",alp:"onp"}` — Where One Nation's
  voters came from → where the Coalition's voters are going → where
  Labor's voters are going → wrap — through a FUNCTIONAL `setView(v =>
  …)` that mirrors the render path's V-collapse (a `view` not in
  `S.going` resolves to `"onp"` first; `V` itself is derived post-guard
  so it can't be captured at ref-assign time). Same canonical IO block
  (hooks placed BEFORE the payload-guard early return or hooks-order
  breaks); ref nulled when `!S || !S.series.length || !S.series.every(
  rate)` — mirroring the panel's own not-rendered condition, so /vic/
  (no vote-switching payload) keeps Space's scroll day job. The panel's
  own title BUTTON taps do the same cycle by click; a FOCUSED title
  button therefore natively taps itself exactly once on Space — the
  claim stands aside per the BODY/HTML guard, so pin "taps exactly
  once", not "does nothing". Same registered-pair arbitration as
  who-votes above (`rdSpaceClaimOn("switching")` + the
  `rdSpaceDominant` gate). Probe: `.matilda/probe/sw-space-cycle.mjs`
  (port 9024, 23 checks) — including the boundary-band block: with
  `#who-votes`'s tail and `#switching`'s head sharing the screen, the
  bigger viewport share owns Space, pinned in BOTH directions (came-from
  stays put while the chips walk; chips stay put while the views
  cycle). Two probe gotchas of its own: a going view renders as
  `.rd-go-wrap` at ANY width (de385e6 made the desktop draw the mosaic
  svg, the phone draw the ladder rows — the post-mosaic probe looked
  for `.rd-go-rows`, desktop-only false); and the "restore the load
  view" tail must re-park off the claim band before closing, or the
  final assertions read the mid-walk state. Keysheet copy rides the
  shared `Space` row of KBD_ROWS.

## Probe gotchas (first two cost a cycle in hl-space-flip; pv-group-select and wv-space-party paid for the rest)

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
7. **The negative spot needs scroll HEADROOM, not just claim-freedom.**
   Parking at `document.body.scrollHeight - innerHeight` (the page
   bottom) to get clear of every claim leaves Space with nowhere to
   scroll — "off-claim Space scrolls" fails on the floor, not on a
   bug. Scan downward for a y that is claim-free AND
   `scrollY < scrollHeight - innerHeight - 60` before pressing (the
   wv-space-party probe found 7900 that way).
8. **Native Space ACTIVATES a focused button.** The claim stands
   aside for any focused control — so a focused chip/tab gets
   natively pressed (`aria-pressed`/`aria-selected` flips to THAT
   control, not the next in the walk). Pin the focused-case
   expectation accordingly ("focused control owns Space"), then blur
   and assert the claim resumes its walk from there.
