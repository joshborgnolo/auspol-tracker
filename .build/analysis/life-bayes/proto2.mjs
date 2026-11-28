// Follow-ups: HILDA's sensitivity down to zero, election jumps, and the panel-break prior.
import fs from "node:fs";
const src = fs.readFileSync(new URL("./proto.mjs", import.meta.url), "utf8");
let body = src.slice(0, src.indexOf("const base ="))
  .replace('hs.forEach((h, i) => (P[i + 1][i + 1] = 1.0 ** 2));', 'hs.forEach((h, i) => (P[i + 1][i + 1] = (h === "anupoll-lia" ? (th.ps ?? 1) : 1) ** 2));')
  .replace('(prev < PAN && t >= PAN ? th.jp ** 2 : 0)', '(prev < PAN && t >= PAN ? th.jp ** 2 : 0) + ELX.filter((e) => prev < e && t >= e).length * (th.je || 0) ** 2')
  .replace('const PAN =', 'const ELX = ["2004-10-09","2007-11-24","2010-08-21","2013-09-07","2016-07-02","2019-05-18","2022-05-21","2025-05-03"].map(DAY);\nconst PAN =')
  .replace('new URL("../../../data', 'new URL("file://' + new URL("../../../", import.meta.url).pathname + 'data');
body += `
const evid = (O, g, b) => { const houses = [...new Set(O.map((o) => o.h))]; const pts = [...grid(g)].map((th) => ({ ...th, b: b(th) })); const rs = pts.map((th) => run(O, houses, th)); const m = Math.max(...rs.map((r) => r.ll)); const w = rs.map((r) => Math.exp(r.ll - m)); const z = w.reduce((a, c) => a + c); return { ev: m + Math.log(z / pts.length), pts, w: w.map((q) => q / z), rs, houses }; };
const marg = (f, k) => { const o = {}; f.pts.forEach((p, i) => (o[p[k]] = (o[p[k]] || 0) + f.w[i])); return Object.entries(o).sort((a, c) => +a[0] - +c[0]).map(([a, c]) => a + ":" + c.toFixed(2)).join(" "); };
const g0 = { w: [0.003, 0.005, 0.008, 0.012, 0.018, 0.027], dl: [0, 0.0005, 0.001, 0.002, 0.004], tau: [0, 0.03, 0.06, 0.1], jp: [0, 0.15, 0.3, 0.5] };
const h = evid(obs, { ...g0, bh: [-0.1, 0, 0.05, 0.1, 0.25] }, (t) => ({ hilda: t.bh }));
console.log("HILDA sensitivity:", marg(h, "bh"), "| ev", h.ev.toFixed(1));
const no = obs.filter((o) => o.h !== "hilda");
const a = evid(no, g0, () => ({}));
const e = evid(no, { ...g0, je: [0, 0.05, 0.15, 0.3] }, () => ({}));
console.log("no HILDA: ev", a.ev.toFixed(2), "| with election jumps ev", e.ev.toFixed(2), marg(e, "je"));
const nj = evid(no, { ...g0, jp: [0] }, () => ({})); const yj = evid(no, { ...g0, jp: [0.15, 0.3, 0.5] }, () => ({}));
console.log("pandemic jump: without", nj.ev.toFixed(2), "with", yj.ev.toFixed(2));
for (const ps of [[0.1], [0.25], [0.5], [1]]) {
  const f = evid(no, { ...g0, ps }, () => ({}));
  let mu = 0, sq = 0; const i = f.houses.filter((x) => x !== "anupoll").indexOf("anupoll-lia") + 1;
  f.rs.forEach((r, k) => { mu += f.w[k] * r.x[i]; sq += f.w[k] * (r.P[i][i] + r.x[i] ** 2); });
  console.log("panel prior sd", ps[0], "→ LiA reads", mu.toFixed(2), "±", (1.96 * Math.sqrt(sq - mu * mu)).toFixed(2), "above ORU | ev", f.ev.toFixed(2));
}
`;
fs.writeFileSync(new URL("./.proto2-run.mjs", import.meta.url), body);
await import("./.proto2-run.mjs");
