/* auspol tracker – the redesign's All polls tab (Sep 2026).

   AllPollsView keeps the archive's machinery - the filters and the counts
   beside each option, the address bar, the sort, the open row, the export -
   and in the redesign hands all of it to RdAllPolls, which draws the table
   the redesign's way: grouped by month, each poll set against the average of
   the other polls fielded around it, with its own sampling margin, under a headline that ties the
   table to today's figure. The three sections below it (RdDisagree,
   RdHouseLean, RdFlows) read the same engines the old panels do. */

/* ---------------------------------------------------------------- margins
   The two frozen flow tables the implied figures are read through, as the
   share of each party's voters that reaches Labor: the counted table
   against the Coalition, the site's first-principles set against One
   Nation - read from gen-data's flowTables, the numbers the estimator
   itself reads. A poll's 95% margin on its implied two-party figure comes
   from its own sample: each respondent carries their party's flow to Labor,
   so the variance is that of the flows over the primaries - about a fifth
   narrower than p(1 - p), since most voters' preferences are nearly certain.
   A published figure is each respondent's own call, so it keeps p(1 - p). */
const rdApFlows = (contest) => window.AUSPOL.flowTables[contest === "onp" ? "onp" : "lnp"];
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
  const F = rdApFlows(contest);
  const ks = Object.keys(F);
  const tot = ks.reduce((s, k) => s + (q[k] || 0), 0);
  if (!tot) return null;
  let e1 = 0, e2 = 0;
  ks.forEach((k) => { const s = (q[k] || 0) / tot; e1 += s * F[k]; e2 += s * F[k] * F[k]; });
  return 196 * Math.sqrt(Math.max(0, e2 - e1 * e1) / n);
}

/* what a poll's margin stands on, said beside it wherever it shows: the
   pollster's own effective sample (its APC statement), or, where it printed
   none for this poll, the raw sample over the design effect rdPollMargin
   assumes. Null when there is no sample at all (no margin either). */
function rdMarginBasis(p) {
  if (p.sampleEff != null) return "from its effective sample of " + p.sampleEff.toLocaleString();
  if (!p.sample) return null;
  const n = Math.round(p.sample / rdApDeff() / 10) * 10;
  return "assuming its " + p.sample.toLocaleString() + " respondents are worth about " + n.toLocaleString()
    + (rdEffTbc(p) ? ", until its effective sample is out" : ", as " + p.pollster + " published no effective sample for this poll");
}

/* a poll's effective-sample tag: false, "tbc" (statement still to come) or
   "missing" (21 days' grace is up and it never came). The reading against
   the APC code of conduct is the user's 2026-10-20 call: filing-house waves
   say "eff. missing" forever rather than going silent after three weeks. */

/* a published figure as the pollster printed it: 55, 54.5 */
const rdApNum = (v) => (v == null ? "—" : String(+(+v).toFixed(1)));
/* the same figure cast the Latest table's way (its primFig): a half prints
   as one ½ glyph absolutely positioned out of flow beside the integer, so
   every house's integers run straight down the column lattice; any other
   decimal keeps an in-flow ".x" suffix. Ink sizing is with the rd-pl-half
   rule's comment in rd.css. */
const rdApPrimFig = (v) => {
  if (v == null) return "—";
  const [i, f] = (+v).toFixed(1).split(".");
  if (f === "0") return i;
  if (f === "5") return <span className="rd-ap-halfwrap">{i}<b className="rd-ap-frac rd-ap-half">½</b></span>;
  return <>{i}<b className="rd-ap-frac">{"." + f}</b></>;
};
/* a change on the same pollster's previous poll; a flat one prints as a
   bare 0 (0.0 at one decimal) - the width of its ▲/▼ neighbours, where "no
   change" overran a primary's 54-64px column, and no dash to mistake for
   the tables' "not published" */
function rdApChg(d, dec) {
  if (d == null) return null;
  if (Math.abs(d) < (dec ? 0.05 : 0.5)) return dec ? (0).toFixed(dec) : "0";
  return (d > 0 ? "▲ " : "▼ ") + (dec ? Math.abs(d).toFixed(dec) : String(Math.abs(Math.round(d))));
}
/* an opened poll's mini-chart axis figure: a true minus, as the table prints
   its own (a bare {v} put hyphens on the leadership, direction and NAB axes) */
const rdApTick = (v) => (v < 0 ? "−" : "") + Math.abs(v);
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
  /* no implied figure when a primary column was never filed, or when the
     filed set misses 100 with NO documented explanation – gen-data's
     impShow withholds alpImp there, so any non-Essential row whose
     primaries miss 100 keeps this tripwire lit (documented anomalies show
     rebased instead) */
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

/* the eff-tag gates rdEffTbc/rdEffMissing live in the d1a1d215 asset
   (their ONE home since 2026-10-20: that layer loads earlier in
   build.mjs's JSX list, and its search haystack matches on the same gates
   this file draws) - this file's callers see them as window globals. */
/* the tag word links to the page where THE HOUSE will file (TBC) or should
   have filed (missing) this wave's APC statement - per house from
   gen-data's effTbcUrls (user call 2026-10-12:
   YouGov's belongs at yougov.com's own APC page; one shared register at
   pyxispolling.com/apc sent YouGov's readers to Newspoll's host). A wave
   from a house with no entry named gets the bare titled span. */
function rdEffNote(p) {
  const missing = rdEffMissing(p);
  const note = missing
    ? "The pollster publishes an effective sample, but none for this poll"
    : "The pollster publishes an effective sample, but not yet for this poll";
  const word = missing ? "missing" : "TBC";
  const url = (window.AUSPOL.effTbcUrls || {})[String(p.pollster || "").replace(/\s*\(.*\)$/, "")];
  return <>eff. {url
    ? <a className="rd-tbc" href={url} target="_blank" rel="noopener noreferrer" title={note} onClick={(e) => e.stopPropagation()}>{word}</a>
    : <span title={note}>{word}</span>}</>;
}
/* Fieldwork not yet published (a DemosAU wave filed from the Capital Brief
   article before the methodology PDF; a Resolve wave filed from the monitor
   csv before the SMH article carries its dates): the poll sits on the charts
   by a provisional window, but every label says just "TBC" (user call
   2026-10-11), linking where the house will publish the dates (gen-data's
   fieldUrl). rdFieldTxt is the plain-text form for tooltips and labels;
   rdFieldTbc the linked one. */
const rdFieldTxt = (q) => (q && q.fieldPending ? "TBC" : (q && (q.field || q.dateLabel)) || "");
function rdFieldTbc(p, tabIndex) {
  const note = "Fieldwork dates not yet published for this poll; it is placed by provisional dates until they are";
  return p.fieldUrl
    ? <a className="rd-tbc" href={p.fieldUrl} target="_blank" rel="noopener noreferrer" title={note} tabIndex={tabIndex} onClick={(e) => e.stopPropagation()}>TBC</a>
    : <span title={note}>TBC</span>;
}
/* A poll's header, one wording wherever a poll is opened (All polls, Latest
   and next polls): when it was in the field, how many were asked, and who
   published it when, as one running sentence. "a sample of 1,500" with the
   pollster's effective sample beside it where it prints one - and "eff. TBC"
   where it normally does but this wave's hasn't appeared yet (the house's
   previous poll carried one, and this came out in the last three weeks;
   older gaps are left unsaid, since some waves never get one). A wave filed
   under a client is "published by the AFR" (mastheads take the article,
   brands like News24 go bare; the non-masthead clients take "commissioned"
   instead - RD_AP_COMMISSIONED below); a self-published poll is published
   by its pollster, and says so. A confidence release's "client" is its
   product line (Consumer Confidence &c), not a publisher - its byline
   comes from the house slot like a self-published poll's. */
const RD_AP_BARE_CLIENTS = { News24: 1, "Capital Brief": 1, "News.com.au": 1, "News Australia": 1, Amplify: 1 };
const rdApThe = (name) => (/^the /i.test(name) || RD_AP_BARE_CLIENTS[name] ? name : "the " + name);
/* non-masthead clients: a think tank or campaign group commissions the
   poll rather than publishing it - "commissioned by", not "published by"
   (user calls 2026-10-15; the rest of the client list are mastheads) */
const RD_AP_COMMISSIONED = { "Blueprint Institute": 1, "Climate Council": 1, "Australia Inst.": 1, Amplify: 1 };
function rdPollHead(p) {
  const effTag = rdEffTbc(p) || rdEffMissing(p);
  // the figure cluster stays glued so it never splits mid-figure; the
  // "a sample of" lead-in wraps freely or the whole run would jump to the
  // next line as one block and strand a wide gap after "from"
  const n = p.sample != null
    ? <>a sample of <span className="rd-nocaps">{p.sample.toLocaleString()}{p.sampleEff != null ? " (eff. " + p.sampleEff.toLocaleString() + ")" : effTag ? <> ({rdEffNote(p)})</> : ""}</span></>
    : "an unpublished sample";
  const out = rdApOut(p.published);
  // a filed-under-client wave credits its client; a self-published poll is
  // published by its pollster, and says so. A confidence release keeps its
  // product line (the confidence lane's index name) in the client slot, so
  // the byline comes from the house slot, not the product. The verb turns
  // on the client's kind - mastheads publish, non-mastheads commission.
  const selfBy = p.conf || !(p.client && !/^self/i.test(p.client));
  const commissioned = !selfBy && RD_AP_COMMISSIONED[p.client];
  const by = (commissioned ? "commissioned by " : "published by ") + (selfBy ? p.pollster : rdApThe(p.client));
  const field = p.field || p.dateLabel;
  // pending dates read "Conducted on dates TBC" - the sentence shape the
  // probes pin (starts "Conducted on") and the copy card's anchors survive
  if (p.fieldPending) return <>Conducted on dates {rdFieldTbc(p)} from {n}{", " + by + (out ? " on " + out : "")}</>;
  return <>{field ? "Conducted on " + field + " from " : "From "}{n}{", " + by + (out ? " on " + out : "")}</>;
}

/* Primary column metadata only - the display order is NOT baked here. The
   primary facet ranks its columns by the site aggregate, reading gen-data's
   latest.primaryOrder walk like every other party listing (the old tables'
   pOrder, the Latest table's plParties); the FALLBACK ladder only covers a
   bundle that predates primaryOrder. */
const RD_AP_PRIM_META = {
  alp: { lab: "ALP", ink: "var(--alp-text)", dot: "var(--alp)" },
  lnp: { lab: "L/NP", ink: "var(--lnp-text)", dot: "var(--lnp)" },
  grn: { lab: "GRN", ink: "var(--grn-text)", dot: "var(--grn)" },
  onp: { lab: "ON", ink: "var(--onp-text)", dot: "var(--onp)" },
  /* ind is a lookup-only entry (the Blueprint wave's consideration asked
     about Independents) - rdApPrimList still drives every party LADDER,
     whose id comes from latest.primaryOrder and stays five-key */
  ind: { lab: "IND", ink: "var(--ink-2)", dot: "var(--oth)" },
  oth: { lab: "OTH", ink: "var(--ink-2)", dot: "var(--oth)" },
};
const RD_AP_PRIM_FALLBACK = ["alp", "lnp", "grn", "onp", "oth"];
/* [{ id, lab, ink, dot }] from an id list; an unknown key drops out silently
   rather than misorder the ladder */
const rdApPrimList = (ids) => ids.filter((id) => id in RD_AP_PRIM_META).map((id) => ({ id, ...RD_AP_PRIM_META[id] }));
/* The Includes filter in the redesign's words. The rare contests the old
   Contest control carried (Coalition v One Nation, three-cornered) are here
   now, as what a poll published. */
const RD_AP_TAGS = {
  "2pp": { label: "A two-party figure", note: "One head-to-head, usually Labor v Coalition" },
  "2x2pp": { label: "Two two-party figures", note: "Labor v Coalition and Labor v One Nation" },
  "3x2pp": { label: "All three head-to-heads", note: "Including Coalition v One Nation" },
  "3pp": { label: "A three-cornered figure", note: "Labor, Coalition and One Nation in one split" },
  ppm: { label: window.JUR ? "Better " + window.JUR.office.alb : "Better prime minister" },
  aprv: { label: "Leader approval" },
  fav: { label: "Leader favourability" },
  seats: { label: "A seat projection", note: "Modelled seat counts" },
  dir: { label: "Right direction or wrong track" },
  iss: { label: "Issues", note: "What voters say matters, and the party rated best on each" },
};
const rdApTagLab = (id) => (RD_AP_TAGS[id] ? RD_AP_TAGS[id].label : id);

/* the lean scale: six points either way of the polls around it */
const RD_AP_M = 6;
const rdApX = (v) => ((Math.max(-RD_AP_M, Math.min(RD_AP_M, v)) + RD_AP_M) / (2 * RD_AP_M)) * 100;

/* ---------------------------------------------------------------- the lean picture
   One poll against the average of the other polls fielded around it
   (rdApYd): the centre line is that average, the dot the poll's lean, the whisker its 95% margin from sampling
   alone, and the tick its pollster's usual lean as of the poll (`he`) - where
   its polls land with nothing but sampling at work, so a whisker that clears
   the tick, not the centre line, is the surprise. `tip` is the readout, drawn
   on hover by the row. */
function RdApStrip({ lean, moe, he, onM, tip, phone, ink }) {
  const grid = phone ? [-3, 3] : [-4, -2, 2, 4];
  const lo = lean != null && moe != null ? lean - moe : null;
  const hi = lean != null && moe != null ? lean + moe : null;
  return (
    <span className="rd-ap-in">
      {grid.map((v) => <i key={v} className="rd-ap-gl" style={{ left: rdApX(v) + "%" }}></i>)}
      <i className="rd-ap-avg" style={{ left: "50%" }}></i>
      {he != null && Math.abs(he) >= 0.05 && <i className="rd-ap-he" style={{ left: rdApX(he) + "%" }}></i>}
      {lo != null && <i className="rd-ap-wh" style={{ left: rdApX(lo) + "%", width: rdApX(hi) - rdApX(lo) + "%" }}></i>}
      {lo != null && <i className={"rd-ap-clip l" + (lo < -RD_AP_M ? " on" : "")}></i>}
      {hi != null && <i className={"rd-ap-clip r" + (hi > RD_AP_M ? " on" : "")}></i>}
      {lean != null && <i className="rd-ap-dot" style={{ left: rdApX(lean) + "%", background: ink || rdApLeanDot(lean, onM) }}></i>}
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
   average, its place against the polls around it, the pollster's house lean, and what
   it does to today's figure. */
/* the average a poll is held against on a contest and basis: gen-data's
   §3c yardstick, the headline's estimator read at the wave's fieldwork
   midpoint from the OTHER polls ({ v, he, n, p }), null where no other
   poll sits within three weeks of it */
const rdApYdKey = (onM, pub) => (pub ? (onM ? "onp" : "lnp") : (onM ? "onimp" : "imp"));
const rdApYd = (p, onM, pub) => (p.yd && p.yd[rdApYdKey(onM, pub)]) || null;
/* a gap against a margin, judged on the figures as printed, so a 1.2 gap
   never reads "outside" a ±1.2 margin */
const rdApInside = (gap, moe) => {
  if (gap == null || moe == null) return null;
  const g = Math.round(Math.abs(gap) * 10), m = Math.round(moe * 10);
  return 2 * g < m ? "well inside" : g <= m ? "inside" : "outside";
};
/* what the table's dot is measured from, in words */
const rdApAgainst = (pub) => (RD_AP_KAL ? "the trend through the other polls"
  : "the average of the other " + (pub ? "published figures" : "polls") + " fielded within three weeks of it");
const rdApTickStep = (lo, hi) => (hi - lo > 24 ? (hi - lo > 48 ? 10 : 8) : 4);
/* a house's name in the rail's narrow key column may break after its slash
   ("RedBridge/Accent’s" ran into its value on a phone) */
const rdApBreakable = (name) => String(name).replace(/\//g, "/\u200b");
/* a poll's house lean as of the poll on a contest and basis, as printed, and
   its lean with that taken out - the gap its margin is judged on (the raw
   lean where the house has no measured lean) */
const rdApHe = (p, onM, pub) => { const y = rdApYd(p, onM, pub); return y && y.he != null ? Math.round(y.he * 10) / 10 : null; };
const rdApAdj = (p, onM, pub) => { const h = rdApHe(p, onM, pub); return p.lean == null ? null : h == null ? p.lean : Math.round((p.lean - h) * 10) / 10; };
const rdApR1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
/* the line that yardstick lies on, as {ym, x, v} rows from t0 to t1: the
   series' line with the stretch this wave reaches redrawn without it (the
   yardstick's patch) and the yardstick itself at the wave's midpoint, so the
   gap the chart draws is the gap the rail states */
function rdApYdLine(line, y, xm, t0, t1) {
  const vs = (line || []).map((r) => r[1]);
  if (y && y.p) y.p.v.forEach((v, j) => { vs[y.p.i + j] = v; });
  let rows = (line || []).map((r, i) => ({ ym: r[0], x: rdApDays(r[0]), v: vs[i] }))
    .filter((a) => a.v != null && a.x >= t0 && a.x <= t1);
  if (y && xm >= t0 && xm <= t1) rows = rows.filter((a) => a.x !== xm).concat([{ ym: new Date(xm).toISOString().slice(0, 10), x: xm, v: y.v }]).sort((a, b) => a.x - b.x);
  return rows;
}
function RdApMini({ p, onM, pub }) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  /* One picture per contest and basis. Switching either redraws this chart
     as the same chart asking the other question (useValueMorph): the y range
     glides, the average reshapes, a release that has a figure both ways
     travels between them, one that has only one fades, and "This poll"
     crossfades its figure as it moves. It used to cut. */
  const sceneOf = (key) => {
    const [o, pb] = key.split("|").map((v) => v === "1");
    const valOf = (q) => (pb ? (o ? (q.tppAlt ? q.tppAlt.alp : null) : q.alpN) : (o ? q.alpOnImp : q.alpImp));
    const mine = D.individualPolls.filter((q) => q.pollster === p.pollster && valOf(q) != null
      && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1);
    const avg = rdApYdLine((D.yardLine || {})[rdApYdKey(o, pb)], rdApYd(p, o, pb), rdApDays(p.fmid || p.released), t0, t1);
    const vals = mine.map(valOf).concat(avg.map((a) => a.v));
    const own = valOf(p);
    if (!vals.length || own == null) return null;
    let lo = Math.floor(Math.min(...vals) / 2) * 2, hi = Math.ceil(Math.max(...vals) / 2) * 2;
    if (hi - lo < 6) { const c = (hi + lo) / 2; lo = Math.floor((c - 3) / 2) * 2; hi = lo + 6; }
    return { o, pb, valOf, mine, avg, own, lo, hi };
  };
  const key = (onM ? "1" : "0") + "|" + (pub ? "1" : "0");
  const m = window.AP.useValueMorph(key);
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
  const S = sceneOf(key);
  const A = m ? sceneOf(m.from) : null;
  const t = m && A ? m.t : 1;
  if (!S) return <div ref={box}></div>;
  const mix = (a, b) => (A ? a + (b - a) * t : b);
  const lo = mix(A ? A.lo : 0, S.lo), hi = mix(A ? A.hi : 0, S.hi);
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (tt) => x0 + ((tt - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  /* the target's ticks, with the ones leaving; each fades as it slides out
     past the plot's edge */
  const ticks = [];
  for (let v = S.lo; v <= S.hi + 1e-9; v += 2) ticks.push(v);
  if (A) for (let v = A.lo; v <= A.hi + 1e-9; v += 2) if (!ticks.includes(v)) ticks.push(v);
  const tickOp = (v) => { const y = Y(v); return y < top - 0.5 ? Math.max(0, 1 - (top - y) / 14) : y > bot + 0.5 ? Math.max(0, 1 - (y - bot) / 14) : 1; };
  const own = mix(A ? A.own : 0, S.own);
  /* every wave marker sits at its FIELDWORK midpoint (gen-data's fmid):
     the pooled line is fieldwork-timed, and `released` is fieldwork's last
     day (or below it under older data), so release-date x positions the
     dot right of the window it claims and off the line's slope */
  const cx = X(rdApDays(p.fmid || p.released)), cy = Y(own);
  const labLeft = cx > W * 0.45;
  const rival = onM ? "One Nation" : "Coalition";
  const outLabel = (q) => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const show = (id, src) => setTip({ id, src });
  const hide = (id, src) => setTip((tp) => (tp && tp.id === id && (!src || tp.src === src) ? null : tp));
  /* keyed or not (a pollster can file a day's wave twice in seven months),
     the dot still reads; only the keyed ones open. Mid-switch a dot is the
     same release in both pictures, matched by that identity. */
  const dotsOf = (sc) => {
    const seen = {};
    return sc.mine.filter((q) => q.released !== p.released).map((q) => {
      const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
      const dup = sc.mine.some((z) => z !== q && z.pollster === q.pollster && z.released === q.released);
      const key2 = (!raw || dup) ? null : raw;
      const id = q.pollster + "|" + q.released + "#" + (seen[q.released] = (seen[q.released] || 0) + 1);
      return { q, key: key2, id, cx: X(rdApDays(q.fmid || q.released)), a: sc.valOf(q) };
    });
  };
  const now = dotsOf(S);
  const was = A ? new Map(dotsOf(A).map((d) => [d.id, d])) : null;
  const dots = now.map((d) => {
    const w = was && was.get(d.id);
    if (was) was.delete(d.id);
    return { ...d, cy: Y(w ? w.a + (d.a - w.a) * t : d.a), op: was && !w ? t : 1 };
  });
  if (was) was.forEach((d) => dots.push({ ...d, key: null, cy: Y(d.a), op: 1 - t, leaving: true }));
  /* the average: the two contests' monthly figures blended as every chart
     on the page blends a line, and clipped to the months it runs over */
  const avgBl = A && A.avg.length && S.avg.length ? window.AP.blendRows(A.avg, S.avg, t, ["v"]) : null;
  const avgPts = avgBl ? avgBl.rows : S.avg;
  const avgClip = avgBl ? avgBl.clip : null;
  const clipId = "apm" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const avgFirst = avgBl ? { x: avgClip[0], v: avgPts.find((r) => r.x >= avgClip[0] - 1) ? avgPts.find((r) => r.x >= avgClip[0] - 1).v : avgPts[0].v } : S.avg[0];
  const dotTip = tip && !m && (dots.find((d) => d.id === tip.id && !d.leaving) || null);
  const ownTxt = (sc) => "This poll " + sc.own.toFixed(1);
  const ownLab = (txt, op) => (
    <text x={labLeft ? cx - 12 : cx + 12} y={cy - 12} className="rd-apd-thislab" textAnchor={labLeft ? "end" : "start"}
          style={op < 1 ? { opacity: op } : null}>{txt}</text>
  );
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${p.pollster}’s polls since ${rdMonthYear(ms[0])} against the ${RD_AP_AVG} of every poll; this poll ${S.own.toFixed(1)}.`}>
        {avgClip && (
          <defs><clipPath id={clipId}><rect x={X(avgClip[0]) - 2} y={-20} width={Math.max(0, X(avgClip[1]) - X(avgClip[0]) + 4)} height={H + 40} /></clipPath></defs>
        )}
        {ticks.map((v) => { const op = tickOp(v); return op <= 0 ? null : <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === 50 ? "rd-apd-even" : "rd-apd-gl"} style={op < 1 ? { opacity: op } : null}></path>; })}
        {ticks.map((v) => { const op = tickOp(v); return op <= 0 ? null : <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end" style={op < 1 ? { opacity: op } : null}>{rdApTick(v)}</text>; })}
        {avgPts.length > 1 && <path d={monotoneXY(avgPts.map((a) => [X(a.x), Y(a.v)]))} className="rd-apd-avgline" clipPath={avgClip ? `url(#${clipId})` : undefined}></path>}
        {avgFirst && <text x={X(avgFirst.x)} y={Y(avgFirst.v) - 9} className="rd-apd-lab">{RD_AP_KAL ? "Trend" : "Average"}</text>}
        {dots.map((d) => {
          const { id, key: k } = d;
          const open = () => { if (k && window.AP.openPoll) { setTip(null); window.AP.openPoll(k, "twopp", "the poll you were reading"); } };
          if (d.leaving) return <g key={id + "|out"} style={{ opacity: d.op }}><circle cx={d.cx} cy={d.cy} r="4" className="rd-apd-dot"></circle></g>;
          return (
            <g key={id} style={d.op < 1 ? { opacity: d.op } : null}>
              {tip && tip.id === id && <circle cx={d.cx} cy={d.cy} r="7.5" className="rd-apd-dothi"></circle>}
              <circle cx={d.cx} cy={d.cy} r="4" className="rd-apd-dot"></circle>
              <circle cx={d.cx} cy={d.cy} r="9" className={"rd-apd-hit" + (k ? " link" : "")}
                      tabIndex="0" role={k ? "button" : "img"}
                      aria-label={(pub ? "Published" : "Implied") + " Labor two-party " + d.a.toFixed(1)
                        + " against " + rival + ", " + p.pollster + "’s poll of " + outLabel(d.q)
                        + (k ? "; press Enter to open it" : "")}
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
        {A && A.own !== S.own ? <>{ownLab(ownTxt(A), 1 - t)}{ownLab(ownTxt(S), t)}</> : ownLab(ownTxt(S), 1)}
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
      {dotTip && (() => { const d = dotTip; return (
        <div ref={tipBox} className="tip rd-apd-tip" style={{ left: d.cx + "px" }} aria-hidden="true">
          <div className="tip-title">{d.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(d.q) || d.q.released)}</div>
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

/* A direction wave's version of RdApMini: the firm's readings over seven
   months as a NET (right direction minus wrong track) against the monthly
   net, a dashed zero splitting right-direction from wrong-track country.
   No basis to morph between, so no useValueMorph - one static scene. */
function RdApDirMini({ p }) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const netOf = (q) => q.right - q.wrong;
  const mine = (D.directionPolls || []).filter((q) => q.pollster === p.pollster
    && q.right != null && q.wrong != null && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1);
  // the other readings' net around each day, this reading left out where it reaches (§3c)
  const avg = rdApYdLine((D.yardLine || {}).dir, p.dir ? p.dir.yd : null, rdApDays(p.fmid || p.released), t0, t1);
  const own = p.dir ? p.dir.net : null;
  if (!mine.length || own == null) return <div ref={box}></div>;
  const vals = mine.map(netOf).concat(avg.map((a) => a.v), [0]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4, hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 8) { const c = (lo + hi) / 2; lo = Math.floor((c - 4) / 4) * 4; hi = lo + 8; }
  /* a 150px plot holds about seven labelled lines: past 24 points of range
     they step by 8 (a −40 to 0 range drew eleven, crowded) */
  const step = rdApTickStep(lo, hi);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (tt) => x0 + ((tt - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.fmid || p.released)), cy = Y(own);
  const labLeft = cx > W * 0.45;
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
  const dots = mine.filter((q) => q.released !== p.released).map((q) => {
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
    const dup = mine.some((z) => z !== q && z.released === q.released);
    return { q, key: (!raw || dup) ? null : raw, id: q.pollster + "|" + q.released, cx: X(rdApDays(q.fmid || q.released)), a: netOf(q) };
  });
  const show = (id, src) => setTip({ id, src });
  const hide = (id, src) => setTip((tp) => (tp && tp.id === id && (!src || tp.src === src) ? null : tp));
  const dotTip = tip && dots.find((d) => d.id === tip.id);
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${p.pollster}’s national-direction readings since ${rdMonthYear(ms[0])} as a net, right direction minus wrong track, against the average of every reading; this reading ${rdApSigned(own)}.`}>
        {ticks.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === 0 ? "rd-apd-even" : "rd-apd-gl"}></path>)}
        {ticks.map((v) => <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end">{rdApTick(v)}</text>)}
        {avg.length > 1 && <path d={monotoneXY(avg.map((a) => [X(a.x), Y(a.v)]))} className="rd-apd-avgline"></path>}
        {avg.length > 0 && <text x={X(avg[0].x)} y={Y(avg[0].v) - 9} className="rd-apd-lab">Average</text>}
        {dots.map((d) => {
          const open = () => { if (d.key && window.AP.openPoll) { setTip(null); window.AP.openPoll(d.key, "direction", "the reading you were looking at"); } };
          return (
            <g key={d.id}>
              {tip && tip.id === d.id && <circle cx={d.cx} cy={Y(d.a)} r="7.5" className="rd-apd-dothi"></circle>}
              <circle cx={d.cx} cy={Y(d.a)} r="4" className="rd-apd-dot"></circle>
              <circle cx={d.cx} cy={Y(d.a)} r="9" className={"rd-apd-hit" + (d.key ? " link" : "")}
                      tabIndex="0" role={d.key ? "button" : "img"}
                      aria-label={`Net ${rdApSigned(d.a)}, ${p.pollster}’s reading of ${d.q.fieldPending ? "TBC" : d.q.dateLabel || d.q.released}` + (d.key ? "; press Enter to open it" : "")}
                      onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
                      onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show(d.id, "mouse"); }}
                      onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide(d.id, "mouse"); }}
                      onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(d.id, "focus"); }}
                      onBlur={() => hide(d.id, "focus")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        const pt = ev.detail === 0 ? "key" : ptr.current;
                        ptr.current = null;
                        if (pt === "mouse" || pt === "key") { open(); return; }
                        if (tip && tip.id === d.id) setTip(null); else setTip({ id: d.id, src: "touch" });
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
        <text x={labLeft ? cx - 12 : cx + 12} y={cy - 12} className="rd-apd-thislab" textAnchor={labLeft ? "end" : "start"}>{"This reading " + rdApSigned(own)}</text>
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
      {dotTip && (
        <div ref={tipBox} className="tip rd-apd-tip" style={{ left: dotTip.cx + "px" }} aria-hidden="true">
          <div className="tip-title">{dotTip.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(dotTip.q) || dotTip.q.released)}</div>
          <div className="tip-sub">Right direction {rdApNum(dotTip.q.right)}, wrong track {rdApNum(dotTip.q.wrong)}: net {rdApSigned(dotTip.a)}</div>
          {dotTip.q.sample != null && <div className="tip-sub">n = {dotTip.q.sample.toLocaleString()}</div>}
          {tip.src !== "touch" && (dotTip.key
            ? <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this reading" : "Click to open this reading"}</div>
            : null)}
        </div>
      )}
    </div>
  );
}

/* A confidence release's version of RdApDirMini: the gauge's own releases
   over seven months with this one ringed, everything as printed - the
   gauges are each publisher's own series (§5j), so there is no average
   line to draw against. The neutral line is emphasised (100 on the index
   gauges, 0 on NAB's net balance, which sits at its true printed figure
   here, not the confidence panel's +100 shift); every dot opens its own row. */
function RdApConfMini({ p }) {
  const D = window.AUSPOL;
  const c = p.conf;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const ser = (((D.confidence || {})[c.k]) || {}).polls || [];
  const mine = ser.filter((q) => rdApDays(q.released) >= t0 && rdApDays(q.released) <= t1);
  if (!mine.length) return <div ref={box}></div>;
  const fmt = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const outLabel = (q) => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const neut = c.vs;              // the gauge's neutral print (0 on NAB's net balance)
  const vals = mine.map((q) => q.v).concat([neut]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4, hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 8) { const cMid = (lo + hi) / 2; lo = Math.floor((cMid - 4) / 4) * 4; hi = lo + 8; }
  const step = rdApTickStep(lo, hi);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (tt) => x0 + ((tt - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.released)), cy = Y(c.v);
  const labLeft = cx > W * 0.45;
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
  const dots = mine.filter((q) => q.released !== p.released).map((q) => {
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: p.pollster, released: q.released }) : null;
    const dup = mine.some((z) => z !== q && z.released === q.released);
    return { q, key: (!raw || dup) ? null : raw, id: q.released, cx: X(rdApDays(q.released)), a: q.v };
  });
  const show = (id, src) => setTip({ id, src });
  const hide = (id, src) => setTip((tp) => (tp && tp.id === id && (!src || tp.src === src) ? null : tp));
  const dotTip = tip && dots.find((d) => d.id === tip.id);
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${c.lab} releases since ${D.monthName(+ms[0].slice(5, 7)) + " " + ms[0].slice(0, 4)}, as published; this release ${fmt(c.v)}${neut === 0 ? ", a net balance, 0 neutral" : ", 100 neutral"}.`}>
        {ticks.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === neut ? "rd-apd-even" : "rd-apd-gl"}></path>)}
        {ticks.map((v) => <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end">{rdApTick(v)}</text>)}
        {dots.map((d) => {
          const open = () => { if (d.key && window.AP.openPoll) { setTip(null); window.AP.openPoll(d.key, "confidence", "the release you were looking at"); } };
          return (
            <g key={d.id}>
              {tip && tip.id === d.id && <circle cx={d.cx} cy={Y(d.a)} r="7.5" className="rd-apd-dothi"></circle>}
              <circle cx={d.cx} cy={Y(d.a)} r="4" className="rd-apd-dot"></circle>
              <circle cx={d.cx} cy={Y(d.a)} r="9" className={"rd-apd-hit" + (d.key ? " link" : "")}
                      tabIndex="0" role={d.key ? "button" : "img"}
                      aria-label={`${fmt(d.a)}, ${c.lab} released ${outLabel(d.q)}` + (d.key ? "; press Enter to open it" : "")}
                      onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
                      onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show(d.id, "mouse"); }}
                      onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide(d.id, "mouse"); }}
                      onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(d.id, "focus"); }}
                      onBlur={() => hide(d.id, "focus")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        const pt = ev.detail === 0 ? "key" : ptr.current;
                        ptr.current = null;
                        if (pt === "mouse" || pt === "key") { open(); return; }
                        if (tip && tip.id === d.id) setTip(null); else setTip({ id: d.id, src: "touch" });
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
        <text x={labLeft ? cx - 12 : cx + 12} y={cy - 12} className="rd-apd-thislab" textAnchor={labLeft ? "end" : "start"}>{"This release " + fmt(c.v)}</text>
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
      {dotTip && (
        <div ref={tipBox} className="tip rd-apd-tip" style={{ left: dotTip.cx + "px" }} aria-hidden="true">
          <div className="tip-title">Released {outLabel(dotTip.q)}</div>
          <div className="tip-sub">{c.lab} {fmt(dotTip.a)}{dotTip.q.chg != null ? ", " + (dotTip.q.chg < 0 ? "down " : "up ") + fmt(Math.abs(dotTip.q.chg)) + " on the previous release" : ""}</div>
          {tip.src !== "touch" && (dotTip.key
            ? <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this release" : "Click to open this release"}</div>
            : null)}
        </div>
      )}
    </div>
  );
}

/* A leadership wave's version of the mini charts: the gap between Albanese's
   net rating and each rival's, this pollster's own waves against the monthly
   average gap. A gap is only read on the question both names were asked the
   same wave - approval with approval, favourability with favourability, never
   one of each (they are different questions everywhere on the site; a gap
   mixing them would be neither), and a favourability gap gets the open face
   the Leadership dot-plot gives favourability. */
const RD_AP_LD_RIVALS = [
  { riv: "opp", net: "taylorNet", met: "taylor", he: "opp", ln: "taylor", ink: "var(--lnp)", name: (a) => a.oppName || "Taylor" },
  { riv: "han", net: "hansonNet", met: "hanson", he: "han", ln: "hanson", ink: "var(--onp)", name: (a) => apWho(a, "hanson", "Hanson") },
];
/* the head of government as these leadership sentences name them: federally
   Albanese; on /vic/ the Premier the poll asked about (apWho), or, across a
   window that may span a change, the office itself */
const rdApPm = (a) => apWho(a, "alb", "Albanese");
const rdApPmOffice = () => (window.JUR ? "the " + window.JUR.office.alb : "Albanese");
const rdApPmNow = () => (window.JUR ? (window.AUSPOL.LEADERS.find((l) => l.id === "alb") || {}).short : "Albanese");
function rdApLdPairs(a) {
  if (!a || a.albNet == null || !a.metricBy) return [];
  const out = [];
  for (const R of RD_AP_LD_RIVALS) {
    if (a[R.net] == null) continue;
    const met = a.metricBy[R.met];
    if (met !== a.metricBy.alb) continue;
    out.push({ riv: R.riv, R, name: R.name(a), met, ink: R.ink, net: a[R.net], gap: a.albNet - a[R.net] });
  }
  return out;
}
/* the release's SECOND reading where a firm prints both questions in one
   wave (Resolve's likeability nets ride appr.alt per leader); gap =
   Albanese's alt net minus the rival's, tagged met:"fav" so the chart's
   favourability styling follows */
function rdApLdAltPairs(a) {
  const alt = a && a.alt;
  if (!alt || !alt.alb || alt.alb.net == null) return [];
  return RD_AP_LD_RIVALS.filter((R) => alt[R.met] && alt[R.met].net != null)
    .map((R) => ({ riv: R.riv, R, name: R.name(a), met: "fav", ink: R.ink, net: alt[R.met].net, gap: alt.alb.net - alt[R.met].net }));
}
const rdApLdMetWord = (met) => (met === "fav" ? "net favourability" : "net approval");
/* "net leader ratings" rather than a metric word when the window mixes both,
   so the caption never mislabels the chart */
function rdApLdWord(waves) {
  const mets = new Set();
  waves.forEach((w) => w.pairs.forEach((pr) => mets.add(pr.met)));
  return mets.size === 1 ? rdApLdMetWord([...mets][0]) : "net leader ratings";
}
const rdApLdJoin = (list) => (list.length > 2 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list.join(" and "));
/* the pollster's seven-month window of waves with a gap to draw */
function rdApLdWindow(p) {
  const D = window.AUSPOL;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const waves = D.individualPolls
    .filter((q) => q.pollster === p.pollster && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1)
    .map((q) => ({ q, pairs: rdApLdPairs(q.appr) }))
    .filter((w) => w.pairs.length);
  return { ms, t0, t1, waves };
}
/* who is ahead: a positive gap is Albanese's way */
const rdApLdWay = (g, name, pm) => (Math.abs(g) < 0.05 ? "level" : g > 0 ? (pm || "Albanese") + "’s way" : name + "’s way");
function RdApLdMini({ p, met }) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
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
  const { ms, t0, t1, waves: full } = rdApLdWindow(p);
  /* met is the caption toggle's view: "fav" redraws every wave on the
     release's second-question favourability pairs (waves that never printed
     the second question drop out of the window); anything else draws the
     primary pairs, which are already the wave's only question */
  const waves = met === "fav"
    ? full.map((w) => ({ q: w.q, pairs: rdApLdAltPairs(w.q.appr) })).filter((w) => w.pairs.length)
    : full;
  const own = (met === "fav" ? rdApLdAltPairs(p.appr) : rdApLdPairs(p.appr));
  if (!waves.length) return <div ref={box}></div>;
  /* the average-gap line for exactly the (rival, question) combos the dots
     carry: gen-data's §4c gap of every other wave around each day, this
     wave left out where it reaches (its ldYd patch) and its own yardstick
     placed at its midpoint, so the gap drawn is the gap the rail states.
     The line breaks where either name had no reading in reach. */
  const combos = new Set();
  waves.forEach((w) => w.pairs.forEach((pr) => combos.add(pr.riv + "|" + pr.met)));
  const xm = rdApDays(p.fmid || p.released);
  const avg = [...combos].map((cm) => {
    const [riv, met] = cm.split("|");
    const k = riv + "|" + (met === "fav" ? "fav" : "net");
    const L = (D.ldYardLine || {})[k] || [];
    const y = (p.ldYd || {})[k] || null;
    const vs = L.map((r) => r[1]);
    if (y && y.p) y.p.v.forEach((v, j) => { vs[y.p.i + j] = v; });
    let pts = L.map((r, i) => ({ x: rdApDays(r[0]), v: vs[i] })).filter((a) => a.x >= t0 && a.x <= t1);
    if (y && xm >= t0 && xm <= t1) pts = pts.filter((a) => a.x !== xm).concat([{ x: xm, v: y.v }]).sort((a, b) => a.x - b.x);
    const brk = ((D.ldYardBreaks || {})[k] || []).map(rdApDays);
    const segs = [];
    let cur = [];
    for (const a of pts) {
      // a change of office-holder starts a new line, as a gap in readings does
      if (a.v == null || (cur.length && brk.some((b) => cur[cur.length - 1].x < b && a.x >= b))) { if (cur.length > 1) segs.push(cur); cur = []; }
      if (a.v != null) cur.push(a);
    }
    if (cur.length > 1) segs.push(cur);
    return { riv, met, ink: RD_AP_LD_RIVALS.find((r) => r.riv === riv).ink, segs };
  }).filter((al) => al.segs.length);
  const vals = waves.flatMap((w) => w.pairs.map((pr) => pr.gap)).concat(avg.flatMap((al) => al.segs.flat().map((z) => z.v)), [0]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4, hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 12) { const c = (lo + hi) / 2; lo = Math.floor((c - 6) / 4) * 4; hi = lo + 12; }
  const step = rdApTickStep(lo, hi);       // see RdApDirMini
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (tt) => x0 + ((tt - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.fmid || p.released));
  const labLeft = cx > W * 0.45;
  const dots = waves.filter((w) => w.q.released !== p.released).flatMap((w) => w.pairs.map((pr) => {
    const q = w.q;
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
    const dup = waves.some((z) => z.q !== q && z.q.released === q.released);
    return { q, pr, key: (!raw || dup) ? null : raw, id: q.pollster + "|" + q.released + "|" + pr.riv, cx: X(rdApDays(q.fmid || q.released)) };
  }));
  const show = (id, src) => setTip({ id, src });
  const hide = (id, src) => setTip((tp) => (tp && tp.id === id && (!src || tp.src === src) ? null : tp));
  const dotTip = tip && dots.find((d) => d.id === tip.id);
  const ownInkOf = (pr) => pr.ink;
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${p.pollster}’s polls since ${rdMonthYear(ms[0])} on the ${rdApLdWord(waves)} gap, ${rdApPmOffice()} minus ${rdApLdJoin([...new Set(waves.flatMap((w) => w.pairs.map((pr) => pr.name)))])}, against the average of every poll; ${own.length ? "this poll " + own.map((pr) => rdApLdWay(pr.gap, pr.name, rdApPm(p.appr))).join(" and ") : "this poll’s own readings are on the other question"}.`}>
        {ticks.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === 0 ? "rd-apd-even" : "rd-apd-gl"}></path>)}
        {ticks.map((v) => <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end">{rdApTick(v)}</text>)}
        {avg.flatMap((al) => al.segs.map((sg, i) => (
          <path key={al.riv + "|" + al.met + "|" + i} d={monotoneXY(sg.map((z) => [X(z.x), Y(z.v)]))} className="rd-apd-avgline"
                style={{ stroke: `color-mix(in oklab, ${al.ink} 78%, transparent)`, strokeDasharray: al.met === "fav" ? "5 4" : undefined }}></path>
        )))}
        {dots.map((d) => {
          const { id, key: k, pr } = d;
          const open = () => { if (k && window.AP.openPoll) { setTip(null); window.AP.openPoll(k, "leadership", "the poll you were reading"); } };
          return (
            <g key={id}>
              {tip && tip.id === id && <circle cx={d.cx} cy={Y(pr.gap)} r="7.5" className="rd-apd-dothi"></circle>}
              {pr.met === "fav"
                ? <circle cx={d.cx} cy={Y(pr.gap)} r="4" style={{ fill: "var(--surface-2)", stroke: pr.ink, strokeWidth: 1.8 }}></circle>
                : <circle cx={d.cx} cy={Y(pr.gap)} r="4" style={{ fill: `color-mix(in oklab, ${pr.ink} 55%, transparent)` }}></circle>}
              <circle cx={d.cx} cy={Y(pr.gap)} r="9" className={"rd-apd-hit" + (k ? " link" : "")}
                      tabIndex="0" role={k ? "button" : "img"}
                      aria-label={rdApPm(d.q.appr) + "’s " + rdApLdMetWord(pr.met) + " minus " + pr.name + "’s, " + rdApLdWay(pr.gap, pr.name, rdApPm(d.q.appr))
                        + ", " + d.q.pollster + "’s poll of " + (d.q.fieldPending ? "TBC" : d.q.field || d.q.released)
                        + (k ? "; press Enter to open it" : "")}
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
        {own.map((pr) => {
          const cy = Y(pr.gap);
          /* with two rings the higher gap's label goes above its ring and the
             lower one's below, so neither sits beside the other's ring (it
             used to go by list order, and crossed whenever the first rival's
             gap was the lower) */
          const above = own.length === 1 || pr === own.reduce((t, o) => (o.gap > t.gap ? o : t), own[0]);
          return (
            <g key={pr.riv}>
              <circle cx={cx} cy={cy} r="8" className="rd-apd-ring" style={{ stroke: ownInkOf(pr) }}></circle>
              <circle cx={cx} cy={cy} r="4.5" className="rd-apd-this" style={pr.met === "fav"
                ? { fill: "var(--surface-2)", stroke: ownInkOf(pr), strokeWidth: 2 }
                : { fill: ownInkOf(pr) }}></circle>
              <text x={labLeft ? cx - 12 : cx + 12} y={above ? cy - 12 : cy + 24} className="rd-apd-thislab"
                    textAnchor={labLeft ? "end" : "start"}>{own.length > 1 ? "v " + pr.name + " " : "This poll "}{rdApSigned(pr.gap)}</text>
            </g>
          );
        })}
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
      {dotTip && (
        <div ref={tipBox} className="tip rd-apd-tip" style={{ left: dotTip.cx + "px" }} aria-hidden="true">
          <div className="tip-title">{dotTip.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(dotTip.q) || dotTip.q.released)}</div>
          <div className="tip-sub">{rdApPm(dotTip.q.appr)}{" "}{rdApSigned(dotTip.q.appr.albNet)}, {dotTip.pr.name} {rdApSigned(dotTip.pr.net)} – {Math.abs(dotTip.pr.gap).toFixed(1)} points {rdApLdWay(dotTip.pr.gap, dotTip.pr.name, rdApPm(dotTip.q.appr))} ({rdApLdMetWord(dotTip.pr.met)})</div>
          {dotTip.q.sample != null && <div className="tip-sub">n = {dotTip.q.sample.toLocaleString()}</div>}
          {tip.src !== "touch" && (dotTip.key
            ? <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this poll" : "Click to open this poll"}</div>
            : null)}
        </div>
      )}
    </div>
  );
}

/* An issues wave's version of the mini charts: the pooled monthly lines for
   who voters rate best on the wave's top issue, over seven months, with this
   wave's own printed three-way shares rung at their date. Ownership shares
   are of those naming one of the three parties, so they live on one scale. */
function RdApIssMini({ p }) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iss = p.iss || {};
  const item = iss.top && D.issues && D.issues.list ? (Array.isArray(D.issues.list) ? D.issues.list.find((it) => it.id === iss.top) : D.issues.list[iss.top]) || null : null;
  if (!item || !item.monthly || item.monthly.length < 2) return <div ref={box}></div>;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  /* [ym, alp, lnp, onp, ±alp, ±lnp, ±onp] */
  const rows = item.monthly.filter((r) => rdApDays(r[0] + "-15") >= t0 && rdApDays(r[0] + "-15") <= t1);
  if (rows.length < 2) return <div ref={box}></div>;
  /* as-printed → three-party split: the wave's own shares go onto the
     pooled line's basis (of those naming one of the three parties) */
  const wown = iss.own && iss.own[iss.top] ? iss.own[iss.top] : null;
  const nown = wown ? wown.alp + wown.lnp + wown.onp : 0;
  const own = wown && nown > 0 ? Object.fromEntries(["alp", "lnp", "onp"].map((q) => [q, wown[q] * 100 / nown])) : null;
  const vals = rows.flatMap((r) => [r[1], r[2], r[3]]).concat(own ? [own.alp, own.lnp, own.onp].filter((v) => v != null) : []);
  let lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
  if (hi - lo < 15) { const c = (lo + hi) / 2; lo = Math.max(0, Math.floor((c - 8) / 5) * 5); hi = lo + (lo === 0 ? 20 : 16); }
  const x0 = 30, x1 = W - 16, top = 10, bot = H - 26;
  const X = (tt) => x0 + ((tt - t0) / (t1 - t0)) * (x1 - x0);
  const Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += (hi - lo) > 30 ? 10 : 5) ticks.push(v);
  const PARTIES = [[1, "alp", "var(--alp)"], [2, "lnp", "var(--lnp)"], [3, "onp", "var(--onp)"]];
  /* the wave's own marker goes at its fieldwork midpoint (gen-data's
     fmid), not its release stamp – the line is fieldwork-timed, so the
     dot must be too; release dates sit right of every fieldwork window */
  const cx = X(rdApDays(p.fmid || p.released || p.published || t1));
  const lab = (D.issues.labels && D.issues.labels[iss.top]) || iss.top;
  return (
    <div ref={box} className="rd-apd-mini">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`The share of those naming one of the three parties rating each of Labor, the Coalition and One Nation best on ${lab}, month by month, and this wave’s own figures on the same basis.`}>
        {ticks.map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className={v === 0 ? "rd-apd-even" : "rd-apd-gl"}></path>)}
        {ticks.map((v) => <text key={"t" + v} x={x0 - 6} y={Y(v) + 4} className="rd-apd-ax" textAnchor="end">{rdApTick(v)}</text>)}
        {PARTIES.map(([i, , ink]) => (
          <path key={i} d={monotoneXY(rows.map((r) => [X(rdApDays(r[0] + "-15")), Y(r[i])]))} className="rd-apd-avgline" style={ink ? { stroke: `color-mix(in oklab, ${ink} 78%, transparent)` } : null}></path>
        ))}
        {own && PARTIES.map(([, k, ink]) => own[k] != null && (
          <g key={k}>
            <circle cx={cx} cy={Y(own[k])} r="7" className="rd-apd-ring" style={ink ? { stroke: ink } : null}></circle>
            <circle cx={cx} cy={Y(own[k])} r="3.5" className="rd-apd-this" style={ink ? { fill: ink } : null}></circle>
          </g>
        ))}
        <path d={`M${x0} ${bot}H${x1}`} className="rd-apd-base"></path>
        {ms.map((ym, i) => (i % 2 === (ms.length - 1) % 2 ? (
          <text key={ym} x={X(rdApDays(ym + "-01"))} y={bot + 18} className="rd-apd-ax" textAnchor="middle">{D.monthName(Number(ym.slice(5)))}</text>
        ) : null))}
      </svg>
    </div>
  );
}

function RdApDetail({ p, onM, pub, today, winN, facet, onBack, backLabel, demSplit, setDemSplit, onFacet }) {
  const D = window.AUSPOL;
  const d = p.dir;

  /* how it counts */
  const contest = onM ? "onp" : "lnp";
  const fig = rdApFig(p, onM, pub);
  const moe = rdPollMargin(p, contest, pub);
  const lean = p.lean;
  /* the other polls around it (gen-data §3c), and the gap once this house's
     lean as of the poll is taken out - the gap the margin is about: a
     house's standing lean is no surprise in any one of its polls. Both on
     the figures as printed (one decimal), so the steps add up */
  const yd = rdApYd(p, onM, pub);
  const ydHe = yd && yd.he != null ? rdApR1(yd.he) : null;
  const adj = lean != null && ydHe != null ? rdApR1(lean - ydHe) : null;
  const sideOf = (v) => (v > 0 ? "Labor’s" : onM ? "One Nation’s" : "the Coalition’s");
  const HL = D.houseLean || {};
  const hlKey = pub ? (onM ? "onpub" : "tpp") : (onM ? "onimp" : "imp");
  const hs = (HL[hlKey] || {})[p.pollster];
  const hl = hs && hs.length ? hs[hs.length - 1].v : null;
  const effKey = pub ? (onM ? "onp" : "lnp") : (onM ? "onimp" : "imp");
  const eff = p.eff && p.eff[effKey];
  const move = (e) => rdApSigned(Math.round((e.hi - e.lo) * 10) / 10);
  const inside = rdApInside(ydHe != null ? adj : lean, moe);
  const yr = p.year != null ? p.year : Number(String(p.released).slice(0, 4));
  const report = "/feedback/?msg=" + encodeURIComponent(`${p.pollster}, ${p.fieldPending ? "TBC" : p.field} ${yr} – `);
  const from = D.MONTHS[Math.max(0, D.MONTHS.indexOf(p.ym) - 6)];
  /* on the direction facet the rail counts toward the DIRECTION headline
     instead: same steps, read off the national-direction series - the
     other readings around it are the average (gen-data's dir.yd, the
     headline's net read at its fieldwork midpoint without it), the house
     lean is this house's right lean minus its wrong lean then, and the
     footprint is the wave's share of today's net nowcast (gen-data's
     dir.eff). The margin reuses the estimator's pq for a net. */
  const isDir = facet === "direction";
  const dirNow = isDir ? D.directionNow || null : null;
  const dEff = isDir && d ? d.eff || null : null;
  const dYd = isDir && d ? d.yd || null : null;
  const dirLean = d && dYd ? rdApR1(d.net - rdApR1(dYd.v)) : null;
  const dirHe = dYd ? rdApR1(dYd.he) : null;
  const dirAdj = dirLean != null && dirHe != null ? rdApR1(dirLean - dirHe) : null;
  const dirMoe = (() => {
    if (!d || !p.sample) return null;
    const pq = Math.max(0, 100 * (d.right + d.wrong) - d.net * d.net);
    return 1.96 * Math.sqrt(pq / (p.sample / rdApDeff()));
  })();
  const insideD = rdApInside(dirHe != null ? dirAdj : dirLean, dirMoe);
  const dirWay = (v) => (v > 0 ? "right-direction" : "wrong-track");
  const dirHl = isDir && d ? (((D.directionHouseEffects || {}).net || {})[p.pollster] || null) : null;
  /* on the issues facet the rail tells the issues story instead: how the
     wave's questions were put to voters (iss.q), the wording gap between
     the two pooled houses' question forms (plus.pair, the wave's half of a
     halved split), this house's lean on the leading party's share
     (plus.lean), and whether the wave sits inside the six-week window
     today's "The issues" panel draws on (plus.w). SEC Newgate's unprompted
     concerns bank and every wave's raw printed shares aren't pooled, so
     their leans don't exist and aren't pretended at. */
  const isIss = facet === "issues";
  const iss = isIss ? p.iss || null : null;
  const issPlus = iss && iss.plus ? iss.plus : null;
  const issPair = issPlus && issPlus.pair != null ? issPlus.pair : null;
  const issLeadMeta = issPlus && issPlus.lead ? window.ISS_PARTY_META[issPlus.lead] || null : null;
  const issPrompted = !!(iss && iss.sal && iss.sal.length);
  /* on the leadership facet the rail counts the NET GAP instead: Albanese's
     net rating minus each rival's, only ever on the one question a wave put
     to both names (approval with approval, favourability with favourability -
     rdApLdPairs enforces it), so a favourability-only wave charts and reads
     as favourability. The lean is the house-effects difference on the two
     slots, the same figures the Leadership dot-plot corrects with. */
  const isLd = facet === "leadership";
  const ldOwn = isLd ? rdApLdPairs(p.appr) : [];
  const ldWin = isLd && ldOwn.length ? rdApLdWindow(p) : null;
  const ldWord = ldWin && ldWin.waves.length ? rdApLdWord(ldWin.waves) : null;
  /* the caption names every rival the window's dots are set against, in the
     order they held the job ("Ley then Taylor" across Feb 2026) - this
     poll's names alone mislabelled the earlier dots */
  const ldNames = (() => {
    if (!ldWin || !ldWin.waves.length) return ldOwn.map((pr) => pr.name);
    const byRiv = {};
    [...ldWin.waves].sort((a, b) => a.q.released.localeCompare(b.q.released)).forEach((w) => w.pairs.forEach((pr) => {
      const l = byRiv[pr.riv] || (byRiv[pr.riv] = []);
      if (!l.includes(pr.name)) l.push(pr.name);
    }));
    return RD_AP_LD_RIVALS.filter((R) => byRiv[R.riv]).map((R) => byRiv[R.riv].join(" then "));
  })();
  /* the caption's metric word is a toggle when the house prints BOTH
     questions: approvals are its primary (metricOf is firm-steady, so every
     window wave's pair is approval) and at least one window wave carries the
     release's second favourability reading (appr.alt, Resolve's likeability
     column). Clicking flips the word and the chart to that other question */
  const ldAltWin = !!(ldWin && ldWin.waves.some((w) => rdApLdAltPairs(w.q.appr).length));
  const ldBoth = !!(ldAltWin && ldWin.waves.every((w) => w.pairs.every((pr) => pr.met === "approval")));
  const [ldMet, setLdMet] = React.useState(null);
  React.useEffect(() => { setLdMet(null); }, [p.pollster, p.released]);
  const ldAct = ldBoth ? (ldMet || "approval") : null;
  const ldHe = isLd ? (D.houseEffects && D.houseEffects.appr) || null : null;
  const ldLean = isLd && ldHe ? ldOwn.map((pr) => {
    const hA = (ldHe.alb || {})[p.pollster], hR = (ldHe[pr.R.he] || {})[p.pollster];
    return hA && hR ? { name: pr.name, met: pr.met, v: hA.v - hR.v } : null;
  }) : [];
  /* each gap against the same gap from the other polls around it
     (gen-data §4c), on the figures as printed, and with this house's lean
     on the gap as of the poll taken out */
  const ldCmp = ldOwn.map((pr) => {
    const y = (p.ldYd || {})[pr.riv + "|" + (pr.met === "fav" ? "fav" : "net")];
    if (!y) return null;
    const og = rdApR1(y.v), he = rdApR1(y.he), delta = rdApR1(pr.gap - og);
    return { ...pr, og, he, delta, adj: rdApR1(delta - he) };
  });
  const ldNow = isLd && D.leaderNow ? ldOwn.map((pr) => {
    const suf = pr.met === "fav" ? "_fav" : "_net";
    const A = D.leaderNow["alb" + suf], R = D.leaderNow[pr.R.ln + suf];
    // /vic/: "now" is the CURRENT holders' figures, so it names them, not the poll's
    const nm = window.JUR ? (D.LEADERS.find((l) => l.id === pr.R.ln) || {}).short || pr.name : pr.name;
    return A && R && A.v != null && R.v != null ? { name: nm, met: pr.met, gap: A.v - R.v, a: A.v, o: R.v } : null;
  }) : [];
  /* on the demographics facet the poll's whole table leads, full width, as
     the house printed it: every cut, the parties in the row's aggregate
     order, the two groups the row compares marked, a figure shaded where the
     group sits five or more points above the poll's all-voters figure and
     faded five or more below (shading computed on the unrounded values),
     and every figure printed with the house's own decimal via rdApNum -
     Roy Morgan's table prints halves (NSW One Nation 26.5), so rounding
     them would betray the heading's printed-it promise. Laid out in three
     columns balanced by row count on a laptop and one on a phone, where the
     later columns drop their repeated heads */
  const isDem = facet === "demographics";
  const demTable = (() => {
    if (!isDem || !p.grp || !p.grp.d) return null;
    const K = ["alp", "lnp", "grn", "onp", "oth"];
    const cols = rdApPrimList((D.latest && D.latest.primaryOrder) || RD_AP_PRIM_FALLBACK);
    const tot = p.grp.t || null;
    const pr = window.demPairOf(p, demSplit);
    const DN = { gender: "Gender", age: "Age", generation: "Generation", education: "Education", income: "Income", working: "Working status", state: "State", location: "Location", housing: "Housing", language: "Language at home", country: "Birth country", religion: "Religion", children: "Children at home", class: "Self-assessed class" };
    const cell = (v, k) => {
      const t = tot ? tot[K.indexOf(k)] : null;
      const d = v != null && t != null ? v - t : 0;
      return <span role="cell" className={"rd-apd-dv" + (d >= 5 ? " hi" : d <= -5 ? " lo" : "")}>{v == null ? "—" : rdApNum(v)}</span>;
    };
    const dims = Object.entries(p.grp.d);
    const per = Math.ceil(dims.reduce((a, [, r]) => a + r.length + 1, 0) / 3);
    const split = [[], [], []];
    let ci = 0, n = 0;
    for (const dm of dims) {
      if (n > 0 && n + dm[1].length + 1 > per + 1 && ci < 2) { ci++; n = 0; }
      split[ci].push(dm);
      n += dm[1].length + 1;
    }
    const head = <div className="rd-apd-demr rd-apd-demh" role="row"><span></span>{cols.map((k) => <span key={k.id} role="columnheader" style={{ color: k.ink }}>{k.lab}</span>)}</div>;
    const all = tot && <div className="rd-apd-demr rd-apd-demall" role="row"><span role="rowheader">All voters</span>{cols.map((k) => { const tv = tot[K.indexOf(k.id)]; return <span key={k.id} role="cell">{tv == null ? "—" : rdApNum(tv)}</span>; })}</div>;
    return (
      <div className="rd-apd-demwrap">
        <span className="rd-apd-h">The vote by group, {p.grp.r === "measured from the charts" ? "measured off " + p.pollster + "’s charts" : "as " + p.pollster + " printed it"}</span>
        <div className="rd-apd-demcols">
          {split.filter((c) => c.length).map((c, i) => (
            <div key={i} className="rd-apd-dem" role="table" aria-label={"The vote by group" + (i ? ", continued" : "")}>
              {head}{all}
              {c.map(([dim, rows]) => (
                <React.Fragment key={dim}>
                  <div className="rd-apd-demsub" role="row"><span role="rowheader">{DN[dim] || dim}</span></div>
                  {rows.map(([lab, v]) => (
                    <div key={lab} className={"rd-apd-demr" + (pr && (lab === pr.a || lab === pr.b) ? " on" : "")} role="row">
                      <span role="rowheader">{lab}</span>
                      {cols.map((k) => <React.Fragment key={k.id}>{cell(v[K.indexOf(k.id)], k.id)}</React.Fragment>)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        <span className="rd-apd-sub rd-apd-note">Primary vote within each group, %. Shaded: five points or more above the poll’s all-voters figure; faded: five or more below.{pr ? " Marked: " + pr.a + " and " + pr.b + ", the two groups the row compares." : ""}</span>
      </div>
    );
  })();
  /* …and How it counts tells that table's story: what the house printed,
     which of its groups feed the pooled Who votes for whom figures (the rest
     are cut in ways no other house matches - their parts merged into a
     pooled group, like YouGov's SA, WA and ACT/NT/Tas into the rest of
     Australia, aren't counted as staying out), and whether it sits in the
     panel's six-week window today */
  const demFacts = (() => {
    if (!isDem || !p.grp) return null;
    const G = D.demoGroups || [];
    const raw = Object.values(p.grp.d || {}).flatMap((rows) => rows.map((r) => r[0]));
    const pooled = (p.grp.v || []).map((v, i) => (v ? G[i] : null)).filter(Boolean);
    const MERGED = ["Below Year 12", "Year 12", "School", "TAFE", "TAFE or college", "SA", "WA", "ACT/NT/Tas"];
    const alone = raw.filter((l) => !pooled.includes(l) && !MERGED.includes(l));
    const T = D.demographics || {};
    const base = (n) => (n === "RedBridge" ? "RedBridge/Accent" : n);
    const inWin = (T.polls || []).some((q) => base(q.pollster) === p.pollster && q.dateLabel === p.field);
    const nCuts = Object.keys(p.grp.d || {}).length;
    return <>
      <span className="rd-apd-k">Printed</span>
      <span>{raw.length} groups across {rdNumWord(nCuts)} breakdown{nCuts === 1 ? "" : "s"}, {p.grp.r === "measured from the charts" ? "read off its charts to the nearest point" : "from its own table"}.</span>
      <span className="rd-apd-k">In Who votes for whom</span>
      {/* a model taken to reuse its house's own polls (gen-data reusesWaves)
          joins nothing for that reason, not for how it cuts its groups */}
      {p.grp.x === "reuse"
        ? <span>None of its groups joins the pooled figures: its fieldwork contains {p.pollster.replace(/ \(MRP\)$/, "")}’s own regular polls, whose groups already count, and it is taken to reuse their respondents.</span>
        : <span>{pooled.length ? <>{pooled.length} of its groups join</> : "None of its groups joins"} the pooled figures{alone.length ? <>; {rdApLdJoin(alone)} {alone.length === 1 ? "stays" : "stay"} here alone, since no other pollster draws {alone.length === 1 ? "that group" : "those groups"} the same way</> : ""}.</span>}
      {T.window && <>
        <span className="rd-apd-k">In today’s figures</span>
        <span>{inWin ? <>One of the polls the panel’s current figures draw on (the last {T.window}).</> : <>Outside the {T.window} the panel’s current figures draw on.</>}</span>
      </>}
    </>;
  })();

  /* on the confidence facet the rail tells the gauge's own story: what it
     measures, the neutral figure as printed, and whether this release is
     the one today's economic-sentiment panel heads with. The series is the
     publisher's own (§5j), so there is no aggregate or lean to count toward */
  const isConf = facet === "confidence";
  const conf = isConf ? p.conf || null : null;
  const confSer = (conf && D.confidence && D.confidence[conf.k]) ? D.confidence[conf.k] : null;
  const confFmt = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const outLabel = (q) => { const d = new Date(rdApDays(q.released)); return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1); };
  const confPeriod = !conf ? "month" : conf.k === "consumer" ? "week" : "month";
  /* the change the detail sentence quotes: the release's printed move,
     else the measured move on the lane's previous release (chgCalc) -
     flagged calculated, so the line never poses as the house's print */
  const confEf = !conf ? null
    : conf.chg != null && Math.abs(conf.chg) >= 0.05 ? { v: conf.chg, calc: false }
    : conf.chgCalc != null && Math.abs(conf.chgCalc) >= 0.05 ? { v: conf.chgCalc, calc: true }
    : null;
  const CONF_BLURB = {
    consumer: "Consumer confidence – who feels optimistic about their finances and the economy, read weekly by ANZ–Roy Morgan.",
    westpacConsumer: "The Westpac–Melbourne Institute’s monthly gauge of household sentiment – the same territory as the weekly consumer index on a slower clock.",
    business: "Business confidence – how firms rate trading conditions and the year ahead, read monthly by Roy Morgan.",
    nabBusiness: "Business confidence as a net balance – optimistic firms minus pessimistic ones – from NAB’s monthly business survey.",
  };

  /* on the issues facet the poll's every issue leads the opened poll: where
     voters ranked it among the issues that matter most (where the poll
     asked), the share ranking it first where the poll printed that (the
     figure the other tabs' issues line can't carry), and the four parties'
     printed best-party shares with the party in front shaded. Shares keep
     the decimal the house printed (Resolve's data prints them), so the
     row's rounded lead is always the difference a reader can take here */
  let issTwo = false;
  const issTable = (() => {
    if (!isIss || !p.iss) return null;
    const iq = p.iss;
    const labels = (D.issues && D.issues.labels) || {};
    const ranked = (iq.sal && iq.sal.length ? iq.sal : iq.conc || []).map(([lab, v, r1], i) => ({ id: window.ISS_ALIAS[lab] || null, lab, v, r1: r1 != null ? r1 : null, rank: i + 1 }));
    const seen = new Set(ranked.map((r) => r.id).filter(Boolean));
    const ownIds = Object.keys(iq.own || {}).concat(iq.bp && !(iq.own && iq.own.col) ? ["col"] : []);
    const pooled = ((D.issues && D.issues.list) || []).map((x) => x.id);
    const order = pooled.filter((id) => ownIds.includes(id)).concat(ownIds.filter((id) => !pooled.includes(id)));
    const rows = ranked.concat(order.filter((id) => !seen.has(id)).map((id) => ({ id, lab: labels[id] || id, v: null, r1: null, rank: null })));
    const hasR1 = rows.some((r) => r.r1 != null);
    const ownOf = (r) => (r.id ? window.issOwnOf(p, r.id) : null);
    const unsure = (o) => { const u = ["unsure", "none", "equal"].filter((k) => o && o[k] != null); return u.length ? u.reduce((a, k) => a + +o[k], 0) : null; };
    /* only the columns this poll fills: Resolve offers no Greens (and no One
       Nation before March), SEC Newgate prints no unsure figure */
    const cols = rdApPrimList((D.latest && D.latest.primaryOrder) || RD_AP_PRIM_FALLBACK).filter((k) => k.id !== "oth" && rows.some((r) => { const o = ownOf(r); return o && o[k.id] != null; }));
    const hasUnsure = rows.some((r) => unsure(ownOf(r)) != null);
    const hasRank = ranked.length > 0;
    const nNum = (hasRank ? 1 : 0) + (hasR1 ? 1 : 0) + cols.length + (hasUnsure ? 1 : 0);
    // the column widths live in rd.css (--isr-*); which columns there are, here
    const tracks = ["minmax(0, 1fr)"].concat(hasRank ? ["var(--isr-rk)"] : [], hasR1 ? ["var(--isr-p)"] : [], cols.map(() => "var(--isr-p)"), hasUnsure ? ["var(--isr-u)"] : []);
    // a long list splits in two side by side - only when the figures are few enough to leave each half room for the names
    const parts = rows.length > 9 && nNum <= 4 ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows];
    issTwo = parts.length === 2;
    const ordTxt = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
    const rc = "rd-apd-demr rd-apd-isr" + (hasRank ? " rk" : "");
    const head = <div className={rc + " rd-apd-demh"} role="row"><span></span>{hasRank && <span role="columnheader">Ranked</span>}{hasR1 && <span role="columnheader" title="The share ranking it the issue that matters most">First</span>}{cols.map((k) => <span key={k.id} role="columnheader" style={{ color: k.ink }}>{k.lab}</span>)}{hasUnsure && <span role="columnheader">Unsure</span>}</div>;
    return (
      <div className="rd-apd-demwrap">
        <span className="rd-apd-h">Issue by issue</span>
        <div className={"rd-apd-demcols " + (parts.length === 2 ? "two" : "one")}>
          {parts.map((part, i) => (
            <div key={i} className={"rd-apd-dem isn" + nNum} role="table" aria-label={"Issue by issue" + (i ? ", continued" : "")}
              style={{ "--isr-cols": tracks.join(" "), "--isr-n": nNum }}>
              {head}
              {part.map((r) => {
                const o = ownOf(r);
                const L = o ? window.issLeadOf(o) : null;
                const u = unsure(o);
                return (
                  <div key={r.lab} className={rc} role="row">
                    <span role="rowheader">{r.lab}</span>
                    {hasRank && <span role="cell" className="rd-apd-dv">{r.rank ? ordTxt(r.rank) + " · " + rdApNum(r.v) : "—"}</span>}
                    {hasR1 && <span role="cell" className="rd-apd-dv">{r.r1 != null ? rdApNum(r.r1) : "—"}</span>}
                    {cols.map((k) => { const lead = L && !L.level && L.who === k.id; return <span key={k.id} role="cell" className={"rd-apd-dv" + (lead ? " lead" : "")} style={lead ? { "--lead": k.dot } : null}>{o && o[k.id] != null ? rdApNum(o[k.id]) : "—"}</span>; })}
                    {hasUnsure && <span role="cell" className="rd-apd-dv">{rdApNum(u)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <span className="rd-apd-sub rd-apd-note">{iq.sal && iq.sal.length ? "Ranked: the issue’s place among those voters said matter most, and the share naming it" + (hasR1 ? "; First: the share naming it the one that matters most. " : ". ")
          : iq.conc ? "Ranked: the issue’s place among concerns named without prompting, and the share mentioning it. " : "This poll didn’t ask which issues matter most. "}
          The party columns are each party’s share of all respondents, as printed.{iq.q ? <> The question’s wording: “{iq.q}”{/[.?…]$/.test(iq.q) ? "" : "."}</> : ""} The party in front is shaded.</span>
      </div>
    );
  })();
  /* the gauge leads its own facet: the figure as printed, its move on the
     publisher's previous release, and what neutral is on its scale */
  const confLead = conf && (
    <section className="rd-ldg-sec" data-sec="confidence">
      <h4 className="rd-ldg-h">{conf.lab}</h4>
      <div className="rd-ldg-conf"><b>{confFmt(conf.v)}</b>{confEf ? <span>{", " + (confEf.v < 0 ? "down " : "up ") + confFmt(Math.abs(confEf.v)) + " on the " + confPeriod + (confEf.calc ? " (calculated – the release printed no change)" : "")}</span> : null}</div>
      <p className="rd-ldg-foot1">{conf.vs === 0 ? "Net balance, optimistic minus pessimistic – 0 neutral." : "Index reading – 100 neutral."}{conf.cond != null ? " NAB prints business conditions beside it: " + confFmt(conf.cond) + (conf.condChg != null && Math.abs(conf.condChg) >= 0.05 ? ", " + (conf.condChg < 0 ? "down " : "up ") + confFmt(Math.abs(conf.condChg)) + " on the month" : "") + "." : ""}</p>
    </section>
  );

  /* ---- How it counts. Where the facts are arithmetic (2PP, Leadership,
     Direction) they read as a reckoning: one row a step, signed as the
     table's own Lean and House lean columns are (+ toward Labor, toward
     Albanese, toward right-direction), so the sum checks down the column.
     Primary has its own (RdApPrimRail); Issues, Demographics and
     Confidence explain rather than count, so they keep their sentences */
  const rk = (lab, v, words, ink) => (
    <tr key={lab}><th scope="row">{lab}</th><td className="num"><b style={ink ? { color: ink } : null}>{v}</b></td><td>{words}</td></tr>
  );
  const r1s = (v) => (v == null ? "—" : rdApSigned(v));
  const outside = p.noAgg ? <p className="rd-ldg-noagg"><b>Outside the aggregates.</b> {p.noAggWhy || "Because SMS polls have a strong selection bias, they do not count towards any aggregates."}</p> : null;
  /* the single-territory readings the wave also carries (sentence built
     beside sampleValue so every band voices it the one way) */
  const solo = p.solo && window.soloNote ? <div className="rd-apd-facts"><span className="rd-apd-k">Territory readings</span><span>{window.soloNote(p)}</span></div> : null;
  const tppReckon = fig.a != null && (
    <table className="rd-ldg-t rd-ldg-rk"><tbody>
      {rk("This poll", fig.a.toFixed(1), "Labor v " + (onM ? "One Nation" : "Coalition") + (pub ? ", published" : ", implied"))}
      {yd ? rk(RD_AP_KAL ? "The trend" : "Polls around it", yd.v.toFixed(1), RD_AP_KAL ? "the other polls’ trend" : (yd.n === 1 ? "one other poll" : rdNumWord(yd.n) + " others") + ", within three weeks")
          : rk("Polls around it", "—", "none fielded within three weeks, so nothing to set it against")}
      {yd && lean != null && rk("Lean", r1s(lean), (Math.abs(lean) < 0.05 ? "level with them" : sideOf(lean) + " way") + (ydHe == null && inside ? ", " + inside + " its ±" + moe.toFixed(1) + " margin" : ""), rdApLeanInk(lean, onM))}
      {rk("House lean", ydHe != null ? r1s(ydHe) : hl != null ? r1s(rdApR1(hl)) : "—",
          ydHe != null || hl != null ? "taken out before averaging" : "not measured yet: too few polls", rdApLeanInk(ydHe != null ? ydHe : hl, onM))}
      {ydHe != null && lean != null && Math.abs(ydHe) >= 0.05 && rk("Less house lean", r1s(adj), inside ? inside[0].toUpperCase() + inside.slice(1) + " its ±" + moe.toFixed(1) + " margin" : (Math.abs(adj) < 0.05 ? "level" : sideOf(adj) + " way"), rdApLeanInk(adj, onM))}
      {today && !p.noAgg && rk("In today’s " + today.a.toFixed(1), eff && eff.w ? move(eff) : eff && eff.t ? move(eff.t) : "—",
          eff && eff.w ? "how far it moves it, as one of " + rdNumWord(winN)
            : eff && eff.t ? "out of the window now; it moved it this far" : "out of the window: the last three weeks only")}
    </tbody></table>
  );
  const ldReckon = ldOwn.length > 0 && (
    <table className="rd-ldg-t rd-ldg-rk rd-ldg-rk2"><thead><tr><th></th>{ldOwn.map((pr) => <th key={pr.riv} className="num">v {pr.name}</th>)}<th></th></tr></thead><tbody>
      <tr><th scope="row">This poll</th>{ldOwn.map((pr) => <td key={pr.riv} className="num"><b>{r1s(rdApR1(pr.gap))}</b></td>)}<td>{rdApPm(p.appr)}’s net minus each rival’s</td></tr>
      {ldCmp.some(Boolean) && <>
        <tr><th scope="row">Polls around it</th>{ldCmp.map((c, i) => <td key={i} className="num"><b>{c ? r1s(c.og) : "—"}</b></td>)}<td>the same gap elsewhere</td></tr>
        <tr><th scope="row">Lean</th>{ldCmp.map((c, i) => <td key={i} className="num"><b>{c ? r1s(c.delta) : "—"}</b></td>)}<td>+ is {rdApPm(p.appr)}’s way</td></tr>
        <tr><th scope="row">House lean</th>{ldCmp.map((c, i) => <td key={i} className="num"><b>{c ? r1s(c.he) : "—"}</b></td>)}<td>taken out before averaging</td></tr>
        <tr><th scope="row">Less house lean</th>{ldCmp.map((c, i) => <td key={i} className="num"><b>{c ? r1s(c.adj) : "—"}</b></td>)}<td></td></tr>
      </>}
      {!ldCmp.some(Boolean) && ldLean.filter(Boolean).length > 0 && <tr><th scope="row">House lean</th>{ldOwn.map((pr, i) => { const l = ldLean[i]; return <td key={pr.riv} className="num"><b>{l ? r1s(rdApR1(l.v)) : "—"}</b></td>; })}<td>its usual lean on the gap</td></tr>}
      {ldNow.filter(Boolean).length > 0 && <tr><th scope="row">Now</th>{ldNow.map((n, i) => <td key={i} className="num"><b>{n ? r1s(rdApR1(n.gap)) : "—"}</b></td>)}<td>today’s figures{ldOwn.some((pr) => pr.met === "fav") ? ", each on its own question" : ""}</td></tr>}
    </tbody></table>
  );
  const dirReckon = d && (
    <table className="rd-ldg-t rd-ldg-rk"><tbody>
      {rk("This reading", r1s(d.net), "right direction minus wrong track")}
      {dYd ? rk("Readings around it", r1s(rdApR1(dYd.v)), (dYd.n === 1 ? "one other reading" : rdNumWord(dYd.n) + " others") + ", within three weeks")
           : rk("Readings around it", "—", "none taken within three weeks")}
      {dirLean != null && rk("Lean", r1s(dirLean), (Math.abs(dirLean) < 0.05 ? "level with them" : "more " + dirWay(dirLean)) + (dirHe == null && insideD ? ", " + insideD + " its ±" + dirMoe.toFixed(1) + " margin" : ""), dirLean > 0 ? "var(--mood-pos)" : dirLean < 0 ? "var(--mood-neg)" : null)}
      {rk("House lean", dirHe != null ? r1s(dirHe) : dirHl ? r1s(rdApR1(dirHl.v)) : "—", dirHe != null || dirHl ? "taken out before averaging" : "not measured yet: too few readings")}
      {dirHe != null && Math.abs(dirHe) >= 0.05 && dirAdj != null && rk("Less house lean", r1s(dirAdj), insideD ? insideD[0].toUpperCase() + insideD.slice(1) + " its ±" + dirMoe.toFixed(1) + " margin" : (Math.abs(dirAdj) < 0.05 ? "level" : "more " + dirWay(dirAdj)), dirAdj > 0 ? "var(--mood-pos)" : dirAdj < 0 ? "var(--mood-neg)" : null)}
      {dirNow && rk("In today’s " + rdApSigned(dirNow.net), dEff && dEff.w ? move(dEff) : dEff && dEff.t ? move(dEff.t) : "—",
          dEff && dEff.w ? "how far it moves it, as one of " + rdNumWord(dirNow.n) : dEff && dEff.t ? "out of the window now; it moved it this far" : "out of the window: the last three weeks only")}
    </tbody></table>
  );
  const since = D.monthNameFull(Number(from.slice(5)));
  let railBody;
  if (isConf) {
    railBody = conf && <>
      {confSer && <>
        <span className="rd-apd-ct">{p.pollster}’s {conf.lab} releases since {since}, as published — no average; the gauge is the publisher’s own series</span>
        <RdApConfMini p={p} />
      </>}
      <div className="rd-apd-facts">
        <span className="rd-apd-k">The gauge</span>
        <span>{CONF_BLURB[conf.k] || conf.lab + "."}</span>
        <span className="rd-apd-k">Neutral</span>
        <span>{conf.vs === 0
          ? <>Printed as a net balance – optimists minus pessimists – so the neutral print is 0. This table and the economic-sentiment panel both draw it 100 points up, so its 0 sits on the indices’ neutral 100.</>
          : <>An index print – 100 is neutral; above it optimists outnumber pessimists{confPeriod === "week" ? ", read weekly" : ""}.</>}</span>
        <span className="rd-apd-k">In today’s panel</span>
        <span>{confSer && confSer.latest && confSer.latest.released === p.released
          ? <>This is the latest {conf.lab} release, so the economic-sentiment panel reads the gauge at it.</>
          : confSer && confSer.latest
            ? <>The panel’s current read of this gauge is the {outLabel(confSer.latest)} release at {confFmt(confSer.latest.v)}{confSer.latest.url ? <>, <a className="rd-link rd-link-in" href={confSer.latest.url} onClick={(e) => e.stopPropagation()}>its source<span className="rd-apd-ext" aria-hidden="true">↗</span></a></> : ""}.</>
            : <>The gauge’s series carries no published releases to panel against.</>}</span>
      </div>
    </>;
  } else if (isDem) {
    railBody = demFacts && <div className="rd-apd-facts">{demFacts}</div>;
  } else if (isIss) {
    railBody = iss && <>
      {D.issues && iss.own && iss.own[iss.top] && (() => {
        const cLab = (D.issues.labels && D.issues.labels[iss.top]) || iss.top;
        // sentence case mid-sentence, user call 2026-10-03 (the "Rated best on"
        // key case): the labels bank ships leading-capped, drop only the first letter
        const cTit = cLab.charAt(0).toLowerCase() + cLab.slice(1);
        return <>
          <span className="rd-apd-ct">Who voters rate best on {cTit} since {since}, the monthly pooled line and this wave’s own figures on the same basis — shares of those naming one of the three parties</span>
          <RdApIssMini p={p} />
        </>;
      })()}
      <div className="rd-apd-facts">
        <span className="rd-apd-k">Asked</span>
        <span>{issPrompted
          ? <>Voters picked the three issues that matter most{iss.q ? <> – {p.pollster}’s wording: “{iss.q}”</> : p.pollster === "Ipsos" ? " – Ipsos asks its standing list of 19 issues, best party on the month’s five leaders" : ""}. SEC Newgate’s mentions count can’t sit in the same series, so each house’s wording is pooled against its pair first.</>
          : iss.conc
            ? <>SEC Newgate asks what concerns Australians, unprompted – anyone can name anything, so the shares are any-mentions, not forced picks. That reading can’t mix with the top-three series the issues panel pools, so it isn’t counted toward it.</>
            : <>{p.pollster} asked only who’d be best on each issue{iss.q ? <> – its wording: “{iss.q}” –</> : ","} not which issues matter most, so this wave feeds the pooled best-party line and there’s no top-three list for it to join.</>}</span>
        {issPair != null && <>
          <span className="rd-apd-k">Between the question forms</span>
          <span>RedBridge’s and Ipsos’s wordings for what matters sit a measured <b>{Math.abs(issPair).toFixed(1)}</b> points apart on {((D.issues.labels && D.issues.labels[iss.top]) || iss.top)}; this wave’s reading was moved half that gap toward the other house’s before it entered any average.</span>
        </>}
        {issLeadMeta && <>
          <span className="rd-apd-k">{rdApBreakable(p.pollster)}’s house lean</span>
          <span>{issPlus.lean == null ? "None to speak of: its figures sit level with the other pollsters’"
            : <>About <b>{Math.abs(issPlus.lean).toFixed(1)}</b> {issPlus.lean > 0 ? "richer" : "poorer"} for {issLeadMeta[0]} on {((D.issues.labels && D.issues.labels[iss.top]) || iss.top)}, taken out before the figures are pooled</>}</span>
        </>}
        {issPlus && D.issues.window && <>
          <span className="rd-apd-k">In today’s panel</span>
          <span>{issPlus.w
            ? <>One of the waves the issues panel’s current figures draw on (the last {D.issues.window}).</>
            : <>Outside the {D.issues.window} the panel’s current figures draw on.</>}</span>
        </>}
      </div>
    </>;
  } else if (isLd) {
    railBody = ldOwn.length ? <>
      {ldWin && ldWin.waves.length > 0 && <>
        <span className="rd-apd-ct">{p.pollster}’s polls since {since} against the average – {ldBoth
          ? <button type="button" className="rd-apd-met"
                    aria-label={"Showing " + rdApLdMetWord(ldAct) + ". Switch to " + rdApLdMetWord(ldAct === "fav" ? "approval" : "fav")}
                    title={"Switch to " + rdApLdMetWord(ldAct === "fav" ? "approval" : "fav")}
                    onClick={(e) => { e.stopPropagation(); setLdMet(ldAct === "fav" ? "approval" : "fav"); }}>{rdApLdMetWord(ldAct)}</button>
          : ldWord}, {rdApPmOffice()} minus {rdApLdJoin(ldNames)}</span>
        <RdApLdMini p={p} met={ldAct} />
      </>}
      {ldReckon}
    </> : <div className="rd-apd-facts">
      <span className="rd-apd-k">Leader ratings</span>
      <span>{p.pollster} didn’t ask {rdApPm(p.appr)} and {p.appr && p.appr.oppName ? p.appr.oppName : "the opposition leader"} on the same question in this poll, so there’s no net-approval gap to set against the leadership figures.</span>
    </div>;
  } else if (isDir) {
    railBody = d ? <>
      <span className="rd-apd-ct">{p.pollster}’s readings since {since} against the average, net right direction minus wrong track</span>
      <RdApDirMini p={p} />
      {dirReckon}
    </> : <div className="rd-apd-facts">
      <span className="rd-apd-k">National direction</span>
      <span>{p.pollster} didn’t ask the direction question in this poll, so there’s no reading to set against the direction figures.</span>
    </div>;
  } else if (facet === "primary" && p.pyd) {
    railBody = <>{outside}<RdApPrimRail p={p} />{solo}</>;
  } else {
    railBody = fig.a != null ? <>
      <span className="rd-apd-ct">{p.pollster}’s polls since {since} against the {RD_AP_AVG}, Labor v {onM ? "One Nation" : "Coalition"}{pub ? " as published" : ""}</span>
      <RdApMini p={p} onM={onM} pub={pub} />
      {outside}
      {tppReckon}
      {solo}
    </> : <>
      {outside}
      <div className="rd-apd-facts">
        {p.solo && window.soloNote && <><span className="rd-apd-k">Territory readings</span><span>{window.soloNote(p)}</span></>}
        <span className="rd-apd-k">Two-party</span>
        <span>{fig.none[0].toUpperCase() + fig.none.slice(1)}, so this poll has no {pub ? "published" : "implied"} figure to set against the other polls.</span>
        <span className="rd-apd-k">{rdApBreakable(p.pollster)}’s house lean</span>
        <span>{hl == null ? "Not measured yet: too few polls on this contest"
          : Math.abs(hl) < 0.05 ? "None to speak of: it sits level with the other pollsters"
          : <><b>{Math.abs(hl).toFixed(1)}</b> to {hl > 0 ? "Labor" : onM ? "One Nation" : "the Coalition"}, taken out before the polls are averaged</>}</span>
      </div>
    </>;
  }
  const rail = (
    <div className="rd-apd-r">
      <span className="rd-apd-h">{isConf ? "How it reads" : "How it counts"}</span>
      {railBody}
    </div>
  );

  /* a line pressed: the table moves to that line's tab with this row held
     on its pixel (the row keeps its key across the hop, so it is the
     anchor that persists - pinning the table top would let the reshuffled
     rows carry it off). A line that's no tab at all (RD_LG_PANEL) trips out
     to its panel instead; the row stays open behind the tab that lent it. */
  const lineGo = (id, el) => {
    if (RD_LG_PANEL[id]) { rdLgPanelGo(id, p); return; }
    const open = el && el.closest(".rd-ap-open");
    const row = open && open.previousElementSibling;
    if (row) rdPinScroll([row], true);
    /* a demographics hop has to land on a split this poll can draw, or the
       hop opens the facet on rows the poll isn't in - demSplit survives
       facet hops by design, and a house that prints no age cut (Roy Morgan
       files city/country and one-offs) would vanish from its own trip.
       Same contract as the Who-votes dot trip and the line's own preview:
       keep the sitting split where it draws this poll, else the first
       split that does */
    if (id === "demographics" && setDemSplit && window.demPairOf && !window.demPairOf(p, demSplit)) {
      const fit = (window.DEM_SPLITS || []).find((x) => window.demPairOf(p, x.id));
      if (fit) setDemSplit(fit.id);
    }
    if (onFacet) onFacet(id);
  };
  return (
    <RdLedger p={p} facet={facet} onM={onM} side={rail}
              lead={isDem ? demTable : isIss ? issTable : isConf ? confLead : null}
              wide={isDem || (isIss && issTwo)}
              onLine={onFacet ? lineGo : null} demSplit={demSplit} moe={rdLgMoe(p)}
              sources={p.links && p.links.length > 0 ? rdPollLinks(p.links) : null}
              foot={<>
                <a className="rd-link" href={report} onClick={(e) => e.stopPropagation()}>Report an error</a>
                {onBack && <button type="button" className="rd-link" onClick={(e) => { e.stopPropagation(); onBack(); }}>Back to {backLabel || "the chart"}</button>}
              </>} />
  );
}

/* ---------------------------------------------------------------- the poll ledger
   One renderer for an opened poll, shared by the Latest and next polls
   table and All polls (user call 2026-10-11, design A of two mocked):
   - a head band: the poll's sentence, its sources and Report an error;
   - the open tab's own measure in full, beside its companion - How it
     counts in All polls, the release rhythm in the Latest table;
   - one line for each other measure the poll carries, in a fixed order,
     each giving the figures that measure's own tab shows in its row, a
     press away from that tab.
   Figures print as the house printed them (rdApNum keeps a half), and a
   change prints at the figure's own precision (rdLgChg). */

/* a change on the house's previous poll at the figure's printed precision:
   a move between halves prints its half (▼ 0.5) - whole-point rounding
   printed Roy Morgan's 54 → 53.5 as "▼ 0" (Math.round(-0.5) is -0) and a
   half-point rise as "▲ 1" */
const rdLgChg = (d, dec) => {
  if (d == null) return null;
  const r = Math.round(d * 10) / 10;
  return rdApChg(r, dec || (Number.isInteger(r) ? 0 : 1));
};
function RdLgChg({ d, dec }) { const s = rdLgChg(d, dec); return s ? <span className="rd-ldg-chg">{s}</span> : null; }
const RD_LG_LEADER = { alb: "Albanese", taylor: "Taylor", ley: "Ley", hanson: "Hanson" };
const RD_LG_INK = { alb: "var(--alp-text)", taylor: "var(--lnp-text)", ley: "var(--lnp-text)", hanson: "var(--onp-text)" };
const rdLgWho = (p, k) => apWho(p, k, RD_LG_LEADER[k] || rdCap(k));
// parties in the site aggregate's order, as every other party listing (user call 2026-10-03)
const rdLgPrims = () => rdApPrimList((window.AUSPOL.latest && window.AUSPOL.latest.primaryOrder) || RD_AP_PRIM_FALLBACK);
const rdLgNet = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v));
// the tab a line opens, named as the tab row names it
const RD_LG_TAB = { primary: "Primary", twopp: "2PP", leadership: "Leadership", direction: "Direction", issues: "Issues", demographics: "Demographics" };
const RD_LG_LATEST_TABS = { twopp: 1, primary: 1, leadership: 1 };
/* a line can also trip to somewhere that is no tab at all: the switching
   line goes to the snapshot's vote-switching panel (AP.gotoSwitching),
   the opinion line to the pollster's group on the Public opinion page
   (AP.gotoOpinion). tip is the destination named on the line's tooltip;
   onSnapshot marks a destination the Latest table shares its tab with,
   so only the archive's trip counts as away. */
const RD_LG_PANEL = {
  switching: { tip: "where One Nation’s voters came from", where: "the Snapshot", onSnapshot: true },
  opinion: { tip: "what else this poll asked", where: "Public opinion" },
};
const rdLgPanelGo = (id, p) => {
  if (id === "switching") return window.AP.gotoSwitching && window.AP.gotoSwitching();
  if (id === "opinion") {
    const bo = window.AUSPOL.beyondByRow && window.AUSPOL.beyondByRow[p.pollster + "|" + p.released];
    if (bo && window.AP.gotoOpinion) window.AP.gotoOpinion(bo.h);
  }
};
/* which poll a lead's change markers are measured on: the house's previous
   poll that printed each figure (gen-data's chg.r). One wave for the whole
   lead names it; a lead whose figures reach back to different waves (a
   house that skipped a question once) says so instead */
function rdLgChgNote(p, keys) {
  const r = (p.chg && p.chg.r) || {};
  const refs = [...new Set(keys.map((k) => r[k]).filter(Boolean))];
  if (!refs.length) return null;
  if (refs.length > 1) return "▲▼ Changes are on each figure’s previous " + p.pollster + " poll.";
  const prev = window.AUSPOL.individualPolls.find((x) => x.pollster === p.pollster && x.released === refs[0]);
  return prev ? "▲▼ Changes are on " + p.pollster + "’s " + prev.field + " poll." : null;
}

/* the two-party figures' 95% margins, one per basis the house printed (a
   range where its two contests' margins differ), with the sample they rest on */
function rdLgMoe(p) {
  const ms = [p.alpOnImp != null ? rdPollMargin(p, "onp", false) : null, p.alpImp != null ? rdPollMargin(p, "lnp", false) : null].filter((m) => m != null);
  const mp = [p.tppAlt ? rdPollMargin(p, "onp", true) : null, p.alp != null ? rdPollMargin(p, "lnp", true) : null].filter((m) => m != null);
  const rng = (a) => { const lo = Math.min(...a), hi = Math.max(...a); return "±" + (lo.toFixed(1) === hi.toFixed(1) ? lo.toFixed(1) : lo.toFixed(1) + "–" + hi.toFixed(1)); };
  const bits = [ms.length ? rng(ms) + " on the implied" : null, mp.length ? rng(mp) + " on the published" : null].filter(Boolean);
  return bits.length ? "Margin of error " + bits.join(", ") + (bits.length > 1 ? " figures" : " figure") + " at 95%, " + rdMarginBasis(p) + "." : null;
}

/* ---- the two-party section: one table, both matchups (the matchup in force
   first), every basis the house printed - its second published pair on
   2025 flows, a Coalition v One Nation pair and a three-cornered split
   where it printed them. A row the house filled in neither column never
   draws. The forced-choice 2025-cohort splits (RedBridge/Accent's tpp_split
   tables) ride the Preferences line in Also in this poll (RdLgFlowsLine),
   as DemosAU's MRP flows do */
function RdLgTpp({ p, onM, moe, note }) {
  const c = (p.chg && p.chg.d) || {};
  const ta = p.tppAlt;
  const pair = (a, b, ink) => <b className="rd-ldg-pair"><span style={{ color: "var(--alp-text)" }}>{a}</span><span className="rd-ldg-dash">–</span><span style={{ color: ink }}>{b}</span></b>;
  /* the rival's share as the house printed it where it printed one -
     Essential's pair leaves its undecided inside the hundred (48–46) -
     else the complement */
  const cell = (v, d, ink, dec, b) => (v == null ? <span className="rd-ldg-none">—</span>
    : <>{pair(rdApNum(v), rdApNum(b != null ? b : 100 - v), ink)}<RdLgChg d={d} dec={dec} /></>);
  const ON = { id: "onp", head: "v One Nation", ink: "var(--onp-text)" };
  const LN = { id: "lnp", head: "v Coalition", ink: "var(--lnp-text)" };
  const cols = onM ? [ON, LN] : [LN, ON];
  const pubLab = p.tppFlows != null ? "Published, respondent-allocated" : "As published";
  const rows = [
    ["Implied, on " + rdElecYear + " flows", { onp: p.alpOnImp != null ? [p.alpOnImp, c.impOn, 1] : null, lnp: p.alpImp != null ? [p.alpImp, c.imp, 1] : null }],
    [pubLab, { onp: ta ? [ta.alp, c.altAlpOn, 0, ta.onp] : null, lnp: p.alp != null ? [p.alp, c.alp2pp, 0, p.lnp] : null }],
    ["Published, on " + rdElecYear + " flows", { onp: null, lnp: p.tppFlows != null ? [p.tppFlows, null, 0] : null }],
  ].filter(([, v]) => v.onp || v.lnp);
  if (!rows.length && !p.tpp3 && !p.tppAlt2) return null;
  const tr = ([lab, v]) => (
    <tr key={lab}>
      <th scope="row">{lab}</th>
      {cols.map((k) => <td key={k.id}>{v[k.id] ? cell(v[k.id][0], v[k.id][1], k.ink, v[k.id][2], v[k.id][3]) : <span className="rd-ldg-none">—</span>}</td>)}
    </tr>
  );
  const noPub = !ta && p.alp == null;
  return (
    <>
      <table className="rd-ldg-t rd-ldg-tpp">
        <thead><tr><th></th>{cols.map((k, i) => <th key={k.id} className={i === 0 ? "on" : ""}>Labor {k.head}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => tr(r))}
          {p.tppAlt2 && <tr><th scope="row">Coalition v One Nation</th><td colSpan={2}><b className="rd-ldg-pair"><span style={{ color: "var(--lnp-text)" }}>{rdApNum(p.tppAlt2.lnp)}</span><span className="rd-ldg-dash">–</span><span style={{ color: "var(--onp-text)" }}>{rdApNum(p.tppAlt2.onp)}</span></b><span className="rd-ldg-tail">, as published</span></td></tr>}
          {p.tpp3 && <tr><th scope="row">Three-cornered</th><td colSpan={2}><b className="rd-ldg-tri"><span style={{ color: "var(--alp-text)" }}>ALP {rdApNum(p.tpp3.alp)}</span> <span style={{ color: "var(--lnp-text)" }}>L/NP {rdApNum(p.tpp3.lnp)}</span> <span style={{ color: "var(--onp-text)" }}>ON {rdApNum(p.tpp3.onp)}</span></b><span className="rd-ldg-tail">, as published</span></td></tr>}
        </tbody>
      </table>
      {(noPub || moe || note) && <p className="rd-ldg-foot1">{noPub ? p.pollster + " published no two-party figure; the implied ones are read off its primaries. " : ""}{moe || ""}{note ? " " + note : ""}</p>}
    </>
  );
}

/* ---- the primary vote: the poll's five figures, their changes, and how
   decided the vote is on the house's own question - can't-say (first
   basis), the not-firm share of the decided (soft), the residue inside a
   printed two-party pair (tpp), or RedBridge's vote-softness triple
   (gen-data's firmAll) */
function rdLgDecided(p) {
  if (p.undecided != null) {
    const b = p.undecidedBasis || "first";
    return { h: p.undecided + "%", w: b === "soft" ? "not firm" : "undecided", d: (p.chg && p.chg.d && p.chg.d.und) || null,
             s: b === "soft" ? "named a party, but might yet change their mind" : b === "tpp" ? "unallocated inside the printed two-party pair" : "couldn’t name a party when first asked" };
  }
  const f = Array.isArray(p.firmAll) && p.firmAll.length === 3 ? p.firmAll : null;
  if (f) return { h: f[1] + f[2] + "%", w: "not firm", d: null, s: "solid " + f[0] + ", soft " + f[1] + ", very soft " + f[2] + " on its vote-softness table" };
  return null;
}
const RD_LG_CK = { alp: "pAlp", lnp: "pLnp", grn: "pGrn", onp: "pOnp", oth: "pOth" };
function RdLgVote({ p, note }) {
  const q = p.p || {};
  const c = (p.chg && p.chg.d) || {};
  const prim = rdLgPrims().filter((k) => q[k.id] != null);
  if (!prim.length) return null;
  const dec = rdLgDecided(p);
  return (
    <>
      <div className="rd-ldg-prim">
        {prim.map((k) => (
          <span key={k.id}>
            <b style={{ color: k.ink }}>{k.lab}</b>
            <span className="rd-ldg-big" style={{ color: k.ink }}>{rdApNum(q[k.id])}</span>
            <span className="rd-ldg-chg">{rdLgChg(c[RD_LG_CK[k.id]], 0) || " "}</span>
          </span>
        ))}
      </div>
      {dec && <p className="rd-ldg-foot1"><b>{dec.h}</b> {dec.w}<RdLgChg d={dec.d} dec={1} /> – {dec.s}.</p>}
      {note && <p className="rd-ldg-note">{note}</p>}
    </>
  );
}

/* ---- leaders: one table of ratings with their parts, one of the better-PM
   contests with the undecided share. A contest printed without its
   undecided (it sums to 100) dashes that cell rather than claim none; a
   wave that rates leaders on different questions says which is which */
function RdLgLeaders({ p, note }) {
  const a = p.appr || {};
  const mb = a.metricBy || {};
  const alt = a.alt || {};
  const c = (p.chg && p.chg.d) || {};
  const nameOf = (id) => (id === "taylor" ? (a.oppName || rdLgWho(p, id)) : rdLgWho(a, id));
  const rows0 = [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]].filter(([, nk]) => a[nk] != null)
    .map(([id, nk]) => ({ id, ck: nk, net: a[nk], name: nameOf(id), L: a[id] || null, fav: mb[id] === "fav" }));
  /* a release that asks BOTH questions (Resolve: performance and likeability)
     gets a table per question: the second reading (appr.alt) joins any
     leader whose primary is already favourability, so each table holds one
     question and the Change column compares like with like */
  const altRows = ["alb", "taylor", "hanson"].filter((id) => alt[id] && alt[id].net != null)
    .map((id) => ({ id, ck: id + "Fav", net: alt[id].net, name: nameOf(id), L: null, fav: true }));
  const split = altRows.length > 0;
  const groups = split
    ? [rows0.filter((r) => !r.fav), [...rows0.filter((r) => r.fav).map((r) => ({ ...r, ck: r.id + "Fav" })), ...altRows]
        .sort((x, y) => ["alb", "taylor", "hanson"].indexOf(x.id) - ["alb", "taylor", "hanson"].indexOf(y.id))].filter((g) => g.length)
    : [rows0];
  const rows = rows0;
  const sets = window.ppmContests ? window.ppmContests(p) : (p.ppmSets || []);
  const who = ["alb", "taylor", "ley", "hanson"].filter((k) => sets.some((s) => s[k] != null));
  const named = (s) => ["alb", "taylor", "ley", "hanson"].filter((k) => s[k] != null);
  const twos = sets.filter((s) => named(s).length === 2).length;
  const setLab = (s) => {
    const n = named(s);
    if (n.length >= 3) return "Three-way";
    return twos > 1 ? rdLgWho(p, "alb") + " v " + rdLgWho(p, n.find((k) => k !== "alb")) : "Head to head";
  };
  if (!rows.length && !sets.length) return null;
  const sum = (s) => who.reduce((t, k) => t + (s[k] || 0), 0);
  const table = (rows, gi) => {
    const nFav = rows.filter((r) => r.fav).length;
    const allFav = rows.length > 0 && nFav === rows.length, mixed = nFav > 0 && nFav < rows.length;
    const hasUns = rows.some((r) => r.L && r.L.unsure != null);
    return (
      <table key={gi} className="rd-ldg-t rd-ldg-ldr">
        <thead><tr>
          <th>{allFav ? "Net favourability" : mixed ? "Net rating" : "Net approval"}</th>
          <th className="num pt">{allFav ? "Favourable" : mixed ? "For" : "Approve"}</th>
          <th className="num pt">{allFav ? "Unfavourable" : mixed ? "Against" : "Disapprove"}</th>
          {hasUns && <th className="num pt">Unsure</th>}
          <th className="num">Net</th><th className="num">Change</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}{mixed && <span className="rd-ldg-tail"> {r.fav ? "favourability" : "approval"}</span>}
                {/* a phone folds the part columns away: the parts ride under the name */}
                {r.L && r.L.app != null && <span className="rd-ldg-parts">{r.L.app} {r.fav ? "fav." : "approve"}, {r.L.dis} {r.fav ? "unfav." : "disapprove"}{r.L.unsure != null ? ", " + r.L.unsure + " unsure" : ""}</span>}</th>
              <td className="num pt">{r.L && r.L.app != null ? r.L.app : "—"}</td>
              <td className="num pt">{r.L && r.L.dis != null ? r.L.dis : "—"}</td>
              {hasUns && <td className="num pt">{r.L && r.L.unsure != null ? r.L.unsure : "—"}</td>}
              <td className="num"><b style={{ color: RD_LG_INK[r.id] }}>{rdLgNet(r.net)}</b></td>
              <td className="num">{rdLgChg(c[r.ck], 0) ? <span className="rd-ldg-chg">{rdLgChg(c[r.ck], 0)}</span> : <span className="rd-ldg-none">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  return (
    <>
      {groups.map((g, gi) => table(g, gi))}
      {sets.length > 0 && (
        <table className="rd-ldg-t rd-ldg-ppm">
          <thead><tr>
            <th>{window.JUR ? "Better " + window.JUR.office.alb : "Better prime minister"}</th>
            {who.map((k) => <th key={k} className="num">{rdLgWho(p, k)}</th>)}
            <th className="num">Undecided</th>
          </tr></thead>
          <tbody>
            {sets.map((s, i) => (
              <tr key={i}>
                <th scope="row">{setLab(s)}</th>
                {who.map((k) => <td key={k} className="num">{s[k] != null ? <b style={{ color: RD_LG_INK[k] }}>{s[k]}</b> : <span className="rd-ldg-none">—</span>}</td>)}
                <td className="num">{s.unc ? s.unc : sum(s) >= 99.5 ? <span className="rd-ldg-none" title="Printed without its undecided share">—</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {note && rows.length > 0 && <p className="rd-ldg-note">{note}</p>}
    </>
  );
}

/* ---- direction: the three answers as one bar, the net beside it */
function RdLgDir({ p }) {
  const d = p.dir;
  if (!d) return null;
  const u = d.unsure != null ? d.unsure : Math.max(0, 100 - d.right - d.wrong);
  return (
    <div className="rd-ldg-dir">
      <div className="rd-ldg-dirbar" aria-hidden="true">
        <i style={{ width: d.right + "%", background: "var(--mood-pos)" }}></i>
        <i style={{ width: u + "%", background: "var(--line)" }}></i>
        <i style={{ width: d.wrong + "%", background: "var(--mood-neg)" }}></i>
      </div>
      <div className="rd-ldg-dirk">
        <span>Right direction <b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b></span>
        <span>Unsure <b>{rdApNum(u)}</b></span>
        <span>Wrong track <b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b></span>
        <span className="rd-ldg-dirnet">Net <b>{rdApSigned(d.right - d.wrong).replace(/\.0$/, "")}</b></span>
      </div>
      {/* the breakdowns THIS wave's own release printed (gen-data's dir.bg):
          SEC Newgate's five states, Roy Morgan's gender pair and voting-
          intention splits. Where a release printed no split there are no
          lines. Party labels take the primary-meta inks, like the
          Preferences line's party figures. */}
      {d.bg && d.bg.length > 0 && (
        <div className="rd-ldg-dircut">
          {d.bg.map((row, ri) => (
            <p className="rd-ldg-dircut-r" key={ri}>
              <em className="rd-ldg-dircut-h">{row.head}</em>
              {row.cuts.map((c) => (
                <span className="rd-ldg-li" key={c.label}
                  title={c.right != null
                    ? c.label + ": " + rdApNum(c.right) + "% right direction, " + rdApNum(c.wrong) + "% wrong track"
                    : c.label + ": " + rdApNum(c.wrong) + "% say wrong track"}>
                  <em style={{ color: c.k && RD_AP_PRIM_META[c.k] ? RD_AP_PRIM_META[c.k].ink : null }}>{c.label}</em>{" "}
                  {row.form === "wrong"
                    ? <><b>{rdApNum(c.wrong)}</b>{c.right != null && <i className="rd-ldg-dircut-note"> (right {rdApNum(c.right)})</i>}</>
                    : <b>{rdApNum(c.right)}–{rdApNum(c.wrong)}</b>}
                </span>
              ))}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- one line per measure: the figures that measure's own tab shows in
   its row, so a line reads exactly like the row it opens */
/* the Preferences line's region chip (data: polls.json pref_flows → p.pf,
   gen-data's individualPolls emit): DemosAU's MRP reports print respondent-
   ranked preference flows per region, and the line opens on "All regions":
   the site's weighting of the three (gen-data's pf.all – each region's 2025
   enrolment times the group's vote there), which the report itself never
   prints. Presses cycle through each printed region and back. The
   names stack in one grid cell (.rd-ldg-cycw, rd.css) so a press never
   resizes the chip or the line. The chip rides the EYEBROW cell – below
   "Preferences" on wide screens, beside it on phones (rd.css) – so the
   whole line renders here, with the cycle state inside it. */
const RD_LG_PREFS_REGIONS = [["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"], ["all", "All regions"]];
const RD_LG_PREFS_ALL = "All regions is this site’s weighting of the three regions DemosAU prints: each region’s 2025 enrolment times the group’s vote there in this MRP";
/* the shared cell/group shape of a Preferences line: a contest label in its
   slot, then party-tagged figures - the MRP line and RedBridge's forced
   line both render through these */
const rdLgFlowCell = (k, v, suffix) => v != null && (
  <span key={k} className="rd-ldg-li"><em style={{ color: RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].ink : null }}>{RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].lab : k}</em> <b>{rdApNum(v)}</b>{suffix}</span>
);
const rdLgFlowGrp = (title, cells) => cells && (
  <span className="rd-ldg-grp rd-ldg-grpw rd-ldg-pgrp">
    <span className="rd-ldg-li lbl rd-ldg-lisoft">{title}</span>
    {cells.map(([k, v, suffix]) => rdLgFlowCell(k, v, suffix))}
  </span>
);
function RdLgPrefsLine({ pf }) {
  const regs = RD_LG_PREFS_REGIONS.filter(([k]) => k !== "all" || pf.all);
  /* All regions first: default to its index in regs (falls to 0 = Inner
     metro on the rare wave whose weighting never computed) */
  const [ri, setRi] = React.useState(() => Math.max(0, regs.findIndex(([k]) => k === "all")));
  const rk = regs[ri % regs.length][0], rn = regs[ri % regs.length][1], next = regs[(ri + 1) % regs.length][1];
  const cell = rdLgFlowCell;
  const grp = rdLgFlowGrp;
  const at = (t) => (rk === "all" ? (pf.all && pf.all[t]) || null : pf[t] ? pf[t][rk] : null);
  const a = at("alp_onp"), c = at("lnp_onp");
  return <div className="rd-ldg-line prefs">
    <span className="rd-ldg-lab">Preferences<button type="button" className="rd-ldg-cyc" title={(rk === "all" ? RD_LG_PREFS_ALL + ". " : "") + "Region shown: " + rn + " — press for " + next}
            aria-label={rn + (rk === "all" ? " (" + RD_LG_PREFS_ALL + ")" : "") + " – show " + next}
            onClick={(ev) => { ev.stopPropagation(); setRi((ri + 1) % regs.length); }}>
      <span className="rd-ldg-cycw">{regs.map(([k, n], i) => <span key={k} aria-hidden="true" className={i === ri % regs.length ? "on" : ""}>{n}</span>)}</span>
      <span className="rd-ldg-cyca" aria-hidden="true">↻</span>
    </button></span>
    <span className="rd-ldg-lbody">
      {a && grp("to ALP v ON", [["lnp", a.lnp], ["grn", a.grn], ["oth", a.oth]])}
      {c && grp("to L/NP v ON", [["alp", c.alp], ["grn", c.grn], ["oth", c.oth]])}
      {/* the one flow the report prints nationally, in the same
          contest-label-first shape as the other groups; the tail sits inside
          the figure cell so the comma hugs it (a tail flex item would float
          a column-gap away) */}
      {pf.onp_alp_lnp != null && grp("to ALP v L/NP", [["onp", pf.onp_alp_lnp, <span className="rd-ldg-lisoft">, nationwide</span>]])}
    </span>
  </div>;
}

/* RedBridge/Accent's "If forced to choose, who would you vote for" splits
   (its tpp_split tables, gen-data's split* fields): the same Preferences
   line shape as the MRP's, one group per question, the printed 2025-vote
   cohorts as its figures */
function RdLgFlowsLine({ p }) {
  const grp = rdLgFlowGrp;
  return <div className="rd-ldg-line flows">
    <span className="rd-ldg-lab">Preferences</span>
    <span className="rd-ldg-lbody">
      <span className="rd-ldg-li lbl rd-ldg-lisoft">If forced to choose</span>
      {(p.splitCoal != null || p.splitGrnOn != null || p.splitOthOn != null) && grp("to ALP v ON", [["lnp", p.splitCoal], ["grn", p.splitGrnOn], ["oth", p.splitOthOn]])}
      {(p.splitGrn != null || p.splitOnp != null || p.splitOth != null) && grp("to ALP v L/NP", [["grn", p.splitGrn], ["onp", p.splitOnp], ["oth", p.splitOth]])}
      {p.splitCoalEst && <span className="rd-ldg-li rd-ldg-lisoft">the Coalition split combines the report’s printed CLP/LNP/Nat and Liberal rows (no combined row was printed)</span>}
    </span>
  </div>;
}

function rdLgLines(p, { onM, demSplit }) {
  const out = [];
  const q = p.p || {};
  /* a unit never breaks inside itself; a long line wraps between units. A
     lbl unit introduces the units after it */
  const U = ({ children, soft, lbl }) => <span className={"rd-ldg-li" + (soft || lbl ? " rd-ldg-lisoft" : "") + (lbl ? " lbl" : "")}>{children}</span>;
  const pty = (k, v) => <><em style={{ color: RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].ink : null }}>{RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].lab : k}</em> <b>{v}</b></>;
  const prim = rdLgPrims().filter((k) => q[k.id] != null);
  if (prim.length) {
    const dec = rdLgDecided(p);
    out.push({ id: "primary", lab: "Primary", body: <>{prim.map((k) => <U key={k.id}>{pty(k.id, rdApNum(q[k.id]))}</U>)}{dec && <U soft>{dec.h} {dec.w}</U>}</> });
  }
  /* each matchup as its tab's row reads: the implied pair, then the
     published one where the house printed it */
  const ta = p.tppAlt;
  const pairB = (a, b, id) => <b><span style={{ color: "var(--alp-text)" }}>{rdApNum(a)}</span>–<span style={{ color: "var(--" + id + "-text)" }}>{rdApNum(b)}</span></b>;
  const mus = [
    { id: "onp", n: "One Nation", imp: p.alpOnImp, pub: ta ? [ta.alp, ta.onp] : null },
    { id: "lnp", n: "Coalition", imp: p.alpImp, pub: p.alp != null && p.lnp != null ? [p.alp, p.lnp] : null },
  ].filter((m) => m.imp != null || m.pub);
  if (!onM) mus.reverse();
  if (mus.length) {
    out.push({ id: "twopp", lab: "2PP", body: <>{mus.map((m) => (
      <span key={m.id} className="rd-ldg-grp">
        <U>v {m.n} {m.imp != null ? pairB(m.imp.toFixed(1), (100 - m.imp).toFixed(1), m.id) : pairB(m.pub[0], m.pub[1], m.id)}{m.imp == null ? <span className="rd-ldg-lisoft"> published</span> : m.pub ? "," : null}</U>
        {m.imp != null && m.pub && <U soft>published {pairB(m.pub[0], m.pub[1], m.id)}</U>}
      </span>
    ))}</> });
  }
  /* respondent-ranked flows by region (the MRP wave's printed tables), its
     own line under the 2PPs; renders itself so its chip's cycle state can
     live beside the eyebrow */
  if (p.pf) out.push({ id: "prefs", self: RdLgPrefsLine, pf: p.pf });
  /* RedBridge/Accent's forced-to-choose splits ride their own line in the
     same shape; self-rendering so the line never collides with the MRP's */
  if (p.splitCoal != null || p.splitOnp != null || p.splitGrn != null || p.splitGrnOn != null || p.splitOth != null || p.splitOthOn != null)
    out.push({ id: "flows", self: RdLgFlowsLine, p });
  const a = p.appr || {};
  let nets = [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]].filter(([, k]) => a[k] != null);
  const sets = window.ppmContests ? window.ppmContests(p) : [];
  if (nets.length || sets.length) {
    const mb = a.metricBy || {};
    /* with a second reading, the favourability run holds every leader's
       favourability - a primary-favourability net moves over to it - so each
       run is one question (as RdLgLeaders' two tables) */
    const alt = a.alt || {};
    const altNets = ["alb", "taylor", "hanson"].some((id) => alt[id] && alt[id].net != null)
      ? ["alb", "taylor", "hanson"].map((id) => [id, mb[id] === "fav" ? a[id + "Net"] : alt[id] && alt[id].net]).filter(([, v]) => v != null)
      : [];
    if (altNets.length) nets = nets.filter(([id]) => mb[id] !== "fav");
    const allFav = nets.length > 0 && nets.every(([id]) => mb[id] === "fav");
    const contest = (s, i) => {
      const sk = ["alb", "taylor", "ley", "hanson"].filter((k) => s[k] != null);
      return <React.Fragment key={"s" + i}>{i === 0 && <U lbl>Better PM</U>}{sk.length === 2
        ? <U>{rdLgWho(p, sk[0])} <b style={{ color: RD_LG_INK[sk[0]] }}>{s[sk[0]]}</b>–<b style={{ color: RD_LG_INK[sk[1]] }}>{s[sk[1]]}</b> {rdLgWho(p, sk[1])}</U>
        : <U>{sk.map((k, j) => <React.Fragment key={k}>{j > 0 ? ", " : ""}{rdLgWho(p, k)} <b style={{ color: RD_LG_INK[k] }}>{s[k]}</b></React.Fragment>)}</U>}</React.Fragment>;
    };
    out.push({ id: "leadership", lab: "Leadership", body: <>
      {nets.length > 0 && <U lbl>{allFav ? "Net favourability" : "Net approval"}</U>}
      {nets.map(([id, k]) => <U key={id}>{id === "taylor" ? (a.oppName || "Taylor") : rdLgWho(a, id)} <b style={{ color: RD_LG_INK[id] }}>{rdLgNet(a[k])}</b></U>)}
      {/* the release's second question (Resolve's likeability), as its own run */}
      {altNets.length > 0 && <U lbl>Net favourability</U>}
      {altNets.map(([id, v]) => <U key={"f" + id}>{id === "taylor" ? (a.oppName || "Taylor") : rdLgWho(a, id)} <b style={{ color: RD_LG_INK[id] }}>{rdLgNet(v)}</b></U>)}
      {sets.map(contest)}
    </> });
  }
  if (p.dir) {
    const d = p.dir;
    out.push({ id: "direction", lab: "Direction", body: <>
      <U>right direction <b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b></U>
      <U>wrong track <b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b></U>
      <U soft>unsure {rdApNum(d.unsure != null ? d.unsure : 100 - d.right - d.wrong)}</U>
    </> });
  }
  if (p.iss) {
    const IM = window.ISS_MAP || [], IL = window.ISS_MAP_LAB || {};
    const cells = IM.map((id) => { const o = window.issOwnOf(p, id); const L = o ? window.issLeadOf(o) : null; return L ? { id, L } : null; }).filter(Boolean);
    const sal = (p.iss.sal || p.iss.conc || []).slice(0, 3);
    out.push({ id: "issues", lab: "Issues", body: <>
      {cells.length > 0 ? cells.map(({ id, L }) => { const M = window.ISS_PARTY_META[L.who]; return <U key={id}>{IL[id]} {L.level ? <b>level</b> : <b style={{ color: M ? M[2] : null }}>{(M ? M[1] : L.who) + " +" + Math.round(L.lead)}</b>}</U>; })
        : sal.map(([lab, v]) => <U key={lab}>{lab} <b>{rdApNum(v)}</b></U>)}
    </> });
  }
  if (p.grp && p.grp.d) {
    const nG = Object.values(p.grp.d).reduce((t, r) => t + r.length, 0), nC = Object.keys(p.grp.d).length;
    /* the split the Demographics tab is on, else the first split this
       poll's cuts can draw */
    const pr = (() => {
      if (!window.demPairOf) return null;
      const ids = [demSplit || "age"].concat((window.DEM_SPLITS || []).map((x) => x.id));
      for (const id of ids) { const r = window.demPairOf(p, id); if (r) return r; }
      return null;
    })();
    const sg = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + rdApNum(Math.abs(v));
    out.push({ id: "demographics", lab: "Demographics", body: <>
      {pr && <U lbl>{pr.lab}</U>}
      {pr && rdLgPrims().filter((k) => pr.gap[k.id] != null).map((k) => <U key={k.id}>{pty(k.id, sg(pr.gap[k.id]))}</U>)}
      <U soft>{nG} groups in {rdNumWord(nC)} breakdown{nC === 1 ? "" : "s"}</U>
    </> });
  }
  const seats = p.seats && p.seats.p ? rdLgPrims().filter((k) => p.seats.p[k.id]) : [];
  if (seats.length) {
    out.push({ id: "seats", lab: "Seats", body: <>{seats.map((k) => { const s = p.seats.p[k.id]; return <U key={k.id}>{pty(k.id, s.est != null ? s.est : s.lo + "–" + s.hi)}</U>; })}<U soft>modelled{p.seats.rangeOnly && p.seats.method ? " – " + p.seats.method : ""}</U></> });
  }
  if (p.sw) {
    const w = p.sw;
    out.push({ id: "switching", lab: "To One Nation", body: <>
      <U lbl>Share of each {rdElecYear} vote now with One Nation</U>
      {["lnp", "alp", "grn", "oth"].filter((k) => w[k] != null).map((k) => <U key={k}>{pty(k, rdApNum(w[k]))}</U>)}
      {w.onp != null && <U>{pty("onp", rdApNum(w.onp))} <span className="rd-ldg-lisoft">kept</span></U>}
    </> });
  }
  if (p.cons) {
    const ORDER = ["alp", "lnp", "grn", "onp", "ind", "oth", "none"];
    /* ONE Consideration line, on the default "would consider" range (user
       call 2026-10-17): a banded wave's loose tier, else its only figures
       — the bands' other ranges ride the primary facet's range cycler,
       never this ledger */
    const def = rdApConsDef(p);
    const ks = ORDER.filter((k) => def.m[k] != null);
    out.push({ id: "cons", lab: "Consideration", body: <>
      {ks.map((k) => <U key={k}>{k === "none" ? <>none <b>{rdApNum(def.m[k])}</b></> : pty(k, rdApNum(def.m[k]))}</U>)}
      <U soft>{def.note}</U>
    </> });
  }
  /* the /public-opinion/ catalogue's one-off questions filed to this wave
     (gen-data §8e's beyondByRow) - federal only, and only where one of the
     pollster's store waves pairs to the row's release */
  const bo = window.AUSPOL.beyondByRow && window.AUSPOL.beyondByRow[p.pollster + "|" + p.released];
  if (bo) {
    out.push({ id: "opinion", lab: "Public opinion", body: <>
      {bo.t.map((t) => <U key={t}>{t}</U>)}
      <U soft>{bo.n} question{bo.n === 1 ? "" : "s"}</U>
    </> });
  }
  return out;
}

/* ---- the opened poll. side = the companion (How it counts, or the release
   rhythm); lead = a facet's own wide table where it has one (issues,
   groups, the gauge); onLine(id, el) = what pressing a line does; latest =
   the Latest table, whose own tabs are 2PP, Primary and Leadership */
function RdLedger({ p, facet, onM, side, lead, wide, onLine, sources, foot, demSplit, moe, latest }) {
  const lines = rdLgLines(p, { onM, demSplit });
  const NOTE = {
    twopp: rdLgChgNote(p, ["impOn", "imp", "altAlpOn", "alp2pp"]),
    primary: rdLgChgNote(p, ["pAlp", "pLnp", "pGrn", "pOnp", "pOth", "und"]),
    leadership: rdLgChgNote(p, ["albNet", "taylorNet", "hansonNet", "albFav", "taylorFav", "hansonFav"]),
  };
  const FULL = {
    primary: () => <RdLgVote p={p} note={NOTE.primary} />,
    twopp: () => <RdLgTpp p={p} onM={onM} moe={moe} note={NOTE.twopp} />,
    leadership: () => <RdLgLeaders p={p} note={NOTE.leadership} />,
    direction: () => <RdLgDir p={p} />,
  };
  const HEAD = { primary: "Primary vote, %", twopp: "Two-party preferred", leadership: "Leaders", direction: "The country is heading" };
  const body = lead || (FULL[facet] ? FULL[facet]() : null);
  const rest = lines.filter((l) => l.id !== facet);
  const ASKED = { primary: "primary vote", twopp: "two-party vote", leadership: "leaders", direction: "direction question", issues: "issues", demographics: "vote by group" };
  return (
    <div className={"rd-ldg poll-detail" + (wide ? " wide" : "") + (side ? "" : " noside")} data-pollster={p.pollster}>
      <div className="rd-ldg-head">
        <span className="rd-apd-h rd-ldg-sent">{rdPollHead(p)}</span>
        {/* the actions sit apart from the sources: the copied card keeps
            where the figures came from and drops what a reader can do here */}
        {(sources || foot) && <div className="rd-ldg-srcs">{sources}{foot && <span className="rd-ldg-acts">{foot}</span>}</div>}
      </div>
      <div className="rd-ldg-lead">
        {lead || (
          <section className="rd-ldg-sec" data-sec={facet}>
            <h4 className="rd-ldg-h">{HEAD[facet] || RD_LG_TAB[facet] || facet}</h4>
            {body || <p className="rd-ldg-foot1">{p.pollster} didn’t publish a {ASKED[facet] || facet} figure in this poll.</p>}
          </section>
        )}
      </div>
      {side && <div className="rd-ldg-side">{side}</div>}
      {rest.length > 0 && (
        <div className="rd-ldg-also">
          <h4 className="rd-ldg-h">Also in this poll</h4>
          <div className="rd-ldg-lines">
            {rest.map((l) => {
              if (l.self) { const Self = l.self; return <Self key={l.id} pf={l.pf} p={l.p} />; }
              const panelGo = RD_LG_PANEL[l.id];
              const can = !!(onLine && (RD_LG_TAB[l.id] || panelGo));
              const Tag = can ? "button" : "div";
              /* a snapshot-panel trip leaves the page only from the archive
                 (the Latest table shares the tab with the panel); a trip to
                 any other destination is away from either home; a tab trip
                 leaves the page only from the Latest table */
              const away = panelGo ? (!panelGo.onSnapshot || !latest) : (latest && !RD_LG_LATEST_TABS[l.id]);
              return (
                <Tag key={l.id} type={can ? "button" : undefined} className={"rd-ldg-line" + (can ? " go" : "")}
                     onClick={can ? (e) => { e.stopPropagation(); onLine(l.id, e.currentTarget); } : undefined}
                     title={can ? (panelGo ? (away ? "Open " + panelGo.tip + " on " + panelGo.where : "Show " + panelGo.tip)
                                          : (away ? "Open this poll on All polls’ " + RD_LG_TAB[l.id] + " tab" : "Show the " + RD_LG_TAB[l.id] + " tab")) : undefined}>
                  <span className="rd-ldg-lab">{l.lab}</span>
                  <span className="rd-ldg-lbody">{l.body}</span>
                  {can && <span className="rd-ldg-arrow" aria-hidden="true">{away ? "↗" : "→"}</span>}
                </Tag>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- the Primary tab's How it counts: each party's printed share against
   the polls fielded around it (gen-data §3c's pyd - the headline primary
   estimator read at the wave's fieldwork midpoint without it), drawn as the
   2PP table's lean strip, one per party: the dot is this poll's distance
   from the polls around it, the whisker its margin on that party, the tick
   the house's usual lean on it then - outside the margin means the whisker
   misses the tick. The table below sums the same steps on the figures as
   printed, then what the wave does to today's primaries (§7eb's peff) */
function RdApPrimRail({ p }) {
  const D = window.AUSPOL;
  const q = p.p || {}, y = p.pyd || {};
  const ks = rdLgPrims().filter((k) => q[k.id] != null && y[k.id]);
  if (!ks.length) return null;
  const n = p.sampleEff || (p.sample ? p.sample / rdApDeff() : 0);
  const rows = ks.map((k) => {
    const x = +q[k.id], v = y[k.id][0], he = y[k.id][1];
    const lean = rdApR1(x - v), less = he == null ? null : rdApR1(lean - he);
    const m = n ? 196 * Math.sqrt((x / 100) * (1 - x / 100) / n) : null;
    return { ...k, x, v, he, lean, less, m, out: rdApInside(less != null ? less : lean, m) === "outside" };
  });
  const e = p.peff || null;
  const pairOf = (id) => (!e ? null : e.w ? e[id] : e.t ? e.t[id] : null);
  const moves = e && !p.noAgg && rows.some((r) => pairOf(r.id));
  const sg = (v) => (v == null ? "—" : rdApSigned(v));
  const ms = rows.map((r) => r.m).filter((m) => m != null);
  const mTxt = ms.length ? "±" + (Math.min(...ms).toFixed(1) === Math.max(...ms).toFixed(1) ? Math.min(...ms).toFixed(1) : Math.min(...ms).toFixed(1) + "–" + Math.max(...ms).toFixed(1)) : null;
  const now = D.latest && D.latest.primary;
  const around = RD_AP_KAL ? "The trend" : "Polls around it";
  const anyOut = rows.some((r) => r.out);
  const say = rows.map((r) => r.lab + " " + (Math.abs(r.lean) < 0.05 ? "level with" : Math.abs(r.lean).toFixed(1) + (r.lean > 0 ? " above" : " below")) + " " + (RD_AP_KAL ? "the trend" : "the polls around it")).join("; ");
  return (
    <>
      <span className="rd-apd-ct">{p.pollster}’s primaries against {RD_AP_KAL ? "the trend through the other polls" : "the polls fielded around it"}, in points</span>
      <div className="rd-ldg-pstrips" role="img" aria-label={say}>
        <div className="rd-ldg-prow rd-ldg-phead" aria-hidden="true">
          <span></span>
          <span className="rd-ap-hpic"><span className="rd-ap-scale"><span className="rd-ap-in">
            <b className="rd-ap-scl">◀ Lower</b>
            <b className="rd-ap-scr">Higher ▶</b>
            {[[-6, "6"], [-3, "3"], [0, RD_AP_KAL ? "Trend" : <><span className="rd-ldg-lg">Polls around it</span><span className="rd-ldg-sh">Around</span></>], [3, "3"], [6, "6 pts"]].map(([v, lab]) => (
              <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "") + (v === -6 ? " start" : "") + (v === 6 ? " end" : "") + (Math.abs(v) === 3 ? " rd-ldg-lg" : "")} style={{ left: rdApX(v) + "%" }}>{lab}</span>
            ))}
          </span></span></span>
          <span></span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="rd-ldg-prow">
            <b style={{ color: r.ink }}>{r.lab}</b>
            <span className="rd-ap-pic"><RdApStrip lean={r.lean} moe={r.m} he={r.he} ink={r.dot} /></span>
            <span className="rd-ldg-pv" style={{ color: Math.abs(r.lean) >= 0.05 ? r.ink : null }}>{sg(r.lean)}</span>
          </div>
        ))}
      </div>
      <table className="rd-ldg-t rd-ldg-rk rd-ldg-rkp">
        <thead><tr><th></th>{rows.map((r) => <th key={r.id} className="num" style={{ color: r.ink }}>{r.lab}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">This poll</th>{rows.map((r) => <td key={r.id} className="num"><b>{rdApNum(r.x)}</b></td>)}</tr>
          <tr><th scope="row">{around}</th>{rows.map((r) => <td key={r.id} className="num">{r.v.toFixed(1)}</td>)}</tr>
          <tr><th scope="row">Lean</th>{rows.map((r) => <td key={r.id} className={"num" + (r.out && r.less == null ? " out" : "")}>{sg(r.lean)}</td>)}</tr>
          <tr><th scope="row">House lean</th>{rows.map((r) => <td key={r.id} className="num">{sg(r.he)}</td>)}</tr>
          {rows.some((r) => r.less != null) && <tr><th scope="row">Less house lean</th>{rows.map((r) => <td key={r.id} className={"num" + (r.out ? " out" : "")}>{sg(r.less)}</td>)}</tr>}
          {moves && <tr><th scope="row">{e.w ? "Moves today’s" : "Moved them on release"}</th>{rows.map((r) => { const pr = pairOf(r.id); return <td key={r.id} className="num">{pr ? sg(rdApR1(pr[1] - pr[0])) : "—"}</td>; })}</tr>}
        </tbody>
      </table>
      <p className="rd-ldg-foot1">
        Lean is this poll minus {RD_AP_KAL ? "the trend" : "the polls around it (" + (p.pyd.n === 1 ? "one other poll" : rdNumWord(p.pyd.n) + " others") + " within three weeks)"}, so + means higher; house lean is taken out before averaging.
        {anyOut ? " Bold: outside the poll’s margin on that party." : ""}{mTxt ? " Margins " + mTxt + ", " + rdMarginBasis(p) + "." : ""}
        {moves && e.w && now ? " Today’s figures: " + rows.filter((r) => now[r.id] != null).map((r) => r.lab + " " + now[r.id].toFixed(1)).join(", ") + "." : ""}
        {moves && !e.w ? " It is out of today’s three-week window; the last row is what it did to the figures when it came out." : ""}
      </p>
    </>
  );
}

/* ---------------------------------------------------------------- each facet's headline
   The table's head and dek name the facet's own measure (user call
   2026-10-08: the 2PP's words had sat over every facet). Each quotes the
   current figure exactly as its section of the page builds it (the
   nowcasts gen-data ships), then reads the polls in the table against it:
   how many sit in the figure's window and how far apart they run. The
   window follows the measure's own (three weeks, six for the sparse ones),
   counted by release date as the 2PP head counts it. Returns null when the
   measure has nothing current to say, and the table opens on its tabs.
   Each reads the whole poll set off the bundle, never the table's live
   rows: the walk floor (RdAllPolls) writes every state's words at once,
   whichever facet is open. */
const RD_AP_DEM_NOUN = {
  "18–34": "18–34-year-olds", "55+": "over-55s", "65+": "over-65s", "50+": "over-50s", "Gen Z": "Gen Z", Boomers: "Boomers",
  Women: "women", Men: "men", University: "university graduates", "Year 12 or less": "voters who left school by Year 12",
  School: "voters who left school by Year 12", "Inner metro": "inner-city voters", Rural: "rural voters",
  "Regional or rural": "regional voters", "Capital cities": "capital-city voters", "Regional/rural areas": "regional and rural voters",
  Renting: "renters", "Renting and other": "renters", "Own outright": "outright owners",
  "$150k+": "those on $150k or more", "Under $50k": "those on under $50k", "$125k+": "those on $125k or more",
  "Under $45k": "those on under $45k", "$100k or more": "those on $100k or more", "Under $100k": "those on under $100k",
  Retired: "retirees", "Full time": "full-time workers",
  Vietnam: "voters born in Vietnam", Australia: "voters born in Australia", "Mainland China": "voters born in mainland China",
  "South Africa": "voters born in South Africa", "United Kingdom": "voters born in the UK",
};
const rdApDemNoun = (g) => RD_AP_DEM_NOUN[g] || "the " + g + " group";
function rdApFacetStory(facet, upd, demSplit, confBw) {
  const D = window.AUSPOL;
  const J = window.JUR;
  /* the polls the facets' rows hold; direction adds the waves that asked
     only the direction question (the d1a1 asset's rows build) */
  const polls = D.individualPolls || [];
  const inWin = (p, days) => { const t = rdApDays(p.released); return t > upd - days * 864e5 && t <= upd; };
  const poss = (id) => rdPartyStart(id) + (rdPlural(id) ? "’" : "’s");
  /* "comes from six polls, which range from 24 to 30" - the 2PP head's shape */
  const fromPolls = (n, lo, hi, f) => " comes from " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s")
    + (n === 1 ? "" : lo === hi ? ", which all read " + f(lo) : ", which range from " + f(lo) + " to " + f(hi));
  /* "All six have", "Four of them have", "None of them has" */
  const tally = (k, n, has) => (n === 1 ? (k ? "It " + has : "It doesn’t " + (has === "has" ? "have" : has.replace(/s$/, "")))
    : k === n ? (n === 2 ? "Both " : "All " + rdNumWord(n) + " ") + (has === "has" ? "have" : has.replace(/s$/, ""))
    : k === 0 ? "None of them " + has
    : rdCap(rdNumWord(k)) + " of them " + (k === 1 ? has : has === "has" ? "have" : has.replace(/s$/, "")));
  const below = (what) => "Below is every " + RD_AP_POLLS + " poll" + (what ? " " + what : "") + " since the " + rdElecYear + " election, newest first, each linked to its source.";
  const range = (vals) => [Math.min(...vals), Math.max(...vals)];

  if (facet === "primary") {
    const now = D.latest.primary || {};
    const ids = Object.keys(now).filter((k) => now[k] != null).sort((a, b) => now[b] - now[a]);
    if (ids.length < 2) return null;
    const [t1, t2] = ids;
    const days = (D.latest.method && D.latest.method.windowDays) || 21;
    const ps = polls.filter((p) => inWin(p, days) && p.p && p.p[t1] != null);
    if (!ps.length) return null;
    const n = ps.length, [lo, hi] = range(ps.map((p) => p.p[t1]));
    const f = rdApNum;
    const head = RD_AP_KAL
      ? poss(t1) + " " + now[t1].toFixed(1) + " primary vote is the trend through every poll; "
        + (n === 1 ? "the last three weeks hold one, at " + f(lo) : "the last three weeks’ " + rdNumWord(n) + (lo === hi ? " all read " + f(lo) : " range from " + f(lo) + " to " + f(hi)))
      : poss(t1) + " " + now[t1].toFixed(1) + " primary vote" + fromPolls(n, lo, hi, f);
    /* the leader's margin as RdPrimary rules it: level when the gap is
       inside the two figures' 95% margins combined */
    const lastM = (D.aggPrimary || [])[(D.aggPrimary || []).length - 1] || {};
    const ci = (id) => (lastM.ci && lastM.ci[id]) || 0;
    const gap = now[t1] - now[t2];
    const level = gap < Math.sqrt(ci(t1) ** 2 + ci(t2) ** 2);
    const both = ps.filter((p) => p.p[t2] != null);
    const ahead = both.filter((p) => p.p[t1] > p.p[t2]).length;
    const m = both.length;
    const tl = !m ? "" : m === 1 ? (ahead ? "It has " : "It doesn’t have ")
      : ahead === m ? (m === 2 ? "Both have " : "All " + rdNumWord(m) + " have ")
      : ahead === 0 ? "None of the " + rdNumWord(m) + " has "
      : rdCap(rdNumWord(ahead)) + " of the " + rdNumWord(m) + " " + (ahead === 1 ? "has " : "have ");
    const dek = (m ? tl + rdPartyIn(t1) + " ahead of " + rdPartyIn(t2) + ". " : "")
      + rdPartyStart(t2) + (rdPlural(t2) ? " are " : " is ") + gap.toFixed(1) + " points behind on " + now[t2].toFixed(1)
      + (level ? ", too close to separate. " : ". ")
      + below("");
    return { head, dek };
  }

  if (facet === "leadership") {
    const N = D.leaderNow || {};
    const L = {};
    (D.LEADERS || []).forEach((x) => { L[x.id] = x; });
    const pm = L.alb, opp = L.taylor;
    if (!pm || !opp) return null;
    /* approval where it is asked, else favourability (/vic/'s pollsters
       mostly ask the latter); the federal majors' approval reads three
       weeks, every other leader measure six (gen-data's §4 rule) */
    const fav = !(N.alb_net && N.alb_net.v != null) && N.alb_fav && N.alb_fav.v != null;
    const a = N[fav ? "alb_fav" : "alb_net"];
    if (!a || a.v == null) return null;
    const what = fav ? "net favourability" : "net approval";
    const days = !fav && !J ? 21 : 42;
    const isFav = (p) => ((p.appr.metricBy || {}).alb === "fav");
    const ps = polls.filter((p) => inWin(p, days) && p.appr && p.appr.albNet != null && isFav(p) === !!fav);
    if (!ps.length) return null;
    const n = ps.length, [lo, hi] = range(ps.map((p) => p.appr.albNet));
    const f = (v) => rdSigned(v, 0);
    const head = pm.short + "’s " + what + " of " + rdSigned(a.v, 1) + fromPolls(n, lo, hi, f);
    const t = N[fav ? "taylor_fav" : "taylor_net"];
    const both = ps.filter((p) => p.appr.taylorNet != null);
    const above = both.filter((p) => p.appr.taylorNet > p.appr.albNet).length;
    let dek = "";
    if (t && t.v != null && both.length) {
      dek += tally(above, both.length, "rates") + " " + opp.short + " above " + pm.short + ", and " + opp.short + "’s own " + what + " is " + rdSigned(t.v, 1) + ". ";
    }
    const office = J ? J.office.alb : "PM";
    const pa = N.alb_pref && N.alb_pref.v, po = N.taylor_pref && N.taylor_pref.v;
    if (pa != null && po != null) {
      const ra = Math.round(pa), ro = Math.round(po);
      dek += ra === ro ? "As preferred " + office + ", " + pm.short + " and " + opp.short + " are level at " + ra + ". "
        : "As preferred " + office + ", " + (ra > ro ? pm.short + " leads " + opp.short : opp.short + " leads " + pm.short)
          + " " + Math.max(ra, ro) + "–" + Math.min(ra, ro) + ". ";
    }
    return { head, dek: dek + below("with leadership numbers") };
  }

  if (facet === "direction") {
    const now = D.directionNow;
    if (!now) return null;
    const ps = polls.concat(D.directionOnlyPolls || []).filter((p) => inWin(p, 21) && p.dir && p.dir.net != null);
    if (!ps.length) return null;
    const n = ps.length, [lo, hi] = range(ps.map((p) => p.dir.net));
    const head = "The net mood of " + rdSigned(now.net, 1) + fromPolls(n, lo, hi, (v) => rdSigned(v, 0));
    const wrongLeads = now.wrong >= now.right;
    const k = ps.filter((p) => (wrongLeads ? p.dir.wrong > p.dir.right : p.dir.right > p.dir.wrong)).length;
    const dek = tally(k, n, "has") + " more voters saying Australia is " + (wrongLeads ? "on the wrong track than heading in the right direction"
      : "heading in the right direction than on the wrong track") + ". Taken together, " + Math.round(wrongLeads ? now.wrong : now.right)
      + "% say it’s " + (wrongLeads ? "on the wrong track" : "heading in the right direction") + " and " + Math.round(wrongLeads ? now.right : now.wrong)
      + "% that it’s " + (wrongLeads ? "heading in the right direction" : "on the wrong track") + ". " + below("with a direction reading");
    return { head, dek };
  }

  if (facet === "issues") {
    /* the Issues section's pooled readings: who voters rate best on each
       issue over six weeks, and whether the lead clears its margin */
    const list = ((D.issues && D.issues.list) || []).filter((it) => it.own && it.own.lead);
    if (!list.length) return null;
    const by = {};
    list.forEach((it) => { (by[it.own.lead] = by[it.own.lead] || []).push(it); });
    const lab = (it) => it.label.charAt(0).toLowerCase() + it.label.slice(1);
    const sig = (its) => its.filter((it) => it.own.leadSig);
    const order = Object.keys(by).sort((x, y) => by[y].length - by[x].length || sig(by[y]).length - sig(by[x]).length);
    const top = order[0], mine = by[top], clear = sig(mine).length, N = list.length;
    let head;
    if (order.length > 1 && by[order[1]].length === mine.length) head = "No party leads on more of the " + rdNumWord(N) + " issues than the others";
    else head = rdPartyStart(top) + " leads on " + (mine.length === N ? "all " + rdNumWord(N) + " issues" : rdNumWord(mine.length) + " of the " + rdNumWord(N) + " issues")
      + (clear === mine.length ? "" : clear === 0 ? ", but on none of them clearly" : ", but clearly on only " + rdNumWord(clear));
    const rest = order.slice(head.startsWith("No party") ? 0 : 1);
    const parts = rest.map((id) => rdPartyIn(id) + " on " + rdList(by[id].map(lab)));
    let dek = parts.length ? rdCap(parts[0].replace(" on ", " leads on ")) + (parts.length > 1 ? ", and " + parts.slice(1).join(", and ") : "") + ". " : "";
    const soft = mine.filter((it) => !it.own.leadSig);
    if (!head.startsWith("No party") && soft.length && clear > 0)
      dek += poss(top) + " edge on " + rdList(soft.map(lab)) + " is inside the margin of error. ";
    dek += "Each figure pools the last " + (D.issues.window || "six weeks") + "’ polls. " + below("with issues figures");
    return { head, dek };
  }

  if (facet === "demographics") {
    const sp = (window.DEM_SPLITS || []).find((s) => s.id === demSplit);
    if (!sp) return null;
    const DG = D.demographics || {};
    const pooled = {};
    (DG.tabs || []).forEach((t) => t.sets.forEach((s) => s.groups.forEach((g) => { if (!pooled[g.label]) pooled[g.label] = g; })));
    const pair = sp.pairs.find(([x, y]) => pooled[x] && pooled[y]);
    const close = below(sp.scope.charAt(0).toLowerCase() + sp.scope.slice(1)).replace("each linked to its source", "each split into its own pollster’s groups");
    if (pair) {
      /* the Who-votes section's pooled six-week groups: each party's gap
         between the split's two ends, in whole points as the table prints
         them, and whether it clears the two groups' margins combined */
      const [a, b] = pair, A = pooled[a], B = pooled[b];
      const gaps = (DG.order || Object.keys(A.v)).filter((k) => A.v[k] != null && B.v[k] != null).map((k) => {
        const g = A.v[k] - B.v[k];
        return { k, g, hi: g >= 0 ? a : b, lo: g >= 0 ? b : a, sig: Math.abs(g) > Math.sqrt(((A.ci || {})[k] || 0) ** 2 + ((B.ci || {})[k] || 0) ** 2) };
      }).sort((x, y) => Math.abs(y.g) - Math.abs(x.g));
      if (!gaps.length) return null;
      const pts = (g) => Math.round(Math.abs(g)) + " point" + (Math.round(Math.abs(g)) === 1 ? "" : "s");
      const n = Math.min(A.n || 0, B.n || 0);
      const pool = n ? " The figures pool " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s") + " from the last " + (DG.window || "six weeks") + ". " : " ";
      const w = gaps[0];
      if (!w.sig) {
        return { head: rdCap(rdApDemNoun(a)) + " and " + rdApDemNoun(b) + " vote much alike",
          dek: "No party’s vote differs between them by more than the margin of error; the widest gap is " + poss(w.k).replace(/^T/, "t") + ", " + pts(w.g) + "." + pool + close };
      }
      const head = poss(w.k) + " vote is " + pts(w.g) + " higher among " + rdApDemNoun(w.hi) + " than " + rdApDemNoun(w.lo);
      /* the next two gaps that clear their margins, gathered by the group
         they favour: "One Nation’s is 18 points and the Coalition’s 12
         points higher among over-55s" */
      const nx = gaps.slice(1).filter((x) => x.sig).slice(0, 2);
      const sides = [...new Set(nx.map((x) => x.hi))].map((hi) => {
        const xs = nx.filter((x) => x.hi === hi);
        return xs.map((x, i) => poss(x.k).replace(/^The /, "the ") + (i === 0 ? " is " : " ") + pts(x.g)).join(" and ") + " higher among " + rdApDemNoun(hi);
      });
      const dek = (sides.length ? rdCap(sides.join(", and ")) + "." : "No other party’s gap clears the margin of error.") + pool + close;
      return { head, dek };
    }
    /* a split the section doesn't pool (income: the houses bracket
       different quantities; birth country: one special pooled release, no
       peer) - the newest poll's own pair */
    const ps = polls.filter((p) => window.demPairOf(p, demSplit)).sort((x, y) => (x.released < y.released ? 1 : -1));
    if (!ps.length) return null;
    const p = ps[0], pr = window.demPairOf(p, demSplit);
    const gs = Object.keys(pr.gap).filter((k) => pr.gap[k] != null).sort((x, y) => Math.abs(pr.gap[y]) - Math.abs(pr.gap[x]));
    if (!gs.length) return null;
    const k = gs[0], g = pr.gap[k];
    const head = ps.length === 1 ? "One poll breaks the vote out by " + sp.label.toLowerCase()
      : rdCap(sp.label.toLowerCase()) + " splits aren’t pooled: each pollster draws its own brackets";
    /* the "Roy Morgan (pooled)" row is its special pooled survey, not the
       weekly series - the apposition names it as one */
    const who = p.pollster.replace(/^(.+?) \((.+?)\)$/, "$1’s $2 survey");
    const dek = rdCap(rdNumWord(ps.length)) + " poll" + (ps.length === 1 ? " has" : "s have") + " split the vote by " + sp.label.toLowerCase()
      + ". The newest, " + (who === p.pollster ? who + "’s" : who) + ", puts " + rdPartyIn(k) + " " + Math.round(Math.abs(g)) + " points higher among "
      + rdApDemNoun(g >= 0 ? pr.a : pr.b) + " than " + rdApDemNoun(g >= 0 ? pr.b : pr.a) + ". " + close;
    return { head, dek };
  }

  if (facet === "confidence") {
    const M = D.confidence || {};
    /* the lane flip's story follows the row set: consumer (the default)
       reads the two household gauges, business the business pair */
    const G = (confBw
      ? [["business", "Roy Morgan’s business confidence", 100], ["nabBusiness", "NAB’s business confidence", 0]]
      : [["consumer", "ANZ–Roy Morgan’s consumer confidence", 100], ["westpacConsumer", "Westpac–MI’s consumer sentiment", 100]])
      .filter(([k]) => M[k] && M[k].latest && M[k].latest.v != null)
      .map(([k, name, neut]) => ({ k, name, neut, lat: M[k].latest }));
    if (!G.length) return null;
    const fig = (g, v) => (g.neut === 0 ? rdSigned(v, Number.isInteger(v) ? 0 : 1).replace(/^\+/, "") : v.toFixed(1));
    const nG = G.length, under = G.filter((g) => g.lat.v < g.neut).length;
    const laneNoun = confBw ? "business" : "consumer";
    const all = nG === 2 ? "Both" : "All " + rdNumWord(nG);
    const head = under === nG ? all + " " + laneNoun + " gauges sit below neutral"
      : under === 0 ? all + " " + laneNoun + " gauges sit above neutral"
      : rdCap(rdNumWord(under)) + " of the " + rdNumWord(nG) + " " + laneNoun + " gauges sit below neutral";
    const moved = G.filter((g) => g.lat.chg != null);
    const fell = moved.filter((g) => g.lat.chg < 0).length;
    const fellTxt = !moved.length ? "" : (fell === moved.length ? (moved.length === 2 ? "Both" : "All " + rdNumWord(moved.length)) + " fell in their latest release. "
      : fell === 0 ? "None fell in its latest release. "
      : rdCap(rdNumWord(fell)) + " of the " + rdNumWord(moved.length) + " fell in their latest release. ");
    const newest = G.reduce((m, g) => (g.lat.released > m ? g.lat.released : m), "");
    const [, mo, dd] = newest.split("-").map(Number);
    const at = (g) => g.name + " at " + fig(g, g.lat.v)
      + (g.lat.chg == null ? "" : Math.abs(g.lat.chg) < 0.05 ? " (unchanged)" : (g.lat.chg < 0 ? " (down " : " (up ") + rdApNum(Math.abs(g.lat.chg)) + ")");
    const latest = G.filter((g) => g.lat.released === newest);
    const dek = fellTxt + "The newest release" + (latest.length > 1 ? "s" : "") + ", on " + dd + " " + D.monthNameFull(mo) + ", put"
      + (latest.length > 1 ? "" : "s") + " " + rdList(latest.map(at)) + ". "
      + "Below is every release of the " + laneNoun + " indices since the " + rdElecYear + " election, newest first, each linked to its source.";
    return { head, dek };
  }
  return null;
}

/* a poll's lean on a contest and basis, as the table's rows compute it
   (the d1a1 asset's rows build): its figure less the yardstick average of
   the polls around it, that average as printed to one decimal. The walk
   floor writes the 2PP's words for every contest and basis at once, so it
   reads the lean off the poll - the live rows carry only the live pair's */
const rdApLeanFor = (p, onM, pub) => {
  const y = rdApYd(p, onM, pub);
  const x = pub ? (onM ? (p.tppAlt ? p.tppAlt.alp : null) : p.alpN) : (onM ? p.alpOnImp : p.alpImp);
  return x != null && y && y.v != null ? +(x - Math.round(y.v * 10) / 10).toFixed(1) : null;
};
/* the Primary facet's consideration variant (consM). Each pollster asks its
   own question ("would seriously consider", "would definitely vote for",
   "would ever support"), so no figure pools across pollsters: the head
   quotes the last poll to ask ("when last asked", never "newest": these
   polls are months apart, and the date says how old) in its own question's words against the larger
   major party's figure in the same poll; the dek says to compare within a
   pollster and tallies One Nation v
   Labor over the polls that asked about every party. "Above"/"below" only
   past the two shares' combined 95% margin in that poll's sample. */
function rdApConsStory(upd) {
  const D = window.AUSPOL;
  const waves = (D.individualPolls || []).filter((p) => p.cons && rdApConsDef(p).m.onp != null && rdApDays(p.released) <= upd)
    .sort((a, b) => rdApDays(b.released) - rdApDays(a.released));
  if (!waves.length) return null;
  const newest = waves[0], nw = rdApConsDef(newest).m;
  /* every figure rides the default "would consider" range (rdApConsDef):
     a banded wave's loose tier, not the filed canonical figures */
  const basis = (p) => rdApConsDef(p).lab.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  const pct = (v) => rdApNum(v) + "%";
  const apart = (p, a, b) => Math.abs(a - b) > 1.96 * Math.sqrt((a * (100 - a) + b * (100 - b)) / (p.sample || 1000));
  const rel = (p, id) => { const m = rdApConsDef(p).m; return !apart(p, m.onp, m[id]) ? 0 : m.onp > m[id] ? 1 : -1; };
  const MAJ = { alp: "Labor’s", lnp: "the Coalition’s" };
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number);
    return d + " " + D.monthNameFull(m) + (y !== new Date(upd).getUTCFullYear() ? " " + y : ""); };
  const top = ["alp", "lnp"].filter((id) => nw[id] != null).sort((a, b) => nw[b] - nw[a])[0];
  const head = "When last asked, by " + newest.pollster + " on " + day(newest.released) + ", " + pct(nw.onp) + " "
    + basis(newest) + (/vote$/.test(basis(newest)) ? " for " : " ") + "One Nation"
    + (top ? ", " + ["below ", "close to ", "above "][rel(newest, top) + 1] + MAJ[top] + " " + pct(nw[top]) : "");
  const askers = new Set(waves.map((p) => p.pollster + "|" + basis(p))).size;
  /* One Nation v Labor where every party was asked */
  const full = waves.filter((p) => rdApConsDef(p).m.alp != null);
  const cnt = [1, 0, -1].map((r) => full.filter((p) => rel(p, "alp") === r).length);
  const parts = ["outscored", "came close to", "trailed"].map((v, i) => (cnt[i] ? [v, cnt[i]] : null)).filter(Boolean);
  const tallied = full.length < 2 ? ""
    : parts.length === 1 ? "In all " + rdNumWord(full.length) + " polls that asked about every party, One Nation " + parts[0][0] + " Labor. "
    : "Of the " + rdNumWord(full.length) + " polls that asked about every party, One Nation "
      + rdList(parts.map(([v, k], i) => (i ? v.replace(/ to$/, "") : v + " Labor") + " in " + rdNumWord(k))) + ". ";
  const dek = (askers > 1 ? "Pollsters word the question differently, so compare a figure only with the same pollster’s. " : "")
    + tallied
    + "Below is every national poll with consideration figures since the 2025 election, newest first, each linked to its source.";
  return { head, dek };
}
/* the 2PP facet's head and dek on one contest (onM: Labor v One Nation)
   and basis (pub: as published): today's figure, the polls in its window
   and how far apart they run, how many have Labor ahead, and how many sit
   outside their own margin of where their pollster usually lands */
function rdApTppStory(onM, pub, upd) {
  const D = window.AUSPOL;
  const today = window.AP.tppLatest(onM ? "alp_on" : "alp_lnp", pub ? "resp" : "imp");
  const winDays = (D.latest.method && D.latest.method.windowDays) || 21;
  const figOf = (p) => rdApFig(p, onM, pub);
  const win = (D.individualPolls || []).filter((p) => { const t = rdApDays(p.released); return t > upd - winDays * 864e5 && t <= upd && figOf(p).a != null; });
  if (!today || !win.length) return null;
  const rival = onM ? "One Nation" : "the Coalition";
  const contest = onM ? "onp" : "lnp";
  const vals = win.map((p) => figOf(p).a);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const f = (v) => (pub ? rdApNum(v) : v.toFixed(1));
  const n = win.length;
  const head = RD_AP_KAL
    ? "Labor’s " + today.a.toFixed(1) + " is the trend through every poll; "
      + (n === 1 ? "the last three weeks hold one, at " + f(lo) : "the last three weeks’ " + rdNumWord(n) + (lo === hi ? " all put Labor on " + f(lo) : " range from " + f(lo) + " to " + f(hi)))
    : "Labor’s " + today.a.toFixed(1) + " comes from " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s")
    + (n === 1 ? "" : lo === hi ? ", which all put Labor on " + f(lo) : ", which range from " + f(lo) + " to " + f(hi));
  const ahead = vals.filter((v) => v > 50).length;
  const outN = win.filter((p) => rdApInside(rdApAdj({ ...p, lean: rdApLeanFor(p, onM, pub) }, onM, pub), rdPollMargin(p, contest, pub)) === "outside").length;
  const lead = n === 1 ? (ahead ? "It has" : "It doesn’t have")
    : ahead === n ? (n === 2 ? "Both have" : "All " + rdNumWord(n) + " have")
    : ahead === 0 ? "None of them has"
    : rdCap(rdNumWord(ahead)) + " of them " + (ahead === 1 ? "has" : "have");
  const tail = n === 1 ? (outN ? "it sits further from where its pollster usually lands than its own margin of error. " : "it sits within its own margin of error of where its pollster usually lands. ")
    : outN === 0 ? "none sits further from where its pollster usually lands than its own margin of error. "
    : outN === 1 ? "one sits further from where its pollster usually lands than its own margin of error. "
    : rdNumWord(outN) + " sit further from where their pollsters usually land than their own margin of error. ";
  const dek = lead + " Labor ahead of " + rival + ", and " + tail
    + "Below is every " + RD_AP_POLLS + " poll since the " + rdElecYear + " election, newest first, each linked to its source.";
  return { head, dek };
}

/* ---------------------------------------------------------------- the phone's filters
   "Filters" on the pinned bar opens the pollster, time and includes lists as a
   sheet from the bottom of the screen, with the count of what's left on its
   button. */
function RdApSheet({ onClose, houses, houseRank, houseN, sel, toggleHouse, range, setRange,
                     shownTags, tagSel, toggleTag, tagN, count, clearAll, noun1, noun }) {
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
                      onClick={() => setRange(id)}><RdTabW t={lab} /></button>
            ))}
          </div>
          <span className="rd-ap-sheetk">Includes</span>
          <div role="group" aria-label="What the poll published">
            {shownTags.map((t) => <PopRow key={t.id} on={tagSel.has(t.id)} label={rdApTagLab(t.id)} n={tagN[t.id] || 0} onClick={() => toggleTag(t.id)} />)}
          </div>
        </div>
        <button type="button" className="rd-ap-sheetgo" onClick={onClose}>Show {count} {count === 1 ? noun1 : noun}</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the table */
/* the two banded consideration questions, named per house. tab = the
   row's range-cycler label (sentence case, sits under the desktop figures,
   rides the phone card head's right edge); note = the ledger Consideration
   line's soft explainer, only ever read off the default (loose) range.
   RedBridge/Accent's April 2026 wave asked a 0–10 propensity of each
   party's non-voters and the filed shares are rebased over everyone;
   Essential's Feb and June 2026 waves banded every voter
   definitely/open-to/never (the loose tier is the definitely + open
   sums). */
const RD_AP_CONS_TIER = {
  "RedBridge/Accent": {
    loose: { tab: "Would consider (≥4/10)", note: "rated ≥4/10, rebased over everyone" },
    not: { tab: "Would not consider (≤3/10)" },
    never: { tab: "Would never vote (0/10)" },
  },
  Essential: {
    loose: { tab: "Would consider (definitely or open)", note: "the ‘definitely’ and ‘open to’ bands, summed" },
    never: { tab: "Would never vote" },
  },
};
const rdApConsTier = (p, tier) => (RD_AP_CONS_TIER[p.pollster] || RD_AP_CONS_TIER["RedBridge/Accent"])[tier];
/* the DEFAULT consideration range ("would consider") carries every surface
   that shows one range — the ledger's single Consideration line, the story,
   the sort, and where the cycler opens (user call 2026-10-17): a banded
   wave's loose tier, else its only figures with their basis */
const rdApConsDef = (p) => p.consLoose
  ? { m: p.consLoose, lab: rdApConsTier(p, "loose").tab, note: rdApConsTier(p, "loose").note }
  : { m: p.cons, lab: p.consBasis || "Would consider", note: p.consBasis || "parties the voter would consider" };

/* a consideration row's RANGE cycler (user call 2026-10-15: "why not just
   add a switch/cycle button through the different ranges, right where it
   denotes the basis"). A wave whose consideration question came in more
   than one range - RedBridge/Accent's April 2026 0-10 battery, or
   Essential's Feb/June 2026 definitely/open/never banding, file as
   tiers of tiers[] - shows ONE range at a time, opening on the default
   "would consider" range (2026-10-17 user call: it was canonical first),
   and the basis label is a button stepping on through them, figures and
   strip moving together. The state is per row and ephemeral: the sort,
   the story and the ledger all read the same default range with it. */
function RdApConsCyc({ tiers, phone, primNums, primStrip, primCardNums, cardHead }) {
  const [ti, setTi] = useState(0);
  const many = tiers.length > 1;
  const t = tiers[Math.min(ti, tiers.length - 1)];
  const next = tiers[(ti + 1) % tiers.length];
  const basis = many ? (
    <button type="button" className="rd-ap-conscyc"
            title={"Switch to " + next.lab}
            aria-label={"Consideration range: " + t.lab + ". Switch to " + next.lab}
            onClick={(e) => { e.stopPropagation(); setTi((ti + 1) % tiers.length); }}>
      {t.lab} <span aria-hidden="true">⇄</span>
    </button>
  ) : (phone ? <span className="rd-ap-csub">{t.lab}</span> : <span className="rd-ap-sub">{t.lab}</span>);
  const ariaPre = "Voting consideration" + (many ? ", " + t.lab : "") + ": ";
  const live = many ? { "aria-live": "polite" } : null;
  /* phone: the basis label (or its cycle button) rides the card head's
     right edge via cardHead - the slot the demographics facet names its
     pair in (user call 2026-10-15: same position as "Women v Men") - so
     this component renders the card ENTIRELY past the chevron, head and
     all; the label keeps its own aria-live wrapper because its element
     now lives outside the figures block */
  if (phone) return (
    <>
      {cardHead(many ? <span style={{ display: "contents" }} {...live}>{basis}</span> : basis)}
      <div className="rd-ap-ctier" {...live}>{primCardNums(t.m)}</div>
      <div className="rd-ap-cpic">{primStrip(t.m, ariaPre)}</div>
    </>
  );
  return (
    <>
      <span role="cell" className="rd-ap-fig" {...live}>{primNums(t.m)}{basis}</span>
      {primStrip(t.m, ariaPre)}
    </>
  );
}

function RdAllPolls(P) {
  const { rows, sorted, total, houses, houseRank, houseN, tagN, shownTags, rangeN, RANGE_LAB,
          facet, onFacet, measure, onMeasure, tppBasis, setTppBasis, consM, setConsM, confBus, setConfBus,
          q, setQ, sel, setSel, toggleHouse, range, setRange, tagSel, setTagSel, toggleTag,
          pills, clearAll, sort, onSort, open, setOpen, focus, onBack, backLabel, exportCsv, bodyRef,
          ofTotal, ofHouses, demSplit, setDemSplit } = P;
  const D = window.AUSPOL;
  /* the direction-only waves sit outside every other facet's rows; ofTotal
     is the archive's full extent so an unfiltered count can acknowledge them
     ("163 of 173 polls") instead of implying the facet's rows are everything.
     The confidence facet's rows are never polls at all, so its unfiltered
     extent is the release file - a lane read joins that ("91 of 124
     releases"), not the poll archive's total */
  const ofT = facet === "confidence" ? ((D.confidenceOnlyPolls || []).length !== total ? (D.confidenceOnlyPolls || []).length : null)
    : (ofTotal != null && ofTotal !== total ? ofTotal : null);
  const ofTxt = ofT ? " of " + ofT : "";
  /* releases, not polls: the confidence facet's rows never count toward
     a poll total, so its count lines say what they number */
  const noun1 = facet === "confidence" ? "release" : "poll";
  const noun = noun1 + "s";
  const phone = useNarrow("(max-width: 760px)");
  /* The tab row only holds the two-party control (and the demographics
     facet's split picker) while the tabs and the control fit between the
     margins: below ~810px the five-tab group plus the nowrap "Two-party"
     control overflowed the document 40px on every frame (worst at
     761-808px, right past the phone rung), so under 900px the control moved
     to its own row, the Latest table's 900px ctlrow handoff. The sixth tab,
     Demographics, moved the handoff up: the tabs measure 523px, the
     two-party control 365 and the split picker 341, and the section is 90%
     of the viewport, so the pair needs ~991px - under 1000px both controls
     take their own row (at 901 they had run the page 38px and 17px wide).
     .rd-ap-pctl's rules are ungated, so it dresses itself the same at 990
     as at 430. The Confidence tab and the picker's sixth button (Income)
     moved it again, measured 2026-10-07: the picker is 412px and the row
     fits from 1150px up, so under 1140px both controls take their row.
     The picker's seventh button (Birth country, 2026-10-09) moved it
     again, measured the same day: the picker is 513px and the row fits
     from ~1221px up, so under 1240px both controls take their row.
     Its rename to Other cuts (same day, the split's generalisation to
     one-off contrasts) took it down again, measured 2026-10-09: the
     picker is 496px and the row fits from 1205px up (document overflow
     first at 1200), so under 1220px both controls take their row.
     Renamed Offcuts 2026-10-13 (user call): three characters narrower,
     so the row's fit can only improve - the 1220 breakpoint stands
     conservatively until it is re-measured. */
  const ctlNarrow = useNarrow("(max-width: 1220px)");
  /* the demographics scale's nine ticks need the strip's full 410px: under
     ~1150px the column shrinks (273px at 1001) and "40 pts 30" collide, so
     the head keeps the phone's five */
  const demMid = useNarrow("(max-width: 1150px)");
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const contest = onM ? "onp" : "lnp";
  const rival = onM ? "One Nation" : "the Coalition";
  const rivalInk = onM ? "var(--onp-text)" : "var(--lnp-text)";
  /* the month dividers quote each month's average on the table's contest
     and basis - the page's monthly line, a summary of the month; a poll's
     own lean is held against the polls around it instead (rdApYd) */
  const monthAvg = React.useMemo(() => {
    const src = pub ? (onM ? (D.alt2pp || {}).alp_on : D.agg2pp) : (onM ? D.synthOn : D.synth2pp);
    const o = {};
    (src || []).forEach((d) => { o[d.ym] = d.alp != null ? d.alp : d.a; });   // the month's own estimate overwrites its election-anchor row
    return o;
  }, [onM, pub]);
  const figOf = (p) => rdApFig(p, onM, pub);
  /* twopp usual-lean strip height (= 56px): the twopp phone card must sit
     at the SAME row height as the primary facet's card (user call
     2026-10-03, "just make the row height identical"). Measured on the
     build at 390px: a primary card is 122px tall (11 padT +21.75 c1 +2 gap
     +16.19 c2 +2 gap +21.75 cprim +2->4 collapse margin +28 strip +8 padB
     with the line-box growth inside the cprim/cpic rows); the twopp card
     is identical minus its own bottom block, and at the shared 28px strip
     it stands 93.94 tall. To land at 122 the hassub strip must rise 28 to
     56 - the shared 28 + the primary facet's ~19px figure row + ~4px gap,
     the remaining ~=5px coming from the primary block's line/margin
     collapses. Applied as an inline height so the CSS 28px strip stays
     the lean-less default. */
  const primStripH = 56;

  /* a published-only matchup from an old link has no place in the redesign's
     table: the rare contests live in Includes now */
  React.useEffect(() => { if (measure !== "lnp" && measure !== "onp") onMeasure("onp"); }, [measure]);

  /* the facets this build walks: Confidence only where the confidence
     file's releases ship (never /vic/: the JUR build files no
     confidenceOnlyPolls), and /vic/'s polls carry no direction, issues or
     group figures */
  const FACET_IDS = ["twopp", "primary", "leadership", "direction", "issues", "demographics"]
    .concat((D.confidenceOnlyPolls || []).length ? ["confidence"] : [])
    .filter((f) => !window.JUR || !["direction", "issues", "demographics", "confidence"].includes(f));

  /* ---- today's figure and the polls it's built from ----------------------- */
  const today = window.AP.tppLatest(onM ? "alp_on" : "alp_lnp", pub ? "resp" : "imp");
  const upd = rdApDays(D.latest.updatedISO);
  const winDays = (D.latest.method && D.latest.method.windowDays) || 21;
  const inToday = (p) => { const t = rdApDays(p.released); return t > upd - winDays * 864e5 && t <= upd && figOf(p).a != null; };
  /* the confidence facet replaces `rows` with its releases, which carry no
     2PP figure - the window stays poll-based there, so an opened release's
     detail counts the same polls the other facets do */
  const win = (facet === "confidence" ? D.individualPolls : rows).filter(inToday);
  /* ---- the head and dek, and the hold ---------------------------------------
     Each facet heads the table with its own head and dek (user call
     2026-10-08): the 2PP's from rdApTppStory, the rest from rdApFacetStory.
     Their words run to different lengths. The slot sits BELOW the tab row
     (2026-10-18): a hop with the tab row on screen pins the tab row, so the
     story takes its own height and the table rides with it - nothing above
     the pin moves and there is nothing to correct. Until then the slot sat
     above the tabs at the tallest of every walkable story (the 6f25cf4
     walk floor), and a short story left lines of empty space over the
     table (user report 2026-10-18). A hop made deep in the table, with the
     tab row scrolled away, pins the bar instead, and there the slot holds
     its height (hedHold, set by pinAp) so a shorter story reflows nothing
     above the pin: Safari.app lands a scroll correction ~±2css off and
     never lets it settle, so a walk that corrected every hop crept the
     table down the screen (the round-13 lesson of the rdpinscroll skill:
     delete the reflow, never chase the correction). Only a deep hop to a
     taller story than the box grows it, once per new height; the next hop
     made with the tab row in view lets the slot go */
  const live = React.useMemo(() => {
    const st = facet === "twopp" ? rdApTppStory(onM, pub, upd)
      : facet === "primary" && consM ? rdApConsStory(upd)
      : facet === "confidence" ? rdApFacetStory(facet, upd, null, confBus)
      : facet === "demographics" ? rdApFacetStory(facet, upd, demSplit)
      : rdApFacetStory(facet, upd);
    return st && st.head ? st : null;
  }, [facet, onM, pub, consM, confBus, demSplit, upd]);
  const head = live ? live.head : null, dek = live ? live.dek : null;
  const [hedHold, setHedHold] = useState(0);
  const hedW0 = rdWords(head), hedW1 = rdWords(dek);
  const ctlRow = ctlNarrow && (facet === "twopp" || facet === "demographics" || facet === "primary" || facet === "confidence");
  /* the eyebrow sits above the tab row, the pin's anchor, so it walks a
     floor (the 6f25cf4 walk floor): Confidence's title and meta are both
     the longer pair, and past the phone wrap widths its meta alone went
     to a second line and lifted the whole section-head row 18px over the
     walk (user report 2026-10-08). The two states measure
     invisibly in .rd-ap-ebvar so only the words swap, never a height */
  const ebVarRef = useRef(null);
  const [ebFloor, setEbFloor] = useState(0);
  React.useLayoutEffect(() => {
    const box = ebVarRef.current;
    if (!box) return undefined;
    const measure = () => {
      let h = 0;
      for (const c of box.children) h = Math.max(h, c.getBoundingClientRect().height);
      h = Math.ceil(h - 0.01);
      setEbFloor((f) => (f === h ? f : h));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    [...box.children].forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [phone]);
  const todayTxt = today ? today.a.toFixed(1) : null;

  /* ---- paging, by whole months ---------------------------------------------- */
  /* the chronological views are the publication sort (PUBLISHED, the
     default since user call 2026-10-15 - two days as fieldwork-default
     2026-10-13/14) and the fieldwork sort (the head's second half). Rows
     file under their month ON THE SORT'S BASIS: publication month in the
     publication view, fieldwork month in the fieldwork one, so a wave
     that crosses a month-end in the press (the DemosAU MRP - Sep
     fieldwork, 12 Oct published) always sits beneath a divider its own
     sort speaks to, never raising a fieldwork divider one place out of
     monotonic order a la the half day's ym-keyed grouping. The month rows
     quote the same calendar month's aggregate figures either way. Three
     of 181 rows record no `published` (the 2025 election and two
     mid-redesign YouGov waves) - they file at their fieldwork basis in
     either view. */
  const byDate = (sort.key === "date" || sort.key === "pub") && sort.dir < 0;
  /* a row's month under the sort's basis: publication month when the pub
     sort sits live (the published day carried whole, sliced to its month),
     fieldwork month otherwise - and always so for the three rows that
     record no publication day */
  const gym = sort.key === "pub" ? (p) => (p.published ? p.published.slice(0, 7) : p.ym) : (p) => p.ym;
  const [minShown, setMinShown] = useState(30);
  const [flatLimit, setFlatLimit] = useState(40);
  const [showAll, setShowAll] = useState(false);
  const fKey = [q, [...sel].join(","), range, [...tagSel].join(","), facet, sort.key, sort.dir, measure, tppBasis].join("|");
  React.useEffect(() => { setMinShown(30); setFlatLimit(40); setShowAll(false); }, [fKey]);
  /* where the seven tabs outrun the row (phones, rd.css's .rd-ap-tabs
     scroller) the strip scrolls under a right-edge fade; .ovf turns the
     fade on only while something sits past an edge, so a row that fits
     never dims its last tab. A facet change - a tap, a swipe under the
     row, an arrow walk - glides the strip to show the chosen tab: the
     strip's own scroller only, never scrollIntoView, which would drag the
     page to the row (the house-lean strip's rule) */
  const apSec = () => document.getElementById("rd-ap-top");
  React.useEffect(() => {
    const sc = apSec() && apSec().querySelector('.rd-ap-tabs > [role="group"]');
    if (!sc) return undefined;
    const mark = () => {
      const over = sc.scrollWidth > sc.clientWidth + 1;
      sc.classList.toggle("ovf", over);
      sc.classList.toggle("ovf-l", over && sc.scrollLeft > 1);
      sc.classList.toggle("ovf-r", over && sc.scrollLeft < sc.scrollWidth - sc.clientWidth - 1);
    };
    mark();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mark) : null;
    if (ro) ro.observe(sc);
    sc.addEventListener("scroll", mark, { passive: true });
    return () => { if (ro) ro.disconnect(); sc.removeEventListener("scroll", mark); };
  }, []);
  React.useEffect(() => {
    const btn = apSec() && apSec().querySelector('.rd-ap-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const r = btn.getBoundingClientRect(), s = sc.getBoundingClientRect();
    if (r.left < s.left + 28) sc.scrollTo({ left: sc.scrollLeft + r.left - s.left - 28, behavior: SM });
    else if (r.right > s.right - 28) sc.scrollTo({ left: sc.scrollLeft + r.right - s.right + 28, behavior: SM });
  }, [facet]);
  const rowKey = (p) => p.pollster + "|" + p.released;
  const openRow = open ? sorted.find((p) => rowKey(p) === open) : null;
  let groups = null, flat = null, nShown = 0;
  if (byDate) {
    groups = [];
    for (const p of sorted) {
      const ym = gym(p);
      const g = groups[groups.length - 1];
      if (!g || g.ym !== ym) {
        const needOpen = openRow && !groups.some((x) => x.ym === gym(openRow));
        if (!showAll && nShown >= minShown && !needOpen) break;
        groups.push({ ym, list: [] });
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

  /* up/down poll to poll: with a row focused, an arrow steps the focus to the
     next poll (month dividers don't count, and the walk clamps at the last
     shown row); when the row was open, the open detail travels with the
     focus. Left and right walk the facet views, the tab row's own walk via
     onFacet, the focus re-seated at the same position when the new facet's
     scope hides the poll it sat on; Enter or space toggles. */
  const visRows = byDate ? groups.flatMap((g) => g.list) : flat;
  /* Confidence shows at every width: where the seven tabs outrun a phone's
     row the strip scrolls (the .ovf effect above), which also let
     Demographics keep its full name there (it was "Groups" while six had
     to fit) */
  const FACET_LAB = { twopp: "2PP", primary: "Primary", leadership: phone ? "Leaders" : "Leadership", direction: "Direction",
                      issues: "Issues", demographics: "Demographics", confidence: "Confidence" };
  const FACETS = FACET_IDS.map((id) => ({ id, label: FACET_LAB[id] }));
  /* demFam: the cuts-family table this row sits in (null in the flat
     view). The up/down walk then stays inside that family's row list -
     a wave sits in several family tables, and an unconditional walk would
     index it at its higher family and jump the focus there */
  const rowNav = (e, p, demFam) => {
    if (e.target !== e.currentTarget) return;
    const id = rowKey(p);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(open === id ? null : id); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const f = (FACETS.findIndex((x) => x.id === facet) + (e.key === "ArrowRight" ? 1 : -1) + FACETS.length) % FACETS.length;
      const rowSel = phone ? ".rd-ap-card" : ".rd-ap-row";
      const at = [...(bodyRef.current ? bodyRef.current.querySelectorAll(rowSel) : [])].indexOf(e.currentTarget);
      facetPick(FACETS[f].id);
      /* the leadership and direction facets self-arm a "has the numbers"
         scope, so the hop can filter the focused poll out of the table –
         React then drops its node, the focus falls to the page, and the
         next arrow would turn pages instead of views. Once the new facet
         has rendered, re-seat the focus on the row at the same position. */
      requestAnimationFrame(() => {
        const act = document.activeElement;
        if (act && act.closest && act.closest(rowSel)) return;
        const rows = bodyRef.current ? bodyRef.current.querySelectorAll(rowSel) : [];
        const nx = rows[Math.min(Math.max(at, 0), rows.length - 1)];
        /* preventScroll on a FACET-walk reseat: the pin owns the viewport
           here - a default focus scroll can nudge the page to fit the
           re-keyed row under the datasheet scrub (round-2 crawl theory;
           not the culprit, that was row anchors - see pinAp - but right) */
        if (nx) nx.focus({ preventScroll: true });
      });
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const walk = demFam ? demFamRowsOf(demFam) : visRows;
    const base = demFam ? demFamOffset(demFam) : 0;
    const j = walk.indexOf(p) + (e.key === "ArrowDown" ? 1 : -1);
    const nx = walk[j];
    if (!nx) return;
    if (open === id) setOpen(rowKey(nx));
    const rows = bodyRef.current ? bodyRef.current.querySelectorAll(phone ? ".rd-ap-card" : ".rd-ap-row") : [];
    if (rows[base + j]) rows[base + j].focus();
  };

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
  const toSearch = () => {
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: SM, block: "center" });
    setTimeout(() => el.focus({ preventScroll: true }), 350);
  };
  const nFilters = sel.size + tagSel.size + (range !== "all" ? 1 : 0) + (q.trim() ? 1 : 0);
  const shownPills = pills.filter((f) => !f.auto).map((f) => (f.k[0] === "t" && RD_AP_TAGS[f.k.slice(1)] ? { ...f, lab: rdApTagLab(f.k.slice(1)) } : f));

  /* ---- the rows ------------------------------------------------------------ */
  const [tip, setTip] = useState(null);
  /* A facet tab's figures fade in rather than cut in (rd.css): once a tab
     has been pressed, each row carries rd-ap-sw, and its facet class names
     the fade, so a new facet is a new fade and it restarts on every row.
     On the rows, not the section: a change on the section restyled the whole
     table inside the press, tripling what it cost. */
  const facetWas = useRef(facet), facetSwaps = useRef(0);
  if (facetWas.current !== facet) { facetWas.current = facet; facetSwaps.current += 1; }
  const cls = { twopp: "rd-ap-c2pp", primary: "rd-ap-cprim", leadership: "rd-ap-clead", direction: "rd-ap-cdir", issues: "rd-ap-ciss", demographics: "rd-ap-cdem", confidence: "rd-ap-cconf" }[facet]
    + (facetSwaps.current ? " rd-ap-sw" : "");
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
  /* the primary strip's scale: consideration figures run past 60 on
     Essential's and RedBridge/Accent's looser tiers (the would-not tier
     tops 69), intention tops out near 40 */
  const PMAX = (facet === "primary" && consM) ? 70 : 45;
  const PTKS = [];
  for (let v = 0; v < PMAX; v += 10) PTKS.push(v);
  const PLAST = PTKS[PTKS.length - 1];
  const pdx = (v) => (Math.max(0, Math.min(PMAX, v)) / PMAX) * 100;
  /* dots whose figures land within the glyph's width of each other paint
     one over another and the later fill erases the earlier whole - the
     YouGov consideration wave with Labor and One Nation both on 38 showed
     One Nation alone (user call 2026-10-15: "if there's any dot overlap
     over a certain amount, put one dot on top of the other - there's
     enough space for it"). Any run of dots closer than ~11px on the track
     (the 10px glyph plus its halo) fans out into a little tower instead:
     the 28px strip holds ±6px of centre, so a stack spans its full height
     and both neighbours keep their own ladder position in x. */
  const rdApDodge = (xs) => {
    const R = 3.2; /* ≈ the 13px glyph-and-halo's share of the 334-362px track */
    const tops = new Array(xs.length).fill(0);
    const ord = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
    for (let i = 0; i < ord.length;) {
      let j = i;
      while (j + 1 < ord.length && xs[ord[j + 1]] - xs[ord[j]] < R) j++;
      if (j > i) {
        const k = j - i + 1;
        for (let n = 0; n < k; n++) tops[ord[i + n]] = (n - (k - 1) / 2) * (12 / (k - 1));
      }
      i = j + 1;
    }
    return tops;
  };
  /* primary columns rank by the site aggregate like every other party
     listing - user call 2026-10-03: a fixed Labor, Coalition, Greens, One
     Nation, Other ladder is "unprincipled" */
  const prims = rdApPrimList((D.latest && D.latest.primaryOrder) || RD_AP_PRIM_FALLBACK);
  /* the demographics facet: each party's vote in one of a poll's groups
     minus its vote in another (user call 2026-10-04, design A of three
     mocked: the Primary facet's five figures and strip, with gaps for
     primaries). One scale for every split, 40 points either way of Even, so
     moving from age to gender pulls the dots in - which is the finding - and
     a dot never moves under the reader as the filters change */
  const SPLITS = window.DEM_SPLITS || [];
  const spl = SPLITS.find((x) => x.id === demSplit) || SPLITS[0];
  /* the scale's end labels: a split whose pairs all cut one axis keeps its
     own lo/hi (income's pairs disagree on bracket widths but all point
     lower→higher). An odd-cuts split (pairs carrying their own caps, the
     d1a1 convention) can't be spanned by any one caption pair, so the caps
     come from the pair every visible row shares - and when the rows mix
     pairs, no labels show at all rather than lying about one of the rows */
  /* Other-cuts families (the d1a1 def's `fams`, user call 2026-10-10 "you
     can make another table … one under the other"): one stacked table per
     cut family, newest rows first in each, headed by the family's own caps
     line. A wave sits in every family its table covers (YouGov's weekly
     crosstabs carry working, children and class cuts on one wave), so the
     same poll can draw a row in several tables, each with that family's
     pair. Only the demographics facet's date view stacks; a column sort
     falls back to the flat pair-naming view, and the surviving split state
     must not leak the stacked tables onto the other facets (the split
     persists across a facet hop) */
  const demFams = facet === "demographics" && (spl.fams || []).length > 1 ? spl.fams : null;
  /* each family table folds away from its own head. Session state like the
     split itself: it rides facet and split hops (they persist by design too)
     and resets only with the component. Every family starts SHUT except a
     one-entry table, which greets you open (user call 2026-10-13: "keep
     those rows closed by default … UNLESS number of entries < 2") - the
     seed lands on the first render the fams exist in, from the rows then
     listed, so opening the archive on another facet doesn't miss it. */
  const famSeed = React.useRef(false);
  const [famShut, setFamShut] = useState(() => new Set());
  if (!famSeed.current && demFams) {
    famSeed.current = true;
    const shut = new Set();
    for (const fam of demFams) if (sorted.filter((p) => window.demPairOf(p, demSplit, fam.id)).length >= 2) shut.add(fam.id);
    if (shut.size) setFamShut(shut);
  }
  const toggleFam = (id) => setFamShut((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [demCapLo, demCapHi] = (() => {
    if (demFams && byDate) return [null, null];
    if (!spl.pairs.some((p) => p[3] != null && p[4] != null)) return [spl.lo, spl.hi];
    const found = new Map();
    for (const p of rows) {
      const pr = window.demPairOf(p, demSplit);
      if (pr) found.set(pr.a + "" + pr.b, [pr.loCap, pr.hiCap]);
    }
    if (found.size === 1) return [...found.values()][0];
    if (found.size === 0) return [spl.lo, spl.hi];
    return [null, null];
  })();
  /* …continued: with fams stacked the caps live on each family's table
     head, so the split's own end labels step aside */
  const demFamTables = demFams && byDate ? demFams.map((fam) => {
    const list = (groups || []).flatMap((g) => g.list).filter((p) => window.demPairOf(p, demSplit, fam.id));
    const gs = [];
    for (const p of list) {
      const ym = gym(p);
      if (!gs.length || gs[gs.length - 1].ym !== ym) gs.push({ ym, list: [] });
      gs[gs.length - 1].list.push(p);
    }
    return { fam, groups: gs, rows: list };
  }).filter((t) => t.rows.length) : null;
  // each family's table caps: the [3]/[4] pair labels every visible row shares
  const famCapsOf = (t) => {
    const found = new Map();
    for (const p of t.rows) {
      const pr = window.demPairOf(p, demSplit, t.fam.id);
      if (pr && pr.loCap != null && pr.hiCap != null) found.set(pr.a + "" + pr.b, [pr.loCap, pr.hiCap]);
    }
    return found.size === 1 ? [...found.values()][0] : [null, null];
  };
  // the fam-table a wave's row sits in, and its index among every fam row above it
  // (a folded family renders no rows, so it contributes nothing to DOM positions)
  const demFamRowsOf = (famId) => (demFamTables ? ((demFamTables.find((t) => t.fam.id === famId) || {}).rows || []) : []);
  const demFamOffset = (famId) => { let o = 0; if (demFamTables) for (const t of demFamTables) { if (t.fam.id === famId) break; o += famShut.has(t.fam.id) ? 0 : t.rows.length; } return o; };
  const DEM_M = 40;
  const gx = (v) => ((Math.max(-DEM_M, Math.min(DEM_M, v)) + DEM_M) / (2 * DEM_M)) * 100;
  // whole points: the groups are a few hundred people each, a decimal claims too much
  const gapTxt = (v) => (v == null ? "—" : Math.abs(v) < 0.5 ? "0" : (v > 0 ? "+" : "−") + Math.abs(Math.round(v)));
  const DEM_PNAME = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "others" };
  // the issues facet's six issues (ISS_MAP, the d1a1 asset) and the four parties it draws
  const IMAP = window.ISS_MAP || [];
  const IMAP_LAB = window.ISS_MAP_LAB || {};
  const IP4 = prims.filter((k) => k.id !== "oth");
  // the two one-word names that outgrow a narrow column break at a soft hyphen, only when they must
  const issHyph = (id) => (id === "immigration" ? <>Immig&shy;ration</> : id === "economy" ? <>Econ&shy;omy</> : IMAP_LAB[id]);
  const demScale = (short) => {
    const ticks = short ? [[-40, "40"], [-20, "20"], [0, "Even"], [20, "20"], [40, "40 pts"]]
      : [[-40, "40 pts"], [-30, "30"], [-20, "20"], [-10, "10"], [0, "Even"], [10, "10"], [20, "20"], [30, "30"], [40, "40 pts"]];
    return (
      <span className="rd-ap-scale" aria-hidden="true">
        <span className="rd-ap-in">
          <b className="rd-ap-scl">{demCapLo ? "◀ " + demCapLo : ""}</b>
          <b className="rd-ap-scr">{demCapHi ? demCapHi + " ▶" : ""}</b>
          {ticks.map(([v, lab]) => <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "") + (short && v === -DEM_M ? " start" : "") + (short && v === DEM_M ? " end" : "")} style={{ left: gx(v) + "%" }}>{lab}</span>)}
        </span>
      </span>
    );
  };
  /* the confidence facet's meter: the four gauges' own printed figures on
     ONE fixed 40–120 scale - fixed so no release's dot moves under the
     reader as the filters change (this term's prints run 58.8 to NAB's
     107, so the window can't slide up to sit symmetric on 100). The
     indices print 100-neutral; NAB's net balance prints 0-neutral and its
     dot is drawn +100 just as the panel chart draws its line up, while the
     figure shown stays NAB's own - its rows say "net balance" under it,
     the note sitting with the only rows it explains. */
  const CF_LO = 40, CF_HI = 120;
  const cfx = (v) => ((Math.max(CF_LO, Math.min(CF_HI, v)) - CF_LO) / (CF_HI - CF_LO)) * 100;
  const confPlot = (c) => c.v + (c.vs === 0 ? 100 : 0);
  /* the confidence panel's inks, per house as the panel splits them: the
     Roy Morgan gauges plum, the other house's gold - the table can't dash
     one dot, so the twin's house is named in the row */
  const confInk = (c) => (c.k === "consumer" || c.k === "business" ? "var(--confidence-main)" : "var(--confidence-alt)");
  /* each house's own print: the indices carry decimals, NAB's net balance
     whole numbers (the panel's NICE does the same) */
  const confFig = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const confChg = (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + confFig(Math.abs(v));
  /* its head reads the way the two-party and group strips do: which way
     is which at the ends (left of neutral, more pessimists than
     optimists), the ticks under them. Every tick fits at every width -
     a phone's 66px between ticks clears "Neutral" - and there, as on the
     other phone heads, the end labels tuck inside the card */
  const CONF_TKS = [40, 60, 80, 100, 120];
  const confScale = (phone) => (
    <span className="rd-ap-scale" aria-hidden="true">
      <span className="rd-ap-in">
        <b className="rd-ap-scl">◀ Pessimistic</b>
        <b className="rd-ap-scr">Optimistic ▶</b>
        {CONF_TKS.map((v) => (
          <span key={v} className={"rd-ap-tk" + (v === 100 ? " mid" : "") + (phone && v === CF_LO ? " start" : "") + (phone && v === CF_HI ? " end" : "")}
                style={{ left: cfx(v) + "%" }}>{v === 100 ? "Neutral" : v}</span>
        ))}
      </span>
    </span>
  );

  const colHead = (
    <div className={"rd-ap-hrow " + cls} role="row">
      <span className="rd-ap-hc1">{th("Pollster", "pollster")}</span>
      {/* the date column's head is TWO sorts, halves of one cell (user call
          2026-10-13: "FIELDWORK/PUB - click on fieldwork, it's sorted by
          fieldwork, click on pub, sorted by publication"; Pub promoted to
          PUBLISHED and first chair two days later, user call 2026-10-15:
          "put pub first, before fieldwork, and call it 'PUBLISHED' and have
          it selected by default"). Two nine-letter labels can't share the
          120px track on one line, so the pair stacks - PUBLISHED above
          FIELDWORK, the bottom line standing on the shared label baseline
          (the phrase's slash went with the line). The month dividers file
          by whichever half sits live (gym above) */}
      <span className="rd-ap-hfp">
        {th("Published", "pub", { title: "Sort by the day the poll came out, newest first" })}
        {th("Fieldwork", "date", { title: "Sort by fieldwork, newest first" })}
      </span>
      {th("Sample", "sample", { right: true })}
      <span></span>
      {facet === "twopp" && <>
        {th("Labor v " + (onM ? "One Nation" : "Coalition"), "alp", { title: "Sort by Labor’s share", wrap: true })}
        <span role="columnheader" aria-label={"Poll lean against the " + (RD_AP_KAL ? "trend" : "average of the other polls fielded around it")} className="rd-ap-hpic"><RdApScale onM={onM} /></span>
        {th("Lean", "lean", { right: true, title: "Sort by poll lean, towards Labor first" })}
        {/* the desktop table's last column (user call 2026-10-03: "the
            column heading can be wrapped if it can't fit" - .rd-ap-th.wrap
            lets it break onto a second line; not sortable: its figure is the
            house's lean as of each poll, and the classic table's hfx sort key
            measures a different quantity) */}
        <span role="columnheader" className="rd-ap-th r wrap" title="The pollster’s lean against the other pollsters as of this poll – what the average takes out of it, and the tick on the strip. The House-lean panel below traces it month by month">House lean</span>
        <span></span>
      </>}
      {facet === "primary" && <>
        <span className="rd-ap-pnums rd-ap-hpn">{prims.map((k) => <React.Fragment key={k.id}>{th(k.lab, "p." + k.id, { color: k.ink })}</React.Fragment>)}</span>
        <span className="rd-ap-hpic" aria-hidden="true">
          <span className="rd-ap-cap">{consM ? "Voting consideration" : "Primary vote"}</span>
          <span className="rd-ap-in">{PTKS.map((v) => <span key={v} className="rd-ap-tk" style={{ left: pdx(v) + "%" }}>{v}{v === PLAST ? "%" : ""}</span>)}</span>
        </span>
        <span></span>
      </>}
      {facet === "leadership" && <>
        {th(window.JUR ? "Better " + window.JUR.office.alb : "Better PM", "ppm.alb")}
        <span className="rd-ap-hpic" aria-hidden="true">
          <span className="rd-ap-cap">Net rating: approve minus disapprove</span>
          <span className="rd-ap-in">{ldTicks.map((v) => <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "")} style={{ left: ldx(v) + "%" }}>{v === 0 ? "Even" : rdSigned(v, 0)}</span>)}</span>
        </span>
        <span className="rd-ap-nets rd-ap-hnets">
          {th(window.JUR ? "Prem" : "Alb", "appr.albNet", { right: true, color: "var(--alp-text)" })}
          {th(window.JUR ? "Opp" : "Tay", "appr.taylorNet", { right: true, color: "var(--lnp-text)" })}
          {th(window.JUR ? "ON" : "Han", "appr.hansonNet", { right: true, color: "var(--onp-text)" })}
        </span>
      </>}
      {facet === "direction" && <>
        {th("Right", "dir.right", { color: "var(--mood-pos)" })}
        {th("Wrong", "dir.wrong", { color: "var(--mood-neg)" })}
        {th("Unsure", "dir.unsure")}
        <span className="rd-ap-hpic rd-ap-hdir"><span className="rd-ap-cap">Right direction or wrong track, %</span></span>
        {th("Net", "dir.net", { right: true })}
      </>}
      {facet === "issues" && <>
        <span className="rd-ap-imap rd-ap-hpn">{IMAP.map((id) => <span key={id} role="columnheader" className="rd-ap-th wrap" title={"The party rated best on " + (IMAP_LAB[id] || id).toLowerCase() + " by the most voters, and its lead over the next, in points"}>{issHyph(id)}</span>)}</span>
        <span></span>
      </>}
      {facet === "demographics" && <>
        <span className="rd-ap-pnums rd-ap-hpn">{prims.map((k) => <React.Fragment key={k.id}>{th(k.lab, "dem." + k.id, { color: k.ink, title: "Sort by " + DEM_PNAME[k.id] + "’s gap between the two groups" })}</React.Fragment>)}</span>
        <span role="columnheader" aria-label={demCapLo && demCapHi ? "Each party’s gap between the two groups, from stronger with " + demCapLo.toLowerCase() + " to stronger with " + demCapHi.toLowerCase() + " voters" : "Each party’s gap between the two groups named on its row"} className="rd-ap-hpic">{demScale(demMid)}</span>
        <span></span>
      </>}
      {/* Change ends the row beside the chevron, as every facet's own
          summary figure does (Lean, the leaders' nets, Net) */}
      {facet === "confidence" && <>
        {th("Figure", "conf.v", { title: "Sort by the gauge’s printed figure (the panel chart’s dot)" })}
        <span role="columnheader" aria-label="Each gauge’s figure on a fixed 40–120 scale, more pessimists than optimists below 100 and more optimists above it – NAB’s net balance drawn 100 points up, its figure printed as NAB’s own" className="rd-ap-hpic">{confScale(false)}</span>
        {th("Change", "conf.chg", { right: true, title: "Change on the gauge’s own previous release – an asterisk marks one calculated from the previous release, not printed" })}
      </>}
      <span></span>
    </div>
  );

  const pollsterCell = (p) => (
    <span role="rowheader" className="rd-ap-who">
      <b>{rdPollNameLink(p, "rd-ap-ext")}</b>
      <span className="rd-ap-sub">{p.client}</span>
    </span>
  );
  const fieldTxt = (p) => (p.fieldPending ? "TBC" : byDate ? p.field : p.field + " ’" + String(p.year).slice(2));
  const fieldCell = (p) => (
    <span role="cell" className="rd-ap-when"><b>{p.fieldPending ? rdFieldTbc(p) : fieldTxt(p)}</b>{p.published && <span className="rd-ap-sub">released {rdDate(p.published.slice(0, 10))}</span>}</span>
  );
  const sampleCell = (p) => (
    <span role="cell" className="rd-ap-n"><span>{p.sample != null ? p.sample.toLocaleString() : "—"}</span>{p.sampleEff != null ? <span className="rd-ap-sub">eff. {p.sampleEff.toLocaleString()}</span>
      : rdEffTbc(p) || rdEffMissing(p) ? <span className="rd-ap-sub">{rdEffNote(p)}</span>
      /* an MRP files no effective sample (its APC statement prints "n/a for
         MRP"), so say so rather than leave the sub-line empty */
      : / \(MRP\)$/.test(p.pollster || "") ? <span className="rd-ap-sub">eff. n/a</span> : null}</span>
  );
  const tipCard = (p, f, m) => {
    const lean = p.lean;
    const he = rdApHe(p, onM, pub);
    const outside = rdApInside(rdApAdj(p, onM, pub), m) === "outside";
    const way = (v) => (Math.abs(v) < 0.05 ? "level" : rdSigned(v, 1) + " to " + (v > 0 ? "Labor" : onM ? "One Nation" : "Coalition"));
    const left = Math.max(22, Math.min(78, rdApX(lean)));
    return (
      <span className="tip rd-ap-tip" style={{ left: left + "%" }} role="tooltip">
        <span className="tip-title">{p.pollster}, {p.fieldPending ? "TBC" : p.field}</span>
        <span className="tip-row"><span className="tip-label">Labor v {onM ? "One Nation" : "Coalition"}, {pub ? "published" : "implied"}</span><span className="tip-val">{f.txtA}</span></span>
        <span className="tip-row"><span className="tip-label">{RD_AP_KAL ? "The trend" : "The polls around it"}</span><span className="tip-val">{rdApYd(p, onM, pub) ? rdApYd(p, onM, pub).v.toFixed(1) : "—"}</span></span>
        <span className="tip-row"><span className="tip-label">Lean</span><span className="tip-val">{way(lean)}</span></span>
        {he != null && <span className="tip-row"><span className="tip-label">Usual lean</span><span className="tip-val">{way(he)}</span></span>}
        {m != null && <span className="tip-row"><span className="tip-label">95% margin</span><span className="tip-val">±{m.toFixed(1)}</span></span>}
        {outside && <span className="rd-ap-tipnote">{he != null ? "Further from its pollster’s usual lean than its margin, as about one poll in 20 should be" : "Outside its margin, as about one poll in 20 should be"}</span>}
      </span>
    );
  };
  const rowFor = (p, demFam) => {
    const id = rowKey(p);
    const isOpen = open === id;
    const arrived = !!focus && focus.key === id;
    const toggle = () => setOpen(isOpen ? null : id);
    let figs, pic, val = <span></span>, right1 = null, right2 = null, body = null, hlCell = null, consEdge = null;
    /* the house's lean AS OF THIS POLL on the table's basis and matchup
       (rdApHe, gen-data §3c) - ONE derivation for the desktop twopp table's
       last column (user call 2026-10-03: "add a 'house lean' column to the
       end of the all poles table") and the phone card's sub-line. It was the
       house's latest lean, constant down its rows, but the strip's tick and
       its margin test use the lean the average took out of THIS poll, and
       on older rows the two parted by up to 2.5 points, so Lean minus House
       lean stopped equalling the gap judged (user call 2026-10-06). Recent
       rows still read today's lean. */
    const hl = facet === "twopp" ? rdApHe(p, onM, pub) : null;
    if (facet === "twopp") {
      const f = figOf(p);
      const m = f.a != null ? rdPollMargin(p, contest, pub) : null;
      const main = f.a == null ? <span className="rd-ap-none">—</span>
        : <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{f.txtA}</span><span className="rd-ap-dash"> – </span><span style={{ color: rivalInk }}>{f.txtB}</span></b>;
      const sub = f.a == null ? f.none : f.sub;
      figs = <span role="cell" className="rd-ap-fig">{main}{sub && <span className="rd-ap-sub">{sub}</span>}</span>;
      const hovered = tip === id && p.lean != null && !phone;
      const against = RD_AP_KAL ? "the trend" : "the other polls fielded around it";
      const aria = p.lean == null ? "No figure to set against " + against
        : (Math.abs(p.lean) < 0.05 ? "Level with " + against : rdSigned(p.lean, 1) + " points against " + against + ", towards " + (p.lean > 0 ? "Labor" : rival))
          + (rdApHe(p, onM, pub) != null && Math.abs(rdApHe(p, onM, pub)) >= 0.05 ? "; its pollster usually leans " + rdSigned(rdApHe(p, onM, pub), 1) : "")
          + (m != null ? "; 95% margin ±" + m.toFixed(1) : "");
      pic = (
        <span className="rd-ap-pic" role="img" aria-label={aria} onMouseEnter={() => setTip(id)} onMouseLeave={() => setTip(null)}>
          <RdApStrip lean={p.lean} moe={m} he={rdApHe(p, onM, pub)} onM={onM} phone={phone} tip={hovered ? tipCard(p, f, m) : null} />
        </span>
      );
      val = <span role="cell" className="rd-ap-val" style={{ color: rdApLeanInk(p.lean, onM) }}>{p.lean == null ? "—" : rdApSigned(p.lean)}</span>;
      right1 = main;
      right2 = sub ? <span className="rd-ap-sub">{sub}</span> : null;
      /* the desktop table's last column: the house's lean as of the poll, the
         same figure the phone card's sub-line carries (hl is derived above
         the branch) */
      hlCell = <span role="cell" className="rd-ap-hl" style={{ color: rdApLeanInk(hl, onM) }}>{hl == null ? "—" : rdApSigned(hl)}</span>;
      /* phone card: the house's lean as of the poll rides under the figure (user
         calls 2026-10-03: "add below '+1.7', 'Usual lean -0.3'", then
         renamed House lean - black label, party-tinted number - the
         same figure the strip's tick marks); the figure
         itself then got its own "Lean " label (user call same day: "also
         add the word Lean to the lean above it - eg ... 'Lean +1.7'"),
         same label-plain/figure-tinted pattern as the sub-line */
      /* the strip's height pins the twopp card to the SAME row height as
         the primary facet's card (user call 2026-10-03, "just make the
         row height identical to that in the primary facet") via the
         fixed primStripH constant (see its derivation comment). */
      body = <div className={"rd-ap-cpic" + (hl != null ? " hassub" : "")} style={hl != null && primStripH ? { height: primStripH + "px" } : null}>{pic}<span className="rd-ap-cval">{p.lean == null ? "—" : <>Lean <span style={{ color: rdApLeanInk(p.lean, onM) }}>{rdApSigned(p.lean)}</span></>}</span>
        {hl != null && <span className="rd-ap-cvalsub">House lean <span style={{ color: rdApLeanInk(hl, onM) }}>{rdApSigned(hl)}</span></span>}
      </div>;
    } else if (facet === "primary") {
      const pr = (consM && p.cons) || p.p || {};
      /* under consM every row names its consideration basis - on the
         desktop under the figures, on a phone card at the head's right
         edge where the demographics facet's pair names sit (user call
         2026-10-15, mirroring "18–34 v 55+, in points"). A wave carrying
         the extra ranges (RedBridge/Accent's April 2026 0–10 battery;
         Essential's Feb and June 2026 definitely/open/never banding)
         opens on the default "would consider" (loose) range, the firmer
         and never bands a press away on the same figures
         (rdApConsDef) */
      const tiers = !(consM && p.cons) ? null
        : (p.consLoose ? [{ m: p.consLoose, lab: rdApConsTier(p, "loose").tab }] : [])
          .concat([{ m: p.cons, lab: p.consBasis || "Would consider" }])
          .concat(p.consNot ? [{ m: p.consNot, lab: rdApConsTier(p, "not").tab }] : [])
          .concat(p.consNever ? [{ m: p.consNever, lab: rdApConsTier(p, "never").tab }] : []);
      const primNums = (m) => <span className="rd-ap-pnums">{prims.map((k) => <b key={k.id} style={{ color: k.ink }}>{m[k.id] != null ? rdApPrimFig(m[k.id]) : "—"}</b>)}</span>;
      const primStrip = (m, ariaPre) => {
        const cols = prims.filter((k) => m[k.id] != null), tops = rdApDodge(cols.map((k) => pdx(m[k.id])));
        return (
        <span className="rd-ap-pic" role="img" aria-label={ariaPre + cols.map((k) => k.lab + " " + rdApNum(m[k.id])).join(", ")}>
          <span className="rd-ap-in">
            {PTKS.map((v) => <i key={v} className="rd-ap-gl" style={{ left: pdx(v) + "%" }}></i>)}
            {cols.map((k, di) => (
              <i key={k.id} className="rd-ap-dot" style={{ left: pdx(m[k.id]) + "%", background: k.dot, ...(tops[di] ? { top: "calc(50% + " + tops[di] + "px)" } : null) }}></i>
            ))}
          </span>
        </span>
        );
      };
      const primCardNums = (m) => <div className="rd-ap-cprim">{prims.map((k) => <span key={k.id}><em>{k.lab}</em><b style={{ color: k.ink }}>{m[k.id] != null ? rdApPrimFig(m[k.id]) : "—"}</b></span>)}</div>;
      if (tiers) {
        /* the cycler's fragment is BOTH cells (figures cell then strip) on
           the desktop, so it parks at the figs slot and pic stays empty;
           on the phone it owns the whole card past the chevron - its
           label rides the card head wrapper the phone return hands down */
        if (phone) consEdge = (cardHead) => <RdApConsCyc tiers={tiers} phone primNums={primNums} primStrip={primStrip} primCardNums={primCardNums} cardHead={cardHead} />;
        else { figs = <RdApConsCyc tiers={tiers} primNums={primNums} primStrip={primStrip} primCardNums={primCardNums} />; pic = null; }
      } else {
        figs = <span role="cell" className="rd-ap-pnums">{prims.map((k) => <b key={k.id} style={{ color: k.ink }}>{pr[k.id] != null ? rdApPrimFig(pr[k.id]) : "—"}</b>)}</span>;
        pic = primStrip(pr, "Primary vote: ");
        body = <>
          {primCardNums(pr)}
          <div className="rd-ap-cpic">{pic}</div>
        </>;
      }
    } else if (facet === "leadership") {
      const sets = window.ppmContests(p);
      const opp = sets.find((s) => (s.taylor != null || s.ley != null) && s.hanson == null);
      const han = sets.find((s) => s.hanson != null && s.taylor == null && s.ley == null);
      const three = sets.find((s) => s.hanson != null && (s.taylor != null || s.ley != null));
      const oppV = (s) => (s.taylor != null ? s.taylor : s.ley);
      const oppN = (s) => apWho(p, "taylor", s.taylor != null ? "Taylor" : "Ley");
      const two = (x, y, yInk) => <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{x}</span><span className="rd-ap-dash"> – </span><span style={{ color: yInk }}>{y}</span></b>;
      let main, sub;
      if (opp) { main = two(opp.alb, oppV(opp), "var(--lnp-text)"); sub = han ? "v " + oppN(opp) + ", " + han.alb + "–" + han.hanson + " v " + apWho(p, "hanson", "Hanson") : apWho(p, "alb", "Albanese") + " v " + oppN(opp); }
      else if (three) {
        main = <b className="rd-ap-pairfig"><span style={{ color: "var(--alp-text)" }}>{three.alb}</span><span className="rd-ap-dash"> – </span><span style={{ color: "var(--lnp-text)" }}>{oppV(three)}</span><span className="rd-ap-dash"> – </span><span style={{ color: "var(--onp-text)" }}>{three.hanson}</span></b>;
        sub = "three-way";
      } else if (han) { main = two(han.alb, han.hanson, "var(--onp-text)"); sub = apWho(p, "alb", "Albanese") + " v " + apWho(p, "hanson", "Hanson"); }
      else { main = <span className="rd-ap-none">—</span>; sub = "not asked"; }
      figs = <span role="cell" className="rd-ap-fig">{main}<span className="rd-ap-sub">{sub}</span></span>;
      const a = p.appr || {};
      const mb = a.metricBy || {};
      const ldCols = [["hansonNet", "var(--onp)"], ["taylorNet", "var(--lnp)"], ["albNet", "var(--alp)"]].filter(([k]) => a[k] != null);
      const ldTops = rdApDodge(ldCols.map(([k]) => ldx(a[k])));
      pic = (
        <span className="rd-ap-pic" aria-hidden="true">
          <span className="rd-ap-in">
            {/* the inner ticks only: like every signed strip, the ends go unruled */}
            {ldTicks.filter((v) => v !== 0 && v !== LD.lo && v !== LD.hi).map((v) => <i key={v} className="rd-ap-gl" style={{ left: ldx(v) + "%" }}></i>)}
            <i className="rd-ap-avg" style={{ left: ldx(0) + "%" }}></i>
            {ldCols.map(([k, col], di) => (
              <i key={k} className="rd-ap-dot" style={{ left: ldx(a[k]) + "%", background: col, ...(ldTops[di] ? { top: "calc(50% + " + ldTops[di] + "px)" } : null) }}></i>
            ))}
          </span>
        </span>
      );
      const fav = ["alb", "taylor", "hanson"].some((k) => mb[k] === "fav" && a[k + "Net"] != null);
      const nets = (
        <span className="rd-ap-nets">
          {[["albNet", "var(--alp-text)", window.JUR ? "Prem" : "Alb"], ["taylorNet", "var(--lnp-text)", window.JUR ? "Opp" : "Tay"], ["hansonNet", "var(--onp-text)", window.JUR ? "ON" : "Han"]].map(([k, col, lab]) => (
            <b key={k} style={{ color: col }}>{phone && <em>{lab}</em>}{a[k] != null ? rdSigned(a[k], 0) : "—"}</b>
          ))}
        </span>
      );
      val = <span role="cell" className="rd-ap-netcell">{nets}{fav && <span className="rd-ap-sub">favourability</span>}</span>;
      right1 = main;
      right2 = <span className="rd-ap-sub">{sub}</span>;
      body = <><div className="rd-ap-cpic">{pic}</div><div className="rd-ap-cnets"><span className="rd-ap-sub">Net rating{fav ? ", favourability" : ""}</span><span className="rd-grow"></span>{nets}</div></>;
    } else if (facet === "direction") {
      const d = p.dir;
      const dc = (d && d.chg) || {};
      /* a two-answer reading (SEC Newgate's right v wrong sums to 100) has
         no unsure share to print: a dash, not a 0. The three share cells
         keep one shape - a figure over its change - so the unsure figure
         sits on the same line as the other two, its slot held open when
         only they moved */
      const noU = !!d && !(d.unsure > 0);
      /* a change at its figures' printed precision: Roy Morgan prints
         halves (21.5 after 21), so its move is 0.5, not a rounded 1 */
      const dChg = (v) => rdApChg(v, v != null && !Number.isInteger(v) ? 1 : 0);
      const uChg = noU ? null : dChg(dc.unsure);
      const subRow = d && (dChg(dc.right) || dChg(dc.wrong) || uChg);
      figs = d ? <>
        <span role="cell" className="rd-ap-dnum"><b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b>{dChg(dc.right) && <span className="rd-ap-sub">{dChg(dc.right)}</span>}</span>
        <span role="cell" className="rd-ap-dnum"><b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b>{dChg(dc.wrong) && <span className="rd-ap-sub">{dChg(dc.wrong)}</span>}</span>
        <span role="cell" className="rd-ap-dnum"><span>{noU ? "—" : rdApNum(d.unsure)}</span>{subRow && <span className="rd-ap-sub" aria-hidden={uChg ? undefined : "true"}>{uChg || "\u00a0"}</span>}</span>
      </> : <><span role="cell" className="rd-ap-none">—</span><span></span><span></span></>;
      pic = d ? (
        <span className="rd-ap-pic" role="img" aria-label={`Right direction ${rdApNum(d.right)}%, ${noU ? "" : `unsure ${rdApNum(d.unsure)}%, `}wrong track ${rdApNum(d.wrong)}%`}>
          <span className="rd-ap-dbar">
            <i style={{ flexGrow: d.right, background: "var(--mood-pos)" }}></i>
            {/* a collapsed unsure strip still takes the flex gaps both sides,
                doubling the divider — a no-unsure reading renders the middle
                segment not at all, so one 2px separator divides the bar */}
            {d.unsure > 0 && <i style={{ flexGrow: d.unsure }} className="u"></i>}
            <i style={{ flexGrow: d.wrong, background: "var(--mood-neg)" }}></i>
          </span>
        </span>
      ) : <span className="rd-ap-pic"></span>;
      val = <span role="cell" className="rd-ap-val">{d ? rdSigned(d.net, 0) : "—"}</span>;
      right1 = d ? <b className="rd-ap-pairfig">Net {rdSigned(d.net, 0)}</b> : <span className="rd-ap-none">—</span>;
      body = d ? <><div className="rd-ap-cpic">{pic}</div>
        <div className="rd-ap-csub">Right <b style={{ color: "var(--mood-pos)" }}>{rdApNum(d.right)}</b>, wrong <b style={{ color: "var(--mood-neg)" }}>{rdApNum(d.wrong)}</b>{noU ? "" : ", unsure " + rdApNum(d.unsure)}</div></> : null;
    } else if (facet === "issues") {
      /* who leads on what (user call 2026-10-04, design B of three mocked):
         the six most-asked issues across the row, each the party rated best
         on it and its lead over the next party in points, over a bar of the
         four parties' shares as printed (the grey is the rest - others,
         unsure, none). A wave that didn't ask about an issue shows a dash;
         its own every issue, and where voters ranked them, open beneath it */
      const cells = IMAP.map((id) => { const own = window.issOwnOf(p, id); return { id, own, L: window.issLeadOf(own) }; });
      /* party and lead as two spans: one line on a laptop, stacked on a
         phone, where a sixth of a 320px card (43px) can't hold "L/NP +12" */
      const verdict = ({ L }) => (!L ? "—" : L.level ? "Level"
        : <><span>{(window.ISS_PARTY_META[L.who] || [L.who, L.who])[1]}</span> <span>+{Math.round(L.lead)}</span></>);
      const ink = ({ L }) => (L && !L.level ? (window.ISS_PARTY_META[L.who] || [])[2] : null);
      const words = ({ id, own, L }) => (own
        ? IMAP_LAB[id] + ": " + (!L ? "no party figures" : L.level ? "level" : (window.ISS_PARTY_META[L.who] || [L.who])[0] + " ahead by " + Math.round(L.lead))
          + " (" + IP4.filter((k) => own[k.id] != null).map((k) => k.lab + " " + rdApNum(own[k.id])).join(", ") + ")"
        : IMAP_LAB[id] + ": not asked");
      const bar = (own) => own && (
        <i className="rd-ap-ibar" aria-hidden="true">{IP4.filter((k) => own[k.id] != null).map((k) => <i key={k.id} style={{ width: +own[k.id] + "%", background: k.dot }}></i>)}</i>
      );
      figs = (
        <span role="cell" className="rd-ap-imap">
          {cells.map((c) => (
            <span key={c.id} className="rd-ap-icell" aria-label={words(c)}>
              <b style={ink(c) ? { color: ink(c) } : null}>{verdict(c)}</b>{bar(c.own)}
            </span>
          ))}
        </span>
      );
      /* the phone: the same six verdicts and bars in one line, under the
         pinned head's issue names */
      body = (
        <div className="rd-ap-imapc">
          {cells.map((c) => <span key={c.id} aria-label={words(c)}><b style={ink(c) ? { color: ink(c) } : null}>{verdict(c)}</b>{bar(c.own)}</span>)}
        </div>
      );
    } else if (facet === "demographics") {
      /* the split in view, read off the poll's own table (demPairOf, the
         d1a1 asset - the scope and the sort quote the same pair; demFam, a
         cuts family's id, when this row sits inside a family's own stacked
         table, so it draws that family's pair). The pair differs by
         pollster, so every row names its own under the figures, and on a
         phone at the card's top right */
      const pr = window.demPairOf(p, demSplit, demFam);
      figs = (
        <span role="cell" className="rd-ap-fig rd-ap-dgap">
          <span className="rd-ap-pnums">{prims.map((k) => <b key={k.id} style={{ color: k.ink }}>{pr ? gapTxt(pr.gap[k.id]) : "—"}</b>)}</span>
          <span className="rd-ap-sub">{pr ? pr.lab + ", in points" : "no " + spl.label.toLowerCase() + " breakdown"}</span>
        </span>
      );
      const demCols = pr ? prims.filter((k) => pr.gap[k.id] != null) : [];
      const demTops = rdApDodge(demCols.map((k) => gx(pr.gap[k.id])));
      pic = (
        <span className="rd-ap-pic" role="img" aria-label={pr ? pr.lab + ": " + demCols.map((k) => k.lab + " " + gapTxt(pr.gap[k.id])).join(", ") + " points" : "No breakdown to split"}>
          <span className="rd-ap-in">
            {[-30, -20, -10, 10, 20, 30].map((v) => <i key={v} className="rd-ap-gl" style={{ left: gx(v) + "%" }}></i>)}
            <i className="rd-ap-avg" style={{ left: gx(0) + "%" }}></i>
            {demCols.map((k, di) => (
              <i key={k.id} className="rd-ap-dot" style={{ left: gx(pr.gap[k.id]) + "%", background: k.dot, ...(demTops[di] ? { top: "calc(50% + " + demTops[di] + "px)" } : null) }}></i>
            ))}
          </span>
        </span>
      );
      right1 = pr ? <span className="rd-ap-dpair">{pr.lab}</span> : null;
      body = <>
        <div className="rd-ap-cprim">{prims.map((k) => <span key={k.id}><em>{k.lab}</em><b style={{ color: k.ink }}>{pr ? gapTxt(pr.gap[k.id]) : "—"}</b></span>)}</div>
        <div className="rd-ap-cpic">{pic}</div>
      </>;
    } else if (facet === "confidence") {
      /* one release of one gauge: the figure as the house printed it, drawn
         on the shared 40–120 meter. NAB keeps its own net-balance number,
         which reads 0 at neutral, so its rows name the measure under the
         figure - why −8 sits just below Neutral. NAB's trading-conditions
         read, a second measure, opens with the release */
      const c = p.conf;
      const nab = c.vs === 0;
      /* the change a surface shows: the release's printed one, else the
         measured move on the lane's previous release (gen-data's chgCalc)
         - flagged calculated wherever it renders, never passed off as
         the house's print */
      const chgEf = c.chg != null ? { v: c.chg, calc: false } : c.chgCalc != null ? { v: c.chgCalc, calc: true } : null;
      figs = (
        <span role="cell" className="rd-ap-fig">
          <b>{confFig(c.v)}</b>
          {nab && <span className="rd-ap-sub">net balance</span>}
        </span>
      );
      pic = (
        <span className="rd-ap-pic" role="img"
              aria-label={p.client + ", " + confFig(c.v)
                + (chgEf ? ", " + confChg(chgEf.v) + " on the gauge’s previous release" + (chgEf.calc ? ", calculated - the release printed no change" : "") : "")
                + (nab ? " – a net balance (0 = neutral), drawn 100 points up" : ", 100 = neutral")}>
          <span className="rd-ap-in">
            {/* the inner ticks only: like every signed strip, the ends go unruled */}
            {[60, 80].map((v) => <i key={v} className="rd-ap-gl" style={{ left: cfx(v) + "%" }}></i>)}
            <i className="rd-ap-avg" style={{ left: cfx(100) + "%" }}></i>
            <i className="rd-ap-dot" style={{ left: cfx(confPlot(c)) + "%", background: confInk(c) }}></i>
          </span>
        </span>
      );
      const chgInk = !chgEf || Math.abs(chgEf.v) < 0.05 ? null : chgEf.v > 0 ? "var(--mood-pos)" : "var(--mood-neg)";
      val = (
        <span role="cell" className="rd-ap-val" style={chgInk ? { color: chgInk } : null}
              title={chgEf && chgEf.calc ? "Calculated from the gauge’s previous release - the release printed no change" : undefined}>
          {chgEf ? <>{confChg(chgEf.v)}{chgEf.calc ? <sup aria-hidden="true">*</sup> : null}</> : "—"}
        </span>
      );
      /* the phone card lays the desktop cells out in place: the figure (and
         NAB's "net balance") at the top right, the change once, under the
         strip */
      right1 = <b>{confFig(c.v)}</b>;
      right2 = nab ? <span className="rd-ap-sub">net balance</span> : null;
      body = <>
        <div className="rd-ap-cpic">{pic}</div>
        <div className="rd-ap-csub">
          {/* null chg is two events: the lane's first release of the term
             (gen-data flags c.first), or the house printed no numeric
             change - Roy Morgan's "virtually unchanged" consumer waves,
             whose move on the previous release is calculated and flagged
             (chgCalc). The older copy claimed the first for both. */}
          {chgEf ? <>Change <b style={chgInk ? { color: chgInk } : null}>{confChg(chgEf.v)}</b> on last release{chgEf.calc ? " (calculated)" : null}</> : c.first ? "The gauge’s first release this term" : "Change not printed"}
        </div>
      </>;
    }
    const detail = isOpen && (
      <div className="rd-ap-open" role="row">
        <RdApDetail p={p} onM={onM} pub={pub} today={today} winN={RD_AP_KAL ? rows.filter((r) => !r.noAgg && figOf(r).a != null).length : win.length}
                    facet={facet} onBack={arrived ? onBack : null} backLabel={backLabel} demSplit={demSplit} setDemSplit={setDemSplit} onFacet={onFacet} />
      </div>
    );
    if (phone) {
      const sub = [p.client, fieldTxt(p), p.sample != null ? p.sample.toLocaleString() : null].filter(Boolean).join(", ");
      /* the two head rows as ONE renderer so a facet whose feature line
         sits at the head's right edge can hand the slot to a stateful
         component (the consideration range cycler: its basis label rides
         here, where the demographics facet's pair names sit - user call
         2026-10-15) without forking the head markup */
      const cardHead = (edge) => (<>
        <div className="rd-ap-c1">
          <span className="rd-ap-firm">{rdPollNameLink(p, "rd-ap-ext")}</span>
          <span className="rd-grow"></span>{edge}
        </div>
        <div className="rd-ap-c2"><span className="rd-ap-sub">{sub}</span><span className="rd-grow"></span>{right2}</div>
      </>);
      return (
        <React.Fragment key={id}>
          <div className={"rd-ap-card " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : "")} role="row" aria-expanded={isOpen} onClick={toggle} tabIndex={0} onKeyDown={(e) => rowNav(e, p, demFam)}>
            {consEdge ? consEdge(cardHead) : (<>{cardHead(right1)}{body}</>)}
          </div>
          {detail}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={id}>
        <div className={"rd-ap-row " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : "")} role="row" aria-expanded={isOpen} onClick={toggle} tabIndex={0} onKeyDown={(e) => rowNav(e, p, demFam)}>
          {pollsterCell(p)}{fieldCell(p)}{sampleCell(p)}<span></span>
          {figs}{pic}{val}{facet === "twopp" && <>{hlCell}<span></span></>}
          <button type="button" className={"rd-ap-chev" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                  aria-label={(isOpen ? "Hide" : "Show") + " the full " + (facet === "confidence" ? "release" : "poll") + ": " + p.pollster + ", " + (p.fieldPending ? "TBC" : p.field)}
                  onClick={(e) => { e.stopPropagation(); toggle(); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
        </div>
        {detail}
      </React.Fragment>
    );
  };
  const monthRow = (g, famId) => {
    const [y, m] = g.ym.split("-").map(Number);
    const n = g.list.length;
    const lab = D.monthNameFull(m) + " " + y;
    const count = n + " poll" + (n === 1 ? "" : "s");
    if (facet === "twopp") {
      const k = g.list.filter(inToday).length;
      const allWord = n === 1 ? "in" : n === 2 ? "both in" : "all in";
      const note = count + (todayTxt && k ? (k === n ? ", " + allWord + " today’s " + todayTxt : ", " + k + " in today’s " + todayTxt) : "");
      const avg = monthAvg[g.ym];
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{note}</span></span>
          {avg != null && <span className="rd-ap-mavg">{RD_AP_KAL ? "Trend " : phone ? "Avg " : "Average "}<b>{avg.toFixed(1)}{phone ? "" : " – " + (100 - avg).toFixed(1)}</b></span>}
        </div>
      );
    }
    if (facet === "primary") {
      const A = (D.aggPrimary || []).find((x) => x.ym === g.ym);
      /* the ring average is the month's INTENTION aggregate - nothing
         averages consideration yet, so under consM the rings and their
         numbers would draw a figure the rows are not showing */
      const rings = A && !phone && !consM;
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{rings ? RD_AP_AVG + ", drawn as rings" : count}</span></span>
          {rings && <span className="rd-ap-pnums rd-ap-mpn">{prims.map((k) => <span key={k.id}>{A[k.id] != null ? A[k.id].toFixed(1) : "—"}</span>)}</span>}
          {rings && (
            <span className="rd-ap-pic rd-ap-mpic" aria-hidden="true"><span className="rd-ap-in">
              {prims.filter((k) => A[k.id] != null).map((k) => <i key={k.id} className="rd-ap-ring" style={{ left: pdx(A[k.id]) + "%", borderColor: k.dot }}></i>)}
            </span></span>
          )}
        </div>
      );
    }
    /* releases, not polls: the confidence facet's rows never count toward
       a poll total, so its month rows say what they number */
    if (facet === "confidence") {
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{n + " release" + (n === 1 ? "" : "s")}</span></span>
        </div>
      );
    }
    /* inside a cuts family's stacked table the month mark stays - the row
       order needs its date cues - but a "4 polls" count doesn't: only the
       waves with THIS cut sit here, so a count reads as a table total */
    if (famId) {
      return (
        <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
          <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b></span>
        </div>
      );
    }
    return (
      <div className={"rd-ap-mrow " + cls} role="row" key={"m" + g.ym}>
        <span className="rd-ap-mlab" role="rowheader"><b>{lab}</b><span>{count}</span></span>
      </div>
    );
  };
  /* a cuts family's own table head in the stacked view: its title and
     source on the left, its pair's caps over the scale column where the
     split's own scale head would carry them (the caps the demCaps
     gate took off the pinned head land here instead) */
  const famHead = (t) => {
    const [lo, hi] = famCapsOf(t);
    const shut = famShut.has(t.fam.id);
    return (
      <div className={"rd-ap-frow " + cls + (shut ? " shut" : "")} role="row" key={"f" + t.fam.id}
           aria-expanded={!shut} onClick={() => toggleFam(t.fam.id)} tabIndex={0}
           onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); toggleFam(t.fam.id); }}>
        <span className="rd-ap-flab" role="rowheader"><b>{t.fam.lab}</b><span>{t.fam.sub}</span>{shut && <span className="rd-ap-fn">{t.rows.length + " poll" + (t.rows.length === 1 ? "" : "s")}</span>}</span>
        {!shut && (
          <span className="rd-ap-fcap" aria-hidden={!lo && !hi ? "true" : undefined}
                title={lo && hi ? "Each party’s gap between the two groups, from stronger with " + lo.toLowerCase() + " voters on the left to stronger with " + hi.toLowerCase() + " voters on the right" : undefined}>
            <span className="rd-ap-in">
              {lo && <b className="rd-ap-scl">◀ {lo}</b>}
              {hi && <b className="rd-ap-scr">{hi} ▶</b>}
            </span>
          </span>
        )}
        <button type="button" className={"rd-ap-chev" + (shut ? "" : " open")} aria-expanded={!shut}
                aria-label={(shut ? "Show" : "Hide") + " the " + t.fam.lab + " table"}
                onClick={(e) => { e.stopPropagation(); toggleFam(t.fam.id); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
      </div>
    );
  };
  /* the phone's pinned scale, above the cards */
  const phoneHead = (
    <div className={"rd-ap-phead " + cls}>
      {facet === "twopp" && <span className="rd-ap-hpic"><RdApScale onM={onM} phone /></span>}
      {facet === "primary" && <span className="rd-ap-hpic"><span className="rd-ap-cap">{consM ? "Voting consideration" : "Primary vote"}</span><span className="rd-ap-in">{PTKS.map((v) => <span key={v} className="rd-ap-tk" style={{ left: pdx(v) + "%" }}>{v}{v === PLAST ? "%" : ""}</span>)}</span></span>}
      {facet === "leadership" && <span className="rd-ap-hpic"><span className="rd-ap-cap">Net rating: approve minus disapprove</span><span className="rd-ap-in">{ldTicks.map((v) => <span key={v} className={"rd-ap-tk" + (v === 0 ? " mid" : "") + (v === LD.lo ? " start" : "") + (v === LD.hi ? " end" : "")} style={{ left: ldx(v) + "%" }}>{v === 0 ? "Even" : rdSigned(v, 0)}</span>)}</span></span>}
      {facet === "direction" && <span className="rd-ap-hpic rd-ap-hdir"><span className="rd-ap-cap"><span style={{ color: "var(--mood-pos)" }}>Right direction</span>, unsure, <span style={{ color: "var(--mood-neg)" }}>wrong track</span>, %</span></span>}
      {facet === "issues" && <span className="rd-ap-hpic rd-ap-imaph">{IMAP.map((id) => <span key={id}>{issHyph(id)}</span>)}</span>}
      {facet === "demographics" && <span className="rd-ap-hpic">{demScale(true)}</span>}
      {facet === "confidence" && <span className="rd-ap-hpic">{confScale(true)}</span>}
    </div>
  );
  /* The head and dek render on EVERY facet (not just twopp): it is a
     where-things-stand line, not a facet label, and keeping the slot's
     height constant means a laptop facet walk moves nothing above the bar
     but the two-party strip's ~1px in the tab row. That is load-bearing,
     not cosmetic - Safari.app's scroller lattice drops any sub-3css scroll
     correction and lands each big one ~±2css off, so a per-hop hed reflow
     could not be chased (the 2026-09-30 laptop facet-walk crawl, rounds
     9-12 in the rdpinscroll skill). The flip/basis toggles still rewrite
     the hed's words, and on a phone the two-party counts strip still
     springs open between the tab row and the table. Anchor the
     search/filter bar first: whatever can still resize above it does so
     while the bar, the column head and every row under the reader stay
     exactly where they were (the tab row can't hold - the strip lands
     between it and the table; on a phone it rides up the strip's height
     instead). The desktop column head is the same height in
     every facet (rd.css's .rd-ap-hrow floor), so the rows hold there too.
     Deeper scrolls fall back through the tab row to the first data row.
     Unlike every other pinned section, this one asks for the pin on fine
     pointers too (rdPinScroll's second arg) - the user wants the laptop's
     facet walk to hold the table the way a phone's does, 2026-09-30.
     Since 2026-10-18 the head and dek sit under the tab row, which takes
     the pin whenever it is on screen - see the hold's note at hedHold */
  const pinAp = () => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return;
    /* anchors are section CHROME only - never a data row. The rows are
       keyed by poll, so a poll that exists on both sides of a facet hop
       keeps its DOM node but sits at a wildly different doc position in
       each facet's row set: pin one and the pin scrolls the page by the
       row's full displacement to hold it still (a 1408px chase on an
       issues->2PP hop, a few lines per hop in the common case - the
       round-3 laptop crawl). The table element survives every hop and
       holding ITS top still compensates the hed swap while the reshuffled
       rows ride with the document, one rigid body: a full facet lap nets
       exactly zero scroll. All three persist across hops.
       With the tab row on screen it takes the pin and the head and dek
       below it reflow freely, so the slot lets go of any hold. Scrolled
       past it, the bar (or the table, deeper) takes the pin with the slot
       above it, so the slot holds the height it has now (the hold's note
       at hedHold). The reserve is rdPinScroll's own on-screen test */
    const tabs = sec.querySelector(".rd-ap-tabs"), slot = sec.querySelector(".rd-ap-hedslot");
    const sb = document.querySelector(".tabs.sticky"), sr = sb && sb.getBoundingClientRect();
    const reserve = sr ? Math.min(sr.bottom, sr.height) : 0;
    const tr = tabs && tabs.getBoundingClientRect();
    if (tr && tr.bottom >= reserve && tr.top <= window.innerHeight) {
      setHedHold(0);
      rdPinScroll([tabs], true);
      return;
    }
    if (slot) setHedHold(slot.getBoundingClientRect().height);
    rdPinScroll([
      sec.querySelector(".rd-ap-bar"),
      tabs,
      sec.querySelector(".rd-ap-table"),
    ], true);
  };
  const facetPick = (id) => { pinAp(); onFacet(id); };
  /* Pointing at the card makes its facet row the arrow-key target without
     moving DOM focus. Real keyboard focus still wins, and the capture phase
     beats the page's own left/right page turn. Pointing at the Split by
     row claims the keys deeper still (the row's own radio walk; the focus
     rules are identical), and the facet row takes the keys back as soon as
     the pointer leaves it. */
  const hoverKeys = React.useRef(false);
  const splitEl = React.useRef(null);
  const splitHover = React.useRef(false);
  const splitArrowLive = React.useRef(null);
  React.useEffect(() => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return undefined;
    const enter = () => { hoverKeys.current = true; };
    const leave = () => { hoverKeys.current = false; };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const dp = splitEl.current;
    const dpEnter = () => { splitHover.current = true; };
    const dpLeave = () => { splitHover.current = false; };
    if (dp) {
      splitHover.current = dp.matches(":hover");
      dp.addEventListener("pointerenter", dpEnter);
      dp.addEventListener("pointerleave", dpLeave);
    } else splitHover.current = false;
    const key = (e) => {
      if (!hoverKeys.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (splitHover.current) {
        const el = splitEl.current;
        if (el && el.isConnected && el.getClientRects().length && splitArrowLive.current) {
          e.preventDefault();
          splitArrowLive.current(e.key === "ArrowRight" ? 1 : -1);
          return;
        }
        splitHover.current = false;
      }
      e.preventDefault();
      const i = FACETS.findIndex((x) => x.id === facet);
      if (i < 0) return;
      const f = (i + (e.key === "ArrowRight" ? 1 : -1) + FACETS.length) % FACETS.length;
      facetPick(FACETS[f].id);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      if (dp) {
        dp.removeEventListener("pointerenter", dpEnter);
        dp.removeEventListener("pointerleave", dpLeave);
      }
      document.removeEventListener("keydown", key, true);
    };
  }, [facet]);
  const flipPick = () => { pinAp(); onMeasure(onM ? "lnp" : "onp"); };
  /* the primary facet's consideration flip – its own state (consM), not a
     matchup: it swaps which published figures the party columns print */
  const consFlipPick = () => { pinAp(); setConsM(!consM); };
  /* the confidence facet's lane flip: consumer (household) gauges ⇄ the
     business pair, its own state (confBus) – same shape as the
     consideration flip, one layer above the row set */
  const confLanePick = () => { pinAp(); setConfBus(!confBus); };
  /* the demographics facet's split: the Who votes for whom panel's own
     group names, picked like a facet - the table holds its spot through the
     reflow, and the arrow keys walk the words the way they walk the tabs */
  const splitPick = (id) => { pinAp(); setDemSplit(id); };
  splitArrowLive.current = facet === "demographics" && SPLITS.length > 1
    ? (dir) => splitPick(SPLITS[(SPLITS.findIndex((x) => x.id === demSplit) + dir + SPLITS.length) % SPLITS.length].id)
    : null;
  const splitPicker = (
    <span className="rd-ap-dpick" ref={splitEl}>
      <span className="rd-pl-ctl-l">Split by:</span>
      {/* one of seven, so a radio group - which also keeps it out of the
          facet tabs' own [role=group] */}
      <span role="radiogroup" aria-label="Split the vote by" onKeyDown={rdTabsKey(SPLITS, splitPick)} onClick={rdTabFocus}>
        {SPLITS.map((x) => <button key={x.id} type="button" role="radio" aria-checked={x.id === demSplit} onClick={() => splitPick(x.id)}><RdTabW t={x.label} /></button>)}
      </span>
    </span>
  );
  const basisPick = () => { pinAp(); setTppBasis(pub ? "imp" : "resp"); };
  /* Spacebar walks what the facet can step, p flips the published/implied
     basis, and 1-7 pick a demographics group outright while the table is
     on screen - the tab row's "Labor v X ⇄" button, the Split by radio
     row, and the "Show the pollsters’ published figures" switch, by key.
     The claim is the viewport (IntersectionObserver, not the pointer);
     away from the owning facet, or while real focus is anywhere but the
     page, the keys keep their day jobs (space scrolls, digits type). */
  const spaceFlip = React.useRef(null);
  /* on the primary facet Space steps the figures the way it steps the 2PP
     facet's contest (intention ⇄ consideration), and on the confidence
     facet it steps the lane (consumer ⇄ business) */
  spaceFlip.current = facet === "twopp" ? flipPick : facet === "primary" ? consFlipPick : facet === "confidence" ? confLanePick : null;
  const pubFlip = React.useRef(null);
  pubFlip.current = facet === "twopp" ? basisPick : null;
  const splitWalk = React.useRef(null);
  splitWalk.current = facet === "demographics"
    ? () => splitPick(SPLITS[(SPLITS.findIndex((x) => x.id === demSplit) + 1) % SPLITS.length].id)
    : null;
  const splitAt = React.useRef(null);
  splitAt.current = facet === "demographics"
    ? (i) => { if (SPLITS[i]) splitPick(SPLITS[i].id); }
    : null;
  React.useEffect(() => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current) return;
      const isPub = e.key === "p" || e.key === "P";
      const isSpace = e.key === " ";
      const dig = e.key.length === 1 && e.key >= "1" && e.key <= "9" ? e.key.charCodeAt(0) - 49 : -1;
      if (!isPub && !isSpace && dig < 0) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (isSpace && e.shiftKey)) return;
      const a = document.activeElement;
      /* the facet menu's SELECTED tab owns Space too: picking a facet
         left DOM focus on its tab, where Space would natively just
         re-fire that facet pick. Space there steps the facet's ⇄ flip,
         exactly as it does with the page itself focused; any other
         control, or an inactive tab, keeps the key's day job. */
      const onTab = isSpace && a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true"
        && !!(a.closest && a.closest('.rd-ap-tabs [role="group"], .rd-ap-pintabs'));
      if (!onTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const act = isPub ? pubFlip.current : isSpace ? (splitWalk.current || spaceFlip.current) : splitAt.current;
      if (!act || dig >= SPLITS.length) return;
      e.preventDefault();
      if (!e.repeat) act(dig >= 0 ? dig : undefined);
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
  /* The count below changed width by facet ("78 of 200 polls" … "122 of
     200 releases") and the section links (flex 1) took up the difference,
     sliding every tab sideways on a hop. An invisible "{total} of {total}"
     twin (.rd-ap-pinnw, the .rd-ldg-cycw idiom) sets the slot width — in
     the longest noun this page's facet set can use (releases exists only
     where Confidence does, not on /vic/) — and the live count right-aligns
     inside it. Pinned by .matilda/probe/ap-pin-steady.mjs */
  const pinnWNoun = FACETS.some((f) => f.id === "confidence") ? "releases" : "polls";
  const pinCount = <span className="rd-ap-pinn"><span className="rd-ap-pinnw" aria-hidden="true">{total} of {total} {pinnWNoun}</span><span className="rd-ap-pinnl"><b>{sorted.length}</b>{sorted.length !== total ? " of " + (ofT || total) : ofTxt} {noun}</span></span>;
  const pinBar = (
    <div className={"rd-ap-pinbar" + (pinned ? " on" : "")} aria-hidden={!pinned}>
      {/* the section links (Disagree, Lean, Flows) left with their
          sections for the ☰ menu's pages, 2026-10-15 */}
      {phone ? (<>
        {pinCount}
        <span className="rd-grow" aria-hidden="true"></span>
        <button type="button" className="rd-ap-pinf" tabIndex={pinned ? 0 : -1} onClick={() => setSheet(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>
          Filters{nFilters ? ", " + nFilters : ""}
        </button>
      </>) : <>
        <span className="rd-ap-pintabs" role="group" aria-label="Figures"
              onKeyDown={rdTabsKey(FACETS, facetPick)} onClick={rdTabFocus}>
          {FACETS.map((f) => <button key={f.id} type="button" className="rd-ap-pint" aria-pressed={facet === f.id} tabIndex={pinned ? 0 : -1} onClick={() => facetPick(f.id)}><RdTabW t={f.label} /></button>)}
        </span>
        <span className="rd-grow" aria-hidden="true"></span>
        <span className="rd-ap-pinsep" aria-hidden="true"></span>
        <button type="button" className="rd-ap-pins" aria-label="Search the polls" tabIndex={pinned ? 0 : -1} onClick={toSearch}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
        </button>
        {pinCount}
      </>}
    </div>
  );
  const qpop = (
    <RdQPop label="How the two-party figures are counted, and the pollsters’ published figures" align="left">
      <p>{pub ? "Each poll’s two-party figure as its pollster published it, against " + rdApAgainst(true) + "."
        : "Each poll’s primary votes read through the same preference flows, the " + rdElecYear + " election’s, so the polls compare like for like. The pollster’s own figure sits beneath."}</p>
      <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
        <RdSwitch on={pub} onToggle={basisPick} label="Show the pollsters’ published figures" /></div>
    </RdQPop>
  );
  const flip = (
    <button type="button" className="rd-pl-flip" title={"Switch the page to Labor v " + (onM ? "Coalition" : "One Nation")}
            onClick={flipPick}><span className="rd-pl-flip-t">Labor v {onM ? "One Nation" : "Coalition"}</span> <span aria-hidden="true">⇄</span></button>
  );
  const consFlip = (
    /* label reads the ACTIVE mode, the same contract the 2PP matchup flip
       above keeps ("Labor v Coalition ⇄" when Coalition is up); the title
       still announces where a press goes (user call 2026-10-15) */
    <button type="button" className="rd-pl-flip" aria-pressed={consM}
            title={consM ? "Switch the figures back to voting intention" : "Switch the figures to voting consideration (the parties voters would consider supporting)"}
            onClick={consFlipPick}><span className="rd-pl-flip-t">{consM ? "Voting consideration" : "Voting intention"}</span> <span aria-hidden="true">⇄</span></button>
  );
  const confLaneFlip = (
    /* the label names the ACTIVE lane, the consideration flip's contract;
       the title announces where a press goes */
    <button type="button" className="rd-pl-flip" aria-pressed={confBus}
            title={confBus ? "Switch to the consumer confidence gauges" : "Switch to the business confidence gauges"}
            onClick={confLanePick}><span className="rd-pl-flip-t">{confBus ? "Business" : "Consumer"} confidence</span> <span aria-hidden="true">⇄</span></button>
  );
  const consQpop = !consM ? null : (
    <RdQPop label="What voting consideration figures are, and which waves collected them" align="left">
      <p>Voting consideration is the share of voters who name a party as one they <i>would consider</i> supporting — a looser yardstick than voting intention, the party the voter does intend. YouGov and Essential have asked it; every other wave stays on intention, and on a wave without consideration figures the intention figure stands.</p>
    </RdQPop>
  );

  /* the eyebrow's copy by facet pair, written once so .rd-ap-ebvar can
     lay both states out invisibly for the eyebrow floor above. keyId
     keeps the section's aria-labelledby id on the live copy only */
  const eyebrowCopy = (conf, keyId) => (<>
    <h2 className="rd-title" {...(keyId ? { id: "rd-ap-t" } : {})}>{conf ? "Economic sentiment" : "All polls"}</h2>
    <span className="rd-meta">{conf
      ? "Every confidence-index release (business and consumer) since the " + rdElecYear + " election"
      : "Every " + RD_AP_POLLS + " poll since the " + rdElecYear + " election"}</span>
  </>);
  return (
    <section className="rd-sec rd-first rd-ap" id="rd-ap-top" aria-labelledby="rd-ap-t" data-facet={facet}>
      <div className="rd-eyebrow" style={ebFloor ? { minHeight: ebFloor + "px" } : null}>
        {eyebrowCopy(facet === "confidence", true)}
      </div>
      <div className="rd-ap-ebvar" ref={ebVarRef} aria-hidden="true">
        <div className="rd-eyebrow">{eyebrowCopy(false, false)}</div>
        <div className="rd-eyebrow">{eyebrowCopy(true, false)}</div>
      </div>
      <RdTabs swipe value={facet} onChange={facetPick} options={FACETS} ariaLabel="Figures" className="rd-ap-tabs">
        {facet === "twopp" && !ctlNarrow && (
          <span className="rd-pl-ctl">
            <span className="rd-pl-ctl-l">Two-party:</span>{flip}
            <span className="rd-pl-ctl-l">, {pub ? "as published" : "implied flows"}</span>{qpop}
          </span>
        )}
        {facet === "demographics" && !ctlNarrow && splitPicker}
        {facet === "primary" && !ctlNarrow && (
          <span className="rd-pl-ctl"><span className="rd-pl-ctl-l">Vote:</span>{consFlip}{consQpop}</span>
        )}
        {facet === "confidence" && !ctlNarrow && (
          <span className="rd-pl-ctl"><span className="rd-pl-ctl-l">Confidence:</span>{confLaneFlip}</span>
        )}
      </RdTabs>
      {/* under 1220px the 2PP, Primary, Demographics and Confidence
          facets keep their controls in a row of their own beneath the
          tabs, inside the slot: it comes and goes with the facet, so it
          glides with the head and dek in one block (a row that snapped
          out while the words glided jerked the table up and back), and
          the hold (hedHold) covers all three on a deep hop */}
      <div className="rd-ap-hedslot" style={hedHold ? { minHeight: hedHold + "px" } : null}>
        <RdGlide watch={hedW0 !== undefined && hedW1 !== undefined ? (ctlRow ? facet : "") + "\u0000" + hedW0 + "\u0000" + hedW1 : undefined}>
          {ctlRow && (
            <div className="rd-ap-ctlslot">
              {facet === "twopp" && (
                <div className="rd-ap-pctl">{flip}<span className="rd-pl-ctl-l">, {pub ? "as published" : "implied flows"}</span><span className="rd-grow"></span>{qpop}</div>
              )}
              {facet === "demographics" && <div className="rd-ap-pctl">{splitPicker}</div>}
              {facet === "primary" && <div className="rd-ap-pctl">{consFlip}<span className="rd-grow"></span>{consQpop}</div>}
              {facet === "confidence" && <div className="rd-ap-pctl">{confLaneFlip}</div>}
            </div>
          )}
          {head ? <h2 className="rd-hed">{head}</h2> : null}
          {dek ? <p className="rd-dek">{dek}</p> : null}
        </RdGlide>
      </div>

      <div className="rd-ap-bar">
        <label className="rd-ap-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoCorrect="off" spellCheck={false}
                 placeholder="Search a pollster, a date, or a figure" aria-label="Search the polls" />
          {q && <button type="button" className="rd-ap-x" onClick={() => setQ("")} aria-label="Clear search">×</button>}
        </label>
        <span className="rd-ap-pops">
          {/* the three filter menus are native selects in the draw-a-past-term
              action style: none of them holds a value - a pick ticks or
              unticks the named item (or moves the time span, or clears) and
              the select snaps back to its label, with the live set carried by
              the Showing pills row below the bar. Row counts are each
              option's poll count after the other active filters */}
          <select className="rd-ap-sel rd-ap-sel-house" aria-label="Filter by pollster" value=""
                  onChange={(e) => { const v = e.target.value; if (v === "__clear") setSel(new Set()); else if (v) toggleHouse(v); }}>
            <option value="" disabled>Pollster</option>
            {houseRank.map((h) => <option key={h} value={h}>{(sel.has(h) ? "✓ " : "") + h + " (" + (houseN[h] || 0) + ")"}</option>)}
            {sel.size > 0 && <hr />}
            {sel.size > 0 && <option value="__clear">✕ Clear</option>}
          </select>
          <select className="rd-ap-sel rd-ap-sel-time" aria-label="Filter by time span" value=""
                  onChange={(e) => { const v = e.target.value; if (v) setRange(v); }}>
            <option value="" disabled>Time</option>
            {[["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => (
              <option key={id} value={id}>{(range === id ? "✓ " : "") + lab + " (" + rangeN(id) + ")"}</option>
            ))}
          </select>
          <select className="rd-ap-sel rd-ap-sel-inc" aria-label="Filter by what a poll published" value=""
                  onChange={(e) => { const v = e.target.value; if (v === "__clear") setTagSel(new Set()); else if (v) toggleTag(v); }}>
            <option value="" disabled>Includes</option>
            {shownTags.map((t) => <option key={t.id} value={t.id}>{(tagSel.has(t.id) ? "✓ " : "") + rdApTagLab(t.id) + " (" + (tagN[t.id] || 0) + ")" + (RD_AP_TAGS[t.id] && RD_AP_TAGS[t.id].note ? " — " + RD_AP_TAGS[t.id].note : "")}</option>)}
            {tagSel.size > 0 && <hr />}
            {tagSel.size > 0 && <option value="__clear">✕ Clear</option>}
            <option disabled>Ticking two asks for polls that published both.</option>
          </select>
        </span>
        <span className="rd-grow"></span>
        <span className="rd-ap-count"><b>{sorted.length}</b>{sorted.length !== total ? " of " + (ofT || total) : ofTxt} {noun}</span>
        <button type="button" className={phone ? "rd-link rd-ap-csv" : "rd-chip rd-ap-csv"} onClick={exportCsv} aria-label={"Download these " + sorted.length + " " + noun + " as a CSV file"}>
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

      <div className="rd-ap-table" role="table" aria-label={"Every " + RD_AP_POLLS + " " + noun1 + " since the " + rdElecYear + " election, " + (byDate ? "newest first" : "sorted") + (sorted.length !== total ? ", " + sorted.length + " of " + (ofT || total) : ofT ? ", " + sorted.length + ofTxt : "")} ref={bodyRef}>
        <span ref={sentRef} className="rd-ap-sent" aria-hidden="true"></span>
        <div ref={headRef} className={"rd-ap-headwrap" + (pinned ? " pinned" : "")}>
          {pinBar}
          {phone ? phoneHead : colHead}
        </div>
        {/* the group-fragment keys carry their group POSITION, not only
            their month: the half day's pub-default sort can no longer
            duplicate a month in the table (rows now file under their month's
            sort basis), but regrouping against different keys under a sort
            change must never let React keep a past group's DOM keyed the
            same - the stale-rows haunting of the ym-keyed short-lived
            pub sort (a wave that crosses a month-end in the press filed
            2026-09 twice) taught that lesson once */}
        {demFamTables
          ? demFamTables.map((t) => (
            <React.Fragment key={"fam" + t.fam.id}>
              {famHead(t)}
              {famShut.has(t.fam.id) ? null : t.groups.map((g, gi) => <React.Fragment key={t.fam.id + "|" + gi}>{monthRow(g, t.fam.id)}{g.list.map((p) => rowFor(p, t.fam.id))}</React.Fragment>)}
            </React.Fragment>
          ))
          : byDate
            ? groups.map((g, gi) => <React.Fragment key={g.ym + "|" + gi}>{monthRow(g)}{g.list.map((p) => rowFor(p, null))}</React.Fragment>)
            : flat.map((p) => rowFor(p, null))}
        {sorted.length === 0 && <div className="rd-ap-empty">No {noun} match these filters. <button type="button" className="rd-link" onClick={clearAll}>Clear filters</button></div>}
      </div>
      {more && (
        <div className="rd-ap-more">
          {byDate ? <button type="button" className="rd-chip" onClick={() => setMinShown((n) => n + 30)}>Show earlier months</button>
            : <button type="button" className="rd-chip" onClick={() => setFlatLimit((n) => n + 40)}>Show {Math.min(40, sorted.length - nShown)} more</button>}
          <button type="button" className="rd-link" onClick={() => setShowAll(true)}>Show all {sorted.length}</button>
          <span className="rd-grow"></span>
          <span className="rd-ap-shown">{nShown} of {sorted.length}{phone ? "" : " " + noun + " shown"}</span>
        </div>
      )}
      {facet === "twopp" && (
        <RdKey className="rd-ckey rd-ap-key" items={[
          { kind: "dot-solid", color: "var(--alp)", label: "Leans to Labor" },
          { kind: "dot-solid", color: onM ? "var(--onp)" : "var(--lnp)", label: "Leans to " + rival },
        ]}>
          <span className="rd-key-item"><span className="rd-ap-keywh" aria-hidden="true"><i></i></span>{phone ? "95% interval, from its sample" : "95% interval, from the poll’s own sample"}</span>
          <span className="rd-key-item"><span className="rd-ap-keyavg" aria-hidden="true"></span>{RD_AP_KAL ? "The trend" : phone ? "Average of the polls around it" : "Average of the other polls fielded around it"}</span>
          <span className="rd-key-item"><span className="rd-ap-keyhe" aria-hidden="true"></span>{phone ? "Its pollster’s usual lean" : "Where its pollster usually lands (its house lean)"}</span>
        </RdKey>
      )}
      {facet === "primary" && (
        <RdKey className="rd-ckey rd-ap-key" items={[{ kind: "dot-solid", color: "var(--ink-3)", label: "A poll’s figure, in its party’s colour" }]}>
          <span className="rd-key-item"><span className="rd-ap-keyring" aria-hidden="true"></span>The month’s {RD_AP_AVG}</span>
        </RdKey>
      )}
      {facet === "issues" && (
        <RdKey className="rd-ckey rd-ap-key" items={[]}>
          <span className="rd-key-item"><b>ALP +7</b>&nbsp;the party rated best on the issue, and its lead over the next, in points</span>
          <span className="rd-key-item"><i className="rd-ap-ibar rd-ap-keybar" aria-hidden="true"><i style={{ width: "34%", background: "var(--alp)" }}></i><i style={{ width: "26%", background: "var(--onp)" }}></i><i style={{ width: "22%", background: "var(--lnp)" }}></i></i>each party’s share rating it best; grey, the rest</span>
        </RdKey>
      )}
      {facet === "demographics" && (
        <RdKey className="rd-ckey rd-ap-key" items={[{ kind: "dot-solid", color: "var(--ink-3)", label: "A party’s gap between the two groups, in its colour" }]}>
          <span className="rd-key-item"><span className="rd-ap-keyavg" aria-hidden="true"></span>Even: the same vote in both groups</span>
        </RdKey>
      )}
      <HowTo label="How to read this table" paras={[
        <>Dates are fieldwork; the day the poll came out sits beneath. The Published/Fieldwork heading sorts the table two ways – by the day each poll came out (the default) or, on its Fieldwork half, by fieldwork dates, with the month dividers filing by that too. A dash means the pollster didn’t publish that figure. Open any row for the poll in full, with what it does to today’s figure.</>,
        facet === "twopp" && <>{pub
          ? "Each figure is the pollster’s own, as published. The dot is its gap to " + rdApAgainst(true) + ", the tick its pollster’s usual lean, and the whisker the 95% interval its sample alone would give it."
          : "Each figure reads the poll’s primary votes through the " + rdElecYear + " election’s preference flows, one table for every poll, so the polls compare like for like. The dot is its gap to " + rdApAgainst(false) + ", the tick its pollster’s usual lean, and the whisker the 95% interval its sample alone would give it, worked out from its primaries and those flows."}
          {" "}A pollster’s polls scatter around its usual lean, not the average, so about one poll in 20 should have its whisker miss its tick by chance.</>,
        facet === "issues" && <>Each column is an issue. The party named is the one rated best on it by the most voters in that poll, and the figure is its lead over the next party, in points, from the shares as the pollster printed them; "Level" means under half a point apart. The bar draws those shares, and the grey is everyone else, unsure or naming no one. Pollsters word the question differently, Resolve doesn’t offer the Greens, and SEC Newgate asks only about cost of living. Open any row for every issue the poll asked about, and where voters ranked them.</>,
        facet === "demographics" && <>Each figure is a party’s vote in the first group minus its vote in the second, in points, from the groups as the pollster printed them. Pollsters cut voters differently, so each row names the pair it compares: Resolve and DemosAU print 18–34 and 55+, RedBridge and YouGov print generations. A gap in points also grows with the party: when a party’s vote doubles, so do its gaps, even if its voters are the same mix of people. One Nation’s have widened that way as its vote has grown. Open any row for the poll’s whole table.</>,
        <><b>Sample</b> is the number of people polled; <b>eff.</b> is the pollster’s own effective sample after weighting, where it publishes one. Where it doesn’t, the interval assumes weighting costs what it does on average.</>,
      ]} />
      <div className="rd-foot">
        <span className="rd-foot-text">{facet === "twopp"
          ? (pub ? "Each poll’s own published figure, against " + rdApAgainst(true) + ". A dash marks a figure the pollster didn’t publish."
            : (phone ? "Every poll is read through the " + rdElecYear + " election’s preference flows, so polls compare like for like; the pollster’s own figure sits beneath. Each interval is sampling error alone. A dash marks a figure the pollster didn’t publish."
              : "Every poll’s primary votes are read through the same preference flows, the " + rdElecYear + " election’s, so the polls compare like for like; the pollster’s own figure sits beneath where it published one. Those flows carry doubt of their own, but the same doubt for every poll, so each interval is sampling error alone. A dash marks a figure the pollster didn’t publish."))
          : "A dash marks a figure the pollster didn’t publish. Open any row for the poll in full."}</span>
        <span className="rd-grow"></span>
        <span className="rd-foot-links"><a className="rd-how" href="/feedback/">Report an error</a><RdHow term="all-polls" from="All polls" /></span>
      </div>
      {sheet && phone && (
        <RdApSheet onClose={() => setSheet(false)} houses={houses} houseRank={houseRank} houseN={houseN} sel={sel}
                   toggleHouse={toggleHouse} range={range} setRange={setRange} shownTags={shownTags}
                   tagSel={tagSel} toggleTag={toggleTag} tagN={tagN} count={sorted.length} clearAll={clearAll}
                   noun1={noun1} noun={noun} />
      )}
    </section>
  );
}

/* ================================================================ the analysis sections */

/* the months a section's charts run over, election to now */
/* the term's first month (its election's) and the first full month after
   it - "2025-05" and "2025-06" here, "2022-11" and "2022-12" on /vic/ - and
   the polls the archive holds: "national" here, "Victorian" there */
const RD_AP_TERM0 = (() => { const c = (window.AUSPOL.cycles || []).find((x) => x.current); return c && c.eDate ? c.eDate.slice(0, 7) : "2025-05"; })();
const RD_AP_TERM1 = (() => { const [y, m] = RD_AP_TERM0.split("-").map(Number); return m === 12 ? (y + 1) + "-01" : y + "-" + String(m + 1).padStart(2, "0"); })();
const RD_AP_POLLS = window.JUR ? window.JUR.adj : "national";
/* /vic/'s figures are a smoothed trend through every poll (gen-data §1a):
   a month's figure is the trend's, and every poll this term counts */
const RD_AP_KAL = !!(window.AUSPOL.latest.method && window.AUSPOL.latest.method.kind === "kalman");
const RD_AP_AVG = RD_AP_KAL ? "trend" : "average";
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
  /* the month readout's clamp, from its MEASURED width and its panel's place
     on the screen: a fixed 70px half-width let a 207px readout over a
     phone's 150px panel open 14px off the screen's left edge (the
     2026-10-13 tooltip sweep). It stays over its panel where it fits there;
     wider than its panel it centres on the panel, as before, and then
     keeps to the screen */
  const disTip = useRef(null);
  const [disTipBox, setDisTipBox] = useState({ w: 0, x: 0, vw: 0 });
  React.useLayoutEffect(() => {
    const el = disTip.current;
    if (!el) return;
    const w = el.offsetWidth, x = el.parentElement.getBoundingClientRect().left, vw = document.documentElement.clientWidth;
    setDisTipBox((p) => (Math.abs(p.w - w) > 0.5 || Math.abs(p.x - x) > 0.5 || Math.abs(p.vw - vw) > 0.5 ? { w, x, vw } : p));
  }, [hover]);
  const disTipLeft = (hx, pw) => {
    const half = (disTipBox.w || 140) / 2;
    if (2 * half <= pw || !disTipBox.vw) return Math.min(pw - half, Math.max(half, hx));
    const lo = 8 - disTipBox.x + half, hi = disTipBox.vw - 8 - disTipBox.x - half;
    return Math.min(Math.max(lo, hi), Math.max(lo, pw / 2));
  };
  /* hovering the panel hands the arrow keys to the measure row below - the
     walk a focused tab has, claimed only while the pointer is over the card;
     the RdTabs' `swipe` marker claims the phone's sideways swipe on or just
     under the row for the same step */
  const disHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("poll-disagreement");
    if (!sec) return undefined;
    const enter = () => { disHover.current = true; };
    const leave = () => { disHover.current = false; };
    disHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!disHover.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const ids = ["primary", "twopp"];
      const i = ids.indexOf(view);
      if (i < 0 || ids.length < 2) return;
      e.preventDefault();
      const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      setView(nxt);
      setHover(null);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [view]);
  const panels = RD_DIS_PANELS[view];
  const ms = rdApMonths(RD_AP_TERM0);
  let yMax = 3;
  panels.forEach((p) => AP.discord(p.id).forEach((d) => { if (d.sigma != null) yMax = Math.max(yMax, Math.ceil(d.sigma), Math.ceil(d.floor)); }));

  /* the finding, from the primaries whichever tab is open - written in
     menu-lines.js, which the More menu quotes */
  const { head, dek } = AP.disStory();
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
      <RdTabs swipe value={view} onChange={(v) => { setView(v); setHover(null); }} ariaLabel="Measure" className="rd-dis-tabs"
              options={[{ id: "primary", label: "Primary vote" }, { id: "twopp", label: "Two-party" }]} />
      <h4 className="rd-ap-ct rd-dis-ct">How far polls typically sit from {phone ? "their trend" : "the trend through them"}, points</h4>
      {/* primary vote and two-party are different measures, so a switch
          crossfades the panels rather than turning one into the other */}
      <RdCrossfade k={view}>
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
                  <span ref={disTip} className="tip rd-dis-tip" style={{ left: disTipLeft(hx, pw), maxWidth: Math.max(140, (disTipBox.vw || Wall + 16) - 16) }}>
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
      </RdCrossfade>
      {!phone && (
        <RdKey className="rd-ckey rd-dis-key" items={[{ kind: "line", color: "var(--ink-2)", label: "Typical distance of a poll from the trend through the polls" }]}>
          <span className="rd-key-item"><span className="rd-dis-keyfloor" aria-hidden="true"></span>What sampling error alone would produce</span>
        </RdKey>
      )}
      <p className="rd-dis-scale">Within chance: under 1.2 times sampling error, A little beyond: 1.2 to 1.6, Well beyond: 1.6 or more, Under 0.8, tighter than chance, would suggest pollsters were steering towards each other.</p>
      <RdGlide watch={view}><HowTo label="How to read these charts" paras={[
        <>Each chart follows one figure month by month. The line is how far a typical poll sits from the trend through all the polls around it; the shaded floor is how far it would sit if the pollsters all measured the same thing and differed only by the luck of who they reached.</>,
        <>A line on the floor means the polls agree as well as their samples allow; a line well above it means they genuinely differ, in who they reach or how they weight. {view === "primary"
          ? "The One Nation and Coalition vote added together gets its own chart because that is the finding: the pollsters split the right’s vote differently while agreeing on its size."
          : "The implied figures read every poll through the same flows, so their spread is the pollsters disagreeing about primary votes; the published figures add each pollster’s own way of allocating preferences."}</>,
      ]} /></RdGlide>
      <RdFoot how={{ term: "poll-disagreement", from: "How much the polls disagree" }}>
        Spread is how far each poll typically sits from the trend through the polls around it, with recent polls counting more; weighting by sample size would mute the small polls whose divergence is being measured. Sampling error is what each poll’s own sample predicts, with a design effect of {rdApDeff()}{view === "twopp" ? ", and for the implied figures from the spread of each respondent’s flow to Labor rather than a simple share" : ""}. Measured across all {D.individualPolls.length} polls.
      </RdFoot>
    </section>
  );
}

/* ---------------------------------------------------------------- how each pollster leans */
function RdHouseLean({ measure, onMeasure, tppBasis }) {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  /* the tablet's narrower bar column (rd.css) has room to label only the
     scale's ends and the others, as the phone does */
  const narrowBar = useNarrow("(max-width: 1020px)");
  /* Every measure keeps its tab down to the phone: where the seven no
     longer fit across the row, the tab group scrolls sideways under a
     right-edge fade (the .rd-ap-pinnav idiom, rd.css) rather than the
     Greens and Others tabs dropping off. The app's touch effect reads
     the overflow and leaves the strip's sideways drags to it, so a
     swipe ON the strip scrolls it while the under-row swipe still
     steps views - and whichever tab a change lands on glides into view
     (the effect after the arrow walk). */
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const [view, setView] = useState("tpp");
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const SW = useRdWidth(boxRef, 500);
  /* the measure row, shared by the RdTabs render and the arrow-key walk so
     the two can never disagree. The split pairing sits second, straight
     after Two-party (user call 2026-10-03); one label at every width now
     the row scrolls (user call same day: "One Nation–Coalition split",
     retiring the phone's bare "Split") */
  const HL_LABELS = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };
  /* the party tabs ride latest.primaryOrder - the gen-data walk joined to
     the poll tables, so this row and the tables agree on largest first
     (user call 2026-10-03: "the rest should be ordered by primary vote,
     largest first"); an unknown key silently falls back to the previous
     static order, so a drift can't hide a tab */
  const hlParties = ((D) => {
    const ord = (D && D.latest && D.latest.primaryOrder) || [];
    if (!ord.length || ord.some((k) => !(k in HL_LABELS))) return ["alp", "lnp", "onp", "grn", "oth"];
    return ord;
  })(D);
  const hlViews = [
    { id: "tpp", label: "Two-party" },
    { id: "split", label: "One Nation–Coalition split", title: "One Nation’s primary vote against the Coalition’s" },
    ...hlParties.map((k) => ({ id: k, label: HL_LABELS[k] })),
  ];
  /* hovering the panel hands the arrow keys to the measure row - the walk a
     focused tab has, claimed only while the pointer is over the card; the
     RdTabs' `swipe` marker claims the phone's sideways swipe on or just
     under the row for the same step */
  const hlHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    if (!sec) return undefined;
    const enter = () => { hlHover.current = true; };
    const leave = () => { hlHover.current = false; };
    hlHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!hlHover.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const ids = hlViews.map((t) => t.id);
      const i = ids.indexOf(view);
      if (i < 0 || ids.length < 2) return;
      e.preventDefault();
      const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      setView(nxt);
      setHover(null);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [view]);
  /* A view change can land on a tab parked past the strip's edge at the
     widths where the row scrolls (the under-row swipe and the arrow
     walks alike). Glide the strip to show it - the strip's own scroller
     only, never scrollIntoView, which would drag the page up to the row
     when a swipe under it fires with the row itself off screen. */
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    const btn = sec && sec.querySelector('.rd-hl-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc) return;
    const r = btn.getBoundingClientRect(), s = sc.getBoundingClientRect();
    if (r.left < s.left) sc.scrollTo({ left: sc.scrollLeft + r.left - s.left - 28, behavior: SM });
    else if (r.right > s.right) sc.scrollTo({ left: sc.scrollLeft + r.right - s.right + 28, behavior: SM });
  }, [view]);
  const HE = D.houseEffects || {};
  /* the series the open tab reads (menu-lines.js keeps each pollster's lean
     per tab, the split pairing among them: One Nation's lean less the
     Coalition's) */
  const key = window.AP.leanKey(view, onM, pub);
  const heKey = { onimp: "synthOn", imp: "synth", onpub: "alp_on", tpp: "tpp" }[key];
  const valOf = { onimp: (p) => p.alpOnImp, imp: (p) => p.alpImp, onpub: (p) => (p.tppAlt ? p.tppAlt.alp : null), tpp: (p) => p.alpN,
                  alp: (p) => p.p && p.p.alp, lnp: (p) => p.p && p.p.lnp, onp: (p) => p.p && p.p.onp,
                  /* the bundle's p.p.oth is already the IND+OTH grouping the
                     Others lean is measured on (gen-data primaryOf) */
                  grn: (p) => p.p && p.p.grn, oth: (p) => p.p && p.p.oth,
                  split: (p) => (p.p && p.p.onp != null && p.p.lnp != null ? p.p.onp - p.p.lnp : null) }[key];
  const nOf = (h) => {
    const he = heKey && HE[heKey] && HE[heKey][h];
    if (he && he.n) return he.n;
    return D.individualPolls.filter((p) => p.pollster === h && valOf(p) != null).length;
  };
  const rows = window.AP.leanRows(key).map((r) => ({ ...r, n: nOf(r.h) })).sort((a, b) => b.v - a.v || b.n - a.n);
  /* one finding per measure tab, worded in the open measure's own terms:
     who leans furthest on it, by how much, and who comes next - written in
     menu-lines.js, which the More menu quotes for the two-party tab */
  const { head, dek } = window.AP.leanStory(view, onM, pub);
  /* the bar's scale: 1.2 points either way, wider only if a lean needs it */
  const maxAbs = Math.max(0, ...rows.map((r) => Math.abs(r.v)));
  const BM = maxAbs <= 1.1 ? 1.2 : Math.ceil((maxAbs + 0.1) * 2) / 2;
  /* ticks every half point, point or two points: at a finer step the labels
     beside the middle run into "The others" */
  const bStep = BM <= 1.5 ? 0.5 : BM <= 3 ? 1 : 2;
  const bTicks = [];
  for (let v = bStep; v < BM - 1e-9; v += bStep) bTicks.push(+v.toFixed(2));
  const bx = (v) => ((Math.max(-BM, Math.min(BM, v)) + BM) / (2 * BM)) * 100;
  /* each row's line: a point either way, more where the leans run wider.
     NOT "SM" - that name is the global's smooth/auto scroll behaviour
     (window.SM), and shadowing it made the reveal effect's scrollTo call
     throw a ScrollBehavior TypeError wherever the strip overflows */
  let SMAX = 1;
  rows.forEach((r) => r.s.forEach((d) => { SMAX = Math.max(SMAX, Math.ceil(Math.abs(d.v) - 0.05)); }));
  const ms = rdApMonths(RD_AP_TERM1);
  /* the Trend-significance fold: has any pollster's lean DRIFTED across the
     months since the election? One straight line per pollster through its
     own monthly readings, as the sparklines draw them (a within-house fit
     with a single house is that line), t-tested, Holm's correction across
     the pollsters on show. Recomputed with the view, as the rows are. */
  const hlFits = rows.map((r) => {
    const pts = r.s.filter((d) => ms.includes(d.ym));
    return { r, pts, fit: withinHouseSlope(pts.map((d) => ({ h: r.h, t: D.mx(d.ym), w: 1, y: d.v }))) };
  });
  const hlTested = hlFits.filter((f) => f.fit);
  const hlSig = [];
  for (const [i, f] of [...hlTested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (hlTested.length - i)) break;
    hlSig.push(f);
  }
  const hlTsig = {
    key,
    rows: hlFits.map((f) => ({ key: f.r.h, name: f.r.h, sig: hlSig.includes(f),
      cells: [f.pts.length ? rdTsSgn(f.pts[0].v) + " → " + rdTsSgn(f.pts[f.pts.length - 1].v) : "–",
        f.fit ? rdTsSgn(f.fit.b, true) : "–", f.fit ? rdTsSgn(f.fit.t) : "–",
        f.fit ? (hlSig.includes(f) ? "Yes" : "No") : "–"] })),
  };
  /* the two-ended measures: a lean is towards one side or the other */
  const split = view === "split";
  const two = view === "tpp" || split;
  const partyName = { alp: "Labor", lnp: "the Coalition", onp: "One Nation", grn: "the Greens", oth: "the others" }[view];
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
  const sy = (v) => SH / 2 - (Math.max(-SMAX, Math.min(SMAX, v)) / SMAX) * (SH / 2 - 3);
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
    : `Each pollster’s lean on ${partyName}${partyName.endsWith("s") ? "’" : "’s"} primary vote, points`;
  /* the size half of the finding, in words: added together, a pollster's two
     leans on the right nearly cancel */
  const sizeMax = split ? Math.max(0, ...rows.map((r) => { const e = r.s[r.s.length - 1]; return Math.abs(e.on + e.co); })) : 0;
  /* the Two-party tab follows the page's 2PP matchup, so it carries the same
     switch the table does; the head/dek rewrite with it, so the row (or its
     strip) holds its place through the flip. Touch-only pin, though: the one
     desktop-Safari report for this button had its second click land one row
     underneath, and rdPinScroll's own default is to let click-driven desktop
     swaps reflow live rather than pin them */
  const flipPick = () => {
    const sec = document.getElementById("house-lean");
    if (sec) rdPinScroll([sec.querySelector(".rd-hl-tabs"), sec.querySelector(".rd-ap-pctl")].filter(Boolean));
    onMeasure(onM ? "lnp" : "onp");
  };
  /* Space flips the two-party contest while the panel is on screen - the
     claim the All-polls table and the Latest card run, with the same
     guards; its flipPick also renders the table's own flip button, so
     where both sections intersect the table's earlier listener wins and
     both walks agree. Away from the panel, or while real focus is
     anywhere but the page, space keeps its day job (scroll) */
  const spaceFlip = React.useRef(null);
  spaceFlip.current = view === "tpp" ? flipPick : null;
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      /* the panel's own SELECTED measure tab owns Space too: a click leaves
         the focus on it (rdTabFocus), where the key would only dead-fire
         the same pick, so the claim flips the contest with the tab's pick
         and focus staying put (the all-polls facet tabs' admission's
         shape). An unpressed tab, the flip button and every other control
         keep the key's day job */
      const onMeasureTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true"
        && a.matches('#house-lean .rd-hl-tabs .rd-tab');
      if (!onMeasureTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceFlip.current) return;
      e.preventDefault();
      if (!e.repeat) spaceFlip.current();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
  const flip = (
    <button type="button" className="rd-pl-flip" title={"Switch the page to Labor v " + (onM ? "Coalition" : "One Nation")}
            onClick={flipPick}><span className="rd-pl-flip-t">Labor v {onM ? "One Nation" : "Coalition"}</span> <span aria-hidden="true">⇄</span></button>
  );
  return (
    <section className="rd-sec rd-hl" id="house-lean" aria-labelledby="rd-hl-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-hl-t">How each pollster leans</h2>
        <span className="rd-meta">Each pollster’s usual gap to the others polling at the same time{phone ? "" : ", which the averages take out"}</span>
      </div>
      {head && <RdHed head={head} dek={dek} />}
      <RdTabs swipe value={view} onChange={(v) => { setView(v); setHover(null); }} ariaLabel="Measure" className="rd-hl-tabs"
              options={hlViews}>
        {view === "tpp" && !narrowBar && <span className="rd-pl-ctl"><span className="rd-pl-ctl-l">Two-party:</span>{flip}</span>}
      </RdTabs>
      {/* under 1001px the five tab labels fill the row already, so the
          switch drops to its own strip, as the table's does on a phone */}
      {view === "tpp" && narrowBar && <div className="rd-ap-pctl">{flip}</div>}
      <h4 className="rd-ap-ct rd-hl-ct">{phone ? title.replace(", points", ", points; the line beneath each is its lean month by month since the election") : title}</h4>
      <div className="rd-hl-table" role="table" aria-label="Each pollster’s lean against the others, now and month by month since the election">
        <div className="rd-hl-hrow" role="row">
          <span className="rd-ap-th" role="columnheader">Pollster</span>
          <span role="columnheader" className="rd-hl-hbar">{barHead}</span>
          <span className="rd-ap-th r" role="columnheader">Now</span>
          {!phone && <span></span>}
          {!phone && (
            <span className="rd-hl-shead" role="columnheader" ref={boxRef}>
              <span className="rd-ap-cap">Since the election<em><span className="rd-hl-sep">, </span>each row’s height is {SMAX === 1 ? "a point" : SMAX + " points"} either way</em></span>
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
      <RdTsig summary="Trend-significance table"
        heads={["Pollster", "Lean, first → last", "Slope, pts/yr", "t", "Significant"]}
        sets={[hlTsig]}
        note={"Each row’s slope is a straight line through that pollster’s own monthly leans since the election, as the sparklines above draw them, t-tested against zero; Holm’s correction is applied across the " + (hlTested.length === 1 ? "pollster" : hlTested.length + " pollsters") + " on show, so Yes means a lean is drifting, not just sitting off-centre."}
      />
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
  const [tip, setTip] = useState(null);        // the wave dot being read: { id, src, d, px }
  const ptr = React.useRef(null);
  const chartBox = React.useRef(null);
  const tipBox = React.useRef(null);
  /* a touch-opened tip has no pointer-leave, so the next gesture starting
     OUTSIDE the chart puts it away — the shared capture-phase dismiss every
     panel tip here already uses (user report 2026-10-05) — and any stray
     month-hover goes with it, or the month-guide card swaps IN as the tip
     card unmounts (the "closes weirdly" half of the 2026-10-06 report: the
     user was seeing the narrow month card replace the wave card, not a
     clean dismiss) */
  window.useDismissOutside(chartBox, !!(tip && tip.src === "touch"), () => { setTip(null); setHv(null); });
  /* The tips' x clamp is computed IN RENDER from the tip's own measured
     WIDTH — TrendChart's tipW idiom, and the reason this block is on its
     second rewrite: the base .tip GLIDES left .15s between positions
     (site-wide and deliberate — trend readouts chase the pointer), and
     React reuses the tip node across dot-to-dot opens, so an imperative
     post-commit clamp (reset marginLeft → measure the rect, the RdAp
     detail pattern) reads the rect at the glide's START. The user repro
     2026-10-06: tap a mid dot, then the far-right Essential, then
     far-left — the correction hung on the OLD position and the card
     glided 50–90px past the screen edge (probe: [189,420] and [−69,161]
     of a [20,370] box). Clamping in render keeps every glide frame
     between two in-bounds positions, and doing it in chart-local px (the
     svg is width W exactly) means a too-wide card can never widen the
     phone's layout viewport either — by construction, not by chase.
     Width is measured per KIND in the LAYOUT effect below (the corrected
     left lands in the same paint) and kept across closes, since the next
     tip of a kind carries the same rows; the per-kind halve-fallback
     seeds a kind's first mount and runs GENEROUS, so the first commit
     errs toward the centre, never past an edge, and the measured value
     replaces it before the frame paints. No tip is ever wider than the
     chart (maxWidth W - 16, its sentences wrap - rd.css), so on the
     narrowest phone the clamp still holds every edge inside the screen. */
  const FLOW_TIP_HALF = { m: 90, w: 125, v: 155 };
  const [tipWs, setTipWs] = useState({ m: 0, w: 0, v: 0 });
  const tipLeft = (kind, px) => {
    const half = (tipWs[kind] || 0) / 2 || FLOW_TIP_HALF[kind];
    const h = Math.min(half, W / 2 - 8);   // a card wider than the chart clamps dead centre
    return Math.min(W - 8 - h, Math.max(8 + h, px));
  };
  React.useLayoutEffect(() => {
    const el = tipBox.current, box = chartBox.current;
    if (!el || !box) return;
    const kind = tip ? (tip.hd ? "v" : "w") : "m";
    const w = el.offsetWidth;
    setTipWs((p) => (Math.abs((p[kind] || 0) - w) > 0.5 ? { ...p, [kind]: w } : p));
    /* the card hangs UP from top:-6px (translate -100%): right after the
       chart is scrolled into view — chart top at the screen's top, the
       classic first-press shape — a tall card (~150px) opened 50+px ABOVE
       the screen (probe repro −56/−59px). Slide it DOWN until its top
       clears the 72px sticky-bar scroll-margin + 6. Vertical overhang
       never widens the layout viewport, so viewport coords are the
       stable clamp line here — unlike the x clamp, nothing here reads a
       gliding value. */
    el.style.top = "";
    const b = box.getBoundingClientRect();
    const minTop = 78 - b.top + el.offsetHeight;
    if (minTop > -6) el.style.top = Math.round(minTop) + "px";
  }, [tip, hv]);
  const H = phone ? 210 : 250;
  const x0 = phone ? 26 : 40, rpad = phone ? 66 : 76, top = 14, bot = phone ? 178 : 214;
  const x1 = W - rpad;
  const ms = rdApMonths(RD_AP_TERM1);
  /* one calendar axis, first month's first day to last month's last: a
     month's figure sits at its MIDDLE (Xm), where the polls it averages
     centre, and a wave at its released date (Xw), so the line runs through
     its own dots. Ticks mark month starts (Xs). Indexing months to the axis
     ends instead drew each figure half a month early and let a late-month
     wave run past the plot into the Now mark */
  const mw = (x1 - x0) / ms.length;
  const Xs = (ym) => x0 + ms.indexOf(ym) * mw;
  const X = (ym) => Xs(ym) + mw / 2;
  const Xw = (iso) => {
    const i = ms.indexOf(iso.slice(0, 7));
    if (i < 0) return null;
    const dim = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
    return x0 + (i + (Number(iso.slice(8, 10)) - 1) / dim) * mw;
  };
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
    ? (window.JUR ? rdApMonthTicks(ms, 12).map((t) => [t.ym, t.lab])
      : [["2025-06", "Jun ’25"], ["2026-01", "Jan ’26"], [ms[ms.length - 1], D.monthName(Number(ms[ms.length - 1].slice(5)))]])
    : rdApMonthTicks(ms, ms.length > 30 ? 6 : 3).map((t) => [t.ym, t.lab]);
  const houses = fd.houses || {};
  const pickS = pick && houses[pick] ? houses[pick].filter((d) => ms.includes(d.ym)) : null;
  const onMove = (ev) => {
    if (tip) return;                     // a wave dot is being read – no month guide behind it
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    if (x > x1 + 8) { setHv(null); return; }
    let best = null;
    mo.forEach((d) => { const dx = Math.abs(X(d.ym) - x); if (!best || dx < best.dx) best = { dx, d }; });
    setHv(best ? best.d : null);
  };
  const s1 = (v) => (Math.abs(v) < 0.05 ? "0.0" : rdSigned(v, 1));
  return (
    <div className="rd-fl-chart" ref={chartBox}>
      {/* hover is MOUSE-ONLY: a touch tap raises compat mousemoves, and a
          tap-seeded hv left the month-guide tip standing when the wave tip
          closed (the "closes weirdly" report 2026-10-06). Gate on pointer
          type, same as the hit circles' pointerenter below. */}
      <svg width={W} height={H + 12} viewBox={`0 0 ${W} ${H + 12}`} role="img" onPointerMove={(ev) => { if (ev.pointerType === "mouse") onMove(ev); }} onMouseLeave={() => setHv(null)}
           onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
           /* a touch tap on the blank chart puts an open tip away the
              sparkline's way (its marks' clicks stop propagation, so
              their toggles never reach here) */
           onClick={() => { const p = ptr.current; ptr.current = null; if (p === "touch") setTip(null); }}
           aria-label={`Published minus implied two-party figure against ${rival}, pooled across pollsters by month: now ${s1(nw.v)} points, 95% interval ±${nw.ci95.toFixed(1)}.`}>
        {[-3, -2, -1, 1, 2, 3].map((v) => <path key={v} d={`M${x0} ${Y(v)}H${x1}`} className="rd-dis-gl"></path>)}
        <path d={`M${x0} ${zero}H${x1}`} className="rd-fl-zero"></path>
        {[-3, -2, -1, 0, 1, 2, 3].map((v) => <text key={"t" + v} x={x0 - 8} y={Y(v) + 4} className="rd-dis-ax" textAnchor="end">{v === 0 ? "0" : rdSigned(v, 0)}</text>)}
        <path d={band} className="rd-fl-band"></path>
        {(() => {
          /* one dot per published wave: the wave's OWN gap at its release
             date, reading like the dots on every other poll chart – hover to
             read the wave, click to open the poll in the table (RdApMini's
             hit-circle idiom) */
          const wave = (d, i) => {
            const px = Xw(d.released);
            if (px == null) return null;
            const py = Y(Math.max(-3.4, Math.min(3.4, d.v)));
            const k = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: d.pollster, released: d.released }) : null;
            const id = d.pollster + "|" + d.released + "#" + i;
            const show = (src) => setTip({ id, src, d, px });
            const hide = (src) => setTip((tp) => (tp && tp.id === id && (!src || tp.src === src) ? null : tp));
            const open = () => { if (k && window.AP.openPoll) { setTip(null); window.AP.openPoll(k, "twopp", "the preference-flow chart"); } };
            return (
              <g key={id}>
                {tip && tip.id === id && <circle cx={px} cy={py} r="6" className="rd-apd-dothi"></circle>}
                {/* a highlighted pollster's own waves come forward, the rest recede */}
                <circle cx={px} cy={py} r={pickS && d.pollster === pick ? 3 : 2.2} className={"rd-fl-wdot" + (pickS ? (d.pollster === pick ? " on" : " off") : "")}></circle>
                <circle cx={px} cy={py} r="8" className={"rd-apd-hit" + (k ? " link" : "")}
                        tabIndex="0" role={k ? "button" : "img"}
                        aria-label={`${d.pollster}, fieldwork ${d.dateLabel}: published minus implied ${s1(d.v)} points${d.fl != null ? `, respondent-allocated flow to Labor ${d.fl.toFixed(1)} percent` : ""}` + (k ? "; press Enter to open this poll" : "")}
                        onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
                        onPointerEnter={(ev) => { if (ev.pointerType === "mouse") { setHv(null); show("mouse"); } }}
                        onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide("mouse"); }}
                        onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show("focus"); }}
                        onBlur={() => hide("focus")}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const pt = ev.detail === 0 ? "key" : ptr.current;
                          ptr.current = null;
                          if (pt === "mouse" || pt === "key") { open(); return; }
                          if (tip && tip.id === id) setTip(null); else show("touch");
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
                          ev.preventDefault();
                          open();
                        }}></circle>
              </g>
            );
          };
          /* the per-house monthly gaps carry NO painted dot — they read as
             poll dots and "only served to confuse" (user call 2026-10-05).
             They read through the highlight instead: the picked pollster's
             months draw as the thin pick line below, and a hit ring at each
             of its vertices raises that month's tip. Unpicked houses keep no
             rings - an unseen hover target the key could only describe in
             words. A mark opens nothing on click (it is not a poll); touch
             toggles the tip. */
          const vtx = pickS ? houses[pick].filter((d) => ms.includes(d.ym)).map((d, i) => {
            const vid = "vtx|" + pick + "|" + d.ym;
            const vx = X(d.ym), vy = Y(Math.max(-3.4, Math.min(3.4, d.v)));
            const showV = (src) => setTip({ id: vid, src, hd: { h: pick, ym: d.ym, v: d.v, fl: d.fl ?? null }, px: vx });
            const hideV = (src) => setTip((tp) => (tp && tp.id === vid && (!src || tp.src === src) ? null : tp));
            return (
              <g key={pick + i}>
                {tip && tip.id === vid && <circle cx={vx} cy={vy} r="6" className="rd-apd-dothi"></circle>}
                <circle cx={vx} cy={vy} r="8" className="rd-apd-hit rd-fl-vhit"
                        tabIndex="0" role="img"
                        aria-label={`${pick}, ${rdMonthYear(d.ym)}: this pollster’s gap that month, published minus implied ${s1(d.v)} points${d.fl != null ? `, respondent-allocated flow to Labor ${d.fl.toFixed(1)} percent` : ""}`}
                        onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
                        onPointerEnter={(ev) => { if (ev.pointerType === "mouse") { setHv(null); showV("mouse"); } }}
                        onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hideV("mouse"); }}
                        onFocus={(ev) => { if (ev.target.matches(":focus-visible")) showV("focus"); }}
                        onBlur={() => hideV("focus")}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const pt = ev.detail === 0 ? "key" : ptr.current;
                          ptr.current = null;
                          if (pt === "mouse" || pt === "key") return;
                          if (tip && tip.id === vid) setTip(null); else showV("touch");
                        }}></circle>
              </g>
            );
          }) : null;
          /* paint order is hit order: with a pollster highlighted, the
             faded waves go down first, then its line's month marks, then
             its own waves on top - so a tap on the highlighted line reads
             the line, not a faded neighbour's dot (2026-10-12) */
          const ws = fd.polls || [];
          return <>
            {ws.map((d, i) => (pickS && d.pollster === pick ? null : wave(d, i)))}
            {vtx}
            {pickS && ws.map((d, i) => (d.pollster === pick ? wave(d, i) : null))}
          </>;
        })()}
        {pickS && pickS.length > 1 && <path d={monotoneXY(pickS.map((d) => [X(d.ym), Y(Math.max(-3.4, Math.min(3.4, d.v)))]))} className="rd-fl-pick"></path>}
        {/* the line and its end dots obey the dots' ±3.4 clamp, or a month past the ±3.5 scale (Oct '26 −4.7, the first) dives through the axis into the tick labels and reads as a point BELOW the clamped wave dots; the true figure still reads in every tooltip */}
        <path d={monotoneXY(mo.map((d) => [X(d.ym), Y(Math.max(-3.4, Math.min(3.4, d.v)))]))} className="rd-fl-line"></path>
        <circle cx={X(e.ym)} cy={Y(Math.max(-3.4, Math.min(3.4, e.v)))} r="3" className="rd-fl-enddot"></circle>
        <path d={`M${nx} ${Y(Math.min(3.5, nw.v + nw.ci95))}V${Y(Math.max(-3.5, nw.v - nw.ci95))}`} className="rd-fl-nowwh"></path>
        <circle cx={nx} cy={Y(nw.v)} r="5" className="rd-fl-now"></circle>
        <text x={nx} y={top - 2} className="rd-fl-nowh" textAnchor="middle">Now</text>
        <text x={nx + 10} y={Y(nw.v) + 5} className="rd-fl-nowv">{s1(nw.v)}</text>
        <text x={nx + 10} y={Y(nw.v) + 20} className="rd-fl-nowci">±{nw.ci95.toFixed(1)}</text>
        <text x={x0 + 6} y={Y(3.5) + 13} className="rd-fl-note">▲ Published kinder to Labor</text>
        <text x={x0 + 6} y={Y(-3.5) - 6} className="rd-fl-note">▼ Kinder to {rival}</text>
        {/* the longest phrasing that fits the empty span, measured (the
            fixed 110px test let the long note run into the band at 1024px) */}
        {(() => {
          const t = emptyNote && emptyNote.find((n) => textWidth(n, 12, 400) <= X(mo[0].ym) - x0 - 14);
          return t ? <text x={(x0 + X(mo[0].ym)) / 2} y={Y(1.4)} className="rd-fl-empty" textAnchor="middle">{t}</text> : null;
        })()}
        <path d={`M${x0} ${bot}H${x1}` + ticks.map(([ym]) => `M${Xs(ym)} ${bot}v4`).join("")} className="rd-dis-base"></path>
        {ticks.map(([ym, lab]) => <text key={ym} x={Xs(ym)} y={bot + 20} className="rd-dis-ax" textAnchor="middle">{lab}</text>)}
        {hv && !tip && <path d={`M${X(hv.ym)} ${top}V${bot}`} className="rd-dis-guide"></path>}
        {hv && !tip && <circle cx={X(hv.ym)} cy={Y(Math.max(-3.4, Math.min(3.4, hv.v)))} r="4" className="rd-fl-enddot"></circle>}
      </svg>
      {hv && !tip && (
        <span ref={tipBox} className="tip rd-fl-tip" style={{ left: tipLeft("m", X(hv.ym)), maxWidth: W - 16 }}>
          <span className="tip-title">{rdMonthYear(hv.ym)}</span>
          <span className="tip-row"><span className="tip-label">All pollsters</span><span className="tip-val">{s1(hv.v)}</span></span>
          <span className="tip-row"><span className="tip-label">95% interval</span><span className="tip-val">±{hv.ci95.toFixed(1)}</span></span>
          {hv.k != null && <span className="tip-row"><span className="tip-label">Polls</span><span className="tip-val">{hv.k}</span></span>}
        </span>
      )}
      {tip && (() => {
        const { d, px, hd } = tip;
        if (hd) return (
          <span ref={tipBox} className="tip rd-fl-tip" style={{ left: tipLeft("v", px), maxWidth: W - 16 }}>
            <span className="tip-title">{hd.h}</span>
            <span className="tip-row"><span className="tip-label">Month</span><span className="tip-val">{rdMonthYear(hd.ym)}</span></span>
            <span className="tip-row"><span className="tip-label">House drift</span><span className="tip-val">{s1(hd.v)}</span></span>
            {hd.fl != null && <span className="tip-row"><span className="tip-label">Respondent flow to Labor</span><span className="tip-val">{hd.fl.toFixed(1)}%</span></span>}
            <span className="tip-sub tip-hint">this pollster’s gap that month – not a published wave</span>
          </span>
        );
        const k = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: d.pollster, released: d.released }) : null;
        return (
          <span ref={tipBox} className="tip rd-fl-tip" style={{ left: tipLeft("w", px), maxWidth: W - 16 }}>
            <span className="tip-title">{d.pollster}</span>
            <span className="tip-row"><span className="tip-label">Published minus implied</span><span className="tip-val">{s1(d.v)}</span></span>
            {d.fl != null && <span className="tip-row"><span className="tip-label">Respondent flow to Labor</span><span className="tip-val">{d.fl.toFixed(1)}%</span></span>}
            <span className="tip-row"><span className="tip-label">Fieldwork</span><span className="tip-val">{d.dateLabel}</span></span>
            {d.sample != null && <span className="tip-row"><span className="tip-label">Sample</span><span className="tip-val">n = {d.sample.toLocaleString()}</span></span>}
            {/* standard tip-hint chrome (accent colour, div not span —
                .tip-sub sits later in the cascade and would grey it) and
                only for an input that can actually open the poll: a touch
                tap READS the dot, it never navigates */}
            {k && tip.src !== "touch" && <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls"}</div>}
          </span>
        );
      })()}
    </div>
  );
}

/* ---------------------------------------------------------------- preference flows — contest by contest */
/* Rebuilt 2026-10-13 (the user: "an ill-conceived and disordered hodgepodge
   - especially on small screens"; design B of that day's mockups, the
   user's pick). The section answers three questions in reading order:
   where each group's preferences go and whether voters' answers have
   moved (the ledger), and whether the pollsters' own two-party figures
   show it (the drift chart, RdFlowChart above). One contest at a time,
   on the house-lean section's anatomy: tabs walk Labor v Coalition,
   Labor v One Nation and Coalition v One Nation; a tab's ledger lists the
   contest's voter groups - the flow the site assumes, RedBridge/Accent's
   and DemosAU's latest answers, and a line of RedBridge's monthly answers
   against the assumption (a dotted line across the row, where the old
   charts drew a ring at the election day and a lead-in over nine empty
   months) - then the contest's drift chart. DemosAU's MRP readings stand
   apart from RedBridge's line as triangles: the user's call the same
   day, reversing the morning's joined line, because one line through two
   houses' readings made a gap between the houses read as a monthly swing.
   Each menu sits on the part it steers: the region menu on the ledger,
   the highlight menu on the chart. */
/* FF_COHORTS, the groups themselves, live in menu-lines.js with the page's finding */
const FF_MRP_HOUSE = "DemosAU (MRP)";
/* the region menu over the ledger: "" (All voters) is our enrolment-and-
   vote weighting of the MRP's printed regional tables; the rest are the
   reports' printed region cells */
const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];
const FF_REG_OF = { inner: "inner metro", outer: "outer metro", regional: "regional or rural" };
const FL_TABS = [{ id: "co", label: "Labor v Coalition" }, { id: "on", label: "Labor v One Nation" }, { id: "ln", label: "Coalition v One Nation" }];
/* the months a window names, for a column head: "4 Aug–19 Sep 2026" -> "Aug–Sep" */
const flWinMonths = (win) => {
  const m = String(win || "").match(/[A-Z][a-z]{2}/g) || [];
  return !m.length ? "" : m[0] === m[m.length - 1] ? m[0] : m[0] + "–" + m[m.length - 1];
};
/* flFig, a figure at its source's precision, lives in menu-lines.js too */

/* one voter group's answers over the year: RedBridge/Accent's monthly
   line, DemosAU's MRP triangles standing apart from it, the 2026 state
   and by-election counts as crosses, all against the contest's assumed
   flow drawn as a dotted line (its band shaded where the table carries
   one) with the gap between line and assumption faintly filled - the
   house-lean sparklines' idiom. Every row of a tab spans the same number
   of points, so slopes compare down the ledger. A mark's tip opens on
   hover (mouse), tap (touch) or focus; a mouse click on a poll's mark
   opens that poll in the table above. The pointer picks the NEAREST mark
   (stacked hit circles hid one another on the old charts), weighting
   across the row more than up it, as a thumb lands */
function RdFlowSpark({ ck, marks, refv, band, W, H, dom, yr, tip, onTip, onOpen, tipBody, emptyNote, ariaHead }) {
  const ptr = useRef(null);
  const tipRef = useRef(null);
  const svgRef = useRef(null);
  const [tipW, setTipW] = useState(0);
  const [below, setBelow] = useState(false);
  const pl = 6, pr = 6, pt = 7, pb = 7;
  const X = (m) => pl + ((m - dom[0]) / Math.max(1e-9, dom[1] - dom[0])) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - yr[0]) / (yr[1] - yr[0])) * (H - pt - pb);
  const cls = FF_COHORTS[ck].cls;
  const rb = marks.filter((m) => m.kind === "wave");
  const dm = marks.filter((m) => m.kind === "mrp");
  const pts = rb.map((m) => [X(m.xm), Y(m.v)]);
  const tm = tip && tip.ck === ck ? marks.find((m) => m.id === tip.id) : null;
  /* the tip hangs above its mark unless that would open it under the
     site's sticky bar (78px), as the drift chart's does; measured once per
     mark, so the flip never loops */
  React.useLayoutEffect(() => {
    const el = tipRef.current, sv = svgRef.current;
    if (!el || !sv || !tm) return;
    setTipW((p) => (Math.abs(p - el.offsetWidth) > 0.5 ? el.offsetWidth : p));
    const top = sv.getBoundingClientRect().top + Y(tm.v) - 10 - el.offsetHeight;
    setBelow(top < 78);
  }, [tm && tm.id]);
  const half = Math.min((tipW || 240) / 2, W / 2 - 8);
  const tipLeft = (x) => Math.min(W - 8 - half, Math.max(8 + half, x));
  const nearest = (ev, reach) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    let best = null, bd = reach * reach;
    for (const m of marks) {
      const dd = (X(m.xm) - px) ** 2 + ((Y(m.v) - py) / 2.5) ** 2;
      if (dd <= bd) { bd = dd; best = m; }
    }
    return best;
  };
  const C = (v) => Math.max(yr[0], Math.min(yr[1], v));
  return (
    <div className="rd-fx-spark">
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaHead}
           className={tip && tip.ck === ck && tip.src === "mouse" && tm && tm.key ? "link" : null}
           onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
           onPointerMove={(ev) => {
             if (ev.pointerType !== "mouse") return;
             const m = nearest(ev, 14);
             if (m) { if (!tip || tip.ck !== ck || tip.id !== m.id || tip.src !== "mouse") onTip({ ck, id: m.id, src: "mouse" }); }
             else if (tip && tip.ck === ck && tip.src === "mouse") onTip(null);
           }}
           onPointerLeave={(ev) => { if (ev.pointerType === "mouse" && tip && tip.ck === ck && tip.src === "mouse") onTip(null); }}
           onClick={(ev) => {
             const p = ptr.current;
             ptr.current = null;
             const m = nearest(ev, p === "mouse" ? 14 : 26);
             if (!m) { if (p !== "mouse") onTip(null); return; }
             ev.stopPropagation();
             if (p === "mouse" && m.key) { onTip(null); onOpen(m.key); return; }
             if (tip && tip.ck === ck && tip.id === m.id && p !== "mouse") onTip(null);
             else onTip({ ck, id: m.id, src: p === "mouse" ? "mouse" : "touch" });
           }}>
        {refv != null && band != null && <rect className="rd-fx-refb" x={pl} y={Y(C(refv + band))} width={W - pl - pr} height={Math.max(0, Y(C(refv - band)) - Y(C(refv + band)))}></rect>}
        {refv != null && pts.length > 1 && <path className="rd-fx-area" d={monotoneXY(pts) + `L${pts[pts.length - 1][0]} ${Y(refv)}L${pts[0][0]} ${Y(refv)}Z`}></path>}
        {refv != null && <path className="rd-fx-ref" d={`M${pl} ${Y(refv)}H${W - pr}`}></path>}
        {pts.length > 1 && <path className={"rd-fx-line " + cls} d={monotoneXY(pts)}></path>}
        {!rb.length && dm.length > 1 && <path className={"rd-fx-mline " + cls} d={dm.map((m, i) => (i ? "L" : "M") + X(m.xm) + " " + Y(m.v)).join("")}></path>}
        {rb.slice(0, -1).map((m) => <circle key={m.id} className={"rd-fx-dot " + cls} cx={X(m.xm)} cy={Y(m.v)} r="2.4"></circle>)}
        {dm.map((m) => { const x = X(m.xm), y = Y(m.v); return <path key={m.id} className={"rd-fx-tr " + cls} d={`M${x} ${y - 5.2}L${x + 4.8} ${y + 3.8}L${x - 4.8} ${y + 3.8}Z`}></path>; })}
        {/* a contest's cross: an estimate carries its tested 90% miss as a
            whisker, a count of part of the vote (Secret Harbour's early
            voting centre) draws hollow - user 2026-10-21 */}
        {marks.filter((m) => m.kind === "byelec").map((m) => {
          const x = X(m.xm), y = Y(m.v), e = m.d.err && m.d.err[ck], rg = m.d.range && m.d.range[ck];
          const xd = `M${x - 3.6} ${y - 3.6}L${x + 3.6} ${y + 3.6}M${x + 3.6} ${y - 3.6}L${x - 3.6} ${y + 3.6}`;
          return <g key={m.id}>
            {(e != null || rg) && <path className={"rd-fx-x rd-fx-xerr " + cls} d={`M${x} ${Y(C(rg ? rg[1] : m.v + e))}V${Y(C(rg ? rg[0] : m.v - e))}`}></path>}
            <path className={"rd-fx-x " + cls + (m.d.kind === "part" ? " rd-fx-xhol" : "")} d={xd}></path>
            {m.d.kind === "part" && <path className="rd-fx-xcut" d={xd}></path>}
          </g>;
        })}
        {pts.length > 0 && <circle className={"rd-fx-end " + cls} cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.6"></circle>}
        {tm && <circle className="rd-apd-dothi" cx={X(tm.xm)} cy={Y(tm.v) + (tm.kind === "mrp" ? 0.6 : 0)} r="7.5"></circle>}
        {!marks.length && emptyNote && <text className="rd-fl-empty" x={W / 2} y={refv != null && Y(refv) < H / 2 ? H - 9 : 17} textAnchor="middle">{emptyNote}</text>}
        {/* the keyboard's and screen reader's marks; the pointer never
            lands on them (the svg's nearest-mark pick serves it) */}
        {marks.map((m) => (
          <circle key={"h" + m.id} className={"rd-apd-hit rd-fx-hit" + (m.key ? " link" : "")} cx={X(m.xm)} cy={Y(m.v)} r="8"
                  tabIndex="0" role={m.key ? "button" : "img"} aria-label={m.aria}
                  onFocus={(ev) => { if (ev.target.matches(":focus-visible")) onTip({ ck, id: m.id, src: "focus" }); }}
                  onBlur={() => onTip((t) => (t && t.ck === ck && t.id === m.id && t.src === "focus" ? null : t))}
                  onKeyDown={(ev) => {
                    if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
                    ev.preventDefault();
                    if (m.key) { onTip(null); onOpen(m.key); } else onTip({ ck, id: m.id, src: "focus" });
                  }}></circle>
        ))}
      </svg>
      {tm && (
        /* clamped inside the row by its measured width and never wider than
           the row (maxWidth): a phone's tip can't run past the screen, nor
           widen the page (the old charts' DemosAU tips ran 371-410px on a
           390px phone, 2026-10-13) */
        <span ref={tipRef} className={"tip rd-fl-tip rd-fx-tip" + (below ? " below" : "")}
              style={{ left: tipLeft(X(tm.xm)), top: Y(tm.v) + (below ? 14 : -10), maxWidth: W - 16 }}>
          {tipBody(tm)}
          {tm.key && tip.src !== "touch" && <div className="tip-hint">{tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls"}</div>}
        </span>
      )}
    </div>
  );
}

function RdFlows({ measure }) {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const narrow = useNarrow("(max-width: 900px)");
  const FD = D.flowDrift, FO = D.flowDriftOn;
  const FF = D.flowForced, FT = D.flowTables;
  /* the tab opens on the page's own contest and follows the page's
     two-party flip; a pick here stays local */
  const tabOf = (m) => (m === "onp" ? "on" : "co");
  const [q, setQ] = useState(() => tabOf(measure));
  const mWas = useRef(measure);
  useEffect(() => {
    if (mWas.current === measure) return;
    mWas.current = measure;
    setQ(tabOf(measure));
  }, [measure]);
  const [pick, setPick] = useState(null);
  const [ffReg, setFfReg] = useState("");
  const [tip, setTip] = useState(null);       // the ledger's one open tip: { ck, id, src }
  const ledger = useRef(null);
  window.useDismissOutside(ledger, !!(tip && tip.src === "touch"), () => setTip(null));
  /* hovering the section hands the arrow keys to the contest row, wrapping
     through the matchups the row's own walk does (the claim never survives
     the pointer leaving the section); the live tab list drops Coalition v
     One Nation on a jurisdiction with no forced-choice answers */
  useHoverClaim("flow-drift", true, null, (e) => {
    const list = window.AUSPOL.flowForced ? FL_TABS : FL_TABS.filter((t) => t.id !== "ln");
    const i = list.findIndex((t) => t.id === q);
    if (i < 0 || list.length < 2) return false;
    const nxt = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length].id;
    setQ(nxt); setTip(null);
    return true;
  }, [q]);
  /* Space cycles the region menu while the section is on screen - the
     all-polls table's and house lean's viewport claim, over the ledger's
     own select; with no menu (a jurisdiction without forced-choice
     answers) the key keeps its scroll day job */
  const spaceReg = React.useRef(null);
  spaceReg.current = FF ? () => {
    setFfReg((r) => FF_REGIONS[(FF_REGIONS.findIndex(([k]) => k === r) + 1) % FF_REGIONS.length][0]);
    setTip(null);
  } : null;
  React.useEffect(() => {
    const sec = document.getElementById("flow-drift");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      /* the contest row's SELECTED tab owns Space the roll's way: a click
         leaves the focus on it, where the key would only dead-fire the
         same contest pick, so the claim rolls the region menu with the
         tab's pick and focus staying put. An unpressed tab and the region
         menu itself keep the key's day job (its native pick; the menu's
         native open) */
      const onContestTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true"
        && a.matches('#flow-drift .rd-fl-tabs .rd-tab');
      if (!onContestTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceReg.current) return;
      e.preventDefault();
      if (!e.repeat) spaceReg.current();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
  const tabsRef = useRef(null);
  /* a phone's tab strip scrolls (see rd.css), so a pick - a tap, a swipe
     under the strip, or the page's two-party flip from elsewhere - glides
     its tab into sight: the strip's own scroller only, never
     scrollIntoView, which would drag the page to an off-screen strip (the
     house-lean tabs' rule) */
  useEffect(() => {
    const btn = tabsRef.current && tabsRef.current.querySelector('.rd-fl-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const r = btn.getBoundingClientRect(), b = sc.getBoundingClientRect();
    if (r.left < b.left) sc.scrollTo({ left: sc.scrollLeft + r.left - b.left - 28, behavior: SM });
    else if (r.right > b.right) sc.scrollTo({ left: sc.scrollLeft + r.right - b.right + 28, behavior: SM });
  }, [q]);
  const box = useRef(null);
  const Wall = useRdWidth(box, 1152);
  if (!FD || !FO || !FD.now || !FO.now) return null;
  const PR = (D.latest && D.latest.primary) || {};
  const regName = ffReg ? (FF_REGIONS.find(([k]) => k === ffReg) || [])[1] : "";
  const mi = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

  /* ---- the contests. The region menu rekeys DemosAU's printed regional
     carriers and the election column's seat-classification counts, never
     recomputes them; RedBridge/Accent asks nationally only, so a named
     region drops it (the user, 2026-10-13: "there should be no
     RedBridge/Accent polls" in a region's view), as it drops DemosAU's one
     national Labor-v-Coalition figure and the 2026 counts */
  const rekeyMrp = (ws) => (ws || []).map((w) => {
    if (!ffReg) return w.all ? { ...w, ...w.all, wt: true } : w;
    const t = w[ffReg];
    return t ? { ...w, ...t, wt: undefined } : null;
  }).filter(Boolean);
  const E = FF && FF.elec2025r;
  const C = FF ? {
    co: { id: "co", a: "Labor", r: "the Coalition", cohorts: ["grn", "onp", "oth"],
          ref: E ? (ffReg && E[ffReg] ? E[ffReg] : E.all) : null, refDp: 1, band: null,
          refHead: rdElecYear + " count", refSub: (ffReg ? regName : "as counted") + "*",
          refName: rdElecYear + " count*",
          rb: ffReg ? [] : FF.vsCoal, dm: ffReg ? [] : (FF.demos || []), bys: [],
          drift: FD, flows: "the " + rdElecYear + " flows" },
    on: { id: "on", a: "Labor", r: "One Nation", cohorts: ["coal", "grn", "oth"],
          ref: FT ? { coal: FT.onp.lnp * 100, grn: FT.onp.grn * 100, oth: FT.onp.oth * 100 } : null, refDp: null,
          band: FT ? { coal: FT.onBand.lnp * 100, grn: FT.onBand.grn * 100, oth: FT.onBand.oth * 100 } : null,
          refHead: "Site assumes", refSub: ffReg ? "national" : "built, no count", refName: "Site assumes",
          rb: ffReg ? [] : FF.vsOn, dm: rekeyMrp(FF.demosOn), bys: ffReg ? [] : (FF.bys || []),
          drift: FO, flows: "the site’s One Nation flows" },
    ln: { id: "ln", a: "the Coalition", r: "One Nation", cohorts: ["alp", "grn", "oth"],
          ref: null, refDp: null, band: null, refHead: "Site assumes", refSub: "no count", refName: null,
          rb: [], dm: rekeyMrp(FF.lnpOn), bys: [], drift: null, flows: null },
  } : {
    /* a jurisdiction with no forced-choice answers (/vic/): the tabs walk
       the two drift charts alone, no ledger */
    co: { id: "co", a: "Labor", r: "the Coalition", cohorts: [], ref: null, band: null, rb: [], dm: [], bys: [], drift: FD, flows: "the " + rdElecYear + " flows" },
    on: { id: "on", a: "Labor", r: "One Nation", cohorts: [], ref: null, band: null, rb: [], dm: [], bys: [], drift: FO, flows: "the site’s One Nation flows" },
  };
  const tabs = FF ? FL_TABS : FL_TABS.filter((t) => t.id !== "ln");

  /* ---- the pressed-choice battery (one straight line per voter group,
     Holm's correction across the rows) and the section's head and dek, on
     written rules: menu-lines.js, which the More menu quotes. The battery's
     Yes rows ride the ledger's "down from" and the trend table here */
  const { head, dek, ff, movedOf } = window.AP.flowStory();
  const s1 = (v) => Math.abs(v).toFixed(1);

  const c = C[q] || C.co;
  /* ---- one shared x domain for every row of every tab, whole months
     over every mark the ledger can draw, so a tab switch never re-spaces
     the months */
  const allXm = FF ? [...FF.vsCoal, ...FF.vsOn, ...(FF.demos || []), ...(FF.demosOn || []), ...(FF.lnpOn || []), ...(FF.bys || [])]
    .map((d) => (d.xm != null ? d.xm : d.ym ? mi(d.ym) : null)).filter((v) => v != null) : [];
  const dom = allXm.length ? [Math.floor(Math.min(...allXm)), Math.ceil(Math.max(...allXm))] : [0, 1];
  const ticks = [];
  for (let m = dom[0], yr = null; m <= dom[1]; m += 2) {
    const y = Math.floor(m / 12);
    ticks.push({ m, lab: D.monthName(m % 12 + 1) + (y !== yr ? " ’" + String(y).slice(2) : "") });
    yr = y;
  }
  const rbLast = c && c.rb.length ? c.rb[c.rb.length - 1] : null;
  const dmLast = c && c.dm.length ? c.dm[c.dm.length - 1] : null;
  const say = (v, dp) => flFig(v, dp);
  const marksOf = (ck) => {
    if (!c) return [];
    const who = (d) => ((d.lbl && d.lbl[ck]) || FF_COHORTS[ck].name) + " voters";
    const k = (house, date) => (house && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: house, released: date }) : null);
    const out = [
      ...c.rb.filter((w) => w[ck] != null).map((w) => ({ id: "w" + w.date, kind: "wave", xm: w.xm ?? mi(w.ym), v: w[ck], d: w, house: FF.house || "RedBridge/Accent" })),
      ...c.dm.filter((w) => w[ck] != null).map((w) => ({ id: "m" + w.date, kind: "mrp", xm: w.xm, v: w[ck], d: w, house: FF_MRP_HOUSE })),
      ...c.bys.filter((w) => w[ck] != null).map((w) => ({ id: "x" + w.key, kind: "byelec", xm: w.xm, v: w[ck], d: w, house: null })),
    ];
    for (const m of out) {
      m.key = k(m.house, m.d.date);
      const src = m.kind === "byelec" ? m.d.label : m.kind === "mrp" ? "DemosAU MRP" : m.house;
      m.aria = `${src}, ${m.d.win}: ${who(m.d)}, ${m.kind === "byelec" ? "preferences to " : ""}${c.a} ${say(m.v)}, ${c.r.replace(/^the /, "")} ${Math.round((100 - m.v) * 10) / 10}`
        + (m.kind === "mrp" && m.d.wt ? " — all regions, our weighting of DemosAU’s printed regional tables" : "")
        + (m.kind === "mrp" && ffReg ? ` — ${regName} seats, as the report prints them` : "")
        + (m.kind === "byelec" && m.d.sub ? " — " + m.d.sub : "")
        + (m.d.estCohort === ck ? " — the June Coalition figure combines the report’s printed CLP/LNP/Nat and Liberal rows" : "")
        + (m.key ? "; press Enter to open this poll" : "");
    }
    return out.sort((a, b) => a.xm - b.xm);
  };
  /* every row of a tab spans the same number of points (30 at least), so
     a slope in one row reads the same as in the next */
  const valsOf = (ck) => [...marksOf(ck).map((m) => m.v),
    ...(c && c.ref ? [c.ref[ck] - (c.band ? c.band[ck] : 0), c.ref[ck] + (c.band ? c.band[ck] : 0)] : [])];
  const need = c ? Math.max(0, ...c.cohorts.map((ck) => { const v = valsOf(ck); return v.length ? Math.max(...v) - Math.min(...v) : 0; })) : 0;
  const span = Math.max(30, Math.ceil((need + 4) / 10) * 10);
  const yrOf = (ck) => {
    const v = valsOf(ck);
    if (!v.length) return [0, span];
    const mn = Math.min(...v), mx = Math.max(...v);
    let lo = Math.floor(((mn + mx) / 2 - span / 2) / 5) * 5;
    lo = Math.max(0, Math.min(100 - span, lo));
    if (mn < lo + 1) lo = Math.max(0, Math.floor((mn - 1) / 5) * 5);
    if (mx > lo + span - 1) lo = Math.min(100 - span, Math.ceil((mx + 1 - span) / 5) * 5);
    return [lo, lo + span];
  };
  /* the ledger's columns: who, assumption, RedBridge, DemosAU, then the
     line - the line beneath the row from 900px down, as the house-lean
     table's phone rows carry theirs */
  const colW = Wall > 1100 ? [220, 100, 128, 100, 40] : [176, 92, 116, 92, 28];
  const sparkW = narrow ? Wall : Math.max(160, Wall - colW.reduce((a, b) => a + b, 0));
  const sparkH = narrow ? 52 : 64;
  const grid = narrow ? undefined : { gridTemplateColumns: colW.map((w) => w + "px").join(" ") + " minmax(0, 1fr)" };
  const tipBody = (m) => {
    const ck = m.ck;
    const lbl = (m.d.lbl && m.d.lbl[ck]) || FF_COHORTS[ck].name;
    const refV = c.ref ? c.ref[ck] : null;
    return <>
      <span className="tip-title">{m.kind === "byelec" ? m.d.label + ", " + m.d.win : (m.kind === "mrp" ? "DemosAU MRP" : m.house) + ", " + m.d.win}</span>
      <span className="tip-sub rd-fx-tsub">{m.kind === "byelec" ? m.d.sub : lbl + " voters choosing between " + c.a + " and " + c.r}</span>
      <span className="tip-row on"><span className={"tip-swatch rd-fx-sw " + m.kind + " " + FF_COHORTS[ck].cls}></span><span className="tip-label">{m.kind === "byelec" ? "Preferences to " + c.a : "Pick " + c.a}</span><span className="tip-val">{say(m.v)}%</span></span>
      {m.kind === "byelec" && m.d.err && m.d.err[ck] != null && <span className="tip-row"><span className="tip-label rd-fx-tind">Estimate’s 90% error</span><span className="tip-val">±{say(m.d.err[ck])}</span></span>}
      {m.kind === "byelec" && m.d.range && m.d.range[ck] && <span className="tip-row"><span className="tip-label rd-fx-tind">Range, by method</span><span className="tip-val">{say(m.d.range[ck][0])}–{say(m.d.range[ck][1])}</span></span>}
      {m.kind === "byelec" && ((m.d.lbl && m.d.lbl[ck]) || (m.d.alt && m.d.alt[ck])) && <span className="tip-sub rd-fx-tnote">{rdCap([m.d.lbl && m.d.lbl[ck], m.d.alt && m.d.alt[ck]].filter(Boolean).join("; "))}</span>}
      {refV != null && <span className="tip-row"><span className="tip-label rd-fx-tind">{c.refName}</span><span className="tip-val rd-fx-tref">{say(refV, c.refDp)}{c.band ? " ±" + say(c.band[ck]) : ""}</span></span>}
      {m.d.n != null && <span className="tip-row"><span className="tip-label rd-fx-tind">Sample</span><span className="tip-val">n = {m.d.n.toLocaleString()}</span></span>}
      {m.kind === "mrp" && m.d.wt && <span className="tip-sub rd-fx-tnote">All voters is our weighting of the report’s three regional tables, by enrolment and vote.</span>}
      {m.kind === "mrp" && ffReg && <span className="tip-sub rd-fx-tnote">{regName} seats, as the report prints them.</span>}
      {m.d.estCohort === ck && <span className="tip-sub rd-fx-tnote">June’s Coalition figure combines the report’s printed CLP/LNP/Nat (34) and Liberal (37) rows; no combined row was printed.</span>}
    </>;
  };
  const openPoll = (k) => { if (window.AP.openPoll) window.AP.openPoll(k, "twopp", "the preference-flows ledger"); };
  /* the poll columns' heads open the wave they headline in the All polls
     table, as the lines' marks do; the change note's month opens the wave
     it names. Plain text whenever the wave has no page row */
  const waveKey = (house, w) => (w && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: house, released: w.date }) : null);
  const srcOf = (house) => house.replace(/\s*\(MRP\)/, " MRP");
  const colHead = (house, w, name, em) => {
    const k = waveKey(house, w);
    const inner = <>{name}<em>{em}</em></>;
    if (!k) return inner;
    return <button type="button" className="rd-fx-th" aria-label={srcOf(house) + ", " + w.win + " - open this poll in the All polls table"} onClick={() => openPoll(k)}>{inner}</button>;
  };
  const chgMonth = (mv) => {
    const w = (q === "ln" ? c.dm : c.rb).find((x) => x.ym === mv.ym);
    const house = q === "ln" ? FF_MRP_HOUSE : FF.house || "RedBridge/Accent";
    const mm = D.monthName(Number(mv.ym.slice(5)));
    if (!waveKey(house, w)) return mm;
    return <button type="button" className="rd-fx-mo" aria-label={srcOf(house) + ", " + w.win + " - open this poll in the All polls table"} onClick={() => openPoll(waveKey(house, w))}>{mm}</button>;
  };
  /* what a flow is worth: the contest's biggest group's share of the vote,
     so each 10 points of its preferences moves the figure by a tenth of it.
     Coalition v One Nation carries no site figure, so no stake line */
  const big = c && q !== "ln" ? [...c.cohorts].sort((a, b) => (PR[FF_COHORTS[b].share] || 0) - (PR[FF_COHORTS[a].share] || 0))[0] : null;
  const stake = big && PR[FF_COHORTS[big].share] != null
    ? FF_COHORTS[big].name + " voters are " + PR[FF_COHORTS[big].share].toFixed(1) + "% of the vote, so each 10 points of their preferences moves "
      + (q === "co" ? "Labor’s two-party figure" : "Labor’s figure against One Nation")
      + " by " + (PR[FF_COHORTS[big].share] / 10).toFixed(1) + " points."
    : "";
  const ledgerNote = (q === "co"
    ? (ffReg ? "* The AEC’s " + rdElecYear + " count in the seats classed " + FF_REG_OF[ffReg] + " that finished Labor v Coalition (" + (E && E[ffReg] ? E[ffReg].cov : "") + "). No poll asks this contest by region. "
      : "* The AEC’s " + rdElecYear + " count in the 115 seats that finished Labor v Coalition, so the three regions add up to it."
        + (E && E.all.nat ? " Across all 150 seats, " + c.cohorts.map((k) => E.all.nat[k].toFixed(1) + "% of " + FF_COHORTS[k].prose).join(", ").replace(/, ([^,]*)$/, " and $1") + " voters’ preferences went to Labor; the site’s two-party figures use those. " : " "))
    : q === "on" ? "No count of this contest exists, so the site builds its flows from " + rdElecYear + "’s Senate ballots and the 2026 state contests; the band is that table’s own range"
      + (ffReg ? ", and it is national on every view. " : ". ")
    : "No count of this contest exists and the site estimates none, so DemosAU’s MRP stands alone. ")
    + stake
    + (q !== "co" && !ffReg ? " * DemosAU prints this contest by region only; All voters is our weighting of its three regions by enrolment and vote." : "");

  /* ---- the drift battery: has each pollster's gap DRIFTED, not just sat
     off zero at the now-mark? One straight line per pollster through its
     own monthly marks, t-tested, Holm's correction within the contest */
  const flMonths = rdApMonths(RD_AP_TERM1);
  const flSetRows = (fd) => {
    const hs = fd.houses || {};
    const rows = Object.keys(hs).sort().map((h) => {
      const s = (hs[h] || []).filter((d) => flMonths.includes(d.ym));
      return { h, s, fit: withinHouseSlope(s.map((d) => ({ h, t: D.mx(d.ym), w: 1, y: d.v }))) };
    }).filter((r) => r.s.length);
    const tested = rows.filter((r) => r.fit);
    const sigH = [];
    for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
      if (r.fit.p >= 0.05 / (tested.length - i)) break;
      sigH.push(r.h);
    }
    return rows.map((r) => ({ key: r.h, name: r.h, sig: sigH.includes(r.h),
      cells: [rdTsSgn(r.s[0].v) + " → " + rdTsSgn(r.s[r.s.length - 1].v),
        r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–",
        r.fit ? (sigH.includes(r.h) ? "Yes" : "No") : "–"] }));
  };
  const tsSets = [
    ...(c.drift ? [{ key: "d" + q, label: "Published minus implied, against " + c.r, rows: flSetRows(c.drift) }] : []),
    { key: "p" + q, label: "What voters say: share picking " + c.a, rows: ff.filter((r) => r.q === q).map((r) => ({
      key: r.key, name: FF_COHORTS[r.ck].name + " voters", sig: r.sig,
      cells: [r.waves.length ? r.waves[0][r.ck] + " → " + r.waves[r.waves.length - 1][r.ck] : "–",
        r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–", r.fit ? (r.sig ? "Yes" : "No") : "–"] })) },
  ].filter((t) => t.rows.length);

  /* ---- the drift block's numbers */
  const houses = c && c.drift ? Object.keys(c.drift.houses || {}).sort() : [];
  const pickOn = pick && houses.includes(pick) ? pick : null;
  const nw = c && c.drift ? c.drift.now : null;
  const sideW = 340;
  const cw = narrow ? Wall : Math.max(320, Wall - sideW - 44);
  const verdict = nw ? (Math.abs(nw.v) < 0.05 ? "Published figures sit level with what " + c.flows + " give"
    : "Published figures now run " + s1(nw.v) + " points kinder to " + (nw.v > 0 ? "Labor" : c.r) + " than " + c.flows + " give")
    + (Math.abs(nw.v) <= nw.ci95 ? ". That is inside the margin, so no clear shift yet." : ". That is outside the ±" + nw.ci95.toFixed(1) + " margin, so the flows look to have shifted.") : "";
  const zeroNote = q === "on"
    ? "Zero is each pollster’s usual gap, set by its first head-to-heads, as no count of this contest exists."
    : "Zero is each pollster’s usual gap, set by its polls in the six months after the election.";

  return (
    <section className="rd-sec rd-fl" id="flow-drift" aria-labelledby="rd-fl-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-fl-t">Respondent-allocated preference flows</h2>
        <span className="rd-meta">{FF ? "Where other parties’ voters send their preferences, and whether that has changed since " + rdElecYear : "Whether preferences still flow the way they did at the " + rdElecYear + " election"}</span>
      </div>
      <RdHed head={head} dek={dek} />
      <div ref={box} className="rd-fl-body">
        <div ref={tabsRef} className="rd-fl-tabwrap">
          <RdTabs swipe value={q} onChange={(v) => { setQ(v); setTip(null); }} ariaLabel="Contest" className="rd-fl-tabs" options={tabs} />
        </div>
        {FF && (
          <div className="rd-fl-ledger" ref={ledger}
            /* a touch tap anywhere in the ledger but off a spark puts the
               open tip away too (a blank lane, the key row, the note);
               the sparks' own clicks still manage their marks, outside-
               the-ledger gestures ride the dismiss-outside hook */
               onPointerDown={(ev) => {
                 if (ev.pointerType !== "touch") return;
                 if (ev.target && ev.target.closest && ev.target.closest(".rd-fx-spark")) return;
                 setTip((t) => (t && t.src === "touch" ? null : t));
               }}>
            <div className="rd-fl-lhead">
              <h4 className="rd-ap-ct">Share of each group’s voters whose preferences go to {c.a} rather than {c.r}, %</h4>
              <label className="rd-fl-reg">
                <span>Voters</span>
                <select className="rd-pv-sel rd-fl-sel" aria-label="Region" value={ffReg} onChange={(e) => { setFfReg(e.target.value); setTip(null); }}>
                  {FF_REGIONS.map(([k, name]) => <option key={k || "all"} value={k}>{name}</option>)}
                </select>
              </label>
            </div>
            <div className={"rd-fx" + (narrow ? " narrow" : "")} role="table" aria-label={"Where each group’s preferences go, " + FL_TABS.find((t) => t.id === q).label + (ffReg ? ", " + regName + " seats" : "")}>
              <div className="rd-fx-hrow" role="row" style={grid}>
                <span className="rd-ap-th" role="columnheader">Voters</span>
                <span className="rd-ap-th r wrap" role="columnheader">{narrow ? (q === "co" ? rdElecYear : "Site") : c.refHead}<em>{narrow ? (q === "co" ? "count*" : q === "on" ? (ffReg ? "national" : "assumes") : "–") : c.refSub}</em></span>
                <span className="rd-ap-th r wrap" role="columnheader">{colHead(FF.house || "RedBridge/Accent", rbLast, narrow ? "RedBr." : "RedBridge", c.rb.length ? (narrow ? D.monthName(Number(rbLast.ym.slice(5))) : D.monthName(Number(rbLast.ym.slice(5))) + " wave") : ffReg && q !== "ln" ? "national only" : "doesn’t ask")}</span>
                <span className="rd-ap-th r wrap" role="columnheader">{colHead(FF_MRP_HOUSE, dmLast, narrow ? "Demos" : "DemosAU", dmLast ? flWinMonths(dmLast.win) + (narrow ? "" : " MRP") + (q !== "co" && !ffReg ? "*" : "") : "national only")}</span>
                {!narrow && <span aria-hidden="true"></span>}
                {!narrow && (
                  <span className="rd-fx-shead" role="columnheader">
                    <span className="rd-ap-cap">Since {D.monthNameFull(dom[0] % 12 + 1)}<em>, each row spans {span} points</em></span>
                    {ticks.map((t, i) => <span key={t.m} className={"rd-ap-tk " + (i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle")} style={{ left: 6 + ((t.m - dom[0]) / Math.max(1e-9, dom[1] - dom[0])) * (sparkW - 12) }}>{t.lab}</span>)}
                  </span>
                )}
              </div>
              {c.cohorts.map((ck) => {
                const f = FF_COHORTS[ck];
                const rbW = [...c.rb].reverse().find((w) => w[ck] != null);
                const dmW = [...c.dm].reverse().find((w) => w[ck] != null);
                const mv = !ffReg ? movedOf(q, ck) : null;
                const marks = marksOf(ck).map((m) => ({ ...m, ck }));
                const share = PR[f.share];
                return (
                  <div key={ck} className="rd-fx-row" role="row" style={grid}>
                    <span className="rd-fx-who" role="rowheader"><b><i className={"rd-fx-swatch " + f.cls} aria-hidden="true"></i>{f.name}{narrow ? "" : " voters"}</b>{share != null && <span className="rd-ap-sub">{share.toFixed(1)}% of the vote</span>}</span>
                    <span className="rd-fx-n ref" role="cell">{c.ref ? <>{say(c.ref[ck], c.refDp)}{c.band ? <span className="rd-fx-band">±{say(c.band[ck])}</span> : null}</> : <span className="rd-fx-nil" aria-label="none">–</span>}</span>
                    <span className="rd-fx-n" role="cell">{rbW ? say(rbW[ck]) : <span className="rd-fx-nil" aria-label="not asked">–</span>}{mv && <span className="rd-fx-chg">{mv.up ? "up" : "down"} from {say(mv.from)} in {chgMonth(mv)}</span>}</span>
                    <span className="rd-fx-n" role="cell">{dmW ? say(dmW[ck]) : <span className="rd-fx-nil" aria-label="not asked">–</span>}</span>
                    {!narrow && <span aria-hidden="true"></span>}
                    <span className="rd-fx-sc" role="cell">
                      <RdFlowSpark ck={ck} marks={marks} refv={c.ref ? c.ref[ck] : null} band={c.band ? c.band[ck] : null}
                        W={sparkW} H={sparkH} dom={dom} yr={yrOf(ck)} tip={tip} onTip={setTip} onOpen={openPoll} tipBody={tipBody}
                        emptyNote={ffReg && q === "co" ? "No poll asks this by region" : "No readings"}
                        ariaHead={f.name + " voters’ preferences to " + c.a + ", month by month" + (c.ref ? ", against " + (q === "co" ? "the " + rdElecYear + " count of " : "the site’s ") + say(c.ref[ck], c.refDp) : "")} />
                    </span>
                  </div>
                );
              })}
              {narrow && (
                <div className="rd-fx-ticks" aria-hidden="true">
                  {ticks.map((t, i) => <span key={t.m} className={"rd-ap-tk " + (i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle")} style={{ left: 6 + ((t.m - dom[0]) / Math.max(1e-9, dom[1] - dom[0])) * (sparkW - 12) }}>{t.lab}</span>)}
                </div>
              )}
            </div>
            <RdKey className="rd-ckey rd-fx-key" items={[]}>
              {c.rb.length > 0 && <span className="rd-key-item"><span className="rd-fx-keyln" aria-hidden="true"><i></i></span>RedBridge/Accent, monthly</span>}
              {c.dm.length > 0 && <span className="rd-key-item"><span className="rd-fx-keydm" aria-hidden="true"></span>DemosAU MRP, quarterly</span>}
              {c.bys.length > 0 && <span className="rd-key-item"><span className="rd-fx-keyx" aria-hidden="true"></span>Contest counts and estimates</span>}
              {c.bys.some((w) => w.kind === "part") && <span className="rd-key-item"><ExHollowX />Hollow: a count of part of the vote</span>}
              {c.ref && <span className="rd-key-item"><span className={"rd-fx-keyref" + (c.band ? " band" : "")} aria-hidden="true"></span>{q === "co" ? rdElecYear + " count*" : "Site’s assumption, with its range"}</span>}
              {c.ref && c.rb.length > 0 && <span className="rd-key-item"><span className="rd-fx-keyarea" aria-hidden="true"></span>Gap to it</span>}
            </RdKey>
            <p className="rd-note rd-fx-note">{ledgerNote}</p>
          </div>
        )}
        {c.drift && (
          <div className={"rd-fl-dblock" + (FF ? "" : " solo")}>
            <div className="rd-fl-dhead">
              <div className="rd-fl-dtitle">
                {FF && <h3 className="rd-sub rd-fl-dt">Do the pollsters’ two-party figures show it?</h3>}
                <p className="rd-fl-dsub">Each poll’s published two-party figure minus what its primary votes give on {c.flows}, set against that pollster’s usual gap, points</p>
              </div>
              {/* the highlight menu steers this chart alone, so it sits on
                  the chart's own head - the page's control over a native
                  select (the rd-pv-sel idiom), at every width */}
              <select className="rd-pv-sel rd-fl-sel" aria-label="Highlight a pollster" value={pickOn || ""}
                      onChange={(e) => setPick(e.target.value || null)}>
                <option value="">{pickOn ? "No highlight" : "Highlight a pollster"}</option>
                {houses.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="rd-fl-dgrid" style={narrow ? undefined : { gridTemplateColumns: cw + "px minmax(0, 1fr)" }}>
              <div className="rd-fl-one">
                <RdFlowChart key={q} fd={c.drift} rival={c.r} W={cw} phone={phone} pick={pickOn}
                  emptyNote={q === "on" ? ["No readings before January", "Nothing before Jan", "None before Jan"] : null} />
              </div>
              <div className="rd-fl-dside">
                {!narrow && nw && <p className="rd-fl-dbig">{Math.abs(nw.v) < 0.05 ? "0.0" : rdSigned(nw.v, 1)}<span>±{nw.ci95.toFixed(1)}</span></p>}
                {!narrow && <p className="rd-fl-dverd">{verdict}</p>}
                <RdKey className={"rd-ckey rd-fl-key" + (narrow ? "" : " v")} items={[{ kind: "line", color: "var(--ink)", label: narrow ? "All pollsters, monthly" : "All pollsters, month by month" }, { kind: "band", color: "var(--ink-3)", label: "95% interval" }]}>
                  <span className="rd-key-item"><span className="rd-fl-keywd" aria-hidden="true"></span>One poll</span>
                  <span className="rd-key-item"><span className="rd-fl-keynow" aria-hidden="true"><i></i></span>{narrow ? "Now" : "Now: the latest weeks pooled"}</span>
                  {pickOn && <span className="rd-key-item"><span className="rd-fl-keypick" aria-hidden="true"></span>{pickOn}, month by month</span>}
                </RdKey>
                <p className="rd-note rd-fl-read">{zeroNote}{narrow ? "" : " A pollster that asks voters for their preferences would pull the line away from zero if those answers changed."}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <RdTsig summary="Trend-significance table"
        heads={["Series", "First → last", "Slope, pts/yr", "t", "Significant"]}
        sets={tsSets}
        note={(c.drift ? "Published minus implied: one straight line per pollster through its own monthly gaps since the election, t-tested, Holm’s correction within the contest. Yes means a gap is drifting, not just sitting off zero today; pollsters with too few months show dashes. " : "")
          + (FF ? "What voters say: one straight line per voter group through " + (q === "ln" ? "DemosAU’s quarterly MRP readings" : "RedBridge/Accent’s monthly answers") + ", Holm’s correction across every group in all three contests. A Yes is what the ledger’s “down from” and the section’s headline stand on." : "")} />
      <RdFoot how={{ term: "preference-flows", from: "Respondent-allocated preference flows" }}>
        {FF ? "RedBridge/Accent asks every month and nationally only, so a named region drops it. DemosAU’s MRP prints its One Nation contests by region; All voters is our weighting of its three regions by enrolment and vote. The " + rdElecYear + " count is the AEC’s, from the 115 seats that finished Labor v Coalition, so every view covers the same seats. The site’s two-party figures use the AEC’s flows across all 150 seats. This check corrects no other figure on the page."
          : "This check corrects no other figure on the page."}
      </RdFoot>
    </section>
  );
}

// ====================================================================
// PREFERENCE FLOWS, EXPLAINED – the fourth menu page
// ====================================================================
/* Its body is the one hand-maintained fragment
   .build/newtracker/explained-article.html, which build.mjs ships twice:
   as this tab document's static article (no-JS, crawlers, Safari Reader)
   and as window.EXPLAINED_ARTICLE for the instant client swap. The fragment
   stays HTML - some three hundred lines of tables and flow-band figures
   have no JSX port - and it is a trusted sibling of the sources, so the
   inner-HTML mount carries no escaping risk. */
/* The preference-flow history chart inside the explainer's "Ask or assume"
   section. The article body is static HTML (explained-article.html, mounted
   via dangerouslySetInnerHTML), so the chart can't sit inside it as JSX; it
   renders into this section's own footer and the whole card mounts into
   the article's #ex-fig-flow slot on commit - controls and chart move as
   one node, or the picker would stay stranded at the foot of the page.
   That covers BOTH parents that mount the article - this redesign
   RdExplained and the classic MenuPageView branch - through the one
   mechanism, so the slot is never left empty while a duplicate chart shows
   at the foot. With JavaScript off the slot is simply an empty div and the
   text flows on. The data is window.AUSPOL.flowHistory (one home,
   gen-data): the federal FLOW_HISTORY counts, the AEC's per-state cuts of
   them (fed.states, 2004-2025, counts), the SENATE's above-the-line flows
   beside them (fed.sen + fed.sen.states, counted from the AEC's ballot-
   level formal-preferences files, 2016-2025 - the House: control flips the
   bank, user 2026-10-22), and each state's ESTIMATES (the
   two-class pile model, .build/estimate-state-flows.py), so a jurisdiction
   appears in the menu the build its estimates land. A state carries
   `estimated` and each point's 90% error (grnErr/onpErr/othErr), drawn as a
   bar at its election and quoted in the tooltip; its One Nation line
   appears only where One Nation stood widely enough ballots behind an
   estimate (gen-data's onp_min_ballots rule), so it can break into lone
   points.
   Since 2026-10-21 (user call: "consistent with the design of other
   charts") the figure is a site chart card: contest tabs (RdTabs, the
   /flows/ page's views) with the Share flip in the tab row (the All polls
   idiom) and the House: flip beside it (user 2026-10-22, Lower ⇄ Upper),
   a .rd-chead title naming measure, unit and scope, the elections
   menu on that head (the /flows/ drift chart's highlight-menu idiom, a
   native select in place of two rows of chips), a px-sized TrendChart on
   Past cycles' half-column frame, the phone's key over the chart, the
   .rd-ckey key under it with the copy button, and the caption + How it's
   built as an RdFoot. Tooltip titles are short ("Hunter 2025"), so a
   phone's readout sizes to its rows instead of filling the screen; the
   contest's source stays in the caption. */
const FLOW_PARTIES = [
  { id: "grn", name: "Greens",     color: "var(--grn)" },
  { id: "onp", name: "One Nation", color: "var(--onp)" },
  { id: "oth", name: "Others",     color: "var(--oth)" },
];
/* the Labor v One Nation pairing's trio rides the RIVAL cohorts instead:
   the Coalition's own voters join the panel (One Nation voters no longer
   carry a line - their ballots name their party first). Only the Senate's
   ATL counts hold this pairing (the explainer's House: Upper view on the
   One Nation tab, user 2026-10-22) */
const FLOW_ON_PARTIES = [
  { id: "coal", name: "Coalition", color: "var(--lnp)" },
  { id: "grn",  name: "Greens",    color: "var(--grn)" },
  { id: "oth",  name: "Others",    color: "var(--oth)" },
];
/* the frame both views share: Past cycles' half-column chart (the article
   column is about that wide), 0-100 with the unit on the top tick */
const EX_TICKS = [0, 25, 50, 75, 100];
const exTickFmt = (v) => (v === 100 ? "100%" : String(v));
const exFrame = (narrow) => ({
  heightPx: narrow ? 260 : 290,
  padPx: narrow ? { l: 34, r: 16, t: 14, b: 28 } : { l: 40, r: 12, t: 16, b: 30 },
  yDomain: [0, 100], yTicks: EX_TICKS, yTickFmt: exTickFmt, baseline: true,
});
/* a count of part of the vote in the key: TrendChart's m.hollow cross
   (stroked in its colour, then cut through in the chart's background) */
const ExHollowX = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ marginRight: 6, verticalAlign: -1 }}>
    <path d="M2 2L9 9M9 2L2 9" stroke="var(--ink-2)" strokeWidth="3.6" strokeLinecap="round" fill="none" />
    <path d="M2 2L9 9M9 2L2 9" stroke="var(--chart-bg)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
  </svg>
);
/* an estimate's error bar in the key, drawn as the chart draws it */
const ExBarSwatch = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><rect x="4" y="1" width="4" height="14" rx="1" style={{ fill: "var(--ink-3)", opacity: 0.55 }} /></svg>
);
function ExplainedFlowChart({ jur, inv, house, stateKey, classKey, lc, menu, onSen }) {
  const narrow = useNarrow(window.MQ_PHONE);
  const FH = window.AUSPOL.flowHistory || {};
  /* the House: control's Upper bank (fed.sen, FH.fed.sen.states): the
     Senate's above-the-line flows, counted from the AEC's ballot-level
     formal-preferences files for the four post-GVT elections. onSen picks
     the SAME ballots' Labor-v-One-Nation cut instead (fed.senOn): the
     cohort trio becomes Coalition/Greens/Others, and a state with no
     One Nation Senate tickets anywhere in the four holds only nulls
     (the ACT - the ON tab's menu leaves it out; the NT opens in 2025).
     A fed:<key> pick reads the bank's own per-state cut; classifications
     stay a House feature, so a classKey picks nothing here. Its one state
     sibling is nsw.sen (lc): the NSW Legislative Council's counts, the
     only state upper house with a published ballot record - Coalition
     pairing only, so onSen never reads it */
  const SEN = house === "sen" ? (((FH.fed || {})[onSen ? "senOn" : "sen"]) || null) : null;
  const LC = house === "sen" && lc && !onSen ? (((FH.nsw || {}).sen) || null) : null;
  /* stateKey picks a per-state cut of the FEDERAL counts (AEC per-state TPP
     tables, 2004–2025); classKey its per-seat-type cut (the AEC's per-
     division TCP tables, grouped by its own per-election classifications,
     1996–2025 — 1996 is the per-division table's own floor, and the
     classification store's 1996/1998 blocks now reach it). Both are
     counts, so neither draws error bars */
  const S = LC
    || (SEN && stateKey && ((SEN.states || {})[stateKey]))
    || SEN
    || (jur === "fed" && stateKey && ((FH.fed.states || {})[stateKey]))
    || (jur === "fed" && classKey && ((FH.fed.classes || {})[classKey]))
    || FH[jur] || FH.fed;
  if (!S) return null;
  const YEARS = S.years;
  const est = !!S.estimated;
  /* the Share flip's inverse view draws 100 - x; the ± error bars are
     symmetric, so they ride the same transform */
  const T = (v) => (inv ? 100 - v : v);
  /* a counted state (NSW, from its ballot-level data) draws no bar, but NSW
     voters may stop numbering, so each point says what share exhausted */
  const cnt = !!S.counted;
  /* the Senate bank (national `senate` or a state's `senState`, plus the
     `senateOn`/`senStateOn` Labor-v-One-Nation cut) and its NSW
     Legislative Council sibling (`lc`): every ATL ballot is live at the
     count's end, so "exhausted" never applies - the tooltip instead gives
     the share of the group's ATL papers that named NEITHER of the pair
     (the nei arrays gen-data carries beside each line) */
  const sen = !!(S.senate || S.senState || S.lc || S.senateOn || S.senStateOn);
  const lcBank = !!S.lc;
  const parties = (onSen ? FLOW_ON_PARTIES : FLOW_PARTIES).filter((p) => (S[p.id] || []).some((v) => v != null));
  /* bars wherever a point carries an error: every state estimate, and the
     federal series' 1984-93 estimates ahead of its 1996-2025 counts (user
     2026-10-21) - the AEC counted no flow by party before 1996 */
  const hasErr = parties.some((p) => (S[p.id + "Err"] || []).some((e) => e != null));
  const fedEst = !est && S.estYears && S.estYears.length ? S.estYears : null;
  const series = [];
  parties.forEach((p) => {
    const v = S[p.id] || [];
    const err = S[p.id + "Err"] || [];
    const exh = S[p.id + "Exh"] || [];
    const runs = [];
    let cur = [];
    v.forEach((val, i) => {
      /* a null is a gap, not a zero: One Nation barely contested (or the
         party went unmeasured that year), and drawing a line across the hole
         would invent flows for parliaments nobody counted. Split into runs. */
      if (val == null) { if (cur.length) runs.push(cur); cur = []; }
      else {
        // an estimate's 90% miss, then (optional preferential years) the
        // share of the pile that reached neither Labor nor the Coalition -
        // "about" on an estimate: it missed NSW's counted shares by up to 3
        const nei = S[p.id + "Nei"] || [];
        const note = [err[i] != null ? (est ? "" : "estimated, ") + "±" + err[i].toFixed(1) : null,
          sen && nei[i] != null ? (onSen ? "named neither: " : "named neither major: ") + nei[i].toFixed(1) + "%" : null,
          !sen && exh[i] != null ? (est ? "about " : "") + exh[i].toFixed(0) + "% exhausted" : null].filter(Boolean).join(", ");
        cur.push({ x: YEARS[i], y: T(val), ...(note ? { note } : null) });
      }
    });
    if (cur.length) runs.push(cur);
    runs.forEach((points, i) => {
      const tail = i === runs.length - 1;
      series.push({
        id: p.id + i, label: p.name, color: p.color, points,
        /* a run of one election (a state One Nation sat out either side
           of) is no line at all, so it keeps its dot */
        smooth: false, rdWidth: 2.5, endCap: tail || points.length === 1,
        endLabel: tail && !narrow ? p.name : null,
      });
    });
  });
  /* a series of one election would give TrendChart a zero-width domain –
     0/0 in its x scale, NaN in every coordinate – so pad it a year either
     side and let the lone readings draw as their end dots */
  const pad1 = YEARS.length > 1 ? 0 : 1;
  /* each estimate's 90% error as a bar at its election: a narrow area,
     since areas stay out of the tooltip and the hover markers (a two-point
     vertical series would grow a marker at its foot), its half-width a
     fixed share of the x span so it draws ~8px wide on a 24-year axis and a
     one-election one alike; the domain widens by that half-width so the
     first and last elections' bars draw whole */
  const half = hasErr ? (YEARS[YEARS.length - 1] - YEARS[0] + 2 * pad1) * 0.008 : 0;
  const x0 = YEARS[0] - pad1 - half, x1 = YEARS[YEARS.length - 1] + pad1 + half;
  const areas = [];
  if (hasErr) {
    parties.forEach((p) => {
      const err = S[p.id + "Err"] || [];
      (S[p.id] || []).forEach((v, i) => {
        if (v == null || err[i] == null) return;
        const y = T(v);
        const y0 = Math.max(0, y - err[i]), y1 = Math.min(100, y + err[i]);
        areas.push({ id: p.id + "-err" + i, color: p.color, opacity: 0.55, edge: false,
          points: [{ x: YEARS[i] - half, y0, y1 }, { x: YEARS[i] + half, y0, y1 }] });
      });
    });
  }
  const span = YEARS.length > 1 ? YEARS[0] + "–" + YEARS[YEARS.length - 1] : String(YEARS[0]);
  const side = inv ? (onSen ? "One Nation" : "the Coalition") : "Labor",
        other = inv ? "Labor" : (onSen ? "One Nation" : "the Coalition");
  const scope = rdCap(S.elections || S.label + " elections") + ", " + span + (est ? ", estimated" : "");
  /* the federal line and the state lines measure different seats (user
     2026-10-21 review): since 2004 the AEC's two-party cut sorts every seat's
     ballots, the states only the seats Labor and the Coalition finished
     first and second - in 2025 the gap for everyone else was ~6 points */
  const E25 = !onSen && ((window.AUSPOL.flowForced || {}).elec2025r || {}).all;
  const cutGap = E25 && E25.nat && E25.oth != null ? [E25.nat.oth.toFixed(1), E25.oth.toFixed(1)] : null;
  const stateCut = cutGap ? " The federal line counts every seat, so don’t compare the two directly: in 2025 everyone else sent Labor " + cutGap[0] + "% across all seats but " + cutGap[1] + "% in these seats." : "";
  const noBars = " Counts carry no estimation error, so they have no bars.";
  const oneOnly = lcBank ? (S.oneOnly || []).map((v, i) => Math.round(v) + "% in " + YEARS[i]).join(", ") : null;
  /* the Labor-v-One-Nation Senate cut's caption mirrors the Coalition
     pairing's (user 2026-10-22): counted ballots, pair ranked (or one
     ranked), "named neither" never "exhausted". Its movement clause quotes
     the national Coalition cohort; a state's own caption skips it */
  const cap = lcBank
    ? "Counted from the NSW Electoral Commission’s ballot-level preference files: every formal above-the-line vote at the " + span + " Legislative Council elections (below-the-line papers excluded, as on the Senate view). Most NSW upper-house voters number just one box above the line — " + oneOnly + " — so most ballots name neither major; each share is of the ballots that went on to rank Labor or the Coalition, and each point’s tooltip gives how many named neither — “named neither”, never “exhausted”: a paper that names no major mostly still counts for a minor group. One Nation’s line opens in 2019 — it ran no upper-house group in 2015, and a zero-ballot group draws as a gap, never a zero. NSW is the only state upper house with a published ballot record, so no other state can ride this view."
    : onSen
    ? "Counted from the AEC’s ballot-level formal-preferences files: every above-the-line Senate ballot, " + span + " (below-the-line papers excluded; the group-voting-ticket era kept no per-ballot record before 2016). Each share is of the group’s ballots that ranked Labor or One Nation (or both) — a ballot naming only one of the pair still counts its way — and each point’s tooltip gives the share naming neither — “named neither”, never “exhausted”: no ballot exhausts in a Senate count."
      + (!stateKey ? " Coalition voters turned: 61.2% named Labor ahead of One Nation in 2016, but only 25.3% by 2025 — Greens voters named Labor ahead of One Nation throughout (95.6% by 2025). The ACT sits out the elections menu: One Nation ran no ACT Senate tickets in any of the four — a pair nobody could rank is a gap, never a zero." : "")
      + (S.senStateOn ? " A gap in the lines is an election One Nation had no " + S.short + " Senate tickets — a pair nobody could rank that year." + (stateKey === "nt" ? " It ran none until 2025, so " + S.short + "’s pair opens in 2025." : "") : "")
    : sen
    ? "Counted from the AEC’s ballot-level formal-preferences files: every above-the-line Senate ballot, " + span + " (below-the-line papers excluded; the group-voting-ticket era kept no per-ballot record before 2016). Each share is of the group’s ballots naming a major party, and each point’s tooltip gives the share naming neither major — “named neither”, not exhausted: no ballot exhausts in a Senate count. Senate flows run well above the House’s (the Greens’ ballots named Labor 86.9% in 2016 against 81.9% of their House ballots), and One Nation’s neither-share fell from 46.6% to 24.4% — mostly where it stood tickets, not its voters switching."
      + (S.senState
        ? " A gap in One Nation’s line is an election it had no " + S.short + " Senate tickets — a zero-ballot group draws as a gap, never a zero."
          + (stateKey === "act" || stateKey === "nt" ? " Two senators from a small field leave the territories’ “neither” shares tiny, so " + S.short + "’s lines sit nearer a true two-way split than the states’." : "")
        : "")
    : est
    ? "Estimated from " + S.srcAs + " (" + S.asOf + "), in the seats where Labor and the Coalition finished first and second. Each bar shows how far the method missed, nine times in ten, when it was tried on federal elections; One Nation’s run widest, and its line shows only where at least " + (FH.fed && FH.fed.backtest && FH.fed.backtest.onpMinBallots ? (Math.round(FH.fed.backtest.onpMinBallots / 1000) * 1000).toLocaleString("en-AU") : "39,000") + " of its ballots stand behind the estimate, the smallest base the method was tested on." + (S.opv && S.opv.length
      ? " Voters could stop numbering " + (S.opv.length > 1 ? "from " + S.opv[0] + " to " + S.opv[S.opv.length - 1] : "in " + S.opv[0]) + ", so those years’ shares are of the ballots that reached Labor or the Coalition; the tooltip gives how many reached neither."
      : "") + stateCut
    : cnt
      ? "Counted from " + S.srcAs + " (" + S.asOf + "), in the seats where Labor and the Coalition finished first and second. NSW voters may stop numbering, so each share is of the ballots that reached Labor or the Coalition; the tooltip gives how many reached neither." + noBars + stateCut
      : S.fedState
        ? "Counted by the AEC: its two-party-preferred flow by state by party, 2004–2025 — the per-state cut of the national series (the pre-2004 flows were counted nationally only). A gap in One Nation’s line is a year its " + S.short + " count never reached the AEC’s table." + noBars
          + " The state elections’ lines count only seats where Labor and the Coalition finished first and second, so the two can differ" + (cutGap ? ": nationally in 2025, everyone else’s flow was " + cutGap[0] + " on this cut and " + cutGap[1] + " on that one." : ".")
        : S.fedClass
          ? "Counted by the AEC: its two-candidate-preferred flow of preferences by division, 1996–2025, each seat filed to " + S.short + " by the AEC’s own classification of that division at that election (a seat the AEC recategorised moved classes, so a kink never comes from sliding boundaries; 1996’s and 1998’s ratings were transcribed from the AEC’s whole-chamber classification pages of those years, 2001’s from its division profiles as displayed that year — three unrated seats filled from its research report — and 2004’s from its live profile pages). Only seats where Labor and the Coalition finished first and second count — a seat a crossbencher reached the final two in can hold these ballots on a pile no AEC table splits. The line starts at 1996, as far back as the per-division flow table itself reaches. A gap in One Nation’s line is an election its " + S.short + " ballots never reached the AEC’s table — 1996’s is the party’s own absence ahead of its first federal campaign; a thin base can still swing a point — inner-metropolitan seats counted only 1,508 One Nation ballots in 2013 — so read the thin early-2010s years as small samples, not shares."
            + noBars
          : (fedEst ? "Estimated for " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " from each seat’s distribution of preferences, by the method behind the state lines, in the seats where Labor and the Coalition finished first and second; the bars are its 90% error, from trials on the federal elections since 1996."
            + (((FH.fed.backtest || {}).grnLean || {}).worst || []).filter((w) => w.year < 2004).map((w, i, a) => (i ? (i === a.length - 1 ? " and " : ", ") : " It ran high on the Greens in the oldest trials, ") + w.year + " by " + w.miss.toFixed(1) + (i === a.length - 1 ? " points, so the early Greens points more likely sit low in their bars, and part of the fall to 1996 is the method’s." : "")).join("")
            + " The AEC counted no flows by party before 1996. " : "")
          + "Counted by the AEC: its preference-distribution tables by party, 1996–2025 (classic cut to 2001, two-party cut since)." + noBars
          + (cutGap ? " The state lines count only seats where Labor and the Coalition finished first and second; on that cut, everyone else’s 2025 flow was " + cutGap[1] + ", not " + cutGap[0] + "." : "");
  const lines = parties.map((p) => ({ kind: "line", color: p.color, label: p.name }));
  return (
    <>
      <div className="rd-chead ex-fl-head">
        <span className="rd-chead-t">{"Preferences to " + side + " over " + other + ", %"}
          <span className="rd-chead-meta">{scope}</span></span>
        {menu}
      </div>
      {narrow && <RdKey items={lines} className="rd-tpp-legend" />}
      <TrendChart key={"ex-fl-" + (house || "rep") + jur + (stateKey || "") + (classKey || "") + (lcBank ? "lc" : "") + (onSen ? "on" : "")} {...exFrame(narrow)}
        xDomain={[x0, x1]}
        xTicks={YEARS.map((x) => ({ x, label: String(x) }))}
        unit="%" fmt={(v) => v.toFixed(1)}
        series={series} areas={areas} spine={YEARS.map((x) => ({ x }))}
        tooltipTitle={(i) => YEARS[i] + " · " + (S.short || S.label)}
        ariaLabel={"Share of preferences flowing to " + side + ", by party, " + S.label + (lcBank ? ", above-the-line NSW Legislative Council ballots" : sen ? ", above-the-line Senate ballots" : "") + (est ? ", estimated" : "") + ", " + span}
        copy={{ title: "Share of each group’s preferences reaching " + side + " over " + other,
                sub: rdCap(S.elections || S.label + " elections") + ". " + (lcBank ? "Counted from the NSW Electoral Commission’s ballot-level preference files; above-the-line ballots only, and each share is of papers naming a major party."
                  : onSen ? "Counted from the AEC’s ballot-level formal-preferences files; above-the-line ballots only, and each share is of papers ranking Labor or One Nation (or both)."
                  : sen ? "Counted from the AEC’s ballot-level formal-preferences files; above-the-line ballots only, and each share is of papers naming a major party."
                  : est ? "Estimated from distributions of preferences, in the seats where Labor and the Coalition finished first and second."
                  : fedEst ? "Estimated " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " from each seat’s distribution of preferences; counted by the AEC from 1996."
                  : "Counted, election by election, so no error bars."),
                caption: lcBank ? "Above-the-line NSW upper-house ballots, 2015–2023; on the page, each point’s tooltip gives the share naming neither major." : onSen ? "Above-the-line Senate ballots, 2016 on; on the page, each point’s tooltip gives the share naming neither." : sen ? "Above-the-line Senate ballots, 2016 on; on the page, each point’s tooltip gives the share naming neither major." : (hasErr ? (fedEst ? "Bars: the " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " estimates’ 90% error; 1996 on, the AEC’s counts." : "Each bar shows how far the estimate missed, nine times in ten, on federal elections.") : undefined),
                legend: narrow ? lines : [] }}
      />
      <RdKey className="rd-ckey" items={est ? [] : [{ kind: "line", color: "var(--ink-3)", label: fedEst ? "Counted flow, 1996 on" : "Counted flow at each election" }]}>
        {hasErr && <span className="rd-key-item"><ExBarSwatch />{fedEst ? "Estimated, " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + ", with its 90% error" : "The estimate’s 90% error"}</span>}
      </RdKey>
      <RdFoot how={{ term: "flow-history", from: "Preference flows explained" }}>{cap}</RdFoot>
    </>
  );
}

/* the explainer's Labor-v-One-Nation view (user 2026-10-20: "no state-by-
   state, just the elections and by-elections that have shown results", as
   the "one nation v labor" chart's crosses do on /flows/). No elections
   menu — no count or close estimate exists by jurisdiction for this pair —
   one cross per voter group per contest, from the same flowForced.bys
   crosses the /flows/ One Nation chart plots. Hunter is the AEC's counted
   flow-by-division; South Australia is this site's estimate, with its
   tested 90% misses as bars; Secret Harbour is a count of part of the vote
   (the early voting centre), drawn hollow. No line joins the contests
   (user 2026-10-21): their groups differ - Hunter's Coalition voters are
   Nationals, the others' Liberals; Hunter's Others five minor parties - so
   a line would draw a trend that is only a change of definition. */
const ON_COHORTS = [
  { id: "coal", name: "Coalition", color: "var(--lnp)" },
  { id: "grn",  name: "Greens",    color: "var(--grn)" },
  { id: "oth",  name: "Others",    color: "var(--oth)" },
];
function ExplainedOnChart({ inv, menu }) {
  const narrow = useNarrow(window.MQ_PHONE);
  const BYS = ((window.AUSPOL.flowForced || {}).bys || []).slice().sort((a, b) => a.xm - b.xm);
  if (!BYS.length) return null;
  /* the Share flip's inverse view draws 100 - x, as in ExplainedFlowChart */
  const T = (v) => (inv ? 100 - v : v);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parties = ON_COHORTS.filter((p) => BYS.some((b) => b[p.id] != null));
  const series = [];
  /* every reading draws as a cross - the /flows/ One Nation ledger's mark
     (user 2026-10-20), one per cohort per contest it was counted in; a
     count of part of the vote draws hollow */
  const marks = [];
  const areas = [];
  const x0 = BYS[0].xm - 0.9, x1 = BYS[BYS.length - 1].xm + 0.9;
  /* an estimate's 90% miss as a bar, the Labor v Coalition chart's narrow
     area (out of the tooltip and the hover markers) */
  const half = (x1 - x0) * 0.005;
  parties.forEach((p) => {
    const last = BYS.reduce((k, b, i) => (b[p.id] != null ? i : k), -1);
    BYS.forEach((b, i) => {
      const v = b[p.id];
      if (v == null) return;   /* no Others count ran at Secret Harbour */
      /* err: a tested 90% miss (±); range: [low, high] where the method's
         own choices move it (Secret Harbour), not a tested error */
      const e = (b.err || {})[p.id], r = (b.range || {})[p.id];
      const note = [(b.lbl || {})[p.id], e != null ? "±" + e.toFixed(1) : r ? "range " + r[0].toFixed(1) + "–" + r[1].toFixed(1) : null,
        b.kind === "part" ? "part of the vote" : null, (b.alt || {})[p.id]].filter(Boolean).join(", ");
      /* each contest its own one-point series: hover reads it, nothing
         joins it to the next contest */
      series.push({ id: p.id + i, label: p.name, color: p.color,
        points: [{ x: b.xm, y: T(v), ...(note ? { note } : null) }],
        smooth: false, rdWidth: 2.5, endCap: false,
        endLabel: i === last && !narrow ? p.name : null });
      /* an estimate's cross draws smaller, so its bar (±2 on a 0-100 axis is
         about a full-size cross's height) shows above and below it */
      marks.push({ x: b.xm, y: T(v), color: p.color, cross: true, ...(b.kind === "part" ? { hollow: true } : null),
        ...(e != null || r ? { r: 3 } : null) });
      if (e != null || r) {
        const lo = r ? T(r[0]) : T(v) - e, hi = r ? T(r[1]) : T(v) + e;
        const y0 = Math.max(0, Math.min(lo, hi)), y1 = Math.min(100, Math.max(lo, hi));
        areas.push({ id: p.id + "-err" + i, color: p.color, opacity: 0.55, edge: false,
          points: [{ x: b.xm - half, y0, y1 }, { x: b.xm + half, y0, y1 }] });
      }
    });
  });
  const ticks = BYS.map((b) => ({ x: b.xm, label: MON[+b.date.slice(5, 7) - 1] + " " + b.date.slice(0, 4) }));
  /* a capitalised lead word ("The AEC’s…", "This site’s…") is the only one a fallible
     lowercase rewrite would break, so guard it */
  const low = (s) => s.replace(/^(The|This) /, (m) => m.toLowerCase());
  const cap = BYS.map((b) => b.label + " — " + low(b.sub)).join("; ");
  const side = inv ? "One Nation" : "Labor", other = inv ? "Labor" : "One Nation";
  const scope = "Each contest with a count or estimate, " + BYS[0].date.slice(0, 4) + "–" + BYS[BYS.length - 1].date.slice(0, 4);
  const hasEst = BYS.some((b) => b.err || b.range), hasPart = BYS.some((b) => b.kind === "part");
  const hasRange = BYS.some((b) => b.range);
  const lines = parties.map((p) => ({ kind: "line", color: p.color, label: p.name }));
  return (
    <>
      <div className="rd-chead ex-fl-head">
        <span className="rd-chead-t">{"Preferences to " + side + " over " + other + ", %"}
          <span className="rd-chead-meta">{scope}</span></span>
        {menu}
      </div>
      {narrow && <RdKey items={lines} className="rd-tpp-legend" />}
      <TrendChart key="ex-fl-on" {...exFrame(narrow)}
        xDomain={[x0, x1]}
        xTicks={ticks}
        unit="%" fmt={(v) => v.toFixed(1)}
        series={series} marks={marks} areas={areas} spine={BYS.map((b) => ({ x: b.xm }))}
        /* the contest's name alone: its source sentence ran the readout to
           the full width of a phone (user 2026-10-21); the caption below
           carries every contest's source */
        tooltipTitle={(i) => BYS[i].label}
        ariaLabel={"Share of preferences flowing to " + side + " in Labor-v-One Nation contests, by voter group, " + BYS[0].label + " to " + BYS[BYS.length - 1].label}
        copy={{ title: "Share of each group’s preferences reaching " + side + " over " + other,
                sub: "Each contest with a count or estimate. " + rdCap(cap) + ".",
                caption: "Each cross is one contest’s count or estimate" + (hasEst ? "; a bar, the estimate’s 90% error" + (hasRange ? " or range" : "") : "")
                  + (hasPart ? "; hollow, a count of part of the vote" : "") + ". The groups differ by contest, so no line joins them.",
                legend: narrow ? lines : [] }}
      />
      <RdKey className="rd-ckey" items={[]}>
        <span className="rd-key-item"><span className="rd-fx-keyx" aria-hidden="true"></span>Count or estimate</span>
        {hasEst && <span className="rd-key-item"><ExBarSwatch />{hasRange ? "An estimate’s 90% error or range" : "The estimate’s 90% error"}</span>}
        {hasPart && <span className="rd-key-item"><ExHollowX />Count of part of the vote</span>}
      </RdKey>
      <RdFoot how={{ term: "flow-history", from: "Preference flows explained" }}>{"One reading per contest: " + cap
        + ". The groups differ by contest, so no line joins them: Hunter’s Coalition voters are Nationals and its Others five minor parties; elsewhere the Coalition voters are Liberals, and South Australia’s and Secret Harbour’s Others are every other voter."
        + (hasRange ? " Secret Harbour’s bars are ranges: how far its estimate moves with the way the rest of the seat’s known lean is divided between the parties, not a tested error." : "")}</RdFoot>
    </>
  );
}

const EX_PAIRS = [{ id: "co", label: "Labor v Coalition", short: "v Coalition" }, { id: "on", label: "Labor v One Nation", short: "v One Nation" }];
function RdExplained() {
  const ref = useRef(null);
  const secRef = useRef(null);
  const narrow = useNarrow(window.MQ_PHONE);
  const FH = window.AUSPOL.flowHistory || {};
  const KEYS = Object.keys(FH);
  /* one elections menu (user 2026-10-21, replacing the jurisdiction chips
     and the Federal chip's state sub-row): "fed" is the national series,
     "fed:<state>" a state's cut of the federal counts (fed.states, the
     AEC's), "fedcl:<class>" its cut by seat type (fed.classes, user
     2026-10-22), a bare key a state's own elections, "nswlc" the NSW
     Legislative Council under Upper (the only state upper house with a
     published ballot record - it never appears under Lower). The pick
     persists across the contest tabs - the menu just hides on Labor v
     One Nation's Lower view (its Upper view carries the ON Senate bank's
     federal menu). */
  const FED_STATES = (FH.fed && FH.fed.states) || {};
  const FED_CLASSES = (FH.fed && FH.fed.classes) || {};
  const [view, setView] = useState("fed");
  const SEN_BANK = (FH.fed && FH.fed.sen) || null;
  const LC_BANK = (FH.nsw && FH.nsw.sen) || null;
  /* the SAME Senate ballots' Labor-v-One-Nation cut (user 2026-10-22): the
     ON tab's Upper view, so flipping houses no longer snaps the contest
     back. Its states are the federal bank's, minus any state where One
     Nation ran no Senate ticket in all four years (the ACT - all-null
     trios stay out of the menu) */
  const SEN_ON_BANK = (FH.fed && FH.fed.senOn) || null;
  const ON_SEN_STATES = (SEN_ON_BANK && SEN_ON_BANK.states) || {};
  const hasOnCells = (k) => { const s = ON_SEN_STATES[k]; return !!s && ["coal", "grn", "oth"].some((c) => (s[c] || []).some((v) => v != null)); };
  const fedView = view === "fed" || view.startsWith("fed:") || view.startsWith("fedcl:");
  const lcView = view === "nswlc" && !!LC_BANK;
  const jur = fedView ? "fed" : lcView ? "nsw" : (FH[view] ? view : "fed");
  const stateKey = view.startsWith("fed:") && FED_STATES[view.slice(4)] ? view.slice(4) : null;
  const classKey = view.startsWith("fedcl:") && FED_CLASSES[view.slice(6)] ? view.slice(6) : null;
  /* the House: control (user 2026-10-22): "rep" reads the House banks,
     "sen" FH.fed.sen - the Senate's above-the-line flows, counted from the
     AEC's ballot-level files. The federal menu section stays live under
     Upper (both banks carry the eight states, so a fed:<key> pick survives
     the flip); seat classifications and every state election except NSW's
     upper house are House features, so flipping to Upper snaps those
     picks back to "fed" - excepting the NSW state pick, which becomes
     its Legislative Council count (FH.nsw.sen, banked beside the Senate
     series, user 2026-10-22). The One Nation contest follows the flip
     too: its Upper view reads FH.fed.senOn, the same ballots' other cut.
     The toggle renders only where the build ships the bank - the Vic
     page never carries either */
  const SEN_STATES = (SEN_BANK && SEN_BANK.states) || {};
  const [house, setHouse] = useState("rep");
  const onSenMode = house === "sen" && !!SEN_ON_BANK;   /* pair-independent: drives the ON tab's menu */
  const [inv, setInv] = useState(false);
  /* the contest tabs flip Labor v Coalition (the flowHistory election
     histories) to Labor v One Nation. The One Nation card differs by
     house: Lower reads the measured flowForced.bys contests (the crosses
     chart, no elections menu - no state-by-state counts exist); Upper
     reads the SAME Senate bank's Labor-v-One-Nation cut (user 2026-10-22,
     the elections menu narrowed to the states One Nation filed Senate
     tickets in) */
  const [pair, setPair] = useState("co");
  const rival = pair === "on" ? "One Nation" : "Coalition";
  /* flipping to Upper snaps the House-only picks away (a class view, a
     state-election view other than NSW's), except a NSW state pick, which
     becomes its upper-house count; an ON-tab pick of a state with no One
     Nation Senate tickets (no counted pair) drops to the national series;
     flipping back to Lower returns a Legislative Council pick to the NSW
     state elections - every other Senate pick is a House pick too */
  const flipHouse = () => {
    const next = house === "sen" ? "rep" : "sen";
    setHouse(next);
    if (next === "sen") {
      if (view === "nsw" && LC_BANK) setView("nswlc");
      else if (classKey || !fedView || (pair === "on" && stateKey && !hasOnCells(stateKey))) setView("fed");
    } else if (lcView) setView("nsw");
  };
  React.useLayoutEffect(() => {
    /* the static-summary twin of this article carries the same #ex-fig-flow
       slot and sits earlier in the document, hidden (opacity 0) once the app
       boots - a document-wide getElementById mounts the figure into that
       invisible copy and leaves this view's own slot empty and collapsed. */
    const sec = secRef.current;
    const slot = sec && sec.querySelector(".ex-body .ex-slot");
    const node = ref.current;
    if (!slot || !node) return undefined;
    slot.appendChild(node);
    return () => { if (node.parentNode === slot) slot.removeChild(node); };
  }, []);
  /* ^ one-shot on purpose: a re-mount-free append/detach cycle on every
     render used to rob the keyboard of its focus (the detach blurs the
     focused tab while an arrow-walked rdTabsKey is mid-stride) */
  /* the key/swipe inputs (user 2026-10-21): hovering the card hands <-/->
     to the contest tabs and up/down to the elections menu (the pointer-
     claims-keys contract - the claim never survives the pointer leaving
     the card, and a focused control's own keys always come first), Space
     flips Share: Labor/rival while the figure is on screen (the spacebar
     viewport-claim), and a sideways swipe ON THE CHART flips the contest
     (data-rd-swipe-exact, the hero 2PP card's shape - the row's plain
     `swipe` prop is deliberately NOT used: the explainer's section is the
     whole page, and its reach would claim the article's sideways swipes
     off the page turn). Every live ref below is rebound each render, so
     the once-registered listeners never see a stale closure. */
  const pairStep = React.useRef(null);
  pairStep.current = (dir) => {
    const i = EX_PAIRS.findIndex((x) => x.id === pair);
    if (i < 0) return false;
    setPair(EX_PAIRS[(i + dir + EX_PAIRS.length) % EX_PAIRS.length].id);
    return true;
  };
  const viewStep = React.useRef(null);
  viewStep.current = (dir) => {
    /* the elections menu walks only where one renders - Labor v One
       Nation's Lower view has none, and the keys keep their scroll day
       job there. VIEW_OPTS/menuShow are declared beside the menu below;
       this closure runs on a keypress, by which time both are
       initialised */
    const opts = VIEW_OPTS;
    if (!menuShow || opts.length < 2) return false;
    const i = opts.indexOf(view);
    if (i < 0) return false;
    setView(opts[(i + dir + opts.length) % opts.length]);
    return true;
  };
  const cardEl = React.useRef(null);
  const cardMark = React.useCallback((el) => { cardEl.current = el; if (el) el.__rdSwipe = (dir) => pairStep.current(dir); }, []);
  const exHover = React.useRef(false);
  React.useEffect(() => {
    const card = cardEl.current;
    if (!card) return undefined;
    const enter = () => { exHover.current = true; };
    const leave = () => { exHover.current = false; };
    exHover.current = card.matches(":hover");
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!exHover.current) return;
      const k = e.key;
      if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "ArrowDown" && k !== "ArrowUp") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const went = (k === "ArrowRight" || k === "ArrowLeft")
        ? pairStep.current(k === "ArrowRight" ? 1 : -1)
        : viewStep.current(k === "ArrowDown" ? 1 : -1);
      if (went) e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const spaceShare = React.useRef(null);
  spaceShare.current = () => setInv((v) => !v);
  React.useEffect(() => {
    /* the claim is scoped to the CARD (the figure, wherever the article
       slot has mounted it), as the hero 2PP body's is - the explainer's
       section is the whole page, and a section-wide claim would make Space
       flip a chart the reader can't see while they read the article */
    const card = cardEl.current;
    if (!card) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(card);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      /* the contest row's SELECTED tab owns Space the flip's way: a click
         leaves the focus on it, where the key would only dead-fire the
         same contest pick, so the claim flips the Share side with the
         tab's pick and focus staying put (the /flows/ ledger's contest
         admission). An unpressed tab keeps the key's day job (its native
         pick), as does the elections menu (its native open) */
      const onPairTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true"
        && a.matches("#flows-explained .ex-fl-tabs .rd-tab");
      if (!onPairTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceShare.current) return;
      e.preventDefault();
      if (!e.repeat) spaceShare.current();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
  const stateKeys = Object.keys(FED_STATES);
  const classKeys = Object.keys(FED_CLASSES);
  const senStateKeys = Object.keys(SEN_STATES);
  const senOnStateKeys = Object.keys(ON_SEN_STATES).filter(hasOnCells);
  /* the ON tab's OWN Upper view (senOnView): the federal menu rides the
     senOn bank's states (every state One Nation filed a Senate ticket
     in), and NSW's Coalition-only Legislative Council sits it out */
  const senOnView = onSenMode && pair === "on" && !lcView;
  const onPairPick = (p) => {
    setPair(p);
    /* a pick to Labor v One Nation leaves the picks that contest's bank
       never carries: the LC count, and a state One Nation ran no Senate
       tickets in */
    if (p === "on" && house === "sen" && (lcView || (stateKey && !hasOnCells(stateKey)))) setView("fed");
  };
  /* the menu's option values in the <select>'s DOM order - the up/down
     walk below steps this exact list (the hover claim proxies the control's
     own arrows, which for a native select is line-by-line). Under House:
     Upper the federal entries ride SEN_STATES (same fed:<key> values,
     re-read from the Senate bank) and the House-only sections leave, bar
     the one state upper house: NSW's Legislative Council rides alone in
     the state-elections section (LC_BANK). The One Nation tab's Upper view
     swaps the federal bank for senOn's and drops the Council */
  const VIEW_OPTS = house === "sen"
    ? (senOnView
      ? (SEN_ON_BANK ? ["fed", ...senOnStateKeys.map((k) => "fed:" + k)] : [])
      : [...(SEN_BANK ? ["fed", ...senStateKeys.map((k) => "fed:" + k)] : []), ...(LC_BANK ? ["nswlc"] : [])])
    : ((KEYS.length > 1 || stateKeys.length > 0 || classKeys.length > 0)
      ? ["fed", ...stateKeys.map((k) => "fed:" + k), ...classKeys.map((k) => "fedcl:" + k),
         ...(KEYS.length > 1 ? KEYS.filter((k) => k !== "fed") : [])]
      : []);
  /* Labor v One Nation's Lower view carries no menu (its counts are the
     measured contests alone) - every other view's menu shows the banks */
  const menuShow = pair === "on" && house !== "sen" ? false
    : house === "sen" ? VIEW_OPTS.length > (senOnView ? 0 : 1) : VIEW_OPTS.length > 0;
  const menuKeys = house === "sen" ? (senOnView ? senOnStateKeys : senStateKeys) : stateKeys;
  const menuBank = house === "sen" ? (senOnView ? ON_SEN_STATES : SEN_STATES) : FED_STATES;
  const menu = menuShow ? (
    <select className="rd-pv-sel ex-fl-sel" aria-label="Elections"
            value={lcView && !senOnView ? "nswlc" : stateKey ? "fed:" + stateKey : classKey && house !== "sen" ? "fedcl:" + classKey : jur}
            onChange={(e) => setView(e.target.value)}>
      <optgroup label="Federal elections">
        <option value="fed">Federal, national</option>
        {menuKeys.map((k) => <option key={k} value={"fed:" + k}>{"Federal, " + (menuBank[k].short || menuBank[k].label)}</option>)}
        {house !== "sen" && classKeys.map((k) => <option key={"fedcl:" + k} value={"fedcl:" + k}>{"Federal, " + (FED_CLASSES[k].short || FED_CLASSES[k].label)}</option>)}
      </optgroup>
      {house !== "sen" && KEYS.length > 1 && (
        <optgroup label="State elections">
          {KEYS.filter((k) => k !== "fed").map((k) => <option key={k} value={k}>{(FH[k].short || FH[k].label) + " state elections"}</option>)}
        </optgroup>
      )}
      {house === "sen" && !senOnView && LC_BANK && (
        <optgroup label="State elections">
          <option value="nswlc">{LC_BANK.label}</option>
        </optgroup>
      )}
    </select>
  ) : null;
  /* the Share flip, the Latest section's idiom - the label names the
     dimension, the button the ACTIVE side, the title where a press goes.
     It rides the tab row as All polls' controls do; a phone's row has no
     room beside the tabs, so it joins the chart's head there */
  const share = (
    <span className="rd-pl-ctl ex-share">
      <span className="rd-pl-ctl-l">Share:</span>
      <button type="button" className="rd-pl-flip" aria-pressed={inv}
              title={inv ? ("Switch to shares preferencing Labor over " + (pair === "on" ? "One Nation" : "the Coalition")) : ("Switch to shares preferencing " + rival + " over Labor")}
              onClick={() => setInv(!inv)}>
        <span className="rd-pl-flip-t">{(inv ? rival : "Labor") + "’s"}</span> <span aria-hidden="true">⇄</span>
      </button>
    </span>
  );
  /* the House: flip (user 2026-10-22), the same idiom beside Share: - the
     button shows the ACTIVE chamber ("Lower" reads the House banks' seat
     counts, "Upper" the Senate's above-the-line ballots). It rides the
     tab row on both contests - each contest ships its own Upper bank */
  const houseCtl = SEN_BANK ? (
    <span className="rd-pl-ctl ex-house">
      <span className="rd-pl-ctl-l">House:</span>
      <button type="button" className="rd-pl-flip" aria-pressed={house === "sen"}
              title={house === "sen" ? "Switch to House of Representatives flows" : "Switch to Senate flows (above-the-line ballots)"}
              onClick={flipHouse}>
        <span className="rd-pl-flip-t">{house === "sen" ? "Upper" : "Lower"}</span> <span aria-hidden="true">⇄</span>
      </button>
    </span>
  ) : null;
  /* the phone's head span: the menu, then House and Share in ONE nowrap
     group, so the pair share a line when the row wraps instead of
     splitting across two (user 2026-10-22) */
  const headCtls = narrow ? <span className="ex-fl-ctls">{menu}<span className="ex-fl-flips">{houseCtl}{share}</span></span> : menu;
  return (
    <section ref={secRef} className="rd-sec rd-explained" id="flows-explained" aria-labelledby="rd-ex-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-ex-t">Preference flows explained</h2>
        <span className="rd-meta">How preferences decide the two-party figure</span>
      </div>
      <RdHed head={window.AP.PAGE_HEAD["flows-explained"]}
        dek="The pollster can ask respondents which of the final two they would rank higher, or apply its own assumptions, and publish the result. Or the poll’s first preferences can be run through one fixed table of preference flows, the same for every pollster. That implied figure is the default here: it moves only when voters do, never with a pollster’s change of method, and at past elections it has had the better record. Below: how each works, why the implied figure leads, and where the table’s numbers come from." />
      <div className="ex-body" dangerouslySetInnerHTML={{ __html: window.EXPLAINED_ARTICLE || "" }} />
      <div ref={ref}>
        <div className="card rd-card ex-fl-card" ref={cardMark} data-rd-swipe-exact="">
          <RdTabs value={pair} onChange={onPairPick} ariaLabel="Contest" className="ex-fl-tabs"
                  options={EX_PAIRS.map((p) => ({ id: p.id, label: narrow ? p.short : p.label }))}>
            {narrow ? null : <>{houseCtl}{share}</>}
          </RdTabs>
          {senOnView ? <ExplainedFlowChart jur="fed" house="sen" stateKey={stateKey && hasOnCells(stateKey) ? stateKey : null} classKey={null} lc={false} inv={inv} menu={headCtls} onSen />
            : pair === "on" ? <ExplainedOnChart inv={inv} menu={headCtls} />
            : <ExplainedFlowChart jur={jur} house={house} stateKey={stateKey} classKey={house === "sen" ? null : classKey} lc={lcView} inv={inv} menu={headCtls} />}
        </div>
      </div>
    </section>
  );
}

/* The three sections render below the table but depend on none of its filter
   state (RdDisagree takes no props; RdHouseLean's and RdFlows' props are
   stable strings/callbacks - RdFlows reads the page's two-party contest).
   Memoised, a filter pick re-renders the table alone instead of re-running
   three chart sections on the same commit. */
const RdDisagreeM = React.memo(RdDisagree);
const RdHouseLeanM = React.memo(RdHouseLean);
const RdFlowsM = React.memo(RdFlows);
const RdExplainedM = React.memo(RdExplained);

Object.assign(window, { RdLedger, RdAllPolls, RdApDetail, RdApSheet, rdPollMargin, RdDisagree: RdDisagreeM, RdHouseLean: RdHouseLeanM, RdFlows: RdFlowsM, RdExplained: RdExplainedM });
