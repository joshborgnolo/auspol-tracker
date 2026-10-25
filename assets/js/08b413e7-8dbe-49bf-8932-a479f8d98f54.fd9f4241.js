function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
    if (_measFam == null) _measFam = getComputedStyle(document.body).getPropertyValue("--sans").trim() || "system-ui, sans-serif";
    _measCtx.font = weight + " 100px " + _measFam;
    w = _measCtx.measureText(str).width / 100 * size;
  } else {
    w = str.length * size * 0.55;
  }
  _measCache.set(key, w);
  return w;
}
function cvSkipped(el) {
  return !!(el && el.checkVisibility) && !el.checkVisibility({
    contentVisibilityAuto: true
  });
}
let rectEpoch = 0;
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const bump = () => {
    rectEpoch++;
  };
  window.addEventListener("scroll", bump, {
    capture: true,
    passive: true
  });
  window.addEventListener("resize", bump);
  const host = document.getElementById("root") || document.body;
  if (host && typeof ResizeObserver !== "undefined") new ResizeObserver(bump).observe(host);
})();
function wrapText(str, size, weight, w, max) {
  const words = str.split(/ +/).filter(Boolean);
  const wide = ln => textWidth(ln, size, weight);
  for (let n = 1; n <= Math.min(max, words.length); n++) {
    let best = null;
    const walk = (at, left, acc) => {
      if (left === 1) {
        const lines = acc.concat(words.slice(at).join(" "));
        const widest = Math.max(...lines.map(wide));
        if (widest <= w && (!best || widest < best.widest)) best = {
          lines,
          widest
        };
        return;
      }
      for (let k = at + 1; k <= words.length - left + 1; k++) walk(k, left - 1, acc.concat(words.slice(at, k).join(" ")));
    };
    walk(0, n, []);
    if (best) return best.lines;
  }
  return null;
}
const VB = {
  W: 1000
};
const EVT_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function fmtEventDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + EVT_MONTHS[m - 1] + " " + y;
}
function makeScales({
  height,
  xDomain,
  yDomain,
  pad
}) {
  const W = VB.W,
    H = height;
  const [x0, x1] = xDomain,
    [y0, y1] = yDomain;
  const innerW = W - pad.l - pad.r,
    innerH = H - pad.t - pad.b;
  const sx = x => pad.l + (x - x0) / (x1 - x0) * innerW;
  const sy = y => pad.t + (y1 - y) / (y1 - y0) * innerH;
  return {
    sx,
    sy,
    W,
    H,
    innerW,
    innerH,
    pad
  };
}
function smoothPath(pts, sx, sy) {
  if (pts.length < 2) return "";
  const p = pts.map(d => [sx(d.x), sy(d.y)]);
  let d = `M ${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i],
      p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const t = 0.5;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6 * t * 2;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6 * t * 2;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6 * t * 2;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6 * t * 2;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}
function monotoneXY(p, lead = "M") {
  const n = p.length;
  if (!n) return "";
  const f = v => v.toFixed(2);
  let d = `${lead} ${f(p[0][0])} ${f(p[0][1])}`;
  if (n === 1) return d;
  if (n === 2) return d + ` L ${f(p[1][0])} ${f(p[1][1])}`;
  const h = [],
    s = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = p[i + 1][0] - p[i][0];
    s[i] = h[i] ? (p[i + 1][1] - p[i][1]) / h[i] : 0;
  }
  const sign = v => (v > 0) - (v < 0);
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
  return monotoneXY(pts.map(d => [sx(d.x), sy(d.y)]));
}
function straightPath(pts, sx, sy) {
  return pts.map((d, i) => `${i ? "L" : "M"} ${sx(d.x).toFixed(2)} ${sy(d.y).toFixed(2)}`).join(" ");
}
function TrendChart(props) {
  const {
    height: heightIn = 360,
    xDomain,
    yDomain,
    pad: padIn = {
      l: 46,
      r: 20,
      t: 18,
      b: 34
    },
    heightPx,
    padPx,
    widthSeed = null,
    series: seriesProp = [],
    scatter: scatterProp = [],
    yTicks = [],
    xTicks = [],
    refLines = [],
    yTickEmph = null,
    padSeries = null,
    bands = [],
    areas = [],
    fmt = v => v.toFixed(1),
    unit = "",
    tooltipTitle: tooltipTitleProp,
    onHoverIndex,
    spine: spineProp,
    axisFont = 15,
    events = [],
    extraRows: extraRowsProp,
    ariaLabel,
    yTickFmt,
    copy,
    scatterOut: scatterOutProp = [],
    scatterMove = [],
    fade = 1,
    clipX,
    eventsFrom = null,
    eventMix = 1,
    evt: evtCtl,
    onEvt,
    morphFrom = null,
    morphT = 1,
    driven = false,
    pollFacet,
    pollSplit,
    onDoubleEmpty,
    marks = [],
    notes = [],
    baseline = false,
    ringAtX = null,
    brackets = [],
    vlines = []
  } = props;
  const rd = !!(window.AP && window.AP.rd);
  const ptAtX = (s, x) => {
    for (let i = 0; i < s.points.length; i++) if (s.points[i].x === x) return s.points[i];
    return null;
  };
  const ptAtXLine = (s, x) => {
    const p = ptAtX(s, x);
    if (p || !s.interpHover) return p;
    const pts = s.points;
    if (!pts.length || x < pts[0].x || x > pts[pts.length - 1].x) return null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      if (x <= b.x) {
        const f = b.x - a.x ? (x - a.x) / (b.x - a.x) : 0;
        return {
          x,
          y: a.y + (b.y - a.y) * f,
          ...(a.raw != null && b.raw != null ? {
            raw: a.raw + (b.raw - a.raw) * f
          } : {})
        };
      }
    }
    return null;
  };
  const visEnd = s => {
    const pts = s.points,
      last = pts[pts.length - 1];
    if (!last || !s.clipX || last.x <= s.clipX[1]) return last;
    const x = s.clipX[1];
    for (let i = pts.length - 1; i > 0; i--) {
      if (pts[i - 1].x <= x) {
        const a = pts[i - 1],
          b = pts[i],
          f = b.x - a.x ? (x - a.x) / (b.x - a.x) : 0;
        return {
          x,
          y: a.y + (b.y - a.y) * f
        };
      }
    }
    return pts[0];
  };
  const [winState, setWin] = useState(xDomain);
  const win = driven ? xDomain : winState;
  const winRef = useRef(xDomain);
  const winRaf = useRef(0);
  const prev = useRef(null);
  const travelling = useRef(false);
  const [winE, setWinE] = useState(1);
  const yShown = useRef(yDomain);
  const yTrav = useRef(null);
  const axisNow = useRef(null);
  React.useEffect(() => () => cancelAnimationFrame(winRaf.current), []);
  React.useLayoutEffect(() => {
    const from = winRef.current,
      to = xDomain;
    if (from[0] === to[0] && from[1] === to[1]) return;
    if (driven) {
      cancelAnimationFrame(winRaf.current);
      winRef.current = to;
      travelling.current = false;
      setWin(to);
      return;
    }
    const box = ref.current && ref.current.getBoundingClientRect();
    const onScreen = !!box && box.bottom > 0 && box.top < (window.innerHeight || 0);
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden" || !onScreen;
    if (still) {
      winRef.current = to;
      travelling.current = false;
      yTrav.current = null;
      setWinE(1);
      setWin(to);
      return;
    }
    travelling.current = true;
    const a = from.slice();
    const was = axisNow.current;
    yTrav.current = {
      from: yShown.current.slice(),
      ticks: was ? was.yTicks : null,
      fmt: was ? was.yTickFmt : null,
      xTicks: was ? was.xTicks : null
    };
    const at = e => {
      winRef.current = [a[0] + (to[0] - a[0]) * e, a[1] + (to[1] - a[1]) * e];
      setWin(winRef.current);
      setWinE(e);
    };
    const c = window.AP.morphClock(winRaf, at, () => {
      winRef.current = to;
      travelling.current = false;
      yTrav.current = null;
      setWinE(1);
      setWin(to);
    });
    at(c.t);
  }, [xDomain[0], xDomain[1]]);
  const zoomY = !driven && yTrav.current && winE < 1 ? yTrav.current : null;
  const yDom = zoomY ? [zoomY.from[0] + (yDomain[0] - zoomY.from[0]) * winE, zoomY.from[1] + (yDomain[1] - zoomY.from[1]) * winE] : yDomain;
  const fresh = {
    series: seriesProp,
    scatter: scatterProp,
    spine: spineProp,
    scatterOut: scatterOutProp,
    tooltipTitle: tooltipTitleProp,
    extraRows: extraRowsProp
  };
  const moved = xDomain[0] !== winRef.current[0] || xDomain[1] !== winRef.current[1];
  const drawn = !driven && (travelling.current || moved) && xDomain[0] > winRef.current[0] && prev.current ? prev.current : fresh;
  const series = drawn.series,
    scatter = drawn.scatter,
    spine = drawn.spine,
    scatterOut = drawn.scatterOut;
  const tooltipTitle = drawn.tooltipTitle,
    extraRows = drawn.extraRows;
  React.useEffect(() => {
    if (!travelling.current) prev.current = fresh;
  });
  const ref = useRef(null);
  const svgRect = useRef(null);
  const badgeAt = useRef({});
  const labOff = useRef(new Map());
  const [cw, setCw] = useState(widthSeed || VB.W);
  const [, setCopyTick] = useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = entries => {
      svgRect.current = null;
      const box = entries && entries[0] && entries[0].borderBoxSize && entries[0].borderBoxSize[0];
      const w = box ? box.inlineSize : el.getBoundingClientRect().width;
      if (w > 0) setCw(w);
    };
    if (widthSeed == null && !cvSkipped(el)) update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(() => setCopyTick(t => t + 1));
    mo.observe(el, {
      attributes: true,
      attributeFilter: ["data-copying"]
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  const k0 = cw / VB.W;
  const copyMinH = ref.current && ref.current.hasAttribute("data-copying") ? cw * 0.3 : 0;
  const height = heightPx ? Math.max(heightPx, copyMinH) / k0 : heightIn;
  const padProp = padPx ? {
    l: padPx.l / k0,
    r: padPx.r / k0,
    t: padPx.t / k0,
    b: padPx.b / k0
  } : padIn;
  const pad = (() => {
    const k = cw / VB.W;
    const innerPx = (VB.W - padProp.l - padProp.r) * k;
    const need = (padSeries ? seriesProp.concat(padSeries) : seriesProp).filter(s => s.endLabel && s.opacity !== 0 && s.points.length).map(s => {
      const f = (s.points[s.points.length - 1].x - xDomain[0]) / (xDomain[1] - xDomain[0]);
      const txt = textWidth(s.endLabel, rd ? 13 : 10.5 * 0.95, 700) + (rd ? 12 : 7);
      return txt - Math.max(0, 1 - f) * innerPx;
    });
    if (!need.length) return padProp;
    const px = Math.max(0, ...need);
    return px <= padProp.r * k ? padProp : {
      ...padProp,
      r: px / k
    };
  })();
  const {
    sx,
    sy,
    W,
    H
  } = makeScales({
    height,
    xDomain: win,
    yDomain: yDom,
    pad
  });
  React.useLayoutEffect(() => {
    yShown.current = yDom;
    if (!zoomY && !travelling.current) axisNow.current = {
      yTicks,
      yTickFmt,
      xTicks
    };
  });
  const [hover, setHover] = useState(null);
  const [dot, setDot] = useState(null);
  const [evtMy, setEvtMy] = useState(null);
  const ctl = typeof onEvt === "function";
  const evt = ctl ? evtCtl : evtMy;
  const setEvt = v => {
    if (ctl) onEvt(v);else setEvtMy(v);
  };
  const tipRef = useRef(null);
  const [tipW, setTipW] = useState(0);
  const [tipLay, setTipLay] = useState({
    n: 0,
    cw: 0,
    w: 0
  });
  const [tipSpill, setTipSpill] = useState(false);
  const [tipBox, setTipBox] = useState({
    x: 0,
    vw: 0
  });
  const [tipTight, setTipTight] = useState(null);
  React.useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    setTipW(prev => Math.abs(prev - w) > 0.5 ? w : prev);
    if (ref.current) {
      const x = ref.current.getBoundingClientRect().left,
        vw = document.documentElement.clientWidth;
      setTipBox(prev => Math.abs(prev.x - x) > 0.5 || Math.abs(prev.vw - vw) > 0.5 ? {
        x,
        vw
      } : prev);
    }
    const plotH = ref.current ? ref.current.offsetHeight : 0;
    const over = el.offsetTop + 10 + el.offsetHeight > plotH;
    setTipSpill(over && !el.classList.contains("tip-dot"));
    const rows = [...el.querySelectorAll(".tip-row")];
    const spills = el.scrollWidth > el.clientWidth + 1;
    if (spills && !(tipTight && tipTight.n === rows.length && tipTight.cw === cw)) setTipTight({
      n: rows.length,
      cw,
      w: el.scrollWidth + 2
    });else if (!spills && tipTight && (tipTight.n !== rows.length || tipTight.cw !== cw)) setTipTight(null);
    if (!el.classList.contains("tip-guide") || rows.length === tipLay.n && cw === tipLay.cw) return;
    let colW = 0;
    for (const r of rows) {
      if (r.querySelector(".tip-note")) continue;
      colW = Math.max(colW, [...r.children].reduce((a, k) => a + k.offsetWidth, 0) + 7 * (r.children.length - 1));
    }
    const colsW = 2 * colW + 18 + (rows.length ? w - rows[0].offsetWidth : 0);
    setTipLay({
      n: rows.length,
      cw,
      w: over && rows.length >= 8 && colsW <= cw - 8 ? Math.ceil(colsW) : 0
    });
  });
  const clipId = "clip" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const plotId = clipId + "p";
  const wipeId = clipId + "w";
  const scale = cw / W;
  const axisUnits = (rd ? 12 : 11) / scale;
  const refUnits = (rd ? 12 : 10.5) / scale;
  const PX = v => v / Math.max(scale, 0.0001);
  const spanEdge = (v, j) => {
    if (v === "left") return pad.l + PX(6);
    if (v === "right") return W - pad.r - PX(6);
    if (v && typeof v === "object" && v.data != null) return j ? sx(v.data) - PX(12) : sx(v.data) + PX(12);
    if (v !== "data") return sx(v);
    const shown = (x, c) => !c || x >= c[0] && x <= c[1];
    const xs = series.filter(s => s.opacity !== 0 && !(s.wipe > 0.5)).flatMap(s => s.points.map(p => p.x).filter(x => shown(x, s.clipX))).concat(scatter.map(d => d.x), areas.flatMap(a => (a.points || []).map(p => p.x).filter(x => shown(x, a.clipX)))).filter(x => x >= win[0] && x <= win[1]);
    if (!xs.length) return j ? W - pad.r - PX(6) : pad.l + PX(6);
    return j ? sx(Math.min(...xs)) - PX(12) : sx(Math.max(...xs)) + PX(12);
  };
  const spinePts = spine || (series[0] ? series[0].points : []);
  const toVB = e => {
    const hit = svgRect.current && svgRect.current.e === rectEpoch ? svgRect.current : null;
    const rect = (hit || (svgRect.current = {
      r: ref.current.querySelector("svg").getBoundingClientRect(),
      e: rectEpoch
    })).r;
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: (e.clientY - rect.top) / rect.height * H,
      rect
    };
  };
  const nearestSpine = px => {
    let best = 0,
      bestD = Infinity;
    spinePts.forEach((d, i) => {
      const dx = Math.abs(sx(d.x) - px);
      if (dx < bestD) {
        bestD = dx;
        best = i;
      }
    });
    return best;
  };
  const showSpine = i => {
    setDotFrom(null, null);
    setEvt(null);
    setHover({
      index: i
    });
    onHoverIndex && onHoverIndex(i);
  };
  const dotSrc = useRef(null);
  const setDotFrom = (src, d) => {
    dotSrc.current = d ? src : null;
    setDot(d);
  };
  const handleMove = e => {
    if (dotSrc.current === "touch") setDotFrom(null, null);
    const p = toVB(e);
    const near = nearestDot(p, MOUSE_PICK_PX);
    if (near) {
      if (near !== dot) {
        setHover(null);
        setEvt(null);
        setDotFrom("mouse", near);
        onHoverIndex && onHoverIndex(null);
      }
      return;
    }
    if (dot) setDotFrom(null, null);
    const ev = nearestEvent(p, EVT_PICK_PX);
    if (ev) {
      showEvent(ev);
      return;
    }
    if (!spinePts.length) return;
    showSpine(nearestSpine(p.x));
  };
  const handleLeave = () => {
    setHover(null);
    setDotFrom(null, null);
    setEvt(null);
    onHoverIndex && onHoverIndex(null);
  };
  const rowKey = dot && window.AP.pollRowKey ? window.AP.pollRowKey(dot.meta) : null;
  const dotFacet = typeof pollFacet === "function" ? rowKey && pollFacet(dot.meta) : pollFacet;
  const openable = !!(dot && dotSrc.current === "mouse" && rowKey && window.AP.openPoll && dotFacet);
  const touchTapAt = useRef(0);
  const handleClick = e => {
    if (performance.now() - touchTapAt.current < 400) return;
    if (openable) {
      window.AP.openPoll(rowKey, dotFacet, undefined, pollSplit);
      return;
    }
    dblEmpty(e, MOUSE_PICK_PX);
  };
  const TOUCH_PICK_PX = 22;
  const MOUSE_PICK_PX = 11;
  const EVT_PICK_PX = 9;
  const nearestEvent = (p, radiusPx) => {
    if (!evPlaced.length) return null;
    const rU = radiusPx / Math.max(scale, 0.0001);
    let near = null,
      nearD = Infinity;
    for (let i = 0; i < evPlaced.length; i++) {
      const q = evPlaced[i];
      if (q.leaving) continue;
      let d = p.y >= q.y - rU && p.y <= H - pad.b + rU ? Math.abs(p.x - q.ex) : Infinity;
      if (q.row != null) {
        const dx = p.x < q.x ? q.x - p.x : p.x > q.x + q.w ? p.x - (q.x + q.w) : 0;
        const dy = p.y < q.y - q.fsz ? q.y - q.fsz - p.y : p.y > q.y + q.fsz * 0.3 ? p.y - (q.y + q.fsz * 0.3) : 0;
        d = Math.min(d, Math.hypot(dx, dy));
      }
      if (q.row == null && q.e.badge != null) {
        const bx = badgeAt.current && badgeAt.current[i] != null ? badgeAt.current[i] : q.ex;
        d = Math.min(d, Math.hypot(p.x - bx, p.y - (pad.t - PX(13))));
      }
      if (d < nearD) {
        nearD = d;
        near = q;
      }
    }
    return near && nearD <= rU ? near : null;
  };
  const showEvent = q => {
    setHover(null);
    setDotFrom(null, null);
    onHoverIndex && onHoverIndex(null);
    setEvt(cur => cur && cur.e === q.e ? cur : {
      e: q.e,
      x: q.ex,
      y: q.y
    });
  };
  const nearestDot = (p, radiusPx) => {
    if (!scatter.length) return null;
    const rPx = radiusPx / Math.max(scale, 0.0001);
    let near = null,
      nearD = Infinity;
    scatter.forEach(d => {
      if (d.op === 0) return;
      const dx = sx(d.x) - p.x,
        dy = sy(d.y) - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearD) {
        nearD = dist;
        near = d;
      }
    });
    return near && nearD <= rPx ? near : null;
  };
  const pickTouch = (e, isTap) => {
    if (!ref.current) return;
    const p = toVB(e);
    const near = nearestDot(p, TOUCH_PICK_PX);
    if (near) {
      if (isTap && dot === near) {
        setDotFrom(null, null);
        return;
      }
      setHover(null);
      setEvt(null);
      setDotFrom("touch", near);
      onHoverIndex && onHoverIndex(null);
      return;
    }
    const ev = nearestEvent(p, TOUCH_PICK_PX);
    if (ev) {
      if (isTap && evt && evt.e === ev.e) {
        setEvt(null);
        return;
      }
      showEvent(ev);
      return;
    }
    if (spinePts.length) showSpine(nearestSpine(p.x));
  };
  const TAP_SLOP_PX = 10;
  const SCRUB_PX = 8;
  const dblTap = useRef({
    t: 0,
    x: 0,
    y: 0
  });
  const dblEmpty = (e, pickPx) => {
    if (!onDoubleEmpty) return false;
    const p = toVB(e);
    if (nearestDot(p, pickPx) || nearestEvent(p, pickPx)) {
      dblTap.current.t = 0;
      return false;
    }
    const now = performance.now(),
      q = dblTap.current;
    const pair = now - q.t < 500 && Math.abs(e.clientX - q.x) < 30 && Math.abs(e.clientY - q.y) < 30;
    q.t = now;
    q.x = e.clientX;
    q.y = e.clientY;
    if (!pair) return false;
    q.t = 0;
    onDoubleEmpty();
    return true;
  };
  const gesture = useRef(null);
  const onPointerDown = e => {
    if (e.pointerType === "mouse") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      scrub: false,
      dead: false
    };
    if (e.target.closest && e.target.closest("[data-rd-swipe-exact]")) gesture.current.swiped = true;
  };
  const onPointerMove = e => {
    if (e.pointerType === "mouse") {
      handleMove(e);
      return;
    }
    const g = gesture.current;
    if (!g || g.dead) return;
    if (e.buttons === 0 && e.pressure === 0) return;
    if (g.swiped) {
      if (!g.swept) {
        g.swept = true;
        handleLeave();
      }
      return;
    }
    if (!g.scrub) {
      const dx = Math.abs(e.clientX - g.x),
        dy = Math.abs(e.clientY - g.y);
      if (dy > dx && dy > TAP_SLOP_PX) {
        g.dead = true;
        return;
      }
      if (dx < SCRUB_PX) return;
      g.scrub = true;
    }
    pickTouch(e, false);
  };
  const onPointerUp = e => {
    if (e.pointerType === "mouse") return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.dead || g.scrub) return;
    if (Math.abs(e.clientX - g.x) > TAP_SLOP_PX || Math.abs(e.clientY - g.y) > TAP_SLOP_PX) return;
    touchTapAt.current = performance.now();
    if (dblEmpty(e, TOUCH_PICK_PX)) return;
    pickTouch(e, true);
  };
  const onPointerCancel = e => {
    gesture.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };
  window.useDismissOutside(ref, !!(dot || evt || hover), handleLeave);
  const stepBy = delta => {
    if (!spinePts.length) return;
    const from = hi != null ? hi : spinePts.length - 1;
    const next = Math.max(0, Math.min(spinePts.length - 1, from + delta));
    showSpine(next);
  };
  const handleKeyDown = e => {
    switch (e.key) {
      case "ArrowLeft":
        stepBy(-1);
        break;
      case "ArrowRight":
        stepBy(1);
        break;
      case "Home":
        showSpine(0);
        break;
      case "End":
        showSpine(spinePts.length - 1);
        break;
      case "Escape":
        handleLeave();
        return;
      default:
        return;
    }
    e.preventDefault();
  };
  const hi = hover ? Math.min(hover.index, spinePts.length - 1) : null;
  const hoverX = hi != null && spinePts[hi] ? sx(spinePts[hi].x) : null;
  const guideOn = hoverX != null && !dot && !evt;
  const guideWas = useRef(false);
  const guideRest = useRef(null);
  const markRest = useRef(new Map());
  const liveMark = new Map();
  if (hi != null && !dot && !evt && spinePts[hi]) series.forEach(s => {
    if (s.opacity === 0 || s.wipe != null && s.wipe >= 1) return;
    const p = ptAtXLine(s, spinePts[hi].x);
    if (p) liveMark.set(s.id, [sx(p.x), sy(p.y)]);
  });
  React.useLayoutEffect(() => {
    if (guideOn) {
      guideRest.current = hoverX;
      markRest.current = liveMark;
    }
    guideWas.current = guideOn;
  });
  const motionless = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const entrySnap = guideOn && !guideWas.current && !motionless;
  const yLabelledOf = ticks => {
    if (!cw || ticks.length < 2) return new Set(ticks);
    const NEED = 15;
    const keep = new Set();
    let lastPx = null;
    for (const t of ticks.slice().sort((a, b) => b - a)) {
      const px = sy(t) * scale;
      if (lastPx == null || Math.abs(px - lastPx) >= NEED) {
        keep.add(t);
        lastPx = px;
      }
    }
    return keep;
  };
  const yLabelled = yLabelledOf(yTicks);
  const mf = morphFrom && morphT < 1 ? morphFrom : zoomY && zoomY.ticks ? {
    yTicks: zoomY.ticks,
    yTickFmt: zoomY.fmt,
    refLines,
    notes,
    brackets
  } : null;
  const mT = !mf ? 1 : morphFrom && morphT < 1 ? morphT : winE;
  const textOut = t => Math.max(0, Math.min(1, 1 - t / 0.45));
  const textIn = t => Math.max(0, Math.min(1, (t - 0.3) / 0.7));
  const wiping = new Set(series.filter(s => s.wipe != null && s.wipe > 0 && s.wipe < 1).map(s => s.id));
  const wipedOut = new Set(series.filter(s => s.wipe != null && s.wipe >= 1).map(s => s.id));
  const switching = !!mf || fade < 1 || !!(eventsFrom && eventMix < 1) || !!zoomY || travelling.current || driven;
  const refKey = r => r.y + "|" + (r.label || "");
  const refAll = !mf ? refLines : (() => {
    const was = new Map((mf.refLines || []).map(r => [refKey(r), r]));
    const out = refLines.map(r => was.has(refKey(r)) ? (was.delete(refKey(r)), r) : {
      ...r,
      op: r.label ? textIn(mT) : mT
    });
    was.forEach(r => out.push({
      ...r,
      op: r.label ? textOut(mT) : 1 - mT,
      was: true
    }));
    return out;
  })();
  const crossWords = (was0, now0, key) => {
    if (!mf) return now0;
    const nowK = new Set(now0.map(key)),
      wasK = new Set((was0 || []).map(key));
    return (was0 || []).filter(n => !nowK.has(key(n))).map(n => ({
      ...n,
      op: textOut(mT),
      was: true
    })).concat(now0.map(n => wasK.has(key(n)) ? n : {
      ...n,
      op: textIn(mT)
    }));
  };
  const noteAll = crossWords(mf && mf.notes, notes, n => [].concat(n.text).join("/") + "|" + n.x + "|" + n.y + "|" + (n.dy || 0) + "|" + (n.span ? n.span.join() : ""));
  const bracketAll = crossWords(mf && mf.brackets, brackets, b => (b.lines || []).join("/") + "|" + b.x + "|" + b.y0 + "|" + b.y1);
  let tip = null;
  if (evt) {
    if (evt.x != null && evt.y != null) tip = {
      left: evt.x / W * 100,
      top: evt.y / H * 100,
      title: evt.e.label,
      date: fmtEventDate(evt.e.date),
      desc: evt.e.desc,
      rows: []
    };
  } else if (dot) {
    const dm = dot.meta || {};
    tip = {
      left: sx(dot.x) / W * 100,
      top: sy(dot.y) / H * 100,
      title: dm.pollster || "",
      rows: [{
        label: dot.label || "2PP",
        value: fmt(dot.y, dot) + unit,
        color: dot.color
      }, {
        label: dm.dateLabel ? "Field" : "",
        value: dm.dateLabel || ""
      }].filter(r => r.label),
      sub: dot.sub || (dm.sample ? `n = ${dm.sample.toLocaleString()}` : ""),
      hint: openable ? "Click to open this poll in All polls" : ""
    };
  } else if (hover && hoverX != null) {
    const i = hi;
    const spx = spinePts[i] ? spinePts[i].x : null;
    tip = {
      left: hoverX / W * 100,
      top: 6,
      ringSwatch: ringAtX != null && spx != null && Math.abs(spx - ringAtX) < 1e-6,
      title: tooltipTitle ? tooltipTitle(i) : "",
      rows: (() => {
        const claimed = new Set();
        return series.map(s => {
          if (s.opacity === 0 || spx == null) return null;
          const p = ptAtXLine(s, spx);
          if (!p) return null;
          if (s.label != null) {
            if (claimed.has(s.label)) return null;
            claimed.add(s.label);
          }
          return {
            label: s.label,
            value: fmt(p.y, p) + unit,
            color: s.color,
            y: p.y,
            note: p.note
          };
        }).filter(Boolean).sort((a, b) => b.y - a.y).concat(extraRows ? extraRows(i).filter(Boolean) : []);
      })()
    };
  }
  const tipCols = !!(tip && !evt && !dot && tipLay.w && tip.rows.length === tipLay.n && cw === tipLay.cw);
  const tipRoom = Math.max(140, (tipBox.vw || cw + 16) - 16);
  const tight = !!(tip && !evt && !tipCols && tipTight && tip.rows.length === tipTight.n && cw === tipTight.cw);
  if (tip) {
    const assumed = Math.min(evt ? 240 : 156, cw);
    const tw = Math.min(tipW || assumed, tipRoom);
    if (tw <= cw || !tipBox.vw) {
      const halfPct = Math.min(50, Math.min(tw, cw) / 2 / Math.max(cw, 1) * 100);
      tip.left = Math.min(100 - halfPct, Math.max(halfPct, tip.left));
    } else {
      const c = tip.left / 100 * cw;
      const lo = 8 - tipBox.x + tw / 2,
        hi = tipBox.vw - 8 - tipBox.x - tw / 2;
      tip.left = Math.min(Math.max(lo, hi), Math.max(lo, c)) / Math.max(cw, 1) * 100;
    }
  }
  const namedSeries = [...new Set(series.filter(s => s.label && s.opacity !== 0).map(s => s.label))];
  const spanFrom = tooltipTitle && spinePts.length ? tooltipTitle(0) : "";
  const spanTo = tooltipTitle && spinePts.length ? tooltipTitle(spinePts.length - 1) : "";
  const a11yLabel = ariaLabel || [namedSeries.length ? namedSeries.join(", ") : "Polling trend", spanFrom && spanTo ? `${spanFrom} to ${spanTo}` : "", scatter.length ? `${scatter.length} individual polls plotted` : "", spinePts.length > 1 ? "Use arrow keys to read each point" : ""].filter(Boolean).map(s => s.replace(/\.$/, "")).join(". ") + ".";
  const liveText = !tip ? "" : [tip.title, tip.date || "", ...(tip.rows || []).map(r => `${r.label} ${r.value}`), tip.sub || ""].filter(Boolean).join(", ");
  const geom = [W, H, pad.l, pad.r, pad.t, pad.b, win[0], win[1], yDom[0], yDom[1]].join("|");
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
  const DOT_R = rd ? PX(cw < 640 ? 2 : 2.6) : 4.2,
    DOT_R_LIVE = rd ? PX(6) : 6.5;
  const DOT_OP = rd ? 0.5 : 0.6;
  const RING_R = PX(11);
  const dotEls = (arr, live) => arr.map((d, i) => {
    if (rd && live && dot === d) return null;
    const cx = sx(d.x),
      cy = sy(d.y),
      r = live && dot === d ? DOT_R_LIVE : DOT_R;
    const common = d.hollow ? {
      className: "scatter-dot",
      fill: "var(--chart-bg)",
      stroke: d.color,
      strokeWidth: PX(1.25),
      opacity: (live && dot && dot !== d ? 0.35 : Math.min(1, DOT_OP * 1.7)) * (d.op != null ? d.op : 1)
    } : {
      className: "scatter-dot",
      fill: d.color,
      fillOpacity: (live && dot && dot !== d ? 0.25 : DOT_OP) * (d.op != null ? d.op : 1)
    };
    const p = dotPath(d.shape, cx, cy, r);
    return p ? React.createElement("path", _extends({
      key: "s" + i,
      d: p
    }, common)) : React.createElement("circle", _extends({
      key: "s" + i,
      cx: cx,
      cy: cy,
      r: r
    }, common));
  });
  const dots = React.useMemo(() => dotEls(scatter, true), [scatter, dot, geom]);
  const hotDot = rd && dot && scatter.includes(dot) ? (() => {
    const cx = sx(dot.x),
      cy = sy(dot.y);
    const p = dotPath(dot.shape, cx, cy, DOT_R_LIVE);
    const face = {
      fill: dot.color,
      stroke: "var(--chart-bg)",
      strokeWidth: PX(2)
    };
    return React.createElement("g", {
      className: "rd-dot-hot",
      pointerEvents: "none"
    }, React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: RING_R,
      fill: "none",
      stroke: dot.color,
      strokeWidth: PX(1.5),
      opacity: 0.55
    }), p ? React.createElement("path", _extends({
      d: p
    }, face)) : React.createElement("circle", _extends({
      cx: cx,
      cy: cy,
      r: DOT_R_LIVE
    }, face)));
  })() : null;
  const outDots = React.useMemo(() => dotEls(scatterOut, false), [scatterOut, geom]);
  const moveDots = scatterMove.map((d, i) => {
    const cx = sx(d.x),
      cy = sy(d.y),
      p = dotPath(d.shape, cx, cy, DOT_R);
    const common = {
      className: "scatter-dot",
      fill: d.color,
      fillOpacity: DOT_OP * (d.op != null ? d.op : 1)
    };
    return p ? React.createElement("path", _extends({
      key: "m" + i,
      d: p
    }, common)) : React.createElement("circle", _extends({
      key: "m" + i,
      cx: cx,
      cy: cy,
      r: DOT_R
    }, common));
  });
  const wipeSig = series.some(s => s.wipe != null) ? series.map(s => s.wipe == null ? "-" : s.wipe).join("|") : "";
  const areaGeo = React.useMemo(() => areas.map(a => {
    if (!a.points || a.points.length < 2) return {
      a
    };
    if (a.wipeOf != null && wipedOut.has(a.wipeOf)) return {
      a
    };
    const edgePath = (pts, key, lead) => rd && a.smooth !== false ? monotoneXY(pts.map(d => [sx(d.x), sy(d[key])]), lead) : a.smooth ? smoothPath(pts.map(d => ({
      x: d.x,
      y: d[key]
    })), sx, sy).replace(/^M/, lead) : pts.map((d, i) => `${i ? "L" : lead} ${sx(d.x).toFixed(2)} ${sy(d[key]).toFixed(2)}`).join(" ");
    return {
      a,
      top: edgePath(a.points, "y1", "M"),
      bot: edgePath(a.points.slice().reverse(), "y0", "L")
    };
  }), [areas, geom, wipeSig, rd]);
  const copying = !!(ref.current && ref.current.hasAttribute("data-copying"));
  const placeEvents = list => {
    const evs = list.map(e => copying && e.badge != null ? {
      ...e,
      badge: null,
      badgeLead: false
    } : e).filter(e => e.x >= win[0] && e.x <= win[1]).sort((a, b) => a.x - b.x);
    const fsz = refUnits;
    const ROWS = rd ? copying ? 3 : 2 : 3;
    const ROW_H = refUnits * (rd ? 1.35 : 1.4);
    const LEAD = rd ? PX(5) : refUnits * 0.55;
    const SEP = refUnits * (copying ? 2 : 0.85);
    const rowEnd = new Array(ROWS).fill(-Infinity);
    const rightEdge = W - pad.r;
    const rowY = rd ? r => r == null ? pad.t : pad.t - PX(10) - (ROWS - 1 - r) * ROW_H : r => r == null ? pad.t + 4 : pad.t + 3 + r * ROW_H;
    if (evs.length > 2 && cw < 640) {
      return evs.map(e => ({
        e,
        ex: sx(e.x),
        w: 0,
        fsz,
        row: null,
        y: rowY(null)
      }));
    }
    if (rd && evs.some(e => e.badge != null)) {
      return evs.map(e => ({
        e,
        ex: sx(e.x),
        w: 0,
        fsz,
        row: null,
        y: rowY(null)
      }));
    }
    return evs.map(e => {
      const ex = sx(e.x);
      const w = textWidth(e.short, fsz);
      const ROW_PEN = refUnits * 0.3;
      let best = null;
      for (let r = 0; r < ROWS; r++) {
        const x = Math.max(ex + LEAD, rowEnd[r] + SEP);
        if (x + w > rightEdge) continue;
        const cost = x - (ex + LEAD) + r * ROW_PEN;
        if (best === null || cost < best.cost) best = {
          r,
          x,
          cost
        };
      }
      if (best) {
        rowEnd[best.r] = best.x + w;
        return {
          e,
          ex,
          w,
          fsz,
          row: best.r,
          y: rowY(best.r),
          x: best.x,
          flip: false,
          disp: best.x - (ex + LEAD) > PX(1)
        };
      }
      for (let r = 0; r < ROWS; r++) {
        const x = ex - LEAD - w;
        if (x >= rowEnd[r] + SEP) {
          rowEnd[r] = ex;
          return {
            e,
            ex,
            w,
            fsz,
            row: r,
            y: rowY(r),
            x,
            flip: true
          };
        }
      }
      return {
        e,
        ex,
        w,
        fsz,
        row: null,
        y: rowY(null)
      };
    });
  };
  const evKey = e => e.date + "|" + (e.short || e.label);
  const evPlaced = React.useMemo(() => {
    const to = placeEvents(events);
    if (!eventsFrom || eventMix >= 1) return to;
    const from = placeEvents(eventsFrom),
      t = eventMix;
    const byKey = new Map(from.map(p => [evKey(p.e), p]));
    const lerp = (a, b) => a + (b - a) * t;
    const out = to.map(p => {
      const q = byKey.get(evKey(p.e));
      if (!q) return {
        ...p,
        op: t
      };
      byKey.delete(evKey(p.e));
      if (p.row == null || q.row == null) return {
        ...p,
        prev: q
      };
      return {
        ...p,
        x: lerp(q.x, p.x),
        y: lerp(q.y, p.y),
        prev: q
      };
    });
    byKey.forEach(q => out.push({
      ...q,
      op: 1 - t,
      leaving: true
    }));
    return out.sort((a, b) => a.ex - b.ex);
  }, [events, eventsFrom, eventMix, copying, geom, rd]);
  if (ctl && evt) {
    const q = evPlaced.find(p => p.e === evt.e && !p.leaving);
    if (!q) {
      const cur = evt;
      setTimeout(() => {
        if (evtCtl === cur) setEvt(null);
      }, 0);
    } else if (evt.x !== q.ex || evt.y !== q.y) {
      const cur = evt;
      setTimeout(() => {
        if (evtCtl === cur) setEvt({
          e: cur.e,
          x: q.ex,
          y: q.y
        });
      }, 0);
    } else {
      evt.x = q.ex;
      evt.y = q.y;
    }
  }
  return React.createElement("div", {
    className: "chart",
    ref: ref,
    "data-copy": copy ? JSON.stringify(copy) : undefined
  }, React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "chart-svg" + (switching ? " switching" : ""),
    "data-copy-cw": copying ? Math.round(cw) : undefined,
    onPointerMove: onPointerMove,
    onPointerDown: onPointerDown,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerCancel,
    onMouseLeave: handleLeave,
    onClick: handleClick,
    style: openable ? {
      cursor: "pointer"
    } : null,
    onKeyDown: handleKeyDown,
    onBlur: handleLeave,
    tabIndex: 0,
    role: "img",
    "aria-label": a11yLabel
  }, React.createElement("defs", null, React.createElement("clipPath", {
    id: clipId
  }, React.createElement("rect", {
    x: clipX ? Math.max(pad.l, sx(clipX[0])) : pad.l,
    y: "0",
    width: clipX ? Math.max(0, Math.min(W - pad.r, sx(clipX[1]) + 5) - Math.max(pad.l, sx(clipX[0]))) : W - pad.l - pad.r,
    height: H
  })), React.createElement("clipPath", {
    id: plotId
  }, React.createElement("rect", {
    x: pad.l - DOT_R_LIVE,
    y: "0",
    width: W - pad.l - pad.r + DOT_R_LIVE * 2,
    height: H
  })), [...series.filter(s => s.clipX).map(s => ["s", s]), ...areas.filter(a => a.clipX).map(a => ["a", a])].map(([kind, e]) => {
    const x0 = Math.max(pad.l, sx(e.clipX[0]));
    const x1 = Math.min(W - pad.r, sx(e.clipX[1]) + 5);
    return React.createElement("clipPath", {
      key: kind + "c" + e.id,
      id: clipId + kind + e.id
    }, React.createElement("rect", {
      x: x0,
      y: "0",
      width: Math.max(0, x1 - x0),
      height: H
    }));
  }), series.filter(s => s.wipe != null && s.wipe > 0 && s.wipe < 1).map(s => {
    const SOFT = 0.09;
    const edge = s.wipe * (1 + 2 * SOFT) - SOFT;
    const cl = v => Math.max(0, Math.min(1, v));
    const lo = cl(edge - SOFT),
      hi2 = cl(edge + SOFT);
    return React.createElement("mask", {
      key: "w" + s.id,
      id: wipeId + s.id,
      maskUnits: "userSpaceOnUse",
      x: pad.l,
      y: "0",
      width: W - pad.l - pad.r,
      height: H
    }, React.createElement("linearGradient", {
      id: wipeId + s.id + "g",
      gradientUnits: "userSpaceOnUse",
      x1: pad.l,
      y1: "0",
      x2: W - pad.r,
      y2: "0"
    }, React.createElement("stop", {
      offset: lo,
      stopColor: "#000"
    }), React.createElement("stop", {
      offset: hi2,
      stopColor: "#fff"
    })), React.createElement("rect", {
      x: pad.l,
      y: "0",
      width: W - pad.l - pad.r,
      height: H,
      fill: `url(#${wipeId + s.id}g)`
    }));
  })), bands.map((b, i) => React.createElement("rect", {
    key: "b" + i,
    className: b.className,
    x: pad.l,
    y: sy(b.y1),
    width: W - pad.l - pad.r,
    height: Math.abs(sy(b.y0) - sy(b.y1)),
    fill: b.color
  })), areaGeo.map(({
    a,
    top,
    bot
  }) => {
    if (top == null) return null;
    return (React.createElement("g", {
        key: "a" + a.id,
        clipPath: `url(#${clipId})`
      }, React.createElement("g", {
        clipPath: a.clipX ? `url(#${clipId + "a" + a.id})` : undefined,
        mask: a.wipeOf != null && wiping.has(a.wipeOf) ? `url(#${wipeId + a.wipeOf})` : undefined,
        className: a.hidden != null ? "fade-mark" : undefined,
        style: a.hidden ? {
          opacity: 0
        } : a.fade != null && a.fade < 1 ? {
          opacity: a.fade
        } : null
      }, React.createElement("path", {
        className: a.className,
        d: `${top} ${bot} Z`,
        fill: a.color,
        opacity: a.opacity != null ? a.opacity : 1
      }), a.edge !== false && React.createElement("path", {
        d: top,
        fill: "none",
        stroke: a.color,
        strokeWidth: a.edgeWidth || 1.6,
        strokeDasharray: a.edgeDash || "4 4",
        opacity: a.edgeOpacity != null ? a.edgeOpacity : 0.85
      })))
    );
  }), (() => {
    const lab = (fmt, t) => fmt ? fmt(t) : t + unit;
    const edgeOp = t => {
      const y = sy(t),
        lo = pad.t,
        hi = H - pad.b,
        band = PX(14);
      return y < lo - 0.5 ? Math.max(0, 1 - (lo - y) / band) : y > hi + 0.5 ? Math.max(0, 1 - (y - hi) / band) : 1;
    };
    const was = mf ? new Set(mf.yTicks || []) : null,
      now = new Set(yTicks);
    const all = was ? [...new Set(yTicks.concat(mf.yTicks || []))] : yTicks;
    const labWas = was ? yLabelledOf(mf.yTicks || []) : null;
    const emphSet = yTickEmph == null ? null : new Set([].concat(yTickEmph));
    return all.map(t => {
      const e = edgeOp(t);
      if (e <= 0) return null;
      const emph = emphSet && emphSet.has(t) ? " tick-emph" : "";
      const inNow = now.has(t),
        inWas = !!was && was.has(t);
      const gOp = e * (was ? inNow && inWas ? 1 : inNow ? mT : 1 - mT : 1);
      const tNow = inNow && yLabelled.has(t) ? lab(yTickFmt, t) : null;
      const tWas = inWas && labWas.has(t) ? lab(mf.yTickFmt || yTickFmt, t) : null;
      const txt = (s0, op) => s0 == null || op <= 0 ? null : React.createElement("text", {
        x: pad.l - (rd ? PX(8) : 10),
        y: sy(t),
        className: "axis-label y" + emph,
        dominantBaseline: "middle",
        style: op < 1 ? {
          fontSize: axisUnits,
          opacity: op
        } : {
          fontSize: axisUnits
        }
      }, s0);
      return React.createElement("g", {
        key: "y" + t,
        "data-k": "y" + t
      }, React.createElement("line", {
        x1: pad.l,
        x2: W - pad.r,
        y1: sy(t),
        y2: sy(t),
        className: "grid" + emph,
        style: gOp < 1 ? {
          opacity: gOp
        } : null
      }), was && tWas !== tNow ? React.createElement(React.Fragment, null, txt(tWas, e * textOut(mT)), txt(tNow, e * textIn(mT))) : txt(tNow, e));
    });
  })(), baseline && React.createElement("g", {
    className: "rd-axis"
  }, React.createElement("line", {
    x1: pad.l,
    x2: W - pad.r,
    y1: sy(yDom[0]),
    y2: sy(yDom[0]),
    className: "rd-base"
  }), xTicks.filter(t => t.x >= win[0] && t.x <= win[1]).map(t => React.createElement("line", {
    key: "xt" + t.x,
    x1: sx(t.x),
    x2: sx(t.x),
    y1: sy(yDom[0]),
    y2: sy(yDom[0]) + PX(4),
    className: "rd-base"
  }))), refAll.map((r, i) => React.createElement("line", {
    key: "r" + r.y + (r.label || "") + (r.op != null ? "|" + (r.was ? "w" : "n") : ""),
    x1: pad.l,
    x2: W - pad.r,
    y1: sy(r.y),
    y2: sy(r.y),
    className: "refline",
    stroke: r.color || "currentColor",
    style: r.op != null ? {
      opacity: r.op
    } : null
  })), (() => {
    const thin = list => {
      const pxOf = t => [...t.label].length * 6.3 + 10;
      const clearOf = (t, w, i) => {
        const l = list[i - 1],
          r = list[i + 1];
        return (!l || (sx(t.x) - sx(l.x)) * scale >= (w + pxOf(l)) / 2) && (!r || (sx(r.x) - sx(t.x)) * scale >= (w + pxOf(r)) / 2);
      };
      list = list.map((t, i) => t.short && !clearOf(t, pxOf(t), i) ? {
        ...t,
        label: t.short
      } : t);
      if (list.length < 3) return list;
      const fits = ts => ts.every((t, i) => i === 0 || (sx(t.x) - sx(ts[i - 1].x)) * scale >= (pxOf(t) + pxOf(ts[i - 1])) / 2);
      let ts = list;
      for (let k = 2; !fits(ts) && k <= 6; k++) {
        const anchor = Math.max(0, list.findIndex(t => /’/.test(t.label) && t !== list[0]));
        ts = list.filter((t, i) => t.short || (i - anchor) % k === 0);
      }
      return ts;
    };
    const lab = (t, op, k) => React.createElement("text", {
      key: k,
      x: sx(t.x),
      y: rd ? H - pad.b + PX(20) : H - 10,
      className: "axis-label x" + (t.strong ? " strong" : ""),
      style: op != null && op < 1 ? {
        fontSize: axisUnits,
        opacity: op
      } : {
        fontSize: axisUnits
      },
      textAnchor: "middle"
    }, t.label);
    const now = thin(xTicks);
    const was = zoomY && zoomY.xTicks ? thin(zoomY.xTicks) : null;
    if (!was) return now.map(t => lab(t, null, "x" + t.x));
    const key = t => t.x + "|" + t.label;
    const nowK = new Set(now.map(key)),
      wasK = new Set(was.map(key));
    return was.filter(t => !nowK.has(key(t))).map(t => lab(t, textOut(winE), "xw" + t.x)).concat(now.map(t => lab(t, wasK.has(key(t)) ? null : textIn(winE), "x" + t.x)));
  })(), (() => {
    if (!rd) return null;
    const spread = placed => {
      const at = new Map();
      const lead = placed.filter(p => p.row == null && p.e.badge != null && p.e.badgeLead).map(p => ({
        ex: p.ex,
        p
      }));
      const gap = PX(17);
      let runs = lead.map(b => ({
        items: [b],
        x0: b.ex
      }));
      for (let moved = true, guard = 0; moved && guard < 20; guard++) {
        moved = false;
        runs.forEach(r => {
          const mid = r.items.reduce((s, b) => s + b.ex, 0) / r.items.length;
          r.x0 = mid - (r.items.length - 1) * gap / 2;
        });
        for (let k = 1; k < runs.length; k++) {
          const a = runs[k - 1],
            b = runs[k];
          if (a.x0 + (a.items.length - 1) * gap + gap > b.x0) {
            a.items = a.items.concat(b.items);
            runs.splice(k, 1);
            moved = true;
            break;
          }
        }
      }
      const lo = pad.l + PX(8),
        hi = W - pad.r - PX(8);
      runs.forEach(r => {
        let x0 = r.x0;
        const span = (r.items.length - 1) * gap;
        if (x0 < lo) x0 = lo;
        if (x0 + span > hi) x0 = hi - span;
        r.items.forEach((b, k) => {
          at.set(evKey(b.p.e), x0 + k * gap);
        });
      });
      return at;
    };
    const now = spread(evPlaced.filter(p => !p.leaving));
    const was = eventsFrom && eventMix < 1 ? spread(placeEvents(eventsFrom)) : null;
    badgeAt.current = {};
    evPlaced.forEach((p, i) => {
      const k = evKey(p.e),
        b = now.get(k),
        a = was ? was.get(k) : null;
      const x = p.leaving ? a : b;
      if (x == null) return;
      badgeAt.current[i] = a != null && b != null && !p.leaving ? a + (b - a) * eventMix : x;
    });
    return null;
  })(), evPlaced.map((p, i) => {
    const {
      e,
      ex,
      w,
      fsz,
      row,
      y: yRow,
      x,
      flip
    } = p;
    const aDate = fmtEventDate(e.date);
    const aria = e.label + (e.desc ? " – " + e.desc : "") + (aDate ? ", " + aDate : "");
    const cls = "evt" + (evt && evt.e === e ? " on" : "");
    const fadeSt = p.op != null && p.op < 1 ? {
      opacity: p.op
    } : null;
    const k = evKey(e) + (p.leaving ? "|out" : "");
    const aId = ctl && evt && evt.e === e && !p.leaving && e.badgeKey ? "evt-a-" + e.badgeKey : undefined;
    if (row == null) return React.createElement("g", {
      key: k,
      className: cls,
      role: "img",
      "aria-label": aria,
      style: fadeSt,
      "data-ev": k,
      id: aId
    }, React.createElement("line", {
      x1: ex,
      x2: ex,
      y1: yRow,
      y2: H - pad.b,
      className: "evt-hit"
    }), React.createElement("line", {
      x1: ex,
      x2: ex,
      y1: yRow,
      y2: H - pad.b,
      className: "evt-line"
    }), rd && e.badge != null && e.badgeLead && (() => {
      const bx = badgeAt.current && badgeAt.current[i] != null ? badgeAt.current[i] : ex;
      return React.createElement("g", {
        className: "rd-badge"
      }, Math.abs(bx - ex) > PX(1) && React.createElement("path", {
        d: `M${bx} ${pad.t - PX(5.5)}L${ex} ${pad.t}`,
        className: "rd-badge-tie"
      }), React.createElement("circle", {
        cx: bx,
        cy: pad.t - PX(13),
        r: PX(7.5)
      }), p.prev && p.prev.e.badge != null && p.prev.e.badge !== e.badge && eventMix < 1 && React.createElement("text", {
        x: bx,
        y: pad.t - PX(13),
        dominantBaseline: "central",
        textAnchor: "middle",
        style: {
          fontSize: PX(10),
          opacity: 1 - eventMix
        }
      }, p.prev.e.badge), React.createElement("text", {
        x: bx,
        y: pad.t - PX(13),
        dominantBaseline: "central",
        textAnchor: "middle",
        style: {
          fontSize: PX(10),
          opacity: p.prev && p.prev.e.badge != null && p.prev.e.badge !== e.badge && eventMix < 1 ? eventMix : undefined
        }
      }, e.badge));
    })());
    const connTo = flip ? x + w + fsz * 0.24 : x - fsz * 0.24;
    const ruleTop = rd ? yRow + PX(5) : yRow;
    const displaced = !rd || !!p.disp;
    return React.createElement("g", {
      key: k,
      className: cls,
      role: "img",
      "aria-label": aria,
      style: fadeSt,
      "data-ev": k,
      id: aId
    }, React.createElement("line", {
      x1: ex,
      x2: ex,
      y1: ruleTop,
      y2: H - pad.b,
      className: "evt-hit"
    }), React.createElement("line", {
      x1: ex,
      x2: ex,
      y1: ruleTop,
      y2: H - pad.b,
      className: "evt-line"
    }), displaced && React.createElement("line", {
      x1: ex,
      x2: connTo,
      y1: yRow,
      y2: yRow,
      className: "evt-conn"
    }), !rd && React.createElement("text", {
      x: x,
      y: yRow,
      className: "evt-label",
      textAnchor: "start",
      style: {
        fontSize: fsz,
        strokeWidth: refUnits * 0.34
      }
    }, e.short));
  }), rd && evPlaced.map((p, i) => p.row == null ? null : React.createElement("g", {
    key: "evl" + evKey(p.e) + (p.leaving ? "|out" : ""),
    "data-ev": "l" + evKey(p.e) + (p.leaving ? "|out" : ""),
    className: "evt" + (evt && evt.e === p.e ? " on" : ""),
    "aria-hidden": "true",
    style: p.op != null && p.op < 1 ? {
      opacity: p.op
    } : null
  }, React.createElement("text", {
    x: p.x,
    y: p.y,
    className: "evt-label",
    textAnchor: "start",
    style: {
      fontSize: p.fsz,
      strokeWidth: PX(4)
    }
  }, p.e.short))), vlines.map((v, i) => v.x < win[0] || v.x > win[1] ? null : React.createElement("line", {
    key: "vl" + i,
    x1: sx(v.x),
    x2: sx(v.x),
    y1: pad.t,
    y2: H - pad.b,
    className: "rd-vline" + (v.cls ? " " + v.cls : "")
  })), spinePts.length > 0 && React.createElement("line", {
    x1: 0,
    x2: 0,
    y1: pad.t,
    y2: H - pad.b,
    className: "guide",
    style: {
      transform: `translateX(${(guideOn ? hoverX : guideRest.current != null ? guideRest.current : sx(spinePts[spinePts.length - 1].x)).toFixed(2)}px)`,
      opacity: guideOn ? 0.7 : 0,
      ...(entrySnap ? {
        transition: "opacity .18s ease"
      } : null)
    }
  }), React.createElement("g", {
    clipPath: `url(#${plotId})`
  }, scatterOut.length > 0 && fade < 1 && React.createElement("g", {
    style: {
      opacity: 1 - fade
    }
  }, outDots), React.createElement("g", {
    style: fade < 1 ? {
      opacity: fade
    } : null
  }, dots), moveDots.length > 0 && React.createElement("g", null, moveDots)), React.createElement("g", {
    clipPath: `url(#${clipId})`
  }, series.map(s => s.wipe != null && s.wipe >= 1 ? null : React.createElement("path", {
    key: s.id,
    className: "series-line",
    "data-series": s.id,
    d: (s.smooth === false ? straightPath : rd ? monotonePath : smoothPath)(s.points, sx, sy),
    fill: "none",
    stroke: s.color,
    strokeWidth: rd ? s.rdWidth || Math.min(3, (s.width || 3.4) * 0.8) : s.width || 3.4,
    strokeDasharray: s.dash || (s.dashed ? "6 6" : "none"),
    clipPath: s.clipX ? `url(#${clipId + "s" + s.id})` : undefined,
    mask: s.wipe != null && s.wipe > 0 ? `url(#${wipeId + s.id})` : undefined,
    style: s.opacity != null ? {
      opacity: s.opacity
    } : null,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }))), series.map(s => {
    if (s.opacity === 0 || s.wipe != null && s.wipe >= 1) return null;
    const live = liveMark.get(s.id);
    const rest = markRest.current.get(s.id);
    const last = live || rest ? null : visEnd(s);
    if (!live && !rest && !last) return null;
    const at = live || rest || [sx(last.x), sy(last.y)];
    return React.createElement("circle", {
      key: "h" + s.id,
      cx: 0,
      cy: 0,
      r: rd ? PX(4.5) : 5,
      className: "hover-marker",
      "data-series": s.id,
      style: {
        transform: `translate(${at[0].toFixed(2)}px, ${at[1].toFixed(2)}px)`,
        opacity: live ? 1 : 0,
        ...(entrySnap && live ? {
          transition: "opacity .14s ease"
        } : null)
      },
      fill: "var(--chart-bg)",
      stroke: s.color,
      strokeWidth: rd ? 2 : 3
    });
  }), series.map(s => {
    const last = visEnd(s);
    if (!last || s.endCap === false || s.wipe != null && s.wipe >= 1) return null;
    const op = (s.opacity != null ? s.opacity : 1) * (s.endCapOpacity != null ? s.endCapOpacity : 1);
    return React.createElement("circle", {
      key: "e" + s.id,
      className: "end-cap",
      "data-series": s.id,
      cx: sx(last.x),
      cy: sy(last.y),
      r: rd ? PX(s.rdCap || 3.5) : 4.5,
      fill: s.color,
      style: op < 1 || s.opacity != null ? {
        opacity: op
      } : null,
      mask: s.wipe != null && s.wipe > 0 ? `url(#${wipeId + s.id})` : undefined
    });
  }), marks.map((m, i) => {
    if (m.x < win[0] || m.x > win[1]) return null;
    const x = sx(m.x),
      y = sy(m.y),
      h = PX(m.r != null ? m.r : 4.2);
    return React.createElement("g", {
      key: "mk" + i,
      className: "rd-mark" + (m.hidden != null ? " fade-mark" : ""),
      style: m.hidden ? {
        opacity: 0
      } : m.opacity != null ? {
        opacity: m.opacity
      } : null
    }, m.cross ? m.hollow ? React.createElement(React.Fragment, null, React.createElement("path", {
      className: "rd-cross",
      style: {
        ...(m.color ? {
          stroke: m.color
        } : null),
        strokeWidth: 3.6
      },
      d: `M${x - h} ${y - h}L${x + h} ${y + h}M${x + h} ${y - h}L${x - h} ${y + h}`
    }), React.createElement("path", {
      className: "rd-cross",
      style: {
        stroke: "var(--chart-bg)",
        strokeWidth: 1.4
      },
      d: `M${x - h} ${y - h}L${x + h} ${y + h}M${x + h} ${y - h}L${x - h} ${y + h}`
    })) : React.createElement("path", {
      className: "rd-cross",
      style: m.color ? {
        stroke: m.color
      } : null,
      d: `M${x - h} ${y - h}L${x + h} ${y + h}M${x + h} ${y - h}L${x - h} ${y + h}`
    }) : m.diamond ? React.createElement("path", {
      className: "rd-ring",
      style: m.color ? {
        stroke: m.color
      } : null,
      d: `M${x} ${y - h}L${x + h} ${y}L${x} ${y + h}L${x - h} ${y}Z`
    }) : m.solid ? React.createElement("circle", {
      cx: x,
      cy: y,
      r: PX(m.r != null ? m.r : 3),
      style: {
        fill: m.color ? m.color : "var(--ink)"
      }
    }) : React.createElement("circle", {
      cx: x,
      cy: y,
      r: PX(m.r || 5),
      className: "rd-ring",
      style: m.color ? {
        stroke: m.color
      } : null
    }), m.label && React.createElement("text", {
      x: x + PX(m.labelDx != null ? m.labelDx : 10),
      y: y + PX(m.labelDy != null ? m.labelDy : 22),
      className: "rd-note-text",
      textAnchor: m.anchor || "start",
      style: {
        fontSize: PX(12),
        strokeWidth: PX(4)
      }
    }, m.label));
  }), (() => {
    const labs = series.filter(s => s.endLabel && s.points.length && s.opacity !== 0).map(s => {
      const last = visEnd(s);
      return {
        sid: s.id,
        text: s.endLabel,
        x: sx(last.x) + (rd ? 12 : 7) / scale,
        ideal: sy(last.y),
        y: sy(last.y),
        color: /var\(--(alp|lnp|grn|onp|oth|mood-pos|mood-neg|ink[-\w]*)\)/.test(s.color) ? inkOf(s.color) : "color-mix(in oklch, " + s.color + " 62%, var(--ink))",
        op: s.endLabelOpacity != null ? s.endLabelOpacity : 1
      };
    }).sort((a, b) => a.y - b.y);
    if (!labs.length) return null;
    const elFs = rd ? PX(13) : refUnits * 0.95;
    const gap = rd ? elFs * 1.22 : refUnits * 1.15;
    if ((labs.length - 1) * gap > (H - pad.t - pad.b) * 0.55) return null;
    for (const l of labs) l.w = textWidth(l.text, elFs, 700);
    const xOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;
    const comp = labs.map(() => -1);
    let nComp = 0;
    for (let i = 0; i < labs.length; i++) {
      if (comp[i] >= 0) continue;
      const stack = [i];
      comp[i] = nComp;
      while (stack.length) {
        const a = stack.pop();
        for (let j = 0; j < labs.length; j++) if (comp[j] < 0 && xOverlap(labs[a], labs[j]) && Math.abs(labs[a].ideal - labs[j].ideal) < gap) {
          comp[j] = nComp;
          stack.push(j);
        }
      }
      nComp++;
    }
    const groups = [];
    for (let c = 0; c < nComp; c++) groups.push(labs.filter((_, j) => comp[j] === c).sort((a, b) => a.y - b.y));
    const dodge = g => {
      const clusters = [];
      for (const l of g) {
        const top = clusters[clusters.length - 1];
        if (top && l.y - top[top.length - 1].y < gap) top.push(l);else clusters.push([l]);
      }
      for (const c of clusters) {
        const m = c.reduce((t, l) => t + l.y, 0) / c.length;
        c.forEach((l, j) => {
          l.y = m + (j - (c.length - 1) / 2) * gap;
        });
      }
    };
    const yLo = pad.t + gap * 0.4,
      yHi = H - pad.b - gap * 0.4;
    const clampGroup = g => {
      const under = yLo - g[0].y;
      if (under > 0) for (const l of g) l.y = Math.min(l.y + under, yHi);
      const over = g[g.length - 1].y - yHi;
      if (over > 0) for (const l of g) l.y = Math.max(l.y - over, yLo);
    };
    const settle = () => {
      for (const g of groups) {
        g.sort((a, b) => a.y - b.y);
        dodge(g);
        for (let fold = 0; fold < 10; fold++) {
          let collided = false;
          for (let i = 1; i < g.length; i++) if (g[i].y - g[i - 1].y < gap - 0.01 && xOverlap(g[i], g[i - 1])) {
            collided = true;
            break;
          }
          if (!collided) break;
          dodge(g);
        }
        clampGroup(g);
      }
    };
    settle();
    for (let pass = 0; pass < labs.length; pass++) {
      let merged = false;
      outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const hit = groups[i].some(a => groups[j].some(b => xOverlap(a, b) && Math.abs(a.y - b.y) < gap - 0.01));
        if (hit) {
          groups[j].push(...groups[i]);
          groups.splice(i, 1);
          merged = true;
          break outer;
        }
      }
      if (!merged) break;
      settle();
    }
    const tNow = performance.now();
    const seenL = new Set();
    for (const l of labs) {
      seenL.add(l.sid);
      const want = l.y - l.ideal,
        was = labOff.current.get(l.sid);
      let off = want;
      if (switching && was) off = was.off + (want - was.off) * (1 - Math.exp(-Math.min(100, tNow - was.t) / 45));
      labOff.current.set(l.sid, {
        off,
        t: tNow
      });
      l.y = l.ideal + off;
    }
    labOff.current.forEach((_, k) => {
      if (!seenL.has(k)) labOff.current.delete(k);
    });
    const gone = series.filter(s => s.endLabel && s.points.length && s.opacity === 0).map(s => {
      const last = visEnd(s);
      return {
        sid: s.id,
        text: s.endLabel,
        x: sx(last.x) + (rd ? 12 : 7) / scale,
        y: sy(last.y),
        op: 0,
        color: /var\(--(alp|lnp|grn|onp|oth|mood-pos|mood-neg|ink[-\w]*)\)/.test(s.color) ? inkOf(s.color) : "color-mix(in oklch, " + s.color + " 62%, var(--ink))"
      };
    });
    const bySid = new Map(groups.flat().concat(gone).map(l => [l.sid, l]));
    return series.map(s => bySid.get(s.id)).filter(Boolean).map(l => React.createElement("text", {
      key: "el" + l.sid,
      x: l.x,
      y: 0,
      className: "end-label",
      "data-series": l.sid,
      dominantBaseline: "middle",
      style: {
        fontSize: elFs,
        strokeWidth: refUnits * 0.34,
        opacity: l.op,
        transform: "translateY(" + l.y.toFixed(2) + "px)"
      },
      fill: l.color
    }, l.text));
  })(), refAll.map((r, i) => r.label && React.createElement("text", {
    key: "rl" + r.y + r.label + (r.op != null ? "|" + (r.was ? "w" : "n") : ""),
    style: r.op != null ? {
      fontSize: refUnits,
      strokeWidth: refUnits * 0.34,
      opacity: r.op
    } : {
      fontSize: refUnits,
      strokeWidth: refUnits * 0.34
    },
    x: r.align === "left" ? pad.l + refUnits * 0.5 : W - pad.r,
    y: sy(r.y) - refUnits * 0.5,
    className: "refline-label",
    textAnchor: r.align === "left" ? "start" : "end",
    fill: r.labelColor || "var(--ink-3)"
  }, r.label)), bracketAll.map((b, i) => {
    if (b.x < win[0] || b.x > win[1]) return null;
    const bx = sx(b.x) + PX(b.dx != null ? b.dx : 7),
      ya = sy(b.y0),
      yb = sy(b.y1),
      tk = PX(5);
    const mid = (ya + yb) / 2,
      lh = PX(17);
    const lines = b.lines || [];
    return React.createElement("g", {
      key: "bk" + i + (b.op != null ? b.was ? "w" : "n" : ""),
      className: "rd-bracket",
      style: b.op != null ? {
        opacity: b.op
      } : null
    }, React.createElement("path", {
      d: `M${bx - tk} ${ya}H${bx}V${yb}H${bx - tk}`,
      className: "rd-bracket-line"
    }), lines.map((ln, j) => React.createElement("text", {
      key: j,
      x: bx - PX(10),
      y: mid + (j - (lines.length - 1) / 2) * lh,
      dominantBaseline: "middle",
      textAnchor: "end",
      className: "rd-note-text" + (j === 0 ? " rd-bracket-strong" : ""),
      style: {
        fontSize: PX(12.5),
        strokeWidth: PX(4)
      }
    }, ln)));
  }), hotDot, noteAll.map((n, i) => {
    const cls = "rd-note-text" + (n.cls ? " " + n.cls : "");
    const style = {
      fontSize: PX(n.size || 12),
      strokeWidth: PX(4),
      fill: n.color || undefined,
      fontWeight: n.weight || undefined,
      opacity: n.op != null && n.op < 1 ? n.op : undefined
    };
    if (n.op != null && n.op <= 0) return null;
    if (n.span) {
      const [a, b] = n.span.map(spanEdge),
        base = n.size || 12;
      let fit = null;
      for (const size of [base, base - 1]) for (const t of [].concat(n.text)) {
        const lines = !fit && b > a && wrapText(t, size, n.weight || 400, (b - a) * scale, 2);
        if (lines) fit = {
          lines,
          size
        };
      }
      if (!fit) return null;
      const lh = PX(fit.size * 1.3),
        mid = sy(n.y) + PX(n.dy || 0);
      return React.createElement("g", {
        key: "nt" + i + (n.was ? "w" : "")
      }, fit.lines.map((ln, j) => React.createElement("text", {
        key: j,
        x: (a + b) / 2,
        y: mid + (j - (fit.lines.length - 1) / 2) * lh,
        className: cls,
        textAnchor: "middle",
        dominantBaseline: "middle",
        style: {
          ...style,
          fontSize: PX(fit.size)
        }
      }, ln)));
    }
    const x = (n.x === "left" ? pad.l + PX(6) : n.x === "right" ? W - pad.r - PX(6) : sx(n.x)) + PX(n.dx || 0);
    return React.createElement("text", {
      key: "nt" + i + (n.was ? "w" : ""),
      x: x,
      y: sy(n.y) + PX(n.dy || 0),
      className: cls,
      textAnchor: n.anchor || (n.x === "right" ? "end" : "start"),
      dominantBaseline: n.baseline || "auto",
      style: style
    }, n.text);
  })), tip && React.createElement("div", {
    key: evt ? "evt" : dot ? "dot" : "guide",
    ref: tipRef,
    className: "tip " + (evt ? "tip-evt" : dot ? "tip-dot" : "tip-guide") + (tipCols ? " tip-cols" : "") + (tipSpill ? " tip-spill" : "") + (tight ? " tip-tight" : ""),
    style: {
      left: tip.left + "%",
      top: tip.top + "%",
      width: tipCols ? tipLay.w : tight ? Math.min(tipTight.w, tipRoom) : undefined,
      maxWidth: evt ? undefined : tipRoom
    }
  }, tip.title && React.createElement("div", {
    className: "tip-title"
  }, tip.title), tip.date && React.createElement("div", {
    className: "tip-date"
  }, tip.date), (() => {
    const row = (r, i) => React.createElement("div", {
      className: "tip-row" + (typeof r.value === "string" && r.value.length > 22 ? " tip-row-long" : ""),
      key: i
    }, r.color && React.createElement("span", {
      className: "tip-swatch" + (tip.ringSwatch ? " is-ring" : ""),
      style: tip.ringSwatch ? {
        borderColor: r.color
      } : {
        background: r.color
      }
    }), React.createElement("span", {
      className: "tip-label"
    }, r.label), r.note && React.createElement("span", {
      className: "tip-note"
    }, r.note), React.createElement("span", {
      className: "tip-val"
    }, r.value));
    if (!tipCols) return tip.rows.map(row);
    const half = Math.ceil(tip.rows.length / 2);
    return React.createElement("div", {
      className: "tip-rows"
    }, React.createElement("div", {
      className: "tip-col"
    }, tip.rows.slice(0, half).map(row)), React.createElement("div", {
      className: "tip-col"
    }, tip.rows.slice(half).map((r, i) => row(r, half + i))));
  })(), tip.desc && React.createElement("div", {
    className: "tip-desc"
  }, tip.desc), tip.sub && React.createElement("div", {
    className: "tip-sub"
  }, tip.sub), tip.hint && React.createElement("div", {
    className: "tip-hint"
  }, tip.hint)), React.createElement("p", {
    className: "sr-only",
    "aria-live": "polite",
    "aria-atomic": "true"
  }, liveText));
}
Object.assign(window, {
  TrendChart,
  makeScales,
  smoothPath,
  monotonePath,
  monotoneXY,
  straightPath,
  VB
});