---
name: auspol-hover-claims-arrows
description: auspol-tracker — the pointer-claims-keys pattern (transient hover key-scope, "the claim never survives the pointer leaving the card"), shipped in SEVEN rungs 8e305ae (Latest card, rd-polls.jsx) → 9730f02 (All-polls card, rd-allpolls.jsx) → 0f163f6 (both vote cards, rd-hero.jsx + rd-panels.jsx) → dd087b4 (both Leadership panels, rd-panels.jsx) → becaa5b (Who votes for whom, The issues, Undecided, rd-panels.jsx) → 62f5521+a27c584 (Past cycles compare + measure rows, rd-cycles.jsx) → a877a98+590a74e (the claim escapes the arrow family: ↑/↓ on the issues trust grid, digit keys 1–5 on the who-votes party chips). The canonical guard block + per-site wiring (facetPick so the rdPinScroll pin fires, hero's combined swipe/hover ref, shared rangeId state stepping BOTH vote cards' menus, single ldHover ref naming which of two adjacent panels is hovered with an isConnected/rects liveness guard for the rd-hidden sibling, the Issues' two-claim one-listener (outer view row vs inner whom-card, inner claims by depth) and the Undecided effect's must-precede-its-practical-return placement), the reusable probe harness (viewport-clamped moveOver with sticky-bar inset; focus assertions via .focus() not coordinate clicks — page.click on a row scrolled under the sticky navbar hit a main-nav button; snapshot the NEIGHBOUR row's tab at phase start instead of asserting the default; the issues two-tier has THREE planes, so the view-claims-section assert requires moving to the row outside BOTH claims' card), and the add-one checklist for extending the claim to another row; plus the navbar pointer-click blur (leftover nav-tab focus vetoes EVERY claim — arrows turn the page on first hover until anything in-page is clicked; Tabs onClick blurs when e.detail>0). Sister of auspol-rdtabs-arrow-walk (the FOCUSED walk this pattern claims on behalf of).
source: auto-skill
extracted_at: '2026-09-30'
---

# Pointer-claims-keys (hover key-scope)

The site-wide roll-out completed 2026-09-30 across SEVEN rungs (the
last — a877a98+590a74e — took the claim past the arrow family: ↑/↓ on
the issues trust grid and digit keys 1–5 on the who-votes party chips).
User-endorsed contract, quoted verbatim: **"any row that takes ←/→ when
focused also accepts the hover-claim, and the claim never survives the
pointer leaving the card."** Rung 7 generalised the same sentence by
key family, with user direction: **"do the same for issues, down arrows
(whos trusted)"** and **"those keys should work when hover focus"** —
a row's hover claim = whatever keys its FOCUSED walk owns (arrows,
digits), never anything else.

This is NOT focus-follows-mouse: pointerenter/leave on a card flips a
ref; a CAPTURE-phase document keydown steps the row's existing walk
while the pointer is over it. Real keyboard focus always wins.

## The canonical block

```jsx
const hoverKeys = React.useRef(false);
React.useEffect(() => {
  const sec = /* the claiming element (getElementById or a ref) */;
  if (!sec) return undefined;
  const enter = () => { hoverKeys.current = true; };
  const leave = () => { hoverKeys.current = false; };
  hoverKeys.current = sec.matches(":hover");
  sec.addEventListener("pointerenter", enter);
  sec.addEventListener("pointerleave", leave);
  const key = (e) => {
    if (!hoverKeys.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = document.activeElement;
    if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    /* bail BEFORE preventDefault when the step can't run */
    e.preventDefault();
    /* step+wrap one index through the row's own setter */
  };
  document.addEventListener("keydown", key, true);
  return () => {
    sec.removeEventListener("pointerenter", enter);
    sec.removeEventListener("pointerleave", leave);
    document.removeEventListener("keydown", key, true);
  };
}, [ /* the state the handler closes over */ ]);
```

Guard set (all five, in order): arrow keys only · no modifiers /
defaultPrevented · focus must be body/html · text selection collapsed ·
bail before preventDefault when the lookup fails (mirrors the
`__rdSwipe` return-false convention — the keys still turn the page when
the row can't step). The page-level walk (73de0c58 `swipeRef` keydown
effect) and every rdTabsKey row respect defaultPrevented, so a claim
that preventDefaults wins cleanly; the claim's capture phase beats them.

## Leftover navbar focus vetoes every claim (fixed 2026-09-30)

User report: on the All-polls page, first-hover ←/→ TURNED THE PAGE
instead of stepping the facet row; after clicking anything in the page,
hovering the table worked. Not a claim bug — a focus bug:

1. Chrome focuses a `<button>` on click, so clicking "All polls" in the
   main navbar left keyboard focus on that nav tab. `goTab` (73de0c58
   :2092) never clears focus and the navbar never unmounts, so the
   focus rides across the view swap.
2. Every site claim correctly bails on its "focus must be BODY/HTML"
   guard while the nav tab holds focus.
3. The keydown's target is the focused navbar tab, so the navbar's own
   `Tabs.onTabKeyDown` (d1a1d215 :294) consumes ←/→ and walks the
   views — the page turn the user saw.
4. Clicking anywhere in-page drops focus to BODY (blank click) or to an
   in-page control (its own focused walk) — symptom gone.

The fix is ONE SITE, not the nine guard blocks: the navbar tab's
onClick (d1a1d215, beside `tabIndex={active === t.id ? 0 : -1}`) is now

```jsx
onClick={(e) => { onChange(t.id); if (e.detail) e.currentTarget.blur(); }}
```

`e.detail` is 0 ONLY for keyboard-activated clicks (Enter/Space), so
AT/keyboard activation keeps focus per the ARIA tabs pattern and only
pointer clicks release it. After the blur, non-hovering arrows still
turn the page via the existing page-level walk — no behaviour lost.
The rdTabFocus'd IN-PAGE rows are deliberately untouched: their
click-focus IS where their walk lives. The navbar is different because
its job is navigation, so its click-focus is a leftover, not a
commitment. Chrome-only bug (Safari/Firefox-macOS never focus buttons
on click — the rdTabFocus asymmetry in reverse).

**Diagnostic shortcut for "the hover claim doesn't fire":** check
`document.activeElement` before suspecting the claim effect — if it's
a BUTTON outside the claimed section, the claim is standing aside
correctly and the fix belongs at whatever navigated and kept focus
(navbar, a jump pill), not at the guard. Known unfixed cousin: the
All-polls pinbar `rd-ap-pinl` jump pills also keep focus after a
pointer click, but arrows then degrade to native page-scroll (no page
turn) — left as-is under the "focus wins" contract.

Regression phase in `.matilda/probe-hover-allpolls.mjs`: real
`page.click("#tab-snapshot")` then `page.click("#tab-allpolls")`,
assert `activeElement` falls back to BODY, then the FIRST table hover
steps the facet and the hash stays "allpolls". Probe placement
respects the page-turn-last lesson: the phase sits before the final
"leaving the card restores the page-level walk" phase and ends on the
allpolls view so that final phase still works.

## The six ship sites

- **Latest card** (8e305ae) — rd-polls.jsx, section `#latest-polls`,
  steps its facet row.
- **All-polls** (9730f02) — rd-allpolls.jsx, section `#rd-ap-top`,
  steps by calling **`facetPick(FACETS[f].id)`** — NOT `onFacet` — so
  the rdPinScroll pin (`pinAp`) fires on every hop exactly as the row
  walk does. Effect deps `[facet]`: the handler re-registers per facet
  change so its closure always sees the current one (the register-once
  closure would go stale without a `.current`-style indirection).
- **Vote cards** (0f163f6) — hero 2PP (rd-hero.jsx) + Primary vote
  (rd-panels.jsx). Wrinkles:
  - The two charts share ONE range state (`rangeId`/`setRangeId`), so
    hovering either card's card steps both menus — the probe asserts
    the pressed tabs stay in lockstep.
  - The hero already had `swipeMark` on TWO elements (figures strip
    `.rd-tpp-read` + chart card `.rd-tpp-chart`, both `__rdSwipe`).
    The hover claim is the chart card only, so the card got its own
    combined callback ref: `const chartMark = React.useCallback((el) =>
    { chartEl.current = el; if (el) el.__rdSwipe = … }, [])` and
    `ref={swipeMark}` → `ref={chartMark}` on the card div. (Do NOT hang
    a capture ref on `swipeMark` itself — both elements share it and
    last-mount wins.)
  - Hero claim stepper calls `rdPinScroll(sec)` itself (bare call —
    rdPinScroll lives in rd.jsx; all rd-* sources concat into the same
    plain-script build, see auspol-rdtabs-arrow-walk, so it's reachable
    with no import) because the shared range reflows the twin card and
    would drag it out from under the pointer. Primary's card instead
    routes through its existing `rangeLive.current(dir)` (the phone-
    swipe stepper), which already pins — reuse the live/stepper pair
    where one exists.
  - Primary card: effect deps `[]` is safe BECAUSE `rangeLive.current`
    is reassigned every render; hero's handler closes over `rangeId`
    directly, so its deps are `[rangeId]`.
- **Leadership panels** (dd087b4) — rd-panels.jsx, the two
  `.rd-ld-panel` divs side by side in `.rd-ld-grid` (PPM first with
  `ariaLabel="Preferred prime minister question"`, ratings second with
  `ariaLabel="Leader rating"`). Wrinkles:
  - TWO claimable siblings, three references: per-element `ppmEl` /
    `apprEl` refs plus ONE shared `ldHover` ref naming which panel is
    hovered (`"ppm" | "appr" | null`). Per-element boolean refs (the
    vote-cards shape) would also work but the shared enum makes
    exclusivity explicit — taken up when the two can never overlap
    (side-by-side at ≥1001px, stacked on phone). Each panel attaches
    its own pointerenter/leave; the keydown handler stays ONE
    capture-phase document listener that dispatches on `ldHover.current`.
  - Attach the ref in the shared `panel` helper
    (`ref={id === "ppm" ? ppmEl : apprEl}`) — the helper renders BOTH
    panels, so one branch covers both.
  - Liveness guard in the key handler: `el.isConnected &&
    el.getClientRects().length > 0`, else drop the claim. Needed
    because the expand pencil hides the other panel with `rd-hidden`
    and pointerleave may never fire when it appears/disappears.
  - Routing: PPM claim goes through `ppmPick` (never `setPpmView` —
    ppmPick snapshots head-bar geometry into `hbSnap` for the bars
    morph and calls `choosePpm`/`AP.useMorph`); the ratings claim goes
    through `pickMetric` (which runs `pinLd()` → rdPinScroll on the
    `[aria-label='Leader rating']` row). Same "row's own picker" rule
    as facetPick/rangeLive at the earlier sites.
  - Effect deps `[ppmView, metric]` — the handler closes over both
    state values (separate lists per panel).
- **Snapshot panels** (becaa5b) — rd-panels.jsx, Who votes for whom,
  The issues, Undecided. Wrinkles:
  - **Who votes for whom**: one claim on section `#who-votes`,
    stepping `pickTab((T.tabs||[]).map(x=>x.id))` — pickTab fires the
    rdPinScroll pin on `.rd-wv-tabs`. Deps `[tabId]`. (The party chips
    originally stayed out — digit-keyed only, no focused ←/→ walk —
    until rung 7 generalised the contract per key family; see below.)
  - **The issues**: TWO claims in ONE effect + ONE capture handler —
    outer `#issues` steps `setView` over `["trust","whom"]` (bare —
    the row's own RdTabs onChange doesn't pin); inner `.card.rd-iw`
    (gained `ref={iwCard}`) steps `pickGset` over `G.tabs` (it pins —
    keep going through it!). The ONE handler checks the INNER ref
    first (deeper claim wins) with the leadership liveness guard
    (`isConnected && getClientRects().length`), else the outer. Hook
    placed above the `if (!I…) return null` guard; deps
    `[view, gsetId, I]`. (Trust-mode rows gained their own ↑/↓ claim
    in rung 7; see below.)
  - **Undecided**: the hook MUST sit before the panel's practical
    return `if (!U || !U.series.length) return null` — React hook
    order is inviolable even across "no data" renders, so the effect
    early-returns `undefined` internally when there's nothing to
    claim. Its `ids` list is computed INSIDE the effect
    (`["all"]…firmness?["party"]…softAge?["age"]`) because `views` is
    defined below the return; the step inlines the pin
    (`rdPinScroll(document.getElementById("undecided")…querySelector(
    ".rd-un-tabs"))`) because `pickView` is also declared below. Deps
    `[U, D, view]`.
  - Probes: `.matilda/probe-hover-snapshotpanels.mjs` (port 8999).
    The two-tier issues claim adds a THIRD plane below section/card:
    asserting the OUTER view claim after exercising the inner whom
    claim requires `moveOver("#issues .rd-is-tabs")` — `moveOver(
    "#issues")` clamps the pointer to the section's centre, which
    still sits INSIDE the `.rd-iw` card (it fills most of the
    section), so `pointerleave` never fires on the card and the inner
    claim correctly stays live. Read as an app bug on the first run
    ("issues view left → trust: want Who's trusted, got What matters
    to whom"); it was the probe's pointer. Exit the inner element
    EXPLICITLY to hand the claim back.
- **Past cycles** (62f5521 + a27c584) — rd-cycles.jsx RdPastCycles, the
  two hand-rolled control rows in `#cyc-summary`: Compare-with
  (`.rd-cc-tabs`, all/returned/ousted) and Measure (abs/chg). Wrinkles:
  - **Compare = a SECTION-level outer claim by reuse.** Its phone
    swipe (`cmpSwipeLive`, `.rdSwipe` handler on the section since
    615ae67) already owned the whole summary section, so the hover
    claim adopts exactly that reach: pointer anywhere over
    `#cyc-summary` steps CMP_ROWS through `cmpSwipeLive.current(dir)`,
    pins and all. Deps `[]` is safe because the `.current` closures
    are rebound every render (checklist rule 5).
  - **Measure = the deeper INNER claim.** New `modeSwipeLive` ref
    steps MODE_ROWS through `setModePin` (which pinView's the row);
    the Measure row div gained `ref={measEl}`. ONE capture keydown
    checks measure first (canonical liveness guard
    `isConnected && getClientRects().length`), then compare.
  - **THE NEW LESSON — slide-out at the scroll ceiling.** Each measure
    step rewrites the head/dek ABOVE the row, and near `scrollY≈0`
    pinView can't hold the row (the page can't scroll past the top),
    so the row physically slides out from under a parked pointer and
    fires a GENUINE `pointerleave` — mid-gesture the next key then
    laddered onto the compare fallback (observed live: compare index
    jumped while only measure keys were pressed). The leave was
    spatially real but semantically false: the walk moved the row,
    not the user. Fix (in app code, NOT a probe mask): a `measWalk`
    timestamp ref stamped per measure step; the measure branch tests
    `(measHover || (sumHover && Date.now() - measWalk < 800)) && …`
    — an 800ms continuation window holds the inner claim through the
    gesture while the section is still hovered, then lapses so the
    outer claim reclaims. Probe Phase A2 sleeps 950ms before
    asserting compare reclaim. Diagnosed with the pointerenter/leave
    tap `.matilda/dbg-hover-pastcycles.mjs` (measRect slid 531→504
    under a pointer fixed at y=552, scrollY=0).
- **Rung 7 — the claim escapes the arrow family** (a877a98 source +
  590a74e index.html) — rd-panels.jsx, two new key families:
  - **Issues trust grid claims ↑/↓** (trHover). The trust view's
    issue rows already took ↑/↓ when focused (rowKey: clamped,
    non-wrapping, Enter/Space select, focus-follows). Claim element
    = the WHOLE `.rd-is-grid` div (`ref={trGrid}`) — rows column AND
    `#issues .rd-is-chart` card together, because the walk's effect
    (select + chart morph) reads across both panes (hero-chart
    precedent). Attach in the SAME effect as the iw/is claims:
    `if (trGrid.current) pairs.push(on(trGrid.current, trHover));
    else trHover.current = false;` — mount-time wiring; deps stay
    `[view, gsetId, I]` with no re-registration problem because…
  - **`trStep` = a live stepper assigned EVERY render** (React ref +
    `trStep.current = dir => {…}` at component body level, closing
    over `I`/`selNow`/`setSel`): the once-registered keydown never
    goes stale (the all-polls deps-per-facet pattern solved the same
    problem by re-registering; a `.current` stepper is the lighter
    tool — vote cards' `rangeLive` already modelled it).
  - **Walks WRAP — circularity shipped 00e24d4 + 105a8c0**, same
    day, user: "down on the last issue takes you to the top". The
    walk shipped CLAMPED (clamped keys fell through to scroll the
    page, honouring the focused walk's clamp) — wrong call: BOTH
    owners of the ↑/↓ walk, the focused rowKey and the hover trStep,
    now wrap `j = (i ± 1 + list.length) % list.length`, focus
    following in the focused walk. EVERY claimed row on the page is
    now circular; `trStep`'s `false` return survives only for
    "no walk to make" (list < 2), the last case where a claimed key
    keeps its page-scroll day job. Probe asserts a wrapping key
    never scrolls the page.
  - Handler shape: the existing effect's first guard line gains
    `trHover.current` and ArrowUp/ArrowDown; the vertical branch
    sits AFTER the five shared guards and BEFORE the ←/→ branches —
    gate `trHover.current && view === "trust"`, the canonical
    `isConnected && getClientRects().length` liveness check,
    `if (!trStep.current(!(e.key === "ArrowDown") ? … )) return;`
    then preventDefault. Caret-only (it returns, never falls into
    the ←/→ branches).
  - **Who-votes party chips claim digits 1–5** (e.g. `e.key >= "1"
    && e.key <= "9"` then `DEMO_PARTIES[e.key.charCodeAt(0)-48-1]`)
    — mirrors rdDigitKey (rd.jsx:592) EXACTLY at the panel's reach:
    1–5 pick, **6–9 find no chip and keep their day job** (return
    before preventDefault), modifiers pass through the unchanged
    guard set. The digit branch rides INSIDE the rung-5 wvHover
    effect before its arrow branch, so digits + the group row's
    arrows coexist on one hover — one keydown handler, two families,
    first guard restructured to `if (!wvHover.current) return;` then
    family checks (the old combined first line carried a latent
    `||`/`&&` precedence bug: `!a || b && c` read as `(!a) || (b &&
    c)` — restructuring onto one statement per check removed it).
    Routing = `pickParty(pp.id)` (pins via `pinWv`), never a bare
    setter. A focused chip still wins (rdDigitKey's own guards).
  - First guard line of the snapshot handler is now
    `if ((!isHover.current && !iwHover.current && !trHover.current)
    || (e.key !== …all four arrows)) return;` — every extra family
    widens BOTH halves together.
  - Probes: `.matilda/probe-hover-issues-vert.mjs` (port 9003) —
    rows-column wrap walk both ways (claimed keys never scroll),
    chart-card hover, focused-row priority AND the focused walk's own
    wrap (focus following), off-panel death, whom-view takes no
    vertical claim, ←/→ view claim unaffected; and
    `.matilda/probe-hover-whovotes-digits.mjs` (port 9004) — digits
    1/2/3/5 pick, 7/9 no-op, arrows + digits coexist, focused chip
    keeps its walk, cross-panel digits dead, off-panel death.
    **NEW HARNESS LESSON — page-turn phases go LAST.** Any phase
    whose arrow key turns the hash page (snapshot→other view)
    unmounts every snapshot panel; assertions needing another
    snapshot section (the #issues cross-panel check) must run
    BEFORE the page-turn phase. First digit-probe run failed
    `failed to find element matching selector "#issues"` in the
    off-panel phase's wake — probe bug, app untouched.

## Probe harness (reusable)

`.matilda/probe-hover-votecards.mjs` (port 8997),
`.matilda/probe-hover-allpolls.mjs` (port 8996),
`.matilda/probe-hover-leadership.mjs` (port 8998),
`.matilda/probe-hover-snapshotpanels.mjs` (port 8999),
`.matilda/probe-hover-pastcycles.mjs` (port 9000; debug tap
`.matilda/dbg-hover-pastcycles.mjs`, port 9001),
`.matilda/probe-hover-issues-vert.mjs` (port 9003) and
`.matilda/probe-hover-whovotes-digits.mjs` (port 9004) — a static
server (`PROBE_ROOT` env switches between live tree and a clean-room
snapshot bind-mount), headless Chrome via puppeteer-core at
`/Applications/Google Chrome.app/…/Google Chrome`, 1440×960.
Asserted on each card: hover → wrap right N steps and left once ·
focus stays BODY · page hash unchanged · hover of menu row / filter
bar also claims · focused tab keeps its in-row walk · mouse-out to
(725,24) → ArrowRight turns the page (hash changes). Two reusable
helpers with traps burned into them:

- **`moveOver(sel)`** — `scrollIntoView({block:"nearest"})` then clamp
  the hover point into element∩viewport with a 90px TOP inset (the
  sticky site bar), 20px side insets; if the hoverable band is <24px,
  `window.scrollBy(0, top-160)` and re-read. Plain
  `scrollIntoView({block:"center"})` left the All-polls menu row under
  the sticky bar (pointer at negative y, claim dead, arrows turned the
  page — debugged via `document.elementFromPoint` logging in
  `.matilda/dbg-hover-allpolls.mjs`).
- **Focus assertions: `.focus()` in an `evaluate`, never
  `page.click`.** The vote-cards probe's coordinate click on a range
  tab landed the pointer under the sticky navbar and clicked a MAIN-NAV
  tab instead — failure read `{"tag":"BUTTON","label":"Past
  cyclesCycles","pressed":null}` ("Past cycles" + its "Cycles" short
  label = the navbar tab's textContent). Focus the row's pressed tab
  with `page.$eval(sel, el => el.focus())`, assert focus landed, THEN
  press keys. Any focus-sensitive probe that clicks should suspect its
  coordinates before suspecting the app (mirrors the touch-rect lesson
  in auspol-rdtabs-arrow-walk).
- **Neighbour-independence: snapshot, don't default-assert.** The
  leadership probe walks one panel's row while asserting the OTHER
  panel's pressed tab is unchanged. Hard-coding `other === defaultTab`
  falsely failed — the previous phase ends with a wrap-left, which
  lands the row on the LAST tab ("Both"), not its default. Failure
  read `neighbouring row moved to "Both" (want Two-way)` on every
  step of the second phase; the app had never moved it. Record the
  neighbour's pressed tab at each phase's start and assert it against
  that. (The vote-cards probe didn't hit this because both cards share
  one state, so lockstep is the assertion, not independence.)
- **View gate**: All-polls is a hash-driven view — navigate
  `index.html#allpolls`, not the Snapshot default; the vote cards are
  on the Snapshot view (default, or hash `snapshot`).

`npm test` must stay green; also re-run the probe with
`PROBE_ROOT=<cleanroom>` so the exact committed bytes are the ones
verified. Clean-room build + private-index commit recipe (git archive,
manifest gate, diff gates incl. expected `^<` lines for intentional
replacements like the `ref={swipeMark}`→`ref={chartMark}` swap):
auto-skill-shared-repo-session-race, the 2026-09-30 checkout-index
trap section. Leadership's commit surfaced a new flavour of drift:
`^<` lines that are COMMITTED-SOURCE drift, not your change — a sibling
had committed an rd.css selector fix in two commits (48131ae source,
636c9d3 the index.html rebuild) while this clean-room build ran, and
build.mjs re-inlines current rd.css via its `/*RDCSS*/` marker, so HEAD's
index.html was stale by one `<` line. Procedure when the diff gate shows
lines you didn't write: attribute each one (here:
`git show HEAD:…/rd.css` vs the rebuilt line; `git log -S <token>`
across template.html/index.html), confirm it's build(committed sources)
outputting exactly what a plain rebuild would, and only then commit —
then grep the FINAL commit's index.html for both your block and the
sibling's token to prove neither was lost (`grep -c ldHover`,
`grep -c rd-apd-chg` here). A sibling commit landing between your local
commit and `git push` (`git rev-list --left-right --count` reported
`0 0` at archive time, `1 0` against the sibling's new tip at push
time) is still a clean fast-forward when their commit sits on your
ancestor chain — but `git diff <theirnewtip> <yours> -- index.html`
and confirm the only removals are your intended ones before trusting
the push.

## Adding the claim to another row (checklist)

1. The row must already take ←/→ when focused (the claim's premise).
2. Claim target = the CARD element containing the row (+ its content);
   claim never spans elements the row's own walk doesn't reach. TWO
   exceptions: the issues panel's outer view-row claim targets the
   SECTION (rd-is-tabs + card are siblings under #issues), and the
   Past-cycles compare claim adopts the SECTION-wide reach its own
   phone swipe already owned (`cmpSwipeLive` on #cyc-summary). Rule of
   both: the claim's element = whatever the row's OWN full-strip
   control (swipe/pin) already treats as its surface.
2a. When a walk step rewrites content ABOVE the row, the row can slide
   out from under a parked pointer near the scroll ceiling (pinView
   can't scroll past scrollY=0) — a spatially genuine `pointerleave`
   mid-gesture. Don't mask the probe: keep the deeper claim alive with
   a short (800ms) timestamped continuation window held on the outer
   section being hovered (rung 6: `measWalk` + `sumHover`), and let it
   lapse so the outer claim reclaims.
3. Step through the row's existing setter/stepper (preserve its pin
   behaviour: `facetPick`, `rangeLive.current`, or `rdPinScroll(sec)`
   when the setter alone doesn't pin).
4. All five guards; bail before preventDefault on a failed lookup.
4a. Key family = exactly the focused walk's keys, no more. For a
    non-arrow family: match the focused walk's OWN mapping (digits:
    rdDigitKey's 1-over-items rule, so 6–9 fall through untouched;
    vertical: ArrowUp/ArrowDown accepted by the guard's first line).
    Widen the effect's first guard AND add a dedicated branch; keep
    combined-negation conditions written as one statement per check
    (`||`/`&&` precedence bites — see the wvHover restructure, rung 7).
4b. Every walk WRAPS (all of the site's claimed rows are circular —
    00e24d4), so a claimed key is consumed whenever a target exists;
    bail before preventDefault ONLY in no-target cases (list < 2,
    a digit with no chip). Probe that a claimed/wrapping key never
    scrolls the page.
5. Effect deps: state closed over → list it; `.current` steppers → `[]`.
   Prefer a `.current` stepper assigned every render when the step
    reads state (`trStep`, `rangeLive`) over re-registering the effect.
6. If the claim element already carries `__rdSwipe`, compose ONE
   callback ref (claim ref assignment + swipe assignment), never two
   refs fighting over one node or one ref shared across two nodes.
7. Probe: wrap both ways, focus priority (focused tab keeps its walk),
   page-turn restoration, `PROBE_ROOT` clean-room re-run, `npm test`.
   Put the page-turn (off-panel death) phase LAST — it unmounts the
   view, so cross-panel asserts must run before it.
