/* extract-acnielsen-archive.mjs — ONE-TIME extraction: pull every poll wave and
   election result out of the ACNielsen "ESTIMATES OF FEDERAL VOTING INTENTION &
   LEADERSHIP APPROVAL" yearly tables and write one wide CSV into data/:

     acnielsen-polls.csv  (1996-03 election -> 2006-06 wave)

   Sources: pins from the wayback snapshot
     https://web.archive.org/web/20060627052718/http://au.acnielsen.com/news/200512.shtml
   ("Latest ACNielsen Poll" page, snapshot 2006-06-27) — its ten linked yearly PDFs,
   saved verbatim to .build/acnielsen-src/ACNielsenPoll<year>.pdf :
     reports/documents/ACNielsenPoll{1996,1997,1998_000,1999,2000,2001,2003,2004,2005_000}.pdf
     news/documents/ACNielsenPoll2006.pdf
   The page's own note: "no ACNielsen Federal Polls were conducted in 2002" — hence
   the gap. The 2006 PDF only runs Jan–Jun (snapshot caught the site mid-year).
   ACNielsen polled exclusively for The Age and The Sydney Morning Herald.

   Conventions:
   - date = fieldwork END day of the printed range (e.g. "21-22 Jan 2005" -> 2005-01-22;
     month-crossing ranges kept: "30 Sep 2 Oct" -> 2004-10-02), ISO. Matches the
     Newspoll/Roy Morgan archive keying (period-ending day).
   - election=1 marks the printed ELECTION columns (official result as ACNielsen
     rounded it); election rows carry no sample/mode/leadership numbers.
   - mode=phone: every yearly table footnotes "conducted on the telephone nationwide".
   - Published VI has uncommitted voters redistributed by ACNielsen — there is NO
     undecided column; these rows are not directly comparable with polls.json waves
     that publish undecided.
   - "-" (wave not asked that measure) and "incl. in 'Other'" (2001 election
     Independent) -> blank cell. Absent is not zero (repo convention).
   - ppm_pm is always Howard (PM 1996–2007); ppm_opp pairs with opp_leader
     (beazley/crean/latham). The 2003 PPM row is printed "Crean /Latham": waves
     before 2003-12-02 pair Howard/Crean, the Dec 5-7 wave pairs Howard/Latham
     (Latham won the leadership 2 Dec 2003).
   - leadership approval is approve/disapprove/uncommitted (not Newspoll's net).

   Known source quirks kept verbatim (warned at runtime):
   - The 1998 (3rd Oct) and 2004 (9th Oct) election columns are printed in BOTH the
     election-year PDF and the following year's PDF; identical both times — the
     duplicate is dropped and logged.
   - Election 2PP as printed can depart a point from the official AEC result
     (1996-03-02 printed 47/53; AEC 46.4/53.6) — verbatim-transcript rule, same as
     the Roy Morgan archive's own election values.
   - 1997 headers collapse "May-02 4-May" etc.; the 1997 "Oct-17 18-Oct" wave is a
     rare two-day (not three-day) fieldwork window.
   - Interior sums of 100 are NOT guaranteed: ACNielsen footnotes "Figures may not
     add to 100% due to rounding". Checks below allow ±2 for VI (missing parties
     redistribute away) and ±1.5 for TPP/approval/PPM triples; off-tolerance rows
     are printed, not repaired (verbatim transcript, like the RM archive).
*/
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(HERE, "acnielsen-src");
const OUT = path.join(ROOT, "data", "acnielsen-polls.csv");
const YEARS = [1996, 1997, 1998, 1999, 2000, 2001, 2003, 2004, 2005, 2006];
const LEADERSHIP_SPILL = "2003-12-02"; // Latham replaces Crean (source prints "Crean /Latham")

const warnings = [];
const notes = [];
const warn = (m) => { warnings.push(m); };
const note = (m) => { notes.push(m); };

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const monthOf = (s) => {
  const m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  return m ? MONTHS[m[1]] : null;
};
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// ---------- geometry: words -> rows -> column windows ----------
function wordsOf(pdf) {
  const xml = execFileSync("pdftotext", ["-bbox", pdf, "-"], { encoding: "utf8", maxBuffer: 1 << 22 });
  const out = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(xml))) {
    const text = m[5]
      .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
    if (text) out.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], xc: (+m[1] + +m[3]) / 2, yc: (+m[2] + +m[4]) / 2, text });
  }
  return out;
}
function rowsOf(words) {
  const rows = [];
  for (const w of [...words].sort((a, b) => a.yc - b.yc || a.xc - b.xc)) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(w.yc - r.yc) <= 3) { r.words.push(w); r.yc = (r.yc * (r.words.length - 1) + w.yc) / r.words.length; }
    else rows.push({ yc: w.yc, words: [w] });
  }
  for (const r of rows) r.words.sort((a, b) => a.xc - b.xc);
  return rows;
}

// ---------- table model ----------
function parseYear(year, pdf) {
  const rows = rowsOf(wordsOf(pdf));
  const joined = rows.map((r) => r.words.map((w) => w.text).join(" "));
  if (!joined.some((t) => /telephone/i.test(t))) warn(`${year}: telephone-mode footnote not found`);
  if (joined.some((t) => /uncommitted voters (?:were )?redistributed/i.test(t))) note(`${year}: 'Uncommitted voters were redistributed' footnote confirmed`);

  // year row: every word is a 4-digit year, >=5 of them
  const yi = rows.findIndex((r) => r.words.length >= 5 && r.words.every((w) => /^\d{4}$/.test(w.text)));
  if (yi < 0) throw new Error(`${year}: year-anchor row not found`);
  const anchors = rows[yi].words.map((w) => ({ x: w.xc, year: +w.text }));
  // column windows from anchor midpoints, outer edges extended half a spacing
  const windows = anchors.map((a, i) => {
    const left = i === 0 ? a.x - (anchors[1].x - a.x) / 2 : (anchors[i - 1].x + a.x) / 2;
    const right = i === anchors.length - 1 ? a.x + (a.x - anchors[i - 1].x) / 2 : (a.x + anchors[i + 1].x) / 2;
    return { left, right };
  });
  const inWin = (w, i) => w.xc >= windows[i].left && w.xc < windows[i].right;
  const labelOf = (r) => r.words.filter((w) => w.x1 < windows[0].left - 2).map((w) => w.text).join(" ");
  const cellsOf = (r) => anchors.map((_, i) => r.words.filter((w) => inWin(w, i)));

  const row1 = rows[yi - 2], row2 = rows[yi - 1];
  if (!row1 || !row2) throw new Error(`${year}: header range rows missing`);
  const head1 = cellsOf(row1).map((c) => c.map((w) => w.text).join(""));
  const head2 = cellsOf(row2).map((c) => c.map((w) => w.text).join(""));

  const cols = anchors.map((a, i) => {
    const t1 = head1[i], t2 = head2[i], y = a.year;
    if (/^election$/i.test(t1)) {
      const d = t2.match(/\d+/), mo = monthOf(t2);
      if (!d || !mo) throw new Error(`${year} col ${i}: election header unparseable (${t1} / ${t2})`);
      return { kind: "election", date: iso(y, mo, +d[0]), yearToken: y, cells: {} };
    }
    const mo2 = monthOf(t2);
    if (!mo2) throw new Error(`${year} col ${i}: month row unparseable (${t1} / ${t2})`);
    const d2 = t2.match(/\d+/); // day printed inside the month row token (cross-month ranges)
    let day;
    if (d2) day = +d2[0];
    else {
      const nums = [...t1.matchAll(/\d+/g)];
      if (!nums.length) throw new Error(`${year} col ${i}: no day in range (${t1} / ${t2})`);
      day = +nums[nums.length - 1][0];
    }
    return { kind: "poll", date: iso(y, mo2, day), yearToken: y, cells: {}, leader: null };
  });

  // section-walking data rows
  // primary keys map before the "Two Party Preferred" marker; then tpp pair;
  // then pm / ol approval triples; then preferred-PM names
  const PRIMARY = { labor: "alp", coalition: "coalition", democrat: "democrats", greens: "greens", independent: "independents", other: "other" };
  let section = "primary";
  for (let ri = yi + 1; ri < rows.length; ri++) {
    const r = rows[ri];
    const label = labelOf(r);
    const cells = cellsOf(r);
    const anyCell = cells.some((c) => c.length > 0);
    let inclNoted = false;
    const put = (i, key, w) => {
      const t = w.text.replace(/,/g, "").replace(/%$/, "");
      if (t === "-") return;
      if (!/^-?\d+(\.\d+)?$/.test(t)) {
        // printed note in the 2001 Independent election cell: "incl. in 'Other'"
        if (/^incl\.?$/i.test(w.text) && !inclNoted) {
          inclNoted = true;
          note(`${year} ${cols[i].date}: '${label}' cell is "incl. in 'Other'" -> blank (kept)`);
          return;
        }
        if (/^(in|["'“”]?other["'“”]?)\.?$/i.test(w.text) && inclNoted) return;
        warn(`${year} ${cols[i].date}: non-numeric cell '${label}' = '${w.text}'`);
        return;
      }
      cols[i].cells[key] = +t;
    };
    if (/^sample size/i.test(label)) { cells.forEach((c, i) => c.forEach((w) => put(i, "sample", w))); continue; }
    if (/^margin of error/i.test(label)) { cells.forEach((c, i) => c.forEach((w) => put(i, "moe", w))); continue; }
    if (/^two party preferred/i.test(label)) { section = "tpp"; continue; }
    if (/^preferred prime minister/i.test(label)) { section = "ppm"; continue; }
    if (/^prime minister/i.test(label)) { section = "pm"; continue; }
    if (/^opposition leader/i.test(label)) {
      section = "ol";
      const lm = label.match(/opposition leader ([a-z]+)/i);
      const name = lm ? lm[1].toLowerCase() : null;
      if (name && cols.every((c) => c.leader === null)) cols.forEach((c) => { c.leader = name; });
      else if (!name) note(`${year}: unnamed 'Opposition Leader's Performance' row — name comes from the PPM block`);
      continue;
    }
    // narration/footnote rows span the data columns — never treat their words as cells
    if (/redistributed|conducted on the telephone|figures may not|www\.acnielsen/i.test(label)) continue;
    if (!label || !anyCell) continue;
    const lil = label.toLowerCase().replace(/^(ph|p\.?h\.?)\s+/, "");
    if (section === "primary") {
      const key = PRIMARY[lil] ?? (/^one nation$/.test(lil) ? "one_nation" : null);
      if (!key) { note(`${year}: skipped row '${label}' in primary block`); continue; }
      cells.forEach((c, i) => c.forEach((w) => put(i, key, w)));
    } else if (section === "tpp") {
      const key = /^labor$/i.test(label) ? "tpp_alp" : /^coalition$/i.test(label) ? "tpp_coalition" : null;
      if (!key) { note(`${year}: skipped row '${label}' in tpp block`); continue; }
      cells.forEach((c, i) => c.forEach((w) => put(i, key, w)));
    } else if (section === "pm" || section === "ol") {
      const kind = /^approve$/i.test(lil) ? "approve" : /^disapprove$/i.test(lil) ? "disapprove" : /^uncommitted$/i.test(lil) ? "uncommitted" : null;
      if (!kind) { note(`${year}: skipped row '${label}' in ${section} block`); continue; }
      cells.forEach((c, i) => c.forEach((w) => put(i, `${section}_${kind}`, w)));
    } else if (section === "ppm") {
      if (/^howard$/i.test(label)) cells.forEach((c, i) => c.forEach((w) => put(i, "ppm_pm", w)));
      else if (/^uncommitted$/i.test(lil)) cells.forEach((c, i) => c.forEach((w) => put(i, "ppm_uncommitted", w)));
      else if (/^(beazley|crean|latham)|(crean ?\/ ?latham)$/.test(lil)) {
        cells.forEach((c, i) => c.forEach((w) => put(i, "ppm_opp", w)));
        // per-column name when the label carries both Crean and Latham
        if (/crean/i.test(label) && /latham/i.test(label)) cols.forEach((c) => { c.leader = c.date < LEADERSHIP_SPILL ? "crean" : "latham"; });
        else {
          const name = label.match(/beazley|crean|latham/i)[0].toLowerCase();
          cols.forEach((c) => { if (c.leader === null || c.leader === "crean") c.leader = name; });
        }
      } else note(`${year}: skipped row '${label}' in ppm block`);
    }
  }
  return cols;
}

// ---------- run over all years, dedupe reprinted election columns ----------
const waves = new Map(); // date -> {cells..., _kind, leader}
for (const y of YEARS) {
  const pdf = path.join(SRC, `ACNielsenPoll${y}.pdf`);
  if (!fs.existsSync(pdf)) throw new Error(`missing source PDF ${pdf}`);
  for (const col of parseYear(y, pdf)) {
    const rec = { ...col.cells, _kind: col.kind, leader: col.leader };
    const prev = waves.get(col.date);
    if (!prev) { waves.set(col.date, { ...rec, _printed: [`${y}`] }); continue; }
    const same = Object.keys(rec).every((k) => k === "_kind" || rec[k] === undefined || prev[k] === rec[k]);
    if (same) note(`${col.date}: duplicate column (printed in ${prev._printed.join("+")} and ${y}) is identical — year-${y} copy dropped`);
    else warn(`${col.date}: CONFLICTING duplicate column in ${y} — first print kept`);
  }
}

// ---------- assemble rows + QA ----------
const GAUGES = [
  ["pm", ["pm_approve", "pm_disapprove", "pm_uncommitted"]],
  ["ol", ["ol_approve", "ol_disapprove", "ol_uncommitted"]],
  ["ppm", ["ppm_pm", "ppm_opp", "ppm_uncommitted"]],
];
const rows = [...waves.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, w]) => {
  const election = w._kind === "election" ? 1 : "";
  if (election && (w.sample !== undefined || w.moe !== undefined)) warn(`${date}: election column unexpectedly carries sample/moe`);
  for (const k of ["alp", "coalition", "tpp_alp", "tpp_coalition"]) if (w[k] === undefined) warn(`${date}: missing ${k}`);
  const viSum = ["alp", "coalition", "democrats", "greens", "independents", "one_nation", "other"].reduce((a, k) => a + (w[k] ?? 0), 0);
  if (viSum < 97 || viSum > 103) warn(`${date}: primary sum ${viSum} outside 97–103`);
  const tppSum = (w.tpp_alp ?? 0) + (w.tpp_coalition ?? 0);
  if (w.tpp_alp !== undefined && Math.abs(tppSum - 100) > 1.5) warn(`${date}: tpp sum ${tppSum}`);
  for (const [block, keys] of GAUGES) {
    const have = keys.filter((k) => w[k] !== undefined);
    if (have.length === 3) {
      const s = have.reduce((a, k) => a + w[k], 0);
      if (Math.abs(s - 100) > 1.5) warn(`${date}: ${block} triple sums ${s}`);
    } else if (have.length) warn(`${date}: partial ${block} row`);
  }
  if (!election && w.sample === undefined) warn(`${date}: poll wave missing sample`);
  const row = { date, election, mode: election ? "" : "phone", ...w };
  delete row._kind; delete row._printed;
  if (election) delete row.leader;
  return row;
});

const HEADER = ["date", "election", "sample", "moe", "mode",
  "alp", "coalition", "democrats", "greens", "independents", "one_nation", "other",
  "tpp_alp", "tpp_coalition",
  "pm_approve", "pm_disapprove", "pm_uncommitted",
  "opp_leader", "ol_approve", "ol_disapprove", "ol_uncommitted",
  "ppm_pm", "ppm_opp", "ppm_uncommitted"];
const csv = [HEADER.join(",")].concat(rows.map((r) => HEADER.map((h) => {
  if (h === "mode") return r.mode;
  if (h === "opp_leader") return r.leader ?? "";
  const v = r[h];
  return v === undefined || v === "" || v === null ? "" : String(v === undefined ? "" : v);
}).join(","))).join("\n") + "\n";

// ---------- report ----------
const nElection = rows.filter((r) => r.election === 1).length;
console.log(`acnielsen-polls.csv: ${rows.length} rows (${nElection} election, ${rows.length - nElection} poll waves), ${rows[0].date} -> ${rows[rows.length - 1].date}`);
for (const m of notes) console.log(`  note: ${m}`);
for (const m of warnings) console.log(`  WARN: ${m}`);
const dedupeNotes = notes.filter((m) => m.startsWith("1998-10-03") || m.startsWith("2004-10-09"));
if (nElection !== 4) console.log(`  WARN: expected 4 election rows, got ${nElection}`);
if (dedupeNotes.length !== 2) console.log(`  WARN: expected exactly the 1998/2004 election reprints as duplicates (${dedupeNotes.length} seen)`);
if (!process.argv.includes("--write")) {
  console.log("(dry run — pass --write to write data/acnielsen-polls.csv)");
} else {
  fs.writeFileSync(OUT, csv);
  console.log(`wrote ${OUT}`);
}
