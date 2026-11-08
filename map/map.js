/* the Electoral map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */
(() => {
"use strict";
/* =============================== helpers =============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* display text: the data canonically stores a straight apostrophe (O'Connor);
   the page sets names with a curly one. ds is esc + curly for HTML slots,
   dn the curly pass alone for canvas labels (O'Connor, O'Sullivan booths) */
const ds = (s) => esc(String(s).replace(/'/g, "’"));
const dn = (s) => String(s).replace(/'/g, "’");
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
/* the full-screen view's state (app-7-full.js), here so every part reads it from the start:
   on, and the room its plates take at each edge of the stage (ins, stage px), which the
   map's and the chamber's framing keep clear; move is resize()'s one-shot camera for the
   step into or out of it */
const FS = { on: false, ins: { t: 0, r: 0, b: 0, l: 0 }, move: null };
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one"];
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
// (the retro view keeps the light paper whatever the theme: the era had no dark mode)
const isDark = () => { const r = document.documentElement; if (r.classList.contains("mp-retro")) return false; return r.classList.contains("sh-dark") || (!r.classList.contains("sh-light") && matchMedia("(prefers-color-scheme: dark)").matches); };
function readTheme() {
  const dk = isDark();
  // oklch tokens come back from getComputedStyle as oklch(); compute them here instead
  const L = dk
    ? { bg: [0.205, 0.010, 65], surface: [0.235, 0.010, 65], ink: [0.940, 0.008, 80], ink2: [0.800, 0.009, 78], ink3: [0.670, 0.009, 72], faint: [0.545, 0.009, 68], line: [0.355, 0.011, 66], line2: [0.312, 0.010, 66] }
    : { bg: [0.975, 0.009, 80], surface: [0.992, 0.004, 85], ink: [0.27, 0.012, 55], ink2: [0.44, 0.012, 55], ink3: [0.52, 0.010, 58], faint: [0.70, 0.008, 65], line: [0.895, 0.008, 75], line2: [0.935, 0.006, 78] };
  const T = {};
  for (const k in L) T[k] = lch(...L[k]);
  const P = dk
    // bright, poster-flat party colours (Labor and the Coalition are theoelections.com's
    // red and blue); One Nation a clear orange off Labor's red, everyone else neutral grey
    ? { alp: "#f7310a", lnp: "#1432d5", grn: "#22c35a", onp: "#ff9500", ind: "#b07ee0", csa: "#00c2e0", oth: "#7d7d7d", nxt: "#ff9500", dem: "#1fc7b4" }
    : { alp: "#f7310a", lnp: "#1432d5", grn: "#14ad4a", onp: "#ff8c00", ind: "#9b62d0", csa: "#00a9c4", oth: "#9a9a9a", nxt: "#ff8c00", dem: "#00a08f" };
  T.party = {}; for (const k in P) T.party[k] = hex(P[k]);
  T.dark = dk;
  T.mid = dk ? lch(0.36, 0.008, 66) : lch(0.905, 0.006, 78);
  T.nodata = dk ? lch(0.265, 0.008, 65) : lch(0.935, 0.005, 78);
  T.hatch = dk ? lch(0.39, 0.010, 66) : lch(0.80, 0.008, 70);
  // seat borders: a thin white hairline over the fills (as theoelections.com draws them),
  // half see-through on dark paper; the state lines the same white, a touch heavier
  T.seam = [255, 255, 255]; T.seamA = dk ? 0.5 : 0.85; T.stateA = dk ? 0.85 : 1;
  T.coast = dk ? lch(0.62, 0.010, 70) : lch(0.56, 0.010, 62);
  T.state = dk ? lch(0.88, 0.009, 78) : lch(0.30, 0.012, 55);
  T.veil = dk ? 0.66 : 0.6;
  T.seqL = dk ? [0.29, 0.88] : [0.955, 0.33];
  // seat types walk the outback ramp: city cream out to red earth — one ladder for both themes
  T.cls = [lch(0.88, 0.030, 78), lch(0.70, 0.048, 62), lch(0.53, 0.060, 48), lch(0.38, 0.075, 38)];
  T.floor = dk ? lch(0.235, 0.012, 150) : lch(0.958, 0.012, 150);
  // the atlas's sea under the seats (app-2-map.js, "the ocean"): pale blue paper, its
  // lines of latitude and longitude a faint deeper blue, their degrees deeper, its waters'
  // names deeper still
  T.sea = dk ? lch(0.255, 0.026, 242) : lch(0.945, 0.024, 230);
  T.seaLine = dk ? lch(0.335, 0.034, 240) : lch(0.85, 0.04, 236);
  T.seaMark = dk ? lch(0.6, 0.04, 238) : lch(0.6, 0.06, 240);
  T.seaInk = dk ? lch(0.7, 0.06, 236) : lch(0.5, 0.085, 246);
  // the retro view's flat palette over these (app-8-retro.js)
  if (typeof retroTheme === "function" && typeof rtIsOn === "function" && rtIsOn()) retroTheme(T);
  return T;
}

// the seat hairline's screen width: thin at the whole map, a little firmer zoomed in
const seamW = k => Math.min(0.9, 0.45 + k * 0.12);

/* ramps: 101-step sequential lookups and 201-step diverging (index 0..200, mid 100) */
let RAMP = {};
function buildRamps() {
  const th = TH;
  // chroma climbs fast and peaks past the middle of the ramp, then eases off into the deep end, so a
  // hue reads as that hue well before it reads as dark (lab2rgb trims whatever the gamut can't hold)
  const seq = (H, Cmax) => { const [L0, L1] = th.seqL; const t = []; for (let i = 0; i <= 100; i++) { const u = i / 100; t.push(lch(lerp(L0, L1, u), u < 0.6 ? lerp(0.014, Cmax * 1.45, u / 0.6) : lerp(Cmax * 1.45, Cmax, (u - 0.6) / 0.4), H)); } return t; };
  // a party's path: paper, its own poster colour, then its deepest shade (t runs 0..1 along it)
  const FP_AT = 0.6;
  const fpPath = (fam) => {
    const P = rgb2lab(th.party[fam]), D = rgb2lab(lch(...FP_DEEP[th.dark ? "dark" : "light"][fam])), A = rgb2lab(lch(th.seqL[0], 0.014, (Math.atan2(P[2], P[1]) * 180) / Math.PI));
    return (t) => lab2rgb(t < FP_AT ? [0, 1, 2].map((k) => lerp(A[k], P[k], t / FP_AT)) : [0, 1, 2].map((k) => lerp(P[k], D[k], (t - FP_AT) / (1 - FP_AT))));
  };
  // the share ramp is indexed by value (index = v / FPMAX, as ever), so bending it here carries to every
  // reader at once: map, booths, chamber, list, legend and its bars. The party's own colour lands on
  // FPKNEE, a strong result for that party, which spends the ramp on the range seats actually fill
  const fpShare = (fam) => { const path = fpPath(fam), k = FPKNEE[fam], hi = FPMAX[fam], t = []; for (let i = 0; i <= 100; i++) { const v = (i / 100) * hi; t.push(path(v <= k ? (FP_AT * v) / k : FP_AT + ((1 - FP_AT) * (v - k)) / (hi - k))); } return t; };
  // the same path evenly spaced, for a gain: a change has no typical range to bend towards
  const fpEven = (fam) => { const path = fpPath(fam), t = []; for (let i = 0; i <= 100; i++) t.push(path(i / 100)); return t; };
  const div = (neg, mid, pos) => { const N = rgb2lab(neg), M = rgb2lab(mid), P = rgb2lab(pos); const t = []; for (let i = -100; i <= 100; i++) { const u = Math.pow(Math.abs(i) / 100, 0.85); const E = i < 0 ? N : P; t.push(lab2rgb([lerp(M[0], E[0], u), lerp(M[1], E[1], u), lerp(M[2], E[2], u)])); } return t; };
  const deepen = (c, dL) => { const l = rgb2lab(c); return lab2rgb([l[0] + dL, l[1] * 1.04, l[2] * 1.04]); };
  const dk = th.dark;
  RAMP = {
    // Labor at the low end of the index and the Coalition at the high end: the
    // site's own reading order ("◀ Labor ahead … Coalition ahead ▶")
    div: div(deepen(th.party.alp, dk ? 0.03 : -0.06), th.mid, deepen(th.party.lnp, dk ? 0.03 : -0.06)),
    // Labor against One Nation, for preferences split between the two
    divOn: div(deepen(th.party.alp, dk ? 0.03 : -0.06), th.mid, deepen(th.party.onp, dk ? 0.03 : -0.06)),
    // the Coalition against One Nation, for the Senate preferences lens
    divCo: div(deepen(th.party.lnp, dk ? 0.03 : -0.06), th.mid, deepen(th.party.onp, dk ? 0.03 : -0.06)),
    // the Greens' own pairings in the two-party lens: against One Nation, Labor and the Coalition
    divGo: div(deepen(th.party.grn, dk ? 0.03 : -0.06), th.mid, deepen(th.party.onp, dk ? 0.03 : -0.06)),
    divGa: div(deepen(th.party.grn, dk ? 0.03 : -0.06), th.mid, deepen(th.party.alp, dk ? 0.03 : -0.06)),
    divGc: div(deepen(th.party.grn, dk ? 0.03 : -0.06), th.mid, deepen(th.party.lnp, dk ? 0.03 : -0.06)),
    fp: Object.fromEntries(FAMS.map((f) => [f, fpShare(f)])),
    gain: Object.fromEntries(FAMS.map((f) => [f, fpEven(f)])),
    inf: seq(345, 0.13),
    // a party's losses: paper to a warm grey, so a fall never borrows another party's colour
    loss: seq(70, 0.025),
    seifa: seq(292, 0.15),
    // the census people measures, a hue each so a change of measure reads as one
    demo: { lang: seq(235, 0.12), a65: seq(62, 0.13), a2034: seq(150, 0.12), fborn: seq(195, 0.12), uni: seq(100, 0.12), blue: seq(36, 0.13),
      loinc: seq(20, 0.13), hiqinc: seq(275, 0.12), incmed: seq(48, 0.14),
      agemed: seq(86, 0.14), a1824: seq(185, 0.13), a3554: seq(128, 0.14), a75: seq(26, 0.14),
      y12less: seq(115, 0.12), atsci: seq(322, 0.12), u15: seq(175, 0.12), onepar: seq(220, 0.12),
      pt: seq(330, 0.13), noncit: seq(300, 0.13), bigfam: seq(142, 0.12), hl: seq(310, 0.08),
      rel: seq(88, 0.12), ten: seq(258, 0.12), anc: seq(228, 0.10) },
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
// a family's name in the legend's words: a state frame's opposition is the Liberals
const famLeg = (f) => (f === "lnp" && STATE_YEARS.has(S.year) ? "Liberals" : FAM_LEG[f]);
/* the parties as compact column-head codes (the list table's lens header) */
const FAM_CODE = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", ind: "IND", csa: "CS", oth: "OTH" };
// the same codes on the seat tallies, the frame's own name for the right: LIB where the state has
// no Coalition (SA, Victoria, WA say Liberals, as coalW does), LNP in Queensland
const famTag = (f) => (f !== "lnp" || !STATE_YEARS.has(S.year) ? FAM_CODE[f] : QLD_YEARS.has(S.year) ? "LNP" : NSW_YEARS.has(S.year) ? "L/NP" : "LIB");
// the ECSA's own codes ride the same rails: LIB is the Coalition, ONP One Nation
const FAM = (ab) => (ab === "ALP" ? "alp" : ["LP", "LNP", "NP", "CLP", "NAT", "NATS", "LNQ", "LIB"].includes(ab) ? "lnp" : ["GRN", "GWA", "TG", "GVIC", "AGV", "GA", "QG", "CCG", "ESG", "GDA", "GLO", "GSA", "RCG", "VGA", "WSG"].includes(ab) ? "grn" : ab === "ON" || ab === "HAN" || ab === "ONP" ? "onp" : ab === "IND" || ab === "" || ab === "NAFD" || ab === "CSA" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", LIB: "Liberal", LNP: "Liberal National", LNQ: "Liberal National", NP: "Nationals", NAT: "Nationals", NATS: "Nationals", CLP: "Country Liberal", GRN: "Greens", GA: "Greens", GWA: "Greens (WA)", TG: "Tasmanian Greens", GVIC: "Victorian Greens", AD: "Democrats", IND: "Independent", NAFD: "Independent", ON: "One Nation", ONP: "One Nation", HAN: "One Nation", KAP: "Katter’s Australian", PUP: "Palmer United", UAPP: "United Australia", LDP: "Liberal Democrats", AJP: "Animal Justice", CYA: "Trumpet of Patriots", FFP: "Family First", FFPA: "Family First", LTP: "Libertarian", HMP: "Legalise Cannabis", GRPF: "People First", SAL: "Socialist Alliance", VNS: "Victorian Socialists", ASP: "Shooters, Fishers and Farmers", AUC: "Australian Christians", CEC: "Citizens Party", IMO: "HEART", SOPA: "FUSION", AUD: "Australian Democrats", DEM: "Democrats", GAP: "Great Australian", IAP: "Indigenous-Aboriginal", JLN: "Jacqui Lambie Network", TNL: "TNL", SPP: "Sustainable Australia", DHJP: "Justice Party", AUVA: "Australian Values", WAP: "Western Australia Party", AUP: "Australian Progressives", TLOC: "The Local Party", DPDA: "Democratic Alliance", CA: "Centre Alliance", AMEP: "Motoring Enthusiast", AC: "Australian Conservatives", APA: "Progressive Alliance", GLT: "Glenn Lazarus Team", AV: "Australia’s Voice", REAS: "Reason", CDP: "Christian Democrats", CSA: "Community Strong", RUA: "Rise Up Australia", SEP: "Socialist Equality", DLP: "Democratic Labour", FACN: "Fraser Anning’s Conservative Nationals", NGST: "No GST", SPA: "Secular Party", AFN: "Australia First", BTA: "Bullet Train for Australia" };
const partyName = (ab, pn) => (ab === "XEN" ? (pn && /xenophon/i.test(pn) ? "Nick Xenophon Team" : "Centre Alliance") : PARTY[ab] || (pn ? pn.replace(/^The /, "") : "") || ab || "Independent");
// a party as a sentence names it: "won Kooyong from the Liberals"
const THE = { Liberal: "the Liberals", Nationals: "the Nationals", Greens: "the Greens", "Liberal National": "the LNP", "Country Liberal": "the Country Liberals", Independent: "an independent", "Liberal Democrats": "the Liberal Democrats", Democrats: "the Democrats", "Palmer United": "Palmer United", "Nick Xenophon Team": "the Nick Xenophon Team", "Jacqui Lambie Network": "the Jacqui Lambie Network", "Australian Democrats": "the Democrats", "Family First": "Family First", "Democratic Labour": "the DLP", "Palmer United": "Palmer United", "Motoring Enthusiast": "the Motoring Enthusiast Party", "Australian Conservatives": "the Australian Conservatives", "Progressive Alliance": "the Progressive Alliance" };
const theParty = (ab, pn) => { const n = partyName(ab, pn); return THE[n] || n; };
// whose: "One Nation’s preferences", "the Greens’ primary vote"
const POSS = { alp: "Labor’s", lnp: "the Coalition’s", grn: "the Greens’", onp: "One Nation’s", ind: "independents’", oth: "other candidates’" };
const Poss = (f) => POSS[f][0].toUpperCase() + POSS[f].slice(1);
const ORDW = ["", "", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordw = (n) => ORDW[n] || ord(n);
const partyShort = (ab, pn) => { const n = partyName(ab, pn); return { "Liberal National": "LNP", "Katter’s Australian": "Katter", "Shooters, Fishers and Farmers": "Shooters", "Country Liberal": "CLP", "Jacqui Lambie Network": "Lambie Network" }[n] || n; };
const CLS = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const CLS_SHORT = { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro", Provincial: "Provincial", Rural: "Rural" };
const CLS_LOWER = { "Inner Metropolitan": "inner-metropolitan", "Outer Metropolitan": "outer-metropolitan", Provincial: "provincial", Rural: "rural" };
const CLS_DEF = { "Inner Metropolitan": "Settled, well-established suburbs of a capital city", "Outer Metropolitan": "Newer, growing suburbs on a capital city’s edge", Provincial: "Centred on a large regional city", Rural: "No major city: small towns and farming country" };
const IX = ["irsad", "irsd", "ier", "ieo"];
const IX_NAME = { irsad: "Advantage and disadvantage", irsd: "Disadvantage", ier: "Economic resources", ieo: "Education and occupation" };
const IX_ABBR = { irsad: "IRSAD", irsd: "IRSD", ier: "IER", ieo: "IEO" };
// the Advantage menu offers only the indexes its frame's print actually
// scores (IRSAD debuts in the 2001-census four-index suite)
const ixFor = (m) => IX.filter((k) => !m.hasIx || m.hasIx[k] !== false);
// how far back a vote family's lane reaches: One Nation's first federal
// vote figures are the 1998 election (its April 1997 formation posts no
// '90s figures), so no frame older than 1998 offers the family; the
// state frames all sit after its era. The menu omits whatever the era
// never ran a candidate in — the swap fallback below lands the same way
const FAM_FORMED = { onp: 1998 };
const famEraOpts = (m) => FAMS.filter((f) => !(FAM_FORMED[f] && Number.isFinite(+m.year) && +m.year < FAM_FORMED[f]));
// the census tab's people measures: shares of residents (the income
// shares are shares of an area's ADULTS — one menu entry, "inc", whose
// own picker reads the median or the two shares), from the 2021 census counted
// where each polling place's voters live (the AEC records that from
// 2016 on); 2007–2013 read the census of the areas the places stand in
// (the 2006 census at 2007 and 2010, the 2011 census at 2013). The
// 2026-10-31 arc adds pt (public transport's commuting share of workers),
// noncit (residents the census did NOT count as Australian citizens),
// bigfam (women with three or more children ever born, per women 15+),
// and hl (the ABS Estimating-homelessness SA2 estimates' share of
// residents — a census-area-group measure, coarser than the SA1 lanes')
// DM's order is POSITIONAL against the booth demo cell tuple, so the
// folded-away pairs (income shares, age bands, schooling reads) keep their
// slots here; the menu folds each pair into one entry via DM_MENU below
const DM = ["lang", "a65", "a2034", "fborn", "uni", "blue", "loinc", "hiinc", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "hl", "hiqinc"];
// the Household-income lens lane id: its block sits below with the other
// select lenses — declared early because the menu fold needs it
const LENS_INC = "inc";
// the Age lens lane id, beside its sibling merge — also menu-folded
const LENS_AGE = "age";
// the Education lens lane id, the day's third menu fold of the shape
const LENS_EDU = "edu";
// the menu's People list: DM in order, the two income shares folded into
// the Household-income entry where loinc sat, the two age-band reads
// folded into the Age entry where a65 sat, the two schooling reads folded
// into the Education entry where uni sat
const DM_MENU = (() => { const ks = []; for (const k of DM) { if (k === "a65") { ks.push(LENS_AGE); continue; } if (k === "a2034") continue; if (k === "loinc") { ks.push(LENS_INC); continue; } if (k === "uni") { ks.push(LENS_EDU); continue; } if (k !== "hiinc" && k !== "y12less" && k !== "hiqinc") ks.push(k); } return ks; })();
const DM_NAME = { lang: "Language other than English at home", a65: "Aged 65 and over", a2034: "Aged 20 to 34", age: "Age", fborn: "Born overseas", uni: "University educated", edu: "Education", blue: "Blue-collar workers", inc: "Household income", loinc: "Adults in bottom household-income quarter", hiinc: "Adults in high-income households", hiqinc: "Adults in top household-income quarter", y12less: "Year 12 or less", atsci: "Indigenous Australians", u15: "Children under 15", onepar: "One-parent families", pt: "Public transport to work", noncit: "Non-citizens", bigfam: "More than two children", hl: "Homeless" };
const DM_SHORT = { lang: "Other language", a65: "Aged 65+", a2034: "Aged 20–34", age: "Age", fborn: "Born overseas", uni: "University", edu: "Education", blue: "Blue collar", inc: "Income", loinc: "Lower income", hiinc: "Higher income", hiqinc: "Top income quarter", y12less: "No Year 12", atsci: "Indigenous", u15: "Under 15", onepar: "One-parent", pt: "Public transport to work", noncit: "Non-citizens", bigfam: "3+ children", hl: "Homeless" };
const DM_VERB = { lang: "speak a language other than English at home", a65: "are aged 65 or over", a2034: "are aged 20 to 34", fborn: "were born overseas", uni: "hold a university qualification", blue: "work in a trade, drive machinery or do labouring work", y12less: "of people aged 15+ left schooling before Year 12", atsci: "identify as Aboriginal and/or Torres Strait Islander", u15: "are children under 15", onepar: "of families are one-parent families", pt: "of employed people travelled to work by public transport", noncit: "were not counted as Australian citizens", bigfam: "of women aged 15+ have had more than two children", hl: "were counted homeless in the ABS census estimate" };
const DM_RANGE = { lang: [0, 60], fborn: [0, 65], uni: [2, 55], blue: [9, 48], y12less: [10, 72], atsci: [0, 55], u15: [6, 28], onepar: [8, 30], pt: [0, 35], noncit: [0, 40], bigfam: [8, 45], hl: [0, 15] };
// the Religion and Housing-tenure select lenses: S.index is the menu
// ("rel"/"ten") and S.rel/S.ten the picked option; a lane share rides the
// division dicts (demo.rel/.ten), the parallel B rows, and the pooled
// areas demo dicts, positioning by the year's relKeys/tenKeys
const LENS_REL = "rel", LENS_TEN = "ten";
const REL_NAME = { norel: "No religion", cath: "Catholic", angl: "Anglican", unch: "Uniting Church", pres: "Presbyterian", orth: "Orthodox", budd: "Buddhist", isl: "Islamic", hind: "Hindu", jew: "Jewish" };
const RELISMS = { norel: "say they have no religion", cath: "are Catholic", angl: "are Anglican", unch: "are Uniting Church", pres: "are Presbyterian", orth: "are Orthodox Christian", budd: "are Buddhist", isl: "are Muslim", hind: "are Hindu", jew: "are Jewish" };
const TEN_NAME = { mort: "Owned with a mortgage", rent: "Rented", own: "Owned outright", rentPub: "Rented from public housing" };
const TENESMS = { mort: "are owned with a mortgage", rent: "are rented", own: "are owned outright", rentPub: "are rented from public housing" };
const REL_RANGE = { norel: [0, 65], cath: [0, 65], angl: [0, 50], unch: [0, 35], pres: [0, 20], orth: [0, 25], budd: [0, 25], isl: [0, 35], hind: [0, 25], jew: [0, 25] };
const TEN_RANGE = { mort: [0, 65], rent: [0, 70], own: [0, 60], rentPub: [0, 20] };
// the Ancestry select lens (the 2026-10-31 lanes arc): S.index === LENS_ANC
// and S.anc the picked option — the same clone shape as rel/ten (year's
// ancKeys; twelve options the menu records. The census lets people name
// up to two ancestries, so no share's un-share can be derived — the
// options are independent shares of residents, never a partition)
const LENS_ANC = "anc";
const ANC_NAME = { english: "English", australian: "Australian", irish: "Irish", scottish: "Scottish", chinese: "Chinese", italian: "Italian", german: "German", indian: "Indian", filipino: "Filipino", dutch: "Dutch", vietnamese: "Vietnamese", lebanese: "Lebanese" };
const ANCISMS = { english: "named English ancestry", australian: "named Australian ancestry", irish: "named Irish ancestry", scottish: "named Scottish ancestry", chinese: "named Chinese ancestry", italian: "named Italian ancestry", german: "named German ancestry", indian: "named Indian ancestry", filipino: "named Filipino ancestry", dutch: "named Dutch ancestry", vietnamese: "named Vietnamese ancestry", lebanese: "named Lebanese ancestry" };
const ANC_RANGE = { english: [0, 80], australian: [10, 75], irish: [0, 25], scottish: [0, 22], chinese: [0, 35], italian: [0, 25], german: [0, 18], indian: [0, 30], filipino: [0, 18], dutch: [0, 6], vietnamese: [0, 22], lebanese: [0, 35] };
const isDemo = () => DM.includes(S.index) || S.index === LENS_INC || S.index === LENS_AGE || S.index === LENS_EDU || S.index === LENS_REL || S.index === LENS_TEN || S.index === LENS_ANC;
// the Household-income lane: S.index === "inc" and S.incMode the picked
// measure — the median weekly household income spectrum lands by default;
// the bottom-quartile and top-quartile shares ride the same legend picker
// (loinc/hiqinc, each year's national 25th/75th-percentile cut computed
// inside the edition's closed bands — edition-comparable by construction,
// where the old edition-local top-band share hiinc was not; hiinc stays
// in the stores as the record's raw top-band measure only)
const INC_MODES = ["med", "lo", "hiq"];
const INC_NAME = { med: "Median household income", lo: "Adults in bottom household-income quarter", hiq: "Adults in top household-income quarter" };
const INC_SHORT = { med: "Median income", lo: "Lower income", hiq: "Top income quarter" };
const INC_RANGE = { lo: [10, 45], hiq: [8, 60] };
const INC_TOP = { med: ["seats where households earn the most", "where they earn the least"], lo: ["seats where the most adults live in lower-income households", "with the fewest"], hiq: ["seats where the most adults live in the top income quarter", "with the fewest"] };
const isInc = () => S.index === LENS_INC;
const incMed = () => isInc() && S.incMode === "med";
const mny = (v) => (v == null ? "–" : `$${int(Math.round(v))}`);
const incDollars = (m) => (m.incomeCuts && m.incomeCuts.dollarsYear ? ` in ${m.incomeCuts.dollarsYear} dollars` : "");
// an interpolated year's loinc cut can't name one dollar epoch: the
// share blends two census years' cuts, so the fragment names the range
// the blend spans; the epoch wordage comes from incEpoch, once
const incLoFrag = (m) => {
  const s = m.incomeCuts && m.incomeCuts.sides;
  if (m.demoInterp && s) {
    const cuts = Object.keys(s).sort().map((y) => s[y].loCutWeekly);
    return cuts[0] === cuts[1] ? `under ${mny(cuts[0])} a week` : `under ${mny(Math.min(...cuts))}–${mny(Math.max(...cuts))} a week`;
  }
  return `under ${mny(m.incomeCuts && m.incomeCuts.loCutWeekly)} a week`;
};
// the hiq lane's own fragment, the lo lane's idiom: for the quartile
// cut each year's record carries its edition's interpolation; blend
// years name the range their sides span
const incHiQFrag = (m) => {
  const s = m.incomeCuts && m.incomeCuts.sides;
  if (m.demoInterp && s) {
    const cuts = Object.keys(s).sort().map((y) => s[y].hiQCutWeekly);
    return cuts[0] === cuts[1] ? `${mny(cuts[0])} or more a week` : `${mny(Math.min(...cuts))}–${mny(Math.max(...cuts))} or more a week`;
  }
  return `${mny(m.incomeCuts && m.incomeCuts.hiQCutWeekly)} or more a week`;
};
const incEpoch = (m) => (m.demoInterp ? " in census-year dollars" : incDollars(m));
const INC_VERB = {
  lo: (m) => `live in households earning ${incLoFrag(m)}${incEpoch(m)}`,
  hiq: (m) => `live in households earning ${incHiQFrag(m)}${incEpoch(m)}`,
};
// the Age lens: S.index === "age" and S.ageMode the picked measure — the
// median-age spectrum lands; the two aged-band reads that were their own
// menu lanes (a65/a2034) and three new shares (18-24, 35-54, 75+) sit
// beside it in the same legend picker, riding the income lane's idiom
const AGE_MODES = ["med", "a1824", "a2034", "a3554", "a65", "a75"];
const AGE_NAME = { med: "Median age", a1824: "Aged 18 to 24", a2034: "Aged 20 to 34", a3554: "Aged 35 to 54", a65: "Aged 65 and over", a75: "Aged 75 and over" };
const AGE_SHORT = { med: "Median age", a1824: "18–24", a2034: "20–34", a3554: "35–54", a65: "65+", a75: "75+" };
const AGE_VERB = { a1824: "are aged 18 to 24", a2034: "are aged 20 to 34", a3554: "are aged 35 to 54", a65: "are aged 65 or over", a75: "are aged 75 or over" };
const AGE_RANGE = { a1824: [0, 28], a2034: [10, 40], a3554: [18, 45], a65: [5, 35], a75: [0, 35] };
const AGE_TOP = { med: ["seats with the oldest residents", "with the youngest"], a1824: ["seats where the most residents are aged 18 to 24", "with the fewest"], a2034: ["seats with the most residents aged 20 to 34", "with the fewest"], a3554: ["seats with the most residents aged 35 to 54", "with the fewest"], a65: ["seats with the most residents aged 65 and over", "with the fewest"], a75: ["seats with the most residents aged 75 and over", "with the fewest"] };
const AGE_KEY = { med: "ageMed", a1824: "a1824", a2034: "a2034", a3554: "a3554", a65: "a65", a75: "a75" };
const isAge = () => S.index === LENS_AGE;
const ageMed = () => isAge() && S.ageMode === "med";
// the national age marker per year rides ageCuts (median + the three new
// shares pool-computed by the build from the packed band dicts); frames
// without band dicts (the state frames' GCP lanes today) carry none
const hasAgeCuts = (m) => !!(m && m.ageCuts);
const dmVerbAge = (m) => (AGE_VERB[S.ageMode] || "");
// the Education lane: S.index === "edu" and S.eduMode the picked view —
// the two schooling reads (uni/y12less as their own menu lanes until
// 2026-10-31) ride the one menu entry the way the income shares ride
// Household income; University educated is the landing view. Each read
// keeps its own DM id for the dicts, ranges, ramps and top-of lists —
// EDU_* names only the lens's own menu, chip and note texts
const EDU_MODES = ["uni", "y12less"];
const EDU_NAME = { uni: "University educated", y12less: "Year 12 or less" };
const EDU_SHORT = { uni: "University", y12less: "No Year 12" };
const EDU_NOTE = { uni: "Share of people aged 15+ who hold a university qualification", y12less: "Share of people aged 15+ who left schooling before Year 12" };
const isEdu = () => S.index === LENS_EDU;
const dmVerb = (m, k) => (k === LENS_REL ? RELISMS[S.rel] : k === LENS_TEN ? TENESMS[S.ten] : k === LENS_ANC ? ANCISMS[S.anc] : k === "fborn" && S.cob != null ? COB_VERB[S.cob] : k === LENS_INC ? (INC_VERB[S.incMode] ? INC_VERB[S.incMode](m) : "") : k === LENS_AGE ? (AGE_VERB[S.ageMode] || "") : k === LENS_EDU ? DM_VERB[S.eduMode] : DM_VERB[k]);
// whose share a census measure is, and what it says of them: the bases the builders divide by
// (build_areas_sa1.py's SHARES and the state demo builders), so copy never sets a measure over
// the wrong people. Most measures are shares of residents; schooling and degrees are of people
// aged 15+, occupation and the journey to work of employed people, one-parent families of
// families, children ever born of women aged 15+, tenure of dwellings, and the income shares of
// adults (households, in the era prints that count households)
const DM_POP = { uni: "people aged 15+", y12less: "people aged 15+", blue: "employed people", pt: "employed people", onepar: "families", bigfam: "women aged 15+" };
const DM_PRED = { y12less: "left schooling before Year 12", onepar: "are one-parent families", pt: "travelled to work by public transport", bigfam: "have had more than two children" };
function censusWho(m, k = S.index) {
  let pop = "residents", pred;
  if (k === LENS_TEN) { pop = "dwellings"; pred = TENESMS[S.ten]; }
  else if (k === LENS_INC) {
    const hh = m && m.incomeCuts && m.incomeCuts.basis === "households", frag = S.incMode === "lo" ? incLoFrag(m) : incHiQFrag(m);
    pop = hh ? "households" : "adults"; pred = hh ? `earn ${frag}${incEpoch(m)}` : INC_VERB[S.incMode] ? INC_VERB[S.incMode](m) : "";
  } else {
    const key = k === LENS_EDU ? S.eduMode : k;
    pop = DM_POP[key] || "residents";
    pred = DM_PRED[key] || dmVerb(m, k);
  }
  const rel = pop === "dwellings" || pop === "families" || pop === "households" ? "that" : "who";
  return { pop, pred, rel, phrase: `${pop} ${rel} ${pred}` };
}
// a year carries the income lanes only when its demo store records the cuts
// (1991's household-basis print on the 1990s frames, 2001's on the GCP
// bases); other era-null People lanes filter the same way
const hasInc = (m) => !!(m && m.incomeCuts);
const DM_ALL = DM_MENU;
const dmFor = (m) => {
  let ks = hasInc(m) ? DM_ALL : DM_ALL.filter((k) => k !== LENS_INC);
  if (m && m.hasLane) ks = ks.filter((k) => m.hasLane[k] !== false);
  return ks;
};
// the birthplace-country sub-views of the Born overseas lane: when S.cob
// names a country the lens reads that country's share (the census's
// country-stated basis, the same as fborn) everywhere fborn would be
// read. Each year's menu is its own cobKeys (10 keys on 2021-census
// bases; 9 on the 2001 edition, whose B 06 prints a whole-UK row the
// menu leads with; 8 on the 2006/2011 editions — England and Scotland
// are 2016-onward only, every other era merging them inside a UK row
// or row-class). Range caps are measured
// just above each country's division maximum across the frames (booth
// tails saturate past the cap, the fborn lane's way)
const COB_NAME = { uk: "the United Kingdom", eng: "England", ind: "India", chn: "China", nzl: "New Zealand", phl: "Philippines", vnm: "Vietnam", zaf: "South Africa", ita: "Italy", lka: "Sri Lanka", sct: "Scotland" };
// the picker's "Born in …" labels (definite article where the name takes one)
const COB_BORN = { uk: "the United Kingdom", eng: "England", ind: "India", chn: "China", nzl: "New Zealand", phl: "the Philippines", vnm: "Vietnam", zaf: "South Africa", ita: "Italy", lka: "Sri Lanka", sct: "Scotland" };
const COB_VERB = { uk: "were born in the United Kingdom", eng: "were born in England", ind: "were born in India", chn: "were born in China", nzl: "were born in New Zealand", phl: "were born in the Philippines", vnm: "were born in Vietnam", zaf: "were born in South Africa", ita: "were born in Italy", lka: "were born in Sri Lanka", sct: "were born in Scotland" };
/* the country as a compact head stub ("Born in NZ"): alpha-3 codes, alpha-2
   where the short form is the natural one (NZ, the UK) */
const COB_SHORT = { uk: "the UK", eng: "ENG", ind: "IND", chn: "CHN", nzl: "NZ", phl: "PHL", vnm: "VNM", zaf: "ZAF", ita: "ITA", lka: "LKA", sct: "SCT" };
const COB_RANGE = { uk: [0, 25], eng: [0, 20], ind: [0, 25], chn: [0, 20], nzl: [0, 12], phl: [0, 12], vnm: [0, 25], zaf: [0, 7], ita: [0, 9], lka: [0, 7], sct: [0, 3] };
const isCob = () => S.index === "fborn" && S.cob != null;
const isRel = () => S.index === LENS_REL && S.rel != null;
const isTen = () => S.index === LENS_TEN && S.ten != null;
const isAnc = () => S.index === LENS_ANC && S.anc != null;
// the active people-lane figure of a division: a share as a fraction
// (cob-aware, religion/tenure select-aware), or the income view's datum —
// the median lane reads DOLLARS (medIncWeekly), the shares the band keys
const INC_KEY = { med: "medIncWeekly", lo: "loinc", hiq: "hiqinc" };
const demoShare = (d) => {
  if (isCob()) return d.demo && d.demo.cob ? d.demo.cob[S.cob] : null;
  if (isRel()) return d.demo && d.demo.rel ? d.demo.rel[S.rel] : null;
  if (isTen()) return d.demo && d.demo.ten ? d.demo.ten[S.ten] : null;
  if (isAnc()) return d.demo && d.demo.anc ? d.demo.anc[S.anc] : null;
  if (isInc()) return d.demo ? d.demo[INC_KEY[S.incMode]] : null;
  // age: median is years (ageMed); the five share views ride their keys
  if (isAge()) return d.demo ? d.demo[AGE_KEY[S.ageMode]] : null;
  // education: both reads ride their own demo-dict keys (uni/y12less)
  if (isEdu()) return d.demo ? d.demo[S.eduMode] : null;
  return d.demo ? d.demo[S.index] : null;
};
// ...and of the year model's AUS/area pool (demo dicts built in deriveAreas)
const demoAreaShare = (demo) => {
  if (isCob()) return demo && demo.cob ? demo.cob[S.cob] : null;
  if (isRel()) return demo && demo.rel ? demo.rel[S.rel] : null;
  if (isTen()) return demo && demo.ten ? demo.ten[S.ten] : null;
  if (isAnc()) return demo && demo.anc ? demo.anc[S.anc] : null;
  if (isInc()) return demo ? demo[INC_KEY[S.incMode]] : null;
  if (isAge()) return demo ? demo[AGE_KEY[S.ageMode]] : null;
  if (isEdu()) return demo ? demo[S.eduMode] : null;
  return demo ? demo[S.index] : null;
};
// ...and of one booth row (fraction): the select lanes ride their
// parallel B rows (cob/rel/ten), positional in the year's key orders
const demoBoothShare = (raw, j, pos) => {
  if (isCob()) { const r = raw.cob && raw.cob[j]; return r ? r[pos[S.cob]] : null; }
  if (isRel()) { const r = raw.rel && raw.rel[j]; return r ? r[pos[S.rel]] : null; }
  if (isTen()) { const r = raw.ten && raw.ten[j]; return r ? r[pos[S.ten]] : null; }
  if (isAnc()) { const r = raw.anc && raw.anc[j]; return r ? r[pos[S.anc]] : null; }
  // income: the share views ride the demo tuple's cells 6/16; the median
  // is dollars, dollars never a share — boothValue reads raw.medinc
  if (isInc()) { const r = raw.demo && raw.demo[j]; return r && S.incMode !== "med" ? r[{ lo: 6, hiq: 16 }[S.incMode]] : null; }
  // age: a65/a2034 stay at the demo tuple's cells 1/2 like every GCP lane
  if (isAge()) {
    if (S.ageMode === "med") return null; // median is years: boothValue reads raw.ageMed
    if (S.ageMode === "a65" || S.ageMode === "a2034") { const r = raw.demo && raw.demo[j]; return r ? r[S.ageMode === "a65" ? 1 : 2] : null; }
    const lane = raw[AGE_KEY[S.ageMode]]; return lane ? lane[j] : null;
  }
  // education: each read rides its own demo-tuple cell (uni 4, y12less 8)
  if (isEdu()) { const r = raw.demo && raw.demo[j]; return r ? r[DM.indexOf(S.eduMode)] : null; }
  const r = raw.demo && raw.demo[j]; return r ? r[DM.indexOf(S.index)] : null;
};
// the median-age lane's colour domain per year: the year's own division
// medians snapped outward to whole-year pairs (no hand-set LUT)
const ageMedRange = (m) => {
  if (m && m._ageMedRange) return m._ageMedRange;
  let lo = Infinity, hi = -Infinity;
  for (const d of (m && m.divs) || []) {
    const v = d.demo && d.demo.ageMed;
    if (v == null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const r = isFinite(lo) ? [Math.floor(lo / 2) * 2, Math.ceil(hi / 2) * 2] : [25, 70];
  if (m) m._ageMedRange = r;
  return r;
};
// the median lane's colour domain per year: the year's own division
// medians snapped outward to $100s — each census epoch's dollars price
// their own spectrum, no hand-set LUT to drift
const incMedRange = (m) => {
  if (m && m._incMedRange) return m._incMedRange;
  let lo = Infinity, hi = -Infinity;
  for (const d of (m && m.divs) || []) {
    const v = d.demo && d.demo.medIncWeekly;
    if (v == null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const r = isFinite(lo) ? [Math.floor(lo / 100) * 100, Math.ceil(hi / 100) * 100] : [0, 4500];
  if (m) m._incMedRange = r;
  return r;
};
const demoRange = () => (isCob() ? COB_RANGE[S.cob] : isRel() ? REL_RANGE[S.rel] : isTen() ? TEN_RANGE[S.ten] : isAnc() ? ANC_RANGE[S.anc] : isInc() ? (S.incMode === "med" ? incMedRange(M()) : INC_RANGE[S.incMode]) : isAge() ? (S.ageMode === "med" ? ageMedRange(M()) : AGE_RANGE[S.ageMode]) : isEdu() ? DM_RANGE[S.eduMode] : DM_RANGE[S.index]);
const demoRamp = () => RAMP.demo[isCob() ? "fborn" : isRel() ? "rel" : isTen() ? "ten" : isAnc() ? "anc" : isInc() ? (S.incMode === "med" ? "incmed" : S.incMode === "lo" ? "loinc" : "hiqinc") : isAge() ? (S.ageMode === "med" ? "agemed" : S.ageMode) : isEdu() ? S.eduMode : S.index];
const cobFor = (m) => (m.cobKeys || []).map((k) => [k, COB_NAME[k]]);
// the model's positional map for the active select lane (cob/rel/ten/anc)
const selPos = (m) => (isCob() ? (m.cobPos || {}) : isRel() ? (m.relPos || {}) : isTen() ? (m.tenPos || {}) : isAnc() ? (m.ancPos || {}) : (m.cobPos || {}));
const relFor = (m) => (m.relKeys || []).map((k) => [k, REL_NAME[k]]);
const tenFor = (m) => (m.tenKeys || []).map((k) => [k, TEN_NAME[k]]);
const ancFor = (m) => (m.ancKeys || []).map((k) => [k, ANC_NAME[k]]);
// a select lane's sub-select label: the ideology/noun phrase the
// legend and menu land on
const selName = (m, k) => (isRel() ? REL_NAME[k] : isTen() ? TEN_NAME[k] : ANC_NAME[k]);
// the People lanes' floor: 1993/1996/1998 are the statistics-era
// interp blend entrance (1991↔1996 and 1996↔2001 day-share blends,
// derive-booth-demo-90s.py's stores at the venue-nearest
// linework rescue, the era's own census cover on the desk); the 2001
// election reads its own census measured-only, 2004-2019 are the
// blend era
const DEMO_FROM = 1993;
const TYPE = { 1: "Polling place", 2: "Hospital team", 3: "Remote mobile team", 4: "Mobile team", 5: "Early voting centre" };
const FPMAX = { alp: 70, lnp: 70, grn: 50, onp: 40, ind: 55, oth: 35 };
// where each share ramp reaches the party's own colour: a strong result for that party
const FPKNEE = { alp: 45, lnp: 45, grn: 15, onp: 15, ind: 20, oth: 15 };
// the far end of each party's ramp, [L, C, H]: darkest on paper, brightest on the dark theme
const FP_DEEP = {
  light: { alp: [0.32, 0.12, 25], lnp: [0.25, 0.13, 265], grn: [0.31, 0.09, 155], onp: [0.44, 0.155, 42], ind: [0.29, 0.12, 310], oth: [0.26, 0, 0] },
  dark: { alp: [0.91, 0.06, 30], lnp: [0.90, 0.05, 255], grn: [0.93, 0.11, 150], onp: [0.93, 0.11, 85], ind: [0.91, 0.06, 310], oth: [0.93, 0, 0] },
};
const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, "vic14", "nsw15", 2016, "wa17", "qld17", "vic18", 2019, "nsw19", "qld20", "wa21", "nsw23", "sa22", 2022, "vic22", "qld24", "wa25", 2025, "sa26", "nswnow", "qldnow", "wanow", "now"];
// qld17/qld20/qld24: the 2017 (25 November), 2020 (31 October) and 2024
// (26 October) Queensland state elections alongside nsw15/nsw19/nsw23/
// sa22/sa26/vic14/vic18/vic22 — non-federal stops, drawn on their own
// timeline row at their date rather than a whole year in, named "Qld" +
// the year. (The 2013-redistribution era New South Wales and Victorian
// stops ran their own rows in from 2026-11-04.) wa17/wa21/wa25 (11 March
// 2017, 13 March 2021, 8 March 2025): Western Australia's Legislative
// Assembly stops on the same shape, one per redistribution era — the state
// redraws its boundaries before every election.
const SA_YEARS = new Set(["sa22", "sa26"]);
const NSW_YEARS = new Set(["nsw15", "nsw19", "nsw23", "nswnow"]);
const VIC_YEARS = new Set(["vic14", "vic18", "vic22"]);
const QLD_YEARS = new Set(["qld17", "qld20", "qld24", "qldnow"]);
const WA_YEARS = new Set(["wa17", "wa21", "wa25", "wanow"]);
const YEAR_JUR = { sa22: "sa", sa26: "sa", nsw15: "nsw", nsw19: "nsw", nsw23: "nsw", nswnow: "nsw", vic14: "vic", vic18: "vic", vic22: "vic", qld17: "qld", qld20: "qld", qld24: "qld", qldnow: "qld", wa17: "wa", wa21: "wa", wa25: "wa", wanow: "wa" };
const STATE_YEARS = new Set(Object.keys(YEAR_JUR));
// the "as it stands" overlays: a now-key rides one election frame (nswnow is
// the 2023 Assembly plus its four by-elections, qldnow the 2024 parliament
// plus its two, wanow the 2025 Assembly plus Secret Harbour's, now the 2025
// House plus Farrer and the parliament's moves since), with its own overlay
// file listing who holds each changed seat today
const NOW_OF = { now: 2025, nswnow: "nsw23", qldnow: "qld24", wanow: "wa25" };
const NOW_DATA = { now: "data-now.json", nswnow: "data-now-nsw.json", qldnow: "data-now-qld.json", wanow: "data-now-wa.json" };
const isNowY = (y) => y in NOW_OF;
const nowRy = (y) => (y in NOW_OF ? NOW_OF[y] : y);
// the election an "as it stands" frame's numbers measure against: the base
// count itself (the 2025 count for "now", the 2023 one for "nswnow")
const frameBaseY = (y) => (isNowY(y) ? FRAME_YEAR[NOW_OF[y]] ?? NOW_OF[y] : FRAME_YEAR[y] ?? y);
// an election's count word follows the view: divisions on the map, seats in
// the chamber, members in the list — never "districts"
const seatNoun = () => (S.view === "map" ? "divisions" : S.view === "chamber" ? "seats" : "members");
// the Handbook years' geometry ships lossless both levels (its licence bars a
// simplified lo derivative), 6.5–19MB a stop — too heavy for the boot-time idle
// preload, which skips them; the timeline's hover preload (app-6) still fetches
// a stop the reader nears, and a click loads on demand
const HANDBOOK_YEARS = new Set([1993, 1996, 1998, 2001]);
const YEARS_FED = YEARS.filter((y) => !STATE_YEARS.has(y));
const YEARS_SA = YEARS.filter((y) => SA_YEARS.has(y));
const YEARS_NSW = YEARS.filter((y) => NSW_YEARS.has(y));
const YEARS_VIC = YEARS.filter((y) => VIC_YEARS.has(y));
const YEARS_QLD = YEARS.filter((y) => QLD_YEARS.has(y));
const YEARS_WA = YEARS.filter((y) => WA_YEARS.has(y));
// each stop's spot on the timeline's date line (year + day-of-year/365)
const YEAR_X = { 1993: 1993.195, 1998: 1998.753, 1996: 1996.169, 2001: 2001.861, 2004: 2004.772, 2007: 2007.896, 2010: 2010.638, 2013: 2013.68, 2016: 2016.499, 2019: 2019.377, 2022: 2022.386, 2025: 2025.378, sa22: 2022.213, sa26: 2026.216, nsw15: 2015.238, nsw19: 2019.225, nsw23: 2023.23, nswnow: 2026.78, qldnow: 2026.79, vic14: 2014.912, vic18: 2018.899, vic22: 2022.901, qld17: 2017.901, qld20: 2020.833, qld24: 2024.82, wa17: 2017.192, wa21: 2021.194, wa25: 2025.183, wanow: 2026.84, now: 2026.8 };
// the calendar year a non-year word's results belong to ("sa22" elects in 2022)
const FRAME_YEAR = { now: 2026, nswnow: 2026, qldnow: 2026, sa22: 2022, sa26: 2026, nsw15: 2015, nsw19: 2019, nsw23: 2023, vic14: 2014, vic18: 2018, vic22: 2022, qld17: 2017, qld20: 2020, qld24: 2024, wa17: 2017, wa21: 2021, wa25: 2025, wanow: 2026 };
// a state frame's history spot: the previous election's date on its line;
// Queensland's 2015 (31 January) precedes the row's three stops
const STATE_PREV_X = { sa: 2018.205, nsw: 2019.222, vic: 2018.901, qld: 2015.086, wa: 2013.185 };
const SA_PREV_X = { 2018: STATE_PREV_X.sa };
const NSW_PREV_X = { 2011: 2011.233, 2019: STATE_PREV_X.nsw };
const VIC_PREV_X = { 2010: 2010.907, 2018: STATE_PREV_X.vic };
const QLD_PREV_X = { 2015: STATE_PREV_X.qld };
const WA_PREV_X = { 2008: 2008.679, 2013: STATE_PREV_X.wa };
// the election each state frame names as its "previous election" (its date rides
// STATE_PREV_X on the timelines): South Australia's 2018, New South Wales' 2019,
// Victoria's 2018 — and Queensland's stops prev-chain 2017→2020→2024, the 2017
// frame naming nothing (the 2015 election was fought on the 89-district map);
// the 2013-era stops chain too (nsw15←2011→nsw19←2015→nsw23; vic14←2010→vic18
// ←2014→vic22), nsw15 and vic14 the row's first stops
const PREV_YEAR = { sa22: 2018, sa26: 2022, nsw15: 2011, nsw19: 2015, nsw23: 2019, nswnow: 2019, vic14: 2010, vic18: 2014, vic22: 2018, qld24: 2020, qldnow: 2020, qld20: 2017, qld17: null, wa17: 2013, wa21: 2017, wa25: 2021, wanow: 2021 };
const Y2_ST_CAP = { SA: "South Australia", NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia" };
const stOfYear = (y) => (YEAR_JUR[y] || "").toUpperCase();
// a state frame's state in sentence words ("New South Wales" wherever "SA" would do)
const stNameCap = (y) => Y2_ST_CAP[stOfYear(y)] || "";
const prevXOf = (y) => STATE_PREV_X[YEAR_JUR[y]] ?? y - 1;
const prevNameOf = (y) => { const p = PREV_YEAR[y]; return p == null ? stOfYear(y).toUpperCase() : `${stOfYear(y).toUpperCase()} ${String(p).slice(2)}`; };
const prevXLabOf = (y) => { const p = PREV_YEAR[y]; return p == null ? stOfYear(y).toUpperCase() : `${stOfYear(y).toUpperCase()}’${String(p).slice(2)}`; };
const GOV = { 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp", 2018: "lnp", sa22: "alp", sa26: "alp", nsw15: "lnp", nsw19: "lnp", nsw23: "alp", nswnow: "alp", vic14: "alp", vic18: "alp", vic22: "alp", qld17: "alp", qld20: "alp", qld24: "lnp", qldnow: "lnp", wa17: "alp", wa21: "alp", wa25: "alp", wanow: "alp", now: "alp" }; // 2018 is SA's (Marshall's Liberals), the sa22 frame's prev
// another state's 2018 prev-government collides with SA's key above: Victoria
// 2018 was Labor (Andrews won it), so the winner a vic22 frame is gauged
// against comes from this corridor, not GOV[2018]. Queensland's stop years
// collide with nothing, but its PREV consecutive-year keys (2017/2020) are
// likewise carried here, not in GOV's federal-year corridor
const PREV_GOV_BY_JUR = { vic: { 2010: "lnp", 2014: "alp", 2018: "alp" }, qld: { 2017: "alp", 2020: "alp" }, nsw: { 2011: "lnp", 2015: "lnp", 2019: "lnp" }, wa: { 2008: "alp", 2013: "lnp", 2017: "alp", 2021: "alp" } };
const PM = { 1993: "Paul Keating", 1998: "John Howard", 2001: "John Howard", 1996: "John Howard", 2004: "John Howard", 2007: "Kevin Rudd", 2010: "Julia Gillard", 2013: "Tony Abbott", 2016: "Malcolm Turnbull", 2019: "Scott Morrison", 2022: "Anthony Albanese", 2025: "Anthony Albanese", sa22: "Peter Malinauskas", sa26: "Peter Malinauskas", nsw15: "Mike Baird", nsw19: "Gladys Berejiklian", nsw23: "Chris Minns", nswnow: "Chris Minns", vic14: "Daniel Andrews", vic18: "Daniel Andrews", vic22: "Daniel Andrews", qld17: "Annastacia Palaszczuk", qld20: "Annastacia Palaszczuk", qld24: "David Crisafulli", qldnow: "David Crisafulli", wa17: "Mark McGowan", wa21: "Mark McGowan", wa25: "Roger Cook", wanow: "Roger Cook", now: "Anthony Albanese" };
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const K_HI = 2.6, K_ALL = 26, K_BLAB = 90;
const CITIES = [["Sydney", "NSW", [[150.62, -34.12], [151.34, -33.56]]], ["Melbourne", "VIC", [[144.6, -38.12], [145.42, -37.58]]], ["Brisbane", "QLD", [[152.78, -27.72], [153.22, -27.25]]], ["Perth", "WA", [[115.68, -32.32], [116.08, -31.7]]], ["Adelaide", "SA", [[138.46, -35.14], [138.76, -34.72]]], ["Hobart", "TAS", [[147.18, -42.98], [147.48, -42.74]]], ["Canberra", "ACT", [[148.98, -35.48], [149.24, -35.16]]], ["Darwin", "NT", [[130.82, -12.5], [131.08, -12.32]]]];
const LENSES = [
  { id: "winner", label: "Winner" },
  { id: "tpp", label: "Two-party" },
  { id: "fp", label: "Primary" },
  { id: "senate", label: "Senate" },
  { id: "flow", label: "Preferences" },
  { id: "informal", label: "Informal" },
  { id: "cls", label: "Seat type" },
  { id: "seifa", label: "Census" },
];
// the Senate vote and the AEC's seat types are federal reads — the state frames
// (state legislatures, state-commission boundaries) don't offer them
// ("senpref" is the Preferences tab's Senate-ballot reading, flipped from its key: not a tab of its own)
const FED_LENS = new Set(["senate", "senpref", "cls"]);
// New South Wales' Legislative Council preferences exist per-ballot since 2015 (the NSWEC's
// "LC Pref Data Statewide" zips): its state frames keep the senpref reading beside them
const SEN_PREF_STATE_FRAMES = new Set(["nsw15", "nsw19", "nsw23"]);
const yearLenses = (y) => STATE_YEARS.has(y) ? LENSES.filter((l) => !FED_LENS.has(l.id) || (l.id === "senpref" && SEN_PREF_STATE_FRAMES.has(y))) : LENSES;
// the arrow-key walks: the year walk is shared by the keyboard and the phone's
// figure swipes (a swipe cycles all the way around); the lens and row walks
// are keyboard only — a phone scrolls the lens row itself, and its vertical
// drags belong to the page. On the phone a walk keeps the view fixed
// (walkHold below), and has no scroll side effects of its own
const yearLane = (y) => (SA_YEARS.has(y) ? YEARS_SA : VIC_YEARS.has(y) ? YEARS_VIC : NSW_YEARS.has(y) ? YEARS_NSW : QLD_YEARS.has(y) ? YEARS_QLD : WA_YEARS.has(y) ? YEARS_WA : YEARS_FED);
function walkYear(dir, wrap) { const lane = yearLane(S.year); const k = lane.indexOf(S.year) + dir, y = lane[wrap ? (k + lane.length) % lane.length : k]; if (y != null) setYear(y); }
// the up/down-arrows walk: the "View elections" strip's order (federal, then
// the states as they are listed there), walking round the ends; a lane holds
// the stop it was left on (setYear keeps the memory), its newest stop until then
const LANES = [YEARS_FED, YEARS_VIC, YEARS_NSW, YEARS_QLD, YEARS_SA, YEARS_WA];
const laneMem = new Map();
function walkLane(dir) {
  const cur = yearLane(S.year);
  laneMem.set(cur, S.year);
  const lane = LANES[(LANES.indexOf(cur) + dir + LANES.length) % LANES.length];
  setYear(laneMem.get(lane) ?? lane[lane.length - 1]);
}
function walkLens(dir) {
  if (S.view === "chamber" && S.house === "senate") { const L = SEN_LENSES, j = (L.findIndex((l) => l.id === S.senLens) + dir + L.length) % L.length; setSenLens(L[j].id); return; }
  const L = yearLenses(S.year), k = (L.findIndex((l) => l.id === (S.lens === "senpref" ? "flow" : S.lens)) + dir + L.length) % L.length;
  setLens(L[k].id);
  const b = $(`#lenses [data-lens="${L[k].id}"]`);
  // the row reveals the chip horizontally itself — the scrollIntoView this
  // replaced could also scroll the PAGE vertically, a walk side effect
  if (b) { const row = $("#lenses"); row.scrollLeft += b.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - b.offsetWidth) / 2; }
}
// a horizontal swipe with no other claim on it (vertical drags belong to the
// page): one walk per gesture, and never mid-pinch; `want` can turn a touch
// down by its start target (native controls keep their gestures)
function swipeWatch(el, onSwipe, want) {
  let g = null;
  el.addEventListener("touchstart", (e) => { if (e.touches.length === 1 && (!want || want(e.target))) { const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, at: performance.now() }; } else g = null; }, { passive: true });
  el.addEventListener("touchmove", (e) => { if (g && e.touches.length !== 1) g = null; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!g) return;
    const t = e.changedTouches[0], dx = t.clientX - g.x, dy = t.clientY - g.y, quick = performance.now() - g.at < 900, y0 = g.y;
    g = null;
    if (quick && Math.abs(dx) >= 48 && Math.abs(dx) > 1.6 * Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1, y0);
  }, { passive: true });
  el.addEventListener("touchcancel", () => { g = null; }, { passive: true });
}

/* the fixed view — the All-polls walk contract (rdPinScroll's): on the phone
   layout, where the figure and the story stack in the page's flow, a walk
   keeps the block the reader touched where it was on screen, and whatever
   changes above it gives way. The gesture names the spot (walkAim: the lens
   row, the map, its key, the timeline, or a story block); the render that
   follows holds it (walkHold). All polls' lessons on an iPhone, where a
   scroll the page issues mid-gesture paints late or is lost to the finger's
   fling: nothing above the held block may reflow while the gesture lasts,
   and the page makes at most ONE correction, once the reader is still.
   So the story's new blocks above the touched one go into a holder at the
   old blocks' height (.st-hold: the new words bottom-aligned against the
   touched block, any surplus or shortfall at its far top end, off screen as
   a rule), and the holder is let go when no finger is down and the page has
   stopped scrolling, with one scrollBy of exactly what the release moves
   (measured across it, never against the stale spot: a reader who scrolled
   away is not pulled back). A walk while the holder stands re-measures what
   the reader sees and re-holds, so a run of swipes costs one correction in
   all. The story is rewritten on every walk, so its blocks are found again
   by what they are (a section by its heading), and a block the new story
   lacks hands the hold to the next one below it. The figure's spots have
   nothing above them that reflows on a walk (the key and the eyebrow hold
   their heights), so their correction is a backstop that should never
   fire. A wide screen keeps the story in its own column beside a sticky
   figure, so the hold is the phone layout's only */
const PHONE = matchMedia("(max-width: 860px)");
let walkSpot = null;
const FIXED_SPOTS = ["#lenses", "#stage", "#legend", "#time"];
function blockKey(el) {
  if (el.matches(".st-sec")) {
    if (el.querySelector("#minich")) return "sec:chamber";
    const h = el.querySelector("h3");
    return "sec:" + (h && h.firstChild ? h.firstChild.textContent.trim() : "");
  }
  // a note has no identity of its own across stories
  return el.matches(".st-note") ? null : el.className || el.tagName;
}
// the story's blocks in order, through a standing holder
function storyKids() {
  const out = [];
  for (const el of $("#story").children) {
    if (el.classList.contains("st-hold")) out.push(...el.firstElementChild.children);
    else out.push(el);
  }
  return out;
}
// the story's blocks with their keys, a repeated key numbered; keyless blocks are left out
function storyBlocks() {
  const seen = new Map(), out = [];
  for (const el of storyKids()) {
    let k = blockKey(el);
    if (!k) continue;
    const n = seen.get(k) || 0;
    seen.set(k, n + 1);
    out.push([el, n ? `${k}#${n}` : k]);
  }
  return out;
}
// a gesture at viewport y names the block under it (a note's spot goes to the keyed block below it)
function walkAim(y) {
  walkSpot = null;
  // (full screen has no page to hold: its story scrolls in its own panel)
  if (!PHONE.matches || y == null || FS.on) return;
  for (const sel of FIXED_SPOTS) {
    const el = $(sel), r = el && !el.hidden && el.getBoundingClientRect();
    if (r && y >= r.top && y < r.bottom) { walkSpot = { el, at: performance.now() }; return; }
  }
  const hit = storyBlocks().find(([el]) => el.getBoundingClientRect().bottom > y);
  if (hit) walkSpot = { key: hit[1], at: performance.now() };
}
// the spot a render may hold: only a fresh one (a gesture that changed nothing leaves a stale spot behind)
function takeSpot() { const s = walkSpot; walkSpot = null; return s && performance.now() - s.at < 1000 ? s : null; }
// is the reader still? no finger down, no scroll for a moment
let touchesDown = 0, lastScrollAt = 0;
addEventListener("touchstart", (e) => { touchesDown = e.touches.length; }, { passive: true, capture: true });
addEventListener("touchend", (e) => { touchesDown = e.touches.length; }, { passive: true, capture: true });
addEventListener("touchcancel", (e) => { touchesDown = e.touches.length; }, { passive: true, capture: true });
addEventListener("scroll", () => { lastScrollAt = performance.now(); }, { passive: true });
// where the last release left its block: the spot it aimed for, which the next walk on the same
// block aims for again while the reader hasn't scrolled. A correction lands on whole pixels
// (WebKit rounds -551.3 to -552), so re-measuring each walk from where the last one landed
// walked a run of swipes away a pixel at a time
let walkMark = null;
let holdEnd = null;
function walkHold(spot) {
  if (!spot || !PHONE.matches || FS.on) return null;
  let cands;
  if (spot.el) cands = [{ el: spot.el, key: null }];
  else {
    const kids = storyBlocks(), i = kids.findIndex(([, k]) => k === spot.key);
    if (i < 0) return null;
    cands = kids.slice(i).map(([el, key]) => ({ el, key }));
  }
  for (const c of cands) c.top = c.el.getBoundingClientRect().top;
  const mark = walkMark;
  if (mark && mark.y === window.scrollY && (spot.el ? mark.el === spot.el : mark.key === spot.key) && Math.abs(cands[0].top - mark.top) < 2) cands[0].top = mark.top;
  walkMark = null;
  // the story keeps at least its height until the release: a shorter story
  // mid-render would let the browser pull the page up at its foot
  const story = $("#story");
  story.style.minHeight = story.getBoundingClientRect().height + "px";
  return {
    land() {
      // a standing hold is superseded, not released: the render took its holder with the old story
      if (holdEnd) holdEnd("superseded");
      let el = null, want = 0, mkey = null;
      for (const c of cands) {
        const hit = c.key == null ? (c.el.isConnected ? [c.el] : null) : storyBlocks().find(([, k]) => k === c.key);
        if (hit) { el = hit[0]; want = c.top; mkey = c.key; break; }
      }
      if (!el) { story.style.minHeight = ""; return; }
      const html = document.documentElement, anchorWas = html.style.overflowAnchor;
      // the browser's own scroll anchoring would move the page under the hold's feet
      html.style.overflowAnchor = "none";
      let hold = null;
      if (el.parentElement === story && el !== story.firstElementChild) {
        // the holder: the blocks above, bottom-aligned in a box sized so the touched block stays put
        hold = document.createElement("div");
        hold.className = "st-hold";
        hold.style.cssText = "position:relative;overflow:hidden;height:0";
        const inner = document.createElement("div");
        inner.style.cssText = "position:absolute;left:0;right:0;bottom:0";
        hold.appendChild(inner);
        story.insertBefore(hold, story.firstChild);
        while (hold.nextSibling !== el) inner.appendChild(hold.nextSibling);
        hold.style.height = Math.max(0, want - el.getBoundingClientRect().top) + "px";
      }
      let lastY = window.scrollY, timer = 0;
      // a backstop: anything else that moves the block while the hold stands (a reader's scroll folds in)
      const fix = () => {
        if (!el.isConnected) return end(false);
        want -= window.scrollY - lastY;
        const drift = el.getBoundingClientRect().top - want;
        if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
        lastY = window.scrollY;
      };
      const ro = new ResizeObserver(fix);
      // the release: the holder's blocks back in the story, its floor off, and the
      // one correction that needs, measured across it
      const end = (release) => {
        if (holdEnd !== end) return;
        holdEnd = null; ro.disconnect(); clearTimeout(timer);
        html.style.overflowAnchor = anchorWas;
        // superseded, the new hold owns the floor; let go any other way (a render that isn't a walk), the floor goes
        if (release !== true) { if (release !== "superseded") story.style.minHeight = ""; return; }
        if (!el.isConnected) { story.style.minHeight = ""; return; }
        // the target is where the block stands now, the reader's own scroll and all - unless it
        // stands within a pixel of the spot the hold aimed for, the rounding of an earlier correction
        const was = el.getBoundingClientRect().top, aim = window.scrollY === lastY && Math.abs(was - want) < 1 ? want : was;
        if (hold && hold.isConnected) {
          const inner = hold.firstElementChild;
          while (inner.firstChild) story.insertBefore(inner.firstChild, hold);
          hold.remove();
        }
        story.style.minHeight = "";
        // whole pixels, rounded here: left to the browser, WebKit floors them
        const shift = Math.round(el.getBoundingClientRect().top - aim);
        if (shift) window.scrollBy(0, shift);
        walkMark = { el: mkey == null ? el : null, key: mkey, top: aim, y: window.scrollY };
      };
      holdEnd = end;
      const t0 = performance.now();
      const settle = () => {
        const now = performance.now();
        if (touchesDown || now - t0 < 400 || now - lastScrollAt < 200) { timer = setTimeout(settle, 100); return; }
        end(true);
      };
      fix();
      for (const sel of [".mp-sec > .rd-eyebrow", "#view", "#story"]) { const o = $(sel); if (o) ro.observe(o); }
      timer = setTimeout(settle, 400);
    },
  };
}

/* =============================== state =============================== */
const S = {
  year: "now", lens: "winner", party: "onp", from: "onp", vs: "lnp", index: "irsad", tppMode: "share", fpMode: "share",
  // how the map view draws the lens (app-2b-draw.js), and the contest the Two-party lens reads when it isn't seats
  draw: "seats", axis: "AC",
  // the informal lens's exhausted-ballot view (New South Wales' optional-preferential count)
  infMode: "informal",
  // the Household-income lens's measure: the median spectrum, or the lower- /
  // top-income-quarter shares (an INC_MODES value; median lands)
  incMode: "med",
  // the Age lens's measure: the median-age spectrum, or one of the share
  // views (an AGE_MODES value; median lands)
  ageMode: "med",
  // the Education lens's read: the university-qualification share, or the
  // left-school-early one (an EDU_MODES value; the university read lands)
  eduMode: "uni",
  // the Born overseas lens's birthplace-country sub-view (a COB_NAME key, null = all overseas-born)
  cob: null,
  // the Religion and Housing-tenure select lenses' picked options
  // (a REL_NAME/TEN_NAME key, null = the default: No religion /
  // owned with a mortgage)
  rel: "norel", ten: "mort",
  // the Ancestry select lens's picked option (an ANC_NAME key;
  // English is the landing view, first of the twelve)
  anc: "english",
  view: "map", sel: { level: "aus" }, hover: null, seat: null,
  listUnit: "seats", sort: null, q: "",
  f: { st: null, cls: null, win: null, margin: null, range: null },
  dist: null,
  // the chamber view's chamber: the House ("reps") or the Senate, with the Senate's own lens and selection
  house: "reps", senLens: "party", ssel: { level: "aus" },
  // the Senate lens: a party's Senate vote less its House vote ("gap"), or its Senate share
  senMode: "gap",
  // the Senate preferences lens: the contest (Labor v One Nation first) and whose ballots
  spPair: "AO", spFrom: "lnp",
};
/* the census-index lanes' scoring basis rides the frame, never a picker: the
   2016+ frames carry the votes-by-SA1 footprint (voter), the earlier ones only
   the census areas the places stand in — one basis per year, the same
   treatment the People lanes get */
const seifaBasis = (m) => (m && m.demoBasis === "voter" ? "voters" : "venue");
const Y = {};
let proj = null;
// a state frame names itself "SA2022"/"NSW2023": the state's abbreviation + full
// year; its "as it stands" overlay key is "NSW now"
const yearLabel = (y) => (y === "now" ? "Now" : isNowY(y) ? `${stOfYear(y)} now` : STATE_YEARS.has(y) ? `${YEAR_JUR[y].toUpperCase()}20${String(y).slice(-2)}` : String(y));
// a year as the URL and data-year attributes carry it: numeral digits, or a word
// year ("now", "sa26") that stays a word - a bare +s gives NaN for those
const yearOf = (s) => (YEARS.includes(s) ? s : +s);
const xOfYear = (y) => YEAR_X[y] ?? y;

/* =============================== data =============================== */
// each data file's content hash, stamped in by assemble.mjs (data-stamp.mjs): the files keep their
// names and Pages caches them for ten minutes, so a release asks for its own data by hash and never
// pairs with a cached older copy
const DATA_V = /*@data-stamps*/{"areas-sa1-2021.json":"87f32785","core-1993.json":"70b6dee1","core-1996.json":"0341c079","core-1998.json":"ce621702","core-2001.json":"77ca8273","core-2004.json":"2c12c5d2","core-2007.json":"acc73f77","core-2010.json":"8fd8f038","core-2013.json":"1a0e8c2e","core-2016.json":"81c04117","core-2019.json":"0a749a5f","core-2022.json":"3874ab49","core-2025.json":"2ed4fa65","core-nsw15.json":"5f3e3e15","core-nsw19.json":"8bb6ac26","core-nsw23.json":"2d69d304","core-qld17.json":"3982f5a4","core-qld20.json":"a12c1401","core-qld24.json":"28e702b3","core-sa22.json":"42e747b6","core-sa26.json":"77e5941f","core-vic14.json":"ddc57527","core-vic18.json":"a80e45a6","core-vic22.json":"94a00ef8","core-wa17.json":"06ad6389","core-wa21.json":"cc2db554","core-wa25.json":"d043ed4a","data-now-nsw.json":"c190e4d7","data-now-qld.json":"2d214dc9","data-now-wa.json":"a096ff92","data-now.json":"6e97359d","data-nsw15.json":"3b556056","data-nsw19.json":"4bc6fcb6","data-nsw23.json":"51559fc2","data-qld17.json":"68e415b7","data-qld20.json":"9d06d530","data-qld24.json":"c3814e41","data-sa22.json":"ce7c7299","data-sa26.json":"b1e1a327","data-vic14.json":"ef46d0d5","data-vic18.json":"3fbcb151","data-vic22.json":"8541dddd","data-wa17.json":"4d87bbb3","data-wa21.json":"c89fba09","data-wa25.json":"dbd68e1c","geo-1993-hi.json":"d5b83add","geo-1993-lo.json":"d5b83add","geo-1996-hi.json":"b3def3ba","geo-1996-lo.json":"b3def3ba","geo-1998-hi.json":"e2c51765","geo-1998-lo.json":"e2c51765","geo-2001-hi.json":"a6606c1d","geo-2001-lo.json":"a6606c1d","geo-2004-hi.json":"c25c25f4","geo-2004-lo.json":"f1a3ae40","geo-2007-hi.json":"4db87a0d","geo-2007-lo.json":"5cb6dd10","geo-2010-hi.json":"7bd2abe4","geo-2010-lo.json":"2f3e4725","geo-2013-hi.json":"3c101b06","geo-2013-lo.json":"f8051359","geo-2016-hi.json":"1b30418b","geo-2016-lo.json":"da0f2884","geo-2019-hi.json":"ee819df9","geo-2019-lo.json":"17e396f0","geo-2022-hi.json":"07694c27","geo-2022-lo.json":"3d3e3056","geo-2025-hi.json":"7048e1d1","geo-2025-lo.json":"194abc94","geo-nsw15-hi.json":"7785d043","geo-nsw15-lo.json":"d1feb8d1","geo-nsw19-hi.json":"7785d043","geo-nsw19-lo.json":"d1feb8d1","geo-nsw23-hi.json":"889ef285","geo-nsw23-lo.json":"23ad692a","geo-qld17-hi.json":"d5757766","geo-qld17-lo.json":"e66797d1","geo-qld20-hi.json":"d5757766","geo-qld20-lo.json":"e66797d1","geo-qld24-hi.json":"d5757766","geo-qld24-lo.json":"e66797d1","geo-sa22-hi.json":"188cd494","geo-sa22-lo.json":"75ee7453","geo-sa26-hi.json":"4bd534f2","geo-sa26-lo.json":"73866149","geo-vic14-hi.json":"d20876fb","geo-vic14-lo.json":"54485f1e","geo-vic18-hi.json":"d20876fb","geo-vic18-lo.json":"54485f1e","geo-vic22-hi.json":"9b2e98b4","geo-vic22-lo.json":"7dd2d4e3","geo-wa17-hi.json":"295633fa","geo-wa17-lo.json":"46e32585","geo-wa21-hi.json":"4b9ab7b3","geo-wa21-lo.json":"1cd95bf6","geo-wa25-hi.json":"a64d0fda","geo-wa25-lo.json":"513ef944","historical-boundary-sources.json":"1b2c8b30","house-seating-plan-2012-02-27.json":"2d05efc8","house-seating-plan-2013-05-14.json":"67fd5a2e","house-seating-plan-2013-11-12.json":"08f00bdb","house-seating-plan-2016-08-31.json":"d18d9c56","house-seating-plan-2021-03.json":"680131d1","house-seating-plan-2022-07-29.json":"9ed4a9d3","house-seating-plan-2025-10-27.json":"8e418a65","house-seating-plan-2026-08-13.json":"953b9336","house-seating-plan-sa-2024-12-28.json":"b96a0486","islands.json":"10fe4949","la-seating-plan-vic-2026-08-11.json":"b2887f7e","land-hi.json":"81c828c2","land.json":"ea67e5dc","lc-seating-plan-vic-2026-10-27.json":"8551a18b","places.json":"8dc11f3e","res-1993.json":"b70bb4b6","res-1996.json":"af4baf34","res-1998.json":"4ff84f52","res-2001.json":"6ff4e4ae","res-2004.json":"e4cad3a7","res-2007.json":"2aef0639","res-2010.json":"5f093c88","res-2013.json":"45d956da","res-2016.json":"fb36f9cc","res-2019.json":"e190b88e","res-2022.json":"45d4952c","res-2025.json":"f26d4506","res-nsw15.json":"f39f4406","res-nsw19.json":"e6a54d8a","res-nsw23.json":"9d6c33ea","res-qld17.json":"6c812a4c","res-qld20.json":"bdedac6c","res-qld24.json":"3fc54b23","res-sa22.json":"c6acb997","res-sa26.json":"9ec5416a","res-vic14.json":"58b777e6","res-vic18.json":"41e7eef2","res-vic22.json":"73169621","res-wa17.json":"06ad6389","res-wa21.json":"cc2db554","res-wa25.json":"d043ed4a","seats-2010.json":"d2c9075c","seats-2013.json":"c5b04d17","seats-2016.json":"e3a9c6f3","seats-2019.json":"a76a2944","seats-2022.json":"025f55bc","seats-2025.json":"803eb9f7","seats-now.json":"f5bfe9c9","seats-sa22.json":"9b636130","seats-sa26-lc.json":"f8e6c8a1","seats-sa26.json":"9c8e2ae0","seats-vic22-lc.json":"483ec750","seats-vic22.json":"5603a5a3","senate-1993.json":"647abc02","senate-1996.json":"29a7ef33","senate-1998.json":"d6e51918","senate-2001.json":"3de71925","senate-2004.json":"d88d0847","senate-2007.json":"5891ef1c","senate-2010.json":"f7d91697","senate-2013.json":"8a0f3d28","senate-2016.json":"e64f1cdf","senate-2019.json":"2814136b","senate-2022.json":"5df6af1e","senate-2025.json":"0ecad23e","senate-floor-2026-10-09.json":"8520afee","senate-now.json":"e4b50c01","senate-nsw15.json":"08fdf9b8","senate-nsw19.json":"0c3e649f","senate-nsw23.json":"05315cda","senate-prefs-2004.json":"e0834529","senate-prefs-2007.json":"ba73d577","senate-prefs-2010.json":"6cbe91d0","senate-prefs-2013.json":"951bff08","senate-prefs-2016.json":"d1f9e239","senate-prefs-2019.json":"4747b5b9","senate-prefs-2022.json":"a936d831","senate-prefs-2025.json":"5f6d6a12","senate-prefs-nsw15.json":"e65cf0d9","senate-prefs-nsw19.json":"1e4beaf7","senate-prefs-nsw23.json":"854772ce","senate-sa22.json":"f044aa86","senate-sa26.json":"78a4be99","senate-vic14.json":"d23209de","senate-vic18.json":"4e679e75","senate-vic22.json":"2958ce36","senate-vote-1993.json":"5a5c4f94","senate-vote-1996.json":"773c7410","senate-vote-1998.json":"13ad5e9f","senate-vote-2001.json":"59d2f93d","senate-vote-2004.json":"cfe0b9ca","senate-vote-2007.json":"eb9cf448","senate-vote-2010.json":"f15aac03","senate-vote-2013.json":"106747c9","senate-vote-2016.json":"c462bdb4","senate-vote-2019.json":"efb23f42","senate-vote-2022.json":"e4ffe849","senate-vote-2025.json":"1e5111cd","summary.json":"afb90330","urban.json":"f4339a42"};
// the page's inline warmup (map/index.html, ahead of map.js) starts the landing year's fetches
// while the script downloads and parses; getJSON drinks from it once, then it's gone
// (bg: a background preload's, fetched at low priority so it yields to the reader's own)
const getJSON = (u, bg) => {
  const w = window.__warm && window.__warm[u];
  if (w) { delete window.__warm[u]; return w.catch(() => getJSON(u, bg)); }
  const v = DATA_V[u.slice(u.lastIndexOf("/") + 1)]; return fetch(v ? `${u}?v=${v}` : u, bg ? { priority: "low" } : undefined).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
};

function cleanBooth(name, div, ty) {
  let s = name.replace(new RegExp("\\s*\\(" + div.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\)$"), "");
  if (ty === 5 || / PPVC$/i.test(s) || /\bEVC$/.test(s)) s = s.replace(/\s+[A-Z][A-Z' .-]+\s+PPVC$/, "").replace(/\s+PPVC$/i, "").replace(/\s+EVC$/, "").replace(/\s+Early Voting Centre$/i, "") + " early voting centre";
  return s;
}
function firstYearOf(h, name, upto) { let y = upto; for (let k = h.length - 1; k >= 0; k--) { if (h[k][0] > upto) continue; if (h[k][3] === name) y = h[k][0]; else break; } return y; }

// the preferences lens reads a seat whose final was Labor against the rival it is set to (S.vs)
const flowSeat = (d) => d.vs != null && d.vs === S.vs;
// that rival in a sentence: "the Coalition" ("the Liberals" on a state frame), or "One Nation"
const vsW = (cap) => (S.vs === "onp" ? "One Nation" : STATE_YEARS.has(S.year) ? (cap ? "The Liberals" : "the Liberals") : cap ? "The Coalition" : "the Coalition");
// a year's seats that finished Labor against One Nation with a split on file: the lens offers that rival
const hasVsOnp = (m) => m.divs.some((d) => d.vs === "onp" && d.flows.length);
// the informal lens's exhausted view exists only where the count is optional-preferential;
// everywhere else it reads as the plain informal share
const infModeOf = (m) => (S.infMode === "exhaust" && m && m.res && m.res.flOpv ? "exhaust" : "informal");
// the informal ramp's ceiling on the current year: informal runs to 12% of
// ballots; exhaustion runs higher (nsw23's most-exhausted seat is 22.9%)
const infHi = (m) => (infModeOf(m || M()) === "exhaust" ? 25 : 12);
/* a modelled split's error, the way it was measured: per seat against counted federal divisions
   (Labor v the Liberals), or only in total for Labor v One Nation, against the contests where that
   split was counted (flowErr.vsOnp) */
const flowErrOf = (m, F) => {
  const e = m.res.flowErr; if (!e) return null;
  const v = S.vs === "onp" ? e.vsOnp && e.vsOnp[F] : e[F];
  return v == null ? null : { v, seat: S.vs !== "onp" };
};
const flowErrWords = (x) => (x.seat ? `nine in ten of the model’s per-seat estimates land within ${f0(x.v)} points of a counted split`
  : `the model’s Labor v One Nation splits are checked only in total, against the contests where they were counted, to within about ${f0(x.v)} points; no count tests them seat by seat`);
function deriveDiv(d, i, year) {
  const c = d.c.map(([n, ab, pn, b, v, sw, el], k) => ({ k, n, ab, pn, b, v, sw, el: !!el, fam: FAM(ab) }));
  const formal = sum(c.map((x) => x.v));
  const fp = {}; for (const b of FAMS) fp[b] = 0; for (const x of c) fp[x.b] += x.v; for (const b of FAMS) fp[b] = (100 * fp[b]) / formal;
  const [[ia, va], [ib, vb]] = d.tcp;
  const A = c[ia], B = c[ib], tt = va + vb;
  const win = va >= vb ? A : B, run = va >= vb ? B : A;
  const winPct = (100 * Math.max(va, vb)) / tt;
  const classic = [A.fam, B.fam].includes("alp") && [A.fam, B.fam].includes("lnp");
  // whom Labor's final rival was, where the preferences lens can read a split: the Coalition (a classic
  // seat), or One Nation
  const vs = classic ? "lnp" : [A.fam, B.fam].includes("alp") && [A.fam, B.fam].includes("onp") ? "onp" : null;
  const alpSide = vs ? (A.fam === "alp" ? 0 : 1) : -1;
  const flows = d.fl.map(([ci, ta, tb, exh]) => (exh == null ? { cand: c[ci], ta, tb } : { cand: c[ci], ta, tb, exh }));
  const flowAlp = {};
  for (const b of FAMS) {
    flowAlp[b] = null;
    if (!vs) continue;
    let toA = 0, tot = 0;
    for (const f of flows) if (f.cand.b === b) { toA += alpSide === 0 ? f.ta : f.tb; tot += f.ta + f.tb; }
    if (tot > 0) flowAlp[b] = (100 * toA) / tot;
  }
  const tpp = d.tpp && d.tpp[0] + d.tpp[1] ? (100 * d.tpp[0]) / (d.tpp[0] + d.tpp[1]) : null;
  const yNum = FRAME_YEAR[year] != null ? FRAME_YEAR[year] : year;
  const prev = d.h.filter((h) => h[0] < yNum && !h[4]).pop() || null;
  let change;
  // 2004's h is empty by construction (the archive's first federal year); an
  // empty h anywhere else means "new seat", not "unknown"
  if (!prev) change = { kind: yNum <= 1993 || yNum === 2004 ? "unknown" : "new" };
  else if (prev[3] === win.n) change = { kind: "re", since: firstYearOf(d.h.filter((h) => !h[4]), win.n, yNum) };
  else if (FAM(prev[2]) === win.fam && !(win.fam === "ind")) change = { kind: "held", prev };
  else change = { kind: "gain", prev };
  const inf = d.inf;
  // exhausted ballots ride the flow rows' fourth figure; the share of formal
  // (like infPct shares formal+informal, exhaustion shares the kept count:
  // formal = tcp + exhausted here, so this is ballots leaving before the final two)
  const exhTot = flows.reduce((a, f) => a + (f.exh || 0), 0);
  return {
    i, id: d.id, n: d.n, st: d.st, cls: d.cls, c, formal, inf, infPct: inf != null ? (100 * inf) / (formal + inf) : null, fp,
    exhPct: flows.some((f) => f.exh != null) ? (100 * exhTot) / formal : null,
    A, B, va, vb, win, run, winPct, margin: winPct - 50, votesMargin: Math.abs(va - vb), classic, vs, alpSide, flows, flowAlp,
    tpp, tppSw: d.tpp ? d.tpp[2] : null, seifa: d.seifa || {}, vt: d.vt || null, vt2: d.vt2 || null, h: d.h, demo: d.demo, lp: d.lp, lpx: 0, lpy: 0, change,
    hold: { n: win.n, ab: win.ab, pn: win.pn, fam: win.fam },
  };
}

// an island's polling places stand at their own spot on the map's plane, out
// past the mainland frame, and its inset box draws them too: isl marks which
function deriveBooths(B, m) {
  const n = B.id.length;
  const o = { n, d: Int16Array.from(B.d), id: B.id, ty: Uint8Array.from(B.ty), prem: B.prem, sub: B.sub, pc: B.pc, raw: B, isl: new Int8Array(n).fill(-1),
    name: new Array(n), x: new Float32Array(n).fill(NaN), y: new Float32Array(n).fill(NaN), votes: new Float32Array(n), formal: new Float32Array(n),
    infPct: new Float32Array(n).fill(NaN), tpp: new Float32Array(n).fill(NaN), tppSw: new Float32Array(n).fill(NaN), lead: new Array(n).fill(null), leadPct: new Float32Array(n).fill(NaN),
    fp: {}, flowAlp: {}, byDiv: m.divs.map(() => []) };
  for (const b of FAMS) { o.fp[b] = new Float32Array(n).fill(NaN); o.flowAlp[b] = new Float32Array(n).fill(NaN); }
  for (let j = 0; j < n; j++) {
    const D = m.divs[B.d[j]];
    o.byDiv[B.d[j]].push(j);
    o.name[j] = cleanBooth(B.n[j], D.n, B.ty[j]);
    const k = B.lat[j] == null ? -1 : m.isl.findIndex((s) => B.lon[j] >= s.near[0] && B.lon[j] <= s.near[2] && B.lat[j] >= s.near[1] && B.lat[j] <= s.near[3]);
    if (k >= 0) { o.isl[j] = k; m.isl[k].booths.push(j); }
    if (B.lat[j] != null) { const p = m.proj([B.lon[j], B.lat[j]]); if (p) { o.x[j] = p[0]; o.y[j] = p[1]; } }
    const v = B.v[j]; let formal = 0; for (const x of v) formal += x;
    o.formal[j] = formal; o.votes[j] = B.inf[j] == null ? NaN : formal + B.inf[j];
    if (B.inf[j] != null && o.votes[j]) o.infPct[j] = (100 * B.inf[j]) / o.votes[j];
    if (formal) { const acc = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 }; for (let k = 0; k < v.length; k++) acc[D.c[k].b] += v[k]; for (const b of FAMS) o.fp[b][j] = (100 * acc[b]) / formal; }
    const t = B.tpp[j]; if (t && t[0] + t[1]) { o.tpp[j] = (100 * t[0]) / (t[0] + t[1]); if (t[2] != null) o.tppSw[j] = t[2]; }
    const tc = B.tcp[j]; if (tc && tc[0] + tc[1]) { const a = tc[0] >= tc[1]; o.lead[j] = a ? D.A : D.B; o.leadPct[j] = (100 * Math.max(tc[0], tc[1])) / (tc[0] + tc[1]); }
    const fl = B.fl[j];
    if (fl && D.vs) for (const b of FAMS) { let toA = 0, tot = 0; for (const [ci, ta, tb] of fl) if (D.c[ci].b === b) { toA += D.alpSide === 0 ? ta : tb; tot += ta + tb; } if (tot >= 12) o.flowAlp[b][j] = (100 * toA) / tot; }
  }
  return o;
}

// the fallback for a res file with no booths dict — the same shape
// deriveBooths returns, empty
function emptyBooths(m) {
  const o = { n: 0, d: new Int16Array(0), id: [], ty: new Uint8Array(0), prem: [], sub: [], pc: [], raw: null, isl: new Int8Array(0),
    name: [], x: new Float32Array(0), y: new Float32Array(0), votes: new Float32Array(0), formal: new Float32Array(0),
    infPct: new Float32Array(0), tpp: new Float32Array(0), tppSw: new Float32Array(0), lead: [], leadPct: new Float32Array(0),
    fp: {}, flowAlp: {}, byDiv: m.divs.map(() => []) };
  for (const b of FAMS) { o.fp[b] = new Float32Array(0); o.flowAlp[b] = new Float32Array(0); }
  return o;
}

/* census shares pooled over a set of seats' vote-weighted populations, in
   percent: an area's (deriveAreas), or a filtered pool's (the story's scopeArea) */
function demoOf(m, idx) {
  let demo = null;
  const ds = idx.map((i) => m.divs[i].demo).filter((x) => x && x.p);
  if (ds.length) {
    demo = {};
    // a lane's null rows sit that lane's pool out, both sides of the line
    for (const k of DM) { const xs = ds.filter((x) => x[k] != null); demo[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x[k]))) / sum(xs.map((x) => x.p)) : null; }
    // the birthplace countries pool the same way, per year-country
    if (m.cobKeys && m.cobKeys.length) {
      demo.cob = {};
      for (const k of m.cobKeys) { const xs = ds.filter((x) => x.cob && x.cob[k] != null); demo.cob[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x.cob[k]))) / sum(xs.map((x) => x.p)) : null; }
    }
    // the Religion and Housing-tenure select pools, same vote-weighted way
    if (m.relKeys && m.relKeys.length) {
      demo.rel = {};
      for (const k of m.relKeys) { const xs = ds.filter((x) => x.rel && x.rel[k] != null); demo.rel[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x.rel[k]))) / sum(xs.map((x) => x.p)) : null; }
    }
    if (m.tenKeys && m.tenKeys.length) {
      demo.ten = {};
      for (const k of m.tenKeys) { const xs = ds.filter((x) => x.ten && x.ten[k] != null); demo.ten[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x.ten[k]))) / sum(xs.map((x) => x.p)) : null; }
    }
    if (m.ancKeys && m.ancKeys.length) {
      demo.anc = {};
      for (const k of m.ancKeys) { const xs = ds.filter((x) => x.anc && x.anc[k] != null); demo.anc[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x.anc[k]))) / sum(xs.map((x) => x.p)) : null; }
    }
  }
  return demo;
}
function deriveAreas(res, m) {
  const out = {};
  for (const st of ["AUS", ...STATES]) {
    const a = res.agg[st];
    if (!a) continue;
    const fp = {}, fpSw = {};
    // the previous election's statewide tally rides along where one is stored
    const hasPrev = a.pprim != null && a.pformal != null;
    for (const b of FAMS) { fp[b] = (100 * a.prim[b]) / a.formal; fpSw[b] = hasPrev ? fp[b] - (100 * a.pprim[b]) / a.pformal : null; }
    const idx = m.divs.filter((d) => st === "AUS" || d.st === st).map((d) => d.i);
    // census shares pooled over the seats' vote-weighted populations, in percent (demoOf)
    const demo = demoOf(m, idx);
    // the lens-level exhausted share is counted off the divisions' own flow rows
    const exd = idx.map((i) => m.divs[i]).filter((d) => d.exhPct != null);
    const exhPct = exd.length ? (100 * sum(exd.map((d) => (d.exhPct / 100) * d.formal))) / sum(exd.map((d) => d.formal)) : null;
    // state frames store no ready swing; like the primary lane they carry the previous election's
    // two-party totals, so the change reads off those (stamp-agg-prev-tpp.mjs fills agg.ptpp)
    const t2 = (100 * a.tpp[0]) / (a.tpp[0] + a.tpp[1]);
    const tppSw = a.tpp[2] != null ? a.tpp[2] : a.ptpp && a.ptpp[0] + a.ptpp[1] ? t2 - (100 * a.ptpp[0]) / (a.ptpp[0] + a.ptpp[1]) : null;
    out[st] = { st, fp, fpSw, tpp: t2, tppSw, infPct: (100 * a.inf) / (a.inf + a.formal), exhPct, idx, formal: a.formal, demo };
  }
  return out;
}

// Handbook files retain the original coordinates. Apply D3 winding and
// linear-coordinate resampling only while drawing; the source is unchanged.
// The main viewport uses mainland parts; external islands have their insets.
// A seat's mainland polygons come back as flat [lon, lat, ...] rings, closing point
// kept: each edge cut into pieces of at most 0.05° (so the plane draws it straight in
// lon/lat, not as a great circle), each ring wound as d3 reads it (outer clockwise).
// The winding is read off the ring's planar area, which agrees with d3.geoArea on
// every Handbook ring and costs a three-hundredth of it (2026-11-01); a ring of next
// to no area still asks d3.geoArea, as every ring once did
const hbPairs = (r) => { const o = new Array(r.length >> 1); for (let i = 0; i < r.length; i += 2) o[i >> 1] = [r[i], r[i + 1]]; return o; };
function handbookRings(f) {
  const ps = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return ps.filter(p => p[0].some(([x,y]) => x >= 112 && x <= 154.5 && y >= -44.5 && y <= -9)).map(p => p.map((ring, ri) => {
    const pieces = (a, b) => Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / .05));
    let n = 1;
    for (let i = 0; i < ring.length - 1; i++) n += pieces(ring[i], ring[i+1]);
    const r = new Float64Array(2 * n);
    let w = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i+1], k = pieces(a, b);
      for (let j = 0; j < k; j++) { r[w++] = a[0]+(b[0]-a[0])*j/k; r[w++] = a[1]+(b[1]-a[1])*j/k; }
    }
    r[w++] = r[0]; r[w++] = r[1];
    let s2 = 0;
    for (let i = 0; i < r.length - 2; i += 2) s2 += r[i] * r[i+3] - r[i+2] * r[i+1];
    const inverted = Math.abs(s2) > 1e-6 ? s2 > 0 : d3.geoArea({type:"Polygon", coordinates:[hbPairs(r)]}) > 2*Math.PI;
    if (inverted === (ri === 0)) for (let i = 0, j = r.length - 2; i < j; i += 2, j -= 2) { const x = r[i], y = r[i+1]; r[i] = r[j]; r[i+1] = r[j+1]; r[j] = x; r[j+1] = y; }
    return r;
  }));
}
/* a frame's seats on the plane, each topology arc projected once (2026-11-01).
   d3.geoPath walked every arc four to six times - once for each seat on either
   side of it, again for the seats' bounds, again for each mesh - and the hi
   geometry's build was a ~1s long task that landed in the middle of the year
   morph. Here each arc goes through the projection's own stream once (its
   rotation, clip and adaptive resampling: the very points d3.geoPath draws, as
   test-map-geo-build checks against it), and a seat's rings, its bounds and the
   meshes are those arcs end to end. A generator, so warmHi can run it in slices
   between frames; buildGeo runs it straight through */
// /*@geo-core:begin*/
function arcProjector(topo, P) {
  const tr = topo.transform, kx = tr ? tr.scale[0] : 1, ky = tr ? tr.scale[1] : 1, dx = tr ? tr.translate[0] : 0, dy = tr ? tr.translate[1] : 0;
  let buf = [];
  const st = P.stream({ point(x, y) { buf.push(x, y); }, lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} });
  const out = new Array(topo.arcs.length);
  const one = (i) => {
    const a = topo.arcs[i];
    buf = [];
    st.lineStart();
    if (tr) { let x = 0, y = 0; for (let k = 0; k < a.length; k++) { x += a[k][0]; y += a[k][1]; st.point(x * kx + dx, y * ky + dy); } }
    else for (let k = 0; k < a.length; k++) st.point(a[k][0], a[k][1]);
    st.lineEnd();
    return (out[i] = Float64Array.from(buf));
  };
  return { n: out.length, one, get: (i) => out[i] || one(i) };
}
// a run of arcs end to end into a path, as topojson joins them: each arc after the
// first drops the point it shares with the one before; a ring (close) also drops its
// last point, the first again, and closes instead, as d3's polygon stream does; bx,
// when given, takes the run's bounds [x0, y0, x1, y1]. A ring is drawn in a path of
// its own and added: Chrome's closePath costs the length of the whole path it closes
// in, so a seat of a thousand islands paid for itself a thousand times
function arcsTo(p0, run, A, close, bx) {
  const p = close ? new Path2D() : p0;
  let first = true;
  for (let r = 0; r < run.length; r++) {
    const ai = run[r], pts = A.get(ai < 0 ? ~ai : ai), n = pts.length >> 1, end = close && r === run.length - 1 ? n - 1 : n;
    for (let s = r ? 1 : 0; s < end; s++) {
      const k = ai < 0 ? n - 1 - s : s, x = pts[2 * k], y = pts[2 * k + 1];
      if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
      if (bx) { if (x < bx[0]) bx[0] = x; if (x > bx[2]) bx[2] = x; if (y < bx[1]) bx[1] = y; if (y > bx[3]) bx[3] = y; }
    }
  }
  if (close && !first) { p.closePath(); p0.addPath(p); }
}
function* geoSteps(topo, m, P) {
  const o = topo.objects.divs, at = (g) => m.byName.get(g.properties.name);
  const A = arcProjector(topo, P);
  // every arc first, in runs (the slices' unit of work)
  for (let i = 0; i < A.n; i++) { A.get(i); if ((i & 255) === 255) yield; }
  const N = m.divs.length, paths = new Array(N), bb = new Array(N), geoms = new Array(N);
  let k = 0;
  for (const g of o.geometries) {
    const i = at(g);
    if (i == null) continue;
    const pg = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    const p = new Path2D(), bx = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poly of pg) for (const ring of poly) arcsTo(p, ring, A, true, bx);
    paths[i] = p; bb[i] = [[bx[0], bx[1]], [bx[2], bx[3]]]; geoms[i] = g;
    if ((++k & 31) === 0) yield;
  }
  const mk = (filter) => { const p = new Path2D(); for (const line of topojson.meshArcs(topo, o, filter).arcs) arcsTo(p, line, A, false); return p; };
  const meshDiv = mk((a, b) => a !== b && a.properties.st === b.properties.st); yield;
  const meshState = mk((a, b) => a !== b && a.properties.st !== b.properties.st); yield;
  const coast = mk((a, b) => a === b);
  // each seat's polygons on the plane, flat [x0, y0, x1, y1, ...] rings (the closing point
  // dropped), made when a change of election first morphs them (the year morph, app-2)
  const polyP = [];
  const ringXY = (r) => { const q = new Float64Array(2 * (r.length - 1)); for (let j = 0; j < r.length - 1; j++) { const c = P(r[j]); q[2 * j] = c[0]; q[2 * j + 1] = c[1]; } return q; };
  const polys = (i) => {
    if (polyP[i] || !geoms[i]) return polyP[i] || null;
    const gm = topojson.feature(topo, geoms[i]).geometry, cs = gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates;
    return (polyP[i] = cs.map((pg) => ({ outer: ringXY(pg[0]), holes: pg.slice(1).map(ringXY) })));
  };
  // each seat's coast and its borders with other seats, apart, made when the
  // streets first need them (the streets' own sea draws the coast there)
  const coastP = [], edgeP = [];
  return {
    paths, bb, polys,
    // the topology itself and a geometry's seat, for the seats' waters (app-2)
    topo, at, proj: P,
    meshDiv, meshState, coast,
    coastOf: (i) => coastP[i] || (coastP[i] = mk((a, b) => a === b && at(a) === i)),
    edgeOf: (i) => edgeP[i] || (edgeP[i] = mk((a, b) => a !== b && (at(a) === i || at(b) === i))),
  };
}
// /*@geo-core:end*/
// the whole build at once (a frame's lo geometry, while its election loads)
function buildGeo(topo, m, P = m.proj) {
  const it = geoSteps(topo, m, P);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
// the same build in slices of about a frame's spare time, never during a year morph
// or an election's wait (the hi geometry: warmHi)
async function buildGeoSliced(topo, m, P) {
  const it = geoSteps(topo, m, P), idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 16));
  for (;;) {
    await new Promise((go) => { const w = () => (ymorph || ywait ? setTimeout(w, 120) : idle(go)); w(); });
    const t0 = performance.now();
    for (;;) { const r = it.next(); if (r.done) return r.value; if (performance.now() - t0 > 8) break; }
  }
}

/* the Handbook frame in slices (2026-10-31): decoding the lossless topo and
   building every seat's paths in one synchronous pass froze the tab for
   5–8s on throttled hardware. Two streamed passes instead — decode each seat
   and widen the mainland bbox (the projection's fit), then resample, wind,
   path and outline each one — yielding to the browser whenever a slice runs
   long, so the loading stamp and any year morph keep animating. The bounds
   come free off the path stream (a plane-min/max at emission, gen.bounds'
   exact result), and addPath of each seat's own path is the same outline the
   old full re-walks drew, without the re-walk */
async function buildHandbookGeo(topo, m) {
  const o = topo.objects.divs;
  let t0 = performance.now();
  const pause = async () => { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); };
  const sliceDone = () => performance.now() - t0 > 32;
  // pass one: decode each seat and widen the mainland bbox — fitting its two
  // corners is fitting the whole filtered point cloud, streamed
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const feats = [];
  for (const g of o.geometries) {
    const f = topojson.feature(topo, g);
    const cs = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const pg of cs) for (const ring of pg) for (const [x, y] of ring) if (x >= 112 && x <= 154.5 && y >= -44.5 && y <= -9) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    feats.push(f);
    if (sliceDone()) await pause();
  }
  m.proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], { type: "MultiPoint", coordinates: [[x0, y0], [x1, y1]] });
  // pass two: each seat resampled-and-wound (handbookRings), then pathed: each ring
  // through the projection's own stream as a line, its closing point dropped and the
  // path closed, which is the polygon d3.geoPath draws without its clip's buffering
  // and spherical containment walk (test-map-geo-build compares the two); the bounds
  // are taken at emission
  const P = m.proj;
  const paths = new Array(m.divs.length), bb = new Array(m.divs.length), ringsByDiv = new Array(m.divs.length);
  const outline = new Path2D();
  let p = null, px = 0, py = 0, has = false, first = true, b0 = 0, b1 = 0, b2 = 0, b3 = 0;
  const st = P.stream({ point(x, y) {
    if (has) { if (first) { p.moveTo(px, py); first = false; } else p.lineTo(px, py); if (px < b0) b0 = px; if (px > b2) b2 = px; if (py < b1) b1 = py; if (py > b3) b3 = py; }
    px = x; py = y; has = true;
  }, lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} });
  const pathAndBounds = (rings) => {
    p = new Path2D(); b0 = b1 = Infinity; b2 = b3 = -Infinity;
    const seat = p;
    for (const poly of rings) for (const r of poly) {
      // each ring in a path of its own, added (arcsTo: closePath's cost is its path's length)
      p = new Path2D(); has = false; first = true;
      st.lineStart();
      for (let k = 0; k < r.length; k += 2) st.point(r[k], r[k + 1]);
      st.lineEnd();
      if (!first) { p.closePath(); seat.addPath(p); }
    }
    p = seat;
    return [seat, [[b0, b1], [b2, b3]]];
  };
  for (const f of feats) {
    const i = m.byName.get(f.properties.name);
    const rings = handbookRings(f);
    const [q, b] = pathAndBounds(rings);
    outline.addPath(q);
    if (i != null) { ringsByDiv[i] = rings; paths[i] = q; bb[i] = b; }
    if (sliceDone()) await pause();
  }
  const mk = (g) => { const q = new Path2D(); d3.geoPath(P, q)(g); return q; };
  const polyP = [];
  const ringXY = (r) => { const o = new Float64Array(r.length - 2); for (let k = 0; k < r.length - 2; k += 2) { const c = P([r[k], r[k + 1]]); o[k] = c[0]; o[k + 1] = c[1]; } return o; };
  const polys = (i) => {
    if (polyP[i] || !ringsByDiv[i]) return polyP[i] || null;
    return (polyP[i] = ringsByDiv[i].map((pg) => ({ outer: ringXY(pg[0]), holes: pg.slice(1).map(ringXY) })));
  };
  const ringLines = (i) => ({ type: "MultiLineString", coordinates: ringsByDiv[i].flat().map(hbPairs) });
  const at = (g) => m.byName.get(g.properties.name);
  const coastP = [], edgeP = [];
  if (sliceDone()) await pause();
  return {
    paths, bb, polys, topo, at, proj: P,
    meshDiv: outline,
    meshState: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)),
    coast: outline,
    coastOf: (i) => coastP[i] || (coastP[i] = mk(ringLines(i))),
    edgeOf: (i) => edgeP[i] || (edgeP[i] = mk(ringLines(i))),
  };
}

/* the islands off the mainland frame (map/data/islands.json, from
   .build/map/islands_build.mjs): each one's coast as a path of its own,
   north up in local degrees (x by the cosine of its latitude), its seat in
   this election (owner: the seat its boundary holds it in, null where none
   does - Norfolk Island before 2016) and the seat its polling places count
   in (seat: the owner, else the places' own); and the same coast on the
   map's own plane (mpath, its bounds mbb), where the camera flies out to it */
let islandsP = null;
const loadIslands = () => islandsP || (islandsP = getJSON("/map/data/islands.json").catch(() => null));
function buildIslands(data, m) {
  if (!data) return [];
  // the federal seat islands have no home in a state election's frame
  if (STATE_YEARS.has(m.year)) return [];
  const own = data.owner[m.year === "now" ? 2025 : m.year] || {};
  return data.islands.map((s) => {
    let lon0 = Infinity, lat0 = Infinity, lon1 = -Infinity, lat1 = -Infinity;
    for (const r of s.rings) for (const [x, y] of r) { lon0 = Math.min(lon0, x); lon1 = Math.max(lon1, x); lat0 = Math.min(lat0, y); lat1 = Math.max(lat1, y); }
    const cos = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    const path = new Path2D();
    for (const r of s.rings) { r.forEach(([x, y], i) => (i ? path.lineTo : path.moveTo).call(path, (x - lon0) * cos, lat1 - y)); path.closePath(); }
    const mpath = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of s.rings) {
      r.forEach((ll, i) => { const [x, y] = m.proj(ll); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); (i ? mpath.lineTo : mpath.moveTo).call(mpath, x, y); });
      mpath.closePath();
    }
    const o = own[s.key] != null ? m.byName.get(own[s.key]) : null;
    // a polling place counts as the island's within a few km of its frame
    const near = [s.box[0] - 0.05, s.box[1] - 0.05, s.box[2] + 0.05, s.box[3] + 0.05];
    return { key: s.key, name: s.name, rings: s.rings, path, lon0, lat1, cos, w: (lon1 - lon0) * cos, h: lat1 - lat0, near, owner: o ?? null, seat: o ?? null, booths: [], mpath, mbb: [[x0, y0], [x1, y1]] };
  });
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
function buildSearch(m) {
  const items = [];
  // a state election's frame holds no other states' areas (sa26: SA and AUS only)
  for (const st of STATES) { const a = m.areas[st]; if (!a) continue; items.push({ k: "state", st, t: STATE_TITLE[st], s: `${a.idx.length} seats`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 }); }
  for (const d of m.divs) {
    items.push({ k: "div", i: d.i, t: d.n, s: `${STATE_SHORT[d.st]} · ${d.hold.n}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.n), rank: 1 });
    items.push({ k: "mp", i: d.i, t: d.hold.n, s: `${isNowY(m.year) ? "Member" : "Elected"} for ${d.n}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.hold.n), rank: 2 });
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

/* the "as it stands" overlay: each by-election replaces its district's
   general-election count, booth by booth, and the members' moves rewrite who
   holds the seat today (the federal Now's Farrer lane, generalised for the
   NSW Now's four by-elections — the overlay file's districts are entries,
   never a hardcoded seat) */
function applyNow(m, now) {
  for (const [name, by] of Object.entries(now.byelections || {})) {
    const fi = m.byName.get(name);
    if (fi == null) continue;
    const D = deriveDiv(by.div, fi, m.year);
    D.inf = by.informal; D.infPct = (100 * by.informal) / (by.informal + by.formal); D.vt = null; D.lp = m.divs[fi].lp; D.lpx = m.divs[fi].lpx; D.lpy = m.divs[fi].lpy;
    D.by = { date: by.date, event: by.event ?? by.nswEvent, formal: by.formal, informal: by.informal, turnout: by.turnout, enrolment: by.enrolment, prev: m.divs[fi] };
    D.change = { kind: "by", prev: m.divs[fi].h.filter((h) => !h[4]).pop() };
    m.divs[fi] = D;
    // the base count at each by-election place, by family, for the swings at
    // the same place
    const B0 = m.res.booths, D0 = m.res.divs[fi];
    const fams0 = D0.c.map((c) => c[3]);
    const prevFp = by.booths.prev.map((j) => {
      if (j == null) return null;
      const v = B0.v[j], tot = v.reduce((a, b) => a + b, 0), acc = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 };
      if (!tot) return null;
      v.forEach((x, k) => (acc[fams0[k]] += x));
      for (const f in acc) acc[f] = (100 * acc[f]) / tot;
      return acc;
    });
    const B = m.res.booths, keep = [], hadFp = B.prevFp || [];
    for (let j = 0; j < B.id.length; j++) if (B.d[j] !== fi) keep.push(j);
    const nb = {};
    for (const k of Object.keys(B)) nb[k] = keep.map((j) => B[k][j]);
    const BB = by.booths;
    for (let j = 0; j < BB.id.length; j++) for (const k of Object.keys(B)) nb[k].push(k === "d" ? fi : BB[k] ? BB[k][j] : null);
    // the earlier districts' prevFp ride through — a second by-election only
    // appends its own
    nb.prevFp = keep.map((j) => hadFp[j] == null ? null : hadFp[j]).concat(prevFp);
    m.res = { ...m.res, booths: nb };
  }
  // who sits for each changed seat today
  for (const [name, h] of Object.entries(now.holders)) {
    const i = m.byName.get(name);
    m.divs[i].hold = { n: h.n, ab: h.ab, pn: partyName(h.ab), fam: FAM(h.ab) };
  }
  m.changes = now.changes;
  m.asOf = now.asOf;
}

// the views with a filed seating plan (map/data/seats-<year>.json, from .build/map/seating.mjs,
// .build/map/sa_seating.mjs for the live sa26 chambers, .build/map/sa22_seating.mjs for sa22's,
// .build/map/vic_seating.mjs for vic22's; none is filed for New South Wales, so the nsw23
// chambers fill their benches sorted)
const SEATED = new Set(["now", 2025, 2022, 2019, 2016, 2013, 2010, "sa26", "sa22", "vic22"]);
const SEATED_LC = new Set(["sa26", "vic22"]);
// the Speaker's district where the results files name none: each state's, as its
// Parliament first sat (Dan Cregan, 3 May 2022; Nat Cook, 5 May 2026; Greg Piper, 2 May 2023;
// Shelley Hancock, 2 May 2011; Jonathan O'Dea, 27 May 2019; Christine Fyffe, 24 December 2014;
// Colin Brooks, 27 March 2017)
const SPEAKER_DIV = { sa22: "Kavel", sa26: "Hurtle Vale", nsw15: "South Coast", nsw19: "Davidson", nsw23: "Lake Macquarie", nswnow: "Lake Macquarie", vic14: "Evelyn", vic18: "Bundoora", vic22: "Bendigo West", qld17: "Mulgrave", qld20: "Mulgrave", qld24: "Condamine", qldnow: "Condamine", wa17: "Albany", wa21: "Midland", wa25: "Forrestfield", wanow: "Forrestfield" };
async function loadYear(year, bg) {
  // switching back to an already-loaded year restores that year's projection:
  // sa26's frame fits South Australia, the federal years' the continent
  if (Y[year]) return Y[year].ready.then((mm) => { if (year === S.year) proj = mm.proj; return mm; });
  const m = { year, ready: null };
  Y[year] = m;
  m.ready = (async () => {
    const ry = nowRy(year);
    // the results without the polling places' census lanes (core-split.mjs), unless the
    // lens is reading them now or the page's warmup already asked for the full file
    const fullU = `/map/data/res-${ry}.json`, full = needPpl() || !!(window.__warm && window.__warm[fullU]);
    const [res, lo, now, seating, islands] = await Promise.all([full ? getJSON(fullU, bg) : getJSON(`/map/data/core-${ry}.json`, bg).catch(() => getJSON(fullU, bg)), getJSON(`/map/data/geo-${ry}-lo.json`, bg), isNowY(year) ? getJSON(`/map/data/${NOW_DATA[year]}`, bg) : null,
      SEATED.has(year) ? getJSON(`/map/data/seats-${year}.json`, bg).catch(() => null) : null, loadIslands()]);
    // built under its own m.proj, never the page's: `proj` is the year on screen's alone
    // (setYear hands it over). A load borrowing it, as this one did until 2026-11-05, moved
    // the towns, streets and sea under the year in view for as long as the load ran, seconds
    // for a Handbook year, and outward: a wider fit, so Perth west into the sea, Sydney east
    const fit = lo.handbook ? null : topojson.feature(lo, lo.objects.divs);
    if (!lo.handbook) m.proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], fit);
    m.res = res;
    m.pplLanes = res.pplLanes || null;
    m.ppl = !m.pplLanes; // the census lanes are here (a full file, or a frame with none)
    m.demoBasis = res.demoBasis || null;
    m.demoYear = res.demoYear || null;
    m.incomeCuts = res.incomeCuts || null;
    m.ageCuts = res.ageCuts || null;
    // the people-interp blend record rides the year on interpolated years
    // (2007–2019); the demo copy and income epoch texts branch on it
    m.demoInterp = res.demoInterp || null;
    // this year's birthplace-country menu (null where no census people
    // lane exists) and S.cob's positional spot in its B["cob"] rows
    m.cobKeys = res.cobKeys || null;
    m.cobPos = m.cobKeys ? Object.fromEntries(m.cobKeys.map((k, i) => [k, i])) : null;
    // the Religion and Housing-tenure select menus, same positional idiom
    m.relKeys = res.relKeys || null;
    m.relPos = m.relKeys ? Object.fromEntries(m.relKeys.map((k, i) => [k, i])) : null;
    m.tenKeys = res.tenKeys || null;
    m.tenPos = m.tenKeys ? Object.fromEntries(m.tenKeys.map((k, i) => [k, i])) : null;
    // the Ancestry menu + per-option positional map (2026-10-31 lanes arc)
    m.ancKeys = res.ancKeys || null;
    m.ancPos = m.ancKeys ? Object.fromEntries(m.ancKeys.map((k, i) => [k, i])) : null;
    // lane-presence gates: a People lane that carries no figures anywhere
    // this year stays out of its menus and copy (the homeless lane's
    // census floor is the 2011 edition onward — the 2013 election on /
    // 2016-census state frames — and three-or-more-children stands out
    // the 2001 election alone: the 2001 BCP printed no children table;
    // the older census-era floors are ancestry 2001 and schooling
    // 2006, the JTW/citizenship lanes carry the 1991 census, and the
    // income lanes begin on 1991 household-basis prints with the GCP-
    // era adult-basis prints from 2001 — the menu omits whatever the
    // era never printed, confirmed positively null across the year)
    {
      const divs = res.divs || [];
      const any = (k) => divs.some((d) => d.demo && d.demo[k] != null);
      m.hasLane = Object.fromEntries(DM.map((k) => [k, k === "loinc" || k === "hiinc" || k === "hiqinc" ? hasInc({ incomeCuts: res.incomeCuts }) : any(k)]));
      m.hasLane[LENS_INC] = m.hasLane.loinc;
      m.hasLane[LENS_EDU] = m.hasLane.uni;
      // the Advantage indexes joined with their era print only: IRSAD
      // debuts at the 2001-census SEIFA issue (its name, the four-index
      // suite); the '90s frames carry IRSD/IER/IEO alone, so their menu
      // omits the index the era never scored
      m.hasIx = Object.fromEntries(IX.map((k) => [k, divs.some((d) => d.seifa && d.seifa[k] && d.seifa[k].dec != null)]));
    }
    m.date = res.date;
    m.divs = res.divs.map((d, i) => deriveDiv(d, i, year));
    m.byName = new Map(m.divs.map((d) => [d.n, d.i]));
    if (now) applyNow(m, now);
    m.speaker = m.byName.get(res.speaker ?? SPEAKER_DIV[year]);
    m.seating = seating;
    m.gov = GOV[year];
    m.geo = lo.handbook ? await buildHandbookGeo(lo, m) : buildGeo(lo, m);
    m.isl = buildIslands(islands, m);
    // the booths the year in view actually held — for an "as it stands"
    // frame that's the overlay-corrected lanes in m.res, never the raw
    // event's lanes the frame's base election fetched
    m.booth = m.res.booths ? deriveBooths(m.res.booths, m) : emptyBooths(m);
    for (const s of m.isl) if (s.seat == null && s.booths.length) s.seat = m.booth.d[s.booths[0]];
    m.areas = deriveAreas(res, m);
    // the Handbook years' projection is only built inside their geometry
    // pass (a direct boot on a Handbook year arrives with proj === null);
    // projecting the label points has to wait for it
    for (const d of m.divs) { const p = m.proj(d.lp); d.lpx = p[0]; d.lpy = p[1]; }
    // the national household median joins the AUS pool: medians never
    // pool, so deriveAreas leaves it off, but the incomeCuts record the
    // build stamps carries the year's own national figure
    if (m.incomeCuts && m.incomeCuts.medWeekly != null && m.areas.AUS.demo)
      m.areas.AUS.demo.medIncWeekly = m.incomeCuts.medWeekly;
    // the national median age likewise, beside the incomeCut one
    if (m.ageCuts && m.ageCuts.medAge != null && m.areas.AUS.demo)
      m.areas.AUS.demo.ageMed = m.ageCuts.medAge;
    m.search = buildSearch(m);
    if (year === S.year) proj = m.proj;
    // the hi detail comes up only for a frame the reader actually visits (warmHi):
    // preloading paths +15 frames and building all their hi Path2Ds was the 2026-10
    // long-task storm. The Handbook years are lossless at both levels: no hi download
    if (lo.handbook) m.geoHi = m.geo;
    return m;
  })();
  return m.ready;
}
/* the polling places' census lanes (core-split.mjs): a frame loads its results
   without them, and the full file comes the first time they're wanted - the Census
   lens's People measures (needPpl) or an opened polling place's neighbourhood -
   its lanes merged into the frame's booths by index (the same file, the same order) */
const needPpl = () => S.lens === "seifa" && isDemo();
function loadPpl(y) {
  const m = Y[y];
  if (!m || !m.divs || m.ppl) return Promise.resolve(m);
  return (m.pplP ??= getJSON(`/map/data/res-${nowRy(y)}.json`).then((full) => {
    const B = m.booth.raw, F = full.booths;
    if (B && F && F.id.length === B.id.length) for (const k of m.pplLanes) if (F[k]) B[k] = F[k];
    m.ppl = true;
    return m;
  }).catch((e) => { m.pplP = null; throw e; }));
}
// the frame in view's lanes, then everything that reads them drawn again (the seats
// never wait: their census figures ride the core file; the places' fill in)
function pplThen(m) {
  if (!m || m.ppl || m.pplP) return;
  loadPpl(m.year).then(() => { if (M() !== m) return; recolor(false); renderLegend(); renderStory(true); if (S.view === "list") renderList(true); }).catch(() => {});
}
/* a frame's hi geometry, fetched the first time it's shown and built in slices
   once it lands and any year morph or election wait is over (buildGeoSliced),
   so it interrupts nothing interactive (built whole, it was a ~1s long task in
   the middle of every first visit's morph).
   geoOf (app-2) draws lo at any zoom until it lands, so a miss just keeps the
   lo edges a little longer — the same shape boot already tolerates */
function warmHi(y) {
  const m = Y[y];
  if (!m || !m.divs || m.geoHi || m._hiP) return m && m._hiP;
  // the hi detail can land after the reader has moved to another year — its paths
  // are baked under this year's own projection, whatever the live one is by then
  const ry = nowRy(y);
  m._hiP = getJSON(`/map/data/geo-${ry}-hi.json`)
    .then((hi) => buildGeoSliced(hi, m, m.proj))
    .then((g) => { m.geoHi = g; schedule(); })
    .catch(() => { m._hiP = null; });
  return m._hiP;
}
/* the frame cache, weighted and capped: a Handbook year's lossless geometry holds
   ~140MB against a normal year's ~15MB, so it counts quadruple. Frames the reader
   never viewed (the preload's speculative fills) fall first, the current frame
   never falls; a year morph keeps its own references alive past an eviction, so
   deleting Y[y] here can never hurt the transition in flight */
const FRAME_CAP = 12, FRAME_W = (y) => (HANDBOOK_YEARS.has(y) ? 4 : 1);
const frameLoad = () => Object.keys(Y).reduce((w, k) => w + (Y[k].divs ? FRAME_W(yearOf(k)) : 0), 0);
// a frame stays while it's the one in view; walks past the cap drop the
// least-recently-viewed ones, never-viewed preload fills first
function evictFrames() {
  const ks = Object.keys(Y).filter((k) => Y[k].divs);
  let load = ks.reduce((w, k) => w + FRAME_W(yearOf(k)), 0);
  while (load > FRAME_CAP) {
    const cand = ks.filter((k) => String(S.year) !== String(yearOf(k)));
    if (!cand.length) break;
    cand.sort((a, b) => (Y[a].viewedAt || 0) - (Y[b].viewedAt || 0));
    const k = cand[0];
    load -= FRAME_W(yearOf(k));
    delete Y[k];
    ks.splice(ks.indexOf(k), 1);
  }
}
const M = () => (Y[S.year] && Y[S.year].divs ? Y[S.year] : null);
// "the previous election" is defined only within the federal chain — a state stop's
// predecessor is its own older state election, stored on its frame (res.prev), never
// the federal year its index sits beside
const prevYearOf = (y) => (y === "now" ? 2025 : STATE_YEARS.has(y) ? null : y === 2004 ? 2001 : YEARS_FED[YEARS_FED.indexOf(y) - 1] || null);

/* =============================== lens values =============================== */
// the colour a seat wears: in "Now" the Winner lens reads who holds the seat today
function divValue(m, i) {
  const d = m.divs[i];
  switch (S.lens) {
    case "winner": return holdFam(d.hold);
    case "tpp": return S.tppMode === "swing" ? nn(d.tppSw) : axisNow(m) !== "AC" ? axisSeat(m, i) : nn(d.tpp);
    case "fp": return S.fpMode === "change" ? fpChange(m, d, S.party) : d.fp[S.party];
    case "senate": return senDivValue(m, d);
    case "senpref": return spDivValue(m, d);
    case "flow": return flowSeat(d) ? nn(d.flowAlp[S.from]) : null;
    case "informal": return infModeOf(m) === "exhaust" ? nn(d.exhPct) : nn(d.infPct);
    case "cls": return d.cls || null;
    case "seifa": {
      if (!isDemo()) return nn(d.seifa[S.index] && d.seifa[S.index].dec);
      // the income median prices divisions in dollars (no % scaling) —
      // the pinned share idiom below stays backed by every other lane
      if (incMed()) { const v = d.demo && d.demo.medIncWeekly; return v == null ? null : v; }
      // the median age prices divisions in years on the same doctrine
      if (ageMed()) { const v = d.demo && d.demo.ageMed; return v == null ? null : v; }
      const v = demoShare(d); return v == null ? null : 100 * v;
    }
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
    case "tpp": return S.tppMode === "swing" ? nn(b.tppSw[j]) : axisNow(m) !== "AC" ? axisBooth(m, j) : nn(b.tpp[j]);
    case "fp": {
      if (S.fpMode !== "change") return nn(b.fp[S.party][j]);
      const pf = b.raw.prevFp ? b.raw.prevFp[j] : null;
      if (!pf) return null;
      const v = b.fp[S.party][j];
      return Number.isNaN(v) ? null : v - pf[S.party];
    }
    case "flow": return flowSeat(m.divs[b.d[j]]) ? nn(b.flowAlp[S.from][j]) : null;
    case "senate": return senBoothValue(m, j);
    case "senpref": return spBoothValue(m, j);
    case "informal": return infModeOf(m) === "exhaust" ? nn(m.divs[b.d[j]].exhPct) : nn(b.infPct[j]);
    case "cls": return m.divs[b.d[j]].cls || null;
    case "seifa": {
      // the income median reads its own dollar lane, never a share cell
      if (incMed()) { const v = b.raw.medinc ? b.raw.medinc[j] : null; return v == null ? null : v; }
      // the median age reads its own year-lane, likewise never a share
      if (ageMed()) { const v = b.raw.ageMed ? b.raw.ageMed[j] : null; return v == null ? null : v; }
      if (isDemo()) { const v = demoBoothShare(b.raw, j, selPos(m)); return v == null ? null : 100 * v; }
      const arr = seifaBasis(m) === "voters" ? b.raw.vdec[j] : b.raw.dec[j]; return arr ? nn(arr[IX.indexOf(S.index)]) : null;
    }
  }
  return null;
}
const dIdx = (u) => Math.round(clamp(u, -1, 1) * 100) + 100;
function colorOf(v) {
  if (v == null) return null;
  switch (S.lens) {
    case "winner": return TH.party[v];
    case "tpp": return S.tppMode === "swing" ? RAMP.div[dIdx(-v / 10)] : axisNow(M()) !== "AC" ? axisRamp()[dIdx((50 - v) / axisSpan())] : RAMP.div[dIdx((50 - v) / 20)];
    case "fp": return S.fpMode === "change"
      ? (v >= 0 ? RAMP.gain[S.party][Math.round(clamp(v / 15, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 15, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
    case "flow": return (S.vs === "onp" ? RAMP.divOn : RAMP.div)[dIdx((50 - v) / 40)];
    case "senpref": return spRamp()[dIdx((50 - v) / 40)];
    // the Senate gap reads as a change does: the party's own ramp above zero, the warm grey of losses below
    case "senate": return senGap()
      ? (v >= 0 ? RAMP.gain[S.party][Math.round(clamp(v / 10, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 10, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
    case "informal": return RAMP.inf[Math.round(clamp(v / infHi(), 0, 1) * 100)];
    case "cls": { const k = CLS.indexOf(v); return k < 0 ? null : TH.cls[k]; }
    case "seifa": {
      if (!isDemo()) return RAMP.seifa[Math.round(((v - 1) / 9) * 100)];
      const [lo, hi] = demoRange(); return demoRamp()[Math.round(clamp((v - lo) / (hi - lo), 0, 1) * 100)];
    }
  }
  return null;
}
const lensNumeric = () => !(S.lens === "winner" || S.lens === "cls");

/* =============================== colours per year =============================== */
let fade = null, fadeT = 1;
function recolor(animate) {
  if (needPpl()) pplThen(M()); // the polling places' census lanes, the first time a People measure is shown
  for (const m of [...Object.values(Y), ...Object.values(SENY)]) {
    if (!m || !m.divs) continue;
    if (animate && m.divCol && !reduceMotion) { m.prevDivCol = m.divCol; m.prevBoothCol = m.boothCol; }
    else { m.prevDivCol = null; m.prevBoothCol = null; }
    if (m.house === "senate") { m.divCol = m.divs.map((d) => senateColor(m, d)); continue; }
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
// touch: a touch scroll belongs to the page where the map can't take it — on
// the chamber always, and on the map while it sits at the whole-country fit.
// Only a zoomed-in map claims finger gestures (pinch, pan) from the page.
function updateTouch() {
  const ta = S.view === "map" && T.k > HOME.k * 1.001 ? "none" : "pan-y";
  if (canvas.style.touchAction !== ta) canvas.style.touchAction = ta;
}
const zoom = d3.zoom().scaleExtent([0.5, 2600]).clickDistance(6)
  // the wheel is ours (pan on a trackpad, zoom on a mouse wheel or a pinch).
  // At the whole-country fit d3 sits touch out entirely — its preventDefault
  // on touchmove would steal the page scroll it can't use; pinch-in from
  // there is the small handler below
  .filter((e) => S.view === "map" && e.type !== "wheel" && !e.button && !(e.type === "dblclick")
    && !(e.type === "touchstart" && T.k <= HOME.k * 1.001))
  .on("start", (e) => {
    // a real grab (mouse, touch) ends any running zoom ease or glide; their own
    // programmatic transforms arrive sourceEvent-less and pass through
    if (!e.sourceEvent) return;
    glideCancel();
    if (e.sourceEvent.type === "mousedown") canvas.classList.add("grabbing");
  })
  .on("zoom", (e) => { T = e.transform; schedule(); updateHint(); legendIfChanged(); updateTouch(); })
  .on("end", () => { canvas.classList.remove("grabbing"); homeFromIsland(); });
d3.select(canvas).call(zoom).on("dblclick.zoom", null);
updateTouch();

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
const quietAll = () => (drawOf(M()) === "surface" || drawOf(M()) === "areas" ? 0 : 0.72 * smooth(K_ALL * 0.75, K_ALL * 1.15, T.k));
function quietness(i, now) {
  const all = quietAll();
  if (i === selDiv()) return Math.max(all, 0.72 * clamp((now - quietSince) / 450, 0, 1));
  return all;
}
// streetA: how strongly the streets show between the fills and the borders
// (only for the year in view; the frame passes it once per paint)
//
// From street zoom Esri's coast is the map's only one (prepStreets, laySea):
// the AEC's is coarse, 10-40m off Esri's along most shores and hundreds of
// metres where it rounds an islet away, and it leaves out whole rocks Esri
// draws (the Hogan and Kent Groups'). So under the fills each seat claims the
// land nearest its own coast - its waters, below - and the sea mask cuts them
// back to Esri's land: every bit of land Esri draws takes the colour of the
// seat whose coast lies nearest it. Esri's coast takes over from the AEC's as
// the zoom passes the streets' first stretch (seaA), tile by tile as their
// seas arrive (st.known), so neither coast ever jumps to the other.
const seaA = () => smooth(STREETS.k0, STREETS.k0 * 1.4, T.k);
// the paint's sea cut, for drawFocus: the year it was cut for and how far it has taken over
let seaNow = null;
const inBox = (b, x0, y0, x1, y1) => b && !(b[1][0] < x0 || b[0][0] > x1 || b[1][1] < y0 || b[0][1] > y1);

/* ----- the ocean -----
   An atlas's sea under the seats: pale blue paper ruled with the lines of
   latitude and longitude every 10 degrees, the waters named over it
   (drawSeaNames). A state's frame lays the rest of the country beneath its
   seats as plain land, so Australia always sits whole on the sea.
   The paper's grain is a seamless tile made here once a theme, from a fixed
   seed so every load lays the same sheet: soft mottling, a fine grain, a
   scatter of fibres. It rides the map as it pans and keeps its size as it
   zooms: two copies of the tile an octave apart, each pinned to the map,
   the finer coming up as the zoom doubles, so the paper neither swells with
   the map nor slides under the land.
   The lines are the projection's own. An equal-area conic draws every
   parallel as an arc of a circle about one apex and every meridian as a ray
   from it, so they are drawn as just that, worked out on the screen in full
   precision: an arc stroked through the map's transform turns to chords at
   street zoom (and to float error past it); these hold at every zoom. The
   Tropic of Capricorn runs dashed among them, and every line is marked with
   its degree where it meets the edge of the map (drawGratLabels). */
const PAPER_CSS = 384, GRAT_STEP = 10;
let paperTile = null, oceanA = 1;
function paperOf() {
  const th = TH, n = dpr > 1.25 ? 2 * PAPER_CSS : PAPER_CSS;
  if (paperTile && paperTile._th === th && paperTile.width === n) return paperTile;
  const cv = document.createElement("canvas"); cv.width = cv.height = n; cv._th = th;
  const g = cv.getContext("2d");
  let seed = 0x5eaf00d;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const [mot, grn] = th.dark ? [11, 7] : [16, 9]; // peak to peak, in 0-255 steps
  const [r0, g0, b0] = th.sea;
  // the mottling: value noise on lattices that wrap at the tile's edges, five octaves of it,
  // worked out at a sixth of the tile (Q px a side, ringed with a pixel of its own other side)
  // and smoothed up to the whole, so the tile is made in a few milliseconds and still meets itself
  const oct = [[3, 0.38], [6, 0.26], [12, 0.17], [24, 0.11], [48, 0.08]].map(([p, w]) => { const L = new Float32Array(p * p); for (let i = 0; i < L.length; i++) L[i] = rnd(); return { p, w, L }; });
  const Q = 128, low = document.createElement("canvas"); low.width = low.height = Q + 2;
  const lg = low.getContext("2d"), img = lg.createImageData(Q + 2, Q + 2), d = img.data;
  for (let y = 0; y < Q + 2; y++) for (let x = 0; x < Q + 2; x++) {
    const qx = (x + Q - 1) % Q + 0.5, qy = (y + Q - 1) % Q + 0.5;
    let v = 0;
    for (const { p, w, L } of oct) {
      const fx = (qx / Q) * p, fy = (qy / Q) * p, ix = fx | 0, iy = fy | 0;
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const x1 = (ix + 1) % p, ya = iy * p, yb = ((iy + 1) % p) * p;
      const a = L[ya + ix], b = L[ya + x1], c = L[yb + ix], e = L[yb + x1];
      v += w * (a + (b - a) * tx + (c - a + (a - b - c + e) * tx) * ty);
    }
    const sv = mot * (v - 0.5), k = 4 * (y * (Q + 2) + x);
    d[k] = r0 + sv; d[k + 1] = g0 + sv; d[k + 2] = b0 + sv; d[k + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(low, 1, 1, Q, Q, 0, 0, n, n);
  // the grain: a small square of speckle laid over it all, each speck a touch of white or of
  // ink, its strength set so a step up and a step down weigh alike on the sheet's colour
  const GQ = 128, gr = document.createElement("canvas"); gr.width = gr.height = GQ;
  const gg = gr.getContext("2d"), gi = gg.createImageData(GQ, GQ), gd = gi.data, lum = (r0 + g0 + b0) / 3;
  for (let i = 0; i < GQ * GQ; i++) {
    const sv = grn * (rnd() - 0.5), k = 4 * i, up = sv > 0;
    gd[k] = gd[k + 1] = gd[k + 2] = up ? 255 : 0; gd[k + 3] = Math.round(255 * Math.min(1, Math.abs(sv) / (up ? 255 - lum : lum)));
  }
  gg.putImageData(gi, 0, 0);
  g.fillStyle = g.createPattern(gr, "repeat"); g.fillRect(0, 0, n, n);
  // the fibres: short bent strokes, most lighter than the sheet, a few darker, each drawn
  // again across any edge it crosses so the tile still meets itself
  const u = n / PAPER_CSS;
  g.lineCap = "round";
  for (let i = 0; i < 700; i++) {
    const x = rnd() * n, y = rnd() * n, len = (3 + rnd() * rnd() * 22) * u, a = rnd() * Math.PI, bend = (rnd() - 0.5) * 0.6 * len;
    const dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2, light = rnd() < 0.62, al = rnd();
    g.strokeStyle = light ? `rgba(255,255,255,${th.dark ? 0.035 + 0.04 * al : 0.12 + 0.16 * al})` : th.dark ? `rgba(0,0,0,${0.1 + 0.1 * al})` : `rgba(40,70,100,${0.03 + 0.04 * al})`;
    g.lineWidth = (0.35 + 0.55 * rnd()) * u;
    const bx = (-dy * 2 * bend) / len, by = (dx * 2 * bend) / len;
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
      const cx = x + ox, cy = y + oy;
      if (cx + len < 0 || cx - len > n || cy + len < 0 || cy - len > n) continue;
      g.beginPath(); g.moveTo(cx - dx, cy - dy); g.quadraticCurveTo(cx + bx, cy + by, cx + dx, cy + dy); g.stroke();
    }
  }
  return (paperTile = cv);
}
// the paper over the canvas (within whatever clip is in force): the coarser copy whole and
// the finer over it as the zoom nears its next doubling; under: the order turned for a
// destination-over fill (laySea's, into the holes its cut opens)
function layPaper(alpha, under) {
  const tile = paperOf(), n = tile.width, f = Math.log2(T.k) - Math.floor(Math.log2(T.k));
  if (!tile._pat || tile._ctx !== ctx) { tile._pat = ctx.createPattern(tile, "repeat"); tile._ctx = ctx; }
  const pat = tile._pat, copies = [[2 ** f, 1], [2 ** (f - 1), f]];
  if (under) copies.reverse();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = pat;
  for (const [s, a] of copies) {
    if (a < 0.004) continue;
    // (pinned to the map's origin, its offset taken modulo the tile so the pattern's own
    // arithmetic never meets street zoom's millions of pixels)
    const side = PAPER_CSS * dpr * s, sc = side / n, mod = (v) => ((v % side) + side) % side;
    pat.setTransform(new DOMMatrix([sc, 0, 0, sc, mod(dpr * T.x), mod(dpr * T.y)]));
    ctx.globalAlpha = alpha * a; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}
/* @grat-begin (test-map-ocean.mjs runs this against d3's own projection) */
// the Tropic of Capricorn: the sun's southernmost noon overhead, at the Earth's mean axial
// tilt for 2026 (IAU 2006: 23° 26′ 09″)
const TROPIC = -23.4358;
// a line's degree as an atlas marks it: 30°S, 130°E, the equator and the antimeridian bare
const degLat = (lat) => (lat ? `${Math.abs(lat)}°${lat < 0 ? "S" : "N"}` : "0°");
const degLon = (lon) => { const l = ((((lon + 180) % 360) + 360) % 360) - 180; return l === 0 || l === -180 ? `${Math.abs(l)}°` : `${Math.abs(l)}°${l > 0 ? "E" : "W"}`; };
// a projection's apex and the radius of each parallel's circle, in its plane: the central
// meridian (132E) stands upright, and the apex is where another meridian's ray meets it
function gratOf(P) {
  const k = P.scale(), [tx, ty] = P.translate();
  if (P._grat && P._grat.k === k && P._grat.tx === tx && P._grat.ty === ty) return P._grat;
  const c0 = P([132, -10]), a = P([172, -10]), b = P([172, -60]);
  const C = [c0[0], a[1] + ((c0[0] - a[0]) / (b[0] - a[0])) * (b[1] - a[1])];
  const ang = (lon) => { const p = P([lon, -30]); return Math.atan2(p[1] - C[1], p[0] - C[0]); };
  const R = new Map();
  for (let lat = -80; lat <= 80; lat += GRAT_STEP) { const p = P([132, lat]); R.set(lat, Math.hypot(p[0] - C[0], p[1] - C[1])); }
  // a meridian's angle runs straight with its longitude (t0 at 132E, dt a degree)
  const pt = P([132, TROPIC]), Rt = Math.hypot(pt[0] - C[0], pt[1] - C[1]);
  return (P._grat = { k, tx, ty, C, t0: ang(132), dt: (ang(142) - ang(122)) / 20, R, Rt });
}
/* @grat-end */
// the lines of latitude and longitude every GRAT_STEP degrees; under: see layPaper
function layGrat(m, alpha) {
  const P = m && m.proj; if (!P) return;
  const G = gratOf(P), s = dpr * T.k, cx = dpr * T.x + s * G.C[0], cy = dpr * T.y + s * G.C[1];
  const x0 = -4, y0 = -4, x1 = canvas.width + 4, y1 = canvas.height + 4;
  // the view as the apex sees it: how near and far it lies, the angles it spans
  const inside = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  const near = Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(y0 - cy, 0, cy - y1));
  const mid = Math.atan2((y0 + y1) / 2 - cy, (x0 + x1) / 2 - cx);
  let far = 0, a0 = inside ? mid - Math.PI : Infinity, a1 = inside ? mid + Math.PI : -Infinity;
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    far = Math.max(far, Math.hypot(x - cx, y - cy));
    if (inside) continue;
    let a = Math.atan2(y - cy, x - cx) - mid; a -= 2 * Math.PI * Math.round(a / (2 * Math.PI));
    a0 = Math.min(a0, mid + a); a1 = Math.max(a1, mid + a);
  }
  // the fan the whole round of longitude spans, turned to the view's side of the apex
  const t0 = G.t0 + 2 * Math.PI * Math.round((mid - G.t0) / (2 * Math.PI)), half = 180 * Math.abs(G.dt);
  const lo = Math.max(a0, t0 - half), hi = Math.min(a1, t0 + half);
  if (hi <= lo) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha; ctx.strokeStyle = css(TH.seaLine); ctx.lineWidth = Math.max(1, 0.8 * dpr); ctx.lineJoin = "round";
  ctx.beginPath();
  // each parallel: its circle sampled across the view, chords within a tenth of a pixel of the arc
  const arc = (r) => {
    const step = Math.min(0.02, Math.sqrt(0.8 / r)), nseg = Math.ceil((hi - lo) / step);
    for (let i = 0; i <= nseg; i++) { const t = lo + ((hi - lo) * i) / nseg, x = cx + r * Math.cos(t), y = cy + r * Math.sin(t); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  };
  for (const r0 of G.R.values()) { const r = s * r0; if (r >= near - 2 && r <= far + 2) arc(r); }
  // each meridian: its ray from 80S to 80N, cut to the view, from 40W east round
  // to 50W (the projection's own cut lies between them, at 48W, opposite 132E)
  const rA = s * G.R.get(-80), rB = s * G.R.get(80);
  for (let lon = -40; lon <= 310; lon += GRAT_STEP) {
    const t = t0 + (lon - 132) * G.dt; if (t < lo - 1e-3 || t > hi + 1e-3) continue;
    const ux = Math.cos(t), uy = Math.sin(t);
    let u0 = Math.min(rA, rB), u1 = Math.max(rA, rB);
    const cut = (d, a, b) => {
      if (Math.abs(d) < 1e-12) return a <= 0 && b >= 0;
      let p = a / d, q = b / d; if (p > q) [p, q] = [q, p];
      u0 = Math.max(u0, p); u1 = Math.min(u1, q); return u0 < u1;
    };
    if (!cut(ux, x0 - cx, x1 - cx) || !cut(uy, y0 - cy, y1 - cy)) continue;
    ctx.moveTo(cx + u0 * ux, cy + u0 * uy); ctx.lineTo(cx + u1 * ux, cy + u1 * uy);
  }
  ctx.stroke();
  // the Tropic of Capricorn, dashed, its dashes counted from the fan's western end so they
  // hold their places on the map as it pans
  const rt = s * G.Rt;
  if (rt >= near - 2 && rt <= far + 2) {
    const dash = [5 * dpr, 3.5 * dpr], per = dash[0] + dash[1];
    ctx.setLineDash(dash); ctx.lineDashOffset = (rt * (lo - (t0 - half))) % per;
    ctx.beginPath(); arc(rt); ctx.stroke();
  }
  ctx.restore();
}
// the country as plain land, one shape a state (map/data/land.json, land_build.mjs), made
// in a frame's own plane once it's first wanted: each state's shape and bounds, its coast
// (none for the frame's own state, whose coast the frame draws) and its lines with the
// other states shown. Past K_HI, where a frame's own seats turn hi, the thinned hi
// coast (land-hi.json) takes over once it's in hand.
let LAND = null, LAND_HI = null, landP = null, landHiP = null;
const loadLand = () => landP || (landP = getJSON("/map/data/land.json").then((t) => { LAND = t; schedule(); }).catch(() => { landP = null; }));
const loadLandHi = () => landHiP || (landHiP = getJSON("/map/data/land-hi.json", true).then((t) => { LAND_HI = t; schedule(); }).catch(() => { landHiP = null; }));
function landOf(m, hi) {
  const topo = hi ? LAND_HI : LAND, key = hi ? "_landHi" : "_land";
  if (!topo) { if (hi) loadLandHi(); else loadLand(); return null; }
  if (m[key] && m[key].P === m.proj) return m[key];
  const o = topo.objects.land, mine = (g) => inFrame(m, g.properties.st), path = d3.geoPath(m.proj);
  const mk = (g) => { const p = new Path2D(); d3.geoPath(m.proj, p)(g); return p; };
  const states = o.geometries.map((g) => {
    const f = topojson.feature(topo, g), st = g.properties.st;
    return {
      st, mine: mine(g), path: mk(f), bb: path.bounds(f),
      coast: mk(topojson.mesh(topo, o, (a, b) => a === b && a.properties.st === st && !mine(a))),
      lines: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st === st && !mine(a) && !mine(b))),
    };
  });
  return (m[key] = { P: m.proj, states });
}
// all: the frame's own state too (under a change of frame, where both maps are part-seen)
function layLand(m, alpha, all) {
  const hiK = T.k > K_HI, L = (hiK && landOf(m, true)) || landOf(m, false); if (!L) return;
  const th = TH, [x0, y0, x1, y1] = viewBox(), shown = L.states.filter((s) => (all || !s.mine) && inBox(s.bb, x0, y0, x1, y1));
  if (!shown.length) return;
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y); ctx.globalAlpha = alpha; ctx.lineJoin = "round";
  // (and a pixel and a half of the same paper round each, so no sea opens along the frame's
  // own border where the two sources draw it a little apart)
  ctx.fillStyle = ctx.strokeStyle = css(th.bg); ctx.lineWidth = 1.5 / T.k;
  for (const s of shown) { ctx.fill(s.path); ctx.stroke(s.path); }
  ctx.lineWidth = 0.7 / T.k;
  ctx.strokeStyle = css(th.coast, 0.3); for (const s of shown) ctx.stroke(s.lines);
  ctx.strokeStyle = css(th.coast, 0.55); for (const s of shown) ctx.stroke(s.coast);
  ctx.restore();
}
// the sea beneath a frame, at alpha (the map's own, fading into the chamber)
function drawOcean(m, alpha) {
  oceanA = alpha;
  layPaper(alpha);
  layGrat(m, alpha);
  const cross = !!(ymorph && ymorph.to === m && ymorph.cross);
  if (cross || STATE_YEARS.has(m.year)) layLand(m, alpha, cross);
}
// the sea again, beneath what's drawn: into the holes a cut has opened (laySea)
function oceanUnder(m) {
  ctx.save(); ctx.globalCompositeOperation = "destination-over";
  layGrat(m, oceanA); layPaper(oceanA, true);
  ctx.restore();
}

function drawGeo(m, alpha, streetA) {
  const g = geoOf(m), th = TH, now = performance.now();
  const st = streetA > 0 ? prepStreets(streetA) : null;
  const sa = st && st.known ? seaA() : 0;
  if (streetA !== undefined) seaNow = sa > 0 ? { m, sa } : null;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const [x0, y0, x1, y1] = viewBox();
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / (dpr * T.k)));
  const filt = filtersOn();
  // the map's drawing (app-2b-draw.js): balloons stand on plain land; a surface (or the
  // census's own areas raster) is laid through these same fills
  const look = m === M() ? drawLook(m) : null, ball = look ? look.ball : 0, sf = look ? look.sf || look.ar : null;
  if (look) ballNow = ball;
  const fills = [], fillOf = new Array(m.divs.length);
  for (let i = 0; i < m.divs.length; i++) {
    if (!inBox(g.bb[i], x0, y0, x1, y1) && !sa) continue;
    let c = fillDiv(m, i);
    if (ball > 0) c = ball >= 1 || !c ? th.nodata : mixC(c, th.nodata, ball);
    // (another year's map, under a year morph, quiets with the zoom alone)
    const qn = m === M() ? quietness(i, now) : quietAll();
    if (c && qn > 0) c = towards(c, th.bg, qn);
    if (m === M() && qn > 0 && qn < 0.72 && i === selDiv()) needFrame = true;
    fillOf[i] = [c ? css(c) : pat, filt && !passes(m, i), qn];
    if (inBox(g.bb[i], x0, y0, x1, y1)) fills.push(i);
  }
  // the islands where they lie, past the mainland frame: their seat's colour, quieted
  // as it is; plain land in a year no seat holds one
  const isls = (m.isl || []).filter((q) => inBox(q.mbb, x0, y0, x1, y1));
  const islFill = (q) => {
    let c = q.owner == null ? th.nodata : fillDiv(m, q.owner);
    const qn = q.owner != null && m === M() ? quietness(q.owner, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    return [c ? css(c) : pat, filt && q.owner != null && !passes(m, q.owner)];
  };
  if (sa) {
    const islOf = (m.isl || []).map(islFill);
    const waterOf = (lab) => {
      if (lab >= m.divs.length) return islOf[lab - m.divs.length];
      const f = fillOf[lab]; return f && sf && !(sf.none && sf.none[lab]) ? [sf.top, f[1]] : f;
    };
    layWaters(m, g, st, waterOf, alpha * sa);
  }
  const under = !sf || sf.under;
  for (const i of fills) {
    const [f, out] = fillOf[i];
    if (under || (sf.none && sf.none[i])) { ctx.fillStyle = f; ctx.fill(g.paths[i]); }
    if (!sf && out) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(g.paths[i]); }
  }
  if (sf) {
    // the raster through the seats' paths, then along their shared edges (two antialiased
    // fills leave a hairline of what's beneath, which a flat map hides under its seams)
    for (const L of sf.ls) {
      ctx.globalAlpha = alpha * L.a; ctx.fillStyle = L.pat;
      for (const i of fills) if (!(sf.none && sf.none[i])) ctx.fill(g.paths[i]);
      ctx.strokeStyle = L.pat; ctx.lineWidth = 1.2 / T.k; ctx.stroke(g.meshDiv);
    }
    ctx.globalAlpha = alpha;
    for (const i of fills) {
      const [, out, qn] = fillOf[i];
      if (qn > 0 && !(sf.none && sf.none[i])) { ctx.fillStyle = css(th.bg, qn * 0.6); ctx.fill(g.paths[i]); }
      if (out) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(g.paths[i]); }
    }
  }
  for (const q of isls) {
    const [f, out] = islFill(q);
    ctx.fillStyle = f; ctx.fill(q.mpath);
    if (out) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(q.mpath); }
  }
  if (st) layStreets(st);
  // (paper-white seams vanish on plain land, and a surface's own lines are the story: its seats are a faint guide)
  const surfA = look ? look.surf + (look.are || 0) : 0;
  if (ball < 1) { ctx.strokeStyle = css(th.seam, th.seamA * (1 - 0.72 * surfA) * (1 - ball)); ctx.lineWidth = seamW(T.k) / T.k; ctx.stroke(g.meshDiv); }
  if (ball > 0) { ctx.strokeStyle = css(th.coast, 0.3 * ball); ctx.lineWidth = seamW(T.k) / T.k; ctx.stroke(g.meshDiv); }
  ctx.strokeStyle = ball > 0.5 ? css(th.coast, 0.75) : css(th.seam, th.stateA * (1 - 0.35 * surfA)); ctx.lineWidth = 1.3 / T.k; ctx.stroke(g.meshState);
  // the AEC's coast: whole where no sea of Esri's has come in, fading out where one has
  if (sa < 1) {
    const aec = () => { ctx.stroke(g.coast); for (const q of isls) ctx.stroke(q.mpath); };
    ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k;
    if (!sa) aec();
    else {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const out = new Path2D(); out.rect(-1, -1, canvas.width + 2, canvas.height + 2); out.addPath(st.known);
      ctx.clip(out, "evenodd"); ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y); aec(); ctx.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(st.known); ctx.globalAlpha = alpha * (1 - sa);
      ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y); aec(); ctx.restore();
    }
  }
  ctx.restore();
  if (sa) laySea(m, st, alpha * sa);
  if (streetA !== undefined && !sa) warmWaters();
}

/* ----- the seats' waters -----
   The plane cut into the Voronoi cells of every coast vertex (each AEC coast
   arc belongs to the one seat whose ring uses it; the federal islands' coasts
   to their island), each cell its seat's: a seat's waters are the land and sea
   nearer its coast than any other's. Made per square region (WATER_R map units,
   ~27km) as a view first needs one, from the coast points within a region of
   it, under a budget a frame (the rest follow on the next frames, and the view
   in reach of street zoom is made ahead in idle time). */
const WATER_R = 6, WATER_STEP = 0.3, WATER_BUDGET = 4, WATER_REACH = 2;
const rKey = (rx, ry) => (rx + 4096) * 8192 + ry + 4096;
// the coast points, bucketed by region; read off the topology a slice at a time
// (step), so no paint and no idle slice ever carries the whole of it
function watersOf(m, g) {
  if (g.waters) return g.waters;
  const topo = g.topo, n = topo.arcs.length, use = new Uint8Array(n), own = new Int32Array(n).fill(-1);
  for (const gm of topo.objects.divs.geometries) {
    const i = g.at(gm), rs = gm.type === "Polygon" ? gm.arcs : gm.type === "MultiPolygon" ? gm.arcs.flat() : [];
    for (const r of rs) for (const a of r) { const k = a < 0 ? ~a : a; use[k] = Math.min(2, use[k] + 1); own[k] = i ?? -1; }
  }
  return (g.waters = { m, g, use, own, k: 0, isl: 0, done: false, xs: [], ys: [], lab: [], bucket: new Map(), regions: new Map() });
}
function stepWaters(W, budget) {
  const t0 = performance.now(), { g, m } = W, topo = g.topo, tf = topo.transform, P = g.proj, n = topo.arcs.length;
  const put = (x, y, l) => {
    const key = rKey(Math.floor(x / WATER_R), Math.floor(y / WATER_R));
    let b = W.bucket.get(key); if (!b) W.bucket.set(key, (b = []));
    b.push(W.xs.length); W.xs.push(x); W.ys.push(y); W.lab.push(l);
  };
  // a coast line's points, its long straight runs filled in every WATER_STEP so a
  // neighbour's points never reach past the middle of a run
  const line = (pts, l) => {
    let px = 0, py = 0;
    pts.forEach((ll, k) => {
      const [x, y] = P(ll);
      if (k) { const S = Math.ceil(Math.hypot(x - px, y - py) / WATER_STEP); for (let s = 1; s < S; s++) put(px + ((x - px) * s) / S, py + ((y - py) * s) / S, l); }
      put(x, y, l); px = x; py = y;
    });
  };
  while (W.k < n) {
    const k = W.k++;
    if (W.use[k] === 1 && W.own[k] >= 0) {
      let x = 0, y = 0;
      line(tf ? topo.arcs[k].map(([dx, dy]) => [(x += dx) * tf.scale[0] + tf.translate[0], (y += dy) * tf.scale[1] + tf.translate[1]]) : topo.arcs[k], W.own[k]);
    }
    if ((k & 31) === 31 && performance.now() - t0 > budget) return false;
  }
  const isl = m.isl || [];
  while (W.isl < isl.length) { for (const r of isl[W.isl].rings) line(r, m.divs.length + W.isl); W.isl++; }
  W.done = true; W.use = W.own = null;
  return true;
}
// a region's waters: the cells of the coast points within reach of it, cut to its square
function waterRegion(W, rx, ry) {
  const R = WATER_R, ax = rx * R - WATER_REACH, ay = ry * R - WATER_REACH, bx = (rx + 1) * R + WATER_REACH, by = (ry + 1) * R + WATER_REACH;
  let pts = [], labs = [];
  const gather = (reach) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const b = W.bucket.get(rKey(rx + dx, ry + dy)); if (!b) continue;
      for (const k of b) { const x = W.xs[k], y = W.ys[k]; if (!reach || (x >= ax && x <= bx && y >= ay && y <= by)) { pts.push(x, y); labs.push(W.lab[k]); } }
    }
  };
  gather(true);
  // no coast in reach: the nearest coast further off claims it all, if any
  if (!labs.length) gather(false);
  const paths = new Map();
  if (labs.length) {
    const vor = new d3.Delaunay(Float64Array.from(pts)).voronoi([rx * R, ry * R, (rx + 1) * R, (ry + 1) * R]);
    for (let k = 0; k < labs.length; k++) { let p = paths.get(labs[k]); if (!p) paths.set(labs[k], (p = new Path2D())); vor.renderCell(k, p); }
  }
  return paths;
}
// the regions over the view, made while the budget lasts (all false: not all made yet)
function watersInView(m, g, budget) {
  const W = watersOf(m, g), t0 = performance.now(), out = [];
  if (!W.done && (budget < 0 || !stepWaters(W, budget))) return { out, all: false };
  const [x0, y0, x1, y1] = viewBox(), R = WATER_R;
  let all = true;
  for (let rx = Math.floor(x0 / R); rx <= Math.floor(x1 / R); rx++) for (let ry = Math.floor(y0 / R); ry <= Math.floor(y1 / R); ry++) {
    const key = rKey(rx, ry);
    let r = W.regions.get(key);
    if (!r) {
      if (performance.now() - t0 > budget) { all = false; continue; }
      W.regions.set(key, (r = waterRegion(W, rx, ry)));
    }
    if (r.size) out.push(r);
  }
  return { out, all };
}
// the waters on a layer of their own, cut back to Esri's land and laid under the fills
function layWaters(m, g, st, look, a) {
  const { out, all } = watersInView(m, g, WATER_BUDGET);
  if (!all) needFrame = true;
  const L = layer(), W = canvas.width, H = canvas.height;
  L.save(); L.clip(st.known);
  // (under the waters, plain land: Esri's land that no seat's waters reach, as an islet past
  // their regions, or a neighbouring state under a state's frame)
  L.fillStyle = css(TH.bg); L.fillRect(0, 0, W, H);
  L.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  for (const r of out) for (const [lab, p] of r) { const f = look(lab); if (!f) continue; L.fillStyle = f[0]; L.fill(p); if (f[1]) { L.fillStyle = css(TH.bg, 0.8); L.fill(p); } }
  L.restore();
  L.globalCompositeOperation = "destination-out"; L.drawImage(seaCv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(L.canvas, 0, 0, W, H); ctx.restore();
}
// a scratch layer the size of the canvas (the waters, then the veil, each paint)
let scratchLay = null;
function layer() {
  const W = canvas.width, H = canvas.height;
  if (!scratchLay) scratchLay = document.createElement("canvas");
  if (scratchLay.width !== W || scratchLay.height !== H) { scratchLay.width = W; scratchLay.height = H; }
  const L = scratchLay.getContext("2d");
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = "source-over";
  L.clearRect(0, 0, W, H);
  return L;
}
// near street zoom the regions under the view are made ahead, in idle time
let waterIdle = 0;
function warmWaters() {
  if (waterIdle || !window.requestIdleCallback || S.view !== "map" || T.k < STREETS.k0 * 0.5) return;
  const m = M(); if (!m || !m.geoHi) return;
  waterIdle = requestIdleCallback((dl) => {
    waterIdle = 0;
    const m2 = M(); if (!m2 || m2 !== m || !m.geoHi) return;
    const g = m.geoHi, keep = T;
    // the view as it will be at street zoom's door: the same middle, the streets' first zoom
    const c = [(Wpx / 2 - T.x) / T.k, (Hpx / 2 - T.y) / T.k], k = Math.max(T.k, STREETS.k0);
    T = d3.zoomIdentity.translate(Wpx / 2 - c[0] * k, Hpx / 2 - c[1] * k).scale(k);
    let all;
    try { ({ all } = watersInView(m, g, Math.max(1, Math.min(8, dl.timeRemaining() - 2)))); } finally { T = keep; }
    if (!all) warmWaters();
  });
}

// the veil, drawn whole on a layer and laid at its strength, its edge the
// seats' waters (so each stretch of land beyond the AEC's coasts is veiled as
// its colour's seat is): with a seat open (sd) everything but that seat, the
// sea veiled with the rest; with a state open its seats clear and the sea left clear too
function veilSea(sd, a) {
  const m = M(), g = geoOf(m), th = TH, W = canvas.width, H = canvas.height;
  const clear = sd != null ? (i) => i === sd : (i) => m.divs[i].st === S.sel.st;
  const [x0, y0, x1, y1] = viewBox();
  const vis = m.divs.filter((d) => inBox(g.bb[d.i], x0, y0, x1, y1)).map((d) => d.i);
  const isls = (m.isl || []).filter((q) => inBox(q.mbb, x0, y0, x1, y1));
  const islClear = (q) => q.owner != null && clear(q.owner);
  const { out } = watersInView(m, g, -1);
  const labClear = (lab) => (lab < m.divs.length ? clear(lab) : islClear(m.isl[lab - m.divs.length]));
  // a state's veil with none of the other states' seats in view is nothing
  if (sd == null && vis.every(clear) && isls.every(islClear) && out.every((r) => [...r.keys()].every(labClear))) return;
  const L = layer();
  L.fillStyle = css(th.bg);
  if (sd != null) L.fillRect(0, 0, W, H);
  const op = (yes) => { L.globalCompositeOperation = yes ? "destination-out" : "source-over"; };
  L.save(); L.clip(prepKnown);
  L.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  for (const r of out) for (const [lab, p] of r) { op(labClear(lab)); L.fill(p); }
  L.restore();
  L.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  for (const i of vis) { op(clear(i)); L.fill(g.paths[i]); }
  for (const q of isls) { op(islClear(q)); L.fill(q.mpath); }
  L.setTransform(1, 0, 0, 1, 0, 0);
  if (sd != null) {
    L.globalCompositeOperation = "source-over"; L.drawImage(seaCv, 0, 0);
    // the sea mask is drawn black; the veil is the page's colour
    L.globalCompositeOperation = "source-in"; L.fillRect(0, 0, W, H);
  } else { L.globalCompositeOperation = "destination-out"; L.drawImage(seaCv, 0, 0); }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;
  ctx.drawImage(L.canvas, 0, 0);
  ctx.restore();
}
// pathOf: each seat's shape as painted (a year morph passes its seats' shapes mid-change)
function drawFocus(m, pathOf) {
  const g = geoOf(m), th = TH, sd = selDiv(), P = pathOf || ((i) => g.paths[i]);
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  // where Esri's sea has taken the coast (drawGeo) the veil follows the seats'
  // waters and lies on the sea alike, so its edge is never the AEC's coast
  const sea = seaNow && seaNow.m === m && !pathOf ? seaNow : null;
  if (sea && sea.sa > 0.5 && (sd != null || S.sel.level === "state")) {
    veilSea(sd, sd != null ? th.veil : th.veil * 0.85);
  } else if (sd != null) {
    const v = new Path2D(); v.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); v.addPath(P(sd));
    for (const q of m.isl || []) if (q.owner === sd) v.addPath(q.mpath);
    ctx.fillStyle = css(th.bg, th.veil); ctx.fill(v, "evenodd");
  } else if (S.sel.level === "state") {
    ctx.fillStyle = css(th.bg, th.veil * 0.85);
    for (const d of m.divs) if (d.st !== S.sel.st) ctx.fill(P(d.i));
    for (const q of m.isl || []) if (q.owner == null || m.divs[q.owner].st !== S.sel.st) ctx.fill(q.mpath);
  }
  // a seat's outline takes in its islands; its coast is left to the sea's edge where Esri's draws it
  const outline = (i) => {
    if (sea && sea.sa > 0.5) { ctx.stroke(g.edgeOf(i)); return; }
    ctx.stroke(P(i)); for (const q of m.isl || []) if (q.owner === i) ctx.stroke(q.mpath);
  };
  const h = S.hover;
  if (h && h.kind === "div" && h.i !== sd) { ctx.strokeStyle = css(th.ink, 0.9); ctx.lineWidth = 1.6 / T.k; outline(h.i); }
  if (sd != null) { ctx.strokeStyle = css(th.ink); ctx.lineWidth = 2.2 / T.k; outline(sd); }
  ctx.restore();
}

/* ----- the year morph -----
   From one election to another the seats reshape where their boundaries moved
   and recolour as they go. A seat both elections have (by name, else a renamed
   seat by where it lies) has its outline eased from the old to the new, both
   sampled at the union of their own corners so neither end is cut, and its
   colour blended in OKLab; a seat only the new election has comes up beneath
   its neighbours as they give way to it, and one only the old had is covered
   as they take it in. The outlines move together, so neighbours keep meeting;
   the colours sweep the map the way time runs - west to east going forward,
   east to west going back - with a soft sheen on the sweep's front.
   A federal and a state frame share no seats: there the old map fades as the
   new comes up, the camera flying between their frames (setYear). Every
   frame shares one projection but for its scale and offset (loadYear), so one
   frame's plane maps onto another's by a scale and a shift. */
const SWEEP = 0.42;        // of the morph's run, how far behind the first seat the last starts
let ymorph = null;         // the morph under way
const morphCache = new Map();
let ywait = null;          // an election loading: the sheen runs over the old map until it lands
let ovA = 1;               // the booths' and labels' strength: they come up as a morph ends
const jurOf = (y) => YEAR_JUR[y] || "fed";
// the map from one year's plane to another's, and the cameras that show the same ground in each
function frameMap(from, to) {
  const ko = from.proj.scale(), kn = to.proj.scale(), [ox, oy] = from.proj.translate(), [nx, ny] = to.proj.translate(), a = kn / ko;
  return { a, bx: nx - a * ox, by: ny - a * oy };
}
const viaFrame = (t, A) => d3.zoomIdentity.translate(t.x + t.k * A.bx, t.y + t.k * A.by).scale(t.k * A.a);
const intoFrame = (t, A) => d3.zoomIdentity.translate(t.x - (t.k * A.bx) / A.a, t.y - (t.k * A.by) / A.a).scale(t.k / A.a);
// draw under another camera (the old year's, on the new year's plane)
function withT(t, fn) { const keep = T; T = t; try { fn(); } finally { T = keep; } }

const ringArea = (r) => { let s = 0; const n = r.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; s += r[i] * r[j + 1] - r[j] * r[i + 1]; } return s / 2; };
const ringMid = (r) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } return [(x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0)]; };
const ringRev = (r) => { const o = new Float64Array(r.length); for (let i = 0; i < r.length; i += 2) { o[r.length - 2 - i] = r[i]; o[r.length - 1 - i] = r[i + 1]; } return o; };
// a ring's corners by the share of its perimeter they sit at
function ringCum(r) {
  const n = r.length / 2, c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; c[i + 1] = c[i] + Math.hypot(r[2 * j] - r[2 * i], r[2 * j + 1] - r[2 * i + 1]); }
  const L = c[n] || 1;
  for (let i = 0; i <= n; i++) c[i] /= L;
  return c;
}
// the ring's points at the perimeter shares fs (each in [0, 1))
function ringAt(r, c, fs, out) {
  const n = r.length / 2;
  for (let s = 0; s < fs.length; s++) {
    const f = fs[s];
    let lo = 0, hi = n - 1;
    while (lo < hi) { const md = (lo + hi + 1) >> 1; if (c[md] <= f) lo = md; else hi = md - 1; }
    const k = lo, j = (k + 1) % n, seg = c[k + 1] - c[k], u = seg > 0 ? (f - c[k]) / seg : 0;
    out[2 * s] = r[2 * k] + (r[2 * j] - r[2 * k]) * u; out[2 * s + 1] = r[2 * k + 1] + (r[2 * j + 1] - r[2 * k + 1]) * u;
  }
  return out;
}
// two rings as one point list each, matched point to point: the new ring is turned
// to start where the old one does (the turn that moves the points least), and both
// are sampled at every corner of either
const sameRing = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return false; return true; };
function ringPair(a, b) {
  // (a ring the two elections share - most islands, most coasts - stays as it is)
  if (sameRing(a, b)) { const r = Float32Array.from(b); return { a: r, b: r }; }
  if (Math.sign(ringArea(a)) !== Math.sign(ringArea(b))) b = ringRev(b);
  const ca = ringCum(a), cb = ringCum(b);
  const even = (N) => Float64Array.from({ length: N }, (_, k) => k / N);
  // the turn o (in N-ths of the perimeter) that moves N even samples least; the new
  // ring's samples run twice round, so no wrap inside the loop
  const fit = (N, lo, hi) => {
    const sa = ringAt(a, ca, even(N), new Float64Array(2 * N)), sb = ringAt(b, cb, even(N), new Float64Array(4 * N));
    sb.copyWithin(2 * N, 0, 2 * N);
    let best = lo, bd = Infinity;
    for (let o = lo; o <= hi; o++) {
      const off = 2 * (((o % N) + N) % N);
      let d = 0;
      for (let k = 0; k < 2 * N && d < bd; k += 2) { const dx = sa[k] - sb[k + off], dy = sa[k + 1] - sb[k + off + 1]; d += dx * dx + dy * dy; }
      if (d < bd) { bd = d; best = o; }
    }
    return best / N;
  };
  // the turn found coarsely, then finely about it; a small ring needs few samples
  const n0 = clamp((a.length + b.length) >> 2, 8, 32), n1 = n0 * 6;
  const o1 = fit(n0, 0, n0 - 1), phi = (fit(n1, Math.round(o1 * n1) - 4, Math.round(o1 * n1) + 4) + 1) % 1;
  const fb = Array.from(cb.subarray(0, cb.length - 1), (f) => (f - phi + 1) % 1);
  const fs = Float64Array.from(new Set([...ca.subarray(0, ca.length - 1), ...fb, 0])).sort();
  const pa = ringAt(a, ca, fs, new Float32Array(2 * fs.length));
  const pb = ringAt(b, cb, fs.map((f) => (f + phi) % 1), new Float32Array(2 * fs.length));
  return { a: pa, b: pb };
}
// a seat's polygons on the new plane, eased point for point; a piece with no partner
// (an island one election drew and the other didn't) grows from or shrinks to its middle
function seatMorph(pa, pb) {
  const A = pa.map((p) => ({ r: p.outer, m: ringMid(p.outer), ar: Math.abs(ringArea(p.outer)), used: false }));
  const B = pb.map((p) => ({ r: p.outer, m: ringMid(p.outer), ar: Math.abs(ringArea(p.outer)) })).sort((p, q) => q.ar - p.ar);
  A.sort((p, q) => q.ar - p.ar);
  const rings = [];
  B.forEach((q, k) => {
    let best = null, bd = Infinity;
    for (const p of A) {
      if (p.used) continue;
      const d = Math.hypot(p.m[0] - q.m[0], p.m[1] - q.m[1]);
      if ((k === 0 && p === A[0]) || (d < 0.6 * (p.m[2] + q.m[2]) && d < bd)) { best = p; bd = d; if (k === 0) break; }
    }
    if (best) { best.used = true; rings.push(ringPair(best.r, q.r)); }
    else rings.push({ b: Float32Array.from(q.r), cx: q.m[0], cy: q.m[1] });
  });
  for (const p of A) if (!p.used) rings.push({ a: Float32Array.from(p.r), cx: p.m[0], cy: p.m[1] });
  const holes = [];
  for (const p of pb) for (const h of p.holes) holes.push(h);
  return { rings, holes };
}
function morphPath(sm, u) {
  const p = new Path2D();
  for (const q of sm.rings) {
    if (q.a && q.b) {
      const A = q.a, B = q.b;
      for (let i = 0; i < A.length; i += 2) { const x = A[i] + (B[i] - A[i]) * u, y = A[i + 1] + (B[i + 1] - A[i + 1]) * u; if (i) p.lineTo(x, y); else p.moveTo(x, y); }
    } else {
      const R = q.a || q.b, s = q.a ? 1 - u : u;
      if (s <= 0.001) continue;
      for (let i = 0; i < R.length; i += 2) { const x = q.cx + (R[i] - q.cx) * s, y = q.cy + (R[i + 1] - q.cy) * s; if (i) p.lineTo(x, y); else p.moveTo(x, y); }
    }
    p.closePath();
  }
  for (const h of sm.holes) { for (let i = 0; i < h.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, h[i], h[i + 1]); p.closePath(); }
  return p;
}
const sameRings = (pa, pb) => pa.length === pb.length && pa.every((p, k) => sameRing(p.outer, pb[k].outer));
const onPlane = (ps, A) => ps.map((p) => {
  const f = (r) => { const o = new Float64Array(r.length); for (let i = 0; i < r.length; i += 2) { o[i] = A.a * r[i] + A.bx; o[i + 1] = A.a * r[i + 1] + A.by; } return o; };
  return { outer: f(p.outer), holes: p.holes.map(f) };
});
const bbOn = (b, A) => b && [[A.a * b[0][0] + A.bx, A.a * b[0][1] + A.by], [A.a * b[1][0] + A.bx, A.a * b[1][1] + A.by]];
const bbIoU = (p, q) => {
  const ix = Math.max(0, Math.min(p[1][0], q[1][0]) - Math.max(p[0][0], q[0][0])), iy = Math.max(0, Math.min(p[1][1], q[1][1]) - Math.max(p[0][1], q[0][1]));
  const ar = (b) => (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]), i = ix * iy;
  return i / (ar(p) + ar(q) - i || 1);
};
// at street zoom the seats keep the new election's lines from the start, under its streets,
// and only their colours turn (the lens change's fade, from each seat's colour at the old
// election); a seat new to the election turns from its own colour, so nothing flashes
function carryColours(from, to) {
  if (reduceMotion || !from || !to || from === to || jurOf(from.year) !== jurOf(to.year) || !from.divCol || !to.divCol) return;
  for (const y of Object.values(Y)) if (y) { y.prevDivCol = y.prevBoothCol = null; }
  to.prevDivCol = to.divs.map((d, i) => { const j = from.byName.get(d.n); return j != null && from.divCol[j] ? from.divCol[j] : to.divCol[i]; });
  fade = { t0: performance.now(), dur: 700 };
  schedule();
}
// to: the year now shown, from the one before; T1 the camera the map is going to; dir +1
// going forward in time, -1 back. False where it can't run (the streets, reduced motion)
function startYearMorph(from, to, T1, dir) {
  ymorph = null;
  if (reduceMotion || !from || !to || from === to || !from.geo || !to.geo || !Wpx) return false;
  if (T1.k >= STREETS.k0 || T.k >= STREETS.k0) return false;
  // a Handbook frame's lossless rings morph for seconds — its transitions ride
  // the colour sweep alone (carryColours is already running it)
  if (HANDBOOK_YEARS.has(from.year) || HANDBOOK_YEARS.has(to.year)) return false;
  const A = frameMap(from, to), cross = jurOf(from.year) !== jurOf(to.year);
  const hi = T1.k > K_HI && from.geoHi && to.geoHi;
  const go = hi ? from.geoHi : from.geo, gn = hi ? to.geoHi : to.geo;
  const n = to.divs.length, pair = new Int32Array(n).fill(-1);
  if (!cross) {
    const took = new Set();
    for (let i = 0; i < n; i++) { const j = from.byName.get(to.divs[i].n); if (j != null && go.bb[j] && gn.bb[i]) { pair[i] = j; took.add(j); } }
    // a renamed seat (Denison to Clark, Batman to Cooper): the left-over seats that sit on each other
    const cand = [];
    for (let i = 0; i < n; i++) {
      if (pair[i] >= 0 || !gn.bb[i]) continue;
      for (let j = 0; j < from.divs.length; j++) {
        if (took.has(j) || !go.bb[j]) continue;
        const o = bbIoU(gn.bb[i], bbOn(go.bb[j], A)); if (o > 0.35) cand.push([o, i, j]);
      }
    }
    cand.sort((p, q) => q[0] - p[0]);
    for (const [, i, j] of cand) if (pair[i] < 0 && !took.has(j)) { pair[i] = j; took.add(j); }
  }
  // the view the morph ends on, padded: seats out of it change colour only
  const pad = 40 / T1.k, vx0 = -T1.x / T1.k - pad, vy0 = -T1.y / T1.k - pad, vx1 = (Wpx - T1.x) / T1.k + pad, vy1 = (Hpx - T1.y) / T1.k + pad;
  const seen = (b) => b && !(b[1][0] < vx0 || b[0][0] > vx1 || b[1][1] < vy0 || b[0][1] > vy1);
  const seats = new Array(n), lag = new Float32Array(n);
  // the outlines' pairings kept for the last few changes of election, so walking back and forth costs nothing
  const ck = `${from.year}>${to.year}${hi ? "+" : ""}`;
  let cache = morphCache.get(ck);
  if (!cache) { cache = new Map(); morphCache.set(ck, cache); if (morphCache.size > 6) morphCache.delete(morphCache.keys().next().value); }
  for (let i = 0; i < n; i++) {
    const b = gn.bb[i];
    if (b) {
      const xn = clamp((((b[0][0] + b[1][0]) / 2) * T1.k + T1.x) / Wpx, 0, 1), yn = clamp((((b[0][1] + b[1][1]) / 2) * T1.k + T1.y) / Hpx, 0, 1);
      lag[i] = SWEEP * (0.8 * (dir < 0 ? 1 - xn : xn) + 0.2 * yn);
    }
    const j = pair[i], cn = to.divCol[i];
    if (j < 0) { seats[i] = { kind: "new", cn }; continue; }
    const co = from.divCol[j], s = { kind: "same", co, cn, la: co && cn ? rgb2lab(co) : null, lb: co && cn ? rgb2lab(cn) : null };
    seats[i] = s;
    if (!seen(b) && !seen(bbOn(go.bb[j], A))) continue;
    let sm = cache.get(i);
    if (sm === undefined) {
      const pa = go.polys(j), pb = gn.polys(i), pA = pa && pb ? onPlane(pa, A) : null;
      sm = !pA || sameRings(pA, pb) ? null : seatMorph(pA, pb);
      cache.set(i, sm);
    }
    if (sm) { s.kind = "morph"; s.sm = sm; }
  }
  ymorph = { from, to, A, cross, g: gn, seats, lag, dir, pair, t0: performance.now(), dur: cross ? 1350 : 1200, cur: new Array(n) };
  schedule();
  return true;
}
// a seat's colour runs on the sweep; every outline moves at once, in the run's middle
const morphU = (mo, i, t) => ease(clamp((t - mo.lag[i]) / (1 - SWEEP), 0, 1));
const shapeU = (t) => ease(clamp((t - 0.12) / 0.76, 0, 1));
// a seat only one side has comes up on the sweep (quickly: there may be bare paper beneath)
const newA = (mo, u) => (mo.cross ? smooth(0, 0.6, u) : u);
function morphColor(s, u) {
  if (!s.co || !s.cn) return u < 0.5 ? s.co : s.cn;
  if (u <= 0) return s.co; if (u >= 1) return s.cn;
  return lab2rgb([lerp(s.la[0], s.lb[0], u), lerp(s.la[1], s.lb[1], u), lerp(s.la[2], s.lb[2], u)]);
}
// the sheen: a soft band of light across the land at d (the sweep's own measure, 0 at the
// side it starts from to 1 at the far side), at strength a; drawn over what is painted only
function sheen(d, dir, a) {
  if (a <= 0.002) return;
  const th = TH, gx = (dir < 0 ? -0.8 : 0.8) / Wpx, gy = 0.2 / Hpx, gl = Math.hypot(gx, gy), nx = gx / gl, ny = gy / gl;
  // the point at d on the stage's mid-height, and the band's half-width along the sweep
  const px = ((dir < 0 ? 1 - (d - 0.1) / 0.8 : (d - 0.1) / 0.8)) * Wpx, py = Hpx / 2, hw = 0.075 / gl;
  const dark = lumL(th.bg) < 0.5, c = dark ? th.ink : th.bg;
  const grad = ctx.createLinearGradient(px - nx * hw, py - ny * hw, px + nx * hw, py + ny * hw);
  grad.addColorStop(0, css(c, 0)); grad.addColorStop(0.5, css(c, (dark ? 0.16 : 0.4) * a)); grad.addColorStop(1, css(c, 0));
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = grad; ctx.fillRect(0, 0, Wpx, Hpx);
  ctx.restore();
}
// the wait for an election's data: the band crosses the old map, again and again
function waitSheen(now) {
  const w = ywait, e = now - w.t0 - 140;
  if (e <= 0) return;
  const ph = (e / 1300) % 1;
  sheen(-0.15 + 1.3 * ph, w.dir, 0.7 * Math.min(1, e / 300) * Math.sin(Math.PI * ph));
}
// the old election's polling places, going as the new ones come (ovA): drawn on the old
// plane with the open seat as it was then
function drawOldBooths(mo, t) {
  const a = 1 - smooth(0, 0.35, t), old = mo.from, sd = selDiv(), keep = S.sel;
  if (a <= 0 || mo.cross) return;
  const j = sd != null ? mo.pair[sd] : -1;
  S.sel = j >= 0 ? { level: "div", st: old.divs[j].st, div: j } : sd != null ? { level: "aus" } : keep;
  ovA = a;
  try { withT(viaFrame(T, mo.A), () => drawBooths(old)); } finally { S.sel = keep; ovA = 1; }
}
function drawYearMorph(mo, t) {
  const m = mo.to, old = mo.from, th = TH, now = performance.now(), g = mo.g;
  const Co = viaFrame(T, mo.A);
  // under it all, the old map: on a change of frame it fades as the new comes up
  const oldA = mo.cross ? 1 - smooth(0.3, 0.92, t) : 1;
  if (oldA > 0) withT(Co, () => drawGeo(old, oldA));
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / (dpr * T.k)));
  const [x0, y0, x1, y1] = viewBox(), filt = filtersOn();
  const quiet = (i, c) => { const qn = quietness(i, now); return c && qn > 0 ? towards(c, th.bg, qn) : c; };
  const us = new Float32Array(m.divs.length), su = shapeU(t), sd = selDiv();
  // the seats new to this election beneath, then the rest, the open seat last (over
  // whatever its neighbours' moving outlines cut across)
  const order = [];
  for (const pass of ["new", "same", "morph"]) for (let i = 0; i < m.divs.length; i++) if (mo.seats[i].kind === pass && i !== sd) order.push(i);
  if (sd != null) order.push(sd);
  for (const i of order) {
    const s = mo.seats[i], u = (us[i] = morphU(mo, i, t));
    const p = (mo.cur[i] = s.kind === "morph" ? morphPath(s.sm, su) : g.paths[i]);
    if (s.kind !== "morph" && !inBox(g.bb[i], x0, y0, x1, y1)) continue;
    const c = quiet(i, s.kind === "new" ? s.cn : morphColor(s, u));
    ctx.globalAlpha = s.kind === "new" ? newA(mo, u) : 1;
    ctx.fillStyle = c ? css(c) : pat; ctx.fill(p, "evenodd");
    if (filt && !passes(m, i)) { ctx.globalAlpha *= u; ctx.fillStyle = css(th.bg, 0.8); ctx.fill(p, "evenodd"); }
  }
  // the islands where they lie, in their seat's colour as it turns
  for (const q of m.isl || []) {
    if (!inBox(q.mbb, x0, y0, x1, y1)) continue;
    const s = q.owner != null ? mo.seats[q.owner] : null, u = q.owner != null ? us[q.owner] : 1;
    const c = s ? quiet(q.owner, s.kind === "new" ? s.cn : morphColor(s, u)) : th.nodata;
    ctx.globalAlpha = s && s.kind === "new" ? newA(mo, u) : mo.cross ? smooth(0, 0.7, t) : 1;
    ctx.fillStyle = c ? css(c) : pat; ctx.fill(q.mpath);
  }
  ctx.globalAlpha = 1;
  sheen((t - (1 - SWEEP) / 2) / SWEEP, mo.dir, Math.sin(Math.PI * t));
  // the borders as they stand mid-change: each seat's own outline in the paper's colour
  // (the borders between states never move but between frames)
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  ctx.strokeStyle = css(th.seam, th.seamA); ctx.lineWidth = seamW(T.k) / T.k;
  for (let i = 0; i < m.divs.length; i++) {
    const s = mo.seats[i], p = mo.cur[i]; if (!p || (s.kind !== "morph" && !inBox(g.bb[i], x0, y0, x1, y1))) continue;
    ctx.globalAlpha = s.kind === "new" ? newA(mo, us[i]) : 1; ctx.stroke(p);
  }
  ctx.globalAlpha = mo.cross ? smooth(0.15, 0.85, t) : 1;
  ctx.strokeStyle = css(th.seam, th.stateA); ctx.lineWidth = 1.3 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k; ctx.stroke(g.coast);
  for (const q of m.isl || []) ctx.stroke(q.mpath);
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
// Size by recorded formal votes when the source has no informal count.
const boothSizeVotes = (b, j) => Number.isFinite(b.votes[j]) ? b.votes[j] : b.formal[j];
const voteScale = (v) => Math.min(2.5, v <= 4000 ? Math.sqrt(v / 1000) : 2 * Math.pow(v / 4000, 0.25));
const rad = (votes) => Math.max(1.6 + 0.6 * roomy(), dotBase() * voteScale(votes));
// the paper ring that parts overlapping dots, thinner on the small ones
const halo = (r) => clamp(0.18 * r + 0.5, 0.8, 1.6);
// every seat's booths come up over the zoom's last stretch to city zoom
// (K_ALL, where the key and the hint turn to them), not all in one frame
const K_IN = K_ALL * 0.8;
const boothIn = () => smooth(K_IN, K_ALL, T.k);
function visibleBooths(m) {
  const b = m.booth, out = [], sd = selDiv();
  if (sd == null && T.k < K_IN) return out;
  const [x0, y0, x1, y1] = viewBox(), pad = 24 / T.k;
  if (sd != null) for (const j of b.byDiv[sd]) if (!Number.isNaN(b.x[j])) out.push(j);
  // (a surface, or the census areas' own ground, is the reading of the whole ground:
  // only an opened seat lays its own places on either)
  if (T.k >= K_IN && drawOf(m) !== "surface" && drawOf(m) !== "areas") for (let j = 0; j < b.n; j++) {
    if (b.d[j] === sd || b.ty[j] !== 1) continue;
    const x = b.x[j], y = b.y[j];
    if (Number.isNaN(x) || x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
    out.push(j);
  }
  out.sort((a, c) => boothSizeVotes(b, c) - boothSizeVotes(b, a));
  return out;
}
function boothShape(g, ty, x, y, r) {
  g.beginPath();
  if (ty === 5) { const s = r * 0.92; if (g.roundRect) g.roundRect(x - s, y - s, 2 * s, 2 * s, s * 0.32); else g.rect(x - s, y - s, 2 * s, 2 * s); }
  else g.arc(x, y, r, 0, Math.PI * 2);
}
function drawBooths(m) {
  if (ballNow > 0) { m._vis = []; drawBalloons(m, ballNow); return; }
  const list = visibleBooths(m); m._vis = list;
  if (!list.length) return;
  const b = m.booth, th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / dpr));
  const rf = S.f.range && S.listUnit === "booths" ? S.f.range : null, rise = boothIn();
  for (const j of list) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(boothSizeVotes(b, j));
    if (x < -r || y < -r || x > Wpx + r || y > Hpx + r) continue;
    let a = sd != null && b.d[j] !== sd ? 0.5 * rise : b.d[j] === sd ? 1 : rise;
    if (rf && !inRange(boothColValue(m, j, rf.key), rf)) a *= 0.2;
    ctx.globalAlpha = a * ovA;
    boothShape(ctx, b.ty[j], x, y, r + halo(r)); ctx.fillStyle = css(th.bg); ctx.fill();
    const c = fillBooth(m, j);
    boothShape(ctx, b.ty[j], x, y, r); ctx.fillStyle = c ? css(c) : pat; ctx.fill();
  }
  ctx.globalAlpha = ovA;
  const ring = (j, w, col) => { const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(boothSizeVotes(b, j)); boothShape(ctx, b.ty[j], x, y, r + 2.4); ctx.lineWidth = w; ctx.strokeStyle = css(col); ctx.stroke(); };
  if (S.hover && S.hover.kind === "booth") ring(S.hover.i, 1.6, th.ink);
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) ring(S.sel.booth, 2.4, th.ink);
  ctx.restore();
}

// WCAG contrast of two rgb colours (1-21)
const relLum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrastOf = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function drawLabels(m) {
  const th = TH, placed = islDrawn.map((c) => c.box), now = performance.now();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = ovA;
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
    else if ((!tone || tone === th.ink2 || tone === th.ink) && contrastOf(tone || th.ink2, ground) < 4.5) {
      // the page's ink can't hold on a bright fill (the dark page's light grey on One Nation's
      // orange, its halo of the same fill no help): the towns' lettering, a weight lighter
      ctx.lineWidth = 3; ctx.strokeStyle = th.dark ? "#000" : "#fff"; ctx.strokeText(txt, x, y); ctx.fillStyle = th.dark ? "#fff" : "#000";
    } else { ctx.lineWidth = 2.6; ctx.strokeStyle = css(ground, 0.85); ctx.strokeText(txt, x, y); ctx.fillStyle = css(tone || th.ink2); }
    ctx.fillText(txt, x, y);
    return true;
  };
  const sd = selDiv(), b = m.booth;
  // (a surface's ground changes under a label, so it takes the lettering that holds on anything)
  const dw = drawOf(m);
  const groundOf = (i) => { if (dw === "surface" || dw === "areas") return th.dark ? [120, 120, 120] : [190, 190, 190]; const c = dw === "balloons" ? th.nodata : fillDiv(m, i); if (!c) return th.nodata; let g = towards(c, th.bg, quietness(i, now)); if (sd != null && i !== sd) g = towards(g, th.bg, th.veil); return g; };
  if (S.sel.level === "booth" && !Number.isNaN(b.x[S.sel.booth])) {
    const j = S.sel.booth; put(dn(b.name[j]), b.x[j] * T.k + T.x, b.y[j] * T.k + T.y - rad(boothSizeVotes(b, j)) - 13, 13, 600, groundOf(sd), th.ink, true);
  }
  // the towns: ahead of the seats' names while the view is wide (a city names
  // the country, a seat named for it gives way), after the polling places closer in
  const tw = townScale(), wide = tw > 0 && tw < TOWN_FIRST, town = new Set(), seatNm = new Set(), since = new Map();
  const townsOn = !S.townsOff; // the legend strip's City-names toggle zeroes the lot
  // the labels' click targets for this pass; and the picked town's white edge under its ringed name
  townHits.length = 0;
  if (tw > 0 && townPick >= 0) drawUrban();
  // a town chosen in the search goes first of all, ringed, at any zoom
  if (townsOn && tw > 0 && townPick >= 0) drawTowns(m, placed, seatNm, town, [], since, townPick);
  if (townsOn && wide) drawTowns(m, placed, seatNm, town, [], since);
  if (T.k >= 2.3) {
    const g = geoOf(m), cand = [];
    for (const d of m.divs) {
      if (town.has(d.n.toLowerCase())) continue;
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
    for (const c of cand) if (put(dn(c.d.n), c.x, c.y, c.d.i === sd ? 13.5 : 12, c.d.i === sd ? 600 : 500, groundOf(c.d.i), sd != null && c.d.i !== sd ? th.ink3 : th.ink2)) seatNm.add(c.d.n.toLowerCase());
  }
  // an island where it lies: its name over its north coast once it shows (under
  // its south coast where the way back holds the top)
  for (const el of [backBtn, $("#credit"), $("#zoomer"), $("#filterpill")]) if (!el.hidden) placed.push([el.offsetLeft - 4, el.offsetTop - 4, el.offsetLeft + el.offsetWidth + 4, el.offsetTop + el.offsetHeight + 4]);
  // (and the year's stamp while it shows, which the waters' names and the lines' degrees keep clear of)
  if (stampEl.classList.contains("on")) placed.push([stampEl.offsetLeft - 4, stampEl.offsetTop - 4, stampEl.offsetLeft + stampEl.offsetWidth + 4, stampEl.offsetTop + stampEl.offsetHeight + 4]);
  for (const q of m.isl || []) {
    const x0 = q.mbb[0][0] * T.k + T.x, x1 = q.mbb[1][0] * T.k + T.x, y0 = q.mbb[0][1] * T.k + T.y, y1 = q.mbb[1][1] * T.k + T.y;
    if (x1 - x0 < 30 || x1 < 0 || x0 > Wpx || y0 > Hpx) continue;
    // clear of the island's own polling places (which stay free for their own names)
    const n0 = placed.length;
    for (const j of q.booths) { if (Number.isNaN(b.x[j])) continue; const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(boothSizeVotes(b, j)) + 2; placed.push([x - r, y - r, x + r, y + r]); }
    const on = put(q.name, (x0 + x1) / 2, Math.max(y0 - 13, 12), 13, 600, th.bg, th.ink2) || put(q.name, (x0 + x1) / 2, Math.min(y1 + 13, Hpx - 12), 13, 600, th.bg, th.ink2);
    placed.splice(n0, placed.length - n0 - (on ? 1 : 0));
  }
  if (m._vis && m._vis.length && T.k > K_BLAB) {
    let n = 0;
    for (const j of m._vis) {
      if (n > 120) break;
      if (S.sel.level === "booth" && j === S.sel.booth) continue;
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y;
      if (x < 0 || y < 0 || x > Wpx || y > Hpx) continue;
      // (a polling place named for its town takes the name: the town's own label gives way)
      if (put(dn(b.name[j].replace(" early voting centre", " (early)")), x, y - rad(boothSizeVotes(b, j)) - 9, 11, 400, groundOf(b.d[j]), sd != null && b.d[j] !== sd ? th.faint : th.ink2)) { n++; seatNm.add(b.name[j].replace(" early voting centre", "").toLowerCase()); }
    }
  }
  // every booth's dot, which the towns' and the streets' names keep clear of
  const obst = [];
  for (const j of m._vis || []) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(boothSizeVotes(b, j)) + 2;
    if (x > -r && y > -r && x < Wpx + r && y < Hpx + r) obst.push([x - r, y - r, x + r, y + r]);
  }
  if (townsOn && tw > 0 && !wide) drawTowns(m, placed, seatNm, town, obst, since);
  townSince = since;
  // the waters' names, after everything named on the land (it keeps its room first)
  drawSeaNames(m, placed);
  // the streets' own names last, clear of every label above and every booth
  const sA = streetK();
  if (sA > 0.02 && streetDrawn.length) drawStreetNames(placed, obst, sA);
  ctx.restore();
}

/* ----- the waters' names -----
   The oceans, seas, gulfs, straits and the big bays, set as an atlas sets
   them: italic, in the sea's own deeper blue, each line along the parallel
   through its spot, so every name curves with the lines of latitude beneath
   it (and a gulf that runs north-south along its own length). Sentence case,
   never spaced capitals. A name shows only where all of it lies on open
   water with a little room to spare, read off a coarse mask of the land
   (seaMaskOf: the frame's seats and islands, and the country beneath a
   state's frame), and only where it meets no other label; it tries its
   spots in turn, so a name the view has cut off can move to another stretch
   of its water. Each fades in as the town names do, and all of them give way
   to Esri's own names of the waters as the streets come in.
   Each entry: the name (lines split at \n), its size in px, then its spots
   ([lon, lat], or [lon, lat, deg]: a name laid along a gulf, its line at deg
   anticlockwise from the parallel). */
/* @sea-names-begin */
const SEA_NAMES = [
  ["Indian Ocean", 18, [[109.5, -31], [111, -37.5], [113.5, -16.5], [115.5, -13], [109.5, -44], [106, -24]]],
  ["Southern Ocean", 18, [[124, -40.6], [133, -41.2], [118, -39.5], [140, -45]]],
  ["Pacific Ocean", 18, [[166, -30], [162, -24]]],
  ["Coral Sea", 15.5, [[153.6, -17.5], [151.5, -13.5], [155.5, -21.5]]],
  ["Tasman Sea", 15.5, [[156.5, -39.5], [152.9, -40.9], [151, -45], [156.5, -35], [159.5, -42], [161, -32]]],
  ["Arafura Sea", 15.5, [[135.5, -9.7], [138.8, -10.2], [133, -9.4]]],
  ["Timor Sea", 15.5, [[126.4, -11.6], [124.5, -12.6], [128.5, -10.6]]],
  ["Great Australian\nBight", 14.5, [[130.6, -34.2], [129.5, -33.8], [132.2, -34.6]]],
  ["Gulf of\nCarpentaria", 14.5, [[139.2, -14.3], [138.8, -13.2]]],
  ["Joseph Bonaparte\nGulf", 13, [[128.5, -13.95], [128.7, -13.3]]],
  ["Bass Strait", 13.5, [[146.1, -39.75], [145.2, -39.6], [147, -39.65]]],
  ["Torres Strait", 13, [[142.4, -10.05]]],
  ["Van Diemen Gulf", 12.5, [[131.95, -11.95]]],
  ["Spencer Gulf", 13, [[137.18, -34.15, 70], [137.0, -34.6, 70]]],
  ["Gulf St Vincent", 12.5, [[138.07, -34.95, 81], [138.1, -34.7, 81]]],
  ["Investigator Strait", 12, [[137.35, -35.45]]],
  ["Port Phillip", 12.5, [[144.86, -38.13], [144.85, -38.2]]],
  ["Moreton Bay", 12.5, [[153.27, -27.27, 84], [153.3, -27.1, 84]]],
  ["Hervey Bay", 12.5, [[152.65, -25.05], [152.75, -24.9]]],
  ["Storm Bay", 12.5, [[147.57, -43.17]]],
  ["Shark Bay", 12.5, [[113.35, -25.3], [113.2, -25.6]]],
  ["Exmouth Gulf", 12, [[114.33, -22.25, 82]]],
  ["King Sound", 12, [[123.45, -16.85, -68], [123.35, -16.6, -68]]],
  ["Geographe Bay", 12, [[115.38, -33.47]]],
  ["Princess Charlotte\nBay", 12, [[144.15, -14.12]]],
];
/* @sea-names-end */
const SEA_FONT = '"Crimson Text", Georgia, serif', SEA_FADE = 220;
// the lettering: a water's name (italic) and a line's degree (the page's sans, small)
const seaFont = (size) => `italic 400 ${size}px ${SEA_FONT}`;
const DEG_SIZE = 10, DEG_FONT = `400 ${DEG_SIZE}px ${SANS}`;
let seaSince = new Map(), seaMaskJob = 0;
// each line's advances, measured once a font (again when the italic arrives: the fallback's differ)
const seaAdv = new Map();
if (document.fonts && document.fonts.load) document.fonts.load(seaFont(16)).then(() => { seaAdv.clear(); schedule(); }, () => {});
function seaAdvOf(ln, font) {
  const key = font + "|" + ln;
  let a = seaAdv.get(key);
  if (!a) { ctx.font = font; a = [0]; for (let i = 1; i <= ln.length; i++) a.push(ctx.measureText(ln.slice(0, i)).width); seaAdv.set(key, a); }
  return a;
}
/* the land, coarsely (3.3km a cell; any cell the land touches counts as land): made off
   the frame's plane in idle time when first wanted, kept for the year in view */
let seaMask = null;
const SEA_MASK = { x0: -200, y0: -120, w: 1400, h: 1120, s: 1.2 };
function seaMaskOf(m) {
  if (!m.proj || !m.geo) return null;
  const state = STATE_YEARS.has(m.year);
  if (seaMask && seaMask.m === m && seaMask.P === m.proj && (!state || seaMask.land)) return seaMask;
  if (state && !LAND) { loadLand(); return null; }
  if (seaMaskJob) return null;
  const run = () => {
    seaMaskJob = 0;
    if (m !== M() || !m.proj) return;
    const { x0, y0, s } = SEA_MASK, w = Math.ceil(SEA_MASK.w * s), h = Math.ceil(SEA_MASK.h * s);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s); g.fillStyle = "#000";
    for (const p of m.geo.paths) if (p) g.fill(p);
    for (const q of m.isl || []) g.fill(q.mpath);
    if (LAND) for (const st of landOf(m, false).states) g.fill(st.path);
    const d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[4 * i + 3] > 0 ? 1 : 0;
    seaMask = { m, P: m.proj, land: !!LAND, x0, y0, s, w, h, a };
    schedule();
  };
  seaMaskJob = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 400 }) : setTimeout(run, 30);
  return null;
}
// the stage's clear ground, pad px in from its edges (in full screen, between the plates)
const clearGround = (pad) => { const q = FS.on ? FS.ins : { t: 0, r: 0, b: 0, l: 0 }; return [q.l + pad, q.t + pad, Wpx - q.r - pad, Hpx - q.b - pad]; };
const maskLand = (K, x, y) => { const i = Math.floor((x - K.x0) * K.s), j = Math.floor((y - K.y0) * K.s); return i >= 0 && j >= 0 && i < K.w && j < K.h && K.a[j * K.w + i] === 1; };
// a name's glyphs at one spot, in CSS px: each glyph's middle on its baseline and its turn;
// null where it can't stand (off the stage, on land). font: its lettering at size (a water's
// italic unless given); lift: how far its middle stands above the spot (the Tropic's name
// sits over its line, a degree on its own)
function seaLayout(m, K, G, txt, size, spot, font = seaFont(size), lift = 0) {
  const p = m.proj([spot[0], spot[1]]); if (!p) return null;
  const ax = p[0] * T.k + T.x, ay = p[1] * T.k + T.y;
  const lines = txt.split("\n"), lh = size * 1.08, advs = lines.map((ln) => seaAdvOf(ln, font));
  // (a spot whose name can't reach the stage asks nothing more)
  const half = Math.max(...advs.map((a) => a[a.length - 1])) / 2 + 4, tall = (lines.length * lh) / 2 + size;
  if (ax + half < 2 || ax - half > Wpx - 2 || ay + tall < 2 || ay - tall > Hpx - 2) return null;
  // the apex on the screen: a name lies along the circle through its spot (a straight line
  // at deg off the parallel's tangent for a gulf's)
  const cx = G.C[0] * T.k + T.x, cy = G.C[1] * T.k + T.y, r0 = Math.hypot(ax - cx, ay - cy);
  const ux = (ax - cx) / r0, uy = (ay - cy) / r0, sg = uy <= 0 ? 1 : -1, th0 = Math.atan2(uy, ux);
  const tan = th0 + (sg * Math.PI) / 2, deg = spot[2] || 0;
  const glyphs = [], pts = [];
  lines.forEach((ln, li) => {
    const adv = advs[li], wid = adv[ln.length], v = (li - (lines.length - 1) / 2) * lh + 0.3 * size - lift; // the baseline, below the spot
    // a point s along the line and v below it, and the turn of the line there
    const at = deg
      ? (() => { const a = tan - (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a); return (s, dv) => [ax + c * s - sn * dv, ay + sn * s + c * dv, a]; })()
      : (s, dv) => { const t = th0 + (sg * s) / r0, rr = r0 - sg * dv; return [cx + rr * Math.cos(t), cy + rr * Math.sin(t), t + (sg * Math.PI) / 2]; };
    for (let i = 0; i < ln.length; i++) { if (ln[i] === " ") continue; const s = (adv[i] + adv[i + 1]) / 2 - wid / 2; glyphs.push([ln[i], ...at(s, v)]); }
    // the ground it needs: from just before it to just past it, cap height plus a margin
    // down to its descenders, every 2.5px
    for (let s = -wid / 2 - 3; s <= wid / 2 + 3; s += 2.5) for (const dv of [-0.82 * size, -0.4 * size, 0.24 * size]) pts.push(at(s, v + dv));
  });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (maskLand(K, (x - T.x) / T.k, (y - T.y) / T.k)) return null;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const [c0, c1, c2, c3] = clearGround(2);
  if (x0 < c0 || y0 < c1 || x1 > c2 || y1 > c3) return null;
  return { glyphs, box: [x0, y0, x1, y1] };
}
function drawSeaNames(m, placed) {
  const fade = 1 - smooth(0, 0.35, streetK());
  const K = fade > 0.01 ? seaMaskOf(m) : null;
  if (!K) { seaSince.clear(); return; }
  const G = gratOf(m.proj), th = TH, now = performance.now(), seen = new Set();
  ctx.save();
  ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  for (const [txt, size, spots] of SEA_NAMES) {
    let lay = null;
    for (const spot of spots) {
      const L = seaLayout(m, K, G, txt, size, spot);
      if (L && !placed.some((q) => !(L.box[2] < q[0] || L.box[0] > q[2] || L.box[3] < q[1] || L.box[1] > q[3]))) { lay = L; break; }
    }
    if (!lay) continue;
    placed.push(lay.box); seen.add(txt);
    layGlyphs(lay.glyphs, seaFont(size), th.seaInk, ovA * fade * seaFade(txt, now));
  }
  ctx.restore();
  drawGratLabels(m, K, G, placed, seen, now, ovA * fade);
  for (const k of [...seaSince.keys()]) if (!seen.has(k)) seaSince.delete(k);
}
// a label's strength as it fades in from the frame it first found room (keyed by its text)
function seaFade(key, now) {
  if (!seaSince.has(key)) seaSince.set(key, now);
  const t = clamp((now - seaSince.get(key)) / SEA_FADE, 0, 1); if (t < 1) needFrame = true;
  return t;
}
// glyphs laid as seaLayout set them: a soft edge of the sea's own colour first, under every
// glyph (it lifts the lines of latitude and longitude out from beneath the letters), then
// the letters
function layGlyphs(glyphs, font, ink, a) {
  ctx.font = font; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  for (const pass of [0, 1]) {
    ctx.globalAlpha = a * (pass ? 1 : 0.8);
    if (pass) ctx.fillStyle = css(ink); else { ctx.strokeStyle = css(TH.sea); ctx.lineWidth = 3.4; }
    for (const [ch, x, y, rot] of glyphs) {
      ctx.setTransform(dpr * Math.cos(rot), dpr * Math.sin(rot), -dpr * Math.sin(rot), dpr * Math.cos(rot), dpr * x, dpr * y);
      if (pass) ctx.fillText(ch, 0, 0); else ctx.strokeText(ch, 0, 0);
    }
  }
}

/* ----- the lines' degrees -----
   Each line of latitude and longitude in view is marked with its degree where it
   meets the edge of the map, set on the line itself (the line breaks for it): a
   meridian's upright at the top edge, a parallel's along its curve at the left,
   each on the far edge where land, another label or a control holds the near
   one (in full screen, the edges of the clear ground between the plates). The
   Tropic of Capricorn is named along its dashed line, over it, nearest whichever
   end of the view has open water, else in the open sea off either coast. Waters'
   names take their room first; a degree gives way to them. */
const overlaps = (b, placed) => placed.some((q) => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]));
function drawGratLabels(m, K, G, placed, seen, now, a) {
  const [L0, T0, R0, B0] = clearGround(5);
  const th = TH, cx = G.C[0] * T.k + T.x, cy = G.C[1] * T.k + T.y;
  // the angle a longitude's meridian runs at on the screen, turned to the view's side of the apex
  const mid = Math.atan2(Hpx / 2 - cy, Wpx / 2 - cx), t0 = G.t0 + 2 * Math.PI * Math.round((mid - G.t0) / (2 * Math.PI));
  const lonAt = (t) => 132 + (t - t0) / G.dt;
  // where a parallel of radius r (CSS px) meets the upright x = X: the spot whose label, w
  // wide, has that end there (dir +1: it runs on to the right, -1: to the left)
  const parallelAt = (r, X, w, dir) => {
    const dx = X - cx; if (Math.abs(dx) >= r) return null;
    const dy = Math.sqrt(r * r - dx * dx);
    for (const y of [cy - dy, cy + dy]) {
      if (y < T0 + 8 || y > B0 - 8) continue;
      let t = Math.atan2(y - cy, dx); t += 2 * Math.PI * Math.round((t0 - t) / (2 * Math.PI));
      if (Math.abs(t - t0) > 180 * Math.abs(G.dt)) continue;
      const sg = y <= cy ? 1 : -1, tc = t + (dir * sg * (w / 2 + 1)) / r;
      return lonAt(tc);
    }
    return null;
  };
  const water = (b) => { for (let x = b[0]; x <= b[2]; x += 2.5) for (const y of [b[1], (b[1] + b[3]) / 2, b[3]]) if (maskLand(K, (x - T.x) / T.k, (y - T.y) / T.k)) return false; return true; };
  ctx.save();
  // the Tropic of Capricorn's name, over its line
  {
    const txt = "Tropic of Capricorn", size = 12, font = seaFont(size), w = seaAdvOf(txt, font).at(-1), rt = G.Rt * T.k, lift = 0.3 * size + 3;
    // (from each end of the view inward, a step at a time, until it finds open water)
    const ends = [];
    for (let k = 0; k < 10; k++) ends.push(parallelAt(rt, R0 - 28 * k, w, -1), parallelAt(rt, L0 + 28 * k, w, 1));
    let lay = null;
    for (const lon of [...ends.filter((l) => l != null), 154.6, 110.4]) {
      const Lb = seaLayout(m, K, G, txt, size, [lon, TROPIC], font, lift);
      if (Lb && !overlaps(Lb.box, placed)) { lay = Lb; break; }
    }
    if (lay) { placed.push(lay.box); seen.add(txt); layGlyphs(lay.glyphs, font, th.seaInk, a * seaFade(txt, now)); }
  }
  // the meridians' degrees, upright on their lines at the top edge (else the bottom)
  const rA = G.R.get(-80) * T.k, rB = G.R.get(80) * T.k, uLo = Math.min(rA, rB), uHi = Math.max(rA, rB);
  for (let lon = -40; lon <= 310; lon += GRAT_STEP) {
    const t = t0 + (lon - 132) * G.dt, ux = Math.cos(t), uy = Math.sin(t), txt = degLon(lon), w = seaAdvOf(txt, DEG_FONT).at(-1);
    if (Math.abs(uy) < 1e-6) continue;
    for (const Y of [T0 + 7, B0 - 7]) {
      const u = (Y - cy) / uy, x = cx + u * ux;
      if (u < uLo || u > uHi || x - w / 2 < L0 || x + w / 2 > R0) continue;
      const b = [x - w / 2 - 2, Y - DEG_SIZE / 2 - 1.5, x + w / 2 + 2, Y + DEG_SIZE / 2 + 1.5];
      if (!water(b) || overlaps(b, placed)) continue;
      placed.push(b); seen.add(txt);
      layGlyphs([[txt, x, Y + 0.35 * DEG_SIZE, 0]], DEG_FONT, th.seaMark, a * seaFade(txt, now));
      break;
    }
  }
  // the parallels' degrees, along their curves at the left edge (else the right)
  for (const [lat, r0] of G.R) {
    const txt = degLat(lat), w = seaAdvOf(txt, DEG_FONT).at(-1), r = r0 * T.k;
    for (const [X, dir] of [[L0, 1], [R0, -1]]) {
      const lon = parallelAt(r, X, w, dir); if (lon == null) continue;
      const Lb = seaLayout(m, K, G, txt, DEG_SIZE, [lon, lat], DEG_FONT);
      if (!Lb || overlaps(Lb.box, placed)) continue;
      placed.push(Lb.box); seen.add(txt);
      layGlyphs(Lb.glyphs, DEG_FONT, th.seaMark, a * seaFade(txt, now));
      break;
    }
  }
  ctx.restore();
}

/* ----- the towns -----
   Every town of 200 people or more (map/data/places.json, places_build.py:
   ABS 2021 Urban Centres and Localities, at GeoNames' town-centre points),
   named as the zoom makes room: the capitals and the cities of a million
   from the whole country's view, then each town once the map's scale
   (screen pixels to the kilometre, the same on every frame) passes its
   population's threshold. Biggest first, each claims its room, so a small
   town shows in empty country where a bigger one near a city has no space.
   A name fades in over TOWN_FADE ms from the frame it first finds room (a
   fade over a stretch of zoom left names half-drawn on a map at rest). */
let PLACES = null, placesP = null, townSince = new Map();
// the town last chosen in the search (an index into PLACES; -1 none): drawn first and
// ringed until the next choice of anything
let townPick = -1;
const TOWN_FADE = 220;
// the capitals, by state too: Tasmania has a Perth of its own
const TOWN_CAP = { Sydney: "NSW", Melbourne: "VIC", Brisbane: "QLD", Perth: "WA", Adelaide: "SA", Hobart: "TAS", Canberra: "ACT", Darwin: "NT" };
const isCapital = (q) => TOWN_CAP[q[0]] === q[4] || q[3] >= 1e6;
// the scale (px/km) a town of p people first shows at: the capitals and a million always;
// 250k at the country's view on a desktop, 20k at a state's, 5k a few seats', 1k a rural seat's
const townPopAt = (q) => (isCapital(q) ? 0 : 0.3 * Math.pow(1e5 / q[3], 0.75));
/* Size alone leaves the sparse states blank: Adelaide was South Australia's only name on its
   own frame. So a town also shows once it stands TOWN_GAP screen pixels from the nearest
   bigger town in the frame: the only place for miles earns its name at a size a town near
   a city doesn't (Alice Springs before Geelong, a reference map's choice, not a ranking).
   Looser on a state's frame, whose reader wants the local landmarks; fixed in pixels, so a
   phone's whole country stays near its capitals. TOWN_ISLE_MIN people and up; on a state's
   frame a town of 3,000 needs the full gap, a smaller one up to 1.5 of it, a bigger one down to 0.38
   (Port Augusta beside Whyalla; Ceduna, Coober Pedy and Yulara out on their own). */
const TOWN_GAP = { federal: 74, state: 62 }, TOWN_ISLE_MIN = { federal: 3000, state: 800 };
const inFrame = (m, st) => !!(m.areas[st] || (st === "ACT" && m.areas.NSW));
// each town's km to the nearest bigger town anywhere, state lines or not: a border town
// beside a bigger one over the line isn't alone (Moama, Echuca's other bank). 0: under the lower minimum
let townIsleD = null;
function townIsle() {
  if (townIsleD) return townIsleD;
  const d = (townIsleD = new Float64Array(PLACES.length)), seen = [];
  PLACES.forEach((q, i) => {
    if (q[4] === "OT") return;
    if (q[3] >= TOWN_ISLE_MIN.state) {
      let best = Infinity;
      const c = Math.cos((q[2] * Math.PI) / 180);
      for (const r of seen) best = Math.min(best, Math.hypot((q[1] - r[1]) * c, q[2] - r[2]) * 111.2);
      d[i] = best;
    }
    seen.push(q); // (biggest first: all before it are bigger)
  });
  return d;
}
// (and a state's frame opens on its regional cities: TOWN_STATE_POP and up from its home view,
// the bar falling as it zooms from there, or the isolation rule would show Newman and not Bunbury)
const TOWN_STATE_POP = 3e4, TOWN_STATE_K = 1.25, TOWN_STATE_SCALE = 0.4; // (px/km, a big state's home view)
const townAt = (m, i) => {
  // (the state's rules hold on a state's frame, and on the federal map from TOWN_STATE_K times
  // its home zoom: the NT has no frame of its own, and a state reached by zooming in reads the same)
  const frame = STATE_YEARS.has(m.year), st = frame || T.k > HOME.k * TOWN_STATE_K, q = PLACES[i], d = townIsle()[i];
  let at = townPopAt(q);
  if (st) at = Math.min(at, (frame ? HOME.k * townPts().upk : TOWN_STATE_SCALE) * Math.pow(TOWN_STATE_POP / q[3], 0.75));
  if (!d) return at;
  if (st) return Math.min(at, (TOWN_GAP.state * clamp(Math.pow(3000 / q[3], 0.65), 0.38, 1.5)) / d);
  return q[3] >= TOWN_ISLE_MIN.federal ? Math.min(at, TOWN_GAP.federal / d) : at;
};
// wider than this (px/km) the towns' names go ahead of the seats'
const TOWN_FIRST = 4;
// the frame's projection units to a kilometre, and each town's point in them, kept per projection
const townProj = new WeakMap();
function townPts() {
  if (!PLACES || !proj) return null;
  let t = townProj.get(proj);
  if (!t) {
    const a = proj([134, -28]), c = proj([134, -29]), xy = new Float64Array(PLACES.length * 2);
    PLACES.forEach((q, i) => { const p = proj([q[1], q[2]]); xy[2 * i] = p ? p[0] : NaN; xy[2 * i + 1] = p ? p[1] : NaN; });
    townProj.set(proj, (t = { upk: Math.hypot(c[0] - a[0], c[1] - a[1]) / 111.2, xy }));
  }
  return t;
}
// the map's scale on screen, px per km (0 until the towns are in)
function townScale() {
  if (!placesP) placesP = getJSON("/map/data/places.json", true).then((d) => { PLACES = d.p; schedule(); }).catch(() => {});
  const t = townPts();
  return t ? T.k * t.upk : 0;
}
// the seat under a point of the map (-1: the sea, or beyond the frame's seats)
function divUnder(m, x, y) {
  const g = geoOf(m);
  for (let d = 0; d < m.divs.length; d++) { const q = g.bb[d]; if (!q || x < q[0][0] || x > q[1][0] || y < q[0][1] || y > q[1][1]) continue; if (hitCtx.isPointInPath(g.paths[d], x, y)) return d; }
  return -1;
}
// whether a label at one spot beside a town runs off the land, read at five points
// along its middle line: kept per year, town, spot and zoom step (a pan moves a label
// with the land under it; only a zoom slides it), so a still or panning map asks nothing again
function townOffLand(m, key, box, cy) {
  const c = m._townG || (m._townG = new Map());
  let v = c.get(key);
  if (v === undefined) {
    if (c.size > 6000) c.clear();
    const at = (u) => divUnder(m, (box[0] + 3 + (box[2] - box[0] - 6) * u - T.x) / T.k, (cy - T.y) / T.k);
    c.set(key, (v = [0, 0.25, 0.5, 0.75, 1].some((u) => at(u) < 0)));
  }
  return v;
}
// the towns' own lettering: a dot, the name beside it; bigger towns heavier
// one weight and colour for every town, so none reads fainter than another; the capitals a size up
const townType = (q) => (isCapital(q) ? [13.5, 600, 3] : [12.5, 600, 2.5]);
// (only: draw just that town - the search's choice - at any zoom, and where it has no
// clear room, in the first spot on the screen regardless)
function drawTowns(m, placed, skip, shown, obst, since, only) {
  const t = townPts(); if (!t) return;
  const s = T.k * t.upk, xy = t.xy;
  // the lettering, whatever the seat under it: black with a white outline on the light
  // page, white with a black outline on the dark one
  const fg = TH.dark ? "#fff" : "#000", rim = TH.dark ? "#000" : "#fff";
  const hits = (r) => { for (const q of placed) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; for (const q of obst) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; return false; };
  ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  // the zoom buttons over the stage's corner: no name runs under them
  const zr = $("#zoomer"), cr = canvas.getBoundingClientRect();
  if (zr && zr.offsetParent) { const q = zr.getBoundingClientRect(); obst = obst.concat([[q.left - cr.left - 4, q.top - cr.top - 4, q.right - cr.left + 4, q.bottom - cr.top + 4]]); }
  const now = performance.now(), one = only != null;
  let n = 0, fading = false;
  for (let i = one ? only : 0; one ? i === only : i < PLACES.length && n < 70; i++) {
    const [name, , , , st] = PLACES[i];
    if (!one && (i === townPick || s < townAt(m, i))) continue;
    // the frame's own states (Canberra on the NSW frames, the ACT being their hole); one state chosen, its towns
    if (!inFrame(m, st)) continue;
    if (S.sel.level === "state" && st !== S.sel.st && !(st === "ACT" && S.sel.st === "NSW")) continue;
    const key = name.toLowerCase();
    if (!one && skip.has(key)) continue;
    const x = xy[2 * i] * T.k + T.x, y = xy[2 * i + 1] * T.k + T.y;
    if (!(x > 4 && y > 4 && x < Wpx - 4 && y < Hpx - 4)) continue;
    const [size0, weight, r] = townType(PLACES[i]), size = one ? size0 + 1 : size0, txt = dn(name), ring = one ? r + 3.4 : r;
    ctx.font = `${weight} ${size}px ${SANS}`;
    const w = ctx.measureText(txt).width, hh = size / 2 + 2, dot = [x - ring - 1, y - ring - 1, x + ring + 1, y + ring + 1];
    if (!one && hits(dot)) continue;
    // beside the dot: right, left, above, below - the first with room whose text lies
    // wholly on land (a coastal town's name keeps off the sea), else the first with room
    const spots = [[x + ring + 4, y, "left"], [x - ring - 4, y, "right"], [x, y - ring - hh - 1, "center"], [x, y + ring + hh + 1, "center"]];
    const zk = Math.round(Math.log2(T.k) * 12);
    let box = null, pick = null;
    for (let si = 0; si < 4; si++) {
      const sp = spots[si], x0 = sp[2] === "left" ? sp[0] - 2 : sp[2] === "right" ? sp[0] - w - 2 : sp[0] - w / 2 - 2;
      const bx = [x0, sp[1] - hh, x0 + w + 4, sp[1] + hh];
      if (bx[0] < 2 || bx[2] > Wpx - 2 || bx[1] < 2 || bx[3] > Hpx - 2) continue;
      if (hits(bx)) { if (one && !box) { box = bx; pick = sp; } continue; }
      const off = townOffLand(m, `${i}|${si}|${zk}`, bx, sp[1]);
      if (!box || (one && hits(box))) { box = bx; pick = sp; }
      if (!off) { box = bx; pick = sp; break; }
    }
    if (!box) continue;
    placed.push(box, dot); shown.add(key); n++;
    // the label's own click target: the map flies to the town when this rectangle is clicked
    townHits.push([i, Math.min(box[0], dot[0]) - 4, Math.min(box[1], dot[1]) - 4, Math.max(box[2], dot[2]) + 4, Math.max(box[3], dot[3]) + 4]);
    const t0 = townSince.get(i) ?? now, fa = reduceMotion ? 1 : clamp((now - t0) / TOWN_FADE, 0, 1);
    since.set(i, t0); if (fa < 1) fading = true;
    ctx.save();
    ctx.globalAlpha = ovA * fa * fa * (3 - 2 * fa);
    ctx.textAlign = pick[2];
    const hi = i === townHiIdx; // (the pointer's town: its lettering inverts, as a click target's hint)
    ctx.lineWidth = 3.6; ctx.strokeStyle = hi ? fg : rim; ctx.strokeText(txt, pick[0], pick[1]);
    ctx.fillStyle = hi ? rim : fg; ctx.fillText(txt, pick[0], pick[1]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.lineWidth = 2; ctx.stroke(); ctx.fill();
    if (one) { ctx.beginPath(); ctx.arc(x, y, ring, 0, 2 * Math.PI); ctx.lineWidth = 3.6; ctx.strokeStyle = rim; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = fg; ctx.stroke(); }
    ctx.restore();
  }
  if (fading) schedule();
  ctx.textAlign = "center";
}

/* ----- the urban extents -----
   The picked town keeps its true ABS outline on the map: its Urban Centre
   (or Locality) boundary as a white edge under its ringed name
   (map/data/urban.json, urban_build.mjs - the 2021 UCL outlines keyed to
   places.json's rows by their extents), fetched the first time a town is
   picked and faded in like the names. And the names above are themselves the
   way to a town: drawTowns records where each label landed (townHits, reset
   at each drawLabels pass), the canvas's click flies to the town whose label
   was clicked, and the pointer inverts the label's lettering to hint it. */
let URBAN = null, urbanP = null, urbanId = -1, urbanSince = 0;
const urbanDeg = new Map(), townHits = [];
let townHiIdx = -1;
// A selection starts the download. A failed request can retry on the next
// selection, but drawing frames and probe reads never start a retry loop.
function loadUrban() {
  if (URBAN || urbanP) return;
  urbanP = getJSON("/map/data/urban.json", true)
    .then((d) => { URBAN = d.u; schedule(); })
    .catch(() => { urbanP = null; });
}
// the town's decoded rings in degrees, or null (not fetched yet, or the town has no outline)
function urbanEntry(i) {
  if (urbanDeg.has(i)) return urbanDeg.get(i);
  if (!URBAN) return null;
  const e = URBAN[i];
  const rings = e ? e.flat().map((ring) => {
    const out = new Float64Array(ring.length);
    let x = 0, y = 0;
    for (let j = 0; j < ring.length; j += 2) { x += ring[j]; y += ring[j + 1]; out[j] = x / 1e5; out[j + 1] = y / 1e5; }
    return out;
  }) : null;
  urbanDeg.set(i, rings);
  return rings;
}
// the white edge itself - a dark ground line carrying white, the reads-black-or-white towns' lettering rule
function drawUrban() {
  const rings = urbanEntry(townPick);
  if (!rings) return;
  if (urbanId !== townPick) { urbanId = townPick; urbanSince = performance.now(); }
  const fa = reduceMotion ? 1 : clamp((performance.now() - urbanSince) / TOWN_FADE, 0, 1);
  ctx.save();
  ctx.globalAlpha = ovA * fa * fa;
  for (const ring of rings) {
    ctx.beginPath();
    let ok = true;
    for (let j = 0; j < ring.length; j += 2) {
      const p = proj([ring[j], ring[j + 1]]);
      if (!p) { ok = false; break; }
      const x = p[0] * T.k + T.x, y = p[1] * T.k + T.y;
      if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (!ok) continue;
    ctx.closePath();
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.30)"; ctx.stroke();
    ctx.lineWidth = 2.2; ctx.strokeStyle = "#fff"; ctx.stroke();
  }
  ctx.restore();
  if (fa < 1) schedule();
}
// the town whose label (as drawn last pass, in canvas pixels) holds the point, -1 none
function townAtPoint(x, y) {
  if (S.view !== "map" || morph) return -1;
  for (const h of townHits) if (x >= h[1] && y >= h[2] && x <= h[3] && y <= h[4]) return h[0];
  return -1;
}

/* ----- the streets -----
   Esri's World_Basemap_v2 vector tiles show the streets through the seat
   fills from suburb zoom in. Each PBF tile is read once, drawn to a tile
   canvas in the palette the old grey-canvas sheets carried, and from there
   the pipeline is the raster one: Web Mercator affine-fitted through the
   conic projection, plain land taken to nothing, then multiplied on paper
   and screened on the dark page - so the seat colours stay where they were
   and only the streets, blocks and water mark them. */
const STREETS = { k0: 45, k1: 110, zMin: 3, zMax: 17, live: 12 };
// the plain land of each sheet, taken to white (paper) or black (dark page)
const STREET_LAND = { light: 239, dark: 71 };
// tile artworks render at one 256-px block per dpr step so they stay sharp
// on retina (the raster sheets were fixed 256 and blurred there); dpr is a
// boot-time value, so both read live
const tilePx = () => Math.max(256, Math.min(512, Math.round(256 * dpr)));
const streetCap = () => (tilePx() > 256 ? 220 : 360);
const SVC_T = "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile";
const streetK = () => smooth(STREETS.k0, STREETS.k1, T.k);
const tiles = new Map();
let streetCv = null, streetUse = 0, streetLive = 0;
// the tiles laid at the view's own zoom on the last paint, for the names
const streetDrawn = [];
// lon/lat to Web Mercator's unit square, and back
const merc = (ll) => { const s = Math.sin((ll[1] * Math.PI) / 180); return [(ll[0] + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; };
const unmerc = (x, y) => [x * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI];
function tileAt(dark, z, x, y, want) {
  const key = (dark ? "d" : "l") + z + "/" + x + "/" + y;
  let t = tiles.get(key);
  if (!t && want && streetLive < STREETS.live) {
    t = { cv: null, ready: 0, failed: false, used: 0 };
    tiles.set(key, t); streetLive++;
    fetch(`${SVC_T}/${z}/${y}/${x}.pbf`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => { t.buf = b; t.dark = dark; t.z = z; tileQueue.push(t); })
      .catch(() => { t.failed = true; })
      .finally(() => { streetLive--; schedule(); });
    if (tiles.size > streetCap()) pruneTiles();
  }
  if (t) t.used = streetUse;
  return t;
}
// tiles that have arrived wait to be read and drawn in the paint, a few
// milliseconds' worth a frame, so a burst of arrivals never holds up one frame
// (the coarser tile on hand stands in meanwhile)
const tileQueue = [], TILE_BUDGET = 5;
function drainTiles() {
  const t0 = performance.now();
  while (tileQueue.length && performance.now() - t0 < TILE_BUDGET) {
    const t = tileQueue.shift();
    if (!t.buf) continue;
    try { const pr = mvtParse(new Uint8Array(t.buf)); t.cv = renderTile(pr, t.dark, t.z, tilePx()); t.sea = seaPath(pr.sea); t.names = pr.names; t.spots = pr.spots; t.ready = performance.now(); }
    catch { t.failed = true; }
    t.buf = null;
  }
  if (tileQueue.length) needFrame = true;
}
function pruneTiles() {
  const old = [...tiles].filter(([, t]) => (t.ready || t.failed || t.buf) && t.used < streetUse).sort((a, b) => a[1].used - b[1].used);
  for (const [k] of old.slice(0, tiles.size - Math.round(streetCap() * 0.75))) tiles.delete(k);
}
/* the tile reaches us as a protobuf of layers of tagged line/polygon
   geometry (the Mapbox vector-tile layout): varint-framed fields, packed
   zig-zag coordinate deltas against a 4096 extent. mvtParse keeps only the
   layers the street sheet draws. */
const TXT = new TextDecoder();
// the label layers read for names: a road's label class to its rank (0 the
// freeways, 4 the lanes; Esri's classes as its own style sorts them), and
// the point layers that name parks and water
const ROAD_RANK = { 0: 0, 1: 0, 75: 0, 2: 1, 3: 1, 150: 1, 4: 2, 10: 3, 5: 3, 12: 4, 6: 4 };
const SPOT_OF = (n) => (n === "Park or farming/label" ? "park" : n === "Water point" || /^(Water area|Marine area|Marine waterbody)(\/| ).*label/.test(n) ? "water" : null);
function mvtParse(buf) {
  const vint = (b, st) => { let x = 0, s = 0; for (;;) { const v = b[st.i++]; x += (v & 127) * 2 ** s; s += 7; if (!(v & 128)) return x; } };
  const packed = (b) => { const st = { i: 0 }, out = []; while (st.i < b.length) out.push(vint(b, st)); return out; };
  const out = { roads: [], tuns: [], rail: [], waterL: [], fills: { urban: [], park: [], water: [] }, sea: [], names: [], spots: [] };
  for (let i = 0; i <= 10; i++) { out.roads.push([]); out.tuns.push([]); }
  const FILL_OF = { "Urban area": "urban", "Park or farming": "park", "Golf course": "park", Airport: "park", Zoo: "park", "Marine area": "water", "Water area": "water" };
  const root = { i: 0 };
  while (root.i < buf.length) {
    const tag = vint(buf, root), no = tag >> 3, wire = tag & 7;
    if (wire === 2) { const n = vint(buf, root); const layer = buf.subarray(root.i, root.i + n); root.i += n; if (no === 3) mvtLayer(layer); }
    else if (wire === 0) vint(buf, root);
    else break;
  }
  return out;
  function mvtLayer(lb) {
    const st = { i: 0 };
    const L = { name: "", keys: [], valsr: [], extent: 4096, raw: [] };
    while (st.i < lb.length) {
      const tag = vint(lb, st), no = tag >> 3, wire = tag & 7;
      if (wire === 2) { const n = vint(lb, st), v = lb.subarray(st.i, st.i + n); st.i += n;
        if (no === 1) L.name = TXT.decode(v); else if (no === 2) L.raw.push(v); else if (no === 3) L.keys.push(TXT.decode(v)); else if (no === 4) L.valsr.push(v);
      } else if (wire === 0) { const n = vint(lb, st); if (no === 5) L.extent = n; }
    }
    const kind = FILL_OF[L.name], isRoad = L.name === "Road" || L.name === "Road tunnel";
    const spot = SPOT_OF(L.name);
    if (!kind && !isRoad && !spot && L.name !== "Road/label" && L.name !== "Railroad" && L.name !== "Water line") return;
    const vals = L.valsr.map((v) => {
      const vs = { i: 0 }; let o = null;
      while (vs.i < v.length) { const t = vint(v, vs), no = t >> 3, w = t & 7;
        if (w === 2) { const n = vint(v, vs); const s = v.subarray(vs.i, vs.i + n); vs.i += n; if (no === 1) o = TXT.decode(s); }
        else if (w === 0) { const n = vint(v, vs); o = no === 7 ? !!n : n; }
        else if (w === 1) vs.i += 8; else if (w === 5) vs.i += 4; }
      return o;
    });
    for (const fb of L.raw) {
      const f = { tags: [], geom: [], type: 0 };
      const fs = { i: 0 };
      while (fs.i < fb.length) { const t = vint(fb, fs), no = t >> 3, w = t & 7;
        if (w === 2) { const n = vint(fb, fs), v = fb.subarray(fs.i, fs.i + n); fs.i += n;
          if (no === 2) f.tags = packed(v); else if (no === 4) f.geom = packed(v); }
        else if (w === 0) { const v = vint(fb, fs); if (no === 3) f.type = v; } }
      const tags = {};
      for (let i = 0; i + 1 < f.tags.length; i += 2) tags[L.keys[f.tags[i]]] = vals[f.tags[i + 1]];
      const parts = decodeParts(f.geom);
      if (!parts.length) continue;
      // (Esri's sea is the map's sea mask, where the ocean's own paper goes: the sheet leaves
      // it unfilled, so its water grey never tints the ocean the streets are multiplied onto)
      if (kind) { if (L.name === "Marine area") out.sea.push({ ext: L.extent, parts }); else out.fills[kind].push({ ext: L.extent, parts }); continue; }
      // names: a road's along its label line (route shields carry only _name - left out),
      // a park's or a water's at its label point
      if (L.name === "Road/label") {
        const name = tags._name_global;
        if (name && f.type === 2 && tags.Viz !== 3) for (const pt of parts) out.names.push({ name, rank: /\b(Lane|Place|Mews)\b/.test(name) ? 4 : ROAD_RANK[tags._label_class] ?? 3, ext: L.extent, pts: pt });
        continue;
      }
      if (spot) {
        const name = tags._name_global || tags._name;
        if (name && f.type === 1) for (const pt of parts) out.spots.push({ name, kind: spot, ext: L.extent, x: pt[0], y: pt[1] });
        continue;
      }
      if (L.name === "Railroad") { out.rail.push({ ext: L.extent, parts }); continue; }
      if (L.name === "Water line") { out.waterL.push({ ext: L.extent, parts }); continue; }
      if (tags.Viz === 3) continue; // Esri's suppression lane
      const cls = typeof tags._symbol === "number" ? tags._symbol >> 1 : -1;
      if (cls < 0 || cls > 10 || (tags._symbol & 1)) continue;
      (L.name === "Road" ? out.roads : out.tuns)[cls].push({ ext: L.extent, parts });
    }
  }
}
// the tile's sea (Esri's "Marine area": every ocean, bay and harbour, and
// nothing inland) as one path in the tile's unit square
function seaPath(bkts) {
  const p = new Path2D();
  for (const bkt of bkts) {
    const k = 1 / bkt.ext;
    for (const r of bkt.parts) { p.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i] * k, r[i + 1] * k); p.closePath(); }
  }
  return p;
}
// command streams to flat [x0,y0,x1,y1,...] parts; rings remembered as closed
const zig = (v) => (v >> 1) ^ -(v & 1);
function decodeParts(geom) {
  const parts = []; let x = 0, y = 0, i = 0, cur = null;
  while (i < geom.length) {
    const cmd = geom[i++], id = cmd & 7, n = cmd >> 3;
    if (id === 7) { if (cur) cur.closed = true; continue; }
    for (let k = 0; k < n; k++) {
      x += zig(geom[i++]); y += zig(geom[i++]);
      if (id === 1) { cur = [x, y]; parts.push(cur); } else if (cur) cur.push(x, y);
    }
  }
  return parts;
}
/* and the sheet back out of it: grey-canvas colours measured off the raster
   sheets themselves (land exactly STREET_LAND so the land-lift still reads
   plain land), road width by class against zoom in tile-256 px */
const SHEET = {
  // (on paper the built-up tint is left out: under a multiply it greyed every
  // city seat's colour for no information the streets don't already give)
  light: { land: "#efefef", urban: "#efefef", water: "#d0cfd4", park: "#e3e8e2", line: "#ffffff", case: "#d3d4d6", tcase: "#dedfe1", tline: "#fcfcfc", rail: "#c9cacc", railBox: "#f7f7f7" },
  dark: { land: "#474749", urban: "#505052", water: "#232227", park: "#4a4c4b", line: "#666668", case: "#3a3b3d", tcase: "#434446", tline: "#5c5c5f", rail: "#5e5e60", railBox: "#383839" },
};
// fwy, hwy, fwy-ramp, major, major-ramp, minor, minor-ramp, local, service, walking, 4wd
const RW = [
  [[12, 1.0], [14, 2.8], [16, 5.5], [18, 16]], [[12, 0.9], [14, 2.6], [16, 5.0], [18, 15]],
  [[12, 0.5], [14, 1.4], [16, 2.8], [18, 8]], [[12, 0.8], [14, 2.4], [16, 4.6], [18, 13]],
  [[12, 0.5], [14, 1.2], [16, 2.4], [18, 7]], [[12, 0.6], [14, 2.0], [16, 3.8], [18, 11]],
  [[12, 0.4], [14, 1.0], [16, 2.0], [18, 6]], [[13, 0.6], [15, 1.6], [16, 2.4], [18, 9]],
  [[14, 0.6], [16, 1.6], [18, 6]], [[15, 0.8], [16, 1.2], [18, 5]], [[14, 0.5], [16, 1.2], [18, 4]],
];
const ROAD_ORDER = [10, 9, 8, 7, 6, 5, 4, 3, 1, 0, 2]; // the little roads go under the big ones
const SWT = (stops, z) => {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) { const [z1, w1] = stops[i], [z0, w0] = stops[i - 1]; if (z <= z1) return w0 + ((w1 - w0) * (z - z0)) / (z1 - z0); }
  return stops[stops.length - 1][1];
};
function renderTile(parsed, dark, z, px) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const g = cv.getContext("2d"), pal = dark ? SHEET.dark : SHEET.light, W256 = px / 256;
  g.lineJoin = g.lineCap = "round";
  g.fillStyle = pal.land; g.fillRect(0, 0, px, px);
  const fillParts = (bkt) => {
    const k = px / bkt.ext;
    g.beginPath();
    for (const r of bkt.parts) { g.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) g.lineTo(r[i] * k, r[i + 1] * k); g.closePath(); }
    g.fill();
  };
  const strokeParts = (bkt, w) => {
    const k = px / bkt.ext;
    g.lineWidth = w;
    g.beginPath();
    for (const r of bkt.parts) { g.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) g.lineTo(r[i] * k, r[i + 1] * k); if (r.closed) g.closePath(); }
    g.stroke();
  };
  for (const key of ["urban", "park", "water"]) { g.fillStyle = pal[key]; for (const bkt of parsed.fills[key]) fillParts(bkt); }
  if (parsed.waterL.length) { g.strokeStyle = pal.water; for (const bkt of parsed.waterL) strokeParts(bkt, Math.max(0.8 * W256, SWT([[11, 1], [14, 1.4], [17, 2.5]], z) * W256)); }
  if (parsed.rail.length) {
    g.strokeStyle = pal.railBox; for (const bkt of parsed.rail) strokeParts(bkt, SWT([[11, 1.2], [14, 1.8], [18, 3]], z) * W256);
    g.strokeStyle = pal.rail; for (const bkt of parsed.rail) strokeParts(bkt, SWT([[11, 0.7], [14, 0.9], [18, 1.2]], z) * W256);
  }
  for (const cls of ROAD_ORDER) { // tunnels first, every casing under every line
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.tcase; for (const bkt of parsed.tuns[cls]) strokeParts(bkt, (w + 1.6) * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.tline; for (const bkt of parsed.tuns[cls]) strokeParts(bkt, w * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.case; for (const bkt of parsed.roads[cls]) strokeParts(bkt, (w + (cls <= 8 ? 1.6 : 0)) * W256);
  }
  for (const cls of ROAD_ORDER) {
    const w = SWT(RW[cls], z); if (w <= 0) continue;
    g.strokeStyle = pal.line; for (const bkt of parsed.roads[cls]) strokeParts(bkt, w * W256);
  }
  return cv;
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
function quadFit(q) {
  const [a, b, c, d] = q;
  const B = [(b[0] - a[0] + d[0] - c[0]) / 2, (b[1] - a[1] + d[1] - c[1]) / 2];
  const C = [(c[0] - a[0] + d[0] - b[0]) / 2, (c[1] - a[1] + d[1] - b[1]) / 2];
  const o = [(a[0] + b[0] + c[0] + d[0]) / 4 - (B[0] + C[0]) / 2, (a[1] + b[1] + c[1] + d[1]) / 4 - (B[1] + C[1]) / 2];
  return { m: [B[0], B[1], C[0], C[1], o[0], o[1]], e: 0.5 / Math.max(1, Math.min(Math.hypot(B[0], B[1]), Math.hypot(C[0], C[1]))) };
}
function drawQuad(g, img, sx, sy, sw, q, alpha) {
  const { m, e } = quadFit(q);
  g.globalAlpha = alpha;
  g.setTransform(...m);
  g.drawImage(img, sx, sy, sw, sw, -e, -e, 1 + 2 * e, 1 + 2 * e);
}
// a tile's sea laid on its quad (or a coarser tile's, its part at ox, oy of
// s squares a side), clipped to the quad so it never covers a neighbour's
// (or, given a line width in device px, its edge: the clip keeps the tile's
// buffer ring, past its square, out of the stroke, so only the coast draws)
function seaQuad(g, sea, q, s = 1, ox = 0, oy = 0, line = 0) {
  const { m, e } = quadFit(q);
  g.setTransform(...m);
  g.save();
  g.beginPath(); g.rect(-e, -e, 1 + 2 * e, 1 + 2 * e); g.clip();
  if (s !== 1) g.transform(s, 0, 0, s, -ox, -oy);
  if (line) { g.lineWidth = line / (s * Math.min(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]))); g.stroke(sea); } else g.fill(sea);
  g.restore();
}
/* The streets come in two steps around the seat fills. prepStreets lays the
   tiles under the view on a sheet the size of the canvas, and their sea on a
   mask beside it; layStreets multiplies (screens) the sheet over the fills.
   The mask lets Esri's coast stand as the map's only one from street zoom:
   the AEC's coastline is coarse (Craggy Island is 23 points in its own
   file) and sits typically 10-40m, at worst ~120m, off Esri's, so two
   coasts showed. Where every tile in view has a sea to hand (cover), the
   seats are drawn grown past their AEC coasts (SEA_GROW, drawGeo) and laySea
   then puts the plain sea back over everything seaward of Esri's coast. */
let seaCv = null, seaLay = null, prepKnown = null;
/* An island the AEC draws and Esri's sea covers whole (Curtis Island, in
   Bass: Esri has it only as a reserve laid over its sea) would be cut away
   with the sea. Each small ring of the seats' (under ~100 km2) is tested at
   a point inside it against the sea of the tile it lies in, once a tile, and
   one the sea swallows is cut back out of the mask, its AEC coast drawn. */
// (a seat's small rings, made the first time the seat is in view at street zoom)
function islets(g, i) {
  const all = (g.islets ??= []);
  if (all[i]) return all[i];
  const out = (all[i] = []), P = g.proj, ps = g.polys(i);
  if (ps) {
    for (const pg of ps) {
      const r = pg.outer; if (Math.abs(ringArea(r)) > 5) continue;
      const [cx, cy] = ringMid(r);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); y0 = Math.min(y0, r[k + 1]); y1 = Math.max(y1, r[k + 1]); }
      const pt = ringInside(r, cx, cy), path = new Path2D();
      for (let k = 0; k < r.length; k += 2) (k ? path.lineTo : path.moveTo).call(path, r[k], r[k + 1]);
      path.closePath();
      out.push({ i, bb: [[x0, y0], [x1, y1]], at: merc(P.invert(pt)), path, seen: new WeakMap() });
    }
  }
  return out;
}
// a point inside a flat ring: the middle of its bounds where that is in it,
// else the middle of the widest span of the line across it there
function ringInside(r, cx, cy) {
  const xs = [];
  for (let k = 0, n = r.length; k < n; k += 2) {
    const ax = r[k], ay = r[k + 1], bx = r[(k + 2) % n], by = r[(k + 3) % n];
    if ((ay <= cy) !== (by <= cy)) xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay));
  }
  xs.sort((a, b) => a - b);
  let best = [cx, cy], w = -1, mid = false;
  for (let k = 0; k + 1 < xs.length; k += 2) { if (xs[k] <= cx && cx <= xs[k + 1]) mid = true; if (xs[k + 1] - xs[k] > w) { w = xs[k + 1] - xs[k]; best = [(xs[k] + xs[k + 1]) / 2, cy]; } }
  return mid ? [cx, cy] : best;
}
function rescue(st, sg) {
  const m = M(); if (!m) return;
  const g = geoOf(m), [x0, y0, x1, y1] = viewBox();
  hitCtx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < m.divs.length; i++) if (inBox(g.bb[i], x0, y0, x1, y1)) for (const r of islets(g, i)) {
    if (!inBox(r.bb, x0, y0, x1, y1)) continue;
    for (const { tz, tx, ty, a: [sea, , s = 1, ox = 0, oy = 0] } of st.seas) {
      const n = 2 ** tz, u = r.at[0] * n - tx, v = r.at[1] * n - ty;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      let wet = r.seen.get(sea);
      if (wet == null) r.seen.set(sea, (wet = hitCtx.isPointInPath(sea, (u + ox) / s, (v + oy) / s)));
      if (wet) st.saved.push(r);
      break;
    }
  }
  if (!st.saved.length) return;
  sg.save();
  sg.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  sg.globalCompositeOperation = "destination-out";
  for (const r of st.saved) sg.fill(r.path);
  sg.restore();
}
function prepStreets(alpha) {
  streetDrawn.length = 0;
  if (!proj || alpha <= 0.004) return null;
  const dark = TH.dark, W = canvas.width, H = canvas.height, now = performance.now();
  streetUse++;
  drainTiles();
  const inv = (sx, sy) => merc(proj.invert([(sx - T.x) / T.k, (sy - T.y) / T.k]));
  // the zoom whose pixels match the screen's, read at the middle of the view
  const m0 = inv(Wpx / 2, Hpx / 2), m1 = inv(Wpx / 2 + 64, Hpx / 2);
  const per = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) / 64;
  // z against the tile's CSS size (256): per-tile art is tilePx() wide so the
  // 512-px artwork still meets the screen 1:1 on a dpr-2 display
  const z = clamp(Math.round(-Math.log2(per * 256) - 0.2), STREETS.zMin, STREETS.zMax), n = 2 ** z;
  // the tiles under the view: its rim carried into Mercator
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]]) {
    const p = inv(u * Wpx, v * Hpx);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const tx0 = Math.floor(x0 * n), tx1 = Math.floor(x1 * n), ty0 = Math.floor(y0 * n), ty1 = Math.floor(y1 * n);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return null; // never at these zooms; a guard
  if (!streetCv) { streetCv = document.createElement("canvas"); seaCv = document.createElement("canvas"); }
  if (streetCv.width !== W || streetCv.height !== H) { streetCv.width = seaCv.width = W; streetCv.height = seaCv.height = H; }
  const g = streetCv.getContext("2d"), land = dark ? STREET_LAND.dark : STREET_LAND.light;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  g.fillStyle = `rgb(${land},${land},${land})`; g.fillRect(0, 0, W, H);
  const sg = seaCv.getContext("2d");
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, W, H); sg.fillStyle = "#000";
  // known: the quads whose sea is in hand (a tile's own, a coarser one's part, or all
  // four finer ones'), where Esri's coast stands in for the AEC's
  const seas = [], known = new Path2D();
  let some = false;
  const sea1 = (tz, tx, ty, ...a) => { seaQuad(sg, ...a); seas.push({ tz, tx, ty, a }); };
  const know = (q) => {
    // a pixel past its edges, so no hairline of the unknown opens between two known quads
    const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
    [0, 1, 3, 2].forEach((c, k) => { const dx = q[c][0] - cx, dy = q[c][1] - cy, d = Math.hypot(dx, dy) || 1; (k ? known.lineTo : known.moveTo).call(known, q[c][0] + dx / d, q[c][1] + dy / d); });
    known.closePath(); some = true;
  };
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const q = tileQuad(z, tx, ty);
    if (Math.max(q[0][0], q[1][0], q[2][0], q[3][0]) < 0 || Math.min(q[0][0], q[1][0], q[2][0], q[3][0]) > W
      || Math.max(q[0][1], q[1][1], q[2][1], q[3][1]) < 0 || Math.min(q[0][1], q[1][1], q[2][1], q[3][1]) > H) continue;
    const t = tileAt(dark, z, tx, ty, true);
    const f = t && t.ready ? clamp((now - t.ready) / 200, 0, 1) : 0;
    let sea = !!(t && t.ready);
    if (sea) sea1(z, tx, ty, t.sea, q);
    if (f < 1) {
      // until it arrives (and while it fades in): the nearest coarser tile on hand,
      // else the finer ones of the zoom just left
      let held = false;
      for (let up = 1; up <= 6 && z - up >= STREETS.zMin && !held; up++) {
        const s = 2 ** up, px = tx >> up, py = ty >> up, pt = tileAt(dark, z - up, px, py, false);
        if (pt && pt.ready) {
          const w = pt.cv.width / s; drawQuad(g, pt.cv, (tx - px * s) * w, (ty - py * s) * w, w, q, 1); held = true;
          if (!sea) { sea1(z, tx, ty, pt.sea, q, s, tx - px * s, ty - py * s); sea = true; }
        }
      }
      if (!held && z < STREETS.zMax) {
        let kids = 0;
        for (let k = 0; k < 4; k++) {
          const cx = 2 * tx + (k & 1), cy = 2 * ty + (k >> 1), ct = tileAt(dark, z + 1, cx, cy, false);
          if (ct && ct.ready) { const cq = tileQuad(z + 1, cx, cy); drawQuad(g, ct.cv, 0, 0, ct.cv.width, cq, 1); if (!sea) sea1(z + 1, cx, cy, ct.sea, cq); kids++; }
        }
        if (kids === 4) sea = true;
      }
      if (t && t.ready) needFrame = true;
    }
    if (sea) know(q);
    if (f > 0) { drawQuad(g, t.cv, 0, 0, t.cv.width, q, f); streetDrawn.push({ t, z, tx, ty, f }); }
  }
  // the plain land to nothing: lifted to white on paper, differenced to black on the dark page
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.globalCompositeOperation = dark ? "difference" : "lighter";
  const lift = dark ? land : 255 - land;
  g.fillStyle = `rgb(${lift},${lift},${lift})`; g.fillRect(0, 0, W, H);
  // on paper the streets come in at half strength over a seat's opening view
  // and reach full strength at street zoom, so a city seat still reads as its
  // colour first; on the dark page they are quiet already
  const st = { a: alpha * (dark ? 0.85 : 0.5 + 0.5 * smooth(300, 1000, T.k)), op: dark ? "screen" : "multiply", known: some ? known : null, seas, saved: [] };
  if (some) rescue(st, sg);
  prepKnown = st.known;
  return st;
}
function layStreets(st) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = st.a; ctx.globalCompositeOperation = st.op;
  ctx.drawImage(streetCv, 0, 0);
  ctx.restore();
}
// the sea where Esri's lies: whatever the seats put there cut away, the ocean laid back
// beneath, and the sheet's own marks on the water (a bridge, a pier) over it as the
// streets lie on the land
function laySea(m, st, alpha) {
  const W = canvas.width, H = canvas.height;
  if (!seaLay) seaLay = document.createElement("canvas");
  if (seaLay.width !== W || seaLay.height !== H) { seaLay.width = W; seaLay.height = H; }
  const L = seaLay.getContext("2d");
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = "source-over";
  L.clearRect(0, 0, W, H);
  L.drawImage(streetCv, 0, 0);
  L.globalCompositeOperation = "destination-in"; L.drawImage(seaCv, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "destination-out"; ctx.drawImage(seaCv, 0, 0);
  ctx.restore();
  oceanUnder(m);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha * st.a; ctx.globalCompositeOperation = st.op; ctx.drawImage(seaLay, 0, 0);
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "source-over";
  // the coast's hairline, as the AEC's was drawn, along Esri's
  ctx.strokeStyle = css(TH.coast, 0.55); ctx.lineJoin = "round";
  for (const { a: [sea, q, s = 1, ox = 0, oy = 0] } of st.seas) seaQuad(ctx, sea, q, s, ox, oy, 0.7 * dpr);
  // and the AEC's, round an island Esri's sea swallows whole
  if (st.saved.length) {
    ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y); ctx.lineWidth = 0.7 / T.k;
    for (const r of st.saved) ctx.stroke(r.path);
  }
  ctx.restore();
}
/* the names: streets along their own line, parks and water level, read from
   the same tiles and set on the screen after the map's own labels, so a seat,
   booth or dot never gives way to one. A street's name turns with the street
   as it lies on this map, and a park's sits level - the sheet's lettering
   never rides the tile's tilt through the projection. */
// the tile zoom each road rank is named from: nothing at a seat's opening
// view (z13 for a city seat), where the booths' names already fill it
const NAME_Z = [14, 14, 15, 15, 17];
const NAME_GAP = 240; // px between two labels of one name
function tileLabels(e) {
  const t = e.t;
  if (t.lab) return t.lab;
  const n = 2 ** e.z, at = (px, py, ext) => proj(unmerc((e.tx + px / ext) / n, (e.ty + py / ext) / n));
  const roads = (t.names || []).map((r) => {
    const q = new Float64Array(r.pts.length);
    for (let i = 0; i < r.pts.length; i += 2) { const p = at(r.pts[i], r.pts[i + 1], r.ext); q[i] = p[0]; q[i + 1] = p[1]; }
    return { name: r.name, rank: r.rank, q };
  });
  const spots = (t.spots || []).map((s) => { const p = at(s.x, s.y, s.ext); return { name: s.name, kind: s.kind, x: p[0], y: p[1] }; });
  return (t.lab = { roads, spots });
}
function drawStreetNames(placed, obst, alpha) {
  if (!proj || alpha <= 0.02 || !streetDrawn.length) return;
  const th = TH, dark = th.dark, z = streetDrawn[0].z, seen = new Map();
  const hits = (r) => { for (const q of placed) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; for (const q of obst) if (!(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3])) return true; return false; };
  const near = (name, x, y) => { const l = seen.get(name); if (!l) return false; for (const [a, b] of l) if (Math.hypot(a - x, b - y) < NAME_GAP) return true; return false; };
  const note = (name, x, y) => { if (!seen.has(name)) seen.set(name, []); seen.get(name).push([x, y]); };
  const roads = [], spots = [];
  for (const e of streetDrawn) {
    const lab = tileLabels(e);
    for (const r of lab.roads) if (z >= NAME_Z[r.rank]) roads.push({ r, f: e.f });
    for (const s of lab.spots) spots.push({ s, f: e.f });
  }
  roads.sort((a, b) => a.r.rank - b.r.rank || b.r.q.length - a.r.q.length);
  ctx.lineJoin = "round"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const ink = css(th.ink3), halo = dark ? "rgba(0,0,0,0.4)" : css(th.bg, 0.8);
  const draw = (txt, x, y, ang, f) => {
    ctx.save();
    ctx.globalAlpha = alpha * f;
    ctx.translate(x, y); if (ang) ctx.rotate(ang);
    ctx.lineWidth = 2.6; ctx.strokeStyle = halo; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = ink; ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  // a street: the straightest run of its line at its middle (or a third of the
  // way either side) long enough for the name, the text turned to it and kept
  // reading left to right; its room is a row of squares along it
  let n = 0;
  for (const { r, f } of roads) {
    if (n >= 48) break;
    ctx.font = `${r.rank <= 1 ? 600 : 500} ${r.rank <= 1 ? 10.5 : 10}px ${SANS}`;
    const w = ctx.measureText(r.name).width, h = 12, q = r.q, m = q.length / 2;
    if (m < 2) continue;
    const X = new Float64Array(m), Yp = new Float64Array(m), L = new Float64Array(m);
    for (let i = 0; i < m; i++) { X[i] = q[2 * i] * T.k + T.x; Yp[i] = q[2 * i + 1] * T.k + T.y; if (i) L[i] = L[i - 1] + Math.hypot(X[i] - X[i - 1], Yp[i] - Yp[i - 1]); }
    const len = L[m - 1];
    if (len < w + 16) continue;
    const ptAt = (d) => { let i = 1; while (i < m - 1 && L[i] < d) i++; const u = (d - L[i - 1]) / (L[i] - L[i - 1] || 1); return [X[i - 1] + (X[i] - X[i - 1]) * u, Yp[i - 1] + (Yp[i] - Yp[i - 1]) * u]; };
    for (const at of [0.5, 0.3, 0.7]) {
      const c = len * at; if (c - w / 2 < 0 || c + w / 2 > len) continue;
      const a = ptAt(c - w / 2), b = ptAt(c + w / 2);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < w * 0.96) continue;
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      if (cx < 4 || cy < 4 || cx > Wpx - 4 || cy > Hpx - 4) continue;
      if (near(r.name, cx, cy)) break;
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      const k = Math.max(1, Math.ceil(w / h)), boxes = [];
      for (let j = 0; j < k; j++) { const d = ((j + 0.5) / k - 0.5) * w, x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d; boxes.push([x - h / 2, y - h / 2, x + h / 2, y + h / 2]); }
      if (boxes.some((bx) => bx[0] < 2 || bx[1] < 2 || bx[2] > Wpx - 2 || bx[3] > Hpx - 2 || hits(bx))) continue;
      placed.push(...boxes); note(r.name, cx, cy); n++;
      draw(r.name, cx, cy, ang, f);
      break;
    }
  }
  // parks and water: level, italic, from the same zoom as the minor roads
  if (z >= NAME_Z[2]) for (const { s, f } of spots) {
    const x = s.x * T.k + T.x, y = s.y * T.k + T.y;
    if (x < 0 || y < 0 || x > Wpx || y > Hpx || near(s.name, x, y)) continue;
    ctx.font = `italic ${s.kind === "water" ? 500 : 400} 10.5px ${SANS}`;
    const w = ctx.measureText(s.name).width, bx = [x - w / 2 - 2, y - 7, x + w / 2 + 2, y + 7];
    if (bx[0] < 2 || bx[2] > Wpx - 2 || bx[1] < 2 || bx[3] > Hpx - 2 || hits(bx)) continue;
    placed.push(bx); note(s.name, x, y);
    draw(s.name, x, y, 0, f);
  }
}
let creditOn = false;
function showCredit(on) {
  if (on === creditOn) return;
  creditOn = on; $("#credit").hidden = !on;
}

/* ----- the islands -----
   Norfolk, Lord Howe, Christmas and the Cocos (Keeling) Islands lie hundreds
   to thousands of km past the mainland frame the seats are clipped to, so
   each is drawn in a box of its own, north up at its own scale, the way
   printed maps inset them. At the country view a box sits in the sea on its
   own side of the continent (the Indian Ocean pair off the north-west, the
   Tasman pair off the south-east) and moves with the map. When the selection
   holds its seat (Bean, Sydney or Lingiari, or their state) the box docks,
   larger, beside the seat in room the fit keeps clear, with its polling
   places drawn and live; it glides between the two, and fades as the reader
   zooms well past the docked fit. A box is a way there, too: a click on it,
   or zooming in on it, flies the map out to the island where it lies, coast,
   streets and polling places at any zoom, with a way back to its seat; the
   box itself steps aside while the island shows. */
// the boxes at sea go in two pairs, each a diagonal as the islands lie (Christmas
// north-east of Cocos, Norfolk north-east of Lord Howe), the pair's middle at a
// fraction of the home box: in the sea inside it where the stage is wider than
// the map (side), else in the room the stage leaves above and below the map
// (stacked) - off the north-west and south-east coasts either way
const ISL_PAIRS = [["christmas", "cocos"], ["norfolk", "lordhowe"]];
const ISL_AT = { side: [[0.14, 0.145], [1.015, 0.78]], stacked: [[0.2, -0.15], [0.86, 1.07]] };
const ISL_SHORT = { cocos: "Cocos Islands" };
// the caption's line under a box at sea, and its band inside a docked box; the room between docked boxes
const ISL_CAP = 15, ISL_DCAP = 20, ISL_GAP = 10;
const islSea = () => clamp(HOME.k * 96, 42, 64);
const islDock = () => (isPhone() ? 92 : 124);
let dock = null; // { side: "left" | "bottom", k }: the docked fit fitSelection last made, else null
const islAnim = new Map();
let islDrawn = [];
// the island the camera is out at (its key), else null: only then does the pan reach past the mainland frame
let away = null;
const islOf = (m, key) => (m && m.isl ? m.isl.find((q) => q.key === key) || null : null);
// the island the selection is out at: one opened by name, or the island of a chosen polling place
function selIsland() {
  const m = M(); if (!m || !m.isl) return null;
  if (S.sel.isl) return islOf(m, S.sel.isl);
  if (S.sel.level === "booth" && m.booth.isl[S.sel.booth] >= 0) return m.isl[m.booth.isl[S.sel.booth]];
  return null;
}
// out to an island: its seat opened (an island in no seat that year opens alone)
function goIsland(key, o) {
  const m = M(), q = islOf(m, key); if (!q) return;
  const i = q.seat;
  select(i != null ? { level: "div", st: m.divs[i].st, div: i, isl: key } : { level: "aus", isl: key }, { dur: 1300, ...o });
}
// on screen as land, big enough to read: its box then steps aside
const islShows = (q) => { const x0 = q.mbb[0][0] * T.k + T.x, x1 = q.mbb[1][0] * T.k + T.x, y0 = q.mbb[0][1] * T.k + T.y, y1 = q.mbb[1][1] * T.k + T.y; return x1 - x0 > 30 && x1 > 0 && x0 < Wpx && y1 > 0 && y0 < Hpx; };
// the islands the selection holds: its seat's, or (a state) its seats'
function heldIslands(m) {
  if (!m || !m.isl) return [];
  const sd = selDiv();
  if (selIsland()) return [];
  if (sd != null) return m.isl.filter((s) => s.seat === sd);
  if (S.sel.level === "state") return m.isl.filter((s) => s.seat != null && m.divs[s.seat].st === S.sel.st);
  return [];
}
// docked boxes: a column up from the stage's foot at its left, or a row along the foot
function dockRects(n, side) {
  const p = stagePads(), D = islDock(), out = [];
  for (let i = 0; i < n; i++) {
    const h = D + ISL_DCAP;
    if (side === "left") out.push({ x: p.l, y: Hpx - p.b - h - (n - 1 - i) * (h + ISL_GAP), w: D, h });
    else out.push({ x: p.l + i * (D + ISL_GAP), y: Hpx - p.b - h, w: D, h });
  }
  return out;
}
// the fit of a selection that holds islands keeps their docked boxes clear,
// in a column at the left or a row along the foot, whichever leaves the seat larger
function dockedFit(box, n) {
  const D = islDock(), p = stagePads(), opts = [];
  if (n * (D + ISL_DCAP) + (n - 1) * ISL_GAP <= Hpx - p.t - p.b) opts.push(["left", fitTransform(box, 0, { l: D + ISL_GAP + 4 })]);
  if (n * D + (n - 1) * ISL_GAP <= Wpx - p.l - p.r) opts.push(["bottom", fitTransform(box, 0, { b: D + ISL_DCAP + ISL_GAP })]);
  if (!opts.length) return { t: fitTransform(box), side: null };
  opts.sort((a, b) => b[1].k - a[1].k);
  return { t: opts[0][1], side: opts[0][0] };
}
// each box's centre at the country fit, in stage px: a pair's two boxes a box
// and a caption apart down the diagonal, the pair shifted whole onto the stage
// (captions and all) and below the cities and the hint over its top. The
// stacked places once the stage leaves the pair room above the map
// (the hint empties and the cities hide once a seat is chosen, so their foot is
// measured while they show and remembered for the stage's width)
let seaMemo = null, seaTop = { w: 0, top: 4 };
function seaSpots(m, hb, A, p) {
  const cities = $("#cities"), hint = $("#hint");
  if (cities && !cities.hidden && hint && hint.textContent) {
    const st = $("#stage").getBoundingClientRect();
    let top = 4;
    for (const el of [cities, hint]) if (el.offsetHeight) top = Math.max(top, el.getBoundingClientRect().bottom - st.top + 14);
    seaTop = { w: Wpx, top };
  }
  const top = seaTop.w === Wpx ? seaTop.top : isPhone() ? (FS.on ? FS.ins.t : 0) + 4 : p.t + 22;
  const memo = [m.year, Wpx, Hpx, HOME.k, HOME.x, HOME.y, top].join();
  if (seaMemo && seaMemo.memo === memo) return seaMemo.out;
  const room = Hpx - p.t - p.b - (hb[1][1] - hb[0][1]) * HOME.k, at = ISL_AT[room >= 2 * (A + ISL_CAP + 8) ? "stacked" : "side"];
  const dx = A * 0.62, dy = (A + ISL_CAP) / 2 + 4, out = {};
  ctx.font = `400 10.5px ${SANS}`;
  ISL_PAIRS.forEach(([ne, sw], k) => {
    const f = at[k], mx = (hb[0][0] + f[0] * (hb[1][0] - hb[0][0])) * HOME.k + HOME.x, my = (hb[0][1] + f[1] * (hb[1][1] - hb[0][1])) * HOME.k + HOME.y;
    const c = { [ne]: [mx + dx, my - dy], [sw]: [mx - dx, my + dy] };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const key of [ne, sw]) {
      const isl = m.isl.find((q) => q.key === key), name = ISL_SHORT[key] || (isl ? isl.name : "");
      const [x, y] = c[key], half = Math.max(A, ctx.measureText(name).width + 6) / 2;
      x0 = Math.min(x0, x - half); x1 = Math.max(x1, x + half); y0 = Math.min(y0, y - A / 2); y1 = Math.max(y1, y + A / 2 + ISL_CAP);
    }
    // (kept on the clear ground: in full screen, off the plates)
    const q = FS.on ? FS.ins : { l: 0, r: 0, b: 0 }, L = q.l + 4, R = Wpx - q.r - 4, B = Hpx - q.b - 4;
    const sx = x0 < L ? L - x0 : x1 > R ? R - x1 : 0, sy = y0 < top ? top - y0 : y1 > B ? B - y1 : 0;
    // the hint's clearance can push a pair down onto the coast: step it back out to
    // sea until no box edge or caption line touches a division's land
    const g = geoOf(m);
    if (g && g.paths) {
      const dir = k === 0 ? -1 : 1;
      let out2 = 0;
      const touches = () => {
        for (const key of [ne, sw]) {
          const isl = m.isl.find((q) => q.key === key), name = ISL_SHORT[key] || (isl ? isl.name : "");
          const half = Math.max(A, ctx.measureText(name).width + 6) / 2;
          const [cx0, cy0] = [c[key][0] + sx + dir * out2, c[key][1] + sy];
          for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) {
            const px = cx0 - half + half * i, py = cy0 - A / 2 + ((A + ISL_CAP) / 2) * j;
            const bx = (px - HOME.x) / HOME.k, by = (py - HOME.y) / HOME.k;
            for (let si = 0; si < g.paths.length; si++) {
              const bb = g.bb[si]; if (!bb || bx < bb[0][0] || bx > bb[1][0] || by < bb[0][1] || by > bb[1][1]) continue;
              if (hitCtx.isPointInPath(g.paths[si], bx, by)) return true;
            }
          }
        }
        return false;
      };
      while (out2 <= 60 && touches() && x0 + sx + dir * (out2 + 6) >= L && x1 + sx + dir * (out2 + 6) <= R) out2 += 6;
      for (const key of [ne, sw]) c[key][0] += dir * out2;
    }
    for (const key of [ne, sw]) out[key] = [c[key][0] + sx, c[key][1] + sy];
  });
  seaMemo = { memo, out };
  return out;
}
function islandCards(m) {
  if (!m.isl || !m.isl.length || !Wpx) return [];
  const held = heldIslands(m), now = performance.now(), out = [], A = islSea(), hb = homeBox(m), p = stagePads();
  const docked = dock && held.length ? dockRects(held.length, dock.side) : null;
  const sea = seaSpots(m, hb, A, p);
  const dockA = dock ? 1 - smooth(2.2, 3.6, T.k / dock.k) : 1;
  for (const s of m.isl) {
    if (away === s.key || islShows(s)) { islAnim.delete(s.key); continue; } // back without a glide
    const hi = docked ? held.indexOf(s) : -1, mode = hi >= 0 ? "dock" : "sea";
    let r;
    if (hi >= 0) r = docked[hi];
    else {
      // placed at the country fit and carried by the map from there
      const [hx, hy] = sea[s.key] || [Wpx / 2, Hpx / 2];
      const cx = ((hx - HOME.x) / HOME.k) * T.k + T.x, cy = ((hy - HOME.y) / HOME.k) * T.k + T.y;
      r = { x: cx - A / 2, y: cy - A / 2, w: A, h: A };
    }
    // the glide between the sea and the dock, from no further out than just off the stage
    let a = islAnim.get(s.key);
    if (!a || a.mode !== mode) {
      const l = a && a.last;
      a = { mode, t0: now, from: l && !reduceMotion ? { ...l, x: clamp(l.x, -l.w, Wpx), y: clamp(l.y, -l.h, Hpx) } : null };
      islAnim.set(s.key, a);
    }
    if (a.from) {
      const u = clamp((now - a.t0) / 650, 0, 1), e = ease(u);
      if (u < 1) { needFrame = true; r = { x: lerp(a.from.x, r.x, e), y: lerp(a.from.y, r.y, e), w: lerp(a.from.w, r.w, e), h: lerp(a.from.h, r.h, e) }; }
      else a.from = null;
    }
    a.last = r;
    const alpha = mode === "dock" ? dockA : 1;
    if (alpha <= 0.01 || r.x > Wpx || r.y > Hpx || r.x + r.w < 0 || r.y + r.h + ISL_CAP < 0) continue;
    out.push({ s, r, docked: mode === "dock", alpha });
  }
  return out;
}
function drawIslands(m, alpha = 1) {
  const cards = islandCards(m);
  islDrawn = [];
  if (!cards.length) return;
  const th = TH, sd = selDiv(), b = m.booth, now = performance.now(), pat = hatch();
  const rf = S.f.range && S.listUnit === "booths" ? S.f.range : null;
  ctx.save();
  ctx.lineJoin = "round";
  for (const c of cards) {
    const { s, r } = c, a = alpha * c.alpha, own = s.owner;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = a;
    // the box: the sea's own paper (no lines: a window on the island's waters), a hairline frame
    const box = new Path2D();
    if (box.roundRect) box.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 3); else box.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.save(); ctx.clip(box); layPaper(a); ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = css(th.ink3, 0.32); ctx.stroke(box);
    // the island, north up, filling the box less a margin; its seat's colour,
    // quieted, veiled and filtered as the map's own shapes are (an island in no
    // seat that year is plain land)
    // (a docked box's name heads it, so the island sits under that band)
    const pad = c.docked ? 9 : Math.max(4, r.w * 0.09), top = c.docked ? ISL_DCAP - 4 : 0;
    const k = Math.min((r.w - 2 * pad) / s.w, (r.h - top - 2 * pad) / s.h);
    const ox = r.x + (r.w - s.w * k) / 2, oy = r.y + top + (r.h - top - s.h * k) / 2;
    const places = c.docked && sd != null && s.seat === sd && s.booths.length > 0;
    let col = own == null || drawOf(m) === "balloons" ? th.nodata : fillDiv(m, own);
    if (col && own != null) {
      if (own === sd) col = towards(col, th.bg, quietness(own, now));
      if (sd != null && own !== sd) col = towards(col, th.bg, th.veil);
      else if (S.sel.level === "state" && m.divs[own].st !== S.sel.st) col = towards(col, th.bg, th.veil * 0.85);
      if (filtersOn() && !passes(m, own)) col = towards(col, th.bg, 0.8);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.clip();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    if (col) ctx.fillStyle = css(col);
    else { pat.setTransform(new DOMMatrix().scale(1 / (dpr * k))); ctx.fillStyle = pat; }
    ctx.fill(s.path);
    ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / k; ctx.stroke(s.path);
    const hov = own != null && S.hover && S.hover.kind === "div" && S.hover.i === own;
    if (own != null && (own === sd || hov)) { ctx.strokeStyle = css(th.ink, own === sd ? 1 : 0.9); ctx.lineWidth = (own === sd ? 1.8 : 1.4) / k; ctx.stroke(s.path); }
    ctx.restore();
    // the polling places, biggest first; two at one spot (a polling place and
    // its early-voting centre) sit side by side
    const dots = [];
    if (places) {
      for (const j of s.booths.slice().sort((p, q) => boothSizeVotes(b, q) - boothSizeVotes(b, p))) {
        const rr = clamp(3.4 * voteScale(boothSizeVotes(b, j)), 2.6, 8);
        let x = ox + (b.raw.lon[j] - s.lon0) * s.cos * k, y = oy + (s.lat1 - b.raw.lat[j]) * k;
        for (const d of dots) if (Math.hypot(d.x - x, d.y - y) < d.r + rr) x = d.x + d.r + rr + 2;
        dots.push({ j, x: clamp(x, r.x + rr + 3, r.x + r.w - rr - 3), y: clamp(y, r.y + rr + 3, r.y + r.h - rr - 3), r: rr });
      }
      pat.setTransform(new DOMMatrix().scale(1 / dpr));
      for (const d of dots) {
        ctx.globalAlpha = a * (rf && !inRange(boothColValue(m, d.j, rf.key), rf) ? 0.2 : 1);
        boothShape(ctx, b.ty[d.j], d.x, d.y, d.r + halo(d.r)); ctx.fillStyle = css(th.bg); ctx.fill();
        const bc = fillBooth(m, d.j);
        boothShape(ctx, b.ty[d.j], d.x, d.y, d.r); ctx.fillStyle = bc ? css(bc) : pat; ctx.fill();
      }
      ctx.globalAlpha = a;
      for (const d of dots) {
        const on = S.sel.level === "booth" && S.sel.booth === d.j, hv = S.hover && S.hover.kind === "booth" && S.hover.i === d.j;
        if (on || hv) { boothShape(ctx, b.ty[d.j], d.x, d.y, d.r + 2.4); ctx.lineWidth = on ? 2.4 : 1.6; ctx.strokeStyle = css(th.ink); ctx.stroke(); }
      }
    }
    // the name: heading a docked box, under a box at sea
    ctx.textBaseline = "middle";
    if (c.docked) {
      ctx.font = `500 11px ${SANS}`;
      const name = ctx.measureText(s.name).width > r.w - 16 && ISL_SHORT[s.key] ? ISL_SHORT[s.key] : s.name;
      ctx.textAlign = "left"; ctx.fillStyle = css(th.ink2); ctx.fillText(name, r.x + 8, r.y + 12);
      islDrawn.push({ s, r, dots, box: [r.x, r.y, r.x + r.w, r.y + r.h] });
    } else {
      const name = ISL_SHORT[s.key] || s.name, cx = r.x + r.w / 2, cy = r.y + r.h + 8.5;
      ctx.font = `400 10.5px ${SANS}`; ctx.textAlign = "center";
      ctx.lineWidth = 2.6; ctx.strokeStyle = css(th.sea, 0.85); ctx.strokeText(name, cx, cy);
      ctx.fillStyle = css(th.ink3); ctx.fillText(name, cx, cy);
      const tw = ctx.measureText(name).width / 2 + 3;
      islDrawn.push({ s, r, dots, box: [Math.min(r.x, cx - tw), r.y, Math.max(r.x + r.w, cx + tw), cy + 7] });
    }
  }
  ctx.restore();
}

/* ----- framing ----- */
// in full screen the plates' room is added at each edge (FS.ins), so a fit centres in the
// clear ground between them; page: true asks for the page's own (the step out of full screen)
function stagePads(page) {
  const phone = isPhone();
  const p = { t: phone ? 12 : 36, b: phone ? 12 : 18, l: phone ? 8 : 12, r: phone ? 44 : 50 };
  if (FS.on && !page) { const q = FS.ins; p.t += q.t; p.r += q.r; p.b += q.b; p.l += q.l; }
  return p;
}
// a box framed in a w x h stage inside its pads
function fitFor(bb, w, h, p, maxK) {
  const [[x0, y0], [x1, y1]] = bb;
  const bw = Math.max(x1 - x0, 0.05), bh = Math.max(y1 - y0, 0.05);
  const k = Math.min((w - p.l - p.r) / bw, (h - p.t - p.b) / bh, maxK || 2400);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return d3.zoomIdentity.translate(p.l + (w - p.l - p.r) / 2 - cx * k, p.t + (h - p.t - p.b) / 2 - cy * k).scale(k);
}
// res: room kept clear at the stage's left (l) or foot (b), for docked island
// boxes, or its top (t), for the way back from an island and its name
function fitTransform(bb, maxK, res) {
  const p = stagePads();
  if (res) { p.l += res.l || 0; p.b += res.b || 0; p.t += res.t || 0; }
  return fitFor(bb, Wpx, Hpx, p, maxK);
}
function unionBB(list) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of list) { if (!b) continue; x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); } return [[x0, y0], [x1, y1]]; }
function homeBox(m) {
  const b = unionBB(m.geo.bb);
  // the state frames' whole-state home view sits 8% further out (user calls 2026-10-26):
  // the districts fill the frame a touch tighter than the federal elections read
  if (STATE_YEARS.has(m.year)) {
    const [[x0, y0], [x1, y1]] = b, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z = 1.08;
    return [[cx + (x0 - cx) * z, cy + (y0 - cy) * z], [cx + (x1 - cx) * z, cy + (y1 - cy) * z]];
  }
  return b;
}
/* ----- zoom easing -----
   A zoom carries on past the gesture and runs down, at the pace the gesture
   left off, so its start can't be seen. A wheel notch eases in over a few
   frames, and the notches of one spin add up into one run.
   Safari (gestureend) and a phone (touchend) report the lift, so they glide on
   it. Chrome and Firefox never do: a pinch there is a stream of ctrl-wheel
   events that simply ends, whether the fingers lifted or only stopped. An
   earlier glide (5d1d1ff3) waited 140ms and fired at a slow average of the
   pace, so it set off after the fingers had stopped, and the map lurched. Here
   the end is read within a few of the stream's own beats, whatever the browser
   and the machine are managing (a busy map's stream can run at 15 a second, and
   a fixed gap reads every event of that as a stream of its own), and it carries
   on at the pace the fingers ended at, read over the stream's last few events
   alone (pinchPace). Fingers coming to rest end at next to nothing, so they
   stop with the map; fingers lifted still moving carry on as they were, slowing
   or not. Any new event takes the zoom back at once. */
const Z_EASE = 0.12,  // s: a wheel notch's ease
  Z_TAU = 0.26,       // s: the release glide's friction (it adds pace × Z_TAU octaves)
  Z_MIN_V = 0.6,      // octaves/s: under this a release has no glide
  Z_MAX_V = 5,        // octaves/s: cap on the release pace (at most 1.3 octaves of glide)
  Z_GAP = 48,         // ms: a pinch stream this quiet has ended, or 2.6 of its beats if it runs slower
  Z_GAP_MAX = 150,    // ms: and never quieter than this
  Z_NOW = 40,         // ms: the end of the stream, whose pace carries on (or 2.5 of its beats)
  Z_BEFORE = 90;      // ms: the stretch before it (or 5 of its beats)
let glide = null;     // {left: octaves still to go, tau, px, py, at, raf}
function glideCancel() {
  if (!glide) return;
  cancelAnimationFrame(glide.raf);
  glide = null;
}
function glideFrame() {
  if (!glide) return;
  const now = performance.now(), dt = Math.min(0.05, (now - glide.at) / 1000);
  glide.at = now;
  let step = glide.left * (1 - Math.exp(-dt / glide.tau));
  if (Math.abs(glide.left - step) < 0.003) step = glide.left;
  const k0 = T.k;
  zoomAt(glide.px, glide.py, Math.pow(2, step));
  glide.left -= step;
  // done: run out, or held by the clamp (the whole-country fit, or all the way
  // in); a frame too soon after the last to step at all is neither
  if (glide.left === 0 || (Math.abs(step) > 1e-6 && T.k === k0)) glide = null;
  else glide.raf = requestAnimationFrame(glideFrame);
}
// ease `oct` octaves of zoom about (px, py), adding to a run of the same kind
function zoomEase(px, py, oct, tau) {
  if (reduceMotion) { glideCancel(); zoomAt(px, py, Math.pow(2, oct)); return; }
  const lk = Math.log2(T.k), left = (glide && glide.tau === tau ? glide.left : 0) + oct;
  // the target stays inside the zoom's bounds, so spinning on past them banks nothing
  const tgt = clamp(lk + left, Math.log2(HOME.k), Math.log2(2600));
  glideCancel();
  if (Math.abs(tgt - lk) < 1e-4) return;
  glide = { left: tgt - lk, tau, px, py, at: performance.now(), raf: requestAnimationFrame(glideFrame) };
}
const zoomRelease = (px, py, v) => { if (S.view === "map" && !reduceMotion && Math.abs(v) >= Z_MIN_V) zoomEase(px, py, Math.sign(v) * Math.min(Math.abs(v), Z_MAX_V) * Z_TAU, Z_TAU); };
// the pace a pinch stream ended at (octaves/s): nothing if it was too short to read or had
// just turned, and fading out only as it falls right away, the last of a stop rather than a lift
function pinchPace(ss, beat) {
  const end = ss[ss.length - 1][0], nowMs = Math.max(Z_NOW, 2.5 * beat), wasMs = Math.max(Z_BEFORE, 5 * beat), pace = (from, to) => {
    let o = 0, t = 0, n = 0;
    for (let i = 1; i < ss.length; i++) { const age = end - ss[i][0]; if (age >= from && age < to) { o += ss[i][1]; t += ss[i][0] - ss[i - 1][0]; n++; } }
    return n >= 2 && t > 0 ? (1000 * o) / t : null;
  };
  const now = pace(0, nowMs), was = pace(nowMs, nowMs + wasMs);
  if (now == null || was == null || now * was <= 0) return 0;
  return now * smooth(0.15, 0.4, Math.abs(now) / Math.abs(was));
}
let pinch = null; // {ss: [[ms, octaves]...], beat: ms between events, px, py, timer}
function pinchStep(px, py, oct, at) {
  if (!pinch) pinch = { ss: [], beat: 0 };
  clearTimeout(pinch.timer);
  const ss = pinch.ss, last = ss.length ? ss[ss.length - 1][0] : null;
  // (a stopped pinch's next start is a new stream, not a slow beat of this one)
  if (last != null && at - last < Z_GAP_MAX) pinch.beat = pinch.beat ? pinch.beat + (at - last - pinch.beat) * 0.3 : at - last;
  ss.push([at, oct]);
  while (ss.length > 2 && at - ss[0][0] > 3 * Z_GAP_MAX) ss.shift();
  Object.assign(pinch, { px, py });
  // the first events have no beat to go by: the stream gets the long wait
  const wait = pinch.beat ? clamp(2.6 * pinch.beat, Z_GAP, Z_GAP_MAX) : Z_GAP_MAX;
  pinch.timer = setTimeout(() => { const p = pinch; pinch = null; if (p) zoomRelease(p.px, p.py, pinchPace(p.ss, p.beat)); }, wait);
}
// the map may pan anywhere inside the frame of the whole-country view, and no
// further out: at that zoom nothing moves, so a scroll there scrolls the page
function setExtent() {
  const m = M(); if (!m || !Wpx) return;
  // outside the map view the transform always rides the whole-country fit:
  // the insets grow the box after the first draw, and a transform pinned to
  // the early smaller box would later open the map on the north-west corner
  // (a zoom easing on the map itself carries on through a resize)
  const rides = S.view !== "map";
  if (rides) glideCancel();
  HOME = fitTransform(homeBox(m));
  // (out at an island, the frame stretches to take it in, some way of sea around it)
  let [[ex0, ey0], [ex1, ey1]] = [[-HOME.x / HOME.k, -HOME.y / HOME.k], [(Wpx - HOME.x) / HOME.k, (Hpx - HOME.y) / HOME.k]];
  const q = islOf(m, away);
  if (q) { const pad = 12; ex0 = Math.min(ex0, q.mbb[0][0] - pad); ey0 = Math.min(ey0, q.mbb[0][1] - pad); ex1 = Math.max(ex1, q.mbb[1][0] + pad); ey1 = Math.max(ey1, q.mbb[1][1] + pad); }
  zoom.translateExtent([[ex0, ey0], [ex1, ey1]])
    .scaleExtent([HOME.k, 2600]).extent([[0, 0], [Wpx, Hpx]]);
  if (rides) { lastFit = HOME; d3.select(canvas).call(zoom.transform, HOME); }
  updateTouch();
}
function selectionBox() {
  const m = M(), g = m.geo;
  if (S.sel.isl && S.sel.level !== "booth") { const q = islOf(m, S.sel.isl); if (q) return q.mbb; }
  switch (S.sel.level) {
    case "aus": return homeBox(m);
    case "state": return unionBB(m.areas[S.sel.st].idx.map((i) => g.bb[i]));
    case "div": return g.bb[S.sel.div];
    case "booth": {
      const b = m.booth, j = S.sel.booth;
      if (Number.isNaN(b.x[j])) return g.bb[S.sel.div];
      const ik = b.isl[j], k0 = fitTransform(ik >= 0 ? m.isl[ik].mbb : g.bb[S.sel.div]).k;
      const k = clamp(k0 * 1.7, 80, 900), half = Math.min(Wpx, Hpx) / k / 2;
      return [[b.x[j] - half, b.y[j] - half], [b.x[j] + half, b.y[j] + half]];
    }
  }
}
// the last view the page framed by itself, to tell it from one the reader has moved
let lastFit = null;
const atLastFit = () => lastFit && Math.abs(T.k / lastFit.k - 1) < 0.01 && Math.hypot(T.x - lastFit.x, T.y - lastFit.y) < 2;
// the page's own flight to a fit, while it lasts: its redo frames it again. A
// first seat chosen from the country view grows the key mid-flight, and the
// stage's resize must take that for the page's view, not one the reader moved
let flight = null;
function fly(t, dur, redo) {
  glideCancel();
  const s = d3.select(canvas), me = { redo, isl: away };
  flight = me;
  s.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t)
    .on("end.flight interrupt.flight", () => { if (flight === me) flight = null; });
}
// a framing of the page's own other than the selection's box - a town chosen in the search,
// a capital's button - which every later re-fit (the key growing under it, a resize, a new
// year) repeats instead of falling back to the selection's box; cleared by the next selection
let reframe = null;
function fitSelection(dur, force) {
  if (!M() || !Wpx || (S.view !== "map" && !force)) return;
  if (reframe && S.view === "map") { reframe(dur); return; }
  const q = selIsland();
  if ((q ? q.key : null) !== away) { away = q ? q.key : null; setExtent(); }
  const n = heldIslands(M()).length;
  let t;
  if (n) { const f = dockedFit(selectionBox(), n); t = f.t; dock = f.side ? { side: f.side, k: t.k } : null; }
  else { t = fitTransform(selectionBox(), 0, q && S.sel.level !== "booth" ? { t: isPhone() ? 64 : 46 } : null); dock = null; }
  lastFit = t;
  const s = d3.select(canvas);
  if (!dur || reduceMotion) { glideCancel(); flight = null; s.interrupt(); s.call(zoom.transform, t); }
  else fly(t, dur, () => fitSelection(Math.min(dur, 320)));
}
/* ----- a town chosen in the search -----
   It selects the seat it stands in; a city across several seats (half and more of
   its area outside the seat at its centre) selects its state instead, as the
   capitals' buttons do. The map then frames the town's ABS boundary, no wider
   than its name's own zoom and no closer than a view TOWN_SPAN km across. */
const TOWN_SPAN = 10;
// where a town lies on this year's map: { div, others } - the seat at its point (or,
// at a coast the simplified seats miss, the seat most of it lies in) and the other
// seats found across its boundary's extent (points within the ellipse the box holds)
function townSeat(m, i) {
  const c = m._townSeat || (m._townSeat = new Map());
  if (c.has(i)) return c.get(i);
  const q = PLACES[i], [w0, s0, e0, n0] = q[5], cnt = new Map();
  let land = 0;
  for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) {
    const u = (a + 0.5) / 9 - 0.5, v = (b + 0.5) / 9 - 0.5;
    if (u * u + v * v > 0.25) continue;
    const p = proj([w0 + (e0 - w0) * (u + 0.5), s0 + (n0 - s0) * (v + 0.5)]), d = p ? divUnder(m, p[0], p[1]) : -1;
    if (d < 0) continue;
    land++; cnt.set(d, (cnt.get(d) || 0) + 1);
  }
  const pt = proj([q[1], q[2]]);
  let div = pt ? divUnder(m, pt[0], pt[1]) : -1;
  if (div < 0 && cnt.size) div = [...cnt].sort((x, y) => y[1] - x[1])[0][0];
  const share = land && div >= 0 ? (cnt.get(div) || 0) / land : 1;
  // the seats holding a good part of it (15% and more of the points), its own first
  const main = [...cnt].filter(([d, n]) => d !== div && n / land >= 0.15).sort((x, y) => y[1] - x[1]).map(([d]) => d);
  const r = { div, share, main: div >= 0 ? [div, ...main] : main, others: [...cnt.keys()].filter((d) => d !== div) };
  c.set(i, r);
  return r;
}
// a city spread across seats: it selects its state, not the seat at its centre
const townSpread = (r) => r.share < 0.5 && r.others.length > 0;
// the search's items for the towns in this year's frame, once the towns are in
function townSearchItems(m) {
  if (!PLACES) return [];
  if (m._townItems) return m._townItems;
  const out = [];
  PLACES.forEach((q, i) => {
    if (!inFrame(m, q[4])) return;
    out.push({ k: "town", ti: i, t: q[0], h: norm(q[0]), rank: 1.5 - Math.log10(q[3]) / 100 });
  });
  return (m._townItems = out);
}
// the line under a town in the search: its state, its people and its seat(s)
function townSub(m, it) {
  const q = PLACES[it.ti], r = townSeat(m, it.ti), all = (r.div >= 0 ? 1 : 0) + r.others.length, nm = (d) => dn(m.divs[d].n);
  // in one seat, in two (its own first), or across many (a count of the seats its extent reached)
  const where = !all ? "" : r.main.length >= 3 || (townSpread(r) && r.main.length < 2) ? `across ${all} seats` : r.main.length === 2 ? `in ${nm(r.main[0])} and ${nm(r.main[1])}` : `in ${nm(r.main[0])}`;
  return [STATE_SHORT[q[4]], `${int(q[3])} people`, where].filter(Boolean).join(" · ");
}
function flyToTown(i, opts = {}) {
  const m = M(), q = PLACES && PLACES[i], tp = townPts();
  if (!m || !q || !tp) return;
  const r = townSeat(m, i), st = q[4] === "ACT" && !m.areas.ACT ? "NSW" : q[4];
  townPick = i;
  loadUrban();
  const sel = r.div >= 0 && !townSpread(r) ? { level: "div", st: m.divs[r.div].st, div: r.div } : m.areas[st] ? { level: "state", st } : { level: "aus" };
  select(sel, { fly: false, keepTown: true, view: opts.view });
  dock = null;
  const go = (dur) => {
    if (!PLACES || !townPts()) return;
    if (!inFrame(M(), q[4])) { reframe = null; fitSelection(dur); return; }
    const [w0, s0, e0, n0] = q[5], pts = [[w0, s0], [w0, n0], [e0, s0], [e0, n0], [q[1], q[2]]].map((ll) => proj(ll));
    let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    let t = fitTransform([[x0, y0], [x1, y1]]);
    // no wider than the zoom its name shows at (a touch inside it), no closer than TOWN_SPAN km across
    const at = townAt(M(), i), kLo = at ? (at * 1.3) / tp.upk : 0, kHi = Math.max(kLo, Math.min(Wpx, Hpx) / (TOWN_SPAN * tp.upk));
    const want = clamp(t.k, kLo, kHi);
    if (Math.abs(want / t.k - 1) > 0.01) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, f = t.k / want;
      t = fitTransform([[cx + (x0 - cx) * f, cy + (y0 - cy) * f], [cx + (x1 - cx) * f, cy + (y1 - cy) * f]]);
    }
    lastFit = t;
    if (!dur || reduceMotion) { flight = null; d3.select(canvas).interrupt(); d3.select(canvas).call(zoom.transform, t); } else fly(t, dur, () => go(320));
  };
  reframe = go;
  go(S.view === "map" ? 900 : 0);
}
function flyToCity(k) {
  const [, st, ll] = CITIES[k];
  // a year whose jurisdiction holds no seats there (sa26: South Australia only,
  // so Adelaide alone flies). A jump is a camera move only — the state is not
  // selected, a lit one lets go, and the jump never marks itself off a selection
  if (!M() || !M().areas[st]) return;
  if (S.sel.level !== "aus") { select({ level: "aus" }, { fly: false }); dock = null; }
  const go = (dur) => {
    // (repeated on a later year: one whose frame has lost the city frames the selection instead)
    if (!M().areas[st]) { reframe = null; fitSelection(dur); return; }
    const a = proj(ll[0]), b = proj(ll[1]);
    const t = fitTransform([[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]);
    lastFit = t;
    if (!dur || reduceMotion) { flight = null; d3.select(canvas).interrupt(); d3.select(canvas).call(zoom.transform, t); } else fly(t, dur, () => go(320));
  };
  reframe = go;
  go(900);
}
// zoomed right out from an island, the reader is home: the selection keeps its
// seat but leaves the island, and the frame shrinks back to the mainland's
function homeFromIsland() {
  if (!away || flight || T.k > HOME.k * 1.02) return;
  const m = M(), s = S.sel;
  away = null;
  if (s.isl) { const { isl, ...rest } = s; select(rest, { fly: false }); }
  else if (s.level === "booth" && m.booth.isl[s.booth] >= 0) select({ level: "div", st: s.st, div: s.div }, { fly: false });
  setExtent();
  lastFit = HOME;
  d3.select(canvas).transition().duration(reduceMotion ? 0 : 300).call(zoom.transform, HOME);
}
function zoomBy(f) { glideCancel(); if (S.view === "map") d3.select(canvas).transition().duration(reduceMotion ? 0 : 280).call(zoom.scaleBy, f); }

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
  // d3 clamps translation for programmatic calls but never the scale: the
  // scale bound is ours to keep, or an eased zoom overshoots the home fit
  const k = clamp(T.k * factor, HOME.k, 2600);
  if (k === T.k) return;
  zoom.scaleTo(d3.select(canvas), k, [px, py]);
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
  // zooming in on an island's box flies out to the island; the flight takes no wheel
  if (flight && flight.isl) { e.preventDefault(); return; }
  if (e.deltaY < 0 && (e.ctrlKey || e.deltaMode !== 0 || wheelMode === "zoom" || (!wheelMode && classifyWheel(e) === "zoom"))) {
    const c = islDrawn.find((q) => px >= q.r.x && px <= q.r.x + q.r.w && py >= q.r.y && py <= q.r.y + q.r.h);
    if (c) { e.preventDefault(); goIsland(c.s.key); return; }
  }
  // a notched wheel announces itself (line deltas, or whole multiples of 120); it
  // overrides a running trackpad gesture, which otherwise keeps its reading so
  // momentum scrolling never flips into zoom
  const notch = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && (e.wheelDeltaY ? e.wheelDeltaY % 120 === 0 : Number.isInteger(e.deltaY)));
  if (e.ctrlKey && !notch) {
    // a trackpad pinch arrives as a ctrl-wheel, its deltaY -100·ln(the
    // fingers' scale): undone exactly, the map under the fingers stays put
    e.preventDefault();
    glideCancel();
    zoomAt(px, py, Math.exp(-e.deltaY / 100));
    pinchStep(px, py, -e.deltaY / (100 * Math.LN2), e.timeStamp);
    return;
  }
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
    if (e.ctrlKey) e.preventDefault(); // ctrl+wheel is the browser's own page zoom
    if (atMin) return; // zoomed right out: scrolling on goes to the page
    e.preventDefault();
    zoomEase(px, py, -e.deltaY * unit * 0.0026, Z_EASE);
  }
}, { passive: false });
// pinch-in from the whole-country fit, where d3's touch sits out so a lone
// finger scrolls the page: two fingers still zoom the map
let homePinch = null;
canvas.addEventListener("touchstart", (e) => {
  if (S.view !== "map" || T.k > HOME.k * 1.001) return;
  if (e.touches.length !== 2) { homePinch = null; return; }
  // from the second finger on, the gesture is the map's: cancel the page
  // actions up front or the first move under touch-action: pan-y can start a
  // scroll the touchmove preventDefault then can't take back
  if (e.cancelable) e.preventDefault();
  glideCancel();
  const p = e.touches[0], q = e.touches[1];
  homePinch = { d: Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY), k: T.k };
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  if (!homePinch || S.view !== "map" || e.touches.length !== 2) return;
  const p = e.touches[0], q = e.touches[1];
  const d = Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY);
  if (!d || !homePinch.d) return;
  if (e.cancelable) e.preventDefault();
  const r = canvas.getBoundingClientRect(), mx = (p.clientX + q.clientX) / 2 - r.left, my = (p.clientY + q.clientY) / 2 - r.top;
  d3.select(canvas).interrupt();
  zoom.scaleTo(d3.select(canvas), homePinch.k * d / homePinch.d, [mx, my]);
}, { passive: false });
canvas.addEventListener("touchend", (e) => { if (e.touches.length < 2) homePinch = null; });
canvas.addEventListener("touchcancel", () => { homePinch = null; });
// a phone's pinch runs on past the lift too, whoever moved the map under it (d3 or the home pinch)
let touchPace = null; // {d, v, at, px, py}
canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length !== 2 || S.view !== "map") { touchPace = null; return; }
  const p = e.touches[0], q = e.touches[1], d = Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY), now = performance.now();
  if (!d) return;
  const r = canvas.getBoundingClientRect(), px = (p.clientX + q.clientX) / 2 - r.left, py = (p.clientY + q.clientY) / 2 - r.top;
  if (!touchPace) { touchPace = { d, v: 0, at: now, px, py }; return; }
  const dt = Math.max((now - touchPace.at) / 1000, 1 / 240);
  touchPace.v += (Math.log2(d / touchPace.d) / dt - touchPace.v) * (1 - Math.exp(-dt / 0.05));
  touchPace.beat = touchPace.beat ? touchPace.beat + (dt * 1000 - touchPace.beat) * 0.3 : dt * 1000;
  Object.assign(touchPace, { d, at: now, px, py });
}, { passive: true });
canvas.addEventListener("touchend", (e) => {
  const g = touchPace; if (!g || e.touches.length >= 2) return;
  touchPace = null;
  // (faded by any hold before the lift, a long one by this stream's own beat: fingers held still and then lifted glide nowhere)
  zoomRelease(g.px, g.py, g.v * Math.exp(-(performance.now() - g.at) / Math.max(50, 1.5 * (g.beat || 0))));
});
canvas.addEventListener("touchcancel", () => { touchPace = null; });
// a swipe anywhere in the map figure — the canvas, its overlays, the
// timeline, the story — cycles the years: on the chamber always, on the map
// at the whole-country fit (a zoomed-in map pans instead). Native controls
// keep their own gestures (zoom and city buttons, form fields, links), and
// the list view's own rows
swipeWatch($(".mp-fig"), (dir, y) => { if (S.view === "chamber" || (S.view === "map" && T.k <= HOME.k * 1.001)) { walkAim(y); walkYear(dir, true); } }, (t) => !t.closest("button, a, input, select, textarea, .mp-list, .cls-vote-scroll"));
// Safari's own pinch events. On a Mac they are the trackpad's pinch; iOS sends
// them alongside the touches, which d3 (or the home pinch) already follows,
// so while fingers are down they are left alone
let touchesOn = 0, gesture = null; // {k at the start, s, pace in octaves/s, at, px, py}
for (const t of ["touchstart", "touchend", "touchcancel"]) canvas.addEventListener(t, (e) => { touchesOn = e.touches.length; }, { passive: true });
canvas.addEventListener("gesturestart", (e) => {
  e.preventDefault();
  if (touchesOn || S.view !== "map") { gesture = null; return; }
  glideCancel();
  gesture = { k: T.k, s: 1, v: 0, at: performance.now(), px: 0, py: 0 };
});
canvas.addEventListener("gesturechange", (e) => {
  e.preventDefault(); if (!gesture || S.view !== "map") return;
  const r = canvas.getBoundingClientRect(), now = performance.now();
  const dt = Math.max((now - gesture.at) / 1000, 1 / 240);
  // the pace, smoothed over the last ~50ms of the gesture
  gesture.v += (Math.log2(e.scale / gesture.s) / dt - gesture.v) * (1 - Math.exp(-dt / 0.05));
  Object.assign(gesture, { s: e.scale, at: now, px: e.clientX - r.left, py: e.clientY - r.top });
  zoomAt(gesture.px, gesture.py, clamp(gesture.k * e.scale, HOME.k, 2600) / T.k);
});
canvas.addEventListener("gestureend", (e) => {
  e.preventDefault();
  const g = gesture; gesture = null;
  if (!g) return;
  // the pace at the lift, faded by any hold before it: fingers held still and
  // then lifted glide nowhere
  zoomRelease(g.px, g.py, g.v * Math.exp(-(performance.now() - g.at) / 50));
});

/* ----- hit testing ----- */
function hitTest(px, py) {
  const m = M(); if (!m) return null;
  if (S.view === "chamber") { const c = CM(); return c ? chamberHit(c, px, py) : null; }
  if (S.view !== "map") return null;
  // an island's box is on top of the map: its places, else its seat (an island in no seat is nobody's)
  for (let k = islDrawn.length - 1; k >= 0; k--) {
    const c = islDrawn[k], r = c.r;
    if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) continue;
    let cj = null, cd = Infinity;
    for (const d of c.dots) { const dd = Math.hypot(px - d.x, py - d.y); if (dd <= Math.max(d.r + 3, 8) && dd < cd) { cd = dd; cj = d.j; } }
    if (cj != null) return { kind: "booth", i: cj };
    return c.s.owner != null ? { kind: "div", i: c.s.owner, isl: c.s.name, go: c.s.key } : { kind: "isl", go: c.s.key, isl: c.s.name };
  }
  if (drawOf(m) === "balloons") { const q = balloonHit(m, px, py); if (q) return q; }
  const b = m.booth; let bj = null, bd = Infinity;
  for (const j of m._vis || []) {
    if (T.k < K_ALL && b.d[j] !== selDiv()) continue; // still coming up
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, dd = Math.hypot(px - x, py - y);
    if (dd <= Math.max(rad(boothSizeVotes(b, j)) + 3, 8) && dd < bd) { bd = dd; bj = j; }
  }
  if (bj != null) return { kind: "booth", i: bj };
  const g = geoOf(m), bx = (px - T.x) / T.k, by = (py - T.y) / T.k;
  for (const q of m.isl || []) {
    const r = q.mbb; if (q.owner == null || bx < r[0][0] || bx > r[1][0] || by < r[0][1] || by > r[1][1]) continue;
    if (hitCtx.isPointInPath(q.mpath, bx, by)) return { kind: "div", i: q.owner, isl: q.name };
  }
  for (let i = 0; i < m.divs.length; i++) {
    const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue;
    if (hitCtx.isPointInPath(g.paths[i], bx, by)) return { kind: "div", i };
  }
  return null;
}

/* =============================== how the map is drawn ===============================
   A lens says what each place reads; the drawing says how that reaches the page.
     Seats     every seat filled with its own figure (the map as it has always been)
     Balloons  a circle at every polling place, its area the votes behind the reading
               (a lead for a lead, a party's votes for a party's share), so a big safe
               booth outweighs a marginal one and an empty seat holds no ink
     Surface   the polling places' figures blended into one continuous field, in steps,
               with a line where the two sides meet. No seat's boundary shapes it

   Both read the lens through boothValue, so every lens's own colours, keys and tooltips
   carry over. They apply to the map view alone: the chamber and the list keep their seats.

   The surface's field is an estimate at every point and says so in its key. It comes from
   the polling places' votes on a pyramid of grids (surfaceEngine): each level, coarser
   than the last, holds the votes and the vote-weighted figure within a cell or so of each
   node; walking back down, a node keeps its own level's figure where enough votes stand
   behind it and otherwise takes the level above's, smoothly (cubic B-spline subdivision).
   So a suburb reads its own booths while the Simpson Desert reads the nearest towns a
   long way off, and the whole costs a pass over the grid, not over booths times pixels.
   There is one field for a reading, set in kilometres: the zoom never enters into it, so
   zooming magnifies a place and can't change what it reads. (It used to be smoothed by the
   screen, seven pixels' worth, and a spot read differently at every zoom and even, by the
   way a raster was reused, at the same zoom by the way the reader came to it.)

   Colour is decided a cell at a time: a cell whose corners share a step is filled flat,
   and only the few cells a step's edge crosses are worked out pixel by pixel, antialiased,
   which is what keeps a screen of this cheap enough to redo as the reader zooms.
   The raster comes back through a worker and is laid on as a canvas pattern through the
   seats' own fill paths (drawGeo), so the coast, the sea cut, the islands, the filters and
   the veil over an opened seat all work on it as they do on a flat fill. */

const DRAWS = [["seats", "Seats"], ["balloons", "Balloons"], ["surface", "Surface"], ["areas", "Areas"], ["chart", "Chart"]];
// a seat type belongs to the whole seat, and so does its exhausted share: nothing to blend
const surfaceFits = (m) => !(S.lens === "cls" || (S.lens === "informal" && infModeOf(m) === "exhaust"));
// Areas is the Census lens's own drawing: it needs a census pack for the frame's vintage
// and a lane the pack serves (the homeless lane is an SA2 estimate, never an SA1 count)
const areasFits = (m) => {
  if (S.lens !== "seifa" || !m) return false;
  if (AREAS_FILES[areasVintage(m)] == null) return false;
  const lane = areasLane();
  if (!lane || !AREAS_LANES.has(lane)) return false;
  if ((lane === "loinc" || lane === "hiqinc") && !(m.incomeCuts && m.incomeCuts.loCutWeekly > 0 && m.incomeCuts.hiQCutWeekly > 0)) return false;
  return true;
};
// the drawing in force on an election (the chamber and the list keep their seats)
// (Chart lays its own plot over the stage: the map beneath keeps its seats)
const drawOf = (m) => (S.view !== "map" || !m || m.house === "senate" || S.draw === "chart" ? "seats" : (S.draw === "surface" && !surfaceFits(m)) || (S.draw === "areas" && !areasFits(m)) ? "seats" : S.draw);

/* ----- the contest -----
   Labor v the Coalition is counted at every polling place. Labor v One Nation and the
   Coalition v One Nation are not, except where a seat's own final two happened to be that
   pair, so everywhere else they are built: the place's House first preferences, with each
   other group's votes shared as that group's voters ranked the two on the Senate ballot.
   Federal frames read those orders polling place by polling place, drawn towards the
   seat's (AXIS_K ballots' worth); state frames, which have no Senate of their own, read
   the state's Senate ballots from the nearest federal election. An election offers the
   contests only where One Nation stood in at least three seats in four, since a place with
   no One Nation candidate would be an estimate of an absent party, and where those orders
   exist: 1998 and 2001 clear the first bar but have no Senate ballots to read, and their
   Senates ran on group tickets. South Australia 2026's Labor v One Nation uses the
   estimates of that election's own splits instead, being the nearer evidence. */
const AXIS_FRAMES = { 2022: 2022, 2025: 2025, now: 2025, qld20: 2019, qld24: 2025, qldnow: 2025, sa26: 2025 };
const AXIS_K = 30;
// the contest's parties as the frame names them: the Coalition, or the Liberals, or the LNP
const axisName = (f, cap) => (f === "alp" ? "Labor" : f === "onp" ? "One Nation" : f === "grn" ? (cap ? "The Greens" : "the Greens") : coalW(cap ? 1 : 0));
// the three Greens pairings are built from the ballot files' own counts, which only the federal
// frames' stores carry; the constant-rate frames have no Greens series to stand on
const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];
const AXIS_GREEN_SET = new Set(AXIS_GREEN_PAIRS.map(([p]) => p));
const axisOpts = (m) => [["AC", `Labor v ${coalW(0)}`], ["AO", "Labor v One Nation"], ["CO", `${coalW(1).replace(/^The /, "")} v One Nation`], ...(m && STATE_YEARS.has(m.year) ? [] : AXIS_GREEN_PAIRS)];
const axisOffers = (m, pair) => SP_PAIRS[pair] != null && (!AXIS_GREEN_SET.has(pair) || !STATE_YEARS.has(m.year));
// the state frames' shares reaching the pair's first-named party (flows.mjs FLOW_HISTORY_SENATE_ON,
// _CON, pinned in test-map-page): Queensland's Senate ballots of 2019 and 2025, South Australia's of
// 2025, and for South Australia 2026's Labor v One Nation Kevin Bonham's estimates of that election's own splits
const AXIS_RATES = {
  qld20: { AO: { lnp: 35.7, grn: 93.5, oth: 37.6 }, CO: { alp: 63.6, grn: 84.0, oth: 46.1 } },
  qld24: { AO: { lnp: 22.8, grn: 94.6, oth: 41.0 }, CO: { alp: 70.7, grn: 77.9, oth: 39.1 } },
  qldnow: { AO: { lnp: 22.8, grn: 94.6, oth: 41.0 }, CO: { alp: 70.7, grn: 77.9, oth: 39.1 } },
  sa26: { AO: { lnp: 33.9, grn: 84.8, oth: 55.9 }, CO: { alp: 79.9, grn: 84.5, oth: 53.7 } },
};
// the site's own table for Labor v One Nation (flows.mjs FP_ON, pinned in test-map-page): the 2025 frames'
// Senate orders keep their pattern from place to place, and are levelled to it as a whole, as /model/ levels its own
const AXIS_LEVEL = { lnp: 27, grn: 91, oth: 55 };
const axisFrame = (m) => (m ? AXIS_FRAMES[m.year] ?? null : null);
// the contest in force: only the Two-party lens's share, only as balloons or a surface
function axisNow(m) {
  if (S.axis === "AC" || S.lens !== "tpp" || S.tppMode === "swing" || S.view !== "map" || S.draw === "seats") return "AC";
  if (axisFrame(m) == null) return "AC";
  return axisOffers(m, S.axis) ? S.axis : "AC";
}
const axisNames = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f));
const axisCap = (pair = S.axis) => SP_PAIRS[pair].map((f) => axisName(f, true));
// how far from even the contest's colours run: to where its places actually spread (the One Nation
// pairings' spreads run longest — the Greens' sweep of them out of town is their mirror)
const axisSpan = (pair = S.axis) => (pair === "CO" || pair === "GO" ? 40 : 30);
const axisRamp = (pair = S.axis) => (pair === "AO" ? RAMP.divOn : pair === "CO" ? RAMP.divCo : pair === "GO" ? RAMP.divGo : pair === "GA" ? RAMP.divGa : pair === "GC" ? RAMP.divGc : RAMP.div);
const logit = (p) => Math.log(p / (1 - p)), expit = (x) => 1 / (1 + Math.exp(-x));
// the shift that carries a group's local rates, votes-weighted, to a whole's level
function levelShift(r, wt, target) {
  let lo = -2.5, hi = 2.5;
  for (let k = 0; k < 26; k++) {
    const d = (lo + hi) / 2; let s = 0, t = 0;
    for (let j = 0; j < r.length; j++) { if (!(wt[j] > 0) || Number.isNaN(r[j])) continue; s += wt[j] * expit(logit(r[j]) + d); t += wt[j]; }
    if (t === 0) return 0;
    if (s / t < target) lo = d; else hi = d;
  }
  return (lo + hi) / 2;
}
// each polling place's share for the pair's first-named party (m._axis[pair]), with what it stands on
function axisOf(m, pair = axisNow(m)) {
  if (pair === "AC") return null;
  const cache = m._axis || (m._axis = {});
  if (cache[pair]) return cache[pair];
  const src = axisFrame(m), fed = !STATE_YEARS.has(m.year), s = fed ? SPD[src] : null;
  if (src == null || (fed && !s)) return null;
  const b = m.booth, n = b.n, [fa, fb] = SP_PAIRS[pair], donors = SP_DONORS[pair];
  const out = { v: new Float32Array(n).fill(NaN), a: new Float32Array(n), t: new Float32Array(n), counted: 0, est: 0, seatSkip: new Uint8Array(m.divs.length) };
  // a seat missing either party, or a by-election's, has nothing to split
  for (const d of m.divs) if (d.by || !(d.fp[fa] > 0) || !(d.fp[fb] > 0)) out.seatSkip[d.i] = 1;
  // each group's rate at each place, at its slot in the file's pair order (SP_PAIRS)
  const k0 = (() => { let k = 0; for (const p of Object.keys(SP_PAIRS)) { if (p === pair) return k; k += SP_DONORS[p].length; } return 0; })();
  const rates = donors.map((f, q) => {
    const r = new Float32Array(n).fill(NaN);
    if (!fed) { r.fill(AXIS_RATES[m.year][pair][f] / 100); return r; }
    const slot = 3 * (k0 + q);
    for (let j = 0; j < n; j++) {
      const D = m.divs[b.d[j]], seat = s.divs[D.n]; if (!seat) continue;
      const sx = seat[slot], sy = seat[slot + 1], rs = sx + sy ? sx / (sx + sy) : 0.5;
      const cell = s.booths[b.id[j]], x = cell ? cell[slot] : 0, y = cell ? cell[slot + 1] : 0;
      r[j] = clamp((x + AXIS_K * rs) / (x + y + AXIS_K), 0.005, 0.995);
    }
    return r;
  });
  if (fed && src === 2025 && pair === "AO") donors.forEach((f, q) => {
    const wt = new Float32Array(n); for (let j = 0; j < n; j++) { if (out.seatSkip[b.d[j]]) continue; wt[j] = groupVotes(b, f, j); }
    const d = levelShift(rates[q], wt, AXIS_LEVEL[f] / 100), r = rates[q];
    for (let j = 0; j < n; j++) if (!Number.isNaN(r[j])) r[j] = expit(logit(r[j]) + d);
  });
  for (let j = 0; j < n; j++) {
    const D = m.divs[b.d[j]]; if (out.seatSkip[D.i]) continue;
    const formal = b.formal[j]; if (!formal) continue;
    const tc = b.raw.tcp[j], fs = [D.A.b, D.B.b];
    // this seat's final two were this pair: its count, not an estimate
    if (tc && tc[0] + tc[1] && fs.includes(fa) && fs.includes(fb) && fa !== fb) {
      const A = fs[0] === fa ? tc[0] : tc[1]; out.a[j] = A; out.t[j] = tc[0] + tc[1]; out.v[j] = (100 * A) / out.t[j]; out.counted += out.t[j]; continue;
    }
    let A = (b.fp[fa][j] / 100) * formal, ok = !Number.isNaN(A);
    donors.forEach((f, q) => { const r = rates[q][j]; if (Number.isNaN(r)) { ok = false; return; } A += r * groupVotes(b, f, j); });
    if (!ok) continue;
    out.a[j] = A; out.t[j] = formal; out.v[j] = (100 * A) / formal; out.est += formal;
  }
  return (cache[pair] = out);
}
// a group's first preferences at a place: "others" is independents and everyone else, as the Senate's cohort is
const groupVotes = (b, f, j) => { const x = (f === "oth" ? (b.fp.ind[j] || 0) + (b.fp.oth[j] || 0) : b.fp[f][j]) * b.formal[j] / 100; return Number.isFinite(x) ? x : 0; };
const axisBooth = (m, j) => { const A = axisOf(m); if (!A) return nn(m.booth.tpp[j]); const v = A.v[j]; return Number.isNaN(v) ? null : v; };
function axisArea(m, idx) {
  const A = axisOf(m); if (!A) return null;
  const b = m.booth; let a = 0, t = 0;
  for (const i of idx) for (const j of b.byDiv[i]) { if (Number.isNaN(A.v[j])) continue; a += A.a[j]; t += A.t[j]; }
  return t ? (100 * a) / t : null;
}
const axisSeat = (m, i) => { const A = axisOf(m); return !A ? nn(m.divs[i].tpp) : A.seatSkip[i] ? null : axisArea(m, [i]); };

/* ----- places with no figure of their own -----
   The AEC's polling places carry a two-party count from 1996 on, and the state commissions'
   carry none; 1993 and several state elections have no final count by polling place either.
   First preferences are there for every election, so those frames' places are estimated:
   each place's share of its seat's final two, or its two-party share at the table's flows,
   moved together until the seat's places come to the seat's own count (levelShift, a seat at
   a time). The seat's total stays true and the spread inside it is the place's real vote.
   Any other reading with no figure at the places lets each carry its seat's. */
function estBooths(m) {
  if (m._est) return m._est;
  const b = m.booth, n = b.n, a = new Float32Array(n).fill(NaN), t = new Float32Array(n).fill(NaN);
  for (const D of m.divs) {
    const list = b.byDiv[D.i]; if (!list.length) continue;
    const sa = new Float32Array(list.length), st = new Float32Array(list.length), wt = new Float32Array(list.length);
    list.forEach((j, q) => {
      const v = b.raw.v[j] || [], f = b.formal[j], va = v[D.A.k] || 0, vb = v[D.B.k] || 0;
      wt[q] = f;
      sa[q] = clamp((va + 0.5) / (va + vb + 1), 0.01, 0.99);
      st[q] = f ? clamp((groupVotes(b, "alp", j) + 0.88 * groupVotes(b, "grn", j) + 0.26 * groupVotes(b, "onp", j) + 0.55 * groupVotes(b, "oth", j)) / f, 0.01, 0.99) : 0.5;
    });
    const da = levelShift(sa, wt, clamp(D.va / (D.va + D.vb), 0.01, 0.99)), dt = D.tpp != null ? levelShift(st, wt, clamp(D.tpp / 100, 0.01, 0.99)) : 0;
    list.forEach((j, q) => { if (!wt[q]) return; a[j] = expit(logit(sa[q]) + da); t[j] = 100 * expit(logit(st[q]) + dt); });
  }
  return (m._est = { a, t });
}
// does this election lack the reading at its polling places? (A few new places missing a swing isn't that)
function placesLack(m) {
  const b = m.booth; let have = 0;
  if (S.lens === "winner") { for (let j = 0; j < b.n; j++) if (b.raw.tcp[j] && b.raw.tcp[j][0] + b.raw.tcp[j][1]) have++; }
  else for (let j = 0; j < b.n; j++) { const v = boothValue(m, j); if (v != null && !Number.isNaN(v)) have++; }
  return have < 0.1 * b.n;
}
const placesLackMemo = (m) => { const k = readingKey(m); if (m._lack && m._lack.k === k) return m._lack.v; const v = placesLack(m); m._lack = { k, v }; return v; };
// a place's figure as the balloons and the surface read it
function drawValue(m, j) {
  const v = boothValue(m, j);
  if (v != null && !Number.isNaN(v)) return v;
  if (!placesLackMemo(m)) return null;
  const D = m.divs[m.booth.d[j]];
  if (S.lens === "winner") { const a = estBooths(m).a[j]; return Number.isNaN(a) ? null : (a >= 0.5 ? D.A : D.B).fam; }
  if (S.lens === "tpp" && S.tppMode !== "swing") { const t = estBooths(m).t[j]; return Number.isNaN(t) ? null : t; }
  return divValue(m, D.i);
}
// the final two's votes at a place, counted or estimated
function finalVotes(m, j) {
  const b = m.booth, t = b.raw.tcp[j];
  if (t && t[0] + t[1]) return t;
  if (!placesLackMemo(m)) return null;
  const a = estBooths(m).a[j]; return Number.isNaN(a) ? null : [a * b.formal[j], (1 - a) * b.formal[j]];
}

/* ----- the steps -----
   The surface's bands of each reading, in the reading's own units. Where a reading has two
   sides the steps are narrowest at the meeting of the two, and that meeting is the line. */
const mirrored = (mid, steps) => [...steps.slice().reverse().map((d) => mid - d), mid, ...steps.map((d) => mid + d)];
const evenly = (lo, hi, n) => Array.from({ length: n - 1 }, (_, k) => lo + ((hi - lo) * (k + 1)) / n);
function surfaceScale(m) {
  const wide = axisNow(m) !== "AC";
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? { lo: -40, hi: 40, edges: mirrored(0, [1, 2.5, 5, 7.5, 10, 15]), line: 0 }
      : { lo: 0, hi: 100, edges: mirrored(50, wide ? [2.5, 5, 10, 15, 20, 30, 40] : [2.5, 5, 7.5, 10, 15, 20]), line: 50 };
    case "fp": if (S.fpMode === "change") return { lo: -60, hi: 60, edges: mirrored(0, [1, 2, 4, 6, 9, 12, 15]), line: 0 };
      return shareScale(FPMAX[S.party]);
    case "senate": if (senGap()) return { lo: -60, hi: 60, edges: mirrored(0, [1, 2, 4, 6, 8, 10]), line: 0 };
      return shareScale(FPMAX[S.party]);
    case "flow": case "senpref": return { lo: 0, hi: 100, edges: mirrored(50, [5, 10, 15, 20, 30, 40]), line: 50 };
    case "informal": return { lo: 0, hi: 30, edges: evenly(0, infHi(m), 10), line: null };
    case "seifa": {
      if (!isDemo()) return { lo: 1, hi: 10, edges: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5], line: null };
      const [lo, hi] = demoRange(), w = hi - lo; return { lo: lo - w, hi: hi + w, edges: evenly(lo, hi, 10), line: null };
    }
  }
  return null;
}
function shareScale(top) { const step = top >= 50 ? 5 : 2.5; const e = []; for (let v = step; v < top; v += step) e.push(v); return { lo: 0, hi: 100, edges: e, line: null }; }
const bandMid = (S0, k) => { const e = S0.edges, n = e.length; return k === 0 ? e[0] - (n > 1 ? (e[1] - e[0]) / 2 : 1) : k === n ? e[n - 1] + (e[n - 1] - e[n - 2]) / 2 : (e[k - 1] + e[k]) / 2; };
// the lead's steps on the Winner lens, in points between the first and second
const LEAD_STEPS = [5, 10, 20, 30, 40, 60];
const LEAD_RAMP_AT = [0.2, 0.31, 0.42, 0.52, 0.61, 0.7, 0.8];
const rgba32 = (c) => ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
const readingKey = (m) => [m.year, S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.incMode, S.ageMode, S.eduMode, S.party, S.from, S.vs, S.spPair, S.spFrom, S.index, S.cob, S.rel, S.ten, S.anc, axisNow(m), m.ppl ? 1 : 0, TH.dark].join("|");
// the votes a place counts for in a blend: a group's own where the reading is that group's
function surfaceWeight(m, j) {
  const b = m.booth;
  if (S.lens === "flow") return groupVotes(b, S.from, j);
  if (S.lens === "senpref") { const s = spOf(m), c = s && spCells(s.booths[b.id[j]]); return c ? c.x + c.y : 0; }
  return b.formal[j];
}
/* places with no spot on the map: the remote and mobile teams above all (Lingiari's 35 in 2025
   took 13,984 votes, 81.5% Labor, in communities right across the seat), and most of a
   frame's places before the AEC's coordinates begin. We know the seat, not the spot: so a
   seat's unplaced votes are shared evenly over its land, which is where they were cast, or
   the surface would read the seat from its towns alone. */
const SPOT_MIN = 0.02;   // of a seat's placed votes: under this its unplaced votes change nothing
function seatSpots(m, i) {
  const c = m._spots || (m._spots = []);
  if (c[i]) return c[i];
  const g = m.geo, bb = g.bb[i], out = [];
  if (bb) {
    const w = bb[1][0] - bb[0][0], h = bb[1][1] - bb[0][1], step = Math.max(w, h) / 6;
    for (let y = bb[0][1] + step / 2; y < bb[1][1]; y += step) for (let x = bb[0][0] + step / 2; x < bb[1][0]; x += step) if (hitCtx.isPointInPath(g.paths[i], x, y)) out.push([x, y]);
    if (!out.length) out.push([(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2]);
  }
  return (c[i] = out);
}
// a balloon's spot in its seat: scattered, so nothing reads as a place the way a regular grid of dots would
function nominalSpot(m, i, [x, y], k) {
  const bb = m.geo.bb[i], step = Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) / 6;
  const a = ((k + 1) * 0.6180339887) % 1, c = ((k + 1) * 0.7548776662) % 1, jx = x + (a - 0.5) * step * 0.9, jy = y + (c - 0.5) * step * 0.9;
  return hitCtx.isPointInPath(m.geo.paths[i], jx, jy) ? [jx, jy] : [x, y];
}
// a frame's map units to the kilometre, at the middle of its map (each frame's plane has its own scale)
function unitsPerKm(m) {
  const [[x0, y0], [x1, y1]] = homeBox(m), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = m.proj.invert([cx, cy]), b = m.proj.invert([cx + 10, cy]);
  const R = Math.PI / 180, dLat = (b[1] - a[1]) * R, dLon = (b[0] - a[0]) * R * Math.cos(a[1] * R);
  return 10 / (6371 * Math.hypot(dLat, dLon));
}
// polling places, in the pyramid's terms
function surfaceData(m) {
  const b = m.booth, fam = S.lens === "winner", n = b.n;
  const idx = [], vals = [], seatN = new Int32Array(m.divs.length), placed = new Float64Array(m.divs.length), loose = new Map();
  const fams = FAMS.slice(), famAt = Object.fromEntries(fams.map((f, k) => [f, k]));
  const A = fam ? null : axisOf(m);
  for (let j = 0; j < n; j++) {
    const w = surfaceWeight(m, j); if (!(w > 0)) continue;
    let val;
    if (fam) {
      const tc = finalVotes(m, j), D = m.divs[b.d[j]]; if (!tc || !(tc[0] + tc[1])) continue;
      val = tc[0] / (tc[0] + tc[1]);
      if (!Number.isNaN(b.x[j])) vals.push([famAt[D.A.b], famAt[D.B.b], val]);
    } else {
      val = drawValue(m, j); if (val == null || Number.isNaN(val)) continue;
      if (!Number.isNaN(b.x[j])) vals.push(val);
    }
    if (Number.isNaN(b.x[j])) { const i = b.d[j], q = loose.get(i) || { w: 0, s: 0 }; q.w += w; q.s += val * w; loose.set(i, q); continue; }
    idx.push(j); seatN[b.d[j]]++; placed[b.d[j]] += w;
  }
  if (idx.length < 12) return null;
  const extra = [];
  for (const [i, q] of loose) {
    if (q.w < SPOT_MIN * placed[i]) continue;
    const spots = seatSpots(m, i), v = q.s / q.w, D = m.divs[i];
    for (const [sx, sy] of spots) extra.push([sx, sy, q.w / spots.length, fam ? [famAt[D.A.b], famAt[D.B.b], v] : v]);
    seatN[i]++;
  }
  const c = idx.length + extra.length, x = new Float32Array(c), y = new Float32Array(c), w = new Float32Array(c), late = new Float32Array(c);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const u = unitsPerKm(m), lateAt = SURF_LATE * u;
  idx.forEach((j, k) => {
    x[k] = b.x[j]; y[k] = b.y[j]; w[k] = surfaceWeight(m, j);
    // an early voting centre takes its votes from across a district, so it joins from the coarser levels only
    late[k] = b.ty[j] === 5 ? lateAt : 0;
    bx0 = Math.min(bx0, x[k]); bx1 = Math.max(bx1, x[k]); by0 = Math.min(by0, y[k]); by1 = Math.max(by1, y[k]);
  });
  extra.forEach(([sx, sy, sw, sv], e) => { const k = idx.length + e; x[k] = sx; y[k] = sy; w[k] = sw; late[k] = lateAt; vals.push(sv); });
  const none = m.divs.map((d) => seatN[d.i] === 0);
  const th = TH, D = { n: c, x, y, w, late, bx0, by0, bx1, by1, u, M0: SURF_M0, ink: rgba32(th.ink) };
  if (fam) {
    // only the groups that lead somewhere, or finish in anyone's two, get a channel of their own
    const used = fams.filter((f, k) => vals.some((q) => q[0] === k || q[1] === k));
    const remap = fams.map((f) => used.indexOf(f));
    D.ch = used.map(() => new Float32Array(c));
    vals.forEach((q, k) => { D.ch[remap[q[0]]][k] += q[2]; D.ch[remap[q[1]]][k] += 1 - q[2]; });
    const nb = LEAD_STEPS.length + 1;
    D.fam = true; D.nb = nb; D.lo = 0; D.hi = 100;
    D.band = new Uint8Array(4096).map((_, k) => { const v = (100 * k) / 4095; let q = 0; while (q < LEAD_STEPS.length && v >= LEAD_STEPS[q]) q++; return q; });
    D.col = new Uint32Array(used.length * nb);
    used.forEach((f, u) => { for (let q = 0; q < nb; q++) D.col[u * nb + q] = rgba32(RAMP.gain[f][Math.round(LEAD_RAMP_AT[q] * 100)]); });
    D.line = 1; D.ids = used;
  } else {
    D.ch = [Float32Array.from(vals)];
    const sc = surfaceScale(m), e = sc.edges;
    D.fam = false; D.lo = sc.lo; D.hi = sc.hi; D.line = sc.line;
    D.band = new Uint8Array(4096).map((_, k) => { const v = sc.lo + ((sc.hi - sc.lo) * k) / 4095; let q = 0; while (q < e.length && v >= e[q]) q++; return q; });
    D.col = Uint32Array.from({ length: e.length + 1 }, (_, k) => { const c1 = colorOf(bandMid(sc, k)); return rgba32(c1 || th.nodata); });
  }
  return { D, none };
}
const SURF_M0 = 6000;     // votes: under this a level's figure gives way to the level above
const SURF_LATE = 7;      // km: the cell at which an early voting centre joins

/* the surface: one field for a reading, made once, and pictures of it. Self-contained: a worker runs
   this very text. D is a reading's places; the field is a function of the spot alone, so a view, a zoom
   and a screen only choose where to look at it (what the map is for: zooming in magnifies a place, it
   doesn't ask a different question of it).
   A lattice in kilometres, never in pixels. The whole frame comes first (build), every 8km (C0, D.u being
   map units a kilometre), filled from a pyramid above it. Finer levels, to 1km, are only worth having where
   votes stand behind them, so they live in tiles made as a view first needs them (tile): a level's figure
   counts where its votes reach M0 and otherwise gives way to the level above, smoothly (cubic B-spline
   subdivision). Sampling is a cubic B-spline too, so the field is smooth at any magnification. A view too
   wide to show a tile's finest lattice reads its mip, the average of the field over that coarser cell, and
   one as wide as the frame's own 8km reads the frame: the whole country needs no tiles at all, so a
   reading's first picture is quick, and the tiles a closer view asks for are made once and kept. */
function surfaceEngine() {
  const CELL = 3, PAD = 3, KA = 7, TN = 128, MG = 20, FINE = 3, built = new WeakMap(), wx = new Float64Array(4), wy = new Float64Array(4);
  // [1 4 6 4 1]/16 each way, on a whole grid
  const blur = (a, nx, ny) => {
    const t = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) { const o = j * nx; for (let i = 0; i < nx; i++) {
      const i1 = i > 0 ? i - 1 : 0, i2 = i > 1 ? i - 2 : 0, i3 = i < nx - 1 ? i + 1 : i, i4 = i < nx - 2 ? i + 2 : nx - 1;
      t[o + i] = (a[o + i2] + 4 * a[o + i1] + 6 * a[o + i] + 4 * a[o + i3] + a[o + i4]) / 16;
    } }
    for (let j = 0; j < ny; j++) {
      const j1 = (j > 0 ? j - 1 : 0) * nx, j2 = (j > 1 ? j - 2 : 0) * nx, j3 = (j < ny - 1 ? j + 1 : j) * nx, j4 = (j < ny - 2 ? j + 2 : ny - 1) * nx, o = j * nx;
      for (let i = 0; i < nx; i++) a[o + i] = (t[j2 + i] + 4 * t[j1 + i] + 6 * t[o + i] + 4 * t[j3 + i] + t[j4 + i]) / 16;
    }
  };
  // a coarse level's nodes fall on every second node of the one below it: the cubic B-spline's rule
  const subdivide = (a, Co, Fi) => {
    const ox = Fi.ix - 2 * Co.ix, oy = Fi.iy - 2 * Co.iy, cnx = Co.nx, cny = Co.ny;
    const tmp = new Float32Array(Fi.nx * cny), out = new Float32Array(Fi.nx * Fi.ny);
    for (let j = 0; j < cny; j++) { const o = j * cnx, t = j * Fi.nx;
      for (let i = 0; i < Fi.nx; i++) {
        const u = i + ox, h = u >> 1, i0 = h < 0 ? 0 : h >= cnx ? cnx - 1 : h, i1 = i0 + 1 < cnx ? i0 + 1 : i0, im = i0 > 0 ? i0 - 1 : 0;
        tmp[t + i] = u & 1 ? (a[o + i0] + a[o + i1]) / 2 : (a[o + im] + 6 * a[o + i0] + a[o + i1]) / 8;
      }
    }
    for (let j = 0; j < Fi.ny; j++) {
      const u = j + oy, h = u >> 1, j0 = h < 0 ? 0 : h >= cny ? cny - 1 : h, j1 = j0 + 1 < cny ? j0 + 1 : j0, jm = j0 > 0 ? j0 - 1 : 0, o = j * Fi.nx;
      const r0 = j0 * Fi.nx, r1 = j1 * Fi.nx, rm = jm * Fi.nx;
      if (u & 1) for (let i = 0; i < Fi.nx; i++) out[o + i] = (tmp[r0 + i] + tmp[r1 + i]) / 2;
      else for (let i = 0; i < Fi.nx; i++) out[o + i] = (tmp[rm + i] + 6 * tmp[r0 + i] + tmp[r1 + i]) / 8;
    }
    return out;
  };
  // a level's votes and vote-weighted figures, within a cell or so of its nodes
  const pile = (D, G, on) => {
    const { n, x, y, w, late, ch } = D, nc = ch.length, { c, ix, iy, nx, ny } = G, W = new Float32Array(nx * ny), N = ch.map((_, q) => (!on || on[q] ? new Float32Array(nx * ny) : null));
    for (let k = 0; k < n; k++) {
      if (c < late[k]) continue;
      const gx = x[k] / c - ix, gy = y[k] / c - iy, i = Math.floor(gx), j = Math.floor(gy);
      if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) continue;
      const fx = gx - i, fy = gy - j, o = j * nx + i, wa = w[k] * (1 - fx) * (1 - fy), wb = w[k] * fx * (1 - fy), wc = w[k] * (1 - fx) * fy, wd = w[k] * fx * fy;
      W[o] += wa; W[o + 1] += wb; W[o + nx] += wc; W[o + nx + 1] += wd;
      for (let q = 0; q < nc; q++) { const A = N[q]; if (!A) continue; const v = ch[q][k]; A[o] += wa * v; A[o + 1] += wb * v; A[o + nx] += wc * v; A[o + nx + 1] += wd * v; }
    }
    blur(W, nx, ny); for (let q = 0; q < nc; q++) if (N[q]) blur(N[q], nx, ny);
    G.W = W; G.N = N;
  };
  // a level's figures over the one above it, where its votes reach
  const settle = (D, G, U, q) => {
    const W = G.W, A = G.N[q], M2 = D.M0 * D.M0;
    for (let k = 0; k < U.length; k++) { const wv = W[k]; if (!(wv > 1e-3)) continue; const m = wv * KA, t = (m * m) / (m * m + M2); U[k] += t * (A[k] / wv - U[k]); }
    return U;
  };
  // the whole frame, every 8km
  function build(D) {
    let S = built.get(D);
    if (S) return S;
    const { n, w, ch } = D, nc = ch.length, C0 = 8 * D.u, CF = C0 / 2 ** FINE, pad = 8 * C0;
    const x0 = D.bx0 - pad, y0 = D.by0 - pad, x1 = D.bx1 + pad, y1 = D.by1 + pad, ext = Math.max(x1 - x0, y1 - y0);
    let top = 0; while (C0 * 2 ** top < ext / 3) top++;
    const Ls = [];
    for (let l = 0; l <= top; l++) {
      const c = C0 * 2 ** l, ix = Math.floor(x0 / c) - PAD, iy = Math.floor(y0 / c) - PAD, G = { c, ix, iy, nx: Math.ceil(x1 / c) + PAD - ix + 1, ny: Math.ceil(y1 / c) + PAD - iy + 1 };
      pile(D, G); Ls.push(G);
    }
    let sw = 0; const sn = new Float64Array(nc);
    for (let k = 0; k < n; k++) { sw += w[k]; for (let q = 0; q < nc; q++) sn[q] += w[k] * ch[q][k]; }
    const T0 = Ls[top], F = [];
    for (let q = 0; q < nc; q++) { const a = new Float32Array(T0.nx * T0.ny), mean = sn[q] / sw; for (let k = 0; k < a.length; k++) a[k] = T0.W[k] > 1e-3 ? T0.N[q][k] / T0.W[k] : mean; F.push(a); }
    for (let l = top - 1; l >= 0; l--) { for (let q = 0; q < nc; q++) F[q] = settle(D, Ls[l], subdivide(F[q], Ls[l + 1], Ls[l]), q); if (l) Ls[l].W = Ls[l].N = null; }
    // the tiles worth making: where a fine level's votes could reach M0, and a little round
    const G = Ls[0], want = new Set(), span = TN * CF, reach = 2 * C0, floorM = 0.5 * D.M0;
    for (let j = 0, o = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++, o++) {
      if (G.W[o] * KA < floorM) continue;
      const x = (G.ix + i) * C0, y = (G.iy + j) * C0;
      for (const dx of [-reach, reach]) for (const dy of [-reach, reach]) want.add(Math.floor((x + dx) / span) * 65536 + Math.floor((y + dy) / span));
    }
    G.W = G.N = null;
    S = { C0, CF, span, G, F, want, tiles: new Map(), nc };
    built.set(D, S);
    return S;
  }
  // a tile: its lattice's finest levels over the frame's, and each coarser cell's average for a wide view
  function tile(D, S, tx, ty) {
    const key = tx * 65536 + ty;
    let t = S.tiles.get(key);
    if (t !== undefined) return t;
    if (!S.want.has(key)) { S.tiles.set(key, null); return null; }
    const ix0 = tx * TN - MG, iy0 = ty * TN - MG, ix1 = ix0 + TN + 2 * MG, iy1 = iy0 + TN + 2 * MG, Ls = [];
    for (let l = 0; l <= FINE; l++) { const s = 2 ** l, ix = Math.floor(ix0 / s) - PAD, iy = Math.floor(iy0 / s) - PAD; Ls.push({ c: S.CF * s, ix, iy, nx: Math.ceil(ix1 / s) + PAD - ix + 1, ny: Math.ceil(iy1 / s) + PAD - iy + 1 }); }
    // (a group with nothing here stays at nothing: most tiles need two or three of a Winner field's six)
    const Top = Ls[FINE], g = S.G, on = new Array(S.nc).fill(false), F = S.F.map((A, q) => { const a = new Float32Array(Top.nx * Top.ny); for (let j = 0, o = 0; j < Top.ny; j++) { const v = Math.max(0, Math.min(g.ny - 1, Top.iy + j - g.iy)); for (let i = 0; i < Top.nx; i++, o++) { const s = A[v * g.nx + Math.max(0, Math.min(g.nx - 1, Top.ix + i - g.ix))]; a[o] = s; if (s > 1e-3) on[q] = true; } } return a; });
    if (!D.fam) on.fill(true);
    for (let l = 0; l < FINE; l++) pile(D, Ls[l], on);
    for (let l = FINE - 1; l >= 0; l--) { for (let q = 0; q < S.nc; q++) F[q] = on[q] ? settle(D, Ls[l], subdivide(F[q], Ls[l + 1], Ls[l]), q) : null; Ls[l].W = Ls[l].N = null; }
    const G0 = Ls[0], mips = [{ G: G0, F }];
    for (let m = 1; m <= FINE; m++) {
      const P = mips[m - 1], g0 = P.G, ix = Math.ceil(g0.ix / 2) + 1, iy = Math.ceil(g0.iy / 2) + 1, nx = Math.floor((g0.ix + g0.nx - 2) / 2) - ix + 1, ny = Math.floor((g0.iy + g0.ny - 2) / 2) - iy + 1, G = { c: g0.c * 2, ix, iy, nx, ny };
      const down = P.F.map((A) => {
        if (!A) return null;
        const a = new Float32Array(nx * ny), r = g0.nx;
        for (let j = 0, o = 0; j < ny; j++) { const c = (2 * (iy + j) - g0.iy) * r; for (let i = 0; i < nx; i++, o++) { const k = c + 2 * (ix + i) - g0.ix; a[o] = (4 * A[k] + 2 * (A[k - 1] + A[k + 1] + A[k - r] + A[k + r]) + A[k - r - 1] + A[k - r + 1] + A[k + r - 1] + A[k + r + 1]) / 16; } }
        return a;
      });
      mips.push({ G, F: down });
    }
    S.tiles.set(key, (t = mips));
    return t;
  }
  // the field at a spot, off a lattice: a cubic B-spline of its four nearest nodes each way
  function read(G, F, x, y, out) {
    const u = x / G.c - G.ix, v = y / G.c - G.iy, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, nx = G.nx, ny = G.ny;
    const a2 = a * a, a3 = a2 * a, b2 = b * b, b3 = b2 * b;
    wx[0] = (1 - 3 * a + 3 * a2 - a3) / 6; wx[1] = (4 - 6 * a2 + 3 * a3) / 6; wx[2] = (1 + 3 * a + 3 * a2 - 3 * a3) / 6; wx[3] = a3 / 6;
    wy[0] = (1 - 3 * b + 3 * b2 - b3) / 6; wy[1] = (4 - 6 * b2 + 3 * b3) / 6; wy[2] = (1 + 3 * b + 3 * b2 - 3 * b3) / 6; wy[3] = b3 / 6;
    const inner = i >= 1 && j >= 1 && i < nx - 2 && j < ny - 2;
    for (let q = 0; q < F.length; q++) {
      const A = F[q];
      if (!A) { out[q] = 0; continue; }
      let s = 0;
      if (inner) {
        for (let dj = 0, o = (j - 1) * nx + i - 1; dj < 4; dj++, o += nx) s += wy[dj] * (wx[0] * A[o] + wx[1] * A[o + 1] + wx[2] * A[o + 2] + wx[3] * A[o + 3]);
      } else for (let dj = 0; dj < 4; dj++) {
        const jj = j + dj - 1, r = (jj < 0 ? 0 : jj >= ny ? ny - 1 : jj) * nx; let row = 0;
        for (let di = 0; di < 4; di++) { const ii = i + di - 1; row += wx[di] * A[r + (ii < 0 ? 0 : ii >= nx ? nx - 1 : ii)]; }
        s += wy[dj] * row;
      }
      out[q] = s;
    }
  }
  let lastKey = null, lastTile = null, lastS = null;
  function sample(D, S, x, y, mip, out) {
    if (mip >= FINE) { read(S.G, S.F, x, y, out); return; }
    const tx = Math.floor(x / S.span), ty = Math.floor(y / S.span), key = tx * 65536 + ty;
    if (S !== lastS || key !== lastKey) { lastS = S; lastKey = key; lastTile = tile(D, S, tx, ty); }
    const t = lastTile;
    if (t) read(t[mip].G, t[mip].F, x, y, out); else read(S.G, S.F, x, y, out);
  }
  // the reading at a spot, whatever is on the screen
  function at(D, x, y) {
    const S = build(D), out = new Float64Array(S.nc);
    sample(D, S, x, y, 0, out);
    return out;
  }
  // the picture of a window J of the field
  function raster(D, J) {
    const S = build(D), nc = S.nc, p = J.px, c0 = CELL * p, W = J.nx, H = J.ny, cw = Math.ceil(W / CELL), chh = Math.ceil(H / CELL), row = cw + 1;
    const mip = Math.max(0, Math.min(FINE, Math.round(Math.log2(c0 / S.CF)))), F = Array.from({ length: nc }, () => new Float32Array(row * (chh + 1))), v = new Float64Array(nc);
    for (let j = 0, o = 0; j <= chh; j++) for (let i = 0; i <= cw; i++, o++) { sample(D, S, J.x0 + i * c0, J.y0 + j * c0, mip, v); for (let q = 0; q < nc; q++) F[q][o] = v[q]; }
    const out = new Uint32Array(W * H);
    const { band, col, lo, hi, line, fam, nb, ink } = D, sc = 4095 / (hi - lo);
    const bandOf = (s) => { const k = ((s - lo) * sc) | 0; return band[k < 0 ? 0 : k > 4095 ? 4095 : k]; };
    const CL = new Int16Array(row * (chh + 1)), SD = new Int8Array(row * (chh + 1));
    const lead = (at2) => { let a = 0, b = -1, va = -1, vb = -1; for (let q = 0; q < nc; q++) { const s = at2(q); if (s > va) { vb = va; b = a; va = s; a = q; } else if (s > vb) { vb = s; b = q; } } return [a, b, va, vb < 0 ? 0 : vb]; };
    for (let o = 0; o < CL.length; o++) {
      if (fam) { let a = 0, va = -1, vb = -1; for (let q = 0; q < nc; q++) { const s = F[q][o]; if (s > va) { vb = va; va = s; a = q; } else if (s > vb) vb = s; } CL[o] = a * nb + bandOf(100 * (va - Math.max(vb, 0))); SD[o] = a; }
      else { const s = F[0][o]; CL[o] = bandOf(s); SD[o] = line != null && s >= line ? 1 : 0; }
    }
    // flat cells, edge cells, and those the line crosses or nearly does
    const FL = new Uint8Array(cw * chh);
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (CL[a] !== CL[b] || CL[a] !== CL[c] || CL[a] !== CL[d]) FL[j * cw + i] = 1;
      if (line != null && (SD[a] !== SD[b] || SD[a] !== SD[c] || SD[a] !== SD[d])) FL[j * cw + i] = 2;
    }
    if (line != null) for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      if (FL[j * cw + i] !== 2) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < cw && nj < chh && FL[nj * cw + ni] < 2) FL[nj * cw + ni] = 3; }
    }
    const LN = CELL + 1, lc = new Int32Array(LN * LN), ls = new Float32Array(LN * LN), lw = J.lw;
    const inkR = ink & 255, inkG = (ink >> 8) & 255, inkB = (ink >> 16) & 255;
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const f = FL[j * cw + i], px0 = i * CELL, py0 = j * CELL;
      if (!f) {
        const c = col[CL[j * row + i]], xe = Math.min(W, px0 + CELL), ye = Math.min(H, py0 + CELL);
        for (let yy = py0; yy < ye; yy++) { const o = yy * W; for (let xx = px0; xx < xe; xx++) out[o + xx] = c; }
        continue;
      }
      const k00 = j * row + i, k10 = k00 + 1, k01 = k00 + row, k11 = k01 + 1, lineOn = line != null && f >= 2;
      let ta = 0, tb = 1;
      if (fam) { const r = lead((q) => (F[q][k00] + F[q][k10] + F[q][k01] + F[q][k11]) / 4); ta = r[0]; tb = r[1] < 0 ? r[0] : r[1]; }
      for (let b = 0, o = 0; b < LN; b++) { const t = b / CELL; for (let a = 0; a < LN; a++, o++) {
        const u = a / CELL, w00 = (1 - u) * (1 - t), w10 = u * (1 - t), w01 = (1 - u) * t, w11 = u * t;
        if (fam) {
          let ia = 0, va = -1, vb = -1;
          for (let q = 0; q < nc; q++) { const A = F[q], s = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11; if (s > va) { vb = va; va = s; ia = q; } else if (s > vb) vb = s; }
          lc[o] = col[ia * nb + bandOf(100 * (va - Math.max(vb, 0)))];
          const A = F[ta], B = F[tb]; ls[o] = (A[k00] - B[k00]) * w00 + (A[k10] - B[k10]) * w10 + (A[k01] - B[k01]) * w01 + (A[k11] - B[k11]) * w11;
        } else {
          const A = F[0], s = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
          lc[o] = col[bandOf(s)]; if (lineOn) ls[o] = s - line;
        }
      } }
      for (let b = 0; b < CELL; b++) { const yy = py0 + b; if (yy >= H) break; for (let a = 0; a < CELL; a++) {
        const xx = px0 + a; if (xx >= W) break;
        const o = b * LN + a, c0a = lc[o], c1 = lc[o + 1], c2 = lc[o + LN], c3 = lc[o + LN + 1];
        let R = ((c0a & 255) + (c1 & 255) + (c2 & 255) + (c3 & 255)) / 4, G = (((c0a >> 8) & 255) + ((c1 >> 8) & 255) + ((c2 >> 8) & 255) + ((c3 >> 8) & 255)) / 4, B = (((c0a >> 16) & 255) + ((c1 >> 16) & 255) + ((c2 >> 16) & 255) + ((c3 >> 16) & 255)) / 4;
        if (lineOn) {
          const s0 = ls[o], s1 = ls[o + 1], s2 = ls[o + LN], s3 = ls[o + LN + 1], m = (s0 + s1 + s2 + s3) / 4, gx = (s1 + s3 - s0 - s2) / 2, gy = (s2 + s3 - s0 - s1) / 2, g = Math.sqrt(gx * gx + gy * gy);
          const dist = g > 1e-6 ? Math.abs(m) / g : 9, cov = dist >= lw / 2 + 0.5 ? 0 : dist <= lw / 2 - 0.5 ? 1 : lw / 2 + 0.5 - dist;
          if (cov > 0) { R += (inkR - R) * cov; G += (inkG - G) * cov; B += (inkB - B) * cov; }
        }
        out[yy * W + xx] = ((255 << 24) | (B << 16) | (G << 8) | (R | 0)) >>> 0;
      } }
    }
    return { rgba: out.buffer };
  }
  return { at, raster };
}

/* ----- the rasters -----
   Two at most: the whole frame, made as soon as a reading is chosen, and the view at the
   screen's own grain once the zoom has outrun it, made a quarter wider than the view all
   round so a pan rarely reaches its edge. Grain moves by half-octaves, so the same raster
   serves through a stretch of zoom; a job asked for while one runs waits for it, and only
   the latest wish is kept. */
const SF = { wk: null, dead: false, key: null, m: null, data: null, none: null, ids: null, busy: false, id: 0, base: null, view: null, old: null, t1: 0, empty: false };
function surfaceWorker() {
  if (SF.wk || SF.dead) return SF.wk;
  try {
    const src = `const E=(${surfaceEngine})();const sets=new Map();onmessage=async(e)=>{const q=e.data;if(q.t==="set"){sets.set(q.key,q.D);while(sets.size>3)sets.delete(sets.keys().next().value);return;}
const D=sets.get(q.key);
if(q.t==="at"){if(D)postMessage({t:"at",key:q.key,id:q.id,x:q.x,y:q.y,v:E.at(D,q.x,q.y)});return;}
if(!D){postMessage({id:q.id,key:q.key,J:q.J,gone:true});return;}
const r=E.raster(D,q.J);let bitmap=null;try{bitmap=await createImageBitmap(new ImageData(new Uint8ClampedArray(r.rgba),q.J.nx,q.J.ny));}catch(x){}
const moved=bitmap?[bitmap]:[r.rgba];postMessage({id:q.id,key:q.key,J:q.J,bitmap,rgba:bitmap?null:r.rgba},moved);};`;
    SF.wk = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    SF.wk.onmessage = (e) => (e.data.t === "at" ? surfaceHeard(e.data) : surfaceDone(e.data));
    SF.wk.onerror = () => { SF.dead = true; SF.wk = null; SF.busy = false; SF.sent = null; schedule(); };
  } catch (e) { SF.dead = true; SF.wk = null; }
  return SF.wk;
}
let pageEngineMade = null;
const pageEngine = () => (pageEngineMade ??= surfaceEngine()); // (where no worker will start)
function surfaceJob(J) {
  SF.busy = true;
  const id = ++SF.id, key = SF.key, wk = surfaceWorker();
  if (wk) {
    if (SF.sent !== key) { wk.postMessage({ t: "set", key, D: SF.data }); SF.sent = key; }
    wk.postMessage({ t: "job", id, key, J });
  } else setTimeout(() => { if (key !== SF.key) { SF.busy = false; schedule(); return; } const r = pageEngine().raster(SF.data, J); surfaceDone({ id, key, J, bitmap: null, rgba: r.rgba }); }, 0);
}
async function surfaceDone(q) {
  SF.busy = false;
  if (q.gone || q.key !== SF.key) { if (q.bitmap) q.bitmap.close(); schedule(); return; }
  let src = q.bitmap;
  if (!src) { // no ImageBitmap in the worker, or no worker
    const cv = document.createElement("canvas"); cv.width = q.J.nx; cv.height = q.J.ny;
    cv.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(q.rgba), q.J.nx, q.J.ny), 0, 0); src = cv;
  }
  const J = q.J, pat = ctx.createPattern(src, "no-repeat");
  pat.setTransform(new DOMMatrix([J.px, 0, 0, J.px, J.x0, J.y0]));
  const L = { pat, src, J, x0: J.x0, y0: J.y0, x1: J.x0 + J.nx * J.px, y1: J.y0 + J.ny * J.px };
  const was = J.base ? SF.base : SF.view;
  if (J.base) { SF.base = L; SF.t1 = performance.now(); if (drawFade) drawFade.t0 = SF.t1; } else SF.view = L;
  if (was) closeLayer(was);
  schedule();
}
const closeLayer = (L) => { if (L.src && L.src.close) L.src.close(); };
function surfaceStart(m, key) {
  // the reading before crossfades away, carried onto this election's plane; another jurisdiction's just goes
  const old = [SF.base, SF.view].filter(Boolean);
  if (SF.old) SF.old.forEach(closeLayer);
  SF.old = null; SF.base = SF.view = null;
  if (old.length && SF.m === m) SF.old = old;
  else if (old.length && SF.m && !reduceMotion && jurOf(SF.m.year) === jurOf(m.year)) {
    const A = frameMap(SF.m, m);
    old.forEach((L) => L.pat.setTransform(new DOMMatrix([A.a * L.J.px, 0, 0, A.a * L.J.px, A.a * L.J.x0 + A.bx, A.a * L.J.y0 + A.by])));
    SF.old = old;
  } else old.forEach(closeLayer);
  SF.key = key; SF.m = m; SF.sent = null; SF.here = null;
  const d = surfaceData(m);
  SF.empty = !d; SF.data = d ? d.D : null; SF.none = d ? d.none : null; SF.ids = d ? d.D.ids || null : null;
  SF.t1 = performance.now();
}
const SNAP = (v, c) => Math.floor(v / c) * c;
function surfaceTick(m) {
  const key = readingKey(m);
  if (key !== SF.key) surfaceStart(m, key);
  if (!SF.data || SF.busy) return;
  const [[hx0, hy0], [hx1, hy1]] = homeBox(m), hw = hx1 - hx0, hh = hy1 - hy0;
  if (!SF.base) {
    const px = Math.max(hw, hh) / 1500, c = 3 * px, x0 = SNAP(hx0 - 0.08 * hw, c), y0 = SNAP(hy0 - 0.08 * hh, c);
    surfaceJob({ base: true, px, x0, y0, nx: Math.ceil((1.16 * hw) / c + 1) * 3, ny: Math.ceil((1.16 * hh) / c + 1) * 3, lw: 1.5 });
    return;
  }
  const q = Math.min(dpr, 1.5), want = 2 ** (Math.round(2 * Math.log2(1 / (T.k * q))) / 2);
  if (want >= SF.base.J.px * 0.8) { if (SF.view) { closeLayer(SF.view); SF.view = null; } return; }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = SF.view;
  if (V && Math.abs(Math.log2(V.J.px / want)) < 0.26 && V.x0 <= vx0 && V.y0 <= vy0 && V.x1 >= vx1 && V.y1 >= vy1) return;
  const vw = vx1 - vx0, vh = vy1 - vy0, c = 3 * want, x0 = SNAP(vx0 - 0.25 * vw, c), y0 = SNAP(vy0 - 0.25 * vh, c);
  surfaceJob({ px: want, x0, y0, nx: Math.ceil((1.5 * vw) / c + 1) * 3, ny: Math.ceil((1.5 * vh) / c + 1) * 3, lw: 1.25 * Math.min(q, 1.5) });
}
// what the seats' fill draws this frame: the layers, under the view's raster where it reaches
function surfaceLook(m, a) {
  surfaceTick(m);
  const now = performance.now(), ls = [];
  let fa = 1;
  if (SF.old) {
    fa = SF.base ? clamp((now - SF.t1) / 340, 0, 1) : 0;
    if (fa < 1) { needFrame = true; for (const L of SF.old) ls.push({ pat: L.pat, a }); }
    else { SF.old.forEach(closeLayer); SF.old = null; }
  }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = SF.view, full = V && V.x0 <= vx0 && V.y0 <= vy0 && V.x1 >= vx1 && V.y1 >= vy1;
  if (SF.base && !full) ls.push({ pat: SF.base.pat, a: a * ease(fa) });
  if (V) ls.push({ pat: V.pat, a: a * ease(fa) });
  if (!ls.length) return null;
  return { ls, top: ls[ls.length - 1].pat, under: a < 1 || (!SF.old && ls[0].a < 1), none: SF.none };
}
// the field at a spot on the plane: a figure, or who leads there and by how much. It's the one field's
// own value, asked of whoever holds it, so nothing on the screen can touch it
const surfaceWords = (v) => {
  if (!SF.ids) return { v: v[0] };
  const r = [...v].map((x, k) => [SF.ids[k], x]).sort((p, q) => q[1] - p[1]);
  return { fam: r[0][0], lead: 100 * (r[0][1] - Math.max(r[1] ? r[1][1] : 0, 0)) };
};
let askId = 0;
const askWaiting = new Map();
function surfaceAt(x, y) {
  return new Promise((done) => {
    if (!SF.data) { done(null); return; }
    if (!SF.wk) { done(surfaceWords(pageEngine().at(SF.data, x, y))); return; }
    if (SF.sent !== SF.key) { SF.wk.postMessage({ t: "set", key: SF.key, D: SF.data }); SF.sent = SF.key; }
    const id = ++askId; askWaiting.set(id, done);
    SF.wk.postMessage({ t: "at", key: SF.key, id, x, y });
  });
}
function surfaceHeard(q) {
  const done = askWaiting.get(q.id); askWaiting.delete(q.id);
  if (done) done(q.key === SF.key ? surfaceWords(q.v) : null);
}
// the tooltip's reading: the latest answer for the pointer, the next on its way
function surfaceAsk(x, y) {
  if (SF.asking) { SF.askNext = [x, y]; return; }
  SF.asking = true;
  surfaceAt(x, y).then((a) => {
    SF.asking = false; SF.here = a;
    if (SF.askNext) { const [nx, ny] = SF.askNext; SF.askNext = null; surfaceAsk(nx, ny); }
    tipRefresh();
  });
}

/* ----- the Areas drawing: the census's own areas, painted as counted -----
   Seats rolls the census up to each seat, and Surface smooths it between the polling
   places; Areas stops at the finest rung the census itself publishes: the SA1 areas,
   each painted with the figure the census counted there — a counted figure at every
   point the census counted people, paper where it counted none (empty land) and where
   the ABS suppresses a figure. The whole Census lens carries over — every People
   measure, every Advantage index — read off one lazy pack per census vintage
   (.build/map/build_areas_sa1.py): the 2021 pack is 61,811 areas over about sixty
   lanes plus the shape itself, fetched the first time a frame wants them. The income
   quartile lanes ride the frame in view's own incomeCuts over the pack's sixteen
   adults-basis band masses per area, exactly as its seat stores compute them.
   The drawing runs the surface's own bookkeeping: a whole-frame raster at the frame's
   home zoom, a view raster on settle once the zoom outruns it, both composited through
   the seats' fill paths in drawGeo, so the coast cut, the islands, the filters and the
   veil work as they do on a surface. Mid-gesture the last raster just takes the new
   transform. The key runs each lane's own extents from the pack (a population-weighted
   99.5th percentile, rounded up), so only the lanes whose areas really reach ~100%
   run that far — never the seats' 60% that flattens a Fairfield. */
const AREAS_FILES = { 2021: "areas-sa1-2021" };
// the frame's census vintage: its own demoYear, and a blend's nearest single side
const areasVintage = (m) => (m ? m.demoInterp ? m.demoInterp.nearestSide : (m.demoYear == null ? 2021 : m.demoYear) : null);
// the pack's lane for the Census lens's current measure (mirrors demoRamp's family map)
function areasLane() {
  if (S.lens !== "seifa") return null;
  if (!isDemo()) return `sf.${S.index}`;
  if (isCob()) return `cob.${S.cob}`;
  if (isRel()) return `rel.${S.rel}`;
  if (isTen()) return `ten.${S.ten}`;
  if (isAnc()) return `anc.${S.anc}`;
  if (isInc()) return S.incMode === "med" ? "incMed" : S.incMode === "lo" ? "loinc" : "hiqinc";
  if (isAge()) return S.ageMode === "med" ? "ageMed" : S.ageMode;
  if (isEdu()) return S.eduMode;
  return S.index;
}
// the 2021 pack's lanes (AREA_LANES pinned in test-map-areas.mjs against the pack)
const AREAS_LANES = new Set(["lang", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "loinc", "hiqinc", "a65", "a2034", "a1824", "a3554", "a75",
  "rel.norel", "rel.cath", "rel.angl", "rel.unch", "rel.pres", "rel.orth", "rel.budd", "rel.isl", "rel.hind", "rel.jew",
  "ten.mort", "ten.rent", "ten.own", "ten.rentPub",
  "cob.eng", "cob.ind", "cob.chn", "cob.nzl", "cob.phl", "cob.vnm", "cob.zaf", "cob.ita", "cob.lka", "cob.sct",
  "anc.english", "anc.australian", "anc.irish", "anc.scottish", "anc.chinese", "anc.italian", "anc.german", "anc.indian", "anc.filipino", "anc.dutch", "anc.vietnamese", "anc.lebanese",
  "ageMed", "incMed",
  "sf.irsad", "sf.irsd", "sf.ier", "sf.ieo"]);
// gcp_newlanes.INC_BANDS, verbatim: the weekly income bands the masses follow
const AREAS_INC_BANDS = [[1, 149], [150, 299], [300, 399], [400, 499], [500, 649], [650, 799], [800, 999], [1000, 1249], [1250, 1499], [1500, 1749], [1750, 1999], [2000, 2499], [2500, 2999], [3000, 3499], [3500, 3999], [4000, null]];

const AR = { packs: {}, pack: null, packOf: null, proj: null, projs: new WeakMap(),
             vintage: null, m: null, key: null, lane: null, vals: null, pal: null, palRaw: null,
             base: null, view: null, old: null, t1: 0, id: 0, busy: false, wantJ: null,
             askedShow: false, here: null };

function loadAreas(vin) {
  if (AREAS_FILES[vin] == null) return null;
  const got = AR.packs[vin];
  if (got) return got.pack || got.P;
  const P = getJSON(`/map/data/${AREAS_FILES[vin]}.json`)
    .then((D) => {
      const pack = areasUnpack(D);
      AR.packs[vin] = { pack };
      const m = M(), want = m && drawOf(m) === "areas" && areasVintage(m) === vin;
      AR.key = null; schedule();
      if (want) renderLegend();
      showLoading(false);
      return pack;
    })
    .catch((e) => { delete AR.packs[vin]; console.error(e); showLoading(false); return null; });
  AR.packs[vin] = { P };
  return P;
}
/* one national unpack: lane buffers decoded, geometries readied (projection is per
   frame, made lazily and cached on the frame itself) */
function areasUnpack(D) {
  const U8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const lanes = {}, types = {};
  for (const [k, o] of Object.entries(D.lanes)) {
    types[k] = o.t;
    if (o.t === "u16") lanes[k] = new Uint16Array(U8(o.b).buffer);
    else lanes[k] = U8(o.b);
  }
  const { scale, translate } = D.topo.transform;
  const arcs = D.topo.arcs.map((a) => {
    const o = new Float64Array(a.length * 2);
    let x = 0, y = 0;
    for (let i = 0; i < a.length; i++) {
      x += a[i][0]; y += a[i][1];
      o[2 * i] = x * scale[0] + translate[0]; o[2 * i + 1] = y * scale[1] + translate[1];
    }
    return o;
  });
  const geoms = D.topo.objects[Object.keys(D.topo.objects)[0]].geometries.map((g) => {
    const rings = g.type === "Polygon" ? g.arcs : g.type === "MultiPolygon" ? g.arcs.flat() : [];
    return { r: rings, bb: [Infinity, Infinity, -Infinity, -Infinity] };
  });
  const n = geoms.length, decN = (o) => new Uint16Array(U8(o.b).buffer), dec32 = (o) => new Uint32Array(U8(o.b).buffer);
  const incBands = decN(D.meta.incBands), pop = dec32(D.meta.pop), area = dec32(D.meta.area), sa2i = decN(D.meta.sa2i);
  for (const [k, arr] of Object.entries(lanes)) if (arr.length !== n) throw new Error(`areas pack lane ${k} length ${arr.length} != ${n}`);
  if (incBands.length !== n * 16 || pop.length !== n || area.length !== n || sa2i.length !== n) throw new Error("areas pack meta length drift");
  return { vintage: D.vintage, caps: D.caps, marks: D.marks, sa2names: D.meta.sa2names, lanes, types, geoms, arcs, incBands, pop, area, sa2i };
}
// the income-quartile shares at the frame's own cuts: the builder's walk, verbatim
function areasIncShare(P, m, i, lane) {
  const b = P.incBands, o = i * 16;
  let tot = 0;
  for (let k = 0; k < 16; k++) tot += b[o + k];
  if (!tot) return null;
  const cut = lane === "loinc" ? m.incomeCuts.loCutWeekly : m.incomeCuts.hiQCutWeekly;
  if (!(cut > 0)) return null;
  let mass = lane === "loinc" ? 0 : tot;
  for (let k = 0; k < 16; k++) {
    const [lo, hi] = AREAS_INC_BANDS[k], w = b[o + k];
    if (cut <= lo) { if (lane === "loinc") continue; break; }
    if (hi != null && cut > hi) { mass += lane === "loinc" ? w : -w; continue; }
    mass += (lane === "loinc" ? 1 : -1) * (w * (cut - lo)) / (hi - lo + 1);
    break;
  }
  return mass / tot;
}
// a lane's display figure at area i, in the key's own units (percent for shares,
// years/dollars the medians, deciles the indexes; null = nothing published there)
function areasValue(P, m, i, lane) {
  const inc = lane === "loinc" || lane === "hiqinc";
  if (inc) { const v = areasIncShare(P, m, i, lane); return v == null ? null : 100 * v; }
  const L = P.lanes[lane], t = P.types[lane];
  if (!L) return null;
  const v = L[i];
  if (t === "u8x2") return v === 255 ? null : v / 2;
  if (t === "u8z") return v === 0 ? null : v;
  if (t === "u8") return v === 255 ? null : v;
  if (t === "u16") return v === 65535 ? null : v;
  return null;
}
const AR_NULLI = 251;
// the reading's per-area key-line indexes over the pack (0..240 into AR.pal; 251 = none)
function areasVals(P, m, lane) {
  const n = P.geoms.length, vals = new Uint8Array(n).fill(AR_NULLI);
  const [lo, hi] = P.caps[lane];
  for (let i = 0; i < n; i++) {
    const v = areasValue(P, m, i, lane);
    if (v != null) vals[i] = Math.min(240, Math.max(0, Math.round(((v - lo) / (hi - lo)) * 240)));
  }
  return vals;
}
// the key's palette, raw and stringed (the density fade needs the numbers)
function areasPalette(lane) {
  const ramp = lane.startsWith("sf.") ? RAMP.seifa : demoRamp(), pal = new Array(241), raw = new Array(241);
  for (let k = 0; k <= 240; k++) raw[k] = ramp[Math.round((k / 240) * 100)];
  for (let k = 0; k <= 240; k++) pal[k] = css(raw[k]);
  return { pal, raw };
}
// the frame's projection of every arc, the areas' projected bounds, and the tooltip's
// spatial grid — made once, kept on the frame it belongs to
function areasProj(m, vin) {
  let pr = AR.projs.get(m);
  if (pr && pr.vin === vin) return pr;
  const P = AR.packs[vin] && AR.packs[vin].pack;
  if (!P) return null;
  const arcsXY = P.arcs.map((a) => {
    const o = new Float32Array(a.length);
    for (let i = 0; i < a.length; i += 2) {
      const p = m.proj([a[i], a[i + 1]]);
      o[i] = p ? p[0] : NaN;
      o[i + 1] = p ? p[1] : NaN;
    }
    return o;
  });
  const bb = P.geoms.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
  P.geoms.forEach((g, gi) => {
    const b = bb[gi];
    for (const ring of g.r) {
      for (const aid of ring) {
        const A = arcsXY[aid < 0 ? ~aid : aid];
        for (let k = 0; k < A.length; k += 2) {
          const x = A[k], y = A[k + 1];
          if (!(x === x)) continue;
          if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
          if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
        }
      }
    }
  });
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const b of bb) { if (b[0] === Infinity) continue; if (b[0] < X0) X0 = b[0]; if (b[1] < Y0) Y0 = b[1]; if (b[2] > X1) X1 = b[2]; if (b[3] > Y1) Y1 = b[3]; }
  const span = Math.max(X1 - X0, 1e-6), cell = span / 160, W = Math.ceil((X1 - X0) / cell) + 1, H = Math.ceil((Y1 - Y0) / cell) + 1;
  const grid = new Array(W * H).fill(null);
  P.geoms.forEach((g, gi) => {
    const b = bb[gi];
    if (b[0] === Infinity) return;
    const c0 = clamp(Math.floor((b[0] - X0) / cell), 0, W - 1), c1 = clamp(Math.floor((b[2] - X0) / cell), 0, W - 1);
    const d0 = clamp(Math.floor((b[1] - Y0) / cell), 0, H - 1), d1 = clamp(Math.floor((b[3] - Y0) / cell), 0, H - 1);
    for (let d = d0; d <= d1; d++) for (let c = c0; c <= c1; c++) {
      const o = d * W + c;
      (grid[o] || (grid[o] = [])).push(gi);
    }
  });
  pr = { vin, arcsXY, bb, grid, X0, Y0, cell, W, H };
  AR.projs.set(m, pr);
  return pr;
}
// odd-even ray cast over all of an area's rings at once (ring-agnostic: holes fall out)
function areasInside(pr, g, x, y) {
  let odd = false;
  for (const ring of g.r) {
    let fx = 0, fy = 0, lx = 0, ly = 0, first = true, px = 0, py = 0;
    const visit = (qx, qy) => {
      if (first) { fx = qx; fy = qy; first = false; }
      else if ((py > y) !== (qy > y) && x < px + ((qx - px) * (y - py)) / (qy - py)) odd = !odd;
      px = qx; py = qy;
    };
    for (const aid0 of ring) {
      const A = pr.arcsXY[aid0 < 0 ? ~aid0 : aid0], n = A.length;
      if (aid0 < 0) { for (let k = n - 2; k >= 0; k -= 2) visit(A[k], A[k + 1]); }
      else { for (let k = 0; k < n; k += 2) visit(A[k], A[k + 1]); }
    }
    // close the ring if the topology left it open
    if (!first && (px !== fx || py !== fy) && (py > y) !== (fy > y) && x < px + ((fx - px) * (y - py)) / (fy - py)) odd = !odd;
  }
  return odd;
}
// the area under a point on the frame's plane: the tooltip's ground truth
function areasHit(m, x, y) {
  const pr = m ? areasProj(m, areasVintage(m)) : null;
  if (!pr || !AR.pack) return null;
  const c = Math.floor((x - pr.X0) / pr.cell), d = Math.floor((y - pr.Y0) / pr.cell);
  if (c < 0 || d < 0 || c >= pr.W || d >= pr.H) return null;
  const cell2 = pr.grid[d * pr.W + c];
  if (!cell2) return null;
  for (const gi of cell2) {
    const b = pr.bb[gi];
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (areasInside(pr, AR.pack.geoms[gi], x, y)) return { i: gi, sa2: AR.pack.sa2names[AR.pack.sa2i[gi]], pop: AR.pack.pop[gi] };
  }
  return null;
}

function areasStart(m, key) {
  const old = [AR.base, AR.view].filter(Boolean);
  AR.old = AR.m === m ? old : null;   // a change of reading fades the old rasters out
  AR.base = AR.view = null;
  AR.key = key; AR.m = m; AR.vintage = areasVintage(m); AR.lane = areasLane();
  AR.busy = false; AR.wantJ = null; AR.id++;
  AR.vals = null; AR.proj = null;
  AR.askedShow = false;
  AR.t1 = performance.now();
}
// pack, projection, values and palette in place for this frame's reading
function areasEnsure(m) {
  const vin = AR.vintage, got = AR.packs[vin] && AR.packs[vin].pack;
  if (!got) {
    const P = loadAreas(vin);
    if (P && P.then && !AR.askedShow) { AR.askedShow = true; showLoading(true, "Loading the census areas…"); }
    return false;
  }
  if (AR.vals && AR.packOf === vin) return true;
  AR.pack = got; AR.packOf = vin;
  AR.proj = areasProj(m, vin);
  AR.vals = areasVals(got, m, AR.lane);
  const { pal, raw } = areasPalette(AR.lane);
  AR.pal = pal; AR.palRaw = raw;
  AR.base = AR.view = null;
  return true;
}
/* the raster job: draws the window's visible areas in slices, so a whole-country
   settle never long-tasks the page; the last finished raster keeps taking the
   transform while the reader is mid-gesture */
function areasJob(J) {
  if (AR.busy) { AR.wantJ = J; return; }
  AR.busy = true; AR.wantJ = null;
  const P = AR.pack, pr = AR.proj;
  if (!P || !pr) { AR.busy = false; return; }
  const id = ++AR.id;
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.ceil(J.nx)); cv.height = Math.max(2, Math.ceil(J.ny));
  const c2 = cv.getContext("2d");
  c2.setTransform(1 / J.px, 0, 0, 1 / J.px, -J.x0 / J.px, -J.y0 / J.px);
  const x1 = J.x0 + cv.width * J.px, y1 = J.y0 + cv.height * J.px;
  const m = AR.m, u = unitsPerKm(m), fadeAmt = smooth(0.09, 0.03, J.px / u); // a city-and-closer density fade
  const vals = AR.vals, pal = AR.pal, raw = AR.palRaw, nodata = css(TH.nodata), paper = TH.bg;
  const popD = P.pop, areaD = P.area, geoms = P.geoms, bb = pr.bb, arcsXY = pr.arcsXY;
  c2.lineJoin = "round"; c2.lineWidth = 0.8 * J.px;
  let last = null;
  const mixes = new Map();
  const fadeCss = (slot, qq) => {
    const key = slot * 32 + Math.round(qq * 8);
    let got = mixes.get(key);
    if (!got) { got = css(towards(raw[slot], paper, Math.min(1, Math.max(0, qq)))); mixes.set(key, got); }
    return got;
  };
  const setCss = (i) => {
    const slot = vals[i];
    if (slot === AR_NULLI) { if (last !== nodata) { c2.fillStyle = c2.strokeStyle = last = nodata; } return; }
    let cssv = pal[slot];
    if (fadeAmt > 0) {
      const dens = (popD[i] * 100) / Math.max(areaD[i], 1);   // persons per km²
      const t = clamp(Math.log10(Math.max(dens, 1e-3)) / 2, 0, 1);
      const qq = fadeAmt * (1 - (0.06 + 0.94 * t));
      cssv = qq < 0.02 ? pal[slot] : fadeCss(slot, qq);
    }
    if (cssv !== last) { c2.fillStyle = c2.strokeStyle = last = cssv; }
  };
  const SUB = 1.4, N = geoms.length;
  let gi = 0;
  const step = () => {
    if (id !== AR.id) return;
    const tend = performance.now() + 26;
    for (; gi < N; gi++) {
      const b = bb[gi];
      if (b[0] > x1 || b[2] < J.x0 || b[1] > y1 || b[3] < J.y0) continue;
      setCss(gi);
      const w = (b[2] - b[0]) / J.px, h = (b[3] - b[1]) / J.px;
      if (w < SUB && h < SUB) { c2.fillRect(b[0], b[1], J.px * 1.3, J.px * 1.3); continue; }
      const g = geoms[gi];
      c2.beginPath();
      for (const ring of g.r) {
        let first = true;
        for (const aid0 of ring) {
          const A = arcsXY[aid0 < 0 ? ~aid0 : aid0], n = A.length;
          if (aid0 < 0) {
            for (let k = n - 2; k >= 0; k -= 2) { if (first) { c2.moveTo(A[k], A[k + 1]); first = false; } else c2.lineTo(A[k], A[k + 1]); }
          } else {
            for (let k = 0; k < n; k += 2) { if (first) { c2.moveTo(A[k], A[k + 1]); first = false; } else c2.lineTo(A[k], A[k + 1]); }
          }
        }
        c2.closePath();
      }
      c2.fill("evenodd");
      c2.stroke();
      if ((gi & 1023) === 0 && performance.now() > tend) { setTimeout(step, 0); return; }
    }
    AR.busy = false;
    if (J.base) AR.base = { cv, J, pat: null };
    else AR.view = { cv, J, pat: null };
    AR.t1 = performance.now();
    schedule();
    if (AR.wantJ) areasJob(AR.wantJ);
  };
  setTimeout(step, 0);
}
function areasTick(m) {
  if (!AR.vals || !AR.proj) return;
  const [[hx0, hy0], [hx1, hy1]] = homeBox(m), hw = hx1 - hx0, hh = hy1 - hy0;
  if (!AR.base) {
    const px = Math.max(hw, hh) / 1500;
    areasJob({ base: true, px, x0: hx0 - 0.08 * hw, y0: hy0 - 0.08 * hh, nx: (1.16 * hw) / px, ny: (1.16 * hh) / px });
    return;
  }
  const q = Math.min(dpr, 1.5), want = 2 ** (Math.round(2 * Math.log2(1 / (T.k * q))) / 2);
  if (want >= AR.base.J.px * 0.8) { AR.view = null; return; }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = AR.view;
  if (V && Math.abs(Math.log2(V.J.px / want)) < 0.26 && V.J.x0 <= vx0 && V.J.y0 <= vy0 && V.J.x0 + V.J.nx * V.J.px >= vx1 && V.J.y0 + V.J.ny * V.J.px >= vy1) return;
  const vw = vx1 - vx0, vh = vy1 - vy0;
  areasJob({ base: false, px: want, x0: vx0 - 0.25 * vw, y0: vy0 - 0.25 * vh, nx: (1.5 * vw) / want, ny: (1.5 * vh) / want });
}
function areasPattern(L) {
  if (!L.pat) {
    L.pat = ctx.createPattern(L.cv, "no-repeat");
    L.pat.setTransform(new DOMMatrix([L.J.px, 0, 0, L.J.px, L.J.x0, L.J.y0]));
  }
  return L.pat;
}
// the areas layers the seats' fill draws this frame, in the surface's own shape
function areasLook(m) {
  const key = readingKey(m) + "|a" + areasVintage(m);
  if (key !== AR.key) areasStart(m, key);
  if (!areasEnsure(m)) { areasTick(m); return { ls: [], top: null, under: true, none: null }; }
  areasTick(m);
  const now = performance.now(), ls = [], fa = AR.base ? clamp((now - AR.t1) / 340, 0, 1) : 0;
  if (AR.old) {
    if (fa < 1) { needFrame = true; for (const L of AR.old) ls.push({ pat: areasPattern(L), a: 1 - ease(fa) }); }
    else AR.old = null;
  }
  const [vx0, vy0, vx1, vy1] = viewBox(), V = AR.view, full = V && V.J.x0 <= vx0 && V.J.y0 <= vy0 && V.J.x0 + V.J.nx * V.J.px >= vx1 && V.J.y0 + V.J.ny * V.J.px >= vy1;
  if (AR.base && !full) ls.push({ pat: areasPattern(AR.base), a: AR.view ? 1 : ease(Math.max(fa, 0.05)) });
  if (V) ls.push({ pat: areasPattern(V), a: 1 });
  if (!ls.length) return { ls: [], top: null, under: true, none: null };
  return { ls, top: ls[ls.length - 1].pat, under: false, none: null };
}

/* ----- the change of drawing: a crossfade of the fills under the balloons' rise ----- */
let drawFade = null, ballNow = 0;
const DRAW_MS = 420;
function setDraw(d) {
  if (d === S.draw || !DRAWS.some(([k]) => k === d)) return;
  const m = M(), from = drawOf(m);
  S.draw = d;
  if (drawOf(m) !== from && !reduceMotion) drawFade = { from, t0: performance.now() };
  afterDrawChange();
}
function afterDrawChange() {
  const m = M();
  if (m) { for (const y of Object.values(Y)) if (y && y.divs) y._bal = null; recolor(false); }
  renderLegend(); renderStory(true); updateHint(); writeURL(); schedule();
}
function setAxis(a) {
  if (a === S.axis || !SP_PAIRS[a]) return;
  const m = M(), src = axisFrame(m);
  if (a !== "AC" && src != null && !STATE_YEARS.has(m.year) && !SPD[src]) {
    showLoading(true);
    loadSenatePrefs(src).then(() => { showLoading(false); setAxis(a); }).catch(() => showLoading(true, "The Senate’s ballots didn’t load. Try again."));
    return;
  }
  S.axis = a; afterDrawChange();
}
// how far the fills have gone over: the drawing in force, and the one it is leaving
function drawLook(m) {
  const d = drawOf(m), now = performance.now();
  let e = 1, from = d;
  if (drawFade) { const t = clamp((now - drawFade.t0) / DRAW_MS, 0, 1); if (t < 1) { needFrame = true; e = ease(t); from = drawFade.from; } else drawFade = null; }
  const surf = (d === "surface" ? e : 0) + (from === "surface" && d !== "surface" ? 1 - e : 0), ball = (d === "balloons" ? e : 0) + (from === "balloons" && d !== "balloons" ? 1 - e : 0);
  const are = (d === "areas" ? e : 0) + (from === "areas" && d !== "areas" ? 1 - e : 0);
  return { surf, ball, sf: surf > 0 && m.booth.n ? surfaceLook(m, surf) : null, are, ar: are > 0 ? areasLook(m) : null };
}

/* ----- the balloons -----
   Area true to the votes behind the reading, on one scale for every place, election and
   lens; the scale grows more slowly than the map as the reader zooms in, so balloons part.
   Where they would still lie on one another they join: a capital is a few pixels wide at
   the whole country, and a thousand booths stacked there would hide each other, the big
   Labor lead of a city vanishing under its last-drawn dots while a country seat's booths
   spread out to be counted. So places share a balloon by hexagonal cell of the screen's
   size (BAL_CELL, doubling in map units as the zoom halves), and a shared balloon's area is
   its places' net: one side's lead less the other's, so the ink on the map stays true to
   the votes at every zoom. An opened seat's places are always their own. */
const BAL_S = 0.048;    // px per root-vote at a frame's home view
const BAL_CELL = 14;    // px: the cell across, at its finest
const BAL_MAX = 80;     // px: no balloon wider than this, a capital's whole lead close in
const balScale = () => BAL_S * Math.min(9, Math.pow(Math.max(1, T.k / HOME.k), 0.5));
function balloonVotes(m, j) {
  const b = m.booth, formal = b.formal[j];
  const ofShare = (v) => (v == null || Number.isNaN(v) ? 0 : (Math.abs(v) / 100) * formal);
  switch (S.lens) {
    case "winner": { const t = finalVotes(m, j); return t ? Math.abs(t[0] - t[1]) : 0; }
    case "tpp": {
      const v = drawValue(m, j);
      if (S.tppMode === "swing") return ofShare(v);
      const A = axisOf(m); if (A) return Number.isNaN(A.v[j]) ? 0 : Math.abs(2 * A.a[j] - A.t[j]);
      const t = b.raw.tpp[j]; return t && t[0] + t[1] ? Math.abs(t[0] - t[1]) : v == null ? 0 : (Math.abs(2 * v - 100) / 100) * formal;
    }
    case "fp": case "senate": return ofShare(drawValue(m, j));
    case "flow": return drawValue(m, j) == null ? 0 : groupVotes(b, S.from, j);
    case "senpref": return drawValue(m, j) == null ? 0 : surfaceWeight(m, j);
    case "informal": { if (infModeOf(m) === "exhaust") return ofShare(drawValue(m, j)); const v = b.votes[j]; return Number.isFinite(v) ? Math.max(0, v - formal) : 0; }
    default: return drawValue(m, j) == null ? 0 : formal;
  }
}
// the middle of a two-sided reading, and its half-range
function twoSided(m) {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [0, 10] : [50, axisNow(m) !== "AC" ? axisSpan() : 20];
    case "fp": return S.fpMode === "change" ? [0, 15] : null;
    case "senate": return senGap() ? [0, 10] : null;
    case "flow": case "senpref": return [50, 40];
  }
  return null;
}
// a balloon's size says how much: its colour needs only say which side, and strongly enough to read against the land
function balloonColor(m, v) {
  if (S.lens === "winner") return TH.party[v] || null;
  if (S.lens === "cls") return colorOf(v);
  const two = twoSided(m);
  if (!two) {
    if (S.lens === "fp" || S.lens === "senate") return colorOf(Math.max(v, 0.32 * FPMAX[S.party]));
    if (S.lens === "informal") return colorOf(Math.max(v, 0.35 * infHi(m)));
    return colorOf(v);
  }
  const [mid, R] = two, d = v - mid;
  return colorOf(mid + (d < 0 ? -1 : 1) * R * (0.6 + 0.4 * Math.min(1, Math.abs(d) / R)));
}
// the places a balloon can stand for: not the islands, whose boxes are their own, nor a place with no spot on
// the land, as most hospital teams are; remote and mobile teams are shared over their seat's
const balloonPlace = (b, j) => b.isl[j] < 0 && (!Number.isNaN(b.x[j]) || b.ty[j] === 3 || b.ty[j] === 4);
// each place's part in a balloon: its votes, its figure, and whether a shared balloon nets it off or adds it up
function balloonSet(m) {
  const key = readingKey(m);
  if (m._bal && m._bal.key === key) return m._bal;
  if (m._bal && fade && !reduceMotion) balOld = { m, B: m._bal, t0: performance.now(), A: { a: 1, bx: 0, by: 0 } };
  const b = m.booth, n = b.n, J = [], C = [], W = [], V = [], X = [], Y2 = [], two = twoSided(m), taken = new Map();
  const cat = S.lens === "winner" || S.lens === "cls", net = (two && S.lens !== "flow" && S.lens !== "senpref") || S.lens === "winner";
  for (let j = 0; j < n; j++) {
    if (!balloonPlace(b, j)) continue;
    // a remote or mobile team has no spot of its own: it takes its turn on its seat's land (seatSpots)
    let x = b.x[j], y = b.y[j];
    if (Number.isNaN(x)) {
      const spots = seatSpots(m, b.d[j]), k = taken.get(b.d[j]) || 0; if (!spots.length) continue;
      taken.set(b.d[j], k + 1); [x, y] = nominalSpot(m, b.d[j], spots[(k * 7) % spots.length], k);
    }
    const v = drawValue(m, j); if (v == null || Number.isNaN(v)) continue;
    const c = balloonVotes(m, j); if (!(c > 0)) continue;
    J.push(j); C.push(c); W.push(surfaceWeight(m, j) || c); V.push(v); X.push(x); Y2.push(y);
  }
  return (m._bal = { key, n: J.length, J, C, W, V, X, Y: Y2, cat, net, mid: two ? two[0] : 0, levels: new Map() });
}
// a level's balloons, biggest first (a key on what the seat and filters leave out)
function balloonLevel(m, B, L) {
  const sd = selDiv(), fk = filtersOn() || (S.f.range && S.f.range.unit === "booths") ? filtersKey() : "", key = `${L}|${sd}|${fk}`;
  let P = B.levels.get(key); if (P) return P;
  const b = m.booth, cell = 2 ** L, rowH = cell * 0.866, groups = new Map(), out = [];
  const rf = S.f.range && S.f.range.unit === "booths" ? S.f.range : null, filt = filtersOn();
  const add = (g, a) => {
    const j = B.J[a], w = B.W[a], c = B.C[a], v = B.V[a], px = B.X[a], py = B.Y[a];
    g.n++; g.w += w; g.x += px * w; g.y += py * w; g.ids.push(j);
    g.x0 = Math.min(g.x0, px); g.x1 = Math.max(g.x1, px); g.y0 = Math.min(g.y0, py); g.y1 = Math.max(g.y1, py);
    if (B.cat) g.cats.set(v, (g.cats.get(v) || 0) + c);
    else { g.v += v * w; g.c += B.net ? (v >= B.mid ? c : -c) : c; }
  };
  const fresh = () => ({ n: 0, w: 0, x: 0, y: 0, v: 0, c: 0, ids: [], cats: B.cat ? new Map() : null, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const singles = [];
  for (let a = 0; a < B.n; a++) {
    const j = B.J[a];
    if (filt && !passes(m, b.d[j])) continue;
    if (rf && !inRange(boothColValue(m, j, rf.key), rf)) continue;
    if (sd != null && b.d[j] === sd) { const g = fresh(); add(g, a); singles.push(g); continue; }
    const r = Math.floor(B.Y[a] / rowH), q = Math.floor(B.X[a] / cell + (r & 1) / 2), k = r * 1e6 + q;
    let g = groups.get(k); if (!g) groups.set(k, (g = fresh()));
    add(g, a);
  }
  // a group's size and spot as they stand
  const sized = (g) => {
    if (B.cat) { const r = [...g.cats].sort((p, q) => q[1] - p[1]); g.size = r.length ? (B.net ? r[0][1] - (r[1] ? r[1][1] : 0) : r[0][1]) : 0; g.top = r.length ? r[0][0] : null; }
    else g.size = Math.abs(g.c);
    g.q = Math.sqrt(g.size); g.cx = g.x / g.w; g.cy = g.y / g.w;
  };
  // the cells' lattice is blind to the balloons' own size: a big one takes in its own side's
  // balloons that would lie inside it, so a city reads as one and not as rings within rings.
  // Never the other side's: a country town's Coalition lead beside a Labor city stands on its own
  const sideOf = (g) => (B.cat ? g.top : g.c >= 0);
  let cells = [...groups.values()]; cells.forEach(sized);
  if (cells.length < 900) {
    const s = BAL_S * Math.min(9, Math.pow(Math.max(1, (BAL_CELL / cell) / HOME.k), 0.5)) / (BAL_CELL / cell); // map units per root-vote, at this level's zoom
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      cells.sort((p, q) => q.size - p.size);
      for (let i = 0; i < cells.length; i++) {
        const G = cells[i]; if (G.gone) continue;
        const R = 0.75 * G.q * s, side = sideOf(G);
        for (let k = i + 1; k < cells.length; k++) {
          const q = cells[k]; if (q.gone || sideOf(q) !== side) continue;
          const dx = q.cx - G.cx, dy = q.cy - G.cy;
          if (dx * dx + dy * dy > R * R) continue;
          G.n += q.n; G.w += q.w; G.x += q.x; G.y += q.y; G.v += q.v; G.c += q.c; for (const j of q.ids) G.ids.push(j);
          G.x0 = Math.min(G.x0, q.x0); G.x1 = Math.max(G.x1, q.x1); G.y0 = Math.min(G.y0, q.y0); G.y1 = Math.max(G.y1, q.y1);
          if (B.cat) for (const [f, c] of q.cats) G.cats.set(f, (G.cats.get(f) || 0) + c);
          q.gone = true; moved = true;
        }
        sized(G);
      }
      cells = cells.filter((q) => !q.gone);
      if (!moved) break;
    }
  }
  singles.forEach(sized);
  const colours = new Map();
  for (const g of [...cells, ...singles]) {
    if (!(g.size >= 1)) continue;
    const v = B.cat ? g.top : g.v / g.w;
    g.x = g.cx; g.y = g.cy; g.val = v;
    const ck = B.cat ? v : Math.round(v * 4);
    let col = colours.get(ck); if (col === undefined) { const c = balloonColor(m, v); col = c ? css(c) : null; colours.set(ck, col); }
    if (col) { g.col = col; out.push(g); }
  }
  out.sort((p, q) => q.q - p.q);
  P = out; B.levels.set(key, P);
  if (B.levels.size > 12) B.levels.delete(B.levels.keys().next().value);
  return P;
}
let balOld = null; // the reading or election just left, fading as this one comes up
function paintBalloons(m, list, alpha, grow, s0) {
  const s = s0 * grow, ring = css(TH.bg, 0.6), sd = selDiv(), b = m.booth;
  let last = null, cut = null;
  ctx.lineWidth = 0.7;
  for (const g of list) {
    const r = Math.min(BAL_MAX, Math.max(0.6, g.q * s)), x = g.x * T.k + T.x, y = g.y * T.k + T.y;
    if (x < -r || y < -r || x > Wpx + r || y > Hpx + r) continue;
    const a = 0.88 * alpha * (sd != null && b.d[g.ids[0]] !== sd ? 0.35 : 1);
    if (a !== cut) { ctx.globalAlpha = a; cut = a; }
    if (g.col !== last) { ctx.fillStyle = g.col; last = g.col; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (r > 2) { ctx.strokeStyle = ring; ctx.stroke(); }
  }
}
// the level for this zoom: held until the zoom has gone well past it, so a level is never
// half-shown at rest, and a change of level is a short crossfade in time, not a stretch of zoom
const balLvl = { L: null, from: null, t0: 0 };
function balloonLevelNow() {
  const l = Math.log2(BAL_CELL / T.k);
  if (balLvl.L == null) { balLvl.L = Math.round(l); return; }
  if (Math.abs(l - balLvl.L) > 0.62) { const to = Math.round(l); balLvl.from = balLvl.L; balLvl.L = to; balLvl.t0 = performance.now(); }
}
function drawBalloons(m, ball) {
  const B = balloonSet(m), th = TH, s = balScale();
  balloonLevelNow();
  const n = balLvl.L;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let e = 1;
  if (balOld) {
    const t = clamp((performance.now() - balOld.t0) / 380, 0, 1); e = ease(t);
    if (t >= 1) balOld = null;
    else {
      needFrame = true;
      const O = balOld;
      if (O.A) withT(viaFrame(T, O.A), () => paintBalloons(O.m, balloonLevel(O.m, O.B, n), 1 - e, 1, s));
    }
  }
  const a = e * Math.min(1, ball * 1.4), grow = 0.4 + 0.6 * ball, now = balloonLevel(m, B, n);
  let w = 1;
  if (balLvl.from != null) {
    w = reduceMotion ? 1 : clamp((performance.now() - balLvl.t0) / 220, 0, 1);
    if (w >= 1) balLvl.from = null; else { needFrame = true; paintBalloons(m, balloonLevel(m, B, balLvl.from), a * (1 - ease(w)), grow, s); }
  }
  paintBalloons(m, now, a * ease(w), grow, s);
  m._balNow = now;
  ctx.globalAlpha = 1;
  const ringAt = (x, y, r, wd, col) => { ctx.beginPath(); ctx.arc(x * T.k + T.x, y * T.k + T.y, r, 0, 6.2832); ctx.lineWidth = wd; ctx.strokeStyle = css(col); ctx.stroke(); };
  const rOf = (g) => Math.min(BAL_MAX, Math.max(0.6, g.q * s)) + 1.6;
  const h = S.hover;
  if (h && h.kind === "bal" && h.g) ringAt(h.g.x, h.g.y, rOf(h.g), 1.6, th.ink);
  if (h && h.kind === "booth" && now) { const g = now.find((q) => q.n === 1 && q.ids[0] === h.i); if (g) ringAt(g.x, g.y, rOf(g), 1.6, th.ink); }
  if (S.sel.level === "booth" && now) { const g = now.find((q) => q.n === 1 && q.ids[0] === S.sel.booth); if (g) ringAt(g.x, g.y, rOf(g), 2.4, th.ink); }
  ctx.restore();
}
// the smallest balloon under the pointer: small ones lie on top
function balloonHit(m, px, py) {
  const list = m._balNow; if (!list) return null;
  const s = balScale();
  for (let k = list.length - 1; k >= 0; k--) {
    const g = list[k], r = Math.max(3, Math.min(BAL_MAX, g.q * s)), dx = px - (g.x * T.k + T.x), dy = py - (g.y * T.k + T.y);
    if (dx * dx + dy * dy <= r * r) return g.n === 1 ? { kind: "booth", i: g.ids[0] } : { kind: "bal", i: g.ids[0], g };
  }
  return null;
}
// a shared balloon in the tooltip: what its places come to together, and which seats they're in
function balloonTip(m, g) {
  const b = m.booth, seats = new Map();
  for (const j of g.ids) { const d = b.d[j]; seats.set(d, (seats.get(d) || 0) + b.formal[j]); }
  const top = [...seats].sort((p, q) => q[1] - p[1]).map(([d]) => ds(m.divs[d].n)), more = top.length - 2;
  const where = more > 0 ? `${top[0]}, ${top[1]} and ${more} other ${more === 1 ? "seat" : "seats"}` : top.join(" and ");
  const read = S.lens === "winner" ? `${FAM_NAME[g.top]} ahead by ${int(g.size)} votes` : S.lens === "cls" ? valueText(g.top, "div", { m, d: null }) : valueText(g.val, "div", { m, d: null });
  const size = S.lens === "winner" ? "" : ` · ${balloonWord(m)}: ${int(g.size)}`;
  return `<div class="tn">${int(g.n)} polling places</div><div class="tv">${esc(read)}</div><div class="ts">${where}${size}</div><div class="ts">Click to part them</div>`;
}
// zoom in on a shared balloon until it comes apart
function goBalloon(g) {
  const pad = 0.15 * Math.max(g.x1 - g.x0, g.y1 - g.y0, 0.6);
  const t = fitTransform([[g.x0 - pad, g.y0 - pad], [g.x1 + pad, g.y1 + pad]]);
  fly(t.k > T.k * 1.5 ? t : d3.zoomIdentity.translate(Wpx / 2 - g.x * T.k * 2.2, Hpx / 2 - g.y * T.k * 2.2).scale(T.k * 2.2), reduceMotion ? 0 : 700, () => {});
}
// the election being left, when the map changes year under the balloons
function balloonsLeave(a, b) {
  if (reduceMotion || !a || !a._bal || drawOf(b) !== "balloons") { balOld = null; return; }
  balOld = { m: a, B: a._bal, t0: performance.now(), A: jurOf(a.year) === jurOf(b.year) ? frameMap(a, b) : null };
}

// what a built contest stands on, for the key and the story
const axisByBonham = (m, pair) => m.year === "sa26" && pair === "AO";
function axisHow(m, pair, idx) {
  if (axisByBonham(m, pair)) return "splits other parties’ votes by estimates of how they flowed at this election";
  return `splits other parties’ votes by how ${STATE_YEARS.has(m.year) ? `${STATE_POSS[m.divs[idx[0]].st]} voters` : "their voters"} ranked the two on the Senate ballot`;
}

/* ----- the story of a built contest -----
   Every line says what the figure is: no election ran this contest but in the seats that
   drew it, so nothing here reads as a result. */
function axisHedDek(m, idx, where) {
  const pair = axisNow(m), [a, b] = axisNames(pair), [Ac, Bc] = axisCap(pair), A = axisOf(m), v = axisArea(m, idx), B = m.booth;
  if (!A || v == null) return { hed: `${Ac} and ${b} didn’t both stand${where}`, dek: "So this contest can’t be built here." };
  const lead = v >= 50, hi = Math.max(v, 100 - v);
  let n = 0, k = 0, finals = 0;
  for (const i of idx) { const d = m.divs[i]; if ([d.A.b, d.B.b].includes(SP_PAIRS[pair][0]) && [d.A.b, d.B.b].includes(SP_PAIRS[pair][1])) finals++; for (const j of B.byDiv[i]) { const x = A.v[j]; if (Number.isNaN(x)) continue; n++; if ((x >= 50) !== lead) k++; } }
  const hed = `${lead ? Ac : Bc} would lead ${lead ? b : a} ${f1(hi)} to ${f1(100 - hi)}${where}`;
  const other = lead ? b : a, pct = (100 * k) / n;
  const places = k === 0 ? `${cap(other)} would lead at no polling place.` : pct < 1 ? `${cap(other)} would lead at only ${int(k)} of ${int(n)} polling places.` : `${cap(other)} would lead at ${f0(pct)}% of polling places.`;
  const seen = finals ? ` ${cap(words(finals))} ${finals === 1 ? "seat" : "seats"} really had this final two, and ${finals === 1 ? "its" : "their"} own ${finals === 1 ? "count stands" : "counts stand"}.` : "";
  return { hed, dek: `That’s an estimate, not a result: this contest never ran${where}. It takes each polling place’s first preferences and ${axisHow(m, pair, idx)}. ${places}${seen}` };
}
function axisSeatHedDek(m, d) {
  const pair = axisNow(m), [fa, fb] = SP_PAIRS[pair], [a, b] = axisNames(pair), [Ac, Bc] = axisCap(pair), A = axisOf(m), v = A && !A.seatSkip[d.i] ? axisArea(m, [d.i]) : null;
  if (v == null) return { hed: `${Ac} and ${b} didn’t both stand in ${ds(d.n)}`, dek: "So this contest can’t be built here." };
  const lead = v >= 50, hi = Math.max(v, 100 - v), real = [d.A.b, d.B.b].includes(fa) && [d.A.b, d.B.b].includes(fb);
  if (real) return { hed: `${lead ? Ac : Bc} won ${f1(hi)}% against ${lead ? b : a} in ${ds(d.n)}`, dek: "This seat’s final two really were these two, so that’s its count at the polling places." };
  return { hed: `${lead ? Ac : Bc} would lead ${lead ? b : a} ${f1(hi)} to ${f1(100 - hi)} in ${ds(d.n)}`, dek: `That’s an estimate, not a result: the seat’s final two were ${ds(d.A.n)} and ${ds(d.B.n)}. It takes the polling places’ first preferences and ${axisHow(m, pair, [d.i])}.` };
}

/* ----- the key's own lines ----- */
// what the size of a balloon counts
function balloonWord(m) {
  const two = axisNow(m) !== "AC";
  switch (S.lens) {
    case "winner": return "Lead, votes";
    case "tpp": return S.tppMode === "swing" ? "Votes that moved" : two ? "Estimated lead, votes" : "Two-party lead, votes";
    case "fp": return S.fpMode === "change" ? "Votes gained or lost" : `Votes for ${FAM_PL[S.party]}`;
    case "senate": return senGap() ? "Votes between Senate and House" : `Senate votes for ${FAM_PL[S.party]}`;
    case "flow": return "Preferences to split";
    case "senpref": return "Ballots ranking either";
    case "informal": return infModeOf(m) === "exhaust" ? "Ballots exhausted" : "Informal votes";
    default: return "Votes cast";
  }
}
function balloonKey(m, est) {
  const s = balScale(), nice = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  const big = nice.filter((v) => Math.sqrt(v) * s <= 9.5).pop() || 50, list = [big, nice[Math.max(0, nice.indexOf(big) - 2)], nice[Math.max(0, nice.indexOf(big) - 4)]].filter((v, k, a) => a.indexOf(v) === k);
  const R = Math.sqrt(big) * s, H = Math.ceil(2 * R + 2);
  let x = 0, circles = "", labels = "";
  for (const v of list) { const r = Math.max(0.8, Math.sqrt(v) * s); circles += `<circle cx="${(x + r + 1).toFixed(1)}" cy="${(H - 1 - r).toFixed(1)}" r="${r.toFixed(1)}"/>`; x += 2 * r + 2; labels += `${labels ? ", " : ""}${int(v)}`; }
  return `<div class="lg-bal"><svg width="${Math.ceil(x + 2)}" height="${H}" viewBox="0 0 ${Math.ceil(x + 2)} ${H}" aria-hidden="true">${circles}</svg><span>${est && (S.lens === "winner" || S.lens === "tpp") ? "Estimated lead, votes" : balloonWord(m)}: ${labels}</span></div>`;
}
/* each drawing, and why this frame and lens can't draw it where they can't — one
   list for the strip's Draw chips and the phone panel's Draw menu */
function drawOpts(m) {
  const fits = surfaceFits(m);
  const areasNo = areasFits(m) ? "" : S.lens !== "seifa" ? "Areas paints the census’s own areas — pick the Census lens" : S.index === "hl" ? "The homeless lane stays as seats: the census counts that one per SA2 estimate, never as a share of every census area" : "No census-areas pack reads this frame’s census yet";
  return DRAWS.map(([k, t]) => ({ k, t, why: k === "chart" && !chartFits(m) ? "Chart plots a figure: pick Two-party, Primary, Census or another lens with numbers"
    : k === "surface" && !fits ? (S.lens === "cls" ? "A seat type belongs to the whole seat, so there is nothing to blend" : "This is a whole seat’s figure, so there is nothing to blend")
    : k === "areas" && areasNo ? areasNo : "" }));
}
function drawRowHTML(m) {
  const on = S.draw;
  return `<div class="lg-draw" role="group" aria-label="Draw the map as"><span>Draw</span>${drawOpts(m).map(({ k, t, why }) => `<button type="button" data-draw="${k}" aria-pressed="${on === k && !why}"${why ? ` disabled title="${why}"` : ""}><span class="tw" data-t="${t}">${t}</span></button>`).join("")}</div>`;
}
/* ----- what the balloons and the surface leave out -----
   Postal, absent and declaration votes are counted by seat, not at a place, so neither
   drawing has anywhere to put them; nor have the places with no spot (balloonPlace). The key
   says how many votes that is in the place chosen and, where the balloons read the two-party
   lead, which way they went. That lead is each seat's count less the lead its balloons draw,
   so the key and the balloons add up exactly to the real result. A seat with a drawn place
   that has no two-party figure (some of 1998's) leaves it unsaid. */
function undrawnBySeat(m) {
  if (m._undrawn) return m._undrawn;
  const b = m.booth, N = m.divs.length, off = new Float64Array(N), drawn = new Float64Array(N), gap = new Uint8Array(N);
  for (let j = 0; j < b.n; j++) {
    const i = b.d[j], t = b.raw && b.raw.tpp && b.raw.tpp[j];
    if (!balloonPlace(b, j)) off[i] += b.formal[j] || 0;
    else if (t) drawn[i] += t[0] - t[1];
    else gap[i] = 1;
  }
  return (m._undrawn = m.divs.map((d, i) => {
    const v = d.vt, r = m.res.divs[i];
    if (!v) return null;
    return { n: (v.pre || 0) + (v.post || 0) + (v.abs || 0) + (v.prov || 0) + off[i], lead: r && r.tpp && !gap[i] ? r.tpp[0] - r.tpp[1] - drawn[i] : null };
  }));
}
function undrawnOf(m) {
  const by = undrawnBySeat(m), sd = selDiv(), st = S.sel.level === "state" ? S.sel.st : null;
  let n = 0, lead = 0;
  for (let i = 0; i < by.length; i++) {
    if (!by[i] || (sd != null ? i !== sd : st && m.divs[i].st !== st)) continue;
    n += by[i].n; lead = lead == null || by[i].lead == null ? null : lead + by[i].lead;
  }
  return n ? { n, lead } : null;
}
// to three figures, which is all the key needs: 3.2m, 242,000, 21,300
function roughly(v) {
  if (v >= 999500) return `${(v / 1e6).toFixed(1)}m`;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 2);
  return int(Math.round(v / p) * p);
}
function undrawnHTML(m, est) {
  if (STATE_YEARS.has(m.year)) return "";
  // an election not yet loaded holds the room for its line
  const u = m.standIn ? { n: 3.2e6, lead: -242000 } : undrawnOf(m);
  if (!u) return "";
  const led = S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC" && !est && u.lead != null;
  const lead = !led ? "" : Math.abs(u.lead) < 0.5 ? ", level" : `, ${u.lead > 0 ? "Labor" : "Coalition"} by ${roughly(Math.abs(u.lead))}`;
  return `<div class="lg-undrawn">Not drawn: ${roughly(u.n)} postal and other votes${lead}</div>`;
}
// the note under the drawing's name: what the picture is, and for a built contest what it stands on
function drawNoteHTML(m) {
  const d = drawOf(m);
  if (d === "seats") return "";
  const est = !m.standIn && placesLackMemo(m);
  if (d === "balloons") return balloonKey(m, est) + undrawnHTML(m, est);
  if (d === "areas") {
    const vin = areasVintage(m), got = AR.packs[vin] && AR.packs[vin].pack, near = m.demoInterp && m.demoInterp.nearestSide === vin;
    return `<div class="lg-note">${got ? `The census’s ${int(got.geoms.length)} census areas, each as counted at the ${vin} census${near ? ` — the nearest single census, ${vin}, since this frame blends two` : ""}. Empty land stays paper, and so does any area the ABS suppresses a figure for.` : "Loading the census areas…"}</div>`;
  }
  if (axisNow(m) !== "AC") return `<div class="lg-note">Built from first preferences and ${axisByBonham(m, axisNow(m)) ? "estimated flows" : "Senate ballots"}.</div>${undrawnHTML(m, est)}`;
  const off = S.axis !== "AC" && S.lens === "tpp" && S.tppMode !== "swing" && axisFrame(m) == null;
  return `<div class="lg-note">${off ? "One Nation stood too thinly here for its contests." : est ? "Smoothed, from first preferences: an estimate." : S.lens === "winner" ? "A smoothed estimate. Deeper means a bigger lead." : "A smoothed estimate, not a count."}</div>${undrawnHTML(m, est)}`;
}
// the key's ramp in the surface's steps
function surfaceRampCss(m) {
  const sc = surfaceScale(m), R = RANGE(); if (!sc || !R) return null;
  const rev = S.lens === "tpp" || S.lens === "flow" || S.lens === "senpref", [lo, hi] = R, e = sc.edges, st = [];
  const pos = (v) => { const t = (100 * (clamp(v, lo, hi) - lo)) / (hi - lo); return rev ? 100 - t : t; };
  for (let k = 0; k <= e.length; k++) {
    const a = k === 0 ? lo : e[k - 1], b = k === e.length ? hi : e[k];
    if (b <= lo || a >= hi) continue;
    const c = colorOf(bandMid(sc, k)); if (!c) continue;
    st.push([pos(a), pos(b), css(c)]);
  }
  if (rev) st.reverse();
  return `linear-gradient(90deg, ${st.map(([p, q, c]) => `${c} ${Math.min(p, q).toFixed(2)}%, ${c} ${Math.max(p, q).toFixed(2)}%`).join(",")})`;
}

/* =============================== the chart drawing ===============================
   Chart sets the map aside and draws the seats themselves, each a dot placed by its figures
   instead of its ground. Hover, click and the chosen seat work as they do on the map, and
   with the chart focused the arrow keys walk the seats. What it plots follows the lens:
     Census     each seat's census figure (across) against Labor's two-party share (up),
                coloured by who won or holds it, with the least-squares line and its 95%
                confidence band. "By seat type" draws the AEC's four seat types apart,
                since much of a census pattern runs between city and country seats
     Two-party  the seats stacked along their share, a histogram whose blocks are seats; or,
                under "How votes were cast", the closest seats' on-the-day share against their
                final count, or every seat's postal or early-centre share against its
                on-the-day share
     the rest   the seats stacked along the lens's own figure
   Every head is written by rule. A census head claims a correlation only when a permutation
   test finds one: every seat is counted, not sampled, so the question is whether the seats'
   two-party shares, shuffled at random among them, would correlate as strongly with the
   census figure. (A shuffle leaves both spreads alone, so testing the slope and testing
   Pearson's r are one test.) The map beneath keeps drawing seats (drawOf), so nothing the
   other drawings hold is disturbed by a chart. */
const CH = { tpp: "spread", vs: "final", split: false, el: null, key: "", statKey: "", c: null, pts: [], hot: -1, focus: -1 };
const CH_FAMS = ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"];
const CH_NICE = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const CH_NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const CH_R = 2000; // shuffles per test: p resolves to 1 in 2,001
const CH_ALPHA = 0.05;
const CH_VS = { final: ["Final count", "Labor 2PP, final count"], post: ["Postal", "Labor 2PP, postal votes"], ppvc: ["Early centres", "Labor 2PP, early centres"] };
const chartFits = (m) => !!m && m.house !== "senate" && lensNumeric();
const chartOn = (m) => S.view === "map" && S.draw === "chart" && chartFits(m);
const chNum = (n) => (n < CH_NUM.length ? CH_NUM[n] : String(n));
const chList = (a, w = "and") => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} ${w} ${a[a.length - 1]}`);
const chMedian = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
// a quantile by linear interpolation between order statistics (type 7, R's default)
const chQ = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo]); };
const chShare = (p) => (p && p[0] + p[1] > 0 ? (100 * p[0]) / (p[0] + p[1]) : null);
const chAdd = (...ps) => ps.reduce((t, p) => (p ? [t[0] + p[0], t[1] + p[1]] : t), [0, 0]);
const chR2 = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
const chHeld = (m) => (isNowY(m.year) ? "holds" : "won");
const chPlace = (m) => (STATE_YEARS.has(m.year) ? stNameCap(m.year) : "Australia");
const chShuffled = (p) => (p < 0.001 ? "fewer than 1 time in 1,000" : p < 0.01 ? "under 1% of the time" : `${Math.round(p * 100)}% of the time`);

function chartEl() {
  if (CH.el) return CH.el;
  const el = document.createElement("div");
  el.className = "mp-chart"; el.id = "chartv"; el.hidden = true;
  $("#stage").appendChild(el);
  el.addEventListener("click", chartClick);
  el.addEventListener("pointermove", chartMove);
  el.addEventListener("pointerleave", () => { if (CH.focus < 0) chHover(null); });
  el.addEventListener("keydown", chartKey);
  el.addEventListener("focusout", (e) => { if (!el.contains(e.relatedTarget)) { CH.focus = -1; chHover(null); } });
  new ResizeObserver(() => { CH.key = ""; chartTick(); }).observe(el);
  CH.el = el;
  return el;
}
// the chart's presence, set before the key is measured: the key hides the map's colour
// scale under a chart, so a key measured a frame early would hold the wrong height. It sits
// on the page's root, since full screen parks the key and the zoom plate outside the figure
function chartSync(m) {
  const on = !!m && chartOn(m), v = document.documentElement;
  if (v.classList.contains("ch-on") !== on) v.classList.toggle("ch-on", on);
  return on;
}
// called at the top of every map frame: shows or hides the chart, and redraws it when
// anything it reads has changed (the statistics only when the figures have)
function chartTick() {
  const m = M(), on = chartSync(m), el = chartEl();
  if (el.hidden === on) { el.hidden = !on; updateCanvasVis(); if (!on) chHover(null); }
  if (!on) { CH.key = ""; return; }
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return;
  const statKey = [legendState(), filtersKey(), CH.tpp, CH.vs, CH.split, W < 520].join("|");
  const key = [statKey, selDiv(), W, H].join("|");
  if (key === CH.key) return;
  CH.key = key;
  renderChart(m, statKey);
}

/* ----- the statistics: least squares, Student's t and the shuffle test ----- */
function chOls(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let k = 0; k < n; k++) { mx += xs[k]; my += ys[k]; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx, dy = ys[k] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const b = sxx > 0 ? sxy / sxx : 0, s2 = n > 2 ? Math.max(0, syy - b * sxy) / (n - 2) : 0;
  return { n, a: my - b * mx, b, mx, my, sxx, s2, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0 };
}
function chSlope(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let k = 0; k < n; k++) { mx += xs[k]; my += ys[k]; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx; sxx += dx * dx; sxy += dx * (ys[k] - my); }
  return sxx > 0 ? sxy / sxx : 0;
}
// Student's t, two-sided 95%: the Cornish–Fisher series (within 0.001 from 5 degrees of freedom)
function chT95(df) {
  const z = 1.959964, z3 = z ** 3, z5 = z ** 5, z7 = z ** 7, z9 = z ** 9;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3)
    + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4);
}
function chRng(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
// the share of shuffles (within groups, when given) whose slope is at least as steep either
// way: a seeded shuffle, so a reading never flickers between visits
function chPerm(xs, ys, groups, R = CH_R) {
  const n = xs.length, obs = Math.abs(chSlope(xs, ys)), rnd = chRng(n * 7919 + 17), y = ys.slice();
  const keys = groups ? [...new Set(groups)] : [0];
  const idx = keys.map((g) => ys.map((_, k) => k).filter((k) => !groups || groups[k] === g));
  let hit = 0;
  for (let t = 0; t < R; t++) {
    for (const I of idx) for (let a = I.length - 1; a > 0; a--) { const b = Math.floor(rnd() * (a + 1)), p = I[a], q = I[b], tmp = y[p]; y[p] = y[q]; y[q] = tmp; }
    if (Math.abs(chSlope(xs, y)) >= obs - 1e-12) hit++;
  }
  return (hit + 1) / (R + 1);
}
// the slope within seat types: each seat's figures less its type's averages, so the slope is
// the one left once the types' own levels are set aside; the shuffle stays within type
function chWithin(xs, ys, groups) {
  const mean = new Map();
  groups.forEach((g, k) => { const t = mean.get(g) || [0, 0, 0]; t[0] += xs[k]; t[1] += ys[k]; t[2]++; mean.set(g, t); });
  const dx = xs.map((x, k) => { const t = mean.get(groups[k]); return x - t[0] / t[2]; });
  const dy = ys.map((y, k) => { const t = mean.get(groups[k]); return y - t[1] / t[2]; });
  const f = chOls(dx, dy);
  return { b: f.b, p: chPerm(dx, ys, groups) };
}
// a round step near the seats' interquartile range, for "per 5 years" and the like
function chStep(xs) {
  const iqr = Math.max(1e-9, chQ(xs, 0.75) - chQ(xs, 0.25));
  return CH_NICE.reduce((best, v) => (Math.abs(Math.log(v / iqr)) < Math.abs(Math.log(best / iqr)) ? v : best), 1);
}

/* ----- the national figure, the one the key's "The line marks …" names ----- */
function chCensusNat(m) {
  const aus = m.areas && m.areas.AUS;
  if (!aus || !aus.demo || (m.year !== "now" && m.year < DEMO_FROM) || !isDemo()) return null;
  if (isAge()) {
    if (S.ageMode === "med") return nn(m.ageCuts && m.ageCuts.medAge);
    // the ageCuts record keeps its shares as fractions
    if (["a1824", "a3554", "a75"].includes(S.ageMode)) { const v = m.ageCuts && m.ageCuts[S.ageMode]; return v == null ? null : v <= 1 ? 100 * v : v; }
  }
  if (incMed()) return nn(m.incomeCuts && m.incomeCuts.medWeekly);
  return nn(demoAreaShare(aus.demo));
}
function chNational(m) {
  const aus = m.areas && m.areas.AUS;
  if (!aus) return null;
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? nn(aus.tppSw) : axisNow(m) === "AC" ? nn(aus.tpp) : null;
    case "fp": return S.fpMode === "change" ? nn(aus.fpSw && aus.fpSw[S.party]) : nn(aus.fp && aus.fp[S.party]);
    case "senate": { if (svYear(m.year) == null) return null; const A = senArea(m, aus.idx, S.party); return A ? nn(senGap() ? A.gap : A.sen) : null; }
    case "senpref": { if (spYear(m.year) == null) return null; const A = spArea(m, aus.idx); return A ? nn(A.share) : null; }
    case "informal": return infModeOf(m) === "exhaust" ? nn(aus.exhPct) : nn(aus.infPct);
    case "seifa": return chCensusNat(m);
  }
  return null;
}

/* ----- what the census chart reads across, and how its copy names it ----- */
function chCensusX(m) {
  if (!isDemo()) {
    const nm = IX_NAME[S.index].toLowerCase();
    return {
      get: (d) => { const s = d.seifa && d.seifa[S.index]; return !s ? null : s.pct != null ? 100 * s.pct : s.dec != null ? 10 * s.dec - 5 : null; },
      axis: `Rank among the seats on ${nm}, percentile (0 = least advantaged)`, axisShort: `${IX_NAME[S.index]} rank, percentile`, short: "Rank", fmt: f0, step: 10,
      per: () => `per tenth of the seats further up the ${nm} ranking`, unit: () => "tenth", noun: `the seats’ ${nm} ranking`,
    };
  }
  if (ageMed()) return { get: (d) => divValue(m, d.i), axis: "Median age, years", short: "Median age", fmt: (v) => String(Math.round(v)), per: (s) => `per ${s}-year difference in median age`, unit: (s) => `${s} years`, noun: "median age", jitter: 0.32 };
  if (incMed()) return { get: (d) => divValue(m, d.i), axis: "Median weekly household income", short: "Median income", fmt: mny, per: (s) => `per ${mny(s)}-a-week difference in median household income`, unit: (s) => `${mny(s)} a week`, noun: "median household income" };
  const w = censusWho(m);
  return { get: (d) => divValue(m, d.i), axis: `${lensShort()}, % of ${w.pop}`, short: lensShort(), fmt: (v) => (v < 10 ? f1(v) : f0(v)), per: (s) => `per ${s}-point difference in the share of ${w.phrase}`, unit: (s) => `${s} points`, noun: `the share of ${w.phrase}` };
}

/* ----- the frame: head, controls, plot, note ----- */
function renderChart(m, statKey) {
  const el = CH.el, refocus = el.contains(document.activeElement) && document.activeElement.classList.contains("ch-plot");
  if (statKey !== CH.statKey || !CH.c) {
    CH.statKey = statKey;
    const census = S.lens === "seifa";
    const castOK = S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC" && m.res && m.res.divs.some((d) => d.vt2);
    const cast = castOK && CH.tpp === "cast";
    const c = census ? chartCensus(m) : cast ? chartCast(m) : chartDots(m);
    let ctl = c.ctl || "";
    if (castOK) ctl = `<div class="lg-draw ch-ctl" role="group" aria-label="What the chart shows"><span>Show</span><button type="button" data-chtpp="spread" aria-pressed="${!cast}">Seats’ spread</button><button type="button" data-chtpp="cast" aria-pressed="${cast}">How votes were cast</button></div>${ctl}`;
    el.innerHTML = `<div class="ch-head"><div class="ch-hed">${esc(c.head)}</div>${c.dek ? `<p class="ch-dek">${esc(c.dek)}</p>` : ""}<div class="ch-bar">${ctl}${chKey(c.fams || [], c.keyExtra)}</div></div><div class="ch-plot" tabindex="0" role="group" aria-roledescription="chart" aria-label="${esc(`${c.head}. Arrow keys move between the seats; Enter opens one.`)}"></div>${c.notes ? (el.clientWidth < 520 ? `<details class="ch-note ch-fold"><summary>About this chart</summary><span class="ch-ntext">${esc(c.notes)}</span></details>` : `<p class="ch-note"><span class="ch-ntext">${esc(c.notes)}</span></p>`) : ""}<p class="ch-live" aria-live="polite"></p>`;
    CH.c = c;
  }
  const plot = $(".ch-plot", el), w = plot.clientWidth, h = plot.clientHeight;
  CH.hot = -1;
  if (w < 60 || h < 60) { CH.pts = []; plot.innerHTML = ""; return; }
  const out = CH.c.draw(w, h);
  plot.innerHTML = out.svg;
  CH.pts = out.pts;
  if (refocus) plot.focus({ preventScroll: true });
  if (CH.focus >= 0) { const k = CH.pts.findIndex((p) => p.i === CH.focus); if (k >= 0) chHover(CH.pts[k], true); else CH.focus = -1; }
}
function chKey(fams, extra = "") {
  if (!fams.length && !extra) return "";
  return `<span class="ch-key">${CH_FAMS.filter((f) => fams.includes(f)).map((f) => `<span><i style="background:var(--m-${f})"></i>${FAM_NAME[f]}</span>`).join("")}${extra}</span>`;
}

/* ----- the parts of a plot ----- */
function chScale(d0, d1, r0, r1) { const k = (r1 - r0) / (d1 - d0 || 1); return (v) => r0 + (v - d0) * k; }
function chAxes(o) {
  const { X, Y, x0, x1, y0, y1, xt, yt, xfmt, yfmt, xlab, ylab, ylabs = true, xlabs = true } = o;
  let s = `<g class="ch-grid">`;
  for (const v of yt) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`;
  s += `</g><g class="ch-tick">`;
  if (ylabs) for (const v of yt) s += `<text x="${x0 - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(yfmt(v))}</text>`;
  if (xlabs) for (const v of xt) s += `<text x="${X(v).toFixed(1)}" y="${y1 + 15}" text-anchor="middle">${esc(xfmt(v))}</text>`;
  s += `</g><line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`;
  if (xlab) s += `<text class="ch-lab" x="${x1}" y="${y1 + 31}" text-anchor="end">${esc(xlab)}</text>`;
  if (ylab) s += `<text class="ch-lab" x="2" y="${y0 - 9}">${esc(ylab)}</text>`;
  return s;
}
// the national figure, upright, named at its top
function chNatLine(x, y0, y1, label, x0, x1) {
  if (x == null || x < x0 - 0.5 || x > x1 + 0.5) return "";
  const right = x < x1 - 70;
  return `<line class="ch-nat" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y0}" y2="${y1}"/>${label ? `<text class="ch-natlab" x="${(x + (right ? 4 : -4)).toFixed(1)}" y="${y0 + 10}" text-anchor="${right ? "start" : "end"}">${esc(label)}</text>` : ""}`;
}
function chDot(p, r) {
  const cls = `ch-dot${p.pass ? "" : " ch-off"}${p.hollow ? " ch-hollow" : ""}`;
  return p.hollow
    ? `<circle class="${cls}" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${(r - 0.6).toFixed(1)}" style="stroke:var(--m-${p.fam})"/>`
    : `<circle class="${cls}" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${r.toFixed(1)}" style="fill:var(--m-${p.fam})"/>`;
}
function chLabel(p, txt, x1, r) {
  const right = p.sx < x1 - 90;
  return `<text class="ch-name" x="${(p.sx + (right ? r + 4 : -r - 4)).toFixed(1)}" y="${(p.sy + 4).toFixed(1)}" text-anchor="${right ? "start" : "end"}">${esc(txt)}</text>`;
}
const chSelRing = (p, r) => `<circle class="ch-sel" cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="${(r + 3.5).toFixed(1)}"/>`;
const chHovRing = () => `<circle class="ch-hov" cx="0" cy="0" r="0"/>`;
// the least-squares line and its 95% confidence band, drawn over the seats' own range;
// dashed when the correlation isn't significant
function chFit(f, X, Y, lo, hi, sig) {
  const t = chT95(Math.max(1, f.n - 2)), n = 24, top = [], bot = [];
  for (let k = 0; k <= n; k++) {
    const x = lo + ((hi - lo) * k) / n, y = f.a + f.b * x, e = t * Math.sqrt(f.s2 * (1 / f.n + ((x - f.mx) ** 2) / f.sxx));
    top.push(`${X(x).toFixed(1)},${Y(y + e).toFixed(1)}`); bot.unshift(`${X(x).toFixed(1)},${Y(y - e).toFixed(1)}`);
  }
  return `<polygon class="ch-band" points="${top.join(" ")} ${bot.join(" ")}"/><line class="ch-fit${sig ? "" : " ch-fit-weak"}" x1="${X(lo).toFixed(1)}" y1="${Y(f.a + f.b * lo).toFixed(1)}" x2="${X(hi).toFixed(1)}" y2="${Y(f.a + f.b * hi).toFixed(1)}"/>`;
}
function chSeatTip(m, i, rows) {
  const d = m.divs[i];
  return `<div class="tn">${ds(d.n)}<span>${STATE_SHORT[d.st]}${d.cls ? ` · ${esc(CLS_SHORT[d.cls])}` : ""}</span></div>${rows.map((r, k) => `<div class="${k ? "ts" : "tv"}">${esc(r)}</div>`).join("")}<div class="ts">${esc(ds(d.hold.n))} (${esc(FAM_NAME[holdFam(d.hold)])}) ${chHeld(m)} it</div>`;
}

/* ----- Census: the seats' census figure against Labor's two-party share ----- */
function chartCensus(m) {
  const X = chCensusX(m), fed = !STATE_YEARS.has(m.year), nat = chCensusNat(m);
  const all = [];
  m.divs.forEach((d, i) => {
    const x = X.get(d), y = nn(d.tpp);
    if (x == null || y == null) return;
    const jit = X.jitter ? (chRng(d.i * 131 + 7)() - 0.5) * 2 * X.jitter : 0;
    all.push({ i, x, xj: x + jit, y, fam: holdFam(d.hold), cls: d.cls, pass: passes(m, i) });
  });
  const inn = all.filter((p) => p.pass);
  const fams = [...new Set(all.map((p) => p.fam))];
  const canSplit = fed && all.length > 0 && all.every((p) => p.cls);
  const split = canSplit && CH.split;
  const ctl = canSplit ? `<div class="lg-draw ch-ctl" role="group" aria-label="Split the seats"><span>Seats</span><button type="button" data-chsplit="0" aria-pressed="${!split}">All together</button><button type="button" data-chsplit="1" aria-pressed="${split}">By seat type</button></div>` : "";
  let head, dek = "", f = null, step = 1, notes = "";
  // the seat types' own slopes, for the dek and the split panels alike (one shuffle each)
  const perType = new Map();
  const typeFit = (c) => {
    if (!perType.has(c)) {
      const q = inn.filter((p) => p.cls === c);
      if (q.length < 12) perType.set(c, null);
      else { const qx = q.map((p) => p.x), qy = q.map((p) => p.y), o = chOls(qx, qy); o.p = chPerm(qx, qy); perType.set(c, o); }
    }
    return perType.get(c);
  };
  if (!all.length) head = `No census figures for this measure at this election`;
  else if (inn.length < 8) head = `Too few seats in view to test a correlation`;
  else {
    const xs = inn.map((p) => p.x), ys = inn.map((p) => p.y);
    f = chOls(xs, ys);
    f.p = chPerm(xs, ys);
    step = X.step || chStep(xs);
    const eff = f.b * step, sig = f.p < CH_ALPHA;
    head = sig
      ? `Labor’s two-party share averages ${f1(Math.abs(eff))} points ${eff < 0 ? "lower" : "higher"} ${X.per(step)}`
      : `No significant correlation between ${X.noun} and Labor’s two-party share`;
    dek = sig ? `Correlation across the ${inn.length} seats: ${chR2(f.r)}.` : `Correlation across the ${inn.length} seats: ${chR2(f.r)}, matched or beaten by random shufflings of the seats ${chShuffled(f.p)}.`;
    if (sig && canSplit && inn.length >= 30) {
      const w = chWithin(xs, ys, inn.map((p) => p.cls)), ratio = w.b / f.b, weff = Math.abs(w.b * step);
      const per = CLS.map((c) => ({ c, o: typeFit(c) })).filter((t) => t.o);
      const nm = (t) => CLS_SHORT[t.c].toLowerCase();
      const part = (ts, word) => (ts.length ? `${chList(ts.map((t, k) => `${f1(Math.abs(t.o.b * step))}${k ? "" : " points"} ${word} in ${nm(t)}`))} seats` : "");
      const sigT = per.filter((t) => t.o.p < CH_ALPHA), flat = per.filter((t) => t.o.p >= CH_ALPHA);
      const types = [part(sigT.filter((t) => t.o.b < 0), "lower"), part(sigT.filter((t) => t.o.b > 0), "higher"), flat.length ? `no significant correlation in ${chList(flat.map(nm), "or")} seats` : ""].filter(Boolean).join("; ");
      const byType = sigT.length ? ` By type, per ${X.unit(step)}: ${types}.` : "";
      const fixed = "Holding the AEC’s seat type fixed";
      if (w.p >= CH_ALPHA) dek += sigT.length ? ` ${fixed}, the slope isn’t consistent. By type, per ${X.unit(step)}: ${types}.` : ` ${fixed}, no significant correlation remains: the pattern runs between seat types, not within them.`;
      else if (ratio < 0) dek += ` ${fixed} reverses the slope, to ${f1(weff)} points ${w.b < 0 ? "lower" : "higher"} per ${X.unit(step)}.${byType}`;
      else if (ratio > 1.25) dek += ` ${fixed} steepens the slope, to ${f1(weff)} points per ${X.unit(step)}.${byType}`;
      else if (ratio < 0.8) { const cut = 1 - ratio; dek += ` ${fixed} ${cut < 0.4 ? "cuts about a third off the slope" : cut < 0.6 ? "roughly halves the slope" : cut < 0.8 ? "cuts about two-thirds off the slope" : "removes most of the slope"}, to ${f1(weff)} points per ${X.unit(step)}.${byType}`; }
      else dek += ` ${fixed} barely changes the slope (${f1(weff)} points per ${X.unit(step)}).${byType}`;
    }
    notes = `Each dot is a seat, coloured by who ${chHeld(m)} it${split ? "; Labor’s two-party share runs up the side" : ""}. The line is the least-squares fit, its band a 95% confidence interval${f.p >= CH_ALPHA || split ? ", dashed where the correlation isn’t significant" : ""}; r is Pearson’s correlation. Every seat is counted, not sampled, so significance is a permutation test: in ${int(CH_R)} random shufflings of the seats’ two-party shares, correlations this strong came up ${chShuffled(f.p)}. Significant means under 1 in 20.${X.jitter ? " Median ages are whole years, so seats sharing one are spread a little sideways." : ""}${nat != null ? ` The upright line marks ${chPlace(m)}.` : ""}`;
  }
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const xs = all.map((p) => p.xj), ys = all.map((p) => p.y);
    if (nat != null) xs.push(nat);
    const xsc = d3.scaleLinear().domain(d3.extent(xs)).nice(6), ysc = d3.scaleLinear().domain([Math.min(d3.min(ys), 45), Math.max(d3.max(ys), 55)]).nice(5);
    const [xa, xb] = xsc.domain(), [ya, yb] = ysc.domain();
    const panels = split ? CLS.map((c) => ({ c, pts: all.filter((p) => p.cls === c) })) : [{ c: null, pts: all }];
    // four types always sit two by two: stacked in one column a phone's stage leaves each a sliver
    const cols = split ? 2 : 1, rows = Math.ceil(panels.length / cols), narrow = w < 520;
    const padL = narrow ? 30 : 40, padR = 12, padT = split ? (narrow ? 34 : 30) : 22, padB = split ? 20 : 36, gapX = narrow ? 14 : 26;
    const ph = (h - rows * (padT + padB) - (split ? 16 : 0)) / rows, pw = (w - padL - padR - gapX * (cols - 1)) / cols;
    const r = clamp(Math.min(pw, ph * 1.6) / (split ? 70 : 95), 2.6, 6);
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    const pts = [], sel = selDiv();
    panels.forEach((P, k) => {
      const cx = k % cols, cy = Math.floor(k / cols);
      const x0 = padL + cx * (pw + gapX), x1 = x0 + pw, y0 = padT + cy * (ph + padT + padB), y1 = y0 + ph;
      const Xs = chScale(xa, xb, x0, x1), Ys = chScale(ya, yb, y1, y0);
      const xt = xsc.ticks(Math.max(3, Math.floor(pw / 80))), yt = ysc.ticks(Math.max(3, Math.floor(ph / 45)));
      svg += chAxes({ X: Xs, Y: Ys, x0, x1, y0, y1, xt, yt, xfmt: X.fmt, yfmt: (v) => f0(v), xlab: cy === rows - 1 ? (narrow && X.axisShort ? X.axisShort : X.axis) : "", ylab: !split ? "Labor 2PP" : "", ylabs: cx === 0 });
      svg += `<line class="ch-ref" x1="${x0}" x2="${x1}" y1="${Ys(50).toFixed(1)}" y2="${Ys(50).toFixed(1)}"/>`;
      if (nat != null) svg += chNatLine(Xs(nat), y0, y1, k === 0 || !split ? `${chPlace(m)} ${X.fmt(nat)}` : "", x0, x1);
      const fl = split ? typeFit(P.c) : f;
      if (fl) { const pin = P.pts.filter((p) => p.pass), ex = d3.extent(pin, (p) => p.x); if (pin.length) svg += chFit(fl, Xs, Ys, ex[0], ex[1], fl.p < CH_ALPHA); }
      if (split) {
        const say = !fl ? "too few seats to test" : fl.p < CH_ALPHA ? `${sgn(fl.b * step)} per ${X.unit(step)}${narrow ? "" : ` · r ${chR2(fl.r)}`}` : `r ${chR2(fl.r)}, not significant`;
        svg += narrow
          ? `<text class="ch-ptitle" x="${x0}" y="${y0 - 20}">${esc(CLS_SHORT[P.c])}</text><text class="ch-psub" x="${x0}" y="${y0 - 7}">${esc(say)}</text>`
          : `<text class="ch-ptitle" x="${x0}" y="${y0 - 10}">${esc(CLS_SHORT[P.c])}<tspan class="ch-psub" dx="8">${P.pts.length} seats · ${esc(say)}</tspan></text>`;
      }
      const ord = P.pts.slice().sort((a, b) => (a.pass - b.pass) || (a.i === sel) - (b.i === sel));
      for (const p of ord) { p.sx = Xs(p.xj); p.sy = Ys(p.y); svg += chDot(p, r); }
      // the seats furthest from the line, named (one panel only: four would crowd)
      if (!split && fl) {
        const pin = P.pts.filter((p) => p.pass);
        const far = pin.slice().sort((a, b) => Math.abs(b.y - fl.a - fl.b * b.x) - Math.abs(a.y - fl.a - fl.b * a.x)).slice(0, narrow ? 2 : 4);
        for (const p of far) if (p.i !== sel) svg += chLabel(p, dn(m.divs[p.i].n), x1, r);
      }
      for (const p of P.pts) pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: k * 1e6 + p.sx, tip: [`${X.short}: ${X.fmt(p.x)}`, `Labor 2PP: ${f1(p.y)}`] });
      const sp = P.pts.find((p) => p.i === sel);
      if (sp) svg += chSelRing(sp, r) + chLabel(sp, dn(m.divs[sp.i].n), x1, r + 3);
    });
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes, fams, draw };
}

/* ----- Two-party, How votes were cast ----- */
function chCastRows(m, vs) {
  const raw = new Map(m.res.divs.map((d) => [d.n, d]));
  const all = [];
  let miss = 0;
  m.divs.forEach((d, i) => {
    const r = raw.get(d.n), v2 = r && r.vt2;
    if (!v2 || d.tpp == null) { miss++; return; }
    const day = chAdd(v2.day, v2.mob), x = chShare(day);
    const rest = chAdd(...Object.entries(v2).filter(([k]) => k !== "day" && k !== "mob").map(([, p]) => p));
    const pile = vs === "final" ? null : v2[vs];
    const y = vs === "final" ? nn(d.tpp) : pile && pile[0] + pile[1] >= VT_CELL ? chShare(pile) : null;
    if (x == null || y == null) { miss++; return; }
    const pair = new Set([d.win && d.win.fam, d.run && d.run.fam]);
    const classic = pair.has("alp") && pair.has("lnp");
    all.push({ i, x, y, rest: chShare(rest), fam: holdFam(d.hold), classic, hollow: !classic, pass: passes(m, i) });
  });
  return { all, miss };
}
function chartCast(m) {
  const vs = CH_VS[CH.vs] ? CH.vs : "final";
  const { all, miss } = chCastRows(m, vs);
  const inn = all.filter((p) => p.pass && p.classic);
  const fams = [...new Set(all.map((p) => p.fam))];
  const ctl = `<div class="lg-draw ch-ctl" role="group" aria-label="Set against the on-the-day vote"><span>Compare</span>${Object.entries(CH_VS).map(([k, [t]]) => `<button type="button" data-chvs="${k}" aria-pressed="${k === vs}">${t}</button>`).join("")}</div>`;
  const yr = typeof m.year === "number" ? m.year : 2025;
  const missNote = miss ? ` ${miss} seat${miss > 1 ? "s have" : " has"} no ${vs === "final" ? "two-party count split by how votes were cast" : "count for this kind of vote big enough to read"}${yr < 2016 ? " (before 2016 the AEC split only Labor v Coalition final twos)" : ""}.` : "";
  const nm = (p) => dn(m.divs[p.i].n);
  if (vs === "final") return chartClose(m, all, inn, fams, ctl, missNote, nm);
  const word = vs === "post" ? "Postal votes" : "Early-centre votes";
  const gs = inn.map((p) => p.y - p.x), g = chMedian(gs);
  const less = gs.filter((v) => v < 0).length, more = gs.filter((v) => v > 0).length;
  const head = g == null ? `No Labor v Coalition seats to compare` : Math.abs(g) < VT_LEVEL ? `${word} were about as Labor as on-the-day votes in the median seat` : g < 0 ? `${word} were less Labor than on-the-day votes in ${less} of ${gs.length} seats, by a median ${f1(-g)} points` : `${word} were more Labor than on-the-day votes in ${more} of ${gs.length} seats, by a median ${f1(g)} points`;
  const dek = gs.length ? `Counting the ${gs.length} seats whose final two were Labor and the Coalition; the gap ran from ${sgn(d3.min(gs))} to ${sgn(d3.max(gs))} points.` : "";
  const named = new Set();
  const ext = inn.slice().sort((a, b) => (a.y - a.x) - (b.y - b.x));
  [...ext.slice(0, 2), ...ext.slice(-2)].forEach((p) => named.add(p.i));
  const notes = `Labor’s share of the AEC’s Labor v Coalition count, by how votes were cast; on the day includes mobile teams. Hollow dots are seats whose final two weren’t Labor and the Coalition, where this count isn’t the contest: they’re drawn but left out of the head.${missNote}`;
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const sc = d3.scaleLinear().domain(d3.extent(all.flatMap((p) => [p.x, p.y]))).nice(6), [lo, hi] = sc.domain();
    const padL = 40, padR = 12, padT = 22, padB = 38;
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const Xs = chScale(lo, hi, x0, x1), Ys = chScale(lo, hi, y1, y0);
    const r = clamp(Math.min(x1 - x0, (y1 - y0) * 1.6) / 95, 2.6, 6);
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    svg += chAxes({ X: Xs, Y: Ys, x0, x1, y0, y1, xt: sc.ticks(Math.max(4, Math.floor((x1 - x0) / 80))), yt: sc.ticks(Math.max(3, Math.floor((y1 - y0) / 45))), xfmt: f0, yfmt: f0, xlab: "Labor 2PP, on-the-day votes", ylab: CH_VS[vs][1] });
    svg += `<line class="ch-ref" x1="${Xs(50).toFixed(1)}" x2="${Xs(50).toFixed(1)}" y1="${y0}" y2="${y1}"/><line class="ch-ref" x1="${x0}" x2="${x1}" y1="${Ys(50).toFixed(1)}" y2="${Ys(50).toFixed(1)}"/>`;
    svg += `<line class="ch-diag" x1="${Xs(lo).toFixed(1)}" y1="${Ys(lo).toFixed(1)}" x2="${Xs(hi).toFixed(1)}" y2="${Ys(hi).toFixed(1)}"/><text class="ch-qlab" x="${(Xs(hi) - 4).toFixed(1)}" y="${(Ys(hi) + 14).toFixed(1)}" text-anchor="end">Same as on the day</text>`;
    const sel = selDiv(), pts = [];
    const ord = all.slice().sort((p, q) => (p.pass - q.pass) || (p.i === sel) - (q.i === sel));
    for (const p of ord) { p.sx = Xs(p.x); p.sy = Ys(p.y); svg += chDot(p, r); }
    for (const p of all) if (named.has(p.i) && p.i !== sel) svg += chLabel(p, nm(p), x1, r);
    for (const p of all) pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: p.sx, tip: [`On the day: ${f1(p.x)}`, `${CH_VS[vs][0]}: ${f1(p.y)} (${sgn(p.y - p.x)})`, ...(p.classic ? [] : ["Final two not Labor v Coalition"])] });
    const sp = all.find((p) => p.i === sel);
    if (sp) svg += chSelRing(sp, r) + chLabel(sp, nm(sp), x1, r + 3);
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes, fams, draw };
}
// the close seats, each a row: its on-the-day share (open) to its final count (filled). The
// seats the two put on different sides always get a row; the closest seats fill the rest
function chartClose(m, all, inn, fams, ctl, missNote, nm) {
  const L = inn.filter((p) => p.x > 50 && p.y < 50), C = inn.filter((p) => p.x < 50 && p.y > 50);
  const names = (a) => a.map(nm).sort();
  const two = "on-the-day two-party vote";
  let head;
  if (L.length) head = `Labor won the ${two} in ${chNum(L.length)} seat${L.length > 1 ? "s" : ""} it lost${L.length <= 8 ? `: ${chList(names(L))}` : ""}`;
  else if (C.length) head = `The Coalition won the ${two} in ${chNum(C.length)} seat${C.length > 1 ? "s" : ""} it lost${C.length <= 8 ? `: ${chList(names(C))}` : ""}`;
  else head = inn.length ? `Every Labor v Coalition seat went the way of its ${two}` : `No Labor v Coalition seats to compare`;
  let dek = L.length && C.length ? `The Coalition did the same in ${chNum(C.length)}${C.length <= 6 ? `: ${chList(names(C))}` : ""}. ` : "";
  const gs = inn.filter((p) => p.rest != null).map((p) => p.rest - p.x), g = chMedian(gs);
  if (g != null) dek += Math.abs(g) < VT_LEVEL ? `Across the ${gs.length} Labor v Coalition seats, votes cast any other way (at early centres, by post or by declaration) were about as Labor as on-the-day votes in the median seat.` : `Across the ${gs.length} Labor v Coalition seats, votes cast any other way (at early centres, by post or by declaration) were a median ${f1(Math.abs(g))} points ${g < 0 ? "less" : "more"} Labor than on-the-day votes.`;
  const crossed = new Set([...L, ...C].map((p) => p.i));
  let shown = 0;
  const notes = () => `Each row is a seat: ○ Labor’s share of its ${two} (mobile teams included), ● its final count. The ${shown ? `${shown} ` : ""}Labor v Coalition seats closest to 50–50 on the final count are shown, with every seat the two put on different sides. Seats whose final two weren’t Labor and the Coalition are left out: their two-party count isn’t the contest.${missNote}`;
  const keyExtra = `<span class="ch-kmark"><i class="ch-kopen"></i>On the day</span><span class="ch-kmark"><i class="ch-kfill"></i>Final count</span>`;
  const draw = (w, h) => {
    const narrow = w < 520, padL = narrow ? 84 : 112, padR = 14, padT = 8, padB = 34;
    const sel = selDiv();
    const maxRows = clamp(Math.floor((h - padT - padB) / 15), 4, 40);
    const pool = inn.slice().sort((a, b) => Math.abs(a.y - 50) - Math.abs(b.y - 50));
    const pick = new Map();
    for (const p of pool) if (crossed.has(p.i)) pick.set(p.i, p);
    const sp = all.find((p) => p.i === sel && p.classic);
    if (sp) pick.set(sp.i, sp);
    for (const p of pool) { if (pick.size >= maxRows) break; pick.set(p.i, p); }
    const rows = [...pick.values()].sort((a, b) => b.y - a.y);
    shown = rows.length;
    const nt = CH.el && $(".ch-ntext", CH.el);
    if (nt) nt.textContent = notes();
    if (!rows.length) return { svg: "", pts: [] };
    const vals = rows.flatMap((p) => [p.x, p.y]).concat([50]);
    const sc = d3.scaleLinear().domain(d3.extent(vals)).nice(6), [lo, hi] = sc.domain();
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const Xs = chScale(lo, hi, x0, x1), rh = Math.min(22, (y1 - y0) / rows.length), r = clamp(rh / 3.2, 2.6, 5.2);
    const top = y0 + ((y1 - y0) - rh * rows.length) / 2;
    const ticks = sc.ticks(Math.max(4, Math.floor((x1 - x0) / 70)));
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><g class="ch-grid">`;
    for (const v of ticks) svg += `<line x1="${Xs(v).toFixed(1)}" x2="${Xs(v).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    svg += `</g><g class="ch-tick">`;
    for (const v of ticks) svg += `<text x="${Xs(v).toFixed(1)}" y="${y1 + 15}" text-anchor="middle">${f0(v)}</text>`;
    svg += `</g><line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><text class="ch-lab" x="${x1}" y="${y1 + 31}" text-anchor="end">Labor 2PP</text>`;
    svg += `<line class="ch-ref" x1="${Xs(50).toFixed(1)}" x2="${Xs(50).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    const pts = [];
    rows.forEach((p, k) => {
      const cy = top + (k + 0.5) * rh, xd = Xs(p.x), xf = Xs(p.y), win = p.y >= 50 ? "alp" : "lnp";
      if (crossed.has(p.i)) svg += `<rect class="ch-xrow" x="2" y="${(cy - rh / 2).toFixed(1)}" width="${x1 - 2}" height="${rh.toFixed(1)}" style="fill:var(--m-${win})"/>`;
      svg += `<text class="ch-rname${crossed.has(p.i) ? " ch-rx" : ""}${p.pass ? "" : " ch-off"}" x="${x0 - 8}" y="${(cy + 4).toFixed(1)}" text-anchor="end">${esc(nm(p))}</text>`;
      svg += `<line class="ch-conn${p.pass ? "" : " ch-off"}" x1="${xd.toFixed(1)}" x2="${xf.toFixed(1)}" y1="${cy.toFixed(1)}" y2="${cy.toFixed(1)}"/>`;
      svg += `<circle class="ch-open${p.pass ? "" : " ch-off"}" cx="${xd.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r - 0.6).toFixed(1)}"/>`;
      p.sx = xf; p.sy = cy;
      svg += chDot(p, r);
      if (p.i === sel) svg += chSelRing(p, r);
      pts.push({ i: p.i, sx: xf, sy: cy, r, ord: k, row: { y: cy, h: rh, x0: 0, x1: w }, tip: [`On the day: ${f1(p.x)}`, `Final count: ${f1(p.y)} (${sgn(p.y - p.x)})`, ...(p.rest != null ? [`Every other vote: ${f1(p.rest)}`] : [])] });
    });
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, ctl, notes: notes(), fams, keyExtra, draw };
}

/* ----- every other lens: the seats stacked along the lens's figure ----- */
// what each lens's figure is, as a head's subject, and the unit it's read in
function chNoun(m) {
  const P = famLeg(S.party);
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? ["The two-party swing to Labor", " points"] : ["Labor’s two-party share", "%"];
    case "fp": return S.fpMode === "change" ? [`The change in the ${P} primary vote`, " points"] : [`The ${P} primary vote`, "%"];
    case "senate": return senGap() ? [`The ${P} Senate vote less its House vote`, " points"] : [`The ${P} Senate vote`, "%"];
    case "flow": return [`The share of ${famLeg(S.from)} preferences reaching Labor`, "%"];
    case "senpref": return [lensShort(), "%"];
    case "informal": return infModeOf(m) === "exhaust" ? ["The share of ballots exhausting before the final two", "%"] : ["The informal vote", "%"];
  }
  return [lensShort(), ""];
}
function chartDots(m) {
  const c = colByKey(m, "seats", lensKey());
  const fmt = (c && c.fmt) || f1;
  const all = [];
  let miss = 0;
  m.divs.forEach((d, i) => { const v = c ? nn(c.get(d)) : null; if (v != null) all.push({ i, x: v, fam: holdFam(d.hold), pass: passes(m, i) }); else miss++; });
  const fams = [...new Set(all.map((p) => p.fam))];
  const vin = all.filter((p) => p.pass).map((p) => p.x);
  const lab = lensShort(), nat = chNational(m), [noun, unit] = chNoun(m), fu = (v) => `${fmt(v)}${unit}`;
  let head = `${noun}: no seats in view`, dek = "";
  if (vin.length) {
    const lo = chQ(vin, 0.25), hi = chQ(vin, 0.75), md = chMedian(vin);
    if (S.lens === "tpp" && S.tppMode !== "swing" && axisNow(m) === "AC") head = `Labor was ahead of the Coalition on two-party preferences in ${vin.filter((v) => v > 50).length} of ${vin.length} seats`;
    else if (nat != null) head = `${noun} was above ${chPlace(m)}’s ${fu(nat)} in ${vin.filter((v) => v > nat).length} of ${vin.length} seats`;
    else head = `${noun}: a median ${fu(md)} across the ${vin.length} seats`;
    dek = `The median seat sat at ${fu(md)}; the middle half of the seats ran from ${fu(lo)} to ${fu(hi)}.`;
  }
  const notes = `Each block is a seat, coloured by who ${chHeld(m)} it, stacked by its figure: a histogram whose blocks you can point at.${nat != null ? ` The upright line marks ${chPlace(m)}.` : ""}${miss ? ` ${miss} seat${miss > 1 ? "s have" : " has"} no figure here and ${miss > 1 ? "are" : "is"} left out.` : ""}`;
  const draw = (w, h) => {
    if (!all.length) return { svg: "", pts: [] };
    const padL = 14, padR = 14, padT = 18, padB = 38;
    const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    const vals = all.map((p) => p.x);
    let lo = d3.min(vals), hi = d3.max(vals);
    if (c && c.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (nat != null) { lo = Math.min(lo, nat); hi = Math.max(hi, nat); }
    // the finest bins whose stacks still fill most of the height (a flat strip of tiny dots reads as nothing)
    const tryBins = (nbT) => {
      const bw = d3.tickStep(lo, hi, nbT), b0 = Math.floor(lo / bw) * bw, nb = Math.max(1, Math.ceil((hi - b0) / bw + 1e-9));
      const bins = Array.from({ length: nb }, () => []);
      for (const p of all) bins[Math.min(nb - 1, Math.floor((p.x - b0) / bw + 1e-9))].push(p);
      const maxN = d3.max(bins, (b) => b.length) || 1, cw = (x1 - x0) / nb, D = Math.min(cw, (y1 - y0) / maxN, 30);
      return { bw, b0, nb, bins, cw, D, fill: (maxN * D) / (y1 - y0) };
    };
    let best = null;
    for (let nbT = clamp(Math.floor((x1 - x0) / 12), 10, 60); nbT >= 6; nbT--) { const t = tryBins(nbT); if (!best || t.fill > best.fill + 0.02) best = t; if (t.fill >= 0.6) { best = t; break; } }
    const { bw, b0, nb, bins, cw, D } = best, r = Math.max(1.6, D / 2 - 0.6);
    const X = (v) => x0 + ((v - b0) / bw) * cw;
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
    svg += `<line class="ch-base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><g class="ch-tick">`;
    for (const v of d3.ticks(b0, b0 + nb * bw, Math.max(3, Math.floor((x1 - x0) / 70)))) svg += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${y1}" y2="${y1 + 4}" class="ch-base"/><text x="${X(v).toFixed(1)}" y="${y1 + 16}" text-anchor="middle">${esc(fmt === f1 && Number.isInteger(v) ? f0(v) : fmt(v))}</text>`;
    svg += `</g><text class="ch-lab" x="${x1}" y="${y1 + 32}" text-anchor="end">${esc(`${lab}, ${unit === "%" ? "%" : "points"}`)}</text>`;
    const ref = S.lens === "tpp" && S.tppMode !== "swing" ? 50 : c && (c.zero || c.diverge) ? 0 : S.lens === "flow" || S.lens === "senpref" ? 50 : null;
    if (ref != null && ref >= b0 && ref <= b0 + nb * bw) svg += `<line class="ch-ref" x1="${X(ref).toFixed(1)}" x2="${X(ref).toFixed(1)}" y1="${y0}" y2="${y1}"/>`;
    if (nat != null) svg += chNatLine(X(nat), y0 - 8, y1, `${chPlace(m)} ${fu(nat)}`, x0, x1);
    const sel = selDiv(), pts = [];
    let sp = null;
    bins.forEach((B, k) => {
      B.sort((a, b) => CH_FAMS.indexOf(a.fam) - CH_FAMS.indexOf(b.fam) || a.x - b.x);
      B.forEach((p, j) => {
        p.sx = x0 + (k + 0.5) * cw; p.sy = y1 - (j + 0.5) * D;
        svg += chDot(p, r);
        if (p.i === sel) sp = p;
        pts.push({ i: p.i, sx: p.sx, sy: p.sy, r, ord: k * 1e4 + j, tip: [`${lab}: ${fu(p.x)}`] });
      });
    });
    if (sp) svg += chSelRing(sp, r) + chLabel(sp, dn(m.divs[sp.i].n), x1, r + 3);
    return { svg: `${svg}${chHovRing()}</svg>`, pts };
  };
  return { head, dek, notes, fams, draw };
}

/* ----- pointing, keys and the chart's own switches ----- */
function chNear(e) {
  const svg = CH.el && $(".ch-plot svg", CH.el);
  if (!svg) return null;
  const b = svg.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
  const row = CH.pts.find((p) => p.row && Math.abs(y - p.row.y) <= p.row.h / 2 && x >= p.row.x0 && x <= p.row.x1);
  if (row) return row;
  let best = null, bd = 14 * 14;
  for (const p of CH.pts) { const d2 = (p.sx - x) ** 2 + (p.sy - y) ** 2; if (d2 < bd) { bd = d2; best = p; } }
  return best;
}
// one seat lit: the ring over its dot, its tip, and (from the keys) the live region's words
function chHover(p, fromKeys) {
  const svg = CH.el && $(".ch-plot svg", CH.el), ring = svg && $(".ch-hov", svg), m = M();
  if (!p || !m || !svg) { CH.hot = -1; if (ring) ring.setAttribute("r", "0"); hideTip(); return; }
  CH.hot = p.i;
  if (ring) { ring.setAttribute("cx", p.sx.toFixed(1)); ring.setAttribute("cy", p.sy.toFixed(1)); ring.setAttribute("r", (p.r + 3.5).toFixed(1)); }
  const b = svg.getBoundingClientRect();
  showTipAt(chSeatTip(m, p.i, p.tip), b.left + p.sx, b.top + p.sy);
  if (fromKeys) { const live = $(".ch-live", CH.el); if (live) live.textContent = `${dn(m.divs[p.i].n)}: ${p.tip.join("; ")}`; }
}
function chartMove(e) {
  if (e.target.closest("button")) { chHover(null); return; }
  const p = chNear(e);
  CH.el.classList.toggle("ch-point", !!p);
  if (!p) { if (CH.focus < 0) chHover(null); return; }
  CH.focus = -1;
  if (p.i !== CH.hot || tip.hidden) chHover(p);
  else showTipAt(chSeatTip(M(), p.i, p.tip), e.clientX, e.clientY);
}
function chartKey(e) {
  if (!e.target.classList.contains("ch-plot") || e.metaKey || e.ctrlKey || e.altKey) return;
  const order = CH.pts.slice().sort((a, b) => a.ord - b.ord || a.sy - b.sy);
  if (!order.length) return;
  const at = order.findIndex((p) => p.i === CH.focus);
  let k = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") k = at < 0 ? 0 : Math.min(order.length - 1, at + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = at < 0 ? order.length - 1 : Math.max(0, at - 1);
  else if (e.key === "Home") k = 0;
  else if (e.key === "End") k = order.length - 1;
  else if ((e.key === "Enter" || e.key === " ") && at >= 0) { e.preventDefault(); e.stopPropagation(); goDiv(order[at].i, { fly: false }); return; }
  if (k == null) return;
  e.preventDefault(); e.stopPropagation();
  CH.focus = order[k].i;
  chHover(order[k], true);
}
function chartClick(e) {
  const t = e.target.closest("[data-chtpp],[data-chvs],[data-chsplit]");
  if (t) {
    if (t.dataset.chtpp) CH.tpp = t.dataset.chtpp;
    if (t.dataset.chvs) CH.vs = t.dataset.chvs;
    if (t.dataset.chsplit) CH.split = t.dataset.chsplit === "1";
    const sel = t.dataset.chtpp ? `[data-chtpp="${CH.tpp}"]` : t.dataset.chvs ? `[data-chvs="${CH.vs}"]` : `[data-chsplit="${CH.split ? 1 : 0}"]`;
    CH.key = ""; CH.statKey = ""; writeURL(); chartTick();
    $(sel, CH.el)?.focus({ preventScroll: true });
    return;
  }
  const p = chNear(e);
  if (p) { if (selDiv() === p.i) goAus({ fly: false }); else goDiv(p.i, { fly: false }); }
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
   row (0 the table, 1 the front bench … 5), w (its room along the bench) }. Ids: side L|R, then a<i> the
   front bench's straight arm, t<i> the table, b<row><slot> the side blocks,
   c<row><sector><i> round the curve. */
const CHB = {
  // the front bench's straight arm is one long bench; 20 places along it, room for the most a
  // plan has seated there (19, the opposition in March 2021)
  arm: { x: 110, y0: -362, pitch: 16.9, n: 20 },
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
    for (let i = 0; i < CHB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * CHB.arm.x, y: CHB.arm.y0 + CHB.arm.pitch * i, fa, row: 1, w: CHB.arm.pitch });
    CHB.table.ys.forEach((y, i) => cells.push({ id: `${P}t${i}`, x: sx * CHB.table.x, y, fa, row: 0, w: 26 }));
    CHB.blockX.forEach((bx, k) => CHB.tierY.flat().forEach((y, j) => cells.push({ id: `${P}b${k + 2}${j}`, x: sx * bx, y, fa, row: k + 2, w: 26 })));
    CHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = CHB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 1}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 1, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  return cells;
}
const SERJEANT = "Rc5d1"; // the Serjeant-at-Arms's chair, in the curve's last row by the centre aisle
/* @cells-end */
/* Victoria's Legislative Assembly in the federal chamber's idiom (the 60th Parliament's
   own plan — map/data/la-seating-plan-vic-2026-08-11.json — seats members on it): the
   same Speaker's dais and T-table, but three chairs a side at the table (Premier,
   Leader of the House, Deputy Premier against the Opposition Leader, the Deputy
   Leader of the Opposition and the Nationals' leader), three clerks at its head, a
   shorter front bench and one block column fewer — 93 desks and the chair.
   @vic-cells-begin – read as is by .build/map/vic_seating.mjs. */
const VCHB = {
  arm: { x: 110, y0: -362, pitch: 16.9, n: 8 },
  table: { x: 49.6, ys: [-196, -156, -116] },
  blockX: [138, 181, 223],
  tierY: [[-282, -256], [-214, -188], [-146, -120], [-68, -42]],
  R: [91, 138, 180, 222, 264],
  sectors: [[[4, 42, 1], [44, 82, 1]], [[4, 42, 1], [44, 82, 1]], [[4, 42, 1], [44, 82, 1]],
    [[4, 29, 1], [31, 56, 1], [58, 83, 1]], [[4, 29, 1], [31, 56, 1], [58, 83, 1]]],
};
const VIC_SERJEANT = "Rc5c0"; // the Serjeant-at-Arms, at the curve's back by the centre
function vicCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    for (let i = 0; i < VCHB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * VCHB.arm.x, y: VCHB.arm.y0 + VCHB.arm.pitch * i, fa, row: 1, w: VCHB.arm.pitch });
    VCHB.table.ys.forEach((y, i) => cells.push({ id: `${P}t${i}`, x: sx * VCHB.table.x, y, fa, row: 0, w: 26 }));
    VCHB.blockX.forEach((bx, k) => VCHB.tierY.flat().forEach((y, j) => cells.push({ id: `${P}b${k + 2}${j}`, x: sx * bx, y, fa, row: k + 2, w: 26 })));
    VCHB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = VCHB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 1}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 1, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  return cells;
}
/* @vic-cells-end */
/* New South Wales' Legislative Assembly in the same idiom (the 1843 chamber is Victoria's
   sister: a horseshoe of benches about a central table) — but Sydney's table is one long
   rectangle, no T head, no Hansard desk at its foot, and no members sit at it at all: two
   clerks alone chair at its head, Speaker-side (the parliament's own chamber layout,
   parliament.nsw.gov.au's the-chamber page and seating-layout diagram). The floor's benches
   as the chamber's own seating plan draws them (2026-10-27, the user's pass over the plan):
   NO row runs up beside the Speaker's dais — each side has TWO straight files of twelve
   running parallel to the table from its shoulders down, the Premier and the Leader of the
   Opposition heading the inner one (nothing sits level with the dais), the outer file
   standing one seat the Speaker's side of the inner (its head level with the leaders'
   desks, the inner file protruding one seat at the rear), and the far end turning
   in THREE curved rows of 6, 9 and 6 a side — the outer row spanning no wider sideways
   than the middle row's far desk (the three user calls of 2026-10-27, over the plan).
   92 desks for the 92 members exactly; the
   Serjeant-at-Arms's chair stands centred behind the curve, "the chair separating the
   benches" (the parliament's own description).
   @nsw-cells-begin */
const NSWB = {
  leadY: -268.2, // the leaders' desks, heading the inner straight row at the table's shoulder
  arm: { x: 130, y0: -250, pitch: 18.2, n: 12 }, // the inner straight row, continuing the inner curve's radius
  row2X: 172, // the outer straight row, continuing the middle curve's radius (2026-10-27 user call)
  row2Y0: -268.2, // its head one seat the Speaker's side of the inner file's — level with the leaders' desks — so the inner file protrudes one seat at the rear (2026-10-27 user call)
  R: [130, 172, 214], // the curve's three rows
  // the outer curve spans no wider sideways than the middle row's far desk (|x| ≈ 170 at
  // R 214 = a0 33°): its six seats crowd the rear half of the arc (2026-10-27 user call)
  sectors: [[[6, 84, 6]], [[5, 85, 9]], [[33, 83, 6]]],
  // the walkway radii the majority line threads (the House's CH tables presume five curve
  // rows): inside the inner file, between the files, past the outer file; then inside the
  // curve, between the curve rows, past the outer one (so the line ends by the seats, not
  // adrift off the carpet's south edge — the 2026-10-27 substrate trim)
  walks: [116, 151, 187, 151, 193, 229],
};
const NSW_SERJEANT = "Rsj0"; // the Serjeant-at-Arms, centred at the curve's back
function nswCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    cells.push({ id: `${P}t0`, x: sx * NSWB.arm.x, y: NSWB.leadY, fa, row: 1, w: NSWB.arm.pitch });
    for (let i = 0; i < NSWB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * NSWB.arm.x, y: NSWB.arm.y0 + NSWB.arm.pitch * i, fa, row: 1, w: NSWB.arm.pitch });
    for (let i = 0; i < NSWB.arm.n; i++) cells.push({ id: `${P}b${i}`, x: sx * NSWB.row2X, y: NSWB.row2Y0 + NSWB.arm.pitch * i, fa, row: 2, w: NSWB.arm.pitch });
    NSWB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = NSWB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 3}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 3, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  cells.push({ id: NSW_SERJEANT, x: 0, y: 242, fa: -Math.PI / 2, row: 5, w: 26 });
  return cells;
}
/* @nsw-cells-end */
/* Queensland's Legislative Assembly in the same idiom (Parliament House, Brisbane — the
   1868 Westminster horseshoe of benches about a central table, the mace lying on the
   table). Its ledger today follows the Macquarie Street arc fork (desks = the chamber's
   92 seated members, straight files of twelve continuing the two inner curve radii, the
   far end turning in three rows of 6, 9 and 6 a side, the Serjeant-at-Arms's chair
   centred behind the curve): every other state floor here rides its OWN parliament's
   published plan, but as of 2026-10-29 Queensland's was not captured (the live seating
   plan is bot-walled, the Wayback search line was down, Factsheet 3.4's PDF is the next
   call) — the floor carries no claim of plan truth and is re-visited when the official
   plan lands; the shared arc mechanics, the furniture's rectangle table and its mace
   (Queensland's mace does lie on the table, documented) are what every shape pin in the
   map test stands on.
   @qld-cells-begin */
const QLDB = {
  leadY: -268.2, // the leaders' desks, heading the inner straight row at the table's shoulder
  arm: { x: 130, y0: -250, pitch: 18.2, n: 12 }, // the inner straight row, continuing the inner curve's radius
  row2X: 172, // the outer straight row, continuing the middle curve's radius
  row2Y0: -268.2, // its head level with the leaders' desks
  R: [130, 172, 214], // the curve's three rows
  sectors: [[[6, 84, 6]], [[5, 85, 9]], [[33, 83, 6]]],
  // the walkway radii the majority line threads (per the Macquarie Street fork's ledgers)
  walks: [116, 151, 187, 151, 193, 229],
};
const QLD_SERJEANT = "Rsj0"; // the Serjeant-at-Arms-the-Rod chair, centred at the curve's back
function qldCells() {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, P = side ? "R" : "L", fa = side ? Math.PI : 0;
    cells.push({ id: `${P}t0`, x: sx * QLDB.arm.x, y: QLDB.leadY, fa, row: 1, w: QLDB.arm.pitch });
    for (let i = 0; i < QLDB.arm.n; i++) cells.push({ id: `${P}a${i}`, x: sx * QLDB.arm.x, y: QLDB.arm.y0 + QLDB.arm.pitch * i, fa, row: 1, w: QLDB.arm.pitch });
    for (let i = 0; i < QLDB.arm.n; i++) cells.push({ id: `${P}b${i}`, x: sx * QLDB.row2X, y: QLDB.row2Y0 + QLDB.arm.pitch * i, fa, row: 2, w: QLDB.arm.pitch });
    QLDB.sectors.forEach((secs, k) => secs.forEach(([a0, a1, n], q) => {
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + 0.5) * (a1 - a0)) / n) * D, r = QLDB.R[k];
        const x = sx * r * Math.cos(a), y = r * Math.sin(a);
        cells.push({ id: `${P}c${k + 3}${"abcd"[q]}${i}`, x, y, fa: Math.atan2(-y, -x), row: k + 3, w: ((a1 - a0) * D * r) / n });
      }
    }));
  }
  cells.push({ id: QLD_SERJEANT, x: 0, y: 242, fa: -Math.PI / 2, row: 5, w: 26 });
  return cells;
}
/* @qld-cells-end */
/* Victoria's Legislative Council, seating the 60th Parliament's own plan
   (map/data/lc-seating-plan-vic-2026-10-27.json — the Parliament's desk numbers are the
   seats' ids here). The 2026-10-27 redraw to the chamber photograph: a flat overhead
   view of the Level 2 floor in the federal chambers' own outline — straight side walls
   down to the backings' centreline, the southern wall a semicircle hugging the rear
   seating — the President's end up top, the entrance end below — the government on the
   President's right (the reader's
   left), the straight side columns of the main benches running down to two quarter-turn
   backings a side that sweep the floor's empty south end, broad curved rear seating both
   sides of a continuous entrance aisle (never a horseshoe joined across it), the centre
   table one long panel with the clerks' surface above it, and all presiding furniture in
   one shallow dais. The plan's own desks file the four columns; the backings' desks are
   spread along them here — same desks, same ids, no seat added or lost (6 and 22 are
   unbuilt; 14 and 15 are the advisers' chairs, never a member's).
   @viclc-cells-begin – shared with .build/map/vic_lc_seating.mjs, which reads this block as is.
   Plan pixels (x across from the left, y down); cx is the centre line, cy the backings'
   common centre, and every seat is read against them. */
const VCLC = (() => {
  const D = {
    cx: 580, cy: 1163, table: 799, // the centre table's mid-line, which the far-end desks face
    // the carpet's radius about (cx, cy): the outer backing's outer edge plus the House's own
    // 4.5-point carpet skirt at this plan's 45-pixel unit — the walls its span hugs
    floorR: 459.75,
    // the walls' bounds: straight sides at the carpet's reach, top at 104, the southern wall
    // the semicircle the federal chambers draw (below; it used to be a full rectangle)
    room: [120.25, 104, 919.5, 1518.75],
    tables: {
      presidentDesk: [510, 379, 140, 64], clerkTable: [490, 526, 180, 54], centreTable: [509, 609, 142, 392],
    },
    dais: [497, 277, 166, 166], // the presiding dais, one shallow platform under desk and chair
    colFoot: 1010, // the inner columns' backings run on to meet the inner curves' starts
    president: [580.1, 342.5], // desk 1: a role's chair, not a bench seat
    // the officials: the clerks above their table (2, 3), a chair at each head corner of the
    // centre table (4, 5), the Government Advisers (14, 15) — small neutral chairs, never
    // coloured as members' seats
    officers: { "2": [542.2, 489.5], "3": [618, 489.5], "4": [471, 658], "5": [689, 658], "14": [161, 326.6], "15": [161, 397.4] },
    advisers: ["14", "15"],
    // the rear seating: two quarter-turn-like backings a side about (cx, cy), given the
    // government side's waypoints [start by the column's foot, tip at the aisle], mirrored
    // for the opposition about cx. ids run round each backing from its column end out to
    // the aisle tip
    bands: [
      { R: 334, from: [296, 988], to: [497, 1486], ids: [["38", "39", "40"], ["43", "42", "41"]] },
      { R: 420, from: [185, 1019], to: [497, 1575], ids: [["52", "44", "45", "46", "47"], ["53", "51", "50", "49", "48"]] },
    ],
    arcs: { 3: 334, 4: 420, 5: 420 }, // the backyard rows' walkway radii about (cx, cy)
  };
  // every desk a member may sit at, [x, y]: the columns as the plan files them…
  D.desks = {
    "7": [297, 355], "8": [297, 445], "9": [297, 535], "10": [297, 625], "11": [297, 715], "12": [297, 805], "13": [297, 895],
    "23": [863, 355], "24": [863.2, 445], "25": [863.2, 535], "26": [863.2, 625], "27": [863, 715], "28": [863.2, 805], "29": [863.2, 895],
    "16": [161, 576], "17": [161, 645.1], "18": [161, 714.2], "19": [161, 894.5], "20": [161, 963.6], "21": [161, 1032.7],
    "30": [999.3, 326.6], "31": [999.3, 397.4], "32": [999.3, 576], "33": [999.3, 645.1], "34": [999.3, 714.2], "35": [999.3, 894.5], "36": [999.3, 963.6], "37": [999.3, 1032.7],
  };
  // …and the backings' desks spread along them, a small inset off the furniture's ends
  const PAD = (6 * Math.PI) / 180, r1 = (v) => Math.round(v * 10) / 10;
  for (const b of D.bands) {
    const a0 = Math.atan2(b.from[1] - D.cy, b.from[0] - D.cx);
    let a1 = Math.atan2(b.to[1] - D.cy, b.to[0] - D.cx);
    while (a1 > a0) a1 -= 2 * Math.PI; // the sweep runs the short way round the far side
    const n = b.ids[0].length, step = (a0 - a1 - 2 * PAD) / n;
    b.ids.forEach((list, side) => list.forEach((id, j) => {
      const th = a0 - PAD - (j + 0.5) * step, x = D.cx + b.R * Math.cos(th), y = D.cy + b.R * Math.sin(th);
      D.desks[id] = [r1(side ? 2 * D.cx - x : x), r1(y)];
    }));
  }
  return D;
})();
const VCLC_ROW = (id) => {
  const n = +id;
  if ((n >= 7 && n <= 13) || (n >= 23 && n <= 29)) return 1;
  if ((n >= 16 && n <= 21) || (n >= 30 && n <= 37)) return 2;
  if (n >= 38 && n <= 43) return 3;
  if (n >= 44 && n <= 51) return 4;
  return 5;
};
/* @viclc-cells-end */

// position along the benches: down the government's side, round the curve, up the opposition's
// (a chamber whose two curves each turn about their own side's centre, a out from the middle, as
// South Australia's do, measures each round its own)
const CHK = 6;
const benchS = (x, y, a = 0) => (y > 0 ? Math.atan2(y, -(x < 0 ? x + a : x - a)) * CHK : x < 0 ? y : Math.PI * CHK - y);
/* a chamber's geometry: its seats in bench order (s, then row), its rows, the box it's framed in,
   and what differs between the House and the Senate — the presiding officer's chair, the table's
   two chairs, the walkways the majority line threads, the furniture. The Senate's comes from
   senateGeom (app-3b-senate.js), South Australia's two chambers and New South Wales' Council
   from saGeom (app-3c-sa.js) */
let chGeomC = null, vicGeomC = null, vicLCGeomC = null, nswGeomC = null, qldGeomC = null;
const chamberGeom = (m) => (m && VIC_YEARS.has(m.year) ? (m.house === "senate" ? vicLCGeom() : vicGeom()) : m && NSW_YEARS.has(m.year) && m.house !== "senate" ? nswGeom() : m && QLD_YEARS.has(m.year) ? qldGeom() : m && STATE_YEARS.has(m.year) ? saGeom(saFloorOf(m)) : m && m.house === "senate" ? senateGeom() : houseGeom());
// the House's layout builder, shared by Victoria's and New South Wales' variants: the extra block
// carries what differs — the table's chairs, the head clerks, and for Spring Street the clean
// table, for Macquarie Street the rectangular one with no Hansard
function geomFor(cellsOf, serjeantId, B, extra) {
  const all = cellsOf().map((c) => {
    const x = c.x / CU, y = c.y / CU;
    const s = benchS(x, y);
    // each chair as wide as its seat allows (3pt clear of the next), as deep as its bench
    const W = clamp(c.w - 3, 13.5, 30) / CU, D = (c.row === 1 && y < 0 ? 24 : 23) / CU;
    return { id: c.id, x, y, fa: c.fa, row: c.row, s, W, D };
  });
  const seats = all.filter((c) => c.id !== serjeantId).sort((p, q) => p.s - q.s || p.row - q.row);
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = (c.s - s0) / (s1 - s0); });
  const rows = [0, 1, 2, 3, 4, 5].map((r) => seats.filter((c) => c.row === r));
  const sj = all.find((c) => c.id === serjeantId);
  // the carpet ends just past its lowest seat: the back bench's back edge — or Macquarie
  // Street's Serjeant's chair standing behind it — plus the carpet skirt the House's own
  // floor keeps (the 2026-10-27 trim: the states' carpets no longer sprawl past the seats)
  const fr = Math.max(B.R[B.R.length - 1] + 13.5, sj.y * CU + 11.5) / CU + 0.15;
  // the majority line's walkway radii ride each floor's own rows (the House's CH tables
  // presume five curve rows), and the frame box hugs the carpet
  const WS = B.walks ? B.walks.map((v) => v / CU) : null;
  return { seats, rows, nRows: 5, bench: seats.filter((c) => c.row > 0), byId: new Map(seats.map((c) => [c.id, c.k])),
    serjeant: sj, rOut: B.R[4] / CU, src: B, fr,
    box: { x0: -fr - 0.15, x1: fr + 0.15, y0: -13.25, y1: fr + 0.15 },
    arms: true, ...extra, chairAt: SPEAKER_AT, aisle: CH_AISLE, yMid: -6.6,
    benchPt: WS ? (s, k) => benchPt(s, k, WS) : benchPt, benchOut, furniture: drawChamberFurniture };
}
function houseGeom() {
  if (!chGeomC) chGeomC = geomFor(chamberCells, SERJEANT, CHB, { table: ["Lt0", "Rt0"], officers: [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2]] });
  return chGeomC;
}
function vicGeom() {
  if (!vicGeomC) vicGeomC = geomFor(vicCells, VIC_SERJEANT, VCHB, { table: ["Lt0", "Rt0", "Lt1", "Rt1", "Lt2", "Rt2"], vic: true,
    officers: [[-24, -285.5, Math.PI / 2], [0, -285.5, Math.PI / 2], [24, -285.5, Math.PI / 2]] });
  return vicGeomC;
}
function nswGeom() {
  // no table chairs (its leaders top the front benches); the two clerks chair at the table's head
  if (!nswGeomC) nswGeomC = geomFor(nswCells, NSW_SERJEANT, NSWB, { table: ["Lt0", "Rt0"], nsw: true,
    rOut: NSWB.R[2] / CU, // the outer of its three curve rows (geomFor reads R[4], a House index)
    officers: [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2]] });
  return nswGeomC;
}
function qldGeom() {
  // Queensland's floor, the same arc fork: leaders top the front benches, two clerks
  // chair at the table's head (the geometry's shape today is the shared arc ledger —
  // see the @qld-cells note against plan truth)
  if (!qldGeomC) qldGeomC = geomFor(qldCells, QLD_SERJEANT, QLDB, { table: ["Lt0", "Rt0"], nsw: true,
    rOut: QLDB.R[2] / CU,
    officers: [[-19, -285.5, Math.PI / 2], [18, -285.5, Math.PI / 2]] });
  return qldGeomC;
}

/* the council's geometry, off its own descriptor: no floor file to wait on. The order along the
   benches runs as the House's does — down the government's columns, round the rear backings,
   up the opposition's — with every y measured off the backings' common centre so benchS reads
   it straight */
const VLU = 45; // the plan's pixels to a chamber unit
function vicLCGeom() {
  if (vicLCGeomC) return vicLCGeomC;
  const P = (v) => v / VLU, D = VCLC;
  const seats = Object.entries(D.desks).map(([id, [px, py]]) => {
    const x = P(px - D.cx), y = P(py - D.cy), row = VCLC_ROW(id);
    // the columns' chairs face the centre line; the backings' face the table
    const fa = row <= 2 ? (px < D.cx ? 0 : Math.PI) : Math.atan2(P(D.table - D.cy) - y, 0 - x);
    return { id, x, y, fa, row, s: benchS(x, y, 0), W: P(55), D: P(56) };
  }).sort((p, q) => p.s - q.s || p.row - q.row);
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const rows = [null, 1, 2, 3, 4, 5].map((r) => (r === null ? [] : seats.filter((c) => c.row === r)));
  // the walkways the majority line threads, per row's edge: on the straight columns their
  // distance off the centre line, round the rings their radius (the columns get the backfilled
  // stand-ins South Australia's floors use, a chair inside the inner ring)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = [1, 2].map((r) => mean(rows[r].filter((c) => c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = [null, null, P(D.arcs[3]), P(D.arcs[4]), P(D.arcs[5])];
  for (let j = 2; j >= 0; j--) rowR[j] = (j === 2 ? rowR[3] : rowR[j + 1]) - P(72);
  const GAS = rowX[1] - rowX[0];
  const WG = P(D.floorR) - 0.2; // the outer walkway threads just inside the carpet, as the House's does
  const GS = [rowX[0] - GAS / 2, rowX[0] + GAS / 2, rowX[1] + GAS / 2, WG, WG, WG];
  const GC = [0.15, ...rowR.slice(0, -1).map((x, j) => (x + rowR[j + 1]) / 2), Math.min(rowR[4] + 1.35, WG)];
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
    const a = s / CHK; return [-GC[k] * Math.cos(a), GC[k] * Math.sin(a)];
  };
  const [rx, ry, rw, rh] = D.room.map((v, j) => P(v - (j < 2 ? (j ? D.cy : D.cx) : 0)));
  vicLCGeomC = {
    seats, rows, nRows: 5, bench: seats, byId: new Map(seats.map((c) => [c.id, c.k])),
    // the blocs' names must clear the outer seat blocks: anchor them off the room's edge, not
    // a backing's radius; the crossbench tally holds its place outside the floor on the right
    // (the 2026-10-27 redraw)
    rOut: P(D.room[2]) / 2 - 0.7, box: { x0: rx, x1: rx + rw, y0: ry, y1: ry + rh },
    crossSide: "left", // the label side "left" parks the tally on the chamber's right
    arms: false, table: ["9", "25"], // the leaders' own desks: third down each front column
    chairAt: [P(D.president[0] - D.cx), P(D.president[1] - D.cy), Math.PI / 2, 0, P(55), P(56)],
    aisle: P(225), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    benchPt, benchOut, furniture: drawVicLCFurniture,
  };
  return vicLCGeomC;
}
/* the council's room, in the House's drawing: the floor, the benches (a run down each column
   where desks touch, the main strips running on to meet the inner curves, a quarter-turn
   backing per side of each ring), the President's dais and desk, the clerks' surface and the
   centre table down the middle (its burgundy inset), the officials' and advisers' chairs, and
   the empty seats (outlined only, as the House's are). No furniture labels. */
function drawVicLCFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, k = s / VLU, D = VCLC, P = (v) => v / VLU;
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const carpet = css(mixC(th.floor, [122, 44, 52], th.dark ? 0.8 : 0.68)); // the centre table's dark burgundy inset
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k, H = 33; // a chair's half-side and a bench's margin round it
  // the floor, the federal chambers' own outline: straight sides from the head of the room
  // down to the backings' centreline, then the southern wall at the carpet radius —
  // one semicircle hugging the rear backings' outer edge plus the House's own skirt
  const [fx, fy] = [D.room[0] - D.cx, D.room[1] - D.cy];
  g.beginPath();
  g.moveTo(fx, fy); g.lineTo(fx, 0); g.arc(0, 0, D.floorR, Math.PI, 0, true); g.lineTo(fx + D.room[2], fy);
  g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h, r = 4) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  // the straight columns: each run of desks closer than a seat and a half apart is one bench;
  // the main strips' backings run on to colFoot, where the inner curves take over
  const cols = new Map();
  const seatSpot = Object.entries(D.desks).filter(([id]) => VCLC_ROW(id) <= 2);
  for (const [id, [px, py]] of [...seatSpot, ...D.advisers.map((id) => [id, D.officers[id]])]) { const x = Math.round(px); if (!cols.has(x)) cols.set(x, []); cols.get(x).push(py); }
  for (const [x, ys] of cols) {
    ys.sort((p, q) => p - q);
    let run = null;
    for (const y of [...ys, 1e9]) {
      if (run && y - run[1] > 110) { const [y0, y1] = run, foot = x === 297 || x === 863 ? D.colFoot : y1; rb(x - D.cx - H, y0 - D.cy - H, 2 * H, foot - y0 + 2 * H); run = null; }
      if (!run) run = [y, y]; else run[1] = y;
    }
  }
  // the rear seating: two quarter-turn backings a side along the bands' own spans, mirrored
  // about the centre line and never joined across the entrance aisle
  for (const side of [0, 1]) for (const b of D.bands) {
    const mx = (x) => (side ? 2 * D.cx - x : x) - D.cx;
    const a0 = Math.atan2(b.from[1] - D.cy, mx(b.from[0])), a1 = Math.atan2(b.to[1] - D.cy, mx(b.to[0]));
    g.beginPath(); g.arc(0, 0, b.R + H, a0, a1, side === 0); g.arc(0, 0, b.R - H, a1, a0, side === 1); g.closePath(); g.fill(); g.stroke();
  }
  // the centre table: one long panel, muted timber edge over the burgundy inset; the clerks'
  // short surface above it by a small gap; the President's dais and desk up top
  const [tx, ty, tw, thh] = D.tables.centreTable, [cx2, cy2, cw, ch2] = D.tables.clerkTable, [px, py, pw, ph] = D.tables.presidentDesk, [dx, dy, dw, dh] = D.dais;
  g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood;
  rb(tx - D.cx, ty - D.cy, tw, thh, 6);
  g.fillStyle = carpet; g.lineWidth = hair; g.strokeStyle = css(th.line); rb(tx - D.cx + 10, ty - D.cy + 10, tw - 20, thh - 20, 3);
  g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood; g.fillStyle = bench; rb(cx2 - D.cx, cy2 - D.cy, cw, ch2, 4);
  g.lineWidth = hair; g.strokeStyle = css(th.line);
  g.fillStyle = wood; rb(dx - D.cx, dy - D.cy, dw, dh, 8);
  g.fillStyle = bench; rb(dx - D.cx + 6, dy - D.cy + 6, dw - 12, dh - 12, 5);
  g.fillStyle = wood; rb(px - D.cx, py - D.cy, pw, ph, 3);
  g.fillStyle = bench; rb(px - D.cx + 6, py - D.cy + 6, pw - 12, ph - 12, 2);
  g.restore();
  // the empty seats, outlined only, so they never read as a member's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    if (opts.occupied && opts.occupied.has(c.k)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  // the officials: the clerks, the chairs at the centre table's head, the advisers
  for (const [id, [px, py]] of Object.entries(D.officers)) {
    const fa = D.advisers.includes(id) ? 0 : Math.PI / 2;
    drawChair(g, X(P(px - D.cx)), Yp(P(py - D.cy)), fa, P(38) * s, P(36) * s, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
}
// the walkways between rows (0 inside the front bench, 5 outside the back row), on the straight and round the curve
const CH_GS = [96, 124, 159.5, 202, 243.5, 279].map((v) => v / CU);
const CH_GC = [77, 114.5, 159, 201, 243, 279].map((v) => v / CU);
function benchPt(s, k, W = null) {
  const GS = W ?? CH_GS, GC = W ?? CH_GC;
  if (s <= 0) return [-GS[k], s];
  if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
  const a = s / CHK; return [-GC[k] * Math.cos(a), GC[k] * Math.sin(a)];
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
    case "fp": case "senate": return divValue(m, d.i);
    case "flow": case "senpref": case "informal": case "seifa": { const v = divValue(m, d.i); return v == null ? null : v + (S.lens === "seifa" && !isDemo() && d.seifa[S.index] ? d.seifa[S.index].pct / 100 : 0); }
    case "cls": return d.cls ? 10 - CLS.indexOf(d.cls) + d.winPct / 1000 : null;
    default: return d.winPct;
  }
}
/* the Prime Minister and the Leader of the Opposition sit at the table, government side and
   opposition side, as the House sat after each election (the 2013 and 2016 plans print them on the
   front bench instead and leave the table's chairs empty; March 2021's has only Morrison there) */
const LEADERS = { 2004: ["Bennelong", "Werriwa"], 2007: ["Griffith", "Bradfield"], 2010: ["Lalor", "Warringah"],
  2013: ["Warringah", "Maribyrnong"], 2016: ["Wentworth", "Maribyrnong"], 2019: ["Cook", "Grayndler"],
  2022: ["Grayndler", "Dickson"], 2025: ["Grayndler", "Farrer"], now: ["Grayndler", "Hume"],
  // South Australia's Premier and Leader of the Opposition, at the front benches' seats nearest the Speaker
  sa22: ["Croydon", "Black"], sa26: ["Croydon", "Schubert"],
  // New South Wales' (Minns at Kogarah, Speakman at Cronulla — Sloane succeeds
  // Speakman as Opposition Leader 21 November 2025)
  nsw23: ["Kogarah", "Cronulla"], nswnow: ["Kogarah", "Vaucluse"],
  // Queensland's Premier and Leader of the Opposition, at the front benches' heads:
  // Palaszczuk/Nicholls at 2017, Palaszczuk/Frecklington at 2020, and 2024's incoming
  // front-runners: the LNP's Crisafulli flips the chamber to Broadwater against Labor's Miles
  qld17: ["Inala", "Clayfield"], qld20: ["Inala", "Nanango"], qld24: ["Broadwater", "Murrumba"], qldnow: ["Broadwater", "Murrumba"],
  // Victoria's, three a side at the table in the 60th Parliament's plan: the Premier, the Leader
  // of the House and the Deputy Premier facing the Opposition Leader, the Deputy Leader of the
  // Opposition and the Nationals' leader (Carroll, Carbines, Williams against Wilson, Southwick, O'Brien)
  vic22: ["Niddrie", "Kew", "Ivanhoe", "Caulfield", "Dandenong", "Gippsland South"] };
/* seating plan or sorted: a year with a filed plan opens on it under the Winner lens and
   sorted under the others, until the reader picks one (S.seat) */
const seatMode = (m) => (!m.seating ? "sort" : S.seat || ((m.house === "senate" ? S.senLens === "party" : S.lens === "winner") ? "plan" : "sort"));
function chamberOrder(m) {
  const plan = seatMode(m) === "plan" ? m.seating : null;
  const key = plan ? `${m.year}|plan` : m.house === "senate" ? `${m.year}|${S.senLens}` : `${m.year}|${S.lens}|${S.tppMode}|${S.fpMode}|${S.party}|${S.from}|${S.vs}|${S.spPair}|${S.spFrom}|${S.index}`;
  if (m._chKey === key) return m._ch;
  const geom = chamberGeom(m);
  const keyOf = m.house === "senate" ? senateKey : chamberKey;
  const { gov, opp, cross } = chamberBlocs(m);
  const members = m.divs.filter((d) => d.i !== m.speaker);
  const byKey = (bloc) => (p, q) => {
    const a = keyOf(m, p, bloc), b = keyOf(m, q, bloc);
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
  // the leaders, each at their side's table chair (when they lead the bloc on that side)
  const table = geom.table.map((id) => geom.byId.get(id));
  const lead = (m.leaders || LEADERS[m.year] || []).map((n, s) => { const i = typeof n === "number" ? n : m.byName.get(n); return i != null && holdFam(m.divs[i].hold) === (s < table.length / 2 ? gov : opp) ? i : null; });
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
    // a leader the plan prints on the bench moves to their table chair, if the plan left it empty
    lead.forEach((i, s) => { if (i != null && at.get(i) !== table[s] && !taken.has(table[s])) at.set(i, table[s]); });
  } else {
    // no plan: the government from its Speaker's end, the crossbench after it, the opposition from
    // the other end; the empty seats fall between the crossbench and the opposition, so the
    // majority line never has to cross them
    // the leaders at the table
    // (the states' table chairs are desks on the front bench: a leader's is theirs alone)
    const held = new Set(lead.map((i, s) => (i != null ? table[s] : null)));
    // geom.vacant (a floor with more seats than members, Sydney's Council's ledger) names the
    // spare desks: the fill walks past them and they draw as empty outlined seats
    const B = geom.bench.filter((c) => !held.has(c.k) && !(geom.vacant && geom.vacant.has(c.k))), onBench = (d) => !lead.includes(d.i);
    lead.forEach((i, s) => { if (i != null) at.set(i, table[s]); });
    const Gb = G.filter(onBench), Ob = O.filter(onBench);
    if (geom.blocSeats) {
      // Sydney's crossbenches are separate furniture at the entrance end. Filling one
      // continuous horseshoe put government members on that transverse bench and left
      // members' table chairs empty. Keep each sorted bloc in its physical area.
      const free = new Set(B.map((c) => c.k)), pending = [];
      for (const [bloc, ds] of [["gov", Gb], ["opp", Ob], ["cross", C]]) {
        const slots = geom.blocSeats[bloc].filter((k) => free.has(k));
        ds.forEach((d, j) => { if (j < slots.length) { at.set(d.i, slots[j]); free.delete(slots[j]); } else pending.push(d); });
      }
      // Preserve every member if a future dataset changes the bloc sizes.
      const rest = [...free];
      pending.forEach((d, j) => at.set(d.i, rest[j]));
    } else {
      Gb.forEach((d, k) => at.set(d.i, B[k].k));
      C.forEach((d, k) => at.set(d.i, B[Gb.length + k].k));
      Ob.forEach((d, k) => at.set(d.i, B[B.length - 1 - k].k));
    }
  }
  const order = [...G, ...C, ...O].map((d) => d.i);
  const sp = m.divs[m.speaker];
  // (the Senate counts its 76 seats, a vacant one among them)
  const N = m.seatsN || m.divs.length, maj = Math.floor(N / 2) + 1;
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
  const cuts = [], free = [], gaps = [];
  // (past a row's end, clear of its last chair: the House's chairs are smaller than the states')
  const pad = geom.cutPad || 0.4;
  for (let r = 1; r <= geom.nRows; r++) {
    const row = geom.rows[r];
    let L = -1;
    row.forEach((c, j) => { if (inside.has(c.k)) L = j; });
    if (L < 0) row.forEach((c, j) => { if (c.s < sStar) L = j; });
    let a = row[L], b = row[L + 1];
    // on the states' floors a row breaks off (a front bench that doesn't curve, a straight bench
    // meeting its curve, the gangway between the curves): where the cut falls in such a break it
    // crosses open floor, so it may sit anywhere in it, and goes where the rows with chairs at the
    // line put it
    // line put it (a curve's chairs clear by their own pad: the same gap is more of the angle on a
    // tight curve)
    if (geom.rect && (!a || !b || a.seg !== b.seg)) { free.push([cuts.length, a ? a.s + (a.pad || pad) : -Infinity, b ? b.s - (b.pad || pad) : Infinity]); cuts.push(null); continue; }
    cuts.push(a && b ? (a.s + b.s) / 2 : a ? a.s + pad : b.s - pad);
    if (!geom.rect) {
      // Account for the full chair, including its inner corners on the curve.
      const clearance = (c) => c.y > 0 ? CHK * Math.atan2(c.W / 2 + 0.05, Math.hypot(c.x, c.y) - c.D / 2) : c.W / 2 + 0.05;
      const lo = a ? a.s + clearance(a) : -Infinity, hi = b ? b.s - clearance(b) : Infinity;
      // Very tight gaps retain their original midpoint.
      gaps.push(lo <= hi ? [lo, hi] : [cuts[cuts.length - 1], cuts[cuts.length - 1]]);
    }
  }
  // Adjacent rows whose gaps overlap share one crossing position. This removes
  // little side steps without moving the line past any counted member.
  for (let first = 0; first < gaps.length;) {
    let last = first + 1, [lo, hi] = gaps[first];
    while (last < gaps.length && Math.max(lo, gaps[last][0]) <= Math.min(hi, gaps[last][1])) {
      lo = Math.max(lo, gaps[last][0]); hi = Math.min(hi, gaps[last][1]); last++;
    }
    const mean = cuts.slice(first, last).reduce((sum, v) => sum + v, 0) / (last - first);
    for (let r = first; r < last; r++) cuts[r] = clamp(mean, lo, hi);
    first = last;
  }
  const tight = cuts.filter((c) => c != null), to = tight.length ? tight.reduce((x, y) => x + y, 0) / tight.length : sStar;
  for (const [r, lo, hi] of free) cuts[r] = clamp(to, lo, hi);
  // front rows with no chairs where the line falls (a front bench that stops short of the curves)
  // it doesn't cross at all: it starts behind them
  // (a lone seat counts with its side's curve; the gangway runs between the curves)
  const stretch = (g) => g - (g % 3 === 2 ? 1 : 0);
  const meets = (row, s) => { const at = geom.segAt(s); return row.some((c) => (at < 0 ? stretch(c.seg) % 3 === 1 : stretch(c.seg) === at)); };
  if (geom.rect) for (let r = 0; r < cuts.length - 1 && !meets(geom.rows[r + 1], cuts[r]); r++) cuts[r] = null;
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
  const arms = { L: [], R: [] };
  for (const [i, k] of ch.at) {
    const st = geom.seats[k];
    if (geom.arms && /^[LR]a\d/.test(st.id)) { arms[st.id[0]].push([i, st]); continue; }
    pos.set(m.divs[i].n, [st.x, st.y, st.fa, st.u, st.W, st.D]);
  }
  // the front bench's arm is one long bench: whoever sits there spreads evenly along it, in order,
  // each chair as wide as the share allows, as the plans print them
  const A = geom.src ? geom.src.arm : CHB.arm, top = A.y0 - A.pitch / 2, len = A.pitch * A.n;
  for (const list of Object.values(arms)) {
    list.sort((a, b) => a[1].y - b[1].y);
    const p = len / Math.max(list.length, 1), W = clamp(p - 3, 13.5, 21) / CU;
    list.forEach(([i, st], j) => pos.set(m.divs[i].n, [st.x, (top + p * (j + 0.5)) / CU, st.fa, st.u, W, st.D]));
  }
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
// the open aisle on the centre line, between the Hansard desk and the back rows' inner ends
const CH_AISLE = 52 / CU;
const SPEAKER_AT = [0, -365 / CU, Math.PI / 2, 0, 27 / CU, 24 / CU];

/* the room: the floor, the benches and their empty seats, the dais, the table, the officers' chairs */
function drawChamberFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, P = (v) => v / CU;
  const rr = (x0, y0, x1, y1, r) => { g.beginPath(); if (g.roundRect) g.roundRect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s, r); else g.rect(X(P(x0)), Yp(P(y0)), P(x1 - x0) * s, P(y1 - y0) * s); };
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // the floor: its semicircle's radius is each chamber's own (the House's 282 points ends
  // with the backs of its back bench; Sydney's with its Serjeant's — geomFor's fr)
  const FR = geom.fr ?? P(282), top = P(-380);
  g.beginPath(); g.moveTo(X(-FR), Yp(top)); g.lineTo(X(-FR), Yp(0)); g.arc(X(0), Yp(0), FR * s, Math.PI, 0, true); g.lineTo(X(FR), Yp(top)); g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  // the benches (the House's plan, or Victoria's of it; Macquarie Street's pairs of
  // straight files flank the table and three curved rows close the floor, nothing between
  // them and the dais)
  g.fillStyle = bench;
  const B = geom.src, D = Math.PI / 180;
  for (const sx of [-1, 1]) {
    const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
    { const [x0, x1] = lo(sx * (B.arm.x - 13), sx * (B.arm.x + 13)); rr(x0, B.arm.y0 - 12, x1, B.arm.y0 + B.arm.pitch * (B.arm.n - 1) + 12, 2); g.fill(); g.stroke(); }
    if (B.row2X !== undefined) { const [x0, x1] = lo(sx * (B.row2X - 13), sx * (B.row2X + 13)), y0 = B.row2Y0 ?? B.arm.y0; rr(x0, y0 - 12, x1, y0 + B.arm.pitch * (B.arm.n - 1) + 12, 2); g.fill(); g.stroke(); }
    for (const bx of B.blockX ?? []) for (const [t0, t1] of B.tierY) { const [x0, x1] = lo(sx * (bx - 13.5), sx * (bx + 13.5)); rr(x0, t0 - 14, x1, t1 + 14, 2); g.fill(); g.stroke(); }
    B.sectors.forEach((secs, k) => secs.forEach(([a0, a1]) => {
      const r0 = P(B.R[k] - 13.5) * s, r1 = P(B.R[k] + 13.5) * s;
      // angles on the canvas: the government's quarter runs from pi back towards pi/2, the opposition's from 0 to pi/2
      const A0 = sx < 0 ? Math.PI - a0 * D : a0 * D, A1 = sx < 0 ? Math.PI - a1 * D : a1 * D;
      g.beginPath(); g.arc(X(0), Yp(0), r1, A0, A1, sx < 0); g.arc(X(0), Yp(0), r0, A1, A0, sx > 0); g.closePath(); g.fill(); g.stroke();
    }));
    // the officials' boxes behind the front bench, on a rail — three low boxes a
    // side in the House and at Spring Street; Macquarie Street stands ONE broad
    // side-on box a side, its length along the rail (2026-10-27 user call)
    if (geom.nsw) { const [x0, x1] = lo(sx * 159.8, sx * 210.8); rr(x0, -359.5, x1, -335.5, 2); g.fill(); g.stroke(); }
    else for (const cx of [222.9, 189.6, 147.7]) { const [x0, x1] = lo(sx * (cx - 12), sx * (cx + 12)); rr(x0, -373, x1, -322, 2); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(X(P(sx * 236)), Yp(P(-318))); g.lineTo(X(P(sx * 121)), Yp(P(-318))); g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = wood; g.stroke(); g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // the Speaker's dais, raised above the floor, its step drawn inside
  const dais = (inset) => { const w = 34 - inset, yt = -393 + inset, yc = -349; g.beginPath(); g.moveTo(X(P(-w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yt))); g.lineTo(X(P(w)), Yp(P(yc))); g.arc(X(0), Yp(P(yc)), P(w) * s, 0, Math.PI); g.closePath(); };
  dais(0); g.fillStyle = wood; g.fill(); g.stroke();
  dais(5); g.fillStyle = bench; g.fill();
  // the table: a T, the wider head towards the Speaker; its panels, and the mace at the far
  // end (at Sydney's Assembly the table's head lies away from the Speaker) — New South
  // Wales' Assembly's is one clean rectangle (no T head), and its Hansard sits nowhere near it
  g.beginPath();
  for (const [x, y] of (geom.nsw ? [[-45.8, -268.6], [44.3, -268.6], [44.3, -110], [-45.8, -110]]
    : [[-45.8, -268.6], [44.3, -268.6], [44.3, -215.2], [35, -215.2], [35, -110], [-36.6, -110], [-36.6, -215.2], [-45.8, -215.2]])) g.lineTo(X(P(x)), Yp(P(y)));
  g.closePath(); g.fillStyle = bench; g.fill(); g.lineWidth = Math.max(1, s * 0.05); g.strokeStyle = wood; g.stroke();
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // the House's table is panelled and grooved for the mace; Spring Street's and Macquarie
  // Street's tops are one clean sheet
  if (!geom.vic && !geom.nsw) {
    g.beginPath();
    for (const x of [-15.5, 14.5]) { g.moveTo(X(P(x)), Yp(P(-266))); g.lineTo(X(P(x)), Yp(P(-218))); }
    g.moveTo(X(P(-0.8)), Yp(P(-212))); g.lineTo(X(P(-0.8)), Yp(P(-113)));
    for (const y of [-180, -145]) { g.moveTo(X(P(-34)), Yp(P(y))); g.lineTo(X(P(32.5)), Yp(P(y))); }
    g.stroke();
  }
  if (s > 9) {
    const my = -123;
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(1, s * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(X(P(-19)), Yp(P(my))); g.lineTo(X(P(17)), Yp(P(my))); g.stroke();
    g.beginPath(); g.arc(X(P(-19)), Yp(P(my)), s * 0.12, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
    g.lineCap = "butt"; g.lineWidth = 1; g.strokeStyle = css(th.line);
  }
  // Hansard's desk at the table's foot (the Assembly in Sydney has none)
  if (!geom.nsw) { rr(-31.5, -63, 31.5, -34, 2); g.fillStyle = wood; g.fill(); g.stroke(); }
  // the empty seats, outlined only, so they never read as a member's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    // the front bench's arms are one long bench, not places: only the seats elsewhere stand empty
    if ((opts.occupied && opts.occupied.has(c.k)) || /^[LR]a\d/.test(c.id)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  g.strokeStyle = css(th.line);
  const W = (20 / CU) * s, Dp = (18 / CU) * s;
  // the officers: the Clerks at the table's head (two of the House and of Sydney's Assembly,
  // three of Spring Street's), Hansard's two reporters, the Serjeant-at-Arms
  const sj = geom.serjeant;
  for (const [x, y, fa] of [...geom.officers, ...(geom.nsw ? [] : [[-19.7, -21.5, -Math.PI / 2], [18.2, -21.5, -Math.PI / 2]]), [sj.x * CU, sj.y * CU, sj.fa]])
    drawChair(g, X(P(x)), Yp(P(y)), fa, W, Dp, css(officer), back(officer, 0.18), 1);
  // the furniture's names, where they fit (Sydney's Assembly names none)
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    if (!geom.nsw) {
      put("The table", 0, P(-196), P(66));
      put("Hansard", 0, P(-48.5), P(58));
    }
  }
}

// draw the whole chamber into a context already scaled to CSS pixels
function drawChamber(g, m, w, h, opts) {
  const geom = chamberGeom(m);
  const pad = opts.pad || { t: 8, r: 8, b: 8, l: 8 };
  // the labels' room: the canvas, or in full screen the clear ground between the plates
  const eL = opts.big && FS.on ? FS.ins.l : 0, eR = opts.big && FS.on ? w - FS.ins.r : w;
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
    return [lerp(fr[0], to[0], q), lerp(fr[1], to[1], q), angLerp(fr[2], to[2], q), to[3], lerp(fr[4] ?? to[4], to[4], q), lerp(fr[5] ?? to[5], to[5], q)];
  };
  const X = F.X, Yp = F.Yp, rO = geom.rOut;
  // where the painted carpet reaches (a label dodges it), not just the outer chairs' backs
  const floorR = geom.fr ?? rO + 0.5;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  geom.furniture(g, F, geom, { ...opts, occupied: chAnim ? null : new Set(ch.at.values()) });
  // the chairs
  // the list's filters are the House's seats'; the Senate answers only to the chosen state
  const filt = m.house !== "senate" && filtersOn(), sd = opts.sel, hv = opts.hover, stSel = opts.state;
  // a figures-menu seat type colours its chamber too: only ITS OWN kind wears
  // the ladder tone — the ladder's neighbours sit a mere alpha-step from it,
  // so every other kind ghosts to an ink wisp (user call: the lit kind must
  // read at a glance, 2026-11-08)
  const clsSel = opts.cls, clsTone = clsSel ? (i) => { const k = CLS.indexOf(m.divs[i].cls); return k < 0 ? null : TH.cls[k]; } : null;
  const pat = opts.pattern;
  const backOf = (c) => towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22);
  const drawn = [];
  const paint = (i, x, y, fa, W, D, sp) => {
    const d = m.divs[i];
    const offType = clsSel && d.cls !== clsSel;
    let c = (clsTone && !offType && clsTone(i)) || (offType ? th.ink : fillDiv(m, i));
    let a = 1;
    if (filt && !passes(m, i)) a = 0.16;
    if (stSel && d.st !== stSel) a = Math.min(a, 0.2);
    if (offType) a = Math.min(a, 0.28);
    if (opts.only != null && i !== opts.only) a = Math.min(a, 0.22);
    if (!c) { drawChair(g, x, y, fa, W, D, pat || css(th.nodata), css(th.hatch), a); }
    else drawChair(g, x, y, fa, W, D, css(c), css(backOf(c)), a);
    drawn.push({ i, x, y, r: Math.max(W, D) * 0.62, fa, W, D, sp });
  };
  ch.order.forEach((i) => {
    const p = pos(m.divs[i].n); if (!p) return;
    paint(i, X(p[0]), Yp(p[1]), p[2], p[4] * s, p[5] * s);
  });
  // the Speaker's (the President's) chair, at the head of the table, facing down the chamber
  const CA = geom.chairAt;
  if (m.speaker != null) paint(m.speaker, X(CA[0]), Yp(CA[1]), CA[2], CA[4] * s, CA[5] * s, true);
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
  // Federal seating plans use the sorted chamber's threshold geometry too:
  // changing the lens or choosing As seated must not move the majority line.
  // Sorting changes which members occupy the slots, not the threshold itself.
  const majorityCh = ch.plan && !STATE_YEARS.has(m.year)
    ? (m._majorityCh ||= chamberOrder({ ...m, seating: null, _chKey: null })) : ch;
  // Sydney's Council retains its standalone figure below the floor.
  // The 2019 federal House's majority falls in the central aisle. Keep the
  // marker on its centreline, independent of occupied chairs or the lens.
  const cuts = opts.labels !== false && geom.key !== "nswLC" ? majorityCuts(majorityCh, geom) : null;
  if (cuts && m.year === 2019 && m.house !== "senate") cuts.fill(Math.PI * CHK / 2);
  if (!cuts && geom.key === "nswLC" && opts.labels !== false && (opts.big || s > 6)) {
    const mt = `${ch.maj} for a majority`, my = Yp(geom.box.y1 + 0.62);
    g.font = `600 ${opts.big ? 12 : 11}px ${SANS}`; g.fillStyle = css(th.ink2);
    g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(mt, X(0), my);
    claim(X(0), my, g.measureText(mt).width, 16, "center", "top");
  }
  if (cuts) {
    const pts = [];
    cuts.forEach((c, k) => {
      if (c == null) return;
      if (cuts[k - 1] != null) { const cp = cuts[k - 1], n = Math.max(2, Math.ceil(Math.abs(c - cp) * 3)); for (let j = 1; j <= n; j++) pts.push(geom.benchPt(lerp(cp, c, j / n), k)); }
      else pts.push(geom.benchPt(c, k));
      pts.push(geom.benchPt(c, k + 1));
    });
    const c5 = cuts[cuts.length - 1], o = geom.benchOut(c5), e = geom.benchPt(c5, geom.nRows), ext = opts.big ? 0.45 : 0.2;
    pts.push([e[0] + o[0] * ext, e[1] + o[1] * ext]);
    g.strokeStyle = css(th.ink); g.lineWidth = opts.big ? 1.5 : 1.2; g.setLineDash([]); g.lineJoin = "round";
    // Round the turns in the walkways, keeping the crossings through each row's
    // seat gap. A small radius stays clear of chairs and removes the sharp steps.
    g.beginPath(); g.moveTo(X(pts[0][0]), Yp(pts[0][1]));
    for (let j = 1; j < pts.length - 1; j++) {
      const a = pts[j - 1], b = pts[j], c = pts[j + 1];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(0.22, ab / 2, bc / 2);
      if (r < 1e-6) { g.lineTo(X(b[0]), Yp(b[1])); continue; }
      g.lineTo(X(lerp(b[0], a[0], r / ab)), Yp(lerp(b[1], a[1], r / ab)));
      g.quadraticCurveTo(X(b[0]), Yp(b[1]), X(lerp(b[0], c[0], r / bc)), Yp(lerp(b[1], c[1], r / bc)));
    }
    const end = pts[pts.length - 1]; g.lineTo(X(end[0]), Yp(end[1])); g.stroke();
    const p2 = [e[0] + o[0] * (opts.big ? 0.8 : 0.45), e[1] + o[1] * (opts.big ? 0.8 : 0.45)];
    const below = p2[1] > 1;
    if (!opts.big && s > 6) {
      g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : "center"; g.textBaseline = below ? "top" : "middle";
      // a chamber filling the width (a phone): shift sideways to stay on the canvas
      const mt = `${ch.maj} for a majority`, tw = g.measureText(mt).width;
      let mx = X(p2[0]);
      if (g.textAlign === "left") mx = Math.min(mx, w - 4 - tw);
      else if (g.textAlign === "right") mx = Math.max(mx, 4 + tw);
      else mx = Math.min(Math.max(mx, 4 + tw / 2), w - 4 - tw / 2);
      g.fillText(mt, mx, Yp(p2[1]));
    }
    if (opts.big) {
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2);
      g.textAlign = p2[0] < -0.5 ? "right" : p2[0] > 0.5 ? "left" : below ? "right" : "center"; g.textBaseline = below ? "top" : "middle";
      const mt = `${ch.maj} for a majority`, tw = g.measureText(mt).width;
      let mx = X(p2[0]) + (below && Math.abs(p2[0]) <= 0.5 ? -6 : 0), my = Yp(p2[1]);
      // a chamber filling the width (a phone): kept on screen, slid down off the floor
      const x0 = () => (g.textAlign === "right" ? mx - tw : g.textAlign === "center" ? mx - tw / 2 : mx);
      if (x0() < 4) {
        mx += 4 - x0();
        const floor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v > 0 && Math.hypot(u, v) <= floorR; };
        const top = g.textBaseline === "top" ? 0 : -8;
        while (my < h - 18 && [x0(), x0() + tw / 2, x0() + tw].some((px) => floor(px, my + top) || floor(px, my + top + 15))) my += 2;
      }
      g.fillText(mt, mx, my);
      claim(mx, my, tw, 16, g.textAlign, g.textBaseline);
      // the majority line itself, beyond the benches
      const ex = X(e[0]), ey = Yp(e[1]), fx = X(p2[0]), fy = Yp(p2[1]);
      occ.push({ x0: Math.min(ex, fx) - 3, y0: Math.min(ey, fy) - 3, x1: Math.max(ex, fx) + 3, y1: Math.max(ey, fy) + 3 });
    }
  }
  // the blocs' names and numbers, outside the benches
  if (opts.big) {
    const fig = (txt, col, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 30px ${SANS}`; g.fillStyle = css(col); g.fillText(txt, x, y); };
    const lab = (txt, x, y, align) => { g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink); g.fillText(txt, x, y); };
    const govName = blocName(m, ch.gov), oppName = blocName(m, ch.opp);
    const yMid = Yp(geom.yMid);
    const room = X(-rO - 0.8);
    // no room beside the benches: the blocs head the chamber, either side of the Speaker
    let bandRoom = null;
    const band = room <= 70 && F.oy + geom.box.y0 * s >= 59;
    if (band) {
      const y0 = Yp(geom.box.y0);
      const spFam = m.divs[m.speaker] && holdFam(m.divs[m.speaker].hold);
      // the roles go first when the Speaker's name would touch them
      g.font = `400 12px ${SANS}`;
      const half = X(0) - X(geom.box.x0), need = (g.measureText(presiding(m).name || "").width) / 2 + 10;
      const nGov = String(ch.nGov + (spFam === ch.gov ? 1 : 0)), nOpp = String(ch.nOpp + (spFam === ch.opp ? 1 : 0));
      g.font = `500 24px ${SANS}`; const wNum = Math.max(g.measureText(nGov).width, g.measureText(nOpp).width);
      g.font = `400 12px ${SANS}`; const withRole = half - wNum - 5 - g.measureText("Government").width >= need;
      const bandLabel = (name, n, fam, role, x, align) => {
        if (!withRole) role = "";
        lab(name, x, y0 - 34, align);
        g.textAlign = align; g.textBaseline = "alphabetic"; g.font = `500 24px ${SANS}`; g.fillStyle = css(th.party[fam]); g.fillText(n, x, y0 - 9);
        const wn = g.measureText(n).width;
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3); g.fillText(role, align === "left" ? x + wn + 5 : x - wn - 5, y0 - 9);
        const wr = g.measureText(role).width;
        g.font = `600 13px ${SANS}`; const wd = Math.max(g.measureText(name).width, wn + 5 + wr);
        claim(x, y0 - 48, wd, 44, align, "top");
        return wd;
      };
      const wl = bandLabel(govName, nGov, ch.gov, "Government", X(geom.box.x0), "left");
      const wr = bandLabel(oppName, nOpp, ch.opp, "Opposition", X(geom.box.x1), "right");
      bandRoom = Math.min(X(0) - X(geom.box.x0) - wl, X(geom.box.x1) - X(0) - wr) * 2 - 16;
      // the phone band holds no side column: name the crossbench over the Speaker's block —
      // it can outnumber the opposition and the key below was never meant to carry it alone
      if (ch.nCross) {
        const ct = `Crossbench ${ch.nCross}`;
        g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = `600 11px ${SANS}`; g.fillStyle = css(th.ink2);
        // it shares the band with the Speaker's two lines below: at y0-46 its ink
        // bottom sat 3px off the Speaker's cap line and the pair read as one - lift
        // it (the arc chambers' y0 is a fixed 62, so the top stays in-canvas)
        g.fillText(ct, X(0), y0 - 50);
        claim(X(0), y0 - 60, Math.max(g.measureText(ct).width, 40), 14, "center", "top");
      }
    }
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
      // the crossbench's name and make-up in the column beside the chamber, on the side its chairs
      // lean to, under that side's bloc label; never under the chamber, so where they sit can't
      // change the room the chamber is drawn in
      let mx = 0, my = 0, n = 0;
      for (const i of ch.order) { const d = m.divs[i]; if (holdFam(d.hold) === ch.gov || holdFam(d.hold) === ch.opp) continue; const c = geom.seats[ch.at.get(i)]; mx += c.x; my += c.y; n++; }
      mx /= n; my /= n;
      const side0 = geom.crossSide || (mx < 0 ? "right" : "left");
      // wrap the make-up to the room on that side, and find where the block's box falls
      const lay = (side, by, mode) => {
        const bx = X(side === "left" ? rO + 0.95 : -rO - 0.95);
        const maxW = Math.max(120, side === "left" ? eR - bx - 4 : bx - eL - 4);
        g.font = `400 12px ${SANS}`;
        // one middot-joined line if the whole make-up fits; otherwise a
        // stacked list, one party to a line — packing two to a line leaves a
        // ragged ladder ("Centre Alliance 1 · Greens 1" under two lone lines),
        // so it's the last resort, for when the stack is too tall to fit
        const parts = crossParts(m, ch);
        const one = parts.join(" · ");
        let lines;
        if (mode === "one") lines = g.measureText(one).width <= maxW ? [one] : null;
        else if (mode === "stack") lines = parts.length > 1 ? parts : null;
        else {
          lines = []; let line = "";
          for (const p of parts) { const t = line ? line + " · " + p : p; if (g.measureText(t).width > maxW && line) { lines.push(line); line = p; } else line = t; }
          if (line) lines.push(line);
          if (lines.length < 2 || lines.length >= parts.length) lines = null;
        }
        if (!lines) return null;
        let wMax = 0;
        for (const l of lines) wMax = Math.max(wMax, g.measureText(l).width);
        g.font = `600 13px ${SANS}`; wMax = Math.max(wMax, g.measureText(`Crossbench ${ch.nCross}`).width + 10);
        const x0 = side === "left" ? bx : bx - wMax, ht = 17 + lines.length * 15;
        // no room beside the chamber on a narrow screen: the key below gives the counts
        const room = (side === "left" ? eR - bx : bx - eL) >= wMax + 4;
        // clear of the other labels, and off the chamber's floor (a phone has no room beside it)
        const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v <= 0 ? v >= geom.box.y0 && Math.abs(u) <= floorR : Math.hypot(u, v) <= floorR; };
        const clear = by + ht <= h - 2 && !occ.some((o) => x0 < o.x1 + 4 && x0 + wMax > o.x0 - 4 && by < o.y1 + 3 && by + ht > o.y0 - 3)
          && ![[x0, by], [x0 + wMax, by], [x0, by + ht], [x0 + wMax, by + ht], [x0 + wMax / 2, by], [x0, by + ht / 2], [x0 + wMax, by + ht / 2]].some(([px, py]) => onFloor(px, py));
        return { side, bx, by, lines, wMax, ht, room, clear };
      };
      // level with its chairs, but no higher than just under the bloc label; nudged up or down if
      // the majority label is in the way, else the other side
      const top = yMid + 40, by0 = Math.max(Yp(my) - 8, top);
      const other = side0 === "left" ? "right" : "left";
      const steps = [0, -1, 1, -2, 2, -3, 3, -4, 4, 5, 6].map((k) => by0 + k * 18).filter((by) => by >= top);
      const spots = [...steps.map((by) => [side0, by]), ...steps.map((by) => [other, by])];
      const tries = ["one", "stack", "pack"].flatMap((mode) => spots.map(([sd, by]) => lay(sd, by, mode))).filter(Boolean);
      const L = tries.find((c) => c.room && c.clear);
      if (L) {
        g.textAlign = L.side; g.textBaseline = "top";
        g.font = `600 13px ${SANS}`; g.fillStyle = css(th.ink);
        g.fillText(`Crossbench ${ch.nCross}`, L.bx, L.by);
        g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
        L.lines.forEach((l, j) => g.fillText(l, L.bx, L.by + 17 + j * 15));
        claim(L.bx, L.by, L.wMax, L.ht, L.side, "top");
      }
    }
    // the Speaker (the President), named above the chair
    const sp = m.divs[m.speaker], pr = presiding(m);
    if (sp && bandRoom != null) {
      // between the blocs' labels: two lines, the seat dropped if the name alone fits
      const y = Yp(geom.box.y0);
      g.textBaseline = "alphabetic"; g.textAlign = "center";
      g.font = `600 12px ${SANS}`; g.fillStyle = css(th.ink2); g.fillText(pr.role, X(0), y - 32);
      g.font = `400 12px ${SANS}`; g.fillStyle = css(th.ink3);
      const full = `${pr.name}, ${pr.place}`, nm = g.measureText(full).width <= bandRoom ? full : pr.name;
      g.fillText(nm, X(0), y - 10);
      claim(X(0), y - 46, Math.max(g.measureText(nm).width, 50), 44, "center", "top");
    } else if (sp) {
      const a = pr.role, b = `  ${pr.name}, ${pr.place}`, y = Yp(geom.box.y0) - 9;
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
    const onFloor = (px, py) => { const u = (px - F.ox) / s, v = (py - F.oy) / s; return geom.rect ? saOnFloor(geom, u, v) : v <= 0 ? v >= geom.box.y0 && Math.abs(u) <= floorR : Math.hypot(u, v) <= floorR; };
    const boxAt = (lx, ly) => {
      const x0 = align === "right" ? lx - 6 - tw : align === "center" ? lx - tw / 2 : lx + 6;
      const y0 = side ? ly - th2 / 2 : ly + 5;
      return { x0, y0, x1: x0 + tw, y1: y0 + th2 };
    };
    const free = (b) => b.x0 >= eL + 4 && b.x1 <= eR - 4 && b.y0 >= 0 && b.y1 <= h - 2
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
      box = { x0: clamp(q.x - tw / 2, eL + 4, eR - 4 - tw), y0: Math.max(2, q.y - q.r - 22) };
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
const blocName = (m, fam) => (fam === "alp" ? "Labor" : STATE_YEARS.has(m.year) ? "Liberals" : "Coalition");
function crossParts(m, ch) {
  const cnt = {};
  for (const i of ch.order) { const d = m.divs[i]; if (d.hold.fam === ch.gov || d.hold.fam === ch.opp) continue; const k = crossLabel(d.hold); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`);
}
function crossLabel(h) {
  if (h.ab === "CSA") return "Community Strong";
  const f = h.fam;
  if (f === "ind") return "Independents";
  if (f === "grn") return "Greens";
  if (f === "onp") return "One Nation";
  return partyShort(h.ab, h.pn);
}
const SPEAKERS = { 2004: "David Hawker", 2007: "Harry Jenkins", 2010: "Harry Jenkins", 2013: "Bronwyn Bishop", 2016: "Tony Smith", 2019: "Tony Smith", 2022: "Milton Dick", 2025: "Milton Dick", now: "Milton Dick",
  sa22: "Dan Cregan", sa26: "Nat Cook", nsw23: "Greg Piper", vic22: "Maree Edwards",
  qld17: "Curtis Pitt", qld20: "Curtis Pitt", qld24: "Pat Weir" };
const speakerName = (m) => SPEAKERS[m.year];
// the chair's occupant as the chamber names them: the Speaker and their seat, the President and their state
const presiding = (m) => (m.house === "senate" ? (m.speaker != null ? { role: "President", name: m.divs[m.speaker].n, place: STATE_SHORT[m.divs[m.speaker].st] } : { role: "President", name: "", place: "" }) : { role: "Speaker", name: speakerName(m), place: m.divs[m.speaker] && m.divs[m.speaker].n });

let chMain = null; // the last full-size draw: chairs on screen, for hit tests and the morph
function chamberHit(m, px, py) {
  if (!chMain) return null;
  let best = null, bd = Infinity;
  for (const q of chMain.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 3 && d < bd) { bd = d; best = q.i; } }
  return best == null ? null : { kind: m.house === "senate" ? "sen" : "div", i: best };
}
// a phone has no room beside the chamber: it fills the width, its bloc labels in a band above
function chamberPads(w = Wpx) {
  const p = isPhone() ? (w < 600 ? { t: 62, r: 3, b: 24, l: 3 } : { t: 30, r: 10, b: 36, l: 10 }) : { t: 34, r: 150, b: 36, l: 150 };
  // (full screen: the chamber sits in the clear ground between the plates)
  if (FS.on) { const q = FS.ins; p.t += q.t; p.r += q.r; p.b += q.b; p.l += q.l; }
  return p;
}
function drawChamberMain(m, alpha) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sen = m.house === "senate", sel = sen ? S.ssel : S.sel;
  chMain = drawChamber(ctx, m, Wpx, Hpx, { big: true, alpha, sel: sen ? (sel.level === "sen" ? sel.i : null) : selDiv(), hover: S.hover && S.hover.kind === (sen ? "sen" : "div") ? S.hover.i : null,
    state: sel.level === "state" ? sel.st : null, cls: sen || S.lens !== "cls" ? null : clsFilter(m), pad: chamberPads(), pattern: (() => { const p = hatch(); p.setTransform(new DOMMatrix().scale(1 / dpr)); return p; })() });
  ctx.restore();
}

/* ----- the morph between the map and the chamber ----- */
let morph = null; // { to: "chamber" | "map", t0, dur }
function drawMorph(m, p) {
  const th = TH;
  const geom = chamberGeom(m);
  const F = chamberFrame(geom, Wpx, Hpx, chamberPads());
  const target = chamberPositions(m, geom);
  // the map recedes, the chamber's furniture arrives
  if (p < 0.55) { if (m.proj) drawOcean(m, 1 - p / 0.55); drawGeo(m, 1 - p / 0.55, (1 - p / 0.55) * streetK()); drawIslands(m, 1 - p / 0.55); }
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p > 0.45) {
    ctx.globalAlpha = clamp((p - 0.45) / 0.55, 0, 1);
    geom.furniture(ctx, F, geom);
  }
  ctx.restore();
  const g = geoOf(m);
  for (const d of m.divs) {
    const tgt = d.i === m.speaker ? geom.chairAt : target.get(d.n);
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
      drawChair(ctx, x, y, lerp(0, tgt[2], e), tgt[4] * F.s * cs, tgt[5] * F.s * cs, css(c), css(towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22)), 1);
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
  const geom = chamberGeom(m);
  const pad = { t: 4, r: 4, b: 22, l: 4 };
  const bw = geom.box.x1 - geom.box.x0, bh = geom.box.y1 - geom.box.y0;
  const h = Math.round(((w - 8) * bh) / bw + 26);
  const r = Math.min(window.devicePixelRatio || 1, 2);
  if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.height = h + "px"; }
  const g = c.getContext("2d");
  g.setTransform(r, 0, 0, r, 0, 0);
  g.clearRect(0, 0, w, h);
  const sd = selDiv();
  // the chamber keeps its own marks of the figures-menu pick: a state's seats
  // lit, a seat type in its lens colours with other kinds sat back
  const out = drawChamber(g, m, w, h, { big: false, sel: sd, hover: miniCh.hover ?? null, state: S.sel.level === "state" ? S.sel.st : null, cls: S.lens === "cls" ? clsFilter(m) : null, pad, labels: true });
  miniCh.canvas = c; miniCh.drawn = out.drawn;
}
function miniHit(px, py) {
  if (!miniCh.drawn) return null;
  let best = null, bd = Infinity;
  for (const q of miniCh.drawn) { const d = Math.hypot(px - q.x, py - q.y); if (d < q.r + 2 && d < bd) { bd = d; best = q.i; } }
  return best;
}

/* =============================== the Senate ===============================
   The Senate as it sits today, after the Parliament's Senate seating plan (map/data/senate-now.json
   and the floor it names, senate-floor-<plan>.json, both from .build/map/senate.mjs). It is drawn by
   the House's renderer (drawChamber) on its own floor: the President's chair at the head of the
   table, the leaders at the table's two chairs, three rows of desks down either side and round the
   far curve, the government on the President's right (the reader's left). Seventy-six senators,
   each a chair; a bill needs 39 votes, the President's among them (the President votes, and a tie
   fails). A senator's term is the AEC's: six years from the July after their election for a state,
   to the next election for a territory; a casual senator serves out the term of the one they
   replaced. Each election on the timeline has its Senate too (map/data/senate-<year>.json, from
   .build/map/senate_past.py and the Parliamentary Handbook): the Senate on the day the election's
   senators took their seats, drawn on the same floor (the chamber's since 1988) and sorted, there
   being no seating plan filed for them. */
const SEN_LENSES = [
  { id: "party", label: "Party" },
  { id: "term", label: "Next election" },
];
const SU = 38.4; // the plan's units to a chamber unit: the Senate's floor is as wide as the House's
// each year's Senate, and the one the timeline is on (SENM)
const SENY = {}, SENP = {};
let SENM = null, senFloor = null, senFloorP = null;
const senOn = () => S.view === "chamber" && S.house === "senate" && !!SENM;
const syncSenate = () => { SENM = SENY[S.year] || null; };
// the model the chamber view draws: the House's year, or the Senate — the Victorian council's
// floor is baked into the app's code like the House's, so it never waits on the federal floor file
const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && (senFloor || VIC_YEARS.has(SENM.year)) ? SENM : null) : M());
const SEN_SEATS = 76;
// every year whose upper house is in this lane: the federal elections, and the states' — a state
// election chooses no federal Senate, but the states' own upper houses (their Legislative
// Councils: SA's 22 members and NSW's 42, half-plus-one elected statewide at each state
// election, and Victoria's 40, five a region, all up together) sit in the same chamber view
// on their frames, from map/data/senate-<year>.json
// (.build/map/build_sa22_past.py, build_sa26_past.py, build_nsw23_past.py, build_vic22_lc.py).
// Queensland's parliament is unicameral (its Legislative Council was abolished in 1922), so the
// qld frames take no upper-house lane — their one chamber is the Legislative Assembly. A state's
// "as it stands" frame (nswnow) takes none either — its Assembly alone is overlaid; the Council's
// own since-the-election changes are a ledger of their own the overlay never pretends to.
// Western Australia's Council sits out against the same predicate in this land: the 2025
// election was the first on a single statewide 37-member electorate, and before that shape is
// modelled the wa frames carry the Assembly only (2017/2021's six six-member regions model
// cleanly, but splitting the frames by Council system helps nobody).
const SEN_YEARS = YEARS.filter((y) => typeof y === "number" || y === "now" || (STATE_YEARS.has(y) && !QLD_YEARS.has(y) && !WA_YEARS.has(y) && !isNowY(y)));
const senYearFor = (y) => (SEN_YEARS.includes(y) ? y : [...SEN_YEARS].filter((v) => typeof v === "number" && YEARS.indexOf(v) < YEARS.indexOf(y)).pop());
function senateModel(raw, year) {
  const divs = raw.senators.map((x, i) => ({ i, n: x.n, st: x.st, sen: x, hold: { n: x.n, ab: x.ab, pn: partyName(x.ab, x.pn), fam: FAM(x.ab) } }));
  // the term the election's own senators serve to: those not serving it are up at the next election
  const later = raw.later || Math.max(...raw.senators.map((x) => (typeof x.term === "number" ? x.term : 0)));
  const k = SEN_YEARS.indexOf(year);
  // the 2016 double dissolution (9 May 2016) put every seat to the voters: a Senate whose next election it was
  // had all 76 up, those due to sit to 2017 or 2020 among them
  const nextDD = SEN_YEARS[k + 1] === 2016;
  // a council whose terms all run out together (Victoria's) puts every seat to the voters next,
  // term being the file's own later rather than a sitting-past half
  const uniform = raw.senators.every((x) => x.term === later);
  for (const d of divs) { d.due = d.sen.term !== later; d.up = uniform || nextDD || d.due; }
  // an unlisted role is no role: null (a state council file may carry none),
  // never findIndex's -1, which the chamber geometry reads as a member index
  const role = (r) => { const i = divs.findIndex((d) => d.sen.role === r); return i < 0 ? null : i; };
  return {
    house: "senate", year, asOf: raw.asOf, floor: raw.floor, lc: !!raw.lc, src: raw.source || null, divs, byName: new Map(divs.map((d) => [d.n, d.i])), seatsN: raw.seatsN || SEN_SEATS,
    // a state upper house's statewide first-preference tally (the federal files have none)
    votes: raw.votes || null, pvotes: raw.pvotes || null, formal: raw.formal || 0, pformal: raw.pformal || 0, prev: raw.prev || (raw.lc ? 2022 : null),
    speaker: role("president"), leaders: [role("leader"), role("oppLeader")].filter((i) => i != null), gov: GOV[year], later, dd: !!raw.dd, nextDD, uniform, nextPending: !!raw.nextPending, vacant: raw.vacant || [],
    // the election after this one, by name ("the 2007 election"), where there has been one
    nextYear: year !== "now" && SEN_YEARS[k + 1] !== "now" ? SEN_YEARS[k + 1] : null,
    // (a council's plan is filed apart, with its own date: seats-<year>-lc.json)
    seating: raw.seating ? { plan: raw.seating.plan, note: raw.seating.note || null, at: raw.seating.at }
      : raw.senators[0] && raw.senators[0].seat ? { plan: longDate(raw.asOf), at: Object.fromEntries(divs.map((d) => [d.n, d.sen.seat])) } : null,
  };
}
/* a council's seating plan (seats-<year>-lc.json, from .build/map/sa_seating.mjs): where each member
   sits, and who holds the chair and leads each side, as the Parliament's chamber map names them */
function withCouncilPlan(raw, plan) {
  if (!plan) return raw;
  const role = new Map(Object.entries(plan.roles || {}).map(([r, n]) => [n, r]));
  return { ...raw, seating: { plan: plan.plan, note: plan.note, at: plan.at }, senators: raw.senators.map((x) => (role.has(x.n) && !x.role ? { ...x, role: role.get(x.n) } : x)) };
}
function loadSenate(year = S.year) {
  if (SENY[year]) return Promise.resolve(SENY[year]);
  const plan = SEATED_LC.has(year) ? getJSON(`/map/data/seats-${year}-lc.json`).catch(() => null) : null;
  return (SENP[year] ??= Promise.all([getJSON(`/map/data/senate-${year}.json`), plan]).then(([raw, p]) => { SENY[year] = senateModel(withCouncilPlan(raw, p), year); syncSenate(); recolor(false); return SENY[year]; })
    .catch((e) => { delete SENP[year]; throw e; }));
}
// every election's Senate, for the timeline's make-up glyphs (about 7KB each)
function loadSenates() {
  return Promise.all(SEN_YEARS.map((y) => loadSenate(y).catch(() => null))).then(() => renderTimeline());
}
// the floor is today's plan's, the chamber the same since 1988
function loadSenateFloor() {
  return (senFloorP ??= loadSenate("now").then((m) => getJSON(`/map/data/${m.floor}`)).then((f) => { senFloor = f; senGeomC = null; senPaths = null; return f; }).catch((e) => { senFloorP = null; throw e; }));
}

/* ----- the floor ----- */
let senGeomC = null;
function senateGeom() {
  if (senGeomC) return senGeomC;
  const F = senFloor, P = (v) => v / SU;
  const all = F.seats.filter((c) => c.row >= 0).map((c) => {
    // the chair fills its seat's outline, a hair short of its neighbours (the plan's units draw at about
    // 0.7 of the House's points on screen, so the House's chair sizes in these units came out two-thirds
    // the House's area); the curve's long desks hold a chair as big as the straight benches' best
    // (the table's two chairs are drawn narrow on the plan, 25 across: square them up to their depth)
    const D = Math.min(c.D - 2, 32), W = c.row === 0 ? D : Math.min(c.W - 3, 34), back = Math.max(0, (c.D - D) / 2);
    const x = P(c.x - Math.cos(c.fa) * back), y = P(c.y - Math.sin(c.fa) * back);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: benchS(x, y), W: P(W), D: P(D), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  const bench = seats.filter((c) => c.row > 0), s0 = bench[0].s, s1 = bench[bench.length - 1].s;
  seats.forEach((c, k) => { c.k = k; c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const rows = [0, 1, 2, 3].map((r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curve (radius)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = [1, 2, 3].map((r) => mean(rows[r].filter((c) => c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = [1, 2, 3].map((r) => mean(rows[r].filter((c) => c.y > 0).map((c) => Math.hypot(c.x, c.y))));
  const walk = (v) => [v[0] - (v[1] - v[0]) / 2, (v[0] + v[1]) / 2, (v[1] + v[2]) / 2, v[2] + (v[2] - v[1]) / 2];
  const GS = walk(rowX), GC = walk(rowR);
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
    const a = s / CHK; return [-GC[k] * Math.cos(a), GC[k] * Math.sin(a)];
  };
  const pres = F.seats.find((c) => c.id === "president");
  const [bx0, by0, bx1, by1] = F.box.map(P);
  senGeomC = {
    seats, rows, nRows: 3, bench, byId: new Map(seats.map((c) => [c.id, c.k])),
    rOut: rowR[2], box: { x0: Math.min(bx0, -bx1), x1: Math.max(bx1, -bx0), y0: by0, y1: by1 },
    arms: false, table: ["leader_of_the_government", "leader_of_the_opposition"],
    chairAt: [P(pres.x), P(pres.y), Math.PI / 2, 0, P(36), P(32)],
    aisle: P(46), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    benchPt, benchOut, furniture: drawSenateFurniture,
  };
  return senGeomC;
}
// the floor's outlines as canvas paths, made once
let senPaths = null;
function senateFurniturePaths() {
  if (senPaths) return senPaths;
  const mk = (list) => list.map((p) => ({ p: new Path2D(p.d), t: p.t, cls: p.cls || "" }));
  const F = senFloor.furniture;
  senPaths = { table: mk(F.table), hansard: mk(F.hansard), desk: mk(F.desk), advisers: mk(F.advisers), benches: senBenches() };
  return senPaths;
}
/* the benches as the House draws its own, a bench's colour with a margin round its chairs: down the
   straight sides the seats run in touching pairs, one block a pair; round the curve each desk is a
   block of its own, turned to face the table (the plan's curve desks aren't concentric, so they are
   drawn as they stand, not as sectors of one circle) */
const BENCH_PAD = 2.5;
function senBenches() {
  // (a floor filed before Black Rod's bench was drawn has none)
  const all = [...senFloor.seats.filter((c) => c.row > 0), ...(senFloor.furniture.blackRod || [])];
  // a column is one x extent; down it, a seat whose top meets the last one's foot joins its block
  const cols = new Map();
  for (const c of all.filter((c) => c.box)) { const k = `${Math.round(c.box[0])}|${Math.round(c.box[2])}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(c.box.slice()); }
  const blocks = [];
  for (const list of cols.values()) {
    list.sort((p, q) => p[1] - q[1]);
    let cur = null;
    for (const b of list) { if (cur && b[1] - cur[3] < 3) cur[3] = Math.max(cur[3], b[3]); else blocks.push((cur = b)); }
  }
  const desks = all.filter((c) => !c.box).map((c) => [c.x, c.y, c.fa, c.D, c.W]);
  return { blocks, desks };
}
/* the room, in the House's drawing: the floor, the benches (each seat's own outline on the plan, a
   bench's colour and a line's edge, as the House's blocks), the table with the President's desk at its
   head and Hansard's at its foot, the advisers' boxes as the House's officials' boxes, the officers'
   chairs, and the empty seats (outlined only). The plan's desks are left out, as the House's are */
function drawSenateFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, k = s / SU;
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  const P = senateFurniturePaths();
  // the floor: straight sides down from the President's end, the far curve round the back row
  const FR = Math.max(-geom.box.x0, geom.box.x1, geom.box.y1), top = geom.box.y0;
  g.beginPath(); g.moveTo(X(-FR), Yp(top)); g.lineTo(X(-FR), Yp(0)); g.arc(X(0), Yp(0), FR * s, Math.PI, 0, true); g.lineTo(X(FR), Yp(top)); g.closePath();
  g.fillStyle = css(th.floor); g.fill();
  // the plan's shapes, in its own units
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k;
  const draw = (list, fill, stroke, lw = hair) => {
    for (const q of list) {
      g.save(); g.translate(q.t[0], q.t[1]);
      if (fill) { g.fillStyle = fill; g.fill(q.p); }
      if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(q.p); }
      g.restore();
    }
  };
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 3); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  const pd = BENCH_PAD;
  for (const [x0, y0, x1, y1] of P.benches.blocks) rb(x0 - pd, y0 - pd, x1 - x0 + 2 * pd, y1 - y0 + 2 * pd);
  for (const [x, y, fa, D, W] of P.benches.desks) { g.save(); g.translate(x, y); g.rotate(fa); rb(-D / 2 - pd, -W / 2 - pd, D + 2 * pd, W + 2 * pd); g.restore(); }
  draw(P.advisers, bench, css(th.line));
  draw(P.table, bench, wood, Math.max(hair, 0.05 * s / k));
  draw(P.desk, wood, css(th.line));
  draw(P.hansard, wood, css(th.line));
  g.restore();
  // the empty seats, outlined only, so they never read as a senator's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    if (opts.occupied && opts.occupied.has(c.k)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  // the officers: the Clerk, the Chair of Committees and the Deputy Clerk; Hansard's reporters; Black Rod
  for (const o of senFloor.officers) {
    const W = (Math.min(o.W, 28) / SU) * s, D = (Math.min(o.D, 24) / SU) * s;
    drawChair(g, X(o.x / SU), Yp(o.y / SU), o.fa, W, D, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, -320 / SU, 110 / SU);
    put("Hansard", 0, -148 / SU, 86 / SU);
  }
}

/* ----- the lenses: party, and who faces the voters next ----- */
const upNext = (d) => d.up;
const SEN_STAY = (th) => (th.dark ? lch(0.45, 0.008, 66) : lch(0.83, 0.006, 75));
function senateColor(m, d) {
  const c = TH.party[holdFam(d.hold)];
  if (S.senLens === "term" && !upNext(d)) return SEN_STAY(TH);
  return c;
}
// the sorted chamber's order within a bloc: by party, then (on the term lens) those up next first, then by state
const SEN_PARTY_ORDER = ["ALP", "LP", "LNP", "NP", "CLP", "GRN", "AD", "XEN", "CA", "FFP", "DLP", "PUP", "LDP", "AMEP", "DHJP", "AC", "IND", "JLN", "AV", "UAPP", "KAP", "APA", "SAB", "FGA", "ON", "ONP"];
function senateKey(m, d, bloc) {
  const p = SEN_PARTY_ORDER.indexOf(d.hold.ab), st = STATES.indexOf(d.st);
  const term = S.senLens === "term" ? (upNext(d) ? 0 : 1) : 0;
  return -(term * 1000 + (p < 0 ? 99 : p) * 10 + st / 10);
}
const senLensOf = () => SEN_LENSES.find((l) => l.id === S.senLens);

/* ----- the counts the legend and the story read ----- */
function senCounts(m, pred = () => true) {
  const c = {};
  for (const d of m.divs) if (pred(d)) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
  return c;
}
const SEN_FAMS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
// the crossbench by party, the way a sentence names them: "the Greens’ 10", "One Nation’s four"
function senCross(m) {
  const by = new Map();
  for (const d of m.divs) {
    const f = holdFam(d.hold); if (f === "alp" || f === "lnp") continue;
    const k = f === "ind" ? "IND" : d.hold.ab;
    if (!by.has(k)) by.set(k, { k, fam: f, n: 0, names: [], pn: d.hold.pn });
    const g = by.get(k); g.n++; g.names.push(d.n);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
}
// (a party by its name of the day: 2016's Nick Xenophon Team, 2019's Centre Alliance)
const crossName = (g) => (g.k === "IND" ? (g.n === 1 ? "an independent" : "independents") : g.k === "GRN" ? "the Greens" : g.k === "JLN" ? "the Jacqui Lambie Network" : theParty(g.k, g.pn));
const crossPoss = (g) => (g.k === "IND" ? `the ${words(g.n)} independents’` : g.k === "GRN" ? "the Greens’" : g.k === "JLN" ? "the Lambie Network’s" : `${theParty(g.k, g.pn)}’s`);

/* ----- the copy's tense and terms: today's Senate in the present; an election's in the past, but for
   what was still to come (its next election, a term not yet run) ----- */
const senNow = (m) => m.year === "now";
const tv = (m, now, past) => (senNow(m) ? now : past);
// the election a Senate's up-next half faced: "the 2007 election"; a council's is its own state
// election — the far half's end less four, or the end itself when every member goes up together
const nextEl = (m) => (m.lc ? `the ${m.uniform ? m.later : m.later - 4} state election` : m.nextYear ? `the ${m.nextYear} election` : "the next election");
const nv = (m, still, done) => (m.nextYear ? done : still); // a verb about the next election: still to come, or past
const termWords = (m, d) => (d.sen.term === "next" ? nextEl(m) : m.lc ? `the ${d.sen.term} election` : `30 June ${d.sen.term}`);
const TERRITORIES = new Set(["ACT", "NT"]);
// the election the up-next half of the states was chosen at (2016's short-term half at the double dissolution)
function upClass(m) {
  const c = {};
  for (const d of m.divs) if (d.up && !TERRITORIES.has(d.st) && d.sen.elected) c[d.sen.elected] = (c[d.sen.elected] || 0) + 1;
  const y = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return y ? +y : null;
}
const upClassWords = (m) => (upClass(m) === 2016 && m.year !== 2016 ? "each state’s six elected last in 2016" : m.dd ? "each state’s six elected last" : `each state’s six elected in ${upClass(m)}`);
// the election that chose a Senate's own new half
const ownElection = (m) => (senNow(m) ? 2025 : m.year);
// the upper house as this frame's copy names it: the Senate federally, SA's council on the SA frames
const coThe = (m) => (m.lc ? "the Legislative Council" : "the Senate");
const coTheC = (m) => (m.lc ? "The Legislative Council" : "The Senate");
// a member of it in copy: a senator, or a councillor (an MLC)
const coSeat = (m) => (m.lc ? "the council" : "the Senate");
// the title over a member (search, the member's own story): Senator federally
const coTitle = (m) => (m.lc ? "Member of the Legislative Council" : "Senator");
const coMember = (m) => (m.lc ? "member" : "senator");

/* ----- the key ----- */
function houseSwitchHTML() {
  const sa = SA_YEARS.has(S.year), st = STATE_YEARS.has(S.year);
  const lo = sa ? "House of Assembly" : st ? "Legislative Assembly" : "House of Representatives";
  const up = st ? "Legislative Council" : "Senate";
  // Queensland's frames carry no upper house (the parliament is unicameral): nothing to switch to
  if (!SEN_YEARS.includes(S.year)) return "";
  return `<div class="lg-house" role="group" aria-label="Which chamber"><button type="button" data-house="reps" data-t="${lo}" aria-pressed="${S.house !== "senate"}">${lo}</button><button type="button" data-house="senate" data-t="${up}" aria-pressed="${S.house === "senate"}">${up}</button></div>`;
}
function senateLegendHTML(m) {
  const cats = (cnt, list) => `<div class="lg-cats">${list.filter((f) => cnt[f]).map((f) => `<span><i style="${swc(f)}"></i>${famTag(f)} <b>${cnt[f]}</b></span>`).join("")}`;
  let h = houseSwitchHTML() + basisHTML();
  if (S.senLens === "term") {
    const up = senCounts(m, upNext), stay = m.divs.filter((d) => !upNext(d)).length;
    h += `<div class="lg-t">${nv(m, "Who faces", "Who faced")} the voters at ${nextEl(m)}</div>`;
    h += `${cats(up, SEN_FAMS)}${stay ? `<span><i style="background:${css(SEN_STAY(TH))}"></i>Term to ${m.lc ? `the ${m.later} election` : m.later} <b>${stay}</b></span>` : ""}</div>`;
    h += `<div class="lg-note">${m.lc ? (NSW_YEARS.has(m.year) ? "Twenty-one of the council’s forty-two members are elected as one statewide electorate at each state election; the rest sit until the next one." : VIC_YEARS.has(m.year) ? "All forty of the council’s members are elected together — five in each of Victoria’s eight regions — so every member faces the voters at each state election." : "Eleven of the council’s 22 members are elected as one statewide electorate at each state election; the rest sit until the next one.") : m.nextDD ? "The double dissolution of 9 May 2016 put all 76 seats to the voters." : m.dd ? "The double dissolution elected all 76: each state’s last six elected, and the territories’ four, faced the voters again in 2019." : "Each state elects half its 12 senators at a time; the territories’ four are elected every time."}</div>`;
  } else {
    h += `<div class="lg-t">${senNow(m) ? "Who sits in the Senate today" : m.lc ? `The Legislative Council after ${yearLabel(m.year)}` : `The Senate after the ${m.year} election`}</div>`;
    h += `${cats(senCounts(m), SEN_FAMS)}</div>`;
  }
  const md = seatMode(m);
  if (m.seating) h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s ${m.lc ? (m.year === "vic22" ? "council seating plan" : "chamber map") : "Senate seating plan"} of ${m.seating.plan}.` : `By ${S.senLens === "term" ? "who is up next, then party" : "party"}, each side from the President’s end.`}</span></div>`;
  else h += `<div class="lg-note">Sorted by ${S.senLens === "term" ? "who was up next, then party" : "party"}, each side from the President’s end; no seating plan is filed for ${m.lc ? "this council" : "this Senate"}.</div>`;
  return h;
}

/* ----- the story ----- */
function senUpLink() {
  const s = S.ssel, m = SENM; if (s.level === "aus") return "";
  const label = s.level === "state" || m.lc ? coTheC(m) : STATE_TITLE[s.st];
  const go = s.level === "state" || m.lc ? "aus" : `state:${s.st}`;
  return `<button type="button" class="st-up" data-sgo="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(label)}</button>`;
}
function senHead(title, meta, hed, dek) {
  return `${senUpLink()}<div class="st-head"><h2>${ds(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
}
/* the balance of power, in rules: how many votes the government is short of the 39, which crossbench
   groups could supply them alone, and what it would take without them */
function senBalance(m) {
  const N = m.seatsN, maj = Math.floor(N / 2) + 1, cnt = senCounts(m);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp", G = cnt[gov] || 0, O = cnt[opp] || 0;
  const cross = senCross(m), C = m.divs.length - G - O, need = maj - G;
  const enough = cross.filter((g) => g.n >= need);
  return { N, maj, G, O, C, need, cross, enough, gov, opp };
}
function senHedDek(m) {
  // the government as a sentence opens with it ("The Coalition held …")
  const b = senBalance(m), GN = b.gov === "lnp" ? "The Coalition" : "Labor", oppThe = b.opp === "lnp" ? (m.lc ? "the Liberals" : "the Coalition") : "Labor";
  const pres = m.speaker != null ? m.divs[m.speaker] : null, presOwn = pres && holdFam(pres.hold) === b.gov;
  const has = tv(m, "holds", "held"), needs = tv(m, "needs", "needed"), opposes = tv(m, "opposes", "opposed");
  const holds = `${GN} ${has} ${b.G} of the ${b.N} seats${presOwn ? ", the President’s among them" : ""}`;
  const tail = `${cap(oppThe)} ${has} ${b.O}`;
  const vacant = m.vacant.length ? ` ${cap(words(m.vacant.length))} ${STATE_NAME[m.vacant[0].st]} seat ${m.vacant.length > 1 ? "were" : "was"} vacant that day, until ${longDate(m.vacant[0].filled)}.` : "";
  if (b.need <= 0) return { hed: `${GN} ${has} a majority in ${coThe(m)}`, dek: `${holds}, ${b.G === b.maj ? "exactly" : `${words(b.G - b.maj)} more than`} the ${b.maj} a bill ${needs}. ${tail}; the crossbench ${b.C}.${vacant}` };
  const short = `${words(b.need)} short of the ${b.maj} votes a bill ${needs}`;
  if (b.enough.length === 1) {
    const g = b.enough[0], rest = b.cross.filter((x) => x !== g), restN = rest.reduce((a, x) => a + x.n, 0);
    const hed = `${GN} ${needs} ${crossName(g)} to pass a bill ${oppThe} ${opposes}`;
    let dek = `${holds}, ${short}. ${cap(crossPoss(g))} ${words(g.n)} ${tv(m, "take", "took")} it to ${b.G + g.n}. `;
    if (restN >= b.need) {
      // a party of several by its count, everyone else (independents among them) by name
      const who = [...rest.filter((x) => x.n > 1 && x.k !== "IND").map((x) => `${crossPoss(x)} ${words(x.n)}`), ...rest.filter((x) => x.n === 1 || x.k === "IND").flatMap((x) => x.names)];
      dek += `Without them it ${tv(m, "would need", "would have needed")} ${restN === b.need ? `all ${words(restN)} other crossbenchers` : `${words(b.need)} of the other ${words(restN)} crossbenchers`}: ${listAnd(who)}.`;
    } else dek += `No mix of the other ${words(restN)} crossbenchers ${tv(m, "is", "was")} enough without them.`;
    return { hed, dek: dek.trim() + ` ${tail}.${vacant}` };
  }
  if (b.enough.length > 1) {
    const names = b.enough.map(crossName);
    return { hed: `${GN} ${tv(m, "can", "could")} pass a bill with ${listAnd(names).replace(/ and /, " or ")}`, dek: `${holds}, ${short}. ${tail}; the crossbench ${b.C}.${vacant}` };
  }
  // no one crossbench party is enough: every crossbencher, where it takes them all; else the largest
  // party and how many more, named from the rest
  const everyone = (gs) => [...gs.filter((x) => x.n > 1 && x.k !== "IND").map((x) => `${crossPoss(x)} ${words(x.n)}`), ...gs.filter((x) => x.n === 1 || x.k === "IND").flatMap((x) => x.names)];
  if (b.C < b.need) return { hed: `${GN} ${tv(m, "can’t", "couldn’t")} pass a bill ${oppThe} ${opposes}, whatever the crossbench ${tv(m, "does", "did")}`, dek: `${holds}, ${short}, and the crossbench ${has} only ${words(b.C)}. ${tail}.${vacant}` };
  if (b.C === b.need) return { hed: `${GN} ${needs} every crossbencher to pass a bill ${oppThe} ${opposes}`, dek: `${holds}, ${short}: all ${words(b.C)} crossbenchers, ${listAnd(everyone(b.cross))}. ${tail}.${vacant}` };
  const g1 = b.cross[0], r = b.need - g1.n, rest = b.cross.slice(1), restN = rest.reduce((a, x) => a + x.n, 0);
  return { hed: `${GN} ${needs} ${crossName(g1)} and ${words(r)} more ${r === 1 ? "crossbencher" : "crossbenchers"} to pass a bill ${oppThe} ${opposes}`,
    dek: `${holds}, ${short}. ${cap(crossPoss(g1))} ${words(g1.n)} ${tv(m, "take", "took")} it to ${b.G + g1.n}; the last ${r === 1 ? "vote" : `${words(r)} votes`} ${tv(m, "have", "had")} to come from ${r === restN ? "all" : "among"} the other ${words(restN)}: ${listAnd(everyone(rest))}. ${tail}.${vacant}` };
}
// the 76 as one bar, the government first and the opposition last, the 39 marked
function senBar(m) {
  const b = senBalance(m), cnt = senCounts(m);
  const order = [b.gov, ...chamberBlocs(m).cross, b.opp].filter((f) => cnt[f]);
  let acc = 0;
  const segs = order.map((f) => { const x = (100 * acc) / b.N, w = (100 * cnt[f]) / b.N; acc += cnt[f]; return `<i style="left:${x}%;width:${w}%;${swc(f)}" title="${famLeg(f)} ${cnt[f]}"></i>`; }).join("");
  const mx = (100 * b.maj) / b.N;
  const lab = order.map((f) => `<span><i style="${swc(f)}"></i>${famTag(f)} <b>${cnt[f]}</b></span>`).join("") + (m.vacant.length ? `<span><i style="background:var(--line-2)"></i>Vacant <b>${m.vacant.length}</b></span>` : "");
  return `<div class="sn-bar" role="img" aria-label="${order.map((f) => `${famLeg(f)} ${cnt[f]}`).join(", ")}; ${b.maj} for a majority"><div class="sn-track">${segs}<span class="sn-maj" style="left:${mx}%"></span></div><div class="sn-majlab" style="left:${mx}%">${b.maj} to pass a bill</div></div><div class="counts">${lab}</div>`;
}
function storySenate(m) {
  const s = S.ssel;
  if (s.level === "sen") return storySenator(m, s.i);
  // (the council is one statewide electorate: its "state" story is the chamber's)
  if (s.level === "state" && !m.lc) return storySenState(m, s.st);
  const { hed, dek } = senHedDek(m);
  let h = senHead(m.lc ? `The Legislative Council after ${yearLabel(m.year)}` : senNow(m) ? "The Senate today" : `The Senate after ${m.year}`, m.lc ? (m.uniform ? `The council as it sat on ${longDate(m.asOf)}` : `The council as the new term began, ${longDate(m.asOf)}`) : senNow(m) ? `Senators as at ${longDate(m.asOf)}` : `From ${longDate(m.asOf)}, as the ${m.dd ? "double dissolution’s" : "election’s"} senators took their seats`, hed, dek);
  h += `<div class="st-sec"><h3>The balance of power <small>${senBalance(m).maj} of ${m.seatsN} votes pass a bill</small></h3>${senBar(m)}</div>`;
  // who faces the voters next
  const up = m.divs.filter(upNext), upC = senCounts(m, upNext), stayC = senCounts(m, (d) => !upNext(d));
  const nUp = up.length, nTerr = up.filter((d) => TERRITORIES.has(d.st)).length;
  const upOrder = SEN_FAMS.filter((f) => upC[f] || stayC[f]);
  if (m.lc) {
    if (m.uniform) h += `<div class="st-sec"><h3>At ${nextEl(m)} <small>every seat up</small></h3><p class="st-p">Every one of the council’s ${m.seatsN} seats ${nv(m, "is", "was")} up at ${nextEl(m)}: Victoria’s upper house is not staggered, so the whole council — five members in each of its eight regions — ${m.nextPending ? "faces" : "faced"} the voters together at each state election. ${lcDefends(m)}</p></div>`;
    else h += `<div class="st-sec"><h3>At ${nextEl(m)} <small>${nUp} seats up, ${m.divs.length - nUp} with terms to the ${m.later} election</small></h3><p class="st-p">${cap(nextEl(m))} ${nv(m, "fills", "filled")} ${words(nUp)} of the council’s ${m.seatsN} seats; the other ${words(m.divs.length - nUp)} ${tv(m, "have", "had")} terms to the ${m.later} election. ${lcDefends(m)}</p><table class="tbl"><thead><tr><th>Party</th><th>Up next</th><th>To ${m.later}</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${stayC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
    // the statewide vote, this election and the last stored one
    if (m.votes && m.pvotes) {
      const rows = {};
      for (const [ab, v] of Object.entries(m.votes)) { const f = FAM(ab); rows[f] = rows[f] || { v: 0, pv: 0 }; rows[f].v += v; }
      for (const [ab, v] of Object.entries(m.pvotes)) { const f = FAM(ab); rows[f] = rows[f] || { v: 0, pv: 0 }; rows[f].pv += v; }
      const share = (v, tot) => (100 * v) / tot;
      const order2 = SEN_FAMS.filter((f) => rows[f]).sort((a, b) => rows[b].v - rows[a].v);
      h += `<div class="st-sec"><h3>First preferences <small>statewide</small></h3><table class="tbl"><thead><tr><th>Party</th><th>${yearLabel(m.year)}</th><th>${m.prev}</th><th>Change</th></tr></thead><tbody>${order2.map((f) => { const r = rows[f], cur = share(r.v, m.formal), prev = r.pv ? share(r.pv, m.pformal) : null; return `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${f1(cur)}</td><td>${prev != null ? f1(prev) : "—"}</td><td>${prev != null ? sgn(cur - prev) : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
    // the chamber's members, the new cohort first
    const row2 = (d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt"><i class="sw" style="${swc(holdFam(d.hold))}"></i></span><span class="tx"><b>${ds(d.n)}</b> ${esc(partyName(d.hold.ab, d.hold.pn))}</span></button>`;
    if (m.uniform) h += `<div class="st-sec"><h3>Elected at ${yearLabel(m.year)} <small>all ${words(m.seatsN)} members — terms to the ${m.later} election</small></h3><div class="changes sn-list">${[...m.divs].sort(senOrder).map(row2).join("")}</div></div>`;
    else {
      const newC = m.divs.filter((d) => !upNext(d)), oldC = m.divs.filter(upNext);
      h += `<div class="st-sec"><h3>Elected at ${yearLabel(m.year)} <small>terms to the ${m.later} election</small></h3><div class="changes sn-list">${newC.sort(senOrder).map(row2).join("")}</div></div>`;
      h += `<div class="st-sec"><h3>Carried over <small>terms to the ${m.later - 4} election</small></h3><div class="changes sn-list">${oldC.sort(senOrder).map(row2).join("")}</div></div>`;
    }
    const moved = m.divs.filter((d) => d.sen.electedAs), filled = m.divs.filter((d) => d.sen.casual || d.sen.recount);
    const mrow = (d, tx) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt">${STATE_SHORT[d.st]}</span><span class="tx"><b>${ds(d.n)}.</b> ${tx}.</span></button>`;
    if (moved.length) h += `<div class="st-sec"><h3>Not as elected</h3><div class="changes">${moved.map((d) => mrow(d, m.uniform ? `Elected for ${theParty(d.sen.electedAs)} in ${d.sen.elected}; ${m.nextPending ? "now sits" : "sat"} ${d.hold.fam === "ind" ? "as an independent" : `for ${theParty(d.hold.ab)}`}` : `Elected for ${theParty(d.sen.electedAs)} in ${d.sen.elected}; she carried the seat into her own party, ${esc(partyName(d.hold.ab, d.hold.pn))}`)).join("")}</div></div>`;
    if (filled.length) h += `<div class="st-sec"><h3>Filled mid-term</h3><div class="changes">${filled.map((d) => mrow(d, esc(senFilled(m, d)))).join("")}</div></div>`;
    h += senFoot(m);
    return h;
  }
  if (m.nextDD) {
    const dueC = senCounts(m, (d) => d.due);
    h += `<div class="st-sec"><h3>At the 2016 election <small>all ${SEN_SEATS} seats, a double dissolution</small></h3><p class="st-p">The double dissolution of 9 May 2016 ended every senator’s term: all ${SEN_SEATS} seats were filled at the 2016 election, the ${m.divs.filter((d) => !d.due).length} due to sit to ${m.later} among them. ${senDefends(m, upC)}</p><table class="tbl"><thead><tr><th>Party</th><th>Seats</th><th>Due anyway</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${dueC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
  } else h += `<div class="st-sec"><h3>At ${nextEl(m)} <small>${nUp} seats up, ${m.divs.length - nUp} with terms to ${m.later}</small></h3><p class="st-p">${cap(nextEl(m))} ${nv(m, "fills", "filled")} ${nUp} seats: ${upClassWords(m)} and the ${words(nTerr)} territory senators. ${senDefends(m, upC)}</p><table class="tbl"><thead><tr><th>Party</th><th>Up next</th><th>To ${m.later}</th></tr></thead><tbody>${upOrder.map((f) => `<tr><td><i class="sw" style="${swc(f)}"></i>${famLeg(f)}</td><td>${upC[f] || 0}</td><td>${stayC[f] || 0}</td></tr>`).join("")}</tbody></table></div>`;
  // the states
  h += `<div class="st-sec"><h3>By state <small>12 senators a state, two a territory</small></h3><table class="tbl"><thead><tr><th>State</th><th>Senators</th><th>Up next</th></tr></thead><tbody>${STATES.map((st) => {
    const sens = m.divs.filter((d) => d.st === st), c = {}; for (const d of sens) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
    const bar = ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((f) => c[f]).map((f) => `<i style="width:${(100 * c[f]) / (TERRITORIES.has(st) ? 2 : 12)}%;${swc(f)}"></i>`).join("");
    return `<tr data-sgo="state:${st}"><td>${STATE_TITLE[st].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${sens.length}<span class="seatbar">${bar}</span></td><td>${sens.filter(upNext).length}</td></tr>`;
  }).join("")}</tbody></table></div>`;
  // since the elections: changes of party, casual vacancies and the High Court's recounts
  const moved = m.divs.filter((d) => d.sen.electedAs), filled = m.divs.filter((d) => d.sen.casual || d.sen.recount);
  if (moved.length || filled.length) {
    const row = (d, tx) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt">${STATE_SHORT[d.st]}</span><span class="tx"><b>${ds(d.n)}.</b> ${esc(tx)}.</span></button>`;
    h += `<div class="st-sec"><h3>Not as elected <small>${moved.length} changed party, ${filled.length} filled a vacancy</small></h3><div class="changes">${moved.map((d) => row(d, `Elected for ${theParty(d.sen.electedAs)}${d.sen.elected ? ` in ${d.sen.elected}` : ""}; ${senMoved(m, d)}`)).join("")}${filled.map((d) => row(d, senFilled(m, d))).join("")}</div></div>`;
  }
  h += senFoot(m);
  return h;
}
// "now sits for Labor", or for an election's Senate, "sat for Labor by July 2019"
const senMoved = (m, d) => `${tv(m, "now", "by " + monthYear(m.asOf) + ",")} ${d.hold.fam === "ind" ? tv(m, "sits as an independent", "sat as an independent") : `${tv(m, "sits", "sat")} for ${theParty(d.hold.ab)}`}`;
function senFilled(m, d) {
  const x = d.sen, to = termWords(m, d);
  if (x.recount) return `Declared elected by the High Court in ${x.recount.for}’s place on ${shortDate(x.recount.date)}, to ${to}`;
  return x.casual.for ? `Filled ${x.casual.for}’s vacancy for ${theParty(d.hold.ab)}${x.casual.date ? ` on ${shortDate(x.casual.date)}` : ""}, to ${to}` : `Filled a ${partyName(d.hold.ab, d.hold.pn)} vacancy, to ${to}`;
}
// "…": the council's up-next half defended party by party (never "the Coalition": SA's is the Liberals)
function lcDefends(m) {
  const by = new Map();
  for (const d of m.divs.filter(upNext)) {
    const ab = d.hold.ab;
    if (!by.has(ab)) by.set(ab, { n: 0, pn: d.hold.pn });
    by.get(ab).n++;
  }
  const parts = [...by.entries()].sort((a, b) => b[1].n - a[1].n || SEN_PARTY_ORDER.indexOf(a[0]) - SEN_PARTY_ORDER.indexOf(b[0]));
  if (!parts.length) return "";
  return `${listAnd(parts.map(([ab, g], k) => `${k ? theParty(ab, g.pn) : cap(theParty(ab, g.pn))} ${tv(m, "defends", "defended")} ${words(g.n)}`))}.`;
}
// "Labor defends 15 of them, the Coalition 15, the Greens six …"
function senDefends(m, upC) {
  const parts = SEN_FAMS.filter((f) => upC[f]).sort((a, b) => upC[b] - upC[a]);
  if (!parts.length) return "";
  const [first, ...rest] = parts;
  return `${cap(FAM_PL[first])} ${nv(m, "defends", "defended")} ${words(upC[first])} of them${rest.length ? `, ${listAnd(rest.map((f) => `${FAM_PL[f]} ${words(upC[f])}`))}` : ""}.`;
}
function storySenState(m, st) {
  const sens = m.divs.filter((d) => d.st === st), c = {}; for (const d of sens) { const f = holdFam(d.hold); c[f] = (c[f] || 0) + 1; }
  const order = SEN_FAMS.filter((f) => c[f]).sort((a, b) => c[b] - c[a]);
  const top = order[0], tie = order[1] && c[order[1]] === c[top];
  const terr = TERRITORIES.has(st), seats = terr ? 2 : 12, has = tv(m, "holds", "held");
  const hed = tie ? `${cap(FAM_PL[top])} and ${FAM_PL[order[1]]} ${tv(m, "hold", "held")} ${words(c[top])} seats each` : `${cap(FAM_PL[top])} ${has} ${words(c[top])} of ${STATE_POSS[st]} ${words(seats)} seats`;
  const up = sens.filter(upNext), cls = upClass(m);
  const vac = m.vacant.filter((v) => v.st === st).length;
  const dek = terr ? `Territory senators ${tv(m, "serve", "served")} until the next election, so both seats ${nv(m, "are", "were")} up at ${nextEl(m)}.`
    : m.nextDD ? `The double dissolution of 9 May 2016 put all ${words(seats)} seats to the voters at the 2016 election.${vac ? ` ${cap(words(vac))} ${vac > 1 ? "seats were" : "seat was"} vacant that day.` : ""}`
    : `${cap(words(up.length))} of the ${words(seats)}${m.dd ? ", the last six elected" : cls ? `, elected in ${cls}` : ""}, ${nv(m, "are", "were")} up at ${nextEl(m)}; the other ${words(seats - up.length)} ${tv(m, "have", "had")} terms to ${m.later}.${vac ? ` ${cap(words(vac))} ${vac > 1 ? "seats were" : "seat was"} vacant that day.` : ""}`;
  let h = senHead(STATE_TITLE[st], `${sens.length} senators${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}`, hed, dek);
  sens.sort(senOrder);
  const row = (d) => `<button type="button" data-sgo="sen:${d.i}"><span class="dt"><i class="sw" style="${swc(holdFam(d.hold))}"></i></span><span class="tx"><b>${ds(d.n)}</b> ${esc(partyName(d.hold.ab, d.hold.pn))}${d.sen.role ? ` · ${ROLE_NAME[d.sen.role]}` : ""}</span></button>`;
  if (!terr) {
    // (before the double dissolution the halves are the terms due, though every seat was up)
    const dueUp = sens.filter((d) => d.due), stays = sens.filter((d) => !d.due);
    h += `<div class="st-sec"><h3>${m.nextDD ? `Due at ${nextEl(m)}` : `Up at ${nextEl(m)}`} <small>${dueUp.length}${m.dd ? ", the last six elected" : cls ? `, elected in ${cls}` : ""}</small></h3><div class="changes sn-list">${dueUp.map(row).join("")}</div></div>`;
    h += `<div class="st-sec"><h3>Terms to ${m.later} <small>${stays.length}, elected ${m.dd ? "first" : "in"} ${ownElection(m)}</small></h3><div class="changes sn-list">${stays.map(row).join("")}</div></div>`;
  } else h += `<div class="st-sec"><h3>Senators <small>elected in ${ownElection(m)}</small></h3><div class="changes sn-list">${sens.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
// a list of senators: those up next first, then by party, then by name
const senOrder = (a, b) => (upNext(b) - upNext(a)) || SEN_PARTY_ORDER.indexOf(a.hold.ab) - SEN_PARTY_ORDER.indexOf(b.hold.ab) || a.n.localeCompare(b.n);
const ROLE_NAME = { president: "President of the Senate", leader: "Leader of the Government in the Senate", oppLeader: "Leader of the Opposition in the Senate" };
function storySenator(m, i) {
  const d = m.divs[i], x = d.sen, party = partyName(d.hold.ab, d.hold.pn);
  const hed = x.role ? ROLE_NAME[x.role] : m.lc ? (d.hold.fam === "ind" ? `Independent MLC` : `${party} in ${coSeat(m)}`) : d.hold.fam === "ind" ? `Independent senator for ${STATE_NAME[x.st]}` : `${party} senator for ${STATE_NAME[x.st]}`;
  const terr = TERRITORIES.has(x.st), is = nv(m, "is", "was");
  let dek;
  if (m.lc) dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term running to the ${x.term} election${d.up ? `: the seat ${is} up at ${nextEl(m)}` : `, so the seat ${nv(m, "sits", "sat")} out ${nextEl(m)}`}.`;
  else if (x.casual || x.recount) dek = `${senFilled(m, d)}.`;
  else if (terr) dek = `Elected in ${x.elected}. A territory senator’s term runs with the House’s, so the seat ${is} up at ${nextEl(m)}.`;
  else if (x.term === 2017 || x.term === 2020) dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term due to end on 30 June ${x.term}; the double dissolution ended it on 9 May 2016.`;
  else dek = `Elected${x.electedAs ? ` for ${theParty(x.electedAs)}` : ""} in ${x.elected}, to a term that ${x.term <= 2026 ? "ended" : "ends"} on 30 June ${x.term}${d.up ? `: the seat ${is} up at ${nextEl(m)}` : `, so the seat ${nv(m, "sits", "sat")} out ${nextEl(m)}`}.`;
  if (x.electedAs && !m.lc) dek += ` ${cap(senMoved(m, d))}.`;
  if (x.role) dek = `${party} senator for ${STATE_NAME[x.st]}. ${dek}`;
  let h = senHead(d.n, m.lc ? `${coTitle(m)}${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}` : `Senator for ${STATE_TITLE[x.st]}${senNow(m) ? "" : `, ${monthYear(m.asOf)}`}`, hed, dek);
  const mates = m.divs.filter((y) => y.st === x.st && y.i !== i).sort(senOrder);
  const row = (y) => `<button type="button" data-sgo="sen:${y.i}"><span class="dt"><i class="sw" style="${swc(holdFam(y.hold))}"></i></span><span class="tx"><b>${ds(y.n)}</b> ${esc(partyName(y.hold.ab, y.hold.pn))}${upNext(y) ? "" : ` · to ${m.lc ? `the ${m.later} election` : m.later}`}</span></button>`;
  h += `<div class="st-sec"><h3>${m.lc ? "The other members" : `${STATE_POSS[x.st].replace(/^the /, "The ")} other senators`} <small>${mates.length}</small></h3><div class="changes sn-list">${mates.map(row).join("")}</div></div>`;
  h += senFoot(m);
  return h;
}
function senFoot(m) {
  return m.lc ? `<p class="st-foot">${m.src}. ${m.seating ? `Seats from ${m.year === "vic22" ? "the Parliament of Victoria’s council seating plan" : "the Parliament of South Australia’s chamber map"}, ${m.seating.plan}.` : "Drawn on the council’s own floor, sorted — no seating plan is filed for this council."}</p>`
    : senNow(m) ? `<p class="st-foot">The Parliament’s Senate seating plan as at ${longDate(m.asOf)}; terms from the AEC’s Senators Elected lists for 2022 and 2025.</p>`
    : `<p class="st-foot">The Parliamentary Handbook: senators’ terms of service, parties and changes of party; the Senate on ${longDate(m.asOf)}. Drawn on today’s floor, sorted.</p>`;
}

/* ----- selection, search and the tooltip ----- */
function selectSen(sel) {
  S.ssel = sel; S.hover = null; hideTip();
  renderStory(true); renderTimeline(); writeURL(); schedule();
}
function senTip(m, i) {
  const d = m.divs[i], x = d.sen;
  const term = m.lc ? (d.up ? `Up at ${nextEl(m)}` : `Term to the ${m.later} election`) : d.up ? (x.term === "next" ? `Up at ${nextEl(m)}` : `Up at ${nextEl(m)} (term to ${x.term})`) : `Term to ${x.term}`;
  return `<div class="tn">${ds(d.n)}<span>${STATE_SHORT[x.st]}${x.role === "president" ? " · President" : ""}</span></div><div class="tv">${esc(partyName(d.hold.ab, d.hold.pn))}</div><div class="ts">${esc(cap(term))}</div>`;
}
function senSearchItems(m) {
  const items = [];
  for (const st of STATES) { const n = m.divs.filter((d) => d.st === st).length; if (n) items.push({ k: "state", st, t: STATE_TITLE[st], s: `${n} ${m.lc ? "members" : "senators"}`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 }); }
  for (const d of m.divs) items.push({ k: "sen", i: d.i, t: d.n, s: m.lc ? `${coTitle(m)}, ${partyName(d.hold.ab, d.hold.pn)}` : `Senator for ${STATE_SHORT[d.st]}, ${partyName(d.hold.ab, d.hold.pn)}`, h: norm(d.n), rank: 1 });
  return items;
}

/* =============================== the Senate lens ===============================
   Each seat's and polling place's Senate vote (map/data/senate-vote-<year>.json, .build/map/senate_vote.py):
   a party's share of the Senate's first preferences there, or (the lens's opening reading) that share less
   its House share, the split ticket: above zero where it polled better in the Senate. The gap is drawn only
   where the party stood for the House; the 2026 Farrer by-election had no Senate vote; the AEC served no
   Senate counts by polling place for 2004; a state election (SA 2026) has no Senate. Loaded with the lens. */
const SV = {}, SVP = {};
const svYear = (y) => (y === "now" ? 2025 : typeof y === "number" ? y : null);
function loadSenateVote(y, bg) {
  const k = svYear(y);
  if (k == null) return Promise.resolve(null);
  if (SV[k]) return Promise.resolve(SV[k]);
  return (SVP[k] ??= getJSON(`/map/data/senate-vote-${k}.json`, bg).then((j) => (SV[k] = j)).catch((e) => { delete SVP[k]; throw e; }));
}
const svOf = (m) => SV[svYear(m.year)] || null;
const svShare = (r, fam) => (r && r[0] ? (100 * r[1 + FAMS.indexOf(fam)]) / r[0] : null);
const senGap = () => S.senMode !== "share";
const stoodFor = (d, fam) => d.c.some((c) => c.b === fam);
function senDivValue(m, d) {
  if (d.by) return null; // the by-election had no Senate vote
  const s = svOf(m), v = s && svShare(s.divs[d.n], S.party);
  if (v == null) return null;
  return !senGap() ? v : stoodFor(d, S.party) ? v - d.fp[S.party] : null;
}
function senBoothValue(m, j) {
  const s = svOf(m), D = m.divs[m.booth.d[j]];
  if (!s || D.by) return null;
  const v = svShare(s.booths[m.booth.id[j]], S.party);
  if (v == null) return null;
  if (!senGap()) return v;
  const h = m.booth.fp[S.party][j];
  return stoodFor(D, S.party) && !Number.isNaN(h) ? v - h : null;
}
// an area's Senate share, its House share and the gap, over its seats (the by-election left out: no Senate vote)
function senArea(m, idx, fam) {
  const s = svOf(m); if (!s) return null;
  let sv = 0, sf = 0, hv = 0, hf = 0, stood = 0, n = 0;
  for (const i of idx) {
    const d = m.divs[i], r = s.divs[d.n]; if (d.by || !r) continue;
    sv += r[1 + FAMS.indexOf(fam)]; sf += r[0]; hv += (d.fp[fam] * d.formal) / 100; hf += d.formal; n++;
    if (stoodFor(d, fam)) stood++;
  }
  if (!sf) return null;
  return { sen: (100 * sv) / sf, house: (100 * hv) / hf, gap: (100 * sv) / sf - (100 * hv) / hf, stood, n };
}
// why a seat or place has no figure
function senNoValue(m, kind, d) {
  if (svYear(m.year) == null) return "A state election has no Senate";
  if (d && d.by) return "No Senate vote at the by-election";
  if (kind === "booth" && svYear(m.year) === 2004) return "No Senate count by polling place in 2004";
  if (senGap() && d && !stoodFor(d, S.party)) return "Didn’t stand for the House here";
  return "No Senate count here";
}
// "polled 3.2 points higher in the Senate than in the House"; under a quarter point, about the same (the
// figures beside it, at a decimal place, can differ by a tenth)
const senGapWords = (g) => (Math.abs(g) < 0.25 ? "polled about the same in the Senate as in the House" : `polled ${pts(g)} ${g > 0 ? "higher" : "lower"} in the Senate than in the House`);
// a family as the copy refers back to it: the parties singular, independents and other candidates plural
const senPron = (fam) => (fam === "ind" || fam === "oth" ? { it: "they", its: "their", It: "They", Its: "Their" } : { it: "it", its: "its", It: "It", Its: "Its" });

/* =========================== the Senate preferences lens ===========================
   How a group of voters ranked two parties on their Senate ballots: every formal ballot since 2016, by
   seat and polling place (map/data/senate-prefs-<year>.json, .build/map/senate_prefs.mjs). Before 2016
   the AEC's machine record of preferences is the parties' lodged group voting tickets — a party-box vote
   copied its party's ticket — so 2004-2013 comes from the tickets themselves (.build/map/senate_gvt_prefs.py,
   marked gvt: true) and the lens presents those years as party tickets, never as ballot tallies. Three
   contests (Labor v the Coalition, Labor v One Nation, the Coalition v One Nation), each read for the
   voters whose preferences decide it: the third big party's, the Greens' and everyone else's. A seat's
   figure is the share of that cohort's ballots (or ticket-bound ballots) ranking the first-named party
   ahead, of those numbering either; ballots numbering neither are set aside (and counted in the story).
   Loaded with the lens. */
const SPD = {}, SPDP = {};
const SP_YEARS = new Set([2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]);
// the ticket era: figures are the parties' lodged group voting tickets (.build/map/senate_gvt_prefs.py)
const SP_GVT = new Set([2004, 2007, 2010, 2013]);
const spGvtYear = (y) => { const k = spYear(y); return k != null && SP_GVT.has(k) ? k : null; };
/* the pairings the Senate orders are tallied for. The first three serve this lens; the two-party
   lens's built contests add the three Greens pairings (their counts ride after these in the 2022
   and 2025 files — senate-prefs-*.json carries them where a contest can be built from them) */
const SP_PAIRS = { AC: ["alp", "lnp"], AO: ["alp", "onp"], CO: ["lnp", "onp"], GO: ["grn", "onp"], GA: ["grn", "alp"], GC: ["grn", "lnp"] };
const SP_DONORS = { AC: ["grn", "onp", "oth"], AO: ["lnp", "grn", "oth"], CO: ["alp", "grn", "oth"], GO: ["alp", "lnp", "oth"], GA: ["lnp", "onp", "oth"], GC: ["alp", "onp", "oth"] };
const SP_MIN = 30; // fewer ballots naming either party than this, and a place shows no figure
const spYear = (y) => (SEN_PREF_STATE_FRAMES.has(y) ? y : (() => { const k = svYear(y); return k != null && SP_YEARS.has(k) ? k : null; })());
function loadSenatePrefs(y) {
  const k = spYear(y);
  if (k == null) return Promise.resolve(null);
  if (SPD[k]) return Promise.resolve(SPD[k]);
  return (SPDP[k] ??= getJSON(`/map/data/senate-prefs-${k}.json`).then((j) => (SPD[k] = j)).catch((e) => { delete SPDP[k]; throw e; }));
}
const spOf = (m) => SPD[spYear(m.year)] || null;
// the slot of the chosen contest and voters in a seat's 27 counts
function spSlot() {
  let k = 0;
  for (const p of ["AC", "AO", "CO"]) for (const d of SP_DONORS[p]) { if (p === S.spPair && d === S.spFrom) return 3 * k; k++; }
  return -1;
}
function spCells(arr) { const k = spSlot(); return arr && k >= 0 ? { x: arr[k], y: arr[k + 1], nei: arr[k + 2] } : null; }
function spVal(arr) { const c = spCells(arr); return c && c.x + c.y >= SP_MIN ? (100 * c.x) / (c.x + c.y) : null; }
// a party of the contest with no group on the state's Senate ballot (One Nation in the ACT, and in the NT until 2025)
const spAbsent = (m, st) => { const s = spOf(m), a = s && s.absent && s.absent[st]; return a ? SP_PAIRS[S.spPair].find((f) => a.includes(f)) || null : null; };
function spDivValue(m, d) { if (d.by) return null; const s = spOf(m); return s && !spAbsent(m, d.st) ? spVal(s.divs[d.n]) : null; }
function spBoothValue(m, j) { const s = spOf(m), D = m.divs[m.booth.d[j]]; if (!s || D.by || spAbsent(m, D.st)) return null; return spVal(s.booths[m.booth.id[j]]); }
function spArea(m, idx) {
  const s = spOf(m); if (!s) return null;
  let x = 0, y = 0, nei = 0;
  for (const i of idx) { const d = m.divs[i]; if (d.by || spAbsent(m, d.st)) continue; const c = spCells(s.divs[d.n]); if (c) { x += c.x; y += c.y; nei += c.nei; } }
  return x + y ? { share: (100 * x) / (x + y), n: x + y, nei: (100 * nei) / (x + y + nei) } : null;
}
// the contest's parties as the copy names them, and the voters
const spName = (fam, cap) => (fam === "alp" ? "Labor" : fam === "onp" ? "One Nation" : STATE_YEARS.has(S.year) ? (cap ? "The Liberals" : "the Liberals") : cap ? "The Coalition" : "the Coalition");
const spA = (cap) => spName(SP_PAIRS[S.spPair][0], cap), spB = () => spName(SP_PAIRS[S.spPair][1]);
const spWho = () => (S.spFrom === "oth" ? "other parties’ and independents’" : POSS[S.spFrom]);
const SP_PAIR_OPTS = [["AO", "Labor v One Nation"], ["AC", "Labor v the Coalition"], ["CO", "the Coalition v One Nation"]];
const spDonorOpts = () => SP_DONORS[S.spPair].map((f) => [f, f === "oth" ? "other parties’ and independents’" : POSS[f]]);
const spRamp = () => (S.spPair === "AC" ? RAMP.div : S.spPair === "AO" ? RAMP.divOn : RAMP.divCo);
function spNoValue(m, kind, d) {
  if (svYear(m.year) == null) return "A state election has no Senate";
  if (spYear(m.year) == null) return "No Senate preference record before 2004";
  if (d && d.by) return "No Senate vote at the by-election";
  const ab = d && spAbsent(m, d.st);
  if (ab) return `${spName(ab, true)} had no Senate ticket in ${STATE_NAME[d.st] || d.st}`;
  if (kind === "booth" && spYear(m.year) === 2004) return "No Senate count by polling place in 2004";
  return kind === "booth" ? "Too few of these ballots here" : "Too few of these ballots";
}

/* ===================== South Australia's chambers — and New South Wales' Council =====================
   The House of Assembly and the Legislative Council as they are built, after the Parliament of
   South Australia's chamber maps (chamber-maps.parliament.sa.gov.au): two rooms of the same size,
   the Speaker's (the President's) chair on its dais at the northern end, the table below it with
   the Clerk, the Chairman of Committees and the Deputy Clerk, then a wide open floor. Down either
   side run the benches: the front bench, and two rows behind it in the Assembly (one in the
   Council), each cut by a cross-aisle; at the southern end each side's back rows curve round its
   own centre to meet the gangway, so the two curves never join. The government sits on the
   presiding officer's right (the reader's left). The Assembly seats 61 and its Speaker, the Council
   28 and its President. Drawn by the House's renderer (drawChamber) like the Senate's floor; where
   a plan is filed (map/data/seats-<year>.json, seats-<year>-lc.json, from .build/map/sa_seating.mjs)
   each member sits at their desk, otherwise each bloc fills the benches from the chair's end.
   New South Wales' Council uses the same renderer with its own rectangular floor. Its
   proportions and furniture follow the user's four chamber photographs (2026-10-30) and
   Parliament's chamber layout (https://www.parliament.nsw.gov.au/parliamentary-business/legislative-council/the-chamber):
   government on the President's right (drawing left), opposition
   on the left, crossbenches across the entrance end and on the detached inner benches.
   The long table has a broad clerks' head and a rounded entrance end, with three members'
   chairs along each side. The vice-regal chair is behind the President, not a second President
   or deputy. These are schematic member positions, not an assigned seating plan or a count
   of fixed chairs: the leather benches have no individual desks. Party/term sorting is retained.
   @sa-cells-begin – read as is by .build/map/sa_seating.mjs, which checks every desk a plan names
   is one drawn here. SA is measured off the chamber maps' floor images (pixels, x from the centre line,
   y down from the curves' centres), with the Parliament's own desk names; NSW uses schematic ids.
   A side's list reads
   down a column from the chair's end, or round a curve from the side wall to the gangway ("-" is
   no seat: the opposition's front bench has none at the cross-aisle). A room's southern wall
   (room[3]) ends with its seats: the lowest bench's southern edge plus the carpet skirt the
   House floor keeps (4.5 plan points, 5.4 pixels here — the 2026-10-27 substrate trim; test-
   map-page.mjs pins the relation for every floor). */
const SAF = {
  ha: {
    room: [-360, -700, 360, 246], chair: -649.5, officers: [-553.5, 70], table: [-527, -484, 92], mace: true, lead: ["A1", "F1"],
    straight: [
      { row: 1, x: 140, ys: [-461.3, -410.3, -359.3, -308.3, -257.3, -206.3, -155.3, -104.3, -53.3], L: "A1 A2 A3 A4 A5 B1 B2 B3 B4", R: "F1 F2 F3 F4 - E1 E2 E3 E4" },
      { row: 2, x: 231, ys: [-459.8, -383.8, -307.8, -205.8, -129.8, -53.8], L: "G1 G2 G3 H1 H2 H3", R: "J1 J2 J3 I1 I2 I3" },
      { row: 3, x: 323, ys: [-459.8, -383.8, -307.8, -205.8, -129.8, -53.8], L: "K1 K2 K3 L1 L2 L3", R: "Q1 Q2 Q3 P1 P2 P3" },
    ],
    // each curve: its centre (a out from the centre line, y), radius, and seats by degrees below the horizontal
    arcs: [
      { row: 2, a: 105, y: 2.5, r: 112.5, phi: [13, 38.3, 63.3, 88], L: "C4 C3 C2 C1", R: "D1 D2 D3 D4" },
      { row: 3, a: 97.3, y: -1.4, r: 213, phi: [13.6, 26.3, 39.2, 59.3, 72, 84.6], L: "M3 M2 M1 N3 N2 N1", R: "R1 R3 R2 O2 O1 O3" },
    ],
  },
  lc: {
    room: [-350, -690, 350, 235], chair: -630.5, officers: [-526.5, 56], table: [-500, -458, 78], mace: false, lead: ["A1", "D1"],
    straight: [
      { row: 1, x: 131, ys: [-303, -205, -141, -77], L: "A1 B1 B2 B3", R: "D1 C1 C2 C3" },
      { row: 2, x: 235, ys: [-433, -369.5, -303, -205, -141, -77], L: "E1 E2 E3 F1 F2 F3", R: "L1 L2 L3 K1 K2 K3" },
    ],
    arcs: [{ row: 2, a: 125, y: 0, r: 97, phi: [11, 40, 70], L: "G3 G2 G1", R: "J3 J2 J1" }],
    // a lone seat either side of the gangway, beyond the curves, facing the chair
    singles: [{ row: 2, x: 170, y: 201, L: "H1", R: "I1" }],
  },
  // NSW Council: long rectangular room, two facing rows on each side, divided inner
  // benches at the entrance end. The government side stops short of the rear wall.
  // The rear left long bench and the two short benches beside the central gate face
  // the President. Gallery furniture is neutral and never counted as members.
  nswLC: {
    room: [-320.4, -650, 320.4, 318.4], chair: -510, chairW: 38, chairD: 36,
    seat: { W: 35, D: 38 },
    officers: [-391, 65], mace: false, lead: ["T1", "U1"],
    plat: { w: 88, y0: -625, y1: -448, regal: -588 },
    presidentDesk: { x: 62, y0: -484, y1: -458 },
    headBenches: { x0: 110, x1: 293, ys: [-602, -558], depth: 28 },
    ltable: { x: 65, hx: 110, hd: 68, y0: -360, y1: 165, cx: 99, chairs: [-236, -110, 16], rod: 134 },
    transverse: { y0: 293, y1: 313, half: 315, gap: 30 },
    gang: 130, usher: 201,
    vacant: ["C7", "C8", "C9", "D7", "D8", "D9"],
    // Six of the 48 schematic member positions are at the table, not on the benches.
    tableSeats: { L: "T1 T2 T3", R: "U1 U2 U3" },
    blocs: {
      gov: "T1 T2 T3 A1 C1 A2 C2 A3 C3 A4 C4 A5 C5 A6 C6",
      opp: "U1 U2 U3 B1 D1 B2 D2 B3 D3 B4 D4 B5 D5 B6 D6",
      cross: "A7 A8 X4 X3 X2 X1 Y2 Y1 E1 E2 B8 B7",
    },
    straight: [
      { row: 1, x: 180, ys: [-440, -358, -276, -194, -112, -30, 104, 154], breakAfter: [5], L: "A1 A2 A3 A4 A5 A6 A7 A8", R: "" },
      { row: 1, x: 180, ys: [-440, -350, -260, -170, -80, 10, 164, 214], breakAfter: [5], L: "", R: "B1 B2 B3 B4 B5 B6 B7 B8" },
      { row: 2, x: 270, ys: [-440, -365, -290, -215, -140, -65, 10, 85, 160], L: "C1 C2 C3 C4 C5 C6 C7 C8 C9", R: "" },
      { row: 2, x: 270, ys: [-440, -358, -276, -194, -112, -30, 52, 134, 216], L: "", R: "D1 D2 D3 D4 D5 D6 D7 D8 D9" },
    ],
    singles: [
      { row: 2, x: 52, y: 270, L: "Y1", bench: "left-pair" },
      { row: 2, x: 99, y: 270, L: "Y2", bench: "left-pair" },
      { row: 2, x: 151, y: 270, L: "X1", bench: "left-long" },
      { row: 2, x: 198, y: 270, L: "X2", bench: "left-long" },
      { row: 2, x: 245, y: 270, L: "X3", bench: "left-long" },
      { row: 2, x: 292, y: 270, L: "X4", bench: "left-long" },
      { row: 2, x: 52, y: 270, R: "E1", bench: "right-pair" },
      { row: 2, x: 99, y: 270, R: "E2", bench: "right-pair" },
    ],
    arcs: [],
  },
};
// every seat on a floor: { id, x, y (pixels), fa (the way it faces), row, arc? }
function saCells(F) {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, key = side ? "R" : "L";
    // a side's seat list may be "" (its floor runs no bench on that row's side) or hold "-" blanks
    for (const b of F.straight) b[key].split(" ").forEach((id, j) => { if (id && id !== "-") cells.push({ id, x: sx * b.x, y: b.ys[j], fa: side ? Math.PI : 0, row: b.row }); });
    for (const b of F.arcs) b[key].split(" ").forEach((id, j) => {
      if (!id || id === "-") return;
      const p = b.phi[j] * D, x = sx * (b.a + b.r * Math.cos(p)), y = b.y + b.r * Math.sin(p);
      cells.push({ id, x, y, fa: Math.atan2(b.y - y, sx * b.a - x), row: b.row, arc: b });
    });
    for (const b of F.singles || []) if (b[key]) cells.push({ id: b[key], x: sx * b.x, y: b.y, fa: -Math.PI / 2, row: b.row });
    if (F.tableSeats) F.tableSeats[key].split(" ").forEach((id, j) => cells.push({ id, x: sx * F.ltable.cx, y: F.ltable.chairs[j], fa: side ? Math.PI : 0, row: 0 }));
  }
  return cells;
}
/* @sa-cells-end */
const SAU = 36; // the floor images' pixels to a chamber unit
const SA_SEAT = { W: 46, D: 50 }; // a chair, in pixels: along its bench, and deep
const SA_PAD = 4; // a bench's margin round its chairs
const saGeomC = {};
// the chamber the year's House or council is drawn in (nsw23's Assembly never reaches here:
// chamberGeom routes it to app-3-chamber.js's nswGeom first)
const saFloorOf = (m) => (NSW_YEARS.has(m.year) ? "nswLC" : m.house === "senate" ? "lc" : "ha");
function saGeom(key) {
  if (saGeomC[key]) return saGeomC[key];
  const F = SAF[key], P = (v) => v / SAU;
  // a floor may carry a room-sized chair of its own (Sydney's Council draws a smaller seat for
  // its small room — never the shared 46x50, which reads oversized beside the other houses)
  const seat = F.seat ?? SA_SEAT;
  // the curves' common centre, each side's (half the gap between them), for the order along the
  // benches (Sydney's Council has no curves — its gangway width stands in)
  const A = P(F.arcs.length ? F.arcs.reduce((t, b) => t + b.a, 0) / F.arcs.length : F.gang ?? 0);
  // the order along the benches: down the government's side, round its curve, across the gangway
  // (its own stretch, 2A long), round the opposition's curve and up its side. A curve seat goes by
  // its angle about its own curve's centre, held to its own side of the gangway
  const Q = (Math.PI / 2) * CHK, GAP = 2 * A, D2R = Math.PI / 180;
  const sideS = (c, x, y) => {
    const right = c.x > 0;
    if (!c.arc && y <= 0) return right ? 2 * Q + GAP - y : y;
    const ang = c.arc ? c.arc.phi[c.arc[right ? "R" : "L"].split(" ").indexOf(c.id)] * D2R : Math.atan2(y, Math.abs(x) - A);
    return right ? 2 * Q + GAP - Math.min(ang, Math.PI / 2) * CHK : Math.min(ang, Math.PI / 2) * CHK;
  };
  const all = saCells(F).map((c) => {
    const x = P(c.x), y = P(c.y);
    // seg: which stretch of bench it's on (a side's straight, its curve, a lone seat), where a row breaks off
    const seg = (c.x > 0 ? 3 : 0) + (c.arc ? 1 : y > 0 ? 2 : 0);
    // (pad: the bench order's clearance past it, for the majority line — round a curve, by its radius)
    const pad = c.arc ? (P(seat.W / 2 + 10) / P(c.arc.r)) * CHK : P(seat.W / 2 + 10);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: sideS(c, x, y), seg, pad, W: P(seat.W - 4), D: P(seat.D - 6), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  seats.forEach((c, k) => { c.k = k; });
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c) => { c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const byId = new Map(seats.map((c) => [c.id, c.k]));
  // the ledger's spare desks (Sydney's Council keeps more seats than members): their k's, so the
  // bench fill walks past and they draw as empty outlined seats
  const vacant = new Set((F.vacant ?? []).map((id) => byId.get(id)).filter((k) => k != null));
  const nRows = Math.max(...seats.map((c) => c.row));
  const rows = Array.from({ length: nRows + 1 }, (_, r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curves (their
  // radius about the side's centre; the front bench doesn't curve, so round the curves it stands a
  // chair inside the row behind it, and the line runs just inside the inner curve's chairs)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = rows.slice(1).map((r) => mean(r.filter((c) => !c.raw.arc && c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = rows.slice(1).map((r) => { const a = r.filter((c) => c.raw.arc); return a.length ? mean(a.map((c) => P(c.raw.arc.r))) : null; });
  for (let j = rowR.length - 2; j >= 0; j--) if (rowR[j] == null) rowR[j] = rowR[j + 1] - P(seat.D + 14);
  // a floor with no curves (Sydney's Council): the walkways run with the rows' own bookshelves
  if (rowR.every((v) => v == null)) for (let j = 0; j < rowR.length; j++) rowR[j] = rowX[j];
  const walk = (v) => { const w = [v[0] - (v.length > 1 ? (v[1] - v[0]) / 2 : 0.7)]; for (let j = 1; j < v.length; j++) w.push((v[j - 1] + v[j]) / 2); w.push(v[v.length - 1] + 0.75); return w.map((x) => Math.max(0.15, x)); };
  const GS = walk(rowX), GC = walk(rowR);
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= 2 * Q + GAP) return [GS[k], 2 * Q + GAP - s];
    if (s > Q && s < Q + GAP) return [s - Q - A, GC[k]];
    const a = (s < Q ? s : s - GAP) / CHK, c = Math.cos(a);
    return [(s < Q ? -A : A) - GC[k] * c, GC[k] * Math.sin(a)];
  };
  const benchOut = (s) => {
    if (s <= 0) return [-1, 0];
    if (s >= 2 * Q + GAP) return [1, 0];
    if (s > Q && s < Q + GAP) return [0, 1];
    const a = (s < Q ? s : s - GAP) / CHK; return [-Math.cos(a), Math.sin(a)];
  };
  const [rx0, ry0, rx1, ry1] = F.room.map(P);
  saGeomC[key] = {
    key, seats, rows, nRows, bench: seats.filter((c) => c.row > 0 || F.tableSeats), byId, vacant,
    blocSeats: F.blocs ? Object.fromEntries(Object.entries(F.blocs).map(([bloc, ids]) => [bloc, ids.split(" ").map((id) => byId.get(id))])) : null,
    // the bloc labels hang just outside the room's walls
    rOut: rx1 - 0.6, box: { x0: rx0, x1: rx1, y0: ry0, y1: ry1 }, rect: true, cutPad: P(seat.W / 2 + 10),
    arms: false, table: F.lead, chairAt: [0, P(F.chair), Math.PI / 2, 0, P(F.chairW ?? 40), P(F.chairD ?? 38)],
    aisle: P((F.officers[0] + F.straight[0].ys[0]) / 2 + 40), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    // the stretch of bench a position along it falls on, as seats' seg (the gangway's -1; a lone seat's curve)
    segAt: (s) => (s <= 0 ? 0 : s < Q ? 1 : s <= Q + GAP ? -1 : s < 2 * Q + GAP ? 4 : 3),
    benchPt, benchOut, furniture: drawSAFurniture,
  };
  return saGeomC[key];
}
// a point on the room's floor (chamber units), for keeping labels off it
const saOnFloor = (geom, u, v, pad = 0) => u >= geom.box.x0 - pad && u <= geom.box.x1 + pad && v >= geom.box.y0 - pad && v <= geom.box.y1 + pad;

/* the room, in the House's drawing: the floor, the benches (a bench's colour with a margin round its
   chairs: the front bench and each three-seat block one bench down the straight, each run of a curve
   one bench round it), the Speaker's dais, the table with the Mace (the Assembly's), the officers'
   chairs, and the empty seats (outlined only) */
function drawSAFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, P = (v) => v / SAU, k = s / SAU, D2R = Math.PI / 180;
  const SF = SAF[geom.key];
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  // the floor
  const b = geom.box;
  g.fillStyle = css(th.floor); g.fillRect(X(b.x0), Yp(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
  // the rest in the plan's pixels
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k;
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h, r = 4) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  // the room's own chair where the ledger carries one (Sydney's Council's smaller seat)
  const seat = SF.seat ?? SA_SEAT, hw = seat.W / 2 + SA_PAD, hd = seat.D / 2 + SA_PAD;
  for (const side of [-1, 1]) {
    const key = side > 0 ? "R" : "L";
    // down the straight: a run of seats closer than a seat and a half apart is one bench
    for (const r of SF.straight) {
      const ys = r[key].split(" ").map((id, j) => (id && id !== "-" ? r.ys[j] : null));
      const pitch = Math.min(...r.ys.slice(1).map((y, j) => y - r.ys[j]).filter((d) => d > 0));
      let run = null;
      const flush = () => { if (run) rb(side * r.x - hd, run[0] - hw, 2 * hd, run[1] - run[0] + 2 * hw); run = null; };
      for (const [j, y] of ys.entries()) { if (y == null) { flush(); continue; } if (run && (r.breakAfter ? !r.breakAfter.includes(j - 1) : y - run[1] <= pitch * 1.5)) run[1] = y; else { flush(); run = [y, y]; } }
      flush();
    }
    // round the curves: each run a sector of its curve, about that side's own centre — a
    // side's "-" keys stop that side's bench short, as on the straights
    for (const a of SF.arcs) {
      const step = Math.min(...a.phi.slice(1).map((p, j) => p - a.phi[j]));
      const runs = [];
      for (const p of a[key].split(" ").map((id, j) => (id === "-" ? null : a.phi[j]))) { if (p === null) continue; const last = runs[runs.length - 1]; if (last && p - last[1] <= step * 1.5) last[1] = p; else runs.push([p, p]); }
      for (const [p0, p1] of runs) {
        const half = (hw / a.r) / D2R, c = side * a.a;
        // canvas angles: the opposition's quarter runs from the horizontal down; the government's mirrors it
        const A0 = (side > 0 ? p0 - half : 180 - p0 + half) * D2R, A1 = (side > 0 ? p1 + half : 180 - p1 - half) * D2R;
        g.beginPath(); g.arc(c, a.y, a.r + hd, A0, A1, side < 0); g.arc(c, a.y, a.r - hd, A1, A0, side > 0); g.closePath(); g.fill(); g.stroke();
      }
    }
    const rearRuns = new Map();
    for (const q of SF.singles || []) if (q[key]) {
      if (!q.bench) rb(side * q.x - hw, q.y - hd, 2 * hw, 2 * hd);
      else { const run = rearRuns.get(q.bench) || []; run.push(q); rearRuns.set(q.bench, run); }
    }
    for (const run of rearRuns.values()) {
      const xs = run.map((q) => side * q.x), x0 = Math.min(...xs) - hw, x1 = Math.max(...xs) + hw;
      rb(x0, run[0].y - hd, x1 - x0, 2 * hd);
    }
    if (SF.headBenches) {
      const H = SF.headBenches;
      for (const y of H.ys) rb(side > 0 ? H.x0 : -H.x1, y, H.x1 - H.x0, H.depth);
    }
  }
  // the dais, raised above the floor, its step drawn inside — Sydney's Council instead keeps a
  // shallow closed platform at the President's end (its own plan and the chamber photographs:
  // no open U), one piece with its front lip
  if (SF.plat) {
    const { w: pw, y0: py0, y1: py1 } = SF.plat;
    g.beginPath(); if (g.roundRect) g.roundRect(-pw, py0, 2 * pw, py1 - py0, 8); else g.rect(-pw, py0, 2 * pw, py1 - py0);
    g.fillStyle = wood; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-pw + 8, py1 - 10); g.lineTo(pw - 8, py1 - 10); g.stroke();
    const desk = SF.presidentDesk;
    if (desk) { g.fillStyle = bench; rb(-desk.x, desk.y0, 2 * desk.x, desk.y1 - desk.y0, 3); }
  } else {
    const dais = (inset) => { const w = 52 - inset, yt = SF.room[1] + 6 + inset, yc = SF.chair + 12; g.beginPath(); g.moveTo(-w, yt); g.lineTo(w, yt); g.lineTo(w, yc); g.arc(0, yc, w, 0, Math.PI); g.closePath(); };
    dais(0); g.fillStyle = wood; g.fill(); g.stroke();
    dais(7); g.fillStyle = bench; g.fill();
  }
  // the table below it, the officers' chairs at its head; the Mace on the Assembly's — Sydney's
  // Council keeps no clerks' desk by the dais (2026-10-28: its three clerks chair the table's head)
  const [t0, t1, tw] = SF.table ?? [0, 0, 0];
  if (SF.table) {
    g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood; g.fillStyle = bench;
    rb(-tw, t0, 2 * tw, t1 - t0, 3);
    g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  // Sydney's Council's long table: a T the federal House's way but with the wide speaker-side head
  // drawn a touch stronger (hx deep hd), the stem narrowing south and its bar end rounded, a
  // timber rim about a dark burgundy inset, the Black Rod lying across inside the rounded end
  if (SF.ltable) {
    const L = SF.ltable;
    const tPath = (inset) => {
      const r = L.x - inset, hx = L.hx - inset, cy = L.y1 - L.x, y0 = L.y0 + inset, shoulder = L.y0 + L.hd - inset;
      g.beginPath(); g.moveTo(-hx, y0); g.lineTo(hx, y0); g.lineTo(hx, shoulder);
      g.lineTo(r, shoulder); g.lineTo(r, cy); g.arc(0, cy, r, 0, Math.PI); g.lineTo(-r, shoulder);
      g.lineTo(-hx, shoulder); g.closePath();
    };
    const burg = css(mixC(th.floor, [104, 28, 38], th.dark ? 0.55 : 0.78));
    tPath(0); g.fillStyle = wood; g.fill(); g.stroke();
    tPath(6); g.fillStyle = burg; g.fill();
    // Keep only the clerks' raised book rack across the President's end.
    g.fillStyle = wood;
    rb(-L.hx + 12, L.y0 + L.hd - 22, 2 * (L.hx - 12), 13, 2);
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(hair, (0.05 * s) / k); g.lineCap = "round";
    g.beginPath(); g.moveTo(-24, L.rod); g.lineTo(24, L.rod); g.stroke();
    g.lineCap = "butt"; g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  // the far wall's transverse backing: straight sections split at the bar, outline only —
  // a physical-layout note, never a member's seat
  if (SF.transverse) {
    const T = SF.transverse;
    for (const [x0, x1] of [[-T.half, -T.gap], [T.gap, T.half]]) {
      g.beginPath(); if (g.roundRect) g.roundRect(x0, T.y0, x1 - x0, T.y1 - T.y0, 4); else g.rect(x0, T.y0, x1 - x0, T.y1 - T.y0);
      g.stroke();
    }
  }
  if (SF.mace && s > 9) {
    const my = t1 - 11, mx = tw * 0.45;
    g.strokeStyle = css(th.faint); g.lineWidth = Math.max(hair, (0.07 * s) / k); g.lineCap = "round";
    g.beginPath(); g.moveTo(-mx, my); g.lineTo(mx, my); g.stroke();
    g.beginPath(); g.arc(-mx, my, (0.12 * s) / k, 0, Math.PI * 2); g.fillStyle = css(th.faint); g.fill();
    g.lineCap = "butt"; g.lineWidth = hair; g.strokeStyle = css(th.line);
  }
  g.restore();
  // the empty seats, outlined only, so they never read as a member's chair (a dimmed one is filled)
  g.strokeStyle = css(mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24)); g.lineWidth = 1;
  for (const c of geom.seats) {
    if (opts.occupied && opts.occupied.has(c.k)) continue;
    const w = c.W * s, d = c.D * s, r = Math.min(w, d) * 0.24;
    g.save(); g.translate(X(c.x), Yp(c.y)); g.rotate(c.fa);
    g.beginPath(); if (g.roundRect) g.roundRect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1, r); else g.rect(-d / 2 + 0.5, -w / 2 + 0.5, d - 1, w - 1);
    g.stroke(); g.restore();
  }
  // the officers: the Clerk on the chair's right, the Chairman of Committees, the Deputy Clerk —
  // Sydney's Council chairs its three at the long table's head between platform and table, facing
  // the bar (their short desk by the dais is gone)
  const [oy, odx] = SF.officers, W = P(30) * s, Dp = P(28) * s;
  for (const ox of SF.twoOfficers ? [-odx, odx] : [-odx, 0, odx]) drawChair(g, X(P(ox)), Yp(P(oy)), Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  // Sydney's Council keeps the Usher of the Black Rod at the long table's rounded end, on his own chair facing back to the President
  if (SF.usher != null) drawChair(g, X(0), Yp(P(SF.usher)), -Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  // The ceremonial vice-regal chair stands behind the President's working chair.
  // A named President, when available in the model, is painted at SF.chair by drawChamber.
  if (SF.plat) {
    drawChair(g, X(0), Yp(P(SF.chair)), Math.PI / 2, P(SF.chairW ?? 40) * s, P(SF.chairD ?? 38) * s, css(officer), back(officer, 0.18), 1);
    drawChair(g, X(0), Yp(P(SF.plat.regal)), Math.PI / 2, P(48) * s, P(48) * s, css(officer), back(officer, 0.18), 1);
  }
  // three neutral chairs down each of the long table's flanks, evenly spaced, facing the table
  if (SF.ltable && !SF.tableSeats) {
    const L = SF.ltable, cw = P(20) * s, cd = P(26) * s;
    for (const cx of [-L.cx, L.cx]) for (const cy of L.chairs) drawChair(g, X(P(cx)), Yp(P(cy)), cx < 0 ? 0 : Math.PI, cw, cd, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  // (no furniture labels: the Council's furniture shows through its shapes — the political
  // labels are the only text on its floor)
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
// a state frame's own words: a state election's opposition is the Liberals (the
// LNP in Queensland), its head of government a premier; its counts and state
// word are South Australia's (the ECSA's) only on an SA frame — New South
// Wales gets the NSWEC's wording, Queensland the ECQ's
const isState = () => STATE_YEARS.has(S.year);
const isSA = () => SA_YEARS.has(S.year);
const isNSW = () => NSW_YEARS.has(S.year);
const isVic = () => VIC_YEARS.has(S.year);
const isQld = () => QLD_YEARS.has(S.year);
const isWA = () => WA_YEARS.has(S.year);
// a state frame's elections commission, short form (state frames only)
const commX = () => (isSA() ? "ECSA" : isVic() ? "VEC" : isQld() ? "ECQ" : isWA() ? "WAEC" : "NSWEC");
const coalW = (cap) => (isSA() || isVic() || isWA() ? (cap ? "The Liberals" : "the Liberals") : isQld() ? (cap ? "The LNP" : "the LNP") : cap ? "The Coalition" : "the Coalition");
// (WA says Liberals like SA and Victoria by word choice, never Coalition or LNP;
// the Nationals WA ride the lnp family here, as Victoria's do — a display
// compromise in every sense, worth its own note: there is no Coalition in
// WA at state level, and WAEC's tallies never publish one)
// the rival's bare name where the hero and margin bars want one ("Liberal"/"LNP"/"Coalition")
const oppNameW = () => (isSA() || isVic() || isWA() ? "Liberal" : isQld() ? "LNP" : "Coalition");
const leaderT = () => (isState() ? "premier" : "prime minister");
const ausW = () => (isSA() ? "South Australia" : isNSW() ? "New South Wales" : isVic() ? "Victoria" : isQld() ? "Queensland" : isWA() ? "Western Australia" : "Australia");
const legW = (b) => famLeg(b);
// a family's preferences, possessive: the Liberals' on an SA or Victorian frame,
// the LNP's on a Queensland frame, the Coalition's elsewhere
const possW = (b) => (b === "lnp" && isQld() ? "the LNP’s" : b === "lnp" && (isSA() || isVic() || isWA()) ? "the Liberals’" : POSS[b]);
// an "as it stands" view: today’s holder won the last count under another
// banner — the winner’s row in the count stays historical but earns a note
const movedTo = (m, d) => (isNowY(m.year) && d.hold && d.hold.n === d.win.n && d.hold.ab !== d.win.ab ? leaderName(d.hold) : null);
function swingPhrase(sw, prev) {
  if (sw == null) return "";
  if (Math.abs(sw) < 0.05) return `no swing since ${prev}`;
  return `a swing of ${pts(sw)} to ${sw > 0 ? "Labor" : coalW()} since ${prev}`;
}
function upDown(v, unit = "points") { const a = Math.abs(v); if (a < 0.05) return "unchanged"; return `${v >= 0 ? "up" : "down"} ${a.toFixed(1)} ${a.toFixed(1) === "1.0" ? unit.replace(/s$/, "") : unit}`; }
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// a rank among n seats, from whichever end is nearer: "the highest", "the third lowest"
function rankWords(r, n, hi = "highest", lo = "lowest") { const q = n - r + 1; if (r <= 10) return r === 1 ? `the ${hi}` : `the ${ordw(r)} ${hi}`; if (q <= 10) return q === 1 ? `the ${lo}` : `the ${ordw(q)} ${lo}`; return `the ${ord(r)} ${hi}`; }
const SUBJ = { alp: "Labor", lnp: "The Coalition", grn: "The Greens", onp: "One Nation", ind: "Independents", oth: "Other candidates" };
const subj = (f) => (f === "alp" || f === "onp" ? SUBJ[f] : SUBJ[f].charAt(0).toLowerCase() + SUBJ[f].slice(1));
const ofN = (k, n) => (k === n ? `all ${n}` : `${k} of the ${n}`);
const byNote = (d) => (d && d.by ? `, at the ${d.by.date.slice(0, 4)} by-election` : "");
function seatCount(m, idx, fam) { return idx.filter((i) => m.divs[i].hold.fam === fam).length; }

/* ----- small figure builders ----- */
function upLink() {
  const s = S.sel, m = M();
  // a filtered view (the strip's State or Seat type row) earns the way out
  // above the title in every lens: "All seats" clears both filters
  const clsScoped = m && s.level === "aus" && !!poolParts(m).cls;
  if (s.level === "aus" && !clsScoped) return "";
  const label = s.level === "aus" || s.level === "state" ? "All seats" : s.level === "div" ? STATE_TITLE[s.st] : m.divs[s.div].n;
  const go = s.level === "aus" || s.level === "state" ? "aus:all" : s.level === "div" ? `state:${s.st}` : `div:${s.div}`;
  return `<button type="button" class="st-up" data-go="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${ds(label)}</button>`;
}
/* every head reads the same way down, whatever the lens or level: the place,
   its figures (the seats first), then the lens's own finding in a line of
   prose under them — the figures never wait below a headline. A head with no
   figures block (a seat outside any count) keeps the finding as its lead. */
function head(title, meta, hed, dek, stat) {
  return `${upLink()}<div class="st-head"><h2>${ds(title)}</h2><span class="rd-meta">${meta}</span></div>${stat || ""}${findingHTML(hed, dek, !stat)}`;
}
// the lens's finding under the figures: its headline as a bold lead sentence, the dek after it
function findingHTML(hed, dek, lead) {
  const h = String(hed || "").trim(), d = String(dek || "").trim();
  if (!h && !d) return "";
  const stop = h && !/[.!?…]$/.test(h) ? "." : "";
  return `<p class="st-find${lead ? " st-find-lead" : ""}">${h ? `<b>${h}${stop}</b>` : ""}${h && d ? " " : ""}${d}</p>`;
}
// the Now page's two-party read: two names, two big figures, a rule between
function heroPair(aName, aPct, aFam, bName, bPct, bFam) {
  return `<div class="hero-read" role="img" aria-label="${ds(aName)} ${f1(aPct)}, ${ds(bName)} ${f1(bPct)}">
    <div class="hero-side a"><span class="hero-name" style="color:${famText(aFam)}"><i style="background:${famFill(aFam)}"></i>${ds(aName)}</span><span class="hero-num" style="color:${famFill(aFam)}">${f1(aPct)}</span></div>
    <span class="hero-rule"></span>
    <div class="hero-side b"><span class="hero-name" style="color:${famText(bFam)}">${ds(bName)}<i style="background:${famFill(bFam)}"></i></span><span class="hero-num" style="color:${famFill(bFam)}">${f1(bPct)}</span></div></div>`;
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
    <span class="side" style="left:0;color:${famText(aFam)}">◀ ${ds(aName)} ahead</span><span class="side" style="right:0;color:${famText(bFam)}">${ds(bName)} ahead ▶</span>
    ${ticks.filter((v) => v !== 0).map((v) => `<span class="grid" style="left:${x(v)}%"></span>`).join("")}<span class="tie" style="left:50%"></span>
    <span class="bar" style="${bar};background:${famFill(fam)}"></span><span class="dot" style="left:${x(lead)}%;background:${famFill(fam)}"></span>
    ${ticks.map((v) => { const xv = x(v), edge = xv <= 0 ? " edge-l" : xv >= 100 ? " edge-r" : ""; return `<span class="tick${v === 0 ? " tied" : ""}${edge}" style="left:${xv}%">${lab(v)}</span>`; }).join("")}</div>`;
}
function statusOf(winPct) { return winPct < 56 ? "marginal" : winPct < 60 ? "fairly safe" : "safe"; }

/* the head's figure idioms, shared: the seat's add-on stats (the Final count
   and Primaries sections of a seat's story) reuse these verbatim, so the seat
   view speaks the head's figure language instead of the old hero/margin-bar
   layout (shipped 2026-11-08) */
const tone = (f) => `style="color:${css(TH.party[f])}"`;
/* the head's swing figure: no figure under a quarter point reads "No swing".
   "side" names a family whose colour the figure wears (the seat's Final
   count passes the winner's own when a swing isn't meaningful) */
function swingFigure(s, side = null) {
  if (s == null) return "";
  if (Math.abs(s) < 0.05) return `<span class="st-swing">No swing</span>`;
  const f = side || (s > 0 ? "alp" : "lnp");
  return `<span class="st-swing"><b ${tone(f)}>+${Math.abs(s).toFixed(1)}</b> swing</span>`;
}
/* margin figures widen decimals until the figure shows: a hairline margin
   (Bradfield '25, 26 votes) vanishes at one decimal — show two, or three if
   two would still print zeros (the f1 check keeps null/NaN "–" safe) */
const tightFmt = (v) => (f1(v) === "0.0" ? (v.toFixed(2) === "0.00" ? v.toFixed(3) : v.toFixed(2)) : f1(v));
/* the head's two-party figure block: eyebrow, the pair of figures, the names
   row, and the chip hung off the block's edge. One spine for the head (party
   names + gov tag) and the seat's Final count (candidate surnames + the
   winner's elected/re-elected tag); the seat's variant puts the names ABOVE
   the figures in the swing line's font (black — user call 2026-11-09),
   figures in the parties' own colours, and "parties" re-adds the national
   block's party names under the figures */
const twoPartyFigures = (label, aPct, aFam, aName, bPct, bFam, bName, tag = "", namesUp = false, parties = null) => {
  const under = parties ? `<span class="st-pnm st-pnm-l" ${tone(aFam)} title="${esc(parties[0])}">${parties[0]}</span><span class="st-pnm st-pnm-r" ${tone(bFam)} title="${esc(parties[1])}">${parties[1]}</span>` : "";
  return namesUp
    ? `<span class="st-lab">${label}</span><span class="st-tpp st-nmup"><span class="st-nm st-nm-l" title="${aName}">${aName}</span><span class="st-nm st-nm-r" title="${bName}">${bName}</span><b class="fig-l" ${tone(aFam)}>${f1(aPct)}</b><i>–</i><b class="fig-r" ${tone(bFam)}>${f1(bPct)}</b>${under}${tag}</span>`
    : `<span class="st-lab">${label}</span><span class="st-tpp"><b ${tone(aFam)}>${f1(aPct)}</b><i>–</i><b ${tone(bFam)}>${f1(bPct)}</b><span class="st-nm st-nm-l" ${tone(aFam)} title="${aName}">${aName}</span><span class="st-nm st-nm-r" ${tone(bFam)} title="${bName}">${bName}</span>${tag}</span>`;
};

/* a seat's stat payload: win family × run family (charged on the final two),
   their shares, per-family first-preference shares and per-family changes
   (vote-weighted per candidate figure, mirroring statClassArea's pool rule;
   by-election rows judge against the by-election's base year via byChange) */
function seatStatOf(m, d, py) {
  const o = { winFam: d.win.fam, runFam: d.run.fam, tpp: [d.winPct, 100 - d.winPct], seat: true };
  const cfsw = (c) => (d.by ? byChange(c, d, d.by.prev) : c.sw);
  const fams = {}; let formal = 0;
  for (const c of d.c) {
    formal += c.v;
    if (!fams[c.fam]) fams[c.fam] = { v: 0, swN: 0, swD: 0 };
    fams[c.fam].v += c.v;
    const s = cfsw(c);
    if (s != null) { fams[c.fam].swN += s * c.v; fams[c.fam].swD += c.v; }
  }
  o.fp = {}; o.fpSw = {};
  for (const [k, f] of Object.entries(fams)) { o.fp[k] = formal ? (100 * f.v) / formal : null; o.fpSw[k] = f.swD ? f.swN / f.swD : null; }
  o.formal = formal;
  /* the swing a swing line under the final-count figures may quote: the
     classic pair's own two-party swing only — a notional 2PP swing belongs
     beside the notional figures below, never beside these */
  o.swing = d.classic && d.tppSw != null ? d.tppSw : null;
  o.py = py;
  return o;
}
/* the seat's Final count section in the head's figure idiom: surname names
   row over black figures, the winner's tag chip, the swing line, and the
   seat's own classification inside the eyebrow's margin parenthetical */
/* the seat head's party labels: full names by default, an official
   abbreviation where the name can't wear it (KAP, CLP, LNP…); Country
   Liberal — 15 glyphs, the Lingiari case the user called out — is the
   boundary: it wears its full name, everything past it takes the
   abbreviation */
const PNM_ABBR = { "Katter’s Australian": "KAP", "Country Liberal": "CLP", "Liberal National": "LNP", "The Nationals": "NAT", "Liberal Democrats": "LDP" };
const pnmOf = (c) => { const n = partyName(c.ab, c.pn); return n.length > 15 && PNM_ABBR[n] ? PNM_ABBR[n] : n; };
/* the seat's outcome verb in one word (user call chain 2026-11-09): "retain"
   where the party kept the seat, "gain" where it changed hands, "win" where
   the ledger can't say (new seat). A by-election overlay row files no change
   of its own — its base holder tells the same story */
function seatTag(d) {
  const ch = d.change, kind = ch && ch.kind;
  const byHold = d.by && d.by.prev && d.by.prev.hold, byGain = byHold && byHold.fam !== d.win.fam;
  return kind === "re" || kind === "held" ? "retain" : kind === "gain" || byGain ? "gain" : byHold ? "retain" : "win";
}
function seatFinalStat(m, d) {
  const p = seatStatOf(m, d, prevFor(m, d));
  const [wn, rn] = pairNames(d.win, d.run);
  const tag = `<span class="st-fg st-fg-l"><b>${seatTag(d)}</b></span>`;
  const two = twoPartyFigures(`Final count (margin of ${tightFmt(Math.abs(p.tpp[0] - 50))} · ${statusOf(p.tpp[0])})`, p.tpp[0], p.winFam, ds(wn), p.tpp[1], p.runFam, ds(rn), tag, true, [pnmOf(d.win), pnmOf(d.run)]);
  const sw = swingFigure(p.swing);
  return `<div class="st-sec"><div class="st-stat st-secstat">${two}${sw}</div></div>`;
}
/* the seat's Primaries head: one column per family at ten per cent or more
   (an independent heavyweight included — unlike the head, where independents
   ride Others): a seat can be won from outside the majors */
function seatPrimariesStat(m, d) {
  const p = seatStatOf(m, d, prevFor(m, d));
  const order = { alp: 0, lnp: 1, grn: 2, onp: 3, ind: 4 }; let oth = 0; const cols = [];
  for (const [k, v] of Object.entries(p.fp)) {
    if (v == null || v < 10) { oth += v || 0; continue; }
    cols.push([k, v, p.fpSw[k], k === "alp" ? "Labor" : k === "lnp" ? coalW(1).replace(/^The /, "") : legW(k), k]);
  }
  // the head's family order holds while both majors front the row; where the
  // pair is broken (Labor squeezed out entirely), the columns fall back to
  // reading by share so a 40 per cent party never trails a 22 per cent one
  const alpShown = cols.some((c) => c[4] === "alp");
  cols.sort((a, b) => (alpShown ? (order[a[4]] ?? 5) - (order[b[4]] ?? 5) || b[1] - a[1] : b[1] - a[1]));
  const bigness = cols.some((c) => c[2] == null) ? null : cols.reduce((x, c) => x + c[2], 0);
  cols.push(["oth", Math.max(0.05, 100 - cols.reduce((x, c) => x + c[1], 0)), bigness == null ? null : -bigness, "Others", "oth"]);
  const cells = cols.map((c, i) => `${i ? `<i aria-hidden="true">–</i>` : ""}<b ${tone(c[0])} title="${esc(c[3])}">${f1(c[1])}</b>`).join("");
  // the eyebrow reads "Primaries" plain (user call 2026-11-08): who is in and
  // share of what is told by the columns themselves, not a parenthetical
  const grid = `<span class="st-grid st-fps st-n${cols.length} st-seatfps" style="grid-template-columns:repeat(${2 * cols.length - 1},auto)" role="group" aria-label="${esc(cols.map((c) => `${c[3]} ${f1(c[1])}%`).join(", "))}">${cells}${bigness != null ? cols.map((c, i) => `<small style="grid-column:${2 * i + 1}" title="Change since ${p.py}${d.by ? " (the by-election is judged against the general election's count)" : ""}">${c[2] == null ? " " : sgn(c[2])}</small>`).join("") : ""}</span>`;
  return `<div class="st-sec"><div class="st-stat st-secstat"><span class="st-lab">Primaries</span>${grid}</div></div>`;
}

function candRows(cands, formal, cmp, limit, swingOf, partyOf) {
  const sorted = [...cands].sort((a, b) => b.v - a.v);
  const top = Math.max(30, (100 * sorted[0].v) / formal);
  const pOf = partyOf || ((c) => partyName(c.ab, c.pn));
  const rows = sorted.map((c, k) => {
    const p = (100 * c.v) / formal, tick = cmp ? cmp(c) : null, sw0 = swingOf ? swingOf(c) : c.sw;
    return `<div class="row"${limit && k >= limit ? " data-extra hidden" : ""}><div class="nm" title="${ds(c.n)}, ${esc(pOf(c))}">${ds(c.n)}${c.el ? `<span class="el">elected</span>` : ""}<small>${esc(pOf(c))}</small></div><div class="bar"><i style="width:${(100 * p) / top}%;${swc(c.fam)}"></i>${tick != null ? `<u style="left:${clamp((100 * tick) / top, 0, 100)}%" title="Across the seat: ${f1(tick)}%"></u>` : ""}</div><div class="v">${f1(p)}</div><div class="d">${sw0 == null ? "" : sgn(sw0)}</div></div>`;
  });
  const more = limit && sorted.length > limit ? `<button type="button" class="more" data-more>All ${sorted.length} candidates</button>` : "";
  return `<div class="rows">${rows.join("")}</div>${more}`;
}
function flowRows(flows, pairA, pairB) {
  const agg = {};
  for (const f of flows) { const b = f.cand.b; (agg[b] = agg[b] || { b, ta: 0, tb: 0, names: [] }); agg[b].ta += f.ta; agg[b].tb += f.tb; agg[b].names.push(f.cand.n); }
  const list = Object.values(agg).filter((x) => x.ta + x.tb > 0).sort((x, y) => y.ta + y.tb - (x.ta + x.tb));
  if (!list.length) return "";
  const [la, lb] = pairNames(pairA, pairB);
  return list.map((x) => { const t = x.ta + x.tb, pa = (100 * x.ta) / t; return `<div class="flow"><div class="fh"><div>${legW(x.b)}</div><span>${int(t)} votes</span></div><div class="fb"><i style="width:calc(${pa}% - 1px);${swc(pairA.fam)}"></i><i style="flex:1;${swc(pairB.fam)}"></i></div><div class="fl"><span><b class="${tx(pairA.fam)}">${f0(pa)}%</b> to ${ds(la)}</span><span>${ds(lb)} <b class="${tx(pairB.fam)}">${f0(100 - pa)}%</b></span></div></div>`; }).join("");
}
function decileRows(get, labelFor) {
  return `<div class="dec">${IX.map((ix) => { const v = get(ix); const cells = Array.from({ length: 10 }, (_, k) => `<i style="${v && k + 1 <= v ? `background:${css(RAMP.seifa[Math.round((k / 9) * 100)])}` : ""}"></i>`).join(""); return `<div class="nm">${IX_NAME[ix]}<small>${IX_ABBR[ix]}${v ? ` · decile ${v}` : " · no score"}${labelFor ? labelFor(ix, v) : ""}</small></div><div class="cells" role="img" aria-label="Decile ${v ?? "unknown"} of 10">${cells}</div>`; }).join("")}</div>`;
}
function linkRows(m, items, fmt, colOf) {
  // the state tag only earns its space when the rows span more than one
  const oneSt = new Set(items.map(({ i }) => m.divs[i].st)).size < 2;
  return `<div class="links">${items.map(({ i, v }) => { const d = m.divs[i]; return `<button type="button" data-go="div:${i}"><i style="background:${colOf ? colOf(i) : "var(--line)"}"></i><span class="nm">${ds(d.n)}${oneSt ? "" : `<small>${STATE_SHORT[d.st]}</small>`}</span><b>${fmt(v, d)}</b></button>`; }).join("")}</div>`;
}
const colCss = (c) => (c ? css(c) : "var(--line)");

function historyChart(d) {
  const yx = (y) => (y === 2026 ? YEAR_X.now - 0.3 : y);
  /* the domain is the name's own record: a seat whose ledger reaches back
     past 2004 (Kennedy's to 1993) draws all of it, and the heading names the
     earliest year — "Since 1993" — instead of the fixed 2004 origin */
  const h = d.h.filter((r) => r[1] != null || r[3]);
  if (!h.length) return "";
  const W = 340, H = 120, padL = 26, padR = 10, padT = 10, padB = 22;
  const years = h.map((r) => yx(r[0])), y0 = Math.min(...years), y1 = Math.max(2025, ...years);
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
    return `<g data-year="${yr}" style="cursor:pointer"><title>${ds(title)}</title><circle cx="${x(r[0])}" cy="${yy(yv)}" r="${on ? 5.5 : 4.2}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="2"${r[1] == null ? ' fill-opacity="0.9"' : ""}/>${on ? `<circle cx="${x(r[0])}" cy="${yy(yv)}" r="8.5" fill="none" stroke="var(--ink)" stroke-width="1.4"/>` : ""}</g>`;
  }).join("");
  const xl = [...new Set([y0, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025].filter((y) => y >= y0 && y <= y1))].sort((a, b) => a - b).map((y) => `<text x="${x(y)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="${y === cur ? "var(--ink)" : "var(--ink-3)"}" font-weight="${y === cur ? 600 : 400}">’${String(y).slice(2)}</text>`).join("") + (h.some((r) => r[0] === 2026) ? `<text x="${x(2026)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">by</text>` : "");
  const runs = [];
  for (const r of h) { const last = runs[runs.length - 1]; if (last && last.n === r[3] && last.ab === r[2]) last.to = r[0]; else runs.push({ n: r[3], ab: r[2], from: r[0], to: r[0], by: r[4] }); }
  const now = S.year === "now" ? M() : null, hold = now ? now.divs[d.i].hold : null;
  if (hold && runs.length && (runs[runs.length - 1].n !== hold.n || runs[runs.length - 1].ab !== hold.ab)) runs.push({ n: hold.n, ab: hold.ab, from: "now", to: "now", switched: true });
  const holders = runs.reverse().map((r) => `<div><i style="${swc(FAM(r.ab))}"></i><span>${ds(r.n)}<small>${esc(leaderName({ ab: r.ab, pn: "" }))}</small></span><span>${r.switched ? "now" : r.by ? `${r.from} by-election` : r.from === r.to ? r.from : `${r.from}–${String(r.to).slice(2)}`}</span></div>`).join("");
  return `<div class="st-sec hist"><h3>Since ${y0} <small>Labor’s two-party vote, and who won</small></h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Labor’s two-party share in ${ds(d.n)} at each election since ${y0}">${grid}<polyline points="${ptsLine}" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linejoin="round"/>${dots}${xl}</svg><div class="holders">${holders}</div><p class="st-note">Boundaries are redrawn between some elections, so the area behind a name can change.</p></div>`;
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
/* the seats a frame's change is counted against: an "as it stands" frame's own election (what has
   changed in the chamber since), otherwise the previous election on its row. The first stop of a
   row has none. Federal counts by state come from summary.json; a state election's from the facts
   stamped into the script, which only count the whole state */
function seatBase(m, st) {
  const y = m.year;
  const row = [YEARS_FED, YEARS_VIC, YEARS_NSW, YEARS_SA, YEARS_QLD, YEARS_WA].find((r) => r.includes(y));
  const stops = row.filter((v) => !isNowY(v)), pv = isNowY(y) ? NOW_OF[y] : stops[stops.indexOf(y) - 1];
  if (pv == null) return null;
  if (!STATE_YEARS.has(pv)) return { y: pv, c: SUM && SUM.seats[pv] ? SUM.seats[pv][st] || {} : null };
  return st === "AUS" || st === stOfYear(y) ? { y: pv, c: META_FACTS.mix[pv] } : null;
}
/* a now frame's scoped change base: the overlay's own change chains reverted off
   the scope's current tallies — the seat set is the base election's in every
   scope, only holders move. An election frame's seat-type scope has no official
   series to read, so it derives the same way per seat: each one reverted to its
   own prior holder ("of these seats" — new ones read as gains, gone ones never
   sat inside this class to lose; 2026-11-07, user call on Inner metro). */
function scopeSeatBase(m, sel, idx, cnt) {
  const famOf = (ab) => (ab === "CSA" ? "csa" : FAM(ab)); // holdFam's code side
  if (!isNowY(m.year)) {
    // an election frame's seat-type base: revert each seat in the scope to its
    // own previous holder
    const c = { ...cnt };
    for (const i of idx) {
      const p = m.divs[i].change && m.divs[i].change.prev;
      if (!p) continue;
      const from = famOf(p[2]), to = holdFam(m.divs[i].hold);
      if (from === to) continue;
      c[from] = (c[from] || 0) + 1; c[to] = (c[to] || 0) - 1;
    }
    return { y: prevYearOf(m.year) ?? (m.res && m.res.prev), c };
  }
  const inScope = new Set(idx.map((i) => m.divs[i].n)), chains = new Map();
  for (const ch of m.changes || []) {
    if (!inScope.has(ch.div)) continue;
    if (!chains.has(ch.div)) chains.set(ch.div, []);
    chains.get(ch.div).push(ch);
  }
  const c = { ...cnt };
  for (const chain of chains.values()) {
    const from = chain[0].from && famOf(chain[0].from), to = chain[chain.length - 1].to && famOf(chain[chain.length - 1].to);
    if (!from || !to || from === to) continue;
    c[from] = (c[from] || 0) + 1; c[to] = (c[to] || 0) - 1;
  }
  return { y: NOW_OF[m.year], c };
}
// the parties inside the "oth" family that have passed 10% somewhere, in their own colours
const FP_TONE = { "Nick Xenophon Team": "nxt", Democrats: "dem" };
/* the figures' filters are the page's own two, the strip's State and Seat
   type rows (S.f.st, S.f.cls): one pair read alike by the map, the chambers,
   the list and every lens's head here. Either rides alone, and with both on
   the pools intersect (Rural seats in New South Wales). A state filter is the
   map's state selection too (select() writes it), so it frames the map; the
   seat type dims the seats outside it wherever they're drawn. The Others
   expander's open state rides across frames with them. */
const statFold = { open: false };
const statScopeOk = (m, s) => s.k === "st" ? !STATE_YEARS.has(m.year) && !!(m.areas[s.st] && m.areas[s.st].formal > 0)
  : s.k === "cls" ? !STATE_YEARS.has(m.year) && m.divs.some((d) => d.cls === s.cls) : true;
const poolParts = (m) => {
  const fed = !!m && !STATE_YEARS.has(m.year);
  const st = fed && S.f.st && m.areas[S.f.st] && m.areas[S.f.st].formal > 0 ? S.f.st : null;
  const cls = fed && S.f.cls && m.divs.some((d) => d.cls === S.f.cls) ? S.f.cls : null;
  return { st, cls };
};
const sliceState = (m) => poolParts(m).st;
// the seat-type filter, for the views that mark it outside the head's figures
const clsFilter = (m) => poolParts(m).cls;
const statScopeOf = (m) => {
  const { st, cls } = poolParts(m);
  return cls ? { k: "cls", cls, st, open: statFold.open } : st ? { k: "st", st, open: statFold.open } : { k: "aus", open: statFold.open };
};
/* the filtered pool behind a head: a state's own stored aggregate, or a seat
   type's seats pooled (inside the state where one is picked too) */
function scopeArea(m, st) {
  const cls = clsFilter(m);
  if (!cls) return areaStats(m, st);
  const idx = m.areas[st].idx.filter((i) => m.divs[i].cls === cls);
  const cnt = {};
  for (const i of idx) cnt[holdFam(m.divs[i].hold)] = (cnt[holdFam(m.divs[i].hold)] || 0) + 1;
  const A = statClassArea(m, idx);
  A.demo = demoOf(m, idx);
  return { A, idx, N: idx.length, cnt };
}
// the filter in words, for the heads' "in …" clauses: "in New South Wales",
// "in rural seats", "in New South Wales’s rural seats"
function scopeWhere(m, st) {
  const cls = clsFilter(m), aus = st === "AUS";
  if (!cls) return aus ? "" : ` in ${STATE_NAME[st]}`;
  return aus ? ` in ${CLS_LOWER[cls]} seats` : ` in ${STATE_POSS[st]} ${CLS_LOWER[cls]} seats`;
}
// every word in the scope menu stays plain — no "figures" suffix, no hyphens
// the grid rows' own labels ride whatever state the picker picks
function statScopeLabel(m, sel) {
  if (sel.k === "cls") return CLS_SHORT[sel.cls];
  if (sel.k === "st") { const s = sel.st; return s === "NSW" || s === "ACT" ? s : STATE_TITLE[s]; }
  if (STATE_YEARS.has(m.year)) return STATE_TITLE[stOfYear(m.year)];
  return "National";
}
// Use the headline's party threshold in both breakdown modes. Lists share a
// column set, so a party does not change columns between adjacent states.
function statPrimaryCols(m, A, keys = null) {
  const wanted = (key, share) => keys ? keys.includes(key) : share >= 10;
  const fpBloc = ["grn", "onp"].filter((f) => wanted(f, A.fp[f])).map((f) => [f, A.fp[f], A.fpSw[f], legW(f), f]);
  const vote = new Map(); let formal = 0;
  for (const i of A.idx) {
    const d = m.divs[i].by ? m.divs[i].by.prev : m.divs[i];
    formal += d.formal;
    for (const c of d.c) if (c.fam === "oth") { const k = partyShort(c.ab, c.pn); vote.set(k, (vote.get(k) || 0) + c.v); }
  }
  for (const k of keys || []) if (k.startsWith("party:") && !vote.has(k.slice(6))) vote.set(k.slice(6), 0);
  for (const [k, v] of vote) if (formal && wanted("party:" + k, (100 * v) / formal)) fpBloc.push([FP_TONE[k] || "oth", (100 * v) / formal, null, k, "party:" + k]);
  fpBloc.sort((p, q) => keys ? keys.indexOf(p[4]) - keys.indexOf(q[4]) : q[1] - p[1]);
  const dA = A.fpSw.alp, dL = A.fpSw.lnp, changes = [dA, dL, ...fpBloc.map((r) => r[2])];
  return [["alp", A.fp.alp, dA, "Labor", "alp"], ["lnp", A.fp.lnp, dL, oppNameW(), "lnp"], ...fpBloc,
    // the "Others" share derives by subtraction, so stamp a hairline floor:
    // a negative rounding sliver reads as 0.0 and flicks the change smalls
    ["oth", Math.max(0.05, 100 - A.fp.alp - A.fp.lnp - fpBloc.reduce((x, r) => x + r[1], 0)), changes.some((v) => v == null) ? null : -changes.reduce((x, v) => x + v, 0), "Others", "oth"]];
}
/* the head's "Others" figure, opened out: the families not standing as their
   own column there (independents never do), then one lump for whatever stays
   inside "oth" — the minor parties the vote shares never break out on their
   own. Same row shape as statPrimaryCols: [tone, share, change, label, key]. */
function statOthersRows(A, cols) {
  const shown = new Set(cols.map((c) => c[4])), named = [];
  for (const f of ["grn", "onp", "ind"])
    if (!shown.has(f) && A.fp[f] != null && A.fp[f] >= 0.05) named.push([f, A.fp[f], A.fpSw[f] != null ? A.fpSw[f] : null, famLeg(f), f]);
  named.sort((p, q) => q[1] - p[1]);
  const breakouts = cols.filter((c) => c[4].startsWith("party:")).reduce((x, c) => x + c[1], 0);
  const lump = (A.fp.oth || 0) - breakouts;
  if (lump >= 0.05) named.push(["oth", lump, breakouts ? null : A.fpSw.oth != null ? A.fpSw.oth : null, "All other parties", "oth"]);
  return named;
}
/* the primary row, the head's "Others" cell optionally an opener: clicked, the
   remainder column drops out (the rest recentre) and its contents list in a
   smaller line under the row; clicked again they fold back into the figure */
function statPrimaryGrid(m, A, cls = "", othx = false) {
  // the change smalls ride every frame's primaries — an as-it-stands frame's
  // are the base election's (user call: the now views carry swings too)
  const all = statPrimaryCols(m, A), showChange = A.fpSw.alp != null;
  const rows = othx ? statOthersRows(A, all) : [];
  const open = othx && !!statScopeOf(m).open && rows.length > 0;
  const cols = open ? all.slice(0, -1) : all;
  const cell = (c, i) => `${i ? `<i aria-hidden="true">–</i>` : ""}${othx && !open && rows.length && c[4] === "oth"
    ? `<button type="button" class="st-othb" data-othx aria-expanded="false" ${tone(c[0])} title="${esc(c[3])}. Show which parties make up this figure" aria-label="${esc(`${c[3]} ${f1(c[1])}%. Show which parties make up this figure`)}"><b>${f1(c[1])}</b></button>`
    : `<b ${tone(c[0])} title="${esc(c[3])}">${f1(c[1])}</b>`}`;
  const grid = `<span class="st-grid st-fps st-n${all.length} ${cls}" style="grid-template-columns:repeat(${2 * cols.length - 1},auto)" role="group" aria-label="${esc(cols.map((c) => `${c[3]} ${f1(c[1])}%`).join(", "))}">${cols.map(cell).join("")}${showChange ? cols.map((c, i) => `<small style="grid-column:${2 * i + 1}" title="Change since the previous election">${c[2] == null ? " " : sgn(c[2])}</small>`).join("") : ""}</span>`;
  if (!open) return grid;
  const bits = rows.map((r) => `<span class="st-othx-r"><i aria-hidden="true" style="background:${css(TH.party[r[0]])}"></i>${esc(r[3])} <b>${f1(r[1])}</b>${showChange && r[2] != null ? `<small>${sgn(r[2])}</small>` : ""}</span>`).join("");
  return `${grid}<button type="button" class="st-othx" data-othx aria-expanded="true" title="Fold the smaller parties back into Others" aria-label="Inside Others: ${esc(rows.map((r) => `${r[3]} ${f1(r[1])}%`).join(", "))}. Fold back into Others">${bits}</button>`;
}
/* the "Others" open is part of the frame's figure view, like the scope choice */
function statOthersToggle() {
  const m = M(); if (!m) return;
  statFold.open = !statFold.open;
  renderStory(true);
  const b = $("#story [data-othx]"); if (b) b.focus({ preventScroll: true });
}
// Pool actual election counts, not averages of seat percentages. On a Now
// frame res.divs remains the base election; by-elections only replace m.divs.
function statClassArea(m, idx) {
  let formal = 0, alp = 0, lnp = 0, nTpp = 0, inf = 0;
  const votes = Object.fromEntries(FAMS.map((f) => [f, 0]));
  // changes pool vote-weighted over each family's own complete subset: a seat counts
  // toward a family's swing pool only where every one of that family's candidates
  // in it carries a swing figure (the majors: effectively every election seat)
  const swNum = {}, swDen = {};
  for (const f of FAMS) { swNum[f] = 0; swDen[f] = 0; }
  let tNum = 0, tDen = 0;
  for (const i of idx) {
    const d = m.res.divs[i];
    let dFormal = 0;
    for (const c of d.c) { votes[c[3]] += c[4]; formal += c[4]; dFormal += c[4]; }
    if (d.inf != null) inf += d.inf;
    if (d.tpp && d.tpp[0] + d.tpp[1] > 0) { alp += d.tpp[0]; lnp += d.tpp[1]; nTpp++; }
    if (dFormal && d.tpp && d.tpp[2] != null) { tNum += dFormal * d.tpp[2]; tDen += dFormal; }
    for (const f of FAMS) {
      const cs = d.c.filter((c) => c[3] === f);
      if (cs.length && cs.every((c) => c[5] != null) && dFormal) { swNum[f] += dFormal * cs.reduce((x, c) => x + c[5], 0); swDen[f] += dFormal; }
    }
  }
  return { idx, formal, fp: Object.fromEntries(FAMS.map((f) => [f, formal ? 100 * votes[f] / formal : null])),
    fpSw: Object.fromEntries(FAMS.map((f) => [f, swDen[f] ? swNum[f] / swDen[f] : null])),
    tpp: alp + lnp ? 100 * alp / (alp + lnp) : null, tppSw: tDen ? tNum / tDen : null, nTpp,
    infPct: formal + inf ? (100 * inf) / (formal + inf) : null };
}
const statBreakdownCache = new WeakMap(), statBreakdownViews = new Map();
function statBreakdownRows(m, st) {
  if (!statBreakdownCache.has(m)) statBreakdownCache.set(m, new Map());
  const cache = statBreakdownCache.get(m);
  if (cache.has(st)) return cache.get(st);
  const states = st === "AUS" && !STATE_YEARS.has(m.year) ? STATES.filter((s) => m.areas[s] && m.areas[s].formal > 0).map((s) => ({ key: s, label: STATE_TITLE[s], short: s === "NSW" || s === "ACT" ? s : STATE_TITLE[s], A: m.areas[s] })) : [];
  const classes = CLS.map((c) => {
    const idx = m.areas[st].idx.filter((i) => m.res.divs[i].cls === c);
    return idx.length ? { key: c, label: CLS_SHORT[c], short: CLS_SHORT[c], A: statClassArea(m, idx) } : null;
  }).filter((r) => r && r.A.formal > 0);
  const result = { states: states.length > 1 ? states : [], classes };
  cache.set(st, result);
  return result;
}
const statBreakdownKey = (m, st, kind) => `${m.year}|${st}|${kind}`;
function statBreakdownView(m, st, kind) {
  const key = statBreakdownKey(m, st, kind);
  if (!statBreakdownViews.has(key)) statBreakdownViews.set(key, { mode: "closed", index: -1 });
  return statBreakdownViews.get(key);
}
function statBreakdown(m, st, kind, rows) {
  if (!rows.length) return "";
  const title = kind === "states" ? "States & territories" : "Seat types", view = statBreakdownView(m, st, kind);
  const next = rows[(view.index + 1) % rows.length], id = `st-pv-${kind}`;
  const cycleIcon = `<svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><path d="M16.2 7A6.5 6.5 0 1 0 16 13M16.5 2.5V7h-4.5"/></svg>`;
  const listIcon = `<svg width="23" height="15" viewBox="0 0 29 20" aria-hidden="true"><path d="M2 5h12M2 10h12M2 15h12M20 8l3.5 3.5L27 8"/></svg>`;
  let body = "";
  if (view.mode === "list") {
    const keys = [...new Set(rows.flatMap((r) => statPrimaryCols(m, r.A).map((c) => c[4])))].filter((k) => k !== "alp" && k !== "lnp" && k !== "oth");
    const cols = statPrimaryCols(m, rows[0].A, keys);
    const names = cols.map((c) => c[4] === "alp" ? "ALP" : c[4] === "lnp" ? "L/NP" : c[4] === "grn" ? "GRN" : c[4] === "onp" ? "ON" : c[4] === "oth" ? "Other" : c[3]);
    body = `<div class="st-pv-list" style="--pv-cols:${cols.length}" role="group" aria-label="${esc(title)} primary vote percentages"><div class="st-pv-columns" aria-hidden="true"><span></span>${names.map((name) => `<span>${esc(name)}</span>`).join("")}</div>${rows.map((r, i) => {
      const cells = statPrimaryCols(m, r.A, keys);
      return `<button type="button" class="st-pv-row" data-pv-action="pick" data-pv-index="${i}" aria-label="${esc(r.label + ' primaries: ' + cells.map((c) => c[3] + ' ' + f1(c[1]) + '%').join(', ') + '. Show full result')}"><span>${esc(r.short)}</span>${cells.map((c) => `<b ${tone(c[0])} title="${esc(c[3])}">${f1(c[1])}</b>`).join("")}</button>`;
    }).join("")}</div>`;
  } else if (view.mode === "cycle") {
    const r = rows[view.index], A = r.A;
    const pair = Number.isFinite(A.tpp) ? `<span class="st-pv-tpp" role="group" aria-label="Labor ${f1(A.tpp)}%, ${esc(oppNameW())} ${f1(100 - A.tpp)}%"><b style="color:${css(TH.party.alp)}">${f1(A.tpp)}</b><i aria-hidden="true">–</i><b style="color:${css(TH.party.lnp)}">${f1(100 - A.tpp)}</b></span>` : `<span class="st-note">No two-party count available.</span>`;
    // the head's swing line, per area that carries one — as-it-stands frames
    // show theirs too (the base election's is the read there)
    const sw = swingFigure(A.tppSw);
    // metro types set as compound modifiers over the figures: "Inner-metro primaries"
    const nm = kind === "classes" ? r.short.replace(" ", "-") : r.short;
    body = `<div class="st-stat st-pv-full" aria-live="polite" aria-atomic="true"><span class="st-lab">${esc(nm)} primaries</span>${statPrimaryGrid(m, A)}<span class="st-lab st-pv-tpp-label">${esc(nm)} 2PP${Number.isFinite(A.tpp) ? ` (margin of ${f1(Math.abs(A.tpp - 50))})` : ""}</span>${pair}${sw}${A.nTpp != null && A.nTpp < A.idx.length ? `<span class="st-note">2PP covers ${A.nTpp} of ${A.idx.length} seats with a counted Labor–Coalition result.</span>` : ""}${isNowY(m.year) ? `<span class="st-note">${frameBaseY(m.year)} election results</span>` : ""}</div>`;
  }
  return `<section class="st-pv" data-pv-kind="${kind}" data-pv-area="${esc(st)}" aria-label="${esc(title)}"><div class="st-pv-head"><h4>${esc(title)}</h4><button type="button" class="st-pv-control" data-pv-action="cycle" title="Cycle through ${title.toLowerCase()}" aria-label="Show ${esc(next.label)} primaries and 2PP" aria-controls="${id}">${cycleIcon}</button><button type="button" class="st-pv-control" data-pv-action="list" title="${view.mode === 'list' ? 'Collapse list' : 'Show all results'}" aria-label="${view.mode === 'list' ? 'Collapse' : 'Show all'} ${title.toLowerCase()}" aria-expanded="${view.mode === 'list'}" aria-controls="${id}">${listIcon}</button></div><div id="${id}"${view.mode === "closed" ? " hidden" : ""}>${body}</div></section>`;
}
function statBreakdowns(m, st) {
  const groups = statBreakdownRows(m, st);
  const content = Object.entries(groups).map(([kind, rows]) => statBreakdown(m, st, kind, rows)).join("");
  return content ? `<div class="st-breakdowns">${content}</div>` : "";
}
function statBreakdownClick(button) {
  const el = button.closest(".st-pv"), m = M();
  if (!el || !m) return;
  const kind = el.dataset.pvKind, st = el.dataset.pvArea, rows = statBreakdownRows(m, st)[kind];
  if (!rows || !rows.length) return;
  const view = statBreakdownView(m, st, kind), action = button.dataset.pvAction;
  if (action === "list") view.mode = view.mode === "list" ? "closed" : "list";
  else {
    const index = action === "pick" ? Number(button.dataset.pvIndex) : (view.index + 1) % rows.length;
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
    view.index = index; view.mode = "cycle";
  }
  el.outerHTML = statBreakdown(m, st, kind, rows);
  const replacement = $(`#story .st-pv[data-pv-kind="${kind}"] [data-pv-action="${action === "pick" ? "cycle" : action}"]`);
  if (replacement) replacement.focus({ preventScroll: true });
  if (FS.on) fsStory(false);
}
// Keep every represented crossbench group, including single-seat parties.
function statSeatMakeup(m, idx, blocNames = []) {
  if (!idx.length) return "";
  const groups = new Map();
  for (const i of idx) {
    const h = m.divs[i].hold, f = holdFam(h);
    const name = f === "alp" || f === "lnp" ? famLeg(f) : crossLabel(h);
    if (!groups.has(name)) groups.set(name, { name, f, n: 0 });
    groups.get(name).n++;
  }
  const order = ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"];
  const rows = [...groups.values()].sort((a, b) => order.indexOf(a.f) - order.indexOf(b.f) || b.n - a.n || a.name.localeCompare(b.name));
  const colour = (r) => css(TH.party[FP_TONE[r.name] || r.f]);
  const bars = rows.map((r) => `<span style="width:${100 * r.n / idx.length}%;background:${colour(r)}" title="${esc(r.name)}: ${r.n} ${r.n === 1 ? "seat" : "seats"} (${f1(100 * r.n / idx.length)}%)"></span>`).join("");
  /* the key under the bar names the crossbench alone: Labor's and the
     Coalition's counts are the big figures above it, so the key is the third
     figure opened out ("Crossbench 15: Independents 8 …"), bracketed under
     its own stretch of the bar. A crossbench party big enough to stand among
     the big figures leaves the rest as "Others". */
  const xb = rows.filter((r) => r.f !== "alp" && r.f !== "lnp" && !blocNames.includes(r.name));
  const xbN = xb.reduce((a, r) => a + r.n, 0), xbWord = blocNames.length ? "Others" : "Crossbench";
  let at = 0, lo = null, hi = null, gap = false;
  for (const r of rows) {
    const inX = xb.includes(r);
    if (inX) { if (lo == null) lo = at; else if (hi !== at) gap = true; hi = at + r.n; }
    at += r.n;
  }
  const brace = xbN && !gap ? `<i class="st-xb-brace" aria-hidden="true" style="left:${100 * lo / idx.length}%;width:${100 * (hi - lo) / idx.length}%"></i>` : "";
  const legend = xbN ? `<span class="st-seat-legend" role="group" aria-label="${xbWord}: ${xbN} ${xbN === 1 ? "seat" : "seats"}"><span class="st-xb-lab">${xbWord} <b>${xbN}</b></span>${xb.map((r) => `<span class="st-seat-key" style="--seat-colour:${colour(r)}"><span>${esc(r.name)}</span><b>${r.n}</b></span>`).join("")}</span>` : "";
  const total = m.seatsN || m.divs.length, majority = Math.floor(total / 2) + 1;
  // A chamber majority is meaningful on the complete House, rather than a
  // state or seat-type subset picked by the filters.
  const marker = idx.length === total ? `<i class="st-seat-majority" style="left:${100 * majority / total}%" role="img" aria-label="${majority} seats for a majority" title="${majority} seats for a majority"></i>` : "";
  return `<span class="st-seat-mix${brace ? " st-has-brace" : ""}"><span class="st-seat-track"><span class="st-makeup" aria-hidden="true">${bars}</span>${marker}${brace}</span>${legend}</span>`;
}
// the Winner lens's head: the two-party result, its swing, then the seats with each side's change
function seatStat(m, st, label, noteDef = null) {
  // the filters narrow the pool (scopeArea): st is the area, a state where the
  // State filter is on, and a Seat type filter pools that type's seats in it
  const cls = clsFilter(m);
  const { A, idx, N, cnt } = scopeArea(m, st);
  // the moved-seats note shows only while every seat it names stays inside the
  // filtered pool (the One Nation pair keeps it under Rural and NSW figures)
  const seatsNote = noteDef && ((st === "AUS" && !cls) || noteDef.seats.every((n) => idx.some((i) => m.divs[i].n === n))) ? `<span class="st-seat-note">${noteDef.t.trim()}</span>` : "";
  // the change line's base: the whole frame's official series, a state's own
  // series on an election frame, else the pool's seat-by-seat reversion
  const a = cnt.alp || 0, l = cnt.lnp || 0, base = cls ? scopeSeatBase(m, { k: "cls", cls }, idx, cnt) : st === "AUS" || !isNowY(m.year) ? seatBase(m, st) : scopeSeatBase(m, { k: "st", st }, idx, cnt);
  // a crossbench party on 15 seats or more stands apart from "others"; independents are never a party.
  // (none has yet, at any level: the Greens and One Nation are the likely first)
  const parties = new Map();
  for (const i of idx) {
    const h = m.divs[i].hold, k = crossLabel(h);
    if (h.fam === "alp" || h.fam === "lnp" || k === "Independents") continue;
    parties.set(k, [holdFam(h), (parties.get(k) || [0, 0])[1] + 1]);
  }
  const blocE = [...parties.entries()].filter(([, r]) => r[1] > 14).sort(([, p], [, q]) => q[1] - p[1]);
  const bloc = blocE.map(([, r]) => r);
  const rest = N - a - l - bloc.reduce((x, r) => x + r[1], 0);
  const seats = [["alp", a], ["lnp", l], ...bloc, ...(bloc.length && !rest ? [] : [["oth", rest]])];
  // the base counts seats by family, and "oth" there is several parties, so it can't split one out
  const unsplit = bloc.some((r) => r[0] === "oth");
  // the govt tag rides the figures' names row, flush with the whole head's
  // OUTSIDE content edge on the governing family's side — "formed govt"
  // where an election delivered the government, "govt" on an as-it-stands
  // frame (which holds rather than won)
  const fg = A.tpp != null && (m.gov === "alp" || m.gov === "lnp") ? `<span class="st-fg st-fg-${m.gov}"><b>${isNowY(m.year) ? "govt" : "formed govt"}</b></span>` : "";
  let two = "";
  if (A.tpp != null) {
    // an "as it stands" frame's swing is the base election's — shown like any
    // election frame's (user call: the now views carry swings too)
    const twoSw = swingFigure(A.tppSw);
    // the pair's names close the figures grid, each anchored to its figure's inside edge;
    // the govt tag rides the names row with them (anchorGovtTag then hugs the head's content edge)
    two = twoPartyFigures(`Two-party preferred (margin of ${f1(Math.abs(A.tpp - 50))})`, A.tpp, "alp", "Labor", 100 - A.tpp, "lnp", coalW(1).replace(/^The /, ""), fg) + twoSw;
  }
  const change = (f, n) => {
    if (!base) return "";
    if (!base.c) return " "; // summary.json still on its way: the line keeps its place
    if (unsplit && f === "oth") return " ";
    const was = f === "oth" ? Object.values(base.c).reduce((x, v) => x + v, 0) - ["alp", "lnp", ...bloc.map((r) => r[0])].reduce((x, k) => x + (base.c[k] || 0), 0) : base.c[f] || 0;
    return sgn(n - was, 0);
  };
  // a row of figures with a line of changes under them, its size set by how many columns it has
  const row = (cls, cols, under) => `<span class="st-grid ${cls} st-n${cols.length}" style="grid-template-columns:repeat(${2 * cols.length - 1},auto)">${cols.map(([f, t], i) => `${i ? `<i>–</i>` : ""}<b ${tone(f)}>${t}</b>`).join("")}${under ? cols.map((c, i) => `<small style="grid-column:${2 * i + 1}">${under(c)}</small>`).join("") : ""}</span>`;
  // the primary vote: a party on 10% or more stands apart from "others". Greens and One Nation are
  // their own family; the rest share "oth", so a party there (Xenophon's in SA, 2016) is read from the candidates
  const fpA = A.fp.alp, fpL = A.fp.lnp;
  let fpRow = "";
  if (fpA != null && fpL != null) {
    fpRow = `<span class="st-lab">Primaries (Labor and ${coalW()} share ${f1(fpA + fpL)}%)</span>${statPrimaryGrid(m, A, "", true)}`;
  }
  // on the Seats label itself: the governing family's share of the chamber, in its wording —
  // "won" what an election delivered, "has" what an as-it-stands frame holds
  const gv = m.gov, gN = (cnt[gv] || 0), shareTxt = gN && N ? ` (${gv === "alp" ? "Labor" : coalW()} ${isNowY(m.year) ? "has" : "won"} ${f1((100 * gN) / N)}% of ${N})` : "";
  // the make-up bar under the seat row, the timeline rungs' read
  const mk = statSeatMakeup(m, idx, blocE.map(([k]) => k));
  // a double rule crowns the head, divides the sections and closes it — every
  // label (Two-party, Primaries, Seats) sits just under one
  const sep = `<span class="st-sep" aria-hidden="true"></span>`;
  // the seats lead (who holds the House is the map's first reading), then the
  // votes that won them: the two-party count, then the primaries
  const sections = [];
  // the word-note about seats that moved since the election sits under the count's legend
  sections.push(`<span class="st-lab">Seats${shareTxt}</span>${row("st-seats", seats, base ? ([f, n]) => change(f, n) : null)}${mk}${seatsNote}`);
  if (two) sections.push(two);
  if (fpRow) sections.push(fpRow);
  return `<h3 class="st-stat" aria-label="${esc(label)}">${sep}${sections.join(sep)}${sep}</h3>`;
}
/* the informal rate belongs with the count's own story: it hangs under the
   How-votes-were-cast section instead of closing the winner head (user call
   2026-11-07), keeping the head's filters — a state or seat type pools its
   own rate (scopeArea), exactly as the head's figures do */
function informalHTML(m, st) {
  const { A } = scopeArea(m, st);
  if (A.infPct == null) return "";
  /* a filtered view contrasts itself with the frame's average, the same
     comparison word the seat view's informal line carries (user call) */
  const cmp = (st !== "AUS" || clsFilter(m)) && !STATE_YEARS.has(m.year) && m.areas.AUS && m.areas.AUS.infPct != null ? ` (vs national average ${f1(m.areas.AUS.infPct)}%)` : "";
  return `<div class="st-inf"><b>Informal votes:</b> ${f1(A.infPct)}%${cmp}</div>`;
}
// the seats an "as it stands" frame holds that the election itself never
// delivered: the federal Now's One Nation pair; NSW Now's Kiama (to Labor)
// and Pittwater (from the Liberals to the crossbench). The seats list is
// what the note is about — a scoped figures view keeps it only while every
// named seat sits inside the choice (Rural and NSW keep the One Nation
// note; Inner-metro and Queensland don't)
const NOW_AUS_DEK = {
  now: { t: " The figures here are the 2025 election’s, adjusted for seat changes. One Nation has taken two seats from the Coalition: New England after Barnaby Joyce’s defection in December 2025, and Farrer after David Farley won it in the May 2026 by-election.", seats: ["New England", "Farrer"] },
  nswnow: { t: " Labor holds one seat it didn’t win at the election: Katelin McInerney won Kiama at the September 2025 by-election. Jacqui Scruby took Pittwater from the Liberals as an independent.", seats: ["Kiama", "Pittwater"] },
  qldnow: { t: " The LNP holds one seat it didn’t win at the election: Wayde Chiesa took Hinchinbrook from Katter’s Australian. Labor keeps Stafford — Jimmy Sullivan was expelled from it in May 2025 and died in April 2026; Luke Richmond won the seat back in May.", seats: ["Hinchinbrook", "Stafford"] },
};
function areaHedDek(m, st) {
  // every lens reads the filtered pool: the state, narrowed to a seat type where one is on
  const aus = st === "AUS", cls = clsFilter(m), { A, idx, N, cnt } = scopeArea(m, st);
  const where = scopeWhere(m, st);
  const ofSeats = cls ? `of the ${N}${where.replace(/^ in/, "")}` : aus ? `of the ${N} seats` : `of ${STATE_POSS[st]} ${N} seats`;
  const prev = isNowY(m.year) ? m.res.prev : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const lead = A.tpp >= 50 ? "alp" : "lnp", leadPct = Math.max(A.tpp, 100 - A.tpp);

  const isNowM = isNowY(m.year);
  if (S.lens === "tpp" && axisNow(m) !== "AC") return axisHedDek(m, idx, where);
  // the cls lens tells its story with the Winner design from end to end
  // (2026-11-08, user call — its own class-tally story is retired)
  switch (S.lens === "cls" ? "winner" : S.lens) {
    case "cls":
    case "winner": {
      const g = cnt[gov] || 0, o = cnt[opp] || 0, c = N - g - o;
      if (isNowM) {
        // the governing family, named the way the frame names it — Labor in
        // Canberra and Springwood, the Coalition in Canberra, the LNP in George St
        const govW = gov === "alp" ? "Labor" : coalW(1);
        const oppW = gov === "alp" ? coalW(1) : "Labor";
        const hed = aus ? `${govW} holds ${g} of the ${N} seats` : `${govW} holds ${g} ${ofSeats}`;
        let dek = `${oppW} ${o === 1 ? "holds" : "hold"} ${o}. ${crossSentence(m, idx, "holds")}`;
        // what the figures can't say stays in words: the seats that moved since the election.
        // On the federal Now frame that note sits under the Seats count it annotates
        // (in the head's Commissioner); on the other frames it keeps the dek's place
        let note = aus ? (NOW_AUS_DEK[m.year]?.t ?? "").trim() : "";
        if (!aus) { const inPool = new Set(idx), ch = (m.changes || []).filter((x) => inPool.has(m.byName.get(x.div))); if (ch.length) { const ns = [...new Set(ch.map((x) => x.div))].map((n) => ds(n)); note = `Since the election: ${ns.length > 2 ? `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}` : ns.join(" and ")} ${ns.length > 1 ? "have" : "has"} changed hands or party.`; } }
        if (aus) dek += NOW_AUS_DEK[m.year]?.t ?? "";
        else if (note) dek += ` ${note}`;
        const noteDef = aus && m.year === "now" && note ? NOW_AUS_DEK[m.year] : null;
        return { hed, dek: noteDef ? "" : note, stat: seatStat(m, st, `${hed}. ${dek}`, noteDef) };
      }
      const maj = Math.floor(N / 2) + 1;
      // a state frame's prev lives under its jurisdiction when the federal GOV
      // table's same-numbered key already belongs to another state (vic's 2018 v SA's)
      const pv = prevYearOf(m.year) ?? (m.res && m.res.prev), pvG = (pv && STATE_YEARS.has(m.year) && PREV_GOV_BY_JUR[YEAR_JUR[m.year]] && PREV_GOV_BY_JUR[YEAR_JUR[m.year]][pv]) ?? GOV[pv], changed = pv && pvG && pvG !== gov;
      let hed;
      if (aus) {
        if (g < maj) hed = `No party won a majority: ${o > g ? `${coalW()} won ${o} seats, Labor ${g}` : `Labor won ${g} seats, ${coalW()} ${o}`}`;
        else if (changed) hed = `${gov === "alp" ? "Labor" : coalW(1)} won government with ${g} of the ${N} seats`;
        else hed = `${gov === "alp" ? "Labor" : coalW(1)} was returned with ${g} of the ${N} seats`;
      } else {
        const best = (cnt.alp || 0) >= (cnt.lnp || 0) ? "alp" : "lnp", bn = cnt[best] || 0;
        hed = `${best === "alp" ? "Labor" : coalW(1)} won ${bn} ${ofSeats}`;
      }
      let dek = aus
        ? `${g < maj ? "" : `${opp === "alp" ? "Labor" : coalW(1)} won ${o}. `}${crossSentence(m, idx, "won")}${c ? " " : ""}${m.year === 2010 ? "Labor kept government with the support of the Greens’ member and three independents. " : ""}${PM[m.year]} ${changed ? "became" : "remained"} ${leaderT()}.`
        : `${(cnt.alp || 0) >= (cnt.lnp || 0) ? coalW(1) : "Labor"} won ${(cnt.alp || 0) >= (cnt.lnp || 0) ? cnt.lnp || 0 : cnt.alp || 0}. ${crossSentence(m, idx, "won")}${c ? " " : ""}Labor’s two-party vote${where} was ${f1(A.tpp)}%${swingPhrase(A.tppSw, prev) ? ", " + swingPhrase(A.tppSw, prev) : ""}.`;
      // (a hung parliament's government isn't in the figures, so that one stays in words)
      return { hed, dek: aus && m.year === 2010 ? "Labor kept government with the support of the Greens’ member and three independents." : "", stat: seatStat(m, st, `${hed}. ${dek}`) };
    }
    case "tpp": {
      // an as-it-stands frame mixes base and by-election counts; the figure
      // trail qualifies itself only inside the frame's own jurisdiction
      const NOW_TPP_NOTE = {
        now: ` These are the ${frameBaseY(m.year)} election’s figures; Labor didn’t stand at the Farrer by-election, so Farrer has none.`,
        nswnow: ` These are the ${frameBaseY(m.year)} election’s figures; Kiama’s two-party read is its by-election count, and the other by-election seats carry none (their final pairs weren’t Labor against the Coalition).`,
        qldnow: ` These are the ${frameBaseY(m.year)} election’s figures; Stafford’s two-party read is its by-election count, and Hinchinbrook’s by-election didn’t finish Labor against the LNP, so it carries none.`,
      };
      const nowScope = YEAR_JUR[m.year] ? (aus || st === stOfYear(m.year)) : (aus || st === "NSW");
      const hedWord = S.tppMode === "swing" ? (Math.abs(A.tppSw) < 0.05 ? `There was no two-party swing${where}` : `The two-party vote${where} swung ${pts(A.tppSw)} to ${A.tppSw >= 0 ? "Labor" : "the Coalition"}`) : `${lead === "alp" ? "Labor" : coalW(1)} won ${f1(leadPct)}% of the two-party vote${where}`;
      if (!Number.isFinite(A.tpp)) return { hed: hedWord, dek: "" };
      /* the two-party lens reads the head's one figures block, like every
         lens (its two-party row says what a headline would: user call
         2026-11-09, the head's figures in place of hed and dek) — so no
         finding line; an as-it-stands frame's basis note follows them */
      return { hed: hedWord, dek: "", quiet: true, note: isNowM && nowScope && NOW_TPP_NOTE[m.year] ? NOW_TPP_NOTE[m.year].trim() : "" };
    }
    case "fp": {
      const P = S.party, name = legW(P);
      const stood = idx.filter((i) => m.divs[i].fp[P] > 0);
      if (S.fpMode === "change") {
        const d0 = A.fpSw[P];
        const hed = Math.abs(d0) < 0.05 ? `${Poss(P)} primary vote${where} was unchanged on ${prev}` : `${Poss(P)} primary vote${where} ${d0 >= 0 ? "rose" : "fell"} ${pts(d0)} on ${prev}`;
        const ch = idx.map((i) => ({ i, v: fpChange(m, m.divs[i], P) })).filter((x) => x.v != null);
        const up = ch.filter((x) => x.v > 0).length;
        const best = [...ch].sort((a, b) => b.v - a.v)[0];
        return { hed, dek: ch.length ? `It rose in ${ofN(up, ch.length)} seats with a comparable count${best ? `, most in ${ds(m.divs[best.i].n)} (${sgn(best.v)}${byNote(m.divs[best.i])})` : ""}.` : "" };
      }
      const hed = `${SUBJ[P]} won ${f1(A.fp[P])}% of first preferences${where}`;
      const ranked = stood.map((i) => ({ i, v: m.divs[i].fp[P] })).sort((a, b) => b.v - a.v);
      // a year with no previous count (sa26) doesn't pretend to a change figure
      const dek = `${A.fpSw[P] != null ? `${cap(upDown(A.fpSw[P]))} on ${prev}. ` : ""}${P === "ind" ? "Independents" : P === "oth" ? "Other candidates" : name} stood in ${stood.length === N ? `all ${N}` : `${stood.length} of the ${N}`} seats${ranked.length ? `; the best result was ${ds(m.divs[ranked[0].i].n)}’s ${f1(ranked[0].v)}%${byNote(m.divs[ranked[0].i])}` : ""}.`;
      return { hed, dek };
    }
    case "senate": {
      const P = S.party, r = senArea(m, idx, P), pr = senPron(P);
      if (svYear(m.year) == null) return { hed: `A state election has no Senate`, dek: `The Senate lens reads federal elections; choose one on the timeline.` };
      if (!r) return { hed: `The Senate’s votes are loading`, dek: "" };
      const per = idx.map((i) => ({ i, v: senDivValue(m, m.divs[i]) })).filter((x) => x.v != null).sort((p, q) => q.v - p.v);
      const stoodTxt = r.stood < r.n ? `; ${pr.it} stood for the House in ${r.stood} of the ${r.n} seats` : "";
      if (senGap()) {
        const higher = per.filter((x) => x.v > 0).length;
        return { hed: `${SUBJ[P]} ${senGapWords(r.gap)}${where}`,
          dek: `${f1(r.sen)}% of Senate first preferences against ${f1(r.house)}% in the House${stoodTxt}.${per.length ? ` Seat by seat, ${pr.it} polled higher in the Senate in ${higher === per.length ? `every one of the ${per.length}` : ofN(higher, per.length)}; the gap was widest in ${ds(m.divs[per[0].i].n)} (${sgn(per[0].v)}).` : ""}` };
      }
      return { hed: `${SUBJ[P]} won ${f1(r.sen)}% of the Senate vote${where}`, dek: `Against ${f1(r.house)}% in the House${stoodTxt}.${per.length ? ` ${pr.Its} best Senate seat was ${ds(m.divs[per[0].i].n)}, at ${f1(per[0].v)}%.` : ""}` };
    }
    case "senpref": {
      if (spYear(m.year) == null) return { hed: `A state election has no Senate`, dek: `The Senate-ballot reading of preferences covers federal elections and New South Wales' state elections; choose one on the timeline.` };
      if (spYear(m.year) == null) return { hed: `No Senate preference record for ${m.year}`, dek: `The AEC's machine record opens with the 2004 group voting tickets; every ballot's own order is published from 2016. Choose 2004 or later.` };
      const gvt = spGvtYear(m.year) != null;
      const r = spArea(m, idx);
      if (!spOf(m)) return { hed: `The Senate’s record is loading`, dek: "" };
      if (!r) { const ab = idx.length ? spAbsent(m, m.divs[idx[0]].st) : null; return { hed: ab ? `${spName(ab, true)} had no Senate ticket in ${STATE_NAME[m.divs[idx[0]].st]}` : `Too few of these ballots to read here`, dek: ab ? `So no ballot there could rank it against ${ab === SP_PAIRS[S.spPair][0] ? spB() : spA()}. Choose another contest in the key.` : "" }; }
      const per = idx.map((i) => ({ i, v: spDivValue(m, m.divs[i]) })).filter((x) => x.v != null).sort((p, q) => q.v - p.v);
      const hi = per[0], lo = per[per.length - 1];
      if (gvt) return { hed: `${f0(r.share)}% of ${spWho()} Senate tickets put ${spA()} ahead of ${spB()}${where}`,
        dek: `In ${m.year} a party-box vote copied the party's lodged group voting ticket, so these shares read the parties' own orders over ${int(r.n)} ticket-bound ballots — how voters numbered their own papers is published only from 2016.${per.length > 1 ? ` Seat by seat it ran from ${f0(lo.v)}% in ${ds(m.divs[lo.i].n)} to ${f0(hi.v)}% in ${ds(m.divs[hi.i].n)}.` : ""}` };
      return { hed: `${f0(r.share)}% of ${spWho()} Senate voters ranked ${spA()} ahead of ${spB()}${where}`,
        dek: `${int(r.n)} of these ballots numbered either party; another ${f0(r.nei)}% numbered neither.${per.length > 1 ? ` Seat by seat it ran from ${f0(lo.v)}% in ${ds(m.divs[lo.i].n)} to ${f0(hi.v)}% in ${ds(m.divs[hi.i].n)}.` : ""} Senate ballots show how voters rank parties everywhere, including contests the House never counted.` };
    }
    case "flow": {
      const F = S.from, name = possW(F), rival = vsW();
      let toA = 0, tot = 0, xN = 0, xT = 0;
      const per = [];
      for (const i of idx) { const d = m.divs[i]; if (!flowSeat(d)) continue; let a = 0, t = 0; for (const f of d.flows) if (f.cand.b === F) { a += d.alpSide === 0 ? f.ta : f.tb; t += f.ta + f.tb; if (f.exh != null) { xN += f.exh; xT += f.ta + f.tb + f.exh; } } if (t) { toA += a; tot += t; per.push({ i, v: (100 * a) / t, t }); } }
      if (!tot) return { hed: `None of ${name} preferences were split between Labor and ${rival}${where}`, dek: "" };
      const share = (100 * toA) / tot;
      if (m.res.flBasis === "modelled") {
        const e = flowErrOf(m, F);
        return { hed: `${f0(share)}% of ${name} preferences modelled to go to Labor${S.vs === "onp" ? " over One Nation" : ""}${where}`, dek: `No South Australian count records how ${name} preferences flowed, so each district’s share is modelled from the elections whose splits are published${e ? `; ${flowErrWords(e)}` : ""}. Shown across the ${per.length} districts whose count finished Labor against ${rival}.` };
      }
      const hed = `${f0(share)}% of ${name} preferences went to Labor${S.vs === "onp" ? " over One Nation" : ""}${where}`;
      per.sort((a, b) => a.v - b.v);
      const lo = per[0], hi = per[per.length - 1];
      const opv = m.res.flOpv && xT ? ` Under New South Wales’s optional preferences another ${f0((100 * xN) / xT)}% of ${name} ballots exhausted before the final two.` : "";
      const dek = `Counted in the ${per.length === 1 ? "one seat" : `${per.length} seats`}${where} that finished Labor against ${rival}.${per.length === 1 ? "" : ` The share ran from ${f0(lo.v)}% in ${ds(m.divs[lo.i].n)} to ${f0(hi.v)}% in ${ds(m.divs[hi.i].n)}.`}${opv}`;
      return { hed, dek };
    }
    case "informal": {
      const exh = infModeOf(m) === "exhaust";
      const hed = exh ? `${f1(A.exhPct)}% of ballots${where} exhausted before the final two` : `${f1(A.infPct)}% of ballots${where} were informal`;
      const r = idx.map((i) => ({ i, v: exh ? m.divs[i].exhPct : m.divs[i].infPct })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      if (exh) {
        const dek = `Under New South Wales’s optional-preferential vote, a ballot leaves the count when its numbered candidates are gone. The highest rate was ${ds(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${ds(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
        return { hed, dek };
      }
      const pa = prev && Y[prev] && Y[prev].areas ? Y[prev].areas[st] : null;
      const dek = `${pa ? `${Math.abs(A.infPct - pa.infPct) < 0.05 ? "Unchanged" : A.infPct >= pa.infPct ? "Up" : "Down"} from ${f1(pa.infPct)}% in ${prev}. ` : ""}The highest rate was ${ds(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${ds(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
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
      const dek = `Of the ${q} ${adv[1]}, ${FAM_PL[first[0]]} ${v1} ${first[1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Seats are ranked on the ABS’s ${IX_NAME[ix].toLowerCase()} index (${IX_ABBR[ix]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : m.year < 2004 ? "from the 2001 census" : "interpolated between censuses to election day"}.`;
      return { hed, dek };
    }
  }
  return { hed: "", dek: "" };
}

// the census people measures, area level: who holds the fifth of seats at each end
const DM_TOP = { lang: ["seats with the most residents speaking another language at home", "most English-speaking"], a65: ["seats with the most residents aged 65 and over", "with the fewest"], a2034: ["seats with the most residents aged 20 to 34", "with the fewest"], fborn: ["seats with the most residents born overseas", "the most Australia-born"], uni: ["seats where the most people aged 15+ hold a university qualification", "with the fewest"], blue: ["seats with the most blue-collar workers", "with the fewest"], y12less: ["seats where the most residents aged 15+ left school before Year 12", "with the fewest"], atsci: ["seats with the most Indigenous Australians", "with the fewest"], u15: ["seats with the most children under 15", "with the fewest"], onepar: ["seats with the most one-parent families", "with the fewest"],
  pt: ["seats where the most employed people travel to work by public transport", "with the fewest"], noncit: ["seats where the most residents were not counted as Australian citizens", "with the fewest"], bigfam: ["seats where the most women have had more than two children", "with the fewest"], hl: ["seats with the most homeless residents", "with the fewest"] };
// Ancestry option phrases, generated per option of the select menu
const ANC_TOP = Object.fromEntries((typeof ANC_NAME !== "undefined" ? Object.entries(ANC_NAME) : []).map(([k, n]) => [k, [`seats where the most residents named ${n} ancestry`, "with the fewest"]]));
const REL_TOP = { norel: ["seats where the most residents say they have no religion", "with the fewest"], cath: ["seats with the most Catholic residents", "with the most of another faith"], angl: ["seats with the most Anglican residents", "with the fewest"], unch: ["seats with the most Uniting Church residents", "with the fewest"], pres: ["seats with the most Presbyterian residents", "with the fewest"], orth: ["seats with the most Orthodox residents", "with the fewest"], budd: ["seats with the most Buddhist residents", "with the fewest"], isl: ["seats with the most Muslim residents", "with the fewest"], hind: ["seats with the most Hindu residents", "with the fewest"], jew: ["seats with the most Jewish residents", "with the fewest"] };
const TEN_TOP = { mort: ["seats with the most homes owned with a mortgage", "with the fewest"], rent: ["seats with the most rented homes", "with the fewest"], own: ["seats with the most homes owned outright", "with the fewest"], rentPub: ["seats with the most public housing", "with the fewest"] };
// the pair-of-phrases for a birthplace country, against the Australia-born share
const COB_TOP = { uk: ["seats where the most residents were born in the United Kingdom", "the most Australia-born"], eng: ["seats where the most residents were born in England", "the most Australia-born"], ind: ["seats where the most residents were born in India", "the most Australia-born"], chn: ["seats where the most residents were born in China", "the most Australia-born"], nzl: ["seats where the most residents were born in New Zealand", "the most Australia-born"], phl: ["seats where the most residents were born in the Philippines", "the most Australia-born"], vnm: ["seats where the most residents were born in Vietnam", "the most Australia-born"], zaf: ["seats where the most residents were born in South Africa", "the most Australia-born"], ita: ["seats where the most residents were born in Italy", "the most Australia-born"], lka: ["seats where the most residents were born in Sri Lanka", "the most Australia-born"], sct: ["seats where the most residents were born in Scotland", "the most Australia-born"] };
// the measures' census basis as copy: 2001 reads its own census area
// figures measured-only (the frame's floor year, its census ~3 months
// before election day); 2004-2019 blend their bracketing censuses; the
// income lanes (2013 on) count adults
const DB = {
  venue: {
    seats: (y) => `From the ${y < 2007 ? 2001 : y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in: the AEC’s record of where voters live begins in 2016.`,
    who: "of residents of the census area it stands in",
    whoAdults: "of the adults of the census area it stands in",
    note: (y) => `From the ${y < 2007 ? 2001 : y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in.`,
  },
  voter: {
    seats: "From the 2021 census, counted where each seat’s voters live.",
    who: "of residents where this place’s voters live",
    whoAdults: "of the adults where this place’s voters live",
    note: "From the 2021 census, counted where its voters live.",
  },
  // a state election has no AEC vote record to pool on; the figures are the
  // SA1 census areas that make up each district
  sa1: {
    seats: "From the 2021 census, of the SA1 census areas that make up each district.",
    who: "of residents of the district’s SA1 census areas",
    whoAdults: "of the adults of the district’s SA1 census areas",
    note: "From the 2021 census, of the district’s SA1 census areas.",
  },
  // a state polling place reads the ONE SA1 census area its venue stands in
  sa1Booth: {
    who: "of residents of the SA1 census area it stands in",
    whoAdults: "of the adults of the SA1 census area it stands in",
    note: "From the 2021 census, of the SA1 census area the place stands in.",
  },
};
const demoCopy = (m) => {
  if (m.demoBasis === "sa1") return DB.sa1;
  const db = DB[m.demoBasis === "venue" ? "venue" : "voter"];
  // a birthplace-country sub-view never reads the blend epoch: cob rides
  // the measured census (the 2006/2011 editions carry no England or
  // Scotland to blend), so its notes name its own census
  if (isCob() || !m.demoInterp) return m.demoBasis === "venue" ? { seats: db.seats(m.year), who: db.who, whoAdults: db.whoAdults, note: db.note(m.year) } : db;
  const { c0, c1 } = m.demoInterp;
  return {
    seats: `Interpolated between the ${c0} and ${c1} censuses to election day${m.demoBasis === "venue" ? ", of the census areas the polling places stand in" : ", counted where each seat’s voters live"}.`,
    who: db.who,
    whoAdults: db.whoAdults,
    note: `Interpolated between the ${c0} and ${c1} censuses to election day.`,
  };
};
// polling-place cards read one area, not a district pool
const demoBoothCopy = (m) => (m.demoBasis === "sa1" ? DB.sa1Booth : demoCopy(m));
// one income sentence for a seat or place facts list: both band shares,
// then the household median, in the census year's own dollars; "" when
// the place carries no income lane at all. Booth rows arrive as
// {loinc, hiqinc, medIncWeekly} from the demo tuple's cells and the
// parallel medinc lane; seat rows arrive as the divId demo dict
function incFact(m, dm) {
  if (!dm) return "";
  const parts = [];
  if (dm.loinc != null || dm.hiqinc != null) {
    const pair = [];
    if (dm.loinc != null) pair.push(`${f0(100 * dm.loinc)}% of adults live in households earning ${incLoFrag(m)}`);
    if (dm.hiqinc != null) pair.push(`${f0(100 * dm.hiqinc)}% in households earning ${incHiQFrag(m)}`);
    parts.push(`${pair.join(", ")}${incEpoch(m)}`);
  }
  if (dm.medIncWeekly != null) parts.push(`the median weekly household income is ${mny(dm.medIncWeekly)}${incEpoch(m)}`);
  return parts.length ? `${parts.join("; ")}.` : "";
}
const DEMO_EARLY = { hed: "Census figures start at the 1993 election", dek: "Census-linked people figures exist only from the 1993 election on: 1993 and 1996 blend the 1991 and 1996 censuses to election day, 1998 blends the 1996 and 2001 censuses, the 2001 election reads the 2001 census itself, every election from 2004 to 2019 blends between the two censuses that bracket it to election day, and 2022 reads the 2021 census." };
function areaDemo(m, st, idx, where, isNowM) {
  // (a Seat type filter pools its own seats' census shares)
  const k = S.index, A = clsFilter(m) ? { demo: demoOf(m, idx) } : m.areas[st];
  if (!A.demo) return DEMO_EARLY;
  const med = incMed() ? m.incomeCuts && m.incomeCuts.medWeekly : null;
  const medAge = ageMed() ? m.ageCuts && m.ageCuts.medAge : null;
  // the median view's headline is the national line: medians never pool,
  // so a state area carries no figure of its own to print
  if (incMed() && med == null) return { hed: "Income figures start at the 2001 election", dek: "" };
  if (ageMed() && medAge == null) return { hed: "Median-age figures arrive with the census age bands", dek: "" };
  const scored = idx.filter((i) => demoShare(m.divs[i]) != null).sort((a, b) => demoShare(m.divs[b]) - demoShare(m.divs[a]));
  const share = incMed()
    ? `${st === "AUS" ? "the median weekly household income" : "the national median weekly household income"} is ${mny(med)}${incEpoch(m)}`
    : ageMed()
      ? `${st === "AUS" ? "the median age" : "the national median age"} is ${medAge}`
      : `${f1(demoAreaShare(A.demo))}% of ${censusWho(m, k).pop}${where} ${censusWho(m, k).pred}`;
  const note = demoCopy(m).seats;
  if (scored.length < 10) return { hed: cap(share), dek: note };
  const q = Math.round(scored.length / 5), high = scored.slice(0, q), low = scored.slice(-q);
  const fams = ["alp", "lnp", "ind", "grn", "onp", "oth"];
  const topOf = (xs) => fams.map((f) => [f, seatCount(m, xs, f)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const verbOf = (f) => (isNowM ? (f === "ind" || f === "grn" ? "hold" : "holds") : "won");
  const ht = topOf(high), lt = topOf(low);
  const top = isCob() ? COB_TOP[S.cob] : isRel() ? REL_TOP[S.rel] : isTen() ? TEN_TOP[S.ten] : isAnc() ? ANC_TOP[S.anc] : isInc() ? INC_TOP[S.incMode] : isAge() ? AGE_TOP[S.ageMode] : isEdu() ? DM_TOP[S.eduMode] : DM_TOP[k];
  const hed = `${cap(FAM_PL[ht[0][0]])} ${verbOf(ht[0][0])} ${ht[0][1]} of the ${q} ${top[0]}${where}`;
  const rest = lt.slice(1).map(([f, n]) => `${FAM_PL[f]} ${n}`);
  const dek = `Of the ${q} ${top[1]}, ${FAM_PL[lt[0][0]]} ${verbOf(lt[0][0])} ${lt[0][1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Overall, ${share}. ${note}`;
  return { hed, dek };
}

/* ----- how the votes were cast -----
   A seat's or an area's formal votes by how they were cast, and Labor's two-party share of
   each pile where the count gives it (vt2, build_vote_piles.py): every seat from 2016, before
   that the seats whose final two were Labor and the Coalition, and none in 1993.
   Mobile teams take votes in the days before the election, in remote communities above all,
   so they can't count as "on the day": from VT_MOB of the votes they have a row of their own
   (Lingiari, the NT). Below it they stay in the day's row, where they change nothing.
   The piles are counts, not samples, so any gap between two is real. The sentence's rules are
   about what's worth saying: it compares the day with the two big kinds of early vote, skips a
   pile too small to tell us about a seat (VT_SAY), and calls a gap under VT_LEVEL much the same. */
const VT_MOB = 0.05, VT_CELL = 100, VT_SAY = 500, VT_LEVEL = 0.5;
const VT_ROWS = [["day", "On the day", "var(--ink-2)"], ["mob", "Mobile teams", "var(--ink-3)"], ["ppvc", "Early centres", "var(--ink-faint)"], ["pre", "Early, by declaration", "color-mix(in oklch, var(--ink-faint) 50%, var(--line))"], ["post", "Postal", "var(--accent)"], ["other", "Absent and other", "var(--line)"]];
function vtRows(divs) {
  const two = {}, add = (k, p) => { const t = (two[k] ??= [0, 0]); t[0] += p[0]; t[1] += p[1]; };
  const votes = { ppvc: 0, pre: 0, post: 0, other: 0 };
  let ord = 0, seats2 = 0;
  for (const d of divs) {
    const v = d.vt;
    ord += v.ord; votes.ppvc += v.ppvc || 0; votes.pre += v.pre || 0; votes.post += v.post || 0; votes.other += (v.abs || 0) + (v.prov || 0);
    if (!d.vt2) continue;
    seats2++;
    for (const [k, p] of Object.entries(d.vt2)) add(k === "abs" || k === "prov" ? "other" : k, p);
  }
  const tot = ord + votes.pre + votes.post + votes.other;
  votes.mob = two.mob ? two.mob[0] + two.mob[1] : 0;
  if (votes.mob >= VT_MOB * tot) votes.day = ord - votes.ppvc - votes.mob;
  else { votes.day = ord - votes.ppvc; votes.mob = 0; if (two.mob) add("day", two.mob); }
  const rows = VT_ROWS.filter(([k]) => votes[k] > 0).map(([k, l, c]) => {
    const t = two[k], n = t ? t[0] + t[1] : 0;
    return { k, l, c, v: votes[k], n, lab: n >= VT_CELL ? (100 * t[0]) / n : null };
  });
  return { rows, tot, seats2 };
}
function vtFinding(rows) {
  const at = (k) => { const r = rows.find((x) => x.k === k); return r && r.n >= VT_SAY ? r.lab : null; };
  const day = at("day");
  if (day == null) return "";
  const piles = [["post", "by post"], ["ppvc", "at early centres"]].filter(([k]) => at(k) != null).map(([k, w]) => ({ w, g: at(k) - day }));
  if (!piles.length) return "";
  const moved = piles.filter((p) => Math.abs(p.g) >= VT_LEVEL), flat = piles.filter((p) => Math.abs(p.g) < VT_LEVEL);
  if (!moved.length) return `Labor’s two-party share was much the same ${piles.map((p) => p.w).join(" and ")} as on the day.`;
  const way = (p) => `${p.g > 0 ? "higher" : "lower"} ${p.w}`;
  let say = `Labor’s two-party share was ${pts(moved[0].g)} ${way(moved[0])} than on the day`;
  if (moved[1]) say += `, and ${f1(Math.abs(moved[1].g))} ${way(moved[1])}`;
  if (flat[0]) say += `, and much the same ${flat[0].w}`;
  return `${say}.`;
}
// (area: a state's or the country's, which also says what the balloons and the surface leave out)
// The 2025 graphic pools counts before taking shares or subtracting the area's
// two-party result. Mobile teams stay with ordinary on-the-day votes, as in
// the national vote-type table; they must not disappear in a three-band chart.
const VT_BANDS = [
  ["late", "Early, by declaration & absent and other", ["pre", "abs", "prov"], "Over following days"],
  ["early", "Early centres & postal", ["ppvc", "post"], "From about 9:30 pm"],
  ["day", "On the day", ["day", "mob"], "From about 7 pm"],
];
let vtMode = "skew", vtLast = null;
/* the Skew/Effect switch redraws its own block alone, its buttons held where
   they stood on screen: re-rendering the whole story let the page reflow under
   the reader (it shrank for a frame and the browser pulled the page up) */
function setVtMode(mode) {
  if (!["skew", "effect"].includes(mode) || mode === vtMode) return;
  vtMode = mode;
  const old = $("#story .vt-chart"), btn = old && old.querySelector(`[data-vt-mode="${mode}"]`);
  if (!old || !vtLast) { renderStory(true); $(`#story [data-vt-mode="${mode}"]`)?.focus({ preventScroll: true }); return; }
  const top = btn.getBoundingClientRect().top, html = document.documentElement, anchor = html.style.overflowAnchor;
  html.style.overflowAnchor = "none";
  const box = document.createElement("div");
  box.innerHTML = vtBandsBlock(vtLast.divs, vtLast.area, vtLast.geography);
  const next = box.firstElementChild;
  old.replaceWith(next);
  const nb = next.querySelector(`[data-vt-mode="${mode}"]`);
  const shift = Math.round(nb.getBoundingClientRect().top - top);
  if (shift) { if (FS.on && FS.scroll && FS.scroll.contains(next)) FS.scroll.scrollTop += shift; else window.scrollBy(0, shift); }
  html.style.overflowAnchor = anchor;
  nb.focus({ preventScroll: true });
}
// the margin list's two reads — tightest margins ("Most marginal") or widest
// ("Safest"); the head's up/down toggle flips it and re-renders like setVtMode
let closeSafe = false;
function setCloseSafe(safe) {
  if (safe === closeSafe) return;
  closeSafe = safe;
  renderStory(true);
  $("#story [data-close-toggle]")?.focus({ preventScroll: true });
}
function vtBands(divs) {
  const counts = {}, total2 = [0, 0];
  let tot = 0;
  for (const d of divs) {
    const v = d.vt;
    tot += (v.ord || 0) + (v.pre || 0) + (v.post || 0) + (v.abs || 0) + (v.prov || 0);
    for (const [k, p] of Object.entries(d.vt2 || {})) {
      const t = (counts[k] ??= [0, 0]);
      t[0] += p[0]; t[1] += p[1];
      total2[0] += p[0]; total2[1] += p[1];
    }
  }
  // The vote-type counts exhaust each seat's official two-party total.
  const base = total2[0] + total2[1] > 0 ? 100 * total2[0] / (total2[0] + total2[1]) : null;
  const complete = divs.every((d) => d.vt2);
  const bands = VT_BANDS.map(([k, l, keys, time]) => {
    const v = divs.reduce((n, d) => n + (k === "day" ? (d.vt.ord || 0) - (d.vt.ppvc || 0) : keys.reduce((s, t) => s + (d.vt[t] || 0), 0)), 0);
    const t = keys.reduce((p, key) => [p[0] + (counts[key]?.[0] || 0), p[1] + (counts[key]?.[1] || 0)], [0, 0]);
    const n = t[0] + t[1], lab = n > 0 ? 100 * t[0] / n : null;
    return { k, l, time, v, a: t[0], n, share: tot > 0 ? 100 * v / tot : 0, lab, skew: complete && lab != null && base != null ? lab - base : null };
  });
  // Counting order runs up the graphic: day, early/postal, then declarations.
  // Pool actual two-party counts, not rounded shares or primary-vote totals.
  let counted = 0, labor = 0;
  for (const r of bands.slice().reverse()) {
    const before = counted > 0 ? 100 * labor / counted : null;
    counted += r.n; labor += r.a;
    r.cumulative = complete && counted > 0 ? 100 * labor / counted : null;
    r.effect = complete && r.n > 0 && before != null ? r.cumulative - before : null;
  }
  return { bands, tot, base };
}
// A figures-menu choice changes the chart's electorate pool as well as its
// heading. A map state or seat selection takes precedence over that menu.
function vtScope(m, st) {
  // the head's own pool: the area, narrowed by the seat-type filter where one is on
  const cls = clsFilter(m), pst = st === "AUS" ? null : st;
  const divs = m.res.divs.filter((d) => d.vt && (!pst || d.st === pst) && (!cls || d.cls === cls));
  const geography = cls && pst ? `${CLS_LOWER[cls]} seats in ${STATE_SHORT[pst]}` : cls ? `${CLS_LOWER[cls]} seats` : pst ? STATE_SHORT[pst] : "nationwide";
  return { divs, geography };
}
function vtBandsBlock(divs, area, geography) {
  const { bands, tot } = vtBands(divs);
  if (!tot) return "";
  vtLast = { divs, area, geography };
  const effect = vtMode === "effect", place = geography || divs[0].n.replace(/'/g, "’");
  const heading = effect ? "Change in cumulative 2PP" : place === "nationwide" ? "National 2PP skew" : `Skew on ${place} 2PP`;
  const modes = `<div class="vt-modes" role="group" aria-label="Vote-type measure"><button type="button" class="vt-mode" data-vt-mode="skew" aria-pressed="${!effect}">Skew</button><button type="button" class="vt-mode" data-vt-mode="effect" aria-pressed="${effect}">Effect</button></div>`;
  const rows = bands.map((r) => {
    const value = effect ? r.effect : r.skew, text = effect && value == null ? "—" : sgn(value);
    const tone = value != null && Math.abs(value) >= 0.05 ? (value > 0 ? "vt-alp" : "vt-lnp") : "";
    const reading = effect
      ? value != null ? `${text} percentage-point change in ${place} cumulative Labor 2PP` : r.k === "day" && r.cumulative != null ? "Opening count; no preceding group" : "Change in cumulative two-party share unavailable"
      : value == null ? "two-party skew unavailable" : `${text} percentage points on ${place} Labor 2PP`;
    return `<div class="vt-band vt-band-${r.k}" role="listitem" style="--vt-share:${r.share}" aria-label="${esc(`${f1(r.share)}%, ${r.l}; counting ${r.time.toLowerCase()}; ${reading}`)}"><b class="vt-share">${f1(r.share)}%</b><span class="vt-label">${esc(r.l)}<small class="vt-time">${esc(r.time)}</small></span><b class="vt-skew ${tone}">${text}</b></div>`;
  }).join("");
  const notes = effect
    ? ["Percentage-point change in Labor’s cumulative 2PP when each group is added, counting from bottom to top. The opening count has no preceding group.", "Illustrative sequence, not actual election-night reporting: batches overlap, and postal and declaration votes arrive over several days. Mobile teams are included with on-the-day ordinary votes."]
    : ["Skews are percentage points in Labor’s two-party share. Mobile teams are included with on-the-day ordinary votes."];
  if (area) notes.push("Postal, absent and declaration votes have no place on the map, so balloons and the surface leave them out.");
  return `<div class="st-sec vt-chart"><h3>How votes were cast <small>${int(tot)} formal</small></h3>${modes}<p class="vt-skew-head">${esc(heading)}</p><div class="vt-bands" role="list" aria-label="${esc(`Formal vote shares and ${effect ? "effect on count" : "two-party skews"}, ${place}`)}">${rows}</div>${notes.map((n) => `<p class="st-note">${n}</p>`).join("")}</div>`;
}
function vtBlock(divs, area, geography) {
  if (M().year === 2025 || M().year === "now") return vtBandsBlock(divs, area, geography);
  const { rows, tot, seats2 } = vtRows(divs), two = rows.some((r) => r.lab != null);
  const notes = [vtFinding(rows)];
  if (!two) notes.push(M().year === 1993 ? "The 1993 count doesn’t split the final two by how votes were cast." : `The count splits these votes two-party only where the final two were Labor and ${coalW(0)}.`);
  else if (area && seats2 < divs.length) notes.push(`Labor’s share comes from the ${seats2} of ${divs.length} seats whose final two were Labor and ${coalW(0)}.`);
  if (area) notes.push("Postal, absent and declaration votes have no place on the map, so balloons and the surface leave them out.");
  return `<div class="st-sec"><h3>How votes were cast <small>${int(tot)} formal</small></h3><div class="stack">${rows.map((r) => `<i style="width:${(100 * r.v) / tot}%;background:${r.c}" title="${r.l}"></i>`).join("")}</div><table class="tbl vt-tbl"><thead><tr><th>Vote</th><th>Share</th>${two ? "<th>Labor 2PP</th>" : ""}</tr></thead><tbody>${rows.map((r) => `<tr><td><i class="sw" style="background:${r.c}"></i>${r.l}</td><td>${f1((100 * r.v) / tot)}%</td>${two ? `<td>${f1(r.lab)}</td>` : ""}</tr>`).join("")}</tbody></table>${notes.filter(Boolean).map((n) => `<p class="st-note">${n}</p>`).join("")}</div>`;
}

function storyArea(m, st) {
  // st is the area: the whole frame ("AUS") or the State filter's state; a
  // Seat type filter narrows it to that type's seats (scopeArea)
  const aus = st === "AUS", cls = clsFilter(m), { A, idx, N } = scopeArea(m, st);
  const winnerish = S.lens === "winner" || S.lens === "cls";
  const { hed, dek, stat, quiet, note } = areaHedDek(m, st);
  /* the same head in every lens: a filtered view titles itself by the filter —
     the seat type, else the state — with the election's year after a middot
     on election frames (user call: "New South Wales · 2025", "Inner metro ·
     2025"); the meta counts the seats behind the figures, naming the state
     where a seat type narrows it ("New South Wales · 12 divisions") */
  const filt = cls ? CLS_SHORT[cls] : aus ? null : STATE_TITLE[st];
  const title = filt ? `${filt}${isNowY(m.year) ? "" : ` · ${m.year}`}` : (m.year === "now" ? "The House today" : isNowY(m.year) ? "The Assembly today" : STATE_YEARS.has(m.year) ? (isNSW() ? "New South Wales election" : isVic() ? "Victorian election" : isQld() ? "Queensland election" : WA_YEARS.has(m.year) ? "Western Australian election" : "South Australian election") : `${yearLabel(m.year)} election`);
  // never the date — the eyebrow line above the map already carries it
  const meta = `${cls && !aus ? `${esc(STATE_TITLE[st])} · ` : ""}${N} ${isNowY(m.year) ? (N === 1 ? "member" : "members") : seatNoun()}`;
  /* the figures block is every lens's: the seats, the two-party count and the
     primaries for the filtered pool. The Winner and Seat type lenses say no
     more than their figures (a dek only where words carry what figures can't);
     the two-party lens's figure is its finding; every other lens adds its
     finding in a line of prose under them */
  const figs = stat || seatStat(m, st, `${hed}.`, aus && m.year === "now" ? NOW_AUS_DEK.now : null);
  let h = head(title, meta, winnerish || quiet ? "" : hed, quiet ? "" : dek, figs);
  if (note) h += `<p class="st-note">${note}</p>`;
  // a state election's two-party row counts only the classic pairs: say so under the figures
  if (isState() && A.tpp != null) { const classicN = idx.filter((i) => m.divs[i].tpp != null).length; h += `<p class="st-note">Only the ${classicN} districts whose count finished Labor against ${coalW(0)} carry the two-party figure; the ${commX()} publishes no notional two-party count for the rest.</p>`; }
  if (m.res.coverage) h += `<p class="st-note">${esc(m.res.coverage.note)}</p>`;
  const scopeSmall = cls ? `, ${CLS_LOWER[cls]}${aus ? "" : ` in ${STATE_SHORT[st]}`}` : aus ? "" : `, ${STATE_SHORT[st]}`;
  // (under a chart the stage already draws the seats' spread, so the rail doesn't repeat it)
  if (lensNumeric() && !chartOn(m) && !(S.lens === "seifa" && isDemo() && !A.demo)) h += `<div class="st-sec"><h3>Across the seats <small>${esc(lensShort())}${scopeSmall}</small></h3>${distBlock(m, "seats", idx.map((i) => m.divs[i]), { compact: true })}</div>`;
  // the House: who holds the seats (the make-up itself; the head's seats row carries the counts)
  if (S.view !== "chamber") {
    // the chamber section's small names the filter it marks: the state's own
    // members, or the seat type whose kind stays lit
    // a seat type compounds with a hyphen as the mark ("Outer-metro seats lit")
    const chamberMark = cls ? `${CLS_SHORT[cls].replace(" ", "-")} seats lit${aus ? "" : ` in ${STATE_NAME[st]}`}` : aus ? "with every member in their seat" : `${STATE_POSS[st]} members lit`;
    h += `<div class="st-sec"><h3>${isNowY(m.year) ? "The chamber today" : "The new chamber"} <small>${chamberMark}</small></h3><div class="st-chamber"><canvas id="minich" aria-label="${isSA() ? "The House of Assembly" : isNSW() || isVic() || isQld() || isWA() ? "The Legislative Assembly" : "The House of Representatives"}, each member a chair"></canvas></div></div>`;
  }
  // (a seat-type filter keeps the changes in its own seats)
  const chPool = new Set(idx), chList = (m.changes || []).filter((c) => chPool.has(m.byName.get(c.div)));
  if (isNowY(m.year) && aus && chList.length) {
    const ch = chList.slice().reverse();
    const chN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][ch.length] || ch.length;
    h += `<div class="st-sec"><h3>Since the election <small>${chN === "one" ? "one change" : `${chN} changes`}</small></h3><div class="changes">${ch.map((c) => `<button type="button" data-go="divname:${esc(c.div)}"><span class="dt">${shortDate(c.date).replace(/ 20(\d\d)$/, " ’$1")}</span><span class="tx"><b>${ds(c.div)}.</b> ${ds(c.text)}.</span></button>`).join("")}</div></div>`;
    // the federal Now's figures-basis qualifier leads its seats note in the
    // head instead ("The figures here are the 2025 election's, adjusted for
    // seat changes…", user call) — the state Now frames keep it here
    if (m.year !== "now") h += `<p class="st-note" style="margin-top:22px">The figures below are the ${frameBaseY(m.year)} election’s.</p>`;
  }
  // (from the results file: "Now" blanks a by-election's piles, and these figures are the election's)
  const castScope = vtScope(m, st), cast = castScope.divs;
  if (cast.length) h += vtBlock(cast, true, m.year === 2025 || m.year === "now" ? castScope.geography : undefined);
  const close = idx.map((i) => m.divs[i]).filter((d) => !d.by).sort((a, b) => closeSafe ? b.margin - a.margin : a.margin - b.margin).slice(0, 6).map((d) => ({ i: d.i, v: d.margin }));
  // a hairline margin (Bradfield '25, 26 votes) vanishes at one decimal — show
  // two, or three if two would still print zeros (the f1 check keeps null/NaN "–" safe)
  const closeFmt = (v) => (f1(v) === "0.0" ? (v.toFixed(2) === "0.00" ? v.toFixed(3) : v.toFixed(2)) : f1(v));
  const closeRow = (v, d) => `${closeFmt(v)} <small>(${int(d.votesMargin)} vote${d.votesMargin === 1 ? "" : "s"})</small>`;
  // up arrow lit on Safest, down arrow lit on Most marginal — the arrows ride
  // the right edge of the head, inline with its words
  const closeNext = closeSafe ? "Show most marginal seats" : "Show safest seats";
  const closeArrows = `<svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 17V3.5M3.2 7.2 6.5 3.7l3.3 3.5" stroke="var(--ink${closeSafe ? "" : "-3"})"/><path d="M13.5 3v13.5M10.2 12.8l3.3 3.5 3.3-3.5" stroke="var(--ink${closeSafe ? "-3" : ""})"/></svg>`;
  h += `<div class="st-sec"><h3>${closeSafe ? "Safest" : "Most marginal"} seats <small>winning margin, points</small><button type="button" class="st-pv-control st-cls-swap" data-close-toggle title="${closeNext}" aria-label="${closeNext}">${closeArrows}</button></h3>${linkRows(m, close, closeRow, (i) => colCss(m.divCol[i]))}</div>`;
  // the informal line rides under the margin list at the foot (user call
  // 2026-11-08; it followed How-votes-were-cast before, 2026-11-07)
  h += informalHTML(m, st);
  h += foot(m);
  return h;
}

/* ----- a seat ----- */
// the election a seat's swings are measured against: an "as it stands" frame
// shows the base count (against the election before it) everywhere but the
// by-election seats, whose own count is judged against that base
const prevFor = (m, d) => (isNowY(m.year) ? (d && d.by ? frameBaseY(m.year) : m.res.prev) : prevYearOf(m.year) ?? (m.res && m.res.prev));
function seatHedDek(m, d) {
  const prev = prevFor(m, d);
  const [wn, rn] = pairNames(d.win, d.run);
  const wParty = theParty(d.win.ab, d.win.pn), rParty = partyName(d.run.ab, d.run.pn);
  const close = d.votesMargin < 1500 && d.margin < 1;
  switch (S.lens) {
    case "winner": {
      if (d.by) {
        if (m.year === "now" && d.n === "Farrer") {
          const hed = `One Nation’s David Farley won Farrer at the May 2026 by-election`;
          const dek = `He beat the independent Michelle Milthorpe ${f1(d.winPct)}–${f1(100 - d.winPct)} after preferences. Sussan Ley had held the seat for the Liberals since 2001; their candidate, Raissa Butkowski, ran third on ${f1(d.fp.lnp ? (100 * d.c.find((c) => c.ab === "LP").v) / d.formal : 0)}% of first preferences. Labor didn’t stand.`;
          return { hed, dek };
        }
        // every other by-election seat: the record speaks for itself
        const hed = `${ds(d.win.n)} won ${ds(d.n)} at the ${monthYear(d.by.date)} by-election`;
        const dek = `${ds(d.win.n)} won the final count ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)}).`;
        return { hed, dek };
      }
      const hold = d.hold, switched = isNowY(m.year) && (hold.n !== d.win.n || hold.ab !== d.win.ab);
      if (switched) {
        const ch = m.changes.filter((c) => c.div === d.n).pop();
        const hed = hold.ab === "CSA" ? `${ds(hold.n)} now sits for Community Strong` : `${ds(hold.n)} now sits for ${esc(leaderName(hold))}`;
        const dek = hold.ab === "CSA"
          ? `She won ${ds(d.n)} as an independent in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)}), and co-founded Community Strong Australia on ${longDate(ch.date)}.`
          : `He won ${ds(d.n)} for the Nationals in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)}). He left the Nationals on 27 November 2025 and joined One Nation on ${longDate(ch.date)}.`;
        return { hed, dek };
      }
      let hed;
      const ch = d.change;
      if (ch.kind === "re") hed = close ? `${ds(d.win.n)} held ${ds(d.n)} by ${int(d.votesMargin)} votes` : `${ds(d.win.n)} held ${ds(d.n)}`;
      else if (ch.kind === "held") hed = `${ds(d.win.n)} kept ${ds(d.n)} for ${ds(wParty)}`;
      else if (ch.kind === "gain") hed = ch.prev && FAM(ch.prev[2]) === d.win.fam ? `${ds(d.win.n)} won ${ds(d.n)} from ${ds(ch.prev[3])}` : `${ds(d.win.n)} won ${ds(d.n)} from ${ds(theParty(ch.prev[2]))}`;
      else if (ch.kind === "new") hed = `${ds(d.win.n)} won the new seat of ${ds(d.n)}`;
      else hed = `${ds(d.win.n)} won ${ds(d.n)}`;
      if (close && ch.kind !== "re") hed += ` by ${int(d.votesMargin)} votes`;
      // the Final count block beneath now carries everything the dek used to
      // narrate (margin, swing, classification); the headline stands alone
      return { hed, dek: "" };
    }
    case "tpp": {
      if (axisNow(m) !== "AC") return axisSeatHedDek(m, d);
      if (d.tpp == null) return { hed: `There was no Labor v ${oppNameW()} count in ${ds(d.n)}`, dek: isState() ? `The ${commX()} publishes a two-party count only where the final pair is Labor against ${coalW(0)}.` : d.by ? "Labor didn’t stand at the by-election, so the AEC counted the final two only: One Nation against the independent." : "" };
      if (S.tppMode === "swing") {
        const s = d.tppSw;
        const hed = s == null ? `${ds(d.n)} has no recorded swing` : Math.abs(s) < 0.05 ? `There was no two-party swing in ${ds(d.n)}` : `${ds(d.n)} swung ${pts(s)} to ${s > 0 ? "Labor" : coalW()}`;
        const aus = m.areas.AUS.tppSw;
        return { hed, dek: s == null ? "" : `Across ${ausW()} the swing was ${pts(aus)} to ${aus > 0 ? "Labor" : coalW()}. The ${isState() ? commX() : "AEC"} measures a seat’s swing against its result last time, adjusted where its boundaries were redrawn.` };
      }
      const lead = d.tpp >= 50;
      const hed = `${lead ? "Labor" : coalW(1)} won ${f1(lead ? d.tpp : 100 - d.tpp)}% of the two-party vote in ${ds(d.n)}`;
      const sp = swingPhrase(d.tppSw, prev);
      const dek = d.classic ? `The final count was Labor against ${coalW()}${sp ? `, ${sp}` : ""}.` : `The final two here were ${ds(rn)} and ${ds(wn)}, so this is the ${isState() ? commX() + "’s" : "AEC’s"} notional count of Labor against ${coalW()}${sp ? `, ${sp}` : ""}.`;
      return { hed, dek };
    }
    case "fp": {
      const P = S.party, name = legW(P), v = d.fp[P];
      if (S.fpMode === "change") {
        const c = fpChange(m, d, P);
        if (c == null) return { hed: `${SUBJ[P]} didn’t stand in ${ds(d.n)} both times`, dek: "" };
        return { hed: Math.abs(c) < 0.05 ? `${Poss(P)} primary vote in ${ds(d.n)} was unchanged` : `${Poss(P)} primary vote ${c >= 0 ? "rose" : "fell"} ${pts(c)} in ${ds(d.n)}`, dek: `${SUBJ[P]} won ${f1(v)}% of first preferences${d.by ? ` at the by-election, against the seat’s ${frameBaseY(m.year)} count` : ""}.` };
      }
      if (!v) return { hed: `${name === "Independents" ? "No independent" : name} didn’t stand in ${ds(d.n)}`.replace("No independent didn’t", "No independent stood"), dek: "" };
      const aus = m.areas.AUS.fp[P];
      return { hed: `${name} won ${f1(v)}% of first preferences in ${ds(d.n)}`, dek: `Across Australia ${name === "Independents" ? "independents" : name} won ${f1(aus)}%.` };
    }
    case "senate": {
      const P = S.party, name = legW(P), pr = senPron(P);
      if (svYear(m.year) == null) return { hed: `A state election has no Senate`, dek: "" };
      if (d.by) return { hed: `${ds(d.n)}’s by-election had no Senate vote`, dek: `Choose 2025 on the timeline to set the Senate against ${ds(d.n)}’s 2025 House count.` };
      const s = svOf(m), sv = s && svShare(s.divs[d.n], P);
      if (sv == null) return { hed: `The Senate’s votes are loading`, dek: "" };
      const h = d.fp[P], cands = d.c.filter((c) => c.b === P).length, aus = senArea(m, m.areas.AUS.idx, P);
      if (!cands) return { hed: P === "ind" ? `No independent stood for the House in ${ds(d.n)}` : P === "oth" ? `No other candidate stood for the House in ${ds(d.n)}` : `${name} didn’t stand for the House in ${ds(d.n)}`, dek: `${SUBJ[P]} won ${f1(sv)}% of the Senate vote here${aus ? `, against ${f1(aus.sen)}% across Australia` : ""}.` };
      if (senGap()) return { hed: `${SUBJ[P]} ${senGapWords(sv - h)} in ${ds(d.n)}`, dek: `${f1(sv)}% of Senate first preferences against ${f1(h)}% for ${pr.its} House ${cands > 1 ? "candidates" : "candidate"}.${aus ? ` Across Australia the gap was ${sgn(aus.gap)} points.` : ""}` };
      return { hed: `${SUBJ[P]} won ${f1(sv)}% of the Senate vote in ${ds(d.n)}`, dek: `${pr.Its} House ${cands > 1 ? "candidates" : "candidate"} won ${f1(h)}%${aus ? `; across Australia ${pr.its} Senate vote was ${f1(aus.sen)}%` : ""}.` };
    }
    case "senpref": {
      if (spYear(m.year) == null) return { hed: `A state election has no Senate`, dek: "" };
      if (spYear(m.year) == null) return { hed: `No Senate preference record for ${m.year}`, dek: `The AEC's record opens with the 2004 group voting tickets; every ballot's own order is published from 2016. Choose 2004 or later on the timeline.` };
      if (d.by) return { hed: `${ds(d.n)}’s by-election had no Senate vote`, dek: `Choose 2025 on the timeline to read ${ds(d.n)}’s Senate ballots.` };
      const s = spOf(m);
      if (!s) return { hed: `The Senate’s record is loading`, dek: "" };
      const gvt = spGvtYear(m.year) != null;
      const c = spCells(s.divs[d.n]), v = spDivValue(m, d), aus = spArea(m, m.areas.AUS.idx);
      if (v == null) return { hed: `Too few ${spWho()} Senate ${gvt ? "tickets" : "ballots"} in ${ds(d.n)} to read`, dek: c ? `${int(c.x + c.y)} numbered either party.` : "" };
      if (gvt) return { hed: `${f0(v)}% of ${spWho()} Senate tickets in ${ds(d.n)} put ${spA()} ahead of ${spB()}`,
        dek: `${int(c.x + c.y)} ticket-bound ballots named a party of the pair.${aus ? ` Across Australia, ${f0(aus.share)}%.` : ""}` };
      return { hed: `${f0(v)}% of ${spWho()} Senate voters in ${ds(d.n)} ranked ${spA()} ahead of ${spB()}`,
        dek: `${int(c.x + c.y)} of their ballots numbered either party, ${int(c.nei)} neither.${aus ? ` Across Australia, ${f0(aus.share)}%.` : ""}` };
    }
    case "flow": {
      const F = S.from, nm = possW(F), rival = vsW();
      if (!flowSeat(d)) return { hed: `${ds(d.n)}’s count didn’t end Labor against ${rival}`, dek: `Its final two were ${ds(d.win.n)} and ${ds(d.run.n)}, so its preferences weren’t split between Labor and ${rival}.${d.vs && d.vs !== S.vs ? ` Set the preferences lens to Labor against ${d.vs === "onp" ? "One Nation" : coalW()} to read it.` : ""}` };
      const v = d.flowAlp[F];
      if (v == null) {
        const stood = d.c.some((c) => c.b === F);
        const who = F === "ind" ? "No independent" : F === "oth" ? "No other candidate" : famLeg(F);
        return { hed: stood ? `${cap(nm)} preferences weren’t distributed in ${ds(d.n)}` : F === "ind" || F === "oth" ? `${who} stood in ${ds(d.n)}` : `${who} didn’t stand in ${ds(d.n)}`, dek: stood ? "Its candidate finished in the final two, so its votes were never passed on." : "" };
      }
      if (m.res.flBasis === "modelled") {
        const e = flowErrOf(m, F);
        return { hed: `${f0(v)}% of ${nm} preferences in ${ds(d.n)} modelled to go to Labor`, dek: `The rest, ${f0(100 - v)}%, to ${rival} — an estimate: South Australia publishes no per-candidate split.${e ? ` ${cap(flowErrWords(e))}.` : ""}` };
      }
      let ex = 0, xt = 0;
      if (m.res.flOpv) for (const f of d.flows) if (f.cand.b === F && f.exh != null) { ex += f.exh; xt += f.ta + f.tb + f.exh; }
      const opc = xt ? ` Another ${f0((100 * ex) / xt)}% of ${nm} ballots exhausted before the final two — New South Wales votes optional-preferential.` : "";
      return { hed: `${f0(v)}% of ${nm} preferences in ${ds(d.n)} went to Labor`, dek: `The rest, ${f0(100 - v)}%, went to ${rival}.${opc}` };
    }
    case "informal": {
      if (infModeOf(m) === "exhaust") {
        const xs = [...m.divs].filter((x) => x.exhPct != null).sort((a, b) => b.exhPct - a.exhPct);
        const r = xs.findIndex((x) => x.i === d.i) + 1;
        return { hed: `${f1(d.exhPct)}% of ${ds(d.n)}’s ballots exhausted before the final two`, dek: `New South Wales votes optional-preferential, so a ballot leaves the count when its numbered candidates are gone. That’s ${rankWords(r, xs.length)} rate of the ${xs.length} seats${byNote(d)}; across the state it was ${f1(m.areas.NSW.exhPct)}%.` };
      }
      const r = [...m.divs].filter((x) => x.infPct != null).sort((a, b) => b.infPct - a.infPct).findIndex((x) => x.i === d.i) + 1;
      return { hed: `${f1(d.infPct)}% of ${ds(d.n)}’s ballots were informal`, dek: `That’s ${rankWords(r, m.divs.length)} rate of the ${m.divs.length} seats${byNote(d)}; across Australia it was ${f1(m.areas.AUS.infPct)}%.` };
    }
    case "cls": return { hed: d.cls ? `${ds(d.n)} is ${/^[aeiou]/i.test(CLS_LOWER[d.cls]) ? "an" : "a"} ${CLS_LOWER[d.cls]} seat` : `${ds(d.n)} has no AEC type on record`, dek: d.cls ? `${CLS_DEF[d.cls]}, in the AEC’s words.` : "" };
    case "seifa": {
      if (isDemo()) {
        const k = S.index;
        if (!d.demo) return m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY : { hed: `${ds(d.n)} has no census figure`, dek: "" };
        const xs = m.divs.filter((x) => demoShare(x) != null).sort((a, b) => demoShare(b) - demoShare(a)), r = xs.findIndex((x) => x.i === d.i) + 1;
        const aus = m.areas.AUS.demo;
        // the median view prices the seat's figure in dollars against
        // the national household line, never a share of anything
        if (incMed()) return { hed: `The median household in ${ds(d.n)} earns ${mny(demoShare(d))} a week`, dek: `That’s ${rankWords(r, xs.length, "the highest median", "the lowest median")} of the ${xs.length} seats; across Australia, households earn ${mny(m.incomeCuts && m.incomeCuts.medWeekly)} a week${incEpoch(m)}. ${demoCopy(m).seats}` };
        // the median-age view tells it in years on the same doctrine
        if (ageMed()) return { hed: `The median age in ${ds(d.n)} is ${Math.round(demoShare(d))}`, dek: `That’s ${rankWords(r, xs.length, "the oldest median", "the youngest median")} of the ${xs.length} seats; Australia’s median age is ${m.ageCuts && m.ageCuts.medAge}. ${demoCopy(m).seats}` };
        return { hed: `${f0(100 * demoShare(d))}% of ${ds(d.n)}’s ${censusWho(m, k).pop} ${censusWho(m, k).pred}`, dek: `That’s ${rankWords(r, xs.length)} share of the ${xs.length} seats; across ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}, ${f1(demoAreaShare(aus))}%. ${demoCopy(m).seats}` };
      }
      const c = d.seifa[S.index];
      if (!c || !c.dec) return { hed: `${ds(d.n)} has no ${IX_ABBR[S.index]} score`, dek: "" };
      const where = c.dec === 10 ? "among the most advantaged tenth of seats" : c.dec === 1 ? "among the least advantaged tenth of seats" : c.dec <= 5 ? `in the ${ordw(c.dec)} tenth of seats, counted from the least advantaged` : `in the ${ordw(11 - c.dec)} tenth of seats, counted from the most advantaged`;
      return { hed: `${ds(d.n)} is ${where}`, dek: `On the ABS’s ${IX_NAME[S.index].toLowerCase()} index (${IX_ABBR[S.index]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : "interpolated between censuses to election day"}.` };
    }
  }
  return { hed: "", dek: "" };
}

function storyDiv(m, i) {
  const d = m.divs[i];
  const prev = prevFor(m, d);
  const { hed, dek } = seatHedDek(m, d);
  const meta = `${d.cls ? esc(CLS_SHORT[d.cls]) + " · " : ""}${esc(STATE_TITLE[d.st])}${d.by ? ` · by-election, ${longDate(d.by.date)}` : ""}`;
  // the seat's figures lead its card (the Final count, any notional two-party
  // count, the primaries), and the lens's finding follows them in prose
  let figs = seatFinalStat(m, d);
  /* the AEC's notional two-party count, where the final pair wasn't the
     majors: the same head-block idiom as the Final count (the name of the
     minority coalition partner comes through coalW on state frames) */
  if (d.tpp != null && !d.classic) {
    const coal = coalW(1).replace(/^The /, "");
    const two = twoPartyFigures(`Two-party preferred (notional, margin of ${tightFmt(Math.abs(d.tpp - 50))})`, d.tpp, "alp", "Labor", 100 - d.tpp, "lnp", coal, "", true, ["Labor", coal]);
    figs += `<div class="st-sec"><div class="st-stat st-secstat">${two}${swingFigure(d.tppSw)}</div></div>`;
  }
  figs += seatPrimariesStat(m, d);
  let h = head(d.n, meta, hed, dek, figs);
  const prevDiv = d.by ? d.by.prev : null;
  const moved = movedTo(m, d);
  const winPartyOf = moved ? (c) => (c === d.win ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  h += `<div class="st-sec"><h3>The candidates <small>by primary vote${d.by ? `, change on ${frameBaseY(m.year)}` : ""}</small></h3>${candRows(d.c, d.formal, null, 7, d.by ? (c) => byChange(c, d, prevDiv) : null, winPartyOf)}</div>`;
  const fl = flowRows(d.flows, d.A, d.B);
  if (fl) h += `<div class="st-sec"><h3>Where preferences went <small>to the final two</small></h3>${fl}</div>`;
  if (d.vt) h += vtBlock([d]);
  const infCmpKey = m.areas.AUS ? "AUS" : stOfYear(m.year), infCmp = m.areas[infCmpKey] && m.areas[infCmpKey].infPct;
  const byTurnout = d.by ? `<p class="st-note">Turnout was ${f1((100 * d.by.turnout) / d.by.enrolment)}% of ${int(d.by.enrolment)} enrolled.</p>` : "";
  /* the national view's plain line, with the seat's comparison inside it
     (user call 2026-11-08 — the big-figure head block lasted the day) */
  const infWhere = m.areas.AUS ? "national average" : `${ausW()} average`;
  h += d.infPct == null && d.by ? `<div class="st-inf"><b>Informal votes:</b> no count filed for the by-election yet</div>${byTurnout}` : `<div class="st-inf"><b>Informal votes:</b> ${f1(d.infPct)}%${infCmp != null ? ` (vs ${infWhere} ${f1(infCmp)}%)` : ""}</div>${byTurnout}`;
  const incRow = d.demo ? incFact(m, d.demo) : "";
  const origV = isCob() && d.demo && d.demo.cob ? d.demo.cob[S.cob] : null;
  const demoFacts = d.demo ? `<dt>Language</dt><dd>${f0(100 * d.demo.lang)}% of residents speak a language other than English at home</dd><dt>Origin</dt><dd>${origV != null ? `${f0(100 * origV)}% ${COB_VERB[S.cob]}` : `${f0(100 * d.demo.fborn)}% ${DM_VERB.fborn}`}</dd><dt>Education</dt><dd>${f0(100 * d.demo.uni)}% ${DM_VERB.uni}</dd><dt>Work</dt><dd>${f0(100 * d.demo.blue)}% ${DM_VERB.blue}${d.demo.pt != null ? `, ${f0(100 * d.demo.pt)}% ${DM_VERB.pt}` : ""}</dd><dt>Age</dt><dd>${f0(100 * d.demo.a65)}% are 65 or older, ${f0(100 * d.demo.a2034)}% are 20 to 34</dd>${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}${d.demo.noncit != null ? `<dt>Citizenship</dt><dd>${f0(100 * d.demo.noncit)}% ${DM_VERB.noncit}</dd>` : ""}${d.demo.bigfam != null ? `<dt>Children</dt><dd>${f0(100 * d.demo.bigfam)}% ${DM_VERB.bigfam}</dd>` : ""}${d.demo.hl != null ? `<dt>Home</dt><dd>${f0(100 * d.demo.hl)}% ${DM_VERB.hl}</dd>` : ""}` : "";
  const hasDeciles = IX.some((ix) => d.seifa[ix] && d.seifa[ix].dec);
  const deciles = hasDeciles ? decileRows((ix) => d.seifa[ix] && d.seifa[ix].dec) : "";
  const seatNote = `${demoCopy(m).note}${deciles ? ` 1 is the most disadvantaged tenth of the ${m.divs.length} seats, 10 the most advantaged.` : ""}`;
  /* the head names the profile — a seat profile federally, the state's own
     view on its frame (user call 2026-11-09) */
  const censusHead = STATE_YEARS.has(m.year) ? `${STATE_TITLE[stOfYear(m.year)]} view from census data` : "Seat profile from census data";
  if (d.cls || d.demo || deciles) h += `<div class="st-sec"><h3>${censusHead}</h3>${d.cls || d.demo ? `<dl class="facts">${d.cls ? `<dt>Type</dt><dd>${esc(CLS_SHORT[d.cls])}: ${esc(CLS_DEF[d.cls])}</dd>` : ""}${demoFacts}</dl>` : ""}${deciles}<p class="st-note">${seatNote}</p></div>`;
  h += historyChart(d);
  // polling places
  const b = m.booth, js = b.byDiv[i];
  const nPP = js.filter((j) => b.ty[j] === 1).length, nEV = js.filter((j) => b.ty[j] === 5).length, nMob = js.length - nPP - nEV;
  let bl = "";
  if (lensNumeric()) {
    const vals = js.map((j) => ({ j, v: boothValue(m, j) })).filter((x) => x.v != null && b.votes[x.j] >= 100).sort((p, q) => q.v - p.v);
    const fmt = (v) => (S.lens === "seifa" ? `${v}` : (S.lens === "tpp" && S.tppMode === "swing") || (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap()) ? sgn(v) : f1(v));
    const li = (arr) => `<div class="links">${arr.map(({ j, v }) => `<button type="button" data-go="booth:${j}"><i style="background:${colCss(m.boothCol[j])}"></i><span class="nm">${ds(b.name[j])}<small>${int(b.votes[j])} votes</small></span><b>${fmt(v)}</b></button>`).join("")}</div>`;
    if (vals.length >= 6) bl = `<p class="st-note">Highest</p>${li(vals.slice(0, 3))}<p class="st-note">Lowest</p>${li(vals.slice(-3).reverse())}${distBlock(m, "booths", js, { compact: true })}`;
  } else if (S.lens === "winner") {
    const led = {}; for (const j of js) if (b.lead[j]) led[b.lead[j].n] = (led[b.lead[j].n] || 0) + 1;
    bl = `<div class="counts">${[d.A, d.B].map((c) => `<span><i style="${swc(c.fam)}"></i>${ds(surname(c.n))} led <b>${led[c.n] || 0}</b></span>`).join("")}</div>`;
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
  pplThen(m); // the neighbourhood's census lanes, if the frame hasn't fetched them (it redraws this on arrival)
  const b = m.booth, D = m.divs[b.d[j]], raw = b.raw;
  const where = [b.prem[j], [b.sub[j], b.pc[j]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tc = raw.tcp[j];
  let hed = ds(b.name[j]), dek = "";
  const lead = b.lead[j];
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb, lp = (100 * Math.max(ta, tb)) / tot;
    const left = ta >= tb ? D.A : D.B, right = ta >= tb ? D.B : D.A;
    const [ln, rn] = pairNames(left, right);
    switch (S.lens) {
      case "tpp":
        if (axisNow(m) !== "AC" && S.tppMode !== "swing") {
          const v = axisBooth(m, j), [A, B] = axisCap();
          if (v != null) { const a = v >= 50; hed = `${a ? A : B} would lead ${a ? B.replace(/^The /, "the ") : A.replace(/^The /, "the ")} ${f1(Math.max(v, 100 - v))} to ${f1(Math.min(v, 100 - v))} here`; dek = `An estimate: it takes this place’s first preferences and ${axisHow(m, axisNow(m), [b.d[j]])}.`; break; }
        }
        if (!Number.isNaN(b.tpp[j])) {
          if (S.tppMode === "swing") { const s = nn(b.tppSw[j]); hed = s == null ? `This place has no swing on record` : `${pts(s)} swing to ${s >= 0 ? "Labor" : "the Coalition"} here`; dek = s == null ? "It wasn’t used at the previous election." : ""; }
          else { const t2 = b.tpp[j]; hed = `${t2 >= 50 ? "Labor" : "The Coalition"} won ${f1(Math.max(t2, 100 - t2))}% of the two-party vote here`; }
          break;
        }
      // falls through when there's no two-party count
      default:
        hed = `${ds(ln)} won this place ${f0(lp)}–${f0(100 - lp)}`;
        dek = `${Number.isFinite(b.votes[j]) ? `${int(b.votes[j])} votes were cast here, ${f1(b.infPct[j])}% informal.` : `${int(b.formal[j])} formal votes were recorded here; the informal count is unavailable.`} Across ${ds(D.n)}, ${ds(surname(D.win.n))} won ${f1(D.winPct)}–${f1(100 - D.winPct)}.`;
        void rn;
    }
    if (S.lens === "fp") { const v = b.fp[S.party][j]; hed = `${famLeg(S.party)} won ${f1(v)}% of first preferences here`; dek = `In ${ds(D.n)} as a whole, ${f1(D.fp[S.party])}%.`; }
    if (S.lens === "senate") {
      const v = senBoothValue(m, j), dv = senDivValue(m, D);
      if (v == null) { hed = senNoValue(m, "booth", D); dek = ""; }
      else if (senGap()) { hed = `${SUBJ[S.party]} ${senGapWords(v)} here`; dek = `${f1(svShare(svOf(m).booths[b.id[j]], S.party))}% of Senate first preferences against ${f1(b.fp[S.party][j])}% in the House.${dv != null ? ` Across ${ds(D.n)} the gap was ${sgn(dv)} points.` : ""}`; }
      else { hed = `${SUBJ[S.party]} won ${f1(v)}% of the Senate vote here`; dek = dv != null ? `In ${ds(D.n)} as a whole, ${f1(dv)}%.` : ""; }
    }
    if (S.lens === "senpref") {
      const v = spBoothValue(m, j), dv = spDivValue(m, D);
      if (v == null) { hed = spNoValue(m, "booth", D); dek = ""; }
      else { const c = spCells(spOf(m).booths[b.id[j]]); hed = `${f0(v)}% of ${spWho()} Senate voters here ranked ${spA()} ahead of ${spB()}`; dek = `${int(c.x + c.y)} of their ballots here numbered either party.${dv != null ? ` In ${ds(D.n)} as a whole, ${f0(dv)}%.` : ""}`; }
    }
    if (S.lens === "informal") {
      if (infModeOf(m) === "exhaust") { hed = `${f1(D.exhPct)}% of ${ds(D.n)}’s ballots exhausted before the final two`; dek = "New South Wales re-counts ballots by district, not by polling place — the rate shown is the district’s."; }
      else { hed = Number.isFinite(b.infPct[j]) ? `${f1(b.infPct[j])}% of ballots here were informal` : "This place has no informal count on record"; dek = `In ${ds(D.n)} as a whole, ${f1(D.infPct)}%.`; }
    }
    if (S.lens === "seifa" && isDemo()) {
      const k = S.index, dv = D.demo && demoShare(D);
      // the income median says its own dollars at the place itself: a
      // share-shaped template was never the right frame for it
      if (incMed()) {
        const v = raw.medinc ? raw.medinc[j] : null;
        hed = v == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure")
          : `The median household near here earns ${mny(v)} a week`;
        dek = v == null ? "" : `In ${ds(D.n)} as a whole, ${mny(dv != null ? dv : null)} a week${dv != null ? incEpoch(m) : ""}. ${demoBoothCopy(m).note}`;
      } else if (ageMed()) {
        const v = raw.ageMed ? raw.ageMed[j] : null;
        hed = v == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure")
          : `The median age near here is ${Math.round(v)}`;
        dek = v == null ? "" : `In ${ds(D.n)} as a whole, it's ${dv != null ? Math.round(dv) : "–"}. ${demoBoothCopy(m).note}`;
      } else {
        const v = demoBoothShare(raw, j, selPos(m)), pct = v == null ? null : 100 * v;
        hed = pct == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure") : `${f0(pct)}% ${(isInc() ? demoBoothCopy(m).whoAdults : demoBoothCopy(m).who).replace(/^of (the adults|residents)/, `of ${censusWho(m, k).pop}`)} ${censusWho(m, k).pred}`;
        dek = pct == null ? "" : `In ${ds(D.n)} as a whole, ${dv != null ? f1(100 * dv) : "–"}%. ${demoBoothCopy(m).note}`;
      }
    }
    else if (S.lens === "seifa") { const voter = seifaBasis(m) === "voters"; const arr = voter ? raw.vdec[j] : raw.dec[j]; const v = arr ? arr[IX.indexOf(S.index)] : null; hed = v ? `This place is in decile ${v} of 10 on ${IX_ABBR[S.index]}` : `This place has no ${IX_ABBR[S.index]} score`; dek = voter ? "Scored on where its voters live." : "Scored on the census area it stands in."; }
    if (S.lens === "cls") { hed = `${ds(D.n)} is ${/^[aeiou]/i.test(CLS_LOWER[D.cls] || "") ? "an" : "a"} ${CLS_LOWER[D.cls] || ""} seat`; }
  }
  // the flow hed needs no per-booth count: the NSWEC carries no booth 2CP,
  // so nsw23 booths have no lead/tcp and the copy would never render here
  if (S.lens === "flow") {
    if (m.res.flBasis === "modelled") { hed = flowSeat(D) ? `Preference flows aren’t modelled by polling place` : `No preference split is modelled in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s modelled split is a district figure — read it on the district’s card.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else if (m.res.flOpv) { hed = flowSeat(D) ? `Preference flows aren’t counted by polling place` : `No preference split was counted in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s split is a district figure — read it on the district’s card. New South Wales re-counts ballots by district, not by polling place.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else { const v = flowSeat(D) ? nn(b.flowAlp[S.from][j]) : null; hed = v == null ? `No ${S.from === "ind" ? "independent’s" : famLeg(S.from) + "’"} preferences were split here between Labor and ${vsW()}` : `${f0(v)}% of ${S.from === "ind" ? "independents’" : S.from === "oth" ? "other candidates’" : famLeg(S.from) + "’"} preferences here went to Labor`; }
  }
  // the place's figures lead its card, as a seat's do; its notes follow the finding
  let figs = "", after = "";
  /* the place's two-party swing rides its count block in the seats' figure
     form (no narrating sentence) — attached to whichever block the count
     belongs to, classical or notional */
  const swingHere = !Number.isNaN(b.tpp[j]) ? nn(b.tppSw[j]) : null;
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb, pct = (100 * Math.max(ta, tb)) / tot;
    const lw = ta >= tb ? D.A : D.B, lrun = lw === D.A ? D.B : D.A;
    const [lwn, lrn] = pairNames(lw, lrun);
    // the polling place's own count rides the same head-block idiom as the
    // seat's Final count, with the place-level winner's figure on the left;
    // the seat outcome's tag hangs off the SEAT winner's figure — the party
    // that holds the seat needn't be the place's leader
    const tagSide = D.win.fam === lw.fam ? "st-fg-l" : "st-fg-r";
    figs += `<div class="st-sec"><div class="st-stat st-secstat">${twoPartyFigures(`Final count here (margin of ${tightFmt(Math.abs(pct - 50))})`, pct, lw.fam, ds(lwn), 100 - pct, lrun.fam, ds(lrn), `<span class="st-fg ${tagSide}"><b>${seatTag(D)}</b></span>`, true, [pnmOf(lw), pnmOf(lrun)])}${D.classic ? swingFigure(swingHere) : ""}</div></div>`;
  }
  if (!Number.isNaN(b.tpp[j]) && !D.classic) {
    const coal = coalW(1).replace(/^The /, "");
    figs += `<div class="st-sec"><div class="st-stat st-secstat">${twoPartyFigures(`Two-party preferred here (notional, margin of ${tightFmt(Math.abs(b.tpp[j] - 50))})`, b.tpp[j], "alp", "Labor", 100 - b.tpp[j], "lnp", coal, "", true, ["Labor", coal])}${swingFigure(swingHere)}</div></div>`;
  }
  if (!Number.isNaN(b.tpp[j]) && swingHere == null) after += `<p class="st-note">This place wasn’t used at the previous election, so it has no swing.</p>`;
  const loc = raw.location && raw.location[j];
  if (loc) after += `<p class="st-note">Approximate location, matched by name to the AEC’s ${loc[0]} venue record${loc[1] ? ` (${esc(loc[1])})` : ""} and checked against the ${m.year} electorate boundary. The venue may have moved between elections.</p>`;
  else if (raw.lat[j] == null) after += `<p class="st-note">No reliable fixed location has been matched. This polling place’s recorded votes remain available here.</p>`;
  if (!tc) after += `<p class="st-note">No polling-place final preference count is available for this election.</p>`;
  // (a place with no count of its own has no finding: its name is already its title)
  let h = head(b.name[j], `${esc(TYPE[b.ty[j]] || "Polling place")}${where ? " · " + ds(where) : ""}`, hed === ds(b.name[j]) ? "" : hed, dek, figs);
  h += after;
  const cands = D.c.map((c, k) => ({ ...c, v: raw.v[j][k], el: false }));
  const pf = raw.prevFp ? raw.prevFp[j] : null;
  const moved = movedTo(m, D);
  const wk = D.c.indexOf(D.win);
  const winPartyOf = moved ? (c) => (c.k === wk ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  if (b.formal[j]) h += `<div class="st-sec"><h3>The candidates <small>by primary vote here. Tick = whole seat</small></h3>${candRows(cands, b.formal[j], (c) => (100 * D.c[c.k].v) / D.formal, 0, pf ? (c) => { const same = D.c.filter((x) => x.b === c.b).length === 1; return same ? (100 * c.v) / b.formal[j] - pf[c.b] : null; } : () => null, winPartyOf)}</div>`;
  const fl = raw.fl[j];
  if (fl && fl.length) { const fb = flowRows(fl.map(([ci, ta, tb]) => ({ cand: D.c[ci], ta, tb })), D.A, D.B); if (fb) h += `<div class="st-sec"><h3>Where preferences went here</h3>${fb}</div>`; }
  const dec = raw.dec[j], vdec = raw.vdec[j], dr = raw.demo && raw.demo[j], dc = demoBoothCopy(m);
  const incRow = dr ? incFact(m, { loinc: dr[6], hiqinc: dr[16], medIncWeekly: raw.medinc ? raw.medinc[j] : null }) : "";
  const origB = isCob() && raw.cob && raw.cob[j] ? raw.cob[j][m.cobPos[S.cob]] : null;
  const demoRows = dr ? `<dl class="facts">${dr[0] != null ? `<dt>Language</dt><dd>${f0(100 * dr[0])}% ${dc.who} speak a language other than English at home</dd>` : ""}${dr[3] != null ? `<dt>Origin</dt><dd>${origB != null ? `${f0(100 * origB)}% ${COB_VERB[S.cob]}` : `${f0(100 * dr[3])}% ${DM_VERB.fborn}`}</dd>` : ""}${dr[4] != null ? `<dt>Education</dt><dd>${f0(100 * dr[4])}% ${DM_VERB.uni}</dd>` : ""}${dr[5] != null ? `<dt>Work</dt><dd>${f0(100 * dr[5])}% ${DM_VERB.blue}${dr[12] != null ? `, ${f0(100 * dr[12])}% ${DM_VERB.pt}` : ""}</dd>` : ""}${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}${dr[1] != null && dr[2] != null ? `<dt>Age</dt><dd>${f0(100 * dr[1])}% are 65 or older, ${f0(100 * dr[2])}% are 20 to 34</dd>` : ""}${dr[13] != null ? `<dt>Citizenship</dt><dd>${f0(100 * dr[13])}% ${DM_VERB.noncit}</dd>` : ""}${dr[14] != null ? `<dt>Children</dt><dd>${f0(100 * dr[14])}% ${DM_VERB.bigfam}</dd>` : ""}${dr[15] != null ? `<dt>Home</dt><dd>${f0(100 * dr[15])}% ${DM_VERB.hl}</dd>` : ""}</dl><p class="st-note">${dc.note}</p>` : "";
  h += `<div class="st-sec"><h3>Neighbourhood profile from census data</h3>${dec || vdec ? decileRows((ix) => (dec ? dec[IX.indexOf(ix)] : null), (ix) => (vdec && vdec[IX.indexOf(ix)] ? ` · its voters ${vdec[IX.indexOf(ix)]}` : "")) : '<p class="st-note">No SEIFA score: this place has no fixed address, or its census area is too small to publish.</p>'}<p class="st-note">The bars score the census area the place stands in.${isState() ? "" : " From 2016, where the AEC records it, “its voters” scores the areas its voters live in."}</p>${demoRows}</div>`;
  h += `<div class="act"><button type="button" data-go="div:${D.i}">Back to ${ds(D.n)}</button><button type="button" data-listbooths>All places in ${ds(D.n)}</button></div>`;
  h += foot(m);
  return h;
}

function foot(m) {
  const src = m.year === "now" ? "AEC results for the 2025 election (event 31496) and the 2026 Farrer by-election (event 31633); members’ changes of party from the parties and the APH"
    : m.year === "nswnow" ? "NSWEC results for the 2023 state election, the 19 October 2024 Epping, Hornsby and Pittwater by-elections and the 13 September 2025 Kiama by-election; members’ moves from the Speaker’s writ notices"
    : m.year === "qldnow" ? "ECQ results for the 2024 state general election, the 2025 Hinchinbrook and 2026 Stafford state by-elections; leaders and members’ moves from Queensland Labor and the Parliament"
    : QLD_YEARS.has(m.year) ? `ECQ results for the ${yearLabel(m.year)} state election` : SA_YEARS.has(m.year) ? `ECSA results for the ${yearLabel(m.year)} state election` : NSW_YEARS.has(m.year) ? `NSWEC results for the ${yearLabel(m.year)} state election` : VIC_YEARS.has(m.year) ? `VEC results for the ${yearLabel(m.year)} state election` : WA_YEARS.has(m.year) ? `WAEC results for the ${yearLabel(m.year)} state election` : `AEC results for the ${m.year} election (event ${m.res.event})`;
  return `<p class="st-foot">${src}. ${QLD_YEARS.has(m.year) ? "ECQ boundaries; ABS census" : SA_YEARS.has(m.year) ? "ECSA boundaries; ABS census" : NSW_YEARS.has(m.year) ? "NSWEC boundaries; ABS census" : VIC_YEARS.has(m.year) ? "VEC boundaries; ABS census" : WA_YEARS.has(m.year) ? "WAEC boundaries; ABS census" : "AEC boundaries and seat types; ABS census and SEIFA"}.</p>`;
}
let storyKey = "";
function renderStory(force) {
  const m = M(); if (!m) return;
  const s = S.sel;
  if (S.view === "chamber" && S.house === "senate") {
    if (!SENM) return;
    const ss = S.ssel, key = ["senate", S.senLens, ss.level, ss.st, ss.i].join("|");
    if (!force && key === storyKey) return;
    const was = storyKey;
    storyKey = key;
    $("#story").innerHTML = storySenate(SENM);
    $("#story").dataset.lens = "senate";
    if (FS.on) fsStory(was !== key);
    return;
  }
  const key = [S.year, S.lens, S.draw, S.axis, S.tppMode, S.fpMode, S.senMode, S.party, S.from, S.vs, S.spPair, S.spFrom, S.index, S.view, s.level, s.st, s.div, s.booth, filtersKey()].join("|");
  if (!force && key === storyKey) return;
  const was = storyKey;
  storyKey = key;
  const el = $("#story");
  el.dataset.lens = S.lens;
  // the polling-place story outfits its own separator family; CSS scoping
  // below reads this instead of inferring from the lens
  el.dataset.view = s.level;
  // a state (the State filter, which is the map's state selection) is the
  // area every lens's head pools, narrowed by the Seat type filter
  el.innerHTML = s.level === "aus" ? storyArea(m, "AUS") : s.level === "state" ? storyArea(m, s.st) : s.level === "div" ? storyDiv(m, s.div) : storyBooth(m, s.booth);
  anchorGovtTag(el);
  // a second pass after the frame settles: chip width can grow a few px once
  // Commissioner lands, which is what makes the first-read clamp stale
  requestAnimationFrame(() => anchorGovtTag(el));
  // the charts fill in now, not a frame on: a block that grows after the
  // story paints moves everything below it, and a walk's hold with it
  paintMiniChamber(); hydrateDists();
  if (FS.on) fsStory(was !== key);
}
/* the govt tag rides the figures' names row, tucked INSIDE the whole head's
   content frame: its inner-section face flush with the head's content edge on
   its family's side — the first cut hung the tag outside the line with its
   FAR face against it ("…flush to the section's edge"), which read exactly
   wrong ("Labor … govt": the stamp stops AT the edge, inside it). Computed
   per render because an absolute child of the centred figures grid can only
   sample its own box's x, and the content edge anchors at the panel's line;
   rerun on resize and every story render (rAF + fonts-ready too — chip width
   grows a px or two as Commissioner lands). */
function anchorGovtTag(el) {
  const stat = el && el.querySelector(".st-stat"), fg = el && el.querySelector(".st-stat .st-fg");
  if (!stat || !fg) return;
  // left-hung classes: the head's Government-family side (alp), and the seat
  // head's winner side (its finalist always sits on the left figure)
  const left = fg.classList.contains("st-fg-alp") || fg.classList.contains("st-fg-l");
  const sb = stat.getBoundingClientRect(), tb = fg.parentElement.getBoundingClientRect();
  // an inline right is MINUS the gap between the figures' edge and the section's
  fg.style[left ? "right" : "left"] = "auto";
  fg.style[left ? "left" : "right"] = left ? `${sb.left - tb.left}px` : `${tb.right - sb.right}px`;
}
if (typeof addEventListener === "function") addEventListener("resize", () => anchorGovtTag($("#story")));
if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(() => anchorGovtTag($("#story")));

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
// (listOnly: the List view's own filters alone — the State and Seat type rows name themselves)
function filterWords(m, listOnly) {
  const w = [];
  if (S.f.margin) w.push(MARGINS[S.f.margin][2].split(",")[0].toLowerCase());
  if (S.f.cls && !listOnly) w.push(CLS_SHORT[S.f.cls].toLowerCase());
  if (S.f.win) w.push(`held by ${FAM_PL[S.f.win]}`);
  if (S.f.st && !listOnly) w.push(STATE_SHORT[S.f.st]);
  if (S.f.range) { const c = colByKey(m, S.f.range.unit, S.f.range.key); if (c) w.push(`${c.short || c.label} ${rangeText(S.f.range, c)}`); }
  return w;
}
function rangeText(r, c) { const f = c.fmt || f1; return r.loOpen ? `under ${f(r.hi)}` : r.hiOpen ? `${f(r.lo)} or more` : `${f(r.lo)} to ${f(r.hi)}`; }

/* =============================== columns ===============================
   One definition per measure serves the table, its sort, the column-head
   sparkline, the distribution chart and the range filter. */
function seatColValue(m, d, key) { const c = colByKey(m, "seats", key); return c ? c.get(d) : null; }
function boothColValue(m, j, key) { const c = colByKey(m, "booths", key); return c ? c.get(j) : null; }
// the informal lens rides its own column until the exhausted-ballot view takes over, then the generic lens column carries the district figure
const lensKey = () => (S.lens === "tpp" ? (S.tppMode === "swing" ? "swing" : "tpp") : S.lens === "informal" ? (infModeOf(M()) === "exhaust" ? "lens" : "inf") : S.lens === "winner" ? "win" : S.lens === "cls" ? "cls" : "lens");
function lensColumn(get, colOf) {
  const lab = lensShort();
  const dec = S.lens === "seifa" && !isDemo();
  // the income lens's median view prices column cells in weekly dollars
  const dol = S.lens === "seifa" && incMed();
  // the age lens's median view prices column cells in years
  const yr = S.lens === "seifa" && ageMed();
  // a signed lens (a primary's change, the Senate's gap on the House) reads as a change: diverging, no bar
  const signed = (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap());
  const scale = S.lens === "fp" || S.lens === "senate" ? (signed ? null : FPMAX[S.party]) : S.lens === "flow" || S.lens === "senpref" ? 100 : S.lens === "seifa" ? (dec ? 10 : demoRange()[1]) : null;
  // the census people lenses rank their seats into tenths on the
  // distribution chart — the SEIFA decile chart's contract on a measure with no decile
  const dem = S.lens === "seifa" && !dec;
  return { key: "lens", label: lensHead(), short: lab, get, num: S.lens !== "cls", txt: S.lens === "cls", w: "minmax(120px,1fr)", lens: true, dist: S.lens !== "cls",
    fmt: dol ? (v) => mny(v) : yr ? (v) => String(Math.round(v)) : dec ? (v) => String(Math.round(v)) : signed ? (v) => sgn(v) : f1,
    color: (v) => colorOf(v), decile: dec, qt10: dem, qtPct: dem && !(dol || yr), diverge: signed,
    html: (r) => { const v = get(r); if (v == null || Number.isNaN(v)) return `<span class="c2">–</span>`; if (S.lens === "cls") return esc(CLS_SHORT[v]); const w = scale ? clamp((100 * v) / scale, 3, 100) : 100; return `<div class="lv">${scale ? `<i style="width:${0.6 * w}px;background:${colCss(colorOf(v))}"></i>` : `<i style="width:9px;height:9px;background:${colCss(colorOf(v))}"></i>`}<span>${dol ? mny(v) : yr ? Math.round(v) : dec ? v : signed ? sgn(v) : f1(v)}</span></div>`; } };
}
const fig2 = (a, af, b, bf) => `<span class="fig"><span class="${tx(af)}">${f1(a)}</span><span style="color:var(--ink-faint)"> – </span><span class="${tx(bf)}">${f1(b)}</span></span>`;
function seatCols(m) {
  const now = isNowY(m.year);
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
/* the census lens's tenths: the seats ranked into ten bars of near-equal
   count, each spanning the values its members hold — the SEIFA chart's
   "a tenth of the seats" contract on a measure with no decile of its own.
   Membership is by RANK, never the value cuts: an integer-valued measure
   (median age) ties too often for a value cut to split evenly. */
function distData(m, unit, rows, key, target, plain) {
  const c = colByKey(m, unit, key);
  if (!c || !c.num) return null;
  const vals = [], ids = [];
  for (const r of rows) { const v = c.get(r); if (v != null && !Number.isNaN(v)) { vals.push(v); ids.push(r); } }
  if (vals.length < 3) return { c, vals, empty: true };
  // tenths only where the rows are seats and there are enough for the bars to mean a tenth each
  if (c.qt10 && unit === "seats" && !plain && vals.length >= 10) {
    const order = vals.map((v, k) => [v, k]).sort((a, b) => a[0] - b[0]), n = order.length, sorted = order.map(([v]) => v);
    const cuts = [sorted[0]];
    for (let k = 1; k < 10; k++) { const i = Math.floor((k * n) / 10); cuts.push((sorted[i - 1] + sorted[i]) / 2); }
    cuts.push(sorted[n - 1]);
    const B = { qt: true, lo: cuts[0], hi: cuts[10], w: 0, n: 10, cuts };
    const counts = new Array(10).fill(0), members = Array.from({ length: 10 }, () => []);
    order.forEach(([, k], rk) => { const b = Math.min(9, Math.floor((10 * rk) / n)); counts[b]++; members[b].push(ids[k]); });
    return { c, B, counts, members, vals, ids, unit };
  }
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
  const bw = (W - padL - padR) / B.n, gap = bw > 6 ? 2 : bw > 3 ? 1 : 0;
  // the tenths chart is ordinal (equal-width bars), so a value's x interpolates inside the bin that holds it
  const x = B.qt
    ? (v) => { if (v <= B.cuts[0]) return padL; for (let k = 0; k < B.n; k++) { if (v < B.cuts[k + 1] || k === B.n - 1) { const w2 = B.cuts[k + 1] - B.cuts[k]; return padL + (k + (w2 > 1e-9 ? clamp((v - B.cuts[k]) / w2, 0, 1) : 0.5)) * bw; } } return W - padR; }
    : (v) => padL + ((v - B.lo) / (B.hi - B.lo)) * (W - padL - padR);
  const max = Math.max(...counts, 1);
  const y = (n) => H - padB - (n / max) * (H - padT - padB);
  const r = S.f.range && S.f.range.unit === D.unit && S.f.range.key === c.key ? S.f.range : null;
  let s = "";
  const stack = D.unit === "seats" && (c.decile || B.qt);
  for (let k = 0; k < B.n; k++) {
    const n = counts[k]; if (!n) continue;
    const v0 = B.qt ? B.cuts[k] : B.lo + k * B.w, mid = B.qt ? (v0 + B.cuts[k + 1]) / 2 : v0 + B.w / 2;
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
  const ticks = B.decile ? [1, 5, 10] : B.qt ? [0, 5, 10] : d3.ticks(B.lo, B.hi, opts.compact ? 4 : 7).filter((t) => t >= B.lo && t <= B.hi);
  const fmt = c.fmt || f1;
  ticks.forEach((t, k) => { const tx0 = B.qt ? x(B.cuts[t]) : x(t); const anchor = tx0 < 14 ? "start" : tx0 > W - 14 ? "end" : "middle"; s += `<line x1="${tx0}" x2="${tx0}" y1="${H - padB}" y2="${H - padB + 4}" stroke="var(--ink-faint)"/><text x="${tx0}" y="${H - padB + 15}" text-anchor="${anchor}" font-size="11" fill="var(--ink-3)">${B.decile ? t : B.qt ? fmt(B.cuts[t]) : t === 0 && c.zero ? "0" : fmt(t).replace(/\.0$/, "")}${B.qt ? (t === B.n && c.qtPct ? "%" : "") : !B.decile && k === ticks.length - 1 && /tpp|inf|final|lens|lead/.test(c.key) && !c.diverge && c.key !== "votes" ? "%" : ""}</text>`; });
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
  if (S.lens === "senate") { const r = senArea(m, a.idx, S.party); return r ? (senGap() ? r.gap : r.sen) : null; }
  if (S.lens === "senpref") { const r = spArea(m, a.idx); return r ? r.share : null; }
  if (S.lens === "seifa" && isDemo()) return demoAreaShare(a.demo);
  if (S.lens === "flow") { let toA = 0, tot = 0; for (const i of a.idx) { const d = m.divs[i]; if (!flowSeat(d)) continue; for (const f of d.flows) if (f.cand.b === S.from) { toA += d.alpSide === 0 ? f.ta : f.tb; tot += f.ta + f.tb; } } return tot ? (100 * toA) / tot : null; }
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
    const stacked = r.unit === "seats" && (D.c.decile || D.B.qt);
    el.innerHTML = distSVG(D, W, H, r.opts) + (r.opts.compact ? `<p class="st-note">${stacked ? `Each bar is a tenth of the ${n} seats, from the ${D.c.decile ? "least advantaged" : "lowest"} on the left, split by who ${isNowY(M().year) ? "holds" : "won"} them` : `${n.toLocaleString("en-AU")} ${unitWord}. Each bar counts the ${r.unit === "seats" ? "seats" : "places"} in its range`}; choose one to pick them out${S.view === "list" ? "" : " on the " + (S.view === "chamber" ? "chamber" : "map")}.</p>` : "");
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
    const D = r.D, B = D.B, n = D.counts[k], v0 = B.qt ? B.cuts[k] : B.lo + k * B.w, v1 = B.qt ? B.cuts[k + 1] : v0 + B.w;
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
    const lo = B.qt ? B.cuts[a] : B.lo + a * B.w, hi = B.qt ? B.cuts[b + 1] : B.lo + (b + 1) * B.w;
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
/* the list's proper-name cells use the shared ds (esc + curly apostrophes) */
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
    // (State and Seat type are the page's own filter rows above, shared with the map and chamber)
    bar += sel(isNowY(m.year) ? "Held by" : "Won by", "win", ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => m.divs.some((d) => holdFam(d.hold) === f)).map((f) => [f, famLeg(f)]), S.f.win);
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
  const D = distData(m, unit, rows, c.key, 12, true); // the plain histogram: the spark's job is the distribution's shape, not ten like-sized bars
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
    case "winner": return isNowY(S.year) ? "Held by" : "Winner";
    case "tpp": return S.tppMode === "swing" ? "Swing to Labor" : axisNow(M()) !== "AC" ? `${axisCap()[0]} v ${axisNames()[1]}` : "Labor 2PP";
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} change` : `${famLeg(S.party)} primary`;
    case "senate": return senGap() ? `${famLeg(S.party)}, Senate v House` : `${famLeg(S.party)} Senate vote`;
    case "flow": return `${famLeg(S.from)} to Labor`;
    case "senpref": return `${famLeg(S.spFrom)} Senate: ${spA(true)} v ${spB()}`;
    case "informal": return infModeOf(M()) === "exhaust" ? "Exhausted ballots" : "Informal";
    case "cls": return "Seat type";
    case "seifa": return isDemo() ? (isRel() ? REL_NAME[S.rel] : isTen() ? TEN_NAME[S.ten] : isAnc() ? `${ANC_NAME[S.anc]} ancestry` : isInc() ? `Income: ${INC_SHORT[S.incMode]}` : isAge() ? `Age: ${AGE_SHORT[S.ageMode]}` : isEdu() ? `Education: ${EDU_SHORT[S.eduMode]}` : isCob() ? `Born in ${COB_SHORT[S.cob]}` : DM_SHORT[S.index]) : `${IX_ABBR[S.index]} decile`;
  }
  return "";
}
/* the lens as a list-table column head: every party coded, all of one register */
function lensHead() {
  switch (S.lens) {
    case "fp": return S.fpMode === "change" ? `${FAM_CODE[S.party]} change` : `${FAM_CODE[S.party]} primary`;
    case "senate": return senGap() ? `${FAM_CODE[S.party]} gap` : `${FAM_CODE[S.party]} Senate`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    case "senpref": return `${FAM_CODE[S.spFrom]} Senate to ${FAM_CODE[SP_PAIRS[S.spPair][0]]}`;
    default: return lensShort();
  }
}
function valueText(v, kind, ctx) {
  if (v == null) {
    switch (S.lens) {
      case "senate": return ctx ? senNoValue(ctx.m, kind, ctx.d) : "No Senate count here";
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : axisNow(M()) !== "AC" ? "These two didn’t both stand here" : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "senpref": return ctx ? spNoValue(ctx.m, kind, ctx.d) : "Too few of these ballots";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 1993 on" : "No census figure here") : "No score here";
      case "fp":
        if (S.fpMode !== "change") return "Didn’t stand";
        if (kind !== "booth") return "Didn’t stand both times";
        // a booth's null is never about the party: it's a lapsed venue (the
        // frame carries the same-place lane) or no lane existed for the year
        return ctx && ctx.m.res.booths && ctx.m.res.booths.prevFp ? "New place since last time, so no change" : "No like-for-like count on file for this election";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": {
      if (S.tppMode !== "swing" && axisNow(M()) !== "AC") { const [A, B] = axisCap(); return `${A} ${f1(v)} · ${B.replace(/^The /, "")} ${f1(100 - v)}`; }
      return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    }
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} ${sgn(v)} points` : `${famLeg(S.party)} ${f1(v)}%`;
    case "senate": return senGap() ? `${famLeg(S.party)} ${Math.abs(v) < 0.05 ? "level" : `${pts(v)} ${v > 0 ? "higher" : "lower"}`} in the Senate` : `${famLeg(S.party)} ${f1(v)}% in the Senate`;
    case "flow": return `${f0(v)}% of ${famLeg(S.from)} preferences to Labor`;
    case "senpref": return `${f0(v)}% ranked ${spA()} ahead of ${spB()}`;
    case "informal": return infModeOf(M()) === "exhaust" ? `${f1(v)}% exhausted` : `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? (incMed() ? `${mny(v)} a week, the median household income` : ageMed() ? `age ${Math.round(v)}, the median age` : `${f1(v)}% ${censusWho(M()).pop === "residents" ? censusWho(M()).pred : `of ${censusWho(M()).pop} ${censusWho(M()).pred}`}`) : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
// the search box promises as much as its width can show, never clipped mid-word
let phCtx = null;
function fitSearchPlaceholder() {
  const input = $("#q"), sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? ["Search a senator or state", "Search a senator", "Search"] : ["Search a seat, town, member or place", "Search a seat, member or place", "Search a seat or member", "Search"];
  if (!phCtx) phCtx = document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(input);
  phCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const room = input.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4;
  for (const t of list) if (phCtx.measureText(t).width <= room) { input.placeholder = t; return; }
  input.placeholder = "Search";
}
// a lens row with chips off the far edge flags itself: the fade asks to be scrolled
const lensRowEl = $(".mp-lensrow");
function lensOverflow() {
  const el = $("#lenses"); if (!el || !lensRowEl) return;
  // (the row's holder: the page's lens row, or in full screen its plate)
  el.parentElement.classList.toggle("more", el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
}
// the House's lenses, or in the Senate's chamber the Senate's own
function renderLenses() {
  // Basis now lives with the map key; retain the empty mount for fullscreen parking.
  $("#lenses").innerHTML = "";
  $("#lenses").hidden = true;
  fitSearchPlaceholder();
}

/* =============================== the legend =============================== */
let legendKey = "";
// (boothsAs: the key's measure asks for one side or the other, below)
let boothsAs = null;
const boothsShown = () => boothsAs ?? (S.view === "map" && (selDiv() != null || T.k >= K_ALL || drawOf(M()) !== "seats"));
const legendState = () => [...(panelMQ.matches ? [S.f.st, S.f.cls] : []), S.view, boothsShown(), S.draw, S.axis, S.draw === "balloons" ? Math.round(2 * Math.log2(Math.max(1, T.k / HOME.k))) : 0, S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.incMode, S.ageMode, S.eduMode, S.party, S.from, S.vs, S.spPair, S.spFrom, S.index, S.year, S.seat, S.house, S.senLens, TH && TH.dark].join("|");
// the Preferences key's source switch: the House's counted splits, or the Senate's ballots (federal years)
let lensFlip = false;
const flowSrcBtn = (m) => (STATE_YEARS.has(m.year) || (spYear(m.year) == null && S.lens !== "senpref") ? "" : ` <button type="button" class="flip" data-flip="flowsrc">${S.lens === "senpref" ? (spGvtYear(m.year) != null ? "Senate tickets" : "Senate ballots") : "Counted in the House"}<span>⇄</span></button>`);
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : axisNow(M()) !== "AC" ? [50 - axisSpan(), 50 + axisSpan()] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "senate": return senGap() ? [-10, 10] : [0, FPMAX[S.party]];
    case "flow": case "senpref": return [10, 90];
    case "informal": return [0, infHi(M())];
    case "seifa": return isDemo() ? demoRange() : [1, 10];
  }
  return null;
};
function renderLegend() {
  legendKey = legendState();
  const el = $("#legend"), m = M();
  chartSync(m); // (a chart hides the map's colour scale: set before the key is measured)
  // the key shows in all three views: the list reads the same lens values
  // (its coloured cells) as the map and chamber, so it needs the same key —
  // census measure picker, ramps and switchers included
  if (!m) { el.hidden = true; return; }
  el.hidden = false;
  // Keep the live search field (and its listeners/focus) when rebuilding controls.
  const search = SEARCH_EL;
  const searching = search && search.contains(document.activeElement);
  const basing = el.querySelector(".lg-bmenu")?.contains(document.activeElement);
  if (search && el.contains(search)) search.remove();
  el.innerHTML = senOn() ? senateLegendHTML(SENM) : legendHTML(m);
  const basis = el.querySelector(".lg-basis");
  if (basis) {
    const toolbar = document.createElement("div");
    toolbar.className = "lg-toolbar";
    basis.before(toolbar);
    toolbar.append(basis);
  }
  placeSearch();
  if (searching) $("#q").focus({ preventScroll: true });
  fitSearchPlaceholder();
  if (basing) el.querySelector("[data-basis-trigger]")?.focus({ preventScroll: true });
  renderJumpSel();
  el.style.minHeight = "";
  // (the hint line is born empty: fill it now, or the strip shrinks a line and grows back, moving the map)
  updateHint();
}
/* where the search field sits: on a laptop it shares the control panel's Base
   row; on a phone, where the panel falls below the map, it stands atop the map
   instead (a search is how a phone reader finds their seat first). Full screen
   takes it back into the panel, which its plate carries. */
const phoneMQ = typeof matchMedia === "function" ? matchMedia("(max-width: 860px)") : { matches: false };
// (held here: the strip's rebuild lifts the field out of the page for a moment)
const SEARCH_EL = $(".mp-search");
function placeSearch() {
  const sx = SEARCH_EL, stage = $("#stage"), el = $("#legend");
  if (!sx || !stage || !el) return;
  if (phoneMQ.matches && !FS.on) {
    sx.classList.add("mp-search-top");
    if (sx.nextElementSibling !== stage) stage.before(sx);
    return;
  }
  sx.classList.remove("mp-search-top");
  const tb = el.querySelector(".lg-toolbar");
  if (tb) { if (sx.parentElement !== tb) tb.append(sx); }
  else if (sx.parentElement !== el) el.prepend(sx);
}
if (phoneMQ.addEventListener) phoneMQ.addEventListener("change", () => { placeSearch(); fitSearchPlaceholder(); });
/* the key holds the height of the CURRENT lens at its tallest election, so stepping
   through the years never moves the figure (the stage below it on a wide screen, the
   timeline below it on a phone); switching lens or flip re-holds it once, which reads
   as the key's own change. A year not loaded yet is measured on a stand-in: the loaded
   year's figures with that year's own words (its seat counts, seating-plan note,
   census basis) */
const legendHeights = new Map();
const SEAT_META = new Map(); // year -> the seating plan's { plan, note }
let legendMeta = null;
function loadLegendMeta() {
  return (legendMeta ??= Promise.all([
    SUM ? null : getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); if (M()) renderStory(true); }),
    // today's Senate's senators (not its floor): its key, the tallest the Senate's gets (it alone has a seating
    // plan's row), is measured with the House's, so switching chamber moves nothing
    loadSenate("now"),
    ...[...SEATED].map((y) => getJSON(`/map/data/seats-${y}.json`).then((j) => SEAT_META.set(y, { plan: j.plan, note: j.note }))),
  ].map((p) => p && p.catch(() => {}))).then(() => { legendHeights.clear(); if (M()) renderLegend(); })); // a measure taken before the words were in is dropped
}
function legendStandIn(m, y) {
  if (Y[y] && Y[y].search) return Y[y];
  const st = Object.create(m);
  st.year = y; st.standIn = true;
  st.seating = SEATED.has(y) ? SEAT_META.get(y) || null : null;
  st.demoBasis = STATE_YEARS.has(y) ? "sa1" : y === 2013 ? "venue" : null;
  const c = S.lens === "winner" && SUM && SUM.seats[y] && SUM.seats[y].AUS;
  if (c) st.divs = Object.entries(c).flatMap(([fam, n]) => Array.from({ length: n }, () => ({ hold: { fam } })));
  return st;
}
function legendHeightOf(m, y, w, probe) {
  const real = !!(Y[y] && Y[y].search);
  // the hold is per lens and mode: stepping through the years reuses the tallest
  // measure of the CURRENT key, so the figure never moves; switching the lens (or
  // its flip) re-holds it once, which reads as the key's own change. On the map
  // it holds the taller of its two faces, seats and polling places, so zooming in
  // to the places (or out of them) never moves the stage under the reader
  const key = [w, S.view, y, real, S.lens, S.draw, S.tppMode, S.fpMode, S.senMode, S.infMode, S.index, S.cob, S.seat].join("|");
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat, year: S.year, draw: S.draw };
    let hMax = 0;
    try {
      S.year = y;
      const my = legendStandIn(m, y);
      for (const seat of S.view === "chamber" && my.seating ? ["plan", "sort"] : [keep.seat]) {
        S.seat = seat;
        // the hold is the current draw's two faces (seats · polling places), not
        // every surface's — slimmer views stop inheriting taller surfaces' peaks
        for (const bo of S.view === "map" && !(S.draw === "chart" && chartFits(my)) ? [false, true] : [false]) for (const dw of [S.draw]) {
          boothsAs = bo; S.draw = dw;
          probe.innerHTML = legendHTML(my);
          hMax = Math.max(hMax, probe.getBoundingClientRect().height);
        }
      }
    } finally { Object.assign(S, keep); boothsAs = null; }
    legendHeights.set(key, Math.ceil(hMax));
  }
  return legendHeights.get(key);
}
function holdLegendHeight(m) {
  const el = $("#legend"), w = el.clientWidth;
  if (!w) return;
  const probe = el.cloneNode(false);
  probe.removeAttribute("id"); probe.removeAttribute("hidden");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${w}px;min-height:0`;
  el.parentNode.appendChild(probe);
  let h = 0;
  try {
    for (const y of YEARS) h = Math.max(h, legendHeightOf(m, y, w, probe));
    // the Senate chamber walks its Senates with the timeline: every loaded one's
    // current-lens key joins the hold, so the switch between Senates stays quiet
    if (S.view === "chamber") for (const sm of new Set([...Object.values(SENY), SENM])) if (sm) h = Math.max(h, senLegendHeight(sm, w, probe));
  } finally { probe.remove(); }
  // (on a 4px lattice: frames load behind the reader and each can round a pixel taller, which would nudge the stage)
  el.style.minHeight = Math.ceil(h / 4) * 4 + "px";
  el.style.boxSizing = "border-box";
}
// the Senate's key, current lens, as seated and sorted
function senLegendHeight(sm, w, probe) {
  const key = `senate|${sm.year}|${w}|${S.senLens}|${S.seat}`;
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat };
    let hMax = 0;
    try {
      for (const seat of ["plan", "sort"]) {
        S.seat = seat;
        probe.innerHTML = senateLegendHTML(sm);
        hMax = Math.max(hMax, probe.getBoundingClientRect().height);
      }
    } finally { Object.assign(S, keep); }
    legendHeights.set(key, Math.ceil(hMax));
  }
  return legendHeights.get(key);
}
/* the census pickers: the ABS's advantage indexes, then the people measures,
   then the active lane's own option picker. The legend lays each line out in
   its own .lg-t block on the map and chamber; the list bar lays the same
   selects out bare in its row (the legend is hidden in the list view) */
// Every dropdown list in the control panel rides ONE idiom — the Base row's:
// the current pick's own word beside its chevron, the panel opening to its
// items (2026-11-08: native <select>s leave the panel for it)
const LG_CHEVRON = `<svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true"><path d="M1 1l3 3.2L7 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
function lgMenu(key, items, cur, aria) {
  const text = (items.find(([v]) => v === cur) || items.find(([v, t]) => t != null))[1] ?? "";
  // a curious value of `null` is a group heading, not a pickable item
  // (an item's third and fourth places: unavailable here, and why)
  const itemHtml = ([v, t, off, why]) => v === null ? `<span class="lg-mgroup">${esc(t)}</span>` : `<button type="button" data-lg-val="${key}:${v}" role="menuitemradio" aria-checked="${v === cur}" tabindex="-1"${off ? ` disabled title="${esc(why || "")}"` : ""}>${esc(t)}</button>`;
  return `<span class="lg-bmenu"><button type="button" class="st-sclab" data-lg-trigger aria-haspopup="menu" aria-expanded="false" aria-controls="lgmenu-${key}" aria-label="${aria}">${esc(text)} ${LG_CHEVRON}</button><span class="st-scm" id="lgmenu-${key}" hidden role="menu" aria-label="${aria}">${items.map(itemHtml).join("")}</span></span>`;
}
function lgMenuParts(wrap) {
  return !wrap ? null : { menu: wrap.querySelector(":scope > .st-scm"), trigger: wrap.querySelector("[data-lg-trigger],[data-basis-trigger]") };
}
function closePanelMenus() {
  for (const wrap of $$(".lg-bmenu")) {
    const m = wrap.querySelector(":scope > .st-scm"); if (m) m.hidden = true;
    wrap.querySelector("[data-lg-trigger],[data-basis-trigger]")?.setAttribute("aria-expanded", "false");
  }
}
function openPanelMenu(wrap) {
  const p = lgMenuParts(wrap); if (!p || !p.menu || !p.trigger) return;
  closePanelMenus();
  p.menu.hidden = false; p.trigger.setAttribute("aria-expanded", "true");
  (p.menu.querySelector('[aria-checked="true"]') || p.menu.querySelector("button"))?.focus();
}
// one applier for any dropdown item picked in the panel (the native select
// handler's branches verbatim)
function applyOpt(k, v) {
  // the phone panel's menus: the two filters (as their chips do), the drawing, and the jumps
  if (k === "fst") { if (v && S.f.st !== v) goState(v); else if (S.sel.level === "state") goAus(); else if (S.f.st) { S.f.st = null; filtersChanged(); } return; }
  if (k === "fcls") { S.f.cls = v || null; filtersChanged(); return; }
  if (k === "draw") return setDraw(v);
  if (k === "fjump") { const ys = FRAME_JUMPS[+v] && FRAME_JUMPS[+v][1]; if (ys && !ys.includes(S.year)) setYear(ys[ys.length - 1]); return; }
  if (k === "jump") { if (v === "towns") { S.townsOff = !S.townsOff; renderLegend(); schedule(); } else flyToCity(+v); return; }
  if (k === "axis") return setAxis(v);
  if (k === "vs") { S.vs = v; if (S.from === v) S.from = v === "onp" ? "lnp" : "onp"; }
  else if (k === "sppair") { S.spPair = v; if (!SP_DONORS[S.spPair].includes(S.spFrom)) S.spFrom = SP_DONORS[S.spPair][0]; }
  else if (k === "spfrom") S.spFrom = v;
  else if (k === "party") S.party = v; else if (k === "from") S.from = v; else if (k === "index") S.index = v; else if (k === "infm") S.infMode = v; else if (k === "incv") S.incMode = v; else if (k === "agev") S.ageMode = v; else if (k === "eduv") S.eduMode = v; else if (k === "cob") S.cob = v || null; else if (k === "rel") S.rel = v || "norel"; else if (k === "ten") S.ten = v || "mort"; else if (k === "anc") S.anc = v || "english";
  lensParamChanged();
}
function censusSelects(m, cls = "") {
  const peopleExtra = [
    ...(m.relKeys && m.relKeys.length ? [[LENS_REL, "Religion"]] : []),
    ...(m.tenKeys && m.tenKeys.length ? [[LENS_TEN, "Housing tenure"]] : []),
    ...(m.ancKeys && m.ancKeys.length ? [[LENS_ANC, "Ancestry"]] : []),
  ];
  const out = [lgMenu("index", [
    [null, "Advantage, ABS SEIFA"],
    ...ixFor(m).map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]),
    [null, "People"],
    ...dmFor(m).map((x) => [x, DM_NAME[x]]),
    ...peopleExtra,
  ], S.index, "Census measure")];
  if (isDemo()) {
    // on Household income a second picker reads the measure: the median
    // spectrum lands; the two share views sit beside it (loinc/hiinc as
    // standalone menu lanes until 2026-10-31)
    if (S.index === LENS_INC && hasInc(m)) out.push(lgMenu("incv", INC_MODES.map((k) => [k, INC_NAME[k]]), S.incMode, "Income measure"));
    // on Age the same picker reads the six views: the median-age spectrum
    // lands, the aged shares beside it (a65/a2034 as menu lanes until
    // 2026-10-31, three new brackets same day)
    if (S.index === LENS_AGE) out.push(lgMenu("agev", AGE_MODES.map((k) => [k, AGE_NAME[k]]), S.ageMode, "Age view"));
    // on Education the same picker reads the two schooling views: the
    // university share lands, the left-school-early read beside it
    // (uni/y12less as standalone menu lanes until 2026-10-31). The picker
    // appears only between reads the frame actually printed: the
    // statistics-era frames carry the qualification read alone
    {
      const eduOpts = EDU_MODES.filter((k) => !m.hasLane || m.hasLane[k] !== false);
      if (S.index === LENS_EDU && eduOpts.length > 1) out.push(lgMenu("eduv", eduOpts.map((k) => [k, EDU_NAME[k]]), S.eduMode, "Education view"));
    }
    // on Born overseas a second picker reads a birthplace country per year
    // (the year's own census-edition menu; the informal lens's own
    // measure-switcher idiom)
    if (S.index === "fborn" && m.cobKeys && m.cobKeys.length) out.push(lgMenu("cob", [["", "All overseas-born"], ...m.cobKeys.map((k) => [k, `Born in ${COB_BORN[k]}`])], S.cob, "Birthplace country"));
    // the Religion and Housing-tenure lenses' own option pickers
    // (No religion and owned-with-mortgage are the landing views)
    if (S.index === LENS_REL && m.relKeys && m.relKeys.length) out.push(lgMenu("rel", m.relKeys.map((k) => [k, REL_NAME[k]]), S.rel, "Religion"));
    if (S.index === LENS_TEN && m.tenKeys && m.tenKeys.length) out.push(lgMenu("ten", m.tenKeys.map((k) => [k, TEN_NAME[k]]), S.ten, "Housing tenure"));
    if (S.index === LENS_ANC && m.ancKeys && m.ancKeys.length) out.push(lgMenu("anc", m.ancKeys.map((k) => [k, ANC_NAME[k]]), S.anc, "Ancestry"));
  }
  return out;
}
function basisHTML() {
  const sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? SEN_LENSES : yearLenses(S.year);
  const cur = sen ? S.senLens : S.lens === "senpref" ? "flow" : S.lens;
  const label = (l) => l.id === "informal" ? "Informality" : l.label;
  const current = list.find((l) => l.id === cur) || list[0];
  return `<div class="lg-t lg-basis"><span class="lg-label" id="base-label">Base</span><span class="lg-bmenu"><button type="button" class="st-sclab" data-basis-trigger aria-haspopup="menu" aria-expanded="false" aria-controls="base-menu" aria-label="Base: ${label(current)}">${label(current)} <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true"><path d="M1 1l3 3.2L7 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button><span class="st-scm" id="base-menu" hidden role="menu" aria-labelledby="base-label">${list.map((l) => `<button type="button" data-base="${l.id}" data-base-house="${sen ? "senate" : "house"}" role="menuitemradio" aria-checked="${cur === l.id}" tabindex="-1">${label(l)}</button>`).join("")}</span></span></div>`;
}
function legendHTML(m) {
  const prev = isNowY(m.year) ? m.res.prev : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => lgMenu(name, list, cur, name);
  const partyOpts = famEraOpts(m).map((f) => [f, famLeg(f)]);
  // the Draw switch leads the strip's close on the map view — its note right after
  const drawRow = S.view === "map" ? drawRowHTML(m) : "";
  // the chamber view chooses its chamber first
  let h = (S.view === "chamber" ? houseSwitchHTML() : "") + basisHTML();
  switch (S.lens) {
    case "winner": {
      break;
    }
    case "tpp": {
      const sw = S.tppMode === "swing", pair = axisNow(m);
      h += `<div class="lg-t">Two-party preferred: <button type="button" class="flip" data-flip="tpp">${sw ? `swing since ${prev}` : "share"}<span>⇄</span></button></div>`;
      // as balloons or a surface, where One Nation stood widely, the two parties can be another two
      if (!sw && S.view === "map" && S.draw !== "seats" && axisFrame(m) != null) h += `<div class="lg-t lg-contest">${opt("axis", S.axis, axisOpts(m))}<span>${pair === "AC" ? "counted" : "estimate"}</span></div>`;
      if (pair !== "AC") break;
      if (boothsOn && sw) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "fp": {
      const ch = S.fpMode === "change";
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} first preferences: <button type="button" class="flip" data-flip="fp">${ch ? `change on ${prev}` : "share"}<span>⇄</span></button></div>`;

      h += `<div class="lg-note">Australia: ${ch ? sgn(aus.fpSw[S.party]) + " points" : f1(aus.fp[S.party]) + "%"}.</div>`;
      if (boothsOn && ch && m.res.booths && m.res.booths.prevFp) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "senate": {
      const gap = senGap(), none = svYear(m.year) == null;
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} <button type="button" class="flip" data-flip="sen">${gap ? "Senate less House" : "Senate share"}<span>⇄</span></button></div>`;

      if (none || gap || (boothsOn && svYear(m.year) === 2004)) h += `<div class="lg-note">${none ? "A state election: there was no Senate vote." : `${gap ? "Drawn where the party stood for the House." : ""}${boothsOn && svYear(m.year) === 2004 ? " The AEC published no 2004 Senate counts by polling place." : ""}`}</div>`;
      break;
    }
    case "flow": {
      // Labor's rival in the final: the Coalition, or One Nation where the year has such finals on file;
      // the groups whose preferences can be read are the other parties'
      const from = [["grn", "the Greens’"], S.vs === "onp" ? ["lnp", STATE_YEARS.has(m.year) ? "the Liberals’" : "the Coalition’s"] : ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]];
      h += `<div class="lg-t">Where ${opt("from", S.from, from)} preferences went${hasVsOnp(m) ? `, Labor v ${opt("vs", S.vs, [["lnp", STATE_YEARS.has(m.year) ? "the Liberals" : "the Coalition"], ["onp", "One Nation"]])}` : ""}${flowSrcBtn(m)}</div>`;

      const fe = m.res.flBasis === "modelled" ? flowErrOf(m, S.from) : null;
      if (fe) h += `<div class="lg-note">Modelled estimates — South Australia publishes no per-candidate splits. ${fe.seat ? `Nine in ten of the model’s per-seat estimates land within ${f0(fe.v)} points of a counted split.` : `Labor v One Nation splits are checked only in total, to within about ${f0(fe.v)} points, never seat by seat.`}</div>`;
      if (m.res.flOpv) h += `<div class="lg-note">Counted, not modelled — New South Wales re-counted every ballot paper. Preferences there are optional, so a ballot can exhaust before the final two; a share reads the ballots that reached them.</div>`;
      break;
    }
    case "senpref": {
      const none = spYear(m.year) == null, gvt = spGvtYear(m.year) != null;
      h += `<div class="lg-t">How ${opt("spfrom", S.spFrom, spDonorOpts())} Senate ${gvt ? "tickets put" : "voters ranked"} ${opt("sppair", S.spPair, SP_PAIR_OPTS)}${flowSrcBtn(m)}</div>`;

      h += `<div class="lg-note">${spYear(m.year) == null ? "A state election has no Senate-ballot preference record here." : none ? "No Senate preference record before 2004 — group tickets are published from then, every ballot's own order only from 2016." : gvt ? `Lodged group voting tickets, ${m.year} — the order a party-box vote copied that year; how voters numbered their own papers is published only from 2016.` : STATE_YEARS.has(m.year) ? "Every formal upper-house ballot in New South Wales, by which of the two it numbered first; ballots numbering neither are set aside." : "Every formal Senate ballot, by which of the two it numbered first; ballots numbering neither are set aside."}</div><div class="lg-note"><span class="lg-hatch"></span>Fewer than ${SP_MIN} of these ballots name either</div>`;
      break;
    }
    case "informal": {
      const exh = infModeOf(m) === "exhaust";
      // the exhausted view is offered only where the count is optional-preferential —
      // like the census switcher, the same legend swaps measure under the lens
      const opts = m.res && m.res.flOpv ? lgMenu("infm", [["informal", "Informal"], ["exhaust", "Exhausted ballots"]], S.infMode, "Informal lens view") : "";
      h += `<div class="lg-t">${opts}${exh ? "ballots exhausting before the final two" : "Informal ballots"}</div>`;
      if (exh) h += `<div class="lg-note">Share of formal ballots that ran out of preferences — New South Wales votes optional-preferential, so a ballot leaves the count when its numbered candidates are gone. ${stNameCap(m.year)}: ${f1(aus.exhPct)}%.</div>`;
      else h += `<div class="lg-note">Australia: ${f1(aus.infPct)}%.</div>`;
      break;
    }
    case "cls":
      break;
    case "seifa": {
      // the census pickers come from the shared builder: the list bar lays
      // the same selects out too (this legend is hidden in the list view)
      for (const s of censusSelects(m)) h += `<div class="lg-t">${s}</div>`;
      if (isDemo()) {
        const early = m.year !== "now" && m.year < DEMO_FROM;
        // the Areas drawing keys off the pack's own per-lane extents (a
        // population-weighted 99.5th percentile rounded up), never the seats'
        // caps; a lane's little histogram is the SEATS' spread, so it stays out
        const arOn = drawOf(m) === "areas" && AR.packOf != null && AR.pack, arLane = arOn && areasLane();
        const arCap = arOn && arLane && arOn.caps[arLane];
        const [lo, hi] = arCap || demoRange();
        // an income lane can arrive by hash on a year whose store carries
        // none (income starts 2001); it reads as its own kind of early
        const noInc = isInc() && !hasInc(m);

        // the Australia's-line marker: pooled shares as ever; the Age
        // family's median and three new views ride the ageCuts record
        // (medians and pool-computed national reads, never pooled here)
        const ausShare = isAge()
          ? (S.ageMode === "med" ? (m.ageCuts && m.ageCuts.medAge) : (["a1824", "a3554", "a75"].includes(S.ageMode) ? (m.ageCuts && m.ageCuts[S.ageMode]) : (aus.demo && demoAreaShare(aus.demo))))
          : (aus.demo && demoAreaShare(aus.demo));
        // the median lanes price their axes in dollars and years; every
        // other people lane reads percentages
        const demoTick = incMed() ? (v) => `${mny(v)}${v === hi ? "+" : ""}` : ageMed() ? (v) => `${Math.round(v)}${v === hi ? "+" : ""}` : (v) => `${v}%${v === hi ? "+" : ""}`;
        // the income lanes' note names their own cut in the census
        // year's dollars — the median spectrum reads the national
        // household line straight — then the same census-basis tail
        // (interpolated years name the blend, never one epoch)
        const incEpochBrk = `${m.demoInterp ? " (census-year dollars)" : m.incomeCuts && m.incomeCuts.dollarsYear ? ` (${m.incomeCuts.dollarsYear} dollars)` : ""}`;
        // a frame without a national median record (the state frames'
        // GCP lanes today) shows the seats' medians only — the note says
        // why the places carry none
        const incMedNote = m.incomeCuts && m.incomeCuts.medWeekly == null ? "; this frame doesn't carry a national line or median-figure reads for individual places" : "";
        // the era print's own households-basis lane names it — only the
        // GCP-era lanes are adult shares
        const incHouse = m.incomeCuts && m.incomeCuts.basis === "households";
        const incNote = incMed()
          ? `Median weekly household income${incEpochBrk}${incMedNote}`
          : `${incHouse ? "Share of households" : "Share of adults in households"} earning ${S.incMode === "lo" ? incLoFrag(m) : incHiQFrag(m)}${incEpochBrk}`;
        // the Age family's per-view notes: the median names its band
        // interpolation, the 18–24 view admits its 15–19 estimate, and a
        // frame without the band dicts says why the new views are empty
        const AGE_NOTE = { med: "Median resident age, interpolated from census age bands", a1824: "Share of residents aged 18 to 24 (the 18–19 share of the 15–19 band)", a2034: "Share of residents aged 20 to 34", a3554: "Share of residents aged 35 to 54", a65: "Share of residents aged 65 and over", a75: "Share of residents aged 75 and over" };
        const ageMedNote = m.ageCuts == null && !(S.ageMode === "a65" || S.ageMode === "a2034") ? "; this frame doesn't carry the census age bands this view needs" : "";
        const ageNote = AGE_NOTE[S.ageMode] + (ageMedNote || "");
        // the 2026-10-31 lane notes: each carries its basis the way the
        // older lanes do (the older lanes' honest phrasing is part of
        // the lane-set's contract now)
        const PT_SINGLE = "Share of employed people whose ONE listed method of travel to work was train, bus or ferry+tram — the 1991 census's journey-to-work print keeps a single method per worker (no multi-method legs before the 1996 edition)";
        const NOTE_ARC = {
          pt: "Share of employed people who travelled to work by train, bus, tram or ferry — any one or more of those legs",
          noncit: "Share of residents not listed as Australian citizens (the census doesn't break out a not-stated share separately here: they're inside the complement)",
          bigfam: "Share of women aged 15+ who have had more than two children",
          hl: "Share of residents counted homeless in the ABS's census estimate, measured per SA2 statistical area (coarser than the other census measures)",
        };
        const ptNote = m.demoInterp && m.demoInterp.c0 === 1991 ? PT_SINGLE : NOTE_ARC.pt;
        const headNote = isInc() ? incNote
          : isAge() ? ageNote
          : isEdu() ? EDU_NOTE[S.eduMode]
          : isCob() ? `Share of residents born in ${COB_NAME[S.cob]}`
          : isRel() ? `Share of residents who ${RELISMS[S.rel]}`
          : isTen() ? `Share of dwellings that ${TENESMS[S.ten]}`
          : isAnc() ? `Share of residents who ${ANCISMS[S.anc]} (people could name up to two ancestries, so the options don't add up to a whole)`
          : S.index === "pt" ? ptNote
          : NOTE_ARC[S.index] || `Share of ${censusWho(m).phrase}`;
        const basisTail = m.demoInterp ? `interpolated between the ${m.demoInterp.c0} and ${m.demoInterp.c1} censuses to election day${m.demoBasis === "venue" ? `, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in` : `, where each ${boothsOn ? "place’s" : "seat’s"} voters live`}.` : m.demoBasis === "venue" ? `${m.year < 2004 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        // a birthplace sub-view's tail ignores the blend epoch (cob rides
        // the measured census — 2004's measured side is the 2001 census)
        const cobTail = m.demoBasis === "venue" ? `${m.year < 2007 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        // the Areas drawing names its own ground: the census's areas as counted
        const arTail = arOn ? `${areasVintage(m)} census, as counted in each of the census’s own areas${m.demoInterp && m.demoInterp.nearestSide === areasVintage(m) ? " (this frame’s figures blend two censuses — the areas paint the nearest single one)" : ""}.` : null;
        h += `<div class="lg-note">${early ? "Census people figures start at the 1993 election: 1993, 1996 and 1998 read blended census shares over the two censuses that bracket each election; 2001 reads its own census; 2004 to 2019 blend between the two censuses that bracket them; 2022 reads the 2021 census." : noInc ? "Income figures follow the era prints — the 1991 household share (weekly-equivalent) on the 1993 and 1996 elections, 2001 onward per-adult (the 1996 census prints no household-income table at all): 2001 to 2013 read the census areas the polling places stand in, from 2016 they follow the voters." : `${headNote}${headNote.endsWith(")") || headNote.endsWith('"') || headNote.endsWith(".") ? " " : ", "}${arOn ? arTail : isCob() ? cobTail : basisTail}${aus.demo && ausShare != null ? ` ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}: ${incMed() ? mny(ausShare) : ageMed() ? Math.round(ausShare) : `${f1(ausShare)}%`}.` : ""}`}</div>`;
        break;
      }
      const arSf = drawOf(m) === "areas" && AR.packOf != null && AR.pack;
      h += arSf ? `<div class="lg-note">Each census area with the ABS’s own national decile for its SA1, as published with the ${areasVintage(m)} census — the areas ranked into tenths across Australia, not this sheet’s seats into tenths of themselves.</div>`
        : boothsOn ? `<div class="lg-note">Places scored ${seifaBasis(m) === "voters" ? "where each place’s voters live" : "on the census areas they stand in"}.</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  // the two filters, State and Seat type, in every view (map, chamber, list) — on a
  // phone, with the map's Draw and Jump to, as one tidy grid of menus instead
  const tight = panelMQ.matches;
  h += tight ? compactPanelHTML(m) : filterHTML(m);
  // in the chamber, a year with a seating plan can show the members where they sit or sorted by the lens
  if (S.view === "chamber" && m.seating) {
    const md = seatMode(m);
    const by = { winner: "winning share", tpp: S.tppMode === "swing" ? "swing" : "two-party share", fp: "primary vote", flow: "preference flow", informal: "informal vote", cls: "seat type", seifa: "census measure" }[S.lens];
    h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s seating plan of ${m.seating.plan}${m.seating.note ? `, ${m.seating.note}` : ""}.` : `By ${by}, each side from the Speaker’s end.`}</span></div>`;
  }
  if (S.view !== "map" && boothsOn && drawOf(m) !== "balloons") h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  if (S.view === "map") {
    if (!tight) h += jumpHTML() + drawRow;
    // the note on the picture follows the row that picks the picture (user
    // call 2026-11-08: no note floats above Draw); the hint the strip's close
    h += drawNoteHTML(m);
    // the flow lens's "final two weren't…" key is a bottom-of-panel line too (user call)
    if (S.lens === "flow") h += `<div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and ${vsW()}</div>`;
    // the zoom hint rides the strip too, off the stage's top-left overlay with
    // the cities — re-rendered fresh every write, and updateHint fills it by id
    h += `<div class="lg-hint mp-hint" id="hint"></div>`;
    // the polling-places key forms the control panel's tail under the Draw row
    // once polling places are on the picture — zoomed deep enough, or equally
    // by its draw (seats) or a chosen seat (user call, 2026-11-08)
    if (boothsOn && drawOf(m) !== "balloons" && (drawOf(m) === "seats" || selDiv() != null || T.k >= K_ALL)) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  }

  return h;
}

/* =============================== the timeline =============================== */
let SUM = null;
let tlCtx = null; // shared canvas context for measuring stop-label widths
/* one dated rung for the selected jurisdiction alone, in the top rail's old
   spot (rows declared federal, Vic, NSW, SA, Qld, WA — the rowIx order); each
   stop at its date on the one scale */
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 54, m = M();
  // the rail's left anchor is the years list's own head – 2004 when the span
  // opened there, 2001 now: a year before the literal anchor used to render
  // off the left edge with a NaN-ish hit rect (the 2001 stop the first day)
  const FED0 = YEAR_X[YEARS_FED[0]] ?? YEARS_FED[0];
  const X = (y) => 22 + ((xOfYear(y) - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  const NX = (nx) => 22 + ((nx - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  // a state row's cursor: its own previous elections (2018/2019 before the frames
  // open, 2022 on the SA row is sa22, not the federal 2022), then the frames' spots
  const STATE_ROW_PREV_X = { sa: SA_PREV_X, nsw: NSW_PREV_X, vic: VIC_PREV_X, qld: QLD_PREV_X, wa: WA_PREV_X };
  const stGx = (st) => (ry) => NX(STATE_ROW_PREV_X[st][ry] ?? YEAR_X[st + String(ry).slice(2)] ?? ry);
  const short = W < 560, cur = S.year;
  /* only the selected jurisdiction's rung draws at a time, so the rows all
     collapse onto the one band — the position the top (federal) rail sat in:
     the rail a shade under the strip's middle, its labels tucked under it */
  const TOP = 2, BASE = H - 23;
  const rows = [
    { ys: YEARS_FED, base: BASE, top: TOP },
    { ys: YEARS_VIC, base: BASE, top: TOP, gx: stGx("vic") },
    { ys: YEARS_NSW, base: BASE, top: TOP, gx: stGx("nsw") },
    { ys: YEARS_SA, base: BASE, top: TOP, gx: stGx("sa") },
    { ys: YEARS_QLD, base: BASE, top: TOP, gx: stGx("qld") },
    { ys: YEARS_WA, base: BASE, top: TOP, gx: stGx("wa") },
  ];
  const rowIx = (y) => (VIC_YEARS.has(y) ? 1 : NSW_YEARS.has(y) ? 2 : SA_YEARS.has(y) ? 3 : QLD_YEARS.has(y) ? 4 : WA_YEARS.has(y) ? 5 : 0);
  // a rung belongs to the selected election alone — the rest of the timeline steps aside
  const activeIx = rowIx(m ? m.year : cur);
  const sd = m ? selDiv() : null;
  let g = "";
  for (const r of rows.filter((_, i) => i === activeIx)) g += `<line x1="0" x2="${W}" y1="${r.base}" y2="${r.base}" stroke="var(--line)"/>`;
  // the glyph above a stop: the House's make-up, or the chosen seat's two-party line
  if (sd != null && m) {
    const d = m.divs[sd], hh = d.h, row = rows[rowIx(m.year)];
    const gx = row.gx || X;
    const vs = hh.map((r) => r[1]).filter((v) => v != null);
    let lo = Math.min(...vs, 50) - 3, hi = Math.max(...vs, 50) + 3;
    if (hi - lo < 16) { const c = (lo + hi) / 2; lo = c - 8; hi = c + 8; }
    const yv = (v) => row.base - 6 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (row.base - 8 - row.top);
    const pl = hh.filter((r) => r[1] != null && !r[4]).map((r) => `${gx(r[0]).toFixed(1)},${yv(r[1]).toFixed(1)}`).join(" ");
    g += `<line x1="0" x2="${W}" y1="${yv(50)}" y2="${yv(50)}" stroke="var(--line)" stroke-dasharray="2 3"/><polyline points="${pl}" fill="none" stroke="var(--ink-faint)" stroke-width="1.4"/>`;
    for (const r of hh) {
      const cy = r[1] != null ? yv(r[1]) : yv(50);
      // a by-election stop glues to its frame's "now" stop, on its own row
      g += `<circle cx="${r[4] ? X(isNowY(cur) ? cur : "now") : gx(r[0])}" cy="${cy}" r="${(r[4] ? (isNowY(cur) ? cur : "now") : r[0]) === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${ds(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (isNowY(cur) && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X(cur)}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${holdFam(m.divs[sd].hold)})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    // in the Senate's chamber each stop reads that election's upper house
    const sen = senOn();
    const st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
    // as the rail and the labels do, the bars draw on the selected election's row alone
    for (const r of rows.filter((_, i) => i === activeIx)) {
      // as wide as the row's closest two stops allow (2025 and Now sit close on a phone)
      const xs = r.ys.map(X), bw = Math.min(30, ...xs.slice(1).map((x, j) => x - xs[j] - 4));
      for (const y of r.ys) {
        // (a state election's House from the facts stamped into the script: summary.json is federal)
        const s = sen ? SENY[y] && senCounts(SENY[y], (d) => st === "AUS" || d.st === st) : SUM.seats[y] ? SUM.seats[y][st] : st !== "NSW" && META_FACTS.mix && META_FACTS.mix[y]; if (!s) continue;
        const tot = sum(Object.values(s)), x = X(y) - bw / 2;
        let acc = 0;
        // the make-up bar hugs its own row's line: the SA row's read sits with
        // the state's stops, not midway to the federal labels
        for (const f of ["alp", "grn", "ind", "oth", "onp", "lnp"]) { const n = s[f] || 0; if (!n) continue; const w = (bw * n) / tot; g += `<rect x="${(x + acc).toFixed(2)}" y="${r.base - 10}" width="${Math.max(0.6, w - 0.6).toFixed(2)}" height="8" fill="var(--m-${f})" opacity="${y === cur ? 1 : 0.62}"/>`; acc += w; }
      }
    }
  }
  /* the stops' labels sit on their row; a pair whose boxes touch nudge apart a
     little (2025 and Now on a phone), never far from the stop they name */
  if (!tlCtx) tlCtx = document.createElement("canvas").getContext("2d");
  tlCtx.font = `400 12px ${getComputedStyle(el).fontFamily}`;
  const tW = (s) => tlCtx.measureText(s).width;
  const tlStops = (ys) => ys.map((y) => ({ y, lab: isNowY(y) ? (short || y === "now" ? "Now" : yearLabel(y)) : short ? (typeof y === "number" ? "’" + String(y).slice(2) : "’" + String(y).slice(-2)) : yearLabel(y) }));
  const rowsOf = [
    { i: 0, items: tlStops(YEARS_FED) },
    { i: 1, items: tlStops(YEARS_VIC) },
    { i: 2, items: tlStops(YEARS_NSW) },
    { i: 3, items: tlStops(YEARS_SA) },
    { i: 4, items: tlStops(YEARS_QLD) },
    { i: 5, items: tlStops(YEARS_WA) },
  ];
  for (const R of rowsOf) {
    if (R.i !== activeIx) continue; // only the selected jurisdiction's rung shows
    const r = rows[R.i], labY = r.base + 15;
    const its = R.items.map((t) => ({ ...t, x: NX(xOfYear(t.y)), w: tW(t.lab), dx: 0, on: t.y === cur }));
    for (const t of its) { t.dx = -t.w / 2; }
    for (let k = 0; k < 4; k++) for (let i = 1; i < its.length; i++) {
      const a = its[i - 1], b = its[i], gap = b.x + b.dx - (a.x + a.dx + a.w);
      if (gap < 6) { const push = Math.min(6 - gap, 12), pa = Math.min(push / 2, 6), pb = Math.min(push - pa, 6); a.dx -= pa; b.dx += pb; }
    }
    // each state row named at its empty start, as a caption — never a stop
    if (R.i) {
      const x0 = its.length ? its[0].x - 24 : W;
      if (x0 > (short ? 30 : 110)) g += `<text class="yr row" x="0" y="${labY}" text-anchor="start">${short ? stOfYear(r.ys[0]) : stNameCap(r.ys[0])}</text>`;
    }
    for (const [i, t] of its.entries()) {
      const lx = t.x + t.dx + t.w / 2;
      // Split adjacent touch areas between their visible labels. Fixed-width
      // targets overlap on phones and let a later year intercept an earlier tap.
      const centre = (v) => v.x + v.dx + v.w / 2;
      const hitLeft = i ? Math.max(lx - 24, (centre(its[i - 1]) + lx) / 2) : lx - 24;
      const hitRight = i + 1 < its.length ? Math.min(lx + 24, (lx + centre(its[i + 1])) / 2) : lx + 24;
      // the one visible rung takes the whole strip's height as its touch window
      const hitTop = 0, hitBot = H;
      const uline = t.on ? `<line x1="${lx - t.w / 2}" x2="${lx + t.w / 2}" y1="${labY + 2}" y2="${labY + 2}" stroke="var(--ink)" stroke-width="2"/>` : "";
      g += `<g class="stop" data-year="${t.y}" style="cursor:pointer"><rect class="hit" x="${hitLeft}" y="${hitTop}" width="${hitRight - hitLeft}" height="${hitBot - hitTop}"/><line x1="${t.x}" x2="${t.x}" y1="${r.base - 3}" y2="${r.base + 3}" stroke="${t.on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${t.on ? " on" : ""}" x="${lx}" y="${labY}" text-anchor="middle">${esc(t.lab)}</text>${uline}</g>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Federal elections ${YEARS[0]} to now, and Victorian, New South Wales, South Australian, Queensland and Western Australian state elections; choose one">${g}</svg>`;
  // the strips follow the frame and the selection
  renderJumpSel();
  if (FS.on) fsRail();
}

/* The page's two filters, one row each, the same in every view and every lens:
   State (the map's state selection: it frames the map on that state) and Seat
   type (the AEC's classes: the seats outside it dim wherever they're drawn).
   Each has its own "All"; on together they intersect, and the head's figures,
   the chambers and the list all read the same pair. A state election has one
   state and no seat types, so neither row shows there; an election before the
   AEC classed its seats has no Seat type row. On the Seat type lens the type
   chips carry the lens's colours, so the row is its key as well. */
function filterHTML(m) {
  if (!m || STATE_YEARS.has(m.year)) return "";
  const st = S.f.st || "", cls = S.f.cls || "";
  // (each label wears its bold twin, so a pressed chip never shoves its row along)
  const chip = (attr, v, on, label, sw) => `<button type="button" ${attr}="${v}" aria-pressed="${on}">${sw || ""}<span class="tw" data-t="${label}">${label}</span></button>`;
  const states = `<div class="lg-jump lg-filter" id="state-filters" role="group" aria-label="Filter by state or territory"><b>State</b>${chip("data-state", "", !st, "All")}${CITIES.map(([, s2]) => chip("data-state", s2, st === s2, STATE_ABBR[s2] || s2)).join("")}</div>`;
  const kinds = CLS.map((c, k) => [c, k]).filter(([c]) => m.divs.some((d) => d.cls === c));
  const types = kinds.length ? `<div class="lg-jump lg-filter lg-typefilter" id="type-filters" role="group" aria-label="Filter by seat type"><b>Seat type</b>${chip("data-cls", "", !cls, "All")}${kinds.map(([c, k]) => chip("data-cls", c, cls === c, esc(CLS_SHORT[c]), S.lens === "cls" ? `<i style="background:${css(TH.cls[k])}"></i>` : "")).join("")}</div>` : "";
  return states + types;
}
/* a phone's control panel: the chip rows (State, Seat type, the map's Draw and
   Jump to) become four menus in a two-by-two grid, their labels in columns —
   the same choices, a line each instead of a wrapping row each. The city names
   toggle rides the Jump to menu. */
const panelMQ = typeof matchMedia === "function" ? matchMedia("(max-width: 560px)") : { matches: false };
if (panelMQ.addEventListener) panelMQ.addEventListener("change", () => { if (M()) renderLegend(); });
function compactPanelHTML(m) {
  const pairs = [];
  if (!STATE_YEARS.has(m.year)) {
    pairs.push(["State", lgMenu("fst", [["", "All"], ...CITIES.map(([, st]) => [st, STATE_ABBR[st] || st])], S.f.st || "", "Filter by state or territory")]);
    const kinds = CLS.filter((c) => m.divs.some((d) => d.cls === c));
    if (kinds.length) pairs.push(["Seat type", lgMenu("fcls", [["", "All"], ...kinds.map((c) => [c, CLS_SHORT[c]])], S.f.cls || "", "Filter by seat type")]);
  }
  if (S.view === "map") {
    pairs.push(["Draw", lgMenu("draw", drawOpts(m).map(({ k, t, why }) => [k, t, !!why, why]), drawOf(m), "Draw the map as")]);
    const j = stOfYear(S.year);
    pairs.push(["Jump to", lgMenu("jump", [[null, "City"], ...CITIES.map(([n, st], k) => (!j || st === j ? [String(k), n] : null)).filter(Boolean), [null, "On the map"], ["towns", S.townsOff ? "Show city names" : "Hide city names"]], "", "Go to a city")]);
  }
  return pairs.length ? `<div class="lg-cgrid">${pairs.map(([l, c]) => `<span class="lg-label">${l}</span><span class="lg-cg">${c}</span>`).join("")}</div>` : "";
}
/* the City-names toggle: both its words stand in the one box (the shown one
   on top), each at its bold width, so flipping it moves nothing — not the
   row, not the strip, so never the map under it */
function townsToggleHTML(on) {
  const w = (t, show) => `<span class="lg-jt-w"${show ? "" : ' aria-hidden="true"'}><span class="tw" data-t="${t}">${t}</span></span>`;
  return `<button type="button" class="lg-jtoggle" data-towns aria-pressed="${on}">${w("Hide city names", on)}${w("Show city names", !on)}</button>`;
}
/* the map's Jump-to row: cities are jump targets, independent of the filters */
function jumpHTML() {
  const j = stOfYear(S.year), on = !S.townsOff;
  const toggle = `<span class="lg-jgap"></span>${townsToggleHTML(on)}</div>`;
  const cities = CITIES.map(([n, st], k) => !j || st === j ? `<button type="button" data-city="${k}">${n}</button>` : "").join("");
  return `<div class="lg-jump" id="cities" role="group" aria-label="Go to a city"><b>Jump to</b>${cities}${toggle}`;
}
/* State filters and election links show their current selection. */
function renderJumpSel() {
  const cit = $("#cities");
  // the strip's jump row hides while a seat is chosen or the view is deep-zoomed —
  // re-fixed here because renderLegend re-creates it on every render
  if (cit) cit.hidden = S.view !== "map" || selDiv() != null || (T.k > HOME.k * 3 && S.sel.level !== "state");
  $$("#state-filters [data-state]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === (S.f.st || ""))));
  $$("#type-filters [data-cls]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cls === (S.f.cls || ""))));
  renderFrames();
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
let tipAt = null, tipClient = null; // the pointer on the map's plane, for the surface's own reading of the spot, and on the screen
const tipRefresh = () => { if (S.hover && !tip.hidden && tipClient) showTipAt(tipFor(S.hover), tipClient[0], tipClient[1]); };
function tipFor(h) {
  if (h && h.kind === "sen") return SENM ? senTip(SENM, h.i) : "";
  const m = M(); if (!h || !m) return "";
  if (h.kind === "bal") return balloonTip(m, h.g);
  const goes = h.go ? `<div class="ts">Click to go out to the island</div>` : "";
  if (h.kind === "isl") return `<div class="tn">${esc(h.isl)}</div><div class="ts">In no seat at this election</div>${goes}`;
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    // on a surface the pointer reads the spot first; the seat's own figure follows
    const here = drawOf(m) === "surface" ? SF.here : null;
    // on Areas the census's own area answers first, with its counted figure
    const arh = drawOf(m) === "areas" && AR.pack ? AR.here : null;
    const first = arh && arh.v != null
      ? `<div class="tv">In ${esc(arh.sa2)}: ${esc(valueText(arh.v, "div", { m, d }))}</div><div class="ts">A census area of ${int(arh.pop)} residents, as counted at the ${areasVintage(m)} census</div>`
      : here ? `<div class="tv">Around here: ${esc(here.fam ? `${FAM_NAME[here.fam]} by ${f0(here.lead)}` : valueText(here.v, "div", { m, d }))}</div>` : "";
    return `<div class="tn">${ds(d.n)}<span>${h.isl ? esc(h.isl) + " · " : ""}${STATE_SHORT[d.st]}${sp}</span></div>${first}<div class="${here || first ? "ts" : "tv"}">${here || first ? "The whole seat: " : ""}${esc(valueText(v, "div", { m, d }))}</div><div class="ts">${ds(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>${goes}`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  const nominal = Number.isNaN(b.x[j]) ? `<div class="ts">No fixed spot: placed nominally in its seat</div>` : "";
  return `<div class="tn">${ds(b.name[j])}<span>${ds(D.n)}</span></div><div class="tv">${esc(valueText(drawOf(m) === "seats" ? boothValue(m, j) : drawValue(m, j), "booth", { m, d: D }))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>${nominal}`;
}

/* =============================== selection =============================== */
// the cls lens shelves itself rather than pinging back to winner when a state
// frame steps in: a federal frame that can hold it returns it, chip store and
// all — an explicit lens pick drops the shelf (2026-11-08)
let clsLensShelved = false;
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
  /* the State filter IS the map's state selection: a state arrived at any
     side (its chip, search, a seat's way up) turns it on, the whole frame
     again turns it off, and a seat chosen outside it lets it go. The Seat
     type filter rides on independently of the selection — the pair compounds */
  const sm = M();
  if (sm && !STATE_YEARS.has(sm.year)) {
    if (sel.level === "state") S.f.st = sel.st;
    else if (sel.level === "aus") S.f.st = null;
    else if (S.f.st && sel.st !== S.f.st) S.f.st = null;
  }
  if (!opts.keepTown) townPick = -1;
  reframe = null; // (a town's or city's flight sets its own again, after this)
  if (selDiv() !== prevDiv) quietSince = performance.now();
  S.hover = null; hideTip();
  if (opts.view && opts.view !== S.view) setView(opts.view, true);
  if (S.view === "map" && opts.fly !== false) fitSelection(opts.dur ?? 800);
  renderBack();
  renderStory(true);
  if (S.view === "list") renderList(true);
  renderFilterPill(); legendIfChanged(); updateHint(); renderTimeline(); writeURL();
  if (isPhone() && opts.scroll !== false && sel.level !== "aus") { /* the story sits under the map on a phone: nothing to scroll */ }
  schedule();
}
/* the way back from an island: to its seat on the mainland (or the country,
   for an island in no seat that year) */
const backBtn = document.createElement("button");
backBtn.type = "button"; backBtn.className = "mp-back"; backBtn.hidden = true;
$("#stage").appendChild(backBtn);
backBtn.addEventListener("click", () => { const q = islOf(M(), away), i = q ? q.seat : null; if (i != null) goDiv(i); else goAus(); });
function renderBack() {
  const m = M(), q = S.view === "map" ? islOf(m, away) : null;
  backBtn.hidden = !q;
  if (!q) return;
  const t = q.seat != null ? `Back to ${dn(m.divs[q.seat].n)}` : "Back to the mainland";
  if (backBtn.dataset.t !== t) { backBtn.dataset.t = t; backBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(t)}`; }
}
const goAus = (o) => select({ level: "aus" }, o);
const goState = (st, o) => select({ level: "state", st }, o);
const goDiv = (i, o) => { const m = M(); select({ level: "div", st: m.divs[i].st, div: i }, o); };
const goBooth = (j, o) => { const m = M(); const i = m.booth.d[j]; select({ level: "booth", st: m.divs[i].st, div: i, booth: j }, o); };
function goUp() { const s = S.sel; if (s.level === "booth") goDiv(s.div); else if (s.level === "div") goState(s.st); else if (s.level === "state") goAus(); }

/* the pill over the map names the List view's own filters (who holds a seat,
   its margin, a column's range) once they're carried onto the map; the State
   and Seat type filters show on their own rows above the map instead */
function renderFilterPill() {
  const el = $("#filterpill"), m = M();
  const on = !!(S.f.win || S.f.margin || S.f.range);
  if (!on || S.view === "list" || !m) { el.hidden = true; return; }
  const n = m.divs.filter((d) => passes(m, d.i)).length;
  const w = filterWords(m, true);
  el.innerHTML = `<span>${S.f.range && S.f.range.unit === "booths" ? "Places" : `<b>${n}</b> ${plural(n, "seat")}`}: ${esc(w.join(" · "))}</span><button type="button" data-clear>Clear</button>`;
  el.hidden = false;
}
function filtersChanged() {
  renderLegend(); renderFilterPill(); renderStory(true); if (S.view === "list") renderList(); schedule(); paintMiniChamber(); writeURL();
}
function updateHint() {
  const el = $("#hint"); if (!el) return;
  const show = S.view === "map" && selDiv() == null && (T.k < K_ALL || drawOf(M()) === "surface") && !!M();
  el.textContent = !show ? "" : drawOf(M()) === "balloons" ? "Balloons join where they’d overlap; zoom in to part them" : drawOf(M()) === "surface" ? "Hover for the reading at any spot, or choose a seat to see its polling places" : "Zoom in, or choose a seat, to see its polling places";
  el.style.opacity = show ? "1" : "0";
  // the row stays while a jump selection is live, so it can be toggled back off
  const citRow = $("#cities");
  if (citRow) citRow.hidden = S.view !== "map" || selDiv() != null || (T.k > HOME.k * 3 && S.sel.level !== "state");
  // the jump-back control lives wherever the default view no longer is
  $("#zback").hidden = !(S.view === "map" && (S.sel.level !== "aus" || T.k > HOME.k * 1.001));
}

/* =============================== search =============================== */
let sugg = [], suggAt = -1;
function runSearch() {
  const m = M(), el = $("#sugg"), q = S.q.trim(), sen = senOn();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  // (the towns ahead of the long run of polling places, which can fill the match cap)
  for (const list of sen ? [SENM.search ??= senSearchItems(SENM)] : [townSearchItems(m), m.search.items]) for (const it of list) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], sen: [], div: [], town: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" || it.k === "sen" ? 6 : 4)) g.push(it); }
  const order = ["state", "sen", "div", "town", "mp", "cand", "booth"];
  sugg = order.flatMap((k) => groups[k]);
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", sen: "Senators", div: "Seats", town: "Towns and cities", mp: isNowY(S.year) ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of order) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : it.k === "town" ? "var(--ink)" : it.k === "sen" ? colCss(SENM.divCol[it.i]) : colCss(m.divCol[it.i]);
      const sub = it.k === "town" ? townSub(m, it) : it.s;
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw${it.k === "town" ? " sw-town" : ""}" style="background:${color}"></i><span class="t">${ds(it.t)}</span><span class="s">${ds(sub)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">${sen ? "No senator or state" : "No seat, town, member or place"} matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  if (senOn()) { selectSen(it.k === "state" ? { level: "state", st: it.st } : { level: "sen", st: SENM.divs[it.i].st, i: it.i }); return; }
  const view = (it.k === "booth" || it.k === "town") && S.view === "chamber" ? "map" : undefined;
  if (it.k === "town") flyToTown(it.ti, { view });
  else if (it.k === "state") goState(it.st, { view });
  else if (it.k === "div" || it.k === "mp" || it.k === "cand") goDiv(it.i, { view });
  else goBooth(it.j, { view });
}

/* =============================== views, lenses, years =============================== */
/* chrome can leave a composited element's layer painted over the page's
   bottom band once the element has scrolled out of the window — the tide
   art then carries a stale slice of the page. First seen as the stage and
   mini-chamber canvases mis-compositing a few rows (the original fix below);
   the DESKTOP case is grosser: the whole story column (.mp-story, metres
   tall and fully off-window at the band) paints a stale slice across the
   band's full width. Killing any one canvas doesn't clear it, clipping
   does, and visibility:hidden on the column clears it with no reflow. Here
   at the band zero story children are inside the viewport, so hiding the
   whole column the moment none of it is on window costs the user nothing —
   the rAF scroll listener and resize() put it back the instant any part
   re-enters. The stage canvas is hidden only when ALL of it is off the window
   (matching the story column's own full-cull rule) — at page load the stage
   partially overlaps the viewport, and culling it then would blank the hero
   map. The mini-chamber at a ±half-viewport margin, and the list view
   hides the stage canvas outright. visibility, not display, everywhere so
   nothing reflows */
function updateCanvasVis() {
  const vh = window.innerHeight;
  const story = $("#story");
  if (story) {
    const r = story.getBoundingClientRect();
    story.style.visibility = r.bottom <= 0 || r.top >= vh ? "hidden" : "";
  }
  const stage = canvas.parentElement.getBoundingClientRect();
  canvas.style.visibility =
    S.view === "list" || (CH.el && !CH.el.hidden) || stage.bottom <= 0 || stage.top >= vh ? "hidden" : "visible";
  if (miniCh.canvas) {
    const r = miniCh.canvas.getBoundingClientRect();
    miniCh.canvas.style.visibility = r.bottom < -vh * 0.5 || r.top > vh * 1.5 ? "hidden" : "";
  }
}
function setView(v, quiet) {
  if (v === S.view) return;
  const prev = S.view;
  // the Senate has no map: into or out of its chamber the view changes without the morph
  const senate = S.house === "senate" && (prev === "chamber" || v === "chamber");
  S.view = v;
  townHits.length = 0; townHiIdx = -1;
  // (a built contest is the map's alone: the chamber and the list go back to the counted figures, colours too)
  if (S.axis !== "AC" && S.lens === "tpp" && S.draw !== "seats") recolor(false);
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (senate) { renderLenses(); if (v === "chamber") needSenateFloor(); }
  // the count word follows the view (divisions / seats / members), so the
  // eyebrow re-words on every swap even when the election stays the same
  $("#mp-meta").textContent = metaLine();
  holdEyebrow();
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#state-filters", "#cities", "#hint"]) { const e = $(id); if (e) e.hidden = v !== "map"; }
  // the zoom plate stays up in the chamber, for its full-screen button alone
  $("#zoomer").hidden = list; $("#zoomer").dataset.view = v;
  if (FS.on) fsView();
  updateCanvasVis();
  canvas.classList.toggle("grab", v === "map");
  updateTouch();
  hideTip(); S.hover = null;
  if (list) { $("#sugg").hidden = true; renderList(); }
  else {
    if (!senate && ((prev === "map" && v === "chamber") || (prev === "chamber" && v === "map"))) morph = reduceMotion ? null : { t0: performance.now(), dur: 1000, to: v };
    // the map always opens at its fit — the transform persists across views,
    // and an unfitted one lands on the country's north-west corner
    if (v === "map" && prev !== "map") fitSelection(0);
  }
  renderLegend(); renderFilterPill(); updateHint(); renderBack(); writeURL();
  if (!quiet) renderStory(true);
  schedule();
}
function setLens(id) {
  if (S.lens === id) return;
  // the Preferences tab, clicked while it reads the Senate's ballots, stays where it is
  if (id === "flow" && S.lens === "senpref" && !lensFlip) return;
  if (FED_LENS.has(id) && STATE_YEARS.has(S.year) && !(id === "senpref" && SEN_PREF_STATE_FRAMES.has(S.year))) return;
  // the Senate's votes load with their lens (about 120KB a year, gzipped)
  if (id === "senate" && svYear(S.year) != null && !SV[svYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenateVote(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s votes didn’t load. Try again."));
    return;
  }
  // ... and the Senate's ballot rankings with theirs (about 300KB a year, gzipped)
  if (id === "senpref" && spYear(S.year) != null && !SPD[spYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenatePrefs(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s ballots didn’t load. Try again."));
    return;
  }
  const hold = walkHold(takeSpot());
  S.lens = id; S.sort = null; S.dist = null;
  clsLensShelved = false; // an explicit pick drops the cls lens's shelf
  // (the State and Seat type filters belong to no lens: they stay as they are)
  if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lens === id)));
  startChamberGlide();
  recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
}
function setSenLens(id) {
  if (S.senLens === id) return;
  const hold = walkHold(takeSpot());
  S.senLens = id;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.slens === id)));
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (hold) hold.land();
}
/* the chamber view's chamber: the House or the Senate, both at the timeline's election; the two
   cross-fade, the chairs being different people */
let houseFade = null;
async function setHouse(h) {
  if (h === S.house) return;
  const spot = takeSpot(), from = CM();
  // a state election has no Senate: the one sitting then is the last federal election's
  if (h === "senate" && !SEN_YEARS.includes(S.year)) await setYear(senYearFor(S.year));
  if (h === "senate" && (!senFloor || !SENY[S.year])) {
    showLoading(true);
    try { await Promise.all([loadSenateFloor(), loadSenate(S.year)]); } catch (e) { showLoading(true, "The Senate didn’t load. Try again."); return; }
    showLoading(false);
    loadSenates();
  }
  syncSenate();
  const hold = walkHold(spot);
  S.house = h; S.hover = null; hideTip();
  chAnim = null; chLast.clear();
  houseFade = from && !reduceMotion && S.view === "chamber" ? { from, t0: performance.now(), dur: 420 } : null;
  renderLenses(); renderLegend(); renderStory(true); renderTimeline(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (hold) hold.land();
  schedule();
}
// the Senate's floor, fetched the first time its chamber is shown
function needSenateFloor() {
  if (senFloor && SENY[S.year]) return;
  showLoading(true);
  Promise.all([loadSenateFloor(), loadSenate(S.year)]).then(() => { syncSenate(); showLoading(false); renderLenses(); renderLegend(); renderStory(true); renderTimeline(); $("#mp-meta").textContent = metaLine(); holdEyebrow(); schedule(); loadSenates(); })
    .catch(() => showLoading(true, "The Senate didn’t load. Try again."));
}
function lensParamChanged() {
  const hold = walkHold(takeSpot());
  S.sort = null; if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
}
/* the wait for an election's data: a ring, centred on the map; on the chamber, in the aisle
   between the Hansard desk and the back rows. Words only when the data fails */
function showLoading(on, msg) {
  const el = $("#loading");
  el.hidden = !on; el.classList.toggle("err", !!msg); el.textContent = msg || "";
  el.setAttribute("aria-label", msg ? "" : "Loading");
  el.style.left = el.style.top = "";
  if (!on || msg || S.view !== "chamber") return;
  const r = $("#stage").getBoundingClientRect();
  if (!r.width) return;
  // (the states' floors are drawn from the start; the Senate's only once fetched)
  const geom = chamberGeom(STATE_YEARS.has(S.year) ? { year: S.year, house: S.house } : S.house === "senate" && senFloor ? SENM : null);
  const F = chamberFrame(geom, r.width, r.height, chamberPads(r.width));
  el.style.left = F.X(0) + "px"; el.style.top = F.Yp(geom.aisle) + "px";
}
async function setYear(y) {
  if (y === S.year) return;
  if (!FS.auto) fsStop();

  // the spot is taken now, while it's fresh: the election may take a while to load
  const from = S.year, a = M(), spot = takeSpot();
  // a state election on the timeline has no Senate: it opens in the House's chamber
  if (S.house === "senate" && !SEN_YEARS.includes(y)) { S.house = "reps"; chAnim = null; chLast.clear(); renderLenses(); }
  // ... and the Senate-vote/seat-type lenses are AEC reads the state frames don't offer
  if (STATE_YEARS.has(y) && FED_LENS.has(S.lens) && !(S.lens === "senpref" && SEN_PREF_STATE_FRAMES.has(y))) { clsLensShelved ||= S.lens === "cls"; S.lens = S.lens === "senpref" ? "flow" : "winner"; }
  // the shelved cls lens returns itself on the federal frame that can hold it
  if (!STATE_YEARS.has(y) && clsLensShelved && S.lens === "winner") { S.lens = "cls"; clsLensShelved = false; }
  // the stamp names the election at the press; while it loads the stamp's rule runs and a
  // sheen crosses the map (an election already loaded lands within the frame)
  const dir = yearDir(from, y), tok = ++yearTok;
  showStamp(y, dir);
  const ready = Y[y] && Y[y].divs;
  if (!ready) { ywait = { t0: performance.now(), dir }; schedule(); }
  // the Senate's chamber moves with the timeline: that election's Senate too
  try { await Promise.all([needPpl() ? loadYear(y).then(() => loadPpl(y)) : loadYear(y), S.house === "senate" ? loadSenate(y) : null, S.lens === "senate" ? loadSenateVote(y) : null, S.lens === "senpref" ? loadSenatePrefs(y) : null, S.axis !== "AC" && S.lens === "tpp" && AXIS_FRAMES[y] != null && !STATE_YEARS.has(y) ? loadSenatePrefs(AXIS_FRAMES[y]) : null]); } catch (e) { if (tok === yearTok) { ywait = null; stampDone(); } console.error(e && e.stack || e); showLoading(true, "That election didn’t load. Try again."); return; }
  if (tok === yearTok) ywait = null;
  showLoading(false);
  const b = Y[y];
  // the view the reader left as the page framed it (or the page is still flying to) is framed again in the new election
  const framed = S.view === "map" && a && (atLastFit() || !!flight || T.k <= HOME.k * 1.001);
  // a year's birthplace menu is its own census edition's: a country it
  // doesn't print (England/Scotland before 2016) falls back to all overseas-born
  if (S.cob != null && !(b.cobKeys || []).includes(S.cob)) S.cob = null;
  // the Religion/Tenure menus appear only where their rows are; an
  // unknown option falls back to the menu's landing view
  if (!(b.relKeys || []).includes(S.rel)) S.rel = (b.relKeys || [])[0] || "norel";
  if (!(b.tenKeys || []).includes(S.ten)) S.ten = (b.tenKeys || [])[0] || "mort";
  if (!(b.ancKeys || []).includes(S.anc)) S.anc = (b.ancKeys || [])[0] || "english";
  // a People lane the frame's era never printed (menu omits it) drops
  // the selection to the always-printed language share
  if (b.hasLane && (DM.includes(S.index) || S.index === LENS_EDU) && b.hasLane[S.index] === false) S.index = "lang";
  // a schooling read the era never prints falls back to the frame's own
  // (the statistics-era frames keep University educated alone)
  if (S.index === LENS_EDU && b.hasLane && b.hasLane[S.eduMode] === false) S.eduMode = EDU_MODES.find((k) => b.hasLane[k] !== false) || "uni";
  if (b.hasIx && IX.includes(S.index) && b.hasIx[S.index] === false) S.index = "irsd";
  if (S.party === "onp" && !famEraOpts(b).includes("onp")) S.party = "lnp";
  if (!b.relKeys && S.index === LENS_REL) S.index = "irsad";
  if (!b.tenKeys && S.index === LENS_TEN) S.index = "irsad";
  if (!b.ancKeys && S.index === LENS_ANC) S.index = "irsad";
  proj = b.proj; // the year now shown (a year loaded ahead keeps the live projection)
  // carry the selection across by seat name and polling-place ID
  const s = S.sel;
  if ((s.level === "div" || s.level === "booth") && a) {
    const ni = b.byName.get(a.divs[s.div].n);
    if (ni == null) S.sel = { level: "state", st: s.st };
    else if (s.level === "booth") { const id = a.booth.id[s.booth]; const nj = b.booth.byDiv[ni].find((j) => b.booth.id[j] === id); S.sel = nj != null ? { level: "booth", st: s.st, div: ni, booth: nj } : { level: "div", st: s.st, div: ni }; }
    else S.sel = { level: "div", st: s.st, div: ni };
  }
  if (s.isl && S.sel !== s) S.sel = { ...S.sel, isl: s.isl }; // still out at the island
  // a state the new frame doesn't hold (New South Wales open, on to Victoria's election) opens the whole frame
  if (S.sel.level === "state" && !b.areas[S.sel.st]) S.sel = { level: "aus" };
  // …and the filters follow the frame: a state election has one state and no
  // AEC seat types, so both stand aside there; a federal frame keeps the
  // State filter while its state is still the selection, and a seat type it has
  if (STATE_YEARS.has(y)) { S.f.st = null; S.f.cls = null; }
  else {
    if (S.sel.level === "state") S.f.st = S.sel.st;
    else if (S.sel.level === "aus") S.f.st = null;
    if (S.f.cls && !b.divs.some((d) => d.cls === S.f.cls)) S.f.cls = null;
  }
  const hold = walkHold(spot);
  startChamberGlide();
  S.year = y;
  laneMem.set(yearLane(y), y);
  if (S.house === "senate") {
    // the chosen senator carries across by name where they sat in both Senates, else their state
    const was = SENM, ss = S.ssel;
    syncSenate();
    if (ss.level === "sen" && was) { const i = SENM.byName.get(was.divs[ss.i].n); S.ssel = i != null ? { level: "sen", st: ss.st, i } : { level: "state", st: ss.st }; }
    renderLenses();
  }
  renderLenses(); // the SA frames offer fewer lenses — the chip row changes with the year
  recolor(false);
  setExtent();
  ymorph = null;
  if (S.view === "map" && a && a !== b) {
    // the camera first shows on the new election's plane the ground it showed on the old;
    // a framed view then flies to its frame in the new (federal to a state: in to the state)
    const C0 = intoFrame(T, frameMap(a, b));
    glideCancel(); flight = null; d3.select(canvas).interrupt().call(zoom.transform, C0);
    if (framed || C0.k < HOME.k * 0.999) fitSelection(jurOf(a.year) !== jurOf(y) ? 1000 : 640);
    // (balloons and a surface change election by a crossfade: they aren't made of the seats that morph)
    balloonsLeave(a, b);
    if (drawOf(b) !== "seats" || !startYearMorph(a, b, framed && lastFit ? lastFit : T, dir)) carryColours(a, b);
  }
  const ul = tlMark();
  renderTimeline(); tlGlide(ul); renderLegend(); renderStory(true); renderFilterPill(); renderBack(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
  stampDone(ymorph ? ymorph.dur : 300);
  // now that it's shown, this frame earns its hi geometry and its place in the
  // cache; the morph above keeps its own references, so eviction can't hurt it
  // (the hi download runs under the morph, when the network has nothing else to do)
  warmHi(y);
  Y[y].viewedAt = performance.now();
  evictFrames();
  schedule();
}
let yearTok = 0;
// +1 going forward in time, -1 back (the "as it stands" frames are the latest
// of all, the federal Now on top)
const yearWhen = (y) => (y === "now" ? "9999" : isNowY(y) ? "9998" : Y[y] && Y[y].date ? Y[y].date : META_FACTS.house && META_FACTS.house[y] ? META_FACTS.house[y][0] : String(xOfYear(y)));
const yearDir = (a, b) => (yearWhen(b) < yearWhen(a) ? -1 : 1);
/* the stamp: the election just chosen, set large in the stage's corner while the map turns
   to it, rolling over from the one before like a counter (up going forward in time, down
   going back), a kicker naming its parliament above. Up at the press, before the data
   lands, its rule running while the election loads; it goes once the map has turned */
const stampEl = (() => {
  const el = document.createElement("div");
  el.className = "mp-stamp"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="mp-stamp-k"></div><div class="mp-stamp-y"></div><div class="mp-stamp-r"><i></i></div>`;
  $("#stage").appendChild(el);
  return el;
})();
let stampShown = "", stampOff = 0;
const stateAdj = (y) => (NSW_YEARS.has(y) ? "New South Wales" : VIC_YEARS.has(y) ? "Victorian" : QLD_YEARS.has(y) ? "Queensland" : WA_YEARS.has(y) ? "Western Australian" : "South Australian");
function stampParts(y) {
  if (y === "now") return ["The House today", "Now"];
  if (isNowY(y)) return ["The Assembly today", "Now"];
  if (STATE_YEARS.has(y)) return [`${stateAdj(y)} election`, "20" + String(y).slice(-2)];
  return ["Federal election", String(y)];
}
function showStamp(y, dir) {
  clearTimeout(stampOff);
  const [kick, big] = stampParts(y), el = stampEl, yel = $(".mp-stamp-y", el), was = el.classList.contains("on") ? stampShown : "";
  $(".mp-stamp-k", el).textContent = kick;
  el.classList.add("on", "wait");
  if (big === was) return;
  stampShown = big;
  // each character rolls on its own, left to right, where it changed; the rest stay put
  yel.innerHTML = [...big].map((ch, k) => `<span class="c">${was[k] !== ch && was ? `<span class="o">${esc(was[k] || "")}</span>` : ""}<span class="n">${esc(ch)}</span></span>`).join("");
  if (reduceMotion || !was) return;
  $$(".c", yel).forEach((c, k) => {
    const o = $(".o", c), n = $(".n", c); if (!o) return;
    const opt = { duration: 420, delay: k * 55, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" };
    o.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-dir * 70}%)`, opacity: 0 }], opt);
    n.animate([{ transform: `translateY(${dir * 70}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opt);
  });
}
// the election has landed: the rule fills, and the stamp goes once the map has turned
function stampDone(after = 300) {
  stampEl.classList.remove("wait");
  clearTimeout(stampOff);
  // (full screen keeps the election up on a wide screen, the map's own title plate;
  // a phone's small map shows it only while it turns, as the page does)
  if (FS.on && !FS.phone) return;
  stampOff = setTimeout(() => stampEl.classList.remove("on"), after + 900);
}
// the timeline's underline glides from the stop it left to the one chosen
const tlMark = () => { const t = $("#time .yr.on"), l = t && t.nextElementSibling; return l ? l.getBoundingClientRect() : null; };
function tlGlide(r0) {
  const t = $("#time .yr.on"), l = t && t.nextElementSibling;
  if (!r0 || !l || reduceMotion || !l.animate) return;
  const r1 = l.getBoundingClientRect();
  if (!r1.width || (Math.abs(r1.left - r0.left) < 0.5 && Math.abs(r1.top - r0.top) < 0.5)) return;
  l.style.transformBox = "fill-box"; l.style.transformOrigin = "left center";
  l.animate([{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scaleX(${r0.width / r1.width})` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.65,0,.35,1)" });
}
function metaLine(m = M(), sen = senOn() ? SENM : null) {
  if (!m) return "";
  if (sen) return sen.lc ? `${STATE_POSS[stOfYear(sen.year)]} Legislative Council from ${longDate(sen.asOf)} · ${sen.divs.length} members` : sen.year === "now" ? `The Senate as it sits, ${longDate(sen.asOf)} · ${sen.divs.length} senators` : `The Senate from ${longDate(sen.asOf)}, after the ${sen.year} election · ${sen.divs.length} senators`;
  // the federal Now names its last move over a data tick: the newest "Since the election" entry
  const changed = (m.changes || []).reduce((a, c) => (c.date > a ? c.date : a), "") || m.asOf;
  return m.year === "now" ? `The current House of Representatives, last changed ${longDate(changed)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : isNowY(m.year) ? `The Legislative Assembly as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : STATE_YEARS.has(m.year) ? `${stateAdj(m.year)} election, ${longDate(m.date)} · ${m.divs.length} ${seatNoun()} · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} ${seatNoun()} · ${m.booth.n.toLocaleString("en-AU")} polling places`;
}
/* the eyebrow holds the height of its jurisdiction family's longest line, so a walk through one
   family never moves the figure under it: between 414 and 600px an election's line wraps to two
   and Now's fits on one, and with the page at its top no scroll can take that back. Federal and
   each state's lines hold separately — a state's line is short and would sit in the tall federal
   hold — with a family walk moving the head once. Every unloaded year's line is measured from the
   facts assemble.mjs stamps in (data-stamp.mjs); only the chamber view walks into a Senate (and
   back to the House at SA 2026), so only it floors on its family's Senate lines too */
const META_FACTS = /*@meta-facts*/{"house":{"1993":["1993-03-13",147,8431],"1996":["1996-03-02",148,8463],"1998":["1998-10-03",148,8311],"2001":["2001-11-10",150,8213],"2004":["2004-10-09",150,8234],"2007":["2007-11-24",150,8235],"2010":["2010-08-21",150,8951],"2013":["2013-09-07",150,9146],"2016":["2016-07-02",150,8328],"2019":["2019-05-18",151,8875],"2022":["2022-05-21",151,8479],"2025":["2025-05-03",150,8940],"nsw15":["2015-03-28",93,3324],"nsw19":["2019-03-23",93,2946],"nsw23":["2023-03-25",93,3117],"qld17":["2017-11-25",93,1701],"qld20":["2020-10-31",93,1810],"qld24":["2024-10-26",93,1668],"sa22":["2022-03-19",47,695],"sa26":["2026-03-21",47,753],"vic14":["2014-11-29",88,1786],"vic18":["2018-11-24",88,1794],"vic22":["2022-11-26",88,1755],"wa17":["2017-03-11",59,752],"wa21":["2021-03-13",59,736],"wa25":["2025-03-08",59,743],"now":["2026-10-25",150,8940],"nswnow":["2026-11-04",93,3117],"qldnow":["2026-11-04",93,1668],"wanow":["2026-11-05",59,743]},"senate":{"1993":["1993-07-01",76],"1996":["1996-07-01",76],"1998":["1999-07-01",75],"2001":["2002-07-01",76],"2004":["2005-07-01",76],"2007":["2008-07-01",76],"2010":["2011-07-01",76],"2013":["2014-07-01",75],"2016":["2016-07-02",76],"2019":["2019-07-01",76],"2022":["2022-07-01",76],"2025":["2025-07-01",76],"now":["2026-10-09",76],"nsw15":["2015-03-28",42],"nsw19":["2019-03-23",42],"nsw23":["2023-03-25",42],"sa22":["2022-03-19",22],"sa26":["2026-03-21",22],"vic14":["2014-11-29",40],"vic18":["2018-11-24",40],"vic22":["2026-10-27",40]},"mix":{"nsw15":{"lnp":54,"alp":34,"grn":3,"ind":2},"nsw19":{"lnp":48,"alp":36,"grn":3,"oth":3,"ind":3},"nsw23":{"lnp":36,"alp":45,"grn":3,"ind":9},"qld17":{"alp":48,"lnp":39,"oth":3,"grn":1,"onp":1,"ind":1},"qld20":{"alp":52,"lnp":34,"oth":3,"grn":2,"onp":1,"ind":1},"qld24":{"alp":36,"lnp":52,"oth":3,"grn":1,"ind":1},"sa22":{"alp":27,"lnp":16,"ind":4},"sa26":{"alp":34,"lnp":5,"ind":4,"onp":4},"vic14":{"alp":47,"lnp":38,"grn":2,"ind":1},"vic18":{"alp":55,"lnp":27,"grn":3,"ind":3},"vic22":{"alp":56,"lnp":28,"grn":4},"wa17":{"alp":41,"lnp":18},"wa21":{"alp":53,"lnp":6},"wa25":{"lnp":13,"alp":46}}};
const ebHeights = new Map();
function holdEyebrow() {
  const eb = $(".mp-sec > .rd-eyebrow"), meta = $("#mp-meta"), w = eb.clientWidth;
  if (!w || !M()) return;
  const famOf = (y) => YEAR_JUR[y] || "fed";
  // the hold keys on the view now the count word does (divisions wraps longer
  // than seats or members)
  const ch = S.view === "chamber", fam = famOf(S.year), at = `${w}|${S.view}|${fam}`;
  if (!ebHeights.has(at)) {
    const keep = meta.textContent, lines = [], H = META_FACTS.house || {}, SN = META_FACTS.senate || {};
    for (const y of YEARS) {
      if (famOf(y) !== fam) continue;
      if (Y[y] && Y[y].divs) { lines.push(metaLine(Y[y], null)); continue; }
      const f = H[y]; if (!f) continue;
      lines.push(metaLine({ year: y, date: f[0], asOf: f[0], divs: { length: f[1] }, booth: { n: f[2] } }, null));
    }
    if (ch) for (const y of SEN_YEARS) {
      if (famOf(y) !== fam) continue;
      const s = SENY[y], f = s ? [s.asOf, s.divs.length] : SN[y]; if (!f) continue;
      lines.push(metaLine(M(), { year: y, lc: s ? s.lc : STATE_YEARS.has(y), asOf: f[0], divs: { length: f[1] } }));
    }
    eb.style.minHeight = "";
    let h = 0;
    for (const t of lines) { meta.textContent = t; h = Math.max(h, eb.getBoundingClientRect().height); }
    meta.textContent = keep;
    ebHeights.set(at, Math.ceil(h - 0.01));
  }
  eb.style.minHeight = ebHeights.get(at) + "px";
}
addEventListener("resize", holdEyebrow);
// (the meta line ellipses where the eyebrow is tight: its whole words ride its title)
{ const mt = $("#mp-meta"); if (mt) new MutationObserver(() => { if (mt.title !== mt.textContent) mt.title = mt.textContent; }).observe(mt, { childList: true, characterData: true, subtree: true }); }
addEventListener("resize", fitSearchPlaceholder);
addEventListener("resize", lensOverflow);

/* =============================== the frame =============================== */
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(ts) {
  raf = 0;
  chartTick();
  const m = M(); const th = TH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, Wpx, Hpx);
  // the map's sea first, under everything (the chamber's morph fades its own: drawMorph)
  if (m && m.proj && !morph && S.view === "map") drawOcean(m, 1);
  // (nor a frame not yet coloured: at boot the landing election can land before the
  // legend's metadata, and a resize's frame in that gap had no colours to fill with)
  if (!m || !m.divCol) return;
  let again = false;
  fadeT = 1;
  if (fade) { fadeT = clamp((ts - fade.t0) / fade.dur, 0, 1); if (fadeT < 1) again = true; else { fade = null; for (const y of Object.values(Y)) { y.prevDivCol = y.prevBoothCol = null; } } }
  if (morph) {
    const t = clamp((ts - morph.t0) / morph.dur, 0, 1);
    drawMorph(m, morph.to === "chamber" ? t : 1 - t);
    if (t < 1) again = true; else { morph = null; again = true; }
  } else if (S.view === "map") {
    let mt = 1;
    if (ymorph) { mt = clamp((ts - ymorph.t0) / ymorph.dur, 0, 1); if (mt >= 1 || ymorph.to !== m) ymorph = null; }
    if (ymorph) {
      again = true;
      drawYearMorph(ymorph, mt);
      ovA = smooth(0.55, 1, mt);
      const mo = ymorph;
      drawFocus(m, (i) => mo.cur[i] || geoOf(m).paths[i]);
      drawOldBooths(mo, mt); ovA = smooth(0.55, 1, mt); drawBooths(m);
      if (mo.cross) withT(viaFrame(T, mo.A), () => drawIslands(mo.from, 1 - smooth(0, 0.6, mt)));
      drawIslands(m, mo.cross ? smooth(0.4, 1, mt) : 1); drawLabels(m);
      ovA = 1;
    } else {
      drawGeo(m, 1, streetK());
      drawFocus(m); drawBooths(m); drawIslands(m); drawLabels(m);
    }
    if (ywait) { waitSheen(ts); again = true; }
  } else if (S.view === "chamber") {
    const c = CM();
    if (houseFade) {
      const t = clamp((ts - houseFade.t0) / houseFade.dur, 0, 1), e = ease(t);
      if (t < 1) { again = true; drawChamberMain(houseFade.from, 1 - e); } else houseFade = null;
      if (c) drawChamberMain(c, houseFade ? e : 1);
    } else if (c) drawChamberMain(c, 1);
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
  // (full screen: the plates' room is read before any framing below uses it)
  if (FS.on) fsMeasure(true);
  const first = !Wpx;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // full screen on a big retina display would be a 15-megapixel canvas, drawn every frame
  // the map moves (2560 x 1440 at 2x dropped one frame in eight): its backing store keeps to a
  // budget, the resolution falling only as far as that needs (FS.px, app-7-full.js)
  if (FS.on) dpr = Math.max(1, Math.min(dpr, Math.sqrt(FS.px / (r.width * r.height))));
  const changed = Math.abs(Wpx - r.width) > 0.5 || Math.abs(Hpx - r.height) > 0.5;
  // only the height moved (the key above the stage grew or shrank): a view the page framed
  // glides to the new fit; one the reader has moved keeps its zoom, centred as before
  const dh = r.height - Hpx, dw = r.width - Wpx, keyOnly = !first && Math.abs(Wpx - r.width) <= 0.5 && changed && S.view === "map";
  const moved = keyOnly && !atLastFit() && !flight;
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    // the step into or out of full screen brings its own camera (app-7-full.js)
    if (FS.move) { const mv = FS.move; FS.move = null; mv(); }
    // (full screen resized under a view the reader moved: the middle holds, the zoom too)
    else if (FS.on && changed && !first && S.view === "map" && !atLastFit() && !flight) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x + dw / 2, T.y + dh / 2).scale(T.k));
    else if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (flight && (keyOnly || FS.on)) flight.redo();
    else if (first || changed) fitSelection(keyOnly && !reduceMotion ? 320 : 0);
  }
  updateCanvasVis();
  renderTimeline();
  // setting the canvas's size blanks it: paint it again now, not a frame later (the resize
  // lands between the frame's callbacks and its paint, so a scheduled repaint left one blank frame)
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  frame(performance.now());
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
  if (S.lens === "senate") { p.set("p", S.party); if (!senGap()) p.set("m", "share"); }
  if (S.lens === "flow") { p.set("p", S.from); if (S.vs !== "lnp") p.set("f", S.vs); }
  if (S.lens === "senpref") { p.set("sp", S.spPair); p.set("p", S.spFrom); }
  if (S.lens === "seifa") { p.set("i", S.index); if (isInc() && S.incMode !== "med") p.set("iv", S.incMode); if (isAge() && S.ageMode !== "med") p.set("av", S.ageMode); if (isEdu() && S.eduMode !== "uni") p.set("ev", S.eduMode); if (isCob()) p.set("cb", S.cob); if (isRel() && S.rel !== "norel") p.set("rl", S.rel); if (isTen() && S.ten !== "mort") p.set("tn", S.ten); if (isAnc()) p.set("an", S.anc); }
  if (S.lens === "informal" && S.infMode === "exhaust") p.set("im", "exhaust");
  if (S.draw !== "seats") p.set("draw", S.draw);
  // the chart's own switches ride along: the seat-type split and the vote-type comparison
  if (S.draw === "chart") { if (CH.split) p.set("cs", "type"); if (CH.tpp === "cast") p.set("cv", CH.vs); }
  if (S.lens === "tpp" && S.draw !== "seats" && S.axis !== "AC") p.set("ax", S.axis);
  if (S.view !== "map") p.set("v", S.view);
  if (S.seat) p.set("o", S.seat);
  if (S.house === "senate") {
    p.set("c", "senate");
    if (S.senLens !== "party") p.set("sl", S.senLens);
    const ss = S.ssel;
    if (ss.level === "state") p.set("ss", ss.st);
    else if (ss.level === "sen" && SENM) p.set("ss", SENM.divs[ss.i].n);
  }
  if (m) {
    const s = S.sel;
    if (s.level === "state") p.set("s", s.st);
    else if (s.level === "div") p.set("s", m.divs[s.div].n);
    else if (s.level === "booth") p.set("s", m.divs[s.div].n + "/" + m.booth.id[s.booth]);
    if (s.isl) p.set("at", s.isl);
  }
  if (FS.on) p.set("fs", "1");
  // the retro view rides the link too, so a shared one opens in it (app-8-retro.js)
  if (typeof rtIsOn === "function" && rtIsOn()) p.set("retro", "1");
  const h = p.toString();
  try { history.replaceState(FS.on ? { mpFs: 1 } : null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const yr = p.get("y"); if (yr && YEARS.includes(yearOf(yr))) S.year = yearOf(yr);
  const l = p.get("l"); if (l && (yearLenses(S.year).some((x) => x.id === l) || (l === "senpref" && (!STATE_YEARS.has(S.year) || SEN_PREF_STATE_FRAMES.has(S.year))))) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change"; if (mm === "share" && S.lens === "senate") S.senMode = "share";
  const dw = p.get("draw"); if (dw && DRAWS.some(([k]) => k === dw)) S.draw = dw;
  if (p.get("cs") === "type") CH.split = true;
  const cv = p.get("cv"); if (cv && CH_VS[cv]) { CH.tpp = "cast"; CH.vs = cv; }
  const ax = p.get("ax"); if (ax && SP_PAIRS[ax]) S.axis = ax;
  const spp = p.get("sp"); if (spp && SP_PAIRS[spp] && !AXIS_GREEN_SET.has(spp)) S.spPair = spp;
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else if (S.lens === "senpref") { if (SP_DONORS[S.spPair].includes(pp)) S.spFrom = pp; } else S.party = pp; }
  if (!SP_DONORS[S.spPair].includes(S.spFrom)) S.spFrom = SP_DONORS[S.spPair][0];
  S.vs = p.get("f") === "onp" ? "onp" : "lnp";
  const i = p.get("i");
  // the loinc/hiinc, a65/a2034 and uni/y12less menu ids and the hi mode id
  // pre-date the merged lenses and the top-quarter lane: a legacy hash
  // naming one lands on the lens with its share view picked (hiq where
  // hi once sat)
  if (i === "loinc" || i === "hiinc") { S.index = LENS_INC; S.incMode = i === "loinc" ? "lo" : "hiq"; }
  else if (i === "a65" || i === "a2034") { S.index = LENS_AGE; S.ageMode = i; }
  else if (i === "uni" || i === "y12less") { S.index = LENS_EDU; S.eduMode = i === "y12less" ? "y12less" : "uni"; }
  else if (i && (IX.includes(i) || DM.includes(i) || i === LENS_INC || i === LENS_AGE || i === LENS_EDU || i === LENS_REL || i === LENS_TEN || i === LENS_ANC)) S.index = i;
  const iv = p.get("iv"); S.incMode = iv === "lo" ? "lo" : iv === "hi" || iv === "hiq" ? "hiq" : (i === "loinc" ? "lo" : i === "hiinc" ? "hiq" : "med");
  const av = p.get("av"); S.ageMode = AGE_MODES.includes(av) ? av : (i === "a65" || i === "a2034" ? i : "med");
  const ev = p.get("ev"); S.eduMode = ev === "y12less" ? "y12less" : (i === "y12less" ? "y12less" : "uni");
  S.cob = COB_NAME[p.get("cb")] ? p.get("cb") : null;
  S.rel = REL_NAME[p.get("rl")] ? p.get("rl") : "norel";
  S.ten = TEN_NAME[p.get("tn")] ? p.get("tn") : "mort";
  S.anc = ANC_NAME[p.get("an")] ? p.get("an") : "english";
  if (p.get("im") === "exhaust") S.infMode = "exhaust";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  const o = p.get("o"); if (o === "plan" || o === "sort") S.seat = o;
  if (p.get("c") === "senate") { S.house = "senate"; if (SEN_LENSES.some((l) => l.id === p.get("sl"))) S.senLens = p.get("sl"); senFromURL = p.get("ss"); }
  fsFromURL = p.get("fs") === "1";
  return p.get("s");
}
let senFromURL = null, fsFromURL = false;
function applySenFromURL() {
  const v = senFromURL; senFromURL = null;
  if (!v || !SENM) return;
  if (STATES.includes(v)) S.ssel = { level: "state", st: v };
  else { const i = SENM.byName.get(v); if (i != null) S.ssel = { level: "sen", st: SENM.divs[i].st, i }; }
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
  // a town's label under the pointer reads as a click target (the label inverts here, the click flies)
  const ti = townAtPoint(e.clientX - r.left, e.clientY - r.top);
  if (ti !== townHiIdx) { townHiIdx = ti; schedule(); }
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  tipAt = [(e.clientX - r.left - T.x) / T.k, (e.clientY - r.top - T.y) / T.k]; tipClient = [e.clientX, e.clientY];
  if (h && drawOf(M()) === "surface") surfaceAsk(tipAt[0], tipAt[1]);
  if (drawOf(M()) === "areas") {
    const mm = M(), hit = h && AR.pack ? areasHit(mm, tipAt[0], tipAt[1]) : null;
    AR.here = hit ? { ...hit, v: areasValue(AR.pack, mm, hit.i, AR.lane) } : null;
  }
  const same = (h && S.hover && h.kind === S.hover.kind && h.i === S.hover.i) || (!h && !S.hover);
  if (!same) { S.hover = h; schedule(); }
  if (h) showTipAt(tipFor(h), e.clientX, e.clientY); else hideTip();
  canvas.style.cursor = h ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => { S.hover = null; AR.here = null; townHiIdx = -1; hideTip(); schedule(); });
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  // a town's label is a click target of its own: the map flies to the town and rings it
  const ti = townAtPoint(e.clientX - r.left, e.clientY - r.top);
  if (ti >= 0) { flyToTown(ti); return; }
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (h && h.kind === "sen") { selectSen({ level: "sen", st: SENM.divs[h.i].st, i: h.i }); return; }
  if (!h && senOn()) { if (S.ssel.level !== "aus") selectSen({ level: "aus" }); return; }
  if (!h) {
    // a click on open water lets the selection out — always in the chamber,
    // which has no camera to move; on the map it leaves the camera alone at
    // any zoom, and the double click below is the one that takes it home
    if (S.sel.level === "aus") return;
    if (S.view === "chamber") goAus();
    else if (S.view === "map") select({ level: "aus" }, { fly: false });
    return;
  }
  if (h.go) goIsland(h.go);
  else if (h.kind === "booth") goBooth(h.i);
  else if (h.kind === "bal") goBalloon(h.g);
  else goDiv(h.i, { fly: S.view === "map" });
});
// a double click on open water takes the map all the way out home (the pair's
// first click has already let any selection out where the camera stands)
canvas.addEventListener("dblclick", (e) => {
  if (S.view !== "map") return;
  const r = canvas.getBoundingClientRect();
  if (hitTest(e.clientX - r.left, e.clientY - r.top)) return;
  goAus();
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
  const voteMode = e.target.closest("[data-vt-mode]");
  if (voteMode) { setVtMode(voteMode.dataset.vtMode); return; }
  const closeTgl = e.target.closest("[data-close-toggle]");
  if (closeTgl) { setCloseSafe(!closeSafe); return; }
  const oth = e.target.closest("[data-othx]");
  if (oth) { statOthersToggle(); return; }
  const primary = e.target.closest("[data-pv-action]");
  if (primary) { statBreakdownClick(primary); return; }
  const c = e.target.closest("#minich");
  if (c) { const r = c.getBoundingClientRect(), i = miniHit(e.clientX - r.left, e.clientY - r.top); if (i != null) goDiv(i); return; }
  const g = e.target.closest("g[data-year]"); if (g) { setYear(yearOf(g.dataset.year)); }
});
// a tap names the fixed view's spot before any handler acts on it
document.addEventListener("click", (e) => walkAim(e.clientY), true);
$("#time").addEventListener("click", (e) => { const g = e.target.closest("[data-year]"); if (g) setYear(yearOf(g.dataset.year)); });
// a stop under the pointer starts loading its election, so the click finds it ready
$("#time").addEventListener("pointerover", (e) => { const g = e.target.closest("[data-year]"); if (g) { const y = yearOf(g.dataset.year); if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120); } });
function closeBaseMenu() {
  const menu = $("#base-menu"), trigger = $("[data-basis-trigger]");
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}
function openBaseMenu() {
  const menu = $("#base-menu"), trigger = $("[data-basis-trigger]");
  if (!menu || !trigger) return;
  closePanelMenus();
  menu.hidden = false; trigger.setAttribute("aria-expanded", "true");
  (menu.querySelector('[aria-checked="true"]') || menu.querySelector("button"))?.focus();
}
document.addEventListener("click", (e) => {
  const baseTrigger = e.target.closest("[data-basis-trigger]");
  if (baseTrigger) { if (baseTrigger.getAttribute("aria-expanded") === "true") closeBaseMenu(); else openBaseMenu(); return; }
  const lgTrigger = e.target.closest("[data-lg-trigger]");
  if (lgTrigger) {
    const wrap = lgTrigger.closest(".lg-bmenu"), p = lgMenuParts(wrap);
    if (p.menu.hidden) openPanelMenu(wrap);
    else { p.menu.hidden = true; p.trigger.setAttribute("aria-expanded", "false"); }
    return;
  }
  const lgVal = e.target.closest("[data-lg-val]");
  if (lgVal) {
    const wrap = lgVal.closest(".lg-bmenu"), p = lgMenuParts(wrap);
    p.menu.hidden = true; p.trigger?.setAttribute("aria-expanded", "false"); p.trigger?.focus({ preventScroll: true });
    const [k, ...vv] = lgVal.dataset.lgVal.split(":"); applyOpt(k, vv.join(":"));
    return;
  }
  const baseOption = e.target.closest("[data-base]");
  if (baseOption) {
    closeBaseMenu(); $("[data-basis-trigger]")?.focus({ preventScroll: true });
    if (baseOption.dataset.baseHouse === "senate") setSenLens(baseOption.dataset.base);
    else setLens(baseOption.dataset.base);
    return;
  }
  if (!e.target.closest(".lg-bmenu")) { closeBaseMenu(); closePanelMenus(); }
  const city = e.target.closest("[data-city]");
  if (city) { flyToCity(+city.dataset.city); return; }
  /* the State row: a state frames the map on it (the selection is the
     filter); "All", or the state again, lets it go — back to the whole frame
     from the state's own view, or simply unfiltered while a seat is open */
  const stj = e.target.closest("[data-state]");
  if (stj) {
    const st = stj.dataset.state || null;
    if (st && S.f.st !== st) goState(st);
    else if (S.sel.level === "state") goAus();
    else if (S.f.st) { S.f.st = null; filtersChanged(); }
    return;
  }
  // the Seat type row: a type dims the rest wherever seats are drawn and pools the head's figures
  const clj = e.target.closest("[data-cls]");
  if (clj) {
    const c = clj.dataset.cls || null;
    S.f.cls = c && S.f.cls !== c ? c : null;
    filtersChanged();
    return;
  }
  const fj = e.target.closest("[data-fjump]");
  if (fj) { const ys = FRAME_JUMPS[+fj.dataset.fjump][1]; setYear(ys[ys.length - 1]); return; }
  const tn = e.target.closest("[data-towns]");
  // the Jump-to row's city-names toggle: the map stops (restart) painting town names
  // (flipped in place — rebuilding the strip for one word re-laid it, and the map under it jolted)
  if (tn) {
    S.townsOff = !S.townsOff;
    const on = !S.townsOff, [hide, show] = tn.querySelectorAll(".lg-jt-w");
    tn.setAttribute("aria-pressed", String(on));
    if (hide && show) { (on ? show : hide).setAttribute("aria-hidden", "true"); (on ? hide : show).removeAttribute("aria-hidden"); }
    schedule(); return;
  }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip],[data-seat],[data-house],[data-slens],[data-sgo],[data-draw]");
  if (!t) { if (!e.target.closest(".mp-search")) $("#sugg").hidden = true; return; }
  const m = M();
  if (t.dataset.n != null && t.closest("#sugg")) { chooseSugg(+t.dataset.n); return; }
  if (t.dataset.go != null) {
    const [k, ...rest] = t.dataset.go.split(":"); const v = rest.join(":");
    if (k === "aus") { if (v === "all" && S.f.cls) { S.f.cls = null; if (S.sel.level === "aus") { filtersChanged(); return; } } goAus(); } else if (k === "state") goState(v); else if (k === "div") goDiv(+v, { fly: S.view === "map" }); else if (k === "booth") goBooth(+v, { view: S.view === "chamber" ? "map" : undefined });
    else if (k === "divname") { const i = m.byName.get(v); if (i != null) goDiv(i, { fly: S.view === "map" }); }
    return;
  }
  if (t.dataset.lens) { setLens(t.dataset.lens); return; }
  if (t.dataset.house) { setHouse(t.dataset.house); return; }
  if (t.dataset.slens) { setSenLens(t.dataset.slens); return; }
  if (t.dataset.sgo && SENM) { const [k, v] = t.dataset.sgo.split(":"); selectSen(k === "aus" ? { level: "aus" } : k === "state" ? { level: "state", st: v } : { level: "sen", st: SENM.divs[+v].st, i: +v }); return; }
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.seat) { if (t.dataset.seat !== seatMode(CM() || M())) { S.seat = t.dataset.seat; startChamberGlide(); renderLegend(); writeURL(); schedule(); miniCh.dirty = true; } return; }
  if (t.dataset.draw) { setDraw(t.dataset.draw); return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
  if (t.dataset.flip === "flowsrc") { lensFlip = true; setLens(S.lens === "senpref" ? "flow" : "senpref"); lensFlip = false; return; }
  if (t.dataset.flip === "sen") { S.senMode = senGap() ? "share" : "gap"; lensParamChanged(); return; }
  if (t.dataset.dist) { S.dist = S.dist === t.dataset.dist ? null : t.dataset.dist; renderList(true); return; }
  if (t.hasAttribute("data-distclose")) { S.dist = null; renderList(true); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; const cur = S.sort && S.sort.key === k ? S.sort : null; const col = listCache && listCache.cols.find((c) => c.key === k); S.sort = { key: k, dir: cur ? -cur.dir : col && !col.num ? 1 : -1 }; renderList(true); return; }
  if (t.dataset.unit) { S.listUnit = t.dataset.unit; S.sort = null; S.dist = S.dist; if (S.f.range && S.f.range.unit !== S.listUnit) S.f.range = null; renderList(); renderFilterPill(); schedule(); return; }
  if (t.hasAttribute("data-unseat")) { goState(S.sel.st); return; }
  if (t.hasAttribute("data-unrange")) { S.f.range = null; filtersChanged(); return; }
  if (t.hasAttribute("data-listbooths")) { S.listUnit = "booths"; S.sort = null; if (S.f.range && S.f.range.unit !== "booths") S.f.range = null; setView("list"); return; }
  if (t.hasAttribute("data-showmap")) { setView("map"); fitSelection(700); return; }
  if (t.hasAttribute("data-more")) { $$("[data-extra]", t.parentElement).forEach((r) => (r.hidden = false)); t.remove(); return; }
  if (t.hasAttribute("data-clear")) { S.f = { ...S.f, win: null, margin: null, range: null }; filtersChanged(); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.opt) { applyOpt(t.dataset.opt, t.value); return; }
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
// with the pointer over the lens row the arrows walk the lenses, not the years;
// on a phone the row scrolls horizontally, the All-polls menubar way
let lensHover = false;
$("#lenses").addEventListener("pointerenter", () => { lensHover = true; });
$("#lenses").addEventListener("pointerleave", () => { lensHover = false; });
document.addEventListener("keydown", (e) => {
  const baseWrap = e.target.closest && e.target.closest(".lg-bmenu");
  if (baseWrap) {
    // (the Base menu and every other panel menu — Draw, the filters, a census picker — walk alike)
    const menu = baseWrap.querySelector(".st-scm"), trigger = baseWrap.querySelector("[data-basis-trigger], [data-lg-trigger]");
    const isBase = !!(trigger && trigger.hasAttribute("data-basis-trigger"));
    const shut = () => { if (isBase) closeBaseMenu(); else closePanelMenus(); };
    if (e.key === "Escape") { e.preventDefault(); shut(); trigger?.focus(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (menu.hidden) { if (isBase) openBaseMenu(); else openPanelMenu(baseWrap); }
      else {
        const items = [...menu.querySelectorAll("button:not(:disabled)")], at = items.indexOf(document.activeElement);
        const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
      return;
    }
    if (e.key === "Tab") { shut(); trigger?.focus(); }
    return;
  }
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (e.key === "/" && !typing) { e.preventDefault(); q.focus({ preventScroll: true }); q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") {
    if (senOn()) { const s = S.ssel; if (s.level === "sen") selectSen({ level: "state", st: s.st }); else if (s.level === "state") selectSen({ level: "aus" }); }
    else goUp();
  }
  // A focused chart toggle keeps its native keyboard activation.
  if (e.key === " " && e.target.closest("[data-vt-mode]")) return;
  if (e.key === "b") { if (S.view === "map" && !$("#zback").hidden) { e.preventDefault(); goAus(); } }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); (lensHover ? walkLens : walkYear)(e.key === "ArrowRight" ? 1 : -1); }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); walkLane(e.key === "ArrowDown" ? 1 : -1); }
});
$("#zin").addEventListener("click", () => zoomBy(1.8));
$("#zout").addEventListener("click", () => zoomBy(1 / 1.8));
$("#zback").addEventListener("click", () => goAus());
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
let cullRaf = 0;
addEventListener("scroll", () => { if (!cullRaf) cullRaf = requestAnimationFrame(() => { cullRaf = 0; updateCanvasVis(); }); }, { passive: true });

/* once the page is up, the nearest elections load in the background — nearest
   timeline stops first, one idle slice at a time and paced a breath apart — so
   a timeline jump, a chamber switch or the Senate lens finds its data already
   here. Skipped where the connection asks to save data (the timeline's hover
   preload still covers a stop the reader nears); a year's failed fetch drops
   its record so a real click tries it again. The Handbook years never ride this
   loop — their lossless geometry is 6.5–19MB a year, fetched only on hover/click
   demand. Two brakes keep this a polite background job: it stops when the frame
   cache is full (FRAME_CAP), and each stop's hi geometry waits for a real visit
   (warmHi) — fetching and building every stop's hi Path2D set here was the
   2026-10 idle-time long-task storm (≈15s of main-thread jank in the first
   minute) and most of the page's half-gigabyte heap */
const idleSlice = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 900));
const PRELOAD_GAP = 1800;
function preloadYears() {
  const conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
  const at = YEARS.indexOf(S.year);
  const stops = YEARS.filter((y) => !Y[y] && !HANDBOOK_YEARS.has(y)).sort((a, b) => Math.abs(YEARS.indexOf(a) - at) - Math.abs(YEARS.indexOf(b) - at));
  // (the reader waiting on an election of their own: theirs goes first, alone)
  const later = (fn) => setTimeout(fn, 500);
  const senateLane = () => {
    // the chambers' lane, cheap beside the years: every Senate (~7KB each) and
    // its floor, then the Senate-vote lens files (the AEC served no 2004 count),
    // one at a time - all twelve at once (~1.3MB) slowed whichever election the
    // reader opened meanwhile by half again
    loadSenates().catch(() => {});
    loadSenateFloor().catch(() => {});
    const ks = SEN_YEARS.filter((sy) => { const k = svYear(sy); return k != null && k !== 2004; });
    const one = () => {
      if (ywait) return void later(one);
      const sy = ks.shift();
      if (sy != null) loadSenateVote(sy, true).catch(() => {}).then(() => idleSlice(() => setTimeout(one, 400)));
    };
    one();
  };
  const next = () => {
    if (ywait) return void later(next);
    const y = frameLoad() < FRAME_CAP ? stops.shift() : null;
    if (y != null && Y[y]) return void next(); // the reader got there first
    if (y != null) return void loadYear(y, true).catch(() => { if (Y[y] && !Y[y].divs) delete Y[y]; }).then(() => idleSlice(() => setTimeout(next, PRELOAD_GAP)));
    senateLane();
  };
  idleSlice(next);
}

/* the state each capital sits in, named the short way (NSW Vic Qld WA SA Tas ACT NT) */
const STATE_ABBR = { NSW: "NSW", VIC: "Vic", QLD: "Qld", WA: "WA", SA: "SA", TAS: "Tas", ACT: "ACT", NT: "NT" };

/* the "View elections" strip under the timeline: each jurisdiction's newest frame —
   its names in a row, or on a phone one menu (the row wrapped to three lines there) */
function renderFrames() {
  const el = $("#frames-jump"); if (!el) return;
  const cur = FRAME_JUMPS.findIndex(([, ys]) => ys.includes(S.year));
  if (el.dataset.k === String(cur)) return;
  el.dataset.k = String(cur);
  el.innerHTML = `<b>View elections</b>${FRAME_JUMPS.map(([n], k) => `<button type="button" data-fjump="${k}"${k === cur ? ' class="on"' : ""}>${n}</button>`).join("")}<span class="mp-fj-menu">${lgMenu("fjump", FRAME_JUMPS.map(([n], k) => [String(k), n]), String(cur), "View elections")}</span>`;
}
const FRAME_JUMPS = [["Federal", YEARS_FED], ["Victoria", YEARS_VIC], ["New South Wales", YEARS_NSW], ["Queensland", YEARS_QLD], ["South Australia", YEARS_SA], ["Western Australia", YEARS_WA]];

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  renderFrames();
  const meta = loadLegendMeta();
  showLoading(true);
  try { await Promise.all([loadYear(S.year), meta, S.lens === "senate" ? loadSenateVote(S.year) : null, S.lens === "senpref" ? loadSenatePrefs(S.year) : null, S.axis !== "AC" && S.lens === "tpp" && AXIS_FRAMES[S.year] != null && !STATE_YEARS.has(S.year) ? loadSenatePrefs(AXIS_FRAMES[S.year]) : null]); } catch (err) { showLoading(true, "The map’s data didn’t load. Reload the page to try again."); return; }
  warmHi(S.year); // the landing frame earns its hi geometry at once; every other frame's waits for its first visit
  Y[S.year].viewedAt = performance.now();
  // a deep-linked birthplace picks what the year's own menu can't print
  // (England on 2013): clamp before the first render, at the model —
  // never inside loadYear (idle preloads of every year mustn't touch S)
  const bmc = M();
  if (S.cob != null && bmc && !(bmc.cobKeys || []).includes(S.cob)) S.cob = null;
  if (bmc && !(bmc.relKeys || []).includes(S.rel)) S.rel = (bmc.relKeys || [])[0] || "norel";
  if (bmc && !(bmc.tenKeys || []).includes(S.ten)) S.ten = (bmc.tenKeys || [])[0] || "mort";
  if (bmc && !(bmc.ancKeys || []).includes(S.anc)) S.anc = (bmc.ancKeys || [])[0] || "english";
  if (bmc && !bmc.ancKeys && S.index === LENS_ANC) S.index = "irsad";
  if (bmc && !bmc.relKeys && S.index === LENS_REL) S.index = "irsad";
  if (bmc && !bmc.tenKeys && S.index === LENS_TEN) S.index = "irsad";
  // yesterday's hash on a statistics-era frame: the schooling read falls
  // back to University educated, the era's only education lane
  if (bmc && bmc.hasLane && S.index === LENS_EDU && bmc.hasLane[S.eduMode] === false) S.eduMode = EDU_MODES.find((k) => bmc.hasLane[k] !== false) || "uni";
  if (S.house === "senate") { try { await Promise.all([loadSenateFloor(), loadSenate(S.year)]); syncSenate(); applySenFromURL(); loadSenates(); } catch (e) { S.house = "reps"; } }
  showLoading(false);
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  recolor(false);
  resize();
  const view = S.view; S.view = "map"; if (view !== "map") setView(view, true);
  renderLenses();
  morph = null; // landing mid-state is not a transition between views
  $("#view").classList.toggle("v-chamber", S.view === "chamber");
  if (!applySelFromURL(selFromURL)) goAus({ fly: false });
  { const at = new URLSearchParams(location.hash.slice(1)).get("at"); if (at && islOf(M(), at)) S.sel = { ...S.sel, isl: at }; }
  fitSelection(0, true); // frame the map's transform even when the page opened on the chamber
  urlReady = true; writeURL();
  renderLegend(); updateHint(); renderTimeline(); renderBack();
  $("#zoomer").dataset.view = S.view; $("#zoomer").hidden = S.view === "list";
  if (fsFromURL) fsEnter({ native: false, push: false, animate: false });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); ebHeights.clear(); holdEyebrow(); });
  window.__map = { S, Y, SF, AR, setDraw, setAxis, axisOf, axisArea, surfaceAt, balloonSet, balloonLevel, undrawnOf, estBooths, drawOf, areasHit, areasValue, areasLane, areasVintage, M, walk(dir, y) { walkAim(y); walkYear(dir, true); }, walkLane, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get townPick() { return townPick; }, get townHitsNow() { return townHits.map((h) => h.slice()); }, get urbanOk() { return townPick >= 0 && !!urbanEntry(townPick); }, get projDrift() { const m = M(), ll = [115.8614, -31.9522], a = proj(ll), b = m.proj(ll); return [proj === m.proj, +((a[0] - b[0]) * T.k).toFixed(1), +((a[1] - b[1]) * T.k).toFixed(1)]; }, get townsDrawn() { return [...townSince.keys()].map((i) => PLACES[i][0]); }, get HOME() { return HOME; }, get ymorph() { return ymorph; }, get seaDrawn() { return [...seaSince.keys()]; },
    get away() { return away; },
    fs: { enter: (o) => fsEnter(o), exit: (o) => fsExit(o), play: () => fsPlay(), stop: () => fsStop(), panel: (v) => fsPanel(v), sheet: (v) => fsSheet(v), get on() { return FS.on; }, get ins() { return { ...FS.ins }; }, get playing() { return !!FS.play; }, get native() { return FS.native; }, get px() { return FS.px; }, set px(v) { FS.px = v; Wpx = 0; resize(); } },
    get islands() { return islDrawn.map((c) => ({ key: c.s.key, r: c.r, docked: c.docked, dots: c.dots.map((d) => ({ j: d.j, x: d.x, y: d.y })) })); },
    landAt(px, py) { const m = M(); if (!m) return false; const g = geoOf(m); if (!g || !g.paths) return false; const bx = (px - T.x) / T.k, by = (py - T.y) / T.k; for (let i = 0; i < m.divs.length; i++) { const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue; if (hitCtx.isPointInPath(g.paths[i], bx, by)) return true; } return false; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); },
    view(ll, k) { const p = proj(ll); d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(Wpx / 2 - p[0] * k, Hpx / 2 - p[1] * k).scale(k)); } };
  preloadYears();
})();

/* =============================== full screen ===============================
   The map's full-screen view: the stage fills the screen edge to edge and the
   page's own controls float over it on paper plates. On a wide screen the
   panel at the left holds the view switch, the key and the story; the lenses,
   search and the way out run along the top; a dock along the foot steps
   through the elections, or plays them one after another. On a phone the
   panel is a sheet from the foot (the dock at its head), pulled up for the
   story. Nothing is rebuilt: the stage, key, story, lenses, search and view
   switch are the page's own elements, parked in the plates while the view
   lasts (a placeholder of the same size holds each one's spot in the page)
   and put back on the way out, so every handler, observer and hold keeps
   working. The browser's own full screen is asked for too where it exists
   (an iPhone has none: there the plates fill the window). The framing reads
   the plates: FS.ins, the room they take at each edge, goes into the map's
   and the chamber's pads, so a fit centres in the clear ground between them.
   The way in opens the frame out from the map's spot on the page, the map
   held where it stood on screen and then flown to its new fit; the way out
   closes it back down onto that spot. A history entry of its own makes Back
   the way out; the hash carries fs=1, so a shared link opens it (without the
   browser's full screen, which only a press may ask for). */
const FS_ICON = {
  close: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4.2 2.4v9.2c0 .5.5.8.9.5l7.1-4.6c.4-.2.4-.8 0-1L5.1 1.9c-.4-.3-.9 0-.9.5z" fill="currentColor"/></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3.1" y="2.4" width="2.8" height="9.2" rx=".9" fill="currentColor"/><rect x="8.1" y="2.4" width="2.8" height="9.2" rx=".9" fill="currentColor"/></svg>`,
  prev: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.8 2.8 4.6 7l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5.2 2.8 9.4 7l-4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  side: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.45" aria-hidden="true"><rect x="2" y="3" width="14" height="12" rx="2.2"/><path d="M7 3v12"/><path d="M3.9 6.2h1.3M3.9 8.4h1.3M3.9 10.6h1.3" stroke-linecap="round"/></svg>`,
};
const FS_LANES = ["Federal", "Victoria", "New South Wales", "South Australia", "Queensland", "Western Australia"];
/* the phone rung caps the jurisdiction picker at 98px — a name that can't
   stand there goes to its short form ("South Australia" → "SA") */
const FS_LANE_ABBR = { Victoria: "Vic", "New South Wales": "NSW", "South Australia": "SA", Queensland: "Qld", "Western Australia": "WA" };
const FS_HOLD = 2300; // ms the play-through rests on each election once the map has turned to it
const FS_EASE = "cubic-bezier(.22,.8,.24,1)";
const fsNativeEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsCanNative = () => {
  const de = document.documentElement;
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(de.requestFullscreen || de.webkitRequestFullscreen);
};
Object.assign(FS, { px: 8e6, el: null, parked: [], native: false, pushed: false, skipPop: false, leaving: false, bare: false, sheetUp: false, phone: false, play: null, auto: false, scrollY: 0, inert: [] });

function fsBuild() {
  if (FS.el) return;
  const el = document.createElement("div");
  el.className = "fs"; el.id = "fs"; el.hidden = true; el.tabIndex = -1;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Electoral map, full screen");
  el.innerHTML = `<div class="fs-top">
      <div class="fs-lensbar fs-plate"></div>
      <div class="fs-sbox"></div>
      <div class="fs-tviews fs-plate"></div>
      <button type="button" class="fs-x fs-plate" aria-label="Leave full screen" title="Leave full screen (Esc)">${FS_ICON.close}</button>
    </div>
    <aside class="fs-side fs-plate" aria-label="The story">
      <div class="fs-grab" role="button" tabindex="0" aria-label="Show more of the story"><i></i></div>
      <div class="fs-head">
        <div class="fs-title"><h2>Electoral map</h2><button type="button" class="fs-hide" aria-label="Hide the panel" title="Hide the panel">${FS_ICON.side}</button></div>
        <p class="fs-meta"></p>
        <div class="fs-vslot"></div>
      </div>
      <div class="fs-lslot"></div>
      <div class="fs-scroll"></div>
    </aside>
    <button type="button" class="fs-show fs-plate" hidden aria-label="Show the panel" title="Show the panel">${FS_ICON.side}</button>
    <div class="fs-dock fs-plate">
      <button type="button" class="fs-play" aria-label="Play through the elections" title="Play through the elections (Space)">${FS_ICON.play}</button>
      <div class="fs-steps"><button type="button" class="fs-step" data-step="-1" aria-label="The election before" title="The election before (←)">${FS_ICON.prev}</button><button type="button" class="fs-step" data-step="1" aria-label="The election after" title="The election after (→)">${FS_ICON.next}</button></div>
      <label class="fs-lane"><select aria-label="Which elections">${FS_LANES.map((n, k) => `<option value="${k}">${n}</option>`).join("")}</select></label>
      <div class="fs-rail" role="group" aria-label="Elections"></div>
      <div class="fs-card" aria-hidden="true" hidden></div>
    </div>
    <div class="fs-toast" aria-hidden="true" hidden></div>`;
  document.body.appendChild(el);
  const veil = document.createElement("div");
  veil.className = "fs-veil"; veil.hidden = true;
  document.body.insertBefore(veil, el);
  const q = (s) => $(s, el);
  Object.assign(FS, { el, veil, top: q(".fs-top"), lensbar: q(".fs-lensbar"), sbox: q(".fs-sbox"), tviews: q(".fs-tviews"), side: q(".fs-side"), grab: q(".fs-grab"), head: q(".fs-head"), meta: q(".fs-meta"), vslot: q(".fs-vslot"), lslot: q(".fs-lslot"), scroll: q(".fs-scroll"), showBtn: q(".fs-show"), dock: q(".fs-dock"), playBtn: q(".fs-play"), lane: q(".fs-lane select"), rail: q(".fs-rail"), toast: q(".fs-toast"), card: q(".fs-card") });
  q(".fs-x").addEventListener("click", () => fsExit());
  q(".fs-hide").addEventListener("click", () => fsPanel(false));
  FS.showBtn.addEventListener("click", () => fsPanel(true));
  FS.playBtn.addEventListener("click", () => fsPlay());
  for (const b of $$(".fs-step", el)) b.addEventListener("click", () => { fsStop(); walkYear(+b.dataset.step); });
  FS.lane.addEventListener("change", () => { fsStop(); const lane = LANES[+FS.lane.value]; if (lane && lane !== yearLane(S.year)) setYear(laneMem.get(lane) ?? lane[lane.length - 1]); });
  FS.rail.addEventListener("click", (e) => { const b = e.target.closest("[data-y]"); if (b) { fsStop(); setYear(yearOf(b.dataset.y)); requestAnimationFrame(() => { const nb = $(`.fs-stop[data-y="${b.dataset.y}"]`, FS.rail); if (nb && nb.matches(":hover")) fsCard(nb); }); } });
  // a stop under the pointer starts loading its election, so the click finds it ready
  FS.rail.addEventListener("pointerover", (e) => {
    const b = e.target.closest("[data-y]"); if (!b) return;
    const y = yearOf(b.dataset.y);
    if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120);
    if (e.pointerType === "mouse") fsCard(b);
  });
  FS.rail.addEventListener("pointerleave", () => fsCard(null));
  FS.rail.addEventListener("scroll", () => fsCard(null), { passive: true });
  // the panel's head shows the page's eyebrow line, whatever writes it
  new MutationObserver(() => { FS.meta.textContent = $("#mp-meta").textContent; }).observe($("#mp-meta"), { childList: true, characterData: true, subtree: true });
  // the plates' size is the map's clear ground: a change reframes a view the page framed
  new ResizeObserver(() => { if (FS.on && !FS.leaving) fsMeasure(false); }).observe(FS.dock);
  new ResizeObserver(() => { if (FS.on && !FS.leaving) fsMeasure(false); }).observe(FS.top);
  new ResizeObserver(() => { if (FS.on && !FS.leaving && FS.phone) fsMeasure(false); }).observe($("#legend"));
  fsSheetDrag();
}

/* ----- parking: the page's own elements in the plates, a stand-in in their place ----- */
function fsPark(el, into) {
  const r = el.getBoundingClientRect(), ph = document.createElement("div");
  ph.className = `${el.className} fs-ph`; ph.setAttribute("aria-hidden", "true");
  // the stage's stand-in takes its size from the page's own rules (the way out lands on it)
  if (el.id !== "stage") { ph.style.height = `${r.height}px`; if (el.matches(".mp-views, .mp-search")) ph.style.width = `${r.width}px`; }
  el.replaceWith(ph);
  into.appendChild(el);
  FS.parked.push([el, ph]);
  return ph;
}
// every piece home (the stage too unless keepStage), the last parked first
function fsUnpark(keepStage) {
  const keep = [];
  for (const [el, ph] of FS.parked.reverse()) { if (keepStage && el.id === "stage") keep.push([el, ph]); else ph.replaceWith(el); }
  FS.parked = keep;
}
// where each parked piece sits: the wide layout (a panel) or the phone's (a sheet)
function fsLayout() {
  const phone = isPhone(), views = $(".mp-views:not(.fs-ph)"), legend = $("#legend");
  FS.phone = phone; fsLaneNames();
  FS.el.classList.toggle("phone", phone);
  if (phone) {
    FS.tviews.appendChild(views);
    FS.scroll.prepend(legend);
    FS.grab.after(FS.dock);
  } else {
    FS.vslot.appendChild(views);
    FS.lslot.appendChild(legend);
    FS.el.appendChild(FS.dock);
    FS.sheetUp = false; FS.el.classList.remove("sheet-up");
  }
  FS.showBtn.hidden = phone || !FS.bare;
}

/* ----- the clear ground: the room the plates take at each edge, in stage px ----- */
function fsPeek() {
  // the sheet at rest: its handle, the dock, the key, and room for the story's first line
  const lg = $("#legend"), key = lg && !lg.hidden ? lg.offsetHeight : 0;
  return Math.round(Math.min(FS.grab.offsetHeight + FS.dock.offsetHeight + key + 54, FS.el.clientHeight * 0.48));
}
function fsMeasure(quiet) {
  if (!FS.on || !FS.el) return false;
  const el = FS.el, H = el.clientHeight, g = FS.phone ? 8 : 14;
  const t = FS.top.offsetTop + FS.top.offsetHeight;
  let ins;
  if (FS.phone) {
    const peek = fsPeek();
    el.style.setProperty("--fs-peek", `${peek}px`);
    ins = { t, r: 0, b: peek, l: 0 };
  } else ins = { t, r: g, b: H - FS.dock.offsetTop, l: g + (FS.bare ? 0 : FS.side.offsetWidth + g) };
  for (const k of ["t", "r", "b", "l"]) el.style.setProperty(`--fs-${k}`, `${ins[k]}px`);
  const same = ["t", "r", "b", "l"].every((k) => Math.abs(FS.ins[k] - ins[k]) < 0.5);
  FS.ins = ins;
  if (same || quiet) return !same;
  // the plates moved (the panel hid or came back, the sheet's key grew): a view the page
  // framed glides to its fit in the new ground; one the reader moved stays where it is
  const framed = S.view === "map" && M() && (atLastFit() || !!flight || T.k <= HOME.k * 1.001);
  if (M()) setExtent();
  if (framed) fitSelection(reduceMotion ? 0 : 420);
  schedule();
  return true;
}
// the clear ground's centre, in stage px
function fsMid(p = stagePads()) { return [p.l + (Wpx - p.l - p.r) / 2, p.t + (Hpx - p.t - p.b) / 2]; }

/* ----- in ----- */
function fsEnter(o = {}) {
  if (FS.on || FS.leaving || !M()) return;
  fsBuild();
  const stage = $("#stage"), r0 = stage.getBoundingClientRect(), T0 = T;
  const framed = S.view !== "map" || atLastFit() || !!flight || T.k <= HOME.k * 1.001;
  const c0 = [(r0.width / 2 - T.x) / T.k, (r0.height / 2 - T.y) / T.k]; // the world point the reader had in the middle
  // the browser's own full screen, asked in the press itself (it refuses one asked later)
  FS.native = false;
  if (o.native !== false && fsCanNative()) {
    const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
    try {
      const p = req.call(de, { navigationUI: "hide" });
      FS.native = true;
      if (p && p.catch) p.catch(() => { FS.native = false; });
    } catch (e) { FS.native = false; }
  }
  FS.scrollY = window.scrollY;
  hideTip(); $("#sugg").hidden = true;
  // the stage behind the plates, the rest into theirs
  const el = FS.el;
  FS.parked = [];
  FS.stagePh = fsPark(stage, el);
  el.prepend(stage);
  fsPark($("#lenses"), FS.lensbar);
  fsPark($(".mp-views"), FS.vslot);
  // (a phone's search stands atop the map in the page: the panel's plate takes it back)
  FS.on = true; placeSearch(); FS.on = false;
  fsPark($("#legend"), FS.lslot);
  fsPark($("#story"), FS.scroll);
  FS.meta.textContent = $("#mp-meta").textContent;
  FS.inert = [...document.body.children].filter((c) => c !== el && c !== FS.veil && c.id !== "tip" && c.tagName !== "SCRIPT" && !c.inert);
  for (const c of FS.inert) c.inert = true;
  document.documentElement.classList.add("mp-fs", "mp-fs-lock");
  el.hidden = false; FS.veil.hidden = false;
  FS.on = true;
  fsLayout(); fsView();
  el.classList.toggle("bare", FS.bare && !FS.phone);
  fsMeasure(true);
  const anim = !reduceMotion && o.animate !== false && !FS.native && r0.width > 0 && r0.bottom > 0 && r0.top < innerHeight;
  // the camera: held where it stood on screen as the frame opens round it, then flown to its fit
  FS.move = () => {
    if (S.view !== "map") return;
    const s = d3.select(canvas);
    if (anim) s.interrupt().call(zoom.transform, d3.zoomIdentity.translate(T0.x + r0.left, T0.y + r0.top).scale(T0.k));
    if (framed) { fitSelection(anim ? 760 : 0); return; }
    const k = Math.max(T0.k, HOME.k), [mx, my] = fsMid(), t1 = d3.zoomIdentity.translate(mx - c0[0] * k, my - c0[1] * k).scale(k);
    if (anim) fly(t1, 760); else { glideCancel(); flight = null; s.interrupt().call(zoom.transform, t1); }
  };
  resize();
  FS.move = null;
  renderLegend(); renderTimeline(); lensOverflow(); fitSearchPlaceholder(); updateHint(); renderBack();
  paintMiniChamber();
  fsPlayUI();
  FS.place = fsPlace();
  fsPlate();
  if (anim) {
    const W = innerWidth, H = innerHeight;
    el.animate([{ clipPath: `inset(${r0.top}px ${W - r0.right}px ${H - r0.bottom}px ${r0.left}px round 4px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 640, easing: FS_EASE });
    FS.veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-out" });
  }
  fsPlatesIn(anim ? 230 : 40);
  if (o.push !== false) { try { history.pushState({ mpFs: 1 }, "", location.href); FS.pushed = true; } catch (e) {} }
  writeURL();
  el.focus({ preventScroll: true });
  fsToast(anim ? 900 : 500);
}
// the plates come in a beat after the frame opens, each from its own edge
function fsPlatesIn(delay) {
  if (reduceMotion) return;
  const phone = FS.phone, list = [
    [FS.side, phone ? "translateY(40px)" : "translateX(-14px)"], [FS.showBtn, "translateX(-10px)"],
    [FS.top, "translateY(-10px)"], [FS.dock, phone ? "none" : "translateY(10px)"],
    [$("#zoomer"), "translateX(8px)"], [$(".mp-tl"), "none"],
  ];
  list.forEach(([e, from], k) => { if (e && !e.hidden) e.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 460, delay: delay + k * 35, easing: FS_EASE, fill: "backwards" }); });
}

/* ----- out ----- */
async function fsExit(o = {}) {
  if (!FS.on || FS.leaving) return;
  FS.leaving = true;
  fsStop(); fsToastOff(); fsCard(null);
  hideTip(); $("#sugg").hidden = true;
  const el = FS.el, wasNative = FS.native || !!fsNativeEl();
  if (fsNativeEl() && !o.fromNative) {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    try { await ex.call(document); } catch (e) {}
  }
  FS.native = false;
  // (the browser's own full screen hands the window back over a frame or two)
  if (wasNative) await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const anim0 = !reduceMotion && !wasNative && !o.fromNative;
  // the plates fade, then the page's own pieces go home ahead of the stage, so the page
  // stands whole behind the closing frame (and the stage's spot is measured as it will be)
  if (anim0) { el.classList.add("leaving"); await new Promise((r) => setTimeout(r, 150)); }
  fsUnpark(true);
  ebHeights.clear(); holdEyebrow();
  renderLegend(); lensOverflow(); fitSearchPlaceholder(); paintMiniChamber();
  document.documentElement.classList.remove("mp-fs-lock");
  try { window.scrollTo({ top: FS.scrollY, behavior: "instant" }); } catch (e) { window.scrollTo(0, FS.scrollY); }
  const r1 = FS.stagePh.getBoundingClientRect();
  const framed = S.view !== "map" || atLastFit() || !!flight || T.k <= HOME.k * 1.001;
  const anim = anim0 && r1.width > 0 && r1.bottom > 0 && r1.top < innerHeight;
  // where the page's stage will frame the map: the selection's fit, or the reader's own
  // middle and zoom (no further out than the page's whole-country fit)
  let Tin = null;
  if (S.view === "map" && M()) {
    const pp = stagePads(true);
    if (framed) Tin = fitFor(selectionBox(), r1.width, r1.height, pp);
    else {
      const [mx, my] = fsMid(), c = [(mx - T.x) / T.k, (my - T.y) / T.k];
      const k = Math.max(T.k, fitFor(homeBox(M()), r1.width, r1.height, pp).k);
      Tin = d3.zoomIdentity.translate(pp.l + (r1.width - pp.l - pp.r) / 2 - c[0] * k, pp.t + (r1.height - pp.t - pp.b) / 2 - c[1] * k).scale(k);
    }
  }
  if (anim) {
    // the map flies to the spot it will stand on in the page as the frame closes onto it
    if (Tin) fly(d3.zoomIdentity.translate(Tin.x + r1.left, Tin.y + r1.top).scale(Tin.k), 500);
    const W = innerWidth, H = innerHeight;
    const a = el.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: `inset(${r1.top}px ${W - r1.right}px ${H - r1.bottom}px ${r1.left}px round 4px)` }], { duration: 520, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" });
    const v = FS.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 120, easing: "ease-in-out", fill: "forwards" });
    try { await a.finished; } catch (e) {}
    FS.exitAnims = [a, v];
  }
  // everything back in its place
  fsUnpark();
  for (const c of FS.inert) c.inert = false;
  FS.inert = [];
  FS.on = false;
  el.hidden = true; FS.veil.hidden = true;
  el.classList.remove("leaving", "sheet-up");
  FS.sheetUp = false;
  if (FS.exitAnims) { for (const a of FS.exitAnims) a.cancel(); FS.exitAnims = null; }
  document.documentElement.classList.remove("mp-fs");
  FS.ins = { t: 0, r: 0, b: 0, l: 0 };
  fsPlate();
  FS.move = () => {
    if (S.view !== "map") return;
    if (framed) fitSelection(0);
    else if (Tin) { glideCancel(); flight = null; d3.select(canvas).interrupt().call(zoom.transform, Tin); }
  };
  resize();
  FS.move = null;
  ebHeights.clear(); holdEyebrow();
  renderLegend(); renderTimeline(); lensOverflow(); fitSearchPlaceholder(); updateHint(); renderBack(); updateCanvasVis();
  paintMiniChamber();
  FS.leaving = false;
  if (FS.pushed && !o.fromHistory) { FS.pushed = false; FS.skipPop = true; try { history.back(); } catch (e) { FS.skipPop = false; } }
  FS.pushed = false;
  writeURL();
  const b = $("#fsgo");
  if (b && !b.closest("[hidden]")) b.focus({ preventScroll: true });
}

/* ----- the panel, the sheet ----- */
function fsPanel(show) {
  if (!FS.on || FS.phone) return;
  FS.bare = !show;
  FS.el.classList.toggle("bare", FS.bare);
  FS.showBtn.hidden = show;
  fsMeasure(false);
  (show ? $(".fs-hide", FS.el) : FS.showBtn).focus({ preventScroll: true });
}
function fsSheet(up) {
  FS.sheetUp = !!up;
  FS.el.classList.toggle("sheet-up", FS.sheetUp);
  FS.grab.setAttribute("aria-label", FS.sheetUp ? "Show less of the story" : "Show more of the story");
  if (!FS.sheetUp) FS.scroll.scrollTop = 0;
}
// the sheet follows the finger up and down: from its handle, the dock and the key at
// rest, and from the story once it is up and read back to its top (pulled down)
function fsSheetDrag() {
  const side = FS.side;
  let g = null;
  side.addEventListener("touchstart", (e) => {
    g = null;
    if (!FS.phone || e.touches.length !== 1) return;
    const t = e.touches[0];
    g = { y0: t.clientY, x0: t.clientX, base: FS.sheetUp ? 0 : side.offsetHeight - fsPeek(), on: false, inStory: !!e.target.closest(".fs-scroll"), ly: t.clientY, lt: performance.now(), v: 0 };
  }, { passive: true });
  side.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0], dy = t.clientY - g.y0, dx = t.clientX - g.x0;
    if (!g.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g = null; return; }
      if (Math.abs(dy) < 7) return;
      if (g.inStory && FS.sheetUp && (FS.scroll.scrollTop > 0 || dy < 0)) { g = null; return; }
      g.on = true; side.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    g.v = (t.clientY - g.ly) / Math.max(1, now - g.lt); g.ly = t.clientY; g.lt = now;
    const max = side.offsetHeight - fsPeek(), y = g.base + dy;
    side.style.transform = `translateY(${y < 0 ? y / 4 : y > max ? max + (y - max) / 4 : y}px)`;
  }, { passive: false });
  const end = () => {
    const d = g; g = null;
    if (!d || !d.on) return;
    const max = side.offsetHeight - fsPeek(), y = d.base + (d.ly - d.y0);
    side.style.transition = ""; side.style.transform = "";
    fsSheet(d.v < -0.35 ? true : d.v > 0.35 ? false : y < max / 2);
  };
  side.addEventListener("touchend", end);
  side.addEventListener("touchcancel", end);
  FS.grab.addEventListener("click", () => fsSheet(!FS.sheetUp));
  FS.grab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fsSheet(!FS.sheetUp); } });
}
// the view's own rules: the plates know whether the map, the chamber or the list is up
function fsView() {
  if (!FS.el) return;
  for (const v of ["map", "chamber", "list"]) FS.el.classList.toggle(`v-${v}`, S.view === v);
}

/* ----- the dock: the elections of the jurisdiction on show, as a rail ----- */
function fsStopName(y) {
  if (y === "now") return "The House today";
  if (isNowY(y)) return "The Assembly today";
  if (STATE_YEARS.has(y)) return `${stateAdj(y)} election, 20${String(y).slice(-2)}`;
  return `${y} federal election`;
}
// who held the chosen seat at each stop on its rail (its history's rows: [year, Labor 2PP, party, member, by-election])
function fsHolder(m, i, y) {
  const d = m.divs[i], hh = d.h || [];
  if (isNowY(y)) {
    if (m.year === y) return holdFam(d.hold);
    const nw = Y[y] && Y[y].divs ? Y[y].byName.get(d.n) : null;
    if (nw != null) return holdFam(Y[y].divs[nw].hold);
    const by = hh.filter((r) => r[4]).pop();
    return by ? FAM(by[2]) : null;
  }
  if (y === m.year) return holdFam(d.hold);
  const r = hh.find((x) => x[0] === y && !x[4]);
  return r ? FAM(r[2]) : null;
}
function fsRail() {
  if (!FS.el || !FS.on) return;
  const lane = yearLane(S.year), li = LANES.indexOf(lane), m = M(), sd = m ? selDiv() : null;
  if (FS.lane.value !== String(li)) FS.lane.value = String(li);
  fsLaneWidth();
  const was = $(".fs-stop.on", FS.rail), r0 = was ? was.getBoundingClientRect() : null, y0 = was ? was.dataset.y : null;
  const sen = senOn();
  // (two-figure years on a rail too narrow for four: a phone's, or a narrow window's)
  const short = FS.phone || FS.rail.clientWidth < lane.length * 56;
  FS.rail.classList.toggle("short", short);
  let h = "";
  for (const y of lane) {
    const on = y === S.year, lab = isNowY(y) ? "Now" : short ? `’${String(y).slice(-2)}` : STATE_YEARS.has(y) ? `20${String(y).slice(-2)}` : String(y);
    let mk = "";
    if (sd != null && m && !sen) {
      const f = fsHolder(m, sd, y);
      mk = `<i class="fs-mk seat"${f ? ` style="background:var(--m-${f})"` : ""}></i>`;
    } else {
      // the House's make-up then (or the Senate's, in its chamber), as the timeline draws it
      const s = fsMix(y);
      mk = `<i class="fs-mk">${s ? ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((f) => s[f]).map((f) => `<b style="flex:${s[f]};background:var(--m-${f})"></b>`).join("") : ""}</i>`;
    }
    h += `<button type="button" class="fs-stop${on ? " on" : ""}" data-y="${y}" aria-pressed="${on}" title="${esc(fsStopName(y))}">${mk}<span class="fs-yr" data-t="${esc(lab)}">${esc(lab)}</span><u><s></s></u></button>`;
  }
  FS.rail.innerHTML = h;
  if (FS.card && !FS.card.hidden) { const b = $(`.fs-stop[data-y="${FS.card.dataset.y}"]`, FS.rail); fsCard(b && b.matches(":hover") ? b : null); }
  const k = lane.indexOf(S.year);
  for (const b of $$(".fs-step", FS.el)) b.disabled = +b.dataset.step < 0 ? k <= 0 : k >= lane.length - 1;
  const now = $(".fs-stop.on", FS.rail);
  if (!now) return;
  // the stop chosen comes into view on a rail that scrolls (a phone's), and its mark glides over from the last
  const rr = FS.rail.getBoundingClientRect(), nr = now.getBoundingClientRect();
  if (nr.left < rr.left + 8 || nr.right > rr.right - 8) FS.rail.scrollTo({ left: FS.rail.scrollLeft + nr.left - rr.left - (rr.width - nr.width) / 2, behavior: reduceMotion ? "auto" : "smooth" });
  if (r0 && y0 !== String(S.year) && !reduceMotion) {
    const u = $("u", now), n1 = now.getBoundingClientRect();
    if (Math.abs(r0.left - n1.left) > 0.5) u.animate([{ transform: `translateX(${r0.left - n1.left}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(.65,0,.35,1)" });
  }
  if (FS.play && FS.progMs) fsProg(FS.progMs, FS.progAt);
}

// the jurisdiction's select as wide as the name it shows (a select runs to its longest option)
let fsLaneCtx = null;
function fsLaneNames() {
  if (!FS.lane) return;
  const cs = getComputedStyle(FS.lane), cap = FS.phone ? parseFloat(cs.maxWidth) || 0 : 0;
  if (!fsLaneCtx) fsLaneCtx = document.createElement("canvas").getContext("2d");
  fsLaneCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  for (const opt of FS.lane.options) {
    const full = FS_LANES[+opt.value];
    const want = (cap && fsLaneCtx.measureText(full).width + pad > cap) ? (FS_LANE_ABBR[full] || full) : full;
    if (opt.text !== want) opt.text = want;
  }
}
function fsLaneWidth() {
  const sel = FS.lane, cs = getComputedStyle(sel);
  if (!fsLaneCtx) fsLaneCtx = document.createElement("canvas").getContext("2d");
  fsLaneCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const t = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
  sel.style.width = `${Math.ceil(fsLaneCtx.measureText(t).width + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2)}px`;
}

/* ----- play: each election of the rail in turn, resting on each once the map has turned ----- */
function fsPlayUI() {
  if (!FS.playBtn) return;
  const on = !!FS.play;
  FS.playBtn.innerHTML = on ? FS_ICON.pause : FS_ICON.play;
  FS.playBtn.setAttribute("aria-label", on ? "Pause" : "Play through the elections");
  FS.playBtn.title = on ? "Pause (Space)" : "Play through the elections (Space)";
  FS.playBtn.classList.toggle("on", on);
  FS.el.classList.toggle("playing", on);
  FS.playBtn.disabled = yearLane(S.year).length < 2;
}
// the stop's rule fills while the play-through rests on it
function fsProg(ms, at = performance.now()) {
  FS.progMs = ms; FS.progAt = at;
  const fill = $(".fs-stop.on u s", FS.rail);
  if (!fill || reduceMotion) return;
  const a = fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: ms, easing: "linear", fill: "both" });
  a.currentTime = Math.min(ms, performance.now() - at);
}
async function fsPlay() {
  if (FS.play) { fsStop(); return; }
  const lane = yearLane(S.year);
  if (lane.length < 2) return;
  const tok = { t: 0, r: null };
  FS.play = tok;
  fsPlayUI(); fsToastOff();
  let i = lane.indexOf(S.year);
  if (i >= lane.length - 1) i = -1; // from the end, the run starts again from the first
  while (FS.play === tok && ++i < lane.length) {
    const y = lane[i];
    FS.progMs = 0;
    FS.auto = true;
    let p;
    try { p = setYear(y); } finally { FS.auto = false; }
    await p;
    if (FS.play !== tok || S.year !== y) return;
    if (i === lane.length - 1) break;
    // the next election loads while this one rests
    const nx = lane[i + 1];
    if (!Y[nx]) loadYear(nx, true).catch(() => {});
    const hold = (ymorph ? ymorph.dur : 300) + FS_HOLD;
    fsProg(hold);
    await new Promise((r) => { tok.r = r; tok.t = setTimeout(r, hold); });
  }
  if (FS.play === tok) fsStop();
}
function fsStop() {
  const p = FS.play;
  if (!p) return;
  FS.play = null; FS.progMs = 0;
  clearTimeout(p.t); if (p.r) p.r();
  const fill = $(".fs-stop.on u s", FS.rail);
  if (fill && fill.getAnimations) for (const a of fill.getAnimations()) a.cancel();
  fsPlayUI();
}

// the election stands on a wide screen's map, its title plate, for as long as the view lasts
function fsPlate() {
  if (stampEl.classList.contains("wait")) return;
  if (FS.on && !FS.phone) { showStamp(S.year, 1); stampDone(); }
  else { clearTimeout(stampOff); stampEl.classList.remove("on"); }
}

/* ----- a stop's card: the election, its date, the House it made (or the chosen seat's result) ----- */
// the seat's result at a stop: its member, party and Labor two-party share then
function fsSeatAt(m, i, y) {
  const d = m.divs[i], hh = d.h || [];
  if (isNowY(y)) {
    const nm = m.year === y ? m : Y[y] && Y[y].divs ? Y[y] : null, j = nm ? (nm === m ? i : nm.byName.get(d.n)) : null;
    if (j != null) { const h = nm.divs[j].hold; return { fam: holdFam(h), who: h.n, party: h.pn || partyName(h.ab), tpp: null }; }
    const by = hh.filter((r) => r[4]).pop();
    return by ? { fam: FAM(by[2]), who: by[3], party: partyName(by[2]), tpp: by[1] } : null;
  }
  const r = hh.find((x) => x[0] === y && !x[4]);
  return r ? { fam: FAM(r[2]), who: r[3], party: partyName(r[2]), tpp: r[1] } : y === m.year ? { fam: holdFam(d.hold), who: d.hold.n, party: d.hold.pn, tpp: null } : null;
}
function fsMix(y) {
  const sen = senOn(), st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
  return sen ? SENY[y] && senCounts(SENY[y], (d) => st === "AUS" || d.st === st) : SUM && SUM.seats[y] ? SUM.seats[y][st] : st !== "NSW" && META_FACTS.mix && META_FACTS.mix[y];
}
function fsCard(b) {
  const card = FS.card;
  if (!card) return;
  if (!b || FS.phone) { card.hidden = true; card.dataset.y = ""; return; }
  const y = yearOf(b.dataset.y), m = M(), sd = m ? selDiv() : null, sen = senOn();
  const f = META_FACTS.house && META_FACTS.house[y];
  let h = "";
  if (sd != null && m && !sen) {
    const r = fsSeatAt(m, sd, y);
    h = `<div class="fs-cd-t">${ds(m.divs[sd].n)} <span>${esc(fsStopName(y))}</span></div>`
      + (r ? `<div class="fs-cd-seat"><i style="background:var(--m-${r.fam})"></i><span><b>${ds(r.who)}</b> ${esc(r.party)}</span></div>${r.tpp != null ? `<div class="fs-cd-s">Labor two-party ${f1(r.tpp)}%</div>` : ""}`
        : `<div class="fs-cd-s">No seat of that name at this election</div>`);
  } else {
    const s = fsMix(y), date = f ? (isNowY(y) ? `As it stands, ${longDate(f[0])}` : longDate(f[0])) : "";
    h = `<div class="fs-cd-t">${esc(sen ? fsStopName(y).replace("The House today", "The Senate today") : fsStopName(y))}</div>${date && !sen ? `<div class="fs-cd-s">${esc(date)}</div>` : ""}`;
    if (s) {
      const fams = ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((k) => s[k]), tot = sum(fams.map((k) => s[k])), maj = Math.floor(tot / 2) + 1;
      h += `<div class="fs-cd-bar">${fams.map((k) => `<b style="flex:${s[k]};background:var(--m-${k})"></b>`).join("")}<u style="left:${((maj / tot) * 100).toFixed(2)}%"></u></div>`
        + `<div class="fs-cd-n">${fams.slice().sort((a, c) => s[c] - s[a]).map((k) => `<span><i style="background:var(--m-${k})"></i>${famTag(k)} <b>${s[k]}</b></span>`).join("")}</div>`;
    }
  }
  const first = card.hidden;
  fsToastOff(); // (the keys' word gives way to the card it would cover)
  card.innerHTML = h; card.hidden = false; card.dataset.y = String(y);
  // over its stop, kept on the dock
  const dr = FS.dock.getBoundingClientRect(), br = b.getBoundingClientRect(), w = card.offsetWidth;
  card.style.left = `${clamp(br.left + br.width / 2 - dr.left - w / 2, 6, dr.width - w - 6)}px`;
  if (first && !reduceMotion) card.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
}

/* ----- the panel's story: a new place starts at its top; a change fades in ----- */
const fsPlace = () => (senOn() ? ["sen", S.ssel.level, S.ssel.st, S.ssel.i] : [S.view === "chamber" ? "ch" : "map", S.sel.level, S.sel.st, S.sel.div, S.sel.booth]).join("|");
function fsStory(changed) {
  const p = fsPlace();
  if (p !== FS.place) { FS.place = p; if (FS.scroll) FS.scroll.scrollTop = 0; }
  if (changed && !reduceMotion && !FS.leaving) $("#story").animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
}

/* ----- a first visit's word on the keys (wide screens), once a session ----- */
function fsToast(delay) {
  if (FS.phone || !FS.toast) return;
  try { if (sessionStorage.getItem("mp.fsToast")) return; sessionStorage.setItem("mp.fsToast", "1"); } catch (e) {}
  FS.toast.innerHTML = `<kbd>←</kbd> <kbd>→</kbd> step through the elections · <kbd>Space</kbd> plays them · <kbd>Esc</kbd> leaves`;
  clearTimeout(FS.toastT);
  FS.toastT = setTimeout(() => {
    if (!FS.on) return;
    FS.toast.hidden = false;
    if (!reduceMotion) FS.toast.animate([{ opacity: 0, transform: "translate(-50%, 6px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 380, easing: FS_EASE });
    FS.toastT = setTimeout(fsToastOff, 5200);
  }, delay);
}
function fsToastOff() {
  clearTimeout(FS.toastT);
  const t = FS.toast;
  if (!t || t.hidden) return;
  if (reduceMotion) { t.hidden = true; return; }
  t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in" }).finished.then(() => { t.hidden = true; }, () => { t.hidden = true; });
}

/* ----- the ways in and out ----- */
$("#fsgo").addEventListener("click", () => fsEnter());
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === "f" || e.key === "F") && !e.repeat) { e.preventDefault(); if (FS.on) fsExit(); else fsEnter(); return; }
  if (!FS.on) return;
  fsToastOff();
  // Esc walks back up from a seat or state (the page's own handler); from the whole map it leaves
  if (e.key === "Escape" && (senOn() ? S.ssel.level === "aus" : S.sel.level === "aus")) { e.preventDefault(); fsExit(); return; }
  if (e.key === " " && !e.target.closest("button, a, [role=tab], [role=button]")) { e.preventDefault(); fsPlay(); }
}, true);
for (const ev of ["pointerdown", "wheel"]) addEventListener(ev, () => { if (FS.on) fsToastOff(); }, { passive: true, capture: true });
const fsNativeChange = () => { if (FS.on && !FS.leaving && FS.native && !fsNativeEl()) fsExit({ fromNative: true }); };
document.addEventListener("fullscreenchange", fsNativeChange);
document.addEventListener("webkitfullscreenchange", fsNativeChange);
// Back leaves the view (its own history entry); Forward comes back into it (without the browser's own full screen)
addEventListener("popstate", (e) => {
  if (FS.skipPop) { FS.skipPop = false; writeURL(); return; }
  const want = !!(e.state && e.state.mpFs);
  if (FS.on && !want) { FS.pushed = false; fsExit({ fromHistory: true }); }
  else if (!FS.on && want && M()) { fsEnter({ native: false, push: false }); FS.pushed = true; }
});
// a phone turned (or a window dragged) across the wide layout's edge re-seats the plates
PHONE.addEventListener("change", () => { if (!FS.on) return; fsLayout(); renderLegend(); fsMeasure(true); resize(); fsRail(); fsPlate(); });

/* =============================== the retro view ===============================
   The page itself as a website from about 2000 (retro.css draws it): a navy
   banner with the flag, the title and Parliament House; a navbar over it in
   the era's words — Home, Edit, View, Favorites, Help — every one of them
   working on this page (find a seat, copy the view's link, clear the filters,
   switch views, full screen, city names, saved views, the notes), with the
   site's pages at its right; tab buttons for the views; and the old system
   face for every control — bevelled grey buttons, sunken white fields, navy
   caption bars over the panels. No pretend browser or desktop around it. The
   page's own elements are restyled, never rebuilt, so every control keeps
   working; this part adds only the navbar, the banner and the tab row
   (hidden outside the view), with "Modern view" at the row's end.
   The choice persists in this browser (localStorage), and the hash carries
   retro=1 so a shared link opens in it; an inline script in the page's head
   sets the class before the first paint. Favorites are views saved in this
   browser too (their links: a pick reloads the page on that view, since the
   map reads its link when it loads). The canvases take a flat palette
   (retroTheme, read by readTheme), and the look stays light whatever the
   device's theme, as the era's did. */
const RT_KEY = "auspol.map.retro", RT_FAV_KEY = "auspol.map.favs";
// (a function, so code anywhere in the closure can ask before this part has run)
function rtIsOn() { return typeof document !== "undefined" && document.documentElement.classList.contains("mp-retro"); }
/* the canvases' flat palette: the page's paper for the sea and the ground
   (no atlas sea, no graticule: their inks are the paper's), black lines and
   lettering; the party colours are the map's own */
function retroTheme(T) {
  T.bg = [236, 233, 226]; T.surface = [255, 255, 255];
  T.sea = [229, 226, 218]; T.seaLine = T.sea; T.seaMark = T.sea; T.seaInk = T.sea;
  T.nodata = [218, 215, 207]; T.mid = [204, 200, 192]; T.hatch = [160, 156, 148];
  T.coast = [70, 70, 70]; T.state = [0, 0, 0];
  T.ink = [0, 0, 0]; T.ink2 = [32, 32, 32]; T.ink3 = [64, 64, 64]; T.faint = [128, 128, 128];
  T.line = [160, 160, 160]; T.line2 = [190, 190, 190];
  T.floor = [214, 226, 212];
  return T;
}
const RT = { built: false, drop: null, dropFor: null, dropKey: null, items: null };
const RT_ICON = {
  fs: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
  modern: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.4 2.2v2.6h2.6"/></svg>`,
  shade: `<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 6.5h7" stroke="#000" stroke-width="1.8"/></svg>`,
  unshade: `<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 1.5h7v6H1z M1 2.5h7" fill="none" stroke="#000" stroke-width="1.2"/></svg>`,
  dd: `<svg width="7" height="4" viewBox="0 0 7 4" aria-hidden="true"><path d="M0 0h7L3.5 4z" fill="currentColor"/></svg>`,
  home: `<svg class="rt-ic" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.6 8 8 2.2 14.4 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.6 7v7h3.2v-4h2.4v4h3.2V7" fill="currentColor"/></svg>`,
  star: `<svg class="rt-ic" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z" fill="#ffd21c" stroke="#a36a00" stroke-linejoin="round"/></svg>`,
  x: `<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.5"/></svg>`,
};
// a star of n points about (cx, cy), outer radius r, inner ratio k
const rtStar = (cx, cy, r, n = 7, k = 0.44) => {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * k : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); }
  return `<polygon points="${pts.join(" ")}" fill="#fff"/>`;
};
// the flag, drawn flat at 2:1: the Union Jack in the canton, the Commonwealth Star under it, the Southern Cross on the fly
function rtFlagSVG() {
  const uj = `<g><rect width="30" height="15" fill="#00247d"/><path d="M0 0l30 15M30 0L0 15" stroke="#fff" stroke-width="3"/><path d="M0 0l30 15M30 0L0 15" stroke="#cf142b" stroke-width="1"/><path d="M15 0v15M0 7.5h30" stroke="#fff" stroke-width="5"/><path d="M15 0v15M0 7.5h30" stroke="#cf142b" stroke-width="3"/></g>`;
  return `<svg class="rt-flag" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="30" fill="#00247d"/>${uj}${rtStar(15, 22.5, 4.2)}${rtStar(45, 25.2, 2.3)}${rtStar(37.6, 14.4, 2.3)}${rtStar(45, 5, 2.3)}${rtStar(51.4, 12.5, 2.1)}${rtStar(48, 17.4, 1.2, 5, 0.42)}</svg>`;
}
// Parliament House, from the front: the long low house, its curved walls into the hill, the four-legged flagmast
function rtHouseSVG() {
  return `<svg class="rt-house" viewBox="0 0 210 58" aria-hidden="true"><g fill="none" stroke="#cfe0ff" stroke-width="1.1" stroke-linecap="round" opacity=".85">
    <path d="M6 56 Q40 44 70 41 L140 41 Q170 44 204 56" />
    <path d="M70 41 V36 H140 V41 M74 36 V41 M80 36 V41 M86 36 V41 M92 36 V41 M98 36 V41 M112 36 V41 M118 36 V41 M124 36 V41 M130 36 V41 M136 36 V41" />
    <path d="M100 36 V30 H110 V36" /><path d="M66 36 H144" />
    <path d="M90 41 L105 2 L120 41 M96 41 L105 2 L114 41" stroke-width=".9"/>
    <path d="M98.6 19 H111.4 M95.4 28 H114.6" stroke-width=".7"/></g>
    <path d="M105.6 2.4 h10 v6 h-10z" fill="#00247d" stroke="#cfe0ff" stroke-width=".6"/><path d="M105.6 2.4 h4 v3 h-4z" fill="#cf142b" opacity=".85"/></svg>`;
}
// the site's pages, read off the shell's own tabs and More menu (so they never drift from it); the home page is the navbar's Home
function rtPages() {
  const tabs = $$(".sh-tabs-set a.sh-tab").map((a) => ({ label: (a.querySelector(".sh-tab-long") || a).textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href") })).filter((p) => p.href !== "/");
  const more = $$("#sh-menu a.sh-menu-item").filter((a) => !tabs.some((t) => t.href === a.getAttribute("href"))).map((a) => ({ label: (a.querySelector(".sh-menu-t") || a).textContent.trim(), href: a.getAttribute("href"), on: a.dataset.id === "map" }));
  return { tabs, more };
}

/* ----- building the navbar, the banner and the tab row (once; retro.css hides them outside the view) ----- */
function rtBuild() {
  if (RT.built) return;
  const sec = $(".mp-sec"), eb = $(".mp-sec > .rd-eyebrow");
  if (!sec || !eb) return;
  RT.built = true;
  const { tabs: pages } = rtPages();
  const menu = (k, label, extra = "") => `<button type="button" class="rt-ni" data-rt-menu="${k}" aria-haspopup="menu" aria-expanded="false">${extra}${label}</button>`;
  const top = document.createElement("div");
  top.className = "rt-top rt-only";
  top.innerHTML = `<nav class="rt-nav" aria-label="Site and page">
      <a class="rt-ni" href="/" title="auspol tracker’s home page">${RT_ICON.home}Home</a>${menu("edit", "Edit")}${menu("view", "View")}${menu("fav", "Favorites", RT_ICON.star)}${menu("help", "Help")}
      <span class="rt-navgap"></span>
      <span class="rt-pages">${pages.map((p) => `<a href="${esc(p.href)}">${esc(p.label)}</a>`).join("")}${menu("more", `More pages ${RT_ICON.dd}`)}</span>${menu("pages", `Pages ${RT_ICON.dd}`).replace('class="rt-ni"', 'class="rt-ni rt-pagesb"')}
    </nav>
    <div class="rt-banner"><a class="rt-home" href="/" title="auspol tracker: the interactive tracker">${rtFlagSVG()}</a><div class="rt-bcol"><a class="rt-kicker" href="/">auspol tracker</a><span class="rt-bline"><span class="rt-btitle" aria-hidden="true">Electoral map</span><span class="rt-bmeta" aria-hidden="true"></span></span></div>${rtHouseSVG()}</div>
    <div class="rt-tabs" role="tablist" aria-label="View"></div>`;
  eb.before(top);
  // the view tabs: proxies for the eyebrow's switch (it parks in full screen's plate), full screen, and the way back
  const row = top.querySelector(".rt-tabs");
  for (const b of $$(".mp-views [data-view]")) {
    const t = document.createElement("button");
    t.type = "button"; t.setAttribute("role", "tab"); t.dataset.rtView = b.dataset.view;
    t.innerHTML = `${b.querySelector("svg") ? b.querySelector("svg").outerHTML : ""}<span class="rt-tl">${esc(b.textContent.trim())}</span>`;
    row.append(t);
  }
  row.insertAdjacentHTML("beforeend", `<button type="button" data-rt-do="fs" title="Full screen (F)">${RT_ICON.fs}<span class="rt-tl">Full screen</span></button><button type="button" class="rt-modern" data-rt-do="modern" title="Back to the modern look">${RT_ICON.modern}<span class="rt-tl">Modern view</span></button>`);
  const drop = document.createElement("div");
  drop.className = "rt-drop"; drop.hidden = true; drop.setAttribute("role", "menu");
  document.body.append(drop);
  RT.drop = drop;
  // the meta line mirrors into the banner; the view switch's choice into the tabs
  const meta = $("#mp-meta");
  if (meta) new MutationObserver(() => rtSync()).observe(meta, { childList: true, characterData: true, subtree: true });
  const mv = $(".mp-views");
  if (mv) new MutationObserver(() => rtSync()).observe(mv, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
  // the left panel's caption keeps its shade button through every story render
  const story = $("#story");
  if (story) new MutationObserver(() => rtShadeBtn()).observe(story, { childList: true });
}
// the panel caption's little button rolls the panel up to its caption, as the old panels did
function rtShadeBtn() {
  if (!rtIsOn()) return;
  const h = $("#story .st-head h2");
  if (!h || h.querySelector(".rt-shade")) return;
  const shut = $("#story").classList.contains("rt-shut");
  h.insertAdjacentHTML("beforeend", `<button type="button" class="rt-shade" data-rt-do="shade" aria-expanded="${!shut}" aria-label="${shut ? "Open" : "Roll up"} the panel" title="${shut ? "Open" : "Roll up"} the panel">${shut ? RT_ICON.unshade : RT_ICON.shade}</button>`);
}
function rtSync() {
  if (!RT.built) return;
  const meta = $("#mp-meta"), bm = $(".rt-bmeta");
  if (meta && bm && bm.textContent !== meta.textContent) bm.textContent = meta.textContent;
  for (const t of $$(".rt-tabs [data-rt-view]")) t.setAttribute("aria-selected", String(S.view === t.dataset.rtView));
  rtShadeBtn();
}

/* ----- Favorites: views saved in this browser ----- */
function rtFavs() {
  try { const v = JSON.parse(localStorage.getItem(RT_FAV_KEY) || "[]"); return Array.isArray(v) ? v.filter((f) => f && typeof f.h === "string" && typeof f.t === "string") : []; } catch (e) { return []; }
}
function rtFavsSave(list) { try { localStorage.setItem(RT_FAV_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch (e) { return false; } }
// the view's own link, without the look or full screen (a favourite opens in whatever look is on)
const rtViewHash = () => location.hash.replace(/^#/, "").split("&").filter((kv) => kv && !/^(retro|fs)=/.test(kv)).join("&");
// a favourite names itself by the panel's title, the lens where it isn't the default, and the election where the title doesn't say
function rtFavLabel() {
  const h2 = $("#story .st-head h2"), name = h2 ? [...h2.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() : "Electoral map";
  const parts = [name];
  if (S.f.cls && S.f.st && S.sel.level === "state") parts[0] = `${name}, ${STATE_SHORT[S.f.st]}`;
  if (S.lens !== "winner") parts.push(lensShort());
  if (!/today|election|\d{4}/i.test(name)) parts.push(isNowY(S.year) ? "now" : yearLabel(S.year));
  return parts.join(" · ");
}
function rtFavAdd(anchor) {
  const h = rtViewHash(), list = rtFavs();
  if (list.some((f) => f.h === h)) { rtNote(anchor, "Already in Favorites"); return; }
  list.unshift({ t: rtFavLabel(), h });
  rtNote(anchor, rtFavsSave(list) ? "Added to Favorites" : "This browser won’t keep Favorites");
}
function rtFavGo(i) {
  const f = rtFavs()[i]; if (!f) return;
  if (f.h === rtViewHash()) return;
  // the map reads its link as it loads: the saved view opens on a fresh load of it
  location.hash = f.h + (rtIsOn() ? (f.h ? "&" : "") + "retro=1" : "");
  location.reload();
}
function rtFavDel(i) { const list = rtFavs(); list.splice(i, 1); rtFavsSave(list); }

/* ----- the menus ----- */
function rtMenuItems(k) {
  const filtered = !!(S.f.st || S.f.cls);
  switch (k) {
    case "edit": return [
      { label: "Find a seat or place…", kb: "/", act: rtFind },
      { label: "Copy link to this view", act: rtCopy },
      { sep: true },
      { label: "Clear filters", disabled: !filtered, act: rtClearFilters },
    ];
    case "view": return [
      { label: "Map", radio: S.view === "map", act: () => setView("map") },
      { label: "Chamber", radio: S.view === "chamber", act: () => setView("chamber") },
      { label: "List", radio: S.view === "list", act: () => setView("list") },
      { sep: true },
      { label: "Full screen", kb: "F", act: () => fsEnter() },
      { label: "City names", check: !S.townsOff, disabled: S.view !== "map", act: () => { const b = $("[data-towns]"); if (b) b.click(); } },
      { sep: true },
      { label: "Modern view", act: () => rtSet(false) },
    ];
    case "fav": {
      const favs = rtFavs();
      return [
        { label: "Add this view to Favorites", act: () => rtFavAdd(RT.dropFor) },
        { sep: true },
        ...(favs.length ? favs.map((f, i) => ({ label: f.t, fav: i, current: f.h === rtViewHash() })) : [{ label: "No favourites yet", disabled: true }]),
      ];
    }
    case "help": return [
      { label: "How the map is built", act: () => { const n = $(".mp-notes"); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); } },
      { label: "Send feedback…", href: "/feedback/" },
    ];
    case "more": return rtPages().more.map((p) => ({ label: p.label, href: p.href, check: p.on }));
    case "pages": { const { tabs, more } = rtPages(); return [...tabs.map((p) => ({ label: p.label, href: p.href })), { sep: true }, ...more.map((p) => ({ label: p.label, href: p.href, check: p.on }))]; }
  }
  return [];
}
function rtRenderMenu() {
  const items = rtMenuItems(RT.dropKey);
  RT.items = items;
  RT.drop.innerHTML = items.map((it, i) => {
    if (it.sep) return "<hr>";
    const mark = it.radio ? "●" : it.check ? "✓" : "";
    const inner = `<span class="rt-ck">${mark}</span><span class="rt-it">${esc(it.label)}</span>${it.kb ? `<span class="rt-kb">${esc(it.kb)}</span>` : ""}`;
    if (it.fav != null) return `<div class="rt-favrow"><button type="button" role="menuitem" data-rt-fav="${it.fav}" tabindex="-1"${it.current ? ' aria-current="page"' : ""}>${inner}</button><button type="button" class="rt-favdel" data-rt-favdel="${it.fav}" tabindex="-1" aria-label="Remove ${esc(it.label)} from Favorites" title="Remove from Favorites">${RT_ICON.x}</button></div>`;
    return it.href ? `<a role="menuitem" href="${esc(it.href)}" tabindex="-1"${it.check ? ' aria-current="page"' : ""}>${inner}</a>` : `<button type="button" role="menuitem" data-rt-item="${i}" tabindex="-1"${it.disabled ? " disabled" : ""}>${inner}</button>`;
  }).join("");
}
function rtOpenMenu(k, anchor) {
  if (!RT.drop) return;
  if (RT.dropFor === anchor && !RT.drop.hidden) { rtCloseMenu(); return; }
  rtCloseMenu();
  RT.dropKey = k; RT.dropFor = anchor;
  RT.drop.setAttribute("aria-label", anchor.textContent.trim());
  rtRenderMenu();
  const d = RT.drop;
  d.hidden = false;
  const r = anchor.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
  const right = k === "more" || k === "pages";
  d.style.left = `${Math.max(2, Math.min(right ? r.right - w : r.left, innerWidth - w - 2))}px`;
  d.style.top = `${Math.min(r.bottom + 1, innerHeight - h - 2)}px`;
  anchor.setAttribute("aria-expanded", "true");
  (d.querySelector("button:not(:disabled), a"))?.focus({ preventScroll: true });
}
function rtCloseMenu() {
  if (!RT.drop || RT.drop.hidden) return;
  RT.drop.hidden = true;
  if (RT.dropFor) RT.dropFor.setAttribute("aria-expanded", "false");
  RT.dropFor = null; RT.dropKey = null;
}
// a pale note under a navbar item for a moment (Added to Favorites, Link copied)
function rtNote(anchor, text) {
  if (!anchor) return;
  const n = document.createElement("div");
  n.className = "rt-note"; n.setAttribute("role", "status"); n.textContent = text;
  document.body.append(n);
  const r = anchor.getBoundingClientRect();
  n.style.left = `${Math.max(4, Math.min(r.left, innerWidth - n.offsetWidth - 4))}px`;
  n.style.top = `${r.bottom + 4}px`;
  setTimeout(() => n.remove(), 1800);
}

/* ----- what the menus do ----- */
function rtFind() { const q = $("#q"); if (!q) return; q.scrollIntoView({ block: "nearest", behavior: "smooth" }); q.focus({ preventScroll: true }); }
function rtCopy() {
  const a = $('.rt-nav [data-rt-menu="edit"]');
  const done = () => rtNote(a, "Link copied");
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, () => rtNote(a, "Couldn’t copy the link")); else rtNote(a, "Couldn’t copy the link"); } catch (e) { rtNote(a, "Couldn’t copy the link"); }
}
function rtClearFilters() { S.f.cls = null; if (S.sel.level === "state") goAus(); else { S.f.st = null; filtersChanged(); } }

function rtSet(on, o = {}) {
  if (on) rtBuild();
  document.documentElement.classList.toggle("mp-retro", on);
  const sw = $("#retrogo"); if (sw) sw.setAttribute("aria-pressed", String(on));
  if (o.persist !== false) { try { if (on) localStorage.setItem(RT_KEY, "1"); else localStorage.removeItem(RT_KEY); } catch (e) {} }
  if (!on) { rtCloseMenu(); const s = $("#story"); if (s) s.classList.remove("rt-shut"); }
  rtSync();
  if (o.boot) return;
  // the look's palette and type change every measure: the canvases, the strip, the eyebrow and the stage re-read it
  if (TH) themeChanged();
  ebHeights.clear(); holdEyebrow();
  renderLegend(); renderTimeline(); fitSearchPlaceholder(); lensOverflow(); resize(); writeURL(); schedule();
  const w = $(".mp-sec"); if (w && w.getBoundingClientRect().top < 0) w.scrollIntoView({ block: "start" });
  (on ? $(".rt-modern") : $("#retrogo"))?.focus({ preventScroll: true });
}

/* ----- wiring ----- */
$("#retrogo")?.addEventListener("click", () => rtSet(!rtIsOn()));
document.addEventListener("click", (e) => {
  if (!rtIsOn()) return;
  const mb = e.target.closest("[data-rt-menu]");
  if (mb) { rtOpenMenu(mb.dataset.rtMenu, mb); return; }
  const del = e.target.closest("[data-rt-favdel]");
  if (del) { rtFavDel(+del.dataset.rtFavdel); rtRenderMenu(); (RT.drop.querySelector("button:not(:disabled), a"))?.focus({ preventScroll: true }); return; }
  const fav = e.target.closest("[data-rt-fav]");
  if (fav) { const i = +fav.dataset.rtFav; rtCloseMenu(); rtFavGo(i); return; }
  const it = e.target.closest("[data-rt-item]");
  if (it && RT.items) { const f = RT.items[+it.dataset.rtItem], anchor = RT.dropFor; rtCloseMenu(); if (f && f.act && !it.disabled) { RT.dropFor = anchor; f.act(); RT.dropFor = null; } return; }
  if (RT.drop && !RT.drop.hidden && !e.target.closest(".rt-drop")) rtCloseMenu();
  const v = e.target.closest("[data-rt-view]");
  if (v) { setView(v.dataset.rtView); return; }
  const d = e.target.closest("[data-rt-do]");
  if (!d) return;
  if (d.dataset.rtDo === "fs") fsEnter();
  else if (d.dataset.rtDo === "modern") rtSet(false);
  else if (d.dataset.rtDo === "shade") {
    const s = $("#story"), shut = !s.classList.contains("rt-shut");
    s.classList.toggle("rt-shut", shut);
    d.remove(); rtShadeBtn(); $("#story .rt-shade")?.focus({ preventScroll: true });
    if (!shut) { paintMiniChamber(); hydrateDists(); }
  }
});
// along the navbar with one menu open, the next menu opens under the pointer, as the old menus did
document.addEventListener("mouseover", (e) => {
  if (!rtIsOn() || !RT.drop || RT.drop.hidden || !RT.dropFor) return;
  const mb = e.target.closest(".rt-nav [data-rt-menu]");
  if (mb && mb !== RT.dropFor) rtOpenMenu(mb.dataset.rtMenu, mb);
});
document.addEventListener("keydown", (e) => {
  if (!rtIsOn() || !RT.drop || RT.drop.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const a = RT.dropFor; rtCloseMenu(); if (a) a.focus({ preventScroll: true }); return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    // (the menu's own: an open menu keeps the arrows from the map's year and lane walks)
    e.preventDefault(); e.stopPropagation();
    const xs = $$("[role=menuitem]:not(:disabled)", RT.drop), i = xs.indexOf(document.activeElement);
    if (xs.length) xs[(i + (e.key === "ArrowDown" ? 1 : -1) + xs.length) % xs.length].focus({ preventScroll: true });
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    // the menu bar's own walk: the neighbouring menu opens
    const ms = $$(".rt-nav [data-rt-menu]").filter((b) => b.offsetParent), i = ms.indexOf(RT.dropFor);
    if (i < 0) return;
    e.preventDefault(); e.stopPropagation();
    rtOpenMenu(ms[(i + (e.key === "ArrowRight" ? 1 : -1) + ms.length) % ms.length].dataset.rtMenu, ms[(i + (e.key === "ArrowRight" ? 1 : -1) + ms.length) % ms.length]);
  }
}, true);
addEventListener("scroll", () => { if (RT.drop && !RT.drop.hidden) rtCloseMenu(); }, { passive: true });
addEventListener("resize", () => { if (RT.drop && !RT.drop.hidden) rtCloseMenu(); });
// the boot: the head's inline script may already have set the class (the hash's retro=1, or the saved choice)
{
  let want = rtIsOn();
  try { want = want || /[#&]retro=1(&|$)/.test(location.hash) || localStorage.getItem(RT_KEY) === "1"; } catch (e) {}
  if (want) rtSet(true, { persist: false, boot: true });
}

})();
