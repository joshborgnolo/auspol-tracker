/* =============================== the retro All polls page ===============================
   The script of /allpolls/retro/, the All polls archive in the dress the
   Electoral map's retro view wears (.build/retro/chrome.css): the navbar in
   the era's words, the banner, the tab buttons, and the table as the old
   details list, its column heads raised buttons that sort it.

   One file, two readers. .build/retro/allpolls.mjs runs it in node (no
   document there, so only the renderers below load) to write the table into
   the page as it first opens, which a reader without JavaScript keeps; the
   browser runs it again to take the table over: the tabs, the pollster
   checklist, the time and contest pickers, the find box, the sort, a poll
   opened in its row, the CSV and the navbar's menus. The same functions
   draw both, so the page as built and the page after a click can't
   disagree.

   Every figure is the dataset's: the build reads the generated dataset the
   main page reads (individualPolls and the monthly lines) and hands over
   finished numbers, so a row here says what the modern All polls row says.
   The state rides the hash (m= tab, c= contest, h= pollsters, t= time, q=
   find, s= sort), so a link or a Favorite opens the same view. */
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
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (iso) => String(iso).slice(0, 10).split("-").map(Number);
const dayLab = (iso, year) => { const [y, m, d] = ymd(iso); return d + " " + MON[m - 1] + (year ? " " + y : ""); };
const dayFull = (iso) => { const [y, m, d] = ymd(iso); return d + " " + MONTH[m - 1] + " " + y; };
const monthLab = (ym) => { const [y, m] = ymd(ym + "-01"); return MONTH[m - 1] + " " + y; };
const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const numWord = (n) => NUMW[n] || String(n);
const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
const big = (n) => (n == null ? "—" : Number(n).toLocaleString("en-AU"));

/* the two contests and the parties' names and inks (text inks: the map's
   party colours darkened until 12px type reads on white, as the site's own
   --alp-text sits beside --alp) */
const RIVAL = { lnp: { name: "Coalition", the: "the Coalition", ink: "lnp" }, on: { name: "One Nation", the: "One Nation", ink: "onp" } };
const PARTY = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const TABS = [
  { id: "tpp", label: "Two-party preferred", short: "2PP" },
  { id: "pri", label: "Primary vote", short: "Primary" },
  { id: "ld", label: "Leadership", short: "Leaders" },
];
const TIMES = [
  { id: "all", label: "Since the election" },
  { id: "12", label: "The last 12 months", months: 12 },
  { id: "6", label: "The last 6 months", months: 6 },
  { id: "3", label: "The last 3 months", months: 3 },
  { id: "6w", label: "The last 6 weeks", days: 42 },
];
RA.TABS = TABS; RA.TIMES = TIMES; RA.RIVAL = RIVAL;

/* ----------------------------------------------------------------- the state */
RA.defaults = (D) => ({ m: "tpp", c: D.rival, h: null, t: "all", q: "", s: { k: "pub", d: -1 } });
// the hash a view is linked by: only what differs from the page as it opens
RA.toHash = (D, st) => {
  const d = RA.defaults(D), kv = [];
  if (st.m !== d.m) kv.push("m=" + st.m);
  if (st.c !== d.c) kv.push("c=" + st.c);
  if (st.h) kv.push("h=" + [...st.h].map(encodeURIComponent).join(","));
  if (st.t !== d.t) kv.push("t=" + st.t);
  if (st.q) kv.push("q=" + encodeURIComponent(st.q));
  if (st.s.k !== d.s.k || st.s.d !== d.s.d) kv.push("s=" + st.s.k + "." + (st.s.d < 0 ? "d" : "a"));
  return kv.join("&");
};
RA.fromHash = (D, hash) => {
  const st = RA.defaults(D);
  for (const kv of String(hash || "").replace(/^#/, "").split("&")) {
    const i = kv.indexOf("="), k = kv.slice(0, i), v = kv.slice(i + 1);
    if (i < 0) continue;
    let dv = v; try { dv = decodeURIComponent(v); } catch (e) {}
    if (k === "m" && TABS.some((t) => t.id === v)) st.m = v;
    else if (k === "c" && RIVAL[v]) st.c = v;
    else if (k === "t" && TIMES.some((t) => t.id === v)) st.t = v;
    else if (k === "q") st.q = dv.slice(0, 80);
    else if (k === "h") {
      const names = v.split(",").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } }).filter((x) => D.houses.some((h) => h.h === x));
      st.h = names.length ? new Set(names) : null;
    } else if (k === "s") {
      const [sk, sd] = v.split(".");
      if (SORTS[sk]) st.s = { k: sk, d: sd === "a" ? 1 : -1 };
    }
  }
  return st;
};

/* ----------------------------------------------------------------- the rows in view */
/* what each sortable column sorts on; a row without the figure sinks to the
   foot whichever way the column runs */
const SORTS = {
  pub: (r) => r.pt, date: (r) => r.x, house: (r) => r.h.toLowerCase(), n: (r) => r.n,
  imp: (r, st) => r.imp[st.c], pb: (r, st) => (r.pb[st.c] ? r.pb[st.c][0] : null),
  lean: (r, st) => r.ln[st.c], hl: (r, st) => r.hl[st.c],
  "p.alp": (r) => r.p.alp, "p.lnp": (r) => r.p.lnp, "p.grn": (r) => r.p.grn, "p.onp": (r) => r.p.onp, "p.oth": (r) => r.p.oth,
  ppm: (r) => (r.pm ? r.pm.sort : null), alb: (r) => r.ld.alb, opp: (r) => r.ld.opp, han: (r) => r.ld.han,
};
RA.SORTS = SORTS;
// a sort's column belongs to a tab: a tab switch that strands it goes back to the newest first
RA.sortTab = { imp: "tpp", pb: "tpp", lean: "tpp", hl: "tpp", "p.alp": "pri", "p.lnp": "pri", "p.grn": "pri", "p.onp": "pri", "p.oth": "pri", ppm: "ld", alb: "ld", opp: "ld", han: "ld" };
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
   printed, and its flags */
const hay = (r) => {
  const ymW = (ym) => monthLab(ym);
  return [r.h, r.c, r.f, ymW(r.ym), ymW(r.pym), r.pd ? dayFull(r.pd) : "", r.n, r.n != null ? big(r.n) : "",
    r.imp.lnp != null ? f1(r.imp.lnp) : "", r.imp.on != null ? f1(r.imp.on) : "",
    ...Object.values(r.p).filter((v) => v != null), r.pb.lnp ? r.pb.lnp.join(" ") : "",
    r.na ? "not counted" : "", r.ld.oppN || "", / \(MRP\)$/.test(r.h) ? "mrp model" : ""].join(" ").toLowerCase();
};
const inFind = (st) => {
  const toks = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  return (r) => toks.every((t) => (r.q || (r.q = hay(r))).includes(t));
};
// the houses' counts with every filter on but the pollster checklist's own (a pick can't reshuffle the list under the hand)
RA.houseCounts = (D, st) => {
  const t = inTime(D, st), f = inFind(st), n = {};
  for (const r of D.rows) if (t(r) && f(r)) n[r.b] = (n[r.b] || 0) + 1;
  return n;
};
RA.view = (D, st) => {
  const t = inTime(D, st), f = inFind(st);
  const rows = D.rows.filter((r) => t(r) && f(r) && (!st.h || st.h.has(r.b)));
  const key = SORTS[st.s.k] || SORTS.pub, dir = st.s.d;
  /* ties (two polls out the same evening) go by fieldwork, the same way the
     column runs, then newest released first: Resolve's 2–7 Nov above
     RedBridge's 2–6 Nov, both out on 8 Nov, as the modern table has them */
  const tie = (a, b) => (a.x !== b.x ? (a.x < b.x ? -dir : dir) : b.pt - a.pt || b.i - a.i);
  rows.sort((a, b) => {
    const va = key(a, st), vb = key(b, st);
    if (va == null && vb == null) return tie(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return tie(a, b);
  });
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
  return { rows, groups: byMonth ? groups : null };
};

/* ----------------------------------------------------------------- the table */
/* the columns: the poll (who, when, how many), then the tab's figures. On
   a phone (st.ph, the browser's 560px query) when and how many fold under
   the pollster's name, so the figures start on the screen; the strip
   needs the width a phone hasn't got */
const lead = (st) => (st.ph ? 1 : 3);
const cols = (D, st) => {
  const c = st.ph ? [{ id: "house" }] : [{ id: "house" }, { id: "field" }, { id: "n" }];
  if (st.m === "tpp") c.push({ id: "imp" }, { id: "pb" }, ...(st.ph ? [] : [{ id: "strip" }]), { id: "lean" }, { id: "hl" });
  else if (st.m === "pri") D.order.forEach((id) => c.push({ id: "p." + id }));
  else c.push({ id: "ppm" }, { id: "alb" }, { id: "opp" }, { id: "han" });
  return c;
};
RA.ncols = (D, st) => cols(D, st).length;
const sortBtn = (st, k, label, title, cls = "") => {
  const on = st.s.k === k;
  return `<button type="button" class="ap-sort${cls}" data-sort="${k}"${title ? ` title="${esc(title)}"` : ""}><span class="ap-sl">${label}</span><span class="ap-sd" aria-hidden="true">${on ? (st.s.d < 0 ? "▼" : "▲") : ""}</span></button>`;
};
const aria = (st, k) => (st.s.k === k ? ` aria-sort="${st.s.d < 0 ? "descending" : "ascending"}"` : "");
RA.headHTML = (D, st) => {
  const R = RIVAL[st.c];
  const out = [];
  out.push(`<th scope="col" class="c-h"${aria(st, "house")}>${sortBtn(st, "house", "Pollster")}</th>`);
  if (!st.ph) out.push(`<th scope="col" class="c-f"${aria(st, "date") || aria(st, "pub")}>${sortBtn(st, "date", "Fieldwork", "Sort by the dates the poll was in the field")}${sortBtn(st, "pub", "Released", "Sort by the day the poll was published", " ap-sort2")}</th>`);
  if (!st.ph) out.push(`<th scope="col" class="c-n r"${aria(st, "n")}>${sortBtn(st, "n", "Sample", "The number of people asked; beneath it, the effective sample the pollster published, where it did")}</th>`);
  if (st.m === "tpp") {
    out.push(`<th scope="col" class="c-2 r"${aria(st, "imp")}>${sortBtn(st, "imp", `Implied<small>Labor v ${esc(R.name)}</small>`, "Each poll’s primary votes run through one fixed set of preference flows, the same for every pollster")}</th>`);
    out.push(`<th scope="col" class="c-2 r"${aria(st, "pb")}>${sortBtn(st, "pb", `Published<small>by the pollster</small>`, "The pollster’s own two-party figure, where it published one")}</th>`);
    if (!st.ph) out.push(`<th scope="col" class="c-s"><span class="ap-scale" title="The poll against the average of the other polls fielded within three weeks of it. The square is the poll, the line through it the poll’s 95% margin of error, the tick where its pollster usually sits"><span class="ap-k-${R.ink}">◀ ${esc(R.name)}</span><span>Average</span><span class="ap-k-alp">Labor ▶</span></span></th>`);
    out.push(`<th scope="col" class="c-l r"${aria(st, "lean")}>${sortBtn(st, "lean", "Lean", "The poll’s implied figure less the average of the other polls fielded within three weeks of it")}</th>`);
    out.push(`<th scope="col" class="c-l r"${aria(st, "hl")}>${sortBtn(st, "hl", "House lean", "How far the pollster has usually sat from the other pollsters, as of this poll")}</th>`);
  } else if (st.m === "pri") {
    for (const id of D.order) out.push(`<th scope="col" class="c-p r"${aria(st, "p." + id)}>${sortBtn(st, "p." + id, `<span class="ap-k-${id}">${PARTY[id]}</span>`, D.names[id] + "’s first-preference vote, %")}</th>`);
  } else {
    out.push(`<th scope="col" class="c-pm r"${aria(st, "ppm")}>${sortBtn(st, "ppm", "Better PM", "Preferred prime minister: Albanese’s share, then his opponent’s, %")}</th>`);
    out.push(`<th scope="col" class="c-ld r"${aria(st, "alb")}>${sortBtn(st, "alb", `<span class="ap-k-alp">Albanese</span>`, "Albanese’s net rating: approve minus disapprove")}</th>`);
    out.push(`<th scope="col" class="c-ld r"${aria(st, "opp")}>${sortBtn(st, "opp", `<span class="ap-k-lnp">${esc(D.oppNow)}</span>`, "The opposition leader’s net rating: approve minus disapprove" + (D.oppWas.length ? " (" + D.oppWas.join(" and ") + " before " + D.oppNow + ")" : ""))}</th>`);
    out.push(`<th scope="col" class="c-ld r"${aria(st, "han")}>${sortBtn(st, "han", `<span class="ap-k-onp">Hanson</span>`, "Pauline Hanson’s net rating: approve minus disapprove")}</th>`);
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
function rowHTML(D, st, r, grouped, open, now) {
  const c = st.c, R = RIVAL[c], tds = [];
  const lk = r.lk != null ? r.links[r.lk] : null;
  const name = lk ? `<a href="${esc(lk.u)}" target="_blank" rel="noopener" title="Opens ${esc(lk.t)}">${esc(r.h)}</a>` : esc(r.h);
  const na = r.na ? `<span class="ap-na" title="Not counted in the aggregates. ${esc(r.na)}">†</span>` : "";
  const when = esc(r.f) + (grouped ? "" : ` <span class="ap-yr">’${String(r.y).slice(2)}</span>`);
  if (st.ph) tds.push(`<th scope="row" class="c-h">${name}${na}<small class="ap-phs">${[r.c ? esc(r.c) : "", when, r.n != null ? big(r.n) : ""].filter(Boolean).join(" · ")}</small></th>`);
  else tds.push(`<th scope="row" class="c-h">${name}${na}<small>${esc(r.c || "")}</small></th>`);
  if (!st.ph) tds.push(`<td class="c-f">${esc(r.f)}${grouped ? "" : ` <span class="ap-yr">’${String(r.y).slice(2)}</span>`}${r.pd ? `<small>released ${dayLab(r.pd)}</small>` : ""}</td>`);
  if (!st.ph) tds.push(`<td class="c-n r">${big(r.n)}${effLine(D, r, now)}</td>`);
  if (st.m === "tpp") {
    const v = r.imp[c], pb = r.pb[c];
    tds.push(`<td class="c-2 r">${v != null ? pair(f1(v), f1(100 - v), R.ink) : `<span class="ap-none">—</span><small>${esc(r.none)}</small>`}</td>`);
    tds.push(`<td class="c-2 r">${pb ? pair(num(pb[0]), num(pb[1]), R.ink) : `<span class="ap-none">—</span>`}</td>`);
    if (!st.ph) tds.push(`<td class="c-s">${v != null ? strip(r, st) : ""}</td>`);
    const ln = r.ln[c], hl = r.hl[c];
    tds.push(`<td class="c-l r">${ln == null ? "—" : `<span class="ap-k-${leanInk(ln, st) || "0"}">${signed(ln)}</span>`}</td>`);
    tds.push(`<td class="c-l r">${hl == null ? "—" : `<span class="ap-k-${leanInk(hl, st) || "0"}">${signed(hl)}</span>`}</td>`);
  } else if (st.m === "pri") {
    for (const id of D.order) tds.push(`<td class="c-p r"><b class="ap-k-${id}">${num(r.p[id])}</b></td>`);
  } else {
    tds.push(`<td class="c-pm r">${r.pm ? `<b class="ap-pair">${r.pm.v.map(([v, ink]) => `<span class="ap-k-${ink}">${v}</span>`).join(`<span class="ap-dash">–</span>`)}</b><small>${esc(r.pm.sub)}</small>` : `<span class="ap-none">—</span><small>not asked</small>`}</td>`);
    const net = (k, ink) => {
      const v = r.ld[k];
      if (v == null) return `<td class="c-ld r"><span class="ap-none">—</span></td>`;
      const fav = r.ld.fav.includes(k) ? `<span class="ap-fav" title="Favourability: favourable minus unfavourable">*</span>` : "";
      const who = k === "opp" && r.ld.oppN && r.ld.oppN !== D.oppNow ? `<small>${esc(r.ld.oppN)}</small>` : "";
      return `<td class="c-ld r"><b class="ap-k-${ink}">${signed(v, 0)}</b>${fav}${who}</td>`;
    };
    tds.push(net("alb", "alp"), net("opp", "lnp"), net("han", "onp"));
  }
  const cls = "ap-r" + (r.na ? " ap-nar" : "") + (open ? " open" : "");
  return `<tr class="${cls}" data-i="${r.i}" tabindex="0" aria-expanded="${open ? "true" : "false"}">${tds.join("")}</tr>` + (open ? detailHTML(D, st, r) : "");
}
/* a poll opened in its row: everything the row's tab leaves out, and its links */
function detailHTML(D, st, r) {
  const L = [];
  const by = r.c && r.c !== "Self-published" ? " for " + esc(r.c) : "";
  L.push(`<p class="ap-dh"><b>${esc(r.h)}</b>${by} · in the field ${esc(r.ff)}${r.pd ? ", released " + dayFull(r.pd) : ""} · ${r.n != null ? "a sample of " + big(r.n) + (r.ne != null ? " (effective " + big(r.ne) + ")" : "") : "no sample published"}</p>`);
  const dl = [];
  const prim = D.order.filter((id) => r.p[id] != null).map((id) => `<span class="ap-k-${id}">${PARTY[id]} ${num(r.p[id])}</span>`);
  dl.push(["First preferences", prim.length ? prim.join(" · ") : "not published"]);
  const imp = ["lnp", "on"].filter((k) => r.imp[k] != null).map((k) => `Labor ${f1(r.imp[k])} v ${RIVAL[k].name} ${f1(100 - r.imp[k])}`);
  dl.push(["Two-party, implied", imp.length ? imp.join(" · ") : esc(r.none)]);
  const pb = ["lnp", "on"].filter((k) => r.pb[k]).map((k) => `Labor ${num(r.pb[k][0])} v ${RIVAL[k].name} ${num(r.pb[k][1])}`);
  dl.push(["Two-party, published", pb.length ? pb.join(" · ") : "none published"]);
  const nets = [["alb", "Albanese"], ["opp", r.ld.oppN || D.oppNow], ["han", "Hanson"]].filter(([k]) => r.ld[k] != null)
    .map(([k, n]) => `${esc(n)} ${signed(r.ld[k], 0)}${r.ld.fav.includes(k) ? " (favourability)" : ""}`);
  if (nets.length) dl.push(["Net ratings", nets.join(" · ")]);
  if (r.pmAll && r.pmAll.length) dl.push(["Better PM", r.pmAll.map((set) => set.map(([n, v]) => esc(n) + " " + v).join(", ")).join("; ")]);
  if (r.na) dl.push(["Not counted", esc(r.na)]);
  if (r.links.length) dl.push(["Sources", r.links.map((l) => (l.u ? `<a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>` : esc(l.t))).join(" · ")]);
  return `<tr class="ap-d"><td colspan="${RA.ncols(D, st)}"><div class="ap-det">${L.join("")}<dl>${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div></td></tr>`;
}
/* a month's divider: its name and count, and the month's own estimate in
   the columns it belongs to - on the two-party tab the tracker's monthly
   line on each basis, on the primary tab the month's primary vote (the
   modern table's month rows, figure for figure) */
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
  return `<tr class="ap-m"><th scope="rowgroup" colspan="${nc}"><b>${monthLab(g.ym)}</b> <span>${plural(n, "poll")}</span></th></tr>`;
}
RA.bodyHTML = (D, st, V, open, now) => {
  if (!V.rows.length) return `<tr class="ap-empty"><td colspan="${RA.ncols(D, st)}">No poll matches these filters. <button type="button" data-ap="clear">Clear filters</button></td></tr>`;
  const t = now == null ? Date.parse(D.built + "T00:00:00Z") : now;
  if (V.groups) return V.groups.map((g) => monthHTML(D, st, g) + g.list.map((r) => rowHTML(D, st, r, true, open === r.i, t)).join("")).join("");
  return V.rows.map((r) => rowHTML(D, st, r, false, open === r.i, t)).join("");
};
/* the key under the table, for the tab in view: what its columns and marks mean */
RA.keyHTML = (D, st) => {
  const na = `<span class="ap-na">†</span> Not counted in the tracker’s figures (point at the mark for why).`;
  if (st.m === "tpp") return `Click a poll to open it. <b>Implied</b> runs the poll’s primary votes through one fixed set of preference flows; <b>published</b> is the pollster’s own figure. <b>Lean</b> is the poll against the average of the other polls fielded within three weeks of it; <b>house lean</b> is where its pollster usually sits. ${na}`;
  if (st.m === "pri") return `Click a poll to open it. First preferences, %, as the pollster printed them; each month row gives the tracker’s own estimate for the month. ${na}`;
  return `Click a poll to open it. <b>Better PM</b>: Albanese’s share, then his opponent’s. Net ratings are approval minus disapproval; <span class="ap-fav">*</span> marks favourability, favourable minus unfavourable. ${na}`;
};
RA.countHTML = (D, st, V) => (V.rows.length === D.rows.length ? `<b>${big(D.rows.length)}</b> polls` : `<b>${big(V.rows.length)}</b> of ${big(D.rows.length)} polls`);
RA.housesLabel = (D, st) => (!st.h ? "All pollsters" : st.h.size === 1 ? [...st.h][0] : st.h.size + " pollsters");
RA.filtered = (D, st) => !!(st.h || st.t !== "all" || st.q);

/* ----------------------------------------------------------------- the CSV */
RA.csv = (D, st, V) => {
  const head = ["Pollster", "Client", "Fieldwork", "Fieldwork ends", "Published", "Sample", "Effective sample",
    ...D.order.map((id) => PARTY[id] + " primary"),
    "ALP 2PP v L/NP, implied", "ALP 2PP v L/NP, published", "L/NP 2PP, published",
    "ALP v ON, implied", "ALP v ON, published", "ON v ALP, published",
    "Lean v L/NP (implied)", "House lean v L/NP (implied)", "95% margin v L/NP (implied)",
    "Albanese net", "Opposition leader", "Opposition leader net", "Hanson net", "Favourability nets",
    "Counted in the aggregates", "Source"];
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.map(q).join(",")];
  for (const r of V.rows) {
    lines.push([r.h, r.c, r.ff, r.fe, r.pd, r.n, r.ne, ...D.order.map((id) => r.p[id]),
      r.imp.lnp, r.pb.lnp ? r.pb.lnp[0] : null, r.pb.lnp ? r.pb.lnp[1] : null,
      r.imp.on, r.pb.on ? r.pb.on[0] : null, r.pb.on ? r.pb.on[1] : null,
      r.ln.lnp, r.hl.lnp, r.me.lnp != null ? +r.me.lnp.toFixed(1) : null,
      r.ld.alb, r.ld.oppN, r.ld.opp, r.ld.han, r.ld.fav.join(" "),
      r.na ? "no" : "yes", r.lk != null ? r.links[r.lk].u : (r.links.find((l) => l.u) || {}).u].map(q).join(","));
  }
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
let open = null;
const FAV_KEY = "auspol.map.favs", RT_KEY = "auspol.map.retro", HERE = "/allpolls/retro/";

function render(o = {}) {
  const V = RA.view(D, st);
  document.documentElement.dataset.apM = st.m;
  if (open != null && !V.rows.some((r) => r.i === open)) open = null;
  $("#ap-head").innerHTML = RA.headHTML(D, st);
  $("#ap-body").innerHTML = RA.bodyHTML(D, st, V, open, Date.now());
  $("#ap-count").innerHTML = RA.countHTML(D, st, V);
  $("#ap-key").innerHTML = RA.keyHTML(D, st);
  $("#ap-hbtn .ap-hl").textContent = RA.housesLabel(D, st);
  $("#ap-c").value = st.c; $("#ap-t").value = st.t;
  if ($("#ap-q").value !== st.q) $("#ap-q").value = st.q;
  $(".ap-cwrap").hidden = st.m !== "tpp";
  for (const b of $$(".rt-tabs [data-ap-tab]")) b.setAttribute("aria-selected", String(b.dataset.apTab === st.m));
  $("#ap-cap").textContent = TABS.find((t) => t.id === st.m).label + ", poll by poll";
  if (o.url !== false) {
    const h = RA.toHash(D, st);
    try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
  }
}
function set(patch) {
  st = { ...st, ...patch };
  if (patch.m && RA.sortTab[st.s.k] && RA.sortTab[st.s.k] !== st.m) st.s = { k: "pub", d: -1 };
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
  const parts = ["All polls", TABS.find((t) => t.id === st.m).label];
  if (st.m === "tpp" && st.c !== D.rival) parts.push("Labor v " + RIVAL[st.c].name);
  if (st.h) parts.push(st.h.size <= 2 ? [...st.h].join(", ") : st.h.size + " pollsters");
  if (st.t !== "all") parts.push(TIMES.find((t) => t.id === st.t).label.replace(/^The /, "").toLowerCase().replace(/^last/, "the last"));
  if (st.q) parts.push("“" + st.q + "”");
  // a sort other than the newest first names itself
  const SN = { date: "fieldwork", house: "pollster", n: "sample", imp: "implied", pb: "published", lean: "lean", hl: "house lean", ppm: "Better PM", alb: "Albanese", opp: D.oppNow, han: "Hanson" };
  if (st.s.k === "pub") { if (st.s.d > 0) parts.push("oldest first"); }
  else parts.push("by " + (SN[st.s.k] || PARTY[st.s.k.slice(2)] || st.s.k) + (st.s.d > 0 ? ", ascending" : ""));
  return parts.join(" · ");
}
function menuItems(k) {
  switch (k) {
    case "edit": return [
      { label: "Find a poll…", kb: "/", act: () => { const q = $("#ap-q"); q.scrollIntoView({ block: "nearest" }); q.focus(); q.select(); } },
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
        ...D.houses.map((h) => ({ label: h.h, kb: String(n[h.h] || 0), check: !!(st.h && st.h.has(h.h)), keep: true, house: h.h })),
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
  a.download = "auspol-tracker-all-polls-" + D.built + ".csv";
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
  if (tab) { set({ m: tab.dataset.apTab }); return; }
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
  if (row && !e.target.closest("a")) { const i = +row.dataset.i; open = open === i ? null : i; render({ url: false }); $(`tr.ap-r[data-i="${i}"]`)?.focus({ preventScroll: true }); }
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
