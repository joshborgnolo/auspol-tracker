#!/usr/bin/env node
// test-map-occ — the /map/ census Occupation lens' class lattice:
// occ_lanes.py's own self-test runs green, and the 43-code partition is
// independently re-derived here from the module's source text (a drifted
// class table fails from OUTSIDE the module's own assert chain, so a bad
// edit inside occ_lanes.py can't launder itself).
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const MOD = path.join(REPO, ".build/map/occ_lanes.py");
const src = fs.readFileSync(MOD, "utf8");

const out = execFileSync("python3", ["-I", MOD], { encoding: "utf8" });
assert.ok(out.includes("occ_lanes self-test ok"), `occ_lanes self-test failed:\n${out}`);

// --- scrape the module's own literal tables (cheap, format-pinned) ----
const submajors = [...src.matchAll(/^\s+(\d{2}): "/gm)].map((m) => Number(m[1]));
assert.equal(submajors.length, 43, "SUBMAJORS must carry 43 codes");
assert.deepEqual([...new Set(submajors)].sort((a, b) => a - b),
  submajors.slice().sort((a, b) => a - b), "SUBMAJORS keys collide");

const clsBlock = src.match(/OCC_CLASSES = \{([\s\S]*?)\n\}\n/)[1];
const classes = {};
for (const m of clsBlock.matchAll(/"(\w+)":\s*\{[^}]*?"codes":\s*\(([^)]*)\)/g)) {
  classes[m[1]] = m[2].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
}
assert.deepEqual(Object.keys(classes),
  ["socprof", "biztech", "farmer", "farmwrk", "hospmgr", "trades", "routine"],
  "the seven classes, in menu order");
const classSet = new Set(Object.values(classes).flat());
const resBlock = src.match(/OCC_RESIDUAL = \(([^)]*)\)/)[1];
const residual = new Set(resBlock.match(/\d+/g).map(Number));
assert.equal(residual.size, 19, "residual drifts off 19 sub-majors");
for (const c of residual) assert.ok(!classSet.has(c), `code ${c} in class AND residual`);
const universe = new Set([...classSet, ...residual]);
assert.deepEqual([...universe].sort((a, b) => a - b),
  [...submajors].sort((a, b) => a - b),
  "classes ∪ residual != the canonical 43 sub-major groups");
assert.equal(classSet.size, 24, "the seven classes name 24 sub-majors");
// the user-specified memberships: farm labourers kept apart from routine
assert.ok(classes.farmwrk.includes(84) && !classes.routine.includes(84),
  "sub-major 84 is farmwrk, never routine");

// --- provenance homes --------------------------------------------------
for (const p of [".build/map/src/census-occ/README.md",
                 ".build/map/src/census-occ/testdata/toy.csv"]) {
  assert.ok(fs.existsSync(path.join(REPO, p)), `${p} missing`);
}
console.log("test-map-occ ok: class lattice pinned, module self-test green");
