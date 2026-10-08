/* auspol tracker – SVG chart toolkit (no libraries) */

/* Text measurement for label layout. The old estimate was
   chars * refUnits * 0.72, which over-reserved by 51-87% on the real event
   strings – enough that labels with room to spare were being dropped as
   collisions. Canvas measureText with the page's own font gets within a unit
   or two. Measured at 100px and scaled, so rounding at ~8px doesn't bite.
   Memoised: the same dozen strings are re-measured on every render. */
const _measCtx = typeof document !== "undefined" && document.createElement("canvas").getContext("2d");
const _measCache = new Map();
let _measFam = null;
function textWidth(str, size, weight) {
  weight = weight || 600;
  const key = weight + "|" + size.toFixed(2) + "|" + str;
  const hit = _measCache.get(key);
  if (hit !== undefined) return hit;
  let w;
  if (_measCtx) {
    if (_measFam == null)
      _measFam = getComputedStyle(document.body).getPropertyValue("--sans").trim() || "system-ui, sans-serif";
    _measCtx.font = weight + " 100px " + _measFam;
    w = (_measCtx.measureText(str).width / 100) * size;
  } else {
    w = str.length * size * 0.55;   // headless fallback
  }
  _measCache.set(key, w);
  return w;
}
/* The fewest lines no wider than `w` px that hold `str`, split as evenly as
   they go: a note wrapped into a gap breaks "Three-way questions / began in
   January 2026", not "Three-way questions began in / January 2026". null
   when `max` lines won't hold it. Breaks at plain spaces only, so a
   no-break space holds "January 2026" together. */
function wrapText(str, size, weight, w, max) {
  const words = str.split(/ +/).filter(Boolean);
  const wide = (ln) => textWidth(ln, size, weight);
  for (let n = 1; n <= Math.min(max, words.length); n++) {
    let best = null;
    const walk = (at, left, acc) => {
      if (left === 1) {
        const lines = acc.concat(words.slice(at).join(" "));
        const widest = Math.max(...lines.map(wide));
        if (widest <= w && (!best || widest < best.widest)) best = { lines, widest };
        return;
      }
      for (let k = at + 1; k <= words.length - left + 1; k++)
        walk(k, left - 1, acc.concat(words.slice(at, k).join(" ")));
    };
    walk(0, n, []);
    if (best) return best.lines;
  }
  return null;
}
/* bare hooks (useState, useRef, …) come from the window aliases set in utils.js */

// viewBox geometry (scales to container width, aspect preserved)
const VB = { W: 1000 };

const EVT_MONTHS = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
/* "14 December 2025" — an annotation on a chart of months deserves its exact
   day spelled out, not the ISO string that sits in the data. */
function fmtEventDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + EVT_MONTHS[m - 1] + " " + y;
}

function makeScales({ height, xDomain, yDomain, pad }) {
  const W = VB.W, H = height;
  const [x0, x1] = xDomain, [y0, y1] = yDomain;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (y) => pad.t + ((y1 - y) / (y1 - y0)) * innerH;
  return { sx, sy, W, H, innerW, innerH, pad };
}

// Catmull-Rom → cubic bezier smoothing for a confident trend line
function smoothPath(pts, sx, sy) {
  if (pts.length < 2) return "";
  const p = pts.map((d) => [sx(d.x), sy(d.y)]);
  let d = `M ${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i], p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const t = 0.5;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * t * 2;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * t * 2;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * t * 2;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * t * 2;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/* Monotone cubic (Fritsch–Carlson, d3's curveMonotoneX) through screen points
   [[x, y], ...]: as smooth as the spline above, but between two months it
   never rises above the higher or dips below the lower, so it can't draw a
   high or low no month had. A turning month gets a flat tangent - the curve
   peaks exactly on it. `lead` replaces the opening "M" when the path
   continues another (a band's second edge). */
function monotoneXY(p, lead = "M") {
  const n = p.length;
  if (!n) return "";
  const f = (v) => v.toFixed(2);
  let d = `${lead} ${f(p[0][0])} ${f(p[0][1])}`;
  if (n === 1) return d;
  if (n === 2) return d + ` L ${f(p[1][0])} ${f(p[1][1])}`;
  const h = [], s = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = p[i + 1][0] - p[i][0];
    s[i] = h[i] ? (p[i + 1][1] - p[i][1]) / h[i] : 0;
  }
  const sign = (v) => (v > 0) - (v < 0);
  const m = [];
  for (let i = 1; i < n - 1; i++) {
    const q = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i] || 1);
    m[i] = (sign(s[i - 1]) + sign(s[i])) * Math.min(Math.abs(s[i - 1]), Math.abs(s[i]), 0.5 * Math.abs(q)) || 0;
  }
  m[0] = (3 * s[0] - m[1]) / 2;
  m[n - 1] = (3 * s[n - 2] - m[n - 2]) / 2;
  for (let i = 0; i < n - 1; i++) {
    const k = h[i] / 3;
    d += ` C ${f(p[i][0] + k)} ${f(p[i][1] + k * m[i])}, ${f(p[i + 1][0] - k)} ${f(p[i + 1][1] - k * m[i + 1])}, ${f(p[i + 1][0])} ${f(p[i + 1][1])}`;
  }
  return d;
}
function monotonePath(pts, sx, sy) {
  return monotoneXY(pts.map((d) => [sx(d.x), sy(d.y)]));
}

function straightPath(pts, sx, sy) {
  return pts.map((d, i) => `${i ? "L" : "M"} ${sx(d.x).toFixed(2)} ${sy(d.y).toFixed(2)}`).join(" ");
}

/* ------------------------------------------------------------------ *
 * TrendChart – the workhorse
 *  series:  [{ id, label, color, points:[{x,y}], width?, dashed?, smooth?,
 *            // `dashed` is per-STROKE, so a line that is only partly dashed
 *            // is passed as several series sharing one label; the tooltip and
 *            // the accessible name collapse them back to one entry each
 *            opacity?, wipe?, clipX? }]  `clipX` is the x window THIS line may
 *            draw in – lines that grow and retreat by different amounts during
 *            a question switch each need their own, since one chart-wide
 *            window can only describe one of them. `wipe` is how much of the line has been
 *            ERASED from the left, 0..1 – a line that has nowhere to travel to
 *            when the chart changes question is rubbed out rather than dimmed
 *  scatter: [{ x, y, color, meta, shape?, label?, sub? }]  shape is "triangle" or
 *           "diamond"; anything else (or absent) is a circle. Only reach for
 *           one when two clouds on the same chart share a colour. `sub`
 *           replaces the tooltip's default "n = …" line (the primary-vote
 *           panel's group view, whose dots rest on a subsample, not the
 *           poll's full n).
 *  yTicks:  [numbers]   xTicks: [{x,label}]
 *  refLines:[{y,label?,color?,labelColor?,align?}]  color paints the hairline,
 *           labelColor the text (defaults to --ink-3 – see the label below)
 *  fmt:     (y, point?) => string  for tooltip/axis – the point comes along
 *            when one exists (scatter dot or series point), so a caller can
 *            print a true value where the plotted y is a display transform
 *            (the mood panel's NAB line is drawn +100 but tips the net balance)
 *  bands:   [{y0,y1,color,className?}]  shaded horizontal regions (optional). `className`
 *           lands on the rect so CSS can theme the fill – same contract as the
 *           areas below, and how the house-lean panel's red/blue ground is
 *           themed without passing a colour through the component
 *  areas:   [{id,color,opacity?,smooth?,edge?,edgeWidth?,edgeDash?,edgeOpacity?,
 *           clipX?,points:[{x,y0,y1}]}]  shaded
 *           region whose edges VARY with x – e.g. a sampling-error floor that
 *           moves as the polls behind it change size, or the interval around a
 *           trend line (bands can't do either, they're rectangles). `smooth`
 *           curves the edges like a trend line; `edge:false` drops the dashed
 *           outline, which an interval ribbon does not want; the edge* options
 *           restyle that outline (default 1.6px, "4 4", 0.85) where the standard
 *           hand would read as another trend line instead of a bracket's bound;
 *           `className` lands
 *           on the fill so CSS can theme it; `clipX` is its own travelling
 *           window, which an interval belonging to ONE line needs for the same
 *           reason the line does.
 *  yTickFmt: (t) => string  a y-axis label (default: the tick, then `unit`)
 *  copy:    { title?, sub?, caption?, terms?,
 *             legend?: [{label, color, kind: "line"|"dashed"|"shade"|"dot"|"ring"}] }
 *           what the copy-as-image button (copy-chart.js) draws for THIS
 *           chart, for a panel with no legend chips of its own or with more
 *           than one chart in its card; rides on the host as data-copy. A
 *           legend given is the whole legend ([] for none, where the lines
 *           are named at their ends); `caption` sits under it; `terms` are
 *           the Past cycles terms the chart has data for
 *  extraRows: (i) => [{label,value,color?}]  rows appended to the tooltip
 *           below the series rows; a point may also carry `note` for a
 *           secondary value shown beside its own row
 * ------------------------------------------------------------------ */
function TrendChart(props) {
  const {
    height: heightIn = 360, xDomain, yDomain, pad: padIn = { l: 46, r: 20, t: 18, b: 34 },
    /* the redesign sizes a chart in screen px - a fixed height and fixed
       margins however wide the column - and the viewBox follows the width */
    heightPx, padPx,
    /* a caller that can price its column from the viewport (the hero is the
       full content column) hands the seed in: the mount effect then skips
       its synchronous getBoundingClientRect - reading layout inside the
       first commit forces a full-document Layout, which the boot window is
       made of. The ResizeObserver still corrects a scrollbar's-width miss
       one frame later, the trade the lead gauge's seed already takes. */
    widthSeed = null,
    series: seriesProp = [], scatter: scatterProp = [], yTicks = [], xTicks = [], refLines = [],
    /* `padSeries`: extra series to reserve right margin for even though they
       are not being drawn. The PPM switch's two views print different end
       labels; priced per drawn set, each view would reserve its own margin
       and the plot width would jolt through the morph. The caller hands the
       union of both views' series in, and the engine's own measured formula
       - live width, each series' inset from the right edge - applies to
       both, which a caller-side constant cannot do (it never sees cw). */
    padSeries = null,
    bands = [], areas = [], fmt = (v) => v.toFixed(1), unit = "", tooltipTitle: tooltipTitleProp,
    onHoverIndex, spine: spineProp, axisFont = 15, events = [], extraRows: extraRowsProp, ariaLabel,
    yTickFmt, copy,
    /* A chart can be mid-MORPH between two versions of itself (the hero's
       matchup switch). `scatterOut` is the cloud on its way out and `fade` how
       far the crossfade has run; `clipX` is the x window the lines are allowed
       to draw in, which travels with the morph so a series is never drawn over
       months it was never asked in. */
    scatterOut: scatterOutProp = [], scatterMove = [], fade = 1, clipX,
    /* `eventsFrom`: mid-switch, the events of the view being left, with
       `eventMix` how far the switch has run. An event both views mark slides
       from where the old layout put its name to where the new one does; one
       only the old view marks fades out, one only the new marks fades in.
       Without it the set changed on the switch's last frame and every name
       re-laid itself out at once. */
    eventsFrom = null, eventMix = 1,
    /* `evt` CONTROLLED: a caller holding the open annotation (the phone's
       numbered list under the chart) passes it in as { e, x, y } and learns
       of every open/close through `onEvt`. x and y may be null - the chart
       knows where the event sits and fills them in. A caller that has been
       scrolled away from a set event it no longer wants passes null. Without
       the pair the chart keeps the annotation itself, as it always has. */
    evt: evtCtl, onEvt,
    /* `morphFrom`: mid-switch, what the view being left draws besides its
       lines and dots - { yTicks, yTickFmt, refLines, notes, brackets } - with
       `morphT` how far the switch has run. The two views' axis labels, rules
       and notes crossfade where they differ and hold where they agree, so a
       switch between questions measured in different units ("+10", "Tied" to
       "20%") no longer swaps every label on its first frame, and a note the
       old view carried fades rather than vanishing for the whole switch. */
    morphFrom = null, morphT = 1,
    /* `driven`: the caller is moving xDomain itself, frame by frame (a
       switch that blends one view's window into another's). The chart then
       draws in exactly the window it is handed - no travel of its own on
       top, and never the held previous render the travel draws while
       zooming in, which froze the old view's lines and dots for a whole
       switch to a view whose months start later (the issues' Immigration ->
       Crime) while its bands, not held, moved. */
    driven = false,
    /* Which archive view a dot from THIS chart should land in. The chart has no
       idea what it is plotting; the panel does. */
    pollFacet,
    /* …and, for the demographics facet, which split: the Who votes for whom
       charts pass their group tab, so a dot opens on its own pair */
    pollSplit,
    /* `onDoubleEmpty`: two quick presses on OPEN chart - catching no poll and
       no event - call it (the hero 2PP chart steps its matchup on it). A
       press that picks something keeps its own job instead: a tapped dot
       opens or closes its readout, a dot under the mouse stays the archive
       link. */
    onDoubleEmpty,
    /* The redesign's extras, drawn only where a panel passes them:
       marks  – [{x, y, label?, labelDx?, labelDy?, anchor?}] an open ring on
                a point that is a count rather than a poll (an election
                result), with its words beside it;
       notes  – [{x, y, text, dy?, anchor?, color?, weight?}] a word or two
                set on the plot (x "left" pins it to the plot's left edge).
                One that explains a stretch of the plot - the months before
                a question was first asked - takes `span: [from, to]` in
                place of x: centred in that stretch and wrapped to fit it.
                Its `text` may be a list, longest first; it takes the first
                that fits in two lines, then tries a size smaller, and is
                dropped if nothing fits. An end is an x, "left" or "right"
                (the plot's edges), or "data" (where the lines, bands and
                dots begin or end);
       baseline – draw the x axis as a solid rule at the domain's floor,
                with a tick under each labelled month.
       ringAtX – a spine x whose guide-tooltip swatches are drawn as the
                `marks` ring (border in each row's colour) rather than the
                solid square – the tooltip marks an election result the way
                the chart does. Null on every other chart. */
    marks = [], notes = [], baseline = false, ringAtX = null,
    /* brackets – [{x, y0, y1, dx?, lines: [strong, plain]}] a span between two
       readings at one month, measured off the chart with its words to the left */
    brackets = [],
    /* vlines – [{x, cls?}] a rule the full height of the plot (the "Now" of
       a term, lined up across every chart on the tab) */
    vlines = [],
  } = props;
  /* The redesign draws the same data with a lighter hand: straight monthly
     monotone curves through the months (the spline can show highs and lows
     no month had; a monotone curve can't), line weights and
     dot sizes set in screen pixels so a phone draws them as boldly as a
     laptop, and event names above the plot rather than over the data. App
     sets AP.rd while it renders; every view remounts when it flips. */
  const rd = !!(window.AP && window.AP.rd);

  // series may be ragged (a leader not polled every month), so points are
  // matched to the hover spine by x value, never by index
  const ptAtX = (s, x) => {
    for (let i = 0; i < s.points.length; i++) if (s.points[i].x === x) return s.points[i];
    return null;
  };
  /* A series opts into interpHover when its line interpolates faithfully
     between its own points but the hover spine doesn't sample there – the
     confidence panel's monthly-history lanes (quarterly readings on a
     monthly spine) and its two out-of-step live lanes (monthly readings on
     the other house's weekly spine). Exact matching then drops the line's
     tooltip row on every off-month, and the row's appearing and vanishing
     mid-sweep reads as the tooltip bouncing to a random point. The line
     itself answers for that x everywhere between the points (a straight
     path exactly, a smooth curve to within sub-pixel), so the row and the
     hover marker ride the line between readings and hold one row per drawn
     line. `raw` rides the interpolation so a shifted line (NAB's) prints
     its true basis, never the shifted plot value. Default stays exact:
     the ragged leader months deliberately have no in-between. */
  const ptAtXLine = (s, x) => {
    const p = ptAtX(s, x);
    if (p || !s.interpHover) return p;
    const pts = s.points;
    if (!pts.length || x < pts[0].x || x > pts[pts.length - 1].x) return null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (x <= b.x) {
        const f = b.x - a.x ? (x - a.x) / (b.x - a.x) : 0;
        return { x, y: a.y + (b.y - a.y) * f,
                 ...(a.raw != null && b.raw != null ? { raw: a.raw + (b.raw - a.raw) * f } : {}) };
      }
    }
    return null;
  };
  /* Where a line visibly ends. Mid-switch its points run on under its
     travelling window (clipX), so its end cap and its name sit where the
     window cuts it - and arrive, with the last frame, exactly where the
     settled line ends. They used to wait for the switch to land and appear
     there. */
  const visEnd = (s) => {
    const pts = s.points, last = pts[pts.length - 1];
    if (!last || !s.clipX || last.x <= s.clipX[1]) return last;
    const x = s.clipX[1];
    for (let i = pts.length - 1; i > 0; i--) {
      if (pts[i - 1].x <= x) {
        const a = pts[i - 1], b = pts[i], f = b.x - a.x ? (x - a.x) / (b.x - a.x) : 0;
        return { x, y: a.y + (b.y - a.y) * f };
      }
    }
    return pts[0];
  };

  /* ---- the x window travels ------------------------------------------------
     Switching 3M / 12M / All used to be a cut: every chart was keyed on the
     range and remounted. It is a ZOOM, so it animates like one. The window
     itself travels and everything positioned by it follows without being told
     - lines, dots, annotations, the axis ticks sliding out to their new
     spacing - which is the matchup morph's travelling clip one level up.

     What gets drawn on the way is whichever set is WIDER. Zooming in, the
     panel has already filtered to the narrow range, so the previous set is the
     one still covering the ground the window is leaving; zooming out, the new
     set already covers where it is going. Either way nothing pops in at an
     edge, and the held copy is only refreshed on a settled render. */
  const [winState, setWin] = useState(xDomain);
  const win = driven ? xDomain : winState;
  const winRef = useRef(xDomain);
  const winRaf = useRef(0);
  const prev = useRef(null);                 // the props of the last SETTLED render
  const travelling = useRef(false);
  /* A zoom changes the y window too - three months of polls need less
     height than a year - and it used to take the new one on the first frame
     while the x window glided, so the months still sliding out were drawn
     off the top of the plot for the whole zoom. The y window now travels on
     the same clock (winE, the eased progress), from the one last drawn, with
     the axis labels handing over as a switch's do. */
  const [winE, setWinE] = useState(1);
  const yShown = useRef(yDomain);            // the y window last drawn
  const yTrav = useRef(null);                // { from, ticks, fmt, xTicks } while a zoom runs
  const axisNow = useRef(null);              // the axis the last settled render drew
  React.useEffect(() => () => cancelAnimationFrame(winRaf.current), []);
  /* A LAYOUT effect: the travel's first step is set before the frame that
     carries the new range is painted, so the press is answered by motion in
     that frame rather than by a frame of the old window. */
  React.useLayoutEffect(() => {
    const from = winRef.current, to = xDomain;
    if (from[0] === to[0] && from[1] === to[1]) return;
    if (driven) { cancelAnimationFrame(winRaf.current); winRef.current = to; travelling.current = false; setWin(to); return; }
    /* Snap where an animation would be a lie, a trap, or a waste: the reader
       asked for less motion; the tab is hidden, where rAF does not run at all
       and a frame-driven tween would park the window half way; or this chart
       is off screen. The range control lives in the hero, so a click animates
       the chart being looked at while the four panels below it - 1,100 of the
       page's 1,357 dots - simply arrive already zoomed. Animating all five at
       once measured 21-30ms a frame, which is a dropped frame in exchange for
       motion nobody is in a position to see. */
    const box = ref.current && ref.current.getBoundingClientRect();
    const onScreen = !!box && box.bottom > 0 && box.top < (window.innerHeight || 0);
    const still = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      || document.visibilityState === "hidden" || !onScreen;
    if (still) { winRef.current = to; travelling.current = false; yTrav.current = null; setWinE(1); setWin(to); return; }
    travelling.current = true;
    const a = from.slice();
    const was = axisNow.current;
    yTrav.current = { from: yShown.current.slice(), ticks: was ? was.yTicks : null, fmt: was ? was.yTickFmt : null,
                      xTicks: was ? was.xTicks : null };
    const at = (e) => { winRef.current = [a[0] + (to[0] - a[0]) * e, a[1] + (to[1] - a[1]) * e]; setWin(winRef.current); setWinE(e); };
    const c = window.AP.morphClock(winRaf, at, () => { winRef.current = to; travelling.current = false; yTrav.current = null; setWinE(1); setWin(to); });
    at(c.t);
  }, [xDomain[0], xDomain[1]]);
  // the y window this frame draws in: the prop, or on its way to it mid-zoom
  const zoomY = !driven && yTrav.current && winE < 1 ? yTrav.current : null;
  const yDom = zoomY ? [zoomY.from[0] + (yDomain[0] - zoomY.from[0]) * winE, zoomY.from[1] + (yDomain[1] - zoomY.from[1]) * winE] : yDomain;

  /* tooltipTitle and extraRows read the panel's OWN points by index, so they
     belong to the same bundle: holding a 16-month spine while the readout had
     already been rebuilt for a 3-month one indexed past the end of it, and the
     accessible name - which calls tooltipTitle at render time, not on hover -
     brought the whole page down the moment the range changed. */
  const fresh = { series: seriesProp, scatter: scatterProp, spine: spineProp, scatterOut: scatterOutProp,
                  tooltipTitle: tooltipTitleProp, extraRows: extraRowsProp };
  /* Zooming IN, the panel has already filtered to the narrow range, so the
     previous render's data is the one still covering the ground the window is
     leaving. It has to be the PREVIOUS render's: by the time this one runs the
     props are already the narrow set, and the effect that starts the travel
     has not run yet - which is also why the test is on the domain rather than
     on the travelling flag, or the first frame would flash the new data inside
     the old window. */
  const moved = xDomain[0] !== winRef.current[0] || xDomain[1] !== winRef.current[1];
  const drawn = !driven && (travelling.current || moved) && xDomain[0] > winRef.current[0] && prev.current
    ? prev.current : fresh;
  const series = drawn.series, scatter = drawn.scatter, spine = drawn.spine, scatterOut = drawn.scatterOut;
  const tooltipTitle = drawn.tooltipTitle, extraRows = drawn.extraRows;
  React.useEffect(() => { if (!travelling.current) prev.current = fresh; });

  const ref = useRef(null);
  /* toVB's measured viewport rect, held between events: it moves only when
     the page scrolls or the layout can have shifted the svg, and the
     invalidators below drop it then */
  const svgRect = useRef(null);
  const badgeAt = useRef({});                // the redesign's spread event badges, by event
  const labOff = useRef(new Map());          // each end name's dodge, eased mid-switch
  // axis text in real on-screen px – normalise by measured width so every
  // chart's labels match regardless of column width / responsive stacking
  const [cw, setCw] = useState(widthSeed || VB.W);
  const [, setCopyTick] = useState(0);       // see the copy flag's observer below
  /* measured before the chart is first painted (a LAYOUT effect): measured
     after it, a chart that mounts - a second chart under "Both", a tab
     opening - painted once at the viewBox's width, a third of its height on
     a phone, and grew into place a frame later. A widthSeed caller skips
     that read instead: the seed already prices the first paint, and the
     observer mops up a miss a frame later rather than mid-commit. */
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => { svgRect.current = null; setCw(el.getBoundingClientRect().width || VB.W); };
    if (widthSeed == null) update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    /* scrolling moves every rect in the viewport, and content changing
       height above the chart (an expanded poll) moves this one without a
       scroll – a body resize sees that. The scroll listener runs in the
       capture phase so the pinned strips' inner scrolls drop it too. */
    const drop = () => { svgRect.current = null; };
    window.addEventListener("scroll", drop, true);
    window.addEventListener("resize", drop);
    const bro = new ResizeObserver(drop);
    bro.observe(document.body);
    /* copy-chart.js flags the host data-copying for an image's layout. A
       chart already 1120px wide gets no resize from that, and rendered
       without the flag it kept the screen's tight event spacing in the copy,
       so the flag itself re-renders the chart, on and off. */
    const mo = new MutationObserver(() => setCopyTick((t) => t + 1));
    mo.observe(el, { attributes: true, attributeFilter: ["data-copying"] });
    return () => {
      ro.disconnect(); mo.disconnect(); bro.disconnect();
      window.removeEventListener("scroll", drop, true);
      window.removeEventListener("resize", drop);
    };
  }, []);
  const k0 = cw / VB.W;
  /* A copy is at least 0.3 of its width tall: a small multiple's 140px,
     laid out 1120 wide for the image, came out a strip - the vote-switching
     lines flattened into a band a seventh of the plot's height. */
  const copyMinH = ref.current && ref.current.hasAttribute("data-copying") ? cw * 0.3 : 0;
  const height = heightPx ? Math.max(heightPx, copyMinH) / k0 : heightIn;
  const padProp = padPx ? { l: padPx.l / k0, r: padPx.r / k0, t: padPx.t / k0, b: padPx.b / k0 } : padIn;
  /* Direct end-of-line labels need room past the last point, and it has to
     be found in SCREEN px: the viewBox is a fixed width, so a phone's label
     costs three times the plot units a laptop's does. The right pad grows to
     the longest label rather than every caller guessing a number. */
  const pad = (() => {
    /* A label needs the room its text is wider than the plot left after its
       line's last point: a line ending at the right edge needs all of it,
       one ending a month short needs less, a past term's year mid-plot none. */
    const k = cw / VB.W;                               // px per unit
    const innerPx = (VB.W - padProp.l - padProp.r) * k;
    const need = (padSeries ? seriesProp.concat(padSeries) : seriesProp).filter((s) => s.endLabel && s.opacity !== 0 && s.points.length).map((s) => {
      const f = (s.points[s.points.length - 1].x - xDomain[0]) / (xDomain[1] - xDomain[0]);
      /* measured, not estimated: pricing every letter at 0.72em ran about a
         quarter fat on the --sans labels (the by-generation chart left ~28px
         of dead plot before its card's edge on "Millennials"), with no slack
         for the narrow chars a name is mostly made of. Sizes are the ones the
         labels draw at, weight is the template's 700. */
      const txt = textWidth(s.endLabel, rd ? 13 : 10.5 * 0.95, 700) + (rd ? 12 : 7);
      return txt - Math.max(0, 1 - f) * innerPx;
    });
    if (!need.length) return padProp;
    const px = Math.max(0, ...need);
    return px <= padProp.r * k ? padProp : { ...padProp, r: px / k };
  })();
  const { sx, sy, W, H } = makeScales({ height, xDomain: win, yDomain: yDom, pad });
  /* what this render drew, noted AFTER the zoom effect above has read what
     the last one drew (effects run in order) - noted during the render, the
     render carrying a new range recorded its own destination as the start */
  React.useLayoutEffect(() => {
    yShown.current = yDom;
    if (!zoomY && !travelling.current) axisNow.current = { yTicks, yTickFmt, xTicks };
  });
  const [hover, setHover] = useState(null);     // {index, clientX}
  const [dot, setDot] = useState(null);         // hovered scatter point
  const [evtMy, setEvtMy] = useState(null);     // hovered key event {e, x, y}
  /* A controlled evt belongs to the caller and moves with the placement of
     the set it draws; the chart's own opens and closes are reported up. */
  const ctl = typeof onEvt === "function";
  const evt = ctl ? evtCtl : evtMy;
  const setEvt = (v) => { if (ctl) onEvt(v); else setEvtMy(v); };
  /* The readout's own width, measured off the page. The clamp below needs it,
     and every attempt to name it in advance has gone stale as rows were added
     to the panel – see the note there. */
  const tipRef = useRef(null);
  const [tipW, setTipW] = useState(0);
  /* A guide readout lists every line drawn, and Past cycles can draw
     twenty-one: taller than the whole plot on a phone, so it ran on over the
     next card, where its see-through glass left both its rows and the text
     under them unreadable. Two answers, measured rather than guessed, since
     the rows and the room both vary:
       cols  – the rows go into two columns, top half then bottom half, when
               the readout overruns the plot and two of them fit across it.
               Decided from the ONE-column layout and kept while the row count
               and the plot width hold, so it cannot flip back and forth as
               the readout's own shape changes under it. A column is as wide
               as the widest plain row; a row carrying a note (the mean, with
               its headcount) wraps inside it instead of setting the width.
       spill – whatever still runs past the plot goes opaque: over the plot
               the glass lets the lines through, past it there is only other
               text, and the readout has to be the thing on top. */
  const [tipLay, setTipLay] = useState({ n: 0, cw: 0, w: 0 });
  const [tipSpill, setTipSpill] = useState(false);
  /* LAYOUT effect, not a plain one: it runs before the browser paints, so the
     corrected left lands in the same frame the readout appears in. Measured on
     every render and written back only when it actually moves, so a readout
     travelling along the spine at a settled width re-renders nothing; a closed
     readout keeps the last width rather than resetting to a guess, since the
     next one to open on this chart carries the same rows. */
  React.useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    setTipW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    const plotH = ref.current ? ref.current.offsetHeight : 0;
    // the readout hangs 10px under its top (.tip's translate); a dot readout
    // hangs above its point instead, inside the plot
    const over = el.offsetTop + 10 + el.offsetHeight > plotH;
    setTipSpill(over && !el.classList.contains("tip-dot"));
    const rows = [...el.querySelectorAll(".tip-row")];
    if (!el.classList.contains("tip-guide") || (rows.length === tipLay.n && cw === tipLay.cw)) return;
    let colW = 0;
    for (const r of rows) {
      if (r.querySelector(".tip-note")) continue;
      colW = Math.max(colW, [...r.children].reduce((a, k) => a + k.offsetWidth, 0) + 7 * (r.children.length - 1));
    }
    const colsW = 2 * colW + 18 + (rows.length ? w - rows[0].offsetWidth : 0);
    setTipLay({ n: rows.length, cw, w: over && rows.length >= 8 && colsW <= cw - 8 ? Math.ceil(colsW) : 0 });
  });
  const clipId = "clip" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const plotId = clipId + "p";      // the plot area itself, which never travels
  const wipeId = clipId + "w";      // + the series id, for a line being erased

  const scale = cw / W;                 // px per user-unit
  const axisUnits = (rd ? 12 : 11) / scale;         // → ~11px on screen, every chart
  const refUnits = (rd ? 12 : 10.5) / scale;
  /* screen px -> user units, for the redesign's pixel-true marks */
  const PX = (v) => v / Math.max(scale, 0.0001);
  /* one end of a spanned note's stretch (see `notes`); "data" stops short
     of the first or last mark by enough to clear an end cap */
  const spanEdge = (v, j) => {
    if (v === "left") return pad.l + PX(6);
    if (v === "right") return W - pad.r - PX(6);
    /* { data: x } - where the data begins or ends, named by the panel rather
       than read off the marks: mid-switch the marks are on their way, and a
       note sized to them changed its wording as the space it sat in grew */
    if (v && typeof v === "object" && v.data != null) return j ? sx(v.data) - PX(12) : sx(v.data) + PX(12);
    if (v !== "data") return sx(v);
    /* where the data is SHOWN: mid-switch a line's points run on under its
       travelling window, and a line more than half rubbed out is leaving */
    const shown = (x, c) => !c || (x >= c[0] && x <= c[1]);
    const xs = series.filter((s) => s.opacity !== 0 && !(s.wipe > 0.5)).flatMap((s) => s.points.map((p) => p.x).filter((x) => shown(x, s.clipX)))
      .concat(scatter.map((d) => d.x), areas.flatMap((a) => (a.points || []).map((p) => p.x).filter((x) => shown(x, a.clipX))))
      .filter((x) => x >= win[0] && x <= win[1]);
    if (!xs.length) return j ? W - pad.r - PX(6) : pad.l + PX(6);
    return j ? sx(Math.min(...xs)) - PX(12) : sx(Math.max(...xs)) + PX(12);
  };

  // shared x spine for guide-line hover (monthly)
  const spinePts = spine || (series[0] ? series[0].points : []);

  // client px -> viewBox units. Measured off the SVG, not the .chart wrapper:
  // once a chart earns a copy button the wrapper takes padding-bottom:30px,
  // and mapping y through the taller box swung every pick ~7% under the
  // pointer. A dense cloud still caught SOME dot and looked fine; a sparse
  // one (Undecided) put dozens of dots past MOUSE_PICK_PX of anywhere a
  // reader could point - always the lowest-running series first, which is
  // the newest readings on that panel.
  const toVB = (e) => {
    /* cached: a pointermove reads this every frame, and reading it back
       then forced a layout flush on the DOM state the previous move had
       just dirtied. The invalidators above re-measure the moment the rect
       can actually have moved. */
    const rect = svgRect.current || (svgRect.current = ref.current.querySelector("svg").getBoundingClientRect());
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
      rect,
    };
  };

  const nearestSpine = (px) => {
    let best = 0, bestD = Infinity;
    spinePts.forEach((d, i) => {
      const dx = Math.abs(sx(d.x) - px);
      if (dx < bestD) { bestD = dx; best = i; }
    });
    return best;
  };

  const showSpine = (i) => { setDotFrom(null, null); setEvt(null); setHover({ index: i }); onHoverIndex && onHoverIndex(i); };

  /* Which input selected the current dot. A touch-picked dot has to SURVIVE the
     finger lifting – that is the only way a phone can hold a poll on screen to
     read it – but on a hybrid machine that same sticky dot would otherwise sit
     in front of the mouse forever, because a hovered dot suppresses the guide. */
  const dotSrc = useRef(null);
  const setDotFrom = (src, d) => { dotSrc.current = d ? src : null; setDot(d); };

  const handleMove = (e) => {
    if (dotSrc.current === "touch") setDotFrom(null, null);   // mouse takes over a stale touch pick
    const p = toVB(e);
    const near = nearestDot(p, MOUSE_PICK_PX);
    if (near) {
      if (near !== dot) { setHover(null); setEvt(null); setDotFrom("mouse", near); onHoverIndex && onHoverIndex(null); }
      return;
    }
    if (dot) setDotFrom(null, null);
    // an annotation outranks the guide: the guide can be read anywhere along
    // the month, the annotation only here
    const ev = nearestEvent(p, EVT_PICK_PX);
    if (ev) { showEvent(ev); return; }
    if (!spinePts.length) return;
    showSpine(nearestSpine(p.x));
  };

  const handleLeave = () => {
    setHover(null); setDotFrom(null, null); setEvt(null); onHoverIndex && onHoverIndex(null);
  };

  /* A dot is a poll, and the whole poll is in the archive – so on a mouse, the
     dot you are already hovering is a link to it. Deliberately mouse-only: a
     finger's tap is how a phone READS a dot at all (the tooltip has nowhere
     else to come from), and turning that same tap into a navigation would take
     the tooltip away from the only input that needs it. A caller that passes
     pollFacet={null} (the mood chart under the facet menu's width cut) is
     saying there is nothing to open - meta still feeds the tooltip, but the
     trip is neither offered by the hint nor taken by a click. */
  const rowKey = dot && window.AP.pollRowKey ? window.AP.pollRowKey(dot.meta) : null;
  const openable = !!(dot && dotSrc.current === "mouse" && rowKey && window.AP.openPoll && pollFacet);
  /* A touch tap is read entirely on pointerup below - and then the browser
     dispatches the tap's synthesized click, which would register the same
     tap a second time (reading every single tap as a double). Only a real
     touch tap stamps this clock (the touch branch returns early for a
     mouse), so the guard silences the echo and nothing else. */
  const touchTapAt = useRef(0);
  const handleClick = (e) => {
    if (performance.now() - touchTapAt.current < 400) return;
    if (openable) { window.AP.openPoll(rowKey, pollFacet, undefined, pollSplit); return; }
    dblEmpty(e, MOUSE_PICK_PX);
  };

  /* ---- picking a poll -----------------------------------------------------
     Both inputs find the nearest scatter dot within a catchment, measured in
     real px and converted to user units so it stays the same physical size
     however wide the chart renders. Only the catchment differs: a finger is
     blunt, a pointer is precise.

     The mouse used to rely on onPointerEnter/onPointerLeave bound to each
     <circle> instead. That put 242 per-element pointer listeners between the
     reader and the data and made the whole feature contingent on a browser
     firing enter/leave on SVG children, which is exactly the kind of thing
     Safari has historically got wrong - and when it does, the dots go dead
     while touch carries on working, because touch listens on the <svg> root.
     One code path on the root, for both, cannot fail that way. It is also a
     kinder target: a 4.2-unit dot is about 5px on screen, and asking a mouse
     to land inside that was never generous. */
  const TOUCH_PICK_PX = 22;   // a fingertip
  const MOUSE_PICK_PX = 11;   // near enough to mean it, small enough to leave the guide alone
  const EVT_PICK_PX = 9;      // the dashed rule; the label carries its own box

  /* The same treatment for a key event, and for the same reason twice over.
     It hung off onMouseEnter on the <g>, which put it behind the one browser
     behaviour this file no longer trusts – and, worse, the root's own
     pointermove ran on the way in and called showSpine(), which clears the
     annotation. Enter set it, the next tremor of the mouse cleared it, so on a
     laptop the panel could not be made to stay. Picked from the root there is
     one code path and no race: an event under the pointer simply outranks the
     month guide. */
  const nearestEvent = (p, radiusPx) => {
    if (!evPlaced.length) return null;
    const rU = radiusPx / Math.max(scale, 0.0001);
    let near = null, nearD = Infinity;
    for (let i = 0; i < evPlaced.length; i++) {
      const q = evPlaced[i];
      if (q.leaving) continue;
      // the rule, from the label's baseline down to the axis
      let d = (p.y >= q.y - rU && p.y <= H - pad.b + rU) ? Math.abs(p.x - q.ex) : Infinity;
      // …and the label itself, a far bigger and more obvious target
      if (q.row != null) {
        const dx = p.x < q.x ? q.x - p.x : p.x > q.x + q.w ? p.x - (q.x + q.w) : 0;
        const dy = p.y < q.y - q.fsz ? (q.y - q.fsz) - p.y : p.y > q.y + q.fsz * 0.3 ? p.y - (q.y + q.fsz * 0.3) : 0;
        d = Math.min(d, Math.hypot(dx, dy));
      }
      /* a numbered badge carries its own circle wherever the spread parked
         it - the tie leads the eye to the number, not back down the rule,
         which the cluster has no reason to follow */
      if (q.row == null && q.e.badge != null) {
        const bx = badgeAt.current && badgeAt.current[i] != null ? badgeAt.current[i] : q.ex;
        d = Math.min(d, Math.hypot(p.x - bx, p.y - (pad.t - PX(13))));
      }
      if (d < nearD) { nearD = d; near = q; }
    }
    return near && nearD <= rU ? near : null;
  };
  const showEvent = (q) => {
    setHover(null); setDotFrom(null, null); onHoverIndex && onHoverIndex(null);
    setEvt((cur) => (cur && cur.e === q.e ? cur : { e: q.e, x: q.ex, y: q.y }));
  };

  const nearestDot = (p, radiusPx) => {
    if (!scatter.length) return null;
    const rPx = radiusPx / Math.max(scale, 0.0001);   // px -> user units
    let near = null, nearD = Infinity;
    scatter.forEach((d) => {
      if (d.op === 0) return;                    // a dot faded out with its hidden line
      const dx = sx(d.x) - p.x, dy = sy(d.y) - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearD) { nearD = dist; near = d; }
    });
    return near && nearD <= rPx ? near : null;
  };

  const pickTouch = (e, isTap) => {
    if (!ref.current) return;
    const p = toVB(e);
    const near = nearestDot(p, TOUCH_PICK_PX);
    if (near) {
      // tapping the poll that is already open closes it, so a finger can put
      // the chart back to its resting state without hunting for empty space
      if (isTap && dot === near) { setDotFrom(null, null); return; }
      setHover(null); setEvt(null); setDotFrom("touch", near); onHoverIndex && onHoverIndex(null);
      return;
    }
    const ev = nearestEvent(p, TOUCH_PICK_PX);
    if (ev) {
      // tapping the open annotation closes it, exactly as tapping its poll does
      if (isTap && evt && evt.e === ev.e) { setEvt(null); return; }
      showEvent(ev);
      return;
    }
    if (spinePts.length) showSpine(nearestSpine(p.x));
  };

  /* A touch used to open a readout on pointerDOWN, so the panel appeared the
     instant a finger landed - including the finger that was only on its way
     past, starting to scroll. The svg is touch-action: pan-y, so the browser
     does not decide a drag is a page scroll until it has travelled a few
     pixels, and by then the panel was already up and had no reason to go
     again.

     So a touch now commits to nothing until the gesture has said what it is.
     A TAP opens the readout, on release. A mostly-horizontal drag scrubs,
     which is the gesture this chart is built around. A mostly-vertical one is
     the page scrolling and opens nothing at all. */
  const TAP_SLOP_PX = 10;   // travel still counted as a tap rather than a drag
  const SCRUB_PX = 8;       // horizontal travel that commits the gesture to scrubbing

  /* Two quick presses on open water - no poll and no event in either's
     catchment - are a caller-claimed gesture (`onDoubleEmpty`), the one
     pairing a chart offers beyond its own. A press that picks something is
     never the first half of a pair: it does its own job (a dot's tap opens
     or closes its readout) and resets the clock, and each input measures
     openness with its own catchment, a fingertip's the wider one. */
  const dblTap = useRef({ t: 0, x: 0, y: 0 });
  const dblEmpty = (e, pickPx) => {
    if (!onDoubleEmpty) return false;
    const p = toVB(e);
    if (nearestDot(p, pickPx) || nearestEvent(p, pickPx)) { dblTap.current.t = 0; return false; }
    const now = performance.now(), q = dblTap.current;
    const pair = now - q.t < 500 && Math.abs(e.clientX - q.x) < 30 && Math.abs(e.clientY - q.y) < 30;
    q.t = now; q.x = e.clientX; q.y = e.clientY;
    if (!pair) return false;
    q.t = 0;
    onDoubleEmpty();
    return true;
  };

  const gesture = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    // keep the gesture coming to this element even if the finger drifts off it
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    gesture.current = { x: e.clientX, y: e.clientY, scrub: false, dead: false };
    /* An element marked data-rd-swipe-exact (the hero's 2PP card) is an exact
       claim of the page swipe: every sideways drag that lands on it is the
       matchup switch, never this chart's scrub - else a readout would open
       mid-swipe and a touch-picked dot could outstay the switch. Taps stay
       the chart's own (they still read a poll), so the flag only gates the
       drag branch, and first movement is also when an earlier readout goes. */
    if (e.target.closest && e.target.closest("[data-rd-swipe-exact]")) gesture.current.swiped = true;
  };
  const onPointerMove = (e) => {
    if (e.pointerType === "mouse") { handleMove(e); return; }
    const g = gesture.current;
    if (!g || g.dead) return;
    if (e.buttons === 0 && e.pressure === 0) return;   // not an active drag
    if (g.swiped) {
      if (!g.swept) { g.swept = true; handleLeave(); }
      return;                                          // the page swipe owns every drag here
    }
    if (!g.scrub) {
      const dx = Math.abs(e.clientX - g.x), dy = Math.abs(e.clientY - g.y);
      if (dy > dx && dy > TAP_SLOP_PX) { g.dead = true; return; }   // the page is scrolling
      if (dx < SCRUB_PX) return;                                    // still undecided
      g.scrub = true;
    }
    pickTouch(e, false);
  };
  const onPointerUp = (e) => {
    if (e.pointerType === "mouse") return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.dead || g.scrub) return;          // a scroll, or a scrub already read
    if (Math.abs(e.clientX - g.x) > TAP_SLOP_PX
        || Math.abs(e.clientY - g.y) > TAP_SLOP_PX) return;
    touchTapAt.current = performance.now();        // the click this tap spawns is its echo, not a second press
    if (dblEmpty(e, TOUCH_PICK_PX)) return;        // a caller's double-tap
    pickTouch(e, true);                            // a tap, and only now
  };
  // the browser has taken the gesture for a scroll - nothing to read from it
  const onPointerCancel = (e) => {
    gesture.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  /* Touch has no pointer-leave, so a readout a finger opened stayed up until
     another one replaced it. The next gesture starting outside this chart now
     puts it away - the thing a reader is doing when they tap the page. */
  window.useDismissOutside(ref, !!(dot || evt || hover), handleLeave);

  /* ---- keyboard -----------------------------------------------------------
     The chart is one tab stop that steps the month guide, which is the same
     granularity the mouse guide reads. Stepping all 242 individual polls
     instead would be a tab trap, and the archive tab already lists them. */
  const stepBy = (delta) => {
    if (!spinePts.length) return;
    const from = hi != null ? hi : spinePts.length - 1;
    const next = Math.max(0, Math.min(spinePts.length - 1, from + delta));
    showSpine(next);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowLeft":  stepBy(-1); break;
      case "ArrowRight": stepBy(1); break;
      case "Home":       showSpine(0); break;
      case "End":        showSpine(spinePts.length - 1); break;
      case "Escape":     handleLeave(); return;   // no preventDefault: let Esc bubble to close a panel
      default: return;
    }
    e.preventDefault();
  };

  // clamp a possibly-stale hover index (range/matchup can shrink the spine
  // while the pointer rests on the chart – e.g. keyboard range switching)
  const hi = hover ? Math.min(hover.index, spinePts.length - 1) : null;
  const hoverX = hi != null && spinePts[hi] ? sx(spinePts[hi].x) : null;

  /* Which y ticks get a label. The axis font is sized to render ~11px on
     screen whatever the chart's width, so on a phone it occupies far more
     viewBox space than it does on a laptop — and a tick list that is
     comfortable at 1100px runs its labels into each other at 340px. Keep every
     GRIDLINE, since the grid is what makes the chart readable, and label only
     the ticks with room. Greedy from the bottom, measured in real pixels. */
  const yLabelledOf = (ticks) => {
    if (!cw || ticks.length < 2) return new Set(ticks);
    const NEED = 15;                      // px between label centres
    const keep = new Set();
    let lastPx = null;
    for (const t of ticks.slice().sort((a, b) => b - a)) {
      const px = sy(t) * scale;
      if (lastPx == null || Math.abs(px - lastPx) >= NEED) { keep.add(t); lastPx = px; }
    }
    return keep;
  };
  const yLabelled = yLabelledOf(yTicks);
  // the view being left, mid-switch (see morphFrom)
  const mf = morphFrom && morphT < 1 ? morphFrom
    : zoomY && zoomY.ticks ? { yTicks: zoomY.ticks, yTickFmt: zoomY.fmt, refLines, notes, brackets } : null;
  const mT = !mf ? 1 : morphFrom && morphT < 1 ? morphT : winE;
  /* Words that give way to other words in the same place go out, then in:
     the old wording is gone by 45% of the switch and the new one arrives
     from 30%, so "+40" and "40%" are never drawn over each other half-seen,
     which read as "4040". */
  const textOut = (t) => Math.max(0, Math.min(1, 1 - t / 0.45));
  const textIn = (t) => Math.max(0, Math.min(1, (t - 0.3) / 0.7));
  // lines being rubbed out (see `wipe`): their masks, and the ones fully gone
  const wiping = new Set(series.filter((s) => s.wipe != null && s.wipe > 0 && s.wipe < 1).map((s) => s.id));
  const wipedOut = new Set(series.filter((s) => s.wipe != null && s.wipe >= 1).map((s) => s.id));
  // is this frame part of a switch? (a morph, a crossfade, a zoom, or a window the caller moves)
  const switching = !!mf || fade < 1 || !!(eventsFrom && eventMix < 1) || !!zoomY || travelling.current || driven;
  /* a rule both views draw holds; one only the old view draws fades out and
     one only the new view draws fades in. Notes and brackets simply cross. */
  const refKey = (r) => r.y + "|" + (r.label || "");
  const refAll = !mf ? refLines : (() => {
    const was = new Map((mf.refLines || []).map((r) => [refKey(r), r]));
    const out = refLines.map((r) => (was.has(refKey(r)) ? (was.delete(refKey(r)), r) : { ...r, op: r.label ? textIn(mT) : mT }));
    was.forEach((r) => out.push({ ...r, op: r.label ? textOut(mT) : 1 - mT, was: true }));
    return out;
  })();
  /* a note both views carry, word for word and in the same place, holds */
  const crossWords = (was0, now0, key) => {
    if (!mf) return now0;
    const nowK = new Set(now0.map(key)), wasK = new Set((was0 || []).map(key));
    return (was0 || []).filter((n) => !nowK.has(key(n))).map((n) => ({ ...n, op: textOut(mT), was: true }))
      .concat(now0.map((n) => (wasK.has(key(n)) ? n : { ...n, op: textIn(mT) })));
  };
  const noteAll = crossWords(mf && mf.notes, notes, (n) => [].concat(n.text).join("/") + "|" + n.x + "|" + n.y + "|" + (n.dy || 0) + "|" + (n.span ? n.span.join() : ""));
  const bracketAll = crossWords(mf && mf.brackets, brackets, (b) => (b.lines || []).join("/") + "|" + b.x + "|" + b.y0 + "|" + b.y1);

  // tooltip content. Precedence: a hovered EVENT, then a scatter dot, then the
  // guide. Without the first case the svg's own onMouseMove kept firing while
  // the pointer sat on an event label, so the month readout covered the very
  // annotation being pointed at.
  // An evt the list just opened carries no coordinates yet - the reconciler
  // re-hangs it a turn later. Drawing the readout that frame would land it
  // without left/top at the svg's heels, right where the list sits: hold it
  // back until the chart knows where the event goes.
  let tip = null;
  if (evt) {
    if (evt.x != null && evt.y != null) tip = {
      left: (evt.x / W) * 100, top: (evt.y / H) * 100,
      title: evt.e.label, date: fmtEventDate(evt.e.date), desc: evt.e.desc, rows: [],
    };
  } else if (dot) {
    tip = {
      left: (sx(dot.x) / W) * 100, top: (sy(dot.y) / H) * 100,
      title: dot.meta.pollster, rows: [
        { label: dot.label || "2PP", value: fmt(dot.y, dot) + unit, color: dot.color },
        { label: dot.meta.dateLabel ? "Field" : "", value: dot.meta.dateLabel || "" },
      ].filter((r) => r.label),
      sub: dot.sub || (dot.meta.sample ? `n = ${dot.meta.sample.toLocaleString()}` : ""),
      hint: openable ? "Click to open this poll in All polls" : "",
    };
  } else if (hover && hoverX != null) {
    const i = hi;
    const spx = spinePts[i] ? spinePts[i].x : null;
    tip = {
      left: (hoverX / W) * 100, top: 6,
      ringSwatch: ringAtX != null && spx != null && Math.abs(spx - ringAtX) < 1e-6,
      title: tooltipTitle ? tooltipTitle(i) : "",
      // rows sorted by value, so the readout order matches the lines'
      // top-to-bottom order at the hovered point
      /* One LINE may arrive as several series – a cycle line is split at the
         months it interpolates so the gap can be dashed, and the runs share
         both their label and their boundary points. The reader is hovering
         one line and wants one row, so the first series to answer for a
         label answers for all of them. Series without a label (unnamed
         helpers) are left alone. */
      rows: (() => {
        const claimed = new Set();
        return series.map((s) => {
          if (s.opacity === 0 || spx == null) return null;
          const p = ptAtXLine(s, spx);
          if (!p) return null;
          if (s.label != null) {
            if (claimed.has(s.label)) return null;
            claimed.add(s.label);
          }
          return { label: s.label, value: fmt(p.y, p) + unit, color: s.color, y: p.y, note: p.note };
        }).filter(Boolean).sort((a, b) => b.y - a.y)
          .concat(extraRows ? extraRows(i).filter(Boolean) : []);
      })(),
    };
  }

  /* Clamp the readout so it never spills past the card edge on end-of-range
     hovers. The half-width has to match the panel actually being drawn, and
     naming that number in advance has now been wrong twice: first a single
     "~half a typical tip" taken off the guide readout, which let the much
     wider event panel sit 40px past the edge; then a pair of constants whose
     comment claimed "both are capped in CSS", true of .tip-evt's 240 and never
     true of the guide readout, which has no cap and grows with its rows. Once
     Past cycles put a "Mean of past terms" row and a headcount beside it, the
     guide readout measured 253px against an assumed 156 – and on a 375px phone
     a tap at the election-day end of the axis opened it 32px off the left of
     the screen.
     So measure the element instead. The constants stay as the first-paint
     fallback only, and the next row nobody has thought of yet is contained
     without anyone having to remember this line. A panel somehow wider than
     its chart clamps to dead centre, which is the least-bad place for it. */
  const tipCols = !!(tip && !evt && !dot && tipLay.w && tip.rows.length === tipLay.n && cw === tipLay.cw);
  if (tip) {
    const assumed = Math.min(evt ? 240 : 156, cw);
    const tipMax = Math.min(tipW || assumed, cw);
    const halfPct = Math.min(50, (tipMax / 2 / Math.max(cw, 1)) * 100);
    tip.left = Math.min(100 - halfPct, Math.max(halfPct, tip.left));
  }

  /* ---- accessible name ----------------------------------------------------
     Every chart used to be "Polling trend chart", so a screen reader met five
     identical, contentless images. Name what is actually plotted and over what
     span, and say the thing is operable – it is the only cue that arrow keys
     do anything here. */
  const namedSeries = [...new Set(series.filter((s) => s.label && s.opacity !== 0).map((s) => s.label))];
  const spanFrom = tooltipTitle && spinePts.length ? tooltipTitle(0) : "";
  const spanTo = tooltipTitle && spinePts.length ? tooltipTitle(spinePts.length - 1) : "";
  const a11yLabel = ariaLabel || [
    namedSeries.length ? namedSeries.join(", ") : "Polling trend",
    spanFrom && spanTo ? `${spanFrom} to ${spanTo}` : "",
    scatter.length ? `${scatter.length} individual polls plotted` : "",
    spinePts.length > 1 ? "Use arrow keys to read each point" : "",
  ].filter(Boolean)
    // a series label may already end in a full stop ("Others / Ind."), and
    // "Ind.." is read aloud as a stumble rather than a sentence break
    .map((s) => s.replace(/\.$/, ""))
    .join(". ") + ".";

  /* What the live region says as the guide moves. Mirrors the visual tooltip,
     because the tooltip is positioned graphics a screen reader cannot follow. */
  const liveText = !tip ? "" : [
    tip.title,
    tip.date || "",
    ...(tip.rows || []).map((r) => `${r.label} ${r.value}`),
    tip.sub || "",
  ].filter(Boolean).join(", ");

  /* Dot clouds, memoised: identity is what lets React skip them entirely on a
     morph frame. `geom` covers everything that would move a dot – the scales
     are rebuilt every render but produce the same pixels while it holds. */
  const geom = [W, H, pad.l, pad.r, pad.t, pad.b, win[0], win[1], yDom[0], yDom[1]].join("|");
  /* A dot's SHAPE carries what its colour cannot. Two Coalition terms on the
     Past-cycles chart are the same blue, so their clouds are one cloud until
     something other than colour separates them. Circle stays the default and
     is every other caller's only shape, so a scatter that asks for nothing
     renders exactly as before.
     The sizes are matched by eye rather than by radius: a triangle inscribed
     in r reads noticeably smaller than the circle beside it, so it is drawn
     past r and the diamond slightly so. */
  const dotPath = (shape, cx, cy, r) => {
    if (shape === "triangle") {
      const s = r * 1.35;
      return `M ${cx} ${cy - s} L ${cx + s * 0.87} ${cy + s * 0.62} L ${cx - s * 0.87} ${cy + s * 0.62} Z`;
    }
    if (shape === "diamond") {
      const s = r * 1.3;
      return `M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`;
    }
    return null;
  };
  /* Named because the plot clip has to know them: a dot is placed by its
     CENTRE, so a clip drawn at the plot's edge shaves the outer half of any
     reading that sits on it. */
  const DOT_R = rd ? PX(cw < 640 ? 2 : 2.6) : 4.2, DOT_R_LIVE = rd ? PX(6) : 6.5;
  const DOT_OP = rd ? 0.5 : 0.6;
  /* The redesign's picked poll, as the Interaction board draws it: "the dot
     grows and rings" - solid at r 6 with a 2px halo of the chart's own
     ground, inside a 1.5px ring at r 11 in its colour. It is lifted out of
     the half-transparent cloud and drawn over the lines (hotDot, after the
     series), where a line crossing it can't hide which poll is open. */
  const RING_R = PX(11);
  const dotEls = (arr, live) => arr.map((d, i) => {
    if (rd && live && dot === d) return null;
    const cx = sx(d.x), cy = sy(d.y), r = live && dot === d ? DOT_R_LIVE : DOT_R;
    /* no per-dot pointer listeners: both inputs pick from the svg root, so
       nothing here depends on a browser firing enter/leave on an SVG child */
    /* `hollow`: an open ring on the chart's ground rather than a disc, for
       a cloud that must read apart from another in the same colour (the
       Undecided panel's after-preference polls, whose line is dashed). A
       ring is less ink than a disc, so it carries more of its own. */
    /* fill-opacity, not opacity, on a plain dot: the two draw a filled disc
       identically, but `opacity` makes every dot a compositing group of its
       own - two thousand of them on this page - and the browser re-sorted
       all of them into layers on every frame of every switch, a third of a
       phone's frame spent on dots that were not moving. A ring keeps
       `opacity`, which is what fades its fill and outline as one. */
    const common = d.hollow
      ? { className: "scatter-dot", fill: "var(--chart-bg)", stroke: d.color, strokeWidth: PX(1.25),
          opacity: (live && dot && dot !== d ? 0.35 : Math.min(1, DOT_OP * 1.7)) * (d.op != null ? d.op : 1) }
      : { className: "scatter-dot", fill: d.color,
          fillOpacity: (live && dot && dot !== d ? 0.25 : DOT_OP) * (d.op != null ? d.op : 1) };
    const p = dotPath(d.shape, cx, cy, r);
    return p ? <path key={"s" + i} d={p} {...common} />
             : <circle key={"s" + i} cx={cx} cy={cy} r={r} {...common} />;
  });
  const dots = React.useMemo(() => dotEls(scatter, true), [scatter, dot, geom]);
  const hotDot = rd && dot && scatter.includes(dot) ? (() => {
    const cx = sx(dot.x), cy = sy(dot.y);
    const p = dotPath(dot.shape, cx, cy, DOT_R_LIVE);
    const face = { fill: dot.color, stroke: "var(--chart-bg)", strokeWidth: PX(2) };
    return (
      <g className="rd-dot-hot" pointerEvents="none">
        <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke={dot.color} strokeWidth={PX(1.5)} opacity={0.55} />
        {p ? <path d={p} {...face} /> : <circle cx={cx} cy={cy} r={DOT_R_LIVE} {...face} />}
      </g>
    );
  })() : null;
  const outDots = React.useMemo(() => dotEls(scatterOut, false), [scatterOut, geom]);
  /* The dots that TRAVEL are the one group that cannot be memoised - they hold
     a different position and colour on every frame. Deliberately the small
     group: only the polls that published both matchups move, so this is ~90
     circles a frame rather than the ~330 on the chart. */
  const moveDots = scatterMove.map((d, i) => {
    const cx = sx(d.x), cy = sy(d.y), p = dotPath(d.shape, cx, cy, DOT_R);
    const common = { className: "scatter-dot", fill: d.color, fillOpacity: DOT_OP * (d.op != null ? d.op : 1) };
    return p ? <path key={"m" + i} d={p} {...common} /> : <circle key={"m" + i} cx={cx} cy={cy} r={DOT_R} {...common} />;
  });

  /* An area's edge paths (the CI ribbon is the busy one) depend only on its
     series and the geometry: hoisting them behind the same geom key the
     dots ride keeps a hover scrub from re-stringing curves that cannot
     have moved. The wipe signature re-keys a band whose line is mid-erasure
     without window travel forcing the issue. */
  const wipeSig = series.some((s) => s.wipe != null)
    ? series.map((s) => (s.wipe == null ? "-" : s.wipe)).join("|")
    : "";
  const areaGeo = React.useMemo(() => areas.map((a) => {
    if (!a.points || a.points.length < 2) return { a };
    if (a.wipeOf != null && wipedOut.has(a.wipeOf)) return { a };
    /* `smooth` follows the same curve the trend lines use (the spline, or
       the redesign's monotone). An interval ribbon has to be drawn with the
       curve it belongs to – straight edges under a curved line pull away
       from it mid-month and read as a second, disagreeing series. The
       redesign curves every band unless it opts out (`smooth: false`): its
       lines are all monotone, so a straight band is always the odd one. */
    const edgePath = (pts, key, lead) => rd && a.smooth !== false
      ? monotoneXY(pts.map((d) => [sx(d.x), sy(d[key])]), lead)
      : a.smooth
      ? smoothPath(pts.map((d) => ({ x: d.x, y: d[key] })), sx, sy).replace(/^M/, lead)
      : pts.map((d, i) => `${i ? "L" : lead} ${sx(d.x).toFixed(2)} ${sy(d[key]).toFixed(2)}`).join(" ");
    return { a, top: edgePath(a.points, "y1", "M"), bot: edgePath(a.points.slice().reverse(), "y0", "L") };
  }), [areas, geom, wipeSig, rd]);

  /* ---- key events ---------------------------------------------------------
     A busy set (the hero's history) shows only when the chart is genuinely
     wide ON SCREEN (measured px, so phones and narrow columns stay
     uncluttered); one or two markers are never clutter and show at any width.

     Clustered events were the hard part: Farrer and the 2026 Budget sit 5.6
     units apart in a 1000-unit viewBox while their labels are ~60 wide, so no
     arrangement puts each label above its own line. Three things fix it
     together:
       - labels are DISPLACED along their row rather than dropped, so a
         crowded one slides right until it fits;
       - every label is tied to its line by an elbow – the line rises to the
         label's baseline and runs across to meet the text, so a displaced
         label still reads unambiguously as belonging to its own line;
       - rows are packed first-fit rather than by index parity, which
         previously sent alternate events to alternate rows regardless of
         whether they were anywhere near each other.

     Placed HERE rather than inside the JSX because two things read it: the
     drawing below, and the pointer pick above – an annotation is now picked
     from the svg root like everything else on this chart, which needs its
     geometry in hand before an event arrives. */
  /* copy-chart.js marks the host data-copying while it lays the chart out
     1120px wide for an image. The numbers a phone or a half-width chart puts
     on its events are keyed by a list under the chart, which the image does
     not carry, and at that width the names fit - so the copy names them. */
  const copying = !!(ref.current && ref.current.hasAttribute("data-copying"));
  const placeEvents = (list) => {
    const evs = list
      .map((e) => (copying && e.badge != null ? { ...e, badge: null, badgeLead: false } : e))
      .filter((e) => e.x >= win[0] && e.x <= win[1])
      .sort((a, b) => a.x - b.x);
    const fsz = refUnits;          // 10.5px on screen: the type floor for words
    /* the redesign hangs its event names in two rows ABOVE the plot, each
       name a flag on its own rule, so no label sits over the data */
    /* ...and a copy a third: the image grows upward to take in whatever
       sits over the plot, and with two rows the hero's winter of events
       still ran "Joyce → ONP", "2nd Coalition split" and "Hormuz crisis"
       along one row, joined by elbows */
    const ROWS = rd ? (copying ? 3 : 2) : 3;
    const ROW_H = refUnits * (rd ? 1.35 : 1.4);
    const LEAD = rd ? PX(5) : refUnits * 0.55;   // shortest elbow, line to text
    /* clear air between labels in a row - wider in a copy, which names what
       a half-width chart only numbers, and five events in a term's first
       year set end to end read as one phrase ("Bondi shooting Ley → Taylor") */
    const SEP = refUnits * (copying ? 2 : 0.85);
    const rowEnd = new Array(ROWS).fill(-Infinity);
    const rightEdge = W - pad.r;
    const rowY = rd
      ? (r) => (r == null ? pad.t : pad.t - PX(10) - (ROWS - 1 - r) * ROW_H)
      : (r) => (r == null ? pad.t + 4 : pad.t + 3 + r * ROW_H);

    /* What needs room on a narrow chart is the LABELS, not the marks. This
       used to drop the annotation entirely below 640px unless there were two
       or fewer of them, which on a phone meant the reader saw markers in
       whichever window happened to hold two events and none in any other - a
       cliff rather than a degradation, and it took the rules with it. Keep the
       rules, which are a hairline each and stay tappable, and drop only the
       text: "something happened here, tap to read it" survives at any width. */
    if (evs.length > 2 && cw < 640) {
      return evs.map((e) => ({ e, ex: sx(e.x), w: 0, fsz, row: null, y: rowY(null) }));
    }
    /* A redesign panel that numbered its events (a phone's, whose names are
       listed under the chart) gets its numbers however few there are: a lone
       event named on the chart as well as listed under it had a list whose
       "1" matched nothing on the plot. */
    if (rd && evs.some((e) => e.badge != null)) {
      return evs.map((e) => ({ e, ex: sx(e.x), w: 0, fsz, row: null, y: rowY(null) }));
    }

    return evs.map((e) => {
      const ex = sx(e.x);
      const w = textWidth(e.short, fsz);
      /* Pick the row where the label sits CLOSEST to its own line, not simply
         the first row it fits in. First-fit looks right until you realise
         displacement always succeeds in row 0 – so row 0 took every label and
         the connectors stretched to 76 units, dragging "2026 Budget"
         three-quarters of the way across its neighbour. Choosing by
         displacement instead sends the second member of a cluster down a row,
         where it sits directly over its own line. ROW_PEN keeps things in the
         top row unless dropping down buys a real reduction, so we don't
         scatter over three rows to save a unit or two. */
      const ROW_PEN = refUnits * 0.3;
      let best = null;
      for (let r = 0; r < ROWS; r++) {
        const x = Math.max(ex + LEAD, rowEnd[r] + SEP);
        if (x + w > rightEdge) continue;
        const cost = (x - (ex + LEAD)) + r * ROW_PEN;
        if (best === null || cost < best.cost) best = { r, x, cost };
      }
      if (best) { rowEnd[best.r] = best.x + w; return { e, ex, w, fsz, row: best.r, y: rowY(best.r), x: best.x, flip: false, disp: best.x - (ex + LEAD) > PX(1) }; }
      // out of room on the right – hang it to the left of its own line
      for (let r = 0; r < ROWS; r++) {
        const x = ex - LEAD - w;
        if (x >= rowEnd[r] + SEP) { rowEnd[r] = ex; return { e, ex, w, fsz, row: r, y: rowY(r), x, flip: true }; }
      }
      return { e, ex, w, fsz, row: null, y: rowY(null) };   // genuinely nowhere to put it
    });
  };
  const evKey = (e) => e.date + "|" + (e.short || e.label);
  /* memoised on the same geom key the dots already ride: a hover scrub
     re-renders dozens of times a second with the geometry unmoved, and the
     sort-plus-pack work here is the render's expensive pure part. `copying`
     re-keys it because a copy packs wider and names every label. */
  const evPlaced = React.useMemo(() => {
    const to = placeEvents(events);
    if (!eventsFrom || eventMix >= 1) return to;
    const from = placeEvents(eventsFrom), t = eventMix;
    const byKey = new Map(from.map((p) => [evKey(p.e), p]));
    const lerp = (a, b) => a + (b - a) * t;
    const out = to.map((p) => {
      const q = byKey.get(evKey(p.e));
      if (!q) return { ...p, op: t };
      byKey.delete(evKey(p.e));
      if (p.row == null || q.row == null) return { ...p, prev: q };
      return { ...p, x: lerp(q.x, p.x), y: lerp(q.y, p.y), prev: q };
    });
    byKey.forEach((q) => out.push({ ...q, op: 1 - t, leaving: true }));
    return out.sort((a, b) => a.ex - b.ex);
  }, [events, eventsFrom, eventMix, copying, geom, rd]);
  /* A controlled evt follows the placement of whatever set is on screen now
     (a list that stayed open over a matchup or range switch is re-hung where
     its event sits today, and put away when the new window drops the event);
     an uncontrolled one keeps its own spot, as it always has. */
  if (ctl && evt) {
    const q = evPlaced.find((p) => p.e === evt.e && !p.leaving);
    if (!q) { const cur = evt; setTimeout(() => { if (evtCtl === cur) setEvt(null); }, 0); }
    else if (evt.x !== q.ex || evt.y !== q.y) {
      const cur = evt;
      setTimeout(() => { if (evtCtl === cur) setEvt({ e: cur.e, x: q.ex, y: q.y }); }, 0);
    } else { evt.x = q.ex; evt.y = q.y; }
  }

  return (
    <div className="chart" ref={ref} data-copy={copy ? JSON.stringify(copy) : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} className={"chart-svg" + (switching ? " switching" : "")}
           data-copy-cw={copying ? Math.round(cw) : undefined}
           onPointerMove={onPointerMove} onPointerDown={onPointerDown}
           onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
           onMouseLeave={handleLeave} onClick={handleClick}
           style={openable ? { cursor: "pointer" } : null}
           onKeyDown={handleKeyDown} onBlur={handleLeave}
           tabIndex={0} role="img" aria-label={a11yLabel}>
        <defs>
          <clipPath id={clipId}>
            {/* the right edge carries a little slack so a rounded line cap at
                the last reading isn't shaved off by its own clip */}
            <rect x={clipX ? Math.max(pad.l, sx(clipX[0])) : pad.l} y="0"
                  width={clipX
                    ? Math.max(0, Math.min(W - pad.r, sx(clipX[1]) + 5) - Math.max(pad.l, sx(clipX[0])))
                    : W - pad.l - pad.r}
                  height={H} />
          </clipPath>
          {/* A second, fixed clip for the dots. The one above travels with a
              matchup morph, which is right for the lines and wrong for the
              cloud; this one only ever means "inside the plot", which is what
              keeps dots off the axis labels as the window zooms past them. */}
          <clipPath id={plotId}>
            {/* Slack of one live dot radius either side, for the reason the
                clip above carries slack for a line cap: the most recent poll
                sits ON the right edge of the plot, and a clip drawn exactly
                there cut the outer 1.2 units off it - a visibly flat-sided
                dot at the end of every chart. Dots are placed by their centre,
                so anything genuinely outside the window is still hidden: its
                centre is far past the boundary, not on it. The left gutter has
                10 units between the axis labels and the plot, so the same
                slack there clears them. */}
            <rect x={pad.l - DOT_R_LIVE} y="0"
                  width={W - pad.l - pad.r + DOT_R_LIVE * 2} height={H} />
          </clipPath>
          {/* One travelling window per line that asked for one. The <g> below
              still carries the chart-wide clip; these intersect with it. */}
          {[...series.filter((s) => s.clipX).map((s) => ["s", s]),
            ...areas.filter((a) => a.clipX).map((a) => ["a", a])].map(([kind, e]) => {
            const x0 = Math.max(pad.l, sx(e.clipX[0]));
            // a little slack on the right so a rounded cap isn't shaved off
            const x1 = Math.min(W - pad.r, sx(e.clipX[1]) + 5);
            return (
              <clipPath key={kind + "c" + e.id} id={clipId + kind + e.id}>
                <rect x={x0} y="0" width={Math.max(0, x1 - x0)} height={H} />
              </clipPath>
            );
          })}
          {/* An eraser, one per wiping line. A line with no counterpart in the
              question being switched to used to fade out everywhere at once,
              which reads as a rendering glitch rather than a departure. Rubbing
              it out from the left – soft edge, so it is an eraser and not a
              shutter – gives the eye something to follow, and the same mask run
              backwards draws the line back in when the switch is reversed. */}
          {series.filter((s) => s.wipe != null && s.wipe > 0 && s.wipe < 1).map((s) => {
            const SOFT = 0.09;                       // edge width, as a fraction
            const edge = s.wipe * (1 + 2 * SOFT) - SOFT;
            const cl = (v) => Math.max(0, Math.min(1, v));
            const lo = cl(edge - SOFT), hi2 = cl(edge + SOFT);
            return (
              <mask key={"w" + s.id} id={wipeId + s.id} maskUnits="userSpaceOnUse"
                    x={pad.l} y="0" width={W - pad.l - pad.r} height={H}>
                <linearGradient id={wipeId + s.id + "g"} gradientUnits="userSpaceOnUse"
                                x1={pad.l} y1="0" x2={W - pad.r} y2="0">
                  <stop offset={lo} stopColor="#000" />
                  <stop offset={hi2} stopColor="#fff" />
                </linearGradient>
                <rect x={pad.l} y="0" width={W - pad.l - pad.r} height={H}
                      fill={`url(#${wipeId + s.id}g)`} />
              </mask>
            );
          })}
        </defs>
        {/* shaded bands */}
        {bands.map((b, i) => (
          <rect key={"b" + i} className={b.className} x={pad.l} y={sy(b.y1)} width={W - pad.l - pad.r}
                height={Math.abs(sy(b.y0) - sy(b.y1))} fill={b.color} />
        ))}
        {/* x-varying shaded areas – drawn under everything, clipped to the plot */}
        {areaGeo.map(({ a, top, bot }) => {
          if (top == null) return null;
          return (
            /* the chart's window outside, the area's own inside: an interval
               that belongs to one line has to grow and retreat with it, or it
               arrives at full width while the line is still travelling */
            <g key={"a" + a.id} clipPath={`url(#${clipId})`}>
             <g clipPath={a.clipX ? `url(#${clipId + "a" + a.id})` : undefined}
                mask={a.wipeOf != null && wiping.has(a.wipeOf) ? `url(#${wipeId + a.wipeOf})` : undefined}
                className={a.hidden != null ? "fade-mark" : undefined}
                style={a.hidden ? { opacity: 0 } : a.fade != null && a.fade < 1 ? { opacity: a.fade } : null}>
              {/* `opacity` is a presentation ATTRIBUTE, so a class rule beats
                  it – which is how a themed area gets a different weight in
                  dark without the component knowing the theme */}
              <path className={a.className} d={`${top} ${bot} Z`} fill={a.color}
                    opacity={a.opacity != null ? a.opacity : 1} />
              {a.edge !== false && <path d={top} fill="none" stroke={a.color} strokeWidth={a.edgeWidth || 1.6}
                                         strokeDasharray={a.edgeDash || "4 4"}
                                         opacity={a.edgeOpacity != null ? a.edgeOpacity : 0.85} />}
             </g>
            </g>
          );
        })}
        {/* y gridlines + labels. A tick the window has slid past the plot's
            edge (mid-switch) fades out over a few pixels rather than hanging
            over the event names or the months; mid-switch the two views'
            ticks are drawn together, each label fading between its old and
            new wording where they differ. */}
        {(() => {
          const lab = (fmt, t) => (fmt ? fmt(t) : t + unit);
          const edgeOp = (t) => {
            const y = sy(t), lo = pad.t, hi = H - pad.b, band = PX(14);
            return y < lo - 0.5 ? Math.max(0, 1 - (lo - y) / band) : y > hi + 0.5 ? Math.max(0, 1 - (y - hi) / band) : 1;
          };
          const was = mf ? new Set(mf.yTicks || []) : null, now = new Set(yTicks);
          const all = was ? [...new Set(yTicks.concat(mf.yTicks || []))] : yTicks;
          const labWas = was ? yLabelledOf(mf.yTicks || []) : null;
          return all.map((t) => {
            const e = edgeOp(t);
            if (e <= 0) return null;
            const inNow = now.has(t), inWas = !!was && was.has(t);
            const gOp = e * (was ? (inNow && inWas ? 1 : inNow ? mT : 1 - mT) : 1);
            const tNow = inNow && yLabelled.has(t) ? lab(yTickFmt, t) : null;
            const tWas = inWas && labWas.has(t) ? lab(mf.yTickFmt || yTickFmt, t) : null;
            const txt = (s0, op) => (s0 == null || op <= 0 ? null : (
              <text x={pad.l - (rd ? PX(8) : 10)} y={sy(t)} className="axis-label y" dominantBaseline="middle"
                    style={op < 1 ? { fontSize: axisUnits, opacity: op } : { fontSize: axisUnits }}>{s0}</text>
            ));
            return (
              <g key={"y" + t} data-k={"y" + t}>
                <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="grid" style={gOp < 1 ? { opacity: gOp } : null} />
                {was && tWas !== tNow
                  ? <>{txt(tWas, e * textOut(mT))}{txt(tNow, e * textIn(mT))}</>
                  : txt(tNow, e)}
              </g>
            );
          });
        })()}
        {/* the redesign's x axis: a solid rule at the floor of the window,
            and a short tick under each month it names */}
        {baseline && (
          <g className="rd-axis">
            <line x1={pad.l} x2={W - pad.r} y1={sy(yDom[0])} y2={sy(yDom[0])} className="rd-base" />
            {xTicks.filter((t) => t.x >= win[0] && t.x <= win[1]).map((t) => (
              <line key={"xt" + t.x} x1={sx(t.x)} x2={sx(t.x)} y1={sy(yDom[0])} y2={sy(yDom[0]) + PX(4)} className="rd-base" />
            ))}
          </g>
        )}
        {/* reference lines (e.g. 50% / 0 net) – labels drawn last, on top */}
        {refAll.map((r, i) => (
          <line key={"r" + r.y + (r.label || "") + (r.op != null ? "|" + (r.was ? "w" : "n") : "")} x1={pad.l} x2={W - pad.r} y1={sy(r.y)} y2={sy(r.y)}
                className="refline" stroke={r.color || "currentColor"} style={r.op != null ? { opacity: r.op } : null} />
        ))}
        {/* x ticks – thinned until neighbours clear each other on SCREEN: a
            phone kept every second month and still ran "Nov Jan ’26 Mar"
            into one another. Year-bearing labels win a thinning; the rest
            keep their spacing from them. */}
        {(() => {
          const thin = (list) => {
            /* A landmark tick ("Election") may carry a `short` ("E") for when
               its long word cannot sit beside its neighbours: shortening keeps
               its date on the axis where dropping it to the k-thinning below
               would take it off altogether, so it is exempt from that
               thinning instead */
            const pxOf = (t) => [...t.label].length * 6.3 + 10;           // ~11px sans, plus air
            const clearOf = (t, w, i) => {
              const l = list[i - 1], r = list[i + 1];
              return (!l || (sx(t.x) - sx(l.x)) * scale >= (w + pxOf(l)) / 2)
                  && (!r || (sx(r.x) - sx(t.x)) * scale >= (w + pxOf(r)) / 2);
            };
            list = list.map((t, i) => (t.short && !clearOf(t, pxOf(t), i) ? { ...t, label: t.short } : t));
            if (list.length < 3) return list;
            const fits = (ts) => ts.every((t, i) => i === 0
              || (sx(t.x) - sx(ts[i - 1].x)) * scale >= (pxOf(t) + pxOf(ts[i - 1])) / 2);
            let ts = list;
            for (let k = 2; !fits(ts) && k <= 6; k++) {
              const anchor = Math.max(0, list.findIndex((t) => /’/.test(t.label) && t !== list[0]));
              ts = list.filter((t, i) => t.short || (i - anchor) % k === 0);
            }
            return ts;
          };
          const lab = (t, op, k) => (
            <text key={k} x={sx(t.x)} y={rd ? H - pad.b + PX(20) : H - 10} className={"axis-label x" + (t.strong ? " strong" : "")}
                  style={op != null && op < 1 ? { fontSize: axisUnits, opacity: op } : { fontSize: axisUnits }} textAnchor="middle">{t.label}</text>
          );
          const now = thin(xTicks);
          /* mid-zoom, the months the old window named hand over to the new
             window's: a month both name, in the same words, holds */
          const was = zoomY && zoomY.xTicks ? thin(zoomY.xTicks) : null;
          if (!was) return now.map((t) => lab(t, null, "x" + t.x));
          const key = (t) => t.x + "|" + t.label;
          const nowK = new Set(now.map(key)), wasK = new Set(was.map(key));
          return was.filter((t) => !nowK.has(key(t))).map((t) => lab(t, textOut(winE), "xw" + t.x))
            .concat(now.map((t) => lab(t, wasK.has(key(t)) ? null : textIn(winE), "x" + t.x)));
        })()}
        {/* Key events – geometry from evPlaced above; this only draws it. */}
        {(() => {
          /* The redesign's numbered badges sit a month apart on a phone, closer
             than a badge is wide, so they are spread along the row the usual
             way: runs that would overlap are centred on their events a badge's
             width apart, and each keeps a short tie down to its own rule. */
          if (!rd) return null;
          /* spread one view's badges; mid-switch each view's spread is worked
             out on its own and a badge both carry slides between the two */
          const spread = (placed) => {
            const at = new Map();
            const lead = placed.filter((p) => p.row == null && p.e.badge != null && p.e.badgeLead).map((p) => ({ ex: p.ex, p }));
            const gap = PX(17);
            let runs = lead.map((b) => ({ items: [b], x0: b.ex }));
            for (let moved = true, guard = 0; moved && guard < 20; guard++) {
              moved = false;
              runs.forEach((r) => { const mid = r.items.reduce((s, b) => s + b.ex, 0) / r.items.length; r.x0 = mid - ((r.items.length - 1) * gap) / 2; });
              for (let k = 1; k < runs.length; k++) {
                const a = runs[k - 1], b = runs[k];
                if (a.x0 + (a.items.length - 1) * gap + gap > b.x0) { a.items = a.items.concat(b.items); runs.splice(k, 1); moved = true; break; }
              }
            }
            const lo = pad.l + PX(8), hi = W - pad.r - PX(8);
            runs.forEach((r) => {
              let x0 = r.x0;
              const span = (r.items.length - 1) * gap;
              if (x0 < lo) x0 = lo;
              if (x0 + span > hi) x0 = hi - span;
              r.items.forEach((b, k) => { at.set(evKey(b.p.e), x0 + k * gap); });
            });
            return at;
          };
          const now = spread(evPlaced.filter((p) => !p.leaving));
          const was = eventsFrom && eventMix < 1 ? spread(placeEvents(eventsFrom)) : null;
          badgeAt.current = {};
          evPlaced.forEach((p, i) => {
            const k = evKey(p.e), b = now.get(k), a = was ? was.get(k) : null;
            const x = p.leaving ? a : b;
            if (x == null) return;
            badgeAt.current[i] = a != null && b != null && !p.leaving ? a + (b - a) * eventMix : x;
          });
          return null;
        })()}
        {evPlaced.map((p, i) => {
          const { e, ex, w, fsz, row, y: yRow, x, flip } = p;
          /* aria-label rather than <title>: a <title> child also produces the
             browser's own delayed tooltip, which would surface a second,
             unstyled copy on top of ours. */
          /* an event with no date formatted to "", leaving the name ending in a
             dangling " · " - only reachable when an event is built by hand
             rather than taken from the dataset, which is no longer done */
          const aDate = fmtEventDate(e.date);
          const aria = e.label + (e.desc ? " – " + e.desc : "") + (aDate ? ", " + aDate : "");
          /* No pointer listeners of its own. Hover and tap are both picked
             from the svg root, so the open annotation is state, and `on` is
             what marks it – CSS :hover no longer has to agree with the pick to
             keep the label lit. */
          const cls = "evt" + (evt && evt.e === e ? " on" : "");
          const fadeSt = p.op != null && p.op < 1 ? { opacity: p.op } : null;
          const k = evKey(e) + (p.leaving ? "|out" : "");
          /* the anchor a list tap scrolls to, on the open set's rule: a
             rendered target survives a badge slide where a computed % had
             the playground's jump quirk. Ids hang off the badge KEY, so two
             charts (hero, primary) never mint the same one. */
          const aId = ctl && evt && evt.e === e && !p.leaving && e.badgeKey ? "evt-a-" + e.badgeKey : undefined;
          // no room for a label: the reference line still earns its place
          if (row == null) return (
            <g key={k} className={cls} role="img" aria-label={aria} style={fadeSt} data-ev={k} id={aId}>
              {/* a 1px dashed rule is a poor hover target; an invisible wide
                  line over it makes the annotation reachable */}
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-hit" />
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-line" />
              {/* the redesign numbers a phone's events; the names are listed
                  under the chart with their dates, one row per number */}
              {rd && e.badge != null && e.badgeLead && (() => {
                const bx = badgeAt.current && badgeAt.current[i] != null ? badgeAt.current[i] : ex;
                return (
                  <g className="rd-badge">
                    {Math.abs(bx - ex) > PX(1) && <path d={`M${bx} ${pad.t - PX(5.5)}L${ex} ${pad.t}`} className="rd-badge-tie" />}
                    <circle cx={bx} cy={pad.t - PX(13)} r={PX(7.5)} />
                    {/* a badge renumbered by the switch crossfades its figure */}
                    {p.prev && p.prev.e.badge != null && p.prev.e.badge !== e.badge && eventMix < 1 && (
                      <text x={bx} y={pad.t - PX(13)} dominantBaseline="central" textAnchor="middle"
                            style={{ fontSize: PX(10), opacity: 1 - eventMix }}>{p.prev.e.badge}</text>
                    )}
                    <text x={bx} y={pad.t - PX(13)} dominantBaseline="central" textAnchor="middle"
                          style={{ fontSize: PX(10), opacity: p.prev && p.prev.e.badge != null && p.prev.e.badge !== e.badge && eventMix < 1 ? eventMix : undefined }}>{e.badge}</text>
                  </g>
                );
              })()}
            </g>
          );
          const connTo = flip ? x + w + fsz * 0.24 : x - fsz * 0.24;
          const ruleTop = rd ? yRow + PX(5) : yRow;
          const displaced = !rd || !!p.disp;
          return (
            <g key={k} className={cls} role="img" aria-label={aria} style={fadeSt} data-ev={k} id={aId}>
              <line x1={ex} x2={ex} y1={ruleTop} y2={H - pad.b} className="evt-hit" />
              <line x1={ex} x2={ex} y1={ruleTop} y2={H - pad.b} className="evt-line" />
              {/* elbow: reads as a lead-in rule at the label's baseline */}
              {displaced && <line x1={ex} x2={connTo} y1={yRow} y2={yRow} className="evt-conn" />}
              {/* the redesign sets every name after every rule (below), so a
                  top-row event's rule, which runs down through the lower row,
                  passes behind its neighbour's name rather than through it */}
              {!rd && (
                <text x={x} y={yRow} className="evt-label" textAnchor="start"
                      style={{ fontSize: fsz, strokeWidth: refUnits * 0.34 }}>
                  {e.short}
                </text>
              )}
            </g>
          );
        })}
        {rd && evPlaced.map((p, i) => p.row == null ? null : (
          <g key={"evl" + evKey(p.e) + (p.leaving ? "|out" : "")} data-ev={"l" + evKey(p.e) + (p.leaving ? "|out" : "")}
             className={"evt" + (evt && evt.e === p.e ? " on" : "")} aria-hidden="true"
             style={p.op != null && p.op < 1 ? { opacity: p.op } : null}>
            <text x={p.x} y={p.y} className="evt-label" textAnchor="start"
                  style={{ fontSize: p.fsz, strokeWidth: PX(4) }}>
              {p.e.short}
            </text>
          </g>
        ))}
        {vlines.map((v, i) => (v.x < win[0] || v.x > win[1]) ? null : (
          <line key={"vl" + i} x1={sx(v.x)} x2={sx(v.x)} y1={pad.t} y2={H - pad.b} className={"rd-vline" + (v.cls ? " " + v.cls : "")} />
        ))}
        {/* hover guide – kept mounted; glides between months on transform */}
        {spinePts.length > 0 && (
          <line x1={0} x2={0} y1={pad.t} y2={H - pad.b} className="guide"
                style={{
                  transform: `translateX(${(hoverX != null ? hoverX : sx(spinePts[spinePts.length - 1].x)).toFixed(2)}px)`,
                  opacity: hoverX != null && !dot && !evt ? 0.7 : 0,
                }} />
        )}
        {/* scatter – the heaviest thing on the chart at up to 240 circles, and
            it holds still while a morph runs, so both clouds are memoised
            against the geometry that actually moves them. A morphing frame
            then reconciles two <g> opacities instead of hundreds of dots. */}
        <g clipPath={`url(#${plotId})`}>
          {scatterOut.length > 0 && fade < 1 && (
            <g style={{ opacity: 1 - fade }}>{outDots}</g>
          )}
          <g style={fade < 1 ? { opacity: fade } : null}>{dots}</g>
          {moveDots.length > 0 && <g>{moveDots}</g>}
        </g>
        {/* series lines (clipped to the plot area so windowed views
            don't draw the entering segment past the y-axis) */}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => (s.wipe != null && s.wipe >= 1 ? null : (
            <path key={s.id} className="series-line" data-series={s.id}
                  d={(s.smooth === false ? straightPath : rd ? monotonePath : smoothPath)(s.points, sx, sy)}
                  fill="none" stroke={s.color}
                  strokeWidth={rd ? (s.rdWidth || Math.min(3, (s.width || 3.4) * 0.8)) : (s.width || 3.4)}
                  strokeDasharray={s.dash || (s.dashed ? "6 6" : "none")}
                  clipPath={s.clipX ? `url(#${clipId + "s" + s.id})` : undefined}
                  mask={s.wipe != null && s.wipe > 0 ? `url(#${wipeId + s.id})` : undefined}
                  style={s.opacity != null ? { opacity: s.opacity } : null}
                  strokeLinejoin="round" strokeLinecap="round" />
          )))}
        </g>
        {/* hover markers – one per series, kept mounted so they glide along the line */}
        {series.map((s) => {
          // a line that is gone, or rubbed out, has no marker to glide along
          if (s.opacity === 0 || (s.wipe != null && s.wipe >= 1)) return null;
          const spx = hi != null && !dot && !evt && spinePts[hi] ? spinePts[hi].x : null;
          const p = spx != null ? ptAtXLine(s, spx) : null;
          const last = visEnd(s);
          const at = p || last;
          if (!at) return null;
          return (
            <circle key={"h" + s.id} cx={0} cy={0} r={rd ? PX(4.5) : 5}
                    className="hover-marker" data-series={s.id}
                    style={{
                      transform: `translate(${sx(at.x).toFixed(2)}px, ${sy(at.y).toFixed(2)}px)`,
                      opacity: p ? 1 : 0,
                    }}
                    fill="var(--chart-bg)" stroke={s.color} strokeWidth={rd ? 2 : 3} />
          );
        })}
        {/* end-cap dots on latest reading. `endCap:false` is how a line that
            arrives as several series says "this run is not my end" - without
            it a cycle line split at an interpolated month grew a cap at each
            run boundary, i.e. a dot in the middle of the line. */}
        {series.map((s) => {
          const last = visEnd(s);
          if (!last || s.endCap === false || (s.wipe != null && s.wipe >= 1)) return null;
          const op = (s.opacity != null ? s.opacity : 1) * (s.endCapOpacity != null ? s.endCapOpacity : 1);
          return <circle key={"e" + s.id} className="end-cap" data-series={s.id} cx={sx(last.x)} cy={sy(last.y)} r={rd ? PX(s.rdCap || 3.5) : 4.5}
                         fill={s.color} style={op < 1 || s.opacity != null ? { opacity: op } : null}
                         mask={s.wipe != null && s.wipe > 0 ? `url(#${wipeId + s.id})` : undefined} />;
        })}
        {/* rings: a point that is a count, not a poll (the election result) */}
        {marks.map((m, i) => (m.x < win[0] || m.x > win[1]) ? null : (
          <g key={"mk" + i} className={"rd-mark" + (m.hidden != null ? " fade-mark" : "")} style={m.hidden ? { opacity: 0 } : m.opacity != null ? { opacity: m.opacity } : null}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r={PX(m.r || 5)} className="rd-ring"
                    style={m.color ? { stroke: m.color } : null} />
            {m.label && (
              <text x={sx(m.x) + PX(m.labelDx != null ? m.labelDx : 10)} y={sy(m.y) + PX(m.labelDy != null ? m.labelDy : 22)}
                    className="rd-note-text" textAnchor={m.anchor || "start"}
                    style={{ fontSize: PX(12), strokeWidth: PX(4) }}>{m.label}</text>
            )}
          </g>
        ))}
        {/* direct end-of-line labels (series with an endLabel – e.g. cycle
            years) so lines are identifiable at rest, without hover; labels
            that finish at similar values are nudged apart */}
        {(() => {
          const labs = series
            .filter((s) => s.endLabel && s.points.length && s.opacity !== 0)
            .map((s) => {
              const last = visEnd(s);
              /* inkOf, not the series colour: the label is a GLYPH, and the
                 mark values for Greens/One Nation/Others fail the text
                 threshold on paper (see the -text tokens in the template) */
              return { sid: s.id, text: s.endLabel, x: sx(last.x) + (rd ? 12 : 7) / scale, ideal: sy(last.y), y: sy(last.y),
                       /* a colour with no text-weight variant (the house-lean
                          palette) is pulled a third of the way to ink, or a
                          light teal label sits under 3:1 on paper */
                       color: /var\(--(alp|lnp|grn|onp|oth|mood-pos|mood-neg|ink[-\w]*)\)/.test(s.color)
                         ? inkOf(s.color) : "color-mix(in oklch, " + s.color + " 62%, var(--ink))",
                       op: s.endLabelOpacity != null ? s.endLabelOpacity : 1 };
            })
            .sort((a, b) => a.y - b.y);
          if (!labs.length) return null;
          /* 1.15 is one set-height (0.95 font) plus the halo either side
             (0.34 stroke × 2), so a dodged row clears its neighbour with
             room to spare. 1.45 was an earlier extra-cautious choice; it
             let a daylight-having label get swept into a neighbour's
             cluster and pushed a line-height off its own line end. */
          const elFs = rd ? PX(13) : refUnits * 0.95;
          const gap = rd ? elFs * 1.22 : refUnits * 1.15;
          /* Can these be placed at all? Spreading buys room by moving labels
             off their line ends, and past a point it stops being a dodge:
             every label joins one evenly spaced stack that points at
             nobody's line. A phone does exactly that to this chart – the
             viewBox stays 300 units tall however narrow the screen gets,
             while the text holds its size on screen, so a gap that costs a
             laptop one plot-unit in twenty costs a phone more than twice
             that, and six labels stop fitting at all. The stack that came
             out had the current term's year nowhere near the current
             term's line.

             So it is decided for the chart, not per label: either they fit
             where they belong or none are drawn, because half a set of year
             labels reads as a rendering fault rather than a choice. When they
             are dropped nothing is lost – the legend chips above the chart
             already name every cycle in its own colour – and narrowing to a
             few cycles, which is how this chart is read on a phone anyway,
             brings them straight back. */
          if ((labs.length - 1) * gap > (H - pad.t - pad.b) * 0.55) return null;
          /* Labels only visually collide – and so only need spacing – where
             their text boxes x-overlap. Chain every x-overlapping pair whose
             ideal rows sit within a line-height of each other into a
             collision domain, and run the dodge per domain: a label is never
             moved for a neighbour its text can't actually touch. The y-only
             version of this swept the whole opposition-primary stack into
             one cluster – those cycles end in different month columns at
             near-identical values, so years that never visually met were
             pushed a line height or more off their own line ends. */
          /* measured textWidth, read at this font size so it lands in viewBox
             units like everything below: the char-advance table priced every
             letter at 0.72em, a quarter fat on this face, and chained labels
             into collision domains their glyphs never overlapped */
          for (const l of labs)
            l.w = textWidth(l.text, elFs, 700);
          const xOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;
          const comp = labs.map(() => -1);
          let nComp = 0;
          for (let i = 0; i < labs.length; i++) {
            if (comp[i] >= 0) continue;
            const stack = [i];
            comp[i] = nComp;
            while (stack.length) {
              const a = stack.pop();
              for (let j = 0; j < labs.length; j++)
                if (comp[j] < 0 && xOverlap(labs[a], labs[j]) && Math.abs(labs[a].ideal - labs[j].ideal) < gap) {
                  comp[j] = nComp;
                  stack.push(j);
                }
            }
            nComp++;
          }
          const groups = [];
          for (let c = 0; c < nComp; c++)
            groups.push(labs.filter((_, j) => comp[j] === c).sort((a, b) => a.y - b.y));
          /* The dodge places CLUSTERS about their own centre rather than
             cascading: the old pass pushed only the lower label of a
             colliding pair down, so a close finish pinned the top year and
             strung the rest out beneath it in order – a run of three
             near-equal endings put the last one a line height or more from
             the line it names. Instead, labels finishing within a gap of
             each other are re-spaced evenly about their shared mean, so the
             group straddles where the lines actually ended, and a label with
             daylight of its own keeps its spot exactly. */
          const dodge = (g) => {
            const clusters = [];
            for (const l of g) {
              const top = clusters[clusters.length - 1];
              if (top && l.y - top[top.length - 1].y < gap) top.push(l);
              else clusters.push([l]);
            }
            for (const c of clusters) {
              const m = c.reduce((t, l) => t + l.y, 0) / c.length;
              c.forEach((l, j) => { l.y = m + (j - (c.length - 1) / 2) * gap; });
            }
          };
          /* Bring a spilled group back inside the plot as ONE piece – the
             fit check above guarantees room, so serving the floor never
             pushes anything off the top. The opposite-edge bound keeps a
             group taller than the plot spread inside the frame instead of
             stacking every label on one edge. */
          const yLo = pad.t + gap * 0.4, yHi = H - pad.b - gap * 0.4;
          const clampGroup = (g) => {
            const under = yLo - g[0].y;
            if (under > 0) for (const l of g) l.y = Math.min(l.y + under, yHi);
            const over = g[g.length - 1].y - yHi;
            if (over > 0) for (const l of g) l.y = Math.max(l.y - over, yLo);
          };
          /* Centring keeps a cluster's mean but can squeeze it back inside a
             neighbour's gap; refolding there merges the two into one centred
             group. Clusters only ever merge, so this settles in a handful of
             folds, and the mean it settles on is the mean of the line ends
             themselves. */
          const settle = () => {
            for (const g of groups) {
              g.sort((a, b) => a.y - b.y);
              dodge(g);
              for (let fold = 0; fold < 10; fold++) {
                let collided = false;
                for (let i = 1; i < g.length; i++)
                  if (g[i].y - g[i - 1].y < gap - 0.01 && xOverlap(g[i], g[i - 1])) { collided = true; break; }
                if (!collided) break;
                dodge(g);
              }
              clampGroup(g);
            }
          };
          settle();
          /* Frame-edge clamps can push an independent group onto its
             x-overlapping neighbour (phone-width year columns sit closer
             than a label is wide). When that happens, weld the two groups
             and re-settle them as one, to a fixed point. */
          for (let pass = 0; pass < labs.length; pass++) {
            let merged = false;
            outer: for (let i = 0; i < groups.length; i++)
              for (let j = i + 1; j < groups.length; j++) {
                const hit = groups[i].some((a) => groups[j].some((b) => xOverlap(a, b) && Math.abs(a.y - b.y) < gap - 0.01));
                if (hit) { groups[j].push(...groups[i]); groups.splice(i, 1); merged = true; break outer; }
              }
            if (!merged) break;
            settle();
          }
          /* Mid-switch, lines cross, and two names that must not overlap
             trade places the frame their ends pass - a line height at once,
             which read as a twitch. While a chart is switching, each name's
             dodge (its distance from its own line's end, not its position)
             eases to the new one in ~45ms, so the pair slide past each other
             and the names stay on their lines; at rest the dodge is exact. */
          const tNow = performance.now();
          const seenL = new Set();
          for (const l of labs) {
            seenL.add(l.sid);
            const want = l.y - l.ideal, was = labOff.current.get(l.sid);
            let off = want;
            if (switching && was) off = was.off + (want - was.off) * (1 - Math.exp(-Math.min(100, tNow - was.t) / 45));
            labOff.current.set(l.sid, { off, t: tNow });
            l.y = l.ideal + off;
          }
          labOff.current.forEach((_, k) => { if (!seenL.has(k)) labOff.current.delete(k); });
          /* A line a reader hides keeps its name, at nothing, where the line
             ends: it fades out with the line (and back in) instead of
             vanishing on the press. Names sit by transform, so one that moves
             when the set changes - a neighbour taking back the room the
             hidden name had pushed it out of - glides there at rest; a switch
             places them frame by frame (.switching turns the easing off). */
          const gone = series.filter((s) => s.endLabel && s.points.length && s.opacity === 0).map((s) => {
            const last = visEnd(s);
            return { sid: s.id, text: s.endLabel, x: sx(last.x) + (rd ? 12 : 7) / scale, y: sy(last.y), op: 0,
                     color: /var\(--(alp|lnp|grn|onp|oth|mood-pos|mood-neg|ink[-\w]*)\)/.test(s.color)
                       ? inkOf(s.color) : "color-mix(in oklch, " + s.color + " 62%, var(--ink))" };
          });
          /* in the series' own order, whatever the dodge did: a name moved
             within the list is re-inserted, and re-inserted it skips its fade */
          const bySid = new Map(groups.flat().concat(gone).map((l) => [l.sid, l]));
          return series.map((s) => bySid.get(s.id)).filter(Boolean).map((l) => (
            <text key={"el" + l.sid} x={l.x} y={0} className="end-label" data-series={l.sid} dominantBaseline="middle"
                  style={{ fontSize: elFs, strokeWidth: refUnits * 0.34, opacity: l.op, transform: "translateY(" + l.y.toFixed(2) + "px)" }}
                  fill={l.color}>{l.text}</text>
          ));
        })()}
        {/* reference-line labels drawn LAST, with a paper halo – so they read
           cleanly where data lines cross the 50%/even line (esp. small screens).
           align:"left" moves a label to the left edge, clear of end-of-line
           year labels on the cycle charts */}
        {/* Both refline-label offsets scale with the type, because they are
            clearances from the y-axis labels rather than absolute gaps. A flat
            6px and 8px held against the desktop axis and failed against the
            phone one, where the axis font is half again as large: "tie" ended
            up butted against "50%" and read as one smudged token, at the exact
            point the chart makes its most important statement.
            This comment lives OUTSIDE the map on purpose: a JSX comment inside
            the callback's parenthesised return is a second sibling expression,
            which does not parse — it broke the build for a whole commit while
            a stale index.html kept the page looking fine. */}
        {refAll.map((r, i) => r.label && (
          <text key={"rl" + r.y + r.label + (r.op != null ? "|" + (r.was ? "w" : "n") : "")} style={r.op != null ? { fontSize: refUnits, strokeWidth: refUnits * 0.34, opacity: r.op } : { fontSize: refUnits, strokeWidth: refUnits * 0.34 }}
                x={r.align === "left" ? pad.l + refUnits * 0.5 : W - pad.r}
                y={sy(r.y) - refUnits * 0.5}
                className="refline-label" textAnchor={r.align === "left" ? "start" : "end"}
                /* The label is TEXT and the rule is a hairline, so they cannot
                   share one colour: r.color is a rules token (--ink-faint) that
                   sits below the contrast threshold on purpose. Labels default
                   to the lightest ink that still carries text; labelColor is
                   the escape hatch for a party-coloured one. */
                fill={r.labelColor || "var(--ink-3)"}>{r.label}</text>
        ))}
        {bracketAll.map((b, i) => {
          if (b.x < win[0] || b.x > win[1]) return null;
          const bx = sx(b.x) + PX(b.dx != null ? b.dx : 7), ya = sy(b.y0), yb = sy(b.y1), tk = PX(5);
          const mid = (ya + yb) / 2, lh = PX(17);
          const lines = b.lines || [];
          return (
            <g key={"bk" + i + (b.op != null ? (b.was ? "w" : "n") : "")} className="rd-bracket" style={b.op != null ? { opacity: b.op } : null}>
              <path d={`M${bx - tk} ${ya}H${bx}V${yb}H${bx - tk}`} className="rd-bracket-line" />
              {lines.map((ln, j) => (
                <text key={j} x={bx - PX(10)} y={mid + (j - (lines.length - 1) / 2) * lh}
                      dominantBaseline="middle" textAnchor="end"
                      className={"rd-note-text" + (j === 0 ? " rd-bracket-strong" : "")}
                      style={{ fontSize: PX(12.5), strokeWidth: PX(4) }}>{ln}</text>
              ))}
            </g>
          );
        })}
        {hotDot}
        {noteAll.map((n, i) => {
          const cls = "rd-note-text" + (n.cls ? " " + n.cls : "");
          const style = { fontSize: PX(n.size || 12), strokeWidth: PX(4),
                          fill: n.color || undefined, fontWeight: n.weight || undefined,
                          opacity: n.op != null && n.op < 1 ? n.op : undefined };
          if (n.op != null && n.op <= 0) return null;
          if (n.span) {
            const [a, b] = n.span.map(spanEdge), base = n.size || 12;
            let fit = null;
            for (const size of [base, base - 1])
              for (const t of [].concat(n.text)) {
                const lines = !fit && b > a && wrapText(t, size, n.weight || 400, (b - a) * scale, 2);
                if (lines) fit = { lines, size };
              }
            if (!fit) return null;
            const lh = PX(fit.size * 1.3), mid = sy(n.y) + PX(n.dy || 0);
            return (
              <g key={"nt" + i + (n.was ? "w" : "")}>
                {fit.lines.map((ln, j) => (
                  <text key={j} x={(a + b) / 2} y={mid + (j - (fit.lines.length - 1) / 2) * lh}
                        className={cls} textAnchor="middle" dominantBaseline="middle"
                        style={{ ...style, fontSize: PX(fit.size) }}>{ln}</text>
                ))}
              </g>
            );
          }
          const x = (n.x === "left" ? pad.l + PX(6) : n.x === "right" ? W - pad.r - PX(6) : sx(n.x)) + PX(n.dx || 0);
          return (
            <text key={"nt" + i + (n.was ? "w" : "")} x={x} y={sy(n.y) + PX(n.dy || 0)}
                  className={cls}
                  textAnchor={n.anchor || (n.x === "right" ? "end" : "start")}
                  dominantBaseline={n.baseline || "auto"}
                  style={style}>{n.text}</text>
          );
        })}
      </svg>

      {tip && (
        <div ref={tipRef} className={"tip " + (evt ? "tip-evt" : dot ? "tip-dot" : "tip-guide")
                                     + (tipCols ? " tip-cols" : "") + (tipSpill ? " tip-spill" : "")}
             style={{ left: tip.left + "%", top: tip.top + "%", width: tipCols ? tipLay.w : undefined }}>
          {tip.title && <div className="tip-title">{tip.title}</div>}
          {tip.date && <div className="tip-date">{tip.date}</div>}
          {(() => {
            const row = (r, i) => (
              <div className="tip-row" key={i}>
                {r.color && <span className={"tip-swatch" + (tip.ringSwatch ? " is-ring" : "")}
                                  style={tip.ringSwatch ? { borderColor: r.color } : { background: r.color }}></span>}
                <span className="tip-label">{r.label}</span>
                {r.note && <span className="tip-note">{r.note}</span>}
                <span className="tip-val">{r.value}</span>
              </div>
            );
            if (!tipCols) return tip.rows.map(row);
            // two stacks, not a grid: a wrapped row in one must not open a
            // gap in the other
            const half = Math.ceil(tip.rows.length / 2);
            return (
              <div className="tip-rows">
                <div className="tip-col">{tip.rows.slice(0, half).map(row)}</div>
                <div className="tip-col">{tip.rows.slice(half).map((r, i) => row(r, half + i))}</div>
              </div>
            );
          })()}
          {tip.desc && <div className="tip-desc">{tip.desc}</div>}
          {tip.sub && <div className="tip-sub">{tip.sub}</div>}
          {tip.hint && <div className="tip-hint">{tip.hint}</div>}
        </div>
      )}
      {/* The tooltip is absolutely-positioned graphics keyed to a pointer, so a
          screen reader never reaches it. This says the same thing out loud as
          the guide moves under the arrow keys. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveText}</p>
    </div>
  );
}

Object.assign(window, { TrendChart, makeScales, smoothPath, monotonePath, monotoneXY, straightPath, VB });
