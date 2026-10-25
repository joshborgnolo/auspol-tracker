/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */
(() => {
"use strict";
/* =============================== helpers =============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const sum = (a) => { let s = 0; for (const v of a) s += v; return s; };
const nn = (v) => (v == null || Number.isNaN(v) ? null : v);
const f1 = (v) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(1));
const f0 = (v) => (v == null || Number.isNaN(v) ? "–" : Math.round(v).toString());
const int = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-AU"));
const sgn = (v, d = 1) => (v == null || Number.isNaN(v) ? "–" : (v > 0.049 ? "+" : v < -0.049 ? "−" : "") + Math.abs(v).toFixed(d));
const pts = (v) => { const a = Math.abs(v); return `${a.toFixed(1)} point${a.toFixed(1) === "1.0" ? "" : "s"}`; };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => matchMedia("(max-width: 860px)").matches;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const words = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const Words = (n) => { const w = words(n); return w[0].toUpperCase() + w.slice(1); };
const plural = (n, a, b) => `${n === 1 ? a : b || a + "s"}`;
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const shortDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`; };
const monthYear = (iso) => { const [y, m] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

/* =============================== colour =============================== */
const lin2s = (v) => { v = clamp(v, 0, 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function lab2lin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
function lab2rgb([L, a, b]) {
  for (let k = 0; k < 30; k++) {
    const lin = lab2lin(L, a, b);
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) return lin.map((v) => Math.round(255 * lin2s(v)));
    a *= 0.93; b *= 0.93;
  }
  return lab2lin(L, a, b).map((v) => Math.round(255 * lin2s(v)));
}
function rgb2lab([r, g, b]) {
  const R = s2lin(r / 255), G = s2lin(g / 255), B = s2lin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const lch = (L, C, H) => lab2rgb([L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const lumL = (c) => rgb2lab(c)[0];
const mixC = (p, c, t) => (!p || !c ? (t < 0.5 ? p : c) : [Math.round(lerp(p[0], c[0], t)), Math.round(lerp(p[1], c[1], t)), Math.round(lerp(p[2], c[2], t))]);
const towards = (c, bg, t) => (t <= 0 ? c : [Math.round(lerp(c[0], bg[0], t)), Math.round(lerp(c[1], bg[1], t)), Math.round(lerp(c[2], bg[2], t))]);

/* the page's surfaces and the map's fills, read off the live CSS tokens so the
   canvas always paints what the stylesheet says */
let TH = null;
const probeEl = document.createElement("i");
probeEl.style.display = "none";
document.body.appendChild(probeEl);
function tokenRGB(v) {
  probeEl.style.color = `var(${v})`;
  const m = getComputedStyle(probeEl).color.match(/[\d.]+/g);
  if (m && m.length >= 3) {
    if (/oklch|oklab|color\(/.test(getComputedStyle(probeEl).color)) return null;
    return [+m[0], +m[1], +m[2]].map(Math.round);
  }
  return null;
}
const isDark = () => { const r = document.documentElement; return r.classList.contains("sh-dark") || (!r.classList.contains("sh-light") && matchMedia("(prefers-color-scheme: dark)").matches); };
function readTheme() {
  const dk = isDark();
  // oklch tokens come back from getComputedStyle as oklch(); compute them here instead
  const L = dk
    ? { bg: [0.205, 0.010, 65], surface: [0.235, 0.010, 65], ink: [0.940, 0.008, 80], ink2: [0.800, 0.009, 78], ink3: [0.670, 0.009, 72], faint: [0.545, 0.009, 68], line: [0.355, 0.011, 66], line2: [0.312, 0.010, 66] }
    : { bg: [0.975, 0.009, 80], surface: [0.992, 0.004, 85], ink: [0.27, 0.012, 55], ink2: [0.44, 0.012, 55], ink3: [0.52, 0.010, 58], faint: [0.70, 0.008, 65], line: [0.895, 0.008, 75], line2: [0.935, 0.006, 78] };
  const T = {};
  for (const k in L) T[k] = lch(...L[k]);
  const P = dk
    ? { alp: "#e45e51", lnp: "#4092e7", grn: "#5dc47e", onp: "#f69828", ind: "#ba96bf", csa: "#00b4cd", oth: "#a69d93" }
    : { alp: "#af3d36", lnp: "#386695", grn: "#50a064", onp: "#d27306", ind: "#977b9d", csa: "#008a9c", oth: "#938a81" };
  T.party = {}; for (const k in P) T.party[k] = hex(P[k]);
  T.dark = dk;
  T.mid = dk ? lch(0.36, 0.008, 66) : lch(0.905, 0.006, 78);
  T.nodata = dk ? lch(0.265, 0.008, 65) : lch(0.935, 0.005, 78);
  T.hatch = dk ? lch(0.39, 0.010, 66) : lch(0.80, 0.008, 70);
  T.coast = dk ? lch(0.62, 0.010, 70) : lch(0.56, 0.010, 62);
  T.state = dk ? lch(0.88, 0.009, 78) : lch(0.30, 0.012, 55);
  T.veil = dk ? 0.66 : 0.6;
  T.seqL = dk ? [0.29, 0.86] : [0.955, 0.36];
  T.cls = dk ? [lch(0.88, 0.030, 78), lch(0.70, 0.040, 70), lch(0.53, 0.045, 62), lch(0.38, 0.035, 58)] : [lch(0.34, 0.040, 58), lch(0.50, 0.045, 62), lch(0.68, 0.040, 70), lch(0.85, 0.028, 78)];
  T.floor = dk ? lch(0.235, 0.012, 150) : lch(0.958, 0.012, 150);
  return T;
}

/* ramps: 101-step sequential lookups and 201-step diverging (index 0..200, mid 100) */
let RAMP = {};
function buildRamps() {
  const th = TH;
  const seq = (H, Cmax) => { const [L0, L1] = th.seqL; const t = []; for (let i = 0; i <= 100; i++) { const u = i / 100; t.push(lch(lerp(L0, L1, u), lerp(0.014, Cmax, Math.pow(u, 0.75)), H)); } return t; };
  const div = (neg, mid, pos) => { const N = rgb2lab(neg), M = rgb2lab(mid), P = rgb2lab(pos); const t = []; for (let i = -100; i <= 100; i++) { const u = Math.pow(Math.abs(i) / 100, 0.85); const E = i < 0 ? N : P; t.push(lab2rgb([lerp(M[0], E[0], u), lerp(M[1], E[1], u), lerp(M[2], E[2], u)])); } return t; };
  const deepen = (c, dL) => { const l = rgb2lab(c); return lab2rgb([l[0] + dL, l[1] * 1.04, l[2] * 1.04]); };
  const dk = th.dark;
  RAMP = {
    // Labor at the low end of the index and the Coalition at the high end: the
    // site's own reading order ("◀ Labor ahead … Coalition ahead ▶")
    div: div(deepen(th.party.alp, dk ? 0.03 : -0.06), th.mid, deepen(th.party.lnp, dk ? 0.03 : -0.06)),
    fp: { alp: seq(27, 0.16), lnp: seq(250, 0.12), grn: seq(150, 0.15), onp: seq(58, 0.15), ind: seq(320, 0.09), oth: seq(250, 0.022) },
    inf: seq(345, 0.13),
    // a party's losses: paper to a warm grey, so a fall never borrows another party's colour
    loss: seq(70, 0.025),
    seifa: seq(292, 0.15),
    // the census people measures, a hue each so a change of measure reads as one
    demo: { lang: seq(235, 0.12), a65: seq(62, 0.13), a2034: seq(150, 0.12) },
  };
}

/* =============================== domain =============================== */
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const STATE_NAME = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "the ACT", NT: "the Northern Territory" };
const STATE_TITLE = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
const STATE_SHORT = { NSW: "NSW", VIC: "Vic", QLD: "Qld", WA: "WA", SA: "SA", TAS: "Tas", ACT: "ACT", NT: "NT" };
const STATE_POSS = { NSW: "New South Wales’s", VIC: "Victoria’s", QLD: "Queensland’s", WA: "Western Australia’s", SA: "South Australia’s", TAS: "Tasmania’s", ACT: "the ACT’s", NT: "the Northern Territory’s" };
const FAMS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
const FAM_NAME = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", ind: "Independent", csa: "Community Strong", oth: "Other" };
const FAM_PL = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", ind: "independents", csa: "Community Strong", oth: "others" };
// the family a seat's holder reads as in "now": Community Strong's pair get
// their own colour, while the vote tallies keep them in the independent family
const holdFam = (h) => (h.ab === "CSA" ? "csa" : h.fam);
const FAM_LEG = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", ind: "Independents", csa: "Community Strong", oth: "Others" };
/* the parties as compact column-head codes (the list table's lens header) */
const FAM_CODE = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", ind: "IND", oth: "OTH" };
const FAM = (ab) => (ab === "ALP" ? "alp" : ["LP", "LNP", "NP", "CLP", "NAT", "LNQ"].includes(ab) ? "lnp" : ab === "GRN" ? "grn" : ab === "ON" || ab === "HAN" ? "onp" : ab === "IND" || ab === "" || ab === "NAFD" || ab === "CSA" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", LNP: "Liberal National", LNQ: "Liberal National", NP: "Nationals", CLP: "Country Liberal", GRN: "Greens", IND: "Independent", NAFD: "Independent", ON: "One Nation", HAN: "One Nation", KAP: "Katter’s Australian", PUP: "Palmer United", UAPP: "United Australia", LDP: "Liberal Democrats", AJP: "Animal Justice", CYA: "Trumpet of Patriots", FFP: "Family First", FFPA: "Family First", LTP: "Libertarian", HMP: "Legalise Cannabis", GRPF: "People First", SAL: "Socialist Alliance", VNS: "Victorian Socialists", ASP: "Shooters, Fishers and Farmers", AUC: "Australian Christians", CEC: "Citizens Party", IMO: "HEART", SOPA: "FUSION", AUD: "Australian Democrats", DEM: "Democrats", GAP: "Great Australian", IAP: "Indigenous-Aboriginal", JLN: "Jacqui Lambie Network", TNL: "TNL", SPP: "Sustainable Australia", DHJP: "Justice Party", AUVA: "Australian Values", WAP: "Western Australia Party", AUP: "Australian Progressives", TLOC: "The Local Party", DPDA: "Democratic Alliance", REAS: "Reason", CDP: "Christian Democrats", CSA: "Community Strong", RUA: "Rise Up Australia", SEP: "Socialist Equality", DLP: "Democratic Labour", FACN: "Fraser Anning’s Conservative Nationals", NGST: "No GST", SPA: "Secular Party", AFN: "Australia First", BTA: "Bullet Train for Australia" };
const partyName = (ab, pn) => (ab === "XEN" ? (pn && /xenophon/i.test(pn) ? "Nick Xenophon Team" : "Centre Alliance") : PARTY[ab] || (pn ? pn.replace(/^The /, "") : "") || ab || "Independent");
// a party as a sentence names it: "won Kooyong from the Liberals"
const THE = { Liberal: "the Liberals", Nationals: "the Nationals", Greens: "the Greens", "Liberal National": "the LNP", "Country Liberal": "the Country Liberals", Independent: "an independent", "Liberal Democrats": "the Liberal Democrats", Democrats: "the Democrats", "Palmer United": "Palmer United", "Nick Xenophon Team": "the Nick Xenophon Team" };
const theParty = (ab, pn) => { const n = partyName(ab, pn); return THE[n] || n; };
// whose: "One Nation’s preferences", "the Greens’ primary vote"
const POSS = { alp: "Labor’s", lnp: "the Coalition’s", grn: "the Greens’", onp: "One Nation’s", ind: "independents’", oth: "other candidates’" };
const Poss = (f) => POSS[f][0].toUpperCase() + POSS[f].slice(1);
const ORDW = ["", "", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordw = (n) => ORDW[n] || ord(n);
const partyShort = (ab, pn) => { const n = partyName(ab, pn); return { "Liberal National": "LNP", "Katter’s Australian": "Katter", "Shooters, Fishers and Farmers": "Shooters", "Country Liberal": "CLP" }[n] || n; };
const CLS = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const CLS_SHORT = { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro", Provincial: "Provincial", Rural: "Rural" };
const CLS_LOWER = { "Inner Metropolitan": "inner-metropolitan", "Outer Metropolitan": "outer-metropolitan", Provincial: "provincial", Rural: "rural" };
const CLS_DEF = { "Inner Metropolitan": "Settled, well-established suburbs of a capital city", "Outer Metropolitan": "Newer, growing suburbs on a capital city’s edge", Provincial: "Centred on a large regional city", Rural: "No major city: small towns and farming country" };
const IX = ["irsad", "irsd", "ier", "ieo"];
const IX_NAME = { irsad: "Advantage and disadvantage", irsd: "Disadvantage", ier: "Economic resources", ieo: "Education and occupation" };
const IX_ABBR = { irsad: "IRSAD", irsd: "IRSD", ier: "IER", ieo: "IEO" };
// the census tab's people measures: shares of residents, from the 2021 census, counted
// where each polling place's voters live (the AEC records that from 2016 on)
const DM = ["lang", "a65", "a2034"];
const DM_NAME = { lang: "Language other than English at home", a65: "Aged 65 and over", a2034: "Aged 20 to 34" };
const DM_SHORT = { lang: "Other language", a65: "Aged 65+", a2034: "Aged 20–34" };
const DM_VERB = { lang: "speak a language other than English at home", a65: "are aged 65 or over", a2034: "are aged 20 to 34" };
const DM_RANGE = { lang: [0, 60], a65: [5, 35], a2034: [10, 40] };
const isDemo = () => DM.includes(S.index);
const DEMO_FROM = 2016;
const TYPE = { 1: "Polling place", 2: "Hospital team", 3: "Remote mobile team", 4: "Mobile team", 5: "Early voting centre" };
const FPMAX = { alp: 70, lnp: 70, grn: 50, onp: 40, ind: 55, oth: 35 };
const YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025, "now"];
const YEAR_X = { now: 2026.8 };
const GOV = { 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp", now: "alp" };
const PM = { 2004: "John Howard", 2007: "Kevin Rudd", 2010: "Julia Gillard", 2013: "Tony Abbott", 2016: "Malcolm Turnbull", 2019: "Scott Morrison", 2022: "Anthony Albanese", 2025: "Anthony Albanese", now: "Anthony Albanese" };
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const K_HI = 2.6, K_ALL = 26, K_BLAB = 90;
const CITIES = [["Sydney", "NSW", [[150.62, -34.12], [151.34, -33.56]]], ["Melbourne", "VIC", [[144.6, -38.12], [145.42, -37.58]]], ["Brisbane", "QLD", [[152.78, -27.72], [153.22, -27.25]]], ["Perth", "WA", [[115.68, -32.32], [116.08, -31.7]]], ["Adelaide", "SA", [[138.46, -35.14], [138.76, -34.72]]], ["Hobart", "TAS", [[147.18, -42.98], [147.48, -42.74]]], ["Canberra", "ACT", [[148.98, -35.48], [149.24, -35.16]]], ["Darwin", "NT", [[130.82, -12.5], [131.08, -12.32]]]];
const LENSES = [
  { id: "winner", label: "Winner" },
  { id: "tpp", label: "Two-party" },
  { id: "fp", label: "Primary" },
  { id: "flow", label: "Preferences" },
  { id: "informal", label: "Informal" },
  { id: "cls", label: "Seat type" },
  { id: "seifa", label: "Census" },
];

/* =============================== state =============================== */
const S = {
  year: "now", lens: "winner", party: "onp", from: "onp", index: "irsad", basis: "venue", tppMode: "share", fpMode: "share",
  view: "map", sel: { level: "aus" }, hover: null,
  listUnit: "seats", sort: null, q: "",
  f: { st: null, cls: null, win: null, margin: null, range: null },
  dist: null,
};
const Y = {};
let proj = null;
const isNow = () => S.year === "now";
const yearLabel = (y) => (y === "now" ? "Now" : String(y));
const xOfYear = (y) => (y === "now" ? YEAR_X.now : y);

/* =============================== data =============================== */
const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });

function cleanBooth(name, div, ty) {
  let s = name.replace(new RegExp("\\s*\\(" + div.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\)$"), "");
  if (ty === 5 || / PPVC$/i.test(s) || /\bEVC$/.test(s)) s = s.replace(/\s+[A-Z][A-Z' .-]+\s+PPVC$/, "").replace(/\s+PPVC$/i, "").replace(/\s+EVC$/, "") + " early voting centre";
  return s;
}
function firstYearOf(h, name, upto) { let y = upto; for (let k = h.length - 1; k >= 0; k--) { if (h[k][0] > upto) continue; if (h[k][3] === name) y = h[k][0]; else break; } return y; }

function deriveDiv(d, i, year) {
  const c = d.c.map(([n, ab, pn, b, v, sw, el], k) => ({ k, n, ab, pn, b, v, sw, el: !!el, fam: FAM(ab) }));
  const formal = sum(c.map((x) => x.v));
  const fp = {}; for (const b of FAMS) fp[b] = 0; for (const x of c) fp[x.b] += x.v; for (const b of FAMS) fp[b] = (100 * fp[b]) / formal;
  const [[ia, va], [ib, vb]] = d.tcp;
  const A = c[ia], B = c[ib], tt = va + vb;
  const win = va >= vb ? A : B, run = va >= vb ? B : A;
  const winPct = (100 * Math.max(va, vb)) / tt;
  const classic = [A.fam, B.fam].includes("alp") && [A.fam, B.fam].includes("lnp");
  const alpSide = classic ? (A.fam === "alp" ? 0 : 1) : -1;
  const flows = d.fl.map(([ci, ta, tb]) => ({ cand: c[ci], ta, tb }));
  const flowAlp = {};
  for (const b of FAMS) {
    flowAlp[b] = null;
    if (!classic) continue;
    let toA = 0, tot = 0;
    for (const f of flows) if (f.cand.b === b) { toA += alpSide === 0 ? f.ta : f.tb; tot += f.ta + f.tb; }
    if (tot > 0) flowAlp[b] = (100 * toA) / tot;
  }
  const tpp = d.tpp && d.tpp[0] + d.tpp[1] ? (100 * d.tpp[0]) / (d.tpp[0] + d.tpp[1]) : null;
  const yNum = year === "now" ? 2026 : year;
  const prev = d.h.filter((h) => h[0] < yNum && !h[4]).pop() || null;
  let change;
  if (!prev) change = { kind: yNum === 2004 ? "unknown" : "new" };
  else if (prev[3] === win.n) change = { kind: "re", since: firstYearOf(d.h.filter((h) => !h[4]), win.n, yNum) };
  else if (FAM(prev[2]) === win.fam && !(win.fam === "ind")) change = { kind: "held", prev };
  else change = { kind: "gain", prev };
  const inf = d.inf;
  return {
    i, id: d.id, n: d.n, st: d.st, cls: d.cls, c, formal, inf, infPct: inf != null ? (100 * inf) / (formal + inf) : null, fp,
    A, B, va, vb, win, run, winPct, margin: winPct - 50, votesMargin: Math.abs(va - vb), classic, alpSide, flows, flowAlp,
    tpp, tppSw: d.tpp ? d.tpp[2] : null, seifa: d.seifa || {}, vt: d.vt || null, h: d.h, demo: d.demo, lp: d.lp, lpx: 0, lpy: 0, change,
    hold: { n: win.n, ab: win.ab, pn: win.pn, fam: win.fam },
  };
}

function deriveBooths(B, m) {
  const n = B.id.length;
  const o = { n, d: Int16Array.from(B.d), id: B.id, ty: Uint8Array.from(B.ty), prem: B.prem, sub: B.sub, pc: B.pc, raw: B,
    name: new Array(n), x: new Float32Array(n).fill(NaN), y: new Float32Array(n).fill(NaN), votes: new Float32Array(n), formal: new Float32Array(n),
    infPct: new Float32Array(n).fill(NaN), tpp: new Float32Array(n).fill(NaN), tppSw: new Float32Array(n).fill(NaN), lead: new Array(n).fill(null), leadPct: new Float32Array(n).fill(NaN),
    fp: {}, flowAlp: {}, byDiv: m.divs.map(() => []) };
  for (const b of FAMS) { o.fp[b] = new Float32Array(n).fill(NaN); o.flowAlp[b] = new Float32Array(n).fill(NaN); }
  for (let j = 0; j < n; j++) {
    const D = m.divs[B.d[j]];
    o.byDiv[B.d[j]].push(j);
    o.name[j] = cleanBooth(B.n[j], D.n, B.ty[j]);
    if (B.lat[j] != null) { const p = proj([B.lon[j], B.lat[j]]); if (p) { o.x[j] = p[0]; o.y[j] = p[1]; } }
    const v = B.v[j]; let formal = 0; for (const x of v) formal += x;
    o.formal[j] = formal; o.votes[j] = formal + B.inf[j];
    if (o.votes[j]) o.infPct[j] = (100 * B.inf[j]) / o.votes[j];
    if (formal) { const acc = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 }; for (let k = 0; k < v.length; k++) acc[D.c[k].b] += v[k]; for (const b of FAMS) o.fp[b][j] = (100 * acc[b]) / formal; }
    const t = B.tpp[j]; if (t && t[0] + t[1]) { o.tpp[j] = (100 * t[0]) / (t[0] + t[1]); if (t[2] != null) o.tppSw[j] = t[2]; }
    const tc = B.tcp[j]; if (tc && tc[0] + tc[1]) { const a = tc[0] >= tc[1]; o.lead[j] = a ? D.A : D.B; o.leadPct[j] = (100 * Math.max(tc[0], tc[1])) / (tc[0] + tc[1]); }
    const fl = B.fl[j];
    if (fl && D.classic) for (const b of FAMS) { let toA = 0, tot = 0; for (const [ci, ta, tb] of fl) if (D.c[ci].b === b) { toA += D.alpSide === 0 ? ta : tb; tot += ta + tb; } if (tot >= 12) o.flowAlp[b][j] = (100 * toA) / tot; }
  }
  return o;
}

function deriveAreas(res, m) {
  const out = {};
  for (const st of ["AUS", ...STATES]) {
    const a = res.agg[st];
    const fp = {}, fpSw = {};
    for (const b of FAMS) { fp[b] = (100 * a.prim[b]) / a.formal; fpSw[b] = fp[b] - (100 * a.pprim[b]) / a.pformal; }
    const idx = m.divs.filter((d) => st === "AUS" || d.st === st).map((d) => d.i);
    // census shares pooled over the seats' vote-weighted populations, in percent
    let demo = null;
    const ds = idx.map((i) => m.divs[i].demo).filter((x) => x && x.p);
    if (ds.length) { const P = sum(ds.map((x) => x.p)); demo = {}; for (const k of DM) demo[k] = (100 * sum(ds.map((x) => x.p * x[k]))) / P; }
    out[st] = { st, fp, fpSw, tpp: (100 * a.tpp[0]) / (a.tpp[0] + a.tpp[1]), tppSw: a.tpp[2], infPct: (100 * a.inf) / (a.inf + a.formal), idx, formal: a.formal, demo };
  }
  return out;
}

function buildGeo(topo, m) {
  const fc = topojson.feature(topo, topo.objects.divs);
  const gen = d3.geoPath(proj);
  const paths = new Array(m.divs.length), bb = new Array(m.divs.length);
  for (const f of fc.features) {
    const i = m.byName.get(f.properties.name);
    if (i == null) continue;
    const p = new Path2D(); d3.geoPath(proj, p)(f); paths[i] = p;
    bb[i] = gen.bounds(f);
  }
  const mk = (g) => { const p = new Path2D(); d3.geoPath(proj, p)(g); return p; };
  const o = topo.objects.divs;
  return {
    paths, bb,
    meshDiv: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st === b.properties.st)),
    meshState: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)),
    coast: mk(topojson.mesh(topo, o, (a, b) => a === b)),
  };
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
function buildSearch(m) {
  const items = [];
  for (const st of STATES) items.push({ k: "state", st, t: STATE_TITLE[st], s: `${m.areas[st].idx.length} seats`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 });
  for (const d of m.divs) {
    items.push({ k: "div", i: d.i, t: d.n, s: `${STATE_SHORT[d.st]} · ${d.hold.n}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.n), rank: 1 });
    items.push({ k: "mp", i: d.i, t: d.hold.n, s: `${isNow() || m.year === "now" ? "Member" : "Elected"} for ${d.n}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.hold.n), rank: 2 });
    for (const c of d.c) if (c !== d.win && c.v / d.formal > 0.06) items.push({ k: "cand", i: d.i, t: c.n, s: `Candidate in ${d.n}, ${partyName(c.ab, c.pn)}`, h: norm(c.n), rank: 3 });
  }
  const b = m.booth;
  for (let j = 0; j < b.n; j++) {
    const D = m.divs[b.d[j]];
    const where = [b.prem[j], b.sub[j] && b.sub[j] + (b.pc[j] ? " " + b.pc[j] : "")].filter(Boolean).join(", ");
    items.push({ k: "booth", j, t: b.name[j], s: `${D.n} · ${where || TYPE[b.ty[j]]}`, h: norm(b.name[j] + " " + (b.sub[j] || "") + " " + (b.pc[j] || "") + " " + (b.prem[j] || "")), rank: 4 });
  }
  return { items };
}

/* "Now": the 2025 House with the Farrer by-election and every change of party since */
function applyNow(m, now) {
  const fi = m.byName.get("Farrer");
  const by = now.byelections.Farrer;
  // the by-election replaces Farrer's 2025 count, booth by booth
  const D = deriveDiv(by.div, fi, "now");
  D.inf = by.informal; D.infPct = (100 * by.informal) / (by.informal + by.formal); D.vt = null; D.lp = m.divs[fi].lp; D.lpx = m.divs[fi].lpx; D.lpy = m.divs[fi].lpy;
  D.by = { date: by.date, event: by.event, formal: by.formal, informal: by.informal, turnout: by.turnout, enrolment: by.enrolment, prev: m.divs[fi] };
  D.change = { kind: "by", prev: m.divs[fi].h.filter((h) => !h[4]).pop() };
  m.divs[fi] = D;
  // the 2025 count at each by-election place, by family, for the swings at the same place
  const B25 = m.res.booths, D25 = m.res.divs[fi];
  const fams25 = D25.c.map((c) => c[3]);
  const prevFp = by.booths.prev.map((j) => {
    if (j == null) return null;
    const v = B25.v[j], tot = v.reduce((a, b) => a + b, 0), acc = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 };
    if (!tot) return null;
    v.forEach((x, k) => (acc[fams25[k]] += x));
    for (const f in acc) acc[f] = (100 * acc[f]) / tot;
    return acc;
  });
  const B = m.res.booths, keep = [];
  for (let j = 0; j < B.id.length; j++) if (B.d[j] !== fi) keep.push(j);
  const nb = {};
  for (const k of Object.keys(B)) nb[k] = keep.map((j) => B[k][j]);
  const BB = by.booths;
  for (let j = 0; j < BB.id.length; j++) for (const k of Object.keys(B)) nb[k].push(k === "d" ? fi : BB[k] ? BB[k][j] : null);
  nb.prevFp = keep.map(() => null).concat(prevFp);
  m.res = { ...m.res, booths: nb };
  // who sits for each changed seat today
  for (const [name, h] of Object.entries(now.holders)) {
    const i = m.byName.get(name);
    m.divs[i].hold = { n: h.n, ab: h.ab, pn: partyName(h.ab), fam: FAM(h.ab) };
  }
  m.changes = now.changes;
  m.asOf = now.asOf;
}

// the views with a filed seating plan (map/data/seats-<year>.json, from .build/map/seating.mjs)
const SEATED = new Set(["now", 2025, 2022]);
async function loadYear(year) {
  if (Y[year]) return Y[year].ready;
  const m = { year, ready: null };
  Y[year] = m;
  m.ready = (async () => {
    const ry = year === "now" ? 2025 : year;
    const [res, lo, now, seating] = await Promise.all([getJSON(`/map/data/res-${ry}.json`), getJSON(`/map/data/geo-${ry}-lo.json`), year === "now" ? getJSON("/map/data/data-now.json") : null,
      SEATED.has(year) ? getJSON(`/map/data/seats-${year}.json`).catch(() => null) : null]);
    if (!proj) proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], topojson.feature(lo, lo.objects.divs));
    m.res = res;
    m.date = res.date;
    m.divs = res.divs.map((d, i) => deriveDiv(d, i, year));
    m.byName = new Map(m.divs.map((d) => [d.n, d.i]));
    for (const d of m.divs) { const p = proj(d.lp); d.lpx = p[0]; d.lpy = p[1]; }
    if (now) applyNow(m, now);
    m.speaker = m.byName.get(res.speaker);
    m.seating = seating;
    m.gov = GOV[year];
    m.geo = buildGeo(lo, m);
    m.booth = deriveBooths(m.res.booths, m);
    m.areas = deriveAreas(res, m);
    m.search = buildSearch(m);
    getJSON(`/map/data/geo-${ry}-hi.json`).then((hi) => { m.geoHi = buildGeo(hi, m); schedule(); }).catch(() => {});
    return m;
  })();
  return m.ready;
}
const M = () => (Y[S.year] && Y[S.year].divs ? Y[S.year] : null);
const prevYearOf = (y) => (y === "now" ? 2025 : y === 2004 ? 2001 : YEARS[YEARS.indexOf(y) - 1] || null);

/* =============================== lens values =============================== */
// the colour a seat wears: in "Now" the Winner lens reads who holds the seat today
function divValue(m, i) {
  const d = m.divs[i];
  switch (S.lens) {
    case "winner": return holdFam(d.hold);
    case "tpp": return S.tppMode === "swing" ? nn(d.tppSw) : nn(d.tpp);
    case "fp": return S.fpMode === "change" ? fpChange(m, d, S.party) : d.fp[S.party];
    case "flow": return d.classic ? nn(d.flowAlp[S.from]) : null;
    case "informal": return nn(d.infPct);
    case "cls": return d.cls || null;
    case "seifa": return isDemo() ? (d.demo && d.demo[S.index] != null ? 100 * d.demo[S.index] : null) : nn(d.seifa[S.index] && d.seifa[S.index].dec);
  }
  return null;
}
// a party's primary-vote change on the previous election in the same seat
// (the AEC's candidate swing columns, summed by family; null where the family
// didn't stand last time and doesn't now)
function fpChange(m, d, fam) {
  if (d.by) { // the by-election against the seat's 2025 count
    const p = d.by.prev; return d.fp[fam] - p.fp[fam];
  }
  let s = 0, any = false;
  for (const c of d.c) if (c.b === fam && c.sw != null) { s += c.sw; any = true; }
  return any ? s : null;
}
function boothValue(m, j) {
  const b = m.booth;
  switch (S.lens) {
    case "winner": return b.lead[j] ? b.lead[j].fam : null;
    case "tpp": return S.tppMode === "swing" ? nn(b.tppSw[j]) : nn(b.tpp[j]);
    case "fp": {
      if (S.fpMode !== "change") return nn(b.fp[S.party][j]);
      const pf = b.raw.prevFp ? b.raw.prevFp[j] : null;
      if (!pf) return null;
      const v = b.fp[S.party][j];
      return Number.isNaN(v) ? null : v - pf[S.party];
    }
    case "flow": return nn(b.flowAlp[S.from][j]);
    case "informal": return nn(b.infPct[j]);
    case "cls": return m.divs[b.d[j]].cls || null;
    case "seifa": {
      if (isDemo()) { const r = b.raw.demo && b.raw.demo[j]; return r ? 100 * r[DM.indexOf(S.index)] : null; }
      const arr = S.basis === "voters" ? b.raw.vdec[j] : b.raw.dec[j]; return arr ? nn(arr[IX.indexOf(S.index)]) : null;
    }
  }
  return null;
}
const dIdx = (u) => Math.round(clamp(u, -1, 1) * 100) + 100;
function colorOf(v) {
  if (v == null) return null;
  switch (S.lens) {
    case "winner": return TH.party[v];
    case "tpp": return S.tppMode === "swing" ? RAMP.div[dIdx(-v / 10)] : RAMP.div[dIdx((50 - v) / 20)];
    case "fp": return S.fpMode === "change"
      ? (v >= 0 ? RAMP.fp[S.party][Math.round(clamp(v / 15, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 15, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
    case "flow": return RAMP.div[dIdx((50 - v) / 40)];
    case "informal": return RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)];
    case "cls": { const k = CLS.indexOf(v); return k < 0 ? null : TH.cls[k]; }
    case "seifa": {
      if (!isDemo()) return RAMP.seifa[Math.round(((v - 1) / 9) * 100)];
      const [lo, hi] = DM_RANGE[S.index]; return RAMP.demo[S.index][Math.round(clamp((v - lo) / (hi - lo), 0, 1) * 100)];
    }
  }
  return null;
}
const lensNumeric = () => !(S.lens === "winner" || S.lens === "cls");

/* =============================== colours per year =============================== */
let fade = null, fadeT = 1;
function recolor(animate) {
  for (const m of Object.values(Y)) {
    if (!m.divs) continue;
    if (animate && m.divCol && !reduceMotion) { m.prevDivCol = m.divCol; m.prevBoothCol = m.boothCol; }
    else { m.prevDivCol = null; m.prevBoothCol = null; }
    m.divCol = m.divs.map((d) => colorOf(divValue(m, d.i)));
    const bc = new Array(m.booth.n);
    for (let j = 0; j < m.booth.n; j++) bc[j] = colorOf(boothValue(m, j));
    m.boothCol = bc;
  }
  fade = animate && !reduceMotion ? { t0: performance.now(), dur: 360 } : null;
  schedule();
}
const fillDiv = (m, i) => (fade && m.prevDivCol ? mixC(m.prevDivCol[i], m.divCol[i], fadeT) : m.divCol[i]);
const fillBooth = (m, j) => (fade && m.prevBoothCol ? mixC(m.prevBoothCol[j], m.boothCol[j], fadeT) : m.boothCol[j]);

/* =============================== the stage =============================== */
const canvas = $("#cv"), ctx = canvas.getContext("2d");
const hitCtx = document.createElement("canvas").getContext("2d");
let Wpx = 0, Hpx = 0, dpr = 1, T = d3.zoomIdentity, HOME = d3.zoomIdentity;
const zoom = d3.zoom().scaleExtent([0.5, 2600]).clickDistance(6)
  // the wheel is ours (pan on a trackpad, zoom on a mouse wheel or a pinch)
  .filter((e) => S.view === "map" && e.type !== "wheel" && !e.button && !(e.type === "dblclick"))
  .on("start", (e) => { if (e.sourceEvent && e.sourceEvent.type === "mousedown") canvas.classList.add("grabbing"); })
  .on("zoom", (e) => { T = e.transform; schedule(); updateHint(); legendIfChanged(); })
  .on("end", () => canvas.classList.remove("grabbing"));
d3.select(canvas).call(zoom).on("dblclick.zoom", null);

let hatchCanvas = null;
function hatch() {
  const s = Math.round(7 * dpr);
  if (!hatchCanvas || hatchCanvas._th !== TH || hatchCanvas._dpr !== dpr) {
    hatchCanvas = document.createElement("canvas"); hatchCanvas.width = hatchCanvas.height = s; hatchCanvas._th = TH; hatchCanvas._dpr = dpr;
    const g = hatchCanvas.getContext("2d");
    g.fillStyle = css(TH.nodata); g.fillRect(0, 0, s, s);
    g.strokeStyle = css(TH.hatch); g.lineWidth = Math.max(1, dpr * 0.9);
    g.beginPath(); for (const o of [-s, 0, s]) { g.moveTo(o, s); g.lineTo(o + s, 0); } g.stroke();
  }
  return ctx.createPattern(hatchCanvas, "repeat");
}

function viewBox() { return [-T.x / T.k, -T.y / T.k, (Wpx - T.x) / T.k, (Hpx - T.y) / T.k]; }
const geoOf = (m) => (T.k > K_HI && m.geoHi ? m.geoHi : m.geo);
const selDiv = () => (S.sel.level === "div" || S.sel.level === "booth" ? S.sel.div : null);

// Where booths are on screen they carry the colour, so the areas behind them
// fade to a quiet tint: everywhere once every booth shows (city zoom), and
// the opened seat as soon as it is chosen.
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let quietSince = 0, needFrame = false;
function quietness(i, now) {
  const all = 0.72 * smooth(K_ALL * 0.75, K_ALL * 1.15, T.k);
  if (i === selDiv()) return Math.max(all, 0.72 * clamp((now - quietSince) / 450, 0, 1));
  return all;
}
// streetA: how strongly the streets show between the fills and the borders
// (only for the year in view; the frame passes it once per paint)
function drawGeo(m, alpha, streetA) {
  const g = geoOf(m), th = TH, now = performance.now();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / (dpr * T.k)));
  const filt = filtersOn();
  for (let i = 0; i < m.divs.length; i++) {
    const b = g.bb[i];
    if (!b || b[1][0] < x0 || b[0][0] > x1 || b[1][1] < y0 || b[0][1] > y1) continue;
    let c = fillDiv(m, i);
    const qn = m === M() ? quietness(i, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    if (qn > 0 && qn < 0.72 && i === selDiv()) needFrame = true;
    ctx.fillStyle = c ? css(c) : pat;
    ctx.fill(g.paths[i]);
    if (filt && !passes(m, i)) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(g.paths[i]); }
  }
  if (streetA > 0) drawStreets(streetA);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = css(th.bg); ctx.lineWidth = Math.min(1.1, 0.35 + T.k * 0.25) / T.k; ctx.stroke(g.meshDiv);
  ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.state, 0.7); ctx.lineWidth = 0.9 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k; ctx.stroke(g.coast);
  ctx.restore();
}

function drawFocus(m) {
  const g = geoOf(m), th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  if (sd != null) {
    const v = new Path2D(); v.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); v.addPath(g.paths[sd]);
    ctx.fillStyle = css(th.bg, th.veil); ctx.fill(v, "evenodd");
  } else if (S.sel.level === "state") {
    ctx.fillStyle = css(th.bg, th.veil * 0.85);
    for (const d of m.divs) if (d.st !== S.sel.st) ctx.fill(g.paths[d.i]);
  }
  const h = S.hover;
  if (h && h.kind === "div" && h.i !== sd) { ctx.strokeStyle = css(th.ink, 0.9); ctx.lineWidth = 1.6 / T.k; ctx.stroke(g.paths[h.i]); }
  if (sd != null) { ctx.strokeStyle = css(th.ink); ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.paths[sd]); }
  ctx.restore();
}

// A booth's dot. Its size is a 1,000-vote booth's radius times the square
// root of its votes over 1,000 (area true), damped to a fourth root past
// 4,000 so the biggest early-voting centres stay on the map, capped at 2.5x
// (9,800 votes). That base radius tracks how far apart the inner cities'
// booths sit on screen (BOOTH_GAP, the 2025 inner-metropolitan median
// distance to the nearest booth, in map units): small dots at city zoom,
// where the booths crowd, growing to 9px from suburb zoom in. Below city
// zoom only an opened seat's booths show, with room to spare, so the floors
// rise there and a rural seat's small booths stay visible.
const BOOTH_GAP = 0.158;
const roomy = () => 1 - smooth(K_ALL * 0.4, K_ALL * 0.9, T.k);
const dotBase = () => Math.min(9, Math.max(2.6 + 1.9 * roomy(), 0.34 * BOOTH_GAP * T.k));
const voteScale = (v) => Math.min(2.5, v <= 4000 ? Math.sqrt(v / 1000) : 2 * Math.pow(v / 4000, 0.25));
const rad = (votes) => Math.max(1.6 + 0.6 * roomy(), dotBase() * voteScale(votes));
// the paper ring that parts overlapping dots, thinner on the small ones
const halo = (r) => clamp(0.18 * r + 0.5, 0.8, 1.6);
function visibleBooths(m) {
  const b = m.booth, out = [], sd = selDiv();
  if (sd == null && T.k < K_ALL) return out;
  const [x0, y0, x1, y1] = viewBox(), pad = 24 / T.k;
  if (sd != null) for (const j of b.byDiv[sd]) if (!Number.isNaN(b.x[j])) out.push(j);
  if (T.k >= K_ALL) for (let j = 0; j < b.n; j++) {
    if (b.d[j] === sd || b.ty[j] !== 1) continue;
    const x = b.x[j], y = b.y[j];
    if (Number.isNaN(x) || x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
    out.push(j);
  }
  out.sort((a, c) => b.votes[c] - b.votes[a]);
  return out;
}
function boothShape(g, ty, x, y, r) {
  g.beginPath();
  if (ty === 5) { const s = r * 0.92; if (g.roundRect) g.roundRect(x - s, y - s, 2 * s, 2 * s, s * 0.32); else g.rect(x - s, y - s, 2 * s, 2 * s); }
  else g.arc(x, y, r, 0, Math.PI * 2);
}
function drawBooths(m) {
  const list = visibleBooths(m); m._vis = list;
  if (!list.length) return;
  const b = m.booth, th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / dpr));
  const rf = S.f.range && S.listUnit === "booths" ? S.f.range : null;
  for (const j of list) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]);
    if (x < -r || y < -r || x > Wpx + r || y > Hpx + r) continue;
    let a = sd != null && b.d[j] !== sd ? 0.5 : 1;
    if (rf && !inRange(boothColValue(m, j, rf.key), rf)) a *= 0.2;
    ctx.globalAlpha = a;
    boothShape(ctx, b.ty[j], x, y, r + halo(r)); ctx.fillStyle = css(th.bg); ctx.fill();
    const c = fillBooth(m, j);
    boothShape(ctx, b.ty[j], x, y, r); ctx.fillStyle = c ? css(c) : pat; ctx.fill();
  }
  ctx.globalAlpha = 1;
  const ring = (j, w, col) => { const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]); boothShape(ctx, b.ty[j], x, y, r + 2.4); ctx.lineWidth = w; ctx.strokeStyle = css(col); ctx.stroke(); };
  if (S.hover && S.hover.kind === "booth") ring(S.hover.i, 1.6, th.ink);
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) ring(S.sel.booth, 2.4, th.ink);
  ctx.restore();
}

function drawLabels(m) {
  const th = TH, placed = [], now = performance.now();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  // ground = the colour the label sits on: light ground takes ink with a soft
  // paper halo, dark ground takes near-white with a faint shadow
  const put = (txt, x, y, size, weight, ground, tone, force) => {
    ctx.font = `${weight} ${size}px ${SANS}`;
    const w = ctx.measureText(txt).width, r = [x - w / 2 - 3, y - size / 2 - 2, x + w / 2 + 3, y + size / 2 + 2];
    if (!force) {
      if (r[0] < 2 || r[2] > Wpx - 2 || r[1] < 2 || r[3] > Hpx - 2) return false;
      for (const q of placed) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return false;
    }
    placed.push(r);
    const dark = lumL(ground) < 0.6;
    if (dark) { ctx.lineWidth = 2.4; ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.strokeText(txt, x, y); ctx.fillStyle = "rgba(255,255,255,0.96)"; }
    else { ctx.lineWidth = 2.6; ctx.strokeStyle = css(ground, 0.85); ctx.strokeText(txt, x, y); ctx.fillStyle = css(tone || th.ink2); }
    ctx.fillText(txt, x, y);
    return true;
  };
  const sd = selDiv(), b = m.booth;
  const groundOf = (i) => { const c = fillDiv(m, i); if (!c) return th.nodata; let g = towards(c, th.bg, quietness(i, now)); if (sd != null && i !== sd) g = towards(g, th.bg, th.veil); return g; };
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) {
    const j = S.sel.booth; put(b.name[j], b.x[j] * T.k + T.x, b.y[j] * T.k + T.y - rad(b.votes[j]) - 13, 13, 600, groundOf(sd), th.ink, true);
  }
  if (T.k >= 2.3) {
    const g = geoOf(m), cand = [];
    for (const d of m.divs) {
      if (d.i === sd && T.k > 20) continue;
      if (S.sel.level === "state" && d.st !== S.sel.st) continue;
      const bb = g.bb[d.i]; if (!bb) continue;
      const w = (bb[1][0] - bb[0][0]) * T.k, h = (bb[1][1] - bb[0][1]) * T.k;
      if (w < 52 || h < 20) continue;
      const x = d.lpx * T.k + T.x, y = d.lpy * T.k + T.y;
      if (x < -60 || x > Wpx + 60 || y < -30 || y > Hpx + 30) continue;
      cand.push({ d, x, y, a: w * h });
    }
    cand.sort((p, q) => (q.d.i === sd) - (p.d.i === sd) || q.a - p.a);
    for (const c of cand) put(c.d.n, c.x, c.y, c.d.i === sd ? 13.5 : 12, c.d.i === sd ? 600 : 500, groundOf(c.d.i), sd != null && c.d.i !== sd ? th.ink3 : th.ink2);
  }
  if (m._vis && m._vis.length && T.k > K_BLAB) {
    let n = 0;
    for (const j of m._vis) {
      if (n > 120) break;
      if (S.sel.level === "booth" && j === S.sel.booth) continue;
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y;
      if (x < 0 || y < 0 || x > Wpx || y > Hpx) continue;
      if (put(b.name[j].replace(" early voting centre", " (early)"), x, y - rad(b.votes[j]) - 9, 11, 400, groundOf(b.d[j]), sd != null && b.d[j] !== sd ? th.faint : th.ink2)) n++;
    }
  }
  ctx.restore();
}

/* ----- the streets -----
   From suburb zoom in, Esri's grey canvas tiles show the streets through the
   seat fills. The tiles are Web Mercator and the map is a conic projection, so
   each tile goes down as an affine fit to its four corners carried through
   the map's projection (off by a fifth of a pixel at most at the zooms they
   show at). They are drawn on a canvas of their own, their plain land taken
   to nothing, and laid over the fills - multiplied on paper, screened on the
   dark page - so the seat colours stay where they were and only the streets,
   blocks and water mark them. */
const STREETS = { k0: 45, k1: 110, zMin: 3, zMax: 16, cap: 360, live: 12 };
// the plain land of each sheet, taken to white (paper) or black (dark page)
const STREET_LAND = { light: 239, dark: 71 };
const streetURL = (dark, z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? "Dark" : "Light"}_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
const streetK = () => smooth(STREETS.k0, STREETS.k1, T.k);
const tiles = new Map();
let streetCv = null, streetUse = 0, streetLive = 0;
// lon/lat to Web Mercator's unit square, and back
const merc = (ll) => { const s = Math.sin((ll[1] * Math.PI) / 180); return [(ll[0] + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; };
const unmerc = (x, y) => [x * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI];
function tileAt(dark, z, x, y, want) {
  const key = (dark ? "d" : "l") + z + "/" + x + "/" + y;
  let t = tiles.get(key);
  if (!t && want && streetLive < STREETS.live) {
    t = { img: new Image(), ready: 0, failed: false, used: 0 };
    tiles.set(key, t); streetLive++;
    t.img.crossOrigin = "anonymous";
    t.img.src = streetURL(dark, z, x, y);
    t.img.decode().then(() => { t.ready = performance.now(); }, () => { t.failed = true; })
      .finally(() => { streetLive--; schedule(); });
    if (tiles.size > STREETS.cap) pruneTiles();
  }
  if (t) t.used = streetUse;
  return t;
}
function pruneTiles() {
  const old = [...tiles].filter(([, t]) => (t.ready || t.failed) && t.used < streetUse).sort((a, b) => a[1].used - b[1].used);
  for (const [k] of old.slice(0, tiles.size - Math.round(STREETS.cap * 0.75))) tiles.delete(k);
}
// a tile's corners on the canvas, in device pixels: top-left, top-right, bottom-left, bottom-right
function tileQuad(z, x, y) {
  const n = 2 ** z, out = [];
  for (const [u, v] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
    const p = proj(unmerc(u / n, v / n));
    out.push([(p[0] * T.k + T.x) * dpr, (p[1] * T.k + T.y) * dpr]);
  }
  return out;
}
// an image (or the part of it at sx, sy, sw square) laid on a quad by the
// affine that best fits its four corners, half a pixel over its edges so no
// seam opens between neighbours
function drawQuad(g, img, sx, sy, sw, q, alpha) {
  const [a, b, c, d] = q;
  const B = [(b[0] - a[0] + d[0] - c[0]) / 2, (b[1] - a[1] + d[1] - c[1]) / 2];
  const C = [(c[0] - a[0] + d[0] - b[0]) / 2, (c[1] - a[1] + d[1] - b[1]) / 2];
  const o = [(a[0] + b[0] + c[0] + d[0]) / 4 - (B[0] + C[0]) / 2, (a[1] + b[1] + c[1] + d[1]) / 4 - (B[1] + C[1]) / 2];
  const e = 0.5 / Math.max(1, Math.min(Math.hypot(B[0], B[1]), Math.hypot(C[0], C[1])));
  g.globalAlpha = alpha;
  g.setTransform(B[0], B[1], C[0], C[1], o[0], o[1]);
  g.drawImage(img, sx, sy, sw, sw, -e, -e, 1 + 2 * e, 1 + 2 * e);
}
function drawStreets(alpha) {
  if (!proj || alpha <= 0.004) return;
  const dark = TH.dark, W = canvas.width, H = canvas.height, now = performance.now();
  streetUse++;
  const inv = (sx, sy) => merc(proj.invert([(sx - T.x) / T.k, (sy - T.y) / T.k]));
  // the zoom whose pixels match the screen's, read at the middle of the view
  const m0 = inv(Wpx / 2, Hpx / 2), m1 = inv(Wpx / 2 + 64, Hpx / 2);
  const per = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) / 64;
  const z = clamp(Math.round(Math.log2(dpr / (per * 256)) - 0.2), STREETS.zMin, STREETS.zMax), n = 2 ** z;
  // the tiles under the view: its rim carried into Mercator
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]]) {
    const p = inv(u * Wpx, v * Hpx);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const tx0 = Math.floor(x0 * n), tx1 = Math.floor(x1 * n), ty0 = Math.floor(y0 * n), ty1 = Math.floor(y1 * n);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return; // never at these zooms; a guard
  if (!streetCv) streetCv = document.createElement("canvas");
  if (streetCv.width !== W || streetCv.height !== H) { streetCv.width = W; streetCv.height = H; }
  const g = streetCv.getContext("2d"), land = dark ? STREET_LAND.dark : STREET_LAND.light;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  g.fillStyle = `rgb(${land},${land},${land})`; g.fillRect(0, 0, W, H);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const q = tileQuad(z, tx, ty);
    if (Math.max(q[0][0], q[1][0], q[2][0], q[3][0]) < 0 || Math.min(q[0][0], q[1][0], q[2][0], q[3][0]) > W
      || Math.max(q[0][1], q[1][1], q[2][1], q[3][1]) < 0 || Math.min(q[0][1], q[1][1], q[2][1], q[3][1]) > H) continue;
    const t = tileAt(dark, z, tx, ty, true);
    const f = t && t.ready ? clamp((now - t.ready) / 200, 0, 1) : 0;
    if (f < 1) {
      // until it arrives (and while it fades in): the nearest coarser tile on hand,
      // else the finer ones of the zoom just left
      let held = false;
      for (let up = 1; up <= 6 && z - up >= STREETS.zMin && !held; up++) {
        const s = 2 ** up, px = tx >> up, py = ty >> up, pt = tileAt(dark, z - up, px, py, false);
        if (pt && pt.ready) { const w = 256 / s; drawQuad(g, pt.img, (tx - px * s) * w, (ty - py * s) * w, w, q, 1); held = true; }
      }
      if (!held && z < STREETS.zMax) for (let k = 0; k < 4; k++) {
        const cx = 2 * tx + (k & 1), cy = 2 * ty + (k >> 1), ct = tileAt(dark, z + 1, cx, cy, false);
        if (ct && ct.ready) drawQuad(g, ct.img, 0, 0, 256, tileQuad(z + 1, cx, cy), 1);
      }
      if (t && t.ready) needFrame = true;
    }
    if (f > 0) drawQuad(g, t.img, 0, 0, 256, q, f);
  }
  // the plain land to nothing: lifted to white on paper, differenced to black on the dark page
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.globalCompositeOperation = dark ? "difference" : "lighter";
  const lift = dark ? land : 255 - land;
  g.fillStyle = `rgb(${lift},${lift},${lift})`; g.fillRect(0, 0, W, H);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha * (dark ? 0.85 : 1);
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.drawImage(streetCv, 0, 0);
  ctx.restore();
}
let creditOn = false;
function showCredit(on) {
  if (on === creditOn) return;
  creditOn = on; $("#credit").hidden = !on;
}

/* ----- framing ----- */
function stagePads() {
  const phone = isPhone();
  return { t: phone ? 12 : 36, b: phone ? 12 : 18, l: phone ? 8 : 12, r: phone ? 44 : 50 };
}
function fitTransform(bb, maxK) {
  const p = stagePads();
  const [[x0, y0], [x1, y1]] = bb;
  const w = Math.max(x1 - x0, 0.05), h = Math.max(y1 - y0, 0.05);
  const k = Math.min((Wpx - p.l - p.r) / w, (Hpx - p.t - p.b) / h, maxK || 2400);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return d3.zoomIdentity.translate(p.l + (Wpx - p.l - p.r) / 2 - cx * k, p.t + (Hpx - p.t - p.b) / 2 - cy * k).scale(k);
}
function unionBB(list) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of list) { if (!b) continue; x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); } return [[x0, y0], [x1, y1]]; }
function homeBox(m) { return unionBB(m.geo.bb); }
// the map may pan anywhere inside the frame of the whole-country view, and no
// further out: at that zoom nothing moves, so a scroll there scrolls the page
function setExtent() {
  const m = M(); if (!m || !Wpx) return;
  HOME = fitTransform(homeBox(m));
  zoom.translateExtent([[-HOME.x / HOME.k, -HOME.y / HOME.k], [(Wpx - HOME.x) / HOME.k, (Hpx - HOME.y) / HOME.k]])
    .scaleExtent([HOME.k, 2600]).extent([[0, 0], [Wpx, Hpx]]);
}
function selectionBox() {
  const m = M(), g = m.geo;
  switch (S.sel.level) {
    case "aus": return homeBox(m);
    case "state": return unionBB(m.areas[S.sel.st].idx.map((i) => g.bb[i]));
    case "div": return g.bb[S.sel.div];
    case "booth": {
      const b = m.booth, j = S.sel.booth;
      if (Number.isNaN(b.x[j])) return g.bb[S.sel.div];
      const k0 = fitTransform(g.bb[S.sel.div]).k;
      const k = clamp(k0 * 1.7, 80, 900), half = Math.min(Wpx, Hpx) / k / 2;
      return [[b.x[j] - half, b.y[j] - half], [b.x[j] + half, b.y[j] + half]];
    }
  }
}
// the last view the page framed by itself, to tell it from one the reader has moved
let lastFit = null;
const atLastFit = () => lastFit && Math.abs(T.k / lastFit.k - 1) < 0.01 && Math.hypot(T.x - lastFit.x, T.y - lastFit.y) < 2;
function fitSelection(dur) {
  if (!M() || !Wpx || S.view !== "map") return;
  const t = fitTransform(selectionBox());
  lastFit = t;
  const s = d3.select(canvas);
  if (!dur || reduceMotion) { s.interrupt(); s.call(zoom.transform, t); }
  else s.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t);
}
function flyToCity(k) {
  const [, st, ll] = CITIES[k];
  const a = proj(ll[0]), b = proj(ll[1]);
  select({ level: "state", st }, { fly: false });
  const t = fitTransform([[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]);
  lastFit = t;
  const s = d3.select(canvas);
  if (reduceMotion) s.call(zoom.transform, t); else s.transition().duration(900).ease(d3.easeCubicInOut).call(zoom.transform, t);
}
function zoomBy(f) { if (S.view === "map") d3.select(canvas).transition().duration(reduceMotion ? 0 : 280).call(zoom.scaleBy, f); }

/* ----- the wheel, the trackpad and the pinch -----
   Two fingers on a trackpad pan the map in any direction; a pinch zooms; a
   notched mouse wheel zooms. Where the map can't move any further (the whole
   country already in view, or an edge reached) a vertical scroll passes
   through to the page, so the map never traps it. */
let wheelMode = null, wheelAt = 0;
function classifyWheel(e) {
  if (e.deltaMode !== 0) return "zoom";
  if (e.deltaX !== 0) return "pan";
  const w = e.wheelDeltaY;
  if (w !== undefined && w !== 0) {
    if (Math.abs(Math.abs(w) - Math.abs(e.deltaY) * 3) < 1.5) return "pan";
    if (w % 120 === 0) return "zoom";
  }
  return Math.abs(e.deltaY) < 50 ? "pan" : "zoom";
}
function zoomAt(px, py, factor) {
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), T.k * factor, [px, py]);
}
function panPx(dx, dy) {
  d3.select(canvas).interrupt();
  const before = T;
  zoom.translateBy(d3.select(canvas), dx / T.k, dy / T.k);
  return [T.x - before.x, T.y - before.y];
}
canvas.addEventListener("wheel", (e) => {
  if (S.view !== "map") { if (e.ctrlKey) e.preventDefault(); return; }
  const now = performance.now();
  if (now - wheelAt > 180) wheelMode = null;
  wheelAt = now;
  const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if (e.ctrlKey) { // a trackpad pinch arrives as a ctrl-wheel
    e.preventDefault();
    zoomAt(px, py, Math.pow(2, -e.deltaY * 0.012));
    return;
  }
  // a notched wheel announces itself (line deltas, or whole multiples of 120); it
  // overrides a running trackpad gesture, which otherwise keeps its reading so
  // momentum scrolling never flips into zoom
  const notch = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && (e.wheelDeltaY ? e.wheelDeltaY % 120 === 0 : Number.isInteger(e.deltaY)));
  if (notch) wheelMode = "zoom";
  else if (!wheelMode) wheelMode = classifyWheel(e);
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Hpx : 1;
  if (wheelMode === "pan") {
    const [mx, my] = panPx(-e.deltaX * unit, -e.deltaY * unit);
    const vertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
    if (vertical && Math.abs(my) < 0.5 && Math.abs(mx) < 0.5) return; // nothing moved: let the page scroll
    e.preventDefault();
  } else {
    const atMin = T.k <= HOME.k * 1.001 && e.deltaY > 0;
    if (atMin) return; // zoomed right out: scrolling on goes to the page
    e.preventDefault();
    zoomAt(px, py, Math.pow(2, -e.deltaY * unit * 0.002));
  }
}, { passive: false });
// Safari's own pinch events
let gestureK = 1;
canvas.addEventListener("gesturestart", (e) => { e.preventDefault(); gestureK = T.k; });
canvas.addEventListener("gesturechange", (e) => {
  e.preventDefault(); if (S.view !== "map") return;
  const r = canvas.getBoundingClientRect();
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), gestureK * e.scale, [e.clientX - r.left, e.clientY - r.top]);
});
canvas.addEventListener("gestureend", (e) => e.preventDefault());

/* ----- hit testing ----- */
function hitTest(px, py) {
  const m = M(); if (!m) return null;
  if (S.view === "chamber") return chamberHit(m, px, py);
  if (S.view !== "map") return null;
  const b = m.booth; let bj = null, bd = Infinity;
  for (const j of m._vis || []) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, dd = Math.hypot(px - x, py - y);
    if (dd <= Math.max(rad(b.votes[j]) + 3, 8) && dd < bd) { bd = dd; bj = j; }
  }
  if (bj != null) return { kind: "booth", i: bj };
  const g = geoOf(m), bx = (px - T.x) / T.k, by = (py - T.y) / T.k;
  for (let i = 0; i < m.divs.length; i++) {
    const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue;
    if (hitCtx.isPointInPath(g.paths[i], bx, by)) return { kind: "div", i };
  }
  return null;
}

/* =============================== the chamber ===============================
   The House of Representatives as the chamber is built, after the
   Parliament's seating plan (aph.gov.au): the Speaker's chair on its dais at
   the head of the table, the Clerk and Deputy Clerk below it, the T-shaped
   table with two chairs a side, Hansard's desk at its foot. The front benches
   run down either side of the table; behind them four rows of two-seat
   blocks, then five rows round the far curve, cut by aisles. The government
   sits on the Speaker's right (the reader's left, the Speaker facing down
   the page). Where a seating plan is filed (map/data/seats-<year>.json, from
   .build/map/seating.mjs) every member sits where the plan puts them;
   otherwise each bloc fills the benches from its Speaker's end in the lens's
   order, so on the two-party lens the House reads as a pendulum bent round
   the table. Each member is a chair; empty seats stay empty. The Speaker's
   own seat takes the Speaker's chair. */
const CU = 30; // plan points to a chamber unit
/* @cells-begin – shared with .build/map/seating.mjs, which reads this block as is.
   The chamber's seats in plan points about the centre of the far curve (y down,
   the government's side at negative x), each { id, x, y, fa (the way it faces),
   row (0 the table, 1 the front bench … 5) }. Ids: side L|R, then a<i> the
   front bench's straight arm, t<i> the table, b<row><slot> the side blocks,
   c<row><sector><i> round the curve. */
const CHB = {
  arm: { x: 110, y0: -362, pitch: 21.38, n: 16 },
  table: { x: 49.6, ys: [-182, -142] },
  blockX: [138, 181, 223, 264], // rows 2 to 5
  tierY: [[-282, -256], [-214, -188], [-146, -120], [-68, -42]], // two seats a block
  R: [91, 138, 180, 222, 264], // the curve's rows
  // each row's sectors round a quarter of the curve: [from, to] degrees below the horizontal, seats
  sectors: [[[4, 82, 6]], [[4, 42, 3], [47, 83, 3]],
    [[3, 22, 2], [25, 43, 2], [47.5, 65.5, 2], [68, 86, 2]],
    [[3, 22, 2], [25, 43, 2], [47.5, 65.5, 2], [68, 86, 2]],
    [[3, 22, 3], [25, 43, 3], [47.5, 65.5, 3], [68, 86, 3]]],
};
function chamberCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    for (let i = 0; i < CHB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * CHB.arm.x, y: CHB.arm.y0 + CHB.arm.pitch * i, fa, row: 1 });
    CHB.table.ys.forEach((y, i) => cells.push({ id: `${P}t${i}`, x: sx * CHB.table.x, y, fa, row: 0 }));
    CHB.blockX.forEach((bx, k) => CHB.tierY.flat().forEach((y, j) => cells.push({ id: `${P}b${k + 2}${j}`, x: sx * bx, y, fa, row: k + 2 })));
    CHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = CHB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 1}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 1 });
      }
    }));
  }
  return cells;
}
const SERJEANT = "Rc5d1"; // the Serjeant-at-Arms's chair, in the curve's last row by the centre aisle
/* @cells-end */

// position along the benches: down the government's side, round the curve, up the opposition's
const CHK = 6;
let chGeomC = null;
function chamberGeom() {
  if (chGeomC) return chGeomC;
  const all = chamberCells().map((c) => {
    const x = c.x / CU, y = c.y / CU;
    const s = y > 0 ? Math.atan2(y, -x) * CHK : x < 0 ? y : Math.PI * CHK - y;
    return { id: c.id, x, y, fa: c.fa, row: c.row, s };
  });
  const seats = all.filter((c) => c.id !== SERJEANT).sort((p, q) => p.s - q.s || p.row - q.row);
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = (c.s - s0) / (s1 - s0); });
  const rows = [0, 1, 2, 3, 4, 5].map((r) => seats.filter((c) => c.row === r));
  chGeomC = { seats, rows, bench: seats.filter((c) => c.row > 0), byId: new Map(seats.map((c) => [c.id, c.k])),
    serjeant: all.find((c) => c.id === SERJEANT), rOut: CHB.R[4] / CU, W: 19 / CU, D: 16.5 / CU,
    box: { x0: -9.55, x1: 9.55, y0: -13.25, y1: 9.55 } };
  return chGeomC;
}
// the walkways between rows (0 inside the front bench, 5 outside the back row), on the straight and round the curve
const CH_GS = [96, 124, 159.5, 202, 243.5, 279].map((v) => v / CU);
const CH_GC = [77, 114.5, 159, 201, 243, 279].map((v) => v / CU);
function benchPt(s, k) {
  if (s <= 0) return [-CH_GS[k], s];
  if (s >= Math.PI * CHK) return [CH_GS[k], Math.PI * CHK - s];
  const a = s / CHK; return [-CH_GC[k] * Math.cos(a), CH_GC[k] * Math.sin(a)];
}
// outward from the benches at position s
function benchOut(s) {
  if (s <= 0) return [-1, 0];
  if (s >= Math.PI * CHK) return [1, 0];
  const a = s / CHK; return [-Math.cos(a), Math.sin(a)];
}

// blocs, in the order they sit from the Speaker's right round to the left
function chamberBlocs(m) {
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const cross = gov === "alp" ? ["grn", "ind", "csa", "oth", "onp"] : ["onp", "oth", "csa", "ind", "grn"];
  return { gov, opp, cross };
}
// the lens's ordering key, read from the bloc's own side
function chamberKey(m, d, bloc) {
  const own = (v) => (v == null ? null : bloc === "lnp" ? 100 - v : v);
  switch (S.lens) {
    case "tpp":
      if (S.tppMode === "swing") return d.tppSw == null ? null : bloc === "lnp" ? -d.tppSw : d.tppSw;
      return bloc === "alp" || bloc === "lnp" ? own(d.tpp) : d.winPct;
    case "fp": return divValue(m, d.i);
    case "flow": case "informal": case "seifa": { const v = divValue(m, d.i); return v == null ? null : v + (S.lens === "seifa" && !isDemo() && d.seifa[S.index] ? d.seifa[S.index].pct / 100 : 0); }
    case "cls": return d.cls ? 10 - CLS.indexOf(d.cls) + d.winPct / 1000 : null;
    default: return d.winPct;
  }
}
function chamberOrder(m) {
  const plan = m.seating;
  const key = plan ? `${m.year}|plan` : `${m.year}|${S.lens}|${S.tppMode}|${S.fpMode}|${S.party}|${S.from}|${S.index}`;
  if (m._chKey === key) return m._ch;
  const geom = chamberGeom();
  const { gov, opp, cross } = chamberBlocs(m);
  const members = m.divs.filter((d) => d.i !== m.speaker);
  const byKey = (bloc) => (p, q) => {
    const a = chamberKey(m, p, bloc), b = chamberKey(m, q, bloc);
    if (a == null && b == null) return p.n.localeCompare(q.n);
    if (a == null) return 1;
    if (b == null) return -1;
    return b - a;
  };
  const G = members.filter((d) => holdFam(d.hold) === gov).sort(byKey(gov));
  const O = members.filter((d) => holdFam(d.hold) === opp).sort(byKey(opp));
  const C = [];
  const groups = [];
  for (const f of cross) {
    const xs = members.filter((d) => holdFam(d.hold) === f).sort(byKey(f));
    if (xs.length) groups.push({ fam: f, n: xs.length });
    C.push(...xs);
  }
  // each member's seat (an index into geom.seats)
  const at = new Map();
  if (plan) {
    const taken = new Set();
    for (const d of members) { const k = geom.byId.get(plan.at[d.n]); if (k != null && !taken.has(k)) { at.set(d.i, k); taken.add(k); } }
    // anyone the plan doesn't seat takes the first free bench seat from their side's Speaker end
    const B = geom.bench;
    for (const d of members) if (!at.has(d.i)) {
      const back = holdFam(d.hold) === opp;
      for (let j = 0; j < B.length; j++) { const c = B[back ? B.length - 1 - j : j]; if (!taken.has(c.k)) { at.set(d.i, c.k); taken.add(c.k); break; } }
    }
  } else {
    // no plan: the government from its Speaker's end, the crossbench after it, the opposition from
    // the other end; the empty seats fall between the crossbench and the opposition, so the
    // majority line never has to cross them
    const B = geom.bench;
    G.forEach((d, k) => at.set(d.i, B[k].k));
    C.forEach((d, k) => at.set(d.i, B[G.length + k].k));
    O.forEach((d, k) => at.set(d.i, B[B.length - 1 - k].k));
  }
  const order = [...G, ...C, ...O].map((d) => d.i);
  const sp = m.divs[m.speaker];
  const N = m.divs.length, maj = Math.floor(N / 2) + 1;
  m._ch = { order, at, gov, opp, nGov: G.length, nCross: C.length, nOpp: O.length, groups, maj, plan: !!plan,
    majAt: maj - (sp && holdFam(sp.hold) === gov ? 1 : 0) };
  m._chKey = key;
  return m._ch;
}
/* the majority line: the first majAt members along the benches (front row first where rows sit
   level) hold the government's majority; in each row the line passes through the gap after the
   last of them, so it runs between chairs, never across one. Returns each row's cut position. */
function majorityCuts(ch, geom) {
  const sat = [...ch.at.values()].map((k) => geom.seats[k]).sort((p, q) => p.s - q.s || p.row - q.row);
  if (ch.majAt <= 0 || ch.majAt >= sat.length) return null;
  const inside = new Set(sat.slice(0, ch.majAt).map((c) => c.k)), sStar = sat[ch.majAt - 1].s;
  const cuts = [];
  for (let r = 1; r <= 5; r++) {
    const row = geom.rows[r];
    let L = -1;
    row.forEach((c, j) => { if (inside.has(c.k)) L = j; });
    if (L < 0) row.forEach((c, j) => { if (c.s < sStar) L = j; });
    const a = row[L], b = row[L + 1];
    cuts.push(a && b ? (a.s + b.s) / 2 : a ? a.s + 0.4 : b.s - 0.4);
  }
  return cuts;
}

/* screen placement of the chamber in a w x h box */
function chamberFrame(geom, w, h, pad) {
  const b = geom.box, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const s = Math.max(0.5, Math.min((w - pad.l - pad.r) / bw, (h - pad.t - pad.b) / bh));
  const ox = pad.l + (w - pad.l - pad.r - bw * s) / 2 - b.x0 * s, oy = pad.t + (h - pad.t - pad.b - bh * s) / 2 - b.y0 * s;
  return { s, ox, oy, X: (x) => ox + x * s, Yp: (y) => oy + y * s };
}

/* gliding between orders: each chair keyed by the seat's name */
let chAnim = null; // { from: Map(name -> [x, y, fa]), t0, dur }
const chLast = new Map();
function chamberPositions(m, geom) {
  const ch = chamberOrder(m);
  const pos = new Map();
  for (const [i, k] of ch.at) { const st = geom.seats[k]; pos.set(m.divs[i].n, [st.x, st.y, st.fa, st.u]); }
  return pos;
}
function startChamberGlide() {
  if (reduceMotion || !chLast.size) return;
  chAnim = { from: new Map(chLast), t0: performance.now(), dur: 680 };
  schedule();
}
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

function drawChair(g, x, y, fa, w, d, fill, backFill, alpha) {
  g.save(); g.translate(x, y); g.rotate(fa); g.globalAlpha *= alpha;
  const r = Math.min(w, d) * 0.24;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, d, w, r); else g.rect(-d / 2, -w / 2, d, w);
  g.fillStyle = fill; g.fill();
  // the backrest
  const bd = d * 0.3;
  g.beginPath(); if (g.roundRect) g.roundRect(-d / 2, -w / 2, bd, w, [r, 0, 0, r]); else g.rect(-d / 2, -w / 2, bd, w);
  g.fillStyle = backFill; g.fill();
  g.restore();
}
const SPEAKER_AT = [0, -365 / CU, Math.PI / 2];

/* the room: the floor, the benches and their empty seats, the dais, the table, the officers' chairs */
function drawChamberFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, P = (v) => v / CU;
  const rr = (x0, y0, x1, y1, r) => { g.beginPath(); if (g.roundRect) g.roundRect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s, r); else g.rect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s); };
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const empty = mixC(th.floor, th.ink, th.dark ? 0.12 : 0.08), officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // the floor
  const FR = P(282), top = P(-380);
  g.beginPath(); g.moveTo(X(-FR), Yp(top)); g.lineTo(X(-FR), Yp(0)); g.arc(X(0), Yp(0), FR * s, Math.PI, 0, true); g.lineTo(X(FR), Yp(top)); g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  // the benches
  g.fillStyle = bench;
  const D = Math.PI / 180;
  for (const sx of [-1, 1]) {
    const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
    { const [x0, x1] = lo(sx * (CHB.arm.x - 11), sx * (CHB.arm.x + 11)); rr(x0, CHB.arm.y0 - 11, x1, CHB.arm.y0 + CHB.arm.pitch * (CHB.arm.n - 1) + 11, 2); g.fill(); g.stroke(); }
    for (const bx of CHB.blockX) for (const [t0, t1] of CHB.tierY) { const [x0, x1] = lo(sx * (bx - 12), sx * (bx + 12)); rr(x0, t0 - 13, x1, t1 + 13, 2); g.fill(); g.stroke(); }
    CHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1]) => {
      const r0 = P(CHB.R[k] - 12) * s, r1 = P(CHB.R[k] + 12) * s;
      // angles on the canvas: the government's quarter runs from pi back towards pi/2, the opposition's from 0 to pi/2
      const A0 = sx < 0 ? Math.PI - a0 * D : a0 * D, A1 = sx < 0 ? Math.PI - a1 * D : a1 * D;
      g.beginPath(); g.arc(X(0), Yp(0), r1, A0, A1, sx < 0); g.arc(X(0), Yp(0), r0, A1, A0, sx > 0); g.closePath(); g.fill(); g.stroke();
    }));
    // the officials' boxes behind the front bench, on a rail
    for (const cx of [222.9, 189.6, 147.7]) { const [x0, x1] = lo(sx * (cx - 12), sx * (cx + 12)); rr(x0, -373, x1, -322, 2); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(X(P(sx * 236)), Yp(P(-318))); g.lineTo(X(P(sx * 121)), Yp(P(-318))); g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = wood; g.stroke(); g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // the Speaker's dais, raised above the floor, its step drawn inside
  const dais = (inset) => { const w = 34 - inset, yt = -393 + inset, yc = -349; g.beginPath(); g.moveTo(X(P(-w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yc))); g.arc(X(0), Yp(P(yc)), P(w) * s, 0, Math.PI); g.closePath(); };
  dais(0); g.fillStyle = wood; g.fill(); g.stroke();
  dais(5); g.fillStyle = bench; g.fill();
  // the table: a T, the wider head towards the Speaker; its panels, and the mace
  g.beginPath();
  for (const [x, y] of [[-45.8, -268.6], [44.3, -268.6], [44.3, -215.2], [35, -215.2], [35, -110], [-36.6, -110], [-36.6, -215.2], [-45.8, -215.2]]) g.lineTo(X(P(x)), Yp(P(y)));
  g.closePath(); g.fillStyle = bench; g.fill(); g.lineWidth = Math.max(1, s * 0.05); g.strokeStyle = wood; g.stroke();
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  g.beginPath();
  for (const x of [-15.5, 14.5]) { g.moveTo(X(P(x)), Yp(P(-266))); g.lineTo(X(P(x)), Yp(P(-218))); }
  g.moveTo(X(P(-0.8)), Yp(P(-212))); g.lineTo(X(P(-0.8)), Yp(P(-113)));
  for (const y of [-180, -145]) { g.moveTo(X(P(-34)), Yp(P(y))); g.lineTo(X(P(32.5)), Yp(P(y))); }
  g.stroke();
  if (s > 9) {
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(1, s * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(X(P(-19)), Yp(P(-123))); g.lineTo(X(P(17)), Yp(P(-123))); g.stroke();
    g.beginPath(); g.arc(X(P(-19)), Yp(P(-123)), s * 0.12, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
    g.lineCap = "butt"; g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // Hansard's desk at the table's foot
  rr(-31.5, -63, 31.5, -34, 2); g.fillStyle = wood; g.fill(); g.stroke();
  // every seat, empty until a member's chair is painted over it
  const W = geom.W * s, Dp = geom.D * s;
  for (const c of geom.seats) drawChair(g, X(c.x), Yp(c.y), c.fa, W, Dp, css(empty), back(empty, 0.12), 1);
  // the officers: Clerk and Deputy Clerk at the table's head, Hansard's two reporters, the Serjeant-at-Arms
  const sj = geom.serjeant;
  for (const [x, y, fa] of [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2], [-19.7, -21.5, -Math.PI / 2], [18.2, -21.5, -Math.PI / 2], [sj.x * CU, sj.y * CU, sj.fa]])
    drawChair(g, X(P(x)), Yp(P(y)), fa, W * 1.05, Dp * 1.05, css(officer), back(officer, 0.18), 1);
  // the furniture's names, where they fit
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P(-196), P(66));
    put("Hansard", 0, P(-48.5), P(58));
  }
}
const SPEAKER_SCALE = 1.42;

// draw the whole chamber into a context already scaled to CSS pixels
function drawChamber(g, m, w, h, opts) {
  const geom = chamberGeom();
  const pad = opts.pad || { t: 8, r: 8, b: 8, l: 8 };
  const F = chamberFrame(geom, w, h, pad);
  const th = TH, s = F.s, now = performance.now();
  const ch = chamberOrder(m);
  const target = chamberPositions(m, geom);
  // animation progress
  let t = 1;
  if (chAnim) { t = clamp((now - chAnim.t0) / chAnim.dur, 0, 1); if (t >= 1) chAnim = null; else needFrame = true; }
  const pos = (name) => {
    const to = target.get(name); if (!to) return null;
    if (!chAnim || !chAnim.from.has(name)) return to;
    const fr = chAnim.from.get(name);
    const lag = clamp(Math.abs(to[3] - (fr[3] ?? to[3])) * 0.35, 0, 0.35);
    const q = easeOut(clamp((t - lag * 0.5) / (1 - lag * 0.5), 0, 1));
    return [lerp(fr[0], to[0], q), lerp(fr[1], to[1], q), angLerp(fr[2], to[2], q), to[3]];
  };
  const X = F.X, Yp = F.Yp, rO = geom.rOut;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  drawChamberFurniture(g, F, geom, opts);
  // the chairs
  const filt = filtersOn(), sd = opts.sel, hv = opts.hover, stSel = opts.state;
  const pat = opts.pattern;
  const chairW = geom.W * s, chairD = geom.D * s;
  const backOf = (c) => towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22);
  const drawn = [];
  const paint = (i, x, y, fa, scale, sp) => {
    const d = m.divs[i];
    let c = fillDiv(m, i);
    let a = 1;
    if (filt && !passes(m, i)) a = 0.16;
    if (stSel && d.st !== stSel) a = Math.min(a, 0.2);
    if (opts.only != null && i !== opts.only) a = Math.min(a, 0.22);
    const W = chairW * scale, D = chairD * scale;
    if (!c) { drawChair(g, x, y, fa, W, D, pat || css(th.nodata), css(th.hatch), a); }
    else drawChair(g, x, y, fa, W, D, css(c), css(backOf(c)), a);
    drawn.push({ i, x, y, r: Math.max(W, D) * 0.62, fa, W, D, sp });
  };
  ch.order.forEach((i) => {
    const p = pos(m.divs[i].n); if (!p) return;
    paint(i, X(p[0]), Yp(p[1]), p[2], 1);
  });
  // the Speaker's chair, on the dais at the head of the table, facing down the chamber
  if (m.speaker != null) paint(m.speaker, X(SPEAKER_AT[0]), Yp(SPEAKER_AT[1]), SPEAKER_AT[2], SPEAKER_SCALE, true);
  // rings for the hovered and chosen seats
  const ring = (i, lw) => { const q = drawn.find((x) => x.i === i); if (!q) return; g.save(); g.translate(q.x, q.y); g.rotate(q.fa); g.beginPath(); const pd = 2.2; if (g.roundRect) g.roundRect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd, 3); else g.rect(-q.D / 2 - pd, -q.W / 2 - pd, q.D + 2 * pd, q.W + 2 * pd); g.lineWidth = lw; g.strokeStyle = css(th.ink); g.stroke(); g.restore(); };
  if (hv != null && hv !== sd) ring(hv, 1.4);
  if (sd != null) ring(sd, 2.2);
  // every label drawn round the chamber claims its box, so the chosen seat's name can find a free spot
  const occ = (opts.keepOut || []).slice();
  const claim = (x, y, wd, ht, align, base) => {
    const x0 = align === "right" ? x - wd : align === "center" ? x - wd / 2 : x;
    const y0 = base === "top" ? y : base === "middle" ? y - ht / 2 : y - ht;
    occ.push({ x0, y0, x1: x0 + wd, y1: y0 + ht });
  };
  // the majority line, threaded between the chairs from the front bench to the back row
  const cuts = opts.labels !== false ? majorityCuts(ch, geom) : null;
  if (cuts) {
    const pts = [];
    cuts.forEach((c, k) => {
      if (k) { const cp = cuts[k - 1], n = Math.max(2, Math.ceil(Math.abs(c - cp) * 3)); for (let j = 1; j <= n; j++) pts.push(benchPt(lerp(cp, c, j / n), k)); }
      else pts.push(benchPt(c, 0));
      pts.push(benchPt(c, k + 1));
    });
    const c5 = cuts[4], o = benchOut(c5), e = benchPt(c5, 5), ext = opts.big ? 0.45 : 0.2;
    pts.push([e[0] + o[0] * ext, e[1] + o[1] * ext]);
    g.strokeStyle = css(th.ink); g.lineWidth = opts.big ? 1.5 : 1.2; g.setLineDash(opts.big ? [4, 3] : [3, 2]); g.lineJoin = "round";
    g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(X(x), Yp(y)) : g.moveTo(X(x), Yp(y)))); g.stroke(); g.setLineDash([]);
    const p2 = [e[0] + o[0] * (opts.big ? 0.8 : 0.45), e[1] + o[1] * (opts.big ? 0.8 : 0.45)];
    const below = p2[1] > 1;
    if (!opts.big && s > 6) {
      g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : "center"; g.textBaseline = below ? "top" : "middle";
      g.fillText(`${ch.maj} for a majority`, X(p2[0]), Yp(p2[1]));
    }
    if (opts.big) {
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : below ? "right" : "center"; g.textBaseline = below ? "top" : "middle";
      const mt = `${ch.maj} for a majority`, mx = X(p2[0]) + (below && Math.abs(p2[0]) <= 0.5 ? -6 : 0), my = Yp(p2[1]);
      g.fillText(mt, mx, my);
      claim(mx, my, g.measureText(mt).width, 16, g.textAlign, g.textBaseline);
      // the dashed line itself, beyond the benches
      const ex = X(e[0]), ey = Yp(e[1]), fx = X(p2[0]), fy = Yp(p2[1]);
      occ.push({ x0: Math.min(ex, fx) - 3, y0: Math.min(ey, fy) - 3, x1: Math.max(ex, fx) + 3, y1: Math.max(ey, fy) + 3 });
    }
  }
  // the blocs' names and numbers, outside the benches
  if (opts.big) {
    const fig = (txt, col, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 30px ${SANS}`; g.fillStyle = css(col); g.fillText(txt, x, y); };
    const lab = (txt, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink); g.fillText(txt, x, y); };
    const govName = blocName(m, ch.gov), oppName = blocName(m, ch.opp);
    const yMid = Yp(-6.6);
    const room = X(-rO - 0.8);
    if (room > 70) {
      const blocLabel = (name, n, fam, role, x, align) => {
        lab(name, x, yMid - 34, align); fig(n, th.party[fam], x, yMid, align);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = align; g.fillText(role, x, yMid + 18);
        g.font = `600 13px ${SANS}`; let wd = g.measureText(name).width;
        g.font = `500 30px ${SANS}`; wd = Math.max(wd, g.measureText(n).width);
        g.font = `400 12px ${SANS}`; wd = Math.max(wd, g.measureText(role).width);
        claim(x, yMid - 48, wd, 72, align, "top");
      };
      const spFam = m.divs[m.speaker] && holdFam(m.divs[m.speaker].hold);
      blocLabel(govName, String(ch.nGov + (spFam === ch.gov ? 1 : 0)), ch.gov, "Government", X(-rO - 0.95), "right");
      blocLabel(oppName, String(ch.nOpp + (spFam === ch.opp ? 1 : 0)), ch.opp, "Opposition", X(rO + 0.95), "left");
    }
    if (ch.nCross) {
      // the crossbench's name and make-up beside its chairs, outside the curve, towards where they sit
      let mx = 0, my = 0, n = 0;
      for (const i of ch.order) { const d = m.divs[i]; if (holdFam(d.hold) === ch.gov || holdFam(d.hold) === ch.opp) continue; const c = geom.seats[ch.at.get(i)]; mx += c.x; my += c.y; n++; }
      mx /= n; my /= n;
      let pt;
      if (my > 0) { const l = Math.hypot(mx, my) || 1; pt = [(mx / l) * (rO + 1.25), (my / l) * (rO + 1.25)]; }
      else pt = [Math.sign(mx || 1) * (rO + 1.25), my];
      // never centred: at the foot of the chamber the majority label takes one side, this the other
      const side0 = pt[0] < -1.2 ? "right" : "left";
      // wrap the make-up to the room on that side, and find where the block's box falls
      const lay = (side, by) => {
        const bx = X(pt[0]) + (side === "left" ? (Math.abs(pt[0]) <= 1.2 ? 16 : 4) : -4);
        const maxW = Math.max(120, side === "left" ? F.ox + (geom.box.x1 + 6) * s - bx : bx - 10);
        g.font = `400 12px ${SANS}`;
        const lines = [];
        let line = "", wMax = 0;
        for (const p of crossParts(m, ch).split(" · ")) {
          const t = line ? line + " · " + p : p;
          if (g.measureText(t).width > maxW && line) { lines.push(line); line = p; } else line = t;
        }
        if (line) lines.push(line);
        for (const l of lines) wMax = Math.max(wMax, g.measureText(l).width);
        g.font = `600 13px ${SANS}`; wMax = Math.max(wMax, g.measureText(`Crossbench ${ch.nCross}`).width + 10);
        const x0 = side === "left" ? bx : bx - wMax, ht = 17 + lines.length * 15;
        // no room beside the chamber on a narrow screen: the key below gives the counts
        const room = side === "left" ? w - bx >= 150 : bx >= 150;
        const clear = !occ.some((o) => x0 < o.x1 + 4 && x0 + wMax > o.x0 - 4 && by < o.y1 + 3 && by + ht > o.y0 - 3);
        return { side, bx, by, lines, wMax, ht, room, clear };
      };
      const by0 = Yp(pt[1]) + (pt[1] > rO * 0.6 ? 6 : 0);
      // beside its chairs if that's clear of the majority label, else the other side, else lower down
      const other = side0 === "left" ? "right" : "left";
      const tries = [lay(side0, by0), lay(other, by0), ...[1, 2, 3].map((k) => lay(side0, by0 + k * 18))];
      const L = tries.find((c) => c.room && c.clear) || tries[0];
      if (L.room) {
        g.textAlign = L.side; g.textBaseline = "top";
        g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink);
        g.fillText(`Crossbench ${ch.nCross}`, L.bx, L.by);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
        L.lines.forEach((l, j) => g.fillText(l, L.bx, L.by + 17 + j * 15));
        claim(L.bx, L.by, L.wMax, L.ht, L.side, "top");
      }
    }
    // the Speaker, named above the dais
    const sp = m.divs[m.speaker];
    if (sp) {
      const a = "Speaker", b = `  ${speakerName(m)}, ${sp.n}`, y = Yp(geom.box.y0) - 9;
      g.textBaseline = "middle"; g.textAlign = "left";
      g.font = `600 12px ${SANS}`; const wa = g.measureText(a).width;
      g.font = `400 12px ${SANS}`; const wb = g.measureText(b).width;
      const x0 = X(0) - (wa + wb) / 2;
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2); g.fillText(a, x0, y);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.fillText(b, x0 + wa, y);
      claim(x0, y - 8, wa + wb, 16, "left", "top");
    }
    // the chosen seat's name, out beyond the benches on a leader line, at the nearest free spot
    if (sd != null) {
      const q = drawn.find((x) => x.i === sd);
      if (q && !q.sp) labelChosen(q, m.divs[sd].n);
    }
  }
  g.restore();
  finishChamber();
  return { drawn, F, geom };
  function labelChosen(q, txt) {
    const cx = (q.x - F.ox) / s, cy = (q.y - F.oy) / s;
    // outward: sideways off the straight benches, along the radius round the curve
    let dx, dy;
    if (cy <= 0) { dx = cx < 0 ? -1 : 1; dy = 0; } else { const l = Math.hypot(cx, cy) || 1; dx = cx / l; dy = cy / l; }
    // the name hangs where the bloc labels do, just beyond the benches
    const R = rO + 0.95, Rk = rO + 0.6;
    const ax = X(dx * R), ay = cy <= 0 ? q.y : Yp(dy * R);
    const kx = X(dx * Rk), ky = cy <= 0 ? q.y : Yp(dy * Rk);
    g.font = `600 13px ${SANS}`;
    const tw = g.measureText(txt).width, th2 = 16;
    const side = Math.abs(dx) >= 0.42;
    const align = side ? (dx < 0 ? "right" : "left") : "center";
    const floorR = rO + 0.5; // the outer chairs' backs
    const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return v <= 0 ? v >= geom.box.y0 && Math.abs(u) <= floorR : Math.hypot(u, v) <= floorR; };
    const boxAt = (lx, ly) => {
      const x0 = align === "right" ? lx - 6 - tw : align === "center" ? lx - tw / 2 : lx + 6;
      const y0 = side ? ly - th2 / 2 : ly + 5;
      return { x0, y0, x1: x0 + tw, y1: y0 + th2 };
    };
    const free = (b) => b.x0 >= 4 && b.x1 <= w - 4 && b.y0 >= 0 && b.y1 <= h - 2
      && !occ.some((o) => b.x0 < o.x1 + 4 && b.x1 > o.x0 - 4 && b.y0 < o.y1 + 3 && b.y1 > o.y0 - 3)
      && ![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1]].some(([px, py]) => onFloor(px, py));
    let box = boxAt(ax, ay), found = free(box);
    for (let k = 1; k <= 24 && !found; k++) {
      const off = Math.ceil(k / 2) * 9 * (k % 2 ? 1 : -1);
      // beside the straight benches, step up or down; round the curve, along it and outward
      const b = side ? boxAt(ax, ay + off * 2) : boxAt(ax + off * 2.2, ay + Math.ceil(k / 2) * 3);
      if (free(b)) { box = b; found = true; }
    }
    const my = (box.y0 + box.y1) / 2;
    g.save();
    g.textAlign = "left"; g.textBaseline = "middle";
    if (!found) {
      // no free room outside the benches (a phone): the name sits on a plate above its chair
      box = { x0: clamp(q.x - tw / 2, 4, w - 4 - tw), y0: Math.max(2, q.y - q.r - 22) };
      g.fillStyle = css(th.bg, 0.92);
      g.beginPath(); if (g.roundRect) g.roundRect(box.x0 - 5, box.y0 - 1, tw + 10, 18, 4); else g.rect(box.x0 - 5, box.y0 - 1, tw + 10, 18); g.fill();
      g.fillStyle = css(th.ink); g.fillText(txt, box.x0, box.y0 + 8);
      g.restore();
      return;
    }
    // the leader: from the chair's edge out past the benches, then to the name; beside the
    // straight benches it turns square, so it never crosses the bloc's label
    const ex = q.x + dx * q.r * 0.7, ey = q.y + dy * q.r * 0.7;
    const tx = align === "right" ? box.x1 + 4 : align === "left" ? box.x0 - 4 : (box.x0 + box.x1) / 2, ty = side ? my : box.y0 - 3;
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(ex, ey); g.lineTo(kx, ky);
    if (side && cy <= 0) g.lineTo(kx, ty);
    g.lineTo(tx, ty);
    g.lineWidth = 3.4; g.strokeStyle = css(th.floor); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = css(th.ink); g.stroke();
    g.lineWidth = 4; g.strokeStyle = css(th.bg); g.strokeText(txt, box.x0, my);
    g.fillStyle = css(th.ink); g.fillText(txt, box.x0, my);
    g.restore();
  }
  // remember where every chair was drawn, for the next glide and for hit tests
  function finishChamber() {
    if (!chAnim) for (const [k, v] of target) chLast.set(k, v);
    else for (const q of drawn) { const nm = m.divs[q.i].n; const p = pos(nm); if (p) chLast.set(nm, p); }
  }
}
const blocName = (m, fam) => (fam === "alp" ? "Labor" : "Coalition");
function crossParts(m, ch) {
  const cnt = {};
  for (const i of ch.order) { const d = m.divs[i]; if (d.hold.fam === ch.gov || d.hold.fam === ch.opp) continue; const k = crossLabel(d.hold); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(" · ");
}
function crossLabel(h) {
  if (h.ab === "CSA") return "Community Strong";
  const f = h.fam;
  if (f === "ind") return "Independents";
  if (f === "grn") return "Greens";
  if (f === "onp") return "One Nation";
  return partyShort(h.ab, h.pn);
}
const SPEAKERS = { 2004: "David Hawker", 2007: "Harry Jenkins", 2010: "Harry Jenkins", 2013: "Bronwyn Bishop", 2016: "Tony Smith", 2019: "Tony Smith", 2022: "Milton Dick", 2025: "Milton Dick", now: "Milton Dick" };
const speakerName = (m) => SPEAKERS[m.year];

let chMain = null; // the last full-size draw: chairs on screen, for hit tests and the morph
function chamberHit(m, px, py) {
  if (!chMain) return null;
  let best = null, bd = Infinity;
  for (const q of chMain.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 3 && d < bd) { bd = d; best = q.i; } }
  return best == null ? null : { kind: "div", i: best };
}
function chamberPads() { return isPhone() ? { t: 30, r: 10, b: 52, l: 10 } : { t: 34, r: 150, b: 66, l: 150 }; }
function drawChamberMain(m, alpha) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sd = selDiv();
  chMain = drawChamber(ctx, m, Wpx, Hpx, { big: true, alpha, sel: sd, hover: S.hover && S.hover.kind === "div" ? S.hover.i : null,
    state: S.sel.level === "state" ? S.sel.st : null, pad: chamberPads(), pattern: (() => { const p = hatch(); p.setTransform(new DOMMatrix().scale(1 / dpr)); return p; })() });
  ctx.restore();
}

/* ----- the morph between the map and the chamber ----- */
let morph = null; // { to: "chamber" | "map", t0, dur }
function drawMorph(m, p) {
  const th = TH;
  const geom = chamberGeom();
  const F = chamberFrame(geom, Wpx, Hpx, chamberPads());
  const target = chamberPositions(m, geom);
  // the map recedes, the chamber's furniture arrives
  if (p < 0.55) { drawGeo(m, 1 - p / 0.55, (1 - p / 0.55) * streetK()); }
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p > 0.45) {
    ctx.globalAlpha = clamp((p - 0.45) / 0.55, 0, 1);
    drawChamberFurniture(ctx, F, geom);
  }
  ctx.restore();
  const g = geoOf(m);
  const chairW = geom.W * F.s, chairD = geom.D * F.s;
  for (const d of m.divs) {
    const tgt = d.i === m.speaker ? SPEAKER_AT : target.get(d.n);
    if (!tgt) continue;
    const gx = d.lpx * T.k + T.x, gy = d.lpy * T.k + T.y;
    const cx = F.X(tgt[0]), cy = F.Yp(tgt[1]);
    const dist = Math.hypot(cx - gx, cy - gy) / Math.max(Wpx, Hpx);
    const q = clamp((p - dist * 0.22) / (1 - 0.22), 0, 1), e = ease(q);
    const x = lerp(gx, cx, e), y = lerp(gy, cy, e);
    const c = fillDiv(m, d.i) || th.nodata;
    // the seat's shape shrinks onto its chair...
    const sc = Math.pow(1 - e, 2.2);
    if (sc > 0.01 && g.paths[d.i]) {
      ctx.save();
      ctx.setTransform(dpr * T.k * sc, 0, 0, dpr * T.k * sc, dpr * (x - d.lpx * T.k * sc), dpr * (y - d.lpy * T.k * sc));
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(c); ctx.fill(g.paths[d.i]);
      ctx.restore();
    }
    // ...and the chair grows in its place
    const cs = smooth(0.35, 1, e);
    if (cs > 0.01) {
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sp = d.i === m.speaker ? SPEAKER_SCALE : 1;
      drawChair(ctx, x, y, lerp(0, tgt[2], e), chairW * sp * cs, chairD * sp * cs, css(c), css(towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22)), 1);
      ctx.restore();
    }
  }
}
/* ----- the small chamber in the story column ----- */
const miniCh = { canvas: null, drawn: null, F: null };
function paintMiniChamber() {
  const c = $("#minich"); if (!c) { miniCh.canvas = null; return; }
  const m = M(); if (!m) return;
  const w = c.clientWidth || 300;
  const geom = chamberGeom();
  const pad = { t: 4, r: 4, b: 22, l: 4 };
  const bw = geom.box.x1 - geom.box.x0, bh = geom.box.y1 - geom.box.y0;
  const h = Math.round(((w - 8) * bh) / bw + 26);
  const r = Math.min(window.devicePixelRatio || 1, 2);
  if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.height = h + "px"; }
  const g = c.getContext("2d");
  g.setTransform(r, 0, 0, r, 0, 0);
  g.clearRect(0, 0, w, h);
  const sd = selDiv();
  const out = drawChamber(g, m, w, h, { big: false, sel: sd, hover: miniCh.hover ?? null, state: S.sel.level === "state" ? S.sel.st : null, pad, labels: true });
  miniCh.canvas = c; miniCh.drawn = out.drawn;
}
function miniHit(px, py) {
  if (!miniCh.drawn) return null;
  let best = null, bd = Infinity;
  for (const q of miniCh.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 2 && d < bd) { bd = d; best = q.i; } }
  return best;
}

/* =============================== the story column ===============================
   The section anatomy of every other page, at column width: a title and its
   meta, a Crimson headline that states the finding, a dek, then the figures.
   Headlines are written by rule from the numbers on screen; each rule covers
   every case it can meet, and says nothing the data can't show. */
const swc = (fam) => `background:var(--m-${fam})`;
const tx = (fam) => `t-${fam}`;
const surname = (n) => n.split(" ").slice(-1)[0];
function pairNames(a, b) { const sa = surname(a.n), sb = surname(b.n); return sa === sb ? [a.n, b.n] : [sa, sb]; }
const famText = (fam) => `var(--${fam}-text)`;
const famFill = (fam) => `var(--${fam})`;
const thePartyFam = (fam) => FAM_PL[fam];
const leaderName = (h) => (h.ab === "CSA" ? "Community Strong" : partyName(h.ab, h.pn));
// the "now" view: today’s holder won the last count under another banner — the
// winner’s row in the count stays historical but earns a "· now X" note
const movedTo = (m, d) => (m.year === "now" && d.hold && d.hold.n === d.win.n && d.hold.ab !== d.win.ab ? leaderName(d.hold) : null);
function swingPhrase(sw, prev) {
  if (sw == null) return "";
  if (Math.abs(sw) < 0.05) return `no swing since ${prev}`;
  return `a swing of ${pts(sw)} to ${sw > 0 ? "Labor" : "the Coalition"} since ${prev}`;
}
function upDown(v, unit = "points") { const a = Math.abs(v); if (a < 0.05) return "unchanged"; return `${v >= 0 ? "up" : "down"} ${a.toFixed(1)} ${a.toFixed(1) === "1.0" ? unit.replace(/s$/, "") : unit}`; }
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// a rank among n seats, from whichever end is nearer: "the highest", "the third lowest"
function rankWords(r, n, hi = "highest", lo = "lowest") { const q = n - r + 1; if (r <= 10) return r === 1 ? `the ${hi}` : `the ${ordw(r)} ${hi}`; if (q <= 10) return q === 1 ? `the ${lo}` : `the ${ordw(q)} ${lo}`; return `the ${ord(r)} ${hi}`; }
const SUBJ = { alp: "Labor", lnp: "The Coalition", grn: "The Greens", onp: "One Nation", ind: "Independents", oth: "Other candidates" };
const subj = (f) => (f === "alp" || f === "onp" ? SUBJ[f] : SUBJ[f].charAt(0).toLowerCase() + SUBJ[f].slice(1));
const ofN = (k, n) => (k === n ? `all ${n}` : `${k} of the ${n}`);
const byNote = (d) => (d && d.by ? ", at the 2026 by-election" : "");
function seatCount(m, idx, fam) { return idx.filter((i) => m.divs[i].hold.fam === fam).length; }

/* ----- small figure builders ----- */
function upLink() {
  const s = S.sel, m = M();
  if (s.level === "aus") return "";
  const label = s.level === "state" ? "All seats" : s.level === "div" ? STATE_TITLE[s.st] : m.divs[s.div].n;
  const go = s.level === "state" ? "aus" : s.level === "div" ? `state:${s.st}` : `div:${s.div}`;
  return `<button type="button" class="st-up" data-go="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;
}
function head(title, meta, hed, dek) {
  return `${upLink()}<div class="st-head"><h2>${esc(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
}
// the Now page's two-party read: two names, two big figures, a rule between
function heroPair(aName, aPct, aFam, bName, bPct, bFam) {
  return `<div class="hero-read" role="img" aria-label="${esc(aName)} ${f1(aPct)}, ${esc(bName)} ${f1(bPct)}">
    <div class="hero-side a"><span class="hero-name" style="color:${famText(aFam)}"><i style="background:${famFill(aFam)}"></i>${esc(aName)}</span><span class="hero-num" style="color:${famFill(aFam)}">${f1(aPct)}</span></div>
    <span class="hero-rule"></span>
    <div class="hero-side b"><span class="hero-name" style="color:${famText(bFam)}">${esc(bName)}<i style="background:${famFill(bFam)}"></i></span><span class="hero-num" style="color:${famFill(bFam)}">${f1(bPct)}</span></div></div>`;
}
// the site's margin bar: where the lead sits between "◀ A ahead" and "B ahead ▶"
function marginBar(aName, aFam, bName, bFam, lead, span) {
  span = span || (Math.abs(lead) > 18 ? 30 : Math.abs(lead) > 9 ? 20 : 10);
  const x = (v) => 50 - (50 * clamp(v, -span, span)) / span; // positive = A ahead = left
  const ticks = [-span, -span / 2, 0, span / 2, span];
  const lab = (v) => (v === 0 ? "Tied" : `${Math.abs(v)}${Math.abs(v) === span ? " pts" : ""}`);
  const fam = lead >= 0 ? aFam : bFam;
  const bar = lead >= 0 ? `left:${x(lead)}%;width:${50 - x(lead)}%` : `left:50%;width:${x(lead) - 50}%`;
  return `<div class="mbar" aria-hidden="true">
    <span class="side" style="left:0;color:${famText(aFam)}">◀ ${esc(aName)} ahead</span><span class="side" style="right:0;color:${famText(bFam)}">${esc(bName)} ahead ▶</span>
    ${ticks.filter((v) => v !== 0).map((v) => `<span class="grid" style="left:${x(v)}%"></span>`).join("")}<span class="tie" style="left:50%"></span>
    <span class="bar" style="${bar};background:${famFill(fam)}"></span><span class="dot" style="left:${x(lead)}%;background:${famFill(fam)}"></span>
    ${ticks.map((v) => `<span class="tick${v === 0 ? " tied" : ""}" style="left:${x(v)}%">${lab(v)}</span>`).join("")}</div>`;
}
function statusOf(winPct) { return winPct < 56 ? "marginal" : winPct < 60 ? "fairly safe" : "safe"; }

function candRows(cands, formal, cmp, limit, swingOf, partyOf) {
  const sorted = [...cands].sort((a, b) => b.v - a.v);
  const top = Math.max(30, (100 * sorted[0].v) / formal);
  const pOf = partyOf || ((c) => partyName(c.ab, c.pn));
  const rows = sorted.map((c, k) => {
    const p = (100 * c.v) / formal, tick = cmp ? cmp(c) : null, sw0 = swingOf ? swingOf(c) : c.sw;
    return `<div class="row"${limit && k >= limit ? " data-extra hidden" : ""}><div class="nm" title="${esc(c.n)}, ${esc(pOf(c))}">${esc(c.n)}${c.el ? `<span class="el">elected</span>` : ""}<small>${esc(pOf(c))}</small></div><div class="bar"><i style="width:${(100 * p) / top}%;${swc(c.fam)}"></i>${tick != null ? `<u style="left:${clamp((100 * tick) / top, 0, 100)}%" title="Across the seat: ${f1(tick)}%"></u>` : ""}</div><div class="v">${f1(p)}</div><div class="d">${sw0 == null ? "" : sgn(sw0)}</div></div>`;
  });
  const more = limit && sorted.length > limit ? `<button type="button" class="more" data-more>All ${sorted.length} candidates</button>` : "";
  return `<div class="rows">${rows.join("")}</div>${more}`;
}
function famRows(fp, fpSw) {
  const order = FAMS.filter((b) => fp[b] > 0.05).sort((a, b) => fp[b] - fp[a]);
  const top = Math.max(40, fp[order[0]]);
  return `<div class="rows">${order.map((b) => `<div class="row"><div class="nm">${FAM_LEG[b]}</div><div class="bar"><i style="width:${(100 * fp[b]) / top}%;${swc(b)}"></i></div><div class="v ${tx(b)}">${f1(fp[b])}</div><div class="d">${fpSw ? sgn(fpSw[b]) : ""}</div></div>`).join("")}</div>`;
}
function flowRows(flows, pairA, pairB) {
  const agg = {};
  for (const f of flows) { const b = f.cand.b; (agg[b] = agg[b] || { b, ta: 0, tb: 0, names: [] }); agg[b].ta += f.ta; agg[b].tb += f.tb; agg[b].names.push(f.cand.n); }
  const list = Object.values(agg).filter((x) => x.ta + x.tb > 0).sort((x, y) => y.ta + y.tb - (x.ta + x.tb));
  if (!list.length) return "";
  const [la, lb] = pairNames(pairA, pairB);
  return list.map((x) => { const t = x.ta + x.tb, pa = (100 * x.ta) / t; return `<div class="flow"><div class="fh"><div>${FAM_LEG[x.b]}</div><span>${int(t)} votes</span></div><div class="fb"><i style="width:calc(${pa}% - 1px);${swc(pairA.fam)}"></i><i style="flex:1;${swc(pairB.fam)}"></i></div><div class="fl"><span><b class="${tx(pairA.fam)}">${f0(pa)}%</b> to ${esc(la)}</span><span>${esc(lb)} <b class="${tx(pairB.fam)}">${f0(100 - pa)}%</b></span></div></div>`; }).join("");
}
function decileRows(get, labelFor) {
  return `<div class="dec">${IX.map((ix) => { const v = get(ix); const cells = Array.from({ length: 10 }, (_, k) => `<i style="${v && k + 1 <= v ? `background:${css(RAMP.seifa[Math.round((k / 9) * 100)])}` : ""}"></i>`).join(""); return `<div class="nm">${IX_NAME[ix]}<small>${IX_ABBR[ix]}${v ? ` · decile ${v}` : " · no score"}${labelFor ? labelFor(ix, v) : ""}</small></div><div class="cells" role="img" aria-label="Decile ${v ?? "unknown"} of 10">${cells}</div>`; }).join("")}</div>`;
}
function linkRows(m, items, fmt, colOf) {
  return `<div class="links">${items.map(({ i, v }) => { const d = m.divs[i]; return `<button type="button" data-go="div:${i}"><i style="background:${colOf ? colOf(i) : "var(--line)"}"></i><span class="nm">${esc(d.n)}<small>${STATE_SHORT[d.st]}</small></span><b>${fmt(v, d)}</b></button>`; }).join("")}</div>`;
}
const colCss = (c) => (c ? css(c) : "var(--line)");

function historyChart(d) {
  const h = d.h.filter((r) => r[1] != null || r[3]);
  if (!h.length) return "";
  const W = 340, H = 120, padL = 26, padR = 10, padT = 10, padB = 22;
  const yx = (y) => (y === 2026 ? YEAR_X.now - 0.3 : y);
  const years = h.map((r) => yx(r[0])), y0 = 2004, y1 = Math.max(2025, years[years.length - 1]);
  const x = (y) => padL + ((yx(y) - y0) / Math.max(1, y1 - y0)) * (W - padL - padR);
  const vals = h.map((r) => r[1]).filter((v) => v != null);
  const lo = Math.min(30, Math.floor(Math.min(...vals, 50) / 10) * 10), hi = Math.max(70, Math.ceil(Math.max(...vals, 50) / 10) * 10);
  const yy = (v) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const ptsLine = h.filter((r) => r[1] != null).map((r) => `${x(r[0]).toFixed(1)},${yy(r[1]).toFixed(1)}`).join(" ");
  const grid = [lo, 50, hi].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${yy(v)}" y2="${yy(v)}" stroke="var(--line)" stroke-width="1"${v === 50 ? ' stroke-dasharray="3 3"' : ""}/><text x="${padL - 6}" y="${yy(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${v}</text>`).join("");
  const cur = S.year === "now" ? 2026 : S.year;
  const dots = h.map((r) => {
    const yv = r[1] != null ? r[1] : 50, on = r[0] === cur || (S.year === "now" && r[0] === 2025 && !h.some((q) => q[0] === 2026));
    const yr = r[0] === 2026 ? "now" : r[0];
    const title = r[4] ? `${r[0]} by-election: won by ${r[3]} (${partyName(r[2])}); no Labor v Coalition count` : `${r[0]}: Labor two-party ${f1(r[1])}; won by ${r[3]} (${partyName(r[2])})`;
    return `<g data-year="${yr}" style="cursor:pointer"><title>${esc(title)}</title><circle cx="${x(r[0])}" cy="${yy(yv)}" r="${on ? 5.5 : 4.2}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="2"${r[1] == null ? ' fill-opacity="0.9"' : ""}/>${on ? `<circle cx="${x(r[0])}" cy="${yy(yv)}" r="8.5" fill="none" stroke="var(--ink)" stroke-width="1.4"/>` : ""}</g>`;
  }).join("");
  const xl = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025].map((y) => `<text x="${x(y)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="${y === cur ? "var(--ink)" : "var(--ink-3)"}" font-weight="${y === cur ? 600 : 400}">’${String(y).slice(2)}</text>`).join("") + (h.some((r) => r[0] === 2026) ? `<text x="${x(2026)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">by</text>` : "");
  const runs = [];
  for (const r of h) { const last = runs[runs.length - 1]; if (last && last.n === r[3] && last.ab === r[2]) last.to = r[0]; else runs.push({ n: r[3], ab: r[2], from: r[0], to: r[0], by: r[4] }); }
  const now = S.year === "now" ? M() : null, hold = now ? now.divs[d.i].hold : null;
  if (hold && runs.length && (runs[runs.length - 1].n !== hold.n || runs[runs.length - 1].ab !== hold.ab)) runs.push({ n: hold.n, ab: hold.ab, from: "now", to: "now", switched: true });
  const holders = runs.reverse().map((r) => `<div><i style="${swc(FAM(r.ab))}"></i><span>${esc(r.n)}<small>${esc(leaderName({ ab: r.ab, pn: "" }))}</small></span><span>${r.switched ? "now" : r.by ? `${r.from} by-election` : r.from === r.to ? r.from : `${r.from}–${String(r.to).slice(2)}`}</span></div>`).join("");
  return `<div class="st-sec hist"><h3>Since 2004 <small>Labor’s two-party vote, and who won</small></h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Labor's two-party share in ${esc(d.n)} at each election since 2004">${grid}<polyline points="${ptsLine}" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linejoin="round"/>${dots}${xl}</svg><div class="holders">${holders}</div><p class="st-note">Boundaries are redrawn between some elections, so the area behind a name can change.</p></div>`;
}

/* ----- the national and state stories ----- */
function areaStats(m, st) {
  const A = m.areas[st], idx = A.idx, N = idx.length;
  const cnt = {}; for (const i of idx) { const f = holdFam(m.divs[i].hold); cnt[f] = (cnt[f] || 0) + 1; }
  return { A, idx, N, cnt };
}
// the crossbench in words: "eight independents, two from One Nation and one each from the Greens and Katter’s Australian"
function crossGroups(m, idx) {
  const xs = {};
  for (const i of idx) { const h = m.divs[i].hold; if (h.fam === "alp" || h.fam === "lnp") continue; const k = crossLabel(h); xs[k] = (xs[k] || 0) + 1; }
  return xs;
}
const listAnd = (a) => (a.length < 2 ? a[0] || "" : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
function crossbenchWords(m, idx) {
  const xs = crossGroups(m, idx);
  const named = (k) => (k === "Greens" ? "the Greens" : k === "Katter" ? "Katter’s Australian" : k);
  const parts = [];
  if (xs.Independents) { parts.push(`${words(xs.Independents)} ${xs.Independents === 1 ? "independent" : "independents"}`); delete xs.Independents; }
  const byN = {};
  for (const [k, n] of Object.entries(xs)) (byN[n] = byN[n] || []).push(named(k));
  for (const n of Object.keys(byN).map(Number).sort((a, b) => b - a)) {
    const ks = byN[n];
    if (n === 1) parts.push(ks.length === 1 ? `one from ${ks[0]}` : `one each from ${listAnd(ks)}`);
    else parts.push(ks.map((k) => `${words(n)} from ${k}`).join(", "));
  }
  return listAnd(parts);
}
// "The crossbench took 15: …", or where one group took every crossbench seat, "The other three went to independents"
function crossSentence(m, idx, verb) {
  const xs = crossGroups(m, idx), keys = Object.keys(xs), c = Object.values(xs).reduce((a, b) => a + b, 0);
  if (!c) return "";
  if (keys.length === 1) {
    const k = keys[0], n = xs[k];
    const who = k === "Independents" ? (n === 1 ? "an independent" : "independents") : k === "Greens" ? "the Greens" : k === "Katter" ? "Katter’s Australian" : k;
    return `The other ${n === 1 ? "seat" : words(n)} ${verb === "holds" ? (n === 1 ? "is held by" : "are held by") : "went to"} ${who}.`;
  }
  return `The crossbench ${verb === "holds" ? "holds" : "took"} ${c}: ${crossbenchWords(m, idx)}.`;
}
function areaHedDek(m, st) {
  const aus = st === "AUS", { A, idx, N, cnt } = areaStats(m, st);
  const where = aus ? "" : ` in ${STATE_NAME[st]}`;
  const ofSeats = aus ? `of the ${N} seats` : `of ${STATE_POSS[st]} ${N} seats`;
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const lead = A.tpp >= 50 ? "alp" : "lnp", leadPct = Math.max(A.tpp, 100 - A.tpp);

  const isNowM = m.year === "now";
  switch (S.lens) {
    case "winner": {
      const g = cnt[gov] || 0, o = cnt[opp] || 0, c = N - g - o;
      if (isNowM) {
        const hed = aus ? `Labor holds ${g} of the ${N} seats` : `Labor holds ${g} ${ofSeats}`;
        let dek = `The Coalition holds ${o}. ${crossSentence(m, idx, "holds")}`;
        if (aus) dek += ` One Nation has two seats it didn’t win at the election: Barnaby Joyce joined it in December 2025, and David Farley won Farrer at the May 2026 by-election.`;
        if (!aus) { const ch = (m.changes || []).filter((x) => m.divs[m.byName.get(x.div)].st === st); if (ch.length) dek += ` Since the election: ${[...new Set(ch.map((x) => x.div))].map((n) => esc(n)).join(" and ")} ${ch.length > 1 ? "have" : "has"} changed hands or party.`; }
        return { hed, dek };
      }
      const maj = Math.floor(N / 2) + 1;
      const pv = prevYearOf(m.year), changed = pv && GOV[pv] && GOV[pv] !== gov;
      let hed;
      if (aus) {
        if (g < maj) hed = `No party won a majority: ${o > g ? `the Coalition won ${o} seats, Labor ${g}` : `Labor won ${g} seats, the Coalition ${o}`}`;
        else if (changed) hed = `${gov === "alp" ? "Labor" : "The Coalition"} won government with ${g} of the ${N} seats`;
        else hed = `${gov === "alp" ? "Labor" : "The Coalition"} was returned with ${g} of the ${N} seats`;
      } else {
        const best = (cnt.alp || 0) >= (cnt.lnp || 0) ? "alp" : "lnp", bn = cnt[best] || 0;
        hed = `${best === "alp" ? "Labor" : "The Coalition"} won ${bn} ${ofSeats}`;
      }
      let dek = aus
        ? `${g < maj ? "" : `${opp === "alp" ? "Labor" : "The Coalition"} won ${o}. `}${crossSentence(m, idx, "won")}${c ? " " : ""}${m.year === 2010 ? "Labor kept government with the support of the Greens’ member and three independents. " : ""}${PM[m.year]} ${changed ? "became" : "remained"} prime minister.`
        : `${(cnt.alp || 0) >= (cnt.lnp || 0) ? "The Coalition" : "Labor"} won ${(cnt.alp || 0) >= (cnt.lnp || 0) ? cnt.lnp || 0 : cnt.alp || 0}. ${crossSentence(m, idx, "won")}${c ? " " : ""}Labor’s two-party vote${where} was ${f1(A.tpp)}%, ${swingPhrase(A.tppSw, prev)}.`;
      return { hed, dek };
    }
    case "tpp": {
      const withData = idx.filter((i) => m.divs[i].tpp != null);
      if (S.tppMode === "swing") {
        const s = A.tppSw;
        const to = s >= 0 ? "Labor" : "the Coalition";
        const hed = Math.abs(s) < 0.05 ? `There was no two-party swing${where}` : `The two-party vote${where} swung ${pts(s)} to ${to}`;
        const sw = withData.map((i) => ({ i, v: m.divs[i].tppSw })).filter((x) => x.v != null);
        const toward = sw.filter((x) => (s >= 0 ? x.v > 0 : x.v < 0)).length;
        const big = [...sw].sort((a, b) => (s >= 0 ? b.v - a.v : a.v - b.v))[0];
        const dek = sw.length ? `${toward === 0 ? "None" : cap(ofN(toward, sw.length))} ${toward === 0 ? `of the ${sw.length}` : ""} seats with a measured swing moved towards ${to}.`.replace("  ", " ") + ` The biggest swing that way was ${big ? `${esc(m.divs[big.i].n)}’s, ${pts(big.v)}` : "–"}.` : "";
        return { hed, dek: dek + (isNowM ? " These are the 2025 election’s swings." : "") };
      }
      const hed = `${lead === "alp" ? "Labor" : "The Coalition"} won ${f1(leadPct)}% of the two-party vote${where}`;
      const ahead = withData.filter((i) => m.divs[i].tpp > 50).length;
      const dek = `That’s ${swingPhrase(A.tppSw, prev)}. On the two-party count Labor led in ${ahead} of the ${withData.length === N ? N : `${withData.length} counted`} seats${where}, the Coalition in ${withData.length - ahead}.${isNowM && (aus || st === "NSW") ? " These are the 2025 election’s figures; Labor didn’t stand at the Farrer by-election, so Farrer has none." : ""}`;
      return { hed, dek };
    }
    case "fp": {
      const P = S.party, name = FAM_LEG[P];
      const stood = idx.filter((i) => m.divs[i].fp[P] > 0);
      if (S.fpMode === "change") {
        const d0 = A.fpSw[P];
        const hed = Math.abs(d0) < 0.05 ? `${Poss(P)} primary vote${where} was unchanged on ${prev}` : `${Poss(P)} primary vote${where} ${d0 >= 0 ? "rose" : "fell"} ${pts(d0)} on ${prev}`;
        const ch = idx.map((i) => ({ i, v: fpChange(m, m.divs[i], P) })).filter((x) => x.v != null);
        const up = ch.filter((x) => x.v > 0).length;
        const best = [...ch].sort((a, b) => b.v - a.v)[0];
        return { hed, dek: ch.length ? `It rose in ${ofN(up, ch.length)} seats with a comparable count${best ? `, most in ${esc(m.divs[best.i].n)} (${sgn(best.v)}${byNote(m.divs[best.i])})` : ""}.` : "" };
      }
      const hed = `${SUBJ[P]} won ${f1(A.fp[P])}% of first preferences${where}`;
      const ranked = stood.map((i) => ({ i, v: m.divs[i].fp[P] })).sort((a, b) => b.v - a.v);
      const dek = `${cap(upDown(A.fpSw[P]))} on ${prev}. ${P === "ind" ? "Independents" : P === "oth" ? "Other candidates" : name} stood in ${stood.length === N ? `all ${N}` : `${stood.length} of the ${N}`} seats${ranked.length ? `; the best result was ${esc(m.divs[ranked[0].i].n)}’s ${f1(ranked[0].v)}%${byNote(m.divs[ranked[0].i])}` : ""}.`;
      return { hed, dek };
    }
    case "flow": {
      const F = S.from, name = POSS[F];
      let toA = 0, tot = 0;
      const per = [];
      for (const i of idx) { const d = m.divs[i]; if (!d.classic) continue; let a = 0, t = 0; for (const f of d.flows) if (f.cand.b === F) { a += d.alpSide === 0 ? f.ta : f.tb; t += f.ta + f.tb; } if (t) { toA += a; tot += t; per.push({ i, v: (100 * a) / t, t }); } }
      if (!tot) return { hed: `None of ${name} preferences were split between Labor and the Coalition${where}`, dek: "" };
      const share = (100 * toA) / tot;
      const hed = `${f0(share)}% of ${name} preferences went to Labor${where}`;
      per.sort((a, b) => a.v - b.v);
      const lo = per[0], hi = per[per.length - 1];
      const dek = `Counted in the ${per.length} seats${where} that finished Labor against the Coalition. The share ran from ${f0(lo.v)}% in ${esc(m.divs[lo.i].n)} to ${f0(hi.v)}% in ${esc(m.divs[hi.i].n)}.`;
      return { hed, dek };
    }
    case "informal": {
      const hed = `${f1(A.infPct)}% of ballots${where} were informal`;
      const r = idx.map((i) => ({ i, v: m.divs[i].infPct })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      const pa = prev && Y[prev] && Y[prev].areas ? Y[prev].areas[st] : null;
      const dek = `${pa ? `${Math.abs(A.infPct - pa.infPct) < 0.05 ? "Unchanged" : A.infPct >= pa.infPct ? "Up" : "Down"} from ${f1(pa.infPct)}% in ${prev}. ` : ""}The highest rate was ${esc(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${esc(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
      return { hed, dek };
    }
    case "cls": {
      let best = null;
      const per = CLS.map((c) => { const xs = idx.filter((i) => m.divs[i].cls === c); const a = seatCount(m, xs, "alp"), l = seatCount(m, xs, "lnp"); return { c, n: xs.length, a, l }; });
      for (const p of per) { if (p.n < (aus ? 10 : 3)) continue; for (const [fam, k] of [["alp", p.a], ["lnp", p.l]]) { const sh = k / p.n; if (!best || sh > best.sh) best = { fam, k, n: p.n, c: p.c, sh }; } }
      const verb = isNowM ? "holds" : "won";
      const hed = best ? `${best.fam === "alp" ? "Labor" : "The Coalition"} ${verb} ${best.k === best.n ? `all ${best.n}` : `${best.k} of the ${best.n}`} ${CLS_LOWER[best.c]} seats${where}` : `Seats${where} by the AEC’s type`;
      const dek = per.filter((p) => p.n).map((p) => `${CLS_SHORT[p.c]}: Labor ${p.a}, Coalition ${p.l}${p.n - p.a - p.l ? `, others ${p.n - p.a - p.l}` : ""}`).join(". ") + ".";
      return { hed, dek };
    }
    case "seifa": {
      if (isDemo()) return areaDemo(m, st, idx, where, isNowM);
      const ix = S.index, scored = idx.filter((i) => m.divs[i].seifa[ix] && m.divs[i].seifa[ix].pct != null).sort((a, b) => m.divs[a].seifa[ix].pct - m.divs[b].seifa[ix].pct);
      if (scored.length < 10) return { hed: `${IX_NAME[ix]}${where}`, dek: "" };
      const q = Math.round(scored.length / 5), low = scored.slice(0, q), high = scored.slice(-q);
      const fams = ["alp", "lnp", "ind", "grn", "onp", "oth"];
      const topOf = (xs) => fams.map((f) => [f, seatCount(m, xs, f)]).sort((a, b) => b[1] - a[1]);
      const lt = topOf(low), ht = topOf(high);
      const verb = isNowM ? "holds" : "won";
      const adv = ix === "irsd" ? ["most disadvantaged", "least disadvantaged"] : ix === "ier" ? ["poorest in economic resources", "richest in economic resources"] : ix === "ieo" ? ["lowest on education and occupation", "highest on education and occupation"] : ["least advantaged", "most advantaged"];
      const lead0 = lt[0][0], lv = verb === "holds" ? (lead0 === "ind" || lead0 === "grn" ? "hold" : "holds") : "won";
      const hed = `${cap(FAM_PL[lead0])} ${lv} ${lt[0][1]} of the ${q} ${adv[0]} seats${where}`;
      const hs = ht.filter((x) => x[1]);
      const first = hs[0], rest = hs.slice(1).map(([f, n]) => `${FAM_PL[f]} ${n}`);
      const v1 = verb === "holds" ? (first[0] === "ind" || first[0] === "grn" ? "hold" : "holds") : "won";
      const dek = `Of the ${q} ${adv[1]}, ${FAM_PL[first[0]]} ${v1} ${first[1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Seats are ranked on the ABS’s ${IX_NAME[ix].toLowerCase()} index (${IX_ABBR[ix]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : "interpolated between censuses to election day"}.`;
      return { hed, dek };
    }
  }
  return { hed: "", dek: "" };
}

// the census people measures, area level: who holds the fifth of seats at each end
const DM_TOP = { lang: ["seats with the most residents speaking another language at home", "most English-speaking"], a65: ["seats with the most residents aged 65 and over", "with the fewest"], a2034: ["seats with the most residents aged 20 to 34", "with the fewest"] };
const DEMO_EARLY = { hed: "Census figures start at the 2016 election", dek: "They are counted where each polling place’s voters live, which the AEC has recorded only since 2016. Choose 2016 or later on the timeline." };
function areaDemo(m, st, idx, where, isNowM) {
  const k = S.index, A = m.areas[st];
  if (!A.demo) return DEMO_EARLY;
  const scored = idx.filter((i) => m.divs[i].demo).sort((a, b) => m.divs[b].demo[k] - m.divs[a].demo[k]);
  const share = `${f1(A.demo[k])}% of residents${where} ${DM_VERB[k]}`;
  const note = "From the 2021 census, counted where each seat’s voters live.";
  if (scored.length < 10) return { hed: cap(share), dek: note };
  const q = Math.round(scored.length / 5), high = scored.slice(0, q), low = scored.slice(-q);
  const fams = ["alp", "lnp", "ind", "grn", "onp", "oth"];
  const topOf = (xs) => fams.map((f) => [f, seatCount(m, xs, f)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const verbOf = (f) => (isNowM ? (f === "ind" || f === "grn" ? "hold" : "holds") : "won");
  const ht = topOf(high), lt = topOf(low);
  const hed = `${cap(FAM_PL[ht[0][0]])} ${verbOf(ht[0][0])} ${ht[0][1]} of the ${q} ${DM_TOP[k][0]}${where}`;
  const rest = lt.slice(1).map(([f, n]) => `${FAM_PL[f]} ${n}`);
  const dek = `Of the ${q} ${DM_TOP[k][1]}, ${FAM_PL[lt[0][0]]} ${verbOf(lt[0][0])} ${lt[0][1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Overall, ${share}. ${note}`;
  return { hed, dek };
}

function storyArea(m, st) {
  const aus = st === "AUS", { A, idx, N, cnt } = areaStats(m, st);
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year);
  const { hed, dek } = areaHedDek(m, st);
  const title = aus ? (m.year === "now" ? "The House today" : `${m.year} election`) : STATE_TITLE[st];
  const meta = aus ? (m.year === "now" ? `Members as at ${longDate(m.asOf)}` : `${longDate(m.date)} · ${N} seats`) : (m.year === "now" ? `${N} seats · members today` : `${N} seats · ${m.year} election`);
  let h = head(title, meta, hed, dek);
  if (lensNumeric() && !(S.lens === "seifa" && isDemo() && !A.demo)) h += `<div class="st-sec"><h3>Across the seats <small>${esc(lensShort())}${aus ? "" : ", " + STATE_SHORT[st]}</small></h3>${distBlock(m, "seats", idx.map((i) => m.divs[i]), { compact: true })}</div>`;
  // the House: who holds the seats
  if (S.view !== "chamber") {
    const order = ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f]);
    const counts = order.map((f) => `<span><i style="${swc(f)}"></i>${FAM_LEG[f]} <b>${cnt[f]}</b></span>`).join("");
    h += `<div class="st-sec"><h3>${m.year === "now" ? "The chamber today" : "The new chamber"} <small>${aus ? "every member in their seat" : `${STATE_POSS[st]} members lit`}</small></h3><div class="st-chamber"><canvas id="minich" aria-label="The House of Representatives, each member a chair"></canvas></div><div class="counts">${counts}</div></div>`;
  }
  if (m.year === "now" && aus) {
    const ch = m.changes.slice().reverse();
    h += `<div class="st-sec"><h3>Since the election <small>${ch.length} changes</small></h3><div class="changes">${ch.map((c) => `<button type="button" data-go="divname:${esc(c.div)}"><span class="dt">${shortDate(c.date).replace(/ 20(\d\d)$/, " ’$1")}</span><span class="tx"><b>${esc(c.div)}.</b> ${esc(c.text)}.</span></button>`).join("")}</div></div>`;
    h += `<p class="st-note" style="margin-top:22px">The figures below are the 2025 election’s.</p>`;
  }
  // the two-party read
  h += `<div class="st-sec"><h3>Two-party preferred <small>Labor v Coalition${aus ? "" : ", " + STATE_SHORT[st]}</small></h3><div class="hero">${heroPair("Labor", A.tpp, "alp", "Coalition", 100 - A.tpp, "lnp")}${marginBar("Labor", "alp", "Coalition", "lnp", A.tpp - (100 - A.tpp), 20)}<p class="hero-verdict"><b>${A.tpp >= 50 ? "Labor" : "The Coalition"} ahead</b> by ${pts(Math.abs(2 * A.tpp - 100))}; ${swingPhrase(A.tppSw, prev)}.</p></div></div>`;
  h += `<div class="st-sec"><h3>Primary vote <small>% of formal votes · change on ${prev}</small></h3>${famRows(A.fp, A.fpSw)}</div>`;
  h += `<div class="st-sec"><h3>Informal <small>% of ballots cast</small></h3><div class="big"><span class="v">${f1(A.infPct)}%</span><span class="l">${aus ? "" : `Australia ${f1(m.areas.AUS.infPct)}%`}</span></div></div>`;
  if (aus) {
    h += `<div class="st-sec"><h3>By state</h3><table class="tbl"><thead><tr><th>State</th><th>Seats</th><th>Labor 2PP</th><th>Swing</th></tr></thead><tbody>${STATES.map((s) => { const a = m.areas[s]; const sc = {}; for (const i of a.idx) { const f = holdFam(m.divs[i].hold); sc[f] = (sc[f] || 0) + 1; } const bar = ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"].filter((f) => sc[f]).map((f) => `<i style="width:${(100 * sc[f]) / a.idx.length}%;${swc(f)}"></i>`).join(""); return `<tr data-go="state:${s}"><td>${STATE_TITLE[s].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${a.idx.length}<span class="seatbar">${bar}</span></td><td>${f1(a.tpp)}</td><td>${sgn(a.tppSw)}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  const close = idx.map((i) => m.divs[i]).filter((d) => !d.by).sort((a, b) => a.margin - b.margin).slice(0, 6).map((d) => ({ i: d.i, v: d.margin }));
  h += `<div class="st-sec"><h3>Closest seats <small>winning margin, points</small></h3>${linkRows(m, close, (v, d) => f1(v), (i) => colCss(m.divCol[i]))}</div>`;
  h += foot(m);
  return h;
}

/* ----- a seat ----- */
// the election a seat's swings are measured against: "Now" shows the 2025
// count (against 2022) everywhere but Farrer, whose by-election is set against 2025
const prevFor = (m, d) => (m.year === "now" ? (d && d.by ? 2025 : 2022) : prevYearOf(m.year));
function seatHedDek(m, d) {
  const prev = prevFor(m, d);
  const [wn, rn] = pairNames(d.win, d.run);
  const wParty = theParty(d.win.ab, d.win.pn), rParty = partyName(d.run.ab, d.run.pn);
  const close = d.votesMargin < 1500 && d.margin < 1;
  switch (S.lens) {
    case "winner": {
      if (d.by) {
        const hed = `One Nation’s David Farley won Farrer at the May 2026 by-election`;
        const dek = `He beat the independent Michelle Milthorpe ${f1(d.winPct)}–${f1(100 - d.winPct)} after preferences. Sussan Ley had held the seat for the Liberals since 2001; their candidate, Raissa Butkowski, ran third on ${f1(d.fp.lnp ? (100 * d.c.find((c) => c.ab === "LP").v) / d.formal : 0)}% of first preferences. Labor didn’t stand.`;
        return { hed, dek };
      }
      const hold = d.hold, switched = m.year === "now" && (hold.n !== d.win.n || hold.ab !== d.win.ab);
      if (switched) {
        const ch = m.changes.filter((c) => c.div === d.n).pop();
        const hed = hold.ab === "CSA" ? `${esc(hold.n)} now sits for Community Strong` : `${esc(hold.n)} now sits for ${esc(leaderName(hold))}`;
        const dek = hold.ab === "CSA"
          ? `She won ${esc(d.n)} as an independent in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${esc(rn)} (${esc(rParty)}), and co-founded Community Strong Australia on ${longDate(ch.date)}.`
          : `He won ${esc(d.n)} for the Nationals in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${esc(rn)} (${esc(rParty)}). He left the Nationals on 27 November 2025 and joined One Nation on ${longDate(ch.date)}.`;
        return { hed, dek };
      }
      let hed;
      const ch = d.change;
      if (ch.kind === "re") hed = close ? `${esc(d.win.n)} held ${esc(d.n)} by ${int(d.votesMargin)} votes` : `${esc(d.win.n)} held ${esc(d.n)}`;
      else if (ch.kind === "held") hed = `${esc(d.win.n)} kept ${esc(d.n)} for ${esc(wParty)}`;
      else if (ch.kind === "gain") hed = ch.prev && FAM(ch.prev[2]) === d.win.fam ? `${esc(d.win.n)} won ${esc(d.n)} from ${esc(ch.prev[3])}` : `${esc(d.win.n)} won ${esc(d.n)} from ${esc(theParty(ch.prev[2]))}`;
      else if (ch.kind === "new") hed = `${esc(d.win.n)} won the new seat of ${esc(d.n)}`;
      else hed = `${esc(d.win.n)} won ${esc(d.n)}`;
      if (close && ch.kind !== "re") hed += ` by ${int(d.votesMargin)} votes`;
      const fpLead = [...d.c].sort((a, b) => b.v - a.v)[0];
      let dek = `${esc(wn)} won the final count ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${esc(rn)} (${esc(rParty)})`;
      if (d.classic && d.tppSw != null) dek += `, ${swingPhrase(d.tppSw, prev)}`;
      dek += ".";
      if (fpLead !== d.win) dek += ` ${esc(surname(fpLead.n))} led on first preferences, ${f1((100 * fpLead.v) / d.formal)}% to ${f1((100 * d.win.v) / d.formal)}%.`;
      dek += ` By the AEC’s measure that makes ${esc(d.n)} ${statusOf(d.winPct)}.`;
      if (ch.kind === "re" && ch.since < (m.year === "now" ? 2025 : m.year)) dek += ` ${esc(surname(d.win.n))} has held it since ${ch.since}.`;
      return { hed, dek };
    }
    case "tpp": {
      if (d.tpp == null) return { hed: `There was no Labor v Coalition count in ${esc(d.n)}`, dek: d.by ? "Labor didn’t stand at the by-election, so the AEC counted the final two only: One Nation against the independent." : "" };
      if (S.tppMode === "swing") {
        const s = d.tppSw;
        const hed = s == null ? `${esc(d.n)} has no recorded swing` : Math.abs(s) < 0.05 ? `There was no two-party swing in ${esc(d.n)}` : `${esc(d.n)} swung ${pts(s)} to ${s > 0 ? "Labor" : "the Coalition"}`;
        const aus = m.areas.AUS.tppSw;
        return { hed, dek: s == null ? "" : `Across Australia the swing was ${pts(aus)} to ${aus > 0 ? "Labor" : "the Coalition"}. The AEC measures a seat’s swing against its result last time, adjusted where its boundaries were redrawn.` };
      }
      const lead = d.tpp >= 50;
      const hed = `${lead ? "Labor" : "The Coalition"} won ${f1(lead ? d.tpp : 100 - d.tpp)}% of the two-party vote in ${esc(d.n)}`;
      const dek = d.classic ? `The final count was Labor against the Coalition, ${swingPhrase(d.tppSw, prev)}.` : `The final two here were ${esc(rn)} and ${esc(wn)}, so this is the AEC’s notional count of Labor against the Coalition, ${swingPhrase(d.tppSw, prev)}.`;
      return { hed, dek };
    }
    case "fp": {
      const P = S.party, name = FAM_LEG[P], v = d.fp[P];
      if (S.fpMode === "change") {
        const c = fpChange(m, d, P);
        if (c == null) return { hed: `${SUBJ[P]} didn’t stand in ${esc(d.n)} both times`, dek: "" };
        return { hed: Math.abs(c) < 0.05 ? `${Poss(P)} primary vote in ${esc(d.n)} was unchanged` : `${Poss(P)} primary vote ${c >= 0 ? "rose" : "fell"} ${pts(c)} in ${esc(d.n)}`, dek: `${SUBJ[P]} won ${f1(v)}% of first preferences${d.by ? " at the by-election, against the seat’s 2025 count" : ""}.` };
      }
      if (!v) return { hed: `${name === "Independents" ? "No independent" : name} didn’t stand in ${esc(d.n)}`.replace("No independent didn’t", "No independent stood"), dek: "" };
      const aus = m.areas.AUS.fp[P];
      return { hed: `${name} won ${f1(v)}% of first preferences in ${esc(d.n)}`, dek: `Across Australia ${name === "Independents" ? "independents" : name} won ${f1(aus)}%.` };
    }
    case "flow": {
      const F = S.from, nm = POSS[F];
      if (!d.classic) return { hed: `${esc(d.n)}’s count didn’t end Labor against the Coalition`, dek: `Its final two were ${esc(d.win.n)} and ${esc(d.run.n)}, so its preferences weren’t split between Labor and the Coalition.` };
      const v = d.flowAlp[F];
      if (v == null) {
        const stood = d.c.some((c) => c.b === F);
        const who = F === "ind" ? "No independent" : F === "oth" ? "No other candidate" : FAM_LEG[F];
        return { hed: stood ? `${cap(nm)} preferences weren’t distributed in ${esc(d.n)}` : F === "ind" || F === "oth" ? `${who} stood in ${esc(d.n)}` : `${who} didn’t stand in ${esc(d.n)}`, dek: stood ? "Its candidate finished in the final two, so its votes were never passed on." : "" };
      }
      return { hed: `${f0(v)}% of ${nm} preferences in ${esc(d.n)} went to Labor`, dek: `The rest, ${f0(100 - v)}%, went to the Coalition.` };
    }
    case "informal": {
      const r = [...m.divs].filter((x) => x.infPct != null).sort((a, b) => b.infPct - a.infPct).findIndex((x) => x.i === d.i) + 1;
      return { hed: `${f1(d.infPct)}% of ${esc(d.n)}’s ballots were informal`, dek: `That’s ${rankWords(r, m.divs.length)} rate of the ${m.divs.length} seats${byNote(d)}; across Australia it was ${f1(m.areas.AUS.infPct)}%.` };
    }
    case "cls": return { hed: d.cls ? `${esc(d.n)} is ${/^[aeiou]/i.test(CLS_LOWER[d.cls]) ? "an" : "a"} ${CLS_LOWER[d.cls]} seat` : `${esc(d.n)} has no AEC type on record`, dek: d.cls ? `${CLS_DEF[d.cls]}, in the AEC’s words.` : "" };
    case "seifa": {
      if (isDemo()) {
        const k = S.index;
        if (!d.demo) return m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY : { hed: `${esc(d.n)} has no census figure`, dek: "" };
        const xs = m.divs.filter((x) => x.demo).sort((a, b) => b.demo[k] - a.demo[k]), r = xs.findIndex((x) => x.i === d.i) + 1;
        const aus = m.areas.AUS.demo;
        return { hed: `${f0(100 * d.demo[k])}% of ${esc(d.n)}’s residents ${DM_VERB[k]}`, dek: `That’s ${rankWords(r, xs.length)} share of the ${xs.length} seats; across Australia, ${f1(aus[k])}%. From the 2021 census, counted where the seat’s voters live.` };
      }
      const c = d.seifa[S.index];
      if (!c || !c.dec) return { hed: `${esc(d.n)} has no ${IX_ABBR[S.index]} score`, dek: "" };
      const where = c.dec === 10 ? "among the most advantaged tenth of seats" : c.dec === 1 ? "among the least advantaged tenth of seats" : c.dec <= 5 ? `in the ${ordw(c.dec)} tenth of seats, counted from the least advantaged` : `in the ${ordw(11 - c.dec)} tenth of seats, counted from the most advantaged`;
      return { hed: `${esc(d.n)} is ${where}`, dek: `On the ABS’s ${IX_NAME[S.index].toLowerCase()} index (${IX_ABBR[S.index]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : "interpolated between censuses to election day"}.` };
    }
  }
  return { hed: "", dek: "" };
}

function storyDiv(m, i) {
  const d = m.divs[i];
  const prev = prevFor(m, d);
  const { hed, dek } = seatHedDek(m, d);
  const meta = `${d.cls ? esc(CLS_SHORT[d.cls]) + " · " : ""}${esc(STATE_TITLE[d.st])}${d.by ? " · by-election, 9 May 2026" : ""}`;
  let h = head(d.n, meta, hed, dek);
  const [wn, rn] = pairNames(d.win, d.run);
  h += `<div class="st-sec"><h3>Final count <small>${d.by ? "the by-election’s" : "two candidates"}</small></h3><div class="hero">${heroPair(wn, d.winPct, d.win.fam, rn, 100 - d.winPct, d.run.fam)}${marginBar(wn, d.win.fam, rn, d.run.fam, 2 * d.winPct - 100)}<p class="hero-verdict"><b>${esc(wn)}</b> by ${int(d.votesMargin)} votes · ${statusOf(d.winPct)}</p></div></div>`;
  if (d.tpp != null && !d.classic) h += `<div class="st-sec"><h3>Two-party preferred <small>the AEC’s notional count</small></h3><div class="hero">${heroPair("Labor", d.tpp, "alp", "Coalition", 100 - d.tpp, "lnp")}</div><p class="st-note">${swingPhrase(d.tppSw, prev).replace(/^./, (c) => c.toUpperCase())}.</p></div>`;
  const prevDiv = d.by ? d.by.prev : null;
  const moved = movedTo(m, d);
  const winPartyOf = moved ? (c) => (c === d.win ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  h += `<div class="st-sec"><h3>First preferences <small>% · change${d.by ? " on 2025" : ""}</small></h3>${candRows(d.c, d.formal, null, 7, d.by ? (c) => byChange(c, d, prevDiv) : null, winPartyOf)}</div>`;
  const fl = flowRows(d.flows, d.A, d.B);
  if (fl) h += `<div class="st-sec"><h3>Where preferences went <small>to the final two</small></h3>${fl}</div>`;
  if (d.vt) {
    const vt = d.vt, tot = vt.ord + vt.pre + vt.post + vt.abs + vt.prov;
    const parts = [["On the day", vt.ord - vt.ppvc, "var(--ink-2)"], ["Early, in person", vt.ppvc + vt.pre, "var(--ink-faint)"], ["Postal", vt.post, "var(--accent)"], ["Absent and other", vt.abs + vt.prov, "var(--line)"]];
    h += `<div class="st-sec"><h3>How votes were cast <small>${int(tot)} formal</small></h3><div class="stack">${parts.map(([l, v, c]) => `<i style="width:${(100 * v) / tot}%;background:${c}" title="${l}"></i>`).join("")}</div><div class="stackl">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l}<b>${f0((100 * v) / tot)}%</b></span>`).join("")}</div></div>`;
  }
  h += `<div class="st-sec"><h3>Informal</h3><div class="big"><span class="v">${f1(d.infPct)}%</span><span class="l">of ballots · Australia ${f1(m.areas.AUS.infPct)}%</span></div>${d.by ? `<p class="st-note">Turnout was ${f1((100 * d.by.turnout) / d.by.enrolment)}% of ${int(d.by.enrolment)} enrolled.</p>` : ""}</div>`;
  h += `<div class="st-sec"><h3>The seat <small>AEC type · ABS SEIFA, deciles among seats</small></h3>${d.cls ? `<dl class="facts"><dt>Type</dt><dd>${esc(CLS_SHORT[d.cls])}: ${esc(CLS_DEF[d.cls])}</dd>${d.demo ? `<dt>Language</dt><dd>${f0(100 * d.demo.lang)}% of residents speak a language other than English at home</dd><dt>Age</dt><dd>${f0(100 * d.demo.a65)}% are 65 or older, ${f0(100 * d.demo.a2034)}% are 20 to 34</dd>` : ""}</dl>` : ""}${decileRows((ix) => d.seifa[ix] && d.seifa[ix].dec)}<p class="st-note">1 is the most disadvantaged tenth of the ${m.divs.length} seats, 10 the most advantaged.</p></div>`;
  h += historyChart(d);
  // polling places
  const b = m.booth, js = b.byDiv[i];
  const nPP = js.filter((j) => b.ty[j] === 1).length, nEV = js.filter((j) => b.ty[j] === 5).length, nMob = js.length - nPP - nEV;
  let bl = "";
  if (lensNumeric()) {
    const vals = js.map((j) => ({ j, v: boothValue(m, j) })).filter((x) => x.v != null && b.votes[x.j] >= 100).sort((p, q) => q.v - p.v);
    const fmt = (v) => (S.lens === "seifa" ? `${v}` : (S.lens === "tpp" && S.tppMode === "swing") || (S.lens === "fp" && S.fpMode === "change") ? sgn(v) : f1(v));
    const li = (arr) => `<div class="links">${arr.map(({ j, v }) => `<button type="button" data-go="booth:${j}"><i style="background:${colCss(m.boothCol[j])}"></i><span class="nm">${esc(b.name[j])}<small>${int(b.votes[j])} votes</small></span><b>${fmt(v)}</b></button>`).join("")}</div>`;
    if (vals.length >= 6) bl = `<p class="st-note">Highest</p>${li(vals.slice(0, 3))}<p class="st-note">Lowest</p>${li(vals.slice(-3).reverse())}${distBlock(m, "booths", js, { compact: true })}`;
  } else if (S.lens === "winner") {
    const led = {}; for (const j of js) if (b.lead[j]) led[b.lead[j].n] = (led[b.lead[j].n] || 0) + 1;
    bl = `<div class="counts">${[d.A, d.B].map((c) => `<span><i style="${swc(c.fam)}"></i>${esc(surname(c.n))} led <b>${led[c.n] || 0}</b></span>`).join("")}</div>`;
  }
  h += `<div class="st-sec"><h3>Polling places <small>${nPP} on the day · ${nEV} early${nMob ? ` · ${nMob} mobile` : ""}</small></h3>${bl}<div class="act"><button type="button" data-listbooths>All ${js.length} in the list</button>${S.view !== "map" ? `<button type="button" data-showmap>Show on the map</button>` : ""}</div></div>`;
  h += foot(m);
  return h;
}

// a by-election candidate against the 2025 count: the same person if they stood
// then, otherwise the same party where each count has exactly one of it
function byChange(c, d, prevDiv) {
  const pct = (100 * c.v) / d.formal;
  const same = prevDiv.c.find((x) => x.n === c.n);
  if (same) return pct - (100 * same.v) / prevDiv.formal;
  if (c.ab === "IND") return null;
  const now = d.c.filter((x) => x.ab === c.ab), then = prevDiv.c.filter((x) => x.ab === c.ab);
  if (now.length !== 1) return null;
  if (!then.length) return pct;
  return then.length === 1 ? pct - (100 * then[0].v) / prevDiv.formal : null;
}

/* ----- a polling place ----- */
function storyBooth(m, j) {
  const b = m.booth, D = m.divs[b.d[j]], raw = b.raw;
  const where = [b.prem[j], [b.sub[j], b.pc[j]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tc = raw.tcp[j];
  let hed = esc(b.name[j]), dek = "";
  const lead = b.lead[j];
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb, lp = (100 * Math.max(ta, tb)) / tot;
    const left = ta >= tb ? D.A : D.B, right = ta >= tb ? D.B : D.A;
    const [ln, rn] = pairNames(left, right);
    switch (S.lens) {
      case "tpp":
        if (!Number.isNaN(b.tpp[j])) {
          if (S.tppMode === "swing") { const s = nn(b.tppSw[j]); hed = s == null ? `This place has no swing on record` : `${pts(s)} swing to ${s >= 0 ? "Labor" : "the Coalition"} here`; dek = s == null ? "It wasn’t used at the previous election." : ""; }
          else { const t2 = b.tpp[j]; hed = `${t2 >= 50 ? "Labor" : "The Coalition"} won ${f1(Math.max(t2, 100 - t2))}% of the two-party vote here`; }
          break;
        }
      // falls through when there's no two-party count
      default:
        hed = `${esc(ln)} won this place ${f0(lp)}–${f0(100 - lp)}`;
        dek = `${int(b.votes[j])} votes were cast here, ${f1(b.infPct[j])}% informal. Across ${esc(D.n)}, ${esc(surname(D.win.n))} won ${f1(D.winPct)}–${f1(100 - D.winPct)}.`;
        void rn;
    }
    if (S.lens === "fp") { const v = b.fp[S.party][j]; hed = `${FAM_LEG[S.party]} won ${f1(v)}% of first preferences here`; dek = `In ${esc(D.n)} as a whole, ${f1(D.fp[S.party])}%.`; }
    if (S.lens === "informal") { hed = `${f1(b.infPct[j])}% of ballots here were informal`; dek = `In ${esc(D.n)} as a whole, ${f1(D.infPct)}%.`; }
    if (S.lens === "flow") { const v = nn(b.flowAlp[S.from][j]); hed = v == null ? `No ${S.from === "ind" ? "independent’s" : FAM_LEG[S.from] + "’"} preferences were split here between Labor and the Coalition` : `${f0(v)}% of ${S.from === "ind" ? "independents’" : S.from === "oth" ? "other candidates’" : FAM_LEG[S.from] + "’"} preferences here went to Labor`; }
    if (S.lens === "seifa" && isDemo()) { const k = S.index, r = raw.demo && raw.demo[j], v = r ? 100 * r[DM.indexOf(k)] : null; hed = v == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure") : `${f0(v)}% of residents where this place’s voters live ${DM_VERB[k]}`; dek = v == null ? "" : `In ${esc(D.n)} as a whole, ${D.demo ? f1(100 * D.demo[k]) : "–"}%. From the 2021 census.`; }
    else if (S.lens === "seifa") { const arr = S.basis === "voters" ? raw.vdec[j] : raw.dec[j]; const v = arr ? arr[IX.indexOf(S.index)] : null; hed = v ? `This place is in decile ${v} of 10 on ${IX_ABBR[S.index]}` : `This place has no ${IX_ABBR[S.index]} score`; dek = S.basis === "voters" ? "Scored on where its voters live." : "Scored on the census area it stands in."; }
    if (S.lens === "cls") { hed = `${esc(D.n)} is ${/^[aeiou]/i.test(CLS_LOWER[D.cls] || "") ? "an" : "a"} ${CLS_LOWER[D.cls] || ""} seat`; }
  }
  let h = head(b.name[j], `${esc(TYPE[b.ty[j]] || "Polling place")}${where ? " · " + esc(where) : ""}`, hed, dek);
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb;
    const [an, bn] = pairNames(D.A, D.B);
    h += `<div class="st-sec"><h3>Final count here <small>two candidates</small></h3><div class="hero">${heroPair(an, (100 * ta) / tot, D.A.fam, bn, (100 * tb) / tot, D.B.fam)}${marginBar(an, D.A.fam, bn, D.B.fam, (200 * ta) / tot - 100)}</div></div>`;
  }
  if (!Number.isNaN(b.tpp[j]) && !D.classic) h += `<div class="st-sec"><h3>Two-party preferred <small>notional</small></h3><div class="hero">${heroPair("Labor", b.tpp[j], "alp", "Coalition", 100 - b.tpp[j], "lnp")}</div></div>`;
  if (!Number.isNaN(b.tpp[j])) { const s0 = nn(b.tppSw[j]); h += `<p class="st-note">${s0 == null ? "This place wasn’t used at the previous election, so it has no swing." : Math.abs(s0) < 0.05 ? "No two-party swing here." : `A two-party swing of ${pts(s0)} to ${s0 > 0 ? "Labor" : "the Coalition"} here.`}</p>`; }
  const cands = D.c.map((c, k) => ({ ...c, v: raw.v[j][k], el: false }));
  const pf = raw.prevFp ? raw.prevFp[j] : null;
  const moved = movedTo(m, D);
  const wk = D.c.indexOf(D.win);
  const winPartyOf = moved ? (c) => (c.k === wk ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  if (b.formal[j]) h += `<div class="st-sec"><h3>First preferences here <small>% · tick = the whole seat${pf ? " · change on 2025 here" : ""}</small></h3>${candRows(cands, b.formal[j], (c) => (100 * D.c[c.k].v) / D.formal, 0, pf ? (c) => { const same = D.c.filter((x) => x.b === c.b).length === 1; return same ? (100 * c.v) / b.formal[j] - pf[c.b] : null; } : () => null, winPartyOf)}</div>`;
  const fl = raw.fl[j];
  if (fl && fl.length) { const fb = flowRows(fl.map(([ci, ta, tb]) => ({ cand: D.c[ci], ta, tb })), D.A, D.B); if (fb) h += `<div class="st-sec"><h3>Where preferences went here</h3>${fb}</div>`; }
  const dec = raw.dec[j], vdec = raw.vdec[j];
  h += `<div class="st-sec"><h3>The neighbourhood <small>ABS SEIFA, national deciles</small></h3>${dec || vdec ? decileRows((ix) => (dec ? dec[IX.indexOf(ix)] : null), (ix) => (vdec && vdec[IX.indexOf(ix)] ? ` · its voters ${vdec[IX.indexOf(ix)]}` : "")) : '<p class="st-note">No SEIFA score: this place has no fixed address, or its census area is too small to publish.</p>'}<p class="st-note">The bars score the census area the place stands in. From 2016, where the AEC records it, “its voters” scores the areas its voters live in.</p>${raw.demo && raw.demo[j] ? `<dl class="facts"><dt>Language</dt><dd>${f0(100 * raw.demo[j][0])}% of residents where its voters live speak a language other than English at home</dd><dt>Age</dt><dd>${f0(100 * raw.demo[j][1])}% are 65 or older, ${f0(100 * raw.demo[j][2])}% are 20 to 34</dd></dl>` : ""}</div>`;
  h += `<div class="act"><button type="button" data-go="div:${D.i}">Back to ${esc(D.n)}</button><button type="button" data-listbooths>All places in ${esc(D.n)}</button></div>`;
  h += foot(m);
  return h;
}

function foot(m) {
  const src = m.year === "now" ? "AEC results for the 2025 election (event 31496) and the 2026 Farrer by-election (event 31633); members’ changes of party from the parties and the APH" : `AEC results for the ${m.year} election (event ${m.res.event})`;
  return `<p class="st-foot">${src}. AEC boundaries and seat types; ABS SEIFA.</p>`;
}
let storyKey = "";
function renderStory(force) {
  const m = M(); if (!m) return;
  const s = S.sel;
  const key = [S.year, S.lens, S.tppMode, S.fpMode, S.party, S.from, S.index, S.basis, S.view, s.level, s.st, s.div, s.booth, filtersKey()].join("|");
  if (!force && key === storyKey) return;
  storyKey = key;
  const el = $("#story");
  el.innerHTML = s.level === "aus" ? storyArea(m, "AUS") : s.level === "state" ? storyArea(m, s.st) : s.level === "div" ? storyDiv(m, s.div) : storyBooth(m, s.booth);
  requestAnimationFrame(() => { paintMiniChamber(); hydrateDists(); });
}

/* =============================== filters =============================== */
const MARGINS = { marginal: [0, 6, "Marginal, under 6 points"], fair: [6, 10, "Fairly safe, 6 to 10"], safe: [10, 100, "Safe, over 10"] };
const filtersOn = () => !!(S.f.st || S.f.cls || S.f.win || S.f.margin || (S.f.range && S.f.range.unit === "seats"));
const filtersKey = () => [S.f.st, S.f.cls, S.f.win, S.f.margin, S.f.range && [S.f.range.unit, S.f.range.key, S.f.range.lo, S.f.range.hi].join(":")].join(",");
const inRange = (v, r) => v != null && !Number.isNaN(v) && v >= r.lo - 1e-9 && (r.hiOpen ? true : v < r.hi - 1e-9 || (r.last && v <= r.hi + 1e-9)) && (r.loOpen ? true : true);
function passes(m, i, skipRange) {
  const d = m.divs[i];
  if (S.f.st && d.st !== S.f.st) return false;
  if (S.f.cls && d.cls !== S.f.cls) return false;
  if (S.f.win && holdFam(d.hold) !== S.f.win) return false;
  if (S.f.margin) { const [a, b] = MARGINS[S.f.margin]; if (d.margin < a || d.margin >= b) return false; }
  if (!skipRange && S.f.range && S.f.range.unit === "seats" && !inRange(seatColValue(m, d, S.f.range.key), S.f.range)) return false;
  return true;
}
function filterWords(m) {
  const w = [];
  if (S.f.margin) w.push(MARGINS[S.f.margin][2].split(",")[0].toLowerCase());
  if (S.f.cls) w.push(CLS_SHORT[S.f.cls].toLowerCase());
  if (S.f.win) w.push(`held by ${FAM_PL[S.f.win]}`);
  if (S.f.st) w.push(STATE_SHORT[S.f.st]);
  if (S.f.range) { const c = colByKey(m, S.f.range.unit, S.f.range.key); if (c) w.push(`${c.short || c.label} ${rangeText(S.f.range, c)}`); }
  return w;
}
function rangeText(r, c) { const f = c.fmt || f1; return r.loOpen ? `under ${f(r.hi)}` : r.hiOpen ? `${f(r.lo)} or more` : `${f(r.lo)} to ${f(r.hi)}`; }

/* =============================== columns ===============================
   One definition per measure serves the table, its sort, the column-head
   sparkline, the distribution chart and the range filter. */
function seatColValue(m, d, key) { const c = colByKey(m, "seats", key); return c ? c.get(d) : null; }
function boothColValue(m, j, key) { const c = colByKey(m, "booths", key); return c ? c.get(j) : null; }
const lensKey = () => (S.lens === "tpp" ? (S.tppMode === "swing" ? "swing" : "tpp") : S.lens === "informal" ? "inf" : S.lens === "winner" ? "win" : S.lens === "cls" ? "cls" : "lens");
function lensColumn(get, colOf) {
  const lab = lensShort();
  const dec = S.lens === "seifa" && !isDemo();
  const scale = S.lens === "fp" ? (S.fpMode === "change" ? null : FPMAX[S.party]) : S.lens === "flow" ? 100 : S.lens === "seifa" ? (dec ? 10 : DM_RANGE[S.index][1]) : null;
  return { key: "lens", label: lensHead(), short: lab, get, num: S.lens !== "cls", txt: S.lens === "cls", w: "minmax(120px,1fr)", lens: true, dist: S.lens !== "cls",
    fmt: dec ? (v) => String(Math.round(v)) : (S.lens === "fp" && S.fpMode === "change") ? (v) => sgn(v) : f1,
    color: (v) => colorOf(v), decile: dec, diverge: S.lens === "fp" && S.fpMode === "change",
    html: (r) => { const v = get(r); if (v == null || Number.isNaN(v)) return `<span class="c2">–</span>`; if (S.lens === "cls") return `<span class="sw" style="background:${colCss(colorOf(v))}"></span>${esc(CLS_SHORT[v])}`; const w = scale ? clamp((100 * v) / scale, 3, 100) : 100; return `<div class="lv">${scale ? `<i style="width:${0.6 * w}px;background:${colCss(colorOf(v))}"></i>` : `<i style="width:9px;height:9px;background:${colCss(colorOf(v))}"></i>`}<span>${dec ? v : S.lens === "fp" && S.fpMode === "change" ? sgn(v) : f1(v)}</span></div>`; } };
}
const fig2 = (a, af, b, bf) => `<span class="fig"><span class="${tx(af)}">${f1(a)}</span><span style="color:var(--ink-faint)"> – </span><span class="${tx(bf)}">${f1(b)}</span></span>`;
function seatCols(m) {
  const now = m.year === "now";
  const cols = [
    { key: "name", label: "Seat", get: (d) => d.n, txt: true, w: "minmax(140px,1.25fr)", html: (d) => `<span class="c1">${ds(d.n)}</span><span class="c2">${STATE_SHORT[d.st]}${d.cls ? " · " + esc(CLS_SHORT[d.cls]) : ""}</span>` },
    { key: "win", label: now ? "Held by" : "Won by", get: (d) => holdFam(d.hold) + d.hold.n, txt: true, w: "minmax(150px,1.35fr)", cat: true, html: (d) => `<span class="c1"><span class="sw" style="${swc(holdFam(d.hold))}"></span>${ds(d.hold.n)}</span><span class="c2">${ds(leaderName(d.hold))}${now && (d.hold.n !== d.win.n || d.hold.ab !== d.win.ab) ? (d.by ? " · by-election" : " · changed party") : ""}</span>` },
    { key: "final", label: "Final count", short: "Winning share", get: (d) => d.winPct, num: true, w: "112px", dist: true, fmt: f1, html: (d) => `${fig2(d.winPct, d.win.fam, 100 - d.winPct, d.run.fam)}<span class="c2">${ds(surname(d.win.n))} v ${ds(surname(d.run.n))}</span>` },
    { key: "tpp", label: "Labor 2PP", get: (d) => nn(d.tpp), num: true, w: "86px", dist: true, fmt: f1, color: (v) => RAMP.div[dIdx((50 - v) / 20)], ref: (a) => a.tpp, html: (d) => d.tpp == null ? `<span class="c2">–</span>` : `<span class="fig ${d.tpp >= 50 ? "t-alp" : "t-lnp"}">${f1(d.tpp)}</span>` },
    { key: "swing", label: "Swing", short: "Swing to Labor", get: (d) => nn(d.tppSw), num: true, w: "78px", dist: true, fmt: sgn, color: (v) => RAMP.div[dIdx(-v / 10)], ref: (a) => a.tppSw, zero: true, html: (d) => d.tppSw == null ? `<span class="c2">–</span>` : `<span class="fig ${d.tppSw >= 0 ? "t-alp" : "t-lnp"}">${sgn(d.tppSw)}</span>` },
  ];
  const lk = lensKey();
  if (lk === "lens" || lk === "cls") cols.push(lensColumn((d) => divValue(m, d.i)));
  if (lk === "tpp" || lk === "swing") cols.find((c) => c.key === lk).lens = true;
  if (lk === "win") cols.find((c) => c.key === "win").lens = true;
  cols.push({ key: "inf", label: "Informal", get: (d) => nn(d.infPct), num: true, w: "78px", dist: true, fmt: f1, color: (v) => RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)], ref: (a) => a.infPct, lens: lk === "inf", html: (d) => `<span class="fig">${f1(d.infPct)}</span>` });
  return cols;
}
function boothCols(m) {
  const b = m.booth;
  const cols = [
    { key: "name", label: "Polling place", get: (j) => b.name[j], txt: true, w: "minmax(170px,1.6fr)", html: (j) => `<span class="c1">${ds(b.name[j])}</span><span class="c2">${ds([b.prem[j], b.sub[j]].filter(Boolean).join(", ") || TYPE[b.ty[j]] || "")}</span>` },
    { key: "seat", label: "Seat", get: (j) => m.divs[b.d[j]].n, txt: true, w: "minmax(96px,0.8fr)", html: (j) => `<span class="c1" style="font-weight:500">${ds(m.divs[b.d[j]].n)}</span><span class="c2">${STATE_SHORT[m.divs[b.d[j]].st]}</span>` },
    { key: "votes", label: "Votes", get: (j) => b.votes[j], num: true, w: "72px", dist: true, fmt: (v) => int(v), html: (j) => `<span class="fig" style="font-weight:500">${int(b.votes[j])}</span>` },
    { key: "lead", label: "Led", short: "Leader’s share", get: (j) => nn(b.leadPct[j]), num: true, w: "112px", dist: true, fmt: f1, html: (j) => { const ld = b.lead[j]; if (!ld) return `<span class="c2">–</span>`; const D = m.divs[b.d[j]]; return `<span class="c1" style="font-weight:500"><span class="sw" style="${swc(ld.fam)}"></span>${ds(pairNames(ld, ld === D.A ? D.B : D.A)[0])}</span><span class="c2">${f1(b.leadPct[j])}%</span>`; } },
    { key: "tpp", label: "Labor 2PP", get: (j) => nn(b.tpp[j]), num: true, w: "86px", dist: true, fmt: f1, color: (v) => RAMP.div[dIdx((50 - v) / 20)], ref: (a) => a.tpp, html: (j) => Number.isNaN(b.tpp[j]) ? `<span class="c2">–</span>` : `<span class="fig ${b.tpp[j] >= 50 ? "t-alp" : "t-lnp"}">${f1(b.tpp[j])}</span>` },
    { key: "swing", label: "Swing", short: "Swing to Labor", get: (j) => nn(b.tppSw[j]), num: true, w: "78px", dist: true, fmt: sgn, color: (v) => RAMP.div[dIdx(-v / 10)], ref: (a) => a.tppSw, zero: true, html: (j) => Number.isNaN(b.tppSw[j]) ? `<span class="c2">–</span>` : `<span class="fig ${b.tppSw[j] >= 0 ? "t-alp" : "t-lnp"}">${sgn(b.tppSw[j])}</span>` },
  ];
  const lk = lensKey();
  if (lk === "lens" || lk === "cls") cols.push(lensColumn((j) => boothValue(m, j)));
  if (lk === "tpp" || lk === "swing") cols.find((c) => c.key === lk).lens = true;
  if (lk === "win") cols.find((c) => c.key === "lead").lens = true;
  cols.push({ key: "inf", label: "Informal", get: (j) => nn(b.infPct[j]), num: true, w: "78px", dist: true, fmt: f1, color: (v) => RAMP.inf[Math.round(clamp(v / 12, 0, 1) * 100)], ref: (a) => a.infPct, lens: lk === "inf", html: (j) => `<span class="fig">${f1(nn(b.infPct[j]))}</span>` });
  return cols;
}
// at phone width the list keeps two columns: the place (with its holder or seat beneath) and the lens's figure
const narrowList = () => { const el = $("#list"); return (el && el.clientWidth ? el.clientWidth : innerWidth) < 600; };
function compactCols(m, unit, cols) {
  const lensCol = cols.find((c) => c.lens && c.num) || cols.find((c) => c.key === (unit === "seats" ? "final" : "lead"));
  const b = m.booth;
  const first = unit === "seats"
    ? { ...cols[0], w: "minmax(0,1fr)", html: (d) => `<span class="c1"><span class="sw" style="${swc(holdFam(d.hold))}"></span>${ds(d.n)}</span><span class="c2">${STATE_SHORT[d.st]} · ${ds(d.hold.n)}, ${esc(partyShort(d.hold.ab, d.hold.pn))}</span>` }
    : { ...cols[0], w: "minmax(0,1fr)", html: (j) => `<span class="c1">${ds(b.name[j])}</span><span class="c2">${ds(m.divs[b.d[j]].n)} · ${int(b.votes[j])} votes</span>` };
  return [first, { ...lensCol, w: "104px" }];
}
const colsFor = (m, unit, full) => { const c = unit === "seats" ? seatCols(m) : boothCols(m); return !full && narrowList() ? compactCols(m, unit, c) : c; };
function colByKey(m, unit, key) { return colsFor(m, unit, true).find((c) => c.key === key) || null; }

/* =============================== distributions ===============================
   A column chart of how one measure spreads across the rows in view: one bar
   per bin, coloured by the map's own scale where the measure has one, the
   country's figure marked, the chosen seat or place marked. A bar (or a drag
   across several) filters the list to that range, and the map and chamber
   dim everything outside it. */
const NICE = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
function binsFor(vals, c, target) {
  if (c.decile) return { lo: 0.5, hi: 10.5, w: 1, n: 10, decile: true };
  const sorted = [...vals].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  let lo = sorted.length > 400 ? q(0.005) : sorted[0], hi = sorted.length > 400 ? q(0.995) : sorted[sorted.length - 1];
  if (c.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  let w = NICE[NICE.length - 1];
  for (const x of NICE) if ((hi - lo) / x <= target) { w = x; break; }
  lo = Math.floor(lo / w) * w; hi = Math.ceil(hi / w) * w; if (hi <= lo) hi = lo + w;
  return { lo, hi, w, n: Math.round((hi - lo) / w), loOpen: sorted[0] < lo - 1e-9, hiOpen: sorted[sorted.length - 1] > hi + 1e-9 };
}
function distData(m, unit, rows, key, target) {
  const c = colByKey(m, unit, key);
  if (!c || !c.num) return null;
  const vals = [], ids = [];
  for (const r of rows) { const v = c.get(r); if (v != null && !Number.isNaN(v)) { vals.push(v); ids.push(r); } }
  if (vals.length < 3) return { c, vals, empty: true };
  const B = binsFor(vals, c, target || (unit === "seats" ? 22 : 44));
  const counts = new Array(B.n).fill(0), members = Array.from({ length: B.n }, () => []);
  vals.forEach((v, k) => { const bi = clamp(Math.floor((v - B.lo) / B.w + 1e-9), 0, B.n - 1); counts[bi]++; members[bi].push(ids[k]); });
  return { c, B, counts, members, vals, ids, unit };
}
let distSeq = 0;
const distReg = new Map(); // id -> { m, unit, key, rows, d, opts }
function distSVG(D, W, H, opts) {
  const { c, B, counts } = D;
  const padL = 2, padR = 2, padT = opts.compact ? 6 : 14, padB = opts.compact ? 18 : 22;
  const x = (v) => padL + ((v - B.lo) / (B.hi - B.lo)) * (W - padL - padR);
  const max = Math.max(...counts, 1);
  const y = (n) => H - padB - (n / max) * (H - padT - padB);
  const bw = (W - padL - padR) / B.n, gap = bw > 6 ? 2 : bw > 3 ? 1 : 0;
  const r = S.f.range && S.f.range.unit === D.unit && S.f.range.key === c.key ? S.f.range : null;
  let s = "";
  const stack = D.unit === "seats" && c.decile;
  for (let k = 0; k < B.n; k++) {
    const n = counts[k]; if (!n) continue;
    const v0 = B.lo + k * B.w, mid = v0 + B.w / 2;
    const col = c.color ? c.color(mid) : null;
    const on = !r || (mid >= r.lo && mid <= r.hi);
    const bx = (x(v0) + gap / 2).toFixed(1), bwd = Math.max(1, bw - gap).toFixed(1);
    if (stack) {
      // a tenth of the seats each, so the bar's height is fixed: who holds them is the reading
      let acc = H - padB;
      for (const f of ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"]) {
        const nf = D.members[k].filter((d) => holdFam(d.hold) === f).length; if (!nf) continue;
        const hh = (nf / max) * (H - padT - padB);
        acc -= hh;
        s += `<rect x="${bx}" y="${acc.toFixed(1)}" width="${bwd}" height="${Math.max(0.5, hh - 1).toFixed(1)}" fill="var(--m-${f})" opacity="${on ? 1 : 0.22}" data-bin="${k}"/>`;
      }
      continue;
    }
    const top = y(n), hgt = H - padB - top;
    s += `<rect x="${bx}" y="${top.toFixed(1)}" width="${bwd}" height="${Math.max(1, hgt).toFixed(1)}" rx="${Math.min(2, (bw - gap) / 3).toFixed(1)}" fill="${col ? css(col) : "var(--ink-faint)"}" opacity="${on ? 1 : 0.22}" data-bin="${k}"/>`;
  }
  // the baseline and ticks
  s += `<line x1="${padL}" x2="${W - padR}" y1="${H - padB + 0.5}" y2="${H - padB + 0.5}" stroke="var(--ink-faint)" stroke-width="1"/>`;
  const ticks = B.decile ? [1, 5, 10] : d3.ticks(B.lo, B.hi, opts.compact ? 4 : 7).filter((t) => t >= B.lo && t <= B.hi);
  const fmt = c.fmt || f1;
  ticks.forEach((t, k) => { const tx0 = B.decile ? x(t) : x(t); const anchor = tx0 < 14 ? "start" : tx0 > W - 14 ? "end" : "middle"; s += `<line x1="${tx0}" x2="${tx0}" y1="${H - padB}" y2="${H - padB + 4}" stroke="var(--ink-faint)"/><text x="${tx0}" y="${H - padB + 15}" text-anchor="${anchor}" font-size="11" fill="var(--ink-3)">${B.decile ? t : t === 0 && c.zero ? "0" : fmt(t).replace(/\.0$/, "")}${!B.decile && k === ticks.length - 1 && /tpp|inf|final|lens|lead/.test(c.key) && !c.diverge && c.key !== "votes" ? "%" : ""}</text>`; });
  // the country's figure
  const ref = c.ref ? c.ref(M().areas[S.sel.level === "aus" || !S.sel.st ? "AUS" : S.sel.st]) : c.key === "lens" ? lensRef() : null;
  if (ref != null && ref >= B.lo && ref <= B.hi) {
    const rx = x(ref);
    s += `<line x1="${rx}" x2="${rx}" y1="${padT - (opts.compact ? 4 : 8)}" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    if (!opts.compact) s += `<text x="${rx + (rx > W - 120 ? -5 : 5)}" y="${padT - 2}" text-anchor="${rx > W - 120 ? "end" : "start"}" font-size="11.5" font-weight="600" fill="var(--ink-2)">${S.sel.level === "aus" || !S.sel.st ? "Australia" : STATE_SHORT[S.sel.st]} ${fmt(ref)}</text>`;
  }
  // the chosen seat or place
  const selId = D.unit === "seats" ? selDiv() : S.sel.level === "booth" ? S.sel.booth : null;
  if (selId != null) {
    const v = c.get(D.unit === "seats" ? M().divs[selId] : selId);
    if (v != null && !Number.isNaN(v)) {
      const vx = x(clamp(v, B.lo, B.hi));
      s += `<path d="M${vx - 5},${H - padB + 9} L${vx},${H - padB + 3} L${vx + 5},${H - padB + 9} Z" fill="var(--ink)"/>`;
    }
  }
  // a drag-brush layer
  s += `<rect class="dist-hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block;overflow:visible">${s}</svg>`;
}
function lensRef() {
  const m = M(), a = m.areas[S.sel.level === "aus" || !S.sel.st ? "AUS" : S.sel.st];
  if (S.lens === "fp") return S.fpMode === "change" ? a.fpSw[S.party] : a.fp[S.party];
  if (S.lens === "seifa" && isDemo()) return a.demo ? a.demo[S.index] : null;
  if (S.lens === "flow") { let toA = 0, tot = 0; for (const i of a.idx) { const d = m.divs[i]; if (!d.classic) continue; for (const f of d.flows) if (f.cand.b === S.from) { toA += d.alpSide === 0 ? f.ta : f.tb; tot += f.ta + f.tb; } } return tot ? (100 * toA) / tot : null; }
  return null;
}
// a placeholder the story or the list fills once laid out (the chart needs its width)
function distBlock(m, unit, rows, opts) {
  const key = opts.key || (lensKey() === "lens" ? "lens" : lensKey() === "inf" ? "inf" : lensKey() === "swing" ? "swing" : "tpp");
  const id = "dist" + ++distSeq;
  distReg.set(id, { m, unit, key, rows, opts });
  return `<div class="dist${opts.compact ? " compact" : ""}" id="${id}" data-dist-id="${id}"></div>`;
}
function hydrateDists() {
  for (const [id, r] of distReg) {
    const el = document.getElementById(id);
    if (!el) { distReg.delete(id); continue; }
    const D = distData(r.m, r.unit, r.rows, r.key, r.opts.compact ? (r.unit === "seats" ? 18 : 24) : null);
    r.D = D;
    if (!D || D.empty) { el.innerHTML = `<p class="st-note">Not enough values to chart.</p>`; continue; }
    const W = Math.max(200, el.clientWidth || 300), H = r.opts.compact ? 74 : 150;
    const n = D.vals.length, unitWord = r.unit === "seats" ? plural(n, "seat") : plural(n, "polling place");
    const stacked = r.unit === "seats" && D.c.decile;
    el.innerHTML = distSVG(D, W, H, r.opts) + (r.opts.compact ? `<p class="st-note">${stacked ? `Each bar is a tenth of the ${n} seats, from the least advantaged on the left, split by who ${M().year === "now" ? "holds" : "won"} them` : `${n.toLocaleString("en-AU")} ${unitWord}. Each bar counts the ${r.unit === "seats" ? "seats" : "places"} in its range`}; choose one to pick them out${S.view === "list" ? "" : " on the " + (S.view === "chamber" ? "chamber" : "map")}.</p>` : "");
  }
}
// hover, click and drag on any distribution chart
(() => {
  let drag = null;
  const binAt = (el, r, clientX) => { const svg = el.querySelector("svg"); const bb = svg.getBoundingClientRect(); const D = r.D; if (!D || !D.B) return null; const fx = (clientX - bb.left) / bb.width; return clamp(Math.floor(fx * D.B.n), 0, D.B.n - 1); };
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest("[data-dist-id]");
    if (!el) { if (distTipOn) { hideTip(); distTipOn = false; } return; }
    const r = distReg.get(el.dataset.distId); if (!r || !r.D || !r.D.B) return;
    const k = binAt(el, r, e.clientX); if (k == null) return;
    if (drag && drag.el === el) { drag.k1 = k; previewDrag(el, r, drag); }
    const D = r.D, B = D.B, n = D.counts[k], v0 = B.lo + k * B.w, v1 = v0 + B.w;
    const fmt = D.c.fmt || f1, unitWord = r.unit === "seats" ? plural(n, "seat") : plural(n, "polling place");
    const names = D.members[k].slice(0, 4).map((id) => (r.unit === "seats" ? M().divs[id.i].n : M().booth.name[id])).map(esc).join(", ");
    const range = B.decile ? `decile ${k + 1}` : k === 0 && B.loOpen ? `under ${fmt(v1)}` : k === B.n - 1 && B.hiOpen ? `${fmt(v0)} or more` : `${fmt(v0)} to ${fmt(v1)}`;
    showTipAt(`<div class="tn">${n} ${unitWord}<span>${esc(D.c.short || D.c.label)} ${range}</span></div>${n ? `<div class="ts">${names}${n > 4 ? `, and ${n - 4} more` : ""}</div>` : ""}<div class="ts">${S.f.range && S.f.range.key === D.c.key ? "Click again to clear" : "Click, or drag across bars, to pick them out"}</div>`, e.clientX, e.clientY);
    distTipOn = true;
  });
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest && e.target.closest("[data-dist-id]");
    if (!el || e.button) return;
    const r = distReg.get(el.dataset.distId); if (!r || !r.D || !r.D.B) return;
    const k = binAt(el, r, e.clientX); if (k == null) return;
    drag = { el, r, k0: k, k1: k };
    e.preventDefault();
  });
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    const { r, k0, k1 } = drag; drag = null;
    const D = r.D, B = D.B, a = Math.min(k0, k1), b = Math.max(k0, k1);
    const lo = B.lo + a * B.w, hi = B.lo + (b + 1) * B.w;
    const cur = S.f.range;
    if (cur && cur.unit === r.unit && cur.key === D.c.key && Math.abs(cur.lo - lo) < 1e-9 && Math.abs(cur.hi - hi) < 1e-9) S.f.range = null;
    else S.f.range = { unit: r.unit, key: D.c.key, lo, hi, loOpen: a === 0 && B.loOpen, hiOpen: b === B.n - 1 && B.hiOpen, last: b === B.n - 1 };
    if (r.unit === "booths" && S.listUnit !== "booths") S.listUnit = "booths";
    filtersChanged();
  });
})();
let distTipOn = false;
function previewDrag(el, r, drag) {
  const a = Math.min(drag.k0, drag.k1), b = Math.max(drag.k0, drag.k1);
  el.querySelectorAll("rect[data-bin]").forEach((rc) => { const k = +rc.dataset.bin; rc.setAttribute("opacity", k >= a && k <= b ? "1" : "0.22"); });
}

/* =============================== the list view =============================== */
/* booth rows are taller: their names wrap to two lines (.ls-row.booths in page.css) */
const ROW_H = (u) => (u === "booths" ? 58 : 52);
/* proper names in the table's cells: escaped, with typographic apostrophes */
const ds = (s) => esc(String(s).replace(/'/g, "’"));
function listRows(m) {
  const q = S.q.trim() && S.view === "list" ? norm(S.q.trim()).split(/\s+/).filter(Boolean) : null;
  const hit = (h) => !q || q.every((t) => h.includes(t));
  if (S.listUnit === "seats") return m.divs.filter((d) => passes(m, d.i) && hit(norm(d.n + " " + d.hold.n + " " + d.win.n + " " + d.st + " " + STATE_TITLE[d.st]))).map((d) => d);
  const b = m.booth, sd = selDiv();
  const out = [];
  const r = S.f.range && S.f.range.unit === "booths" ? S.f.range : null;
  const loop = (j) => {
    const D = m.divs[b.d[j]];
    if (sd == null && S.f.st && D.st !== S.f.st) return;
    if (sd == null && (S.f.cls || S.f.win || S.f.margin) && !passes(m, D.i, true)) return;
    if (r && !inRange(boothColValue(m, j, r.key), r)) return;
    if (hit(norm(b.name[j] + " " + (b.sub[j] || "") + " " + (b.pc[j] || "") + " " + D.n))) out.push(j);
  };
  if (sd != null) b.byDiv[sd].forEach(loop); else for (let j = 0; j < b.n; j++) loop(j);
  return out;
}
let listCache = null;
function renderList(keepScroll) {
  const m = M(); if (!m || S.view !== "list") return;
  const el = $("#list");
  const unit = S.listUnit, sd = selDiv();
  const cols = colsFor(m, unit);
  const rows = listRows(m);
  // sort: the lens column by default, highest first
  const lc = cols.find((c) => c.lens && c.num);
  const sk = S.sort && cols.find((c) => c.key === S.sort.key) ? S.sort : lc ? { key: lc.key, dir: -1 } : { key: "name", dir: 1 };
  const sc = cols.find((c) => c.key === sk.key);
  rows.sort((a, b) => { const x = sc.get(a), y = sc.get(b); const xn = x == null || Number.isNaN(x), yn = y == null || Number.isNaN(y); if (xn && yn) return 0; if (xn) return 1; if (yn) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * sk.dir; });
  const total = unit === "seats" ? m.divs.length : sd != null ? m.booth.byDiv[sd].length : m.booth.n;
  const sel = (name, k, opts, cur) => `<select class="ls-sel${cur ? " on" : ""}" data-fsel="${k}" aria-label="${name}"><option value="">${name}</option>${opts.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${cur === v ? "✓ " : ""}${t}</option>`).join("")}</select>`;
  let bar = `<div class="ls-unit" role="tablist" aria-label="Rows"><button type="button" class="rd-tab" role="tab" data-unit="seats" aria-selected="${unit === "seats"}"><span class="tw" data-t="Seats">Seats</span></button><button type="button" class="rd-tab" role="tab" data-unit="booths" aria-selected="${unit === "booths"}"><span class="tw" data-t="Polling places">Polling places</span></button></div>`;
  if (unit === "booths" && sd != null) bar += `<button type="button" class="ls-chip" data-unseat title="Show every polling place">In ${ds(m.divs[sd].n)} ✕</button>`;
  else {
    bar += sel("State", "st", STATES.map((s) => [s, STATE_TITLE[s]]), S.f.st);
    bar += sel(m.year === "now" ? "Held by" : "Won by", "win", ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => m.divs.some((d) => holdFam(d.hold) === f)).map((f) => [f, FAM_LEG[f]]), S.f.win);
    bar += sel("Seat type", "cls", CLS.map((c) => [c, CLS_SHORT[c]]), S.f.cls);
    bar += sel("Margin", "margin", Object.entries(MARGINS).map(([k, v]) => [k, v[2]]), S.f.margin);
  }
  if (S.f.range) { const c = colByKey(m, S.f.range.unit, S.f.range.key); if (c) bar += `<button type="button" class="ls-chip" data-unrange title="Clear this range">${esc(c.short || c.label)} ${esc(rangeText(S.f.range, c))} ✕</button>`; }
  bar += `<span class="ls-count"><b>${rows.length.toLocaleString("en-AU")}</b> of ${total.toLocaleString("en-AU")} ${unit === "seats" ? "seats" : "places"}</span>`;
  // the distribution chart, for whichever column is chosen
  const dk = S.dist && cols.find((c) => c.key === S.dist && c.num) ? S.dist : null;
  const distHtml = dk ? `<div class="ls-dist"><div class="ls-dist-h"><b>${esc((cols.find((c) => c.key === dk).short || cols.find((c) => c.key === dk).label))}</b><span>across ${unit === "seats" ? "these seats" : "these polling places"}</span><button type="button" data-distclose aria-label="Close the distribution">✕</button></div>${distBlock(m, unit, rowsForDist(m, unit), { key: dk })}</div>` : "";
  const tmpl = cols.map((c) => c.w).join(" ");
  const sparkFor = (c) => c.num && c.dist ? `<span class="ls-spark" data-dist="${c.key}" role="button" tabindex="0" aria-label="Show how ${esc(c.label)} is distributed" title="Show the distribution">${sparkSVG(m, unit, rowsForDist(m, unit), c)}</span>` : "";
  const headHtml = `<div class="ls-head" role="row" style="grid-template-columns:${tmpl}">${cols.map((c) => `<div role="columnheader" class="ls-hc${c.num ? " r" : ""}${c.key === dk ? " dist-on" : ""}"${c.key === sk.key ? ` aria-sort="${sk.dir > 0 ? "ascending" : "descending"}"` : ""}>${sparkFor(c)}<button type="button" data-sort="${c.key}" class="${c.num ? "r" : ""}"${c.key === sk.key ? ` aria-sort="${sk.dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(c.label)}<span class="ar">${c.key === sk.key ? (sk.dir > 0 ? "▲" : "▼") : "▾"}</span></button></div>`).join("")}</div>`;
  const grid = el.querySelector(".ls-grid");
  const prevTop = keepScroll && grid ? grid.scrollTop : 0;
  el.innerHTML = `<div class="ls-bar">${bar}</div>${distHtml}<div class="ls-grid" role="table" aria-rowcount="${rows.length}">${headHtml}${rows.length ? `<div class="ls-pad" style="height:${rows.length * ROW_H(unit)}px;position:relative"></div>` : `<div class="ls-empty">Nothing matches. Clear the search or a filter.</div>`}</div>`;
  listCache = { rows, cols, tmpl, unit };
  const g2 = el.querySelector(".ls-grid");
  g2.scrollTop = prevTop;
  g2.addEventListener("scroll", () => requestAnimationFrame(paintRows), { passive: true });
  paintRows();
  hydrateDists();
}
// the distribution reads every row the other filters let through, so its own range doesn't hide the rest of the spread
function rowsForDist(m, unit) {
  const saved = S.f.range; S.f.range = saved && saved.unit !== unit ? saved : null;
  const unitSaved = S.listUnit; S.listUnit = unit;
  const rows = listRows(m);
  S.f.range = saved; S.listUnit = unitSaved;
  return rows;
}
function sparkSVG(m, unit, rows, c) {
  const D = distData(m, unit, rows, c.key, 12);
  if (!D || D.empty) return "";
  const W = 46, H = 13, max = Math.max(...D.counts, 1), bw = W / D.B.n;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${D.counts.map((n, k) => (n ? `<rect x="${(k * bw + 0.5).toFixed(1)}" y="${(H - (n / max) * H).toFixed(1)}" width="${Math.max(0.8, bw - 1).toFixed(1)}" height="${((n / max) * H).toFixed(1)}" fill="${c.color ? css(c.color(D.B.lo + (k + 0.5) * D.B.w)) : "var(--ink-faint)"}"/>` : "")).join("")}</svg>`;
}
function paintRows() {
  if (!listCache) return;
  const grid = $("#list .ls-grid"), pad = grid && grid.querySelector(".ls-pad"); if (!pad) return;
  const { rows, cols, tmpl, unit } = listCache;
  const headH = grid.querySelector(".ls-head").offsetHeight;
  const top = Math.max(0, grid.scrollTop - headH), h = grid.clientHeight;
  const rh = ROW_H(unit);
  const a = Math.max(0, Math.floor(top / rh) - 6), z = Math.min(rows.length, Math.ceil((top + h) / rh) + 6);
  const s = S.sel;
  let html = "";
  for (let k = a; k < z; k++) {
    const r = rows[k];
    const on = unit === "seats" ? (s.level === "div" || s.level === "booth") && s.div === r.i : s.level === "booth" && s.booth === r;
    html += `<div class="ls-row${unit === "booths" ? " booths" : ""}${on ? " on" : ""}" role="row" data-go="${unit === "seats" ? "div:" + r.i : "booth:" + r}" style="top:${k * rh}px;height:${rh}px;grid-template-columns:${tmpl}">${cols.map((c) => `<div role="cell" class="${c.num ? "r" : ""}">${c.html(r)}</div>`).join("")}</div>`;
  }
  pad.innerHTML = html;
}

/* =============================== lens words =============================== */
function lensShort() {
  switch (S.lens) {
    case "winner": return isNow() ? "Held by" : "Winner";
    case "tpp": return S.tppMode === "swing" ? "Swing to Labor" : "Labor 2PP";
    case "fp": return S.fpMode === "change" ? `${FAM_LEG[S.party]} change` : `${FAM_LEG[S.party]} primary`;
    case "flow": return `${FAM_LEG[S.from]} to Labor`;
    case "informal": return "Informal";
    case "cls": return "Seat type";
    case "seifa": return isDemo() ? DM_SHORT[S.index] : `${IX_ABBR[S.index]} decile`;
  }
  return "";
}
/* the lens as a list-table column head: every party coded, all of one register */
function lensHead() {
  switch (S.lens) {
    case "fp": return S.fpMode === "change" ? `${FAM_CODE[S.party]} change` : `${FAM_CODE[S.party]} primary`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    default: return lensShort();
  }
}
function valueText(v, kind) {
  if (v == null) {
    switch (S.lens) {
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 2016 on" : "No census figure here") : "No score here";
      case "fp": return S.fpMode === "change" ? "Didn’t stand both times" : "Didn’t stand";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    case "fp": return S.fpMode === "change" ? `${FAM_LEG[S.party]} ${sgn(v)} points` : `${FAM_LEG[S.party]} ${f1(v)}%`;
    case "flow": return `${f0(v)}% of ${FAM_LEG[S.from]} preferences to Labor`;
    case "informal": return `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? `${f1(v)}% ${DM_VERB[S.index]}` : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
function renderLenses() {
  $("#lenses").innerHTML = LENSES.map((l) => `<button type="button" class="rd-tab" role="tab" data-lens="${l.id}" aria-selected="${S.lens === l.id}"><span class="tw" data-t="${l.label}">${l.label}</span></button>`).join("");
}

/* =============================== the legend =============================== */
let legendKey = "";
const boothsShown = () => S.view === "map" && (selDiv() != null || T.k >= K_ALL);
const legendState = () => [S.view, boothsShown(), S.lens, S.tppMode, S.fpMode, S.party, S.from, S.index, S.basis, S.year, TH && TH.dark].join("|");
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "flow": return [10, 90];
    case "informal": return [0, 12];
    case "seifa": return isDemo() ? DM_RANGE[S.index] : [1, 10];
  }
  return null;
};
function legendHist(m, lo, hi) {
  const vals = m.divs.map((d) => divValue(m, d.i)).filter((v) => v != null);
  if (vals.length < 10) return "";
  const dec = S.lens === "seifa" && !isDemo();
  const n = dec ? 10 : 20, w = (hi - lo) / n, counts = new Array(n).fill(0);
  for (const v of vals) counts[clamp(Math.floor((v - lo) / w + (dec ? 0.5 : 0)), 0, n - 1)]++;
  const max = Math.max(...counts);
  return `<div class="lg-hist" aria-hidden="true">${counts.map((c, k) => `<i style="height:${(100 * c) / max}%;background:${colCss(colorOf(lo + (k + 0.5) * w))}"></i>`).join("")}</div>`;
}
function renderLegend() {
  legendKey = legendState();
  const el = $("#legend"), m = M();
  if (!m || S.view === "list") { el.hidden = true; return; }
  el.hidden = false;
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year);
  const grad = (tbl, from, to) => { const st = []; for (let k = 0; k <= 10; k++) st.push(`${css(tbl[Math.round(lerp(from, to, k / 10))])} ${k * 10}%`); return `linear-gradient(90deg, ${st.join(",")})`; };
  const ticks = (vals, lo, hi, fmt) => `<div class="lg-ticks">${vals.map((v) => `<span style="left:${(100 * (v - lo)) / (hi - lo)}%">${fmt(v)}</span>`).join("")}</div>`;
  const mark = (v, lo, hi) => (v == null ? "" : `<span class="mk" style="left:${(100 * (clamp(v, lo, hi) - lo)) / (hi - lo)}%" title="Australia ${f1(v)}"></span>`);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => `<select data-opt="${name}" aria-label="${name}">${list.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const partyOpts = FAMS.map((f) => [f, FAM_LEG[f]]);
  let h = "";
  switch (S.lens) {
    case "winner": {
      const cnt = {}; for (const d of m.divs) cnt[holdFam(d.hold)] = (cnt[holdFam(d.hold)] || 0) + 1;
      h += `<div class="lg-t">${boothsOn ? "Who led the final count at each place" : isNow() ? "Who holds each seat today" : `Who won each seat in ${m.year}`}</div>`;
      h += `<div class="lg-cats">${["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f] || boothsOn).map((f) => `<span><i style="${swc(f)}"></i>${FAM_LEG[f]}${boothsOn ? "" : ` <b>${cnt[f]}</b>`}</span>`).join("")}</div>`;
      break;
    }
    case "tpp": {
      const sw = S.tppMode === "swing";
      h += `<div class="lg-t">Two-party preferred: <button type="button" class="flip" data-flip="tpp">${sw ? `swing since ${prev}` : "share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      h += `<div class="lg-ramp" style="background:${grad(RAMP.div, 0, 200)}">${mark(sw ? -aus.tppSw : 100 - aus.tpp, lo, hi)}</div>`;
      h += sw ? ticks([-10, -5, 0, 5, 10], -10, 10, (v) => (v === 0 ? "0" : Math.abs(v))) : ticks([30, 40, 50, 60, 70], 30, 70, (v) => (v === 50 ? "50" : v < 50 ? `${100 - v}` : `${v}`));
      h += `<div class="lg-ends"><span class="t-alp">◀ ${sw ? "To Labor" : "Labor ahead"}</span><span class="t-lnp">${sw ? "To the Coalition" : "Coalition ahead"} ▶</span></div>`;
      if (boothsOn && sw) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "fp": {
      const ch = S.fpMode === "change";
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} first preferences: <button type="button" class="flip" data-flip="fp">${ch ? `change on ${prev}` : "share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      if (ch) h += `<div class="lg-ramp" style="background:linear-gradient(90deg, ${css(RAMP.loss[100])} 0%, ${css(RAMP.loss[45])} 30%, ${css(RAMP.loss[0])} 50%, ${css(RAMP.fp[S.party][45])} 70%, ${css(RAMP.fp[S.party][100])} 100%)">${mark(aus.fpSw[S.party], lo, hi)}</div>${ticks([-15, -5, 0, 5, 15], -15, 15, (v) => (v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"))}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Lost ground</span><span class="t-${S.party}">Gained ▶</span></div>`;
      else h += `<div class="lg-ramp" style="background:${grad(RAMP.fp[S.party], 0, 100)}">${mark(aus.fp[S.party], 0, FPMAX[S.party])}</div>${ticks([0, FPMAX[S.party] / 2, FPMAX[S.party]], 0, FPMAX[S.party], (v) => `${v}%${v === FPMAX[S.party] ? "+" : ""}`)}`;
      h += `<div class="lg-note">The line marks Australia: ${ch ? sgn(aus.fpSw[S.party]) + " points" : f1(aus.fp[S.party]) + "%"}.</div>`;
      break;
    }
    case "flow": {
      h += `<div class="lg-t">Where ${opt("from", S.from, [["grn", "the Greens’"], ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]])} preferences went</div>`;
      h += legendHist(m, 10, 90);
      h += `<div class="lg-ramp" style="background:${grad(RAMP.div, 0, 200)}"></div>${ticks([10, 30, 50, 70, 90], 10, 90, (v) => `${v}%`)}<div class="lg-ends"><span class="t-alp">◀ Mostly to Labor</span><span class="t-lnp">Mostly to the Coalition ▶</span></div><div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and the Coalition</div>`;
      break;
    }
    case "informal":
      h += `<div class="lg-t">Informal ballots</div>${legendHist(m, 0, 12)}<div class="lg-ramp" style="background:${grad(RAMP.inf, 0, 100)}">${mark(aus.infPct, 0, 12)}</div>${ticks([0, 3, 6, 9, 12], 0, 12, (v) => `${v}%${v === 12 ? "+" : ""}`)}<div class="lg-note">The line marks Australia: ${f1(aus.infPct)}%.</div>`;
      break;
    case "cls":
      h += `<div class="lg-t">The AEC’s seat types</div><div class="lg-cats">${CLS.map((c, k) => `<span><i style="background:${css(TH.cls[k])}"></i>${CLS_SHORT[c]} <b>${m.divs.filter((d) => d.cls === c).length}</b></span>`).join("")}</div>`;
      break;
    case "seifa": {
      // one picker for the census: the ABS's advantage indexes, then the people measures
      const og = (label, list) => `<optgroup label="${label}">${list.map(([v, t]) => `<option value="${v}"${S.index === v ? " selected" : ""}>${t}</option>`).join("")}</optgroup>`;
      h += `<div class="lg-t"><select data-opt="index" aria-label="Census measure">${og("Advantage, ABS SEIFA", IX.map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]))}${og("People", DM.map((x) => [x, DM_NAME[x]]))}</select></div>`;
      if (isDemo()) {
        const [lo, hi] = DM_RANGE[S.index], early = m.year !== "now" && m.year < DEMO_FROM;
        if (!early) h += legendHist(m, lo, hi);
        h += `<div class="lg-ramp" style="background:${grad(RAMP.demo[S.index], 0, 100)}">${early || !aus.demo ? "" : mark(aus.demo[S.index], lo, hi)}</div>${ticks([lo, (lo + hi) / 2, hi], lo, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}`;
        h += `<div class="lg-note">${early ? "Counted from the 2016 election on: earlier elections don’t record where voters live." : `Share of residents, 2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.${aus.demo ? ` The line marks Australia: ${f1(aus.demo[S.index])}%.` : ""}`}</div>`;
        break;
      }
      h += `<div class="lg-ramp" style="background:${grad(RAMP.seifa, 0, 100)}"></div>${ticks([1, 10], 1, 10, (v) => `${v}`)}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Least advantaged</span><span style="color:var(--ink-3)">Most ▶</span></div>`;
      h += boothsOn ? `<div class="lg-note">Places scored ${opt("basis", S.basis, [["venue", "where they stand"], ["voters", "where their voters live"]])}</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  if (boothsOn) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  el.innerHTML = h;
}

/* =============================== the timeline =============================== */
let SUM = null;
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 66, m = M();
  // the elections sit at even steps: a run of results, not a calendar
  const X = (y) => 22 + (YEARS.indexOf(y) / (YEARS.length - 1)) * (W - 44);
  const short = W < 560;
  const base = H - 24, cur = S.year;
  const sd = m ? selDiv() : null;
  let g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
  // the glyph above each stop: the House's make-up, or the chosen seat's two-party line
  if (sd != null && m) {
    const d = m.divs[sd], hh = d.h;
    const vs = hh.map((r) => r[1]).filter((v) => v != null);
    let lo = Math.min(...vs, 50) - 3, hi = Math.max(...vs, 50) + 3;
    if (hi - lo < 16) { const c = (lo + hi) / 2; lo = c - 8; hi = c + 8; }
    const yv = (v) => base - 6 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (base - 14);
    const pl = hh.filter((r) => r[1] != null && !r[4]).map((r) => `${X(r[0]).toFixed(1)},${yv(r[1]).toFixed(1)}`).join(" ");
    g += `<line x1="0" x2="${W}" y1="${yv(50)}" y2="${yv(50)}" stroke="var(--line)" stroke-dasharray="2 3"/><polyline points="${pl}" fill="none" stroke="var(--ink-faint)" stroke-width="1.4"/>`;
    for (const r of hh) {
      const yr = r[4] ? "now" : r[0];
      const cy = r[1] != null ? yv(r[1]) : yv(50);
      g += `<circle cx="${X(yr)}" cy="${cy}" r="${yr === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${esc(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (cur === "now" && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X("now")}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${holdFam(m.divs[sd].hold)})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    const st = S.sel.level === "state" ? S.sel.st : "AUS";
    for (const y of YEARS) {
      const s = SUM.seats[y] && SUM.seats[y][st]; if (!s) continue;
      const tot = sum(Object.values(s)), bw = 30, x = X(y) - bw / 2;
      let acc = 0;
      for (const f of ["alp", "grn", "ind", "oth", "onp", "lnp"]) { const n = s[f] || 0; if (!n) continue; const w = (bw * n) / tot; g += `<rect x="${(x + acc).toFixed(2)}" y="${base - 18}" width="${Math.max(0.6, w - 0.6).toFixed(2)}" height="8" fill="var(--m-${f})" opacity="${y === cur ? 1 : 0.62}"/>`; acc += w; }
    }
  }
  for (const y of YEARS) {
    const on = y === cur, x = X(y), lab = short && y !== "now" ? "’" + String(y).slice(2) : yearLabel(y);
    g += `<g class="stop" data-year="${y}" style="cursor:pointer"><rect class="hit" x="${x - 24}" y="0" width="48" height="${H}"/><line x1="${x}" x2="${x}" y1="${base - 3}" y2="${base + 3}" stroke="${on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${on ? " on" : ""}" x="${x}" y="${base + 17}" text-anchor="middle">${lab}</text>${on ? `<line x1="${x - 16}" x2="${x + 16}" y1="${base + 22}" y2="${base + 22}" stroke="var(--ink)" stroke-width="2"/>` : ""}</g>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elections from 2004 to now; choose one">${g}</svg>`;
}

/* =============================== tooltip =============================== */
const tip = $("#tip");
document.body.appendChild(tip);
tip.style.position = "fixed";
function hideTip() { tip.hidden = true; }
function showTipAt(html, cx, cy) {
  tip.innerHTML = html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let tx = cx + 14, ty = cy + 16;
  if (tx + r.width > innerWidth - 8) tx = cx - r.width - 14;
  if (ty + r.height > innerHeight - 8) ty = cy - r.height - 14;
  tip.style.transform = `translate(${Math.max(6, tx)}px, ${Math.max(6, ty)}px)`;
}
function tipFor(h) {
  const m = M(); if (!h || !m) return "";
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    return `<div class="tn">${esc(d.n)}<span>${STATE_SHORT[d.st]}${sp}</span></div><div class="tv">${esc(valueText(v, "div"))}</div><div class="ts">${esc(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  return `<div class="tn">${esc(b.name[j])}<span>${esc(D.n)}</span></div><div class="tv">${esc(valueText(boothValue(m, j), "booth"))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>`;
}

/* =============================== selection =============================== */
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
  if (selDiv() !== prevDiv) quietSince = performance.now();
  S.hover = null; hideTip();
  if (opts.view && opts.view !== S.view) setView(opts.view, true);
  if (S.view === "map" && opts.fly !== false) fitSelection(opts.dur ?? 800);
  renderStory(true);
  if (S.view === "list") renderList(true);
  renderFilterPill(); legendIfChanged(); updateHint(); renderTimeline(); writeURL();
  if (isPhone() && opts.scroll !== false && sel.level !== "aus") { /* the story sits under the map on a phone: nothing to scroll */ }
  schedule();
}
const goAus = (o) => select({ level: "aus" }, o);
const goState = (st, o) => select({ level: "state", st }, o);
const goDiv = (i, o) => { const m = M(); select({ level: "div", st: m.divs[i].st, div: i }, o); };
const goBooth = (j, o) => { const m = M(); const i = m.booth.d[j]; select({ level: "booth", st: m.divs[i].st, div: i, booth: j }, o); };
function goUp() { const s = S.sel; if (s.level === "booth") goDiv(s.div); else if (s.level === "div") goState(s.st); else if (s.level === "state") goAus(); }

function renderFilterPill() {
  const el = $("#filterpill"), m = M();
  const on = filtersOn() || (S.f.range && S.f.range.unit === "booths");
  if (!on || S.view === "list" || !m) { el.hidden = true; return; }
  const n = m.divs.filter((d) => passes(m, d.i)).length;
  const w = filterWords(m);
  el.innerHTML = `<span>${S.f.range && S.f.range.unit === "booths" ? "Places" : `<b>${n}</b> ${plural(n, "seat")}`}: ${esc(w.join(" · "))}</span><button type="button" data-clear>Clear</button>`;
  el.hidden = false;
}
function filtersChanged() {
  renderFilterPill(); renderStory(true); if (S.view === "list") renderList(); schedule(); paintMiniChamber(); writeURL();
}
function updateHint() {
  const el = $("#hint"); if (!el) return;
  const show = S.view === "map" && selDiv() == null && T.k < K_ALL && !!M();
  el.textContent = show ? "Zoom in, or choose a seat, to see its polling places" : "";
  el.style.opacity = show ? "1" : "0";
  $("#cities").hidden = S.view !== "map" || selDiv() != null || T.k > HOME.k * 3;
}

/* =============================== search =============================== */
let sugg = [], suggAt = -1;
function runSearch() {
  const m = M(), el = $("#sugg"), q = S.q.trim();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of m.search.items) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], div: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" ? 6 : 4)) g.push(it); }
  sugg = [...groups.state, ...groups.div, ...groups.mp, ...groups.cand, ...groups.booth];
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", div: "Seats", mp: isNow() ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of ["state", "div", "mp", "cand", "booth"]) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : colCss(m.divCol[it.i]);
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw" style="background:${color}"></i><span class="t">${esc(it.t)}</span><span class="s">${esc(it.s)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">No seat, member or place matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  const view = it.k === "booth" && S.view === "chamber" ? "map" : undefined;
  if (it.k === "state") goState(it.st, { view });
  else if (it.k === "div" || it.k === "mp" || it.k === "cand") goDiv(it.i, { view });
  else goBooth(it.j, { view });
}

/* =============================== views, lenses, years =============================== */
function setView(v, quiet) {
  if (v === S.view) return;
  const prev = S.view;
  S.view = v;
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#cities", "#zoomer", "#hint"]) $(id).hidden = v !== "map";
  canvas.style.visibility = list ? "hidden" : "visible";
  canvas.classList.toggle("grab", v === "map");
  hideTip(); S.hover = null;
  if (list) { $("#sugg").hidden = true; renderList(); }
  else {
    if ((prev === "map" && v === "chamber") || (prev === "chamber" && v === "map")) morph = reduceMotion ? null : { t0: performance.now(), dur: 1000, to: v };
    if (v === "map" && prev === "list") fitSelection(0);
  }
  renderLegend(); renderFilterPill(); updateHint(); writeURL();
  if (!quiet) renderStory(true);
  schedule();
}
function setLens(id) {
  if (S.lens === id) return;
  S.lens = id; S.sort = null; S.dist = null;
  if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lens === id)));
  startChamberGlide();
  recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
}
function lensParamChanged() {
  S.sort = null; if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
}
let yearFade = null;
async function setYear(y) {
  if (y === S.year) return;
  const from = S.year, a = M();
  $("#loading").hidden = false; $("#loading").textContent = `Loading ${yearLabel(y)}`;
  try { await loadYear(y); } catch (e) { $("#loading").textContent = "That election didn’t load. Try again."; return; }
  $("#loading").hidden = true;
  const b = Y[y];
  // carry the selection across by seat name and polling-place ID
  const s = S.sel;
  if ((s.level === "div" || s.level === "booth") && a) {
    const ni = b.byName.get(a.divs[s.div].n);
    if (ni == null) S.sel = { level: "state", st: s.st };
    else if (s.level === "booth") { const id = a.booth.id[s.booth]; const nj = b.booth.byDiv[ni].find((j) => b.booth.id[j] === id); S.sel = nj != null ? { level: "booth", st: s.st, div: ni, booth: nj } : { level: "div", st: s.st, div: ni }; }
    else S.sel = { level: "div", st: s.st, div: ni };
  }
  startChamberGlide();
  S.year = y;
  recolor(false);
  if (S.view === "map") yearFade = reduceMotion ? null : { from, t0: performance.now(), dur: 520 };
  setExtent();
  renderTimeline(); renderLegend(); renderStory(true); renderFilterPill(); writeURL();
  $("#mp-meta").textContent = metaLine();
  if (S.view === "list") renderList(true);
  schedule();
}
function metaLine() {
  const m = M(); if (!m) return "";
  return m.year === "now" ? `The House as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} seats · ${m.booth.n.toLocaleString("en-AU")} polling places`;
}

/* =============================== the frame =============================== */
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(ts) {
  raf = 0;
  const m = M(); const th = TH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, Wpx, Hpx);
  if (!m) return;
  let again = false;
  fadeT = 1;
  if (fade) { fadeT = clamp((ts - fade.t0) / fade.dur, 0, 1); if (fadeT < 1) again = true; else { fade = null; for (const y of Object.values(Y)) { y.prevDivCol = y.prevBoothCol = null; } } }
  let yf = 1;
  if (yearFade) { yf = ease(clamp((ts - yearFade.t0) / yearFade.dur, 0, 1)); if (yf < 1) again = true; else yearFade = null; }
  if (morph) {
    const t = clamp((ts - morph.t0) / morph.dur, 0, 1);
    drawMorph(m, morph.to === "chamber" ? t : 1 - t);
    if (t < 1) again = true; else { morph = null; again = true; }
  } else if (S.view === "map") {
    if (yearFade && Y[yearFade.from] && Y[yearFade.from].divs) drawGeo(Y[yearFade.from], 1 - yf);
    drawGeo(m, yearFade ? yf : 1, streetK());
    drawFocus(m); drawBooths(m); drawLabels(m);
  } else if (S.view === "chamber") {
    drawChamberMain(m, 1);
  }
  showCredit(!morph && S.view === "map" && streetK() > 0.02);
  if (miniCh.canvas && (fade || chAnim || again || miniCh.dirty)) { paintMiniChamber(); miniCh.dirty = false; }
  if (needFrame) { again = true; needFrame = false; }
  if (again) schedule();
  void th;
}
function resize() {
  const r = $("#stage").getBoundingClientRect();
  if (!r.width || !r.height) return;
  const first = !Wpx;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const changed = Math.abs(Wpx - r.width) > 0.5 || Math.abs(Hpx - r.height) > 0.5;
  // only the height moved (the key above the stage grew or shrank): a view the page framed
  // glides to the new fit; one the reader has moved keeps its zoom, centred as before
  const dh = r.height - Hpx, keyOnly = !first && Math.abs(Wpx - r.width) <= 0.5 && changed && S.view === "map";
  const moved = keyOnly && !atLastFit();
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (first || changed) fitSelection(keyOnly && !reduceMotion ? 320 : 0);
  }
  renderTimeline();
  schedule();
}

/* =============================== the URL =============================== */
let urlReady = false;
function writeURL() {
  if (!urlReady) return;
  const m = M(), p = new URLSearchParams();
  if (S.year !== "now") p.set("y", S.year);
  if (S.lens !== "winner") p.set("l", S.lens);
  if (S.lens === "tpp" && S.tppMode === "swing") p.set("m", "swing");
  if (S.lens === "fp") { p.set("p", S.party); if (S.fpMode === "change") p.set("m", "change"); }
  if (S.lens === "flow") p.set("p", S.from);
  if (S.lens === "seifa") { p.set("i", S.index); if (S.basis === "voters") p.set("b", "voters"); }
  if (S.view !== "map") p.set("v", S.view);
  if (m) {
    const s = S.sel;
    if (s.level === "state") p.set("s", s.st);
    else if (s.level === "div") p.set("s", m.divs[s.div].n);
    else if (s.level === "booth") p.set("s", m.divs[s.div].n + "/" + m.booth.id[s.booth]);
  }
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const y = p.get("y"); if (y && YEARS.includes(+y)) S.year = +y;
  const l = p.get("l"); if (l && LENSES.some((x) => x.id === l)) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change";
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else S.party = pp; }
  const i = p.get("i"); if (i && (IX.includes(i) || DM.includes(i))) S.index = i;
  if (p.get("b") === "voters") S.basis = "voters";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  return p.get("s");
}
function applySelFromURL(sv) {
  const m = M(); if (!m || !sv) return false;
  if (STATES.includes(sv)) { goState(sv, { fly: false }); return true; }
  const [dn, bid] = sv.split("/");
  const i = m.byName.get(dn); if (i == null) return false;
  if (bid) { const j = m.booth.byDiv[i].find((x) => String(m.booth.id[x]) === bid); if (j != null) { goBooth(j, { fly: false }); return true; } }
  goDiv(i, { fly: false }); return true;
}

/* =============================== events =============================== */
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons || e.pointerType === "touch") return;
  const r = canvas.getBoundingClientRect();
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  const same = (h && S.hover && h.kind === S.hover.kind && h.i === S.hover.i) || (!h && !S.hover);
  if (!same) { S.hover = h; schedule(); }
  if (h) showTipAt(tipFor(h), e.clientX, e.clientY); else hideTip();
  canvas.style.cursor = h ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => { S.hover = null; hideTip(); schedule(); });
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (!h) { if (S.sel.level !== "aus" && S.view === "map" && T.k < HOME.k * 1.4) goAus(); return; }
  if (h.kind === "booth") goBooth(h.i);
  else goDiv(h.i, { fly: S.view === "map" });
});
// the small chamber in the story
$("#story").addEventListener("pointermove", (e) => {
  const c = e.target.closest("#minich");
  if (!c) { if (miniCh.hover != null) { miniCh.hover = null; miniCh.dirty = true; S.hover = null; hideTip(); schedule(); } return; }
  const r = c.getBoundingClientRect(), i = miniHit(e.clientX - r.left, e.clientY - r.top);
  if (i !== miniCh.hover) { miniCh.hover = i; miniCh.dirty = true; S.hover = i == null ? null : { kind: "div", i }; schedule(); }
  if (i != null) showTipAt(tipFor({ kind: "div", i }), e.clientX, e.clientY); else hideTip();
  c.style.cursor = i != null ? "pointer" : "";
});
$("#story").addEventListener("click", (e) => {
  const c = e.target.closest("#minich");
  if (c) { const r = c.getBoundingClientRect(), i = miniHit(e.clientX - r.left, e.clientY - r.top); if (i != null) goDiv(i); return; }
  const g = e.target.closest("g[data-year]"); if (g) { setYear(g.dataset.year === "now" ? "now" : +g.dataset.year); }
});
$("#time").addEventListener("click", (e) => { const g = e.target.closest("[data-year]"); if (g) setYear(g.dataset.year === "now" ? "now" : +g.dataset.year); });
// a stop under the pointer starts loading its election, so the click finds it ready
$("#time").addEventListener("pointerover", (e) => { const g = e.target.closest("[data-year]"); if (g) { const y = g.dataset.year === "now" ? "now" : +g.dataset.year; if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120); } });
document.addEventListener("click", (e) => {
  const city = e.target.closest("[data-city]");
  if (city) { flyToCity(+city.dataset.city); return; }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip]");
  if (!t) { if (!e.target.closest(".mp-search")) $("#sugg").hidden = true; return; }
  const m = M();
  if (t.dataset.n != null && t.closest("#sugg")) { chooseSugg(+t.dataset.n); return; }
  if (t.dataset.go != null) {
    const [k, ...rest] = t.dataset.go.split(":"); const v = rest.join(":");
    if (k === "aus") goAus(); else if (k === "state") goState(v); else if (k === "div") goDiv(+v, { fly: S.view === "map" }); else if (k === "booth") goBooth(+v, { view: S.view === "chamber" ? "map" : undefined });
    else if (k === "divname") { const i = m.byName.get(v); if (i != null) goDiv(i, { fly: S.view === "map" }); }
    return;
  }
  if (t.dataset.lens) { setLens(t.dataset.lens); return; }
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
  if (t.dataset.dist) { S.dist = S.dist === t.dataset.dist ? null : t.dataset.dist; renderList(true); return; }
  if (t.hasAttribute("data-distclose")) { S.dist = null; renderList(true); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; const cur = S.sort && S.sort.key === k ? S.sort : null; const col = listCache && listCache.cols.find((c) => c.key === k); S.sort = { key: k, dir: cur ? -cur.dir : col && !col.num ? 1 : -1 }; renderList(true); return; }
  if (t.dataset.unit) { S.listUnit = t.dataset.unit; S.sort = null; S.dist = S.dist; if (S.f.range && S.f.range.unit !== S.listUnit) S.f.range = null; renderList(); renderFilterPill(); schedule(); return; }
  if (t.hasAttribute("data-unseat")) { goState(S.sel.st); return; }
  if (t.hasAttribute("data-unrange")) { S.f.range = null; filtersChanged(); return; }
  if (t.hasAttribute("data-listbooths")) { S.listUnit = "booths"; S.sort = null; if (S.f.range && S.f.range.unit !== "booths") S.f.range = null; setView("list"); return; }
  if (t.hasAttribute("data-showmap")) { setView("map"); fitSelection(700); return; }
  if (t.hasAttribute("data-more")) { $$("[data-extra]", t.parentElement).forEach((r) => (r.hidden = false)); t.remove(); return; }
  if (t.hasAttribute("data-clear")) { S.f = { st: null, cls: null, win: null, margin: null, range: null }; filtersChanged(); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.opt) {
    const k = t.dataset.opt;
    if (k === "party") S.party = t.value; else if (k === "from") S.from = t.value; else if (k === "index") S.index = t.value; else if (k === "basis") S.basis = t.value;
    lensParamChanged(); return;
  }
  if (t.dataset.fsel) { S.f[t.dataset.fsel] = t.value || null; filtersChanged(); return; }
});
document.addEventListener("keydown", (e) => {
  const sp = e.target.closest && e.target.closest(".ls-spark");
  if (sp && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); sp.click(); }
});
const q = $("#q");
q.addEventListener("input", () => { S.q = q.value; runSearch(); });
q.addEventListener("keydown", (e) => {
  const el = $("#sugg");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (el.hidden || !sugg.length) return; e.preventDefault(); suggAt = (suggAt + (e.key === "ArrowDown" ? 1 : -1) + sugg.length) % sugg.length; $$("button", el).forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.n === suggAt))); $(`button[data-n="${suggAt}"]`, el)?.scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { if (S.view !== "list" && suggAt >= 0) { e.preventDefault(); chooseSugg(suggAt); } }
  else if (e.key === "Escape") { el.hidden = true; q.blur(); }
});
q.addEventListener("focus", () => { if (S.q.trim().length >= 2 && S.view !== "list") runSearch(); });
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (e.key === "/" && !typing) { e.preventDefault(); q.focus({ preventScroll: true }); q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") goUp();
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const k = YEARS.indexOf(S.year) + (e.key === "ArrowRight" ? 1 : -1); if (YEARS[k] != null) { e.preventDefault(); setYear(YEARS[k]); } }
});
$("#zin").addEventListener("click", () => zoomBy(1.8));
$("#zout").addEventListener("click", () => zoomBy(1 / 1.8));
$("#zhome").addEventListener("click", () => goAus());
function themeChanged() {
  TH = readTheme(); buildRamps(); hatchCanvas = null; recolor(false); renderLegend(); renderStory(true); renderTimeline();
  if (S.view === "list") renderList(true);
  schedule();
}
// the site's theme switch sets sh-light / sh-dark on <html> (site-shell.js); "auto" follows the system
new MutationObserver(() => { if (TH && TH.dark !== isDark()) themeChanged(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (TH && TH.dark !== isDark()) themeChanged(); });
new ResizeObserver(() => resize()).observe($("#stage"));
new ResizeObserver(() => { renderTimeline(); }).observe($("#time"));
let storyW = 0;
new ResizeObserver((es) => { const w = es[0].contentRect.width; if (Math.abs(w - storyW) > 1) { storyW = w; paintMiniChamber(); hydrateDists(); } }).observe($("#story"));

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  $("#cities").innerHTML = CITIES.map(([n], k) => `<button type="button" data-city="${k}">${n}</button>`).join("");
  getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); }).catch(() => {});
  try { await loadYear(S.year); } catch (err) { $("#loading").textContent = "The map’s data didn’t load. Reload the page to try again."; return; }
  $("#loading").hidden = true;
  $("#mp-meta").textContent = metaLine();
  recolor(false);
  resize();
  const view = S.view; S.view = "map"; if (view !== "map") setView(view, true);
  $("#view").classList.toggle("v-chamber", S.view === "chamber");
  if (!applySelFromURL(selFromURL)) goAus({ fly: false });
  fitSelection(0);
  urlReady = true; writeURL();
  renderLegend(); updateHint(); renderTimeline();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); });
  window.__map = { S, Y, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get HOME() { return HOME; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); } };
})();

})();
