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
