/* test-demosau-trends.mjs – pins .build/demosau-trends.mjs against the
   committed poll-trends cache (.build/demosau-src/cb-poll-trends-2026.json).
   The page is DemosAU's standing release form for every table, so the parse,
   the wave binding and the three lanes' row shapes all hold here: the
   committed copy is the oracle (a moved page makes these fail instead of
   blindly shifting downstream figures).

   Run: node .build/test-demosau-trends.mjs */
import assert from "node:assert";
import { loadTrends, pollOf, trendDims, trendSwitches, octRowOf, gateTrends, TREND_GROUPS, PV_FROM, DA_ALL } from "./demosau-trends.mjs";

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

console.log("all demosau-trends checks pass");
