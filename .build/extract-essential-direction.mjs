// Essential's NATIONAL-MOOD BREAKDOWNS, read out of the committed CSV mirror
// (data/essential-report.csv) into data/essential-direction-groups.json, the
// store gen-data feeds the direction panel's group select with. Essential
// prints the mood question's "National mood (<group> Trend)" Flourish visuals
// - Male, Female, 18-34, 35-54, 55+ - one Right direction / Wrong track /
// Unsure cell per wave.
//
// WAVE CLUSTERING: a wave's six charts need not refresh on the one day. In
// April and May 2026 the cells of one wave landed up to three days apart
// (Female printed 2026-04-26, 18-34 the 28th, the rest the 29th), so the
// wave is whatever the six visuals printed within a WAVE_GAP-day span of
// each other; a cluster must carry exactly one cell per visual (one TOTAL,
// one per band) with all three answers, and the TOTAL's date anchors the
// wave. A cluster that breaks any of that is a GUARD - never a repair, never
// a silently shortened band.
//
// Filing rules (the "a dropped cell is a GUARD" discipline):
//   - every filed cell's Right+Wrong+Unsure prints within SUM_TOL of 100
//     (observed 99-101 on the committed rows);
//   - where polls.json carries the wave's Essential direction row, the TOTAL
//     cell reconciles with its printed right/wrong (halve-point rounding on
//     the older rows' halves) - the row dates by csvDate - 1 in the curated
//     era but deviates by an extra day on some waves (plus the CSV-dated
//     pre-assimilator archive), so the lookup sweeps ROW_SWEEP days either
//     way and banks the RESOLVED row date as the wave's `dirRow`, which is
//     the exact key gen-data tips the group's dots with.
//
// Dates: the store is keyed by the TRACKER date (TOTAL's csvDate - 1 day),
// the same convention assimilate-essential-vi.mjs files the wave's rows
// under. The wave's TOTAL csv date rides alongside as provenance.
//
// Re-runs are byte-stable: identical CSV => identical store bytes, and a run
// that changes nothing writes nothing (the wrapper's no-op hygiene). Dry-run
// by default; --apply writes the store. Exit 0 clean, 1 = unexpected error,
// 2 = a guard trip. Last line: ESS_DIR_STATUS {json}.
import { existsSync, readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const DAY = 86400000;
// env overrides exist for tests (test-essential-direction.mjs sandboxes all
// three paths); production callers never set them
const CSV = process.env.ESS_DIR_CSV || "data/essential-report.csv";
const POLLS = process.env.ESS_DIR_POLLS || "data/polls.json";
const OUT = process.env.ESS_DIR_OUT || "data/essential-direction-groups.json";
const SUM_TOL = 2;   // a printed r/w/u cell may round to 100±2 on Essential's integer print
const WAVE_GAP = 7;  // mood cells further apart than this are different waves
const ROW_SWEEP = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]; // a wave's curated
// direction row usually sits at csv -1 (the recent era) or on the csv date
// itself (the pre-assimilator archive), but curation has moved one as far as
// csv -5 (csv 2026-01-28 filed at 2026-01-23); waves land >=13 days apart,
// so the nearest row inside the sweep is unambiguous
const BANDS = [ // [CSV visual label, store/display key]
  ["Male", "Men"],
  ["Female", "Women"],
  ["18-34", "18–34"], // the CSV's hyphen, the site's en dash
  ["35-54", "35–54"],
  ["55+", "55+"],
];
const ANSWERCOL = { r: "Right direction", w: "Wrong track", u: "Unsure" };

// full CSV parser (question text can contain commas) - assimilate-essential-vi's
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
const dateShift = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

const main = () => {
  const csv = parseCsv(readFileSync(CSV, "utf8").trim());
  const [header, ...lines] = csv;
  const col = Object.fromEntries(header.map((h, i) => [h, i]));

  // mood cells: csvDate -> visual -> answer -> share (TOTAL under its own key)
  const byDate = new Map();
  const csvKeyOf = { Male: "Men", Female: "Women", "18-34": "18–34", "35-54": "35–54", "55+": "55+" };
  for (const l of lines) {
    if (l[col.dataset] !== "national_mood") continue;
    const vis = l[col.visual] === "Trend" ? "total" : csvKeyOf[l[col.visual]];
    if (!vis) continue; // legacy pre-2024 cross-tab visuals: ignored by design
    if (!byDate.has(l[col.date])) byDate.set(l[col.date], {});
    (byDate.get(l[col.date])[vis] ??= {})[l[col.answer]] = l[col.value_pct] === "" ? null : Number(l[col.value_pct]);
  }

  // cluster the dated cells into waves
  const dates = [...byDate.keys()].sort();
  const clusters = [];
  for (const d of dates) {
    const lastDate = clusters.length ? clusters[clusters.length - 1].dates[clusters[clusters.length - 1].dates.length - 1] : null;
    if (lastDate && Date.parse(d) - Date.parse(lastDate) <= WAVE_GAP * DAY) clusters[clusters.length - 1].dates.push(d);
    else clusters.push({ dates: [d] });
  }

  const guards = [];
  const visuals = ["total", ...BANDS.map(([, k]) => k)];
  const waves = {};
  for (const cl of clusters) {
    const cells = {}; // visual -> cell
    for (const v of visuals) {
      const hits = cl.dates.filter((d) => byDate.get(d)[v]);
      if (hits.length !== 1) {
        guards.push(`${v} on ${cl.dates.join(",")}: ${hits.length ? "printed twice inside one wave" : "band missing a wave the TOTAL window spans"}`);
        continue;
      }
      const cell = byDate.get(hits[0])[v];
      for (const a of Object.values(ANSWERCOL)) {
        if (typeof cell[a] !== "number") guards.push(`${v} ${hits[0]}: ${a} unprinted`);
      }
      const sum = ["Right direction", "Wrong track", "Unsure"].reduce((s, a) => s + (cell[a] || 0), 0);
      if (typeof cell[ANSWERCOL.r] === "number" && typeof cell[ANSWERCOL.w] === "number"
        && typeof cell[ANSWERCOL.u] === "number" && Math.abs(sum - 100) > SUM_TOL) {
        guards.push(`${v} ${hits[0]}: printed cell sums to ${sum}`);
      }
      cells[v] = { r: cell[ANSWERCOL.r], w: cell[ANSWERCOL.w], u: cell[ANSWERCOL.u] };
      cells[v].date = hits[0];
    }
    if (guards.length) continue; // a broken wave files nothing
    const csvAnchor = cells.total.date;
    const key = dateShift(csvAnchor, -1);
    if (waves[key]) guards.push(`${key}: two waves would file on the one tracker date`);
    waves[key] = { csv: csvAnchor, ...Object.fromEntries(BANDS.map(([, k]) => [k, { r: cells[k].r, w: cells[k].w, u: cells[k].u }])), total: { r: cells.total.r, w: cells.total.w, u: cells.total.u } };
  }

  // reconcile the TOTAL cells against polls.json's Essential direction rows,
  // sweeping the curated dating window; the resolved row date is the key the
  // dot tips join on
  const polls = JSON.parse(readFileSync(POLLS, "utf8"));
  const dirRows = new Map((polls.direction || [])
    .filter((d) => d.pollster === "Essential").map((d) => [d.date, d]));
  let reconciled = 0;
  for (const [key, w] of Object.entries(waves)) {
    if (guards.length) break;
    let row = null;
    for (const d of ROW_SWEEP) {
      if (dirRows.has(dateShift(key, d))) { row = dirRows.get(dateShift(key, d)); w.dirRow = dateShift(key, d); break; }
    }
    if (!row) continue; // pre-archive waves ride unreconciled by design
    reconciled++;
    if (Math.abs(w.total.r - row.right) > 0.51 || Math.abs(w.total.w - row.wrong) > 0.51) {
      guards.push(`${key}: TOTAL ${w.total.r}/${w.total.w} vs polls.json ${row.right}/${row.wrong} (${w.dirRow})`);
    }
  }

  const store = {
    _about: "Essential's national-mood breakdowns, banked from the committed data/essential-report.csv mirror its extractor keeps: one right/wrong/unsure cell per band (Men, Women, 18–34, 35–54, 55+) plus the wave's TOTAL cell. A wave clusters the six mood visuals' prints within a week of each other - against publish-day scatter across the charts; the TOTAL's date anchors it. Keyed by tracker date (TOTAL csvDate - 1 day); dirRow is the wave's polls.json direction row date where one exists, the key the panel's dot tips join on. Written by .build/extract-essential-direction.mjs - never hand-edit; a guard trip refuses the whole run rather than file a partial wave.",
    waves,
  };
  const text = JSON.stringify(store, null, 1) + "\n";
  const changed = !existsSync(OUT) || readFileSync(OUT, "utf8") !== text;

  if (guards.length) {
    for (const g of guards.slice(0, 10)) console.log("ESS_DIR_GUARD " + g);
    console.log(`ESS_DIR_STATUS ${JSON.stringify({ waves: clusters.length, reconciled, changed: false, guards: guards.length })}`);
    process.exit(2);
  }
  if (APPLY && changed) {
    writeAtomic(OUT, text);
    console.log(`updated ${OUT} (${clusters.length} waves${reconciled ? `, ${reconciled} reconciled against polls.json` : ""})`);
  }
  console.log(`ESS_DIR_STATUS ${JSON.stringify({ waves: clusters.length, reconciled, changed, guards: 0 })}`);
};

main();
