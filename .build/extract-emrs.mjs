#!/usr/bin/env node
/* extract-emrs.mjs – reads EMRS's Tasmanian "Federal Voting Intentions
   Report" releases into data/polls.json's `polls` array as the no-aggregate
   EMRS (Tas) rows (the suffix house: the whole poll IS Tasmania, so the
   row's figures sit outside the national aggregates and join the
   ACT/NT/Tas solo readings).

   EMRS (Enterprise Marketing and Research Services) polls Tasmanians
   quarterly and carries a federal voting-intention battery in some waves.
   The reports sit on https://www.emrs.com.au/latest-news-and-results, a
   plain page of PDF links whose anchor titles name the report: "EMRS State
   and Federal Voting Intentions Report - August 2026", "EMRS - Federal
   Voting Intentions Report - February 2026". Discovery is that anchor
   list filtered to federal voting-intention REPORTS – the state-only
   "State Voting Intentions Report" releases (May 2026, …) never carry the
   federal battery and are skipped by the title filter, as are media
   releases of the same reports. The wave month comes from the title
   ("- August 2026"); EMRS_FIRST = the first wave to carry federal
   figures (2026-02).

   Each report reads from its `pdftotext -layout` text:
     - the METHODOLOGY bullet's "… was conducted from 16-19 February 2026"
       / "from the 17th to the 18th of August 2026" gives the fieldwork
       span. Candidates are filtered to the title's MONTH and YEAR: the
       August 2026 report's executive summary carries a KNOWN TYPO
       ("conducted from the 17th to the 18th of August 2025") that the
       methodology bullet gets right – the year filter is what kills it.
       Two same-month candidates that disagree are a problem, never a coin
       flip.
     - the "Federal election vote preference" chart. The overall wave page
       is the page whose Base line is "All respondents who gave a vote
       preference (n=###)" – in the 2026-02 report five per-electorate cuts
       ("…in Bass", "…in Braddon", …) follow it, and their pages' bases
       name the seat, so they never qualify. The label line itself carries
       the figure ("The Liberal Party        17%") – prose mentions never
       match the anchored shape. "The National Party" (1% in 2026-02) is
       FOLDED into lnp, matching the hand-entered canon rows (the national
       L/NP is the site's lnp); without a National line lnp is the Liberal
       share alone. sample is the vote-preference base n (the gave-a-
       preference subset of the ~1,000 polled) – the canon rows' convention.
     - the "Two Party Preferred [Order] – Labor v|and Liberal" section's
       "Labor Ahead NN%" / "Liberal Ahead NN%" pair (the heading's wording
       changed between the Feb and Aug 2026 reports – both forms match).
       The Labor-v-One-Nation pair (printed in both reports) is NOT filed:
       no row field carries it. The three-way PM-preference chart and the
       state voting-intention tables are not read either.

   Rows are written as
     { date = fieldwork END, published = first-seen date, dateStart,
       pollster: "EMRS (Tas)", client: "—", sample, alp, lnp, grn, onp,
       ind, oth, tpp_alp, tpp_lnp, url = the report PDF }
   and polls[] re-sorted by date, like every house's writer. `published`
   is the day the extractor FIRST saw the wave (EMRS's page carries no
   usable per-item date): the two hand-entered canon rows keep their own
   dates, and a first-seen-vs-canon difference is a status note, never a
   rewrite.

   Canon verification is SPECTRE-style: an on-file wave of the same
   pollster within HEAL_DAYS is re-parsed every run and its figures must
   match exactly – a moved figure is a mismatch (status.mismatches,
   EMRS_GUARD, exit 2), never an automatic rewrite. KNOWN_DIVERGENCE stays
   empty: a house re-issue with corrected figures is adjudicated by a
   human entry there, in the file, with evidence.

   Cache: .build/emrs-src/<ym>.txt (the pdftotext -layout of the report)
   and <ym>.json ({ url, title, fetched, firstSeen, date, dateStart,
   sample, primaries, tpp }), written once per wave and re-derived only
   with --force. A quiet run fetches only the news page. A page or PDF
   that won't load, or a cached report that won't parse, is listed in
   status.pending and only then fails the run (the updater pushes whatever
   landed first, like secnewgate's). No federal reports at all on the page
   is a warning – the page has listed at least the two 2026 waves since
   this agent shipped.

   QUIET_DAYS is 210, not the PDF methodology's "each quarter": the only
   two federal waves on file ran six months apart (Feb→Aug 2026). The
   weekly crosstabs run reads `stale` as the house-gone-quiet alarm.

   Usage: node .build/extract-emrs.mjs [--force]  (--force refetches the
   cached reports)
   EMRS_SRC_DIR redirects the cache, EMRS_POLLS the polls.json.
   --probe fetches the news page and names the work a real run would do,
   writing nothing: poll-agent.yml's quiet-run gate (PROBE
   {"new":[],"warnings":[]}). Needs no pdftotext and no npm package.
   Exit codes: 0 clean (warnings allowed); 1 a fetch/parse failure;
   2 a guard trip (a new wave's figures fail the checks, or canon moved).
   Last line: EMRS_STATUS {"changed":…,"added":[],"mismatches":[],
   "pending":[],"stale":[],"warnings":[],"notes":[]} */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { TRACKER_UA, MONTHS, writeAtomic } from "./extract-common.mjs";

const FORCE = process.argv.includes("--force");
const PROBE = process.argv.includes("--probe");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.EMRS_SRC_DIR || path.join(ROOT, ".build", "emrs-src");
const POLLS = process.env.EMRS_POLLS || path.join(ROOT, "data", "polls.json");
const NEWS = "https://www.emrs.com.au/latest-news-and-results";
const NEWS_ORIGIN = "https://www.emrs.com.au";
const EMRS_FIRST = "2026-02"; // the first wave to carry the federal battery
const QUIET_DAYS = 210;       // observed federal cadence is ~6-monthly (Feb→Aug 2026), not the methodology's "quarterly"
const HEAL_DAYS = 8;          // a wave re-dated within this window is the same wave
const POLLSTER = "EMRS (Tas)";
const DAY = 86400000;

const todaySydney = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

async function get(url) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": TRACKER_UA },
                                     signal: AbortSignal.timeout(60_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`${url}: ${last.message}`);
}

const pdfToText = (buf, slug) => {
  const f = path.join(tmpdir(), `emrs-${slug}.pdf`);
  fs.writeFileSync(f, buf);
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    try { return execFileSync(bin, ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
    catch (e) { if (e.code !== "ENOENT") throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 200)}`); }
  }
  throw new Error("pdftotext (poppler) not found");
};

// ---------------------------------------------------------------- discovery
/* The wave a report covers, from its anchor title's trailing month:
   "EMRS State and Federal Voting Intentions Report - August 2026" →
   "2026-08". The title may drop the dash ("… Report February 2026") and
   wrap entities. "YYYY-MM" or null. */
export function titleYmOf(title) {
  const t = String(title).replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/gi, "&");
  const m = t.match(/([A-Za-z]+)\s+(\d{4})\D*$/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  return mo == null ? null : `${m[2]}-${String(mo + 1).padStart(2, "0")}`;
}

/* The news page's federal voting-intention report candidates, one per wave
   month: anchors whose text names a FEDERAL "voting intentions" report
   (state-only releases and media releases never match), PDF hrefs made
   absolute, EMRS_FIRST on. A month with two links keeps the FIRST in page
   order with the variant noted for the caller (a re-hosted "-FINAL" twin
   has only ever replaced the same URL). */
export function listFederalReports(html) {
  const byYm = new Map();
  for (const m of String(html).matchAll(/<a\b[^>]*href="([^"]+?\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (x, n) => String.fromCharCode(+n)).replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ").trim();
    if (!/federal/i.test(text) || !/voting intentions/i.test(text) || !/report/i.test(text)) continue;
    const ym = titleYmOf(text);
    if (!ym || ym < EMRS_FIRST) continue;
    const url = m[1].startsWith("http") ? m[1] : NEWS_ORIGIN + m[1];
    const g = byYm.get(ym) || [];
    g.push({ url, title: text });
    byYm.set(ym, g);
  }
  return [...byYm.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ym, variants]) => ({ ym, url: variants[0].url, title: variants[0].title, variants: variants.length }));
}

// ------------------------------------------------------------------ parsing
/* The fieldwork span from a report's "… was conducted from …" lines.
   Every line in the report naming a conducted span is a candidate; the
   winner is the candidate whose END sits in the title's month AND year
   (the Aug-2026 executive summary's "August 2025" typo dies there). Two
   surviving candidates must agree – the exec summary and the methodology
   bullet of a healthy report name the same span. */
export function fieldworkOf(text, ym) {
  const [y, mo] = ym.split("-").map(Number);
  const iso = (yy, mm, d) => `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cands = [];
  for (const raw of String(text).split("\n")) {
    if (!/conducted from/i.test(raw)) continue;
    let m = raw.match(/conducted from\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|[-–])\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)\s+(\d{4})/i);
    if (m) {
      const mm = MONTHS[m[3].toLowerCase()];
      if (mm != null) cands.push({ dateStart: iso(m[4], mm + 1, +m[1]), date: iso(m[4], mm + 1, +m[2]), where: raw.trim().slice(0, 90) });
      continue;
    }
    // "from the 27th of August to the 2nd of September 2026" (month straddle, never yet seen)
    m = raw.match(/conducted from\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([A-Za-z]+)\s+(?:to|[-–])\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([A-Za-z]+)\s+(\d{4})/i);
    if (m) {
      const sm = MONTHS[m[2].toLowerCase()], em = MONTHS[m[4].toLowerCase()];
      if (sm != null && em != null) {
        const sy = sm > em ? +m[5] - 1 : +m[5];
        cands.push({ dateStart: iso(sy, sm + 1, +m[1]), date: iso(m[5], em + 1, +m[3]), where: raw.trim().slice(0, 90) });
      }
    }
  }
  const endMonth = `${y}-${String(mo).padStart(2, "0")}`;
  const matching = cands.filter((c) => c.date.startsWith(endMonth));
  const problems = [];
  if (!matching.length)
    return { date: null, dateStart: null,
             problems: [`no fieldwork span ending in the title month ${endMonth} (candidates: ${cands.map((c) => c.date + " «" + c.where + "»").join("; ") || "none"})`] };
  const key = (c) => c.dateStart + "→" + c.date;
  if (new Set(matching.map(key)).size > 1)
    problems.push(`the report's fieldwork lines disagree: ${matching.map((c) => key(c)).join(" vs ")}`);
  return { date: matching[0].date, dateStart: matching[0].dateStart, problems };
}

/* The overall federal vote-preference page in a report's layout text.
   The wave page's Base line names no seat; the per-electorate cuts' do
   ("All respondents in Bass (n=182)"). 1-based page number returned for
   diagnostics. */
export function federalPageOf(text) {
  const pages = String(text).split("\f");
  const i = pages.findIndex((pg) =>
    /If a federal election were being held today/.test(pg)
    && /Base:\s*All respondents who gave a vote preference\s*\(n\s*=\s*([\d,]+)\)/.test(pg));
  if (i < 0) return { page: null, pageNo: 0, sample: null, problems: ["no federal vote-preference page with a gave-a-preference base"] };
  const n = pages[i].match(/Base:\s*All respondents who gave a vote preference\s*\(n\s*=\s*([\d,]+)\)/);
  return { page: pages[i], pageNo: i + 1, sample: +n[1].replace(/,/g, ""), problems: [] };
}

/* The chart label → figure lines. -layout glues same-baseline text into
   one physical line, so a label can TRAIL wrapped prose
   ("…for One Nation.                The Labor Party              30%"):
   the anchor is ^ or a 2+ space run. The figure then sits after its own
   space run with only trailing whitespace to EOL – prose mentions never
   match ("(17%)", "23 per cent", "the Liberals"). */
const LABELS = [
  ["lib", /(?:^| {2,})The Liberal Party +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["nat", /(?:^| {2,})The National Party +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["alp", /(?:^| {2,})The Labor Party +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["grn", /(?:^| {2,})The Greens +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["onp", /(?:^| {2,})Pauline Hanson[’']s One Nation +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["ind", /(?:^| {2,})An Independent +(\d{1,2}(?:\.\d)?)%\s*$/m],
  ["oth", /(?:^| {2,})Some other minor party +(\d{1,2}(?:\.\d)?)%\s*$/m],
];

/* The overall federal primaries from a wave page. The National Party line
   folds into the Liberal one (the hand-entered canon rows' convention –
   the site's lnp is the national L/NP), so lnp = lib + nat. */
export function primariesOf(page) {
  const got = {}, problems = [];
  for (const [key, re] of LABELS) {
    const m = String(page).match(re);
    if (!m) { if (key !== "nat") problems.push(`no "${key}" label line on the federal page`); continue; }
    got[key] = +m[1];
  }
  if (problems.length) return { alp: null, lnp: null, grn: null, onp: null, ind: null, oth: null, problems };
  return { alp: got.alp, lnp: +(got.lib + (got.nat || 0)).toFixed(1).replace(/\.0$/, ""),
           grn: got.grn, onp: got.onp, ind: got.ind, oth: got.oth,
           problems, natFolded: got.nat ?? null };
}

/* The Labor-v-Liberal 2PP pair. The section heading was "Two Party
   Preferred – Labor v Liberal" in Feb 2026 and "Two Party Preferred
   Order – Labor and Liberal" in Aug 2026; the Labor-v-One-Nation section
   never matches (its rival token differs), and its "Labor Ahead" figure
   stays OUT of the returned pair: the slice ends at the next Two-Party
   heading. */
export function tppOf(text) {
  const t = String(text);
  const h = t.match(/Two Party Preferred(?:\s+Order)?\s*[–-]\s*Labor\s+(?:v|and)\s+Liberal/i);
  if (!h) return { alp: null, lnp: null, problems: ["no 'Two Party Preferred … Labor v|and Liberal' section"] };
  const rest = t.slice(h.index);
  const next = rest.slice(h[0].length).search(/Two Party Preferred/i);
  const slice = next < 0 ? rest : rest.slice(0, h[0].length + next);
  const a = slice.match(/\bLabor Ahead\s+(\d{1,2})%/);
  const l = slice.match(/\bLiberal Ahead\s+(\d{1,2})%/);
  if (!a || !l) return { alp: null, lnp: null, problems: ["the Labor v Liberal 2PP section's 'NN% Ahead' figures didn't parse"] };
  return { alp: +a[1], lnp: +l[1], problems: [] };
}

/* One report's wave record. problems is empty on a clean read; any content
   means the wave is pending – cached for evidence, never filed. */
export function parseWave(text, ym) {
  const problems = [];
  const fw = fieldworkOf(text, ym);
  problems.push(...fw.problems);
  const fp = federalPageOf(text);
  problems.push(...fp.problems);
  let pri = { alp: null, lnp: null, grn: null, onp: null, ind: null, oth: null, problems: ["skipped – no federal page"] };
  if (fp.page) { pri = primariesOf(fp.page); problems.push(...pri.problems); }
  const tpp = tppOf(text);
  problems.push(...tpp.problems);
  return { date: fw.date, dateStart: fw.dateStart, sample: fp.sample,
           alp: pri.alp, lnp: pri.lnp, grn: pri.grn, onp: pri.onp, ind: pri.ind, oth: pri.oth,
           tpp_alp: tpp.alp, tpp_lnp: tpp.lnp, pageNo: fp.pageNo, problems };
}

// -------------------------------------------------------------------- guard
function guardNewWave(w) {
  const errs = [];
  const need = (k, what) => { if (w[k] == null) errs.push(`missing ${what} (${k})`); };
  need("date", "fieldwork end"); need("dateStart", "fieldwork start");
  need("sample", "sample size");
  if (errs.length) return errs;
  const span = daysBetween(w.dateStart, w.date);
  if (!(span >= 1 && span <= 21)) errs.push(`implausible fieldwork span ${span}d`);
  if (w.date > todaySydney()) errs.push(`future date ${w.date}`);
  if (!(w.sample >= 400 && w.sample <= 1500)) errs.push(`implausible vote-preference base ${w.sample}`);
  const pri = [w.alp, w.lnp, w.grn, w.onp, w.ind, w.oth];
  if (pri.some((v) => v == null || v < 1 || v > 70)) errs.push(`primary figure out of range: ${JSON.stringify(pri)}`);
  else {
    const s = pri.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 100) > 2) errs.push(`primary votes sum ${s} (both canon waves print 99 and 101)`);
  }
  if (w.tpp_alp == null || w.tpp_lnp == null || Math.abs(w.tpp_alp + w.tpp_lnp - 100) > 1)
    errs.push(`tpp pair doesn't sum to 100: ${w.tpp_alp}/${w.tpp_lnp}`);
  else if (w.tpp_alp < 30 || w.tpp_alp > 70) errs.push(`implausible tpp ${w.tpp_alp}`);
  return errs;
}

// -------------------------------------------------------- canon verification
// No whitelisted divergences — the Feb and Aug 2026 reports parse exactly
// to the hand-entered canon rows. `published` is checked as note-only:
// hand-entered dates never move, whatever a first-seen stamp says.
const KNOWN_DIVERGENCE = {};
const VERIFY_FIELDS = ["date", "dateStart", "sample", "alp", "lnp", "grn", "onp", "ind", "oth", "tpp_alp", "tpp_lnp"];

async function main() {
  const status = { changed: false, added: [], mismatches: [], pending: [], stale: [], warnings: [], notes: [] };
  const D = JSON.parse(fs.readFileSync(POLLS, "utf8"));
  const canon = D.polls.filter((p) => p.pollster === POLLSTER);

  let html;
  try {
    html = (await get(NEWS)).toString("utf8");
  } catch (e) {
    console.error("EMRS_ERROR " + e.message);
    status.warnings.push(e.message);
    console.log("EMRS_STATUS " + JSON.stringify(status));
    process.exit(1);
  }
  const cands = listFederalReports(html);
  if (!cands.length) status.warnings.push("no federal voting-intentions reports found on the news page – has the page changed?");

  if (PROBE) {
    const onFile = (ym) => canon.some((p) => p.date.startsWith(ym));
    const news = cands.filter((c) => !onFile(c.ym)).map((c) => c.ym);
    console.log("PROBE " + JSON.stringify({ new: news, warnings: status.warnings }));
    process.exit(0);
  }

  fs.mkdirSync(SRC, { recursive: true });
  const guardFails = [];
  const newRows = [];
  for (const cand of cands) {
    const ym = cand.ym;
    const txtPath = path.join(SRC, `${ym}.txt`);
    const jsonPath = path.join(SRC, `${ym}.json`);
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(jsonPath, "utf8")); } catch { /* first sighting */ }
    if (!meta.firstSeen) meta.firstSeen = todaySydney();
    let text = null;
    if (fs.existsSync(txtPath) && !FORCE) {
      text = fs.readFileSync(txtPath, "utf8");
    } else {
      try {
        const buf = await get(cand.url);
        if (buf.length < 10_000 || buf.slice(0, 5).toString("latin1") !== "%PDF-")
          throw new Error(`not a PDF (${buf.length} bytes)`);
        text = pdfToText(buf, ym);
        writeAtomic(txtPath, text);
        console.log(`cached report ${ym} (${text.length} chars of layout text)`);
      } catch (e) {
        status.pending.push(`${ym}: ${e.message}`);
        continue;
      }
    }
    const w = parseWave(text, ym);
    Object.assign(meta, {
      url: cand.url, title: cand.title, ym,
      fetched: meta.fetched || todaySydney(),
      date: w.date, dateStart: w.dateStart, sample: w.sample,
      primaries: { alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: w.oth },
      tpp: { alp: w.tpp_alp, lnp: w.tpp_lnp },
      published: meta.firstSeen,
    });
    const jsonOut = JSON.stringify(meta, null, 2) + "\n";
    try { if (fs.readFileSync(jsonPath, "utf8") !== jsonOut) writeAtomic(jsonPath, jsonOut); }
    catch { writeAtomic(jsonPath, jsonOut); }
    if (cand.variants > 1) status.notes.push(`${ym}: ${cand.variants} PDF links on the page, reading the first`);
    if (w.problems.length) { status.pending.push(`${ym}: ${w.problems[0]}`); continue; }

    const prior = canon.find((e) => Math.abs(daysBetween(e.date, w.date)) <= HEAL_DAYS);
    if (prior) {
      for (const k of VERIFY_FIELDS) {
        if (KNOWN_DIVERGENCE[`${ym}|${k}`]) continue;
        if (prior[k] !== w[k]) status.mismatches.push(`${ym} ${k}: canon ${prior[k]} vs parsed ${w[k]} – verify, never rewrite`);
      }
      if (prior.published !== meta.firstSeen)
        status.notes.push(`${ym}: canon's published ${prior.published} kept (first seen ${meta.firstSeen} – note only)`);
      continue;
    }
    const errs = guardNewWave(w);
    if (errs.length) { guardFails.push(`${ym}: ${errs.join("; ")}`); continue; }
    newRows.push({
      date: w.date, published: meta.firstSeen, dateStart: w.dateStart,
      pollster: POLLSTER, client: "—", sample: w.sample,
      alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: w.oth,
      tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp, url: cand.url,
    });
    status.added.push(`${ym} (fieldwork ${w.dateStart}…${w.date}, n=${w.sample})`);
  }

  // the house-gone-quiet alarm the weekly crosstabs run reads
  const latest = canon.map((p) => p.published || p.date).sort().pop();
  if (latest) {
    const quiet = daysBetween(latest.slice(0, 10), todaySydney());
    if (quiet > QUIET_DAYS) status.stale.push(`EMRS (Tas) quiet ${quiet}d since its last wave (>${QUIET_DAYS}d)`);
  }

  if (status.mismatches.length || guardFails.length)
    console.error("EMRS_GUARD " + [...status.mismatches, ...guardFails].join(" | "));
  else if (newRows.length) {
    const orig = fs.readFileSync(POLLS, "utf8");
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    D.polls = [...D.polls, ...newRows].sort(byDate);
    const out = JSON.stringify(D, null, 2) + (orig.endsWith("\n") ? "\n" : "");
    status.changed = out !== orig;
    if (status.changed) {
      writeAtomic(POLLS, out);
      console.log(`wrote ${POLLS}: +${newRows.length} EMRS (Tas) wave(s)`);
    }
  }
  status.guard = status.mismatches.length || guardFails.length ? true : undefined;
  console.log("EMRS_STATUS " + JSON.stringify(status));
  process.exit(status.mismatches.length || guardFails.length ? 2 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  main().catch((err) => {
    console.error("EMRS_ERROR " + (err?.message || err));
    console.log("EMRS_STATUS " + JSON.stringify({ changed: false, added: [], mismatches: [], pending: [], stale: [], warnings: [String(err?.message || err)], notes: [] }));
    process.exit(1);
  });
