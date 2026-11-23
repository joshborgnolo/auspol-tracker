/* Pins the primary vote by group through the past terms:
   data/group-history-model.json (.build/build-group-history.mjs) must be
   current with its four inputs (history-polls-2004-2025, group-history-waves,
   aes-groups-history, age-dist), and every term's national and group lines
   must sit inside the term with shares that add to about 100.
   Run: node .build/test-group-history.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (f) => fs.readFileSync(path.join(ROOT, "data", f), "utf8");
const srcs = ["history-polls-2004-2025.json", "group-history-waves.json", "aes-groups-history.json", "age-dist.json"].map(rd);
const M = JSON.parse(rd("group-history-model.json"));
assert.equal(M.input, createHash("sha1").update(srcs.join("\u0000")).digest("hex").slice(0, 12),
  "data/group-history-model.json is stale: run node .build/build-group-history.mjs");
const AES = JSON.parse(srcs[2]);
assert.ok(Object.keys(AES.elections).length >= 12, "the Election Study's waves are on file");
const row = (r, id) => {
  const v = r.slice(1, 6), ci = r.slice(6, 11);
  const sum = v.reduce((a, x) => a + (x || 0), 0);
  assert.ok(Math.abs(sum - 100) <= 0.6, `${id} ${r[0]}: shares add to ${sum.toFixed(1)}`);
  v.forEach((x, i) => { if (x != null) { assert.ok(x >= 0 && x <= 90, `${id} ${r[0]}: a share in range`); assert.ok(ci[i] >= 0 && ci[i] < 25, `${id} ${r[0]}: a band in range`); } });
};
let groups = 0;
for (const t of M.terms) {
  assert.ok(t.from < t.to && Array.isArray(t.parties), `term ${t.year}: election to election`);
  for (const r of t.national) { assert.ok(r[0] >= t.from.slice(0, 7) && r[0] <= t.to.slice(0, 7), `term ${t.year} national ${r[0]} inside`); row(r, `term ${t.year} national`); }
  for (const [setId, gs] of Object.entries(t.sets)) for (const [g, c] of Object.entries(gs)) {
    groups++;
    assert.ok(c.months.length >= 2 && c.houses.length, `term ${t.year} ${setId}|${g}: a line`);
    for (const r of c.months) row(r, `term ${t.year} ${setId}|${g}`);
  }
}
console.log(`PASS: group history – ${M.terms.length} terms, ${groups} group lines, model file current with its inputs`);
