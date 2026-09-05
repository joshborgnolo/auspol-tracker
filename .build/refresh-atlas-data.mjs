#!/usr/bin/env node
/* refresh-atlas-data.mjs — convert the Electoral Atlas source CSVs into the
   single JS payload the /atlas/ page embeds.

   Inputs (source of truth, kept verbatim in atlas/data/):
     atlas/data/all_elections_2PP_by_division.csv
     atlas/data/all_elections_2PP_by_state.csv
     atlas/data/nonclassic_2CP_divisions.csv

   Output:
     atlas/atlas-data.js   (defines window.ATLAS_DATA)

   Responsibilities:
   - parse the three CSVs (no deps — they're simple, comma-only, no quoting)
   - "stitch" renamed divisions: AEC data starts a renamed division's series
     under the new name ("Clark (fmr Denison)") with no row under the old
     name, so the renderer just keys on the new name — but we normalise the
     display name and expose both the plain and "(fmr …)" forms.
   - hand the renderer a per-division series ordered by year, each row:
       { y, party, co, al, sw, nc? }
     where nc (non-classic) is the 2CP overlay row when one exists for that
     division+year: { mine, major, minePct, majorPct, margin, swing, winner }
   - expose the party colour palette keyed on the minor/major party LABELS
     (Coalition, Labor, Independent, Greens, National, Liberal, Katter's
     Australian, Palmer United, Pauline Hanson's One Nation, Centre Alliance).

   Run: node .build/refresh-atlas-data.mjs   (from repo root)
*/
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA = path.join(ROOT, "atlas", "data");
const OUT = path.join(ROOT, "atlas", "atlas-data.js");

/* ---- palette ----------------------------------------------------------
   Chosen to sit on the site's oklch editorial palette (same hue families the
   trend charts use: ALP warm red, Coalition steel blue, Greens green, others
   earth/ochre/neutral). Kept as a single map so the legend, the chart lines,
   and the seat-list "Holder" chip all read from one source. */
const PARTY_COLORS = {
  "Labor":                              "#c0392b",
  "Coalition":                          "#2f5d8a",
  "Greens":                             "#2e7d4f",
  "Independent":                        "#7a6a55",
  "National":                           "#5a7040",
  "Liberal":                            "#27547c",
  "Katter's Australian":                "#a0503c",
  "Palmer United":                      "#c08a00",
  "Pauline Hanson's One Nation":        "#b4503f",
  "Centre Alliance (fmr Nick Xenophon Team)": "#b0722a",
};
const FALLBACK_COLOR = "#4c4c4c";

/* ---- tiny CSV parser (no quotes/commas inside fields in these files) ---- */
function parseCsv(file) {
  const rows = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const head = rows.shift().split(",");
  return rows.map((line) => {
    const cells = line.split(",");
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i]));
    return o;
  });
}
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ---- division display-name stitching ----------------------------------
   "Clark (fmr Denison)" → { id: "clark-fmr-denison", short "Clark", former "Denison" }.
   The AEC only stores the NEW name, so history is already continuous under
   one key — we just split the display forms out for the UI. */
function nameInfo(raw) {
  const m = raw.match(/^(.*?)\s*\(fmr\s+(.+?)\)\s*$/i);
  if (m) return { short: m[1].trim(), former: m[2].trim() };
  return { short: raw.trim(), former: null };
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ---- divisions --------------------------------------------------------- */
const divRows = parseCsv(path.join(DATA, "all_elections_2PP_by_division.csv"));
const ncRows = parseCsv(path.join(DATA, "nonclassic_2CP_divisions.csv"));

/* STITCHING: the AEC names the SAME seat in two shapes across the window —
   the full lineage label "Fenner (fmr Fraser)" in early years, then the bare
   new name "Fenner" after the rename "beds in". Normalising both to the SHORT
   name stitches the lineage into one continuous series. For non-classic rows
   we do the same, so a seat's 2CP elections land on the same key as its 2PP
   series regardless of which shape that year's file used. */
const rowKey = (raw) => `${slug(nameInfo(raw).short)}`;
const ncKey = (raw, y) => `${rowKey(raw)}|${y}`;

/* non-classic lookup: shortName|year → 2CP overlay row */
const ncByKey = new Map();
for (const r of ncRows) {
  const key = ncKey(r.Division, r.Year);
  ncByKey.set(key, {
    mine: r.Minor_2CP_party,
    major: r.Major_2CP_party,
    minePct: num(r.Minor_2CP_percent),
    majorPct: num(r.Major_2CP_percent),
    margin: num(r.Margin),
    swing: num(r.New_swing),
    winner: r.Party,
  });
}

const divisions = new Map(); // id → { id, name, short, former, state, series[] }
for (const r of divRows) {
  const { short, former } = nameInfo(r.Division);
  const id = slug(short);
  if (!divisions.has(id)) {
    divisions.set(id, { id, name: short, short, former, state: r.State, series: [] });
  }
  const d = divisions.get(id);
  if (former && !d.former) d.former = former;
  const y = num(r.Year);
  /* guard against the same year arriving under both name shapes */
  if (d.series.some((s) => s.y === y)) continue;
  const nc = ncByKey.get(`${id}|${y}`) || null;
  d.series.push({
    y,
    party: r.Party,
    co: num(r.Coalition_2PP_percent),
    al: num(r.Labor_2PP_percent),
    sw: num(r.New_swing),
    ...(nc ? { nc } : {}),
  });
}
for (const d of divisions.values()) {
  d.series.sort((a, b) => a.y - b.y);
}

/* ---- states ------------------------------------------------------------ */
const stateRows = parseCsv(path.join(DATA, "all_elections_2PP_by_state.csv"));
const states = new Map();
for (const r of stateRows) {
  const id = slug(r.State);
  if (!states.has(id)) states.set(id, { id, state: r.State, series: [] });
  states.get(id).series.push({
    y: num(r.Year),
    co: num(r.Coalition_2PP_percent),
    al: num(r.Labor_2PP_percent),
    sw: num(r.New_swing),
  });
}
for (const s of states.values()) s.series.sort((a, b) => a.y - b.y);

/* ---- emit -------------------------------------------------------------- */
const payload = {
  partyColors: PARTY_COLORS,
  fallbackColor: FALLBACK_COLOR,
  divisions: [...divisions.values()],
  states: [...states.values()],
};

const banner = `/* atlas-data.js — GENERATED by .build/refresh-atlas-data.mjs. Do not hand-edit. */\n`;
const js = banner + "window.ATLAS_DATA = " + JSON.stringify(payload, null, 1) + ";\n";
fs.writeFileSync(OUT, js);
console.log(`built ${path.relative(ROOT, OUT)} · ${divisions.size} divisions, ${states.size} states, ${ncRows.length} non-classic rows, ${(js.length / 1024).toFixed(0)} KB`);
