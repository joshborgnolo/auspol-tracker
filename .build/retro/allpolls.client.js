/* =============================== the retro All polls page ===============================
   The script of /allpolls/retro/, the All polls archive in the dress the
   Electoral map's retro view wears (.build/retro/chrome.css): the navbar in
   the era's words, the banner, the tab buttons, and the table as the old
   details list, its column heads raised buttons that sort it.

   One file, two readers. .build/retro/allpolls.mjs runs it in node (no
   document there, so only the renderers below load) to write the table into
   the page as it first opens, which a reader without JavaScript keeps; the
   browser runs it again to take the table over: the tabs, the pollster
   checklist, the pickers, the find box, the sort, a poll opened in its row,
   the CSV and the navbar's menus. The same functions draw both, so the page
   as built and the page after a click can't disagree.

   The seven tabs are the modern table's seven facets, each with its own row
   set and the scope the modern facet arms by default (rowSet): the vote tabs
   read every poll, Leadership the polls with a leadership figure, Direction
   and Issues add the waves that ask no voting question, Demographics the
   polls whose tables draw the split in view, and Confidence lists the
   economic gauges' releases instead of polls, one lane at a time. Every
   figure is the dataset's, handed over finished by the build, so a row here
   says what the modern row says. The state rides the hash (m= tab, c=
   contest, g= split, b= business gauges, h= pollsters, t= time, q= find,
   s= sort), so a link or a Favorite opens the same view. */
(function () {
"use strict";
const W = typeof window !== "undefined" ? window : globalThis;
const RA = (W.RT_AP = {});

/* ----------------------------------------------------------------- words and numbers */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// a published figure as the pollster printed it: 55, 54.5
const num = (v) => (v == null ? "—" : String(+(+v).toFixed(1)));
const f1 = (v) => (+v).toFixed(1);
// a signed figure with a true minus; a flat one prints bare (0.0), as the modern table does
const signed = (v, dp = 1) => (Math.abs(v) < (dp ? 0.05 : 0.5) ? (0).toFixed(dp) : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(dp));
// a change on the same pollster's previous poll, at its figures' printed precision (rdApChg): ▲ 2, ▼ 0.5, a flat 0
const chg = (d) => {
  if (d == null) return null;
  const dec = Number.isInteger(d) ? 0 : 1;
  if (Math.abs(d) < (dec ? 0.05 : 0.5)) return dec ? (0).toFixed(dec) : "0";
  return (d > 0 ? "▲ " : "▼ ") + (dec ? Math.abs(d).toFixed(dec) : String(Math.abs(Math.round(d))));
};
// a gap between two groups, whole points (the modern Demographics facet's gapTxt)
const gapTxt = (v) => (v == null ? "—" : Math.abs(v) < 0.5 ? "0" : (v > 0 ? "+" : "−") + Math.abs(Math.round(v)));
// a gauge's figure as printed, and its move (confFig, confChg)
const confFig = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
const confChg = (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + confFig(Math.abs(v));
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (iso) => String(iso).slice(0, 10).split("-").map(Number);
const dayLab = (iso, year) => { const [y, m, d] = ymd(iso); return d + " " + MON[m - 1] + (year ? " " + y : ""); };
const dayFull = (iso) => { const [y, m, d] = ymd(iso); return d + " " + MONTH[m - 1] + " " + y; };
const monthLab = (ym) => { const [y, m] = ymd(ym + "-01"); return MONTH[m - 1] + " " + y; };
const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
const big = (n) => (n == null ? "—" : Number(n).toLocaleString("en-AU"));
const E = {};

/* the two contests and the parties' names and inks (text inks: the map's
   party colours darkened until 12px type reads on white, as the site's own
   --alp-text sits beside --alp) */
const RIVAL = { lnp: { name: "Coalition", the: "the Coalition", ink: "lnp" }, on: { name: "One Nation", the: "One Nation", ink: "onp" } };
const PARTY = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const P4 = ["alp", "lnp", "onp", "grn"];   // the Issues facet's four parties, in the build's order
// the tabs: the modern table's facets, in its order
const TABS = [
  { id: "tpp", label: "Two-party preferred", short: "2PP", cap: "Two-party preferred, poll by poll" },
  { id: "pri", label: "Primary vote", short: "Primary", cap: "Primary vote, poll by poll" },
  { id: "ld", label: "Leadership", short: "Leaders", cap: "Leadership, poll by poll" },
  { id: "dir", label: "Direction", short: "Direction", cap: "Right direction or wrong track, poll by poll" },
  { id: "iss", label: "Issues", short: "Issues", cap: "Who voters rate best on the issues, poll by poll" },
  { id: "dem", label: "Demographics", short: "Demographics", cap: "The vote by group, poll by poll" },
  { id: "conf", label: "Confidence", short: "Confidence", cap: "Economic sentiment, release by release" },
];
const TIMES = [
  { id: "all", label: "Since the election" },
  { id: "12", label: "The last 12 months", months: 12 },
  { id: "6", label: "The last 6 months", months: 6 },
  { id: "3", label: "The last 3 months", months: 3 },
  { id: "6w", label: "The last 6 weeks", days: 42 },
];
RA.TABS = TABS; RA.TIMES = TIMES; RA.RIVAL = RIVAL;
const tabOf = (m) => TABS.find((t) => t.id === m) || TABS[0];
// what a tab's rows are: polls, or (Confidence) the gauges' releases
const noun = (st) => (st.m === "conf" ? ["release", "releases"] : ["poll", "polls"]);

/* ----------------------------------------------------------------- the state */
RA.defaults = (D) => ({ m: "tpp", c: D.rival, g: "age", b: false, h: null, t: "all", q: "", s: { k: "pub", d: -1 } });
// the hash a view is linked by: only what differs from the page as it opens
RA.toHash = (D, st) => {
  const d = RA.defaults(D), kv = [];
  if (st.m !== d.m) kv.push("m=" + st.m);
  if (st.c !== d.c) kv.push("c=" + st.c);
  if (st.m === "dem" && st.g !== d.g) kv.push("g=" + st.g);
  if (st.m === "conf" && st.b) kv.push("b=1");
  if (st.h) kv.push("h=" + [...st.h].map(encodeURIComponent).join(","));
  if (st.t !== d.t) kv.push("t=" + st.t);
  if (st.q) kv.push("q=" + encodeURIComponent(st.q));
  if (st.s.k !== d.s.k || st.s.d !== d.s.d) kv.push("s=" + st.s.k + "." + (st.s.d < 0 ? "d" : "a"));
  return kv.join("&");
};
RA.fromHash = (D, hash) => {
  const st = RA.defaults(D);
  let hs = null;
  for (const kv of String(hash || "").replace(/^#/, "").split("&")) {
    const i = kv.indexOf("="), k = kv.slice(0, i), v = kv.slice(i + 1);
    if (i < 0) continue;
    let dv = v; try { dv = decodeURIComponent(v); } catch (e) {}
    if (k === "m" && TABS.some((t) => t.id === v)) st.m = v;
    else if (k === "c" && RIVAL[v]) st.c = v;
    else if (k === "g" && D.splits.some((s) => s.id === v)) st.g = v;
    else if (k === "b") st.b = v === "1";
    else if (k === "t" && TIMES.some((t) => t.id === v)) st.t = v;
    else if (k === "q") st.q = dv.slice(0, 80);
    else if (k === "h") hs = v.split(",").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    else if (k === "s") {
      // the direction is the last part: the keys themselves carry dots (p.alp, dir.n, conf.chg)
      const j = v.lastIndexOf("."), sk = v.slice(0, j), sd = v.slice(j + 1);
      if (j > 0 && SORTS[sk]) st.s = { k: sk, d: sd === "a" ? 1 : -1 };
    }
  }
  // the pollsters a link names stand only where the tab has rows from them
  if (hs) { const names = hs.filter((x) => RA.tabHouses(D, st).some((h) => h.h === x)); st.h = names.length ? new Set(names) : null; }
  if (RA.sortTab[st.s.k] && RA.sortTab[st.s.k] !== st.m) st.s = { k: "pub", d: -1 };
  return st;
};

/* ----------------------------------------------------------------- the rows in view */
// a row's demographic pair on a split (Offcuts: a family's, or its first family's)
const pairOf = (r, g, fam) => {
  const x = r.dg && r.dg[g];
  if (!x) return null;
  if (!x.fams) return x;
  if (fam) return x.fams[fam] || null;
  const k = Object.keys(x.fams)[0];
  return k ? x.fams[k] : null;
};
/* a tab's rows before any filter: its row set and the scope its modern facet
   arms by default (FACET_SCOPE) - a poll with no leadership figure off the
   Leadership tab's list, as the modern facet keeps it off */
RA.rowSet = (D, st) => {
  switch (st.m) {
    case "ld": return D.rows.filter((r) => r.lx);
    case "dir": return D.rows.concat(D.xrows).filter((r) => r.dir);
    case "iss": return D.rows.concat(D.xrows).filter((r) => r.iss);
    case "dem": return D.rows.filter((r) => pairOf(r, st.g));
    case "conf": return D.crows.filter((r) => r.bus === !!st.b);
  }
  return D.rows;
};
// the rows the count is against: the tab's set before its scope (the modern `total`)
const unscoped = (D, st) => (st.m === "dir" || st.m === "iss" ? D.rows.length + D.xrows.length : st.m === "conf" ? D.crows.filter((r) => r.bus === !!st.b).length : D.rows.length);
/* what each sortable column sorts on; a row without the figure sinks to the
   foot whichever way the column runs */
const SORTS = {
  pub: (r) => r.pt, date: (r) => r.x, house: (r) => r.h.toLowerCase(), n: (r) => r.n,
  imp: (r, st) => r.imp[st.c], pb: (r, st) => (r.pb[st.c] ? r.pb[st.c][0] : null),
  lean: (r, st) => r.ln[st.c], hl: (r, st) => r.hl[st.c],
  "p.alp": (r) => r.p.alp, "p.lnp": (r) => r.p.lnp, "p.grn": (r) => r.p.grn, "p.onp": (r) => r.p.onp, "p.oth": (r) => r.p.oth,
  ppm: (r) => (r.pm ? r.pm.sort : null), alb: (r) => r.ld.alb, opp: (r) => r.ld.opp, han: (r) => r.ld.han,
  "dir.r": (r) => r.dir.r, "dir.w": (r) => r.dir.w, "dir.u": (r) => r.dir.u, "dir.n": (r) => r.dir.n,
  "dem.alp": (r, st, f) => { const x = pairOf(r, st.g, f); return x ? x.g.alp : null; }, "dem.lnp": (r, st, f) => { const x = pairOf(r, st.g, f); return x ? x.g.lnp : null; },
  "dem.grn": (r, st, f) => { const x = pairOf(r, st.g, f); return x ? x.g.grn : null; }, "dem.onp": (r, st, f) => { const x = pairOf(r, st.g, f); return x ? x.g.onp : null; },
  "dem.oth": (r, st, f) => { const x = pairOf(r, st.g, f); return x ? x.g.oth : null; },
  "conf.v": (r) => r.cf.v, "conf.chg": (r) => r.cf.chg,
};
RA.SORTS = SORTS;
// a sort's column belongs to a tab: a tab switch that strands it goes back to the newest first
RA.sortTab = { imp: "tpp", pb: "tpp", lean: "tpp", hl: "tpp", "p.alp": "pri", "p.lnp": "pri", "p.grn": "pri", "p.onp": "pri", "p.oth": "pri", ppm: "ld", alb: "ld", opp: "ld", han: "ld",
  "dir.r": "dir", "dir.w": "dir", "dir.u": "dir", "dir.n": "dir", "dem.alp": "dem", "dem.lnp": "dem", "dem.grn": "dem", "dem.onp": "dem", "dem.oth": "dem", "conf.v": "conf", "conf.chg": "conf" };
// the reference for "the last N months": the newest fieldwork in the data, so an old build reads the same
const cutoffOf = (D, t) => {
  const T = TIMES.find((x) => x.id === t);
  if (!T || t === "all") return null;
  const [y, m, d] = ymd(D.newestField);
  const at = Date.UTC(y, m - 1, d);
  return T.days ? at - T.days * 864e5 : Date.UTC(y, m - 1 - T.months, d);
};
const inTime = (D, st) => { const c = cutoffOf(D, st.t); return (r) => c == null || Date.parse(r.fe + "T00:00:00Z") >= c; };
/* what the find box matches, built the first time it's asked: names, the
   months and year the poll was fielded and released, its figures as
   printed, the facets' own words, and its flags */
const hay = (D, r) => {
  const parts = [r.h, r.c, r.f, monthLab(r.ym), monthLab(r.pym), r.pd ? dayFull(r.pd) : "", r.n, r.n != null ? big(r.n) : "", r.na ? "not counted" : ""];
  if (r.imp) parts.push(r.imp.lnp != null ? f1(r.imp.lnp) : "", r.imp.on != null ? f1(r.imp.on) : "", ...Object.values(r.p).filter((v) => v != null), r.pb.lnp ? r.pb.lnp.join(" ") : "", r.ld.oppN || "", / \(MRP\)$/.test(r.h) ? "mrp model" : "");
  if (r.dir) parts.push("direction right wrong", r.dir.r, r.dir.w, r.dir.n);
  if (r.iss) parts.push("issues", ...D.issMap.filter((x, i) => r.iss.m[i]).map((x) => x[1]), ...r.iss.own.map((x) => D.issLabels[x[0]] || x[0]));
  if (r.dg) for (const [g, x] of Object.entries(r.dg)) parts.push(...(x.fams ? Object.values(x.fams) : [x]).map((y) => y.lab));
  if (r.cf) parts.push(r.cf.lab, confFig(r.cf.v), r.bus ? "business" : "consumer");
  return parts.join(" ").toLowerCase();
};
const inFind = (D, st) => {
  const toks = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  return (r) => toks.every((t) => (r.q || (r.q = hay(D, r))).includes(t));
};
// a tab's pollsters, ranked by how much they poll in it (the modern Pollster filter's ranking)
RA.tabHouses = (D, st) => {
  const n = {};
  for (const r of RA.rowSet(D, st)) n[r.b] = (n[r.b] || 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)).map((h) => ({ h, n: n[h] }));
};
// the houses' counts with every filter on but the pollster checklist's own (a pick can't reshuffle the list under the hand)
RA.houseCounts = (D, st) => {
  const t = inTime(D, st), f = inFind(D, st), n = {};
  for (const r of RA.rowSet(D, st)) if (t(r) && f(r)) n[r.b] = (n[r.b] || 0) + 1;
  return n;
};
RA.view = (D, st) => {
  const t = inTime(D, st), f = inFind(D, st);
  const rows = RA.rowSet(D, st).filter((r) => t(r) && f(r) && (!st.h || st.h.has(r.b)));
  const key = SORTS[st.s.k] || SORTS.pub, dir = st.s.d;
  /* ties (two polls out the same evening) go by fieldwork, the same way the
     column runs, then newest released first: Resolve's 2–7 Nov above
     RedBridge's 2–6 Nov, both out on 8 Nov, as the modern table has them */
  const tie = (a, b) => (a.x !== b.x ? (a.x < b.x ? -dir : dir) : b.pt - a.pt || b.i - a.i);
  const order = (list, fam) => list.sort((a, b) => {
    const va = key(a, st, fam), vb = key(b, st, fam);
    if (va == null && vb == null) return tie(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return tie(a, b);
  });
  /* Offcuts stacks one table per cut family, as the modern facet does: each
     family's polls, sorted within it, under its own band - a poll with two
     families' cuts sits in both */
  const sp = st.m === "dem" ? D.splits.find((s) => s.id === st.g) : null;
  if (sp && sp.fams) {
    const fams = sp.fams.map((fm) => ({ fam: fm, list: order(rows.filter((r) => pairOf(r, st.g, fm.id)), fm.id) })).filter((x) => x.list.length);
    return { rows, groups: null, fams };
  }
  order(rows);
  // the date sorts run in month groups (by the month published, or fielded), as the modern table does
  const byMonth = st.s.k === "pub" || st.s.k === "date";
  const groups = [];
  if (byMonth) {
    for (const r of rows) {
      const ym = st.s.k === "pub" ? r.pym : r.ym;
      const g = groups[groups.length - 1];
      if (!g || g.ym !== ym) groups.push({ ym, list: [r] });
      else g.list.push(r);
    }
  }
  return { rows, groups: byMonth ? groups : null, fams: null };
};

/* ----------------------------------------------------------------- the table */
/* the columns: the poll (who, when, how many), then the tab's figures. On
   a phone (st.ph, the browser's 560px query) when and how many fold under
   the pollster's name, so the figures start on the screen; the strips need
   the width a phone hasn't got */
const lead = (st) => (st.ph ? 1 : 3);
const cols = (D, st) => {
  const c = st.ph ? ["house"] : ["house", "field", "n"];
  switch (st.m) {
    case "tpp": c.push("imp", "pb", ...(st.ph ? [] : ["strip"]), "lean", "hl"); break;
    case "pri": D.order.forEach((id) => c.push("p." + id)); break;
    case "ld": c.push("ppm", "alb", "opp", "han"); break;
    case "dir": c.push("dir.r", "dir.w", "dir.u", ...(st.ph ? [] : ["dbar"]), "dir.n"); break;
    case "iss": D.issMap.forEach(([id]) => c.push("iss." + id)); break;
    case "dem": if (!st.ph) c.push("pair"); D.order.forEach((id) => c.push("dem." + id)); break;
    case "conf": c.push("conf.v", ...(st.ph ? [] : ["cbar"]), "conf.chg"); break;
  }
  return c;
};
RA.ncols = (D, st) => cols(D, st).length;
const sortBtn = (st, k, label, title, cls = "") => {
  const on = st.s.k === k;
  return `<button type="button" class="ap-sort${cls}" data-sort="${k}"${title ? ` title="${esc(title)}"` : ""}><span class="ap-sl">${label}</span><span class="ap-sd" aria-hidden="true">${on ? (st.s.d < 0 ? "▼" : "▲") : ""}</span></button>`;
};
const aria = (st, k) => (st.s.k === k ? ` aria-sort="${st.s.d < 0 ? "descending" : "ascending"}"` : "");
const th = (st, cls, k, label, title) => `<th scope="col" class="${cls}"${aria(st, k)}>${sortBtn(st, k, label, title)}</th>`;
RA.headHTML = (D, st) => {
  const R = RIVAL[st.c], conf = st.m === "conf";
  const out = [th(st, "c-h", "house", conf ? "Gauge" : "Pollster")];
  if (!st.ph) out.push(`<th scope="col" class="c-f"${aria(st, "date") || aria(st, "pub")}>${sortBtn(st, "date", "Fieldwork", "Sort by the dates the " + noun(st)[0] + " was in the field")}${sortBtn(st, "pub", "Released", "Sort by the day it was published", " ap-sort2")}</th>`);
  if (!st.ph) out.push(th(st, "c-n r", "n", "Sample", "The number of people asked; beneath it, the effective sample the pollster published, where it did"));
  switch (st.m) {
    case "tpp":
      out.push(th(st, "c-2 r", "imp", `Implied<small>Labor v ${esc(R.name)}</small>`, "Each poll’s primary votes run through one fixed set of preference flows, the same for every pollster"));
      out.push(th(st, "c-2 r", "pb", `Published<small>by the pollster</small>`, "The pollster’s own two-party figure, where it published one"));
      if (!st.ph) out.push(`<th scope="col" class="c-s"><span class="ap-scale" title="The poll against the average of the other polls fielded within three weeks of it. The square is the poll, the line through it the poll’s 95% margin of error, the tick where its pollster usually sits"><span class="ap-k-${R.ink}">◀ ${esc(R.name)}</span><span>Average</span><span class="ap-k-alp">Labor ▶</span></span></th>`);
      out.push(th(st, "c-l r", "lean", "Lean", "The poll’s implied figure less the average of the other polls fielded within three weeks of it"));
      out.push(th(st, "c-l r", "hl", "House lean", "How far the pollster has usually sat from the other pollsters, as of this poll"));
      break;
    case "pri":
      for (const id of D.order) out.push(th(st, "c-p r", "p." + id, `<span class="ap-k-${id}">${PARTY[id]}</span>`, D.names[id] + "’s first-preference vote, %"));
      break;
    case "ld":
      out.push(th(st, "c-pm r", "ppm", "Better PM", "Preferred prime minister: Albanese’s share, then his opponent’s, %"));
      out.push(th(st, "c-ld r", "alb", `<span class="ap-k-alp">Albanese</span>`, "Albanese’s net rating: approve minus disapprove"));
      out.push(th(st, "c-ld r", "opp", `<span class="ap-k-lnp">${esc(D.oppNow)}</span>`, "The opposition leader’s net rating: approve minus disapprove" + (D.oppWas.length ? " (" + D.oppWas.join(" and ") + " before " + D.oppNow + ")" : "")));
      out.push(th(st, "c-ld r", "han", `<span class="ap-k-onp">Hanson</span>`, "Pauline Hanson’s net rating: approve minus disapprove"));
      break;
    case "dir":
      out.push(th(st, "c-d r", "dir.r", `<span class="ap-k-pos">Right</span>`, "Right direction, %; beneath it, its change on the same pollster’s previous poll"));
      out.push(th(st, "c-d r", "dir.w", `<span class="ap-k-neg">Wrong</span>`, "Wrong track, %; beneath it, its change on the same pollster’s previous poll"));
      out.push(th(st, "c-d r", "dir.u", "Unsure", "Unsure, %; a dash where the pollster offered only the two answers"));
      if (!st.ph) out.push(`<th scope="col" class="c-db"><span class="ap-scale1">Right direction or wrong track, %</span></th>`);
      out.push(th(st, "c-d r", "dir.n", "Net", "Right direction less wrong track"));
      break;
    case "iss":
      for (const [id, lab] of D.issMap) out.push(`<th scope="col" class="c-i"><span class="ap-th">${esc(lab)}</span></th>`);
      break;
    case "dem":
      if (!st.ph) out.push(`<th scope="col" class="c-g"><span class="ap-th" title="The two of the poll’s own groups each row compares: the first group named, then the second">Groups</span></th>`);
      for (const id of D.order) out.push(th(st, "c-p r", "dem." + id, `<span class="ap-k-${id}">${PARTY[id]}</span>`, D.names[id] + "’s share in the first group less its share in the second, in points"));
      break;
    case "conf":
      out.push(th(st, "c-cf r", "conf.v", "Figure", "The gauge’s figure as printed"));
      if (!st.ph) out.push(`<th scope="col" class="c-cb"><span class="ap-scale" title="Each gauge’s figure on a fixed 40–120 scale: more pessimists than optimists below 100, more optimists above it. NAB’s net balance is drawn 100 points up"><span>40</span><span>Neutral</span><span>120</span></span></th>`);
      out.push(th(st, "c-cf r", "conf.chg", "Change", "Change on the gauge’s own previous release"));
      break;
  }
  return `<tr>${out.join("")}</tr>`;
};

const pair = (a, b, ink) => `<b class="ap-pair"><span class="ap-k-alp">${a}</span><span class="ap-dash">–</span><span class="ap-k-${ink}">${b}</span></b>`;
const leanInk = (v, st) => (v == null || Math.abs(v) < 0.05 ? "" : v > 0 ? "alp" : RIVAL[st.c].ink);
const X = (v) => ((Math.max(-6, Math.min(6, v)) + 6) / 12) * 100;
// the lean in words, as the modern table's tooltip says it
const way = (v, st) => (Math.abs(v) < 0.05 ? "level" : signed(v) + " to " + (v > 0 ? "Labor" : RIVAL[st.c].name));
/* the strip: the old trackbar's groove, the average at its middle, the
   poll's square with its 95% margin through it and its pollster's usual
   lean as a tick, on the modern table's ±6-point scale */
function strip(r, st) {
  const c = st.c, lean = r.ln[c], moe = r.me[c], he = r.hl[c];
  if (lean == null) return `<span class="tb tb-none" title="No other poll sits within three weeks of it to set it against">no poll around it</span>`;
  const tip = [r.h + ", " + r.f, "Labor v " + RIVAL[c].name + ", implied: " + f1(r.imp[c]), "The polls around it: " + f1(r.av[c]), "Lean: " + way(lean, st)];
  if (he != null) tip.push("Usual lean: " + way(he, st));
  if (moe != null) tip.push("95% margin: ±" + f1(moe));
  // judged on the figures as printed (the modern table's rdApInside), so a 1.2 gap is never outside a ±1.2 margin
  const adj = he == null ? lean : Math.round((lean - he) * 10) / 10;
  if (moe != null && Math.round(Math.abs(adj) * 10) > Math.round(moe * 10))
    tip.push(he != null ? "Further from its pollster’s usual lean than its margin, as about one poll in 20 should be" : "Outside its margin, as about one poll in 20 should be");
  const parts = [-4, -2, 2, 4].map((v) => `<i class="tb-g" style="left:${X(v)}%"></i>`);
  parts.push(`<i class="tb-a"></i>`);
  if (he != null && Math.abs(he) >= 0.05) parts.push(`<i class="tb-h" style="left:${X(he)}%"></i>`);
  if (moe != null) {
    const lo = X(lean - moe), hi = X(lean + moe);
    parts.push(`<i class="tb-w" style="left:${lo.toFixed(2)}%;width:${(hi - lo).toFixed(2)}%"></i>`);
    if (lean - moe < -6) parts.push(`<i class="tb-c l"></i>`);
    if (lean + moe > 6) parts.push(`<i class="tb-c r"></i>`);
  }
  parts.push(`<i class="tb-d ap-b-${leanInk(lean, st) || "0"}" style="left:${X(lean).toFixed(2)}%"></i>`);
  // (the title is the era's tooltip and, on a role="img", the strip's accessible name too)
  return `<span class="tb" role="img" title="${esc(tip.join("\n"))}">${parts.join("")}</span>`;
}
/* the effective sample's line under the sample: the pollster's own figure,
   or "eff. TBC" while a house that files one hasn't for this poll yet (three
   weeks' grace) and "eff. missing" after, linked to where it files them -
   the modern table's rules, read against today's date as it does */
function effLine(D, r, now) {
  if (r.ne != null) return `<small>eff. ${big(r.ne)}</small>`;
  if (r.pd) {
    const age = now - Date.parse(r.pd + "T00:00:00Z");
    const word = age < 21 * 864e5 ? (r.et ? "TBC" : null) : (r.em ? "missing" : null);
    if (word) {
      const note = word === "TBC" ? "The pollster publishes an effective sample, but not yet for this poll" : "The pollster publishes an effective sample, but none for this poll";
      const u = D.effUrls[r.b];
      return `<small>eff. ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(note)}">${word}</a>` : `<span title="${esc(note)}">${word}</span>`}</small>`;
    }
  }
  if (/ \(MRP\)$/.test(r.h)) return `<small>eff. n/a</small>`;
  return "";
}
// a figure over its change on the house's previous poll
const fc = (v, d, ink) => `<b${ink ? ` class="ap-k-${ink}"` : ""}>${v == null ? "—" : num(v)}</b>${chg(d) ? `<small>${chg(d)}</small>` : ""}`;
/* the bar a cell draws its shares with: a sunken track, each share a
   segment as wide as its per cent (the rest of the hundred left empty) */
const bar = (segs, cls = "") => `<span class="ap-sbar${cls}" aria-hidden="true">${segs.filter(([v]) => v > 0).map(([v, c]) => `<i class="ap-b-${c}" style="width:${Math.min(100, v).toFixed(1)}%"></i>`).join("")}</span>`;
/* an issue's cell: the party the most voters rate best and its lead over
   the next (under half a point is level), over the four parties' shares as
   printed - the modern Issues facet's verdict and bar */
function issCell(D, r, i) {
  const [id, lab] = D.issMap[i], x = r.iss.m[i];
  if (!x) return `<td class="c-i"><span class="ap-none" title="${esc(lab)}: not asked">—</span></td>`;
  const P = (k) => D.issParty[k] || [k, k];
  const shares = P4.map((k, j) => (x.s[j] != null ? P(k)[1] + " " + num(x.s[j]) : null)).filter(Boolean).join(", ");
  const words = lab + ": " + (!x.w ? "no party figures" : x.lv ? "level" : P(x.w)[0] + " ahead by " + Math.round(x.l)) + " (" + shares + ")";
  const verdict = !x.w ? "—" : x.lv ? "Level" : `<span class="ap-k-${x.w}">${esc(P(x.w)[1])} +${Math.round(x.l)}</span>`;
  return `<td class="c-i" title="${esc(words)}"><b>${verdict}</b>${bar(P4.map((k, j) => [x.s[j] || 0, k]), " ap-ibar")}</td>`;
}
// where a gauge sits on the modern facet's fixed 40–120 meter (confPlot, cfx), and its ink (confInk)
const confPlot = (c) => c.v * (c.vs === 50 ? 2 : 1) + (c.vs === 0 ? 100 : 0);
const CX = (v) => ((Math.max(40, Math.min(120, v)) - 40) / 80) * 100;
const confInk = (c) => (c.k === "consumer" || c.k === "business" ? "cm" : c.k === "demosauConsumer" ? "c3" : "ca");
function rowHTML(D, st, r, grouped, open, now, fam) {
  const c = st.c, R = RIVAL[c], tds = [];
  const lk = r.lk != null ? r.links[r.lk] : null;
  const name = lk ? `<a href="${esc(lk.u)}" target="_blank" rel="noopener" title="Opens ${esc(lk.t)}">${esc(r.h)}</a>` : esc(r.h);
  const na = r.na ? `<span class="ap-na" title="Not counted in the aggregates. ${esc(r.na)}">†</span>` : "";
  const when = esc(r.f) + (grouped ? "" : ` <span class="ap-yr">’${String(r.y).slice(2)}</span>`);
  const pr = st.m === "dem" ? pairOf(r, st.g, fam) : null;
  if (st.ph) tds.push(`<th scope="row" class="c-h">${name}${na}<small class="ap-phs">${[pr ? esc(pr.lab) : "", r.c ? esc(r.c) : "", when, r.n != null ? big(r.n) : ""].filter(Boolean).join(" · ")}</small></th>`);
  else tds.push(`<th scope="row" class="c-h">${name}${na}<small>${esc(r.c || "")}</small></th>`);
  if (!st.ph) tds.push(`<td class="c-f">${when}${r.pd ? `<small>released ${dayLab(r.pd)}</small>` : ""}</td>`);
  if (!st.ph) tds.push(`<td class="c-n r">${big(r.n)}${effLine(D, r, now)}</td>`);
  switch (st.m) {
    case "tpp": {
      const v = r.imp[c], pb = r.pb[c];
      tds.push(`<td class="c-2 r">${v != null ? pair(f1(v), f1(100 - v), R.ink) : `<span class="ap-none">—</span><small>${esc(r.none)}</small>`}</td>`);
      tds.push(`<td class="c-2 r">${pb ? pair(num(pb[0]), num(pb[1]), R.ink) : `<span class="ap-none">—</span>`}</td>`);
      if (!st.ph) tds.push(`<td class="c-s">${v != null ? strip(r, st) : ""}</td>`);
      const ln = r.ln[c], hl = r.hl[c];
      tds.push(`<td class="c-l r">${ln == null ? "—" : `<span class="ap-k-${leanInk(ln, st) || "0"}">${signed(ln)}</span>`}</td>`);
      tds.push(`<td class="c-l r">${hl == null ? "—" : `<span class="ap-k-${leanInk(hl, st) || "0"}">${signed(hl)}</span>`}</td>`);
      break;
    }
    case "pri":
      for (const id of D.order) tds.push(`<td class="c-p r"><b class="ap-k-${id}">${num(r.p[id])}</b></td>`);
      break;
    case "ld": {
      tds.push(`<td class="c-pm r">${r.pm ? `<b class="ap-pair">${r.pm.v.map(([v, ink]) => `<span class="ap-k-${ink}">${v}</span>`).join(`<span class="ap-dash">–</span>`)}</b><small>${esc(r.pm.sub)}</small>` : `<span class="ap-none">—</span><small>not asked</small>`}</td>`);
      const net = (k, ink) => {
        const v = r.ld[k];
        if (v == null) return `<td class="c-ld r"><span class="ap-none">—</span></td>`;
        const fav = r.ld.fav.includes(k) ? `<span class="ap-fav" title="Favourability: favourable minus unfavourable">*</span>` : "";
        const who = k === "opp" && r.ld.oppN && r.ld.oppN !== D.oppNow ? `<small>${esc(r.ld.oppN)}</small>` : "";
        return `<td class="c-ld r"><b class="ap-k-${ink}">${signed(v, 0)}</b>${fav}${who}</td>`;
      };
      tds.push(net("alb", "alp"), net("opp", "lnp"), net("han", "onp"));
      break;
    }
    case "dir": {
      const d = r.dir;
      tds.push(`<td class="c-d r">${fc(d.r, d.c.r, "pos")}</td>`, `<td class="c-d r">${fc(d.w, d.c.w, "neg")}</td>`, `<td class="c-d r">${d.u == null ? `<span class="ap-none" title="Only right and wrong were offered">—</span>` : fc(d.u, d.c.u)}</td>`);
      if (!st.ph) tds.push(`<td class="c-db" title="${esc(`Right direction ${num(d.r)}%, ${d.u == null ? "" : `unsure ${num(d.u)}%, `}wrong track ${num(d.w)}%`)}">${bar([[d.r, "pos"], [d.u || 0, "u"], [d.w, "neg"]], " ap-dbar")}</td>`);
      tds.push(`<td class="c-d r"><b>${signed(d.n, 0)}</b>${chg(d.c.n) ? `<small>${chg(d.c.n)}</small>` : ""}</td>`);
      break;
    }
    case "iss":
      D.issMap.forEach((x, i) => tds.push(issCell(D, r, i)));
      break;
    case "dem":
      if (!st.ph) tds.push(`<td class="c-g">${pr ? esc(pr.lab) : "—"}</td>`);
      for (const id of D.order) tds.push(`<td class="c-p r"><b class="ap-k-${id}">${pr ? gapTxt(pr.g[id]) : "—"}</b></td>`);
      break;
    case "conf": {
      const k = r.cf, nab = k.vs === 0;
      tds.push(`<td class="c-cf r"><b>${confFig(k.v)}</b>${nab ? "<small>net balance</small>" : ""}</td>`);
      if (!st.ph) tds.push(`<td class="c-cb"><span class="tb" role="img" title="${esc(r.h + ", " + confFig(k.v) + (nab ? " – a net balance (0 is neutral), drawn 100 points up" : k.vs === 50 ? " – 50 is neutral, drawn doubled" : ", 100 is neutral"))}">${[60, 80].map((v) => `<i class="tb-g" style="left:${CX(v)}%"></i>`).join("")}<i class="tb-a" style="left:${CX(100)}%"></i><i class="tb-d ap-b-${confInk(k)}" style="left:${CX(confPlot(k)).toFixed(2)}%"></i></span></td>`);
      const ci = k.chg == null || Math.abs(k.chg) < 0.05 ? "" : k.chg > 0 ? " class=\"ap-k-pos\"" : " class=\"ap-k-neg\"";
      tds.push(`<td class="c-cf r"><b${ci}>${k.chg != null ? confChg(k.chg) : "—"}</b>${k.first && k.chg == null ? "<small>first release</small>" : ""}</td>`);
      break;
    }
  }
  const cls = "ap-r" + (r.na ? " ap-nar" : "") + (open ? " open" : "");
  return `<tr class="${cls}" data-i="${r.i}"${fam ? ` data-fam="${esc(fam)}"` : ""} tabindex="0" aria-expanded="${open ? "true" : "false"}">${tds.join("")}</tr>` + (open ? detailHTML(D, st, r) : "");
}
/* a poll opened in its row: everything it carries, the tab's own figures
   first, then the rest the row's tab leaves out, and its links */
function detailHTML(D, st, r) {
  const by = r.c && r.c !== "Self-published" ? (r.cf ? " · " + esc(r.c) : " for " + esc(r.c)) : "";
  const head = `<p class="ap-dh"><b>${esc(r.h)}</b>${by} · in the field ${esc(r.ff)}${r.pd ? ", released " + dayFull(r.pd) : ""} · ${r.n != null ? "a sample of " + big(r.n) + (r.ne != null ? " (effective " + big(r.ne) + ")" : "") : "no sample published"}</p>`;
  const S = { vote: [], dir: [], iss: [], dem: [], conf: [] };
  if (r.imp) {
    const prim = D.order.filter((id) => r.p[id] != null).map((id) => `<span class="ap-k-${id}">${PARTY[id]} ${num(r.p[id])}</span>`);
    S.vote.push(["First preferences", prim.length ? prim.join(" · ") : "not published"]);
    const imp = ["lnp", "on"].filter((k) => r.imp[k] != null).map((k) => `Labor ${f1(r.imp[k])} v ${RIVAL[k].name} ${f1(100 - r.imp[k])}`);
    S.vote.push(["Two-party, implied", imp.length ? imp.join(" · ") : esc(r.none)]);
    const pb = ["lnp", "on"].filter((k) => r.pb[k]).map((k) => `Labor ${num(r.pb[k][0])} v ${RIVAL[k].name} ${num(r.pb[k][1])}`);
    S.vote.push(["Two-party, published", pb.length ? pb.join(" · ") : "none published"]);
    const nets = [["alb", "Albanese"], ["opp", r.ld.oppN || D.oppNow], ["han", "Hanson"]].filter(([k]) => r.ld[k] != null)
      .map(([k, n]) => `${esc(n)} ${signed(r.ld[k], 0)}${r.ld.fav.includes(k) ? " (favourability)" : ""}`);
    if (nets.length) S.vote.push(["Net ratings", nets.join(" · ")]);
    if (r.pmAll && r.pmAll.length) S.vote.push(["Better PM", r.pmAll.map((set) => set.map(([n, v]) => esc(n) + " " + v).join(", ")).join("; ")]);
  }
  if (r.dir) {
    const d = r.dir, c = [["right", d.c.r], ["wrong", d.c.w], ["unsure", d.c.u], ["net", d.c.n]].filter(([, v]) => chg(v)).map(([k, v]) => k + " " + chg(v));
    S.dir.push(["Direction", `<span class="ap-k-pos">right ${num(d.r)}</span> · <span class="ap-k-neg">wrong ${num(d.w)}</span>${d.u == null ? "" : " · unsure " + num(d.u)} · net ${signed(d.n, 0)}`]);
    if (c.length) S.dir.push(["On its last poll", c.join(" · ")]);
    for (const g of d.bg) S.dir.push([esc(g.h.replace(/:$/, "")), g.c.map(([l, rr, w]) => `${esc(l)} ${rr}–${w}`).join(" · ")]);
  }
  if (r.iss) {
    const P = (k) => (D.issParty[k] || [k, k])[1];
    const own = r.iss.own.length ? r.iss.own : r.iss.bp ? [["col", ...r.iss.bp.slice(0, 4)]] : [];
    if (own.length) S.iss.push([r.iss.q ? "Rated best (" + esc(r.iss.q) + ")" : "Rated best", own.map(([id, ...v]) => `${esc(D.issLabels[id] || id)}: ` + P4.map((k, j) => (v[j] != null ? `<span class="ap-k-${k}">${P(k)} ${num(v[j])}</span>` : null)).filter(Boolean).join(", ")).join("<br>")]);
    if (r.iss.sal) S.iss.push(["What matters most", r.iss.sal.map((x) => esc(x[0]) + " " + x[1]).join(" · ")]);
    else if (r.iss.conc) S.iss.push(["Concerns, any mention", r.iss.conc.map((x) => esc(x[0]) + " " + x[1]).join(" · ")]);
  }
  if (r.dg) {
    for (const sp of D.splits) {
      const x = r.dg[sp.id];
      if (!x) continue;
      const line = (y) => `${esc(y.lab)}: ` + D.order.map((id) => `<span class="ap-k-${id}">${PARTY[id]} ${gapTxt(y.g[id])}</span>`).join(" · ");
      if (x.fams) for (const fm of sp.fams) { if (x.fams[fm.id]) S.dem.push([esc(fm.lab), line(x.fams[fm.id])]); }
      else S.dem.push([esc(sp.label), line(x)]);
    }
    if (S.dem.length) S.dem.unshift(["By group", "each party’s share in the first group less its share in the second, in points"]);
  }
  if (r.cf) {
    const k = r.cf, sc = k.vs === 0 ? "a net balance, 0 is neutral" : k.vs === 50 ? "50 is neutral" : "100 is neutral";
    S.conf.push([esc(k.lab), `${confFig(k.v)} (${sc})${k.chg != null ? ", " + confChg(k.chg) + " on the previous release" : k.first ? ", the gauge’s first release this term" : ""}`]);
    if (k.cond != null) S.conf.push(["Trading conditions", confFig(k.cond) + (k.condChg != null ? ", " + confChg(k.condChg) + " on the previous release" : "")]);
  }
  const first = { tpp: "vote", pri: "vote", ld: "vote", dir: "dir", iss: "iss", dem: "dem", conf: "conf" }[st.m];
  const dl = [...S[first], ...["vote", "dir", "iss", "dem", "conf"].filter((k) => k !== first).flatMap((k) => S[k])];
  if (r.na) dl.push(["Not counted", esc(r.na)]);
  if (r.links.length) dl.push(["Sources", r.links.map((l) => (l.u ? `<a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>` : esc(l.t))).join(" · ")]);
  return `<tr class="ap-d"><td colspan="${RA.ncols(D, st)}"><div class="ap-det">${head}<dl>${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div></td></tr>`;
}
/* a month's divider: its name and count, and the month's own estimate in
   the columns it belongs to - on the two-party tab the tracker's monthly
   line on each basis, on the primary tab the month's primary vote (the
   modern table's month rows, figure for figure); the other tabs count
   their polls, or Confidence its releases */
function monthHTML(D, st, g) {
  const n = g.list.length, nc = RA.ncols(D, st), M = D.months[g.ym] || {};
  if (st.m === "tpp") {
    const c = st.c, today = D.today[c];
    const k = g.list.filter((r) => r.tw & (c === "on" ? 2 : 1)).length;
    const all = n === 1 ? "in" : n === 2 ? "both in" : "all in";
    const note = plural(n, "poll") + (today && k ? (k === n ? ", " + all + " today’s " + f1(today.a) : ", " + k + " in today’s " + f1(today.a)) : "");
    // (a phone's column holds Labor's figure alone, as the modern table's phone rows do)
    const avg = (v) => (v == null ? "" : st.ph ? `<span class="ap-mavg">Avg <b class="ap-pair ap-k-alp">${f1(v)}</b></span>` : `<span class="ap-mavg">Average ${pair(f1(v), f1(100 - v), RIVAL[c].ink)}</span>`);
    return `<tr class="ap-m"><th scope="rowgroup" colspan="${lead(st)}"><b>${monthLab(g.ym)}</b> <span>${note}</span></th><td class="c-2 r">${avg(M.imp && M.imp[c])}</td><td class="c-2 r">${avg(M.pub && M.pub[c])}</td><td colspan="${nc - lead(st) - 2}"></td></tr>`;
  }
  if (st.m === "pri" && M.prim) {
    return `<tr class="ap-m"><th scope="rowgroup" colspan="${lead(st)}"><b>${monthLab(g.ym)}</b> <span>the month’s average</span></th>${D.order.map((id) => `<td class="c-p r"><b class="ap-k-${id}">${M.prim[id] != null ? f1(M.prim[id]) : "—"}</b></td>`).join("")}</tr>`;
  }
  return `<tr class="ap-m"><th scope="rowgroup" colspan="${nc}"><b>${monthLab(g.ym)}</b> <span>${plural(n, ...noun(st))}</span></th></tr>`;
}
// an Offcuts family's band: its name, and whose polls it holds
const famHTML = (D, st, x) => `<tr class="ap-m ap-fam"><th scope="rowgroup" colspan="${RA.ncols(D, st)}"><b>${esc(x.fam.lab)}</b> <span>${esc(x.fam.sub)}</span></th></tr>`;
RA.bodyHTML = (D, st, V, open, now) => {
  if (!V.rows.length) return `<tr class="ap-empty"><td colspan="${RA.ncols(D, st)}">No ${noun(st)[0]} matches these filters. <button type="button" data-ap="clear">Clear filters</button></td></tr>`;
  const t = now == null ? Date.parse(D.built + "T00:00:00Z") : now;
  if (V.fams) return V.fams.map((x) => famHTML(D, st, x) + x.list.map((r) => rowHTML(D, st, r, false, open === r.i + "|" + x.fam.id, t, x.fam.id)).join("")).join("");
  if (V.groups) return V.groups.map((g) => monthHTML(D, st, g) + g.list.map((r) => rowHTML(D, st, r, true, open === String(r.i), t)).join("")).join("");
  return V.rows.map((r) => rowHTML(D, st, r, false, open === String(r.i), t)).join("");
};
/* the key under the table, for the tab in view: what its columns and marks mean */
RA.keyHTML = (D, st) => {
  const na = `<span class="ap-na">†</span> Not counted in the tracker’s figures (point at the mark for why).`;
  switch (st.m) {
    case "tpp": return `Click a poll to open it. <b>Implied</b> runs the poll’s primary votes through one fixed set of preference flows; <b>published</b> is the pollster’s own figure. <b>Lean</b> is the poll against the average of the other polls fielded within three weeks of it; <b>house lean</b> is where its pollster usually sits. ${na}`;
    case "pri": return `Click a poll to open it. First preferences, %, as the pollster printed them; each month row gives the tracker’s own estimate for the month. ${na}`;
    case "ld": return `Click a poll to open it. The polls with a leadership figure. <b>Better PM</b>: Albanese’s share, then his opponent’s. Net ratings are approval minus disapproval; <span class="ap-fav">*</span> marks favourability, favourable minus unfavourable. ${na}`;
    case "dir": return `Click a poll to open it. The share saying the country is heading in the right direction or is on the wrong track, %, each with its change on the same pollster’s previous poll; <b>net</b> is right less wrong. A dash under unsure: the pollster offered only the two answers. ${na}`;
    case "iss": return `Click a poll to open it. For each issue, the party the most voters rate best and its lead over the next, in points (under half a point is level); the bar beneath holds the four parties’ shares. A dash: the poll didn’t ask about it. Point at a cell for the shares. ${na}`;
    case "dem": return `Click a poll to open it. Each figure is a party’s share among the first group named less its share among the second, in points, from the pollster’s own tables. Pollsters draw their groups differently, so each row names its pair. ${na}`;
    case "conf": return `Click a release to open it. Each gauge’s figure as published: 100 is neutral, with more optimists above it and more pessimists below. NAB prints a net balance, where 0 is neutral. <b>Change</b> is on the gauge’s own previous release.`;
  }
  return "";
};
/* the count, as the modern table words it: what's shown, and of what - the
   whole archive (polls) or every release (Confidence) */
RA.countHTML = (D, st, V) => {
  const total = unscoped(D, st), of = st.m === "conf" ? (D.confAll !== total ? D.confAll : null) : (D.totalAll !== total ? D.totalAll : null);
  const n = V.rows.length;
  return `<b>${big(n)}</b>${n !== total ? " of " + big(of || total) : of ? " of " + big(of) : ""} ${noun(st)[1]}`;
};
RA.housesLabel = (D, st) => (!st.h ? "All pollsters" : st.h.size === 1 ? [...st.h][0] : st.h.size + " pollsters");
RA.filtered = (D, st) => !!(st.h || st.t !== "all" || st.q);

/* ----------------------------------------------------------------- the CSV */
// the tab's columns, beside who, when and how many (and the poll's link)
RA.csv = (D, st, V) => {
  const lead = ["Pollster", "Client", "Fieldwork", "Fieldwork ends", "Published", "Sample", "Effective sample"];
  const leadOf = (r) => [r.h, r.c, r.ff, r.fe, r.pd, r.n, r.ne];
  const src = (r) => (r.lk != null ? r.links[r.lk].u : (r.links.find((l) => l.u) || {}).u);
  let head, line;
  switch (st.m) {
    case "dir":
      head = ["Right", "Wrong", "Unsure", "Net", "Right change", "Wrong change", "Unsure change", "Net change"];
      line = (r) => { const d = r.dir; return [d.r, d.w, d.u, d.n, d.c.r, d.c.w, d.c.u, d.c.n]; };
      break;
    case "iss":
      head = D.issMap.flatMap(([, lab]) => [lab + ": rated best", lab + ": lead", ...P4.map((k) => lab + ": " + (D.issParty[k] || [k, k])[1])]);
      line = (r) => D.issMap.flatMap((x, i) => { const c = r.iss.m[i]; return c ? [c.w ? (c.lv ? "level" : (D.issParty[c.w] || [c.w, c.w])[1]) : null, c.l != null ? +c.l.toFixed(1) : null, ...c.s] : [null, null, null, null, null, null]; });
      break;
    case "dem": {
      // (Offcuts: a line per family a poll carries, as its tables stack them)
      const sp = D.splits.find((s) => s.id === st.g);
      head = ["Split", "Groups", "First group", "Second group", ...D.order.map((id) => PARTY[id] + " gap")];
      line = (r, fam) => { const x = pairOf(r, st.g, fam); return [fam ? sp.fams.find((f) => f.id === fam).lab : sp ? sp.label : st.g, x && x.lab, x && x.a, x && x.b, ...D.order.map((id) => (x ? x.g[id] : null))]; };
      break;
    }
    case "conf":
      head = ["Gauge", "Figure", "Scale", "Change"];
      line = (r) => [r.cf.lab, r.cf.v, r.cf.vs === 0 ? "net balance, 0 neutral" : r.cf.vs === 50 ? "index, 50 neutral" : "index, 100 neutral", r.cf.chg];
      break;
    default:
      head = [...D.order.map((id) => PARTY[id] + " primary"),
        "ALP 2PP v L/NP, implied", "ALP 2PP v L/NP, published", "L/NP 2PP, published",
        "ALP v ON, implied", "ALP v ON, published", "ON v ALP, published",
        "Lean v L/NP (implied)", "House lean v L/NP (implied)", "95% margin v L/NP (implied)",
        "Albanese net", "Opposition leader", "Opposition leader net", "Hanson net", "Favourability nets"];
      line = (r) => [...D.order.map((id) => r.p[id]),
        r.imp.lnp, r.pb.lnp ? r.pb.lnp[0] : null, r.pb.lnp ? r.pb.lnp[1] : null,
        r.imp.on, r.pb.on ? r.pb.on[0] : null, r.pb.on ? r.pb.on[1] : null,
        r.ln.lnp, r.hl.lnp, r.me.lnp != null ? +r.me.lnp.toFixed(1) : null,
        r.ld.alb, r.ld.oppN, r.ld.opp, r.ld.han, r.ld.fav.join(" ")];
  }
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [[...lead, ...head, "Counted in the aggregates", "Source"].map(q).join(",")];
  const out = (r, fam) => lines.push([...leadOf(r), ...line(r, fam), r.cf ? null : r.na ? "no" : "yes", src(r)].map(q).join(","));
  if (V.fams) for (const x of V.fams) for (const r of x.list) out(r, x.fam.id);
  else for (const r of V.rows) out(r);
  return lines.join("\r\n") + "\r\n";
};

if (typeof document === "undefined") return;
/* ================================================================= the browser */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const D = JSON.parse($("#ap-data").textContent);
// the phone's columns follow the width, never the link
const PH = matchMedia("(max-width: 560px)");
const fresh = (hash) => ({ ...RA.fromHash(D, hash), ph: PH.matches });
let st = fresh(location.hash);
let open = null;   // the opened row: its index (and, in an Offcuts family, "index|family")
const FAV_KEY = "auspol.map.favs", RT_KEY = "auspol.map.retro", HERE = "/allpolls/retro/";

function render(o = {}) {
  const V = RA.view(D, st);
  document.documentElement.dataset.apM = st.m;
  if (open != null && !V.rows.some((r) => open === String(r.i) || open.startsWith(r.i + "|"))) open = null;
  $("#ap-head").innerHTML = RA.headHTML(D, st);
  $("#ap-body").innerHTML = RA.bodyHTML(D, st, V, open, Date.now());
  $("#ap-count").innerHTML = RA.countHTML(D, st, V);
  $("#ap-key").innerHTML = RA.keyHTML(D, st);
  $("#ap-hbtn .ap-hl").textContent = RA.housesLabel(D, st);
  $("#ap-c").value = st.c; $("#ap-t").value = st.t; $("#ap-g").value = st.g; $("#ap-b").value = st.b ? "1" : "0";
  if ($("#ap-q").value !== st.q) $("#ap-q").value = st.q;
  $(".ap-cwrap").hidden = st.m !== "tpp";
  $(".ap-gwrap").hidden = st.m !== "dem";
  $(".ap-bwrap").hidden = st.m !== "conf";
  for (const b of $$(".rt-tabs [data-ap-tab]")) b.setAttribute("aria-selected", String(b.dataset.apTab === st.m));
  $("#ap-cap").textContent = tabOf(st.m).cap;
  if (o.url !== false) {
    const h = RA.toHash(D, st);
    try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
  }
}
function set(patch) {
  st = { ...st, ...patch };
  if (RA.sortTab[st.s.k] && RA.sortTab[st.s.k] !== st.m) st.s = { k: "pub", d: -1 };
  // a tab, split or lane that holds none of the picked pollsters drops the picks it can't show
  if (st.h && (patch.m || patch.g || patch.b != null)) {
    const hs = new Set(RA.tabHouses(D, st).map((x) => x.h)), keep = [...st.h].filter((h) => hs.has(h));
    st.h = keep.length ? new Set(keep) : null;
  }
  render();
}

/* ----- the navbar's menus (the map's retro view's, item for item where the page has the same job) ----- */
const drop = $(".rt-drop");
let dropFor = null, dropKey = null, items = null;
function favs() {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v.filter((f) => f && typeof f.h === "string" && typeof f.t === "string") : []; } catch (e) { return []; }
}
function favsSave(list) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch (e) { return false; } }
// a favourite's page: the map's own entries carry none (they were saved before this page had any)
const favPage = (f) => (typeof f.p === "string" ? f.p : "/map/");
function favLabel() {
  const parts = ["All polls", tabOf(st.m).label];
  if (st.m === "tpp" && st.c !== D.rival) parts.push("Labor v " + RIVAL[st.c].name);
  if (st.m === "dem") { const sp = D.splits.find((s) => s.id === st.g); if (sp) parts.push(sp.label); }
  if (st.m === "conf") parts.push(st.b ? "business" : "consumer");
  if (st.h) parts.push(st.h.size <= 2 ? [...st.h].join(", ") : st.h.size + " pollsters");
  if (st.t !== "all") parts.push(TIMES.find((t) => t.id === st.t).label.replace(/^The /, "").toLowerCase().replace(/^last/, "the last"));
  if (st.q) parts.push("“" + st.q + "”");
  // a sort other than the newest first names itself
  const SN = { date: "fieldwork", house: "pollster", n: "sample", imp: "implied", pb: "published", lean: "lean", hl: "house lean", ppm: "Better PM", alb: "Albanese", opp: D.oppNow, han: "Hanson",
    "dir.r": "right direction", "dir.w": "wrong track", "dir.u": "unsure", "dir.n": "net direction", "conf.v": "figure", "conf.chg": "change" };
  if (st.s.k === "pub") { if (st.s.d > 0) parts.push("oldest first"); }
  else parts.push("by " + (SN[st.s.k] || (PARTY[st.s.k.replace(/^(p|dem)\./, "")] || st.s.k) + (st.s.k.startsWith("dem.") ? " gap" : "")) + (st.s.d > 0 ? ", ascending" : ""));
  return parts.join(" · ");
}
function menuItems(k) {
  switch (k) {
    case "edit": return [
      { label: st.m === "conf" ? "Find a release…" : "Find a poll…", kb: "/", act: () => { const q = $("#ap-q"); q.scrollIntoView({ block: "nearest" }); q.focus(); q.select(); } },
      { label: "Copy link to this view", act: copyLink },
      { sep: true },
      { label: "Clear filters", disabled: !RA.filtered(D, st), act: clearFilters },
    ];
    case "view": return [
      ...TABS.map((t) => ({ label: t.label, radio: st.m === t.id, act: () => set({ m: t.id }) })),
      { sep: true },
      ...Object.keys(RIVAL).map((c) => ({ label: "Labor v " + RIVAL[c].name, radio: st.c === c, disabled: st.m !== "tpp", act: () => set({ c }) })),
      { sep: true },
      { label: "Newest first", radio: st.s.k === "pub" && st.s.d < 0, act: () => set({ s: { k: "pub", d: -1 } }) },
      { label: "Oldest first", radio: st.s.k === "pub" && st.s.d > 0, act: () => set({ s: { k: "pub", d: 1 } }) },
      { sep: true },
      { label: "Modern view", act: goModern },
    ];
    case "fav": {
      const list = favs(), here = RA.toHash(D, st);
      return [
        { label: "Add this view to Favorites", act: favAdd },
        { sep: true },
        ...(list.length ? list.map((f, i) => ({ label: f.t, fav: i, current: favPage(f) === HERE && f.h === here })) : [{ label: "No favourites yet", disabled: true }]),
      ];
    }
    case "help": return [
      { label: "About these polls", act: () => $("#ap-notes").scrollIntoView({ behavior: "smooth", block: "start" }) },
      { label: "How the tracker works", href: "/info/" },
      { label: "Send feedback…", href: "/feedback/" },
    ];
    case "more": return D.pages.more.map((p) => ({ label: p.label, href: p.href }));
    case "pages": return [...D.pages.tabs.map((p) => ({ label: p.label, href: p.href, check: p.href === HERE })), { sep: true }, ...D.pages.more.map((p) => ({ label: p.label, href: p.href }))];
    case "houses": {
      const n = RA.houseCounts(D, st);
      return [
        { label: "All pollsters", radio: !st.h, keep: true, act: () => set({ h: null }) },
        { sep: true },
        ...RA.tabHouses(D, st).map((h) => ({ label: h.h, kb: String(n[h.h] || 0), check: !!(st.h && st.h.has(h.h)), keep: true, house: h.h })),
      ];
    }
  }
  return [];
}
function renderMenu() {
  items = menuItems(dropKey);
  drop.innerHTML = items.map((it, i) => {
    if (it.sep) return "<hr>";
    const mark = it.radio ? "●" : it.check ? "✓" : "";
    const inner = `<span class="rt-ck">${mark}</span><span class="rt-it">${esc(it.label)}</span>${it.kb ? `<span class="rt-kb">${esc(it.kb)}</span>` : ""}`;
    const role = it.radio ? "menuitemradio" : it.check != null && it.house ? "menuitemcheckbox" : "menuitem";
    const chk = role !== "menuitem" ? ` aria-checked="${!!(it.radio || it.check)}"` : "";
    if (it.fav != null) return `<div class="rt-favrow"><button type="button" role="menuitem" data-fav="${it.fav}" tabindex="-1"${it.current ? ' aria-current="page"' : ""}>${inner}</button><button type="button" class="rt-favdel" data-favdel="${it.fav}" tabindex="-1" aria-label="Remove ${esc(it.label)} from Favorites" title="Remove from Favorites"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.5"/></svg></button></div>`;
    return it.href ? `<a role="menuitem" href="${esc(it.href)}" tabindex="-1"${it.check ? ' aria-current="page"' : ""}>${inner}</a>`
      : `<button type="button" role="${role}"${chk} data-item="${i}" tabindex="-1"${it.disabled ? " disabled" : ""}>${inner}</button>`;
  }).join("");
}
function openMenu(k, anchor) {
  if (dropFor === anchor && !drop.hidden) { closeMenu(); return; }
  closeMenu();
  dropKey = k; dropFor = anchor;
  drop.setAttribute("aria-label", anchor.textContent.trim());
  renderMenu();
  drop.hidden = false;
  placeMenu();
  anchor.setAttribute("aria-expanded", "true");
  (drop.querySelector("button:not(:disabled), a"))?.focus({ preventScroll: true });
}
// under its button (the site's pages' menus hang from their right edge)
function placeMenu() {
  if (!dropFor) return;
  const r = dropFor.getBoundingClientRect(), w = drop.offsetWidth, h = drop.offsetHeight;
  const right = dropKey === "more" || dropKey === "pages";
  drop.style.left = `${Math.max(2, Math.min(right ? r.right - w : r.left, innerWidth - w - 2))}px`;
  drop.style.top = `${Math.max(2, Math.min(r.bottom + 1, innerHeight - h - 2))}px`;
}
function closeMenu() {
  if (drop.hidden) return;
  drop.hidden = true;
  if (dropFor) dropFor.setAttribute("aria-expanded", "false");
  dropFor = null; dropKey = null;
}
function note(anchor, text) {
  if (!anchor) return;
  const n = document.createElement("div");
  n.className = "rt-note"; n.setAttribute("role", "status"); n.textContent = text;
  document.body.append(n);
  const r = anchor.getBoundingClientRect();
  n.style.left = `${Math.max(4, Math.min(r.left, innerWidth - n.offsetWidth - 4))}px`;
  n.style.top = `${r.bottom + 4}px`;
  setTimeout(() => n.remove(), 1800);
}
function copyLink() {
  const a = $('.rt-nav [data-rt-menu="edit"]');
  try { navigator.clipboard.writeText(location.href).then(() => note(a, "Link copied"), () => note(a, "Couldn’t copy the link")); } catch (e) { note(a, "Couldn’t copy the link"); }
}
function clearFilters() { $("#ap-q").value = ""; set({ h: null, t: "all", q: "" }); }
function favAdd() {
  const a = $('.rt-nav [data-rt-menu="fav"]'), h = RA.toHash(D, st), list = favs();
  if (list.some((f) => favPage(f) === HERE && f.h === h)) { note(a, "Already in Favorites"); return; }
  list.unshift({ t: favLabel(), h, p: HERE });
  note(a, favsSave(list) ? "Added to Favorites" : "This browser won’t keep Favorites");
}
function favGo(i) {
  const f = favs()[i]; if (!f) return;
  const p = favPage(f);
  if (p === HERE) { st = fresh(f.h); open = null; render(); return; }
  // the map's own views open in its retro view, the look the reader is in
  location.href = p + "#" + (f.h ? f.h + "&" : "") + "retro=1";
}
function goModern() {
  // leaving the retro look: the map's saved choice goes too, as the map's own Modern view does
  try { localStorage.removeItem(RT_KEY); } catch (e) {}
  location.href = "/allpolls/";
}
function saveCsv() {
  const V = RA.view(D, st);
  const blob = new Blob(["﻿" + RA.csv(D, st, V)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "auspol-tracker-" + (st.m === "conf" ? "economic-sentiment" : "all-polls-" + tabOf(st.m).short.toLowerCase()) + "-" + D.built + ".csv";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ----- wiring ----- */
document.addEventListener("click", (e) => {
  const mb = e.target.closest("[data-rt-menu]");
  if (mb) { openMenu(mb.dataset.rtMenu, mb); return; }
  const del = e.target.closest("[data-favdel]");
  if (del) { const list = favs(); list.splice(+del.dataset.favdel, 1); favsSave(list); renderMenu(); (drop.querySelector("button:not(:disabled), a"))?.focus({ preventScroll: true }); return; }
  const fav = e.target.closest("[data-fav]");
  if (fav) { const i = +fav.dataset.fav; closeMenu(); favGo(i); return; }
  const it = e.target.closest("[data-item]");
  if (it && items) {
    const f = items[+it.dataset.item];
    if (!f || it.disabled) return;
    if (f.house) {   // the pollster checklist stays open while it's ticked
      const h = new Set(st.h || []);
      if (h.has(f.house)) h.delete(f.house); else h.add(f.house);
      set({ h: h.size ? h : null }); renderMenu();
      drop.querySelector(`[data-item="${it.dataset.item}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (f.keep) { f.act(); renderMenu(); drop.querySelector(`[data-item="${it.dataset.item}"]`)?.focus({ preventScroll: true }); return; }
    closeMenu(); if (f.act) f.act(); return;
  }
  if (!drop.hidden && !e.target.closest(".rt-drop")) closeMenu();
  const tab = e.target.closest("[data-ap-tab]");
  if (tab) { open = null; set({ m: tab.dataset.apTab }); return; }
  const so = e.target.closest("[data-sort]");
  if (so) {
    const k = so.dataset.sort;
    // a new column opens on its natural order: names A–Z, dates and figures largest first
    set({ s: st.s.k === k ? { k, d: -st.s.d } : { k, d: k === "house" ? 1 : -1 } });
    return;
  }
  const ap = e.target.closest("[data-ap]");
  if (ap) {
    if (ap.dataset.ap === "modern") goModern();
    else if (ap.dataset.ap === "csv") saveCsv();
    else if (ap.dataset.ap === "clear") clearFilters();
    else if (ap.dataset.ap === "shade") {
      const p = $("#ap-today"), shut = !p.classList.contains("rt-shut");
      p.classList.toggle("rt-shut", shut);
      ap.setAttribute("aria-expanded", String(!shut));
      ap.setAttribute("aria-label", (shut ? "Open" : "Roll up") + " the panel"); ap.title = ap.getAttribute("aria-label");
    }
    return;
  }
  // a row opens and shuts on a click anywhere but its links
  const row = e.target.closest("tr.ap-r");
  if (row && !e.target.closest("a")) {
    const id = row.dataset.i + (row.dataset.fam ? "|" + row.dataset.fam : "");
    open = open === id ? null : id;
    render({ url: false });
    $(`tr.ap-r[data-i="${row.dataset.i}"]${row.dataset.fam ? `[data-fam="${row.dataset.fam}"]` : ""}`)?.focus({ preventScroll: true });
  }
});
document.addEventListener("mouseover", (e) => {
  if (drop.hidden || !dropFor) return;
  const mb = e.target.closest(".rt-nav [data-rt-menu]");
  if (mb && mb !== dropFor && dropFor.closest(".rt-nav")) openMenu(mb.dataset.rtMenu, mb);
});
document.addEventListener("keydown", (e) => {
  if (!drop.hidden) {
    if (e.key === "Escape") { e.preventDefault(); const a = dropFor; closeMenu(); a?.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const xs = $$("[role^=menuitem]:not(:disabled)", drop), i = xs.indexOf(document.activeElement);
      if (xs.length) xs[(i + (e.key === "ArrowDown" ? 1 : -1) + xs.length) % xs.length].focus({ preventScroll: true });
      return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && dropFor && dropFor.closest(".rt-nav")) {
      const ms = $$(".rt-nav [data-rt-menu]").filter((b) => b.offsetParent), i = ms.indexOf(dropFor);
      if (i < 0) return;
      e.preventDefault();
      const nb = ms[(i + (e.key === "ArrowRight" ? 1 : -1) + ms.length) % ms.length];
      openMenu(nb.dataset.rtMenu, nb);
      return;
    }
  }
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
  if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const q = $("#ap-q"); q.focus(); q.select(); return; }
  // a row: Enter or space opens it, the arrows walk the polls
  const row = document.activeElement?.closest?.("tr.ap-r");
  if (row && !typing) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rs = $$("tr.ap-r"), i = rs.indexOf(row), n = rs[i + (e.key === "ArrowDown" ? 1 : -1)];
      n?.focus();
    }
  }
});
$("#ap-q").addEventListener("input", (e) => { st = { ...st, q: e.target.value.slice(0, 80) }; render(); });
$("#ap-c").addEventListener("change", (e) => set({ c: e.target.value }));
$("#ap-t").addEventListener("change", (e) => set({ t: e.target.value }));
$("#ap-g").addEventListener("change", (e) => { open = null; set({ g: e.target.value }); });
$("#ap-b").addEventListener("change", (e) => { open = null; set({ b: e.target.value === "1" }); });
addEventListener("hashchange", () => { st = fresh(location.hash); render({ url: false }); });
PH.addEventListener("change", () => { st = { ...st, ph: PH.matches }; render({ url: false }); });
/* a scroll shuts a menu, as the old ones shut, but the pollster checklist:
   ticking it re-draws the list, which can scroll the page under it, so it
   follows its button instead */
addEventListener("scroll", () => { if (drop.hidden) return; if (dropKey === "houses") placeMenu(); else closeMenu(); }, { passive: true });
$(".ap-well").addEventListener("scroll", () => { if (!drop.hidden && dropKey !== "houses") closeMenu(); }, { passive: true });
addEventListener("resize", closeMenu);
render({ url: false });
})();
