// Add RedBridge/Accent's vote-softness figures to current and historical
// poll rows. The latest AFR-series reports reprint a trend back to Nov 2024;
// the original 2024 reports below carry the earlier comparable charts.
// Dry-run by default; --apply writes.
//
// A retrospective row is matched by its report's own primaries and fieldwork
// month. Older cycle rows sometimes fold One Nation into Other, so the exact
// comparison accepts that folded basis and splits it only when the report
// prints both components. Near matches must be unique among the month's rows,
// not blocked by an unrelated extra release. Reports must agree on every
// reprinted figure. Unmatched retrospective rows are listed and never filed.
//
// The early charts do not all print every cohort or every third-category
// label. Those cells stay absent/null: a 100-minus-the-other-segments residual
// is not a printed figure and must not be manufactured by this backfill.
import { readFileSync, readdirSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

process.env.RB_LIB = "1";
const { parseFirmness, parseTable2 } = await import("./extract-redbridge.mjs");

const APPLY = process.argv.includes("--apply");
const SRC = ".build/redbridge-src";
const POLLSTERS = new Set(["RedBridge/Accent", "RedBridge Group"]);
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
const RM_BASE = "https://redbridgegroup.com.au/wp-content/uploads";
const LEGACY = [
  {
    cycle: "2025", date: "2024-04-21", firm: "RedBridge Group", dateStart: "2024-04-12",
    sample: 1529, sampleEff: 1270,
    primary: { alp: 33, lnp: 37, onp: 7, grn: 12, oth: 11 },
    firmness: {
      alp: [64, 33, null], lnp: [72, 25, null], onp: [63, 35, null],
      grn: [57, 39, 4], oth: [51, 43, null],
    },
    releaseUrl: `${RM_BASE}/2024/04/RedBridge-political-report-Apr-2024.pdf`,
    firmnessNote: "Figure 2: not at all / somewhat / very likely to change vote. No all-voters row; blank third-category labels stay absent.",
  },
  {
    cycle: "2025", date: "2024-07-19", firm: "RedBridge Group", dateStart: "2024-07-10",
    sample: 1505, sampleEff: 1082,
    primary: { alp: 32, lnp: 41, onp: null, grn: 11, oth: 16 },
    firmness: {
      alp: [47, 39, 14], lnp: [58, 31, 11], grn: [42, 49, null], oth: [45, 41, 14],
    },
    releaseUrl: `${RM_BASE}/2024/07/RedBridge-July-public-opinion-snapshot.pdf`,
    firmnessNote: "Figure 3: Solid / Soft / Leaning. No all-voters or separate One Nation row; an unreadable third-category label stays absent.",
  },
  {
    cycle: "2025", date: "2024-11-13", firm: "RedBridge Group", dateStart: "2024-11-06",
    sample: 2011, sampleEff: 1538,
    primary: { alp: 34, lnp: 39, onp: null, grn: 11, oth: 16 },
    firmness: {
      alp: [44, 46, 10], lnp: [62, 31, 7], grn: [42, 52, 6], oth: [43, 41, 16],
    },
    releaseUrl: `${RM_BASE}/2024/11/RedBridge-November-public-opinion-snapshot.pdf`,
    firmnessNote: "Figure 2: Solid / Soft / Leaning. No all-voters or separate One Nation row; One Nation is inside Other on this row's primary basis.",
  },
];

const waveKey = (r) => (r ? r.year * 12 + r.month : -1);
const reports = readdirSync(SRC).filter((f) => f.endsWith(".txt"))
  .map((f) => {
    const txt = readFileSync(`${SRC}/${f}`, "utf8");
    let meta = {};
    try { meta = JSON.parse(readFileSync(`${SRC}/${f.replace(/\.txt$/, ".json")}`, "utf8")); } catch { /* text-only cache */ }
    return { f, txt, t2: parseTable2(txt), pdfUrl: meta.pdfUrl || null };
  })
  .sort((a, b) => waveKey(b.t2.wave) - waveKey(a.t2.wave));
const firm = new Map(), firmSource = new Map(), prim = new Map();
for (const { f, txt, t2, pdfUrl } of reports) {
  const fm = parseFirmness(txt);
  if (fm.error) { console.log(`  ${f}: ${fm.error} — not read`); continue; }
  for (const r of fm.rows) {
    const k = JSON.stringify(r.firmness);
    if (firm.has(r.label) && firm.get(r.label) !== k) {
      console.error(`reports disagree on ${r.label}: ${firm.get(r.label)} vs ${k} (${f})`);
      process.exit(2);
    }
    firm.set(r.label, k);
    if (!firmSource.has(r.label)) firmSource.set(r.label, pdfUrl);
  }
  for (const r of t2.rows || []) if (!prim.has(r.label)) prim.set(r.label, r);
}

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const targets = [
  ...D.polls.filter((p) => p.pollster === "RedBridge/Accent").map((p) => ({ p, where: `polls ${p.date}` })),
  ...Object.entries(D.cyclePolls || {}).flatMap(([cycle, rows]) => rows
    .filter((p) => POLLSTERS.has(p.firm)).map((p) => ({ p, where: `cyclePolls.${cycle} ${p.date}`, cycle }))),
];
const filled = [], unmatched = [];
const otherOf = (p) => p.ind ?? p.oth;
const samePrimaries = (p, t, tolerance = 0) => {
  if (!t) return false;
  for (const k of ["alp", "lnp", "grn"]) if (p[k] == null || Math.abs(p[k] - t[k]) > tolerance) return false;
  const other = otherOf(p);
  if (other == null) return false;
  return p.onp != null
    ? Math.abs(p.onp - t.onp) <= tolerance && Math.abs(other - t.ind) <= tolerance
    : Math.abs(other - (t.onp + t.ind)) <= tolerance;
};
const insertField = (p, key, value) => {
  if (JSON.stringify(p[key]) === JSON.stringify(value)) return false;
  if (p[key] != null) {
    console.error(`${key} differs on ${p.firm || p.pollster} ${p.date}: ${JSON.stringify(p[key])} vs ${JSON.stringify(value)}`);
    process.exit(2);
  }
  p[key] = value;
  return true;
};
for (const l of LEGACY) {
  const hit = targets.find(({ p, cycle }) => cycle === l.cycle && p.date === l.date && p.firm === l.firm)?.p;
  if (!hit || Object.entries(l.primary).some(([k, v]) => hit[k] !== v)) {
    console.error(`legacy source row missing or primaries changed: ${l.firm} ${l.date}`);
    process.exit(2);
  }
  let changed = false;
  for (const [k, v] of Object.entries({
    dateStart: l.dateStart, sample: l.sample, sampleEff: l.sampleEff,
    firmness: l.firmness, releaseUrl: l.releaseUrl, firmnessNote: l.firmnessNote,
  })) changed = insertField(hit, k, v) || changed;
  if (changed) filled.push(`${l.date}: original report figure ${l.releaseUrl.split("/").at(-1)}`);
}

const RETRO_META = {
  "Feb 2025": { dateStart: "2025-02-03", sample: 1013 },
  "Mar 2025": { dateStart: "2025-03-03", sample: 2007 },
  "Apr 2025": {
    dateStart: "2025-04-24", sample: 1011, sampleEff: 801,
    releaseUrl: "https://www.accent-research.com/projects/federal-election-campaign-final-week",
  },
};
const applyRetroMeta = (hit, label) => {
  if (!hit.cycle) return false;
  let changed = false;
  for (const [key, value] of Object.entries({
    ...(RETRO_META[label] || {}),
    firmnessSource: firmSource.get(label) || null,
    firmnessNote: "RedBridge/Accent's retrospective AFR-series vote-softness table; this is the later print, not an inferred original-release figure.",
  })) changed = insertField(hit.p, key, value) || changed;
  return changed;
};

for (const [label, k] of firm) {
  const t = prim.get(label);
  const [mon, yr] = label.split(" ");
  const ym = `${yr}-${String(MON[mon]).padStart(2, "0")}`;
  const inMonth = targets.filter(({ p }) => p.date.slice(0, 7) === ym);
  const exact = inMonth.filter(({ p }) => samePrimaries(p, t));
  const near = inMonth.filter(({ p }) => samePrimaries(p, t, 1));
  const hit = exact.length === 1 ? exact[0] : near.length === 1 ? near[0] : null;
  if (!hit) { unmatched.push(label); continue; }
  const how = exact.length === 1 ? "primaries" : "month, primaries ±1";
  const p = hit.p;
  if (p.firmness) {
    if (JSON.stringify(p.firmness) !== k) {
      console.log(`  ${p.date}: file firmness differs from ${label} — left as is`);
      continue;
    }
    if (applyRetroMeta(hit, label)) filled.push(`${label} → ${p.date} (method metadata)`);
    continue;
  }
  if (p.onp == null && t && p.oth === t.onp + t.ind) {
    p.onp = t.onp;
    p.oth = t.ind;
  }
  p.firmness = JSON.parse(k);
  applyRetroMeta(hit, label);
  filled.push(`${label} → ${p.date} (${how})`);
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`filled ${filled.length}:`);
filled.forEach((s) => console.log("  +", s));
console.log(`no committed row for ${unmatched.length}: ${unmatched.join(", ")}`);
if (APPLY && filled.length) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
