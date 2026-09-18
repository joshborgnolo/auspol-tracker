/* Can the missing historical 2PPs be backfilled from primaries? — feasibility check.

   The past-cycles 2PP fan runs on two bases and cannot help it. Before about
   1990 no pollster published a national two-party figure, so the seven terms
   from 1972 to 1984 carry a flows-implied one (tppEra → FLOW_ERAS) while every
   term from 1990 carries what the houses printed. The 1987 term carries
   nothing at all: 93 waves with primaries and no 2PP of either kind.

   The tempting fix is to imply a 2PP for every poll that lacks one, leaving
   published figures untouched — an extension of the tppEra convention rather
   than a replacement for measurement. This asks whether that would work.

   NOT "convert everything to implied". That idea was considered and dropped
   before this file existed: for 1990-2022 the published figure is the better
   one, and replacing it would swap the industry's actual output for a model
   of it — degrading the accuracy panel (which scores houses on what they
   published) and the hazard model's training data (which reads tppSw across
   19 terms). The implied basis exists to make TODAY's houses comparable with
   each other, not to second-guess a 1996 Newspoll.

   Three questions, per term, all answerable from the committed dataset:

     1. FIT — can a flow table be fitted from the term's own published polls,
        and how tight is it? OLS of (tpp_alp − alp) on [1, grn, onp, oth], the
        residual SD being the error a backfilled point would carry.
     2. OVERLAP — how many of the missing polls fall inside the date window
        where published figures exist? Outside it there is nothing to check a
        backfill against, and calibration becomes extrapolation.
     3. COMPOSITION — are the polls missing a 2PP drawn from the same
        population as those that have one? Reported per house, because a
        whole-term primary gap can be house mix OR the term's own trajectory,
        and those have very different implications.

   VERDICT (first run, 2026-09-19): DO NOT BACKFILL. The terms that need it
   cannot support it and the terms that can support it do not need it.

     - Residual SD where a fit is possible: 0.67-0.98 points. The fan's whole
       interesting range is a few points wide, so every backfilled point would
       carry roughly a third of the signal as noise.
     - 1987: no published 2PP anywhere in the term, so zero overlap and no
       internal calibration of any kind. Its rows also lack the dem/dlp split
       impliedEraAlp2pp needs — in 1987 the Democrats were ~8.5% and flowed
       very differently from generic "others", so the method cannot run on a
       lumped oth column. Two unsourced dependencies, not one.
     - 1990: 141 missing, and published figures exist only from Nov 1992 in a
       term that opened in Mar 1990 — 28 of 141 inside the window. Backfilling
       the other 113 applies a flow table across 31 months that contain
       nothing to validate it against.
     - The 1990 split is TIME, not house: nobody published a 2PP until the
       last five months, and within every single house the published waves sit
       higher on ALP primary than the unpublished ones (Morgan 44.5 v 37.6,
       Newspoll 42.0 v 38.4). That gap is Labor's recovery into the 1993
       election, which is exactly the stretch a backfill would be inventing.
     - 1996, 1998, 2019, 2022 calibrate cleanly and between them are missing
       31 polls. Not worth a data project.

   WHAT WOULD CHANGE THIS. One thing only: sourcing the pre-1990 waves with
   the Democrats and DLP itemised out of "others", the way the 1972-84
   aeforecasts import already carries them. That would let the era method run
   on 1987 and 1990 with an external flow table anchored on those elections'
   own results, which is how the 1972-84 terms get their figures and does not
   depend on within-term overlap at all. Re-run this then; until then the 1987
   gap is a gap, and the note on the past-cycles 2PP card explains why.

   Run: node .build/newtracker/tpp-backfill-check.mjs
*/
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));

/* term (the election that STARTED it) → src (the election that ENDED it),
   which is how cyclePolls is keyed. Same mapping CYC_META carries. */
const TERMS = { 1972: 1974, 1974: 1975, 1975: 1977, 1977: 1980, 1980: 1983, 1983: 1984,
  1984: 1987, 1987: 1990, 1990: 1993, 1993: 1996, 1996: 1998, 1998: 2001, 2001: 2004,
  2004: 2007, 2007: 2010, 2010: 2013, 2013: 2016, 2016: 2019, 2019: 2022, 2022: 2025 };

const n0 = (v) => (v == null ? 0 : v);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const f1 = (v) => (v == null ? "  —" : (v >= 0 ? "+" : "") + v.toFixed(1));

/* OLS of (tpp_alp − alp) on [1, grn, onp, oth+dem+dlp]. Returns null when the
   design is singular, which is itself a finding: the early-1990s terms have
   no Greens or One Nation column to identify a flow from (the Greens formed
   in 1992, One Nation in 1997), so their own data cannot price their own
   table however many waves they carry. */
function fitFlows(rows) {
  const K = 4;
  const X = rows.map((r) => [1, n0(r.grn), n0(r.onp), n0(r.oth) + n0(r.dem) + n0(r.dlp)]);
  const y = rows.map((r) => r.tpp_alp - r.alp);
  const A = Array.from({ length: K }, () => new Array(K).fill(0)), b = new Array(K).fill(0);
  X.forEach((x, i) => {
    for (let p = 0; p < K; p++) { b[p] += x[p] * y[i]; for (let q = 0; q < K; q++) A[p][q] += x[p] * x[q]; }
  });
  for (let c = 0; c < K; c++) {
    let piv = c;
    for (let r = c + 1; r < K; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-9) return null;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < K; r++) {
      const f = A[r][c] / A[c][c];
      for (let j = c; j < K; j++) A[r][j] -= f * A[c][j];
      b[r] -= f * b[c];
    }
  }
  const be = new Array(K).fill(0);
  for (let i = K - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < K; j++) s -= A[i][j] * be[j];
    be[i] = s / A[i][i];
  }
  const res = X.map((x, i) => y[i] - x.reduce((s, v, j) => s + v * be[j], 0));
  return { be, sd: Math.sqrt(res.reduce((s, v) => s + v * v, 0) / Math.max(1, res.length - K)) };
}

const split = (src) => {
  const all = (D.cyclePolls[String(src)] || []).filter((r) => r.firm !== "Election" && r.alp != null);
  return { all, has: all.filter((r) => r.tpp_alp != null), no: all.filter((r) => r.tpp_alp == null) };
};

console.log("== 1. Coverage and fit ==");
console.log("term    rows   with2PP  missing   fit sd   flows grn/onp/oth");
const gaps = [];
for (const [term, src] of Object.entries(TERMS)) {
  const { all, has, no } = split(src);
  if (!all.length) continue;
  if (!no.length) continue;                       // nothing to backfill here
  gaps.push([Number(term), src]);
  const fit = has.length >= 8 ? fitFlows(has) : null;
  console.log(
    String(term).padEnd(7), String(all.length).padStart(5), String(has.length).padStart(9),
    String(no.length).padStart(9), "  ",
    (fit ? fit.sd.toFixed(2) : "  —").padStart(5), "   ",
    fit ? fit.be.slice(1).map((v) => v.toFixed(2)).join(" / ") : "singular — no minor column varies");
}

console.log("\n== 2. Overlap: missing polls that fall inside the published window ==");
console.log("(outside it there is nothing to calibrate against, and a backfill extrapolates)");
for (const [term, src] of gaps) {
  const { has, no } = split(src);
  const hd = has.map((r) => r.date).sort();
  const inside = hd.length ? no.filter((r) => r.date >= hd[0] && r.date <= hd[hd.length - 1]).length : 0;
  console.log("  " + String(term).padEnd(6),
    "published", (hd.length ? hd[0] + " .. " + hd[hd.length - 1] : "NONE — no 2PP anywhere in the term").padEnd(26),
    "· calibratable", String(inside).padStart(3) + " / " + String(no.length).padEnd(4),
    inside === 0 ? " <- nothing to check against"
      : inside / no.length < 0.5 ? " <- most of the term is extrapolation" : "");
}

console.log("\n== 3. Composition: is the missing set the same population? ==");
console.log("(a whole-term primary gap can be house mix or the term's own arc — per house tells them apart)");
for (const [term, src] of gaps) {
  const { has, no } = split(src);
  /* Undefined when one side is empty — 1987 has no published poll to be a
     gap FROM, and differencing against a zero would print a 43-point lie. */
  const mh = mean(has.map((r) => r.alp)), mn = mean(no.map((r) => r.alp));
  console.log(`  ${term}  whole-term ALP-primary gap `
    + (mh == null || mn == null ? "n/a — one side is empty" : f1(mn - mh)));
  const firms = [...new Set([...has, ...no].map((r) => r.firm))].sort();
  for (const f of firms) {
    const h = has.filter((r) => r.firm === f), n = no.filter((r) => r.firm === f);
    if (!h.length || !n.length) continue;         // only houses on BOTH sides can separate the two
    console.log(`     ${f.padEnd(13)} published ${String(h.length).padStart(3)} (ALP ${mean(h.map((r) => r.alp)).toFixed(1)})`
      + `  ·  missing ${String(n.length).padStart(3)} (ALP ${mean(n.map((r) => r.alp)).toFixed(1)})`
      + `  ·  within-house gap ${f1(mean(n.map((r) => r.alp)) - mean(h.map((r) => r.alp)))}`);
  }
}

console.log("\nA within-house gap as large as the whole-term gap means the split is TIME, not");
console.log("house: the same pollster read a different electorate in the two periods. That is");
console.log("the 1990 term, and it is why its 113 uncovered waves cannot be backfilled — the");
console.log("stretch a backfill would invent is precisely the stretch nothing validates.");
