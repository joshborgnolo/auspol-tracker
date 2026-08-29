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
 *  scatter: [{ x, y, color, meta, shape?, label? }]  shape is "triangle" or
 *           "diamond"; anything else (or absent) is a circle. Only reach for
 *           one when two clouds on the same chart share a colour.
 *  yTicks:  [numbers]   xTicks: [{x,label}]
 *  refLines:[{y,label?,color?,labelColor?,align?}]  color paints the hairline,
 *           labelColor the text (defaults to --ink-3 – see the label below)
 *  fmt:     (y) => string  for tooltip/axis
 *  bands:   [{y0,y1,color}]  shaded horizontal regions (optional)
 *  areas:   [{id,color,opacity?,smooth?,edge?,clipX?,points:[{x,y0,y1}]}]  shaded
 *           region whose edges VARY with x – e.g. a sampling-error floor that
 *           moves as the polls behind it change size, or the interval around a
 *           trend line (bands can't do either, they're rectangles). `smooth`
 *           curves the edges like a trend line; `edge:false` drops the dashed
 *           outline, which an interval ribbon does not want; `className` lands
 *           on the fill so CSS can theme it; `clipX` is its own travelling
 *           window, which an interval belonging to ONE line needs for the same
 *           reason the line does.
 *  extraRows: (i) => [{label,value,color?}]  rows appended to the tooltip
 *           below the series rows; a point may also carry `note` for a
 *           secondary value shown beside its own row
 * ------------------------------------------------------------------ */
function TrendChart(props) {
  const {
    height = 360, xDomain, yDomain, pad = { l: 46, r: 20, t: 18, b: 34 },
    series: seriesProp = [], scatter: scatterProp = [], yTicks = [], xTicks = [], refLines = [],
    bands = [], areas = [], fmt = (v) => v.toFixed(1), unit = "", tooltipTitle: tooltipTitleProp,
    onHoverIndex, spine: spineProp, axisFont = 15, events = [], extraRows: extraRowsProp, ariaLabel,
    /* A chart can be mid-MORPH between two versions of itself (the hero's
       matchup switch). `scatterOut` is the cloud on its way out and `fade` how
       far the crossfade has run; `clipX` is the x window the lines are allowed
       to draw in, which travels with the morph so a series is never drawn over
       months it was never asked in. */
    scatterOut: scatterOutProp = [], scatterMove = [], fade = 1, clipX,
    /* Which archive view a dot from THIS chart should land in. The chart has no
       idea what it is plotting; the panel does. */
    pollFacet,
  } = props;

  // series may be ragged (a leader not polled every month), so points are
  // matched to the hover spine by x value, never by index
  const ptAtX = (s, x) => {
    for (let i = 0; i < s.points.length; i++) if (s.points[i].x === x) return s.points[i];
    return null;
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
  const [win, setWin] = useState(xDomain);
  const winRef = useRef(xDomain);
  const winRaf = useRef(0);
  const prev = useRef(null);                 // the props of the last SETTLED render
  const travelling = useRef(false);
  React.useEffect(() => () => cancelAnimationFrame(winRaf.current), []);
  React.useEffect(() => {
    const from = winRef.current, to = xDomain;
    if (from[0] === to[0] && from[1] === to[1]) return;
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
    if (still) { winRef.current = to; travelling.current = false; setWin(to); return; }
    cancelAnimationFrame(winRaf.current);
    travelling.current = true;
    const a = from.slice(), t0 = performance.now();
    const step = (now) => {
      const raw = Math.min(1, (now - t0) / window.AP.MORPH_MS);
      if (raw >= 1) { winRef.current = to; travelling.current = false; setWin(to); return; }
      const e = window.AP.morphEase(raw);
      winRef.current = [a[0] + (to[0] - a[0]) * e, a[1] + (to[1] - a[1]) * e];
      setWin(winRef.current);
      winRaf.current = requestAnimationFrame(step);
    };
    winRaf.current = requestAnimationFrame(step);
  }, [xDomain[0], xDomain[1]]);

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
  const drawn = (travelling.current || moved) && xDomain[0] > winRef.current[0] && prev.current
    ? prev.current : fresh;
  const series = drawn.series, scatter = drawn.scatter, spine = drawn.spine, scatterOut = drawn.scatterOut;
  const tooltipTitle = drawn.tooltipTitle, extraRows = drawn.extraRows;
  React.useEffect(() => { if (!travelling.current) prev.current = fresh; });

  const { sx, sy, W, H } = makeScales({ height, xDomain: win, yDomain, pad });
  const [hover, setHover] = useState(null);     // {index, clientX}
  const [dot, setDot] = useState(null);         // hovered scatter point
  const [evt, setEvt] = useState(null);         // hovered key event {e, x, y}
  const ref = useRef(null);
  const clipId = "clip" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const plotId = clipId + "p";      // the plot area itself, which never travels
  const wipeId = clipId + "w";      // + the series id, for a line being erased

  // axis text in real on-screen px – normalise by measured width so every
  // chart's labels match regardless of column width / responsive stacking
  const [cw, setCw] = useState(VB.W);
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setCw(el.getBoundingClientRect().width || VB.W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = cw / W;                 // px per user-unit
  const axisUnits = 11 / scale;         // → ~11px on screen, every chart
  const refUnits = 10.5 / scale;

  // shared x spine for guide-line hover (monthly)
  const spinePts = spine || (series[0] ? series[0].points : []);

  // client px -> viewBox units
  const toVB = (e) => {
    const rect = ref.current.getBoundingClientRect();
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
     the tooltip away from the only input that needs it. */
  const rowKey = dot && window.AP.pollRowKey ? window.AP.pollRowKey(dot.meta) : null;
  const openable = !!(dot && dotSrc.current === "mouse" && rowKey && window.AP.openPoll);
  const handleClick = () => {
    if (!openable) return;
    window.AP.openPoll(rowKey, pollFacet);
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
    for (const q of evPlaced) {
      // the rule, from the label's baseline down to the axis
      let d = (p.y >= q.y - rU && p.y <= H - pad.b + rU) ? Math.abs(p.x - q.ex) : Infinity;
      // …and the label itself, a far bigger and more obvious target
      if (q.row != null) {
        const dx = p.x < q.x ? q.x - p.x : p.x > q.x + q.w ? p.x - (q.x + q.w) : 0;
        const dy = p.y < q.y - q.fsz ? (q.y - q.fsz) - p.y : p.y > q.y + q.fsz * 0.3 ? p.y - (q.y + q.fsz * 0.3) : 0;
        d = Math.min(d, Math.hypot(dx, dy));
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
      const dx = sx(d.x) - p.x, dy = sy(d.y) - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearD) { nearD = dist; near = d; }
    });
    return near && nearD <= rPx ? near : null;
  };

  const pickTouch = (e) => {
    if (!ref.current) return;
    const p = toVB(e);
    const near = nearestDot(p, TOUCH_PICK_PX);
    if (near) {
      // tapping the poll that is already open closes it, so a finger can put
      // the chart back to its resting state without hunting for empty space
      if (e.type === "pointerdown" && dot === near) { setDotFrom(null, null); return; }
      setHover(null); setEvt(null); setDotFrom("touch", near); onHoverIndex && onHoverIndex(null);
      return;
    }
    const ev = nearestEvent(p, TOUCH_PICK_PX);
    if (ev) {
      // tapping the open annotation closes it, exactly as tapping its poll does
      if (e.type === "pointerdown" && evt && evt.e === ev.e) { setEvt(null); return; }
      showEvent(ev);
      return;
    }
    if (spinePts.length) showSpine(nearestSpine(p.x));
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    // keep the gesture coming to this element even if the finger drifts off it
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pickTouch(e);
  };
  const onPointerMove = (e) => {
    if (e.pointerType === "mouse") { handleMove(e); return; }
    if (e.buttons === 0 && e.pressure === 0) return;   // not an active drag
    pickTouch(e);
  };
  const onPointerUp = (e) => {
    if (e.pointerType === "mouse") return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

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
  const yLabelled = (() => {
    if (!cw || yTicks.length < 2) return new Set(yTicks);
    const NEED = 15;                      // px between label centres
    const keep = new Set();
    let lastPx = null;
    for (const t of yTicks.slice().sort((a, b) => b - a)) {
      const px = sy(t) * scale;
      if (lastPx == null || Math.abs(px - lastPx) >= NEED) { keep.add(t); lastPx = px; }
    }
    return keep;
  })();

  // tooltip content. Precedence: a hovered EVENT, then a scatter dot, then the
  // guide. Without the first case the svg's own onMouseMove kept firing while
  // the pointer sat on an event label, so the month readout covered the very
  // annotation being pointed at.
  let tip = null;
  if (evt) {
    tip = {
      left: (evt.x / W) * 100, top: (evt.y / H) * 100,
      title: evt.e.label, date: fmtEventDate(evt.e.date), desc: evt.e.desc, rows: [],
    };
  } else if (dot) {
    tip = {
      left: (sx(dot.x) / W) * 100, top: (sy(dot.y) / H) * 100,
      title: dot.meta.pollster, rows: [
        { label: dot.label || "2PP", value: fmt(dot.y) + unit, color: dot.color },
        { label: dot.meta.dateLabel ? "Field" : "", value: dot.meta.dateLabel || "" },
      ].filter((r) => r.label),
      sub: dot.meta.sample ? `n = ${dot.meta.sample.toLocaleString()}` : "",
      hint: openable ? "Click to open this poll in All polls" : "",
    };
  } else if (hover && hoverX != null) {
    const i = hi;
    const spx = spinePts[i] ? spinePts[i].x : null;
    tip = {
      left: (hoverX / W) * 100, top: 6,
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
          const p = ptAtX(s, spx);
          if (!p) return null;
          if (s.label != null) {
            if (claimed.has(s.label)) return null;
            claimed.add(s.label);
          }
          return { label: s.label, value: fmt(p.y) + unit, color: s.color, y: p.y, note: p.note };
        }).filter(Boolean).sort((a, b) => b.y - a.y)
          .concat(extraRows ? extraRows(i).filter(Boolean) : []);
      })(),
    };
  }

  /* Clamp the tooltip so it never spills past the card edge on end-of-range
     hovers. The half-width has to match the readout being drawn: one hardcoded
     "~half a typical tip" was measured off the guide readout, so the event
     panel - which is much wider - was allowed to sit up to 40px past the edge.
     240 is .tip-evt's max-width and 156 the guide/dot readouts' working width;
     both are capped in CSS, so clamping by them contains the element itself. */
  if (tip) {
    const tipMax = Math.min(evt ? 240 : 156, cw);
    const halfPct = (tipMax / 2 / Math.max(cw, 1)) * 100;
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
  const geom = [W, H, pad.l, pad.r, pad.t, pad.b, win[0], win[1], yDomain[0], yDomain[1]].join("|");
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
  const dotEls = (arr, live) => arr.map((d, i) => {
    const cx = sx(d.x), cy = sy(d.y), r = live && dot === d ? 6.5 : 4.2;
    /* no per-dot pointer listeners: both inputs pick from the svg root, so
       nothing here depends on a browser firing enter/leave on an SVG child */
    const common = { className: "scatter-dot", fill: d.color,
                     opacity: (live && dot && dot !== d ? 0.25 : 0.6) * (d.op != null ? d.op : 1) };
    const p = dotPath(d.shape, cx, cy, r);
    return p ? <path key={"s" + i} d={p} {...common} />
             : <circle key={"s" + i} cx={cx} cy={cy} r={r} {...common} />;
  });
  const dots = React.useMemo(() => dotEls(scatter, true), [scatter, dot, geom]);
  const outDots = React.useMemo(() => dotEls(scatterOut, false), [scatterOut, geom]);
  /* The dots that TRAVEL are the one group that cannot be memoised - they hold
     a different position and colour on every frame. Deliberately the small
     group: only the polls that published both matchups move, so this is ~90
     circles a frame rather than the ~330 on the chart. */
  const moveDots = scatterMove.map((d, i) => (
    <circle key={"m" + i} cx={sx(d.x)} cy={sy(d.y)} r={4.2}
            className="scatter-dot" fill={d.color} opacity={0.6 * (d.op != null ? d.op : 1)} />
  ));

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
  const evPlaced = (() => {
    const evs = events
      .filter((e) => e.x >= win[0] && e.x <= win[1])
      .sort((a, b) => a.x - b.x);
    const fsz = refUnits * 0.92;
    const ROWS = 3;
    const ROW_H = refUnits * 1.4;
    const LEAD = refUnits * 0.55;   // shortest elbow, line to text
    const SEP = refUnits * 0.85;    // clear air between labels in a row
    const rowEnd = new Array(ROWS).fill(-Infinity);
    const rightEdge = W - pad.r;
    const rowY = (r) => (r == null ? pad.t + 4 : pad.t + 3 + r * ROW_H);

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
      if (best) { rowEnd[best.r] = best.x + w; return { e, ex, w, fsz, row: best.r, y: rowY(best.r), x: best.x, flip: false }; }
      // out of room on the right – hang it to the left of its own line
      for (let r = 0; r < ROWS; r++) {
        const x = ex - LEAD - w;
        if (x >= rowEnd[r] + SEP) { rowEnd[r] = ex; return { e, ex, w, fsz, row: r, y: rowY(r), x, flip: true }; }
      }
      return { e, ex, w, fsz, row: null, y: rowY(null) };   // genuinely nowhere to put it
    });
  })();

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg"
           onPointerMove={onPointerMove} onPointerDown={onPointerDown}
           onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
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
            <rect x={pad.l} y="0" width={W - pad.l - pad.r} height={H} />
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
          {series.filter((s) => s.wipe != null && s.wipe > 0).map((s) => {
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
          <rect key={"b" + i} x={pad.l} y={sy(b.y1)} width={W - pad.l - pad.r}
                height={Math.abs(sy(b.y0) - sy(b.y1))} fill={b.color} />
        ))}
        {/* x-varying shaded areas – drawn under everything, clipped to the plot */}
        {areas.map((a) => {
          if (!a.points || a.points.length < 2) return null;
          /* `smooth` follows the same Catmull-Rom the trend lines use. An
             interval ribbon has to be drawn with the curve it belongs to –
             straight edges under a smoothed line pull away from it mid-month
             and read as a second, disagreeing series. */
          const edgePath = (pts, key, lead) => a.smooth
            ? smoothPath(pts.map((d) => ({ x: d.x, y: d[key] })), sx, sy).replace(/^M/, lead)
            : pts.map((d, i) => `${i ? "L" : lead} ${sx(d.x).toFixed(2)} ${sy(d[key]).toFixed(2)}`).join(" ");
          const top = edgePath(a.points, "y1", "M");
          const bot = edgePath(a.points.slice().reverse(), "y0", "L");
          return (
            /* the chart's window outside, the area's own inside: an interval
               that belongs to one line has to grow and retreat with it, or it
               arrives at full width while the line is still travelling */
            <g key={"a" + a.id} clipPath={`url(#${clipId})`}>
             <g clipPath={a.clipX ? `url(#${clipId + "a" + a.id})` : undefined}>
              {/* `opacity` is a presentation ATTRIBUTE, so a class rule beats
                  it – which is how a themed area gets a different weight in
                  dark without the component knowing the theme */}
              <path className={a.className} d={`${top} ${bot} Z`} fill={a.color}
                    opacity={a.opacity != null ? a.opacity : 1} />
              {a.edge !== false && <path d={top} fill="none" stroke={a.color} strokeWidth={1.6}
                                         strokeDasharray="4 4" opacity={0.85} />}
             </g>
            </g>
          );
        })}
        {/* y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={"y" + t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
            {yLabelled.has(t) && (
              <text x={pad.l - 10} y={sy(t)} className="axis-label y" style={{ fontSize: axisUnits }} dominantBaseline="middle">{t}{unit}</text>
            )}
          </g>
        ))}
        {/* reference lines (e.g. 50% / 0 net) – labels drawn last, on top */}
        {refLines.map((r, i) => (
          <line key={"r" + i} x1={pad.l} x2={W - pad.r} y1={sy(r.y)} y2={sy(r.y)}
                className="refline" stroke={r.color || "currentColor"} />
        ))}
        {/* x ticks */}
        {xTicks.map((t, i) => (
          <text key={"x" + i} x={sx(t.x)} y={H - 10} className="axis-label x" style={{ fontSize: axisUnits }} textAnchor="middle">{t.label}</text>
        ))}
        {/* Key events – geometry from evPlaced above; this only draws it. */}
        {evPlaced.map((p, i) => {
          const { e, ex, w, fsz, row, y: yRow, x, flip } = p;
          /* aria-label rather than <title>: a <title> child also produces the
             browser's own delayed tooltip, which would surface a second,
             unstyled copy on top of ours. */
          /* an event with no date formatted to "", leaving the name ending in a
             dangling " · " - only reachable when an event is built by hand
             rather than taken from the dataset, which is no longer done */
          const aDate = fmtEventDate(e.date);
          const aria = e.label + (e.desc ? " – " + e.desc : "") + (aDate ? " · " + aDate : "");
          /* No pointer listeners of its own. Hover and tap are both picked
             from the svg root, so the open annotation is state, and `on` is
             what marks it – CSS :hover no longer has to agree with the pick to
             keep the label lit. */
          const cls = "evt" + (evt && evt.e === e ? " on" : "");
          // no room for a label: the reference line still earns its place
          if (row == null) return (
            <g key={"ev" + i} className={cls} role="img" aria-label={aria}>
              {/* a 1px dashed rule is a poor hover target; an invisible wide
                  line over it makes the annotation reachable */}
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-hit" />
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-line" />
            </g>
          );
          const connTo = flip ? x + w + fsz * 0.24 : x - fsz * 0.24;
          return (
            <g key={"ev" + i} className={cls} role="img" aria-label={aria}>
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-hit" />
              <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-line" />
              {/* elbow: reads as a lead-in rule at the label's baseline */}
              <line x1={ex} x2={connTo} y1={yRow} y2={yRow} className="evt-conn" />
              <text x={x} y={yRow} className="evt-label" textAnchor="start"
                    style={{ fontSize: fsz, strokeWidth: refUnits * 0.34 }}>
                {e.short}
              </text>
            </g>
          );
        })}
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
            <path key={s.id} className="series-line"
                  d={(s.smooth === false ? straightPath : smoothPath)(s.points, sx, sy)}
                  fill="none" stroke={s.color} strokeWidth={s.width || 3.4}
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
          const p = spx != null ? ptAtX(s, spx) : null;
          const last = s.points[s.points.length - 1];
          const at = p || last;
          if (!at) return null;
          return (
            <circle key={"h" + s.id} cx={0} cy={0} r={5}
                    className="hover-marker"
                    style={{
                      transform: `translate(${sx(at.x).toFixed(2)}px, ${sy(at.y).toFixed(2)}px)`,
                      opacity: p ? 1 : 0,
                    }}
                    fill="var(--chart-bg)" stroke={s.color} strokeWidth={3} />
          );
        })}
        {/* end-cap dots on latest reading. `endCap:false` is how a line that
            arrives as several series says "this run is not my end" - without
            it a cycle line split at an interpolated month grew a cap at each
            run boundary, i.e. a dot in the middle of the line. */}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          if (!last || s.endCap === false) return null;
          return <circle key={"e" + s.id} className="end-cap" cx={sx(last.x)} cy={sy(last.y)} r={4.5}
                         fill={s.color} style={s.opacity != null ? { opacity: s.opacity } : null} />;
        })}
        {/* direct end-of-line labels (series with an endLabel – e.g. cycle
            years) so lines are identifiable at rest, without hover; labels
            that finish at similar values are nudged apart */}
        {(() => {
          const labs = series
            .filter((s) => s.endLabel && s.points.length && s.opacity !== 0)
            .map((s) => {
              const last = s.points[s.points.length - 1];
              return { text: s.endLabel, x: sx(last.x) + 7 / scale, y: sy(last.y),
                       color: s.color, op: s.endLabelOpacity != null ? s.endLabelOpacity : 1 };
            })
            .sort((a, b) => a.y - b.y);
          if (!labs.length) return null;
          /* 1.15 was the text's own height, so a nudged stack came out with
             about half a pixel of daylight between rows – legible on a laptop
             only because the labels rarely collided there. */
          const gap = refUnits * 1.45;
          /* Can these be placed at all? Spreading buys room by moving labels
             off their line ends, and past a point it stops being a dodge:
             every label joins one evenly spaced stack that points at
             nobody's line. A phone does exactly that to this chart – the
             viewBox stays 300 units tall however narrow the screen gets,
             while the text holds its size on screen, so a gap costing 13
             units on a laptop costs 44 on a phone and six labels want 91% of
             the plot. The stack that came out had the current term's year
             nowhere near the current term's line.

             So it is decided for the chart, not per label: either they fit
             where they belong or none are drawn, because half a set of year
             labels reads as a rendering fault rather than a choice. When they
             are dropped nothing is lost – the legend chips above the chart
             already name every cycle in its own colour – and narrowing to a
             few cycles, which is how this chart is read on a phone anyway,
             brings them straight back. */
          if ((labs.length - 1) * gap > (H - pad.t - pad.b) * 0.55) return null;
          /* The dodge places CLUSTERS about their own centre rather than
             cascading: the old pass pushed only the lower label of a
             colliding pair down, so a close finish pinned the top year and
             strung the rest out beneath it in order – a run of three
             near-equal endings put the last one a line height or more from
             the line it names. Instead, labels finishing within a gap of
             each other are re-spaced evenly about their shared mean, so the
             group straddles where the lines actually ended, and a label with
             daylight of its own keeps its spot exactly. */
          const dodge = () => {
            const clusters = [];
            for (const l of labs) {
              const top = clusters[clusters.length - 1];
              if (top && l.y - top[top.length - 1].y < gap) top.push(l);
              else clusters.push([l]);
            }
            for (const c of clusters) {
              const m = c.reduce((t, l) => t + l.y, 0) / c.length;
              c.forEach((l, j) => { l.y = m + (j - (c.length - 1) / 2) * gap; });
            }
          };
          dodge();
          /* Centring keeps a cluster's mean but can squeeze it back inside a
             neighbour's gap; refolding there merges the two into one centred
             group. Clusters only ever merge, so this settles in a handful of
             folds, and the mean it settles on is the mean of the line ends
             themselves. */
          for (let fold = 0; fold < 10; fold++) {
            let collided = false;
            for (let i = 1; i < labs.length; i++) {
              if (labs[i].y - labs[i - 1].y < gap - 0.01) { collided = true; break; }
            }
            if (!collided) break;
            dodge();
          }
          /* Bring a spilled stack back inside the plot as ONE piece – the
             fit check above guarantees room, so serving the floor never
             pushes anything off the top. */
          const yLo = pad.t + gap * 0.4, yHi = H - pad.b - gap * 0.4;
          const under = yLo - labs[0].y;
          if (under > 0) for (const l of labs) l.y += under;
          const over = labs[labs.length - 1].y - yHi;
          if (over > 0) for (const l of labs) l.y -= over;
          return labs.map((l, i) => (
            <text key={"el" + i} x={l.x} y={l.y} className="end-label" dominantBaseline="middle"
                  style={{ fontSize: refUnits * 0.95, strokeWidth: refUnits * 0.34, opacity: l.op }}
                  fill={l.color}>{l.text}</text>
          ));
        })()}
        {/* reference-line labels drawn LAST, with a paper halo – so they read
           cleanly where data lines cross the 50%/even line (esp. small screens).
           align:"left" moves a label to the left edge, clear of end-of-line
           year labels on the cycle charts */}
        {refLines.map((r, i) => r.label && (
          <text key={"rl" + i}
                x={r.align === "left" ? pad.l + 6 : W - pad.r}
                y={sy(r.y) - 8}
                className="refline-label" textAnchor={r.align === "left" ? "start" : "end"}
                style={{ fontSize: refUnits, strokeWidth: refUnits * 0.34 }}
                /* The label is TEXT and the rule is a hairline, so they cannot
                   share one colour: r.color is a rules token (--ink-faint) that
                   sits below the contrast threshold on purpose. Labels default
                   to the lightest ink that still carries text; labelColor is
                   the escape hatch for a party-coloured one. */
                fill={r.labelColor || "var(--ink-3)"}>{r.label}</text>
        ))}
      </svg>

      {tip && (
        <div className={"tip " + (evt ? "tip-evt" : dot ? "tip-dot" : "tip-guide")}
             style={{ left: tip.left + "%", top: tip.top + "%" }}>
          {tip.title && <div className="tip-title">{tip.title}</div>}
          {tip.date && <div className="tip-date">{tip.date}</div>}
          {tip.rows.map((r, i) => (
            <div className="tip-row" key={i}>
              {r.color && <span className="tip-swatch" style={{ background: r.color }}></span>}
              <span className="tip-label">{r.label}</span>
              {r.note && <span className="tip-note">{r.note}</span>}
              <span className="tip-val">{r.value}</span>
            </div>
          ))}
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

Object.assign(window, { TrendChart, makeScales, smoothPath, straightPath, VB });
