/* lib.mjs: shared readers for the 2025 group poll-error analysis (group-error.mjs, education-split.mjs,
   house-baselines.mjs). Read-only; every path is resolved from the repo root, so the scripts run from anywhere.

   - releases(): bludgertrack-2022-25.json grouped into releases (one house, one fieldwork span), each with its
     all-voters baseline, its cells normalised to decided voters, and the partition checks that catch a garbled
     release.
   - gapOf(): a cell's gap from its release's all voters, with a binomial variance (times the house's design
     effect) plus the rounding of the two printed figures.
   - actual(): the 2025 House first-preference count by nation, state and AEC demographic class.
   - aes(): aes-cuts.json. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..", "..");
export const J = (f) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), "utf8"));
export const K = ["alp", "lnp", "grn", "onp", "oth"];
export const ELECTION = "2025-05-03";
export const FINAL_FROM = "2025-03-29"; // fieldwork ending in the last 35 days: calibrate-national.mjs's "final month"
export const PRE_FROM = "2024-07-01", PRE_TO = "2025-03-28"; // the nine months before it
export const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS"];
export const DIM = {
  Male: "gender", Female: "gender",
  "Age 18-34": "age", "Age 35-49": "age", "Age 50-64": "age", "Age 65+": "age",
  "No tertiary": "education", "TAFE/Tech": "education", University: "education",
  "Up to $50k": "income", "$50k-$99k": "income", "$100k-$150k": "income", "$150k+": "income",
  "Full time": "work", "Part time": "work", Retired: "work", Other: "work",
  "Own outright": "housing", Mortgage: "housing", Rent: "housing",
  "Inner Metropolitan": "region", "Outer Metropolitan": "region", Provincial: "region", Rural: "region",
  "English only": "language", LOTE: "language", Christian: "religion", "No religion": "religion",
  NSW: "state", VIC: "state", QLD: "state", WA: "state", SA: "state", TAS: "state",
};
export const ORDER = Object.keys(DIM);
export const HOUSE = {
  YouGov: "YouGov", Newspoll: "Newspoll", "RedBridge Group": "RedBridge", "Accent/RedBridge": "RedBridge",
  "Resolve Strategic": "Resolve", "Essential Research": "Essential", DemosAU: "DemosAU",
  "Freshwater Strategy": "Freshwater", "Roy Morgan": "Roy Morgan", "POLIS@ANU": "POLIS", "Wolf & Smith": "Wolf & Smith",
};
const ROUND_V = 1 / 12; // variance of a figure printed to the nearest point

/* a poll cell as decided voters' shares; One Nation and others only where the house printed One Nation */
export function sharesOf(r) {
  if (r.alp == null || r.lnp == null) return null;
  const d = r.und > 0 ? (100 - r.und) / 100 : 1;
  const s = { alp: r.alp / d, lnp: r.lnp / d, grn: r.grn == null ? null : r.grn / d, onp: r.onp == null ? null : r.onp / d };
  s.oth = s.grn != null && s.onp != null ? 100 - s.alp - s.lnp - s.grn - s.onp : null;
  return s;
}

/* implied Labor 2PP of a cell from its primaries, for the consistency check against a printed 2PP */
const FLOW = { grn: 0.86, onp: 0.35, oth: 0.47 };
export const implied2pp = (s) => (s.grn == null || s.onp == null ? null : s.alp + FLOW.grn * s.grn + FLOW.onp * s.onp + FLOW.oth * s.oth);

export function releases() {
  const B = J(".build/analysis/group-poll-error-2025/bludgertrack-2022-25.json").rows;
  const map = new Map(), dupes = [];
  for (const r of B) {
    const house = HOUSE[r.pollster];
    if (!house) continue; // the 2022 election rows and YouGov's MRP
    const key = `${house}|${r.start}|${r.end}`;
    const R = map.get(key) || { house, pollster: r.pollster, start: r.start, end: r.end, rows: {} };
    if (R.rows[r.scope]) dupes.push(`${key} ${r.scope}`); else R.rows[r.scope] = r;
    map.set(key, R);
  }
  const out = [];
  for (const R of map.values()) {
    const nat = R.rows.NAT;
    const g = ["Male", "Female"].map((x) => R.rows[x]).filter((x) => x && x.n && sharesOf(x));
    if (nat && sharesOf(nat)) R.all = { s: sharesOf(nat), n: nat.n, from: "national row", rv: ROUND_V };
    else if (g.length === 2) {
      const N = g[0].n + g[1].n, a = sharesOf(g[0]), b = sharesOf(g[1]);
      R.all = { s: Object.fromEntries(K.map((k) => [k, a[k] == null || b[k] == null ? null : (g[0].n * a[k] + g[1].n * b[k]) / N])), n: N, from: "men + women", rv: ROUND_V / 2 };
    } else R.all = null;
    // partition sizes per dim, against the release's sample
    R.part = {};
    for (const [scope, r] of Object.entries(R.rows)) {
      const dim = DIM[scope];
      if (!dim || !r.n) continue;
      R.part[dim] = (R.part[dim] || 0) + r.n;
    }
    R.flags = [];
    if (R.all) for (const dim of ["gender", "age"]) if (R.part[dim] && Math.abs(R.part[dim] / R.all.n - 1) > 0.1) R.flags.push(`${dim} cells sum to ${R.part[dim]} of n ${R.all.n}`);
    R.cells = {};
    for (const [scope, r] of Object.entries(R.rows)) {
      const dim = DIM[scope];
      if (!dim) continue;
      const s = sharesOf(r);
      if (!s || !r.n) continue;
      const cell = { scope, dim, n: r.n, s, flags: [] };
      const imp = implied2pp(s);
      if (r.alp2 != null && imp != null && Math.abs(imp - r.alp2) > 4) cell.flags.push(`primaries imply 2PP ${imp.toFixed(1)}, printed ${r.alp2}`);
      if (s.oth != null && s.oth < -0.5) cell.flags.push(`others ${s.oth.toFixed(1)}`);
      R.cells[scope] = cell;
    }
    out.push(R);
  }
  out.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.house < b.house ? -1 : 1));
  return { list: out, dupes };
}

/* gap of a cell from its release's all voters, points, with variance (deff × binomial + rounding) */
export function gapOf(R, cell, deff = 1) {
  if (!R.all) return null;
  const N = R.part[cell.dim] && R.part[cell.dim] / R.all.n > 0.85 ? R.part[cell.dim] : R.all.n;
  const f = Math.min(cell.n / N, 0.95), nR = Math.max(N - cell.n, 1);
  const out = {};
  for (const k of K) {
    const a = cell.s[k], t = R.all.s[k];
    if (a == null || t == null) { out[k] = null; continue; }
    const pg = Math.min(Math.max(a / 100, 0.5 / cell.n), 1 - 0.5 / cell.n);
    const pr = Math.min(Math.max((t / 100 - f * pg) / (1 - f), 0.5 / nR), 1 - 0.5 / nR);
    const v = 1e4 * (1 - f) ** 2 * (pg * (1 - pg) / cell.n + pr * (1 - pr) / nR);
    out[k] = { gap: a - t, v: deff * v + ROUND_V + R.all.rv, v1: v + ROUND_V + R.all.rv };
  }
  return out;
}

function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}

/* 2025 House first preferences: shares by NAT, state and AEC class (Inner Metropolitan …) */
export function actual() {
  const PARTY = { ALP: "alp", LP: "lnp", LNP: "lnp", NP: "lnp", CLP: "lnp", GRN: "grn", ON: "onp" };
  const CLASS = { inner: "Inner Metropolitan", outer: "Outer Metropolitan", provincial: "Provincial", rural: "Rural" };
  const cls = Object.fromEntries(J("data/aec-2025-division-class.json").divisions.map((d) => [d.name, CLASS[d.class]]));
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, ".build/aec-flow-src/booth/oracle/fpvvt-2025.csv.gz"))).toString("utf8").split(/\r?\n/).slice(1).filter(Boolean);
  const h = splitCsv(lines[0]), I = (n) => h.indexOf(n);
  const acc = {};
  const add = (key, k, v) => { const a = (acc[key] = acc[key] || { formal: 0, alp: 0, lnp: 0, grn: 0, onp: 0, oth: 0 }); a[k] += v; a.formal += v; };
  for (const line of lines.slice(1)) {
    const c = splitCsv(line);
    if (!c[I("PartyAb")] && c[I("PartyNm")] === "Informal") continue;
    const k = PARTY[c[I("PartyAb")]] || "oth", v = +c[I("TotalVotes")];
    add("NAT", k, v); add(c[I("StateAb")], k, v);
    const cl = cls[c[I("DivisionNm")]];
    if (!cl) throw new Error(`actual(): no AEC class for ${c[I("DivisionNm")]}`);
    add(cl, k, v);
  }
  return Object.fromEntries(Object.entries(acc).map(([key, a]) => [key, { formal: a.formal, ...Object.fromEntries(K.map((k) => [k, (100 * a[k]) / a.formal])) }]));
}

export const aes = () => J(".build/analysis/group-poll-error-2025/aes-cuts.json");

/* inverse-variance pool of {y, v}; Q heterogeneity */
export function pool(obs) {
  const o = obs.filter((x) => x && x.v > 0 && Number.isFinite(x.y));
  if (!o.length) return null;
  const W = o.reduce((s, x) => s + 1 / x.v, 0);
  const y = o.reduce((s, x) => s + x.y / x.v, 0) / W;
  const q = o.reduce((s, x) => s + (x.y - y) ** 2 / x.v, 0);
  return { y, v: 1 / W, q, df: o.length - 1, k: o.length };
}

export const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? "  –  " : (x >= 0 ? "+" : "") + x.toFixed(d));
