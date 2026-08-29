#!/usr/bin/env -S node --input-type=module
// Validate AEC-2022-derived flow constants against published 2PP series.
// Reads polls.json, computes implied 2PP using { grn, onp, oth } as the
// ALP-side share of each minor-party bucket, then measures per-series mean
// residual.
//
// Constitution of constants (AEC 2022 TCP flow file, Event 27966):
//   GRN → ALP share = 83.71%
//   ON  → ALP share = 35.33%  (so L/NP coefficient 64.67%)
//   IND → ALP share = 58.32%
//   OTH-minus-major-minus-IND → ALP share = 40.79%
//   OTH-incl-IND combined    → 44.30%
//
// Question: which (ind, oth) split minimises |mean implied-vs-published|
// over the houses that publish 2PP?

import fs from "node:fs";

const D = JSON.parse(fs.readFileSync(new URL("../data/polls.json", "file://" + process.argv[1].replace(/\/[^/]+$/, "/x")).href.replace(/\/x$/, "/../data/polls.json"), "utf8"));

const FLOW = {
  grn: 0.8371,
  onp_to_alp: 0.3533,
  ind: 0.5832,
  oth_incl_ind: 0.4430,
  oth_no_ind: 0.4079,
};

const n0 = (v) => (v == null ? 0 : v);

// implied ALP TPP under a given split of (ind, oth)
function implied(p, indShare, othShare) {
  if (p.alp == null) return null;
  const ind = n0(p.ind);
  const oth = n0(p.oth);
  return p.alp
    + FLOW.grn * n0(p.grn)
    + FLOW.onp_to_alp * n0(p.onp)
    + indShare * ind
    + othShare * oth;
}

function rows_with_tpp() {
  return D.polls.filter((p) => !p.isElection && p.tpp_alp != null && p.alp != null);
}

const rows = rows_with_tpp();
console.log(`n = ${rows.length} polls with both primary-ALP and published 2PP\n`);

function eval_split(label, indShare, othShare) {
  const byHouse = new Map();
  for (const p of rows) {
    const im = implied(p, indShare, othShare);
    if (im == null) continue;
    const h = p.pollster;
    if (!byHouse.has(h)) byHouse.set(h, []);
    byHouse.get(h).push(p.tpp_alp - im);
  }
  const errs = [];
  for (const [h, ds] of byHouse) {
    if (ds.length < 5) continue;
    const m = ds.reduce((a, b) => a + b, 0) / ds.length;
    const mad = ds.reduce((a, b) => a + Math.abs(b), 0) / ds.length;
    errs.push({ h, n: ds.length, mean: m, mad });
  }
  errs.sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));
  const overall = errs.length
    ? errs.reduce((a, e) => a + Math.abs(e.mean), 0) / errs.length
    : 0;
  console.log(`── ${label}: ind=${indShare} oth=${othShare} ──`);
  for (const e of errs)
    console.log(`  ${e.h.padEnd(20)} n=${String(e.n).padStart(3)}  mean ${e.mean >= 0 ? "+" : ""}${e.mean.toFixed(2)}   mad ${e.mad.toFixed(2)}`);
  console.log(`  mean |house bias| = ${overall.toFixed(3)}\n`);
  return overall;
}

// A) Placeholder constants (baseline)
eval_split("A) PLACEHOLDER grn=0.82 onp=0.65-to-LNP oth=0.50 ind=0.50", 0.50, 0.50);

// B) AEC constants, IND and OTH split out
eval_split("B) AEC-2022 grn=0.837 onp=0.647-to-LNP ind=0.583 oth=0.408", FLOW.ind, FLOW.oth_no_ind);

// C) AEC constants, IND lumped into OTH (single 'oth' bucket = IND+OTH)
eval_split("C) AEC-2022 grn=0.837 onp=0.647-to-LNP ind+oth→0.443", FLOW.oth_incl_ind, FLOW.oth_incl_ind);
