/* Pins for the National-direction panel's group-select payloads in the
   generated 9f09dca2 data asset: directionStates (SEC Newgate's per-State
   series, from data/sec-direction-states.json), directionGroups (Roy Morgan's
   "Analysis by …" gender and voting-intention splits, from
   data/roymorgan-direction-groups.json) and directionStateNote (the latest
   printed state extremes). All are federal-only: a BUILD_JUR=vic run must
   carry none of them.
   Run: node .build/newtracker/test-direction-groups.mjs */
import { readdirSync, readFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const NT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(NT, "..", "..");

/* --- the federal run: read the live data asset the page reads --- */
const dataFile = readdirSync(path.join(NT, "assets"))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
assert.ok(dataFile, "could not find the 9f09dca2 data asset (run the build first)");
const win = {};
new Function("window", readFileSync(path.join(NT, "assets", dataFile), "utf8"))(win);
const D = win.AUSPOL;
assert.ok(D, "AUSPOL missing from the data asset");

const SEC_STATES = ["NSW", "VIC", "QLD", "SA", "WA"];

// ---- directionStates: SEC Newgate per-state, five states, right-only early ----
{
  const ds = D.directionStates;
  assert.ok(ds, "directionStates emitted");
  assert.deepEqual(Object.keys(ds).sort(), [...SEC_STATES].sort(),
    "exactly the five mainland states");
  const bank = JSON.parse(readFileSync(path.join(ROOT, "data", "sec-direction-states.json"), "utf8"));
  for (const st of SEC_STATES) {
    const g = ds[st];
    assert.equal(g.label, st);
    assert.equal(g.series.length, (bank.series[st] || []).length,
      `${st}: the whole bank carries over`);
    assert.ok(g.series.length >= 9, `${st}: a series long enough to chart`);
    assert.deepEqual(g.head, (bank.series[st] || [])[(bank.series[st] || []).length - 1],
      `${st}: head is the bank's latest raw reading`);
    const bankRows = [...(bank.series[st] || [])].sort((a, b) => a.month.localeCompare(b.month));
    assert.deepEqual(g.series.map((p) => [p.ym, p.right, p.wrong]),
      bankRows.map((r) => [r.month, r.right, r.wrong ?? null]),
      `${st}: the series mirrors the bank's figures month for month`);
    let prevX = -Infinity, prevYm = "";
    for (const p of g.series) {
      assert.match(p.ym, /^\d{4}-\d{2}$/, `${st}: month-shaped ym`);
      assert.ok(p.ym > prevYm, `${st}: months ascend`);
      assert.ok(p.x > prevX, `${st}: x follows the month`);
      assert.ok(typeof p.right === "number" && p.right >= 0 && p.right <= 100,
        `${st}: right is a printed share`);
      assert.ok(p.wrong === null || (typeof p.wrong === "number" && p.wrong >= 0 && p.wrong <= 100),
        `${st}: wrong is a printed share or unprinted`);
      assert.ok(!(p.ym > "2026-06" && p.wrong == null),
        `${st}: the paired right/wrong era has both`);
      prevX = p.x; prevYm = p.ym;
    }
  }
  console.log("directionStates: OK");
}

// ---- directionGroups: Roy Morgan's gender pair + voting-intention splits ----
{
  const dg = D.directionGroups;
  assert.ok(dg, "directionGroups emitted");
  const store = JSON.parse(readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8"));
  const waves = Object.entries(store.waves).sort(([a], [b]) => a.localeCompare(b));
  // the groups present are exactly the groups the store's waves print
  const expect = new Set();
  for (const [, w] of waves) {
    if (w.gender) { expect.add("Men"); expect.add("Women"); }
    if (w.vote) for (const k of ["One Nation voters", "Coalition voters", "Other party voters",
                                 "Independent voters", "Greens voters", "Labor voters"]) expect.add(k);
  }
  assert.deepEqual(Object.keys(dg).sort(), [...expect].sort(), "a group per printed block, no others");
  for (const [label, g] of Object.entries(dg)) {
    assert.equal(g.source, "Roy Morgan");
    for (const p of g.series) {
      assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(p.ym, p.date.slice(0, 7), `${label}: ym mirrors the wave date`);
      assert.ok(store.waves[p.date], `${label}: the point's wave is on record`);
      assert.ok(typeof p.wrong === "number" && p.wrong >= 0 && p.wrong <= 100,
        `${label}: wrong rides on Roy Morgan's half-point scale`);
      assert.ok(p.right === null || (typeof p.right === "number" && p.right >= 0 && p.right <= 100),
        `${label}: right is printed or null, never estimated`);
    }
  }
  // figure-for-figure spot pins off the committed store: Men on 10328,
  // One Nation voters on 10353, Labor's right share on 10333
  const at = (label, date) => dg[label].series.find((p) => p.date === date) ?? {};
  assert.deepEqual([at("Men", "2026-08-30").right, at("Men", "2026-08-30").wrong], [29, 60], "Men 10328");
  assert.equal(at("One Nation voters", "2026-09-20").wrong, 95, "One Nation voters 10353");
  assert.equal(at("One Nation voters", "2026-09-20").right, null, "non-ALP vote groups carry no right share");
  assert.deepEqual([at("Labor voters", "2026-09-06").right, at("Labor voters", "2026-09-06").wrong], [54, 26],
    "Labor voters 10333");
  // a fortnight that printed no cut for a group leaves a gap, not a zero
  const menDates = dg.Men.series.map((p) => p.date);
  assert.ok(!menDates.includes("2026-09-13") && !menDates.includes("2026-09-27"),
    "Men has no point on the gender-less fortnights");
  console.log("directionGroups: OK");
}

// ---- directionStateNote: always the LATEST printed state extremes ----------
{
  const note = D.directionStateNote;
  assert.ok(note, "the state-extremes note is emitted");
  const store = JSON.parse(readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8"));
  const dates = Object.keys(store.waves).filter((d) => store.waves[d]?.stateExtremes).sort();
  assert.ok(dates.length, "the store has a state-extremes wave");
  const latest = dates[dates.length - 1];
  assert.equal(note.date, latest, "the note follows the newest extremes wave");
  assert.deepEqual({ highest: note.highest, lowest: note.lowest }, store.waves[latest].stateExtremes,
    "the note carries the store's figures verbatim");
  assert.match(note.lowest.state, /^(New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania)$/);
  assert.match(note.highest.state, /^(New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania)$/);
  console.log("directionStateNote: OK");
}

// ---- the JUR gate: none of it may reach the Vic build ----------------------
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), "dirgroups-vic-"));
  const vicPolls = path.join(tmp, "polls.json");
  const vicOut = path.join(tmp, "out");
  // the same conversion the Vic build performs (build.mjs's VIC branch)
  const { vicToMain } = await import("../vic/to-main-schema.mjs");
  const wrapped = vicToMain(JSON.parse(readFileSync(path.join(ROOT, "data", "vic-polls.json"), "utf8")));
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(vicOut, { recursive: true });
  writeFileSync(vicPolls, JSON.stringify(wrapped, null, 2) + "\n");
  execFileSync(process.execPath, [path.join(NT, "gen-data.mjs")],
    { cwd: ROOT, env: { ...process.env, GEN_DATA_POLLS: vicPolls, GEN_DATA_OUT: vicOut }, stdio: "pipe" });
  const vicAsset = path.join(vicOut, dataFile);
  assert.ok(existsSync(vicAsset), "the vic gen-data run wrote its data asset");
  const vwin = {};
  new Function("window", readFileSync(vicAsset, "utf8"))(vwin);
  assert.ok(vwin.AUSPOL, "the vic asset carries AUSPOL");
  assert.equal(vwin.AUSPOL.directionStates, null, "Vic carries no SEC state series");
  assert.equal(vwin.AUSPOL.directionGroups, null, "Vic carries no Roy Morgan prose splits");
  assert.equal(vwin.AUSPOL.directionStateNote, null, "Vic carries no state-extremes note");
  console.log("vic JUR gate: OK");
}

console.log("test-direction-groups: all OK");
