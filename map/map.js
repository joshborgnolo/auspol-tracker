/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */
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
    // Labor against One Nation, for preferences split between the two
    divOn: div(deepen(th.party.alp, dk ? 0.03 : -0.06), th.mid, deepen(th.party.onp, dk ? 0.03 : -0.06)),
    fp: { alp: seq(27, 0.16), lnp: seq(250, 0.12), grn: seq(150, 0.15), onp: seq(58, 0.15), ind: seq(320, 0.09), oth: seq(250, 0.022) },
    inf: seq(345, 0.13),
    // a party's losses: paper to a warm grey, so a fall never borrows another party's colour
    loss: seq(70, 0.025),
    seifa: seq(292, 0.15),
    // the census people measures, a hue each so a change of measure reads as one
    demo: { lang: seq(235, 0.12), a65: seq(62, 0.13), a2034: seq(150, 0.12), fborn: seq(195, 0.12), uni: seq(100, 0.12), blue: seq(36, 0.13),
      loinc: seq(20, 0.13), hiinc: seq(275, 0.12) },
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
const FAM_CODE = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", ind: "IND", oth: "OTH" };
// the ECSA's own codes ride the same rails: LIB is the Coalition, ONP One Nation
const FAM = (ab) => (ab === "ALP" ? "alp" : ["LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"].includes(ab) ? "lnp" : ab === "GRN" ? "grn" : ab === "ON" || ab === "HAN" || ab === "ONP" ? "onp" : ab === "IND" || ab === "" || ab === "NAFD" || ab === "CSA" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", LIB: "Liberal", LNP: "Liberal National", LNQ: "Liberal National", NP: "Nationals", NAT: "Nationals", CLP: "Country Liberal", GRN: "Greens", IND: "Independent", NAFD: "Independent", ON: "One Nation", ONP: "One Nation", HAN: "One Nation", KAP: "Katter’s Australian", PUP: "Palmer United", UAPP: "United Australia", LDP: "Liberal Democrats", AJP: "Animal Justice", CYA: "Trumpet of Patriots", FFP: "Family First", FFPA: "Family First", LTP: "Libertarian", HMP: "Legalise Cannabis", GRPF: "People First", SAL: "Socialist Alliance", VNS: "Victorian Socialists", ASP: "Shooters, Fishers and Farmers", AUC: "Australian Christians", CEC: "Citizens Party", IMO: "HEART", SOPA: "FUSION", AUD: "Australian Democrats", DEM: "Democrats", GAP: "Great Australian", IAP: "Indigenous-Aboriginal", JLN: "Jacqui Lambie Network", TNL: "TNL", SPP: "Sustainable Australia", DHJP: "Justice Party", AUVA: "Australian Values", WAP: "Western Australia Party", AUP: "Australian Progressives", TLOC: "The Local Party", DPDA: "Democratic Alliance", CA: "Centre Alliance", AMEP: "Motoring Enthusiast", AC: "Australian Conservatives", APA: "Progressive Alliance", GLT: "Glenn Lazarus Team", AV: "Australia’s Voice", REAS: "Reason", CDP: "Christian Democrats", CSA: "Community Strong", RUA: "Rise Up Australia", SEP: "Socialist Equality", DLP: "Democratic Labour", FACN: "Fraser Anning’s Conservative Nationals", NGST: "No GST", SPA: "Secular Party", AFN: "Australia First", BTA: "Bullet Train for Australia" };
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
// the census tab's people measures: shares of residents (the two income
// lanes are shares of an area's ADULTS), from the 2021 census counted
// where each polling place's voters live (the AEC records that from
// 2016 on); 2007–2013 read the census of the areas the places stand in
// (the 2006 census at 2007 and 2010, the 2011 census at 2013)
const DM = ["lang", "a65", "a2034", "fborn", "uni", "blue", "loinc", "hiinc"];
const DM_NAME = { lang: "Language other than English at home", a65: "Aged 65 and over", a2034: "Aged 20 to 34", fborn: "Born overseas", uni: "University educated", blue: "Blue-collar workers", loinc: "Adults in lower-income households", hiinc: "Adults in high-income households" };
const DM_SHORT = { lang: "Other language", a65: "Aged 65+", a2034: "Aged 20–34", fborn: "Born overseas", uni: "University", blue: "Blue collar", loinc: "Lower income", hiinc: "Higher income" };
const DM_VERB = { lang: "speak a language other than English at home", a65: "are aged 65 or over", a2034: "are aged 20 to 34", fborn: "were born overseas", uni: "hold a university qualification", blue: "work in a trade, drive machinery or do labouring work" };
const DM_RANGE = { lang: [0, 60], a65: [5, 35], a2034: [10, 40], fborn: [0, 65], uni: [2, 55], blue: [9, 48], loinc: [10, 45], hiinc: [0, 50] };
const isDemo = () => DM.includes(S.index);
// the income lanes name their own definitions: the year's national
// weekly cut in the census year's dollars, as each year's incomeCuts
// record carries them (2013 reads 2011 dollars, 2016 on 2021 dollars)
const isInc = (k) => k === "loinc" || k === "hiinc";
const mny = (v) => (v == null ? "–" : `$${int(Math.round(v))}`);
const incDollars = (m) => (m.incomeCuts && m.incomeCuts.dollarsYear ? ` in ${m.incomeCuts.dollarsYear} dollars` : "");
const DM_VERB_INC = {
  loinc: (m) => `live in households earning under ${mny(m.incomeCuts && m.incomeCuts.loCutWeekly)} a week${incDollars(m)}`,
  hiinc: (m) => `live in households earning ${mny(m.incomeCuts && m.incomeCuts.hiEdgeWeekly)} or more a week${incDollars(m)}`,
};
const dmVerb = (m, k) => (isInc(k) ? DM_VERB_INC[k](m) : DM_VERB[k]);
// a year carries the income lanes only when its demo store records the cuts
// (2013 on); 2007 and 2010 stop at the six people measures
const hasInc = (m) => !!(m && m.incomeCuts);
const DM_ALL = DM;
const dmFor = (m) => (hasInc(m) ? DM_ALL : DM_ALL.filter((k) => !isInc(k)));
const DEMO_FROM = 2007;
const TYPE = { 1: "Polling place", 2: "Hospital team", 3: "Remote mobile team", 4: "Mobile team", 5: "Early voting centre" };
const FPMAX = { alp: 70, lnp: 70, grn: 50, onp: 40, ind: 55, oth: 35 };
const YEARS = [2004, 2007, 2010, 2013, 2016, 2019, "nsw23", "sa22", 2022, "vic22", 2025, "sa26", "now"];
// nsw23/sa22/vic22/sa26: the 2023 New South Wales (25 March), the 2022/2026
// South Australian (19/21 March) and the 2022 Victorian (26 November) state
// elections — non-federal stops, drawn on their own timeline rows at their
// date rather than a whole year in, named "SA"/"NSW"/"Vic" + the election's year
const SA_YEARS = new Set(["sa22", "sa26"]);
const NSW_YEARS = new Set(["nsw23"]);
const VIC_YEARS = new Set(["vic22"]);
const YEAR_JUR = { sa22: "sa", sa26: "sa", nsw23: "nsw", vic22: "vic" };
const STATE_YEARS = new Set(Object.keys(YEAR_JUR));
const YEARS_FED = YEARS.filter((y) => !STATE_YEARS.has(y));
const YEARS_SA = YEARS.filter((y) => SA_YEARS.has(y));
const YEARS_NSW = YEARS.filter((y) => NSW_YEARS.has(y));
const YEARS_VIC = YEARS.filter((y) => VIC_YEARS.has(y));
// each stop's spot on the timeline's date line (year + day-of-year/365)
const YEAR_X = { 2004: 2004.772, 2007: 2007.896, 2010: 2010.638, 2013: 2013.68, 2016: 2016.499, 2019: 2019.377, 2022: 2022.386, 2025: 2025.378, sa22: 2022.213, sa26: 2026.216, nsw23: 2023.23, vic22: 2022.901, now: 2026.8 };
// the calendar year a non-year word's results belong to ("sa22" elects in 2022)
const FRAME_YEAR = { now: 2026, sa22: 2022, sa26: 2026, nsw23: 2023, vic22: 2022 };
// a state frame's history spot: the previous election's date on its row's line
const STATE_PREV_X = { sa: 2018.205, nsw: 2019.222, vic: 2018.901 };
const SA_PREV_X = { 2018: STATE_PREV_X.sa };
const NSW_PREV_X = { 2019: STATE_PREV_X.nsw };
const VIC_PREV_X = { 2018: STATE_PREV_X.vic };
// the election each state frame names as its "previous election" (its date rides
// STATE_PREV_X on the timelines): South Australia's 2018, New South Wales' 2019
// and Victoria's 2018
const PREV_YEAR = { sa22: 2018, sa26: 2022, nsw23: 2019, vic22: 2018 };
const Y2_ST_CAP = { SA: "South Australia", NSW: "New South Wales", VIC: "Victoria" };
const stOfYear = (y) => (YEAR_JUR[y] || "").toUpperCase();
// a state frame's state in sentence words ("New South Wales" wherever "SA" would do)
const stNameCap = (y) => Y2_ST_CAP[stOfYear(y)] || "";
const prevXOf = (y) => STATE_PREV_X[YEAR_JUR[y]] ?? y - 1;
const prevNameOf = (y) => `${stOfYear(y).toUpperCase()} ${String(PREV_YEAR[y]).slice(2)}`;
const prevXLabOf = (y) => `${stOfYear(y).toUpperCase()}’${String(PREV_YEAR[y]).slice(2)}`;
const GOV = { 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp", 2018: "lnp", sa22: "alp", sa26: "alp", nsw23: "alp", vic22: "alp", now: "alp" }; // 2018 is SA's (Marshall's Liberals), the sa22 frame's prev
// another state's 2018 prev-government collides with SA's key above: Victoria
// 2018 was Labor (Andrews won it), so the winner a vic22 frame is gauged
// against comes from this corridor, not GOV[2018]
const PREV_GOV_BY_JUR = { vic: { 2018: "alp" } };
const PM = { 2004: "John Howard", 2007: "Kevin Rudd", 2010: "Julia Gillard", 2013: "Tony Abbott", 2016: "Malcolm Turnbull", 2019: "Scott Morrison", 2022: "Anthony Albanese", 2025: "Anthony Albanese", sa22: "Peter Malinauskas", sa26: "Peter Malinauskas", nsw23: "Chris Minns", vic22: "Daniel Andrews", now: "Anthony Albanese" };
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
const FED_LENS = new Set(["senate", "cls"]);
const yearLenses = (y) => STATE_YEARS.has(y) ? LENSES.filter((l) => !FED_LENS.has(l.id)) : LENSES;
// the arrow-key walks: the year walk is shared by the keyboard and the phone's
// figure swipes (a swipe cycles all the way around); the lens and row walks
// are keyboard only — a phone scrolls the lens row itself, and its vertical
// drags belong to the page. On the phone a walk keeps the view fixed
// (walkHold below), and has no scroll side effects of its own
const yearLane = (y) => (SA_YEARS.has(y) ? YEARS_SA : VIC_YEARS.has(y) ? YEARS_VIC : NSW_YEARS.has(y) ? YEARS_NSW : YEARS_FED);
function walkYear(dir, wrap) { const lane = yearLane(S.year); const k = lane.indexOf(S.year) + dir, y = lane[wrap ? (k + lane.length) % lane.length : k]; if (y != null) setYear(y); }
// the up/down-arrows row walk: the timeline's rows top to bottom, in
// renderTimeline's `rows` order, walking round the ends; a row holds the stop
// it was left on (setYear keeps the memory), its newest stop until then
const LANES = [YEARS_FED, YEARS_NSW, YEARS_VIC, YEARS_SA];
const laneMem = new Map();
function walkLane(dir) {
  const cur = yearLane(S.year);
  laneMem.set(cur, S.year);
  const lane = LANES[(LANES.indexOf(cur) + dir + LANES.length) % LANES.length];
  setYear(laneMem.get(lane) ?? lane[lane.length - 1]);
}
function walkLens(dir) {
  if (S.view === "chamber" && S.house === "senate") { const L = SEN_LENSES, j = (L.findIndex((l) => l.id === S.senLens) + dir + L.length) % L.length; setSenLens(L[j].id); return; }
  const L = yearLenses(S.year), k = (L.findIndex((l) => l.id === S.lens) + dir + L.length) % L.length;
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
  if (!PHONE.matches || y == null) return;
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
  if (!spot || !PHONE.matches) return null;
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
  year: "now", lens: "winner", party: "onp", from: "onp", vs: "lnp", index: "irsad", basis: "venue", tppMode: "share", fpMode: "share",
  view: "map", sel: { level: "aus" }, hover: null, seat: null,
  listUnit: "seats", sort: null, q: "",
  f: { st: null, cls: null, win: null, margin: null, range: null },
  dist: null,
  // the chamber view's chamber: the House ("reps") or the Senate, with the Senate's own lens and selection
  house: "reps", senLens: "party", ssel: { level: "aus" },
  // the Senate lens: a party's Senate vote less its House vote ("gap"), or its Senate share
  senMode: "gap",
};
const Y = {};
let proj = null;
const isNow = () => S.year === "now";
// a state frame names itself "SA2022"/"NSW2023": the state's abbreviation + full year
const yearLabel = (y) => (y === "now" ? "Now" : STATE_YEARS.has(y) ? `${YEAR_JUR[y].toUpperCase()}20${String(y).slice(-2)}` : String(y));
// a year as the URL and data-year attributes carry it: numeral digits, or a word
// year ("now", "sa26") that stays a word - a bare +s gives NaN for those
const yearOf = (s) => (YEARS.includes(s) ? s : +s);
const xOfYear = (y) => YEAR_X[y] ?? y;

/* =============================== data =============================== */
// each data file's content hash, stamped in by assemble.mjs (data-stamp.mjs): the files keep their
// names and Pages caches them for ten minutes, so a release asks for its own data by hash and never
// pairs with a cached older copy
const DATA_V = /*@data-stamps*/{"data-now.json":"f3fc56ed","data-nsw23.json":"1d234a46","data-sa22.json":"e6ff9052","data-sa26.json":"9b940b4e","data-vic22.json":"77bbb4f7","geo-2004-hi.json":"c25c25f4","geo-2004-lo.json":"f1a3ae40","geo-2007-hi.json":"4db87a0d","geo-2007-lo.json":"5cb6dd10","geo-2010-hi.json":"3c101b06","geo-2010-lo.json":"f8051359","geo-2013-hi.json":"3c101b06","geo-2013-lo.json":"f8051359","geo-2016-hi.json":"1b30418b","geo-2016-lo.json":"da0f2884","geo-2019-hi.json":"ee819df9","geo-2019-lo.json":"17e396f0","geo-2022-hi.json":"07694c27","geo-2022-lo.json":"3d3e3056","geo-2025-hi.json":"7048e1d1","geo-2025-lo.json":"194abc94","geo-nsw23-hi.json":"889ef285","geo-nsw23-lo.json":"23ad692a","geo-sa22-hi.json":"188cd494","geo-sa22-lo.json":"75ee7453","geo-sa26-hi.json":"4bd534f2","geo-sa26-lo.json":"73866149","geo-vic22-hi.json":"9b2e98b4","geo-vic22-lo.json":"7dd2d4e3","house-seating-plan-2012-02-27.json":"2d05efc8","house-seating-plan-2013-05-14.json":"67fd5a2e","house-seating-plan-2013-11-12.json":"f8ae8d2d","house-seating-plan-2016-08-31.json":"d18d9c56","house-seating-plan-2021-03.json":"680131d1","house-seating-plan-2022-07-29.json":"9ed4a9d3","house-seating-plan-2025-10-27.json":"8e418a65","house-seating-plan-2026-08-13.json":"953b9336","house-seating-plan-sa-2024-12-28.json":"b96a0486","islands.json":"125753ec","la-seating-plan-vic-2026-08-11.json":"f825735f","lc-seating-plan-vic-2026-10-27.json":"8551a18b","res-2004.json":"f83dcb86","res-2007.json":"56e4a28c","res-2010.json":"cf2b0d8f","res-2013.json":"c7b16d57","res-2016.json":"d57b0d2c","res-2019.json":"ef010f51","res-2022.json":"cf4ed33f","res-2025.json":"cea825d3","res-nsw23.json":"4e9a6123","res-sa22.json":"2757b9d3","res-sa26.json":"1330a5a6","res-vic22.json":"b70dbd2c","seats-2010.json":"d2c9075c","seats-2013.json":"c5b04d17","seats-2016.json":"e3a9c6f3","seats-2019.json":"a76a2944","seats-2022.json":"025f55bc","seats-2025.json":"803eb9f7","seats-now.json":"f5bfe9c9","seats-sa22.json":"9b636130","seats-sa26-lc.json":"f8e6c8a1","seats-sa26.json":"9c8e2ae0","seats-vic22-lc.json":"483ec750","seats-vic22.json":"5603a5a3","senate-2004.json":"d88d0847","senate-2007.json":"5891ef1c","senate-2010.json":"f7d91697","senate-2013.json":"8a0f3d28","senate-2016.json":"e64f1cdf","senate-2019.json":"2814136b","senate-2022.json":"5df6af1e","senate-2025.json":"0ecad23e","senate-floor-2026-10-09.json":"8520afee","senate-now.json":"e4b50c01","senate-nsw23.json":"05315cda","senate-sa22.json":"f044aa86","senate-sa26.json":"78a4be99","senate-vic22.json":"2958ce36","senate-vote-2004.json":"cfe0b9ca","senate-vote-2007.json":"eb9cf448","senate-vote-2010.json":"f15aac03","senate-vote-2013.json":"106747c9","senate-vote-2016.json":"c462bdb4","senate-vote-2019.json":"efb23f42","senate-vote-2022.json":"e4ffe849","senate-vote-2025.json":"1e5111cd","summary.json":"06f08fb1"};
const getJSON = (u) => { const v = DATA_V[u.slice(u.lastIndexOf("/") + 1)]; return fetch(v ? `${u}?v=${v}` : u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); };

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
  if (!prev) change = { kind: yNum === 2004 ? "unknown" : "new" };
  else if (prev[3] === win.n) change = { kind: "re", since: firstYearOf(d.h.filter((h) => !h[4]), win.n, yNum) };
  else if (FAM(prev[2]) === win.fam && !(win.fam === "ind")) change = { kind: "held", prev };
  else change = { kind: "gain", prev };
  const inf = d.inf;
  return {
    i, id: d.id, n: d.n, st: d.st, cls: d.cls, c, formal, inf, infPct: inf != null ? (100 * inf) / (formal + inf) : null, fp,
    A, B, va, vb, win, run, winPct, margin: winPct - 50, votesMargin: Math.abs(va - vb), classic, vs, alpSide, flows, flowAlp,
    tpp, tppSw: d.tpp ? d.tpp[2] : null, seifa: d.seifa || {}, vt: d.vt || null, h: d.h, demo: d.demo, lp: d.lp, lpx: 0, lpy: 0, change,
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
    if (B.lat[j] != null) { const p = proj([B.lon[j], B.lat[j]]); if (p) { o.x[j] = p[0]; o.y[j] = p[1]; } }
    const v = B.v[j]; let formal = 0; for (const x of v) formal += x;
    o.formal[j] = formal; o.votes[j] = formal + B.inf[j];
    if (o.votes[j]) o.infPct[j] = (100 * B.inf[j]) / o.votes[j];
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
    // census shares pooled over the seats' vote-weighted populations, in percent
    let demo = null;
    const ds = idx.map((i) => m.divs[i].demo).filter((x) => x && x.p);
    if (ds.length) {
      demo = {};
      // a lane's null rows sit that lane's pool out, both sides of the line
      for (const k of DM) { const xs = ds.filter((x) => x[k] != null); demo[k] = xs.length ? (100 * sum(xs.map((x) => x.p * x[k]))) / sum(xs.map((x) => x.p)) : null; }
    }
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
  const P = proj, mk = (g) => { const p = new Path2D(); d3.geoPath(P, p)(g); return p; };
  const o = topo.objects.divs, at = (g) => m.byName.get(g.properties.name);
  // each seat's coast and its borders with other seats, apart, made when the
  // streets first need them (the streets' own sea draws the coast there)
  const coastP = [], edgeP = [];
  return {
    paths, bb,
    meshDiv: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st === b.properties.st)),
    meshState: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)),
    coast: mk(topojson.mesh(topo, o, (a, b) => a === b)),
    coastOf: (i) => coastP[i] || (coastP[i] = mk(topojson.mesh(topo, o, (a, b) => a === b && at(a) === i))),
    edgeOf: (i) => edgeP[i] || (edgeP[i] = mk(topojson.mesh(topo, o, (a, b) => a !== b && (at(a) === i || at(b) === i)))),
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
      r.forEach((ll, i) => { const [x, y] = proj(ll); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); (i ? mpath.lineTo : mpath.moveTo).call(mpath, x, y); });
      mpath.closePath();
    }
    const o = own[s.key] != null ? m.byName.get(own[s.key]) : null;
    // a polling place counts as the island's within a few km of its frame
    const near = [s.box[0] - 0.05, s.box[1] - 0.05, s.box[2] + 0.05, s.box[3] + 0.05];
    return { key: s.key, name: s.name, path, lon0, lat1, cos, w: (lon1 - lon0) * cos, h: lat1 - lat0, near, owner: o ?? null, seat: o ?? null, booths: [], mpath, mbb: [[x0, y0], [x1, y1]] };
  });
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
function buildSearch(m) {
  const items = [];
  // a state election's frame holds no other states' areas (sa26: SA and AUS only)
  for (const st of STATES) { const a = m.areas[st]; if (!a) continue; items.push({ k: "state", st, t: STATE_TITLE[st], s: `${a.idx.length} seats`, h: norm(STATE_TITLE[st] + " " + st), rank: 0 }); }
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

// the views with a filed seating plan (map/data/seats-<year>.json, from .build/map/seating.mjs,
// .build/map/sa_seating.mjs for the live sa26 chambers, .build/map/sa22_seating.mjs for sa22's,
// .build/map/vic_seating.mjs for vic22's; none is filed for New South Wales, so the nsw23
// chambers fill their benches sorted)
const SEATED = new Set(["now", 2025, 2022, 2019, 2016, 2013, 2010, "sa26", "sa22", "vic22"]);
const SEATED_LC = new Set(["sa26", "vic22"]);
// the Speaker's district where the results files name none: each state's, as its
// Parliament first sat (Dan Cregan, 3 May 2022; Nat Cook, 5 May 2026; Greg Piper, 2 May 2023)
const SPEAKER_DIV = { sa22: "Kavel", sa26: "Hurtle Vale", nsw23: "Lake Macquarie", vic22: "Bendigo West" };
async function loadYear(year) {
  // switching back to an already-loaded year restores that year's projection:
  // sa26's frame fits South Australia, the federal years' the continent
  if (Y[year]) return Y[year].ready.then((mm) => { proj = mm.proj; return mm; });
  const m = { year, ready: null };
  Y[year] = m;
  m.ready = (async () => {
    const ry = year === "now" ? 2025 : year;
    const [res, lo, now, seating, islands] = await Promise.all([getJSON(`/map/data/res-${ry}.json`), getJSON(`/map/data/geo-${ry}-lo.json`), year === "now" ? getJSON("/map/data/data-now.json") : null,
      SEATED.has(year) ? getJSON(`/map/data/seats-${year}.json`).catch(() => null) : null, loadIslands()]);
    // built under its own projection, then the live one put back: a year loaded
    // ahead (the timeline's hover) must not move the streets and the sea under
    // the year in view (setYear takes the new year's when it shows it)
    const keep = proj;
    proj = m.proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], topojson.feature(lo, lo.objects.divs));
    m.res = res;
    m.demoBasis = res.demoBasis || null;
    m.incomeCuts = res.incomeCuts || null;
    m.date = res.date;
    m.divs = res.divs.map((d, i) => deriveDiv(d, i, year));
    m.byName = new Map(m.divs.map((d) => [d.n, d.i]));
    for (const d of m.divs) { const p = proj(d.lp); d.lpx = p[0]; d.lpy = p[1]; }
    if (now) applyNow(m, now);
    m.speaker = m.byName.get(res.speaker ?? SPEAKER_DIV[year]);
    m.seating = seating;
    m.gov = GOV[year];
    m.geo = buildGeo(lo, m);
    m.isl = buildIslands(islands, m);
    m.booth = res.booths ? deriveBooths(res.booths, m) : emptyBooths(m);
    for (const s of m.isl) if (s.seat == null && s.booths.length) s.seat = m.booth.d[s.booths[0]];
    m.areas = deriveAreas(res, m);
    m.search = buildSearch(m);
    proj = keep || m.proj;
    // the hi detail can land after the reader has moved to another year — build
    // and bake its paths under this year's projection, then put the live one back
    getJSON(`/map/data/geo-${ry}-hi.json`).then((hi) => { const keep = proj; proj = m.proj; m.geoHi = buildGeo(hi, m); proj = keep; schedule(); }).catch(() => {});
    return m;
  })();
  return m.ready;
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
    case "tpp": return S.tppMode === "swing" ? nn(d.tppSw) : nn(d.tpp);
    case "fp": return S.fpMode === "change" ? fpChange(m, d, S.party) : d.fp[S.party];
    case "senate": return senDivValue(m, d);
    case "flow": return flowSeat(d) ? nn(d.flowAlp[S.from]) : null;
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
    case "flow": return flowSeat(m.divs[b.d[j]]) ? nn(b.flowAlp[S.from][j]) : null;
    case "senate": return senBoothValue(m, j);
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
    case "flow": return (S.vs === "onp" ? RAMP.divOn : RAMP.div)[dIdx((50 - v) / 40)];
    // the Senate gap reads as a change does: the party's own ramp above zero, the warm grey of losses below
    case "senate": return senGap()
      ? (v >= 0 ? RAMP.fp[S.party][Math.round(clamp(v / 10, 0, 1) * 100)] : RAMP.loss[Math.round(clamp(-v / 10, 0, 1) * 100)])
      : RAMP.fp[S.party][Math.round(clamp(v / FPMAX[S.party], 0, 1) * 100)];
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
function quietness(i, now) {
  const all = 0.72 * smooth(K_ALL * 0.75, K_ALL * 1.15, T.k);
  if (i === selDiv()) return Math.max(all, 0.72 * clamp((now - quietSince) / 450, 0, 1));
  return all;
}
// streetA: how strongly the streets show between the fills and the borders
// (only for the year in view; the frame passes it once per paint)
// SEA_GROW: how far (m) past their AEC coast the seats are drawn when Esri's
// sea cuts the coast (laySea), widest first: each seat's coast is stroked in
// its colour at every width in turn, the narrower over the wider, so land
// beyond every AEC coast goes to about the nearest seat's (within a factor
// of two) - not to whichever seat was stroked last where two meet at the
// shore. The two coasts part by 10-40m typically at street zoom, but by
// hundreds where the AEC drops an islet's shore or Esri's coarser zooms
// round an island out (Bass Strait's islands as the streets come in)
// Widths past ~60px on screen are left out (the coasts never part by that
// much once Esri's are fine-grained, and stroking whole coastlines that wide
// costs frames); the last two always run.
const SEA_GROW = [2400, 1200, 600, 300, 150];
const growsAt = (unit) => SEA_GROW.filter((w, j) => j >= SEA_GROW.length - 2 || w * unit * T.k <= 60);
// the paint's sea cut, for drawFocus: the year it was cut for and metres in map units
let seaNow = null;
const growBox = (b, x0, y0, x1, y1, w) => b && !(b[1][0] < x0 - w || b[0][0] > x1 + w || b[1][1] < y0 - w || b[0][1] > y1 + w);
function drawGeo(m, alpha, streetA) {
  const g = geoOf(m), th = TH, now = performance.now();
  const st = streetA > 0 ? prepStreets(streetA) : null;
  let unit = 0;
  if (st && st.cover) {
    const c = proj.invert([(Wpx / 2 - T.x) / T.k, (Hpx / 2 - T.y) / T.k]), p0 = proj(c), p1 = proj([c[0], c[1] + 0.01]);
    unit = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 1113.2;
  }
  const grows = unit ? growsAt(unit) : [], grow = unit * (grows[0] || 0);
  if (streetA !== undefined) seaNow = unit ? { m, unit } : null;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const [x0, y0, x1, y1] = viewBox();
  const pat = hatch(); pat.setTransform(new DOMMatrix().scale(1 / (dpr * T.k)));
  const filt = filtersOn();
  const fills = [];
  for (let i = 0; i < m.divs.length; i++) {
    if (!growBox(g.bb[i], x0, y0, x1, y1, grow)) continue;
    let c = fillDiv(m, i);
    const qn = m === M() ? quietness(i, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    if (qn > 0 && qn < 0.72 && i === selDiv()) needFrame = true;
    fills.push([i, c ? css(c) : pat, filt && !passes(m, i)]);
  }
  // the islands where they lie, past the mainland frame: their seat's colour, quieted
  // as it is; plain land in a year no seat holds one
  const isls = (m.isl || []).filter((q) => growBox(q.mbb, x0, y0, x1, y1, grow));
  const islFills = isls.map((q) => {
    let c = q.owner == null ? th.nodata : fillDiv(m, q.owner);
    const qn = q.owner != null && m === M() ? quietness(q.owner, now) : 0;
    if (c && qn > 0) c = towards(c, th.bg, qn);
    return [q, c ? css(c) : pat, filt && q.owner != null && !passes(m, q.owner)];
  });
  // under the fills, each seat's coast stroked in its own colour: the seats
  // grown seaward, so the land between the AEC's coast and Esri's is theirs
  for (const w of grows) {
    ctx.lineWidth = 2 * w * unit;
    for (const [i, f, out] of fills) { const p = g.coastOf(i); ctx.strokeStyle = f; ctx.stroke(p); if (out) { ctx.strokeStyle = css(th.bg, 0.8); ctx.stroke(p); } }
    for (const [q, f, out] of islFills) { ctx.strokeStyle = f; ctx.stroke(q.mpath); if (out) { ctx.strokeStyle = css(th.bg, 0.8); ctx.stroke(q.mpath); } }
  }
  for (const [i, f, out] of fills) {
    ctx.fillStyle = f; ctx.fill(g.paths[i]);
    if (out) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(g.paths[i]); }
  }
  for (const [q, f, out] of islFills) {
    ctx.fillStyle = f; ctx.fill(q.mpath);
    if (out) { ctx.fillStyle = css(th.bg, 0.8); ctx.fill(q.mpath); }
  }
  if (st) layStreets(st);
  ctx.strokeStyle = css(th.bg); ctx.lineWidth = Math.min(1.1, 0.35 + T.k * 0.25) / T.k; ctx.stroke(g.meshDiv);
  ctx.lineWidth = 2.2 / T.k; ctx.stroke(g.meshState);
  ctx.strokeStyle = css(th.state, 0.7); ctx.lineWidth = 0.9 / T.k; ctx.stroke(g.meshState);
  // the AEC's coast, where Esri's isn't the one drawn
  if (!grow) {
    ctx.strokeStyle = css(th.coast, 0.55); ctx.lineWidth = 0.7 / T.k; ctx.stroke(g.coast);
    for (const q of isls) ctx.stroke(q.mpath);
  }
  ctx.restore();
  if (grow) laySea(st, alpha);
}

// the veil, drawn whole on a layer and laid at its strength, its edge the
// grown seats' (the same widths in the same order as drawGeo's, so each
// stretch of land beyond the AEC's coasts is veiled as its colour's seat is):
// with a seat open (sd) everything but that seat, the sea veiled with the
// rest; with a state open its seats clear and the sea left clear too
let veilLay = null;
function veilSea(unit, sd, a) {
  const m = M(), g = geoOf(m), th = TH, W = canvas.width, H = canvas.height;
  if (!veilLay) veilLay = document.createElement("canvas");
  if (veilLay.width !== W || veilLay.height !== H) { veilLay.width = W; veilLay.height = H; }
  const L = veilLay.getContext("2d");
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = "source-over";
  L.clearRect(0, 0, W, H);
  L.fillStyle = L.strokeStyle = css(th.bg); L.lineJoin = L.lineCap = "round";
  if (sd != null) L.fillRect(0, 0, W, H);
  const clear = sd != null ? (i) => i === sd : (i) => m.divs[i].st === S.sel.st;
  const [x0, y0, x1, y1] = viewBox(), grows = growsAt(unit), grow = unit * grows[0];
  const vis = m.divs.filter((d) => growBox(g.bb[d.i], x0, y0, x1, y1, grow)).map((d) => d.i);
  const isls = (m.isl || []).filter((q) => growBox(q.mbb, x0, y0, x1, y1, grow));
  const islClear = (q) => q.owner != null && clear(q.owner);
  // a state's veil with none of the other states' seats in view is nothing
  if (sd == null && vis.every(clear) && isls.every(islClear)) return;
  const op = (yes) => { L.globalCompositeOperation = yes ? "destination-out" : "source-over"; };
  L.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  for (const w of grows) {
    L.lineWidth = 2 * w * unit;
    for (const i of vis) { op(clear(i)); L.stroke(g.coastOf(i)); }
    for (const q of isls) { op(islClear(q)); L.stroke(q.mpath); }
  }
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
  ctx.drawImage(veilLay, 0, 0);
  ctx.restore();
}
function drawFocus(m) {
  const g = geoOf(m), th = TH, sd = selDiv();
  ctx.save();
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y);
  const [x0, y0, x1, y1] = viewBox();
  // where Esri's sea cuts the coast (drawGeo) the veil follows the grown seats
  // and lies on the sea alike, so its edge is never the AEC's coast
  const sea = seaNow && seaNow.m === m ? seaNow : null;
  if (sea && (sd != null || S.sel.level === "state")) {
    veilSea(sea.unit, sd, sd != null ? th.veil : th.veil * 0.85);
  } else if (sd != null) {
    const v = new Path2D(); v.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); v.addPath(g.paths[sd]);
    for (const q of m.isl || []) if (q.owner === sd) v.addPath(q.mpath);
    ctx.fillStyle = css(th.bg, th.veil); ctx.fill(v, "evenodd");
  } else if (S.sel.level === "state") {
    ctx.fillStyle = css(th.bg, th.veil * 0.85);
    for (const d of m.divs) if (d.st !== S.sel.st) ctx.fill(g.paths[d.i]);
    for (const q of m.isl || []) if (q.owner == null || m.divs[q.owner].st !== S.sel.st) ctx.fill(q.mpath);
  }
  // a seat's outline takes in its islands; its coast is left to the sea's edge where Esri's draws it
  const outline = (i) => {
    if (sea) { ctx.stroke(g.edgeOf(i)); return; }
    ctx.stroke(g.paths[i]); for (const q of m.isl || []) if (q.owner === i) ctx.stroke(q.mpath);
  };
  const h = S.hover;
  if (h && h.kind === "div" && h.i !== sd) { ctx.strokeStyle = css(th.ink, 0.9); ctx.lineWidth = 1.6 / T.k; outline(h.i); }
  if (sd != null) { ctx.strokeStyle = css(th.ink); ctx.lineWidth = 2.2 / T.k; outline(sd); }
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
  const th = TH, placed = islDrawn.map((c) => c.box), now = performance.now();
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
    const j = S.sel.booth; put(dn(b.name[j]), b.x[j] * T.k + T.x, b.y[j] * T.k + T.y - rad(b.votes[j]) - 13, 13, 600, groundOf(sd), th.ink, true);
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
    for (const c of cand) put(dn(c.d.n), c.x, c.y, c.d.i === sd ? 13.5 : 12, c.d.i === sd ? 600 : 500, groundOf(c.d.i), sd != null && c.d.i !== sd ? th.ink3 : th.ink2);
  }
  // an island where it lies: its name over its north coast once it shows (under
  // its south coast where the way back holds the top)
  for (const el of [backBtn, $("#credit")]) if (!el.hidden) placed.push([el.offsetLeft - 4, el.offsetTop - 4, el.offsetLeft + el.offsetWidth + 4, el.offsetTop + el.offsetHeight + 4]);
  for (const q of m.isl || []) {
    const x0 = q.mbb[0][0] * T.k + T.x, x1 = q.mbb[1][0] * T.k + T.x, y0 = q.mbb[0][1] * T.k + T.y, y1 = q.mbb[1][1] * T.k + T.y;
    if (x1 - x0 < 30 || x1 < 0 || x0 > Wpx || y0 > Hpx) continue;
    // clear of the island's own polling places (which stay free for their own names)
    const n0 = placed.length;
    for (const j of q.booths) { if (Number.isNaN(b.x[j])) continue; const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]) + 2; placed.push([x - r, y - r, x + r, y + r]); }
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
      if (put(dn(b.name[j].replace(" early voting centre", " (early)")), x, y - rad(b.votes[j]) - 9, 11, 400, groundOf(b.d[j]), sd != null && b.d[j] !== sd ? th.faint : th.ink2)) n++;
    }
  }
  // the streets' own names last, clear of every label above and every booth
  const sA = streetK();
  if (sA > 0.02 && streetDrawn.length) {
    const obst = [];
    for (const j of m._vis || []) {
      const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, r = rad(b.votes[j]) + 2;
      if (x > -r && y > -r && x < Wpx + r && y < Hpx + r) obst.push([x - r, y - r, x + r, y + r]);
    }
    drawStreetNames(placed, obst, sA);
  }
  ctx.restore();
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
      .then((b) => { const pr = mvtParse(new Uint8Array(b)); t.cv = renderTile(pr, dark, z, tilePx()); t.sea = seaPath(pr.sea); t.names = pr.names; t.spots = pr.spots; t.ready = performance.now(); })
      .catch(() => { t.failed = true; })
      .finally(() => { streetLive--; schedule(); });
    if (tiles.size > streetCap()) pruneTiles();
  }
  if (t) t.used = streetUse;
  return t;
}
function pruneTiles() {
  const old = [...tiles].filter(([, t]) => (t.ready || t.failed) && t.used < streetUse).sort((a, b) => a[1].used - b[1].used);
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
      if (kind) { out.fills[kind].push({ ext: L.extent, parts }); if (L.name === "Marine area") out.sea.push({ ext: L.extent, parts }); continue; }
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
let seaCv = null, seaLay = null;
function prepStreets(alpha) {
  streetDrawn.length = 0;
  if (!proj || alpha <= 0.004) return null;
  const dark = TH.dark, W = canvas.width, H = canvas.height, now = performance.now();
  streetUse++;
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
  let cover = true;
  const seas = [];
  const sea1 = (...a) => { seaQuad(sg, ...a); seas.push(a); };
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const q = tileQuad(z, tx, ty);
    if (Math.max(q[0][0], q[1][0], q[2][0], q[3][0]) < 0 || Math.min(q[0][0], q[1][0], q[2][0], q[3][0]) > W
      || Math.max(q[0][1], q[1][1], q[2][1], q[3][1]) < 0 || Math.min(q[0][1], q[1][1], q[2][1], q[3][1]) > H) continue;
    const t = tileAt(dark, z, tx, ty, true);
    const f = t && t.ready ? clamp((now - t.ready) / 200, 0, 1) : 0;
    let sea = !!(t && t.ready);
    if (sea) sea1(t.sea, q);
    if (f < 1) {
      // until it arrives (and while it fades in): the nearest coarser tile on hand,
      // else the finer ones of the zoom just left
      let held = false;
      for (let up = 1; up <= 6 && z - up >= STREETS.zMin && !held; up++) {
        const s = 2 ** up, px = tx >> up, py = ty >> up, pt = tileAt(dark, z - up, px, py, false);
        if (pt && pt.ready) {
          const w = pt.cv.width / s; drawQuad(g, pt.cv, (tx - px * s) * w, (ty - py * s) * w, w, q, 1); held = true;
          if (!sea) { sea1(pt.sea, q, s, tx - px * s, ty - py * s); sea = true; }
        }
      }
      if (!held && z < STREETS.zMax) {
        let kids = 0;
        for (let k = 0; k < 4; k++) {
          const cx = 2 * tx + (k & 1), cy = 2 * ty + (k >> 1), ct = tileAt(dark, z + 1, cx, cy, false);
          if (ct && ct.ready) { const cq = tileQuad(z + 1, cx, cy); drawQuad(g, ct.cv, 0, 0, ct.cv.width, cq, 1); if (!sea) sea1(ct.sea, cq); kids++; }
        }
        if (kids === 4) sea = true;
      }
      if (t && t.ready) needFrame = true;
    }
    if (!sea) cover = false;
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
  return { a: alpha * (dark ? 0.85 : 0.5 + 0.5 * smooth(300, 1000, T.k)), op: dark ? "screen" : "multiply", cover, seas };
}
function layStreets(st) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = st.a; ctx.globalCompositeOperation = st.op;
  ctx.drawImage(streetCv, 0, 0);
  ctx.restore();
}
// the sea as the streets draw it where no seat lies (the sheet over a clear
// canvas), cut to the mask and laid in place of whatever the seats put there
function laySea(st, alpha) {
  const W = canvas.width, H = canvas.height;
  if (!seaLay) seaLay = document.createElement("canvas");
  if (seaLay.width !== W || seaLay.height !== H) { seaLay.width = W; seaLay.height = H; }
  const L = seaLay.getContext("2d");
  L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = "source-over";
  L.clearRect(0, 0, W, H);
  L.globalAlpha = st.a; L.globalCompositeOperation = st.op; L.drawImage(streetCv, 0, 0);
  L.globalAlpha = 1; L.globalCompositeOperation = "destination-in"; L.drawImage(seaCv, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "destination-out"; ctx.drawImage(seaCv, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.drawImage(seaLay, 0, 0);
  // the coast's hairline, as the AEC's was drawn, along Esri's
  ctx.strokeStyle = css(TH.coast, 0.55); ctx.lineJoin = "round";
  for (const [sea, q, s = 1, ox = 0, oy = 0] of st.seas) seaQuad(ctx, sea, q, s, ox, oy, 0.7 * dpr);
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
  const top = seaTop.w === Wpx ? seaTop.top : isPhone() ? 4 : p.t + 22;
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
    const sx = x0 < 4 ? 4 - x0 : x1 > Wpx - 4 ? Wpx - 4 - x1 : 0, sy = y0 < top ? top - y0 : y1 > Hpx - 4 ? Hpx - 4 - y1 : 0;
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
      while (out2 <= 60 && touches() && x0 + sx + dir * (out2 + 6) >= 4 && x1 + sx + dir * (out2 + 6) <= Wpx - 4) out2 += 6;
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
    // the box: paper over whatever lies under it, a hairline frame
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 3); else ctx.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = css(th.bg); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = css(th.ink3, 0.32); ctx.stroke();
    // the island, north up, filling the box less a margin; its seat's colour,
    // quieted, veiled and filtered as the map's own shapes are (an island in no
    // seat that year is plain land)
    // (a docked box's name heads it, so the island sits under that band)
    const pad = c.docked ? 9 : Math.max(4, r.w * 0.09), top = c.docked ? ISL_DCAP - 4 : 0;
    const k = Math.min((r.w - 2 * pad) / s.w, (r.h - top - 2 * pad) / s.h);
    const ox = r.x + (r.w - s.w * k) / 2, oy = r.y + top + (r.h - top - s.h * k) / 2;
    const places = c.docked && sd != null && s.seat === sd && s.booths.length > 0;
    let col = own == null ? th.nodata : fillDiv(m, own);
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
      for (const j of s.booths.slice().sort((p, q) => b.votes[q] - b.votes[p])) {
        const rr = clamp(3.4 * voteScale(b.votes[j]), 2.6, 8);
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
      ctx.lineWidth = 2.6; ctx.strokeStyle = css(th.bg, 0.85); ctx.strokeText(name, cx, cy);
      ctx.fillStyle = css(th.ink3); ctx.fillText(name, cx, cy);
      const tw = ctx.measureText(name).width / 2 + 3;
      islDrawn.push({ s, r, dots, box: [Math.min(r.x, cx - tw), r.y, Math.max(r.x + r.w, cx + tw), cy + 7] });
    }
  }
  ctx.restore();
}

/* ----- framing ----- */
function stagePads() {
  const phone = isPhone();
  return { t: phone ? 12 : 36, b: phone ? 12 : 18, l: phone ? 8 : 12, r: phone ? 44 : 50 };
}
// res: room kept clear at the stage's left (l) or foot (b), for docked island
// boxes, or its top (t), for the way back from an island and its name
function fitTransform(bb, maxK, res) {
  const p = stagePads();
  if (res) { p.l += res.l || 0; p.b += res.b || 0; p.t += res.t || 0; }
  const [[x0, y0], [x1, y1]] = bb;
  const w = Math.max(x1 - x0, 0.05), h = Math.max(y1 - y0, 0.05);
  const k = Math.min((Wpx - p.l - p.r) / w, (Hpx - p.t - p.b) / h, maxK || 2400);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return d3.zoomIdentity.translate(p.l + (Wpx - p.l - p.r) / 2 - cx * k, p.t + (Hpx - p.t - p.b) / 2 - cy * k).scale(k);
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
   Nothing here guesses when a gesture has ended. A trackpad pinch (a
   ctrl-wheel stream in Chrome and Firefox) follows the fingers 1:1 and stops
   when they stop: those browsers never say when the fingers lift, and a fling
   timed off a gap in the stream fired whether the fingers had lifted or only
   paused, so the map lurched on a beat after they had stopped. A wheel notch
   eases in over a few frames instead of jumping, and the notches of one spin
   add up into one run. Only Safari's pinch, which does report the lift
   (gestureend), glides on after it, at the pace the fingers had then. */
const Z_EASE = 0.07,  // s: a wheel notch's ease
  Z_TAU = 0.2,        // s: the release glide's friction (it adds pace × Z_TAU octaves)
  Z_MAX_V = 4;        // octaves/s: cap on the release pace (at most 0.8 octaves of glide)
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
function fitSelection(dur, force) {
  if (!M() || !Wpx || (S.view !== "map" && !force)) return;
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
function flyToCity(k) {
  const [, st, ll] = CITIES[k];
  const a = proj(ll[0]), b = proj(ll[1]);
  // a year whose jurisdiction holds no seats there (sa26: South Australia only,
  // so Adelaide alone flies)
  if (!M() || !M().areas[st]) return;
  select({ level: "state", st }, { fly: false });
  dock = null; // a city's view keeps no room for its state's islands
  const go = (dur) => {
    const t = fitTransform([[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]);
    lastFit = t;
    if (reduceMotion) { flight = null; d3.select(canvas).call(zoom.transform, t); } else fly(t, dur, () => go(320));
  };
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
// a swipe anywhere in the map figure — the canvas, its overlays, the
// timeline, the story — cycles the years: on the chamber always, on the map
// at the whole-country fit (a zoomed-in map pans instead). Native controls
// keep their own gestures (zoom and city buttons, form fields, links), and
// the list view's own rows
swipeWatch($(".mp-fig"), (dir, y) => { if (S.view === "chamber" || (S.view === "map" && T.k <= HOME.k * 1.001)) { walkAim(y); walkYear(dir, true); } }, (t) => !t.closest("button, a, input, select, textarea, .mp-list"));
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
  if (!g || S.view !== "map" || reduceMotion) return;
  // the pace at the lift, faded by any hold before it: fingers held still and
  // then lifted glide nowhere
  const v = g.v * Math.exp(-(performance.now() - g.at) / 50);
  if (Math.abs(v) >= 0.8) zoomEase(g.px, g.py, Math.sign(v) * Math.min(Math.abs(v), Z_MAX_V) * Z_TAU, Z_TAU);
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
  const b = m.booth; let bj = null, bd = Infinity;
  for (const j of m._vis || []) {
    const x = b.x[j] * T.k + T.x, y = b.y[j] * T.k + T.y, dd = Math.hypot(px - x, py - y);
    if (dd <= Math.max(rad(b.votes[j]) + 3, 8) && dd < bd) { bd = dd; bj = j; }
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
   Opposition heading the inner one (nothing sits level with the dais), and the far end turns
   in THREE curved rows of 6, 9 and 6 a side. 92 desks for the 92 members exactly; the
   Serjeant-at-Arms's chair stands centred behind the curve, "the chair separating the
   benches" (the parliament's own description).
   @nsw-cells-begin */
const NSWB = {
  leadY: -268.2, // the leaders' desks, heading the inner straight row at the table's shoulder
  arm: { x: 130, y0: -250, pitch: 18.2, n: 12 }, // the inner straight row, continuing the inner curve's radius
  row2X: 172, // the outer straight row, continuing the middle curve's radius (2026-10-27 user call)
  R: [130, 172, 214], // the curve's three rows
  sectors: [[[6, 84, 6]], [[5, 85, 9]], [[7, 83, 6]]],
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
    for (let i = 0; i < NSWB.arm.n; i++) cells.push({ id: `${P}b${i}`, x: sx * NSWB.row2X, y: NSWB.arm.y0 + NSWB.arm.pitch * i, fa, row: 2, w: NSWB.arm.pitch });
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
/* Victoria's Legislative Council, as the 60th Parliament's own seating plan lays it out
   (map/data/lc-seating-plan-vic-2026-10-27.json, the Parliament's councilseatingplan page of
   27 October 2026): the President's chair at the head, her desk and the two clerks and theirs
   down the centre line to the centre table, the government's benches in two straight columns
   down her right, the opposition's mirroring, and the crossbench round two arcs at the far
   end — six desks on R164 and eight on R275 about the rings' fitted centre — with two spare
   desks at the corners and the Level 2 floor running on past them to the bar of the house.
   The plan's desk numbers are the seats' ids (6 and 22 are unbuilt; desks 0-5, 14 and 15 are
   the Governor's, the officials' and the advisers' chairs, never a member's).
   @viclc-cells-begin – shared with .build/map/vic_lc_seating.mjs, which reads this block as is.
   Plan pixels as the plan files them (x across from the left, y down); cx is the centre line,
   cy the crossbench rings' common fitted centre, and every seat is read against them. */
const VCLC = {
  cx: 580, cy: 1052.5, table: 799, // the centre table's mid-line, which the far-end desks face
  room: [104, 104, 952, 1702], // the Level 2 floor, a rect [x y w h]
  tables: {
    presidentDesk: [510, 379, 140, 64], clerkTable: [490, 535, 180, 100], centreTable: [525, 639, 110, 320],
  },
  president: [580.1, 342.5], // desk 1: a role's chair, not a bench seat
  // the officials and staff: the Governor's ceremonial chair (0), the clerks flanking theirs'
  // table (2, 3), the chairs at the centre table's ends (4, 5) and the Government Advisers (14, 15)
  officers: { "0": [580.6, 195], "2": [542.2, 498.5], "3": [618, 498.5], "4": [487.1, 688.5], "5": [672.1, 688.5], "14": [161, 326.6], "15": [161, 397.4] },
  advisers: ["14", "15"],
  // every desk a member may sit at, [x, y] as the plan centres it
  desks: {
    "7": [297, 355], "8": [297, 445], "9": [297, 535], "10": [297, 625], "11": [297, 715], "12": [297, 805], "13": [297, 895],
    "23": [863, 355], "24": [863.2, 445], "25": [863.2, 535], "26": [863.2, 625], "27": [863, 715], "28": [863.2, 805], "29": [863.2, 895],
    "16": [161, 576], "17": [161, 645.1], "18": [161, 714.2], "19": [161, 894.5], "20": [161, 963.6], "21": [161, 1032.7],
    "30": [999.3, 326.6], "31": [999.3, 397.4], "32": [999.3, 576], "33": [999.3, 645.1], "34": [999.3, 714.2], "35": [999.3, 894.5], "36": [999.3, 963.6], "37": [999.3, 1032.7],
    "38": [416.7, 1073.1], "39": [446.2, 1143], "40": [498.4, 1193.6], "41": [663.5, 1193.6], "42": [714.1, 1143], "43": [743.6, 1073.1],
    "44": [312.2, 1121.1], "45": [345.1, 1194.4], "46": [399.8, 1261], "47": [467.2, 1306.5], "48": [693, 1306.5], "49": [760.4, 1261], "50": [815.2, 1194.4], "51": [848, 1121.1],
    "52": [230.1, 1240.5], "53": [930.1, 1240.5],
  },
  arcs: { 3: 164.4, 4: 275, 5: 397.3 }, // each ring's fitted radius about (cx, cy)
};
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
let chGeomC = null, vicGeomC = null, vicLCGeomC = null, nswGeomC = null;
const chamberGeom = (m) => (m && m.year === "vic22" ? (m.house === "senate" ? vicLCGeom() : vicGeom()) : m && m.year === "nsw23" && m.house !== "senate" ? nswGeom() : m && STATE_YEARS.has(m.year) ? saGeom(saFloorOf(m)) : m && m.house === "senate" ? senateGeom() : houseGeom());
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

/* the council's geometry, off its own descriptor: no floor file to wait on. The order along the
   benches runs as the House's does — down the government's columns, round the rings, up the
   opposition's — with every y measured off the rings' common centre so benchS reads it straight */
const VLU = 45; // the plan's pixels to a chamber unit
function vicLCGeom() {
  if (vicLCGeomC) return vicLCGeomC;
  const P = (v) => v / VLU, D = VCLC;
  const seats = Object.entries(D.desks).map(([id, [px, py]]) => {
    const x = P(px - D.cx), y = P(py - D.cy), row = VCLC_ROW(id);
    // the columns' chairs face the centre line; the rings' face the table
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
  const GS = [rowX[0] - GAS / 2, rowX[0] + GAS / 2, rowX[1] + GAS / 2, 10.83, 10.83, 10.83];
  const GC = [0.15, ...rowR.slice(0, -1).map((x, j) => (x + rowR[j + 1]) / 2), rowR[4] + 1.35];
  const benchPt = (s, k) => {
    if (s <= 0) return [-GS[k], s];
    if (s >= Math.PI * CHK) return [GS[k], Math.PI * CHK - s];
    const a = s / CHK; return [-GC[k] * Math.cos(a), GC[k] * Math.sin(a)];
  };
  const [rx, ry, rw, rh] = D.room.map((v, j) => P(v - (j < 2 ? (j ? D.cy : D.cx) : 0)));
  vicLCGeomC = {
    seats, rows, nRows: 5, bench: seats, byId: new Map(seats.map((c) => [c.id, c.k])),
    rOut: P(D.arcs[5]), box: { x0: rx, x1: rx + rw, y0: ry, y1: ry + rh },
    arms: false, table: ["9", "25"], // the leaders' own desks: third down each front column
    chairAt: [P(D.president[0] - D.cx), P(D.president[1] - D.cy), Math.PI / 2, 0, P(55), P(56)],
    aisle: P(225), yMid: mean(rows[1].filter((c) => c.y < 0).map((c) => c.y)),
    benchPt, benchOut, furniture: drawVicLCFurniture,
  };
  return vicLCGeomC;
}
/* the council's room, in the House's drawing: the floor, the benches (a run down each column
   where desks touch, a sector band per side round each ring), the President's desk and the
   clerks' and centre tables down the middle, the officials' and advisers' chairs, and the
   empty seats (outlined only, as the House's are) */
function drawVicLCFurniture(g, F, geom, opts = {}) {
  const th = TH, X = F.X, Yp = F.Yp, s = F.s, k = s / VLU, D = VCLC, P = (v) => v / VLU;
  const bench = css(mixC(th.floor, th.ink, th.dark ? 0.08 : 0.05)), wood = css(mixC(th.floor, th.ink, th.dark ? 0.15 : 0.11));
  const officer = mixC(th.floor, th.ink, th.dark ? 0.3 : 0.24);
  const back = (c, t) => css(towards(c, th.dark ? [0, 0, 0] : th.ink, t));
  const b = geom.box;
  g.fillStyle = css(th.floor); g.fillRect(X(b.x0), Yp(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
  g.save(); g.translate(X(0), Yp(0)); g.scale(k, k);
  const hair = 1 / k, H = 33; // a chair's half-side and a bench's margin round it
  g.lineWidth = hair; g.strokeStyle = css(th.line); g.fillStyle = bench;
  const rb = (x, y, w, h, r = 4) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); g.stroke(); };
  // the straight columns: each run of desks closer than a seat and a half apart is one bench
  const cols = new Map();
  const seatSpot = Object.entries(D.desks).filter(([id]) => VCLC_ROW(id) <= 2);
  for (const [id, [px, py]] of [...seatSpot, ...D.advisers.map((id) => [id, D.officers[id]])]) { const x = Math.round(px); if (!cols.has(x)) cols.set(x, []); cols.get(x).push(py); }
  for (const [x, ys] of cols) {
    ys.sort((p, q) => p - q);
    let run = null;
    for (const y of [...ys, 1e9]) {
      if (run && y - run[1] > 110) { rb(x - D.cx - H, run[0] - D.cy - H, 2 * H, run[1] - run[0] + 2 * H); run = null; }
      if (!run) run = [y, y]; else run[1] = y;
    }
  }
  // the rings: a sector band each side of the gangway, padded half a pitch past its desks
  for (const r of [3, 4, 5]) for (const side of [-1, 1]) {
    const ds = Object.entries(D.desks).filter(([id]) => VCLC_ROW(id) === r).map(([, [px, py]]) => [px - D.cx, py - D.cy]).filter(([x]) => (side < 0 ? x < 0 : x > 0));
    if (!ds.length) continue;
    const R = D.arcs[r], ang = ds.map(([x, y]) => Math.atan2(y, x)).sort((p, q) => p - q);
    const padA = (H / R) * 0.8, a0 = ang[0] - padA, a1 = ang[ang.length - 1] + padA;
    g.beginPath(); g.arc(0, 0, R - H, a0, a1, false); g.arc(0, 0, R + H, a1, a0, true); g.closePath(); g.fill(); g.stroke();
  }
  // the centre table and the clerks', and the President's desk with its inset
  const [tx, ty, tw, thh] = D.tables.centreTable, [cx2, cy2, cw, ch2] = D.tables.clerkTable, [px, py, pw, ph] = D.tables.presidentDesk;
  g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood;
  rb(tx - D.cx, ty - D.cy, tw, thh, 3); rb(cx2 - D.cx, cy2 - D.cy, cw, ch2, 3);
  g.lineWidth = hair; g.strokeStyle = css(th.line);
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
  // the officials: the Governor's ceremonial chair, the clerks, the centre table's chairs, the advisers
  for (const [id, [px, py]] of Object.entries(D.officers)) {
    const fa = D.advisers.includes(id) ? 0 : Math.PI / 2;
    drawChair(g, X(P(px - D.cx)), Yp(P(py - D.cy)), fa, P(38) * s, P(36) * s, css(officer), back(officer, 0.18), 1);
  }
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P(ty + thh / 2 - D.cy), P(tw - 16));
  }
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
    case "flow": case "informal": case "seifa": { const v = divValue(m, d.i); return v == null ? null : v + (S.lens === "seifa" && !isDemo() && d.seifa[S.index] ? d.seifa[S.index].pct / 100 : 0); }
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
  // New South Wales' (Minns at Kogarah, Speakman at Cronulla)
  nsw23: ["Kogarah", "Cronulla"],
  // Victoria's, three a side at the table in the 60th Parliament's plan: the Premier, the Leader
  // of the House and the Deputy Premier facing the Opposition Leader, the Deputy Leader of the
  // Opposition and the Nationals' leader (Carroll, Carbines, Williams against Wilson, Southwick, O'Brien)
  vic22: ["Niddrie", "Kew", "Ivanhoe", "Caulfield", "Dandenong", "Gippsland South"] };
/* seating plan or sorted: a year with a filed plan opens on it under the Winner lens and
   sorted under the others, until the reader picks one (S.seat) */
const seatMode = (m) => (!m.seating ? "sort" : S.seat || ((m.house === "senate" ? S.senLens === "party" : S.lens === "winner") ? "plan" : "sort"));
function chamberOrder(m) {
  const plan = seatMode(m) === "plan" ? m.seating : null;
  const key = plan ? `${m.year}|plan` : m.house === "senate" ? `${m.year}|${S.senLens}` : `${m.year}|${S.lens}|${S.tppMode}|${S.fpMode}|${S.party}|${S.from}|${S.vs}|${S.index}`;
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
    const B = geom.bench.filter((c) => !held.has(c.k)), onBench = (d) => !lead.includes(d.i);
    lead.forEach((i, s) => { if (i != null) at.set(i, table[s]); });
    const Gb = G.filter(onBench), Ob = O.filter(onBench);
    Gb.forEach((d, k) => at.set(d.i, B[k].k));
    C.forEach((d, k) => at.set(d.i, B[Gb.length + k].k));
    Ob.forEach((d, k) => at.set(d.i, B[B.length - 1 - k].k));
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
  const cuts = [], free = [];
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
    if (B.row2X !== undefined) { const [x0, x1] = lo(sx * (B.row2X - 13), sx * (B.row2X + 13)); rr(x0, B.arm.y0 - 12, x1, B.arm.y0 + B.arm.pitch * (B.arm.n - 1) + 12, 2); g.fill(); g.stroke(); }
    for (const bx of B.blockX ?? []) for (const [t0, t1] of B.tierY) { const [x0, x1] = lo(sx * (bx - 13.5), sx * (bx + 13.5)); rr(x0, t0 - 14, x1, t1 + 14, 2); g.fill(); g.stroke(); }
    B.sectors.forEach((secs, k) => secs.forEach(([a0, a1]) => {
      const r0 = P(B.R[k] - 13.5) * s, r1 = P(B.R[k] + 13.5) * s;
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
  // the furniture's names, where they fit
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P(geom.nsw ? -189 : -196), P(66));
    if (!geom.nsw) put("Hansard", 0, P(-48.5), P(58));
  }
}

// draw the whole chamber into a context already scaled to CSS pixels
function drawChamber(g, m, w, h, opts) {
  const geom = chamberGeom(m);
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
  const pat = opts.pattern;
  const backOf = (c) => towards(c, th.dark ? [0, 0, 0] : th.ink, th.dark ? 0.32 : 0.22);
  const drawn = [];
  const paint = (i, x, y, fa, W, D, sp) => {
    const d = m.divs[i];
    let c = fillDiv(m, i);
    let a = 1;
    if (filt && !passes(m, i)) a = 0.16;
    if (stSel && d.st !== stSel) a = Math.min(a, 0.2);
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
  // the majority line, threaded between the chairs from the front bench to the back row; only
  // when sorted, where it marks the seats that would fall first (in the seating plan it would
  // only count round from the Speaker's end)
  const cuts = opts.labels !== false && !ch.plan ? majorityCuts(ch, geom) : null;
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
    g.strokeStyle = css(th.ink); g.lineWidth = opts.big ? 1.5 : 1.2; g.setLineDash(opts.big ? [4, 3] : [3, 2]); g.lineJoin = "round";
    g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(X(x), Yp(y)) : g.moveTo(X(x), Yp(y)))); g.stroke(); g.setLineDash([]);
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
      const side0 = mx < 0 ? "right" : "left";
      // wrap the make-up to the room on that side, and find where the block's box falls
      const lay = (side, by, mode) => {
        const bx = X(side === "left" ? rO + 0.95 : -rO - 0.95);
        const maxW = Math.max(120, side === "left" ? w - bx - 4 : bx - 4);
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
        const room = (side === "left" ? w - bx : bx) >= wMax + 4;
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
  sa22: "Dan Cregan", sa26: "Nat Cook", nsw23: "Greg Piper", vic22: "Maree Edwards" };
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
function chamberPads(w = Wpx) { return isPhone() ? (w < 600 ? { t: 62, r: 3, b: 24, l: 3 } : { t: 30, r: 10, b: 36, l: 10 }) : { t: 34, r: 150, b: 36, l: 150 }; }
function drawChamberMain(m, alpha) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sen = m.house === "senate", sel = sen ? S.ssel : S.sel;
  chMain = drawChamber(ctx, m, Wpx, Hpx, { big: true, alpha, sel: sen ? (sel.level === "sen" ? sel.i : null) : selDiv(), hover: S.hover && S.hover.kind === (sen ? "sen" : "div") ? S.hover.i : null,
    state: sel.level === "state" ? sel.st : null, pad: chamberPads(), pattern: (() => { const p = hatch(); p.setTransform(new DOMMatrix().scale(1 / dpr)); return p; })() });
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
  if (p < 0.55) { drawGeo(m, 1 - p / 0.55, (1 - p / 0.55) * streetK()); drawIslands(m, 1 - p / 0.55); }
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
  const out = drawChamber(g, m, w, h, { big: false, sel: sd, hover: miniCh.hover ?? null, state: S.sel.level === "state" ? S.sel.st : null, pad, labels: true });
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
const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && (senFloor || SENM.year === "vic22") ? SENM : null) : M());
const SEN_SEATS = 76;
// every year whose upper house is in this lane: the federal elections, and the states' — a state
// election chooses no federal Senate, but the states' own upper houses (their Legislative
// Councils: SA's 22 members and NSW's 42, half-plus-one elected statewide at each state
// election, and Victoria's 40, five a region, all up together) sit in the same chamber view
// on their frames, from map/data/senate-<year>.json
// (.build/map/build_sa22_past.py, build_sa26_past.py, build_nsw23_past.py, build_vic22_lc.py).
const SEN_YEARS = YEARS.filter((y) => typeof y === "number" || y === "now" || STATE_YEARS.has(y));
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
  // Victoria's frame carries no upper house: nothing to switch to
  if (!SEN_YEARS.includes(S.year)) return "";
  return `<div class="lg-house" role="group" aria-label="Which chamber"><button type="button" data-house="reps" data-t="${lo}" aria-pressed="${S.house !== "senate"}">${lo}</button><button type="button" data-house="senate" data-t="${up}" aria-pressed="${S.house === "senate"}">${up}</button></div>`;
}
function senateLegendHTML(m) {
  const cats = (cnt, list) => `<div class="lg-cats">${list.filter((f) => cnt[f]).map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)} <b>${cnt[f]}</b></span>`).join("")}`;
  let h = houseSwitchHTML();
  if (S.senLens === "term") {
    const up = senCounts(m, upNext), stay = m.divs.filter((d) => !upNext(d)).length;
    h += `<div class="lg-t">${nv(m, "Who faces", "Who faced")} the voters at ${nextEl(m)}</div>`;
    h += `${cats(up, SEN_FAMS)}${stay ? `<span><i style="background:${css(SEN_STAY(TH))}"></i>Term to ${m.lc ? `the ${m.later} election` : m.later} <b>${stay}</b></span>` : ""}</div>`;
    h += `<div class="lg-note">${m.lc ? (m.year === "nsw23" ? "Twenty-one of the council’s forty-two members are elected as one statewide electorate at each state election; the rest sit until the next one." : m.year === "vic22" ? "All forty of the council’s members are elected together — five in each of Victoria’s eight regions — so every member faces the voters at each state election." : "Eleven of the council’s 22 members are elected as one statewide electorate at each state election; the rest sit until the next one.") : m.nextDD ? "The double dissolution of 9 May 2016 put all 76 seats to the voters." : m.dd ? "The double dissolution elected all 76: each state’s last six elected, and the territories’ four, faced the voters again in 2019." : "Each state elects half its 12 senators at a time; the territories’ four are elected every time."}</div>`;
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
  const lab = order.map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)} <b>${cnt[f]}</b></span>`).join("") + (m.vacant.length ? `<span><i style="background:var(--line-2)"></i>Vacant <b>${m.vacant.length}</b></span>` : "");
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
function loadSenateVote(y) {
  const k = svYear(y);
  if (k == null) return Promise.resolve(null);
  if (SV[k]) return Promise.resolve(SV[k]);
  return (SVP[k] ??= getJSON(`/map/data/senate-vote-${k}.json`).then((j) => (SV[k] = j)).catch((e) => { delete SVP[k]; throw e; }));
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
   New South Wales' Council (Parliament House, Sydney — parliament.nsw.gov.au's chamber photos)
   stands the same officers the same way, five shallow bench rows curving round the far end, 21
   members a side. Sydney's Assembly stood here too on its own straight blocks, but the real room
   is the sister of Victoria's — a horseshoe of benches about a rectangular central table — so
   since 2026-10-27 it is drawn in app-3-chamber.js's own idiom (NSWB/nswGeom) like the federal
   House's floor, and only the Council remains on this one. The Council seats 42, none at a census
   desk here (no seating plan is filed: each bloc fills the benches sorted, saFloorOf/saGeom's
   generic path).
   @sa-cells-begin – read as is by .build/map/sa_seating.mjs, which checks every desk a plan names
   is one drawn here. Measured off the chamber maps' floor images (pixels, x from the centre line,
   y down from the curves' centres), seat ids the Parliament's own desk names; a side's list reads
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
  // and New South Wales' Council (seats 42): five shallower rows round the same arrangement, the
  // President under the galleries, the Clerks at the table, the Usher of the Black Rod by the bar —
  // the government's members to the reader's left, the rest to the right. (Sydney's Assembly stood
  // here on its own straight blocks until it moved to app-3-chamber.js's NSWB idiom — the real
  // room is Victoria's sister, a horseshoe about a rectangular central table.)
  nswLC: {
    room: [-580, -520, 580, 306], chair: -446, officers: [-372, 192], table: [-346, -318, 88], mace: false, lead: ["A1", "B1"],
    straight: [
      { row: 1, x: 130, ys: [-300, -203, -106, -8], L: "A1 A2 A3 A4", R: "B1 B2 B3 B4" },
      { row: 2, x: 250, ys: [-300, -226, -152, -78, -4], L: "C1 C2 C3 C4 C5", R: "I1 I2 I3 I4 I5" },
    ],
    arcs: [
      { row: 3, a: 120, y: 8, r: 120, phi: [24, 54, 84], L: "D1 D2 D3", R: "J1 J2 J3" },
      { row: 4, a: 120, y: 8, r: 192, phi: [15, 38, 61, 84], L: "E1 E2 E3 E4", R: "K1 K2 K3 K4" },
      { row: 5, a: 120, y: 8, r: 264, phi: [12, 30, 48, 66, 84], L: "F1 F2 F3 F4 F5", R: "L1 L2 L3 L4 L5" },
    ],
  },
};
// every seat on a floor: { id, x, y (pixels), fa (the way it faces), row, arc? }
function saCells(F) {
  const cells = [], D = Math.PI / 180;
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1, key = side ? "R" : "L";
    for (const b of F.straight) b[key].split(" ").forEach((id, j) => { if (id !== "-") cells.push({ id, x: sx * b.x, y: b.ys[j], fa: side ? Math.PI : 0, row: b.row }); });
    for (const b of F.arcs) b[key].split(" ").forEach((id, j) => {
      if (id === "-") return;
      const p = b.phi[j] * D, x = sx * (b.a + b.r * Math.cos(p)), y = b.y + b.r * Math.sin(p);
      cells.push({ id, x, y, fa: Math.atan2(b.y - y, sx * b.a - x), row: b.row, arc: b });
    });
    for (const b of F.singles || []) cells.push({ id: b[key], x: sx * b.x, y: b.y, fa: -Math.PI / 2, row: b.row });
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
const saFloorOf = (m) => (m.year === "nsw23" ? "nswLC" : m.house === "senate" ? "lc" : "ha");
function saGeom(key) {
  if (saGeomC[key]) return saGeomC[key];
  const F = SAF[key], P = (v) => v / SAU;
  // the curves' common centre, each side's (half the gap between them), for the order along the benches
  const A = P(F.arcs.reduce((t, b) => t + b.a, 0) / F.arcs.length);
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
    const pad = c.arc ? (P(SA_SEAT.W / 2 + 10) / P(c.arc.r)) * CHK : P(SA_SEAT.W / 2 + 10);
    return { id: c.id, x, y, fa: c.fa, row: c.row, s: sideS(c, x, y), seg, pad, W: P(SA_SEAT.W - 4), D: P(SA_SEAT.D - 6), raw: c };
  });
  const seats = all.sort((p, q) => p.s - q.s || p.row - q.row);
  seats.forEach((c, k) => { c.k = k; });
  const s0 = seats[0].s, s1 = seats[seats.length - 1].s;
  seats.forEach((c) => { c.u = clamp((c.s - s0) / (s1 - s0), 0, 1); });
  const nRows = Math.max(...seats.map((c) => c.row));
  const rows = Array.from({ length: nRows + 1 }, (_, r) => seats.filter((c) => c.row === r));
  // the walkways the majority line threads: inside the front row, between rows, outside the back
  // row, on the straight benches (their distance from the centre line) and round the curves (their
  // radius about the side's centre; the front bench doesn't curve, so round the curves it stands a
  // chair inside the row behind it, and the line runs just inside the inner curve's chairs)
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rowX = rows.slice(1).map((r) => mean(r.filter((c) => !c.raw.arc && c.y < 0).map((c) => Math.abs(c.x))));
  const rowR = rows.slice(1).map((r) => { const a = r.filter((c) => c.raw.arc); return a.length ? mean(a.map((c) => P(c.raw.arc.r))) : null; });
  for (let j = rowR.length - 2; j >= 0; j--) if (rowR[j] == null) rowR[j] = rowR[j + 1] - P(SA_SEAT.D + 14);
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
    key, seats, rows, nRows, bench: seats.filter((c) => c.row > 0), byId: new Map(seats.map((c) => [c.id, c.k])),
    // the bloc labels hang just outside the room's walls
    rOut: rx1 - 0.6, box: { x0: rx0, x1: rx1, y0: ry0, y1: ry1 }, rect: true, cutPad: P(SA_SEAT.W / 2 + 10),
    arms: false, table: F.lead, chairAt: [0, P(F.chair), Math.PI / 2, 0, P(40), P(38)],
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
  const hw = SA_SEAT.W / 2 + SA_PAD, hd = SA_SEAT.D / 2 + SA_PAD;
  for (const side of [-1, 1]) {
    const key = side > 0 ? "R" : "L";
    // down the straight: a run of seats closer than a seat and a half apart is one bench
    for (const r of SF.straight) {
      const ys = r[key].split(" ").map((id, j) => (id === "-" ? null : r.ys[j]));
      const pitch = Math.min(...r.ys.slice(1).map((y, j) => y - r.ys[j]));
      let run = null;
      const flush = () => { if (run) rb(side * r.x - hd, run[0] - hw, 2 * hd, run[1] - run[0] + 2 * hw); run = null; };
      for (const y of ys) { if (y == null) { flush(); continue; } if (run && y - run[1] <= pitch * 1.5) run[1] = y; else { flush(); run = [y, y]; } }
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
    for (const q of SF.singles || []) rb(side * q.x - hw, q.y - hd, 2 * hw, 2 * hd);
  }
  // the dais, raised above the floor, its step drawn inside
  const dais = (inset) => { const w = 52 - inset, yt = SF.room[1] + 6 + inset, yc = SF.chair + 12; g.beginPath(); g.moveTo(-w, yt); g.lineTo(w, yt); g.lineTo(w, yc); g.arc(0, yc, w, 0, Math.PI); g.closePath(); };
  dais(0); g.fillStyle = wood; g.fill(); g.stroke();
  dais(7); g.fillStyle = bench; g.fill();
  // the table below it, the officers' chairs at its head; the Mace on the Assembly's
  const [t0, t1, tw] = SF.table;
  g.lineWidth = Math.max(hair, (0.05 * s) / k); g.strokeStyle = wood; g.fillStyle = bench;
  rb(-tw, t0, 2 * tw, t1 - t0, 3);
  g.lineWidth = hair; g.strokeStyle = css(th.line);
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
  // the officers: the Clerk on the chair's right, the Chairman of Committees, the Deputy Clerk
  const [oy, odx] = SF.officers, W = P(30) * s, Dp = P(28) * s;
  for (const ox of [-odx, 0, odx]) drawChair(g, X(P(ox)), Yp(P(oy)), Math.PI / 2, W, Dp, css(officer), back(officer, 0.18), 1);
  g.lineWidth = 1; g.strokeStyle = css(th.line);
  if (opts.big && s >= 16) {
    g.font = `400 ${s >= 26 ? 11 : 10}px ${SANS}`; g.fillStyle = css(th.ink3); g.textAlign = "center"; g.textBaseline = "middle";
    const put = (t, x, y, room) => { if (g.measureText(t).width <= room * s) g.fillText(t, X(x), Yp(y)); };
    put("The table", 0, P((t0 + t1) / 2 - (SF.mace ? 5 : 0)), P(2 * tw - 16));
  }
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
// a state frame's own words: a state election's opposition is the Liberals, its head
// of government a premier; its counts and state word are South Australia's (the ECSA's)
// only on an SA frame — New South Wales gets the NSWEC's wording
const isState = () => STATE_YEARS.has(S.year);
const isSA = () => SA_YEARS.has(S.year);
const isNSW = () => NSW_YEARS.has(S.year);
const isVic = () => VIC_YEARS.has(S.year);
// a state frame's elections commission, short form (state frames only)
const commX = () => (isSA() ? "ECSA" : isVic() ? "VEC" : "NSWEC");
const coalW = (cap) => (isSA() || isVic() ? (cap ? "The Liberals" : "the Liberals") : cap ? "The Coalition" : "the Coalition");
const leaderT = () => (isState() ? "premier" : "prime minister");
const ausW = () => (isSA() ? "South Australia" : isNSW() ? "New South Wales" : isVic() ? "Victoria" : "Australia");
const legW = (b) => famLeg(b);
// a family's preferences, possessive: the Liberals' on an SA or Victorian frame, the Coalition's elsewhere
const possW = (b) => (b === "lnp" && (isSA() || isVic()) ? "the Liberals’" : POSS[b]);
// the "now" view: today’s holder won the last count under another banner — the
// winner’s row in the count stays historical but earns a "· now X" note
const movedTo = (m, d) => (m.year === "now" && d.hold && d.hold.n === d.win.n && d.hold.ab !== d.win.ab ? leaderName(d.hold) : null);
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
const byNote = (d) => (d && d.by ? ", at the 2026 by-election" : "");
function seatCount(m, idx, fam) { return idx.filter((i) => m.divs[i].hold.fam === fam).length; }

/* ----- small figure builders ----- */
function upLink() {
  const s = S.sel, m = M();
  if (s.level === "aus") return "";
  const label = s.level === "state" ? "All seats" : s.level === "div" ? STATE_TITLE[s.st] : m.divs[s.div].n;
  const go = s.level === "state" ? "aus" : s.level === "div" ? `state:${s.st}` : `div:${s.div}`;
  return `<button type="button" class="st-up" data-go="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${ds(label)}</button>`;
}
function head(title, meta, hed, dek) {
  return `${upLink()}<div class="st-head"><h2>${ds(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
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
function famRows(fp, fpSw) {
  const order = FAMS.filter((b) => fp[b] > 0.05).sort((a, b) => fp[b] - fp[a]);
  const top = Math.max(40, fp[order[0]]);
  // a year with no previous count carries fpSw as an object of nulls (sa26)
  return `<div class="rows">${order.map((b) => `<div class="row"><div class="nm">${legW(b)}</div><div class="bar"><i style="width:${(100 * fp[b]) / top}%;${swc(b)}"></i></div><div class="v ${tx(b)}">${f1(fp[b])}</div><div class="d">${fpSw && fpSw[b] != null ? sgn(fpSw[b]) : ""}</div></div>`).join("")}</div>`;
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
    return `<g data-year="${yr}" style="cursor:pointer"><title>${ds(title)}</title><circle cx="${x(r[0])}" cy="${yy(yv)}" r="${on ? 5.5 : 4.2}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="2"${r[1] == null ? ' fill-opacity="0.9"' : ""}/>${on ? `<circle cx="${x(r[0])}" cy="${yy(yv)}" r="8.5" fill="none" stroke="var(--ink)" stroke-width="1.4"/>` : ""}</g>`;
  }).join("");
  const xl = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025].map((y) => `<text x="${x(y)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="${y === cur ? "var(--ink)" : "var(--ink-3)"}" font-weight="${y === cur ? 600 : 400}">’${String(y).slice(2)}</text>`).join("") + (h.some((r) => r[0] === 2026) ? `<text x="${x(2026)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">by</text>` : "");
  const runs = [];
  for (const r of h) { const last = runs[runs.length - 1]; if (last && last.n === r[3] && last.ab === r[2]) last.to = r[0]; else runs.push({ n: r[3], ab: r[2], from: r[0], to: r[0], by: r[4] }); }
  const now = S.year === "now" ? M() : null, hold = now ? now.divs[d.i].hold : null;
  if (hold && runs.length && (runs[runs.length - 1].n !== hold.n || runs[runs.length - 1].ab !== hold.ab)) runs.push({ n: hold.n, ab: hold.ab, from: "now", to: "now", switched: true });
  const holders = runs.reverse().map((r) => `<div><i style="${swc(FAM(r.ab))}"></i><span>${ds(r.n)}<small>${esc(leaderName({ ab: r.ab, pn: "" }))}</small></span><span>${r.switched ? "now" : r.by ? `${r.from} by-election` : r.from === r.to ? r.from : `${r.from}–${String(r.to).slice(2)}`}</span></div>`).join("");
  return `<div class="st-sec hist"><h3>Since 2004 <small>Labor’s two-party vote, and who won</small></h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Labor’s two-party share in ${ds(d.n)} at each election since 2004">${grid}<polyline points="${ptsLine}" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linejoin="round"/>${dots}${xl}</svg><div class="holders">${holders}</div><p class="st-note">Boundaries are redrawn between some elections, so the area behind a name can change.</p></div>`;
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
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
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
        if (!aus) { const ch = (m.changes || []).filter((x) => m.divs[m.byName.get(x.div)].st === st); if (ch.length) dek += ` Since the election: ${[...new Set(ch.map((x) => x.div))].map((n) => ds(n)).join(" and ")} ${ch.length > 1 ? "have" : "has"} changed hands or party.`; }
        return { hed, dek };
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
        const dek = sw.length ? `${toward === 0 ? "None" : cap(ofN(toward, sw.length))} ${toward === 0 ? `of the ${sw.length}` : ""} seats with a measured swing moved towards ${to}.`.replace("  ", " ") + ` The biggest swing that way was ${big ? `${ds(m.divs[big.i].n)}’s, ${pts(big.v)}` : "–"}.` : "";
        return { hed, dek: dek + (isNowM ? " These are the 2025 election’s swings." : "") };
      }
      const hed = `${lead === "alp" ? "Labor" : coalW(1)} won ${f1(leadPct)}% of the two-party vote${where}`;
      const ahead = withData.filter((i) => m.divs[i].tpp > 50).length;
      const sp = swingPhrase(A.tppSw, prev);
      const dek = `${sp ? `That’s ${sp}. ` : ""}On the two-party count Labor led in ${ahead} of the ${withData.length === N ? N : `${withData.length} counted`} seats${where}, ${coalW()} in ${withData.length - ahead}.${isNowM && (aus || st === "NSW") ? " These are the 2025 election’s figures; Labor didn’t stand at the Farrer by-election, so Farrer has none." : ""}`;
      return { hed, dek };
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
      const hed = `${f1(A.infPct)}% of ballots${where} were informal`;
      const r = idx.map((i) => ({ i, v: m.divs[i].infPct })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      const pa = prev && Y[prev] && Y[prev].areas ? Y[prev].areas[st] : null;
      const dek = `${pa ? `${Math.abs(A.infPct - pa.infPct) < 0.05 ? "Unchanged" : A.infPct >= pa.infPct ? "Up" : "Down"} from ${f1(pa.infPct)}% in ${prev}. ` : ""}The highest rate was ${ds(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${ds(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
      return { hed, dek };
    }
    case "cls": {
      if (isState()) return { hed: `${ausW()}’s seats carry no AEC type`, dek: `The inner-metropolitan to rural scale is the AEC’s federal classification; the ${commX()} publishes none of its own.` };
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
const DM_TOP = { lang: ["seats with the most residents speaking another language at home", "most English-speaking"], a65: ["seats with the most residents aged 65 and over", "with the fewest"], a2034: ["seats with the most residents aged 20 to 34", "with the fewest"], fborn: ["seats with the most residents born overseas", "the most Australia-born"], uni: ["seats with the most residents holding a university qualification", "with the fewest"], blue: ["seats with the most blue-collar workers", "with the fewest"], loinc: ["seats where the most adults live in lower-income households", "with the fewest"], hiinc: ["seats where the most adults live in high-income households", "with the fewest"] };
// the measures' census basis as copy: 2007–2013 read the census areas the
// polling places stand in (2006 census at 2007 and 2010, 2011 at 2013 — the
// AEC's where-voters-live record begins 2016); 2016 on reads where their
// voters live (2021 census); the income lanes (2013 on) count adults
const DB = {
  venue: {
    seats: (y) => `From the ${y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in: the AEC’s record of where voters live begins in 2016.`,
    who: "of residents of the census area it stands in",
    whoAdults: "of the adults of the census area it stands in",
    note: (y) => `From the ${y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in.`,
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
  return m.demoBasis === "venue" ? { seats: db.seats(m.year), who: db.who, whoAdults: db.whoAdults, note: db.note(m.year) } : db;
};
// polling-place cards read one area, not a district pool
const demoBoothCopy = (m) => (m.demoBasis === "sa1" ? DB.sa1Booth : demoCopy(m));
// one income sentence for a seat or place facts list: both band shares,
// then the household median, in the census year's own dollars; "" when
// the place carries no income lane at all
function incFact(m, dm) {
  if (!dm) return "";
  const c = m.incomeCuts || {};
  const parts = [];
  if (dm.loinc != null || dm.hiinc != null) {
    const pair = [];
    if (dm.loinc != null) pair.push(`${f0(100 * dm.loinc)}% of adults live in households earning under ${mny(c.loCutWeekly)} a week`);
    if (dm.hiinc != null) pair.push(`${f0(100 * dm.hiinc)}% in households earning ${mny(c.hiEdgeWeekly)} or more a week`);
    parts.push(`${pair.join(", ")}${incDollars(m)}`);
  }
  if (dm.medIncWeekly != null) parts.push(`the median weekly household income is ${mny(dm.medIncWeekly)}`);
  return parts.length ? `${parts.join("; ")}.` : "";
}
const DEMO_EARLY = { hed: "Census figures start at the 2007 election", dek: "2007 and 2010 are counted from the census areas the polling places stand in (the 2006 census — the AEC’s record of where voters live begins in 2016), 2013 on the 2011 census; from 2016 the figures follow the voters. Choose 2007 or later on the timeline." };
function areaDemo(m, st, idx, where, isNowM) {
  const k = S.index, A = m.areas[st];
  if (!A.demo) return DEMO_EARLY;
  const scored = idx.filter((i) => m.divs[i].demo).sort((a, b) => m.divs[b].demo[k] - m.divs[a].demo[k]);
  const share = `${f1(A.demo[k])}% ${isInc(k) ? "of the adults" : "of residents"}${where} ${dmVerb(m, k)}`;
  const note = demoCopy(m).seats;
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
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const { hed, dek } = areaHedDek(m, st);
  const title = aus ? (m.year === "now" ? "The House today" : STATE_YEARS.has(m.year) ? (isNSW() ? "New South Wales election" : isVic() ? "Victorian election" : "South Australian election") : `${yearLabel(m.year)} election`) : STATE_TITLE[st];
  // never the date — the eyebrow line above the map already carries it
  const meta = aus ? (m.year === "now" ? `${N} members` : `${N} ${STATE_YEARS.has(m.year) ? "districts" : "seats"}`) : (m.year === "now" ? `${N} seats · members today` : `${N} seats · ${yearLabel(m.year)} election`);
  let h = head(title, meta, hed, dek);
  if (lensNumeric() && !(S.lens === "seifa" && isDemo() && !A.demo)) h += `<div class="st-sec"><h3>Across the seats <small>${esc(lensShort())}${aus ? "" : ", " + STATE_SHORT[st]}</small></h3>${distBlock(m, "seats", idx.map((i) => m.divs[i]), { compact: true })}</div>`;
  // the House: who holds the seats
  if (S.view !== "chamber") {
    const order = ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f]);
    const counts = order.map((f) => `<span><i style="${swc(f)}"></i>${legW(f)} <b>${cnt[f]}</b></span>`).join("");
    h += `<div class="st-sec"><h3>${m.year === "now" ? "The chamber today" : "The new chamber"} <small>${aus ? "every member in their seat" : `${STATE_POSS[st]} members lit`}</small></h3><div class="st-chamber"><canvas id="minich" aria-label="${isSA() ? "The House of Assembly" : isNSW() || isVic() ? "The Legislative Assembly" : "The House of Representatives"}, each member a chair"></canvas></div><div class="counts">${counts}</div></div>`;
  }
  if (m.year === "now" && aus) {
    const ch = m.changes.slice().reverse();
    h += `<div class="st-sec"><h3>Since the election <small>${ch.length} changes</small></h3><div class="changes">${ch.map((c) => `<button type="button" data-go="divname:${esc(c.div)}"><span class="dt">${shortDate(c.date).replace(/ 20(\d\d)$/, " ’$1")}</span><span class="tx"><b>${ds(c.div)}.</b> ${ds(c.text)}.</span></button>`).join("")}</div></div>`;
    h += `<p class="st-note" style="margin-top:22px">The figures below are the 2025 election’s.</p>`;
  }
  // the two-party read
  const swp = swingPhrase(A.tppSw, prev);
  const classicN = m.divs.filter((d) => d.tpp != null).length;
  h += `<div class="st-sec"><h3>Two-party preferred <small>Labor v ${isSA() || isVic() ? "the Liberals" : "the Coalition"}${aus ? "" : ", " + STATE_SHORT[st]}</small></h3><div class="hero">${heroPair("Labor", A.tpp, "alp", isSA() || isVic() ? "Liberal" : "Coalition", 100 - A.tpp, "lnp")}${marginBar("Labor", "alp", isSA() || isVic() ? "Liberal" : "Coalition", "lnp", A.tpp - (100 - A.tpp), 20)}<p class="hero-verdict"><b>${A.tpp >= 50 ? "Labor" : coalW(1)} ahead</b> by ${pts(Math.abs(2 * A.tpp - 100))}${swp ? `; ${swp}` : ""}.</p></div>${isState() ? `<p class="st-note">Only the ${classicN} districts whose count finished Labor against ${isSA() || isVic() ? "Liberal" : "the Coalition"} carry this read; the ${commX()} publishes no notional two-party count for the rest.</p>` : ""}</div>`;
  h += `<div class="st-sec"><h3>Primary vote <small>% of formal votes${prev != null ? ` · change on ${prev}` : ""}</small></h3>${famRows(A.fp, A.fpSw)}</div>`;
  h += `<div class="st-sec"><h3>Informal <small>% of ballots cast</small></h3><div class="big"><span class="v">${f1(A.infPct)}%</span><span class="l">${aus ? "" : `${ausW()} ${f1(m.areas.AUS.infPct)}%`}</span></div></div>`;
  const bySt = aus ? STATES.filter((s) => m.areas[s]) : [];
  // a one-row "by state" table says nothing the headline didn't (SA frames list SA alone)
  if (bySt.length > 1) {
    h += `<div class="st-sec"><h3>By state</h3><table class="tbl"><thead><tr><th>State</th><th>Seats</th><th>Labor 2PP</th><th>Swing</th></tr></thead><tbody>${bySt.map((s) => { const a = m.areas[s]; const sc = {}; for (const i of a.idx) { const f = holdFam(m.divs[i].hold); sc[f] = (sc[f] || 0) + 1; } const bar = ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"].filter((f) => sc[f]).map((f) => `<i style="width:${(100 * sc[f]) / a.idx.length}%;${swc(f)}"></i>`).join(""); return `<tr data-go="state:${s}"><td>${STATE_TITLE[s].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${a.idx.length}<span class="seatbar">${bar}</span></td><td>${f1(a.tpp)}</td><td>${a.tppSw != null ? sgn(a.tppSw) : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  const close = idx.map((i) => m.divs[i]).filter((d) => !d.by).sort((a, b) => a.margin - b.margin).slice(0, 6).map((d) => ({ i: d.i, v: d.margin }));
  h += `<div class="st-sec"><h3>Closest seats <small>winning margin, points</small></h3>${linkRows(m, close, (v, d) => f1(v), (i) => colCss(m.divCol[i]))}</div>`;
  h += foot(m);
  return h;
}

/* ----- a seat ----- */
// the election a seat's swings are measured against: "Now" shows the 2025
// count (against 2022) everywhere but Farrer, whose by-election is set against 2025
const prevFor = (m, d) => (m.year === "now" ? (d && d.by ? 2025 : 2022) : prevYearOf(m.year) ?? (m.res && m.res.prev));
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
      const fpLead = [...d.c].sort((a, b) => b.v - a.v)[0];
      let dek = `${ds(wn)} won the final count ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)})`;
      if (d.classic && d.tppSw != null) dek += `, ${swingPhrase(d.tppSw, prev)}`;
      dek += ".";
      if (fpLead !== d.win) dek += ` ${ds(surname(fpLead.n))} led on first preferences, ${f1((100 * fpLead.v) / d.formal)}% to ${f1((100 * d.win.v) / d.formal)}%.`;
      dek += ` ${isState() ? "On the usual scale" : "By the AEC’s measure"} that makes ${ds(d.n)} ${statusOf(d.winPct)}.`;
      if (ch.kind === "re" && ch.since < (m.year === "now" ? 2025 : m.year)) dek += ` ${ds(surname(d.win.n))} has held it since ${ch.since}.`;
      return { hed, dek };
    }
    case "tpp": {
      if (d.tpp == null) return { hed: `There was no Labor v ${isSA() || isVic() ? "Liberal" : "Coalition"} count in ${ds(d.n)}`, dek: isState() ? `The ${commX()} publishes a two-party count only where the final pair is Labor against ${isSA() || isVic() ? "Liberal" : "the Coalition"}.` : d.by ? "Labor didn’t stand at the by-election, so the AEC counted the final two only: One Nation against the independent." : "" };
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
        return { hed: Math.abs(c) < 0.05 ? `${Poss(P)} primary vote in ${ds(d.n)} was unchanged` : `${Poss(P)} primary vote ${c >= 0 ? "rose" : "fell"} ${pts(c)} in ${ds(d.n)}`, dek: `${SUBJ[P]} won ${f1(v)}% of first preferences${d.by ? " at the by-election, against the seat’s 2025 count" : ""}.` };
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
      const r = [...m.divs].filter((x) => x.infPct != null).sort((a, b) => b.infPct - a.infPct).findIndex((x) => x.i === d.i) + 1;
      return { hed: `${f1(d.infPct)}% of ${ds(d.n)}’s ballots were informal`, dek: `That’s ${rankWords(r, m.divs.length)} rate of the ${m.divs.length} seats${byNote(d)}; across Australia it was ${f1(m.areas.AUS.infPct)}%.` };
    }
    case "cls": return { hed: d.cls ? `${ds(d.n)} is ${/^[aeiou]/i.test(CLS_LOWER[d.cls]) ? "an" : "a"} ${CLS_LOWER[d.cls]} seat` : `${ds(d.n)} has no AEC type on record`, dek: d.cls ? `${CLS_DEF[d.cls]}, in the AEC’s words.` : "" };
    case "seifa": {
      if (isDemo()) {
        const k = S.index;
        if (!d.demo) return m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY : { hed: `${ds(d.n)} has no census figure`, dek: "" };
        const xs = m.divs.filter((x) => x.demo).sort((a, b) => b.demo[k] - a.demo[k]), r = xs.findIndex((x) => x.i === d.i) + 1;
        const aus = m.areas.AUS.demo;
        return { hed: `${f0(100 * d.demo[k])}% of ${ds(d.n)}’s ${isInc(k) ? "adults" : "residents"} ${dmVerb(m, k)}`, dek: `That’s ${rankWords(r, xs.length)} share of the ${xs.length} seats; across ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}, ${f1(aus[k])}%. ${demoCopy(m).seats}` };
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
  const meta = `${d.cls ? esc(CLS_SHORT[d.cls]) + " · " : ""}${esc(STATE_TITLE[d.st])}${d.by ? " · by-election, 9 May 2026" : ""}`;
  let h = head(d.n, meta, hed, dek);
  const [wn, rn] = pairNames(d.win, d.run);
  h += `<div class="st-sec"><h3>Final count <small>${d.by ? "the by-election’s" : "two candidates"}</small></h3><div class="hero">${heroPair(wn, d.winPct, d.win.fam, rn, 100 - d.winPct, d.run.fam)}${marginBar(wn, d.win.fam, rn, d.run.fam, 2 * d.winPct - 100)}<p class="hero-verdict"><b>${ds(wn)}</b> by ${int(d.votesMargin)} votes · ${statusOf(d.winPct)}</p></div></div>`;
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
  const incRow = d.demo ? incFact(m, d.demo) : "";
  const demoFacts = d.demo ? `<dt>Language</dt><dd>${f0(100 * d.demo.lang)}% of residents speak a language other than English at home</dd><dt>Origin</dt><dd>${f0(100 * d.demo.fborn)}% ${DM_VERB.fborn}</dd><dt>Education</dt><dd>${f0(100 * d.demo.uni)}% ${DM_VERB.uni}</dd><dt>Work</dt><dd>${f0(100 * d.demo.blue)}% ${DM_VERB.blue}</dd><dt>Age</dt><dd>${f0(100 * d.demo.a65)}% are 65 or older, ${f0(100 * d.demo.a2034)}% are 20 to 34</dd>${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}` : "";
  const hasDeciles = IX.some((ix) => d.seifa[ix] && d.seifa[ix].dec);
  const deciles = hasDeciles ? decileRows((ix) => d.seifa[ix] && d.seifa[ix].dec) : "";
  const seatNote = `${demoCopy(m).note}${deciles ? ` 1 is the most disadvantaged tenth of the ${m.divs.length} seats, 10 the most advantaged.` : ""}`;
  const seatSmall = m.demoBasis === "sa1" ? "ABS census, 2021" : "AEC type · ABS census and SEIFA, deciles among seats";
  if (d.cls || d.demo || deciles) h += `<div class="st-sec"><h3>The seat <small>${seatSmall}</small></h3>${d.cls || d.demo ? `<dl class="facts">${d.cls ? `<dt>Type</dt><dd>${esc(CLS_SHORT[d.cls])}: ${esc(CLS_DEF[d.cls])}</dd>` : ""}${demoFacts}</dl>` : ""}${deciles}<p class="st-note">${seatNote}</p></div>`;
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
        if (!Number.isNaN(b.tpp[j])) {
          if (S.tppMode === "swing") { const s = nn(b.tppSw[j]); hed = s == null ? `This place has no swing on record` : `${pts(s)} swing to ${s >= 0 ? "Labor" : "the Coalition"} here`; dek = s == null ? "It wasn’t used at the previous election." : ""; }
          else { const t2 = b.tpp[j]; hed = `${t2 >= 50 ? "Labor" : "The Coalition"} won ${f1(Math.max(t2, 100 - t2))}% of the two-party vote here`; }
          break;
        }
      // falls through when there's no two-party count
      default:
        hed = `${ds(ln)} won this place ${f0(lp)}–${f0(100 - lp)}`;
        dek = `${int(b.votes[j])} votes were cast here, ${f1(b.infPct[j])}% informal. Across ${ds(D.n)}, ${ds(surname(D.win.n))} won ${f1(D.winPct)}–${f1(100 - D.winPct)}.`;
        void rn;
    }
    if (S.lens === "fp") { const v = b.fp[S.party][j]; hed = `${famLeg(S.party)} won ${f1(v)}% of first preferences here`; dek = `In ${ds(D.n)} as a whole, ${f1(D.fp[S.party])}%.`; }
    if (S.lens === "senate") {
      const v = senBoothValue(m, j), dv = senDivValue(m, D);
      if (v == null) { hed = senNoValue(m, "booth", D); dek = ""; }
      else if (senGap()) { hed = `${SUBJ[S.party]} ${senGapWords(v)} here`; dek = `${f1(svShare(svOf(m).booths[b.id[j]], S.party))}% of Senate first preferences against ${f1(b.fp[S.party][j])}% in the House.${dv != null ? ` Across ${ds(D.n)} the gap was ${sgn(dv)} points.` : ""}`; }
      else { hed = `${SUBJ[S.party]} won ${f1(v)}% of the Senate vote here`; dek = dv != null ? `In ${ds(D.n)} as a whole, ${f1(dv)}%.` : ""; }
    }
    if (S.lens === "informal") { hed = `${f1(b.infPct[j])}% of ballots here were informal`; dek = `In ${ds(D.n)} as a whole, ${f1(D.infPct)}%.`; }
    if (S.lens === "seifa" && isDemo()) { const k = S.index, r = raw.demo && raw.demo[j], v = r ? 100 * r[DM.indexOf(k)] : null; hed = v == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure") : `${f0(v)}% ${isInc(k) ? demoBoothCopy(m).whoAdults : demoBoothCopy(m).who} ${dmVerb(m, k)}`; dek = v == null ? "" : `In ${ds(D.n)} as a whole, ${D.demo ? f1(100 * D.demo[k]) : "–"}%. ${demoBoothCopy(m).note}`; }
    else if (S.lens === "seifa") { const arr = S.basis === "voters" ? raw.vdec[j] : raw.dec[j]; const v = arr ? arr[IX.indexOf(S.index)] : null; hed = v ? `This place is in decile ${v} of 10 on ${IX_ABBR[S.index]}` : `This place has no ${IX_ABBR[S.index]} score`; dek = S.basis === "voters" ? "Scored on where its voters live." : "Scored on the census area it stands in."; }
    if (S.lens === "cls") { hed = `${ds(D.n)} is ${/^[aeiou]/i.test(CLS_LOWER[D.cls] || "") ? "an" : "a"} ${CLS_LOWER[D.cls] || ""} seat`; }
  }
  // the flow hed needs no per-booth count: the NSWEC carries no booth 2CP,
  // so nsw23 booths have no lead/tcp and the copy would never render here
  if (S.lens === "flow") {
    if (m.res.flBasis === "modelled") { hed = flowSeat(D) ? `Preference flows aren’t modelled by polling place` : `No preference split is modelled in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s modelled split is a district figure — read it on the district’s card.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else if (m.res.flOpv) { hed = flowSeat(D) ? `Preference flows aren’t counted by polling place` : `No preference split was counted in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s split is a district figure — read it on the district’s card. New South Wales re-counts ballots by district, not by polling place.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else { const v = flowSeat(D) ? nn(b.flowAlp[S.from][j]) : null; hed = v == null ? `No ${S.from === "ind" ? "independent’s" : famLeg(S.from) + "’"} preferences were split here between Labor and ${vsW()}` : `${f0(v)}% of ${S.from === "ind" ? "independents’" : S.from === "oth" ? "other candidates’" : famLeg(S.from) + "’"} preferences here went to Labor`; }
  }
  let h = head(b.name[j], `${esc(TYPE[b.ty[j]] || "Polling place")}${where ? " · " + ds(where) : ""}`, hed, dek);
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
  const dec = raw.dec[j], vdec = raw.vdec[j], dr = raw.demo && raw.demo[j], dc = demoBoothCopy(m);
  const incRow = dr ? incFact(m, { loinc: dr[6], hiinc: dr[7] }) : "";
  const demoRows = dr ? `<dl class="facts">${dr[0] != null ? `<dt>Language</dt><dd>${f0(100 * dr[0])}% ${dc.who} speak a language other than English at home</dd>` : ""}${dr[3] != null ? `<dt>Origin</dt><dd>${f0(100 * dr[3])}% ${DM_VERB.fborn}</dd>` : ""}${dr[4] != null ? `<dt>Education</dt><dd>${f0(100 * dr[4])}% ${DM_VERB.uni}</dd>` : ""}${dr[5] != null ? `<dt>Work</dt><dd>${f0(100 * dr[5])}% ${DM_VERB.blue}</dd>` : ""}${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}${dr[1] != null && dr[2] != null ? `<dt>Age</dt><dd>${f0(100 * dr[1])}% are 65 or older, ${f0(100 * dr[2])}% are 20 to 34</dd>` : ""}</dl><p class="st-note">${dc.note}</p>` : "";
  h += `<div class="st-sec"><h3>The neighbourhood <small>ABS census and SEIFA, national deciles</small></h3>${dec || vdec ? decileRows((ix) => (dec ? dec[IX.indexOf(ix)] : null), (ix) => (vdec && vdec[IX.indexOf(ix)] ? ` · its voters ${vdec[IX.indexOf(ix)]}` : "")) : '<p class="st-note">No SEIFA score: this place has no fixed address, or its census area is too small to publish.</p>'}<p class="st-note">The bars score the census area the place stands in.${isState() ? "" : " From 2016, where the AEC records it, “its voters” scores the areas its voters live in."}</p>${demoRows}</div>`;
  h += `<div class="act"><button type="button" data-go="div:${D.i}">Back to ${ds(D.n)}</button><button type="button" data-listbooths>All places in ${ds(D.n)}</button></div>`;
  h += foot(m);
  return h;
}

function foot(m) {
  const src = m.year === "now" ? "AEC results for the 2025 election (event 31496) and the 2026 Farrer by-election (event 31633); members’ changes of party from the parties and the APH" : SA_YEARS.has(m.year) ? `ECSA results for the ${yearLabel(m.year)} state election` : NSW_YEARS.has(m.year) ? `NSWEC results for the ${yearLabel(m.year)} state election` : VIC_YEARS.has(m.year) ? `VEC results for the ${yearLabel(m.year)} state election` : `AEC results for the ${m.year} election (event ${m.res.event})`;
  return `<p class="st-foot">${src}. ${SA_YEARS.has(m.year) ? "ECSA boundaries; ABS census" : NSW_YEARS.has(m.year) ? "NSWEC boundaries; ABS census" : VIC_YEARS.has(m.year) ? "VEC boundaries; ABS census" : "AEC boundaries and seat types; ABS SEIFA"}.</p>`;
}
let storyKey = "";
function renderStory(force) {
  const m = M(); if (!m) return;
  const s = S.sel;
  if (S.view === "chamber" && S.house === "senate") {
    if (!SENM) return;
    const ss = S.ssel, key = ["senate", S.senLens, ss.level, ss.st, ss.i].join("|");
    if (!force && key === storyKey) return;
    storyKey = key;
    $("#story").innerHTML = storySenate(SENM);
    return;
  }
  const key = [S.year, S.lens, S.tppMode, S.fpMode, S.senMode, S.party, S.from, S.vs, S.index, S.basis, S.view, s.level, s.st, s.div, s.booth, filtersKey()].join("|");
  if (!force && key === storyKey) return;
  storyKey = key;
  const el = $("#story");
  el.innerHTML = s.level === "aus" ? storyArea(m, "AUS") : s.level === "state" ? storyArea(m, s.st) : s.level === "div" ? storyDiv(m, s.div) : storyBooth(m, s.booth);
  // the charts fill in now, not a frame on: a block that grows after the
  // story paints moves everything below it, and a walk's hold with it
  paintMiniChamber(); hydrateDists();
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
  // a signed lens (a primary's change, the Senate's gap on the House) reads as a change: diverging, no bar
  const signed = (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap());
  const scale = S.lens === "fp" || S.lens === "senate" ? (signed ? null : FPMAX[S.party]) : S.lens === "flow" ? 100 : S.lens === "seifa" ? (dec ? 10 : DM_RANGE[S.index][1]) : null;
  return { key: "lens", label: lensHead(), short: lab, get, num: S.lens !== "cls", txt: S.lens === "cls", w: "minmax(120px,1fr)", lens: true, dist: S.lens !== "cls",
    fmt: dec ? (v) => String(Math.round(v)) : signed ? (v) => sgn(v) : f1,
    color: (v) => colorOf(v), decile: dec, diverge: signed,
    html: (r) => { const v = get(r); if (v == null || Number.isNaN(v)) return `<span class="c2">–</span>`; if (S.lens === "cls") return `<span class="sw" style="background:${colCss(colorOf(v))}"></span>${esc(CLS_SHORT[v])}`; const w = scale ? clamp((100 * v) / scale, 3, 100) : 100; return `<div class="lv">${scale ? `<i style="width:${0.6 * w}px;background:${colCss(colorOf(v))}"></i>` : `<i style="width:9px;height:9px;background:${colCss(colorOf(v))}"></i>`}<span>${dec ? v : signed ? sgn(v) : f1(v)}</span></div>`; } };
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
  if (S.lens === "senate") { const r = senArea(m, a.idx, S.party); return r ? (senGap() ? r.gap : r.sen) : null; }
  if (S.lens === "seifa" && isDemo()) return a.demo ? a.demo[S.index] : null;
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
    bar += sel("State", "st", STATES.map((s) => [s, STATE_TITLE[s]]), S.f.st);
    bar += sel(m.year === "now" ? "Held by" : "Won by", "win", ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => m.divs.some((d) => holdFam(d.hold) === f)).map((f) => [f, famLeg(f)]), S.f.win);
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
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} change` : `${famLeg(S.party)} primary`;
    case "senate": return senGap() ? `${famLeg(S.party)}, Senate v House` : `${famLeg(S.party)} Senate vote`;
    case "flow": return `${famLeg(S.from)} to Labor`;
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
    case "senate": return senGap() ? `${FAM_CODE[S.party]} gap` : `${FAM_CODE[S.party]} Senate`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    default: return lensShort();
  }
}
function valueText(v, kind, ctx) {
  if (v == null) {
    switch (S.lens) {
      case "senate": return ctx ? senNoValue(ctx.m, kind, ctx.d) : "No Senate count here";
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 2007 on" : "No census figure here") : "No score here";
      case "fp": return S.fpMode === "change" ? "Didn’t stand both times" : "Didn’t stand";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} ${sgn(v)} points` : `${famLeg(S.party)} ${f1(v)}%`;
    case "senate": return senGap() ? `${famLeg(S.party)} ${Math.abs(v) < 0.05 ? "level" : `${pts(v)} ${v > 0 ? "higher" : "lower"}`} in the Senate` : `${famLeg(S.party)} ${f1(v)}% in the Senate`;
    case "flow": return `${f0(v)}% of ${famLeg(S.from)} preferences to Labor`;
    case "informal": return `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? `${f1(v)}% ${dmVerb(M(), S.index)}` : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
// the search box promises as much as its width can show, never clipped mid-word
let phCtx = null;
function fitSearchPlaceholder() {
  const input = $("#q"), sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? ["Search a senator or state", "Search a senator", "Search"] : ["Search a seat, member or place", "Search a seat or member", "Search"];
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
  lensRowEl.classList.toggle("more", el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
}
// the House's lenses, or in the Senate's chamber the Senate's own
function renderLenses() {
  const sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? SEN_LENSES : yearLenses(S.year), cur = sen ? S.senLens : S.lens, attr = sen ? "data-slens" : "data-lens";
  $("#lenses").innerHTML = list.map((l) => `<button type="button" class="rd-tab" role="tab" ${attr}="${l.id}" aria-selected="${cur === l.id}"><span class="tw" data-t="${l.label}">${l.label}</span></button>`).join("");
  $("#lenses").setAttribute("aria-label", sen ? "Colour the senators by" : "Colour the seats by");
  $("#lenses").addEventListener("scroll", lensOverflow, { passive: true });
  lensOverflow();
  fitSearchPlaceholder();
}

/* =============================== the legend =============================== */
let legendKey = "";
const boothsShown = () => S.view === "map" && (selDiv() != null || T.k >= K_ALL);
const legendState = () => [S.view, boothsShown(), S.lens, S.tppMode, S.fpMode, S.senMode, S.party, S.from, S.vs, S.index, S.basis, S.year, S.seat, S.house, S.senLens, TH && TH.dark].join("|");
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "senate": return senGap() ? [-10, 10] : [0, FPMAX[S.party]];
    case "flow": return [10, 90];
    case "informal": return [0, 12];
    case "seifa": return isDemo() ? DM_RANGE[S.index] : [1, 10];
  }
  return null;
};
function legendHist(m, lo, hi) {
  const vals = m.divs.map((d) => divValue(m, d.i)).filter((v) => v != null);
  // a stand-in year (holdLegendHeight) keeps the bars' room even where the loaded year has no values
  // (the Senate lens before its votes load, or in a year without them, holds the bars' room too)
  if (vals.length < 10) return m.standIn || S.lens === "senate" ? '<div class="lg-hist" aria-hidden="true"></div>' : "";
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
  el.innerHTML = senOn() ? senateLegendHTML(SENM) : legendHTML(m);
  holdLegendHeight(m);
}
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
    SUM ? null : getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); }),
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
  // its flip) re-holds it once, which reads as the key's own change
  const key = [w, S.view, y, real, boothsShown(), S.lens, S.tppMode, S.fpMode, S.senMode, S.index, S.basis, S.seat].join("|");
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat, year: S.year };
    let hMax = 0;
    try {
      S.year = y;
      const my = legendStandIn(m, y);
      for (const seat of S.view === "chamber" && my.seating ? ["plan", "sort"] : [keep.seat]) {
        S.seat = seat;
        probe.innerHTML = legendHTML(my);
        hMax = Math.max(hMax, probe.getBoundingClientRect().height);
      }
    } finally { Object.assign(S, keep); }
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
  el.style.minHeight = h + "px";
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
function legendHTML(m) {
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const grad = (tbl, from, to) => { const st = []; for (let k = 0; k <= 10; k++) st.push(`${css(tbl[Math.round(lerp(from, to, k / 10))])} ${k * 10}%`); return `linear-gradient(90deg, ${st.join(",")})`; };
  const ticks = (vals, lo, hi, fmt) => `<div class="lg-ticks">${vals.map((v) => `<span style="left:${(100 * (v - lo)) / (hi - lo)}%">${fmt(v)}</span>`).join("")}</div>`;
  const mark = (v, lo, hi) => (v == null ? "" : `<span class="mk" style="left:${(100 * (clamp(v, lo, hi) - lo)) / (hi - lo)}%" title="Australia ${f1(v)}"></span>`);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => `<select data-opt="${name}" aria-label="${name}">${list.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const partyOpts = FAMS.map((f) => [f, famLeg(f)]);
  // the chamber view chooses its chamber first
  let h = S.view === "chamber" ? houseSwitchHTML() : "";
  switch (S.lens) {
    case "winner": {
      const cnt = {}; for (const d of m.divs) cnt[holdFam(d.hold)] = (cnt[holdFam(d.hold)] || 0) + 1;
      h += `<div class="lg-t">${boothsOn ? "Who led the final count at each place" : isNow() ? "Who holds each seat today" : `Who won each seat in ${yearLabel(m.year)}`}</div>`;
      // in the chamber the counts are on the canvas's bloc labels and in the story, not three times
      h += `<div class="lg-cats">${["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f] || boothsOn).map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)}${boothsOn || S.view === "chamber" ? "" : ` <b>${cnt[f]}</b>`}</span>`).join("")}</div>`;
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
    case "senate": {
      const gap = senGap(), A = senArea(m, m.areas.AUS.idx, S.party), none = svYear(m.year) == null;
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} <button type="button" class="flip" data-flip="sen">${gap ? "Senate less House" : "Senate share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      if (gap) h += `<div class="lg-ramp" style="background:linear-gradient(90deg, ${css(RAMP.loss[100])} 0%, ${css(RAMP.loss[45])} 30%, ${css(RAMP.loss[0])} 50%, ${css(RAMP.fp[S.party][45])} 70%, ${css(RAMP.fp[S.party][100])} 100%)">${A ? mark(A.gap, lo, hi) : ""}</div>${ticks([-10, -5, 0, 5, 10], -10, 10, (v) => (v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"))}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Better in the House</span><span class="t-${S.party}">Better in the Senate ▶</span></div>`;
      else h += `<div class="lg-ramp" style="background:${grad(RAMP.fp[S.party], 0, 100)}">${A ? mark(A.sen, 0, FPMAX[S.party]) : ""}</div>${ticks([0, FPMAX[S.party] / 2, FPMAX[S.party]], 0, FPMAX[S.party], (v) => `${v}%${v === FPMAX[S.party] ? "+" : ""}`)}`;
      // (the note's words don't wait on the votes: the key's height is measured before they load, and the
      // story gives Australia's figure)
      h += `<div class="lg-note">${none ? "A state election: there was no Senate vote." : `The line marks Australia${gap ? "; drawn where the party stood for the House" : ""}.${boothsOn && svYear(m.year) === 2004 ? " The AEC published no 2004 Senate counts by polling place." : ""}`}</div>`;
      break;
    }
    case "flow": {
      // Labor's rival in the final: the Coalition, or One Nation where the year has such finals on file;
      // the groups whose preferences can be read are the other parties'
      const from = [["grn", "the Greens’"], S.vs === "onp" ? ["lnp", STATE_YEARS.has(m.year) ? "the Liberals’" : "the Coalition’s"] : ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]];
      h += `<div class="lg-t">Where ${opt("from", S.from, from)} preferences went${hasVsOnp(m) ? `, Labor v ${opt("vs", S.vs, [["lnp", STATE_YEARS.has(m.year) ? "the Liberals" : "the Coalition"], ["onp", "One Nation"]])}` : ""}</div>`;
      h += legendHist(m, 10, 90);
      h += `<div class="lg-ramp" style="background:${grad(S.vs === "onp" ? RAMP.divOn : RAMP.div, 0, 200)}"></div>${ticks([10, 30, 50, 70, 90], 10, 90, (v) => `${v}%`)}<div class="lg-ends"><span class="t-alp">◀ Mostly to Labor</span><span class="${S.vs === "onp" ? "t-onp" : "t-lnp"}">Mostly to ${vsW()} ▶</span></div><div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and ${vsW()}</div>`;
      const fe = m.res.flBasis === "modelled" ? flowErrOf(m, S.from) : null;
      if (fe) h += `<div class="lg-note">Modelled estimates — South Australia publishes no per-candidate splits. ${fe.seat ? `Nine in ten of the model’s per-seat estimates land within ${f0(fe.v)} points of a counted split.` : `Labor v One Nation splits are checked only in total, to within about ${f0(fe.v)} points, never seat by seat.`}</div>`;
      if (m.res.flOpv) h += `<div class="lg-note">Counted, not modelled — New South Wales re-counted every ballot paper. Preferences there are optional, so a ballot can exhaust before the final two; a share reads the ballots that reached them.</div>`;
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
      h += `<div class="lg-t"><select data-opt="index" aria-label="Census measure">${og("Advantage, ABS SEIFA", IX.map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]))}${og("People", dmFor(m).map((x) => [x, DM_NAME[x]]))}</select></div>`;
      if (isDemo()) {
        const [lo, hi] = DM_RANGE[S.index], early = m.year !== "now" && m.year < DEMO_FROM;
        // an income lane can arrive by hash on a year whose store carries
        // none (income starts 2013); it reads as its own kind of early
        const noInc = isInc(S.index) && !hasInc(m);
        if (!early) h += legendHist(m, lo, hi);
        h += `<div class="lg-ramp" style="background:${grad(RAMP.demo[S.index], 0, 100)}">${early || !aus.demo || aus.demo[S.index] == null ? "" : mark(aus.demo[S.index], lo, hi)}</div>${ticks([lo, (lo + hi) / 2, hi], lo, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}`;
        // the income lanes' note names their own cut in the census
        // year's dollars, then the same census-basis tail
        const incNote = `Share of adults in households earning ${S.index === "loinc" ? `under ${mny(m.incomeCuts && m.incomeCuts.loCutWeekly)}` : `${mny(m.incomeCuts && m.incomeCuts.hiEdgeWeekly)} or more`} a week${m.incomeCuts && m.incomeCuts.dollarsYear ? ` (${m.incomeCuts.dollarsYear} dollars)` : ""}`;
        h += `<div class="lg-note">${early ? "Census people figures start at the 2007 election: 2007 and 2010 read the census areas the polling places stand in (2006 census), 2013 on the 2011 census; from 2016 they follow the voters (2021 census)." : noInc ? "Income figures start at the 2013 election, in the census year's own dollars: 2013 reads the census areas the polling places stand in; from 2016 they follow the voters." : `${isDemo() && isInc(S.index) ? incNote : "Share of residents"}, ${m.demoBasis === "venue" ? `${m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `2021 census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`}${aus.demo && aus.demo[S.index] != null ? ` The line marks ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}: ${f1(aus.demo[S.index])}%.` : ""}`}</div>`;
        break;
      }
      h += `<div class="lg-ramp" style="background:${grad(RAMP.seifa, 0, 100)}"></div>${ticks([1, 10], 1, 10, (v) => `${v}`)}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Least advantaged</span><span style="color:var(--ink-3)">Most ▶</span></div>`;
      h += boothsOn ? `<div class="lg-note">Places scored ${opt("basis", S.basis, [["venue", "where they stand"], ["voters", "where their voters live"]])}</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  // in the chamber, a year with a seating plan can show the members where they sit or sorted by the lens
  if (S.view === "chamber" && m.seating) {
    const md = seatMode(m);
    const by = { winner: "winning share", tpp: S.tppMode === "swing" ? "swing" : "two-party share", fp: "primary vote", flow: "preference flow", informal: "informal vote", cls: "seat type", seifa: "census measure" }[S.lens];
    h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s seating plan of ${m.seating.plan}${m.seating.note ? `, ${m.seating.note}` : ""}.` : `By ${by}, each side from the Speaker’s end.`}</span></div>`;
  }
  if (boothsOn) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  return h;
}

/* =============================== the timeline =============================== */
let SUM = null;
let tlCtx = null; // shared canvas context for measuring stop-label widths
/* one dated row per jurisdiction: the federal elections on top, New South Wales',
   Victoria's and South Australia's state ones on their own rows below, each stop
   at its date on the one scale */
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 106, m = M();
  const X = (y) => 22 + ((xOfYear(y) - YEAR_X[2004]) / (YEAR_X.now - YEAR_X[2004])) * (W - 44);
  const NX = (nx) => 22 + ((nx - YEAR_X[2004]) / (YEAR_X.now - YEAR_X[2004])) * (W - 44);
  // a state row's cursor: its own previous elections (2018/2019 before the frames
  // open, 2022 on the SA row is sa22, not the federal 2022), then the frames' spots
  const STATE_ROW_PREV_X = { sa: SA_PREV_X, nsw: NSW_PREV_X, vic: VIC_PREV_X };
  const stGx = (st) => (ry) => NX(STATE_ROW_PREV_X[st][ry] ?? YEAR_X[st + String(ry).slice(2)] ?? ry);
  const short = W < 560, cur = S.year;
  /* each state row sits lower than the row above's labels end: the whole row (line,
     labels and the selected stop's underline) fits inside the box */
  const rows = [
    { ys: YEARS_FED, base: Math.round(H * 0.22), top: 2 },
    { ys: YEARS_NSW, base: Math.round(H * 0.44), top: Math.round(H * 0.22) + 16, gx: stGx("nsw") },
    { ys: YEARS_VIC, base: Math.round(H * 0.66), top: Math.round(H * 0.44) + 16, gx: stGx("vic") },
    { ys: YEARS_SA, base: Math.round(H * 0.88), top: Math.round(H * 0.66) + 16, gx: stGx("sa") },
  ];
  const rowIx = (y) => (NSW_YEARS.has(y) ? 1 : VIC_YEARS.has(y) ? 2 : SA_YEARS.has(y) ? 3 : 0);
  const sd = m ? selDiv() : null;
  let g = "";
  for (const r of rows) g += `<line x1="0" x2="${W}" y1="${r.base}" y2="${r.base}" stroke="var(--line)"/>`;
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
      g += `<circle cx="${r[4] ? X("now") : gx(r[0])}" cy="${cy}" r="${(r[4] ? "now" : r[0]) === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${ds(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (cur === "now" && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X("now")}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${holdFam(m.divs[sd].hold)})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    // in the Senate's chamber each stop reads that election's upper house
    const sen = senOn();
    const st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
    for (const r of rows) {
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
  const rowsOf = [
    { i: 0, items: YEARS_FED.map((y) => ({ y, lab: short && y !== "now" ? "’" + String(y).slice(2) : yearLabel(y) })) },
    { i: 1, items: YEARS_NSW.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
    { i: 2, items: YEARS_VIC.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
    { i: 3, items: YEARS_SA.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
  ];
  for (const R of rowsOf) {
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
    for (const t of its) {
      const lx = t.x + t.dx + t.w / 2;
      const hitTop = R.i ? r.top : 0, hitBot = R.i + 1 < rows.length ? rows[R.i + 1].top : H;
      const uline = t.on ? `<line x1="${lx - t.w / 2}" x2="${lx + t.w / 2}" y1="${labY + 2}" y2="${labY + 2}" stroke="var(--ink)" stroke-width="2"/>` : "";
      g += `<g class="stop" data-year="${t.y}" style="cursor:pointer"><rect class="hit" x="${t.x - 24}" y="${hitTop}" width="48" height="${hitBot - hitTop}"/><line x1="${t.x}" x2="${t.x}" y1="${r.base - 3}" y2="${r.base + 3}" stroke="${t.on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${t.on ? " on" : ""}" x="${lx}" y="${labY}" text-anchor="middle">${esc(t.lab)}</text>${uline}</g>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Federal elections 2004 to now, and New South Wales, Victorian and South Australian state elections; choose one">${g}</svg>`;
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
  if (h && h.kind === "sen") return SENM ? senTip(SENM, h.i) : "";
  const m = M(); if (!h || !m) return "";
  const goes = h.go ? `<div class="ts">Click to go out to the island</div>` : "";
  if (h.kind === "isl") return `<div class="tn">${esc(h.isl)}</div><div class="ts">In no seat at this election</div>${goes}`;
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    return `<div class="tn">${ds(d.n)}<span>${h.isl ? esc(h.isl) + " · " : ""}${STATE_SHORT[d.st]}${sp}</span></div><div class="tv">${esc(valueText(v, "div", { m, d }))}</div><div class="ts">${ds(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>${goes}`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  return `<div class="tn">${ds(b.name[j])}<span>${ds(D.n)}</span></div><div class="tv">${esc(valueText(boothValue(m, j), "booth", { m, d: D }))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>`;
}

/* =============================== selection =============================== */
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
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
  const m = M(), el = $("#sugg"), q = S.q.trim(), sen = senOn();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of sen ? (SENM.search ??= senSearchItems(SENM)) : m.search.items) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], sen: [], div: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" || it.k === "sen" ? 6 : 4)) g.push(it); }
  sugg = [...groups.state, ...groups.sen, ...groups.div, ...groups.mp, ...groups.cand, ...groups.booth];
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", sen: "Senators", div: "Seats", mp: isNow() ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of ["state", "sen", "div", "mp", "cand", "booth"]) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : it.k === "sen" ? colCss(SENM.divCol[it.i]) : colCss(m.divCol[it.i]);
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw" style="background:${color}"></i><span class="t">${ds(it.t)}</span><span class="s">${ds(it.s)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">${sen ? "No senator or state" : "No seat, member or place"} matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  if (senOn()) { selectSen(it.k === "state" ? { level: "state", st: it.st } : { level: "sen", st: SENM.divs[it.i].st, i: it.i }); return; }
  const view = it.k === "booth" && S.view === "chamber" ? "map" : undefined;
  if (it.k === "state") goState(it.st, { view });
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
    S.view === "list" || stage.bottom <= 0 || stage.top >= vh ? "hidden" : "visible";
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
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (senate) { renderLenses(); $("#mp-meta").textContent = metaLine(); if (v === "chamber") needSenateFloor(); }
  holdEyebrow();
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#cities", "#zoomer", "#hint"]) $(id).hidden = v !== "map";
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
  if (FED_LENS.has(id) && STATE_YEARS.has(S.year)) return;
  // the Senate's votes load with their lens (about 120KB a year, gzipped)
  if (id === "senate" && svYear(S.year) != null && !SV[svYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenateVote(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s votes didn’t load. Try again."));
    return;
  }
  const hold = walkHold(takeSpot());
  S.lens = id; S.sort = null; S.dist = null;
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
let yearFade = null;
async function setYear(y) {
  if (y === S.year) return;

  // the spot is taken now, while it's fresh: the election may take a while to load
  const from = S.year, a = M(), spot = takeSpot();
  // a state election on the timeline has no Senate: it opens in the House's chamber
  if (S.house === "senate" && !SEN_YEARS.includes(y)) { S.house = "reps"; chAnim = null; chLast.clear(); renderLenses(); }
  // ... and the Senate-vote/seat-type lenses are AEC reads the state frames don't offer
  if (STATE_YEARS.has(y) && FED_LENS.has(S.lens)) S.lens = "winner";
  showLoading(true);
  // the Senate's chamber moves with the timeline: that election's Senate too
  try { await Promise.all([loadYear(y), S.house === "senate" ? loadSenate(y) : null, S.lens === "senate" ? loadSenateVote(y) : null]); } catch (e) { showLoading(true, "That election didn’t load. Try again."); return; }
  showLoading(false);
  const b = Y[y];
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
  if (S.view === "map") yearFade = reduceMotion ? null : { from, t0: performance.now(), dur: 520 };
  setExtent();
  renderTimeline(); renderLegend(); renderStory(true); renderFilterPill(); renderBack(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
  schedule();
}
function metaLine(m = M(), sen = senOn() ? SENM : null) {
  if (!m) return "";
  if (sen) return sen.lc ? `${STATE_POSS[stOfYear(sen.year)]} Legislative Council from ${longDate(sen.asOf)} · ${sen.divs.length} members` : sen.year === "now" ? `The Senate as it sits, ${longDate(sen.asOf)} · ${sen.divs.length} senators` : `The Senate from ${longDate(sen.asOf)}, after the ${sen.year} election · ${sen.divs.length} senators`;
  return m.year === "now" ? `The House as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : STATE_YEARS.has(m.year) ? `${NSW_YEARS.has(m.year) ? "New South Wales" : VIC_YEARS.has(m.year) ? "Victorian" : "South Australian"} election, ${longDate(m.date)} · ${m.divs.length} districts · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} seats · ${m.booth.n.toLocaleString("en-AU")} polling places`;
}
/* the eyebrow holds the height of its jurisdiction family's longest line, so a walk through one
   family never moves the figure under it: between 414 and 600px an election's line wraps to two
   and Now's fits on one, and with the page at its top no scroll can take that back. Federal and
   each state's lines hold separately — a state's line is short and would sit in the tall federal
   hold — with a family walk moving the head once. Every unloaded year's line is measured from the
   facts assemble.mjs stamps in (data-stamp.mjs); only the chamber view walks into a Senate (and
   back to the House at SA 2026), so only it floors on its family's Senate lines too */
const META_FACTS = /*@meta-facts*/{"house":{"2004":["2004-10-09",150,8234],"2007":["2007-11-24",150,8235],"2010":["2010-08-21",150,8951],"2013":["2013-09-07",150,9146],"2016":["2016-07-02",150,8328],"2019":["2019-05-18",151,8875],"2022":["2022-05-21",151,8479],"2025":["2025-05-03",150,8940],"nsw23":["2023-03-25",93,3117],"sa22":["2022-03-19",47,695],"sa26":["2026-03-21",47,753],"vic22":["2022-11-26",88,1755],"now":["2026-10-25",150,8940]},"senate":{"2004":["2005-07-01",76],"2007":["2008-07-01",76],"2010":["2011-07-01",76],"2013":["2014-07-01",75],"2016":["2016-07-02",76],"2019":["2019-07-01",76],"2022":["2022-07-01",76],"2025":["2025-07-01",76],"now":["2026-10-09",76],"nsw23":["2023-03-25",42],"sa22":["2022-03-19",22],"sa26":["2026-03-21",22],"vic22":["2026-10-27",40]},"mix":{"nsw23":{"lnp":36,"alp":45,"grn":3,"ind":9},"sa22":{"alp":27,"lnp":16,"ind":4},"sa26":{"alp":34,"lnp":5,"ind":4,"onp":4},"vic22":{"alp":56,"lnp":28,"grn":4}}};
const ebHeights = new Map();
function holdEyebrow() {
  const eb = $(".mp-sec > .rd-eyebrow"), meta = $("#mp-meta"), w = eb.clientWidth;
  if (!w || !M()) return;
  const famOf = (y) => YEAR_JUR[y] || "fed";
  const ch = S.view === "chamber", fam = famOf(S.year), at = `${w}|${ch}|${fam}`;
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
addEventListener("resize", fitSearchPlaceholder);
addEventListener("resize", lensOverflow);

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
    drawFocus(m); drawBooths(m); drawIslands(m); drawLabels(m);
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
  const first = !Wpx;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const changed = Math.abs(Wpx - r.width) > 0.5 || Math.abs(Hpx - r.height) > 0.5;
  // only the height moved (the key above the stage grew or shrank): a view the page framed
  // glides to the new fit; one the reader has moved keeps its zoom, centred as before
  const dh = r.height - Hpx, keyOnly = !first && Math.abs(Wpx - r.width) <= 0.5 && changed && S.view === "map";
  const moved = keyOnly && !atLastFit() && !flight;
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (flight && keyOnly) flight.redo();
    else if (first || changed) fitSelection(keyOnly && !reduceMotion ? 320 : 0);
  }
  updateCanvasVis();
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
  if (S.lens === "senate") { p.set("p", S.party); if (!senGap()) p.set("m", "share"); }
  if (S.lens === "flow") { p.set("p", S.from); if (S.vs !== "lnp") p.set("f", S.vs); }
  if (S.lens === "seifa") { p.set("i", S.index); if (S.basis === "voters") p.set("b", "voters"); }
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
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const yr = p.get("y"); if (yr && YEARS.includes(yearOf(yr))) S.year = yearOf(yr);
  const l = p.get("l"); if (l && yearLenses(S.year).some((x) => x.id === l)) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change"; if (mm === "share" && S.lens === "senate") S.senMode = "share";
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else S.party = pp; }
  S.vs = p.get("f") === "onp" ? "onp" : "lnp";
  const i = p.get("i"); if (i && (IX.includes(i) || DM.includes(i))) S.index = i;
  if (p.get("b") === "voters") S.basis = "voters";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  const o = p.get("o"); if (o === "plan" || o === "sort") S.seat = o;
  if (p.get("c") === "senate") { S.house = "senate"; if (SEN_LENSES.some((l) => l.id === p.get("sl"))) S.senLens = p.get("sl"); senFromURL = p.get("ss"); }
  return p.get("s");
}
let senFromURL = null;
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
  if (h && h.kind === "sen") { selectSen({ level: "sen", st: SENM.divs[h.i].st, i: h.i }); return; }
  if (!h && senOn()) { if (S.ssel.level !== "aus") selectSen({ level: "aus" }); return; }
  if (!h) {
    // a miss lets the selection go — on the map only near the whole-country
    // fit (a zoomed miss is a pan mis-tap); the chamber has no camera, so a
    // click away from the seats always deselects
    if (S.sel.level === "aus") return;
    if (S.view === "chamber" || (S.view === "map" && T.k < HOME.k * 1.4)) goAus();
    return;
  }
  if (h.go) goIsland(h.go);
  else if (h.kind === "booth") goBooth(h.i);
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
  const g = e.target.closest("g[data-year]"); if (g) { setYear(yearOf(g.dataset.year)); }
});
// a tap names the fixed view's spot before any handler acts on it
document.addEventListener("click", (e) => walkAim(e.clientY), true);
$("#time").addEventListener("click", (e) => { const g = e.target.closest("[data-year]"); if (g) setYear(yearOf(g.dataset.year)); });
// a stop under the pointer starts loading its election, so the click finds it ready
$("#time").addEventListener("pointerover", (e) => { const g = e.target.closest("[data-year]"); if (g) { const y = yearOf(g.dataset.year); if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120); } });
document.addEventListener("click", (e) => {
  const city = e.target.closest("[data-city]");
  if (city) { flyToCity(+city.dataset.city); return; }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip],[data-seat],[data-house],[data-slens],[data-sgo]");
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
  if (t.dataset.house) { setHouse(t.dataset.house); return; }
  if (t.dataset.slens) { setSenLens(t.dataset.slens); return; }
  if (t.dataset.sgo && SENM) { const [k, v] = t.dataset.sgo.split(":"); selectSen(k === "aus" ? { level: "aus" } : k === "state" ? { level: "state", st: v } : { level: "sen", st: SENM.divs[+v].st, i: +v }); return; }
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.seat) { if (t.dataset.seat !== seatMode(CM() || M())) { S.seat = t.dataset.seat; startChamberGlide(); renderLegend(); writeURL(); schedule(); miniCh.dirty = true; } return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
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
  if (t.hasAttribute("data-clear")) { S.f = { st: null, cls: null, win: null, margin: null, range: null }; filtersChanged(); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.opt) {
    const k = t.dataset.opt;
    // (a new rival takes the place of the group it was: One Nation's preferences can't be read against One Nation)
    if (k === "vs") { S.vs = t.value; if (S.from === t.value) S.from = t.value === "onp" ? "lnp" : "onp"; }
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
// with the pointer over the lens row the arrows walk the lenses, not the years;
// on a phone the row scrolls horizontally, the All-polls menubar way
let lensHover = false;
$("#lenses").addEventListener("pointerenter", () => { lensHover = true; });
$("#lenses").addEventListener("pointerleave", () => { lensHover = false; });
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (e.key === "/" && !typing) { e.preventDefault(); q.focus({ preventScroll: true }); q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") {
    if (senOn()) { const s = S.ssel; if (s.level === "sen") selectSen({ level: "state", st: s.st }); else if (s.level === "state") selectSen({ level: "aus" }); }
    else goUp();
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); (lensHover ? walkLens : walkYear)(e.key === "ArrowRight" ? 1 : -1); }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); walkLane(e.key === "ArrowDown" ? 1 : -1); }
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
let cullRaf = 0;
addEventListener("scroll", () => { if (!cullRaf) cullRaf = requestAnimationFrame(() => { cullRaf = 0; updateCanvasVis(); }); }, { passive: true });

/* once the page is up, every other election loads in the background — nearest
   timeline stops first, one idle slice at a time — so a timeline jump, a
   chamber switch or the Senate lens finds its data already here. Skipped where
   the connection asks to save data (the timeline's hover preload still covers
   a stop the reader nears); a year's failed fetch drops its record so a real
   click tries it again */
const idleSlice = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 900));
function preloadYears() {
  const conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
  const at = YEARS.indexOf(S.year);
  const stops = YEARS.filter((y) => !Y[y]).sort((a, b) => Math.abs(YEARS.indexOf(a) - at) - Math.abs(YEARS.indexOf(b) - at));
  const next = () => {
    const y = stops.shift();
    if (y != null) return void loadYear(y).catch(() => { if (Y[y] && !Y[y].divs) delete Y[y]; }).then(() => idleSlice(next));
    // the chambers' lane, cheap beside the years: every Senate (~7KB each) and
    // its floor, then the Senate-vote lens files (the AEC served no 2004 count)
    loadSenates().catch(() => {});
    loadSenateFloor().catch(() => {});
    for (const sy of SEN_YEARS) { const k = svYear(sy); if (k != null && k !== 2004) loadSenateVote(sy).catch(() => {}); }
  };
  idleSlice(next);
}

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  $("#cities").innerHTML = CITIES.map(([n], k) => `<button type="button" data-city="${k}">${n}</button>`).join("");
  const meta = loadLegendMeta();
  showLoading(true);
  try { await Promise.all([loadYear(S.year), meta, S.lens === "senate" ? loadSenateVote(S.year) : null]); } catch (err) { showLoading(true, "The map’s data didn’t load. Reload the page to try again."); return; }
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); ebHeights.clear(); holdEyebrow(); });
  window.__map = { S, Y, walk(dir, y) { walkAim(y); walkYear(dir, true); }, walkLane, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get HOME() { return HOME; },
    get away() { return away; },
    get islands() { return islDrawn.map((c) => ({ key: c.s.key, r: c.r, docked: c.docked, dots: c.dots.map((d) => ({ j: d.j, x: d.x, y: d.y })) })); },
    landAt(px, py) { const m = M(); if (!m) return false; const g = geoOf(m); if (!g || !g.paths) return false; const bx = (px - T.x) / T.k, by = (py - T.y) / T.k; for (let i = 0; i < m.divs.length; i++) { const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue; if (hitCtx.isPointInPath(g.paths[i], bx, by)) return true; } return false; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); },
    view(ll, k) { const p = proj(ll); d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(Wpx / 2 - p[0] * k, Hpx / 2 - p[1] * k).scale(k)); } };
  preloadYears();
})();

})();
