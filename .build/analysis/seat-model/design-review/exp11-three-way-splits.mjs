// E11: can three-way splits and later-round flows be built from pairwise flows (the Luce / "renormalise over
// whoever is left" assumption of W5 and of exp4b/exp9)? Tested directly on the 2025 Senate ballots
// (data/senate-rankings-2025.json, every formal ballot's order of Labor A, Coalition C, Greens G, One Nation O).
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
const J = JSON.parse(fs.readFileSync(path.join(ROOT, "data/senate-rankings-2025.json"), "utf8"));
const P = J.patterns, SUB = J.subClass;
const add = (a, b) => { for (const [k, n] of Object.entries(b || {})) a[k] = (a[k] || 0) + n; return a; };
function tab(cohort, st) {
  const out = {};
  for (const d of Object.values(J.divisions)) {
    if (st && d.st !== st) continue;
    for (const [c, t] of Object.entries(d.t)) {
      const k = c.startsWith("OTH:") ? ["OTH", "OTH-" + (SUB[c.slice(4)] || "M")] : c.startsWith("COAL") ? ["COAL"] : [c];
      if (k.includes(cohort)) add(out, t);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([i, n]) => [P[+i], n]));
}
const pair = (t, x, y) => { let a = 0, b = 0; for (const [p, n] of Object.entries(t)) { const ix = p.indexOf(x), iy = p.indexOf(y); if (ix < 0 && iy < 0) continue; if (iy < 0 || (ix >= 0 && ix < iy)) a += n; else b += n; } return a / (a + b); };
const first = (t, xs) => { const c = Object.fromEntries(xs.map((x) => [x, 0])); for (const [p, n] of Object.entries(t)) { let best = null, bi = 9; for (const x of xs) { const i = p.indexOf(x); if (i >= 0 && i < bi) { bi = i; best = x; } } if (best) c[best] += n; } const s = Object.values(c).reduce((a, b) => a + b, 0); return Object.fromEntries(xs.map((x) => [x, c[x] / s])); };
console.log("=== A. Donor excluded with Labor, Coalition and ON all still in: share naming each first of the three ===");
console.log("donor  state | actual A / C / O   | from pairs (Luce) A / C / O | max gap");
const gaps = [];
for (const c of ["GRN", "OTH", "OTH-R", "OTH-M", "OTH-L"]) for (const st of [null, "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"]) {
  const t = tab(c, st); if (!Object.keys(t).length) continue;
  const f = first(t, ["A", "C", "O"]), ac = pair(t, "A", "C"), ao = pair(t, "A", "O");
  const wC = (1 - ac) / ac, wO = (1 - ao) / ao, T = 1 + wC + wO, L = { A: 1 / T, C: wC / T, O: wO / T };
  const g = Math.max(...["A", "C", "O"].map((k) => Math.abs(f[k] - L[k]))); gaps.push(g);
  if (!st || c === "GRN" || c === "OTH") console.log(`${c.padEnd(6)} ${(st || "AUS").padEnd(5)} | ${["A", "C", "O"].map((k) => (100 * f[k]).toFixed(1).padStart(5)).join(" ")} | ${["A", "C", "O"].map((k) => (100 * L[k]).toFixed(1).padStart(5)).join(" ")}         | ${(100 * g).toFixed(1)}`);
}
console.log(`  all donor x state cases: mean max-gap ${(100 * gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)} pts, worst ${(100 * Math.max(...gaps)).toFixed(1)}`);
console.log("\n=== B. Path dependence: ballots passed on through one party, then that party is excluded ===");
for (const [via, x, y, label] of [["C", "A", "O", "via the Coalition, Labor ahead of ON"], ["A", "C", "O", "via Labor, Coalition ahead of ON"]]) {
  console.log(`  ${label}:`);
  for (const c of ["GRN", "OTH", "OTH-R", "OTH-M", "OTH-L"]) {
    const t = tab(c, null), sub = {};
    for (const [p, n] of Object.entries(t)) { const f = first({ [p]: 1 }, ["A", "C", "O"]); if (f[via] === 1) sub[p] = n; }
    console.log(`    ${c.padEnd(6)} those ballots ${(100 * pair(sub, x, y)).toFixed(1)} | all the donor's ballots (what an origin-tracking Luce count uses) ${(100 * pair(t, x, y)).toFixed(1)}`);
  }
}
