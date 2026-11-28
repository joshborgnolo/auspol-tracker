// Does the pandemic's churn force every wave to be read as noisy? Let the walk
// move kv times faster between March 2020 and the end of 2021.
import fs from "node:fs";
const dir = new URL("./", import.meta.url).pathname;
let body = fs.readFileSync(dir + "proto.mjs", "utf8"); body = body.slice(0, body.indexOf("const base ="))
  .replace('hs.forEach((h, i) => (P[i + 1][i + 1] = 1.0 ** 2));', 'hs.forEach((h, i) => (P[i + 1][i + 1] = (h === "anupoll-lia" ? 0.25 : 1) ** 2));')
  .replace("P[0][0] += k * th.w ** 2 +", "P[0][0] += (k + (th.kv * th.kv - 1) * Math.max(0, Math.min(t, DAY('2021-12-31')) - Math.max(prev, PAN))) * th.w ** 2 +");
body += `
const O = obs.filter((o) => o.h !== "hilda" && o.h !== "scanlon"), houses = [...new Set(O.map((o) => o.h))];
const g = { w: [0.002, 0.003, 0.005, 0.008, 0.012, 0.018, 0.027], dl: [0, 0.0005, 0.001, 0.002, 0.004], tau: [0, 0.03, 0.06, 0.1, 0.15, 0.2], jp: [0, 0.15, 0.3, 0.5] };
for (const kvs of [[1], [2], [3], [5], [1, 2, 3, 5]]) {
  const pts = [...grid({ ...g, kv: kvs })].map((th) => ({ ...th, b: {} }));
  const post = (n) => { const ls = pts.map((th) => run(O, houses, th, n).ll); const m = Math.max(...ls); const w = ls.map((l) => Math.exp(l - m)); const z = w.reduce((a, c) => a + c); return { w: w.map((q) => q / z), ev: m + Math.log(z / pts.length) }; };
  const f = post(O.length);
  const marg = (k) => { const o = {}; pts.forEach((p, i) => (o[p[k]] = (o[p[k]] || 0) + f.w[i])); return Object.entries(o).sort((a, c) => +a[0] - +c[0]).map(([a, c]) => a + ":" + c.toFixed(2)).join(" "); };
  let n = 0, em = 0, el = 0, cov = 0, lp = 0;
  for (let k = 6; k < O.length; k++) {
    const o = O[k], last = O.slice(0, k).filter((q) => q.h === o.h).pop(); if (!last) continue;
    const pw = post(k).w; let mu = 0; const comp = [];
    pts.forEach((th, i) => { if (pw[i] < 1e-5) return; const r = run(O, houses, th, k, o); mu += pw[i] * r.mu; comp.push([pw[i], r.mu, r.S]); });
    const vr = comp.reduce((a, [w, m, S]) => a + w * (S + (m - mu) ** 2), 0);
    n++; em += Math.abs(o.y - mu); el += Math.abs(o.y - last.y); cov += Math.abs(o.y - mu) < 1.96 * Math.sqrt(vr);
    lp += Math.log(comp.reduce((a, [w, m, S]) => a + w * Math.exp(-0.5 * (o.y - m) ** 2 / S) / Math.sqrt(2 * Math.PI * S), 0));
  }
  console.log("kv", JSON.stringify(kvs), "ev", f.ev.toFixed(2), "| backtest n", n, "model", (em / n).toFixed(3), "last", (el / n).toFixed(3), "cover", cov + "/" + n, "logpred", lp.toFixed(2));
  console.log("    w", marg("w"), "| tau", marg("tau"), "| jp", marg("jp"), kvs.length > 1 ? "| kv " + marg("kv") : "", "| dl", marg("dl"));
}
`;
fs.writeFileSync(dir + ".vol-run.mjs", body.replace('new URL("../../../data', 'new URL("file://' + new URL("../../../", import.meta.url).pathname + 'data'));
await import("./.vol-run.mjs"); fs.unlinkSync(dir + ".vol-run.mjs");
