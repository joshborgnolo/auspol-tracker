// data/life-satisfaction.json — every published mean is separately sourced
import fs from "node:fs";
import assert from "node:assert/strict";
const d = JSON.parse(fs.readFileSync(new URL("../data/life-satisfaction.json", import.meta.url), "utf8"));
const S = d.series;
assert.ok(Array.isArray(S) && S.length >= 4, "ANUpoll, HILDA, GSS and Scanlon series");
for (const id of ["anupoll", "hilda", "abs-gss", "scanlon"]) assert.ok(S.some((s) => s.id === id), id + " series");
const ids = new Set();
for (const s of S) {
  assert.ok(s.id && !ids.has(s.id), "unique id " + s.id); ids.add(s.id);
  for (const key of ["house", "question", "answers", "method", "source"]) assert.ok(s[key], s.id + " has " + key);
  assert.match(s.source, /^https:\/\//, s.id + " source URL");
  assert.equal(s.scaleMax, 10, s.id + " is a mean on the 0–10 scale");
  assert.ok(["line", "dot"].includes(s.role), s.id + " role");
  assert.ok(s.readings.length, s.id + " has readings");
  let last = "";
  const dates = new Set();
  const panelIds = new Set((s.panels || []).map((p) => p.id));
  for (const r of s.readings) {
    assert.match(r.date, /^\d{4}(?:-(?:0[1-9]|1[0-2]))?(?:-(?:0[1-9]|[12]\d|3[01]))?$/, s.id + " date " + r.date);
    assert.ok(r.date >= last, s.id + " readings ordered at " + r.date); last = r.date;
    assert.ok(!dates.has(r.date), s.id + " dates unique at " + r.date); dates.add(r.date);
    assert.ok(typeof r.v === "number" && r.v >= 0 && r.v <= s.scaleMax, s.id + " score " + r.date);
    if (r.n != null) assert.ok(Number.isInteger(r.n) && r.n >= 100 && r.n < 100000, s.id + " sample " + r.date);
    if (s.panels) assert.ok(panelIds.has(r.panel), s.id + " declares panel " + r.panel);
    assert.match(r.source, /^https:\/\//, s.id + " reading source " + r.date);
    assert.ok(r.quote && r.quote.includes(r.date.slice(0, 4)), s.id + " verbatim proof names " + r.date);
    const figures = (r.quote.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    assert.ok(figures.includes(r.v), s.id + " " + r.date + " quote contains " + r.v + ": " + r.quote);
  }
}
for (const s of S.filter((s) => s.role === "line")) assert.ok(s.readings.length >= 4, s.id + " has enough points for a line");
assert.ok(S.find((s) => s.id === "anupoll").panels.length >= 2, "ANUpoll's panel break is declared");
assert.ok(!S.some((s) => s.id.startsWith("demosau")), "DemosAU's 0–100 index stays out of the 0–10 series");
const jsx = fs.readFileSync(new URL("./newtracker/assets/rd-panels.jsx", import.meta.url), "utf8");
assert.match(jsx, /id: "life", label: "Life satisfaction"/);
assert.match(jsx, /function RdLifeSatisfaction\(\)/);
assert.match(jsx, /DemosAU’s 0–100 index sits outside the 0–10 chart/);
assert.match(jsx, /s\.paraphrase \? s\.question/, "a paraphrase is never rendered in quotation marks");
const info = fs.readFileSync(new URL("./newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js", import.meta.url), "utf8");
assert.match(info, /id: "life-satisfaction", term: "Life satisfaction"/);
const demos = JSON.parse(fs.readFileSync(new URL("../data/demosau-one-offs.json", import.meta.url), "utf8")).one_offs.find((e) => e.id === "life-satisfaction");
const all = demos.data.tables.find((t) => t.name === "All Respondents");
assert.ok(Math.abs(all.rows.reduce((sum, r) => sum + +r[1], 0) - 100) < 0.001, "DemosAU distribution sums to 100");
assert.equal(demos.data.tables.find((t) => t.name === "Index scores").rows.find((r) => r[0] === "Life Satisfaction Score")[1], "61.5");
console.log("life-satisfaction: ok (" + S.length + " series, " + S.reduce((n, s) => n + s.readings.length, 0) + " quoted means + DemosAU 61.5/100 snapshot)");
