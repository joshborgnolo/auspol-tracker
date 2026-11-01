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
