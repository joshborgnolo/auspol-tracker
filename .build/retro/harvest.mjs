/* harvest.mjs – the modern page, run in node, read for the retro pages (2026-11-09).

   The retro Now and Past cycles pages (/retro/, /cycles/retro/) say what the
   modern pages say: the same headlines, the same figures, the same charts.
   Their words are written by rules inside the modern page's React
   components (rd-hero.jsx, rd-panels.jsx, rd-cycles.jsx…), so rather than
   copy those rules, which would drift the day one of them changed, this
   module runs the modern page's own compiled scripts in a node vm and reads
   what they render.

   - The scripts are the ones a tab document loads (cycles/index.html after
     the build has written it: every module, in order), less React itself.
   - React is a small stand-in: elements are plain objects; a component is
     a function called with its props; hooks keep their values per component
     by its place in the tree, so a setter followed by rerender() is a
     click; effects never run (nothing here is measured or animated).
   - The browser is a stub: enough window and document for the scripts to
     load and render (a 1440px window, light theme, nothing stored).
   - The clock is pinned to the newest poll's release, so a build reads the
     same every time it is run on the same data (a test re-runs it and
     compares). Anything the page words relative to "now" is therefore as of
     that release; the retro pages re-word the few such phrases in the
     browser.
   - TrendChart, the one chart component every modern chart draws through,
     is not run: its props (series, bands, polls, events, axes, its copy
     title and legend) are kept as a chart spec for the retro chart drawer.

   Nothing here decides a figure. If the modern page can't be rendered, the
   harvest throws and the build says so. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SKIP_SRC = /(?:^|\/)(?:react|react-dom|late-css(?:-vic)?|explained)\.[0-9a-f]{8}\.js$/;

/* the instant the data last changed: the newest release's own stamp
   ("2026-11-08T18:00", an eastern time), as a UTC instant */
export function dataClock(dataset) {
  const i = dataset.indexOf("const individualPolls = ");
  if (i < 0) throw new Error("harvest: individualPolls missing from the dataset");
  const P = JSON.parse(dataset.slice(i + 24, dataset.indexOf("\n", i)).replace(/;$/, ""));
  let best = "";
  for (const p of P) { const s = String(p.published || p.released || ""); if (s > best) best = s; }
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(best);
  if (!m) throw new Error("harvest: no release stamp in the dataset");
  // the eastern wall clock → UTC: guess, read the guess back in Sydney, correct by the gap
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const back = (t) => { const p = {}; for (const x of fmt.formatToParts(new Date(t))) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute); };
  let t = wall - 11 * 3600e3;
  t += wall - back(t);
  return t + 60e3;   // a minute after it landed
}

export function modernRunner({ root, doc = "cycles/index.html", clock }) {
  const docPath = path.join(root, doc);
  const html = fs.readFileSync(docPath, "utf8");
  const dir = path.dirname(docPath);
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !SKIP_SRC.test(s));
  if (!srcs.some((s) => /rd-cycles\./.test(s)) || !srcs.some((s) => /rd-panels\./.test(s))) throw new Error(`harvest: ${doc} doesn't load the redesign's modules`);
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  /* ---------------------------------------------------------------- the stand-in React */
  const FRAG = Symbol("fragment");
  const NOOP = () => {};
  let frame = null;            // the component being rendered: its hook slots
  const states = new Map();    // a component's place in the tree → its hook slots
  const slot = (init) => {
    if (!frame) return { v: init(), set: NOOP };
    const f = frame, i = f.i++;
    if (!(i in f.s)) f.s[i] = init();
    return { v: f.s[i], set: (nv) => { f.s[i] = typeof nv === "function" ? nv(f.s[i]) : nv; } };
  };
  const React = {
    Fragment: FRAG, StrictMode: FRAG, Suspense: FRAG,
    createElement(type, props, ...children) {
      const p = { ...(props || {}) };
      const key = p.key != null ? String(p.key) : null;
      delete p.key; delete p.ref;
      if (children.length) p.children = children.length === 1 ? children[0] : children;
      return { $el: true, type, key, props: p };
    },
    memo: (f) => f,
    forwardRef: (f) => { const g = (p) => f(p, null); Object.defineProperty(g, "name", { value: f.name || "Forward" }); return g; },
    useState: (v) => { const s = slot(() => (typeof v === "function" ? v() : v)); return [s.v, s.set]; },
    useReducer: (r, a, init) => { const s = slot(() => (init ? init(a) : a)); return [s.v, (act) => s.set((cur) => r(cur, act))]; },
    useRef: (v) => slot(() => ({ current: v === undefined ? null : v })).v,
    useMemo: (fn) => { if (frame) frame.i++; return fn(); },
    useCallback: (fn) => { if (frame) frame.i++; return fn; },
    useEffect: () => { if (frame) frame.i++; },
    useLayoutEffect: () => { if (frame) frame.i++; },
    useInsertionEffect: () => { if (frame) frame.i++; },
    useImperativeHandle: () => { if (frame) frame.i++; },
    useContext: (c) => (c ? c._v : undefined),
    useId: () => { const s = slot(() => ":r" + (React._ids++).toString(36) + ":"); return s.v; },
    useTransition: () => [false, (f) => f()],
    useDeferredValue: (v) => v,
    useSyncExternalStore: (sub, get) => get(),
    startTransition: (f) => f(),
    createContext: (v) => ({ _v: v, Provider: FRAG, Consumer: FRAG }),
    isValidElement: (x) => !!(x && x.$el),
    cloneElement: (el, p, ...c) => ({ ...el, props: { ...el.props, ...(p || {}), ...(c.length ? { children: c.length === 1 ? c[0] : c } : {}) } }),
    Children: {
      toArray: (c) => [c].flat(Infinity).filter((x) => x != null && x !== false && x !== true),
      map: (c, f) => [c].flat(Infinity).filter((x) => x != null && x !== false && x !== true).map(f),
      forEach: (c, f) => [c].flat(Infinity).filter((x) => x != null && x !== false && x !== true).forEach(f),
      count: (c) => [c].flat(Infinity).filter((x) => x != null && x !== false && x !== true).length,
      only: (c) => c,
    },
    Component: class { constructor(p) { this.props = p; this.state = {}; } setState() {} forceUpdate() {} },
    PureComponent: class { constructor(p) { this.props = p; this.state = {}; } setState() {} forceUpdate() {} },
    _ids: 0,
  };
  const ReactDOM = { createRoot: () => ({ render: NOOP, unmount: NOOP }), hydrateRoot: () => ({ render: NOOP, unmount: NOOP }), createPortal: (c) => c, flushSync: (f) => (f ? f() : undefined), render: NOOP };

  /* ---------------------------------------------------------------- the stub browser */
  const el = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "style") return { setProperty: NOOP, removeProperty: NOOP, getPropertyValue: () => "" };
      if (k === "classList") return { add: NOOP, remove: NOOP, toggle: NOOP, contains: () => false };
      if (k === "dataset") return {};
      if (k === "children" || k === "childNodes") return [];
      if (k === "getBoundingClientRect") return () => ({ top: 0, left: 0, x: 0, y: 0, width: 1152, height: 400, right: 1152, bottom: 400 });
      if (k === "offsetWidth" || k === "clientWidth" || k === "scrollWidth") return 1152;
      if (k === "offsetHeight" || k === "clientHeight" || k === "scrollHeight") return 400;
      if (k === "textContent" || k === "innerHTML" || k === "value" || k === "id" || k === "className") return "";
      if (k === "getContext") return () => ({ measureText: (s) => ({ width: String(s).length * 7 }), font: "", fillText: NOOP, clearRect: NOOP });
      if (k === "closest" || k === "querySelector") return () => null;
      if (k === "querySelectorAll" || k === "getElementsByTagName") return () => [];
      return () => el();
    },
    apply: () => el(),
  });
  const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } }; };
  const T0 = clock;
  class PinnedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(T0); }
    static now() { return T0; }
  }
  const win = {
    React, ReactDOM, console: { log: NOOP, info: NOOP, debug: NOOP, warn: NOOP, error: NOOP },
    Math, Date: PinnedDate, JSON, Intl, Array, Object, Number, String, Boolean, Symbol, Map, Set, WeakMap, WeakSet, Promise, RegExp, Error, TypeError, RangeError,
    Reflect, Proxy, parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, escape, unescape, structuredClone,
    Uint8Array, Float64Array, Int32Array, ArrayBuffer, DataView, TextEncoder, TextDecoder, atob, btoa,
    setTimeout: () => 0, clearTimeout: NOOP, setInterval: () => 0, clearInterval: NOOP,
    requestAnimationFrame: () => 0, cancelAnimationFrame: NOOP, requestIdleCallback: () => 0, cancelIdleCallback: NOOP, queueMicrotask: NOOP,
    innerWidth: 1440, innerHeight: 950, outerWidth: 1440, outerHeight: 950, devicePixelRatio: 1, scrollY: 0, scrollX: 0, pageYOffset: 0, pageXOffset: 0,
    location: { pathname: "/", hash: "", search: "", href: "https://auspoltracker.com/", origin: "https://auspoltracker.com", host: "auspoltracker.com", hostname: "auspoltracker.com", protocol: "https:", reload: NOOP, assign: NOOP, replace: NOOP },
    history: { replaceState: NOOP, pushState: NOOP, back: NOOP, state: null, length: 1 },
    navigator: { userAgent: "auspol-retro-harvest", language: "en-AU", languages: ["en-AU"], clipboard: {}, maxTouchPoints: 0, platform: "node" },
    localStorage: storage(), sessionStorage: storage(),
    matchMedia: (q) => ({ matches: /min-width|prefers-color-scheme:\s*light|hover:\s*hover|pointer:\s*fine/.test(q) && !/max-width|prefers-reduced-motion/.test(q), media: q, addEventListener: NOOP, removeEventListener: NOOP, addListener: NOOP, removeListener: NOOP, onchange: null }),
    addEventListener: NOOP, removeEventListener: NOOP, dispatchEvent: NOOP, scrollTo: NOOP, scrollBy: NOOP, print: NOOP, open: NOOP,
    getComputedStyle: () => ({ getPropertyValue: () => "", scrollMarginTop: "0", paddingTop: "0", paddingBottom: "0", fontSize: "16px" }),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    performance: { now: () => 0, mark: NOOP, measure: NOOP, getEntriesByName: () => [] },
    fetch: () => new Promise(NOOP), URL, URLSearchParams, Blob: class {}, Image: class {}, FileReader: class {}, Event: class { constructor(t) { this.type = t; } }, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    CSS: { supports: () => false, escape: (s) => s }, getSelection: () => null, crypto: { getRandomValues: (a) => a, randomUUID: () => "0" },
  };
  win.window = win; win.self = win; win.globalThis = win; win.top = win; win.parent = win;
  win.document = {
    documentElement: el(), body: el(), head: el(), activeElement: null,
    getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [],
    createElement: () => el(), createElementNS: () => el(), createTextNode: () => el(), createDocumentFragment: () => el(),
    addEventListener: NOOP, removeEventListener: NOOP, dispatchEvent: NOOP,
    fonts: { ready: new Promise(NOOP), load: () => new Promise(NOOP), check: () => true, addEventListener: NOOP },
    visibilityState: "visible", hidden: false, readyState: "complete", cookie: "", referrer: "", title: "",
    startViewTransition: undefined,
  };
  const ctx = vm.createContext(win);
  const run = (code, name) => vm.runInContext(code, ctx, { filename: name });
  for (const c of inline) run(c, doc + " (inline)");
  for (const s of srcs) {
    const f = path.resolve(dir, s.replace(/^\//, path.relative(dir, root) + "/"));
    run(fs.readFileSync(f, "utf8"), path.basename(f));
  }
  if (!win.AP || !win.AP.D) throw new Error("harvest: the scripts loaded but window.AP.D never appeared");
  win.AP.rd = true;   // the redesign, the live default

  /* ---------------------------------------------------------------- the renderer */
  const CHART = new Set(["TrendChart"]);
  // components whose props a block reads (the lead gauge positions in pixels; its props are the figures)
  const CAPTURE = new Set(["RdLeadGauge"]);
  let mounted = null;
  function render(node, at) {
    if (node == null || node === false || node === true) return null;
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((n, i) => render(n, at + "." + (n && n.key != null ? "k" + n.key : i)));
    if (!node.$el) return null;
    const { type, props } = node;
    if (type === FRAG) return render(props.children, at + "~");
    if (typeof type === "string") return { tag: type, props, kids: render(props.children, at + ">" + type) };
    if (type && type._v !== undefined) return render(props.children, at + "~");
    if (typeof type !== "function") return null;
    const name = type.name || "anon";
    if (CHART.has(name)) return { tag: "$chart", props };
    const here = at + "/" + name;
    let fr = states.get(here);
    if (!fr) { fr = { s: [], i: 0 }; states.set(here, fr); }
    fr.i = 0;
    const prev = frame;
    frame = fr;
    let out;
    try {
      if (type.prototype && typeof type.prototype.render === "function") {
        const inst = new type(props);
        if (type.getDerivedStateFromProps) Object.assign(inst.state, type.getDerivedStateFromProps(props, inst.state));
        out = inst.render();
      } else out = type(props);
    } finally { frame = prev; }
    if (CAPTURE.has(name)) return { tag: "$c", name, props, kids: render(out, here) };
    return render(out, here);
  }
  /* render a component as the root of a fresh tree; the handle re-renders it
     after a click, its components keeping their state */
  function mount(name, props = {}, { path: p = "/" } = {}) {
    const type = typeof name === "function" ? name : vm.runInContext(name, ctx);
    if (typeof type !== "function") throw new Error("harvest: no component " + name);
    win.location.pathname = p;
    states.clear();
    React._ids = 0;
    const el0 = React.createElement(type, props);
    const h = { tree: null, rerender() { h.tree = render(el0, "#"); return h; } };
    h.rerender();
    mounted = h;
    return h;
  }
  return { win, ctx, AP: win.AP, D: win.AP.D, mount, get mounted() { return mounted; } };
}

/* ---------------------------------------------------------------- reading a tree */
export const clsOf = (t) => (t && typeof t === "object" && !Array.isArray(t) && t.props && typeof t.props.className === "string" ? t.props.className : "");
export const hasCls = (t, c) => (" " + clsOf(t).trim().replace(/\s+/g, " ") + " ").includes(" " + c + " ");
export function findAll(t, pred, out = []) {
  if (!t || typeof t === "string") return out;
  if (Array.isArray(t)) { for (const x of t) findAll(x, pred, out); return out; }
  if (pred(t)) out.push(t);
  if (t.tag !== "$chart") findAll(t.kids, pred, out);
  return out;
}
export const find = (t, pred) => findAll(t, pred)[0] || null;
// `sel`: ".a.b" (every class), "tag", "tag.a" – one element, no combinators
export const match = (sel) => {
  const m = /^([a-z0-9$]+)?((?:\.[\w-]+)*)$/i.exec(sel);
  const tag = m[1] || null, cls = m[2] ? m[2].slice(1).split(".") : [];
  return (t) => (!tag || t.tag === tag) && cls.every((c) => hasCls(t, c));
};
export const q = (t, sel) => find(t, match(sel));
export const qa = (t, sel) => findAll(t, match(sel));
const hidden = (t) => t.props["aria-hidden"] === true || t.props["aria-hidden"] === "true";
/* the words a reader sees: a rolling figure's real value (its sr-only twin,
   the reels being decoration), no svg, nothing aria-hidden */
export function txt(t) {
  if (t == null || t === false || t === true) return "";
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map(txt).join("");
  if (t.tag === "$chart" || t.tag === "svg" || t.tag === "script" || t.tag === "style" || t.tag === "select" || t.tag === "option") return "";
  if (hidden(t)) return "";
  if (hasCls(t, "roll")) { const sr = find(t.kids, (x) => hasCls(x, "sr-only")); return sr ? txt(sr.kids) : ""; }
  if (hasCls(t, "roll-reel") || hasCls(t, "plink-mark") || hasCls(t, "rd-qpop")) return "";
  if (t.props.dangerouslySetInnerHTML && t.props.dangerouslySetInnerHTML.__html) return String(t.props.dangerouslySetInnerHTML.__html).replace(/<[^>]+>/g, "");
  return txt(t.kids);
}
export const words = (t) => txt(t).replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\(\s+/g, "(").trim();
// the same words with the bold runs kept (a verdict's "Too close to call."), as [text, bold] parts
export function runs(t, bold = false, out = []) {
  if (t == null || t === false || t === true) return out;
  if (typeof t === "string") { out.push([t, bold]); return out; }
  if (Array.isArray(t)) { for (const x of t) runs(x, bold, out); return out; }
  if (t.tag === "$chart" || t.tag === "svg" || t.tag === "select" || hidden(t)) return out;
  if (hasCls(t, "roll") || hasCls(t, "roll-reel") || hasCls(t, "plink-mark") || hasCls(t, "rd-qpop")) { if (hasCls(t, "roll")) out.push([txt(t), bold]); return out; }
  return runs(t.kids, bold || t.tag === "b" || t.tag === "strong", out);
}
/* press a modern control: its onClick (or onChange with a value), then the
   tree re-renders with every component's state kept */
export function press(h, pred, value) {
  const t = find(h.tree, pred);
  if (!t) return false;
  const ev = { preventDefault() {}, stopPropagation() {}, persist() {}, key: "Enter", button: 0, detail: 1, clientX: 0, clientY: 0,
    currentTarget: { value, checked: value, dataset: {}, getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 20, right: 100, bottom: 20 }), closest: () => null, blur() {}, focus() {} },
    target: { value, checked: value, dataset: {}, closest: () => null, tagName: "BUTTON" } };
  const f = value !== undefined && t.props.onChange ? t.props.onChange : t.props.onClick || t.props.onChange || t.props.onPointerDown;
  if (!f) return false;
  f(ev);
  h.rerender();
  return true;
}
export const byText = (sel, text) => { const m = match(sel); return (t) => m(t) && words(t) === text; };

/* ---------------------------------------------------------------- a chart, as data */
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const fin = (v) => typeof v === "number" && isFinite(v);
/* everything the retro drawer needs from TrendChart's props, as plain
   numbers and words: the copy (title, sub, legend) is the modern chart's own
   copy-as-image caption. Compact, since a page carries every view's charts:
   an x is its place along the axis in thousandths (0 the domain's start,
   1000 its end: a pixel at most), a y keeps one decimal (as the page prints), a line's points and a
   band's run flat ([x, y, x, y…], [x, lo, hi…]), and the polls ride in one
   flat run per colour */
export function chartSpec(P, extra = {}) {
  const call = (f, v) => { try { return String(f(v)); } catch { return String(v); } };
  const [d0, d1] = Array.isArray(P.xDomain) && P.xDomain.length === 2 ? P.xDomain : [0, 1];
  const xi = (x) => Math.round(((x - d0) / (d1 - d0 || 1)) * 1000);
  const keepS = (P.series || []).filter((s) => s && s.points && s.points.length && s.opacity !== 0);
  const dots = new Map();
  for (const d of P.scatter || []) {
    if (!fin(d.x) || !fin(d.y)) continue;
    const k = (d.color || "var(--ink-faint)") + "|" + (d.hollow || (d.meta && d.meta.hollow) ? 1 : 0);
    if (!dots.has(k)) dots.set(k, []);
    dots.get(k).push(xi(d.x), r1(d.y));
  }
  return {
    title: P.copy && P.copy.title ? P.copy.title : null,
    legend: P.copy && Array.isArray(P.copy.legend) ? P.copy.legend.map((l) => ({ l: l.label, c: l.color || null, k: l.kind || "line" })) : [],
    y: (P.yDomain || []).map(r2),
    yt: (P.yTicks || []).map((v) => [v, P.yTickFmt ? call(P.yTickFmt, v) : String(v)]),
    xt: (P.xTicks || []).filter((t) => fin(t.x)).map((t) => [xi(t.x), String(t.label), t.strong ? 1 : 0]),
    series: keepS.map((s) => ({
      l: s.label || null, end: s.endLabel || null, c: s.color || "var(--ink)", w: s.rdWidth || s.width || 2,
      d: s.dashed || s.dash ? 1 : 0, o: s.opacity != null && s.opacity < 1 ? r2(s.opacity) : 1,
      p: s.points.filter((p) => fin(p.x) && fin(p.y)).flatMap((p) => [xi(p.x), r1(p.y)]),
    })).filter((s) => s.p.length),
    areas: (P.areas || []).filter((a) => a && a.points && a.points.length && a.opacity !== 0).map((a) => ({
      c: a.color || "var(--ink-faint)", o: a.opacity != null ? r2(a.opacity) : null, cls: a.className || "",
      p: a.points.filter((p) => fin(p.x) && fin(p.y0) && fin(p.y1)).flatMap((p) => [xi(p.x), r1(p.y0), r1(p.y1)]),
    })).filter((a) => a.p.length),
    dots: [...dots].map(([k, xy]) => { const [c, h] = k.split("|"); return [c, +h, xy]; }),
    marks: (P.marks || []).filter((m) => fin(m.x) && fin(m.y)).map((m) => [xi(m.x), r2(m.y), m.color || "var(--ink)", m.label || ""]),
    refs: (P.refLines || []).filter((r) => fin(r.y)).map((r) => [r2(r.y), r.label || ""]),
    /* a note's words, or its alternatives longest first (the modern chart
       fits the longest its span holds), and where that span ends */
    notes: (P.notes || []).filter((n) => n && n.text).map((n) => {
      const end = Array.isArray(n.span) && n.span[1] && fin(n.span[1].data) ? xi(n.span[1].data) : null;
      return [n.x === "left" || !fin(n.x) ? "left" : xi(n.x), fin(n.y) ? r2(n.y) : null, n.dy || 0, Array.isArray(n.text) ? n.text.map(String) : String(n.text), end];
    }),
    events: (P.events || []).filter((e) => fin(e.x)).map((e) => [xi(e.x), String(e.short || e.label || "")]),
    h: P.heightPx || 300,
    ...extra,
  };
}
