// shared helpers for the seat-model design-review experiments (read-only on the committed maps/data/res-*.json stores and data/polls.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// repo root = four levels up (design-review -> seat-model -> analysis -> .build -> root); reads committed stores only
export const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => sum(a) / a.length;
export const logit = (p) => Math.log(Math.max(p, 1e-4) / (1 - Math.max(p, 1e-4)));
export const ilogit = (x) => 1 / (1 + Math.exp(-x));
export const BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"];

// per-division shares (0..1) by bucket, plus notional prior-election base from the printed swing column
export function divRows(data) {
  return data.divs.map((dv, idx) => {
    const tot = sum(dv.c.map((c) => c[4]));
    const sh = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
    const base = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
    let baseKnown = true;
    for (const c of dv.c) {
      const s = c[4] / tot;
      sh[c[3]] += s;
      if (c[5] == null) baseKnown = false;
      base[c[3]] += s - (c[5] ?? 0) / 100;
    }
    const w = dv.c.find((c) => c[6] === 1);
    return { idx, name: dv.n, st: dv.st, cls: dv.cls, tot, sh, base, baseKnown, winner: w && w[3], winnerCode: w && w[1], demo: dv.demo, c: dv.c, tcp: dv.tcp, fl: dv.fl };
  });
}

// booth table: lat/lon/district index/formal/shares by bucket
export function boothRows(data) {
  const B = data.booths, out = [];
  for (let i = 0; i < B.id.length; i++) {
    const dv = data.divs[B.d[i]];
    const v = B.v[i];
    if (!v) continue;
    const tot = sum(v);
    if (tot <= 0 || B.lat[i] == null) continue;
    const sh = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
    v.forEach((x, j) => { const c = dv.c[j]; if (c) sh[c[3]] += x / tot; });
    out.push({ d: B.d[i], st: dv.st, lat: B.lat[i], lon: B.lon[i], tot, sh, ty: B.ty[i] });
  }
  return out;
}

export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return R * Math.sqrt(x * x + y * y);
}

// ridge regression with an unpenalised intercept; X rows are arrays; returns {b0, b, predict}
export function ridge(X, y, w, lambda) {
  const n = X.length, p = X[0].length;
  const W = w || new Array(n).fill(1);
  const sw = sum(W);
  const mx = Array.from({ length: p }, (_, j) => sum(X.map((r, i) => W[i] * r[j])) / sw);
  const sx = Array.from({ length: p }, (_, j) => Math.sqrt(sum(X.map((r, i) => W[i] * (r[j] - mx[j]) ** 2)) / sw) || 1);
  const my = sum(y.map((v, i) => W[i] * v)) / sw;
  const Z = X.map((r) => r.map((v, j) => (v - mx[j]) / sx[j]));
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const c = new Array(p).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) {
    c[j] += W[i] * Z[i][j] * (y[i] - my);
    for (let k = 0; k < p; k++) A[j][k] += W[i] * Z[i][j] * Z[i][k];
  }
  for (let j = 0; j < p; j++) A[j][j] += lambda * sw / n;
  const bz = solve(A, c);
  const b = bz.map((v, j) => v / sx[j]);
  const b0 = my - sum(b.map((v, j) => v * mx[j]));
  return { b0, b, predict: (r) => b0 + sum(r.map((v, j) => v * b[j])) };
}
export function solve(A, c) {
  const n = c.length, M = A.map((r, i) => [...r, c[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k <= n; k++) M[r][k] -= f * M[i][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// find logit shift c so that weighted mean of ilogit(x + c) equals target
export function logitShift(xs, ws, target) {
  let lo = -10, hi = 10;
  for (let it = 0; it < 100; it++) {
    const mid = (lo + hi) / 2;
    const m = sum(xs.map((x, i) => ws[i] * ilogit(x + mid))) / sum(ws);
    if (m < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
export const mae = (a, b) => mean(a.map((x, i) => Math.abs(x - b[i])));
export const rmse = (a, b) => Math.sqrt(mean(a.map((x, i) => (x - b[i]) ** 2)));
export function corr(a, b) { const ma = mean(a), mb = mean(b); const c = sum(a.map((x, i) => (x - ma) * (b[i] - mb))); return c / Math.sqrt(sum(a.map((x) => (x - ma) ** 2)) * sum(b.map((x) => (x - mb) ** 2))); }
