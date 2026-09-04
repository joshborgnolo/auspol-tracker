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
//   Newspoll – pyxispolling.com's CMS JSON API, discovered from the /apc
//              page's own collection embed (the page is JS-paginated via
//              api.php; sitemap.xml stopped being maintained at Jan 2026).
//              Each item names a slug (newspoll-D-M-YYYY) and its statement
//              PDF under /api.php/images/document/<id>/… (the bare
//              /images/document/… path 404s – keep the api.php prefix).
//              No statement pages exist under the new CMS and none was
//              published for 2026 waves, so the PDF itself is also
//              Newspoll's methodUrl target on newly-stamped rows (rows
//              stamped earlier keep their old statement-page links, which
//              still resolve). No Chrome, no headless rendering.
//   Essential – ONE living disclosure-statement PDF, re-uploaded per release.
//              Its "Individual Survey Details" table lists publication &
//              fieldwork dates, raw sample, weighting efficiency and effective
//              sample for every wave since May 2021. The current href is read
//              off essentialreport.com.au/methodology each run. Every covered
//              wave shares that ONE living URL as its `methodUrl`, and the
//              link REFRESHES when the PDF is re-uploaded at a new URL – the
//              only leg allowed to overwrite, since there is no per-wave
//              statement to preserve. A wave not yet in the table (the brand-
//              new release) keeps no link until the house appends it.
//   DemosAU  – the methodology-statements index (already crawlable plain
//              HTML); federal poll and MRP statement PDFs carry the same APC
//              template row. This leg also stamps `methodUrl` (the statement
//              PDF's own URL) on every DemosAU row it can match – including
//              "(MRP)" rows, whose statements print "n/a for MRP" for the
//              effective size but still parse a fieldwork end; those records
//              travel link-only (the sampleEff matcher filters eff==null).
//              Fallback after the index pass: the house sometimes posts a
//              statement-bearing report PDF without listing it on the index
//              (2025-07 report, 2026-02 and 2026-07 Capital Brief waves), so
//              any needing row whose release URL is itself a demosau.com
//              wp-content PDF has THAT URL parsed as a statement too.
//   RedBridge/Accent – no network leg at all: the wave's Accent project
//              page yields its methodology-report PDF URL only to a
//              CLICKED document widget, and extract-redbridge.mjs already
//              does that weekly, caching the usrfiles.com PDF href as
//              `pdfUrl` in .build/redbridge-src/*.json (keyed by the
//              wave's fieldwork end) with the report's pdftotext output as
//              the sibling .txt. Two legs read those caches offline: the
//              pdfUrl stamps `methodUrl` (exact date match) and the txt's
//              "effective sample size of N" (the APC statement every Accent
//              methodology report carries) stamps `sampleEff`. Waves with
//              no Accent page (the 2025 AFR-only releases) or no cache yet
//              stay unlinked by design; the constant-link waves with no
//              cache (Oct-2025 snapshot, the May-2026 MRP) keep links but
//              get no sampleEff – MRPs are never eff-stamped in any house.
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
//
// Usage: `node extract-sampleeff.mjs [leg]` – an optional positional leg
// name (accent/yougov/newspoll/essential/demosau) runs JUST that leg's
// stamps. redbridge-updater.sh invokes the offline Accent pass this way
// right after its own extractor so a newly-cached wave's eff + methodUrl
// lands in the same commit instead of waiting for the weekly sweep.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, readdirSync } from "node:fs";
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
  /* n/a ("n/a for MRP") statements carry no eff, but their sample and
     fieldwork end are still parsed – DemosAU MRP waves link the statement
     as methodUrl even though they never take a sampleEff. */
  if (eff == null) return naEff ? { na: true, sample, end } : null;
  return { eff, sample, end };
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

/* ---- leg: Newspoll via the pyxispolling.com CMS collection API ----------
   The /apc page embeds its collection id in a data-attribute; the JSON feed
   behind it lists every statement with slug + PDF href. Federal slugs are
   "newspoll-D-M-YYYY" (state variants carry a state prefix and are excluded
   by the anchor). The slug date is the publication date; fieldwork end still
   comes from the PDF text like every other leg. */
const PYXIS_API = "https://pyxispolling.com/api.php/collection/6909661a09b83573fd004fe4/items?limit=200&order=columns.date_DESC";
async function pyxisStatements() {
  const j = JSON.parse(await fetchText(PYXIS_API));
  const out = [];
  for (const it of j.collection || []) {
    const c = it.columns || {};
    const m = /^newspoll-(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(c.slug || "");
    // the PDF is served through the api.php proxy path; the bare
    // /images/document/… path 404s, so resolve exactly what the API hands out
    const pdf = c.file && c.file.url && new URL(c.file.url, "https://pyxispolling.com").toString();
    if (!m || !pdf) continue;
    out.push({ when: iso(+m[3], +m[2], +m[1]), href: pdf });
  }
  if (!out.length) throw new Error("pyxis API: no federal Newspoll statements found");
  return out;
}
async function legNewspoll(needs) {
  const cand = (await pyxisStatements()).filter((s) => needs.some((d) => Math.abs(ddays(d, s.when)) <= 7));
  const out = [];
  for (const s of cand) {
    let rec = null;
    try {
      rec = await parsePdfAt(s.href, "newspoll-" + s.when);
    } catch (e) {
      console.log("  warn: " + s.href + ": " + e.message);
      continue;
    }
    if (!rec || !rec.end) { console.log("  warn: parse hole in " + s.href); continue; }
    out.push({ pollster: "Newspoll", series: "newspoll", ...rec, src: "pyxispolling.com statement " + s.when });
  }
  return out;
}

/* Newspoll methodUrl leg: the new CMS has no per-statement PAGES (the old
   /methodology-statement/newspoll-* ones still resolve, so rows already
   stamped keep them), so the statement's own PDF on pyxispolling.com is the
   link target – same shape YouGov uses. Slug dates are publication dates;
   matched within ±7 days of a row's publication, mirroring legNewspoll. */
async function legNewspollLinks(needDates) {
  return (await pyxisStatements()).filter((s) => needDates.some((d) => Math.abs(ddays(d, s.when)) <= 7));
}

/* Accent/RedBridge methodUrl leg: the wave's project page on
   accent-research.com only resolves its methodology-report PDF URL when the
   site's document widget is CLICKED (headless Chrome needed), but
   extract-redbridge.mjs already resolves it every week and records `pdfUrl`
   in the committed .build/redbridge-src caches. This leg just reads those
   caches (plus a two-entry constant below for the Accent pages the
   extractor's sitemap regex never enumerates) – no network, no Chrome.
   Waves with no Accent page at all (the 2025 AFR-only releases, Mar + Aug
   2026) stay unlinked by design, and the plain-"Redbridge" Australia
   Institute row files no Accent statement (commissioned wave – the same
   precedent as YouGov's Australia-Institute waves). Cache `date` IS the
   row's fieldwork end, so the match is exact (not ±days like the other
   legs). Pollster prefix-matches so "(MRP)" rows are covered. */
function legAccentLinks() {
  const dir = join(ROOT, ".build", "redbridge-src");
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (j.date && typeof j.pdfUrl === "string" && /^https:\/\/[a-z0-9-]+\.usrfiles\.com\//.test(j.pdfUrl))
      out.push({ date: j.date, href: j.pdfUrl });
  }
  // Accent pages the redbridge extractor never enumerates (its sitemap regex
  // only matches the afr,-redbridge-group-and-accent-research-*federal-poll
  // slugs), so no cache ever lands for them: the Oct-2025 snapshot and the
  // May-2026 MRP ("a fragmented electorate"). PDF hrefs captured 2026-09-02
  // via the CDP-click probe (.matilda/probe/accent-pdfurl.mjs) and verified
  // 200 application/pdf. A cache later landing for the same date with a
  // DIFFERENT href trips the >1-href ambiguity guard – deliberately.
  out.push(
    { date: "2025-10-07", href: "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_bfa36468f2104c90ba79a9bc66da0ab5.pdf" },
    { date: "2026-05-14", href: "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_604e597b92a843e3bef4ee2825c88406.pdf" },
  );
  return out;
}

/* RedBridge/Accent sampleEff leg: the same committed caches, offline. Every
   redbridge-src *.txt is the wave's Accent methodology-report PDF already
   run through pdftotext by extract-redbridge.mjs, and its APC statement
   prints "…providing an effective sample size of N." – parse just that
   number. Cache `date` is the wave's fieldwork end (exact row match) and
   cache `sample` the raw n the guard sanity-checks against. A cache whose
   .txt never landed simply yields no record; a .txt missing the sentence
   warns rather than fails, so a template change surfaces without
   poisoning the other legs. The two constant-link waves above have no
   cache, so no record – the MRP must stay unstamped anyway (every house's
   MRP precedent: an MRP's precision is not a weighting-efficiency n). */
function legAccentEff() {
  const dir = join(ROOT, ".build", "redbridge-src");
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!j.date) continue;
    const txtFile = f.replace(/\.json$/, ".txt");
    if (!existsSync(join(dir, txtFile))) continue;
    const m = readFileSync(join(dir, txtFile), "utf8").match(/effective sample size of\s+([\d,]+)/i);
    if (!m) { console.log("  warn: no effective-sample sentence in " + txtFile); continue; }
    out.push({ pollster: "RedBridge / Accent", end: j.date, eff: Number(m[1].replace(/,/g, "")),
               sample: typeof j.sample === "number" ? j.sample : null,
               src: "redbridge-src cache " + (j.slug || f.replace(/\.json$/, "")) });
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
  return parseEssentialTable(txt).map((r) => ({ pollster: "Essential", series: "essential", eff: r.eff, sample: r.sample, end: r.end, href: pdfUrl, src: "Essential disclosure " + r.pub }));
}

/* ---- leg: DemosAU methodology-statements index -------------------------- */
const DAU_BLOCK = /victori|tasmania|\bwa[- ]|\bqld\b|queensland|south.austral|\bnsw\b|sydney|melbourne|brisbane|greyhound|gaza|superannuation|republic|trustwatch|values poll|abortion|tax.cuts|logging/i;
function dauMonths(title) {
  const y = title.match(/20\d{2}/);
  const ms = [...new Set([...title.toLowerCase().matchAll(/jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/g)].map((m) => monthNo(m[0])))];
  return ms.length && y ? { y: +y[0], lo: Math.min(...ms), hi: Math.max(...ms) } : null;
}
async function legDemosau(needRows) {
  const needYms = [...new Set(needRows.map((p) => p.date.slice(0, 7)))];
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
    /* n/a statements (MRP) stay in the stream as link-only records: the
       sampleEff matcher filters eff==null out, the methodUrl matcher still
       dates them onto "(MRP)" rows. href travels with every record – the
       statement's own URL is the wave's methodUrl. */
    if (rec.na) naTitles.push(title.slice(0, 60));
    else if (!rec.end) { console.log("  warn: no fieldwork end in DemosAU " + title.slice(0, 60)); continue; }
    out.push({ pollster: /mrp/i.test(title) ? "DemosAU (MRP)" : "DemosAU", series: "demosau", ...rec, href: m[1], src: title.slice(0, 70) });
  }
  /* fallback: a needing row whose release URL is itself a demosau.com
     wp-content PDF carries the statement even when the index never listed
     it (the house posts report PDFs that double as the APC statement) */
  for (const p of needRows) {
    if (!/^https:\/\/demosau\.com\/wp-content\/uploads\/\S+\.pdf$/i.test(p.url || "")) continue;
    if (out.some((r) => r.href === p.url)) continue;
    const title = decodeURIComponent(p.url.split("/").pop());
    try {
      const rec = await parsePdfAt(p.url, "demosau-release-" + title.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60));
      if (!rec) { console.log("  warn: parse hole in DemosAU release " + title.slice(0, 60)); continue; }
      if (rec.na) console.log("  note: house marks eff-size n/a for " + title.slice(0, 60));
      else if (!rec.end) { console.log("  warn: no fieldwork end in DemosAU release " + title.slice(0, 60)); continue; }
      out.push({ pollster: p.pollster, series: "demosau", ...rec, href: p.url, src: "release PDF " + title.slice(0, 62) });
    } catch (e) {
      console.log("  warn: DemosAU release fetch failed " + title.slice(0, 60) + ": " + String(e.message).slice(0, 100));
    }
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
const NEED_HOUSES = ["YouGov", "YouGov (MRP)", "Newspoll", "Essential", "DemosAU", "DemosAU (MRP)", "RedBridge / Accent"];
const unstamped = D.polls.filter((p) => NEED_HOUSES.includes(p.pollster) && p.sampleEff == null);

const records = [];
const errors = [];
/* Optional positional leg filter (`node extract-sampleeff.mjs accent`) –
   the updater scripts run the offline Accent pass alone right after
   extract-redbridge.mjs, skipping the network legs entirely. */
const LEG_ONLY = process.argv[2] || null;
/* YouGov rows also need their statements when they lack a methodUrl –
   the same listing pass serves both fields, so an already-eff-stamped wave
   is fetched once more to capture its URL, not its number. */
const legs = [
  ["yougov", () => legYouGov([...new Set(D.polls
    .filter((p) => p.pollster.startsWith("YouGov") && (p.sampleEff == null || p.methodUrl == null))
    .map((p) => p.date))])],
  ["essential", () => legEssential()],
  /* the DemosAU index pass must also cover waves that need only a
     methodUrl (sampleEff already known) – same trick as the YouGov leg;
     the leg also gets the needing rows so a statement-bearing release
     PDF the index never listed is parsed straight off the row's url */
  ["demosau", () => legDemosau(D.polls
    .filter((p) => p.pollster.startsWith("DemosAU") && (p.sampleEff == null || p.methodUrl == null)))],
  ["accent", () => legAccentEff()],
];
if (unstamped.some((p) => p.pollster === "Newspoll"))
  legs.push(["newspoll", () => legNewspoll(unstamped.filter((p) => p.pollster === "Newspoll").map((p) => (p.published || p.date).slice(0, 10)))]);

for (const [name, fn] of LEG_ONLY ? legs.filter(([n]) => n === LEG_ONLY) : legs) {
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
  // eff==null records are link-only (DemosAU n/a-for-MRP): never eff-stamp
  let cands = [...seen.values()].filter((r) => r.eff != null && r.pollster === p.pollster && r.end && Math.abs(ddays(r.end, p.date)) <= 1);
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
   link, a RedBridge/Accent row the link to its wave's Accent
   methodology-report PDF, and a DemosAU row the statement's own
   wp-content PDF off the wave's statement record. Same matching
   discipline as sampleEff (YouGov ±1 day, series-locked by the row's URL;
   Newspoll ±7 days on the statement's publication date; RedBridge/Accent
   an exact date match on the redbridge-src cache's fieldwork end; DemosAU
   ±1 day on the statement's parsed fieldwork end), absent-not-zero, never
   overwritten – EXCEPT Essential, whose waves all share the ONE living
   disclosure-statement PDF, so its link refreshes silently when the house
   re-uploads at a new URL (the dedicated block below; there is no
   per-wave Essential statement to preserve). The commissioned YouGov
   waves file no statement with YouGov's APC listing, so they keep no
   link. */
let npLinks = [];
if ((!LEG_ONLY || LEG_ONLY === "newspoll") && D.polls.some((p) => p.pollster === "Newspoll" && p.methodUrl == null)) {
  const needDates = D.polls
    .filter((p) => p.pollster === "Newspoll" && p.methodUrl == null)
    .map((p) => (p.published || p.date).slice(0, 10));
  try { npLinks = await legNewspollLinks(needDates); }
  catch (e) { errors.push("leg newspoll-links: " + String(e.message).slice(0, 180)); }
}
const accentLinks = D.polls.some((p) => p.pollster.startsWith("RedBridge / Accent") && p.methodUrl == null)
  ? legAccentLinks()
  : [];
const methods = [];
/* Essential's living-PDF link: stamp or REFRESH every wave the disclosure
   table covers (the brand-new release, not yet appended, is skipped). */
const essUrl = (records.find((r) => r.pollster === "Essential") || {}).href;
if (essUrl) {
  const essEnds = [...seen.values()].filter((r) => r.pollster === "Essential" && r.end).map((r) => r.end);
  for (const p of D.polls) {
    if (p.pollster !== "Essential") continue;
    if (p.methodUrl === essUrl) continue;
    if (!essEnds.some((e) => Math.abs(ddays(e, p.date)) <= 1)) continue;
    const after = "releaseUrl" in p ? "releaseUrl" : "url";
    const had = "methodUrl" in p;
    const rebuilt = {};
    for (const [k, v] of Object.entries(p)) {
      rebuilt[k] = v;
      if (k === after && !had) rebuilt.methodUrl = essUrl;
    }
    if (!("methodUrl" in rebuilt)) rebuilt.methodUrl = essUrl;
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, rebuilt);
    methods.push(`${p.date} Essential${had ? " (refreshed)" : ""} (Essential-Report-Disclosure-Statement-Full-Questionnaire.pdf)`);
  }
}
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
    : p.pollster.startsWith("RedBridge / Accent")
    ? [...new Set(accentLinks.filter((l) => l.date === p.date).map((l) => l.href))]
    : p.pollster.startsWith("DemosAU")
    ? [...new Set(records
        .filter((r) => r.pollster === p.pollster && r.end && Math.abs(ddays(r.end, p.date)) <= 1)
        .map((r) => r.href))]
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
