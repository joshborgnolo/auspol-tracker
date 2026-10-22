/* test-nsw-allseats.mjs – pins the NOTIONAL all-seats NSW preference-flow
   store (data/state-flows-nsw-allseats.json) against the published
   statewide figures it must reproduce. Two writers:
   2007 is .build/parse-nsw-2007-supplement.py, reading Antony Green's
   indicative tally-sheet count as printed in NSW Parliamentary Library
   Background Paper 1/08 (its sources are committed gzipped pdftotext
   dumps under .build/state-flow-src/nsw/2007/); 2015 on is
   .build/parse-nsw-state-flows.py's notional scan of the NSWEC ballot
   files. Pinned:
     * the printed Green-voter splits of every ballot –
       2007's piles to the vote: 86,350 / 25,745 / 99,881 to Labor /
         Coalition / exhausted (BP 1/08 p.59; the tally sheets' own base,
         declaration forms mostly missing – the all-ballot share between
         never computes, so the piles are the pin, not a percentage),
       2015 47.9% ALP / 8.0% Coalition / 44.1% exhausted
         (abc.net.au/news/2015-08-26),
       2019 52.5 / 7.8 / 39.7 (ABC guide PDF NSW2019_PrefFlowTables.pdf),
       2023 59.5 / 7.3 / 33.2 (antonygreen.com.au/nsw2027);
     * the statewide ALP two-party figures on each entry's basis – the
       Paper's printed 52.3 for 2007 (all-ballot indicative 2PP: the
       tally-sheet store entry sits ~2.5 points higher, real OPV
       differential exhaustion between the counted sheets and the
       declaration forms' voters) and the ABC's 45.7 / 48.0 / 54.3
       (abc.net.au/news/elections party-totals pages) – the 2023 scan
       lands 0.2 points below, the residual of the ABC's own notional
       estimate vs a strict ballot-level recount of the NSWEC ballot
       files;
     * identity for 2015 on against the committed classic-basis rows in
       data/state-flows.csv: exhaustive ballots per group reconstruct that
       file's first-preference totals (2007 predates that CSV).
   Because the chart's NSW line is drawn from this store, a regression here
   is a wrong number on the page, not a broken build. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const d = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-nsw-allseats.json"), "utf8"));
assert.deepEqual(d.years, [2007, 2015, 2019, 2023],
  "2007's tally-sheet count ahead of the three ballot-file elections");
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
assert.ok(d.skipped[0].length === 20 && d.skipped.slice(1).every((s) => s.length === 0),
  "2007's 20 non-Labor-v-Coalition districts sit out; every ballot-file district-year has Labor and Coalition candidates");
assert.ok(d.skipped[0].includes("Balmain") && d.skipped[0].includes("North Shore") && !d.skipped[0].includes("Cessnock"),
  "the skipped list is 2007's crossbench finals plus Hornsby and North Shore (Cessnock's actual distribution stands in)");

/* the published crossbench-voter splits [to Labor, to Coalition, exhausted]:
   the ballot-file years are Antony Green's published figures; 2007's are
   the Paper's printed piles themselves (BP 1/08 p.59 – the ABC published
   no 2007 decomposition, so the print is pinned against itself). None is
   compared as a share of every formal ballot, because the tally sheets
   never saw the declaration votes' forms (the supplement's 168 print
   admissions and 22 pinned drift cells): the sheets' own exhausted share
   understates the all-ballot rate, so the base between cannot be the same
   – the piles pin the split, the all-ballot exhausted share the 2PP. */
const PRINTED = {
  grn: { 2015: [47.9, 8.0, 44.1], 2019: [52.5, 7.8, 39.7], 2023: [59.5, 7.3, 33.2] },
};
d.years.forEach((y, i) => {
  const [a, c] = d.votes.grn[i];
  // the share of ballots that ranked either major is basis-free and pins
  // the store's figure exactly
  const split = 100 * a / (a + c);
  assert.equal(d.grn[i], Math.round(split * 10) / 10, `${y}: the store's grn share is the pile split`);
  if (y === 2007) {
    // the piles must be the Paper's printed statewide row: a/c to the vote,
    // the exhausted pile's implied share to the store's 0.1 rounding
    assert.deepEqual([...d.votes.grn[i], Math.round(1000 * 99881 / (a + c + 99881)) / 10],
      [86350, 25745, d.grnExh[i]], `2007 Green piles are the Paper's printed row`);
    return;
  }
  const tot = (a + c) / (1 - d.grnExh[i] / 100);
  const [wa, wc, wx] = PRINTED.grn[y];
  const ga = 100 * a / tot, gc = 100 * c / tot, gx = d.grnExh[i];
  assert.ok(Math.abs(ga - wa) <= 0.15, `${y} Greens to Labor ${ga.toFixed(1)} ≈ Antony's ${wa}`);
  assert.ok(Math.abs(gc - wc) <= 0.15, `${y} Greens to Coalition ${gc.toFixed(1)} ≈ Antony's ${wc}`);
  assert.ok(Math.abs(gx - wx) <= 0.06, `${y} Greens exhausted ${gx} ≈ Antony's ${wx}`);
  const want = Math.round(1000 * wa / (wa + wc)) / 10;
  assert.ok(Math.abs(split - want) <= 0.15,
    `${y} Greens split ${split.toFixed(1)} ≈ ${want} (published; 0.1-rounded inputs)`);
});
// 2007's others remainder likewise pins to its printed row
{
  const i = d.years.indexOf(2007);
  const [a, c] = d.votes.oth[i];
  assert.deepEqual([...d.votes.oth[i], Math.round(1000 * 134502 / (a + c + 134502)) / 10],
    [52897, 67808, d.othExh[i]], `2007 other piles are the Paper's printed crossbench remainder`);
}

/* the statewide ALP two-party each entry's basis implies: 2007's printed
   52.3 is the all-ballot figure – the tally-sheet count's basis (what the
   store carries, like the ballot-file years' count basis) runs ~2.5 points
   higher on real OPV differential exhaustion, so the gate is the printed
   band 52.3–55.0 and never below the all-ballot figure; the ballot-file
   years sit against the ABC's 0.3. */
const ABC_TPP = { 2015: 45.7, 2019: 48.0, 2023: 54.3 };
d.years.forEach((y, i) => {
  if (y === 2007) {
    assert.ok(d.implied2pp[i] >= 52.3 && d.implied2pp[i] <= 55.0,
      `2007: implied ALP 2PP ${d.implied2pp[i]} on the count's basis, above the Paper's printed all-ballot 52.3`);
  } else {
    assert.ok(Math.abs(d.implied2pp[i] - ABC_TPP[y]) <= 0.3,
      `${y}: implied ALP 2PP ${d.implied2pp[i]} within 0.3 of the ABC's ${ABC_TPP[y]}`);
  }
});

/* identity with the committed classic-basis rows: exhaustive ballots per
   group reconstruct state-flows.csv's first-preference totals (2015 on;
   2007 predates the NSWEC ballot files the CSV is built from) */
const csv = fs.readFileSync(path.join(ROOT, "data", "state-flows.csv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((ln) => ln.split(","));
d.years.forEach((y, i) => {
  if (y === 2007) return; // no ballot-file CSV row: the Paper's printed piles are checked above
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
// positional pins after the csv loop: indexOf keeps them honest as years land
const i19 = d.years.indexOf(2019);
assert.equal(d.votes.grn[i19][0] + d.votes.grn[i19][1], 262507, "the 2019 Green piles' exact sum");
assert.ok(Math.abs((d.votes.grn[i19][0] + d.votes.grn[i19][1]) / (1 - d.grnExh[i19] / 100) - 435401) < 250,
  "the 2019 Greens' committed 435,401 first preferences are the store's exhaustive base");

/* One Nation fielded no candidates in 2007 or 2015 */
for (const y of [2007, 2015]) {
  const i = d.years.indexOf(y);
  assert.equal(d.onp[i], null, `no One Nation flow in ${y}`);
  assert.equal(d.votes.onp[i][0] + d.votes.onp[i][1], 0, `no One Nation ballots in ${y}`);
}
assert.ok(d.onp[d.years.indexOf(2019)] < 50 && d.onp[d.years.indexOf(2023)] < 40,
  "One Nation preferences favour the Coalition");

/* the measured classic-seat vs all-seats gap the caption's markers carry:
   the chart's classic figure comes from data/state-flows-est.csv's counted
   rows; here the store must sit above it on the Greens (Green-heavy inner
   seats are exactly the non-classic districts). 2007 has no counted row –
   its "classic" figure is the estimator's, pinned by test-state-flows.mjs */
const est = fs.readFileSync(path.join(ROOT, "data", "state-flows-est.csv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((ln) => ln.split(","));
d.years.forEach((y, i) => {
  if (y === 2007) return; // the ballot-file years only have counted classic rows to gap against
  const row = est.find((c) => c[0] === "nsw" && +c[1] === y && c[2] === "grn" && c[3] === "counted");
  assert.ok(row, `a counted nsw ${y} grn estimator row`);
  const classic = Math.round(+row[6] * 1000) / 10;
  const gap = +(d.grn[i] - classic).toFixed(1);
  assert.ok(gap > 0 && gap <= 1.5, `${y}: all-seats Greens ${d.grn[i]} sits 0–1.5 above the classic-seat ${classic} (${gap})`);
});

console.log("PASS: NSW all-seats notional flows –",
  d.years.map((y, i) => `${y} GRN ${d.grn[i]} (${d.grnExh[i]}% exh), ALP 2PP ${d.implied2pp[i]}` +
    (y === 2007 ? " v the Paper's printed 52.3 (all-ballot basis)" : ` v ABC ${ABC_TPP[y]}`)).join("; "));
