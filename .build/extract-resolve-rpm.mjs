// Extract every polling series from the Resolve Political Monitor interactive
// (https://www.smh.com.au/national/resolve-political-monitor-20210322-p57cvx.html,
// data source https://www.smh.com.au/interactive/2021/political-monitor/data/data.json)
// and merge with the rows already in data/resolve-political-monitor.csv.
//
// Datasets produced from the live file (question ids are the interactive's):
//   Q5  primary_vote             federal primary vote, 2021-04 -> latest, National + regions
//   Q17 pm_performance           PM job rating (series starts Aug 2022)
//   Q15 opp_leader_performance   opposition-leader job rating (series starts Aug 2022)
//   Q22 who_will_win             expected election winner ("two group preffered bar")
//   Q21a party_attributes        "which party would perform best" per policy area
//   Q21b party_descriptors       statements describing each party
//   Q11 well_being_index         Self / State / Country wellbeing
//   Q25NSW primary_vote_nsw      NSW state primary vote
//   Q28NSW preferred_premier_nsw NSW premier vs opposition leader
//   Q29VIC primary_vote_vic      VIC state primary vote
//   Q32VIC preferred_premier_vic VIC premier vs opposition leader
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
//    second option after the Hanson-era question changes). Extracted as-is;
//    a warning is printed.
//
// `Total Others` = 100 - LNP - ALP and therefore INCLUDES the undecided
// share; it is NOT comparable with the tracker's `oth` (IND + OTH).
// Totals/components are rounded independently by Nine: TOTAL GOOD need not
// equal Very good + Good to the integer, so reconciled nets are to the
// nearest half point at best.
//
// Values/questions are CryptoJS passphrase format ("!e!...!e!", passphrase
// "sacho", from the interactive's own bundle), decrypted here with node:crypto.
// Usage: node .build/extract-resolve-rpm.mjs [url-or-file]
import { createHash, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SRC = process.argv[2] || "https://www.smh.com.au/interactive/2021/political-monitor/data/data.json";
const OUT = "data/resolve-political-monitor.csv";

const DATASETS = {
  Q5: "primary_vote",
  Q11: "well_being_index",
  Q17: "pm_performance",
  Q15: "opp_leader_performance",
  Q21a: "party_attributes",
  Q21b: "party_descriptors",
  Q22: "who_will_win",
  Q25NSW: "primary_vote_nsw",
  Q28NSW: "preferred_premier_nsw",
  Q29VIC: "primary_vote_vic",
  Q32VIC: "preferred_premier_vic",
};

async function loadSource(src) {
  let buf;
  if (existsSync(src)) buf = readFileSync(src);
  else {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${src}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  return JSON.parse(buf.toString("utf8"));
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

const isoDate = (dmy) => {
  const [d, m, y] = String(dmy).split("/");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const num = (v) => {
  const n = parseFloat(decrypt(v));
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
  Q25NSW: [[/firm are you/i, "vote_firmness_nsw"]],
  Q29VIC: [[/firm are you/i, "vote_firmness_vic"]],
};

const rowsOut = [];
let wiwCorrupt2021 = 0, wiwZeroSecond = 0, electionPoints = 0, verbatimCount = 0;

function pushSeries(dataset, q, answer, dim, key, series) {
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
    rowsOut.push({ dataset, question_id: q.id, question: q.question, visual: q.visual, answer, dimension: dim, key: key.trim(), date, value_pct: value, parties });
  }
}

const pushAnswers = (dataset, meta, answers) => {
  for (const ans of answers || []) {
    for (const [dim, segs] of [["region", ans.states], ["age", ans.age], ["gender", ans.gender], ["category", ans.categories]])
      for (const seg of segs || []) pushSeries(dataset, meta, ans.answer, dim, seg.key, seg.timeseries);
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

const data = await loadSource(SRC);
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

const seen = new Set();
const merged = [];
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
const PRIMARY_DS = ["primary_vote", "primary_vote_nsw", "primary_vote_vic", "primary_vote_ley_scenario"];
reconcile(PRIMARY_DS, "Net (Coalition - Labor)", ["LNP", "ALP"], "LNP-ALP");
reconcile(["pm_performance", "opp_leader_performance"], "Net (Good - Poor)", ["TOTAL GOOD", "TOTAL POOR"], "TOTAL GOOD-TOTAL POOR");

for (const r of combined) {
  const line = rowToLine(r);
  if (seen.has(line)) continue;
  seen.add(line);
  merged.push(r);
}

writeFileSync(OUT, [header, ...merged.map(rowToLine)].join("\n") + "\n");

console.log(`updated ${OUT}: kept ${existingRows.length} existing rows, added ${rowsOut.length}, wrote ${merged.length} total (${legacyFixed.length + rowsOut.length - merged.length} dupes)`);
console.log(`drops/renames: wiw-corrupt-2021=${wiwCorrupt2021} wiw-existing-dropped=${wiwExistingDropped} legacy-relabelled=${legacyRenamed} legacy-dropped=${legacyDropped} ley-scenario=${leyScenario} wiw-zero-second-warn=${wiwZeroSecond}`);
console.log(`subsections: election-2025-points=${electionPoints} verbatim-comments-skipped=${verbatimCount}`);
console.log(`net rows corrected: ${netFixes.length}`);
for (const f of netFixes) console.log("  ~", f);
const dates = [...new Set(rowsOut.map((r) => r.date))].sort();
console.log("fresh dates:", dates[0], "->", dates.at(-1));
console.log("source updated:", data.updated);
