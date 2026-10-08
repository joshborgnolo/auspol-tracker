#!/usr/bin/env node
/* test-vote-layer.mjs — W4 invariants: data/seat-vote-layer.json must be
   internally consistent with its construction contract.

   Run from the repo root: node .build/analysis/seat-model/test-vote-layer.mjs */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const OUT = "data/seat-vote-layer.json";
const V = JSON.parse(readFileSync(OUT, "utf8"));
const P5 = ["alp", "lnp", "on", "grn", "oth"];
const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};
const sum = (obj) => P5.reduce((s, p) => s + (obj[p] ?? NaN), 0);

// 1. Provenance: inputs named, 16-hex shas match the live files.
check("provenance inputs", Object.keys(V._provenance.inputs).length === 4);
for (const [f, sha] of Object.entries(V._provenance.inputs))
  check(`provenance sha ${f}`,
    createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16) === sha, sha);
check("gen-data capture line", /^primaryNow:/.test(V._provenance.genData.captured));

// 2. National: 5-key sets, each basis sums to ~100, delta is the difference.
for (const p of P5) {
  check(`nowcast has ${p}`, Number.isFinite(V.national.nowcast[p]));
  check(`result2025 has ${p}`, Number.isFinite(V.national.result2025[p]));
  check(`delta(${p}) = nowcast − 2025`,
    Math.abs(V.national.delta[p] - (V.national.nowcast[p] - V.national.result2025[p])) <= 0.02,
    `${V.national.delta[p]} vs ${V.national.nowcast[p] - V.national.result2025[p]}`);
}
check("nowcast sums ~100", Math.abs(sum(V.national.nowcast) - 100) <= 0.4, String(sum(V.national.nowcast)));
check("2025 national sums ~100", Math.abs(sum(V.national.result2025) - 100) <= 0.4, String(sum(V.national.result2025)));
check("nowcast poll count ≥ 1", V.national.nPolls >= 1, String(V.national.nPolls));

// 3. States: weights partition the electorate; state 2025 shares sum ~100;
//    each dev is a finite pp figure with a positive se; devs centred ~0
//    when weighted over the electorate.
const w = V.states.weights;
check("8 state weights", Object.keys(w).length === 8);
check("weights sum to 1", Math.abs(STATE_ORDER.reduce((s, st) => s + w[st], 0) - 1) <= 0.01,
  String(STATE_ORDER.reduce((s, st) => s + w[st], 0)));
for (const st of STATE_ORDER) {
  check(`${st} 2025 shares sum ~100`, Math.abs(sum(V.states.result2025[st]) - 100) <= 0.5,
    String(sum(V.states.result2025[st])));
  for (const p of P5) {
    const d = V.states.dev[st]?.[p];
    check(`${st} ${p} dev present`, d != null);
    if (!d) continue;
    check(`${st} ${p} dev finite, se>0`, Number.isFinite(d.dev) && d.se > 0);
    check(`${st} ${p} dev within ±20pp`, Math.abs(d.dev) <= 20, String(d.dev));
  }
  // composite-covered territories share the composite flag
  if (["TAS", "NT", "ACT"].includes(st))
    for (const p of P5) check(`${st} ${p} compositionOnly`, V.states.dev[st][p].compositionOnly === true);
}
for (const p of P5) {
  const m = STATE_ORDER.reduce((s, st) => s + w[st] * V.states.dev[st][p].dev, 0);
  check(`population-weighted ${p} dev ≈ 0`, Math.abs(m) <= 0.5, String(m));
}

// 4. β: exactly the two estimable dims; cells partition; Σ w_g β_g = 0.
check("beta dims {age, gender}",
  JSON.stringify(Object.keys(V.beta.dims).sort()) === JSON.stringify(["age", "gender"]));
for (const [dim, cells] of Object.entries(V.beta.dims)) {
  const weights = V.beta.populationWeights[dim];
  for (const cell of Object.keys(cells)) {
    check(`${dim}.${cell} has a population weight`, Number.isFinite(weights?.[cell]));
    for (const p of P5) {
      const b = cells[cell]?.[p];
      check(`${dim}.${cell}.${p} present with se>0`, b != null && Number.isFinite(b.beta) && b.se > 0);
      if (b) check(`${dim}.${cell}.${p} β within ±25pp`, Math.abs(b.beta) <= 25, String(b.beta));
    }
  }
  for (const p of P5) {
    const s = Object.entries(cells).reduce((acc, [cell, g]) => acc + weights[cell] * g[p].beta, 0);
    check(`${dim} ${p} Σ wβ = 0`, Math.abs(s) <= 0.02, String(s));
  }
  const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
  check(`${dim} weights sum to 1`, Math.abs(wSum - 1) <= 0.01, String(wSum));
}
check("baseline wave is Resolve 2025-05-03",
  V.beta.baselineWave.pollster === "Resolve" && V.beta.baselineWave.date === "2025-05-03");
check("notEstimable lists the five dims with no May-2025 baseline",
  JSON.stringify([...V.beta.notEstimable].sort())
    === JSON.stringify(["education", "generation", "housing", "income", "location"].sort()));
for (const d of V.beta.notEstimable) check(`${d} not in beta dims`, !(d in V.beta.dims));

// 5. Diagnostics: recent window covers >1 wave; the implied-national diag exists.
check("recent window has waves", V.diagnostics.recentWindow.waves.length >= 3,
  String(V.diagnostics.recentWindow.waves.length));
check("implied-national diagnostics present",
  ["age", "gender"].every((d) => P5.every((p) => Number.isFinite(V.diagnostics.resolveImpliedNational[d][p]))));

if (failures) { console.error(`${failures} failures`); process.exit(1); }
const nDev = STATE_ORDER.length * P5.length;
console.log(`vote layer OK: 5-key national Δ, ${nDev} state deviations, ${Object.keys(V.beta.dims).length} β dims · window ${V.diagnostics.recentWindow.from}→${V.diagnostics.recentWindow.to} (${V.diagnostics.recentWindow.waves.length} waves) · baseline ${V.beta.baselineWave.pollster} ${V.beta.baselineWave.date}`);
