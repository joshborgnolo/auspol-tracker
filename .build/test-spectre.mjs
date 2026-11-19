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
assert.deepEqual(july.direction, { right: 29, wrong: 57, unsure: 14 });
assert.deepEqual(july.firmness, {
  all: [60, 40],
  alp: [73, 27],
  lnp: [65, 35],
  onp: [69, 31],
  grn: [59, 41],
});

console.log("PASS: Spectre direction, two-way firmness and three-way PPM parse and reconcile");
