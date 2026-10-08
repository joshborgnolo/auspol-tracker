/* auspol tracker – header, hero, page assembly */

/* Load-time settle, shared by everything that moves into place on the way in:
   the masthead needle and graduations, the hero's rolling figures and its
   mercury. One clock, so the page reads as one instrument coming to rest,
   not four animations that happen to overlap. */
const SETTLE_MS = 220;
const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// relative freshness for the "last poll" stamp, which is measured off the
// date that stamp SHOWS - the last publication, not the last fieldwork end,
// or the page would read "26 Aug 2026, 2 days ago" on 26 August
function freshness(iso) {
  /* Whole calendar days, both ends in the frame the stamp is written in -
     these are Australian dates, so the comparison is against Sydney's today
     (easternNow, shared with "Next expected polls"). It used to round the
     elapsed MILLISECONDS between local midnight and now, which called a poll
     published this morning "yesterday" from noon onward - invisible while the
     stamp was a fieldwork end a few days back, and wrong every afternoon now
     that it is a publication date. */
  const then = Date.parse(iso);                 // a bare ISO date parses as UTC midnight
  const days = Math.max(0, Math.round((easternNow().day - then) / 86400000));
  let label;
  if (days === 0) label = "Today";
  else if (days === 1) label = "Yesterday";
  else if (days < 14) label = days + " days ago";
  else if (days < 56) label = Math.round(days / 7) + " weeks ago";
  else label = Math.round(days / 30) + " months ago";
  const state = days <= 7 ? "fresh" : days <= 21 ? "aging" : "stale";
  return { label, state, days };
}

const SHORT_MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// "31 Aug" – the hero's as-of stamp; the full "31 August 2026" already lives
// in latest.updated for the prose copy that needs it
function shortDate(iso) {
  const t = new Date(Date.parse(iso));
  return t.getUTCDate() + " " + SHORT_MON[t.getUTCMonth()];
}

/* The masthead dial as a reusable mark. The header mounts it in the lockup
   (its svg carries glyphRef - the story overlay's FLIP origin) and the tab
   bar mounts the same dial as a placeholder in the 2PP score's seat on phone
   viewports (GlyphDial via window, see .tab-glyph) - one component, so the
   two instances can never drift apart. */
function GlyphDial({ className, svgRef, width, height }) {
  const { D } = window.AP;

  // wordmark glyph = live primary-vote aggregate: one bar per party,
  // sorted tallest-first, height scaled to each party's latest share
  // (the 21-day primary nowcast the page quotes – latest.primary, not the
  // calendar month-to-date point aggPrimary ends on)
  const lp = D.latest.primary;
  const glyph = [
    { id: "alp", color: "var(--alp)", v: lp.alp },
    { id: "lnp", color: "var(--lnp)", v: lp.lnp },
    { id: "grn", color: "var(--grn)", v: lp.grn },
    { id: "onp", color: "var(--onp)", v: lp.onp },
  ].sort((a, b) => b.v - a.v);
  const gv = glyph.map((p) => p.v);
  const gmin = Math.min(...gv), gmax = Math.max(...gv);
  const MIN_H = 5, MAX_H = 10.5;
  glyph.forEach((p) => {
    p.h = gmax === gmin ? MAX_H : MIN_H + ((p.v - gmin) / (gmax - gmin)) * (MAX_H - MIN_H);
  });
  const glyphTitle = "Primary vote aggregate, " +
    glyph.map((p) => `${D.PARTIES[p.id].short} ${p.v.toFixed(1)}`).join(", ");

  // pendulum = the LIVE implied head-to-head against Labor's STRONGEST
  // challenger – the same figures the hero headline and the story player's
  // rest frame quote (tppLatest on the implied basis), and the same pick:
  // whichever opponent holds the higher implied 2PP against Labor. The
  // needle swings toward whoever leads THAT contest (Labor left, challenger
  // right).
  const challengers = [["L/NP", "var(--lnp)", "alp_lnp"], ["ON", "var(--onp)", "alp_on"]]
    .map(([abbr, color, id]) => {
      const v = tppLatest(id, "imp");
      return v && v.b != null ? { abbr, color, lab: v.a, opp: v.b } : null;
    })
    .filter(Boolean);
  const topOpp = challengers.slice().sort((x, y) => y.opp - x.opp)[0] ||
    { abbr: "L/NP", color: "var(--lnp)", lab: 50, opp: 50 };
  const pMargin = +(topOpp.lab - topOpp.opp).toFixed(1);        // + → Labor leads
  const labLeads = pMargin >= 0;
  const pendColor = labLeads ? "var(--alp)" : topOpp.color;
  const oppColor = topOpp.color;
  // ±12 pts → full ±34° deflection. Labor (positive margin) swings LEFT,
  // the challenger swings RIGHT – matching the hero's Labor-left / opp-right order.
  const pendDeg = Math.max(-1, Math.min(1, pMargin / 12)) * 34;
  const pendTitle = `Implied 2PP, ALP v ${topOpp.abbr}, ` +
    (labLeads ? "Labor" : topOpp.abbr) + ` +${Math.abs(pMargin).toFixed(1)}`;

  // settle the needle in from vertical on load (skip the swing for reduced motion)
  const [pendSettled, setPendSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    const t = setTimeout(() => setPendSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [pendDeg]);
  // Needle points UP from the pivot, so the sign flips vs the old hanging
  // pendulum: NEGATIVE rotation swings the tip left (Labor side).
  const needleDeg = pendSettled ? -pendDeg : 0;
  /* The graduations settle with the needle rather than arriving already
     correct: all four start at one neutral length, then some grow and some
     shrink into their real share. Half the instrument animating while the
     other half sat finished read as unfinished. */
  const SETTLE_H = (MIN_H + MAX_H) / 2;

  // ---- integrated glyph geometry: one dial – party columns are radial
  // graduations on the arc, the 2PP needle swings from the same pivot ----
  const GC = { cx: 22, cy: 24.5, r: 12 };
  const polar = (deg, r) => ({
    x: +(GC.cx + Math.sin(deg * Math.PI / 180) * r).toFixed(2),
    y: +(GC.cy - Math.cos(deg * Math.PI / 180) * r).toFixed(2),
  });
  const BAR_ANGLES = [-54, -18, 18, 54];          // tallest-first, left → right
  const arcPath = (d1, d2) => {
    const a = polar(d1, GC.r), b = polar(d2, GC.r);
    return `M ${a.x} ${a.y} A ${GC.r} ${GC.r} 0 0 1 ${b.x} ${b.y}`;
  };

  return (
    /* viewBox bounds what is actually drawn, the way the favicon's does in
       build.mjs, rather than the old hardcoded 0 0 44 28 - which held the
       ink hard against its left edge and carried 5.6 units of dead space
       on the right, so the CSS gap never meant what it said. The extremes
       are fixed, not data-driven: the sort pins the longest graduation to
       -54° and the shortest to +54°, so only the two middle bars vary and
       they cannot reach past the top edge. */
    <svg className={className} ref={svgRef || null}
         viewBox="0.58 0.07 38.39 26.73" width={width} height={height}
         aria-hidden="true">
      <title>{glyphTitle + ", " + pendTitle}</title>
      {/* half-circle two-tone swing arc: Labor left, strongest challenger right */}
      <path d={arcPath(-90, 0)} className="wm-arc" stroke="var(--alp)"></path>
      <path d={arcPath(0, 90)} className="wm-arc" stroke={oppColor}></path>
      {/* Party columns as radial graduations, heights = primary vote.
          Each line is drawn at FULL length and revealed by its dash,
          because stroke-dasharray transitions everywhere while the SVG
          geometry attributes (x2/y2) do not. */}
      {glyph.map((p, i) => {
        const a = BAR_ANGLES[i];
        const inner = polar(a, GC.r + 2);
        const outerMax = polar(a, GC.r + 2 + MAX_H);
        const shown = pendSettled ? p.h : SETTLE_H;
        return (
          <line key={p.id} className="wm-bar"
                x1={inner.x} y1={inner.y} x2={outerMax.x} y2={outerMax.y}
                stroke={p.color} strokeWidth="3.4" strokeLinecap="butt"
                style={{ strokeDasharray: shown.toFixed(2) + " " + MAX_H }}></line>
        );
      })}
      {/* 2PP needle – swings toward the leader of the top contest.
          Wrapped in a translate so rotation happens about local (0,0). */}
      <g transform={`translate(${GC.cx}, ${GC.cy})`}>
        <g className="wm-needle-g" style={{ transform: `rotate(${needleDeg}deg)` }}>
          <line x1="0" y1="0" x2="0" y2="-8.6"
                stroke={pendColor} strokeWidth="1.7" strokeLinecap="round"></line>
          <circle cx="0" cy="-8.6" r="1.9" fill={pendColor}></circle>
        </g>
      </g>
      <circle cx={GC.cx} cy={GC.cy} r="1.7" className="wm-pivot"></circle>
    </svg>
  );
}
window.GlyphDial = GlyphDial;   // the tab bar's placeholder instance (views.jsx)

function Header({ isDark, onToggleTheme, rd }) {
  const { D } = window.AP;
  const fresh = freshness(D.latest.publishedISO);

  /* The lockup squares itself off only while the two words happen to MEASURE
     the same, and that was a property of Public Sans rather than of the
     design: at 30px it set `auspol` 93.6 and `tracker` 95. The faces that
     replaced it do not agree - Myriad sets `tracker` 8.2px short of `auspol`,
     Source Sans 3 2.9px short - and which of them renders depends on what the
     reader has installed, so no fixed tracking can be right for both. The
     shortfall is measured and closed instead, which also means the next change
     of face carries itself.

     Letter-spacing lands after the LAST letter too, so it widens the box by
     one more unit than it widens the ink. What has to line up is the ink, so
     the trailing unit comes back off both measurements before they are
     compared. */
  /* The rocker can be flicked as well as pressed. Dragging across the pivot
     throws it, the way a real switch goes over under a thumb rather than
     needing to be aimed at and tapped - and on a phone that is the more
     natural gesture of the two.

     A deadzone either side of the pivot stops a wobble on the seam from
     toggling repeatedly, which matters more than usual here: the theme change
     runs inside a view transition, so each flip is a whole-page crossfade.

     Capture belongs to the throw, never to the tap, and engages only once the
     pointer has actually travelled - a flick keeps its stream, while a tap is
     left alone.

     The tap itself is settled at pointerup rather than by the cells' clicks.
     Those clicks could only ever select their own half, so a tap on the plate
     already lit did nothing; the switch now flips wherever it is tapped, which
     is what a switch does. Pointerup and not click because on touch a tap is
     rarely motionless: a press on the far half travels enough for the drag
     path to flip it first, and a click flipping again would cancel it. The
     cells keep an onClick for keyboard activation only, told apart by
     `detail === 0`. */
  const segRef = useRef(null);
  const segDrag = useRef(false);   // pointer down, not yet known to be a throw
  const segHeld = useRef(false);   // pointer capture actually engaged
  const segDownX = useRef(0);
  const segFlipped = useRef(false); // the drag already flipped it; the tap must not repeat
  const halfAt = (clientX) => {
    const el = segRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const mid = r.left + r.width / 2, DEAD = 6;
    if (clientX > mid + DEAD) return true;    // the moon half
    if (clientX < mid - DEAD) return false;   // the sun half
    return null;                              // on the pivot: not yet thrown
  };
  const onSegDown = (e) => {
    segDrag.current = true;
    segDownX.current = e.clientX;
    segFlipped.current = false;
  };
  const onSegMove = (e) => {
    if (!segDrag.current) return;
    if (!segHeld.current && Math.abs(e.clientX - segDownX.current) >= 4) {
      try { e.currentTarget.setPointerCapture(e.pointerId); segHeld.current = true; } catch (_) { /* fine without */ }
    }
    const want = halfAt(e.clientX);
    if (want != null && want !== isDark) { onToggleTheme(); segFlipped.current = true; }
  };
  /* A TAP RESOLVES HERE, not in the cells' onClick. It is a light switch: a tap
     anywhere on it flips, including on the plate already lit — which is the
     whole point, and what the cells could never do while each one only knew how
     to select itself.
     It has to be pointerup rather than click because on touch a tap is rarely
     motionless: a press on the far half travels enough for onSegMove to flip it
     before any click arrives, and a click that flipped again would cancel it.
     segFlipped records that the drag already did the work, so the tap does not
     repeat it; segHeld means a throw, which resolved on the way. */
  const onSegUp = (e) => {
    segDrag.current = false;
    if (segHeld.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* fine */ }
    } else if (!segFlipped.current) {
      onToggleTheme();
    }
    segHeld.current = false;
    segFlipped.current = false;
  };
  /* A cancelled gesture is not a tap and must not flip anything. */
  const onSegCancel = (e) => {
    segDrag.current = false;
    if (segHeld.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* fine */ }
    }
    segHeld.current = false;
    segFlipped.current = false;
  };

  const wmName = useRef(null), wmTrack = useRef(null);
  React.useEffect(() => {
    const a = wmName.current, b = wmTrack.current;
    if (!a || !b) return;
    let dropped = false;
    const inkWidth = (el) => {
      const ls = parseFloat(getComputedStyle(el).letterSpacing);
      return el.getBoundingClientRect().width - (isNaN(ls) ? 0 : ls);
    };
    const align = () => {
      if (dropped || !a.isConnected) return;
      a.style.letterSpacing = ""; b.style.letterSpacing = "";
      const wide = inkWidth(a) >= inkWidth(b) ? a : b;
      const narrow = wide === a ? b : a;
      const gaps = narrow.textContent.length - 1;
      if (gaps < 1) return;
      const base = parseFloat(getComputedStyle(narrow).letterSpacing);
      narrow.style.letterSpacing =
        (((isNaN(base) ? 0 : base) + (inkWidth(wide) - inkWidth(narrow)) / gaps)).toFixed(3) + "px";
    };
    align();
    // the webfont can land after the first paint and re-measure both words
    if (document.fonts) document.fonts.ready.then(align);
    return () => { dropped = true; };
  }, []);

  /* The mark is the whole tracker at 44x28 units, so clicking it opens the
     thing it abbreviates rather than anything decorative – see wm-story.jsx.
     The origin rect is handed over so the overlay can fly out of the masthead
     instead of appearing on top of it. */
  const [story, setStory] = useState(null);
  const glyphRef = useRef(null);
  /* Closing hands focus back to whichever element opened the overlay - the
     whole lockup is the way in today, but the return is kept generic so a
     second entry point never has to touch this. The dial still grows out of
     the MARK either way: that is where the instrument being wound back
     actually sits on the page. */
  const openerRef = useRef(null);
  const openStory = (e) => {
    openerRef.current = (e && e.currentTarget) || glyphRef.current;
    const el = glyphRef.current;
    setStory({ rect: el ? el.getBoundingClientRect() : null });
  };
  /* The freshness dot in the meta line doubles as a switch: press it and the
     page trades the interactive app for the article version of itself - the
     static summary a crawler or reader mode reads, which sits in flow all
     along under body.js's opacity hide. One class on <body> crosses the two
     (the article steps back up to full opacity, the app's box collapses) and
     pressing again flips it straight back, with nothing to recompute. While
     the app is hidden the dot hides with it, so the way back is a pill
     portaled onto <body> - createPortal, not a second mount point. */
  const [staticView, setStaticView] = useState(false);
  /* the colophon's "plain text version" link opens the same view; the
     freshness dot used to be its only door - a 7px target, and on phones a
     click-only span inside an aria-hidden block */
  useEffect(() => { window.AP.openStatic = () => setStaticView(true); }, []);
  /* A satellite page's lockup links here: /#story opens the dial's story
     exactly as the masthead's own click would. The hash comes off the
     address straight away (no extra history entry) so the address reads
     clean and the nav's own hash grammar never sees it. Checked on mount
     only - the links all live off this page, so every arrival is one. */
  useEffect(() => {
    if (window.location.hash === "#story") {
      openStory();
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  useEffect(() => {
    document.body.classList.toggle("ss-view", staticView);
    /* mount marks the article inert so nothing inside it can take focus or a
       click while the app owns the page; in this view the article IS the
       page, so the inert has to come off (and go back on the way out) */
    const ss = document.querySelector(".static-summary");
    if (ss) ss.inert = !staticView;
    return () => {
      document.body.classList.remove("ss-view");
      if (ss) ss.inert = true;
    };
  }, [staticView]);
  /* "The last N" counts the PAST terms in the cycle data (the Now term
     excluded), so a new Past-cycles term renumbers the sentence on its own.
     Spelled out to twenty; elections come ~3-yearly, so the digit fallback
     is decades away. */
  const TAGLINE_N = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
                     "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
                     "eighteen","nineteen","twenty"];
  const pastTerms = D.cycles.filter((c) => !c.current).length;
  const pastWord = TAGLINE_N[pastTerms] || String(pastTerms);
  /* /vic/'s words (window.JUR): "vicpol", "Victorian state". Each line the
     satellites' shell lifts from this source (site-shell.mjs parseChrome)
     keeps its federal JSX verbatim; the jurisdiction's variant writes its
     class as an expression (className={"wm-name"}), the same DOM, which the
     parser's literal anchors never match - so a moved federal anchor still
     fails loudly instead of lifting /vic/'s words onto the satellites. */
  const J = window.JUR;
  /* The redesign's status block names the newest poll by its pollster and
     fieldwork, so the masthead and the sections' "to 21 Sep" agree; the
     election line counts the months left before it must be held. */
  const rdLatest = rd ? (D.pollsterTable || []).slice().sort((a, b) => (a.pubSort < b.pubSort ? 1 : -1))[0] : null;
  /* The newest poll's name+fieldwork open the pollster's own release, as a
     plain link styled invisible (a.mh-latest: no underline, no link icon -
     only a click gives it away). releaseUrl over a media `url` citation,
     the archive emitter's own precedence. */
  const rdLatestUrl = rdLatest ? (rdLatest.releaseUrl || rdLatest.url) : null;
  const rdLatestFact = rdLatest
    ? (rdLatestUrl
        ? <a className="mh-latest" href={rdLatestUrl} target="_blank" rel="noopener noreferrer">{rdLatest.pollster + ", " + (rdLatest.fieldPending ? "fieldwork TBC" : rdLatest.field)}</a>
        : rdLatest.pollster + ", " + (rdLatest.fieldPending ? "fieldwork TBC" : rdLatest.field))
    : D.latest.published;
  const rdDue = (() => {
    const m = /(\d{1,2}) (\w+) (\d{4})/.exec(D.latest.nextElectionDue || "");
    if (!m) return null;
    const t = Date.parse(m[1] + " " + m[2] + " " + m[3] + " UTC");
    if (isNaN(t)) return null;
    /* a fixed-date election (Victoria's last Saturday in November) counts
       the days to it; the federal one, a deadline, the months before it */
    if (J && J.nextElection && J.nextElection.fixed) {
      const days = Math.round((t - easternNow().day) / 86400000);
      return days > 1 ? "in " + days + " days" : days === 1 ? "tomorrow" : days === 0 ? "today" : null;
    }
    const months = Math.round((t - easternNow().day) / (86400000 * 30.44));
    return months > 1 ? months + " months at most" : null;
  })();

  return (
    <header className="site-head">
      <div className="brand">
        <div className="lockup">
          <h1 className="wordmark stacked">
            <span className="wm-textcol">
              {!J ? <span className="wm-name" ref={wmName}>auspol</span>
                  : <span className={"wm-name"} ref={wmName}>{J.brand}</span>}
              <span className="sr-only"> </span>
              <span className="wm-track" ref={wmTrack}>tracker</span>
            </span>
            {!J ? <span className="wm-sr">– Australian federal polling</span>
                : <span className={"wm-sr"}>– {J.electionWords} polling</span>}
          </h1>
          {/* The story player is wired to the DIAL alone - the wordmark
              carries no click. With the words out of the button the old
              accessibility puzzle inverts: the h1 names itself "auspol
              tracker" plainly and the button names itself by its action,
              so a plain aria-label does the job the words-on-the-button
              trick once did. */}
          <button className="wm-glyph" onClick={openStory}
                  title="Wind the dial back through the term"
                  aria-label="Wind the dial back through the term"
                  aria-describedby="wm-action">
            {/* 57px sizes the ink to 74% of the wordmark's height, the
                proportion the lockup was drawn with before both words went
                to 30px. glyphRef stays on THIS instance - the story
                overlay's FLIP origin is the lockup's dial, never the tab
                bar's placeholder. */}
            <GlyphDial className="wm-dial" svgRef={glyphRef} width="57" height="39.7" />
          </button>
          <span id="wm-action" hidden>Replays the term on the masthead dial</span>
        </div>
        {/* plain text: the design flip this sentence used to carry moved
            off the page 2026-10-03; the old design is viewable at
            ?design=old while its code ships (see the design flag below). */}
        {!J ? <p className="tagline">Aggregated opinion polling for the next Australian <br className="tagline-br"></br>federal election, set against the last {pastWord}.</p>
            : <p className={"tagline"}>Aggregated opinion polling for the next {J.electionWords.split(" ")[0]} <br className="tagline-br"></br>{J.electionWords.split(" ").slice(1).join(" ")} election{pastTerms ? ", set against the last " + pastWord : ""}.</p>}
        <div className="head-meta-compact" aria-hidden="true">
          <span className={"fresh-dot fresh-toggle " + fresh.state}
                onClick={() => setStaticView(true)}></span>{" "}
          Updated {D.latest.published}, {D.latest.pollsTracked} polls
        </div>
      </div>
      {rd && (
        /* the phone's status, under the tagline: one line, as the old
           design's was - the latest poll and how many this term. The
           election date is the laptop block's; a second line for it cost
           the phone 20px above the headline figure. */
        <div className="rd-head-compact">
          <span className={"fresh-dot " + fresh.state}></span>
          <span><b>Latest poll</b> {rdLatestFact}, {fresh.label.toLowerCase()}, {D.latest.pollsTracked} polls</span>
        </div>
      )}
      <div className="head-right">
        {rd ? (
          <div className="head-meta rd-head-meta">
            <div className="meta-item">
              <span className="meta-k">Latest poll</span>
              <span className="meta-v">
                <button type="button" className={"fresh-dot fresh-toggle " + fresh.state}
                        onClick={() => setStaticView(true)} tabIndex={-1}
                        aria-label="Read this page as a plain, static article"
                        title="Read this page as a plain, static article"></button>
                {rdLatestFact}
              </span>
              <span className="meta-s">published {fresh.label.toLowerCase()}</span>
            </div>
            <div className="meta-divide"></div>
            <div className="meta-item">
              <span className="meta-k">This term</span>
              <span className="meta-v">{D.latest.pollsTracked} polls</span>
              <span className="meta-s">{D.latest.housesTracked} pollsters</span>
            </div>
            <div className="meta-divide"></div>
            <div className="meta-item">
              <span className="meta-k">Next election</span>
              <span className="meta-v">{D.latest.nextElectionDue}</span>
              {rdDue && <span className="meta-s">{rdDue}</span>}
            </div>
          </div>
        ) : (
        <div className="head-meta">
          <div className="meta-item meta-updated">
            <span className="meta-k">Last poll</span>
            <span className="meta-v">
              <button type="button" className={"fresh-dot fresh-toggle " + fresh.state}
                      onClick={() => setStaticView(true)} tabIndex={-1}
                      aria-label="Read this page as a plain, static article"
                      title="Read this page as a plain, static article"></button>
              {D.latest.published}
              <span className="fresh-rel">, {fresh.label}</span>
            </span>
          </div>
          <div className="meta-divide"></div>
          <div className="meta-item meta-election">
            <span className="meta-k">Next election</span>
            <span className="meta-v">{D.latest.nextElectionDue}</span>
          </div>
          <div className="meta-divide meta-divide-polls"></div>
          <div className="meta-item meta-polls">
            <span className="meta-k">Polls tracked</span>
            <span className="meta-v">{D.latest.pollsTracked}, {D.latest.housesTracked} pollsters</span>
          </div>
        </div>
        )}
        <div className="theme-seg segmented" role="group" aria-label="Colour theme"
             ref={segRef} onPointerDown={onSegDown} onPointerMove={onSegMove}
             onPointerUp={onSegUp} onPointerCancel={onSegCancel}>
          <button className={"seg-btn theme-cell" + (!isDark ? " active" : "")}
                  onClick={(e) => { if (e.detail === 0) onToggleTheme(); }}
                  aria-pressed={!isDark} aria-label="Light mode" title="Light mode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2"></circle>
              <path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"></path>
            </svg>
          </button>
          <button className={"seg-btn theme-cell" + (isDark ? " active" : "")}
                  onClick={(e) => { if (e.detail === 0) onToggleTheme(); }}
                  aria-pressed={isDark} aria-label="Dark mode" title="Dark mode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7Z"></path>
            </svg>
          </button>
        </div>
      </div>
      {story && <DialStory originRect={story.rect}
        onClose={() => { setStory(null); requestAnimationFrame(() => {
          const back = openerRef.current || glyphRef.current;
          back && back.focus && back.focus();
        }); }} />}
      {staticView && ReactDOM.createPortal(
        <button type="button" className="ss-back" onClick={() => setStaticView(false)}>
          Back to the interactive tracker
        </button>, document.body)}
    </header>
  );
}

/* A headline figure that ROLLS to its new value instead of being replaced by
   it. Every digit is a reel: 1 to 3 slides through 2, 4 to 8 through 5, 6 and
   7, which is what makes a matchup switch read as one number moving rather
   than another number arriving.

   The value in the DOM is the FINAL one from the first frame - the reel is
   decoration over a number that is already correct, never a delay in front of
   one - so a screen reader, a copy-paste and the accessibility tree all get
   53.8 the instant it is true, while the eye watches it arrive.

   The baseline is the fiddly part: a box with overflow:hidden takes its bottom
   edge as its baseline, which would drop the 17px party name by a fifth of a
   62px em. The zero-width anchor is a real, invisible line of text at the head
   of the row, so the whole figure keeps an ordinary text baseline and the
   clipped digit boxes align to its top edge. */
const ROLL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
/* A .roll-sep between rolled figures is kerned against its neighbours (the
   hero's `drift` opt-in). Crimson Text's figures ignore tabular-nums: the 1
   is 0.371em against every other digit's 0.493 (canvas-measured on the
   shipped 600 cut), so a reel's slot is 0.493em wide (its widest span) and a
   digit that doesn't fill it hands its slack, on the right, to the separator
   - which is why the hero's point hung a bare stem-width off every 1. The
   separator's left margin pays that slack back, pulling negative under the
   1's empty shoulder, and the margins ride the reel's own transition, so the
   point drifts in with a rolling figure instead of holding one anchorage for
   every digit. Opt-in because it's face-specific: faces with genuinely
   tabular digits (the lead line, the tables) have no slack to reclaim, and
   these margins would push their point into the 1. */
const ROLL_FRAME = 0.493;           // the reel slot: widest Crimson digit advance, em
const ROLL_ADV = { "1": 0.371 };    // Crimson figures narrower than the slot, em
const SEP_GAP = 0.03;               // the air a separator keeps either side, em
function driftMargins(text, i) {
  const L = text[i - 1] || "";
  const slack = /[0-9]/.test(L) ? ROLL_FRAME - (ROLL_ADV[L] ?? ROLL_FRAME) : 0;
  return { marginLeft: (SEP_GAP - slack) + "em", marginRight: SEP_GAP + "em" };
}
window.RollNum = RollNum;      // the hero's Delta reads it off the window (see Delta)
function RollNum({ value, className, style, spinIn, drift }) {
  const text = String(value);
  /* spinIn: arrive the way a matchup switch does - every reel mounts at 0 and
     rolls up to its real digit on the shared settle clock, an odometer spun
     up on load. The DOM value is still the FINAL figure from the first frame
     (see above), so nothing is ever withheld from the accessibility tree;
     and with reduced motion there is no pretend state at all - the figure is
     mounted already correct. */
  const [spun, setSpun] = React.useState(!spinIn || REDUCED_MOTION);
  React.useEffect(() => {
    if (spun) return;
    const t = setTimeout(() => setSpun(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  /* Keyed by PLACE VALUE - distance from the right end - not by position from
     the left. A figure that loses a character has every reel to the left of it
     renumbered under an index key, so React sees a different element at each
     slot and mounts a fresh one: Hanson going -6 -> 0 handed slot 0 a digit
     where a minus sign had been, and the number that was meant to roll simply
     appeared. From the right, the 6 and the 0 are both the units digit, they
     are the same element, and it reels; the minus sign is what leaves. */
  const n = text.length;
  return (
    <span className={"roll" + (className ? " " + className : "")} style={style}>
      <span className="roll-anchor" aria-hidden="true">0</span>
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (
        /[0-9]/.test(ch) ? (
          <span className="roll-d" key={n - 1 - i} aria-hidden="true">
            <span className="roll-reel" style={{ "--d": spun ? Number(ch) : 0 }}>
              {ROLL_DIGITS.map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        ) : (
          <span
            className="roll-sep"
            key={n - 1 - i}
            aria-hidden="true"
            style={drift ? driftMargins(text, i) : undefined}
          >{ch}</span>
        )
      ))}
    </span>
  );
}

/* Blend two party colours the long way round the wheel. `shorter hue` from
   L/NP blue (250deg) to One Nation orange (58deg) is 172deg the OTHER way, so
   the rival travels blue - indigo - magenta - red - orange rather than sliding
   through grey, which is what an oklab mix of the two would do. Left as a CSS
   function rather than computed here so it keeps resolving against whichever
   palette the theme is currently using. */
/* The one motion curve every moving-data transition shares – defined in
   AP (helpers.js) so the chart's travelling window samples the same one, and
   mirrored as a cubic-bezier on .roll-reel so the digits do too. */
const MORPH_EASE = (x) => window.AP.morphEase(x);

function mixC(c1, c2, t) {
  if (t <= 0 || c1 === c2) return c1;
  if (t >= 1) return c2;
  return "color-mix(in oklch shorter hue, " + c1 + ", " + c2 + " " + (t * 100).toFixed(1) + "%)";
}

/* Two-party matchup config – each is a mirrored head-to-head 2PP.
     `real`    = the headline measure, which carries the weighted nowcast
     `scatter` = per-poll accessor. EVERY matchup here is built from figures
                 pollsters actually published (the ALP v ON and L/NP v ON
                 head-to-heads come from altTppRaw and their aggregate line is
                 a mean of them), so all three plot their own readings – the
                 only difference is how many houses ask the question.

   At module scope, and on window.AP, so the tab bar's docked score can read
   the same definitions and follow whichever matchup the hero is switched to. */
const MATCHUPS = (() => {
  const D = window.AUSPOL;
  return {
    alp_lnp: {
      a: { name: "Labor", color: "var(--alp)", abbr: "ALP" },
      b: { name: "Coalition", color: "var(--lnp)", abbr: "L/NP" },
      data: D.agg2pp.map((d) => ({ ym: d.ym, x: d.x, a: d.alp, b: d.lnp, ci95: d.ci95, k: d.k })), real: true,
      label: "ALP v L/NP", dots: ["var(--alp)", "var(--lnp)"], vsLabor: true,
      // pairs that don't sum to 100 (undecided-inclusive) plot at alpN
      scatter: (p) => (p.alpN == null ? null : [
        { y: p.alpN, color: "var(--alp)", label: "ALP 2PP" },
        { y: +(100 - p.alpN).toFixed(1), color: "var(--lnp)", label: "L/NP 2PP" },
      ]),
    },
    alp_on: {
      a: { name: "Labor", color: "var(--alp)", abbr: "ALP" },
      b: { name: "One Nation", color: "var(--onp)", abbr: "ON" },
      data: D.alt2pp.alp_on, real: false, altKey: "alp_on",
      label: "ALP v ON", dots: ["var(--alp)", "var(--onp)"], vsLabor: true,
      scatter: (p) => (!p.tppAlt ? null : [
        { y: p.tppAlt.alp, color: "var(--alp)", label: "ALP v ON" },
        { y: p.tppAlt.onp, color: "var(--onp)", label: "ON v ALP" },
      ]),
    },
    lnp_on: {
      a: { name: "Coalition", color: "var(--lnp)", abbr: "L/NP" },
      b: { name: "One Nation", color: "var(--onp)", abbr: "ON" },
      data: D.alt2pp.lnp_on, real: false, altKey: "lnp_on",
      label: "L/NP v ON", dots: ["var(--lnp)", "var(--onp)"], vsLabor: false,
      scatter: (p) => (!p.tppAlt2 ? null : [
        { y: p.tppAlt2.lnp, color: "var(--lnp)", label: "L/NP v ON" },
        { y: p.tppAlt2.onp, color: "var(--onp)", label: "ON v L/NP" },
      ]),
    },
  };
})();

/* The current figure for ANY matchup, headline or not – one accessor, so the
   hero readout, its switcher chips and the docked tab-bar score can never
   disagree. The REAL ALP v L/NP measure reads the trailing recency- +
   sample-weighted, house-effect-adjusted nowcast on the REQUESTED BASIS
   (basis = "imp": D.synthLatest, the implied figure – every poll's primaries
   run through the fixed 2025 flow table; "resp": D.latest, the pollsters'
   own published 2PPs). An alternative matchup has no bases: it gets a
   nowcast WHERE its series supports one (D.altLatest is null for a matchup
   too thin to weight); otherwise its last monthly point. ONE exception:
   ALP v ON has TWO bases too, and honours the same toggle. Its implied
   default (D.latest.onImp – the current primaries run through a
   first-principles flow set, carrying that set's flow band rather than a
   sampling interval) leads because no election count of the pairing exists
   to discipline the houses' uncoordinated allocations; on "resp" it quotes
   the pollsters' own published head-to-head nowcast instead. LNP v ON is
   the only figure with a single basis. */
function tppLatest(id, basis) {
  const D = window.AUSPOL, M = MATCHUPS[id];
  if (!M) return null;
  if (M.real) {
    if (basis === "imp" && D.synthLatest && D.synthLatest.alp != null)
      return { a: D.synthLatest.alp, b: D.synthLatest.lnp, ci95: D.synthLatest.ci95 };
    return { a: D.latest.alp2pp, b: D.latest.lnp2pp, ci95: D.latest.alp2ppCi95 };
  }
  const imp = M.altKey === "alp_on" && D.latest.onImp && D.synthOn ? D.latest.onImp : null;
  if (imp) {
    if (basis === "resp" && D.altLatest && D.altLatest.alp_on)
      return { a: D.altLatest.alp_on.a, b: D.altLatest.alp_on.b, ci95: D.altLatest.alp_on.ci95 };
    return { a: imp.a, b: imp.b, ci95: imp.band, flows: true };
  }
  const al = D.altLatest ? D.altLatest[M.altKey] : null;
  if (al) return { a: al.a, b: al.b, ci95: al.ci95 };
  const last = M.data[M.data.length - 1];
  return last ? { a: last.a, b: last.b, ci95: null } : null;
}
window.AP.tppMatchups = MATCHUPS;
window.AP.tppLatest = tppLatest;

/* The 95% interval as an instrument rather than a footnote.

   Centre is the tie; the span runs toward whoever leads - matching both the
   readout above, where Labor sits left, and the dial's "needle leans to
   whoever leads". Distance from centre is 2PP points off 50, the same
   quantity the dial's needle carries.

   Why it exists: the hero states a lead and an interval as two separate
   numbers and leaves the reader to compare them. Whether the lead clears its
   own margin is the single thing that decides if the headline means anything,
   and it was arithmetic homework. Here the tie mark either falls inside the
   span or it does not.

   Where the line falls - the same one the dial draws: the CHANNEL is chrome
   and takes the page's top-left light, recessed with a lit lip below. The
   SPAN is a reading and stays flat. No gradient, no gloss on the quantity.

   The domain is fixed, not fitted, so the bar means the same width when the
   reader switches matchups - which is the only comparison the hero invites.
   Values past it clamp and say so with an overflow mark rather than quietly
   sitting at the end. */
const HG_DOM = 8;               // 2PP points either side of the tie
const HG_MAX = 340;             // widest the track is allowed to draw

function HeroGauge({ a, ci, color, aName, bName, sepRef }) {
  /* The tie has to sit under the rule between the two figures, or the two
     centres read as a failed alignment. It cannot be done in CSS: the rule's
     position is set by the text either side of it, and those are different
     widths - on the desktop layout "Labor 52.0" is 195px against "48.0
     Coalition" at 219px, putting the rule 11.8px left of the readout's own
     centre. Equalising the two halves would fix that and ragged the left edge
     against the heading above instead, so the instrument moves to the rule.

     Measured off the SEPARATOR and the PARENT, never off the gauge itself:
     this effect sets the gauge's own box, so measuring it would feed the
     output back in and the observer would never settle. Width is then the
     widest span that stays symmetric about the rule, which is what keeps the
     scale honest - a track whose centre is not the tie is a lie about both. */
  const wrapRef = React.useRef(null);
  const [box, setBox] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = wrapRef.current, sep = sepRef && sepRef.current;
    if (!el || !sep || !el.parentElement) return;
    const parent = el.parentElement;
    const align = () => {
      const pr = parent.getBoundingClientRect(), sr = sep.getBoundingClientRect();
      if (!pr.width || !sr.width) return;
      const cx = sr.left - pr.left + sr.width / 2;
      const w = Math.min(HG_MAX, 2 * Math.min(cx, pr.width - cx));
      setBox({ w, ml: cx - w / 2 });
      /* The footer text lines under the gauge are the parent's children,
         not this component's, so the phone rule that centres them on the
         bar consumes the bar's box as custom properties rather than
         re-measuring geometry the gauge already has. */
      parent.style.setProperty("--hg-w", w + "px");
      parent.style.setProperty("--hg-ml", cx - w / 2 + "px");
    };
    align();
    const ro = new ResizeObserver(align);
    ro.observe(parent);
    /* Fonts land after first paint and move every width under this. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
    return () => ro.disconnect();
  }, [aName, bName]);

  /* The mercury does not simply appear on load: it fills from the tie outward
     toward whoever leads, the way the dial's column fills from level. The
     span mounts collapsed on the 50 mark and reaches its real edges on the
     shared settle clock - the same transition the matchup switch slides with.
     Reduced motion mounts it already at extent; there is no pretend state. */
  const [mercSettled, setMercSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    if (mercSettled) return;
    const t = setTimeout(() => setMercSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);

  const dev = a - 50;
  const cl = (v) => Math.max(-HG_DOM, Math.min(HG_DOM, v));
  /* % from the left edge. Decreasing in v, because a Labor lead travels LEFT
     to agree with the readout - so pos(dev + ci) is always the near edge. */
  const pos = (v) => 50 - (cl(v) / HG_DOM) * 50;
  const L = pos(dev + ci), R = pos(dev - ci);
  const overA = dev + ci > HG_DOM;
  const overB = dev - ci < -HG_DOM;
  const lo = (a - ci).toFixed(1), hi = (a + ci).toFixed(1);
  const say = `${aName} ${a.toFixed(1)} per cent two-party preferred, 95% interval ${lo} to ${hi}. `
    + `A tie is 50. ${(a - ci > 50 || a + ci < 50)
         ? "The interval does not include a tie."
         : "The interval includes a tie."}`;
  return (
    /* title as well as aria-label: the track is unlabelled by design, so a
       sighted reader pointing at it gets the same sentence a screen reader does */
    <div className="hero-gauge" role="img" ref={wrapRef} title={say.replace(" per cent", "%")}
         style={box ? { width: box.w + "px", marginLeft: box.ml + "px", maxWidth: "none" } : undefined}
         aria-label={say}>
      <div className="hg-track">
        {[-6, -4, -2, 2, 4, 6].map((t) => (
          <span key={t} className="hg-grad" style={{ left: pos(t) + "%" }} />
        ))}
        <span className="hg-span" style={mercSettled
          ? { left: L + "%", width: (R - L) + "%", background: color }
          : { left: "50%", width: "0%", background: color }} />
        {overA && <span className="hg-over hg-over-a" />}
        {overB && <span className="hg-over hg-over-b" />}
        <span className="hg-tie" />
      </div>
      {/* No labels on the track: the names sit in the readout directly
          above, and the point estimate needs no mark of its own - a symmetric
          interval puts it at the span's midpoint by construction, so a tick
          there restated the bar while cutting it in half. The lead itself is
          the first line under the gauge (hero-lead, in Hero). */}
    </div>
  );
}

/* The hero's per-basis views of the data, built on first use and kept: the
   implied series remapped to the chart's rows, and each poll's pair of
   readings per contest (a WeakMap per accessor, so a poll object is the key
   and the pairs are the same arrays every time they are asked for). */
const HERO_VIEWS = {};
const HERO_PAIRS = {};
function heroPairs(key, fn) {
  const memo = HERO_PAIRS[key] || (HERO_PAIRS[key] = { fn, map: new WeakMap() });
  return (p) => {
    let v = memo.map.get(p);
    if (v === undefined) { v = memo.fn(p); memo.map.set(p, v); }
    return v;
  };
}

function Hero({ rangeId, setRangeId, showScatter = true, matchup, setMatchup, basis, setBasis }) {
  const sepRef = React.useRef(null);   // the rule between the figures; the gauge aligns its tie to it
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const xDomain = rangeDomain(rangeId);

  /* The Labor contests lead, ordered by how well the rival is doing; the
     modelled head-to-heads that do not involve Labor follow.

     A modelled matchup has to earn its place: enough months to show a trend
     rather than a few scattered points, and a recent enough last reading to be
     describing the present. Two points cleared the old bar, which let L/NP v ON
     offer a tab built on four months ending in May – a stale line with no
     nowcast behind the headline. Both tests read off the data, so the matchup
     reappears by itself once the houses start asking it again. */
  const MIN_ALT_MONTHS = 6;
  const MAX_ALT_STALE = 0.26;                      // ~3 months, in decimal years
  const spineEnd = D.agg2pp[D.agg2pp.length - 1].x;
  const hasData = (id) => {
    const d = MATCHUPS[id].data;
    if (MATCHUPS[id].real) return d.length >= 2;
    return d.length >= MIN_ALT_MONTHS && spineEnd - d[d.length - 1].x <= MAX_ALT_STALE;
  };
  const oppVsLabor = (id) => {
    const last = MATCHUPS[id].data[MATCHUPS[id].data.length - 1];
    return last.b; // opponent's share in the Labor head-to-head
  };
  /* The classic pairing used to be pinned first whatever the numbers said.
     It is not any more: the Labor contests are ordered by how well the rival
     is doing, strongest first, with latest.rivalLead breaking the top spot so
     the hero's own default and this list can never disagree. */
  const rivalFirst = (D.latest && D.latest.rivalLead) || "alp_lnp";
  const vsLabor = Object.keys(MATCHUPS).filter((id) => MATCHUPS[id].vsLabor && hasData(id))
    .sort((x, y) => (x === rivalFirst ? -1 : y === rivalFirst ? 1 : oppVsLabor(y) - oppVsLabor(x)));
  const orderedMatchups = [
    ...vsLabor,
    ...Object.keys(MATCHUPS).filter((id) => !MATCHUPS[id].vsLabor && hasData(id)),
  ];
  /* rangeDomain takes any month count, and buildXTicks already labels
     every month once the span is under a year, so six months arrives
     with its own tick per month rather than every second one */
  const rangeOptions = [{ id: "3", label: "3mo" }, { id: "6", label: "6mo" },
                        { id: "12", label: "12mo" }, { id: "all", label: "All" }];

  /* The selected matchup arrives as a prop: App owns it, so the docked
     tab-bar score can follow it and it survives the Snapshot tab unmounting
     this hero entirely. `matchup` / `setMatchup` are used below exactly as
     the old local state was. */
  /* Switching matchup is a MORPH, not a swap. The same two lines reshape into
     the other pair, the rival's colour travels round the hue circle, the
     headline digits roll, and the two dot clouds cross over - so the second
     matchup reads as the first one rearranged, and switching back rearranges
     it home. 320ms with an ease-out: far enough to follow, short enough that
     nobody is kept waiting for a number they can already read, since the value
     itself is correct from the first frame and only its digits are in motion. */
  const MORPH_MS = window.AP.MORPH_MS;
  /* A phone column renders the wide desktop viewBox about 150px tall; the
     trend needs vertical room more than it needs a familiar aspect ratio. */
  const narrow = useNarrow();
  const [morph, setMorph] = useState(null);        // { from, to, fromBasis, toBasis, fromDomain, t }
  const morphRaf = useRef(0);
  /* One morph state drives BOTH switchers: a matchup switch lerps between
     two matchups' series at the current basis, a basis switch lerps between
     the two bases' series of the SAME matchup (fromBasis -> toBasis, from/to
     both the current matchup id, fromDomain seeded from whatever window is
     on screen so interrupting a morph keeps the glide continuous). The
     flipped-state invariant applies to the basis fields exactly as it does
     to from/to: state has ALREADY flipped when the frames render, so every
     from-scene read must name its basis explicitly. */
  /* The basis our two "real-question" contests are displayed on, owned in
     App and handed down: "imp" = implied preference flows (every poll's
     primaries through one fixed flow table; the site's DEFAULT on both
     contests), "resp" = the houses' own published respondent-allocated
     figures. ALP v L/NP uses the counted AEC-2025 table (D.synthLatest /
     synth2pp); ALP v ON uses gen-data's first-principles ALP–ON set
     (D.latest.onImp / synthOn), since no count of that pairing exists to
     tie it to. It re-points data, cloud, readout, interval and the
     comparison overlay together (impBasis / impOnBasis below); LNP v ON
     stays single-basis. The comparison the checkbox draws is then always
     "the OTHER basis" (showSynth), dashed. */
  const impOffered = D.synthLatest && D.synthLatest.alp != null && D.synth2pp && D.synth2pp.length > 1;
  const impBasis = impOffered && basis === "imp" && matchup === "alp_lnp";
  const impOnOffered = D.synthOn && D.synthOn.length > 1 && !!D.latest.onImp;
  const impOnBasis = impOnOffered && basis === "imp" && matchup === "alp_on";
  const [showSynth, setShowSynth] = useState(false);
  React.useEffect(() => () => { cancelAnimationFrame(morphRaf.current); }, []);
  /* The month clause's caveat shows "the margin" until the note no longer
     fits beside the delta chip - then, and only then, it shortens to
     "margin". Measured, not breakpointed: the wrap point depends on the
     delta figure's width, the caveat's presence and the loaded font, none
     of which a media query can know. Restores the full wording once the row
     is wider than the last width that overflowed. The note is a nowrap
     unit, so its top clearing the chip's bottom is what wrapped means. */
  const subRef = React.useRef(null);
  const subNoteRef = React.useRef(null);
  const subOverW = React.useRef(0);
  const [subTight, setSubTight] = useState(false);
  const subRecheck = () => {
    const row = subRef.current, note = subNoteRef.current;
    if (!row || !note) return;
    const chip = row.firstElementChild;
    if (chip && note.offsetTop > chip.offsetTop + chip.offsetHeight) {
      subOverW.current = row.clientWidth;
      setSubTight(true);
    } else if (row.clientWidth > subOverW.current) {
      setSubTight(false);
    }
  };
  React.useEffect(subRecheck);
  React.useEffect(() => {
    const row = subRef.current;
    if (!row) return;
    const ro = new ResizeObserver(subRecheck);
    ro.observe(row);
    let live = true;
    const fontsDone = () => { if (live) subRecheck(); };
    if (document.fonts) {
      document.fonts.ready.then(fontsDone);
      document.fonts.addEventListener("loadingdone", fontsDone);
    }
    return () => {
      live = false;
      ro.disconnect();
      if (document.fonts) document.fonts.removeEventListener("loadingdone", fontsDone);
    };
  }, []);
  /* Both switches run on the shared clock (AP.morphClock): the press's own
     render already carries a frame of motion, and each frame after it is
     drawn inside its animation frame. `liveMorph` is the morph on screen, so
     a second press can take over from wherever the first one had got to: the
     same switch pressed straight back reverses from that point (a blend of A
     into B at t is B into A at 1 - t, so nothing jumps), and any other takes
     the window from where it is on screen. */
  const liveMorph = useRef(null);
  const shownDomain = useRef(null);         // the y window on screen, whichever design drew it
  const putMorph = (m) => { liveMorph.current = m; setMorph(m); };
  const runMorph = (make, resume) => {
    const c = window.AP.morphClock(morphRaf, (t) => putMorph(make(t)), () => putMorph(null), resume);
    putMorph(make(c.t));
  };
  const chooseMatchup = (id) => {
    const from = matchup, cur = liveMorph.current;
    setMatchup(id);
    cancelAnimationFrame(morphRaf.current);
    if (id === from || window.AP.reduceMotion() || !MATCHUPS[from] || !MATCHUPS[id]) { putMorph(null); return; }
    const back = !!cur && !cur.fromBasis && cur.from === id && cur.to === from;
    const fromDomain = cur && !back ? shownDomain.current : null;
    runMorph((t) => ({ from, to: id, fromDomain, t }), back ? window.AP.morphRawOf(1 - cur.t) : 0);
  };
  /* A basis flip IS the matchup morph, confined to one matchup: the implied
     and published lines reshape into each other point-for-point on the
     shared month grid, the poll dots travel between the two readings of the
     same fieldwork, and the window glides between the two auto-fits - the
     labels keep their destination VALUES and only positions travel. The
     morph carries both bases because the basis state has already flipped
     when the frames render. */
  const chooseBasis = () => {
    const bFrom = basis || "imp", bTo = bFrom === "imp" ? "resp" : "imp", cur = liveMorph.current;
    setBasis(bTo);
    cancelAnimationFrame(morphRaf.current);                // a morph, if running, hands over
    if (window.AP.reduceMotion()) { putMorph(null); return; }
    const back = !!cur && cur.fromBasis === bTo && cur.toBasis === bFrom && cur.from === matchup && cur.to === matchup;
    const fromDomain = cur && !back ? shownDomain.current : null;
    runMorph((t) => ({ from: matchup, to: matchup, fromBasis: bFrom, toBasis: bTo, fromDomain, t }),
             back ? window.AP.morphRawOf(1 - cur.t) : 0);
  };

  /* The basis-COMPARISON switch has ONE home, beneath the chart legend, on
     every width. What "other" means flips with the basis: on
     respondent-allocated it draws the implied shadow, on implied it draws
     the houses' own published figures. */
  const cmpCopy = matchup === "alp_on"
    ? (impOnBasis
        ? { term: "published head-to-head", termId: "weighted-aggregate", termTip: "What a weighted aggregate means",
            tip: "Also draw the pollsters’ own published Labor v One Nation figures, each house’s allocation as filed. The complement of the basis above." }
        : { term: "implied 2PP", termId: "preference-flows", termTip: "How preference flows turn primary votes into a two-candidate figure",
            tip: "Also draw what the same polls’ primary votes imply when run through the site’s fixed ALP–ON flow set – calibrated from preference counts, not anchored to an election result, because no count of this pairing exists. A diagnostic, not a correction." })
    : (impBasis
        ? { term: "published 2PP", termId: "weighted-aggregate", termTip: "What a weighted aggregate means",
            tip: "Also draw the same polls’ own published two-party figures (respondent-allocated or equivalent), each house’s allocation as filed. The complement of the basis above." }
        : { term: "implied 2PP", termId: "implied-2pp", termTip: "What an implied two-party figure is",
            tip: "Also draw what the same polls’ primary votes imply when run through one fixed preference-flow table (the 2025 election’s actual flows), shaded to the 2022 table’s read of the One Nation conversion. A diagnostic, not a correction." });
  const compareToggle = () => (
    <label className={"pg-check" + (showSynth ? " on" : "")}
           title={cmpCopy.tip}>
      <input type="checkbox" checked={showSynth} onChange={(e) => setShowSynth(e.target.checked)} />
      {/* the label is a flex row with a 6px gap, so a loose text node and the
          term button would become two flex ITEMS with 6px between them - a
          word space that reads double-spaced. One span = one flex item, and
          the words run inline at a real word space inside it. */}
      <span>Compare <button type="button" className="hi-term"
              title={cmpCopy.termTip}
              onClick={(e) => { e.preventDefault();
                window.AP.openTerm && window.AP.openTerm(cmpCopy.termId, "two-party preferred"); }}>
        {cmpCopy.term}
      </button></span>
    </label>
  );

  const m = MATCHUPS[matchup];
  /* The BASIS re-point, one place. On the implied basis the classic
     contest's chart data becomes synth2pp's monthly points (labor/coalition
     shares, its own ci95) and its poll cloud becomes each wave's OWN implied
     figure (alpImp, emitted under impShow's display rule – a documented
     primary-sum anomaly shows rebased to 100, an undocumented sum failure
     emits no dot at all, and the implied estimator's rows stay impOk's
     clean waves) – so "two charts with different sets of points" is a data
     swap here, not a second chart component. Everything measure-shaped
     below takes iDataOf/iScatOf rather than the matchup's own entries.
     impData is computed whenever the basis is imp at all – NOT only while
     the classic contest is the one on screen – so a morph AWAY from it
     still leaves on the implied line it was set in. impDataFor(b) computes
     the same view for a NAMED basis: a morph's from-scene reads pass
     morph.fromBasis, because the state has already flipped to the
     destination when every frame renders. */
  /* Built once and kept (HERO_VIEWS): a morph reads these on every frame,
     for both scenes, and remapping the series and every poll's pair each
     time was a third of a phone's frame. The data never changes under the
     page. */
  const impDataFor = (b) => (impOffered && (b === undefined ? basis : b) === "imp")
    ? (HERO_VIEWS.imp || (HERO_VIEWS.imp = D.synth2pp.map((d) => ({ ym: d.ym, x: d.x, a: d.alp, b: d.lnp, ci95: d.ci95, k: d.k }))))
    : null;
  const impData = impDataFor();
  const impScatter = heroPairs("imp", (p) => (p.alpImp == null ? null : [
    { y: p.alpImp, color: "var(--alp)", label: "ALP implied" },
    { y: +(100 - p.alpImp).toFixed(1), color: "var(--lnp)", label: "L/NP implied" },
  ]));
  /* The ALP–ON contest gets the same swap from its own payload: synthOn's
     monthly points are ALREADY {ym,x,a,b,ci95,k} (no remap needed), and its
     per-wave implied dot is alpOnImp. ci95 there is the frozen flow table's
     RANGE, not a sampling interval. Gated like impData, NOT on impOnBasis:
     matchup has already flipped when a morph AWAY from this contest renders,
     so a matchup-gated impOnData would vanish mid-morph - ptsOf/domainOf see
     the published series from frame zero and the y-window never travels. */
  const impOnDataFor = (b) => (impOnOffered && (b === undefined ? basis : b) === "imp")
    ? (HERO_VIEWS.impOn || (HERO_VIEWS.impOn = D.synthOn.map((d) => ({ ym: d.ym, x: d.x, a: d.a, b: d.b, ci95: d.ci95, k: d.k }))))
    : null;
  const impOnData = impOnDataFor();
  const impOnScatter = heroPairs("impOn", (p) => (p.alpOnImp == null ? null : [
    { y: p.alpOnImp, color: "var(--alp)", label: "ALP implied" },
    { y: +(100 - p.alpOnImp).toFixed(1), color: "var(--onp)", label: "ON implied" },
  ]));
  const iDataOf = (id, b) => {
    const imp = (id === "alp_lnp" && impDataFor(b)) || (id === "alp_on" && impOnDataFor(b));
    return imp || MATCHUPS[id].data;
  };
  const iScatOf = (id, b) => {
    const imp = (id === "alp_lnp" && impDataFor(b)) || (id === "alp_on" && impOnDataFor(b));
    return imp ? (id === "alp_on" ? impOnScatter : impScatter) : heroPairs(id, MATCHUPS[id].scatter);
  };
  const ptsOf = (id, b) => filterPts(iDataOf(id, b), xDomain[0]);
  const pts = ptsOf(matchup);
  /* Both matchups on ONE grid of months, each holding its own end value across
     the months the other one runs for - so the two paths carry the same shape
     of command and can be interpolated point for point. The stretch a matchup
     was never asked in is never SEEN: the clip window travels with the morph,
     so the line retreats to where the question was actually put, and grows
     back out when you switch away. */
  const rdOn = !!window.AP.rd;            // the redesign draws its own chart from the accessors
  const blend = (() => {
    if (!morph || rdOn) return null;
    // each scene is drawn on ITS basis: a matchup morph reads the current
    // basis both ways (fromBasis undefined → same scene), a basis flip
    // pins from/to to their own bases while from/to matchup ids coincide
    const A = ptsOf(morph.from, morph.fromBasis), B = ptsOf(morph.to, morph.toBasis);
    if (!A.length || !B.length) return null;
    const t = morph.t;
    /* The shared blend (AP.blendRows), as the redesign's hero uses: both
       lines read off the curves they are drawn with between the months, and
       the interval as a soft key with its own edges, so the band grows from
       or closes onto its line where one side has none. Held month by month
       here, a gap month bent the line and a month one side had no interval
       for dropped its band piece, and the switch landed with a 15px jump. */
    const bl = window.AP.blendRows(A, B, t, ["a", "b", "ci95"]);
    if (!bl) return null;
    return {
      pts: bl.rows,
      clip: bl.clip,
      a: mixC(MATCHUPS[morph.from].a.color, MATCHUPS[morph.to].a.color, t),
      b: mixC(MATCHUPS[morph.from].b.color, MATCHUPS[morph.to].b.color, t),
    };
  })();
  /* mid-switch the blend carries readings between the months (`mid`), drawn
     for the curve; the spine and the readout go by whole months */
  const drawRows = blend ? blend.pts : pts;
  const drawPts = blend ? blend.pts.filter((d) => !d.mid) : pts;
  const colA = blend ? blend.a : m.a.color;
  const colB = blend ? blend.b : m.b.color;
  // Headline readout: for the REAL ALP v L/NP measure this is the trailing
  // recency- + sample-weighted, house-effect-adjusted nowcast (D.latest) –
  // the same figure docked in the sticky tab bar – NOT the last monthly-mean
  // dot, so the two never disagree. The smoothed chart line stays the monthly
  // trend; a small gap between the line's end and this number is expected (a
  // nowcast leads the monthly mean). Modelled matchups have no separate
  // headline, so they read their last plotted point.
  // An alternative matchup gets a nowcast too WHERE the series supports one
  // (D.altLatest is null for a matchup too thin to weight). Otherwise it reads
  // its last monthly point, as before.
  /* The current figure for ANY matchup, headline or not – ONE accessor, so a
     chip below can never disagree with the readout above when it is that
     matchup's turn to be the headline. Module-scope tppLatest, so the docked
     tab-bar score reads it too; `basis` carries to the ALP v L/NP fight. */
  const latestOf = (id) => tppLatest(id, basis);
  /* Every contest that isn't the one on the chart, in the same order the tabs
     use, and only where there is a current figure to print – a chip with no
     number would be the bare tab it is replacing. */
  const otherContests = orderedMatchups
    .filter((id) => id !== matchup)
    .map((id) => ({ id, v: latestOf(id) }))
    .filter((o) => o.v && o.v.a != null);
  const altL = (m.altKey && D.altLatest) ? D.altLatest[m.altKey] : null;
  /* ALP v ON when the implied BASIS is active: the first-principles flow
     estimate is the quoted figure, the published nowcast merely its
     corroboration (see tppLatest). Gated on impOnBasis so a flip to
     respondent-allocated drops the implied level out of latest/unc/
     monthDelta at once – the published head-to-head (altL) takes over.
     rides `flows` so the interval copy says "flows range" rather than
     "95% interval". */
  const onImpL = (m.altKey === "alp_on" && D.latest.onImp && impOnBasis) ? D.latest.onImp : null;
  const adjusted = m.real || !!onImpL || !!(D.adjusted && m.altKey && D.adjusted[m.altKey]);
  const latest = m.real
    ? (impBasis && D.synthLatest
        ? { a: D.synthLatest.alp, b: D.synthLatest.lnp }
        : { a: D.latest.alp2pp, b: D.latest.lnp2pp })
    : onImpL || altL || m.data[m.data.length - 1];

  // mirrored pairs, so each trend line sits inside its own cloud of readings.
  // Driven by the active matchup's own accessor – a poll that didn't publish
  // THIS head-to-head is simply skipped, which is why the ON matchups show
  // fewer dots rather than none.
  const cloudFor = (id, b) => (!showScatter ? [] : D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => {
      const pair = iScatOf(id, b)(p);
      // `side` 0 is the Labor-side reading and 1 the rival's – with the poll's
      // own identity, that is how a dot recognises itself in the other matchup
      return pair ? pair.map((s, side) => ({ x: p.x, y: s.y, color: s.color, label: s.label, meta: p, side })) : [];
    }));
  // memoised on what actually changes them: a morph frame must not rebuild
  // 240 dots sixty times a second (see the chart's own memo on the same arrays)
  const settledCloud = React.useMemo(() => (rdOn ? [] : cloudFor(matchup)), [matchup, rangeId, showScatter, basis, rdOn]);

  /* The cloud morphs the way the lines do. A poll that published BOTH matchups
     is one reading of the same fieldwork asked two ways – Newspoll's 51.4
     against the Coalition and 53.8 against One Nation are the same poll – so
     its dot travels between them and its colour goes round the hue circle with
     the line above it. A poll that only ever answered one of the questions has
     nowhere to travel to, so it fades: 74 of the 119 two-party polls never had
     the One Nation matchup put to them, and inventing a position for them
     would be drawing data nobody collected.

     Split three ways so only the travelling group is rebuilt per frame. */
  const morphClouds = React.useMemo(() => {
    if (!morph || rdOn) return null;
    const key = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.side;
    const A = cloudFor(morph.from, morph.fromBasis), B = cloudFor(morph.to, morph.toBasis);
    const ia = new Map(A.map((d) => [key(d), d])), ib = new Map(B.map((d) => [key(d), d]));
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return { travel, leaving, arriving };
  }, [morph ? morph.from : null, morph ? morph.to : null,
      morph ? morph.fromBasis : null, morph ? morph.toBasis : null,
      rangeId, showScatter, basis, rdOn]);

  const scatter = morphClouds ? morphClouds.arriving : settledCloud;
  const scatterOut = morphClouds ? morphClouds.leaving : [];
  const scatterMove = !morphClouds ? [] : morphClouds.travel.map(([a, b]) => ({
    // same poll, same fieldwork, so only the reading and its colour move
    x: a.x, y: a.y + (b.y - a.y) * morph.t,
    color: mixC(a.color, b.color, morph.t), label: b.label, meta: b.meta,
  }));
  // how many polls are actually behind the cloud – stated in the caption, since
  // "9 houses ask this" is the honest caveat on a thinner matchup
  const scatterPolls = settledCloud.length / 2;

  // A trend line through four monthly means built on five polls from two houses
  // is a shape the data can't support – it reads as a trajectory when it's
  // really noise. Where the series is too thin to weight, plot the readings
  // only and let the reader see the scatter for what it is.
  const heroSeries = !adjusted ? [] : [
    { id: "a", label: m.a.name, color: colA, points: series(drawRows, "a"), width: 3.6, endLabel: m.a.abbr },
    { id: "b", label: m.b.name, color: colB, points: series(drawRows, "b"), width: 3.6, endLabel: m.b.abbr },
  ];
  /* The compare overlay is the OTHER basis: by default (implied) the dashed
     line is the published-basis aggregate, gen-data's agg2pp; on the
     respondent-allocated basis it is the implied series, computed from
     primaries, not measured. Same red as the solid Labor line – colour still
     says who; the dash says this one is the basis the chart is NOT on –
     because the visible GAP between the bases is the whole point of the
     diagnostic. The implied election-month point meets the published anchor
     exactly: under the shipped TPP table the anchor is the table's OWN
     count read back, so agreement there is consistency, not accuracy.
     ALP v ON carries the same pair off its own payloads: the published
     head-to-head aggregate (alt2pp.alp_on) and the implied synthOn line.
     The overlay plots the Labor share of whichever basis is NOT active. */
  const cmpSeries = m.altKey === "alp_on"
    ? (impOnBasis ? MATCHUPS.alp_on.data : D.synthOn)
    : (impBasis ? D.agg2pp : D.synth2pp);
  const cmpLabel = m.altKey === "alp_on"
    ? (impOnBasis ? "Respondent-allocated ALP" : "Implied ALP (first-principles flows)")
    : (impBasis ? "Respondent-allocated ALP" : "Implied ALP (fixed 2025 flows)");
  const synthOverlay = (showSynth && (matchup === "alp_lnp" || (m.altKey === "alp_on" && impOnOffered)) &&
      !morph && cmpSeries && cmpSeries.length > 1)
    ? [{ id: "synth", label: cmpLabel, color: "var(--alp)",
         points: filterPts(cmpSeries.map((d) => ({ x: d.x, y: d.alp != null ? d.alp : d.a })), xDomain[0]),
         width: 2.2, dashed: true, opacity: 0.8 }]
    : [];
  /* The implied overlay's sensitivity bracket (gen-data §1c → D.flowSens):
     the same primaries re-read with the ONP-to-Labor share at the 2022
     election's counted table instead of 2025's, so the shade between its
     edges is what the One Nation conversion is worth at each month's ONP
     primary. Both edges are measured tables, so it is a sensitivity read,
     not an interval – and it never draws without the dashed line it
     brackets, switched by the same compare toggle. Classic pairing only:
     the ALP–ON implied line has its own flow-table band, no second table
     to bracket it. */
  const sensAreas = (synthOverlay.length && matchup === "alp_lnp" && D.flowSens && D.flowSens.length > 1)
    ? [{ id: "sens", color: "var(--alp)", className: "sens-band", edge: false, smooth: true,
         points: filterPts(D.flowSens.map((d) => ({ x: d.x, y0: d.lo, y1: d.hi })), xDomain[0]) }]
    : [];
  const heroSeriesAll = synthOverlay.length ? heroSeries.concat(synthOverlay) : heroSeries;
  // with no line there is nothing for a month-guide tooltip to report, so the
  // guide is switched off and the dots carry their own hovers
  const heroSpine = heroSeries.length ? series(drawPts, "a") : [];

  /* The interval, drawn. The headline above says +/- 1.8 points and refuses to
     call a month-on-month move real unless it clears that; the chart used to
     answer with a 3.6px line placed to a tenth of a point, which is the more
     persuasive object and was making the weaker claim look like the settled
     one. Both series get a ribbon: they are exact complements, so the two are
     mirror images, and where they OVERLAP the interval covers 50 - the months
     in which the lead cannot be told apart from a tie. That overlap is the
     single most useful thing on this chart and it is not otherwise drawn.
     No ribbon where there is no line, for the same reason there is no line. */
  /* Mid-switch the band is the line plus and minus the interval at every
     row the blend reads, the months and the readings between them. This
     design draws with a Catmull-Rom spline, which is linear in its values,
     so the curve through line +/- interval IS the line's curve +/- the
     interval's: at either end of the switch this is the band that view
     draws, down to its taper into the election point at no width. (The
     redesign's monotone curve is not linear, which is why it reads the
     edges off curves of their own.) */
  const bandPts = (key) => drawRows.filter((d) => d.ci95 != null)
    .map((d) => ({ x: d.x, y0: d[key] - d.ci95, y1: d[key] + d.ci95 }));
  const heroAreas = !heroSeries.length ? [] : [
    /* no window of their own: this design's band runs from the election
       point at no width, as the line does, so it travels in the line's window
       (the chart's clipX) - clipped to where the interval is wider than zero,
       it lost its first month for the switch and grew it back on landing */
    { id: "ci-a", color: colA, className: "ci-band", edge: false, smooth: true, points: bandPts("a") },
    { id: "ci-b", color: colB, className: "ci-band", edge: false, smooth: true, points: bandPts("b") },
  ].filter((a) => a.points.length >= 2);

  // Major events, clipped to the span this matchup actually plots. The headline
  // 2PP runs the whole archive so it keeps all of them; ALP v ON only begins
  // when pollsters started asking it, and a marker standing over a stretch with
  // no line would imply a reading that was never taken. A matchup with no trend
  // line at all gets none.
  // Each matchup also keeps its own change-of-hands: the Coalition leader's
  // handover belongs to the ALP v L/NP chart, and the defection that made One
  // Nation the other contest belongs to ALP v ON. Neither is major - a
  // major marker draws on every chart it spans, and Joyce's move is not the
  // L/NP chart's story any more than Taylor's promotion is the ON chart's.
  // Pulled from the dataset BY DATE (the same discipline eventOn() keeps in
  // the leadership panels), so the marker and its panel can't drift from the
  // event rail; restating one here would fork the copy.
  /* Each matchup's markers over the months it plots. Mid-switch the chart
     is handed both sets and slides one into the other (TrendChart's
     eventsFrom, as the redesign's hero does): the departed matchup's markers
     used to ride the blend out and the destination's to land with the last
     frame, a Coalition marker swapped for a One Nation one in a single frame
     as the lines settled. */
  const eventsFor = (id, basis) => {
    const P = id === matchup && basis === undefined ? pts : ptsOf(id, basis);
    if (!P.length) return [];
    const x0 = P[0].x, x1 = P[P.length - 1].x;
    const own = { alp_lnp: "2026-02-12", alp_on: "2025-12-08" }[id];
    return (D.events || []).filter((e) => (e.major || e.date === own) && e.x >= x0 && e.x <= x1);
  };
  const heroEvents = (!heroSeries.length || !pts.length) ? [] : morph ? eventsFor(morph.to, morph.toBasis) : eventsFor(matchup);
  const heroEventsFrom = morph && heroSeries.length && pts.length ? eventsFor(morph.from, morph.fromBasis) : null;

  /* One word, and not "50% – majority line". The axis already prints 50% 18px
     to the left, so the number was said twice in adjacent space; and 50 is a
     tie in the national two-party vote, NOT the point at which a party wins a
     majority of seats - Labor took 51.0% of the 2PP in 1998 and lost. This
     tracker keeps vote share and seats apart everywhere else (it carries its
     own seat projection), so the label shouldn't quietly read one off the
     other. "tie" is also what the past-cycles 2PP chart calls the same line,
     and what the approval charts mean by "even".

     Labelled at the LEFT edge: the right edge is where both trend lines
     terminate and their end-cap dots sit, so a label there landed in the
     busiest part of the chart. The left edge is empty in every matchup. */
  const heroRefLines = [{ y: 50, label: "tie", color: "var(--ink-faint)", align: "left" }];

  // y-window auto-fits everything actually drawn – min/max across BOTH
  // series (so the domain stays correct even if the challenger ever takes
  // the lead), their 95% band, and the poll cloud around them, plus the
  // implied-2PP overlay on the real matchup. The cloud matters: the chart's
  // vertical clip is the svg, not the domain, so a window fitted to the
  // lines alone would strand outlying polls outside the plot. The pad is a
  // live dot's radius in data units, so an extreme reading isn't shaved.
  const domainOf = (id, b) => {
    const M = MATCHUPS[id], v = [];
    iDataOf(id, b).forEach((d) => {
      v.push(d.a, d.b);
      if (d.ci95 != null) v.push(d.a - d.ci95, d.a + d.ci95, d.b - d.ci95, d.b + d.ci95);
    });
    D.individualPolls.forEach((p) => {
      const pair = iScatOf(id, b)(p);
      if (pair) pair.forEach((s) => v.push(s.y));
    });
    // whichever series the compare overlay draws rides the same window, or
    // switching it on would climb out of the window it drew in
    if (M.real && D.synth2pp) D.synth2pp.forEach((d) => v.push(d.alp, 100 - d.alp));
    if (M.real && D.agg2pp) D.agg2pp.forEach((d) => v.push(d.alp, 100 - d.alp));
    // the sensitivity bracket too, which brackets the implied series
    if (M.real && D.flowSens) D.flowSens.forEach((d) => v.push(d.lo, d.hi, 100 - d.lo, 100 - d.hi));
    const lo = Math.min(...v), hi = Math.max(...v), padDot = 0.5;
    return [Math.floor((lo - padDot) / 5) * 5, Math.ceil((hi + padDot) / 5) * 5];
  };
  const yTarget = rdOn ? [0, 100] : domainOf(matchup);
  // ticks come from the TARGET window so their number holds still while the
  // window itself slides; today the Labor matchups share 40–60 and nothing moves
  const yDomain = blend
    ? (() => { // a morph that took over from another carries the window that
               // was on screen, which a recomputed from-domain would not equal
               const f = morph.fromDomain || domainOf(morph.from, morph.fromBasis), t = morph.t;
               return [f[0] + (yTarget[0] - f[0]) * t, f[1] + (yTarget[1] - f[1]) * t]; })()
    : yTarget;
  if (!rdOn) shownDomain.current = yDomain;
  const yTicks = [];
  for (let v = yTarget[0]; v <= yTarget[1]; v += 5) if (v > yTarget[0] && v < yTarget[1]) yTicks.push(v);
  const lead = +(latest.a - latest.b).toFixed(1);
  const leadName = lead >= 0 ? m.a.name : m.b.name;
  /* Swing is quoted against the one 2PP baseline there is: the election
     anchor gen-data unshifts onto agg2pp (election: true row, the official
     count). Only the real ALP v L/NP pairing has that count - the modelled
     matchups get no swing clause. */
  const leadAnchor = matchup === "alp_lnp" ? D.agg2pp.filter((d) => d.election)[0] : null;
  const leadSwing = leadAnchor ? +(latest.a - leadAnchor.alp).toFixed(1) : null;
  /* Uncertainty for whichever matchup is showing. Every nowcast on this hero
     is a weighted mean of a handful of polls, so none of them is exact – a
     matchup that switched from an interval to a bare number would read as the
     precise one. Null only where the series is too thin to nowcast at all,
     in which case the readout is a plain monthly point and says so. */
  const unc = m.real
    ? (impBasis
        ? (D.synthLatest.ci95 != null
            ? { ci95: D.synthLatest.ci95, n: D.synthLatest.n, changeSig: D.synthLatest.changeSig }
            : null)
        : (D.latest.alp2ppCi95 != null
            ? { ci95: D.latest.alp2ppCi95, n: D.latest.method.nPolls, changeSig: D.latest.changeSig }
            : null))
    : (onImpL
        /* ci95 stays the frozen table's flow range (flows:true makes the
           readout say so). changeSig rides alongside it because the change
           is a different question from the level: the same frozen table at
           both dates cancels out of the difference, leaving sampling error
           the pairing can actually be tested on. Undefined when the window
           is too thin, which reads as "make no claim", as everywhere else. */
        ? { ci95: onImpL.band, n: onImpL.n, flows: true, changeSig: onImpL.changeSig }
        : (altL && altL.ci95 != null
            ? { ci95: altL.ci95, n: altL.n, changeSig: altL.changeSig }
            : null));
  const monthDelta = m.real
    ? (impBasis
        ? +(D.synthLatest.alp - (D.synthLatest.prev ?? D.latest.alp2ppPrev)).toFixed(1)
        : +(D.latest.alp2pp - D.latest.alp2ppPrev).toFixed(1))
    : (onImpL && onImpL.aPrev != null) ? +(onImpL.a - onImpL.aPrev).toFixed(1)
    : (altL && altL.aPrev != null) ? +(altL.a - altL.aPrev).toFixed(1)
    : +(latest.a - m.data[m.data.length - 2].a).toFixed(1);

  /* The evidence strip is one clause and must read on ONE line: on a phone
     the words shrink before they may wrap. The fitter walks the strip's
     font size down from the 12px ceiling in half-pixel steps until the
     line's true width fits its row (8px floor; the wrappable count clause
     is the designed fallback under it), publishing the settled size as
     --hi-fs for the strip's font rules - the dot separators consume the
     same var, so the line scales as one. It ITERATES rather than
     predicting from a single 12px measurement: measured width does not
     scale perfectly with font size, so a one-shot prediction can land a
     half-step wide and, with no further render or resize to re-enter fit,
     stay there (seen live on the phone-width implied line, marooned a
     half-step over its row). Each fit starts at the ceiling again: a row
     that widens must be allowed to grow back, and a stale shrunken value
     would measure itself. The width is only honest while nothing may fold,
     so the pass runs under .hi-fitting, which pins the wrappable clause to
     nowrap - a clause free to wrap reports its folded width and the fitter
     would never see the overflow it exists to fix. No dependency list -
     the clause's words change with the matchup in ways no list could name,
     so re-fit after every render; a settled strip lands the loop's first
     measurement and writes nothing. Measured off the strip, observed on
     its PARENT: writing --hi-fs never moves the strip's own box, so the
     observer cannot chase its own tail. */
  const hiRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = hiRef.current;
    if (!el || !el.parentElement) return;
    const fit = () => {
      const setFs = (v) => {
        const s = v + "px";
        if (el.style.getPropertyValue("--hi-fs") !== s)
          el.style.setProperty("--hi-fs", s);
      };
      el.classList.add("hi-fitting");
      let fs = 12;
      setFs(fs);
      for (let i = 0; i < 6; i++) {
        /* True content width, fractionally: first child box's left edge to
           the last child's right. scrollWidth CANNOT be trusted here - it
           rounds to whole pixels, so a line a hair over its row reads as
           exactly-fitting and flex wraps it anyway (the live marooned-wrap
           case). */
        const kids = el.children;
        const contentW = kids.length
          ? kids[kids.length - 1].getBoundingClientRect().right -
            kids[0].getBoundingClientRect().left
          : 0;
        if (contentW <= el.clientWidth - 0.5) break;
        const next = Math.max(8, Math.floor((fs * el.clientWidth / Math.max(contentW, 1)) * 2) / 2);
        if (next >= fs) break;
        fs = next;
        setFs(fs);
      }
      el.classList.remove("hi-fitting");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    return () => ro.disconnect();
  });

  /* The redesign draws its own layout from the same state and machinery:
     both switches, the morph clock and the accessors are passed down, so a
     contest or basis flip animates exactly as it does here. */
  if (window.AP.rd) return (
    <RdHero rangeId={rangeId} setRangeId={setRangeId} matchup={matchup} basis={basis} morph={morph}
      chooseMatchup={chooseMatchup} chooseBasis={chooseBasis} orderedMatchups={orderedMatchups}
      latest={latest} unc={unc} monthDelta={monthDelta} leadSwing={leadSwing}
      impOffered={impOffered} impOnOffered={impOnOffered} impBasis={impBasis} impOnBasis={impOnBasis}
      adjusted={adjusted} iDataOf={iDataOf} iScatOf={iScatOf} showScatter={showScatter}
      showSynth={showSynth} setShowSynth={setShowSynth} otherContests={otherContests} xDomain={xDomain}
      domainRef={shownDomain} />
  );
  return (
    <section className="card hero">
      <div className="hero-top">
        <div className="hero-headline">
        {/* Labels the METHOD behind the number above, on one dimension. A
            matchup earns "weighted aggregate" when its own house effects are
            estimable (ALP v L/NP and ALP v ON both are); one that only two
            houses ask can't be debiased or nowcast, so it says so. */}
        <h2 className="card-title hero-title">Two-party preferred</h2>
        {/* Which measure of 2PP the readout, line and cloud show. The pairings
            that HAVE two measures (ALP v L/NP, and ALP v ON) get one toggle
            button: it names the ACTIVE basis in a sentence ("Using …") and a
            press flips to the other – the pollsters' own respondent-allocated
            figure, or the implied figure the site's fixed 2025 flow table
            reads off the primary-vote aggregate. Implied is the default – it
            uses every poll that publishes primaries, not just the ones that
            publish a 2PP, and it is the figure the share card carries. For
            ALP v ON the implied level is first-principles (no election count
            of the pairing exists), and its "respondent-allocated" side is the
            pollsters' published head-to-head. When a matchup without a
            second basis is selected the button simply withdraws. */}
        {((m.real && impOffered) || (m.altKey === "alp_on" && impOnOffered)) && (
          <div className="hero-basis">
            <button type="button" className="hb-toggle"
              aria-label={"Switch two-party preferred basis – currently using " +
                ((basis || "imp") === "imp" ? "implied preference flows" : "respondent-allocated preferences only")}
              onClick={chooseBasis}>
              Using <span className="hb-what">{(basis || "imp") === "imp" ? "implied preference flows" : "respondent-allocated preferences only"}</span>
              {(basis || "imp") === "imp" ? " (default)" : ""}
            </button>
            {/* The "?" after the sentence is the way OUT to the whole story:
                a plain link to the /preference-flows/ explainer page, so the
                toggle keeps its one sentence and the deeper case keeps its
                own address (and tab). */}
            <a className="hb-q" href="/preference-flows/"
               aria-label="How the two bases work – read the full explainer"
               title="How the two bases work – the full explainer">?</a>
          </div>
        )}
          {/* NOT keyed on the matchup any more: a remount would replace these
              figures, and the whole point is that they travel. The old
              readout-in fade lives on where it still belongs, on the lead line
              below, whose words genuinely are replaced. */}
          <div className="hero-readout">
            <div className="ro-party alp-side">
              <span className="ro-dot" style={{ background: colA }}></span>
              <span className="ro-name">{m.a.name}</span>
              <RollNum className="ro-num" value={latest.a.toFixed(1)} style={{ color: inkOf(colA) }} spinIn drift />
            </div>
            <span className="ro-sep" aria-hidden="true" ref={sepRef}></span>
            <div className="ro-party lnp-side">
              <RollNum className="ro-num" value={latest.b.toFixed(1)} style={{ color: inkOf(colB) }} spinIn drift />
              <span className="ro-name">{m.b.name}</span>
              <span className="ro-dot" style={{ background: colB }}></span>
            </div>
          </div>
          {unc && (
            <HeroGauge a={latest.a} ci={unc.ci95} color={lead >= 0 ? colA : colB}
                       aName={m.a.name} bName={m.b.name} sepRef={sepRef} />
          )}
          {/* The lead and the interval around it read on one scale: the lead
              is a - b, so the figure beside it is the lead-scale 95%
              interval, twice the share-scale ci95 the gauge and band use
              (a - b = 2a - 100 quadruples the variance, so the half-width
              doubles). It covers how far the polls in the window disagree
              plus their sampling error; it cannot cover bias shared across
              the industry, which no aggregate can measure about itself. Not
              keyed on the matchup, for the same reason the readout above
              isn't - the margin is a figure that travels between the two
              questions, so it rolls rather than being replaced. The
              readout-in fade lives here, on the line whose words genuinely
              change. */}
          <div className="hero-lead">
            <span className="lead-tag">
              {leadName} leads by <RollNum value={Math.abs(lead).toFixed(1)} spinIn />
              {unc ? (
                <>
                  {/* The figure gets the same treatment as the method word
                      beside it: it names a thing Info defines (margin of
                      error), so it is the shortest way to the definition. */}
                  {" "}
                  <button type="button" className="hi-range hi-term"
                          title={unc.flows ? "How far the flow table's own range moves this pairing" : "What a margin of error means"}
                          onClick={() => window.AP.openTerm &&
                            window.AP.openTerm(unc.flows ? "fp-flows" : "margin-of-error",
                                               "two-party preferred")}>
                    ± {(2 * unc.ci95).toFixed(1)} pts
                  </button>
                </>
              ) : " pts"}
              {leadSwing != null && (
                <>
                  {/* Sign carries the direction a "to/from" word used to:
                      "+" sits above the count, "−" below it. Names the
                      count on phones ("since 2025"), in words otherwise. */}
                  {", " + (leadSwing >= 0 ? "+" : "−")}
                  <RollNum value={Math.abs(leadSwing).toFixed(1)} spinIn />
                  {narrow ? " since 2025" : " since the 2025 election"}
                </>
              )}
            </span>
          </div>
          <div className="hero-sub" ref={subRef}>
            <Delta value={monthDelta} suffix={Math.abs(monthDelta) === 1 ? " pt" : " pts"} small roll spinIn />
            <span className="hero-sub-note" ref={subNoteRef}>
              {/* the reference is a term: the ▲▼ figures across the page
                  measure against three different things, and this opens the
                  entry that says which is which */}
              vs{" "}<button type="button" className="hi-term"
                onClick={() => window.AP.openTerm && window.AP.openTerm("changes", "two-party preferred")}>
                {(m.real || (onImpL && onImpL.aPrev != null) || (altL && altL.aPrev != null))
                  ? "1 month ago" : "previous reading"}</button>
              {/* A month-on-month move smaller than its own interval is not a
                  finding. Say so next to the arrow, not three scrolls down -
                  and let the margin the caveat invokes carry the reader to its
                  definition, as the terms in the interval below do. */}
              {unc && unc.changeSig === false && (
                <span className="hero-caveat"> (within {subTight ? "" : "the "}
                  <button type="button" className="hi-term"
                          title="What a margin of error means"
                          onClick={() => window.AP.openTerm &&
                            window.AP.openTerm("margin-of-error", "two-party preferred")}>
                    margin
                  </button>)
                </span>
              )}
            </span>
          </div>
          {/* How the lead was made and how much evidence sits under it: the
              interval's name, the method, and the window both describe. ref
              feeds the one-line fitter above. The method line trails the
              delta line - first the move, then the machinery behind it. */}
          <div className="hero-interval" ref={hiRef}>
            {/* The label names the ESTIMATOR, not the basis. It used to
                swap to "Implied from primary votes" on the implied basis -
                but the "Using …" button above already declares the basis,
                and the estimator running under either basis is the same
                debiased nowcast, only fed implied figures instead of
                published ones. The word the reader sees stays the
                estimator's name, and that word links to its definition. */}
            <button type="button" className="hi-method hi-term"
                    title={"What " + (adjusted ? "a weighted aggregate" : "a monthly average") + " means"}
                    onClick={() => window.AP.openTerm &&
                      window.AP.openTerm(adjusted ? "weighted-aggregate" : "monthly-average",
                                         "two-party preferred")}>
              {adjusted ? "Weighted aggregate" : "Monthly average"}
            </button>
            {/* The sentence continues in a parenthetical: how much evidence
                the figure carries and what its interval is called. The count
                and span draw on unc, which exists only when an interval does,
                so the clause rides on the same condition. The window is
                TRAILING from the newest poll in it, so its end date is part
                of the phrase, not a stale-data caveat: "in the 21 days to
                14 Sep" says the window and the estimate's date in one. */}
            {unc && (
              <span className="hi-count">
                ({unc.n} poll{unc.n === 1 ? "" : "s"} in the{" "}
                {D.latest.method.windowDays} days to {shortDate(D.latest.updatedISO)};{" "}
                {/* One more route to the margin's definition: the glossary
                    files "95% interval" as a synonym waypoint of margin of
                    error, so a click lands on the same page the ± figure and
                    the caveat's "margin" already open. */}
                <button type="button" className="hi-note hi-term"
                        title={unc.flows ? "How far the flow table's own range moves this pairing" : "What a margin of error means"}
                        onClick={() => window.AP.openTerm &&
                          window.AP.openTerm(unc.flows ? "fp-flows" : "margin-of-error",
                                             "two-party preferred")}>
                  {unc.flows ? "flows range" : "95% interval"}
                </button>)
              </span>
            )}
            {!adjusted && <span className="eyebrow-warn">Limited data</span>}
          </div>
        </div>
        <div className="hero-controls">
          {/* Phone copy of the range switch: its laptop home is the chartbar
              at this column's foot, and every width shows exactly one home -
              one state, two copies. The matchup has no strip copy at all: the
              Switch-2PP pill below is its switcher on every width, laptop
              included, so a bare matchup toggle would only duplicate it. */}
          <TextToggle caps value={rangeId} onChange={setRangeId} ariaLabel="Time range"
            options={rangeOptions} />
          {/* The OTHER contests, carrying their figures rather than just their
              names. One Nation sits level with Labor on the primary vote, so
              in a good many seats the final two are not Labor and the Coalition
              and "the 2PP" is doing less work than a single headline implies.
              These were previously a bare tab you had to press to find out
              what was behind it; the number is the reason to press it. This
              DOM seat - between the compare switch above and the chartbar's
              range toggle below - is the laptop foot-group order as well:
              compare, pill, range. On a phone the ≤560px order:-1 lifts the
              strip to lead the controls column from this same DOM spot. */}
          {otherContests.length > 0 && (
            <div className="hero-alt">
              <span className="ha-lab">Switch 2PP</span>
              {otherContests.map((o) => (
                <button key={o.id} type="button" className="ha-chip" onClick={() => chooseMatchup(o.id)}
                        title={"Show " + MATCHUPS[o.id].a.name + " v " + MATCHUPS[o.id].b.name}>
                  <span className="ha-vs">{MATCHUPS[o.id].a.name} v {MATCHUPS[o.id].b.name}</span>
                  <span className="ha-fig">
                    <span style={{ color: inkOf(MATCHUPS[o.id].a.color) }}>{o.v.a.toFixed(1)}</span>
                    <span className="ha-dash">–</span>
                    <span style={{ color: inkOf(MATCHUPS[o.id].b.color) }}>{o.v.b.toFixed(1)}</span>
                  </span>
                  {o.v.ci95 != null && <span className="ha-ci">± {o.v.ci95.toFixed(1)}</span>}
                </button>
              ))}
            </div>
          )}
          {/* The laptop home of the range switch: the bottom of this
              column's foot group, the Switch-2PP pill ordered immediately
              above it and the group as a whole sunk level with the interval
              strip and the delta line across the way. Hidden on a phone,
              where the strip copy above still does the work, so a width
              never shows both homes. The matchup used to keep a bare toggle
              here too; the figure-bearing pill is the matchup switcher at
              every width now. */}
          <div className="hero-chartbar">
            <TextToggle caps value={rangeId} onChange={setRangeId} ariaLabel="Time range"
              options={rangeOptions} />
          </div>
        </div>
      </div>

      {/* The key carries NEITHER the matchup nor the range: remounting would
          throw away the very thing being animated - the morph in one case, the
          travelling window in the other - along with both memoised dot clouds.
          A stale hover index is already clamped inside. */}
      <TrendChart
        key="hero"
        height={narrow ? 700 : 420} xDomain={xDomain} yDomain={yDomain} yTicks={yTicks} unit="%"
        axisFont={narrow ? 30 : 22}
        pad={narrow ? { l: 74, r: 16, t: 26, b: 54 } : { l: 58, r: 22, t: 30, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={heroRefLines}
        events={heroEvents} eventsFrom={heroEventsFrom} eventMix={morph ? morph.t : 1}
        scatter={scatter} series={heroSeriesAll} spine={heroSpine} pollFacet="twopp"
        scatterOut={scatterOut} scatterMove={scatterMove}
        areas={sensAreas.length ? heroAreas.concat(sensAreas) : heroAreas}
        fade={blend ? morph.t : 1} clipX={blend ? blend.clip : null}
        tooltipTitle={(i) => window.AP.monthLabelFull((drawPts[i] || drawPts[drawPts.length - 1]).ym)}
        /* A month's figures and how well that month is known, in the same
           tooltip – the election anchor is a count, so it reports no interval
           rather than an interval of zero, which would read as a claim. */
        extraRows={(i) => {
          const d = drawPts[i];
          if (!d || d.ci95 == null || !d.ci95) return [];
          return [{ label: "95% interval", value: "± " + d.ci95.toFixed(1) + " pts"
                    + (d.k ? ", " + d.k + " poll" + (d.k === 1 ? "" : "s") : "") }];
        }}
        fmt={(v) => v.toFixed(1)}
      />
      <div className="hero-foot">
        <div className="hero-legend">
          {/* swatch matches what is actually drawn – a line where there is a
              trend, a dot where the series is only its readings */}
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.a.color }}></span>{m.a.name}
          </span>
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.b.color }}></span>{m.b.name}
          </span>
          {scatterPolls > 0 && heroSeries.length > 0 && <span className="hl-item hl-polls"><span className="hl-dot"></span>Individual poll</span>}
          {heroAreas.length > 0 && (
            <span className="hl-item"><span className="hl-band"></span>{impOnBasis ? "flow range" : "95% interval"}</span>
          )}
          {synthOverlay.length > 0 && (
            <span className="hl-item"><span className="hl-dashed" style={{ borderColor: "var(--alp)" }}></span>{m.altKey === "alp_on"
              ? (impOnBasis
                  ? <>Published (respondent-allocated){D.altLatest && D.altLatest.alp_on ? `, ${D.altLatest.alp_on.a.toFixed(1)}` : ""}</>
                  : <>Implied from primaries at fixed flows{D.latest.onImp ? `, ${D.latest.onImp.a.toFixed(1)}` : ""}</>)
              : (impBasis
                  ? <>Published (respondent-allocated){D.latest && D.latest.alp2pp != null ? `, ${D.latest.alp2pp.toFixed(1)}` : ""}</>
                  : <>Implied from primaries at 2025 flows{D.synthLatest && D.synthLatest.alp != null ? `, ${D.synthLatest.alp.toFixed(1)}` : ""}</>)}
            </span>
          )}
          {sensAreas.length > 0 && (
            <span className="hl-item"
                  title="Shade between the implied figure as read on the 2025 and 2022 counted flow tables (TPP cut) – if One Nation preferences flowed to Labor as they did in 2022, the implied figure would sit at the bracket's top edge. A sensitivity read, not an interval.">
              <span className="hl-band hl-band-sens"></span>ON-flow sensitivity
            </span>
          )}
        </div>
        {/* the gist, the shading and what an overlap means all fold behind
            the same "How to read this chart" as every panel */}
        <HowTo cls="hero-caption" paras={[
          <>
            {m.real
              ? (<>{impBasis
                  ? "Each dot is one poll’s primaries re-allocated at fixed 2025 preference flows; the line is a "
                  : "Each dot is one published poll; the line is a "}
                 <button type="button" className="hi-term"
                         title="Why the newest dots can sit past the line’s end"
                         onClick={() => window.AP.openTerm &&
                           window.AP.openTerm("dots-past-the-line", "two-party preferred")}>
                   smoothed average</button>
                 {impBasis ? " of those implied figures." : " across all pollsters."}</>)
              : impOnBasis
                ? "Each dot is one poll’s primaries re-allocated at the site’s fixed ALP–ON flow set; the line is a smoothed average of those implied figures."
                : `Each dot is one pollster’s published ${m.label} head-to-head` +
                (adjusted
                  ? ", adjusted for each house’s lean on this matchup as the headline two-party is."
                  : ", averaged monthly – too few houses ask it to weight or correct.") +
                (scatterPolls ? ` ${scatterPolls} poll${scatterPolls === 1 ? "" : "s"} so far.` : "")}
          </>,
          m.real
            ? <>The shading is the interval around the line. Where the two bands overlap, the lead
               is inside its own margin of error – the polls cannot separate the parties that month.</>
            : impOnBasis
              ? <>The shading is the flow table’s own range. No election has counted this pairing, so
                 the set is calibrated from preference counts, not anchored to a result.</>
              : null,
        ]} />
      </div>
      {/* the compare switch's ONE home - under the chart legend, next to the
          lines it annotates, at every width */}
      {((matchup === "alp_lnp" && impOffered) || (m.altKey === "alp_on" && impOnOffered)) && compareToggle()}
    </section>
  );
}

/* ---- report an error ----------------------------------------------------
   The report-an-error form LIVES ON /feedback/ now - a standalone page
   outside the build pipeline, still posting to the same Formspree endpoint.
   What the tracker still owns is the way IN, rendered below by MethodNote
   (and the archive row's report-an-error deep link, whose ?msg= query the
   page prefills).

   One invariant outlives the move: a reader who notices a wrong figure has
   to have somewhere to say so within one click of having noticed it - the
   form being a page away is allowed to cost a navigation, not a hunt. */

/* What is left of the method footer. Its three sections of prose - about the
   tracker, reading the charts, sources - are now the Info tab's glossary,
   where a reader can find one definition without reading all of them and
   without scrolling past the whole page to get there.

   What stays is not information but furniture: the way to report an error,
   which belongs wherever the reader notices one, and the standing caveat on
   the figures, which has to sit under the figures rather than one tab away.

   Both are a COLOPHON now, and are set as one. What the site is goes left,
   with its own caveat under it; every way out of the page goes right. That
   is the masthead's composition again - identity left, ways in right - so
   the page opens and closes on the same shape. The one sentence that used to
   run three thoughts together is broken at its own joins and dealt to the
   column each belongs in; the copy is unchanged word for word, which matters
   because it is a two-homes pair (the ss-note in build.mjs is the other). */
function MethodNote({ onInfo }) {
  const J = window.JUR;
  /* Named rather than an inline arrow: an arrow's `=>` puts a literal `>`
     inside the tag, which site-shell.mjs parseChrome's `[^>]*` tag-body
     match then reads as the tag's end (the footer copy lift must see only
     "Info" here). */
  const infoClick = (e) => { e.preventDefault(); onInfo(); };
  return (
    <footer className="method">
      <div className="colophon">
        {/* left: what the site claims to be, and immediately under it what it
            does not claim. Right: every way out of the page. Each column is a
            statement over its own quieter footnote, which is why they balance
            at four lines apiece without either being padded to fit. */}
        <div className="colo-about" data-nosnippet="">
          {!J ? (
          <p className="colo-lede">
            auspol tracker is an unofficial aggregator of published federal opinion polling.
          </p>
          ) : (
          <p className={"colo-lede"}>
            {J.brand} tracker is an unofficial aggregator of published {J.electionWords} opinion polling.
          </p>
          )}
          <p className="disclaimer">
            Best efforts are made to make the aggregate figures transparent, trustworthy,
            statistically sound, and informative, but they are, in the end, estimates only.
          </p>
        </div>
        <div className="colo-ways">
          {/* The way in to the form, now that the form is elsewhere. The
              Info signpost rides the front of this line only away from Info:
              on the tab itself it could only point at where the reader is
              standing, so the caller passes a null onInfo there and the
              clause goes unrendered. */}
          <p className="fb-lede">
            {onInfo && (
              <>
                How the figures are built is in{" "}
                <a href="#info" className="hi-term"
                   onClick={infoClick}>Info</a>.{" "}
              </>
            )}
            Spot an error, a missing poll, or have any other feedback? Please{" "}
            <a className="fb-link" href="/feedback/">let me know</a>.
          </p>
          {!J ? (
          <p className="colo-arch">
            Federal polling archives I’ve located are stored{" "}
            <a className="colo-link" href="/archives/newspoll/">
              here<span className="plink-mark" aria-hidden="true">↗</span>
            </a>{" "}
            for safekeeping and convenience.
          </p>
          ) : (
            /* /vic/ has no archives of its own; its way out is home */
            <p className={"colo-arch"}>
              Federal polling is tracked on{" "}
              <a className="colo-link" href="/">auspol tracker</a>.
            </p>
          )}
          <p className="colo-arch">
            <button type="button" className="hi-term colo-plain"
                    onClick={() => window.AP.openStatic && window.AP.openStatic()}>Read this page as plain text</button>
            {" "}– every figure and the method, without charts.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Sticky score anchor – RETIRED: the 2PP readout now docks into the sticky
// tab bar (TabScore in views.jsx) so it travels across every tab. ScoreBar
// removed rather than left dead – see git/file history if it's ever wanted.

// set once the body first carries its theme classes – see the effect below
let chromeSettled = false;
let flipsOpen = 0;

// timestamp of the last pointer down/up inside the tab panel, and whether the
// panel's current focus arrived through that pointer – see the panel itself
let viewPanelPokedAt = 0;
let viewPanelFocusIsPointer = false;

const TABS = [
  { id: "now", label: "Now" },
  { id: "cycles", label: "Past cycles" },
  { id: "allpolls", label: "All polls" },
  /* pinHide: the docked 2PP score takes this end of the bar once the bar
     pins AND the hero 2PP has scrolled off (.show-score), and on a phone
     there is not room for both. The glossary is the one tab a reader is
     never mid-task in, so it is the one that yields – even as the active
     tab, since an active tab is never clicked and the panel itself stays
     put. The CSS gates the hide to phone widths AND to .show-score – a wide
     bar has room for the full tab set plus the score, and a merely-pinned
     phone bar (hero still on screen, no score docked) keeps Info too. */
  { id: "info", label: "Info", pinHide: true,
    tip: "About this site – how it works, what it tracks, and the terms it uses" },
];
/* a page with no past terms in its cycle data (/vic/, until its earlier
   terms' polls are gathered) has no Past cycles tab */
if (!window.AUSPOL.cycles.some((c) => !c.current)) TABS.splice(TABS.findIndex((t) => t.id === "cycles"), 1);
const TAB_IDS = TABS.map((t) => t.id);

/* The sections that take nothing from the two-party switches, kept from
   re-rendering when one is pressed. Without this a matchup or basis press
   rebuilt the whole page - every chart in every section - inside the press,
   about 70ms on a phone, before the chart that was asked to move could start
   moving. Their only prop is the range, which in the redesign is fixed. */
const PrimaryVoteMemo = React.memo(PrimaryVotePanel);
const NextPollsMemo = React.memo(NextPollsPanel);
const LeadershipMemo = React.memo(LeadershipSection);
const DirectionMemo = React.memo(DirectionPanel);
const DemographicsMemo = React.memo(DemographicsPanel);
const OnSourcesMemo = React.memo(OnSourcesPanel);
const IssuesMemo = React.memo(IssuesPanel);
const UndecidedMemo = React.memo(UndecidedPanel);
const MoodMemo = React.memo(MoodPanel);

function SnapshotView({ rangeId: heroRange, setRangeId, showScatter, tppMatchup, setTppMatchup, tppBasis, setTppBasis }) {
  /* The redesign sets its range tabs over the two-party and primary-vote
     charts - one range state, one menu above each chart, both moving it -
     and every other section's headline is written for the whole term. The
     design it replaced keeps its page-wide range, set at the top of its
     hero. */
  const rangeId = window.AP.rd ? "all" : heroRange;
  /* Everything below the hero mounts one pass LATE, not in the first
     commit. body.js - the flag that retires the static article - lands
     on that first commit, and rendering the primary-vote panel plus all
     six analysis sections inside it kept that one commit above 200ms of
     main-thread work: that is the refresh-time window in which the
     static page sits on screen. Commit just the hero, latest-polls table
     and next-polls ticker first, have the rest follow in the very next
     pass, and the window more than halves; everything deferred lies
     below the fold, so the second commit has landed long before the
     reader scrolls to it. snapshotTailArmed pins the deferral to FIRST
     mount only - tab switches and design flips remount this view, and
     those paths must draw whole, not pop. */
  const [tail, setTail] = useState(snapshotTailArmed);
  React.useEffect(() => {
    if (!snapshotTailArmed) { snapshotTailArmed = true; setTail(true); }
  }, []);
  return (
    <>
      <Hero rangeId={heroRange} setRangeId={setRangeId} showScatter={showScatter}
            matchup={tppMatchup} setMatchup={setTppMatchup}
            basis={tppBasis} setBasis={setTppBasis} />
      {/* the primary-vote chart joins the pass-late set: at half the first
          commit's DOM it was worth as much to the static-article window as
          the whole six-section tail did */}
      {tail && <PrimaryVoteMemo rangeId={heroRange} setRangeId={setRangeId} />}
      <PollsterTable tppBasis={tppBasis} setTppBasis={setTppBasis}
                     tppMatchup={tppMatchup} setTppMatchup={setTppMatchup} />
      {/* when the next ones land, straight after the latest ones - it sat
          between National direction and the vote-by-group analysis, a
          schedule in the middle of the reading */}
      <NextPollsMemo />
      {tail && <>
        <LeadershipMemo rangeId={rangeId} />
        <DirectionMemo rangeId={rangeId} />
        {/* who votes for whom: age, gender, education, place, and home */}
        <DemographicsMemo rangeId={rangeId} />
        {/* who One Nation's surge is made of */}
        <OnSourcesMemo rangeId={rangeId} />
        {/* what voters say matters, and which party they trust with it -
            the reasons behind the vote, before the page turns to those who
            haven't settled on one */}
        <IssuesMemo rangeId={rangeId} />
        {/* closes the page: the electorate's mood rather than its party
            choice - how many can't say who they would vote for */}
        <UndecidedMemo rangeId={rangeId} />
        {/* the coda after decidedness: how confident voters and businesses
            feel, on Roy Morgan's own indices - context, not a predictor */}
        <MoodMemo rangeId={rangeId} />
      </>}
    </>
  );
}

/* One page load arms the snapshot tail exactly once - see SnapshotView. */
let snapshotTailArmed = false;

/* Error boundaries. Before these, ANY render throw anywhere in the tree
   unmounted the whole createRoot root, leaving the reader a blank page
   over a faded static summary - and the data pipeline (a wave landing at
   06:00 via CI) is exactly when nobody is watching. Two rings:
   ViewBoundary wraps the tab panel, so a bad view is a notice in that
   tab while the strip and the other tabs keep working; the keyed
   .view-enter wrapper above it remounts it per tab, so switching views
   clears the error. RootBoundary wraps App at the mount call; its catch
   undoes precisely what mount did - body.js off, the aria-hidden and
   inert put back - so the static summary steps back up as the page,
   the same degradation every no-JS reader already gets. */
class ViewBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error("view render failed:", err); }
  render() {
    if (this.state.err) {
      return (
        <div className="view-error" role="alert">
          <p>This view hit an error and could not display. The rest of the page is unaffected.</p>
          <button type="button" className="view-error-retry"
            onClick={() => this.setState({ err: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
class RootBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    console.error("app render failed:", err);
    document.body.classList.remove("js");
    if (window.apBootDone) window.apBootDone();
    const ss = document.querySelector(".static-summary");
    if (ss) {
      ss.removeAttribute("aria-hidden");
      ss.inert = false;
    }
  }
  render() { return this.state.err ? null : this.props.children; }
}

/* The sheet "?" opens: the page's own table of what it listens for, kept
   short enough that every row earns its place. The keys are sentence-case
   in here; rd.css does the chiclet chrome. ⌥ is Alt on non-Apple
   keyboards, said once beside the one shortcut that needs it. */
const KBD_ROWS = [
  /* /vic/ has no Past cycles (TABS above) and no demographics view */
  { keys: ["←", "→"], what: window.JUR ? "Turn between Now, All polls and Info" : "Turn between Now, All polls, Past cycles and Info" },
  { keys: ["⌥", "D"], what: "Dark mode, on or off — ⌥ is Alt on a PC" },
  { keys: ["C"], what: "Copy the chart or poll breakdown under the pointer as an image" },
  { keys: ["←", "→"], what: "Walk a card's tabs or chips while the pointer is over it" },
  { keys: ["1–9"], what: "Pick a numbered party or term on a chips row" },
  ...(window.JUR ? [] : [{ keys: ["1–6"], what: "In the all-polls demographics view, pick the Split by group" }]),
  { keys: ["Space"], what: window.JUR ? "Flip the matchup in the two-party views" : "Flip the matchup in the two-party views; walk the Primary vote panel's group menu; step the all-polls demographics split" },
  { keys: ["P"], what: "In the all-polls two-party table, published figures only" },
  { keys: ["?"], what: "This sheet" },
];

function App() {
  /* body.js is the "app has mounted" flag (see the boot block below), so it
     is added by the first COMMIT, from this layout effect, and not by the
     boot script before it calls render(). createRoot().render() commits
     asynchronously, and the class being set early left a real window: the
     static article was already transparent, #root was still empty and
     already pulled up over it by --ss-h, and the page collapsed to the tide
     band alone at the top of a blank screen. A refresh painted exactly
     that frame - the line art splashed across the screen - until the app
     landed. In a layout effect the class change and the first tree paint
     together, so no frame exists in between. The same commit lifts html.boot
     (the body-start script in template.html hides the page until now), so
     the first frame the reader sees is the app itself, never the article. */
  React.useLayoutEffect(() => {
    document.body.classList.add("js");
    if (window.apBootDone) window.apBootDone();
  }, []);
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "layout": "editorial",
    "theme": "auto",
    "accent": "warm",
    "showScatter": true
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rangeId, setRangeId] = useState("all");

  /* Which design the page wears. Only the redesign: the one it replaced
     was unwired from the page 2026-10-03 (the tagline's "last" no longer
     flips between them, and no choice is persisted any more, so a stored
     "old" from before the unwiring cannot stick anyone to it). Its code
     stays in the branches below that read this flag, and a ?design=old
     query visits it for one load - for checking one against the other.
     ---- ARCHIVED 2026-10-08 (user call): the old view is a frozen
     record. ?design=old pages stay reachable for comparison, but nothing
     behind rd === false is maintained from here on - copy, layout and
     data-display work happens in the redesign paths alone, and the two
     designs are never kept in sync. (Do not remove: no reader can be
     stuck on it, and the branches keep the comparison reachable.)
     Every component reads the flag off window.AP while rendering, so the
     whole tree re-reads it when App re-renders - the views below are
     keyed on it and remount. */
  const qDesign = (() => {
    try { const q = new URLSearchParams(window.location.search).get("design"); return q === "old" || q === "new" ? q : null; }
    catch (_) { return null; }
  })();
  /* /vic/ was built on the redesign alone: no ?design=old there */
  const rd = qDesign !== "old" || !!window.JUR;
  window.AP.rd = rd;
  /* The class first goes on in the boot script before render() is called
     (children's layout effects would otherwise measure the pre-rd,
     unstyled layout one commit too early - see the boot block); this
     effect just keeps the flag the OWNER of the class after mount. */
  React.useLayoutEffect(() => { document.body.classList.toggle("rd", rd); }, [rd]);

  /* Which two-party contest the hero is showing. Owned here, not inside Hero,
     for two reasons that are the same one: the docked 2PP score in the tab
     bar must follow it, and the hero unmounts whenever the reader walks off
     the Snapshot tab – the score travels on. */
  /* Opens on the rival Labor is doing WORST against, not on the traditional
     pairing — see latest.rivalLead in gen-data for the deadband that keeps
     that from flipping month to month. Falls back to the classic pairing if
     an older data asset carries no ranking. */
  const [tppMatchup, setTppMatchup] = useState(
    (window.AUSPOL.latest && window.AUSPOL.latest.rivalLead) || "alp_lnp");

  /* Which measure of 2PP the hero shows for ALP v L/NP: the pollsters' own
     respondent-allocated figure ("resp") or the implied figure the fixed
     2025 flow table reads off the primary-vote aggregate ("imp"). Implied
     is the default and it is the figure the share card carries. Owned here
     for the same reason the matchup is: the docked 2PP score must follow
     it, and the hero unmounts when the reader walks off the Snapshot tab. */
  const [tppBasis, setTppBasis] = useState("imp");
  React.useEffect(() => {
    window.AP.tppBasis = tppBasis;
    return () => { if (window.AP.tppBasis === tppBasis) delete window.AP.tppBasis; };
  }, [tppBasis]);

  // active tab, persisted in the URL hash so a refresh / share keeps the view
  const readHash = () => {
    const h = (window.location.hash || "").replace(/^#/, "");
    /* the tab was Snapshot before it was Now: links shared under the old
       #snapshot hash keep landing on it */
    if (h === "snapshot") return "now";
    return TAB_IDS.includes(h) ? h : "now";
  };
  const [tab, setTab] = useState(readHash);
  const [focusPoll, setFocusPoll] = useState(null);   // the poll a chart dot sent us to
  const [focusTerm, setFocusTerm] = useState(null);   // the glossary entry a link sent us to
  const [termPop, setTermPop] = useState(null);       // a definition open over the page
  React.useEffect(() => {
    const fn = () => setTab(readHash());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const goTab = (id) => {
    setTab(id);
    if (id !== readHash()) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "auto" });
    // walking off with the tabs ends the trip: coming back to the archive later
    // should not still be holding a row open with a way back to a chart the
    // reader has long since left. Same for a glossary entry still offering to
    // return somewhere the reader has since walked away from.
    setFocusPoll(null);
    setFocusTerm(null);
  };

  /* A phone swipes between the pages: finger right-to-left for the next tab
     (Snapshot -> Past cycles), left-to-right for the one before, anywhere on
     the page. The exception is a row of subpages (RdTabs marked `swipe`: All
     polls' figures, preferred PM's questions, who votes by age or place...):
     a swipe on it or anywhere in what it switches - down to the end of
     its panel or section, so the table or chart under the row too - steps
     through ITS views instead, the nearest row winning. Rows that only re-cut one figure (Past cycles'
     level/change measure) aren't marked, so the page turns there. The vote
     charts' time-range rows are the in-between case, marked to step only on
     a swipe that lands on the row itself (see the self-claim in onStart).
     Both the page turn and every row step wrap round the ends, as the
     arrow-key walks on a computer do: a swipe off the last page or the last
     tab comes back round to the first.

     It only ever reads a finished gesture, and leaves alone anything that
     claims sideways drags for itself: a chart scrubs (touch-action: pan-y),
     a slider drags (none), a wide table scrolls. One exact exception: a
     touch landing ON THE CHART of an element marked data-rd-swipe-exact
     (the hero's 2PP card, which flips the contest; the primary card,
     which steps the window) keeps it no matter what it would otherwise
     claim - the card round the chart flips nothing, its touch falls back
     to a row or the page. So do the edges, where iOS
     and Android put their own back gesture, a zoomed-in page (the finger is
     panning it) and a second finger (a pinch). Passive throughout: the page
     never waits on this to scroll. */
  const swipeRef = useRef(null);
  swipeRef.current = { tab, goTab };
  React.useEffect(() => {
    const PHONE = window.matchMedia(MQ_PHONE);
    const MIN_DX = 60;          // travel that makes it a swipe, not a nudge
    const EDGE = 24;            // the system back-gesture strip at either side
    const NEAR_BELOW = 120;     // the least a row reaches below itself, in px
    const MAX_MS = 800;
    let g = null;
    const claimsSideways = (el) => {
      for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
        if (n.matches("input, textarea, select, [contenteditable], [role=slider]")) return true;
        const cs = getComputedStyle(n);
        const ta = cs.touchAction;
        if (ta && ta !== "auto" && ta !== "manipulation" && !/pan-x/.test(ta)) return true;
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    /* the subpage row this touch is on or under, nearest first. A row reaches
       down over the content it switches: its own panel where it heads one
       (preferred PM, approval - two to a section), else its section. The
       latest polls table runs over a thousand px under its row on a phone,
       and a swipe on the table is as plainly aimed at 2PP/Primary/Leaders
       as one on the row itself. */
    const rowAt = (y) => {
      let best = null, bestD = Infinity;
      for (const el of document.querySelectorAll("[data-rd-swipe]")) {
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        const owner = el.closest(".rd-ld-panel") || el.closest("section");
        const reach = Math.max(r.bottom + NEAR_BELOW, owner ? owner.getBoundingClientRect().bottom : 0);
        if (y < r.top - 12 || y > reach) continue;
        const d = y < r.bottom ? 0 : y - r.bottom;
        if (d < bestD) { bestD = d; best = el; }
      }
      return best;
    };
    const onStart = (e) => {
      g = null;
      if (!PHONE.matches || e.touches.length !== 1) return;
      if (window.visualViewport && window.visualViewport.scale > 1.01) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      /* a piece of surface landing its own claim owns the touch outright:
         exact by target, so nothing measured - no row's reach and no
         card's chart - gets to second-guess where the finger meant. The
         hero's 2PP figures flip the contest on it, and either vote chart's
         time-range row steps its window on it (both carry __rdSwipe); the
         "ahead" scale directly under the figures claims nothing, so
         a swipe there keeps the page's plain turn */
      const self = e.target && e.target.closest ? e.target.closest("[data-rd-swipe-self]") : null;
      if (self && self.__rdSwipe) {
        g = { x: t.clientX, y: t.clientY, t: Date.now(), selfScroll: true, row: self };
        return;
      }
      /* an exact claimer (the hero's 2PP card, the primary-vote card)
         takes a touch that lands on its chart, whatever sideways claims
         stand between it and the page. The rest of the card - the numbered
         event list under the chart, the tabs and chrome - claims nothing:
         a swipe there falls through to the page's own reach and turn,
         like anywhere else */
      const own = e.target && e.target.closest && e.target.closest(".chart")
        ? e.target.closest("[data-rd-swipe-exact]") : null;
      if (!own && claimsSideways(e.target)) return;
      g = { x: t.clientX, y: t.clientY, t: Date.now(), sy: window.scrollY, row: own || rowAt(t.clientY) };
    };
    const onMove = (e) => { if (g && e.touches.length > 1) g = null; };
    const onCancel = () => { g = null; };
    const onEnd = (e) => {
      const s = g;
      g = null;
      if (!s || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) < MIN_DX || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      if (s.selfScroll) s.sy = window.scrollY;   // the self-claim pins its reference now (see onStart)
      if (Date.now() - s.t > MAX_MS || Math.abs(window.scrollY - s.sy) > 12) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;       // the finger was selecting text
      const dir = dx < 0 ? 1 : -1;               // right-to-left = next
      if (s.row) {
        if (s.row.isConnected && s.row.__rdSwipe) s.row.__rdSwipe(dir);
        return;                                  // a row's last view doesn't turn the page
      }
      const { tab: cur, goTab: go } = swipeRef.current;
      const ids = TABS.map((x) => x.id);
      go(ids[(ids.indexOf(cur) + dir + ids.length) % ids.length]);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  /* The same page turn, from the keyboard: left and right arrows walk the
     four pages when nothing on the page holds the focus. A focused control
     keeps its own arrows (its handler ran first if it had one; the navbar's
     tab walk and every rdTabsKey row cover the rest), an open "?" or
     glossary panel keeps the page put, and a live text selection keeps the
     collapse-to-end behaviour. Wraps round the ends, like the navbar's own
     walk - and the finger swipe walks the pages the same way now. */
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;
      if (document.querySelector(".rd-qpanel, .term-pop, .rd-keysheet")) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const { tab: cur, goTab: go } = swipeRef.current;
      const ids = TABS.map((x) => x.id);
      const next = ids[(ids.indexOf(cur) + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      if (next) { e.preventDefault(); go(next); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* The navbar's "Next" label is a jump to the NextPollsPanel, which sits
     second-to-last on the snapshot view (undecided is the foot). When the
     reader is on another tab the scroll has to wait for the snapshot to
     mount, so it is parked in a ref the tab layout-effect below empties; a
     generous scroll-margin-top (see .next-polls) keeps the panel's heading
     clear of the pinned tab bar. */
  const npJumpRef = useRef(false);
  const npScrollNow = () => {
    const el = document.querySelector("section.next-polls, section.rd-polls");
    if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
  };

  /* Clicking a dot on any chart crosses to that poll in the archive, opened.
     The charts are six components deep in two different views, so the entry
     point is registered on window.AP - the namespace this app already uses to
     share things across its scripts - rather than threaded through as a prop
     nine panels would have to forward. `back` is where the reader was standing
     when they clicked, so the return trip puts them back on the same pixel
     rather than at the top of a tab. */
  React.useEffect(() => {
    /* `from` names the place being left, in the words the return button will
       use. It used to be assumed - every trip started at a chart, so the way
       back could say so - and "Back to the chart" is simply wrong for a reader
       who arrived from the list of releases behind a projection. */
    /* `split` rides along for the demographics facet: a Who votes for whom
       dot names its group tab, so the poll opens on that split */
    window.AP.openPoll = (key, facet, from, split) => {
      if (!key) return;
      setFocusPoll({ key, facet: facet || null, split: split || null,
                     back: { tab: readHash(), y: window.scrollY, from: from || "the chart" } });
      setTab("allpolls");
      if (readHash() !== "allpolls") window.location.hash = "allpolls";
    };
    /* The same trip, for a definition. Any panel can send a reader to the term
       that explains a word it just used - the hero's method label is the first
       - and `from` names the place being left in the words the return button
       will use, so the way back can say where it goes rather than guessing. */
    const openTermPage = (id, from) => {
      if (!id) return;
      setTermPop(null);
      setFocusTerm({ id, back: { tab: readHash(), y: window.scrollY, from: from || "where you were" } });
      setTab("info");
      if (readHash() !== "info") window.location.hash = "info";
    };
    /* Away from Info a term opens in place (TermPop); on Info itself it is a
       cross-reference, and the page scroll it has always been is right. */
    window.AP.openTerm = (id, from) => {
      if (!id) return;
      if (readHash() === "info") openTermPage(id, from);
      else setTermPop({ id, from });
    };
    window.AP.openTermPage = openTermPage;
    /* The navbar "Next" label jumps straight to the NextPollsPanel on the
       snapshot. Same-tab scrolls happen in place; a cross-tab trip has to
       wait for the snapshot view to mount, so the scroll is parked for the
       layout effect below the way a restore scroll is. */
    window.AP.gotoNextPolls = () => {
      if (readHash() === "now") { npScrollNow(); return; }
      npJumpRef.current = true;
      setTab("now");
      window.location.hash = "now";
    };
    /* Info's "How the final polls did" mention, as a real link: to Past
       cycles, then down to the panel once the view (and its lazily fetched
       source rows) has mounted it. */
    window.AP.gotoFinalPolls = () => {
      setTab("cycles");
      if (readHash() !== "cycles") window.location.hash = "cycles";
      let tries = 0;
      const seek = () => {
        const el = document.getElementById("final-polls");
        if (el) { el.scrollIntoView({ block: "start" }); return; }
        if (++tries < 40) setTimeout(seek, 75);
      };
      setTimeout(seek, 0);
    };
    return () => { delete window.AP.openPoll; delete window.AP.openTerm; delete window.AP.openTermPage;
                   delete window.AP.gotoNextPolls; delete window.AP.gotoFinalPolls; };
  }, []);
  /* The return trip puts the reader back on the pixel they left from. The
     scroll is handed to a layout effect rather than to requestAnimationFrame:
     the view has to be in the DOM before the document is tall enough to take
     the scroll, and rAF does not run at all in a tab nobody is looking at - so
     a frame-scheduled restore silently does nothing, which is precisely the
     kind of "works on my machine" this file has been bitten by before. */
  const restoreY = useRef(null);
  const backFromPoll = () => {
    const b = (focusPoll && focusPoll.back) || { tab: "now", y: 0 };
    setFocusPoll(null);
    restoreY.current = b.y;
    setTab(b.tab);
    if (readHash() !== b.tab) window.location.hash = b.tab;
  };
  const backFromTerm = () => {
    const b = (focusTerm && focusTerm.back) || { tab: "now", y: 0 };
    setFocusTerm(null);
    restoreY.current = b.y;
    setTab(b.tab);
    if (readHash() !== b.tab) window.location.hash = b.tab;
  };
  React.useLayoutEffect(() => {
    if (npJumpRef.current) {
      npJumpRef.current = false;
      npScrollNow();
      return;
    }
    if (restoreY.current == null) return;
    const y = restoreY.current;
    restoreY.current = null;
    window.scrollTo({ top: y, behavior: "auto" });
  }, [tab]);

  // resolve 'auto' against the OS preference, and keep it live
  const prefersDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [sysDark, setSysDark] = useState(prefersDark());
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn); };
  }, []);
  const isDark = t.theme === "dark" || (t.theme === "auto" && sysDark);

  /* Theme, layout and accent are three switches on ONE appearance, so they
     are applied together, in one place. Three separate effects meant three DOM
     writes, and a change that moved two of them at once (theme carries its own
     accent) ran two crossfades over each other.

     The crossfade itself is now the browser's. It used to be a CSS rule –
     `body.theme-xfade *` with a transition on background-color, color,
     border-color, fill, stroke, box-shadow and opacity – which is a transition
     on EVERY element: 3,300 of them on the archive tab, seven paint properties
     each, none of them anything the compositor can do on its own. Every frame
     of the 380ms repainted the whole page, and the flip visibly stepped
     instead of fading. A view transition takes one picture of the page before
     and one after and crossfades the two textures on the GPU, so the cost no
     longer scales with how much is on screen. Where the API is missing, or the
     reader asked for less motion, the theme simply flips – a clean cut reads
     as intent, a janky fade reads as a bug. */
  const want = { editorial: t.layout === "editorial", cool: t.accent === "cool", dark: isDark };
  const applyChrome = () => {
    for (const c in want) document.body.classList.toggle(c, want[c]);
  };
  /* A theme flip lands every colour at once. The crossfade snapshots the new
     page, but the live page under it is what shows when the fade ends, and
     there the controls with their own colour transitions (the nav, the 2PP
     switch, the checkboxes, body's paper) were still easing from the old
     palette – trailing the rest of the page by a beat. html.theme-flip
     (template.html) holds every transition off until the flip is over;
     lifting it starts none, as nothing's value changes then. */
  const flipColours = () => {
    flipsOpen++;
    document.documentElement.classList.add("theme-flip");
    applyChrome();
  };
  // a flip landing on another's tail ends the first; the class waits for both
  const endFlip = () => {
    if (--flipsOpen <= 0) { flipsOpen = 0; document.documentElement.classList.remove("theme-flip"); }
  };
  /* The first application belongs to the first commit, before anything
     paints: from the passive effect below it landed a frame late, so a dark
     reader's first frame of the app was the light palette. The body-start
     script in template.html has normally put these same classes on already
     (that is what keeps body's colour transition from fading the page in),
     so this is the backstop that makes App's word final. */
  React.useLayoutEffect(() => {
    if (chromeSettled) return;
    chromeSettled = true;
    applyChrome();
  }, []);

  /* The tab panel's rise-in (.view-enter) is for a SWITCH. On the panel the
     page loads with it read as a bounce: the browser holds the previous page
     until the app paints (html.boot), so the old frame showed every heading in
     place and the new one showed them 7px low, sliding back up. The panel the
     page opens on gets no entrance; the first switch away retires the
     exemption, so coming back to that tab rises in like any other. Keyed by
     panel rather than a flag, so a re-render never adds the class to a
     standing panel (which would start the animation on it). */
  const panelKey = tab + (rd ? "-rd" : "");
  const loadPanel = useRef(panelKey);
  useEffect(() => {
    if (panelKey !== loadPanel.current) loadPanel.current = null;
  }, [panelKey]);
  React.useEffect(() => {
    // nothing to change – a re-render that re-runs this effect must not animate
    if (!Object.keys(want).some((c) => document.body.classList.contains(c) !== want[c])) return;
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* The FIRST application is the page dressing itself and must not fade in
       from the default palette. The flag lives at module scope on purpose: as
       a component ref it was reset by a remount during start-up, which quietly
       spent the "no animation" pass on the reader's first theme flip instead
       of on the load. */
    if (!chromeSettled || still || document.visibilityState === "hidden"
        || typeof document.startViewTransition !== "function") {
      const first = !chromeSettled;
      chromeSettled = true;
      if (first) { applyChrome(); return; }
      flipColours();
      requestAnimationFrame(() => requestAnimationFrame(endFlip));
      return;
    }
    /* A skipped transition – a backgrounded tab, or a second flip landing on
       top of this one – rejects `ready`, and a rejection nobody reads is
       reported to the console as an uncaught error. The class change has
       already been applied by then either way, so there is nothing to recover
       from and nothing to report: swallow both promises deliberately. */
    const vt = document.startViewTransition(flipColours);
    if (vt) {
      if (vt.ready && vt.ready.catch) vt.ready.catch(() => {});
      if (vt.finished && vt.finished.then) vt.finished.then(endFlip, endFlip);
      else endFlip();
    }
  }, [t.layout, t.accent, isDark]);

  const cycleTheme = () => setTweak("theme", isDark ? "light" : "dark");

  /* Option+D flips the theme from anywhere on the page. e.code, not e.key:
     on a Mac the combo types ∂ into e.key, which would take layout-by-layout
     character tables to catch, while the physical key is D on every layout.
     A held key autorepeats straight through the view-transition crossfade,
     so repeats are ignored rather than strobed, and a text field keeps its
     Option characters for its own typing. The toggle is read through a ref
     refreshed every render (the swipeRef pattern above): the listener binds
     once, but the closure it calls must see this render's theme, or the
     second keypress flips from the first render's value and nothing moves. */
  const themeKeyRef = useRef(cycleTheme);
  themeKeyRef.current = cycleTheme;
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.shiftKey || !e.altKey) return;
      if (e.code !== "KeyD" && e.key !== "d" && e.key !== "D" && e.key !== "∂") return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      e.preventDefault();
      themeKeyRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* "?" opens the keys sheet from anywhere: the discoverable answer to the
     page listening to keys at all. The toggle is state, not intent, so "?"
     closes as well as opens, and the handler re-registers with keySheet so
     Escape and "?" both read the current state rather than the mount
     render's. Escape closes only the sheet - a term popover or method
     popover open beneath it keeps its own Escape contract, and the page-
     turn arrows are vetoed on ".rd-keysheet" like the other popups.
     Opening hands the dialog focus: every key claim on the page guards on
     body focus, so the sheet being focused stands them all down at once;
     closing returns focus to whatever held it. In a text field "?" is
     typing, and the sheet leaves it alone. */
  const [keySheet, setKeySheet] = useState(false);
  const keySheetEl = useRef(null);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      if (e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        setKeySheet((v) => !v);
      } else if (keySheet && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setKeySheet(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keySheet]);
  React.useEffect(() => {
    if (!keySheet) return undefined;
    const back = document.activeElement;
    const el = keySheetEl.current;
    if (el) el.focus();
    return () => { if (back && back.focus && back.isConnected) back.focus(); };
  }, [keySheet]);

  return (
    <div className="page">
      {/* Twelve tab stops (masthead, theme, the next-poll links, the docked
          score) sit ahead of the content. Not an href="#…": the hash is the
          tab router, so the link moves focus itself. */}
      <a className="skip-link" href="#" onClick={(e) => {
        e.preventDefault();
        const m = document.getElementById("main-content");
        if (m) { m.focus({ preventScroll: true }); m.scrollIntoView({ block: "start" }); }
      }}>Skip to content</a>
      <Header isDark={isDark} onToggleTheme={cycleTheme} rd={rd} key={"head-" + rd} />
      <Tabs tabs={TABS} active={tab} onChange={goTab} tppMatchup={tppMatchup} tppBasis={tppBasis} key={"tabs-" + rd} />
      <main className="content" id="main-content" tabIndex={-1}>
        {/* The panel the tab strip points at. There was no role="tabpanel" on
            the page at all, so aria-controls had no target and a screen reader
            that moved to the "tab panel" landed nowhere. tabIndex=0 makes the
            panel itself focusable, which is what the pattern asks for when the
            panel's first child isn't.
            But tabIndex=0 also makes the panel the nearest focusable ancestor
            of every inert pointer click inside it: click a heading or blank
            space in a view and Chrome focuses the whole panel, and every
            hover-claim key guard on the page then reads "real keyboard focus
            elsewhere" and stands down. A poke stamps pointer down AND up (the
            focus can land at either end of a drag), and the gesture itself is
            never touched: blurring the panel while the button is still down
            would abort the mousedown caret path and kill text selection in
            the whole view. At pointer-up a pointer-parked panel whose gesture
            selected no text blurs back to BODY (keyboard-arrival carries no
            poke, so the ARIA panel-in-tab-order keeps focus through clicks;
            a drag's catch keeps its park while the selection lives — keystrokes
            are vetoed under a live selection anyway). */}
        <div className={panelKey === loadPanel.current ? "content" : "view-enter content"} key={panelKey}
             role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}
             tabIndex={0}
             onPointerDownCapture={() => { viewPanelPokedAt = Date.now(); }}
             onPointerUpCapture={(e) => {
               viewPanelPokedAt = Date.now();
               const el = e.currentTarget;
               setTimeout(() => {
                 if (viewPanelFocusIsPointer && document.activeElement === el && window.getSelection().isCollapsed) el.blur();
               }, 0);
             }}
             onFocus={(e) => {
               viewPanelFocusIsPointer = e.target === e.currentTarget && Date.now() - viewPanelPokedAt < 400;
             }}
             onBlur={(e) => {
               if (e.target === e.currentTarget) viewPanelFocusIsPointer = false;
             }}>
          <ViewBoundary>
            {tab === "now" && (
              <SnapshotView rangeId={rangeId} setRangeId={setRangeId} showScatter={t.showScatter}
                            tppMatchup={tppMatchup} setTppMatchup={setTppMatchup}
                            tppBasis={tppBasis} setTppBasis={setTppBasis} />
            )}
            {tab === "cycles" && <PastCyclesView />}
            {tab === "allpolls" && <AllPollsView focus={focusPoll} onBack={focusPoll ? backFromPoll : null}
              backLabel={focusPoll && focusPoll.back ? focusPoll.back.from : null}
              tppBasis={tppBasis} setTppBasis={setTppBasis} />}
            {termPop && <TermPop id={termPop.id} onClose={() => setTermPop(null)}
              onMore={() => window.AP.openTermPage(termPop.id, termPop.from)} />}
            {tab === "info" && <InfoView focus={focusTerm ? focusTerm.id : null}
              onBack={focusTerm ? backFromTerm : null}
              backLabel={focusTerm && focusTerm.back ? focusTerm.back.from : null} />}
          </ViewBoundary>
        </div>
        <MethodNote onInfo={tab === "info" ? null : () => goTab("info")} key={"foot-" + rd} />
      </main>

      {keySheet && (
        <div className="rd-keysheet-scrim" onClick={() => setKeySheet(false)}>
          <div className="rd-keysheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
               tabIndex={-1} ref={keySheetEl} onClick={(e) => e.stopPropagation()}>
            <div className="rd-keysheet-head">
              <h2 className="rd-keysheet-t">Keyboard shortcuts</h2>
              <button type="button" className="rd-keysheet-x" aria-label="Close"
                      onClick={() => setKeySheet(false)}>×</button>
            </div>
            <dl className="rd-keysheet-rows">
              {KBD_ROWS.map((r) => (
                <div className="rd-keysheet-row" key={r.what}>
                  <dt>{r.keys.map((k) => <kbd className="rd-keysheet-key" key={k}>{k}</kbd>)}</dt>
                  <dd>{r.what}</dd>
                </div>
              ))}
            </dl>
            <p className="rd-keysheet-foot">Hover gives a card its keys; a live text selection and a blinking caret keep every key quiet.</p>
          </div>
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme}
          options={["auto", "light", "dark"]}
          onChange={(v) => setTweak("theme", v)} />
        <p className="tweak-note">
          {t.theme === "auto" ? "Follows your device setting." : t.theme === "dark" ? "Newsprint at night." : "Warm paper."}
        </p>
        <TweakSection label="Layout" />
        <TweakRadio label="Style" value={t.layout}
          options={["editorial", "panelled"]}
          onChange={(v) => setTweak("layout", v)} />
        <p className="tweak-note">
          {t.layout === "editorial"
            ? "Broadsheet – hairline rules, no card chrome."
            : "Dashboard – each view in its own bordered card."}
        </p>
        <TweakSection label="Paper" />
        <TweakRadio label="Tone" value={t.accent}
          options={["warm", "cool"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Hero chart" />
        <TweakToggle label="Show individual polls" value={t.showScatter}
          onChange={(v) => setTweak("showScatter", v)} />
      </TweaksPanel>
    </div>
  );
}

/* Signal that the app has mounted. body.js fades the static <article>
   version of the page to full transparency and pulls the app up over the
   gap it leaves (--ss-h set below) - so the swap happens on one class
   change, with no blank article-height seam opening at the top. The text
   stays in the DOM at full size, because Safari's reader rejects every
   harder hide (clip, off-screen position, display:none). The class itself
   is added by App's first-commit layout effect (see the top of App) -
   setting it here, a task before render() commits, collapsed the page to
   the tide band on a blank screen for the frames in between. */
const staticSummary = document.querySelector(".static-summary");
if (staticSummary) {
  const setStaticSummaryHeight = () =>
    document.documentElement.style.setProperty(
      "--ss-h",
      staticSummary.offsetHeight + "px"
    );
  setStaticSummaryHeight();
  /* webfonts swap in after mount and re-lay the article out; the pull-up
     must follow its height or a seam opens where it stood */
  new ResizeObserver(setStaticSummaryHeight).observe(staticSummary);
  /* opacity:0 hides it from EYES and from nothing else. A screen reader still
     walked the whole article - 3,690 characters, seven headings and a second
     <h1> - and then walked the app and heard every figure again. The comment
     here used to say the fallback was what "reader engines and assistive tech
     are for", but that is only true when the app has NOT mounted: once it has,
     the app is the accessible copy and this one is a duplicate of it.
     So it is hidden from the accessibility tree at the moment the app takes
     over, and only then - with no JS, nothing runs and the article stands as
     the page. Reader engines extract from rendered text rather than from the
     accessibility tree, which is what lets one attribute separate the two
     audiences. It does carry one focusable anchor (the archives link in the
     closing note), and opacity:0 plus pointer-events:none would not stop
     keyboard focus landing on that invisible control - so inert comes on
     too, blocking focus and clicks for as long as the app owns the page.
     Two places take it back off - the static-view toggle (owned in Header's
     header block, where the article becomes the page) and RootBoundary's
     catch (where the app goes away). */
  staticSummary.setAttribute("aria-hidden", "true");
  staticSummary.inert = true;
}
/* body.rd gates every rd.css rule, so unlike body.js (see above) it must
   go on BEFORE render, not from App's first-commit layout effect: React
   walks child layout effects before the parent's, so everything that
   measures its own layout in one (the house-lean sparklines, the width
   hooks) measured the pre-rd UNSTYLED layout - an inline span where the
   CSS wanted an anchored block - and painted the first frames off those
   numbers. On the all-polls tab that was nine sparkline svgs ~900px wide
   in a ~1000px document, the right edge of the page flashing past the
   screen for a frame or two on every load until the rd class landed and
   the re-fit corrected them. There is no risk in setting it early: rd
   derives synchronously (only the ?design= query), and not one rd-scoped
   rule styles the static article or anything else the pre-render frames
   show - the css only speaks for the app's own elements. App's layout
   effect below keeps owning the class after mount (it re-toggles the
   same value, and a ?design= start gets whatever the URL says). */
try {
  document.body.classList.toggle(
    "rd",
    new URLSearchParams(window.location.search).get("design") !== "old" || !!window.JUR
  );
} catch (_) {
  document.body.classList.add("rd");
}
/* The first render is synchronous, so the app commits inside this script -
   before the document finishes parsing, let alone loading. A browser holding
   the previous page on screen lets go once the new one has drawn something
   or has finished loading, whichever comes first. html.boot means nothing
   draws before the app, but a render left to the scheduler committed after
   load: Chrome showed the bare page in between on two of three cross-site
   loads, and on none with this render synchronous. */
const appRoot = ReactDOM.createRoot(document.getElementById("root"));
ReactDOM.flushSync(() => appRoot.render(
  <RootBoundary><App /></RootBoundary>
));
