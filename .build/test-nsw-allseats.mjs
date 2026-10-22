/* test-nsw-allseats.mjs – pins the NOTIONAL all-seats NSW preference-flow
   store (data/state-flows-nsw-allseats.json, written by
   .build/parse-nsw-state-flows.py's notional scan) against the published
   statewide figures it must reproduce:
     * Antony Green's Green-preference splits of EVERY Green ballot –
       2015 47.9% ALP / 8.0% Coalition / 44.1% exhausted
         (abc.net.au/news/2015-08-26),
       2019 52.5 / 7.8 / 39.7 (ABC guide PDF NSW2019_PrefFlowTables.pdf),
       2023 59.5 / 7.3 / 33.2 (antonygreen.com.au/nsw2027);
     * the ABC's statewide ALP two-party estimates, 45.7 / 48.0 / 54.3
       (abc.net.au/news/elections party-totals pages) – the 2023 scan lands
       0.2 points below, the residual of the ABC's own notional estimate vs
       a strict ballot-level recount of the NSWEC ballot files;
     * identity against the committed classic-basis rows in
       data/state-flows.csv: exhaustive ballots per group reconstruct that
       file's first-preference totals.
   Because the chart's NSW line is drawn from this store, a regression here
   is a wrong number on the page, not a broken build. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-nsw-allseats.json"), "utf8"));
assert.deepEqual(d.years, [2015, 2019, 2023], "the three ballot-file elections");
const N = d.years.length;
for (const k of ["grn", "grnExh", "onp", "onpExh", "oth", "othExh", "implied2pp"]) {
  assert.equal(d[k].length, N, `${k} lines up with years`);
  for (const v of d[k]) assert.ok(v === null || (v > 0 && v < 100), `${k} holds percentages or nulls`);
}
assert.deepEqual(Object.keys(d.votes).sort(), ["grn", "onp", "oth"], "votes by crossbench bucket");
for (const g of Object.keys(d.votes)) {
  assert.equal(d.votes[g].length, N, `votes.${g} lines up with years`);
  for (const [a, c] of d.votes[g]) assert.ok(Number.isInteger(a) && Number.isInteger(c) && a >= 0 && c >= 0, `${g}: integer vote piles`);
}
assert.ok(d.skipped.every((s) => s.length === 0), "every district-year has Labor and Coalition candidates");

/* the published Green-voter splits, of every formal Green ballot (exhausted
   included in the base): [to Labor, to Coalition, exhausted] */
const ANTONY = {
  2015: [47.9, 8.0, 44.1],
  2019: [52.5, 7.8, 39.7],
  2023: [59.5, 7.3, 33.2],
};
d.years.forEach((y, i) => {
  const [a, c] = d.votes.grn[i];
  const tot = (a + c) / (1 - d.grnExh[i] / 100);
  const [wa, wc, wx] = ANTONY[y];
  const ga = 100 * a / tot, gc = 100 * c / tot, gx = d.grnExh[i];
  assert.ok(Math.abs(ga - wa) <= 0.15, `${y} Greens to Labor ${ga.toFixed(1)} ≈ Antony's ${wa}`);
  assert.ok(Math.abs(gc - wc) <= 0.15, `${y} Greens to Coalition ${gc.toFixed(1)} ≈ Antony's ${wc}`);
  assert.ok(Math.abs(gx - wx) <= 0.06, `${y} Greens exhausted ${gx} ≈ Antony's ${wx}`);
  // the same figures as the share of ballots that ranked either major
  const split = 100 * a / (a + c);
  assert.equal(d.grn[i], Math.round(split * 10) / 10, `${y}: the store's grn share is the pile split`);
  const want = Math.round(1000 * wa / (wa + wc)) / 10;
  assert.ok(Math.abs(split - want) <= 0.15,
    `${y} Greens split ${split.toFixed(1)} ≈ ${want} (published; 0.1-rounded inputs)`);
});

/* the ABC's statewide ALP two-party estimates (party-totals pages); 2023's
   strict recount sits 0.2 under the ABC's own notional estimate */
const ABC_TPP = { 2015: 45.7, 2019: 48.0, 2023: 54.3 };
d.years.forEach((y, i) => {
  assert.ok(Math.abs(d.implied2pp[i] - ABC_TPP[y]) <= 0.3,
    `${y}: implied ALP 2PP ${d.implied2pp[i]} within 0.3 of the ABC's ${ABC_TPP[y]}`);
});

/* identity with the committed classic-basis rows: exhaustive ballots per
   group reconstruct state-flows.csv's first-preference totals */
const csv = fs.readFileSync(path.join(ROOT, "data", "state-flows.csv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((ln) => ln.split(","));
d.years.forEach((y, i) => {
  for (const g of ["grn", "onp", "oth"]) {
    const row = csv.find((c) => c[0] === "nsw" && +c[1] === y && c[2] === g);
    assert.ok(row, `state-flows.csv has the nsw ${y} ${g} row`);
    const prim = +row[3];
    const [a, c] = d.votes[g][i];
    const exh = d[g + "Exh"][i];
    if (prim === 0) {
      assert.ok(a === 0 && c === 0 && exh === null, `${y} ${g}: did not run – empty piles, no shares`);
      continue;
    }
    // the exhausted share the piles and the committed primaries imply
    // equals the stored share (to its 0.1 rounding)
    const impliedExh = 100 * (1 - (a + c) / prim);
    assert.ok(Math.abs(impliedExh - exh) <= 0.06,
      `${y} ${g}: piles ${a}+${c} of ${prim} imply ${impliedExh.toFixed(1)} exhausted ≈ the stored ${exh}`);
  }
});
assert.equal(d.votes.grn[1][0] + d.votes.grn[1][1], 262507, "the 2019 Green piles' exact sum");
assert.ok(Math.abs((d.votes.grn[1][0] + d.votes.grn[1][1]) / (1 - d.grnExh[1] / 100) - 435401) < 250,
  "the 2019 Greens' committed 435,401 first preferences are the store's exhaustive base");

/* One Nation ran in 2019 and 2023 but not 2015 */
assert.equal(d.onp[0], null, "no One Nation flow in 2015");
assert.ok(d.onp[1] < 50 && d.onp[2] < 40, "One Nation preferences favour the Coalition");

/* the measured classic-seat vs all-seats gap the caption's markers carry:
   the chart's classic figure comes from data/state-flows-est.csv's counted
   rows; here the store must sit above it on the Greens (Green-heavy inner
   seats are exactly the non-classic districts) */
const est = fs.readFileSync(path.join(ROOT, "data", "state-flows-est.csv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((ln) => ln.split(","));
d.years.forEach((y, i) => {
  const row = est.find((c) => c[0] === "nsw" && +c[1] === y && c[2] === "grn" && c[3] === "counted");
  assert.ok(row, `a counted nsw ${y} grn estimator row`);
  const classic = Math.round(+row[6] * 1000) / 10;
  const gap = +(d.grn[i] - classic).toFixed(1);
  assert.ok(gap > 0 && gap <= 1.5, `${y}: all-seats Greens ${d.grn[i]} sits 0–1.5 above the classic-seat ${classic} (${gap})`);
});

console.log("PASS: NSW all-seats notional flows –",
  d.years.map((y, i) => `${y} GRN ${d.grn[i]} (${d.grnExh[i]}% exh), ALP 2PP ${d.implied2pp[i]} v ABC ${ABC_TPP[y]}`).join("; "));
