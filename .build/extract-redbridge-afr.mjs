#!/usr/bin/env node
// File an AFR/RedBridge/Accent federal wave from the AFR article's chart,
// days before accent-research.com posts the report PDF that
// extract-redbridge.mjs reads.
//
// WHY: AFR publishes each wave on release Sunday at 18:00; the Accent
// project page has lagged 4–6 days (Jul 2026 wave: AFR 2 Aug, Accent 5 Aug;
// Aug: 30 Aug / 3 Sep). Until 2026-10-04 the gap was filled by hand. The
// article is paywalled, so it is read through the user's logged-in Chrome
// (chrome-article.mjs — the laptop launchd job only; CI has no session), and
// the figures that matter (Coalition primary, Other, both Labor-v-Coalition
// 2PPs) exist ONLY as pixels in a chart graphic, not in the prose.
//
// PIPELINE, per AFR URL:
//   1. article HTML via chrome-article.mjs (or --html <file> offline)
//   2. every inline image (fetched at 1600px) → macOS Vision OCR (ocr-image.swift, compiled
//      on demand) → text lines with positions; chart = an image whose text
//      has "Primary vote" and "RedBridge"
//   3. fieldwork dates and sample: parsed here from the chart footer
//      ("Conducted September 28-October 2, sample of 1000 voters")
//   4. Matilda (redbridge-afr-prompt.md) says WHICH OCR LINE holds each
//      figure — the chart layout changes every month (panels move, one or
//      two 2PP pairs), so positional pairing is an LLM job; no fixed parser
//      survived the 11 charts Nov 2025–Oct 2026
//   5. verification — Matilda never supplies a number: each figure is
//      re-read here from the line it cited, and accepted only if
//        a) the bracketed change printed beside it reconciles with the
//           previous committed wave (value − change == previous), or
//        b) for leader figures and the Labor-v-One-Nation 2PP only: no
//           change is printed (or no previous figure exists) and the
//           article prose states the same number in a sentence about it.
//           Primaries and the Labor-v-Coalition 2PPs need (a).
//      A printed change that does NOT reconcile rejects the figure outright
//      (prose cannot rescue it).
//   6. filing needs all five primaries and the respondent-allocated 2PP
//      verified, primaries summing to ~100, and extract-redbridge.mjs's own
//      new-wave guard; anything less files nothing (the Accent PDF fills the
//      wave days later, as before). Leader rows (ppm / approval / altTpp)
//      are filed only when every figure in them verified.
//
// Rows are written to D.polls (and ppm / approval / altTpp) exactly as a
// hand entry would be. When the Accent page lands, extract-redbridge.mjs
// matches the wave, verifies it field by field (RB_STATUS.mismatches), and
// fills what the chart lacks: releaseUrl, tpp_split(_on), firmness, a
// missing tpp_flows, favourability detail and any companion row skipped here.
//
// Provenance: .build/redbridge-src/afr-<yyyymmdd>-<id>.json keeps the OCR,
// Matilda's citations and the verification verdict for every article read.
//
// Ledger: .build/redbridge-src/afr-seen.json — articles already settled
// (filed, no chart, not federal, unverifiable…) are skipped; --force rereads.
//
// Usage:
//   node .build/extract-redbridge-afr.mjs --status '<RB_STATUS json>'   (wrapper)
//   node .build/extract-redbridge-afr.mjs --url <afr-url> [--html <file>] [--check]
//   --check computes and prints, never writes; with --check a wave that is
//   already committed is compared against the committed row (backtesting).
//
// Automation contract: exit 0 = ran (filed or not); exit 1 = environment
// failure (no Chrome session, no OCR, no Matilda); last stdout line
// `RBAFR_STATUS {json}` with changed:true when polls.json was written.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.RB_LIB = "1";
const { guardNewWave } = await import("./extract-redbridge.mjs");

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const CHECK = argv.includes("--check");
const OUT = "data/polls.json";
const SRC_DIR = process.env.RBAFR_SRC || ".build/redbridge-src"; // RBAFR_SRC: backtests keep their evidence out of the repo
const POLLSTER = "RedBridge/Accent";
const OCR_SRC = ".build/ocr-image.swift";
const OCR_BIN = join(homedir(), "Library/Caches/auspol-ocr/ocr-image");
const PROMPT = ".build/redbridge-afr-prompt.md";
const MATILDA_WALL = "3m";
const DAY = 86_400_000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

const status = { changed: false, check: CHECK, filed: [], read: [], notes: [] };
const finish = (code = 0) => { console.log("RBAFR_STATUS " + JSON.stringify(status)); process.exit(code); };

// ---------------------------------------------------------------- inputs
// RBAFR_LIB=1: import the parsers only (.build/test-redbridge-afr.mjs)
const LIB = process.env.RBAFR_LIB === "1";
let urls = [];
if (argOf("--url")) urls = [argOf("--url")];
else if (argOf("--status")) {
  try { urls = JSON.parse(argOf("--status")).afrTopicNotes || []; }
  catch (e) { status.notes.push(`--status is not JSON: ${e.message}`); finish(1); }
}
if (!urls.length && !LIB) { status.notes.push("no AFR article to read"); finish(0); }

// ------------------------------------------------------------------- OCR
function ocrBinary() {
  const stale = !existsSync(OCR_BIN) || statSync(OCR_BIN).mtimeMs < statSync(OCR_SRC).mtimeMs;
  if (stale) {
    mkdirSync(join(OCR_BIN, ".."), { recursive: true });
    execFileSync("swiftc", ["-O", OCR_SRC, "-o", OCR_BIN], { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 });
  }
  return OCR_BIN;
}

async function fetchImage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* retried */ }
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error(`image fetch failed: ${url}`);
}

function ocr(bin, file) {
  let why = "";
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const r = spawnSync(bin, [file], { encoding: "utf8", timeout: 120_000 });
    if (r.status === 0) return JSON.parse(r.stdout);
    why = `${r.signal || "exit " + r.status} after ${Date.now() - t0}ms: ${(r.stderr || "").trim().slice(0, 160)}`;
  }
  throw new Error(`OCR failed on ${file} (${why})`);
}

// --------------------------------------------------------------- article
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
function articleParts(html) {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).trim())
    .filter((t) => t.length > 40 && t.length < 1500 && !/^(Log in|Gift|Subscribers can|Sign up)/.test(t));
  const pub = (html.match(/"datePublished":"([^"]+)"/) || [])[1] || null;
  const images = [...new Set([...html.matchAll(/static\.ffx\.io\/images\/w_960\/([0-9a-f]{20,})/g)].map((m) => m[1]))];
  return { paras, pub, images };
}

// Sydney wall-clock "YYYY-MM-DDTHH:MM" of an instant
function sydney(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ---------------------------------------------------------------- footer
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const monthOf = (s) => MONTHS[s.slice(0, 3).toLowerCase()];
const isoDay = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// Footers seen: "Survey conducted April 24-30, sample of 1014 voters",
// "Conducted September 28-October 2, sample of 1000 voters", "Survey May
// 25-28, 1005 voters", "Poll sampled 1006 voters between Jun 22 and Jun 26".
function parseFooter(text, pubDay) {
  const t = text.replace(/\s+/g, " ");
  let m = t.match(/\b(?:survey|conducted)\b[^.]*?\b([A-Z][a-z]{2,8})\.? (\d{1,2})\s*[-–]\s*(?:([A-Z][a-z]{2,8})\.? )?(\d{1,2})\b[^.]*?([\d,]{3,6}) voters/i);
  if (!m) {
    const b = t.match(/\b([\d,]{3,6}) voters between ([A-Z][a-z]{2,8})\.? (\d{1,2}) and (?:([A-Z][a-z]{2,8})\.? )?(\d{1,2})\b/i);
    if (b) m = [b[0], b[2], b[3], b[4], b[5], b[1]];
  }
  if (!m) return null;
  const m1 = monthOf(m[1]), m2 = m[3] ? monthOf(m[3]) : m1;
  if (m1 == null || m2 == null) return null;
  const pubY = +pubDay.slice(0, 4), pubM = +pubDay.slice(5, 7) - 1;
  const y2 = m2 > pubM ? pubY - 1 : pubY; // a December wave published in January
  const y1 = m1 > m2 ? y2 - 1 : y2;
  return { dateStart: isoDay(y1, m1, +m[2]), date: isoDay(y2, m2, +m[4]), sample: +m[5].replace(/,/g, "") };
}

// ------------------------------------------------------- figure checking
// the numbers on an OCR line: the figure, then the bracketed change
// OCR reads a printed zero as the letter O when it stands alone or beside a
// bracket ("O(+1)", "(O)": May and Jul 2026); "One Nation" is untouched
const ocrDigits = (text) => text.replace(/[−–]/g, "-").replace(/(?<![A-Za-z])O(?![A-Za-z])/g, "0");
function lineNumbers(text) {
  const t = ocrDigits(text);
  const br = t.match(/\(\s*([+-]?)\s*(\d+(?:\.\d+)?)\s*(?:pts?)?\s*\)?/i);
  const head = br ? t.slice(0, br.index) : t;
  const nums = [...head.matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((x) => +x[0]);
  return {
    value: nums.length ? nums[nums.length - 1] : null,
    change: br ? (br[1] === "-" ? -br[2] : +br[2]) : null,
    changeSigned: br ? br[1] !== "" || +br[2] === 0 : false,
  };
}

// The headline figures must reconcile with a printed change: prose can't
// tell them apart ("One Nation … ahead of Labor at 29 per cent to 28 per
// cent" would back Labor at 29 as readily as One Nation).
const HEADLINE = new Set(["alp", "lnp", "grn", "onp", "oth", "tpp_resp_alp", "tpp_flows_alp"]);
const KEYWORDS = {
  alp: [/\bLabor\b/, /primary|vote/i], lnp: [/\bCoalition\b/, /primary|vote/i], grn: [/\bGreens\b/, /primary|vote/i],
  onp: [/\bOne Nation\b/, /primary|vote/i], oth: [/\bother\b/i, /primary|vote/i],
  tpp_resp_alp: [/two-party/i], tpp_flows_alp: [/two-party/i], tpp_on_alp: [/two-party/i, /\bOne Nation\b/],
  ppm_alb: [/preferred prime minister/i], ppm_opp: [/preferred prime minister/i], ppm_han: [/preferred prime minister/i],
  net_alb: [/\bAlbanese\b/, /net/i], net_opp: [/net/i], net_han: [/\bHanson\b/, /net/i],
};
function proseStates(paras, field, value, oppName) {
  const kws = [...KEYWORDS[field]];
  if (field === "net_opp" || field === "ppm_opp") kws.push(new RegExp(`\\b${oppName}\\b`));
  if (field === "ppm_alb") kws.push(/\bAlbanese\b/);
  if (field === "ppm_han") kws.push(/\bHanson\b/);
  const num = value < 0 ? `(?:minus |-|−)${-value}` : `${value}`;
  const re = new RegExp(`(?:^|[^\\d.])${num} ?(?:per cent|%)`);
  const sentences = paras.flatMap((p) => p.split(/(?<=[.!?])\s+/));
  return sentences.some((s) => kws.every((k) => k.test(s)) && re.test(s));
}

// ------------------------------------------------------------- Matilda
// one retry: Nov and Dec 2025's charts each once ended the model's turn on
// hidden reasoning with no answer (MAX_TOKENS)
function askMatilda(charts) {
  try { return askMatildaOnce(charts); }
  catch (e) { status.notes.push(`matilda retry after: ${e.message.slice(0, 160)}`); return askMatildaOnce(charts); }
}
function askMatildaOnce(charts) {
  const bundle = charts.map((c, image) => ({ image, lines: c.lines.map((l, line) => ({ line, ...l })) }));
  const prompt = readFileSync(PROMPT, "utf8") + "\n\n## Evidence bundle (JSON)\n\n```json\n" + JSON.stringify(bundle) + "\n```\n";
  // tools are never needed (the bundle is complete) but a stray read must not
  // abort the run: Dec 2025's first try died on a 0 budget after one grep
  const res = spawnSync("matilda", ["-p", prompt, "--output-format", "text", "--max-wall-time", MATILDA_WALL, "--max-tool-calls", "3"],
    { encoding: "utf8", timeout: 240_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (res.error) throw new Error(`matilda spawn failed: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`matilda exit ${res.status}: ${(res.stderr || res.stdout || "").trim().slice(0, 300)}`);
  const raw = res.stdout.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  const i0 = raw.indexOf("{"), i1 = raw.lastIndexOf("}");
  if (i0 < 0 || i1 <= i0) throw new Error("matilda answered with no JSON object");
  return JSON.parse(raw.slice(i0, i1 + 1));
}

// ------------------------------------------------------------------ main
if (!LIB) {
const orig = readFileSync(OUT, "utf8");
const D = JSON.parse(orig);
const sortByDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
let bin;
try { bin = ocrBinary(); } catch (e) { status.notes.push(`OCR tool unavailable: ${e.message}`); finish(1); }
mkdirSync(SRC_DIR, { recursive: true });

// Articles already settled are not reopened: every slot would otherwise open
// a tab in the user's Chrome and spend a Matilda call on the same opinion
// piece or state poll until the next wave lands. Transient outcomes (Chrome
// logged out, Matilda down, an image that failed to load) are retried.
const SEEN = join(SRC_DIR, "afr-seen.json");
const seen = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, "utf8")) : {};
const FINAL = new Set(["no-chart", "no-fieldwork", "not-federal", "not-filed", "already-committed", "filed"]);

for (const url of urls) {
  const id = (url.match(/-(20\d{6}-p[0-9a-z]+)$/) || [])[1] || "unknown";
  const rec = { url, id };
  status.read.push(rec);
  if (!CHECK && !argv.includes("--force") && seen[id]) { rec.result = `seen (${seen[id].result})`; continue; }
  let html;
  try {
    html = argOf("--html") ? readFileSync(argOf("--html"), "utf8")
      : execFileSync("node", [".build/chrome-article.mjs", url], { encoding: "utf8", timeout: 180_000, maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    rec.result = "no-article";
    status.notes.push(`${id}: Chrome read failed (${String(e.stderr || e.message).trim().slice(0, 200)})`);
    continue;
  }
  const art = articleParts(html);
  if (!art.pub) { rec.result = "no-publish-date"; continue; }
  if (art.paras.length < 6) { rec.result = "paywalled"; status.notes.push(`${id}: only ${art.paras.length} paragraphs — Chrome not logged in to AFR?`); continue; }

  const charts = [];
  for (const h of art.images) {
    const file = join(SRC_DIR, `afr-img-${h.slice(0, 16)}.jpg`);
    try {
      // read at 1600px: at the page's own 960 OCR took Jun 2026's "9 (0)" for "90"
      writeFileSync(file, await fetchImage(`https://static.ffx.io/images/w_1600/${h}`));
      const lines = ocr(bin, file);
      const text = lines.map((l) => l.text).join(" ");
      if (/primary vote/i.test(text) && /redbridge/i.test(text)) charts.push({ hash: h, lines, text });
    } catch (e) { rec.imageError = true; status.notes.push(`${id}: image ${h.slice(0, 12)}: ${e.message}`); }
    finally { try { execFileSync("rm", ["-f", file]); } catch { /* best effort */ } }
  }
  if (!charts.length) { rec.result = "no-chart"; continue; }

  const pubDay = sydney(art.pub).slice(0, 10);
  const fw = charts.map((c) => parseFooter(c.text, pubDay)).find(Boolean);
  if (!fw) { rec.result = "no-fieldwork"; status.notes.push(`${id}: chart footer carried no fieldwork dates / sample`); continue; }
  Object.assign(rec, fw);

  const committed = D.polls.find((r) => /redbridge/i.test(r.pollster) && Math.abs(daysBetween(r.date, fw.date)) <= 10);
  if (committed && !CHECK) { rec.result = "already-committed"; continue; }

  let reading;
  try { reading = askMatilda(charts); }
  catch (e) { rec.result = "matilda-failed"; status.notes.push(`${id}: ${e.message}`); continue; }
  if (reading.scope !== "federal" || /victoria|queensland|new south wales|\bnsw\b|state poll/i.test(charts.map((c) => c.text).join(" "))) {
    rec.result = "not-federal"; continue;
  }

  // the previous committed wave, for the printed changes
  const prevPoll = D.polls.filter((r) => r.pollster === POLLSTER && r.date < fw.dateStart).sort(sortByDate).pop();
  const near = (sec) => prevPoll && D[sec].find((r) => r.firm === POLLSTER && Math.abs(daysBetween(r.date, prevPoll.date)) <= 3);
  const prevPpm = near("ppm"), prevApp = near("approval"), prevAlt = near("altTpp");
  const PREV = {
    alp: prevPoll?.alp, lnp: prevPoll?.lnp, grn: prevPoll?.grn, onp: prevPoll?.onp, oth: prevPoll?.ind,
    tpp_resp_alp: prevPoll?.tpp_alp, tpp_flows_alp: prevPoll?.tpp_flows, tpp_on_alp: prevAlt?.alpVsOnp_alp,
    ppm_alb: prevPpm?.alb, ppm_opp: prevPpm?.opp, ppm_han: prevPpm?.han,
    net_alb: prevApp?.alb, net_opp: prevApp?.opp, net_han: prevApp?.han,
  };
  const oppName = typeof reading.oppName === "string" && /^[A-Z][a-z'-]+$/.test(reading.oppName) ? reading.oppName : null;

  const verdict = {};
  const ok = {};
  for (const field of Object.keys(PREV)) {
    const cite = reading.fields?.[field];
    if (!cite) { verdict[field] = "not on chart"; continue; }
    const line = charts[cite.image]?.lines?.[cite.line];
    if (!line) { verdict[field] = `cited line ${cite.image}/${cite.line} does not exist`; continue; }
    const got = lineNumbers(line.text);
    if (got.value == null || got.value !== cite.value) { verdict[field] = `line "${line.text}" does not read ${cite.value}`; continue; }
    if (got.change == null && cite.changeLine != null) {
      // the change printed on a line of its own ("(+1)" under "54")
      const cl = charts[cite.image].lines[cite.changeLine];
      const only = cl && ocrDigits(cl.text).match(/^\s*\(\s*([+-]?)\s*(\d+)\s*(?:pts?)?\s*\)?\s*$/i);
      if (!only) { verdict[field] = `cited change line ${cite.changeLine} is not a bare bracketed change`; continue; }
      Object.assign(got, { change: only[1] === "-" ? -only[2] : +only[2], changeSigned: only[1] !== "" || +only[2] === 0 });
    }
    const prev = PREV[field];
    if (got.change != null && prev != null) {
      const fits = got.changeSigned ? got.value - got.change === prev : Math.abs(got.value - prev) === Math.abs(got.change);
      if (fits) { ok[field] = got.value; verdict[field] = "change reconciles"; }
      else verdict[field] = `REJECTED: ${got.value} with change ${got.change} implies ${got.value - got.change}, previous wave has ${prev}`;
      continue;
    }
    if (!HEADLINE.has(field) && proseStates(art.paras, field, got.value, oppName)) { ok[field] = got.value; verdict[field] = "prose states it"; }
    else verdict[field] = `unverified: no printed change${prev == null ? " / no previous figure" : ""} and the prose does not state it`;
  }
  Object.assign(rec, { matilda: reading, verdict });

  const w = {
    date: fw.date, dateStart: fw.dateStart, sample: fw.sample, label: "afr-chart",
    alp: ok.alp, lnp: ok.lnp, grn: ok.grn, onp: ok.onp, ind: ok.oth, tppResp: ok.tpp_resp_alp,
    oppName: oppName || "?",
  };
  const errs = guardNewWave(w, pubDay);
  const missing = ["alp", "lnp", "grn", "onp", "oth", "tpp_resp_alp"].filter((k) => ok[k] == null);
  if (missing.length) errs.unshift(`unverified headline figure(s): ${missing.join(", ")}`);
  if (errs.length) { rec.result = "not-filed"; rec.errors = errs; }

  const published = sydney(art.pub);
  const row = {
    date: fw.date, published, dateStart: fw.dateStart, pollster: POLLSTER, client: "AFR", sample: fw.sample,
    alp: ok.alp, lnp: ok.lnp, grn: ok.grn, onp: ok.onp, ind: ok.oth, oth: null,
    tpp_alp: ok.tpp_resp_alp, tpp_lnp: ok.tpp_resp_alp != null ? 100 - ok.tpp_resp_alp : null,
    ...(ok.tpp_flows_alp != null ? { tpp_flows: ok.tpp_flows_alp } : {}),
    url,
  };
  const all = (...ks) => ks.every((k) => ok[k] != null);
  const companions = {
    ppm: oppName && all("ppm_alb", "ppm_opp", "ppm_han")
      ? { date: fw.date, firm: POLLSTER, alb: ok.ppm_alb, opp: ok.ppm_opp, oppName, han: ok.ppm_han, extra: null } : null,
    approval: oppName && all("net_alb", "net_opp", "net_han")
      ? { date: fw.date, firm: POLLSTER, alb: ok.net_alb, opp: ok.net_opp, oppName, han: ok.net_han, detail: null } : null,
    altTpp: ok.tpp_on_alp != null ? { date: fw.date, firm: POLLSTER, alpVsOnp_alp: ok.tpp_on_alp, lnpVsOnp_lnp: null } : null,
  };
  rec.row = row;
  rec.companions = companions;

  if (CHECK && committed) {
    // backtest: compare against the committed row for this wave
    const diffs = [];
    for (const k of ["date", "dateStart", "sample", "alp", "lnp", "grn", "onp", "ind", "tpp_alp", "tpp_flows"])
      if (row[k] != null && row[k] !== committed[k]) diffs.push(`${k}: chart=${row[k]} committed=${committed[k]}`);
    for (const [sec, keys] of [["ppm", ["alb", "opp", "han"]], ["approval", ["alb", "opp", "han"]], ["altTpp", ["alpVsOnp_alp"]]]) {
      const c = companions[sec], r = D[sec].find((x) => x.firm === POLLSTER && Math.abs(daysBetween(x.date, committed.date)) <= 3);
      if (c && r) for (const k of keys) if (c[k] !== r[k]) diffs.push(`${sec}.${k}: chart=${c[k]} committed=${r[k]}`);
    }
    rec.backtest = { committedDate: committed.date, diffs };
  }

  writeFileSync(join(SRC_DIR, `afr-${id}.json`), JSON.stringify({ url, published, fieldwork: fw, charts: charts.map((c) => ({ hash: c.hash, lines: c.lines })), ...rec }, null, 2) + "\n");
  if (errs.length || committed) { if (!rec.result) rec.result = committed ? "already-committed" : "not-filed"; continue; }

  rec.result = "filed";
  status.filed.push({ date: fw.date, url, alp: row.alp, lnp: row.lnp, onp: row.onp, tpp: row.tpp_alp,
    leaders: Object.keys(companions).filter((k) => companions[k]) });
  if (!CHECK) {
    D.polls = [...D.polls, row].sort(sortByDate);
    for (const [sec, r] of Object.entries(companions)) if (r) D[sec] = [...D[sec], r].sort(sortByDate);
  }
}

if (!CHECK) {
  const at = new Date().toISOString().slice(0, 16) + "Z";
  for (const r of status.read)
    if (FINAL.has(r.result) && !(r.result === "no-chart" && r.imageError)) seen[r.id] = { result: r.result, at, url: r.url };
  writeFileSync(SEEN, JSON.stringify(seen, null, 2) + "\n");
}

if (status.filed.length && !CHECK) {
  const next = JSON.stringify(D, null, 2)
    .replace(/"tpp3": \{\n\s+"alp": (\d+),\n\s+"lnp": (\d+),\n\s+"onp": (\d+)\n\s+\}/g, `"tpp3": { "alp": $1, "lnp": $2, "onp": $3 }`)
    + (orig.endsWith("\n") ? "\n" : "");
  status.changed = next !== orig;
  if (status.changed) { writeFileSync(OUT + ".tmp", next); renameSync(OUT + ".tmp", OUT); }
}
finish(0);
}

export { parseFooter, lineNumbers, proseStates, articleParts, sydney };
