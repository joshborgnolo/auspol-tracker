#!/usr/bin/env node
/* /vic/ page generator.
 *
 * Reads data/vic-polls.json (the audited Victorian poll file assembled
 * by .build/vic-watch.mjs), validates every row fail-hard, computes the
 * headline estimates and trend curves, and renders vic/index.html — a
 * GENERATED file, never hand-edited (the refresh-prediction.mjs pattern:
 * numbers composed here, the page a dumb renderer; static SVG, no page JS).
 * Landing path per wave: this script, then
 *   bash .build/git-push-main.sh "<msg>" data/vic-polls.json vic/index.html
 * (vic/index.html rides its own file list, never shared SITE_FILES).
 *
 * Estimate design (locked 2026-10-03): two-party preferred is a weighted
 * blend of PUBLISHED 2PP figures only — Victoria has no usable One Nation
 * preference-flow baseline (ONP barely contested the 2022 lower house), so
 * a flows-derived 2PP would be invented precision. Primaries aggregate
 * ALP/LNP/ONP/GRN/OTH(=IND+other combined) directly. House effects are NOT
 * adjusted. Weights: w = n · 2^(−d/HALF_LIFE), at most MAX_WAVES waves per
 * house, headline over the trailing HEAD_TRAIL days of fieldwork ends
 * (widened in 15-day steps until MIN_HEAD_POLLS bear a published 2PP);
 * trend curves re-run the same blend on a 14-day grid with TREND_TRAIL.
 *
 * Off-ramp: after the 28 November 2026 election, freeze rows, run once with
 * --as-of=2026-11-29, and the page joins the archives family.
 *
 * Usage: node .build/refresh-vic.mjs [--as-of=YYYY-MM-DD] [--dry]
 * Prints a final VIC_STATUS {...} line.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyShell, shellOptsFor } from "./site-shell.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const ELECTION_DATE = "2026-11-28";       // Victorian state election (fixed date)
const ELEC_TPP_2022 = 55.0;               // ALP 2PP at the 2022 election (VEC)
// 2022 election certified statewide primaries (VEC final count incl. the
// Narracan supplementary, the count whose 2PP is the 55.0 above):
// ALP 36.66, Liberal+National 34.48, Greens 11.50, One Nation 0.28,
// the remaining minors and independents 17.08 between them
const ELEC_PRIM_2022 = { alp: 36.66, lnp: 34.48, onp: 0.28, grn: 11.50, oth: 17.08 };
const DATA_FILE = "data/vic-polls.json";
const PAGE = "vic/index.html";
const BUILD = ".build/newtracker/build.mjs";

// estimator constants (locked 2026-10-03; change here, never per-run)
const HALF_LIFE = 28;        // recency half-life, days
const HEAD_TRAIL = 60;       // headline window: fieldwork ended within N days
const MIN_HEAD_POLLS = 3;    // widen the window until this many published 2PPs
const TREND_TRAIL = 120;     // trend-curve window (sparser data needs the reach)
const MAX_WAVES = 6;         // per house, inside any window
const SAMPLE_DEFAULT = 1000; // weight for a wave with no published n

// ---------- Sydney-date helpers (as refresh-prediction.mjs) ---------------
const DAY = 864e5;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayMs = (d) => Date.parse(d + "T00:00:00Z");
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / DAY);
const addDays = (d, n) => { const t = new Date(dayMs(d) + n * DAY); return t.toISOString().slice(0, 10); };
const dateLabel = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS[m - 1]} ${y}`; };
const dateShort = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS[m - 1].slice(0, 3)} ${y}`; };
const MY = (d) => { const [y, m] = d.split("-").map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`; };

// ---------- CLI ------------------------------------------------------------
const argv = process.argv.slice(2);
const FLAG = (n) => argv.includes("--" + n);
const ARGV = (n) => { const a = argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : null; };
const asOf = /^\d{4}-\d{2}-\d{2}$/.test(ARGV("as-of") || "") ? ARGV("as-of") : sydneyToday();
const dry = FLAG("dry");

// ---------- load + validate (fail-hard: a bad row stops the page) ---------
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const inPct = (v) => isNum(v) && v >= 0 && v <= 100;
const errors = [];
let data;
try { data = JSON.parse(readFileSync(path.join(REPO, DATA_FILE), "utf8")); }
catch (e) { console.error(`VIC_STATUS ${JSON.stringify({ ran: false, error: `cannot read ${DATA_FILE}: ${e.message}` })}`); process.exit(1); }

const polls = Array.isArray(data.polls) ? data.polls : [];
const threeParty = Array.isArray(data.threeParty) ? data.threeParty : [];
const leadership = Array.isArray(data.leadership) ? data.leadership : [];
if (!Array.isArray(data.polls) || !Array.isArray(data.threeParty) || !Array.isArray(data.leadership))
  errors.push("data file needs polls[], threeParty[] and leadership[] arrays");

const seenWave = new Set();
for (const [i, p] of polls.entries()) {
  const at = `polls[${i}] ${p.firm || "?"} ${p.fwEnd || "?"}`;
  if (typeof p.firm !== "string" || !p.firm) errors.push(`${at}: firm`);
  if (!ISO.test(p.fwStart || "") || !ISO.test(p.fwEnd || "") || p.fwStart > p.fwEnd) errors.push(`${at}: fieldwork dates`);
  for (const k of ["alp", "lnp", "grn"]) if (!inPct(p.primary?.[k])) errors.push(`${at}: primary.${k}`);
  for (const k of ["onp", "ind", "oth"]) if (p.primary?.[k] != null && !inPct(p.primary[k])) errors.push(`${at}: primary.${k}`);
  if (p.primary?.ind == null && p.primary?.oth == null) errors.push(`${at}: ind and oth both null (no Others figure)`);
  const sum = ["alp", "lnp", "grn", "onp", "ind", "oth"].reduce((s, k) => s + (p.primary?.[k] ?? 0), 0);
  if (sum < 97 || sum > 103) errors.push(`${at}: primary sum ${sum.toFixed(1)} outside 97–103`);
  if (p.tpp2 != null && !(isNum(p.tpp2.alp) && p.tpp2.alp >= 25 && p.tpp2.alp <= 75)) errors.push(`${at}: tpp2.alp`);
  if (p.sample != null && !(Number.isInteger(p.sample) && p.sample > 0)) errors.push(`${at}: sample`);
  if (!Array.isArray(p.provenance) || !p.provenance.length) errors.push(`${at}: provenance`);
  const key = `${p.firm}|${p.fwEnd}`;
  if (seenWave.has(key)) errors.push(`${at}: duplicate firm|fwEnd`);
  seenWave.add(key);
}
for (const [i, t] of threeParty.entries()) {
  const at = `threeParty[${i}] ${t.firm || "?"} ${t.fwEnd || "?"}`;
  if (!ISO.test(t.fwEnd || "")) errors.push(`${at}: fwEnd`);
  for (const k of ["alp", "lnp", "onp"]) if (!inPct(t[k])) errors.push(`${at}: ${k}`);
}
const PAIR_RE = /^[a-z]+-vs-[a-z]+(-vs-[a-z]+)?$/;
const LEADERS = new Set();
for (const [i, l] of leadership.entries()) {
  const at = `leadership[${i}] ${l.firm || "?"} ${l.date || "?"}`;
  if (l.series !== "preferredPremier" && l.series !== "approval") errors.push(`${at}: series`);
  if (!ISO.test(l.date || "")) errors.push(`${at}: date`);
  if (!PAIR_RE.test(l.pair || "")) errors.push(`${at}: pair`);
  else l.pair.split("-vs-").forEach((k) => LEADERS.add(k));
  if (l.series === "preferredPremier") {
    // a null leader value is legitimate: the house fielded the pair era but left
    // that leader out (e.g. RedBridge 2026-08-04 published Pickering as {{N/A}})
    const vals = Object.values(l.values || {}).filter((v) => v != null);
    if (!vals.length || vals.some((v) => !inPct(v))) errors.push(`${at}: ppm values`);
    else {
      const sum = vals.reduce((a, b) => a + b, 0) + (l.dk ?? 0);
      if (sum < 95 || sum > 103) errors.push(`${at}: ppm values + dk sum ${sum.toFixed(1)} outside 95–103`);
    }
  } else {
    if (typeof l.leader !== "string" || !l.leader) errors.push(`${at}: leader`);
    if (!isNum(l.net) || l.net < -100 || l.net > 100) errors.push(`${at}: net`);
    if (l.pos != null && l.neg != null && isNum(l.net) && Math.abs(l.net - (l.pos - l.neg)) > 1.6)
      errors.push(`${at}: net ${l.net} ≠ pos−neg ${(l.pos - l.neg).toFixed(1)}`);
  }
  if (l.leader) LEADERS.add(l.leader);
}
if (errors.length) {
  for (const e of errors) console.error(`  invalid: ${e}`);
  console.error(`VIC_STATUS ${JSON.stringify({ ran: false, error: `${errors.length} invalid rows`, dry })}`);
  process.exit(1);
}

// ---------- the blend -------------------------------------------------------
const sorted = [...polls].sort((a, b) => a.fwEnd.localeCompare(b.fwEnd));
const weightAt = (p, t) => (p.sample || SAMPLE_DEFAULT) * Math.pow(2, -daysBetween(p.fwEnd, t) / HALF_LIFE);
const capPerHouse = (rows) => {
  const byFirm = new Map();
  for (const r of rows) {
    const a = byFirm.get(r.firm) || [];
    if (a.length < MAX_WAVES) { a.push(r); byFirm.set(r.firm, a); }
  }
  return [...byFirm.values()].flat();
};
const windowRows = (t, trail, rows = sorted) => rows.filter((p) => p.fwEnd <= t && daysBetween(p.fwEnd, t) <= trail);
const blendAt = (rows, t, valOf) => {
  let sw = 0, sv = 0;
  for (const r of capPerHouse([...rows].sort((a, b) => b.fwEnd.localeCompare(a.fwEnd)))) {
    const v = valOf(r);
    if (v == null) continue;
    const w = weightAt(r, t);
    sw += w; sv += w * v;
  }
  return sw ? +(sv / sw).toFixed(2) : null;
};

// headline: window widens until enough published 2PPs land inside
let headWindow = HEAD_TRAIL, headRows = windowRows(asOf, headWindow);
const tppOf = (p) => (p.tpp2 && p.tpp2.alp != null ? p.tpp2.alp : null);
while (headRows.filter((p) => tppOf(p) != null).length < MIN_HEAD_POLLS && headWindow < 180) {
  headWindow += 15;
  headRows = windowRows(asOf, headWindow);
}
const othOf = (p) => (p.primary.ind == null ? p.primary.oth : (p.primary.ind || 0) + (p.primary.oth || 0));
const head = {
  alp2pp: blendAt(headRows, asOf, tppOf),
  n2pp: headRows.filter((p) => tppOf(p) != null).length,
  span: headRows.filter((p) => tppOf(p) != null).map(tppOf),
  prim: {
    alp: blendAt(headRows, asOf, (p) => p.primary.alp),
    lnp: blendAt(headRows, asOf, (p) => p.primary.lnp),
    onp: blendAt(headRows, asOf, (p) => p.primary.onp),
    grn: blendAt(headRows, asOf, (p) => p.primary.grn),
    oth: blendAt(headRows, asOf, othOf),
  },
  nPolls: headRows.length,
  from: headRows.length ? headRows.reduce((a, p) => (p.fwEnd < a ? p.fwEnd : a), "9999") : null,
  firms: [...new Set(headRows.map((p) => p.firm))],
};
head.lnp2pp = head.alp2pp != null ? +(100 - head.alp2pp).toFixed(2) : null;

// trend curves: 14-day grid from first fieldwork end to asOf
const evalDates = [];
for (let t = sorted[0].fwEnd; t <= asOf; t = addDays(t, 14)) evalDates.push(t);
if (evalDates[evalDates.length - 1] !== asOf) evalDates.push(asOf);
const trendPts = (valOf) => evalDates.map((t) => {
  const v = blendAt(windowRows(t, TREND_TRAIL), t, valOf);
  return v == null ? null : { t, v };
});
const trend = {
  tpp: trendPts(tppOf),
  alp: trendPts((p) => p.primary.alp),
  lnp: trendPts((p) => p.primary.lnp),
  onp: trendPts((p) => p.primary.onp),
  grn: trendPts((p) => p.primary.grn),
  oth: trendPts(othOf),
};

// ---------- display constants ----------------------------------------------
const FIRM_CSS = {
  "resolve": "--f-resolve", "roymorgan": "--f-roymorgan", "redbridge-accent": "--f-redb",
  "wolf-smith": "--f-wolfsmith", "demosau": "--f-demosau", "newspoll": "--f-newspoll",
  "freshwater": "--f-freshwater", "yougov-mrp": "--f-yougov", "jws-research": "--f-jws",
};
const firmLabel = {};
for (const p of polls) firmLabel[p.firm] = p.firmRaw;
firmLabel["jws-research"] ||= "JWS Research";
const NAMES = { andrews: "Andrews", allan: "Allan", carroll: "Carroll", pesutto: "Pesutto", battin: "Battin", wilson: "Wilson", pickering: "Pickering" };
const fmt = (v) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));
const MINUS = "−";
const snet = (v) => (v < 0 ? MINUS : v > 0 ? "+" : "") + fmt(Math.abs(v));
const joinL = (xs) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + (xs.length > 2 ? ", and " : " and ") + xs[xs.length - 1];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// the fieldwork column renders ONE condensed label derived from the validated
// ISO span — the source dateLabel texts are free-form mixed styles
// ("16 Jun - 10 July", "12–16 Jan& 8–14 Feb", month names spelt out) against
// the main page's condensed en-dash convention ("24–29 Sep")
const MON3 = (d) => MONTHS[+d.slice(5, 7) - 1].slice(0, 3);
const fwLabel = (p) => {
  const y1 = p.fwStart.slice(0, 4), y2 = p.fwEnd.slice(0, 4);
  if (p.approxDate) {
    // only the month(s) are on record — never derive day precision
    const a = `${MON3(p.fwStart)} ${y1}`, b = `${MON3(p.fwEnd)} ${y2}`;
    if (a === b) return a;
    return y1 === y2 ? `${a.slice(0, 3)}–${b}` : `${a}–${b}`;
  }
  const m1 = p.fwStart.slice(5, 7), m2 = p.fwEnd.slice(5, 7);
  const dA = +p.fwStart.slice(8, 10), dB = +p.fwEnd.slice(8, 10);
  if (p.fwStart === p.fwEnd) return `${dB} ${MON3(p.fwEnd)} ${y2}`;
  if (y1 === y2 && m1 === m2) return `${dA}–${dB} ${MON3(p.fwEnd)} ${y2}`;
  if (y1 === y2) return `${dA} ${MON3(p.fwStart)}–${dB} ${MON3(p.fwEnd)} ${y2}`;
  return `${dA} ${MON3(p.fwStart)} ${y1}–${dB} ${MON3(p.fwEnd)} ${y2}`;
};
const enDashRange = (s) => s.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
// wave-dot hover telemetry: firm, fieldwork span ("fieldwork to" for a
// one-day wave), the plotted value, and the published sample as (n …)
const fwTitle = (p) => (p.fwStart < p.fwEnd ? fwLabel(p) : `fieldwork to ${dateShort(p.fwEnd)}`);
const nTitle = (nVal) => (nVal ? ` (n ${nVal.toLocaleString("en-AU")})` : "");
const pollDotTitle = (p, what) => `${firmLabel[p.firm] || p.firm}, ${fwTitle(p)} — ${what}${nTitle(p.sample)}`;
const ldrSpan = (l) => (l.fwStart && l.fwStart < l.date ? fwLabel({ fwStart: l.fwStart, fwEnd: l.date }) : `fieldwork to ${dateShort(l.date)}`);
// per-series end-of-line value labels: each series's latest point carries
// its figure, dodged so neighbouring labels never collide
const endMarks = (fr, series, gap = 13) => {
  const lo = fr.MT + 9, hi = fr.H - fr.MB - 4;
  const arr = series.map((s) => ({ ...s, py: fr.Y(s.v) })).sort((a, b) => a.py - b.py);
  const ys = arr.map((s) => Math.min(hi, Math.max(lo, s.py)));
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < gap) ys[i] = ys[i - 1] + gap;
  const over = ys[ys.length - 1] - hi;
  if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
  return arr.map((s, i) =>
    (s.dotFill ? `<circle cx="${s.x}" cy="${s.py}" r="${s.r ?? 2.5}" fill="${s.dotFill}">` +
      (s.dotTitle ? `<title>${esc(s.dotTitle)}</title>` : "") + `</circle>` : "") +
    `<text x="${s.x - 7}" y="${+(ys[i] + 3.5).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="${s.textFill}">${s.label ?? s.v.toFixed(1)}</text>`).join("");
};

// ---------- charts (static SVG — the refresh-prediction pattern) ---------
leadership.sort((a, b) => a.date.localeCompare(b.date));
const byT = (a, b) => a.t.localeCompare(b.t);

function frame({ W = 640, H = 260, ML = 34, MR = 14, MT = 12, MB = 26, yLo, yHi, tick, ref, xTickDates, electionY }) {
  const cw = W - ML - MR, ch = H - MT - MB;
  const x0 = dayMs(evalDates[0]), x1 = dayMs(ELECTION_DATE);
  const X = (d) => +(ML + ((dayMs(d) - x0) / (x1 - x0)) * cw).toFixed(1);
  const Y = (v) => +(MT + (1 - (v - yLo) / (yHi - yLo)) * ch).toFixed(1);
  let grid = "";
  for (let v = Math.ceil(yLo / tick) * tick; v <= yHi; v += tick) {
    const hot = ref != null && v === ref;
    const vLab = String(v).replace(/-/g, MINUS); // figure context uses U+2212 (net-satisfaction ticks go negative)
    grid += `<line x1="${ML}" y1="${Y(v)}" x2="${W - MR}" y2="${Y(v)}" stroke="${hot ? "var(--line)" : "var(--line-2)"}" stroke-width="1"${hot ? ' stroke-dasharray="3 3"' : ""}/>` +
      `<text x="${ML - 7}" y="${Y(v) + 3}" text-anchor="end" font-size="9.5" fill="var(--ink-faint)">${vLab}${v + tick > yHi ? "%" : ""}</text>`;
  }
  const xt = xTickDates.map(([d, label]) =>
    `<line x1="${X(d)}" y1="${H - MB}" x2="${X(d)}" y2="${H - MB + 4}" stroke="var(--line)" stroke-width="1"/>` +
    (label ? `<text x="${X(d)}" y="${H - 10}" text-anchor="middle" font-size="9.5" fill="var(--ink-faint)">${label}</text>` : "")).join("");
  const election = `<line x1="${X(ELECTION_DATE)}" y1="${MT}" x2="${X(ELECTION_DATE)}" y2="${H - MB}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>` +
    `<text x="${X(ELECTION_DATE) - 4}" y="${electionY ?? MT + 8}" text-anchor="end" font-size="9" fill="var(--ink-3)">Election, 28 Nov</text>`;
  return { W, H, ML, MR, MT, MB, X, Y, grid, xt, election };
}
// May/November ticks between the data start and the election
const xTicks = [];
{
  let y = +evalDates[0].slice(0, 4), m = +evalDates[0].slice(5, 7);
  let next = m <= 5 ? `${y}-05-01` : `${y}-11-01`;
  while (next <= addDays(ELECTION_DATE, -20)) {
    xTicks.push([next, MY(next)]);
    const [yy, mm] = next.split("-").map(Number);
    next = mm === 5 ? `${yy}-11-01` : `${yy + 1}-05-01`;
  }
}
const segsOf = (pts) => {
  const out = []; let cur = null;
  for (const p of pts) {
    if (p == null) { if (cur) out.push(cur), cur = null; continue; }
    (cur ||= []).push(p);
  }
  if (cur) out.push(cur);
  return out;
};
const segPaths = (fr, segs) => segs
  .filter((s) => s.length > 1)
  .map((s) => s.map((p, i) => (i ? "L" : "M") + fr.X(p.t) + " " + fr.Y(p.v)).join(" "));
const leaderSegs = (pts) => {
  const out = []; let cur = null, last = null;
  for (const p of pts) { if (cur && p.leader !== last) out.push(cur), cur = null; (cur ||= []).push(p); last = p.leader; }
  if (cur) out.push(cur);
  return out;
};

// ---- chart 1: published two-party preferred ----
const tppRows = sorted.filter((p) => tppOf(p) != null);
const tppVals = tppRows.map(tppOf).concat(trend.tpp.filter(Boolean).map((p) => p.v));
const tppLo = Math.max(0, Math.floor((Math.min(...tppVals, 50) - 2) / 5) * 5);
const tppHi = Math.ceil((Math.max(...tppVals, 50) + 2) / 5) * 5;
const tppSvg = (() => {
  const fr = frame({ H: 260, yLo: tppLo, yHi: tppHi, tick: 5, ref: 50, xTickDates: xTicks });
  const lines = segPaths(fr, segsOf(trend.tpp))
    .map((d) => `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const dots = tppRows.map((p) =>
    `<circle cx="${fr.X(p.fwEnd)}" cy="${fr.Y(p.tpp2.alp)}" r="2.6" fill="var(${FIRM_CSS[p.firm] || "--oth"})">` +
    `<title>${esc(pollDotTitle(p, `Labor two-party ${fmt(p.tpp2.alp)}`))}</title></circle>`).join("");
  const last = [...trend.tpp].reverse().find(Boolean);
  const end = last ? endMarks(fr, [
    { x: fr.X(last.t), v: last.v, r: 3, dotFill: "var(--ink)", textFill: "var(--ink)",
      dotTitle: `Blend ${last.v.toFixed(1)} at ${dateShort(last.t)}` },
    { x: fr.X(last.t), v: +(100 - last.v).toFixed(2), dotFill: "var(--lnp)", textFill: "var(--lnp-text)",
      dotTitle: `Coalition ${(100 - last.v).toFixed(1)} — the Labor blend's complement` },
  ]) : "";
  const base2022 = `<circle cx="${fr.X("2023-02-18")}" cy="${fr.Y(ELEC_TPP_2022)}" r="0.1" fill="none"/>` +
    `<text x="${fr.ML + 4}" y="${fr.Y(ELEC_TPP_2022) - 5}" font-size="9" fill="var(--ink-faint)">2022 election: Labor ${ELEC_TPP_2022.toFixed(1)}</text>` +
    `<line x1="${fr.ML}" y1="${fr.Y(ELEC_TPP_2022)}" x2="${fr.ML + 22}" y2="${fr.Y(ELEC_TPP_2022)}" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="2 2"/>`;
  return `<svg viewBox="0 0 ${fr.W} ${fr.H}" role="presentation" aria-hidden="true">${fr.grid}${fr.xt}${fr.election}${base2022}${lines}${dots}${end}</svg>`;
})();

// ---- chart 2: first-preference votes ----
const PRIM_SERIES = [
  ["alp", "var(--alp)"], ["lnp", "var(--lnp)"], ["onp", "var(--onp)"], ["grn", "var(--grn)"], ["oth", "var(--oth)"],
];
const PARTY_NAME = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };
const primVals = [];
for (const p of sorted) for (const k of ["alp", "lnp", "onp", "grn"]) if (p.primary[k] != null) primVals.push(p.primary[k]);
for (const p of sorted) { const o = othOf(p); if (o != null) primVals.push(o); }
for (const k of PRIM_SERIES) trend[k[0]].filter(Boolean).forEach((p) => primVals.push(p.v));
const primLo = Math.max(0, Math.floor((Math.min(...primVals) - 2) / 5) * 5);
const primHi = Math.ceil((Math.max(...primVals) + 3) / 5) * 5;
const primSvg = (() => {
  const fr = frame({ H: 300, yLo: primLo, yHi: primHi, tick: 10, xTickDates: xTicks });
  let body = "";
  for (const [k, colour] of PRIM_SERIES) {
    body += segPaths(fr, segsOf(trend[k]))
      .map((d) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  }
  for (const p of sorted) {
    const marks = [["alp", p.primary.alp], ["lnp", p.primary.lnp], ["onp", p.primary.onp], ["grn", p.primary.grn], ["oth", othOf(p)]];
    for (const [k, v] of marks) if (v != null)
      body += `<circle cx="${fr.X(p.fwEnd)}" cy="${fr.Y(v)}" r="2.1" fill="${PRIM_SERIES.find(([kk]) => kk === k)[1]}" opacity="0.75">` +
        `<title>${esc(pollDotTitle(p, `${PARTY_NAME[k]} ${fmt(v)}`))}</title></circle>`;
  }
  // the certified 2022 result marks the left edge of each party's scale
  const marks2022 = Object.entries(ELEC_PRIM_2022)
    .map(([k, v]) => ({ k, name: PARTY_NAME[k], v, y: Math.min(fr.H - fr.MB - 4, Math.max(fr.MT + 9, fr.Y(v))) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < marks2022.length; i++) if (marks2022[i].y - marks2022[i - 1].y < 11) marks2022[i].y = marks2022[i - 1].y + 11;
  const elect = marks2022.map((p) => {
    const text = (p.k === "alp" ? `2022 election: ` : "") + `${p.name} ${fmt(p.v)}`;
    return `<line x1="${fr.ML}" y1="${fr.Y(p.v)}" x2="${fr.ML + 22}" y2="${fr.Y(p.v)}" stroke="var(--${p.k})" stroke-width="1" stroke-dasharray="2 2"/>` +
      `<text x="${fr.ML + 26}" y="${p.y + 3}" font-size="9" fill="var(--ink-faint)">${text}</text>`;
  }).join("");
  const ends = PRIM_SERIES.map(([k, colour]) => {
    const lp = [...trend[k]].reverse().find(Boolean);
    return lp && {
      x: fr.X(lp.t), v: lp.v, dotFill: colour, textFill: `var(--${k}-text)`,
      dotTitle: `${PARTY_NAME[k]} blend ${lp.v.toFixed(1)} at ${dateShort(lp.t)}`,
    };
  }).filter(Boolean);
  return `<svg viewBox="0 0 ${fr.W} ${fr.H}" role="presentation" aria-hidden="true">${fr.grid}${fr.xt}${fr.election}${elect}${body}${endMarks(fr, ends)}</svg>`;
})();

// ---- leadership: era boundaries from the pair chain ----
const ppmRows = leadership.filter((l) => l.series === "preferredPremier");
const apprRows = leadership.filter((l) => l.series === "approval");
const rolesOf = (pair) => pair.split("-vs-");
const pairSeen = new Map();
for (const r of ppmRows) {
  if (!pairSeen.has(r.pair)) pairSeen.set(r.pair, { min: r.date, max: r.date });
  const e = pairSeen.get(r.pair);
  if (r.date < e.min) e.min = r.date;
  if (r.date > e.max) e.max = r.date;
}
const pairOrder = [...pairSeen.entries()].map(([pair, e]) => ({ pair, ...e })).sort((a, b) => a.min.localeCompare(b.min));
const boundaries = [];
for (let i = 0; i < pairOrder.length - 1; i++) {
  const a = pairOrder[i], b = pairOrder[i + 1];
  const mid = addDays(a.max, Math.round(daysBetween(a.max, b.min) / 2));
  const ra = rolesOf(a.pair), rb = rolesOf(b.pair);
  if (ra[0] !== rb[0]) boundaries.push({ date: mid, who: NAMES[rb[0]] || rb[0], role: "pm" });
  if (ra[1] !== rb[1]) boundaries.push({ date: mid, who: NAMES[rb[1]] || rb[1], role: "opp" });
}
const boundarySvg = (fr) => boundaries.map((b) => {
  const x = fr.X(b.date);
  const y = b.role === "pm" ? fr.MT + 8 : fr.H - fr.MB - 6;
  return `<line x1="${x}" y1="${fr.MT}" x2="${x}" y2="${fr.H - fr.MB}" stroke="var(--line-2)" stroke-width="1"/>` +
    `<text x="${x + 4}" y="${y}" font-size="9" fill="var(--ink-faint)">${b.who}</text>`;
}).join("");

// ---- chart 3: preferred premier ----
const ppmSeries = { pm: [], opp: [], extra: [] };
for (const r of ppmRows) {
  const [pm, opp, extra] = rolesOf(r.pair);
  const tele = { firm: r.firm, fwStart: r.fwStart, sample: r.sample };
  if (r.values[pm] != null) ppmSeries.pm.push({ t: r.date, v: r.values[pm], leader: pm, ...tele });
  if (opp && r.values[opp] != null) ppmSeries.opp.push({ t: r.date, v: r.values[opp], leader: opp, ...tele });
  if (extra && r.values[extra] != null) ppmSeries.extra.push({ t: r.date, v: r.values[extra], leader: extra, ...tele });
}
const ppmMax = Math.max(...ppmSeries.pm.map((p) => p.v), ...ppmSeries.opp.map((p) => p.v), ...ppmSeries.extra.map((p) => p.v));
const ppmSvg = (() => {
  const fr = frame({ H: 240, yLo: 0, yHi: Math.ceil((ppmMax + 8) / 10) * 10, tick: 10, xTickDates: xTicks, electionY: 32 });
  let body = "";
  const ends = [];
  for (const [key, colour] of [["pm", "var(--alp)"], ["opp", "var(--lnp)"], ["extra", "var(--onp)"]]) {
    body += segPaths(fr, leaderSegs(ppmSeries[key]))
      .map((d) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
    body += ppmSeries[key].map((p) =>
      `<circle cx="${fr.X(p.t)}" cy="${fr.Y(p.v)}" r="2.2" fill="${colour}">` +
      `<title>${esc(`${firmLabel[p.firm] || p.firm}, ${ldrSpan({ fwStart: p.fwStart, date: p.t })} — ${NAMES[p.leader] || p.leader} ${fmt(p.v)} (preferred premier${p.sample ? `, n ${p.sample.toLocaleString("en-AU")}` : ""})`)}</title></circle>`).join("");
    const lp = ppmSeries[key][ppmSeries[key].length - 1];
    if (lp) ends.push({ x: fr.X(lp.t), v: lp.v, textFill: `var(--${key === "pm" ? "alp" : key === "opp" ? "lnp" : "onp"}-text)`, label: fmt(lp.v) });
  }
  return `<svg viewBox="0 0 ${fr.W} ${fr.H}" role="presentation" aria-hidden="true">${fr.grid}${fr.xt}${fr.election}${boundarySvg(fr)}${body}${endMarks(fr, ends)}</svg>`;
})();

// ---- chart 4: net satisfaction ----
const premierKeys = new Set(pairOrder.map((o) => rolesOf(o.pair)[0]));
const oppKeys = new Set(pairOrder.map((o) => rolesOf(o.pair)[1]));
const netPt = (r) => ({ t: r.date, v: r.net, leader: r.leader, firm: r.firm, fwStart: r.fwStart, sample: r.sample });
const netsPm = apprRows.filter((r) => premierKeys.has(r.leader)).map(netPt);
const netsOpp = apprRows.filter((r) => !premierKeys.has(r.leader)).map(netPt);
const netAbs = Math.max(10, ...netsPm.map((p) => Math.abs(p.v)), ...netsOpp.map((p) => Math.abs(p.v)));
const netM = Math.ceil((netAbs + 4) / 10) * 10;
const netSvg = (() => {
  const fr = frame({ H: 240, yLo: -netM, yHi: netM, tick: 10, ref: 0, xTickDates: xTicks, electionY: 32 });
  let body = "";
  const ends = [];
  for (const [pts, colour, textTok] of [[netsPm, "var(--alp)", "var(--alp-text)"], [netsOpp, "var(--lnp)", "var(--lnp-text)"]]) {
    body += segPaths(fr, leaderSegs(pts))
      .map((d) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
    body += pts.map((p) =>
      `<circle cx="${fr.X(p.t)}" cy="${fr.Y(p.v)}" r="2.2" fill="${colour}">` +
      `<title>${esc(`${firmLabel[p.firm] || p.firm}, ${ldrSpan({ fwStart: p.fwStart, date: p.t })} — ${NAMES[p.leader] || p.leader} net satisfaction ${snet(p.v)}${nTitle(p.sample)}`)}</title></circle>`).join("");
    const lp = pts[pts.length - 1];
    if (lp) ends.push({ x: fr.X(lp.t), v: lp.v, textFill: textTok, label: snet(lp.v).replace(/^\+/, "") });
  }
  return `<svg viewBox="0 0 ${fr.W} ${fr.H}" role="presentation" aria-hidden="true">${fr.grid}${fr.xt}${fr.election}${boundarySvg(fr)}${body}${endMarks(fr, ends)}</svg>`;
})();

// ---------- composition (every user-visible number/word lands here) ------
const daysToGo = daysBetween(asOf, ELECTION_DATE);
// the 2PP scope sentence must name only the waves actually carrying a
// published 2PP — naming the whole window credited 2PP-less houses and left
// the primaries line's count contradicting the two-party count (5 vs 7)
const headTppRows = headRows.filter((p) => tppOf(p) != null);
const headTppFirms = [...new Set(headTppRows.map((p) => p.firm))];
const headNoTppFirms = [...new Set(headRows.filter((p) => tppOf(p) == null).map((p) => p.firm))];
const headTppFrom = headTppRows.reduce((a, p) => (p.fwEnd < a ? p.fwEnd : a), "9999");
const headTppLastEnd = headTppRows.reduce((a, p) => (p.fwEnd > a ? p.fwEnd : a), "");
const headMin = Math.min(...head.span), headMax = Math.max(...head.span);
const onpRows = headRows.filter((p) => p.primary.onp != null);
const firmsN = Object.keys(firmLabel).length;
const d1 = (v) => (v == null ? "—" : v.toFixed(1));

const headNote = `${head.n2pp} published two-party ${head.n2pp === 1 ? "figure" : "figures"} from ${joinL(headTppFirms.map((f) => firmLabel[f]))} with fieldwork ending between ${dateShort(headTppFrom || asOf)} and ${dateShort(headTppLastEnd || asOf)}, blended by sample size and recency — each wave weighing n·2^(−d/28), its weight halving every 28 days, at most six waves per house. The published figures alone run from ${fmt(headMin)} to ${fmt(headMax)} for Labor.`;
const delta22 = head.alp2pp != null ? +(head.alp2pp - ELEC_TPP_2022).toFixed(1) : null;
const headDelta = delta22 == null ? "" : `The blend sits ${fmt(Math.abs(delta22))} points ${delta22 < 0 ? "short of" : delta22 > 0 ? "past" : "level with"} the 2022 election result, Labor ${ELEC_TPP_2022.toFixed(1)} to the Coalition's ${(100 - ELEC_TPP_2022).toFixed(1)}.`;
const primNote = `First-preference blend of all ${head.nPolls} ${head.nPolls === 1 ? "poll" : "polls"} in the same window${headNoTppFirms.length ? ` — ${joinL(headNoTppFirms.map((f) => firmLabel[f]))} publishes no two-party figure, so ${headNoTppFirms.length === 1 ? "that house counts" : "those houses count"} here but not above` : ""}${onpRows.length < head.nPolls ? `; One Nation and Others draw on the ${onpRows.length} that split them out` : ""}. House effects are not adjusted.`;

const latest = sorted[sorted.length - 1];
const latestStrip = (() => {
  const client = latest.client ? ` for ${latest.client}` : "";
  const tpp = latest.tpp2?.alp != null ? `two-party ${fmt(latest.tpp2.alp)}–${fmt(100 - latest.tpp2.alp)} ${latest.tpp2.alp >= 50 ? "Labor" : "the Coalition"}; ` : "";
  const prims = [["ALP", latest.primary.alp], ["LNP", latest.primary.lnp], ["ON", latest.primary.onp], ["GRN", latest.primary.grn]]
    .filter(([, v]) => v != null).map(([k, v]) => `${k} ${fmt(v)}`);
  const oth = othOf(latest);
  if (oth != null) prims.push(`others ${fmt(oth)}`);
  return `<b>Latest published poll:</b> ${latest.firmRaw}${client}, fieldwork to ${dateShort(latest.fwEnd)} — ${tpp}primaries ${prims.join(" · ")}.`;
})();

const ppmLatestRow = ppmRows[ppmRows.length - 1];
const ppmStrip = (() => {
  const [pm, opp, extra] = rolesOf(ppmLatestRow.pair);
  const parts = [[pm], [opp], [extra]].filter(([k]) => k && ppmLatestRow.values[k] != null)
    .map(([k]) => `${NAMES[k] || k} ${fmt(ppmLatestRow.values[k])}`);
  return `<b>Preferred premier, latest:</b> ${parts.join(" · ")}; ${fmt(ppmLatestRow.dk)} per cent uncommitted — ${firmLabel[ppmLatestRow.firm] || ppmLatestRow.firm}, fieldwork to ${dateShort(ppmLatestRow.date)}.`;
})();
const netLatestPm = netsPm[netsPm.length - 1], netLatestOpp = netsOpp[netsOpp.length - 1];
const netStrip = `<b>Net satisfaction, latest:</b> ${netLatestPm ? `${NAMES[netLatestPm.leader] || netLatestPm.leader} ${snet(netLatestPm.v)}` : ""}${netLatestPm && netLatestOpp ? " · " : ""}${netLatestOpp ? `${NAMES[netLatestOpp.leader] || netLatestOpp.leader} ${snet(netLatestOpp.v)}` : ""}${apprRows.length ? ` — ${firmLabel[apprRows[apprRows.length - 1].firm] || apprRows[apprRows.length - 1].firm}, fieldwork to ${dateShort(apprRows[apprRows.length - 1].date)}` : ""}.`;

const firmLegend = [...new Set(tppRows.map((p) => p.firm))]
  .map((f) => `<span class="vp-lg"><i style="background:var(${FIRM_CSS[f] || "--oth"})"></i>${firmLabel[f]}</span>`).join("\n      ") +
  `\n      <span class="vp-lg"><i style="background:var(--ink);width:14px;height:2px;border-radius:1px"></i>Trailing blend</span>`;
const PARTY_LEGEND = [["Labor", "--alp"], ["Coalition", "--lnp"], ["One Nation", "--onp"], ["Greens", "--grn"], ["Others", "--oth"]];
const partyLegend = PARTY_LEGEND.map(([k, v]) => `<span class="vp-lg"><i style="background:var(${v})"></i>${k}</span>`).join("\n      ");
const curRoles = rolesOf(pairOrder[pairOrder.length - 1].pair);
const leadLegend = `<span class="vp-lg"><i style="background:var(--alp)"></i>Premier (${NAMES[curRoles[0]] || curRoles[0]})</span>
      <span class="vp-lg"><i style="background:var(--lnp)"></i>Opposition (${NAMES[curRoles[1]] || curRoles[1]})</span>${ppmSeries.extra.length
  ? `\n      <span class="vp-lg"><i style="background:var(--onp)"></i>${NAMES[curRoles[2]] || "One Nation"}</span>` : ""}`;
const netLegend = `<span class="vp-lg"><i style="background:var(--alp)"></i>Premier (${NAMES[curRoles[0]] || curRoles[0]})</span>
      <span class="vp-lg"><i style="background:var(--lnp)"></i>Opposition (${NAMES[curRoles[1]] || curRoles[1]})</span>`;

const pollRows = [...sorted].reverse().map((p) => {
  const lbl = fwLabel(p);
  const name = p.sourceUrl
    ? `<a class="vp-x" href="${p.sourceUrl}">${p.firmRaw}</a>`
    : p.firmRaw;
  const client = p.client ? ` <span class="vp-client">${p.client}</span>` : "";
  return `<tr><td class="l">${name}${client}</td><td>${lbl}${p.approxDate ? "*" : ""}</td><td>${p.sample ? p.sample.toLocaleString("en-AU") : "—"}</td>` +
    `<td>${fmt(p.primary.alp)}</td><td>${fmt(p.primary.lnp)}</td><td>${fmt(p.primary.grn)}</td><td>${fmt(p.primary.onp)}</td><td>${fmt(othOf(p))}</td>` +
    `<td class="vp-tpp">${p.tpp2?.alp != null ? fmt(p.tpp2.alp) : "—"}</td></tr>`;
}).join("\n        ");

const tpp3Rows = [...threeParty].sort((a, b) => b.fwEnd.localeCompare(a.fwEnd)).map((t) =>
  `<tr><td class="l">${firmLabel[t.firm] || t.firm}</td><td>${enDashRange(t.dateLabel)}</td><td>${t.sample ? t.sample.toLocaleString("en-AU") : "—"}</td>` +
  `<td>${fmt(t.alp)}</td><td>${fmt(t.lnp)}</td><td>${fmt(t.onp)}</td></tr>`).join("\n        ");

const metaDesc = `Victorian state polling to the 28 November 2026 election: a published-poll two-party blend of Labor ${d1(head.alp2pp)} v Coalition ${d1(head.lnp2pp)}, five-party primary trends and leadership ratings, from ${polls.length} waves by ${firmsN} houses. An auspol tracker satellite — estimates only.`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vicpoll: the Victorian election in the polls – auspol tracker</title>
<!-- GENERATED FILE — do not hand-edit. Rebuilt by .build/refresh-vic.mjs
     from data/vic-polls.json (validated fail-hard there); landing path per
     wave: this script, then .build/git-push-main.sh data/vic-polls.json
     vic/index.html. This read: ${dateLabel(asOf)}, ${daysToGo} days to the
     28 November 2026 election. -->
<meta name="description" content="${metaDesc}">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Vicpoll: the Victorian election in the polls – auspol tracker">
<meta property="og:description" content="${metaDesc}">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/vic/">
<link rel="icon" href="/assets/favicon.svg">
<style>
/* ------- fonts: the two cuts the static article runs (as prediction/) ------- */
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-600-latin.94af2060.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/assets/fonts/ibmplexsans-latin.056e4e24.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* ------- palette: the editorial surfaces the live site runs in ------- */
:root {
  --bg:        oklch(0.975 0.009 80);
  --ink:       oklch(0.27 0.012 55);
  --ink-2:     oklch(0.44 0.012 55);
  --ink-3:     oklch(0.52 0.010 58);
  --ink-faint: oklch(0.70 0.008 65);
  --line:      oklch(0.895 0.008 75);
  --line-2:    oklch(0.935 0.006 78);
  --accent:    oklch(0.50 0.070 205);
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  /* the shell ships --alp/--lnp/--grn/--onp; this page adds the rest */
  --oth: oklch(0.64 0.018 70);
  --alp-text: var(--alp); --lnp-text: var(--lnp);
  --grn-text: oklch(0.52 0.120 150); --onp-text: oklch(0.52 0.130 58); --oth-text: oklch(0.52 0.018 70);
  /* per-house dot colours on the two-party chart — mid-luminance so they read
     on both surfaces (the ALP/LNP hues stay reserved for the parties) */
  --f-resolve: oklch(0.52 0.09 210);
  --f-roymorgan: oklch(0.55 0.14 330);
  --f-redb: oklch(0.55 0.12 75);
  --f-wolfsmith: oklch(0.46 0.07 290);
  --f-demosau: oklch(0.55 0.10 165);
  --f-newspoll: oklch(0.42 0.02 60);
  --f-freshwater: oklch(0.60 0.10 255);
  --f-yougov: oklch(0.50 0.11 20);
  --f-jws: oklch(0.55 0.09 100);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:        oklch(0.205 0.010 65);
    --ink:       oklch(0.940 0.008 80);
    --ink-2:     oklch(0.800 0.009 78);
    --ink-3:     oklch(0.670 0.009 72);
    --ink-faint: oklch(0.545 0.009 68);
    --line:      oklch(0.355 0.011 66);
    --line-2:    oklch(0.312 0.010 66);
    --accent:    oklch(0.70 0.080 205);
    --oth: oklch(0.700 0.018 72);
    --grn-text: var(--grn); --onp-text: var(--onp); --oth-text: var(--oth);
    --f-resolve: oklch(0.68 0.09 210);
    --f-roymorgan: oklch(0.72 0.14 330);
    --f-redb: oklch(0.72 0.12 75);
    --f-wolfsmith: oklch(0.70 0.08 290);
    --f-demosau: oklch(0.70 0.11 165);
    --f-newspoll: oklch(0.75 0.02 70);
    --f-freshwater: oklch(0.75 0.10 255);
    --f-yougov: oklch(0.68 0.12 25);
    --f-jws: oklch(0.72 0.09 100);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  font-feature-settings: "tnum" 1, "ss01" 1;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ------- article column (the prediction/ recipe) ------- */
.frame-wrap {
  flex: 1; display: flex; flex-direction: column;
  max-width: 680px; width: 100%; margin: 0 auto;
  padding: 40px 28px calc(64px + env(safe-area-inset-bottom, 0px)) 28px;
}
.frame-wrap h1 {
  font-family: var(--serif); font-size: 34px; font-weight: 600;
  letter-spacing: -0.01em; margin: 0 0 6px;
}
.frame-wrap h2 {
  font-family: var(--serif); font-size: 20px; font-weight: 600;
  margin: 30px 0 8px; padding-top: 14px; border-top: 1px solid var(--line);
}
.frame-wrap p { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin: 0 0 12px; }
.frame-wrap p.ss-sub { margin: 0 0 4px; }
.frame-wrap p.ss-note { margin: 20px 0 0; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); }
.frame-wrap strong { color: var(--ink); font-weight: 600; }

/* ------- the two-party headline ------- */
.vp-duo { display: flex; gap: 38px; margin: 26px 0 2px; }
.vp-duo .n {
  font-family: var(--serif); font-weight: 600;
  font-size: 52px; line-height: 1; letter-spacing: -0.015em;
}
.vp-duo .k { margin-top: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink); }
.vp-scope { font-size: 12.5px; line-height: 1.55; color: var(--ink-3); margin: 6px 0 14px; }
.vp-chips { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 6px 0 4px; }
.vp-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink-2); }
.vp-chip i { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.vp-chip b { font-weight: 600; color: var(--ink); }
.vp-latest {
  border-left: 2px solid var(--line); padding: 2px 0 2px 12px;
  font-size: 13.5px; line-height: 1.55; color: var(--ink-2); margin: 14px 0 2px;
}
.vp-latest b { color: var(--ink); font-weight: 600; }

/* ------- charts ------- */
.vp-chart { margin: 16px 0 6px; }
.vp-chart svg { display: block; width: 100%; height: auto; }
.vp-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 8px 0 0; font-size: 12px; color: var(--ink-2); }
.vp-legend .vp-lg { display: inline-flex; align-items: center; gap: 6px; }
.vp-legend .vp-lg i { width: 8px; height: 8px; border-radius: 50%; }

/* ------- the poll tables ------- */
.vp-twrap { overflow-x: auto; margin: 6px 0 8px; }
.vp-table { width: 100%; min-width: 600px; border-collapse: collapse; }
.vp-table caption {
  text-align: left; font-size: 12px; line-height: 1.5; color: var(--ink-3);
  padding: 0 0 8px; caption-side: top;
}
.vp-table th, .vp-table td { padding: 5px 6px; border-bottom: 1px solid var(--line-2); }
.vp-table thead th {
  font-size: 11px; font-weight: 600; color: var(--ink-3); text-align: right;
  border-bottom: 1px solid var(--line); white-space: nowrap;
}
.vp-table thead th.l, .vp-table td.l { text-align: left; }
.vp-table td { font-size: 12.5px; text-align: right; white-space: nowrap; }
.vp-table .vp-client { color: var(--ink-faint); font-size: 11.5px; }
.vp-table td.vp-tpp { font-weight: 600; color: var(--ink); }
a.vp-x { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--line); }
a.vp-x:hover, a.vp-x:focus-visible { border-bottom-color: var(--ink-2); }
.vp-tblhead, .frame-wrap p.vp-tblhead { font-size: 12.5px; font-weight: 600; color: var(--ink); margin: 18px 0 2px; }
p.vp-tnote { font-size: 12.5px; line-height: 1.55; color: var(--ink-3); margin: 0 0 12px; }
</style>
</head>
<body>
<main class="frame-wrap">
  <p class="sh-kicker">Vicpoll</p>
  <h1>The Victorian election, in the polls</h1>
  <p class="ss-sub">Every published Victorian state poll toward the ${dateLabel(ELECTION_DATE)} election, blended: ${polls.length} waves from ${firmsN} houses since ${MY(sorted[0].fwEnd)}. Assembled ${dateLabel(asOf)} — ${daysToGo} days out.</p>

  <div class="vp-duo" role="img" aria-label="Two-party preferred blend: Labor ${d1(head.alp2pp)} per cent, Coalition ${d1(head.lnp2pp)} per cent.">
    <div><div class="n" style="color:var(--alp-text)">${d1(head.alp2pp)}</div><div class="k">Labor — two-party preferred</div></div>
    <div><div class="n" style="color:var(--lnp-text)">${d1(head.lnp2pp)}</div><div class="k">Coalition — two-party preferred</div></div>
  </div>
  <p class="vp-scope">${headNote} ${headDelta}</p>

  <div class="vp-chips" aria-label="First-preference blend">
    <span class="vp-chip"><i style="background:var(--alp)"></i>Labor <b>${d1(head.prim.alp)}</b></span>
    <span class="vp-chip"><i style="background:var(--lnp)"></i>Coalition <b>${d1(head.prim.lnp)}</b></span>
    <span class="vp-chip"><i style="background:var(--onp)"></i>One Nation <b>${d1(head.prim.onp)}</b></span>
    <span class="vp-chip"><i style="background:var(--grn)"></i>Greens <b>${d1(head.prim.grn)}</b></span>
    <span class="vp-chip"><i style="background:var(--oth)"></i>Others <b>${d1(head.prim.oth)}</b></span>
  </div>
  <p class="vp-scope">${primNote}</p>
  <p class="vp-latest">${latestStrip}</p>

  <h2>Two-party preferred</h2>
  <p>Every figure here is a pollster’s own published two-party preferred — Labor versus Coalition — never one this page constructs from first preferences. Why that rule exists is explained below.</p>
  <figure class="vp-chart" role="img" aria-label="Chart of published two-party preferred figures since early 2023, Labor ${d1(head.alp2pp)} to Coalition ${d1(head.lnp2pp)} on the current blend.">
    ${tppSvg}
  </figure>
  <div class="vp-legend">
      ${firmLegend}
  </div>
  <p class="vp-scope">Dots are the published figures, one per poll, coloured by house; the line is the trailing blend recomputed at each poll’s fieldwork end (a 120-day window), pausing where no published figure is in reach. The 2022 election result, Labor ${ELEC_TPP_2022.toFixed(1)}, falls just off the left edge of the chart.</p>

  <h2>First preferences</h2>
  <p>Five-way first-preference votes, blended the same way. One Nation at roughly a fifth to a quarter of the primary vote is the fact of this election: Victoria has not measured a field like this before, and it is why every two-party number on this page stays strictly published-only.</p>
  <figure class="vp-chart" role="img" aria-label="Chart of first-preference votes since early 2023 for Labor, the Coalition, One Nation, the Greens and Others.">
    ${primSvg}
  </figure>
  <div class="vp-legend">
      ${partyLegend}
  </div>
  <p class="vp-scope">“Others” combines independents with every remaining minor party — the sources split independents out in 2023–25 and merge them into one Others cell under the 2026 table layout, so only the combined figure is charted.</p>

  <h2>The leaders</h2>
  <p class="vp-latest">${ppmStrip}</p>
  <p class="vp-latest">${netStrip}</p>
  <figure class="vp-chart" role="img" aria-label="Chart of preferred-premier figures over the term, breaking at each leadership change.">
    ${ppmSvg}
  </figure>
  <div class="vp-legend">
      ${leadLegend}
  </div>
  <p class="vp-scope">Preferred-premier scores ask who voters would rather have as premier, uncommitted included — so the pair rarely sums to 100. Segments break where a leadership change resets the contest; the incoming leader is named at each mark.</p>
  <figure class="vp-chart" role="img" aria-label="Chart of net satisfaction for the premier and opposition leader over the term.">
    ${netSvg}
  </figure>
  <div class="vp-legend">
      ${netLegend}
  </div>
  <p class="vp-scope">Net satisfaction is satisfied minus dissatisfied, as published; some houses publish the net only. The zero line is where approval turns to disapproval.</p>

  <h2>Every published poll</h2>
  <p>${latest.firmRaw}'s ${fwLabel(latest)} wave is the newest of ${polls.length} published since ${MY(sorted[0].fwEnd)} by ${firmsN} houses — the complete census, every figure as the house published it, newest first.</p>
  <div class="vp-twrap">
    <table class="vp-table">
      <caption>All ${polls.length} published waves of voting intention since ${MY(sorted[0].fwEnd)}, newest first. * Fieldwork dates are approximate (the month is on record, the days are not). The two-party column is the house’s own published figure — “—” where none was published. Others combines independents and minor parties.</caption>
      <thead>
        <tr>
          <th scope="col" class="l">Poll</th>
          <th scope="col" class="l">Fieldwork</th>
          <th scope="col">n</th>
          <th scope="col">ALP</th>
          <th scope="col">L/NP</th>
          <th scope="col">Grn</th>
          <th scope="col">ON</th>
          <th scope="col">Oth</th>
          <th scope="col">2PP ALP</th>
        </tr>
      </thead>
      <tbody>
        ${pollRows}
      </tbody>
    </table>
  </div>
  <p class="vp-tblhead">Three-cornered preferred, where published</p>
  <div class="vp-twrap">
    <table class="vp-table">
      <caption>Some houses also ask preferred premier among the three parties’ candidates for premier — a different question to the leadership ratings above, and to two-party preferred.</caption>
      <thead>
        <tr>
          <th scope="col" class="l">Poll</th>
          <th scope="col" class="l">Fieldwork</th>
          <th scope="col">n</th>
          <th scope="col">ALP</th>
          <th scope="col">L/NP</th>
          <th scope="col">ON</th>
        </tr>
      </thead>
      <tbody>
        ${tpp3Rows}
      </tbody>
    </table>
  </div>

  <h2>How the headline blend is made</h2>
  <p>Each published figure with fieldwork ending in the ${headWindow} days to ${dateLabel(asOf)} counts with weight n·2^(−d/28) — its sample size times a recency decay that halves every 28 days, d being the wave’s age. A house contributes at most its six most recent waves. The first-preference chips use the same recipe, and the trend lines re-run it on a 120-day trailing window at each fieldwork end. House effects — one pollster’s persistent lean against another — are deliberately not adjusted: on a field this small the correction would be guesswork presented as precision.</p>

  <h2>Why two-party is published-only</h2>
  <p>Every two-party figure here is a pollster’s own published number; this page never converts first preferences into a two-party estimate of its own. The reason is Victoria’s preference record. Two-party preferred derives from how minor parties’ preferences flow, and One Nation — polling around a fifth to a quarter of the primary vote in the waves above — barely contested the 2022 lower-house election. There is no measured baseline for where a Victorian One Nation voter’s preferences go at this scale, and borrowing one from another state or from federal results would be invented precision. The five-way first-preference trend, read beside the houses’ own published two-party figures, is the honest summary.</p>

  <h2>Where the numbers come from</h2>
  <p>Rows are indexed from Wikipedia’s opinion-polling tables for the 2026 Victorian election — a dated snapshot each refresh, with every row recording which sources fed it — and cross-checked against electiontracker.au’s open voting-intention CSV. New waves are found by a daily watch across the pollsters’ own release channels — Resolve in The Age, Freshwater in the Herald Sun, Newspoll in The Australian, RedBridge and Accent in the Financial Review, DemosAU, and Roy Morgan — and every figure is checked verbatim against the published report before it lands. Nothing auto-commits: every wave lands as a reviewed diff.</p>
  <p>Vicpoll is a satellite of auspol tracker, the federal poll tracker. It shares the site’s chrome and conventions, but no federal figures appear here and the page is deliberately unlisted elsewhere on the site. After the election it will be frozen and kept as an archive.</p>

  <p class="ss-note">Figures on this page are aggregates of published polling — estimates, not predictions. Vicpoll is independent and unofficial, with no affiliation to any pollster, party or candidate. Assembled ${dateLabel(asOf)}.</p>
</main>
</body>
</html>
`;

// ---------- writers --------------------------------------------------------
const writeAtomic = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, content);
  renameSync(tmp, file);
};
const readOrNull = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };

let changed = false;
const wrote = [];
const put = (file, content) => {
  if (readOrNull(file) !== content) {
    changed = true;
    wrote.push(path.relative(REPO, file));
    if (!dry) writeAtomic(file, content);
  }
};
// the site's shared header and footer (.build/site-shell.mjs), as every satellite carries them
put(path.join(REPO, PAGE), applyShell(html, shellOptsFor(PAGE)));

// The sitemap's vic/ route reads VIC_STAMP from build.mjs — bump it
// only when the page actually moved, so a no-change run doesn't falsely
// datestamp the sitemap (the main build regenerates it from the constant).
if (changed) {
  const buildPath = path.join(REPO, BUILD);
  const src = readFileSync(buildPath, "utf8");
  const m = src.match(/const VIC_STAMP = "\d{4}-\d{2}-\d{2}";/);
  const next = `const VIC_STAMP = "${asOf}";`;
  if (!m) console.error("WARN no VIC_STAMP in build.mjs — sitemap lastmod stale");
  else if (m[0] !== next) {
    wrote.push(BUILD);
    if (!dry) writeAtomic(buildPath, src.replace(m[0], next));
  }
}

console.log(`VIC_STATUS ${JSON.stringify({
  ran: true, asOf, daysToGo,
  polls: polls.length, withTpp: tppRows.length, threeParty: threeParty.length, leadership: leadership.length,
  tppBlend: head.alp2pp, lnpBlend: head.lnp2pp, headN2pp: head.n2pp, headWindow, headPolls: head.nPolls,
  prim: head.prim, changed, wrote: dry ? [] : wrote, dry,
})}`);
