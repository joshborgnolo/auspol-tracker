#!/usr/bin/env node
/* Roy Morgan Most Important Problem / issue-salience historical read-model.

   Offline regeneration is the default. --fetch-sources refreshes the pinned
   Next.js payloads under .build/roymorgan-issues-src; --discover performs the
   separate 262-page findings-index discovery pass. Neither a PNG line chart
   nor narrative prose is promoted into an invented time series.

   The two question families are deliberately separate:
     * one open-ended nomination for Australia and, independently, the World;
     * an unranked pick-three elector issue list (June Q2022 / September Q2024).

   Every source table keeps its printed labels, headings and cell notation.
   A number is numeric; a star, dash, n/a and a literally empty cell are four
   different observations and none is silently converted to zero. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = process.env.ROYMORGAN_ISSUES_SRC ? path.resolve(process.env.ROYMORGAN_ISSUES_SRC) : path.join(HERE, "roymorgan-issues-src");
const OUT = process.env.ROYMORGAN_ISSUES_OUT ? path.resolve(process.env.ROYMORGAN_ISSUES_OUT) : path.join(ROOT, "data", "roymorgan-issues.json");
export const FEED_URL = "https://wp.roymorgan.com/wp-json/rmr/v1/findings-search?sort_by=date";
export const AUSTRALIA_QUESTION = "What do you think is the most important problem facing Australia today?";
export const WORLD_QUESTION = "What do you think is the most important problem facing the World today?";
export const PICK_THREE_QUESTION = "Which three issues are the most important to you?";
const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const BASE = "https://www.roymorgan.com/findings/";
const def = (finding, slug, availability, extra = {}) => ({ finding, slug, url: BASE + slug, availability, ...extra });
export const SOURCE_DEFS = [
  def(6059, "economic-issues-still-biggest-problems-facing-australia-38-but-terrorism-wars-security-issues-easily-biggest-problems-facing-the-world-43-after-french-atrocity-charlie-hebdo", "html-mip-tables", { expectedTables: 4 }),
  def(7187, "economic-issues-led-by-unemployment-and-the-economy-easily-the-most-important-problems-facing-turnbull-government-in-australia-while-economic-environmental-issues", "html-mip-tables", { expectedTables: 4 }),
  def(7264, "economic-issues-unemployment-and-the-economy-top-the-list-of-concerns-for-australians-in-mid-2017", "html-economic-breakdown", { expectedTables: 1 }),
  def(7424, "cost-of-living-unemployment-poverty-big-issues-before-federal-budget", "html-economic-breakdown", { expectedTables: 1 }),
  def(7504, "economic-issues-dominate-australians-problems-in-2018", "png-only", { expectedTables: 0 }),
  def(8044, "australians-see-the-environment-as-the-worlds-biggest-problem-but-in-australia-its-the-economy", "png-only", { expectedTables: 0 }),
  def(8184, "environmental-issues-seen-as-the-biggest-problem-facing-australia-for-the-first-time-since-february-2011", "png-only", { expectedTables: 0 }),
  def(8829, "covid-19-is-the-most-important-problem-facing-the-world-and-australia-just-ahead-of-global-warming-climate-change", "png-only-2021-report", {
    expectedTables: 0,
    reportRole: "Known 2021 annual report release: PDF and three PNG charts, including Australia and World long-run charts for 2005-2021; no complete machine-readable long-run table is published in the producer post.",
  }),
  def(9797, "9797-most-important-issues-facing-australia-january-2025", "png-pick-three-plus-printed-changes", {
    expectedTables: 0,
    chartUrl: "https://roymorgan-cms-prod.s3.ap-southeast-2.amazonaws.com/wp-content/uploads/2025/01/23004510/9797-c1.png",
  }),
];

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const sourceFile = (finding, suffix) => `finding-${finding}.${suffix}`;
const dmyToIso = (s) => {
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function atomic(file, data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, file);
  return true;
}
const jsonText = (x) => JSON.stringify(x, null, 2) + "\n";
async function getBuffer(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker historical source archive)" },
        redirect: "follow", signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      last = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw new Error(`${url}: ${last?.message || last}`);
}

export function nextData(html, what = "release") {
  const match = String(html).match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`no __NEXT_DATA__ in ${what}`);
  const data = JSON.parse(match[1]);
  const post = data?.props?.pageProps?.findingData?.postBy;
  if (!post || typeof post.content !== "string") throw new Error(`no findingData.postBy.content in ${what}`);
  return data;
}
export function postOf(data) {
  return data.props.pageProps.findingData.postBy;
}
function decodeEntities(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(+lower.slice(1));
    return Object.hasOwn(named, lower) ? named[lower] : whole;
  });
}
export function cleanHtml(html) {
  return decodeEntities(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}
function tableRows(table) {
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => ({
      text: cleanHtml(cell[2]), attrs: cell[1], strong: /<strong\b/i.test(cell[2]),
    })));
}
function texts(rows) { return rows.map((row) => row.map((cell) => cell.text)); }
function periodOf(label) {
  const clean = String(label).replace(/\s+/g, " ").trim();
  const m = clean.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Sept?|September|Aug(?:ust)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})$/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return { label: clean, month: `${m[2]}-${String(month).padStart(2, "0")}`, basis: "month" };
}
export function parseCell(raw) {
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (text === "") return { raw: text, kind: "blank", share: null };
  if (text === "*") return { raw: text, kind: "less-than-1", share: null, upperBound: 1 };
  if (/^[–—-]$/.test(text)) return { raw: text, kind: "dash", share: null };
  if (/^n\/?a$/i.test(text)) return { raw: text, kind: "not-applicable", share: null };
  let m = text.match(/^<\s*(\d+(?:\.\d+)?)\s*%?$/);
  if (m) return { raw: text, kind: "less-than", share: null, upperBound: +m[1] };
  m = text.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (m) {
    const share = +m[1];
    if (share < 0 || share > 100) throw new Error(`out-of-range issue share ${text}`);
    return { raw: text, kind: "number", share };
  }
  throw new Error(`unrecognised issue cell ${JSON.stringify(text)}`);
}
function rowKind(label) {
  if (label === "TOTAL") return "grand-total";
  if (/^Comprising of the below/i.test(label)) return "annotation";
  if (/TOTAL/i.test(label)) return "printed-subtotal";
  return "issue";
}
function tableChecks(table) {
  const numeric = (row, column) => {
    const cell = row?.cells[column];
    return cell?.kind === "number" ? cell.share : null;
  };
  const result = { totalRowResiduals: [], aggregateResiduals: [], economicTotalResiduals: [] };
  const total = table.rows.find((row) => row.label === "TOTAL");
  if (total) {
    table.columns.forEach((column, i) => {
      const value = numeric(total, i);
      if (value == null || Math.abs(value - 100) > 0.001) throw new Error(`${table.id}: ${column.heading} TOTAL is ${value}`);
      result.totalRowResiduals.push({ column: i, residual: +(value - 100).toFixed(6) });
    });
    const topLabels = new Set(table.rows.filter((row) => /^TOTAL /i.test(row.label) && !/^\(SUB TOTAL\)/i.test(row.label)).map((row) => row.label));
    // 7187's World table prints its government composite without a TOTAL prefix.
    if (!table.rows.some((row) => /^TOTAL Government/i.test(row.label))) topLabels.add("Politics/ Political system/ Leadership (Donald Trump)");
    topLabels.add("Other");
    topLabels.add("Can’t say");
    const parts = table.rows.filter((row) => topLabels.has(row.label));
    if (parts.length >= 4) {
      table.columns.forEach((column, i) => {
        const values = parts.map((row) => numeric(row, i));
        if (values.some((v) => v == null)) return; // a dash/star is not zero: no forced reconstruction
        const reconstructed = +values.reduce((a, b) => a + b, 0).toFixed(6);
        const residual = +(reconstructed - numeric(total, i)).toFixed(6);
        if (Math.abs(residual) > 2.01) throw new Error(`${table.id}: ${column.heading} aggregate rows sum ${reconstructed}, TOTAL ${numeric(total, i)}`);
        result.aggregateResiduals.push({ column: i, reconstructed, residual });
      });
    }
  }
  const finding = table.finding;
  if (finding === 7264 || finding === 7424) {
    const partLabels = finding === 7264
      ? ["Unemployment", "The Economy in general and Interest rates", "Housing affordability", "Poverty and the gap between rich and poor", "Cost of living, rising prices and inflation", "Federal Budget", "Homelessness and lack of housing", "Total Other Economic Issues"]
      : ["TOTAL Financial problems, economy and cost of living comprising of:", "Unemployment", "Poverty and the gap between rich and poor", "Homelessness and lack of housing", "Foreign ownership & investment and selling our assets", "TOTAL Other Economic Issues"];
    const printed = table.rows.find((row) => row.label === "TOTAL ECONOMIC/ FINANCIAL ISSUES");
    if (!printed) throw new Error(`${table.id}: missing economic total`);
    table.columns.forEach((column, i) => {
      const values = partLabels.map((label) => {
        const row = table.rows.find((r) => r.label === label);
        if (!row) throw new Error(`${table.id}: missing sum component ${label}`);
        return numeric(row, i);
      });
      const totalValue = numeric(printed, i);
      // A printed dash is not a zero. Reconcile only columns for which the
      // source prints every component and the total as numeric cells.
      if (totalValue == null || values.some((v) => v == null)) return;
      const reconstructed = +values.reduce((a, b) => a + b, 0).toFixed(6);
      const residual = +(reconstructed - totalValue).toFixed(6);
      // Independent one-decimal rounding of each printed component can
      // accumulate; do not rewrite the publisher's figures to hide it.
      const roundingTolerance = (partLabels.length + 1) * 0.05 + 1e-6;
      if (Math.abs(residual) > roundingTolerance) throw new Error(`${table.id}: ${column.heading} economic rows sum ${reconstructed}, printed ${totalValue}`);
      result.economicTotalResiduals.push({ column: i, reconstructed, residual, roundingTolerance });
    });
  }
  return result;
}
function parseMipTable(rows, finding, sourceTableIndex) {
  const plain = texts(rows);
  const first = plain[0] || [];
  const heading = first[0] || "";
  const firstText = plain.flat().join(" | ");
  const economic = plain.some((row) => row[0] === "TOTAL ECONOMIC/ FINANCIAL ISSUES") && /VOTING INTENTION/i.test(firstText);
  const mip = /^Most Important Problem Facing (?:Australia|the World)$/i.test(heading) || (heading === "Australia" && plain[1]?.some((x) => /Sex/i.test(x)));
  if (!economic && !mip) return null;
  const scope = /World/i.test(first.join(" ")) ? "World" : "Australia";
  const periodsInSecond = (plain[1] || []).map(periodOf).filter(Boolean);
  const kind = economic ? "economic-vote-breakdown" : periodsInSecond.length > 1 ? "national-trend" : `${scope === "World" ? "world" : "australia"}-breakdown`;
  let columns = [], dataStart;
  if (economic) {
    const period = periodOf(first[0]);
    const voteLabels = plain[1].filter(Boolean);
    if (!period || voteLabels.length !== 5) throw new Error(`${finding} table ${sourceTableIndex}: bad economic header`);
    columns = ["Australia", ...voteLabels].map((heading) => ({ heading, dimension: heading === "Australia" ? "Australia" : "VOTING INTENTION", period }));
    dataStart = 3;
  } else if (kind === "national-trend") {
    const population = first[1] || (scope === "World" ? "The World" : "Australia");
    columns = periodsInSecond.map((period) => ({ heading: period.label, dimension: population, period }));
    dataStart = 3;
  } else {
    const period = periodsInSecond[0];
    if (!period) throw new Error(`${finding} table ${sourceTableIndex}: no breakdown period`);
    const headings = (plain[2] || []).filter(Boolean);
    const expected = kind.endsWith("breakdown") && headings.includes("Men") ? 3 : 9;
    if (headings.length + 1 !== expected) throw new Error(`${finding} table ${sourceTableIndex}: unexpected breakdown header ${JSON.stringify(plain.slice(0, 4))}`);
    const parentHeadings = plain[1];
    const groupFor = (heading) => {
      if (heading === "Men" || heading === "Women") return "Sex";
      if (["NSW", "VIC", "QLD", "WA", "SA", "TAS#"].includes(heading)) return "STATES";
      if (["CITY", "COUNTRY"].includes(heading)) return "CITY/COUNTRY";
      return scope === "World" ? "The World" : "Australia";
    };
    columns = [{ heading: period.label, dimension: scope === "World" ? "The World" : "Australia", period },
      ...headings.map((heading) => ({ heading, dimension: groupFor(heading), parentHeadings, period }))];
    dataStart = 4;
  }
  const dataRows = plain.slice(dataStart);
  const parsedRows = dataRows.map((row, i) => {
    const label = row[0] ?? "";
    const rawCells = row.slice(1);
    if (rawCells.length !== columns.length) throw new Error(`${finding} table ${sourceTableIndex} row ${dataStart + i} (${label}): ${rawCells.length} cells for ${columns.length} columns`);
    return { sourceRow: dataStart + i, label, kind: rowKind(label), cells: rawCells.map(parseCell) };
  });
  const id = `${finding}-table-${sourceTableIndex}`;
  const table = {
    id, finding, sourceTableIndex, family: "open-nomination", heading, scope, kind,
    population: first[1] || (scope === "World" ? "The World" : "Australia"),
    sourceHeaderRows: plain.slice(0, dataStart), columns, rows: parsedRows,
  };
  table.checks = tableChecks(table);
  return table;
}
export function parseSourceTables(content, finding) {
  const tables = [...String(content).matchAll(/<table[\s\S]*?<\/table>/gi)];
  const parsed = [];
  tables.forEach((match, index) => {
    const table = parseMipTable(tableRows(match[0]), finding, index);
    if (table) parsed.push(table);
  });
  return parsed;
}

// Direct transcription of the two printed series in 9797-c1.png. These are
// source evidence, not estimates. parsePickThree independently reconciles all
// ten September 2024 shares and every printed change with the release prose.
const PICK_THREE_CHART = [
  ["Keeping day to day living costs down", "Keeping day-to-day living costs down", 50, 57, "up", 7],
  ["Improving health services and hospitals", "Improving health services and hospitals", 33, 31, "down", 2],
  ["Reducing crime and maintaining law and order", "Reducing crime and maintaining law and order", 13, 23, "up", 10],
  ["Global warming and climate change", "Global warming and climate change", 32, 23, "down", 9],
  ["Managing the economy", "Managing the economy", 20, 22, "up", 2],
  ["Keeping interest rates down", "Keeping interest rates down", 11, 19, "up", 8],
  ["Open and honest government", "Open and honest government", 25, 19, "down", 6],
  ["Reducing the taxes you and your family pay", "Reducing the taxes you and your family pay", 15, 15, "steady", 0],
  ["Improving education", "Improving education", 13, 14, "up", 1],
  ["Managing immigration and population growth", "Managing immigration and population growth", 6, 14, "up", 8],
];
export function parsePickThree(content) {
  const text = cleanHtml(content);
  const lead = text.split("Top 10 voter Issues")[0];
  const changes = PICK_THREE_CHART.map(([label, proseLabel, june, september, direction, points]) => {
    if (direction === "steady") {
      const match = lead.match(new RegExp(`${esc(proseLabel)}[\\s\\S]{0,130}?holds steady at\\s+(\\d+)%`, "i"));
      if (!match || +match[1] !== september || june !== september) throw new Error(`9797: steady reading does not reconcile for ${label}`);
    } else {
      const verb = direction === "up" ? "(?:up|jumping|surging)" : "down";
      const match = lead.match(new RegExp(`${esc(proseLabel)}[\\s\\S]{0,150}?${verb}\\s+(\\d+)%\\s*(?:points?|point)\\s+to\\s+(\\d+)%`, "i"));
      if (!match) throw new Error(`9797: missing printed change for ${label}`);
      if (+match[1] !== points || +match[2] !== september) throw new Error(`9797: chart/prose mismatch for ${label}`);
    }
    const expectedJune = direction === "down" ? september + points : direction === "up" ? september - points : september;
    if (expectedJune !== june) throw new Error(`9797: June chart value does not reconcile for ${label}`);
    return { label, direction, points, signedPoints: direction === "down" ? -points : direction === "up" ? points : 0, printed: direction === "steady" ? "-" : `${direction} ${points}%` };
  });
  const period = (label, id, startMonth, endMonth, sample) => ({ label, id, basis: "quarter", startMonth, endMonth, sample });
  const june = period("June Quarter 2022", "2022-Q2", "2022-04", "2022-06", 14522);
  const september = period("September Quarter 2024", "2024-Q3", "2024-07", "2024-09", 14713);
  const issues = (index) => PICK_THREE_CHART.map((row) => ({ label: row[0], share: row[index] }));
  return {
    heading: "Top 10 voter Issues of Most Importance June Quarter 2022, to September Quarter 2024 (change since the 2022 Federal Election)",
    population: "Australians Electors 18+", scope: "Australia",
    waves: [
      { period: june, sample: 14522, issues: issues(2) },
      { period: september, sample: 14713, issues: issues(3) },
    ],
    changes: { from: june.id, to: september.id, issues: changes },
  };
}

function surveyMeta(content, finding) {
  const text = cleanHtml(content);
  let sample = null, fieldwork = null, mode = null;
  let match;
  if (finding === 6059 && (match = text.match(/cross-section of ([\d,]+) men and women aged 14 or over were interviewed by telephone on the nights of ([^.]+)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = match[2]; mode = "telephone";
  } else if (finding === 7187 && (match = text.match(/research interviewed ([\d,]+) Australians in (mid-March 2017)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = match[2];
  } else if ((finding === 7264 || finding === 7424) && (match = text.match(/representative cross-section of ([\d,]+) Australians in ((?:May 2017|February 2018))/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = match[2];
  } else if (finding === 7504 && (match = text.match(/representative cross-section of ([\d,]+) Australians in (February 2018)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = text.match(/conducted in Australia, during (February 6-8, 2018)/i)?.[1] || match[2];
  } else if (finding === 8044 && (match = text.match(/representative cross-section of ([\d,]+) Australians in (June 2019)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = match[2];
  } else if (finding === 8184 && (match = text.match(/representative cross-section of ([\d,]+) Australians in (October 2019)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = "mid-October 2019"; mode = "online";
  } else if (finding === 8829 && (match = text.match(/representative cross-section of ([\d,]+) Australians in (September 2021)/i))) {
    sample = +match[1].replace(/,/g, ""); fieldwork = text.match(/conducted in Australia, during (September 15-20, 2021)/i)?.[1] || match[2];
  }
  return { sample, fieldwork, mode };
}
function sourceMetadata(def, post) {
  return {
    finding: def.finding, releaseDate: dmyToIso(post.findings?.releaseDate), releaseDatePrinted: post.findings?.releaseDate || null,
    cmsDate: post.date || null, title: cleanHtml(post.title), slug: def.slug, url: def.url, availability: def.availability,
    reportRole: def.reportRole || null, pdfUrl: post.findings?.pdfDownload?.mediaItemUrl || null,
    imageUrls: [...post.content.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)].map((m) => m[1]),
    ...surveyMeta(post.content, def.finding),
  };
}
function discoverCandidate(row) {
  return /most important (?:problem|issue)|biggest problem|problems facing|issues facing|economic issues|environmental issues seen|cost.of.living, unemployment|top 10.*issues/i.test(`${row.title} ${row.summary || ""}`);
}

async function fetchSources() {
  fs.mkdirSync(SRC, { recursive: true });
  const feedResponse = await fetch(`${FEED_URL}&page=1`, { signal: AbortSignal.timeout(45_000) });
  if (!feedResponse.ok) throw new Error(`feed HTTP ${feedResponse.status}`);
  const first = Buffer.from(await feedResponse.arrayBuffer());
  const firstRows = JSON.parse(first.toString("utf8"));
  if (!Array.isArray(firstRows)) throw new Error("findings feed changed shape");
  const totalPages = +(feedResponse.headers.get("x-wp-totalpages") || 0);
  if (totalPages !== 262) throw new Error(`findings feed now has ${totalPages} pages; review discovery before extending the archive`);
  const sources = [];
  for (const definition of SOURCE_DEFS) {
    const html = (await getBuffer(definition.url)).toString("utf8");
    const next = nextData(html, definition.url);
    const post = postOf(next);
    const finding = +post.findings?.findingNumber;
    if (finding !== definition.finding || post.slug !== definition.slug) throw new Error(`finding identity mismatch at ${definition.url}`);
    const nextCapture = sourceFile(definition.finding, "next.json");
    const contentCapture = sourceFile(definition.finding, "content.html");
    const tablesCapture = sourceFile(definition.finding, "tables.json");
    atomic(path.join(SRC, nextCapture), jsonText(next));
    atomic(path.join(SRC, contentCapture), post.content);
    const tables = parseSourceTables(post.content, definition.finding);
    if (tables.length !== definition.expectedTables) throw new Error(`${definition.finding}: expected ${definition.expectedTables} data tables, got ${tables.length}`);
    atomic(path.join(SRC, tablesCapture), jsonText(tables));
    let pickThree = null;
    if (definition.finding === 9797) {
      pickThree = parsePickThree(post.content);
      atomic(path.join(SRC, sourceFile(9797, "pick-three.json")), jsonText(pickThree));
      const chart = await getBuffer(definition.chartUrl);
      atomic(path.join(SRC, "9797-c1.png"), chart);
    }
    const metadata = sourceMetadata(definition, post);
    sources.push({
      ...metadata,
      nextCapture, contentCapture, tablesCapture,
      nextSha256: sha256(fs.readFileSync(path.join(SRC, nextCapture))),
      contentSha256: sha256(fs.readFileSync(path.join(SRC, contentCapture))),
      tablesSha256: sha256(fs.readFileSync(path.join(SRC, tablesCapture))),
      ...(pickThree ? { pickThreeCapture: sourceFile(9797, "pick-three.json"), pickThreeSha256: sha256(fs.readFileSync(path.join(SRC, sourceFile(9797, "pick-three.json")))), chartCapture: "9797-c1.png", chartSha256: sha256(fs.readFileSync(path.join(SRC, "9797-c1.png"))) } : {}),
    });
  }
  const index = { schemaVersion: 1, producerPath: "__NEXT_DATA__.props.pageProps.findingData.postBy.content", feed: { url: FEED_URL, totalPages, rowsPerPage: firstRows.length }, sources };
  atomic(path.join(SRC, "source-index.json"), jsonText(index));
  return index;
}

export function discoverFindings(src = SRC) {
  const file = path.join(src, "discovery.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
async function discover() {
  const response = await fetch(`${FEED_URL}&page=1`, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`feed HTTP ${response.status}`);
  const totalPages = +(response.headers.get("x-wp-totalpages") || 0);
  if (totalPages !== 262) throw new Error(`expected the verified 262 findings pages, got ${totalPages}`);
  let nextPage = 1, rowsScanned = 0;
  const candidates = [];
  async function worker() {
    for (;;) {
      const page = nextPage++;
      if (page > totalPages) return;
      const body = await getBuffer(`${FEED_URL}&page=${page}`);
      const rows = JSON.parse(body.toString("utf8"));
      if (!Array.isArray(rows)) throw new Error(`feed page ${page} is not an array`);
      rowsScanned += rows.length;
      for (const row of rows) if (discoverCandidate(row)) candidates.push({
        page, finding: +row.finding_number, releaseDate: dmyToIso(row.release_date), title: row.title, slug: row.slug,
        matchedFinding: SOURCE_DEFS.some((d) => d.finding === +row.finding_number),
      });
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  candidates.sort((a, b) => `${a.releaseDate}|${a.finding}`.localeCompare(`${b.releaseDate}|${b.finding}`));
  const present = new Set(candidates.map((row) => row.finding));
  const missing = SOURCE_DEFS.filter((d) => !present.has(d.finding)).map((d) => d.finding);
  if (missing.length) throw new Error(`discovery filter missed pinned releases ${missing.join(", ")}`);
  const result = {
    schemaVersion: 1, feed: FEED_URL, totalPages, rowsScanned,
    method: "Findings-index titles/summaries were scanned first; only matched Australian issue releases were opened and classified by their producer postBy.content. No intermediate PNG chart was converted into tabular observations.",
    selected: SOURCE_DEFS.map((d) => ({ finding: d.finding, availability: d.availability })),
    candidates,
  };
  atomic(path.join(SRC, "discovery.json"), jsonText(result));
  return result;
}

function rowOccurrences(table) {
  const counts = new Map(), map = new Map();
  for (const row of table.rows) {
    const count = (counts.get(row.label) || 0) + 1;
    counts.set(row.label, count);
    map.set(`${row.label}#${count}`, row);
  }
  return map;
}
function reprintDifferences(older, newer) {
  const a = rowOccurrences(older.table), b = rowOccurrences(newer.table), differences = [];
  for (const [key, oldRow] of a) {
    const newRow = b.get(key);
    if (!newRow) continue;
    const before = oldRow.cells[older.column], after = newRow.cells[newer.column];
    if (!before || !after) continue;
    if (before.kind !== after.kind || before.share !== after.share) differences.push({ row: key, earlier: before, later: after });
  }
  return differences;
}
function buildNationalPeriods(tables, sources) {
  const byScopeMonth = new Map();
  const sourceByFinding = new Map(sources.map((s) => [s.finding, s]));
  for (const table of tables.filter((t) => t.kind === "national-trend")) {
    table.columns.forEach((column, columnIndex) => {
      const key = `${table.scope}|${column.period.month}`;
      if (!byScopeMonth.has(key)) byScopeMonth.set(key, []);
      byScopeMonth.get(key).push({ finding: table.finding, tableId: table.id, column: columnIndex, releaseDate: sourceByFinding.get(table.finding).releaseDate });
    });
  }
  return [...byScopeMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, refs]) => {
    refs.sort((a, b) => `${a.releaseDate}|${a.tableId}|${a.column}`.localeCompare(`${b.releaseDate}|${b.tableId}|${b.column}`));
    const [scope, month] = key.split("|");
    const latest = refs.at(-1);
    const tableById = new Map(tables.map((table) => [table.id, table]));
    const differences = [];
    for (const ref of refs.slice(0, -1)) differences.push(...reprintDifferences(
      { table: tableById.get(ref.tableId), column: ref.column },
      { table: tableById.get(latest.tableId), column: latest.column },
    ).map((d) => ({ earlierFinding: ref.finding, ...d })));
    const column = tableById.get(latest.tableId).columns[latest.column];
    return {
      scope, period: column.period, read: latest, reprints: refs.slice(0, -1),
      ...(differences.length ? { reprintDifferences: differences } : {}),
    };
  });
}

export function buildStore(src = SRC) {
  const indexPath = path.join(src, "source-index.json");
  if (!fs.existsSync(indexPath)) throw new Error(`missing ${indexPath}; run --fetch-sources first`);
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (index.schemaVersion !== 1) throw new Error("unsupported source-index schema");
  const sources = [], tables = [];
  let pickThree = null;
  for (const source of index.sources) {
    const next = JSON.parse(fs.readFileSync(path.join(src, source.nextCapture), "utf8"));
    const content = fs.readFileSync(path.join(src, source.contentCapture), "utf8");
    const contentCache = fs.readFileSync(path.join(src, source.tablesCapture), "utf8");
    if (sha256(fs.readFileSync(path.join(src, source.nextCapture))) !== source.nextSha256 || sha256(content) !== source.contentSha256 || sha256(contentCache) !== source.tablesSha256) throw new Error(`${source.finding}: cached source hash moved`);
    if (postOf(next).content !== content) throw new Error(`${source.finding}: Next payload/content capture differ`);
    const parsed = parseSourceTables(content, source.finding);
    if (JSON.stringify(parsed) !== JSON.stringify(JSON.parse(contentCache))) throw new Error(`${source.finding}: parsed table cache is stale`);
    tables.push(...parsed);
    if (source.finding === 9797) {
      pickThree = parsePickThree(content);
      const cache = JSON.parse(fs.readFileSync(path.join(src, source.pickThreeCapture), "utf8"));
      if (JSON.stringify(cache) !== JSON.stringify(pickThree)) throw new Error("9797: pick-three cache is stale");
      if (sha256(fs.readFileSync(path.join(src, source.chartCapture))) !== source.chartSha256) throw new Error("9797: chart capture hash moved");
    }
    sources.push({ ...source });
  }
  const tableOrder = new Map(sources.map((s, i) => [s.finding, i]));
  tables.sort((a, b) => tableOrder.get(a.finding) - tableOrder.get(b.finding) || a.sourceTableIndex - b.sourceTableIndex);
  const discovery = discoverFindings(src);
  const nationalPeriods = buildNationalPeriods(tables, sources);
  const periodsFor = (scope) => nationalPeriods.filter((row) => row.scope === scope).map((row) => row.period.month);
  const pngSources = sources.filter((s) => s.availability.startsWith("png-only"));
  return {
    schemaVersion: 1,
    pollster: "Roy Morgan",
    generatedBy: ".build/extract-roymorgan-issues.mjs",
    families: {
      openNomination: {
        id: "most-important-problem-open-nomination",
        responseMode: "One open-ended nomination; verbatim responses coded by Roy Morgan and reported as percentages",
        questions: { Australia: AUSTRALIA_QUESTION, World: WORLD_QUESTION },
        units: "percent",
        notation: {
          "less-than-1": "* means Less than 1%; share is null and upperBound is 1, never an invented point estimate",
          dash: "A printed dash is retained as dash, not zero",
          blank: "A literally empty publisher cell is distinct from a printed dash",
          "not-applicable": "n/a is retained verbatim and is not replaced by zero",
        },
        tables,
        nationalPeriods,
      },
      pickThree: {
        id: "most-important-issues-pick-three-unranked",
        responseMode: "Pick three issues; no ranks",
        question: PICK_THREE_QUESTION,
        units: "percent naming an issue",
        ...pickThree,
        publishedUniverse: "The release's Top 10 list only; no unprinted issue shares or ranks are reconstructed",
      },
    },
    sources,
    coverage: {
      discovery: discovery ? { totalPages: discovery.totalPages, rowsScanned: discovery.rowsScanned, candidates: discovery.candidates.length } : null,
      htmlTableFindings: sources.filter((s) => s.availability.startsWith("html-")).map((s) => s.finding),
      tableCount: tables.length,
      nationalPeriods: {
        Australia: { printed: periodsFor("Australia"), first: periodsFor("Australia")[0] || null, last: periodsFor("Australia").at(-1) || null },
        World: { printed: periodsFor("World"), first: periodsFor("World")[0] || null, last: periodsFor("World").at(-1) || null },
      },
      economicBreakdownPeriods: tables.filter((t) => t.kind === "economic-vote-breakdown").map((t) => t.columns[0].period.month),
      pickThreePeriods: pickThree.waves.map((w) => ({ id: w.period.id, label: w.period.label, startMonth: w.period.startMonth, endMonth: w.period.endMonth, sample: w.sample })),
      limits: [
        "The national open-nomination index contains only the printed table months from January 2013 to March 2017. No monthly observations are interpolated between them.",
        "The May 2017 and February 2018 economic-by-vote tables are breakdowns, not additional complete Australia/World MIP waves.",
        "The older long-run 2005-2021 releases publish PNG line charts and selected narrative readings, not complete machine-readable tables. Their source/PDF metadata is retained but their pixels and prose are not converted into monthly issue values or thresholds.",
        "The known 2021 annual report release (finding 8829) therefore contributes provenance and its stated September 2021 fieldwork metadata, not a reconstructed time series.",
        "Release-level sample/fieldwork metadata describes that release's current interviewing period and is not back-propagated to every historical column in a reprinted trend table.",
        "January 2025 is a separate unranked pick-three family with only its printed Top 10 list; it is never merged with the single open-nomination family.",
        ...pngSources.map((s) => `Finding ${s.finding}: ${s.imageUrls.length} PNG chart(s) and ${s.pdfUrl ? "a linked PDF" : "no linked PDF"}; no complete source HTML table.`),
      ],
    },
  };
}
function readIndexForStatus() {
  const file = path.join(SRC, "source-index.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { sources: [] };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--fetch-sources")) {
    const index = await fetchSources();
    console.log("RM_ISSUES_SOURCES " + JSON.stringify({ sources: index.sources.length, tables: index.sources.reduce((n, s) => n + (s.availability.startsWith("html-") ? 1 : 0), 0) }));
    return;
  }
  if (args.includes("--discover")) {
    const found = await discover();
    console.log("RM_ISSUES_DISCOVERY " + JSON.stringify({ pages: found.totalPages, rows: found.rowsScanned, candidates: found.candidates.length }));
    return;
  }
  const store = buildStore();
  const rendered = jsonText(store), old = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  const changed = old !== rendered;
  if (args.includes("--check")) {
    if (changed) throw new Error(`${OUT} is stale; regenerate Roy Morgan issues data`);
  } else if (changed) atomic(OUT, rendered);
  console.log("RM_ISSUES_STATUS " + JSON.stringify({ changed, sources: store.sources.length, tables: store.coverage.tableCount, nationalPeriods: store.families.openNomination.nationalPeriods.length, pickThreeWaves: store.families.pickThree.waves.length }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); }
  catch (error) { console.error(`RM_ISSUES_ERROR ${error.stack || error}`); process.exitCode = 1; }
}
