---
name: auspol-trendchart-evt-control
description: "auspol-tracker — the CONTROLLED event-annotation pair (evt/onEvt) on TrendChart, the phone event-list tap wiring (with the primary card's rd-evdrop fold-away dropdown, 2026-10-01), AND the 2PP hero's phone swipe claim map (2015bf5 + 49a6bfe + 6d00601 + a0b0d97, 2026-09-30): rdEventBadges(idKey, events, x0, x1) idKey-first + MEMOISED on the function because the chart reconciles an open event by OBJECT IDENTITY (p.e === evt.e) and closes any tap whose object wasn't minted for this render — two fresh copies killed it (raw-object pushed into item.evs, then per-render recompute); RdEventList button rows (onPick/openKey, aria-pressed), rdEventReveal rAF scroll (-88px), evt-a-<badgeKey> anchor, the evtPrev render-guard anti-pattern that ate hand-over taps; swipe claims are MINIMAL after a0b0d97 undid two over-claims — ONLY the .rd-tpp-read figures strip (self-mark + __rdSwipe) and the chart svg (.chart inside [data-rd-swipe-exact]) flip the matchup; the lead gauge, event list, tabs and chrome claim NOTHING and page-turn via rowAt/goTab like any other surface; the absorb machinery (bare self-mark swallow, non-chart card swallow, 700ms __rdScrollAnchor arm) is DELETED, not narrowed; probe .matilda/probe/phone-evlist-tap.mjs (taps + glitch + swipe + dropdown), section ids #primary-vote (NOT #primary) and section.rd-tpp."
source: auto-skill
extracted_at: '2026-09-30T03:44:42.189Z'
---

# Controlled evt: phone event list → chart tooltip (2015bf5)

A numbered `RdEventList` under a phone chart (≤640px) opens the matching
event annotation in the TrendChart above it. Four homes, in
`.build/newtracker/assets/`:

1. **`08b413e7-…js` (TrendChart)** — the controlled pair:
   - props ~:208-215: `evt: evtCtl, onEvt` (comment block there is the
     contract). Controlled shape `{e, x?, y?}`; x/y may be absent — the
     chart fills them.
   - bridge ~:429-437: `ctl = typeof onEvt === "function"`;
     `evt = ctl ? evtCtl : evtMy`; `setEvt = ctl ? onEvt : setEvtMy`.
   - **reconciliation** ~:1106-1120 (runs in render, after evPlaced):
     `q = evPlaced.find(p => p.e === evt.e && !p.leaving)`; not found →
     `setTimeout(setEvt(null))` (put away — event left the window);
     moved → `setTimeout(setEvt({e, x: q.ex, y: q.y}))` (re-hang at the
     placement the chart computed); else it MUTATES `evt.x/evt.y`.
   - consumers: tip render ~:1798 (`tip tip-evt`, content from
     evt.e.label/date/desc, position evt.x/evt.y used ~:818 — note evt
     coords are already viewBox units, unlike a dot's which go through
     sx()/sy()); badge "on" cls ~:1390/:1444 (`evt.e === e`); scroll
     anchor `id={"evt-a-"+e.badgeKey}` ~:1393, rendered only while open
     AND controlled AND not leaving.
2. **`rd.jsx`** — helpers, exported to window at the file tail:
   - `rdEventBadges(idKey, events, x0, x1)` ~:534 — **idKey-FIRST**
     signature; badgeKey = `idKey + "-" + e.date` namespaces evt-a ids
     per chart. **Memoised on the function** (`rdEventBadges.memo`,
     keyed idKey+x0.toFixed(4)+x1+dates, cleared past 120 keys): returns
     the SAME `events`/`list` arrays and entry objects while the window
     holds the same set. Each in-window event becomes ONE `badged`
     object (`{...e, badge, badgeLead, badgeKey}`) that is BOTH pushed
     into `item.evs` AND returned into the `events` array.
   - `RdEventList({list, inline, from, mix, onPick, openKey})` ~:561 —
     rows become `<button class="rd-evlist-b" aria-pressed>` only when
     onPick + evs exist; `onClick={() => onPick(l.evs[0])}` (a month
     shared by several events answers with its first). `on` from
     `l.evs.some(e => e.badgeKey === openKey)`. Mid-switch crossfade:
     outgoing ol gets `{opacity:1-mix, pointerEvents:"none"}` +
     aria-hidden, the incoming one gets the pick.
   - `rdEventReveal(id)` ~:666 — **rAF-deferred** (the anchor renders
     only after the tap's state commit, so an immediate
     getElementById misses), scrolls to rect.top + scrollY − 88 (sticky
     head clearance), only if the anchor sits above the viewport.
3. **Callers** — `rd-hero.jsx` ~:292-300 ("tp", guarded `narrow ?`),
   `rd-panels.jsx` RdPrimary ~:122-129 ("p1") and RdDirection ~:946
   ("dir", bondi), `rd-cycles.jsx` :151 ("cy" lone) and :650
   ("cy"+cur.year pairOf, "cy<year>"). Every call site must pass the
   idKey — the 3-arg form is gone. RdPrimary's list alone renders
   INSIDE a `<details class="rd-evdrop">` fold-away (2026-10-01, see
   the dedicated section below); every other call site is a bare list.
4. **`rd.css` ~:278-290 + ~:341-348** — `.rd-evlist`/`.rd-evdrop` box
   styles and the `.rd-evlist-b` button styles. Wash tokens:
   `var(--surface-2)` for :active and hover (there is **no `--wash`
   token** in this repo — grepping template.html:34 saved a ship of a
   dead var); `li:has(.rd-evlist-b) { padding: 0 }` so the button's own
   padding carries the row; `:focus-visible` outline `var(--accent)`.
   Sibling-gap selectors assume the list is the chart card's direct
   child — a fold-away card needs both `.rd-evdrop` variants (`.chart
   + .rd-evdrop { margin-top: 0 }` when the copy-button band precedes,
   and the widened `:is(.rd-evlist, .rd-evdrop) + .rd-ckey`).

## THE identity rule (why two fixes were needed, 2026-09-30)

An opened event reconciles by **object identity** against evPlaced —
`p.e === evt.e`. The object a list hands back via onPick must be the
very object minted for the events prop THIS render and every render
after, until the set changes. Two successive traps, same symptom:

1. `rdEventBadges` pushed the RAW event into `item.evs` while returning
   spread copies in `events` — `l.evs[0]` was never `===` anything the
   chart drew (and had no badgeKey, so openKey/aria-pressed died too).
2. Even fixed, the callers recomputed `rdEventBadges(...)` on EVERY
   render; the tap's own `setEvtOpen` re-render minted all-new objects,
   the stored `evtOpen.e` matched nothing, and the reconciler's
   `setTimeout(setEvt(null))` put every tap away the frame it arrived.

**Symptom signature**: list rows render as tappable buttons but a tap
does nothing — no tip, no `g.evt.on`, no `evt-a-` anchor, aria-pressed
stays false. If the rows are there and every downstream assertion
fails, suspect identity, not the chart.

**Rule for any future controlled pair in this repo:** whatever feeds
the controlled prop must be identity-stable across renders — memoise
the derivation (window.AUSPOL inputs are static per page load, so a
content-keyed memo is exact) or hang it in state/ref keyed by stable
ids. A comment in `rdEventBadges` says why the memo exists; don't
inline-expand the call at a new call site without it.

## The evtPrev anti-pattern (removed in 2015bf5 — do not reintroduce)

Both callers briefly carried a render-time guard:

```js
const evtPrev = React.useRef(null);
if (evtPrev.current && evtOpen && evtPrev.current.e !== evtOpen.e) setEvtOpen(null);
evtPrev.current = evtOpen;
```

Intent: close a stale open when the set changes. Effect: tapping a
SECOND number handed `{e: B}` up, the guard saw `prev.e !== cur.e` and
nulled it — hand-over closed the panel instead of moving it. The
chart's own reconciliation already does this job (event left the window
→ put away; moved → re-hang). Never reconcile controlled state in the
PARENT's render; let the chart's reconciler report closure via onEvt.

## Caller recipe (rd-hero.jsx ~:292-300, verified)

```js
const badges = narrow ? rdEventBadges("tp", evsAll, xDomain[0], xDomain[1]) : null;
const events = badges ? badges.events : evsAll;          // FEED THE CHART THIS, not evsAll
const [evtOpen, setEvtOpen] = useState(null);
// tap the open row again = no-op (updater returns cur, React bails);
// tap another = hand-over; {e} with no x/y — the chart fills them
const pickEv = (e) => { setEvtOpen((c) => (c && c.e === e ? c : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
...
<TrendChart ... events={events} eventsFrom={eventsWas} eventMix={...}
            evt={evtOpen} onEvt={setEvtOpen} />
...
<RdEventList list={badges && badges.list} ... onPick={pickEv}
             openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
```

- `narrow`-only wiring: badges are null on desktop; keep the
  `badges ? … : raw` fallbacks so desktop takes the old path.
- Hero dual-scene morph ALSO memoises per scene via the same key (the
  leaving set `badgesWas` is its own memo entry — identical events,
  different window, different key).
- A user can also tap a badge IN the chart: svg tap →
  `setEvt({e, x, y})` → with ctl that's `onEvt(...)` → evtOpen
  round-trips through the parent and the list's aria-pressed follows —
  free, because client and list share one state.

## The primary card's list folds away (rd-evdrop, 2026-10-01)

The Primary vote card's phone list duplicates what the 2PP card above
already lists over its own window, so RdPrimary alone wraps its
`RdEventList` in a collapsed native `<details>` (user request: "hide
them in a dropdown"). rd-panels.jsx, in the card JSX right after the
TrendChart:

```jsx
{badges && badges.list.length > 0 && (
  <details className="rd-evdrop">
    <summary>The {badges.list.length === 1 ? "one event" : badges.list.length + " events"} marked on this chart</summary>
    <RdEventList list={badges.list} onPick={pickEv}
                 openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
  </details>
)}
```

- Guard on `badges.list.length > 0`, not just `badges` — a window that
  brackets no events must not mint an empty dropdown (plain RdEventList
  renders null on its own, a details would not).
- Summary copy is a counting noun phrase ("The N events marked on this
  chart") — static text that reads right open AND closed, like the
  repo's `.view-how` summaries. Sentence case in source.
- The 2PP hero and all other callers keep bare lists; the dropdown is
  RdPrimary-only. Everything inside (pick wiring, reconciliation) is
  unchanged — the fold is presentational, and the details' native open
  state survives React re-renders (open is not a controlled prop).
- Styles in rd.css (~:282-290): `.rd-evdrop` keeps the bare list's
  12px/0 top margins; summary `600 13px var(--sans) var(--ink-2)`,
  hover-guarded; `.rd-evdrop .rd-evlist { margin-top: 8px }`. Widen
  sibling selectors that assumed the list was a direct card child —
  `:is(.rd-evlist, .rd-evdrop) + .rd-ckey`.

### Probing a closed `<details>` (the trap that cost one probe FAIL)

Chrome (154 measured headless) hides a closed details' contents
WITHOUT display:none — the children keep real layout boxes: an
`li.getBoundingClientRect()` inside a closed details returns an
honest-looking rect (33px tall, mid-document y), `computed display` is
`flex`, `content-visibility` computes `visible`. But the content does
NOT paint, is NOT hit-testable (`elementFromPoint` at its spot finds
nothing inside the details), and `li.scrollIntoView()` cannot land it
(the rect stays off-viewport). So:

- To assert collapsed: measure the DETAILS element's own height —
  closed it is summary-only (`d.getBoundingClientRect().height` ≈ 27px
  here; assert a sane band like `> 0 && < 60`). Never assert
  `childRect.height === 0` — it will FAil (that was the first
  assertion's mistake: `y` is also misleading).
- To assert interactable: hit-test (`elementFromPoint` at the
  scrolled-into-view row centre lands INSIDE the details only when
  open) or just drive the real path — click the summary, then the row
  buttons. The probe does both.
- `.matilda/probe/phone-evlist-tap.mjs` now: asserts the fold
  contract before the tap probes (dropdown exists, hero has NONE,
  starts collapsed, summary-height only, summary text counts the
  window's events), clicks the summary first when a section's list is
  folded, then runs the unchanged tap/glitch assertions.

## Verification

`.matilda/probe/phone-evlist-tap.mjs` (untracked scratch,
puppeteer-core over an ephemeral http server, viewport 390×844): taps
row 1 then row 2 per section and asserts `.tip-evt` rendered+visible, a
`g.evt.on`, an `[id^="evt-a-"]` anchor, `aria-pressed="true"` on the
row, and that the second tap moves the anchor to the other event's id.
Its swipeProbe section (rewritten for a0b0d97) additionally probes
figure/scale/svg/list: swipes the `.rd-tpp-read` figures strip and
asserts the rival name CHANGED; swipes the `.rd-lg` scale → first
`section.rd-sec` id CHANGED (page turned two-party→cyc-summary),
then right-swipes back via `backToFirst()` and asserts the rival
name is UNCHANGED across the round trip; swipes the chart svg →
rival CHANGED; swipes the first `.rd-evlist-b` → section id CHANGED,
back, rival UNCHANGED. Two probe mechanics worth copying: `swipe()`
takes an explicit dir param (−1 left/next, +1 right/previous), and
`backToFirst()` returns to the first page by swiping on a `section
.rd-sec h2` — a head is never a claimer, so it works whichever page
is showing (an unmounted hero can't host the return swipe; an early
version tried `.rd-lg` for that and failed hard). The flip signal is
the rival name, NOT `.rd-chead-t` — the chart title is identical
across both vs-Labor matchups (see
auto-skill-auspol-headless-geometry-verify → CDP touch-swipe probes
for the dispatch-out-of-viewport trap and the gesture shape the
handler accepts).

- Section ids: hero = `section.rd-tpp`; primary = **`#primary-vote`**
  (RdSec id at rd-panels.jsx:163) — `#primary` matches nothing and the
  probe crashes at `scrollIntoView` on null.
- The hero's default range may bracket no events; the probe clicks the
  "All" tab first if the default view has no `.rd-evlist-b`.
- Full gate after touching this: rebuild, probe green,
  `node .build/newtracker/validate.mjs`, `npm test`.

## The phone swipe claim map on the 2PP hero (final state: a0b0d97)

Adjacent to (and probed with) the tap wiring. **After a0b0d97, the
claim map is minimal — two surfaces flip the matchup, everything else
page-turns:**

- `.rd-tpp-read` (the rolling figures strip, `rd-hero.jsx` ~:422) —
  carries `ref={swipeMark} data-rd-swipe-self=""`, flips the contest.
- The chart svg — any touch whose `target.closest(".chart")` lands
  inside the `[data-rd-swipe-exact]` card, flips the contest.
- **Nothing else claims.** The `RdLeadGauge` root (`.rd-lg`), the
  numbered event list, tabs and card chrome carry no mark; a swipe on
  them falls through to `rowAt(clientY)`/`goTab` — the page's plain
  turn — like any unclaimed surface on the site.

### What was removed on the way to that (do NOT reintroduce)

1. **Bare self-mark absorb (6d00601, deleted a0b0d97)** — the gauge
   root briefly carried `data-rd-swipe-self` with NO `__rdSwipe`
   handler and the gesture layer read a bare mark as "spoken for but
   does nothing" (onStart returned with `g = null`). User feedback:
   that ABSORBED the default page-turn. The self-claim branch now
   requires `self.__rdSwipe`; a bare attribute is inert, and the
   gauge carries none at all (its comment block went too).
2. **Non-chart card absorb (49a6bfe, deleted a0b0d97)** — the
   49a6bfe form swallowed every card touch outside `.chart`
   (`if (own0 && !target.closest(".chart")) return;`) and inverted the
   claim order. The current form derives `own =
   closest(".chart") ? closest("[data-rd-swipe-exact]") : null`
   instead; `own` merely outranks `claimsSideways`, so non-chart card
   chrome page-turns like everywhere else.
3. **The 700ms `__rdScrollAnchor` arm + `{free:true}` swallow**
   (6d00601, deleted a0b0d97) — figures-touch arming plus an onEnd
   `if (s.free) return`. It was MISTARGETED, not just redundant: the
   scroll-anchor walk it guarded (probe scrollIntoView relayout after
   a matchup flip) lands ~875-900ms AFTER flip settle, past the 700ms
   arm window — `_anchor-trace.mjs` timings (scrollY 0→60→0 across the
   next swipe) proved the arm had expired before the walk began.
   Deleting armour that never fired was the fix.

**Lesson:** when a new gesture claim ships, VERIFY it doesn't absorb
a default behaviour the page previously had (page-turn, tab-walk row
switch). The correct failure mode in this repo is "fall through to
the page's own turn", not "do nothing" — inert swipes are zero
feedback on a surface that otherwise responds.

### Handler geometry (unchanged core)

`.rd-tpp-read`'s `swipeMark` (`rd-hero.jsx` ~:400s) mints
`el.__rdSwipe = (dir) => swipeLive.current(dir)` off `swipeLive`
(`orderedMatchups.indexOf(matchup)`; false when <2 contests). Page
handler onStart (73de0c58 ~:2155-2181) claim order: 28px edge veto →
`zoom>1.01`/multi-touch veto → **self-claim**
(`closest("[data-rd-swipe-self]")` AND `.__rdSwipe` → `g.selfScroll`,
own the touch) → **exact claim** (`closest(".chart")` gating
`closest("[data-rd-swipe-exact]")` → `own`) → `claimsSideways` release
→ `rowAt(clientY)` (NEAR_BELOW=120 reach over `[data-rd-swipe]` rows).
onEnd gates: MIN_DX=60, |dy|≤|dx|/2, MAX_MS=800, |scrollY−sy|>12 kill,
text-selection veto; `selfScroll` pins `sy` at touchend (its claim
sets no `sy` at touchstart). Then `row.__rdSwipe(dir)` withOUT goTab,
else cyclic goTab over TABS. `data-rd-swipe-exact` stays OFF
`data-rd-swipe` so `rowAt` never matches the card itself.

Related: auspol-trendchart-dot-picking (the OTHER TrendChart pointer
channel), auspol-headless-geometry-verify (probe techniques; screenshots
are useless to read_file).
