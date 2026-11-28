// Prototype: which structure do the life-satisfaction surveys support?
// y = a_s + C + b_s (m - C) + e ; ANUpoll's current panel has a=0, b=1.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(new URL("../../../data/life-satisfaction.json", import.meta.url)));
const C = 7, DEFF = 1.6, SD = { hilda: 1.5, default: 1.9 };
const NDEF = { "anupoll": 3200, "anupoll-lia": 3200, hilda: 15000, "abs-gss": 5000, scanlon: 7000 };
const DAY = (s) => Math.floor(Date.parse(s + "T00:00:00Z") / 864e5);
export const obs = [];
for (const s of d.series) for (const r of s.readings) {
  const h = s.id === "anupoll" && r.panel === "lia" ? "anupoll-lia" : s.id;
  const t = DAY(`${r.date.slice(0, 4)}-${r.date.length > 4 ? r.date.slice(5, 7) : s.midMonth || "07"}-15`);
  obs.push({ t, y: r.v, h, v: DEFF * (SD[h] || SD.default) ** 2 / (r.n || NDEF[h]) + 0.005 ** 2 / 3, date: r.date });
}
obs.sort((a, b) => a.t - b.t);
const PAN = DAY("2020-03-11");
function run(obs, houses, th, upto = obs.length, predictAt = null) {
  const hs = houses.filter((h) => h !== "anupoll"), N = 1 + hs.length;
  let x = new Array(N).fill(0); x[0] = C;
  let P = Array.from({ length: N }, () => new Array(N).fill(0)); P[0][0] = 1;
  hs.forEach((h, i) => (P[i + 1][i + 1] = 1.0 ** 2));
  let ll = 0, prev = null;
  const H = (h) => { const v = new Array(N).fill(0); const b = th.b[h] ?? 1; v[0] = b; if (h !== "anupoll") v[1 + hs.indexOf(h)] = 1; return { v, c: C - b * C }; };
  const step = (t) => { if (prev != null && t > prev) { const k = t - prev; P[0][0] += k * th.w ** 2 + (prev < PAN && t >= PAN ? th.jp ** 2 : 0); for (let i = 1; i < N; i++) P[i][i] += k * th.dl ** 2; } prev = t; };
  const pred = (h, v) => { const { v: hv, c } = H(h); const Ph = P.map((r) => r.reduce((a, p, j) => a + p * hv[j], 0)); const S = hv.reduce((a, q, i) => a + q * Ph[i], v + th.tau ** 2); const mu = hv.reduce((a, q, i) => a + q * x[i], c); return { Ph, S, mu }; };
  for (let k = 0; k < upto; k++) {
    const o = obs[k]; step(o.t);
    const { Ph, S, mu } = pred(o.h, o.v), e = o.y - mu;
    ll += -0.5 * (Math.log(2 * Math.PI * S) + e * e / S);
    for (let i = 0; i < N; i++) x[i] += Ph[i] / S * e;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) P[i][j] -= Ph[i] * Ph[j] / S;
  }
  if (predictAt) { step(predictAt.t); const p = pred(predictAt.h, predictAt.v); return { ll, mu: p.mu, S: p.S }; }
  return { ll, x, P };
}
function* grid(g) { const keys = Object.keys(g); const rec = function* (i, o) { if (i === keys.length) { yield o; return; } for (const v of g[keys[i]]) yield* rec(i + 1, { ...o, [keys[i]]: v }); }; yield* rec(0, {}); }
const base = { w: [0.003, 0.005, 0.008, 0.012, 0.018], dl: [0, 0.0005, 0.001, 0.002, 0.004], tau: [0, 0.03, 0.06, 0.1], jp: [0, 0.15, 0.3, 0.5] };
const B = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5];
const V = {
  "same movement (trust-style)": { g: base, b: () => ({}) },
  "HILDA own sensitivity": { g: { ...base, bh: B }, b: (th) => ({ hilda: th.bh }) },
  "HILDA + GSS own sensitivity": { g: { ...base, bh: B, bg: B }, b: (th) => ({ hilda: th.bh, "abs-gss": th.bg }) },
  "HILDA left out": { g: base, b: () => ({}), drop: "hilda" },
};
for (const [name, v] of Object.entries(V)) {
  const O = v.drop ? obs.filter((o) => o.h !== v.drop) : obs, houses = [...new Set(O.map((o) => o.h))];
  const pts = [...grid(v.g)].map((th) => ({ ...th, b: v.b(th) }));
  const post = (n) => { const ls = pts.map((th) => run(O, houses, th, n).ll); const m = Math.max(...ls); const w = ls.map((l) => Math.exp(l - m)); const z = w.reduce((a, b) => a + b); return { w: w.map((q) => q / z), ev: m + Math.log(z / pts.length) }; };
  const full = post(O.length);
  const marg = (k) => { const o = {}; pts.forEach((p, i) => (o[p[k]] = (o[p[k]] || 0) + full.w[i])); return Object.entries(o).sort((a, b) => +a[0] - +b[0]).map(([a, b]) => `${a}:${b.toFixed(2)}`).join(" "); };
  // one-step-ahead: each reading from those before it, against the survey's own last reading
  const err = {}; let n = 0;
  for (let k = 6; k < O.length; k++) {
    const o = O[k], last = O.slice(0, k).filter((q) => q.h === o.h).pop(); if (!last) continue;
    const pw = post(k).w; let mu = 0, comp = [];
    pts.forEach((th, i) => { if (pw[i] < 1e-5) return; const r = run(O, houses, th, k, o); mu += pw[i] * r.mu; comp.push([pw[i], r.mu, r.S]); });
    const vr = comp.reduce((a, [w, m, S]) => a + w * (S + (m - mu) ** 2), 0);
    const e = err[o.h] ||= { n: 0, m: 0, l: 0, c: 0, lp: 0 };
    e.n++; e.m += Math.abs(o.y - mu); e.l += Math.abs(o.y - last.y); e.c += Math.abs(o.y - mu) < 1.96 * Math.sqrt(vr); e.lp += Math.log(comp.reduce((a, [w, m, S]) => a + w * Math.exp(-0.5 * (o.y - m) ** 2 / S) / Math.sqrt(2 * Math.PI * S), 0));
  }
  console.log(`\n== ${name}: log evidence ${full.ev.toFixed(1)} (${O.length} readings)`);
  for (const k of Object.keys(v.g)) console.log("   ", k, marg(k));
  let T = { n: 0, m: 0, l: 0, c: 0, lp: 0 };
  for (const [h, e] of Object.entries(err)) { for (const q in T) T[q] += e[q]; console.log(`    ${h.padEnd(12)} n=${e.n} model ${(e.m / e.n).toFixed(3)} last ${(e.l / e.n).toFixed(3)} cover ${e.c}/${e.n} logpred ${e.lp.toFixed(1)}`); }
  console.log(`    ALL n=${T.n} model ${(T.m / T.n).toFixed(3)} last ${(T.l / T.n).toFixed(3)} cover ${T.c}/${T.n} logpred ${T.lp.toFixed(1)}`);
}
