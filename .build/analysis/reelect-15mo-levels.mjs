/* throwaway: 15-months-in signature analysis.
   For every completed term: average the polls/leadership readings that fell
   12-18 months after the term opened, split terms by eventual outcome
   (govt re-elected vs ousted at term's end), then place the CURRENT term on
   the 0 (typical ousted profile) .. 1 (typical re-elected profile) axis
   per metric, plus an unweighted composite. Data: origin/main polls.json. */
import { execSync } from "node:child_process";

const D = JSON.parse(execSync("git show origin/main:data/polls.json", { maxBuffer: 1 << 28, encoding: "utf8" }));

// winner of each election (seat winner, NOT tpp winner — 1998 Howard won on 49.0)
const WIN = { 1987: "alp", 1990: "alp", 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp",
  2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const TERMS = Object.keys(WIN).map(Number).sort((a, b) => a - b);
const E = Object.fromEntries(Object.entries(D.elections).map(([k, v]) => [+k.slice(1), v]));

const months = (d, e) => (new Date(d) - new Date(e)) / (30.4375 * 864e5);
const inWin = (d, e) => { const m = months(d, e); return m >= 12 && m <= 18; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const f = (x, d = 1) => x == null ? "     —" : String(+x.toFixed(d)).padStart(6);

const rows = [];
for (const y of TERMS) {
  const e = E[y]; if (!e) continue;
  const next = TERMS[TERMS.indexOf(y) + 1];                 // term-ending election year
  const gov = WIN[y];
  const ousted = next ? WIN[next] !== gov : null;           // null = current term

  // leadership: historic cycleApproval[term-start]; current term reads top-level series
  let pmNet, oppNet, ppmLead;
  if (y !== TERMS.at(-1)) {
    const A = (D.cycleApproval[String(y)] || []).filter((r) => inWin(r.date, e.date));
    pmNet = mean(A.map((r) => r.pmNet).filter((v) => v != null));
    oppNet = mean(A.map((r) => r.oppNet).filter((v) => v != null));
    ppmLead = mean(A.filter((r) => r.pmPpm != null && r.oppPpm != null).map((r) => r.pmPpm - r.oppPpm));
    var apprN = A.length;
  } else {
    const A = D.approval.filter((r) => inWin(r.date, e.date));
    pmNet = mean(A.map((r) => r.alb).filter((v) => v != null));
    oppNet = mean(A.map((r) => r.opp).filter((v) => v != null));
    const P = D.ppm.filter((r) => inWin(r.date, e.date) && r.alb != null && r.opp != null);
    ppmLead = mean(P.map((r) => r.alb - r.opp));
    var apprN = A.length;
  }

  // voting intention: historic cyclePolls[term-END]; current term = D.polls
  let vi, span;
  if (y !== TERMS.at(-1)) {
    vi = (D.cyclePolls[String(next)] || []).filter((r) => r.firm !== "Election" && inWin(r.date, e.date));
  } else {
    vi = D.polls.filter((r) => inWin(r.date, e.date));
  }
  const primKey = gov, tppKey = "tpp_" + gov;
  const govPrim = mean(vi.map((r) => r[primKey]).filter((v) => v != null));
  const tppRows = vi.filter((r) => r[tppKey] != null);
  const govTpp = mean(tppRows.map((r) => r[tppKey]).filter((v) => v != null));
  const primSwing = govPrim == null ? null : govPrim - e[primKey];
  const tppSwing = govTpp == null ? null : govTpp - e[tppKey];
  span = vi.length ? vi.map((r) => r.date).sort()[0].slice(0, 7) + "…" + vi.map((r) => r.date).sort().at(-1).slice(0, 7) : "—";

  rows.push({ y, gov, ousted, pmNet, oppNet, ppmLead, primSwing, tppSwing, viN: vi.length, tppN: tppRows.length, apprN, span });
}

const METRICS = [["pmNet", "PM net sat"], ["oppNet", "Opp-leader net"], ["ppmLead", "PPM lead"],
  ["primSwing", "Gov primary swing"], ["tppSwing", "Gov 2PP swing"]];

console.log("term   gov  fate        pmNet  oppNet  ppmLd  primSw  tppSw   viN(tppN) apprN  window");
for (const r of rows) {
  const fate = r.ousted == null ? "CURRENT " : r.ousted ? "OUSTED  " : "re-elect";
  console.log(`${r.y}  ${r.gov}  ${fate}  ${f(r.pmNet)}  ${f(r.oppNet)}  ${f(r.ppmLead)}  ${f(r.primSwing)}  ${f(r.tppSwing)}   ${String(r.viN).padStart(2)}(${String(r.tppN).padStart(2)})     ${String(r.apprN).padStart(2)}    ${r.span}`);
}

const cur = rows.at(-1);
const hist = rows.slice(0, -1);
console.log("\n— cohort means (terms with data) —");
const scores = [];
for (const [k, label] of METRICS) {
  const o = hist.filter((r) => r.ousted === true && r[k] != null);
  const re = hist.filter((r) => r.ousted === false && r[k] != null);
  const mo = mean(o.map((r) => r[k])), mr = mean(re.map((r) => r[k])), x = cur[k];
  if (mo == null || mr == null || x == null || mo === mr) {
    console.log(`${label.padEnd(19)} ousted ${f(mo)}  re-elected ${f(mr)}  current ${f(x)}  — not scoreable`);
    continue;
  }
  const s = (x - mo) / (mr - mo);
  scores.push(s);
  console.log(`${label.padEnd(19)} ousted ${f(mo)} (n${o.length})  re-elected ${f(mr)} (n${re.length})  current ${f(x)}  → score ${s.toFixed(2)}`);
}
const m = mean(scores);
const med = scores.slice().sort((a, b) => a - b)[Math.floor(scores.length / 2)];
console.log(`\ncomposite (unweighted mean of ${scores.length} metric scores): ${m.toFixed(2)} · median ${med.toFixed(2)}`);
console.log("scale: 0 = profile of typical eventually-OUSTED govt at 15mo · 1 = typical eventually-RE-ELECTED govt");
