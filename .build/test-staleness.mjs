/* Unit test for check-poll-staleness.mjs — the whole-wave-clone watchdog.
   Fixtures are synthetic polls.json files written to a temp dir and read via
   ST_OUT. Dates are derived from today so the GRACE/WINDOW logic ages with
   the calendar. Run: node .build/test-staleness.mjs */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const DIR = mkdtempSync(path.join(tmpdir(), "staleness-"));
const SCRIPT = fileURLToPath(new URL("./check-poll-staleness.mjs", import.meta.url));

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

const run = (doc, env = {}) => {
  const file = path.join(DIR, `polls-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(doc));
  const r = spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, ST_OUT: file, ...env },
    encoding: "utf8",
  });
  const statusLine = r.stdout.trim().split("\n").filter((l) => l.startsWith("ST_STATUS ")).at(-1);
  return { code: r.status, status: statusLine ? JSON.parse(statusLine.slice(10)) : null,
    stderr: r.stderr.trim() };
};

const base = { direction: [], polls: [], ppm: [], approval: [], ppmHeadToHead: [], altTpp: [] };

// ---- a clean pair of YouGov waves: fresh figures everywhere -> silent -------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "YouGov", date: iso(21), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 },
      { pollster: "YouGov", date: iso(7), alp: 28, lnp: 22, grn: 12, onp: 27, ind: 5, oth: 6, tpp_alp: 52, tpp_lnp: 48 },
    ],
    ppm: [
      { firm: "YouGov", date: iso(21), alb: 44, opp: 37 },
      { firm: "YouGov", date: iso(7), alb: 45, opp: 38 },
    ],
  };
  const r = run(doc);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.status.fired, false);
  assert.ok(r.status.housesChecked >= 1);
}

// ---- the 6 Oct failure shape: everything cloned -> red ----------------------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "YouGov", date: iso(21), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 },
      { pollster: "YouGov", date: iso(7), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 },
    ],
    ppm: [
      { firm: "YouGov", date: iso(21), alb: 44, opp: 37 },
      { firm: "YouGov", date: iso(7), alb: 44, opp: 37 },
    ],
    approval: [
      { firm: "YouGov", date: iso(21), alb: -24, opp: -15 },
      { firm: "YouGov", date: iso(7), alb: -24, opp: -15 },
    ],
  };
  const r = run(doc);
  assert.equal(r.code, 1, "full clone must fire");
  assert.equal(r.status.fired, true);
  assert.equal(r.status.stale, 1);
  assert.equal(r.status.findings[0].house, "YouGov");
  assert.ok(r.stderr.includes("figure-for-figure"), "message explains itself");
}

// ---- a one-figure move anywhere clears the pair ----------------------------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "YouGov", date: iso(21), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 },
      { pollster: "YouGov", date: iso(7), alp: 30, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7, tpp_alp: 53, tpp_lnp: 47 },
    ],
  };
  const r = run(doc);
  assert.equal(r.code, 0, "a single moved figure breaks the clone");
}

// ---- VI-only house: six identical primaries still fire (>= ST_FIELDS) -------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "Resolve", date: iso(30), alp: 28, lnp: 23, grn: 12, onp: 26, ind: 7, oth: 4 },
      { pollster: "Resolve", date: iso(9), alp: 28, lnp: 23, grn: 12, onp: 26, ind: 7, oth: 4 },
    ],
  };
  const r = run(doc);
  assert.equal(r.code, 1, "six identical primaries fire with no 2PP on file");
  // a five-field house stays quiet — too few fields to judge
  const doc5 = {
    ...base,
    polls: [
      { pollster: "Essential", date: iso(30), alp: 31, lnp: 30, grn: 12, onp: 15, ind: null, oth: 12 },
      { pollster: "Essential", date: iso(9), alp: 31, lnp: 30, grn: 12, onp: 15, ind: null, oth: 12 },
    ],
  };
  const r5 = run(doc5);
  assert.equal(r5.code, 0, "five comparable fields is below ST_FIELDS — silent");
  const r5b = run(doc5, { ST_FIELDS: "5" });
  assert.equal(r5b.code, 1, "ST_FIELDS lowers the bar and it fires");
}

// ---- inside the grace window the newest wave is left alone ------------------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "YouGov", date: iso(21), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7 },
      { pollster: "YouGov", date: iso(0), alp: 29, lnp: 21, grn: 12, onp: 26, ind: 5, oth: 7 },
    ],
  };
  const r = run(doc, { ST_FIELDS: "6" });
  assert.equal(r.code, 0, "same-day wave is inside grace");
}

// ---- a dead house (latest wave outside the window) is not judged ------------
{
  const doc = {
    ...base,
    polls: [
      { pollster: "Galaxy", date: iso(200), alp: 36, lnp: 42, grn: 10, onp: null, ind: 5, oth: 7 },
      { pollster: "Galaxy", date: iso(158), alp: 36, lnp: 42, grn: 10, onp: null, ind: 5, oth: 7 },
    ],
  };
  const r = run(doc);
  assert.equal(r.code, 0, "history does not page");
}

console.log("test-staleness: ok");
