// vic-polish shared contract — the ONE module the orchestrator, the prompts'
// JSON contract, and the fixture test all read their shapes from (the
// adjudicate-cases.mjs precedent). The reviewer agent answers verdicts only,
// never code: anything carrying a code/patch field poisons the whole verdict
// and the run treats it as an invalid emission (deterministic stop, green
// exit) exactly as adjudicate.mjs treats a fortified verdict.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export const STATUS_TAG = "VPOLISH_STATUS";
export const SUMMARY_TAG = "BUILDER_SUMMARY"; // builder's one-line round report
export const VERDICT_TAG = "VP_VERDICT";      // reviewer's last-line JSON tag

// Paths the builder session may change (relative to the repo root). Exact
// files, plus one scratch dir with exclusions. The audit probe, this lib, the
// orchestrator, the prompts and the standard doc are NOT here — the loop's
// own contract is human-owned; the builder reverts nothing of yours and may
// not weaken the watchdog that judges it (probe-vic-standard.mjs).
export const BUILDER_FILES = [
  ".build/refresh-vic.mjs",
  ".build/vic-watch.mjs",
  "data/vic-polls.json",
  "vic/index.html",
];
export const BUILDER_DIRS = [".build/vic-src/"];
// Everything under .build/vic-src/ that the LOOP itself owns (committed
// ledger + gitignored round reports): never the builder's.
export const BUILDER_DIR_EXCLUSIONS = [".build/vic-src/polish-ledger.json", ".build/vic-src/polish-reports/"];

export const LEDGER_PATH = ".build/vic-src/polish-ledger.json";
export const REPORTS_DIR = ".build/vic-src/polish-reports";

export const AREAS = ["visual", "feature", "data"];

// Fields a verdict (or any gap inside it) must never grow: observation only.
// Anything data/code-carrying poisons the lot.
export const POISON_KEYS = new Set([
  "patch", "code", "diff", "snippet", "replacement", "content",
  "before", "after", "insert", "html", "css",
]);

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_GAPS = 12;
export const MAX_CLAIM = 300;
export const MAX_EVIDENCE = 300;
export const MAX_NOTES = 400;

export function builderAllowed(p) {
  if (BUILDER_FILES.includes(p)) return true;
  for (const d of BUILDER_DIRS) {
    if (p.startsWith(d)) {
      for (const x of BUILDER_DIR_EXCLUSIONS) {
        if (p === x.replace(/\/$/, "") || p.startsWith(x)) return false;
      }
      return true;
    }
  }
  return false;
}

// The reviewer touches nothing. Exported for the orchestrator's post-reviewer
// sweep (any freshly-dirty tracked path after a reviewer session is a
// reviewerViolation and gets reverted).
export const REVIEWER_ALLOWED = [];

// Parse and validate a reviewer verdict from raw session stdout.
// Returns { ok, verdict?, why? }.
export function parseVerdict(stdout) {
  const text = String(stdout || "").trim();
  const line = text.split("\n").filter((l) => l.startsWith(VERDICT_TAG + " ")).pop();
  if (!line) return { ok: false, why: `no ${VERDICT_TAG} line in reviewer output` };
  let v;
  try { v = JSON.parse(line.slice(VERDICT_TAG.length + 1)); }
  catch (e) { return { ok: false, why: `verdict is not JSON: ${e.message}` }; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, why: "verdict is not an object" };
  for (const k of Object.keys(v)) {
    if (POISON_KEYS.has(k)) return { ok: false, why: `verdict carries data field "${k}" — observation only` };
  }
  if (v.verdict !== "pass" && v.verdict !== "gaps") return { ok: false, why: `verdict must be "pass" or "gaps", got ${JSON.stringify(v.verdict)}` };
  if (v.notes != null && (typeof v.notes !== "string" || v.notes.length > MAX_NOTES)) {
    return { ok: false, why: `notes must be a string of <= ${MAX_NOTES} chars` };
  }
  if (v.verdict === "pass") {
    if (v.gaps != null && !(Array.isArray(v.gaps) && v.gaps.length === 0)) {
      return { ok: false, why: 'verdict "pass" carried gaps — pass means the gaps array is empty or absent' };
    }
    return { ok: true, verdict: { ...v, gaps: [] } };
  }
  const gaps = v.gaps;
  if (!Array.isArray(gaps) || !gaps.length) return { ok: false, why: 'verdict "gaps" carried an empty gaps array — use "pass" when nothing falls short' };
  if (gaps.length > MAX_GAPS) return { ok: false, why: `too many gaps (${gaps.length} > ${MAX_GAPS}); file the worst ${MAX_GAPS}` };
  const ids = new Set();
  for (const g of gaps) {
    if (!g || typeof g !== "object" || Array.isArray(g)) return { ok: false, why: "a gap is not an object" };
    for (const k of Object.keys(g)) {
      if (POISON_KEYS.has(k)) return { ok: false, why: `gap ${JSON.stringify(g.id)} carries data field "${k}" — observation only` };
    }
    if (typeof g.id !== "string" || !ID_RE.test(g.id)) return { ok: false, why: `gap id ${JSON.stringify(g.id)} must match ${ID_RE}` };
    if (ids.has(g.id)) return { ok: false, why: `duplicate gap id ${g.id}` };
    ids.add(g.id);
    if (!AREAS.includes(g.area)) return { ok: false, why: `gap ${g.id} area must be one of ${AREAS.join("/")}` };
    if (typeof g.claim !== "string" || !g.claim.trim() || g.claim.length > MAX_CLAIM) {
      return { ok: false, why: `gap ${g.id} claim must be non-empty text of <= ${MAX_CLAIM} chars` };
    }
    if (typeof g.evidence !== "string" || !g.evidence.trim() || g.evidence.length > MAX_EVIDENCE) {
      return { ok: false, why: `gap ${g.id} evidence must be non-empty text of <= ${MAX_EVIDENCE} chars citing a file/selector/measured value` };
    }
  }
  return { ok: true, verdict: v };
}

// Extract the builder's one-liner (its last BUILDER_SUMMARY line).
export function builderSummary(stdout) {
  const m = String(stdout || "").match(/^BUILDER_SUMMARY[ :](.+)$/gm);
  if (!m) return null;
  return m[m.length - 1].replace(/^BUILDER_SUMMARY[ :]\s*/, "").slice(0, 160);
}

export function gapKey(g) { return `${g.area}:${g.id}`; }

export function gapHash(g) {
  return createHash("sha256").update(`${g.area}\n${g.id}\n${g.claim}`).digest("hex").slice(0, 10);
}

export function blankLedger() { return { v: 1, sessions: [], gaps: {}, runs: [] }; }

export function readLedger(repo) {
  const f = path.join(repo, LEDGER_PATH);
  if (!existsSync(f)) return blankLedger();
  try {
    const l = JSON.parse(readFileSync(f, "utf8"));
    if (l && typeof l === "object" && Array.isArray(l.sessions) && l.gaps && Array.isArray(l.runs)) return l;
  } catch { /* fall through: a corrupt ledger restarts memory, never the run */ }
  return blankLedger();
}

export function writeLedger(repo, ledger) {
  const f = path.join(repo, LEDGER_PATH);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + "\n");
  renameSync(tmp, f);
}

// Sessions in the trailing 24h (breaker counts agent sessions, both kinds).
export function sessions24h(ledger, nowMs = Date.now()) {
  const cut = nowMs - 24 * 3600e3;
  return ledger.sessions.filter((s) => Date.parse(s) > cut).length;
}

// Merge one reviewed round's gap list into the ledger. Returns
// { open, fixed, stuckList } — a gap reported on STUCK_AFTER consecutive
// rounds flips to stuck; a gap unreported for QUIET_AFTER consecutive rounds
// flips to closed-quiet.
export const STUCK_AFTER = 3;
export const QUIET_AFTER = 2;

export function mergeLedgerGaps(ledger, gaps, roundIso) {
  const seen = new Set(gaps.map((g) => gapKey(g)));
  for (const g of gaps) {
    const k = gapKey(g);
    const rec = ledger.gaps[k];
    if (!rec) {
      ledger.gaps[k] = {
        id: g.id, area: g.area, claim: g.claim, evidence: g.evidence,
        opened: roundIso, seen: [roundIso], missed: 0, status: "open",
      };
    } else {
      rec.claim = g.claim; rec.evidence = g.evidence;
      const wasOpen = rec.status === "open";
      if (rec.status === "closed") { rec.status = "open"; rec.reopened = roundIso; }
      if (!rec.seen.includes(roundIso)) rec.seen.push(roundIso);
      rec.missed = 0;
      // Stuck is judged only on an already-open record: the (re)opening
      // sighting is the builder's cue to fix, not a failure to.
      if (wasOpen && rec.seen.length >= STUCK_AFTER) rec.status = "stuck";
    }
  }
  for (const [k, rec] of Object.entries(ledger.gaps)) {
    if (rec.status !== "open" || seen.has(k)) continue;
    rec.missed = (rec.missed || 0) + 1;
    if (rec.missed >= QUIET_AFTER) { rec.status = "closed"; rec.closed = roundIso; rec.how = "quiet"; }
  }
  const open = Object.values(ledger.gaps).filter((r) => r.status === "open");
  const stuckList = Object.values(ledger.gaps).filter((r) => r.status === "stuck");
  return { open, stuckList };
}
