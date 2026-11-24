/* The vote-switching tables as the model reads them – the same wave set and
   the same closed rows gen-data §5b builds (onSourceWaves' filter: every
   2025 group printed, an MRP reusing its house's waves out; switchFlows'
   closed(): und/dnr dropped, ind and community-strong cells into oth, each
   row closed to 100, YouGov's ind and oth rows folded at their 2025
   weights). Standalone so the backtest and the fake-data check can replay
   it without running gen-data. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const SW_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const HL_DEFF = 1.6, SAMPLE_CAP = 3000;
const day = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 86400000);

export function loadTables({ root = ROOT } = {}) {
  const D = JSON.parse(fs.readFileSync(path.join(root, "data", "polls.json"), "utf8"));
  const POLLS = D.polls.filter((p) => !p.isElection);
  const VS = JSON.parse(fs.readFileSync(path.join(root, "data", "vote-switching.json"), "utf8"));
  const W = VS.weights2025;
  const byKey = new Map(POLLS.map((p) => [p.date + "|" + p.pollster, p]));
  const reusesWaves = (p) => {
    const house = /\(MRP\)$/.test(p.pollster || "") && p.dateStart ? p.pollster.replace(/ \(MRP\)$/, "") : null;
    return !!house && POLLS.some((q) => q.pollster === house && (q.dateStart || q.date) >= p.dateStart && q.date <= p.date);
  };
  const rowN = (p) => (p && p.sampleEff != null) ? p.sampleEff * HL_DEFF : Math.min((p && p.sample) || 1200, SAMPLE_CAP);
  const share2025 = { alp: W.alp, lnp: W.lnp, grn: W.grn, onp: W.onp, oth: W.ind + W.oth };
  const colOf = (k) => (k === "und" || k === "dnr" ? null : SW_KEYS.includes(k) ? k : "oth");
  const closed = (r) => {
    if (!r) return null;
    const o = Object.fromEntries(SW_KEYS.map((k) => [k, 0]));
    for (const [k, v] of Object.entries(r)) { const c = colOf(k); if (c && Number.isFinite(v)) o[c] += v; }
    const s = SW_KEYS.reduce((t, k) => t + o[k], 0);
    return s > 0 ? Object.fromEntries(SW_KEYS.map((k) => [k, (100 * o[k]) / s])) : null;
  };
  const tables = [];
  const skipped = [];
  for (const w of VS.waves) {
    const p = byKey.get(w.date + "|" + w.pollster);
    if (p && reusesWaves(p)) { skipped.push([w.date, w.pollster, "reuses waves"]); continue; }
    const R = w.rows || {};
    const rows = Object.fromEntries(["alp", "lnp", "grn", "onp"].map((g) => [g, closed(R[g])]));
    if (R.ind) {
      const a = closed(R.ind), b = closed(R.oth);
      rows.oth = a && b ? Object.fromEntries(SW_KEYS.map((k) => [k, (W.ind * a[k] + W.oth * b[k]) / (W.ind + W.oth)])) : null;
    } else rows.oth = closed(R.oth);
    if (SW_KEYS.some((g) => !rows[g])) { skipped.push([w.date, w.pollster, "incomplete"]); continue; }
    const s = day(w.dateStart || w.date), e = day(w.date);
    tables.push({ key: w.date + "|" + w.pollster, house: w.pollster, date: w.date, dateStart: w.dateStart,
      start: s, end: e, day: Math.round((s + e) / 2), pub: p && p.published ? day(p.published) : e + 1,
      n: rowN(p || { sample: w.sample }), sample: w.sample, raw: R, rows, read: w.read });
  }
  tables.sort((a, b) => a.day - b.day || a.key.localeCompare(b.key));
  return { tables, skipped, W, share2025, POLLS };
}
