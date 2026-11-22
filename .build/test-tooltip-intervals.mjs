import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(".build/newtracker/assets/08b413e7-8dbe-49bf-8932-a479f8d98f54.js", "utf8");
const start = source.indexOf("function tipRowsWithIntervals(");
assert.ok(start >= 0, "the shared row mapper stays in the TrendChart layer");
const open = source.indexOf("{", start);
let depth = 0, quote = null, escape = false, end = open;
for (; end < source.length; end++) {
  const c = source[end];
  if (escape) { escape = false; continue; }
  if (c === "\\") { escape = true; continue; }
  if (quote) { if (c === quote) quote = null; continue; }
  if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
  if (c === "{") depth++;
  if (c === "}" && --depth === 0) { end++; break; }
}
const rowsOf = new Function(source.slice(start, end) + "; return tipRowsWithIntervals;")();
const ci = (label, value, head = "95% intervals") => ({ label: head, rowLabel: label, value });
const inlineCases = () => rowsOf([
  { label: "Coalition", value: "30%" },
  { label: "Labor", value: "28%" },
  { label: "Greens", value: "10%" },
], [ci("Labor", "±1.8"), ci("Coalition", "±2.2"), ci("Greens", "±1.0"), ci("One Nation", "±3.3")], false);

const inline = inlineCases();
assert.equal(inline.rows[0].interval.value, "±2.2", "the first sorted row gets the Coalition's interval, not the first payload interval");
assert.equal(inline.rows.find((r) => r.label === "Labor").interval.value, "±1.8");
assert.equal(inline.rows.find((r) => r.label === "Greens").interval.value, "±1.0");
assert.ok(inline.ciKey, "interval-bearing guides participate in the fit decision");

const stacked = rowsOf([
  { label: "Coalition", value: "30%" }, { label: "Labor", value: "28%" }, { label: "Greens", value: "10%" },
], [ci("Labor", "±1.8"), ci("Coalition", "±2.2"), ci("Greens", "±1.0"), ci("One Nation", "±3.3"), { label: "Panel", value: "Late" }], true);
assert.equal(stacked.rows.filter((r) => r.interval).length, 0, "stacked values do not also appear inline");
assert.equal(stacked.rows.find((r) => r.label === "95% intervals").value,
  "Labor ±1.8, Coalition ±2.2, Greens ±1.0, One Nation ±3.3",
  "the fallback names every owner, including a party with no displayed matching row");
assert(stacked.rows.some((r) => r.label === "Panel" && r.value === "Late"), "ordinary extras stay intact");
const singularPlural = rowsOf([{ label: "Ley", value: "-12" }],
  [ci("Taylor", "±2.8", "95% interval"), { label: "95% interval", rowLabel: "Ley", value: "±1.9" }], true);
assert.equal(singularPlural.rows.at(-1).label, "95% intervals", "two named fallback intervals take the plural");
assert.equal(singularPlural.rows.at(-1).value, "Taylor ±2.8, Ley ±1.9");
assert.equal(singularPlural.rows.find((r) => r.label === "Ley").interval, undefined, "no Taylor/Ley slot or positional inference");

const legacy = rowsOf([{ label: "Labor", value: "28%" }], [{ label: "Field", value: "8–12 Nov" }], false);
assert.deepEqual(legacy.rows, [{ label: "Labor", value: "28%" }, { label: "Field", value: "8–12 Nov" }]);
assert.equal(legacy.ciKey, null, "unannotated tooltips bypass the new fit machinery");

console.log("PASS: tooltip interval ownership, sorted labels, labelled fallback and legacy extras");
