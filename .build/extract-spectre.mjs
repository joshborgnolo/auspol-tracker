#!/usr/bin/env node
// Extract Spectre Strategy federal polling releases ("Australian Federal
// Politi[cal|ing] Update", spectrestrategy.com/blog-3-1, Squarespace RSS)
// into data/polls.json. Exit codes: 0 = ok (including "nothing new"),
// 1 = fetch/parse error, 2 = guard failure. The last line of stdout is
// always `SPECTRE_STATUS {json}`.
//
// What this file does, in order:
//   1. fetch https://www.spectrestrategy.com/blog-3-1?format=rss
//   2. keep items titled "Australian Federal Poll{ing,itical} Update" —
//      the AI-use / illicit-tobacco / election-forecast / SMH posts are
//      skipped on purpose
//   3. per candidate, take the report PDF href from the RSS description
//      (spectrestrategy.com/s/Political-Update-<Month>-<YY>-Spectre-
//      Strategy.pdf; direct Squarespace file, no Drive hop), falling back
//      to scraping the article page for a .pdf link. Waves whose page is
//      IMAGE-ONLY (Jul 2025, Nov 2025 — chart PNGs, no PDF) are legacy:
//      cannot re-derive their canon rows, so they are noted and skipped
//   4. pdftotext -layout the PDF; parse the methodology box (n, fieldwork
//      window), the FIRST PREFERENCE VOTE chart (label presents, share is
//      the first "NN% ±NN" after the label inside the primaries slice),
//      the TWO PARTY PREFERRED prose pair + Labor-v-One-Nation pair, the
//      APPROVAL RATINGS table (six % cells per figure; canon nets are
//      DERIVED app-dis, not the PDF's printed NET column), and — only when
//      the wave has a PPM page — the preferred-PM and Albanese-v-Hanson
//      head-to-head prose pairs
//   5. matched waves (canon date within 3d): verify every mechanical
//      figure against polls/ppm/ppmHeadToHead/approval/altTpp canon; RSS
//      pubDate-vs-hand-entered `published` stays a note, never a rewrite
//   6. new waves: guard checks, then append rows to those five arrays.
//      Spectre is a live house with no pollsterRules entry — nothing to
//      un-stop
//
// Row shapes (mirroring the four hand-entered waves):
//   polls:          {date, published(rss→AEST), dateStart,
//                    pollster:"Spectre Strategy", client:"—", sample,
//                    undecided, alp,lnp,grn,onp,ind, oth:null,
//                    tpp_alp, tpp_lnp, url(article page)}
//                    (undecided is parsed for new waves; the four canon
//                    rows predate the field and stay as the house entered
//                    them)
//   ppm:            {date, firm, alb, opp, oppName, han:null, extra:null}
//   ppmHeadToHead:  {date, firm, alb, han}
//   approval:       {date, firm, alb, opp, oppName, han,
//                    detail{alb,opp,han:{app,dis}}}
//   altTpp:         {date, firm, alpVsOnp_alp, lnpVsOnp_lnp:null}
//
// Hard dependencies: curl-able internet, a pdftotext binary. Canon-first:
// anything this file writes follows the existing shapes above; writes are
// atomic (.tmp + rename); provenance lands only under .build/spectre-src/
// (pdftotext caches, demosau-src convention). Test hooks: SPECTRE_OUT /
// SPECTRE_SRC_DIR redirect outputs; --check = no writes; --force =
// re-download PDFs ignoring caches; --url <rss-item-link> = parse one
// release, print to stdout, touch nothing.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { melbourneMinute } from "./melbourne-time.mjs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
const oneIdx = argv.indexOf("--url");
const ONE_URL = oneIdx >= 0 ? argv[oneIdx + 1] : null;
const RSS_URL = "https://www.spectrestrategy.com/blog-3-1?format=rss";
const OUT = process.env.SPECTRE_OUT || "data/polls.json";
const SRC_DIR = process.env.SPECTRE_SRC_DIR || ".build/spectre-src";
const CYCLE_START = "2025-05-04";
const FETCH_TIMEOUT_MS = 60_000;
const POLLSTER = "Spectre Strategy";

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

// Squarespace serves the PDF bytes directly — nothing to resolve except
// following redirects; still confirm the magic.
async function fetchPdf(url) {
  const { buf } = await fetchBuffer(url);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`no pdf behind ${url}`);
  return buf;
}

function pdfToText(buf, slug) {
  const pdfPath = join(tmpdir(), `spectre-${slug}.pdf`);
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
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

// "11-23 July 2026" | "2-8 April 2026" → { dateStart, date }
function parsePeriod(raw) {
  const s = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const m = s.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
  if (!m) return null;
  const [, d1, d2, mo, y] = m;
  const M = MONTHS[mo.toLowerCase()];
  if (M == null) return null;
  return { dateStart: iso(+y, M, +d1), date: iso(+y, M, +d2) };
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
      desc: pick(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/),
    });
  }
  return items;
}

// RSS pubDate (UTC) → canon `published` local form (Melbourne-local via
// ./melbourne-time.mjs, the roymorgan convention — a fixed +10 was wrong
// half the year)
const rssToLocal = (pub) => melbourneMinute(new Date(Date.parse(pub)));

// PDF link for an item: RSS description href first, article page second.
function pdfFromDesc(desc) {
  if (!desc) return null;
  return desc.match(/href="(https:\/\/www\.spectrestrategy\.com\/s\/[^"]+\.pdf)"/)?.[1] ?? null;
}
async function pdfFromArticle(url) {
  const { buf } = await fetchBuffer(url);
  const html = buf.toString("utf8");
  const m = html.match(/href="(https:\/\/www\.spectrestrategy\.com\/s\/[^"]+\.pdf)"/)
    ?? html.match(/href="(\/s\/[^"]+\.pdf)"/);
  return m ? (m[1].startsWith("/") ? `https://www.spectrestrategy.com${m[1]}` : m[1]) : null;
}

// ----------------------------------------------------------------- parser
const SECTION = (txt, from, to) => {
  const a = txt.indexOf(from);
  if (a < 0) return null;
  const b = to ? txt.indexOf(to, a + from.length) : -1;
  return txt.slice(a, b > 0 ? b : undefined);
};

function parseReport(txt, slug, D) {
  const w = { slug };

  // methodology box — the fieldwork window itself can wrap
  // ("…between 11-23\n       July 2026"), so glue the continuation line
  const fp = txt.match(/Fieldwork was conducted between\s+([^\n]+(?:\n\s{2,}[^\n]+)?)/i);
  const p = fp && parsePeriod(fp[1]);
  if (p) ({ dateStart: w.dateStart, date: w.date } = p);
  const smp = txt.match(/Sample size is n=\s*([\d,]+)/i);
  if (smp) w.sample = toNum(smp[1]);
  const und = txt.match(/(\d+)%\s+of voters were undecided before apportionment/i);
  if (und) w.undecided = toNum(und[1]);

  // primary vote chart: label line, then the first "NN% ±change" token that
  // follows it inside the slice (multi-column chart renders sparse; the
  // share is always paired with a signed change-since-election figure)
  const pri = SECTION(txt, "The Liberal National Coalition", "Q: If a Federal Election") ?? "";
  for (const [k, label] of [["lnp", "The Liberal National Coalition"], ["alp", "The Labor Party"],
    ["grn", "The Greens"], ["onp", "One Nation"], ["ind", "Other"]]) {
    const li = pri.search(new RegExp(`^[ \\t]*${label}(?:[ \\t]*$|[ \\t]+)`, "m"));
    if (li < 0) continue;
    const slice = pri.slice(li, li + 600);
    const m = slice.match(/(\d+(?:\.\d+)?)%\s+([+\-−]\d+(?:\.\d+)?)/);
    if (m) w[k] = asPct(toNum(m[1]));
  }

  // TPP + Labor-v-One-Nation: the dedicated page's prose pair. Coalition-led
  // waves would need the mirror form — the guard will flag a null pair first
  const tpp = SECTION(txt, "TWO PARTY PREFERRED", "FIRM VOTE") ?? "";
  let tp = tpp.match(/leads the Liberal National Coalition\s+(\d+)%\s+to\s+(\d+)%\s+and\s+One\s*Nation\s+(\d+)%\s+to\s+(\d+)%/);
  if (tp) [w.tpp_alp, w.tpp_lnp, w.alpVsOnp_alp] = [tp[1], tp[2], tp[3]].map((s) => asPct(toNum(s)));

  // PPM page (absent in some waves — Jul 2026 has none, canon accordingly
  // has no ppm row for it): both the exec bullet and the dedicated page put
  // "…leads <Name> … preferred Prime Minister … NN% to NN%" in prose
  const hasPpmText = /preferred Prime Minister/i.test(txt);
  w.hasPpm = hasPpmText;
  if (hasPpmText) {
    const pm = txt.match(/Albanese leads(?:\s+new Liberal leader)?\s+([A-Z][a-zà-ž'-]+(?:\s+[A-Z][a-zà-ž'-]+)*)[\s\S]{0,90}?preferred Prime Minister(?: of Australia)?\s+(\d+)%\s+to\s+(\d+)%/);
    if (pm) {
      w.ppmAlb = asPct(toNum(pm[2]));
      w.ppmOpp = asPct(toNum(pm[3]));
      w.oppName = pm[1].trim().split(/\s+/).pop();
    }
    const hh = txt.match(/Albanese leads (?:Pauline\s+)?Hanson by \d+pts?[\s\S]{0,300}?\((\d+)%\s*vs\s*(\d+)%\)/i)
      ?? txt.match(/and\s+leads\s+(?:Pauline\s+)?Hanson\s+(\d+)%\s+to\s+(\d+)%/i);
    if (hh) { w.h2hAlb = asPct(toNum(hh[1])); w.h2hHan = asPct(toNum(hh[2])); }
  }

  // approval table: six % cells per figure (strongly/slightly favourable,
  // never-heard, neutral, slightly/strongly unfavourable) then the printed
  // NET. Canon nets are fav-unfav derived from the cells — Albanese Apr
  // prints -22 where 31-52 = -21, and canon keeps -21
  const appTbl = SECTION(txt, "APPROVAL\nRATINGS", "Q: Below are a number of figures");
  const names = { alb: "Albanese", han: "Pauline Hanson" };
  if (!w.oppName && D) {
    const last = (D.approval ?? []).filter((r) => r.firm === POLLSTER).at(-1)
      ?? (D.ppm ?? []).filter((r) => r.firm === POLLSTER).at(-1);
    if (last?.oppName) w.oppName = last.oppName;
  }
  if (appTbl) {
    const sixRun = /(?:\d+(?:\.\d+)?%\s+){5}\d+(?:\.\d+)?%/;
    const appLines = appTbl.split("\n");
    // Row labels sit in the left column (first ~40 chars); the side-comment
    // column quotes the same names further right ("…ahead of Albanese on
    // -22."), so match the surname ONLY in the left position
    const row = (surname) => {
      const li = appLines.findIndex((l) => { const at = l.indexOf(surname); return at >= 0 && at < 40; });
      if (li < 0) return null;
      const slice = appLines.slice(li, li + 8).join("\n");
      const m = slice.match(sixRun);
      if (!m) return null;
      const v = [...m[0].matchAll(/(\d+(?:\.\d+)?)%/g)].map((c) => asPct(toNum(c[1])));
      return { app: v[0] + v[1], dis: v[4] + v[5] };
    };
    const rows = { alb: row(names.alb), han: row(names.han), opp: w.oppName ? row(w.oppName) : null };
    if (rows.alb) { w.albApp = rows.alb.app; w.albDis = rows.alb.dis; w.alb = rows.alb.app - rows.alb.dis; }
    if (rows.opp) { w.oppApp = rows.opp.app; w.oppDis = rows.opp.dis; w.opp = rows.opp.app - rows.opp.dis; }
    if (rows.han) { w.hanApp = rows.han.app; w.hanDis = rows.han.dis; w.han = rows.han.app - rows.han.dis; }
  }
  return w;
}

// ------------------------------------------------------------------ guard
function guardNewWave(w, published) {
  const errs = [];
  const need = (k, what) => { if (w[k] == null) errs.push(`missing ${what} (${k})`); };
  need("date", "fieldwork end"); need("dateStart", "fieldwork start");
  need("sample", "sample size"); need("undecided", "undecided share");
  if (errs.length) return errs;
  const span = daysBetween(w.dateStart, w.date);
  if (!(span >= 1 && span <= 21)) errs.push(`implausible fieldwork span ${span}d`);
  if (w.date > new Date().toISOString().slice(0, 10)) errs.push(`future date ${w.date}`);
  if (!(w.sample >= 500 && w.sample <= 4000)) errs.push(`implausible sample ${w.sample}`);
  if (!(w.undecided >= 1 && w.undecided <= 40)) errs.push(`implausible undecided ${w.undecided}`);
  const pri = [w.alp, w.lnp, w.grn, w.onp, w.ind];
  if (pri.some((v) => v == null || v < 1 || v > 70)) errs.push(`primary figure out of range: ${JSON.stringify(pri)}`);
  else {
    const s = pri.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 100) > 2) errs.push(`primary votes sum ${s}`);
  }
  if (w.tpp_alp == null || w.tpp_lnp == null || Math.abs(w.tpp_alp + w.tpp_lnp - 100) > 1) errs.push(`tpp pair doesn't sum to 100: ${w.tpp_alp}/${w.tpp_lnp}`);
  if (w.alpVsOnp_alp == null || w.alpVsOnp_alp < 40 || w.alpVsOnp_alp > 70) errs.push(`missing/implausible alt tpp (labor vs one nation): ${w.alpVsOnp_alp}`);
  if (w.hasPpm && (w.ppmAlb == null || w.ppmOpp == null || !w.oppName)) errs.push("PPM page present but ppm shares/oppName not parsed");
  const nets = [w.alb, w.opp, w.han];
  if (nets.some((v) => v == null || Math.abs(v) > 80)) errs.push(`approval nets implausible: ${JSON.stringify(nets)}`);
  if (!w.oppName) errs.push("oppName unresolved (ppm text and canon inheritance both missing)");
  if (published) {
    const lag = daysBetween(w.date, published.slice(0, 10));
    if (lag < 0 || lag > 31) errs.push(`release lag ${lag}d from fieldwork end`);
  }
  return errs;
}

// ------------------------------------------------------- canon verification
// No whitelisted divergences yet — matched canonical waves (Apr + Jul 2026)
// parse exactly. Hand-entered `published` timestamps vs RSS-derived stay
// notes: polls.published is deliberately checked as note-only.
const KNOWN_DIVERGENCE = {};

function figureDiffs(date, w, D) {
  const diffs = [];
  const known = KNOWN_DIVERGENCE[date] ?? new Set();
  const chk = (key, canon, got, noteOnly = false) => {
    if (got == null) { diffs.push({ key, canon, got, parse: "absent" }); return; }
    if (String(canon) !== String(got)) diffs.push({ key, canon, got, known: known.has(key) || noteOnly });
  };
  const poll = D.polls.find((p) => p.pollster === POLLSTER && p.date === date);
  if (poll) {
    chk("polls.dateStart", poll.dateStart, w.dateStart);
    chk("polls.sample", poll.sample, w.sample);
    if (poll.published != null) chk("polls.published", poll.published, w.published, true);
    if (poll.undecided != null) chk("polls.undecided", poll.undecided, w.undecided, true);
    for (const k of ["alp", "lnp", "grn", "onp", "ind"]) chk(`polls.${k}`, poll[k], w[k]);
    chk("polls.tpp_alp", poll.tpp_alp, w.tpp_alp);
    chk("polls.tpp_lnp", poll.tpp_lnp, w.tpp_lnp);
  }
  const ppm = D.ppm.find((p) => p.firm === POLLSTER && p.date === date);
  if (ppm) {
    chk("ppm.alb", ppm.alb, w.ppmAlb);
    chk("ppm.opp", ppm.opp, w.ppmOpp);
    chk("ppm.oppName", ppm.oppName, w.oppName);
  }
  const h2h = D.ppmHeadToHead.find((p) => p.firm === POLLSTER && p.date === date);
  if (h2h) { chk("ppmHeadToHead.alb", h2h.alb, w.h2hAlb); chk("ppmHeadToHead.han", h2h.han, w.h2hHan); }
  const ap = D.approval.find((p) => p.firm === POLLSTER && p.date === date);
  if (ap) {
    chk("approval.alb", ap.alb, w.alb);
    chk("approval.opp", ap.opp, w.opp);
    if (ap.oppName != null) chk("approval.oppName", ap.oppName, w.oppName);
    if (ap.han != null) chk("approval.han", ap.han, w.han);
    const d = ap.detail ?? {};
    for (const [who, vals] of [["alb", "alb"], ["opp", "opp"], ["han", "han"]]) {
      if (d[who]?.app != null) chk(`approval.detail.${who}.app`, d[who].app, w[`${vals}App`]);
      if (d[who]?.dis != null) chk(`approval.detail.${who}.dis`, d[who].dis, w[`${vals}Dis`]);
    }
  }
  const alt = D.altTpp.find((p) => p.firm === POLLSTER && p.date === date);
  if (alt) chk("altTpp.alpVsOnp_alp", alt.alpVsOnp_alp, w.alpVsOnp_alp);
  return diffs;
}

// ------------------------------------------------------------------ rows
function pollRows(w, item) {
  const rows = { polls: null, ppm: null, ppmHeadToHead: null, approval: null, altTpp: null };
  rows.polls = {
    date: w.date,
    published: w.published,
    dateStart: w.dateStart,
    pollster: POLLSTER,
    client: "—",
    sample: w.sample,
    ...(w.undecided != null ? { undecided: w.undecided } : {}),
    alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: null,
    tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp,
    url: item.link,
  };
  if (!rows.polls.published) delete rows.polls.published;
  if (w.ppmAlb != null) rows.ppm = { date: w.date, firm: POLLSTER, alb: w.ppmAlb, opp: w.ppmOpp,
    oppName: w.oppName, han: null, extra: null };
  if (w.h2hAlb != null) rows.ppmHeadToHead = { date: w.date, firm: POLLSTER, alb: w.h2hAlb, han: w.h2hHan };
  rows.approval = { date: w.date, firm: POLLSTER, alb: w.alb, opp: w.opp,
    oppName: w.oppName, han: w.han ?? null, detail: null };
  if (w.albApp != null && w.albDis != null) {
    rows.approval.detail = { alb: { app: w.albApp, dis: w.albDis } };
    if (w.oppApp != null) rows.approval.detail.opp = { app: w.oppApp, dis: w.oppDis };
    if (w.hanApp != null) rows.approval.detail.han = { app: w.hanApp, dis: w.hanDis };
  }
  rows.altTpp = { date: w.date, firm: POLLSTER, alpVsOnp_alp: w.alpVsOnp_alp, lnpVsOnp_lnp: null };
  return rows;
}

// -------------------------------------------------------------------- main
const status = { changed: false, check: CHECK, added: [], verified: [], mismatches: [],
  notes: [], skipped_items: [], item_errors: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const existing = D.polls.filter((p) => p.pollster === POLLSTER);

  let items;
  if (ONE_URL) items = [{ title: "(oracle)", pubDate: null, link: ONE_URL, desc: null }];
  else {
    const { buf } = await fetchBuffer(RSS_URL);
    const all = rssItems(buf.toString("utf8"));
    items = all.filter((i) => i.link && /Federal Pol(?:ling|itical) Update/i.test(i.title ?? ""));
    if (!items.length && all.length >= 4) throw new Error("no federal-update items in RSS (site restructure?)");
    status.skipped_items = all.filter((i) => !items.includes(i)).map((i) => i.title);
  }
  status.candidates = items.map((i) => i.title);

  const guardFails = [];
  const newRows = { polls: [], ppm: [], ppmHeadToHead: [], approval: [], altTpp: [] };
  for (const item of items) {
    const slug = item.link.split("/").filter(Boolean).pop();
    try {
      let pdfUrl = pdfFromDesc(item.desc) ?? null;
      if (!pdfUrl && item.title !== "(oracle)") pdfUrl = await pdfFromArticle(item.link);
      if (!pdfUrl && ONE_URL) pdfUrl = await pdfFromArticle(item.link);
      if (!pdfUrl) {
        // legacy image-only wave (Jul-2025, Nov-2025 pattern): can't
        // re-derive canon — note it unless the title month looks NEW
        const tm = (item.title ?? "").match(/([A-Za-z]+)\s+(\d{4})\s*$/);
        const titleDate = tm ? iso(+tm[2], MONTHS[tm[1].toLowerCase()] ?? 0, 1) : null;
        const knownLegacy = titleDate && existing.some((e) => e.date.slice(0, 7) === titleDate.slice(0, 7));
        if (knownLegacy) { status.notes.push(`${slug}: image-only wave, canon kept as hand-entered`); continue; }
        throw new Error("no report pdf on article page or in RSS description");
      }

      mkdirSync(SRC_DIR, { recursive: true });
      const txtPath = join(SRC_DIR, `${slug}-report.txt`);
      const linkPath = join(SRC_DIR, `${slug}.json`);
      const prev = !FORCE && existsSync(linkPath) ? JSON.parse(readFileSync(linkPath, "utf8")) : null;
      let reportTxt;
      if (prev?.pdf === pdfUrl && existsSync(txtPath)) reportTxt = readFileSync(txtPath, "utf8");
      else {
        const buf = await fetchPdf(pdfUrl);
        reportTxt = pdfToText(buf, `${slug}-report`);
        writeFileSync(txtPath, reportTxt);
      }
      writeFileSync(linkPath, JSON.stringify({ pdf: pdfUrl, cachedAt: new Date().toISOString() }) + "\n");

      const w = parseReport(reportTxt, slug, D);
      w.url = item.link;
      w.published = item.pubDate ? rssToLocal(item.pubDate) : null;
      if (ONE_URL) console.log(JSON.stringify(pollRows(w, item), null, 2));

      const matched = existing.find((e) => w.date && Math.abs(daysBetween(e.date, w.date)) <= 3);
      status.verified.push({ slug, date: w.date, matched: !!matched });
      if (matched) {
        for (const d of figureDiffs(matched.date, w, D)) {
          if (d.known || d.parse === "absent") status.notes.push(`${matched.date} ${d.key}: canon ${d.canon} vs parse ${d.got}`);
          else status.mismatches.push({ date: matched.date, slug, ...d });
        }
        if (w.undecided != null && existing.find((e) => e.date === matched.date)?.undecided == null)
          status.notes.push(`${matched.date}: undecided ${w.undecided}% parsed (canon row predates the field)`);
        continue;
      }
      if (w.date && w.date < CYCLE_START) continue;

      const errs = guardNewWave(w, w.published);
      if (errs.length) { guardFails.push(...errs.map((e) => `${slug}: ${e}`)); continue; }
      if (existing.some((e) => Math.abs(daysBetween(e.date, w.date)) <= 7) ||
          newRows.polls.some((r) => Math.abs(daysBetween(r.date, w.date)) <= 7)) {
        guardFails.push(`${slug}: duplicate/retro wave ${w.date}`); continue;
      }
      const rows = pollRows(w, item);
      for (const sec of Object.keys(newRows)) if (rows[sec]) newRows[sec].push(rows[sec]);
      status.added.push({ date: w.date, slug, alp: w.alp, onp: w.onp, tpp: w.tpp_alp, sample: w.sample });
    } catch (err) {
      status.item_errors.push({ item: item.title, error: String(err?.message || err) });
    }
  }

  if (status.item_errors.length && !ONE_URL) {
    console.error("SPECTRE_ERROR " + status.item_errors.map((e) => `${e.item}: ${e.error}`).join(" | "));
    status.guard = guardFails;
    console.log("SPECTRE_STATUS " + JSON.stringify(status));
    process.exit(1);
  }
  if (guardFails.length) {
    console.error("SPECTRE_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("SPECTRE_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newRows.polls.length) {
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    for (const sec of Object.keys(newRows)) D[sec] = [...D[sec], ...newRows[sec]].sort(byDate);
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    status.changed = JSON.stringify(D, null, 2) + trailingNl !== orig;
    if (status.changed && !CHECK && !ONE_URL) {
      writeFileSync(OUT + ".tmp", JSON.stringify(D, null, 2) + trailingNl);
      renameSync(OUT + ".tmp", OUT);
      console.log(`wrote ${OUT}: +${newRows.polls.length} Spectre Strategy wave(s)`);
    }
  }
  if (ONE_URL && newRows.polls.length) console.log(JSON.stringify(newRows.polls[0], null, 2));
  console.log("SPECTRE_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("SPECTRE_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("SPECTRE_STATUS " + JSON.stringify(status));
  process.exit(1);
}
