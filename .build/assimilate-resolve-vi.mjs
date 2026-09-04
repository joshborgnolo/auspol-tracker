// Add Resolve Political Monitor waves from data/resolve-political-monitor.csv
// to the Resolve rows in data/polls.json — three sections:
//
//   VI       primary_vote / National -> polls   (with vote_firmness TOTAL SOFT as `soft`)
//   ppm      preferred_pm / National  -> ppm    (leader-name answers; see below)
//   approval pm_performance + opp_leader_performance / National -> approval
//
// Runs in the wrapper after the CSV changes, so only genuinely new waves are
// candidates:
//   - a wave becomes a tracker row dated csvDate - 1 day (the convention of
//     the curated Resolve rows: csv 2026-07-12 -> row 2026-07-11);
//   - waves at/before the earliest existing Resolve row (per section) are
//     ignored (no backfill of pre-curation history);
//   - a wave is skipped when a row sits within +/-2 days of the computed date
//     or a row within +/-10 days carries identical figures, so re-runs are
//     no-ops and curated rows are never duplicated.
//
// Figures: the CSV now carries UNROUNDED payload values (defect 7 in
// extract-resolve-rpm.mjs); polls.json holds ints, so everything is rounded
// here (half-up). The last curated waves replay exactly under half-up —
// 2026-08-15 VI 28/23/12/26/7/4, ppm 32/19/26. One known delta class: SMH's
// printed article ints are editorially rounded by Nine and can disagree with
// half-up by 1 on knife-edge values (curated 2026-08-15 opp approval 40 vs
// payload 40.86); auto rows follow the payload, flagged assimilated: true.
//
// ppm rows come from the CSV's preferred_pm dataset, whose answers the
// extractor has already resolved to leader NAMES (parties[] zips with the
// payload's answers-array order — slot labels like answerUndecided carry no
// meaning). PM must be Anthony Albanese and the opposition leader is the one
// remaining non-Hanson, non-undecided name; a wave whose names don't fit
// that shape is skipped loudly, not guessed at.
//
// Row shapes mirror the curated rows; keys the CSV cannot supply stay absent:
//   VI       lnp takes the combined LNP answer, falling back to Liberals +
//            Nationals; tpp stays null (Resolve publishes no 2PP); the CSV's
//            aggregate "Total Others" answer is not a vote share, ignored.
//   ppm      {date,firm,alb,opp,oppName,han,extra:null}; han from the Hanson
//            slot when present.
//   approval {date,firm,alb,opp,oppName,han:null,detail:{alb,opp} as
//            {app,dis}}; Hanson approval and the `fav` series are not in the
//            payload (they come from the SMH article's own embeds), so auto
//            rows omit them.
// The CSV carries no sample/url/fieldwork window either; `assimilated: true`
// records where the row came from and exempts it from the validator's
// sample-size rule.
//
// Dry-run by default; --apply writes data/polls.json and a provenance file.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const DAY = 86400000;
const FIRM = "Resolve";

// full CSV parser (question text can contain commas)
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const csv = parseCsv(readFileSync("data/resolve-political-monitor.csv", "utf8").trim());
const [header, ...lines] = csv;
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = lines.map((l) => ({
  dataset: l[col.dataset],
  answer: l[col.answer],
  dimension: l[col.dimension],
  key: l[col.key],
  date: l[col.date],
  question: l[col.question],
  value: l[col.value_pct] === "" ? null : Number(l[col.value_pct]),
}));

const nat = (dataset) => {
  const byDate = new Map();
  for (const r of rows) {
    if (r.dataset !== dataset || r.dimension !== "region" || r.key !== "National") continue;
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.answer] = r.value;
  }
  return byDate;
};

const vi = nat("primary_vote");
const ppmWaves = nat("preferred_pm");
const pmPerf = nat("pm_performance");
const oppPerf = nat("opp_leader_performance");
const firmness = [...nat("vote_firmness").entries()]
  .flatMap(([date, a]) => a["TOTAL SOFT"] == null ? [] : [{ date, v: a["TOTAL SOFT"] }])
  .sort((a, b) => a.date < b.date ? -1 : 1);

const r0 = (x) => (x == null ? null : Math.round(x));
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const softNear = (dateIso) => firmness.find((f) => f.date === dateIso)
  || firmness.filter((f) => days(f.date, dateIso) <= 2)
    .sort((a, b) => days(a.date, dateIso) - days(b.date, dateIso))[0]
  || null;

const surname = (full) => full.trim().split(/\s+/).at(-1);

// The CSV stores each section's question text per row; the latest row names
// the current leader ("How would you rate Angus Taylor’s performance…").
function currentLeader(dataset) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].dataset !== dataset) continue;
    const m = /rate\s+(.+?)[’']s\s+performance/i.exec(rows[i].question || "");
    if (m) return m[1].trim();
  }
  return null;
}
const pmName = currentLeader("pm_performance");
const oppLeaderName = currentLeader("opp_leader_performance");
if (pmName && !/albanese/i.test(pmName))
  console.log(`note: pm_performance names "${pmName}" — approval section skipped (PM slot is hardcoded Albanese)`);
if (!oppLeaderName) console.log("note: could not parse opposition-leader name from opp_leader_performance question text — approval section skipped");

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const horizon = (list) => list.reduce((m, p) => (p.date < m ? p.date : m), "9999");
const insertByDate = (list, row) => {
  const at = list.findIndex((p) => p.date > row.date);
  list.splice(at === -1 ? list.length : at, 0, row);
};
const waveDateOf = (csvDate) => iso(Date.parse(csvDate) - DAY);

const report = { vi: { added: [], skipped: null }, ppm: { added: [], skipped: null }, approval: { added: [], skipped: null } };

// ---- VI ------------------------------------------------------------------
{
  const existing = D.polls.filter((p) => p.pollster === FIRM);
  const hz = horizon(existing);
  const close = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.5);
  const sameFigures = (p, r) => ["alp", "lnp", "grn", "onp", "ind", "oth"].every((k) => close(p[k], r[k]));
  const skippedDateDup = [], skippedFigureDup = [], skippedPreHorizon = [];
  for (const waveDate of [...vi.keys()].sort()) {
    const a = vi.get(waveDate);
    const date = waveDateOf(waveDate);
    if (date <= hz) { skippedPreHorizon.push(waveDate); continue; }
    if (existing.some((p) => days(p.date, date) <= 2)) { skippedDateDup.push(waveDate); continue; }
    const lib = a["Liberals"], natl = a["Nationals"];
    const soft = softNear(date);
    const row = {
      date,
      pollster: "Resolve",
      client: "SMH / Age",
      sample: null,
      alp: r0(a["ALP"]),
      lnp: a["LNP"] != null ? r0(a["LNP"]) : (lib == null && natl == null ? null : r0((lib ?? 0) + (natl ?? 0))),
      grn: r0(a["GRN"]),
      onp: r0(a["ONP"]),
      ind: r0(a["IND"]),
      oth: r0(a["OTH"]),
      tpp_alp: null,
      tpp_lnp: null,
      ...(soft ? { soft: r0(soft.v) } : {}),
      assimilated: true,
    };
    const figDup = existing.find((p) => days(p.date, row.date) <= 10 && sameFigures(p, row));
    if (figDup) { skippedFigureDup.push({ csvWave: waveDate, matchesRow: figDup.date }); continue; }
    insertByDate(D.polls, row);
    existing.push(row);
    report.vi.added.push({ csvWave: waveDate, row });
  }
  report.vi.skipped = { preHorizon: skippedPreHorizon.length, dateDup: skippedDateDup.length, figureDup: skippedFigureDup, horizon: hz };
}

// ---- preferred PM ----------------------------------------------------------
{
  const existing = (D.ppm || []).filter((p) => p.firm === FIRM);
  const hz = horizon(existing);
  const skippedDateDup = [], skippedShape = [], skippedPreHorizon = [];
  for (const waveDate of [...ppmWaves.keys()].sort()) {
    const date = waveDateOf(waveDate);
    if (date <= hz) { skippedPreHorizon.push(waveDate); continue; }
    if (existing.some((p) => days(p.date, date) <= 2)) { skippedDateDup.push(waveDate); continue; }
    const a = ppmWaves.get(waveDate);
    const names = Object.entries(a).filter(([n, v]) => v != null && !/undecided|someone else|don.?t know/i.test(n));
    const pm = names.find(([n]) => /anthony albanese/i.test(n));
    const han = names.find(([n]) => /pauline hanson/i.test(n));
    const others = names.filter(([n]) => n !== pm?.[0] && n !== han?.[0]);
    if (!pm || others.length !== 1) {
      skippedShape.push({ csvWave: waveDate, names: Object.keys(a) });
      console.log(`ppm: wave ${waveDate} skipped — names don't fit PM + one opposition leader: ${Object.keys(a).join("; ")}`);
      continue;
    }
    const row = {
      date,
      firm: FIRM,
      alb: r0(pm[1]),
      opp: r0(others[0][1]),
      oppName: surname(others[0][0]),
      han: han ? r0(han[1]) : null,
      extra: null,
      assimilated: true,
    };
    if (existing.some((p) => days(p.date, date) <= 10 && p.alb === row.alb && p.opp === row.opp)) { skippedDateDup.push(waveDate); continue; }
    insertByDate(D.ppm, row);
    existing.push(row);
    report.ppm.added.push({ csvWave: waveDate, row });
  }
  report.ppm.skipped = { preHorizon: skippedPreHorizon.length, dateOrFigureDup: skippedDateDup.length, nameShape: skippedShape };
}

// ---- leadership approval ----------------------------------------------------
const approvalRowsAdded = [];
if (pmName && /albanese/i.test(pmName) && oppLeaderName) {
  const existing = (D.approval || []).filter((p) => p.firm === FIRM);
  const hz = horizon(existing);
  for (const waveDate of new Set([...pmPerf.keys(), ...oppPerf.keys()])) {
    const date = waveDateOf(waveDate);
    if (date <= hz) continue;
    if (existing.some((p) => days(p.date, date) <= 2)) continue;
    const pmW = pmPerf.get(waveDate), oppW = oppPerf.get(waveDate);
    if (!pmW?.["TOTAL GOOD"] || !pmW?.["TOTAL POOR"] || !oppW?.["TOTAL GOOD"] || !oppW?.["TOTAL POOR"]) {
      console.log(`approval: wave ${waveDate} skipped — incomplete leadership ratings`);
      continue;
    }
    const row = {
      date,
      firm: FIRM,
      alb: r0(pmW["TOTAL GOOD"]) - r0(pmW["TOTAL POOR"]),
      opp: r0(oppW["TOTAL GOOD"]) - r0(oppW["TOTAL POOR"]),
      oppName: surname(oppLeaderName),
      han: null,
      detail: {
        alb: { app: r0(pmW["TOTAL GOOD"]), dis: r0(pmW["TOTAL POOR"]) },
        opp: { app: r0(oppW["TOTAL GOOD"]), dis: r0(oppW["TOTAL POOR"]) },
      },
      assimilated: true,
    };
    if (existing.some((p) => days(p.date, date) <= 10 && p.alb === row.alb && p.opp === row.opp)) continue;
    insertByDate(D.approval, row);
    existing.push(row);
    approvalRowsAdded.push({ csvWave: waveDate, row });
  }
}
report.approval.added = approvalRowsAdded;

const total = report.vi.added.length + report.ppm.added.length + report.approval.added.length;
console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
for (const [k, sec] of Object.entries(report)) {
  console.log(`${k}: added ${sec.added.length}` + (sec.skipped ? ` (skipped: pre-horizon ${sec.skipped.preHorizon ?? 0}, dups ${(sec.skipped.dateDup ?? 0) + (sec.skipped.dateOrFigureDup ?? 0)}, name-shape ${sec.skipped.nameShape?.length ?? 0})` : ""));
  for (const x of sec.added) console.log(`  + ${x.row.date} (csv ${x.csvWave}):`, JSON.stringify(x.row));
}

if (APPLY && total) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeAtomic("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
if (APPLY) {
  mkdirSync(".build/resolve-rpm-src", { recursive: true });
  writeFileSync(".build/resolve-rpm-src/assimilate-vi-proof.json", JSON.stringify({
    generatedAt: new Date().toISOString(), ...report,
  }, null, 2) + "\n");
}
console.log(`ASSIMILATE_STATUS ${JSON.stringify({
  pollster: FIRM,
  added_vi: report.vi.added.length,
  added_ppm: report.ppm.added.length,
  added_approval: report.approval.added.length,
  changed: total > 0,
})}`);
