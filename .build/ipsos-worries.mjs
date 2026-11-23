#!/usr/bin/env node
/* Ipsos What Worries the World — Australia/global worry tables.

   Reads the primary PDF text captures already owned by ipsos-direction.mjs.
   Keeps every printed Australian and publisher-global worry share, including
   partial decks, without treating an unprinted issue as zero. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Guard, buildData, countrySamples, fieldworkOf, reportMonth, sampleOf } from "./ipsos-direction.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = process.env.IPSOS_DIRECTION_SRC || path.join(ROOT, ".build", "ipsos-direction-src");
const OUT = process.env.IPSOS_WORRIES_OUT || path.join(ROOT, "data", "ipsos-worries.json");
const CHECK = process.argv.includes("--check");
const guard = (condition, message) => { if (!condition) throw new Guard(message); };
const unique = (a) => [...new Set(a)];
const compact = (s) => s.replace(/\s+/g, " ").trim();
const atomic = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", text);
  fs.renameSync(file + ".tmp", file);
};

export const WORRIES_QUESTION = "Which three of the following topics do you find the most worrying in your country?";
const TOPICS = [
  ["unemployment", "Unemployment and jobs", "unemployment", "unemployment and jobs", "unemployment & jobs"],
  ["corruption", "Financial/political corruption", "financial/political corruption", "financial and political corruption"],
  ["inequality", "Poverty & social inequality", "poverty & social inequality", "poverty and social inequality"],
  ["crime", "Crime & violence", "crime & violence", "crime and violence"],
  ["healthcare", "Healthcare", "healthcare", "health care"],
  ["terrorism", "Terrorism", "terrorism"],
  ["education", "Education", "education"],
  ["taxes", "Taxes", "taxes", "tax"],
  ["immigration", "Immigration control", "immigration control"],
  ["moralDecline", "Moral decline", "moral decline"],
  ["inflation", "Inflation", "inflation"],
  ["extremism", "Rise of extremism", "rise of extremism"],
  ["socialProgrammes", "Maintaining social programmes", "maintaining social programmes", "maintaining social programs"],
  ["environment", "Threats against the environment", "threats against the environment", "threats to the environment"],
  ["climate", "Climate change", "climate change"],
  ["obesity", "Childhood obesity", "childhood obesity"],
  ["credit", "Access to credit", "access to credit"],
  ["coronavirus", "Coronavirus (COVID-19)", "coronavirus (covid-19)", "coronavirus", "covid-19"],
  ["militaryConflict", "Military conflict between nations", "military conflict between nations"],
].map(([key, label, ...aliases]) => ({ key, label, aliases: unique([label, ...aliases]) }));
const norm = (s) => compact(String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, "-")
  .replace(/^\s*(?:\d+\s*[.|]|\d+\s+)\s*/, "").replace(/\s+/g, " "));
const BY_LABEL = new Map();
for (const topic of TOPICS) for (const alias of topic.aliases) {
  const n = norm(alias);
  guard(!BY_LABEL.has(n) || BY_LABEL.get(n) === topic, `duplicate worry label ${n}`);
  BY_LABEL.set(n, topic);
}
const topicOf = (label) => BY_LABEL.get(norm(label)) || null;
const change = (s) => s === "=" ? 0 : s === "N/A" ? null : Number(s.replace("%", ""));
function changesAfter(tail, wantYear) {
  const tokens = compact(tail.replace(/[↑↓▲▼]/g, " ")).split(" ").filter(Boolean);
  while (/^[ pq=]+$/i.test(tokens[0] || "") && tokens[0] !== "=") tokens.shift();
  const cells = [];
  while (cells.length < 2 && /^(?:=|N\/A|[+-]\d+(?:\.\d+)?)$/.test(tokens[0] || "")) cells.push(change(tokens.shift()));
  const out = {};
  if (cells.length) out.changeMonth = cells[0];
  if (wantYear && cells.length > 1) out.changeYear = cells[1];
  return out;
}
function rowAfter(line, at, wantYear) {
  const rest = line.slice(at).match(/^\s*(\d+(?:\.\d+)?)%([\s\S]*)$/);
  if (!rest) return null;
  return { share: Number(rest[1]), ...changesAfter(rest[2], wantYear) };
}

function issueTableTitle(page) {
  const lines = page.split("\n");
  const header = lines.find((line) => /\bCountry\s+%\s+choosing\s+[^%]+?\s+as\s+a\s+worry/i.test(line));
  let m = header && header.match(/%\s+choosing\s+([^%\n]+?)\s+as\s+a\s+worry/i);
  if (m) return m[1];
  for (const line of lines.slice(0, 20)) {
    m = line.match(/^\s*\d+\s*[.|]\s*([A-Za-z][A-Za-z0-9/& ()'-]+?)\s*$/);
    if (m) return m[1];
  }
  return null;
}

/* Each per-worry country-comparison page prints its topic and a World row;
   most also print every participating country, Australia included. */
function issueRows(page, source, read) {
  const title = issueTableTitle(page);
  const topic = title && topicOf(title);
  const countryCells = /^\s*(?:World|Global Country Average|Australia)\s+\d+(?:\.\d+)?%/im.test(page);
  if (title && !topic && countryCells && /% choosing|% worried/i.test(page)) throw new Guard(`unmapped worry table title: ${title}`);
  if (!topic) return [];
  const hasMonth = /previous month|last month|% change|Change from/i.test(page);
  const hasYear = /12-month|last year/i.test(page);
  const out = [];
  for (const line of page.split("\n")) {
    for (const [scope, names] of [["globalAverage", ["World", "Global Country Average"]], ["australia", ["Australia"]]]) {
      for (const name of names) {
        const m = line.match(new RegExp(`(?:^|\\s)${name.replace(" ", "\\s+")}\\s+`, "i"));
        if (!m) continue;
        const row = rowAfter(line, m.index + m[0].length, hasYear);
        if (!row) continue;
        if (!hasMonth) { delete row.changeMonth; delete row.changeYear; }
        out.push({ scope, topic, ...row, read,
          sources: [{ sourceUrl: source.retrievedUrl || source.url, capture: source.text }] });
      }
    }
  }
  return out;
}

const FULL_LIST = /WORLD WORRIES:\s*THE FULL LIST|Worries:\s+Full\s+List|% mentioned in\s+[A-Za-z]+\s+\d{4}|Worry\s+% mentioned/i;
const GLOBAL_PAGE = new RegExp(`GLOBAL SUMMARY:|WORLD SUMMARY:|${FULL_LIST.source}|Global Country Average|^\\s*WORLD WORRIES\\s*$`, "im");
function globalRows(page, source) {
  if (!GLOBAL_PAGE.test(page)) return [];
  if (/COUNTRY SPOTLIGHT|GREAT BRITAIN SUMMARY|COUNTRY CASE STUDY/i.test(page)) return [];
  if (!FULL_LIST.test(page) && !/Which three[\s\S]{0,1000}most worrying/i.test(page)) return [];
  if (!/(?:Mentioned in\s+[A-Za-z]+\s+\d{4}\s*\(%\)|GLOBAL SUMMARY:|WORLD SUMMARY:|Top five worries|^\s*WORLD WORRIES\s*$)/im.test(page) && !FULL_LIST.test(page)) return [];
  const filter = page.match(/Filter:\s*Country:\s*([^|\n]+)/i);
  if (filter && !/^\s*World\s*$/i.test(filter[1])) return [];
  const wantYear = /12-month|last year/i.test(page), out = [];
  const emit = (topic, share, tail, read = "global worry list") => out.push({ scope: "globalAverage", topic,
    share: Number(share), ...changesAfter(tail, wantYear), read,
    sources: [{ sourceUrl: source.retrievedUrl || source.url, capture: source.text }] });
  const lines = page.split("\n");
  const topFiveCurrent = /Top five worries/i.test(page) && !/long-term trend/i.test(page);
  if (!topFiveCurrent) for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9/&() ,'’-]*?)\s{2,}(\d+(?:\.\d+)?)%([\s\S]*)$/);
    if (!m) continue;
    const topic = topicOf(m[1]);
    if (topic) emit(topic, m[2], m[3]);
  }
  if (/Top five worries/i.test(page) && /Global Country Average/i.test(page) && !/long-term trend/i.test(page)) {
    let pending = null;
    for (const line of lines) {
      const heading = headingAt(line).find((h) => h.index < 20);
      if (heading) {
        const rest = line.slice(heading.end), row = rest.match(/^\s{0,24}(\d+(?:\.\d+)?)%([\s\S]*)$/);
        if (row) emit(heading.topic, row[1], row[2], "global top-five table");
        else pending = heading.topic;
        continue;
      }
      const m = pending && line.match(/^\s*(\d+(?:\.\d+)?)%([\s\S]*)$/);
      if (m) { emit(pending, m[1], m[2], "global top-five table"); pending = null; }
    }
  }
  return out;
}

function headingAt(line) {
  const candidates = [];
  for (const topic of TOPICS) for (const alias of topic.aliases) {
    const re = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi");
    for (const m of line.matchAll(re)) {
      if (m.index === 0 || /^\s/.test(line[m.index - 1])) candidates.push({ topic, index: m.index, end: m.index + m[0].length });
    }
  }
  candidates.sort((a, b) => a.index - b.index || b.end - a.end);
  return candidates.filter((h, i) => !candidates.slice(0, i).some((x) => h.index >= x.index && h.end <= x.end));
}

/* The 2026 short decks have no full Australian table. Their Top concerns by
   country page nevertheless prints Australia under a worry's heading. Use
   the bullet's printed column to associate it, never the row/order alone. */
function spotlightRows(page, source) {
  if (!/Top concerns by country/i.test(page)) return [];
  const lines = page.split("\n"), headings = [];
  for (const [lineNo, line] of lines.entries())
    for (const h of headingAt(line)) headings.push({ ...h, lineNo });
  const out = [];
  for (const [lineNo, line] of lines.entries()) {
    for (const m of line.matchAll(/•\s*Australia\s*\((\d+(?:\.\d+)?)\s*%\)/gi)) {
      const eligible = headings.filter((h) => h.lineNo < lineNo && h.index <= m.index + 8);
      const rightmost = eligible.length ? Math.max(...eligible.map((h) => h.index)) : -1;
      const column = eligible.filter((h) => h.index === rightmost).sort((a, b) => b.lineNo - a.lineNo)[0];
      guard(column, `${source.text}: Australia spotlight has no worry heading`);
      out.push({ scope: "australia", topic: column.topic, share: Number(m[1]), read: "top concern by country",
        sources: [{ sourceUrl: source.retrievedUrl || source.url, capture: source.text }] });
    }
  }
  return out;
}

export function parseWorriesReport(text, source = {}) {
  const month = reportMonth(text, source);
  const observations = [];
  for (const [pageNo, page] of text.split("\f").entries()) {
    const at = { ...source, text: source.text, page: pageNo + 1 };
    observations.push(...issueRows(page, at, "worry country comparison"));
    observations.push(...globalRows(page, at));
    observations.push(...spotlightRows(page, at));
  }
  return { month, observations };
}

const ALL_CODES = ["AR", "AU", "BE", "BR", "CA", "CL", "CN", "CO", "FR", "DE", "GB", "HU", "IN", "ID", "IE", "IL", "IT", "JP", "MY", "MX", "NL", "PE", "PL", "RU", "SA", "RS", "SG", "ZA", "KR", "ES", "SE", "TH", "TR", "US"].map((code) => ({ code }));
function comparisonVariants(row) {
  if (row._comparisonVariants) return row._comparisonVariants;
  const variants = {};
  for (const field of ["changeMonth", "changeYear"]) if (Object.hasOwn(row, field))
    variants[field] = [{ value: row[field], sources: row.sources }];
  return variants;
}
function shareVariants(row) {
  return row._shareVariants || [{ share: row.share, read: row.read, sources: row.sources }];
}
function preferredShare(variants) {
  const rank = (v) => v.read.startsWith("worry country comparison") ? 0 : v.read.startsWith("top concern") ? 1 : 2;
  return [...variants].sort((a, b) => rank(a) - rank(b) || a.sources[0].capture.localeCompare(b.sources[0].capture))[0];
}
function mergeObservation(a, b, month) {
  const _comparisonVariants = {};
  for (const field of ["changeMonth", "changeYear"]) {
    const av = comparisonVariants(a)[field] || [], bv = comparisonVariants(b)[field] || [];
    if (av.length || bv.length) _comparisonVariants[field] = [...av, ...bv];
  }
  const _shareVariants = unique([...shareVariants(a), ...shareVariants(b)].map((v) => JSON.stringify(v))).map(JSON.parse);
  const sources = unique([...a.sources, ...b.sources].map((s) => JSON.stringify(s))).map(JSON.parse);
  const merged = { ...a, share: preferredShare(_shareVariants).share, _shareVariants, _comparisonVariants,
    read: unique([...a.read.split(" + "), ...b.read.split(" + ")]).sort().join(" + "), sources };
  delete merged.changeMonth;
  delete merged.changeYear;
  return merged;
}

export function buildWorriesData(manifest, srcDir = SRC) {
  const direction = new Map(buildData(manifest, srcDir).waves.map((w) => [w.month, w]));
  const waves = new Map(), unread = [];
  for (const source of manifest.sources) {
    const text = fs.readFileSync(path.join(srcDir, source.text), "utf8");
    const parsed = parseWorriesReport(text, source);
    if (!parsed.observations.length) { unread.push({ month: parsed.month, sourceUrl: source.url, capture: source.text }); continue; }
    const wave = waves.get(parsed.month) || { month: parsed.month, sources: [], observations: new Map(), text };
    wave.sources.push({ sourceUrl: source.retrievedUrl || source.url, originalUrl: source.url, capture: source.text, sha256: source.sha256 });
    for (const row of parsed.observations) {
      const key = `${row.scope}|${row.topic.key}`;
      wave.observations.set(key, wave.observations.has(key) ? mergeObservation(wave.observations.get(key), row, parsed.month) : row);
    }
    waves.set(parsed.month, wave);
  }
  const out = [];
  for (const wave of [...waves.values()].sort((a, b) => a.month.localeCompare(b.month))) {
    const d = direction.get(wave.month);
    const meta = d || (() => {
      const dates = fieldworkOf(wave.text, compact(wave.text), wave.month);
      let au = null;
      try { au = countrySamples(wave.text, ALL_CODES).AU || null; } catch (e) { throw new Guard(`${wave.month}: ${e.message}`); }
      return { ...dates, globalAverage: { sample: sampleOf(compact(wave.text)) }, australia: au || { sample: null } };
    })();
    const observations = [...wave.observations.values()];
    const comparisons = (r) => {
      const out = {}, comparisonConflicts = {};
      for (const [field, raw] of Object.entries(comparisonVariants(r))) {
        const variants = unique(raw.map((v) => JSON.stringify(v))).map(JSON.parse);
        const values = unique(variants.map((v) => JSON.stringify(v.value)));
        if (values.length === 1) out[field] = variants[0].value;
        else comparisonConflicts[field] = variants;
      }
      return { ...out, ...(Object.keys(comparisonConflicts).length ? { comparisonConflicts } : {}) };
    };
    const row = (scope) => observations.filter((r) => r.scope === scope).map((r) => {
      const variants = shareVariants(r);
      const differentShares = unique(variants.map((v) => v.share)).length > 1;
      return {
        issue: r.topic.key, label: r.topic.label, share: r.share, ...comparisons(r),
        ...(differentShares ? { shareVariants: variants } : {}),
        read: r.read, sources: r.sources,
      };
    }).sort((a, b) => TOPICS.findIndex((t) => t.key === a.issue) - TOPICS.findIndex((t) => t.key === b.issue));
    out.push({ month: wave.month, start: meta.start || null, end: meta.end || null, fieldwork: meta.fieldwork || null,
      source: "Ipsos What Worries the World", sources: wave.sources.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl)),
      sample: { globalAverage: meta.globalAverage.sample ?? null,
        australia: meta.australia.sample ?? null, ...(meta.australia.sampleApprox ? { australiaApprox: true } : {}) },
      australia: row("australia"), globalAverage: row("globalAverage") });
  }
  return { question: WORRIES_QUESTION, waves: out,
    coverage: { reports: manifest.sources.length,
      waves: out.length, wavesWithAustralia: out.filter((w) => w.australia.length).length,
      australiaObservations: out.reduce((n, w) => n + w.australia.length, 0),
      globalObservations: out.reduce((n, w) => n + w.globalAverage.length, 0),
      first: out[0]?.month || null, last: out.at(-1)?.month || null },
    unread };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
  const built = buildWorriesData(manifest);
  const text = JSON.stringify(built, null, 2) + "\n";
  const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text;
  if (changed && !CHECK) atomic(OUT, text);
  console.log("IPWORRIES_STATUS " + JSON.stringify({ ...built.coverage, unread: built.unread.length, changed }));
}
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);
if (!LIB_MODE) {
  try { main(); } catch (e) { console.error(`IPWORRIES_ERROR ${e.stack || e}`); process.exit(e instanceof Guard ? 2 : 1); }
}
