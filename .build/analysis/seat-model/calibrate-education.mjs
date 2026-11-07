#!/usr/bin/env node
/* calibrate-education.mjs: does the realignment's swing differ by education beyond what a logit swing
   from each seat's 2025 vote already implies?

   Within-house difference in differences, as vote-layer.mjs does for age and gender: each pollster's
   earliest post-election education crosstabs (fielded to 31 Oct 2025) against its own recent ones (the
   vote layer's window), on the logit gap between graduates and everyone else, per party. (No wave
   before the 2025 election carries education, and estimating the 2025 vote by education from seat
   results instead exaggerates the gradients - ecological inference put One Nation at 0.5% of 2025
   graduates - so that route was tried and dropped.)

   The change in each party's gap is then applied to the seats as a logit term proportional to their
   university share, re-solved to the national nowcast, and the seat-level difference it makes is
   reported. Writes the `education` block of data/seat-model-calibration.json. The model adds no fixed
   education term when the effect is within its random education shock (seat-engine: SD 0.06 logit per
   SD of university share) and the houses disagree by about as much as the estimate. */
import { readFileSync, writeFileSync } from "node:fs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const D = J("data/demographics.json"), V = J("data/seat-vote-layer.json"), R = J("map/data/res-2025.json");
const P = ["alp", "lnp", "grn", "onp"];
const EARLY_TO = "2025-10-31", LATE_FROM = V.diagnostics.recentWindow.from;
const isUni = (k) => /univ|undergrad|postgrad|degree|bachelor/i.test(k) && !/no |less/i.test(k);
const gap = (w) => {
  const e = w.dims.education, ks = Object.keys(e), uk = ks.filter(isUni), nk = ks.filter((k) => !isUni(k));
  if (!uk.length || !nk.length) return null;
  const o = {};
  for (const p of P) {
    const pu = uk.reduce((a, k) => a + (e[k][p] ?? 0), 0) / uk.length / 100, pn = nk.reduce((a, k) => a + (e[k][p] ?? 0), 0) / nk.length / 100;
    if (pu <= 0 || pn <= 0) return null;
    o[p] = logit(pu) - logit(pn);
  }
  return o;
};
const byHouse = {};
for (const w of D.waves.filter((w) => w.dims?.education)) { const g = gap(w); if (g) (byHouse[w.pollster.replace(/ \(MRP\)| \(pooled\)/, "")] = byHouse[w.pollster.replace(/ \(MRP\)| \(pooled\)/, "")] || []).push({ date: w.date, g }); }
const houses = [], change = Object.fromEntries(P.map((p) => [p, []]));
for (const [h, ws] of Object.entries(byHouse)) {
  const early = ws.filter((w) => w.date <= EARLY_TO), late = ws.filter((w) => w.date >= LATE_FROM);
  if (!early.length || !late.length) continue;
  const m = (arr, p) => arr.reduce((a, w) => a + w.g[p], 0) / arr.length;
  const row = { house: h, early: early.map((w) => w.date), late: late.length };
  for (const p of P) { row[p] = +(m(late, p) - m(early, p)).toFixed(3); change[p].push({ d: m(late, p) - m(early, p), n: Math.min(early.length, late.length) }); }
  houses.push(row);
}
const est = {};
for (const p of P) {
  const t = change[p].reduce((a, x) => a + x.n, 0);
  const mean = t ? change[p].reduce((a, x) => a + x.n * x.d, 0) / t : 0;
  const spread = Math.sqrt(change[p].reduce((a, x) => a + (x.d - mean) ** 2, 0) / Math.max(1, change[p].length - 1));
  est[p] = { gapChange: +mean.toFixed(3), spreadAcrossHouses: +spread.toFixed(3) };
}
const seats = R.divs.map((d) => { const t = d.c.reduce((a, c) => a + c[4], 0); const sh = {}; for (const p of P) sh[p] = d.c.filter((c) => c[3] === p).reduce((a, c) => a + c[4], 0) / t; return { n: d.n, w: t, u: d.demo.uni, sh }; });
const W = seats.reduce((a, s) => a + s.w, 0), ubar = seats.reduce((a, s) => a + s.w * s.u, 0) / W;
const target = { alp: V.national.nowcast.alp / 100, lnp: V.national.nowcast.lnp / 100, grn: V.national.nowcast.grn / 100, onp: V.national.nowcast.on / 100 };
const solve = (xs, t) => { let c = 0; for (let it = 0; it < 60; it++) { let f = 0, d = 0; xs.forEach((x, i) => { const q = ilogit(x + c); f += seats[i].w * q; d += seats[i].w * q * (1 - q); }); const g = f / W - t; if (Math.abs(g) < 1e-10) break; c -= g / (d / W); } return c; };
for (const p of P) {
  const xa = seats.map((s) => logit(Math.max(s.sh[p], 0.003))), ca = solve(xa, target[p]);
  const xb = seats.map((s, i) => xa[i] + est[p].gapChange * (s.u - ubar)), cb = solve(xb, target[p]);
  const diff = seats.map((s, i) => 100 * (ilogit(xb[i] + cb) - ilogit(xa[i] + ca)));
  const ord = seats.map((s, i) => [s.n, +diff[i].toFixed(2)]).sort((a, b) => a[1] - b[1]);
  est[p].seatEffect = { meanAbsPts: +(diff.reduce((a, x) => a + Math.abs(x), 0) / diff.length).toFixed(2), mostNegative: ord.slice(0, 3), mostPositive: ord.slice(-3).reverse() };
  console.log(`${p}: graduate gap change ${est[p].gapChange >= 0 ? "+" : ""}${est[p].gapChange} logit (houses spread ${est[p].spreadAcrossHouses}); seat effect mean |${est[p].seatEffect.meanAbsPts}| pts, largest ${ord.slice(-1)[0][0]} ${ord.slice(-1)[0][1]}, ${ord[0][0]} ${ord[0][1]}`);
}
const path = "data/seat-model-calibration.json";
const cal = J(path);
cal.education = { _about: "calibrate-education.mjs: within-house change in each party's logit gap between graduates and the rest, earliest post-election crosstabs (to 2025-10-31) v the vote layer's window; seat effect = that change applied in proportion to each seat's university share, re-solved to the nowcast. No fixed term is added: One Nation's and the Greens' surges spread by education as the logit swing implies, and Labor's and the Coalition's changes are worth at most ~1.5 pts in the most extreme seats, within the model's random education shock, with the houses disagreeing by about as much.", earlyTo: EARLY_TO, lateFrom: LATE_FROM, houses, estimate: est };
writeFileSync(path, JSON.stringify(cal, null, 1) + "\n");
console.log("wrote " + path + " (education)");
