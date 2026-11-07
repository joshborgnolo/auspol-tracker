// Urban outlines: cache bootstrap, retry after a failed download, and map-only hits.
// Run: node .build/test-map-urban.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(ROOT, ".build/map/app/app-2-map.js"), "utf8");
const urban = source.slice(source.indexOf("let URBAN ="), source.indexOf("/* ----- the streets -----"));
let requests = 0, resolve, reject, paints = 0;
const context = vm.createContext({
  S: { view: "map" }, morph: null,
  schedule() { paints++; },
  getJSON() { requests++; return new Promise((yes, no) => { resolve = yes; reject = no; }); },
});
const run = (code) => vm.runInContext(code, context);
run(urban);
run("townHits.push([7, 10, 20, 30, 40])");
assert.equal(run("townAtPoint(20, 30)"), 7);
for (const view of ["chamber", "list"]) {
  context.S.view = view;
  assert.equal(run("townAtPoint(20, 30)"), -1, `${view} ignores stale map targets`);
}
context.S.view = "map";
context.morph = {};
assert.equal(run("townAtPoint(20, 30)"), -1, "a morph has no town labels to click");
context.morph = null;
assert.equal(run("townAtPoint(20, 30)"), 7);
assert.equal(run("townAtPoint(31, 30)"), -1);

assert.equal(run("urbanEntry(0)"), null);
assert.equal(requests, 0, "drawing alone does not request outlines");
run("loadUrban(); loadUrban()");
assert.equal(requests, 1, "selections share an in-flight download");
reject(new Error("temporary 503"));
await run("urbanP");
assert.equal(run("urbanP"), null, "failure releases the in-flight request");
for (let i = 0; i < 10; i++) assert.equal(run("urbanEntry(0)"), null);
assert.equal(requests, 1, "failed download does not retry on every paint");
run("loadUrban()");
assert.equal(requests, 2, "a subsequent selection retries");
resolve({ u: [[[[15100000, -3300000, 100, 0, 0, 100, -100, -100]]]] });
await run("urbanP");
assert.equal(paints, 1, "successful download schedules the outline");
assert.deepEqual(Array.from(run("urbanEntry(0)[0]")), [151, -33, 151.001, -33, 151.001, -32.999, 151, -33]);
run("loadUrban()");
assert.equal(requests, 2, "loaded geometry is reused");

// Run the real builder in a fresh tree with a deterministic ArcGIS response.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "map-urban-test-"));
try {
  fs.mkdirSync(path.join(tmp, ".build/map"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "maps/data"), { recursive: true });
  const builder = path.join(tmp, ".build/map/urban_build.mjs");
  fs.copyFileSync(path.join(ROOT, ".build/map/urban_build.mjs"), builder);
  fs.writeFileSync(path.join(tmp, "maps/data/places.json"), JSON.stringify({ p: [["Test town", 151.005, -32.995, 1000, "NSW", [151, -33, 151.01, -32.99]]] }));
  const fixture = { features: [{ geometry: { type: "Polygon", coordinates: [[[151, -33], [151.01, -33], [151.01, -32.99], [151, -32.99], [151, -33]]] } }] };
  const mock = path.join(tmp, "fetch.mjs"), calls = path.join(tmp, "calls.txt");
  fs.writeFileSync(mock, `import fs from 'node:fs';
globalThis.fetch = async (url) => {
  if (!String(url).startsWith('https://geo.abs.gov.au/')) throw new Error('Expected the remote ABS URL');
  fs.appendFileSync(${JSON.stringify(calls)}, 'fetch\\n');
  return {ok: process.env.URBAN_TEST_STATUS !== '503', status: 503, json: async () => (${JSON.stringify(fixture)})};
};`);
  const build = (env = {}) => spawnSync(process.execPath, ["--import", mock, builder], { encoding: "utf8", env: { ...process.env, ...env } });
  let result = build();
  assert.equal(result.status, 0, result.stderr);
  const cache = path.join(tmp, ".build/map/src/urban/ucl-2021.geojson");
  assert.deepEqual(JSON.parse(fs.readFileSync(cache, "utf8")), fixture);
  const out = JSON.parse(fs.readFileSync(path.join(tmp, "maps/data/urban.json"), "utf8"));
  assert.equal(out.u.length, 1);
  assert.ok(out.u[0]?.[0]?.[0]?.length >= 8, "fresh build emits an outline");
  result = build({ URBAN_TEST_STATUS: "503" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(calls, "utf8"), "fetch\n", "cached build makes no network request");
  fs.unlinkSync(cache);
  result = build({ URBAN_TEST_STATUS: "503" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ArcGIS 503/);
  assert.ok(!fs.existsSync(cache), "failed download does not poison the cache");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log("Urban outlines: bootstrap, cached build, failure/retry, decoding and view hit-testing passed.");
