// Fixture test for latest.primaryOrder – the deadband walk in gen-data.mjs
// that ranks the primary-vote facet's columns (same >1pt rule as rivalLead's
// matchup ruling): highest aggregate leftmost, and a party only overtakes the
// one above it once its aggregate leads by more than a full point.
//
// The walk IS the contract: the test replays it verbatim against the live
// aggPrimary series in the generated 9f09dca2 data asset and asserts the
// emitted order is exactly what the walk produces — so a change to the rule
// (or a data edit that should move a column) fails loudly here rather than
// shuffling the tables silently.
//
// Run:
//   node .build/newtracker/test-primary-order.mjs
// Exits non-zero if any expectation fails.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `\n      ${extra}`}`);
};
const die = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };

/* --- the live data, from the 9f09dca2 asset the page reads --- */
const dataFile = readdirSync(new URL("./assets/", import.meta.url))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
if (!dataFile) die("could not find the 9f09dca2 data asset");
const win = {};
new Function("window", readFileSync(fileURLToPath(new URL(`./assets/${dataFile}`, import.meta.url)), "utf8"))(win);
const D = win.AUSPOL;
if (!D || !Array.isArray(D.aggPrimary) || !D.latest) die("aggPrimary/latest missing from the data asset");

const PRIMARY_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const PRIMARY_DEADBAND = 1.0;

/* --- VERBATIM replica of the walk in gen-data.mjs (keep in step) --- */
const walked = (() => {
  const order = [...PRIMARY_KEYS];
  for (const m of D.aggPrimary) {
    if (PRIMARY_KEYS.some((k) => m[k] == null)) continue;
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = order.length - 2; i >= 0; i--) {
        if (m[order[i + 1]] > m[order[i]] + PRIMARY_DEADBAND) {
          [order[i], order[i + 1]] = [order[i + 1], order[i]];
          moved = true;
        }
      }
    }
  }
  return order;
})();

const emitted = D.latest.primaryOrder;
ok("latest.primaryOrder exists", Array.isArray(emitted), JSON.stringify(emitted));
ok("it is a permutation of the five primary keys",
  !!emitted && emitted.length === 5 && PRIMARY_KEYS.every((k) => emitted.includes(k)),
  JSON.stringify(emitted));
ok("emitted order matches the deadband walk over aggPrimary",
  JSON.stringify(emitted) === JSON.stringify(walked),
  `emitted ${JSON.stringify(emitted)} vs walked ${JSON.stringify(walked)}`);

/* the walk's own guarantee, restated against the latest month: no adjacent
   pair sits inverted by MORE than the deadband (a bigger gap would have
   forced the swap) */
const last = D.aggPrimary.filter((m) => !PRIMARY_KEYS.some((k) => m[k] == null)).pop();
if (!last) die("no fully-populated month in aggPrimary");
const inverted = [];
for (let i = 0; i < walked.length - 1; i++)
  if (last[walked[i + 1]] > last[walked[i]] + PRIMARY_DEADBAND)
    inverted.push(`${walked[i]} ${last[walked[i]]} < ${walked[i + 1]} ${last[walked[i + 1]]}`);
ok(`no adjacent pair inverted beyond the deadband on the latest month (${last.ym})`,
  inverted.length === 0, inverted.join("; "));

/* and the report line, so a run shows what the tables are currently showing */
console.log(`\ncolumn order: ${walked.map((k) => ({ alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" })[k]).join(" · ")}`
  + `  (${PRIMARY_KEYS.map((k) => `${k} ${last[k]}`).join(", ")} in ${last.ym})`);

if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log("all ok");
