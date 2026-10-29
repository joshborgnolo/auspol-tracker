#!/usr/bin/env node
/* test-essential-oneoffs-adjudicate.mjs — pins .build/essential-oneoffs.mjs's
   adjudication lanes (--cases emission, --decisions apply) and the auto
   ledger's hand-precedence, hermetically: ESSENTIAL_ONEOFFS_TEST_HIDE hides
   one hand stanza so a fresh-ledger run meets a real pending dataset, and
   OUT/LEDGER env targets keep every write in a per-test temp dir.

   Pinned behaviour (2026-10-29, the lane's ship day):
     baseline      – the builder stays green; hidden stanza → exit 2, a
                     case file of words only (never a figure field);
     valid verdict – applies into the ledger with provenance, the stanza
                     emits into the store, plain re-run is idempotent, and
                     replaying the same verdict applies nothing;
     bad verdicts  – poisoned keys, unknown theme, bad id shape, an id a
                     hand stanza already owns, a ds that is not pending: all
                     are invalid, apply nothing, and the audit gate stays 2. */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUILDER = ".build/essential-oneoffs.mjs";
const TEST_DS = "social_and_economic_inequality";

const tmp = mkdtempSync(path.join(tmpdir(), "eo-adj-"));
const envBase = {
  ...process.env,
  ESSENTIAL_ONEOFFS_LEDGER: path.join(tmp, "ledger.json"),
  ESSENTIAL_ONEOFFS_OUT: path.join(tmp, "store.json"),
  ESSENTIAL_ONEOFFS_TEST_HIDE: TEST_DS,
};

function run(args, env, okExit = null) {
  let out = "", code = 0;
  try { out = execFileSync("node", [BUILDER, ...args], { cwd: root, env, encoding: "utf8" }); }
  catch (e) { code = e.status; out = (e.stdout || "") + (e.stderr || ""); }
  if (okExit != null) assert.equal(code, okExit, `exit ${code} (want ${okExit}) for ${args.join(" ")}\n${out.slice(-600)}`);
  return { code, out };
}

const CASES = path.join(tmp, "cases.json");
const VERDICT = path.join(tmp, "verdict.json");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 0 — without the test hook the builder is green as ever (default env)
let r = run(["--check"], { ...process.env }, 0);
assert.match(r.out, /entries across \d+ waves/);

// 1 — hiding a hand stanza makes its dataset pending: exit 2, case recorded
r = run(["--check", "--cases", CASES], envBase, 2);
assert.match(r.out, new RegExp(`unadjudicated dataset "social_and_economic_inequality"`));
const cases = JSON.parse(readFileSync(CASES, "utf8"));
assert.equal(cases.cases.length, 1, "exactly one pending case");
const c0 = cases.cases[0];
assert.equal(c0.ds, TEST_DS);
assert.ok(Array.isArray(c0.titles) && Array.isArray(c0.waves) && typeof c0.question === "string", "case is words only");
assert.ok(JSON.stringify(c0).indexOf('"%') < 0 && !("val" in c0) && !("figures" in c0), "the case carries no figure field");

// 2 — a structurally sane verdict applies and files the stanza
writeFileSync(VERDICT, JSON.stringify({ decisions: [
  { ds: TEST_DS, id: "inequality", theme: "trust-democracy", note: "Pinned test stanza." },
] }));
r = run(["--cases", CASES, "--decisions", VERDICT], envBase, 0);
assert.match(r.out, /decisions: applied 1 stanza\(s\)/);
assert.ok(existsSync(tmp + "/ledger.json"), "the ledger was written");
const ledger = JSON.parse(readFileSync(tmp + "/ledger.json", "utf8"));
assert.equal(ledger.stanzas.length, 1);
assert.deepEqual(
  [ledger.stanzas[0].id, ledger.stanzas[0].ds, ledger.stanzas[0].theme, ledger.stanzas[0].adjudicatedBy],
  ["inequality", TEST_DS, "trust-democracy", "matilda"],
  "the stanza carries id, ds, theme and the matilda provenance stamp");
const store = JSON.parse(readFileSync(tmp + "/store.json", "utf8"));
assert.ok(store.entries.some((e) => e.id === "inequality" && e.waveDate === "2026-10-27"),
  "the adjudicated entry emits into the store at its wave");

// 3 — with the stanza on board, plain re-runs are green and replays no-op
r = run(["--check", "--cases", CASES], envBase, 0);
assert.doesNotMatch(r.out, /unadjudicated/);
r = run(["--check", "--decisions", VERDICT], envBase, 0);
assert.match(r.out, /not pending/, "replaying an applied verdict applies nothing");

// 4 — invalid verdicts: poisoned keys, unknown theme, bad id, hand-owned id, hidden-already ds out of the wave
for (const [label, body, expectRe] of [
  ["poisoned keys", { decisions: [{ ds: TEST_DS, id: "x-new", theme: "cut", alp: 52 }] }, /verdict invalid \(unexpected keys\)/],
  ["unknown theme", { decisions: [{ ds: TEST_DS, id: "x-new", theme: "sports" }] }, /theme "sports" unknown/],
  ["bad id", { decisions: [{ ds: TEST_DS, id: "X-BAD!", theme: "cut" }] }, /id "X-BAD!" bad shape/],
  ["hand-owned id", { decisions: [{ ds: TEST_DS, id: "us-midterms", theme: "cut" }] }, /already owned by a hand stanza/],
  ["ds not pending", { decisions: [{ ds: "views_on_regulating_social_media_companies", id: "x-new", theme: "cut" }] }, /is not pending/],
]) {
  // ledger carries just the stanza from step 2; TEST_DS is now adjudicated,
  // so a fresh "pending" is re-created: strip the ledger for these lanes
  rmSync(tmp + "/ledger.json", { force: true });
  writeFileSync(VERDICT, JSON.stringify(body));
  r = run(["--check", "--decisions", VERDICT], envBase, 2);
  assert.match(r.out, expectRe, `lane ${label}`);
  assert.ok(!existsSync(tmp + "/ledger.json"), `lane ${label}: no ledger written for a bad verdict`);
}

rmSync(tmp, { recursive: true, force: true });
console.log("test-essential-oneoffs-adjudicate: ok (pending→verdict→apply round trip, replays no-op, invalid verdicts refused)");
