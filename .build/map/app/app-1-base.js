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
const incEpoch = (m) => (m.demoInterp ? " in census-year dollars" : incDollars(m));
const DM_VERB_INC = {
  loinc: (m) => `live in households earning ${incLoFrag(m)}${incEpoch(m)}`,
  hiinc: (m) => `live in households earning ${mny(m.incomeCuts && m.incomeCuts.hiEdgeWeekly)} or more a week${incEpoch(m)}`,
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
  // the informal lens's exhausted-ballot view (New South Wales' optional-preferential count)
  infMode: "informal",
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
const DATA_V = /*@data-stamps*/{};
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
  if (!prev) change = { kind: yNum === 2004 ? "unknown" : "new" };
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
    // the lens-level exhausted share is counted off the divisions' own flow rows
    const exd = idx.map((i) => m.divs[i]).filter((d) => d.exhPct != null);
    const exhPct = exd.length ? (100 * sum(exd.map((d) => (d.exhPct / 100) * d.formal))) / sum(exd.map((d) => d.formal)) : null;
    out[st] = { st, fp, fpSw, tpp: (100 * a.tpp[0]) / (a.tpp[0] + a.tpp[1]), tppSw: a.tpp[2], infPct: (100 * a.inf) / (a.inf + a.formal), exhPct, idx, formal: a.formal, demo };
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
    // the people-interp blend record rides the year on interpolated years
    // (2007–2019); the demo copy and income epoch texts branch on it
    m.demoInterp = res.demoInterp || null;
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
