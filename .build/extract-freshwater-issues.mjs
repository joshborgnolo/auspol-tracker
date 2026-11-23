#!/usr/bin/env node
/**
 * Build the standalone Freshwater Strategy / AFR issue-battery archive from
 * cached, official Datawrapper payloads. No network is used and no polls.json
 * row is read or written. `dataset.csv` is a name, not a delimiter promise:
 * these downloads are TSV and are split on literal tabs, never on commas.
 *
 * Run: node .build/extract-freshwater-issues.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const CACHE = path.join(HERE, "freshwater-issues-src");
export const OUTPUT = path.join(ROOT, "data", "freshwater-issues.json");
const DW = "https://datawrapper.dwcdn.net";

export const SPECS = Object.freeze({
  importance: [
    ["2023-12", "ehv1e"],
    ["2024-01", "JiZHI"],
    ["2024-02", "XHdnx"],
    ["2024-03", "fdR4U"],
    ["2024-09", "jhkQi"],
    ["2024-10", "QpC8O"],
    ["2024-11", "KUCk7"],
    ["2025-01", "4VjBV"],
  ],
  management: [
    ["2024-03", "VkN0B"],
    ["2024-04", "bn29c"],
    ["2024-05", "0BAz2"],
    ["2024-06", "l5lbz"],
    ["2024-07", "ATB3r"],
    ["2024-08", "PWs3v"],
    ["2024-09", "xaKtG"],
    ["2024-10", "7GwBO"],
    ["2024-11", "vc831"],
    ["2024-12", "Ase3I"],
    ["2025-01", "zexaY"],
  ],
  netLead: [
    ["2024-02", "ePE81"],
    ["2024-03", "aTbi4"],
  ],
});

const MANAGEMENT_OPTIONS = [
  "Albanese-led Labor government",
  "Neither / Unsure",
  "Dutton-led Coalition government",
];
const MISSING_BATTERIES = ["2023-05", "2023-09", "2025-02"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ISSUE_ID = new Map(Object.entries({
  "Cost of & standard of living": "cost-of-living",
  "Cost & standard of living": "cost-of-living",
  "The cost & standard of living": "cost-of-living",
  "The cost of & standards of living": "cost-of-living",
  "Housing & accommodation": "housing",
  "Health & social care": "health",
  "Managing the economy": "economy",
  "The environment & climate change": "environment",
  "The environment": "environment",
  "Crime & social order": "crime",
  "Tax & government spending": "tax",
  "Immigration & asylum": "immigration",
  "Job security & unemployment": "jobs",
  "Job security and unemployment": "jobs",
  "Welfare & benefits": "welfare",
  "Defence & national security": "defence",
  "Defence and national security": "defence",
  "Education & training": "education",
  "Roads & transport": "roads",
  "Family & community": "family",
  "Strikes & union-led industrial action": "strikes",
  "Indigenous affairs": "indigenous",
  Other: "other",
}));
const STANDARD_ISSUES = new Set([
  "cost-of-living", "housing", "health", "economy", "environment", "crime",
  "tax", "immigration", "jobs", "welfare", "defence", "education", "roads",
  "family", "strikes",
]);

function read(dir, file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) throw new Error(`Missing cached Freshwater source: ${full}`);
  return fs.readFileSync(full, "utf8");
}

function decodeHtml(s) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, code) => {
    if (code[0] === "#") {
      const hex = code[1].toLowerCase() === "x";
      return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return entities[code.toLowerCase()] ?? all;
  });
}

function markedBlock(html, className) {
  const at = html.indexOf(className);
  if (at < 0) return null;
  const rest = html.slice(at);
  const m = rest.match(/<!-- HTML_TAG_START -->([\s\S]*?)<!-- HTML_TAG_END -->/);
  if (!m) throw new Error(`No printable ${className} block in Datawrapper chart`);
  return decodeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
}

export function parseChartHtml(html, chartId) {
  const meta = html.match(/<meta property="og:title" content="([^"]*)">/);
  const canonical = html.match(/<meta property="og:url" content="([^"]*)">/);
  if (!meta || !canonical) throw new Error(`${chartId}: cached chart has no title/canonical metadata`);
  const notes = markedBlock(html, "block-notes");
  if (!notes) throw new Error(`${chartId}: cached chart has no source notes`);
  const sampleMatch = notes.match(/Sample size n=([\d,]+)/i);
  const fieldworkMatch = notes.match(/Fieldwork\s+([^.;,]+)/i);
  const marginMatch = notes.match(/Margin of Error\s*\+\s*\/\s*-\s*([\d.]+)%/i);
  if (!sampleMatch || !fieldworkMatch) throw new Error(`${chartId}: incomplete fieldwork/sample note: ${notes}`);
  return {
    title: decodeHtml(meta[1]).trim(),
    printedLabel: markedBlock(html, "block-description"),
    chartUrl: decodeHtml(canonical[1]).trim(),
    notes,
    sample: Number(sampleMatch[1].replace(/,/g, "")),
    fieldworkText: fieldworkMatch[1].trim(),
    marginOfError: marginMatch ? Number(marginMatch[1]) : null,
  };
}

export function parseFieldwork(text) {
  const m = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) throw new Error(`Unsupported printed fieldwork window: ${text}`);
  const month = MONTHS.indexOf(m[3].slice(0, 3).toLowerCase());
  if (month < 0) throw new Error(`Unknown fieldwork month: ${text}`);
  const mm = String(month + 1).padStart(2, "0");
  return {
    fieldworkStart: `${m[4]}-${mm}-${m[1].padStart(2, "0")}`,
    fieldworkEnd: `${m[4]}-${mm}-${m[2].padStart(2, "0")}`,
    month: `${m[4]}-${mm}`,
  };
}

/** Strict TSV, with source cells (including header whitespace) left intact. */
export function parseDelimited(text, chartId = "fixture") {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n");
  while (lines.at(-1) === "") lines.pop();
  if (!lines.length || lines.some((line) => !line.length)) throw new Error(`${chartId}: blank source row`);
  const rows = lines.map((line) => line.split("\t"));
  const width = rows[0].length;
  if (width < 2) throw new Error(`${chartId}: expected literal-tab TSV, not comma-delimited CSV`);
  for (const [i, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`${chartId}: row ${i + 1} has ${row.length} cells, header has ${width}`);
  }
  return { headers: rows[0], rows: rows.slice(1) };
}

export function parsePrintedNumber(text, { percent = true, chartId = "fixture", cell = "cell" } = {}) {
  const re = percent ? /^-?\d+(?:\.\d+)?%$/ : /^-?\d+(?:\.\d+)?$/;
  if (!re.test(text)) throw new Error(`${chartId}: malformed ${cell}: ${JSON.stringify(text)}`);
  const value = Number(percent ? text.slice(0, -1) : text);
  if (!Number.isFinite(value) || (percent && (value < 0 || value > 100)) || (!percent && Math.abs(value) > 100)) {
    throw new Error(`${chartId}: out-of-range ${cell}: ${text}`);
  }
  return value;
}

function issueId(issue, chartId) {
  const id = ISSUE_ID.get(issue);
  if (!id) throw new Error(`${chartId}: unknown or grammatically altered printed issue label: ${JSON.stringify(issue)}`);
  return id;
}

function checkRanked(rows, chartId, response = null) {
  const values = rows.map((r) => response === null ? r.share : r.shares[response]);
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) {
      throw new Error(`${chartId}: printed rows left source rank order at ${rows[i - 1].issue} / ${rows[i].issue}`);
    }
  }
}

function sourceProvenance(month, chartId, meta = null) {
  return {
    month,
    chartId,
    datasetUrl: `${DW}/${chartId}/1/dataset.csv`,
    chartUrl: meta?.chartUrl ?? null,
    datasetCache: `${chartId}.dataset.csv`,
    chartCache: meta ? `${chartId}.chart.html` : null,
  };
}

function commonWave(measure, month, chartId, meta) {
  const dates = parseFieldwork(meta.fieldworkText);
  if (dates.month !== month) throw new Error(`${chartId}: expected ${month}, printed ${dates.month}`);
  return {
    measure,
    month,
    fieldworkStart: dates.fieldworkStart,
    fieldworkEnd: dates.fieldworkEnd,
    fieldworkText: meta.fieldworkText,
    sample: meta.sample,
    marginOfError: meta.marginOfError,
    title: meta.title,
    printedLabel: meta.printedLabel,
    questionStem: null,
    questionStemStatus: "not-present-in-tabular-or-chart-download-not-inferred",
    sourceNotes: meta.notes,
    source: sourceProvenance(month, chartId, meta),
  };
}

function parseImportance(month, chartId, cache) {
  const meta = parseChartHtml(read(cache, `${chartId}.chart.html`), chartId);
  const table = parseDelimited(read(cache, `${chartId}.dataset.csv`), chartId);
  const wavesWithIndigenous = chartId === "JiZHI";
  const expectedRows = wavesWithIndigenous ? 17 : 16;
  if (table.rows.length !== expectedRows) throw new Error(`${chartId}: ${table.rows.length} rows, expected ${expectedRows}`);
  const rows = table.rows.map(([issue, printed]) => ({
    issue,
    share: parsePrintedNumber(printed, { chartId, cell: `${issue} share` }),
  }));
  const ids = rows.map((r) => issueId(r.issue, chartId));
  if (new Set(ids).size !== ids.length) throw new Error(`${chartId}: duplicate issue within source spelling variants`);
  for (const id of ids) {
    if (id !== "other" && id !== "indigenous" && !STANDARD_ISSUES.has(id)) throw new Error(`${chartId}: unexpected issue ${id}`);
    if (id === "indigenous" && !wavesWithIndigenous) throw new Error(`${chartId}: Indigenous affairs is source-native to JiZHI only`);
  }
  if (ids.at(-1) !== "other") throw new Error(`${chartId}: Other must remain the last printed importance row`);
  if (wavesWithIndigenous && (ids[14] !== "indigenous" || rows[14].issue !== "Indigenous affairs")) {
    throw new Error(`${chartId}: Indigenous affairs moved from its printed position before strikes`);
  }
  checkRanked(rows.slice(0, -1), chartId); // Other is pinned last even when it outranks the row before it.
  return {
    ...commonWave("issue-importance", month, chartId, meta),
    coverage: "complete-published-table-as-printed",
    sourceHeaders: table.headers,
    rows,
    ...(wavesWithIndigenous ? {
      universeException: "17 printed rows: Indigenous affairs is an extra source-native row in January 2024; the usual 16-row table has no such row",
    } : {}),
  };
}

function parseManagement(month, chartId, cache) {
  const meta = parseChartHtml(read(cache, `${chartId}.chart.html`), chartId);
  const table = parseDelimited(read(cache, `${chartId}.dataset.csv`), chartId);
  if (table.rows.length !== 15) throw new Error(`${chartId}: ${table.rows.length} management rows, expected 15`);
  const headers = table.headers;
  if (headers[0] !== "Row %" || headers.length !== 4 || headers.slice(1).some((v, i) => v !== MANAGEMENT_OPTIONS[i])) {
    throw new Error(`${chartId}: management columns/options changed: ${JSON.stringify(headers)}`);
  }
  const rows = table.rows.map(([issue, ...cells]) => ({
    issue,
    shares: cells.map((v, i) => parsePrintedNumber(v, { chartId, cell: `${issue} / ${headers[i + 1]}` })),
  }));
  const ids = rows.map((r) => issueId(r.issue, chartId));
  if (new Set(ids).size !== 15 || ids.some((id) => !STANDARD_ISSUES.has(id)) || STANDARD_ISSUES.size !== new Set(ids).size) {
    throw new Error(`${chartId}: management table is not exactly the 15-issue universe`);
  }
  for (const row of rows) {
    const sum = row.shares.reduce((a, b) => a + b, 0);
    if (sum < 99 || sum > 101) throw new Error(`${chartId}: ${row.issue} responses sum to ${sum}, not rounding distance from 100`);
  }
  checkRanked(rows, chartId, 0);
  return {
    ...commonWave("issue-management-three-response", month, chartId, meta),
    coverage: "full-three-response-15-issue-management-table",
    sourceHeaders: headers,
    responseOptions: headers.slice(1),
    rows,
  };
}

function parseNetLead(month, chartId, cache) {
  const meta = parseChartHtml(read(cache, `${chartId}.chart.html`), chartId);
  const table = parseDelimited(read(cache, `${chartId}.dataset.csv`), chartId);
  const expectedIssues = ["Managing the economy", "Cost & standard of living", "Immigration & asylum", "Crime & social order"];
  if (table.headers[0] !== "Net" || table.headers.length !== 5 || table.headers.slice(1).some((v, i) => v !== expectedIssues[i])) {
    throw new Error(`${chartId}: net-lead supplement headers changed: ${JSON.stringify(table.headers)}`);
  }
  const expectedRows = chartId === "ePE81" ? 5 : chartId === "aTbi4" ? 6 : null;
  if (expectedRows === null || table.rows.length !== expectedRows) throw new Error(`${chartId}: unexpected supplement row count`);
  const rows = table.rows.map(([printedPeriod, ...cells]) => {
    const m = printedPeriod.match(/^([A-Za-z]{3})-(\d{2})$/);
    if (!m) throw new Error(`${chartId}: malformed period ${printedPeriod}`);
    const monthIndex = MONTHS.indexOf(m[1].toLowerCase());
    if (monthIndex < 0) throw new Error(`${chartId}: malformed period ${printedPeriod}`);
    return {
      printedPeriod,
      month: `20${m[2]}-${String(monthIndex + 1).padStart(2, "0")}`,
      netLeads: cells.map((v, i) => parsePrintedNumber(v, { percent: false, chartId, cell: `${printedPeriod} / ${table.headers[i + 1]}` })),
    };
  });
  if (rows[0].month !== month || rows.at(-1).month !== "2022-12") throw new Error(`${chartId}: supplement period order/coverage changed`);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].month >= rows[i - 1].month) throw new Error(`${chartId}: supplement is not newest-first`);
  }
  return {
    ...commonWave("labor-net-lead-supplement", month, chartId, meta),
    coverage: "supplement-four-issue-net-lead-trend-not-full-three-response-management",
    supplement: true,
    valueMeaning: "Labor lead over the Coalition in percentage points, as printed; not a three-response share and never substituted for one",
    sourceHeaders: table.headers,
    issues: table.headers.slice(1),
    rows,
  };
}

const DEC22_OCR_READS = Object.freeze({
  importance: [
    { scale: 3, file: "2022-12-importance-ocr-3x-accurate.json" },
    { scale: 4, file: "2022-12-importance-ocr-4x-accurate.json" },
  ],
  management: [
    { scale: 3, file: "2022-12-management-ocr-3x-accurate.json" },
    { scale: 4, file: "2022-12-management-ocr-4x-accurate.json" },
  ],
});
const DEC22_IMAGES = Object.freeze({
  importance: { url: "https://freshwaterstrategy.com/wp-content/uploads/voter-priorities.png", file: "2022-12-importance.png" },
  management: { url: "https://freshwaterstrategy.com/wp-content/uploads/who-is-best-to-manage-each-voter-priority-1.png", file: "2022-12-management.png" },
});
export const DEC22_OCR_PROOF = path.join(CACHE, "2022-12-ocr-proof.json");

function ocrBox(line) {
  return { text: line.text, x: line.x, y: line.y, w: line.w, h: line.h };
}

function ocrTitle(lines) {
  const title = lines.filter((l) => l.y < 0.05).sort((a, b) => a.y - b.y || a.x - b.x).map((l) => l.text).join(" ");
  if (!title) throw new Error("2022-12 OCR: missing title");
  return title;
}

function ocrQuestion(lines) {
  const linesInStem = lines.filter((l) => l.y > 0.045 && l.y < 0.105).sort((a, b) => a.y - b.y || a.x - b.x);
  const text = linesInStem.map((l) => l.text).join(" ").replace(/^Q\s+"/, "").replace(/"$/, "");
  if (!text.endsWith("?") && !text.endsWith("three")) throw new Error(`2022-12 OCR: malformed question stem: ${text}`);
  return text;
}

function ocrFooter(lines) {
  const footer = lines.filter((l) => l.y > 0.90 && l.y < 0.97 &&
    (l.text.startsWith("Freshwater Strategy") || /^sum to/i.test(l.text)))
    .sort((a, b) => a.y - b.y || a.x - b.x).map((l) => l.text).join(" ");
  if (!/Sample size n=[\d,]+/.test(footer) || !/Fieldwork/.test(footer)) throw new Error(`2022-12 OCR: incomplete footer: ${footer}`);
  return footer;
}

/** Coordinate-anchored table read. No transcription/model figure is input. */
function ocrTable(lines, kind, scale) {
  const labels = lines.filter((l) => l.y >= 0.18 && l.y < 0.90 && ISSUE_ID.has(l.text))
    .sort((a, b) => a.y - b.y);
  const wantedRows = kind === "importance" ? 15 : 14;
  if (labels.length !== wantedRows) throw new Error(`2022-12 ${kind} ${scale}x OCR: ${labels.length} issue labels, expected ${wantedRows}`);
  const texts = labels.map((l) => l.text);
  if (new Set(texts).size !== texts.length || texts.some((text) => text.startsWith("Job security"))) {
    throw new Error(`2022-12 ${kind} ${scale}x OCR: unexpected/duplicate issue rows: ${texts.join(" | ")}`);
  }
  const numberAt = (label, column) => {
    const candidates = lines.filter((l) => {
      if (l.y < 0.18 || l.y >= 0.90 || !/^\d{1,3}%$/.test(l.text)) return false;
      if (kind === "importance") return l.x >= 0.30 && l.x < 0.80;
      return column === 0 ? l.x >= 0.30 && l.x < 0.41
        : column === 1 ? l.x >= 0.50 && l.x < 0.80
        : l.x >= 0.90;
    });
    const ranked = candidates.map((line) => ({ line, distance: Math.abs(line.y - label.y) })).sort((a, b) => a.distance - b.distance);
    if (!ranked.length || ranked[0].distance > 0.012) {
      throw new Error(`2022-12 ${kind} ${scale}x OCR: no numeric cell for ${label.text} column ${column}`);
    }
    if (ranked.length > 1 && Math.abs(ranked[1].distance - ranked[0].distance) < 0.005) {
      throw new Error(`2022-12 ${kind} ${scale}x OCR: ambiguous numeric row match for ${label.text} column ${column}`);
    }
    return ranked[0].line;
  };
  return labels.map((label) => {
    const columns = kind === "importance" ? 1 : 3;
    return {
      issue: label.text,
      label: ocrBox(label),
      values: Array.from({ length: columns }, (_, column) => {
        const cell = numberAt(label, column);
        return { share: Number(cell.text.slice(0, -1)), text: cell.text, box: ocrBox(cell) };
      }),
    };
  });
}

function ocrOptions(lines) {
  const options = lines.filter((l) => l.y > 0.105 && l.y < 0.15).sort((a, b) => a.x - b.x).map((l) => l.text);
  if (options.length !== 3) throw new Error(`2022-12 management OCR: expected three response headers, got ${JSON.stringify(options)}`);
  return options;
}

function decemberTables(cache) {
  const reads = {};
  for (const kind of ["importance", "management"]) {
    reads[kind] = DEC22_OCR_READS[kind].map(({ scale, file }) => {
      const lines = JSON.parse(read(cache, file));
      if (!Array.isArray(lines) || lines.some((l) => typeof l.text !== "string" || !["x", "y", "w", "h"].every((k) => Number.isFinite(l[k])))) {
        throw new Error(`${file}: malformed ocr-image.swift output`);
      }
      return {
        scale, file, lines,
        rows: ocrTable(lines, kind, scale),
        title: ocrTitle(lines),
        questionStem: ocrQuestion(lines),
        sourceNotes: ocrFooter(lines),
        responseOptions: kind === "management" ? ocrOptions(lines) : null,
      };
    });
  }
  const tableShape = (rows) => rows.map((r) => ({ issue: r.issue, values: r.values.map((v) => ({ share: v.share, text: v.text })) }));
  const proofCells = [];
  const result = {};
  for (const kind of ["importance", "management"]) {
    const [a, b] = reads[kind];
    for (const key of ["title", "questionStem", "sourceNotes"]) {
      if (a[key] !== b[key]) throw new Error(`2022-12 ${kind}: ${key} disagrees at 3x vs 4x`);
    }
    if (kind === "management" && JSON.stringify(a.responseOptions) !== JSON.stringify(b.responseOptions)) {
      throw new Error("2022-12 management: response headers disagree at 3x vs 4x");
    }
    const left = tableShape(a.rows), right = tableShape(b.rows);
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`2022-12 ${kind}: cross-scale cells disagree\n3x ${JSON.stringify(left)}\n4x ${JSON.stringify(right)}`);
    }
    result[kind] = {
      title: a.title,
      questionStem: a.questionStem,
      sourceNotes: a.sourceNotes,
      responseOptions: a.responseOptions,
      rows: a.rows.map((r) => ({ issue: r.issue, shares: r.values.map((v) => v.share) })),
    };
    for (let rowIndex = 0; rowIndex < a.rows.length; rowIndex++) {
      for (let column = 0; column < a.rows[rowIndex].values.length; column++) {
        const evidenceFor = (entry) => ({
          scale: entry.scale,
          ocrCache: entry.file,
          issueText: entry.rows[rowIndex].label.text,
          issueBox: entry.rows[rowIndex].label,
          valueText: entry.rows[rowIndex].values[column].text,
          valueBox: entry.rows[rowIndex].values[column].box,
        });
        proofCells.push({
          measure: kind,
          issue: a.rows[rowIndex].issue,
          ...(kind === "management" ? { responseOption: a.responseOptions[column] } : {}),
          share: a.rows[rowIndex].values[column].share,
          reads: [evidenceFor(a), evidenceFor(b)],
        });
      }
    }
  }
  const footerSample = result.importance.sourceNotes.match(/Sample size n=([\d,]+)/);
  const fieldworkText = result.importance.sourceNotes.match(/Fieldwork\s+([^.;,]+)/)[1].trim();
  for (const kind of ["importance", "management"]) {
    const sameNotes = result[kind].sourceNotes === result.importance.sourceNotes;
    if (!sameNotes) throw new Error("2022-12 importance and management source footers differ");
  }
  if (!footerSample) throw new Error("2022-12 OCR: missing sample size");
  return {
    reads,
    ...result,
    sample: Number(footerSample[1].replace(/,/g, "")),
    fieldworkText,
    ...parseFieldwork(fieldworkText),
    proof: {
      schemaVersion: 1,
      generator: ".build/extract-freshwater-issues.mjs / ocrTable()",
      ocrProgram: ".build/ocr-image.swift invoked with accurate mode at 3x and 4x",
      comparison: "Every issue label, response column, printed value and cell value is independently coordinate-matched in both reads; generation throws unless both integer shares and labels agree exactly",
      sourceImages: Object.fromEntries(Object.entries(DEC22_IMAGES).map(([kind, v]) => [kind, { url: v.url, cache: v.file }])),
      reads: DEC22_OCR_READS,
      cells: proofCells,
    },
  };
}

export function buildDecemberOcrProof(cache = CACHE) {
  return decemberTables(cache).proof;
}

function decemberWaves(cache) {
  const d = decemberTables(cache);
  if (d.month !== "2022-12") throw new Error(`2022-12 OCR fieldwork identified ${d.month}`);
  const common = (measure, kind) => ({
    measure,
    month: d.month,
    fieldworkStart: d.fieldworkStart,
    fieldworkEnd: d.fieldworkEnd,
    fieldworkText: d.fieldworkText,
    sample: d.sample,
    marginOfError: null,
    title: d[kind].title,
    printedLabel: null,
    questionStem: d[kind].questionStem,
    questionStemStatus: "printed-in-source-png-read-by-two-accurate-ocr-scales",
    sourceNotes: d[kind].sourceNotes,
    source: {
      month: d.month,
      chartId: null,
      datasetUrl: null,
      chartUrl: null,
      releaseUrl: "https://freshwaterstrategy.com/2022/12/19/afr-freshwater-strategy-federal-polling/",
      releaseCache: "2022-12-19-release.html",
      imageUrl: DEC22_IMAGES[kind].url,
      imageCache: DEC22_IMAGES[kind].file,
      ocrCaches: DEC22_OCR_READS[kind].map((r) => r.file),
      ocrProofCache: "2022-12-ocr-proof.json",
      verification: "Solely mechanical: no transcription or model-read pixel figure is used. ocrTable() coordinate-matches each printed issue label and numeric cell independently in accurate-mode 3x and 4x ocr-image.swift outputs. Both scales must return the same issue, response column and share or the build fails; the two scale-specific raw boxes for every shipped cell are in 2022-12-ocr-proof.json.",
    },
  });
  for (const kind of ["importance", "management"]) {
    const rows = d[kind].rows;
    const ids = rows.map((r) => issueId(r.issue, `2022-12-${kind}-ocr`));
    if (ids.includes("jobs") || new Set(ids).size !== ids.length) throw new Error(`2022-12 ${kind} OCR universe changed`);
    if (rows.some((r) => r.shares.some((v) => !Number.isInteger(v) || v < 0 || v > 100))) throw new Error(`2022-12 ${kind} OCR contains a non-share cell`);
    checkRanked(rows.map((r) => ({ issue: r.issue, share: r.shares[0], shares: r.shares })), `2022-12-${kind}-ocr`, 0);
    if (kind === "management") {
      for (const row of rows) {
        const sum = row.shares.reduce((a, b) => a + b, 0);
        if (row.shares.length !== 3 || sum < 99 || sum > 101) throw new Error(`2022-12 ${row.issue}: OCR responses sum to ${sum}`);
      }
    } else if (ids.at(-1) !== "other") throw new Error("2022-12 importance OCR: Other is not last");
  }
  return {
    importance: {
      ...common("issue-importance", "importance"),
      coverage: "complete-published-png-table-as-printed-later-universe-job-row-absent",
      universeException: "15 printed rows: unlike the later usual 16-row table, there is no job-security row; Other is included and no zero was inserted",
      missingPrintedUniverseIssues: ["Job security & unemployment"],
      sourceHeaders: null,
      rows: d.importance.rows.map((r) => ({ issue: r.issue, share: r.shares[0] })),
    },
    management: {
      ...common("issue-management-three-response", "management"),
      coverage: "full-three-responses-for-14-printed-issues-later-15th-job-row-absent",
      universeException: "14 printed issues: Job security & unemployment is not printed in the December 2022 PNG and remains missing, not zero",
      missingPrintedUniverseIssues: ["Job security & unemployment"],
      sourceHeaders: null,
      responseOptions: [...d.management.responseOptions],
      rows: d.management.rows.map((r) => ({ issue: r.issue, shares: [...r.shares] })),
    },
  };
}

function coverageRows(waves, kind) {
  const rows = waves.map((w) => ({
    month: w.month,
    status: "imported",
    chartId: w.source.chartId,
    printedRows: w.rows.length,
    coverage: w.coverage,
    ...(w.universeException ? { note: w.universeException } : {}),
  }));
  for (const month of MISSING_BATTERIES) {
    rows.push({
      month,
      status: "missing-skipped-battery",
      chartId: null,
      printedRows: null,
      coverage: "missing-not-zero",
      note: `${kind} battery wave left missing exactly as requested for ${month}; no cell was set to zero and no net-lead supplement was promoted into a full table`,
    });
  }
  return rows.sort((a, b) => a.month.localeCompare(b.month));
}

export function buildStore(cache = CACHE) {
  const dec = decemberWaves(cache);
  const importance = [dec.importance, ...SPECS.importance.map(([month, id]) => parseImportance(month, id, cache))]
    .sort((a, b) => a.month.localeCompare(b.month));
  const management = [dec.management, ...SPECS.management.map(([month, id]) => parseManagement(month, id, cache))]
    .sort((a, b) => a.month.localeCompare(b.month));
  const netLeadSupplements = SPECS.netLead.map(([month, id]) => parseNetLead(month, id, cache));
  const importanceCells = importance.reduce((n, w) => n + w.rows.length, 0);
  const managementCells = management.reduce((n, w) => n + w.rows.length * 3, 0);
  const netLeadCells = netLeadSupplements.reduce((n, w) => n + w.rows.length * w.issues.length, 0);
  return {
    _about: "Freshwater Strategy / AFR issue-importance and issue-management tables, read only from official Datawrapper TSV payloads and the two official December 2022 PNGs. Importance, full three-response management and the four-issue Labor-net-lead supplements are separate measures. Printed labels and source row order are retained, including source spelling/grammar changes. Tabular/chart downloads do not print exact question stems, so only the two PNG-backed December 2022 stems are filed; no stem is inferred for another wave. May 2023, September 2023 and February 2025 are explicit missing-battery markers, never zeros. Nothing here is joined to polls.json.",
    schemaVersion: 1,
    house: "Freshwater Strategy",
    publisher: "Australian Financial Review",
    generatedBy: ".build/extract-freshwater-issues.mjs",
    questionStemPolicy: "Do not invent question stems absent from the tabular downloads; questionStem:null means no exact stem was present in the downloaded table or chart shell",
    universes: {
      importance: "Usually 16 printed rows including Other; December 2022 has 15 because its PNG omits job security, and January 2024 has 17 because its TSV adds Indigenous affairs",
      management: "Three response columns over 15 issues in the tabular waves; the December 2022 PNG has those three responses over 14 printed issues because it omits job security",
      netLeadSupplements: "Four issues only, printed Labor-minus-Coalition leads by month; supplement, not full three-response management",
    },
    importance: {
      measure: "share naming the issue among up to three voter priorities",
      waves: importance,
      coverage: coverageRows(importance, "Importance"),
    },
    management: {
      measure: "three-response government-best-to-manage shares by issue",
      waves: management,
      coverage: coverageRows(management, "Management"),
    },
    netLeadSupplements,
    summary: {
      importanceWaves: importance.length,
      importanceRows: importanceCells,
      importanceCells,
      managementWaves: management.length,
      managementRows: management.reduce((n, w) => n + w.rows.length, 0),
      managementResponseCells: managementCells,
      netLeadSupplementCharts: netLeadSupplements.length,
      netLeadPeriodRows: netLeadSupplements.reduce((n, w) => n + w.rows.length, 0),
      netLeadCells,
      netLeadDistinctMonths: new Set(netLeadSupplements.flatMap((w) => w.rows.map((r) => r.month))).size,
      missingBatteryMarkersPerMeasure: MISSING_BATTERIES.length,
    },
  };
}

export function renderStore(cache = CACHE) {
  return `${JSON.stringify(buildStore(cache), null, 2)}\n`;
}

export function run({ check = false } = {}) {
  const rendered = renderStore();
  const previous = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : null;
  if (rendered === previous) {
    console.log(`freshwater issues: unchanged ${OUTPUT}`);
  } else {
    if (check) {
      console.error(`freshwater issues: ${OUTPUT} is stale or absent; rerun node .build/extract-freshwater-issues.mjs`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(OUTPUT, rendered);
    console.log(`freshwater issues: wrote ${OUTPUT}`);
  }
  const proofRendered = `${JSON.stringify(buildDecemberOcrProof(), null, 2)}\n`;
  const previousProof = fs.existsSync(DEC22_OCR_PROOF) ? fs.readFileSync(DEC22_OCR_PROOF, "utf8") : null;
  if (proofRendered === previousProof) {
    console.log(`freshwater issues: unchanged ${DEC22_OCR_PROOF}`);
  } else {
    if (check) {
      console.error(`freshwater issues: ${DEC22_OCR_PROOF} is stale or absent; rerun node .build/extract-freshwater-issues.mjs`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(DEC22_OCR_PROOF, proofRendered);
    console.log(`freshwater issues: wrote ${DEC22_OCR_PROOF} (${buildDecemberOcrProof().cells.length} cells, each with two scale-specific reads)`);
  }
  const store = buildStore();
  console.log(`freshwater issues: ${store.summary.importanceWaves} importance waves / ${store.summary.importanceRows} rows; ${store.summary.managementWaves} management waves / ${store.summary.managementRows} rows / ${store.summary.managementResponseCells} response cells; ${store.summary.netLeadSupplementCharts} net-lead supplement charts / ${store.summary.netLeadCells} cells`);
  for (const kind of ["importance", "management"]) {
    for (const w of store[kind].waves) {
      const url = w.source.datasetUrl || w.source.imageUrl;
      console.log(`${kind} ${w.month}: ${w.rows.length} rows — ${w.coverage} — ${url}`);
    }
  }
  for (const w of store.netLeadSupplements) console.log(`net-lead ${w.month}: ${w.rows.length} periods x ${w.issues.length} issues — supplement only — ${w.source.datasetUrl}`);
  for (const month of MISSING_BATTERIES) console.log(`missing-battery ${month}: importance and management absent, not zero`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run({ check: process.argv.includes("--check") });
}
