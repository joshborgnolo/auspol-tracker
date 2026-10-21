/* test-flow-lef.mjs - flows.mjs's typed flow tables are aec-flow-history.py's
   output. FLOW_LEF (the tables Past cycles reads each term through) and
   FLOW_HISTORY (the federal series the preference-flows chart draws) are
   typed by hand from data/flow-lef.json, which the script writes; until
   2026-10-21 the 1987-93 rows had drifted from it (rates from the elections
   table's earlier one-decimal primaries) and the chart's 1996-2001 values
   came from elsewhere. Run: node .build/test-flow-lef.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLOW, FLOW_LEF, FLOW_HISTORY } from "./newtracker/flows.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "flow-lef.json"), "utf8"));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} v ${b}`);

for (const [y, t] of Object.entries(FLOW_LEF)) {
  const o = L[y];
  assert.ok(o, `${y}: the script has a table`);
  for (const [b, v] of Object.entries(o.f)) near(t[b], v, 6e-5, `FLOW_LEF ${y} ${b}`);
  near(t.anchor, o.anchor, 6e-4, `FLOW_LEF ${y} anchor`);
  near(t.bt, o.backtest.err, 6e-3, `FLOW_LEF ${y} backtest`);
}
assert.deepEqual(Object.keys(FLOW_LEF).map(Number), Object.keys(L).map(Number).filter((y) => y < 2025),
  "FLOW_LEF covers every election the script tabulates before 2025");
// the 2025 table is FLOW itself
for (const b of ["grn", "onp", "oth"]) near(FLOW[b], L["2025"].f[b], 6e-4, `FLOW 2025 ${b}`);
FLOW_HISTORY.years.forEach((y, i) => {
  const o = L[String(y)];
  for (const b of ["grn", "onp", "oth"]) {
    const v = FLOW_HISTORY[b][i];
    if (v == null) {
      assert.ok(b === "onp" && (o.share.onp ?? 0) < 1, `FLOW_HISTORY ${y} ${b}: null only for a One Nation under 1%`);
      continue;
    }
    near(v, 100 * o.f[b], 0.051, `FLOW_HISTORY ${y} ${b}`);
  }
});
console.log(`PASS: flow tables – FLOW_LEF ${Object.keys(FLOW_LEF).length} elections and FLOW_HISTORY ${FLOW_HISTORY.years.length} match aec-flow-history.py`);
