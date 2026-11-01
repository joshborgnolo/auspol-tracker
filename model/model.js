/* the Election model – assembled from .build/model by .build/model/assemble.mjs; edit the parts, not this file */
(() => {
"use strict";
const URLS = {"nowcast":"/data/seat-model-2028-nowcast.json?v=11c9b6df","forecast":"/data/seat-model-2028-forecast.json?v=06ae23e2","inputs":"/model/data/inputs.json?v=58d5a3e2","evidence":"/model/data/evidence.json?v=3fcf9692","senate":"/data/senate-rankings-2025.json?v=edeb9db9","worker":"/model/js/worker.mjs?v=eff3432f"};
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

function headline(res, mode) {
  const nat = res.national;
  const cands = ["alp", "lnp", "on"].sort((a, b) => nat.mostSeats[b] - nat.mostSeats[a]);
  const L = cands[0], pMost = nat.mostSeats[L], pMaj = nat.majority[MAJ_KEY[L]];
  const who = PARTY[L].name, now = mode !== "forecast";
  const clause = pMaj < 0.2 ? "probably short of a majority" : pMaj < 0.4 ? "more likely short of a majority than not" : "with a majority about as likely as not";
  if (pMaj >= 0.9) return now ? `${who} would win a majority` : `${who} is very likely to win a majority`;
  if (pMaj >= 0.6) return now ? `${who} would probably win a majority` : `${who} is likely to win a majority`;
  if (pMost >= 0.9) return now ? `${who} would win the most seats, ${clause}` : `${who} is very likely to win the most seats, ${clause}`;
  if (pMost >= 0.6) return now ? `${who} would probably win the most seats, ${clause}` : `${who} is favoured to win the most seats, ${clause}`;
  return "No party is clearly ahead on seats";
}

/* "In 20,000 simulated elections held on the polls to 27 October, Labor wins 71 seats on average (51 to 90
   in nine of ten), One Nation 36 (13 to 63) and the Coalition 31 (15 to 48). Labor reaches the 76 seats
   needed to govern alone in 38% of them." - parties in order of expected seats */
function dek(res, mode, asOf) {
  const nat = res.national, d = nat.seatDistribution, e = nat.expectedSeats;
  const [a, b, c] = ["alp", "on", "lnp"].sort((x, y) => e[y] - e[x]);
  const sims = res.meta.draws.toLocaleString("en-AU");
  const lead = mode === "forecast"
    ? `Projected to election day, ${sims} simulated elections from the polls to ${shortDate(asOf)} give ${PARTY[a].lower}`
    : `In ${sims} simulated elections held on the polls to ${shortDate(asOf)}, ${PARTY[a].lower} wins`;
  const rest = (k) => `${PARTY[k].lower} ${Math.round(e[k])} (${d[k].p05} to ${d[k].p95})`;
  const pMaj = nat.majority[MAJ_KEY[a]];
  return `${lead} ${Math.round(e[a])} seats on average (${d[a].p05} to ${d[a].p95} in nine of ten), ${rest(b)} and ${rest(c)}. `
    + `${PARTY[a].name} reaches the 76 seats needed to govern alone in ${pct(pMaj)} of them.`;
}

/* the run's provenance line under the dek */
function headNote(res, mode, asOf) {
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
  const top = Math.max(100, ...runs.filter(Boolean).flatMap((r) => RANGE_PARTIES.map((k) => r.national.seatDistribution[k].p95)));
  return Math.ceil((top + 4) / 25) * 25;
}
function rangesHTML(res, { compare = null, axisMax = axisMaxFor(res, compare), labels = true } = {}) {
  const nat = res.national, X = (v) => `${(100 * v / axisMax).toFixed(2)}%`;
  const order = RANGE_PARTIES.slice().sort((a, b) => nat.expectedSeats[b] - nat.expectedSeats[a]);
  const rows = order.map((k, i) => {
    const d = nat.seatDistribution[k], e = nat.expectedSeats[k];
    const ms = nat.mostSeats[k] ?? 0;
    const sub = k === "alp" || k === "on" || k === "lnp" ? `most seats ${pctShort(ms)}` : "";
    let delta = "";
    if (compare) { const dv = Math.round(e) - Math.round(compare.national.expectedSeats[k]); delta = `<span class="md-delta">${dv > 0 ? "+" : dv < 0 ? "−" : "±"}${Math.abs(dv)} on the official run</span>`; }
    const ghost = compare ? `<span class="ghost" style="left:${X(compare.national.seatDistribution[k].p50)}"></span>` : "";
    return `<div class="md-rrow t-${k}">
      <div class="md-rname"><span class="dot"></span>${esc(PARTY[k].name)}${labels && sub ? ` <small>${sub}</small>` : ""}</div>
      <div class="md-rtrack" aria-hidden="true"><span class="majl" style="left:${X(76)}"></span>${i === 0 ? `<span class="md-maj-lab" style="left:${X(76)}">76 for a majority</span>` : ""}<span class="b90" style="left:${X(d.p05)};width:${X(Math.max(0.6, d.p95 - d.p05))}"></span><span class="b50" style="left:${X(d.p25)};width:${X(Math.max(0.6, d.p75 - d.p25))}"></span>${ghost}<span class="med" style="left:${X(d.p50)}"></span></div>
      <div class="md-rnum">${Math.round(e)}<small>${d.p05}–${d.p95}</small>${delta}</div>
    </div>`;
  }).join("");
  const ticks = [0, 25, 50, 75, 100, 125, 150].filter((t) => t <= axisMax).map((t) => `<span style="left:${X(t)}">${t}</span>`).join("");
  const sr = order.map((k) => `${PARTY[k].name} ${Math.round(nat.expectedSeats[k])} seats on average, ${nat.seatDistribution[k].p05} to ${nat.seatDistribution[k].p95} in nine simulations of ten`).join("; ");
  return `<p class="md-sr">${esc(sr)}.</p>${rows}<div class="md-raxis" aria-hidden="true"><span></span><div class="ax">${ticks}</div><span></span></div>`;
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

const STATE = { mode: "nowcast", res: {}, inputs: null, evidence: null, bySeat: null };
const run = () => STATE.res[STATE.mode];

/* join each seat's run results with its skeleton (2025 field, flows, holder) */
function seatsJoined() {
  const r = run(), inp = new Map(STATE.inputs.seats.map((s) => [s.name, s]));
  return r.seats.map((s) => {
    const k = inp.get(s.name);
    const byB = {}; for (const [g, p] of Object.entries(s.win)) byB[BUCKET(g)] = (byB[BUCKET(g)] || 0) + p;
    const lead = Object.entries(byB).sort((a, b) => b[1] - a[1])[0];
    const topPair = Object.entries(s.finalPairs)[0];
    return { ...s, seat: k, byB, lead: { b: lead[0], p: lead[1] }, topPair: topPair ? { key: topPair[0], p: topPair[1], share: s.pairShare[topPair[0]] } : null,
      heldB: BUCKET(k.held.group) };
  });
}

function renderHead() {
  const r = run(), m = STATE.mode, a = STATE.inputs.asOf;
  $("#md-hed").textContent = headline(r, m);
  $("#md-dek").textContent = dek(r, m, a.pollsTo);
  $("#md-note").innerHTML = headNote(r, m, a);
  $("#md-outcomes").innerHTML = outcomesHTML(r);
  $("#md-ranges").innerHTML = rangesHTML(r);
  $("#md-meta").textContent = m === "forecast" ? "The 2028 House on election day, about 17 months away" : "The 2028 House if an election were held now";
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
   smoothed for the eye (the tooltip reads the raw counts), the majority line at 76, a reading of every
   seat count under the pointer. The Greens and independents sit at small counts and in the head's
   ranges instead, so the three parties that can lead are drawn here. */
const DIST_PARTIES = ["alp", "on", "lnp"];
function renderDist() {
  const host = $("#dist"), r = run(), H = r.national.histogram, draws = r.meta.draws;
  $("#dist-meta").textContent = `Share of the ${draws.toLocaleString("en-AU")} simulated elections in which each party wins each number of seats`;
  let top = 100;
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
  for (let x = 0; x <= xmax; x += 25) { const t = svg("text", { x: X(x), y: Hh - 6, "text-anchor": "middle" }, ax); t.textContent = x; }
  svg("line", { x1: X(76), x2: X(76), y1: m.t - 8, y2: Hh - m.b, class: "maj" }, s);
  const ml = svg("text", { x: X(76) + 5, y: m.t - 10, class: "lab" }, s); ml.textContent = "76 for a majority";
  for (const q of ser) {
    const pts = q.sm.map((y, x) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
    const gp = svg("g", { class: `t-${q.k}` }, s);
    svg("path", { class: "ar", d: `M${X(0)},${Y(0)}L${pts.join("L")}L${X(xmax)},${Y(0)}Z` }, gp);
    svg("path", { class: "ln", d: `M${pts.join("L")}` }, gp);
    const peak = q.sm.indexOf(Math.max(...q.sm));
    const lab = svg("text", { x: X(peak), y: Y(q.sm[peak]) - 7, "text-anchor": "middle", class: "plab" }, gp); lab.textContent = PARTY[q.k].name;
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
  if (SEATS.st) L = L.filter((s) => s.state === SEATS.st);
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
  const flips = seatsJoined().filter((s) => s.lead.b !== s.heldB).length, toss = seatsJoined().filter((s) => s.lead.p < 0.6).length;
  $("#seats-meta").textContent = `${toss} seats where no party wins more than six simulations in ten; ${flips} where the likeliest winner is not the party that won in 2025`;
  const sortBtn = (k, label) => { const cur = SEATS.sort; const on = cur && cur.k === k; return `<button type="button" data-sort="${k}"${on ? ` aria-sort="${cur.dir > 0 ? "ascending" : "descending"}"` : ""}>${label}</button>`; };
  const head = `<thead><tr><th scope="col">${sortBtn("name", "Seat")}</th><th scope="col" class="c-held">Won in 2025</th><th scope="col">${sortBtn("lead", "Chance of winning")}</th><th scope="col" class="c-ct">${sortBtn("contest", "Likeliest contest")}</th><th scope="col" class="c-tcp">Average two-candidate</th></tr></thead>`;
  const rows = shown.map((s) => {
    const open = SEATS.open.has(s.name), h = s.seat.held;
    const flip = s.lead.b !== s.heldB ? `<span class="flip">from ${esc(PARTY[s.heldB].short)}</span>` : "";
    const tr = `<tr class="row" tabindex="0" data-seat="${esc(s.name)}" aria-expanded="${open}">
      <td><span class="nm">${esc(s.name)}</span><span class="st">${s.state}</span></td>
      <td class="c-held"><span class="held t-${s.heldB}"><span class="dot"></span>${esc(GROUP_NAME[h.group] || (s.heldB === "member" ? "Independent" : h.party))}</span></td>
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
  const t = k.tcp2025, tot = t ? t[0].votes + t[1].votes : 0;
  const res25 = t ? `${esc(t[0].name)} (${esc(t[0].party)}) ${(100 * t[0].votes / tot).toFixed(1)}, ${esc(t[1].name)} (${esc(t[1].party)}) ${(100 * t[1].votes / tot).toFixed(1)}` : "";
  return `<div class="md-card">
    <div><h4>First preferences</h4><div class="md-prim">${prim}</div><p class="md-fine" style="margin-top:8px">Thin bar: 2025. Thick bar and figure: the simulations' average${STATE.mode === "forecast" ? " on election day" : " now"}.</p></div>
    <div><h4>How often each wins</h4><div class="md-kv">${wins}</div><h4 style="margin-top:14px">The contest it comes down to</h4><div class="md-kv">${pairs}</div></div>
    <div><h4>Preferences here</h4><div class="md-kv">${fl}</div><p class="md-fine" style="margin-top:8px">From this seat's 2025 Senate ballots, adjusted to how House voters differ and mixed for today's voters. The 2025 count: ${res25}.</p></div>
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
  const defaults = () => { const n = STATE.inputs.vote.nowcast; st.vote = P5.map((k) => n[k]); };
  const fill = (inp) => { const a = +inp.min, b = +inp.max; inp.style.setProperty("--fill", `${(100 * (+inp.value - a) / (b - a)).toFixed(1)}%`); };
  const levDelta = (k) => { const L = W.levels && W.levels[k]; const pts = st.lev[k] || 0; if (L == null || !pts) return 0; return logit(clamp(L + pts / 100, 0.01, 0.99)) - logit(L); };
  const status = (t) => { const e = $("#ex-status"); if (e) e.textContent = t; };
  const prog = (p) => { const e = $("#ex-prog"); if (e) e.style.width = `${Math.round(100 * p)}%`; };

  function build() {
    if (built) return; built = true;
    defaults();
    const host = $("#ex");
    host.innerHTML = `<div class="md-ctl">
      <div class="md-grp" id="ex-vote"><h3>The national vote <button type="button" data-reset="vote">Back to the polls</button></h3></div>
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
    vote.insertAdjacentHTML("beforeend", `<p class="note">Move one party and the others make room in proportion. The polls' figures are this site's aggregate to ${shortDate(STATE.inputs.asOf.pollsTo)}.</p>`);
    const lev = $("#ex-lev");
    for (const [k, l, unit] of LEV) lev.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="l-${lid(k)}">${l}</label><output id="lo-${lid(k)}"></output><input type="range" id="l-${lid(k)}" min="-30" max="40" step="1" value="0" data-l="${k}" data-unit="${unit}"></div>`);
    lev.insertAdjacentHTML("beforeend", `<p class="note">Each lever shifts that voter group's choice in every seat by the same amount (on the logit scale), keeping each seat's own leaning. The card button assumes about a third of Coalition voters follow their party's how-to-vote card; switching the card's order moves them, about 35 points.</p>`);
    const unc = $("#ex-unc");
    for (const [k, l] of [["pol", "Polling error"], ["seat", "Seat-to-seat noise"], ["flow", "Preference drift"]]) unc.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="u-${k}">${l}</label><output id="uo-${k}"></output><input type="range" id="u-${k}" min="0" max="2" step="0.25" value="1" data-u="${k}"></div>`);
    unc.insertAdjacentHTML("beforeend", `<p class="note">1 is the size fitted on past elections; 0 removes that source of error.</p>`);
    $("#ex-fade").insertAdjacentHTML("beforeend", `<label class="md-tog"><input type="checkbox" id="ex-fade-draw" checked> Draw the fade anywhere from 0 to 60%, as the official run does</label><div class="md-sl" style="margin-top:8px"><label for="ex-fade-v">Share of minor parties' rise since 2025 given back</label><output id="ex-fade-o"></output><input type="range" id="ex-fade-v" min="0" max="60" step="5" value="30" disabled></div><p class="note">History: about 0.6 of a minor party's surge since the last election has been gone by polling day, but every case was a small surge.</p>`);
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
    $("#ex-fade").hidden = STATE.mode !== "forecast";
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
    if (p && p.dataset.preset === "card") { const L = W.levels && W.levels["COAL|AO"]; st.lev["COAL|AO"] = L == null ? 35 : Math.min(35, Math.round(95 - 100 * L)); st.touched = true; syncControls(); schedule(); }
    if (e.target.closest("[data-copy]")) { navigator.clipboard && navigator.clipboard.writeText(location.href); e.target.textContent = "Link copied"; }
  }
  const voteIsPolls = () => { const n = STATE.inputs.vote.nowcast; return st.vote.every((x, i) => Math.abs(x - n[P5[i]]) < 0.051); };
  const isOfficial = () => voteIsPolls() && !Object.values(st.lev).some((v) => v) && st.unc && st.pol === 1 && st.seat === 1 && st.flow === 1 && st.fade == null;
  const schedule = debounce(() => { writeHash(); runJob(); }, 220);
  function job() {
    const tot = st.vote.reduce((a, b) => a + b, 0);
    const levers = {}; for (const [k] of LEV) { const d = levDelta(k); if (d) levers[k] = d; }
    return { type: "run", mode: STATE.mode, now5: st.vote.map((x) => x / tot), levers: Object.keys(levers).length ? levers : null,
      uncertainty: st.unc, polErrMult: st.pol, seatNoiseMult: st.seat, flowNoiseMult: st.flow,
      fade: STATE.mode === "forecast" ? (st.fade == null ? null : { fixed: st.fade / 100 }) : null, draws: DRAWS, seed: 20261101 };
  }
  function start() {
    if (W.w) return;
    try { W.w = new Worker(URLS.worker, { type: "module" }); }
    catch (err) { status("This browser cannot run the model here."); return; }
    W.ready = false; W.busy = false;
    W.w.onmessage = onMsg;
    W.w.onerror = (e) => status("The model could not start in this browser" + (e.message ? `: ${e.message}` : "") + ".");
    W.w.postMessage({ type: "init", inputsUrl: URLS.inputs, senateUrl: URLS.senate });
    if (!W.levels) status("Loading the model (about 300 KB)…");
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
      const pseudo = { meta: { draws: 1 }, national: {
        expectedSeats: s, seatDistribution: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { p05: v, p25: v, p50: v, p75: v, p95: v }])),
        mostSeats: { alp: 0, on: 0, lnp: 0, [top]: 1 },
        majority: { alp: top === "alp" && s.alp >= 76 ? 1 : 0, coalition: top === "lnp" && s.lnp >= 76 ? 1 : 0, on: top === "on" && s.on >= 76 ? 1 : 0, noMajority: s[top] >= 76 ? 0 : 1 } } };
      $("#ex-out").innerHTML = outcomesHTML(pseudo);
      $("#ex-ranges").innerHTML = rangesHTML(pseudo, { compare: run(), labels: false });
    }
    $("#ex-share").innerHTML = `This scenario is in the address bar. <button type="button" class="md-btn" data-copy>Copy the link</button>`;
  }
  function showResult(res) {
    const wrapped = { national: res, meta: { draws: res.draws } };
    status(`${res.draws.toLocaleString("en-AU")} simulated elections on your settings`);
    $("#ex-out").innerHTML = outcomesHTML(wrapped);
    $("#ex-ranges").innerHTML = rangesHTML(wrapped, { compare: run(), labels: false });
  }
  function onMode() {
    if (!built) return;
    if (!st.touched) { defaults(); syncControls(); showOfficial(); return; }
    syncControls(); schedule();
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
  return { init, onMode, applyHash, hashParts, state: st };
})();
function readHash() { const q = {}; for (const kv of location.hash.replace(/^#/, "").split("&")) { const [k, v] = kv.split("="); if (k && v != null) q[k] = decodeURIComponent(v); } return q; }
function writeHash() {
  const parts = [];
  if (STATE.mode === "forecast") parts.push("mode=forecast");
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
  const errTbl = `<table class="md-tbl"><caption>How far the polls' average can miss, as the model draws it: one standard deviation, in points at today's vote</caption><thead><tr><th>Party</th><th>Final month</th><th>13–20 months out</th><th>Elections</th></tr></thead><tbody>${[["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"]].map(([k, n]) => `<tr><td>${n}${k === "onp" && onDiffers ? "*" : ""}</td><td>±${fx1(drawn(k, S))}</td><td>±${fx1(drawn(k, Sf))}</td><td>${E.national.n[k]["final month"]}</td></tr>`).join("")}</tbody></table>${onDiffers ? `<div class="sub">* One Nation's own record, five elections when it polled far lower, would give ±${fx1(onOwn[0])} and ±${fx1(onOwn[1])}. Five is too few to pin the size down, so the model takes the Greens' error, the best-measured minor party's, at least 0.25 on the logit scale and never more than One Nation's own.</div>` : ""}`;
  const html = [];
  html.push(step(1, "Start from the polls",
    `<p>The model starts from this site's polling aggregate, the house-corrected average of the ${a.waves.length} polls fielded from ${shortDate(a.windowFrom)} to ${shortDate(a.pollsTo)}: <b>Labor ${fx1(now.alp)}, One Nation ${fx1(now.on)}, the Coalition ${fx1(now.lnp)}, the Greens ${fx1(now.grn)} and others ${fx1(now.oth)}</b>.</p>
     <p>An average of polls is not a result. In every federal campaign since 1972 the final month's polls have missed each party by an amount that is fitted here, party by party, on the logit scale, with the errors linked: when the polls overstate Labor they tend to understate the Coalition (a correlation of ${E.national.corr.alpLnpAllCycles} over ${E.national.corr.alpLnpCycles} elections). Errors are drawn with fat tails (a Student-t), so a big miss is possible.</p>
     <p><b>On election day</b>, about 17 months away, the error is the larger one seen 13 to 20 months out, and minor parties give back part of their rise since 2025. Over ${E.national.fade["13-20 months"].n} minor-party cases, about ${Math.round(100 * E.national.fade["13-20 months"].lambda)}% of a surge since the last election was gone by polling day; every case was a small surge, so the model draws the fade anywhere from 0 to 60%.</p>
     <p class="src">Fitted by <a href="${GH}.build/analysis/seat-model/calibrate-national.mjs">calibrate-national.mjs</a> on the poll archive behind Past cycles.</p>`, errTbl));
  // seat noise by election, in points at each party's 2025 share
  const years = ["2007", "2010", "2013", "2016", "2019", "2022", "2025"], nat25 = I.vote.result2025;
  html.push(step(2, "Spread the vote across the seats",
    `<p>Each party's 2025 vote in each seat moves by the same amount on the logit scale, with one shift per party solved so the national totals come out exactly. On the logit scale a party gains least in points where it is very weak or very strong, which is how a surge spreads: the rule predicted One Nation's SA 2026 vote, district by district, from its federal 2025 vote with a typical miss of 2.1 points, against 4.5 for adding the same points everywhere.</p>
     <p>Each state shifts by what this term's state polling says, within its sampling error, and each seat by the age and gender of its voters, as measured in the Resolve polls against election eve. Seats then stray from all of that by amounts fitted on every federal election since 2007, which have grown as voters have loosened their ties. They stray more for a party in steep decline, as the SA Liberals did in 2026, so a party's seat noise grows with its fall since 2025. Noise 1.3 times the calm-year size, with fat tails, scored best when past elections were predicted afresh.</p>
     <p>Education gets no term of its own. Within each pollster, the gap between graduates and everyone else has moved by ${E.education.estimate.onp.gapChange.toFixed(2)} on the logit scale for One Nation and ${E.education.estimate.grn.gapChange.toFixed(2)} for the Greens: their surges spread by education just as the logit rule implies. Labor's and the Coalition's gaps moved by about 0.2, worth at most ${fx1(Math.max(E.education.estimate.alp.seatEffect.mostPositive[0][1], E.education.estimate.lnp.seatEffect.mostPositive[0][1]))} points in the most extreme seats, and the model's shared education shock already spans that.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/calibrate-swing.mjs">calibrate-swing.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-education.mjs">calibrate-education.mjs</a>, <a href="${GH}.build/analysis/seat-model/vote-layer.mjs">vote-layer.mjs</a>.</p>`,
    `<div class="cap">How far seats stray from the logit rule, in points at each party's typical vote</div><div id="fig-noise"></div><div class="sub">Root mean square of each seat's miss with the state totals known, at each party's 2025 national vote. The SA Liberals' 2026 collapse ran at about ${fx1(ptsAt(E.swing.sa26.lnp.rmsLogit, 0.19))} points.</div>`));
  const ex = E.examples.map((x) => `<tr><td>${esc(x.seat)}</td><td>${Math.round(100 * x.coalitionLaborOverOn)}%</td><td>${Math.round(100 * x.laborCoalitionOverOn)}%</td><td>${Math.round(100 * x.onLaborOverCoalition)}%</td><td>${Math.round(100 * x.greensLaborOverCoalition)}%</td></tr>`).join("");
  const comp = (row, label) => { const parts = [["onp", "on", "One Nation"], ["lnp", "lnp", "Coalition"], ["alp", "alp", "Labor"], ["grn", "grn", "Greens"], ["ind", "member", "independents"], ["oth", "oth", "others"]]; return `<div class="md-fine" style="margin-top:12px">${label}</div><div class="md-mix">${parts.map(([k, t]) => `<span class="t-${t}" style="flex-grow:${(1000 * (row[k] || 0)).toFixed(0)}" title="${Math.round(100 * (row[k] || 0))}% voted ${k === "ind" ? "independent" : k === "oth" ? "for another party" : PARTY[t].name} in 2025"></span>`).join("")}</div><div class="md-fine">${parts.filter(([k]) => (row[k] || 0) >= 0.03).map(([k, , n]) => `${Math.round(100 * row[k])}% ${n}`).join(" · ")}</div>`; };
  html.push(step(3, "Order every voter's preferences",
    `<p>Who wins a seat often depends on the order in which voters number the parties they did not vote for, and in a three-way race that order decides a great deal: whether Coalition voters put Labor or One Nation next. The House count shows only the contests that happened. The Senate shows every voter's order: the AEC publishes every formal Senate ballot, and for each party's voters in each seat this model counts the order in which they ranked Labor, the Coalition, the Greens and One Nation, across about 15 million ballots at each of the last four elections.</p>
     <p>House voters differ from Senate voters in ways fitted on ${E.flows.rows.same.toLocaleString("en-AU")} House flows counted from 2016 to 2025: Greens voters' preferences reach Labor a little less often in the House, One Nation's a little more. Where the 2025 House count saw a seat's own flow, that counts too.</p>
     <p>Voters have moved since 2025, and they bring their own orders with them. Today's One Nation voters, by the vote-switching polls, are ${Math.round(100 * E.composition.on.onp)}% its 2025 voters, ${Math.round(100 * E.composition.on.lnp)}% former Coalition voters and ${Math.round(100 * E.composition.on.alp)}% former Labor voters. Each group keeps its old order with One Nation moved first. That is why One Nation's preferences reach Labor more often than in 2025, as they did in SA in 2026.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/extract-senate-rankings.py">extract-senate-rankings.py</a>, <a href="${GH}.build/analysis/seat-model/senate-flows.mjs">senate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-flows.mjs">calibrate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/seat-build.mjs">seat-build.mjs</a>.</p>`,
    `<table class="md-tbl"><caption>Three seats' 2025 Senate ballots</caption><thead><tr><th>Seat</th><th>Coalition voters: Labor ahead of One Nation</th><th>Labor voters: Coalition ahead of One Nation</th><th>One Nation voters: Labor ahead of the Coalition</th><th>Greens voters: Labor ahead of the Coalition</th></tr></thead><tbody>${ex}</tbody></table>
     <div class="sub">Shares of each party's Senate voters who numbered either of the two, before the House adjustments.</div>
     ${comp(E.composition.on, "Today's One Nation voters, by their 2025 vote")}${comp(E.composition.lnp, "Today's Coalition voters, by their 2025 vote")}`));
  const PORD = ["alp", "lnp", "on", "grn", "member", "oth"], PNM = { alp: "Labor", lnp: "Coalition", on: "One Nation", grn: "Greens", member: "Independent", oth: "Other" };
  const pkey = (a, b) => [a, b].sort((x, y) => PORD.indexOf(x) - PORD.indexOf(y)).join(" v ");
  const p25 = {}, p28 = {};
  for (const k of I.seats) if (k.tcp2025) { const q = pkey(BUCKET(k.tcp2025[0].bucket), BUCKET(k.tcp2025[1].bucket)); p25[q] = (p25[q] || 0) + 1; }
  for (const [q, v] of Object.entries(R.national.finalPairs)) { const [a, b] = q.split(" v ").map(BUCKET); if (a === b) continue; const k2 = pkey(a, b); p28[k2] = (p28[k2] || 0) + v; }
  const pk = [...new Set([...Object.keys(p25), ...Object.keys(p28)])].sort((x, y) => (p28[y] || 0) - (p28[x] || 0) || (p25[y] || 0) - (p25[x] || 0));
  const shown = pk.filter((q) => Math.max(p25[q] || 0, p28[q] || 0) >= 1.5), rest = pk.filter((q) => !shown.includes(q));
  const prow = (l, a, b) => ({ l, a, b }), prows = shown.map((q) => prow(q.split(" v ").map((x) => PNM[x]).join(" v "), p25[q] || 0, p28[q] || 0));
  if (rest.length) prows.push(prow("Other pairs", rest.reduce((n, q) => n + (p25[q] || 0), 0), rest.reduce((n, q) => n + (p28[q] || 0), 0)));
  const pmax = Math.max(...prows.flatMap((r) => [r.a, r.b]));
  const pairFig = `<div class="cap">Who meets whom in the final count</div>
     <div class="md-pkey"><span><i class="y25"></i>Counted in 2025</span><span><i class="y28"></i>If held today, on average</span></div>
     <div class="md-pairs">${prows.map((r) => `<span class="l">${r.l}</span><span class="b"><i class="y25" style="width:${(100 * r.a / pmax).toFixed(1)}%"></i><i class="y28" style="width:${(100 * r.b / pmax).toFixed(1)}%"></i></span><span class="v">${Math.round(r.a)} <span class="arr">→</span> <b>${Math.round(r.b)}</b></span>`).join("")}</div>
     <div class="sub">Seats by the two candidates left at the end of the count. Today's figures average the ${R.meta.draws.toLocaleString("en-AU")} simulations, so they need not be whole numbers of seats; they are rounded here.</div>`;
  const cl25 = p25["alp v lnp"] || 0, cl28 = p28["alp v lnp"] || 0, top28 = pk.find((q) => q !== "alp v lnp" && (p28[q] || 0) >= 1);
  html.push(step(4, "Count every seat",
    `<p>Every seat is counted as the AEC counts it: the candidate with the fewest votes is excluded, and each ballot moves to the next candidate it ranks who is still standing, until two remain. Because each group of voters' whole order is known, the count works for any final pair (Labor v One Nation, the Coalition v One Nation, a three-way race) without a table of flows, and a ballot that passed through one party moves on as its own voter would move it. Building three-way splits from pairwise flows instead misplaces the right-wing minor parties' votes by about 11 points.</p>
     <p>Sitting independents take the share of moving ballots they took in their 2025 counts. A Liberal or National knocked out of a three-cornered contest passes most of their votes to their partner, at the rate their 2025 counts show.</p>
     <p>In 2025, ${cl25} of the 150 counts ended with Labor against the Coalition. If the election were held today, about ${Math.round(cl28)} would${top28 ? `, and about ${Math.round(p28[top28])} would end ${top28.split(" v ").map((x) => (x === "lnp" ? "the Coalition" : x === "grn" ? "the Greens" : x === "member" ? "an independent" : x === "oth" ? "another candidate" : PNM[x])).join(" against ")}` : ""}.</p>
     <p>Counted on the actual 2025 first preferences, this reproduces <b>${E.replay2025.winners} of the 150 winners</b> and ${E.replay2025.pairs} of the final pairs, with a typical two-candidate error of ${fx1(E.replay2025.tcpMaePts)} points. The misses are ${E.replay2025.misses.join(", ")}, the closest contests of the election.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/seat-engine.mjs">seat-engine.mjs</a>.</p>`, pairFig));
  const terms = [
    ["The national vote", `Labor ±${fx1(ptsAt(S.sigNat[0], sh.alp))}, Coalition ±${fx1(ptsAt(S.sigNat[1], sh.lnp))}, One Nation ±${fx1(ptsAt(S.sigNat[2], sh.onp))} pts (one SD; election day ±${fx1(ptsAt(Sf.sigNat[0], sh.alp))}, ±${fx1(ptsAt(Sf.sigNat[1], sh.lnp))}, ±${fx1(ptsAt(Sf.sigNat[2], sh.onp))})`, "Every campaign since 1972"],
    ["Each state", "Its polling deviation within its sampling error, plus 0.10 logit", "This term's state polling"],
    ["Seat types and education", `${Math.min(...S.sigClass).toFixed(2)}–${Math.max(...S.sigClass).toFixed(2)} logit by type; ${S.sigEdu.toFixed(2)} per standard deviation of degree share`, "Seat-type swings 2007–2025"],
    ["Each seat", `Labor ${R.meta.sigmaSeat.alp.toFixed(2)}, Coalition ${R.meta.sigmaSeat.lnp.toFixed(2)}, One Nation ${R.meta.sigmaSeat.on.toFixed(2)}, Greens ${R.meta.sigmaSeat.grn.toFixed(2)} logit, fat-tailed, larger for a party that has fallen since 2025`, "Federal 2007–2025 and SA 2026"],
    ["Preferences, nationally", `${Object.entries(S.flowNat).filter(([k]) => ["COAL", "ON", "GRN", "OTH-R"].includes(k)).map(([k, v]) => `${{ COAL: "Coalition", ON: "One Nation", GRN: "Greens", "OTH-R": "right-wing minors" }[k]} ${v.toFixed(2)}`).join(", ")} logit, plus a shared One Nation shift of ${S.flowOn}`, "Drift from a Senate election to the next House count, federal 2019–2025 and six state elections"],
    ["Preferences, each seat", `${Math.min(...Object.values(S.flowSeat)).toFixed(2)}–${Math.max(...Object.values(S.flowSeat)).toFixed(2)} logit`, "What the Senate and the seat's history leave unexplained"],
  ];
  html.push(step(5, `Simulate ${R.meta.draws.toLocaleString("en-AU")} elections`,
    `<p>Every simulated election draws each of these afresh, then counts all 150 seats. A party's seat total, its chance of a majority and each seat's chances are simply how often things happened across the simulations. The central projection is one more election, with every error set to zero: it can differ from the averages because close seats tip one way at the centre and both ways once the errors are drawn.</p>
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
    `<p>A hard test of the preferences: count each state election from its actual first preferences, with every candidate's preferences read from the federal Senate ballots cast before it, the same way the model reads them for 2028, and nothing from the state count itself. Two simpler ways are counted on the same first preferences: the fixed national rates of the model's first version, and rates graded by seat type, from inner city to rural, set partly on SA 2026 itself.</p>
     <p>Across the ${["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][els.length] || els.length} elections the Senate ballots ${pairLead}: ${Sx.pairs} of ${seatsAll}, against ${Gx.pairs} for the grades and ${Fx.pairs} for the fixed rates, because they know which party each group of voters puts next once its own is out. ${winTxt}; the fixed rates get ${Fx.w}.</p>${q17 ? `<p>In Queensland 2017 One Nation and LNP voters moved about 0.7 on the logit scale away from Labor between the 2016 Senate vote and the 2017 count (the LNP put One Nation ahead of Labor that year). With each party's statewide level set to the count, the Senate's seat-by-seat pattern gets ${q17.winners} of ${T.qld17.seats} winners and ${q17.seats.lnp === T.qld17.actualSeats.lnp ? `the LNP's ${q17.seats.lnp} seats exactly` : `the LNP ${q17.seats.lnp} seats against ${T.qld17.actualSeats.lnp} won`}: the pattern held, the level drifted.</p>` : ""}
     <p>Unfortunately, these counts cannot separate the Senate ballots from the grades on winners: what decides most seats is how far each party's voters lean overall, not how that varies from seat to seat. The model reads the Senate because it covers every party's voters in every seat, where the grades cover Coalition and Labor voters in Labor-v-One Nation races and give everyone else one rate everywhere. Taking minor parties one by one, rather than as one lump of others, cuts the typical seat's miss on their counted 2025 flows from 8.1 to 5.2 points. The level drift, across these elections and the federal ones, is what sizes the model's national preference errors.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>, and section 12 of the design review.</p>`,
    `<table class="md-tbl"><caption>Winners right; below, final pairs right and the typical two-candidate error</caption><thead><tr><th>Election</th>${SCH.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${stRows}</tbody></table><div class="sub">Bold: the most winners right of the first three columns, which use nothing from the count (the grades' SA 2026 figure is partly fitted on it). The last column is a diagnostic, not a forecast: it borrows each party's statewide preference level from the count.</div>`));
  T2.push(step("", "Three federal elections, from three years before",
    `<p>The whole chain run for 2019, 2022 and 2025 with only what was known three years earlier: the previous election's seats, Senate ballots and House flows, with settings fitted on earlier elections only, and each election's actual national vote given, so that what is tested is the step from votes to seats.</p>
     <p>The misses that matter were 2022's new independents, who no 2019 starting point could hold. When nearly every final pair is Labor against the Coalition, preferences barely move seats, so these runs test the swing and the noise more than the preferences.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-chain.mjs">backtest-chain.mjs</a>.</p>`,
    `<table class="md-tbl"><caption>National vote given, ${E.federal.draws.toLocaleString("en-AU")} simulations each</caption><thead><tr><th>Election</th><th>Winners right</th><th>Final pairs right</th><th>Two-candidate error</th><th>Labor seats, model v actual</th><th>Coalition</th><th>Independents</th></tr></thead><tbody>${fedRows}</tbody></table>`));
  const cal = Object.entries(E.federal.calibration).map(([bin, v]) => ({ bin, p: v.p / v.n, o: v.o / v.n, n: v.n }));
  T2.push(step("", "Are its chances honest?",
    `<p>When the model gives a seat a 70% chance, the favourite should win about seven times in ten. Pooled over the three federal tests, the chances it gave and how often things happened line up closely in the middle, where the close seats are. At the edges it was a little too sure: seats it rated under 10% happened ${fx1(100 * cal[0].o)}% of the time against ${fx1(100 * cal[0].p)}% predicted, largely the 2022 independents.</p>`,
    `<div class="cap">Chance given v how often it happened</div><div id="fig-cal"></div><div class="sub">Every seat and party in the three federal tests, grouped by the chance the model gave.</div>`));
  $("#tests-body").innerHTML = T2.join("");
  calChart($("#fig-cal"), cal);

  $("#limits-body").innerHTML = [
    ["How-to-vote cards", "The model assumes parties recommend preferences much as they did in 2025, when the Coalition put One Nation ahead of Labor almost everywhere. If the Coalition's card put Labor first instead, the many Labor-v-One Nation seats would swing to Labor; the explorer has a button for it."],
    ["Who stands", "It assumes 2025's candidates and parties stand again, with One Nation and the Greens everywhere and sitting independents recontesting. New independents, the kind who won six seats in 2022, are invisible until they nominate."],
    ["Independents", "A sitting independent's vote carries over, moved by the national swing to others and with extra noise. Their personal votes and campaigns are not modelled."],
    ["Boundaries", "Seats are 2025's. A redistribution before 2028 would change the starting point of the seats it touches."],
    ["The campaign", "Nothing here knows about events between now and the election. The election-day mode widens the errors for that, as history says it should, but cannot say which way they will go."],
    ["The polls", "The national vote is the polls' average. If every pollster is wrong in the same direction, as in 2019, the model inherits it; the polling error it draws is the size such misses have been."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("");
  const D = (p, l, n) => `<a href="${p}"><span>${l}</span><span>${n}</span></a>`;
  $("#files-meta").textContent = `Model run ${longDate(a.modelRun)}, polls to ${longDate(a.pollsTo)}`;
  $("#files-body").innerHTML = [
    D("/data/seat-model-2028-nowcast.json", "Official run, if held today", "JSON"), D("/data/seat-model-2028-forecast.json", "Official run, election day", "JSON"),
    D("/data/senate-rankings-2025.json", "Senate ballot orders by seat, 2025", "JSON"), D(GH + "data", "Senate ballot orders 2016–2022, calibration, backtests", "data/"),
    D(GH + ".build/analysis/seat-model-design-review.md", "The design review: every test and decision", "Markdown"), D(GH + ".build/analysis/seat-model", "The model's code", "GitHub"),
    D("/model/data/inputs.json", "What this page's explorer runs on", "JSON"), D("/data/seat-model-2028-history.jsonl", "Every official run so far", "JSONL"),
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

/* app-6-boot.js: load the official runs and the page's data, draw everything, wire the mode switch,
   restore a shared scenario from the address, and redraw the charts when the page changes width. */
(async function boot() {
  try {
    const [nowcast, forecast, inputs, evidence] = await Promise.all([getJSON(URLS.nowcast), getJSON(URLS.forecast), getJSON(URLS.inputs), getJSON(URLS.evidence)]);
    Object.assign(STATE, { res: { nowcast, forecast }, inputs, evidence });
  } catch (e) {
    const n = $("#md-note"); if (n) n.insertAdjacentHTML("beforeend", ` · <span style="color:var(--m-alp)">the page's data could not load (${esc(e.message)}); the head above is the official run</span>`);
    return;
  }
  const q = readHash();
  STATE.mode = q.mode === "forecast" ? "forecast" : "nowcast";
  for (const b of $$(".md-modes .rd-tab")) b.setAttribute("aria-selected", String(b.dataset.mode === STATE.mode));
  if (STATE.mode !== "nowcast") renderHead();
  renderDist(); renderSeats(); renderEvidence();
  $(".md-modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== STATE.mode) setMode(b.dataset.mode); });
  $(".md-modes").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = STATE.mode === "nowcast" ? "forecast" : "nowcast"; setMode(next); $(`#mode-${next}`).focus();
  });
  if (EX.applyHash(q)) $("#explore").scrollIntoView({ block: "start" }); else EX.init();
  let lastW = innerWidth;
  addEventListener("resize", debounce(() => { if (Math.abs(innerWidth - lastW) < 8) return; lastW = innerWidth; renderDist(); const n = $("#fig-noise"), c = $("#fig-cal"); if (n && c) { renderEvidence(); } }, 150));
  window.__model = { STATE, EX };
})();

})();
