/* auspol tracker – the redesign's own pieces (Sep 2026).

   The redesign is the only design the page wires up; the one it replaced is
   no longer a press away (the tagline's "last" stopped flipping between them
   2026-10-03) but its code stays in the branches below, viewable at
   ?design=old (App owns the flag and sets window.AP.rd while it renders).
   The existing panels keep their data and their machinery - the
   morphs, the rolling figures, the tooltips, the copy buttons - and branch at
   their return into the redesign's layout, built from the parts below. Every
   style these parts use lives in rd.css, scoped to body.rd. */

/* ---------------------------------------------------------------- sections
   A dark rule over a sentence-case section title, with the title's meta
   beside it; then the section's finding as a serif headline and its deck.
   `first` drops the rule: the first section sits under the masthead's. */
function RdSec({ id, cls, first, title, meta, tools, children, labelledBy, facet }) {
  const hid = React.useId();
  return (
    <section className={"rd-sec" + (first ? " rd-first" : "") + (cls ? " " + cls : "")}
             id={id} aria-labelledby={labelledBy || hid} data-facet={facet}>
      <div className="rd-eyebrow">
        <h2 className="rd-title" id={hid}>{title}</h2>
        {meta ? <span className="rd-meta">{meta}</span> : null}
        {tools ? <span className="rd-eyebrow-tools">{tools}</span> : null}
      </div>
      {children}
    </section>
  );
}

/* A section's finding is written from the data on show, so a switch can
   rewrite it - a line longer or shorter - and it glides to its new height
   rather than moving the section under it in one frame (RdGlide). */
/* What a block's words are made of, as a key for RdGlide's `watch`: its text,
   read through any elements it is written with, and their plain props (a
   RollNum's value). A block keyed this way reads no layout on a render that
   left its words alone, which is every frame of a chart's morph; one it
   cannot key (undefined) is measured on every render - a forced layout a
   frame, which footers written with a link or a figure in them used to cost. */
const rdWords = (v) => {
  if (v == null || typeof v === "boolean") return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    let s = "";
    for (const x of v) { const w = rdWords(x); if (w === undefined) return undefined; s += w; }
    return s;
  }
  if (typeof v === "object" && v.props) {
    const t = v.type;
    let s = "<" + (typeof t === "string" ? t : (t && (t.displayName || t.name)) || "?");
    for (const k in v.props) {
      const p = v.props[k];
      if (k !== "children" && (typeof p === "string" || typeof p === "number")) s += " " + k + "=" + p;
    }
    const c = rdWords(v.props.children);
    return c === undefined ? undefined : s + ">" + c + "</>";
  }
  return undefined;
};
function RdHed({ head, dek, level = 3 }) {
  const H = "h" + level;
  const w0 = rdWords(head), w1 = rdWords(dek);
  return (
    <RdGlide watch={w0 !== undefined && w1 !== undefined ? w0 + "\u0000" + w1 : undefined}>
      {head ? <H className="rd-hed">{head}</H> : null}
      {dek ? <p className="rd-dek">{dek}</p> : null}
    </RdGlide>
  );
}

/* a panel's own head and dek are rows of its layout (Leadership lines its
   two panels' rows up on a subgrid), so they stay unwrapped */
function RdSub({ head, dek, level = 4, glide }) {
  const H = "h" + level;
  const body = (
    <>
      {head ? <H className="rd-sub">{head}</H> : null}
      {dek ? <p className="rd-subdek">{dek}</p> : null}
    </>
  );
  // `glide`: one set in the page's flow, whose words a switch rewrites
  if (!glide) return body;
  const w0 = rdWords(head), w1 = rdWords(dek);
  return <RdGlide watch={w0 !== undefined && w1 !== undefined ? w0 + "\u0000" + w1 : undefined}>{body}</RdGlide>;
}

/* ---------------------------------------------------------------- glide
   Words that a switch rewrites can change how many lines they take, and a
   block that grows or shrinks at once moves everything under it in one
   frame - the chart the reader is watching jumps. Wrapped in RdGlide, a
   block whose height a press changes eases to its new height on the
   switch's own curve, so what is under it slides instead. Only a height
   change a press caused (within ~0.6s of a pointer or key press) glides; a
   resize, a font arriving or the page loading simply lays out.
   Clipped only vertically, and with `clip` rather than hidden: clip makes no
   new formatting context, so margins collapse through the wrapper exactly as
   they do at rest and nothing shifts when the glide starts or ends, and a
   chart's labels hanging past its sides are not cut off meanwhile. */
/* While a block glides its section keeps the taller of its two heights, so
   the page under the section does not move on every frame of the glide - a
   glide moved, and made the browser repaint, everything down to the foot of
   the page each frame. The section lets go when the last glide in it ends;
   a section that shrank closes up once, then, usually below the screen. */
function rdHoldSection(el, dh, ms) {
  const sec = el.closest(".rd-sec") || null;
  if (!sec) return;
  const h = sec.getBoundingClientRect().height;
  const need = Math.max(h, h + dh);
  const hold = sec.__rdHold || (sec.__rdHold = { h: 0, t: 0 });
  hold.h = Math.max(hold.h, need);
  sec.style.minHeight = hold.h + "px";
  clearTimeout(hold.t);
  hold.t = setTimeout(() => { sec.style.minHeight = ""; sec.__rdHold = null; }, ms);
}
/* A tab or chip row above a changing head and dek: the glide animates
   their height over the morph window, and every step drags the row and
   the charts under it up or down out from under the user. Pin instead:
   hold the row at its spot on screen while the glide runs, scrolling the
   difference back out (any scrolling of the user's own folds into the
   anchor). When the dek is on screen its bottom edge stays glued to the
   row and the changed words spill upward, but what the user keeps is the
   control they touched and everything below it. Call from the row's
   change handler, before the state changes. */
/* Even a perfectly timed correction is a visible lurch on iOS, whose
   compositor paints a script's scroll a frame late during a touch - so
   while a pin holds, nothing above the row resizes at all: each glide
   block hanging entirely over it freezes at its current height, its new
   words already inside. (Boxes ON the screen are the exception: outside a
   hot sideways touch they reflow live, since a frozen visible paragraph
   reads sliced at the freeze line.) When the pin lets go the freeze is
   cleared in one frame and the pin answers the whole shift with a single
   scroll in that same frame - the browser's own scroll-anchoring shape.
   No glide across the boundary: an animated release moves content under
   the reader for 320ms with no fairness to correct it (a slow drift after
   the gesture, worse than the staircase it replaced). */
let rdPinRaf = 0;
let rdPinAnchorSave = null;
let rdPinRO = null;
let rdPinHeld = null;
let rdPinLive = 0;
let rdPinDone = null;
/* the live pin's row ({ row }, kept current through re-seats), for RdGlide:
   a block whose resize moves this row must not glide */
let rdPinAt = null;
/* freezing must not clip a sticky thing's run: a clipped ancestor makes
   position:sticky descendants scroll off like ordinary content, so any
   branch holding one stays unfrozen (its changes ride the RO fix below) */
const RD_PIN_STICKY = ".tabs.sticky,.info-index,.rd-ap-headwrap,.poll-table thead th";
/* did a SIDEWAYS touch drive this pin? Scroll corrections made while a
   horizontal swipe is live paint a frame late on iOS, so a pin raised by a
   swiping finger must freeze even the on-screen boxes above the row. A pin
   from a click, key or TAP paints its corrections cleanly - and there
   letting on-screen text reflow live is kinder: a frozen paragraph on
   screen reads sliced at the freeze line (past-cycles' dek did exactly
   that, and arming heat on touchstart alone meant every iPhone TAP on a
   cycles pill fell inside the window and sliced it again). So the heat
   mirrors the app's own page-swipe effect (MIN_DX, the sideways-dominance
   gate): only a gesture that has actually SLID far enough sideward to be a
   swipe counts. The end sets one last beat - the swipe effect commits its
   step inside this same touchend dispatch */
const RD_TOUCH_SLIDE_DX = 60;   // mirrors MIN_DX in the app swipe effect
let rdTouchHot = 0, rdTouchFrom = null;
window.addEventListener("touchstart", (e) => {
  const t = e.touches && e.touches[0];
  rdTouchFrom = e.touches && e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
window.addEventListener("touchmove", (e) => {
  if (!rdTouchFrom || e.touches.length !== 1) { rdTouchFrom = null; return; }
  const t = e.touches[0];
  const dx = t.clientX - rdTouchFrom.x, dy = t.clientY - rdTouchFrom.y;
  if (Math.abs(dx) >= RD_TOUCH_SLIDE_DX && Math.abs(dy) <= Math.abs(dx) * 0.5)
    rdTouchHot = performance.now() + 220;
}, { passive: true });
window.addEventListener("touchend", (e) => {
  const t = e.changedTouches && e.changedTouches[0];
  if (rdTouchFrom && t) {
    const dx = t.clientX - rdTouchFrom.x, dy = t.clientY - rdTouchFrom.y;
    if (Math.abs(dx) >= RD_TOUCH_SLIDE_DX && Math.abs(dy) <= Math.abs(dx) * 0.5)
      rdTouchHot = performance.now() + 220;
  }
  rdTouchFrom = null;
}, { passive: true });
window.addEventListener("touchcancel", () => { rdTouchFrom = null; }, { passive: true });
const rdPinClip = (row, rowTop) => {
  const held = rdPinHeld || (rdPinHeld = []);
  const freeze = (o, r) => {
    if (o.__rdFrozen) return;
    o.__rdFrozen = true;
    o.style.transition = "none";
    o.style.overflowY = "clip";
    o.style.height = r.height + "px";
    held.push(o);
  };
  /* either freeze path - glide blocks here, chain walk below - applies the
     same screen rule: a box wholly off the screen always freezes, but a
     box ON the screen freezes only while a touch is hot. Mid-gesture its
     reflow would paint a frame late as drift, while a click- or tap-raised
     pin lets it reflow live: a frozen paragraph on screen reads sliced at
     the freeze line, which past-cycles' dek did inside its OWN glide
     wrapper's frozen parent until the sweep took the gate too. "On screen"
     counts only content readable past the stuck tabs bar - a box squeezed
     wholly into the bar's strip cannot be read (and freezing it is what
     holds the pin cheap), so the strip freezes like off-screen content */
  const barR = (() => { const b = document.querySelector(".tabs.sticky"); return b && b.getBoundingClientRect(); })();
  const visTop = barR ? Math.min(barR.bottom, barR.height) : 0;
  const onScreen = (r) => r.bottom > visTop + 6;
  const freezeOnScreen = performance.now() < rdTouchHot;
  document.querySelectorAll(".rd-glide-in").forEach((i) => {
    const o = i.parentElement;
    if (!o) return;
    const r = o.getBoundingClientRect();
    if (r.bottom > rowTop + 1 || (!freezeOnScreen && onScreen(r))) return;
    freeze(o, r);
  });
  /* glide blocks are not the only movers: the vote cards' event list
     unmounts and its chart lane snaps on a shared-range step, and a
     panel's dek snaps when a metric flips its line count - none glides.
     So freeze EVERY earlier box along the row's ancestor chain (the
     sibling sections and cards above it) too: nothing over the row may
     resize while the pin holds, or iOS catches the row a frame from its
     spot and paints the lurch no correction can call back */
  for (let node = row; node && node !== document.body;) {
    const parent = node.parentElement;
    if (!parent || parent === document.body) break;
    for (let sib = parent.firstElementChild; sib && sib !== node; sib = sib.nextElementSibling) {
      if (sib.__rdFrozen) continue;
      const r = sib.getBoundingClientRect();
      if (!r.height || r.bottom > rowTop + 1 || (!freezeOnScreen && onScreen(r))) continue;
      if (sib.matches(RD_PIN_STICKY) || sib.querySelector(RD_PIN_STICKY)) continue;
      freeze(sib, r);
    }
    node = parent;
  }
};
const rdPinThaw = () => {
  if (!rdPinHeld) return;
  const held = rdPinHeld;
  rdPinHeld = null;
  held.forEach((o) => {
    o.__rdFrozen = false;
    o.style.transition = "";
    o.style.height = "";
    o.style.overflowY = "";
  });
};
function rdPinScroll(row, fine) {
  if (!row) return;
  /* the fixed view is a TOUCH-device contract by default: it exists to stop
     mid-gesture drift on iOS Safari. On a computer (fine pointer - mouse,
     trackpad, keyboard) a click or keypress just reflows live, no pin -
     unless the caller passes fine (the All-polls table and the past-cycles
     compare/measure walk do: the facet walk, matchup flip, counts-basis
     switch and compare/measure step hold the bar, rows and board on a
     laptop exactly as on a phone) */
  if (!fine && window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) return;
  /* a re-pin inside the window ENDS the outgoing pin first, synchronously:
     its owed thaw and landing correction run NOW so this pin measures
     clean geometry. Simply cancelling the old rAF left its freeze clips
     on the page stacked under the new pin's own (rdPinHeld never thawed
     until the final pin's done), and every measurement the new pin then
     took - want0, the reseat tops, its own clip set - was polluted by the
     previous facet's frozen heights; a chained arrow-key facet walk read
     those fouled heights and wandered the page a few lines per hop (the
     round-3 laptop crawl). This must sit above EVERY measurement this
     function makes - reserve(), the candidate list scan, want0 */
  if (rdPinRaf !== 0 && rdPinDone) {
    const end = rdPinDone;
    rdPinDone = null;
    cancelAnimationFrame(rdPinRaf);
    end();
  }
  const bar = document.querySelector(".tabs.sticky");
  /* the bar's box sits at its unstuck place whenever it isn't stuck (top of
     the page), so its live bottom is 200px+ there - reserve only what the
     bar takes up when it IS stuck (its height), else a row right under the
     viewport top reads as hidden behind it */
  const reserve = () => { const r = bar && bar.getBoundingClientRect(); return r ? Math.min(r.bottom, r.height) : 0; };
  /* an array is a preference list - the caller names every anchor that would
     serve and the first one actually on screen takes the pin */
  let list = null;
  if (Array.isArray(row)) {
    list = row.filter((el) => el);
    row = list.find((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= reserve() && r.top <= window.innerHeight;
    });
  }
  if (!row) return;
  const want0 = row.getBoundingClientRect();
  if (want0.bottom < reserve() || want0.top > window.innerHeight) return;
  /* the close-out above zeroed the outgoing pin's bookkeeping, so this
     counts exactly one live pin again */
  if (rdPinRaf === 0) rdPinLive++;
  cancelAnimationFrame(rdPinRaf);
  const at = { row };
  rdPinAt = at;
  /* Chrome's scroll anchoring fights the pin when the click focused a
     control OUTSIDE the row (a party chip): the focused box becomes the
     anchor, the browser re-scrolls every frame to hold THAT still through
     the glide, and the two trade scrolls back and forth while the row
     rides off. Silence anchoring for the pin's window, then hand back. */
  const html = document.documentElement;
  if (rdPinAnchorSave === null) rdPinAnchorSave = html.style.overflowAnchor;
  html.style.overflowAnchor = "none";
  let want = want0.top, lastY = window.scrollY, lastIssued = 0, issueY = -1, eaten = 0;
  let lastDVal = NaN, lastDAt = 0;
  /* every candidate a caller lists sits below the section head, so they
     share the ONE translation through a swap: when the pinned element's
     own React commit re-keys it out of the DOM mid-pin (an All-polls facet
     hop replaces the table's whole row set), the pin re-seats onto any
     candidate still in the tree instead of ending there. Ending handed
     the mid-swap viewport to the browser's own anchoring, and a facet
     whose rows are all new walked it a screen or more per cycle */
  let tops = null;
  const reseat = () => {
    if (row.isConnected) return true;
    const next = tops && tops.find((t) => t[0].isConnected);
    if (!next) return false;
    row = next[0];
    at.row = row;
    want = next[1];
    return true;
  };
  /* adopt a sub-pixel leftover into the anchor (and every reseat target).
     Whole-css-px corrections park any engine within half a pixel of the
     anchor, and the rounding residual is meant to die there - but the
     quantisation lives in the Safari app's own scroller, which commits
     positions its web process doesn't report back the same way (native
     WKWebView settles exactly like Playwright's WebKit; Safari.app alone
     re-reads each hop's leftover differently). A residual the next pin
     then measures from compounds hop to hop: the Safari facet-walk crawl
     (~1.8px per All-polls pri<->2pp lap, both hops low). Adopting the
     leftover when the rounded correction no-ops makes the pin aim only
     ever at a position the engine can actually hold, so nothing carries
     across hops; engines that settle truthfully adopt <=0.5px, below a
     device pixel at any dpr */
  const retarget = (delta) => {
    want += delta;
    if (tops) for (let i = 0; i < tops.length; i++) tops[i][1] += delta;
  };
  /* scroll corrections go out as WHOLE css pixels. WebKit's root scroller
     quantises a programmatic scroll to integer css px (a fractional
     scrollBy truncates away and never lands), while getBoundingClientRect
     returns fractions: an un-rounded chase asks for the same sub-pixel
     drift every frame, and where the engine's own rounding does apply -
     the thaw correction below, one hop's boundary case - each landing
     leaks ~1px into the settled scroll position (the Safari facet-walk
     crawl, round 4: the page walked down 1px per lap forever). Rounding
     parks the pin within half a css px of its anchor, sub-device-pixel at
     any dpr, and the residual no longer compounds hop to hop. Blink's
     half-pixel scroll fidelity is not worth keeping over that. */
  const fix = () => {
    if (!reseat()) return;
    const d = row.getBoundingClientRect().top - want;
    const drift = Math.round(d);
    const y0 = window.scrollY;
    const now = performance.now();
    /* the fold treats the issued scroll landing off its pre-issue spot
       as eaten, never owed; gate the adopt the same way - a residual the
       issued correction's own commit is about to erase is not the
       engine's to keep. Once two eatens pass with no commit the scroll
       is dead for real (Safari.app drops uncoalesced tween hops) and
       the leftover stands - adopt then, or after two frames clear */
    const quiet = window.scrollY !== issueY || eaten > 1 || now - lastIssued > 34;
    /* Safari.app scroller contract (safari-scroll-probe + rounds 8-10
       pindumps): scroll corrections commit quantised to a device-pixel
       lattice the app's own scroller keeps; sub-3css re-issues - relative
       OR absolute, at any cadence - never commit at all, so only BIG
       one-shot deltas land. The round-10 pindump then showed what-lands
       is only half of it: relative integer hops re-snap to the lattice
       per commit from wherever the last commit left the scroller, and
       the per-commit re-snap walks the fractional frame ~2css a lap with
       the page's integer scrollY compensating in step - the row stays
       doc-perfect (settleGap 0), the frame crawls. Round 11 then sent
       big corrections out as ABSOLUTE FRACTIONAL targets and the walk
       got WORSE (+36/12 laps) - Safari.app truncates a fractional commit
       with a systematic ~1.8css downward bias per hop. The scroll-probe
       already held the counter-evidence: its step-F big absolute
       INTEGER scrollTo committed exactly (pageTop 1000.00). So big
       corrections (|d| >= 3, the real-reflow hop) go out as absolute
       INTEGER targets - the same integer landing every lap, nothing
       left to truncate - and every sub-3css leftover is adopted into
       the anchor as it is gated, no piloting at all. Round 13 closed
       the hunt upstream rather than in scroll space: the All-polls hed
       now renders on every facet (rd-allpolls.jsx), so the walk that
       started all this reflows nothing and issues no corrections at
       all (2026-10-01 pindump: scrolls 0, climb 0 over 12 laps - the
       lattice can neither botch nor be asked to hold anything). */
    let still = 0;
    if (d !== lastDVal) { lastDVal = d; lastDAt = now; }
    else still = now - lastDAt;
    if (drift && Math.abs(d) >= 3) {
      window.scrollTo(0, Math.round(y0 + d));
      lastIssued = now; issueY = y0; eaten = 0; lastY = window.scrollY;
    } else if (d && quiet && still > 40) {
      /* a sub-3css leftover mid-glide is NOT adopted: adopting each small
         frame subtracts it from the anchor, so the anchor rides the
         glide's decelerating tail with it (the past-cycles dek case rode
         11.5px down over the tail's sub-3 frames). Left standing, the
         leftovers accumulate into the next fix()'s d until they cross 3
         and a whole-pixel correction goes out - the Safari.app lattice
         that the 3px rule exists for loses nothing. Only a STANDING
         leftover (motion stopped >40ms, nothing outstanding) is adopted:
         that one is the engine's real floor */
      retarget(d);
    }
  };
  /* freezing can itself nudge the row a few px (a freshly clipped box
     stops its children's margins collapsing through it), so settle that
     here in the same task: before any frame gets the chance to paint */
  rdPinClip(row, want0.top);
  fix();
  /* the candidates' pin-time tops land after the clip's own settle, so
     each snapshot is its post-freeze spot */
  if (list) tops = list.map((el) => [el, el.getBoundingClientRect().top]);
  /* A glide hands us its block through __rdPinObserve and we correct its
     resizing frames from a ResizeObserver: RO runs after layout, BEFORE the
     frame paints, so the row never leaves its spot on screen at all -
     rAF-time corrections paint one frame late in Safari, which read as the
     charts bouncing and stuttering under your finger through a swipe walk */
  if (rdPinRO) { rdPinRO.disconnect(); rdPinRO = null; }
  if (typeof ResizeObserver !== "undefined") {
    rdPinRO = new ResizeObserver(() => {
      window.__rdPinROn = (window.__rdPinROn || 0) + 1;
      fix();
    });
    /* Not everything above the row is a glide block: the vote cards' event
       list unmounts and the chart's event lane snaps on a shared-range step,
       and a panel's head/dek snaps when a metric flips its line count - the
       freeze can't hold them (their change is the row's own React commit,
       one frame) and no glide registers them. But every such change resizes
       the row's ancestors, so watch the chain above the row too and answer
       in this same before-paint callback; a change BELOW the row fires the
       observer with zero drift and fix() does nothing */
    for (let el = row.parentElement; el && el !== document.body; el = el.parentElement) rdPinRO.observe(el);
  }
  const hook = (el) => {
    if (el && rdPinRO) rdPinRO.observe(el);
  };
  window.__rdPinObserve = hook;
  const done = () => {
    rdPinRaf = 0;
    rdPinDone = null;
    if (rdPinAt === at) rdPinAt = null;
    if (rdPinRO) { rdPinRO.disconnect(); rdPinRO = null; }
    if (window.__rdPinObserve === hook) window.__rdPinObserve = null;
    if (--rdPinLive > 0) return;
    rdPinLive = 0;
    if (rdPinAnchorSave !== null) { html.style.overflowAnchor = rdPinAnchorSave; rdPinAnchorSave = null; }
    /* the freeze releases in this same frame and ONE correction answers
       it inside the same task - but only for the thaw's own shift, sized
       from the row's motion across the release, never against the anchor:
       anything the user scrolled away since the last tick (an inertial
       flick still rolling on iOS) is theirs to keep (was: fix() vs the
       anchor, which teleported the page back to the row - the one fix
       step()s user-leaving guard called too) */
    reseat();
    const was = row.isConnected ? row.getBoundingClientRect().top : 0;
    rdPinThaw();
    if (!row.isConnected) return;
    /* the fix() rule: a big thaw shift goes out as one absolute INTEGER
       target (fractional absolutes commit with a systematic truncation
       bias on Safari.app, round 11), and a sub-3css one is lattice-dead
       there so it is simply left (the pin is over - nothing follows to
       carry it) */
    const thawD = row.getBoundingClientRect().top - was;
    if (Math.abs(thawD) >= 3) window.scrollTo(0, Math.round(window.scrollY + thawD));
  };
  const stop = performance.now() + (window.AP && window.AP.MORPH_MS || 320) + 240;
  const step = () => {
    if (!reseat()) { done(); return; }
    const y = window.scrollY;
    /* a wheel or trackpad tick mid-glide folds into the anchor and the pin
       follows it: the row moves OPPOSITE the scroll on screen, so the
       target follows it by -dy, not +dy (added, each tick re-scrolled
       itself back out twice - a scroll mid-glide fought the user and
       shoved the page up to its top). A jump of a screen or more
       (Home/End, a nav pill, a scrollIntoView) is the user leaving - hand
       back rather than drag the page to where the row was */
    const dy = y - lastY;
    if (Math.abs(dy) > window.innerHeight) { done(); return; }
    if (dy && issueY === lastY) {
      /* a fold whose scroll starts from the pre-issue spot IS the last
         correction landing late - folding it into the anchor AND keeping
         the issued scrollBy (which quantises off the same delta) pays it
         twice (round 7: pri 63.125->64, dy=2 exactly the issued +2,
         want folded 60->58 while the scrollBy also moved the page; two
         hops later the anchor's 58 sat against scroll 64->66 and the
         pin corrected +6/+4 climbing back, the lap netting +2.5). Count
         it eaten and leave the anchor alone - the scrollBy that follows
         the fold puts the page where the anchor already sits; only a
         fold off some OTHER base is the user's own scroll */
      retarget(0);
      eaten++;
    } else {
      want -= dy;
      /* the fold moves every candidate's target with the user's scroll,
         so a re-seat after one lands keeps following the same moved
         pin */
      if (tops) for (let i = 0; i < tops.length; i++) tops[i][1] -= dy;
    }
    lastY = y;
    fix();
    if (performance.now() < stop) rdPinRaf = requestAnimationFrame(step);
    else done();
  };
  rdPinDone = done;
  rdPinRaf = requestAnimationFrame(step);
}
function RdGlide({ children, className, as, watch }) {
  const Tag = as || "div";
  const outer = React.useRef(null), inner = React.useRef(null), last = React.useRef(null), timer = React.useRef(0);
  const seen = React.useRef({});
  React.useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    /* `watch`: what the block's words are made of - while it is unchanged a
       re-render (a morph's frames) reads no layout */
    if (watch !== undefined && seen.current.w === watch && last.current != null) return;
    seen.current.w = watch;
    /* first mount: nothing to glide FROM (prev==null returned below anyway),
       and a forced layout read inside the first commit is what the boot
       window pays for - the passive ResizeObserver below establishes the
       baseline a frame later instead */
    if (watch !== undefined && last.current == null && typeof ResizeObserver !== "undefined") return;
    const h = i.getBoundingClientRect().height;
    const prev = last.current;
    last.current = h;
    if (prev == null || Math.abs(prev - h) < 1) return;
    /* a row pinned below freezes this block (rdPinClip): its new words are
       already in it, and the box keeps its height until the pin lifts,
       when rdPinThaw walks it to them in one glide instead */
    if (o.__rdFrozen) return;
    const AP = window.AP || {};
    if ((AP.reduceMotion && AP.reduceMotion()) || performance.now() - (window.__rdInput || 0) > 600) return;
    const cur = o.style.height ? o.getBoundingClientRect().height : prev;
    /* Under a live pin, a block whose resize moves the pinned row takes its
       new height at once. The pin answers a resize above its row from its
       ResizeObserver, in the frame the resize paints, but only in whole
       drifts of 3px or more (the Safari scroll-lattice rule in its fix()),
       and a glide grows ~1px a frame. So the row and everything under it
       rode each frame's growth and snapped back: the Who-votes dot plot
       shook ±3px through every group-tab and party-chip switch with its dek
       on screen, and landed 1-2px off (user report 2026-10-05). One jump is
       one whole correction in that same frame, so the row holds still and
       the changed words spill upward. The row is read with the block at
       its new height and at its old one, so a block beside the row, or
       below it, still glides */
    const pinRow = rdPinAt && rdPinAt.row;
    if (pinRow && pinRow.isConnected && !o.contains(pinRow)) {
      const was = [o.style.transition, o.style.height];
      o.style.transition = "none";
      o.style.height = "";
      const y1 = pinRow.getBoundingClientRect().top;
      o.style.height = cur + "px";
      if (Math.abs(pinRow.getBoundingClientRect().top - y1) >= 0.5) {
        clearTimeout(timer.current);
        o.style.transition = ""; o.style.height = ""; o.style.overflowY = "";
        if (window.__rdPinObserve) window.__rdPinObserve(o);
        return;
      }
      o.style.transition = was[0]; o.style.height = was[1];
    }
    rdHoldSection(o, h - cur, (AP.MORPH_MS || 320) + 80);
    clearTimeout(timer.current);
    o.style.transition = "none";
    o.style.overflowY = "clip";
    o.style.height = cur + "px";
    void o.offsetHeight;
    o.style.transition = "height " + (AP.MORPH_MS || 320) + "ms " + (AP.MORPH_CSS || "ease");
    o.style.height = h + "px";
    /* an active rdPinScroll anchor corrects this block's resizing from a
       ResizeObserver, where the correction lands in the same painted frame
       its cause does (Safari paints an rAF-time scroll a frame late, and
       the strip under the reader breathed with every frame of the glide) */
    if (window.__rdPinObserve) window.__rdPinObserve(o);
    timer.current = setTimeout(() => { o.style.transition = ""; o.style.height = ""; o.style.overflowY = ""; }, (AP.MORPH_MS || 320) + 60);
  });
  /* a height that changes for any other reason - a resize, a font arriving -
     is simply noted, so the next glide starts from where the block is */
  React.useEffect(() => {
    const i = inner.current, o = outer.current;
    if (!i || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      const h = i.getBoundingClientRect().height;
      /* content that settles to another height while it glides (a chart
         sizing itself) - the glide takes it as its new end, from wherever
         it has got to, rather than snapping there when it finishes. A
         frozen block keeps its height for the pin instead. */
      if (o && o.style.height && !o.__rdFrozen && Math.abs(h - (last.current || 0)) >= 1) {
        const AP = window.AP || {};
        o.style.height = h + "px";
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { o.style.transition = ""; o.style.height = ""; o.style.overflowY = ""; }, (AP.MORPH_MS || 320) + 60);
      }
      last.current = h;
    });
    ro.observe(i);
    return () => { ro.disconnect(); clearTimeout(timer.current); };
  }, []);
  return <Tag ref={outer} className={className}><div ref={inner} className="rd-glide-in">{children}</div></Tag>;
}
/* ---------------------------------------------------------------- crossfade
   Two views of a panel that are different things - other measures, other
   groups of voters - rather than one thing asked another way: the view being
   left fades out over the one arriving instead of being swapped for it in a
   frame. The old view is kept as it was drawn, laid over the new one, for
   the length of a switch; the pair sits in an RdGlide, so the panel eases to
   the new view's height. `k` names the view. */
function RdCrossfade({ k, children, className }) {
  const was = React.useRef({ k, node: children });
  const fading = React.useRef(null);
  const timer = React.useRef(0);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const AP = window.AP || {};
  if (was.current.k !== k) {
    const still = AP.reduceMotion && AP.reduceMotion();
    fading.current = still ? null : { k: was.current.k, node: was.current.node, id: (fading.current ? fading.current.id : 0) + 1 };
  }
  was.current = { k, node: children };
  React.useEffect(() => {
    const f = fading.current;
    if (!f || f.timed) return undefined;
    f.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (fading.current === f) { fading.current = null; force(); } }, (AP.MORPH_MS || 320) + 40);
    return undefined;
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const f = fading.current;
  return (
    <RdGlide watch={k}>
      <div className={"rd-xf" + (className ? " " + className : "")}>
        <div className={"rd-xf-now" + (f ? " in" : "")} key={"now-" + k}>{children}</div>
        {f && <div className="rd-xf-was" key={"was-" + f.k + "-" + f.id} aria-hidden="true" inert="">{f.node}</div>}
      </div>
    </RdGlide>
  );
}

/* A table cell's words giving way to others on a tab (the Latest polls
   figures): the same out-then-in as RdCrossfade, without its height glide,
   since the row decides the height, not the cell. The outgoing copy floats
   out of flow over the incoming one (rd.css): a cell co-sized by both
   copies snapped back to the new content's real box ~360ms later, when the
   ghost unmounted, visibly shifting the figures on a phone's content-sized
   columns. The float keeps its natural width, so it cannot wrap. */
function RdSwap({ k, children, className }) {
  const was = React.useRef({ k, node: children });
  const fading = React.useRef(null);
  const timer = React.useRef(0);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const AP = window.AP || {};
  if (was.current.k !== k) {
    const still = AP.reduceMotion && AP.reduceMotion();
    fading.current = still ? null : { k: was.current.k, node: was.current.node, id: (fading.current ? fading.current.id : 0) + 1 };
  }
  was.current = { k, node: children };
  React.useEffect(() => {
    const f = fading.current;
    if (!f || f.timed) return undefined;
    f.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (fading.current === f) { fading.current = null; force(); } }, (AP.MORPH_MS || 320) + 40);
    return undefined;
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const f = fading.current;
  return (
    <div className={"rd-swap" + (className ? " " + className : "")}>
      <div className={"rd-swap-now" + (f ? " in" : "")} key={"now-" + k}>{children}</div>
      {f && <div className="rd-swap-was" key={"was-" + f.k + "-" + f.id} aria-hidden="true" inert="">{f.node}</div>}
    </div>
  );
}

if (typeof window !== "undefined" && !window.__rdInputWatch) {
  window.__rdInputWatch = true;
  const note = () => { window.__rdInput = performance.now(); };
  window.addEventListener("pointerdown", note, true);
  window.addEventListener("keydown", note, true);
}

/* ---------------------------------------------------------------- keys
   What each mark on a chart is, drawn the way the chart draws it. Colour is
   never the only carrier: every item is a shape and a word. */
function RdSwatch({ kind = "line", color = "var(--ink-3)" }) {
  switch (kind) {
    case "dot":
      return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" style={{ fill: color, opacity: 0.55 }} /></svg>;
    case "dot-solid":
      return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5" style={{ fill: color }} /></svg>;
    case "dot-open":
      return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" style={{ fill: "var(--bg)", stroke: color, strokeWidth: 2 }} /></svg>;
    case "ring":
      return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" style={{ fill: "var(--bg)", stroke: "var(--ink)", strokeWidth: 2 }} /></svg>;
    case "band":
      return <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" style={{ fill: color, opacity: 0.2 }} /></svg>;
    case "lineband":
      return <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" style={{ fill: color, opacity: 0.2 }} /><path d="M1 7H23" style={{ stroke: color, strokeWidth: 2.5, strokeLinecap: "round" }} /></svg>;
    case "dash":
      return <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><path d="M1 7H23" style={{ stroke: color, strokeWidth: 2, strokeDasharray: "4 3" }} /></svg>;
    case "whisker":
      return <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><path d="M2 8H26M2 4V12M26 4V12" style={{ stroke: color, strokeWidth: 2, strokeLinecap: "round", fill: "none" }} /></svg>;
    case "square":
      return <span aria-hidden="true" style={{ width: 14, height: 14, background: color, display: "inline-block", flexShrink: 0 }} />;
    case "tick":
      return <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1V15" style={{ stroke: "var(--ink)", strokeWidth: 2 }} /></svg>;
    default:
      return <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><path d="M1 7H23" style={{ stroke: color, strokeWidth: 2.5, strokeLinecap: "round" }} /></svg>;
  }
}

function RdKey({ items, children, className }) {
  const item = (it, i) => it.href
    ? <a key={i} className="rd-key-item" href={it.href} target="_blank" rel="noopener noreferrer"><RdSwatch kind={it.kind} color={it.color} />{it.label}</a>
    : <span key={i} className="rd-key-item"><RdSwatch kind={it.kind} color={it.color} />{it.label}</span>;
  return (
    <div className={"rd-key" + (className ? " " + className : "")}>
      {items.filter(Boolean).map((it, i) => item(it, i))}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- feet
   The section's closing line: the standing caveat on the left, the way into
   how it is built on the right. `how` names the Info entry, which opens in
   place over the page the way every other term on the site does. */
function RdHow({ term, from, label = "How it’s built", href }) {
  if (href) return <a className="rd-how" href={href}>{label}</a>;
  return (
    <button type="button" className="rd-how"
            onClick={() => window.AP.openTerm && window.AP.openTerm(term, from || "the section")}>
      {label}
    </button>
  );
}

function RdFoot({ children, how }) {
  // a foot a switch rewrites glides to its new height, as a headline does
  return (
    <RdGlide watch={rdWords(children)}>
      <div className="rd-foot">
        {children ? <span className="rd-foot-text">{children}</span> : null}
        <span className="rd-grow"></span>
        {how ? <RdHow {...how} /> : null}
      </div>
    </RdGlide>
  );
}

/* ---------------------------------------------------------------- tabs
   The views inside a section: a row of words, the chosen one underlined. */
/* left/right walking for a tab row: with one of its tabs focused, an arrow
   moves the selection and focus a tab at a time, wrapping around the ends
   (rightmost -> leftmost and back). RdTabs rows get it built in; a
   hand-rolled row attaches the factory to its role=group div. Options must
   sit in the buttons' DOM order. */
/* Safari and Firefox on macOS never focus a <button> on click (only Chrome
   does), which would leave the walk dead for a pointer user - a click lands
   the button's focus explicitly, without scrolling to do it: a pinned bar's
   button has its layout box somewhere up the page and a plain focus() would
   teleport the viewport there (the pin owns the scroll position). */
function rdTabFocus(e) {
  const b = e.target && e.target.closest ? e.target.closest("button") : null;
  if (b) b.focus({ preventScroll: true });
}
function rdTabsKey(options, onChange) {
  return (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;
    e.preventDefault();
    const btns = [...e.currentTarget.querySelectorAll("button")];
    const j = (btns.indexOf(btn) + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    if (!btns[j] || !options[j]) return;
    onChange(options[j].id);
    btns[j].focus({ preventScroll: true });
  };
}
/* number-key hotkeys over a row: with focus anywhere in the row, 1..9 picks
   the item that many places along the given list (the who-votes party
   chips' 1..5). Modifier chords are the browser's own (Cmd+1 picks the
   browser's tab), so they pass through. */
function rdDigitKey(items, onChange) {
  return (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = e.key >= "1" && e.key <= "9" ? e.key.charCodeAt(0) - 48 : 0;
    if (!n || !items[n - 1]) return;
    e.preventDefault();
    onChange(items[n - 1].id);
  };
}
/* A label that holds its bold width: a pressed tab (or chip, or picked word)
   goes 600, so a plain label would widen it and nudge its neighbours on every
   switch. The hidden bold twin sizes the box; the visible text centres inside
   it. First written for Past cycles' view toggles (063b388), shared site-wide
   since the user saw the same nudge in the latest-polls facets and the
   demographics split picker (2026-10-04) - every bold-on-select control on the
   page wears it: RdTabs, the main tab row, the Who-votes and issues chips,
   the All-polls pinned facets, time pills and split picker. */
const RdTabW = ({ t }) => <span className="rd-tab-w" data-t={t}>{t}</span>;
function RdTabs({ value, onChange, options, ariaLabel, children, className, swipe, swipeSelf, pin, onDigits }) {
  /* `swipe`: the views are pages of their own (All polls' figures, preferred
     PM's questions, who votes by age or by place…), so on a phone a sideways
     swipe on or just under the row steps through them, wrapping round the
     ends as the arrow-key walk does - the app's swipe handler finds the row
     by data-rd-swipe and calls its step. Views that only re-cut one figure
     (a filter) leave it off, and a swipe near them turns the page instead.
     `swipeSelf`: the in-between case - a time-range row, which re-cuts the
     chart beneath it but owns its own strip. A phone swipe that LANDS on
     the row steps through the windows (data-rd-swipe-self, so the claim is
     by touch target alone and nothing below the row reaches into it), and
     a swipe under it does whatever the surface there does - the two-party
     chart beneath its row keeps its contest flip.
     `pin`: a change to this row re-cuts content ELSEWHERE on the page too
     (the vote charts' one shared range state resizes the other card's
     phone event list, above this row on the primary chart) - hold the row
     at its spot on screen with rdPinScroll through the reflow, whichever
     input changed it (click, arrow walk or menu swipe all funnel through
     `fire`). The change handler itself belongs to the row's owner. */
  const live = React.useRef(null);
  const root = React.useRef(null);
  const fire = React.useMemo(() => (pin
    ? (id) => { if (root.current) rdPinScroll(root.current); onChange(id); }
    : onChange), [pin, onChange]);
  live.current = (dir) => {
    const i = options.findIndex((o) => o.id === value);
    if (i < 0 || options.length < 2) return false;
    fire(options[(i + dir + options.length) % options.length].id);
    return true;
  };
  const mark = React.useCallback((el) => { root.current = el; if (el) el.__rdSwipe = (dir) => live.current(dir); }, []);
  return (
    <div className={"rd-tabs" + (className ? " " + className : "")}
         ref={swipe || swipeSelf || pin ? mark : undefined} data-rd-swipe={swipe ? "" : undefined}
         data-rd-swipe-self={swipeSelf ? "" : undefined}
         onKeyDown={onDigits || undefined}>
      <div role="group" aria-label={ariaLabel} style={{ display: "flex", gap: 4 }}
           onKeyDown={rdTabsKey(options, fire)} onClick={rdTabFocus}>
        {options.map((o) => (
          <button key={o.id} type="button" className="rd-tab" aria-pressed={value === o.id}
                  onClick={() => fire(o.id)} title={o.title}>
            {typeof o.label === "string" ? <RdTabW t={o.label} /> : o.label}
          </button>
        ))}
      </div>
      {children ? <><span className="rd-tabs-grow"></span>{children}</> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- words
   Small helpers the headlines share. */
const RD_NUM_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                      "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
                      "eighteen", "nineteen", "twenty"];
const rdNumWord = (n) => RD_NUM_WORDS[n] || String(n);
const rdCap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/* a share as a plain fraction a reader says aloud: "one in three",
   "three in five", "about one in nine" */
function rdFraction(p) {
  const cands = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [1, 7], [1, 8],
                 [1, 9], [1, 10], [3, 10], [7, 10], [9, 10], [1, 12], [1, 15], [1, 20]];
  let best = null;
  for (const [a, b] of cands) {
    const err = Math.abs(p / 100 - a / b);
    if (!best || err < best.err) best = { a, b, err };
  }
  const exact = best.err < 0.012;
  return (exact ? "" : "about ") + rdNumWord(best.a) + " in " + rdNumWord(best.b);
}
const rdSigned = (v, dp = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(dp);
const rdArrow = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "→");
/* the last election, as the copy names it ("since the 2025 election"): the
   current term's own, so /vic/ reads 2022 */
const rdElecYear = (() => {
  const c = (window.AUSPOL.cycles || []).find((x) => x.current);
  return c && c.eDate ? c.eDate.slice(0, 4) : "2025";
})();

/* "21 Sep", and "21 Sep 2026" with the year */
function rdDate(iso, withYear) {
  const t = new Date(Date.parse(iso));
  const D = window.AUSPOL;
  return t.getUTCDate() + " " + D.monthName(t.getUTCMonth() + 1) + (withYear ? " " + t.getUTCFullYear() : "");
}
/* "June 2025" for a month key */
function rdMonthYear(ym) {
  const [y, m] = ym.split("-").map(Number);
  return window.AUSPOL.monthNameFull(m) + " " + y;
}
/* a gap in points as a reader says it */
function rdPointsPhrase(g) {
  if (g <= 0.5) return "half a point";
  if (g <= 1) return "a point";
  if (g <= 1.5) return "a point and a half";
  if (g <= 2) return "two points";
  if (g <= 3) return "three points";
  return null;
}

/* ---------------------------------------------------------------- axes
   Month ticks the redesign's way: quarters on a long window, each January
   and the first tick carrying the year ("Jan 2026"); a window under a year
   ticks every other month, a short one every month. A phone halves them,
   and shortens the year to "Jan ’26": without the apostrophe, "Jan 26"
   and "Jul 25" read as dates. */
function rdXTicks(x0, x1, narrow, opts) {
  const D = window.AUSPOL;
  const o = opts || {};
  const months = D.MONTHS.map((ym) => ({ ym, x: D.mx(ym) })).filter((m) => m.x >= x0 - 0.02 && m.x <= x1);
  const span = x1 - x0;
  const step = o.step || (span > 1.1 ? (narrow ? 6 : 3) : span > 0.6 ? (narrow ? 3 : 2) : span > 0.3 ? (narrow ? 2 : 1) : 1);
  const keep = months.filter((m) => (Number(m.ym.slice(5)) - 1) % step === 0);
  return keep.map((m, i) => {
    const [y, mo] = m.ym.split("-").map(Number);
    const yr = narrow ? " ’" + String(y).slice(2) : " " + y;
    return { x: m.x, label: D.monthName(mo) + (mo === 1 || i === 0 ? yr : "") };
  });
}
/* y ticks every `step` from the window's floor to its ceiling, the top one
   carrying the unit */
function rdYTicks(lo, hi, step) {
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/* ---------------------------------------------------------------- events
   On a phone the event names do not fit over the plot, so each event gets
   a number over its rule and the name is listed under the chart with its
   date. Two events in one month get two numbers (Joyce crossing on the
   8th, Bondi on the 14th); the chart spreads badges too close to touch
   and ties them back to their rules. The caller hangs an `idKey` on each
   badge so two charts' taps and scroll anchors (evt-a-<key>) never mint
   the same id; a list row's `evs` lets a tap hand the event back to the
   chart. */
function rdEventBadges(idKey, events, x0, x1) {
  const inWin = (events || []).filter((e) => e.x >= x0 && e.x <= x1).sort((a, b) => a.x - b.x);
  /* An opened event lives in the caller across renders; this memo returns
     the SAME objects while the window holds the same set, or the chart's
     identity reconciliation (evt.e === a drawn event) lets the open go */
  const memo = rdEventBadges.memo || (rdEventBadges.memo = {});
  const memKey = idKey + "|" + x0.toFixed(4) + "|" + x1.toFixed(4) + "|" + inWin.map((e) => e.date).join(",");
  if (memo[memKey]) return memo[memKey];
  if (Object.keys(memo).length > 120) rdEventBadges.memo = {};
  /* the list hands the chart back the same object it drew: an opened event
     reconciles by identity against it */
  const out = inWin.map((e, i) => ({ ...e, badge: i + 1, badgeLead: true, badgeKey: idKey + "-" + e.date }));
  /* the short name reads better in a list, unless it is shorthand */
  const list = out.map((e) => ({ n: e.badge, date: e.date, labels: [/→/.test(e.short || "") || !e.short ? e.label : e.short], evs: [e] }));
  const result = { events: out, list };
  rdEventBadges.memo[memKey] = result;
  return result;
}
/* The vote charts' shared event set: the major events, plus the two
   changes of hand – Taylor replacing Ley, Joyce joining One Nation – so
   the numbered markers are identical on the 2PP hero and the Primary vote
   chart over the months each one's window shows. x0/x1 is the caller's
   scene window, kept to the 0.02 hair of slop the axis months keep. */
function rdChartEvents(events, x0, x1) {
  const KEPT = ["2026-02-12", "2025-12-08"];
  return (events || []).filter((e) => (e.major || KEPT.includes(e.date)) && e.x >= x0 - 0.02 && e.x <= x1 + 0.02);
}
function RdEventList({ list, inline, from, mix, onPick, openKey }) {
  if (!list || !list.length) return null;
  /* `inline` runs the list across the page, as the canvas set the one shared
     by a pair of half-width charts; a phone always stacks it */
  /* the day the number answers for, year and all ("8 Dec 2025") */
  const dateOf = (l) => rdDate(l.date, true);
  const row = (l, i) => {
    const d = dateOf(l);
    /* a tap opens the event's panel in the chart above */
    const on = !!(openKey && l.evs && l.evs.some((e) => e.badgeKey === openKey));
    return onPick && l.evs && l.evs.length ? (
      <li key={l.n}>
        <button type="button" className={"rd-evlist-b" + (on ? " on" : "")} aria-pressed={on}
                onClick={() => onPick(l.evs[0])}>
          <span className="rd-evlist-n">{l.n}</span>
          <span className="rd-evlist-l">{l.labels.join(", ")}</span>
          <span className="rd-evlist-d">{d}</span>
        </button>
      </li>
    ) : (
      <li key={l.n}>
        <span className="rd-evlist-n">{l.n}</span>
        <span className="rd-evlist-l">{l.labels.join(", ")}</span>
        <span className="rd-evlist-d">{d}</span>
      </li>
    );
  };
  const ol = (l0, st, hidden, pick) => (
    <ol className={"rd-evlist" + (inline ? " inline" : "")} style={st} aria-hidden={hidden || undefined}>
      {l0.map((l, i) => (pick ? row(l, i) : (
        <li key={l.n}><span className="rd-evlist-n">{l.n}</span>
          <span className="rd-evlist-l">{l.labels.join(", ")}</span>
          <span className="rd-evlist-d">{dateOf(l)}</span></li>
      )))}
    </ol>
  );
  /* mid-switch (`from`, `mix`): the list being left fades out over the list
     arriving, both in one cell, so the names change with the chart's badges
     and the page below does not move on the switch's last frame */
  const same = from && from.length === list.length && from.every((l, i) => l.n === list[i].n && l.date === list[i].date && l.labels.join() === list[i].labels.join());
  if (!from || same || mix >= 1) return ol(list, undefined, undefined, !!onPick);
  /* mid-switch the tappable list belongs to the view being arrived at */
  return (
    <div className="rd-evstack">
      {ol(from, { opacity: 1 - mix, pointerEvents: "none" }, true)}
      {ol(list, { opacity: mix }, undefined, !!onPick)}
    </div>
  );
}

/* ---------------------------------------------------------------- controls
   A plain checkbox with its words, 44px tall to hit. */
function RdCheck({ checked, onChange, children, title }) {
  return (
    <label className="rd-check" title={title}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
/* an on/off switch for a setting stated in words beside it */
function RdSwitch({ on, onToggle, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label}
            className="rd-switch" onClick={onToggle}><span></span></button>
  );
}
/* A term the Info tab defines, set in the sentence with a dotted underline;
   pressing it opens the definition over the page. */
function RdTerm({ id, from, children, title }) {
  return (
    <button type="button" className="rd-term" title={title}
            onClick={(e) => { e.preventDefault(); window.AP.openTerm && window.AP.openTerm(id, from || "the page"); }}>
      {children}
    </button>
  );
}
/* The "?" beside a line of method: a small panel of how it is counted, and
   the rare setting that belongs off the main surface. */
function RdQPop({ label, children, align }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const panel = React.useRef(null);
  window.useDismissOutside(ref, open, () => setOpen(false));
  React.useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  /* the "?" can sit near either screen edge; nudge an overhanging panel
     back inside the same 8px page gutter the archive's tooltips keep */
  React.useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return undefined;
    el.style.translate = "";
    const r = el.getBoundingClientRect();
    let dx = 0;
    if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (r.left + dx < 8) dx += 8 - (r.left + dx);
    if (dx) el.style.translate = dx + "px 0";
    return undefined;
  }, [open]);
  return (
    <span className="rd-qpop" ref={ref}>
      <button type="button" className="rd-qbtn" aria-label={label} aria-expanded={open}
              onClick={() => setOpen((o) => !o)}><span>?</span></button>
      {open && <div ref={panel} className={"rd-qpanel" + (align ? " " + align : "")} role="dialog" aria-label={label}>{children}</div>}
    </span>
  );
}
/* A tapped event answers from the chart above: scroll its rule to just
   under the sticky head so the panel it opens has the plot to hang in.
   The anchor renders only after the tap's state commits, so the reveal
   waits for the next frame. */
function rdEventReveal(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    if (top < window.scrollY) window.scrollTo({ top, behavior: "smooth" });
  });
}

Object.assign(window, { RdSec, RdHed, RdSub, RdSwatch, RdKey, RdHow, RdFoot, RdTabs, RdTabW, RdGlide, RdCrossfade,
                        rdTabsKey, rdTabFocus, rdDigitKey,
                        rdNumWord, rdCap, rdFraction, rdSigned, rdArrow,
                        rdDate, rdMonthYear, rdPointsPhrase, rdXTicks, rdYTicks,
                        rdEventBadges, rdChartEvents, RdEventList, rdEventReveal, RdCheck, RdSwitch, RdTerm, RdQPop });
