// Extract every polling chart from essentialreport.com.au report + question
// pages into data/essential-report.csv.
//
// Data flow (discovered 2026-08):
//   0. The site sits behind Sucuri CloudProxy, which answers cache misses
//      with a JS-cookie interstitial (and 403s when rate-limiting); getText
//      solves the challenge once per run and retries 403/429 with backoff.
//   1. WP REST API /wp-json/wp/v2/reports lists all reports (99 at discovery,
//      spanning Oct 2021 -> latest; the site was rebuilt in 2021 so earlier
//      waves exist only inside chart history); /wp-json/wp/v2/questions lists
//      ~950 standalone question pages.
//   2. Each report page (/reports/<slug>) holds an accordion of question
//      "cards": card-header text = question title; panels labelled by
//      .btn-question buttons ("Overall", "State", ...) embed Flourish iframes
//      (flo.uri.sh/visualisation/<id>/embed).
//   3. /wp-json/wp/v2/questions lists standalone question pages
//      (essentialreport.com.au/questions/<slug>) which embed Flourish charts
//      directly, some of which never appear on a report page.
//   4. public.flourish.studio/visualisation/<id>/visualisation.json returns
//      the chart spec with the data embedded inline in `data` sheets.
//      Long-running trackers carry their FULL history in one chart (e.g.
//      "Q3. Approval of Scott Morrison" 2019-01 -> 2022-05), so the union of
//      all charts is the complete machine-readable archive.
//
// Two sheet layouts exist (all observed charts are @flourish/line-bar-pie):
//   - time series: row labels are wave dates ("Jan'19", "9-22 Nov", ...),
//     columns are answers -> rows: dimension="", key="", date=row label.
//   - cross-tab (per-wave bars): row labels are items or segments, columns
//     are answers -> rows: dimension from the chart-name "(By ...)" suffix
//     (else "item"), key=row label, date=wave (chart subtitle, else report
//     publish date).
//
// CSV schema mirrors data/resolve-political-monitor.csv exactly
// (dataset,question_id,question,visual,answer,dimension,key,date,value_pct,
// parties) so downstream tooling can treat the archives identically.
//   dataset     slug of the question title (report card title, else chart
//               layout.title)
//   question_id Essential question code from the chart name ("Q3", "E924"),
//               else the flourish visualisation id
//   question    full wording from the chart's layout.header_text (html
//               stripped), else the cleaned chart name
//   visual      report panel / chart-name suffix: "", "By state", "By age"...
//   answer      sheet column header ("Total approve", "NSW", ...)
//   dimension   "(By x)" suffix normalised (state, gender, age,
//               voting_intention, ...); "item" for unsuffixed cross-tabs;
//               "" for time series
//   key         cross-tab row label (item/segment); "" for time series
//   date        ISO date. Month-only labels ("Jan'19") are stored as the
//               first of the month. Labels that don't parse are kept verbatim
//               (upstream formats vary; never guess).
//   value_pct   numeric, parsed from "33%" cells. Cells that are not
//               percentages ("<1%", "-", blanks) are skipped and counted.
//   parties     always empty (schema parity with the Resolve CSV).
//
// Chart-level metadata NOT captured (deliberately, to keep the resolve
// schema): sample-size footer notes (uniformly ~n=1,000-1,100), chart
// colours, card category tags.
//
// Usage: node .build/extract-essential-report.mjs [--check] [--force]
//
// Automation contract (same as extract-resolve-rpm.mjs):
//   - idempotent: re-running with unchanged upstream data writes nothing and
//     produces byte-identical output; a no-change run skips the write
//   - exit 0 = success; final stdout line is `ESSENTIAL_STATUS {json}`
//   - exit 1 = fetch/parse error; exit 2 = safety guard tripped (merge would
//     shrink the committed row set — re-run with --force after review)
//   - --check computes everything, prints status, never writes
//   - the CSV write is atomic (write to .tmp + rename over it)
//
// Side output: .build/essential-src/report-index.json maps each report's
// publish date to its wave page link. The CSV has no room for URLs, so
// .build/assimilate-essential-vi.mjs resolves a new tracker row's
// `releaseUrl` against that index instead.
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
const OUT = "data/essential-report.csv";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 24;     // generous: sucuri throttles bursts, we wait it out
const CONCURRENCY = 3;      // wordpress pages
const PAGE_MIN_GAP_MS = 350; // per-worker gap between wordpress page fetches
const FLOURISH_CONCURRENCY = 8; // flourish cdn reads
const H = { "user-agent": "Mozilla/5.0 (compatible; auspol-tracker data collector; +https://essentialreport.com.au/methodology)" };

// The site sits behind Sucuri CloudProxy, which answers cache misses with a
// 307 interstitial whose inline script sets a `sucuri_cloudproxy_uuid_*`
// cookie and reloads (a browser silently passes). We solve the challenge
// once per run and send the cookie on subsequent requests.
let sucuriCookie = "";
let sucuriSolving = null;
async function sucuriSolve(body, u) {
  const m = body.match(/S='([A-Za-z0-9+/=]+)'/);
  if (!m) throw new Error(`sucuri interstitial at ${u} but no challenge payload`);
  const code = Buffer.from(m[1], "base64").toString("utf8");
  let pair = "";
  const fn = new Function("document", "location", "String", code);
  fn(
    { set cookie(v) { if (!pair) pair = v.split(";")[0]; } },
    { reload() {} },
    String,
  );
  if (!pair.startsWith("sucuri_cloudproxy_")) throw new Error(`sucuri challenge at ${u} solved to unexpected cookie: ${pair.slice(0, 60)}`);
  return pair;
}

const retryable = (msg) => !/HTTP (4(?!03|29)\d\d)/.test(msg); // 4xx other than 403/429 is fatal

async function getText(u) {
  for (let attempt = 1, sucuriTries = 0; ; attempt++) {
    try {
      const res = await fetch(u, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: sucuriCookie ? { ...H, cookie: sucuriCookie } : H,
      });
      if (res.status === 403 || res.status === 429) {
        // Sucuri rate-limiting: drop back, discard the (possibly stale) cookie
        // so a fresh challenge gets solved next pass, and wait longer.
        sucuriCookie = ""; sucuriSolving = null;
        if (attempt >= FETCH_TRIES) throw new Error(`HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 4000 * attempt));
        continue;
      }
      const text = await res.text();
      if (text.includes("sucuri_cloudproxy_js")) {
        if (++sucuriTries > 3) throw new Error(`sucuri challenge keeps recurring at ${u}`);
        // Solve in series: concurrent fetches share the one challenge solve.
        sucuriSolving ??= sucuriSolve(text, u)
          .then((pair) => { sucuriCookie = pair; console.log(`sucuri: challenge solved (${pair.split("=")[0]})`); })
          .finally(() => { sucuriSolving = null; });
        await sucuriSolving;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { text, headers: res.headers };
    } catch (err) {
      if (attempt >= FETCH_TRIES || !retryable(err.message)) throw new Error(`fetch ${u} failed after ${attempt} tries: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

// Run tasks over items with a fixed-size pool. With minGapMs set, each worker
// also waits that long between its tasks (politeness pacing).
async function pool(items, size, fn, minGapMs = 0) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
      if (minGapMs && next < items.length) await new Promise((r) => setTimeout(r, minGapMs));
    }
  }));
  return out;
}

// ---------------------------------------------------------------- site crawl

async function listPosts(type) {
  const all = [];
  for (let page = 1; ; page++) {
    const { text, headers } = await getText(`https://essentialreport.com.au/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=id,date,modified,link,title`);
    all.push(...JSON.parse(text));
    if (page >= Number(headers.get("x-wp-totalpages") || 1)) return all;
  }
}

// Report pages: question cards with labelled panels, each panel holding one
// or more flourish embeds. Question pages: bare embeds.
function parseReportPage(html, report) {
  const out = [];
  out.skipped = 0;
  const cards = html.split(/<div class="card report-list"/).slice(1);
  for (const cardHtml of cards) {
    const head = cardHtml.match(/<a class="collapsed card-link"[^>]*>([\s\S]*?)<\/a>/);
    const title = head ? clean(head[1]).replace(/<[^>]*>/g, "").trim() : "";
    const labels = new Map();
    for (const m of cardHtml.matchAll(/<div class="btn btn-question[^"]*" data-q="(\d+)">([^<]*)<\/div>/g)) labels.set(m[1], clean(m[2]));
    const content = [...cardHtml.matchAll(/<div class="question-show[^"]*" data-q="(\d+)">([\s\S]*?)(?=<div class="question-show|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>|$)/g)];
    const ids = [...new Set([...cardHtml.matchAll(/visualisation\/(\d+)/g)].map(m => +m[1]))];
      if (!ids.length) { out.skipped++; continue; }
    // Iframes live in question-show panels; panel ordering aligns with the
    // button ordering, so pair each ids group with its label by data-q.
    const idsByPanel = new Map();
    for (const m of content) idsByPanel.set(m[1], [...new Set([...m[2].matchAll(/visualisation\/(\d+)/g)].map(x => +x[1]))]);
    for (const id of ids) {
      let label = "";
      for (const [q, qids] of idsByPanel) if (qids.includes(id)) { label = labels.get(q) || ""; break; }
      out.push({ id, cardTitle: title, panel: label, reportDate: report.date, reportLink: report.link });
    }
  }
  return { cards: out, anyEmbed: /visualisation\/\d+/.test(html) };
}

function parseQuestionPage(html, report) {
  const ids = [...new Set([...html.matchAll(/visualisation\/(\d+)/g)].map(m => +m[1]))];
  return ids.map(id => ({ id, cardTitle: "", panel: "", reportDate: report.date, reportLink: report.link }));
}

// ------------------------------------------------------------------- flourishes

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const stripTags = (s) => clean(s.replace(/<[^>]*>/g, ""));

const slug = (s) => clean(s.toLowerCase()
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
  .replace(/&amp;/g, " and ").replace(/&[^;]+;/g, " ")
  .replace(/['"]/g, ""))
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// "Q3. Approval of Scott Morrison" / "E924 - Using a scale of..." -> code
const parseName = (name) => {
  const s = clean(stripTags(name).replace(/^copy of /i, ""));
  const m = s.match(/^([A-Z]{0,3}\d+[a-zA-Z]?)[\.-]\s*(.*)$/);
  if (m) return { code: m[1], rest: m[2] };
  return { code: "", rest: s };
};

const SUFFIX = /\((by [^)]+)\)\s*$/i;
const dimensions = (suffix) => {
  const key = suffix.toLowerCase().replace(/\s+/g, "_");
  return { voting_intention: "voting_intention" }[key] || key;
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Wave labels observed in sheets/subtitles: "Jan'19", "Apr’21", "July'26",
// "18-May-22", "9 June 2021", "9-22 Nov", "Nov 9-22", "1-7 Aug'22". Returns
// ISO (month-only -> first of month) or the label verbatim when it cannot be
// resolved to a full date.
function waveDate(label) {
  const s = clean(String(label ?? "").replace(/[\u2018\u2019]/g, "'").replace(/(\d+)(?:st|nd|rd|th)/gi, "$1"));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // "18-May-22" / "9 June 2021" — day-precision wave labels.
  m = s.match(/^(\d{1,2})\s*[-\u2013]\s*([A-Za-z]{3,})\.?\s*[-\u2013]?\s*'?(\d{2,4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  m = s.match(/^([A-Za-z]+)\.?\s*'?(\d{2,4})$/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    const y = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    return `${y}-${String(MONTHS[m[1].slice(0, 3).toLowerCase()]).padStart(2, "0")}-01`;
  }
  // "9-22 Nov", "Nov 9-22", "1-7 Aug 2022", "7-13 Jul'26": use the range end.
  m = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\.?\s*'?(\d{2,4})?$/) ||
      s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s*'?(\d{2,4})?$/);
  if (m) {
    const [a, b, c, d] = m.slice(1);
    const month = MONTHS[(isNaN(+a) ? a : c).slice(0, 3).toLowerCase()];
    const day = isNaN(+a) ? c : b;
    if (month) {
      const yr = d ? (d.length === 2 ? 2000 + +d : +d) : null;
      if (yr) return `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s*'?(\d{2,4})?$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] && m[3]) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return s;
}

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[%\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "";
};

const csvCell = (x) => {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const ROW_KEYS = ["dataset", "question_id", "question", "visual", "answer", "dimension", "key", "date", "value_pct", "parties"];
const rowToLine = (r) => ROW_KEYS.map(k => csvCell(r[k] ?? "")).join(",");
const parseLine = (line) => {
  const cells = [];
  let cell = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return Object.fromEntries(cells.map((v, i) => [ROW_KEYS[i], v]));
};

// A sheet row label "looks like a date" if waveDate resolves it to ISO.
const isIsoDateRow = (label) => /^\d{4}-\d{2}-\d{2}$/.test(waveDate(label));

const counters = { nonNumericCells: 0, verbatimDates: new Set(), emptySheets: 0, charts: 0, cards: 0 };

function rowsFromChart(viz, card) {
  const { code, rest } = parseName(viz.name || "");
  const sfx = (viz.name || "").match(SUFFIX)?.[1] || "";
  const visual = card.panel || (sfx ? sfx[0].toUpperCase() + sfx.slice(1) : "");
  const dimension = sfx ? dimensions(sfx.toLowerCase().trim().replace(/^by\s+/, "")) : "";
  const dataset = slug(card.cardTitle || viz.layout?.title || rest);
  const question = stripTags(viz.layout?.header_text || "") || rest;
  const question_id = code || String(card.id);
  const reportDate = card.reportDate ? card.reportDate.slice(0, 10) : "";
  const subDate = viz.layout?.subtitle ? waveDate(stripTags(viz.layout.subtitle)) : "";
  const fallbackDate = /^\d{4}-\d{2}-\d{2}$/.test(subDate) ? subDate : reportDate;
  const rows = [];
  const sheets = Object.entries(viz.data || {}).filter(([, v]) => Array.isArray(v) && v.length > 1);
  if (!sheets.length) { counters.emptySheets++; return rows; }
  counters.charts++;
  for (const [, sheet] of sheets) {
    const header = sheet[0].map(h => clean(h));
    for (const row of sheet.slice(1)) {
      const label = clean(row[0]);
      if (!label) continue;
      const dated = isIsoDateRow(label);
      const date = dated ? waveDate(label) : fallbackDate;
      const dim = dated ? (dimension || "") : (dimension || "item");
      const key = dated ? "" : label;
      if (dated && date === label) counters.verbatimDates.add(label);
      for (let c = 1; c < header.length; c++) {
        const answer = header[c];
        if (!answer) continue;
        const value = num(row[c]);
        if (value === "") { if (clean(row[c]) !== "" && clean(row[c]) !== "0%") counters.nonNumericCells++; continue; }
        rows.push({ dataset, question_id, question, visual, answer, dimension: dim, key, date, value_pct: value, parties: "" });
      }
    }
  }
  return rows;
}

try {
  const [reports, questions] = await Promise.all([listPosts("reports"), listPosts("questions")]);
  console.log(`site: ${reports.length} reports, ${questions.length} question pages`);

  // Crawl report pages (card structure) and question pages (bare embeds).
  // Individual page failures are tolerated (logged + counted in the status);
  // losing fresh rows would trip the merge-shrink guard on write.
  const reportCards = [];
  const zeroCard = [];
  const failedPages = [];
  const reportResults = await pool(reports, CONCURRENCY, async (r) => {
    try {
      const { text } = await getText(r.link);
      return { report: r, parsed: parseReportPage(text, r) };
    } catch (err) {
      failedPages.push(`${r.link} (${err.message.split(":").pop().trim()})`);
      return { report: r, parsed: { cards: [], anyEmbed: false } };
    }
  }, PAGE_MIN_GAP_MS);
  const cardHistogram = new Map();
  for (const { report, parsed } of reportResults) {
    cardHistogram.set(parsed.cards.length, (cardHistogram.get(parsed.cards.length) || 0) + 1);
    if (parsed.cards.length === 0) zeroCard.push(report.link);
    reportCards.push(...parsed.cards);
  }
  console.log("cards per report:", [...cardHistogram.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}x${c}`).join(" "));
  if (zeroCard.length) console.warn(`reports with no parsed cards (${zeroCard.length}): ${zeroCard.join(" ; ")}`);
  const qCards = [];
  await pool(questions, CONCURRENCY, async (q) => {
    try {
      const { text } = await getText(q.link);
      qCards.push(...parseQuestionPage(text, q));
    } catch (err) {
      failedPages.push(`${q.link} (${err.message.split(":").pop().trim()})`);
    }
  }, PAGE_MIN_GAP_MS);
  if (failedPages.length) console.warn(`failed pages (${failedPages.length}): ${failedPages.slice(0, 10).join(" ; ")}${failedPages.length > 10 ? " ..." : ""}`);

  const byId = new Map();
  for (const c of [...reportCards, ...qCards]) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  const cards = [...byId.values()];
  console.log(`embeds: ${reportCards.length} report-panel, ${qCards.length} question-page, ${cards.length} unique`);

  const failedFlourishes = [];
  const flourishes = (await pool(cards, FLOURISH_CONCURRENCY, async (c) => {
    try {
      const { text } = await getText(`https://public.flourish.studio/visualisation/${c.id}/visualisation.json`);
      return { card: c, viz: JSON.parse(text) };
    } catch (err) {
      failedFlourishes.push(`${c.id} (${err.message.split(":").pop().trim().slice(0, 80)})`);
      return null;
    }
  })).filter(Boolean);
  if (failedFlourishes.length) console.warn(`failed flourishes (${failedFlourishes.length}): ${failedFlourishes.slice(0, 10).join(" ; ")}${failedFlourishes.length > 10 ? " ..." : ""}`);

  const rowsOut = [];
  for (const { card, viz } of flourishes) rowsOut.push(...rowsFromChart(viz, card));

  // Merge: existing CSV rows (previous extractions) stay on top, new beneath.
  const header = ROW_KEYS.join(",");
  const existing = existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n") : [];
  const existingBody = existing[0] && existing[0].startsWith("dataset,") ? existing.slice(1) : [];
  const existingRows = existingBody.filter(Boolean).map(parseLine);

  const seen = new Set();
  const merged = [];
  for (const r of [...existingRows, ...rowsOut]) {
    const line = rowToLine(r);
    if (seen.has(line)) continue;
    seen.add(line);
    merged.push(r);
  }

  const output = [header, ...merged.map(rowToLine)].join("\n") + "\n";
  const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  const changed = previous !== output;

  if (changed && merged.length < existingRows.length && !FORCE) {
    console.error(`ESSENTIAL_GUARD merge would shrink ${OUT}: ${existingRows.length} -> ${merged.length} rows. Aborting (re-run with --force after review).`);
    process.exit(2);
  }

  if (CHECK) console.log(`--check: ${OUT} ${changed ? "would be updated" : "is already up to date"}`);
  else if (changed) {
    writeFileSync(OUT + ".tmp", output);
    renameSync(OUT + ".tmp", OUT);
    console.log(`updated ${OUT}: kept ${existingRows.length} existing rows, added ${rowsOut.length}, wrote ${merged.length} total (${existingRows.length + rowsOut.length - merged.length} dupes)`);
  } else console.log(`no change: ${OUT} unchanged (${merged.length} rows)`);

  // Report index for the assimilator: publish date -> wave page link. A
  // companion of the CSV rather than a column in it (the CSV schema stays
  // byte-compatible with the Resolve one), written whenever the index
  // drifts rather than only when the CSV did — a renamed slug otherwise
  // never lands. Raw `modified` isn't in the fetch fields, so date+link
  // pairs are the comparison; that's all the assimilator consumes.
  const INDEX = ".build/essential-src/report-index.json";
  const indexJson = JSON.stringify(
    Object.fromEntries(
      reports.map((r) => [r.date.slice(0, 10), r.link]).sort(([a], [b]) => a[0].localeCompare(b[0])),
    ),
    null, 2,
  ) + "\n";
  const indexChanged = !existsSync(INDEX) || readFileSync(INDEX, "utf8") !== indexJson;
  if (CHECK) {
    if (indexChanged) console.log(`--check: ${INDEX} would be updated`);
  } else if (indexChanged) {
    mkdirSync(".build/essential-src", { recursive: true });
    writeFileSync(INDEX + ".tmp", indexJson);
    renameSync(INDEX + ".tmp", INDEX);
    console.log(`updated ${INDEX}: ${reports.length} reports`);
  } else console.log(`no change: ${INDEX} unchanged (${reports.length} reports)`);

  const dates = [...new Set(rowsOut.map(r => r.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  console.log(`datasets: ${new Set(rowsOut.map(r => r.dataset)).size} | charts: ${counters.charts} | empty sheets skipped: ${counters.emptySheets} | non-numeric cells skipped: ${counters.nonNumericCells}`);
  console.log(`date labels kept verbatim (unparseable): ${counters.verbatimDates.size ? [...counters.verbatimDates].slice(0, 20).join("; ") : "none"}`);
  console.log("fresh dates:", dates[0], "->", dates.at(-1));

  // Newest report post by publish date — the skip-confirm agent
  // (.build/essential-confirm-skip.mjs) reads this as positive evidence that
  // the index was fetched and holds no release newer than a skipped slot.
  const latest = reports.reduce((a, r) => (a && Date.parse(a.date) > Date.parse(r.date) ? a : r), null);
  const latestReport = latest ? { date: latest.date, title: stripTags(latest.title?.rendered ?? latest.title ?? "") } : null;

  console.log(`ESSENTIAL_STATUS ${JSON.stringify({
    changed: changed && !CHECK,
    check: CHECK,
    reports: reports.length,
    question_pages: questions.length,
    failed_pages: failedPages.length,
    failed_flourishes: failedFlourishes.length,
    charts: counters.charts,
    rows_kept: existingRows.length,
    rows_fresh: rowsOut.length,
    rows_total: merged.length,
    datasets: new Set(rowsOut.map(r => r.dataset)).size,
    non_numeric_skipped: counters.nonNumericCells,
    verbatim_dates: counters.verbatimDates.size,
    new_dates: previous === null ? dates : dates.filter(d => !existingBody.some(l => l.includes(`,${d},`))),
    latest_report_date: latestReport ? latestReport.date : null,
    latest_report_title: latestReport ? latestReport.title : null,
  })}`);
} catch (err) {
  console.error(`ESSENTIAL_ERROR ${err.message}`);
  process.exit(1);
}
