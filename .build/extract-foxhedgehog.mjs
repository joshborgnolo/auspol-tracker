#!/usr/bin/env node
// Extract Fox & Hedgehog "National Voter Sentiment Survey" releases
// (published in The Daily Telegraph, released on foxhedgehog.com.au/news-den)
// from the news-den RSS feed into data/polls.json. Exit codes: 0 = ok
// (including "nothing new"), 1 = fetch/parse error, 2 = guard failure.
// The last line of stdout is always `FH_STATUS {json}`.
//
// What this file does, in order:
//   1. fetch https://www.foxhedgehog.com.au/news-den?format=rss (Squarespace)
//   2. keep items titled *"…National Voter Sentiment Survey"* with a
//      the-daily-telegraph* news-den slug — skips the Bondi Royal Commission
//      poll, state polls and non-poll posts
//   3. per candidate, fetch the article page and split its sqs-html-content
//      link block into Telegraph article link(s), report link, methodology
//      link (tinyurls → Google Drive /file/d/…; bytes come from Drive's
//      uc-export endpoint; Jan-2026's single "full report and methodology
//      statement" link is recorded resolved, matching canon)
//   4. pdftotext -layout the report PDF; parse fieldwork dates, sample,
//      effective sample, horse-race tables (primary vote, TPP, 3PP donut,
//      TPP match-ups) and leadership (satisfaction nets, PPM share by
//      surname, KEY FIGURES Hanson row)
//   5. matched waves (canon date within 3d): verify every mechanical figure
//      against polls/ppm/approval/altTpp canon. Known upstream divergences
//      for 2026-01-06 are whitelisted (the house re-uploaded its Jan report
//      after hand-entry: ppm, approval nets and the linked Telegraph piece
//      all changed)
//   6. new waves: guard checks, then append polls/ppm/approval/altTpp rows
//      and un-stop the pollsterRules entry (release.month + site, the
//      DemosAU rule shape)
//
// Row shapes (mirroring the four hand-entered waves):
//   polls:    {date, published(rss→AEST), dateStart, pollster:"Fox &
//              Hedgehog", client:"Daily Telegraph", sample, sampleEff,
//              alp,lnp,grn,onp,ind, oth:null, tpp_alp, tpp_lnp,
//              tpp3{alp,lnp,onp}, url(Telegraph, %2F-encoded), releaseUrl,
//              methodUrl}
//   ppm:      {date, firm, alb, opp, oppName, han:null, extra:null}
//   approval: {date, firm, alb, opp, oppName, han, detail|{alb,opp,han}|null}
//   altTpp:   {date, firm, alpVsOnp_alp, lnpVsOnp_lnp}
//
// Hard dependencies: curl-able internet, a pdftotext binary. Canon-first:
// anything this file writes follows the existing shapes above; writes are
// atomic (.tmp + rename); provenance lands only under
// .build/foxhedgehog-src/ (pdftotext caches, demosau-src convention);
// parser notes ride the status JSON instead of the canon JSON.
// Test hooks: FH_OUT / FH_SRC_DIR redirect outputs; --check = no writes;
// --force = re-download PDFs ignoring caches; --url <article> = parse one
// release, print to stdout, touch nothing.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
const oneIdx = argv.indexOf("--url");
const ONE_URL = oneIdx >= 0 ? argv[oneIdx + 1] : null;
const RSS_URL = "https://www.foxhedgehog.com.au/news-den?format=rss";
const OUT = process.env.FH_OUT || "data/polls.json";
const SRC_DIR = process.env.FH_SRC_DIR || ".build/foxhedgehog-src";
const CYCLE_START = "2025-05-04";
const FETCH_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------- fetching
async function fetchBuffer(url) {
  let lastErr;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker data update)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { buf: Buffer.from(await res.arrayBuffer()), finalUrl: res.url || url };
    } catch (err) {
      lastErr = err;
      if (i < 3) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed: ${url}: ${lastErr.message}`);
}

// Printed links are usually tinyurls into Google Drive /file/d/<id>/view —
// the bytes come from Drive's uc-export download endpoint.
async function fetchPdf(url) {
  const { buf: landing, finalUrl } = await fetchBuffer(url);
  if (landing.subarray(0, 5).toString("latin1") === "%PDF-") return { buf: landing, finalUrl };
  const driveId = finalUrl.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1];
  const dl = driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : finalUrl;
  let { buf } = await fetchBuffer(dl);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    // large files get a virus-scan interstitial with a confirm link
    const m = buf.toString("utf8").match(/href="(\/uc[^"]*download[^"]*)"/);
    if (!m) throw new Error(`no pdf behind ${url}`);
    ({ buf } = await fetchBuffer(new URL(m[1], dl).href.replaceAll("&amp;", "&")));
  }
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`no pdf behind ${url}`);
  return { buf, finalUrl: driveId ? dl : finalUrl };
}

function pdfToText(buf, slug) {
  const pdfPath = join(tmpdir(), `foxhedgehog-${slug}.pdf`);
  writeFileSync(pdfPath, buf);
  const bins = ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext"];
  let lastErr;
  for (const bin of bins) {
    try {
      return execFileSync(bin, ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
    } catch (err) {
      if (err.code === "ENOENT") { lastErr = err; continue; }
      throw new Error(`pdftotext failed on ${slug}: ${err.message.slice(0, 200)}`);
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
const MONTH_RE = "January|February|March|April|May|June|July|August|September|October|November|December";
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

// "5 January - 6 January 2026" | "17 - 19 February 2026" | "24-25 March 2026"
// → { dateStart, date }
function parsePeriod(raw) {
  const s = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  let m = s.match(/(\d{1,2})\s+([A-Za-z]+)\.?\s*-\s*(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
  if (m) {
    const [, d1, mo1, d2, mo2, y] = m;
    const M1 = MONTHS[mo1.toLowerCase()], M2 = MONTHS[mo2.toLowerCase()];
    if (M1 != null && M2 != null)
      return { dateStart: iso(+y, M1, +d1), date: M2 < M1 ? iso(+y + 1, M2, +d2) : iso(+y, M2, +d2) };
  }
  m = s.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
  if (m) {
    const [, d1, d2, mo, y] = m;
    const M = MONTHS[mo.toLowerCase()];
    if (M != null) return { dateStart: iso(+y, M, +d1), date: iso(+y, M, +d2) };
  }
  return null;
}

const toNum = (s) => parseFloat(String(s).replace(/,/g, ""));
const asPct = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);

// ------------------------------------------------------------------- RSS
function rssItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const pick = (re) => b.match(re)?.[1] ?? null;
    items.push({
      title: pick(/<title>([\s\S]*?)<\/title>/)?.replace(/&#x26;/g, "&").trim(),
      pubDate: pick(/<pubDate>([^<]+)<\/pubDate>/),
      link: pick(/<link>([^<]+)<\/link>/),
      content: pick(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/),
    });
  }
  return items;
}

// RSS pubDate (UTC) → canon `published` local form (AEST fixed +10, the
// YouGov extractor's wiki-pubDate convention)
const rssToLocal = (pub) => new Date(Date.parse(pub) + 10 * 36e5).toISOString().slice(0, 16);

// ---------------------------------------------------------------- article
// Split sqs-html-content into {label, href} pairs: every "Link to <label>:"
// caption claims the FIRST outbound href within 800 chars after it.
function articlePairs(html) {
  const block = html.match(/class="sqs-html-content">([\s\S]*?)<\/div>/)?.[1] ?? html;
  const caps = [...block.matchAll(/Link to\s*([^:<>]{2,80}):/gi)]
    .map((m) => ({ label: m[1].replace(/<[^>]+>/g, "").trim(), x: m.index }));
  const hrefs = [...block.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
    .map((m) => ({ href: m[1].replaceAll("&amp;", "&"), x: m.index }));
  return hrefs.map((h) => {
    const cap = caps.filter((c) => c.x < h.x && h.x - c.x < 800).pop();
    return { href: h.href, label: cap?.label ?? "" };
  });
}

function teleUrl(u) {
  try {
    const o = new URL(u);
    const path = decodeURIComponent(o.pathname).replace(/^\//, "");
    return `${o.protocol}//${o.host}/${encodeURIComponent(path)}`;
  } catch { return u; }
}

// Telegraph article / report / methodology roles out of an article's pairs.
// "voting intention" captions win when several Telegraph pieces are linked
// (Mar 2026: one voting-intention + one fuel-crisis piece); otherwise the
// LAST Telegraph link is the poll's own story (Feb 2026: the childcare
// piece was printed second and is canon). A "full report and methodology
// statement" link means report and LLC share one PDF (Jan 2026): the
// canonical methodUrl for that wave is the resolved final URL.
function classifyLinks(pairs, notes) {
  const tele = pairs.filter((p) => /dailytelegraph\.com\.au\//.test(p.href));
  const telePick = tele.find((p) => /voting intention/i.test(p.label)) ?? tele.at(-1) ?? null;
  if (tele.length > 1) notes.push(`article links ${tele.length} Telegraph pieces`);
  const report = pairs.find((p) => /full report/i.test(p.label));
  let method = pairs.find((p) => p !== report && /methodology/i.test(p.label));
  let combined = false;
  if (!method && report && /methodology/i.test(report.label)) combined = true;
  else if (!method && report) {
    // Feb-2026 style: the APC link rides unlabelled right after the report's
    const ri = pairs.indexOf(report);
    if (pairs[ri + 1] && !/dailytelegraph\.com\.au\//.test(pairs[ri + 1].href)) method = pairs[ri + 1];
  }
  return { tele: telePick?.href ?? null, report: report?.href ?? null,
    method: combined ? null : (method?.href ?? null), combined };
}

// ----------------------------------------------------------------- parser
const SECTION = (txt, from, to) => {
  const a = txt.indexOf(from);
  if (a < 0) return null;
  const b = to ? txt.indexOf(to, a + from.length) : -1;
  return txt.slice(a, b > 0 ? b : undefined);
};

function parseReport(txt, slug) {
  const w = { slug };
  const fp = txt.match(/Fieldwork dates:\s*([^\n]+)/i);
  const p = fp && parsePeriod(fp[1]);
  if (p) ({ dateStart: w.dateStart, date: w.date } = p);
  const smp = txt.match(/Sample Size:\s*([\d,]+)/i);
  if (smp) w.sample = toNum(smp[1]);
  const eff = txt.match(/Effective sample size post-weighting:\s*([\d,]+)/i);
  if (eff) w.sampleEff = toNum(eff[1]);

  // horse-race tables: FIRST month-labelled data row after each header —
  // later rows are previous waves and the "2025 Election" calibration anchor
  const sect = SECTION(txt, "PRIMARY VOTE", "SUPPORT FOR POLICIES") ?? txt;
  const priRe = new RegExp(`^\\s*(${MONTH_RE})\\s+\\d{4}\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s*$`, "m");
  const pm = sect.match(priRe);
  if (pm) [w.priMonth, w.alp, w.lnp, w.grn, w.onp, w.ind] =
    [pm[1], pm[2], pm[3], pm[4], pm[5], pm[6]].map((s, i) => (i ? asPct(toNum(s)) : s));
  const tppRe = new RegExp(`^\\s*(${MONTH_RE})\\s+\\d{4}\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s*$`, "m");
  const tm = sect.match(tppRe);
  if (tm) [w.tppMonth, w.tpp_alp, w.tpp_lnp] =
    [tm[1], asPct(toNum(tm[2])), asPct(toNum(tm[3]))];

  // 3PP donut: the label roams — alone on its line (Labor 46%), at the end of
  // the header row (Jan's "One Nation"), or at line start with the 0–100 scale
  // trailing (Feb's "Coalition"). Try alone-on-line FIRST, because Jan's
  // header row mentions all three labels on one line and would otherwise
  // hand every party the same share; the share is the first bare "NN%" token
  // on the following line.
  const t3 = {};
  for (const [k, pat] of [["alp", "Labor"], ["lnp", "Coalition"], ["onp", "One Nation"]]) {
    const m = sect.match(new RegExp(`\\n[ \\t]*${pat}[ \\t]*\\n[ \\t]*(\\d+(?:\\.\\d+)?)%`))
      ?? sect.match(new RegExp(`\\n[^\\n]*${pat}[^\\n]*\\n[ \\t]*(\\d+(?:\\.\\d+)?)%`));
    if (m) t3[k] = asPct(toNum(m[1]));
  }
  if (t3.alp != null && t3.lnp != null && t3.onp != null) w.tpp3 = t3;

  const mu = (pat) => { const m = sect.match(pat); return m ? [toNum(m[1]), toNum(m[2])] : null; };
  const lvOn = mu(/Labor v One Nation\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
  const cvOn = mu(/Coalition v One Nation\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
  if (lvOn) w.alpVsOnp_alp = asPct(lvOn[0]);
  if (cvOn) w.lnpVsOnp_lnp = asPct(cvOn[0]);
  return w;
}

// Leadership page: all-caps role headings, then one numbers line per leader
// (Approve … Disapprove, trailing signed net; blanks collapse). PPM surnames
// carry the donut shares on the next line ("Taylor\n 38% (+3%)").
function parseLeadership(txt) {
  const sect = SECTION(txt, "LEADER SATISFACTION", "SUPPORT FOR POLICIES");
  if (!sect) return {};
  const pmName = sect.match(/([A-Z][A-Z .'-]{3,}) - PRIME MINISTER/)?.[1];
  const opName = sect.match(/([A-Z][A-Z .'-]{3,}) - LEADER OF THE FEDERAL OPPOSITION/)?.[1];
  const titleCase = (full) => {
    const w = full.trim().split(/\s+/).pop();
    return w.charAt(0) + w.slice(1).toLowerCase();
  };

  const numbersAfter = (heading) => {
    const i = sect.indexOf(heading);
    if (i < 0) return null;
    const lines = sect.slice(i).split("\n").filter((l) => /\d/.test(l) && !/JANUARY|FEBRUARY|MARCH|APRIL|MAY |JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER/.test(l));
    for (const l of lines.slice(0, 8)) {
      const clean = l.replace(/\([^)]*\)/g, " ");
      const toks = clean.match(/[+-]?\d+(?:\.\d+)?/g);
      if (toks && toks.length >= 3) {
        const vals = toks.map(toNum);
        return { app: vals[0], dis: vals[vals.length - 2], net: vals[vals.length - 1] };
      }
    }
    return null;
  };

  const out = {};
  // The PPM donut surname roams like the 3PP labels, and its share can sit
  // one or two lines below, possibly riding the tail of the 0–100 scale line
  // ("… 80  100      38% (+3%)"). After the surname line, scan up to two
  // digits/punctuation-only lines and take the first "NN%" token.
  const ppmShare = (sect, name) => {
    const m = sect.match(new RegExp(`\\n[^\\n]*${name}[ \\t]*\\n`));
    if (!m) return null;
    const after = sect.slice(m.index + m[0].length).split("\n").slice(0, 2);
    for (const line of after) {
      if (!/^[\d\s%()+.-]*$/.test(line)) continue;
      const t = line.match(/(\d+(?:\.\d+)?)%/);
      if (t) return asPct(toNum(t[1]));
    }
    return null;
  };
  if (pmName) {
    const s = numbersAfter(`${pmName} - PRIME MINISTER`);
    if (s) ({ app: out.albApp, dis: out.albDis, net: out.alb } = s);
    const v = ppmShare(sect, titleCase(pmName));
    if (v != null) out.ppmAlb = v;
  }
  if (opName) {
    out.oppName = titleCase(opName);
    const s = numbersAfter(`${opName} - LEADER OF THE FEDERAL OPPOSITION`);
    if (s) ({ app: out.oppApp, dis: out.oppDis, net: out.opp } = s);
    const v = ppmShare(sect, out.oppName);
    if (v != null) out.ppmOpp = v;
  }
  const han = sect.match(/Pauline Hanson\s+([\d.\s]*?)\s*([+-]?\d+)\s*(?:\(|$)/m);
  if (han) {
    const vals = han[1].trim().split(/\s+/).map(toNum).filter((v) => !Number.isNaN(v));
    out.han = toNum(han[2]);
    if (vals.length >= 2) { out.hanApp = vals[0]; out.hanDis = vals[vals.length - 1]; }
  }
  return out;
}

// -------------------------------------------------------------- wave cache
// Cached to <slug>-report.txt / <slug>-method.txt; re-downloaded when the
// article's link set changed or --force was passed (demosau-src convention:
// the committed txt caches make later runs offline-verifiable).
async function loadWave(slug, links, notes) {
  mkdirSync(SRC_DIR, { recursive: true });
  const reportPath = join(SRC_DIR, `${slug}-report.txt`);
  const methodPath = join(SRC_DIR, `${slug}-method.txt`);
  const linkPath = join(SRC_DIR, `${slug}.json`);
  const prev = !FORCE && existsSync(linkPath) ? JSON.parse(readFileSync(linkPath, "utf8")) : null;

  let reportTxt;
  if (!FORCE && prev?.report === links.report && existsSync(reportPath)) reportTxt = readFileSync(reportPath, "utf8");
  else {
    const { buf } = await fetchPdf(links.report);
    reportTxt = pdfToText(buf, `${slug}-report`);
    writeFileSync(reportPath, reportTxt);
  }

  let methodTxt = null;
  const methodTarget = links.combined ? links.report : links.method;
  // combined Jan-2026 case: the "report and methodology statement" IS the
  // report pdf whose own p3 carries the LLC short statement — use it and
  // record the resolved URL as the wave's canonical methodUrl
  if (links.combined) methodTxt = reportTxt;
  else if (methodTarget) {
    if (!FORCE && prev?.method === methodTarget && existsSync(methodPath)) methodTxt = readFileSync(methodPath, "utf8");
    else {
      const { buf } = await fetchPdf(methodTarget);
      methodTxt = pdfToText(buf, `${slug}-method`);
      writeFileSync(methodPath, methodTxt);
    }
  }

  // the canonical methodUrl: printed methodology link when the house links
  // the LLC statement separately; the resolved drive URL when combined
  let methodUrl = null;
  if (links.combined) {
    const { finalUrl } = await fetchBuffer(links.report);
    methodUrl = finalUrl.split("?")[0];
  } else if (links.method) methodUrl = links.method;

  const w = parseReport(reportTxt, slug);
  Object.assign(w, parseLeadership(reportTxt));
  w.methodUrl = methodUrl;
  w.methodTxt = !!methodTxt;

  // corroborate fieldwork/sample/eff against the LLC statement when separate
  if (methodTxt && methodTxt !== reportTxt) {
    const m = parseReport(methodTxt, `${slug}-method`);
    for (const k of ["date", "dateStart", "sample", "sampleEff"]) {
      if (m[k] == null || w[k] == null) continue;
      if (String(m[k]) !== String(w[k]))
        notes.push(`${slug}: LLC ${k} ${m[k]} ≠ report ${w[k]}`);
    }
  }

  writeFileSync(linkPath, JSON.stringify({ report: links.report, method: links.method ?? null,
    combined: links.combined, cachedAt: new Date().toISOString() }) + "\n");
  return w;
}

// ------------------------------------------------------------------ guard
function guardNewWave(w, published) {
  const errs = [];
  const need = (k, what) => { if (w[k] == null) errs.push(`missing ${what} (${k})`); };
  need("date", "fieldwork end"); need("dateStart", "fieldwork start");
  need("sample", "sample size"); need("sampleEff", "effective sample");
  if (errs.length) return errs;
  const span = daysBetween(w.dateStart, w.date);
  if (!(span >= 1 && span <= 14)) errs.push(`implausible fieldwork span ${span}d`);
  if (w.date > new Date().toISOString().slice(0, 10)) errs.push(`future date ${w.date}`);
  if (!(w.sample >= 500 && w.sample <= 4000)) errs.push(`implausible sample ${w.sample}`);
  if (!(w.sampleEff >= 200 && w.sampleEff <= w.sample)) errs.push(`implausible effective sample ${w.sampleEff}`);
  const pri = [w.alp, w.lnp, w.grn, w.onp, w.ind];
  if (pri.some((v) => v == null || v < 1 || v > 70)) errs.push(`primary figure out of range: ${JSON.stringify(pri)}`);
  else {
    const s = pri.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 100) > 2) errs.push(`primary votes sum ${s}`);
  }
  if (w.tpp_alp == null || w.tpp_lnp == null || Math.abs(w.tpp_alp + w.tpp_lnp - 100) > 1) errs.push(`tpp pair doesn't sum to 100: ${w.tpp_alp}/${w.tpp_lnp}`);
  if (!w.tpp3 || Math.abs(w.tpp3.alp + w.tpp3.lnp + w.tpp3.onp - 100) > 1) errs.push(`tpp3 missing or doesn't sum to 100: ${JSON.stringify(w.tpp3 ?? null)}`);
  if (w.alpVsOnp_alp == null || Math.abs(w.alpVsOnp_alp + (100 - w.alpVsOnp_alp) - 100) > 1) errs.push("missing alt tpp (labor vs one nation)");
  if (w.lnpVsOnp_lnp == null) errs.push("missing alt tpp (coalition vs one nation)");
  const wantMonth = new Date(`${w.date}T00:00:00Z`).toLocaleString("en", { month: "long", timeZone: "UTC" });
  if (w.priMonth && w.priMonth !== wantMonth) errs.push(`primary table month ${w.priMonth} ≠ fieldwork month ${wantMonth}`);
  if (w.ppmAlb == null || w.ppmOpp == null) errs.push("ppm not parsed");
  if (w.alb == null || w.opp == null || Math.abs(w.alb) > 80 || Math.abs(w.opp) > 80) errs.push(`leadership nets implausible: ${w.alb}/${w.opp}`);
  if (published) {
    const lag = daysBetween(w.date, published.slice(0, 10));
    if (lag < 0 || lag > 21) errs.push(`release lag ${lag}d from fieldwork end`);
  }
  if (!w.url || !/dailytelegraph\.com\.au/.test(w.url)) errs.push("no Telegraph article url parsed");
  if (!w.methodUrl || !/^https:\/\//.test(w.methodUrl)) errs.push("no methodUrl parsed");
  return errs;
}

// canon 2026-01-06 rows were hand-entered from the Telegraph piece; the house
// later re-uploaded its Jan report under the same link with revised
// satisfaction/PPM figures and swapped the linked Telegraph story. These
// never rewrite canon — expected divergences land in status.notes.
const KNOWN_DIVERGENCE = {
  "2026-01-06": new Set(["ppm.alb", "ppm.opp", "approval.alb", "approval.opp", "approval.han", "polls.url"]),
};

function figureDiffs(date, w, D) {
  const diffs = [];
  const known = KNOWN_DIVERGENCE[date] ?? new Set();
  const chk = (key, canon, got) => {
    if (got == null) { diffs.push({ key, canon, got, parse: "absent" }); return; }
    if (String(canon) !== String(got)) diffs.push({ key, canon, got, known: known.has(key) });
  };
  const poll = D.polls.find((p) => p.pollster === "Fox & Hedgehog" && p.date === date);
  if (poll) {
    chk("polls.dateStart", poll.dateStart, w.dateStart);
    chk("polls.sample", poll.sample, w.sample);
    chk("polls.sampleEff", poll.sampleEff, w.sampleEff);
    for (const k of ["alp", "lnp", "grn", "onp", "ind"]) chk(`polls.${k}`, poll[k], w[k]);
    chk("polls.tpp_alp", poll.tpp_alp, w.tpp_alp);
    chk("polls.tpp_lnp", poll.tpp_lnp, w.tpp_lnp);
    chk("polls.tpp3", JSON.stringify(poll.tpp3), w.tpp3 ? JSON.stringify(w.tpp3) : null);
    chk("polls.releaseUrl", poll.releaseUrl, w.releaseUrl);
    chk("polls.methodUrl", poll.methodUrl, w.methodUrl);
    chk("polls.url", poll.url, w.url); // Telegraph piece re-links upstream land as known notes
  }
  const ppm = D.ppm.find((p) => p.firm === "Fox & Hedgehog" && p.date === date);
  if (ppm) { chk("ppm.alb", ppm.alb, w.ppmAlb); chk("ppm.opp", ppm.opp, w.ppmOpp); chk("ppm.oppName", ppm.oppName, w.oppName); }
  const ap = D.approval.find((p) => p.firm === "Fox & Hedgehog" && p.date === date);
  if (ap) { chk("approval.alb", ap.alb, w.alb); chk("approval.opp", ap.opp, w.opp); if (ap.han != null) chk("approval.han", ap.han, w.han); }
  const alt = D.altTpp.find((p) => p.firm === "Fox & Hedgehog" && p.date === date);
  if (alt) { chk("altTpp.alpVsOnp_alp", alt.alpVsOnp_alp, w.alpVsOnp_alp); chk("altTpp.lnpVsOnp_lnp", alt.lnpVsOnp_lnp, w.lnpVsOnp_lnp); }
  return diffs;
}

// ------------------------------------------------------------------ rows
function pollRows(w, item) {
  const rows = { polls: null, ppm: null, approval: null, altTpp: null };
  rows.polls = {
    date: w.date,
    published: item.pubDate ? rssToLocal(item.pubDate) : undefined,
    dateStart: w.dateStart,
    pollster: "Fox & Hedgehog",
    client: "Daily Telegraph",
    sample: w.sample,
    sampleEff: w.sampleEff,
    alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: null,
    tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp,
    tpp3: w.tpp3,
    url: w.url,
    releaseUrl: item.link,
    methodUrl: w.methodUrl,
  };
  if (!rows.polls.published) delete rows.polls.published;
  rows.ppm = { date: w.date, firm: "Fox & Hedgehog", alb: w.ppmAlb, opp: w.ppmOpp,
    oppName: w.oppName, han: null, extra: null };
  rows.approval = { date: w.date, firm: "Fox & Hedgehog", alb: w.alb, opp: w.opp,
    oppName: w.oppName, han: w.han ?? null, detail: null };
  if (w.albApp != null && w.albDis != null && w.oppApp != null && w.oppDis != null) {
    rows.approval.detail = { alb: { app: w.albApp, dis: w.albDis },
      opp: { app: w.oppApp, dis: w.oppDis } };
    if (w.hanApp != null && w.hanDis != null) rows.approval.detail.han = { app: w.hanApp, dis: w.hanDis };
  }
  rows.altTpp = { date: w.date, firm: "Fox & Hedgehog",
    alpVsOnp_alp: w.alpVsOnp_alp, lnpVsOnp_lnp: w.lnpVsOnp_lnp };
  return rows;
}

// -------------------------------------------------------------------- main
const status = { changed: false, check: CHECK, added: [], verified: [], mismatches: [],
  notes: [], skipped_items: [], item_errors: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const existing = D.polls.filter((p) => p.pollster === "Fox & Hedgehog");

  let items;
  if (ONE_URL) items = [{ title: "(oracle)", pubDate: null, link: ONE_URL, content: null }];
  else {
    const { buf } = await fetchBuffer(RSS_URL);
    const all = rssItems(buf.toString("utf8"));
    items = all.filter((i) => i.link && /news-den\/the-daily-telegraph/i.test(i.link)
      && /national voter sentiment survey/i.test(i.title ?? ""));
    if (!items.length && all.length >= 4) throw new Error("no voter-sentiment items in RSS (site restructure?)");
    status.skipped_items = all.filter((i) => !items.includes(i)).map((i) => i.title);
  }
  status.candidates = items.map((i) => i.title);

  const guardFails = [];
  const newRows = { polls: [], ppm: [], approval: [], altTpp: [] };
  for (const item of items) {
    const slug = item.link.split("/").filter(Boolean).pop();
    try {
      const notes = [];
      const { buf } = await fetchBuffer(item.link);
      const pairs = articlePairs(buf.toString("utf8"));
      const links = classifyLinks(pairs, notes);
      if (!links.report) throw new Error("no report link on article page");
      if (links.tele) item.tele = teleUrl(links.tele);
      const w = await loadWave(slug, links, notes);
      w.url = item.tele;
      w.releaseUrl = item.link;
      if (ONE_URL) console.log(JSON.stringify(pollRows(w, item), null, 2));

      const matched = existing.find((e) => w.date && Math.abs(daysBetween(e.date, w.date)) <= 3);
      status.verified.push({ slug, date: w.date, matched: !!matched });
      if (matched) {
        for (const d of figureDiffs(matched.date, w, D)) {
          if (d.known || d.parse === "absent") status.notes.push(`${matched.date} ${d.key}: canon ${d.canon} vs parse ${d.got}`);
          else status.mismatches.push({ date: matched.date, slug, ...d });
        }
        status.notes.push(...notes);
        continue;
      }
      if (w.date && w.date < CYCLE_START) continue;

      // new wave: guard, then queue rows
      const errs = guardNewWave(w, item.pubDate ? rssToLocal(item.pubDate) : null);
      if (errs.length) { guardFails.push(...errs.map((e) => `${slug}: ${e}`)); continue; }
      if (existing.some((e) => Math.abs(daysBetween(e.date, w.date)) <= 7) ||
          newRows.polls.some((r) => Math.abs(daysBetween(r.date, w.date)) <= 7)) {
        guardFails.push(`${slug}: duplicate/retro wave ${w.date}`); continue;
      }
      const rows = pollRows(w, item);
      for (const sec of Object.keys(newRows)) newRows[sec].push(rows[sec]);
      status.added.push({ date: w.date, slug, alp: w.alp, onp: w.onp, tpp: w.tpp_alp, sample: w.sample, eff: w.sampleEff });
      status.notes.push(...notes);
    } catch (err) {
      status.item_errors.push({ item: item.title, error: String(err?.message || err) });
    }
  }

  if (status.item_errors.length && !ONE_URL) {
    console.error("FH_ERROR " + status.item_errors.map((e) => `${e.item}: ${e.error}`).join(" | "));
    status.guard = guardFails;
    console.log("FH_STATUS " + JSON.stringify(status));
    process.exit(1);
  }
  if (guardFails.length) {
    console.error("FH_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("FH_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newRows.polls.length) {
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    for (const sec of Object.keys(newRows)) D[sec] = [...D[sec], ...newRows[sec]].sort(byDate);
    // the house has resumed: un-stop its pollsterRules entry so +Next polls
    // and the coverage watchdog treat it as a live monthly house ("silenced"
    // flag is only ever a hand-entry — the extractor's new wave revokes it)
    const rule = D.pollsterRules?.["Fox & Hedgehog"];
    if (rule?.stopped) {
      D.pollsterRules["Fox & Hedgehog"] = {
        release: { month: true, note: "FED News-den release ~monthly (Daily Telegraph)" },
        site: "https://www.foxhedgehog.com.au/news-den" };
      status.notes.push("pollsterRules: un-stopped Fox & Hedgehog (new wave landed)");
    }
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    status.changed = JSON.stringify(D, null, 2) + trailingNl !== orig;
    if (status.changed && !CHECK && !ONE_URL) {
      writeFileSync(OUT + ".tmp", JSON.stringify(D, null, 2) + trailingNl);
      renameSync(OUT + ".tmp", OUT);
      console.log(`wrote ${OUT}: +${newRows.polls.length} Fox & Hedgehog wave(s)`);
    }
  }
  if (ONE_URL && newRows.polls.length) console.log(JSON.stringify(newRows.polls[0], null, 2));
  console.log("FH_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("FH_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("FH_STATUS " + JSON.stringify(status));
  process.exit(1);
}
