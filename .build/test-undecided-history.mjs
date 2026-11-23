/* Pins the Decidedness panel's past terms: data/undecided-history.json (each
   past poll's printed undecided share and its basis) and the modelled lines
   built from it, data/undecided-history-model.json
   (.build/build-undecided-history.mjs). The model file must be current with
   its input, every wave must say what it measures, and every term's lines
   must sit inside the term with sane figures.
   Run: node .build/test-undecided-history.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "data", "undecided-history.json"), "utf8");
const W = JSON.parse(src), M = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "undecided-history-model.json"), "utf8"));
assert.equal(M.input, createHash("sha1").update(src).digest("hex").slice(0, 12),
  "data/undecided-history-model.json is stale: run node .build/build-undecided-history.mjs");
assert.ok(Array.isArray(W.waves) && W.waves.length > 500, "the history holds the past terms' polls");
const BASES = new Set(["first", "leaner", "none"]);
for (const w of W.waves) {
  const id = `${w.house} ${w.end}`;
  assert.ok(w.house && /^\d{4}-\d{2}-\d{2}$/.test(w.end), id + ": house and fieldwork end");
  assert.ok(BASES.has(w.basis), id + ": basis is first, leaner or none");
  if (w.basis === "none") assert.equal(w.und, null, id + ": no undecided option, no figure");
  else if (w.und != null) assert.ok(w.und > 0 && w.und < 30, id + ": an undecided share between 0 and 30 (a zero is a figure not printed)");
  assert.ok(!w.start || w.start <= w.end, id + ": fieldwork start before its end");
  assert.ok(w.src, id + ": a source");
}
const E = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).elections).map((e) => e.date).sort();
let prev = "";
for (const t of M.terms) {
  assert.ok(t.from > prev && E.includes(t.from) && E.includes(t.to), `term ${t.year}: election to election, in order`);
  prev = t.from;
  for (const [basis, s] of Object.entries(t.series)) {
    assert.ok(basis === "first" || basis === "leaner", `term ${t.year}: basis ${basis}`);
    assert.ok(s.months.length >= 2 && s.n >= 4 && s.houses.length, `term ${t.year} ${basis}: a line from four or more polls`);
    for (const [ym, v, lo, hi] of s.months) {
      assert.ok(ym >= t.from.slice(0, 7) && ym <= t.to.slice(0, 7), `term ${t.year} ${basis} ${ym}: inside the term`);
      assert.ok(lo <= v && v <= hi && lo >= 0 && hi < 30, `term ${t.year} ${basis} ${ym}: ${lo} ≤ ${v} ≤ ${hi}`);
    }
  }
}
console.log(`PASS: undecided history – ${W.waves.length} past polls, ${M.terms.length} terms modelled, model file current with its input`);
