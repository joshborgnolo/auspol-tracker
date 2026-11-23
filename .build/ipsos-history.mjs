#!/usr/bin/env node
/* Historical Ipsos Issues Monitor primary-source cache.

   The live Issues Monitor extractor deliberately starts at IP_FIRST. This
   separate cache keeps every verified legacy national/state pack, archived
   commentary and linked methodology statement without changing that gate. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = process.env.IPSOS_HISTORY_SRC || path.join(ROOT, ".build", "ipsos-history-src");
const FETCH = process.argv.includes("--fetch");
const idx = (base, tail) => `https://www.ipsos.com/sites/default/files/${base}${tail}`;
const NATIONAL = [
  ["national-2013-08", "top_issues_august13_national.pdf"],
  ["national-2013-09", "Ipsos-Issues-Monitor-National-Victoria-September-2013.pdf"],
  ["national-2013-12", "top_issues_dec13_national-vic1.pdf"],
  ["national-2014-03", "top_issues_mar14_National.pdf"],
  ["national-2014-06", "Ipsos-Issues-Monitor-April-to-June-2014-National1.pdf"],
  ["national-2014-09", "Ipsos-Issues-Monitor-July-to-September-2014-National.pdf"],
  ["national-2014-12", "Ipsos-Issues-Monitor-October-to-December-2014-National.pdf"],
  ["national-2015-03", "Ipsos-Issues-Monitor-January-to-March-2015-National.pdf"],
  ["national-2015-06", "Ipsos-Issues-Monitor-April-to-June-2015-National.pdf"],
  ["national-2015-09", "Ipsos-Issues-Monitor-July-to-September-2015-National.pdf"],
  ...[2016, 2017, 2018, 2019].map((year) => [`national-${year}`, `AU%20NATIONAL%20IPSOS%20ISSUES%20MONITOR%20-%20QUARTERLY%20REPORTS%20${year}.pdf`]),
  ...[2020, 2021, 2022, 2023].map((year) => [`national-${year}`, `AU%20NATIONAL%20IPSOS%20ISSUES%20MONITOR%20-%20JAN-DEC%20REPORTS%20${year}.pdf`]),
].map(([id, url]) => ({ id, kind: "national", url: idx("2017-07/", url) }));
for (const y of [2016, 2017, 2018, 2019]) NATIONAL.find((s) => s.id === `national-${y}`).url = idx("", `AU%20NATIONAL%20IPSOS%20ISSUES%20MONITOR%20-%20QUARTERLY%20REPORTS%20${y}.pdf`);
for (const y of [2020, 2021, 2022, 2023]) NATIONAL.find((s) => s.id === `national-${y}`).url = idx("", `AU%20NATIONAL%20IPSOS%20ISSUES%20MONITOR%20-%20JAN-DEC%20REPORTS%20${y}.pdf`);
NATIONAL.push({ id: "national-2024", kind: "national", url: idx("ct/publication/documents/2026-02/", "AU%20NATIONAL%20IPSOS%20ISSUES%20MONITOR%20-%20JAN-DEC%20REPORTS%202024.pdf") });
const STATES = [2016, 2017, 2018, 2019, 2020, 2021, 2022].map((year) => ({ id: `states-${year}`, kind: "states",
  url: idx("", `AU%20STATES%20IPSOS%20ISSUES%20MONITOR%20-%20QUARTERLY%20REPORTS%20${year}.pdf`) }));
STATES.push({ id: "states-2023", kind: "states", url: idx("2024-03/", "AU%20STATES%20IPSOS%20ISSUES%20MONITOR%20-%20QUARTERLY%20REPORTS%202023.pdf") });
STATES.push({ id: "states-2024", kind: "states", url: idx("ct/publication/documents/2026-02/", "AU%20STATES%20IPSOS%20ISSUES%20MONITOR%20-%20QUARTERLY%20REPORTS%202024.pdf") });
const LEGACY_STATES = [
  ["2014-q1-nsw", "Ipsos-Issues-Monitor-January-to-March-2014-New-South-Wales.pdf"],
  ["2014-q1-victoria", "top_issues_mar14_National_Vic.pdf"],
  ["2014-q1-queensland", "Ipsos-Issues-Monitor-January-to-March-2014-Queensland.pdf"],
  ["2014-q1-wa", "Ipsos-Issues-Monitor-January-to-March-2014-Western-Australia.pdf"],
  ["2014-q2-nsw", "Ipsos-Issues-Monitor-April-to-June-2014-New-South-Wales.pdf"],
  ["2014-q2-queensland", "Ipsos-Issues-Monitor-April-to-June-2014-Queensland.pdf"],
  ["2014-q3-nsw", "Ipsos-Issues-Monitor-July-to-September-2014-New-South-Wales.pdf"],
  ["2014-q3-victoria", "Ipsos-Issues-Monitor-July-to-September-2014-National-Victoria.pdf"],
  ["2014-q4-nsw", "Ipsos-Issues-Monitor-October-to-December-2014-New-South-Wales.pdf"],
  ["2014-q4-victoria", "Ipsos-Issues-Monitor-October-to-December-2014-Victoria.pdf"],
  ["2015-q1-nsw", "Ipsos-Issues-Monitor-January-to-March-2015-New-South-Wales.pdf"],
  ["2015-q1-victoria", "Ipsos-Issues-Monitor-January-to-March-2015-National-Victoria.pdf"],
  ["2015-q2-nsw", "Ipsos-Issues-Monitor-April-to-June-2015-New-South-Wales.pdf"],
  ["2015-q2-victoria", "Ipsos-Issues-Monitor-April-to-June-2015-Victoria.pdf"],
  ["2015-q2-queensland", "Ipsos-Issues-Monitor-April-to-June-2015-Queensland.pdf"],
  ["2015-q3-nsw", "Ipsos-Issues-Monitor-July-to-September-2015-New-South-Wales.pdf"],
  ["2015-q3-victoria", "Ipsos-Issues-Monitor-July-to-September-2015-National-Victoria.pdf"],
].map(([id, file]) => ({ id: `states-${id}`, kind: "states", url: idx("2017-07/", file) }));
const COMMENTARY = { id: "national-commentaries", kind: "commentary",
  url: idx("", "Ipsos%20Issues%20Monitor%20-%20Archived%20Commentaries_2.pdf") };
export const HISTORICAL_SOURCES = [...NATIONAL, ...STATES, ...LEGACY_STATES, COMMENTARY];
const STATEMENT_INDEX = "https://www.ipsos.com/en-au/polling-methodology-disclosure-statements";

async function fetchBytes(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; auspol-tracker-ipsos-history/1.0)" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (e) { last = e; }
  }
  throw new Error(`${url}: ${last?.message || last}`);
}
function linksOf(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/\b(?:data-f=")?href\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
    if (!href) continue;
    const url = (href[2] || href[3] || "").replace(/&amp;/g, "&");
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const searchable = `${text} ${decodeURIComponent(url)}`.replace(/[_+-]+/g, " ");
    if (/\.pdf/i.test(url) && /issues monitor/i.test(searchable)) out.push({ url, text });
  }
  return out;
}
export async function statementSources() {
  const html = (await fetchBytes(STATEMENT_INDEX)).toString("utf8");
  const seen = new Set(), out = [];
  for (const link of linksOf(html)) {
    if (seen.has(link.url) || !link.url.startsWith("https://www.ipsos.com/")) continue;
    seen.add(link.url);
    const key = crypto.createHash("sha1").update(link.url).digest("hex").slice(0, 8);
    out.push({ id: `statement-${key}`, kind: "statement", url: link.url, linkText: link.text });
  }
  return out;
}
function pdftotext(pdf) {
  const r = spawnSync("pdftotext", ["-layout", "-", "-"], { input: pdf, maxBuffer: 64 * 1024 * 1024 });
  if (r.error?.code === "ENOENT") throw new Error("pdftotext not installed (port install poppler; CI install-poppler.yml)");
  if (r.status !== 0) throw new Error(r.stderr?.toString() || `pdftotext exited ${r.status}`);
  return r.stdout.toString("utf8");
}
const atomic = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", text); fs.renameSync(file + ".tmp", file); };

async function main() {
  const previous = fs.existsSync(path.join(SRC, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")) : { sources: [] };
  const prior = new Map(previous.sources.map((s) => [s.id, s]));
  let sources = HISTORICAL_SOURCES.map((s) => ({ ...s }));
  if (FETCH) sources.push(...await statementSources());
  else sources.push(...previous.sources.filter((s) => s.kind === "statement").map((s) => ({ ...s })));
  const fetched = [], warnings = [];
  for (const source of sources) {
    const file = source.id + ".txt";
    if (fs.existsSync(path.join(SRC, file))) continue;
    if (!FETCH) { warnings.push(`${source.id} not cached; run --fetch`); continue; }
    try {
      const pdf = await fetchBytes(source.url);
      if (!pdf.subarray(0, 5).toString().startsWith("%PDF-")) throw new Error(`not a PDF (${pdf.subarray(0, 32).toString()})`);
      const text = pdftotext(pdf);
      if (!/Ipsos|IPSOS/i.test(text)) throw new Error("PDF text has no Ipsos anchor");
      const record = { ...source, text: file, sha256: crypto.createHash("sha256").update(pdf).digest("hex"), storedAt: new Date().toISOString() };
      Object.assign(source, record);
      atomic(path.join(SRC, file), text);
      fetched.push(source.id);
    } catch (e) { warnings.push(`${source.id}: ${String(e.message || e).slice(0, 240)}`); }
  }
  const emit = sources.flatMap((s) => {
    const text = s.text || (fs.existsSync(path.join(SRC, s.id + ".txt")) ? s.id + ".txt" : null);
    if (!text || !fs.existsSync(path.join(SRC, text))) return [];
    const old = prior.get(s.id) || {};
    return [{ ...old, ...s, text, sha256: s.sha256 || old.sha256 || null, storedAt: s.storedAt || old.storedAt || null }];
  });
  const manifest = { sources: emit.sort((a, b) => a.id.localeCompare(b.id)) };
  if (FETCH || fs.existsSync(path.join(SRC, "manifest.json"))) atomic(path.join(SRC, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("IPHISTORY_STATUS " + JSON.stringify({ expected: sources.length, cached: manifest.sources.length, fetched, warnings }));
  if (warnings.length) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
