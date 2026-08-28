/* extract-archive-once.mjs — ONE-TIME extraction: pull every data series out of
   The Australian's "Federal Newspoll Archive" page (pasted HTML with
   window.infographicData) and write four CSVs into data/:

     newspaper-primary-vote.csv          (Coalition/ALP/Greens/Others/One Nation/Democrats, Nov 1985 -> Apr 2022)
     newspoll-two-party-preferred.csv    (Coalition/ALP, Feb 1993 -> Apr 2022)
     newspoll-better-pm.csv              (PM-vs-LOTO preferred PM + uncommitted, 1987 -> Apr 2022)
     newspoll-leader-net-satisfaction.csv  (REPLACED: archive history 1987 -> 2022 merged with the
         corrected 2019-06-30-era CSV; corrected values win in the overlap so the adjudicated
         fixes — Albanese 24 Nov 2019 = -4 — are preserved)

   Notes/handling:
   - dates are "D/MM/YYYY" publication dates; one typo ("24/02/2109") corrected to 2019
   - period labels in the sheet are unreliable (three blocks mislabelled "2010-2014") and are ignored
   - "Kevin Rudd 1"/"Kevin Rudd 2" (his two PM stints) are merged into one kevin_rudd column
   - empty/unnamed series rows are dropped
   - corrections are applied via the CORRECTED-CSV merge and an explicit CORRECTIONS table below
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = "/Users/joshuaborgnolo/Documents/Matilda/sessions/260828-can-you-extract-the-leaders-net-satisfaction-dat/attachments/bf453691-f6e6-4411-af7e-42c588128961_pasted-text-1.txt";
const NETSAT_CSV = path.join(ROOT, "data", "newspoll-leader-net-satisfaction.csv");

const ENTITY_PREFIX = {
  add18929: "primary",       // -> data/newspoll-primary-vote.csv
  "58efde4b": "tpp",         // -> data/newspoll-two-party-preferred.csv
  "84c388a4": "betterpm",    // -> data/newspoll-better-pm.csv
  "5e5f4c6b": "netsat",      // -> data/newspoll-leader-net-satisfaction.csv (replaced)
};
const OUTFILE = {
  primary: path.join(ROOT, "data", "newspoll-primary-vote.csv"),
  tpp: path.join(ROOT, "data", "newspoll-two-party-preferred.csv"),
  betterpm: path.join(ROOT, "data", "newspoll-better-pm.csv"),
  netsat: NETSAT_CSV,
};
// single remaining divergence vs the corrected source (adjudicated against The Australian, 24-Nov-2019:
// Albanese 38 sat / 42 dissat -> net -4; archive sheet still carries his stale -7). Morrison 8 Nov 2020
// net +32 checked: archive already correct here.
const CORRECTIONS = [{ chart: "netsat", leader: "anthony_albanese", iso: "2019-11-24", to: -4 }];
const DATE_FIXES = { "24/02/2109": "2019-02-24" };

const warnings = [];

// ---- 1. locate and parse window.infographicData -------------------------------
const html = fs.readFileSync(SRC, "utf8");
const STARTMARK = "window.infographicData = {";
const start = html.indexOf(STARTMARK);
if (start < 0) throw new Error("infographicData marker not found");
const jsonStart = start + "window.infographicData = ".length;
{
}
let depth = 0, inStr = false, esc = false, end = -1;
for (let i = jsonStart; i < html.length; i++) {
  const c = html[i];
  if (esc) { esc = false; continue; }
  if (c === "\\") { esc = true; continue; }
  if (c === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error("unbalanced infographicData object");
const obj = JSON.parse(html.slice(jsonStart, end));

// collect entities by id
const entities = {};
(function walk(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return;
  for (const [k, v] of Object.entries(o)) {
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(k) && v && typeof v === "object" && Array.isArray(v.data)) {
      entities[k] = v;
    }
    if (typeof v === "object") walk(v);
  }
})(obj);

// ---- 2. helpers ---------------------------------------------------------------
function snake(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function normLeader(name) {
  const s = snake(name);
  if (/^kevin_rudd_\d$/.test(s)) return "kevin_rudd"; // merge PM-stint splits
  return s;
}
function toIso(dmy) {
  if (DATE_FIXES[dmy]) return DATE_FIXES[dmy];
  const m = String(dmy).replace(/\s+/g, "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) { warnings.push(`unparseable date: ${JSON.stringify(dmy)}`); return null; }
  const [, d, mo, y] = m;
  const yr = Number(y);
  if (yr < 1985 || yr > 2025) warnings.push(`date out of range: ${dmy}`);
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function toNum(v, ctx) {
  if (v === "" || v == null) return null;
  const s = String(v).replace(/\s+/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (Number.isNaN(n)) { warnings.push(`non-numeric value (${ctx}): ${JSON.stringify(v)}`); return null; }
  return n;
}

// blocks -> { dates:Set, series: Map<leader, Map<iso,value>> } in first-appearance column order
function parseChart(ent) {
  const series = new Map();
  const dateSet = new Set();
  // walk blocks oldest-first so columns are in chronological first-appearance order
  const blocks = [...ent.data].sort(
    (a, b) => toIso(a[0][1] ?? "31/12/9999").localeCompare(toIso(b[0][1] ?? "31/12/9999")),
  );
  for (const blk of blocks) {
    const header = blk[0] ?? [];
    const dates = header.slice(1).map(toIso);
    for (const row of blk.slice(1)) {
      if (!row || !Array.isArray(row)) continue;
      const label = row[0];
      if (label == null || String(label).trim() === "") {
        const filled = row.slice(1).filter((x) => x != null && String(x).trim() !== "");
        if (filled.length) warnings.push(`dropping unnamed series with ${filled.length} non-blank values`);
        continue;
      }
      const leader = normLeader(label);
      if (!series.has(leader)) series.set(leader, new Map());
      const recs = series.get(leader);
      let filled = 0;
      row.slice(1).forEach((v, i) => {
        const iso = dates[i];
        const n = toNum(v, `${label} @${iso ?? "bad-date"}`);
        if (iso == null || n == null) return;
        dateSet.add(iso);
        if (recs.has(iso) && recs.get(iso) !== n) {
          warnings.push(`collision ${leader} @${iso}: ${recs.get(iso)} vs ${n} (${String(label)})`);
          return; // keep first
        }
        recs.set(iso, n);
        filled++;
      });
      if (!filled) warnings.push(`series "${label}" -> "${leader}": no values`);
    }
  }
  const dates = [...dateSet].sort();
  return { dates, series };
}

function writeCsv(out, dates, series, cols) {
  const lines = ["date," + cols.join(",")];
  for (const d of dates) {
    lines.push(d + "," + cols.map((c) => series.get(c)?.get(d) ?? "").join(","));
  }
  fs.writeFileSync(out, lines.join("\n") + "\n");
  return cols;
}

// ---- 3. extract the four charts ------------------------------------------------
const charts = {};
for (const [prefix, name] of Object.entries(ENTITY_PREFIX)) {
  const id = Object.keys(entities).find((k) => k.startsWith(prefix));
  if (!id) throw new Error(`entity for ${name} (${prefix}) not found`);
  charts[name] = parseChart(entities[id]);
}

// explicit corrections
for (const c of CORRECTIONS) {
  const recs = charts[c.chart].series.get(c.leader);
  if (!recs) { warnings.push(`correction target missing: ${c.chart}/${c.leader}`); continue; }
  const before = recs.get(c.iso);
  recs.set(c.iso, c.to);
  console.log(`correction applied: ${c.chart} ${c.leader} @${c.iso}: ${before} -> ${c.to}`);
}

// ---- 4. merge corrected net-satisfaction CSV (2019+ values override archive) ----
{
  const csvLines = fs.readFileSync(NETSAT_CSV, "utf8").trim().split("\n");
  const cols = csvLines[0].split(",").slice(1);
  // guard: the corrected source is the 2019-01-28..2024-06-30 window CSV committed at HEAD. If the file
  // has already been extended with archive history (i.e. this script ran before), merging is unsafe —
  // restore it from git first: git checkout HEAD -- data/newspoll-leader-net-satisfaction.csv
  if (!cols.includes("bill_shorten") || csvLines.length > 120) {
    throw new Error(
      `${NETSAT_CSV} does not look like the corrected 2019-2024 window CSV ` +
        `(${csvLines.length - 1} rows, header "${csvLines[0]}").\n` +
        "Restore it first: git checkout HEAD -- data/newspoll-leader-net-satisfaction.csv",
    );
  }
  const fixed = new Map(); // date -> {leader: val}
  for (const line of csvLines.slice(1)) {
    const [date, ...vals] = line.split(",");
    const rec = {};
    cols.forEach((c, i) => { if (vals[i] !== "") rec[c] = Number(vals[i]); });
    fixed.set(date, rec);
  }
  const arch = charts.netsat;
  const DAY = 86400000;
  const archDates = arch.dates.map(Date.parse);
  let overrides = 0, conflicts = 0;
  for (const [date, rec] of fixed) {
    const t = Date.parse(date);
    // match archive wave within +-4 days (publication-date drift)
    let iso = null;
    for (const a of arch.dates) if (Math.abs(Date.parse(a) - t) <= 4 * DAY) { iso = a; break; }
    for (const [leader, val] of Object.entries(rec)) {
      if (!arch.series.has(leader)) arch.series.set(leader, new Map());
      const recs = arch.series.get(leader);
      if (iso == null) { recs.set(date, val); arch.dates.push(date); continue; }
      if (recs.has(iso)) {
        overrides++;
        if (recs.get(iso) !== val) {
          conflicts++;
          console.log(`override: ${leader} archive ${iso}=${recs.get(iso)} -> corrected ${date}=${val}`);
        }
      } else { recs.set(iso, val); overrides++; }
    }
  }
  arch.dates.sort();
  // column order: existing archive order, then any corrected-CSV-only leaders (peter_dutton)
  const order = [...arch.series.keys()];
  for (const c of cols) if (!order.includes(c)) order.push(c);
  charts.netsat.order = order;
  console.log(`netsat merge: ${overrides} corrected cells applied in overlap, ${conflicts} real conflicts, ${fixed.size}-wave corrected window`);
}

// ---- 5. write ------------------------------------------------------------------
for (const [name, out] of Object.entries(OUTFILE)) {
  const { dates, series } = charts[name];
  let order = charts[name].order ?? [...series.keys()];
  if (name === "betterpm") order = [...series.keys()].filter((c) => c !== "uncommitted").concat("uncommitted");
  const cols = writeCsv(out, dates, series, order);
  console.log(`${name}: ${dates.length} waves, ${cols.length} series (${cols.join(", ")})`);
  console.log(`   -> ${path.relative(ROOT, out)}  ${dates[0]} .. ${dates.at(-1)}`);
}
for (const [name, { series }] of Object.entries(charts)) {
  if (!["netsat", "betterpm"].includes(name)) continue;
  for (const [leader, recs] of series) {
    const ds = [...recs.keys()].sort();
    console.log(`${name} ${leader}: ${ds.length} pts, ${ds[0]} -> ${ds.at(-1)}`);
  }
}
console.log("warnings:", warnings.length ? "\n- " + warnings.join("\n- ") : "none");
