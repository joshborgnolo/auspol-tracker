// Add Essential's voting-intention waves (CSV primary "Primary Vote+" and
// 2pp "2PP+") to the Essential rows in data/polls.json, its leader-approval
// Trend series (Q-codes, currently Q37 Albanese / Q56 Taylor) to the
// "approval" array, and its "National mood (Trend)" series to the
// "direction" array. Runs in the wrapper after the CSV changes, so only
// genuinely new waves are candidates:
//   - a wave becomes a tracker row dated csvDate - 1 day: the CSV dates the
//     wave by publication day, curated rows by fieldwork end (a 1-5 day
//     gap in recent waves; -1 is the dominant recent offset);
//   - waves at/before the earliest existing Essential poll row are ignored
//     (no backfill of pre-curation history);
//   - a wave is skipped when an existing row sits within +/-2 days of the
//     computed date, OR when a row within +/-10 days carries identical
//     figures (the publication->fieldwork gap can exceed the date
//     tolerance — csv 2026-01-28 is the row curated at 2026-01-23 — while
//     two real distinct waves rarely share all figures). Together those
//     rules mean re-runs are no-ops and curated rows are never duplicated.
// Poll row shape matches the curated rows: ind = Independent + Undecided
// (the combined figure carried by all curated waves except 2026-07-27,
// whose sumNote documents its undecided-exclusive deviation), oth null,
// tpp as published undecided-inclusive (pollsterRules.Essential
// .tppIncludesUndecided reads the shortfall as undecided-after-
// preferences). The CSV carries no sample/url/fieldwork window, but the
// curated Essential convention is recoverable: published = the Guardian
// embargo stamp (csvDate + 1 day, 01:00 Sydney) and dateStart = date - 5
// days (the curated fieldwork window), so both are set on inserted rows.
// The wave's own release page is resolved from .build/essential-src/
// report-index.json (written by the extractor) and lands in releaseUrl —
// the WP record date can lag the wave date by a day (UTC post timestamps
// vs Sydney wave labels), so the lookup allows +/-1 day. Essential
// publishes the report page AFTER the charts update in place, so a new
// wave often has no indexed page yet; the retro-fill below completes the
// row on a later run. Guardian write-up URLs are not derivable: a NOTE is
// logged so the url key can be hand-set.
// Rows are flagged `assimilated: true`, which records where they came from
// and exempts them from the validator's sample-size rule.
//
// Retro-fill: existing assimilated rows are incomplete by construction
// (2PP lands after primaries; releaseUrl after the report page goes up;
// published/dateStart were originally omitted). Before inserting anything
// new, every Essential assimilated row is completed from the CSV and
// report index: tpp_alp/tpp_lnp from the 2PP+ wave, published, dateStart,
// releaseUrl. Rows are rebuilt in canonical curated key order. This is the
// pass that keeps the pipeline self-repairing for late-arriving data.
//
// Approval/direction: only the datasets named in LEADER_APPROVAL are
// mapped. Leadership changes spin up a new dataset id, so every OTHER
// approval_of_* dataset with a Trend/Overall series logs a WARNING each
// run — extend LEADER_APPROVAL when one of them is a new leader series.
// Dry-run by default; --apply writes data/polls.json and a provenance file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const DAY = 86400000;

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

const csv = parseCsv(readFileSync("data/essential-report.csv", "utf8").trim());
const [header, ...lines] = csv;
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = lines.map((l) => ({
  dataset: l[col.dataset],
  question_id: l[col.question_id],
  question: l[col.question],
  visual: l[col.visual],
  answer: l[col.answer],
  date: l[col.date],
  value: l[col.value_pct] === "" ? null : Number(l[col.value_pct]),
}));

const wavesFor = (dataset, question, visual = "Overall") => {
  const byDate = new Map();
  for (const r of rows) {
    if (r.dataset !== dataset || r.question !== question || r.visual !== visual) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.answer] = r.value;
  }
  return byDate;
};

// like wavesFor but indifferent to the question label (Essential retitles
// the leader-approval chart when leadership changes, e.g. "Approval of
// Sussan Ley / Angus Taylor")
const datasetWaves = (dataset, visual) => {
  const byDate = new Map();
  for (const r of rows) {
    if (r.dataset !== dataset || r.visual !== visual) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.answer] = r.value;
  }
  return byDate;
};

const vi = wavesFor("primary", "Primary Vote+");
const tpp = wavesFor("2pp", "2PP+");
const tppDates = [...tpp.keys()].sort();

// Leader-approval Trend datasets -> which leadership slot they feed.
// Deliberately explicit: a leadership change creates a new dataset id and
// the WARNING below must fire so a human extends this map.
const LEADER_APPROVAL = {
  approval_of_anthony_albanese: { who: "alb", surname: "Albanese" },
  approval_of_angus_taylor: { who: "opp", surname: "Taylor" },
};
const OPP_SURNAME = Object.values(LEADER_APPROVAL).find((m) => m.who === "opp").surname;
const appWaves = {};
for (const [ds, m] of Object.entries(LEADER_APPROVAL)) appWaves[m.who] = datasetWaves(ds, "Trend");
const mood = wavesFor("national_mood", "National mood (Trend)", "Trend");

// Loud self-repair trigger, flooding-free: only standing Q-code approval
// questions are warned on (one-off E-code/policy questions are out of
// scope), and standing non-PM/LO leader series are listed in
// KNOWN_OTHER_APPROVALS. Anything else new (e.g. a replacement opposition
// leader's fresh dataset id) fires one WARNING line per run.
const KNOWN_OTHER_APPROVALS = new Set([
  "approval_of_pauline_hanson",
  "approval_of_adam_bandt",
  "approval_of_barnaby_joyce",
  "approval_of_peter_dutton",
  "approval_of_scott_morrison",
  "approval_of_jim_chalmers",
  "approval_of_chris_minns",
  "approval_of_dominic_perrottet",
  "approval_of_jacinta_allan",
  "approval_of_brad_battin",
  "approval_of_king_charles",
]);
const knownApprovalDs = new Set(Object.keys(LEADER_APPROVAL));
const unknownApproval = [];
for (const r of rows) {
  if (!r.dataset.startsWith("approval_of_") || knownApprovalDs.has(r.dataset)) continue;
  if (KNOWN_OTHER_APPROVALS.has(r.dataset)) continue;
  if (!/^Q\d+$/.test(r.question_id ?? "")) continue;
  if (r.visual !== "Trend" && r.visual !== "Overall") continue;
  if (unknownApproval.some((u) => u.dataset === r.dataset)) continue;
  unknownApproval.push({ dataset: r.dataset, question: r.question });
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const near = (dates, targetIso) => {
  const t = Date.parse(targetIso);
  const hit = dates.find((d) => d === targetIso)
    || dates.filter((d) => Math.abs(Date.parse(d) - t) / DAY <= 2)
      .sort((a, b) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t))[0];
  return hit || null;
};

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const existing = D.polls.filter((p) => p.pollster === "Essential");
const horizon = existing.reduce((m, p) => (p.date < m ? p.date : m), "9999");

// WP record date = publish day on UTC, wave date = publish day on Sydney;
// the record can sit a day behind, never ahead of its wave.
const reportIndex = existsSync(".build/essential-src/report-index.json")
  ? JSON.parse(readFileSync(".build/essential-src/report-index.json", "utf8"))
  : null;
const releaseFor = (waveDate) => {
  if (!reportIndex) return null;
  const t = Date.parse(waveDate);
  return reportIndex[waveDate] ?? reportIndex[iso(t - DAY)] ?? null;
};

const close = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.5);
const sameFigures = (p, r) =>
  ["alp", "lnp", "grn", "onp", "ind", "tpp_alp", "tpp_lnp"].every((k) => close(p[k], r[k]));
const daysApart = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const publishedFor = (csvWave) => iso(Date.parse(csvWave) + DAY) + "T01:00";
const fieldworkStart = (date) => iso(Date.parse(date) - 5 * DAY);

// canonical curated poll-row key order, used to rebuild retro-filled rows
const POLL_KEY_ORDER = ["date", "published", "dateStart", "pollster", "client", "sample",
  "alp", "lnp", "grn", "onp", "ind", "oth", "tpp_alp", "tpp_lnp",
  "url", "sumNote", "releaseUrl", "assimilated"];
const reorderPollRow = (p) => {
  const out = {};
  for (const k of [...POLL_KEY_ORDER, ...Object.keys(p)]) if (k in p && !(k in out)) out[k] = p[k];
  return out;
};

// --- retro-fill: complete rows the insert pass originally wrote partial ---
const retro = [];
for (let i = 0; i < D.polls.length; i++) {
  const p = D.polls[i];
  if (p.pollster !== "Essential" || p.assimilated !== true) continue;
  const csvWave = iso(Date.parse(p.date) + DAY);
  const fixes = [];
  if (!vi.has(csvWave)) {
    console.log(`WARNING: assimilated row ${p.date} has no matching CSV wave ${csvWave}; retro-fill skipped`);
    continue;
  }
  if (p.published == null) { p.published = publishedFor(csvWave); fixes.push(`published ${p.published}`); }
  if (p.dateStart == null) { p.dateStart = fieldworkStart(p.date); fixes.push(`dateStart ${p.dateStart}`); }
  if (p.tpp_alp == null || p.tpp_lnp == null) {
    const tDate = near(tppDates, p.date);
    if (tDate) {
      const t = tpp.get(tDate);
      p.tpp_alp = t["Labor"] ?? p.tpp_alp;
      p.tpp_lnp = t["TOTAL: Coalition"] ?? p.tpp_lnp;
      fixes.push(`tpp ${p.tpp_alp}/${p.tpp_lnp} (csv ${tDate})`);
    }
  }
  if (p.releaseUrl == null) {
    const rel = releaseFor(csvWave);
    if (rel) { p.releaseUrl = rel; fixes.push(`releaseUrl ${rel}`); }
    else fixes.push("releaseUrl still unavailable (report page not indexed yet)");
  }
  if (p.url == null) fixes.push("url still unset — hand-set the Guardian write-up URL");
  if (fixes.length) {
    D.polls[i] = reorderPollRow(p);
    retro.push({ date: p.date, fixes });
  }
}

// --- insert pass: voting intention + 2PP ---
const added = [], skippedDateDup = [], skippedFigureDup = [], skippedPreHorizon = [];
for (const waveDate of [...vi.keys()].sort()) {
  const a = vi.get(waveDate);
  const date = iso(Date.parse(waveDate) - DAY);
  if (date <= horizon) { skippedPreHorizon.push(waveDate); continue; }
  if (existing.some((p) => daysApart(p.date, date) <= 2)) { skippedDateDup.push(waveDate); continue; }
  const tDate = near(tppDates, date);
  const t = tDate ? tpp.get(tDate) : null;
  const indep = a["Independent or Other Party"], und = a["Undecided"];
  const row = {
    date,
    published: publishedFor(waveDate),
    dateStart: fieldworkStart(date),
    pollster: "Essential",
    client: "The Guardian",
    sample: null,
    alp: a["Labor"] ?? null,
    lnp: a["TOTAL: Coalition"] ?? null,
    grn: a["Greens"] ?? null,
    onp: a["One Nation"] ?? null,
    ind: indep == null && und == null ? null : (indep ?? 0) + (und ?? 0),
    oth: null,
    tpp_alp: t?.["Labor"] ?? null,
    tpp_lnp: t?.["TOTAL: Coalition"] ?? null,
    ...(releaseFor(waveDate) ? { releaseUrl: releaseFor(waveDate) } : {}),
    assimilated: true,
  };
  const figDup = existing.find((p) => daysApart(p.date, row.date) <= 10 && sameFigures(p, row));
  if (figDup) { skippedFigureDup.push({ csvWave: waveDate, matchesRow: figDup.date }); continue; }
  const at = D.polls.findIndex((p) => p.date > row.date);
  D.polls.splice(at === -1 ? D.polls.length : at, 0, row);
  existing.push(row);
  added.push({ csvWave: waveDate, tppWave: tDate, row });
}

// --- insert pass: leader approval -> "approval" array (nets like curated) ---
const existingAppr = D.approval.filter((r) => r.firm === "Essential");
const addedAppr = [], skippedApprDateDup = [], skippedApprFigureDup = [];
for (const waveDate of [...vi.keys()].sort()) {
  const date = iso(Date.parse(waveDate) - DAY);
  if (date <= horizon) continue;
  const parts = {};
  let ok = true;
  for (const who of ["alb", "opp"]) {
    const wDate = near([...appWaves[who].keys()], waveDate);
    const w = wDate ? appWaves[who].get(wDate) : null;
    const app = w?.["TOTAL: Approve"], dis = w?.["TOTAL: Disapprove"];
    if (app == null || dis == null) { ok = false; break; }
    parts[who] = { app, dis };
  }
  if (!ok) continue; // wave predates the approval series (or partial chart)
  const row = {
    date,
    firm: "Essential",
    alb: parts.alb.app - parts.alb.dis,
    opp: parts.opp.app - parts.opp.dis,
    oppName: OPP_SURNAME,
    han: null,
    detail: { alb: parts.alb, opp: parts.opp },
  };
  if (existingAppr.some((r) => daysApart(r.date, date) <= 2)) { skippedApprDateDup.push(waveDate); continue; }
  const figDup = existingAppr.find((r) => daysApart(r.date, date) <= 10
    && r.alb === row.alb && r.opp === row.opp
    && r.detail?.alb?.app === row.detail.alb.app && r.detail?.alb?.dis === row.detail.alb.dis
    && r.detail?.opp?.app === row.detail.opp.app && r.detail?.opp?.dis === row.detail.opp.dis);
  if (figDup) { skippedApprFigureDup.push({ csvWave: waveDate, matchesRow: figDup.date }); continue; }
  const at = D.approval.findIndex((r) => r.date > row.date);
  D.approval.splice(at === -1 ? D.approval.length : at, 0, row);
  existingAppr.push(row);
  addedAppr.push({ csvWave: waveDate, row });
}

// --- insert pass: national mood -> "direction" array ---
const existingDir = D.direction.filter((r) => r.pollster === "Essential");
const addedDir = [], skippedDirDateDup = [], skippedDirFigureDup = [];
for (const waveDate of [...vi.keys()].sort()) {
  const date = iso(Date.parse(waveDate) - DAY);
  if (date <= horizon) continue;
  const mDate = near([...mood.keys()], waveDate);
  const m = mDate ? mood.get(mDate) : null;
  const right = m?.["Right direction"], wrong = m?.["Wrong track"], unsure = m?.["Unsure"];
  if (right == null || wrong == null || unsure == null) continue;
  const row = { date, dateStart: fieldworkStart(date), pollster: "Essential", right, wrong, unsure };
  if (existingDir.some((r) => daysApart(r.date, date) <= 2)) { skippedDirDateDup.push(waveDate); continue; }
  const figDup = existingDir.find((r) => daysApart(r.date, date) <= 10
    && r.right === row.right && r.wrong === row.wrong && r.unsure === row.unsure);
  if (figDup) { skippedDirFigureDup.push({ csvWave: waveDate, matchesRow: figDup.date }); continue; }
  const at = D.direction.findIndex((r) => r.date > row.date);
  D.direction.splice(at === -1 ? D.direction.length : at, 0, row);
  existingDir.push(row);
  addedDir.push({ csvWave: waveDate, row });
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`VI waves in CSV: ${vi.size} (2PP waves: ${tppDates.length} · approval waves: alb ${appWaves.alb.size} / opp ${appWaves.opp.size} · mood waves: ${mood.size})`);
unknownApproval.forEach((u) => console.log(`WARNING: unmapped approval dataset "${u.dataset}" ("${u.question}") — if it is a new leader series, extend LEADER_APPROVAL in .build/assimilate-essential-vi.mjs`));
console.log(`retro-filled rows: ${retro.length}`);
retro.forEach((x) => console.log(`  ~ ${x.date}: ${x.fixes.join("; ")}`));
console.log(`added rows: ${added.length}`);
added.forEach((x) => console.log(`  + ${x.row.date} (csv ${x.csvWave}): alp ${x.row.alp} lnp ${x.row.lnp} grn ${x.row.grn} onp ${x.row.onp} ind ${x.row.ind} | tpp ${x.row.tpp_alp}/${x.row.tpp_lnp} | rel ${x.row.releaseUrl ?? "–"}`));
addedAppr.forEach((x) => console.log(`  + approval ${x.row.date} (csv ${x.csvWave}): alb ${x.row.alb} (${x.row.detail.alb.app}/${x.row.detail.alb.dis}) · ${x.row.oppName} ${x.row.opp} (${x.row.detail.opp.app}/${x.row.detail.opp.dis})`));
addedDir.forEach((x) => console.log(`  + direction ${x.row.date} (csv ${x.csvWave}): right ${x.row.right} wrong ${x.row.wrong} unsure ${x.row.unsure}`));
skippedFigureDup.forEach((x) => console.log(`  = csv ${x.csvWave} duplicates curated row ${x.matchesRow} (same figures)`));
skippedApprFigureDup.forEach((x) => console.log(`  = csv ${x.csvWave} approval duplicates ${x.matchesRow} (same figures)`));
skippedDirFigureDup.forEach((x) => console.log(`  = csv ${x.csvWave} direction duplicates ${x.matchesRow} (same figures)`));
console.log(`skipped: ${skippedDateDup.length} date-dup, ${skippedFigureDup.length} figure-dup, ${skippedPreHorizon.length} at/before horizon ${horizon}`);
console.log(`skipped approval: ${skippedApprDateDup.length} date-dup, ${skippedApprFigureDup.length} figure-dup · direction: ${skippedDirDateDup.length} date-dup, ${skippedDirFigureDup.length} figure-dup`);

const touched = added.length + retro.length + addedAppr.length + addedDir.length;
if (APPLY && touched) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeFileSync("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
if (APPLY) {
  mkdirSync(".build/essential-src", { recursive: true });
  writeFileSync(".build/essential-src/assimilate-vi-proof.json", JSON.stringify({
    generatedAt: new Date().toISOString(), horizon, retro, added,
    addedAppr, addedDir, skippedDateDup, skippedFigureDup, skippedPreHorizon,
    skippedApprDateDup, skippedApprFigureDup, skippedDirDateDup, skippedDirFigureDup,
  }, null, 2) + "\n");
}
console.log(`ASSIMILATE_STATUS ${JSON.stringify({
  pollster: "Essential", added: added.length, retro: retro.length,
  approval: addedAppr.length, direction: addedDir.length, changed: touched > 0,
})}`);
