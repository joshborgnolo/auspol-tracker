// Add Essential's voting-intention waves (CSV primary "Primary Vote+" and
// 2pp "2PP+") to the Essential rows in data/polls.json. Runs in the wrapper
// after the CSV changes, so only genuinely new waves are candidates:
//   - a wave becomes a tracker row dated csvDate - 1 day: the CSV dates the
//     wave by publication day, curated rows by fieldwork end (a 1-5 day
//     gap in recent waves; -1 is the dominant recent offset);
//   - waves at/before the earliest existing Essential row are ignored (no
//     backfill of pre-curation history);
//   - a wave is skipped when an existing Essential row sits within +/-2
//     days of the computed date, OR when a row within +/-10 days carries
//     identical figures (the publication->fieldwork gap can exceed the
//     date tolerance — csv 2026-01-28 is the row curated at 2026-01-23 —
//     while two real distinct waves rarely share all seven figures).
//     Together those rules mean re-runs are no-ops and curated rows are
//     never duplicated.
// Row shape matches the curated rows: ind = Independent + Undecided (the
// combined figure carried by all curated waves except 2026-07-27, whose
// sumNote documents its undecided-exclusive deviation), oth null, tpp as
// published undecided-inclusive (pollsterRules.Essential.tppIncludesUndecided
// reads the shortfall as undecided-after-preferences). The CSV carries no
// sample/url/fieldwork window, so those keys land null/omitted; the wave's
// own release page is resolved from .build/essential-src/report-index.json
// (written by the extractor) and lands in releaseUrl — the WP record date
// can lag the wave date by a day (UTC post timestamps vs Sydney wave
// labels), so the lookup allows +/-1 day. The row is flagged
// `assimilated: true`, which both records where it came from and exempts it
// from the validator's sample-size rule.
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
  question: l[col.question],
  visual: l[col.visual],
  answer: l[col.answer],
  date: l[col.date],
  value: l[col.value_pct] === "" ? null : Number(l[col.value_pct]),
}));

const wavesFor = (dataset, question) => {
  const byDate = new Map();
  for (const r of rows) {
    if (r.dataset !== dataset || r.question !== question || r.visual !== "Overall") continue;
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.answer] = r.value;
  }
  return byDate;
};

const vi = wavesFor("primary", "Primary Vote+");
const tpp = wavesFor("2pp", "2PP+");
const tppDates = [...tpp.keys()].sort();

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

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`VI waves in CSV: ${vi.size} (2PP waves: ${tppDates.length})`);
console.log(`added rows: ${added.length}`);
added.forEach((x) => console.log(`  + ${x.row.date} (csv ${x.csvWave}): alp ${x.row.alp} lnp ${x.row.lnp} grn ${x.row.grn} onp ${x.row.onp} ind ${x.row.ind} | tpp ${x.row.tpp_alp}/${x.row.tpp_lnp} | rel ${x.row.releaseUrl ?? "–"}`));
skippedFigureDup.forEach((x) => console.log(`  = csv ${x.csvWave} duplicates curated row ${x.matchesRow} (same figures)`));
console.log(`skipped: ${skippedDateDup.length} date-dup, ${skippedFigureDup.length} figure-dup, ${skippedPreHorizon.length} at/before horizon ${horizon}`);

if (APPLY && added.length) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeFileSync("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
if (APPLY) {
  mkdirSync(".build/essential-src", { recursive: true });
  writeFileSync(".build/essential-src/assimilate-vi-proof.json", JSON.stringify({
    generatedAt: new Date().toISOString(), horizon, added, skippedDateDup, skippedFigureDup, skippedPreHorizon,
  }, null, 2) + "\n");
}
console.log(`ASSIMILATE_STATUS ${JSON.stringify({ pollster: "Essential", added: added.length, changed: added.length > 0 })}`);
