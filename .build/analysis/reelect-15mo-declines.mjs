/* throwaway: absolute-decline profile + LOOCV success rate of the
   15-months-in composite model. Metrics, two ways:
   LEVELS  — pmNet, oppNet, ppmLead, primary swing, 2PP swing (as before)
   DECLINE — pmNet drop (term-start baseline − 15mo), ppmLead drop,
             primary decline (−swing), 2PP decline (−swing).
   Model: per-metric score s=(x−O)/(R−O) on cohort means (O=ousted,
   R=re-elected), composite = mean of available metric scores;
   predict OUSTED iff composite < 0.5. Leave-one-out over the 13 completed
   terms: cohort means refit each fold. Data: origin/main polls.json. */
import { execSync } from "node:child_process";

const D = JSON.parse(execSync("git show origin/main:data/polls.json", { maxBuffer: 1 << 28, encoding: "utf8" }));
const WIN = { 1987: "alp", 1990: "alp", 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp",
  2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const TERMS = Object.keys(WIN).map(Number).sort((a, b) => a - b);
const E = Object.fromEntries(Object.entries(D.elections).map(([k, v]) => [+k.slice(1), v]));
const M = (d, e) => (new Date(d) - new Date(e)) / (30.4375 * 864e5);
const inW = (d, e, lo, hi) => { const m = M(d, e); return m >= lo && m < hi; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function features(y) {
  const e = E[y], gov = WIN[y], next = TERMS[TERMS.indexOf(y) + 1], cur = y === TERMS.at(-1);
  // leadership: 15mo window [12,18) + baseline [0,5) months
  const apprRows = cur ? D.approval.map((r) => ({ date: r.date, pmNet: r.alb, oppNet: r.opp }))
    : (D.cycleApproval[String(y)] || []);
  const appr15 = apprRows.filter((r) => inW(r.date, e.date, 12, 18));
  const appr0 = apprRows.filter((r) => inW(r.date, e.date, 0, 5));
  const ppmRows = cur ? D.ppm.map((r) => ({ date: r.date, lead: r.alb != null && r.opp != null ? r.alb - r.opp : null }))
    : (D.cycleApproval[String(y)] || []).map((r) => ({ date: r.date, lead: r.pmPpm != null && r.oppPpm != null ? r.pmPpm - r.oppPpm : null }));
  const p15 = ppmRows.filter((r) => inW(r.date, e.date, 12, 18));
  const p0 = ppmRows.filter((r) => inW(r.date, e.date, 0, 5));
  const pmNet = mean(appr15.map((r) => r.pmNet).filter((v) => v != null));
  const oppNet = mean(appr15.map((r) => r.oppNet).filter((v) => v != null));
  const ppmLead = mean(p15.map((r) => r.lead).filter((v) => v != null));
  const pmNet0 = mean(appr0.map((r) => r.pmNet).filter((v) => v != null));
  const ppmLead0 = mean(p0.map((r) => r.lead).filter((v) => v != null));
  // VI swings vs own election night
  const vi = (cur ? D.polls : (D.cyclePolls[String(next)] || []).filter((r) => r.firm !== "Election"))
    .filter((r) => inW(r.date, e.date, 12, 18));
  const prim = mean(vi.map((r) => r[gov]).filter((v) => v != null));
  const tpp = mean(vi.map((r) => r["tpp_" + gov]).filter((v) => v != null));
  return {
    y, gov, ousted: next ? WIN[next] !== gov : null,
    levels: { pmNet, oppNet, ppmLead, primSwing: prim == null ? null : prim - e[gov], tppSwing: tpp == null ? null : tpp - e["tpp_" + gov] },
    decline: {
      pmNetDrop: pmNet == null || pmNet0 == null ? null : pmNet0 - pmNet,
      ppmDrop: ppmLead == null || ppmLead0 == null ? null : ppmLead0 - ppmLead,
      primDecl: prim == null ? null : e[gov] - prim,
      tppDecl: tpp == null ? null : e["tpp_" + gov] - tpp,
    },
    bases: { pmNet0, ppmLead0 },
  };
}

const T = TERMS.map(features);
const hist = T.filter((t) => t.ousted != null);

const composite = (t, fit, keys) => {
  const ss = [];
  for (const k of keys) {
    const x = t[k]; if (x == null) continue;
    const o = fit.o[k], r = fit.r[k];
    if (o == null || r == null || o === r) continue;
    ss.push((x - o) / (r - o));
  }
  return ss.length ? mean(ss) : null;
};
const fitOf = (terms, key, keys) => {
  const o = {}, r = {};
  for (const k of keys) {
    o[k] = mean(terms.filter((t) => t.ousted).map((t) => t[key][k]).filter((v) => v != null));
    r[k] = mean(terms.filter((t) => !t.ousted).map((t) => t[key][k]).filter((v) => v != null));
  }
  return { o, r };
};
const LKEYS = ["pmNet", "oppNet", "ppmLead", "primSwing", "tppSwing"];
const DKEYS = ["pmNetDrop", "ppmDrop", "primDecl", "tppDecl"];
const scoreTerm = (t, fitPool) =>
  Object.fromEntries([["levels", LKEYS], ["decline", DKEYS]].map(([nm, keys]) => {
    const fit = fitOf(fitPool, nm === "levels" ? "levels" : "decline", keys);
    return [nm, composite(nm === "levels" ? t.levels : t.decline, fit, keys)];
  }));

// --- declines table -------------------------------------------------------
console.log("term   fate        pmNet: start→15mo (drop)   ppm: start→15mo (drop)   primDecl  tppDecl");
for (const t of T) {
  const s = (a, b, d) => [a, b].map((v) => v == null ? "   — " : String(v.toFixed(1)).padStart(5)).join(" → ") + " (" + (d == null ? "  — " : String(+d.toFixed(1)).padStart(5)) + ")";
  const fate = t.ousted == null ? "CURRENT " : t.ousted ? "OUSTED  " : "re-elect";
  console.log(`${t.y}  ${fate}  ${s(t.bases.pmNet0, t.levels.pmNet, t.decline.pmNetDrop)}        ${s(t.bases.ppmLead0, t.levels.ppmLead, t.decline.ppmDrop)}       ${t.decline.primDecl == null ? "   — " : t.decline.primDecl.toFixed(1)}    ${t.decline.tppDecl == null ? "  — " : t.decline.tppDecl.toFixed(1)}`);
}

// --- current term under the decline metric --------------------------------
const cur = T.at(-1);
const curScores = scoreTerm(cur, hist);
console.log(`\nAlbanese-2025 composite scores (0 = ousted profile, 1 = re-elected):`);
console.log(`  levels  metric set: ${curScores.levels?.toFixed(2)}`);
console.log(`  decline metric set: ${curScores.decline?.toFixed(2)}`);

// --- model evaluation ------------------------------------------------------
for (const [nm] of [["levels"], ["decline"]]) {
  let ok = 0, n = 0; const misses = [];
  for (const held of hist) {
    const pool = hist.filter((t) => t !== held);
    const c = scoreTerm(held, pool)[nm];
    if (c == null) { console.log(`  (${held.y} skipped — no ${nm} metrics)`); continue; }
    const pred = c < 0.5;
    n++; ok += pred === held.ousted ? 1 : 0;
    if (pred !== held.ousted) misses.push(`${held.y} (score ${c.toFixed(2)}, actually ${held.ousted ? "OUSTED" : "re-elected"})`);
  }
  console.log(`\n${nm} model — leave-one-out over ${n} terms: ${ok}/${n} = ${(100 * ok / n).toFixed(0)}% correct`);
  if (misses.length) console.log(`  misclassified: ${misses.join("; ")}`);
  const majority = hist.filter((t) => !t.ousted).length;
  console.log(`  (baseline "always predict re-elected" = ${majority}/${hist.length} = ${(100 * majority / hist.length).toFixed(0)}%)`);
}
console.log(`\nprediction for 2025 term: levels score ${curScores.levels?.toFixed(2)} → ${curScores.levels < 0.5 ? "OUSTED" : "re-elected"} · decline score ${curScores.decline?.toFixed(2)} → ${curScores.decline < 0.5 ? "OUSTED" : "re-elected"}`);
