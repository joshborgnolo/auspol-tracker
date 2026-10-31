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
      loinc: seq(20, 0.13), hiinc: seq(275, 0.12), incmed: seq(48, 0.14),
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
const FAM_CODE = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", ind: "IND", oth: "OTH" };
// the ECSA's own codes ride the same rails: LIB is the Coalition, ONP One Nation
const FAM = (ab) => (ab === "ALP" ? "alp" : ["LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"].includes(ab) ? "lnp" : ["GRN", "GWA", "TG", "GVIC", "AGV", "GA", "QG", "CCG", "ESG", "GDA", "GLO", "GSA", "RCG", "VGA", "WSG"].includes(ab) ? "grn" : ab === "ON" || ab === "HAN" || ab === "ONP" ? "onp" : ab === "IND" || ab === "" || ab === "NAFD" || ab === "CSA" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", LIB: "Liberal", LNP: "Liberal National", LNQ: "Liberal National", NP: "Nationals", NAT: "Nationals", CLP: "Country Liberal", GRN: "Greens", GA: "Greens", GWA: "Greens (WA)", TG: "Tasmanian Greens", GVIC: "Victorian Greens", AD: "Democrats", IND: "Independent", NAFD: "Independent", ON: "One Nation", ONP: "One Nation", HAN: "One Nation", KAP: "Katter’s Australian", PUP: "Palmer United", UAPP: "United Australia", LDP: "Liberal Democrats", AJP: "Animal Justice", CYA: "Trumpet of Patriots", FFP: "Family First", FFPA: "Family First", LTP: "Libertarian", HMP: "Legalise Cannabis", GRPF: "People First", SAL: "Socialist Alliance", VNS: "Victorian Socialists", ASP: "Shooters, Fishers and Farmers", AUC: "Australian Christians", CEC: "Citizens Party", IMO: "HEART", SOPA: "FUSION", AUD: "Australian Democrats", DEM: "Democrats", GAP: "Great Australian", IAP: "Indigenous-Aboriginal", JLN: "Jacqui Lambie Network", TNL: "TNL", SPP: "Sustainable Australia", DHJP: "Justice Party", AUVA: "Australian Values", WAP: "Western Australia Party", AUP: "Australian Progressives", TLOC: "The Local Party", DPDA: "Democratic Alliance", CA: "Centre Alliance", AMEP: "Motoring Enthusiast", AC: "Australian Conservatives", APA: "Progressive Alliance", GLT: "Glenn Lazarus Team", AV: "Australia’s Voice", REAS: "Reason", CDP: "Christian Democrats", CSA: "Community Strong", RUA: "Rise Up Australia", SEP: "Socialist Equality", DLP: "Democratic Labour", FACN: "Fraser Anning’s Conservative Nationals", NGST: "No GST", SPA: "Secular Party", AFN: "Australia First", BTA: "Bullet Train for Australia" };
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
// DM's order is POSITIONAL against the booth demo cell tuple, so the two
// income share lanes keep their slots here; the menu folds them into one
// entry via DM_MENU below
const DM = ["lang", "a65", "a2034", "fborn", "uni", "blue", "loinc", "hiinc", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "hl"];
// the Household-income lens lane id: its block sits below with the other
// select lenses — declared early because the menu fold needs it
const LENS_INC = "inc";
// the Age lens lane id, beside its sibling merge — also menu-folded
const LENS_AGE = "age";
// the menu's People list: DM in order, the two income shares folded into
// the Household-income entry where loinc sat, the two age-band reads
// folded into the Age entry where a65 sat
const DM_MENU = (() => { const ks = []; for (const k of DM) { if (k === "a65") { ks.push(LENS_AGE); continue; } if (k === "a2034") continue; if (k === "loinc") { ks.push(LENS_INC); continue; } if (k !== "hiinc") ks.push(k); } return ks; })();
const DM_NAME = { lang: "Language other than English at home", a65: "Aged 65 and over", a2034: "Aged 20 to 34", age: "Age", fborn: "Born overseas", uni: "University educated", blue: "Blue-collar workers", inc: "Household income", loinc: "Adults in lower-income households", hiinc: "Adults in high-income households", y12less: "Year 12 or less", atsci: "Indigenous Australians", u15: "Children under 15", onepar: "One-parent families", pt: "Public transport to work", noncit: "Non-citizens", bigfam: "More than two children", hl: "Homeless" };
const DM_SHORT = { lang: "Other language", a65: "Aged 65+", a2034: "Aged 20–34", age: "Age", fborn: "Born overseas", uni: "University", blue: "Blue collar", inc: "Income", loinc: "Lower income", hiinc: "Higher income", y12less: "No Year 12", atsci: "Indigenous", u15: "Under 15", onepar: "One-parent", pt: "Public transport", noncit: "Non-citizens", bigfam: "3+ children", hl: "Homeless" };
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
const isDemo = () => DM.includes(S.index) || S.index === LENS_INC || S.index === LENS_AGE || S.index === LENS_REL || S.index === LENS_TEN || S.index === LENS_ANC;
// the Household-income lane: S.index === "inc" and S.incMode the picked
// measure — the median weekly household income spectrum lands by default;
// the bottom-cut and $4,000+ shares (loinc/hiinc as their own menu lanes
// until 2026-10-31) ride the same legend picker as the other views. The
// shares name their own definitions: the year's national weekly cut in
// the census year's dollars, as each year's incomeCuts record carries
// them (2013 reads 2011 dollars, 2016 on 2021 dollars)
const INC_MODES = ["med", "lo", "hi"];
const INC_NAME = { med: "Median household income", lo: "Adults in lower-income households", hi: "Adults in high-income households" };
const INC_SHORT = { med: "Median income", lo: "Lower income", hi: "Higher income" };
const INC_RANGE = { lo: [10, 45], hi: [0, 50] };
const INC_TOP = { med: ["seats where households earn the most", "where they earn the least"], lo: ["seats where the most adults live in lower-income households", "with the fewest"], hi: ["seats where the most adults live in high-income households", "with the fewest"] };
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
const incEpoch = (m) => (m.demoInterp ? " in census-year dollars" : incDollars(m));
const INC_VERB = {
  lo: (m) => `live in households earning ${incLoFrag(m)}${incEpoch(m)}`,
  hi: (m) => `live in households earning ${mny(m.incomeCuts && m.incomeCuts.hiEdgeWeekly)} or more a week${incEpoch(m)}`,
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
const dmVerb = (m, k) => (k === LENS_REL ? RELISMS[S.rel] : k === LENS_TEN ? TENESMS[S.ten] : k === LENS_ANC ? ANCISMS[S.anc] : k === "fborn" && S.cob != null ? COB_VERB[S.cob] : k === LENS_INC ? (INC_VERB[S.incMode] ? INC_VERB[S.incMode](m) : "") : k === LENS_AGE ? (AGE_VERB[S.ageMode] || "") : DM_VERB[k]);
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
const INC_KEY = { med: "medIncWeekly", lo: "loinc", hi: "hiinc" };
const demoShare = (d) => {
  if (isCob()) return d.demo && d.demo.cob ? d.demo.cob[S.cob] : null;
  if (isRel()) return d.demo && d.demo.rel ? d.demo.rel[S.rel] : null;
  if (isTen()) return d.demo && d.demo.ten ? d.demo.ten[S.ten] : null;
  if (isAnc()) return d.demo && d.demo.anc ? d.demo.anc[S.anc] : null;
  if (isInc()) return d.demo ? d.demo[INC_KEY[S.incMode]] : null;
  // age: median is years (ageMed); the five share views ride their keys
  if (isAge()) return d.demo ? d.demo[AGE_KEY[S.ageMode]] : null;
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
  return demo ? demo[S.index] : null;
};
// ...and of one booth row (fraction): the select lanes ride their
// parallel B rows (cob/rel/ten), positional in the year's key orders
const demoBoothShare = (raw, j, pos) => {
  if (isCob()) { const r = raw.cob && raw.cob[j]; return r ? r[pos[S.cob]] : null; }
  if (isRel()) { const r = raw.rel && raw.rel[j]; return r ? r[pos[S.rel]] : null; }
  if (isTen()) { const r = raw.ten && raw.ten[j]; return r ? r[pos[S.ten]] : null; }
  if (isAnc()) { const r = raw.anc && raw.anc[j]; return r ? r[pos[S.anc]] : null; }
  // income: the share views ride the demo tuple's cells 6/7; the median
  // is dollars, dollars never a share — boothValue reads raw.medinc
  if (isInc()) { const r = raw.demo && raw.demo[j]; return r && S.incMode !== "med" ? r[S.incMode === "lo" ? 6 : 7] : null; }
  // age: a65/a2034 stay at the demo tuple's cells 1/2 like every GCP lane
  if (isAge()) {
    if (S.ageMode === "med") return null; // median is years: boothValue reads raw.ageMed
    if (S.ageMode === "a65" || S.ageMode === "a2034") { const r = raw.demo && raw.demo[j]; return r ? r[S.ageMode === "a65" ? 1 : 2] : null; }
    const lane = raw[AGE_KEY[S.ageMode]]; return lane ? lane[j] : null;
  }
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
const demoRange = () => (isCob() ? COB_RANGE[S.cob] : isRel() ? REL_RANGE[S.rel] : isTen() ? TEN_RANGE[S.ten] : isAnc() ? ANC_RANGE[S.anc] : isInc() ? (S.incMode === "med" ? incMedRange(M()) : INC_RANGE[S.incMode]) : isAge() ? (S.ageMode === "med" ? ageMedRange(M()) : AGE_RANGE[S.ageMode]) : DM_RANGE[S.index]);
const demoRamp = () => RAMP.demo[isCob() ? "fborn" : isRel() ? "rel" : isTen() ? "ten" : isAnc() ? "anc" : isInc() ? (S.incMode === "med" ? "incmed" : S.incMode === "lo" ? "loinc" : "hiinc") : isAge() ? (S.ageMode === "med" ? "agemed" : S.ageMode) : S.index];
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
const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, "qld17", 2019, "qld20", "nsw23", "sa22", 2022, "vic22", "qld24", 2025, "sa26", "now"];
// qld17/qld20/qld24: the 2017 (25 November), 2020 (31 October) and 2024
// (26 October) Queensland state elections alongside nsw23/sa22/vic22/sa26 —
// non-federal stops, drawn on their own timeline row at their
// date rather than a whole year in, named "Qld" + the year
const SA_YEARS = new Set(["sa22", "sa26"]);
const NSW_YEARS = new Set(["nsw23"]);
const VIC_YEARS = new Set(["vic22"]);
const QLD_YEARS = new Set(["qld17", "qld20", "qld24"]);
const YEAR_JUR = { sa22: "sa", sa26: "sa", nsw23: "nsw", vic22: "vic", qld17: "qld", qld20: "qld", qld24: "qld" };
const STATE_YEARS = new Set(Object.keys(YEAR_JUR));
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
// each stop's spot on the timeline's date line (year + day-of-year/365)
const YEAR_X = { 1993: 1993.195, 1998: 1998.753, 1996: 1996.169, 2001: 2001.861, 2004: 2004.772, 2007: 2007.896, 2010: 2010.638, 2013: 2013.68, 2016: 2016.499, 2019: 2019.377, 2022: 2022.386, 2025: 2025.378, sa22: 2022.213, sa26: 2026.216, nsw23: 2023.23, vic22: 2022.901, qld17: 2017.901, qld20: 2020.833, qld24: 2024.82, now: 2026.8 };
// the calendar year a non-year word's results belong to ("sa22" elects in 2022)
const FRAME_YEAR = { now: 2026, sa22: 2022, sa26: 2026, nsw23: 2023, vic22: 2022, qld17: 2017, qld20: 2020, qld24: 2024 };
// a state frame's history spot: the previous election's date on its line;
// Queensland's 2015 (31 January) precedes the row's three stops
const STATE_PREV_X = { sa: 2018.205, nsw: 2019.222, vic: 2018.901, qld: 2015.086 };
const SA_PREV_X = { 2018: STATE_PREV_X.sa };
const NSW_PREV_X = { 2019: STATE_PREV_X.nsw };
const VIC_PREV_X = { 2018: STATE_PREV_X.vic };
const QLD_PREV_X = { 2015: STATE_PREV_X.qld };
// the election each state frame names as its "previous election" (its date rides
// STATE_PREV_X on the timelines): South Australia's 2018, New South Wales' 2019,
// Victoria's 2018 — and Queensland's stops prev-chain 2017→2020→2024, the 2017
// frame naming nothing (the 2015 election was fought on the 89-district map)
const PREV_YEAR = { sa22: 2018, sa26: 2022, nsw23: 2019, vic22: 2018, qld24: 2020, qld20: 2017, qld17: null };
const Y2_ST_CAP = { SA: "South Australia", NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland" };
const stOfYear = (y) => (YEAR_JUR[y] || "").toUpperCase();
// a state frame's state in sentence words ("New South Wales" wherever "SA" would do)
const stNameCap = (y) => Y2_ST_CAP[stOfYear(y)] || "";
const prevXOf = (y) => STATE_PREV_X[YEAR_JUR[y]] ?? y - 1;
const prevNameOf = (y) => { const p = PREV_YEAR[y]; return p == null ? stOfYear(y).toUpperCase() : `${stOfYear(y).toUpperCase()} ${String(p).slice(2)}`; };
const prevXLabOf = (y) => { const p = PREV_YEAR[y]; return p == null ? stOfYear(y).toUpperCase() : `${stOfYear(y).toUpperCase()}’${String(p).slice(2)}`; };
const GOV = { 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp", 2018: "lnp", sa22: "alp", sa26: "alp", nsw23: "alp", vic22: "alp", qld17: "alp", qld20: "alp", qld24: "lnp", now: "alp" }; // 2018 is SA's (Marshall's Liberals), the sa22 frame's prev
// another state's 2018 prev-government collides with SA's key above: Victoria
// 2018 was Labor (Andrews won it), so the winner a vic22 frame is gauged
// against comes from this corridor, not GOV[2018]. Queensland's stop years
// collide with nothing, but its PREV consecutive-year keys (2017/2020) are
// likewise carried here, not in GOV's federal-year corridor
const PREV_GOV_BY_JUR = { vic: { 2018: "alp" }, qld: { 2017: "alp", 2020: "alp" } };
const PM = { 1993: "Paul Keating", 1998: "John Howard", 2001: "John Howard", 1996: "John Howard", 2004: "John Howard", 2007: "Kevin Rudd", 2010: "Julia Gillard", 2013: "Tony Abbott", 2016: "Malcolm Turnbull", 2019: "Scott Morrison", 2022: "Anthony Albanese", 2025: "Anthony Albanese", sa22: "Peter Malinauskas", sa26: "Peter Malinauskas", nsw23: "Chris Minns", vic22: "Daniel Andrews", qld17: "Annastacia Palaszczuk", qld20: "Annastacia Palaszczuk", qld24: "David Crisafulli", now: "Anthony Albanese" };
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
const yearLane = (y) => (SA_YEARS.has(y) ? YEARS_SA : VIC_YEARS.has(y) ? YEARS_VIC : NSW_YEARS.has(y) ? YEARS_NSW : QLD_YEARS.has(y) ? YEARS_QLD : YEARS_FED);
function walkYear(dir, wrap) { const lane = yearLane(S.year); const k = lane.indexOf(S.year) + dir, y = lane[wrap ? (k + lane.length) % lane.length : k]; if (y != null) setYear(y); }
// the up/down-arrows row walk: the timeline's rows top to bottom, in
// renderTimeline's `rows` order (Vic above NSW since 2026-10-28, Queensland's
// row appended below), walking
// round the ends; a row holds the stop it was left on (setYear keeps the
// memory), its newest stop until then
const LANES = [YEARS_FED, YEARS_VIC, YEARS_NSW, YEARS_SA, YEARS_QLD];
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
  year: "now", lens: "winner", party: "onp", from: "onp", vs: "lnp", index: "irsad", tppMode: "share", fpMode: "share",
  // the informal lens's exhausted-ballot view (New South Wales' optional-preferential count)
  infMode: "informal",
  // the Household-income lens's measure: the median spectrum, or the lower- /
  // higher-income household shares (an INC_MODES value; median lands)
  incMode: "med",
  // the Age lens's measure: the median-age spectrum, or one of the share
  // views (an AGE_MODES value; median lands)
  ageMode: "med",
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
};
/* the census-index lanes' scoring basis rides the frame, never a picker: the
   2016+ frames carry the votes-by-SA1 footprint (voter), the earlier ones only
   the census areas the places stand in — one basis per year, the same
   treatment the People lanes get */
const seifaBasis = (m) => (m && m.demoBasis === "voter" ? "voters" : "venue");
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
// the page's inline warmup (map/index.html, ahead of map.js) starts the landing year's fetches
// while the script downloads and parses; getJSON drinks from it once, then it's gone
const getJSON = (u) => {
  const w = window.__warm && window.__warm[u];
  if (w) { delete window.__warm[u]; return w.catch(() => getJSON(u)); }
  const v = DATA_V[u.slice(u.lastIndexOf("/") + 1)]; return fetch(v ? `${u}?v=${v}` : u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
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
    // the lens-level exhausted share is counted off the divisions' own flow rows
    const exd = idx.map((i) => m.divs[i]).filter((d) => d.exhPct != null);
    const exhPct = exd.length ? (100 * sum(exd.map((d) => (d.exhPct / 100) * d.formal))) / sum(exd.map((d) => d.formal)) : null;
    out[st] = { st, fp, fpSw, tpp: (100 * a.tpp[0]) / (a.tpp[0] + a.tpp[1]), tppSw: a.tpp[2], infPct: (100 * a.inf) / (a.inf + a.formal), exhPct, idx, formal: a.formal, demo };
  }
  return out;
}

// Handbook files retain the original coordinates. Apply D3 winding and
// linear-coordinate resampling only while drawing; the source is unchanged.
// The main viewport uses mainland parts; external islands have their insets.
function handbookFeature(f) {
  const ps = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  f.geometry = { type: "MultiPolygon", coordinates: ps.filter(p => p[0].some(([x,y]) => x >= 112 && x <= 154.5 && y >= -44.5 && y <= -9)).map(p => p.map((ring, ri) => {
    const r = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i+1], n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / .05));
      for (let j = 0; j < n; j++) r.push([a[0]+(b[0]-a[0])*j/n, a[1]+(b[1]-a[1])*j/n]);
    }
    r.push(r[0]);
    if ((d3.geoArea({type:"Polygon", coordinates:[r]}) > 2*Math.PI) === (ri === 0)) r.reverse();
    return r;
  })) };
  return f;
}
function handbookDisplay(fc) {
  for (const f of fc.features) handbookFeature(f);
  return fc;
}
function buildGeo(topo, m) {
  const raw = topojson.feature(topo, topo.objects.divs);
  const fc = topo.handbook ? handbookDisplay(raw) : raw;
  const gen = d3.geoPath(proj);
  const paths = new Array(m.divs.length), bb = new Array(m.divs.length), feats = new Array(m.divs.length);
  for (const f of fc.features) {
    const i = m.byName.get(f.properties.name);
    if (i == null) continue;
    const p = new Path2D(); d3.geoPath(proj, p)(f); paths[i] = p;
    bb[i] = gen.bounds(f); feats[i] = f;
  }
  const P = proj, mk = (g) => { const p = new Path2D(); d3.geoPath(P, p)(g); return p; };
  // each seat's polygons on the plane, flat [x0, y0, x1, y1, ...] rings (the closing point
  // dropped), made when a change of election first morphs them (the year morph, app-2)
  const polyP = [];
  const ringXY = (r) => { const o = new Float64Array(2 * (r.length - 1)); for (let k = 0; k < r.length - 1; k++) { const q = P(r[k]); o[2 * k] = q[0]; o[2 * k + 1] = q[1]; } return o; };
  const polys = (i) => {
    if (polyP[i] || !feats[i]) return polyP[i] || null;
    const gm = feats[i].geometry, cs = gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates;
    return (polyP[i] = cs.map((pg) => ({ outer: ringXY(pg[0]), holes: pg.slice(1).map(ringXY) })));
  };
  const o = topo.objects.divs, at = (g) => m.byName.get(g.properties.name);
  // each seat's coast and its borders with other seats, apart, made when the
  // streets first need them (the streets' own sea draws the coast there)
  const coastP = [], edgeP = [];
  return {
    paths, bb, polys,
    // the topology itself and a geometry's seat, for the seats' waters (app-2)
    topo, at, proj: P,
    meshDiv: topo.handbook ? mk({type:"MultiLineString", coordinates:fc.features.flatMap(f=>f.geometry.coordinates.flat())}) : mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st === b.properties.st)),
    meshState: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)),
    coast: topo.handbook ? mk({type:"MultiLineString", coordinates:fc.features.flatMap(f=>f.geometry.coordinates.flat())}) : mk(topojson.mesh(topo, o, (a, b) => a === b)),
    coastOf: (i) => coastP[i] || (coastP[i] = mk(topo.handbook ? {type:"MultiLineString", coordinates:feats[i].geometry.coordinates.flat()} : topojson.mesh(topo, o, (a, b) => a === b && at(a) === i))),
    edgeOf: (i) => edgeP[i] || (edgeP[i] = mk(topo.handbook ? {type:"MultiLineString", coordinates:feats[i].geometry.coordinates.flat()} : topojson.mesh(topo, o, (a, b) => a !== b && (at(a) === i || at(b) === i)))),
  };
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
  proj = m.proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], { type: "MultiPoint", coordinates: [[x0, y0], [x1, y1]] });
  // pass two: each seat resampled-and-wound (handbookFeature), then pathed — a
  // stream context that writes the Path2D and takes the bounds in one emission
  const P = proj;
  const paths = new Array(m.divs.length), bb = new Array(m.divs.length), featsByDiv = new Array(m.divs.length);
  const outline = new Path2D();
  const pathAndBounds = (f) => {
    const p = new Path2D();
    let b0 = Infinity, b1 = Infinity, b2 = -Infinity, b3 = -Infinity;
    const ctx = { beginPath() {}, result() {}, arc() {},
      moveTo(x, y) { p.moveTo(x, y); if (x < b0) b0 = x; if (x > b2) b2 = x; if (y < b1) b1 = y; if (y > b3) b3 = y; },
      lineTo(x, y) { p.lineTo(x, y); if (x < b0) b0 = x; if (x > b2) b2 = x; if (y < b1) b1 = y; if (y > b3) b3 = y; },
      closePath() { p.closePath(); } };
    d3.geoPath(P, ctx)(f);
    return [p, [[b0, b1], [b2, b3]]];
  };
  for (const f of feats) {
    const i = m.byName.get(f.properties.name);
    handbookFeature(f);
    const [p, b] = pathAndBounds(f);
    outline.addPath(p);
    if (i != null) { featsByDiv[i] = f; paths[i] = p; bb[i] = b; }
    if (sliceDone()) await pause();
  }
  const mk = (g) => { const p = new Path2D(); d3.geoPath(P, p)(g); return p; };
  const polyP = [];
  const ringXY = (r) => { const o = new Float64Array(2 * (r.length - 1)); for (let k = 0; k < r.length - 1; k++) { const q = P(r[k]); o[2 * k] = q[0]; o[2 * k + 1] = q[1]; } return o; };
  const polys = (i) => {
    if (polyP[i] || !featsByDiv[i]) return polyP[i] || null;
    const gm = featsByDiv[i].geometry, cs = gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates;
    return (polyP[i] = cs.map((pg) => ({ outer: ringXY(pg[0]), holes: pg.slice(1).map(ringXY) })));
  };
  const at = (g) => m.byName.get(g.properties.name);
  const coastP = [], edgeP = [];
  if (sliceDone()) await pause();
  return {
    paths, bb, polys, topo, at, proj: P,
    meshDiv: outline,
    meshState: mk(topojson.mesh(topo, o, (a, b) => a !== b && a.properties.st !== b.properties.st)),
    coast: outline,
    coastOf: (i) => coastP[i] || (coastP[i] = mk({type:"MultiLineString", coordinates:featsByDiv[i].geometry.coordinates.flat()})),
    edgeOf: (i) => edgeP[i] || (edgeP[i] = mk({type:"MultiLineString", coordinates:featsByDiv[i].geometry.coordinates.flat()})),
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
const SPEAKER_DIV = { sa22: "Kavel", sa26: "Hurtle Vale", nsw23: "Lake Macquarie", vic22: "Bendigo West", qld17: "Mulgrave", qld20: "Mulgrave", qld24: "Condamine" };
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
    const fit = lo.handbook ? null : topojson.feature(lo, lo.objects.divs);
    if (!lo.handbook) proj = m.proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], fit);
    m.res = res;
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
      m.hasLane = Object.fromEntries(DM.map((k) => [k, k === "loinc" || k === "hiinc" ? hasInc({ incomeCuts: res.incomeCuts }) : any(k)]));
      m.hasLane[LENS_INC] = m.hasLane.loinc;
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
    m.booth = res.booths ? deriveBooths(res.booths, m) : emptyBooths(m);
    for (const s of m.isl) if (s.seat == null && s.booths.length) s.seat = m.booth.d[s.booths[0]];
    m.areas = deriveAreas(res, m);
    // the Handbook years' projection is only built inside their geometry
    // pass (a direct boot on a Handbook year arrives with proj === null);
    // projecting the label points has to wait for it
    for (const d of m.divs) { const p = proj(d.lp); d.lpx = p[0]; d.lpy = p[1]; }
    // the national household median joins the AUS pool: medians never
    // pool, so deriveAreas leaves it off, but the incomeCuts record the
    // build stamps carries the year's own national figure
    if (m.incomeCuts && m.incomeCuts.medWeekly != null && m.areas.AUS.demo)
      m.areas.AUS.demo.medIncWeekly = m.incomeCuts.medWeekly;
    // the national median age likewise, beside the incomeCut one
    if (m.ageCuts && m.ageCuts.medAge != null && m.areas.AUS.demo)
      m.areas.AUS.demo.ageMed = m.ageCuts.medAge;
    m.search = buildSearch(m);
    proj = keep || m.proj;
    // the hi detail comes up only for a frame the reader actually visits (warmHi):
    // preloading paths +15 frames and building all their hi Path2Ds was the 2026-10
    // long-task storm. The Handbook years are lossless at both levels: no hi download
    if (lo.handbook) m.geoHi = m.geo;
    return m;
  })();
  return m.ready;
}
/* a frame's hi geometry, fetched the first time it's shown and built in an idle
   slice after it lands, so the year-morph it interrupts nothing interactive.
   geoOf (app-2) draws lo at any zoom until it lands, so a miss just keeps the
   lo edges a little longer — the same shape boot already tolerates */
function warmHi(y) {
  const m = Y[y];
  if (!m || !m.divs || m.geoHi || m._hiP) return m && m._hiP;
  const ry = y === "now" ? 2025 : y;
  // the hi detail can land after the reader has moved to another year — build
  // and bake its paths under this year's projection, then put the live one back
  m._hiP = getJSON(`/map/data/geo-${ry}-hi.json`)
    .then((hi) => new Promise((done) => (window.requestIdleCallback ? requestIdleCallback : setTimeout)(() => { const keep = proj; proj = m.proj; m.geoHi = buildGeo(hi, m); proj = keep; schedule(); done(); }, { timeout: 1500 })))
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
