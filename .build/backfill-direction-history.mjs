// Roy Morgan's national-direction (right direction / wrong track) BACK HISTORY.
//
// Morgan's weekly "Government Confidence Rating" waves are tabulated on its
// own site only from January 2012: the live
//   roymorgan.com/morgan-poll/government-confidence-rating  (2012-2025)
// and the Wayback captures of the morganpoll ...-2006-20xx tables all open
// at 2012 whatever their title says. Those tables, plus the individually
// sourced 2006-2011 releases in .build/direction-history-src/waves-2007-2011.json
// (harvested one release at a time, each with its own quote), become
// data/direction-history.json — the wave file gen-data's §5d block turns
// into the single-house monthly series behind the pooled live model.
//
// Live rows (polls.json's direction[] array) always win where a wave is on
// file twice: a table row duplicating a live row is dropped on its fieldwork
// end date, not re-filed. Nothing is interpolated; a wave the sources don't
// print doesn't exist here. Re-run to refresh:
//   node .build/backfill-direction-history.mjs           (uses cached HTML)
//   node .build/backfill-direction-history.mjs --fetch   (re-download the tables)
import fs from "node:fs";
import path from "node:path";
import { secHistoryWaves, redbridgeHistoryWaves } from "./direction-history-aux.mjs";

const SRC = ".build/direction-history-src";
const OUT = "data/direction-history.json";
const FETCH = process.argv.includes("--fetch");
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/* full names OR their abbreviations — the tables write "31/ Aug 1" */
const MONRE = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)";
const monOf = (tok) => MON.findIndex((x) => x.slice(0, 3).toLowerCase() === String(tok).slice(0, 3).toLowerCase());
const TABLES = [
  { id: "live", label: "Roy Morgan Government Confidence Rating table (2012–2025)",
    url: "https://www.roymorgan.com/morgan-poll/government-confidence-rating",
    cache: "gcr-live.html" },
  { id: "wb2020", label: "Roy Morgan Government Confidence Rating table, 2020 Wayback capture",
    url: "https://web.archive.org/web/20200703002629/http://www.roymorgan.com/morganpoll/federal-voting/roy-morgan-government-confidence-rating-2006-2020",
    cache: "gcr-2006-2020.html" },
  { id: "wb2021", label: "Roy Morgan Government Confidence Rating table, 2021 Wayback capture",
    url: "https://web.archive.org/web/20210415012857/http://www.roymorgan.com/morganpoll/federal-voting/roy-morgan-government-confidence-rating-2006-2021",
    cache: "gcr-2006-2021.html" },
  { id: "wb2022", label: "Roy Morgan Government Confidence Rating table, 2022 Wayback capture",
    url: "https://web.archive.org/web/20220123063359/http://www.roymorgan.com/morganpoll/federal-voting/roy-morgan-government-confidence-rating-2006-2022",
    cache: "gcr-2006-2022.html" },
];

/* Tiny HTML entity decode for the handful the tables actually carry. */
const ent = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x"
    ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ({ nbsp: " ", amp: "&", mdash: "—", ndash: "–", ldquo: "“", rdquo: "”",
            lsquo: "‘", rsquo: "’", hellip: "…", lt: "<", gt: ">", quot: '"' })[e.toLowerCase()] ?? m;
});
const clean = (h) => ent(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const tableRows = (html) => {
  const out = [];
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  for (const m of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => clean(c[1]));
    if (cells.length) out.push(cells);
  }
  return out;
};

/* Every date-shaped label in the tables ends on the wave's last interviewing
   day: "January 7/8", "January 14/15 & 21/22", "March 31/April 1",
   "April 23/24, 30 & May 1", "May 5-31", "March 3/4 & 10/11, 2018".
   start/end carry the year's Y/M/D; a December-to-January run rolls the
   year forward just as a March/April one rolls the month. */
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function fieldDates(label0, yearHint) {
  const label = label0.replace(/\s+/g, " ").trim();
  let year = yearHint;
  const explicit = [...label.matchAll(/(?:,|\s)((?:19|20)\d{2})\b/g)].map((m) => +m[1]);
  if (explicit.length) year = explicit[explicit.length - 1];
  const dates = label.replace(/(?:19|20)\d{2}/g, " ");
  let m = null, start = null, end = null, curYear = year;
  const re = new RegExp(`(?:(${MONRE})\\s*)?(\\d{1,2})(?:\\s*[/–-]\\s*(?:(?:${MONRE})\\s*)?(\\d{1,2}))?`, "gi");
  let seenMonth = null;
  for (const t of dates.matchAll(re)) {
    const mon = t[1] ? monOf(t[1]) : null;
    if (mon != null) {
      if (seenMonth != null && mon < seenMonth - 6) curYear++;
      seenMonth = mon; m = mon;
    }
    if (m == null || curYear == null) continue;
    const d1 = +t[2], d2 = t[3] != null ? +t[3] : null;
    if (d1 > 31 || (d2 != null && d2 > 31)) continue;
    if (!start) start = iso(curYear, m, d1);
    end = iso(curYear, m, d2 != null ? d2 : d1);
    if (d2 != null && d2 < d1) {          // "March 31/April 1" month roll
      const dt = new Date(Date.UTC(curYear, m, d1) + 86400000);
      end = dt.toISOString().slice(0, 10);
      m = dt.getUTCMonth(); curYear = dt.getUTCFullYear(); seenMonth = m;
    }
  }
  return { start, end, year: curYear ?? year, month: m };
}

/* A table row is [date cells..., numbers...]. Modes (Face/Phone/Multi) arrive
   as words, shares sometimes carry %, and the old tables print
   right wrong GCR unsure Total where the live one prints right wrong unsure GCR. */
function parseRows(html, url, label) {
  const waves = [];
  let year = null, skipped = 0;
  for (const cells of tableRows(html)) {
    let text = cells.join(" ");
    const yearOnly = text.match(/^(?:Interviewing Dates[^]*?)?\s*((?:19|20)\d{2})\s*$/);
    if (yearOnly) { year = +yearOnly[1]; continue; }
    const hasMonth = MON.some((m) => text.toLowerCase().includes(m.toLowerCase()));
    if (!hasMonth) continue;                     // headings, footnotes, elections
    const di = fieldDates(cells.filter((c) => MON.some((m) => c.toLowerCase().includes(m.toLowerCase()))).join(" ")
      || text.split(/\d+(?:\.\d+)?\s*%/)[0], year);
    if (di.year != null) year = di.year;
    const dateCell = cells.find((c) => MON.some((m) => c.toLowerCase().includes(m.toLowerCase()))) || "";
    const numericCells = cells.slice(cells.indexOf(dateCell) + 1).flatMap((c) =>
      (c.match(/\d+(?:\.\d+)?/g) || []).map(Number)).filter((v) => v <= 200);
    let right = null, wrong = null, unsure = null, gcr = null;
    if (numericCells.length >= 4) {
      const v = numericCells;
      right = v[0]; wrong = v[1];
      if (Math.abs(v[2] - (100 + right - wrong)) <= 0.55) { gcr = v[2]; unsure = v[3]; }
      else if (Math.abs(v[3] - (100 + right - wrong)) <= 0.55) { unsure = v[2]; gcr = v[3]; }
      else { skipped++; continue; }
    } else if (numericCells.length === 3) {
      [right, wrong, unsure] = numericCells;
    } else { skipped++; continue; }
    if (right > 95 || wrong > 95 || (unsure != null && unsure > 70)) { skipped++; continue; }
    if (unsure != null && Math.abs(right + wrong + unsure - 100) > 1.5) { skipped++; continue; }
    if (!di.end) { skipped++; continue; }
    // A lone year's rows can name the election event with figures in the text:
    // they carry no dates, and have already been excluded by !di.end.
    waves.push({ start: di.start, end: di.end, published: null, label: dateCell,
      right, wrong, unsure, gcr, sample: null,
      method: cells.some((c) => /^Face/.test(c)) ? "Face" : cells.some((c) => /^Phone/.test(c)) ? "Phone"
        : cells.some((c) => /^Multi/.test(c)) ? "Multi" : null,
      pollster: "Roy Morgan", url, source: label });
  }
  return { waves, skipped };
}

/* The live file keys a wave to its fieldwork end (a Sunday); the tables
   sometimes print the Monday the release landed instead, and occasionally
   restate the wrong-track share by half a point (Feb 2026's 57 vs the
   release's 56.5) — the live row always wins. A table row is a duplicate
   when its figures match a live row this closely and the dates are within
   four days (adjacent waves are a week apart, so this cannot merge two). */
const liveRows = () => JSON.parse(fs.readFileSync("data/polls.json", "utf8"))
  .direction.filter((d) => d.pollster === "Roy Morgan");
const DAY = 86400000;
const isLiveWave = (rows, w) => w.end && rows.some((r) =>
  Math.abs(Date.parse(w.end) - Date.parse(r.date)) <= 4 * DAY &&
  Math.abs(r.right - w.right) < 0.051 && Math.abs(r.wrong - w.wrong) < 0.551);

async function main() {
  fs.mkdirSync(SRC, { recursive: true });
  const live = liveRows();
  const byKey = new Map(), reports = [];
  for (const t of TABLES) {
    const file = path.join(SRC, t.cache);
    if (FETCH || !fs.existsSync(file)) {
      const res = await fetch(t.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 auspol-tracker-history" } });
      if (!res.ok) { console.log(`HIST_FETCH ${t.id} HTTP ${res.status}`); continue; }
      fs.writeFileSync(file, await res.text());
    }
    const { waves, skipped } = parseRows(fs.readFileSync(file, "utf8"), t.url, t.label);
    let added = 0;
    for (const w of waves) {
      if (isLiveWave(live, w)) continue;         // the live file owns this wave
      const key = `${w.end}|${w.right}|${w.wrong}`;
      if (byKey.has(key)) continue;
      byKey.set(key, w); added++;
    }
    reports.push({ table: t.id, rows: waves.length, added, skipped });
  }
  const oldFile = path.join(SRC, "waves-2007-2011.json");
  let older = [];
  for (const name of [oldFile, path.join(SRC, "waves-supplement.json")]) {
    if (fs.existsSync(name)) older.push(...JSON.parse(fs.readFileSync(name, "utf8")));
  }
  if (older.length) {
    older = older.map((w) => ({ ...w, pollster: "Roy Morgan", source: "Roy Morgan release" }));
    console.log(`HIST_RELEASES ${older.length}`);
  } else console.log("HIST_RELEASES 0 (no separate release files present)");
  let dupes = 0;
  for (const w of older) {
    const key = `${w.end}|${w.right}|${w.wrong}`;
    if (isLiveWave(live, w) || byKey.has(key)) { dupes++; continue; }
    if (unsureBad(w)) { console.log(`HIST_BAD ${w.end} ${w.right}/${w.wrong}/${w.unsure}`); continue; }
    byKey.set(key, w);
  }
  const liveDirection = JSON.parse(fs.readFileSync("data/polls.json", "utf8")).direction;
  const additional = [
    ...secHistoryWaves(".build/secnewgate-src"),
    ...redbridgeHistoryWaves(SRC),
  ];
  for (const w of additional) {
    if (unsureBad(w)) throw new Error(`${w.pollster} ${w.month}: bad printed triple`);
    const liveSameMonth = liveDirection.filter((d) => d.pollster === w.pollster && d.date.startsWith(w.month));
    if (liveSameMonth.some((d) => d.right === w.right && d.wrong === w.wrong)) continue;
    if (liveSameMonth.length) throw new Error(`${w.pollster} ${w.month}: historical reprint disagrees with the dated row`);
    byKey.set(`${w.pollster}|${w.month}|${w.right}|${w.wrong}`, w);
  }
  const monthOfWave = (w) => String(w.month || w.end || w.published);
  const wavesOut = [...byKey.values()].sort((a, b) => monthOfWave(a).localeCompare(monthOfWave(b)));
  if (!wavesOut.length) throw new Error("no waves parsed — refusing to write an empty history");
  const json = {
    $comment: "Roy Morgan waves carry fieldwork dates where published; house-reprinted series carry an exact month only. " +
      "Roy Morgan tables tabulate January 2012 onward; earlier rows are individually sourced releases; " +
      "SEC Newgate's reprinted chart is read by series colour, and RedBridge's image table is reconciled across two reports. " +
      "No interpolation or invented fieldwork days. Live rows (polls.json direction[]) take precedence. " +
      "Rebuilt by .build/backfill-direction-history.mjs.",
    generated: new Date().toISOString().slice(0, 10),
    sources: [...TABLES.map((t) => ({ label: t.label, url: t.url })),
      ...additional.map((w) => ({ label: w.source, url: w.url }))],
    waves: wavesOut,
  };
  fs.writeFileSync(OUT, JSON.stringify(json, null, 1) + "\n");
  const years = {};
  for (const w of wavesOut) { const y = monthOfWave(w).slice(0, 4); years[y] = (years[y] || 0) + 1; }
  console.log("HIST_TABLES " + JSON.stringify(reports));
  console.log("HIST_DUPES_DROPPED " + dupes);
  console.log("HIST_OTHER_HOUSES " + JSON.stringify(Object.fromEntries(["SEC Newgate", "RedBridge/Accent"].map((h) => [h, additional.filter((w) => w.pollster === h).length]))));
  console.log("HIST_YEARS " + JSON.stringify(years));
  console.log(`HIST_STATUS wrote ${OUT}: ${wavesOut.length} waves, ${monthOfWave(wavesOut[0])} → ${monthOfWave(wavesOut.at(-1))}`);
}
const unsureBad = (w) => !(w.right >= 0 && w.wrong >= 0) ||
  (w.unsure != null && Math.abs(w.right + w.wrong + w.unsure - 100) > 1.5);

// importable in tests without re-running the harvest
export { fieldDates, parseRows };
if (process.argv[1] && process.argv[1].endsWith("backfill-direction-history.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
