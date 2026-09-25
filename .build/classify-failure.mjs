#!/usr/bin/env node
/* classify-failure.mjs — was a failed updater run a DEFECT, or the world?

   Every red updater run used to be repair work: agent-repair.yml spent a
   Matilda session on it and the failure emailed. Two kinds of red are not
   defects at all and no agent can fix them:

     upstream  the pollster's site (or the network in between) was down,
               walled or slow — Poll Bludger's feed "fetch failed" on
               2026-09-23 (the agent's verdict: "transient network failure",
               no commits); Essential's API answered HTTP 403 for 8 runs,
               15–18 Sep. The next slot retries on its own.
     race      push_main lost a push race twice in a row (it re-runs the
               wrapper once itself; see git-push-main.sh). The next slot
               redoes the extraction on the fresh base.

   This reads the wrapper logs the run just wrote (.build/logs/*.log — every
   step logs one timestamped line), takes the LAST "FAIL" line, and says which
   kind it was. The wrapper's exit code is part of the verdict: exit 1 is the
   extractors' fetch/parse code; exit 2 is a safety guard and exit 3 is
   DemosAU's hand-entry signal — both are defects whatever the message says.
   A run whose failure left no FAIL line at all is a defect too: something
   broke that the wrappers didn't anticipate.

   poll-agent.yml turns a transient verdict into a green run with a warning,
   and escalates only a streak (see .build/transient-streak.sh).

   Usage: node .build/classify-failure.mjs --exit <code> [--since "YYYY-MM-DD HH:MM:SS"] [--logs <dir>]
   Prints: FAILURE_CLASS {"class":"transient"|"defect","kind":…,"line":…}; exits 0. */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Network-level failures and HTTP answers that mean "not now" rather than
// "this moved". 404/410 are deliberately absent: a missing page is usually a
// site restructure, which IS repair work.
export const UPSTREAM = new RegExp([
  "fetch failed", "feed unreachable", "socket hang up", "other side closed",
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH", "EPIPE",
  "UND_ERR_[A-Z_]+", "TimeoutError", "aborted due to timeout", "timed out", "certificate",
  "HTTP (?:403|408|425|429|5\\d\\d)\\b", "status (?:403|408|425|429|5\\d\\d)\\b",
].join("|"), "i");
// push_main's give-up lines, current and pre-2026-09-25 wording
export const RACE = /FAIL (?:push race|rebase onto origin\/main|git push after rebase)/;

const STAMP = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) /;

/* The part of a FAIL line that says what went wrong. When the wrapper logged
   the extractor's `<HOUSE>_STATUS {json}` line, only its `error` counts: the
   status's notes can mention a fetch that failed and was then retried
   successfully ("fetch attempt 1: fetch failed") before a parse broke. */
function failureText(line) {
  const m = /\b[A-Z0-9]+_STATUS (\{.*\})\s*$/.exec(line);
  if (!m) return line;
  try { const s = JSON.parse(m[1]); return typeof s.error === "string" ? s.error : ""; }
  catch { return line; }
}

/* lines: [{ stamp, text }] from every log; exit: the wrapper's exit code */
export function classify(lines, exit) {
  const fails = lines.filter((l) => /^FAIL\b/.test(l.text)).sort((a, b) => (a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : 0));
  const last = fails[fails.length - 1];
  if (!last) return { class: "defect", kind: "no-fail-line", line: null };
  if (exit !== 1) return { class: "defect", kind: `exit-${exit}`, line: last.text };
  if (RACE.test(last.text)) return { class: "transient", kind: "race", line: last.text };
  // "FAIL <step> (exit 1): <message>" — the extractors, and the crosstab /
  // sample-size readers that fetch too (crosstabs, redbridge's sampleeff-accent)
  if (/^FAIL [\w-]+ \(exit 1\): /.test(last.text) && UPSTREAM.test(failureText(last.text)))
    return { class: "transient", kind: "upstream", line: last.text };
  return { class: "defect", kind: "fail-line", line: last.text };
}

export function readLogLines(dir, since = "") {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".log"))) {
    for (const raw of readFileSync(join(dir, f), "utf8").split("\n")) {
      const m = STAMP.exec(raw);
      if (!m || m[1] < since) continue;
      out.push({ stamp: m[1], text: raw.slice(m[0].length), file: f });
    }
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, "/"));
if (isMain) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
  const exit = Number(arg("--exit", "1"));
  const verdict = classify(readLogLines(arg("--logs", ".build/logs"), arg("--since", "")), exit);
  console.log("FAILURE_CLASS " + JSON.stringify(verdict));
}
