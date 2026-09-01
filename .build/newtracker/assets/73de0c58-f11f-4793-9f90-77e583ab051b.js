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
// or the page would read "26 Aug 2026 · 2 days ago" on 26 August
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
  return { label, state };
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
  const lp = D.aggPrimary[D.aggPrimary.length - 1];
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
  const glyphTitle = "Primary vote aggregate · " +
    glyph.map((p) => `${D.PARTIES[p.id].short} ${p.v.toFixed(1)}`).join(", ");

  // pendulum = the head-to-head against Labor's STRONGEST challenger – the same
  // pick the hero makes: whichever opponent polls the highest 2PP against Labor.
  // The needle swings toward whoever leads THAT contest (Labor left, challenger right).
  const g2 = D.agg2pp[D.agg2pp.length - 1];
  const gon = D.alt2pp.alp_on[D.alt2pp.alp_on.length - 1];
  const challengers = [
    { abbr: "L/NP", color: "var(--lnp)", lab: g2.alp, opp: g2.lnp },
  ];
  if (gon) challengers.push({ abbr: "ON", color: "var(--onp)", lab: gon.a, opp: gon.b });
  const topOpp = challengers.slice().sort((x, y) => y.opp - x.opp)[0];
  const pMargin = +(topOpp.lab - topOpp.opp).toFixed(1);        // + → Labor leads
  const labLeads = pMargin >= 0;
  const pendColor = labLeads ? "var(--alp)" : topOpp.color;
  const oppColor = topOpp.color;
  // ±12 pts → full ±34° deflection. Labor (positive margin) swings LEFT,
  // the challenger swings RIGHT – matching the hero's Labor-left / opp-right order.
  const pendDeg = Math.max(-1, Math.min(1, pMargin / 12)) * 34;
  const pendTitle = `2PP swing · ALP v ${topOpp.abbr} · ` +
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
      <title>{glyphTitle + " · " + pendTitle}</title>
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

function Header({ isDark, onToggleTheme }) {
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

  return (
    <header className="site-head">
      <div className="brand">
        <h1 className="wordmark stacked">
          <button className="wm-glyph" onClick={openStory}
                  title="Wind the dial back through the term"
                  aria-label="Wind the dial back: replay the term on the masthead dial">
            <span className="wm-textcol">
              <span className="wm-name" ref={wmName}>auspol</span>
              <span className="wm-track" ref={wmTrack}>tracker</span>
            </span>
            {/* 57px sizes the ink to 74% of the wordmark's height, the
                proportion the lockup was drawn with before both words went
                to 30px. glyphRef stays on THIS instance - the story
                overlay's FLIP origin is the lockup's dial, never the tab
                bar's placeholder. */}
            <GlyphDial className="wm-dial" svgRef={glyphRef} width="57" height="39.7" />
          </button>
          <span className="wm-sr">– Australian federal polling</span>
        </h1>
        <p className="tagline">Aggregated opinion polling for the next Australian <br className="tagline-br"></br>federal election, set against the last five.</p>
        <div className="head-meta-compact" aria-hidden="true">
          <span className={"fresh-dot " + fresh.state}></span>
          Updated {D.latest.published} · {D.latest.pollsTracked} polls
        </div>
      </div>
      <div className="head-right">
        <div className="head-meta">
          <div className="meta-item meta-updated">
            <span className="meta-k">Last poll</span>
            <span className="meta-v">
              <span className={"fresh-dot " + fresh.state} aria-hidden="true"></span>
              {D.latest.published}
              <span className="fresh-rel">· {fresh.label}</span>
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
            <span className="meta-v">{D.latest.pollsTracked} · {D.latest.housesTracked} pollsters</span>
          </div>
        </div>
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
window.RollNum = RollNum;      // the hero's Delta reads it off the window (see Delta)
function RollNum({ value, className, style, spinIn }) {
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
          <span className="roll-sep" key={n - 1 - i} aria-hidden="true">{ch}</span>
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
   sample-weighted, house-effect-adjusted nowcast (D.latest) – NOT the last
   monthly-mean dot. An alternative matchup gets a nowcast too WHERE the
   series supports one (D.altLatest is null for a matchup too thin to
   weight); otherwise its last monthly point. */
function tppLatest(id) {
  const D = window.AUSPOL, M = MATCHUPS[id];
  if (!M) return null;
  if (M.real) return { a: D.latest.alp2pp, b: D.latest.lnp2pp, ci95: D.latest.alp2ppCi95 };
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
  return (
    <div className="hero-gauge" role="img" ref={wrapRef}
         style={box ? { width: box.w + "px", marginLeft: box.ml + "px", maxWidth: "none" } : undefined}
         aria-label={`${aName} ${a.toFixed(1)} per cent two-party preferred, 95% interval ${lo} to ${hi}. `
                     + `A tie is 50. ${(a - ci > 50 || a + ci < 50)
                          ? "The interval does not include a tie."
                          : "The interval includes a tie."}`}>
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
      {/* Only the tie is labelled. The names sit in the readout directly
          above, in 62px type, and the point estimate needs no mark of its own:
          a symmetric interval puts it at the span's midpoint by construction,
          so a tick there restated the bar while cutting it in half. */}
      <div className="hg-foot"><span className="hg-tie-lab">tie</span></div>
    </div>
  );
}

function Hero({ rangeId, setRangeId, showScatter = true, matchup, setMatchup }) {
  const sepRef = React.useRef(null);   // the rule between the figures; the gauge aligns its tie to it
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const xDomain = rangeDomain(rangeId);

  /* The REAL published measure (ALP v L/NP) always leads and is the default;
     the modelled head-to-heads follow, strongest challenger first.

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
  const orderedMatchups = [
    "alp_lnp",
    ...Object.keys(MATCHUPS).filter((id) => id !== "alp_lnp" && MATCHUPS[id].vsLabor && hasData(id))
       .sort((x, y) => oppVsLabor(y) - oppVsLabor(x)),
    ...Object.keys(MATCHUPS).filter((id) => !MATCHUPS[id].vsLabor && hasData(id)),
  ];
  const matchupOptions = orderedMatchups.map((id) => ({
    id, label: MATCHUPS[id].label, dots: MATCHUPS[id].dots,
  }));

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
  const [morph, setMorph] = useState(null);        // { from, to, t }
  const morphRaf = useRef(0);
  /* The synthetic 2PP overlay: "what would these polls' PRIMARIES imply if
     2025's preference flows still held?" – a diagnostic shown on request
     only, against the real ALP v L/NP series, and never framed as a
     correction to it. It is not a matchup (no house published it), so it
     does not belong in MATCHUPS: local state, one dashed ALP-side line (the
     L/NP side is its exact complement), and it steps aside during a matchup
     morph, where there is nothing honest for it to reshape into. */
  const [showSynth, setShowSynth] = useState(false);
  React.useEffect(() => () => cancelAnimationFrame(morphRaf.current), []);
  const chooseMatchup = (id) => {
    const from = matchup;
    setMatchup(id);
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (id === from || still || !MATCHUPS[from] || !MATCHUPS[id]) { setMorph(null); return; }
    cancelAnimationFrame(morphRaf.current);
    const t0 = performance.now();
    setMorph({ from, to: id, t: 0 });
    const step = (now) => {
      const raw = Math.min(1, (now - t0) / MORPH_MS);
      if (raw >= 1) { setMorph(null); return; }          // land on the real thing
      setMorph({ from, to: id, t: MORPH_EASE(raw) });
      morphRaf.current = requestAnimationFrame(step);
    };
    morphRaf.current = requestAnimationFrame(step);
  };

  const m = MATCHUPS[matchup];
  const ptsOf = (id) => filterPts(MATCHUPS[id].data, xDomain[0]);
  const pts = ptsOf(matchup);
  /* Both matchups on ONE grid of months, each holding its own end value across
     the months the other one runs for - so the two paths carry the same shape
     of command and can be interpolated point for point. The stretch a matchup
     was never asked in is never SEEN: the clip window travels with the morph,
     so the line retreats to where the question was actually put, and grows
     back out when you switch away. */
  const blend = (() => {
    if (!morph) return null;
    const A = ptsOf(morph.from), B = ptsOf(morph.to);
    if (!A.length || !B.length) return null;
    const t = morph.t, lerp = (p, q) => p + (q - p) * t;
    const index = (arr) => { const o = {}; arr.forEach((d) => (o[d.ym] = d)); return o; };
    const ia = index(A), ib = index(B);
    const hold = (idx, arr, ym) => idx[ym] || (ym < arr[0].ym ? arr[0] : arr[arr.length - 1]);
    const yms = [...new Set(A.concat(B).map((d) => d.ym))].sort();
    return {
      pts: yms.map((ym) => {
        const da = hold(ia, A, ym), db = hold(ib, B, ym);
        return { ym, x: (ia[ym] || ib[ym]).x, a: lerp(da.a, db.a), b: lerp(da.b, db.b),
                 // a ribbon that vanished mid-morph would read as the switch
                 // having made the estimate certain for 320ms
                 ci95: (da.ci95 == null || db.ci95 == null) ? null : lerp(da.ci95, db.ci95) };
      }),
      clip: [lerp(A[0].x, B[0].x), lerp(A[A.length - 1].x, B[B.length - 1].x)],
      a: mixC(MATCHUPS[morph.from].a.color, MATCHUPS[morph.to].a.color, t),
      b: mixC(MATCHUPS[morph.from].b.color, MATCHUPS[morph.to].b.color, t),
    };
  })();
  const drawPts = blend ? blend.pts : pts;
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
  /* The current figure for ANY matchup, headline or not – one accessor, so a
     chip below can never disagree with the readout above when it is that
     matchup's turn to be the headline. Lives at module scope (tppLatest) so
     the docked tab-bar score reads it too. */
  const latestOf = tppLatest;
  /* Every contest that isn't the one on the chart, in the same order the tabs
     use, and only where there is a current figure to print – a chip with no
     number would be the bare tab it is replacing. */
  const otherContests = orderedMatchups
    .filter((id) => id !== matchup)
    .map((id) => ({ id, v: latestOf(id) }))
    .filter((o) => o.v && o.v.a != null);
  const altL = (m.altKey && D.altLatest) ? D.altLatest[m.altKey] : null;
  const adjusted = m.real || !!(D.adjusted && m.altKey && D.adjusted[m.altKey]);
  const latest = m.real
    ? { a: D.latest.alp2pp, b: D.latest.lnp2pp }
    : altL || m.data[m.data.length - 1];

  // mirrored pairs, so each trend line sits inside its own cloud of readings.
  // Driven by the active matchup's own accessor – a poll that didn't publish
  // THIS head-to-head is simply skipped, which is why the ON matchups show
  // fewer dots rather than none.
  const cloudFor = (id) => (!showScatter ? [] : D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => {
      const pair = MATCHUPS[id].scatter(p);
      // `side` 0 is the Labor-side reading and 1 the rival's – with the poll's
      // own identity, that is how a dot recognises itself in the other matchup
      return pair ? pair.map((s, side) => ({ x: p.x, y: s.y, color: s.color, label: s.label, meta: p, side })) : [];
    }));
  // memoised on what actually changes them: a morph frame must not rebuild
  // 240 dots sixty times a second (see the chart's own memo on the same arrays)
  const settledCloud = React.useMemo(() => cloudFor(matchup), [matchup, rangeId, showScatter]);

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
    if (!morph) return null;
    const key = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.side;
    const A = cloudFor(morph.from), B = cloudFor(morph.to);
    const ia = new Map(A.map((d) => [key(d), d])), ib = new Map(B.map((d) => [key(d), d]));
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return { travel, leaving, arriving };
  }, [morph ? morph.from : null, morph ? morph.to : null, rangeId, showScatter]);

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
    { id: "a", label: m.a.name, color: colA, points: series(drawPts, "a"), width: 3.6 },
    { id: "b", label: m.b.name, color: colB, points: series(drawPts, "b"), width: 3.6 },
  ];
  /* The implied-2PP overlay. Same red as the published Labor line – colour
     still says who; the dash says this one is computed from primaries, not
     measured – because the visible GAP to the solid line is the whole point
     of the diagnostic. Its election-month point is the flow table read back
     onto the count's own primaries (54.2), so it departs from the published
     anchor (55.2) on purpose, showing the table's miss at the one point it
     can be checked. */
  const synthOverlay = (showSynth && matchup === "alp_lnp" && !morph && D.synth2pp && D.synth2pp.length > 1)
    ? [{ id: "synth", label: "Implied ALP (fixed 2025 flows)", color: "var(--alp)",
         points: filterPts(D.synth2pp.map((d) => ({ x: d.x, y: d.alp })), xDomain[0]),
         width: 2.2, dashed: true, opacity: 0.8 }]
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
  const bandPts = (key) => drawPts
    .filter((d) => d.ci95 != null)
    .map((d) => ({ x: d.x, y0: d[key] - d.ci95, y1: d[key] + d.ci95 }));
  const heroAreas = !heroSeries.length ? [] : [
    { id: "ci-a", color: colA, className: "ci-band", edge: false, smooth: true, points: bandPts("a") },
    { id: "ci-b", color: colB, className: "ci-band", edge: false, smooth: true, points: bandPts("b") },
  ].filter((a) => a.points.length >= 2);

  // Major events, clipped to the span this matchup actually plots. The headline
  // 2PP runs the whole archive so it keeps all of them; ALP v ON only begins
  // when pollsters started asking it, and a marker standing over a stretch with
  // no line would imply a reading that was never taken. A matchup with no trend
  // line at all gets none.
  const heroEvents = (!heroSeries.length || !pts.length) ? [] : (() => {
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    return (D.events || []).filter((e) => e.major && e.x >= x0 && e.x <= x1);
  })();

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
  const domainOf = (id) => {
    const M = MATCHUPS[id], v = [];
    M.data.forEach((d) => {
      v.push(d.a, d.b);
      if (d.ci95 != null) v.push(d.a - d.ci95, d.a + d.ci95, d.b - d.ci95, d.b + d.ci95);
    });
    D.individualPolls.forEach((p) => {
      const pair = M.scatter(p);
      if (pair) pair.forEach((s) => v.push(s.y));
    });
    if (M.real && D.synth2pp) D.synth2pp.forEach((d) => v.push(d.alp, 100 - d.alp));
    const lo = Math.min(...v), hi = Math.max(...v), padDot = 0.5;
    return [Math.floor((lo - padDot) / 5) * 5, Math.ceil((hi + padDot) / 5) * 5];
  };
  const yTarget = domainOf(matchup);
  // ticks come from the TARGET window so their number holds still while the
  // window itself slides; today the Labor matchups share 40–60 and nothing moves
  const yDomain = blend
    ? (() => { const f = domainOf(morph.from), t = morph.t;
               return [f[0] + (yTarget[0] - f[0]) * t, f[1] + (yTarget[1] - f[1]) * t]; })()
    : yTarget;
  const yTicks = [];
  for (let v = yTarget[0]; v <= yTarget[1]; v += 5) if (v > yTarget[0] && v < yTarget[1]) yTicks.push(v);
  const lead = +(latest.a - latest.b).toFixed(1);
  const leadName = lead >= 0 ? m.a.name : m.b.name;
  /* Uncertainty for whichever matchup is showing. Every nowcast on this hero
     is a weighted mean of a handful of polls, so none of them is exact – a
     matchup that switched from an interval to a bare number would read as the
     precise one. Null only where the series is too thin to nowcast at all,
     in which case the readout is a plain monthly point and says so. */
  const unc = m.real
    ? (D.latest.alp2ppCi95 != null
        ? { ci95: D.latest.alp2ppCi95, n: D.latest.method.nPolls, changeSig: D.latest.changeSig }
        : null)
    : (altL && altL.ci95 != null
        ? { ci95: altL.ci95, n: altL.n, changeSig: altL.changeSig }
        : null);
  const monthDelta = m.real ? +(D.latest.alp2pp - D.latest.alp2ppPrev).toFixed(1)
    : (altL && altL.aPrev != null) ? +(altL.a - altL.aPrev).toFixed(1)
    : +(latest.a - m.data[m.data.length - 2].a).toFixed(1);

  return (
    <section className="card hero">
      <div className="hero-top">
        <div className="hero-headline">
        {/* Labels the METHOD behind the number above, on one dimension. A
            matchup earns "weighted aggregate" when its own house effects are
            estimable (ALP v L/NP and ALP v ON both are); one that only two
            houses ask can't be debiased or nowcast, so it says so. */}
        <h2 className="card-title hero-title">Two-party preferred</h2>
          {/* NOT keyed on the matchup any more: a remount would replace these
              figures, and the whole point is that they travel. The old
              readout-in fade lives on where it still belongs, on the lead line
              below, whose words genuinely are replaced. */}
          <div className="hero-readout">
            <div className="ro-party alp-side">
              <span className="ro-dot" style={{ background: colA }}></span>
              <span className="ro-name">{m.a.name}</span>
              <RollNum className="ro-num" value={latest.a.toFixed(1)} style={{ color: inkOf(colA) }} spinIn />
            </div>
            <span className="ro-sep" aria-hidden="true" ref={sepRef}></span>
            <div className="ro-party lnp-side">
              <RollNum className="ro-num" value={latest.b.toFixed(1)} style={{ color: inkOf(colB) }} spinIn />
              <span className="ro-name">{m.b.name}</span>
              <span className="ro-dot" style={{ background: colB }}></span>
            </div>
          </div>
          {unc && (
            <HeroGauge a={latest.a} ci={unc.ci95} color={lead >= 0 ? colA : colB}
                       aName={m.a.name} bName={m.b.name} sepRef={sepRef} />
          )}
          {/* The lead now shares a line with how it was made and how well it
              is known: an aggregate of a handful of polls is not known to a
              tenth of a point, so the figure is rounded to whole points and
              the interval sits beside it rather than in a footnote. It covers
              how far the polls in the window disagree plus their sampling
              error; it cannot cover bias shared across the industry, which no
              aggregate can measure about itself. Not keyed on the matchup,
              for the same reason the readout above isn't - the margin is a
              figure that travels between the two questions, so it rolls
              rather than being replaced. The readout-in fade lives here, on
              the line whose words genuinely change. */}
          <div className="hero-interval">
            <span className="lead-tag">
              {leadName} leads by <RollNum value={String(Math.round(Math.abs(lead)))} spinIn />
              {unc ? (
                <>
                  {/* The figure gets the same treatment as the method word
                      beside it: it names a thing Info defines (margin of
                      error), so it is the shortest way to the definition. */}
                  {" "}
                  <button type="button" className="hi-range hi-term"
                          title="What a margin of error means"
                          onClick={() => window.AP.openTerm &&
                            window.AP.openTerm("margin-of-error", "two-party preferred")}>
                    ± {unc.ci95.toFixed(1)} pts
                  </button>
                </>
              ) : " pts"}
            </span>
            {/* The label names the method; now it also explains it. Everything
                this figure is built on has a definition in Info, and the word
                the reader is looking at is the shortest way to it. */}
            <button type="button" className="hi-method hi-term"
                    title={"What " + (adjusted ? "a weighted aggregate" : "a monthly average") + " means"}
                    onClick={() => window.AP.openTerm &&
                      window.AP.openTerm(adjusted ? "weighted-aggregate" : "monthly-average",
                                         "two-party preferred")}>
              {adjusted ? "Weighted aggregate" : "Monthly average"}
            </button>
            {!adjusted && <span className="eyebrow-warn">Limited data</span>}
            {unc && (
              <span className="hi-note">95% interval</span>
            )}
          </div>
          <div className="hero-sub">
            <Delta value={monthDelta} suffix=" pt" small roll spinIn />
            <span className="hero-sub-note">
              {(m.real || (altL && altL.aPrev != null)) ? "vs. one month ago" : "vs. previous reading"}
              {/* A month-on-month move smaller than its own interval is not a
                  finding. Say so next to the arrow, not three scrolls down -
                  and let the margin the caveat invokes carry the reader to its
                  definition, as the terms in the interval above do. */}
              {unc && unc.changeSig === false && (
                <span className="hero-caveat"> (within the{" "}
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
        {/* The OTHER contests, carrying their figures rather than just their
            names. One Nation sits level with Labor on the primary vote, so in
            a good many seats the final two are not Labor and the Coalition and
            "the 2PP" is doing less work than a single headline implies. These
            were previously a bare tab you had to press to find out what was
            behind it; the number is the reason to press it. */}
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
        </div>
        <div className="hero-controls">
          <TextToggle value={matchup} onChange={chooseMatchup} ariaLabel="Matchup"
            options={matchupOptions} />
          <TextToggle caps value={rangeId} onChange={setRangeId} ariaLabel="Time range"
            /* rangeDomain takes any month count, and buildXTicks already labels
               every month once the span is under a year, so six months arrives
               with its own tick per month rather than every second one */
            options={[{ id: "3", label: "3mo" }, { id: "6", label: "6mo" },
                      { id: "12", label: "12mo" }, { id: "all", label: "All" }]} />
          {/* The synthetic overlay is only meaningfully comparable against the
              published ALP v L/NP series, so the control only exists there.
              Off by default: it is a diagnostic, not a third headline. */}
          {matchup === "alp_lnp" && D.synth2pp && D.synth2pp.length > 1 && (
            <label className={"pg-check" + (showSynth ? " on" : "")} title="Also draw what the same polls’ primary votes imply when run through one fixed preference-flow table (the 2025 election’s actual flows). A diagnostic, not a correction.">
              <input type="checkbox" checked={showSynth} onChange={(e) => setShowSynth(e.target.checked)} />
              Compare{" "}
              <button type="button" className="hi-term"
                      title="What an implied two-party figure is"
                      onClick={(e) => { e.preventDefault();
                        window.AP.openTerm && window.AP.openTerm("implied-2pp", "two-party preferred"); }}>
                implied 2PP
              </button>
            </label>
          )}
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
        events={heroEvents}
        scatter={scatter} series={heroSeriesAll} spine={heroSpine} pollFacet="twopp"
        scatterOut={scatterOut} scatterMove={scatterMove}
        areas={heroAreas}
        fade={blend ? morph.t : 1} clipX={blend ? blend.clip : null}
        tooltipTitle={(i) => window.AP.monthLabelFull((drawPts[i] || drawPts[drawPts.length - 1]).ym)}
        /* A month's figures and how well that month is known, in the same
           tooltip – the election anchor is a count, so it reports no interval
           rather than an interval of zero, which would read as a claim. */
        extraRows={(i) => {
          const d = drawPts[i];
          if (!d || d.ci95 == null || !d.ci95) return [];
          return [{ label: "95% interval", value: "± " + d.ci95.toFixed(1) + " pts"
                    + (d.k ? " · " + d.k + " poll" + (d.k === 1 ? "" : "s") : "") }];
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
            <span className="hl-item"><span className="hl-band"></span>95% interval</span>
          )}
          {synthOverlay.length > 0 && (
            <span className="hl-item"><span className="hl-dashed" style={{ borderColor: "var(--alp)" }}></span>Implied from primaries at 2025 flows{D.synthLatest && D.synthLatest.alp != null ? ` · ${D.synthLatest.alp.toFixed(1)}` : ""}</span>
          )}
        </div>
        <p className="hero-caption">
          {m.real
            ? "Each dot is one published poll; the line is a smoothed average across all pollsters, "
              + "shaded with the interval around it. Where the two bands overlap, the lead is "
              + "inside its own margin of error – the polls cannot separate the parties that month."
            : `Each dot is one pollster’s published ${m.label} head-to-head` +
              (adjusted
                ? ", adjusted for each house’s lean on this matchup as the headline two-party is."
                : ", averaged monthly – too few houses ask it to weight or correct.") +
              (scatterPolls ? ` ${scatterPolls} poll${scatterPolls === 1 ? "" : "s"} so far.` : "")}
        </p>
      </div>
    </section>
  );
}

/* ---- report an error ----------------------------------------------------
   A tracker of other people's numbers is going to carry some of them wrong,
   and until now a reader who noticed had nowhere to say so. The page is
   static - GitHub Pages serves files and will not process a POST - so the
   submission goes to Formspree, which does own a server and forwards it on.
   window.AP_FEEDBACK is the endpoint, set in build.mjs (FORMSPREE_ID); when it
   is empty this renders nothing at all, so a build without an id shows no form
   rather than one that quietly discards what someone typed.

   Posted with fetch + Accept: application/json rather than as a plain form.
   A bare form POST hands the reader to Formspree's own thank-you page, which
   means leaving the tracker to be told the message arrived; the whole page
   needs JavaScript anyway, so there is nothing to lose by asking for it here.

   window.AP.reportPoll opens it already filled in for one poll - registered on
   the shared namespace for the same reason openPoll is, the archive row being
   several components away from the footer with no prop path between them. */
const FB_KINDS = ["Wrong figure", "Missing poll", "Site bug", "Something else"];

/* The details box sizes itself to what has been typed. It used to open as a
   74px slab with a drag handle in the corner - more than twice the height of
   the email field beneath it, all of it empty, on a page that otherwise draws
   a field as a line and some text. One line to start, grown a line at a time,
   and the corner grabber taken away because there is nothing left to drag it
   for.

   Two things the obvious version gets wrong. `scrollHeight` leaves the
   PLACEHOLDER out, so an empty box collapses under its own example text -
   fine at 540px where the hint is one line, wrong on a phone where it wraps -
   so an empty box is measured with the placeholder standing in for the value.
   That swap is a synchronous read-and-restore inside one frame, never
   painted, and React is not involved because the value is only borrowed while
   it is already "". And under border-box the height covers the border while
   scrollHeight does not, so the border is added back rather than costing a
   pixel on every grow. */
function fbAutosize(box) {
  if (!box) return;
  const cs = getComputedStyle(box);
  const border = parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.borderBottomWidth || 0);
  const max = parseFloat(cs.maxHeight) || Infinity;
  const borrow = !box.value && box.placeholder;
  if (borrow) box.value = box.placeholder;
  box.style.height = "auto";
  const want = box.scrollHeight + (cs.boxSizing === "border-box" ? border : 0);
  if (borrow) box.value = "";
  box.style.height = Math.min(want, max) + "px";
  // only past the cap does it become a scrolling box rather than a growing one
  box.style.overflowY = want > max ? "auto" : "hidden";
}

function ReportError({ onInfo }) {
  const endpoint = window.AP_FEEDBACK;
  const { D } = window.AP;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(FB_KINDS[0]);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("idle");     // idle | sending | sent | error
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const boxRef = useRef(null);
  const uid = useId();

  /* Arriving from an archive row: open, seeded, and with the caret sitting
     after the poll's name so the reader types the one thing the page cannot
     fill in for them. */
  const [arrival, setArrival] = useState(0);
  React.useEffect(() => {
    if (!endpoint) return;
    window.AP.reportPoll = (poll) => {
      if (!poll) return;
      /* "YouGov, 18-24 Aug 2026 – ". The year is the point of the difference:
         the seeded line is what identifies a row in data/polls.json, and a
         fieldwork range without one stops doing that the moment the archive
         holds a second August. Taken from the row's own year where it carries
         one, and off the ISO fieldwork-end date otherwise, because the two
         tables this is opened from have different row shapes and only one of
         them names the year.

         "fielded" is dropped: everything after the comma is a date, so the
         word was only telling the reader which kind, and the form's own label
         already asks for the pollster and field dates. */
      const yr = poll.year != null ? poll.year
        : /^\d{4}-/.test(poll.released || "") ? Number(poll.released.slice(0, 4))
        : null;
      const when = poll.field ? poll.field + (yr ? " " + yr : "")
        : poll.fullDate ? poll.fullDate : "";
      setKind(FB_KINDS[0]);
      setMsg(`${poll.pollster}${when ? ", " + when : ""} – `);
      setStatus("idle");
      setOpen(true);
      setArrival((n) => n + 1);   // drives the scroll+focus effect below
    };
    return () => { delete window.AP.reportPoll; };
  }, [endpoint]);

  /* The move to the form is an EFFECT, not a callback on the click: the
     textarea does not exist until the state above has rendered, and an effect
     is the only point that is guaranteed to be after the commit that creates
     it and attaches the ref. A counter rather than a boolean, so a second
     report from a second row re-runs it. */
  React.useEffect(() => {
    if (!arrival) return;
    const box = boxRef.current;
    if (!box) return;
    box.scrollIntoView({ block: "center", behavior: "smooth" });
    box.focus({ preventScroll: true });
    box.setSelectionRange(box.value.length, box.value.length);
  }, [arrival]);

  /* Runs on open and on every change, because `msg` is also set from outside
     (an archive row seeds it) and that text has to be measured too. The width
     matters as well - the same sentence wraps to more lines on a narrower
     card - so a resize re-measures rather than leaving a stale height behind
     after a rotation. */
  React.useLayoutEffect(() => {   // before paint: no first frame at the wrong height
    if (!open) return;
    const box = boxRef.current;
    fbAutosize(box);
    const onResize = () => fbAutosize(boxRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, msg]);

  if (!endpoint) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    const body = new FormData(formRef.current);
    // Subject carries the category so a correction is triageable from the
    // inbox list; the context fields say which page state it was sent from
    // and which build of the data the reader was looking at, both of which
    // are the first two things worth knowing about a reported figure.
    body.set("_subject", `auspol tracker – ${kind}`);
    body.set("page", (window.location.hash || "#snapshot").replace(/^#/, ""));
    body.set("data_updated", D.latest.updatedISO);
    try {
      const res = await fetch(endpoint, { method: "POST", body, headers: { Accept: "application/json" } });
      if (res.ok) { setStatus("sent"); setMsg(""); return; }
      // Formspree answers a rejected submission with {errors:[{message}]};
      // anything else (rate limit, outage, a mistyped id) has no body worth
      // showing, so fall back to a line that points somewhere useful.
      let detail = "";
      try { detail = ((await res.json()).errors || []).map((x) => x.message).join(", "); } catch (_) {}
      setError(detail || `The form service returned an error (${res.status}). Please try again shortly.`);
      setStatus("error");
    } catch (_) {
      setError("Could not reach the form service – check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="fb">
        <p className="fb-thanks">
          <strong>Thank you – that’s arrived.</strong> Reports are checked against the
          pollster’s own release before a figure moves, so a correction lands at the next
          build rather than straight away.{" "}
          <button type="button" className="fb-link" onClick={() => setStatus("idle")}>
            Send another
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="fb">
      <p className="fb-lede">
        {/* The Info signpost rides the front of this line only away from
            Info: on the tab itself it could only point at where the reader
            is standing, so the caller passes a null onInfo there and the
            clause goes unrendered. */}
        {onInfo && (
          <>
            See{" "}
            <button type="button" className="hi-term" onClick={onInfo}>Info</button>
            {" "}for more info.{" "}
          </>
        )}
        Spot an error, a missing poll, or have any other feedback? Please{" "}
        {/* A toggle both ways: the thing that opened the form is the only
            thing in the sentence that looks like a control, so it is where a
            reader who has changed their mind will click. What is typed stays
            in state, so closing it is not the same as discarding it. */}
        <button type="button" className="fb-link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          let me know
        </button>.
      </p>

      {open && (
        <form className="fb-form" ref={formRef} onSubmit={submit}>
          <div className="fb-row">
            <span className="fb-label" id={uid + "-kindlab"}>What’s this about?</span>
            <div className="fb-chips" role="group" aria-labelledby={uid + "-kindlab"}>
              {FB_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={k === kind}
                        className={"fb-chip" + (k === kind ? " active" : "")}
                        onClick={() => setKind(k)}>{k}</button>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor={uid + "-msg"}>
              Details <span>– the pollster and field dates help most</span>
            </label>
            <textarea id={uid + "-msg"} name="message" required ref={boxRef} rows={1}
              value={msg} onChange={(e) => setMsg(e.target.value)}
              placeholder="e.g. Resolve, fielded 12–15 Aug – Labor’s primary is 27.9 here, the release says 28.9" />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor={uid + "-email"}>
              Email <span>– optional, only used to reply to you</span>
            </label>
            <input id={uid + "-email"} name="email" type="email" autoComplete="email"
              placeholder="you@example.com" />
          </div>

          <div className="fb-gotcha" aria-hidden="true">
            <label htmlFor={uid + "-gotcha"}>Leave this field empty</label>
            <input id={uid + "-gotcha"} name="_gotcha" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="fb-actions">
            <button type="submit" className="fb-send" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send report"}
            </button>
            <p className={"fb-note" + (status === "error" ? " is-error" : "")}
               role={status === "error" ? "alert" : undefined}>
              {status === "error" ? error : "Goes to my inbox via Formspree. Nothing is published."}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

/* What is left of the method footer. Its three sections of prose - about the
   tracker, reading the charts, sources - are now the Info tab's glossary,
   where a reader can find one definition without reading all of them and
   without scrolling past the whole page to get there.

   What stays is not information but furniture: the way to report an error,
   which belongs wherever the reader notices one, and the standing caveat on
   the figures, which has to sit under the figures rather than one tab away. */
function MethodNote({ onInfo }) {
  return (
    <footer className="method method-slim">
      <ReportError onInfo={onInfo} />
      <div className="disclaimer">
        Unofficial aggregate of published national polling. Aggregate figures are estimates, not
        measurements – treat decimal places gently.
      </div>
    </footer>
  );
}

// Sticky score anchor – RETIRED: the 2PP readout now docks into the sticky
// tab bar (TabScore in views.jsx) so it travels across every tab. ScoreBar
// removed rather than left dead – see git/file history if it's ever wanted.

// set once the body first carries its theme classes – see the effect below
let chromeSettled = false;

const TABS = [
  { id: "snapshot", label: "Snapshot" },
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
const TAB_IDS = TABS.map((t) => t.id);

function SnapshotView({ rangeId, setRangeId, showScatter, tppMatchup, setTppMatchup }) {
  return (
    <>
      <Hero rangeId={rangeId} setRangeId={setRangeId} showScatter={showScatter}
            matchup={tppMatchup} setMatchup={setTppMatchup} />
      <PrimaryVotePanel rangeId={rangeId} />
      <PollsterTable />
      <LeadershipSection rangeId={rangeId} />
      <DirectionPanel rangeId={rangeId} />
      {/* directly under direction: both are questions about the electorate's
          mood rather than its party choice, and both come from the houses that
          bother to publish more than a headline */}
      <UndecidedPanel rangeId={rangeId} />
      <NextPollsPanel />
    </>
  );
}

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "layout": "editorial",
    "theme": "auto",
    "accent": "warm",
    "showScatter": true
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rangeId, setRangeId] = useState("all");

  /* Which two-party contest the hero is showing. Owned here, not inside Hero,
     for two reasons that are the same one: the docked 2PP score in the tab
     bar must follow it, and the hero unmounts whenever the reader walks off
     the Snapshot tab – the score travels on. */
  const [tppMatchup, setTppMatchup] = useState("alp_lnp");

  // active tab, persisted in the URL hash so a refresh / share keeps the view
  const readHash = () => {
    const h = (window.location.hash || "").replace(/^#/, "");
    return TAB_IDS.includes(h) ? h : "snapshot";
  };
  const [tab, setTab] = useState(readHash);
  const [focusPoll, setFocusPoll] = useState(null);   // the poll a chart dot sent us to
  const [focusTerm, setFocusTerm] = useState(null);   // the glossary entry a link sent us to
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

  /* The navbar's "Next" label is a jump to the NextPollsPanel, which lives at
     the foot of the snapshot view. When the reader is on another tab the
     scroll has to wait for the snapshot to mount, so it is parked in a ref
     the tab layout-effect below empties; a generous scroll-margin-top (see
     .next-polls) keeps the panel's heading clear of the pinned tab bar. */
  const npJumpRef = useRef(false);
  const npScrollNow = () => {
    const el = document.querySelector("section.next-polls");
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
    window.AP.openPoll = (key, facet, from) => {
      if (!key) return;
      setFocusPoll({ key, facet: facet || null,
                     back: { tab: readHash(), y: window.scrollY, from: from || "the chart" } });
      setTab("allpolls");
      if (readHash() !== "allpolls") window.location.hash = "allpolls";
    };
    /* The same trip, for a definition. Any panel can send a reader to the term
       that explains a word it just used - the hero's method label is the first
       - and `from` names the place being left in the words the return button
       will use, so the way back can say where it goes rather than guessing. */
    window.AP.openTerm = (id, from) => {
      if (!id) return;
      setFocusTerm({ id, back: { tab: readHash(), y: window.scrollY, from: from || "where you were" } });
      setTab("info");
      if (readHash() !== "info") window.location.hash = "info";
    };
    /* The navbar "Next" label jumps straight to the NextPollsPanel on the
       snapshot. Same-tab scrolls happen in place; a cross-tab trip has to
       wait for the snapshot view to mount, so the scroll is parked for the
       layout effect below the way a restore scroll is. */
    window.AP.gotoNextPolls = () => {
      if (readHash() === "snapshot") { npScrollNow(); return; }
      npJumpRef.current = true;
      setTab("snapshot");
      window.location.hash = "snapshot";
    };
    return () => { delete window.AP.openPoll; delete window.AP.openTerm;
                   delete window.AP.gotoNextPolls; };
  }, []);
  /* The return trip puts the reader back on the pixel they left from. The
     scroll is handed to a layout effect rather than to requestAnimationFrame:
     the view has to be in the DOM before the document is tall enough to take
     the scroll, and rAF does not run at all in a tab nobody is looking at - so
     a frame-scheduled restore silently does nothing, which is precisely the
     kind of "works on my machine" this file has been bitten by before. */
  const restoreY = useRef(null);
  const backFromPoll = () => {
    const b = (focusPoll && focusPoll.back) || { tab: "snapshot", y: 0 };
    setFocusPoll(null);
    restoreY.current = b.y;
    setTab(b.tab);
    if (readHash() !== b.tab) window.location.hash = b.tab;
  };
  const backFromTerm = () => {
    const b = (focusTerm && focusTerm.back) || { tab: "snapshot", y: 0 };
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
      chromeSettled = true;
      applyChrome();
      return;
    }
    /* A skipped transition – a backgrounded tab, or a second flip landing on
       top of this one – rejects `ready`, and a rejection nobody reads is
       reported to the console as an uncaught error. The class change has
       already been applied by then either way, so there is nothing to recover
       from and nothing to report: swallow both promises deliberately. */
    const vt = document.startViewTransition(applyChrome);
    if (vt) {
      if (vt.ready && vt.ready.catch) vt.ready.catch(() => {});
      if (vt.finished && vt.finished.catch) vt.finished.catch(() => {});
    }
  }, [t.layout, t.accent, isDark]);

  const cycleTheme = () => setTweak("theme", isDark ? "light" : "dark");

  return (
    <div className="page">
      <Header isDark={isDark} onToggleTheme={cycleTheme} />
      <Tabs tabs={TABS} active={tab} onChange={goTab} tppMatchup={tppMatchup} />
      <main className="content">
        {/* The panel the tab strip points at. There was no role="tabpanel" on
            the page at all, so aria-controls had no target and a screen reader
            that moved to the "tab panel" landed nowhere. tabIndex=0 makes the
            panel itself focusable, which is what the pattern asks for when the
            panel's first child isn't. */}
        <div className="view-enter content" key={tab}
             role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}
             tabIndex={0}>
          {tab === "snapshot" && (
            <SnapshotView rangeId={rangeId} setRangeId={setRangeId} showScatter={t.showScatter}
                          tppMatchup={tppMatchup} setTppMatchup={setTppMatchup} />
          )}
          {tab === "cycles" && <PastCyclesView />}
          {tab === "allpolls" && <AllPollsView focus={focusPoll} onBack={focusPoll ? backFromPoll : null}
            backLabel={focusPoll && focusPoll.back ? focusPoll.back.from : null} />}
          {tab === "info" && <InfoView focus={focusTerm ? focusTerm.id : null}
            onBack={focusTerm ? backFromTerm : null}
            backLabel={focusTerm && focusTerm.back ? focusTerm.back.from : null} />}
        </div>
        <MethodNote onInfo={tab === "info" ? null : () => goTab("info")} />
      </main>

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
   harder hide (clip, off-screen position, display:none). */
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
     audiences. It carries nothing focusable, so there is no tab order to
     mend as well. */
  staticSummary.setAttribute("aria-hidden", "true");
}
document.body.classList.add("js");
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
