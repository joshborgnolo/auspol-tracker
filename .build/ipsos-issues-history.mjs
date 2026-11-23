#!/usr/bin/env node
/* Ipsos Issues Monitor historical read-model.

   Every printed table remains attached to its source: monthly/quarterly and
   pooled periods, annual averages, reprints and source revisions are not
   collapsed into an invented continuous series. Live data/issues.json keeps
   its IP_FIRST contract and never reads this archive. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { IP_ISSUE, ISSUES, ipReports, ipStatement } from "./issues-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HISTORY = process.env.IPSOS_HISTORY_SRC || path.join(ROOT, ".build", "ipsos-history-src");
const CURRENT = process.env.IPSOS_SRC_DIR || path.join(ROOT, ".build", "ipsos-src");
const OUT = process.env.IPSOS_HISTORY_OUT || process.env.IPSOS_ISSUES_HISTORY_OUT || path.join(ROOT, "data", "ipsos-issues-history.json");
const CHECK = process.argv.includes("--check");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_RE = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Ju|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const norm = (s) => String(s).replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const monthNo = (s) => s.toLowerCase() === "ju" ? 7 : MONTHS.findIndex((m) => m.toLowerCase().startsWith(s.slice(0, 3).toLowerCase())) + 1;
const ym = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (key, n) => { const [y, m] = key.split("-").map(Number), t = y * 12 + m - 1 + n; return ym(Math.floor(t / 12), t % 12 + 1); };
const pcts = (line) => [...line.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const atomic = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", text); fs.renameSync(file + ".tmp", file); };

function pageIdentity(page) {
  let m = page.match(/IPSOS ISSUES MONITOR\s+([A-Z]+)\s+(\d{4})/i);
  if (!m) m = page.match(/^[ \t]*(?:THE TOP ISSUES FACING AUSTRALIA|ALL ISSUES FACING AUSTRALIA)\s*\n\s*([A-Z]+)\s+(\d{4})/im);
  if (!m) {
    const legacy = page.match(/^[ \t]*(?:THE TOP ISSUES FACING|ALL ISSUES FACING) (?:AUSTRALIA|VICTORIA|NEW SOUTH WALES|NSW|QUEENSLAND|QLD|WESTERN AUSTRALIA|WA)\s*\n\s*([A-Z]+)(?:\s+TO\s+([A-Z]+))?\s+(\d{4})/im);
    if (legacy) m = [legacy[0], legacy[2] || legacy[1], legacy[3]];
  }
  if (!m) return null;
  const month = monthNo(m[1]);
  if (!month) return null;
  const rawScope = page.match(/(?:The top|ALL) issues facing (Australia|Victoria|New South Wales|NSW|Queensland|QLD|Western Australia|WA)/i)?.[1]
    || (/ALL ISSUES FACING AUSTRALIA/i.test(page) ? "Australia" : null);
  const scope = { australia: "Australia", victoria: "Victoria", "new south wales": "New South Wales", nsw: "New South Wales", queensland: "Queensland", qld: "Queensland", "western australia": "Western Australia", wa: "Western Australia" }[rawScope?.toLowerCase()];
  if (!scope) return null;
  return { scope, ym: ym(m[2], month), monthName: m[1].toUpperCase(), year: m[2] };
}

export function periodTokens(line) {
  const out = [];
  const re = new RegExp(`\\b(${MONTH_RE})(?:\\s*-\\s*(${MONTH_RE}))?(?:\\s+(20\\d{2}|\\d{2}))?`, "gi");
  for (const m of line.matchAll(re)) {
    const start = monthNo(m[1]), end = m[2] ? monthNo(m[2]) : start;
    let year = m[3] ? Number(m[3]) : null;
    if (year != null && year < 100) year += 2000;
    out.push({ label: compactLabel(m[0]), start, end, year, index: m.index, endIndex: m.index + m[0].length });
  }
  if (out.length >= 2 || out.some((t) => t.year != null || t.start !== t.end)) return out;
  const numeric = line.trim().split(/\s+/);
  if (numeric.length >= 2 && numeric.every((x) => /^\d{1,2}$/.test(x) && +x >= 1 && +x <= 12))
    return numeric.map((n) => ({ label: n, start: +n, end: +n, year: null }));
  return [];
}
const compactLabel = (s) => s.replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();

export function joinSplitPeriods(line, following) {
  const pending = [...line.matchAll(new RegExp(`\\b(${MONTH_RE})\\s*\\-\\s*(?=\\s{2,}|$)`, "gi"))];
  let ends = [];
  if (pending.length) for (const line of [following].flat()) {
    let t = periodTokens(line);
    if (pending.length === 1) {
      const m = line.match(new RegExp(`^\\s*(${MONTH_RE})\\s*$`, "i"));
      if (m) t = [{ label: m[1], start: monthNo(m[1]), end: monthNo(m[1]), year: null }];
    }
    if (t.length === pending.length) { ends = t; break; }
  }
  if (!pending.length || pending.length !== ends.length) return line;
  let out = line;
  for (let i = pending.length - 1; i >= 0; i--) {
    const m = pending[i], start = m.index, replacement = `${m[1]} - ${ends[i].label}`.padEnd(m[0].length);
    out = out.slice(0, start) + replacement + out.slice(start + m[0].length);
  }
  return out;
}

function readRows(lines) {
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i], label = null, vals = pcts(line);
    if (vals.length) {
      const at = line.search(/\d+(?:\.\d+)?%/);
      label = line.slice(0, at).trim();
      const values = line.slice(at).match(/^(?:\s*\d+(?:\.\d+)?%)+/);
      if (values) vals = pcts(values[0]);
    } else if (IP_ISSUE[norm(line.trim())] && i + 1 < lines.length && pcts(lines[i + 1]).length) {
      label = line.trim(); vals = pcts(lines[++i]);
    }
    const key = label && IP_ISSUE[norm(label.replace(/\s{2,}.*$/, ""))];
    if (key && vals.length >= 2) rows.push({ key, vals });
  }
  return rows;
}

/* Read annual + period columns directly, including 2013–15 pooled formats,
   2016 – 20 headers with future months left blank and 2021–23's inline years. */
export function readSalienceTable(page, report) {
  const lines = page.split("\n"), rows = readRows(lines);
  if (rows.length < 10) return null;
  const first = lines.findIndex((line) => pcts(line).length >= 2 && IP_ISSUE[norm(line.slice(0, line.search(/\d/)).trim())]);
  const headerLines = lines.slice(0, first).map((line, i) => ({ line, i }));
  let tokens = [], tokenLine = -1;
  for (const h of headerLines) {
    const joined = joinSplitPeriods(h.line, lines.slice(h.i + 1, h.i + 4));
    const t = periodTokens(joined);
    if (joined !== h.line) t.push(...periodTokens(lines[h.i + 1] || ""));
    if (t.length > tokens.length || (t.length === tokens.length && h.i > tokenLine)) { tokens = t; tokenLine = h.i; }
  }
  if (tokens.length < 2 && !tokens.some((t) => t.year != null)) return { error: "no period header" };
  const annualHeader = headerLines.filter((h) => !/IPSOS ISSUES MONITOR/i.test(h.line) && (h.line.match(/\b20\d{2}\b/g) || []).length >= 2);
  const repeatedYear = annualHeader.some((h) => {
    const years = h.line.match(/\b20\d{2}\b/g) || [];
    return [...new Set(years)].length === 1 && Number(years[0]) === Number(report.ym.slice(0, 4));
  });
  const inlineYears = tokens.some((t) => t.year != null), sameLine = annualHeader.some((h) => h.i === tokenLine);
  const yearBelow = annualHeader.some((h) => h.i > tokenLine && h.i <= tokenLine + 3);
  let annualYears = [];
  if (repeatedYear || inlineYears || sameLine || yearBelow) {
    const h = annualHeader.find((h) => h.i === tokenLine) || annualHeader.find((h) => (h.line.match(/\b20\d{2}\b/g) || []).length > 1);
    if (h) {
      const text = h.i === tokenLine ? h.line.slice(0, tokens[0].index) : h.line;
      annualYears = [...text.matchAll(/\b(20\d{2}|202)\b/g)].map((m) => m[1]);
    }
  }
  const counts = rows.map((r) => r.vals.length), mode = [...new Set(counts)].sort((a, b) => counts.filter((x) => x === b).length - counts.filter((x) => x === a).length)[0];
  const nPeriods = mode - annualYears.length;
  if (nPeriods < 1 || nPeriods > tokens.length) return { error: `columns (${mode}) do not reconcile annual ${annualYears.length} + period headers ${tokens.length}` };
  const used = tokens.slice(0, nPeriods);
  const periods = [];
  for (let i = used.length - 1, ceiling = report.ym; i >= 0; i--) {
    const t = used[i];
    const endYear = t.year ?? Math.min(Number(ceiling.slice(0, 4)), Number(report.ym.slice(0, 4)));
    let endKey = ym(endYear, t.end);
    while (endKey > ceiling) endKey = ym(endYear - 1, t.end);
    let startKey = t.year != null ? ym(endYear, t.start) : ym(Number(endKey.slice(0, 4)), t.start);
    while (startKey > endKey) startKey = ym(Number(startKey.slice(0, 4)) - 1, t.start);
    const startMonth = Number(startKey.slice(5)), endMonth = Number(endKey.slice(5));
    const duration = (Number(endKey.slice(0, 4)) * 12 + endMonth) - (Number(startKey.slice(0, 4)) * 12 + startMonth) + 1;
    const basis = duration === 1 ? "month" : duration === 3 ? "quarter" : duration === 2 ? "two-month pool" : `${duration}-month pool`;
    periods[i] = { label: t.label, basis, startMonth: startKey, endMonth: endKey };
    ceiling = shift(startKey, -1);
  }
  const columns = [...annualYears.map((year) => ({ label: year, basis: "annual average", year })), ...periods];
  const tableRows = {};
  for (const r of rows) {
    const issues = {};
    columns.forEach((c, i) => { issues[c.label] = r.vals[i] ?? null; });
    tableRows[r.key] = issues;
    if (r.vals.length !== mode || r.vals.length !== columns.length) return { error: `${r.key}: ${r.vals.length} cells for ${columns.length} columns` };
  }
  const entries = columns.map((column) => ({ ...column,
    issues: Object.fromEntries(Object.entries(tableRows).map(([key, values]) => [key, values[column.label]])) }));
  const current = entries.filter((e) => e.endMonth === report.ym).at(-1) || entries.at(-1);
  return { entries, current: current.issues, annual: Object.fromEntries(entries.filter((e) => e.basis === "annual average").map((e) => [e.year, e.issues])), rows: rows.length };
}

export function legacyOwnership(page, report) {
  if (!/MOST CAPABLE OF MANAGING/.test(page)) return null;
  const lines = page.split("\n"), answers = { ALP: "alp", "LIB-NAT": "lnp", GREEN: "grn", OTHER: "oth", "DON’T KNOW": "unsure", NONE: "none" }, issues = [];
  const start = lines.findIndex((line) => /MOST CAPABLE OF MANAGING/.test(line));
  for (const line of lines.slice(start + 1)) {
    const candidates = [...line.matchAll(/(Healthcare|Cost of Living|The Economy|Crime|Unemployment|Immigration|Education|Housing|Petrol Prices|Environment|Drug Abuse|Poverty|Personal Debt|Transport|Taxation|Population|Racism|Defence|Indigenous Issues)/gi)]
      .map((m) => ({ key: IP_ISSUE[norm(m[1])], at: m.index })).filter((m) => m.key);
    if (candidates.length >= 3) { issues.push(...candidates); break; }
  }
  if (!issues.length) return null;
  issues.sort((a, b) => a.at - b.at);
  const own = Object.fromEntries(issues.map((x) => [x.key, {}]));
  for (const line of lines) {
    const label = line.trim().match(/^([A-Z][A-Z’' -]*[A-Z])\s{2,}/)?.[1];
    const answer = answers[label];
    if (!answer) continue;
    const cells = [...line.matchAll(/(\d+(?:\.\d+)?)%/g)];
    for (const issue of issues) {
      const nearest = cells.map((m) => Math.abs(m.index - issue.at)), d = Math.min(...nearest);
      if (d <= 45) own[issue.key][answer] = Number(cells[nearest.indexOf(d)][1]);
    }
  }
  return { top5: issues.map((x) => x.key), own };
}

function frontComparisons(page) {
  const lines = page.split("\n"), dated = [];
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z]{3,}(?:\s*-\s*[A-Z]{3,})?)\s+(\d{2,4})\s+/);
    if (m) dated.push({ line, label: `${m[1].replace(/\s+/g, "")} ${m[2]}`, cells: [...line.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => ({ value: +m[1], at: m.index })) });
    else if (dated.length && dated.at(-1).cells.length < 5 && /^\s*(?:\d+(?:\.\d+)?%\s*)+(?:to\s+[A-Za-z]|compared|$)/i.test(line)) {
      dated.at(-1).cells.push(...[...line.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => ({ value: +m[1], at: m.index })));
    }
  }
  if (!dated.length) return {};
  const current = dated[0], prior = dated[1], election = dated[2];
  let top5 = null;
  const ci = lines.indexOf(current.line);
  for (let i = ci - 1; i >= 0 && ci - i <= 3; i--) {
    const hits = [...lines[i].matchAll(/(Healthcare|Cost of Living|The Economy|Crime|Unemployment|Immigration|Education|Housing|Petrol Prices|Environment|Drug Abuse|Poverty|Personal Debt|Transport|Taxation|Population|Racism|Defence|Indigenous Issues)/gi)].map((m) => IP_ISSUE[norm(m[1])]).filter(Boolean);
    if (hits.length === 5) { top5 = hits; break; }
  }
  if (!top5) return {};
  const rowAt = (row) => {
    if (!row) return null;
    return Object.fromEntries(top5.map((k, i) => { const nearest = row.cells.map((c) => Math.abs(c.at - current.cells[i].at)), d = Math.min(...nearest); return [k, nearest.indexOf(d) >= 0 && d <= 8 ? row.cells[nearest.indexOf(d)].value : null]; }).filter((row) => row[1] != null));
  };
  const restIndex = lines.findIndex((line) => /^\s*REST OF\s+/.test(line) && pcts(line).length >= 3);
  const restOfAustralia = restIndex >= 0 ? rowAt({ cells: [...lines[restIndex].matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => ({ value: +m[1], at: m.index })) }) : null;
  return { top5, comparisons: { previous: { label: prior?.label || null, issues: rowAt(prior) }, election: { label: election?.label || null, issues: rowAt(election) } }, restOfAustralia };
}

function inlineUndecided(page, report) {
  if (!report.own) return;
  for (const line of page.split("\n")) {
    const pairs = [...line.matchAll(/Don’t know:\s*(\d+(?:\.\d+)?)%\s*None:\s*(\d+(?:\.\d+)?)%/gi)];
    if (pairs.length !== report.top5?.length) continue;
    pairs.forEach((m, i) => { const sh = report.own[report.top5[i]] ||= {}; sh.unsure = +m[1]; sh.none = +m[2]; });
  }
}

function parseSource(source, dir) {
  const text = fs.readFileSync(path.join(dir, source.text), "utf8");
  const methods = [];
  const st = ipStatement(text);
  if (st) methods.push({ id: source.id, scope: "Australia", ...st, sourceUrl: source.url, sourceCapture: source.text, methodUrl: source.url });
  if (source.kind === "statement") return { methods, reports: [], documents: [], unread: [] };
  const groups = new Map(), documents = [], unread = [];
  let lastIdentity = null;
  for (const [pageIndex, page] of text.split("\f").entries()) {
    let identity = pageIdentity(page);
    // A bound state pack places an all-issue table behind its front page.
    // Use that front-page identity if a table lost its header, or (June
    // 2018 Victoria) the table repeats an earlier month by mistake.
    if (lastIdentity && readRows(page.split("\n")).length >= 10) {
      if (!identity || (identity.scope === lastIdentity.scope && identity.ym < lastIdentity.ym)) identity = lastIdentity;
    }
    if (!identity) continue;
    lastIdentity = identity;
    const key = `${identity.scope}|${identity.ym}`;
    if (!groups.has(key)) groups.set(key, { ...identity, pages: [] });
    groups.get(key).pages.push({ page, pageIndex: pageIndex + 1 });
  }
  const reports = [];
  for (const group of groups.values()) {
    const report = { scope: group.ym ? group.scope : "Australia", ym: group.ym, source: source.id, sourceUrl: source.url, sourceCapture: source.text,
      issueLabels: undefined };
    const input = group.pages.map((p) => p.page.replace(/The top issues facing (?:Australia|Victoria|New South Wales|Queensland|Western Australia)/i, "The top issues facing Australia")).join("\f");
    const normalised = `IPSOS ISSUES MONITOR ${group.monthName} ${group.year}\n${input}`;
    const r = ipReports(normalised).find((x) => x.ym === group.ym) || { ym: group.ym, problems: [], unknown: [], reprint: {} };
    const entries = [], tableErrors = [];
    for (const p of group.pages) {
      const table = readSalienceTable(p.page, group);
      if (table && !table.error) entries.push(...table.entries);
      else {
        if (table?.error) tableErrors.push(table.error);
        Object.assign(r, r.own ? {} : legacyOwnership(p.page, r) || {});
      }
      const front = frontComparisons(p.page);
      if (front.top5) r.top5 = front.top5;
      if (front.comparisons) r.comparisons = front.comparisons;
      if (front.restOfAustralia) r.restOfAustralia = front.restOfAustralia;
      inlineUndecided(p.page, r);
    }
    if (entries.length) {
      const seen = new Set();
      report.salience = entries.filter((e) => !seen.has(`${e.year || `${e.startMonth}|${e.endMonth}`}`) && seen.add(`${e.year || `${e.startMonth}|${e.endMonth}`}`));
      const current = report.salience.filter((e) => e.endMonth === group.ym).at(-1) || report.salience.at(-1);
      report.current = current.issues;
    } else if (r.all) report.current = r.all;
    Object.assign(report, {
      dateStart: r.start || null, date: r.end || null, fieldwork: null, sample: r.sample || null,
      comparisons: r.comparisons || {}, top5: r.top5 || null,
      ...(r.restOfAustralia ? { restOfAustralia: r.restOfAustralia } : {}),
      ...(r.own ? { ownership: r.own } : {}),
    });
    const flat = group.pages.map((p) => p.page).join("\n").replace(/\s+/g, " ");
    const sampleText = flat.match(/Each (?:month|quarter) we ask ([\d,]+) (?:Australians|Victorians|New South Wales|Queenslanders|Western Australians)/i);
    if (!report.sample && sampleText) report.sample = +sampleText[1].replace(/,/g, "");
    if (!report.sample) { const base = flat.match(/representative sample of c\.? ?([\d,]+)/i); if (base) report.sample = +base[1].replace(/,/g, ""); }
    const field = group.pages.map((p) => p.page).join(" ").replace(/\s+/g, " ").match(/between ([^.]*?) among (?:Australian|Victorian) adults/i);
    if (field) report.fieldwork = field[1].trim();
    if (!report.salience && !report.ownership) { unread.push({ source: source.id, scope: group.scope, ym: group.ym, pages: group.pages.map((p) => p.pageIndex), reason: tableErrors.join("; ") || "no issues table" }); continue; }
    if (!report.salience) report.unmodelledSalience = true;
    report.problems = [...tableErrors, ...r.problems].filter((p) => report.salience ? !/page 2|no fieldwork/.test(p) : !/no fieldwork/.test(p));
    if (r.unknown.length) report.unmappedLabels = [...new Set(r.unknown)];
    reports.push(report);
  }
  documents.push(...unread.map((x) => ({ ...x, sourceUrl: source.url, capture: source.text })));
  return { reports, methods, documents, unread };
}

export function buildHistory() {
  const manifest = JSON.parse(fs.readFileSync(path.join(HISTORY, "manifest.json"), "utf8"));
  const sources = [], reports = [], methods = [], documents = [], unread = [];
  for (const source of manifest.sources) {
    const base = { id: source.id, kind: source.kind, url: source.url, capture: source.text, baseDir: path.relative(ROOT, HISTORY),
      textSha256: sha256(fs.readFileSync(path.join(HISTORY, source.text), "utf8")) };
    sources.push(base);
    const parsed = source.kind === "commentary" ? { reports: [], methods: [], documents: [{ ...base, role: "archived commentaries" }], unread: [] } : parseSource(source, HISTORY);
    reports.push(...parsed.reports); methods.push(...parsed.methods); documents.push(...parsed.documents); unread.push(...parsed.unread);
  }
  for (const file of fs.readdirSync(CURRENT).filter((f) => f.endsWith(".txt"))) {
    const text = fs.readFileSync(path.join(CURRENT, file), "utf8");
    const meta = JSON.parse(fs.readFileSync(path.join(CURRENT, file.replace(/\.txt$/, ".json")), "utf8"));
    const id = path.basename(file, ".txt"), st = ipStatement(text);
    sources.push({ id, kind: st ? "statement" : "national", url: meta.pdf, capture: file, baseDir: path.relative(ROOT, CURRENT), textSha256: sha256(text) });
    if (st) { methods.push({ id, scope: "Australia", ...st, methodUrl: meta.pdf, sourceCapture: file }); continue; }
    if (!/^IM_Nat_/.test(file)) continue;
    const source = { id, kind: "national", url: meta.pdf, text: file, baseDir: path.relative(ROOT, CURRENT) };
    documents.push({ id: source.id, kind: "current national report", url: meta.pdf, capture: source.text });
    // Current monthly reports feed the live Issues tab as well; this read adds
    // all their annual and reprinted tables without changing the IP_FIRST gate.
    const parsed = parseSource(source, CURRENT);
    reports.push(...parsed.reports); methods.push(...parsed.methods); documents.push(...parsed.documents); unread.push(...parsed.unread);
  }
  reports.sort((a, b) => `${a.scope}|${a.ym}|${a.source}`.localeCompare(`${b.scope}|${b.ym}|${b.source}`));
  methods.sort((a, b) => `${a.scope}|${a.ym}|${a.id}`.localeCompare(`${b.scope}|${b.ym}|${b.id}`));
  return { question: "What would you say are the three most important issues facing Australia today?",
    ownershipQuestion: "Please select the political party that you believe is most capable of managing each of the following issues",
    issueLabels: ISSUES, sources, reports, methods, documents, unread,
    coverage: { sources: sources.length, reports: reports.length, nationalReports: reports.filter((r) => r.scope === "Australia").length,
      stateReports: reports.filter((r) => r.scope !== "Australia").length,
      salienceRows: reports.reduce((n, r) => n + (r.salience?.length || 0), 0), methods: methods.length,
      firstNationalReport: reports.filter((r) => r.scope === "Australia").map((r) => r.ym).sort()[0] || null,
      lastNationalReport: reports.filter((r) => r.scope === "Australia").map((r) => r.ym).sort().at(-1) || null } };
}

function main() {
  const data = buildHistory(), text = JSON.stringify(data, null, 2) + "\n";
  const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text;
  if (changed && !CHECK) atomic(OUT, text);
  console.log("IPHISTORYDATA_STATUS " + JSON.stringify({ ...data.coverage, unread: data.unread.length, changed }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`IPHISTORYDATA_ERROR ${e.stack || e}`); process.exit(1); }
}
