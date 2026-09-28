#!/usr/bin/env node
/* extract-secnewgate.mjs – reads SEC Newgate's "Mood of the Nation" survey
   into data/polls.json's `direction` array, as the SEC Newgate (direction-only)
   rows of the National-direction panel.

   SEC Newgate publishes no voting intention. Its bi-monthly tracking study
   asks whether Australia is heading in the right direction or down the
   wrong track, and publishes the current wave in a PDF report under
   https://www.secnewgate.com.au/news-views/ ("research" tag). Discovery is
   the WordPress REST media API: file names are too inconsistent to probe
   (`-1` suffixes, `-EMBARGOED` re-uploads, November 2025's report re-hosted
   under 2026/02) and predictable-URL guesses only earn Cloudflare 523s.
   The search "Mood" returns every report PDF on one page; editions that
   carry no national direction series (the "Queensland Edition", and
   specials like the April 2026 "Special Edition", which asked no direction
   question at all) are set aside by title.

   Each report carries its facts on two pages:
     - the methodology page: "The Nth wave of this bi-monthly tracking
       study.", a "Fieldwork dates" block ("8th – 14th September 2026."),
       and "n = 1,659 Australians aged 18+…". The wave ordinal is what
       marks a tracking wave; a report without one never asked the question
       and is skipped, not failed.
     - the direction page (page 8 in every report since mid-2025), "Perceived
       direction of Australia (%)": a monthly line chart of the whole series
       (wrong track above, right direction below, the two totalling 100;
       "unsure" is the unprinted remainder). It is read by GEOMETRY with
       `pdftotext -bbox`: the month label row anchors the column centres,
       and each column's two numbers pair as top = wrong, bottom = right.
       The state table lower on the page is kept out by the x/y windows.

   Rows are written to D.direction as
   { date = fieldwork END, dateStart, pollster: "SEC Newgate",
     right, wrong, unsure = 100 − right − wrong }
   and the array re-sorted by date, like every house's writer. A rerun
   heals a row of the same wave within HEAL_DAYS of a prior entry. The
   newest report's full series is cross-checked against every earlier
   wave's own endpoint (the series only reprints history; a publish-day
   correction to an old point would show here).

   Cache: .build/secnewgate-src/<slug>.txt (pdftotext -layout, the whole
   report), <slug>.bbox.html (pdftotext -bbox, the direction page only),
   <slug>.json ({ pdf, wave, date, dateStart, sample }). Written once when
   first fetched and never touched again, so a run that finds nothing new
   changes nothing. A page or PDF that won't load is a warning, not a
   failure: the cache stays; a report that IS cached but won't read is
   pending and fails the run that landed it, once anything else is pushed.

   Usage: node .build/extract-secnewgate.mjs [--force]  (--force refetches)
   SECNEWGATE_SRC_DIR redirects the cache.
   Last line: SECNEWGATE_STATUS {"changed":…,"added":[…],"healed":[…],
   "pending":[…],"stale":[…],"warnings":[…]} */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { TRACKER_UA, MONTHS, writeAtomic } from "./extract-common.mjs";

const FORCE = process.argv.includes("--force");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.SECNEWGATE_SRC_DIR || path.join(ROOT, ".build", "secnewgate-src");
const POLLS = process.env.SECNEWGATE_POLLS || path.join(ROOT, "data", "polls.json");
const API = "https://www.secnewgate.com.au/wp-json/wp/v2/media?search=Mood&per_page=100";
const SEC_FIRST = "2025-07";   // waves on file run Jul 2025 on; older reports stay untouched
const QUIET_DAYS = 75;         // bi-monthly cadence plus slack before the house counts as quiet
const HEAL_DAYS = 8;           // a wave re-dated within this window is the same wave
const POLLSTER = "SEC Newgate";

const ordinal = (n) => { const t = ["th", "st", "nd", "rd"]; const v = n % 100; return n + (t[(v - 20) % 10] || t[v] || t[0]); };

async function get(url) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": TRACKER_UA },
                                     signal: AbortSignal.timeout(60_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`${url}: ${last.message}`);
}
const pdfToText = (buf, slug, args) => {
  const f = path.join(tmpdir(), `secnewgate-${slug}.pdf`);
  fs.writeFileSync(f, buf);
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    try { return execFileSync(bin, [...args, f, "-"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
    catch (e) { if (e.code !== "ENOENT") throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 200)}`); }
  }
  throw new Error("pdftotext (poppler) not found");
};

/* The month a report covers, from its media-item title ("… – September
   2026 Report", "…-Report-November-2025", "… November 24 – Embargoed");
   "YYYY-MM" or null. A two-digit year is the survey's own era (2022 on). */
export function titleMonthOf(title) {
  const t = title.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/gi, "&");
  const m = t.match(/([A-Za-z]+)[-\s]+(\d{4}|\d{2})(?:\D|$)/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  if (mo == null) return null;
  let y = +m[2];
  if (y < 100) y += 2000;
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/* Media API items → the report candidates, one ordered list of URLs per
   wave month: "Mood of the Nation … report … .pdf", the Queensland edition
   and the one-off specials set aside, a non-embargoed upload preferred over
   its "-Embargoed" twin, and whichever variant is then first. */
export function pickReports(items) {
  const byMonth = new Map();
  for (const it of items) {
    const title = (it.title && it.title.rendered) || "";
    const url = it.source_url || "";
    if (!/mood of the nation/i.test(title) || !/report/i.test(title)) continue;
    if (!/\.pdf$/i.test(url)) continue;
    if (/queensland edition|special edition/i.test(title)) continue;
    const ym = titleMonthOf(title);
    if (!ym || ym < SEC_FIRST) continue;
    const embargo = /embargo/i.test(title) || /embargo/i.test(url);
    const g = byMonth.get(ym) || [];
    g.push({ url, embargo });
    byMonth.set(ym, g);
  }
  for (const g of byMonth.values()) {
    g.sort((a, b) => (a.embargo - b.embargo) || a.url.localeCompare(b.url));
    const clean = g.filter((x) => !x.embargo);
    if (clean.length) g.length = 0, g.push(...clean);
  }
  return [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ym, urls]) => ({ ym, urls: urls.map((u) => u.url) }));
}

/* The methodology page facts of a tracking wave: its ordinal, fieldwork
   span and sample size – or null for a report that never asked (a special),
   which is a skip, not a failure. */
export function methodologyOf(text) {
  const w = text.match(/The (\d+)(?:st|nd|rd|th) wave of this bi-monthly/);
  if (!w) return null;
  const d = text.match(/Fieldwork dates\s*\n?\s*(\d{1,2})(?:st|nd|rd|th)\s+(?:([A-Za-z]+)\s+)?[–-]\s*(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/);
  if (!d) return { wave: +w[1], date: null, dateStart: null, sample: null,
                   problems: ["the fieldwork dates didn't parse"] };
  const endMo = MONTHS[d[4].toLowerCase()];
  const startMo = d[2] != null ? MONTHS[d[2].toLowerCase()] : endMo;
  if (endMo == null || startMo == null) return { wave: +w[1], date: null, dateStart: null, sample: null,
    problems: [`unrecognised month in the fieldwork dates ("${d[0].trim()}")`] };
  const endYear = +d[5];
  const startYear = startMo > endMo ? endYear - 1 : endYear;
  const iso = (y, mo, day) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const n = text.match(/n = ([\d,]+) Australians/);
  const problems = [];
  if (!n) problems.push("the sample size didn't parse");
  return { wave: +w[1], date: iso(endYear, endMo, +d[3]), dateStart: iso(startYear, startMo, +d[1]),
           sample: n ? +n[1].replace(/,/g, "") : null, problems };
}

/* The national direction chart page's number in a report's layout text
   (form-feed split), for `pdftotext -f N -l N -bbox`; 0 when the report
   carries none (the specials), which the caller treats as skip-not-fail
   only when methodologyOf already said it isn't a tracking wave. */
export function directionPageOf(text) {
  const pages = text.split("\f");
  const i = pages.findIndex((pg) => /Perceived direction of Australia/.test(pg));
  return i < 0 ? 0 : i + 1;
}

/* The direction chart's per-wave readings from a `pdftotext -bbox` of its
   page. The month label row gives the column centres; in each column the
   two printed values pair as the UPPER = wrong track and the LOWER = right
   direction (they never cross in the tracked era, and the callers' checks
   fail loudly if a future wave flips them). The y/x windows keep out the
   axis labels (x < 60), the right-hand callouts (x > 730) and the
   per-state table below the month row. */
export function directionChartOf(bboxHtml) {
  const words = [...bboxHtml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((m) => ({ x: +m[1], y: +m[2], t: m[5].replace(/&apos;|&#039;/g, "\u2019") }));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "June", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec"];
  const axisRow = (() => {   // the y carrying the month label row (>= 5 tokens)
    const tally = {};
    for (const w of words) {
      if (!MON.includes(w.t) || w.x >= 750) continue;
      const k = Math.round(w.y / 8) * 8;
      tally[k] = (tally[k] || 0) + 1;
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 5 ? +best[0] : null;
  })();
  if (axisRow == null) return { columns: [], problems: ["no month label row on the direction chart page"] };
  const labels = words.filter((w) => MON.includes(w.t) && w.x < 750 && Math.abs(w.y - axisRow) <= 8)
    .sort((a, b) => a.x - b.x);
  const vals = words.filter((w) => /^\d{1,3}$/.test(w.t) && w.x >= 60 && w.x <= 730
    && w.y > axisRow - 130 && w.y < axisRow - 4)
    .map((w) => ({ x: w.x, y: w.y, v: +w.t }));
  const problems = [], columns = [];
  for (const col of labels) {
    const here = vals.filter((v) => Math.abs(v.x - col.x) <= 16).sort((a, b) => a.y - b.y);
    // a stray token in the window (a glued page number) makes the column
    // unreadable rather than guessed
    if (here.length !== 2) { columns.push(null); problems.push(`${col.t} column: ${here.length} value token(s), expected 2`); continue; }
    const wrong = here[0].v, right = here[1].v;
    if (wrong < 15 || wrong > 80 || right < 15 || right > 80) problems.push(`${col.t} column: ${wrong}/${right} outside 15–80`);
    if (Math.abs(wrong + right - 100) > 1) problems.push(`${col.t} column: ${wrong} + ${right} ≠ 100`);
    if (wrong < right) problems.push(`${col.t} column: wrong track ${wrong} below right direction ${right} – the lines crossed`);
    columns.push({ wrong, right });
  }
  return { columns, problems };
}

const slugOf = (url) => decodeURIComponent(url.split("/").pop())
  .replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_");

async function main() {
  const status = { changed: false, added: [], healed: [], pending: [], stale: [], warnings: [] };
  fs.mkdirSync(SRC, { recursive: true });

  let items;
  try { items = JSON.parse((await get(API)).toString("utf8")); }
  catch (e) {
    console.log("warning media API: " + e.message);
    status.warnings.push(`media API: ${e.message}`);
    // a cached wave still needs its quiet check below even when discovery failed
    fin(status);
    return;
  }
  if (!Array.isArray(items) || items.length < 5) {
    status.warnings.push(`media API returned ${Array.isArray(items) ? items.length : "no"} items – has the search broken?`);
    if (Array.isArray(items)) items = []; else items = [];
  }
  const groups = pickReports(items);
  if (groups.length < 5) status.warnings.push(`only ${groups.length} report wave(s) found from ${SEC_FIRST} on – has the media library changed?`);

  const waves = new Map();   // wave ordinal -> { slug, meta, cols: […] }
  for (const g of groups) {
    let done = false;
    for (const url of done ? [] : g.urls) {
      const slug = slugOf(url);
      const txtPath = path.join(SRC, slug + ".txt");
      const bboxPath = path.join(SRC, slug + ".bbox.html");
      let text, bbox;
      if (!FORCE && fs.existsSync(txtPath) && fs.existsSync(bboxPath)) {
        text = fs.readFileSync(txtPath, "utf8");
        bbox = fs.readFileSync(bboxPath, "utf8");
      } else {
        let buf;
        try { buf = await get(url); }
        catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") { status.warnings.push(`${slug}: not a PDF`); continue; }
        try {
          text = pdfToText(buf, slug, ["-layout"]);
          const meta0 = methodologyOf(text);
          if (!meta0) break;   // not a tracking wave (a special): keep nothing
          const page = directionPageOf(text);
          if (!page) { status.pending.push(`${g.ym}: the report has no national direction chart page`); done = true; break; }
          bbox = pdfToText(buf, slug, ["-f", String(page), "-l", String(page), "-bbox"]);
        } catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        fs.writeFileSync(txtPath + ".tmp", text); fs.renameSync(txtPath + ".tmp", txtPath);
        fs.writeFileSync(bboxPath + ".tmp", bbox); fs.renameSync(bboxPath + ".tmp", bboxPath);
        console.log(`cached report ${slug}`);
      }
      const meta = methodologyOf(text);
      if (!meta) break;        // cached pre-refactor special: set aside
      if (!meta.date) { status.pending.push(`${g.ym}: ${meta.problems.join("; ")}`); done = true; break; }
      const chart = directionChartOf(bbox);
      const last = chart.columns[chart.columns.length - 1];
      if (chart.problems.length || !last) {
        status.pending.push(`${g.ym}: the direction chart didn't read (${chart.problems.slice(0, 2).join("; ") || "no endpoint"})`);
        done = true; break;
      }
      if (chart.columns.length !== meta.wave) {
        status.pending.push(`${g.ym}: wave ${meta.wave} but the chart has ${chart.columns.length} columns`);
        done = true; break;
      }
      fs.writeFileSync(path.join(SRC, slug + ".json"),
        JSON.stringify({ pdf: url, wave: meta.wave, date: meta.date, dateStart: meta.dateStart, sample: meta.sample }, null, 1) + "\n");
      waves.set(meta.wave, { slug, meta, cols: chart.columns });
      done = true;
    }
    if (!done && ![...waves.values()].some((w) => w.meta.date.startsWith(g.ym))) {
      // every URL for this month failed to load or read
      if (!status.pending.some((p) => p.startsWith(g.ym)))
        status.warnings.push(`${g.ym}: no report PDF could be used`);
    }
  }

  // the newest wave's full series reprints history: every earlier wave's
  // own endpoint must sit at series[wave-1] of the newest chart
  const newest = Math.max(...waves.keys(), 0);
  if (newest && waves.get(newest).cols.length === newest) {
    const series = waves.get(newest).cols;
    for (const [w, x] of waves) {
      if (w === newest) continue;
      const s = series[w - 1];
      const own = x.cols[x.cols.length - 1];
      if (!s || s.wrong !== own.wrong || s.right !== own.right)
        status.warnings.push(`wave ${w}: own report ends ${own.wrong}/${own.right} but ` +
          `the wave-${newest} chart reprints ${s ? `${s.wrong}/${s.right}` : "nothing"}`);
    }
  }

  const orig = fs.readFileSync(POLLS, "utf8");
  const D = JSON.parse(orig);
  const dir = D.direction || [];
  const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  for (const [w, x] of [...waves.entries()].sort((a, b) => a[0] - b[0])) {
    const { meta, cols } = x;
    const last = cols[cols.length - 1];
    const row = { date: meta.date, dateStart: meta.dateStart, pollster: POLLSTER,
                  right: last.right, wrong: last.wrong, unsure: 100 - last.right - last.wrong };
    const exact = dir.findIndex((d) => d.pollster === POLLSTER && d.date === row.date);
    if (exact >= 0) {
      const cur = dir[exact];
      if (cur.right !== row.right || cur.wrong !== row.wrong || cur.unsure !== row.unsure
          || cur.dateStart !== row.dateStart) {
        dir[exact] = row;
        status.healed.push(row.date);
      }
      continue;
    }
    const near = dir.findIndex((d) => d.pollster === POLLSTER && days(d.date, row.date) <= HEAL_DAYS);
    if (near >= 0) {
      dir[near] = row;
      status.healed.push(row.date);
    } else {
      dir.push(row);
      status.added.push(row.date);
    }
  }
  D.direction = dir.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = JSON.stringify(D, null, 2) + (orig.endsWith("\n") ? "\n" : "");
  status.changed = next !== orig;
  if (status.changed) writeAtomic(POLLS, next);
  fin(status);
}

function fin(status) {
  const D = JSON.parse(fs.readFileSync(POLLS, "utf8"));
  const mine = (D.direction || []).filter((d) => d.pollster === POLLSTER)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const quietD = mine ? Math.round((Date.now() - Date.parse(mine.date)) / 864e5) : null;
  if (!mine || quietD > QUIET_DAYS) {
    console.log("pending", `SEC Newgate|quiet: ${mine ? `no wave since fieldwork closed ${mine.date}` : "no wave on file"} – is the media search still finding the reports?`);
    status.stale.push("SEC Newgate|quiet");
  }
  for (const p of status.pending) console.log("pending", p);
  for (const w of status.warnings) console.log("warning", w);
  console.log("SECNEWGATE_STATUS " + JSON.stringify(status));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
