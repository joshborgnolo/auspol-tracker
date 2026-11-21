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
const MONRE = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const MON_ANY = new RegExp(`\\b(?:${MONRE})\\b`, "i");
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
  { id: "rm2007", release: true, startYear: 2007, label: "Roy Morgan Finding 4259, 2007 release trend table",
    url: "https://web.archive.org/web/20080102151457id_/http://www.roymorgan.com:80/news/polls/2007/4259/index.cfm?printversion=yes", cache: "gcr-release-4259.html" },
  { id: "rm2008", release: true, startYear: 2007, label: "Roy Morgan Finding 4343, 2008 release trend table",
    url: "https://web.archive.org/web/20081226214036id_/http://www.roymorgan.com:80/news/polls/2008/4343/index.cfm?printversion=yes", cache: "gcr-release-4343.html" },
  { id: "rm2009", release: true, startYear: 2009, label: "Roy Morgan Finding 4452, 2009 release trend table",
    url: "https://web.archive.org/web/20100117203521id_/http://www.roymorgan.com:80/news/polls/2009/4452/index.cfm?printversion=yes", cache: "gcr-release-4452.html" },
  { id: "rm2010-h1", release: true, startYear: 2009, label: "Roy Morgan Finding 4519, January–June 2010 release trend table",
    url: "https://web.archive.org/web/20100704024251id_/http://www.roymorgan.com:80/news/polls/2010/4519/index.cfm?printversion=yes", cache: "gcr-release-4519.html" },
  { id: "rm2010-h2", release: true, startYear: 2010, label: "Roy Morgan Finding 4619, June–December 2010 release trend table",
    url: "https://web.archive.org/web/20110306051133id_/http://www.roymorgan.com/news/polls/2010/4619/index.cfm?printversion=yes", cache: "gcr-release-4619.html" },
  { id: "rm2011", release: true, startYear: 2011, label: "Roy Morgan Finding 4729, 2011 release trend table",
    url: "https://web.archive.org/web/20120324162518id_/http://www.roymorgan.com/news/polls/2011/4729/index.cfm?printversion=yes", cache: "gcr-release-4729.html" },
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
  const re = new RegExp(`(?:(${MONRE})\\s*)?(\\d{1,2})(?:\\s*[/–-]\\s*(?:(${MONRE})\\s*)?(\\d{1,2}))?`, "gi");
  let seenMonth = null;
  for (const t of dates.matchAll(re)) {
    const mon = t[1] ? monOf(t[1]) : null;
    if (mon != null) {
      if (seenMonth != null && mon < seenMonth - 6) curYear++;
      seenMonth = mon; m = mon;
    }
    if (m == null || curYear == null) continue;
    const d1 = +t[2], d2 = t[4] != null ? +t[4] : null;
    if (d1 > 31 || (d2 != null && d2 > 31)) continue;
    if (!start) start = iso(curYear, m, d1);
    if (t[3]) {
      const nextMonth = monOf(t[3]);
      if (nextMonth < m - 6) curYear++;
      m = nextMonth;
    } else if (d2 != null && d2 < d1) {
      const dt = new Date(Date.UTC(curYear, m + 1, d2));
      m = dt.getUTCMonth(); curYear = dt.getUTCFullYear();
    }
    end = iso(curYear, m, d2 != null ? d2 : d1);
    seenMonth = m;
  }
  return { start, end, year: curYear ?? year, month: m };
}

/* A table row is [date cells..., numbers...]. Modes (Face/Phone/Multi) arrive
   as words, shares sometimes carry %, and the old tables print
   right wrong GCR unsure Total where the live one prints right wrong unsure GCR. */
function parseRows(html, url, label, startYear = null) {
  const waves = [];
  let year = startYear, skipped = 0;
  for (const cells of tableRows(html)) {
    let text = cells.join(" ");
    const yearOnly = text.match(/^(?:Interviewing Dates[^]*?)?\s*((?:19|20)\d{2})\s*$/);
    if (yearOnly) { year = +yearOnly[1]; continue; }
    if (!MON_ANY.test(text)) continue;            // headings, footnotes, elections
    const di = fieldDates(cells.filter((c) => MON_ANY.test(c)).join(" ")
      || text.split(/\d+(?:\.\d+)?\s*%/)[0], year);
    if (di.year != null) year = di.year;
    const dateCell = cells.find((c) => MON_ANY.test(c)) || "";
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

/* The 2007–11 release tables are transposed: interviewing dates are column
   heads and right/wrong/GCR/can't-say are rows beneath them. */
function parseReleaseRows(html, url, label, startYear) {
  const waves = [];
  let year = startYear, previousMonth = null, skipped = 0;
  const number = (s) => {
    const m = String(s ?? "").trim().match(/^-?\d+(?:\.\d+)?$/);
    return m ? +m[0] : null;
  };
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  for (const table of body.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    if (!/Right direction/i.test(table[0]) || !/Wrong direction/i.test(table[0])) continue;
    const rows = tableRows(table[0]).map((r) => r.filter((c) => c !== ""));
    const dateRow = rows.findIndex((r) => r.some((c) => MON_ANY.test(c)));
    if (dateRow < 0) continue;
    const dates = rows[dateRow], methods = rows[dateRow + 1];
    const rightRow = rows.find((r) => /^Right direction$/i.test(r[0]));
    const wrongRow = rows.find((r) => /^Wrong direction$/i.test(r[0]));
    const unsureRow = rows.find((r) => /^Can.?t say$/i.test(r[0]));
    const gcrRow = rows.find((r) => /^Roy Morgan GCR/.test(r[0]));
    if (!rightRow || !wrongRow) continue;
    for (let i = 0; i < dates.length; i++) {
      const rawDate = dates[i], firstMonthToken = rawDate.match(MON_ANY)?.[0];
      if (firstMonthToken && previousMonth != null && monOf(firstMonthToken) < previousMonth - 6) year++;
      const di = fieldDates(rawDate, year), right = number(rightRow[i + 1]);
      const wrong = number(wrongRow[i + 1]), unsure = number(unsureRow?.[i + 1]);
      let gcr = number(gcrRow?.[i + 1]) ?? (100 + right - wrong);
      const gcrMisprint = /Finding 4343/.test(label) && rawDate === "May 17/18" &&
        gcr === 130 && right === 56 && wrong === 25 && unsure === 18;
      const gcrPrinted = gcrMisprint ? gcr : null;
      if (gcrMisprint) gcr = null;  // this cell alone says 130, against 56 − 25 ⇒ 131
      if (!di.end || right == null || wrong == null || right > 95 || wrong > 95 ||
        unsure == null || Math.abs(right + wrong + unsure - 100) > 1.5 ||
        (gcr != null && Math.abs(gcr - (100 + right - wrong)) > 0.55)) { skipped++; continue; }
      year = di.year;
      previousMonth = di.month;
      const printedMethod = /^(?:Face|Phone|Multi)$/i.test(methods?.[i] || "") ? methods[i] : null;
      waves.push({ start: di.start, end: di.end, published: null, label: rawDate.replace(/\s*\^\s*$/, ""),
        right, wrong, unsure, gcr, ...(gcrPrinted != null ? { gcrPrinted } : {}), sample: null,
        method: printedMethod || (/\^/.test(rawDate) ? "Phone" : "Face"),
        pollster: "Roy Morgan", url, source: label });
    }
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
  const byKey = new Map(), reports = [], recovered = [];
  for (const t of TABLES) {
    const file = path.join(SRC, t.cache);
    if (FETCH || !fs.existsSync(file)) {
      const res = await fetch(t.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 auspol-tracker-history" } });
      if (!res.ok) { console.log(`HIST_FETCH ${t.id} HTTP ${res.status}`); continue; }
      fs.writeFileSync(file, await res.text());
    }
    const html = fs.readFileSync(file, "utf8");
    const { waves, skipped } = t.release
      ? parseReleaseRows(html, t.url, t.label, t.startYear)
      : parseRows(html, t.url, t.label);
    if (t.release) {
      recovered.push(...waves);
      const samples = [...new Set([...clean(fs.readFileSync(file, "utf8"))
        .matchAll(/cross-section of ([\d,]+)|cross-section of Australians aged \d+\+ including ([\d,]+) electors/g)]
        .map((m) => +(m[1] || m[2]).replaceAll(",", "")))];
      if (samples.length === 1 && waves.at(-1)) waves.at(-1).sample = samples[0];
    }
    let added = 0;
    for (const w of waves) {
      if (isLiveWave(live, w)) continue;         // the live file owns this wave
      const key = `${w.end}|${w.right}|${w.wrong}`;
      if (byKey.has(key)) continue;
      byKey.set(key, w); added++;
    }
    reports.push({ table: t.id, rows: waves.length, added, skipped,
      ...(t.release ? { latestSample: waves.at(-1)?.sample, latestDate: waves.at(-1)?.end } : {}) });
  }
  const recoveredKeys = new Set(recovered.map((w) => `${w.end}|${w.method}`));
  const oldFile = path.join(SRC, "waves-2007-2011.json");
  let older = [];
  for (const name of [oldFile, path.join(SRC, "waves-supplement.json")]) {
    if (fs.existsSync(name)) older.push(...JSON.parse(fs.readFileSync(name, "utf8")));
  }
  if (older.length) {
    older = older.map((w) => ({ ...w, pollster: "Roy Morgan", source: "Roy Morgan release" }));
    console.log(`HIST_RELEASES ${older.length}`);
  } else console.log("HIST_RELEASES 0 (no separate release files present)");
  let dupes = 0, superseded = 0;
  for (const w of older) {
    if (recoveredKeys.has(`${w.end}|${w.method}`)) { superseded++; continue; }
    const key = `${w.end}|${w.right}|${w.wrong}`;
    if (isLiveWave(live, w) || byKey.has(key)) { dupes++; continue; }
    if (unsureBad(w)) { console.log(`HIST_BAD ${w.end} ${w.right}/${w.wrong}/${w.unsure}`); continue; }
    byKey.set(key, w);
  }
  console.log(`HIST_OLDER_SUPERSEDED ${superseded} (primary release tables win same-date/method conflicts)`);
  const liveDirection = JSON.parse(fs.readFileSync("data/polls.json", "utf8")).direction;
  const mckinnonFile = path.join(SRC, "mckinnon-direction.json");
  const mckinnon = fs.existsSync(mckinnonFile)
    ? JSON.parse(fs.readFileSync(mckinnonFile, "utf8")).waves
      .map((w) => ({ ...w, pollster: "McKinnon", source: "McKinnon Index, How satisfied are you with the way Australia is heading?" }))
    : [];
  const otherFile = path.join(SRC, "other-houses-direction.json");
  const other = fs.existsSync(otherFile) ? JSON.parse(fs.readFileSync(otherFile, "utf8")) : { waves: [], secNewgateSamples: [] };
  const secRows = secHistoryWaves(".build/secnewgate-src");
  if (other.secNewgateSamples.length !== secRows.length) throw new Error("SEC Newgate metadata must cover every historical wave");
  for (let i = 0; i < secRows.length; i++) Object.assign(secRows[i], other.secNewgateSamples[i],
    { start: other.secNewgateSamples[i].dateStart });
  const otherRows = other.waves.map((w) => ({
    ...w, start: w.dateStart, label: `${w.dateStart} to ${w.end}`,
    source: w.source || `${w.pollster} national-direction release`,
  }));
  const additional = [
    ...secRows,
    ...redbridgeHistoryWaves(SRC),
    ...mckinnon,
    ...otherRows,
  ];
  for (const w of additional) {
    if (unsureBad(w)) throw new Error(`${w.pollster} ${w.month}: bad printed triple`);
    const liveSameMonth = liveDirection.filter((d) => d.pollster === w.pollster && d.date.startsWith(w.month));
    if (liveSameMonth.some((d) => d.right === w.right && d.wrong === w.wrong)) continue;
    if (liveSameMonth.length) throw new Error(`${w.pollster} ${w.month}: historical reprint disagrees with the dated row`);
    byKey.set(`${w.pollster}|${w.month}|${w.right}|${w.wrong}`, w);
  }
  const recoveredSamples = ["rm-samples-2007-2013.json", "rm-samples-2014-2025.json"]
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(SRC, name), "utf8")).waves);
  const samplesByKey = new Map();
  for (const s of recoveredSamples) {
    const key = `${s.historyEnd || s.end}|${s.right ?? ""}|${s.wrong ?? ""}`;
    if (!samplesByKey.has(key)) samplesByKey.set(key, []);
    samplesByKey.get(key).push(s);
  }
  let samplesApplied = 0, ambiguousSamples = 0;
  for (const w of byKey.values()) if (w.pollster === "Roy Morgan") {
    const candidates = (samplesByKey.get(`${w.end}|${w.right}|${w.wrong}`) ||
      samplesByKey.get(`${w.end}||`) || [])
      .filter((s) => !s.method || (s.historyMethod || s.method) === w.method);
    const ns = [...new Set(candidates.map((s) => s.sample))];
    if (ns.length !== 1) { if (candidates.length) ambiguousSamples++; continue; }
    const s = candidates[0];
    if (w.sample != null && w.sample !== s.sample) throw new Error(`${w.end}: ${w.sample} conflicts with recovered n=${s.sample}`);
    w.sample = s.sample;
    w.sampleUrl = s.url; w.sampleQuote = s.quote;
    if (s.releaseMethod && s.releaseMethod !== w.method) w.releaseMethod = s.releaseMethod;
    samplesApplied++;
  }
  console.log(`HIST_SAMPLES ${JSON.stringify({ accepted: recoveredSamples.length, applied: samplesApplied,
    alreadySourced: [...byKey.values()].filter((w) => w.pollster === "Roy Morgan" && w.sample != null).length,
    ambiguous: ambiguousSamples, remainingNull: [...byKey.values()].filter((w) => w.pollster === "Roy Morgan" && w.sample == null).length })}`);
  const monthOfWave = (w) => String(w.end || w.published || w.month);
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
export { fieldDates, parseRows, parseReleaseRows };
if (process.argv[1] && process.argv[1].endsWith("backfill-direction-history.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
