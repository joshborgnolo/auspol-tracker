#!/usr/bin/env node
/* Ipsos What Worries the World — deterministic national-direction reader.

   Offline default: reads only committed pdftotext -layout caches in
   .build/ipsos-direction-src and writes data/ipsos-direction.json.
   --fetch discovers primary global-summary PDFs from Ipsos's own current and
   archive pages, downloads each PDF to a temporary file and caches its text;
   no model and no hand-keyed polling figures are on this path.

   Data schema and quantile conventions are documented at the exports below
   and in .build/ipsos-direction-README.md. Run the focused pins with
   node .build/test-ipsos-direction.mjs. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const FETCH = process.argv.includes("--fetch");
const CHECK = process.argv.includes("--check");
const SRC = process.env.IPSOS_DIRECTION_SRC || path.join(ROOT, ".build", "ipsos-direction-src");
const OUT = process.env.IPSOS_DIRECTION_OUT || path.join(ROOT, "data", "ipsos-direction.json");
const ORIGIN = "https://www.ipsos.com";
const CURRENT_PAGE = `${ORIGIN}/en/what-worries-world`;
const TOPIC_PAGE = `${ORIGIN}/en/topic/what-worries-world`;
const UA = "Mozilla/5.0 (auspol-tracker data update)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unique = (a) => [...new Set(a)];
const slug = (s) => decodeURIComponent(s).replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
const atomic = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", text); fs.renameSync(file + ".tmp", file); };

async function get(url, { attempts = 5 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(90_000), redirect: "follow" });
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`);
        if (![429, 500, 502, 503, 504].includes(res.status)) throw e;
        last = e;
        if (res.status === 429) {
          const raw = res.headers.get("retry-after");
          const secs = raw && (/^\d+$/.test(raw) ? Number(raw) : (Date.parse(raw) - Date.now()) / 1000);
          if (secs > 120) throw new Error(`HTTP 429 with Retry-After ${raw}; refusing to hammer the CDN`);
          if (secs > 0) await sleep(secs * 1000);
        }
      } else return Buffer.from(await res.arrayBuffer());
    } catch (e) { last = e; }
    if (i + 1 < attempts) await sleep(1000 * (i + 1));
  }
  throw new Error(`${url}: ${last?.message || "fetch failed"}`);
}

function curlGet(url) {
  try {
    return execFileSync("curl", ["-fLsS", "--retry", "2", "--retry-delay", "2", "--max-time", "120", "-A", UA, url],
      { maxBuffer: 1 << 28 });
  } catch (e) { throw new Error(`curl ${url}: ${String(e.message).slice(0, 200)}`); }
}
async function downloadUrl(url, options = {}) {
  try { return await get(url, options); }
  catch (e) { try { return curlGet(url); } catch { throw e; } }
}

function pdftotext(buf, id) {
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    const tmp = path.join(os.tmpdir(), `${id}-${process.pid}.pdf`);
    try {
      fs.writeFileSync(tmp, buf);
      return execFileSync(bin, ["-layout", tmp, "-"], { encoding: "utf8", maxBuffer: 1 << 27 });
    } catch (e) {
      if (e.code !== "ENOENT") throw new Error(`pdftotext failed for ${id}: ${String(e.message).slice(0, 240)}`);
    } finally { fs.rmSync(tmp, { force: true }); }
  }
  throw new Error("pdftotext (poppler) not found");
}

const htmlLinks = (html) => [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1].replaceAll("&amp;", "&"));
const absolute = (href, base = CURRENT_PAGE) => new URL(href, base).href;
const PDF = /\.pdf(?:\?.*)?$/i;
function reportCandidate(url) {
  // Secondary country decks, press releases, COVID annexes and annual review
  // essays are not the monthly global-country table. Do not infer their data.
  const u = decodeURIComponent(url);
  return PDF.test(u) && !/(?:covid|\/www-pr|www-[^/]*-pr(?:-|\.)|\/pr-|KSA|Saudi|South-Korea|Ipsos_Views|What_Worries_the_World-2018\.pdf)/i.test(u);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let at = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (at < items.length) { const i = at++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/* Discover, rather than enumerate, the monthly corpus. The main article is a
   rolling download library; its Marketo landing page carries the newest wave.
   The Drupal topic archive links every older monthly article. Stop after two
   consecutive pages with no new article (not after a transient fetch error). */
export async function discover() {
  const records = new Map();
  const addPdf = (url, article) => {
    if (!reportCandidate(url)) return;
    const r = records.get(url) || { url, articles: [] };
    r.articles = unique([...r.articles, article]).sort(); records.set(url, r);
  };
  const readArticle = async (article) => {
    const html = (await get(article)).toString("utf8");
    const links = htmlLinks(html);
    for (const h of links) if (PDF.test(h)) addPdf(absolute(h, article), article);
    return links;
  };
  const mainLinks = await readArticle(CURRENT_PAGE);
  for (const h of mainLinks.filter((h) => /resources\.ipsos\.com\/.+Download\.html/i.test(h))) {
    const u = absolute(h); await readArticle(u);
  }
  let empty = 0;
  const articles = new Set();
  for (let page = 0; empty < 2 && page < 40; page++) {
    const u = `${TOPIC_PAGE}${page ? `?page=${page}` : ""}`;
    const links = htmlLinks((await get(u)).toString("utf8"));
    const found = links.map((h) => absolute(h, u)).filter((h) => /^https:\/\/www\.ipsos\.com\/en\/what-worries-world-.+/i.test(h));
    const before = articles.size; for (const a of found) articles.add(a);
    empty = articles.size === before ? empty + 1 : 0;
  }
  // Annual /2016 and /2017 pages host review essays, not monthly tables.
  articles.delete(`${ORIGIN}/en/what-worries-world-2016`);
  articles.delete(`${ORIGIN}/en/what-worries-world-2017`);
  await mapLimit([...articles].sort(), 2, (article) => readArticle(article).catch((e) => {
    console.log(`IPDIR_WARNING discovery ${article}: ${e.message}`);
  }));
  return [...records.values()].sort((a, b) => a.url.localeCompare(b.url));
}

const WAVE_MONTH = /(january|february|march|april|may|june|july|august|september|october|november|december)[-_ ]?(\d{4}|\d{2})(?:\D|$)/i;
function monthFromPdfName(url) {
  const m = decodeURIComponent(new URL(url).pathname.split("/").pop()).match(WAVE_MONTH);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) + 1;
  if (month < 1) return null;
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${year}-${String(month).padStart(2, "0")}`;
}

/* Recovery changes provenance, never a figure. A missing/retiring Ipsos URL
   can be replaced only by another primary PDF found through a same-wave
   regional Ipsos article or an archived capture of that exact primary URL. */
async function recoverPdf(original) {
  try {
    const q = new URLSearchParams({ url: original, output: "json", fl: "timestamp,original,statuscode,mimetype",
      filter: "statuscode:200", collapse: "digest" });
    const rows = JSON.parse((await get(`https://web.archive.org/cdx/search/cdx?${q}`, { attempts: 2 })).toString("utf8"));
    if (Array.isArray(rows) && rows.length > 1) {
      const latest = rows.at(-1)[0];
      const archived = `https://web.archive.org/web/${latest}id_/${original}`;
      const buf = await downloadUrl(archived, { attempts: 2 });
      if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { buf, retrievedUrl: archived, recovery: "wayback" };
    }
  } catch { /* try the live regional mirrors next */ }
  const month = monthFromPdfName(original);
  if (month) {
    const [year, mm] = month.split("-");
    const name = MONTHS[Number(mm) - 1].toLowerCase();
    for (const locale of ["en-id", "en-nl", "ko-kr"]) {
      const article = `https://www.ipsos.com/${locale}/what-worries-world-${name}-${year}`;
      let links;
      try { links = htmlLinks((await downloadUrl(article, { attempts: 2 })).toString("utf8")); } catch { continue; }
      const pdfs = unique(links.map((h) => absolute(h, article)).filter((u) => reportCandidate(u) && monthFromPdfName(u) === month));
      for (const retrievedUrl of pdfs) {
        try {
          const buf = await downloadUrl(retrievedUrl, { attempts: 3 });
          if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { buf, retrievedUrl, recovery: "regional-mirror", article };
        } catch { /* next primary mirror */ }
      }
    }
  }
  throw new Error(`no verifiable primary recovery for ${original}`);
}

async function refresh() {
  fs.mkdirSync(SRC, { recursive: true });
  const prior = fs.existsSync(path.join(SRC, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")) : { sources: [], failures: [] };
  let candidates;
  try { candidates = await discover(); }
  catch (e) {
    console.log(`IPDIR_WARNING discovery pass: ${e.message}; using the committed candidate list`);
    candidates = [];
  }
  // A transient archive-page failure cannot erase already discovered history.
  const oldCandidates = [...(prior.sources || []), ...(prior.failures || [])];
  candidates = [...new Map([...oldCandidates, ...candidates].map((c) => [c.url, c])).values()]
    .sort((a, b) => a.url.localeCompare(b.url));
  console.log(`IPDIR_DISCOVER ${candidates.length} primary-report candidates`);
  const byUrl = new Map((prior.sources || []).map((s) => [s.url, s]));
  // Ipsos's CDN rate-limits bursts; serial downloads keep a refresh reliable.
  const results = await mapLimit(candidates, 1, async (c) => {
    const name = slug(new URL(c.url).pathname.split("/").pop());
    const id = `${name}-${crypto.createHash("sha256").update(c.url).digest("hex").slice(0, 8)}`;
    const old = byUrl.get(c.url);
    if (old?.text && old.sha256 && fs.existsSync(path.join(SRC, old.text))) return { ...old, articles: c.articles, cached: true };
    try {
      let download;
      try { download = { buf: await downloadUrl(c.url), retrievedUrl: c.url, recovery: "original" }; }
      catch { download = await recoverPdf(c.url); }
      const { buf, retrievedUrl, recovery, article } = download;
      if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not a PDF");
      const text = pdftotext(buf, id);
      const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
      const file = `${id}.txt`;
      // Identical re-links need not rewrite a committed cache.
      if (old?.sha256 !== sha256 || !fs.existsSync(path.join(SRC, file))) atomic(path.join(SRC, file), text);
      return { id, url: c.url, retrievedUrl, recovery, discoveryArticles: c.articles,
        articles: unique([...c.articles, ...(article ? [article] : [])]), text: file, bytes: buf.length, sha256,
        fetchedAt: old?.fetchedAt || new Date().toISOString(), cached: false };
    } catch (e) { return { id, url: c.url, articles: c.articles, error: e.message }; }
  });
  const failures = results.filter((r) => r.error);
  const sources = results.filter((r) => !r.error).map(({ cached, ...r }) => r);
  const manifest = { version: 1, generatedAt: new Date().toISOString(), discoveryPages: [CURRENT_PAGE, TOPIC_PAGE], sources,
    failures: failures.map(({ id, url, articles, error }) => ({ id, url, articles, error })) };
  atomic(path.join(SRC, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`IPDIR_CACHE ${sources.length} cached, ${failures.length} failed`);
  if (failures.length) for (const f of failures) console.log(`IPDIR_WARNING ${f.url}: ${f.error}`);
  return manifest;
}

// ---------------------------------------------------------------- parsing
export class Guard extends Error {}
export class NoCountryTable extends Error {}
const guard = (condition, message) => { if (!condition) throw new Guard(message); };

const COUNTRIES = {
  argentina: "AR", australia: "AU", belgium: "BE", brazil: "BR", canada: "CA", chile: "CL", china: "CN",
  colombia: "CO", france: "FR", germany: "DE", "great britain": "GB", britain: "GB", hungary: "HU", india: "IN",
  indonesia: "ID", ireland: "IE", "republic of ireland": "IE", israel: "IL", italy: "IT", japan: "JP", malaysia: "MY",
  mexico: "MX", netherlands: "NL", peru: "PE", poland: "PL", russia: "RU", "saudi arabia": "SA", serbia: "RS", singapore: "SG",
  "south africa": "ZA", "south korea": "KR", korea: "KR", spain: "ES", sweden: "SE", thailand: "TH",
  turkey: "TR", "türkiye": "TR", us: "US", "united states": "US", "united states of america": "US",
};
const KNOWN_NAMES = ["World", "Global Country Average", ...Object.keys(COUNTRIES)]
  .sort((a, b) => b.length - a.length).map((s) => s.replace(/ /g, "\\s+")).join("|");
const KNOWN_AT = new RegExp(`(?:^|[^\\p{L}])(${KNOWN_NAMES})(?=$|[^\\p{L}])`, "giu");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const monthNo = (s) => MONTHS.findIndex((m) => m.toLowerCase().startsWith(s.slice(0, 3).toLowerCase())) + 1;
const MONTH_RE = MONTHS.join("|");
const ym = (month, year) => `${year}-${String(monthNo(month)).padStart(2, "0")}`;
const num = (s) => Number(s.replace(/,/g, ""));
const compact = (s) => s.replace(/\s+/g, " ").trim();

/* Every number below is read from the selected all-country table, never from
   a trend chart or a prose headline. Both chart generations print WRONG then
   RIGHT. Requiring the declared participating-country total prevents a lone
   readable Australia/World pair being filed after the rest of a table moved. */
export function directionTable(page, reportRoster = []) {
  const rows = [], unknown = [];
  const classify = (name, wrong, right) => {
    name = name.trim();
    if (/^(?:World|Global(?: Country)? Average)$/i.test(name)) return rows.push({ global: true, wrong, right });
    const code = COUNTRIES[name.toLowerCase()];
    if (!code) { unknown.push(name); return; }
    rows.push({ code, name, wrong, right });
  };
  let pending = [], orphans = [], unclaimed = null;
  const flush = () => {
    if (!pending.length) { orphans = []; return; }
    const missingWrong = pending.filter((r) => r.wrong == null);
    const partial = pending.filter((r) => r.wrong != null);
    const whole = missingWrong;
    guard(orphans.length === missingWrong.length + pending.length,
      `split country rows ${pending.map((r) => r.name).join("/")} have ${orphans.length} values, expected ${missingWrong.length + pending.length}`);
    let at = 0;
    for (const r of missingWrong) r.wrong = orphans[at++];
    // A partly-inline row's right cell precedes the wholly detached rows'
    // right cells in the PDF text stream (Thailand in October 2026).
    for (const r of partial) r.right = orphans[at++];
    for (const r of whole) r.right = orphans[at++];
    if (pending.some((r) => Math.abs(r.wrong + r.right - 100) > 1)) {
      // Usually text order preserves row order. June 2024's two-row block
      // swaps only the right cells: accept an alternative ordering of those
      // PRINTED cells only when exactly one permutation reconciles all pairs.
      // This is a uniqueness check, never arithmetic completion of a missing
      // figure. Partial-row groups are not candidates for this branch.
      guard(!partial.length && pending.length > 1 && pending.length <= 8,
        "split country rows cannot be uniquely reconciled");
      const rights = pending.map((r) => r.right), seen = new Set(), valid = [];
      const walk = (used, order) => {
        if (order.length === rights.length) {
          const key = order.join(",");
          if (seen.has(key)) return;
          seen.add(key);
          if (pending.every((r, i) => Math.abs(r.wrong + order[i] - 100) <= 1)) valid.push(order);
          return;
        }
        for (let i = 0; i < rights.length; i++) if (!used.has(i)) walk(new Set([...used, i]), [...order, rights[i]]);
      };
      walk(new Set(), []);
      guard(valid.length === 1, `split country-row ambiguity has ${valid.length} valid printed-cell orders`);
      for (let i = 0; i < pending.length; i++) pending[i].right = valid[0][i];
    }
    for (const r of pending) classify(r.name, r.wrong, r.right);
    pending = []; orphans = [];
  };
  const tableLines = page.split("\n");
  for (const [lineNo, original] of tableLines.entries()) {
    if (unclaimed && lineNo > unclaimed.lineNo + 2) unclaimed = null; // at most one blank line
    // The footer title ends in "World"; it is not another World table row.
    if (/What\s+Worries\s+the\s+World/i.test(original) || /^\s*(?:\d+\s*[‒–-])?\s*©\s*Ipsos/.test(original)
      || /^\s*World\s+[\d,]+\s*$/.test(original)
      || (original.trim() === "World" && /^\s*(?:c\.\s*)?[\d,]+\s*$/i.test(tableLines[lineNo + 1] || ""))) continue;
    // Detached cells come first in this text line; a right-hand prose column
    // may follow (and may itself quote another percentage). Only leading
    // table cells are read, before looking for names inside that prose.
    const orphan = original.match(/^\s*((?:\d+(?:\.\d+)?%\s*)+)/);
    if (orphan) {
      const values = [...orphan[1].matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
      if (pending.length) { orphans.push(...values); continue; }
      // A single country can occasionally have its pair emitted immediately
      // BEFORE its label (Poland, November 2021). Keep it adjacent and exact.
      unclaimed = { values, lineNo }; continue;
    }
    // Left-hand commentary/base columns sometimes share a pdftotext line
    // with a country. Align on a known label and keep its own two following
    // cells; an unknown new country still trips the generic-row guard below.
    const labels = [...original.matchAll(KNOWN_AT)].map((m) => {
      const start = m.index + m[0].length - m[1].length;
      // Prefer a label whose own next cell is a percentage. Thus a real
      // country cell after interleaved base text beats the base's mention of
      // "Global Country Average" (Israel, July 2024).
      const score = /^\s{1,120}\d+(?:\.\d+)?%/.test(original.slice(start + m[1].length)) ? 1 : 0;
      return { m, score };
    }).sort((a, b) => b.score - a.score || a.m.index - b.m.index);
    const at = labels[0]?.m;
    const labelAt = at ? at.index + at[0].length - at[1].length : 0;
    const prefix = original.slice(0, labelAt);
    // A prose mention flush against a preceding word ("countries are Peru")
    // is not a label in the chart's separate, space-aligned country column.
    if (at && /[\p{L}]/u.test(prefix) && !/\s{2,}$/.test(prefix)) continue;
    // All table-label generations begin in the left 120 text columns; lone
    // far-right names are commentary, even without a preceding prose word.
    if (at && labelAt > 120) continue;
    const line = at ? original.slice(labelAt) : original;
    const named = line.match(/^\s*([\p{Lu}][\p{L}]*(?:[ .&'\-][\p{L}]+){0,3})[ \t]{1,120}(\d+(?:\.\d+)?)%(?:\s+(\d+(?:\.\d+)?)%)?/u);
    if (named) {
      if (named[3] != null) { flush(); classify(named[1], Number(named[2]), Number(named[3])); }
      else {
        if (orphans.length) flush();
        pending.push({ name: named[1], wrong: Number(named[2]), right: null });
      }
      continue;
    }
    let name = line.replace(/\s+(?:Right(?: direction)?|Wrong (?:track|direction)|Commentary box)\s*$/i, "").trim();
    // With values detached, the same line can instead contain a far-right
    // commentary/change column. The label remains a row only when it starts
    // the aligned left-column fragment and is followed by a layout-sized gap.
    if (at && line.startsWith(at[1]) && /^\s{8,}/.test(line.slice(at[1].length))) name = at[1];
    if (/^(?:World|Global(?: Country)? Average)$/i.test(name) || COUNTRIES[name.toLowerCase()]) {
      if (unclaimed && !pending.length) {
        guard(unclaimed.values.length === 2, `pre-label detached row at ${name} has ${unclaimed.values.length} values`);
        classify(name, unclaimed.values[0], unclaimed.values[1]); unclaimed = null; continue;
      }
      // Consecutive labels followed by N wrong values then N right values are
      // the 2026 layout's split top rows. Keep the labels, columns and counts
      // together; never attach a nearby trend-chart percentage instead.
      if (orphans.length) flush();
      pending.push({ name, wrong: null, right: null }); continue;
    }
  }
  flush();
  guard(!unclaimed, "unmatched detached percentage cells at end of table");
  guard(!unknown.length, `unmapped country row(s): ${unique(unknown).join(", ")}`);
  guard(rows.filter((r) => r.global).length === 1, `direction table needs exactly one World/global-average row (found ${rows.filter((r) => r.global).length})`);
  const globalRows = rows.filter((r) => r.global);
  const countries = rows.filter((r) => !r.global);
  guard(countries.some((r) => r.code === "AU"), "direction table has no Australia row");
  const found = new Set(countries.map((r) => r.code));
  guard(found.size === countries.length, "duplicate country row in direction table");
  const text = compact(page);
  const declaredMatch = text.match(/(?:in\s+)?(\d+)(?:\s+participating)?\s+countries\b/i);
  const pageDeclared = Number(declaredMatch?.[1]);
  const declared = countries.length === pageDeclared ? pageDeclared : reportRoster.length === 1 ? reportRoster[0] : pageDeclared;
  guard(Number.isInteger(declared) && declared === countries.length,
    `country roster ${countries.length} != declared ${Number.isInteger(declared) ? declared : "missing"} [${countries.map((r) => r.code).join(",")}]`);
  for (const r of rows) {
    guard(r.right >= 0 && r.right <= 100 && r.wrong >= 0 && r.wrong <= 100, `${r.name || "World"}: share out of range`);
    guard(Math.abs(r.right + r.wrong - 100) <= 1, `${r.name || "World"}: printed pair ${r.wrong}/${r.right} does not reconcile to 100±1`);
  }
  return { global: globalRows[0], countries };
}

function datesOf(text) {
  const re = new RegExp(`(${MON}\\s+\\d+(?:st|nd|rd|th)?,?(?:\\s+20\\d{2})?),?\\s*(?:-|–|—|to|and)\\s*(${MON}\\s+\\d+(?:st|nd|rd|th)?,?(?:\\s+20\\d{2})?)`, "i");
  const m = text.match(re);
  if (!m) return { start: null, end: null, fieldwork: null };
  const fieldwork = compact(m[0]);
  const part = (s) => {
    const p = s.match(new RegExp(`^(${MON})\\s+(\\d+)(?:st|nd|rd|th)?,?(?:\\s+(20\\d{2}))?$`, "i"));
    return p ? { month: monthNo(p[1]), day: Number(p[2]), year: p[3] == null ? null : Number(p[3]) } : null;
  };
  const a = part(m[1]), b = part(m[2]);
  if (!a || !b || (a.year == null && b.year == null)) return { start: null, end: null, fieldwork };
  if (a.year == null) a.year = b.year - (a.month > b.month ? 1 : 0);
  if (b.year == null) b.year = a.year + (b.month < a.month ? 1 : 0);
  const iso = (p) => {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    return d.getUTCFullYear() === p.year && d.getUTCMonth() === p.month - 1 && d.getUTCDate() === p.day ? d.toISOString().slice(0, 10) : null;
  };
  const start = iso(a), end = iso(b);
  // A report's own inconsistent year is not silently repaired (June 2020's
  // long deck prints June 5th 2019): keep its verbatim fieldwork, lose end.
  return { start, end: start && end && end >= start ? end : null, fieldwork };
}

function sampleOf(text) {
  const m = text.match(/Representative sample of\s+(?:(c\.|approximately|about|over)\s*)?([\d,]+)\s+adults/i);
  if (m) return m[1] ? null : num(m[2]);
  // 2022–2023 display-list metadata can scramble the printed base into
  // "Base: | Whatsample Representative … World 19,486". Recover only the
  // exact total bounded by Base/Representative/adults/World/Source anchors.
  const odd = text.match(/Base:[\s\S]{0,80}?Representative[\s\S]{0,100}?adults[\s\S]{0,400}?World\s+(c\.\s*)?([\d,]+)\s+Source: Ipsos Global Advisor/i);
  return odd && !odd[1] ? num(odd[2]) : null;
}

/* Samples are report-specific printed groups, not achieved-count estimates.
   Crop the methodology's left text column before joining wrapped lines so a
   credibility-interval sidebar cannot become part of a country list. */
function methodologySampleText(text) {
  for (const page of text.split("\f")) {
    if (!/The sample consists of approximately|Approximately\s+1,000\+|Approximately\s+1000\+/i.test(page)) continue;
    const lines = page.split("\n");
    const start = lines.findIndex((l) => /The sample consists of approximately|Approximately\s+1,000\+|Approximately\s+1000\+/i.test(l));
    const out = [];
    for (const original of lines.slice(start, start + 30)) {
      if (/^\s{20,}/.test(original)) continue;
      const left = original.trimStart().replace(/^[•]\s*/, "").split(/[ \t]{5,}/)[0].trim();
      if (/^(?:Weighting has been employed|(?:The\s+)?Samples in |The data is weighted|Where results do not sum|When percentages)/i.test(left)) break;
      if (left) out.push(left);
    }
    return compact(out.join(" "));
  }
  return "";
}

export function countrySamples(text, countries) {
  let samples = {};
  const assign = (code, sample) => {
    if (!code) return;
    const value = { sample, sampleApprox: true };
    if (samples[code]) guard(samples[code].sample === sample, `conflicting sample groups for ${code}`);
    samples[code] = value;
  };
  const namesIn = (segment) => unique([...segment.matchAll(KNOWN_AT)].map((m) => COUNTRIES[m[1].toLowerCase()]).filter(Boolean));
  const paragraph = methodologySampleText(text);
  if (!paragraph) return samples;
  const roster = new Set(countries.map((c) => c.code));
  const addGroup = (segment, n) => {
    const codes = namesIn(segment);
    guard(codes.length > 0, `sample group has no country names: ${segment}`);
    for (const code of codes) { guard(roster.has(code), `sample group country ${code} is not in this wave`); assign(code, n); }
  };
  // Newer methodology: "1000+ individuals in each of X … and approximately
  // 500+ individuals in each of Y …" (or "1,000 individuals each in").
  const group = /(?:approximately\s+)?([\d,]+)\+?\s+individuals\s+(?:(?:in\s+)?each\s+in|in\s+each\s+of)\s+/gi;
  const matches = [...paragraph.matchAll(group)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i], start = m.index + m[0].length, end = matches[i + 1]?.index ?? paragraph.length;
    addGroup(paragraph.slice(start, end), num(m[1]));
  }
  let older = null;
  if (!matches.length) {
    // 2016-era methodology: every roster country is approximately 1,000+
    // EXCEPT an explicit 500+ list. Only then is default-to-rest justified.
    older = paragraph.match(/Approximately\s+(1000|1,000)\+?\s+individuals\s+participated[\s\S]*?with the exception of\s+([\s\S]+?)approximately\s+500\+/i);
    if (older) {
      const small = new Set(namesIn(older[2]));
      guard(small.size > 0, "the 2016-era 500+ exception list is unreadable");
      for (const code of small) assign(code, 500);
      for (const code of roster) if (!small.has(code)) assign(code, 1000);
    } else {
      // Other 2019–2020 waves apply the approximate 1,000+ statement to
      // EVERY roster country, explicitly "on a country by country basis".
      older = paragraph.match(/Approximately\s+(1000|1,000)\+?\s+individuals\s+participated\s+on\s+a\s+country\s+by\s+country\s+basis/i);
      if (older) for (const code of roster) assign(code, 1000);
    }
  }
  if (matches.length || older) guard(samples.AU, "a methodology sample paragraph is present but Australia is not covered");
  return samples;
}

export function reportMonth(text, source = {}) {
  const summaries = unique([...text.matchAll(new RegExp(`WORLD SUMMARY:\\s*(${MONTH_RE})\\s+(20\\d{2})`, "gi"))].map((m) => ym(m[1], m[2])));
  guard(summaries.length <= 1, `conflicting WORLD SUMMARY months: ${summaries.join(", ")}`);
  if (summaries.length) return summaries[0];
  const current = unique([...text.matchAll(/Current Wave:\s*([A-Za-z]{3})\s*(\d{2})/g)].map((m) => `20${m[2]}-${String(monthNo(m[1])).padStart(2, "0")}`));
  // 2025+ reports also carry their own month on the cover; Current Wave can
  // contain a copied-forward stale filter label, so require the cover value
  // to occur among Current Wave labels rather than picking the first label.
  const head = text.slice(0, 3000);
  const cover = head.match(new RegExp(`(?:WHAT[\\s\\S]{0,80}?WORRIES[\\s\\S]{0,80}?THE WORLD\\?|\\n)\\s*(${MONTH_RE})\\s+(20\\d{2})`, "i"));
  const coverYm = cover ? ym(cover[1], cover[2]) : null;
  if (coverYm) {
    guard(!current.length || current.includes(coverYm), `cover ${coverYm} absent from Current Wave labels ${current.join(", ")}`);
    return coverYm;
  }
  guard(current.length > 0, "no WORLD SUMMARY, cover month or Current Wave anchor");
  const articleMonths = unique((source.articles || []).map((u) => {
    const m = u.match(/what-worries-world-([a-z]+)-(20\d{2})(?:-|$)/i); return m ? ym(m[1], m[2]) : null;
  }).filter(Boolean));
  guard(current.length === 1 || articleMonths.length === 1, `conflicting Current Wave labels without cover: ${current.join(", ")}`);
  if (current.length === 1) return current[0];
  guard(current.includes(articleMonths[0]), `article month ${articleMonths[0]} not among Current Wave labels`);
  return articleMonths[0];
}

const DIRECTION_ANCHOR = /RIGHT DIRECTION\/WRONG TRACK|RIGHT DIRECTION VS\. WRONG TRACK MONITOR|(?:^|\n)\s*Right vs\.\s*(?:wrong direction|World|Global Country Average|\r?\n)|Right direction vs\.?\s*wrong track/i;
/* The wave's fieldwork. The direction-table page's dated Base footer is the
   first choice, but pdftotext's column layout often splits it (a country row
   lands between its dates: 21 of 90 waves came out undated), and five
   2019–20 reports print the end year wrong in every footer ("April 19th 2019
   - May 3rd 2018"). The 2026-11-22 source check found every wave's dates
   printed whole elsewhere in its report: on the clean Base lines of other
   pages, and in the methodology paragraph ("were interviewed between …
   and …", "conducted between …"), whose year is right every time but which
   sits in two columns. So when the table page gives no range ending in the
   labelled month, every range the report prints is collected – each line,
   and each column's text rejoined (the left segment of every line, then the
   right) – and the range ending in the labelled month that is printed most
   often wins (a stale footer copied from an earlier wave loses on count);
   ties go to the later end. */
function fieldworkOf(text, textPage, month) {
  const m0 = Date.parse(month + "-01T00:00:00Z");
  const [y, mo] = month.split("-").map(Number);
  const m1 = Date.UTC(y, mo, 1) - 864e5;                 // the month's last day
  const fits = (r) => r.start && r.end && Date.parse(r.end) >= m0 && Date.parse(r.end) <= m1;
  const first = datesOf(textPage);
  if (fits(first)) return first;
  const lines = text.split(/\r?\n/);
  const columns = [0, 1].map((c) => lines.map((l) => l.trimStart().split(/[ \t]{5,}/)[c] || "").join(" "));
  const sources = [...lines, ...columns.flatMap((t) => t.split(/(?<=\.)\s+(?=[A-Z])/))];
  const counts = new Map();
  for (const s of sources) {
    const t = compact(s);
    if (!/\d/.test(t)) continue;
    const r = datesOf(t);
    if (!fits(r)) continue;
    const k = r.start + "|" + r.end;
    const c = counts.get(k) || { r, n: 0 };
    c.n++; counts.set(k, c);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n || b.r.end.localeCompare(a.r.end))[0];
  return best ? best.r : first;
}

export function parseReport(text, source = {}) {
  const month = reportMonth(text, source);
  const pages = text.split("\f");
  const candidates = [], problems = [];
  const anchored = pages.filter((page) => DIRECTION_ANCHOR.test(page)
    && /\bAustralia\b/.test(page) && /\bWorld\b|Global(?: Country)? Average/i.test(page));
  if (!anchored.length) throw new NoCountryTable(`${month}: published report has no all-country direction table`);
  const reportRoster = unique([
    ...[...text.matchAll(/This\s+(\d+)-country\s+Global Advisor survey/gi)].map((m) => Number(m[1])),
    ...[...text.matchAll(/across\s+(\d+)\s+countries\s+today/gi)].map((m) => Number(m[1])),
    ...[...text.matchAll(/survey is conducted monthly in\s+(\d+)\s+countries/gi)].map((m) => Number(m[1])),
  ]);
  for (const page of anchored) {
    try { candidates.push({ page, table: directionTable(page, reportRoster) }); }
    catch (e) { if (!(e instanceof Guard)) throw e; problems.push(e.message); }
  }
  guard(candidates.length > 0, `${month}: no fully guarded all-country direction table${problems.length ? ` (${problems.join("; ")})` : ""}`);
  // Normally one. A duplicated table is fine only when every figure agrees.
  const signature = (t) => JSON.stringify(t);
  guard(unique(candidates.map((c) => signature(c.table))).length === 1, `${month}: direction tables disagree`);
  const page = candidates[0].page;
  const textPage = compact(page);
  const { global, countries } = candidates[0].table;
  const au = countries.find((r) => r.code === "AU");
  const samples = countrySamples(text, countries);
  const sample = (r) => ({ sample: r?.sample ?? null, ...(r?.sampleApprox ? { sampleApprox: true } : {}) });
  const startEnd = fieldworkOf(text, textPage, month);
  return {
    month, ...startEnd,
    source: "Ipsos What Worries the World",
    sourceUrl: source.retrievedUrl || source.url,
    capture: source.text,
    australia: { right: au.right, wrong: au.wrong, ...sample(samples.AU) },
    globalAverage: { right: global.right, wrong: global.wrong, sample: sampleOf(textPage) },
    countries: countries.map((r) => ({ code: r.code, name: r.name, right: r.right, wrong: r.wrong, ...sample(samples[r.code]) })),
  };
}

export function quantile(values, p) {
  const a = [...values].sort((x, y) => x - y);
  guard(a.length > 0 && p >= 0 && p <= 1, "quantile needs values and 0<=p<=1");
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
export const bands = (values) => ({ q10: quantile(values, .1), q25: quantile(values, .25), q50: quantile(values, .5), q75: quantile(values, .75), q90: quantile(values, .9) });

/* Multiple primary captures can represent one wave (Ipsos sometimes relinked
   a short deck beside its report). Reconcile figure-for-figure, prefer a
   capture with a complete exact base, and never average across captures. */
function mergeWave(a, b, month) {
  const core = (w) => JSON.stringify({ australia: { right: w.australia.right, wrong: w.australia.wrong },
    global: { right: w.globalAverage.right, wrong: w.globalAverage.wrong },
    // Publication tie order is not data: two decks order equal scores
    // differently. Country codes, names and figures must still agree.
    countries: w.countries.map(({ code, name, right, wrong }) => ({ code, name, right, wrong }))
      .sort((x, y) => x.code.localeCompare(y.code)) });
  guard(core(a) === core(b), `${month}: duplicate primary captures report different direction figures`);
  // An invalid printed end is null, so a coherent capture can complete it;
  // two distinct valid exact windows are drift, never something to blend.
  for (const k of ["start", "end"]) guard(!a[k] || !b[k] || a[k] === b[k], `${month}: duplicate captures disagree on ${k}`);
  if (a.fieldwork && b.fieldwork && a.fieldwork !== b.fieldwork)
    guard((a.start && a.end) || (b.start && b.end), `${month}: duplicate captures have different unresolved fieldwork text`);
  guard(a.globalAverage.sample == null || b.globalAverage.sample == null || a.globalAverage.sample === b.globalAverage.sample,
    `${month}: duplicate captures disagree on total sample`);
  const score = (w) => Number(w.globalAverage.sample != null) + Number(!!w.start) + Number(!!w.end);
  const best = score(b) > score(a) || (score(b) === score(a) && b.sourceUrl < a.sourceUrl) ? b : a;
  const other = best === a ? b : a;
  const countries = best.countries.map((r) => {
    const x = a.countries.find((q) => q.code === r.code), y = b.countries.find((q) => q.code === r.code);
    if (x?.sample != null && y?.sample != null)
      guard(x.sample === y.sample && !!x.sampleApprox === !!y.sampleApprox, `${month}: ${r.code} samples or exactness disagree`);
    const approx = x?.sampleApprox || y?.sampleApprox;
    return { ...r, sample: x?.sample ?? y?.sample ?? null, ...(approx ? { sampleApprox: true } : {}) };
  });
  const au = countries.find((r) => r.code === "AU");
  return { ...best,
    start: best.start || other.start, end: best.end || other.end, fieldwork: best.fieldwork || other.fieldwork,
    globalAverage: { ...best.globalAverage, sample: best.globalAverage.sample ?? other.globalAverage.sample },
    australia: { ...best.australia, sample: au.sample, ...(au.sampleApprox ? { sampleApprox: true } : {}) },
    countries };
}

export function buildData(manifest, srcDir = SRC) {
  const waves = new Map(), omitted = [];
  for (const source of manifest.sources) {
    const text = fs.readFileSync(path.join(srcDir, source.text), "utf8");
    let wave;
    try { wave = parseReport(text, source); }
    catch (e) {
      if (e instanceof NoCountryTable) { omitted.push({ month: e.message.slice(0, 7), sourceUrl: source.url, reason: e.message }); continue; }
      throw new Guard(`${source.text}: ${e.message}`);
    }
    const month = wave.month;
    if (waves.has(month)) wave = mergeWave(waves.get(month), wave, month);
    waves.set(month, wave);
  }
  return { waves: [...waves.values()].sort((a, b) => a.month.localeCompare(b.month)).map((w) => {
    const { capture, ...core } = w; return core;
  }), omitted };
}

function loadManifest() {
  const f = path.join(SRC, "manifest.json");
  if (!fs.existsSync(f)) throw new Error(`No cache manifest at ${f}; run with --fetch`);
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

async function main() {
  const manifest = FETCH ? await refresh() : loadManifest();
  const built = buildData(manifest);
  const text = JSON.stringify({ waves: built.waves }, null, 2) + "\n";
  const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text;
  if (changed && !CHECK) atomic(OUT, text);
  console.log(`IPDIR_SOURCES ${manifest.sources.length}`);
  for (const o of built.omitted) console.log(`IPDIR_OMIT ${o.month} ${o.sourceUrl} — no all-country table`);
  console.log("IPDIR_STATUS " + JSON.stringify({ sources: manifest.sources.length, failures: manifest.failures || [], waves: built.waves.length,
    omitted: built.omitted, first: built.waves[0]?.month || null, last: built.waves.at(-1)?.month || null, changed }));
}
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);
if (!LIB_MODE) main().catch((e) => { console.error(`IPDIR_ERROR ${e.stack || e}`); process.exit(e instanceof Guard ? 2 : 1); });
