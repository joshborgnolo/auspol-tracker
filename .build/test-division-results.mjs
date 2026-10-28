// Test for data/division-results.json — run from repo root:
//   node .build/extract-division-results.mjs && node .build/test-division-results.mjs
// Re-derives every row from the committed DIVS.TXT inputs with its OWN parser
// (never imports .build/extract-division-results.mjs), deep-equals them to
// the store, re-asserts the row invariants, checks the 1996/1998 name+state
// sets against data/division-classifications.json, recomposes the national
// 2PP against the site's canonical records, and pins era cells by hand
// (Banks-93 60.54 / Blaxland-93 72.10 / Berowra-93 37.80, Namadgi-96 null
// turnoutSwing, Newcastle-98's five null TPP cells — the AEC counts no
// Labor-v-Coalition pair there, never reconstructed).

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

let checks = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error(`test-division-results: ${msg}`);
  checks++;
};

const YEARS = [1993, 1996, 1998];
const PATH = (y) => `.build/aec-flow-src/divs-${y}.txt`;
const CHAMBER = { 1993: 147, 1996: 148, 1998: 148 };
const PC_TOL = 0.02;
const EMITTED_NO_TPP = { 1998: new Set(["Newcastle"]) };

// independent parser — no import from the generator
function reparse(year) {
  const rows = {};
  for (const line of readFileSync(PATH(year), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("State;")) continue;
    const c = line.split(";");
    const [state, div] = c;
    const num = (i) => parseInt(c[i], 10);
    const pc = (i) => (c[i] === "" ? null : parseFloat(c[i]));
    rows[div] = {
      state,
      enrolment: num(2),
      formalVote: num(3),
      informalVote: num(4),
      totalVote: num(5),
      formalPc: pc(6),
      formalSwing: pc(7),
      informalPc: pc(8),
      informalSwing: pc(9),
      turnout: pc(10),
      turnoutSwing: pc(11),
      alpTppVote: num(12),
      coalitionTppVote: num(13),
      tppExhausted: num(14),
      alpTppPc: pc(15),
      alpSwing: pc(16),
    };
  }
  return rows;
}

const store = JSON.parse(readFileSync("data/division-results.json", "utf8"));

// 1. skeleton
ok(JSON.stringify(Object.keys(store.elections)) === JSON.stringify(["1993", "1996", "1998"]),
  "elections keys are not the three years in order");
for (const y of YEARS)
  ok(Object.keys(store.elections[y]).length === CHAMBER[y],
    `${y}: store has ${Object.keys(store.elections[y]).length} divisions, chamber is ${CHAMBER[y]}`);
ok(typeof store._about === "string" && store._about.length > 100, "_about missing");
ok(store._provenance.generator === ".build/extract-division-results.mjs", "provenance generator wrong");

// 2. provenance re-hash (sha256-16 of the live inputs)
for (const y of YEARS) {
  const live = createHash("sha256").update(readFileSync(PATH(y))).digest("hex").slice(0, 16);
  ok(store._provenance.inputs[PATH(y)] === `sha256:${live}`,
    `${y}: provenance hash drifted for ${PATH(y)}`);
  ok(Object.keys(store._provenance.inputs).length === 3, "provenance must name exactly the three inputs");
}

// 3. per-row invariants on the STORE cells (independent of reparse)
const SWING_KEYS = ["formalSwing", "informalSwing", "turnoutSwing"];
const TPP_KEYS = ["alpTppVote", "coalitionTppVote", "tppExhausted", "alpTppPc"];
const ALWAYS_NUMBER = [
  "state", "enrolment", "formalVote", "informalVote", "totalVote",
  "formalPc", "informalPc", "turnout",
];
for (const y of YEARS) {
  for (const [div, r] of Object.entries(store.elections[y])) {
    for (const k of ALWAYS_NUMBER)
      ok(typeof r[k] === "number" || k === "state", `${y} ${div}: ${k} must never be null`);
    for (const k of SWING_KEYS)
      ok(r[k] === null || typeof r[k] === "number", `${y} ${div}: ${k} must be null or number`);
    const excluded = EMITTED_NO_TPP[y]?.has(div) ?? false;
    if (excluded) {
      for (const k of [...TPP_KEYS, "alpSwing"])
        ok(r[k] === null, `${y} ${div}: TPP-excluded row must carry null ${k}`);
      continue;
    }
    for (const k of TPP_KEYS)
      ok(typeof r[k] === "number", `${y} ${div}: ${k} may not be null outside the excluded row`);
    ok(r.alpSwing === null || typeof r.alpSwing === "number", `${y} ${div}: alpSwing domain`);
    ok(r.formalVote + r.informalVote === r.totalVote, `${y} ${div}: votes don't recompose`);
    ok(Math.abs((100 * r.formalVote) / r.totalVote - r.formalPc) < PC_TOL, `${y} ${div}: formalPc drift`);
    ok(Math.abs((100 * r.totalVote) / r.enrolment - r.turnout) < PC_TOL, `${y} ${div}: turnout drift`);
    ok(r.alpTppVote + r.coalitionTppVote + r.tppExhausted === r.formalVote,
      `${y} ${div}: TPP trio must recompose the formal vote`);
    ok(Math.abs((100 * r.alpTppVote) / (r.alpTppVote + r.coalitionTppVote) - r.alpTppPc) < PC_TOL,
      `${y} ${div}: TPP share drift`);
  }
}

// 4. deep-equal: store rows vs independent reparse (null-TTP rows expected
//    zero-printed in the file and null in the store)
for (const y of YEARS) {
  const live = reparse(y);
  for (const [div, got] of Object.entries(store.elections[y])) {
    const want = live[div];
    ok(want, `${y} ${div}: division not in ${PATH(y)}`);
    for (const k of ["state", "enrolment", "formalVote", "informalVote", "totalVote",
      "formalPc", "formalSwing", "informalPc", "informalSwing", "turnout", "turnoutSwing"])
      assert.deepEqual(got[k], want[k], `${y} ${div}: ${k} differs from the committed input`);
    if (EMITTED_NO_TPP[y]?.has(div)) {
      ok(want.alpTppVote === 0 && want.coalitionTppVote === 0 && want.tppExhausted === 0
        && want.alpTppPc === 0, `${y} ${div}: excluded row must print 0 TPP cells in the file`);
    } else {
      for (const k of [...TPP_KEYS, "alpSwing"])
        assert.deepEqual(got[k], want[k], `${y} ${div}: ${k} differs from the committed input`);
    }
    checks++;
  }
}

// 5. 1996/1998 join vs the AEC division-classifications blocks (name + state)
const cls = JSON.parse(readFileSync("data/division-classifications.json", "utf8")).elections;
for (const y of [1996, 1998]) {
  const blk = cls[String(y)];
  ok(blk != null, `${y}: classifications block missing`);
  const fromStore = new Set(Object.keys(store.elections[y]));
  const fromCls = new Set(Object.keys(blk));
  assert.deepEqual(fromStore, fromCls,
    `${y}: division name set drifted vs division-classifications (store-only: ${[...fromStore].filter((d) => !fromCls.has(d)).slice(0, 3)}, cls-only: ${[...fromCls].filter((d) => !fromStore.has(d)).slice(0, 3)})`);
  for (const div of fromStore)
    ok(store.elections[y][div].state === blk[div].state, `${y} ${div}: state disagrees with classifications`);
  checks++;
}

// 6. 1993 era-name pins — no classifications block exists before 1996
{
  const names = new Set(Object.keys(store.elections["1993"]));
  ok(!names.has("Namadgi"), "1993: Namadgi must be ABSENT (created for 1996)");
  ok(!names.has("Blair"), "1993: Blair must be ABSENT (created for 1998)");
  ok(names.has("Northern Territory"), "1993: single-seat Northern Territory must be present");
  ok(!names.has("Solomon") && !names.has("Lingiari"), "1993: Solomon/Lingiari must be ABSENT (created for 2001)");
  // every 1993 name still in force in 1996 must carry the same state
  const c96 = cls["1996"];
  for (const [div, r] of Object.entries(store.elections["1993"]))
    if (c96[div]) ok(r.state === c96[div].state, `1993 ${div}: state disagrees with its 1996 block entry`);
}

// 7. national 2PP recompose vs the site's canonical records
//    (1998's sum covers 147 divisions — Newcastle's non-existence is the
//    product's, mirroring the HTPP lane's recompose tolerance)
const POLL_ELS = JSON.parse(readFileSync("data/polls.json", "utf8")).elections;
for (const y of YEARS) {
  let a = 0, c = 0;
  for (const r of Object.values(store.elections[y]))
    if (r.alpTppVote !== null) { a += r.alpTppVote; c += r.coalitionTppVote; }
  const derived = (100 * a) / (a + c);
  const rec = POLL_ELS[`e${y}`];
  ok(rec && typeof rec.tpp_alp === "number", `${y}: no canonical tpp_alp in polls.json`);
  ok(Math.abs(derived - rec.tpp_alp) < 0.06,
    `${y}: division-summed 2PP ${derived.toFixed(3)} != canonical ${rec.tpp_alp}`);
  console.log(`  ${y} national 2PP: divisions sum to ${derived.toFixed(3)} vs canonical ${rec.tpp_alp} (${Math.abs(derived - rec.tpp_alp).toFixed(3)} drift)`);
}

// 8. hand-pinned era cells
const PIN = store.elections;
const pin = (y, div, k) => PIN[y][div][k];
ok(pin("1993", "Banks", "enrolment") === 79242, "Banks-93 enrolment");
ok(pin("1993", "Banks", "alpTppPc") === 60.54, "Banks-93 alpTppPc");
ok(pin("1993", "Banks", "turnout") === 96.44, "Banks-93 turnout");
ok(pin("1993", "Blaxland", "alpTppPc") === 72.1, "Blaxland-93 alpTppPc");
ok(pin("1993", "Berowra", "alpTppPc") === 37.8, "Berowra-93 alpTppPc");
ok(pin("1993", "Northern Territory", "turnout") === 88.79, "NT-93 turnout");
ok(pin("1996", "Namadgi", "alpTppPc") === 51.51, "Namadgi-96 alpTppPc");
ok(pin("1996", "Namadgi", "turnoutSwing") === null, "Namadgi-96 turnoutSwing null");
ok(pin("1996", "Namadgi", "alpSwing") === -9.28, "Namadgi-96 alpSwing");
ok(pin("1996", "Northern Territory", "alpTppPc") === 49.63, "NT-96 alpTppPc");
ok(pin("1998", "Newcastle", "alpTppVote") === null, "Newcastle-98 TPP null");
ok(pin("1998", "North Sydney", "alpTppPc") === 37.78, "North Sydney-98 alpTppPc");
ok(pin("1998", "North Sydney", "tppExhausted") === 0, "North Sydney-98 no exhaustion");
console.log(`test-division-results: ${checks} checks green — 147+148+148 divisions, 1993/1996/1998,` +
  ` 1996/1998 joined to division-classifications, national 2PP recomposed`);
