// Extract the latest YouGov "Public Data" fortnightly federal poll (the
// series News24 Pulse reports) and append rows to data/polls.json: voting
// intention into `polls`, preferred-PM into `ppm`, leader nets into
// `approval`.
//
// Canonical source = YouGov's own editorial releases on yougov.com (the
// user chose these over MSN-mirrored news24.com.au copies, which are
// bot-walled and robots-prohibited; primaries/TPP were verified identical
// between the two). Discovery is the global YouGov RSS feed
// (yougov.com/en/rss — regional feeds 404; the global feed's ~200 items
// include every AU federal poll article). Candidate titles are pre-screened,
// then each article is verified against the series' distinctive methodology
// sentence ("The YouGov Public Data poll surveyed N Australian voters online
// between …"), which excludes UK polls ("British voters") and state polls
// without needing title keywords.
//
// Figure sources, in order of robustness:
//   primaries/TPP – the article's embedded Datawrapper charts: public
//                   machine-readable TSV at datawrapper.dwcdn.net/{id}/{rev}/
//                   dataset.csv. The VI chart carries "Headline voting
//                   intention" rows and BOTH "Two-party preferred vote vs
//                   Coalition" (kept) and "vs PHON" (ignored) rows. Tracker
//                   convention for this series: `ind` = the "Independents"
//                   row; `oth` = sum of all other headline rows (Community
//                   Strong Australia, Other) — verified against the hand
//                   -curated 2026-07-14 canon row (Ind 6 → ind 6; CSA 2 +
//                   Other 6 → oth 8).
//   satisfaction  – the leader-satisfaction Datawrapper chart (first data
//                   row is the latest wave; cells may carry <span> arrows)
//   ppm           – a "Column/Total" Datawrapper chart when the article has
//                   one (the March 2026 article did); otherwise the prose
//                   pair ("leading 44% to 35%"), which the July article
//                   needed. Prose values equal chart values where both exist.
//   dates/sample  – the Methodology paragraph ("surveyed 1,468 Australian
//                   voters online between 7 and 14 July 2026"); `published`
//                   from the article JSON embedded in the page's transfer
//                   state ("data":{"id":<num>,…"published_at":"isoZ"}),
//                   converted to AEST.
//
// Row shapes mirror the existing canon YouGov rows: polls
// {date,published,dateStart,pollster:"YouGov",client:"News24",sample,alp,
// lnp,grn,onp,ind,oth,tpp_alp,tpp_lnp,url}; ppm {date,firm,alb,opp,oppName,
// han:null,extra:null}; approval {date,firm,alb,opp,oppName,han:null,
// detail{alb:{app,dis},opp:{app,dis}}}.
//
// Fallback source: the Wikipedia poll-table wikitext, used only for waves
// with no yougov.com release — historically most of them (an Aug 2026 audit
// found releases for 2 of 18 waves since Dec 2025). The VI-table [[YouGov]]
// rows give fieldwork dates, sample, primaries and optional 2PP; the row's
// citation URL becomes the row's `url`. Fallback rows carry no `published`,
// ppm or approval data. At most 4 fallback waves per run; more trips the
// safety guard. A Wikipedia fetch failure degrades to RSS-only, not exit 1.
//
// Provenance: parsed figures per wave are saved to .build/news24-src/
// release-<dateIso>.json (yougov.com) or wiki-<dateIso>.json (fallback) and
// committed alongside.
//
// Usage: node .build/extract-news24.mjs [--check] [--url <article-url>]
//   --url parses one YouGov article and prints the record without touching
//   polls.json – development/regression hook (oracle: article 55192,
//   fieldwork end 2026-07-14, expects sample 1468, 28/20/12/26/6/8, TPP
//   53/47, nets -18/-16, ppm 44/35).
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `N24_STATUS {json}` with changed, added, skipped_existing — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped —
//     upstream layout changed; nothing is written
//   - --check computes everything, prints N24_STATUS, never writes
//   - writes are atomic (.tmp + rename)
//   - test hooks: N24_OUT redirects the write target; N24_WIKI_FILE parses
//     local wikitext; N24_WIKI_DEBUG prints parsed fallback waves
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const URL_OF = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--url"));
const OUT = process.env.N24_OUT || "data/polls.json"; // N24_OUT: test hook only
const SRC_DIR = ".build/news24-src";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;
const RSS = "https://yougov.com/en/rss";
const DAY = 86400000;

// Newspoll releases and this series publish ~05:00 AEST; canon `published`
// strings are local-without-offset, so AEST (UTC+10 fixed) is applied here.
const AEST_MS = 10 * 3600_000;

// Fallback wave source: the Wikipedia poll table's wikitext. Used only for
// waves with no yougov.com release — historically the norm (an Aug 2026
// audit found releases for 2 of 18 waves since Dec 2025). Env overrides are
// test hooks: N24_WIKI_FILE parses a local snapshot, N24_WIKI_DEBUG prints
// parsed waves to stderr.
const WIKI_TITLE = "Opinion_polling_for_the_next_Australian_federal_election";
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=${WIKI_TITLE}&action=raw`;
const WIKI_FILE = process.env.N24_WIKI_FILE ?? null;
const WIKI_DEBUG = !!process.env.N24_WIKI_DEBUG;
const MAX_WIKI_ADDS = 4; // fortnightly series: >4 new fallback waves in one run = upstream layout shift

// Candidate-title pre-screen (cheap; the methodology sentence is the gate).
const TITLE_HIT = /yougov public data poll|primary vote|albanese|coalition|one nation|\blabor\b/i;
const TITLE_MISS = /south australia|queensland|victoria\b|new south wales|western australia|tasmania|by-election|state election|britain|british|trump|canada|new zealand/i;

// Leadership era — identical to extract-newspoll.mjs; YouGov ppm/approval
// rows only exist in the Albanese era; the current OL surname keys the ppm
// and satisfaction chart columns.
const LEADERS = {
  pm: { name: "Albanese", oppName: null, from: "2022-05-23" },
  ols: [
    { surname: "dutton", oppName: "Dutton", from: "2022-05-30", to: "2025-05-12" },
    { surname: "ley", oppName: "Ley", from: "2025-05-13", to: "2026-02-08" },
    { surname: "taylor", oppName: "Taylor", from: "2026-02-09", to: null },
  ],
};
const olFor = (date) => LEADERS.ols.find((o) => date >= o.from && (!o.to || date <= o.to)) ?? null;

// ---------------------------------------------------------------- fetching
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
async function fetchOnce(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return { url: res.url, text: await res.text() };
}
async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try { return await fetchOnce(url); } catch (err) {
      lastErr = err;
      if (err.status === 403 || err.status === 429) break;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dateIso = (d) => iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const today = () => dateIso(new Date());

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&lsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}
// Datawrapper pages carry the cell HTML inside JSON strings; \\u003C is the
// escaped '<' that clean() can't see otherwise.
const unescapeJson = (s) => s.replace(/\\u003C/gi, "<").replace(/\\u003E/gi, ">").replace(/\\u0026/gi, "&");

// ------------------------------------------------- Datawrapper chart parse
// Fetch and classify each embedded chart's public dataset. Returns rows as
// arrays of trimmed cells. clean() is NOT applied here — its whitespace
// collapse (\s+ -> " ") would destroy the tab-separated structure before
// the \t split. The <span> arrows appear as literal HTML in the raw CSV.
async function chartRows(url) {
  const { text } = await fetchText(url);
  return unescapeJson(text)
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split("\t").map((c) => c.replace(/%/g, "").trim()));
}

// VI chart: rows are [scope, label, value] with a "Headline voting
// intention" scope and "Two-party preferred vote vs …" scopes.
function parseVi(rows) {
  const head = rows.filter((r) => r[0] === "Headline voting intention");
  const tppC = rows.filter((r) => r[0] === "Two-party preferred vote vs Coalition");
  if (!head.length || !tppC.length) return null;
  const get = (label) => head.find((r) => r[1] === label);
  const num = (r) => (r ? parseFloat(r[2]) : null);
  const known = ["Labor", "Coalition", "The Greens", "PHON", "Independents"];
  const others = head.filter((r) => !known.includes(r[1])).reduce((a, r) => a + (parseFloat(r[2]) || 0), 0);
  const tppA = tppC.find((r) => r[1] === "Labor");
  const tppB = tppC.find((r) => r[1] === "Coalition");
  return {
    alp: num(get("Labor")), lnp: num(get("Coalition")), grn: num(get("The Greens")),
    onp: num(get("PHON")), ind: num(get("Independents")),
    oth: others ? Math.round(others * 10) / 10 : null,
    tpp_alp: num(tppA), tpp_lnp: num(tppB),
  };
}

// Leader-satisfaction chart: header cells carry "<Surname> Satisfaction" and
// "<Surname> Dissatisfaction"; the first data row is the latest wave.
function parseSatisfaction(rows, olSurname) {
  const head = rows[0] ?? [];
  const col = (who, kind) => head.findIndex((c) => new RegExp(`^${who} ${kind}$`, "i").test(c));
  const prefix = whoPrefix(olSurname);
  const pmS = col("Albanese", "Satisfaction"), pmD = col("Albanese", "Dissatisfaction");
  const opS = col(prefix, "Satisfaction"), opD = col(prefix, "Dissatisfaction");
  if ([pmS, pmD, opS, opD].some((i) => i < 0)) return null;
  const row = rows.slice(1).find((r) => r.length > Math.max(pmS, pmD, opS, opD) && /\d/.test(r[pmS]));
  if (!row) return null;
  const v = (i) => parseFloat(row[i]);
  const app = (s, d) => ({ app: v(s), dis: v(d) });
  const pm = app(pmS, pmD), op = app(opS, opD);
  return {
    pmApp: pm.app, pmDis: pm.dis, oppApp: op.app, oppDis: op.dis,
    pmNet: Math.round((pm.app - pm.dis) * 10) / 10,
    oppNet: Math.round((op.app - op.dis) * 10) / 10,
  };
}
// Chart headers use the leader's given name sometimes ("Anthony Albanese")
// and surname elsewhere; the OL header matched so far starts with the
// surname's first name unknown — try the surname itself anywhere in the
// header cell.
function whoPrefix(olSurname) { return olSurname; }

// ppm chart (present in some articles): rows [label, total] with leader
// full names and a "Don't know" row.
function parsePpmChart(rows, olSurname) {
  if (!rows.length || rows[0].length < 2 || !/column/i.test(rows[0][0])) return null;
  const find = (who) => rows.find((r) => new RegExp(who, "i").test(r[0]));
  const a = find("Albanese"), o = find(olSurname[0].toUpperCase() + olSurname.slice(1));
  if (!a || !o) return null;
  return { ppmA: parseFloat(a[1]), ppmO: parseFloat(o[1]) };
}

// ------------------------------------------------------------- article parse
// One article URL -> a release record (or null if it's not the federal
// Public Data series). Fetches the page plus its Datawrapper datasets.
async function parseArticle(url, id) {
  const { text: html0 } = await fetchText(url);
  const html = unescapeJson(html0);
  const txt = clean(html);

  // Series gate: the methodology sentence is THE identifier of the federal
  // Public Data series — "surveyed NAustralian voters online between …".
  // ("eligible/enrolled" may precede "Australian voters"; some releases omit
  // the year from the fieldwork window — then it's inferred from the
  // article's published_at.)
  const meth = txt.match(/surveyed\s+[\d,]+\s+(?:eligible\s+|enrolled\s+)?Australian\s+voters\s+online\s+between\s+[^.]{0,60}/i);
  if (!meth) return null;
  const sm = meth[0].match(/surveyed\s+([\d,]+)/i);
  const sample = sm ? parseInt(sm[1].replace(/,/g, ""), 10) : null;
  const fm = meth[0].match(/between\s+(?:([A-Za-z]+)\.?\s+)?(\d{1,2})\s*(?:and|to|[-–])\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?/i);

  // published_at: the article's own JSON block inside the transfer state.
  // Needed up-front because yearless fieldwork windows are dated from it.
  let published = null, pubIso = null;
  const pi0 = html.indexOf(`"id":${id}`);
  if (pi0 >= 0) {
    const pm = html.slice(pi0, pi0 + 6000).match(/"published_at":"([^"]+)"/);
    if (pm) {
      const t = new Date(pm[1]);
      if (!isNaN(t)) {
        const a = new Date(t.getTime() + AEST_MS);
        published = `${dateIso(a)}T${String(a.getUTCHours()).padStart(2, "0")}:${String(a.getUTCMinutes()).padStart(2, "0")}`;
        pubIso = dateIso(a);
      }
    }
  }

  // Phrasing observed: "between 7 and 14 July 2026" (one trailing month) —
  // allow "between 29 December 2025 and 4 January 2026" and, like the March
  // 2026 release, "between 23 and 30 June" with no year at all.
  let dateStart = null, date = null;
  if (fm) {
    let y2 = fm[6] ? +fm[6] : (pubIso ? +pubIso.slice(0, 4) : new Date().getUTCFullYear());
    const m2 = MONTHS[fm[5].toLowerCase()], d2 = +fm[4];
    let mo1 = fm[3] ? MONTHS[fm[3].toLowerCase()]
      : fm[1] ? MONTHS[fm[1].toLowerCase()]
      : m2;
    if (m2 != null && mo1 != null) {
      // Yearless windows straddling Dec/Jan: the end month resolves to the
      // occurrence nearest the publication date (published a few days after
      // fieldwork end, 0–10d lag enforced downstream).
      if (!fm[6] && pubIso) {
        const cand = [y2 - 1, y2, y2 + 1].map((y) => iso(y, m2, d2))
          .sort((a, b) => Math.abs(new Date(a) - new Date(pubIso)) - Math.abs(new Date(b) - new Date(pubIso)));
        y2 = +cand[0].slice(0, 4);
      }
      date = iso(y2, m2, d2);
      let yr1 = y2;
      if (mo1 > m2) yr1 = y2 - 1;
      dateStart = iso(yr1, mo1, +fm[2]);
    }
  }
  if (!date) return null;

  // Datawrapper charts: VI + satisfaction (+optional ppm), rev pinned as embedded.
  const ids = [...new Set([...html.matchAll(/datawrapper\.dwcdn\.net\/([A-Za-z0-9]+)\/(\d+)/g)]
    .map((m) => `${m[1]}/${m[2]}`))];
  const era = olFor(date) ?? LEADERS.ols[LEADERS.ols.length - 1];
  let vi = null, sat = null, ppmChart = null;
  const charts = {};
  for (const cid of ids) {
    const rows = await chartRows(`https://datawrapper.dwcdn.net/${cid}/dataset.csv`);
    charts[cid] = rows;
    vi ??= parseVi(rows);
    sat ??= parseSatisfaction(rows, era.surname);
    ppmChart ??= parsePpmChart(rows, era.surname);
  }
  if (!vi) return null;

  // ppm prose fallback ("leading 44% to 35%" or "leading 44% versus 35%"
  // after the names). Only used when no ppm chart is embedded.
  let ppmA = ppmChart?.ppmA ?? null, ppmO = ppmChart?.ppmO ?? null;
  if (ppmA == null || ppmO == null) {
    const s = txt.match(/preferred Prime Minister[^.]{0,240}?(\d{1,2})\s*%\s*(?:to|versus|vs\.?|–|-)\s*(\d{1,2})\s*%/i);
    if (s) { ppmA = ppmA ?? +s[1]; ppmO = ppmO ?? +s[2]; }
  }

  return { url, id, date, dateStart, sample, published, vi, sat, ppmA, ppmO, charts };
}

// ---------------------------------------------------------------- guard
// requirePublished/requireTpp hold for yougov.com releases; Wikipedia
// fallback waves legitimately lack a publish timestamp and (pre-2026) a 2PP.
function guard(rec, { requirePublished = true, requireTpp = true, spanMin = 1 } = {}) {
  const errs = [];
  const check = (n, ok) => { if (!ok) errs.push(n); };
  const { vi, sat } = rec;
  const core = { date: rec.date, dateStart: rec.dateStart, sample: rec.sample };
  if (requirePublished) core.published = rec.published;
  for (const [k, v] of Object.entries(core))
    if (v == null) errs.push(`missing ${k}`);
  const viReq = ["alp", "lnp", "grn", "onp", "ind"];
  if (requireTpp) viReq.push("tpp_alp", "tpp_lnp");
  for (const k of viReq) if (vi[k] == null) errs.push(`missing ${k}`);
  if (vi.ind == null && vi.oth == null) errs.push("missing others bucket");
  for (const k of ["alp", "lnp", "grn", "onp", "ind", "oth"])
    if (vi[k] != null) check(`${k}=${vi[k]} in 1–70`, vi[k] >= 1 && vi[k] <= 70);
  const parts = [vi.alp, vi.lnp, vi.grn, vi.onp, vi.ind, vi.oth].filter((v) => v != null);
  if (parts.length >= 5) {
    const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10;
    check(`primaries Σ=${sum} ~100`, Math.abs(sum - 100) <= 1.5);
  }
  if (vi.tpp_alp != null && vi.tpp_lnp != null)
    check(`2pp Σ=${(vi.tpp_alp + vi.tpp_lnp).toFixed(1)} ~100`, Math.abs(vi.tpp_alp + vi.tpp_lnp - 100) <= 1);
  if (rec.ppmA != null) check(`ppmA=${rec.ppmA} in 15–80`, rec.ppmA >= 15 && rec.ppmA <= 80);
  if (rec.ppmO != null) check(`ppmO=${rec.ppmO} in 5–70`, rec.ppmO >= 5 && rec.ppmO <= 70);
  if (rec.ppmA != null && rec.ppmA === rec.ppmO) errs.push(`ppm tie ${rec.ppmA}/${rec.ppmO} — parse suspect`);
  if (sat) {
    for (const [k, v] of Object.entries({ pmNet: sat.pmNet, oppNet: sat.oppNet })) check(`${k}=${v} in −80..80`, v >= -80 && v <= 80);
  }
  check(`date ${rec.date} not future`, rec.date <= today());
  const span = (new Date(rec.date) - new Date(rec.dateStart)) / DAY;
  check(`field span ${span}d in ${spanMin}–14`, span >= spanMin && span <= 14);
  if (rec.published) {
    const lag = (new Date(rec.published.slice(0, 10)) - new Date(rec.date)) / DAY;
    check(`release lag ${lag}d in 0–10`, lag >= 0 && lag <= 10);
  }
  if (rec.date < LEADERS.pm.from) errs.push("pre-Albanese-era date");
  if (rec.sample != null) check(`sample=${rec.sample} in 1000–2500`, rec.sample >= 1000 && rec.sample <= 2500);
  return errs;
}

// ------------------------------------------------------ Wikipedia fallback
// Parse the federal VI table's wikitext into wave records as a stand-in for
// waves YouGov never releases on yougov.com. A poll's TPP-vs-Coalition triple
// sits at the end of its own chunk (rowspan=2 layouts) or trailing the
// primaries (single-row 2025-era layout); the continuation chunk (TPP vs
// PHON) and non-VI tables are ignored. Only [[YouGov]] rows count; MRP rows
// are excluded.
const wikiMonth = (s) => MONTHS[s.toLowerCase().replace(/\.$/, "")] ?? null;
function parseWikiDate(cell, fallbackYear) {
  const s = cell.replace(/\[\[|\]\]/g, "").trim();
  let m = s.match(/^(\d{1,2})\s*(?:([A-Za-z]{3,9})\.?)?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
  if (!m) {
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
    if (!m) return null;
    const mo = wikiMonth(m[2]), d = +m[1], y = m[3] ? +m[3] : fallbackYear;
    if (mo == null || y == null) return null;
    const dt = iso(y, mo, d);
    return { date: dt, dateStart: dt };
  }
  const m2 = wikiMonth(m[4]), m1 = m[2] ? wikiMonth(m[2]) : m2;
  const y2 = m[5] ? +m[5] : fallbackYear;
  if (m1 == null || m2 == null || y2 == null) return null;
  return { date: iso(y2, m2, +m[3]), dateStart: iso(m1 > m2 ? y2 - 1 : y2, m1, +m[1]) };
}

// Cell content = text after the final "|" (attributes precede it); refs and
// templates, which contain pipes, are stripped beforehand. Citation data
// (url, client) must be harvested from the raw chunk before this runs.
function wikiCells(chunk) {
  const t = chunk
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ");
  const cells = [];
  for (const l of t.split("\n")) {
    const c = l.match(/^([|!])(.*)$/);
    if (!c) continue;
    const pipe = c[2].lastIndexOf("|");
    cells.push({ hdr: c[1] === "!", content: (pipe >= 0 ? c[2].slice(pipe + 1) : c[2]).trim() });
  }
  return cells;
}

const near100 = (sum) => Math.abs(sum - 100) <= 2.5;
const WIKI_PCT = /^'{0,3}(\d{1,2}(?:\.\d{1,2})?)%'{0,3}$/;

// The Coalition shares one colspan=3 cell in this series (form A); tolerate
// pollsters' lib/lnp/nat triple (form B) in case the table layout shifts.
function wikiPrims(tokens) {
  if (tokens.length >= 6) {
    const p = tokens.slice(0, 6);
    if (p.every((v) => v != null) && near100(p.reduce((a, b) => a + b, 0)))
      return { alp: p[0], lnp: p[1], grn: p[2], onp: p[3], ind: p[4], oth: p[5], used: 6 };
  }
  if (tokens.length >= 8) {
    const coal = tokens.slice(1, 4).filter((v) => v != null);
    const rest = tokens.slice(4, 8);
    if (tokens[0] != null && coal.length && rest.every((v) => v != null)) {
      const lnp = Math.round(coal.reduce((a, b) => a + b, 0) * 10) / 10;
      if (near100(tokens[0] + lnp + rest.reduce((a, b) => a + b, 0)))
        return { alp: tokens[0], lnp, grn: rest[0], onp: rest[1], ind: rest[2], oth: rest[3], used: 8 };
    }
  }
  return null;
}

function waveFromCells(cells) {
  const si = cells.findIndex((c) => !c.hdr && /^\d[\d,]{2,}$/.test(c.content));
  if (si < 0) return { fail: "no sample cell" };
  const sample = +cells[si].content.replace(/,/g, "");
  const tokens = [];
  for (const c of cells.slice(si + 1)) {
    const m = c.content.match(WIKI_PCT);
    if (m) tokens.push(parseFloat(m[1]));
    else if (c.content === "") tokens.push(null); // voids where templates sat
    else return { fail: `unexpected cell "${c.content.slice(0, 40)}"` };
    if (tokens.length >= 11) break;
  }
  const prims = wikiPrims(tokens);
  if (!prims) return { fail: `primaries don't sum ~100 [${tokens.join(",")}]` };
  const [ta, tb] = tokens.slice(prims.used, prims.used + 2);
  const tpp = ta != null && tb != null && Math.abs(ta + tb - 100) <= 2
    ? { tpp_alp: ta, tpp_lnp: tb }
    : { tpp_alp: null, tpp_lnp: null };
  const { used, ...vi } = prims;
  return { sample, vi: { ...vi, ...tpp } };
}

function parseWikiYouGov(text) {
  const out = [], unparsed = [];
  let year = null, inVi = false;
  for (const chunk of text.split(/^\|-[^\n]*$/m)) {
    for (const h of chunk.matchAll(/^={2,4}\s*([^=]+?)\s*={2,4}\s*$/gm)) {
      const y = h[1].match(/\b(20\d\d)\b/);
      if (y) year = +y[1];
    }
    if (/\{\|/.test(chunk)) inVi = /Primary vote/i.test(chunk) && /2PP|Two-party.preferred/i.test(chunk);
    else if (/\|\}/.test(chunk)) inVi = false;
    if (!inVi || !/\[\[YouGov\]\]/.test(chunk) || /\bMRP\b/.test(chunk)) continue;
    const um = chunk.match(/\|\s*url\s*=\s*(https?:\/\/[^\s|}\]]+)/);
    const bm = chunk.match(/\[(https?:\/\/[^\s\]]+)\s/);
    let url = um?.[1] ?? bm?.[1] ?? null;
    if (url && /wikipedia\.org/.test(url)) url = null;
    const cm = chunk.match(/\[\S+\s+''([^'']{3,40})''\]/);
    const clientTxt = `${cm?.[1] ?? ""} ${um?.[1] ?? ""}`;
    const client = /australia[ -]?institute/i.test(clientTxt) ? "Australia Inst." : "News24";
    const cells = wikiCells(chunk);
    const dd = cells.find((c) => c.hdr && parseWikiDate(c.content, year));
    if (!dd) { unparsed.push("no parseable date cell"); continue; }
    const fw = parseWikiDate(dd.content, year);
    const w = waveFromCells(cells);
    if (w.fail) { unparsed.push(`${fw.date}: ${w.fail}`); continue; }
    out.push({ ...fw, sample: w.sample, url, client, vi: w.vi });
  }
  const seen = new Set(), waves = [];
  for (const w of out) if (!seen.has(w.date)) { seen.add(w.date); waves.push(w); }
  return { waves, unparsed };
}

// --------------------------------------------------------------- entry
const status = { changed: false, check: CHECK, added: [], skipped_existing: [], candidates: [] };

if (URL_OF) { // dev oracle: parse one article, print the record, exit
  const id = +(URL_OF.match(/articles\/(\d+)/) ?? [])[1];
  const rec = await parseArticle(URL_OF, id || 0);
  if (!rec) { console.error("not a YouGov Public Data federal-poll article"); process.exit(1); }
  console.log(JSON.stringify({ url: rec.url, date: rec.date, dateStart: rec.dateStart, sample: rec.sample, published: rec.published, vi: rec.vi, sat: rec.sat, ppmA: rec.ppmA, ppmO: rec.ppmO }, null, 2));
  process.exit(0);
}

try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const ygDates = new Set(D.polls.filter((p) => p.pollster === "YouGov").map((p) => p.date));
  const latestYg = [...ygDates].sort().pop();

  const rss = (await fetchText(RSS)).text;
  const items = [];
  for (const m of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim();
    const link = b.match(/<link>(https:\/\/yougov\.com\/articles\/[^<]+)<\/link>/)?.[1]?.trim();
    const pubIso = b.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    if (!title || !link) continue;
    if (!TITLE_HIT.test(title) || TITLE_MISS.test(title)) continue;
    items.push({ title, link, pubIso: pubIso ? dateIso(new Date(pubIso)) : null });
  }
  // A wave publishes within days of fieldwork end; the RSS item's pubDate
  // pre-screen drops articles older than the latest known wave.
  const cands = latestYg ? items.filter((i) => !i.pubIso || i.pubIso >= latestYg) : items;

  const recs = [];
  const seen = new Set();
  for (const it of cands) {
    const id = +(it.link.match(/articles\/(\d+)/) ?? [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    status.candidates.push(it.title.slice(0, 90));
    let rec;
    try { rec = await parseArticle(it.link, id); }
    catch (e) { console.error(`N24_NOTE fetch/parse failed ${it.link}: ${e.message}`); continue; }
    if (!rec) continue; // not the federal Public Data series
    status.candidates.push(`  -> parsed ${rec.date}`);
    recs.push(rec);
  }

  const guardFails = [];
  const newPolls = [], newPpm = [], newAppr = [], sources = [];
  for (const rec of recs.sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (ygDates.has(rec.date)) { status.skipped_existing.push(rec.date); continue; }
    const errs = guard(rec);
    if (errs.length) { guardFails.push(`${rec.date}: ${errs.join(" | ")}`); continue; }
    const era = olFor(rec.date);
    newPolls.push({
      date: rec.date, published: rec.published, dateStart: rec.dateStart,
      pollster: "YouGov", client: "News24", sample: rec.sample,
      alp: rec.vi.alp, lnp: rec.vi.lnp, grn: rec.vi.grn, onp: rec.vi.onp,
      ind: rec.vi.ind, oth: rec.vi.oth,
      tpp_alp: rec.vi.tpp_alp, tpp_lnp: rec.vi.tpp_lnp, url: rec.url,
    });
    if (rec.ppmA != null && rec.ppmO != null)
      newPpm.push({ date: rec.date, firm: "YouGov", alb: rec.ppmA, opp: rec.ppmO, oppName: era?.oppName ?? null, han: null, extra: null });
    if (rec.sat) {
      newAppr.push({
        date: rec.date, firm: "YouGov", alb: rec.sat.pmNet, opp: rec.sat.oppNet,
        oppName: era?.oppName ?? null, han: null,
        detail: {
          alb: { app: rec.sat.pmApp, dis: rec.sat.pmDis },
          opp: { app: rec.sat.oppApp, dis: rec.sat.oppDis },
        },
      });
    }
    sources.push({
      date: rec.date, file: `release-${rec.date}.json`,
      json: JSON.stringify({
        url: rec.url, id: rec.id, published: rec.published,
        fieldwork: { date: rec.date, dateStart: rec.dateStart, sample: rec.sample },
        vi: rec.vi, satisfaction: rec.sat, ppm: { alb: rec.ppmA, opp: rec.ppmO },
      }, null, 2) + "\n",
    });
    status.added.push({ date: rec.date, primaries: `${rec.vi.alp}/${rec.vi.lnp}/${rec.vi.grn}/${rec.vi.onp}/${rec.vi.ind}`, tpp: `${rec.vi.tpp_alp}/${rec.vi.tpp_lnp}`, ppm: rec.ppmA == null ? null : `${rec.ppmA}/${rec.ppmO}`, pmNet: rec.sat?.pmNet ?? null, oppNet: rec.sat?.oppNet ?? null });
  }

  // Fallback: waves YouGov never released on yougov.com, sourced from the
  // Wikipedia poll table. Only fills gaps — the RSS pass's dates win. A
  // Wikipedia fetch failure is logged as N24_NOTE, not pipeline-fatal.
  status.fallback = { source: "wikipedia", checked: 0, added: [], skipped_existing: 0, unparsed: [] };
  try {
    const wikiText = WIKI_FILE ? readFileSync(WIKI_FILE, "utf8") : (await fetchText(WIKI_RAW)).text;
    const { waves, unparsed } = parseWikiYouGov(wikiText);
    if (WIKI_DEBUG) console.error("N24_WIKI " + JSON.stringify(waves));
    status.fallback.checked = waves.length;
    status.fallback.unparsed = unparsed.slice(0, 10);
    const have = new Set([...ygDates, ...newPolls.map((p) => p.date)]);
    for (const w of waves) {
      if (have.has(w.date)) { status.fallback.skipped_existing++; continue; }
      const errs = guard(w, { requirePublished: false, requireTpp: false, spanMin: 0 });
      if (errs.length) { status.fallback.unparsed.push(`${w.date}: ${errs.join(" | ")}`); continue; }
      newPolls.push({
        date: w.date, dateStart: w.dateStart,
        pollster: "YouGov", client: w.client, sample: w.sample,
        alp: w.vi.alp, lnp: w.vi.lnp, grn: w.vi.grn, onp: w.vi.onp,
        ind: w.vi.ind, oth: w.vi.oth,
        tpp_alp: w.vi.tpp_alp, tpp_lnp: w.vi.tpp_lnp,
        ...(w.url ? { url: w.url } : {}),
      });
      sources.push({
        date: w.date, file: `wiki-${w.date}.json`,
        json: JSON.stringify({
          source: "wikipedia", title: WIKI_TITLE, url: w.url,
          fieldwork: { date: w.date, dateStart: w.dateStart, sample: w.sample }, vi: w.vi,
        }, null, 2) + "\n",
      });
      status.fallback.added.push(w.date);
      status.added.push({ date: w.date, primaries: `${w.vi.alp}/${w.vi.lnp}/${w.vi.grn}/${w.vi.onp}/${w.vi.ind}`, tpp: w.vi.tpp_alp == null ? null : `${w.vi.tpp_alp}/${w.vi.tpp_lnp}`, ppm: null, pmNet: null, oppNet: null, via: "wikipedia" });
    }
    if (status.fallback.added.length > MAX_WIKI_ADDS)
      guardFails.push(`wiki fallback: ${status.fallback.added.length} new waves > cap ${MAX_WIKI_ADDS}`);
  } catch (e) {
    console.error(`N24_NOTE wiki fallback skipped: ${e.message}`);
    status.fallback.error = String(e?.message || e);
  }

  if (guardFails.length) {
    console.error("N24_GUARD " + guardFails.join(" || "));
    status.guard = guardFails;
    console.log("N24_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newPolls.length) {
    D.polls = [...D.polls, ...newPolls].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const [key, rows] of [["ppm", newPpm], ["approval", newAppr]])
      if (rows.length) D[key] = [...D[key], ...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      mkdirSync(SRC_DIR, { recursive: true });
      for (const s of sources) writeFileSync(`${SRC_DIR}/${s.file}`, s.json);
      console.log(`wrote ${OUT}: +${newPolls.length} YouGov wave(s): ${status.added.map((a) => a.date).join(", ")}`);
    }
  }
  console.log("N24_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("N24_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("N24_STATUS " + JSON.stringify(status));
  process.exit(1);
}
