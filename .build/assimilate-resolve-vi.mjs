// Add Resolve Political Monitor voting-intention waves (CSV primary_vote,
// National) to the Resolve rows in data/polls.json, with the vote_firmness
// TOTAL SOFT reading as `soft` when the wave carries one. Runs in the
// wrapper after the CSV changes, so only genuinely new waves are candidates:
//   - a wave becomes a tracker row dated csvDate - 1 day (the convention of
//     the curated Resolve rows: csv 2026-07-12 -> row 2026-07-11);
//   - waves at/before the earliest existing Resolve row are ignored (no
//     backfill of pre-curation history);
//   - a wave is skipped when an existing Resolve row sits within +/-2 days
//     of the computed date, OR when a row within +/-10 days carries
//     identical vote figures (backstop for larger date drift), so re-runs
//     are no-ops and curated rows are never duplicated.
// Row shape matches the curated rows: lnp takes the combined LNP answer,
// falling back to Liberals + Nationals when only the split is published;
// tpp stays null (Resolve publishes no 2PP); the CSV's aggregate
// "Total Others" answer is not a vote share and is ignored. The CSV
// carries no sample/url/fieldwork window, so those keys land null/omitted
// — flagged `assimilated: true`, which both records where the row came
// from and exempts it from the validator's sample-size rule.
// Dry-run by default; --apply writes data/polls.json and a provenance file.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; }
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
const firmness = [...nat("vote_firmness").entries()]
  .flatMap(([date, a]) => a["TOTAL SOFT"] == null ? [] : [{ date, v: a["TOTAL SOFT"] }])
  .sort((a, b) => a.date < b.date ? -1 : 1);

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const daysApart = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const softNear = (dateIso) => firmness.find((f) => f.date === dateIso)
  || firmness.filter((f) => daysApart(f.date, dateIso) <= 2)
    .sort((a, b) => daysApart(a.date, dateIso) - daysApart(b.date, dateIso))[0]
  || null;

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const existing = D.polls.filter((p) => p.pollster === "Resolve");
const horizon = existing.reduce((m, p) => (p.date < m ? p.date : m), "9999");

const close = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.5);
const sameFigures = (p, r) => ["alp", "lnp", "grn", "onp", "ind", "oth"].every((k) => close(p[k], r[k]));

const added = [], skippedDateDup = [], skippedFigureDup = [], skippedPreHorizon = [];
for (const waveDate of [...vi.keys()].sort()) {
  const a = vi.get(waveDate);
  const date = iso(Date.parse(waveDate) - DAY);
  if (date <= horizon) { skippedPreHorizon.push(waveDate); continue; }
  if (existing.some((p) => daysApart(p.date, date) <= 2)) { skippedDateDup.push(waveDate); continue; }
  const lib = a["Liberals"], natl = a["Nationals"];
  const soft = softNear(date);
  const row = {
    date,
    pollster: "Resolve",
    client: "SMH / Age",
    sample: null,
    alp: a["ALP"] ?? null,
    lnp: a["LNP"] ?? (lib == null && natl == null ? null : (lib ?? 0) + (natl ?? 0)),
    grn: a["GRN"] ?? null,
    onp: a["ONP"] ?? null,
    ind: a["IND"] ?? null,
    oth: a["OTH"] ?? null,
    tpp_alp: null,
    tpp_lnp: null,
    ...(soft ? { soft: soft.v } : {}),
    assimilated: true,
  };
  const figDup = existing.find((p) => daysApart(p.date, row.date) <= 10 && sameFigures(p, row));
  if (figDup) { skippedFigureDup.push({ csvWave: waveDate, matchesRow: figDup.date }); continue; }
  const at = D.polls.findIndex((p) => p.date > row.date);
  D.polls.splice(at === -1 ? D.polls.length : at, 0, row);
  existing.push(row);
  added.push({ csvWave: waveDate, softWave: soft ? soft.date : null, row });
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`VI waves in CSV: ${vi.size}`);
console.log(`added rows: ${added.length}`);
added.forEach((x) => console.log(`  + ${x.row.date} (csv ${x.csvWave}): alp ${x.row.alp} lnp ${x.row.lnp} grn ${x.row.grn} onp ${x.row.onp} ind ${x.row.ind} oth ${x.row.oth}${x.row.soft != null ? " soft " + x.row.soft : ""}`));
skippedFigureDup.forEach((x) => console.log(`  = csv ${x.csvWave} duplicates curated row ${x.matchesRow} (same figures)`));
console.log(`skipped: ${skippedDateDup.length} date-dup, ${skippedFigureDup.length} figure-dup, ${skippedPreHorizon.length} at/before horizon ${horizon}`);

if (APPLY && added.length) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeFileSync("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
if (APPLY) {
  mkdirSync(".build/resolve-rpm-src", { recursive: true });
  writeFileSync(".build/resolve-rpm-src/assimilate-vi-proof.json", JSON.stringify({
    generatedAt: new Date().toISOString(), horizon, added, skippedDateDup, skippedFigureDup, skippedPreHorizon,
  }, null, 2) + "\n");
}
console.log(`ASSIMILATE_STATUS ${JSON.stringify({ pollster: "Resolve", added: added.length, changed: added.length > 0 })}`);
