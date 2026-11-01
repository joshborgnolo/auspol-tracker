// E10b: why does the Coalition's own primary predict Coalition->Labor in Labor-v-ON finals?
// Local conservative culture (a pre-election Coalition footprint predicts it too) vs residual-voter selection (retention predicts it).
import { load, boothRows, km, sum, mean, corr } from "./lib.mjs";
const shareOf = (dv, b) => sum(dv.c.filter((c) => c[3] === b).map((c) => c[4])) / sum(dv.c.map((c) => c[4]));
// notional prior-election bucket share for each target district from the nearest prior booths (target-booth-vote weighted)
function footprint(target, prior, st, bucket) {
  const pb = boothRows(prior).filter((b) => (!st || b.st === st) && b.tot >= 30);
  const tb = boothRows(target);
  const acc = target.divs.map(() => [0, 0]);
  for (const b of tb) {
    let best = null, bd = 1e9;
    for (const f of pb) { const d = km(b, f); if (d < bd) { bd = d; best = f; } }
    if (!best || bd > 25) continue;
    acc[b.d][0] += b.tot * best.sh[bucket]; acc[b.d][1] += b.tot;
  }
  return acc.map((a) => (a[1] ? a[0] / a[1] : null));
}
function rowsFor(D, pairWanted, donor, toB, extra) {
  const out = [];
  D.divs.forEach((dv, i) => {
    if (!dv.tcp || dv.tcp.length !== 2) return;
    const pair = dv.tcp.map((t) => dv.c[t[0]][3]);
    if (!(pair.includes(pairWanted[0]) && pair.includes(pairWanted[1]))) return;
    const toIdx = pair.indexOf(toB);
    let a = 0, t = 0;
    for (const f of dv.fl || []) if (dv.c[f[0]][3] === donor) { a += toIdx === 0 ? f[1] : f[2]; t += f[1] + f[2]; }
    if (t < 300) return;
    const r = { name: dv.n, share: a / t, n: t, lnp: shareOf(dv, "lnp"), on: shareOf(dv, "onp"), irsad: dv.seifa?.irsad?.v };
    for (const [k, arr] of Object.entries(extra)) r[k] = arr[i];
    out.push(r);
  });
  return out;
}
function loo(rows, vars, label) {
  const act = rows.map((r) => r.share);
  const res = {};
  for (const v of ["flat", ...vars]) {
    const p = rows.map((r, i) => {
      const rest = rows.filter((_, j) => j !== i);
      const ys = rest.map((x) => x.share), my = mean(ys);
      if (v === "flat") return sum(rest.map((x) => x.share * x.n)) / sum(rest.map((x) => x.n));
      const xs = rest.map((x) => x[v]), mx = mean(xs);
      const b = sum(xs.map((x, j) => (x - mx) * (ys[j] - my))) / sum(xs.map((x) => (x - mx) ** 2));
      return my + b * (r[v] - mx);
    });
    res[v] = (100 * mean(p.map((x, i) => Math.abs(x - act[i])))).toFixed(2);
  }
  console.log(`  ${label} (${rows.length}) LOO MAE: ` + Object.entries(res).map(([k, v]) => `${k} ${v}`).join(" | "));
  console.log(`      corr with share: ` + vars.map((v) => `${v} ${corr(rows.map((r) => r[v]), act).toFixed(2)}`).join(", "));
}
const sa26 = load("map/data/res-sa26.json"), sa22 = load("map/data/res-sa22.json"), fed25 = load("map/data/res-2025.json");
const lib22 = footprint(sa26, sa22, null, "lnp"), libF25 = footprint(sa26, fed25, "SA", "lnp"), on22 = footprint(sa26, sa22, null, "onp");
const sa = rowsFor(sa26, ["alp", "onp"], "lnp", "alp", { lib22, libF25, on22 });
for (const r of sa) { r.retain = r.lnp / r.lib22; r.lost = r.lib22 - r.lnp; }
console.log("SA 2026, Coalition -> Labor in Labor v ON finals: same-election Lib primary vs pre-election footprints vs retention");
loo(sa, ["lnp", "lib22", "libF25", "retain", "lost"], "SA 2026");
console.log("  corr lnp~lib22 " + corr(sa.map((r) => r.lnp), sa.map((r) => r.lib22)).toFixed(2) + ", lnp~retain " + corr(sa.map((r) => r.lnp), sa.map((r) => r.retain)).toFixed(2));
console.log("  detail: " + [...sa].sort((a, b) => a.share - b.share).map((r) => `${r.name} ${(100 * r.share).toFixed(0)} [Lib26 ${(100 * r.lnp).toFixed(0)}, Lib22 ${(100 * r.lib22).toFixed(0)}, keep ${(100 * r.retain).toFixed(0)}%]`).join("; "));
// Qld 2017 with Qld 2015? not on the map; use federal 2016 footprint as the pre-election Coalition footprint
const q17 = load("map/data/res-qld17.json"), fed16 = load("map/data/res-2016.json");
const lnpF16 = footprint(q17, fed16, "QLD", "lnp");
const q = rowsFor(q17, ["alp", "onp"], "lnp", "alp", { lnpF16 });
for (const r of q) { r.retain = r.lnp / r.lnpF16; }
console.log("\nQld 2017, same test (pre-election footprint = federal 2016 LNP vote)");
loo(q, ["lnp", "lnpF16", "retain"], "Qld 2017");
console.log("  detail: " + [...q].sort((a, b) => a.share - b.share).map((r) => `${r.name} ${(100 * r.share).toFixed(0)} [LNP17 ${(100 * r.lnp).toFixed(0)}, F16 ${(100 * r.lnpF16).toFixed(0)}, keep ${(100 * r.retain).toFixed(0)}%]`).join("; "));
// level check: pooled flow vs how far the Coalition fell (statewide)
const pooled = (rows) => sum(rows.map((r) => r.share * r.n)) / sum(rows.map((r) => r.n));
const st = (D, b) => { let a = 0, t = 0; for (const dv of D.divs) { for (const c of dv.c) { t += c[4]; if (c[3] === b) a += c[4]; } } return a / t; };
console.log(`\nLevels: SA26 pooled ${(100 * pooled(sa)).toFixed(1)}% with Lib ${(100 * st(sa26, "lnp")).toFixed(1)} (SA22 ${(100 * st(sa22, "lnp")).toFixed(1)}); Qld17 pooled ${(100 * pooled(q)).toFixed(1)}% with LNP ${(100 * st(q17, "lnp")).toFixed(1)}`);
