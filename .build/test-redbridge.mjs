/* Unit test for extract-redbridge.mjs parsers, run against the cached July
   2026 wave PDF text (the wave already committed to data/polls.json in
   8abac0f). Asserts the parsers recover exactly the committed values, and
   that the safety guard passes the wave. Run: node .build/test-redbridge.mjs */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

process.env.RB_LIB = "1";
const { parsePdf, guardNewWave } = await import("./extract-redbridge.mjs");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC_DIR = path.join(ROOT, ".build", "redbridge-src");

let txtPath = null;
if (existsSync(SRC_DIR)) {
  const hit = readdirSync(SRC_DIR).find((f) => f.includes("july-2026") && f.endsWith(".txt"));
  if (hit) txtPath = path.join(SRC_DIR, hit);
}
if (!txtPath) {
  const probe = path.join(ROOT, ".matilda", "probe", "july-full.txt");
  if (existsSync(probe)) txtPath = probe;
}
assert.ok(txtPath, "no July 2026 PDF text cache found – run node .build/extract-redbridge.mjs --check first");
console.log(`parsing ${txtPath}`);

const notes = [];
const w = parsePdf(readFileSync(txtPath, "utf8"), "july-2026-federal-poll", notes);
if (notes.length) console.log("notes:", notes);
console.log(JSON.stringify(w, null, 2));

// methodology
assert.equal(w.date, "2026-07-30", "fieldwork end");
assert.equal(w.dateStart, "2026-07-27", "fieldwork start");
assert.equal(w.sample, 1001, "sample");

// Table 2 wave row (values committed to data/polls.json)
assert.equal(w.label, "Jul 2026", "wave label");
assert.equal(w.alp, 29); assert.equal(w.lnp, 22); assert.equal(w.grn, 10);
assert.equal(w.onp, 31); assert.equal(w.ind, 8);
assert.equal(w.tppResp, 48, "respondent-allocated TPP");
assert.equal(w.tppVsOn, 53, "ALP-vs-One-Nation TPP");

// PPM (Albanese 32, Taylor 15, Hanson 24)
assert.deepEqual(w.ppm, { alb: 32, opp: 15, han: 24 });
assert.equal(w.oppName, "Taylor");

// Table 5 net favourabilities (-19 / -6 / -10 – matches committed rows)
assert.deepEqual(w.nets, { alb: -19, opp: -6, han: -10 });
// detail is Table-5-derived (very+mostly favourable / mostly+very
// unfavourable). NOTE: the committed July row's detail (40/59, 30/36, 40/50)
// was eyeballed from the report figures and intentionally does NOT match;
// the extractor's verify step reports that as a mismatch note but never
// overwrites. Below are the true Table 5 totals.
assert.deepEqual(w.detail, {
  alb: { app: 30, dis: 49 }, opp: { app: 20, dis: 26 }, han: { app: 36, dis: 46 },
});

// the safety guard must accept this wave
const guardErrs = guardNewWave(w, "2026-08-02");
assert.deepEqual(guardErrs, [], `guard errors: ${guardErrs.join(" | ")}`);

console.log("PASS: July 2026 wave parses to the committed values and passes the guard");
