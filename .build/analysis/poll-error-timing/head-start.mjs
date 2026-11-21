/* How much of a term's polling-day miss is already in its early polls?
   g' = early-term estimate − opening count − honeymoon(gov/opp), regressed on
   e = polling-day miss, lane intercepts. Slope = w0 (share of the final miss
   present at the start). Bootstrap over terms. Start windows: 45, 90, 180 days. */
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));
const LN2 = Math.log(2), HE_WINDOW = 28, SHRINK_K = 1.5, HE_HALF = 90;
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const ddays = (a, b) => (a - b) / 86400000;
const K = (win, half, taper) => ({ window: win, weight: (d) => Math.exp(-LN2 * d / half) * (d <= taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - taper) / (win - taper)))) });
const HEAD = K(21, 7, 14), SPARSE = K(42, 14, 28);
function houseEffectsFor(rows) {
  const devs = [];
  for (const a of rows) { let sw = 0, swx = 0, k = 0;
    for (const b of rows) { if (b === a || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW || b.firm === a.firm) continue; sw += b.n; swx += b.n * b.x; k++; }
    if (k >= 3) devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw }); }
  const by = {}; for (const d of devs) (by[d.firm] ||= []).push(d);
  return { at: (firm, t) => { let sw = 0, swx = 0; for (const d of by[firm] || []) { if (d.mid > t) continue; const w = Math.exp(-LN2 * ddays(t, d.mid) / HE_HALF); sw += w; swx += w * d.dev; } return sw ? (sw / (sw + SHRINK_K)) * (swx / sw) : 0; } };
}
function nowcast(rows, he, ref, k) { const pts = [], waves = new Map();
  for (const a of rows) { const d = ddays(ref, a.mid); if (d < 0 || d > k.window) continue; waves.set(a.firm, (waves.get(a.firm) || 0) + 1); pts.push({ w: a.n * k.weight(d), x: a.x - he.at(a.firm, ref), firm: a.firm }); }
  let sw = 0, swx = 0; for (const p of pts) { p.w /= Math.sqrt(waves.get(p.firm)); sw += p.w; swx += p.w * p.x; } return sw ? swx / sw : null; }
// plain window mean from day a to day b after the election (house-debiased)
function windowMean(rows, he, t0, a, b) { const rs = rows.filter((r) => { const d = ddays(r.mid, t0); return d >= a && d <= b; }); if (!rs.length) return null;
  const waves = new Map(); for (const r of rs) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
  let sw = 0, swx = 0; for (const r of rs) { const w = r.n / Math.sqrt(waves.get(r.firm)); sw += w; swx += w * (r.x - he.at(r.firm, r.mid)); } return swx / sw; }
const GOV = { 1969: "lnp", 1972: "alp", 1974: "alp", 1975: "lnp", 1977: "lnp", 1980: "lnp", 1983: "alp", 1984: "alp", 1987: "alp", 1990: "alp", 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const ELS = Object.entries(D.elections).map(([k, e]) => ({ y: +k.slice(1), ...e, T: Date.parse(e.date) })).sort((a, b) => a.T - b.T);
const firmOf = (p) => p.firm || p.pollster || "";
const isPoll = (p) => !/^(election|election result)$/i.test(firmOf(p)) && !/exit/i.test(firmOf(p));
const val = (p, k) => (k === "rest" ? (p.alp != null && p.lnp != null ? 100 - p.alp - p.lnp : null) : p[k]);
const resOf = (e, k) => (k === "rest" ? 100 - e.alp - e.lnp : e[k]);
const LANES = ["alp", "lnp", "rest"];
const WINS = [["d3–45", 3, 45], ["d3–90", 3, 90], ["d60–180", 60, 180], ["d3–180", 3, 180]];
const obs = []; // {term, lane, gov, e, g:{win}}
for (let i = 1; i < ELS.length; i++) { const o = ELS[i - 1], c = ELS[i]; if (c.y < 1975) continue;
  const src = D.cyclePolls[String(c.y)]; if (!src) continue;
  const polls = src.filter(isPoll).filter((p) => { const t = Date.parse(p.date); return t > o.T && t <= c.T; });
  for (const k of LANES) {
    const rows = polls.filter((p) => val(p, k) != null).map((p) => ({ mid: midMs(p), x: val(p, k), n: Math.min(p.sample || 1200, 3000), firm: firmOf(p) }));
    const he = houseEffectsFor(rows);
    const end = nowcast(rows, he, c.T, HEAD); if (end == null) continue;
    const g = {}; for (const [nm, a, b] of WINS) { const m = windowMean(rows, he, o.T, a, b); g[nm] = m == null ? null : m - resOf(o, k); }
    obs.push({ term: c.y, open: o.y, lane: k, W: k === "rest" ? 0 : (GOV[o.y] === k ? 1 : -1), e: end - resOf(c, k), g, years: ddays(c.T, o.T) / 365.25 });
  }
}
// OLS g = a_lane + h*W + w0*e
function fit(rs, win) {
  const X = rs.map((r) => [r.lane === "alp" ? 1 : 0, r.lane === "lnp" ? 1 : 0, r.lane === "rest" ? 1 : 0, r.W, r.e]);
  const y = rs.map((r) => r.g[win]);
  const p = 5, XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((s, r, q) => s + r[i] * y[q], 0));
  const inv = invert(XtX); return inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
}
function invert(M) { const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) { let pv = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[pv][i])) pv = r; [A[i], A[pv]] = [A[pv], A[i]];
    const d = A[i][i]; for (let j = 0; j < 2 * n; j++) A[i][j] /= d; for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i]; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[i][j]; } }
  return A.map((r) => r.slice(n)); }
const f = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
for (const from of [1975, 1987]) for (const [win] of WINS) {
  const rs = obs.filter((r) => r.open >= from && r.g[win] != null);
  const b = fit(rs, win);
  const terms = [...new Set(rs.map((r) => r.term))]; let seed = 5; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bs = []; for (let i = 0; i < 3000; i++) { const pick = terms.map(() => terms[Math.floor(rnd() * terms.length)]).flatMap((t) => rs.filter((r) => r.term === t)); try { const bb = fit(pick, win); if (Number.isFinite(bb[4])) bs.push(bb[4]); } catch {} }
  bs.sort((x, y) => x - y);
  console.log(`opening ${from}+  window ${win.padEnd(8)} n=${rs.length} (${terms.length} terms)  w0 = ${f(b[4])}  [90% ${f(bs[Math.floor(bs.length * 0.05)])} .. ${f(bs[Math.floor(bs.length * 0.95)])}]  honeymoon ${f(b[3])}  lane intercepts alp ${f(b[0])} lnp ${f(b[1])} rest ${f(b[2])}`);
}
