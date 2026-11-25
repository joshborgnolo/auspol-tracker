/* Regression tests for .build/assimilate-essential-vi.mjs. Each run uses a
   temporary data tree; no network or repository files are touched.
   Run: node .build/test-assimilate-essential.mjs */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".build", "assimilate-essential-vi.mjs");
const HEADER = "dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties";
const row = (dataset, question_id, question, answer, value, date = "2026-11-25") =>
  `${dataset},${question_id},${question},${question.endsWith("Vote+") || question === "2PP+" ? "Overall" : "Trend"},${answer},,,${date},${value},`;

function fixture(extraRows = []) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "essential-assimilate-"));
  fs.mkdirSync(path.join(cwd, "data"), { recursive: true });
  fs.mkdirSync(path.join(cwd, ".build", "essential-src"), { recursive: true });
  const polls = {
    polls: [{ date: "2026-10-27", pollster: "Essential", alp: 28, lnp: 23, grn: 12, onp: 28, ind: 6 }],
    approval: [{ date: "2026-10-27", firm: "Essential", alb: -18, opp: -4, oppName: "Taylor", han: null }],
    direction: [{ date: "2026-10-27", pollster: "Essential", right: 23, wrong: 62, unsure: 15 }],
  };
  fs.writeFileSync(path.join(cwd, "data", "polls.json"), JSON.stringify(polls));
  const csvRows = [
    row("approval_of_anthony_albanese", "Q37", "Approval of Anthony Albanese", "TOTAL: Approve", 32),
    row("approval_of_anthony_albanese", "Q37", "Approval of Anthony Albanese", "TOTAL: Disapprove", 60),
    row("approval_of_anthony_albanese", "Q37", "Approval of Anthony Albanese", "Don't know", 8),
    row("approval_of_angus_taylor", "Q56", "Approval of Sussan Ley / Angus Taylor", "TOTAL: Approve", 35),
    row("approval_of_angus_taylor", "Q56", "Approval of Sussan Ley / Angus Taylor", "TOTAL: Disapprove", 42),
    row("approval_of_angus_taylor", "Q56", "Approval of Sussan Ley / Angus Taylor", "Don't know", 23),
    row("national_mood", "E563", "National mood (Trend)", "Right direction", 24),
    row("national_mood", "E563", "National mood (Trend)", "Wrong track", 60),
    row("national_mood", "E563", "National mood (Trend)", "Unsure", 16),
    ...extraRows,
  ];
  fs.writeFileSync(path.join(cwd, "data", "essential-report.csv"), [HEADER, ...csvRows].join("\n") + "\n");
  fs.writeFileSync(path.join(cwd, ".build", "essential-src", "report-index.json"), JSON.stringify({
    "2026-11-24": "https://essentialreport.com.au/reports/25th-november-2026",
  }));
  return cwd;
}

function run(cwd) {
  const stdout = execFileSync(process.execPath, [SCRIPT, "--apply"], { cwd, encoding: "utf8" });
  const status = JSON.parse(stdout.trim().split("\n").pop().replace(/^ASSIMILATE_STATUS /, ""));
  return { status, data: JSON.parse(fs.readFileSync(path.join(cwd, "data", "polls.json"), "utf8")) };
}

{
  const cwd = fixture();
  const first = run(cwd);
  assert.equal(first.status.added, 0, "the report has no voting-intention chart");
  assert.equal(first.status.approval, 1, "a mood-and-approval-only wave files its leaders");
  assert.equal(first.status.direction, 1, "a mood-and-approval-only wave files national mood");
  assert.equal(first.status.changed, true);
  const approval = first.data.approval.at(-1);
  assert.deepEqual(approval, {
    date: "2026-11-24", firm: "Essential", alb: -28, opp: -7, oppName: "Taylor", han: null,
    detail: { alb: { app: 32, dis: 60 }, opp: { app: 35, dis: 42 } },
  });
  const { published, ...direction } = first.data.direction.at(-1);
  assert.deepEqual(direction, {
    date: "2026-11-24", dateStart: "2026-11-19", pollster: "Essential", right: 24, wrong: 60, unsure: 16,
    url: "https://essentialreport.com.au/reports/25th-november-2026",
  });
  assert.ok(published == null || published === "2026-11-26T01:00", "the embargoed stamp is withheld or exact");
  assert.equal(first.data.polls.length, 1, "no poll row is invented without primaries");
  assert.equal(run(cwd).status.changed, false, "a second run files no duplicates");
  fs.rmSync(cwd, { recursive: true, force: true });
}

{
  const primary = (answer, value) => row("primary", "Q1", "Primary Vote+", answer, value);
  const tpp = (answer, value) => row("2pp", "Q2", "2PP+", answer, value);
  const cwd = fixture([
    primary("Labor", 29), primary("TOTAL: Coalition", 24), primary("Greens", 12),
    primary("One Nation", 24), primary("Independent or Other Party", 6), primary("Undecided", 5),
    tpp("Labor", 46), tpp("TOTAL: Coalition", 50),
  ]);
  const result = run(cwd);
  assert.equal(result.status.added, 1, "a regular VI wave still files");
  assert.equal(result.status.approval, 1);
  assert.equal(result.status.direction, 1);
  const poll = result.data.polls.at(-1);
  assert.equal(poll.alp, 29);
  assert.equal(poll.tpp_alp, 46);
  assert.equal(poll.tpp_lnp, 50);
  fs.rmSync(cwd, { recursive: true, force: true });
}

console.log("test-assimilate-essential: ok");
