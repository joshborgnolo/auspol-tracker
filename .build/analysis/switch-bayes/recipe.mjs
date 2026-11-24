/* The recipe the model replaces, copied from gen-data (§5b goRateRows /
   onRateRows through nowcastPts + weightedWithSe with SPARSE_K: six-week
   window, 14-day half-life, cosine taper from 28 days, a house's m waves
   in the window counting √m, each table weighted by its group's n, no
   house adjustment). Cells are the closed rows the model reads (gen-data's
   rates use the raw cells; the two differ only where RedBridge prints an
   undecided cell). */
import { SW_KEYS } from "./readings.mjs";

const HL_DEFF = 1.6, LN2 = Math.log(2);
const SW = 42, SH = 14, ST = 28;
const weight = (d) => Math.exp(-LN2 * d / SH) * (d <= ST ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - ST) / (SW - ST))));
function weightedWithSe(pts) {
  let sw = 0, sw2 = 0, swx = 0;
  for (const p of pts) { sw += p.w; sw2 += p.w * p.w; swx += p.w * p.x; }
  if (!sw) return null;
  const mean = swx / sw, nEff = (sw * sw) / sw2;
  const wVar = pts.reduce((t, p) => t + p.w * (p.x - mean) ** 2, 0) / sw;
  const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
  const pq = (mean / 100) * (1 - mean / 100) * 1e4;
  const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * HL_DEFF * pq / p.n, 0)) / sw;
  const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
  return { v: mean, n: pts.length, se, nEff };
}
/* tables published (pub) on or before `asOf` (default: all), read at day ref */
export function recipeAt(tables, c, ref, share2025, asOf = Infinity) {
  const rows = tables.filter((t) => t.pub <= asOf);
  const out = {};
  for (const k of SW_KEYS) {
    const pts = [], waves = new Map();
    for (const t of rows) {
      const d = ref - t.day;
      if (d < 0 || d > SW) continue;
      waves.set(t.house, (waves.get(t.house) || 0) + 1);
      const n = t.n * share2025[c] / 100;
      pts.push({ w: n * weight(d), x: t.rows[c][k], n, house: t.house });
    }
    for (const p of pts) p.w /= Math.sqrt(waves.get(p.house));
    const r = weightedWithSe(pts);
    out[k] = r ? { v: r.v, se: r.se, ci: 1.96 * r.se, n: r.n } : null;
  }
  return out;
}
export const recipeNow = (tables, c, t1, share2025) => recipeAt(tables, c, t1, share2025);
