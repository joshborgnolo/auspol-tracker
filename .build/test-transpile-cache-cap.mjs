#!/usr/bin/env node
/* test-transpile-cache-cap.mjs — pins the transpile cache's byte cap in
   build.mjs (tcInit). The cache grew to 307MB in five days of Oct 2026
   because the only prune was a fortnight age check; the 2026-10-15 sweep
   reclaim put a 64MB cap on it (LRU over mtimes, applied after the age
   prune). A cache that can only grow by time-bounded accretion is the
   contract; these greps pin that both prunes still exist and in the right
   order. The cap evicts at init, so the cache's steady state is CAP plus
   the current build's fresh writes — live-verified 2026-10-15: 78MB
   seeded junk dropped the cache to the cap at init, and the run's own
   writes left it at 70MB (10 junk files seed → 9 survive init). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "build.mjs"), "utf8");

// the cap constant and the 64MB size
assert.ok(/const TC_CAP_BYTES = 64 \* 1024 \* 1024;/.test(src),
  "build.mjs keeps TC_CAP_BYTES at 64 MiB");

// the age prune still runs (pre-existing behaviour the cap must not replace)
assert.ok(src.includes("14 * 864e5"),
  "the fortnight age prune survives");

// eviction is oldest-first by mtime and removes files until it's under the cap
assert.ok(/entries\.sort\(\(a, b\) => a\.mtimeMs - b\.mtimeMs\)/.test(src),
  "cache eviction sorts oldest-first by mtime");
assert.ok(/if \(bytes <= TC_CAP_BYTES\) break;/.test(src),
  "eviction stops the moment the cache is back under the cap");
assert.ok(/fs\.unlinkSync\(e\.p\)/.test(src) && src.includes("bytes -= e.size"),
  "evicted entries are unlinked and debited from the running size");

// the age prune runs before the byte cap in the same init pass
const ageIdx = src.indexOf("14 * 864e5");
const capIdx = src.indexOf("if (bytes > TC_CAP_BYTES)");
assert.ok(ageIdx !== -1 && capIdx !== -1 && ageIdx < capIdx,
  "init prunes by age first, then by size, in one pass");

console.log("PASS: transpile cache cap – 64 MiB constant, oldest-first eviction inside the cap, age prune intact and first");
