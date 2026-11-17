/* the Election model – assembled from .build/model by .build/model/assemble.mjs; edit the parts, not this file */
(() => {
"use strict";
const URLS = {"nowcast":"/data/seat-model-2028-nowcast.json?v=64729ad7","forecast":"/data/seat-model-2028-forecast.json?v=923dbbfd","inputs":"/model/data/inputs.json?v=9f8c8313","evidence":"/model/data/evidence.json?v=4a24d6d8","senate":"/data/senate-rankings-2025.json?v=edeb9db9","vic":"/data/seat-model-vic-2026.json?v=7f3b0780","inputsVic":"/model/data/inputs-vic.json?v=f261a665","reasons":"/model/data/reasons.json?v=6dc373a1","worker":"/model/js/worker.mjs?v=4f9d7b92"};
/* views.mjs: the /model/ page's written lines and head figures, by rule - one implementation.
   assemble.mjs imports it to write the page's static head (what a reader sees before the script runs,
   and what a crawler reads) and inlines the same source into model.js, which redraws the head with it
   on a mode switch and draws the explorer's results with it.

   The headline names the party most likely to win the most seats and grades the claim by the share of
   simulations behind it; every scenario is covered:
     majority chance >= 90%            "X would win a majority"            / "X is very likely to win a majority"
     60-90%                            "X would probably win a majority"   / "X is likely to win a majority"
     most-seats chance >= 90%          "X would win the most seats, ..."   / "X is very likely to win the most seats, ..."
     60-90%                            "X would probably win the most seats, ..." / "X is favoured to win the most seats, ..."
     otherwise                         "No party is clearly ahead on seats"
   with the majority clause, when a majority is under 60%:
     under 20%  "probably short of a majority"
     20-40%     "more likely short of a majority than not"
     40-60%     "with a majority about as likely as not"
   The first column is "if an election were held now", the second election day. */
const PARTY = {
  alp: { name: "Labor", lower: "Labor", short: "ALP" },
  lnp: { name: "The Coalition", lower: "the Coalition", short: "L/NP" },
  on: { name: "One Nation", lower: "One Nation", short: "ON" },
  grn: { name: "The Greens", lower: "the Greens", short: "GRN" },
  member: { name: "Independents", lower: "independents", short: "IND" },
  oth: { name: "Others", lower: "others", short: "OTH" },
};
const MAJ_KEY = { alp: "alp", lnp: "coalition", on: "on" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (p) => (p < 0.005 ? "less than 1%" : p > 0.995 ? "more than 99%" : `${Math.round(100 * p)}%`);
const pctShort = (p) => (p < 0.005 ? "<1%" : p > 0.995 ? ">99%" : `${Math.round(100 * p)}%`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const shortDate = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };

/* the run's House: 150 seats and 76 for a majority federally; a state run says its own (meta.seatsTotal, meta.majority) */
const majOf = (res) => res.meta?.majority || 76;
const totalOf = (res) => res.meta?.seatsTotal || 150;

/* mode: "nowcast" (an election held now), "forecast" (election day, months out) or "vic" (the Victorian
   election, weeks out, on today's polls) - the last two speak of the election to come */
function headline(res, mode) {
  const nat = res.national;
  const cands = ["alp", "lnp", "on"].sort((a, b) => nat.mostSeats[b] - nat.mostSeats[a]);
  const L = cands[0], pMost = nat.mostSeats[L], pMaj = nat.majority[MAJ_KEY[L]];
  const who = PARTY[L].name, now = mode === "nowcast" || mode == null;
  const clause = pMaj < 0.2 ? "probably short of a majority" : pMaj < 0.4 ? "more likely short of a majority than not" : "with a majority about as likely as not";
  if (pMaj >= 0.9) return now ? `${who} would win a majority` : `${who} is very likely to win a majority`;
  if (pMaj >= 0.6) return now ? `${who} would probably win a majority` : `${who} is likely to win a majority`;
  if (pMost >= 0.9) return now ? `${who} would win the most seats, ${clause}` : `${who} is very likely to win the most seats, ${clause}`;
  if (pMost >= 0.6) return now ? `${who} would probably win the most seats, ${clause}` : `${who} is favoured to win the most seats, ${clause}`;
  // no clear leader: name a two-party race when the top two share nearly every simulation (each at least
  // 30%, together 80%+), then say how likely a hung parliament is (60% / 90%; 40-60% "as likely as not")
  const B = cands[1], pB = nat.mostSeats[B], noMaj = nat.majority.noMajority;
  const race = pMost >= 0.3 && pB >= 0.3 && pMost + pB >= 0.8 ? `${who} and ${PARTY[B].lower} are close on seats` : "No party is clearly ahead on seats";
  const hung = noMaj >= 0.9 ? ", and a hung parliament is very likely" : noMaj >= 0.6 ? ", and a hung parliament is likely" : noMaj >= 0.4 ? ", and a hung parliament is about as likely as not" : "";
  return race + hung;
}

/* "In 20,000 simulated elections held on the polls to 27 October, Labor wins 71 seats on average (51 to 90
   in nine of ten), One Nation 36 (13 to 63) and the Coalition 31 (15 to 48). Labor reaches the 76 seats
   needed to govern alone in 38% of them." - the three parties in order of expected seats; independents and
   the Greens are named with them when they average ten seats or more */
function dek(res, mode, asOf) {
  const nat = res.national, d = nat.seatDistribution, e = nat.expectedSeats;
  const [a, ...two] = ["alp", "on", "lnp"].sort((x, y) => e[y] - e[x]);
  const others = [...two, ...["member", "grn"].filter((k) => (e[k] || 0) >= 10)].sort((x, y) => e[y] - e[x]);
  const sims = res.meta.draws.toLocaleString("en-AU");
  const lead = mode === "forecast"
    ? `Projected to election day, ${sims} simulated elections from the polls to ${shortDate(asOf)} give ${PARTY[a].lower}`
    : mode === "vic"
      ? `On the polls to ${shortDate(asOf)}, ${sims} simulated elections for ${shortDate(res.meta.election)} give ${PARTY[a].lower}`
      : `In ${sims} simulated elections held on the polls to ${shortDate(asOf)}, ${PARTY[a].lower} wins`;
  const rest = (k) => `${PARTY[k].lower} ${Math.round(e[k])} (${d[k].p05} to ${d[k].p95})`;
  const pMaj = nat.majority[MAJ_KEY[a]];
  const list = others.map(rest);
  return `${lead} ${Math.round(e[a])} seats on average (${d[a].p05} to ${d[a].p95} in nine of ten), ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}. `
    + `${PARTY[a].name} reaches the ${majOf(res)} seats needed to govern alone in ${pct(pMaj)} of them.`;
}

/* the run's provenance line under the dek */
function headNote(res, mode, asOf) {
  if (mode === "vic") return `Polls to <b>${longDate(asOf.pollsTo)}</b> (the /vic/ page’s trend through ${asOf.polls} polls this term) · model run ${longDate(asOf.modelRun)} · `
    + `${res.meta.draws.toLocaleString("en-AU")} simulated elections · election ${res.meta.electionLabel} · <a href="#vic-how">how it works</a>`;
  const n = asOf.waves ? asOf.waves.length : null;
  return `Polls to <b>${longDate(asOf.pollsTo)}</b>${n ? ` (${n} polls since ${shortDate(asOf.windowFrom)})` : ""} · model run ${longDate(asOf.modelRun)} · `
    + `${res.meta.draws.toLocaleString("en-AU")} simulated elections`
    + (mode === "forecast" ? " · election day taken as about 17 months away, with minor parties giving back 0–60% of their rise since 2025" : "")
    + ` · <a href="#how">how it works</a>`;
}

/* mutually exclusive outcomes: who wins the most seats, and whether alone */
function outcomes(res) {
  const m = res.national.majority, ms = res.national.mostSeats, seg = [];
  const add = (tone, soft, p, label) => { if (p > 0.0005) seg.push({ tone, soft, p, label }); };
  add("alp", false, m.alp, "Labor majority");
  add("alp", true, Math.max(0, ms.alp - m.alp), "Labor most seats, no majority");
  add("on", false, m.on, "One Nation majority");
  add("on", true, Math.max(0, ms.on - m.on), "One Nation most seats, no majority");
  add("lnp", false, m.coalition, "Coalition majority");
  add("lnp", true, Math.max(0, ms.lnp - m.coalition), "Coalition most seats, no majority");
  const rest = 1 - seg.reduce((a, s) => a + s.p, 0);
  if (rest > 0.0005) seg.push({ tone: "oth", soft: true, p: rest, label: "Another party first, or a tie" });
  return seg;
}
function outcomesHTML(res) {
  const seg = outcomes(res);
  const bar = seg.map((s) => `<span class="t-${s.tone}${s.soft ? " soft" : ""}" style="flex-grow:${(1000 * s.p).toFixed(1)}" title="${esc(s.label)}: ${pctShort(s.p)}"></span>`).join("");
  const leg = seg.filter((s) => s.p >= 0.005).map((s) => `<span class="it t-${s.tone}"><span class="sw${s.soft ? " soft" : ""}"></span>${esc(s.label)} <b>${pctShort(s.p)}</b></span>`).join("");
  return `<div class="md-obar" role="img" aria-label="${esc(seg.map((s) => s.label + " " + pctShort(s.p)).join(", "))}">${bar}</div><div class="md-olegend">${leg}</div>`;
}

/* the seat ranges: per party the middle half and nine-tenths of the simulations, the median and the
   average; `compare` (another run) leaves a grey tick at its median and a signed change beside the number */
const RANGE_PARTIES = ["alp", "on", "lnp", "member", "grn"];
function axisMaxFor(...runs) {
  const rs = runs.filter(Boolean);
  const top = Math.max(Math.round(totalOf(rs[0]) * 2 / 3), ...rs.flatMap((r) => RANGE_PARTIES.map((k) => r.national.seatDistribution[k].p95)));
  return Math.ceil((top + 4) / 25) * 25;
}
function rangesHTML(res, { compare = null, axisMax = axisMaxFor(res, compare), labels = true } = {}) {
  const nat = res.national, X = (v) => `${(100 * v / axisMax).toFixed(2)}%`, M = majOf(res);
  const order = RANGE_PARTIES.slice().sort((a, b) => nat.expectedSeats[b] - nat.expectedSeats[a]);
  const rows = order.map((k, i) => {
    const d = nat.seatDistribution[k], e = nat.expectedSeats[k];
    const ms = nat.mostSeats[k] ?? 0;
    const sub = k === "alp" || k === "on" || k === "lnp" ? `most seats ${pctShort(ms)}` : "";
    // against the official run: a short signed badge beside the average (the key under the explorer's
    // chart says what it is); written out in full for screen readers in the summary paragraph
    let delta = "";
    if (compare) { const dv = Math.round(e) - Math.round(compare.national.expectedSeats[k]); delta = `<span class="md-delta${dv === 0 ? " zero" : ""}" title="${dv === 0 ? "The same as" : `${Math.abs(dv)} ${dv > 0 ? "more" : "fewer"} than`} the official run’s average">${dv > 0 ? "+" : dv < 0 ? "−" : "±"}${Math.abs(dv)}</span>`; }
    const ghost = compare ? `<span class="ghost" style="left:${X(compare.national.seatDistribution[k].p50)}"></span>` : "";
    return `<div class="md-rrow t-${k}">
      <div class="md-rname"><span class="dot"></span>${esc(PARTY[k].name)}${labels && sub ? ` <small>${sub}</small>` : ""}</div>
      <div class="md-rtrack" aria-hidden="true"><span class="majl" style="left:${X(M)}"></span>${i === 0 ? `<span class="md-maj-lab" style="left:${X(M)}">${M} for a majority</span>` : ""}<span class="b90" style="left:${X(d.p05)};width:${X(Math.max(0.6, d.p95 - d.p05))}"></span><span class="b50" style="left:${X(d.p25)};width:${X(Math.max(0.6, d.p75 - d.p25))}"></span>${ghost}<span class="med" style="left:${X(d.p50)}"></span></div>
      <div class="md-rnum">${Math.round(e)}${delta}<small>${d.p05}–${d.p95}</small></div>
    </div>`;
  }).join("");
  const ticks = [0, 25, 50, 75, 100, 125, 150].filter((t) => t <= axisMax).map((t) => `<span style="left:${X(t)}">${t}</span>`).join("");
  const srDelta = (k) => { if (!compare) return ""; const dv = Math.round(nat.expectedSeats[k]) - Math.round(compare.national.expectedSeats[k]); return dv === 0 ? " (the same as the official run)" : ` (${Math.abs(dv)} ${dv > 0 ? "more" : "fewer"} than the official run)`; };
  const sr = order.map((k) => `${PARTY[k].name} ${Math.round(nat.expectedSeats[k])} seats on average${srDelta(k)}, ${nat.seatDistribution[k].p05} to ${nat.seatDistribution[k].p95} in nine simulations of ten`).join("; ");
  const key = compare ? `<p class="md-ckey" aria-hidden="true"><span class="i"><span class="md-delta">+3</span>change in the average on the official run</span><span class="i"><span class="kghost"></span>the official run’s median</span></p>` : "";
  return `<p class="md-sr">${esc(sr)}.</p>${rows}<div class="md-raxis" aria-hidden="true"><span></span><div class="ax">${ticks}</div><span></span></div>${key}`;
}
const RANGE_KEY = `<div class="md-rkey"><span><i></i>nine simulations in ten</span><span><i class="k50"></i>the middle half</span><span><i class="kmed"></i>the median</span><span>The large figure is the average; the small range is the nine-in-ten band.</span></div>`;

/* the whole static head, written into model/index.html by assemble.mjs */
function staticHead(res, mode, asOf) {
  return `  <h2 class="sh-hed" id="md-hed">${esc(headline(res, mode))}</h2>
  <p class="sh-dek" id="md-dek">${esc(dek(res, mode, asOf.pollsTo))}</p>
  <p class="md-head-note" id="md-note">${headNote(res, mode, asOf)}</p>
  <div class="md-outcomes" id="md-outcomes">${outcomesHTML(res)}</div>
  <div class="md-ranges" id="md-ranges">${rangesHTML(res)}</div>
  ${RANGE_KEY}`;
}

/* app-1-base.js: helpers, the page's state, data loading, the mode switch and the head.
   (assemble.mjs puts URLS and views.mjs's functions - headline, dek, headNote, outcomesHTML,
   rangesHTML, axisMaxFor, PARTY, pct, pctShort, longDate, shortDate, esc - ahead of this part.) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NS = "http://www.w3.org/2000/svg";
const BUCKET = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" || g === "onp" ? "on" : g === "grn" ? "grn"
  : String(g).startsWith("member") || g === "ind-declared" || g === "ind" ? "member" : "oth");
const BUCKETS = ["alp", "lnp", "on", "grn", "member", "oth"];
const GROUP_NAME = { alp: "Labor", lp: "Liberal", np: "Nationals", lnp: "LNP", clp: "CLP", on: "One Nation", grn: "Greens", oth: "Others", "ind-declared": "Independent", ind: "Independent" };
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const P5 = ["alp", "lnp", "on", "grn", "oth"];
const P5_NAME = { alp: "Labor", lnp: "Coalition", on: "One Nation", grn: "Greens", oth: "Others" };
const P5_TONE = { alp: "alp", lnp: "lnp", on: "on", grn: "grn", oth: "oth" };
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const groupName = (g, seat) => {
  if (String(g).startsWith("member")) { const c = seat && seat.cands.find((x) => x.group === g); return c ? c.label : "Independent"; }
  return GROUP_NAME[g] || g;
};
const pairName = (key, seat) => key.split("|").map((g) => groupName(g, seat)).join(" v ");
const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const svg = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };
const debounce = (f, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

const STATE = { jur: "fed", mode: "nowcast", res: {}, inputs: null, vicInputs: null, evidence: null, bySeat: null };
/* the election on show: the federal run in its mode, or the Victorian run (one mode: the election weeks
   away, on today's polls); INP() its inputs, VMODE() the mode the copy rules speak in, BASE() its base
   election and House */
const run = () => (STATE.jur === "vic" ? STATE.res.vic : STATE.res[STATE.mode]);
const INP = () => (STATE.jur === "vic" ? STATE.vicInputs : STATE.inputs);
const VMODE = () => (STATE.jur === "vic" ? "vic" : STATE.mode);
const BASE = () => (STATE.jur === "vic" ? { year: 2022, chamber: "Assembly", seat: "district" } : { year: 2025, chamber: "House", seat: "seat" });

/* join each seat's run results with its skeleton (2025 field, flows, holder) */
function seatsJoined() {
  const r = run(), inp = new Map(INP().seats.map((s) => [s.name, s]));
  return r.seats.map((s) => {
    const k = inp.get(s.name);
    const byB = {}; for (const [g, p] of Object.entries(s.win)) byB[BUCKET(g)] = (byB[BUCKET(g)] || 0) + p;
    const lead = Object.entries(byB).sort((a, b) => b[1] - a[1])[0];
    const topPair = Object.entries(s.finalPairs)[0];
    return { ...s, seat: k, byB, lead: { b: lead[0], p: lead[1] }, topPair: topPair ? { key: topPair[0], p: topPair[1], share: s.pairShare[topPair[0]] } : null,
      heldB: heldBucket(k) };
  });
}
/* who holds the seat, as the table counts it: a sitting member standing again as their own candidate is
   the holder even when elected for a one-member party (Sharkie's Centre Alliance and Katter's KAP are
   "others" in the 2025 result), so their re-election is not a change of hands */
function heldBucket(k) {
  const h = k.held || {};
  if (h.member && k.cands.some((c) => String(c.group).startsWith("member") && c.label === h.member)) return "member";
  return BUCKET(h.group);
}
function heldLabel(k) {
  const h = k.held || {};
  if (GROUP_NAME[h.group] && heldBucket(k) !== "member") return GROUP_NAME[h.group];
  if (!h.party || /^(IND|Independent)$/i.test(h.party)) return "Independent";
  const ab = /\(([A-Z]{2,6})\)/.exec(h.party);
  return ab ? ab[1] : h.party;
}

function renderHead() {
  const r = run(), m = VMODE(), a = INP().asOf;
  $("#md-hed").textContent = headline(r, m);
  $("#md-dek").textContent = dek(r, m, a.pollsTo);
  $("#md-note").innerHTML = headNote(r, m, a);
  $("#md-outcomes").innerHTML = outcomesHTML(r);
  $("#md-ranges").innerHTML = rangesHTML(r);
  const days = m === "vic" ? Math.round((Date.parse(a.election) - Date.parse(new Date().toISOString().slice(0, 10))) / 864e5) : 0;
  $("#md-meta").textContent = m === "vic" ? `Victoria’s Legislative Assembly, 88 seats${days > 1 ? `, ${days} days before the election` : days === 1 ? ", the day before the election" : days === 0 ? ", on election day" : ", as the model stood before the election"}`
    : m === "forecast" ? "The 2028 House on election day, about 17 months away" : "The 2028 House if an election were held now";
  $(".md-modes").hidden = m === "vic";
  for (const b of $$(".md-jur [data-jur]")) b.setAttribute("aria-pressed", String(b.dataset.jur === STATE.jur));
}

function setMode(mode, { scroll = false } = {}) {
  if (mode !== "nowcast" && mode !== "forecast") mode = "nowcast";
  STATE.mode = mode;
  for (const b of $$(".md-modes .rd-tab")) b.setAttribute("aria-selected", String(b.dataset.mode === mode));
  renderHead(); renderDist(); renderSeats(); EX.onMode();
  writeHash();
  if (scroll) $("#sh-content").scrollIntoView({ block: "start" });
}

/* app-2-dist.js: how many seats each party wins across the simulations - the run's histograms, lightly
   smoothed for the eye (the tooltip reads the raw counts), the majority line (76; Victoria 45), a reading of every
   seat count under the pointer. The Greens and independents sit at small counts and in the head's
   ranges instead, so the three parties that can lead are drawn here. */
const DIST_PARTIES = ["alp", "on", "lnp"];
function renderDist() {
  const host = $("#dist"), r = run(), H = r.national.histogram, draws = r.meta.draws;
  $("#dist-meta").textContent = `Share of the ${draws.toLocaleString("en-AU")} simulated elections in which each party wins each number of seats`;
  const M = majOf(r), TOT = totalOf(r);
  let top = Math.round(TOT * 2 / 3);
  for (const k of DIST_PARTIES) for (let x = H[k].length - 1; x >= 0; x--) if (H[k][x] / draws >= 0.0005) { top = Math.max(top, x); break; }
  const xmax = Math.ceil((top + 3) / 10) * 10;
  const ser = DIST_PARTIES.map((k) => {
    const v = Array.from({ length: xmax + 1 }, (_, x) => (H[k][x] || 0) / draws);
    const sm = v.map((_, x) => { let s = 0, w = 0; for (let d = -2; d <= 2; d++) { const xx = x + d; if (xx < 0 || xx > xmax) continue; const ww = 3 - Math.abs(d); s += ww * v[xx]; w += ww; } return s / w; });
    const cum = []; let c = 0; for (let x = xmax; x >= 0; x--) { c += v[x]; cum[x] = c; }
    return { k, v, sm, cum };
  });
  const W = Math.max(300, host.clientWidth), narrow = W < 560, Hh = narrow ? 210 : 250;
  const m = { l: 34, r: 8, t: 22, b: 26 };
  const ymax = Math.max(...ser.flatMap((s) => s.sm)) * 1.12;
  const X = (x) => m.l + (W - m.l - m.r) * x / xmax, Y = (y) => m.t + (Hh - m.t - m.b) * (1 - y / ymax);
  host.textContent = "";
  const s = svg("svg", { viewBox: `0 0 ${W} ${Hh}`, role: "img", "aria-label": DIST_PARTIES.map((k) => `${PARTY[k].name}: most often ${ser.find((q) => q.k === k).v.indexOf(Math.max(...ser.find((q) => q.k === k).v))} seats`).join("; ") }, host);
  const g = svg("g", { class: "grid" }, s);
  const step = ymax > 0.06 ? 0.02 : ymax > 0.03 ? 0.01 : 0.005;
  for (let y = 0; y <= ymax; y += step) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(y), y2: Y(y) }, g); const t = svg("text", { x: m.l - 6, y: Y(y) + 4, "text-anchor": "end", class: "lab" }, s); t.textContent = `${Math.round(y * 1000) / 10}%`; }
  const ax = svg("g", { class: "axis" }, s);
  for (let x = 0; x <= xmax; x += xmax > 100 ? 25 : 10) { const t = svg("text", { x: X(x), y: Hh - 6, "text-anchor": "middle" }, ax); t.textContent = x; }
  svg("line", { x1: X(M), x2: X(M), y1: m.t - 8, y2: Hh - m.b, class: "maj" }, s);
  const ml = svg("text", { x: X(M) + 5, y: m.t - 10, class: "lab" }, s); ml.textContent = `${M} for a majority`;
  const labs = [];
  for (const q of ser) {
    const pts = q.sm.map((y, x) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
    const gp = svg("g", { class: `t-${q.k}` }, s);
    svg("path", { class: "ar", d: `M${X(0)},${Y(0)}L${pts.join("L")}L${X(xmax)},${Y(0)}Z` }, gp);
    svg("path", { class: "ln", d: `M${pts.join("L")}` }, gp);
    const peak = q.sm.indexOf(Math.max(...q.sm));
    const lab = svg("text", { x: X(peak), y: Y(q.sm[peak]) - 7, "text-anchor": "middle", class: "plab" }, gp); lab.textContent = PARTY[q.k].name;
    labs.push({ lab, x: X(peak), y: Y(q.sm[peak]) - 7, w: lab.getComputedTextLength ? lab.getComputedTextLength() : 7 * PARTY[q.k].name.length });
  }
  // peaks that sit together (Victoria: Labor and the Coalition) would print one name over the other: the
  // left one ends at its peak, the right one starts there, and a pair still touching steps up a line
  labs.sort((a, b) => a.x - b.x);
  for (let i = 1; i < labs.length; i++) {
    const A = labs[i - 1], B = labs[i];
    if (Math.abs(A.y - B.y) < 14 && Math.abs(A.x - B.x) < (A.w + B.w) / 2 + 6) {
      A.lab.setAttribute("text-anchor", "end"); A.lab.setAttribute("x", A.x - 3);
      B.lab.setAttribute("text-anchor", "start"); B.lab.setAttribute("x", B.x + 3);
      if (Math.abs(A.x - B.x) < 6) { const up = Math.min(A.y, B.y) - 14; (A.y <= B.y ? B : A).lab.setAttribute("y", Math.max(12, up)); }
    }
  }
  const guide = svg("line", { class: "guide", y1: m.t, y2: Hh - m.b, visibility: "hidden" }, s);
  const tip = document.createElement("div"); tip.className = "md-tip"; tip.hidden = true; host.appendChild(tip);
  const hit = svg("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: Hh - m.b, fill: "transparent" }, s);
  const move = (ev) => {
    const box = s.getBoundingClientRect(), px = (ev.clientX - box.left) * W / box.width;
    const x = clamp(Math.round((px - m.l) / (W - m.l - m.r) * xmax), 0, xmax);
    guide.setAttribute("x1", X(x)); guide.setAttribute("x2", X(x)); guide.setAttribute("visibility", "visible");
    tip.innerHTML = `<div class="h">${x} seats</div>` + ser.map((q) => `<div class="r t-${q.k}"><span class="dot"></span>${PARTY[q.k].name} wins exactly ${x}<b>${(100 * q.v[x]).toFixed(1)}%</b></div>`).join("")
      + `<div class="r" style="margin-top:4px;color:var(--ink-3)">${x} or more: ${ser.map((q) => `${PARTY[q.k].short} ${pctShort(q.cum[x])}`).join(" · ")}</div>`;
    tip.hidden = false;
    const tx = (X(x) / W) * box.width, tw = tip.offsetWidth;
    tip.style.left = `${clamp(tx + 14 > box.width - tw ? tx - tw - 14 : tx + 14, 0, Math.max(0, box.width - tw))}px`;
    tip.style.top = "8px";
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { tip.hidden = true; guide.setAttribute("visibility", "hidden"); });
}

/* app-3-seats.js: every seat - who wins it how often, the contest it most often comes down to, the
   average two-candidate result in that contest - with a card per seat: first preferences 2025 v the
   simulations' average, every outcome, and the preferences the seat's own Senate ballots give. */
const SEATS = { filter: "close", st: null, q: "", sort: null, shown: 20, open: new Set() };
const FILTERS = [["close", "Closest"], ["flip", "Changing hands"], ["all", "All seats"]];
function seatList() {
  let L = seatsJoined();
  if (SEATS.st && STATE.jur !== "vic") L = L.filter((s) => s.state === SEATS.st);
  const q = SEATS.q.trim().toLowerCase();
  if (q) L = L.filter((s) => s.name.toLowerCase().includes(q) || (s.seat.held.member || "").toLowerCase().includes(q));
  if (SEATS.filter === "flip") L = L.filter((s) => s.lead.b !== s.heldB);
  const sort = SEATS.sort || (SEATS.filter === "all" ? { k: "name", dir: 1 } : { k: "close", dir: 1 });
  const key = { name: (s) => s.name, state: (s) => STATES.indexOf(s.state) * 1000 + s.name.charCodeAt(0), close: (s) => s.lead.p, lead: (s) => -s.lead.p, contest: (s) => s.topPair ? s.topPair.key : "" }[sort.k];
  L.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || (a.name < b.name ? -1 : 1); });
  return L;
}
function pbarHTML(s) {
  return `<span class="pbar" aria-hidden="true">${BUCKETS.filter((b) => (s.byB[b] || 0) > 0.002).map((b) => `<span class="t-${b}" style="width:${(100 * s.byB[b]).toFixed(1)}%"></span>`).join("")}</span>`;
}
function tcpText(s) {
  if (!s.topPair) return "";
  const [a, b] = s.topPair.key.split("|"), sh = s.topPair.share;
  const [w, v] = sh >= 0.5 ? [a, sh] : [b, 1 - sh];
  return `${esc(groupName(w, s.seat))} ${(100 * v).toFixed(1)}`;
}
function renderSeats() {
  const tabs = $("#seat-filters");
  if (!tabs.childElementCount) {
    tabs.innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="rd-tab" role="tab" data-f="${k}" aria-selected="${k === SEATS.filter}"><span class="tw" data-t="${l}">${l}</span></button>`).join("");
    tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; SEATS.filter = b.dataset.f; SEATS.sort = null; SEATS.shown = 20; for (const x of $$("[data-f]", tabs)) x.setAttribute("aria-selected", String(x === b)); renderSeats(); });
    $("#seat-states").innerHTML = [["", "All"], ...STATES.map((s) => [s, s])].map(([k, l]) => `<button type="button" class="md-chip" data-st="${k}" aria-pressed="${(SEATS.st || "") === k}">${l}</button>`).join("");
    $("#seat-states").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (!b) return; SEATS.st = b.dataset.st || null; SEATS.shown = 20; for (const x of $$("[data-st]")) x.setAttribute("aria-pressed", String(x === b)); renderSeats(); });
    $("#seat-q").addEventListener("input", debounce((e) => { SEATS.q = e.target.value; SEATS.shown = 20; renderSeats(); }, 120));
    $("#seat-table").addEventListener("click", (e) => {
      const sb = e.target.closest("th button[data-sort]");
      if (sb) { const k = sb.dataset.sort, cur = SEATS.sort; SEATS.sort = { k, dir: cur && cur.k === k ? -cur.dir : 1 }; renderSeats(); return; }
      const tr = e.target.closest("tr.row"); if (!tr) return;
      const n = tr.dataset.seat; SEATS.open.has(n) ? SEATS.open.delete(n) : SEATS.open.add(n); renderSeats();
    });
    $("#seat-table").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.row")) { e.preventDefault(); e.target.click(); } });
    $("#seat-more").addEventListener("click", (e) => { if (e.target.closest("[data-more]")) { SEATS.shown = 1e9; renderSeats(); } });
  }
  const L = seatList(), shown = L.slice(0, SEATS.shown), r = run();
  const flips = seatsJoined().filter((s) => s.lead.b !== s.heldB).length, toss = seatsJoined().filter((s) => s.lead.p < 0.6).length, vic = STATE.jur === "vic";
  $("#seat-states").hidden = vic;
  $("#seats-meta").textContent = `${toss} ${vic ? "districts" : "seats"} where no party wins more than six simulations in ten; ${flips} where the likeliest winner is not the party that holds it now`;
  const sortBtn = (k, label) => { const cur = SEATS.sort; const on = cur && cur.k === k; return `<button type="button" data-sort="${k}"${on ? ` aria-sort="${cur.dir > 0 ? "ascending" : "descending"}"` : ""}>${label}</button>`; };
  const head = `<thead><tr><th scope="col">${sortBtn("name", "Seat")}</th><th scope="col" class="c-held">Held now</th><th scope="col">${sortBtn("lead", "Chance of winning")}</th><th scope="col" class="c-ct">${sortBtn("contest", "Likeliest contest")}</th><th scope="col" class="c-tcp">Average two-candidate</th></tr></thead>`;
  const rows = shown.map((s) => {
    const open = SEATS.open.has(s.name);
    const flip = s.lead.b !== s.heldB ? `<span class="flip">from ${esc(PARTY[s.heldB].short)}</span>` : "";
    const tr = `<tr class="row" tabindex="0" data-seat="${esc(s.name)}" aria-expanded="${open}">
      <td><span class="nm">${esc(s.name)}</span>${STATE.jur === "vic" ? "" : `<span class="st">${s.state}</span>`}</td>
      <td class="c-held"><span class="held t-${s.heldB}"><span class="dot"></span>${esc(heldLabel(s.seat))}</span></td>
      <td><div class="md-chance">${pbarHTML(s)}<span class="lead">${esc(PARTY[s.lead.b].name)} <small>${pctShort(s.lead.p)}</small></span>${flip}</div></td>
      <td class="c-ct"><span class="ct">${s.topPair ? esc(pairName(s.topPair.key, s.seat)) + ` <small>${pctShort(s.topPair.p)}</small>` : ""}</span></td>
      <td class="c-tcp">${tcpText(s)}</td></tr>`;
    return tr + (open ? `<tr class="det"><td colspan="5">${seatCard(s)}</td></tr>` : "");
  }).join("");
  $("#seat-table").innerHTML = head + `<tbody>${rows || `<tr><td colspan="5" class="md-fine">No seat matches.</td></tr>`}</tbody>`;
  $("#seat-more").innerHTML = L.length > shown.length ? `<button type="button" class="md-btn" data-more>Show all ${L.length}</button><span>${shown.length} of ${L.length} shown</span>` : `<span>${L.length} seat${L.length === 1 ? "" : "s"}</span>`;
}
function seatCard(s) {
  const k = s.seat;
  const base = {}; for (const c of k.cands) base[c.group] = (base[c.group] || 0) + c.base;
  const groups = Object.keys(s.primary).sort((a, b) => (s.primary[b] || 0) - (s.primary[a] || 0));
  const top = Math.max(...groups.map((g) => Math.max(s.primary[g] || 0, base[g] || 0)), 0.05);
  const prim = groups.filter((g) => (s.primary[g] || 0) >= 0.005 || (base[g] || 0) >= 0.005).map((g) => `<span class="t-${BUCKET(g)}">${esc(groupName(g, k))}</span><span class="bars t-${BUCKET(g)}"><i style="width:${(100 * (base[g] || 0) / top).toFixed(1)}%"></i><b style="width:${(100 * (s.primary[g] || 0) / top).toFixed(1)}%"></b></span><span class="v">${(100 * (s.primary[g] || 0)).toFixed(1)}</span>`).join("");
  const wins = BUCKETS.filter((b) => (s.byB[b] || 0) >= 0.005).sort((a, b) => s.byB[b] - s.byB[a]).map((b) => `<span>${esc(PARTY[b].name)}</span><b>${pctShort(s.byB[b])}</b>`).join("");
  const pairs = Object.entries(s.finalPairs).filter(([, p]) => p >= 0.01).slice(0, 5).map(([pk, p]) => {
    const [a] = pk.split("|"), sh = s.pairShare[pk];
    return `<span>${esc(pairName(pk, k))} <span class="md-fine">(${esc(groupName(a, k))} ${(100 * sh).toFixed(1)} on average)</span></span><b>${pctShort(p)}</b>`;
  }).join("");
  const f = k.flows || {}, fl = [
    ["Coalition voters putting Labor ahead of One Nation", f.coalLaborOverOn], ["Labor voters putting the Coalition ahead of One Nation", f.laborCoalitionOverOn],
    ["One Nation voters putting Labor ahead of the Coalition", f.onLaborOverCoalition], ["Greens voters putting Labor ahead of the Coalition", f.greensLaborOverCoalition],
  ].filter(([, v]) => v != null).map(([l, v]) => `<span>${l}</span><b>${Math.round(100 * v)}%</b>`).join("");
  const t = k.tcp2025 || k.tcp2022, tot = t ? t[0].votes + t[1].votes : 0, Y = BASE().year, vic = STATE.jur === "vic";
  const res25 = t ? `${esc(t[0].name)} (${esc(t[0].party)}) ${(100 * t[0].votes / tot).toFixed(1)}, ${esc(t[1].name)} (${esc(t[1].party)}) ${(100 * t[1].votes / tot).toFixed(1)}` : "";
  const added = k.cands.some((c) => c.added);
  // Victoria: where each candidate's thin bar comes from, written from the candidates' own sources
  const nSrc = (x) => k.cands.filter((c) => c.src === x).length, plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const thin = vic ? `Thin bar: where each candidate starts. The 2022 count here where the party or the candidate stood; One Nation from its federal 2025 vote at the nearest polling places${nSrc("council") ? `; ${plural(nSrc("council"), "candidate")} from their party’s 2022 upper-house vote here` : ""}${nSrc("median") ? `; ${plural(nSrc("median"), "candidate")} new to the ballot from the 2022 median` : ""}`
    : `Thin bar: ${Y}${added ? " (One Nation, which did not stand here in 2022: its federal 2025 vote at the nearest polling places)" : ""}`;
  const notes = vic && k.notes && k.notes.length ? ` ${k.notes.map(esc).join(" ")}` : "";
  // a seat whose holder changed since the count it starts from says so: Victoria's by-elections and defections
  // since 2022; federally a by-election, a member who changed party (and whether they stand again), a retirement
  const h = k.held || {}, surname = (n) => esc(String(n || "").split(" ").pop());
  const changed = vic ? (k.won2022 && BUCKET(k.won2022.group) !== BUCKET(h.group) ? ` Won by ${esc(k.won2022.name)} (${esc(k.won2022.party)}) in 2022; held now by ${esc(h.member)} (${h.party === "L/N" ? "Liberal" : h.party === "IND" ? "independent" : esc(h.party)}). ` : "")
    : h.how === "by-election" && k.won2025 ? ` Won by ${esc(k.won2025.name)} (${esc(k.won2025.party)}) in 2025; held by ${esc(h.member)} (${esc(h.party)}) since the by-election of ${longDate(h.since)}.`
    : h.how === "defection" && k.won2025 ? ` ${esc(h.member)} won it for ${esc(String(k.won2025.party).replace(/^The /, "the "))} in 2025 and has sat for ${esc(h.party)} since ${longDate(h.since)}${h.recontests === true ? ", and stands here again" : h.recontests === false ? ", and is not standing here again" : `. Whether ${surname(h.member)} stands here again is not settled, and the model assumes neither`}.`
    : h.recontests === false ? ` ${esc(h.member)} is not standing again.` : "";
  // the seat's independent (federal): a sitting member on sitting independents' record, or the challenge drawn from
  // the record, said with its own table's chances (model-sim draws one of the window's elections at a time)
  const T = !vic && INP().build.ind, chal = T && k.cands.find((c) => c.slot != null), sitter = !vic && k.cands.find((c) => c.free && c.slot == null);
  const chance = (t, lo) => { let p = 0; t.lv.forEach((lv, y) => lv.forEach((l, i) => { if (l >= lo) p += t.cum[y][i] - (i ? t.cum[y][i - 1] : 0); })); return p / t.lv.length; };
  let indNote = "";
  if (chal) {
    const t = T.tables[chal.slot], yrs = T.years, w = chal.was;
    indNote = chal.base > 0.001 && w ? ` Independent: nobody is nominated. ${esc(w.name)} polled ${(100 * w.share).toFixed(1)}% here in 2025, and the seat’s independent is drawn from what happened next in seats where one had polled about the same at the ${yrs[0]}–${yrs[yrs.length - 1]} elections: 20% or more in ${pctShort(chance(t, 0.2))} of simulated elections, nobody standing in ${pctShort(1 - chance(t, 0.0001))}.`
      : ` Independent: nobody is nominated${w ? ` (${esc(w.name)} polled ${(100 * w.share).toFixed(1)}% here in 2025)` : ""}. A challenger of 10% or more appears in ${pctShort(chance(t, 0.1))} of simulated elections, as often as one appeared in seats like this at the ${yrs[0]}–${yrs[yrs.length - 1]} elections.`;
  } else if (sitter) indNote = ` ${esc(sitter.label)} moves by sitting independents’ own record and not by the vote for others.`;
  return `<div class="md-card">${whyHTML(s)}
    <div><h4>First preferences</h4><div class="md-prim">${prim}</div><p class="md-fine" style="margin-top:8px">${thin}. Thick bar and figure: the simulations’ average${vic ? " on 28 November" : STATE.mode === "forecast" ? " on election day" : " now"}.${indNote}</p></div>
    <div><h4>How often each wins</h4><div class="md-kv">${wins}</div><h4 style="margin-top:14px">The contest it comes down to</h4><div class="md-kv">${pairs}</div></div>
    <div><h4>Preferences here</h4><div class="md-kv">${fl}</div><p class="md-fine" style="margin-top:8px">${vic ? "From the 2025 Senate ballots cast at the federal polling places nearest this district’s own" : "From this seat’s 2025 Senate ballots"}, adjusted to how ${vic ? "lower-house voters differ, then set to Victoria’s levels and this district’s how-to-vote cards" : "House voters differ, with the national levels of the Coalition’s and One Nation’s choices set to the site’s flow tables"}. The ${Y} count: ${res25}.${changed}${notes}</p></div>
  </div>`;
}
/* why a changing-hands seat changes hands: the central projection's margin between the winner's candidate
   and the holder's, split over the model's inputs (.build/model/reasons.mjs, Shapley values: each input's
   average effect over every order the changes could be made in, so they add up to the whole turn), the
   three that move it most toward the winner, the biggest working the other way, and how the count goes */
const ST_NAME = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "The ACT", NT: "The Northern Territory" };
const PKEY = (g) => (BUCKET(g) === "member" ? g : BUCKET(g));
const pts = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`;
const P5_THE = { alp: "Labor", lnp: "the Coalition", on: "One Nation", grn: "the Greens", oth: "others" };
const listPP = (vals) => vals.map((v, i) => [P5[i], v]).filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([p, v]) => `${P5_THE[p]} ${pts(v)}`).join(", ");
const votersOf = (k, seat) => (k === "member:challenge" ? "the independent’s voters" : String(k).startsWith("member") ? `${groupName(k, seat)}’s voters` : { alp: "Labor voters", lnp: "Coalition voters", on: "One Nation voters", grn: "Greens voters", oth: "Minor-party voters" }[k] || "Other voters");
const cap1 = (t) => t.replace(/^./, (c) => c.toUpperCase());
const poss = (n) => (/s$/.test(n) ? `${n}’` : `${n}’s`);
/* a candidate in running prose: the party (the Liberal, Labor) or the independent's name */
const WHO = { alp: "Labor", lp: "the Liberal", np: "the National", lnp: "the LNP", clp: "the CLP", on: "One Nation", grn: "the Green", oth: "another candidate" };
const whoOf = (g, seat) => (g === "member:challenge" ? "an independent" : esc(WHO[g] || groupName(g, seat)));
function whyHTML(s) {
  if (s.lead.b === s.heldB) return "";
  const R = STATE.reasons && STATE.reasons[STATE.jur === "vic" ? "vic" : STATE.mode];
  if (!R) return STATE.reasons === false ? "" : `<div class="md-why"><h4>Why it changes hands</h4><p class="md-fine">Loading…</p></div>`;
  const d = R.seats[s.name]; if (!d) return "";
  const k = s.seat, Y = BASE().year, vic = STATE.jur === "vic", when = STATE.mode === "forecast" && !vic ? "on election day" : "now";
  const S = INP().settings[vic ? "vic" : STATE.mode];
  const W = whoOf(d.w, k), H = whoOf(d.h, k);
  const nat = (i, name) => {
    const a = R.nat25[i], b = R.now[i], key = P5[i];
    const local = key === "oth" ? (free ? ["oth"] : k.cands.filter((c) => String(c.group).startsWith("member")).map((c) => c.group)) : [key];
    const loc = local.filter((g) => d.prim25[g] != null && d.primNow[g] != null).map((g) => `${key === "oth" ? (g === "oth" ? "minor candidates " : esc(groupName(g, k)) + " ") : ""}${d.prim25[g].toFixed(1)} to ${d.primNow[g].toFixed(1)}`).join("; ");
    return `${name.replace("%", vic ? "statewide" : "national")} ${b < a ? "falls" : "rises"} from ${a.toFixed(1)}% in ${Y} to ${b.toFixed(1)}% ${when}${loc ? ` (here ${loc})` : ""}`;
  };
  // the independents' own factor (federal): a sitting independent's record, or the challenge's central level
  const free = k.cands.some((c) => c.free), fInd = k.cands.filter((c) => c.free && d.prim25[c.group] != null && d.primNow[c.group] != null);
  const indTxt = () => { const c = fInd.find((x) => x.slot == null) || fInd[0]; if (!c) return "Independents’ own record";
    const a = d.prim25[c.group], b = d.primNow[c.group];
    return c.slot == null ? `${esc(c.label)}’s own vote, moved by sitting independents’ record and not by a national swing (${a.toFixed(1)} to ${b.toFixed(1)})`
      : `The seat’s independent challenge, drawn from the record: ${c.was && c.base > 0.001 ? `${esc(c.was.name)} polled ${a.toFixed(1)} in ${Y}, and the central projection has an independent on ${b.toFixed(1)}` : `the central projection has ${b >= 0.05 ? `an independent on ${b.toFixed(1)}` : "nobody standing"}`}`; };
  const adjC = k.cands.filter((c) => Math.abs(c.adj || 0) >= 0.005).sort((a, b) => Math.abs(b.adj) - Math.abs(a.adj)).slice(0, 2);
  const TXT = {
    alp: () => nat(0, "Labor’s % vote"), lnp: () => nat(1, "The Coalition’s % vote"), on: () => nat(2, "One Nation’s % vote"), grn: () => nat(3, "The Greens’ % vote"),
    oth: () => nat(4, free ? "The % vote for minor parties and independents" : k.cands.some((c) => c.isInd) ? "The % vote for other candidates, independents included," : "Other candidates’ % vote"),
    ind: indTxt,
    state: () => { const v = S.states && S.states[k.st]; const l = v ? listPP(v.dev) : ""; return `${poss(ST_NAME[k.st] || k.st)} polls against the ${vic ? "statewide" : "national"} swing${l ? `: ${l} points` : ""}`; },
    demo: () => { const l = k.demoPP ? listPP(k.demoPP) : ""; return `The seat’s age and gender mix${l ? `: ${l} points against the average seat` : ""}`; },
    terms: () => `${vic ? "Sitting members: a member standing again, and a member gone from a party’s ticket" : `Seat terms: the sitting member’s personal vote, defections and part of ${Y}’s surprise going back`}${adjC.length ? ` (${adjC.map((c) => `${esc(groupName(c.group, k))} ${c.adj > 0 ? "up" : "down"}`).join(", ")})` : ""}`,
    comp: () => `One Nation’s new voters’ preferences: people who have moved to it since ${Y} keep part of their old party’s preferences`,
  };
  const ph = Object.entries(d.phi).filter(([f]) => TXT[f]);
  const pro = ph.filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const con = ph.filter(([, v]) => v <= -0.5).sort((a, b) => a[1] - b[1])[0];
  const row = ([f, v], cls) => `<li${cls ? ` class="${cls}"` : ""}><span>${TXT[f]()}</span><b>${pts(v)}</b></li>`;
  // the count in the central projection
  const pw = d.primNow[PKEY(d.w)], phh = d.primNow[PKEY(d.h)];
  let cnt;
  if (d.meet) {
    const fav = (d.prefs || []).find(([, v]) => v > 0), agn = (d.prefs || []).find(([, v]) => v < 0);
    const pv = (x) => `${poss(votersOf(x, k))} preferences`;
    const prefTxt = fav ? `${pv(fav[0])} give ${W} ${fav[1].toFixed(1)} points more than ${H}${agn ? `, while ${votersOf(agn[0], k)} favour ${H} by ${(-agn[1]).toFixed(1)}` : ""}`
      : agn ? `${pv(agn[0])} favour ${H} by ${(-agn[1]).toFixed(1)} points` : "";
    const m = d.mNow, a = 50 + m / 2;
    cnt = `In the central projection ${W} ${pw >= phh ? "leads" : "trails"} ${H} on first preferences, ${pw.toFixed(1)} to ${phh.toFixed(1)}.${prefTxt ? ` ${cap1(prefTxt)}.` : ""} ${m >= 0 ? `${cap1(W)} wins about ${a.toFixed(0)}–${(100 - a).toFixed(0)}` : `${cap1(H)} holds on about ${(100 - a).toFixed(0)}–${a.toFixed(0)}, and ${W} wins more of the simulated elections`}.`;
  } else {
    const O = d.other ? esc(groupName(d.other, k)) : "the other finalist";
    cnt = `In the central projection ${H} (${phh.toFixed(1)} on first preferences) drops out of the count before the end${d.centralW === d.w ? `, and ${W} (${pw.toFixed(1)}) beats ${O}` : `; ${whoOf(d.centralW, k)} wins it there, ${W} in more of the simulated elections`}.`;
  }
  const turn = d.m25 < 0 ? `from ${H} ${Math.abs(d.m25).toFixed(1)} points ahead at ${Y}’s vote` : `from ${W} already ${d.m25.toFixed(1)} ahead at ${Y}’s vote (the model’s count of ${Y}’s vote with this election’s candidates, though ${H} ${vic || k.won2025 ? "holds the seat now" : `won the seat in ${Y}`})`;
  const end = d.mNow >= 0 ? `${W} ${d.mNow.toFixed(1)} ahead` : `${H} ${Math.abs(d.mNow).toFixed(1)} ahead`;
  return `<div class="md-why"><h4>Why it changes hands</h4>
    <ol>${pro.map((x) => row(x)).join("")}${con ? row(con, "con") : ""}</ol>
    <p>${cnt}</p>
    <p class="md-fine">The figures are points of the margin between ${W} and ${H}${con ? " (the grey row works the other way)" : ""}, ${turn} to ${end} in the central projection. Each one is that input’s average effect over every order the changes could be made in, so together they add up to the whole turn; the smallest are left out. <a href="${GH}.build/model/reasons.mjs">reasons.mjs</a></p>
  </div>`;
}

/* app-4-explore.js: "Try your own numbers" - the reader moves the national vote, the preference levers,
   the uncertainty and (on election day) the fade; a worker (model/js/worker.mjs) re-runs the official
   engine on those settings: the central projection at once, then 1,000 simulated elections. The model
   loads only when the section comes near (about 300 KB) or a shared scenario opens the page. */
const EX = (() => {
  const st = { vote: null, lev: {}, unc: true, pol: 1, seat: 1, flow: 1, fade: null, touched: false };
  const W = { w: null, ready: false, levels: null, busy: false, id: 0, pending: null };
  const DRAWS = 1000;
  // what switching a how-to-vote card's order is worth, in points: the federal view's stated assumption (a third
  // of voters follow the card); the Victorian view's measured reversal (inputs-vic.json evidence.cards)
  const cardEv = () => (STATE.jur === "vic" ? STATE.vicInputs && STATE.vicInputs.evidence.cards : STATE.evidence && STATE.evidence.card);
  const cardPts = () => (cardEv() ? Math.round(100 * (cardEv().with - cardEv().against)) : 35);
  const LEV = [
    ["COAL|AO", "Coalition voters, between Labor and One Nation", "to Labor"],
    ["ALP|CO", "Labor voters, between the Coalition and One Nation", "to the Coalition"],
    ["ON|AC", "One Nation voters, between Labor and the Coalition", "to Labor"],
    ["GRN|AC", "Greens voters, between Labor and the others", "to Labor"],
    ["OTH|OA", "Minor-party voters, between One Nation and the majors", "to One Nation"],
  ];
  let built = false;
  const lid = (k) => k.replace("|", "-"); // element ids: "|" is not valid in a selector
  // the aggregate's own printed figures (they need not sum to exactly 100; the engine renormalises)
  const defaults = () => { const n = INP().vote.nowcast; st.vote = P5.map((k) => n[k]); };
  const fill = (inp) => { const a = +inp.min, b = +inp.max; inp.style.setProperty("--fill", `${(100 * (+inp.value - a) / (b - a)).toFixed(1)}%`); };
  const levDelta = (k) => { const L = W.levels && W.levels[k]; const pts = st.lev[k] || 0; if (L == null || !pts) return 0; return logit(clamp(L + pts / 100, 0.01, 0.99)) - logit(L); };
  const status = (t) => { const e = $("#ex-status"); if (e) e.textContent = t; };
  const prog = (p) => { const e = $("#ex-prog"); if (e) e.style.width = `${Math.round(100 * p)}%`; };

  function build() {
    if (built) return; built = true;
    defaults();
    const host = $("#ex");
    host.innerHTML = `<div class="md-ctl">
      <div class="md-grp" id="ex-vote"><h3>The ${STATE.jur === "vic" ? "statewide" : "national"} vote <button type="button" data-reset="vote">Back to the polls</button></h3></div>
      <div class="md-grp" id="ex-lev"><h3>How voters order their preferences <button type="button" data-reset="lev">Back to the model</button></h3>
        <div class="md-preset"><button type="button" class="md-btn" data-preset="card">Coalition card puts Labor above One Nation</button></div></div>
      <div class="md-grp" id="ex-unc"><h3>How unsure the model is <button type="button" data-reset="unc">Back to the model</button></h3>
        <label class="md-tog"><input type="checkbox" id="ex-unc-on" checked> Simulate ${DRAWS.toLocaleString("en-AU")} elections with errors</label></div>
      <div class="md-grp" id="ex-fade" hidden><h3>Election day</h3></div>
    </div>
    <div class="md-res" aria-live="polite">
      <div class="md-res-h"><h3 id="ex-title">The official run</h3><span class="md-status" id="ex-status"></span></div>
      <div class="md-prog"><i id="ex-prog"></i></div>
      <div class="md-outcomes" id="ex-out"></div>
      <div class="md-ranges" id="ex-ranges"></div>
      <p class="md-fine" id="ex-central" style="margin-top:12px"></p>
      <div class="md-flips" id="ex-flips"></div>
      <p class="md-share" id="ex-share"></p>
    </div>`;
    const vote = $("#ex-vote");
    P5.forEach((k, i) => vote.insertAdjacentHTML("beforeend", `<div class="md-sl t-${P5_TONE[k]}"><label for="v-${k}"><span class="dot"></span>${P5_NAME[k]}</label><output id="vo-${k}"></output><input type="range" id="v-${k}" min="0" max="50" step="0.1" data-v="${i}"></div>`));
    vote.insertAdjacentHTML("beforeend", `<p class="note">Move one party and the others make room in proportion. The polls’ figures are ${STATE.jur === "vic" ? "the /vic/ page’s polling average" : "this site’s aggregate"} to ${shortDate(INP().asOf.pollsTo)}.${STATE.jur !== "vic" && INP().build.ind ? " Sitting independents and each seat’s independent challenge keep to their own record, so moving others moves minor parties." : ""}</p>`);
    const lev = $("#ex-lev");
    for (const [k, l, unit] of LEV) lev.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="l-${lid(k)}">${l}</label><output id="lo-${lid(k)}"></output><input type="range" id="l-${lid(k)}" min="-30" max="40" step="1" value="0" data-l="${k}" data-unit="${unit}"></div>`);
    lev.insertAdjacentHTML("beforeend", `<p class="note">Each lever shifts that voter group’s choice in every seat by the same amount (on the logit scale), keeping each seat’s own leaning. ${cardEv() ? `The card button moves Coalition voters by what the Liberal card’s reversal between the 2010 and 2013 federal elections was worth, ${cardPts()} points.` : "The card button assumes about a third of Coalition voters follow their party’s how-to-vote card; switching the card’s order moves them, about 35 points."}</p>`);
    const unc = $("#ex-unc");
    for (const [k, l] of [["pol", "Polling error"], ["seat", "Seat-to-seat noise"], ["flow", "Preference drift"]]) unc.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="u-${k}">${l}</label><output id="uo-${k}"></output><input type="range" id="u-${k}" min="0" max="2" step="0.25" value="1" data-u="${k}"></div>`);
    unc.insertAdjacentHTML("beforeend", `<p class="note">1 is the size fitted on past elections; 0 removes that source of error.</p>`);
    $("#ex-fade").insertAdjacentHTML("beforeend", `<label class="md-tog"><input type="checkbox" id="ex-fade-draw" checked> Draw the fade anywhere from 0 to 60%, as the official run does</label><div class="md-sl" style="margin-top:8px"><label for="ex-fade-v">Share of minor parties’ rise since 2025 given back</label><output id="ex-fade-o"></output><input type="range" id="ex-fade-v" min="0" max="60" step="5" value="30" disabled></div><p class="note">History: about 0.6 of a minor party’s surge since the last election has been gone by polling day, but every case was a small surge.</p>`);
    host.addEventListener("input", onInput);
    host.addEventListener("change", onInput);
    host.addEventListener("click", onClick);
    syncControls(); showOfficial();
  }
  function syncControls() {
    P5.forEach((k, i) => { const inp = $(`#v-${k}`); inp.value = st.vote[i]; fill(inp); $(`#vo-${k}`).textContent = `${st.vote[i].toFixed(1)}%`; });
    for (const [k] of LEV) {
      const inp = $(`#l-${lid(k)}`); inp.value = st.lev[k] || 0; fill(inp);
      const L = W.levels && W.levels[k], pts = st.lev[k] || 0;
      $(`#lo-${lid(k)}`).innerHTML = L == null ? "…" : pts ? `${Math.round(100 * L)}% → <b>${Math.round(100 * clamp(L + pts / 100, 0.01, 0.99))}%</b> <small>${inp.dataset.unit}</small>` : `${Math.round(100 * L)}% <small>${inp.dataset.unit}</small>`;
    }
    for (const k of ["pol", "seat", "flow"]) { const inp = $(`#u-${k}`); inp.value = st[k]; inp.disabled = !st.unc; fill(inp); $(`#uo-${k}`).textContent = `× ${st[k]}`; }
    $("#ex-unc-on").checked = st.unc;
    $("#ex-fade").hidden = VMODE() !== "forecast";
    const fd = $("#ex-fade-draw"), fv = $("#ex-fade-v");
    fd.checked = st.fade == null; fv.disabled = st.fade == null; if (st.fade != null) fv.value = st.fade; fill(fv);
    $("#ex-fade-o").textContent = st.fade == null ? "0–60%" : `${st.fade}%`;
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.v != null) {
      const i = +t.dataset.v, v = clamp(+t.value, 0, 60), rest = 100 - v, others = st.vote.reduce((a, x, j) => a + (j === i ? 0 : x), 0);
      st.vote = st.vote.map((x, j) => (j === i ? v : others > 0 ? x * rest / others : rest / 4));
    } else if (t.dataset.l) st.lev[t.dataset.l] = +t.value;
    else if (t.dataset.u) st[t.dataset.u] = +t.value;
    else if (t.id === "ex-unc-on") st.unc = t.checked;
    else if (t.id === "ex-fade-draw") st.fade = t.checked ? null : +$("#ex-fade-v").value;
    else if (t.id === "ex-fade-v") st.fade = +t.value;
    else return;
    st.touched = true; syncControls(); schedule();
  }
  function onClick(e) {
    const r = e.target.closest("[data-reset]"), p = e.target.closest("[data-preset]");
    if (r) {
      if (r.dataset.reset === "vote") defaults();
      if (r.dataset.reset === "lev") st.lev = {};
      if (r.dataset.reset === "unc") Object.assign(st, { unc: true, pol: 1, seat: 1, flow: 1 });
      st.touched = !isOfficial(); syncControls(); st.touched ? schedule() : showOfficial(); writeHash();
    }
    if (p && p.dataset.preset === "card") { const L = W.levels && W.levels["COAL|AO"]; st.lev["COAL|AO"] = L == null ? cardPts() : Math.min(cardPts(), Math.round(95 - 100 * L)); st.touched = true; syncControls(); schedule(); }
    if (e.target.closest("[data-copy]")) { navigator.clipboard && navigator.clipboard.writeText(location.href); e.target.textContent = "Link copied"; }
  }
  const voteIsPolls = () => { const n = INP().vote.nowcast; return st.vote.every((x, i) => Math.abs(x - n[P5[i]]) < 0.051); };
  const isOfficial = () => voteIsPolls() && !Object.values(st.lev).some((v) => v) && st.unc && st.pol === 1 && st.seat === 1 && st.flow === 1 && st.fade == null;
  const schedule = debounce(() => { writeHash(); runJob(); }, 220);
  function job() {
    const tot = st.vote.reduce((a, b) => a + b, 0);
    const levers = {}; for (const [k] of LEV) { const d = levDelta(k); if (d) levers[k] = d; }
    return { type: "run", mode: VMODE(), now5: st.vote.map((x) => x / tot), levers: Object.keys(levers).length ? levers : null,
      uncertainty: st.unc, polErrMult: st.pol, seatNoiseMult: st.seat, flowNoiseMult: st.flow,
      fade: VMODE() === "forecast" ? (st.fade == null ? null : { fixed: st.fade / 100 }) : null, draws: DRAWS, seed: 20261101 };
  }
  function start() {
    if (W.w) return;
    try { W.w = new Worker(URLS.worker, { type: "module" }); }
    catch (err) { status("This browser cannot run the model here."); return; }
    W.ready = false; W.busy = false;
    W.w.onmessage = onMsg;
    W.w.onerror = (e) => status("The model could not start in this browser" + (e.message ? `: ${e.message}` : "") + ".");
    W.w.postMessage({ type: "init", inputsUrl: STATE.jur === "vic" ? URLS.inputsVic : URLS.inputs, senateUrl: URLS.senate });
    if (!W.levels) status(`Loading the model (about ${STATE.jur === "vic" ? 500 : 300} KB)…`);
  }
  function runJob() {
    if (isOfficial()) { st.touched = false; showOfficial(); return; }
    const j = job(); j.id = ++W.id;
    if (W.w && W.busy) { W.w.terminate(); W.w = null; }
    if (!W.w) start();
    if (!W.ready) { W.pending = j; return; }
    send(j);
  }
  function send(j) { W.busy = j.uncertainty; prog(0); status(j.uncertainty ? "Simulating…" : "Projecting…"); W.w.postMessage(j); }
  function onMsg(e) {
    const m = e.data;
    if (m.type === "ready") {
      W.ready = true; W.levels = m.levels; syncControls();
      if (W.pending) { const j = W.pending; W.pending = null; if (!j.levers && Object.values(st.lev).some((v) => v)) Object.assign(j, { levers: job().levers }); send(j); }
      else if (!st.touched) status("");
      return;
    }
    if (m.id !== W.id) return;
    if (m.type === "central") { showCentral(m.result); if (!st.unc) { status("Central projection, no errors"); prog(1); W.busy = false; } }
    else if (m.type === "progress") { prog(m.p); status(`Simulating… ${Math.round(100 * m.p)}%`); }
    else if (m.type === "result") { W.busy = false; prog(1); showResult(m.result); }
    else if (m.type === "error") { W.busy = false; status("Something went wrong: " + m.message); }
  }
  function centralLine(c, label) {
    const order = ["alp", "on", "lnp", "grn", "member"].sort((a, b) => c[b] - c[a]);
    return `${label}: ${order.map((k) => `${PARTY[k].name} ${c[k]}`).join(" · ")}.`;
  }
  function showOfficial() {
    const r = run();
    $("#ex-title").textContent = "The official run";
    status(`${r.meta.draws.toLocaleString("en-AU")} simulated elections · change a setting to re-run`); prog(0);
    $("#ex-out").innerHTML = outcomesHTML(r);
    $("#ex-ranges").innerHTML = rangesHTML(r, { labels: false });
    $("#ex-central").textContent = centralLine(r.national.central, "The central projection, with no errors at all");
    $("#ex-flips").innerHTML = ""; $("#ex-share").innerHTML = "";
  }
  let lastCentral = null;
  function showCentral(c) {
    lastCentral = c;
    $("#ex-title").textContent = "Your scenario";
    $("#ex-central").textContent = centralLine(c.seats, "Central projection, with no errors at all");
    const off = run().seats, flips = [];
    c.perSeat.forEach((p, i) => { const a = BUCKET(off[i].central.w), b = BUCKET(p.w); if (a !== b) flips.push([p.name, a, b]); });
    $("#ex-flips").innerHTML = flips.length
      ? `<h4>${flips.length} seat${flips.length === 1 ? "" : "s"} change hands in the central projection against the official run</h4><ul>${flips.slice(0, 40).map(([n, a, b]) => `<li><span class="dot t-${b}"></span>${esc(n)} <span class="arr">${PARTY[a].short} → ${PARTY[b].short}</span></li>`).join("")}${flips.length > 40 ? `<li>and ${flips.length - 40} more</li>` : ""}</ul>`
      : `<h4>No seat changes hands in the central projection against the official run</h4>`;
    if (!st.unc) {
      // no errors: one election, so each party's range collapses onto its central figure
      const s = c.seats, top = ["alp", "on", "lnp"].sort((a, b) => s[b] - s[a])[0];
      const M = majOf(run()), pseudo = { meta: { ...run().meta, draws: 1 }, national: {
        expectedSeats: s, seatDistribution: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { p05: v, p25: v, p50: v, p75: v, p95: v }])),
        mostSeats: { alp: 0, on: 0, lnp: 0, [top]: 1 },
        majority: { alp: top === "alp" && s.alp >= M ? 1 : 0, coalition: top === "lnp" && s.lnp >= M ? 1 : 0, on: top === "on" && s.on >= M ? 1 : 0, noMajority: s[top] >= M ? 0 : 1 } } };
      $("#ex-out").innerHTML = outcomesHTML(pseudo);
      $("#ex-ranges").innerHTML = rangesHTML(pseudo, { compare: run(), labels: false });
    }
    $("#ex-share").innerHTML = `This scenario is in the address bar. <button type="button" class="md-btn" data-copy>Copy the link</button>`;
  }
  function showResult(res) {
    const wrapped = { national: res, meta: { ...run().meta, draws: res.draws } };
    status(`${res.draws.toLocaleString("en-AU")} simulated elections on your settings`);
    $("#ex-out").innerHTML = outcomesHTML(wrapped);
    $("#ex-ranges").innerHTML = rangesHTML(wrapped, { compare: run(), labels: false });
  }
  function onMode() {
    if (!built) return;
    if (!st.touched) { defaults(); syncControls(); showOfficial(); return; }
    syncControls(); schedule();
  }
  /* the other election chosen: everything back to that run's official settings, a fresh worker on its inputs */
  function onJur() {
    if (W.w) { W.w.terminate(); W.w = null; }
    Object.assign(W, { ready: false, levels: null, busy: false, pending: null });
    Object.assign(st, { vote: null, lev: {}, unc: true, pol: 1, seat: 1, flow: 1, fade: null, touched: false });
    const was = built; built = false; $("#ex").innerHTML = "";
    if (was) { build(); start(); } else init();
  }
  function hashParts() {
    if (!st.touched) return [];
    const p = voteIsPolls() ? [] : [`vote=${st.vote.map((x) => x.toFixed(1)).join(",")}`];
    const l = Object.entries(st.lev).filter(([, v]) => v).map(([k, v]) => `${k.replace("|", ".")}:${v}`);
    if (l.length) p.push(`lev=${l.join(",")}`);
    if (!st.unc) p.push("unc=0");
    for (const k of ["pol", "seat", "flow"]) if (st[k] !== 1) p.push(`${k}=${st[k]}`);
    if (st.fade != null) p.push(`fade=${st.fade}`);
    return p;
  }
  function applyHash(q) {
    if (!q.vote && !q.lev && !q.unc && !q.pol && !q.seat && !q.flow && !q.fade) return false;
    build();
    if (q.vote) { const v = q.vote.split(",").map(Number); if (v.length === 5 && v.every((x) => x >= 0)) { const t = v.reduce((a, b) => a + b, 0); st.vote = v.map((x) => 100 * x / t); } }
    if (q.lev) for (const it of q.lev.split(",")) { const [k, v] = it.split(":"); const key = k.replace(".", "|"); if (LEV.some(([x]) => x === key)) st.lev[key] = clamp(+v || 0, -30, 40); }
    if (q.unc === "0") st.unc = false;
    for (const k of ["pol", "seat", "flow"]) if (q[k] != null) st[k] = clamp(+q[k] || 0, 0, 2);
    if (q.fade != null) st.fade = clamp(+q.fade || 0, 0, 60);
    st.touched = true; syncControls(); start(); runJob();
    return true;
  }
  function init() {
    const sec = $("#explore");
    const go = () => { build(); start(); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "600px 0px" }); io.observe(sec); }
    else go();
  }
  return { init, onMode, onJur, applyHash, hashParts, state: st };
})();
function readHash() { const q = {}; for (const kv of location.hash.replace(/^#/, "").split("&")) { const [k, v] = kv.split("="); if (k && v != null) q[k] = decodeURIComponent(v); } return q; }
function writeHash() {
  const parts = [];
  if (STATE.jur === "vic") parts.push("j=vic");
  else if (STATE.mode === "forecast") parts.push("mode=forecast");
  parts.push(...EX.hashParts());
  const h = parts.length ? "#" + parts.join("&") : "";
  if (location.hash.replace(/^#/, "") === h.replace(/^#/, "")) return;
  if (!h && /^#(how|tests|limits|files|seats|explore|chances)$/.test(location.hash)) return;
  history.replaceState(null, "", h || location.pathname + location.search);
}

/* app-5-evidence.js: how the model works, how well it has done, what it cannot know, and its files -
   every figure read from model/data/evidence.json and inputs.json (the calibration and backtest stores),
   none typed in. */
const GH = "https://github.com/joshborgnolo/auspol-tracker/blob/main/";
const fx1 = (x) => (Math.round(10 * x) / 10).toFixed(1);
const ptsAt = (sigma, share) => sigma * share * (1 - share) * 100;
function lineChart(host, { xs, series, yfmt = (v) => fx1(v), height = 190, ylab = "" }) {
  const W = Math.max(280, host.clientWidth || 480), H = height, m = { l: 34, r: 74, t: 10, b: 24 };
  const all = series.flatMap((s) => s.v.filter((v) => v != null)), ymax = Math.max(...all) * 1.12, ymin = 0;
  const X = (i) => m.l + (W - m.l - m.r) * (xs.length === 1 ? 0.5 : i / (xs.length - 1)), Y = (v) => m.t + (H - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ylab }, host);
  const g = svg("g", { class: "grid" }, s);
  const step = ymax > 8 ? 2 : ymax > 4 ? 1 : 0.5;
  for (let v = 0; v <= ymax; v += step) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); svg("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, s).textContent = yfmt(v); }
  xs.forEach((x, i) => { svg("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, s).textContent = x; });
  const ends = [];
  for (const q of series) {
    const gp = svg("g", { class: `t-${q.tone}` }, s), pts = q.v.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    svg("path", { class: "ln", d: "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L") }, gp);
    for (const p of pts) svg("circle", { class: "pt", cx: p[0], cy: p[1], r: 2.6 }, gp);
    const last = pts[pts.length - 1]; ends.push({ y: last[1], x: last[0], q, gp });
  }
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  for (const e of ends) svg("text", { x: e.x + 8, y: e.y + 4, class: "lab" }, e.gp).textContent = e.q.name;
  return s;
}
function step(n, title, prose, fig) {
  return `<div class="md-step"><div class="md-prose"><h3><span class="n">${n}</span>${title}</h3>${prose}</div><div class="md-fig">${fig || ""}</div></div>`;
}
/* who meets whom in the final count: the base election's final pairs (counted) against the run's average */
const PAIR_ORD = ["alp", "lnp", "on", "grn", "member", "oth"], PAIR_NM = { alp: "Labor", lnp: "Coalition", on: "One Nation", grn: "Greens", member: "Independent", oth: "Other" };
function pairsFigure(skel, tcpOf, R, year, nowLabel) {
  const pkey = (a, b) => [a, b].sort((x, y) => PAIR_ORD.indexOf(x) - PAIR_ORD.indexOf(y)).join(" v ");
  const p25 = {}, p28 = {};
  for (const k of skel) { const t = tcpOf(k); if (t) { const q = pkey(BUCKET(t[0].bucket), BUCKET(t[1].bucket)); p25[q] = (p25[q] || 0) + 1; } }
  for (const [q, v] of Object.entries(R.national.finalPairs)) { const [a, b] = q.split(" v ").map(BUCKET); if (a === b) continue; const k2 = pkey(a, b); p28[k2] = (p28[k2] || 0) + v; }
  const pk = [...new Set([...Object.keys(p25), ...Object.keys(p28)])].sort((x, y) => (p28[y] || 0) - (p28[x] || 0) || (p25[y] || 0) - (p25[x] || 0));
  const shown = pk.filter((q) => Math.max(p25[q] || 0, p28[q] || 0) >= 1.5), rest = pk.filter((q) => !shown.includes(q));
  const prow = (l, a, b) => ({ l, a, b }), prows = shown.map((q) => prow(q.split(" v ").map((x) => PAIR_NM[x]).join(" v "), p25[q] || 0, p28[q] || 0));
  if (rest.length) prows.push(prow("Other pairs", rest.reduce((n, q) => n + (p25[q] || 0), 0), rest.reduce((n, q) => n + (p28[q] || 0), 0)));
  const pmax = Math.max(...prows.flatMap((r) => [r.a, r.b]));
  const html = `<div class="cap">Who meets whom in the final count</div>
     <div class="md-pkey"><span><i class="y25"></i>Counted in ${year}</span><span><i class="y28"></i>${nowLabel}</span></div>
     <div class="md-pairs">${prows.map((r) => `<span class="l">${r.l}</span><span class="b"><i class="y25" style="width:${(100 * r.a / pmax).toFixed(1)}%"></i><i class="y28" style="width:${(100 * r.b / pmax).toFixed(1)}%"></i></span><span class="v">${Math.round(r.a)} <span class="arr">→</span> <b>${Math.round(r.b)}</b></span>`).join("")}</div>
     <div class="sub">Seats by the two candidates left at the end of the count. Today’s figures average the ${R.meta.draws.toLocaleString("en-AU")} simulations, so they need not be whole numbers of seats; they are rounded here.</div>`;
  return { p25, p28, pk, html };
}
function renderEvidence() {
  const E = STATE.evidence, I = STATE.inputs, now = I.vote.nowcast, a = I.asOf, R = STATE.res.nowcast;
  const sh = { alp: now.alp / 100, lnp: now.lnp / 100, grn: now.grn / 100, onp: now.on / 100 };
  const bands = E.national.bands.map((b) => b.band.replace(" months", " mo").replace("final month", "final month"));
  const S = I.settings.nowcast, Sf = I.settings.forecast;
  // the table shows what the model draws (settings), and says so where that differs from a party's own record
  const SIG_I = { alp: 0, lnp: 1, onp: 2, grn: 3 };
  const drawn = (k, Sx) => ptsAt(Sx.sigNat[SIG_I[k]], sh[k]), own = (k, band) => ptsAt(E.national.sigma[k][band], sh[k]);
  const onOwn = [own("onp", "final month"), own("onp", "13-20 months")], onDrawn = [drawn("onp", S), drawn("onp", Sf)];
  const onDiffers = fx1(onOwn[0]) !== fx1(onDrawn[0]) || fx1(onOwn[1]) !== fx1(onDrawn[1]);
  const errTbl = `<table class="md-tbl"><caption>How far the polls’ average can miss, as the model draws it: one standard deviation, in points at today’s vote</caption><thead><tr><th>Party</th><th>Final month</th><th>13–20 months out</th><th>Elections</th></tr></thead><tbody>${[["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"]].map(([k, n]) => `<tr><td>${n}${k === "onp" && onDiffers ? "*" : ""}</td><td>±${fx1(drawn(k, S))}</td><td>±${fx1(drawn(k, Sf))}</td><td>${E.national.n[k]["final month"]}</td></tr>`).join("")}</tbody></table>${onDiffers ? `<div class="sub">* One Nation’s own record, five elections when it polled far lower, would give ±${fx1(onOwn[0])} and ±${fx1(onOwn[1])}. Five is too few to pin the size down, so the model takes the Greens’ error, the best-measured minor party’s, at least 0.25 on the logit scale and never more than One Nation’s own.</div>` : ""}`;
  const html = [];
  html.push(step(1, "Start from the polls",
    `<p>The model starts from this site’s polling aggregate, the house-corrected average of the ${a.waves.length} polls fielded from ${shortDate(a.windowFrom)} to ${shortDate(a.pollsTo)}: <b>Labor ${fx1(now.alp)}, One Nation ${fx1(now.on)}, the Coalition ${fx1(now.lnp)}, the Greens ${fx1(now.grn)} and others ${fx1(now.oth)}</b>.</p>
     <p>An average of polls is not a result. In every federal campaign since 1972 the final month’s polls have missed each party by an amount that is fitted here, party by party, on the logit scale, with the errors linked: when the polls overstate Labor they tend to understate the Coalition (a correlation of ${E.national.corr.alpLnpAllCycles} over ${E.national.corr.alpLnpCycles} elections). Errors are drawn with fat tails (a Student-t), so a big miss is possible.</p>
     <p><b>On election day</b>, about 17 months away, the error is the larger one seen 13 to 20 months out, and minor parties give back part of their rise since 2025. Over ${E.national.fade["13-20 months"].n} minor-party cases, about ${Math.round(100 * E.national.fade["13-20 months"].lambda)}% of a surge since the last election was gone by polling day; every case was a small surge, so the model draws the fade anywhere from 0 to 60%.</p>
     <p class="src">Fitted by <a href="${GH}.build/analysis/seat-model/calibrate-national.mjs">calibrate-national.mjs</a> on the poll archive behind Past cycles.</p>`, errTbl));
  // seat noise by election, in points at each party's 2025 share; the years are the calibration's own
  const years = [...new Set(["alp", "lnp", "grn"].flatMap((k) => Object.keys(E.swing.stateOracle[k].rmsByElection || {})))].sort(), nat25 = I.vote.result2025;
  const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"], word = (n) => WORD[n] ?? String(n);
  const TM = E.swing.terms, OOS = E.swing.oos, SM = E.swing.sigMult;
  const pts2 = (x, k) => fx1(Math.abs(ptsAt(x, nat25[k] / 100)));
  // the seat terms' paragraph: sizes in points at each party's 2025 vote; the out-of-sample record counts the
  // elections whose typical seat miss the terms cut (refitted before each, scored on it)
  const better = (k) => { const b = OOS?.[k]?.byElection || {}; const es = Object.values(b); return [es.filter((v) => v.terms < v.plain).length, es.length]; };
  const termsTxt = TM ? (() => {
    const yrs = E.swing.years, y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const [ka, na] = better("alp"), [kl] = better("lnp"), [kg] = better("grn"), oy = Object.keys(OOS?.alp?.byElection || {});
    return `<p>Some of what is left can be foreseen, and the model uses it, with terms fitted on every federal election from ${y0} to ${y1}. A sitting member carries a personal vote: standing again, they are worth about ${pts2(TM.alp.incE, "alp")} points to Labor or ${pts2(TM.lnp.incE, "lnp")} to the Coalition; where a party’s member from last time is gone, retired or beaten, it gives back about ${pts2(TM.alp.incP, "alp")} points (Labor) or ${pts2(TM.lnp.incP, "lnp")} (the Coalition).${TM.grn?.borrowed ? " The Greens, with too few members to fit, take the two parties’ average." : ""} A member who quits the party and stands against it takes more. And a seat gives back part of an unusually good or bad result last time: about ${Math.round(-100 * TM.alp.rho)}% of the surprise for Labor, ${Math.round(-100 * TM.lnp.rho)}% for the Coalition and ${Math.round(-100 * TM.grn.rho)}% for the Greens.</p>${na ? `
     <p>Fitted on the elections before each one from ${oy[0]} to ${oy[oy.length - 1]} and tried on it, these terms cut the typical seat’s miss in Labor’s vote in ${word(ka)} of the ${word(na)} elections, the Coalition’s in ${word(kl)} and the Greens’ in ${word(kg)}.</p>` : ""}`;
  })() : "";
  // the noise paragraph: the multiplier and, when the whole record would choose differently, which way and why
  const LF = E.federalLong?.rows?.[0]?.E ?? 2001, LL = E.federalLong?.rows?.slice(-1)[0]?.E ?? 2025, RF = SM?.recentFrom ?? 2016;
  const fm = (m) => (Number.isInteger(m) ? m.toFixed(1) : String(m));
  const multTxt = SM ? `Drawn at ${fm(SM.value)} times the size the last three elections left, with fat tails, it scored best when the elections from ${RF} to ${LL} were predicted afresh${SM.bestAll < SM.value ? `. Over every election since ${LF} a smaller multiple, ${fm(SM.bestAll)}, would have scored better, because seats strayed less in the 2000s; the recent elections are the better guide to today’s` : SM.bestAll > SM.value ? `. Over every election since ${LF} a larger multiple, ${fm(SM.bestAll)}, would have scored better` : ""}.` : "Noise 1.3 times the calm-year size, with fat tails, scored best when past elections were predicted afresh.";
  // who sits has changed since the election (the candidate overlay, evidence.json `changes`): by-elections,
  // members who changed party, retirements - each said with what the model does about it. A member who has
  // changed party and not said whether they stand again (recontests null) is assumed neither way.
  const CH = E.changes, PTY = { alp: "Labor", lp: "the Liberals", np: "the Nationals", lnp: "the LNP", clp: "the CLP", grn: "the Greens", on: "One Nation" };
  const many = (g) => /s$/.test(PTY[g] || ""), seatOf = (nm) => I.seats.find((x) => x.name === nm);
  const chItems = CH ? [
    ...CH.byElections.map((e) => { const w = e.winner.group, was = seatOf(e.seat)?.won2025?.group; return `${esc(e.seat)} went to ${poss(PTY[w] || esc(e.winner.party))} ${esc(e.winner.name)} at the by-election of ${longDate(e.date)}: ${PTY[w] || esc(e.winner.party)} now ${many(w) ? "have" : "has"} the sitting member there${PTY[was] ? `, and ${PTY[was]} no longer ${many(was) ? "have" : "has"} ${poss(esc(e.vacatedBy))} personal vote` : ""}`; }),
    ...CH.defections.map((e) => { const a = PTY[e.from], b = PTY[e.to] || esc(e.party), lose = many(e.from) ? "lose" : "loses", their = many(e.from) ? "their" : "its";
      return `${esc(e.member)}, elected for ${a} in ${esc(e.seat)}, has sat for ${b} since ${longDate(e.date)}${e.recontests === true ? ` and stands there again: ${a} ${lose} more than a retirement would cost, and ${b} ${many(e.to) ? "have" : "has"} a sitting member`
        : e.recontests === false ? ` and is not standing there again: ${a} ${lose} ${their} member’s personal vote`
        : `. Whether ${esc(e.member.split(" ").pop())} stands there again is not settled, so the model assumes neither: ${a} ${lose} ${their} member’s personal vote, and ${b} ${many(e.to) ? "get" : "gets"} no sitting member`}`; }),
    ...CH.retirements.map((e) => { const g = seatOf(e.seat)?.held?.group; return `${esc(e.member)} is not standing again in ${esc(e.seat)}, which costs ${PTY[g] || "the party"} a sitting member’s personal vote`; }),
  ] : [];
  const changesTxt = chItems.length ? `
     <p>Who sits has changed in ${word(chItems.length)} seat${chItems.length === 1 ? "" : "s"} since the election, and the terms follow. ${chItems.map((t) => cap1(t) + ".").join(" ")}</p>` : "";
  html.push(step(2, "Spread the vote across the seats",
    `<p>Each party’s 2025 vote in each seat moves by the same amount on the logit scale, with one shift per party solved so the national totals come out exactly. On the logit scale a party gains least in points where it is very weak or very strong, which is how a surge spreads: the rule predicted One Nation’s SA 2026 vote, district by district, from its federal 2025 vote with a typical miss of 2.1 points, against 4.5 for adding the same points everywhere.</p>
     <p>Each state shifts by what this term’s state polling says, within its sampling error, and each seat by the age and gender of its voters, as measured in the Resolve polls against election eve.</p>
     ${termsTxt}${changesTxt}
     <p>What the terms cannot foresee is noise, fitted on the same elections. It has grown as voters have loosened their ties, and it grows for a party in steep decline, as the SA Liberals’ did in 2026, so a party’s seat noise grows with its fall since 2025. ${multTxt}</p>
     <p>Education gets no term of its own. Within each pollster, the gap between graduates and everyone else has moved by ${E.education.estimate.onp.gapChange.toFixed(2)} on the logit scale for One Nation and ${E.education.estimate.grn.gapChange.toFixed(2)} for the Greens: their surges spread by education just as the logit rule implies. Labor’s and the Coalition’s gaps moved by about 0.2, worth at most ${fx1(Math.max(E.education.estimate.alp.seatEffect.mostPositive[0][1], E.education.estimate.lnp.seatEffect.mostPositive[0][1]))} points in the most extreme seats, and the model’s shared education shock already spans that.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/swing-fit.mjs">swing-fit.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-swing.mjs">calibrate-swing.mjs</a>, <a href="${GH}.build/analysis/seat-model/extract-incumbency.mjs">extract-incumbency.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-education.mjs">calibrate-education.mjs</a>, <a href="${GH}.build/analysis/seat-model/vote-layer.mjs">vote-layer.mjs</a>.</p>`,
    `<div class="cap">How far seats stray from the logit rule, in points at each party’s typical vote</div><div id="fig-noise"></div><div class="sub">Root mean square of each seat’s miss with the state totals known${TM ? " and the seat terms applied" : ""}, at each party’s 2025 national vote. The SA Liberals’ 2026 collapse ran at about ${fx1(ptsAt(E.swing.sa26.lnp.rmsLogit, 0.19))} points.</div>`));
  // independents drawn from the record (evidence.json `independents`): every figure read off the stores. The
  // wave sentence names the window's election with the most winners among challengers new to their seats.
  const IN = E.independents, pc0 = (v) => Math.round(100 * v), andList0 = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  if (IN) {
    const exa = (tp) => IN.examples.find((x) => Math.abs(x.tp - tp) < 1e-9), yrs = IN.window, B = IN.byElection, r25 = I.vote.result2025;
    const num = (n) => (n <= 12 ? word(n) : String(n));
    const waveY = [...yrs].sort((x, y) => B[y].freshWon - B[x].freshWon || B[y].freshSerious - B[x].freshSerious)[0];
    // one sentence, one style: numerals throughout once any count passes twelve
    const big = yrs.some((y) => B[y].freshSerious > 12 || B[y].freshWon > 12), n2 = (n) => (big ? String(n) : num(n));
    const waveTxt = yrs.map((y) => `${n2(B[y].freshSerious)} passed 10% in ${y} and ${B[y].freshWon === 0 ? "none" : n2(B[y].freshWon)} won`).join("; ");
    const e0 = exa(0), e20 = exa(0.2), e30 = exa(0.3);
    // what the draw gives on today's polls: the seats independents win that they do not hold now, against the
    // window's elections ("more than at any" only when above the largest by half a seat), and the conversion
    // record that says why (check.conversion: independents on 15% to 30% who won, the split-field election apart)
    const gains = R.seats.reduce((t, s) => { const k = I.seats.find((x) => x.name === s.name); return !k || k.cands.some((c) => c.free && c.slot == null) ? t : t + Object.entries(s.win).filter(([g]) => BUCKET(g) === "member").reduce((a2, [, p]) => a2 + p, 0); }, 0);
    const wonBy = yrs.map((y) => [y, B[y].standingWon + B[y].freshWon]), mx = wonBy.slice().sort((x, y) => y[1] - x[1])[0];
    const CV = IN.check.conversion || [], split = CV.find((e) => e.id === "sa26"), calm = CV.filter((e) => e.id !== "sa26");
    const mid = (e) => [e.bands["15-20"].won + e.bands["20-30"].won, e.bands["15-20"].n + e.bands["20-30"].n];
    const calmW = calm.reduce((t, e) => t + mid(e)[0], 0), calmN = calm.reduce((t, e) => t + mid(e)[1], 0);
    // the other elections in running prose: "the 2022 and 2025 federal elections and SA 2022"
    const fedY = calm.filter((e) => /^Federal /.test(e.label)).map((e) => e.label.slice(8)), stL = calm.filter((e) => !/^Federal /.test(e.label)).map((e) => e.label);
    const calmL = [...(fedY.length ? [`the ${andList0(fedY)} federal election${fedY.length > 1 ? "s" : ""}`] : []), ...stL];
    const ofN = (a, b) => (b > 12 ? `${a} of ${b}` : `${num(a)} of ${num(b)}`);
    const todayTxt = `<p><b>Today.</b> On these polls independents win about ${fx1(gains)} seats they do not hold now, ${gains > mx[1] + 0.5 ? `more than at any of those elections (${num(mx[1])} in ${mx[0]})` : `against ${wonBy.map(([y, n]) => `${n === 0 ? "none" : num(n)} in ${y}`).join(", ")}`}. The draw gives them no more votes than the record does. The count does the rest: a challenger needs fewer votes to win when the major parties’ first preferences are this low.${split && calmN ? ` In ${split.label}, the one election in the stores with a field this split, ${num(mid(split)[0])} of the ${num(mid(split)[1])} independents on 15% to 30% won; in ${andList0(calmL)} together, ${ofN(calmW, calmN)}.` : ""}</p>`;
    const exRows = IN.examples.map((x) => `<tr><td>${x.tp === 0 ? "No independent to speak of" : pc0(x.tp) + "%"}</td><td>${pc0(x.none)}%</td><td>${pc0(x.p10)}%</td><td>${pc0(x.p20)}%</td><td>${pc0(x.p30)}%</td></tr>`).join("");
    html.push(step(3, "Draw the independents from the record",
      `<p>Independents are candidates and not a party. A seat’s independent vote does not follow a national swing, and nobody is nominated yet, so the model reads both off the record.</p>
       <p><b>Sitting independents.</b> Since ${IN.sitting.first}, ${IN.sitting.n} sitting independents have faced the voters again and ${IN.sitting.held} held their seats. Their own vote rose on average, by ${IN.sitting.mean.toFixed(2)} on the logit scale (standard error ${IN.sitting.se.toFixed(2)}; about ${fx1(ptsAt(IN.sitting.mean, 0.35))} points for a member on 35%), and it varied by ${IN.sitting.sig.toFixed(2)} from one to the next. Each of the ${word(IN.seats.sitting)} sitting now moves by that record. Until this version they moved with the polls’ figure for others, which counts minor parties too and stands at ${fx1(now.oth)}% against ${fx1(r25.oth)}% at the election.</p>
       <p><b>Every other seat.</b> Each of the ${IN.seats.challenges} seats a party holds gets one independent challenge. Its share of the vote is drawn from what happened next in seats whose strongest independent had polled about the same, at the last ${word(yrs.length)} elections (${andList0(yrs.map(String))}). Where no independent to speak of had stood, a challenger reached 10% in ${pc0(e0.p10)}% of seats. Where one had polled 20%, an independent reached 20% again in ${pc0(e20.p20)}%; where one had polled 30%, in ${pc0(e30.p20)}%, and none stood in ${pc0(e30.none)}%. In ${IN.seats.standing.length} seats an independent polled ${pc0(IN.settings.replace)}% or more in 2025, and the draw stands in for that candidate. Elsewhere a challenger of ${pc0(IN.settings.serious)}% or more is added to the field when one is drawn.</p>
       <p><b>Waves.</b> Independents rise together. In seats where no independent had polled 10% the time before, ${waveTxt}. Each simulated election takes every seat’s draw from the same one of those elections, so a year like ${waveY} arrives whole or not at all.</p>
       ${todayTxt}
       <p>Unfortunately, the record cannot say who will stand, or where. A seat’s chance for an independent is the chance the record gives a seat like it, and it will sharpen only when candidates are known.</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/independents.mjs">independents.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-independents.mjs">calibrate-independents.mjs</a>.</p>`,
      `<table class="md-tbl"><caption>A seat’s independent challenge, by how its strongest independent polled last time</caption><thead><tr><th>Last time</th><th>None stands</th><th>10% or more</th><th>20% or more</th><th>30% or more</th></tr></thead><tbody>${exRows}</tbody></table>
       <div class="sub">How often each happened next in comparable seats at the ${andList0(yrs.map(String))} elections, seats nearer the row’s share counting for more. A seat with no independent to speak of counts as one only when a challenger reaches ${pc0(IN.settings.serious)}%.</div>`));
  }
  const ex = E.examples.map((x) => `<tr><td>${esc(x.seat)}</td><td>${Math.round(100 * x.coalitionLaborOverOn)}%</td><td>${Math.round(100 * x.laborCoalitionOverOn)}%</td><td>${Math.round(100 * x.onLaborOverCoalition)}%</td><td>${Math.round(100 * x.greensLaborOverCoalition)}%</td></tr>`).join("");
  const comp = (row, label) => { const parts = [["onp", "on", "One Nation"], ["lnp", "lnp", "Coalition"], ["alp", "alp", "Labor"], ["grn", "grn", "Greens"], ["ind", "member", "independents"], ["oth", "oth", "others"]]; return `<div class="md-fine" style="margin-top:12px">${label}</div><div class="md-mix">${parts.map(([k, t]) => `<span class="t-${t}" style="flex-grow:${(1000 * (row[k] || 0)).toFixed(0)}" title="${Math.round(100 * (row[k] || 0))}% voted ${k === "ind" ? "independent" : k === "oth" ? "for another party" : PARTY[t].name} in 2025"></span>`).join("")}</div><div class="md-fine">${parts.filter(([k]) => (row[k] || 0) >= 0.03).map(([k, , n]) => `${Math.round(100 * row[k])}% ${n}`).join(" · ")}</div>`; };
  // the House record’s check on the national preference shocks: each class’s drift between elections against
  // what the model draws (wider in every class / narrower in the named ones)
  const FD = E.flowDrift, DK = [["GRN|AC", "GRN", "Greens voters’"], ["ON|AC", "ON", "One Nation’s"], ["OTH-R|AC", "OTH-R", "right-wing minor parties’"], ["OTH-M|AC", "OTH-M", "other minor parties’"], ["OTH-L|AC", "OTH-L", "left-wing minor parties’"]].filter(([k]) => FD?.[k]);
  const narrower = DK.filter(([k, c]) => S.flowNat[c] < FD[k].rms);
  const driftTxt = DK.length ? `
     <p>The House counts since ${Math.min(...DK.map(([k]) => FD[k].first))} show how far each party’s split between Labor and the Coalition moves from one election to the next: on the logit scale, ${DK.map(([k, , n]) => `${n} by ${FD[k].rms.toFixed(2)}`).join(", ")}. The model draws ${DK.map(([, c]) => S.flowNat[c].toFixed(2)).join(", ")} for the same groups, sized on the drift from a Senate election to the next count, ${narrower.length ? `narrower than the House record for ${narrower.map(([, , n]) => n.replace(/’$/, "").replace(/’s$/, "")).join(" and ")}` : "at least as wide as the House record for every group"}.</p>` : "";
  // the switchers and the two flows set to the site's tables, every figure read off evidence.json
  const CU = E.compositionUse, CA = CU?.coalLaborOverOn, OA = CU?.onLaborOverCoalition, pc = (v) => Math.round(100 * v);
  const mixTxt = CA && OA && !CU.mixed.length ? `
     <p>Voters have moved since 2025. By the last six weeks of vote-switching polls, today’s One Nation voters are ${pc(E.composition.on.onp)}% its 2025 voters, ${pc(E.composition.on.lnp)}% former Coalition voters and ${pc(E.composition.on.alp)}% former Labor voters, and ${pc(E.composition.lnp.alp)}% of today’s Coalition voters say they voted Labor. The model doesn’t carry those switchers’ old orders over. Given their old party’s order with the new party moved first, they would send ${pc(OA.ifMixed)}% of One Nation preferences to Labor ahead of the Coalition and ${pc(CA.ifMixed)}% of Coalition preferences to Labor ahead of One Nation, both above the latest counts of those choices. Recalled votes lean towards the party that won.</p>
     <p>Two choices decide more seats than any others: whether Coalition voters put Labor or One Nation next, and whether One Nation voters put Labor or the Coalition next. The model sets both national levels to the site’s own tables and keeps each seat’s Senate pattern around them: ${pc(CA.used)}% of Coalition preferences to Labor ahead of One Nation, from the <a href="/flows-explained/#one-nation">Labor v One Nation table</a> (${pc(CA.senate)}% on the 2025 Senate ballots, outside the ACT, where One Nation ran no Senate ticket), and ${Number((100 * OA.used).toFixed(1))}% of One Nation preferences to Labor ahead of the Coalition, as counted in 2025.</p>` : "";
  // what poll respondents now say of those two levels (evidence.json `respondents`: the polls publishing their
  // respondents' own allocation in the six weeks to the newest poll), and the nowcast's averages halfway to
  // them and on them alone beside the official run's; absent when no such poll is in the window
  const RS = E.respondents, sN = (o, k) => Math.round(o.expectedSeats[k]);
  const respTxt = RS ? `
     <p>Poll respondents now say something different. In the six weeks to ${shortDate(RS.to)}, ${RS.polls.length === 1 ? "the one poll" : `the ${word(RS.polls.length)} polls`} publishing respondents’ own choices had ${pc(RS.said.on)}% of One Nation voters putting Labor ahead of the Coalition and ${pc(RS.said.coal)}% of Coalition voters putting Labor ahead of One Nation. The model keeps the counted levels: each has a federal count behind it, and no count has yet tested a reading that has moved. Halfway to the respondents, One Nation would average ${sN(RS.halfway, "on")} seats and Labor ${sN(RS.halfway, "alp")}; on the respondents alone, ${sN(RS.respondents, "on")} and ${sN(RS.respondents, "alp")}. The official run has ${sN(RS.official, "on")} and ${sN(RS.official, "alp")}.</p>` : "";
  html.push(step(IN ? 4 : 3, "Order every voter’s preferences",
    `<p>Who wins a seat often depends on the order in which voters number the parties they did not vote for, and in a three-way race that order decides a great deal: whether Coalition voters put Labor or One Nation next. The House count shows only the contests that happened. The Senate shows every voter’s order: the AEC publishes every formal Senate ballot, and for each party’s voters in each seat this model counts the order in which they ranked Labor, the Coalition, the Greens and One Nation, across about 15 million ballots at each of the last four elections.</p>
     <p>House voters differ from Senate voters in ways fitted on ${E.flows.rows.same.toLocaleString("en-AU")} House flows counted from 2016 to 2025, the elections since every Senate ballot has been published (before 2016 nearly every Senate vote was a single vote for a party’s ticket, which shows the party’s order, not its voters’): Greens voters’ preferences reach Labor a little less often in the House, One Nation’s a little more. Where the 2025 House count saw a seat’s own flow, that counts too.</p>${driftTxt}
     ${mixTxt}${respTxt}
     <p class="src"><a href="${GH}.build/analysis/seat-model/extract-senate-rankings.py">extract-senate-rankings.py</a>, <a href="${GH}.build/analysis/seat-model/senate-flows.mjs">senate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-flows.mjs">calibrate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/seat-build.mjs">seat-build.mjs</a>.</p>`,
    `<table class="md-tbl"><caption>Three seats’ 2025 Senate ballots</caption><thead><tr><th>Seat</th><th>Coalition voters: Labor ahead of One Nation</th><th>Labor voters: Coalition ahead of One Nation</th><th>One Nation voters: Labor ahead of the Coalition</th><th>Greens voters: Labor ahead of the Coalition</th></tr></thead><tbody>${ex}</tbody></table>
     <div class="sub">Shares of each party’s Senate voters who numbered either of the two, before the House adjustments.</div>
     ${comp(E.composition.on, "Today’s One Nation voters, by their 2025 vote")}${comp(E.composition.lnp, "Today’s Coalition voters, by their 2025 vote")}`));
  // what an independent takes of a pile, by who else is left (evidence.json independents.take), and its check on
  // the SA 2026 districts it was not measured on: "closer" only when the mean error is smaller
  const TK = IN?.take, CK = IN?.check?.sa26;
  const takeTxt = TK ? (() => {
    const vs = TK.vsOneNation, counts = vs ? andList0(vs.counts.map((c) => `the ${esc(c.seat)} by-election of ${longDate(c.date)}`)) : "";
    const n = CK ? CK.rows.length : 0, a = CK?.meanAbsError.byWhoIsLeft, b = CK?.meanAbsError.flat, out = CK ? CK.rows.filter((q) => q.byWhoIsLeft == null).length : 0;
    const chk = CK && a != null && b != null ? ` Counted this way from their actual first preferences, the ${word(n)} SA 2026 districts where an independent reached the final two come out ${fx1(100 * a)} points from the count on average, ${a < b ? `against ${fx1(100 * b)} when one share served for every case` : `no closer than the ${fx1(100 * b)} a single share gave`}${out ? ` (in ${word(out)} the model’s count left the independent out of the final two)` : ""}.` : "";
    return `<p>An independent takes a share of every pile of ballots on the move, and the share depends on who else is left. Leaving aside ballots that went to other minor candidates, in the 2025 counts an independent took ${pc0(TK.own.GRN)}% of a Greens pile while Labor was still standing and ${pc0(TK.own.ON)}% of a One Nation pile while the Coalition was. Once only the other side of politics was left, an independent took ${pc0(TK.cross.ALP)}% of a Labor pile and ${pc0(TK.cross.COAL)}% of a Coalition pile.${vs && vs.COAL ? ` Coalition voters choosing between an independent and One Nation have been counted ${vs.counts.length === 1 ? "once" : word(vs.counts.length) + " times"}, at ${counts}: ${pc0(vs.COAL.share)}% chose the independent.` : ""}${chk}</p>
     <p>A Liberal or National knocked out of a three-cornered contest passes most of their votes to their partner, at the rate their 2025 counts show.</p>`;
  })() : `<p>Sitting independents take the share of moving ballots they took in their 2025 counts. A Liberal or National knocked out of a three-cornered contest passes most of their votes to their partner, at the rate their 2025 counts show.</p>`;
  const { p25, p28, pk, html: pairFig } = pairsFigure(I.seats, (k) => k.tcp2025, R, 2025, "If held today, on average");
  const PNM = PAIR_NM;
  const cl25 = p25["alp v lnp"] || 0, cl28 = p28["alp v lnp"] || 0, top28 = pk.find((q) => q !== "alp v lnp" && (p28[q] || 0) >= 1);
  html.push(step(IN ? 5 : 4, "Count every seat",
    `<p>Every seat is counted as the AEC counts it: the candidate with the fewest votes is excluded, and each ballot moves to the next candidate it ranks who is still standing, until two remain. Because each group of voters’ whole order is known, the count works for any final pair (Labor v One Nation, the Coalition v One Nation, a three-way race) without a table of flows, and a ballot that passed through one party moves on as its own voter would move it. Building three-way splits from pairwise flows instead misplaces the right-wing minor parties’ votes by about 11 points.</p>
     ${takeTxt}
     <p>In 2025, ${cl25} of the 150 counts ended with Labor against the Coalition. If the election were held today, about ${Math.round(cl28)} would${top28 ? `, and about ${Math.round(p28[top28])} would end ${top28.split(" v ").map((x) => (x === "lnp" ? "the Coalition" : x === "grn" ? "the Greens" : x === "member" ? "an independent" : x === "oth" ? "another candidate" : PNM[x])).join(" against ")}` : ""}.</p>
     <p>Counted on the actual 2025 first preferences, this reproduces <b>${E.replay2025.winners} of the 150 winners</b> and ${E.replay2025.pairs} of the final pairs, with a typical two-candidate error of ${fx1(E.replay2025.tcpMaePts)} points. The misses are ${E.replay2025.misses.join(", ")}, the closest contests of the election.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/seat-engine.mjs">seat-engine.mjs</a>.</p>`, pairFig));
  const SY = E.swing.years ? `${E.swing.years[0]}–${E.swing.years[E.swing.years.length - 1]}` : "2007–2025";
  const terms = [
    ["The national vote", `Labor ±${fx1(ptsAt(S.sigNat[0], sh.alp))}, Coalition ±${fx1(ptsAt(S.sigNat[1], sh.lnp))}, One Nation ±${fx1(ptsAt(S.sigNat[2], sh.onp))} pts (one SD; election day ±${fx1(ptsAt(Sf.sigNat[0], sh.alp))}, ±${fx1(ptsAt(Sf.sigNat[1], sh.lnp))}, ±${fx1(ptsAt(Sf.sigNat[2], sh.onp))})`, "Every campaign since 1972"],
    ["Each state", "Its polling deviation within its sampling error, plus 0.10 logit", "This term’s state polling"],
    ["Seat types and education", `${Math.min(...S.sigClass).toFixed(2)}–${Math.max(...S.sigClass).toFixed(2)} logit by type; ${S.sigEdu.toFixed(2)} per standard deviation of degree share`, `Set above the seat-type swings measured ${SY}`],
    ["Each seat", `Labor ${R.meta.sigmaSeat.alp.toFixed(2)}, Coalition ${R.meta.sigmaSeat.lnp.toFixed(2)}, One Nation ${R.meta.sigmaSeat.on.toFixed(2)}, Greens ${R.meta.sigmaSeat.grn.toFixed(2)} logit, fat-tailed, larger for a party that has fallen since 2025`, `Federal ${SY} and SA 2026`],
    ...(IN ? [["Independents", `A sitting independent ±${IN.sitting.sig.toFixed(2)} logit around a rise of ${IN.sitting.mean.toFixed(2)}, fat-tailed; every other seat’s challenge a draw from the record, all seats from the same election`, `${IN.sitting.n} sitting independents ${IN.sitting.first}–${IN.sitting.last}; seats at the ${IN.window[0]}–${IN.window[IN.window.length - 1]} elections`]] : []),
    ["Preferences, nationally", `${Object.entries(S.flowNat).filter(([k]) => ["COAL", "ON", "GRN", "OTH-R"].includes(k)).map(([k, v]) => `${{ COAL: "Coalition", ON: "One Nation", GRN: "Greens", "OTH-R": "right-wing minors" }[k]} ${v.toFixed(2)}`).join(", ")} logit, plus a shared One Nation shift of ${S.flowOn}`, "Drift from a Senate election to the next House count, federal 2019–2025 and six state elections"],
    ["Preferences, each seat", `${Math.min(...Object.values(S.flowSeat)).toFixed(2)}–${Math.max(...Object.values(S.flowSeat)).toFixed(2)} logit`, "What the Senate and the seat’s history leave unexplained"],
  ];
  html.push(step(IN ? 6 : 5, `Simulate ${R.meta.draws.toLocaleString("en-AU")} elections`,
    `<p>Every simulated election draws each of these afresh, then counts all 150 seats. A party’s seat total, its chance of a majority and each seat’s chances are simply how often things happened across the simulations. The central projection is one more election, with every error set to zero: it can differ from the averages because close seats tip one way at the centre and both ways once the errors are drawn.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/model-sim.mjs">model-sim.mjs</a>, <a href="${GH}.build/analysis/seat-model/swing-simulate.mjs">swing-simulate.mjs</a>.</p>`,
    `<table class="md-tbl md-terms"><caption>What varies in each simulated election</caption><thead><tr><th>What</th><th>Size</th><th>Fitted on</th></tr></thead><tbody>${terms.map(([w, s2, f]) => `<tr><td>${w}</td><td style="white-space:normal;text-align:left">${s2}</td><td style="white-space:normal;text-align:left;color:var(--ink-3)">${f}</td></tr>`).join("")}</tbody></table>`));
  $("#how-steps").innerHTML = html.join("");
  lineChart($("#fig-noise"), { xs: years, ylab: "Typical seat miss by election", series: [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"]].map(([k, n]) => ({ tone: k, name: n, v: years.map((y) => { const r = E.swing.stateOracle[k].rmsByElection[y]; return r == null ? null : ptsAt(r, nat25[k] / 100); }) })) });

  // ---- how well it has done
  const T = E.states, order = ["sa26", "qld17", "vic22", "qld20", "qld24", "sa22"];
  const SCH = [["Senate ballots (this model)", "Senate ballots"], ["W5 constants", "Fixed rates (first version)"], ["design review: seat-type grades", "Seat-type grades"], ["diagnostic: Senate pattern, levels set to the count", "Senate, levels set to the count"]];
  const els = order.filter((k) => T[k] && SCH.slice(0, 3).every(([s]) => T[k].replay[s]));
  const stRows = els.map((k) => {
    const t = T[k], best = Math.max(...SCH.slice(0, 3).map(([s]) => t.replay[s].winners));
    return `<tr><td>${esc(t.label)}<div class="md-fine">${t.senate} Senate</div></td>${SCH.map(([s], j) => { const r = t.replay[s]; return r ? `<td><span class="${j < 3 && r.winners === best ? "best" : ""}">${r.winners}/${t.seats}</span><div class="md-fine">${r.pairs} pairs · ${fx1(r.tcpMaePts)} pts</div></td>` : "<td>–</td>"; }).join("")}</tr>`;
  }).join("");
  // the comparison in the prose is read off the same table, by these rules: the Senate ballots' final pairs
  // against the best of the other two (more / as many / fewer), then winners against the seat-type grades
  // (ahead / level / behind), naming the election that holds most of a deficit when one does (at least 60%)
  const tot = (s, f) => els.reduce((n, k) => n + T[k].replay[s][f], 0), seatsAll = els.reduce((n, k) => n + T[k].seats, 0);
  const [Sx, Fx, Gx] = SCH.slice(0, 3).map(([s]) => ({ pairs: tot(s, "pairs"), w: tot(s, "winners") }));
  const pairLead = Sx.pairs > Math.max(Fx.pairs, Gx.pairs) ? "pick the right final pair more often than either" : Sx.pairs === Math.max(Fx.pairs, Gx.pairs) ? "pick the right final pair as often as the better of the two" : `pick the right final pair less often than the ${Gx.pairs >= Fx.pairs ? "seat-type grades" : "fixed rates"}`;
  const gap = els.map((k) => [k, T[k].replay[SCH[2][0]].winners - T[k].replay[SCH[0][0]].winners]), deficit = gap.reduce((n, [, d]) => n + Math.max(0, d), 0);
  const where = gap.filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1])[0];
  const whereTxt = where && deficit > 0 && where[1] / deficit >= 0.6 ? `, most of it in ${T[where[0]].label}` : "";
  const winTxt = Gx.w > Sx.w ? `On winners the seat-type grades edge ahead, ${Gx.w} to ${Sx.w}${whereTxt}` : Gx.w === Sx.w ? `On winners they tie with the seat-type grades at ${Sx.w}` : `On winners they lead the seat-type grades too, ${Sx.w} to ${Gx.w}`;
  const q17 = T.qld17 && T.qld17.replay[SCH[3][0]];
  const fed = E.federal.results.filter((r) => r.variant === "full" && !r.stateOracle);
  const fedRows = fed.map((r) => `<tr><td>${r.E}</td><td>${r.modalRight}/150</td><td>${r.pairsRight}/150</td><td>${fx1(r.tcpMaePts)}</td><td>${Math.round(r.expected.alp)} v ${r.actual.alp}</td><td>${Math.round(r.expected.lnp)} v ${r.actual.lnp}</td><td>${Math.round(r.expected.ind)} v ${r.actual.ind}</td></tr>`).join("");
  const T2 = [];
  T2.push(step("", "Six state elections, counted again",
    `<p>A hard test of the preferences: count each state election from its actual first preferences, with every candidate’s preferences read from the federal Senate ballots cast before it, the same way the model reads them for 2028, and nothing from the state count itself. Two simpler ways are counted on the same first preferences: the fixed national rates of the model’s first version, and rates graded by seat type, from inner city to rural, set partly on SA 2026 itself.</p>
     <p>Across the ${["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][els.length] || els.length} elections the Senate ballots ${pairLead}: ${Sx.pairs} of ${seatsAll}, against ${Gx.pairs} for the grades and ${Fx.pairs} for the fixed rates, because they know which party each group of voters puts next once its own is out. ${winTxt}; the fixed rates get ${Fx.w}.</p>${q17 ? `<p>In Queensland 2017 One Nation and LNP voters moved about 0.7 on the logit scale away from Labor between the 2016 Senate vote and the 2017 count (the LNP put One Nation ahead of Labor that year). With each party’s statewide level set to the count, the Senate’s seat-by-seat pattern gets ${q17.winners} of ${T.qld17.seats} winners and ${q17.seats.lnp === T.qld17.actualSeats.lnp ? `the LNP’s ${q17.seats.lnp} seats exactly` : `the LNP ${q17.seats.lnp} seats against ${T.qld17.actualSeats.lnp} won`}: the pattern held, the level drifted.</p>` : ""}
     <p>Unfortunately, these counts cannot separate the Senate ballots from the grades on winners: what decides most seats is how far each party’s voters lean overall, not how that varies from seat to seat. The model reads the Senate because it covers every party’s voters in every seat, where the grades cover Coalition and Labor voters in Labor-v-One Nation races and give everyone else one rate everywhere. Taking minor parties one by one, rather than as one lump of others, cuts the typical seat’s miss on their counted 2025 flows from 8.1 to 5.2 points. The level drift, across these elections and the federal ones, is what sizes the model’s national preference errors.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>, and section 12 of the design review.</p>`,
    `<table class="md-tbl"><caption>Winners right; below, final pairs right and the typical two-candidate error</caption><thead><tr><th>Election</th>${SCH.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${stRows}</tbody></table><div class="sub">Bold: the most winners right of the first three columns, which use nothing from the count (the grades’ SA 2026 figure is partly fitted on it). The last column is a diagnostic, not a forecast: it borrows each party’s statewide preference level from the count.</div>`));
  // the federal backtests: every election from the one before (house flows) when the long run is in the
  // stores, with the 2019-2025 Senate-ballot runs quoted beside it; else the three Senate-ballot runs alone
  const FL = E.federalLong, cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const andList = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  if (FL && FL.rows.length) {
    const rows = FL.rows, n = rows.length, first = rows[0].E, last = rows[n - 1].E;
    const tot = (f) => rows.reduce((a2, r) => a2 + f(r), 0);
    const seatsAll2 = tot((r) => r.seats), W = tot((r) => r.modalRight), Wp = tot((r) => r.modalPlain ?? 0);
    const kBetter = rows.filter((r) => r.brierPlain != null && r.brier < r.brierPlain).length;
    // eras: the pooled Brier score with and without the terms before and from the noise rule’s recent window
    const era = (f) => { const rs = rows.filter(f), w = rs.reduce((a2, r) => a2 + r.seats, 0); return { t: rs.reduce((a2, r) => a2 + r.brier * r.seats, 0) / w, p: rs.reduce((a2, r) => a2 + r.brierPlain * r.seats, 0) / w, n: rs.length }; };
    const RF2 = E.swing.sigMult?.recentFrom ?? 2016, early = era((r) => r.E < RF2), recent = era((r) => r.E >= RF2);
    const eraTxt = early.n && recent.n ? (early.t < early.p && recent.t < recent.p ? "The terms helped in the earlier elections and the recent ones alike."
      : early.t < early.p ? `Pooled, the gain is in the elections before ${RF2}: from ${RF2} on, the version without the terms scored slightly better overall. The two terms pull opposite ways in seats that changed hands last time, the new member’s personal vote against part of the swing going back, and which wins has varied from one election to the next.`
      : recent.t < recent.p ? `The gain is in the elections from ${RF2} on; before that the version without the terms scored slightly better.`
      : "Unfortunately, the terms did not improve the chances it gave over the version without them.") : "";
    const inside = (r, k) => r.actual[k] >= r.range90[k][0] && r.actual[k] <= r.range90[k][1];
    const miss = (k, nm) => rows.filter((r) => !inside(r, k)).map((r) => `${r.E}, when ${nm} won ${r.actual[k]} against a range of ${r.range90[k][0]} to ${r.range90[k][1]}`);
    const mA = miss("alp", "Labor"), mL = miss("lnp", "the Coalition");
    const sen = fed.length ? `On the Senate ballots, as the model reads them for 2028, the ${andList(fed.map((r) => String(r.E)))} runs picked ${andList(fed.map((r) => String(r.modalRight)))} winners.` : "";
    const longRows = rows.map((r) => `<tr><td>${r.E}</td><td>${r.modalRight}/${r.seats}<div class="md-fine">${r.modalPlain} without terms</div></td><td>${r.pairsRight}/${r.seats}</td><td>${fx1(r.tcpMaePts)}</td><td>${Math.round(r.expected.alp)} v ${r.actual.alp}</td><td>${Math.round(r.expected.lnp)} v ${r.actual.lnp}</td></tr>`).join("");
    T2.push(step("", `${cap(word(n))} federal elections, each from the one before`,
      `<p>The whole chain run for every federal election from ${first} to ${last} with only what was known at the one before: its seats and results, its House preference flows, the seat terms and noise fitted on earlier elections only, and each election’s actual national vote and candidates given, so that what is tested is the step from votes to seats. Before 2016 the Senate ballots show no voter’s own order, so these runs take each party’s preferences from the previous House count, set on the shape of the 2016 Senate ballots.</p>
       <p>With the seat terms the chain picked ${W.toLocaleString("en-AU")} of ${seatsAll2.toLocaleString("en-AU")} winners, against ${Wp.toLocaleString("en-AU")} without them, and the chances it gave scored better in ${word(kBetter)} of the ${word(n)} elections. ${eraTxt}</p>
       <p>Labor’s seat total landed inside the model’s 90% range in ${word(rows.filter((r) => inside(r, "alp")).length)} of the ${word(n)} elections${mA.length ? ` (not in ${mA.join("; ")})` : ""}, and the Coalition’s in ${word(rows.filter((r) => inside(r, "lnp")).length)}${mL.length ? ` (not in ${mL.join("; ")})` : ""}. ${sen} When nearly every final pair is Labor against the Coalition, preferences barely move seats, so these runs test the swing and the noise more than the preferences.</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-long.mjs">backtest-long.mjs</a>, <a href="${GH}.build/analysis/seat-model/backtest-chain.mjs">backtest-chain.mjs</a>.</p>`,
      `<table class="md-tbl"><caption>National vote given, ${FL.draws.toLocaleString("en-AU")} simulations each</caption><thead><tr><th>Election</th><th>Winners right</th><th>Final pairs right</th><th>Two-candidate error</th><th>Labor seats, model v actual</th><th>Coalition</th></tr></thead><tbody>${longRows}</tbody></table>`));
  } else {
    T2.push(step("", "Three federal elections, from three years before",
      `<p>The whole chain run for 2019, 2022 and 2025 with only what was known three years earlier: the previous election’s seats, Senate ballots and House flows, with settings fitted on earlier elections only, and each election’s actual national vote given, so that what is tested is the step from votes to seats.</p>
       <p>When nearly every final pair is Labor against the Coalition, preferences barely move seats, so these runs test the swing and the noise more than the preferences.</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-chain.mjs">backtest-chain.mjs</a>.</p>`,
      `<table class="md-tbl"><caption>National vote given, ${E.federal.draws.toLocaleString("en-AU")} simulations each</caption><thead><tr><th>Election</th><th>Winners right</th><th>Final pairs right</th><th>Two-candidate error</th><th>Labor seats, model v actual</th><th>Coalition</th><th>Independents</th></tr></thead><tbody>${fedRows}</tbody></table>`));
  }
  /* independents: every election run twice, as the model treated them until v2.3 and drawn from the record as it
     then stood (evidence.json independents.backtest, from backtest-long.mjs terms-ind28 / terms-indrec). Rules:
     a score is "better" or "worse" only past a margin (0.002 on the log score, 0.0005 on the Brier score: about
     the run-to-run noise of 2,000 simulations), else "the same"; the log score is nearer zero when better, the
     Brier score lower. */
  const BT = IN?.backtest;
  if (BT && BT.rows.length) {
    const A = BT.all, Rr = BT.recent, Ee = BT.early, nE = BT.rows.length, y0 = BT.rows[0].E, y1 = BT.rows[nE - 1].E;
    const cmp = (after, before, tol) => (after < before - tol ? "better" : after > before + tol ? "worse" : "same");
    const logV = cmp(-A.after.logScore, -A.before.logScore, 0.002), brR = Rr.before ? cmp(Rr.after.brier, Rr.before.brier, 0.0005) : null, brE = Ee.before ? cmp(Ee.after.brier, Ee.before.brier, 0.0005) : null;
    const f3 = (x) => x.toFixed(3).replace("-", "−"), f4 = (x) => x.toFixed(4);
    const logTxt = `On the log score, which punishes most a forecast that calls something impossible and then sees it happen, the record scores ${logV === "better" ? "better" : logV === "worse" ? "worse" : "the same"}: ${f3(A.after.logScore)} against ${f3(A.before.logScore)}, where nearer zero is better.`;
    const eraWord = (v) => (v === "better" ? "better" : v === "worse" ? "a little worse" : "the same");
    const brTxt = brR && brE ? `On the Brier score, which rewards being roughly right in every seat, it scores ${eraWord(brR)} over the elections from ${BT.recentFrom} (${f4(Rr.after.brier)} against ${f4(Rr.before.brier)}; lower is better) and ${brE === brR ? "the same before them" : eraWord(brE) + " before them"} (${f4(Ee.after.brier)} against ${f4(Ee.before.brier)})${brE === "worse" ? ", when independents were rare and the record still gave every seat a small chance that mostly never came" : ""}.` : "";
    const cautious = A.after.expectedInd < A.after.actualInd - 0.5 ? " The record is still cautious: independents won more seats than it expected." : A.after.expectedInd > A.after.actualInd + 0.5 ? " The record expected more than independents won." : "";
    const two = (a, b) => `${a}<div class="md-fine">${b}</div>`;
    const btRows = BT.rows.map((r) => `<tr><td>${r.E}</td><td>${r.actualInd}</td><td>${two(fx1(r.after.expectedInd), fx1(r.before.expectedInd))}</td><td>${two(f4(r.after.brier), f4(r.before.brier))}</td><td>${two(f3(r.after.logScore), f3(r.before.logScore))}</td></tr>`).join("");
    T2.push(step("", "Independents: the record against the old treatment",
      `<p>Each election from ${y0} to ${y1} was run twice from what was known at the one before: with independents as the model treated them until this version (sitting members moving with the vote for others, last time’s losing independents standing again as minor candidates, nobody new), and drawn from the record as it then stood. Neither run was told who the independents would be.</p>
       <p>Independents won ${A.after.actualInd} seats over those ${word(nE)} elections, sitting members included. The old treatment expected ${fx1(A.before.expectedInd)} and the record ${fx1(A.after.expectedInd)}.${cautious}</p>
       <p>${logTxt} ${brTxt}</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-long.mjs">backtest-long.mjs</a> (terms-ind28, terms-indrec).</p>`,
      `<table class="md-tbl"><caption>Independents elected, and what the record expected; beneath each figure, the old treatment’s</caption><thead><tr><th>Election</th><th>Elected</th><th>Expected</th><th>Brier score</th><th>Log score</th></tr></thead><tbody>${btRows}</tbody></table>
       <div class="sub">National vote given, ${(FL ? FL.draws : 2000).toLocaleString("en-AU")} simulations each. Scores are over every seat: a lower Brier score is better, and a log score nearer zero.</div>`));
  }
  // calibration: the long run’s pooled bins when present. Rules: the middle bins line up when no gap tops 5
  // points; each edge bin is "too sure" / "too cautious" when the observed rate is off the predicted by more
  // than the larger of 1 point and half the prediction, else "close"
  const calSrc = FL && FL.calibration ? FL.calibration : E.federal.calibration, nTests = FL && FL.rows.length ? FL.rows.length : fed.length;
  const cal = Object.entries(calSrc).map(([bin, v]) => ({ bin, p: v.p / v.n, o: v.o / v.n, n: v.n })).sort((x, y) => parseFloat(x.bin) - parseFloat(y.bin));
  // middle bins: "too cautious" when the underdog bins (below 50%) came in more than 3 points under their
  // prediction on average and the favourite bins (above) more than 3 over; "too sure" for the reverse; else they
  // line up (no gap over 5 points) or are "off by up to" the largest gap. Edges: the bottom bin's hits against
  // its prediction, by the larger of 1 point and half the prediction (top bin alike, on misses).
  const pc1 = (x) => fx1(100 * x), lo = cal[0], hi = cal[cal.length - 1], mid = cal.slice(1, -1);
  const under = mid.filter((c) => parseFloat(c.bin.split("-")[1]) <= 0.5), over = mid.filter((c) => parseFloat(c.bin) >= 0.5);
  const avg = (xs) => xs.reduce((x, c) => x + (c.o - c.p), 0) / (xs.length || 1), gU = avg(under), gO = avg(over), midGap = Math.max(0, ...mid.map((c) => Math.abs(c.o - c.p)));
  const binTxt = (c) => { const [a2, b2] = c.bin.split("-").map((x) => Math.round(100 * +x)); return parseFloat(c.bin) >= 0.5 ? `favourites it rated ${a2}–${b2}% won ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` : `seats it rated ${a2}–${b2}% happened ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted`; };
  const worst = (xs) => [...xs].sort((x, y) => Math.abs(y.o - y.p) - Math.abs(x.o - x.p))[0];
  const midVerdict = gU < -0.03 && gO > 0.03 ? "cautious" : gU > 0.03 && gO < -0.03 ? "sure" : midGap <= 0.05 ? "close" : "off";
  const midTxt = midVerdict === "cautious" ? `in the middle, where the close seats are, it was too cautious: ${binTxt(worst(under))}, and ${binTxt(worst(over))}`
    : midVerdict === "sure" ? `in the middle, where the close seats are, it was too sure: ${binTxt(worst(under))}, and ${binTxt(worst(over))}`
    : midVerdict === "close" ? "the chances it gave and how often things happened line up closely in the middle, where the close seats are" : `in the middle, where the close seats are, the chances it gave were off by up to ${Math.round(100 * midGap)} points`;
  const edge = (c, under2) => { const off = c.o - c.p, tol = Math.max(0.01, 0.5 * (under2 ? c.p : 1 - c.p)); const verdict = under2 ? (off > tol ? "too sure" : off < -tol ? "too cautious" : "close") : (off < -tol ? "too sure" : off > tol ? "too cautious" : "close"); return { verdict, txt: under2 ? `seats it rated under 10% happened ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` : `favourites it rated over 90% won ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` }; };
  const eLo = edge(lo, true), eHi = edge(hi, false), vb = (v, again) => (v === "close" ? (again ? "close too" : "close") : `a little ${v}`);
  const edgeTxt = eLo.verdict === eHi.verdict ? `At the edges it was ${vb(eLo.verdict, midVerdict === "close" && eLo.verdict === "close")}: ${eLo.txt}, and ${eHi.txt}.` : `At the bottom it was ${vb(eLo.verdict)}: ${eLo.txt}. At the top it was ${vb(eHi.verdict)}: ${eHi.txt}.`;
  // the eras: the multiplier's cost in calmer elections, and the recent window's edges with its upsets
  let eraCal = "";
  if (FL && FL.calibrationEarly && FL.calibrationRecent) {
    const binsOf = (o) => Object.entries(o).map(([bin, v]) => ({ bin, p: v.p / v.n, o: v.o / v.n })).sort((x, y) => parseFloat(x.bin) - parseFloat(y.bin));
    const cE = binsOf(FL.calibrationEarly), cR = binsOf(FL.calibrationRecent), gapOf = (xs) => Math.max(0, ...xs.slice(1, -1).map((c) => Math.abs(c.o - c.p)));
    const parts = [];
    if (midVerdict === "cautious" && gapOf(cE) > gapOf(cR)) parts.push(`Most of that caution is in the calmer elections before ${FL.recentFrom}, where the same ${fm(SM?.value ?? 1.3)} multiple drew more noise than they needed.`);
    const rLo = edge(cR[0], true), U = FL.recentUpsets;
    if (rLo.verdict === "too sure") parts.push(`From ${FL.recentFrom} on it was a little too sure at the edges: ${rLo.txt}${U && U.n ? `; ${word(U.indOth)} of those ${word(U.n)} upsets were independents or minor-party members, whom no starting point foresees` : ""}.`);
    eraCal = parts.join(" ");
  }
  T2.push(step("", "Are its chances honest?",
    `<p>When the model gives a seat a 70% chance, the favourite should win about seven times in ten. Pooled over the ${word(nTests)} federal tests, ${midTxt}. ${edgeTxt}${eraCal ? " " + eraCal : ""}</p>`,
    `<div class="cap">Chance given v how often it happened</div><div id="fig-cal"></div><div class="sub">Every seat and party in the ${word(nTests)} federal tests, grouped by the chance the model gave.</div>`));
  $("#tests-body").innerHTML = T2.join("");
  calChart($("#fig-cal"), cal);

  $("#limits-body").innerHTML = [
    ["How-to-vote cards", "The model assumes parties recommend preferences much as they did in 2025, when the Coalition put One Nation ahead of Labor almost everywhere. If the Coalition’s card put Labor first instead, the many Labor-v-One Nation seats would swing to Labor; the explorer has a button for it."],
    ["Who stands", `Nobody is nominated yet. The model assumes the parties’ 2025 candidates, with One Nation and the Greens everywhere, and every sitting member standing again unless they have said otherwise${TM ? `: a retirement costs the party that member’s personal vote, about ${pts2(TM.alp.incE, "alp")} points` : ""}.`],
    ["Independents", IN ? "Unfortunately, no independent challenger is a named person yet. Each seat’s challenge is a draw from the record of seats like it, so the model can say how often independents win seats of that kind and cannot say which campaigns will be the strong ones. Sitting independents are assumed to stand again." : "A sitting independent’s vote carries over, moved by the national swing to others and with extra noise. Their personal votes and campaigns are not modelled."],
    ["Boundaries", "Seats are 2025’s. Tasmania, South Australia and the ACT were redrawn in July 2026, and Queensland’s redistribution is due to finish in September 2027. The model does not yet move the 2025 vote onto the new boundaries."],
    ["The campaign", "Nothing here knows about events between now and the election. The election-day mode widens the errors for that, as history says it should, but cannot say which way they will go."],
    ["The polls", "The national vote is the polls’ average. If every pollster is wrong in the same direction, as in 2019, the model inherits it; the polling error it draws is the size such misses have been."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("");
  const D = (p, l, n) => `<a href="${p}"><span>${l}</span><span>${n}</span></a>`;
  $("#files-meta").textContent = `Model run ${longDate(a.modelRun)}, polls to ${longDate(a.pollsTo)}`;
  $("#files-body").innerHTML = [
    D("/data/seat-model-2028-nowcast.json", "Official run, if held today", "JSON"), D("/data/seat-model-2028-forecast.json", "Official run, election day", "JSON"),
    D("/data/senate-rankings-2025.json", "Senate ballot orders by seat, 2025", "JSON"), D(GH + "data", "Senate ballot orders 2016–2022, calibration, backtests", "data/"),
    D(GH + ".build/analysis/seat-model-design-review.md", "The design review: every test and decision", "Markdown"), D(GH + ".build/analysis/seat-model", "The model’s code", "GitHub"),
    D("/model/data/inputs.json", "What this page’s explorer runs on", "JSON"), D("/data/seat-model-2028-history.jsonl", "Every official run so far", "JSONL"),
  ].join("");
}
function calChart(host, cal) {
  const W = Math.max(260, host.clientWidth || 360), H = Math.min(260, W * 0.7), m = { l: 34, r: 12, t: 8, b: 26 };
  const X = (v) => m.l + (W - m.l - m.r) * v, Y = (v) => m.t + (H - m.t - m.b) * (1 - v);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Calibration: predicted against observed" }, host);
  const g = svg("g", { class: "grid" }, s);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); svg("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, s).textContent = `${Math.round(100 * v)}%`; svg("text", { x: X(v), y: H - 7, "text-anchor": "middle" }, s).textContent = `${Math.round(100 * v)}%`; }
  svg("line", { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: "var(--ink-faint)", "stroke-dasharray": "4 3" }, s);
  const gp = svg("g", { class: "t-member" }, s);
  for (const c of cal) svg("circle", { cx: X(c.p), cy: Y(c.o), r: 3 + Math.sqrt(c.n) / 4, fill: "var(--ink-2)", "fill-opacity": 0.75 }, gp);
}

/* app-5b-vic.js: the Victorian view - its run and inputs load on first use (about 600 KB), the switch
   between the two elections, and the notes on how the Victorian model differs from the federal one.
   Every figure is read from data/seat-model-vic-2026.json and model/data/inputs-vic.json. */
let vicLoad = null;
const ensureVic = () => (vicLoad = vicLoad || Promise.all([getJSON(URLS.vic), getJSON(URLS.inputsVic)]).then(([r, i]) => { STATE.res.vic = r; STATE.vicInputs = i; }));

async function setJur(j, { scroll = false } = {}) {
  j = j === "vic" ? "vic" : "fed";
  if (j === STATE.jur) return;
  if (j === "vic") {
    for (const b of $$(".md-jur [data-jur]")) b.setAttribute("aria-busy", String(b.dataset.jur === "vic"));
    try { await ensureVic(); }
    catch (e) { const n = $("#md-note"); if (n) n.insertAdjacentHTML("beforeend", ` · <span style="color:var(--m-alp)">the Victorian run could not load (${esc(e.message)})</span>`); return; }
    finally { for (const b of $$(".md-jur [data-jur]")) b.removeAttribute("aria-busy"); }
  }
  STATE.jur = j;
  Object.assign(SEATS, { filter: "close", st: null, sort: null, shown: 20, open: new Set() });
  for (const x of $$("[data-f]", $("#seat-filters"))) x.setAttribute("aria-selected", String(x.dataset.f === "close"));
  for (const x of $$("[data-st]")) x.setAttribute("aria-pressed", String(!x.dataset.st));
  renderHead(); renderDist(); renderSeats(); renderJurSections(); EX.onJur();
  writeHash();
  if (scroll) $("#sh-content").scrollIntoView({ block: "start" });
}

function renderJurSections() {
  const vic = STATE.jur === "vic";
  for (const id of ["how", "tests", "limits", "files"]) $(`#${id}`).hidden = vic;
  $("#vic-how").hidden = !vic;
  if (vic && !$("#vic-steps").childElementCount) renderVic();
}

/* The Victorian method notes. Every figure is read from the run and inputs-vic.json's `evidence`; every
   claim of a difference is gated on its own test:
     - the polls' lean to a party is named only where its mean error over the state elections differs from
       zero at under 1 in 20 (a t-test across the elections; the critical value for n - 1 degrees of freedom)
     - the sitting-member terms are quoted with what the fit found, and the parties are pooled because their
       own estimates do not differ significantly (evidence.terms.partyDifference, a bootstrap over districts)
     - lists (cards, departures) are written from the stores, with their zero cases */
const T_CRIT = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
const tCrit = (df) => T_CRIT[Math.min(df, 30)] || 1.96;
const listAnd = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const nWord = (n) => (n >= 0 && n <= 10 ? ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] : String(n));
function renderVic() {
  const I = STATE.vicInputs, R = STATE.res.vic, a = I.asOf, now = I.vote.nowcast, was = I.vote.result2022, S = I.settings.vic, E = I.evidence;
  const days = Math.round((Date.parse(a.election) - Date.parse(a.pollsTo)) / 864e5);
  const P = [["lnp", "lnp", "the Coalition"], ["alp", "alp", "Labor"], ["on", "onp", "One Nation"], ["grn", "grn", "the Greens"], ["oth", "oth", "others"]];
  const byNow = P.slice().sort((x, y) => now[y[0]] - now[x[0]]);
  const sh = (k) => now[k] / 100, sigI = { alp: 0, lnp: 1, on: 2, grn: 3, oth: 4 }, pc0 = (x) => Math.round(100 * x);
  const Cap = (n) => n[0].toUpperCase() + n.slice(1);
  const voteTbl = `<table class="md-tbl"><caption>The vote, 2022 and now, and the polling error the model draws (one standard deviation, in points)</caption><thead><tr><th>Party</th><th>2022</th><th>Now</th><th>Change</th><th>Polling error</th></tr></thead><tbody>${P.map(([k, , n]) => `<tr><td>${Cap(n)}</td><td>${fx1(was[k])}</td><td>${fx1(now[k])}</td><td>${now[k] - was[k] >= 0 ? "+" : "−"}${fx1(Math.abs(now[k] - was[k]))}</td><td>±${fx1(ptsAt(S.sigNat[sigI[k]], sh(k)))}</td></tr>`).join("")}</tbody></table>`;
  const html = [];
  // ---- 1. the polls, and their error at state elections ----
  const PE = E.polls, pe = (k, kk) => fx1(ptsAt(PE.sigma[kk], sh(k))), fe = (k, kk) => fx1(ptsAt(PE.federal[kk], sh(k)));
  const lean = [["alp", "alp", "Labor"], ["lnp", "lnp", "the Coalition"], ["grn", "grn", "the Greens"]].filter(([, kk]) => Math.abs(PE.z[kk]) > tCrit(PE.elections - 1));
  const leanTxt = lean.length ? ` ${lean.map(([k, kk, n]) => `Across those elections the polls ${PE.bias[kk] > 0 ? "understated" : "overstated"} ${n} on average: its vote came in ${PE.bias[kk] > 0 ? "above" : "below"} the final month’s polls in ${PE.bias[kk] > 0 ? PE.above[kk] : PE.elections - PE.above[kk]} of the ${PE.elections}, by an average worth ${fx1(Math.abs(ptsAt(PE.bias[kk], sh(k))))} points at today’s vote, a significant lean (a t-test across the elections, at under 1 in 20).`).join(" ")} The model does not add ${lean.length > 1 ? "these leans" : "this lean"}: ${PE.federalBias && lean.some(([, kk]) => PE.federalBias[kk] * PE.bias[kk] < 0) ? "federal polls have leaned the other way, and " : ""}it draws its errors around the polls as they stand.` : "";
  html.push(step(1, "Start from the Victorian polls",
    `<p>The model starts from the /vic/ page’s polling average, its trend through the ${a.polls} Victorian polls of this term, to ${shortDate(a.pollsTo)}: <b>${byNow.map(([k, , n]) => `${n} ${fx1(now[k])}`).join(", ").replace(/, ([^,]+)$/, " and $1")}</b>. In 2022 Victoria voted Labor ${fx1(was.alp)}, the Coalition ${fx1(was.lnp)}, the Greens ${fx1(was.grn)} and One Nation ${fx1(was.on)}.</p>
     <p>With the election ${days} days after the latest poll, the polls’ error is drawn at the size state polls have shown. At the ${PE.elections} state elections from ${PE.from} to ${PE.to} with a polling record, the final month’s polls missed Labor by ±${pe("alp", "alp")} points at today’s vote, the Coalition by ±${pe("lnp", "lnp")} and the Greens by ±${pe("grn", "grn")}; the federal record gives ±${fe("alp", "alp")}, ±${fe("lnp", "lnp")} and ±${fe("grn", "grn")}, so state polls have been no less accurate than federal ones.${PE.onpLarge ? ` One Nation polled 5% or more at only ${nWord(PE.onpLarge.n)} of them, so its error keeps the federal model’s size.` : ""} The errors are linked and fat-tailed as in the federal model.</p>${leanTxt ? `
     <p>${leanTxt.trim()}</p>` : ""}
     <p class="src"><a href="/vic/">The /vic/ page</a>, <a href="${GH}.build/analysis/seat-model/calibrate-state-polls.mjs">calibrate-state-polls.mjs</a>, <a href="/data/state-election-final-polls.json">the state polling record</a>.</p>`, voteTbl));
  // ---- 2. the districts: who stands, sitting members, noise ----
  const F = E.field, T = E.terms, pf = pairsFigure(I.seats, (k) => k.tcp2022, R, 2022, "On 28 November, on average");
  const src = F.src, newInd = F.independents.all - F.independents.known.length;
  const at35 = (x) => fx1(Math.abs(ptsAt(x, 0.35)));
  const gone = F.members.gone, byP = (p) => gone.filter((g) => g.party === p).length;
  const goneTxt = [[byP("ALP"), "Labor"], [byP("L/N"), "Coalition"], [byP("GRN"), "Greens"], [byP("IND"), "independent"]].filter(([n]) => n).map(([n, w]) => `${n} ${w}`);
  const sameParty = Math.abs(T.partyDifference.rec / T.partyDifference.recSe) < 1.96 && Math.abs(T.partyDifference.ret / T.partyDifference.retSe) < 1.96;
  html.push(step(2, "Spread it across the seats",
    `<p>Each of the 88 seats starts from its 2022 count, on boundaries that stand for 2026, with the candidates the Victorian Electoral Commission declared when nominations closed: <b>${F.candidates} candidates</b>. Each party’s vote then moves by one shift on the logit scale, solved so the statewide totals come out exactly: the rule that predicted One Nation’s SA 2026 vote seat by seat.</p>
     <p>${src["2022"] + (src["same-person"] || 0)} candidates start from their party’s 2022 vote in the seat, or their own. One Nation stood in only five seats in 2022, so in all 88 it starts from its federal 2025 vote at the federal polling places nearest the seat’s own. ${src.council} candidates of minor parties that did not stand in their seat in 2022 start from the party’s upper-house vote there. The other ${src.median} are new: a party new to the ballot starts at the median 2022 minor-party candidate’s ${fx1(100 * F.medianMinor)}%, and an independent at the median 2022 independent’s ${fx1(100 * F.medianIndependent)}%.</p>
     <p>${F.independents.all} independents stand in ${F.independents.districts} seats, and only ${F.independents.known.length} of them stood in the same seat in 2022. Unfortunately, nothing tells the model which of the other ${newInd} is strong. It gives each the spread of 2022’s ${F.independents2022} independents around that ${fx1(100 * F.medianIndependent)}%, wide enough that an independent wins in some simulations without the model naming one${R.national.expectedSeats.member >= 0.05 ? `: ${fx1(R.national.expectedSeats.member)} seats on average` : ""}.</p>
     <p><b>Sitting members.</b> ${F.members.standing} of the 88 sitting members stand again; ${gone.length} do not (${listAnd(goneTxt)}). At four state elections fought on unchanged boundaries (${E.districts.pairs.map((p) => p.label).join(", ").replace(/, ([^,]+)$/, " and $1")}), a member standing again was worth ${at35(T.rec)} points on a 35% vote, and a party whose member had gone lost ${at35(T.ret)}, each measured against seats the party did not hold. ${sameParty ? "Labor’s and the Coalition’s own figures do not differ significantly (a bootstrap over seats), so one pair serves both parties and the Greens." : "Labor’s and the Coalition’s own figures differ, and each party keeps its own."}</p>
     <p>Seats then stray from the rule by the amounts those four elections show, a little more than federal seats do. Labor strays most, because it has fallen furthest since 2022: ${R.meta.sigmaSeat.alp.toFixed(2)} on the logit scale, against ${R.meta.sigmaSeat.lnp.toFixed(2)} for the Coalition.</p>
     <p>In 2022, ${pf.p25["alp v lnp"] || 0} of the 88 counts ended with Labor against the Coalition. On these polls about ${Math.round(pf.p28["alp v lnp"] || 0)} would, and about ${Math.round((pf.p28["alp v on"] || 0) + (pf.p28["lnp v on"] || 0))} would end with One Nation in the final two.</p>
     <p class="src"><a href="/data/vic-candidates-2026.json">The nominations</a>, <a href="${GH}.build/analysis/seat-model/vic-field.mjs">vic-field.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-state-swing.mjs">calibrate-state-swing.mjs</a>.</p>`, pf.html));
  // ---- 3. preferences: Victoria's counts, respondents where there is no count, the cards ----
  const flowRow = (key, label) => { const v = I.seats.filter((s) => s.flows[key] != null); if (!v.length) return ""; const avg = v.reduce((n, s) => n + s.w * s.flows[key], 0) / v.reduce((n, s) => n + s.w, 0), xs = v.map((s) => s.flows[key]); return `<tr><td style="white-space:normal">${label}</td><td>${Math.round(100 * avg)}%</td><td>${Math.round(100 * Math.min(...xs))}–${Math.round(100 * Math.max(...xs))}%</td></tr>`; };
  const v22 = E.vic22.replay, sen = v22["Senate ballots (this model)"], fixed = v22["W5 constants"], grades = v22["design review: seat-type grades"];
  const C = E.calibration, X = E.cells, RSP = E.respondents;
  const cellRow = (k, label) => (X[k] && X[k].respondents != null ? `<tr><td style="white-space:normal">${label}</td><td>${pc0(X[k].federal)}%</td><td>${pc0(X[k].respondents)}%</td><td><b>${pc0(X[k].model)}%</b></td></tr>` : "");
  const cellRows = cellRow("on", "One Nation voters putting Labor ahead of the Coalition") + cellRow("coalOn", "Coalition voters putting Labor ahead of One Nation") + cellRow("grnOn", "Greens voters putting Labor ahead of One Nation") + cellRow("othOn", "Minor-party voters and independents’ voters putting Labor ahead of One Nation");
  const houses = [...new Set(Object.values(X).flatMap((c) => c.respondentPolls || []).map((t) => t.replace(/ \d{4}-\d{2}-\d{2}.*$/, "")))];
  const sF = (E.sens || []).find((x) => x.k === "federal"), sR = (E.sens || []).find((x) => x.k === "respondents");
  const sensTxt = cellRows && sF && sR ? ` The choice moves seats. On the federal readings alone the Coalition would average ${Math.round(sF.expected.lnp)} seats and One Nation ${Math.round(sF.expected.on)}, with a Coalition majority in ${pc0(sF.majority.coalition)}% of simulations; on the respondents alone, ${Math.round(sR.expected.lnp)} and ${Math.round(sR.expected.on)}, and ${pc0(sR.majority.coalition)}%.` : "";
  /* why halfway, from the readings themselves: the first Victorian reading of One Nation's voters against the
     count it followed (matched = within 3 points), and how far the reading has moved since (moved = 3 points
     or more; under that, the two ends agree and the sentence says so) */
  const f1 = RSP.first, on = X.on;
  const whyHalf = !(f1 && on && on.respondents != null) ? "" : (() => {
    const mon = new Date(f1.end + "T00:00:00Z").toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
    const matched = Math.abs(f1.on - on.federal) < 0.03, moved = Math.abs(on.respondents - f1.on) >= 0.03;
    const a = ` The first Victorian reading, in ${mon}, put One Nation’s voters at ${pc0(f1.on)}% for Labor, ${matched ? `matching the ${pc0(on.federal)}% counted in Victoria at the 2025 federal election, so respondents are worth hearing` : `against the ${pc0(on.federal)}% counted in Victoria at the 2025 federal election`}.`;
    const b = moved ? ` Since then the reading has ${on.respondents < f1.on ? "fallen" : "risen"} to ${pc0(on.respondents)}%, and no count has yet tested a reading that moved.` : ` The reading has barely moved since (${pc0(on.respondents)}%), so the two ends are close.`;
    return a + b;
  })();
  const CD = E.cards, tl = CD.tally, inList = (xs) => listAnd(xs.map((x) => x.district));
  const openOf = (p) => CD.open.filter((x) => x.party === p), flipOf = (ps) => CD.flip.filter((x) => ps.includes(x.party));
  const labOpen = openOf("Labor"), coalOpen = [...openOf("Liberal"), ...openOf("National")], coalFlip = flipOf(["Liberal", "National"]);
  const cardsTxt = `<p><b>How-to-vote cards.</b> The cards registered with the Commission were read for every seat. They follow the pattern the federal ballots were cast under almost everywhere. Labor’s card puts the Greens, then the Coalition, then One Nation in ${tl.labor.pattern} seats${labOpen.length ? ` and numbers only its own candidate in ${inList(labOpen)}` : ""}. The Liberal or National card puts One Nation ahead of Labor, and Labor ahead of the Greens, in ${tl.coalition.pattern}${coalFlip.length ? `; it puts Labor ahead of One Nation in ${inList(coalFlip)}` : ""}${coalOpen.length ? `, and numbers only its own candidate in ${inList(coalOpen)}` : ""}${CD.missing.length ? ` (none was registered in ${inList(CD.missing)})` : ""}. One Nation’s card puts the Coalition ahead of Labor in ${tl.on.pattern === 88 ? "all 88" : tl.on.pattern}. Where a card departs from the pattern, the model moves that party’s voters by what a card proved to be worth the one time a major party reversed its own: when the Liberal card switched from the Greens to Labor between the 2010 and 2013 federal elections, Coalition voters’ preferences to Labor went from ${pc0(CD.against)}% to ${pc0(CD.with)}% in Melbourne and Batman. A card that now points the other way moves its voters that far, on the logit scale; a card that numbers only its own candidate, half as far.</p>`;
  const pubC = E.published && E.published.coalition, pubO = E.published && E.published.on;
  html.push(step(3, "Order every voter’s preferences",
    `<p>No record of Victorian ballots shows each voter’s whole order, so the model reads the federal Senate’s, as it does federally: for each seat, the 2025 Senate ballots cast at the federal polling places nearest its own, adjusted for how lower-house voters differ from Senate voters.</p>
     <p><b>Where Victoria has a count, the count sets the level.</b> Counted on Victoria’s 2022 primaries, the 2022 Senate ballots read this way would have sent ${pc0(C.grn.senate)}% of the Greens’ preferences and ${pc0(C.oth.senate)}% of minor parties’ and independents’ to Labor over the Coalition; the Commission’s 2022 counts show ${pc0(C.grn.target)}% and ${fx1(100 * C.oth.target)}%. One shift for each group closes that gap and is carried into 2026.</p>
     ${cellRows ? `<p><b>Where it has none, respondents help.</b> Victoria has never counted a choice involving One Nation at anything like this size. For those the model starts from the federal reading and moves halfway, on the logit scale, to what Victorians tell pollsters about their own preferences (${listAnd(houses)}, the waves of the six weeks to ${shortDate(RSP.to)}). Halfway is a judgement.${whyHalf}${sensTxt}</p>` : ""}
     ${cardsTxt}
     <p>At these primaries the model’s preferences give Labor <b>${fx1(100 * E.tppModel)}%</b> of the two-party vote against the Coalition${pubC ? `; the ${pubC.polls} polls publishing a figure since ${shortDate(E.published.from)} range from ${fx1(pubC.lo)} to ${fx1(pubC.hi)}` : ""}. Against One Nation it gives Labor ${fx1(100 * E.tppOnModel)}%${pubO ? ` (${pubO.polls} polls: ${fx1(pubO.lo)} to ${fx1(pubO.hi)})` : ""}.</p>
     <p>Before any Victorian level was set, the Senate reading counted on 2022’s actual primaries picked <b>${sen.winners} of the 88 winners</b> and ${sen.pairs} of the final pairs (the fixed rates of the model’s first version ${fixed.winners}, rates graded by seat type ${grades.winners}); setting the levels from the same count leaves no out-of-sample test of them.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/state-tables.mjs">state-tables.mjs</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>, <a href="/data/vic-htv-2026.json">the cards as read</a>, <a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>.</p>`,
    `${cellRows ? `<table class="md-tbl"><caption>The levels Victoria has never counted</caption><thead><tr><th>Voters</th><th>Federal reading</th><th>Victorian respondents</th><th>Model</th></tr></thead><tbody>${cellRows}</tbody></table><div class="sub">Federal reading: One Nation’s voters at the 2025 federal count in Victoria; the others from the 2025 Senate ballots. Respondents: ${Object.values(X)[0].respondentPolls.length} waves, weighted by sample.</div>` : ""}
     <table class="md-tbl" style="margin-top:14px"><caption>The preferences the model holds, across the 88 seats</caption><thead><tr><th>Voters</th><th>Average</th><th>Seat range</th></tr></thead><tbody>${flowRow("coalLaborOverOn", "Coalition voters putting Labor ahead of One Nation")}${flowRow("laborCoalitionOverOn", "Labor voters putting the Coalition ahead of One Nation")}${flowRow("onLaborOverCoalition", "One Nation voters putting Labor ahead of the Coalition")}${flowRow("greensLaborOverCoalition", "Greens voters putting Labor ahead of the Coalition")}</tbody></table><div class="sub">After the Victorian levels and the cards; averages weighted by each seat’s 2022 vote. The ranges are widest where a card departs from the pattern.</div>`));
  // ---- 4. the count and the simulation ----
  const chain = E.sa26chain["Senate ballots (this model)"], cen = R.national.central, exp = R.national.expectedSeats;
  const gap = (k) => exp[k] - cen[k], far = ["alp", "lnp", "on"].map((k) => [k, gap(k)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
  const NM = { alp: "Labor", lnp: "the Coalition", on: "One Nation" };
  const cenTxt = Math.abs(far[1]) >= 1.5 ? ` The central projection, one election with every error at zero, gives Labor ${cen.alp}, the Coalition ${cen.lnp} and One Nation ${cen.on}. The averages differ most for ${NM[far[0]]} (${fx1(exp[far[0]])} against ${cen[far[0]]}): ${far[1] > 0 ? "it trails narrowly in many seats at the centre and wins some of them once the errors are drawn" : "it leads narrowly in many seats at the centre and loses some of them once the errors are drawn"}.` : ` The central projection, one election with every error at zero, gives Labor ${cen.alp}, the Coalition ${cen.lnp} and One Nation ${cen.on}, close to the averages.`;
  html.push(step(4, "Count, and simulate",
    `<p>The count and the simulation are the federal model’s: every seat counted as the Commission counts it, from the last candidate up, with each group of voters’ whole order replayed at every exclusion; ${R.meta.draws.toLocaleString("en-AU")} simulated elections, each drawing the polling error, the seat noise, seat-type and education shocks and the preference drift afresh.</p>
     <p>The averages are the forecast.${cenTxt}</p>
     <p>The nearest test of a surge like One Nation’s is SA 2026, where it went from 2.6% to 22.9%. Run the same way from the federal footprint with the statewide totals given, the chain picked the likeliest winner in ${chain.modal} of ${E.sa26.seats} seats.</p>
     <p>The engine and every borrowed setting are set out in full in <a href="#how" data-jur-go="fed">the federal view</a>.</p>`, ""));
  const changed = I.seats.filter((s) => s.won2022 && BUCKET(s.won2022.group) !== BUCKET(s.held.group));
  const medians = (F.src.median || 0);
  $("#vic-steps").innerHTML = html.join("") + `<div class="md-limits">${[
    ["New candidates", `${medians} of the ${F.candidates} candidates have no 2022 vote in their seat, their own or their party’s, and start at a median. The model cannot know which new independent or new party will do far better than that; it only allows for it.`],
    ["Changes since 2022", `The starting vote is the 2022 count. By-elections and departures since change who sits and who stands, which the sitting-member terms use, and nothing else.${changed.length ? ` ${listAnd(changed.map((s) => `${esc(s.name)} (now ${s.held.party === "L/N" ? "Liberal" : s.held.party === "IND" ? "independent" : esc(s.held.party)})`))} changed hands or members’ parties.` : ""} A candidate disendorsed after nominations closed stays on the ballot paper under the party’s name and is counted as its candidate. The cards are those on the Commission’s register on ${shortDate(CD.listed)}.`],
    ["Borrowed pieces", "The engine, the shape of each group’s preferences, the extra noise a falling party carries, and the seat-type and education shocks are the federal model’s, fitted on federal elections and the Senate. No age or gender term: no Victorian baseline poll measures them."],
    ["The upper house", "The Legislative Council is not modelled."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
  <p class="md-fine" style="margin-top:18px">The run: <a href="/data/seat-model-vic-2026.json">data/seat-model-vic-2026.json</a> · what the explorer runs on: <a href="/model/data/inputs-vic.json">inputs-vic.json</a> · the code: <a href="${GH}.build/analysis/seat-model/vic-simulate.mjs">vic-simulate.mjs</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>.</p>`;
}

/* app-6-boot.js: load the official runs and the page's data, draw everything, wire the mode switch,
   restore a shared scenario from the address, and redraw the charts when the page changes width. */
(async function boot() {
  try {
    const [nowcast, forecast, inputs, evidence] = await Promise.all([getJSON(URLS.nowcast), getJSON(URLS.forecast), getJSON(URLS.inputs), getJSON(URLS.evidence)]);
    Object.assign(STATE, { res: { nowcast, forecast }, inputs, evidence });
  } catch (e) {
    const n = $("#md-note"); if (n) n.insertAdjacentHTML("beforeend", ` · <span style="color:var(--m-alp)">the page’s data could not load (${esc(e.message)}); the head above is the official run</span>`);
    return;
  }
  const q = readHash();
  STATE.mode = q.mode === "forecast" ? "forecast" : "nowcast";
  for (const b of $$(".md-modes .rd-tab")) b.setAttribute("aria-selected", String(b.dataset.mode === STATE.mode));
  if (STATE.mode !== "nowcast") renderHead();
  renderDist(); renderSeats(); renderEvidence();
  // the changing-hands reasons load behind the page; an open card redraws when they land
  getJSON(URLS.reasons).then((r) => { STATE.reasons = r; }, () => { STATE.reasons = false; }).then(() => { if (SEATS.open.size) renderSeats(); });
  $(".md-modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== STATE.mode) setMode(b.dataset.mode); });
  $(".md-modes").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = STATE.mode === "nowcast" ? "forecast" : "nowcast"; setMode(next); $(`#mode-${next}`).focus();
  });
  $(".md-jur").addEventListener("click", (e) => { const b = e.target.closest("[data-jur]"); if (b) setJur(b.dataset.jur); });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-jur-go]"); if (!a) return; e.preventDefault(); setJur(a.dataset.jurGo).then(() => $(a.getAttribute("href")).scrollIntoView({ block: "start" })); });
  if (q.j === "vic") await setJur("vic");
  if (EX.applyHash(q)) $("#explore").scrollIntoView({ block: "start" }); else if (STATE.jur !== "vic") EX.init();
  let lastW = innerWidth;
  addEventListener("resize", debounce(() => { if (Math.abs(innerWidth - lastW) < 8) return; lastW = innerWidth; renderDist(); const n = $("#fig-noise"), c = $("#fig-cal"); if (n && c) { renderEvidence(); } }, 150));
  window.__model = { STATE, EX };
})();

})();
