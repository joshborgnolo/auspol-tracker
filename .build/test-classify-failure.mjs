/* Unit test for classify-failure.mjs — the defect-vs-transient verdict
   poll-agent.yml acts on. Fixtures are real FAIL lines from Sep 2026 runs
   (lightly trimmed), plus the shapes the wrappers can emit.
   Run: node .build/test-classify-failure.mjs */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { classify, readLogLines } from "./classify-failure.mjs";

const at = (text, stamp = "2026-09-23 18:33:59") => ({ stamp, text });
const cls = (text, exit = 1) => classify([at(text)], exit).class;

// ---- transient: upstream -------------------------------------------------------
// Essential's API walled GitHub's runners for four days (15–18 Sep)
assert.equal(cls("FAIL extract (exit 1): ESSENTIAL_ERROR fetch https://essentialreport.com.au/wp-json/wp/v2/reports?per_page=100&page=1 failed after 24 tries: HTTP 403"), "transient");
// Poll Bludger's feed, 2026-09-23 — the status line's error field carries it
assert.equal(cls('FAIL extract (exit 1): PB_STATUS {"changed":false,"source":null,"notes":["fetch attempt 1: fetch failed","fetch attempt 2: fetch failed","fetch attempt 3: fetch failed"],"error":"feed unreachable: fetch failed"}'), "transient");
assert.equal(cls('FAIL extract (exit 1): RM_STATUS {"changed":false,"error":"The operation was aborted due to timeout"}'), "transient");
assert.equal(cls("FAIL extract (exit 1): NP_ERROR getaddrinfo EAI_AGAIN www.theaustralian.com.au"), "transient");
assert.equal(cls("FAIL extract (exit 1): RB_ERROR HTTP 503 from accent-research.com"), "transient");
assert.equal(cls("FAIL vote-switching (exit 1): TypeError: fetch failed"), "transient", "a crosstab reader's fetch");

// ---- transient: push race --------------------------------------------------------
assert.equal(cls("FAIL push race: the rebase onto origin/main conflicted on data (commit kept locally: Update Resolve poll data)"), "transient");
assert.equal(cls("FAIL push race: the push after the rebase was rejected too (commit kept locally: x)"), "transient");
// the pre-2026-09-25 wording (DemosAU, 2026-09-17)
assert.equal(cls("FAIL rebase onto origin/main (commit kept locally: Update DemosAU poll data 2026-09-17)"), "transient");

// ---- defects ---------------------------------------------------------------------
// a guard trip is a defect whatever its message mentions
assert.equal(cls("FAIL extract (exit 2): RM_ERROR merge would shrink polls after fetch failed", 2), "defect");
// DemosAU's exit 3 (Capital Brief ahead of the PDF) is repair work by design
assert.equal(classify([at("Capital Brief poll ahead of DemosAU index: DEMOSAU_STATUS {}")], 3).class, "defect");
// a parse break after a retried fetch: the notes mention "fetch failed", the error does not
assert.equal(cls('FAIL extract (exit 1): PB_STATUS {"notes":["fetch attempt 1: fetch failed"],"error":"no <root date=…> — feed structure changed"}'), "defect");
// a page that moved is a restructure, not an outage
assert.equal(cls("FAIL extract (exit 1): RM_ERROR fetch https://www.roymorgan.com/findings failed: HTTP 404"), "defect");
assert.equal(cls("FAIL extract (no RM_STATUS line): SyntaxError: Unexpected token '<'"), "defect");
assert.equal(cls("FAIL validate (errors above); no commit made"), "defect");
assert.equal(cls("FAIL git commit"), "defect", "an extractor that claimed a change and staged none is a bug (sampleeff, 2026-09-21)");
assert.equal(classify([], 1).class, "defect", "a failure that logged nothing is a defect");
assert.equal(classify([at("RM_STATUS {\"changed\":false}")], 1).kind, "no-fail-line");

// ---- the daily Ipsos run (.build/ipsos-updater.sh) --------------------------------
// its FAIL lines carry extract-ipsos.mjs's warning as written, or the months a
// newly fetched report left waiting
assert.equal(cls("FAIL extract-ipsos (exit 1): report page: https://www.ipsos.com/en-au/issuesmonitor: HTTP 403"), "transient");
assert.equal(cls("FAIL extract-ipsos (exit 1): IM_Nat_Sep_26_v1: https://www.ipsos.com/sites/default/files/ct/publication/documents/2026-10/IM_Nat_Sep_26_v1.pdf: The operation was aborted due to timeout"), "transient");
assert.equal(cls("FAIL extract-ipsos (exit 1): report page: no national report linked from 2025-12 on – has the page changed?"), "defect", "a page that stopped linking reports has moved");
assert.equal(cls("FAIL issues (exit 1): new Ipsos report didn't read: Ipsos|2026-09-14; Ipsos 2026-09: Energy prices (reasons in the issues lines above)"), "defect");

// ---- the LAST failure wins, across logs ---------------------------------------
assert.equal(classify([
  at("FAIL extract (exit 1): X_ERROR fetch failed", "2026-09-23 10:00:00"),
  at("FAIL validate (errors above); no commit made", "2026-09-23 10:05:00"),
], 1).class, "defect");
assert.equal(classify([
  at("FAIL validate (errors above); no commit made", "2026-09-23 10:00:00"),
  at("FAIL push race: the push after the rebase was rejected too (commit kept locally: y)", "2026-09-23 10:05:00"),
], 1).class, "transient");

// ---- reading the logs: --since keeps a laptop's history out ------------------------
const dir = mkdtempSync(path.join(tmpdir(), "classify-"));
writeFileSync(path.join(dir, "roymorgan.log"), [
  "2026-09-20 06:00:01 FAIL validate (errors above); no commit made",
  "Already up to date.",
  "2026-09-23 18:33:59 FAIL extract (exit 1): RM_ERROR fetch failed",
  "",
].join("\n"));
writeFileSync(path.join(dir, "notes.txt"), "2026-09-23 23:59:59 FAIL not a log file\n");
assert.equal(classify(readLogLines(dir), 1).class, "transient", "latest line across the whole log");
assert.equal(readLogLines(dir, "2026-09-21 00:00:00").length, 1, "--since drops older lines and unstamped ones");
assert.equal(readLogLines(path.join(dir, "missing")).length, 0);

console.log("test-classify-failure: ok");
