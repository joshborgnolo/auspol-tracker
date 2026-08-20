/* auspol tracker — SVG chart toolkit (no libraries) */

/* Text measurement for label layout. The old estimate was
   chars * refUnits * 0.72, which over-reserved by 51-87% on the real event
   strings — enough that labels with room to spare were being dropped as
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
 * TrendChart — the workhorse
 *  series:  [{ id, label, color, points:[{x,y}], width?, dashed?, smooth? }]
 *  scatter: [{ x, y, color, meta }]
 *  yTicks:  [numbers]   xTicks: [{x,label}]   refLines:[{y,label?,color?}]
 *  fmt:     (y) => string  for tooltip/axis
 *  bands:   [{y0,y1,color}]  shaded horizontal regions (optional)
 *  areas:   [{id,color,opacity?,points:[{x,y0,y1}]}]  shaded region whose
 *           edges VARY with x — e.g. a sampling-error floor that moves as the
 *           polls behind it change size (bands can't, they're rectangles)
 *  extraRows: (i) => [{label,value,color?}]  rows appended to the tooltip
 *           below the series rows; a point may also carry `note` for a
 *           secondary value shown beside its own row
 * ------------------------------------------------------------------ */
function TrendChart(props) {
  const {
    height = 360, xDomain, yDomain, pad = { l: 46, r: 20, t: 18, b: 34 },
    series = [], scatter = [], yTicks = [], xTicks = [], refLines = [],
    bands = [], areas = [], fmt = (v) => v.toFixed(1), unit = "", tooltipTitle,
    onHoverIndex, spine, axisFont = 15, events = [], extraRows,
  } = props;

  // series may be ragged (a leader not polled every month), so points are
  // matched to the hover spine by x value, never by index
  const ptAtX = (s, x) => {
    for (let i = 0; i < s.points.length; i++) if (s.points[i].x === x) return s.points[i];
    return null;
  };

  const { sx, sy, W, H } = makeScales({ height, xDomain, yDomain, pad });
  const [hover, setHover] = useState(null);     // {index, clientX}
  const [dot, setDot] = useState(null);         // hovered scatter point
  const ref = useRef(null);
  const clipId = "clip" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // axis text in real on-screen px — normalise by measured width so every
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

  const handleMove = (e) => {
    if (dot) return;
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (!spinePts.length) return;
    let best = 0, bestD = Infinity;
    spinePts.forEach((d, i) => {
      const dx = Math.abs(sx(d.x) - px);
      if (dx < bestD) { bestD = dx; best = i; }
    });
    setHover({ index: best });
    onHoverIndex && onHoverIndex(best);
  };

  const handleLeave = () => {
    setHover(null); setDot(null); onHoverIndex && onHoverIndex(null);
  };

  // clamp a possibly-stale hover index (range/matchup can shrink the spine
  // while the pointer rests on the chart — e.g. keyboard range switching)
  const hi = hover ? Math.min(hover.index, spinePts.length - 1) : null;
  const hoverX = hi != null && spinePts[hi] ? sx(spinePts[hi].x) : null;

  // tooltip content
  let tip = null;
  if (dot) {
    tip = {
      left: (sx(dot.x) / W) * 100, top: (sy(dot.y) / H) * 100,
      title: dot.meta.pollster, rows: [
        { label: dot.label || "2PP", value: fmt(dot.y) + unit, color: dot.color },
        { label: dot.meta.dateLabel ? "Field" : "", value: dot.meta.dateLabel || "" },
      ].filter((r) => r.label),
      sub: dot.meta.sample ? `n = ${dot.meta.sample.toLocaleString()}` : "",
    };
  } else if (hover && hoverX != null) {
    const i = hi;
    const spx = spinePts[i] ? spinePts[i].x : null;
    tip = {
      left: (hoverX / W) * 100, top: 6,
      title: tooltipTitle ? tooltipTitle(i) : "",
      // rows sorted by value, so the readout order matches the lines'
      // top-to-bottom order at the hovered point
      rows: series.map((s) => {
        if (s.opacity === 0 || spx == null) return null;
        const p = ptAtX(s, spx);
        return p ? { label: s.label, value: fmt(p.y) + unit, color: s.color, y: p.y, note: p.note } : null;
      }).filter(Boolean).sort((a, b) => b.y - a.y)
        .concat(extraRows ? extraRows(i).filter(Boolean) : []),
    };
  }

  // clamp the tooltip so it never spills past the card edge on end-of-range hovers
  if (tip) {
    const halfPx = 78;                      // ~half a typical tip width
    const halfPct = (halfPx / Math.max(cw, 1)) * 100;
    tip.left = Math.min(100 - halfPct, Math.max(halfPct, tip.left));
  }

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg"
           onMouseMove={handleMove} onMouseLeave={handleLeave}
           role="img" aria-label="Polling trend chart">
        <defs>
          <clipPath id={clipId}>
            <rect x={pad.l} y="0" width={W - pad.l - pad.r} height={H} />
          </clipPath>
        </defs>
        {/* shaded bands */}
        {bands.map((b, i) => (
          <rect key={"b" + i} x={pad.l} y={sy(b.y1)} width={W - pad.l - pad.r}
                height={Math.abs(sy(b.y0) - sy(b.y1))} fill={b.color} />
        ))}
        {/* x-varying shaded areas — drawn under everything, clipped to the plot */}
        {areas.map((a) => {
          if (!a.points || a.points.length < 2) return null;
          const top = a.points.map((d, i) => `${i ? "L" : "M"} ${sx(d.x).toFixed(2)} ${sy(d.y1).toFixed(2)}`).join(" ");
          const bot = a.points.slice().reverse().map((d) => `L ${sx(d.x).toFixed(2)} ${sy(d.y0).toFixed(2)}`).join(" ");
          return (
            <g key={"a" + a.id} clipPath={`url(#${clipId})`}>
              <path d={`${top} ${bot} Z`} fill={a.color} opacity={a.opacity != null ? a.opacity : 1} />
              {a.edge !== false && <path d={top} fill="none" stroke={a.color} strokeWidth={1.6}
                                         strokeDasharray="4 4" opacity={0.85} />}
            </g>
          );
        })}
        {/* y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={"y" + t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={pad.l - 10} y={sy(t)} className="axis-label y" style={{ fontSize: axisUnits }} dominantBaseline="middle">{t}{unit}</text>
          </g>
        ))}
        {/* reference lines (e.g. 50% / 0 net) — labels drawn last, on top */}
        {refLines.map((r, i) => (
          <line key={"r" + i} x1={pad.l} x2={W - pad.r} y1={sy(r.y)} y2={sy(r.y)}
                className="refline" stroke={r.color || "currentColor"} />
        ))}
        {/* x ticks */}
        {xTicks.map((t, i) => (
          <text key={"x" + i} x={sx(t.x)} y={H - 10} className="axis-label x" style={{ fontSize: axisUnits }} textAnchor="middle">{t.label}</text>
        ))}
        {/* Key events. A busy set (the hero's history) shows only when the chart
            is genuinely wide ON SCREEN (measured px, so phones and narrow columns
            stay uncluttered); one or two markers are never clutter and show at
            any width.

            Clustered events were the hard part: Farrer and the 2026 Budget sit
            5.6 units apart in a 1000-unit viewBox while their labels are ~60
            wide, so no arrangement puts each label above its own line. Three
            things fix it together:
              - labels are DISPLACED along their row rather than dropped, so a
                crowded one slides right until it fits;
              - every label is tied to its line by an elbow — the line rises to
                the label's baseline and runs across to meet the text, so a
                displaced label still reads unambiguously as belonging to its
                own line;
              - rows are packed first-fit rather than by index parity, which
                previously sent alternate events to alternate rows regardless of
                whether they were anywhere near each other. */}
        {(events.length <= 2 || cw >= 640) && (() => {
          const evs = events
            .filter((e) => e.x >= xDomain[0] && e.x <= xDomain[1])
            .sort((a, b) => a.x - b.x);
          const fsz = refUnits * 0.92;
          const ROWS = 3;
          const ROW_H = refUnits * 1.4;
          const LEAD = refUnits * 0.55;   // shortest elbow, line to text
          const SEP = refUnits * 0.85;    // clear air between labels in a row
          const rowEnd = new Array(ROWS).fill(-Infinity);
          const rightEdge = W - pad.r;

          const placed = evs.map((e) => {
            const ex = sx(e.x);
            const w = textWidth(e.short, fsz);
            /* Pick the row where the label sits CLOSEST to its own line, not
               simply the first row it fits in. First-fit looks right until you
               realise displacement always succeeds in row 0 — so row 0 took
               every label and the connectors stretched to 76 units, dragging
               "2026 Budget" three-quarters of the way across its neighbour.
               Choosing by displacement instead sends the second member of a
               cluster down a row, where it sits directly over its own line.
               ROW_PEN keeps things in the top row unless dropping down buys a
               real reduction, so we don't scatter over three rows to save a
               unit or two. */
            const ROW_PEN = refUnits * 0.3;
            let best = null;
            for (let r = 0; r < ROWS; r++) {
              const x = Math.max(ex + LEAD, rowEnd[r] + SEP);
              if (x + w > rightEdge) continue;
              const cost = (x - (ex + LEAD)) + r * ROW_PEN;
              if (best === null || cost < best.cost) best = { r, x, cost };
            }
            if (best) { rowEnd[best.r] = best.x + w; return { e, ex, w, row: best.r, x: best.x, flip: false }; }
            // out of room on the right — hang it to the left of its own line
            for (let r = 0; r < ROWS; r++) {
              const x = ex - LEAD - w;
              if (x >= rowEnd[r] + SEP) { rowEnd[r] = ex; return { e, ex, w, row: r, x, flip: true }; }
            }
            return { e, ex, w, row: null };   // genuinely nowhere to put it
          });

          return placed.map((p, i) => {
            const { e, ex, w, row, x, flip } = p;
            const title = <title>{e.label + (e.desc ? " — " + e.desc : "")}</title>;
            // no room for a label: the reference line still earns its place
            if (row == null) return (
              <g key={"ev" + i} className="evt">
                {title}
                <line x1={ex} x2={ex} y1={pad.t + 4} y2={H - pad.b} className="evt-line" />
              </g>
            );
            const yRow = pad.t + 3 + row * ROW_H;
            const connTo = flip ? x + w + LEAD * 0.4 : x - LEAD * 0.4;
            return (
              <g key={"ev" + i} className="evt">
                {title}
                <line x1={ex} x2={ex} y1={yRow} y2={H - pad.b} className="evt-line" />
                {/* elbow: reads as a lead-in rule at the label's baseline */}
                <line x1={ex} x2={connTo} y1={yRow} y2={yRow} className="evt-conn" />
                <text x={x} y={yRow} className="evt-label" textAnchor="start"
                      style={{ fontSize: fsz, strokeWidth: refUnits * 0.34 }}>
                  {e.short}
                </text>
              </g>
            );
          });
        })()}
        {/* hover guide — kept mounted; glides between months on transform */}
        {spinePts.length > 0 && (
          <line x1={0} x2={0} y1={pad.t} y2={H - pad.b} className="guide"
                style={{
                  transform: `translateX(${(hoverX != null ? hoverX : sx(spinePts[spinePts.length - 1].x)).toFixed(2)}px)`,
                  opacity: hoverX != null && !dot ? 0.7 : 0,
                }} />
        )}
        {/* scatter */}
        {scatter.map((d, i) => (
          <circle key={"s" + i} cx={sx(d.x)} cy={sy(d.y)} r={dot === d ? 6.5 : 4.2}
                  className="scatter-dot" fill={d.color}
                  opacity={dot && dot !== d ? 0.25 : 0.6}
                  onMouseEnter={() => setDot(d)} onMouseLeave={() => setDot(null)} />
        ))}
        {/* series lines (clipped to the plot area so windowed views
            don't draw the entering segment past the y-axis) */}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => (
            <path key={s.id} className="series-line"
                  d={(s.smooth === false ? straightPath : smoothPath)(s.points, sx, sy)}
                  fill="none" stroke={s.color} strokeWidth={s.width || 3.4}
                  strokeDasharray={s.dashed ? "6 6" : "none"}
                  style={s.opacity != null ? { opacity: s.opacity } : null}
                  strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>
        {/* hover markers — one per series, kept mounted so they glide along the line */}
        {series.map((s) => {
          if (s.opacity === 0) return null;
          const spx = hi != null && !dot && spinePts[hi] ? spinePts[hi].x : null;
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
        {/* end-cap dots on latest reading */}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          if (!last) return null;
          return <circle key={"e" + s.id} className="end-cap" cx={sx(last.x)} cy={sy(last.y)} r={4.5}
                         fill={s.color} style={s.opacity != null ? { opacity: s.opacity } : null} />;
        })}
        {/* direct end-of-line labels (series with an endLabel — e.g. cycle
            years) so lines are identifiable at rest, without hover; labels
            that finish at similar values are nudged apart */}
        {(() => {
          const labs = series
            .filter((s) => s.endLabel && s.points.length && s.opacity !== 0)
            .map((s) => {
              const last = s.points[s.points.length - 1];
              return { text: s.endLabel, x: sx(last.x) + 7, y: sy(last.y),
                       color: s.color, op: s.endLabelOpacity != null ? s.endLabelOpacity : 1 };
            })
            .sort((a, b) => a.y - b.y);
          if (!labs.length) return null;
          const gap = refUnits * 1.15;
          for (let i = 1; i < labs.length; i++) {
            if (labs[i].y - labs[i - 1].y < gap) labs[i].y = labs[i - 1].y + gap;
          }
          // if nudging pushed the stack past the plot floor, lift it back up
          const over = labs[labs.length - 1].y - (H - pad.b - 2);
          if (over > 0) for (const l of labs) l.y -= over;
          return labs.map((l, i) => (
            <text key={"el" + i} x={l.x} y={l.y} className="end-label" dominantBaseline="middle"
                  style={{ fontSize: refUnits * 0.95, strokeWidth: refUnits * 0.34, opacity: l.op }}
                  fill={l.color}>{l.text}</text>
          ));
        })()}
        {/* reference-line labels drawn LAST, with a paper halo — so they read
           cleanly where data lines cross the 50%/even line (esp. small screens).
           align:"left" moves a label to the left edge, clear of end-of-line
           year labels on the cycle charts */}
        {refLines.map((r, i) => r.label && (
          <text key={"rl" + i}
                x={r.align === "left" ? pad.l + 6 : W - pad.r}
                y={sy(r.y) - 8}
                className="refline-label" textAnchor={r.align === "left" ? "start" : "end"}
                style={{ fontSize: refUnits, strokeWidth: refUnits * 0.34 }}
                fill={r.color || "currentColor"}>{r.label}</text>
        ))}
      </svg>

      {tip && (
        <div className={"tip " + (dot ? "tip-dot" : "tip-guide")} style={{ left: tip.left + "%", top: tip.top + "%" }}>
          {tip.title && <div className="tip-title">{tip.title}</div>}
          {tip.rows.map((r, i) => (
            <div className="tip-row" key={i}>
              {r.color && <span className="tip-swatch" style={{ background: r.color }}></span>}
              <span className="tip-label">{r.label}</span>
              {r.note && <span className="tip-note">{r.note}</span>}
              <span className="tip-val">{r.value}</span>
            </div>
          ))}
          {tip.sub && <div className="tip-sub">{tip.sub}</div>}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TrendChart, makeScales, smoothPath, straightPath, VB });
