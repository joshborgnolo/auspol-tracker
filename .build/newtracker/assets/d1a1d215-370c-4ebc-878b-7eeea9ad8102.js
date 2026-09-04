/* auspol tracker – tabbed views: Tabs nav (with docked 2PP score), Past cycles overlay, All polls archive */

// ---- CSV export plumbing, shared by the archive and the past-cycles download ----
const csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
// rows = array of arrays, first row the header. Leading BOM so Excel opens
// UTF-8 without mangling the en dashes in fieldwork labels.
const csvText = (rows) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
const downloadCsv = (filename, rows) => {
  const blob = new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path>
  </svg>
);

// ====================================================================
// TabScore – compact 2PP readout docked at the right of the tab bar.
// Appears once the bar pins to the viewport top, on EVERY tab – the
// national score travels with you. Click = jump to the Snapshot hero.
// The contest shown FOLLOWS the hero's 2PP switch (App owns that state and
// hands it down): the same definitions and the same nowcast accessor as the
// hero readout, so the two figures can never disagree.
// ====================================================================
function TabScore({ onGoHero, matchup }) {
  const MM = window.AP.tppMatchups;
  // anything unrecognised (or a matchup with no current figure) falls back
  // to the headline contest – the hero itself never offers one without data
  const id = MM && MM[matchup] && window.AP.tppLatest(matchup) ? matchup : "alp_lnp";
  const M = MM[id], v = window.AP.tppLatest(id);
  return (
    <button className="tab-score" onClick={onGoHero}
            title={"Latest " + M.label + " two-party preferred – go to Snapshot"}>
      <span className="ts-eyebrow">2PP</span>
      <span className="ts-party">
        <span className="ts-abbr">{M.a.abbr}</span>
        <span className="ts-num" style={{ color: inkOf(M.a.color) }}>{v.a.toFixed(1)}</span>
      </span>
      <span className="ts-sep" aria-hidden="true"></span>
      <span className="ts-party">
        <span className="ts-num" style={{ color: inkOf(M.b.color) }}>{v.b.toFixed(1)}</span>
        <span className="ts-abbr">{M.b.abbr}</span>
      </span>
    </button>
  );
}

// ====================================================================
// NextPollTicker – how long until this week's expected polls land
// ====================================================================
/* Runs the panel's own projection (window.AP.nextPolls, lifted out of
   NextPollsPanel for this) rather than a second guess at the same thing, so
   the bar and the panel can never disagree about when a poll is due.

   It counts to the EARLIEST the wave could land, not to the middle of the
   window, and says "(maybe)" when a genuinely ALTERNATIVE future day is
   still in play: a window wide enough to hold two of the house's slots, a
   shown slot rolled more than one slot-week past the projected one, or a
   loose cadence. A weekday house rolled to its next slot inside its old
   window is NOT hedged - the doubt there points backwards, to days the
   poll did not come. (The hedge rule lives in the items map; keep them in
   step.)

   A projection is a moment, not a date, and an unrecorded release is not
   rolled forward past it: a slot whose tolerance has run out unpublished
   leaves the countdown and leads the bar, red, counting the days it is
   late - the same claim the panel's red row makes. It used to roll silently
   onto the next slot-week instead, which read exactly like a fresh,
   unmissed forecast. The count clears itself the moment the real release
   is recorded - the projection re-anchors, and this bar and the panel fall
   back to guessing about the future.

   The roll itself is one slot per house, nearest first, and how much of it
   shows is a SPACE decision, not a set number: a fit pass below seats as
   many items as clear the tab set and the docked score on the live bar,
   and parks the rest (still rendered, still measurable) until room
   returns. The old machinery - a 7-day window, then a hard count of three
   - pretended to know the budget without ever measuring it. */
const TN_DAY = 86400000;
const tnUntil = (ms) => {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return mins + (mins === 1 ? " min" : " mins");
  const h = Math.round(mins / 60);
  if (h < 36) return h + (h === 1 ? " hour" : " hours");
  const d = Math.round(h / 24);
  if (d < 14) return d + (d === 1 ? " day" : " days");
  const w = Math.round(d / 7);
  return w + (w === 1 ? " week" : " weeks");
};

/* The pin's condense is a COMPOSITED transform on .tabs-set, so a live
   getBoundingClientRect during the glide returns a mid-animation edge and a
   budget read off it is wrong for ~400ms (the too-many/few count flashes,
   then the settle pass rescues it). The END-STATE set edge is recoverable
   without disturbing the glide: the scale's origin is the left edge, so
   rect.left + offsetWidth * endScale lands exactly on the edge the glide is
   heading to; offsetWidth ignores transforms, and rect.left is the
   origin-fixed left edge. The end scale itself comes from
   a parked offscreen pinned bar, so the scale values in template.html stay
   the single source of truth. */
let pinScaleProbe = null;
function pinnedSetScale() {
  if (!pinScaleProbe) {
    const nav = document.createElement("div");
    nav.className = "tabs pinned";
    nav.setAttribute("aria-hidden", "true");
    nav.style.cssText = "position:absolute;left:-9999px;top:-9999px;"
      + "visibility:hidden;pointer-events:none";
    nav.innerHTML = '<div class="tabs-inner"><div class="tabs-set"></div></div>';
    document.body.appendChild(nav);
    pinScaleProbe = nav.firstChild.firstChild;
  }
  const t = getComputedStyle(pinScaleProbe).transform;
  if (!t || t === "none") return 1;
  const m = new DOMMatrixReadOnly(t);
  return m.a || 1;
}

function NextPollTicker({ showScore }) {
  /* A minute is finer than the answer ever is - the tightest projection here
     is to the day - but it keeps "59 mins" from sitting there after it has
     become "in 2 mins". */
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const [fit, setFit] = React.useState(0);
  const rootRef = React.useRef(null);
  const proj = window.AP.nextPolls ? window.AP.nextPolls() : null;
  const rows = proj ? proj.rows : [];
  const nowMs = proj ? proj.nowMs : 0;
  const t0 = proj ? proj.t0 : 0;

  /* A house that keeps a weekday can only publish ON that weekday, and the
     countdown has to respect that or it says something impossible. Essential
     files on Wednesdays; projected onto Wed 26 Aug and missed, its +-7 day
     window was still technically open on the Monday after, so this used to
     read "any time" - naming a moment that cannot happen until Wednesday. The
     next slot is the next Wednesday, and that is what it counts to.

     The window's EARLY edge still does the work it should: it decides which
     slot is the EARLIEST plausible one, and the answer is the first matching
     weekday on or after that. Roy Morgan, due at midnight today on a Monday
     schedule, is still today rather than a week away.

     Houses with no weekday habit keep the plain window: the earliest the wave
     could land, or "any time" once that has passed. */
  const dayFloor = (ms) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const targetOf = (r) => {
    const half = r.winHalf || 0;
    if (r.releaseDow == null)
      return { at: Math.max(r.release - half * TN_DAY, nowMs), byDay: false };
    /* The window's EARLY edge is measured, not mirrored: no weekday house has
       ever filed a slot early, so counting to release - ±half names a date
       with no precedent - Resolve was counting down to Sun 6 Sep when its
       real alternatives are Sun 13 and Sun 20 Sep. spreadEarly=0 keeps the
       countdown on the projected day itself. */
    const widen = Math.sqrt((r.ahead || 0) + 1);
    const earlyHalf = r.spreadEarly != null
      ? 7 * Math.floor((r.spreadEarly * widen + 3) / 7)
      : half;
    let t = Math.max(t0, dayFloor(r.release - earlyHalf * TN_DAY));
    t += ((r.releaseDow - new Date(t).getUTCDay() + 7) % 7) * TN_DAY;
    return { at: t, byDay: true };
  };

  /* A house whose slot is a WINDOW rather than a date - DemosAU's
     calendar-month bracket - only belongs on the bar while the window is
     open: before the bracket opens, a countdown to its edge misreads a day
     range as a date; after it closes unrecorded, the panel's red row is
     where the lateness is told. While the window IS open the row reads
     "any day now" and sits at the tail of the roll - "some time in the
     next N days" is weaker information than every dated count the bar
     carries, so every slot leads it. */
  const isWindowRow = (r) => r.loose && r.releaseDow == null;
  const windowOpen = (r) => r.release - (r.winHalf || 0) * TN_DAY <= nowMs;
  const windowItems = rows
    .filter((r) => isWindowRow(r) && !r.missed && windowOpen(r))
    .map((r) => ({ firm: r.pollster, when: "any day now", maybe: false, site: r.site }));

  /* A slot whose whole tolerance has passed without its release being
     recorded is not rolled forward onto next week's guess and not dropped:
     it leads the bar in red, counting the days it is late - the same claim
     the panel's red row makes, on the same `missed` flag. A late WINDOW
     counts from its close; a late DAY from the day itself, matching the
     number the panel prints. It leaves when the real release moves the
     projection, never on a date guessed in its place. (Window rows sit
     outside this too - see above.) */
  const overdueItems = rows
    .filter((r) => r.missed && !isWindowRow(r))
    .map((r) => {
      const days = Math.round(
        (t0 - (r.loose ? r.release + (r.winHalf || 0) * TN_DAY : r.release)) / TN_DAY);
      return {
        firm: r.pollster, site: r.site, overdue: true, days,
        when: days === 1 ? "1 day overdue" : days + " days overdue",
      };
    })
    .sort((a, b) => b.days - a.days);

  /* Re-sorted on the rolled target rather than left in the panel's order.
     The panel sorts a missed wave by the slot it missed, because a reader
     looking at the schedule wants to see it is late; the bar is answering
     "what lands next", and after rolling, a Monday house due today comes
     before a Wednesday one that slipped a week. */
  const upcomingItems = rows
    .filter((r) => !r.missed && !isWindowRow(r))
    .map((r) => ({ r, t: targetOf(r) }))
    .sort((a, b) => a.t.at - b.t.at)
    /* One slot PER HOUSE, its nearest: the bar is a roll-call of what's due
       soonest from EVERY house, and a weekly house's second slot inside the
       coming week only repeats a name instead of adding another house to
       the roll. There is no count or day-window cap here - how much of the
       roll actually shows is a space decision measured live on the bar
       itself (the fit pass below). */
    .filter(((seen) => ({ r }) =>
      !seen.has(r.pollster) && !!seen.add(r.pollster))(new Set()))
    .map(({ r, t }) => {
      const half = r.winHalf || 0;
      let when;
      if (t.byDay) {
        const days = Math.round((t.at - t0) / TN_DAY);
        /* Due today and the projected hour already gone is not "today" - it is
           the wave arriving. Roy Morgan files on Mondays and was projected to
           midnight; read on the Monday afternoon, "today" understates a poll
           that could appear while the page is open. */
        when = days === 0 ? (r.release <= nowMs ? "any moment now" : "today")
             : days === 1 ? "tomorrow"
             /* exact day counts past "tomorrow" - the panel's own phrasing
                ("in 12 days") - so the bar and the panel name the same slot
                the same way; tnUntil's week rounding ("2 weeks") made them
                disagree */
             : days + " days";
      } else {
        /* No day pinned, so nothing is "moment" away - the wave is due some
           DAY inside a measured range, and the countdown says so. ("Moment"
           is the weekday houses' word above: theirs is a date with an hour.)
           Sub-day resolution only inside 36 hours; past that, the same exact
           day count the weekday houses get */
        when = t.at <= nowMs ? "any day now"
             : Math.round((t.at - nowMs) / 3600000) < 36
             ? tnUntil(t.at - nowMs)
             : Math.round((t.at - t0) / TN_DAY) + " days";
      }
      /* "(maybe)" answers "could it be some FUTURE day instead?". A weekday
         house can only file on its weekday, so every alternative date is a
         slot of its own, a week apart: the hedge belongs only while two
         slots from now on are both in play – a window wider than a week, or
         a slot rolled more than one slot-week past the projected one (a
         one-week roll is just the old window's own far edge, still this
         wave). A still-open window after a missed slot is not future doubt
         – its earlier dates are past days the wave publicly did not land
         on, so Essential rolled from a missed 26 Aug to 2 Sep reads
         "2 days", full stop. (r.overdue reads "slot moment passed" and
         fires on exactly that case – it is npProject's missed + still-open
         flag, not future doubt.) Non-weekday houses keep the day-spread
         rule. "any moment/day now" is left alone - it already says what
         the hedge would. */
      const maybe = when !== "any moment now" && when !== "any day now" &&
        (half > 7 || !!r.loose ||
         (r.releaseDow != null && t.at - r.release > 7 * TN_DAY) ||
         (r.releaseDow == null && half > 0));
      return { firm: r.pollster, when, maybe, site: r.site };
    });

  /* Overdue leads: an already-blown forecast is more news than any
     countdown. The tail is the fit pass's business - the candidate list is
     the whole roll (one slot per house, nearest first), and the bar shows
     as much of it as clears the neighbours. Window-house rows trail it all:
     "any day now" is weaker information than every dated count. */
  const items = [...overdueItems, ...upcomingItems, ...windowItems];
  const itemsKey = items.map((it) => it.firm + it.when).join("");

  /* ---- fit pass: as many items as the bar has room for -----------------
     The ticker is absolutely seated in both bar states, so anything parked
     inside it can never move the bar's own layout (the pinned-mechanics
     invariant). Every candidate renders; items past the measured budget
     get .tn-park (out of flow + hidden, but still laid out and measurable,
     so a later pass with more room can show them again). The budget is
     read off geometry and follows the SEAT, not the pin: right-seated
     (unpinned, or pinned while the hero's 2PP block is still on screen) it
     is the gap between the tab set and the bar's right edge the ticker
     docks to; centred (show-score) it is twice the shorter run from the
     bar's centre to the tab set and to the docked 2PP score.
     The tab set the edge is read off is NOT always the live-rendered one.
     Right-seated it is always the UNCONDENSED set: the pin's condense
     frees its ~60px for only the few hundred px of scroll between the pin
     and the score docking (pinned-with-hero is a real, dwellable state -
     the pin and hero observers are two IntersectionObservers and can flip
     hundreds of scroll px apart) - so budgeting against it grows the count
     for that band and shrinks it straight back, the momentary
     too-many-polls flash. Centred, the set IS condensed, and the read must
     be the glide's END state (see pinnedSetScale): a mid-transition rect
     leaves a budget - and with it an item count - that only the settle
     pass corrects, the same flash on the other side of the seat swap.
     The pass runs pre-paint (an over-filled bar never reaches the screen),
     on row resize and on seat flips, once webfonts settle, and once more
     ~400ms after a flip to mop up any geometry the prediction could not
     see (fonts settling mid-glide, a viewport resize racing the flip). The
     state is a prefix count: the most urgent items (overdue first) are
     always the ones kept. */
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !items.length) return;
    const SAFE = 56;
    const compute = () => {
      if (!el.isConnected) return;
      const inner = el.parentElement;
      if (!inner) return;
      const innerR = inner.getBoundingClientRect();
      if (innerR.width < 1) return;
      const setEl = inner.querySelector(".tabs-set");
      let budget;
      /* the set edge in the geometry the budget is keyed to: the
         UNCONDENSED set for the right seat (the pin condense is brief
         chrome and must not grow this seat's count), the condensed END
         state for the centred seat (a mid-glide rect is wrong for ~400ms
         - see pinnedSetScale). The scale's origin is the fixed left edge,
         so rect.left + offsetWidth * endScale lands exactly on the edge
         the glide is heading to. */
      let setRight = innerR.left;
      if (setEl) {
        setRight = setEl.getBoundingClientRect().left
          + setEl.offsetWidth * (showScore ? pinnedSetScale() : 1);
      }
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const kids = el.children;
      if (showScore) {
        const scoreEl = inner.querySelector(".tab-score");
        const scoreR = scoreEl ? scoreEl.getBoundingClientRect() : null;
        const centre = (innerR.left + innerR.right) / 2;
        const leftRoom = centre - setRight;
        const rightRoom = (scoreR && scoreR.width ? scoreR.left : innerR.right) - centre;
        budget = 2 * Math.max(0, Math.min(leftRoom, rightRoom) - SAFE);
      } else {
        budget = innerR.right - setRight - SAFE;
      }
      let used = kids[0].offsetWidth, k = 0;
      for (let i = 1; i < kids.length; i++) {
        if (used + gap + kids[i].offsetWidth > budget) break;
        used += gap + kids[i].offsetWidth;
        k++;
      }
      setFit(k);
    };
    compute();
    const settle = setTimeout(compute, 420);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(compute);
    return () => { clearTimeout(settle); if (ro) ro.disconnect(); };
  }, [itemsKey, showScore]);

  if (!items.length) return null;

  const title = "Projected from each house's recent publication intervals"
    + " – the earliest each wave could land, not the likeliest."
    + " A slot that passes unrecorded counts up as overdue until the release is added";
  return (
    <div ref={rootRef} className="tab-next" title={title}>
      {/* the label itself is the way DOWN to the full panel on the snapshot -
          same trick as the house names being the way OUT to the publisher */}
      <button type="button" className="tn-lab tn-jump"
              title="Jump to the Next expected polls panel"
              onClick={() => window.AP.gotoNextPolls && window.AP.gotoNextPolls()}>
        Next
      </button>
      {items.map((it, i) => (
        <span className={"tn-item" + (i >= fit ? " tn-park" : "")} key={i}>
          {/* the name carries the house's publication link, the same one the
              panel attaches to the pollster name */}
          <span className="tn-firm">
            {it.site
              ? <a className="tn-link" href={it.site} target="_blank" rel="noopener noreferrer"
                   title={`Where ${it.firm} publishes`}>
                  {it.firm}<span className="plink-mark" aria-hidden="true">↗</span>
                </a>
              : it.firm}
          </span>
          <span className={"tn-when" + (it.overdue ? " tn-overdue" : "")}>
            {it.when}
            {it.maybe && <span className="tn-maybe"> (maybe)</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

// ====================================================================
// Tabs – editorial underlined nav beneath the header
// ====================================================================
function Tabs({ tabs, active, onChange, tppMatchup }) {
  // Sticky on every view. Once the bar is pinned AND the hero's 2PP figures
  // have scrolled out of view, a compact score docks into the right side of
  // the bar – it is a stand-in for the hero, so it never shares the screen
  // with it. On the other tabs the hero is not mounted at all, so the score
  // travels with the bar as soon as it pins.
  const [pinned, setPinned] = React.useState(false);
  const [heroGone, setHeroGone] = React.useState(false);
  const sentRef = React.useRef(null);
  const btnRefs = React.useRef({});

  /* Arrow-key navigation. Without it the role="tab" markup was a promise the
     widget didn't keep: a screen reader announced "tab, 1 of 3" and then the
     arrow keys – the only way the pattern says to move between tabs – did
     nothing. Selection follows focus, which is the right call here because
     switching views is instant and has no side effects. */
  const onTabKeyDown = (e) => {
    const ids = tabs.map((t) => t.id);
    const i = ids.indexOf(active);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const el = btnRefs.current[next];
    if (el) el.focus();
  };

  // The docked score is a shortcut home: switch to Snapshot (where the 2PP
  // hero lives) and ride to the top. If already on Snapshot, just glide up.
  const goHero = () => {
    if (active !== "snapshot") onChange("snapshot");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // A zero-height sentinel sits at the tab bar's natural flow position. When it
  // scrolls above the viewport top, the sticky bar has caught the top edge –
  // flip pinned so it can condense and lift off the content.
  React.useEffect(() => {
    const el = sentRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => setPinned(!e.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* The swap in the bar – docked 2PP score in, ticker to the middle – is one
     move, gated on the hero, not the pin: it waits until the hero's 2PP block
     (the readout figures AND the gauge bar under them) has scrolled off. The
     ticker's seat change lives in CSS on the same show-score class, so score
     and seat always move together. The hero unmounts with the snapshot view,
     so the target is (re)acquired whenever the active tab changes;
     off-snapshot there is nothing to wait for and the bar swaps as soon as
     it pins. The gauge IS the trigger element (it sits directly under the
     figures and spans the block's width); if it is somehow absent the
     readout itself is the fallback. */
  React.useEffect(() => {
    if (!("IntersectionObserver" in window)) { setHeroGone(true); return; }
    if (active !== "snapshot") { setHeroGone(true); return; }
    const el = document.querySelector(".hero-gauge")
            || document.querySelector(".hero-readout");
    if (!el) { setHeroGone(true); return; }
    setHeroGone(false);
    const io = new IntersectionObserver(
      ([e]) => setHeroGone(!e.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return (
    <React.Fragment>
      <div ref={sentRef} className="tabs-sentinel" aria-hidden="true"></div>
      {/* role="tablist" belongs on the element that actually OWNS the tabs. It
          used to sit on the <nav>, two wrappers up, which both broke the
          ownership the pattern requires and overwrote the nav's landmark. */}
      <nav className={"tabs sticky" + (pinned ? " pinned" : "")
                      + (pinned && heroGone ? " show-score" : "")}
           aria-label="Views">
        <div className="tabs-inner">
          <div className="tabs-set" role="tablist" aria-label="Views"
               onKeyDown={onTabKeyDown}>
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id}
                      id={"tab-" + t.id} aria-controls={"panel-" + t.id}
                      /* a tab's title is its hover caption; only Info carries
                         one today, so undefined just renders no attribute */
                      title={t.tip}
                      /* roving tabindex: the tab strip is ONE tab stop and the
                         arrow keys move within it, per the ARIA tabs pattern */
                      tabIndex={active === t.id ? 0 : -1}
                      ref={(el) => { btnRefs.current[t.id] = el; }}
                      className={"tab" + (active === t.id ? " active" : "")
                                 + (t.pinHide ? " tab-pinhide" : "")}
                      onClick={() => onChange(t.id)}>
                <span className="tab-label">{t.label}</span>
                {t.note != null && <span className="tab-note">{t.note}</span>}
              </button>
            ))}
          </div>
          {/* the ticker's fit budget is keyed to the SEAT, and the seat is
              show-score's (score docked => centred), not the pin's - a bare
              pin flip changes nothing the ticker measures (see the fit pass
              in NextPollTicker) */}
          <NextPollTicker showScore={pinned && heroGone} />
          {/* phone placeholder: while the bar is pinned but the hero's 2PP
              is still on screen, the score's seat is empty - the masthead's
              own dial holds it until the score docks (CSS: .tab-glyph joins
              and leaves on the same .show-score gate as .tab-score, so the
              swap is one move). */}
          <GlyphDial className="tab-glyph" width="34" height="23.8" />
          <TabScore onGoHero={goHero} matchup={tppMatchup} />
        </div>
      </nav>
    </React.Fragment>
  );
}

// ====================================================================
// PAST CYCLES – every term aligned to its election day
// ====================================================================
// y-windows are fitted to the real data per metric+mode (see cycDomain) –
// fixed windows clip real history (e.g. net approval spans −44…+41)
const CYC_METRICS = [
  /* The "Approve minus disapprove" half of the approval subs is attached at
     render time as a tap-to-define link – keeping it in the string here would
     leave it as dead text. */
  { key: "net", title: "Prime minister net approval", sub: "Sitting prime minister",
    unit: "", fmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    step: 20, refAbs: 0, refAbsLabel: "even" },
  { key: "oppnet", title: "Opposition leader net approval", sub: "Sitting opposition leader",
    leader: "opp", unit: "", fmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    step: 10, refAbs: 0, refAbsLabel: "even", han: true },
  /* One line per term: the PM's lead in the preferred-PM question, pmPpm
     minus oppPpm. The pairing names itself per segment (e.ppmEras, or
     c.raw.ppmPair when it never changed), the fallback label for an
     unsegmented term is that pairing, not a lone office – "Hawke v Peacock",
     not "Hawke". Leading nulls stay null, so sparse terms open mid-term
     (1990's first ppm reading is 1991-07); the change-since anchor is
     therefore the first READING, never election day, and the zero line is
     labelled for that. */
  { key: "ppmm", title: "Preferred prime minister",
    sub: "Sitting prime minister’s lead on the preferred-PM question",
    unit: "", fmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    step: 10, refAbs: 0, refAbsLabel: "even", chgRefLabel: "First reading" },
  { key: "primary", title: "Government primary vote", sub: "First-preference support for the governing party",
    unit: "%", fmt: (v) => v.toFixed(1),
    step: 5, refAbs: null },
  { key: "tpp", title: "Government two-party preferred", sub: "Governing party 2PP",
    unit: "%", fmt: (v) => v.toFixed(1),
    step: 5, refAbs: 50, refAbsLabel: "50 – tie" },
  /* The opposition chart reads the same terms from the losing side of them:
     the opposition party's own primary line. leader:"opp" makes the line and
     dot labels name the opposition leader; the insight sentence keys its
     subject off M.key, so this gets "the Coalition … the average opposition".
     There is no opposition-2PP chart – 2PP sums to 100, so it would be an
     exact mirror of the government 2PP chart above. */
  { key: "oppr", title: "Opposition primary vote", sub: "First-preference support for the opposition party",
    leader: "opp", onp: true, unit: "%", fmt: (v) => v.toFixed(1),
    step: 5, refAbs: null },
];

// domain over ALL cycles (not just visible ones) so toggling a cycle off
// never rescales the chart under the pointer
// a cycle's baseline for "change since" mode: its election-day anchor where it
// has one, else its first actual reading – measures that start late (leader
// approval) have no month-0 value to subtract
const cycBase = (c, key) => {
  const v = c.base[key];
  if (v != null) return v;
  const first = c.raw[key].find((x) => x != null);
  return first != null ? first : 0;
};

function cycDomain(cycles, M, chg) {
  const vals = cycles.flatMap((c) => c.raw[M.key]
    .filter((v) => v != null)
    .map((v) => (chg ? v - cycBase(c, M.key) : v)));
  // Hanson joins the domain whether or not her box is ticked, for the same
  // reason hidden cycles do: ticking a box should reveal a line, not rescale
  // the axis under the pointer.
  if (M.han) vals.push(...cycles.flatMap((c) => (c.raw.han || [])
    .filter((v) => v != null)
    .map((v) => (chg ? v - cycBase(c, "han") : v))));
  // One Nation's overlay follows the same rule on the opposition primary chart.
  if (M.onp) vals.push(...cycles.flatMap((c) => (c.raw.onp || [])
    .filter((v) => v != null)
    .map((v) => (chg ? v - cycBase(c, "onp") : v))));
  const ref = chg ? 0 : M.refAbs;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (ref != null) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
  const step = M.step;
  const d0 = Math.floor((lo - step * 0.3) / step) * step;
  const d1 = Math.ceil((hi + step * 0.3) / step) * step;
  const ticks = [];
  for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
  return { domain: [d0, d1], ticks };
}

const CYC_XDOMAIN = [-1.6, 37.6];
const CYC_XTICKS = [
  { x: 0, label: "Election" }, { x: 12, label: "1 yr" },
  { x: 24, label: "2 yrs" }, { x: 36, label: "3 yrs" },
];
const CYC_SPINE = [];
for (let m = 0; m <= 36; m++) CYC_SPINE.push({ x: m });

function cycMonthLabel(m) {
  if (m <= 0) return "Election day";
  if (m % 12 === 0) return (m / 12) + (m === 12 ? " year in" : " years in");
  return m + " months in";
}

/* The calendar month a cycle month lands on. Only ever shown when a single
   cycle is on the chart: with six terms overlaid, "month 11" is the whole
   point of the alignment and a date would belong to only one of them. Alone,
   the reader is looking at one term and counting forward from an election date
   they have to remember is work the tooltip can just do.
   Named from the election month rather than by adding days, because the
   buckets behind the line are averaged months (365.25/12) - this is the month
   the bucket sits in, not an exact date. */
function cycMonthOf(eDate, m) {
  const [y, mo] = eDate.split("-").map(Number);
  const t = (mo - 1) + Math.max(0, m);
  return window.AP.D.monthNameFull((t % 12) + 1) + " " + (y + Math.floor(t / 12));
}

/* Events pinned to one term, drawn only while that term stands alone on the
   chart: overlaid with five other cycles a date belongs to no single line.
   x is derived from the cycle's election date at render, in the same
   months-since-election units as the cycles themselves. An optional metrics
   whitelist pins the event to those chart measures alone. */
const cycEventMonth = (iso, eDate) => (Date.parse(iso) - Date.parse(eDate)) / 86400000 / MS_MONTH_C;
const CYC_EVENTS = {
  1987: [
    {
      date: "1989-05-09", short: "Howard → Peacock",
      label: "Peacock replaces Howard as opposition leader",
      desc: "Andrew Peacock defeats John Howard in a Liberal leadership spill, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
  ],
  1990: [
    {
      date: "1991-12-20", short: "Hawke → Keating",
      label: "Keating replaces Hawke as prime minister",
      desc: "Paul Keating defeats Bob Hawke in a Labor leadership spill at his second attempt and is sworn in as prime minister.",
      major: true,
    },
  ],
  1993: [
    {
      date: "1994-05-23", short: "Hewson → Downer",
      label: "Downer replaces Hewson as opposition leader",
      desc: "Alexander Downer defeats John Hewson in a Liberal leadership spill, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "1995-01-30", short: "Downer → Howard",
      label: "Howard replaces Downer as opposition leader",
      desc: "John Howard replaces Alexander Downer as Liberal leader and opposition leader after Downer resigns.",
      major: true,
      metrics: ["oppnet"],
    },
  ],
  2001: [
    {
      date: "2001-11-22", short: "Beazley → Crean",
      label: "Crean replaces Beazley as opposition leader",
      desc: "Kim Beazley resigns after Labor’s 2001 election defeat and Simon Crean is elected unopposed as Labor leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2003-12-02", short: "Crean → Latham",
      label: "Latham replaces Crean as opposition leader",
      desc: "Mark Latham defeats Kim Beazley 47–45 in a Labor leadership ballot after Simon Crean resigns, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
  ],
  2004: [
    {
      date: "2005-01-28", short: "Latham → Beazley",
      label: "Beazley replaces Latham as opposition leader",
      desc: "Mark Latham resigns the Labor leadership and leaves parliament; Kim Beazley is elected unopposed as his replacement.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2006-12-04", short: "Beazley → Rudd",
      label: "Rudd replaces Beazley as opposition leader",
      desc: "Kevin Rudd defeats Kim Beazley 49–39 in a Labor leadership spill, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
  ],
  2007: [
    {
      date: "2008-09-16", short: "Nelson → Turnbull",
      label: "Turnbull replaces Nelson as opposition leader",
      desc: "Malcolm Turnbull defeats Brendan Nelson 45–41 in a Liberal leadership spill, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2009-12-01", short: "Turnbull → Abbott",
      label: "Abbott replaces Turnbull as opposition leader",
      desc: "Tony Abbott defeats Malcolm Turnbull 42–41 in a Liberal leadership spill over emissions trading, becoming opposition leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2010-06-24", short: "Rudd → Gillard",
      label: "Gillard replaces Rudd as prime minister",
      desc: "Kevin Rudd stands down rather than contest a Labor leadership spill and Julia Gillard is sworn in as prime minister.",
      major: true,
    },
  ],
  2010: [
    {
      date: "2010-12-15", short: "Refugee tragedy",
      label: "Boat sinks off Christmas Island",
      desc: "A boat carrying refugees sinks off Christmas Island, killing 48 people aboard and provoking criticism of the Gillard government’s refugee policy.",
      major: true,
    },
    {
      date: "2011-02-24", short: "Carbon pricing scheme",
      label: "Gillard announces a carbon pricing scheme",
      desc: "Prime Minister Julia Gillard announces a fixed price on carbon pollution from 1 July 2012 to combat climate change; the Clean Energy Act 2011 is enacted on 18 November.",
      major: true,
    },
    {
      date: "2013-06-27", short: "Gillard → Rudd",
      label: "Rudd replaces Gillard as prime minister",
      desc: "Kevin Rudd defeats Julia Gillard in a Labor leadership spill and is sworn in as prime minister.",
      major: true,
    },
  ],
  2013: [
    {
      date: "2013-11-18", short: "Indonesia spy row",
      label: "Indonesia recalls ambassador over spying revelations",
      desc: "Indonesia recalls its ambassador after leaked documents reveal Australia spied on president Susilo Bambang Yudhoyono.",
      major: true,
    },
    {
      date: "2014-05-13", short: "Hockey’s first budget",
      label: "Joe Hockey delivers the 2014 federal budget",
      desc: "Treasurer Joe Hockey delivers the Abbott government’s first federal budget with deep cuts to health, education, and welfare.",
      major: true,
    },
    {
      date: "2015-01-26", short: "Prince Philip knighted",
      label: "Abbott announces knighthood for Prince Philip",
      desc: "Prime Minister Tony Abbott awards Prince Philip a knighthood in the Order of Australia, drawing widespread ridicule.",
      major: true,
    },
    {
      date: "2015-09-15", short: "Abbott → Turnbull",
      label: "Turnbull replaces Abbott as prime minister",
      desc: "Malcolm Turnbull defeats Tony Abbott in a Liberal leadership spill and is sworn in as prime minister.",
      major: true,
    },
  ],
  2016: [
    {
      date: "2017-10-17", short: "Clean Energy Target dumped",
      label: "Coalition dumps the Clean Energy Target",
      desc: "The Coalition dumps the Clean Energy Target in favour of Malcolm Turnbull’s new plan, a National Energy Guarantee.",
      major: true,
    },
    {
      date: "2017-11-15", short: "Marriage survey Yes vote",
      label: "Marriage postal survey returns a Yes vote",
      desc: "The Australian Marriage Law Postal Survey delivers a national Yes vote for same-sex marriage.",
      major: true,
    },
    {
      date: "2018-07-28", short: "Super Saturday by-elections",
      label: "Super Saturday by-elections return every incumbent",
      desc: "Five federal by-elections return every incumbent – Labor holds Braddon, Fremantle, Longman and Perth, and Centre Alliance holds Mayo, with the Coalition winning none.",
      major: true,
    },
    {
      date: "2018-08-21", short: "Dutton challenges Turnbull",
      label: "Dutton mounts a leadership challenge",
      desc: "Home Affairs minister Peter Dutton challenges Malcolm Turnbull for the Liberal leadership, losing the spill 48 votes to 35.",
      major: true,
    },
    {
      date: "2018-08-24", short: "Turnbull → Morrison",
      label: "Morrison replaces Turnbull as prime minister",
      desc: "Malcolm Turnbull resigns and Scott Morrison defeats Peter Dutton in the Liberal leadership spill, becoming prime minister.",
      major: true,
    },
    {
      date: "2019-05-27", short: "Shorten → Albanese",
      label: "Albanese replaces Shorten as opposition leader",
      desc: "Anthony Albanese is elected unopposed as Labor leader, after Bill Shorten resigns in the wake of the 2019 federal election defeat.",
      major: true,
      metrics: ["oppnet"],
    },
  ],
  2019: [
    {
      date: "2019-11-09", short: "Bushfire emergency",
      label: "Queensland declares a state of emergency",
      desc: "Queensland declares a state of emergency amid catastrophic bushfire conditions – two days before NSW follows.",
      major: true,
    },
    {
      date: "2020-03-11", short: "COVID-19 pandemic",
      label: "WHO declares COVID-19 a pandemic",
      desc: "The World Health Organization declares the COVID-19 outbreak a pandemic.",
      major: true,
    },
    {
      date: "2021-02-15", short: "Higgins allegations",
      label: "Brittany Higgins goes public",
      desc: "Former Liberal staffer Brittany Higgins goes public with allegations that she was raped inside Parliament House.",
      major: true,
    },
  ],
  2022: [
    {
      date: "2023-10-14", short: "Voice referendum defeated",
      label: "Voice to Parliament referendum defeated",
      desc: "Australians vote No to enshrining an Aboriginal and Torres Strait Islander Voice to Parliament in the Constitution – the proposal fails nationally and in every state.",
      major: true,
    },
    {
      date: "2023-11-07", short: "RBA cash rate hits 4.35%",
      label: "RBA hikes the cash rate to a 12-year high",
      desc: "The RBA board hikes the cash rate 25 basis points to 4.35% – the central bank’s 13th rate rise since May 2022, widely anticipated by economists.",
      major: true,
    },
    {
      date: "2025-03-28", short: "Election called",
      label: "Albanese announces the federal election",
      desc: "Albanese announces the federal election, kicking off a campaign that produced a dramatic rise in Labor support.",
      major: true,
    },
  ],
  2025: [
    {
      date: "2025-05-28", short: "1st Coalition split",
      label: "First Coalition dissolution",
      desc: "The Liberal–National Coalition dissolves for the first time, weeks after the 2025 election defeat.",
      major: true,
    },
    {
      date: "2025-12-14", short: "Bondi shooting",
      label: "Bondi Beach shooting",
      desc: "A shooting at Bondi Beach in Sydney.",
      major: true,
    },
    {
      date: "2026-01-22", short: "2nd Coalition split",
      label: "Coalition dissolves again",
      desc: "Second dissolution of the Liberal–National Coalition.",
      major: true,
    },
    {
      date: "2026-02-12", short: "Ley → Taylor",
      label: "Taylor replaces Ley as opposition leader",
      desc: "Angus Taylor replaces Sussan Ley as Leader of the Liberal Party and Opposition Leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2026-05-12", short: "2026 Budget",
      label: "2026 federal Budget",
      desc: "Treasurer Jim Chalmers delivers the Albanese government’s fifth federal budget, with sweeping CGT changes.",
      major: true,
    },
  ],
};

/* ---- the readings behind a cycle's line --------------------------------
   These charts are monthly averages, and an average is a claim about polls
   the reader cannot see. Narrow the board to ONE term and they appear: the
   cloud under a line is what the line is made of, and how much it is
   scattering is half of what a term's trajectory means.

   One and not a handful, because a cloud is a much heavier mark than a line.
   Two lines cross and stay legible; two clouds occupy the same space and
   become one, and the reader has to decode which points belong to which term
   before they can read either. A single term has nothing to disentangle, and
   is also the moment the reader has said they want to look closely.

   Same rule as the line it sits under, in both directions: a favourability
   net never joins an approve-minus-disapprove cloud, and the election-day row
   is not a poll, so neither is a dot. */
const CYC_DOT_MAX = 1;
const MS_MONTH_C = 365.25 / 12;

/* The same month-bucket test cycleSeries applies when it builds the line, not
   a lookalike: the cloud is meant to BE what the line is made of, so a poll
   the line counts and the dot drops (or the reverse) is a contradiction on
   one chart. No row disagrees today; expressing it twice is how that stops
   being true later. */
const inCycleRange = (m) => { const k = Math.round(m); return k >= 0 && k <= 36; };

function cycDotDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + window.AP.D.monthName(m) + " " + y;
}

function cycleReadings(c, M, D) {
  const out = [];
  const key = M.key, isOpp = M.leader === "opp";
  if (c.current) {
    const mOf = (iso) => (Date.parse(iso) - Date.parse(c.eDate)) / 86400000 / MS_MONTH_C;
    for (const p of D.individualPolls) {
      const mb = (p.appr && p.appr.metricBy) || {};
      let y = null;
      if (key === "primary") y = p.p ? p.p[c.gov] : null;
      else if (key === "oppr") y = p.p ? p.p[c.opp] : null;
      else if (key === "tpp") y = p[c.gov];
      else if (key === "net") y = (mb.alb || "approval") === "fav" ? null : (p.appr ? p.appr.albNet : null);
      else if (key === "oppnet") y = (mb.taylor || "approval") === "fav" ? null : (p.appr ? p.appr.taylorNet : null);
      /* the ppm line's margin, from the wave's MAIN pairing (sets[0] is
         always the published main row; the Albanese-v-Hanson H2 is appended
         last). The opponent's key varies with the leader (ley, taylor…), so
         find it as the one dynamic key among alb/unc/hanson. */
      else if (key === "ppmm") {
        const s = p.ppmSets ? p.ppmSets[0] : p.ppm;
        const ok = s && Object.keys(s).find((k) => !["alb", "unc", "hanson"].includes(k));
        if (ok == null || s[ok] == null || s.alb == null) continue;
        y = s.alb - s[ok];
      }
      if (y == null) continue;
      out.push({ x: mOf(p.released), y, iso: p.released,
                 meta: { pollster: p.pollster, dateLabel: p.dateLabel, sample: p.sample, released: p.released } });
    }
    return out;
  }
  const src = (D.cycleSource || {})[c.year];
  if (!src) return out;
  if (key === "primary" || key === "oppr" || key === "tpp") {
    const f = key === "tpp" ? "tpp_" + c.gov
            : key === "oppr" ? c.opp
            : c.gov;
    for (const p of src.polls) {
      if (p[f] == null || p.firm === "Election" || !inCycleRange(p.m)) continue;
      out.push({ x: p.m, y: p[f], iso: p.date, meta: { pollster: p.firm, dateLabel: cycDotDate(p.date) } });
    }
  } else if (key === "ppmm") {
    // margin per wave, PM minus opponent. Pairing-neutral, so the
    // favourability gate below does not apply (gen-data says why: a firm
    // can report approval as favourability while its ppm readings stand)
    for (const r of src.approval) {
      if (r.pmPpm == null || r.oppPpm == null || !inCycleRange(r.m)) continue;
      out.push({ x: r.m, y: r.pmPpm - r.oppPpm, iso: r.date, meta: { pollster: r.firm, dateLabel: cycDotDate(r.date) } });
    }
  } else {
    const f = isOpp ? "oppNet" : "pmNet";
    for (const r of src.approval) {
      if (r[f] == null || r.metric === "fav" || !inCycleRange(r.m)) continue;
      out.push({ x: r.m, y: r[f], iso: r.date, meta: { pollster: r.firm, dateLabel: cycDotDate(r.date) } });
    }
  }
  return out;
}

/* ---- where the line runs between readings, not through them -------------
   cycleSeries interpolates a month nothing was polled in, and a solid line
   through that point claims a measurement that was never taken. Rare - four
   single months across every past cycle and metric - which is exactly why it
   is worth marking: a dash here is a real signal about those four months,
   not a caveat smeared over the whole chart.

   The line is split into runs and handed over as several series, because
   `dashed` applies to a whole stroke. Consecutive runs SHARE their boundary
   point so the line stays visually continuous across the change, and every
   run keeps the cycle's own label - the tooltip collapses them back into the
   one row the reader thinks they are hovering.

   A segment is dashed when EITHER end is an unpolled month: both the approach
   to an invented point and the departure from it are drawn between readings,
   and dashing only one side would point at the wrong half. */
function obsRuns(pts, observed) {
  if (pts.length < 2) return [{ dashed: false, points: pts }];
  const runs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dashed = !(observed(pts[i].x) && observed(pts[i + 1].x));
    const last = runs[runs.length - 1];
    if (last && last.dashed === dashed) last.points.push(pts[i + 1]);
    else runs.push({ dashed, points: [pts[i], pts[i + 1]] });
  }
  return runs;
}

/* The office-HOLDER at the end of a leader list: CYC_META writes mid-term
   handovers as "Ley → Taylor", and the insight sentence names the person
   sitting in the office now. The primary/2PP charts keep the party, because
   they still measure parties – but a leader chart averages the holders of an
   office, so its subject is a person and its peer is a prime minister or
   opposition leader, not a "government". */
const sitting = (s) => s.split(" → ").pop();

/* Shape is assigned WITHIN a colour, not across the board: the point is to
   separate two Coalition terms from each other, and giving the lone Labor
   term beside them a triangle would be decoration standing in for a
   distinction that colour already makes. So the first term of each party
   keeps circles and only a second and third need a shape of their own.

   DORMANT at CYC_DOT_MAX = 1: one term on the board is one colour, so every
   cloud drawn today is circles. Kept because the rule is the hard part and
   the threshold is one number - raise it and two same-coloured terms are
   still told apart, in the legend and on the chart, without rediscovering
   why colour alone could not do it. */
const CYC_SHAPES = ["circle", "triangle", "diamond"];
function cycShapes(shown) {
  const seen = {}, out = {};
  for (const c of shown) {
    const n = (seen[c.color] = (seen[c.color] || 0) + 1);
    out[c.year] = CYC_SHAPES[n - 1] || "circle";
  }
  return out;
}

// linear-interpolate quarterly (or monthly) anchors onto a 0..maxM month grid.
// Only KNOWN anchors are interpolated between: a measure can start late (the
// Morrison term's first reading is month 2, and its 2016 predecessor's opens
// on the election), and those months stay null rather than borrowing the
// first reading.
function toMonthly(months, vals, maxM) {
  const anchors = [];
  for (let i = 0; i < months.length; i++) {
    if (vals[i] != null) anchors.push({ m: months[i], v: vals[i] });
  }
  const out = [];
  for (let m = 0; m <= maxM; m++) {
    if (!anchors.length || m < anchors[0].m || m > anchors[anchors.length - 1].m) {
      out.push({ x: m, y: null });
      continue;
    }
    let k = 0;
    while (k < anchors.length - 1 && anchors[k + 1].m <= m) k++;
    const a = anchors[k], b = anchors[Math.min(k + 1, anchors.length - 1)];
    const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
    out.push({ x: m, y: +(a.v + (b.v - a.v) * t).toFixed(2) });
  }
  return out;
}

// rank-based percentile, linear between neighbouring ranks: the quartile
// edges of eleven or so terms should not pretend to be integers
function pctOf(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/* Who the line on THIS chart belongs to. The legend above the tab names every
   term for its prime minister, which on the two opposition charts is the wrong
   person entirely – the 2013 line there is Shorten, not Abbott – and with one
   legend serving six charts there is nowhere for it to say so. The per-chart
   strip can, so it asks the measure. Same rule the drawn line labels use: the
   measure's own eras where the office changed hands, both holders joined "–",
   and the plain officeholder otherwise. */
function cycHolders(c, M) {
  /* Preferred PM is a PAIRING, and its eras are already whole pairings – so
     joining them the way the single-office measures join theirs produced
     "Rudd v Nelson–Rudd v Turnbull–Rudd v Abbott–Gillard v Abbott". The two
     sides are collapsed separately instead: "Rudd–Gillard v Nelson–Turnbull–
     Abbott". ppmPair alone would not do either – it is the term's FIRST
     pairing, so the current term would answer "Albanese v Ley" months after
     Taylor took the job. */
  if (M.key === "ppmm") {
    const pairs = c.raw.ppmEras && c.raw.ppmEras.length > 1
      ? c.raw.ppmEras.map((e) => e.name) : [c.raw.ppmPair];
    const side = (i) => {
      const seen = [];
      for (const pr of pairs) {
        const nm = String(pr).split(" v ")[i];
        if (nm && seen[seen.length - 1] !== nm) seen.push(nm);
      }
      return seen.join("\u2013");
    };
    return side(0) + " v " + side(1);
  }
  /* Everything else is one office. The CYC_META display string is the whole
     succession for that side of the term – "Rudd → Gillard", "Nelson → Turnbull
     → Abbott" – and the same string on both sides, which the eras are not: the
     share charts have no eras of their own, and an approval era only exists
     where a holder was rated. It agrees with the legend chip's netEras join on
     every term on the board; where it would not, it is the more complete of the
     two, and the two must not disagree about who led a term. */
  return String(M.leader === "opp" ? c.oppLead : c.pm)
    .split(/\s*\u2192\s*/).join("\u2013");
}

/* One gate for the band decision, shared by the charts (which draw it) and
   the legend (which captions it): three or more past terms on the board. */
const cycBanded = (cycles, hidden) =>
  cycles.filter((c) => !hidden.has(c.year) && !c.current).length >= 3;

function CycleChart({ metric, cycles, mode, hidden, hi, lifted, unlift, showHan, setHan, showOnp, setOnp, shapes, outcomeShown }) {
  const { D } = window.AP;
  const narrow = useNarrow();
  const M = metric;
  const chg = mode === "chg";
  const isOpp = M.leader === "opp";

  /* Hanson is available only where the data is: the current cycle, and only
     from rows whose metric is approval. hanAvail gates both the line and the
     tickbox, so if the readings are ever removed the control disappears with
     them rather than offering an empty line. */
  const HAN_COLOR = D.PARTIES.onp.color;
  const hanCycle = M.han ? cycles.find((c) => c.current) : null;
  const hanRaw = (hanCycle && hanCycle.raw.han) || null;
  const hanAvail = !!(hanRaw && hanRaw.some((v) => v != null));
  /* Name the first READING, not the first month bucket it lands in: the
     earliest rating is 19 Feb 2026, which rounds into the month-10 bucket
     centred on early March, and a provenance note that says "March" about a
     February poll is exactly the kind of small lie this page tries not to
     tell. */
  const hanFrom = hanAvail ? (() => {
    const dates = D.individualPolls
      .filter((p) => p.appr && p.appr.hansonNet != null &&
                     (!p.appr.metricBy || p.appr.metricBy.hanson !== "fav"))
      .map((p) => p.released)
      .sort();
    if (!dates.length) return null;
    return new Date(dates[0] + "T00:00:00")
      .toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  })() : null;

  // build a monthly series per drawn cycle. Past cycles that DO draw
  // (a thin board, or one lifted out of the band by a chip hover) sit
  // behind at reduced opacity unless highlighted, and carry a year label
  // at the line's end. The tint follows the party being MEASURED (red
  // Labor / blue Coalition): the term's government on its own charts, its
  // opposition on the opposition charts, so a Coalition line never wears
  // Labor red. (The legend chips keep term colours – a chip toggles a
  // parliament, and a parliament is named for its government.)
  const colorOf = (c) => (isOpp ? D.PARTIES[c.opp].color : c.color);
  const shown = cycles.filter((c) => !hidden.has(c.year));
  /* Ribbon, not spaghetti: with three or more PAST terms on the board their
     per-term lines collapse into the historical band drawn further down
     (min–max and interquartile fills around the mean) – a dozen
     near-identical lines read as weather, not as data. Hovering a legend
     chip LIFTS its term's own line back out of the band in full colour;
     thinning the board below three past terms (or isolating one) falls
     back to plain lines, since a ribbon of two is as tall as the lines it
     replaces. */
  const pastShown = shown.filter((c) => !c.current);
  const banded = cycBanded(cycles, hidden);
  /* The band's membership is data; what still gets its own line is the sitting
     term, whatever terms the reader has LIFTED out of the band, and whatever a
     chip hover is previewing. The lift is the durable one: it survives the
     pointer leaving the legend, which is the whole point of it, since the
     legend sits above six charts and scrolls out of reach after the first. */
  const drawnCycles = banded
    ? shown.filter((c) => c.current || lifted.has(c.year) || hi === c.year)
    : shown;
  /* One cycle left on the chart: the year on every readout row is then drawing
     a distinction against nothing, so the row keeps the leader alone and the
     title takes the calendar month instead. */
  const solo = shown.length === 1 ? shown[0] : null;
  /* Events belong to a term's own line, so they display once the chart is
     about ONE term - however it was narrowed. Solo is the no-ribbon case.
     With the ribbon running, exactly one past term brought forward of the
     band (lifted, or the hover preview) is again a single line the dates
     can attach to: the band itself is background, not a competing line.
     And the sitting term is that single line whenever nothing has been
     brought forward - it cannot be lifted, it is simply always drawn, so
     the resting ribbon state is where its own events live. */
  const pastForward = drawnCycles.filter((c) => !c.current);
  const eventCycle = solo
    || (pastForward.length === 1
        ? pastForward[0]
        : (pastForward.length === 0 ? drawnCycles.find((c) => c.current) || null : null));
  const cycleEvents = eventCycle
    ? (CYC_EVENTS[eventCycle.year] || [])
        .filter((e) => !e.metrics || e.metrics.includes(M.key))
        .map((e) => ({ ...e, x: cycEventMonth(e.date, eventCycle.eDate) }))
    : [];
  /* The two approval charts caption what the fan behind the singled-out
     line is made of: "selected" once any cycle chip is off, the outcome
     filter's scope when the board has been cut to one outcome (a filter is
     itself a selection, but names its own clause instead), and the old
     static subtitle when the board is so thin there is no fan at all. */
  const cardSub = (() => {
    if (M.key !== "net" && M.key !== "oppnet") return M.sub;
    if (!banded) return M.sub;
    const office = M.leader === "opp" ? "opposition leader" : "prime minister";
    const hist = office + " net approval since 1987";
    if (outcomeShown === "returned")
      return "With a fan chart of historical " + hist
        + ", for terms at the end of which the government was returned";
    if (outcomeShown === "ousted")
      return "With a fan chart of historical " + hist
        + ", for terms at the end of which the government was ousted";
    return "With a fan chart of " + (hidden.size ? "selected historical " : "historical ")
      + hist;
  })();
  /* Hanson's tickbox follows her data, not the board: her series belongs to
     the current term, but she is a person-toggle, not a property of the 2025
     chip – she is the one line that can stand alone with every cycle chip
     off, since no past term holds a counterpart to align her against. The
     control is offered whenever her readings exist, including when 2025
     itself is hidden. */
  const hanCtl = M.han && hanAvail && hanCycle;
  const built = drawnCycles.flatMap((c) => {
    const base = cycBase(c, M.key);
    /* An office that changed hands mid-term draws one run per person, in the
       cycle's single colour: the spliced-out leader's run ends uncapped and
       answers to its own name, so the handover month lists both readings
       rather than letting one office row average two people. The pooled
       series still carries terms that never changed leaders. */
    const eras = (M.key === "net" && c.raw.netEras) || (M.key === "oppnet" && c.raw.oppEras) || (M.key === "ppmm" && c.raw.ppmEras) || null;
    const seriesIn = eras
      ? eras.map((e) => ({ name: e.name, months: e.months, vals: e.vals, obs: e.obs }))
      : [{ name: null, months: c.raw.months, vals: c.raw[M.key], obs: (c.raw.obs || {})[M.key] }];
    const isHi = hi === c.year;
    /* Lifted and hovered draw the same: one is the reader asking to keep the
       line, the other is asking to see it, and a line that changed weight when
       the pointer left would read as two different readings of the term. */
    const out = isHi || lifted.has(c.year);
    /* Something is being pointed at, so the rest of the board steps back. Only
       bites once the ribbon has given way – a banded board draws nothing else
       to step back. */
    const dim = !out && !c.current && (hi != null || lifted.size > 0);
    let width, weight, opacity, labOp;
    if (c.current) { width = isHi ? 4 : 3.6; weight = 3; opacity = 1; labOp = 1; }
    else if (out) { width = 3; weight = 2; opacity = 1; labOp = 1; }
    else { width = 1.7; weight = dim ? 0 : 1; opacity = dim ? 0.13 : 0.42; labOp = dim ? 0.2 : 0.75; }
    return seriesIn.flatMap((s, si) => {
      const monthly = toMonthly(s.months, s.vals, c.span);
      // months with no reading are dropped, so the line begins where the polling
      // does instead of running flat out of a value that was never measured
      const pts = monthly.filter((p) => p.y != null)
        .map((p) => ({ x: p.x, y: chg ? +(p.y - base).toFixed(2) : p.y }));
      // an unsegmented ppm line names its single pairing, never a lone office
      const leadName = s.name || (M.key === "ppmm" ? c.raw.ppmPair : (isOpp ? c.oppLead : c.lead));
      const label = solo ? leadName : c.year + " · " + leadName;
      /* Months are the x values, and `months` is 0..n, but look the index up
         rather than assume it: the flags have to describe the same month the
         point does or the dash lands on the wrong segment. Absent obs data
         (an older payload) marks nothing, so the line just stays solid. */
      const flags = s.obs;
      const observed = (m) => {
        if (!flags) return true;
        const i = s.months.indexOf(m);
        return i < 0 ? true : !!flags[i];
      };
      /* The dash says the line is crossing a gap; this says what the number in
         the readout is. Without it the tooltip hands back a flat figure for a
         month nobody polled, which is the whole thing being marked. Only the
         unpolled month itself is annotated - the readings either side of it are
         real, and the dedupe hands each boundary month to its solid run first. */
      if (flags) pts.forEach((p) => { if (!observed(p.x)) p.note = "no poll · Interpolated"; });
      const runs = obsRuns(pts, observed);
      const termEnd = si === seriesIn.length - 1;
      return runs.map((run, i) => ({
        id: "c" + c.year + (si ? "-e" + si : "") + (i ? "-" + i : ""), label, color: colorOf(c), width,
        points: run.points, weight, current: c.current, opacity, dashed: run.dashed,
        // the end label and the end-cap dot belong to the LINE, so only the
        // final era's last run carries them – otherwise a split line grows a
        // dot and a year at every run boundary
        ...(termEnd && i === runs.length - 1
          ? { endLabel: "’" + String(c.year).slice(2), endLabelOpacity: labOp }
          : { endCap: false }),
      }));
    });
  });
  /* ---- the past terms, pooled once -------------------------------------------
     ONE peer set for the whole card: the past terms on the board, month by
     month. The ribbon draws it and the insight sentence summarises it, so the
     two are the same computation – a chip that reshapes the band has to
     reshape the sentence above it, or the card prints two figures both called
     "the average" and neither can be checked against the other.
     Pooled by TERM, never by era. A handover splits a line for DRAWING, but a
     term that changed prime minister is still one term, and pooling its eras
     as separate rows entered it twice in the month the two overlap – which is
     how a board of thirteen terms came to report fourteen of them.
     `polled` counts how many of the month's values are readings rather than
     interpolations: a line dashes itself across a month nobody polled, a
     filled band cannot, so the readout says it in words instead. */
  const bandN = pastShown.length;
  /* Memoised on what actually moves a row – which terms are on the board, the
     measure, and absolute-vs-change. Hovering a chip re-renders all six charts
     to lift ONE line, and the pooled set it lifts out of has not changed;
     keyed on the years for the same reason the dot cloud is, since `pastShown`
     is a fresh array every render and the years are what decide it. */
  const pastKey = pastShown.map((c) => c.year).join(",");
  const bandRows = React.useMemo(() => {
    const rows = [];
    if (!bandN) return rows;
    const pooled = pastShown.map((c) => {
      const base = cycBase(c, M.key);
      const flags = (c.raw.obs || {})[M.key];
      /* The month grid is dense and `months` is 0..n, but look the index up
         rather than assume it – the observed flag has to describe the same
         month the value does, exactly as the drawn lines do it. */
      return toMonthly(c.raw.months, c.raw[M.key], c.span).map((p, m) => {
        if (p.y == null) return null;
        const i = c.raw.months.indexOf(m);
        return { v: chg ? +(p.y - base).toFixed(2) : p.y, obs: !flags || i < 0 || !!flags[i] };
      });
    });
    for (let m = 0; m < CYC_SPINE.length; m++) {
      const vs = [];
      let polled = 0;
      for (let k = 0; k < pooled.length; k++) {
        const p = pooled[k][m];
        if (!p) continue;
        vs.push(p.v);
        if (p.obs) polled++;
      }
      if (!vs.length) continue;
      vs.sort((a, b) => a - b);
      rows.push({
        m, n: vs.length, polled,
        mean: +(vs.reduce((s, v) => s + v, 0) / vs.length).toFixed(2),
        p10: +pctOf(vs, 0.1).toFixed(2), p90: +pctOf(vs, 0.9).toFixed(2),
        q1: +pctOf(vs, 0.25).toFixed(2), q3: +pctOf(vs, 0.75).toFixed(2),
      });
    }
    return rows;
  }, [pastKey, bandN, M.key, chg]);
  /* ---- the ribbon ------------------------------------------------------------
     With three or more past terms on the board the per-term lines collapse
     into this band – a dozen near-identical lines read as weather, not as
     data. Hovering a legend chip LIFTS its term's own line back out of the
     band in full colour; thinning the board below three past terms (or
     isolating one) falls back to plain lines, since a ribbon of two is as
     tall as the lines it replaces.
     The outer fill is the middle 80%, not the full spread. Min–max is drawn
     entirely by whichever single term happened to be most extreme that month,
     so it lurched five points from one month to the next and covered half the
     plot – the loudest mark on the chart carrying the least information, with
     the interquartile half that actually says something hidden inside it.
     Membership is not constant along the axis either: no house was asking the
     approval question in the first months of the older terms, and only the
     longest parliaments reach month 36. Where the headcount drops below
     three-quarters of the board the fills go fainter, so a stretch built from
     half the terms cannot pass for the full set. */
  let bandAreas = null;
  if (banded && bandRows.length > 1) {
    const floor = Math.max(3, Math.ceil(bandN * 0.75));
    /* Neighbouring stretches meet on a SHARED vertex instead of overlapping:
       two fills that overlapped even slightly would double their tint and draw
       a seam exactly where the band is meant to be growing quieter. */
    const segs = [];
    bandRows.forEach((r, i) => {
      const thin = r.n < floor;
      const last = segs[segs.length - 1];
      if (!last || last.thin !== thin) segs.push({ thin, pts: i ? [bandRows[i - 1], r] : [r] });
      else last.pts.push(r);
    });
    /* Weight is CSS's, not ours: `opacity` here is a presentation attribute and
       any `.cyc-band` rule beats it, which is how the fills carry a heavier
       tint in dark without this component knowing the theme. So a thinned
       stretch asks for it by CLASS – setting a fainter number here would have
       been silently overruled – and the inline values stay as the unstyled
       fallback. */
    bandAreas = segs.filter((s) => s.pts.length > 1).flatMap((s, i) => [
      { id: "cyc-band-lo" + i, className: "cyc-band lo" + (s.thin ? " thin" : ""),
        color: "var(--cyc-fill)", opacity: 0.07, edge: false,
        points: s.pts.map((r) => ({ x: r.m, y0: r.p10, y1: r.p90 })) },
      { id: "cyc-band-hi" + i, className: "cyc-band hi" + (s.thin ? " thin" : ""),
        color: "var(--cyc-fill)", opacity: 0.13, edge: false,
        points: s.pts.map((r) => ({ x: r.m, y0: r.q1, y1: r.q3 })) },
    ]);
    /* One mean line over all of it, not one per stretch: two segments sharing
       a boundary month would hand the readout that month twice, under the same
       name. The headcount rides in the note instead, where a thinning set is
       stated rather than implied. */
    built.push({
      id: "cyc-band-mean", label: "Mean of past terms", color: "var(--ink-2)",
      width: 1.9, weight: 0.5, opacity: 0.85, dash: "2 3.4", smooth: false, endCap: false,
      points: bandRows.map((r) => ({
        x: r.m, y: r.mean,
        note: r.n + " of " + bandN + " terms" + (r.polled < r.n ? " \u00b7 " + r.polled + " polled" : ""),
      })),
    });
  }
  /* The polls the lines are averages of, once the board is narrow enough to
     read them. Each cloud takes its line's colour and shape, and follows it
     into "change since election" mode - a cloud left on absolute levels under
     a line drawn as change would agree with it nowhere. Dimming a cycle takes
     its dots down with it, or a faded line ends up with a louder cloud than
     the one being pointed at. */
  const dotsOn = !!shapes && shown.length > 0 && shown.length <= CYC_DOT_MAX;
  /* Memoised on the things that actually move a dot. The 2010 term alone is
     402 points of primary vote on one chart, still well past the ~240 this
     scatter was built for, and a fresh array on every unrelated render - a
     tooltip opening, a sibling chart re-rendering - hands React 402 new
     elements to reconcile each time. The key is the shown years rather than
     the array, since `shown`, `shapes` and `solo` are all rebuilt every
     render and all three are decided by exactly that list. */
  const shownKey = shown.map((c) => c.year).join(",");
  /* Same reason as shownKey: `lifted` is a Set the panel replaces wholesale on
     every toggle, so the memo needs the years, not the identity. */
  const liftKey = [...lifted].sort((a, b) => a - b).join(",");
  const scatter = React.useMemo(() => (!dotsOn ? [] : shown.flatMap((c) => {
    const base = cycBase(c, M.key);
    const leadName = M.key === "ppmm" ? c.raw.ppmPair : (isOpp ? c.oppLead : c.lead);
    const label = solo ? leadName : c.year + " · " + leadName;
    // a term that changed holders names the holder at the dot's own date,
    // matching the per-person runs drawn under it
    const eras = (M.key === "net" && c.raw.netEras) || (M.key === "oppnet" && c.raw.oppEras) || (M.key === "ppmm" && c.raw.ppmEras) || null;
    const nameAt = (iso) => {
      if (!eras || !iso) return null;
      let n = eras[0].name;
      for (const e of eras) if (e.from && iso >= e.from) n = e.name;
      return n;
    };
    const dim = !c.current && hi !== c.year && !lifted.has(c.year) && (hi != null || lifted.size > 0);
    return cycleReadings(c, M, D).map((p) => {
      const n = nameAt(p.iso);
      return {
        x: p.x, y: chg ? +(p.y - base).toFixed(2) : p.y,
        color: colorOf(c), shape: shapes[c.year],
        label: n ? (solo ? n : c.year + " · " + n) : label, meta: p.meta, op: dim ? 0.3 : 1,
      };
    });
  })), [dotsOn, shownKey, M.key, isOpp, chg, hi, liftKey]);
  /* Hanson – one line, not one per cycle. She has been rated for part of the
     current term and in no term before it, so there is no past-cycle
     counterpart to draw and nothing to align her against. Points come straight
     off the sparse series: a month with no reading contributes no vertex, so
     the line spans the gap without the tooltip claiming a value there. Straight
     segments rather than the usual spline – with this few readings a curve
     invents motion between them. */
  if (hanCtl && showHan) {
    const hBase = cycBase(hanCycle, "han");
    const pts = hanCycle.raw.months
      .map((m, i) => ({ x: m, y: hanRaw[i] }))
      .filter((p) => p.y != null)
      .map((p) => ({ x: p.x, y: chg ? +(p.y - hBase).toFixed(2) : p.y }));
    const dimmed = hi != null && !hanCycle.current;
    built.push({
      id: "cyc-han", label: "Hanson · One Nation", color: HAN_COLOR,
      width: 2.2, points: pts, weight: 2.5, smooth: false, dashed: true,
      opacity: dimmed ? 0.2 : 0.9,
      endLabel: "PH", endLabelOpacity: dimmed ? 0.2 : 0.85,
    });
  }

  /* One Nation – a single dotted line tracking the party's first-
     preference vote over the CURRENT term only. Past terms carried one
     dotted line each, but they crowded the chart without adding context,
     so only the current cycle is drawn. Points skip null months as
     Hanson's do, and the line stays thin and light – an overlay on the
     opposition chart, not a rival to its own lines. */
  if (M.onp && showOnp) {
    const c = shown.find((x) => x.current);
    if (c) {
      const oBase = cycBase(c, "onp");
      const pts = c.raw.months
        .map((m, i) => ({ x: m, y: c.raw.onp[i] }))
        .filter((p) => p.y != null)
        .map((p) => ({ x: p.x, y: chg ? +(p.y - oBase).toFixed(2) : p.y }));
      if (pts.length) {
        built.push({
          id: "cyc-onp", label: "One Nation",
          color: HAN_COLOR, width: 2.2, points: pts, weight: 2.5,
          smooth: false, dash: "1 3",
          opacity: 0.85,
          endLabel: "ON ’" + String(c.year).slice(2),
          endLabelOpacity: 0.8,
        });
      }
    }
  }

  // draw muted first, highlighted, current last (on top)
  built.sort((a, b) => a.weight - b.weight);

  const { domain, ticks } = cycDomain(cycles, M, chg);
  const refY = chg ? 0 : M.refAbs;
  // measures with no election-day anchor (ppm margin opens at its first
  // reading) must not have the zero line claim one
  const refLabel = chg ? (M.chgRefLabel || "Election result") : M.refAbsLabel;
  const refLines = refY != null ? [{ y: refY, label: refLabel, color: "var(--ink-faint)", align: "left" }] : [];

  /* insight: the sitting term against the SAME peer set the ribbon draws, read
     straight off the month's pooled row. It used to run its own pass over every
     past cycle whatever the chips said, so hiding a term moved the band and
     left the sentence directly above it quoting an average of terms no longer
     on the board – narrow the board to the 2010s and the ribbon's mean and the
     sentence's "average" stood more than five points apart on one card.
     A month with no row is a month no past term on the board reached, and
     there is nothing to compare against: the sentence stands down rather than
     inventing a peer. */
  /* The strip's own list: the sitting term plus whatever has been lifted, or –
     once the ribbon has given way – simply everything drawn. Sorted with the
     sitting term first and the rest by year, so the row reads the way the
     legend above it does. */
  const stripCycles = solo ? []
    : (banded ? shown.filter((c) => c.current || lifted.has(c.year)) : shown.slice())
        .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || a.year - b.year);

  const cur = cycles.find((c) => c.current);
  let insight = null;
  if (cur && !hidden.has(cur.year)) {
    const mNow = cur.span;
    const curVal = chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key];
    const peerRow = bandRows.find((r) => r.m === mNow);
    if (peerRow) {
      const d = curVal - peerRow.mean;
      const better = d >= 0;
      /* Leader charts compare people, so the subject is the sitting holder
         (Albanese, Taylor) and the peer is the office's past holders. The
         primary/2PP charts measure the party machine itself, so they keep
         the party name – "Labor … the average government", "the Coalition …
         the average opposition". */
      const subjParty = M.key === "net" || M.key === "oppnet" || M.key === "ppmm" ? null : (isOpp ? cur.opp : cur.gov);
      const subjLabel = M.key === "net" ? sitting(cur.pm)
        : M.key === "oppnet" ? sitting(cur.oppLead)
        : M.key === "ppmm" ? sitting(cur.pm)
        : (subjParty === "lnp" ? "the " : "") + D.PARTIES[subjParty].name;
      const peerNoun = M.key === "net" ? "prime minister"
        : M.key === "oppnet" ? "opposition leader"
        : M.key === "ppmm" ? "net preference"
        : isOpp ? "opposition" : "government";
      insight = { d: Math.abs(d), better, mNow, subjLabel, peerNoun };
    }
  }

  return (
    <section className="card cycle-card">
      <div className="card-head cycle-head">
        <div>
          <h2 className="card-title">{M.title}</h2>
          <p className="card-sub">{cardSub}{(M.key === "net" || M.key === "oppnet") && (
            <>{" · "}<button type="button" className="hi-term"
                     title="What the approval question asks"
                     onClick={() => window.AP.openTerm &&
                       window.AP.openTerm("approval", M.title)}>Approve minus disapprove</button></>
          )}</p>
          {hanCtl && (
            <label className={"pg-check cyc-han" + (showHan ? " on" : "")}
                   title={"Pauline Hanson, on the same approve-minus-disapprove basis. " +
                          "Rated in the current term only, from " + hanFrom + " – no past cycle asked about her, " +
                          "and favourability ratings are left out, so the line is short."}>
              <input type="checkbox" checked={!!showHan}
                     onChange={(e) => setHan(e.target.checked)} />
              Hanson ’25
            </label>
          )}
          {M.onp && (
            <label className={"pg-check cyc-onp" + (showOnp ? " on" : "")}
                   title={"One Nation first-preference support, drawn as one dotted line " +
                          "over the current term only. The party's past terms are left off – " +
                          "they crowd the chart without adding context."}>
              <input type="checkbox" checked={!!showOnp}
                     onChange={(e) => setOnp(e.target.checked)} />
              One Nation ’25
            </label>
          )}
        </div>
        {insight && (() => {
          /* Prose, not a table cell: a gap of exactly nine points reads as
             "9%", not "9.0%", and the sign is dropped because the
             "above"/"below" that follows already carries the direction
             (M.fmt keeps its decimal for the chart's tooltips). */
          const shown = M.fmt(insight.d).replace(/^[+−-]/, "").replace(/\.0+$/, "");
          /* A gap that ROUNDS AWAY has to change the sentence, not just the
             number: "sits 0 above the average" states a difference and denies
             it in the same breath. Tested on the rendered string rather than
             on d, because rounding is what the reader sees – 0.4 points prints
             as 0, and "in line with" is what 0.4 points means. */
          const level = parseFloat(shown) === 0;
          if (level) return (
            <p className="cycle-insight">
              {cycMonthLabel(insight.mNow)}, {insight.subjLabel} is{" "}
              <span className="ci-delta level">in line with</span>{" "}
              the average {insight.peerNoun} at this point.
            </p>
          );
          /* Net-approval measures carry no axis unit (CYC_METRICS unit:""),
             so the sentence has to supply its own word – "points" for net
             gaps, "point" singularised for a one-point gap. Share measures
             get "x%" free from M.unit. */
          return (
            <p className="cycle-insight">
              {cycMonthLabel(insight.mNow)}, {insight.subjLabel} sits{" "}
              <span className={"ci-delta " + (insight.better ? "pos" : "neg")}>
                {shown}{M.unit || (parseFloat(shown) === 1 ? " point" : " points")}
              </span>{" "}
              {insight.better ? "above" : "below"} the average {insight.peerNoun} at this point.
            </p>
          );
        })()}
      </div>
      {/* What this chart is drawing, named for this chart. Absent on a solo
          board, where the readouts already carry the leader and there is no
          second term to tell it apart from. The hover preview is deliberately
          NOT listed: a strip that rewrote itself as the pointer crossed the
          legend would be a flicker, not a caption. */}
      {stripCycles.length > 0 && (
        <div className="cyc-drawn">
          <span className="cyc-drawn-label">Drawn here</span>
          {stripCycles.map((c) => (
            <span key={c.year} className={"cyc-drawn-item" + (lifted.has(c.year) ? "" : " fixed")}
                  style={{ "--cyc": colorOf(c) }}>
              <span className="cyc-drawn-rule" aria-hidden="true"></span>
              <span className="cyc-drawn-year">{c.year}</span>
              <span className="cyc-drawn-who">{cycHolders(c, M)}</span>
              {/* The ✕ here means one thing only: put this term back in the
                  band. So it is offered on exactly the terms that were lifted
                  out of it – never on the sitting term, which was never in the
                  band, and never on a term drawn only because the board is too
                  thin for a band at all. Both of those are removed from the
                  legend instead, and a ✕ that did nothing would be worse than
                  no ✕ at all. */}
              {lifted.has(c.year) && !c.current && (
                <button type="button" className="cyc-drawn-x"
                        title={"Return " + c.year + " to the band"}
                        aria-label={"Return " + c.year + " to the band"}
                        onClick={() => unlift(c.year)}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      <TrendChart
        key={"cyc-" + M.key + "-" + mode}
        height={narrow ? 500 : 300} xDomain={CYC_XDOMAIN} yDomain={domain} yTicks={ticks}
        unit={M.unit} axisFont={narrow ? 28 : 20}
        pad={{ l: 56, r: 44, t: 16, b: 40 }}
        xTicks={CYC_XTICKS} refLines={refLines}
        series={built} spine={CYC_SPINE} scatter={scatter} events={cycleEvents}
        areas={bandAreas || undefined}
        tooltipTitle={(i) => cycMonthLabel(CYC_SPINE[i].x)
                             + (solo ? " – " + cycMonthOf(solo.eDate, CYC_SPINE[i].x) : "")}
        fmt={M.fmt}
      />
      {/* one solo term in the frame: how thick its newspaper record is, when the
          Trove harvest reaches it (cycleSource sidecar; absent for uncovered
          terms and before the sidecar resolves, so nothing paints early).
          M-keyed so it appears once — under the primary vote panel — instead
          of repeating identical text under every measure's chart. */}
      {solo && M.key === "primary" && ((D.cycleSource || {})[solo.year] || {}).trove && (() => {
        const t = (D.cycleSource || {})[solo.year].trove;
        return (
          <p className="cycle-insight">
            Newspapers mentioned a poll in {t.articles.toLocaleString()} articles over this term
            ({t.pollArticles.toLocaleString()} poll reports) —{" "}
            <a href={"/archives/trove/#y" + solo.year}>Trove newspaper archive</a>.
          </p>
        );
      })()}
    </section>
  );
}

function CycleLegend({ cycles, hidden, lifted, hi, setHi, chipClick, toggle, showAll, hideAll,
                      showOutcome, outcomeShown, shapes, banded }) {
  const anyHidden = hidden.size > 0;
  /* onMouseLeave clears the highlight for a pointer, and a finger never fires
     it: a term raised by a tap stayed lit on the chart until another chip
     happened to replace it. The next gesture starting outside the legend puts
     it back, the same way the chart readouts and the accuracy dots do. */
  const legRef = useRef(null);
  window.useDismissOutside(legRef, hi != null, () => setHi(null));
  return (
    <div className={"cyc-legend" + (banded ? " banded" : "")} ref={legRef}
         onMouseLeave={() => setHi(null)}>
      <div className="cyc-legend-row">
        {cycles.map((c) => {
          const off = hidden.has(c.year);
          /* Two states, not one, and they answer different questions: whether
             the term is on the board at all (in the band, the mean and the
             download) and whether it is DRAWN as its own line over the band.
             The sitting term is always drawn and so is never "lifted" – it has
             no band to be lifted out of. */
          const lift = lifted.has(c.year) && !off;
          const drawn = lift || c.current;
          /* A term that changed PM names both of them: "2007 Rudd" alone says
             Gillard never governed. netEras lists the officeholders in order,
             so a term that kept one PM keeps its single lead. */
          const pmNames = c.raw.netEras && c.raw.netEras.length > 1
            ? c.raw.netEras.map((e) => e.name).join("–")
            : c.lead;
          const label = c.year + " " + pmNames;
          return (
            /* The chip is a WRAPPER, not a button: it carries two controls and
               a button may not contain a button. The pill's chrome stays on the
               wrapper so the whole thing still presses as one object. */
            <span key={c.year}
                  className={"cyc-chip" + (off ? " off" : "") + (c.current ? " current" : "")
                             + (lift ? " lifted" : "") + (drawn ? " drawn" : "")}
                  /* --cyc paints the chip border and tint; --cyc-text is the
                     same party at the text threshold, for the "now" badge */
                  style={{ "--cyc": c.color, "--cyc-text": inkOf(c.color) }}
                  onMouseEnter={() => setHi(c.year)}>
              <button type="button" className="cyc-main"
                      aria-pressed={drawn}
                      aria-label={off ? label + " – off the board, put it back"
                                : c.current ? label + " – the sitting term, always drawn"
                                : lift ? label + " – drawn as its own line, return it to the band"
                                : label + " – pooled into the band, draw its own line"}
                      onFocus={() => setHi(c.year)}
                      onClick={() => chipClick(c.year)}>
                {/* the swatch takes the same shape as the term's dots, or the
                    cloud under two same-coloured lines is undecodable. Its FILL
                    is the state: filled means there is a line of this colour on
                    the chart, hollow means the term is in the band instead. */}
                <span className={"cyc-swatch" + (shapes && shapes[c.year] && shapes[c.year] !== "circle"
                                                 ? " sw-" + shapes[c.year] : "")}></span>
                <span className="cyc-year">{c.year}</span>
                <span className="cyc-lead">{pmNames}</span>
                {c.current && <span className="cyc-now">Now</span>}
              </button>
              <button type="button" className="cyc-x"
                      title={off ? "Put " + c.year + " back on the board"
                                 : "Take " + c.year + " off the board – out of the band, the mean and the download"}
                      aria-label={off ? "Put " + label + " back on the board"
                                      : "Take " + label + " off the board"}
                      onClick={() => toggle(c.year)}>{off ? "+" : "×"}</button>
            </span>
          );
        })}
      </div>
      {/* A caption, not a chip: the band is derived from the chips, so it has
          no term of its own to toggle and sits one row below in the same
          grid, with the two band tints and the mean's dash for a key. */}
      {banded && (
        <div className="cyc-band-note" aria-hidden="true">
          <svg className="cyc-band-key" viewBox="0 0 30 12">
            {/* the same two classes the chart's fills wear, so the key is not a
                hand-matched approximation that drifts when the band is retuned
                – or sits at light-theme weights on a dark page */}
            <rect className="cyc-band lo" x="4" y="0" width="22" height="12" fill="var(--cyc-fill)" />
            <rect className="cyc-band hi" x="4" y="2.5" width="22" height="7" fill="var(--cyc-fill)" />
            <line x1="4" y1="6" x2="26" y2="6" stroke="var(--ink-2)" strokeWidth="1.9" strokeDasharray="2 3.4" opacity="0.85" />
          </svg>
          <span>Past terms: mean of the set, middle half and middle 80%</span>
        </div>
      )}
      <div className="cyc-actions">
        {/* One control, both directions. "Show all" existed on its own, so
            clearing the board meant unpicking six chips one at a time – and the
            reason to clear it is the same reason the chips exist: to compare two
            terms without the other four behind them. */}
        <button type="button" className="cyc-showall"
                onClick={anyHidden ? showAll : hideAll}>
          {anyHidden ? "Show all cycles" : "Remove all cycles"}
        </button>
        {/* The board cut by what the government did at its own election - the
            comparison the tab exists for, and one nobody can assemble by eye
            from fourteen chips. It offers the set you are NOT looking at, so
            one control carries both cuts; the way back to every term is the
            control beside it, which reads "Show all cycles" the moment either
            is applied. */}
        <button type="button" className="cyc-showall"
                title={"Terms whose government was " +
                       (outcomeShown === "returned" ? "turned out" : "returned") +
                       " at the election that ended it. The sitting term has not " +
                       "faced its election, so it is in neither set."}
                onClick={() => showOutcome(outcomeShown === "returned" ? "ousted" : "returned")}>
          {outcomeShown === "returned"
            ? "Show ousted governments only"
            : "Show returned governments only"}
        </button>
      </div>
    </div>
  );
}

/* ---- Past-cycles download ---------------------------------------------
   The charts here are monthly aggregates of polls taken up to sixteen years
   ago; this is the file of readings underneath them. Keyed by CYCLE year –
   the election that STARTED the term, which is what the legend calls each
   line. That matters: internally the voting-intention rows are stored under
   the election that ENDED the term, so exporting the storage keys would
   misalign the two halves by a full parliament. */

/* One label for a row that can carry two or three leaders on two different
   questions. Collapses to the plain metric name when they agree, which is the
   usual case, and names the exception when they do not. */
function apprMetricLabel(a) {
  const by = a.metricBy || {};
  const parts = [];
  if (a.albNet != null) parts.push(["Albanese", by.alb]);
  if (a.taylorNet != null) parts.push(["opposition leader", by.taylor]);
  if (a.hansonNet != null) parts.push(["Hanson", by.hanson]);
  const name = (m) => (m === "fav" ? "net favourability" : "net approval");
  if (!parts.length) return null;
  const kinds = new Set(parts.map(([, m]) => m));
  if (kinds.size === 1) return name(parts[0][1]);
  return parts.map(([who, m]) => who + ": " + name(m)).join("; ");
}

function cycleSourceRows(cycles, D) {
  const rows = [[
    "cycle", "series", "date", "months_since_election", "pollster",
    "primary_alp", "primary_lnp", "primary_grn", "primary_onp", "primary_oth",
    "tpp_alp", "tpp_lnp", "pm_net", "opp_leader_net", "hanson_net", "leader_metric",
    "pm_preferred", "opp_leader_preferred",
  ]];
  /* Preferred PM is its own series rather than two more columns on the
     leader-rating row: it is a different question, asked of the same wave,
     and one row per question is what lets a reader filter the file by
     `series` and get a clean set. Shares only - the uncommitted remainder is
     the rest of 100 and is not stored either side of the split.
     The opposition leader's key inside a ppm set is that leader's own name
     ("ley" before the February 2026 handover, "taylor" after), so it is found
     by elimination rather than looked up. */
  const ppmOpp = (s) => {
    const k = Object.keys(s).find((x) => x !== "alb" && x !== "hanson" && x !== "unc");
    return k ? s[k] : null;
  };
  const mainPpm = (p) => p.ppm || (p.ppmSets && p.ppmSets[0]) || null;
  const byYear = new Map(cycles.map((c) => [c.year, c]));
  Object.entries(D.cycleSource || {}).forEach(([year, src]) => {
    const c = byYear.get(Number(year));
    if (!c) return;
    src.polls.forEach((p) => rows.push([
      year, "voting_intention", p.date, p.m, p.firm,
      p.alp, p.lnp, p.grn, p.onp, p.oth, p.tpp_alp, p.tpp_lnp, null, null, null, null,
      null, null,
    ]));
    src.approval.forEach((a) => {
      if (a.pmNet != null || a.oppNet != null) rows.push([
        year, "leader_rating", a.date, a.m, a.firm,
        null, null, null, null, null, null, null, a.pmNet, a.oppNet, null,
        a.metric === "fav" ? "net favourability" : "net approval", null, null,
      ]);
      if (a.pmPpm != null || a.oppPpm != null) rows.push([
        year, "preferred_pm", a.date, a.m, a.firm,
        null, null, null, null, null, null, null, null, null, null, null,
        a.pmPpm ?? null, a.oppPpm ?? null,
      ]);
    });
  });
  /* The current cycle's source rows are individualPolls, already in the payload
     – read them from there rather than shipping a second copy. */
  const cur = cycles.find((c) => c.current);
  if (cur) {
    const eDate = Date.parse(cur.eDate);
    const mo = (iso) => Math.round(((Date.parse(iso) - eDate) / 86400000 / 30.436875) * 10) / 10;
    D.individualPolls.forEach((p) => {
      rows.push([cur.year, "voting_intention", p.released, mo(p.released), p.pollster,
        p.p.alp, p.p.lnp, p.p.grn, p.p.onp, p.p.oth, p.alp, p.lnp, null, null, null, null,
        null, null]);
      /* The MAIN contest only. A wave may also publish a two-way where the
         headline is three-way, and those are separate measures that would be
         nonsense stacked in one column - they stay in the payload for the
         charts that keep them apart. */
      const mp = mainPpm(p);
      if (mp) rows.push([cur.year, "preferred_pm", p.released, mo(p.released), p.pollster,
        null, null, null, null, null, null, null, null, null, null, null,
        mp.alb ?? null, ppmOpp(mp)]);
      const a = p.appr;
      if (a && (a.albNet != null || a.taylorNet != null || a.hansonNet != null))
        rows.push([cur.year, "leader_rating", p.released, mo(p.released), p.pollster,
          null, null, null, null, null, null, null, a.albNet, a.taylorNet, a.hansonNet ?? null,
          /* buildAppr reports a metric PER LEADER (metricBy), never a single
             row-level one – a house can ask approval about the PM and
             favourability about Hanson in the same wave. This column read a
             non-existent a.metric and so labelled every row "net approval",
             including the favourability rows the charts deliberately exclude.
             Name the leaders separately where they disagree. */
          apprMetricLabel(a), null, null]);
    });
  }
  return rows.slice(0, 1).concat(
    rows.slice(1).sort((x, y) => (x[0] - y[0]) || String(x[2]).localeCompare(String(y[2]))));
}

/* ---- How the final polls did ------------------------------------------
   Everywhere else the page can only describe how far the polls disagree with
   EACH OTHER. Twelve past elections are the one place a poll can be checked
   against the thing it was estimating, so this is the only honest answer to
   "should I believe the number at the top of this page".

   The measure is one poll per house - its last with a 2PP inside the window -
   equally weighted, because what matters is how many separate attempts missed
   the same way, not how many people each rang. */
function AccuracyPanel() {
  const { D } = window.AP;
  const A = D.accuracy;
  /* The dots used to carry a title="" – the browser's own tooltip, which
     arrives a second late, in a font that appears nowhere else on the page,
     and cannot say "+1.2" in the colour that means Labor. Every other hover
     on this page is the chart readout, so these dots get it too. Declared
     above the early return: a hook that runs only on some renders is a hook
     React cannot keep in order. */
  const [hov, setHov] = useState(null);
  /* Houses that missed by the SAME amount are drawn on top of one another, so
     the row shows one dot where there are four - 2025 has four houses all out
     by exactly 2.2, and every election here has at least one exact tie.
     Magnifying the scale cannot pull those apart: they are not near each
     other, they are identical. A second axis can, so this steps each
     colliding dot into a lane of its own and leaves its place on the scale
     exactly where it was - the shared scale is the point of the panel. */
  const [spread, setSpread] = useState(false);
  /* Whether two dots collide is a question in PIXELS, not in points: the same
     0.1 gap is 8px of track on a desktop and under 2px on a phone. So the
     track is measured rather than assumed, and the lanes re-pack when it
     changes. */
  const rowsRef = useRef(null);
  const [trackW, setTrackW] = useState(0);
  React.useEffect(() => {
    const el = rowsRef.current && rowsRef.current.querySelector(".acc-track");
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  /* These dots are read by tapping them, and a tap has no leave event - so a
     readout opened on a phone stayed on the row until another dot replaced
     it. The next gesture outside the rows puts it away. */
  window.useDismissOutside(rowsRef, !!hov, () => setHov(null));
  if (!A || !A.cycles.length) return null;
  const SPAN = 5;                                   // points either side of the result
  const pct = (err) => 50 + (Math.max(-SPAN, Math.min(SPAN, err)) / SPAN) * 50;
  const LANE_SEP = 20;            // px of track a dot needs to keep a lane to itself
  const LANE_H = 20;              // px between lane centres once they are separated
  /* Greedy packing, left to right: a dot takes the first lane whose last dot
     is far enough away, so a row only grows by as many lanes as it must.
     Lanes alternate above and below the centre line, which keeps the row
     balanced around the average dot rather than drifting downwards. */
  const laneOffset = (i) => (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * LANE_H);
  const lanesFor = (houses) => {
    const lane = {};
    if (!trackW) { houses.forEach((h) => { lane[h.firm] = 0; }); return { lane, n: 1 }; }
    const pts = houses.map((h) => ({ firm: h.firm, x: (pct(h.err) / 100) * trackW }))
                      .sort((a, b) => a.x - b.x);
    const last = [];
    for (const p of pts) {
      let i = 0;
      while (i < last.length && p.x - last[i] < LANE_SEP) i++;
      last[i] = p.x;
      lane[p.firm] = i;
    }
    return { lane, n: Math.max(1, last.length) };
  };
  /* How many dots are hidden behind another at this very moment - the number
     the reader cannot see, and the whole reason the control is offered. */
  const stacked = A.cycles.reduce((n, c) => {
    const seen = {};
    return n + c.houses.filter((h) => {
      const k = h.err.toFixed(2); const had = seen[k]; seen[k] = 1; return had;
    }).length;
  }, 0);
  const col = (err) => (err > 0 ? "var(--alp)" : "var(--lnp)");
  const oneSided = A.cycles.filter((c) => c.sameSide);

  const TIP_W = 184;                                // matches .acc-tip's width
  const sgn = (v) => (v > 0 ? "+" : "") + v.toFixed(1);
  const lean = (err) => (err > 0 ? "Labor overstated" :
                         err < 0 ? "Labor understated" : "Exactly on the result");
  const fmtDay = (iso) => new Date(iso + "T00:00:00")
    .toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  /* Clamp to the dot's OWN track, the way the chart clamps its readout to the
     plot: a house four points out sits against the rail, and an unclamped
     panel would hang over the error column beside it. The flip is for the
     first row only, whose upward readout would otherwise leave the card. */
  const open = (e, raw, tip) => {
    const w = (e.currentTarget.parentElement || {}).clientWidth || 1;
    const half = (Math.min(TIP_W, w) / 2 / w) * 100;
    setHov({ ...tip, left: Math.min(100 - half, Math.max(half, raw)) });
  };
  const close = () => setHov(null);
  const bothWays = oneSided.length > 1
    && oneSided.some((c) => c.err > 0) && oneSided.some((c) => c.err < 0);
  /* Recency order, most recent first, in two blocks: the elections a reader
     remembers voting in get their own labelled run up top, and the longer
     historical record continues below. Splitting on position, never on year,
     so a newly added election slides in without touching this panel. */
  const byRecency = [...A.cycles].sort((a, b) => b.year - a.year);
  const recent = byRecency.slice(0, 5);
  const earlier = byRecency.slice(5);

  return (
    <section className="card acc-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">How the final polls did</h2>
          <p className="card-sub">
            Each house’s last two-party figure in the {A.windowDays} days before polling day,
            against the result · One row per election
          </p>
        </div>
        <div className="dir-net">
          <span className="dir-net-label">Average miss</span>
          <span className="dir-net-val">{A.meanAbs}<span className="pct"> pts</span></span>
        </div>
      </div>

      {stacked > 0 && (
        <div className="acc-tools">
          <button className="acc-spread" aria-pressed={spread}
                  onClick={() => setSpread(!spread)}
                  title="Dots at the same miss are drawn on top of one another. This steps them into their own lanes, keeping each one exactly where it sits on the scale, so all of them can be seen and tapped.">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="7" cy="12" r="2.4" /><circle cx="17" cy="6.5" r="2.4" /><circle cx="17" cy="17.5" r="2.4" />
              <path d="M9.6 10.9 14.6 8M9.6 13.1l5 2.9" />
            </svg>
            Separate overlapping dots
          </button>
        </div>
      )}

      <div className="acc-scale" aria-hidden="true">
        <span className="acc-scale-l" style={{ color: "var(--lnp)" }}>← Labor understated</span>
        <span className="acc-scale-c">Result</span>
        <span className="acc-scale-r" style={{ color: "var(--alp)" }}>Labor overstated →</span>
      </div>

      <div className={"acc-rows" + (spread ? " acc-spread-on" : "")} ref={rowsRef}>
        {[
          ["Last five elections", recent],
          ["More elections", earlier],
        ].filter(([, list]) => list.length).map(([label, list], gi) => (
          <React.Fragment key={label}>
            <div className={"acc-group-h" + (gi ? " acc-group-more" : "")}>{label}</div>
            {list.map((c, rj) => {
          const ri = (gi ? recent.length : 0) + rj;
          const { lane, n: nLanes } = lanesFor(c.houses);
          const maxOff = Math.ceil((nLanes - 1) / 2) * LANE_H;
          return (
          <div className="acc-row" key={c.year}>
            <div className="acc-label">
              <span className="acc-year">{c.year}</span>
              {/* results are carried at the precision the AEC published them
                  (2019 is 48.47); one decimal is the precision every other
                  figure on the page is read at */}
              <span className="acc-detail">{c.mean.toFixed(1)} v {c.result.toFixed(1)}</span>
            </div>
            <div className="acc-track"
                 style={spread && maxOff ? { height: (26 + maxOff * 2) + "px" } : null}>
              <span className="acc-zero"></span>
              {[-SPAN / 2, SPAN / 2].map((t) => (
                <span key={t} className="acc-tick" style={{ left: pct(t) + "%" }}></span>
              ))}
              {c.houses.map((h) => {
                const off = spread ? laneOffset(lane[h.firm] || 0) : 0;
                return (
                <span key={h.firm} className="acc-dot" role="img"
                      style={{ left: pct(h.err) + "%", background: col(h.err),
                               top: off ? `calc(50% + ${off}px)` : null }}
                      aria-label={`${h.firm}, ${fmtDay(h.date)}: Labor ${h.alp2pp.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(h.err)}`}
                      onMouseEnter={(e) => open(e, pct(h.err), {
                        year: c.year, flip: ri === 0, off, title: h.firm, date: fmtDay(h.date),
                        rows: [
                          { label: "Poll", value: h.alp2pp.toFixed(1), color: col(h.err) },
                          { label: "Result", value: c.result.toFixed(1) },
                          { label: "Miss", value: sgn(h.err), strong: col(h.err) },
                        ],
                        sub: lean(h.err),
                      })}
                      onMouseLeave={close}></span>
                );
              })}
              <span className="acc-mean" role="img"
                    style={{ left: pct(c.err) + "%", background: col(c.err) }}
                    aria-label={`Average of the ${c.n} final polls of ${c.year}: ${c.mean.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(c.err)}`}
                    onMouseEnter={(e) => open(e, pct(c.err), {
                      year: c.year, flip: ri === 0,
                      title: `Average of ${c.n} final poll${c.n === 1 ? "" : "s"}`,
                      date: fmtDay(c.eDate),
                      rows: [
                        { label: "Poll average", value: c.mean.toFixed(1), color: col(c.err) },
                        { label: "Result", value: c.result.toFixed(1) },
                        { label: "Miss", value: sgn(c.err), strong: col(c.err) },
                      ],
                      sub: lean(c.err),
                    })}
                    onMouseLeave={close}></span>
              {hov && hov.year === c.year && (
                <div className={"tip acc-tip" + (hov.flip ? " acc-tip-below" : "")}
                     style={{ left: hov.left + "%",
                              top: hov.off ? `calc(50% + ${hov.off}px)` : null }}>
                  <div className="tip-title">{hov.title}</div>
                  <div className="tip-date">{hov.date}</div>
                  {hov.rows.map((r, i) => (
                    <div className="tip-row" key={i}>
                      {/* every row carries a swatch, the unswatched ones an
                          invisible one, so three short labels start on one
                          left edge instead of stepping in and out */}
                      <span className="tip-swatch" style={{ background: r.color || "transparent" }}></span>
                      <span className="tip-label">{r.label}</span>
                      <span className="tip-val" style={r.strong ? { color: r.strong } : null}>{r.value}</span>
                    </div>
                  ))}
                  <div className="tip-sub">{hov.sub}</div>
                </div>
              )}
            </div>
            <div className="acc-err" style={{ color: col(c.err) }}>
              {c.err > 0 ? "+" : ""}{c.err}
            </div>
            <div className="acc-note">
              {c.n} house{c.n === 1 ? "" : "s"}
              {c.sameSide && <span className="acc-flag" title="Every house missed the same way – the signature of an industry-wide problem rather than one firm's noise">All one way</span>}
            </div>
          </div>
          );
            })}
          </React.Fragment>
        ))}
      </div>

      <p className="table-hint">
        Big dots are the average of that election’s final polls; small dots are the individual
        houses – {CANT_HOVER ? "tap" : "hover"} one for its figure.
        {stacked > 0 && (
          <> {stacked} of them missed by exactly the same amount as another house, so they are
          drawn on top of each other – <strong>Separate overlapping dots</strong> steps those into
          their own lanes without moving any of them along the scale.</>
        )} Exit polls are excluded, and a
        house that publishes an undecided-inclusive pair is normalised first, so its arithmetic
        isn’t scored as a miss.
        {bothWays && (
          <> The two elections where every house missed the same way, {oneSided.map((c) => c.year).join(" and ")},
          {" "}missed in <strong>opposite directions</strong> – so this is not a standing lean that
          today’s figures could be corrected for. It is the size of the error, not its direction,
          that carries.</>
        )}
      </p>

      <div className="acc-firms">
        <div className="acc-firms-h">By house, where there is more than one election to judge on</div>
        <div className="acc-firms-grid">
          {A.firms.filter((f) => f.n > 1).map((f) => (
            <div className="acc-firm" key={f.firm}>
              <span className="acc-firm-n">{f.firm}</span>
              <span className="acc-firm-v" title="Average size of the miss, ignoring direction">
                {f.meanAbs}<span className="pct"> pts</span>
              </span>
              <span className="acc-firm-c">{f.n} elections</span>
            </div>
          ))}
        </div>
        <p className="table-hint">
          Average miss ignoring direction. Houses are not merged across renames of
          different operations, so a firm only appears against the elections it
          actually published a final poll for.
        </p>
      </div>
    </section>
  );
}

/* Hover-to-highlight needs a mouse. On a touch-only device the lede must
   not promise it – the chips there toggle, they do not hover. Checked as a
   media query (the primary input), not a touchscreen sniff, so a phone with
   a paired pointer gets the mouse wording it can actually use. */
const CANT_HOVER = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(hover: none)").matches
  : false;

function PastCyclesView() {
  const { D } = window.AP;
  const cycles = D.cycles;
  const [mode, setMode] = useState("abs");
  /* The individual polls behind each term are ~240KB and are read by this tab
     alone, so they are fetched when it opens rather than shipped to everyone.
     The chart draws immediately from the aggregates it already has; the dots
     arrive with the file. */
  const [, redrawWithSource] = useState(0);   // a re-render trigger, not a value
  React.useEffect(() => {
    let live = true;
    D.loadCycleSource().then(() => { if (live) redrawWithSource((n) => n + 1); });
    return () => { live = false; };
  }, []);
  /* Which terms are hidden rides in the URL too, so "the 2019 term" stays
     comparable when the link is passed around. Hidden years – not shown
     ones, since "Show all" is the ordinary state and keeps the bar clean –
     sit in one param joined by dots: two-digit years for 2000s terms
     (?c=10.19 hides 2010 and 2019), four digits for the 1987–1998 terms –
     "90" would read back as 2090 and be dropped. Tokens naming no known
     term are dropped, never trusted. */
  /* One parser for both year params. Two-digit tokens are this century, so
     the pre-2000 terms write themselves out in full. */
  const cycYears = (raw) => {
    const years = new Set(cycles.map((c) => c.year));
    if (!raw) return new Set();
    return new Set(raw.split(/[.,]/).map((t) => {
      if (/^\d{4}$/.test(t)) return +t;
      if (/^\d{2}$/.test(t)) return 2000 + +t;
      return null;
    }).filter((y) => y != null && years.has(y)));
  };
  /* The sitting term has no band to be lifted OUT of - it is always drawn -
     so it can never be "lifted", and two things downstream are written on
     that assumption: the ✕ in each chart's "Drawn here" strip is offered
     only on lifted terms, and `lifted.size > 0` dims every term that is not
     one. Nothing stopped the sitting term's own chip putting it in the set,
     so both misfired: a ✕ that removed nothing (the term is drawn either
     way, so the row stayed exactly where it was), and a whole board dimmed
     for a lift that had not happened. */
  const currentYear = (cycles.find((c) => c.current) || {}).year;
  const [hidden, setHidden] = useState(
    () => cycYears(new URLSearchParams(window.location.search).get("c")));
  /* Terms drawn as their own line over the band. A separate question from
     membership: a lifted term is still IN the band, the mean and the download –
     it is being compared against its own peer set, which is the comparison the
     card is for, and a band that moved when you drew a line over it would shift
     the baseline under the reading. */
  const [lifted, setLifted] = useState(() => {
    const l = cycYears(new URLSearchParams(window.location.search).get("l"));
    /* a shared ?l= carrying the sitting term (every link copied while the bug
       was live does) must not restore the state it could not legally reach */
    l.delete(currentYear);
    return l;
  });
  const [hi, setHi] = useState(null);
  const [showHan, setShowHan] = useState(false);
  const [showOnp, setShowOnp] = useState(false);

  /* Same contract as the archive writer: replaceState, foreign params
     (the archive's q/w/t/…) parsed out and left alone, vanished when the
     board is back to every term. */
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const pack = (set) => [...set].sort((a, b) => a - b)
      .map((y) => (y < 2000 ? String(y) : String(y).slice(2))).join(".");
    p.delete("c"); p.delete("l");
    if (hidden.size) p.set("c", pack(hidden));
    if (lifted.size) p.set("l", pack(lifted));
    const qs = p.toString();
    const L = window.location;
    const next = L.pathname + (qs ? "?" + qs : "") + L.hash;
    if (next !== L.pathname + L.search + L.hash) window.history.replaceState(null, "", next);
  }, [hidden, lifted]);

  /* A chip may now turn off the last line. It used to refuse, on the grounds
     that an empty chart is useless – but the way back is one button away and
     sits right under the chips, and refusing a click that was plainly meant
     reads as the page being broken rather than careful. */
  const toggle = (year) => {
    setHidden((h) => {
      const n = new Set(h);
      n.has(year) ? n.delete(year) : n.add(year);
      return n;
    });
    /* A term taken off the board takes its line with it – there is nothing left
       to have lifted it out of. Coming back, it comes back pooled. */
    setLifted((l) => {
      if (!l.has(year)) return l;
      const n = new Set(l); n.delete(year); return n;
    });
  };
  const lift = (year) => {
    if (year === currentYear) return;   // nothing to lift it out of
    setLifted((l) => {
      const n = new Set(l);
      n.has(year) ? n.delete(year) : n.add(year);
      return n;
    });
  };
  const unlift = (year) => setLifted((l) => {
    if (!l.has(year)) return l;
    const n = new Set(l); n.delete(year); return n;
  });
  /* The chip's own click draws the line, because with the band in place that is
     the common thing to want; taking a term off the board is the rarer, larger
     act and lives on the ✕ beside it. An off term has no line to draw, so its
     chip does the only useful thing instead and puts the term back. */
  const chipClick = (year) => (hidden.has(year) ? toggle(year) : lift(year));
  /* Shapes are a property of what is CURRENTLY on the board, so they are
     worked out once here and handed to the legend and all four charts – a
     chip and the dots it explains must never disagree about which term is
     the triangle. */
  const shownCycles = cycles.filter((c) => !hidden.has(c.year));
  const shapes = shownCycles.length <= CYC_DOT_MAX ? cycShapes(shownCycles) : null;

  const showAll = () => setHidden(new Set());
  const hideAll = () => { setHidden(new Set(cycles.map((c) => c.year))); setLifted(new Set()); };

  /* ---- the board by what the term's government did at its own election ----
     A term's outcome is not stored anywhere, and should not be: the outcome
     of a term IS the start of the one after it, so a flag would be a second
     copy free to disagree with the run of CYCLE_DEFS. A government was
     RETURNED when the next term is governed by the same party and TURNED OUT
     when it is not. The sitting term has no next term and so no outcome - it
     belongs to neither set, and "only" is taken to mean only. */
  const outcomeOf = (i) => {
    const next = cycles[i + 1];
    if (!next) return null;
    return next.gov === cycles[i].gov ? "returned" : "ousted";
  };
  const yearsWith = (which) =>
    new Set(cycles.filter((c, i) => outcomeOf(i) === which).map((c) => c.year));
  const showOutcome = (which) => {
    const keep = yearsWith(which);
    setHidden(new Set(cycles.filter((c) => !keep.has(c.year)).map((c) => c.year)));
    setLifted(new Set());
  };
  /* DERIVED, not stored: which filter the board is showing is a fact about
     `hidden`, so it survives a shared ?c= link and cannot fall out of step
     when a chip is picked off by hand afterwards. */
  const sameYears = (a, b) => a.size === b.size && [...a].every((y) => b.has(y));
  const onBoard = new Set(cycles.filter((c) => !hidden.has(c.year)).map((c) => c.year));
  const outcomeShown = sameYears(onBoard, yearsWith("returned")) ? "returned"
                     : sameYears(onBoard, yearsWith("ousted")) ? "ousted" : null;

  /* The source-polls file respects the chips: it is built from the terms on
     the board, so a hidden term's polls stay out of the download just as
     its line is out of the chart. (The row-fetch inside cycleSourceRows
     already skips any term not in the list it is given.) */
  // the rows may not have landed yet on a fast click, so wait for them rather
  // than handing over a file with nothing in it
  const exportSource = () => D.loadCycleSource().then(() => downloadCsv(
    `auspol-tracker-cycles-source-polls-${D.latest.updatedISO}.csv`, cycleSourceRows(shownCycles, D)));

  return (
    <div className="view view-cycles">
      <div className="view-intro">
        <p className="view-lede">
          Every federal term since 1987, lined up on its election day so each government’s
          run can be read off the same clock. The past terms stand together as a band –
          outer edge the middle 80% of them, darker half the middle 50%, dotted line their
          mean – drawn over the months each term was actually in office, and going fainter
          where fewer of them were.{" "}
          {/* One sentence for pointer and finger alike. It used to fork on
              CANT_HOVER, because the only way out of the band was a hover and a
              finger cannot hover – so a phone reader was told to thin the board
              until the ribbon gave way, which is a workaround described as a
              feature. Drawing a line is a click now, so both inputs get the
              same instruction and it is the true one. */}
          Click a cycle below to draw its own line over the band, and again to put it back;
          the ✕ beside it takes the term off the board altogether. Leave one term on the
          board to see its full detail.
        </p>
        <div className="cyc-controls">
          <TextToggle value={mode} onChange={setMode} ariaLabel="Measure"
            options={[{ id: "abs", label: "Absolute level" }, { id: "chg", label: "Change since election" }]} />
          <div className="cyc-export">
            <span className="cyc-export-label">Download</span>
            <button className="ap-export" onClick={exportSource}
              title={hidden.size
                ? "The individual polls the monthly averages are built from – hidden terms left out, to match the board"
                : "The individual polls the monthly averages are built from"}>
              <DownloadIcon />Source polls
            </button>
          </div>
        </div>
      </div>

      <CycleLegend cycles={cycles} hidden={hidden} lifted={lifted} hi={hi} setHi={setHi}
        chipClick={chipClick} toggle={toggle} showAll={showAll} hideAll={hideAll} shapes={shapes}
        showOutcome={showOutcome} outcomeShown={outcomeShown}
        banded={cycBanded(cycles, hidden)} />

      <div className="cyc-charts">
        {CYC_METRICS.map((m) => (
          <CycleChart key={m.key} metric={m} cycles={cycles} mode={mode} hidden={hidden} hi={hi}
                      lifted={lifted} unlift={unlift}
                      showHan={showHan} setHan={setShowHan}
                      showOnp={showOnp} setOnp={setShowOnp} shapes={shapes}
                      outcomeShown={outcomeShown} />
        ))}
      </div>

      <AccuracyPanel />

      <p className="cyc-foot">
        The individual polls behind the plotted series are downloadable above
        {hidden.size > 0 && ", the file leaving the hidden terms out just as the charts do"}.{" "}
        Past cycles run the full ~3-year term to the next election; the current cycle stops at the
        latest reading. Where the band runs faint, fewer than three-quarters of the terms on the
        board were in office that month – the oldest terms open before any house asked about
        approval, and only the longest parliaments reach three years – and the readout on its
        mean names the headcount, and how many of them were polled rather than interpolated,
        month by month.{" "}
        {showHan && (
          <span>
            Hanson is drawn on the opposition chart from {"“"}approve minus disapprove{"”"} readings only,
            which is why her line is short: most houses rate her on favourability, a different
            question that is never blended into these lines, and no past cycle asked about her
            at all.{" "}
          </span>
        )}
        {showOnp && (
          <span>
            The One Nation line tracks the party’s first-preference vote over
            the current term only; past cycles are left undrawn.{" "}
          </span>
        )}
        {mode === "chg"
          ? "Lines show movement relative to each party’s own election result."
          : "Approval lines splice the sitting prime minister – and opposition leader – where a term changed leaders mid-stream."}
      </p>
    </div>
  );
}

// ====================================================================
// ALL POLLS – full sortable / filterable archive
// ====================================================================
// archive sortable header = the shared SortTh (panels.jsx), via its `k` alias
const ArchSortTh = window.SortTh;

// archive facet helpers ----------------------------------------------
// leadership facet cell – the sortable net stays the headline figure, with
// the same approve / don't-know / disapprove split the snapshot's approval
// bars use rendered at micro scale beneath it. Ragged-tolerant: a leader the
// pollster didn't ask about shows a dash; a net-only reading shows just the net.
// right-track / wrong-track for one poll, mirroring ArchApprCell: the net, then
// a bar carrying the three shares so the split behind it is visible at a glance.
function ArchDirCell({ d }) {
  const { NetVal } = window;
  if (!d) return <span className="dash" title="This poll didn’t ask the direction question">—</span>;
  return (
    <div className="arch-appr"
         title={`Right direction ${d.right} · Unsure ${d.unsure} · Wrong track ${d.wrong}`}>
      <span><NetVal v={d.net} /></span>
      <div className="arch-appr-bar" aria-hidden="true">
        <span className="arch-dir-right" style={{ width: d.right + "%" }}></span>
        <span className="arch-appr-dk" style={{ width: d.unsure + "%" }}></span>
        <span className="arch-dir-wrong" style={{ width: d.wrong + "%" }}></span>
      </div>
    </div>
  );
}

function ArchApprCell({ s, net, metric }) {
  const { NetVal, FavMark } = window;
  if (net == null) return <span className="dash" title="Not asked by this pollster">—</span>;
  const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
  const fav = metric === "fav";
  return (
    <div className="arch-appr"
         title={s ? (fav ? `Positive ${s.app} · Neutral ${dk} · Negative ${s.dis}` : `Approve ${s.app} · Don't know / never heard of ${dk} · Disapprove ${s.dis}`) : undefined}>
      <span><NetVal v={net} /><FavMark metric={metric} /></span>
      {s && (
        <div className="arch-appr-bar" aria-hidden="true">
          <span className="arch-appr-app" style={{ width: s.app + "%" }}></span>
          <span className="arch-appr-dk" style={{ width: dk + "%" }}></span>
          <span className="arch-appr-dis" style={{ width: s.dis + "%" }}></span>
        </div>
      )}
    </div>
  );
}

// "As published" – the poll's headline figures exactly as the pollster released
// them, as plain numerals (dot-coded by party) with any shape-flags inline.
// Numerals, not a 0–100 bar: at archive scale every 53/47 bar looks identical,
// so the ink carries nothing – the figures themselves are the record.
// A poll with NO after-preferences figure published only its primaries – and
// those are the record too, so they print here under a Primary flag rather
// than leaving the cell a bare dash.
function ArchPublished({ p }) {
  const { tppContests, tppFlag, primarySegs } = window;
  const c0 = tppContests(p)[0];
  if (!c0) {
    const pSegs = p.p ? primarySegs(p) : [];
    if (!pSegs.length) return <span className="dash" title="No voting-intention figures published with this poll">—</span>;
    return (
      <div className="apub" aria-label={"Primary votes: " + pSegs.map((s) => `${s.label} ${s.value}`).join(", ")}
           title="No two-party or head-to-head figure in this poll – these are the primary votes">
        {pSegs.map((s, i) => (
          <span key={i} className="apub-seg" title={s.label}>
            <span className="apub-dot" style={{ background: s.color }}></span>
            {s.value.toFixed(1)}
          </span>
        ))}
        <span className="facet-flag">Primary</span>
      </div>
    );
  }
  const flag = tppFlag(p);
  return (
    <div className="apub" aria-label={c0.segs.map((s) => `${s.label} ${s.value}`).join(", ")}>
      {c0.segs.map((s, i) => (
        <span key={i} className="apub-seg" title={s.label}>
          <span className="apub-dot" style={{ background: s.color }}></span>
          {s.value.toFixed(1)}
        </span>
      ))}
      {flag && <span className="facet-flag">{flag}</span>}
    </div>
  );
}

// One lead-info helper drives the cell, the held-by filter and the sort, so
// they can never disagree. Returns null when the poll didn't publish the
// selected measure. m is signed: + = first-named party of the matchup leads.
// segs hold the matchup's shares in a FIXED party order for the split bar –
// deliberately not sorted by leader, so a row-to-row scan never has the
// colours swapping places.
function archLeadInfo(p, measure) {
  if (measure === "onp") {
    if (!p.tppAlt) return null;
    const m = +(p.tppAlt.alp - p.tppAlt.onp).toFixed(1);
    return { m, who: m >= 0 ? "alp" : "onp", lab: m >= 0 ? "ALP" : "ON",
             color: m >= 0 ? "var(--alp)" : "var(--onp)",
             segs: [{ v: p.tppAlt.alp, color: "var(--alp)" }, { v: p.tppAlt.onp, color: "var(--onp)" }],
             note: " on the published ALP v One Nation matchup" };
  }
  if (measure === "lnponp") {
    if (!p.tppAlt2) return null;
    const m = +(p.tppAlt2.lnp - p.tppAlt2.onp).toFixed(1);
    return { m, who: m >= 0 ? "lnp" : "onp", lab: m >= 0 ? "L/NP" : "ON",
             color: m >= 0 ? "var(--lnp)" : "var(--onp)",
             segs: [{ v: p.tppAlt2.lnp, color: "var(--lnp)" }, { v: p.tppAlt2.onp, color: "var(--onp)" }],
             note: " on the published L/NP v One Nation matchup" };
  }
  if (measure === "3cp") {
    if (!p.tpp3) return null;
    const e = [["alp", "ALP", p.tpp3.alp, "var(--alp)"], ["lnp", "L/NP", p.tpp3.lnp, "var(--lnp)"], ["onp", "ON", p.tpp3.onp, "var(--onp)"]]
      .sort((a, b) => b[2] - a[2]);
    const margin = +(e[0][2] - e[1][2]).toFixed(1);
    return { m: e[0][0] === "alp" ? margin : -margin, who: e[0][0], lab: e[0][1], color: e[0][3],
             segs: [{ v: p.tpp3.alp, color: "var(--alp)" }, { v: p.tpp3.lnp, color: "var(--lnp)" }, { v: p.tpp3.onp, color: "var(--onp)" }],
             note: ` over ${e[1][1]} on the published 3-cornered figures` };
  }
  if (p.alp == null && p.alp2pp == null) return null;   // no published 2PP this wave
  // margin from the published pair (undecided-inclusive pairs don't sum 100);
  // latest-table rows name the same fields alp2pp/lnp2pp
  const alp = p.alp2pp != null ? p.alp2pp : p.alp;
  const lnp = p.lnp2pp != null ? p.lnp2pp : p.lnp;
  const lnpV = lnp != null ? lnp : 100 - alp;   // a missing half completes the pair; it doesn't leave a gap
  const m = +(alp - lnpV).toFixed(1);
  return { m, who: m >= 0 ? "alp" : "lnp", lab: m >= 0 ? "ALP" : "L/NP",
           color: m >= 0 ? "var(--alp)" : "var(--lnp)",
           segs: [{ v: alp, color: "var(--alp)" }, { v: lnpV, color: "var(--lnp)" }],
           note: " on the two-party ALP v L/NP measure" +
                 (p.tppKind === "3cp" ? " · Derived from the published 3-cornered figures" : "") };
}

// the table's after-preferences cell, in the shape the direction and approval
// cells set: the signed margin (inked in the leader's party colour) over a
// micro split bar of the matchup shares, so the row reads figure-over-split
// whatever the measure. The wrapper and bar reuse .arch-appr's geometry
// rather than a parallel set of lead rules. A pair published
// undecided-inclusive doesn't sum to 100 – the bar's base shows through as
// the remainder, exactly like an approval cell's don't-know gap.
// A primary-vote margin to stand in for the missing 2PP, where a caller asks
// for it: the Latest table passes primaryFallback so a row with no
// after-preferences figure still shows what the poll DID publish, flagged as
// primary so it can't be read as a two-party lead. The archive never passes
// it – its held-by filter and sort run off archLeadInfo directly, and a
// primary margin must not leak into that ordering. Display-only, same opt-in
// principle as the 3cp derivation this file already notes inline.
// The margin runs against the poll's STRONGEST rival, not always the
// Coalition: One Nation's primary now tops the L/NP vote in some waves, so an
// "ALP +10" vs a third-placed Coalition would hide that Labor actually
// trails One Nation. The note names the rival so the margin can't be misread.
function primaryLeadInfo(p) {
  if (!p.p || p.p.alp == null || p.p.lnp == null) return null;
  const opp = [["lnp", "L/NP", p.p.lnp, "var(--lnp)"], ["onp", "ON", p.p.onp, "var(--onp)"], ["grn", "GRN", p.p.grn, "var(--grn)"]]
    .filter((e) => e[2] != null)
    .sort((a, b) => b[2] - a[2])[0];
  const m = +(p.p.alp - opp[2]).toFixed(1);
  const alpWins = m >= 0;
  return { m, primary: true, who: alpWins ? "alp" : opp[0],
           lab: alpWins ? "ALP" : opp[1],
           color: alpWins ? "var(--alp)" : opp[3],
           segs: [{ v: p.p.alp, color: "var(--alp)" }, { v: opp[2], color: opp[3] }],
           note: ` over ${alpWins ? opp[1] : "ALP"} on primary votes – the poll published no after-preferences figure` };
}
function ArchLead({ p, measure, primaryFallback }) {
  const li = archLeadInfo(p, measure) ||
             (primaryFallback && measure === "lnp" ? primaryLeadInfo(p) : null);
  if (!li) return <span className="dash" title="This pollster didn’t publish the selected matchup this wave">—</span>;
  return (
    <div className="arch-appr"
         title={`${li.lab} leads by ${Math.abs(li.m).toFixed(1)}${li.note}`}>
      <span className="netv" style={{ color: inkOf(li.color) }}>
        {li.m > 0 ? "+" : ""}{li.m.toFixed(1)}
        {li.primary && <>{" "}<span className="facet-flag">primary</span></>}
      </span>
      <div className="arch-appr-bar" aria-hidden="true">
        {li.segs.map((s, i) => <span key={i} style={{ width: s.v + "%", background: s.color }}></span>)}
      </div>
    </div>
  );
}
// full per-poll breakdown for an ARCHIVE poll – mirrors the Latest-polls
// detail, but driven off the archive row shape (alp/lnp 2PP, p primary, ppm,
// appr). The archive row prints no client and no published DATE in any
// column at any width, so the meta line owns both outright – left untagged,
// never width-hidden.
const signed1 = (v) => (v > 0 ? "+" : "") + v.toFixed(1).replace("-", "\u2212");
function ArchPollDetail({ p, onBack, backLabel }) {
  const { PollLedger, pubStamp, releaseMetaRows, EffLines } = window;
  /* The archive stores the unsure share and its change; the Latest table
     derives the residual instead. Same reading, two shapes – so the ledger
     takes the segments already built rather than guessing which it has. */
  const dirSegments = p.dir ? [
    { label: "Right direction", value: p.dir.right, color: "var(--mood-pos)",
      delta: p.dir.chg ? { v: p.dir.chg.right, refDate: p.dir.ref } : null },
    { label: "Unsure", value: p.dir.unsure, resid: true },
    { label: "Wrong track", value: p.dir.wrong, color: "var(--mood-neg)",
      delta: p.dir.chg ? { v: p.dir.chg.wrong, refDate: p.dir.ref } : null },
  ] : null;

  /* The meta items as a list rather than loose children, so the controls
     bracketed to the right of the band sit clear of them. */
  const metaItems = [
    p.client && <span className="pd-meta-i" key="client"><span className="pd-meta-k">Commissioned by</span>
      <span className="pd-meta-v">{p.client}</span></span>,
    <span className="pd-meta-i" key="field"><span className="pd-meta-k">Fieldwork</span>
      <span className="pd-meta-v">{p.field}</span></span>,
    /* The date the poll came OUT, and the hour where the release recorded
       one. This line has always been labelled "Published" and has always
       printed `fullDate`, which is the last day of FIELDWORK - the same
       substitution the Latest-polls column was corrected for, still being
       made one tab across. Where no publication date was recorded the
       fieldwork end still stands in, but now says that it is doing so. */
    <span className="pd-meta-i" key="pub"><span className="pd-meta-k">Published</span>
      <span className="pd-meta-v">
        {pubStamp(p.published, { year: true })
          || <span className="pd-est"
                   title="Publication date not recorded for this poll – showing the last day of fieldwork">
               {p.fullDate}
             </span>}
      </span>
    </span>,
    /* one row: the raw count and what it is worth after weighting are one
       fact about one sample (builder shared with Latest polls) */
    <span className="pd-meta-i" key="sample"><span className="pd-meta-k">Sample</span>
      <span className="pd-meta-v">{window.sampleValue(p)}</span></span>,
    /* signed to one decimal, with a true minus (U+2212) rather than a hyphen -
       these read as figures, not as a range dash or a word break */
    p.lean != null && <span className="pd-meta-i" key="lean"><span className="pd-meta-k">Poll lean</span>
      <span className="pd-meta-v">{signed1(p.lean)} vs aggregate</span></span>,
    p.hfx != null && <span className="pd-meta-i" key="hfx"><span className="pd-meta-k">House effect</span>
      <span className="pd-meta-v">{signed1(p.hfx.v)} vs consensus</span></span>,
    /* the pollster's own pages, in the same grid so their values sit on
       the band's axis (builder shared with Latest polls) */
    ...(releaseMetaRows ? releaseMetaRows(p) : []),
    /* the wave's pull on the standing aggregates closes the band – the last
       rows of the same grid as the provenance above */
    EffLines && p.eff && <EffLines key="aggEff" eff={p.eff} />,
  ].filter(Boolean);

  const controls = [
    /* the way back rides the line that already describes this poll, rather
       than inventing a band of its own above the panel */
    onBack && (
      <button className="back-to-chart" key="back" onClick={(e) => { e.stopPropagation(); onBack(); }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Back to {backLabel || "the chart"}
      </button>
    ),
    /* Corrections are nearly always about ONE poll, and the reader who has a
       row open is looking at the figure they doubt. The form lives on
       /feedback/ now (a standalone page; it used to be the footer's form,
       seeded through window.AP.reportPoll), so this deep link carries the
       seed there as ?msg= instead - the pollster and field dates, the two
       things that identify a row in data/polls.json, arrive already written
       rather than being retyped from memory.

       "YouGov, 18-24 Aug 2026 – ". The year is the point of the difference:
       the seeded line is what identifies a row in data/polls.json, and a
       fieldwork range without one stops doing that the moment the archive
       holds a second August. Taken from the row's own year where it carries
       one, and off the ISO fieldwork-end date otherwise, because the two
       tables this is opened from have different row shapes and only one of
       them names the year. "Fielded" is dropped: everything after the comma
       is a date, so the word was only telling the reader which kind, and the
       form's own label already asks for the pollster and field dates. */
    (() => {
      const yr = p.year != null ? p.year
        : /^\d{4}-/.test(p.released || "") ? Number(p.released.slice(0, 4))
        : null;
      const when = p.field ? p.field + (yr ? " " + yr : "")
        : p.fullDate ? p.fullDate : "";
      return (
        <a className="back-to-chart pd-report" key="report"
           href={`/feedback/?msg=${encodeURIComponent(`${p.pollster}${when ? ", " + when : ""} – `)}`}
           title="Report an error in this poll" aria-label="Report an error in this poll"
           onClick={(e) => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span className="pd-report-lbl">Report an error</span>
        </a>
      );
    })(),
  ].filter(Boolean);

  /* The band's split: what the poll IS occupies the left region and wraps on
     itself; what the reader can DO is docked to the band's top-right corner,
     on the first line beside published and sample, however many lines the
     metadata runs to. The pair stays together under nowrap; where even the
     pair doesn't fit, the container query drops the button's label and
     leaves the icon. */

  return (
    <div className="poll-detail">
      <div className="pd-meta pd-meta-split">
        <span className="pd-meta-items">{metaItems}</span>
        {controls.length > 0 && <span className="pd-meta-tail">{controls}</span>}
      </div>
      <PollLedger r={p} dirSegments={dirSegments} />
    </div>
  );
}

// data-content tags – shown on each archive row and used as filters, so you can
// see (and select for) what a poll actually measures without expanding it.
const POLL_TAGS = [
  { id: "2pp",   label: "2PP",   title: "Two-party preferred – one matchup (ALP v L/NP)" },
  { id: "2x2pp", label: "2×2PP", title: "Two 2PP matchups – e.g. ALP v L/NP and ALP v ON" },
  { id: "3x2pp", label: "3×2PP", title: "Three 2PP matchups – ALP v L/NP, ALP v ON and L/NP v ON" },
  { id: "3pp",   label: "3PP",   title: "Three-way party-preferred – ALP / L/NP / ON in one distribution" },
  { id: "ppm",   label: "PPM",   title: "Preferred prime minister" },
  { id: "aprv",  label: "Aprv",  title: "Leader approval (approve − disapprove)" },
  { id: "fav",   label: "Fav",   title: "Leader favourability (positive − negative)" },
  { id: "seats", label: "Seats", title: "Modelled seat projection with range – MRP polls only" },
  { id: "dir",   label: "Dir",   title: "National direction – right direction / wrong track" },
];
const POLL_TAG_META = Object.fromEntries(POLL_TAGS.map((t) => [t.id, t]));
function pollTagIds(p) {
  const a = p.appr || {};
  const hasNet = a.albNet != null || a.taylorNet != null || a.hansonNet != null;
  const t = [];
  // count of two-party head-to-head matchups published: ALP v L/NP, ALP v ON,
  // L/NP v ON. One → 2pp, two → 2×2pp, three → 3×3pp (tiered, not additive).
  const nMatch = (p.alp != null ? 1 : 0) + (p.tppAlt ? 1 : 0) + (p.tppAlt2 ? 1 : 0);
  if (nMatch >= 3) t.push("3x2pp");
  else if (nMatch === 2) t.push("2x2pp");
  else if (nMatch === 1) t.push("2pp");
  if (p.tpp3) t.push("3pp");          // a genuine three-cornered party-preferred (3CP)
  if (window.ppmContests(p).length) t.push("ppm");
  // metric is per leader, so one poll can carry BOTH tags (e.g. Resolve:
  // approval for the majors, favourability/likeability for Hanson)
  const mb = a.metricBy || {};
  let anyAprv = false, anyFav = false;
  for (const [id, nk] of [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]]) {
    // a leader can carry BOTH measures in one wave, so each is tagged on its own
    const alt = a.alt && a.alt[id];
    if (alt) { if (alt.metric === "fav") anyFav = true; else anyAprv = true; }
    if (a[nk] == null) continue;
    if (mb[id] === "fav") anyFav = true; else anyAprv = true;
  }
  if (anyAprv) t.push("aprv");
  if (anyFav) t.push("fav");
  if (p.seats && p.seats.p) t.push("seats");
  if (p.dir) t.push("dir");
  return t;
}

/* ---- filter bar ----------------------------------------------------------
   The archive is the most multifaceted thing here: 149 polls from 17 houses,
   each publishing a different subset of nine measures. The controls for that
   used to sit on screen ALL AT ONCE – a search box, seventeen pollster chips
   over two rows, four time buttons, nine data-type chips, three matchups and
   three lead-holders: thirty-six controls stacked four rows deep before the
   first poll. Everything was reachable and nothing was findable, and the one
   thing you could never see was which of the thirty-six were actually on.

   So the surface is inverted. One row at rest – search, and a button per
   FACET of the question ("who ran it", "when", "what's in it"). Each opens a
   panel with the options and, beside each option, how many polls it would
   leave given everything else already set. What IS on shows underneath as
   removable pills, which is the only state a reader has to keep in their head.

   A popover is a listbox, not a dialog: click outside or press Escape to
   close, and focus goes back to the button that opened it. */
function FilterPop({ id, label, summary, open, setOpen, children }) {
  const box = useRef(null), panel = useRef(null);
  const isOpen = open === id;
  const [flip, setFlip] = useState(false);
  React.useEffect(() => {
    if (!isOpen) { setFlip(false); return; }
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(null);
      const b = box.current && box.current.querySelector(".ap-popbtn");
      if (b) b.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [isOpen]);
  // a panel that would hang off the right edge hangs off its button's right
  // edge instead – measured, because which button that is depends on the width
  React.useLayoutEffect(() => {
    if (!isOpen || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) setFlip(true);
  }, [isOpen]);
  return (
    <div className="ap-pop" ref={box}>
      <button type="button" className={"ap-popbtn" + (summary ? " on" : "") + (isOpen ? " open" : "")}
              aria-expanded={isOpen} aria-haspopup="true"
              onClick={() => setOpen(isOpen ? null : id)}>
        <span className="ap-popbtn-lab">{label}</span>
        {summary && <span className="ap-popbtn-val">{summary}</span>}
        <svg className="ap-caret" viewBox="0 0 24 24" width="11" height="11" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && <div className={"ap-panel" + (flip ? " flip" : "")} ref={panel} role="group" aria-label={label}>{children}</div>}
    </div>
  );
}
/* One option row, whether it behaves as a checkbox (pollsters, data types) or
   a radio (time). The count is what makes the panel worth opening: it is
   computed against every OTHER active filter, so it answers "how many polls
   would this leave", not "how many exist somewhere". */
function PopRow({ on, radio, label, note, n, onClick }) {
  return (
    <button type="button" className={"ap-check" + (on ? " on" : "") + (radio ? " radio" : "")}
            role={radio ? "radio" : "checkbox"} aria-checked={on} onClick={onClick}>
      <span className="ap-tick" aria-hidden="true"></span>
      <span className="ap-check-lab">{label}{note && <span className="ap-check-note">{note}</span>}</span>
      {n != null && <span className="ap-check-n">{n}</span>}
    </button>
  );
}

// ====================================================================
// VariancePanel – how far apart the polls sit, against the spread that
// sampling error alone would produce.  The page facet seeds the measure
// set, and on the voting facets an in-panel 2PP | Primaries toggle flips
// between them (leadership keeps its own set, untoggled).
//
// Deliberately computed over EVERY poll in the archive, never the
// filtered subset: "how much do pollsters disagree" is a property of the
// industry, and filtering to one house would make it meaningless.  The
// date range still moves the chart window, because that's just framing.
// ====================================================================
/* the in-panel choice between the two voting views – the 2PP matchups, or
   the ALP / L/NP / ON primaries (the same trio the archive table offers) */
const VAR_VOTE_VIEWS = [{ id: "twopp", label: "2PP" }, { id: "primary", label: "Primaries" }];

function VariancePanel({ facet, rangeId }) {
  const { D, discord, discordFacet, discordRead, rangeDomain, buildXTicks, monthLabelFull } = window.AP;
  const narrow = useNarrow();
  const [hidden, setHidden] = useState({});
  // the page facet seeds the view (the parent remounts this panel per facet,
  // so a facet switch re-syncs); the in-panel toggle flips the voting views
  const [view, setView] = useState(facet);

  // a measure with no computable window anywhere (e.g. Hanson's net, polled
  // by too few houses at a time) is dropped rather than shown as a flat gap
  const rows = discordFacet(view)
    .map((m) => ({ m, pts: discord(m.id) }))
    .filter((r) => r.pts.some((d) => d.sigma != null));
  if (!rows.length) return null;

  const xDomain = rangeDomain(rangeId);
  const inWin = (d) => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const shown = rows.filter((r) => !hidden[r.m.id]);
  const vis = shown.length ? shown : rows;      // never blank the chart entirely

  const chartSeries = rows.map((r) => ({
    id: r.m.id, label: r.m.label, color: r.m.color, width: 3,
    opacity: hidden[r.m.id] ? 0 : 1,
    points: r.pts.filter((d) => d.sigma != null && inWin(d))
      .map((d) => ({ x: d.x, y: d.sigma, note: d.R.toFixed(2) + "×" })),
  })).filter((s) => s.points.length > 1);

  // Within a facet every measure's sampling floor is near enough the same
  // curve (similar shares, similar samples), so ONE band carries it – a line
  // dipping into the shaded region is tighter than chance allows.
  const floorPts = D.MONTHS.map((ym, i) => {
    const fs = vis.map((r) => r.pts[i]).filter((d) => d && d.floor != null).map((d) => d.floor);
    return fs.length ? { x: D.mx(ym), y0: 0, y1: fs.reduce((s, v) => s + v, 0) / fs.length } : null;
  }).filter((d) => d && inWin(d));

  const spine = D.MONTHS.map((ym) => ({ x: D.mx(ym), y: 0 })).filter(inWin);
  const spineYm = D.MONTHS.filter((ym) => inWin({ x: D.mx(ym) }));

  const vals = [];
  chartSeries.forEach((s) => { if (s.opacity !== 0) s.points.forEach((p) => vals.push(p.y)); });
  floorPts.forEach((d) => vals.push(d.y1));
  const step = Math.max(...vals) > 6 ? 2 : 1;
  const { domain, ticks } = fitDomain(vals.length ? vals : [0, 1], step, 0);

  // latest computable reading per measure – the pollsters' current standing
  const latest = rows.map((r) => {
    const pts = r.pts.filter((d) => d.sigma != null);
    return { m: r.m, d: pts[pts.length - 1] };
  });
  const unitNote = view === "leadership" ? "net approval points" : "percentage points";

  return (
    <section className="ap-var" id="poll-disagreement">
      <div className="ap-var-head">
        <div>
          <h3 className="ap-var-title">Poll disagreement</h3>
          <p className="card-sub">
            How far apart the polls sit, against the spread sampling error alone would produce.
            The shading is that chance floor – a line inside it means the houses are running tighter
            than random sampling permits. Measured across all {D.individualPolls.length} polls; the filters
            above don’t narrow it.
          </p>
          {(facet === "twopp" || facet === "primary") && (
            <TextToggle value={view === "primary" ? "primary" : "twopp"} onChange={setView}
                        options={VAR_VOTE_VIEWS} ariaLabel="Disagreement measure" />
          )}
        </div>
        <div className="legend">
          {latest.map(({ m, d }) => {
            const read = discordRead(d.R);
            return (
              <button key={m.id} type="button"
                      className={"legend-chip" + (hidden[m.id] ? " off" : "")}
                      aria-pressed={!hidden[m.id]}
                      title={m.label + " – " + d.sigma.toFixed(2) + "pp spread vs a " + d.floor.toFixed(2) + "pp floor · " + read.label.replace(/^./, (ch) => ch.toUpperCase())}
                      onClick={() => setHidden((h) => ({ ...h, [m.id]: !h[m.id] }))}>
                <span className="legend-swatch" style={{ background: m.color }}></span>
                <span className="legend-name">{m.label}</span>
                <span className={"legend-val vr-" + read.id}>{d.R.toFixed(2)}×</span>
              </button>
            );
          })}
        </div>
      </div>

      <TrendChart
        key={"var-" + view + "-" + rangeId}
        height={narrow ? 500 : 300} xDomain={xDomain} yDomain={domain} yTicks={ticks}
        unit="pp" axisFont={narrow ? 28 : 15} pad={{ l: 54, r: 20, t: 18, b: 40 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        areas={[{ id: "floor", color: "var(--ink-faint)", opacity: 0.14, points: floorPts }]}
        series={chartSeries} spine={spine}
        tooltipTitle={(i) => monthLabelFull(spineYm[i])}
        extraRows={(i) => {
          const f = floorPts.filter((d) => d.x === (spine[i] || {}).x)[0];
          return f ? [{ label: "Chance floor", value: f.y1.toFixed(2) + "pp" }] : [];
        }}
        fmt={(v) => v.toFixed(2)}
      />

      <div className="ap-var-read">
        {latest.map(({ m, d }) => {
          const read = discordRead(d.R);
          const readTerm = { chance: "chance-consistent", mild: "mild-divergence" }[read.id];
          return (
            <div key={m.id} className={"vr-tile" + (hidden[m.id] ? " off" : "")}>
              <span className="vr-name" style={{ color: inkOf(m.color) }}>{m.label}</span>
              <span className="vr-sigma">{d.sigma.toFixed(2)}<em>pp</em></span>
              {readTerm ? (
                <button type="button"
                  className={"vr-pill vr-" + read.id + " hi-term"}
                  title={"What " + read.label + " means"}
                  onClick={() => window.AP.openTerm && window.AP.openTerm(readTerm, "Poll disagreement")}>
                  {read.label}
                </button>
              ) : (
                <span className={"vr-pill vr-" + read.id}>{read.label}</span>
              )}
              <span className="vr-sub">
                {d.R.toFixed(2)}× the {d.floor.toFixed(2)}pp floor
                {d.excess > 0.05 && <> · {d.excess.toFixed(2)}pp unexplained</>}
              </span>
            </div>
          );
        })}
      </div>

      <p className="table-hint ap-var-note">
        Spread is the recency-weighted standard deviation of each poll’s distance from a local trend,
        in {unitNote} – recency-weighted only, because weighting by sample size would mute exactly the
        small divergent polls being measured. The floor is what a design effect of {window.AP.DISC.DEFF} and
        each poll’s own sample size predict. Their ratio reads: under 0.80× herded · Around 1× as close as
        sampling allows · Over 1.20× genuinely apart.
        {view === "leadership" && " Leadership residuals are pooled within each leader-era and metric, so the Ley → Taylor handover and the approval/favourability mix aren’t counted as pollsters disagreeing."}
      </p>
    </section>
  );
}

// ====================================================================
// HOUSE LEAN – each pollster's house effect, traced month by month
// ====================================================================
/* Poll disagreement measures spread ACROSS houses; this panel traces the
   lean each house carries against the rest – the same estimator the
   aggregates subtract (±28-day consensus window, 90-day evidence half-life,
   shrinkage while evidence is thin), read as a monthly time series rather
   than as the standing figure the archive table carries. A line settling
   onto zero is a house tracking the pack; one fading to zero is a house
   whose evidence has gone stale.

   Colours: a house is not a party, and on a chart ABOUT lean a red line
   shouts "Labor" before the legend is read. So the palette is a fixed
   categorical ladder of oklch slots, held off every party hue (ALP 27,
   ONP/OTH 58-70, GRN 150, LNP 250), assigned alphabetically so a new build
   can't reshuffle them under the reader. A house not yet catalogued falls
   back to a deterministic name-hash slot. The party colours the lines give
   up are spent on the GROUND instead – the chart's halves carry the ALP/LNP
   hues as a faint wash (lean-band-*, themed in template.html) so which side
   of zero a house walks on never needs reading off the axis. */
const HOUSE_LEAN_COLOURS = {
  "DemosAU":            "oklch(0.63 0.145 90)",
  "Essential":          "oklch(0.63 0.145 110)",
  "Fox & Hedgehog":     "oklch(0.63 0.145 128)",
  "Freshwater":         "oklch(0.63 0.145 165)",
  "Newspoll":           "oklch(0.63 0.145 185)",
  "RedBridge / Accent": "oklch(0.63 0.145 205)",
  "Resolve":            "oklch(0.63 0.145 225)",
  "Roy Morgan":         "oklch(0.63 0.145 268)",
  "Spectre Strategy":   "oklch(0.63 0.145 290)",
  "YouGov":             "oklch(0.63 0.145 312)",
};
function houseLeanColour(firm) {
  if (HOUSE_LEAN_COLOURS[firm]) return HOUSE_LEAN_COLOURS[firm];
  let h = 0;
  for (let i = 0; i < firm.length; i++) h = (h * 31 + firm.charCodeAt(i)) % 997;
  return "oklch(0.63 0.145 " + (99 + (h % 9) * 29) + ")";
}

/* House lean over time, keyed by measure: the 2PP trace gets the classic
   two-party ground (Labor above the line, Coalition below); a primary trace
   tints above-zero with its own party's wash and leaves below-zero neutral.
   Offered measures mirror the Poll-disagreement trio plus the 2PP. */
const LEAN_MEASURES = [
  { id: "tpp", label: "2PP" }, { id: "alp", label: "ALP" },
  { id: "lnp", label: "L/NP" }, { id: "onp", label: "ON" },
];
const LEAN_MEASURE_META = {
  tpp: { phrase: "the 2PP", above: "lean-band-alp", below: "lean-band-lnp",
         ground: "The ground is Labor red / Coalition blue around zero: a house inside the blue band runs ahead of the consensus on the Coalition's 2PP (pushes the 2PP toward them), inside the red band ahead on Labor's." },
  alp: { phrase: "Labor's primary vote", above: "lean-band-alp", below: "lean-band-ink",
         ground: "The ground colours the side of zero a house sits on: inside the red band it runs ahead of the consensus on Labor's primary vote, below zero it trails it." },
  lnp: { phrase: "the Coalition's primary vote", above: "lean-band-lnp", below: "lean-band-ink",
         ground: "The ground colours the side of zero a house sits on: inside the blue band it runs ahead of the consensus on the Coalition's primary vote, below zero it trails it." },
  onp: { phrase: "One Nation's primary vote", above: "lean-band-onp", below: "lean-band-ink",
         ground: "The ground colours the side of zero a house sits on: inside the tinted band it runs ahead of the consensus on One Nation's primary vote, below zero it trails it." },
};

function HouseLeanPanel({ rangeId }) {
  const { D, rangeDomain, buildXTicks, monthLabelFull } = window.AP;
  const narrow = useNarrow();
  const [measure, setMeasure] = useState("tpp");
  const [hidden, setHidden] = useState({});
  const meta = LEAN_MEASURE_META[measure] || LEAN_MEASURE_META.tpp;
  // older dataset builds carry houseLean 2PP-only (flat) or not at all –
  // absence is never zero, so a measure with no emitted map folds the panel
  const leanMap = D.houseLean && D.houseLean[measure];
  if (!leanMap) return null;

  // gen-data emits only houses with >=3 polls of evidence – nobody is drawn
  // wobbling on nearly nothing
  const houses = Object.keys(leanMap).sort();
  if (!houses.length) return null;

  const xDomain = rangeDomain(rangeId);
  const inWin = (d) => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const rows = houses.map((firm) => {
    const all = leanMap[firm].map((d) => ({ x: D.mx(d.ym), y: d.v }));
    return { firm, color: houseLeanColour(firm), all, pts: all.filter(inWin) };
  });

  const chartSeries = rows.map((r) => ({
    id: r.firm, label: r.firm, color: r.color, width: 3,
    opacity: hidden[r.firm] ? 0 : 1,
    points: r.pts,
  })).filter((s) => s.points.length > 1);
  if (!chartSeries.length) return null;

  const spine = D.MONTHS.map((ym) => ({ x: D.mx(ym), y: 0 })).filter(inWin);
  const spineYm = D.MONTHS.filter((ym) => inWin({ x: D.mx(ym) }));

  const step = 1;
  const vals = [step, -step];
  rows.forEach((r) => { if (!hidden[r.firm]) r.pts.forEach((p) => vals.push(p.y)); });
  const { domain, ticks } = fitDomain(vals, Math.max(...vals.map(Math.abs)) > 4 ? 2 : step, 0);

  // the standing each chip wears comes from the FULL series, not the window
  const latest = rows.map((r) => ({ firm: r.firm, color: r.color, v: r.all[r.all.length - 1].y }));

  return (
    <section className="ap-lean" id="house-lean">
      <div className="ap-var-head">
        <div>
          <h3 className="ap-var-title">House lean</h3>
          <p className="card-sub">
            How far each pollster sits from the consensus of the houses polling around it
            {"on " + meta.phrase}, estimated month by month – the same
            <button type="button" className="hi-term"
              onClick={() => window.AP.openTerm && window.AP.openTerm("house-effect", "House lean")}>house effect</button>{" "}
            the aggregates subtract, shown as it has walked. The chart above spreads the houses
            against chance; this one tracks where each one stands.
          </p>
          <TextToggle value={measure} onChange={setMeasure} options={LEAN_MEASURES}
                      ariaLabel="House-lean measure" />
        </div>
        <div className="legend">
          {latest.map((e) => {
            const s = (e.v > 0 ? "+" : e.v < 0 ? "−" : "") + Math.abs(e.v).toFixed(1) + "pp";
            const he = D.houseEffects && (measure === "tpp"
              ? (D.houseEffects.tpp && D.houseEffects.tpp[e.firm])
              : (D.houseEffects.primary && D.houseEffects.primary[measure] && D.houseEffects.primary[measure][e.firm]));
            return (
              <button key={e.firm} type="button"
                      className={"legend-chip" + (hidden[e.firm] ? " off" : "")}
                      aria-pressed={!hidden[e.firm]}
                      title={e.firm + " – currently " + s.replace("−", "-") + " against the consensus on " + meta.phrase
                             + (he && he.n ? " · pooled from " + he.n + " polls" : "")}
                      onClick={() => setHidden((h) => ({ ...h, [e.firm]: !h[e.firm] }))}>
                <span className="legend-swatch" style={{ background: e.color }}></span>
                <span className="legend-name">{e.firm}</span>
                <span className="legend-val">{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <TrendChart
        key={"lean-" + measure + "-" + rangeId}
        height={narrow ? 500 : 300} xDomain={xDomain} yDomain={domain} yTicks={ticks}
        unit="pp" axisFont={narrow ? 28 : 15} pad={{ l: 54, r: 20, t: 18, b: 40 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        bands={[
          { y0: 0, y1: domain[1], className: meta.above },
          { y0: domain[0], y1: 0, className: meta.below },
        ]}
        refLines={[{ y: 0, color: "var(--ink-3)" }]}
        series={chartSeries} spine={spine}
        tooltipTitle={(i) => monthLabelFull(spineYm[i])}
        ariaLabel={"Pollster house lean over time on " + meta.phrase + " – how far each pollster sits from the cross-house consensus"}
        fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(1)}
      />

      <p className="table-hint ap-var-note">
        {meta.ground + " "}Each
        point reads the lean as of that month, with the 90-day half-life on the evidence, so a
        house’s current method outranks its history; the All-polls table’s House-effect column
        instead pools each pollster’s whole history into one standing figure, which is why its
        numbers won’t match the right-hand edge here.
      </p>
    </section>
  );
}

function AllPollsView({ focus, onBack, backLabel }) {
  const { D } = window.AP;
  const { ShareBar, NetVal, tppContests, tppFlag, ppmContests, ppmContestSegs, ppmFlag } = window;
  /* "YouGov (MRP)" is YouGov: a parenthetical method tag names a product,
     never another pollster, and both the filter panel and the pollster
     count speak in houses. The table rows themselves keep the full name, so
     an MRP or SMS release is still labelled as one. */
  const baseHouse = (h) => h.replace(/ \((MRP|SMS)\)$/, "");
  const houses = [];
  D.individualPolls.forEach((p) => { const b = baseHouse(p.pollster); if (!houses.includes(b)) houses.push(b); });
  houses.sort();

  /* What each view needs a poll to have published. Primary vote is on every
     poll in the archive, so it has nothing to scope and gets no pill. It sits
     ABOVE the state declarations because the URL restore consults it. */
  const FACET_SCOPE = {
    twopp: { has: (p) => p.alp != null || p.tppAlt || p.tppAlt2 || p.tpp3, label: "With a 2PP" },
    primary: null,
    leadership: { has: (p) => window.ppmContests(p).length > 0 || (p.appr && (p.appr.albNet != null || p.appr.taylorNet != null || p.appr.hansonNet != null)), label: "With leadership numbers" },
    direction: { has: (p) => !!p.dir, label: "With a direction reading" },
  };
  const FACETS = [
    { id: "twopp", label: "2PP" },
    { id: "primary", label: "Primary" },
    { id: "leadership", label: "Leadership" },
    { id: "direction", label: "Direction" },
  ];
  /* The filtered table is a page in its own right, so its filters ride in
     the URL: every non-default selection sits in the query string beside
     the #allpolls hash (?w=Newspoll&t=12#allpolls), and "Newspoll's year"
     becomes a link one reader can paste to another – who lands on exactly
     that table, not on the raw archive. Keys are one letter and enum VALUES
     one letter or two (the maps below), so a fully-dressed link stays short
     enough to survive a chat window; names that ARE the vocabulary – the
     pollsters, the tag slugs – stay words. Restored here, once per mount
     (the view remounts on every tab switch); the write-back further down
     keeps the address bar current as the filters change. Values that have
     gone stale – a pollster no longer in the archive, a tag that never
     existed – are dropped, never trusted.

     Backwards compatibility: links written before the short scheme used
     verbose keys (who=/when=/has=/vs=/lead=/view=/scope=) and long enum
     values. Both spellings are still read here, the short one winning if
     a hand-edited URL carries both; only the short one is ever written. */
  const FACET_BY_URL = { p: "primary", l: "leadership", d: "direction", primary: "primary", leadership: "leadership", direction: "direction" };
  const MEAS_BY_URL = { o: "onp", lo: "lnponp", onp: "onp", lnponp: "lnponp" };
  const LEAD_BY_URL = { a: "alp", l: "lnp", o: "onp", alp: "alp", lnp: "lnp", onp: "onp" };
  const urlInit = (() => {
    const p = new URLSearchParams(window.location.search);
    /* new short key first, then each legacy key the value once had */
    const get = (...keys) => { for (const k of keys) { const v = p.get(k); if (v != null) return v; } return null; };
    const view = FACET_BY_URL[get("f", "view")] || "twopp";
    return {
      q: get("q") || "",
      who: (get("w", "who") || "").split(",").map(baseHouse).filter((h) => houses.includes(h)),
      has: (get("h", "has") || "").split(",").filter((t) => POLL_TAGS.some((pt) => pt.id === t)),
      lead: LEAD_BY_URL[get("l", "lead")] || "all",
      measure: MEAS_BY_URL[get("v", "vs")] || "lnp",
      range: ["12", "6", "3"].includes(get("t", "when")) ? get("t", "when") : "all",
      facet: view,
      scope: (get("s") !== "0" && get("s", "scope") !== "off") || !FACET_SCOPE[view],
    };
  })();

  const [q, setQ] = useState(urlInit.q);
  const [sel, setSel] = useState(new Set(urlInit.who)); // pollster filter; empty = all
  const [lead, setLead] = useState(urlInit.lead);        // all | alp | lnp/onp (per matchup)
  const [measure, setMeasure] = useState(urlInit.measure); // lead matchup: lnp = ALP v L/NP · onp = ALP v ON
  const [range, setRange] = useState(urlInit.range);    // all | 12 | 6 | 3
  const [tagSel, setTagSel] = useState(new Set(urlInit.has)); // data-content tags; empty = all
  const [sort, setSort] = useState({ key: "date", dir: -1 });
  const [facet, setFacet] = useState(urlInit.facet);
  const [open, setOpen] = useState(null);     // expanded ROW
  const [pop, setPop] = useState(null);       // open filter popover
  /* Each view hides the columns it can't fill; it should hide the ROWS it
     can't fill too. Two thirds of the archive publishes no direction reading,
     and the old table answered "Direction" with 95 rows of dashes and left the
     reader to discover the Contains filter. So the view arms that filter
     itself – as a visible, removable pill, not a hidden default. */
  const [scope, setScope] = useState(urlInit.scope);

  /* Arriving from a dot on a chart. The filters ride in the URL now, so they
     survive the remount this trip causes - and any of them could hide the
     poll being asked for, not just the scope, so ALL of them go. The facet
     comes from the chart that was clicked, so a leadership dot lands on the
     leadership columns rather than on 2PP. */
  React.useEffect(() => {
    if (!focus) return;
    setScope(false); setQ(""); setSel(new Set()); setLead("all"); setMeasure("lnp");
    setRange("all"); setTagSel(new Set());
    if (focus.facet) setFacet(focus.facet);
    setOpen(focus.key);
  }, [focus]);
  // …and once the row is actually on the page, put it under the reader's eye.
  // Centred, because a row scrolled to the top would sit under the pinned bar.
  const bodyRef = useRef(null);
  React.useEffect(() => {
    if (!focus || open !== focus.key || !bodyRef.current) return;
    const row = bodyRef.current.querySelector("tr.arch-row.open");
    if (row) row.scrollIntoView({ block: "center", behavior: "auto" });
  }, [focus, open, facet]);
  const toggleTag = (id) => setTagSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const onMeasure = (mv) => { setMeasure(mv); setLead("all"); };
  const onFacet = (f) => {
    setFacet(f); setSort({ key: "date", dir: -1 }); setPop(null); setScope(true);
    // the expanded row STAYS expanded: `open` keys the poll itself, and the
    // detail panel shows every measure whatever the facet. If the new facet's
    // scope hides that poll it simply isn't rendered, and it resurfaces –
    // still open – where the poll is listed again.
    // the matchup/ahead pair describes the 2PP lead column – it is hidden
    // outside that facet, so its filter must not keep biting invisibly
    if (f !== "twopp") { setLead("all"); setMeasure("lnp"); }
  };

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  /* house lean mounts on the voting facets (2PP and Primary) – from a
     leadership/direction view the jump switches facets first, and the
     scroll has to wait on the remount */
  const leanJump = useRef(false);
  React.useEffect(() => {
    if (!leanJump.current || (facet !== "twopp" && facet !== "primary")) return;
    leanJump.current = false;
    jumpTo("house-lean");
  }, [facet]);
  const jumpToLean = () => {
    if (facet === "twopp" || facet === "primary") jumpTo("house-lean");
    else { leanJump.current = true; onFacet("twopp"); }
  };

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const toggleHouse = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });

  const aggByYm = {};
  D.agg2pp.forEach((d) => { aggByYm[d.ym] = d.alp; });

  const rows = D.individualPolls.map((p) => {
    const [y, mo] = p.ym.split("-").map(Number);
    const fullDate = `${p.day} ${D.monthName(mo)} ${String(y).slice(2)}`;
    const tags = pollTagIds(p);
    // house lean uses the NORMALISED share (alpN) so undecided-inclusive
    // pairs compare fairly with the aggregate; null when no 2PP published
    const lean = p.alpN != null && aggByYm[p.ym] != null ? +(p.alpN - aggByYm[p.ym]).toFixed(1) : null;
    // house effect is the emitted all-history snapshot per pollster (the
    // estimator's applied lean is read per display time; see gen-data), so the
    // same label value rides on every row that pollster owns; null when unmeasured
    const hfx = (((D.houseEffects || {}).tpp || {})[p.pollster]) || null;
    // searchable haystack – everything a row knows, so the search box matches
    // fieldwork dates, samples, 2PP / primary / matchup figures, nets, flags
    const f1 = (v) => (v != null ? v.toFixed(1) : null);
    const hayParts = [
      p.pollster, p.field, fullDate, p.sample != null ? String(p.sample) : null,
      // the month the row is filed under, spelt for the search box: "Feb 26"
      // shows the year as two digits, so "feb 2026" / "february 2026" would
      // otherwise miss every poll they name
      D.monthName(mo) + " " + y, D.monthNameFull(mo) + " " + y,
      f1(p.alp), f1(p.lnp),
      lean != null ? (lean > 0 ? "+" : "") + lean.toFixed(1) : null,
      f1(p.p.alp), f1(p.p.lnp), f1(p.p.grn), f1(p.p.onp), f1(p.p.oth),
    ].filter(Boolean);
    if (p.tpp3) hayParts.push(p.tpp3.alp.toFixed(1), p.tpp3.lnp.toFixed(1), p.tpp3.onp.toFixed(1), "3-cornered 3cp");
    if (p.tppAlt) hayParts.push(p.tppAlt.alp.toFixed(1), p.tppAlt.onp.toFixed(1), "alp v on one nation matchup");
    if (p.tppAlt2) hayParts.push(p.tppAlt2.lnp.toFixed(1), p.tppAlt2.onp.toFixed(1), "lnp v on one nation matchup");
    if (p.appr.albNet != null) hayParts.push("albanese " + p.appr.albNet);
    if (p.appr.taylorNet != null) hayParts.push("taylor " + p.appr.taylorNet);
    if (p.appr.hansonNet != null) hayParts.push("hanson " + p.appr.hansonNet);
    if (p.seats && p.seats.p) {
      hayParts.push("seat projection mrp");
      for (const k in p.seats.p) hayParts.push(k + " " + p.seats.p[k].est + " seats");
    }
    if (p.dir) {
      hayParts.push("direction right track wrong track",
        f1(p.dir.right), f1(p.dir.wrong), f1(p.dir.unsure),
        (p.dir.net > 0 ? "+" : "") + p.dir.net);
    }
    hayParts.push(...tags);   // so "fav", "ppm" etc. match in the search box too
    const hay = hayParts.join(" ").toLowerCase();
    return {
      ...p, year: y, mo, fullDate, lean, hfx, tags,
      hay: hay + " " + hay.replace(/–/g, "-"),   // hyphen typed in search matches the en dash
    };
  });

  // only offer tag filters for data types actually present in the archive, so
  // e.g. "3PP" appears as a chip only once a three-cornered poll exists
  const availableTags = new Set();
  rows.forEach((r) => r.tags.forEach((tg) => availableTags.add(tg)));
  const shownTags = POLL_TAGS.filter((t) => availableTags.has(t.id));

  const latestX = D.mx(D.MONTHS[D.MONTHS.length - 1]);
  const x0 = range === "all" ? -Infinity : latestX - Number(range) / 12 - 0.06;
  const ql = q.trim().toLowerCase();

  /* One predicate per filter, kept as a list rather than inlined, so the
     panels can ask the question the numbers beside each option answer: how
     many polls would this leave, given everything else already set. That means
     counting with exactly one predicate lifted out – `without(f)`. */
  const scoping = scope && FACET_SCOPE[facet];
  const TESTS = [
    ["who", (p) => !sel.size || sel.has(baseHouse(p.pollster))],
    // a row must contain EVERY selected data type (AND)
    ["has", (p) => !tagSel.size || [...tagSel].every((tg) => p.tags.includes(tg))],
    ["lead", (p) => { if (lead === "all") return true; const li = archLeadInfo(p, measure); return !!li && li.who === lead; }],
    ["when", (p) => range === "all" || p.x >= x0],
    ["q", (p) => !ql || ql.split(/\s+/).every((t) => p.hay.includes(t))],
    ["scope", (p) => !scoping || scoping.has(p)],
  ];
  const passing = (p, skip) => TESTS.every(([k, f]) => k === skip || f(p));
  const filtered = rows.filter((p) => passing(p, null));
  const without = (skip) => rows.filter((p) => passing(p, skip));

  // option counts, each against every other filter
  const houseRows = without("who");
  const houseN = {};
  houseRows.forEach((p) => { const b = baseHouse(p.pollster); houseN[b] = (houseN[b] || 0) + 1; });
  const tagRows = without("has");
  const tagN = {};
  tagRows.forEach((p) => p.tags.forEach((t) => { tagN[t] = (tagN[t] || 0) + 1; }));
  const whenRows = without("when");
  const rangeN = (r) => (r === "all" ? whenRows.length
    : whenRows.filter((p) => p.x >= latestX - Number(r) / 12 - 0.06).length);
  /* Ranked by how much a house polls, not alphabetically: Roy Morgan has 42
     waves here and Agenda C Synesis one, and an A–Z list buries the names a
     reader is looking for among the ones they have never heard of. Ranked by
     the count IN VIEW, which doesn't reshuffle under the reader's hand –
     selecting a pollster can't change a number computed with the pollster
     filter lifted out, so the order only moves when another panel does. */
  const houseRank = [...houses].sort((a, b) => (houseN[b] || 0) - (houseN[a] || 0) || a.localeCompare(b));

  const getVal = (p, key) => {
    switch (key) {
      case "date": return p.x;
      case "pollster": return p.pollster;
      case "sample": return p.sample ?? -Infinity;
      case "alp": {
        const li = archLeadInfo(p, measure);
        return li ? li.m : -Infinity;
      }
      case "lean": return p.lean ?? -Infinity;
      case "hfx": return p.hfx ? p.hfx.v : -Infinity;
      case "p.alp": return p.p.alp;
      case "p.lnp": return p.p.lnp;
      case "p.grn": return p.p.grn;
      case "p.onp": return p.p.onp;
      case "appr.albNet": return p.appr.albNet != null ? p.appr.albNet : -Infinity;
      case "appr.taylorNet": return p.appr.taylorNet != null ? p.appr.taylorNet : -Infinity;
      case "appr.hansonNet": return p.appr.hansonNet != null ? p.appr.hansonNet : -Infinity;
      case "ppm.alb": { const c = ppmContests(p)[0]; return c && c.alb != null ? c.alb : -Infinity; }
      case "dir.right": return p.dir ? p.dir.right : -Infinity;
      case "dir.wrong": return p.dir ? p.dir.wrong : -Infinity;
      case "dir.net": return p.dir ? p.dir.net : -Infinity;
      default: return 0;
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const va = getVal(a, sort.key), vb = getVal(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    // stable tiebreak: newest first
    return b.x - a.x;
  });

  const total = rows.length;
  const clearAll = () => {
    setQ(""); setSel(new Set()); setLead("all"); setMeasure("lnp"); setRange("all");
    setTagSel(new Set()); setScope(false); setPop(null);
  };
  // Boolean(): the chain ends on a Set size, so with no filters this was the
  // NUMBER 0 – and {0 && <button/>} renders a literal 0 next to the poll count.
  const anyFilter = Boolean(ql || sel.size || lead !== "all" || range !== "all" || tagSel.size);

  /* What is currently on, as removable pills. The scope pill is marked `auto`
     – dashed, quieter – because the view set it, not the reader. In the 2PP
     view it lives elsewhere: beside the lead control in the ap-2line wrapper
     below, so a phone sees the pair share one line. */
  const RANGE_LAB = { "12": "Last 12 months", "6": "Last 6 months", "3": "Last 3 months" };
  const MEASURE_LAB = { lnp: "ALP v L/NP", onp: "ALP v ON", lnponp: "L/NP v ON" };
  const HOLDER_LAB = { alp: "ALP", lnp: "L/NP", onp: "ON" };
  const pills = [];
  if (ql) pills.push({ k: "q", lab: "“" + q.trim() + "”", off: () => setQ("") });
  [...sel].forEach((h) => pills.push({ k: "h" + h, lab: h, off: () => toggleHouse(h) }));
  if (range !== "all") pills.push({ k: "r", lab: RANGE_LAB[range], off: () => setRange("all") });
  [...tagSel].forEach((t) => pills.push({ k: "t" + t, lab: (POLL_TAG_META[t] || {}).label || t, off: () => toggleTag(t) }));
  if (lead !== "all") pills.push({ k: "l", lab: HOLDER_LAB[lead] + " ahead", off: () => setLead("all") });
  if (scoping && facet !== "twopp") pills.push({ k: "s", lab: scoping.label, auto: true, off: () => setScope(false) });

  /* …and back the other way: every non-default filter is written to the
     query string, so the address bar at any moment IS the link to this
     exact table – in the short scheme the restore above reads. replaceState,
     never pushState: the back button should leave the page, not uncheck one
     box at a time. Only departures from the defaults are written, so the
     plain archive keeps its plain URL. Params the view OWNS (its own keys
     and every legacy spelling, so old links normalise on first write) are
     deleted and re-set; params owned by other views (the cycles view's "c")
     are parsed out of the live URL and left untouched, so the two writers
     can never clobber each other. The guard against a no-op write matters:
     without it the URL was normalised every render, and this effect also
     runs for the reader who typed a stale or partial query by hand. */
  const FACET_BY_ID = { primary: "p", leadership: "l", direction: "d" };  // facet → URL letter (inverse of the restore map)
  const MEAS_BY_ID = { onp: "o", lnponp: "lo" };                          // matchup → URL letter; "lnp" is the omitted default
  const LEAD_BY_ID = { alp: "a", lnp: "l", onp: "o" };                    // holder → URL letter; "all" is the omitted default
  React.useEffect(() => {
    const OWNED = ["q", "w", "t", "h", "v", "l", "f", "s", "who", "when", "has", "vs", "lead", "view", "scope"];
    const p = new URLSearchParams(window.location.search);
    OWNED.forEach((k) => p.delete(k));
    if (ql) p.set("q", q.trim());
    if (sel.size) p.set("w", houses.filter((h) => sel.has(h)).join(","));
    if (range !== "all") p.set("t", range);
    if (tagSel.size) p.set("h", POLL_TAGS.map((t) => t.id).filter((t) => tagSel.has(t)).join(","));
    if (measure !== "lnp") p.set("v", MEAS_BY_ID[measure]);
    if (lead !== "all") p.set("l", LEAD_BY_ID[lead]);
    if (facet !== "twopp") p.set("f", FACET_BY_ID[facet]);
    if (!scope && FACET_SCOPE[facet]) p.set("s", "0");
    const qs = p.toString();
    const L = window.location;
    const next = L.pathname + (qs ? "?" + qs : "") + L.hash;
    if (next !== L.pathname + L.search + L.hash) window.history.replaceState(null, "", next);
  });

  // ---- CSV export of the CURRENTLY filtered + sorted rows -----------------
  // A flat, analysis-friendly schema (one row per poll), independent of the
  // active facet – so the download always carries every measure, for exactly
  // the rows the filters left on screen, in the order they're shown.
  const CSV_COLS = [
    ["Pollster", (p) => p.pollster],
    ["Fieldwork", (p) => p.field],
    ["Fieldwork end", (p) => p.released],
    ["Sample", (p) => p.sample],
    // the figure each row is weighted on, and the house-filed original it
    // equals where the pollster published one (absent-not-zero elsewhere)
    ["Effective sample", (p) => (p.sampleEff == null ? "" : p.sampleEff)],
    ["Primary ALP", (p) => p.p.alp], ["Primary L/NP", (p) => p.p.lnp],
    ["Primary GRN", (p) => p.p.grn], ["Primary ON", (p) => p.p.onp], ["Primary OTH", (p) => p.p.oth],
    ["2PP ALP", (p) => p.alp], ["2PP L/NP", (p) => p.lnp],
    ["ALP v ON", (p) => (p.tppAlt ? p.tppAlt.alp : "")],
    ["L/NP v ON", (p) => (p.tppAlt2 ? p.tppAlt2.lnp : "")],
    ["Poll lean", (p) => p.lean],
    ["House effect", (p) => (p.hfx ? p.hfx.v : "")],
    ["PPM Albanese", (p) => { const c = ppmContests(p)[0]; return c ? c.alb ?? "" : ""; }],
    ["PPM Opp. ldr", (p) => { const c = ppmContests(p)[0]; return c ? (c.taylor ?? c.ley ?? "") : ""; }],
    ["PPM Hanson", (p) => { const c = ppmContests(p)[0]; return c ? (c.hanson ?? "") : ""; }],
    ["Albanese metric", (p) => (p.appr.metricBy ? p.appr.metricBy.alb : "")],
    ["Opp. ldr metric", (p) => (p.appr.metricBy ? p.appr.metricBy.taylor : "")],
    ["Hanson metric", (p) => (p.appr.metricBy ? p.appr.metricBy.hanson : "")],
    ["Albanese net", (p) => p.appr.albNet],
    ["Opp. ldr net", (p) => p.appr.taylorNet],
    ["Hanson net", (p) => p.appr.hansonNet],
    // seat projections are MRP-only, so these columns are empty for most rows
    ["Seats ALP", (p) => (p.seats && p.seats.p.alp ? p.seats.p.alp.est : "")],
    ["Seats L/NP", (p) => (p.seats && p.seats.p.lnp ? p.seats.p.lnp.est : "")],
    ["Seats GRN", (p) => (p.seats && p.seats.p.grn ? p.seats.p.grn.est : "")],
    ["Seats ON", (p) => (p.seats && p.seats.p.onp ? p.seats.p.onp.est : "")],
    ["Seats OTH", (p) => (p.seats && p.seats.p.oth ? p.seats.p.oth.est : "")],
    ["Right direction", (p) => (p.dir ? p.dir.right : "")],
    ["Wrong track", (p) => (p.dir ? p.dir.wrong : "")],
    ["Direction unsure", (p) => (p.dir ? p.dir.unsure : "")],
    ["Direction net", (p) => (p.dir ? p.dir.net : "")],
    ["Contains", (p) => p.tags.join(" ")],
  ];
  const exportCsv = () => downloadCsv(
    `auspol-tracker-polls-${D.latest.updatedISO}.csv`,
    [CSV_COLS.map((c) => c[0]), ...sorted.map((p) => CSV_COLS.map((c) => c[1](p)))]);

  return (
    <div className="view view-allpolls">
      <div className="ap-head">
        <div>
          <h2 className="card-title">All polls</h2>
          <p className="card-sub">
            Every individual national poll in the archive · {total} polls from {houses.length} pollsters,
            {" "}{(() => {  // span computed from the data, so it stays honest as polls are added
              const f = D.individualPolls[0], l = D.individualPolls[D.individualPolls.length - 1];
              const lab = (ym) => { const [y, m] = ym.split("-").map(Number); return D.monthNameFull(m) + " " + y; };
              /* the start is the first fieldwork's OPENING month (fym), not
                 the close-month the ym bucket is named for: the term's first
                 wave ran 5 May–1 Jun, and this span read "June 2025" until
                 the opening month was admitted */
              return lab(f.fym || f.ym) + "–" + lab(l.ym);   // range: tight en dash, never spaced
            })()}
          </p>
        </div>
        {/* phone only (CSS hides it wider): the filter bar's own copy of
            this count is the one desktop sees */}
        <div className="ap-head-side">
          <TextToggle value={facet} onChange={onFacet} options={FACETS}
            ariaLabel="Archive table view" caps />
          <span className="ap-count">
            <strong>{sorted.length}</strong>{sorted.length !== total ? " of " + total : ""} {sorted.length === 1 ? "poll" : "polls"}
          </span>
        </div>
      </div>

      {/* phone (≤560px) turns this block into a two-column grid: the pills sit
          side by side on the top line and the facet pair lands beneath them;
          wider screens keep the originals in .ap-head-side and hide these copies */}
      <div className="ap-jumps">
        <button className="ap-jump" onClick={() => jumpTo("poll-disagreement")}
                title="Scroll down to the poll disagreement panel">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v13M12 17l-5-5M12 17l5-5"></path>
          </svg>
          Jump to poll disagreement
        </button>
        <button className="ap-jump" onClick={jumpToLean}
                title="Scroll down to the house lean chart">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v13M12 17l-5-5M12 17l5-5"></path>
          </svg>
          Jump to house lean
        </button>
        <TextToggle value={facet} onChange={onFacet} options={FACETS}
          ariaLabel="Archive table view" caps className="ap-facet" />
        <span className="ap-jumps-count">
          <strong>{sorted.length}</strong>{sorted.length !== total ? " of " + total : ""} {sorted.length === 1 ? "poll" : "polls"}
        </span>
      </div>

      <div className="ap-bar">
        <div className="ap-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>
          </svg>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                 autoCorrect="off" spellCheck={false}
                 placeholder="Search anything…" aria-label="Search polls" />
          {q && <button className="ap-search-x" onClick={() => setQ("")} aria-label="Clear search">×</button>}
        </div>

        <FilterPop id="who" label="Pollster" open={pop} setOpen={setPop}
          summary={sel.size === 0 ? null : sel.size === 1 ? [...sel][0] : sel.size + " selected"}>
          <div className="ap-pop-head">
            <span>{houses.length} pollsters</span>
            {sel.size > 0 && <button className="ap-clear" onClick={() => setSel(new Set())}>Clear</button>}
          </div>
          <div className="ap-poplist" role="group" aria-label="Pollsters">
            {houseRank.map((h) => (
              <PopRow key={h} on={sel.has(h)} label={h} n={houseN[h] || 0} onClick={() => toggleHouse(h)} />
            ))}
          </div>
        </FilterPop>

        <FilterPop id="when" label="Time" open={pop} setOpen={setPop}
          summary={range === "all" ? null : RANGE_LAB[range]}>
          {/* a set of role="radio" rows is only a choice to a screen reader if a
              radiogroup says so – otherwise each one reads as a stray control */}
          <div className="ap-poplist" role="radiogroup" aria-label="Time span">
            {[["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => (
              <PopRow key={id} radio on={range === id} label={lab} n={rangeN(id)} onClick={() => setRange(id)} />
            ))}
          </div>
        </FilterPop>

        <FilterPop id="has" label="Contains" open={pop} setOpen={setPop}
          summary={tagSel.size === 0 ? null : tagSel.size === 1 ? (POLL_TAG_META[[...tagSel][0]] || {}).label : tagSel.size + " measures"}>
          <div className="ap-pop-head">
            <span>What the poll published</span>
            {tagSel.size > 0 && <button className="ap-clear" onClick={() => setTagSel(new Set())}>Clear</button>}
          </div>
          <div className="ap-poplist" role="group" aria-label="Measures published">
            {shownTags.map((t) => (
              <PopRow key={t.id} on={tagSel.has(t.id)} label={t.label} note={t.title}
                      n={tagN[t.id] || 0} onClick={() => toggleTag(t.id)} />
            ))}
          </div>
          <p className="ap-pop-foot">Selecting two asks for polls carrying both.</p>
        </FilterPop>

        {/* The lead column is a 2PP idea, so its controls live and die with
            that view – and they are one button, because choosing the matchup
            and filtering by who holds it are the same thought. The button and
            the view's "With a 2PP" scope pill share the ap-2line wrapper,
            which unfolds into the bar's flex row at every width: the lead
            toggle lands right after Contains, even on a phone. */}
        {facet === "twopp" && (
          <div className="ap-2line">
            <FilterPop id="lead" label="Lead" open={pop} setOpen={setPop}
              summary={[measure !== "lnp" ? MEASURE_LAB[measure] : null, lead !== "all" ? HOLDER_LAB[lead] + " ahead" : null].filter(Boolean).join(" · ") || null}>
            <div className="ap-pop-head"><span>Show the lead in</span></div>
            <div className="ap-poplist" role="radiogroup" aria-label="Lead column matchup">
              {["lnp", "onp", "lnponp"].map((m) => (
                <PopRow key={m} radio on={measure === m} label={MEASURE_LAB[m]}
                        n={rows.filter((r) => archLeadInfo(r, m)).length} onClick={() => onMeasure(m)} />
              ))}
            </div>
            <div className="ap-pop-head bordered"><span>Held by</span></div>
            <div className="ap-poplist" role="radiogroup" aria-label="Lead held by">
              {[{ id: "all", label: "Either" }].concat(
                ({ lnp: ["alp", "lnp"], onp: ["alp", "onp"], lnponp: ["lnp", "onp"] })[measure]
                  .map((id) => ({ id, label: HOLDER_LAB[id] }))).map((o) => (
                <PopRow key={o.id} radio on={lead === o.id} label={o.label}
                        n={o.id === "all" ? without("lead").length
                           : without("lead").filter((r) => { const li = archLeadInfo(r, measure); return li && li.who === o.id; }).length}
                        onClick={() => setLead(o.id)} />
              ))}
            </div>
          </FilterPop>
            {scoping && (
              <span className="ap-pill auto">
                {scoping.label}
                <button type="button" onClick={() => setScope(false)} aria-label={"Remove filter: " + scoping.label}>×</button>
              </span>
            )}
          </div>
        )}

        <div className="ap-bar-end">
          <span className="ap-count">
            <strong>{sorted.length}</strong>{sorted.length !== total ? " of " + total : ""} {sorted.length === 1 ? "poll" : "polls"}
          </span>
          {/* big screens only – a spreadsheet export is a desktop task, and the
              button would crowd the narrow filter stack on phones */}
          <button className="ap-export" onClick={exportCsv}
                  title="Download these rows as CSV – exactly the current filters and order"
                  aria-label={"Export " + sorted.length + " polls as CSV"}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {pills.length > 0 && (
        <div className="ap-active">
          {pills.map((f) => (
            <span key={f.k} className={"ap-pill" + (f.auto ? " auto" : "")}>
              {f.lab}
              <button type="button" onClick={f.off} aria-label={"Remove filter: " + f.lab}>×</button>
            </span>
          ))}
          {pills.length > 1 && <button className="ap-clear" onClick={clearAll}>Clear all</button>}
        </div>
      )}

      <div className="table-wrap ap-wrap">
        <table className="poll-table archive">
          {/* 149 rows whose only name was a heading three elements away. Said
              once, out of sight, so a screen reader meets the table already
              knowing what it is and how much of it the filters left. */}
          <caption className="sr-only">
            All polls, {(FACETS.find((f) => f.id === facet) || {}).label} columns –
            {" "}{sorted.length} of {total} polls
          </caption>
          <thead>
            <tr>
              <th scope="col" className="exp-col" aria-hidden="true"></th>
              <ArchSortTh label="Pollster" k="pollster" sort={sort} onSort={onSort} className="ta-l" />
              <ArchSortTh label="Fieldwork" short="Field" k="date" sort={sort} onSort={onSort} className="ta-l" />
              <ArchSortTh label="Sample" k="sample" sort={sort} onSort={onSort} className="hide-md" />
              {/* the house's own published effective n - only where the
                  pollster filed one with the APC (Resolve, Roy Morgan et al.
                  file none and dash). Sparse column, so not sortable. */}
              <th scope="col" className="hide-md"
                  title="Effective sample, where the pollster filed one with the Australian Polling Council">Eff. n</th>

              {facet === "twopp" && (<>
                <th scope="col" className="ta-l apub-col hide-md"
                    title="What the pollster published – a conventional 2PP, a 3-cornered preferred, or extra matchups">As published</th>
                <ArchSortTh label={({ lnp: "Lead · ALP v L/NP", onp: "Lead · ALP v ON", lnponp: "Lead · L/NP v ON", "3cp": "Lead · 3-cornered" })[measure]} short="Lead" k="alp" sort={sort} onSort={onSort} />
                {/* hide-sm: the last column to go on a phone – see the .hide-sm
                    note in the stylesheet. The row detail carries "Poll lean". */}
                <ArchSortTh label="Poll lean" short="Lean" k="lean" sort={sort} onSort={onSort} className="hide-sm" />
                <ArchSortTh label="House effect" short="H/fx" k="hfx" sort={sort} onSort={onSort} className="hide-sm" />
              </>)}
              {facet === "primary" && (<>
                <ArchSortTh label="ALP" k="p.alp" sort={sort} onSort={onSort} />
                <ArchSortTh label="L/NP" k="p.lnp" sort={sort} onSort={onSort} />
                <ArchSortTh label="GRN" k="p.grn" sort={sort} onSort={onSort} />
                <ArchSortTh label="ON" k="p.onp" sort={sort} onSort={onSort} />
                <th scope="col" className="hide-md">OTH</th>
              </>)}
              {facet === "leadership" && (<>
                <ArchSortTh label="Preferred PM" k="ppm.alb" sort={sort} onSort={onSort} className="ta-l two-pp-col hide-md" />
                <ArchSortTh label="Alb net" short="Alb" k="appr.albNet" sort={sort} onSort={onSort} />
                {/* the archive spans the Ley → Taylor handover, so the column
                    belongs to the OFFICE, not a name */}
                <ArchSortTh label="Opp. ldr net" short="Opp" k="appr.taylorNet" sort={sort} onSort={onSort} />
                <ArchSortTh label="Hanson net" short="Han" k="appr.hansonNet" sort={sort} onSort={onSort} />
              </>)}
              {facet === "direction" && (<>
                <ArchSortTh label="Right direction" short="Right" k="dir.right" sort={sort} onSort={onSort} />
                <ArchSortTh label="Wrong track" short="Wrong" k="dir.wrong" sort={sort} onSort={onSort} />
                <th scope="col" className="hide-md">Unsure</th>
                <ArchSortTh label="Net" k="dir.net" sort={sort} onSort={onSort} />
              </>)}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {sorted.map((p, i) => {
              const alpLead = p.alp >= 50;
              /* Identity, not position: this used to carry the row's index,
                 so re-sorting the table silently closed whatever was open -
                 and nothing outside could ask for a particular poll. House
                 plus fieldwork end is the same key AP.pollRowKey hands out. */
              const rowId = p.pollster + "|" + p.released;
              const arrived = !!focus && focus.key === rowId;
              const isOpen = open === rowId;
              const colCount = facet === "primary" ? 10 : facet === "leadership" ? 9 : facet === "direction" ? 9 : 9;
              return (
                <React.Fragment key={rowId}>
                <tr className={"poll-row arch-row" + (isOpen ? " open" : "") + (arrived ? " arrived" : "")}
                    onClick={() => setOpen(isOpen ? null : rowId)}>
                  <td className="exp-col">
                    <button className={"exp-btn" + (isOpen ? " open" : "")}
                            aria-label={isOpen ? "Collapse" : "Expand full breakdown"}
                            aria-expanded={isOpen}>▸</button>
                  </td>
                  <td className="ta-l pollster-cell">
                    <PollsterName name={p.pollster} url={p.url} />
                    {/* the publisher, as the Latest-polls table shows it -
                        above MethodLink, matching that table's cell order */}
                    <span className="pollster-mode">{p.client}</span>
                    <MethodLink url={p.methodUrl} />
                    {p.tags.length > 0 && (
                      <span className="poll-tags" aria-label={"Contains " + p.tags.map((id) => POLL_TAG_META[id].label).join(", ")}>
                        {p.tags.map((id) => (
                          <span key={id} className={"ptag t-" + id + (tagSel.has(id) ? " hit" : "")}
                                title={POLL_TAG_META[id].title}>{POLL_TAG_META[id].label}</span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="ta-l muted">{p.field}</td>
                  <td className="num muted hide-md">{p.sample != null ? p.sample.toLocaleString() : "—"}</td>
                  {/* only ever a house-filed figure - a dash means the pollster
                      published no effective sample, not that there is no n */}
                  <td className="num hide-md">
                    {p.sampleEff == null
                      ? <span className="muted">—</span>
                      : <span title="Effective sample as published by the pollster (APC methodology statement)">
                          {p.sampleEff.toLocaleString()}
                        </span>}
                  </td>

                  {facet === "twopp" && (<>
                  <td className="ta-l apub-col hide-md"><ArchPublished p={p} /></td>
                  <td className="num"><ArchLead p={p} measure={measure} /></td>
                  <td className="num hide-sm">
                    {p.lean == null
                      ? <span className="dash" title="No published 2PP to compare with the aggregate">—</span>
                      : <span className={"arch-lean " + (p.lean > 0.05 ? "alp" : p.lean < -0.05 ? "lnp" : "flat")}
                              title="Difference from the aggregate that month">
                          {p.lean > 0 ? "+" : ""}{p.lean.toFixed(1)}
                        </span>}
                  </td>
                  <td className="num hide-sm">
                    {p.hfx == null
                      ? <span className="dash" title="Not enough published polls to measure a house effect">—</span>
                      : <span className={"arch-lean " + (p.hfx.v > 0.05 ? "alp" : p.hfx.v < -0.05 ? "lnp" : "flat")}
                              title={`House effect: this pollster's 2PP sits ${p.hfx.v > 0 ? "+" : ""}${p.hfx.v.toFixed(1)} pts ${p.hfx.v >= 0 ? "to Labor" : "to the Coalition"} against the cross-pollster consensus (n=${p.hfx.n})`}>
                          {p.hfx.v > 0 ? "+" : ""}{p.hfx.v.toFixed(1)}
                        </span>}
                  </td>
                  </>)}
                  {facet === "primary" && (<>
                  <td className="num" style={{ color: "var(--alp-text)", fontWeight: 600 }}>{p.p.alp != null ? p.p.alp.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--lnp-text)", fontWeight: 600 }}>{p.p.lnp != null ? p.p.lnp.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--grn-text)" }}>{p.p.grn != null ? p.p.grn.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--onp-text)" }}>{p.p.onp != null ? p.p.onp.toFixed(1) : "—"}</td>
                  <td className="num muted hide-md">{p.p.oth != null ? p.p.oth.toFixed(1) : "—"}</td>
                  </>)}
                  {facet === "leadership" && (<>
                  <td className="two-pp-col share-col hide-md">
                    {ppmContests(p).length === 0
                      ? <span className="dash" title="No preferred-PM question this wave">—</span>
                      : <ShareBar segs={ppmContestSegs(ppmContests(p)[0])} compact flag={ppmFlag(ppmContests(p))} />}
                  </td>
                  <td className="num"><ArchApprCell s={p.appr.alb} net={p.appr.albNet} metric={p.appr.metricBy && p.appr.metricBy.alb} /></td>
                  <td className="num"><ArchApprCell s={p.appr.taylor} net={p.appr.taylorNet} metric={p.appr.metricBy && p.appr.metricBy.taylor} /></td>
                  <td className="num"><ArchApprCell s={p.appr.hanson} net={p.appr.hansonNet} metric={p.appr.metricBy && p.appr.metricBy.hanson} /></td>
                  </>)}
                  {facet === "direction" && (<>
                  <td className="num" style={{ color: "var(--mood-pos)", fontWeight: 600 }}>
                    {p.dir ? <>{p.dir.right.toFixed(1)}<ChgTag v={p.dir.chg && p.dir.chg.right} refDate={p.dir.ref} /></> : <span className="dash">—</span>}
                  </td>
                  <td className="num" style={{ color: "var(--mood-neg)", fontWeight: 600 }}>
                    {p.dir ? <>{p.dir.wrong.toFixed(1)}<ChgTag v={p.dir.chg && p.dir.chg.wrong} refDate={p.dir.ref} /></> : <span className="dash">—</span>}
                  </td>
                  <td className="num muted hide-md">{p.dir ? p.dir.unsure.toFixed(1) : "—"}</td>
                  <td className="num"><ArchDirCell d={p.dir} /></td>
                  </>)}
                </tr>
                {isOpen && (
                  <tr className="detail-row">
                    <td colSpan={colCount}>
                      <ArchPollDetail p={p} onBack={arrived ? onBack : null} backLabel={backLabel} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {sorted.length === 0 && (
              <tr className="arch-empty">
                <td colSpan={facet === "primary" ? 10 : facet === "leadership" ? 9 : 9}>
                  No polls match these filters. <button className="ap-clear" onClick={clearAll}>Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="table-hint">
        Tap any poll for its full breakdown · Dates are fieldwork windows (publication dates sit in the
        breakdown) · “As published” lists each poll’s headline figures exactly as the pollster released them ·
        The lead bar shows the selected matchup where a pollster published it · “Poll lean” is the poll minus
        the aggregate for that month · “—” Means the pollster didn’t publish that measure · Search matches
        anything in a row · Click any column heading to sort.{" "}
        <strong>House effect</strong> is how far a pollster systematically sits from the cross-house consensus
        on 2PP – pooled from its polls with a 90-day half-life, so its recent methods count for more, and
        shrunk toward zero while it has published few. The aggregates subtract it, read as of each figure’s
        own time, and it is a property of the pollster, not of this one poll.
        {" "}<strong>Eff. n</strong> is the pollster’s own published effective sample, filed with the
        Australian Polling Council – Newspoll, YouGov, Essential, DemosAU and RedBridge / Accent
        file them; Resolve and Roy Morgan file none, so a dash there means unpublished, not unknown.
      </p>

      <VariancePanel key={facet} facet={facet} rangeId={range} />

      {/* house lean rides the voting facets: the panel's own toggle moves it
          between the 2PP and the ALP / L/NP / ON primary measures, so it
          mounts wherever those measures run the tab */}
      {(facet === "twopp" || facet === "primary") && <HouseLeanPanel rangeId={range} />}
    </div>
  );
}


// ====================================================================
// INFO – the glossary
// ====================================================================
/* Every term the rest of the site uses, defined once, alphabetically. It
   replaces the method footer that used to sit under all three tabs: three
   sections of flowing prose that a reader had to scroll past the whole page
   to reach and then read end-to-end to find one definition.

   The figures inside are LIVE. A definition that quotes a number has to quote
   the current one or it becomes a second, drifting copy of the page - the same
   rule the share card is held to.

   Every entry carries a stable id, because other panels link INTO them: the
   hero's "Weighted aggregate" is a link to the entry defining it, and the
   entry arrived at grows a way back (see window.AP.openTerm). Ids are fixed
   strings rather than slugs derived from the term, so rewording a heading
   cannot quietly break a link pointing at it. */

/* The preference-flows history chart inside the glossary entry: AEC full
   preference-distribution tables by party, 1996-2025.

   This was the one chart on the page drawn by hand - a 640x226 SVG carrying
   its own axis, its own type sizes and no readout - and sitting outside
   TrendChart cost it both of the things every other chart was given in
   654b926. Its aspect was frozen in the viewBox, so a phone rendered 9.5px
   axis type at 4.8px inside a plot 115px tall; and pointing at it did
   nothing, on a page where every other line answers the pointer. It renders
   through TrendChart now, on the same useNarrow contract as the other eight
   (see the auspol-chart-sizing note).

   One Nation is split into RUNS rather than nulled through: TrendChart draws
   a series as one path, so a gap would be crossed by a straight line implying
   flows through parliaments it barely contested and nobody measured. Only the
   final run carries the end cap and the label - endCap:false on the rest, or
   every run boundary grows a dot in the middle of the line.

   The party colours are the site's identity tokens and stay as they are, but
   they sit close together under protanopia - the Greens' green against One
   Nation's orange especially - so identity is never left to colour alone:
   each line is named at its own end where there is room for it, and the
   legend under the plot names all three at any width. */
function FlowChart() {
  const narrow = useNarrow();
  const YEARS = [1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
  const PARTIES = [
    { id: "grn", name: "Greens",     color: "var(--grn)",
      v: [67.1, 73.3, 74.8, 80.8, 79.7, 78.8, 83.0, 81.9, 82.2, 85.7, 88.2] },
    { id: "onp", name: "One Nation", color: "var(--onp)",
      v: [null, 46.3, 44.1, 43.3, null, null, null, 49.5, 34.8, 35.7, 25.5] },
    { id: "oth", name: "Others",     color: "var(--oth)",
      v: [50.3, 55.3, 55.8, 44.4, 44.6, 41.7, 46.7, 49.2, 46.1, 50.0, 54.6] },
  ];

  const series = [];
  PARTIES.forEach((p) => {
    const runs = [];
    let cur = [];
    p.v.forEach((val, i) => {
      if (val == null) { if (cur.length) runs.push(cur); cur = []; }
      else cur.push({ x: YEARS[i], y: val });
    });
    if (cur.length) runs.push(cur);
    runs.forEach((points, i) => {
      const tail = i === runs.length - 1;
      series.push({
        id: p.id + i, label: p.name, color: p.color, points,
        /* eleven elections, not a monthly reading: straight segments between
           them, because a smoothed curve would invent a shape for the years
           between counts where there is no such thing as a flow. */
        smooth: false, width: 2.6, endCap: tail,
        /* the label gutter is worth 10% of a laptop's width and all of a
           phone's, so narrow drops the labels and leans on the legend */
        endLabel: tail && !narrow ? p.name : null,
      });
    });
  });

  return (
    <>
      {/* the unit rides above the plot as text rather than as an SVG label:
          inside the viewBox it scaled with the chart and vanished on a phone */}
      <span className="fc-unit">share preferencing Labor, %</span>
      <TrendChart
        height={narrow ? 470 : 330}
        xDomain={[1996, 2025]} yDomain={[20, 92]}
        yTicks={[30, 50, 70, 90]}
        xTicks={(narrow ? [1996, 2004, 2013, 2019, 2025]
                        : [1996, 2001, 2007, 2013, 2019, 2025])
                  .map((x) => ({ x, label: String(x) }))}
        unit="%" fmt={(v) => v.toFixed(1)}
        axisFont={narrow ? 28 : 15}
        pad={{ l: 46, r: narrow ? 22 : 104, t: 16, b: 40 }}
        series={series} spine={YEARS.map((x) => ({ x }))}
        /* 50 is the line the whole chart is read against: above it a party's
           preferences favour Labor, below it the Coalition. It was drawn
           before and left unnamed. */
        refLines={[{ y: 50, label: "even split", color: "var(--ink-faint)", align: "left" }]}
        tooltipTitle={(i) => YEARS[i] + " election"}
        ariaLabel="Share of preferences flowing to Labor, by party, 1996 to 2025"
      />
      <span className="hero-legend fc-legend">
        {PARTIES.map((p) => (
          <span className="hl-item" key={p.id}>
            <span className="hl-line" style={{ background: p.color }}></span>{p.name}
          </span>
        ))}
      </span>
    </>
  );
}

function infoTerms(D) {
  const L = D.latest, prim = D.aggPrimary[D.aggPrimary.length - 1];
  const counts = {};
  D.individualPolls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");
  /* Show-your-working tables (weighted-aggregate entry). Every row is the
     estimator's own, emitted beside the headline it builds, so the Σ line at
     the foot of each table reproduces the figure the hero prints. */
  const F = (v) => (+v).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const swP = D.showWorking && D.showWorking.primary;
  const swT = D.showWorking && D.showWorking.tpp;
  const primWork = swP && swP.rows.length ? (
    <div className="info-work-wrap">
      <table className="info-work">
        <thead><tr><th>Pollster</th><th>Fieldwork</th><th>Mid</th><th>Published</th><th>lean</th><th>xᵢ</th><th>nᵢ</th><th>m</th><th>wᵢ</th></tr></thead>
        <tbody>
          {swP.rows.map((r) => (
            <tr key={r.firm + r.fw}>
              <td>{r.firm}</td><td>{r.fw}</td><td>{r.mid}</td><td>{F(r.x)}</td>
              <td>{F(r.lean)}</td><td>{F(r.adj)}</td><td>{r.n}</td><td>{r.m}</td><td>{F(r.w)}</td>
            </tr>
          ))}
          <tr className="info-work-sum"><td colSpan="9">
            Σwᵢ = {F(swP.sw)} · Σwᵢxᵢ = {F(swP.swx)} · the month is {F(swP.swx)} ÷ {F(swP.sw)} = {F(swP.mean)}
            {" "}→ {swP.v.toFixed(1)} for Labor, {swP.ymLabel}.
          </td></tr>
        </tbody>
      </table>
      <p className="info-work-note">The five-party check: debiased, the parties sum to {swP.adjTotal}
        {" "}({["alp", "lnp", "grn", "onp", "oth"].filter((k) => swP.parties[k]).map((k) => swP.parties[k].adj.toFixed(2)).join(" · ")})
        {" "}against {swP.plainTotal} unweighted
        {swP.rescaled
          ? ` – past the half-point tolerance, so all five are scaled by ${swP.plainTotal} ÷ ${swP.adjTotal}, which is how the Labor figure above lands at ${swP.v.toFixed(1)}.`
          : " – within the half-point tolerance, so nothing is rescaled."}
        {" "}A wave joins the calendar month its fieldwork ended in.
        {swP.rows.some((r) => r.crossed)
          ? " The wave above whose midpoint falls in the month before counts here, where it closed."
          : null}</p>
    </div>
  ) : null;
  const tppWork = swT && swT.rows.length ? (
    <div className="info-work-wrap">
      <table className="info-work">
        <thead><tr><th>Pollster</th><th>Fieldwork</th><th>Mid</th><th>Published</th><th>of pair</th><th>lean</th><th>xᵢ</th><th>d</th><th>nᵢ</th><th>m</th><th>wᵢ</th></tr></thead>
        <tbody>
          {swT.rows.map((r) => (
            <tr key={r.firm + r.fw}>
              <td>{r.firm}</td><td>{r.fw}</td><td>{r.mid}</td><td>{r.pair}</td>
              <td>{F(r.x)}</td><td>{F(r.lean)}</td><td>{F(r.adj)}</td>
              <td>{r.d}</td><td>{r.n}</td><td>{r.m}</td><td>{F(r.w)}</td>
            </tr>
          ))}
          <tr className="info-work-sum"><td colSpan="11">
            Σwᵢ = {F(swT.sw)} · Σwᵢxᵢ = {F(swT.swx)} · the headline is {F(swT.swx)} ÷ {F(swT.sw)} = {F(swT.mean)}
            {" "}→ {swT.v.toFixed(1)}, from the {swT.k} polls in the window.
          </td></tr>
        </tbody>
      </table>
    </div>
  ) : null;
  const onp = Math.round(prim.onp);
  const acc = D.accuracy;
  /* Term-to-term links: the same hi-term tap-to-define treatment the hero
     gets, only here the "back" label names the entry the reader came from. */
  const xref = (to, from, label) => (
    <button type="button" className="hi-term"
            onClick={() => window.AP.openTerm && window.AP.openTerm(to, from)}>{label}</button>);
  const list = [
    { id: "approval", term: "Approval", body: (
      <>A verdict on the job: approve minus disapprove for a leader’s performance. Essential asks,
      “Do you approve or disapprove of the job Anthony Albanese is doing as Prime Minister?”.
      YouGov and Newspoll ask, “Are you satisfied or dissatisfied with the way Anthony Albanese is
      doing his job as Prime Minister?”. Resolve asks, “How would you rate Angus Taylor’s
      performance as opposition leader in recent weeks?”.
      {" "}{xref("favourability", "approval", "Favourability")} is a different question – about
      the person, not the job – asked by the houses that ask it instead. The numbers it feeds
      are what {xref("net-approval", "approval", "net approval")} records.</>) },
    { id: "favourability", term: "Favourability", body: (
      <>A verdict on the person: positive minus negative, for the houses that ask favour rather
      than job performance. RedBridge/Accent asks “Do you have a favourable or unfavourable view
      of the following?”, DemosAU asks “Q. What is your opinion of the following people?” with
      positive, neutral and negative on offer, and Freshwater its own form of it. Not
      interchangeable with {xref("approval", "favourability", "approval")} – a leader can be
      approved of for the job and disliked as a person, or the reverse – so the two measures sit
      in separate panels rather than one averaged
      line. {" "}The {xref("net-approval", "favourability", "net approval")} lines join each
      house’s own readings without pretending they measure the same thing.</>) },
    { id: "interval", term: "95% interval", body: (
      <>The uncertainty carried beside the headline: the greater of the spread among the polls in
      the window and their {xref("margin-of-error", "95% interval", "sampling error")} – ±
      {(L.alp2ppCi95 ?? 0).toFixed(1)} points on a share, so ±
      {(2 * (L.alp2ppCi95 ?? 0)).toFixed(1)} beside the lead it sits with, since the lead moves
      twice as far as either share – on {L.method.nPolls} polls across {L.method.windowDays}{" "}
      days. Full formula: it is 1.96 × the greater of two standard errors taken on exactly the
      weights wᵢ the {xref("weighted-aggregate", "95% interval", "weighted aggregate")} is built
      from. The spread term is √(Σwᵢ(xᵢ − x̄)² ÷ Σwᵢ ÷ (nEff − 1)) – the window’s polls scattered
      around their own weighted mean x̄, divided down by the {xref("effective-sample",
      "95% interval", "effective sample")} nEff less one. The sampling-error floor is
      √(Σ wᵢ² × 1.6 × p̂(1−p̂) ÷ nᵢ) ÷ Σwᵢ – what sampling luck alone would still cost a window
      where every house agreed exactly, with p̂ the aggregate’s own share and 1.6 the design
      effect of a weighted national panel rather than a simple random sample. The greater of
      the two terms binds, so the interval prices disagreement among the houses when they show
      it and never promises better than chance itself when they don’t. It cannot cover error the
      whole industry shares, because an aggregate has no way to see a lean every poll inside it
      carries. Movement smaller than the interval is marked as such rather than reported as a
      change.</>) },
    { id: "effective-sample", term: "Effective sample", body: (
      <>How many polls the window is really worth once weighting is applied – currently
      {" "}{L.alp2ppNEff} of the {L.method.nPolls} in it. Recency, sample size and the square-root
      discount on repeat waves all pull it below the raw count, and it is what
      the {xref("interval", "effective sample", "95% interval")} is computed against.
      {" "}A single poll carries its own version of the same idea, written
      n<sub>eff</sub> beside its sample in the poll breakdown: the effective
      sample its pollster files with the Australian Polling Council, describing
      what that one sample is worth rather than what the window is.</>) },
    { id: "house-effect", term: "House effect", body: (
      <>A pollster’s own lean against the consensus of the houses polling around it, pooled from
      its polls with a 90-day half-life so recent polls count for more – the lean tracks a house’s
      current method rather than averaging it with its history – and shrunk toward zero while the
      evidence is thin. The aggregates subtract it, read as of the time each figure describes. It is
      measured separately for every measure – a firm that leans one way on the classic two-party is
      not assumed to lean the same way on a primary share or on an ALP-v-One Nation head-to-head –
      and it is a property of the pollster, not of any single poll.</>) },
    { id: "poll-lean", term: "Poll lean", body: (
      <>How far one published poll sits from the consensus around it: the poll’s own figure
      minus the weighted aggregate for the month it was taken. It is a property of this one
      poll, not of the pollster – sampling luck alone can land a survey off the consensus, so
      a single lean carries little weight; a house leaning the same way over and over is
      showing {xref("house-effect", "poll-lean", "its house effect")}. Poll lean is sortable
      in the All polls archive and printed in each poll’s breakdown.</>) },
    { id: "house-lean", term: "House lean", body: (
      <>A pollster’s {xref("house-effect", "house-lean", "house effect")} read month by month
      instead of only as it stands now, so a change of method or hands shows up where it
      happened rather than smeared across the house’s history. Estimated per measure – a firm
      can walk one way on two-party and another on a primary share – and the aggregates still
      subtract the as-of-date value; the trace is the same estimator re-read at each
      month.</>) },
    { id: "chance-consistent", term: "Chance-consistent", body: (
      <>The Poll disagreement panel’s verdict when the houses agree as well as polling lets them.
      Even on an unmoved electorate no two surveys match, because each is a sample: a scatter of
      {" "}{xref("margin-of-error", "chance-consistent", "sampling error")} around the truth is
      expected. The panel sets the spread the houses actually show against the spread sampling
      error alone predicts – the chance floor, built from each poll’s own sample size – and a
      ratio between 0.80× and 1.20× reads chance-consistent. Tighter than 0.80× and the polls are
      huddled closer than independent sampling can explain – herding; wider than 1.20× and they
      begin to {xref("mild-divergence", "chance-consistent", "diverge")}. It is the ordinary state
      of healthy polling, not evidence the houses have compared notes.</>) },
    { id: "mild-divergence", term: "Mild divergence", body: (
      <>A little further apart than chance can explain. On the Poll disagreement panel the ratio of
      the houses’ actual spread to the chance floor has passed 1.20× without reaching 1.60×:
      sampling scatter alone no longer covers the gap, so something real sits on top of it – houses
      weighting differently, reaching different voters, or genuinely moving at different speeds.
      The excess stays modest; past 1.60× the panel drops the hedge and calls it real disagreement.
      Below 1.20× the same ratio reads {" "}{xref("chance-consistent", "mild-divergence",
      "chance-consistent")} – the spread chance’s own making.</>) },
    { id: "implied-2pp", term: "Implied 2PP", body: (
      <>An optional dashed line on the two-party chart (“Compare implied 2PP”) showing what the same
      polls’ own primary votes add up to under one fixed {xref("preference-flows", "implied 2PP",
      "preference-flow table")}. It is a diagnostic,
      never the headline: pollsters’ own allocations answer a live question a fixed table cannot.
      {D.synthLatest && D.synth2pp && D.synth2pp.length > 1 ? (
        <> Today the table reads {D.synthLatest.alp.toFixed(1)} against the aggregate’s
        {" "}{L.alp2pp.toFixed(1)} – a gap, not a verdict. At One Nation’s current {onp}% primary,
        five points of doubt about their flow rate is {(prim.onp * 0.05).toFixed(1)} points of
        two-party either way.</>
      ) : null}</>) },
    { id: "individual-poll", term: "Individual poll", body: (
      <>One published poll, drawn as a single dot. The lines through them are monthly aggregates,
      shaded with the 95% interval around them; where two bands meet, that month’s lead is inside
      its own {xref("margin-of-error", "individual poll", "margin of error")}. A “—” in any table
      means the pollster did not ask that question.</>) },
    { id: "margin-of-error", term: "Margin of error", body: (
      <>How far a poll can miss by because it asked a sample rather than the whole country. A
      thousand respondents on their own carry about ±3 points of sampling error at 95% confidence,
      and the figure shrinks only with the square root of the sample – four times the interviews
      buys half the error. It prices chance and nothing else: skewed samples, turnout guesses and
      house choices sit outside it. Beside the headline the same idea is carried across
      {" "}{L.method.nPolls} polls at once as the {xref("interval", "margin of error", "95% interval")}{" "}
      – ±{(L.alp2ppCi95 ?? 0).toFixed(1)} points on each share, shown at ±
      {(2 * (L.alp2ppCi95 ?? 0)).toFixed(1)} beside the lead itself. Pooling that many surveys is
      what brings the band in narrower than one poll’s own ±3: the chance part of the error
      shrinks with the square root of the combined sample, while the part every house shares
      alike does not shrink at all.</>) },
    { id: "monthly-average", term: "Monthly average", body: (
      <>What a matchup gets when too few houses ask it for {xref("house-effect", "monthly average",
      "house effects")} to be estimable: a plain
      mean of the month’s polls, adjusted for nothing. The hero says which of the two it is showing,
      because a matchup that switched silently from an adjusted aggregate to a bare average would
      read as the more precise of the two.</>) },
    { id: "mrp", term: "MRP", body: (
      <>Multilevel regression and post-stratification – a model that estimates each seat separately
      rather than applying one national swing to all of them. Seat figures appear on this site only
      where a pollster modelled them seat by seat and published the result, which is what the MRP
      tag in the archive marks.</>) },
    { id: "net-approval", term: "Net approval", body: (
      <>Approve minus disapprove for a party leader – favourable minus unfavourable where a house
      words it as favourability. The two are separate questions –
      see {xref("approval", "net approval", "Approval")} and{" "}
      {xref("favourability", "net approval", "Favourability")} – asked irregularly and worded
      differently from house to house. The lines drawn are monthly aggregates, weighted and
      house-adjusted the same way the vote series are – see
      {" "}{xref("weighted-aggregate", "net approval", "Weighted aggregate")}.</>) },
    { id: "next-polls", term: "Next polls", body: (
      <>When each house is likely to publish next, forecast from its own record. Its dates are the
      median gap between its last eight releases, nudged no more than three days onto the weekday
      the house keeps. Where recent releases carry publication dates in an unbroken run, the gaps
      measured are those between them, not the fieldwork dates – the steadier clock, and the thing
      actually being forecast. The ± is half the spread of the gaps with the longest and shortest
      set aside, widening for waves further out, and in whole weeks for a house pinned to a
      weekday, the only step its date can take. A filing hour appears where a house has been timed
      often enough, always on the publisher’s own clock (AEDT through summer, AEST otherwise),
      and “today” is Sydney’s; weekday and hour are read off recent releases, a schedule being a
      current fact about a house. A house too variable for a date gets the window its record
      supports, and a schedule stated but not kept – Roy Morgan’s – is taken as stated. A
      projection is a moment, not a guess: a date that passes unpublished holds its row and counts
      on to the far edge of its window, reading as missed, in red, only once that has passed too,
      and it leaves the list only when the real release is added – never on a date guessed in its
      place. The countdown in the tab bar marks the same thing the same way: an unrecorded wave
      leads it, red, counting the days it is late. Opening a row shows the house’s five most
      recent releases and its own release page, so the forecast can be checked against the record
      it came from. Houses that have stopped publishing are removed by hand rather than read out
      of their silence. These are estimates, not announced dates.</>) },
    { id: "polling-error", term: "Polling error", body: acc ? (
      <>How far the final polls have missed. Across the {acc.cycles.length} elections from
      {" "}{acc.cycles[0].year} to {acc.cycles[acc.cycles.length - 1].year} they missed the
      two-party result by {acc.meanAbs} points on average – at {acc.worstCycle.year} by
      {" "}{Math.abs(acc.worstCycle.err)}, with every house on the same side of it. This is the
      error an aggregate cannot see about itself, measured after the fact. Past cycles carries the
      full record, house by house.</>) : (
      <>How far the final polls have missed at past elections. Past cycles carries the record,
      house by house.</>) },
    { id: "preference-flows", term: "Preference flows", body: (
      <>How minor-party ballots split between the two final candidates. The
      {" "}{xref("implied-2pp", "preference flows", "implied-2PP diagnostic")} uses the flows as
      they actually ran at the 2025 election
      {" "}(<a href="https://results.aec.gov.au/31496/Website/HouseStateTppFlow-31496-NAT.htm"
      target="_blank" rel="noopener noreferrer">Greens 88.2%, One Nation 25.5%, all others 54.6% to
      Labor</a>), every formal ballot redistributed Labor v Coalition.
      <span className="info-chart"><FlowChart /></span>
      Full preference distribution data was first published for the 1996 election, so
      party-by-party flows don't exist before then; One Nation's line is broken across
      the parliaments it barely contested.</>) },
    { id: "preferred-pm", term: "Preferred prime minister", body: (
      <>Who voters name as the better prime minister – head to head, or as a three-way where a
      house offers one. Houses leave different shares uncommitted, so the published levels aren’t
      comparable across houses; the gaps and the trend are. House effects are not removed from
      these lines – see {xref("weighted-aggregate", "preferred-pm", "Weighted aggregate")}.</>) },
    { id: "primary-vote", term: "Primary vote", body: (
      <>First-preference share – who voters put 1 beside, before any preferences are distributed.
      Houses that publish no two-party figure still feed this series and the leadership ones.</>) },
    { id: "seat-projection", term: "Seat projection", body: (
      <>Not carried here, deliberately. Turning a national two-party figure into a seat count
      assumes a uniform swing, and with One Nation near {onp}% of the primary vote that assumption
      fails in exactly the seats that would decide the election: a large minor party wins seats
      where its vote is concentrated and none where it is not, and no national number knows the
      difference.</>) },
    { id: "sources", term: "Sources", body: (
      <>Every national voting-intention poll published since the May 2025 federal election, from:
      {" "}{sources}. Field dates and sample sizes are listed per poll in the archive.</>) },
    { id: "two-party-preferred", term: "Two-party preferred", body: (
      <>The share each of two parties holds once every other candidate’s preferences have been
      distributed – the number that decides a seat. The headline contest is Labor against the
      Coalition; the hero can be switched to the other head-to-heads pollsters publish.</>) },
    { id: "undecided", term: "Undecided", body: (
      <>Electors who won’t name a party – the “can’t say” share – shown beside the soft share who
      name one but won’t call their choice firm. They are different questions with different
      wordings, so the panel keeps them as separate lines rather than one averaged measure. Where
      the undecided sit differs by house too, and a poll’s breakdown says which: “set aside”
      (Roy Morgan, DemosAU) takes the can’t-say share out of the base before the party shares are
      computed, so the primaries sum to 100; “inside the pair” (Essential) leaves them inside the
      published two-party pair, which then sums to under 100; and “not firm” (Resolve) is not
      undecided at all – a share of the decided, who named a party but might still move.</>) },
    { id: "weighted-aggregate", term: "Weighted aggregate", body: (
      <>The headline method. Recent and larger polls count for more, and each pollster’s figure is
      adjusted for its own {xref("house-effect", "weighted aggregate", "house effect")}. Where one
      house publishes more than once in a window or a
      calendar month – Roy Morgan polls weekly – its repeat waves count for the square root of
      their number, so three weekly waves count as 1.7, not 3.
      {" "}Full formula: the headline is Σwᵢxᵢ ÷ Σwᵢ over the polls in the 21-day window, where
      xᵢ is a poll’s house-adjusted figure and its weight wᵢ = nᵢ × 2^(−d/7) ÷ √m – nᵢ the
      poll’s sample on the estimator’s scale: its published effective sample where the house files
      one (Newspoll, YouGov, Essential, DemosAU and RedBridge / Accent, via their Australian
      Polling Council methodology statements), grossed back up by the shared 1.6 design factor, else its raw
      sample capped at 3,000 – 1,200 where no sample is filed at all. nᵢ also sets the
      sampling-error floor under the whole
      window, so the same published figure improves both. d is the poll’s age in days (halving
      every seven), and m its house’s wave count in the window. The effective sample behind it is (Σwᵢ)² ÷ Σwᵢ², and the monthly trend points
      run the same formula with the recency term dropped. The leaders’ ratings and national
      direction are built the same way monthly; preferred prime minister and the undecided share
      stay as plain {xref("monthly-average", "weighted aggregate", "monthly averages")} – their
      houses’ differences live in the questions asked, not in a lean to correct.
      <span className="info-p">The current Labor primary is that construction run as the month to
      date. Each wave taken this month contributes its published Labor share – minus the house’s
      lean on the ALP primary specifically, read at the month’s midpoint – weighted by sample
      size alone, the recency halving dropped because a month is read at its centre; a house in
      the field twice counts for √2, not 2. Only once all five parties are estimated is the sum
      checked, and the five stand unrescaled unless the debiased total sits more than half a
      point from the plain-average total – a real undecided-driven shortfall is kept, not ironed
      out. As the month stands, that is {prim.alp.toFixed(1)} for Labor.</span>
      {primWork}
      <span className="info-p">The two-party-preferred is the nowcast proper, over the rows the
      measure admits: waves whose fieldwork midpoint falls inside the 21-day window ending at the
      newest poll, each contributing its published Labor share of the pair – a pair printed with
      undecided still inside it is rebased to 100 first – adjusted for the house’s lean on the
      2PP as of the reference day. A house that publishes no two-party adds no row; running its
      primaries through one fixed flow table stays in the
      {" "}{xref("implied-2pp", "weighted aggregate", "implied 2PP")} diagnostic, never the
      headline, and an empty window falls back to the last monthly point rather than vanishing.
      As of the latest poll, that is {L.alp2pp.toFixed(1)} to Labor,
      {" "}{L.lnp2pp.toFixed(1)} to the Coalition.</span>
      {tppWork}</>) },
  ];
  /* Sorted here rather than written in order, so an entry added later cannot
     land in the wrong place. localeCompare with numeric so "95% interval"
     sorts as a number and not as the character 9. */
  return list.sort((a, b) => a.term.localeCompare(b.term, "en", { numeric: true }));
}

function InfoView({ focus, onBack, backLabel }) {
  const { D } = window.AP;
  const terms = infoTerms(D);
  /* A layout effect, for the reason the archive's restore uses one: the view
     has to be in the DOM before it is tall enough to take the scroll. */
  React.useLayoutEffect(() => {
    if (!focus) return;
    const el = document.getElementById("term-" + focus);
    if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
  }, [focus]);
  return (
    <section className="card info">
      {/* No in-card masthead: the tab that opened this view already names it,
          and a body of definitions needs no preface. */}
      {terms.map((t) => (
        /* a div, not a p: the preference-flows entry embeds TrendChart and
           TrendChart's root is a div. .info-term is only ever selected by
           class, so the paragraph styling is unchanged. */
        <div key={t.id} id={"term-" + t.id}
             className={"info-term" + (focus === t.id ? " lit" : "")}>
          <strong className="info-t">{t.term}.</strong> {t.body}
          {focus === t.id && onBack && (
            <button className="back-to-chart info-back" onClick={onBack}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Back to {backLabel || "where you were"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

Object.assign(window, { Tabs, PastCyclesView, AllPollsView, InfoView,
  // shared cell renderers reused by the latest-polls table
  ArchSortTh, ArchPublished, ArchLead, ArchApprCell, ArchDirCell, archLeadInfo });
