#!/usr/bin/env node
// Stamp polls.json rows with their PUBLISHED effective sample size
// (`sampleEff`), mined from the four houses whose Australian Polling Council
// long methodology statements are machine-reachable:
//
//   YouGov   – one APC listing page (yougov.com/about/methodology/australian-
//              polling-council) carries every statement PDF: News24 Pulse,
//              Sky News Pulse and YouGov Public Data series. Polls.json folds
//              all three into pollster "YouGov"; the row's `url` disambiguates
//              series when two statements cover the same week. The listing
//              only keeps a rolling window, so unstamped rows that predate it
//              stay on the derived fallback forever – that is accepted. This
//              leg also stamps `methodUrl` (the statement's own URL) on every
//              YouGov row it can match, whether or not the row needs a
//              sampleEff – so methodUrl reach equals the listing's window.
//   Newspoll – pyxispolling.com statement pages, enumerated via sitemap.xml
//              (the /apc listing is JS-paginated through an authed CMS API and
//              ?page=N is ignored). Each /methodology-statement/newspoll-* page
//              renders its PDF link client-side, resolved with headless Chrome
//              --dump-dom --virtual-time-budget (skipped with a warning when
//              no Chrome is available). Pyxis statements stop at Jan 2026 for
//              now; later waves fall back. The statement PAGES also carry
//              Newspoll's methodUrl – they outlive their PDFs (pruned pre-
//              2025-11), so the page, not the pdf, is the link target.
//   Essential – ONE living disclosure-statement PDF, re-uploaded per release.
//              Its "Individual Survey Details" table lists publication &
//              fieldwork dates, raw sample, weighting efficiency and effective
//              sample for every wave since May 2021. The current href is read
//              off essentialreport.com.au/methodology each run.
//   DemosAU  – the methodology-statements index (already crawlable plain
//              HTML); federal poll and MRP statement PDFs carry the same APC
//              template row.
//
// Matching: a statement is stamped onto the polls.json row of the SAME
// pollster whose `date` (fieldwork end) is within ±1 day of the statement's
// parsed fieldwork end. Fieldwork end is always parsed from the statement
// text – statement titles/filenames carry publication-ish dates and are used
// only to shortlist candidates, never to match. Ambiguity (two statements for
// one row, or a statement that matches no row) stamps NOTHING and is logged;
// partial coverage is the designed-for steady state.
//
// Guards (exit 2 – never weakened): sampleEff is an integer 200..30000 and,
// where a raw sample is known, within 20..105% of it.
//
// Conventions: absent-not-zero (rows without a statement keep no field);
// never overwrite an existing sampleEff (a differing statement is reported);
// statements' pdftotext output is cached under .build/sampleeff-src/
// (committed) so a parsing change is re-derivable offline.
//
// Exit codes: 0 ok (SAMPLEEFF_STATUS line, changed:true/false), 1 fetch/parse
// failure, 2 guard breach. Status line shape:
//   SAMPLEEFF_STATUS {"changed":bool,"stamped":n,"methods":n,"failed":n,"skipped":n,"errors":[…]}

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "data", "polls.json");
const SRC_DIR = join(HERE, "sampleeff-src");
mkdirSync(SRC_DIR, { recursive: true });
const D = JSON.parse(readFileSync(OUT, "utf8"));

const UA = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
};
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const monthNo = (s) => MONTHS[String(s).slice(0, 3).toLowerCase()] || null;
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const mkIso = (y, mon, d) => { const m = monthNo(mon); if (!m) throw new Error(`unparseable month "${mon}"`); return iso(y, m, d); };
const ddays = (a, b) => (Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000;

function statusAndExit(obj, code = 0) {
  console.log("SAMPLEEFF_STATUS " + JSON.stringify(obj));
  process.exit(code);
}

async function fetchBuffer(url, headers = UA) {
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}
const fetchText = async (url, headers) => (await fetchBuffer(url, headers)).toString("utf8");

function pdfToText(buf, slug) {
  const pdfPath = join(tmpdir(), `sampleeff-${slug}.pdf`);
  writeFileSync(pdfPath, buf);
  const bins = ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"];
  for (const bin of bins) {
    try { return execFileSync(bin, ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
    catch (e) {
      if (e.code === "ENOENT") continue;
      throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 200)}`);
    }
  }
  throw new Error("pdftotext (poppler) not found on PATH");
}

/* Cache the layout text: statements are re-parsed rarely, and when the parse
   breaks the fix is derived from exactly this text. */
function cachedText(cacheName, text) {
  writeFileSync(join(SRC_DIR, cacheName + ".txt"), text, "utf8");
  return text;
}

/* ---- APC statement field parsing ---------------------------------------
   All four houses render the APC long-methodology table; the label wrapped
   over two layout lines ("Effective sample size after" / "weighting applied"),
   so the text is whitespace-collapsed before matching. */
function parseApcStatement(txt) {
  const t = txt.replace(/\s+/g, " ");
  /* The value lands in three places across houses: inside the phrase
     ("…applied: 1000"), after it ("…applied 754"), and BEFORE it in the
     wrapped two-line originals ("Effective sample size after   1053
     weighting applied"). Scan each "effective sample size" occurrence left
     to right, stop at the last associated "margin of error", and take the
     first 3+-digit number that is not a ± figure. */
  let eff = null, naEff = false;
  const re = /effective sample size/gi;
  let mm;
  while ((mm = re.exec(t))) {
    const slice = t.slice(mm.index, mm.index + 160);
    const beforeMargin = slice.split(/margin of error/i)[0];
    if (/n\/a/i.test(beforeMargin)) { naEff = true; continue; }
    const n = beforeMargin.match(/(?<![0-9±.])([0-9][0-9,]{2,})(?![\d.]*%)/);
    if (n) { eff = Number(n[1].replace(/,/g, "")); break; }
  }
  if (eff == null) return naEff ? { na: true } : null;
  const effN = eff;
  // raw sample: the "Sample size" table row, line-anchored so it can't be
  // confused with the effective-size row (which never sits col-1 after -layout)
  let sample = null;
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s{0,12}sample size\s*:?\s*([0-9][0-9,]{2,})/i);
    if (m) { sample = Number(m[1].replace(/,/g, "")); break; }
  }
  let end = null;
  let m;
  // "17 November – 20 November 2025" / "18th August – 24th August 2026"
  if ((m = t.match(/fieldwork dates?\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)\s*,?\s*(20\d{2})/i)))
    end = mkIso(+m[5], m[4], +m[3]);
  // "18 – 20 August 2026"
  else if ((m = t.match(/fieldwork dates?\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)\s*,?\s*(20\d{2})/i)))
    end = mkIso(+m[4], m[3], +m[2]);
  // "22/07/26 – 27/07/26" (Australian order)
  else if ((m = t.match(/fieldwork dates?\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i)))
    end = iso(2000 + (+m[6] % 100), +m[5], +m[4]);
  /* general fallback: the LAST year-carrying date on the fieldwork line is
     the fieldwork end. Catches the long tail of house styles – "March 14th
     – 19th March 2025", "1st of April and 29th April 2025", "25 to 30 Sep
     2025", "Aug 4th – 11th August 2026". */
  else {
    const fw = (t.match(/fieldwork dates?(.{0,90})/i) || [])[1] || "";
    const toks = [...fw.matchAll(/(?:(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([A-Za-z]{3,9})|([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?)\s*,?\s*(20\d{2})/g)];
    if (toks.length) {
      const last = toks[toks.length - 1];
      const day = last[1] ? +last[1] : +last[4];
      end = mkIso(+last[5], last[2] || last[3], day);
    }
  }
  return { eff: effN, sample, end };
}

/* ---- leg: YouGov APC listing (News24 / Sky Pulse / Public Data) -------- */
const YG_LISTING = "https://yougov.com/about/methodology/australian-polling-council";
function ygSeries(title) {
  if (/sky/i.test(title)) return "sky";
  if (/news24/i.test(title)) return "news24";
  if (/mrp/i.test(title)) return "mrp";
  return "publicdata";
}
/* Statement date from the link text: "News24 Pulse 25th Aug 2026",
   "Sky News pulse April 8th", "Sky News Pulse May 6th" (year from the
   filename digits when the text omits it); a month-only title ("Public Data
   poll Jan 2025") still shortlists, pinned to the 1st. */
function ygStatementDate(title, href) {
  let m = title.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([A-Za-z]{3,9})\s*,?\s*(\d{4})?\s*$/)
       || title.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?\s*$/);
  let d, mon, y;
  if (m && /\d/.test(m[1])) { d = +m[1]; mon = monthNo(m[2]); y = m[3] && +m[3]; }
  else if (m) { mon = monthNo(m[1]); d = +m[2]; y = m[3] && +m[3]; }
  if (!mon || !d) {
    const mm = title.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\s*$/i);
    if (!mm) return null;
    mon = monthNo(mm[1]); y = +mm[2]; d = 1;
  }
  if (!y) {
    const h = href.replace(/%20/g, " ");
    let g = h.match(/(\d{1,2})_(\d{1,2})_(\d{2})\b/);                    // 20_01_26 (D_M_YY)
    if (g) return iso(2000 + +g[3], mon, d);
    if ((g = h.match(/\b(\d{2})(\d{2})(20\d{2})\b/))) return iso(+g[3], mon, d);   // 11112025 (DDMMYYYY)
    if ((g = h.match(/\b(\d{2})(\d{2})(\d{2})\b/))) return iso(2000 + +g[3], mon, d); // 180425 (DDMMYY)
    if ((g = h.match(/(20\d{2})/))) return iso(+g[1], mon, d);
    // no year anywhere: a bare title date is taken to be the most recent
    // occurrence that isn't in the future ("Sky News Public Data Poll Dec
    // 23rd", seen in 2026, means Dec 2025 – not Dec 2026)
    const cand = iso(new Date().getFullYear(), mon, d);
    return cand > new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)
      ? iso(new Date().getFullYear() - 1, mon, d)
      : cand;
  }
  return iso(y, mon, d);
}

async function legYouGov(needDates) {
  const html = await fetchText(YG_LISTING);
  const out = [];
  const linkRe = /<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>(.*?)<\/a>/gis;
  let lm;
  while ((lm = linkRe.exec(html))) {
    const href = lm[1];
    const title = lm[2].replace(/<[^>]+>/g, "").trim();
    if (!/news24|sky\s*news|skypulse|public\s*data/i.test(title)) continue;
    if (/state poll|queensland|victoria|south australia|dunkley/i.test(title)) continue;
    const when = ygStatementDate(title, href);
    if (!when) { console.log("  warn: no date parsed from YouGov link: " + title.slice(0, 60)); continue; }
    if (!needDates.some((d) => Math.abs(ddays(d, when)) <= 14)) continue;
    const slug = "yougov-" + href.split("/").pop().replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60);
    let rec = null;
    try {
      rec = await parsePdfAt(href, slug);
    } catch (e) {
      console.log("  warn: fetch failed for " + title.slice(0, 50) + ": " + e.message);
      continue;
    }
    if (!rec) { console.log("  warn: no eff-size in " + title.slice(0, 60)); continue; }
    if (rec.na) { console.log("  note: house marks eff-size n/a for " + title.slice(0, 60)); continue; }
    if (!rec.end) { console.log("  warn: no fieldwork end in " + title.slice(0, 60)); continue; }
    const series = ygSeries(title);
    // href travels with the record: the statement URL is stamped onto the
    // row as methodUrl even where the statement's eff-size is already known
    out.push({ pollster: series === "mrp" ? "YouGov (MRP)" : "YouGov", series, ...rec, href, src: title.slice(0, 70) });
  }
  return out;
}

/* ---- leg: Newspoll via Pyxis sitemap + headless-Chrome resolution ------ */
async function legNewspoll(needs) {
  const xml = await fetchText("https://pyxispolling.com/sitemap.xml");
  const pages = new Map();   // ISO-ish statement date -> page url
  for (const m of xml.matchAll(/<loc>(https:\/\/pyxispolling\.com\/methodology-statement\/(newspoll)-(\d{1,2})-(\d{1,2})-(\d{4}))<\/loc>/g))
    pages.set(m[1], iso(+m[5], +m[4], +m[3]));
  const cand = [...pages.entries()].filter(([, when]) => needs.some((d) => Math.abs(ddays(d, when)) <= 7));
  const out = [];
  for (const [url, when] of cand) {
    let rec = null;
    try {
      rec = await resolveNewspollStatement(url, when);
    } catch (e) {
      console.log("  warn: " + url + ": " + e.message);
      continue;
    }
    if (!rec) continue;
    out.push({ pollster: "Newspoll", series: "newspoll", ...rec, src: "pyxispolling.com statement " + when });
  }
  return out;
}

async function resolveNewspollStatement(url, when) {
  const dom = execFileSync(CHROME, ["--headless=new", "--dump-dom", "--virtual-time-budget=12000", "--timeout=20000", url],
    { encoding: "utf8", maxBuffer: 1 << 24, stdio: ["ignore", "pipe", "ignore"] });
    // the JS-swapped page must show the right statement, not the cached default
    const titleM = dom.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})<\/[a-z]+>\s*<a[^>]*(?:View Methodology|href=)/i)
      || dom.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/);
  if (!titleM || Math.abs(ddays(iso(+titleM[3], monthNo(titleM[1]), +titleM[2]), when)) > 7) {
    console.log("  warn: pyxis page did not resolve to " + when + " (JS swap?); skipped");
    return null;
  }
  const pdf = dom.match(/\/images\/document\/[^"]+Newspoll[^"]*\.pdf/i)
           || dom.match(/\/images\/document\/[^"]+\.pdf/i);
  if (!pdf) { console.log("  warn: no pdf resolved at " + url); return null; }
  const pdfUrl = new URL(pdf[0], "https://pyxispolling.com").toString();
  const rec = await parsePdfAt(pdfUrl, "newspoll-" + when);
  if (!rec || !rec.end) { console.log("  warn: parse hole in " + url); return null; }
  return rec;
}

/* Newspoll methodUrl leg: the sitemap's methodology-statement PAGE urls are
   the link target (their PDFs older than Nov 2025 are pruned, but the pages
   themselves live on and carry the wave's statement title). No Chrome, no
   PDF fetch – dates come from the url, matched within ±7 days of a row's
   publication. Placement mirrors legNewspoll's candidate window. */
async function legNewspollLinks(needDates) {
  const xml = await fetchText("https://pyxispolling.com/sitemap.xml");
  const out = [];
  for (const m of xml.matchAll(/<loc>(https:\/\/pyxispolling\.com\/methodology-statement\/(newspoll)-(\d{1,2})-(\d{1,2})-(\d{4}))<\/loc>/g)) {
    const when = iso(+m[5], +m[4], +m[3]);
    if (!needDates.some((d) => Math.abs(ddays(d, when)) <= 7)) continue;
    out.push({ when, href: m[1] });
  }
  return out;
}

/* ---- leg: Essential disclosure statement (one living PDF) -------------- */
const MONTH3 = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const DDMMMYY = (s) => s.match(/(\d{2})-([A-Za-z]{3})-?(\d{2,4})/);
const TOK = "[0-9]{2}-[A-Za-z]{3}-?[0-9]{2,4}";
const ddMmmYy = (s) => { const m = DDMMMYY(s); return iso(2000 + (+m[3] % 100), MONTH3[m[2]], +m[1]); };

function parseEssentialTable(txt) {
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => /individual survey details/i.test(l));
  if (start < 0) throw new Error("Essential table header not found");
  const endIx = lines.findIndex((l, i) => i > start && /questionnaire content|question wording/i.test(l));
  const region = lines.slice(start, endIx < 0 ? undefined : endIx);
  const groups = [];
  let cur = null;
  for (const l of region) {
    const d = l.match(new RegExp(`^\\s{0,14}(${TOK})\\s+(${TOK})\\s+(${TOK})`));
    if (d) { cur = { pub: ddMmmYy(d[1]), fwEnd: ddMmmYy(d[3]), lines: [l] }; groups.push(cur); }
    else if (cur) cur.lines.push(l);
  }
  const rows = [];
  const NUM = /([0-9,]{3,7})\s+(\d{1,3})%\s+([0-9,]{3,7})\s+±\s*(\d+(?:\.\d+)?)%/;
  for (const g of groups) {
    // first numbers line in the group is the national row – state/boost rows
    // (NSW…, "with WA and SA boost") always follow it
    const win = g.lines.map((l) => l.match(NUM)).find(Boolean);
    if (!win) { console.log("  warn: essential group with no numbers at " + g.fwEnd); continue; }
    rows.push({ end: g.fwEnd, pub: g.pub, sample: Number(win[1].replace(/,/g, "")),
                eff: Number(win[3].replace(/,/g, "")), moe: win[4] });
  }
  return rows;
}

async function legEssential() {
  const methHtml = await fetchText("https://essentialreport.com.au/methodology");
  const hrefM = methHtml.match(/href="([^"]*Disclosure-Statement[^"]*\.pdf)"[^>]*>found here|href="([^"]*Disclosure-Statement[^"]*\.pdf)"/i);
  if (!hrefM) throw new Error("Essential methodology page: disclosure href not found");
  const pdfUrl = new URL(hrefM[1] || hrefM[2], "https://essentialreport.com.au/methodology").toString();
  const txt = cachedText("essential-disclosure", pdfToText(await fetchBuffer(pdfUrl), "essential-disclosure"));
  return parseEssentialTable(txt).map((r) => ({ pollster: "Essential", series: "essential", eff: r.eff, sample: r.sample, end: r.end, src: "Essential disclosure " + r.pub }));
}

/* ---- leg: DemosAU methodology-statements index -------------------------- */
const DAU_BLOCK = /victori|tasmania|\bwa[- ]|\bqld\b|queensland|south.austral|\bnsw\b|sydney|melbourne|brisbane|greyhound|gaza|superannuation|republic|trustwatch|values poll|abortion|tax.cuts|logging/i;
function dauMonths(title) {
  const y = title.match(/20\d{2}/);
  const ms = [...new Set([...title.toLowerCase().matchAll(/jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/g)].map((m) => monthNo(m[0])))];
  return ms.length && y ? { y: +y[0], lo: Math.min(...ms), hi: Math.max(...ms) } : null;
}
async function legDemosau(needYms) {
  const html = await fetchText("https://demosau.com/methodology-statements/");
  const out = [], naTitles = [];
  for (const m of html.matchAll(/href="(https:\/\/demosau\.com\/wp-content\/uploads\/[^"]+\.pdf)"/gi)) {
    const title = decodeURIComponent(m[1].split("/").pop());
    if (!/(federal|national|fed.poll)/i.test(title) || !/poll|mrp/i.test(title) || DAU_BLOCK.test(title)) continue;
    const months = [...new Set([...title.toLowerCase().matchAll(/jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/g)].map((x) => monthNo(x[0])))];
    const yM = title.match(/20\d{2}/);
    if (!months.length) { console.log("  warn: no month in DemosAU title " + title.slice(0, 60)); continue; }
    /* candidate covering any need-month ±1. Titles with no year
       ("DemosAU-OctNov-Federal-MRP-Report") fall back to matching on the
       bare month numbers – the statement's own fieldwork dates still gate
       the final stamp. */
    const covered = needYms.some((ym) => {
      const [y, mo] = ym.split("-").map(Number);
      if (yM && y !== +yM[0] && !(y === +yM[0] - 1 && mo >= 11) && !(y === +yM[0] + 1 && mo <= 2)) return false;
      return months.some((mm) => Math.abs(mm - mo) <= 1 || Math.abs(mm - mo) >= 11);
    });
    if (!covered) continue;
    const slug = "demosau-" + title.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60);
    const rec = await parsePdfAt(m[1], slug);
    if (!rec) { console.log("  warn: parse hole in DemosAU " + title.slice(0, 60)); continue; }
    if (rec.na) { naTitles.push(title.slice(0, 60)); continue; }
    if (!rec.end) { console.log("  warn: no fieldwork end in DemosAU " + title.slice(0, 60)); continue; }
    out.push({ pollster: /mrp/i.test(title) ? "DemosAU (MRP)" : "DemosAU", series: "demosau", ...rec, src: title.slice(0, 70) });
  }
  for (const t of naTitles) console.log("  note: house marks eff-size n/a for " + t);
  return out;
}

async function parsePdfAt(url, slug) {
  const buf = await fetchBuffer(url);
  const txt = cachedText(slug, pdfToText(buf, slug));
  return parseApcStatement(txt);
}

/* ---- run the legs ------------------------------------------------------- */
const rowSeries = (p) => {
  const u = p.url || "";
  if (/skynews\.com\.au/i.test(u)) return "sky";
  if (/news24\.com\.au/i.test(u)) return "news24";
  return "publicdata";
};
const NEED_HOUSES = ["YouGov", "YouGov (MRP)", "Newspoll", "Essential", "DemosAU", "DemosAU (MRP)"];
const unstamped = D.polls.filter((p) => NEED_HOUSES.includes(p.pollster) && p.sampleEff == null);

const records = [];
const errors = [];
/* YouGov rows also need their statements when they lack a methodUrl –
   the same listing pass serves both fields, so an already-eff-stamped wave
   is fetched once more to capture its URL, not its number. */
const legs = [
  ["yougov", () => legYouGov([...new Set(D.polls
    .filter((p) => p.pollster.startsWith("YouGov") && (p.sampleEff == null || p.methodUrl == null))
    .map((p) => p.date))])],
  ["essential", () => legEssential()],
  ["demosau", () => legDemosau([...new Set(unstamped.filter((p) => p.pollster.startsWith("DemosAU")).map((p) => p.date.slice(0, 7)))])],
];
let chromeBin = null;
try { execFileSync(CHROME, ["--version"], { stdio: "ignore" }); chromeBin = CHROME; } catch {}
if (chromeBin && unstamped.some((p) => p.pollster === "Newspoll"))
  legs.push(["newspoll", () => legNewspoll(unstamped.filter((p) => p.pollster === "Newspoll").map((p) => (p.published || p.date).slice(0, 10)))]);
else if (unstamped.some((p) => p.pollster === "Newspoll"))
  console.log("  warn: no Chrome at " + CHROME + " – Newspoll leg skipped");

for (const [name, fn] of legs) {
  try { records.push(...await fn()); }
  catch (e) { errors.push(`leg ${name}: ${String(e.message).slice(0, 180)}`); }
}

/* Dedupe identical statement reads, then stamp. A statement that matches no
   row is expected (out-of-cycle waves, dropped series) and merely skipped. */
const seen = new Map();
for (const r of records) {
  const k = r.pollster + "|" + r.end;
  if (!seen.has(k)) seen.set(k, r);
  else if (seen.get(k).eff !== r.eff) errors.push(`conflicting statements for ${k}: ${seen.get(k).eff} vs ${r.eff} (${seen.get(k).src} / ${r.src})`);
}

const stamped = [], ambiguous = [];
let failed = 0;
for (const p of unstamped) {
  let cands = [...seen.values()].filter((r) => r.pollster === p.pollster && r.end && Math.abs(ddays(r.end, p.date)) <= 1);
  if (!cands.length) continue;
  let pick = null;
  if (p.pollster === "YouGov") {
    /* Series identity is known on both sides (statement title, poll row URL)
       and Sky/Pulse statements land within a day of each other constantly –
       never let a statement leak across series onto a row of the same pollster
       with a foreign URL (e.g. the Australia Institute commission). */
    cands = cands.filter((r) => r.series === rowSeries(p));
    const effs = [...new Set(cands.map((r) => r.eff))];
    if (effs.length === 1) pick = cands[0];
    else if (effs.length > 1) ambiguous.push(`${p.date} ${p.pollster}: ${cands.map((r) => r.series + "@" + r.end + "=" + r.eff).join(" vs ")}`);
  } else {
    const effs = [...new Set(cands.map((r) => r.eff))];
    if (effs.length === 1) pick = cands[0];
    else ambiguous.push(`${p.date} ${p.pollster}: ${cands.map((r) => r.src + "=" + r.eff).join(" vs ")}`);
  }
  if (!pick) { failed++; continue; }
  // guards
  const basis = pick.sample || p.sample;
  if (!Number.isInteger(pick.eff) || pick.eff < 200 || pick.eff > 30000) { errors.push(`guard: ${p.date} ${p.pollster} eff=${pick.eff} out of range`); continue; }
  if (basis && (pick.eff > basis * 1.05 || pick.eff < basis * 0.2)) { errors.push(`guard: ${p.date} ${p.pollster} eff=${pick.eff} vs sample=${basis}`); continue; }
  // insert sampleEff right after the `sample` key, preserving column order
  const rebuilt = {};
  for (const [k, v] of Object.entries(p)) {
    rebuilt[k] = v;
    if (k === "sample") rebuilt.sampleEff = pick.eff;
  }
  if (!("sample" in rebuilt)) rebuilt.sampleEff = pick.eff;
  for (const k of Object.keys(p)) delete p[k];
  Object.assign(p, rebuilt);
  stamped.push(`${p.date} ${p.pollster}: ${pick.eff} (${pick.src})`);
}

/* methodUrl: a YouGov or Newspoll row carries its wave's APC statement
   link. Same matching discipline as sampleEff (YouGov ±1 day, series-locked
   by the row's URL; Newspoll ±7 days on the statement-page date from its
   sitemap), absent-not-zero, never overwritten. The commissioned YouGov
   waves file no statement with YouGov's APC listing, so they keep no link. */
let npLinks = [];
if (D.polls.some((p) => p.pollster === "Newspoll" && p.methodUrl == null)) {
  const needDates = D.polls
    .filter((p) => p.pollster === "Newspoll" && p.methodUrl == null)
    .map((p) => (p.published || p.date).slice(0, 10));
  try { npLinks = await legNewspollLinks(needDates); }
  catch (e) { errors.push("leg newspoll-links: " + String(e.message).slice(0, 180)); }
}
const methods = [];
for (const p of D.polls) {
  if (p.methodUrl != null) continue;
  const hrefs = p.pollster === "YouGov"
    ? [...new Set(records
        .filter((r) => r.pollster === "YouGov" && r.end && Math.abs(ddays(r.end, p.date)) <= 1 && r.series === rowSeries(p))
        .map((r) => r.href))]
    : p.pollster === "Newspoll"
    ? [...new Set(npLinks
        .filter((l) => Math.abs(ddays(l.when, (p.published || p.date).slice(0, 10))) <= 7)
        .map((l) => l.href))]
    : [];
  if (!hrefs.length) continue;
  if (hrefs.length > 1) { errors.push(`ambiguity: ${p.date} ${p.pollster} methodUrl ${hrefs.join(" vs ")}`); continue; }
  // insert after releaseUrl (or url), keeping the citation links together
  const after = "releaseUrl" in p ? "releaseUrl" : "url";
  const rebuilt = {};
  for (const [k, v] of Object.entries(p)) {
    rebuilt[k] = v;
    if (k === after) rebuilt.methodUrl = hrefs[0];
  }
  if (!("methodUrl" in rebuilt)) rebuilt.methodUrl = hrefs[0];
  for (const k of Object.keys(p)) delete p[k];
  Object.assign(p, rebuilt);
  methods.push(`${p.date} ${p.pollster} (${rebuilt.methodUrl.split("/").pop().slice(0, 50)})`);
}

const out = { changed: stamped.length > 0 || methods.length > 0, stamped: stamped.length, methods: methods.length, failed, skipped: unstamped.length - stamped.length - failed, candidates: records.length, errors: errors.concat(ambiguous.map((a) => "ambiguity: " + a)) };
for (const s of stamped) console.log("  stamp " + s);
for (const s of methods) console.log("  method " + s);
for (const a of ambiguous) console.log("  AMBIGUOUS " + a);
if (errors.length) {
  for (const e of errors) console.log("  ERROR " + e);
  statusAndExit(out, 2);
}
if (stamped.length || methods.length) {
  const txt = readFileSync(OUT, "utf8");
  const trailingNl = txt.endsWith("\n") ? "\n" : "";
  const next = JSON.stringify(D, null, 2) + trailingNl;
  writeFileSync(OUT + ".tmp", next);
  renameSync(OUT + ".tmp", OUT);
}
statusAndExit(out, 0);
