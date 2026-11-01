#!/usr/bin/env node
/* calibrate-national.mjs: how far the national polling average sits from the result, by lead time.

   data/polls.json cyclePolls (every federal cycle since 1946; minor parties from the 1990s) and
   elections. For each cycle since 1972 and each lead-time band, the mean of the polls in the band
   is compared with the result on the logit scale, per party (Labor, Coalition, Greens, One
   Nation, others). Estimated:
     sigma[party][band]   RMS error (one value per cycle; small samples, so bands are pooled
                          across parties by a scale model below)
     corr                 correlation of the five parties' final-month errors (cycles with all five)
     fade                 minor-party mean reversion: logit(result) - logit(poll) regressed on
                          logit(poll) - logit(previous result), per band (Greens, One Nation,
                          others pooled), i.e. how much of a surge since the last election fades
     govt                 the government's mean error by band (does it recover by election day?)
   Writes the `national` block of data/seat-model-calibration.json. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const P = JSON.parse(readFileSync("data/polls.json", "utf8"));
const logit = (p) => Math.log(p / (1 - p));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const BANDS = [["final month", 0, 35], ["1-4 months", 35, 120], ["4-8 months", 120, 240], ["8-13 months", 240, 400], ["13-20 months", 400, 600]];
const PARTIES = ["alp", "lnp", "grn", "onp", "oth"];
const elecByYear = {};
for (const e of Object.values(P.elections)) elecByYear[e.date.slice(0, 4)] = e;
const years = Object.keys(elecByYear).sort();
const share = (r, k) => {
  if (k !== "oth") return r[k];
  if (r.oth != null) return r.oth + (r.ind || 0);
  const s = ["alp", "lnp", "grn", "onp"].reduce((a, q) => a + (r[q] || 0), 0);
  return 100 - s;
};
const rows = [];
for (const c of Object.keys(P.cyclePolls).sort()) {
  if (+c < 1972) continue;
  const R = elecByYear[c]; if (!R) continue;
  const prevY = years[years.indexOf(c) - 1], prev = prevY ? elecByYear[prevY] : null;
  const T = new Date(R.date).getTime();
  const polls = P.cyclePolls[c].filter((r) => !(r.isElection || /^(election|election result)$/i.test(r.firm || r.pollster || "") || /exit/i.test(r.firm || "")));
  // government = winner of the previous election on the two-party vote
  const govt = prev ? (prev.tpp_alp > 50 ? "alp" : "lnp") : null;
  for (const [band, a, b] of BANDS) {
    const w = polls.filter((r) => { const d = (T - new Date(r.date).getTime()) / 864e5; return d >= a && d < b; });
    if (w.length < 3) continue;
    for (const k of PARTIES) {
      const xs = w.map((r) => share(r, k)).filter((x) => x != null && x > 0);
      if (xs.length < 3) continue;
      const pm = mean(xs), res = share(R, k), pr = prev ? share(prev, k) : null;
      if (!(pm > 0.5 && res > 0.5)) continue;
      rows.push({ c: +c, band, k, poll: pm, res, prev: pr, e: logit(res / 100) - logit(pm / 100), govt: govt === k ? 1 : (govt && (k === "alp" || k === "lnp") ? -1 : 0) });
    }
  }
}
const out = { sigma: {}, bias: {}, n: {} };
console.log("RMS error of the poll mean v the result, logit (cycles):");
for (const [band] of BANDS) {
  const line = [];
  for (const k of PARTIES) {
    const e = rows.filter((r) => r.band === band && r.k === k).map((r) => r.e);
    if (!e.length) continue;
    (out.sigma[k] = out.sigma[k] || {})[band] = +Math.sqrt(mean(e.map((x) => x * x))).toFixed(3);
    (out.bias[k] = out.bias[k] || {})[band] = +mean(e).toFixed(3);
    (out.n[k] = out.n[k] || {})[band] = e.length;
    line.push(`${k} ${Math.sqrt(mean(e.map((x) => x * x))).toFixed(3)} (bias ${mean(e) >= 0 ? "+" : ""}${mean(e).toFixed(3)}, n ${e.length})`);
  }
  console.log(`  ${band.padEnd(13)} ${line.join(" | ")}`);
}
// final-month error correlation across parties (cycles with all five)
const fm = {}; for (const r of rows.filter((r) => r.band === "final month")) (fm[r.c] = fm[r.c] || {})[r.k] = r.e;
const full = Object.values(fm).filter((o) => PARTIES.every((k) => o[k] != null));
const corr = {};
for (const a of PARTIES) for (const b of PARTIES) {
  if (a >= b) continue;
  const xa = full.map((o) => o[a]), xb = full.map((o) => o[b]);
  const ma = mean(xa), mb = mean(xb);
  const cv = mean(xa.map((x, i) => (x - ma) * (xb[i] - mb))), sa = Math.sqrt(mean(xa.map((x) => (x - ma) ** 2))), sb = Math.sqrt(mean(xb.map((x) => (x - mb) ** 2)));
  corr[a + "-" + b] = +(cv / (sa * sb)).toFixed(2);
}
out.corrFinalMonth = { cycles: full.length, ...corr };
// majors-only correlation over all cycles (more data)
const mj = Object.values(fm).filter((o) => o.alp != null && o.lnp != null);
{ const xa = mj.map((o) => o.alp), xb = mj.map((o) => o.lnp), ma = mean(xa), mb = mean(xb);
  out.corrFinalMonth.alpLnpAllCycles = +(mean(xa.map((x, i) => (x - ma) * (xb[i] - mb))) / Math.sqrt(mean(xa.map((x) => (x - ma) ** 2)) * mean(xb.map((x) => (x - mb) ** 2)))).toFixed(2);
  out.corrFinalMonth.alpLnpCycles = mj.length; }
console.log("\nfinal-month error correlations: " + JSON.stringify(out.corrFinalMonth));
// minor-party fade: e = -lambda * surge, surge = logit(poll) - logit(previous result)
out.fade = {};
for (const [band] of BANDS) {
  const rs = rows.filter((r) => r.band === band && ["grn", "onp", "oth"].includes(r.k) && r.prev > 0.5);
  if (rs.length < 8) continue;
  const xs = rs.map((r) => logit(r.poll / 100) - logit(r.prev / 100)), ys = rs.map((r) => r.e);
  const mx = mean(xs), my = mean(ys);
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const res = ys.map((y, i) => y - my - b * (xs[i] - mx)), s2 = res.reduce((a, r) => a + r * r, 0) / (rs.length - 2);
  const se = Math.sqrt(s2 / xs.reduce((a, x) => a + (x - mx) ** 2, 0));
  out.fade[band] = { lambda: +(-b).toFixed(3), se: +se.toFixed(3), intercept: +(my - b * mx).toFixed(3), n: rs.length, residSD: +Math.sqrt(s2).toFixed(3),
    onCases: rows.filter((r) => r.band === band && r.k === "onp" && r.prev > 0.5).map((r) => `${r.c}: ${r.prev.toFixed(1)}->poll ${r.poll.toFixed(1)}->${r.res.toFixed(1)}`) };
  console.log(`fade ${band.padEnd(13)} lambda ${(-b).toFixed(3)} (se ${se.toFixed(3)}, n ${rs.length}) — share of a minor party's logit surge since the last election that is gone by election day`);
}
// government recovery
out.govt = {};
for (const [band] of BANDS) {
  const g = rows.filter((r) => r.band === band && r.govt === 1).map((r) => r.e), o = rows.filter((r) => r.band === band && r.govt === -1).map((r) => r.e);
  if (g.length < 5) continue;
  const sd = Math.sqrt(mean(g.map((x) => (x - mean(g)) ** 2)));
  out.govt[band] = { govtMean: +mean(g).toFixed(3), oppMean: +mean(o).toFixed(3), se: +(sd / Math.sqrt(g.length)).toFixed(3), n: g.length };
  console.log(`government ${band.padEnd(13)} mean ${mean(g) >= 0 ? "+" : ""}${mean(g).toFixed(3)} (se ${(sd / Math.sqrt(g.length)).toFixed(3)}), opposition ${mean(o) >= 0 ? "+" : ""}${mean(o).toFixed(3)} logit, n ${g.length}`);
}
const path = "data/seat-model-calibration.json";
const cal = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
cal.national = { _about: "calibrate-national.mjs: the poll mean in each lead-time band v the result, logit scale, federal cycles 1972-2025 (minor parties where polled). sigma = RMS; bias = mean (result - polls); fade = minor parties' surge mean reversion; govt = government party's mean error.", bands: BANDS.map(([b, a, c]) => ({ band: b, fromDays: a, toDays: c })), ...out };
writeFileSync(path, JSON.stringify(cal, null, 1) + "\n");
console.log("\nwrote " + path + " (national)");
