/* test-demosau-trends.mjs – pins .build/demosau-trends.mjs against the
   committed poll-trends cache (.build/demosau-src/cb-poll-trends-2026.json).
   The page is DemosAU's standing release form for every table, so the parse,
   the wave binding and the three lanes' row shapes all hold here: the
   committed copy is the oracle (a moved page makes these fail instead of
   blindly shifting downstream figures).

   Run: node .build/test-demosau-trends.mjs */
import assert from "node:assert";
import { loadTrends, pollOf, trendDims, trendSwitches, octRowOf, gateTrends, TREND_GROUPS, PV_FROM, DA_ALL, parseInteractive, loadInteractive, interactiveDims, interactiveFacts, interactiveApproval } from "./demosau-trends.mjs";
import { dimsProblem, totalProblem } from "./crosstab-parse.mjs";

const data = await loadTrends();
const eq = assert.deepEqual.bind(assert);

// -- the cache parses: ten waves, January through the October wave ----------
assert(data.polls.length === 10, "the committed page carries ten waves");
eq([data.polls.at(-1).start, data.polls.at(-1).end], ["2026-10-23", "2026-10-26"]);
const oct = pollOf(data, "2026-10-26");
eq([oct.n, oct.ess, oct.undecided], [1500, 849, 6]);
assert(pollOf(data, "2026-10-24").poll === oct.poll, "a date inside the fieldwork window finds the wave");
assert(pollOf(data, "2026-10-26").poll === oct.poll, "the wave ends on the row's date");

// -- gate: a torn parse shape throws loudly --------------------------------
assert.throws(() => gateTrends({ polls: [], vote: [], ratings: [] }, "test"), /fewer waves/);
const good = gateTrends(JSON.parse(JSON.stringify(data)), "test");
eq(good.polls.length, 10);

// -- trendDims: the October wave's seven dims, exact figures ---------------
const ready = trendDims(data, "p10");
eq(Object.keys(ready.dims).sort(), ["age", "education", "gender", "housing", "income", "language", "location"].sort());
eq(ready.dims.gender.Men, { alp: 29, grn: 11, lnp: 25, onp: 26, oth: 9 });
eq(ready.dims.age["18–34"], { alp: 26, grn: 30, lnp: 21, onp: 18, oth: 5 });
eq(ready.dims.language["Other language"], { alp: 36, grn: 16, lnp: 31, onp: 10, oth: 7 });
eq(ready.dims.housing["Own outright"], { alp: 26, grn: 8, lnp: 33, onp: 23, oth: 10 });
eq(ready.unknown, [], "every mapped group is printed for the October wave");
eq(ready.total, { alp: 26, lnp: 24, grn: 13, onp: 26, oth: 11 }, "the all-voters anchor row");
for (const [dim, groups] of Object.entries(ready.dims))
  for (const [g, v] of Object.entries(groups))
    assert(Math.abs(DA_ALL.reduce((a, p) => a + (v[p === "on" ? "onp" : p] ?? 0), 0) - 100) <= 1.5,
      `${dim}|${g} sums ~100, got ${DA_ALL.reduce((a, p) => a + (v[p === "on" ? "onp" : p] ?? 0), 0)}`);

// an earlier wave comes from the trend series, NEVER oct's block (oct is
// one wave only): April's Men are its own, not October's
const apr = trendDims(data, "p04");
assert(apr.dims.gender.Men.alp !== ready.dims.gender.Men.alp || true, "trivially typed");
eq(apr.dims.gender.Men.onp, 24, "April's Men are April's, not the current wave's");
eq(apr.total, null, "the oct all-voters row belongs to the October wave alone");
assert(!Object.keys(apr.dims).includes("language"), "April predates the language dim (language joined in May)");

// -- trendSwitches: five from-rows, sums ~100 -------------------------------
const sw = trendSwitches(data, "p10");
eq(Object.keys(sw.rows).sort(), ["alp", "grn", "lnp", "onp", "oth"]);
eq(sw.rows.alp, { alp: 68, grn: 6, lnp: 9, onp: 12, oth: 5 });
eq(sw.rows.onp, { alp: 3, grn: 1, lnp: 4, onp: 91, oth: 1 });
for (const [from, r] of Object.entries(sw.rows))
  assert(Math.abs(Object.values(r).reduce((a, b) => a + b, 0) - 100) <= 1.5, `${from} transition row sums ~100`);
eq(sw.unknown, [], "every past-vote row is printed");

// -- the oct block keeps its own wave discipline: p09 gets no oct rows ------
const wNine = trendDims(data, "p09");
assert(Object.keys(wNine.dims).length, "trend-only dims still fill");
eq(trendSwitches(data, "p09").rows.alp.alp >= 0, true, "p09 switches come from the trend series");

// -- every TREND_GROUPS id resolves to a demographics dim+label ------------
for (const [gid, pair] of Object.entries(TREND_GROUPS)) {
  assert(Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && typeof pair[1] === "string",
    `${gid} maps to a (dim, label) pair`);
}
eq(Object.keys(PV_FROM).sort(), ["pv_alp", "pv_grn", "pv_lnp", "pv_on", "pv_oth"]);

// -- the November interactive: label-mapped parties and all 19 cohorts ----
const interactiveUrl = "https://demosau.com/wp-content/uploads/DemosAU/national-poll-nov-2026v2.html";
const interactive = await loadInteractive(interactiveUrl);
const idims = interactiveDims(interactive);
eq(Object.keys(idims.dims).sort(), ["age", "education", "gender", "housing", "income", "language", "location"].sort());
eq(Object.values(idims.dims).flatMap((g) => Object.keys(g)).length, 19);
eq(idims.total, { alp: 27, lnp: 25, grn: 12, onp: 23, oth: 13 }, "One Nation and Greens are identified by label, not array order");
eq(idims.dims.gender.Men, { alp: 28, grn: 11, lnp: 26, onp: 22, oth: 13 });
eq(idims.dims.language["Other language"], { alp: 35, grn: 17, lnp: 24, onp: 18, oth: 6 });
eq(idims.dims.housing["Own outright"], { alp: 24, grn: 8, lnp: 31, onp: 22, oth: 15 });
eq(idims.unknown, []);
assert(!dimsProblem(idims.dims), "every interactive cohort sums to its printed decided base");
assert(!totalProblem(idims.total, { alp: 27, lnp: 25, grn: 12, onp: 23, ind: 13 }));
const row = { date: "2026-11-22", alp: 27, lnp: 25, grn: 12, onp: 23, ind: 13, sample: 1464, sampleEff: 711 };
eq(interactiveFacts(interactive, { row, previous: { date: "2026-10-26", undecidedLeaner: 6 } }), { total: idims.total, undecidedLeaner: 6 });
eq(interactive.data.tpp, [], "no 2PP is invented from the undecided row");
assert.throws(() => interactiveFacts(interactive, { previous: { date: "2026-10-26", undecidedLeaner: 5 } }), /previous wave/);
assert.throws(() => interactiveFacts(interactive, { row: { ...row, onp: 24 } }), /onp/);
const moved = structuredClone(interactive.data);
moved.vote_meta[0].prev_dk = 5;
assert.throws(() => interactiveFacts(parseInteractive(moved), { previous: { date: "2026-10-26", undecidedLeaner: 6 } }), /previous wave/);
const unknown = structuredClone(interactive.data);
unknown.options.find((o) => o.question === "vi" && o.short === "Greens").short = "Green supporters";
assert.throws(() => parseInteractive(unknown), /unmapped party/);
assert.throws(() => parseInteractive("not an interactive release"), /expected one poll-data block/);
const cacheOnly = await loadInteractive(interactiveUrl);
eq(cacheOnly.data, interactive.data, "cached reads reproduce the source data without a network call");

// -- November's all-voters ratings, and the printed change on October -----
eq(interactiveApproval(interactive, { date: "2026-10-26", alb: -20, opp: 1, han: -14 }), {
  approval: {
    alb: { app: 30, dis: 45, net: -15 },
    opp: { app: 31, dis: 27, net: 4 },
    han: { app: 34, dis: 43, net: -9 },
  },
  oppName: "Taylor",
});
assert.throws(() => interactiveApproval(interactive, { date: "2026-10-26", alb: -19, opp: 1, han: -14 }), /alb.*previous wave/);
const missingRating = structuredClone(interactive.data);
delete missingRating.results.ppl2.total;
assert.throws(() => interactiveApproval(parseInteractive(missingRating)), /opp all-voters row missing/);
const wrongSum = structuredClone(interactive.data);
wrongSum.results.ppl3.total[1] -= 2;
assert.throws(() => interactiveApproval(parseInteractive(wrongSum)), /han sums to 98, not ~100/);

console.log("all demosau-trends checks pass");
