import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

process.env.SPECTRE_LIB = "1";
const { parseReport, pollRows, guardNewWave, figureDiffs } = await import("./extract-spectre.mjs");

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const readWave = (slug) => parseReport(readFileSync(`.build/spectre-src/${slug}-report.txt`, "utf8"), slug, D);

const nov = readWave("australian-federal-political-update-november-2026-lrxjw-682xb");
assert.equal(nov.date, "2026-11-03");
assert.equal(nov.dateStart, "2026-10-28");
assert.equal(nov.sample, 2093);
assert.deepEqual(nov.direction, { right: 21, wrong: 64, unsure: 15 });
assert.deepEqual(nov.firmness, {
  all: [57, 43],
  alp: [60, 40],
  lnp: [61, 39],
  onp: [72, 28],
  grn: [60, 40],
});
assert.deepEqual(nov.tppUndecided, { lnponp: 13, alponp: 9 });
assert.deepEqual(guardNewWave(nov, "2026-11-09T09:13"), []);

const rows = pollRows(nov, { link: "https://example.test/spectre" });
assert.deepEqual(rows.direction, {
  date: "2026-11-03",
  dateStart: "2026-10-28",
  pollster: "Spectre Strategy",
  right: 21,
  wrong: 64,
  unsure: 15,
});
assert.deepEqual(rows.polls.firmness, nov.firmness);
assert.deepEqual(rows.ppm, {
  date: "2026-11-03",
  firm: "Spectre Strategy",
  alb: 34,
  opp: 22,
  oppName: "Taylor",
  han: 30,
  extra: null,
});
assert.equal(rows.ppmHeadToHead, null, "a three-way squeeze must not mint a head-to-head row");
nov.published = "2026-11-09T09:13";
assert.deepEqual(figureDiffs("2026-11-03", nov, D), []);

const july = readWave("australian-federal-political-update-april-2026-lrxjw");
assert.equal(july.date, "2026-07-23");
assert.equal(july.undecided, 7, "July 2026 reads its 7% across the interleaved One Nation label");
assert.equal(nov.undecided, 6, "November 2026 keeps its 6% before-apportionment figure");
assert.deepEqual(july.direction, { right: 29, wrong: 57, unsure: 14 });
assert.deepEqual(july.firmness, {
  all: [60, 40],
  alp: [73, 27],
  lnp: [65, 35],
  onp: [69, 31],
  grn: [59, 41],
});
assert.deepEqual(july.tppUndecided, { lnponp: 11, alponp: 7 });
const april = readWave("australian-federal-political-update-april-2026");
assert.equal(april.date, "2026-04-08");
assert.equal(april.undecided, 7, "April uses the primary chart's 7%, never the TPP page's 11%");
assert.deepEqual(april.firmness, { all: [61, 39], alp: [64, 36], lnp: [58, 42], onp: [75, 25], grn: [71, 29] });
assert.deepEqual(april.tppUndecided, { lnponp: 13, alponp: 10 });
for (const w of [july, april]) {
  assert.ok(!figureDiffs(w.date, w, D).some((d) => d.key === "polls.undecided"),
    `${w.date}: the parsed and canonical undecided figures agree after backfill`);
}
for (const [date, value] of [["2025-07-01", 7], ["2026-04-08", 7], ["2026-07-23", 7], ["2026-11-03", 6]]) {
  const row = D.polls.find((p) => p.pollster === "Spectre Strategy" && p.date === date);
  assert.equal(row?.undecided, value, `${date}: canonical Spectre undecided share`);
}
const nov2025 = D.polls.find((p) => p.pollster === "Spectre Strategy" && p.date === "2025-11-17");
assert.ok(nov2025 && nov2025.undecided == null, "November 2025 is not published, not zero");

const ledger = readFileSync(".build/newtracker/assets/rd-allpolls.jsx", "utf8");
const decidedStart = ledger.indexOf("function rdLgDecided(p) {");
assert.ok(decidedStart >= 0, "ledger decidedness renderer exists");
const decided = new Function(`return (${ledger.slice(decidedStart, ledger.indexOf("\nconst RD_LG_CK", decidedStart))});`)();
assert.deepEqual(decided({ pollster: "Spectre Strategy", firmAll: [57, 43], undecided: 6 }), {
  h: "Primary-vote shares are decideds’. 6% undecided, excluded", w: "", d: null,
  s: "57% firm, 43% soft (soft includes undecided respondents)",
});

console.log("PASS: Spectre figures reconcile and the firmness ledger uses undecided-excluded wording");
