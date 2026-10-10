/* Fixture test for the coverage watchdog's two layers — check-coverage.mjs
   (the witness parse and gap logic) and coverage-doctor.mjs (the class
   routing). Runs both as child processes against a synthetic wikitext
   witness in the CURRENT table shape (Sep 2026: the fieldwork cell is a
   `|` data cell with rowspan="2", not a `!` header cell — the shape that
   blinded the parser for twelve days) and a scratch dataset, and asserts:
   the parse finds the waves; a covered wave is not a gap; an uncovered one
   is class 2; one the Poll Bludger fallback has filed is class 3, not 2; a
   witness that parses nothing is class 1; an UNKNOWN pollster on the
   witness table is reported as first contact (name, dates, row refs) with
   the exit code untouched; the first-contact seen-file suppresses at the
   gate but never at emission; the seen-file writer keeps its
   one-entry-per-line merge discipline; the gate's pick verb caps a run
   at three shell-safe names with recorded ones suppressed; and an MRP wave
   parses in each of the live table's row forms, is covered only by its own
   "(MRP)" pollster's rows, and is never masked by a nearby regular wave of
   the same house. Run:
   node .build/test-coverage.mjs */
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "cov-"));

// ---- a witness in the current shape ---------------------------------------------
const row = (dates, house, cite) => `|-
| rowspan="2" style="text-align:centre;" | ${dates}
| rowspan="2" align="left" | [[${house}]]<ref>${cite}</ref>
| rowspan="2" {{n/a}}
| rowspan="2" | Online
| rowspan="2" | 1,500
| rowspan="2" | 27%
| colspan="2" rowspan="2" | 21%
| rowspan="2" | 13%
| rowspan="2" | 28%
| rowspan="2" | 11%
| 53% || 47% ||
|-
| 52% || 48% ||
`;
const wiki = `==Voting intention==
===2026===
{| class="wikitable sortable sticky-header-multi mw-datatable"
! rowspan="5" | Date
! rowspan="5" | Polling firm
! colspan="6" | Primary vote
! colspan="3" |[[Two-party-preferred vote|2PP vote]]
${row("14–20 Sept", "Roy Morgan", "a")}${row("14–17 Sept", "Newspoll", "b")}${row("6–12 Sept", "Resolve Political Monitor", "c")}${Array.from({ length: 20 }, (_, i) => row(`${1 + i}–${2 + i} Aug`, "YouGov", "y" + i)).join("")}|}
`.replace(/\{\{n\/a\}\}/g, "| —");
const WIKI = path.join(dir, "wiki.txt");
writeFileSync(WIKI, wiki + "x".repeat(60_000)); // past the checker's size floor

// ---- scratch repo: the two scripts read data/polls.json relative to cwd -------------
mkdirSync(path.join(dir, "data"));
mkdirSync(path.join(dir, ".build"));
for (const f of ["check-coverage.mjs", "coverage-doctor.mjs", "melbourne-time.mjs", "first-contact.mjs"]) cpSync(path.join(ROOT, ".build", f), path.join(dir, ".build", f));
const poll = (pollster, date) => ({ date, dateStart: date, pollster, client: "—", sample: 1500, alp: 27, lnp: 21, grn: 13, onp: 28, ind: 11, oth: null, tpp_alp: null, tpp_lnp: null });
const write = (D) => writeFileSync(path.join(dir, "data", "polls.json"), JSON.stringify(D, null, 2));
const base = () => ({
  // the 20 daily August YouGov filler waves make that house "overdue" by
  // its own cadence, and the pinned September Roy Morgan waves drift late
  // against the wall clock as time passes; declared stopped so the
  // fixture's clean case is clean
  pollsterRules: { YouGov: { stopped: true }, "Roy Morgan": { stopped: true } },
  polls: [
    ...Array.from({ length: 6 }, (_, i) => poll("Roy Morgan", `2026-08-${String(9 + i * 7).padStart(2, "0")}`)),
    poll("Roy Morgan", "2026-09-20"), poll("Newspoll", "2026-08-27"), poll("Newspoll", "2026-09-17"), poll("Resolve", "2026-09-12"),
    ...Array.from({ length: 20 }, (_, i) => poll("YouGov", `2026-08-${String(2 + i).padStart(2, "0")}`)),
  ].sort((a, b) => (a.date < b.date ? -1 : 1)),
  ppm: [], approval: [],
});
const doctor = (wikiFile = WIKI) => {
  const r = spawnSync(process.execPath, [".build/coverage-doctor.mjs"], {
    cwd: dir, encoding: "utf8",
    env: { ...process.env, COVERAGE_WIKI_FILE: wikiFile, DOCTOR_POLLS: path.join(dir, "data", "polls.json") },
  });
  const line = r.stdout.split("\n").find((l) => l.startsWith("DOCTOR_STATUS "));
  assert.ok(line, "no DOCTOR_STATUS: " + r.stdout + r.stderr);
  return { code: r.status, out: r.stdout, st: JSON.parse(line.slice(14)) };
};

// 1. everything the witness lists is covered → class 0, and the parse found the waves
write(base());
let r = doctor();
assert.equal(r.code, 0, r.out);
assert.match(r.out, /23 witness waves/, "the current table shape parses (" + r.out + ")");

// 2. Newspoll 17 Sep missing from polls[] and nothing else → class 2 (repair fires)
let D = base(); D.polls = D.polls.filter((p) => !(p.pollster === "Newspoll" && p.date === "2026-09-17")); // the house stays tracked via 27 Aug
write(D);
r = doctor();
assert.equal(r.code, 2, r.out);
assert.match(r.st.defects[0], /2026-09-17\s+Newspoll/);

// 3. the same wave filed by the fallback → class 3, no defect
D.fallbackPolls = [{ ...poll("Newspoll", "2026-09-17"), provisional: { source: "Poll Bludger", feedId: "1" } }];
write(D);
r = doctor();
assert.equal(r.code, 3, r.out);
assert.equal(r.st.defects, undefined);
assert.match(r.st.provisional[0], /Newspoll.*provisionally via the Poll Bludger fallback/);

// 4. a fallback row never hides an UNCOVERED gap: add a second missing wave → class 2 lists it, notes the covered one
writeFileSync(WIKI, wiki.replace("|}\n", row("1–5 Sept", "Newspoll", "d") + "|}\n") + "x".repeat(60_000));
r = doctor();
assert.equal(r.code, 2, r.out);
assert.match(r.st.defects[0], /2026-09-05\s+Newspoll/);
assert.equal(r.st.provisional.length, 1);

// 5. a witness that parses to nothing → class 1 (inconclusive), never a defect
writeFileSync(path.join(dir, "empty.txt"), "==Voting intention==\n{|\n! Date\n|}\n" + "x".repeat(60_000));
r = doctor(path.join(dir, "empty.txt"));
assert.equal(r.code, 1, r.out);
assert.match(r.st.reason, /parsed only 0 waves/);

// ---- first contact: an unknown pollster on the witness table ----------------
const check = (wikiFile = WIKI) => {
  const p = spawnSync(process.execPath, [".build/check-coverage.mjs", "--quiet"], {
    cwd: dir, encoding: "utf8",
    env: { ...process.env, COVERAGE_WIKI_FILE: wikiFile },
  });
  const fc = p.stdout.split("\n").find((l) => l.startsWith("FIRST_CONTACT "));
  const st = p.stdout.split("\n").find((l) => l.startsWith("COVERAGE_STATUS "));
  assert.ok(fc && st, "machine lines missing: " + p.stdout + p.stderr);
  return { code: p.status, fc: JSON.parse(fc.slice("FIRST_CONTACT ".length)), st: JSON.parse(st.slice("COVERAGE_STATUS ".length)) };
};
const fcCli = (args) => {
  const p = spawnSync(process.execPath, [".build/first-contact.mjs", ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(p.status, 0, p.stderr);
  return p.stdout.trim();
};

// 6. the base witness (mapped houses only) reports no first contact
write(base());
writeFileSync(WIKI, wiki + "x".repeat(60_000));
let c = check();
assert.equal(c.code, 0, "baseline exit code");
assert.deepEqual(c.fc, [], "no unknown houses on the base witness");

// 7. an unknown pollster row → first-contact detection with its ref URL, exit code untouched
writeFileSync(WIKI, wiki.replace("|}\n", row("18–21 Sept", "JWS Research", "[https://jws.example.com/poll-report-sept JWS survey]") + "|}\n") + "x".repeat(60_000));
c = check();
assert.equal(c.code, 0, "an unknown pollster is not a gap");
assert.equal(c.st.witness_waves, 23, "unknown rows do not inflate the witness count");
assert.ok(!JSON.stringify(c.st.missing).includes("JWS"), "unknown rows never join missing");
assert.equal(c.fc.length, 1, "one first-contact name: " + JSON.stringify(c.fc));
assert.equal(c.fc[0].name, "JWS Research");
assert.deepEqual(c.fc[0].dates, ["2026-09-21"]);
assert.deepEqual(c.fc[0].refs, ["https://jws.example.com/poll-report-sept"]);
assert.deepEqual(c.st.first_contact, c.fc, "status carries the same list");

// 8. the seen-file suppresses AT THE GATE, never at emission
fcCli(["ignore", "JWS Research", "fixture: deliberately untracked"]);
c = check();
assert.equal(c.fc.length, 1, "emission is unfiltered — the import agent's own run still sees its house");
assert.deepEqual(JSON.parse(fcCli(["filter", JSON.stringify(c.fc)])), [], "gate-side filter suppresses the recorded name");
assert.deepEqual(JSON.parse(fcCli(["filter", JSON.stringify([...c.fc, { name: "New Face", dates: [], refs: [] }])])), ["New Face"], "unrecorded names survive the filter");

// 9. the seen file is valid JSON, one entry per line, sorted — and a verdict
// flip touches only its own line (review branches merge against moved main)
fcCli(["pending", "Acme Polling"]);
const seenPath = path.join(dir, ".build", "first-contact-seen.json");
const before = readFileSync(seenPath, "utf8");
const seen = JSON.parse(before);
assert.equal(Object.keys(seen).length, 2);
assert.deepEqual(Object.keys(seen), [...Object.keys(seen)].sort(), "keys sorted");
const entryLines = before.split("\n").filter((l) => l.startsWith('"'));
assert.equal(entryLines.length, 2, "one entry per line");
fcCli(["imported", "Acme Polling"]);
const after = readFileSync(seenPath, "utf8");
const acme = JSON.parse(after)["acme polling"];
assert.equal(acme.verdict, "imported");
assert.ok(after.includes(before.split("\n").find((l) => l.startsWith('"jws research"'))), "another house's line is untouched by the flip");

// 10. pick: seen-file suppression + shell-safe charset + the 3-per-run cap,
// all in the one place the gate consumes
const contacts = ["JWS Research", "Acme Polling", "OMalley & Sons", "Poll$(whoami)", "One More", "Two More", "Three More"]
  .map((name) => ({ name, dates: [], refs: [] }));
const picked = JSON.parse(fcCli(["pick", JSON.stringify(contacts)]));
assert.deepEqual(picked.names, ["OMalley & Sons", "One More", "Two More"], "recorded names suppressed, cap at 3: " + JSON.stringify(picked));
assert.deepEqual(picked.unsafe, ["Poll$(whoami)"], "shell metacharacters held back");

// ---- MRP rows: the live table's forms, and the masking rule -----------------
// Every MRP row on the live table wraps its date cell in {{nowrap|…}} (which
// used to kill the date parse silently), and the firm cell comes LINKED with
// a trailing parenthetical ("[[YouGov]] (MRP)") or PLAIN ("DemosAU (MRP)",
// "RedBridge/Accent (MRP)") — the plain form used to fall into the
// first-contact branch, where the known-name suppression swallowed it whole.
const mrpRow = (dates, firmCell, cite) => `|-
| rowspan="2" style="text-align:centre;" | {{nowrap|${dates}}}
| rowspan="2" align="left" | ${firmCell}<ref>${cite}</ref>
| rowspan="2" {{n/a}}
| rowspan="2" | Online
| rowspan="2" | 15,000
| rowspan="2" | 27%
| colspan="2" rowspan="2" | 21%
| rowspan="2" | 13%
| rowspan="2" | 28%
| rowspan="2" | 11%
| 53% || 47% ||
|-
| 52% || 48% ||
`.replace(/\{\{n\/a\}\}/g, "| —");
const mrpWiki = wiki.replace("|}\n",
  mrpRow("18–21 Sept", "[[YouGov]] (MRP)", "u") + // nowrap date, linked "(MRP)" firm cell
  mrpRow("10–14 Sept", "DemosAU (MRP)", "v") + // nowrap date, plain "(MRP)" firm cell
  row("18–21 Sept", "YouGov", "u2") + // same house, same date, the regular product
  "|}\n");

// 11. all three forms parse as waves; tracked "(MRP)" rows cover them, and a
// regular product on the same date does not swallow the MRP one (or vice versa)
writeFileSync(WIKI, mrpWiki + "x".repeat(60_000));
let D2 = base();
D2.polls.push(poll("YouGov (MRP)", "2026-09-21"), poll("DemosAU (MRP)", "2026-09-14"), poll("YouGov", "2026-09-21"));
write(D2);
r = doctor();
assert.equal(r.code, 0, r.out);
assert.match(r.out, /26 witness waves/, "both 21 Sep YouGov products count (" + r.out + ")");
c = check();
assert.deepEqual(c.fc, [], "mapped MRP cells never leak into first contact");

// 12. a regular wave inside the ±3-day slack must NOT mask a missing MRP wave
// of the same house — the (MRP) variant is tracked here only by an older MRP
// wave well outside the slack, the live dataset's actual shape
D2.polls = D2.polls.filter((p) => p.pollster !== "DemosAU (MRP)");
D2.polls.push(poll("DemosAU (MRP)", "2026-03-03"), poll("DemosAU", "2026-09-15"));
write(D2);
r = doctor();
assert.equal(r.code, 2, r.out);
assert.equal(r.st.defects.length, 1, "only the masked MRP wave is a defect: " + JSON.stringify(r.st));
assert.match(r.st.defects[0], /2026-09-14\s+DemosAU \(MRP\) — listed by the witness/, r.st.defects[0]);
assert.doesNotMatch(r.out, /\(MRP\) \(MRP\)/, "the (MRP) suffix does not double up on a named variant");

console.log("test-coverage: ok");
