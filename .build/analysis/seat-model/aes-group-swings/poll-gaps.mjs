#!/usr/bin/env node
/* poll-gaps.mjs: each party's graduate gap in the polls' education crosstabs (data/demographics.json) against
   the AES 2025's (aes-cells.json), the election baseline no poll carries.

   Gap = logit(share among graduates) - logit(share among everyone else). Polls cut education into three to five
   bands; the bands outside university are combined with the 2021 Census's adult mix (persons 15+, national:
   TAFE or trade = advanced diploma + certificates; school only = everyone without a non-school qualification),
   a poll's two school bands taking half each, and DemosAU's MRP undergraduate / postgraduate bands by the
   Census's bachelor v postgraduate + graduate diploma counts. A band label not mapped below stops the script.

   Windows, as calibrate-education.mjs: early = fielded to 31 Oct 2025 (each house's first post-election
   crosstabs), late = the vote layer's window (data/seat-vote-layer.json diagnostics.recentWindow.from).
   A house's MRP and pooled releases count with its polls. Each window's gap is the mean of its waves' gaps.

   Run from the repo root:
     node .build/analysis/seat-model/aes-group-swings/poll-gaps.mjs > .build/analysis/seat-model/aes-group-swings/out/poll-gaps.txt
   seats-education.mjs imports pollGaps(). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const logit = (p) => Math.log(p / (1 - p));
export const PARTIES = ["alp", "lnp", "grn", "onp"];
export const EARLY_TO = "2025-10-31";

export function pollGaps() {
  const D = J("data/demographics.json"), V = J("data/seat-vote-layer.json"), C = J("data/census-2021-divisions-2025.json");
  const AES = JSON.parse(fs.readFileSync(path.join(HERE, "aes-cells.json"), "utf8")).waves["2025"];
  const lateFrom = V.diagnostics.recentWindow.from;
  const t = {}; let p15 = 0;
  for (const d of C.divisions) { p15 += d.persons15Plus; for (const k in d.education15Plus) t[k] = (t[k] || 0) + d.education15Plus[k]; }
  const vet = t.advDiploma + t.cert34 + t.cert12, pg = t.postgrad + t.gradDipCert, ug = t.bachelor, school = p15 - vet - pg - ug - t.nfd;
  const W = { vet: vet / (vet + school), school: school / (vet + school), ug: ug / (ug + pg), pg: pg / (ug + pg) };
  const BAND = {
    University: ["deg", 1], Undergraduate: ["deg", W.ug], Postgraduate: ["deg", W.pg],
    TAFE: ["vet", 1], "TAFE or trade": ["vet", 1], "Trade Cert.": ["vet", 1], "TAFE or college": ["vet", 1],
    School: ["school", 1], "No tertiary": ["school", 1], "High School": ["school", 1], "Year 12 or less": ["school", 1],
    "Below Year 12": ["school", 0.5], "Year 12": ["school", 0.5], "Less than year 12": ["school", 0.5],
  };
  const gapOf = (w) => {
    const acc = {};
    for (const [band, row] of Object.entries(w.dims.education)) {
      const b = BAND[band]; if (!b) throw new Error(`poll-gaps: unmapped education band "${band}" (${w.pollster} ${w.date})`);
      for (const p of PARTIES) { if (row[p] == null) continue; const a = (acc[p] = acc[p] || { deg: [0, 0], vet: [0, 0], school: [0, 0] }); a[b[0]][0] += b[1] * row[p]; a[b[0]][1] += b[1]; }
    }
    const o = {};
    for (const p of PARTIES) {
      const a = acc[p]; if (!a || !a.deg[1] || (!a.vet[1] && !a.school[1])) return null;
      const m = (k) => a[k][0] / a[k][1], uni = m("deg") / 100;
      const non = (a.vet[1] && a.school[1] ? W.vet * m("vet") + W.school * m("school") : a.vet[1] ? m("vet") : m("school")) / 100;
      if (!(uni > 0 && non > 0)) return null;
      o[p] = { uni, non, g: logit(uni) - logit(non) };
    }
    return o;
  };
  const aes = Object.fromEntries(PARTIES.map((p) => [p, { uni: AES.deg["1"][p], non: AES.deg["0"][p], g: logit(AES.deg["1"][p]) - logit(AES.deg["0"][p]) }]));
  const byHouse = {};
  for (const w of D.waves.filter((x) => x.dims?.education)) {
    const g = gapOf(w); if (!g) continue;
    const h = w.pollster.replace(/ \(MRP\)| \(pooled\)/, "");
    (byHouse[h] = byHouse[h] || []).push({ date: w.date, release: w.pollster, g });
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const houses = Object.entries(byHouse).map(([house, ws]) => {
    ws.sort((a, b) => (a.date < b.date ? -1 : 1));
    const early = ws.filter((w) => w.date <= EARLY_TO), late = ws.filter((w) => w.date >= lateFrom);
    const win = (arr) => (arr.length ? Object.fromEntries(PARTIES.map((p) => [p, mean(arr.map((w) => w.g[p].g))])) : null);
    return { house, waves: ws, early: win(early), late: win(late), nEarly: early.length, nLate: late.length };
  });
  const across = (f) => Object.fromEntries(PARTIES.map((p) => {
    const v = houses.map((h) => f(h, p)).filter((x) => x != null);
    const m = v.length ? mean(v) : null, sd = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : null;
    return [p, { mean: m, sd, houses: v.length }];
  }));
  return {
    weights: W, lateFrom, earlyTo: EARLY_TO, aes, houses,
    lateVsAes: across((h, p) => (h.late ? h.late[p] - aes[p].g : null)),
    earlyVsAes: across((h, p) => (h.early ? h.early[p] - aes[p].g : null)),
    lateVsEarly: across((h, p) => (h.late && h.early ? h.late[p] - h.early[p] : null)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const R = pollGaps(), f = (x) => (x == null ? "  -  " : (x >= 0 ? "+" : "") + x.toFixed(2)), pct = (x) => (100 * x).toFixed(1);
  console.log(`Band weights (2021 Census, persons 15+): outside university, TAFE or trade ${R.weights.vet.toFixed(2)}, school only ${R.weights.school.toFixed(2)}; MRP undergraduate ${R.weights.ug.toFixed(2)}, postgraduate ${R.weights.pg.toFixed(2)}`);
  console.log(`AES 2025, graduates / everyone else (gap, logit): ` + PARTIES.map((p) => `${p} ${pct(R.aes[p].uni)}/${pct(R.aes[p].non)} (${f(R.aes[p].g)})`).join("  "));
  console.log(`\nEach house's waves (graduate gap, logit):`);
  for (const h of R.houses) {
    console.log(`  ${h.house}`);
    for (const w of h.waves) console.log(`    ${w.date}${w.release !== h.house ? " " + w.release.slice(h.house.length).trim() : ""}`.padEnd(30) + PARTIES.map((p) => `${p} ${pct(w.g[p].uni)}/${pct(w.g[p].non)} ${f(w.g[p].g)}`).join("  "));
  }
  console.log(`\nWindow means, and the change from the AES 2025 (early = to ${R.earlyTo}, late = from ${R.lateFrom}):`);
  for (const h of R.houses) console.log(`  ${h.house.padEnd(18)} early (${h.nEarly}) ` + PARTIES.map((p) => `${p} ${h.early ? f(h.early[p]) + " Δ" + f(h.early[p] - R.aes[p].g) : "-"}`).join("  ") + `\n  ${"".padEnd(18)} late  (${h.nLate}) ` + PARTIES.map((p) => `${p} ${h.late ? f(h.late[p]) + " Δ" + f(h.late[p] - R.aes[p].g) : "-"}`).join("  "));
  const line = (lab, o) => console.log(`  ${lab.padEnd(34)}` + PARTIES.map((p) => `${p} ${f(o[p].mean)} (sd ${o[p].sd == null ? "-" : o[p].sd.toFixed(2)}, ${o[p].houses})`).join("  "));
  console.log(`\nAcross houses (mean, sd across houses, houses):`);
  line("late minus AES 2025", R.lateVsAes);
  line("early minus AES 2025", R.earlyVsAes);
  line("late minus early (same house)", R.lateVsEarly);
}
