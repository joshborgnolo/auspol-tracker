/* Fixture test for the coverage watchdog's two layers — check-coverage.mjs
   (the witness parse and gap logic) and coverage-doctor.mjs (the class
   routing). Runs both as child processes against a synthetic wikitext
   witness in the CURRENT table shape (Sep 2026: the fieldwork cell is a
   `|` data cell with rowspan="2", not a `!` header cell — the shape that
   blinded the parser for twelve days) and a scratch dataset, and asserts:
   the parse finds the waves; a covered wave is not a gap; an uncovered one
   is class 2; one the Poll Bludger fallback has filed is class 3, not 2; a
   witness that parses nothing is class 1. Run: node .build/test-coverage.mjs */
import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
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
for (const f of ["check-coverage.mjs", "coverage-doctor.mjs", "melbourne-time.mjs"]) cpSync(path.join(ROOT, ".build", f), path.join(dir, ".build", f));
const poll = (pollster, date) => ({ date, dateStart: date, pollster, client: "—", sample: 1500, alp: 27, lnp: 21, grn: 13, onp: 28, ind: 11, oth: null, tpp_alp: null, tpp_lnp: null });
const write = (D) => writeFileSync(path.join(dir, "data", "polls.json"), JSON.stringify(D, null, 2));
const base = () => ({
  // the 20 daily August YouGov filler waves make that house "overdue" by
  // its own cadence; declared stopped so the fixture's clean case is clean
  pollsterRules: { YouGov: { stopped: true } },
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

console.log("test-coverage: ok");
