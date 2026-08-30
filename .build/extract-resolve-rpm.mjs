// Extract every polling series from the Resolve Political Monitor interactive
// (https://www.smh.com.au/national/resolve-political-monitor-20210322-p57cvx.html,
// data source https://www.smh.com.au/interactive/2026/political-monitor/site/data/data.json
// — the 2021 path still serves the previous generation's file, frozen at
// 2026-07-12; reading it is what made this extractor look healthy while stale)
// and merge with the rows already in data/resolve-political-monitor.csv.
//
// Datasets produced from the live file (question ids are the interactive's):
//   Q5  primary_vote             federal primary vote, 2021-04 -> latest, National + regions
//   Q17 pm_performance           PM job rating (series starts Aug 2022)
//   Q15 opp_leader_performance   opposition-leader job rating (series starts Aug 2022)
//   Q19 preferred_pm             preferred PM; answers resolved to leader names
//   Q22 who_will_win             expected election winner ("two group preffered bar")
//   Q21a party_attributes        "which party would perform best" per policy area
//   Q21b party_descriptors       statements describing each party
//   Q11 well_being_index         Self / State / Country wellbeing — RETIRED upstream
//                                in the 2026 rebuild; committed rows stay, no new ones
//   Q25NSW primary_vote_nsw      NSW state primary vote
//   Q28NSW preferred_premier_nsw NSW premier vs opposition leader
//   Q29VIC primary_vote_vic      VIC state primary vote
//   Q32VIC preferred_premier_vic VIC premier vs opposition leader
//   Q33QLD primary_vote_qld      QLD state primary vote (2026 rebuild onward)
//   Q34QLD preferred_premier_qld QLD premier vs opposition leader (2026 rebuild onward)
//
// Nested subSections (answers carry their own timeseries under the parent's id):
//   Q5  vote_firmness            "How firm are you with your vote?" —
//                                TOTAL HARD = Committed, TOTAL SOFT = Uncommitted
//                                (plus Coalition/Labor/Other breakdowns)
//   Q5  election_2025_results    actual 2025 federal election result baseline;
//                                its points are dated "election 2025" in the
//                                source and stored here as 2025-05-03 (polling day)
//   Q25NSW vote_firmness_nsw     ^ state equivalents
//   Q29VIC vote_firmness_vic
//
// Free-text respondent verbatims (customAnswers arrays) are not series data
// and are counted + skipped, not extracted.
//
// Known source-data defects the extractor repairs or works around (each fix
// prints to the log as it runs; the CSV carries no annotations):
//
// 1. Legacy `leader_performance` rows (kept from an earlier app generation)
//    track ANTHONY ALBANESE throughout, not "the sitting PM": their net
//    matches the published opposition-leader nets on every Morrison-era wave
//    (e.g. June 2021: Albanese -13, while Morrison's published net was +8).
//    Rows dated before the 2022 term ends are relabelled
//    `opp_leader_performance`; rows from 2022-08-21 onward duplicate Q17 and
//    are dropped.
// 2. `Net (Coalition - Labor)` rows in the primary-vote datasets are
//    sometimes stored with the sign flipped (on waves where Labor led):
//    2023-10-05, 2025-12-20, 2026-02-14 federal; 2026-03/05/07 NSW;
//    2021-08-22 VIC. A stored Net that diverges from LNP-ALP by more than
//    component-rounding slop (>1.5pp) is replaced with LNP-ALP.
// 3. `Net (Good - Poor)` on 2025-07-18 (both Q17 and Q15) contradicts that
//    wave's own TOTAL GOOD - TOTAL POOR AND its components (PM stored 8 vs
//    3; Opp stored -6 vs +9, while the paper called Ley's rating its bright
//    spot). Stored Net is replaced with TOTAL GOOD - TOTAL POOR.
// 4. Live Q22 rows for the four waves of 2021-04-16..2021-07-18 are corrupt
//    upstream (Labor expected to win 26-30% in Morrison's mid-2021 heyday)
//    and dropped; the CSV's Q444_* archive rows (kept verbatim; their
//    `parties` column documents answerFirst=Coalition) are authoritative for
//    that stretch.
// 5. Feb 2026 polled TWO primary-vote scenarios in one wave (Ley retains vs
//    Taylor takes over; headline = Taylor, published 15 Feb 2026). The Ley
//    counterfactual (dated 12/02/2026 in the source) moves to dataset
//    `primary_vote_ley_scenario`; the Taylor headline (14/02/2026) stays in
//    `primary_vote`. Note the source holds only one Feb-2026 approval wave.
//
// Left UNREPAIRED (internally consistent, contradicts only the publication):
// the source stores 2024-02-25 federal LNP = 36 (Lib 32 + Nat 4), but the
// SMH/Age report of that wave printed "Coalition primary vote 37 per cent".
// The CSV mirrors the source at 36; the tracker keeps the published 37
// (see LNP_OK in .build/backfill-resolve-approval.mjs).
//
// 6. Q22 answerSecond = 0 upstream from 2026-04-18 (Nine stopped keying the
//    second option after the Hanson-era question changes). The 2026 payload
//    restores real values for that stretch; the merge REPAIRS committed
//    zero-fill rows in place (counted as wiw_restored) rather than locking
//    the zeros in, and any remaining fresh zero still prints a warning.
// 7. 2026 interactive rebuild (the migration this extractor now runs against):
//    a. values are obfuscated, not CryptoJS-encrypted (see decodeUx), and
//       ship UNROUNDED (1-2 decimals) where the 2021 generation stored
//       pre-rounded ints — committed CSV rows keep the old ints (Nine's own
//       .5-rounding was editorially inconsistent and cannot be re-derived),
//       fresh waves land at full precision; overlaps reconcile by key in the
//       merge (value mismatches counted, committed wins).
//    b. the Net computed answers (Coalition-Labor, Good-Poor) are gone
//       upstream; only committed rows carry them now.
//    c. Q22 was re-keyed in April 2026 (parties label "/ Other" appended
//       18/04, One Nation slot added 17/05 = answerThird); Q22 rows are kept
//       slot-named since the zip remap is only proven for leadership datasets.
//    d. leadership datasets' slot labels carry no meaning — parties[] zips
//       with the answers ARRAY ORDER; answers land as leader names.
//    e. upstream quirks archived as-is: a "QLD" breakdown key misfilled under
//       gender; Liberals/Nationals stored 0 on waves where only combined LNP
//       is published.
//
// `Total Others` = 100 - LNP - ALP and therefore INCLUDES the undecided
// share; it is NOT comparable with the tracker's `oth` (IND + OTH).
// Totals/components are rounded independently by Nine: TOTAL GOOD need not
// equal Very good + Good to the integer, so reconciled nets are to the
// nearest half point at best.
//
// Values/questions are CryptoJS passphrase format ("!e!...!e!", passphrase
// "sacho", from the interactive's own bundle), decrypted here with node:crypto.
//
// Usage: node .build/extract-resolve-rpm.mjs [--check] [--force] [url-or-file]
//
// Automation contract (safe to schedule in cron/launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing and
//     produces byte-identical output; a no-change run skips the write entirely
//   - exit 0 = success (changed or not); the final stdout line is
//     `RPM_STATUS {json}` with changed, row counts, repair counters, new_dates,
//     source_updated — machine-greppable in schedules
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped
//     (an expected section id vanished upstream, or the merge would SHRINK the
//     committed row set — legit only on a first structural-repair run;
//     re-run with --force after review)
//   - --check computes the full extraction and prints RPM_STATUS with
//     would-change info but never writes
//   - the CSV write is atomic (write to .tmp + rename over it)
// Fails loudly on unknown section ids / unmapped subSections — an upstream
// restructure is meant to surface as a non-zero exit, not silent data loss.
import { createHash, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
// The interactive was rebuilt for 2026 at its own path, and the 2021 file it
// replaced is still served — frozen. Reading the old one is why this extractor
// looked healthy while going quietly stale: it kept returning a clean, complete
// payload whose newest wave was 2026-07-12, weeks after 2026-08-16 was on the
// page. A dead endpoint that still answers 200 is the failure mode a status
// line cannot show you, which is what `source_updated` in RPM_STATUS is for.
const SRC = argv.find((a) => !a.startsWith("--")) || "https://www.smh.com.au/interactive/2026/political-monitor/site/data/data.json";
const OUT = "data/resolve-political-monitor.csv";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;

// Fetch/parse errors (and any unexpected throw) exit 1 with a clean message:
// the main flow below runs inside a try/catch.

const DATASETS = {
  Q5: "primary_vote",
  Q11: "well_being_index",
  Q17: "pm_performance",
  Q15: "opp_leader_performance",
  Q19: "preferred_pm",
  Q21a: "party_attributes",
  Q21b: "party_descriptors",
  Q22: "who_will_win",
  Q25NSW: "primary_vote_nsw",
  Q28NSW: "preferred_premier_nsw",
  Q29VIC: "primary_vote_vic",
  Q32VIC: "preferred_premier_vic",
  Q33QLD: "primary_vote_qld",
  Q34QLD: "preferred_premier_qld",
};

// Sections an earlier generation of the interactive carried and the current
// one does not. Their rows stay in the CSV — the merge keeps what the live
// file no longer refreshes — but requiring them would trip the guard on every
// run. Q11 (wellbeing) went when the 2026 interactive replaced the 2021 one:
// the series stops rather than disappearing.
const RETIRED = new Set(["Q11"]);

async function loadSource(src) {
  let buf;
  if (existsSync(src)) buf = readFileSync(src);
  else {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        break;
      } catch (err) {
        if (attempt >= FETCH_TRIES) throw new Error(`fetch ${src} failed after ${FETCH_TRIES} tries: ${err.message}`);
        console.warn(`fetch attempt ${attempt} failed (${err.message}); retrying`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  let data;
  try { data = JSON.parse(buf.toString("utf8")); }
  catch (err) { throw new Error(`fetch ${src}: invalid JSON (${err.message})`); }
  if (!Array.isArray(data.sections) || !data.sections.length)
    throw new Error(`fetch ${src}: payload has no sections (upstream restructure?)`);
  return data;
}

// CryptoJS open-file format: base64("Salted__"<8-byte salt><ciphertext>),
// key+iv via EVP_BytesToKey (MD5 chain) — AES-256-CBC.
function decodeCryptoJS(b64, passphrase) {
  const raw = Buffer.from(b64, "base64");
  if (raw.toString("utf8", 0, 8) !== "Salted__") throw new Error("not a salted cipher");
  const salt = raw.subarray(8, 16);
  const ct = raw.subarray(16);
  const pass = Buffer.from(passphrase, "utf8");
  let derived = Buffer.alloc(0);
  let next = Buffer.alloc(0);
  while (derived.length < 48) {
    next = createHash("md5").update(Buffer.concat([next, pass, salt])).digest();
    derived = Buffer.concat([derived, next]);
  }
  const d = createDecipheriv("aes-256-cbc", derived.subarray(0, 32), derived.subarray(32, 48));
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const decrypt = (v) => {
  if (typeof v !== "string" || !v.includes("!e!")) return v;
  return decodeCryptoJS(v.replace(/!e!/g, ""), "sacho");
};

// The 2026 rebuild of the interactive stopped CryptoJS-encrypting timeseries
// values; they now ship obfuscated per point — int part = base36 of
// (value XOR 123), fractional tail verbatim — decoded by Ux() in the site's
// own bundle (interactive/2026/political-monitor/site/assets/index-*.js):
//   "2l"    -> parseInt("2l",36)=93 ; 93^123 = 38
//   "2l.83" -> 38.83   ("-35.80" -> -12.8; JS XOR is signed, exactly as Ux)
// The 2026 payload also stores UNROUNDED values (1-2 decimals) where the 2021
// generation stored pre-rounded ints. The scheme is detected per-PAYLOAD, not
// per value: a pure-digit cipher like "31" is also a plausible plaintext
// number, so the only safe rule is that a payload's values all agree on one
// scheme (live check 2026-08: the 2021 payload is 100% "!e!", the 2026
// payload 100% xor-shaped). Anything mixed or unrecognised means an upstream
// change we have not modelled — stop, don't guess.
const decodeUx = (s) => {
  s = String(s);
  if (s.includes(".")) {
    const [i, f] = s.split(".");
    return parseFloat(`${parseInt(i, 36) ^ 123}.${f}`);
  }
  return parseInt(s, 36) ^ 123;
};

const XOR_VALUE = /^-?[0-9a-z]+(\.[0-9]+)?$/i;
let VALUE_SCHEME = null; // "crypto" | "xor", set by detectValueScheme post-fetch
function detectValueScheme(sections) {
  const values = [];
  (function walk(nodes) {
    for (const n of nodes || []) {
      for (const a of n.answers || [])
        for (const segs of [a.states, a.age, a.gender, a.categories])
          for (const seg of segs || [])
            for (const p of seg.timeseries || []) values.push(p.value);
      walk(n.subSections);
    }
  })(sections);
  let enc = 0, xor = 0, plain = 0;
  const other = [];
  for (const v of values) {
    if (typeof v === "number") plain++;
    else if (typeof v === "string" && v.includes("!e!")) enc++;
    else if (typeof v === "string" && XOR_VALUE.test(v)) xor++;
    else other.push(JSON.stringify(String(v).slice(0, 24)));
  }
  if (other.length)
    throw new Error(`unrecognised value encoding (${other.length} of ${values.length}), e.g. ${other.slice(0, 3).join(", ")} — upstream restructure?`);
  if (enc && xor) throw new Error(`mixed value encodings: ${enc} crypto + ${xor} xor across ${values.length} values — upstream restructure?`);
  VALUE_SCHEME = enc ? "crypto" : "xor";
}

const isoDate = (dmy) => {
  const [d, m, y] = String(dmy).split("/");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const num = (v) => {
  const n = typeof v === "number" ? v : VALUE_SCHEME === "xor" ? decodeUx(v) : parseFloat(decrypt(v));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "";
};

const csvCell = (x) => {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const stripTags = (s) => s.replace(/<[^>]*>/g, "").trim();

// Rows stay objects until the end so the repair passes can rewrite values and
// labels; stringified only at write time.
const ROW_KEYS = ["dataset", "question_id", "question", "visual", "answer", "dimension", "key", "date", "value_pct", "parties"];
const rowToLine = (r) => ROW_KEYS.map((k) => csvCell(r[k] ?? "")).join(",");
const parseLine = (line) => {
  const cells = [];
  let cell = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return Object.fromEntries(cells.map((v, i) => [ROW_KEYS[i], v]));
};

const SUB_DATASETS = {
  Q5: [[/actual .*election results/i, "election_2025_results"], [/firm are you/i, "vote_firmness"]],
  Q33QLD: [[/firm are you/i, "vote_firmness_qld"]],
  Q25NSW: [[/firm are you/i, "vote_firmness_nsw"]],
  Q29VIC: [[/firm are you/i, "vote_firmness_vic"]],
};

const rowsOut = [];
let wiwCorrupt2021 = 0, wiwZeroSecond = 0, electionPoints = 0, verbatimCount = 0;
let leaderNameResolutions = 0, leaderNameFallbacks = 0;

// Leadership datasets carry generic slot labels (answerFirst / answerUndecided
// / answerSecond / answerThird) whose MEANINGS live in the same point's
// parties array, zipped with the section's answers ARRAY ORDER: parties[i]
// names answers[i]'s target. Verified against the curated ppm rows (2026-07
// and 2026-08: the zip reproduces them exactly). Resolve slots to names per
// point — slot assignments shift across Nine's re-keyings (Q22 gained a One
// Nation slot on 2026-05-17) and across leadership changes, so only the
// per-point zip is trustworthy. who_will_win (Q22) is deliberately excluded:
// nothing downstream consumes it, and its zero-fill defect (6) is keyed by
// slot name.
const LEADER_NAME_DS = new Set(["preferred_pm", "preferred_premier_nsw", "preferred_premier_vic", "preferred_premier_qld"]);

function pushSeries(dataset, q, answer, dim, key, series, ansIndex) {
  for (const p of series || []) {
    const value = num(p.value);
    if (value === "") continue;
    // election-results baseline points are dated "election 2025" upstream;
    // store as polling day (only the election_2025_results dataset hits this).
    const date = p.date === "election 2025" ? "2025-05-03" : isoDate(p.date);
    if (dataset === "election_2025_results") electionPoints++;
    // (4) live Q22 rows for the 2021 waves overlap the Q444 archive and are
    // corrupt upstream; the archive stays authoritative for that stretch.
    if (dataset === "who_will_win" && date <= "2021-07-18") { wiwCorrupt2021++; continue; }
    // (6) Coalition series reads 0 upstream from Apr 2026.
    if (dataset === "who_will_win" && answer === "answerSecond" && date >= "2026-04-01" && value === 0) wiwZeroSecond++;
    const parties = (p.parties || []).map((x) => String(x).trim()).join("; ");
    let resolved = answer;
    if (LEADER_NAME_DS.has(dataset)) {
      const name = (p.parties || [])[ansIndex];
      if (name) { resolved = String(name).trim(); leaderNameResolutions++; }
      else leaderNameFallbacks++;
    }
    rowsOut.push({ dataset, question_id: q.id, question: q.question, visual: q.visual, answer: resolved, dimension: dim, key: key.trim(), date, value_pct: value, parties });
  }
}

const pushAnswers = (dataset, meta, answers) => {
  for (const [ai, ans] of (answers || []).entries()) {
    for (const [dim, segs] of [["region", ans.states], ["age", ans.age], ["gender", ans.gender], ["category", ans.categories]])
      for (const seg of segs || []) pushSeries(dataset, meta, ans.answer, dim, seg.key, seg.timeseries, ai);
  }
};

const walkSubs = (sec, subs) => {
  verbatimCount += (sec.customAnswers || []).length;
  for (const sub of subs || []) {
    verbatimCount += (sub.customAnswers || []).length;
    const question = stripTags(decrypt(sub.question) || "");
    const match = (SUB_DATASETS[sec.id] || []).find(([re]) => re.test(question));
    if ((sub.answers || []).length) {
      if (!match) throw new Error(`unmapped subSection "${question}" under ${sec.id}`);
      pushAnswers(match[1], { id: sec.id, question, visual: sub.visual || "" }, sub.answers);
    }
    if (match && !(sub.answers || []).length) throw new Error(`subSection "${question}" under ${sec.id} mapped but has no answers`);
    walkSubs({ id: sec.id }, sub.subSections);
  }
};

try {
const data = await loadSource(SRC);
detectValueScheme(data.sections);
const seenIds = new Set(data.sections.map((s) => s.id));
const missing = Object.keys(DATASETS).filter((id) => !RETIRED.has(id) && !seenIds.has(id));
if (missing.length) {
  console.error(`RPM_GUARD missing expected sections from source: ${missing.join(", ")}`);
  process.exit(2);
}
for (const sec of data.sections || []) {
  const dataset = DATASETS[sec.id];
  if (!dataset) throw new Error(`unknown section id ${sec.id}`);
  const question = stripTags(decrypt(sec.question) || "");
  const meta = { id: sec.id, question, visual: sec.visual || "" };
  pushAnswers(dataset, meta, sec.answers);
  walkSubs(sec, sec.subSections);
}

// (5) Feb 2026 scenario pair: move the Ley counterfactual out of primary_vote.
let leyScenario = 0;
for (const r of rowsOut) {
  if (r.dataset === "primary_vote" && r.date === "2026-02-12") { r.dataset = "primary_vote_ley_scenario"; leyScenario++; }
}

// Merge: existing CSV rows (previous extractions) stay on top, new rows beneath.
const header = "dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties";
const existing = existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n") : [];
const existingBody = existing[0] && existing[0].startsWith("dataset,") ? existing.slice(1) : [];
const existingRows = existingBody.filter(Boolean).map(parseLine);

// (1) legacy leader_performance: relabel Morrison-era rows as the opposition
// leader's; drop the post-2022-08 overlap with Q17. (4) drop previously
// committed corrupt Q22 rows for the 2021 waves, same as for fresh rows.
let legacyRenamed = 0, legacyDropped = 0, wiwExistingDropped = 0;
const legacyFixed = [];
for (const r of existingRows) {
  if (r.dataset === "who_will_win" && r.date <= "2021-07-18") { wiwExistingDropped++; continue; }
  if (r.dataset !== "leader_performance") { legacyFixed.push(r); continue; }
  if (r.date >= "2022-08-21") { legacyDropped++; continue; }
  r.dataset = "opp_leader_performance";
  legacyRenamed++;
  legacyFixed.push(r);
}

const combined = [...legacyFixed, ...rowsOut];

// (2)(3) Net reconciliation: a stored "Net" that contradicts the same wave's
// own totals is rewritten from the totals, with each rewrite logged. Runs on
// the combined set BEFORE dedupe so corrected rows collapse onto (or replace)
// rows written by earlier runs of this script.
const group = new Map();
for (const r of combined) {
  const g = `${r.dataset}|${r.dimension}|${r.key}|${r.date}`;
  if (!group.has(g)) group.set(g, new Map());
  const byAns = group.get(g);
  if (!byAns.has(r.answer)) byAns.set(r.answer, []);
  byAns.get(r.answer).push(r);
}
const netFixes = [];
const canonical = (byAns, answer) => (byAns.get(answer) || []).at(-1);
const reconcile = (dsNames, netAnswer, refAnswers, refLabel) => {
  for (const [g, byAns] of group) {
    if (!dsNames.includes(g.split("|")[0])) continue;
    const net = canonical(byAns, netAnswer);
    if (!net) continue;
    const refParts = refAnswers.map((a) => canonical(byAns, a)).map((x) => x && Number(x.value_pct));
    if (refParts.some((x) => x == null || !Number.isFinite(x))) continue;
    const ref = Math.round(refParts.reduce((acc, v, i) => acc + (i === 0 ? v : -v), 0) * 100) / 100;
    for (const row of byAns.get(netAnswer) || []) {
      if (Math.abs(Number(row.value_pct) - ref) > 1.5) {
        netFixes.push(`${g}: ${row.value_pct} -> ${ref} (${refLabel})`);
        row.value_pct = ref;
      }
    }
  }
};
const PRIMARY_DS = ["primary_vote", "primary_vote_nsw", "primary_vote_vic", "primary_vote_qld", "primary_vote_ley_scenario"];
reconcile(PRIMARY_DS, "Net (Coalition - Labor)", ["LNP", "ALP"], "LNP-ALP");
reconcile(["pm_performance", "opp_leader_performance"], "Net (Good - Poor)", ["TOTAL GOOD", "TOTAL POOR"], "TOTAL GOOD-TOTAL POOR");

// Exact-line dedupe first: identical rows from re-extraction collapse.
const seenLines = new Set();
const lineDeduped = [];
for (const r of combined) {
  const line = rowToLine(r);
  if (seenLines.has(line)) continue;
  seenLines.add(line);
  lineDeduped.push(r);
}

// Keyed reconciliation. The 2026 payload restates pre-2026-07 waves at full
// decimal precision, and Nine's own int rounding upstream is editorially
// inconsistent on exact .5s, so a fresh row and its committed twin almost
// never string-match even when they are the same measurement. Committed rows
// are the archive's authority: a fresh row sharing a committed row's key
// (question, answer, breakdown, wave) but not its bytes is DROPPED — a value
// mismatch counts as a conflict (first few logged below); same value with
// different ornamentation (question text, parties) counts as metadata drift.
// The one exception is defect (6): where the committed value is an upstream
// zero-fill and the fresh payload restores a real one, the committed row is
// repaired in place rather than locking the zero in.
const keyOf = (r) => [r.dataset, r.question_id, r.answer, r.dimension, r.key, r.date].join("|");
const isCommitted = new Set(legacyFixed); // object identity across the dedupe pass
const committedByKey = new Map();
const merged = [];
for (const r of lineDeduped) {
  if (!isCommitted.has(r)) continue;
  committedByKey.set(keyOf(r), r);
  merged.push(r);
}
let valueConflicts = 0, metaDrift = 0, wiwRestored = 0, repRounding = 0;
const conflictSamples = [];
const conflictFams = new Map(); // dataset -> count, for the one-line breakdown
for (const r of lineDeduped) {
  if (isCommitted.has(r)) continue;
  const k = keyOf(r);
  const cur = committedByKey.get(k);
  if (!cur) {
    merged.push(r);
    committedByKey.set(k, r); // two fresh rows with one key: first kept, the next counts below
    continue;
  }
  const curV = Number(cur.value_pct), newV = Number(r.value_pct);
  if (curV !== newV) {
    // (7a) Representation, not restatement: a committed int and a fresh
    // decimal within rounding distance are the same measurement in the two
    // payload generations. Keep the committed int and count it quietly —
    // counting ~28k of these as conflicts would mask a REAL restatement.
    if (Number.isInteger(curV) && Math.abs(newV - curV) < 0.5) repRounding++;
    else if (r.dataset === "who_will_win" && r.answer === "answerSecond" && curV === 0 && newV !== 0 && r.date >= "2026-04-01") {
      cur.value_pct = newV;
      wiwRestored++;
    } else {
      valueConflicts++;
      conflictFams.set(r.dataset, (conflictFams.get(r.dataset) || 0) + 1);
      if (conflictSamples.length < 12) conflictSamples.push(`${k}: kept ${cur.value_pct} over fresh ${r.value_pct}`);
    }
  } else metaDrift++;
}

const output = [header, ...merged.map(rowToLine)].join("\n") + "\n";
const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
const changed = previous !== output;

// Safety guard: a run that would shrink the committed row set indicates an
// upstream loss or a broken extraction, never a routine update. The one legit
// case is the first structural-repair run after this guard was introduced
// (and any deliberate future drop); review, then re-run with --force.
if (changed && merged.length < existingRows.length && !FORCE) {
  console.error(`RPM_GUARD merge would shrink ${OUT}: ${existingRows.length} -> ${merged.length} rows. Aborting (re-run with --force after review).`);
  process.exit(2);
}

if (CHECK) console.log(`--check: ${OUT} ${changed ? "would be updated" : "is already up to date"}`);
else if (changed) {
  writeFileSync(OUT + ".tmp", output);
  renameSync(OUT + ".tmp", OUT);
  console.log(`updated ${OUT}: kept ${existingRows.length} existing rows, added ${rowsOut.length}, wrote ${merged.length} total (${legacyFixed.length + rowsOut.length - merged.length} dupes)`);
} else console.log(`no change: ${OUT} unchanged (${merged.length} rows)`);

console.log(`drops/renames: wiw-corrupt-2021=${wiwCorrupt2021} wiw-existing-dropped=${wiwExistingDropped} legacy-relabelled=${legacyRenamed} legacy-dropped=${legacyDropped} ley-scenario=${leyScenario} wiw-zero-second-warn=${wiwZeroSecond}`);
console.log(`subsections: election-2025-points=${electionPoints} verbatim-comments-skipped=${verbatimCount}`);
console.log(`merge: value_conflicts=${valueConflicts} rep_rounding=${repRounding} meta_drift=${metaDrift} wiw_restored=${wiwRestored} leader_names=${leaderNameResolutions} leader_name_fallbacks=${leaderNameFallbacks} scheme=${VALUE_SCHEME}`);
if (valueConflicts) console.log(`conflicts by dataset: ${[...conflictFams.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}=${n}`).join(" ")}`);
for (const c of conflictSamples) console.log("  #", c);
console.log(`net rows corrected: ${netFixes.length}`);
for (const f of netFixes) console.log("  ~", f);
const dates = [...new Set(rowsOut.map((r) => r.date))].sort();
console.log("fresh dates:", dates[0], "->", dates.at(-1));
console.log("source updated:", data.updated);

// Machine-readable single-line status for scheduled runs (see header comment).
const newDates = previous === null ? dates : dates.filter((d) => !existingBody.some((l) => l.includes(`,${d},`)));
console.log(`RPM_STATUS ${JSON.stringify({
  changed: changed && !CHECK,
  check: CHECK,
  scheme: VALUE_SCHEME,
  rows_kept: legacyFixed.length,
  rows_fresh: rowsOut.length,
  rows_total: merged.length,
  net_fixes: netFixes.length,
  value_conflicts: valueConflicts,
  rep_rounding: repRounding,
  meta_drift: metaDrift,
  wiw_restored: wiwRestored,
  leader_names: leaderNameResolutions,
  leader_name_fallbacks: leaderNameFallbacks,
  dropped_corrupt_2021: wiwCorrupt2021 + wiwExistingDropped,
  legacy_relabelled: legacyRenamed,
  legacy_dropped: legacyDropped,
  ley_scenario_rows: leyScenario,
  wiw_zero_second_warn: wiwZeroSecond,
  election_points: electionPoints,
  verbatim_comments_skipped: verbatimCount,
  new_dates: newDates,
  source_updated: data.updated ?? null,
})}`);
} catch (err) {
  console.error(`RPM_ERROR ${err.message}`);
  process.exit(1);
}
