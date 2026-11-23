/* approval v favourability: combine or split? */
import fs from "node:fs";
import { fitSettings, predictAll, runFilter, smooth } from "./leader-model.mjs";
import { ratingSeries } from "./series.mjs";
import { GRID_R } from "./fit.mjs";
const J = JSON.parse(fs.readFileSync(new URL("./readings.json", import.meta.url)));
const cur = J.ratings.filter((r) => r.day >= 20211);
const mk = (o) => { const s = ratingSeries(J.ratings, o); const st = fitSettings(s, GRID_R); return { s, st, P: new Map(predictAll(s, st.best, st.kappa).map((p) => [p.raw.rid, p])) }; };
const comb = mk({ metrics: ["approval", "fav"] }), appr = mk({ metrics: ["approval"] }), fav = mk({ metrics: ["fav"] });
const two = (() => { const s = ratingSeries(J.ratings, { twoLine: true }); const st = fitSettings(s, GRID_R, { grid2: { kf: [0.35, 0.5, 0.7, 1], rho: [0, 0.4, 0.7, 0.85, 0.95] } }); console.log("two-line best", JSON.stringify(st.best), "edges", st.edges.join(",") || "-", "top", st.rows.slice(0, 6).map((r) => r.th.kf + "/" + r.th.rho + ":" + r.w.toFixed(2)).join(" ")); return { s, st, P: new Map(predictAll(s, st.best, st.kappa).map((p) => [p.raw.rid, p])) }; })();
const mae = (ids, F) => { const e = ids.map((i) => F.P.get(i)).filter((p) => p && !p.lone).map((p) => Math.abs(p.mu - p.y) * 100); return (e.reduce((a, b) => a + b, 0) / e.length).toFixed(2) + " (n " + e.length + ")"; };
const aIds = cur.filter((r) => r.metric === "approval").map((r) => r.rid), fIds = cur.filter((r) => r.metric === "fav").map((r) => r.rid);
const both = (ids, A, B) => ids.filter((i) => A.P.get(i) && !A.P.get(i).lone && B.P.get(i) && !B.P.get(i).lone);
console.log("2025– approval readings: combined", mae(both(aIds, comb, appr), comb), " approval-only", mae(both(aIds, comb, appr), appr), " two-line", mae(both(aIds, comb, appr), two));
console.log("2025– favourability readings: combined", mae(both(fIds, comb, fav), comb), " favourability-only", mae(both(fIds, comb, fav), fav), " two-line", mae(both(fIds, comb, fav), two));
const cov = (ids, F) => { const z = ids.map((i) => F.P.get(i)).filter((p) => p && !p.lone).map((p) => Math.abs(p.y - p.mu) / Math.sqrt(p.S)); return (100 * z.filter((q) => q < 1.96).length / z.length).toFixed(1) + "%"; };
console.log("95% cover approval/fav readings: combined", cov(aIds, comb), cov(fIds, comb), " separate", cov(aIds, appr), cov(fIds, fav), " two-line", cov(aIds, two), cov(fIds, two));
for (const role of ["pm", "opp", "han"]) {
  const A = cur.filter((r) => r.role === role && r.metric === "approval").map((r) => r.rid), F = cur.filter((r) => r.role === role && r.metric === "fav").map((r) => r.rid);
  console.log(`  ${role}: approval readings comb ${mae(both(A, comb, appr), comb)} v appr-only ${mae(both(A, comb, appr), appr)} v two ${mae(both(A, comb, appr), two)} | fav readings comb ${mae(both(F, comb, fav), comb)} v fav-only ${mae(both(F, comb, fav), fav)} v two ${mae(both(F, comb, fav), two)}`);
}
/* Resolve asks both questions of the same leader in one poll */
const res = J.ratings.filter((r) => r.house === "Resolve" && r.metric === "approval");
const lik = new Map(J.ratings.filter((r) => r.house === "Resolve (likeability)").map((r) => [r.date + "|" + r.person, r]));
const pairs = res.map((r) => [r, lik.get(r.date + "|" + r.person)]).filter(([, l]) => l);
const byP = {}; for (const [a, l] of pairs) (byP[a.person] = byP[a.person] || []).push(l.net - a.net);
for (const [p, d] of Object.entries(byP)) console.log(`Resolve likeability − performance net, ${p}: n ${d.length}, mean ${(d.reduce((x, y) => x + y, 0) / d.length).toFixed(1)}, range ${Math.min(...d)}..${Math.max(...d)}`);
/* do the two questions move together? smoothed levels of the separate fits, per leader: 2-month changes */
const lvl = (F, id) => {
  const S = F.s.find((x) => x.id === id); if (!S) return null;
  const days = []; for (let d = Math.max(S.t0, 20211) + 30; d <= S.t1; d += 30) days.push(d);
  const events = [...new Set([...S.obs.map((o) => o.t), ...days])].sort((a, b) => a - b);
  const f = runFilter(S, F.st.best, F.st.kappa, { store: true, events }); const sm = smooth(f, S);
  return new Map(days.map((d) => [d, sm.xs[events.indexOf(d) * S.N] * 100]));
};
for (const id of [...new Set(cur.filter((r) => r.metric === "fav").map((r) => r.series))]) {
  const a = lvl(appr, id), b = lvl(fav, id); if (!a || !b) continue;
  const ds = [...a.keys()].filter((d) => b.has(d) && a.has(d - 60) && b.has(d - 60));
  if (ds.length < 3) continue;
  const xa = ds.map((d) => a.get(d) - a.get(d - 60)), xb = ds.map((d) => b.get(d) - b.get(d - 60));
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length, ma = m(xa), mb = m(xb);
  const r = xa.reduce((s, x, i) => s + (x - ma) * (xb[i] - mb), 0) / Math.sqrt(xa.reduce((s, x) => s + (x - ma) ** 2, 0) * xb.reduce((s, x) => s + (x - mb) ** 2, 0));
  console.log(`${id}: 2-month changes of separate fits, r = ${r.toFixed(2)} (${ds.length} pts); approval ${xa.map((x) => x.toFixed(0)).join(" ")} | fav ${xb.map((x) => x.toFixed(0)).join(" ")}`);
}
