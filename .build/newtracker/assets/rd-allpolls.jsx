/* auspol tracker – the redesign's All polls tab (Sep 2026).

   AllPollsView keeps the archive's machinery - the filters and the counts
   beside each option, the address bar, the sort, the open row, the export -
   and in the redesign hands all of it to RdAllPolls, which draws the table
   the redesign's way: grouped by month, each poll set against the average of
   its month with its own sampling margin, under a headline that ties the
   table to today's figure. The three sections below it (RdDisagree,
   RdHouseLean, RdFlows) read the same engines the old panels do. */

/* ---------------------------------------------------------------- margins
   The two frozen flow tables the implied figures are read through, as the
   share of each party's voters that reaches Labor: the 2025 count against
   the Coalition, the site's first-principles set against One Nation (both
   gen-data's). A poll's 95% margin on its implied two-party figure comes
   from its own sample: each respondent carries their party's flow to Labor,
   so the variance is that of the flows over the primaries - about a fifth
   narrower than p(1 - p), since most voters' preferences are nearly certain.
   A published figure is each respondent's own call, so it keeps p(1 - p). */
const RD_AP_FLOWS = {
  lnp: { alp: 1, lnp: 0, grn: 0.8819, onp: 0.255, oth: 0.5455 },
  onp: { alp: 1, lnp: 0.315, grn: 0.89, onp: 0, oth: 0.53 },
};
const rdApDeff = () => {
  const L = window.AUSPOL.latest;
  return (L && L.method && L.method.deff) || 1.6;
};
function rdPollMargin(p, contest, pub) {
  const n = p.sampleEff || (p.sample ? p.sample / rdApDeff() : 0);
  if (!n) return null;
  if (pub) {
    const a = contest === "onp" ? (p.tppAlt ? p.tppAlt.alp : null) : p.alpN;
    return a == null ? null : 196 * Math.sqrt((a / 100) * (1 - a / 100) / n);
  }
  const q = p.p || {};
  if (["alp", "lnp", "grn", "onp"].some((k) => q[k] == null)) return null;
  const F = RD_AP_FLOWS[contest === "onp" ? "onp" : "lnp"];
  const ks = Object.keys(F);
  const tot = ks.reduce((s, k) => s + (q[k] || 0), 0);
  if (!tot) return null;
  let e1 = 0, e2 = 0;
  ks.forEach((k) => { const s = (q[k] || 0) / tot; e1 += s * F[k]; e2 += s * F[k] * F[k]; });
  return 196 * Math.sqrt(Math.max(0, e2 - e1 * e1) / n);
}

/* a published figure as the pollster printed it: 55, 54.5 */
const rdApNum = (v) => (v == null ? "—" : String(+(+v).toFixed(1)));
/* a change on the same pollster's previous poll */
function rdApChg(d, dec) {
  if (d == null) return null;
  if (Math.abs(d) < (dec ? 0.05 : 0.5)) return "no change";
  return (d > 0 ? "▲ " : "▼ ") + (dec ? Math.abs(d).toFixed(dec) : String(Math.abs(Math.round(d))));
}
/* the figure a row shows for the table's contest and basis, and the other
   basis's pair beneath it */
function rdApFig(p, onM, pub) {
  const imp = onM ? p.alpOnImp : p.alpImp;
  const pa = onM ? (p.tppAlt ? p.tppAlt.alp : null) : p.alp;
  const pb = onM ? (p.tppAlt ? p.tppAlt.onp : null) : p.lnp;
  const pubPair = pa != null && pb != null ? rdApNum(pa) + "–" + rdApNum(pb) : null;
  if (pub) {
    return { a: pa, b: pb, txtA: rdApNum(pa), txtB: rdApNum(pb),
             sub: imp != null ? "implied " + imp.toFixed(1) + "–" + (100 - imp).toFixed(1) : null,
             none: onM ? "no head-to-head published" : "no two-party figure published" };
  }
  const q = p.p || {};
  return { a: imp, b: imp != null ? 100 - imp : null,
           txtA: imp != null ? imp.toFixed(1) : "—", txtB: imp != null ? (100 - imp).toFixed(1) : "—",
           sub: pubPair ? "published " + pubPair : null,
           none: q.alp == null ? "no primaries published"
             : ["lnp", "grn", "onp"].every((k) => q[k] != null) ? "primaries don’t add to 100" : "not every primary published" };
}
const rdApLeanDot = (v, onM) => (v == null || Math.abs(v) < 0.05 ? "var(--ink-3)" : v > 0 ? "var(--alp)" : onM ? "var(--onp)" : "var(--lnp)");
const rdApLeanInk = (v, onM) => (v == null || Math.abs(v) < 0.05 ? "var(--ink-3)" : v > 0 ? "var(--alp-text)" : onM ? "var(--onp-text)" : "var(--lnp-text)");
const rdApSigned = (v) => (Math.abs(v) < 0.05 ? "0.0" : rdSigned(v, 1));
const rdApDays = (iso) => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
const RD_AP_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/* "Wed 23 Sep, 5 am" */
function rdApOut(stamp) {
  if (!stamp) return null;
  const D = window.AUSPOL;
  const t = new Date(rdApDays(stamp));
  let s = RD_AP_WEEKDAY[t.getUTCDay()] + " " + t.getUTCDate() + " " + D.monthName(t.getUTCMonth() + 1);
  const h = /T(\d\d):/.exec(stamp);
  if (h) { const hr = Number(h[1]); s += ", " + (hr % 12 || 12) + (hr < 12 ? " am" : " pm"); }
  return s;
}

/* the effective sample is still to come: the house's previous poll carried
   one and this came out in the last three weeks (older gaps are left unsaid).
   One rule for the header and the table's Sample column, so they agree. */
function rdEffTbc(p) {
  if (p.sampleEff != null || !p.published) return false;
  if (Date.now() - Date.parse(p.published.slice(0, 10)) >= 21 * 86400000) return false;
  const prev = window.AUSPOL.individualPolls.filter((q) => q.pollster === p.pollster && q.released < p.released)
    .sort((a, b) => (a.released < b.released ? -1 : 1)).pop();
  return !!(prev && prev.sampleEff != null);
}
/* "TBC" links to the house's APC methodology page, where the house keeps one —
   YouGov's sets out why the effective sample trails the release. */
function rdEffTbcNote(p) {
  const note = "The pollster publishes an effective sample, but not yet for this poll";
  const url = p.pollster === "YouGov" ? "https://yougov.com/about/methodology/australian-polling-council" : null;
  return <>eff. {url
    ? <a className="rd-tbc" href={url} target="_blank" rel="noopener noreferrer" title={note} onClick={(e) => e.stopPropagation()}>TBC</a>
    : <span title={note}>TBC</span>}</>;
}
/* A poll's header, one wording wherever a poll is opened (All polls, Latest
   and next polls): when it was in the field, how many were asked, and who
   published it when (a self-published poll names its pollster). "n = 1,500" rather than "1,500 voters", with the
   pollster's effective sample beside it where it prints one - and "eff. TBC"
   where it normally does but this wave's hasn't appeared yet (the house's
   previous poll carried one, and this came out in the last three weeks;
   older gaps are left unsaid, since some waves never get one). "Published by
   News24" rather than "for News24", which read as if the voters were. */
function rdPollHead(p) {
  const tbc = rdEffTbc(p);
  const n = p.sample != null
    ? <>n = {p.sample.toLocaleString()}{p.sampleEff != null ? " (eff. " + p.sampleEff.toLocaleString() + ")" : tbc ? <> ({rdEffTbcNote(p)})</> : ""}</>
    : "sample not published";
  const out = rdApOut(p.published);
  // a self-published poll is published by its pollster, and says so
  const by = "Published by " + (p.client && !/^self/i.test(p.client) ? p.client : p.pollster);
  const field = p.field || p.dateLabel;
  return <>This poll{field ? ", Fieldwork " + field : ""}, <span className="rd-nocaps">{n}</span>{", " + by + (out ? ", " + out : "")}</>;
}

/* The primary columns in the order every table on the site keeps. */
const RD_AP_PRIM = [
  { id: "alp", lab: "ALP", ink: "var(--alp-text)", dot: "var(--alp)" },
  { id: "lnp", lab: "L/NP", ink: "var(--lnp-text)", dot: "var(--lnp)" },
  { id: "grn", lab: "GRN", ink: "var(--grn-text)", dot: "var(--grn)" },
  { id: "onp", lab: "ON", ink: "var(--onp-text)", dot: "var(--onp)" },
  { id: "oth", lab: "OTH", ink: "var(--ink-2)", dot: "var(--oth)" },
];
/* The Includes filter in the redesign's words. The rare contests the old
   Contest control carried (Coalition v One Nation, three-cornered) are here
   now, as what a poll published. */
const RD_AP_TAGS = {
  "2pp": { label: "A two-party figure", note: "One head-to-head, usually Labor v Coalition" },
  "2x2pp": { label: "Two two-party figures", note: "Labor v Coalition and Labor v One Nation" },
  "3x2pp": { label: "All three head-to-heads", note: "Including Coalition v One Nation" },
  "3pp": { label: "A three-cornered figure", note: "Labor, Coalition and One Nation in one split" },
  ppm: { label: "Better prime minister" },
  aprv: { label: "Leader approval" },
  fav: { label: "Leader favourability" },
  seats: { label: "A seat projection", note: "MRP polls only" },
  dir: { label: "Right direction or wrong track" },
};
const rdApTagLab = (id) => (RD_AP_TAGS[id] ? RD_AP_TAGS[id].label : id);

/* the lean scale: six points either way of the month's average */
const RD_AP_M = 6;
const rdApX = (v) => ((Math.max(-RD_AP_M, Math.min(RD_AP_M, v)) + RD_AP_M) / (2 * RD_AP_M)) * 100;

/* ---------------------------------------------------------------- the lean picture
   One poll against the average of its month: the centre line is that
   average, the dot the poll's lean, the whisker its 95% margin from sampling
   alone. `tip` is the readout, drawn on hover by the row. */
function RdApStrip({ lean, moe, onM, tip, phone }) {
  const grid = phone ? [-3, 3] : [-4, -2, 2, 4];
  const lo = lean != null && moe != null ? lean - moe : null;
  const hi = lean != null && moe != null ? lean + moe : null;
  return (
    <span className="rd-ap-in">
      {grid.map((v) => <i key={v} className="rd-ap-gl" style={{ left: rdApX(v) + "%" }}></i>)}
      <i className="rd-ap-avg" style={{ left: "50%" }}></i>
      {lo != null && <i className="rd-ap-wh" style={{ left: rdApX(lo) + "%", width: rdApX(hi) - rdApX(lo) + "%" }}></i>}
      {lo != null && lo < -RD_AP_M && <i className="rd-ap-clip l"></i>}
      {hi != null && hi > RD_AP_M && <i className="rd-ap-clip r"></i>}
      {lean != null && <i className="rd-ap-dot" style={{ left: rdApX(lean) + "%", background: rdApLeanDot(lean, onM) }}></i>}
      {tip}
    </span>
  );
}
/* the scale's labels, over the column (or over the cards on a phone) */
function RdApScale({ onM, phone }) {
  const ticks = phone
    ? [[-6, "6"], [-3, "3"], [0, "Average"], [3, "3"], [6, "6 pts"]]
    : [[-6, "6 pts"], [-4, "4"], [-2, "2"], [0, "Average"], [2, "2"], [4, "4"], [6, "6 pts"]];
  return (
    <span className="rd-ap-scale" aria-hidden="true">
      <span className="rd-ap-in">
        <b className="rd-ap-scl" style={{ color: onM ? "var(--onp-text)" : "var(--lnp-text)" }}>◀ <span className="rd-ap-long">Leans to </span>{onM ? "One Nation" : (phone ? "Coalition" : <><span className="rd-ap-long">the </span>Coalition</>)}</b>
        <b className="rd-ap-scr" style={{ color: "var(--alp-text)" }}><span className="rd-ap-long">Leans to </span>Labor ▶</b>
        {ticks.map(([v, lab]) => (
          <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "") + (phone && v === -6 ? " start" : "") + (phone && v === 6 ? " end" : "")}
                style={{ left: rdApX(v) + "%" }}>{lab}</span>
        ))}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- a poll opened
   The poll in full on the left, with its changes on the same pollster's last
   poll; on the right, how it counts: its pollster's recent record against the
   average, its place against its month, the pollster's usual lean, and what
   it does to today's figure. */
function RdApMini({ p, onM, pub, avgBy }) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const valOf = (q) => (pub ? (onM ? (q.tppAlt ? q.tppAlt.alp : null) : q.alpN) : (onM ? q.alpOnImp : q.alpImp));
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const mine = D.individualPolls.filter((q) => q.pollster === p.pollster && valOf(q) != null
    && rdApDays(q.released) >= t0 && rdApDays(q.released) <= t1);
  const avg = ms.filter((ym) => avgBy[ym] != null).map((ym) => ({ ym, v: avgBy[ym], t: rdApDays(ym + "-15") }));
  const vals = mine.map(valOf).concat(avg.map((a) => a.v));
  /* the past dots behave as a Latest-and-next-polls release dot does: point
     at one (or put it into focus) and it shows the poll it sits on; a mouse
     click then opens it, a tap only shows it - a tap is the only way to read
     a dot on a touch screen, so it can't also be the trip. */
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  if (!vals.length || valOf(p) == null) return <div ref={box}></div>;
  let lo = Math.floor(Math.min(...vals) / 2) * 2, hi = Math.ceil(Math.max(...vals) / 2) * 2;
  if (hi - lo < 6) { const c = (hi + lo) / 2; lo = Math.floor((c - 3) / 2) * 2; hi = lo + 6; }
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (t) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const yt = [];
  for (let v = lo; v <= hi + 1e-9; v += 2) yt.push(v);
  const cx = X(rdApDays(p.released)), cy = Y(valOf(p));
  const labLeft = cx > W * 0.45;
  const rival = onM ? "One Nation" : "Coalition";
  const outLabel = (q) => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const show = (id, src) => setTip({ id, src });
  const hide = (id, src) => setTip((t) => (t && t.id === id && (!src || t.src === src) ? null : t));
  /* keyed or not (a pollster can file a day's wave twice in seven months),
     the dot still reads; only the keyed ones open */
  const dots = mine.filter((q) => q.released !== p.released).map((q, i) => {
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
    const dup = mine.some((z) => z !== q && z.pollster === q.pollster && z.released === q.released);
    const key = (!raw || dup) ? null : raw;
    return { q, key, id: key || "d" + i, cx: X(rdApDays(q.released)), cy: Y(valOf(q)), a: valOf(q) };
  });
  const dotTip = tip && (dots.find((d) => d.id === tip.id) || null);
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${p.pollster}’s polls since ${rdMonthYear(ms[0])} against the monthly average; this poll ${valOf(p).toFixed(1)}.`}>
        {yt.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === 50 ? "rd-apd-even" : "rd-apd-gl"}></path>)}
        {yt.map((v) => <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end">{v}</text>)}
        {avg.length > 1 && <path d={monotoneXY(avg.map((a) => [X(a.t), Y(a.v)]))} className="rd-apd-avgline"></path>}
        {avg.length > 0 && <text x={X(avg[0].t)} y={Y(avg[0].v) - 9} className="rd-apd-lab">Monthly average</text>}
        {dots.map((d) => {
          const { id, key } = d;
          const open = () => { if (key && window.AP.openPoll) { setTip(null); window.AP.openPoll(key, "twopp", "the poll you were reading"); } };
          return (
            <g key={id}>
              {tip && tip.id === id && <circle cx={d.cx} cy={d.cy} r="7.5" className="rd-apd-dothi"></circle>}
              <circle cx={d.cx} cy={d.cy} r="4" className="rd-apd-dot"></circle>
              <circle cx={d.cx} cy={d.cy} r="9" className={"rd-apd-hit" + (key ? " link" : "")}
                      tabIndex="0" role={key ? "button" : "img"}
                      aria-label={(pub ? "Published" : "Implied") + " Labor two-party " + d.a.toFixed(1)
                        + " against " + rival + ", " + p.pollster + "’s poll of " + outLabel(d.q)
                        + (key ? "; press Enter to open it" : "")}
                      onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
                      onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show(id, "mouse"); }}
                      onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide(id, "mouse"); }}
                      onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(id, "focus"); }}
                      onBlur={() => hide(id, "focus")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        const pt = ev.detail === 0 ? "key" : ptr.current;
                        ptr.current = null;
                        if (pt === "mouse" || pt === "key") { open(); return; }
                        if (tip && tip.id === id) setTip(null); else setTip({ id, src: "touch" });
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
                        ev.preventDefault();
                        open();
                      }}></circle>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="8" className="rd-apd-ring"></circle>
        <circle cx={cx} cy={cy} r="4.5" className="rd-apd-this"></circle>
        <text x={labLeft ? cx - 12 : cx + 12} y={cy - 12} className="rd-apd-thislab" textAnchor={labLeft ? "end" : "start"}>This poll {valOf(p).toFixed(1)}</text>
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
      {dotTip && (() => { const d = dotTip; return (
        <div ref={tipBox} className="tip rd-apd-tip" style={{ left: d.cx + "px" }} aria-hidden="true">
          <div className="tip-title">Fieldwork {d.q.field || d.q.released}</div>
          <div className="tip-sub">Labor {d.a.toFixed(1)} – {(100 - d.a).toFixed(1)} {rival}{pub ? ", as published" : ""}</div>
          {d.q.sample != null && <div className="tip-sub">n = {d.q.sample.toLocaleString()}{d.q.sampleEff != null ? " (eff. " + d.q.sampleEff.toLocaleString() + ")" : ""}</div>}
          {tip.src !== "touch" && (d.key
            ? <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this poll" : "Click to open this poll"}</div>
            : <div className="tip-hint">Released {outLabel(d.q)}</div>)}
        </div>
      ); })()}
    </div>
  );
}

function RdApDetail({ p, onM, pub, today, winN, avgBy, onBack, backLabel }) {
  const D = window.AUSPOL;
  const q = p.p || {};
  const c = (p.chg && p.chg.d) || {};
  const refIso = p.chg && p.chg.r ? (p.chg.r.pOnp || p.chg.r.pAlp || p.chg.r.impOn || p.chg.r.imp) : null;
  const prev = refIso ? D.individualPolls.find((x) => x.pollster === p.pollster && x.released === refIso) : null;
  const CK = { alp: "pAlp", lnp: "pLnp", grn: "pGrn", onp: "pOnp", oth: "pOth" };
  const prim = RD_AP_PRIM.filter((k) => q[k.id] != null).sort((a, b) => q[b.id] - q[a.id]);
  const pair = (a, b, bInk) => (
    <b className="rd-apd-pair"><span style={{ color: "var(--alp-text)" }}>{a}</span><span className="rd-ap-dash"> – </span><span style={{ color: bInk }}>{b}</span></b>
  );
  const chg = (d, dec) => { const s = rdApChg(d, dec); return s ? <span className="rd-apd-chg">{s}</span> : null; };
  const none = <span className="rd-apd-none">—</span>;
  const ta = p.tppAlt;
  const cols = [
    { id: "onp", head: "v One Nation",
      imp: p.alpOnImp != null ? <>{pair(p.alpOnImp.toFixed(1), (100 - p.alpOnImp).toFixed(1), "var(--onp-text)")} {chg(c.impOn, 1)}</> : none,
      pub: ta ? <>{pair(rdApNum(ta.alp), rdApNum(ta.onp), "var(--onp-text)")} {chg(c.altAlpOn, 0)}</> : none },
    { id: "lnp", head: "v Coalition",
      imp: p.alpImp != null ? <>{pair(p.alpImp.toFixed(1), (100 - p.alpImp).toFixed(1), "var(--lnp-text)")} {chg(c.imp, 1)}</> : none,
      pub: p.alp != null && p.lnp != null ? <>{pair(rdApNum(p.alp), rdApNum(p.lnp), "var(--lnp-text)")} {chg(c.alp2pp, 0)}</> : none },
  ];
  if (!onM) cols.reverse();
  /* better PM: Hanson's contest beside One Nation, the opposition leader's
     beside the Coalition; a three-way contest takes the Coalition's cell */
  const sets = window.ppmContests ? window.ppmContests(p) : (p.ppmSets || []);
  const NAME = { alb: "Albanese", taylor: "Taylor", ley: "Ley", hanson: "Hanson" };
  const INK = { alb: "var(--alp-text)", taylor: "var(--lnp-text)", ley: "var(--lnp-text)", hanson: "var(--onp-text)" };
  const ppmCell = (s, three) => (
    <span className="rd-apd-cell">
      <span>{["alb", "taylor", "ley", "hanson"].filter((k) => s[k] != null).map((k, i) => (
        <React.Fragment key={k}>{i > 0 ? ", " : ""}{NAME[k]} <b style={{ color: INK[k] }}>{s[k]}</b></React.Fragment>
      ))}</span>
      <span className="rd-apd-sub">{three ? "three-way" + (s.unc != null ? ", " + s.unc + " undecided" : "") : s.unc != null ? s.unc + " undecided" : ""}</span>
    </span>
  );
  const setHan = sets.find((s) => s.hanson != null && s.taylor == null && s.ley == null);
  const setOpp = sets.find((s) => (s.taylor != null || s.ley != null) && s.hanson == null);
  const setThree = sets.find((s) => s.hanson != null && (s.taylor != null || s.ley != null));
  const ppmBy = { onp: setHan ? ppmCell(setHan) : null, lnp: setOpp ? ppmCell(setOpp) : setThree ? ppmCell(setThree, true) : null };
  const a = p.appr || {};
  const mb = a.metricBy || {};
  const leaders = [["alb", "albNet", "Albanese"], ["taylor", "taylorNet", a.oppName || "Taylor"], ["hanson", "hansonNet", "Hanson"]]
    .filter(([, nk]) => a[nk] != null);
  const allFav = leaders.length > 0 && leaders.every(([id]) => mb[id] === "fav");
  const d = p.dir;
  const seats = p.seats && p.seats.p ? RD_AP_PRIM.filter((k) => p.seats.p[k.id]) : [];

  /* how it counts */
  const contest = onM ? "onp" : "lnp";
  const fig = rdApFig(p, onM, pub);
  const avg = avgBy[p.ym];
  const moe = rdPollMargin(p, contest, pub);
  const lean = p.lean;
  const HL = D.houseLean || {};
  const hlKey = pub ? (onM ? "onpub" : "tpp") : (onM ? "onimp" : "imp");
  const hs = (HL[hlKey] || {})[p.pollster];
  const hl = hs && hs.length ? hs[hs.length - 1].v : null;
  const effKey = pub ? (onM ? "onp" : "lnp") : (onM ? "onimp" : "imp");
  const eff = p.eff && p.eff[effKey];
  const move = (e) => rdApSigned(Math.round((e.hi - e.lo) * 10) / 10);
  const inside = lean == null || moe == null ? null
    : Math.abs(lean) < moe / 2 ? "well inside" : Math.abs(lean) <= moe ? "inside" : "outside";
  const yr = p.year != null ? p.year : Number(String(p.released).slice(0, 4));
  const report = "/feedback/?msg=" + encodeURIComponent(`${p.pollster}, ${p.field} ${yr} – `);
  const from = D.MONTHS[Math.max(0, D.MONTHS.indexOf(p.ym) - 6)];
  /* the release, and beside it the poll's APC methodology statement where the
     pollster published one. Where the release is itself the statement
     (DemosAU's reports), both links open the same file and the statement
     link's title says so. */
  const relUrl = p.releaseUrl || p.url;

  return (
    <div className="rd-apd">
      <div className="rd-apd-l poll-detail" data-pollster={p.pollster}>
        <span className="rd-apd-h">{rdPollHead(p)}</span>
        {prim.length > 0 && (
          <div className="rd-apd-prim">
            {prim.map((k) => (
              <span key={k.id}>
                <b style={{ color: k.ink }}>{k.lab}</b>
                <span className="rd-apd-big" style={{ color: k.ink }}>{rdApNum(q[k.id])}</span>
                <span className="rd-apd-sub">{rdApChg(c[CK[k.id]], 0) || " "}</span>
              </span>
            ))}
          </div>
        )}
        {prim.length > 0 && <span className="rd-apd-sub rd-apd-note">Primary vote, %.{prev ? " Changes are on " + p.pollster + "’s " + prev.field + " poll." : ""}</span>}
        <div className="rd-apd-grid">
          <span></span>{cols.map((k) => <span key={k.id} className="rd-apd-th">{k.head}</span>)}
          <span className="rd-apd-k">Implied, on 2025 flows</span>{cols.map((k) => <span key={k.id}>{k.imp}</span>)}
          <span className="rd-apd-k">As {p.pollster} published</span>{cols.map((k) => <span key={k.id}>{k.pub}</span>)}
          {(ppmBy.onp || ppmBy.lnp) && <>
            <span className="rd-apd-k">Better prime minister</span>
            {cols.map((k) => <span key={k.id}>{ppmBy[k.id] || none}</span>)}
          </>}
        </div>
        {leaders.length > 0 && (
          <div className="rd-apd-grid rd-apd-grid1">
            <span className="rd-apd-k">{allFav ? "Net favourability" : "Net approval"}</span>
            <span className="rd-apd-leaders">
              {leaders.map(([id, nk, name]) => {
                const L = a[id] || null;
                const fav = mb[id] === "fav";
                return (
                  <span key={id} className="rd-apd-cell">
                    <span>{name} <b style={{ color: INK[id] }}>{rdSigned(a[nk], 0)}</b> {chg(c[nk], 0)}</span>
                    {L && L.app != null ? <span className="rd-apd-sub">{L.app} {fav ? "favourable" : "approve"}, {L.dis} {fav ? "unfavourable" : "disapprove"}</span>
                      : fav && !allFav ? <span className="rd-apd-sub">favourability</span> : null}
                  </span>
                );
              })}
            </span>
          </div>
        )}
        {d && (
          <div className="rd-apd-grid rd-apd-grid1">
            <span className="rd-apd-k">The country is heading</span>
            <span className="rd-apd-cell"><span>In the right direction <b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b>, on the wrong track <b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b>, unsure {rdApNum(d.unsure)}</span></span>
          </div>
        )}
        {seats.length > 0 && (
          <div className="rd-apd-grid rd-apd-grid1">
            <span className="rd-apd-k">Seats, modelled</span>
            <span className="rd-apd-cell"><span>{seats.map((k, i) => <React.Fragment key={k.id}>{i > 0 ? ", " : ""}{k.lab} <b style={{ color: k.ink }}>{p.seats.p[k.id].est}</b></React.Fragment>)}</span></span>
          </div>
        )}
        <div className="rd-apd-links">
          {relUrl && <a className="rd-link rd-link-ext" href={relUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><span className="rd-link-t">Read the release</span> <span aria-hidden="true" className="rd-apd-ext">↗</span></a>}
          {p.methodUrl && <a className="rd-link rd-link-ext" href={p.methodUrl} target="_blank" rel="noopener noreferrer" title={"This poll’s Australian Polling Council methodology statement" + (p.methodUrl === relUrl ? ", part of the release" : "")} onClick={(e) => e.stopPropagation()}><span className="rd-link-t">APC methodology</span> <span aria-hidden="true" className="rd-apd-ext">↗</span></a>}
          <a className="rd-link" href={report} onClick={(e) => e.stopPropagation()}>Report an error</a>
          {onBack && <button type="button" className="rd-link" onClick={(e) => { e.stopPropagation(); onBack(); }}>Back to {backLabel || "the chart"}</button>}
        </div>
      </div>
      <div className="rd-apd-r">
        <span className="rd-apd-h">How it counts</span>
        {fig.a != null && (
          <>
            <span className="rd-apd-ct">{p.pollster}’s polls since {D.monthNameFull(Number(from.slice(5)))} against the average, Labor v {onM ? "One Nation" : "Coalition"}{pub ? " as published" : ""}</span>
            <RdApMini p={p} onM={onM} pub={pub} avgBy={avgBy} />
          </>
        )}
        <div className="rd-apd-facts">
          {lean != null && avg != null && <>
            <span className="rd-apd-k">Against {D.monthNameFull(Number(p.ym.slice(5)))}</span>
            <span>{Math.abs(lean) < 0.05
              ? <>Level with the month’s average of {avg.toFixed(1)}{moe != null ? ", inside its ±" + moe.toFixed(1) + " margin" : ""}</>
              : <><b style={{ color: rdApLeanInk(lean, onM) }}>{Math.abs(lean).toFixed(1)}</b> more {lean > 0 ? "Labor’s" : onM ? "One Nation’s" : "the Coalition’s"} way than the month’s average of {avg.toFixed(1)}{moe != null ? ", " + inside + " its ±" + moe.toFixed(1) + " margin" : ""}</>}</span>
          </>}
          {fig.a == null && <>
            <span className="rd-apd-k">Two-party</span>
            <span>{fig.none[0].toUpperCase() + fig.none.slice(1)}, so this poll has no {pub ? "published" : "implied"} figure to set against the average.</span>
          </>}
          <span className="rd-apd-k">{p.pollster}’s usual lean</span>
          <span>{hl == null ? "Not measured yet: too few polls on this contest"
            : Math.abs(hl) < 0.05 ? "None to speak of: it sits level with the other pollsters"
            : <><b>{Math.abs(hl).toFixed(1)}</b> to {hl > 0 ? "Labor" : onM ? "One Nation" : "the Coalition"}, taken out before the polls are averaged</>}</span>
          {today && <>
            <span className="rd-apd-k">In today’s {today.a.toFixed(1)}</span>
            <span>{eff && eff.w
              ? <>One of the {rdNumWord(winN)} polls it’s built from; this one moves it <b>{move(eff)}</b></>
              : eff && eff.t
                ? <>Not one of them: today’s figure uses the last three weeks of polls. When it came out, it moved the figure <b>{move(eff.t)}</b></>
                : <>Not one of them: today’s figure uses the last three weeks of polls</>}</span>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the phone's filters
   "Filters" on the pinned bar opens the pollster, time and includes lists as a
   sheet from the bottom of the screen, with the count of what's left on its
   button. */
function RdApSheet({ onClose, houses, houseRank, houseN, sel, toggleHouse, range, setRange,
                     shownTags, tagSel, toggleTag, tagN, count, clearAll }) {
  const [allHouses, setAllHouses] = useState(false);
  React.useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, []);
  const list = allHouses ? houseRank : houseRank.slice(0, 6);
  return (
    <div className="rd-ap-sheetwrap" onClick={onClose}>
      <div className="rd-ap-sheet" role="dialog" aria-modal="true" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
        <span className="rd-ap-grab" aria-hidden="true"></span>
        <div className="rd-ap-sheethead"><b>Filters</b><span className="rd-grow"></span><button type="button" className="rd-link" onClick={clearAll}>Clear all</button></div>
        <div className="rd-ap-sheetbody">
          <span className="rd-ap-sheetk">Pollster</span>
          <div role="group" aria-label="Pollsters">
            {list.map((h) => <PopRow key={h} on={sel.has(h)} label={h} n={houseN[h] || 0} onClick={() => toggleHouse(h)} />)}
          </div>
          {!allHouses && houseRank.length > 6 && <button type="button" className="rd-link" onClick={() => setAllHouses(true)}>Show all {houses.length} pollsters</button>}
          <span className="rd-ap-sheetk">Time</span>
          <div className="rd-ap-sheetpills" role="radiogroup" aria-label="Time span">
            {[["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => (
              <button key={id} type="button" role="radio" aria-checked={range === id} className={"rd-ap-spill" + (range === id ? " on" : "")}
                      onClick={() => setRange(id)}>{lab}</button>
            ))}
          </div>
          <span className="rd-ap-sheetk">Includes</span>
          <div role="group" aria-label="What the poll published">
            {shownTags.map((t) => <PopRow key={t.id} on={tagSel.has(t.id)} label={rdApTagLab(t.id)} n={tagN[t.id] || 0} onClick={() => toggleTag(t.id)} />)}
          </div>
        </div>
        <button type="button" className="rd-ap-sheetgo" onClick={onClose}>Show {count} poll{count === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the table */
function RdAllPolls(P) {
  const { rows, sorted, total, houses, houseRank, houseN, tagN, shownTags, rangeN, RANGE_LAB,
          facet, onFacet, measure, onMeasure, tppBasis, setTppBasis,
          q, setQ, sel, setSel, toggleHouse, range, setRange, tagSel, setTagSel, toggleTag, pop, setPop,
          pills, clearAll, sort, onSort, open, setOpen, focus, onBack, backLabel, exportCsv, bodyRef,
          synthByYm, aggByYm, synthOnByYm, altOnByYm } = P;
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  /* the pinned bar's section links take their short names wherever the long
     ones would crowd the figures' tabs */
  const tight = useNarrow("(max-width: 1100px)");
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const contest = onM ? "onp" : "lnp";
  const rival = onM ? "One Nation" : "the Coalition";
  const rivalInk = onM ? "var(--onp-text)" : "var(--lnp-text)";
  const avgBy = pub ? (onM ? altOnByYm : aggByYm) : (onM ? synthOnByYm : synthByYm);
  const figOf = (p) => rdApFig(p, onM, pub);

  /* a published-only matchup from an old link has no place in the redesign's
     table: the rare contests live in Includes now */
  React.useEffect(() => { if (measure !== "lnp" && measure !== "onp") onMeasure("onp"); }, [measure]);

  /* ---- today's figure and the polls it's built from ----------------------- */
  const today = window.AP.tppLatest(onM ? "alp_on" : "alp_lnp", pub ? "resp" : "imp");
  const upd = rdApDays(D.latest.updatedISO);
  const winDays = (D.latest.method && D.latest.method.windowDays) || 21;
  const inToday = (p) => { const t = rdApDays(p.released); return t > upd - winDays * 864e5 && t <= upd && figOf(p).a != null; };
  const win = rows.filter(inToday);
  let head = null, dek = null;
  if (today && win.length) {
    const vals = win.map((p) => figOf(p).a);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const f = (v) => (pub ? rdApNum(v) : v.toFixed(1));
    const n = win.length;
    head = "Labor’s " + today.a.toFixed(1) + " comes from " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s")
      + (n === 1 ? "" : lo === hi ? ", which all put Labor on " + f(lo) : ", which range from " + f(lo) + " to " + f(hi));
    const ahead = vals.filter((v) => v > 50).length;
    const outN = win.filter((p) => { const m = rdPollMargin(p, contest, pub); return p.lean != null && m != null && Math.abs(p.lean) > m; }).length;
    const lead = n === 1 ? (ahead ? "It has" : "It doesn’t have")
      : ahead === n ? (n === 2 ? "Both have" : "All " + rdNumWord(n) + " have")
      : ahead === 0 ? "None of them has"
      : rdCap(rdNumWord(ahead)) + " of them " + (ahead === 1 ? "has" : "have");
    const tail = n === 1 ? (outN ? "it sits further from the average than its own margin of error. " : "it sits within its own margin of error of the average. ")
      : outN === 0 ? "none sits further from the average than its own margin of error. "
      : outN === 1 ? "one sits further from the average than its own margin of error. "
      : rdNumWord(outN) + " sit further from the average than their own margin of error. ";
    dek = lead + " Labor ahead of " + rival + ", and " + tail
      + "Below is every national poll since the 2025 election, newest first, each linked to its source.";
  }
  const todayTxt = today ? today.a.toFixed(1) : null;

  /* ---- paging, by whole months ---------------------------------------------- */
  const byDate = sort.key === "date" && sort.dir < 0;
  const [minShown, setMinShown] = useState(30);
  const [flatLimit, setFlatLimit] = useState(40);
  const [showAll, setShowAll] = useState(false);
  const fKey = [q, [...sel].join(","), range, [...tagSel].join(","), facet, sort.key, sort.dir, measure, tppBasis].join("|");
  React.useEffect(() => { setMinShown(30); setFlatLimit(40); setShowAll(false); }, [fKey]);
  const rowKey = (p) => p.pollster + "|" + p.released;
  const openRow = open ? sorted.find((p) => rowKey(p) === open) : null;
  let groups = null, flat = null, nShown = 0;
  if (byDate) {
    groups = [];
    for (const p of sorted) {
      const g = groups[groups.length - 1];
      if (!g || g.ym !== p.ym) {
        const needOpen = openRow && !groups.some((x) => x.ym === openRow.ym);
        if (!showAll && nShown >= minShown && !needOpen) break;
        groups.push({ ym: p.ym, list: [] });
      }
      groups[groups.length - 1].list.push(p);
      nShown++;
    }
  } else {
    const lim = showAll ? sorted.length : Math.max(flatLimit, openRow ? sorted.indexOf(openRow) + 1 : 0);
    flat = sorted.slice(0, lim);
    nShown = flat.length;
  }
  const more = nShown < sorted.length;

  /* ---- the pinned bar: the headings stay in view all the way down ---------- */
  const sentRef = useRef(null), headRef = useRef(null), searchRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [sheet, setSheet] = useState(false);
  React.useEffect(() => {
    let raf = 0;
    /* the headings pin under the site's own sticky bar, however tall that
       bar is at this width */
    const fit = () => {
      const bar = document.querySelector(".tabs.sticky");
      const sec = headRef.current && headRef.current.closest(".rd-ap");
      if (bar && sec) sec.style.setProperty("--rd-pin", Math.round(bar.getBoundingClientRect().height) + "px");
    };
    const check = () => {
      raf = 0;
      const s = sentRef.current, h = headRef.current;
      if (!s || !h) return;
      const pin = parseFloat(getComputedStyle(h).top) || 0;
      setPinned(s.getBoundingClientRect().top < pin - 1);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    const onResize = () => { fit(); on(); };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", onResize);
    fit();
    check();
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, [phone]);
  const jump = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const toSearch = () => {
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.focus({ preventScroll: true }), 350);
  };
  const nFilters = sel.size + tagSel.size + (range !== "all" ? 1 : 0) + (q.trim() ? 1 : 0);
  const shownPills = pills.filter((f) => !f.auto).map((f) => (f.k[0] === "t" && RD_AP_TAGS[f.k.slice(1)] ? { ...f, lab: rdApTagLab(f.k.slice(1)) } : f));

  /* ---- the rows ------------------------------------------------------------ */
  const [tip, setTip] = useState(null);
  const FACETS = [{ id: "twopp", label: "2PP" }, { id: "primary", label: "Primary" },
                  { id: "leadership", label: phone ? "Leaders" : "Leadership" }, { id: "direction", label: "Direction" }];
  const cls = { twopp: "rd-ap-c2pp", primary: "rd-ap-cprim", leadership: "rd-ap-clead", direction: "rd-ap-cdir" }[facet];
  const th = (label, k, o) => {
    const on = sort.key === k;
    const opt = o || {};
    return (
      <button type="button" role="columnheader" className={"rd-ap-th" + (on ? " on" : "") + (opt.right ? " r" : "") + (opt.wrap ? " wrap" : "")}
              aria-sort={on ? (sort.dir < 0 ? "descending" : "ascending") : "none"} onClick={() => onSort(k)}
              style={opt.color ? { color: opt.color } : null} title={opt.title}>
        {label}{"\u00a0"}<span aria-hidden="true" className="rd-ap-arr">{on ? (sort.dir < 0 ? "▾" : "▴") : "▾"}</span>
      </button>
    );
  };
  /* the leadership picture's domain, fixed across filters so a dot never moves
     under the reader */
  const LD = (() => {
    let lo = -40, hi = 20;
    rows.forEach((p) => { const a = p.appr || {}; ["albNet", "taylorNet", "hansonNet"].forEach((k) => { if (a[k] != null) { lo = Math.min(lo, a[k]); hi = Math.max(hi, a[k]); } }); });
    return { lo: Math.floor(lo / 10) * 10, hi: Math.ceil(hi / 10) * 10 };
  })();
  const ldx = (v) => ((v - LD.lo) / (LD.hi - LD.lo)) * 100;
  const ldTicks = [];
  for (let v = Math.ceil(LD.lo / 20) * 20; v <= LD.hi; v += 20) ldTicks.push(v);
  const PMAX = 45;
  const pdx = (v) => (Math.max(0, Math.min(PMAX, v)) / PMAX) * 100;

  const colHead = (
    <div className={"rd-ap-hrow " + cls} role="row">
      <span className="rd-ap-hc1">{th("Pollster", "pollster")}</span>
      {th("Fieldwork", "date", { title: "Sort by fieldwork, newest first" })}
      {th("Sample", "sample", { right: true })}
      <span></span>
      {facet === "twopp" && <>
        {th("Labor v " + (onM ? "One Nation" : "Coalition"), "alp", { title: "Sort by Labor’s share", wrap: true })}
        <span role="columnheader" aria-label="Poll lean against the average of its month" className="rd-ap-hpic"><RdApScale onM={onM} /></span>
        {th("Lean", "lean", { right: true, title: "Sort by poll lean, towards Labor first" })}
        <span></span>
      </>}
      {facet === "primary" && <>
        <span className="rd-ap-pnums rd-ap-hpn">{RD_AP_PRIM.map((k) => (k.id === "oth"
          ? <span key={k.id} className="rd-ap-th" style={{ color: k.ink }}>{k.lab}</span>
          : <React.Fragment key={k.id}>{th(k.lab, "p." + k.id, { color: k.ink })}</React.Fragment>))}</span>
        <span className="rd-ap-hpic" aria-hidden="true">
          <span className="rd-ap-cap">Primary vote, %</span>
          <span className="rd-ap-in">{[0, 10, 20, 30, 40].map((v) => <span key={v} className="rd-ap-tk" style={{ left: pdx(v) + "%" }}>{v}{v === 40 ? "%" : ""}</span>)}</span>
        </span>
        <span></span>
      </>}
      {facet === "leadership" && <>
        {th("Better PM", "ppm.alb")}
        <span className="rd-ap-hpic" aria-hidden="true">
          <span className="rd-ap-cap">Net rating: approve minus disapprove</span>
          <span className="rd-ap-in">{ldTicks.map((v) => <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "") + (v === LD.hi ? " end" : "")} style={{ left: ldx(v) + "%" }}>{v === 0 ? "Even" : rdSigned(v, 0)}</span>)}</span>
        </span>
        <span className="rd-ap-nets rd-ap-hnets">
          {th("Alb", "appr.albNet", { right: true, color: "var(--alp-text)" })}
          {th("Tay", "appr.taylorNet", { right: true, color: "var(--lnp-text)" })}
          {th("Han", "appr.hansonNet", { right: true, color: "var(--onp-text)" })}
        </span>
      </>}
      {facet === "direction" && <>
        {th("Right", "dir.right", { color: "var(--mood-pos)" })}
        {th("Wrong", "dir.wrong", { color: "var(--mood-neg)" })}
        <span className="rd-ap-th">Unsure</span>
        <span className="rd-ap-hpic"><span className="rd-ap-cap">Right direction or wrong track, %</span></span>
        {th("Net", "dir.net", { right: true })}
      </>}
      <span></span>
    </div>
  );

  const pollsterCell = (p) => (
    <span role="rowheader" className="rd-ap-who">
      <b>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{p.pollster}<span className="rd-ap-ext" aria-hidden="true">↗</span></a> : p.pollster}</b>
      <span className="rd-ap-sub">{p.client}</span>
    </span>
  );
  const fieldTxt = (p) => (byDate ? p.field : p.field + " ’" + String(p.year).slice(2));
  const fieldCell = (p) => (
    <span role="cell" className="rd-ap-when"><b>{fieldTxt(p)}</b>{p.published && <span className="rd-ap-sub">released {rdDate(p.published.slice(0, 10))}</span>}</span>
  );
  const sampleCell = (p) => (
    <span role="cell" className="rd-ap-n"><span>{p.sample != null ? p.sample.toLocaleString() : "—"}</span>{p.sampleEff != null ? <span className="rd-ap-sub">eff. {p.sampleEff.toLocaleString()}</span>
      : rdEffTbc(p) ? <span className="rd-ap-sub">{rdEffTbcNote(p)}</span> : null}</span>
  );
  const tipCard = (p, f, m) => {
    const lean = p.lean;
    const outside = m != null && Math.abs(lean) > m;
    const left = Math.max(22, Math.min(78, rdApX(lean)));
    return (
      <span className="tip rd-ap-tip" style={{ left: left + "%" }} role="tooltip">
        <span className="tip-title">{p.pollster}, {p.field}</span>
        <span className="tip-row"><span className="tip-label">Labor v {onM ? "One Nation" : "Coalition"}, {pub ? "published" : "implied"}</span><span className="tip-val">{f.txtA}</span></span>
        <span className="tip-row"><span className="tip-label">{D.monthNameFull(Number(p.ym.slice(5)))}’s average</span><span className="tip-val">{avgBy[p.ym] != null ? avgBy[p.ym].toFixed(1) : "—"}</span></span>
        <span className="tip-row"><span className="tip-label">Lean</span><span className="tip-val">{Math.abs(lean) < 0.05 ? "level" : rdSigned(lean, 1) + " to " + (lean > 0 ? "Labor" : onM ? "One Nation" : "Coalition")}</span></span>
        {m != null && <span className="tip-row"><span className="tip-label">95% margin</span><span className="tip-val">±{m.toFixed(1)}</span></span>}
        {outside && <span className="rd-ap-tipnote">Outside its margin, as about one poll in 20 should be</span>}
      </span>
    );
  };
  const rowFor = (p) => {
    const id = rowKey(p);
    const isOpen = open === id;
    const arrived = !!focus && focus.key === id;
    const toggle = () => setOpen(isOpen ? null : id);
    let figs, pic, val = <span></span>, right1 = null, right2 = null, body = null;
    if (facet === "twopp") {
      const f = figOf(p);
      const m = f.a != null ? rdPollMargin(p, contest, pub) : null;
      const main = f.a == null ? <span className="rd-ap-none">—</span>
        : <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{f.txtA}</span><span className="rd-ap-dash"> – </span><span style={{ color: rivalInk }}>{f.txtB}</span></b>;
      const sub = f.a == null ? f.none : f.sub;
      figs = <span role="cell" className="rd-ap-fig">{main}{sub && <span className="rd-ap-sub">{sub}</span>}</span>;
      const hovered = tip === id && p.lean != null && !phone;
      const aria = p.lean == null ? "No figure to set against its month"
        : (Math.abs(p.lean) < 0.05 ? "Level with the average of its month" : rdSigned(p.lean, 1) + " points against the average of its month, towards " + (p.lean > 0 ? "Labor" : rival))
          + (m != null ? "; 95% margin ±" + m.toFixed(1) : "");
      pic = (
        <span className="rd-ap-pic" role="img" aria-label={aria} onMouseEnter={() => setTip(id)} onMouseLeave={() => setTip(null)}>
          <RdApStrip lean={p.lean} moe={m} onM={onM} phone={phone} tip={hovered ? tipCard(p, f, m) : null} />
        </span>
      );
      val = <span role="cell" className="rd-ap-val" style={{ color: rdApLeanInk(p.lean, onM) }}>{p.lean == null ? "—" : rdApSigned(p.lean)}</span>;
      right1 = main;
      right2 = sub ? <span className="rd-ap-sub">{sub}</span> : null;
      body = <div className="rd-ap-cpic">{pic}<span className="rd-ap-cval" style={{ color: rdApLeanInk(p.lean, onM) }}>{p.lean == null ? "—" : rdApSigned(p.lean)}</span></div>;
    } else if (facet === "primary") {
      const pr = p.p || {};
      figs = <span role="cell" className="rd-ap-pnums">{RD_AP_PRIM.map((k) => <b key={k.id} style={{ color: k.ink }}>{pr[k.id] != null ? rdApNum(pr[k.id]) : "—"}</b>)}</span>;
      pic = (
        <span className="rd-ap-pic" role="img" aria-label={"Primary vote: " + RD_AP_PRIM.filter((k) => pr[k.id] != null).map((k) => k.lab + " " + rdApNum(pr[k.id])).join(", ")}>
          <span className="rd-ap-in">
            {[0, 10, 20, 30, 40].map((v) => <i key={v} className="rd-ap-gl" style={{ left: pdx(v) + "%" }}></i>)}
            {RD_AP_PRIM.filter((k) => pr[k.id] != null).sort((x, y) => pr[y.id] - pr[x.id]).map((k) => (
              <i key={k.id} className="rd-ap-dot" style={{ left: pdx(pr[k.id]) + "%", background: k.dot }}></i>
            ))}
          </span>
        </span>
      );
      body = <>
        <div className="rd-ap-cprim">{RD_AP_PRIM.map((k) => <span key={k.id}><em>{k.lab}</em><b style={{ color: k.ink }}>{pr[k.id] != null ? rdApNum(pr[k.id]) : "—"}</b></span>)}</div>
        <div className="rd-ap-cpic">{pic}</div>
      </>;
    } else if (facet === "leadership") {
      const sets = window.ppmContests(p);
      const opp = sets.find((s) => (s.taylor != null || s.ley != null) && s.hanson == null);
      const han = sets.find((s) => s.hanson != null && s.taylor == null && s.ley == null);
      const three = sets.find((s) => s.hanson != null && (s.taylor != null || s.ley != null));
      const oppV = (s) => (s.taylor != null ? s.taylor : s.ley);
      const oppN = (s) => (s.taylor != null ? "Taylor" : "Ley");
      const two = (x, y, yInk) => <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{x}</span><span className="rd-ap-dash"> – </span><span style={{ color: yInk }}>{y}</span></b>;
      let main, sub;
      if (opp) { main = two(opp.alb, oppV(opp), "var(--lnp-text)"); sub = han ? "v " + oppN(opp) + ", " + han.alb + "–" + han.hanson + " v Hanson" : "Albanese v " + oppN(opp); }
      else if (three) {
        main = <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{three.alb}</span><span className="rd-ap-dash"> – </span><span style={{ color: "var(--lnp-text)" }}>{oppV(three)}</span><span className="rd-ap-dash"> – </span><span style={{ color: "var(--onp-text)" }}>{three.hanson}</span></b>;
        sub = "three-way";
      } else if (han) { main = two(han.alb, han.hanson, "var(--onp-text)"); sub = "Albanese v Hanson"; }
      else { main = <span className="rd-ap-none">—</span>; sub = "not asked"; }
      figs = <span role="cell" className="rd-ap-fig">{main}<span className="rd-ap-sub">{sub}</span></span>;
      const a = p.appr || {};
      const mb = a.metricBy || {};
      pic = (
        <span className="rd-ap-pic" aria-hidden="true">
          <span className="rd-ap-in">
            {ldTicks.filter((v) => v !== 0).map((v) => <i key={v} className="rd-ap-gl" style={{ left: ldx(v) + "%" }}></i>)}
            <i className="rd-ap-avg" style={{ left: ldx(0) + "%" }}></i>
            {[["hansonNet", "var(--onp)"], ["taylorNet", "var(--lnp)"], ["albNet", "var(--alp)"]].filter(([k]) => a[k] != null).map(([k, col]) => (
              <i key={k} className="rd-ap-dot" style={{ left: ldx(a[k]) + "%", background: col }}></i>
            ))}
          </span>
        </span>
      );
      const fav = ["alb", "taylor", "hanson"].some((k) => mb[k] === "fav" && a[k + "Net"] != null);
      const nets = (
        <span className="rd-ap-nets">
          {[["albNet", "var(--alp-text)", "Alb"], ["taylorNet", "var(--lnp-text)", "Tay"], ["hansonNet", "var(--onp-text)", "Han"]].map(([k, col, lab]) => (
            <b key={k} style={{ color: col }}>{phone && <em>{lab}</em>}{a[k] != null ? rdSigned(a[k], 0) : "—"}</b>
          ))}
        </span>
      );
      val = <span role="cell" className="rd-ap-netcell">{nets}{fav && <span className="rd-ap-sub">favourability</span>}</span>;
      right1 = main;
      right2 = <span className="rd-ap-sub">{sub}</span>;
      body = <><div className="rd-ap-cpic">{pic}</div><div className="rd-ap-cnets"><span className="rd-ap-sub">Net rating{fav ? ", favourability" : ""}</span><span className="rd-grow"></span>{nets}</div></>;
    } else {
      const d = p.dir;
      const dc = (d && d.chg) || {};
      figs = d ? <>
        <span role="cell" className="rd-ap-dnum"><b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b>{rdApChg(dc.right, 0) && <span className="rd-ap-sub">{rdApChg(dc.right, 0)}</span>}</span>
        <span role="cell" className="rd-ap-dnum"><b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b>{rdApChg(dc.wrong, 0) && <span className="rd-ap-sub">{rdApChg(dc.wrong, 0)}</span>}</span>
        <span role="cell" className="rd-ap-dnum"><span>{rdApNum(d.unsure)}</span></span>
      </> : <><span role="cell" className="rd-ap-none">—</span><span></span><span></span></>;
      pic = d ? (
        <span className="rd-ap-pic" role="img" aria-label={`Right direction ${rdApNum(d.right)}%, unsure ${rdApNum(d.unsure)}%, wrong track ${rdApNum(d.wrong)}%`}>
          <span className="rd-ap-dbar">
            <i style={{ flexGrow: d.right, background: "var(--mood-pos)" }}></i>
            <i style={{ flexGrow: d.unsure }} className="u"></i>
            <i style={{ flexGrow: d.wrong, background: "var(--mood-neg)" }}></i>
          </span>
        </span>
      ) : <span className="rd-ap-pic"></span>;
      val = <span role="cell" className="rd-ap-val">{d ? rdSigned(d.net, 0) : "—"}</span>;
      right1 = d ? <b className="rd-ap-pairfig">Net {rdSigned(d.net, 0)}</b> : <span className="rd-ap-none">—</span>;
      body = d ? <><div className="rd-ap-cpic">{pic}</div>
        <div className="rd-ap-csub">Right <b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b>, wrong <b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b>, unsure {rdApNum(d.unsure)}</div></> : null;
    }
    const detail = isOpen && (
      <div className="rd-ap-open" role="row">
        <RdApDetail p={p} onM={onM} pub={pub} today={today} winN={win.length} avgBy={avgBy}
                    onBack={arrived ? onBack : null} backLabel={backLabel} />
      </div>
    );
    if (phone) {
      const sub = [p.client, fieldTxt(p), p.sample != null ? p.sample.toLocaleString() : null].filter(Boolean).join(", ");
      return (
        <React.Fragment key={id}>
          <div className={"rd-ap-card " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : "")} role="row" aria-expanded={isOpen} onClick={toggle}>
            <div className="rd-ap-c1">
              <span className="rd-ap-firm">{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{p.pollster}<span className="rd-ap-ext" aria-hidden="true">↗</span></a> : p.pollster}</span>
              <span className="rd-grow"></span>{right1}
            </div>
            <div className="rd-ap-c2"><span className="rd-ap-sub">{sub}</span><span className="rd-grow"></span>{right2}</div>
            {body}
          </div>
          {detail}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={id}>
        <div className={"rd-ap-row " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : "")} role="row" aria-expanded={isOpen} onClick={toggle}>
          {pollsterCell(p)}{fieldCell(p)}{sampleCell(p)}<span></span>
          {figs}{pic}{val}{facet === "twopp" && <span></span>}
          <button type="button" className={"rd-ap-chev" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                  aria-label={(isOpen ? "Hide" : "Show") + " the full poll: " + p.pollster + ", " + p.field}
                  onClick={(e) => { e.stopPropagation(); toggle(); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
        </div>
        {detail}
      </React.Fragment>
    );
  };
  const monthRow = (g) => {
    const [y, m] = g.ym.split("-").map(Number);
    const n = g.list.length;
    const lab = D.monthNameFull(m) + " " + y;
    const count = n + " poll" + (n === 1 ? "" : "s");
    if (facet === "twopp") {
      const k = g.list.filter(inToday).length;
      const note = count + (todayTxt && k ? (k === n ? ", all in today’s " + todayTxt : ", " + k + " in today’s " + todayTxt) : "");
      const avg = avgBy[g.ym];
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{note}</span></span>
          {avg != null && <span className="rd-ap-mavg">{phone ? "Avg " : "Average "}<b>{avg.toFixed(1)}{phone ? "" : " – " + (100 - avg).toFixed(1)}</b></span>}
        </div>
      );
    }
    if (facet === "primary") {
      const A = (D.aggPrimary || []).find((x) => x.ym === g.ym);
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{A && !phone ? "average, drawn as rings" : count}</span></span>
          {A && !phone && <span className="rd-ap-pnums rd-ap-mpn">{RD_AP_PRIM.map((k) => <span key={k.id}>{A[k.id] != null ? A[k.id].toFixed(1) : "—"}</span>)}</span>}
          {A && !phone && (
            <span className="rd-ap-pic rd-ap-mpic" aria-hidden="true"><span className="rd-ap-in">
              {RD_AP_PRIM.filter((k) => A[k.id] != null).map((k) => <i key={k.id} className="rd-ap-ring" style={{ left: pdx(A[k.id]) + "%", borderColor: k.dot }}></i>)}
            </span></span>
          )}
        </div>
      );
    }
    return (
      <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
        <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{count}</span></span>
      </div>
    );
  };
  /* the phone's pinned scale, above the cards */
  const phoneHead = (
    <div className={"rd-ap-phead " + cls}>
      {facet === "twopp" && <span className="rd-ap-hpic"><RdApScale onM={onM} phone /></span>}
      {facet === "primary" && <span className="rd-ap-hpic"><span className="rd-ap-cap">Primary vote, %</span><span className="rd-ap-in">{[0, 10, 20, 30, 40].map((v) => <span key={v} className="rd-ap-tk" style={{ left: pdx(v) + "%" }}>{v}{v === 40 ? "%" : ""}</span>)}</span></span>}
      {facet === "leadership" && <span className="rd-ap-hpic"><span className="rd-ap-cap">Net rating: approve minus disapprove</span><span className="rd-ap-in">{ldTicks.map((v) => <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "")} style={{ left: ldx(v) + "%" }}>{v === 0 ? "Even" : rdSigned(v, 0)}</span>)}</span></span>}
      {facet === "direction" && <span className="rd-ap-hpic rd-ap-hdir"><span className="rd-ap-cap"><span style={{ color: "var(--mood-pos)" }}>Right direction</span>, unsure, <span style={{ color: "var(--mood-neg)" }}>wrong track</span>, %</span></span>}
    </div>
  );
  const NAV = phone || tight
    ? [["rd-ap-top", "The polls"], ["poll-disagreement", "Disagreement"], ["house-lean", "Lean"], ["flow-drift", "Flows"]]
    : [["rd-ap-top", "The polls"], ["poll-disagreement", "How much they disagree"], ["house-lean", "How each pollster leans"], ["flow-drift", "Preference flows"]];
  const pinBar = (
    <div className={"rd-ap-pinbar" + (pinned ? " on" : "")} aria-hidden={!pinned}>
      <nav className="rd-ap-pinnav" aria-label="On this page">
        {NAV.map(([id, lab], i) => <button key={id} type="button" className={"rd-ap-pinl" + (i === 0 ? " on" : "")} tabIndex={pinned ? 0 : -1} onClick={() => jump(id)}>{lab}</button>)}
      </nav>
      {phone ? (
        <button type="button" className="rd-ap-pinf" tabIndex={pinned ? 0 : -1} onClick={() => setSheet(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>
          Filters{nFilters ? ", " + nFilters : ""}
        </button>
      ) : <>
        <span className="rd-ap-pintabs" role="group" aria-label="Figures">
          {FACETS.map((f) => <button key={f.id} type="button" className="rd-ap-pint" aria-pressed={facet === f.id} tabIndex={pinned ? 0 : -1} onClick={() => onFacet(f.id)}>{f.label}</button>)}
        </span>
        <span className="rd-ap-pinsep" aria-hidden="true"></span>
        <button type="button" className="rd-ap-pins" aria-label="Search the polls" tabIndex={pinned ? 0 : -1} onClick={toSearch}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
        </button>
        <span className="rd-ap-pinn"><b>{sorted.length}</b>{sorted.length !== total ? " of " + total : ""} polls</span>
      </>}
    </div>
  );
  const qpop = (
    <RdQPop label="How the two-party figures are counted, and the pollsters’ published figures" align="left">
      <p>{pub ? "Each poll’s two-party figure as its pollster published it, against the average of the published figures that month."
        : "Each poll’s primary votes read through the same preference flows, the 2025 election’s, so the polls compare like for like. The pollster’s own figure sits beneath."}</p>
      <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
        <RdSwitch on={pub} onToggle={() => setTppBasis(pub ? "imp" : "resp")} label="Show the pollsters’ published figures" /></div>
    </RdQPop>
  );
  const flip = (
    <button type="button" className="rd-pl-flip" title={"Switch the page to Labor v " + (onM ? "Coalition" : "One Nation")}
            onClick={() => onMeasure(onM ? "lnp" : "onp")}>Labor v {onM ? "One Nation" : "Coalition"} <span aria-hidden="true">⇄</span></button>
  );

  return (
    <section className="rd-sec rd-first rd-ap" id="rd-ap-top" aria-labelledby="rd-ap-t" data-facet={facet}>
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-ap-t">All polls</h2>
        <span className="rd-meta">Every national poll since the 2025 election, {total} from {houses.length} pollsters</span>
        {!phone && (
          <nav className="rd-eyebrow-tools rd-ap-nav" aria-label="On this page">
            <button type="button" onClick={() => jump("poll-disagreement")}>How much the polls disagree</button>
            <button type="button" onClick={() => jump("house-lean")}>How each pollster leans</button>
            <button type="button" onClick={() => jump("flow-drift")}>Preference flows</button>
          </nav>
        )}
      </div>
      {head && <RdHed head={head} dek={dek} level={2} />}

      <RdTabs swipe value={facet} onChange={onFacet} options={FACETS} ariaLabel="Figures" className="rd-ap-tabs">
        {facet === "twopp" && !phone && (
          <span className="rd-pl-ctl">
            <span className="rd-pl-ctl-l">Two-party:</span>{flip}
            <span className="rd-pl-ctl-l">, {pub ? "as published" : "implied flows"}</span>{qpop}
          </span>
        )}
      </RdTabs>
      {facet === "twopp" && phone && (
        <div className="rd-ap-pctl">{flip}<span className="rd-pl-ctl-l">, {pub ? "as published" : "implied flows"}</span><span className="rd-grow"></span>{qpop}</div>
      )}

      <div className="rd-ap-bar">
        <label className="rd-ap-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoCorrect="off" spellCheck={false}
                 placeholder="Search a pollster, a date or a figure" aria-label="Search the polls" />
          {q && <button type="button" className="rd-ap-x" onClick={() => setQ("")} aria-label="Clear search">×</button>}
        </label>
        <span className="rd-ap-pops">
          <FilterPop id="who" label="Pollster" open={pop} setOpen={setPop} summary={sel.size === 0 ? null : sel.size === 1 ? [...sel][0] : sel.size + " selected"}>
            <div className="ap-pop-head"><span>{houses.length} pollsters, tick any number</span>{sel.size > 0 && <button className="ap-clear" onClick={() => setSel(new Set())}>Clear</button>}</div>
            <div className="ap-poplist" role="group" aria-label="Pollsters">{houseRank.map((h) => <PopRow key={h} on={sel.has(h)} label={h} n={houseN[h] || 0} onClick={() => toggleHouse(h)} />)}</div>
          </FilterPop>
          <FilterPop id="when" label="Time" open={pop} setOpen={setPop} summary={range === "all" ? null : RANGE_LAB[range]}>
            <div className="ap-poplist" role="radiogroup" aria-label="Time span">
              {[["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => <PopRow key={id} radio on={range === id} label={lab} n={rangeN(id)} onClick={() => setRange(id)} />)}
            </div>
          </FilterPop>
          <FilterPop id="has" label="Includes" open={pop} setOpen={setPop} summary={tagSel.size === 0 ? null : tagSel.size === 1 ? rdApTagLab([...tagSel][0]) : tagSel.size + " measures"}>
            <div className="ap-pop-head"><span>What the poll published</span>{tagSel.size > 0 && <button className="ap-clear" onClick={() => setTagSel(new Set())}>Clear</button>}</div>
            <div className="ap-poplist" role="group" aria-label="What the poll published">
              {shownTags.map((t) => <PopRow key={t.id} on={tagSel.has(t.id)} label={rdApTagLab(t.id)} note={RD_AP_TAGS[t.id] && RD_AP_TAGS[t.id].note} n={tagN[t.id] || 0} onClick={() => toggleTag(t.id)} />)}
            </div>
            <p className="ap-pop-foot">Ticking two asks for polls that published both.</p>
          </FilterPop>
        </span>
        <span className="rd-grow"></span>
        <span className="rd-ap-count"><b>{sorted.length}</b>{sorted.length !== total ? " of " + total : ""} polls</span>
        <button type="button" className={phone ? "rd-link rd-ap-csv" : "rd-chip rd-ap-csv"} onClick={exportCsv} aria-label={"Download these " + sorted.length + " polls as a CSV file"}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg>
          Download CSV
        </button>
      </div>
      {shownPills.length > 0 && (
        <div className="rd-ap-active">
          <span className="rd-ap-activel">Showing</span>
          {shownPills.map((f) => <span key={f.k} className="rd-ap-pill">{f.lab}<button type="button" onClick={f.off} aria-label={"Remove filter: " + f.lab}>×</button></span>)}
          <button type="button" className="rd-link" onClick={clearAll}>Clear all</button>
        </div>
      )}

      <div className="rd-ap-table" role="table" aria-label={"Every national poll since the 2025 election, " + (byDate ? "newest first" : "sorted") + (sorted.length !== total ? ", " + sorted.length + " of " + total : "")} ref={bodyRef}>
        <span ref={sentRef} className="rd-ap-sent" aria-hidden="true"></span>
        <div ref={headRef} className={"rd-ap-headwrap" + (pinned ? " pinned" : "")}>
          {pinBar}
          {phone ? phoneHead : colHead}
        </div>
        {byDate ? groups.map((g) => <React.Fragment key={g.ym}>{monthRow(g)}{g.list.map(rowFor)}</React.Fragment>) : flat.map(rowFor)}
        {sorted.length === 0 && <div className="rd-ap-empty">No polls match these filters. <button type="button" className="rd-link" onClick={clearAll}>Clear filters</button></div>}
      </div>
      {more && (
        <div className="rd-ap-more">
          {byDate ? <button type="button" className="rd-chip" onClick={() => setMinShown((n) => n + 30)}>Show earlier months</button>
            : <button type="button" className="rd-chip" onClick={() => setFlatLimit((n) => n + 40)}>Show {Math.min(40, sorted.length - nShown)} more</button>}
          <button type="button" className="rd-link" onClick={() => setShowAll(true)}>Show all {sorted.length}</button>
          <span className="rd-grow"></span>
          <span className="rd-ap-shown">{nShown} of {sorted.length}{phone ? "" : " polls shown"}</span>
        </div>
      )}
      {facet === "twopp" && (
        <RdKey className="rd-ckey rd-ap-key" items={[
          { kind: "dot-solid", color: "var(--alp)", label: "Leans to Labor" },
          { kind: "dot-solid", color: onM ? "var(--onp)" : "var(--lnp)", label: "Leans to " + rival },
        ]}>
          <span className="rd-key-item"><span className="rd-ap-keywh" aria-hidden="true"><i></i></span>{phone ? "95% interval, from its sample" : "95% interval, from the poll’s own sample"}</span>
          <span className="rd-key-item"><span className="rd-ap-keyavg" aria-hidden="true"></span>{phone ? "Average of its month" : "Average of the poll’s month"}</span>
        </RdKey>
      )}
      {facet === "primary" && (
        <RdKey className="rd-ckey rd-ap-key" items={[{ kind: "dot-solid", color: "var(--ink-3)", label: "A poll’s figure, in its party’s colour" }]}>
          <span className="rd-key-item"><span className="rd-ap-keyring" aria-hidden="true"></span>The month’s average</span>
        </RdKey>
      )}
      <HowTo label="How to read this table" paras={[
        <>Dates are fieldwork; the day the poll came out sits beneath. A dash means the pollster didn’t publish that figure. Open any row for the poll in full, with what it does to today’s figure.</>,
        facet === "twopp" && <>{pub
          ? "Each figure is the pollster’s own, as published. The dot is its gap to the average of the published figures that month, and the whisker the 95% interval its sample alone would give it."
          : "Each figure reads the poll’s primary votes through the 2025 election’s preference flows, one table for every poll, so the polls compare like for like. The dot is its gap to that month’s average, and the whisker the 95% interval its sample alone would give it, worked out from its primaries and those flows."}
          {" "}About one poll in 20 should sit outside its interval by chance.</>,
        <><b>Sample</b> is the number of people polled; <b>eff.</b> is the pollster’s own effective sample after weighting, where it publishes one. Where it doesn’t, the interval assumes weighting costs what it does on average.</>,
      ]} />
      <div className="rd-foot">
        <span className="rd-foot-text">{facet === "twopp"
          ? (pub ? "Each poll’s own published figure, against the average of the published figures that month. A dash marks a figure the pollster didn’t publish."
            : (phone ? "Every poll is read through the 2025 election’s preference flows, so polls compare like for like; the pollster’s own figure sits beneath. Each interval is sampling error alone. A dash marks a figure the pollster didn’t publish."
              : "Every poll’s primary votes are read through the same preference flows, the 2025 election’s, so the polls compare like for like; the pollster’s own figure sits beneath where it published one. Those flows carry doubt of their own, but the same doubt for every poll, so each interval is sampling error alone. A dash marks a figure the pollster didn’t publish."))
          : "A dash marks a figure the pollster didn’t publish. Open any row for the poll in full."}</span>
        <span className="rd-grow"></span>
        <span className="rd-foot-links"><a className="rd-how" href="/feedback/">Report an error</a><RdHow term="poll-lean" from="All polls" /></span>
      </div>
      {sheet && phone && (
        <RdApSheet onClose={() => setSheet(false)} houses={houses} houseRank={houseRank} houseN={houseN} sel={sel}
                   toggleHouse={toggleHouse} range={range} setRange={setRange} shownTags={shownTags}
                   tagSel={tagSel} toggleTag={toggleTag} tagN={tagN} count={sorted.length} clearAll={clearAll} />
      )}
    </section>
  );
}

/* ================================================================ the analysis sections */

/* the months a section's charts run over, election to now */
function rdApMonths(from) {
  const D = window.AUSPOL;
  const i = Math.max(0, D.MONTHS.indexOf(from));
  return D.MONTHS.slice(i);
}
/* a tick every `step` months from the first, the first of each year
   carrying it ("Jun ’25 … Mar ’26"), and the last month closing the axis */
function rdApMonthTicks(ms, step) {
  const D = window.AUSPOL;
  const out = [];
  let yr = null;
  ms.forEach((ym, i) => {
    const last = i === ms.length - 1;
    if (i % step !== 0 && !(last && i % step >= step / 2)) return;
    const m = Number(ym.slice(5)), y = ym.slice(0, 4);
    out.push({ ym, lab: D.monthName(m) + (y !== yr ? " ’" + y.slice(2) : ""), a: i === 0 ? "start" : last ? "end" : "middle" });
    yr = y;
  });
  return out;
}

/* ---------------------------------------------------------------- how much the polls disagree */
const RD_DIS_PANELS = {
  primary: [
    { id: "p_onp", name: "One Nation", line: "var(--onp)", ink: "var(--onp-text)" },
    { id: "p_lnp", name: "Coalition", line: "var(--lnp)", ink: "var(--lnp-text)" },
    { id: "rd_right", name: "One Nation + Coalition", line: "var(--ink-2)", ink: "var(--ink)" },
    { id: "p_alp", name: "Labor", line: "var(--alp)", ink: "var(--alp-text)" },
    { id: "p_grn", name: "Greens", line: "var(--grn)", ink: "var(--grn-text)" },
  ],
  twopp: [
    { id: "rd_on_imp", name: "Labor v One Nation", line: "var(--onp)", ink: "var(--onp-text)" },
    { id: "tpp_alpon", name: "…as published", line: "var(--onp)", ink: "var(--onp-text)", dash: true },
    { id: "rd_lnp_imp", name: "Labor v Coalition", line: "var(--lnp)", ink: "var(--lnp-text)" },
    { id: "tpp_alp", name: "…as published", line: "var(--lnp)", ink: "var(--lnp-text)", dash: true },
  ],
};
const rdDisVerdict = (R) => (R == null ? "Too few polls" : R < 0.8 ? "Tighter than chance" : R < 1.2 ? "Within chance" : R < 1.6 ? "A little beyond chance" : "Well beyond chance");

function RdDisChart({ panel, pts, ms, yMax, first, W, H, phone, hover, setHover }) {
  const D = window.AUSPOL;
  const x0 = first ? (phone ? 20 : 24) : 4, x1 = W - 6, top = 10, bot = H - 26;
  const X = (ym) => x0 + (ms.indexOf(ym) / (ms.length - 1)) * (x1 - x0);
  const Y = (v) => bot - (Math.min(v, yMax) / yMax) * (bot - top);
  const have = pts.filter((d) => d.sigma != null && ms.includes(d.ym));
  if (!have.length) return <svg width={W} height={H}></svg>;
  /* monthly lines are monotone curves here as on the engine's charts */
  const floorXY = have.map((d) => [X(d.ym), Y(d.floor)]);
  const area = `M${X(have[0].ym)} ${bot} ` + monotoneXY(floorXY, "L") + ` L${X(have[have.length - 1].ym)} ${bot}Z`;
  const e = have[have.length - 1];
  const yt = [];
  for (let v = 1; v <= yMax; v++) yt.push(v);
  const ticks = [{ ym: ms[0], lab: D.monthName(Number(ms[0].slice(5))) + " ’" + ms[0].slice(2, 4), a: "start" }];
  const jan = ms.find((ym, i) => ym.slice(5) === "01" && i > 2 && i < ms.length - 3);
  if (jan) ticks.push({ ym: jan, lab: "Jan ’" + jan.slice(2, 4), a: "middle" });
  ticks.push({ ym: ms[ms.length - 1], lab: D.monthName(Number(ms[ms.length - 1].slice(5))), a: "end" });
  const hv = hover != null ? have.find((d) => d.ym === hover) : null;
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    let best = null;
    have.forEach((d) => { const dx = Math.abs(X(d.ym) - x); if (!best || dx < best.dx) best = { dx, ym: d.ym }; });
    setHover(best ? best.ym : null);
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" className="rd-dis-svg"
         aria-label={`${panel.name}: polls sit a typical ${e.sigma.toFixed(1)} points from their trend, against ${e.floor.toFixed(1)} from sampling error alone.`}
         onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {yt.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className="rd-dis-gl"></path>)}
      <path d={`M${x0} ${bot}H${x1}`} className="rd-dis-base"></path>
      {first && yt.concat([0]).map((v) => <text key={"t" + v} x={x0 - 5} y={Y(v) + 4} className="rd-dis-ax" textAnchor="end">{v}</text>)}
      <path d={area} className="rd-dis-floor"></path>
      <path d={monotoneXY(floorXY)} className="rd-dis-floorline"></path>
      <path d={monotoneXY(have.map((d) => [X(d.ym), Y(d.sigma)]))} className="rd-dis-line"
            style={{ stroke: panel.line, strokeDasharray: panel.dash ? "4 3" : null }}></path>
      <circle cx={X(e.ym)} cy={Y(e.sigma)} r="3.5" className="rd-dis-end" style={{ fill: panel.line }}></circle>
      {hv && <>
        <path d={`M${X(hv.ym)} ${top - 6}V${bot}`} className="rd-dis-guide"></path>
        <circle cx={X(hv.ym)} cy={Y(hv.sigma)} r="4" className="rd-dis-end" style={{ fill: panel.line }}></circle>
        <circle cx={X(hv.ym)} cy={Y(hv.floor)} r="3" className="rd-dis-fdot"></circle>
      </>}
      {ticks.map((t) => <text key={t.ym} x={X(t.ym)} y={bot + 18} className="rd-dis-ax" textAnchor={t.a}>{t.lab}</text>)}
    </svg>
  );
}

function RdDisagree() {
  const AP = window.AP;
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const [view, setView] = useState("primary");
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const Wall = useRdWidth(box, 1152);
  const panels = RD_DIS_PANELS[view];
  const ms = rdApMonths("2025-05");
  const lastOf = (id) => { const s = AP.discord(id).filter((d) => d.sigma != null); return s.length ? s[s.length - 1] : null; };
  let yMax = 3;
  panels.forEach((p) => AP.discord(p.id).forEach((d) => { if (d.sigma != null) yMax = Math.max(yMax, Math.ceil(d.sigma), Math.ceil(d.floor)); }));

  /* the finding, from the primaries whichever tab is open */
  const on = lastOf("p_onp"), co = lastOf("p_lnp"), right = lastOf("rd_right"), alp = lastOf("p_alp"), grn = lastOf("p_grn");
  const beyond = (d) => d && d.R >= 1.2;
  let head, dek;
  if (on && co && right && (beyond(on) || beyond(co)) && !beyond(right)) {
    const r = (on.R + co.R) / 2;
    const how = r < 1.3 ? "a little further than" : r < 1.75 ? "about half as much again as" : r < 2.25 ? "about twice as far as" : "more than twice as far as";
    head = "The polls disagree on how the right’s vote splits, not on its size";
    dek = `Polls of One Nation’s vote typically sit ${on.sigma.toFixed(1)} points from the trend through them, and polls of the Coalition’s ${co.sigma.toFixed(1)}: ${how} sampling error alone would put them. `
      + `Add the two parties together, though, and their combined vote varies only as much as chance allows${alp && !beyond(alp) ? ", as Labor’s does" : ""}.`;
  } else {
    const all = [["One Nation’s", on], ["the Coalition’s", co], ["Labor’s", alp], ["the Greens’", grn]].filter(([, d]) => d);
    const wide = all.filter(([, d]) => beyond(d));
    if (!wide.length) {
      head = "The polls agree about as closely as sampling error allows";
      dek = "Polls of every party’s vote sit about as far from the trend through them as their samples alone would put them"
        + (all.some(([, d]) => d.R < 0.8) ? ", and some sit closer than chance allows, which can mean pollsters steering towards each other." : ".");
    } else {
      head = "The polls disagree on " + rdList(wide.map(([n]) => n)) + " vote";
      dek = wide.map(([n, d]) => `Polls of ${n} vote typically sit ${d.sigma.toFixed(1)} points from the trend through them, against ${d.floor.toFixed(1)} from sampling error alone.`).join(" ");
    }
  }
  const cols = phone ? 2 : 5;
  const gap = phone ? 20 : 24;
  const pw = Math.max(120, Math.floor((Wall - gap * (cols - 1)) / cols));
  const H = phone ? 122 : 150;
  return (
    <section className="rd-sec rd-dis" id="poll-disagreement" aria-labelledby="rd-dis-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-dis-t">How much the polls disagree</h2>
        <span className="rd-meta">The spread between polls, against what sampling error alone would produce</span>
      </div>
      <RdHed head={head} dek={dek} />
      <RdTabs value={view} onChange={(v) => { setView(v); setHover(null); }} ariaLabel="Measure" className="rd-dis-tabs"
              options={[{ id: "primary", label: "Primary vote" }, { id: "twopp", label: "Two-party" }]} />
      <h4 className="rd-ap-ct rd-dis-ct">How far polls typically sit from {phone ? "their trend" : "the trend through them"}, points</h4>
      <div ref={box} className="rd-dis-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: gap }}>
        {panels.map((pn, i) => {
          const s = AP.discord(pn.id);
          const e = s.filter((d) => d.sigma != null).slice(-1)[0];
          const hv = hover && hover.id === pn.id ? s.find((d) => d.ym === hover.ym && d.sigma != null) : null;
          const first = phone ? i % 2 === 0 : i === 0;
          const x0 = first ? (phone ? 20 : 24) : 4;
          const hx = hv ? x0 + (ms.indexOf(hv.ym) / (ms.length - 1)) * (pw - 6 - x0) : 0;
          return (
            <div key={pn.id} className="rd-dis-panel">
              <span className="rd-dis-name" style={{ color: pn.ink }}>{pn.name}</span>
              {e ? <>
                <span className="rd-dis-big"><b>{e.sigma.toFixed(1)}</b><span>pts</span></span>
                <span className="rd-dis-sub">Chance alone {e.floor.toFixed(1)}, {e.R.toFixed(1)}×</span>
                <span className="rd-dis-verdict">{rdDisVerdict(e.R)}</span>
              </> : <span className="rd-dis-sub">Too few polls to measure</span>}
              <div className="rd-dis-chart">
                <RdDisChart panel={pn} pts={s} ms={ms} yMax={yMax} first={first} W={pw} H={H} phone={phone}
                            hover={hv ? hv.ym : null} setHover={(ym) => setHover(ym ? { id: pn.id, ym } : null)} />
                {hv && (
                  <span className="tip rd-dis-tip" style={{ left: Math.min(pw - 70, Math.max(70, hx)) }}>
                    <span className="tip-title">{rdMonthYear(hv.ym)}, {pn.name}</span>
                    <span className="tip-row"><span className="tip-label">Spread</span><span className="tip-val">{hv.sigma.toFixed(1)} pts</span></span>
                    <span className="tip-row"><span className="tip-label">Chance alone</span><span className="tip-val">{hv.floor.toFixed(1)} pts</span></span>
                    <span className="tip-row"><span className="tip-label">Ratio</span><span className="tip-val">{hv.R.toFixed(1)}×</span></span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {phone && (
          <div className="rd-dis-pkey">
            <span className="rd-key-item"><RdSwatch kind="line" color="var(--ink-2)" />Typical distance of a poll from the trend through the polls</span>
            <span className="rd-key-item"><span className="rd-dis-keyfloor" aria-hidden="true"></span>What sampling error alone would produce</span>
          </div>
        )}
      </div>
      {!phone && (
        <RdKey className="rd-ckey rd-dis-key" items={[{ kind: "line", color: "var(--ink-2)", label: "Typical distance of a poll from the trend through the polls" }]}>
          <span className="rd-key-item"><span className="rd-dis-keyfloor" aria-hidden="true"></span>What sampling error alone would produce</span>
        </RdKey>
      )}
      <p className="rd-dis-scale">Within chance: under 1.2 times sampling error, A little beyond: 1.2 to 1.6, Well beyond: 1.6 or more, Under 0.8, tighter than chance, would suggest pollsters were steering towards each other.</p>
      <HowTo label="How to read these charts" paras={[
        <>Each chart follows one figure month by month. The line is how far a typical poll sits from the trend through all the polls around it; the shaded floor is how far it would sit if the pollsters all measured the same thing and differed only by the luck of who they reached.</>,
        <>A line on the floor means the polls agree as well as their samples allow; a line well above it means they genuinely differ, in who they reach or how they weight. {view === "primary"
          ? "The One Nation and Coalition vote added together gets its own chart because that is the finding: the pollsters split the right’s vote differently while agreeing on its size."
          : "The implied figures read every poll through the same flows, so their spread is the pollsters disagreeing about primary votes; the published figures add each pollster’s own way of allocating preferences."}</>,
      ]} />
      <RdFoot how={{ term: "poll-disagreement", from: "How much the polls disagree" }}>
        Spread is how far each poll typically sits from the trend through the polls around it, with recent polls counting more; weighting by sample size would mute the small polls whose divergence is being measured. Sampling error is what each poll’s own sample predicts, with a design effect of {rdApDeff()}{view === "twopp" ? ", and for the implied figures from the spread of each respondent’s flow to Labor rather than a simple share" : ""}. Measured across all {D.individualPolls.length} polls; the table’s filters don’t narrow it.
      </RdFoot>
    </section>
  );
}

/* ---------------------------------------------------------------- how each pollster leans */
function RdHouseLean({ measure, tppBasis }) {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  /* the tablet's narrower bar column (rd.css) has room to label only the
     scale's ends and the others, as the phone does */
  const narrowBar = useNarrow("(max-width: 1000px)");
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const [view, setView] = useState("tpp");
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const SW = useRdWidth(boxRef, 500);
  const HL0 = D.houseLean || {};
  /* One Nation against the Coalition: each pollster's lean on the gap
     between the two primaries. The estimator is linear and all but one poll
     files both, so that lean is its One Nation lean less its Coalition lean;
     taken from the two series the tabs beside it draw, it always agrees
     with them to the decimal. */
  const HL = { ...HL0, split: Object.fromEntries(Object.keys(HL0.onp || {}).filter((h) => (HL0.lnp || {})[h]).map((h) => {
    const co = Object.fromEntries(HL0.lnp[h].map((d) => [d.ym, d.v]));
    return [h, HL0.onp[h].filter((d) => co[d.ym] != null)
      .map((d) => ({ ym: d.ym, v: Math.round((d.v - co[d.ym]) * 10) / 10, on: d.v, co: co[d.ym] }))];
  })) };
  const HE = D.houseEffects || {};
  const tppKey = pub ? (onM ? "onpub" : "tpp") : (onM ? "onimp" : "imp");
  const key = view === "tpp" ? tppKey : view;
  const heKey = { onimp: "synthOn", imp: "synth", onpub: "alp_on", tpp: "tpp" }[key];
  const valOf = { onimp: (p) => p.alpOnImp, imp: (p) => p.alpImp, onpub: (p) => (p.tppAlt ? p.tppAlt.alp : null), tpp: (p) => p.alpN,
                  alp: (p) => p.p && p.p.alp, lnp: (p) => p.p && p.p.lnp, onp: (p) => p.p && p.p.onp,
                  split: (p) => (p.p && p.p.onp != null && p.p.lnp != null ? p.p.onp - p.p.lnp : null) }[key];
  const nOf = (h) => {
    const he = heKey && HE[heKey] && HE[heKey][h];
    if (he && he.n) return he.n;
    return D.individualPolls.filter((p) => p.pollster === h && valOf(p) != null).length;
  };
  const rowsOf = (k) => Object.keys(HL[k] || {}).map((h) => {
    const s = HL[k][h] || [];
    return { h, s, v: s.length ? s[s.length - 1].v : 0 };
  }).filter((r) => r.s.length);
  const rows = rowsOf(key).map((r) => ({ ...r, n: nOf(r.h) })).sort((a, b) => b.v - a.v || b.n - a.n);
  /* the finding stays on the two-party lean, whichever tab is open */
  const tr = rowsOf(tppKey).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  /* where the pollsters part further on how the right's vote splits, the dek
     adds that, in the terms of whichever of the two parties leads */
  const sp = rowsOf("split").sort((a, b) => b.v - a.v);
  const LP = (D.latest && D.latest.primary) || {};
  let splitLine = "";
  if (tr.length && sp.length > 1 && LP.onp != null && LP.lnp != null && sp[0].v >= 0.5 && sp[sp.length - 1].v <= -0.5
      && Math.max(sp[0].v, -sp[sp.length - 1].v) >= Math.abs(tr[0].v) + 0.5) {
    const onLeads = LP.onp >= LP.lnp;
    const [a, b] = onLeads ? [sp[0], sp[sp.length - 1]] : [sp[sp.length - 1], sp[0]];
    splitLine = ` They part further on how the right’s vote splits: ${a.h} finds ${onLeads ? "One Nation’s lead over the Coalition" : "the Coalition’s lead over One Nation"} ${Math.abs(a.v).toFixed(1)} points wider than the others do, ${b.h} ${Math.abs(b.v).toFixed(1)} points narrower.`;
  }
  let head = null, dek = null;
  if (tr.length > 1) {
    const top = tr[0], rest = Math.max(...tr.slice(1).map((r) => Math.abs(r.v)));
    const way = top.v > 0 ? "Labor’s" : onM ? "One Nation’s" : "the Coalition’s";
    const pts = Math.abs(top.v).toFixed(1);
    head = Math.abs(top.v) < 0.05 ? "No pollster leans away from the pack"
      : `${top.h} leans furthest from the pack, and ${Math.abs(top.v) <= 1 ? "only " : ""}by ${pts} point${pts === "1.0" ? "" : "s"}`;
    dek = Math.abs(top.v) < 0.05 ? "Every pollster’s polls sit level with the pollsters polling alongside it." + splitLine
      : `Its polls run ${pts} point${pts === "1.0" ? "" : "s"} more ${way} way than the pollsters polling alongside it, and no other pollster is more than ${rest.toFixed(1)} points off.${splitLine} The averages take each lean out before the polls are combined.`;
  }
  /* the bar's scale: 1.2 points either way, wider only if a lean needs it */
  const maxAbs = Math.max(0, ...rows.map((r) => Math.abs(r.v)));
  const BM = maxAbs <= 1.1 ? 1.2 : Math.ceil((maxAbs + 0.1) * 2) / 2;
  /* ticks every half point, point or two points: at a finer step the labels
     beside the middle run into "The others" */
  const bStep = BM <= 1.5 ? 0.5 : BM <= 3 ? 1 : 2;
  const bTicks = [];
  for (let v = bStep; v < BM - 1e-9; v += bStep) bTicks.push(+v.toFixed(2));
  const bx = (v) => ((Math.max(-BM, Math.min(BM, v)) + BM) / (2 * BM)) * 100;
  /* each row's line: a point either way, more where the leans run wider */
  let SM = 1;
  rows.forEach((r) => r.s.forEach((d) => { SM = Math.max(SM, Math.ceil(Math.abs(d.v) - 0.05)); }));
  const ms = rdApMonths("2025-06");
  /* the two-ended measures: a lean is towards one side or the other */
  const split = view === "split";
  const two = view === "tpp" || split;
  const partyName = { alp: "Labor", lnp: "the Coalition", onp: "One Nation" }[view];
  const [posP, negP] = split ? ["onp", "lnp"] : ["alp", onM ? "onp" : "lnp"];
  const posName = split ? "One Nation" : "Labor", negName = split || !onM ? "the Coalition" : "One Nation";
  const pos = two ? `var(--${posP})` : "var(--" + view + ")";
  const neg = two ? `var(--${negP})` : "var(--" + view + ")";
  const posInk = two ? `var(--${posP}-text)` : "var(--" + view + "-text)";
  const negInk = two ? `var(--${negP}-text)` : "var(--" + view + "-text)";
  const lText = two ? (phone ? "◀ " : "◀ To ") + (phone ? negName.replace("the ", "") : negName) : "◀ Lower";
  const rText = two ? (phone ? "" : "To ") + posName + " ▶" : "Higher ▶";
  const SH = phone ? 26 : 44;
  const sx = (ym) => 6 + (ms.indexOf(ym) / (ms.length - 1)) * (SW - 14);
  const sy = (v) => SH / 2 - (Math.max(-SM, Math.min(SM, v)) / SM) * (SH / 2 - 3);
  /* a month tick every four months, as drawn, and further apart where a
     narrow column would run their labels together (about 56px each) */
  const tStep = Math.max(4, Math.ceil((56 * (ms.length - 1)) / Math.max(1, SW - 14)));
  const spark = (r) => {
    const pts = r.s.filter((d) => ms.includes(d.ym));
    if (!pts.length) return null;
    const line = monotoneXY(pts.map((d) => [sx(d.ym), sy(d.v)]), "");
    const e = pts[pts.length - 1];
    const hv = hover && hover.h === r.h ? pts.find((d) => d.ym === hover.ym) : null;
    const onMove = (ev) => {
      const rc = ev.currentTarget.getBoundingClientRect();
      const x = ev.clientX - rc.left;
      let best = null;
      pts.forEach((d) => { const dx = Math.abs(sx(d.ym) - x); if (!best || dx < best.dx) best = { dx, ym: d.ym }; });
      setHover(best ? { h: r.h, ym: best.ym } : null);
    };
    const nThat = hv ? D.individualPolls.filter((p) => p.pollster === r.h && p.ym === hv.ym && valOf(p) != null).length : 0;
    return (
      <span className="rd-hl-spark">
        <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
             aria-label={`Lean month by month since ${rdMonthYear(pts[0].ym)}, from ${rdApSigned(pts[0].v)} to ${rdApSigned(e.v)}`}>
          <path d={`M6 ${SH / 2}H${SW - 8}`} className="rd-hl-zero"></path>
          <path d={`M${sx(pts[0].ym).toFixed(1)} ${SH / 2}L${line}L${sx(e.ym).toFixed(1)} ${SH / 2}Z`} className="rd-hl-area"></path>
          <path d={"M" + line} className="rd-hl-line"></path>
          <circle cx={sx(e.ym)} cy={sy(e.v)} r="3.5" className="rd-hl-end" style={{ fill: Math.abs(e.v) < 0.05 ? "var(--ink-3)" : e.v > 0 ? pos : neg }}></circle>
          {hv && <><path d={`M${sx(hv.ym)} 0V${SH}`} className="rd-dis-guide"></path><circle cx={sx(hv.ym)} cy={sy(hv.v)} r="4" className="rd-hl-hv"></circle></>}
        </svg>
        {hv && (
          <span className="tip rd-hl-tip" style={{ left: Math.min(SW - 100, Math.max(100, sx(hv.ym))) }}>
            <span className="tip-title">{r.h}, {rdMonthYear(hv.ym)}</span>
            <span className="tip-row"><span className="tip-label">Lean</span><span className="tip-val">{Math.abs(hv.v) < 0.05 ? "level" : rdSigned(hv.v, 1) + (two ? " to " + (hv.v > 0 ? posName : negName).replace("the ", "") : "")}</span></span>
            {split && <span className="tip-row"><span className="tip-label">On One Nation</span><span className="tip-val">{rdApSigned(hv.on)}</span></span>}
            {split && <span className="tip-row"><span className="tip-label">On the Coalition</span><span className="tip-val">{rdApSigned(hv.co)}</span></span>}
            <span className="tip-row"><span className="tip-label">Its polls that month</span><span className="tip-val">{nThat}</span></span>
          </span>
        )}
      </span>
    );
  };
  const edge = bTicks.length ? bTicks[bTicks.length - 1] : null;
  const barHead = (
    <span className="rd-hl-bhead" aria-hidden="true">
      <span className="rd-ap-in">
        <b className="rd-ap-scl" style={{ color: negInk }}>{lText}</b><b className="rd-ap-scr" style={{ color: posInk }}>{rText}</b>
        {(narrowBar ? [-edge, 0, edge].filter((v) => v != null && !Number.isNaN(v)) : bTicks.map((v) => -v).concat([0]).concat(bTicks)).map((v) => (
          <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "")} style={{ left: bx(v) + "%" }}>
            {v === 0 ? (phone ? "Others" : "The others") : Math.abs(v) === edge ? Math.abs(v) + " pt" + (Math.abs(v) === 1 ? "" : "s") : String(Math.abs(v))}
          </span>
        ))}
      </span>
    </span>
  );
  const bar = (v) => (
    <span className="rd-hl-bar" role="img" aria-label={Math.abs(v) < 0.05 ? "Level with the other pollsters" : Math.abs(v).toFixed(1) + " points " + (two ? "towards " + (v > 0 ? posName : negName) : v > 0 ? "higher than the others" : "lower than the others")}>
      <span className="rd-ap-in">
        {bTicks.concat(bTicks.map((x) => -x)).map((x) => <i key={x} className="rd-ap-gl" style={{ left: bx(x) + "%" }}></i>)}
        {Math.abs(v) >= 0.05 && <i className="rd-hl-fill" style={{ left: Math.min(bx(0), bx(v)) + "%", width: Math.abs(bx(v) - bx(0)) + "%", background: v > 0 ? pos : neg }}></i>}
        <i className="rd-ap-avg" style={{ left: "50%" }}></i>
      </span>
    </span>
  );
  const title = split ? "Each pollster’s lean on One Nation’s primary vote against the Coalition’s, points"
    : two ? `Each pollster’s lean on Labor v ${onM ? "One Nation" : "Coalition"}${pub ? " as published" : ""}, points`
    : `Each pollster’s lean on ${partyName}’s primary vote, points`;
  /* the size half of the finding, in words: added together, a pollster's two
     leans on the right nearly cancel */
  const sizeMax = split ? Math.max(0, ...rows.map((r) => { const e = r.s[r.s.length - 1]; return Math.abs(e.on + e.co); })) : 0;
  return (
    <section className="rd-sec rd-hl" id="house-lean" aria-labelledby="rd-hl-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-hl-t">How each pollster leans</h2>
        <span className="rd-meta">Each pollster’s usual gap to the others polling at the same time{phone ? "" : ", which the averages take out"}</span>
      </div>
      {head && <RdHed head={head} dek={dek} />}
      <RdTabs value={view} onChange={(v) => { setView(v); setHover(null); }} ariaLabel="Measure" className="rd-hl-tabs"
              options={[{ id: "tpp", label: "Two-party" }, { id: "alp", label: "Labor" }, { id: "lnp", label: "Coalition" }, { id: "onp", label: "One Nation" },
                        { id: "split", label: phone ? "Split" : "One Nation v Coalition", title: "One Nation’s primary vote against the Coalition’s" }]} />
      <h4 className="rd-ap-ct rd-hl-ct">{phone ? title.replace(", points", ", points; the line beneath each is its lean month by month since the election") : title}</h4>
      <div className="rd-hl-table" role="table" aria-label="Each pollster’s lean against the others, now and month by month since the election">
        <div className="rd-hl-hrow" role="row">
          <span className="rd-ap-th" role="columnheader">Pollster</span>
          <span role="columnheader" className="rd-hl-hbar">{barHead}</span>
          <span className="rd-ap-th r" role="columnheader">Now</span>
          {!phone && <span></span>}
          {!phone && (
            <span className="rd-hl-shead" role="columnheader" ref={boxRef}>
              <span className="rd-ap-cap">Since the election <em><span className="rd-hl-sep">, </span>each row’s height is {SM === 1 ? "a point" : SM + " points"} either way</em></span>
              {rdApMonthTicks(ms, tStep).map((t) => <span key={t.ym} className={"rd-ap-tk " + t.a} style={{ left: sx(t.ym) }}>{t.lab}</span>)}
            </span>
          )}
        </div>
        {phone && <span ref={boxRef} className="rd-hl-measure" aria-hidden="true"></span>}
        {rows.map((r) => (
          <div key={r.h} className="rd-hl-row" role="row">
            <span role="rowheader" className="rd-hl-who"><b>{r.h}</b><span className="rd-ap-sub">{r.n} poll{r.n === 1 ? "" : "s"}</span></span>
            <span role="cell" className="rd-hl-bc">{bar(r.v)}</span>
            <span role="cell" className="rd-hl-now" style={{ color: Math.abs(r.v) < 0.05 ? "var(--ink-3)" : r.v > 0 ? posInk : negInk }}>{rdApSigned(r.v)}</span>
            {!phone && <span></span>}
            <span role="cell" className="rd-hl-sc">{spark(r)}</span>
          </div>
        ))}
      </div>
      <RdFoot how={{ term: "house-lean", from: "How each pollster leans" }}>
        A pollster’s lean is its average gap to the other pollsters polling within four weeks of it{view === "tpp" && !pub ? ", all read through the same preference flows" : ""}, with recent polls counting most. One with few polls is pulled towards zero until its record builds.{view === "tpp" && !pub ? " Because every poll uses the same flows, a lean comes from a pollster’s primary votes, not from how it allocates preferences." : ""}
        {split ? ` Here it is the pollster’s lean on One Nation’s vote less its lean on the Coalition’s${sizeMax < maxAbs / 2 ? `; added together, the two mostly cancel, and no pollster reads the parties’ combined vote more than ${sizeMax.toFixed(1)} points off the others` : ""}.` : null}
      </RdFoot>
    </section>
  );
}

/* ---------------------------------------------------------------- preference flows */
function RdFlowChart({ fd, rival, W, phone, pick, emptyNote }) {
  const D = window.AUSPOL;
  const [hv, setHv] = useState(null);
  const H = phone ? 210 : 250;
  const x0 = phone ? 26 : 40, rpad = phone ? 66 : 76, top = 14, bot = phone ? 178 : 214;
  const x1 = W - rpad;
  const ms = rdApMonths("2025-06");
  const X = (ym) => x0 + (ms.indexOf(ym) / (ms.length - 1)) * (x1 - x0);
  const zero = (top + bot) / 2;
  const Y = (v) => zero - (v / 3.5) * (zero - top);
  const mo = (fd.months || []).filter((d) => ms.includes(d.ym));
  if (!mo.length) return null;
  const band = monotoneXY(mo.map((d) => [X(d.ym), Y(Math.min(3.5, d.v + d.ci95))]))
    + " " + monotoneXY(mo.slice().reverse().map((d) => [X(d.ym), Y(Math.max(-3.5, d.v - d.ci95))]), "L") + " Z";
  const e = mo[mo.length - 1];
  const nw = fd.now || e;
  const nx = x1 + 22;
  const ticks = phone
    ? [["2025-06", "Jun ’25"], ["2026-01", "Jan ’26"], [ms[ms.length - 1], D.monthName(Number(ms[ms.length - 1].slice(5)))]]
    : rdApMonthTicks(ms, 3).map((t) => [t.ym, t.lab]);
  const houses = fd.houses || {};
  const pickS = pick && houses[pick] ? houses[pick].filter((d) => ms.includes(d.ym)) : null;
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    if (x > x1 + 8) { setHv(null); return; }
    let best = null;
    mo.forEach((d) => { const dx = Math.abs(X(d.ym) - x); if (!best || dx < best.dx) best = { dx, d }; });
    setHv(best ? best.d : null);
  };
  const s1 = (v) => (Math.abs(v) < 0.05 ? "0.0" : rdSigned(v, 1));
  return (
    <div className="rd-fl-chart">
      <svg width={W} height={H + 12} viewBox={`0 0 ${W} ${H + 12}`} role="img" onMouseMove={onMove} onMouseLeave={() => setHv(null)}
           aria-label={`Published minus implied two-party figure against ${rival}, pooled across pollsters by month: now ${s1(nw.v)} points, 95% interval ±${nw.ci95.toFixed(1)}.`}>
        {[-3, -2, -1, 1, 2, 3].map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className="rd-dis-gl"></path>)}
        <path d={`M${x0} ${zero}H${x1}`} className="rd-fl-zero"></path>
        {[-3, -2, -1, 0, 1, 2, 3].map((v) => <text key={"t" + v} x={x0 - 8} y={Y(v) + 4} className="rd-dis-ax" textAnchor="end">{v === 0 ? "0" : rdSigned(v, 0)}</text>)}
        <path d={band} className="rd-fl-band"></path>
        {Object.keys(houses).map((h) => houses[h].filter((d) => ms.includes(d.ym)).map((d, i) => (
          <circle key={h + i} cx={X(d.ym)} cy={Y(Math.max(-3.4, Math.min(3.4, d.v)))} r={pick === h ? 3.5 : 2.5}
                  className={"rd-fl-hdot" + (pick ? (pick === h ? " on" : " off") : "")}></circle>
        )))}
        {pickS && pickS.length > 1 && <path d={monotoneXY(pickS.map((d) => [X(d.ym), Y(Math.max(-3.4, Math.min(3.4, d.v)))]))} className="rd-fl-pick"></path>}
        <path d={monotoneXY(mo.map((d) => [X(d.ym), Y(d.v)]))} className="rd-fl-line"></path>
        <circle cx={X(e.ym)} cy={Y(e.v)} r="3" className="rd-fl-enddot"></circle>
        <path d={`M${nx} ${Y(Math.min(3.5, nw.v + nw.ci95))}V${Y(Math.max(-3.5, nw.v - nw.ci95))}`} className="rd-fl-nowwh"></path>
        <circle cx={nx} cy={Y(nw.v)} r="5" className="rd-fl-now"></circle>
        <text x={nx} y={top - 2} className="rd-fl-nowh" textAnchor="middle">Now</text>
        <text x={nx + 10} y={Y(nw.v) + 5} className="rd-fl-nowv">{s1(nw.v)}</text>
        <text x={nx + 10} y={Y(nw.v) + 20} className="rd-fl-nowci">±{nw.ci95.toFixed(1)}</text>
        <text x={x0 + 6} y={Y(3.5) + 13} className="rd-fl-note">▲ Published kinder to Labor</text>
        <text x={x0 + 6} y={Y(-3.5) - 6} className="rd-fl-note">▼ Kinder to {rival}</text>
        {emptyNote && X(mo[0].ym) - x0 > 110 && <text x={(x0 + X(mo[0].ym)) / 2} y={Y(1.4)} className="rd-fl-empty" textAnchor="middle">{emptyNote}</text>}
        <path d={`M${x0} ${bot}H${x1}` + ticks.map(([ym]) => `M${X(ym)} ${bot}v4`).join("")} className="rd-dis-base"></path>
        {ticks.map(([ym, lab]) => <text key={ym} x={X(ym)} y={bot + 20} className="rd-dis-ax" textAnchor="middle">{lab}</text>)}
        {hv && <path d={`M${X(hv.ym)} ${top}V${bot}`} className="rd-dis-guide"></path>}
        {hv && <circle cx={X(hv.ym)} cy={Y(hv.v)} r="4" className="rd-fl-enddot"></circle>}
      </svg>
      {hv && (
        <span className="tip rd-fl-tip" style={{ left: Math.min(W - 110, Math.max(110, X(hv.ym))) }}>
          <span className="tip-title">{rdMonthYear(hv.ym)}</span>
          <span className="tip-row"><span className="tip-label">All pollsters</span><span className="tip-val">{s1(hv.v)}</span></span>
          <span className="tip-row"><span className="tip-label">95% interval</span><span className="tip-val">±{hv.ci95.toFixed(1)}</span></span>
          {hv.k != null && <span className="tip-row"><span className="tip-label">Polls</span><span className="tip-val">{hv.k}</span></span>}
        </span>
      )}
    </div>
  );
}

function RdFlows() {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const FD = D.flowDrift, FO = D.flowDriftOn;
  const [pop, setPop] = useState(null);
  const [pick, setPick] = useState(null);
  const box = useRef(null);
  const Wall = useRdWidth(box, 1152);
  if (!FD || !FO || !FD.now || !FO.now) return null;
  const nC = FD.now, nO = FO.now;
  const s1 = (v) => Math.abs(v).toFixed(1);
  const phr = (v, who) => (Math.abs(v) < 0.05 ? "level against " + who
    : s1(v) + " points kinder to " + (v > 0 ? "Labor" : who) + " against " + who);
  const ci = Math.max(nC.ci95, nO.ci95);
  const worst = Math.max(Math.abs(nC.v), Math.abs(nO.v));
  const outC = Math.abs(nC.v) > nC.ci95, outO = Math.abs(nO.v) > nO.ci95;
  const head = !outC && !outO ? "Preferences are still flowing much as they did at the election"
    : outC && outO ? "Preferences have moved since the election, in both contests"
    : "Preferences " + (outO ? "against One Nation" : "against the Coalition") + " have moved " + ((outO ? nO.v : nC.v) > 0 ? "towards Labor" : "away from Labor") + " since the election";
  const dek = "The pollsters’ own two-party figures sit where their primary votes and the 2025 flows put them: "
    + phr(nC.v, "the Coalition") + ", and " + phr(nO.v, "One Nation") + ", "
    + (worst < ci / 2 ? "well inside" : worst <= ci ? "inside" : "outside") + " the margin of ±" + ci.toFixed(1)
    + ". A shift in where voters send their preferences would show here first.";
  const houses = [...new Set(Object.keys(FD.houses || {}).concat(Object.keys(FO.houses || {})))].sort();
  const cw = phone ? Wall : Math.floor((Wall - 48) / 2);
  return (
    <section className="rd-sec rd-fl" id="flow-drift" aria-labelledby="rd-fl-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-fl-t">Preference flows</h2>
        <span className="rd-meta">Whether preferences still flow the way they did at the 2025 election</span>
      </div>
      <RdHed head={head} dek={dek} />
      <div ref={box} className="rd-fl-two">
        <div className="rd-fl-one">
          <div className="rd-fl-ct">
            <h4 className="rd-ap-ct">Against the Coalition: published minus implied, points</h4>
            {!phone && <FilterPop id="flowpick" label="Highlight a pollster" open={pop} setOpen={setPop} summary={pick}>
              <div className="ap-poplist" role="radiogroup" aria-label="Pollster to highlight">
                <PopRow radio on={!pick} label="None" onClick={() => { setPick(null); setPop(null); }} />
                {houses.map((h) => <PopRow key={h} radio on={pick === h} label={h} onClick={() => { setPick(h); setPop(null); }} />)}
              </div>
            </FilterPop>}
          </div>
          <RdFlowChart fd={FD} rival="the Coalition" W={cw} phone={phone} pick={pick} />
        </div>
        <div className="rd-fl-one">
          <div className="rd-fl-ct"><h4 className="rd-ap-ct">{phone ? "Against One Nation" : "Against One Nation: published minus implied, points"}</h4></div>
          <RdFlowChart fd={FO} rival="One Nation" W={cw} phone={phone} pick={pick} emptyNote={phone ? "Nothing before Jan" : "No readings before January"} />
        </div>
      </div>
      <RdKey className="rd-ckey rd-fl-key" items={[{ kind: "line", color: "var(--ink)", label: "All pollsters, combined month by month" }, { kind: "band", color: "var(--ink-3)", label: "95% interval" }]}>
        <span className="rd-key-item"><span className="rd-fl-keydot" aria-hidden="true"></span>One pollster’s gap that month</span>
        <span className="rd-key-item"><span className="rd-fl-keynow" aria-hidden="true"><i></i></span>Now: the latest weeks pooled, with its 95% interval</span>
      </RdKey>
      <RdFoot how={{ term: "preference-flows", from: "Preference flows" }}>
        Each pollster is measured against its own habits: its polls in the six months after the election, or its first polls if it started later, so its usual way of allocating preferences counts as zero. No count of Labor v One Nation preferences exists, so that chart shows drift since each pollster’s first head-to-heads. This check corrects no other figure on the page.
      </RdFoot>
    </section>
  );
}

Object.assign(window, { RdAllPolls, RdApDetail, RdApSheet, rdPollMargin, RdDisagree, RdHouseLean, RdFlows });
