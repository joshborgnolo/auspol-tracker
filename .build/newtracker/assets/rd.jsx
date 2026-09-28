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

function RdHed({ head, dek, level = 3 }) {
  const H = "h" + level;
  return (
    <>
      {head ? <H className="rd-hed">{head}</H> : null}
      {dek ? <p className="rd-dek">{dek}</p> : null}
    </>
  );
}

function RdSub({ head, dek, level = 4 }) {
  const H = "h" + level;
  return (
    <>
      {head ? <H className="rd-sub">{head}</H> : null}
      {dek ? <p className="rd-subdek">{dek}</p> : null}
    </>
  );
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
  return (
    <div className="rd-foot">
      {children ? <span className="rd-foot-text">{children}</span> : null}
      <span className="rd-grow"></span>
      {how ? <RdHow {...how} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- tabs
   The views inside a section: a row of words, the chosen one underlined. */
function RdTabs({ value, onChange, options, ariaLabel, children, className, swipe }) {
  /* `swipe`: the views are pages of their own (All polls' figures, preferred
     PM's questions, who votes by age or by place…), so on a phone a sideways
     swipe on or just under the row steps through them - the app's swipe
     handler finds the row by data-rd-swipe and calls its step. Views that
     only re-cut one figure (a time range, a filter) leave it off, and a
     swipe near them turns the page instead. */
  const live = React.useRef(null);
  live.current = (dir) => {
    const i = options.findIndex((o) => o.id === value);
    const next = options[i + dir];
    if (i < 0 || !next) return false;
    onChange(next.id);
    return true;
  };
  const mark = React.useCallback((el) => { if (el) el.__rdSwipe = (dir) => live.current(dir); }, []);
  return (
    <div className={"rd-tabs" + (className ? " " + className : "")}
         ref={swipe ? mark : undefined} data-rd-swipe={swipe ? "" : undefined}>
      <div role="group" aria-label={ariaLabel} style={{ display: "flex", gap: 4 }}>
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
  window.useDismissOutside(ref, open, () => setOpen(false));
  React.useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <span className="rd-qpop" ref={ref}>
      <button type="button" className="rd-qbtn" aria-label={label} aria-expanded={open}
              onClick={() => setOpen((o) => !o)}><span>?</span></button>
      {open && <div className={"rd-qpanel" + (align ? " " + align : "")} role="dialog" aria-label={label}>{children}</div>}
    </span>
  );
}

Object.assign(window, { RdSec, RdHed, RdSub, RdSwatch, RdKey, RdHow, RdFoot, RdTabs,
                        rdNumWord, rdCap, rdFraction, rdSigned, rdArrow,
                        rdDate, rdMonthYear, rdPointsPhrase, rdXTicks, rdYTicks,
                        rdEventBadges, RdEventList, RdCheck, RdSwitch, RdTerm, RdQPop });
