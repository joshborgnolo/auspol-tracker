#!/usr/bin/env node
// RedBridge/Accent national-direction reader — banks each statement's printed
// direction breakdowns AND files the headline polls.json direction[] rows,
// moving both off hand-entry. Reads the committed APC-statement caches ONLY
// (.build/redbridge-src/<slug>federal-poll.json + its pdftotext twin .txt) —
// never a live fetch. The tables themselves parse through
// rb-direction-parse.mjs (caption-anchored, never table-numbered), pinned by
// test-redbridge-direction.mjs.
//
// What a run does, per wave cache:
//   * section-less statement (the common case — 7 of the 10 committed
//     waves): nothing, unless polls.json carries a RedBridge/Accent
//     direction[] row ON that wave's fieldwork-end date — then guard: a row
//     date means a section, so the contradiction is a layout change or a
//     mis-dated hand row, never a silent pass.
//   * section-bearing statement: the printed all-voters total must match
//     the polls.json direction[] row's right/wrong/unsure exactly when one
//     is there (a drifted committed row or a re-cut committed cache is a
//     guard, never a rewrite); when no row is there yet, the row is FILED
//     {date, dateStart, pollster, right, wrong, unsure} — direction-row
//     ownership is this extractor's now (gen-data, the Info copy and the
//     validation gates treat its rows exactly like the old hand-entered
//     ones). The wave's breakdown tables file into
//     data/redbridge-direction-groups.json beside it.
//   * the June-2025 direction row (2025-06-30, provenance: the November
//     statement's trend figure, not a table) has no cache and is never
//     touched: a legacy hand row, noted once per run.
//
// Filing contract (same discipline as extract-roymorgan-direction.mjs):
//   * machine-filed store waves re-parse every run and must reproduce the
//     stored entry figure for figure — drift is exit 2, never an overwrite;
//   * the store's own shape is validated at load: a drifted
//     data/redbridge-direction-groups.json guards rather than being
//     silently reset (a torn read would re-file or overwrite the record);
//   * a dim printed only once ("Household income", "Financial stress",
//     "Religion", "Language spoken at home", "Birthplace" — Nov-2025 only)
//     is banked but unsurfaced: gen-data's DIMS list is the display gate.
//     When any unsurfaced dim reaches two committed waves the run notes
//     it (RBDIR_NOTE) — surfacing is a one-line gen-data edit, never an
//     automatic one.
//
// Contract: last stdout line RBDIR_STATUS {json}; exit 0 ok / 1 error /
// 2 guard trip (nothing written). --check computes, never writes.
// Pure text — no macOS dependency, so a CI twin could run it too.
//
// Store shape: data/redbridge-direction-groups.json
//   { _about, waves: { "2026-05-28": {
//       src: { url, tables: "Table 38" | "Tables 47–48" },
//       total: { r, w, u },
//       dims: { vote: { "Labor": {r,w,u}, … }, … } } } }
import fs from "node:fs";
import path from "node:path";
import { writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDirectionTables, DIM_OF_HEADER } from "./rb-direction-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);
const CHECK = process.argv.includes("--check");
export const DIR_POLLSTER = "RedBridge/Accent";

// Dims gen-data surfaces on the direction panel's group select (the
// surfaced-set contract lives in .build/newtracker/gen-data.mjs §5; this
// list is its mirror for the two-wave watch below).
const SURFACED_DIMS = new Set(["vote", "softness", "generation", "gender", "location", "education", "ownership"]);
const WATCH_MIN_WAVES = 2;

const ABOUT = "RedBridge/Accent's national-direction demographic breakdowns, banked by .build/extract-redbridge-direction.mjs from the committed APC-statement texts (.build/redbridge-src/<slug>.txt; the council-accepted methodology PDFs behind the poll rows' methodUrl). The question is Roy Morgan-style all-voters: 'Generally headed in the right direction / wrong direction / not sure' – cells {r,w,u} per printed row. A statement that prints no national-direction section files no wave; machine-filed waves are re-parsed from the cached text every run and must reproduce the stored entry figure for figure (drift is a guard, never a rewrite), and the wave's printed all-voters total must equal the polls.json direction[] row's right/wrong/unsure. The headline direction[] rows themselves are filed by the same extractor from the same tables (hand-entry retired 2026-10-23). gen-data surfaces only the vote/softness/generation/gender/location/education/ownership dims on the direction panel's group select. The June-2025 direction row's provenance is the November statement's trend figure, not a table, so it has no wave here.";

function defaultCtx() {
  return {
    pollsPath: path.join(ROOT, "data", "polls.json"),
    storePath: process.env.RBDIR_STORE || path.join(ROOT, "data", "redbridge-direction-groups.json"),
    srcDir: process.env.RBDIR_SRC || path.join(ROOT, ".build", "redbridge-src"),
    writeFiles: !CHECK,
  };
}

// key-order-insensitive compare (generated files reorder keys) — the recon
// equality check.
const canon = (o) => JSON.stringify(o, (k, v) =>
  (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };
const readText = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };

// The store is this reader's own committed memory (see the header): a shape
// drift means a hand-edit or a torn write — guard, never silently reset.
function storeProblem(store) {
  if (!store || typeof store !== "object" || Array.isArray(store)) return "not an object";
  if (!store.waves || typeof store.waves !== "object" || Array.isArray(store.waves)) return "waves is not an object";
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const share = (v) => typeof v === "number" && v >= 0 && v <= 100;
  const cellOk = (c) => c && share(c.r) && share(c.w) && share(c.u) && Math.abs(c.r + c.w + c.u - 100) <= 1;
  for (const [date, w] of Object.entries(store.waves)) {
    if (!iso.test(date)) return `a wave's date is off (${JSON.stringify(date)})`;
    if (!w || typeof w !== "object") return `wave ${date}: not an object`;
    if (typeof w.src?.url !== "string" || typeof w.src?.tables !== "string") return `wave ${date}: src carries no {url, tables}`;
    if (!cellOk(w.total)) return `wave ${date}: total cell is off`;
    if (!w.dims || typeof w.dims !== "object") return `wave ${date}: no dims object`;
    for (const [dim, rows] of Object.entries(w.dims)) {
      if (!Object.values(DIM_OF_HEADER).includes(dim)) return `wave ${date}: unknown dim "${dim}"`;
      for (const [grp, cell] of Object.entries(rows ?? {}))
        if (!cellOk(cell)) return `wave ${date}: dim ${dim}.${grp} cell is off`;
    }
  }
  return null;
}

const tablesLabel = (ts) => (ts.length === 1 ? `Table ${ts[0]}` : `Tables ${ts.join("–")}`);

// ------------------------------------------------------------------- run
export async function run(overrides = {}) {
  const ctx = { ...defaultCtx(), ...overrides };
  const notes = [], filedRows = [], filedWaves = [];
  if (fs.existsSync(ctx.storePath)) {
    const bad = storeProblem(readJson(ctx.storePath, null));
    if (bad) return { guard: `direction-groups store shape drifted — ${bad}; refusing to read or rewrite it`, notes, exit: 2 };
  }
  const store = readJson(ctx.storePath, { waves: {} });
  store.waves ??= {};
  let changed = false;

  const orig = fs.existsSync(ctx.pollsPath) ? fs.readFileSync(ctx.pollsPath, "utf8") : null;
  if (orig == null) return { guard: `polls.json unreadable at ${ctx.pollsPath}`, notes, exit: 2 };
  const D = JSON.parse(orig);
  const dirRows = (D.direction ?? []).filter((d) => d.pollster === DIR_POLLSTER);
  const rowByDate = new Map(dirRows.map((d) => [d.date, d]));

  const caches = fs.readdirSync(ctx.srcDir)
    .filter((f) => f.endsWith("federal-poll.json"))
    .map((f) => {
      const rec = readJson(path.join(ctx.srcDir, f), null);
      return rec && typeof rec === "object" ? { file: f, rec } : null;
    });
  if (caches.some((c) => c == null)) {
    const f = fs.readdirSync(ctx.srcDir).filter((x) => x.endsWith("federal-poll.json"))[caches.findIndex((c) => c == null)];
    return { guard: `${f}: committed wave record unreadable — the wave set can't be swept`, notes, exit: 2 };
  }
  caches.sort((a, b) => String(a.rec.date ?? "").localeCompare(String(b.rec.date ?? "")));

  for (const { file, rec } of caches) {
    const where = rec.slug ?? file.replace(/\.json$/, "");
    if (typeof rec.date !== "string" || typeof rec.dateStart !== "string")
      return { guard: `${where}: cache record carries no date/dateStart — the wave's direction row can't be placed`, notes, exit: 2 };
    const txt = readText(path.join(ctx.srcDir, file.replace(/\.json$/, ".txt")));
    if (txt == null)
      return { guard: `${where}: the pdftotext twin is missing beside the committed wave record — torn cache checkout`, notes, exit: 2 };
    const p = parseDirectionTables(txt);
    if (p.guard) return { guard: `${where}: ${p.guard}`, notes, exit: 2 };
    const row = rowByDate.get(rec.date);
    if (!p.section) {
      if (row)
        return { guard: `${where}: polls.json carries a direction row on ${rec.date} but the statement prints no direction section — a mis-dated row or a re-cut statement`, notes, exit: 2 };
      continue;
    }
    for (const n of p.notes ?? []) notes.push(`${where}: ${n}`);

    // headline row: reconcile or file
    if (row) {
      if (row.right !== p.total.r || row.wrong !== p.total.w || row.unsure !== p.total.u)
        return { guard: `${where}: statement total ${p.total.r}/${p.total.w}/${p.total.u} ≠ the committed direction row's ${row.right}/${row.wrong}/${row.unsure} on ${rec.date}`, notes, exit: 2 };
    } else {
      if (typeof rec.pdfUrl !== "string" || !rec.pdfUrl)
        return { guard: `${where}: direction section present but the cache record carries no pdfUrl — the row's provenance can't be filed`, notes, exit: 2 };
      D.direction = [...(D.direction ?? []), {
        date: rec.date, dateStart: rec.dateStart, pollster: DIR_POLLSTER,
        right: p.total.r, wrong: p.total.w, unsure: p.total.u,
      }].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      rowByDate.set(rec.date, { right: p.total.r, wrong: p.total.w, unsure: p.total.u });
      changed = true;
      filedRows.push(rec.date);
    }

    // breakdown store: recon or file
    const entry = {
      src: { url: rec.pdfUrl, tables: tablesLabel(p.tables) },
      total: p.total,
      dims: p.dims,
    };
    if (store.waves[rec.date]) {
      if (canon(store.waves[rec.date]) !== canon(entry))
        return { guard: `${where}: recon ${rec.date} — the cached text no longer reads as the recorded store wave`, notes, exit: 2 };
      continue;
    }
    store.waves[rec.date] = entry;
    changed = true;
    filedWaves.push(rec.date);
  }

  // ---- legacy hand rows (no cache covers them) are kept, noted, never edited
  const cacheDates = new Set(caches.map((c) => c.rec.date));
  const legacy = dirRows.filter((d) => !cacheDates.has(d.date)).map((d) => d.date);
  if (legacy.length)
    notes.push(`${legacy.length} direction row(s) predate the cache horizon (${legacy.join(", ")}) — kept as hand-entered`);

  // ---- unsurfaced-dim watch: banked but not displayed, remind at 2+ waves
  const dimCounts = {};
  for (const w of Object.values(store.waves))
    for (const dim of Object.keys(w.dims ?? {}))
      if (!SURFACED_DIMS.has(dim)) dimCounts[dim] = (dimCounts[dim] ?? 0) + 1;
  for (const [dim, n] of Object.entries(dimCounts).sort())
    if (n >= WATCH_MIN_WAVES)
      notes.push(`dim-watch: "${dim}" is now banked on ${n} waves but unsurfaced — surfacing is a one-line gen-data DIMS edit, consciously`);

  // date-ordered keys, so the committed diff is one hunk per new wave
  store.waves = Object.fromEntries(Object.entries(store.waves).sort(([a], [b]) => a.localeCompare(b)));
  // the committed _about still claiming hand-entry is itself a change: the
  // first run after automation lands rewrites the provenance text once
  const aboutMoved = readJson(ctx.storePath, {})._about !== ABOUT;
  store._about = ABOUT;
  const anyChanged = changed || aboutMoved;
  if (anyChanged && ctx.writeFiles) {
    // byte-stable polls.json: hand-entered tpp3 one-liners and the trailing
    // newline survive (extract-redbridge.mjs's own protocol)
    if (filedRows.length) {
      const trailingNl = orig.endsWith("\n") ? "\n" : "";
      const nextPolls = JSON.stringify(D, null, 2)
        .replace(/"tpp3": \{\n\s+"alp": (\d+),\n\s+"lnp": (\d+),\n\s+"onp": (\d+)\n\s+\}/g,
          `"tpp3": { "alp": $1, "lnp": $2, "onp": $3 }`) + trailingNl;
      if (nextPolls === orig)
        return { guard: "the direction rows serialise to the same file they were meant to change — the write folding ate them", notes, exit: 2 };
      writeFileSync(ctx.pollsPath + ".tmp", nextPolls);
      renameSync(ctx.pollsPath + ".tmp", ctx.pollsPath);
    }
    writeFileSync(ctx.storePath + ".tmp", JSON.stringify(store, null, 1) + "\n");
    renameSync(ctx.storePath + ".tmp", ctx.storePath);
  }
  return { changed: anyChanged, filedRows, filedWaves, notes, exit: 0 };
}

// ------------------------------------------------------------------- CLI
if (!LIB_MODE) {
  (async () => {
    const st = await run();
    for (const n of st.notes ?? []) console.log("RBDIR_NOTE " + n);
    if (st.guard) console.error("RBDIR_GUARD " + st.guard);
    const { guard, ...rest } = st;
    if (guard) rest.guard = guard;
    console.log("RBDIR_STATUS " + JSON.stringify({ ...rest, changed: !!rest.changed }));
    process.exit(st.exit ?? (st.guard ? 2 : 0));
  })().catch((e) => {
    console.error("RBDIR_ERROR " + (e?.message || e));
    console.log("RBDIR_STATUS " + JSON.stringify({ changed: false, error: String(e?.message || e) }));
    process.exit(1);
  });
}
