/* auspol tracker – the redesign's own pieces (Sep 2026).

   The redesign is the default design; the one it replaced stays a press away
   on the tagline's "last" (App owns the switch and sets window.AP.rd while it
   renders). The existing panels keep their data and their machinery - the
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
let rdPinRaf = 0;
let rdPinAnchorSave = null;
function rdPinScroll(row) {
  if (!row) return;
  const bar = document.querySelector(".tabs.sticky");
  /* the bar's box sits at its unstuck place whenever it isn't stuck (top of
     the page), so its live bottom is 200px+ there - reserve only what the
     bar takes up when it IS stuck (its height), else a row right under the
     viewport top reads as hidden behind it */
  const reserve = () => { const r = bar && bar.getBoundingClientRect(); return r ? Math.min(r.bottom, r.height) : 0; };
  const want0 = row.getBoundingClientRect();
  if (want0.bottom < reserve() || want0.top > window.innerHeight) return;
  cancelAnimationFrame(rdPinRaf);
  /* Chrome's scroll anchoring fights the pin when the click focused a
     control OUTSIDE the row (a party chip): the focused box becomes the
     anchor, the browser re-scrolls every frame to hold THAT still through
     the glide, and the two trade scrolls back and forth while the row
     rides off. Silence anchoring for the pin's window, then hand back. */
  const html = document.documentElement;
  if (rdPinAnchorSave === null) rdPinAnchorSave = html.style.overflowAnchor;
  html.style.overflowAnchor = "none";
  const done = () => {
    rdPinRaf = 0;
    if (rdPinAnchorSave !== null) { html.style.overflowAnchor = rdPinAnchorSave; rdPinAnchorSave = null; }
  };
  let want = want0.top, lastY = window.scrollY;
  const stop = performance.now() + (window.AP && window.AP.MORPH_MS || 320) + 240;
  const step = () => {
    if (!row.isConnected) { done(); return; }
    const y = window.scrollY;
    /* a wheel or trackpad tick mid-glide folds into the anchor and the pin
       follows it, but a jump of a screen or more (Home/End, a nav pill, a
       scrollIntoView) is the user leaving - hand back rather than drag the
       page to where the row was */
    const dy = y - lastY;
    if (Math.abs(dy) > window.innerHeight) { done(); return; }
    want += dy;
    lastY = y;
    const drift = row.getBoundingClientRect().top - want;
    if (drift) { window.scrollBy(0, drift); lastY = window.scrollY; }
    if (performance.now() < stop) rdPinRaf = requestAnimationFrame(step);
    else done();
  };
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
    const h = i.getBoundingClientRect().height;
    const prev = last.current;
    last.current = h;
    if (prev == null || Math.abs(prev - h) < 1) return;
    const AP = window.AP || {};
    if ((AP.reduceMotion && AP.reduceMotion()) || performance.now() - (window.__rdInput || 0) > 600) return;
    const cur = o.style.height ? o.getBoundingClientRect().height : prev;
    rdHoldSection(o, h - cur, (AP.MORPH_MS || 320) + 80);
    clearTimeout(timer.current);
    o.style.transition = "none";
    o.style.overflowY = "clip";
    o.style.height = cur + "px";
    void o.offsetHeight;
    o.style.transition = "height " + (AP.MORPH_MS || 320) + "ms " + (AP.MORPH_CSS || "ease");
    o.style.height = h + "px";
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
         it has got to, rather than snapping there when it finishes */
      if (o && o.style.height && Math.abs(h - (last.current || 0)) >= 1) {
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
  return (
    <div className={"rd-key" + (className ? " " + className : "")}>
      {items.filter(Boolean).map((it, i) => (
        <span key={i} className="rd-key-item"><RdSwatch kind={it.kind} color={it.color} />{it.label}</span>
      ))}
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
   the button's focus explicitly. */
function rdTabFocus(e) {
  const b = e.target && e.target.closest ? e.target.closest("button") : null;
  if (b) b.focus();
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
    btns[j].focus();
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
function RdTabs({ value, onChange, options, ariaLabel, children, className, swipe, onDigits }) {
  /* `swipe`: the views are pages of their own (All polls' figures, preferred
     PM's questions, who votes by age or by place…), so on a phone a sideways
     swipe on or just under the row steps through them, wrapping round the
     ends as the arrow-key walk does - the app's swipe handler finds the row
     by data-rd-swipe and calls its step. Views that only re-cut one figure
     (a time range, a filter) leave it off, and a swipe near them turns the
     page instead.
     `onDigits`: a row-wide number-key handler (rdDigitKey) hung on the outer
     div, so it hears a focused view tab or a focused row child alike. */
  const live = React.useRef(null);
  live.current = (dir) => {
    const i = options.findIndex((o) => o.id === value);
    if (i < 0 || options.length < 2) return false;
    onChange(options[(i + dir + options.length) % options.length].id);
    return true;
  };
  const mark = React.useCallback((el) => { if (el) el.__rdSwipe = (dir) => live.current(dir); }, []);
  return (
    <div className={"rd-tabs" + (className ? " " + className : "")}
         ref={swipe ? mark : undefined} data-rd-swipe={swipe ? "" : undefined}
         onKeyDown={onDigits || undefined}>
      <div role="group" aria-label={ariaLabel} style={{ display: "flex", gap: 4 }}
           onKeyDown={rdTabsKey(options, onChange)} onClick={rdTabFocus}>
        {options.map((o) => (
          <button key={o.id} type="button" className="rd-tab" aria-pressed={value === o.id}
                  onClick={() => onChange(o.id)} title={o.title}>
            {o.label}
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
   On a phone the event names do not fit over the plot, so each month with
   an event gets a number over its rule and the names are listed under the
   chart. Events in one month share a number. */
function rdEventBadges(events, x0, x1) {
  const inWin = (events || []).filter((e) => e.x >= x0 && e.x <= x1).sort((a, b) => a.x - b.x);
  const list = [];
  const out = inWin.map((e) => {
    const ym = e.date.slice(0, 7);
    let item = list.find((l) => l.ym === ym);
    if (!item) { item = { n: list.length + 1, ym, labels: [] }; list.push(item); }
    /* the short name reads better in a list, unless it is shorthand */
    item.labels.push(/→/.test(e.short || "") || !e.short ? e.label : e.short);
    return { ...e, badge: item.n, badgeLead: item.labels.length === 1 };
  });
  return { events: out, list };
}
function RdEventList({ list, inline, from, mix }) {
  if (!list || !list.length) return null;
  /* `inline` runs the list across the page, as the canvas set the one shared
     by a pair of half-width charts; a phone always stacks it */
  const ol = (l0, st, hidden) => (
    <ol className={"rd-evlist" + (inline ? " inline" : "")} style={st} aria-hidden={hidden || undefined}>
      {l0.map((l) => (
        <li key={l.n}><span className="rd-evlist-n">{l.n}</span>
          <span className="rd-evlist-l">{l.labels.join(", ")}</span>
          <span className="rd-evlist-d">{window.AUSPOL.monthName(Number(l.ym.slice(5))) + " " + l.ym.slice(0, 4)}</span></li>
      ))}
    </ol>
  );
  /* mid-switch (`from`, `mix`): the list being left fades out over the list
     arriving, both in one cell, so the names change with the chart's badges
     and the page below does not move on the switch's last frame */
  const same = from && from.length === list.length && from.every((l, i) => l.n === list[i].n && l.ym === list[i].ym && l.labels.join() === list[i].labels.join());
  if (!from || same || mix >= 1) return ol(list);
  return (
    <div className="rd-evstack">
      {ol(from, { opacity: 1 - mix }, true)}
      {ol(list, { opacity: mix })}
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

Object.assign(window, { RdSec, RdHed, RdSub, RdSwatch, RdKey, RdHow, RdFoot, RdTabs, RdGlide, RdCrossfade,
                        rdTabsKey, rdTabFocus, rdDigitKey,
                        rdNumWord, rdCap, rdFraction, rdSigned, rdArrow,
                        rdDate, rdMonthYear, rdPointsPhrase, rdXTicks, rdYTicks,
                        rdEventBadges, RdEventList, RdCheck, RdSwitch, RdTerm, RdQPop });
