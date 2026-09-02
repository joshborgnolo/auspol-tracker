// Extract DemosAU federal polls and federal MRPs from the methodology-statements
// index (https://demosau.com/methodology-statements/) and append their rows to
// data/polls.json (the tracker's canonical current-cycle dataset).
//
// The index is an Elementor bulleted list of linked PDFs. Each release's figures
// live in the PDF, not the page, so candidates are downloaded and mined with
// poppler's `pdftotext -layout` (installed at /opt/homebrew/bin — the launchd
// plist's PATH includes it). Releases qualify by TITLE (matching the user's
// spec of "federal poll" and "MRP" releases), with two title-format exceptions
// that are the same product ("Capital Brief/DemosAU April 2026 Poll" and
// "MRP Feb/March 2026"), and state-poll titles are excluded:
//   federal poll : /federal.?poll/i, or (/capital brief/i && /poll/i)
//   federal MRP  : /\bMRP\b/i
//   excluded     : state terms (Victoria, Tasmania, WA, NSW, SA, Queensland,
//                  Sydney, Melbourne, Brisbane, Greyhound…) — these are state
//                  products even when they mention "federal" or "MRP"
// Waves ending on/before the 2025-05-03 election are out of cycle and skipped.
//
// Parsing targets in the layout text (verified against the seven in-cycle
// federal releases, 2025-10 → 2026-08):
//   - cover/methodology: "Fieldwork Dates: D[-D] Month YYYY" (also
//     "D Month - D Month YYYY" and DD/MM/YY pairs), "Total Sample Size: N"
//     duplicated as "Sample size  N" in the methodology table (MRP Feb/Mar 26
//     prints 8,424 on the cover yet 8,484 in the table — the cover figure is
//     authoritative, and the clash is reported as a note), and
//     "Client commissioning the research  X" (Self-initiated → client "—").
//   - primary votes: the trend table whose first data row is the
//     "May 25 Election" anchor (34.6/31.8/12.2/6.4/15.0 — the actual 2025
//     results). Column ORDER VARIES between releases (Aug 2026 is
//     ALP GRN OTH ONP L/NP, Jun 2026 is ONP ALP L/NP GRN Oth, the MRPs are
//     ALP LNP GRN ONP OTH), so columns are calibrated from the election row's
//     VALUES (±0.7 of the known results) and each wave row's percentages are
//     assigned to parties by nearest x-position. The current wave is the LAST
//     wave row in the table. OTH maps to the tracker's `ind` (oth:null).
//   - undecided: the "…N% of respondents who were undecided" footer (one
//     release misspells it "Excludeds"; matched loosely).
//   - 2PP: "2PP calculation method" is "N/A"/"No 2PP calculated"/"No National
//     TPP calculated" for the regular polls → tpp null/null. A national 2PP
//     exists only when published as prose ("On a two party preferred basis
//     Labor leads the Coalition 56-44%" — Oct/Nov 25 MRP); a descriptive
//     method with no topline figure (Feb/Mar 26 MRP) stays null and is noted.
//   - MRP seats: the "Projection: Seats Won" table (MRP Estimate / 2025 Seats
//     / Change) merged with the "Seat Classifications" party ranges (lo–hi),
//     mapped Labor→alp, One Nation→onp, Coalition→lnp, Green(s)→grn,
//     Other→ind (CA/KAP sub-splits are not published as tables and stay out).
// Jan-2026-style releases put the topline table in an image — no anchor row
// is found — which is fine while that wave already exists in polls.json.
//
// Existing (date, pollster) rows are NEVER overwritten. A parsed candidate is
// matched to an existing row (same pollster, sample equal within 60d, else
// date within 14d) and VERIFIED: any difference in dates, sample, primaries,
// published 2PP or MRP seats is reported in DEMOSAU_STATUS.mismatches as a
// warning (the hand-curated file stays authoritative), while wave-level parse
// failures on an existing wave are notes, not failures. Rows are inserted in
// date order (validate.mjs demands a globally sorted array) and the row shape
// mirrors the hand-entered DemosAU entries, url = the PDF.
//
//   candidates are NEVER re-fetched: parsed metrics cache to
//   .build/demosau-src/<slug>.json (schema-versioned via cacheV — a version
//   bump re-derives from the committed <slug>.txt instead of downloading);
//   --force re-downloads everything. A wave row whose release has rolled
//   OFF the index page (July 2026, Feb 2026) is refetched by the curated
//   row's own url so verification coverage never silently drops.
//   - leadership (federal polls): the Preferred-PM three-choice chart
//     (name order varies per release; values are the bar rows in the same
//     order), the Head-to-Head pair vs the Liberal leader (committed as
//     ppm.extra), and the "Leader Ratings" table (Positive / Neutral /
//     Negative / Net Positive / Change %) → approval nets + app/dis detail.
//     A new wave's ppm and approval rows are inserted alongside its VI row;
//     Jan-2026-style releases with leadership charts as images fail the
//     new-wave guard. Existing ppm/approval rows are verified with the same
//     file-is-authoritative semantics (missing rows surface in
//     DEMOSAU_STATUS.missing_rows).
//
// Usage: node .build/extract-demosau.mjs [--check] [--force] [index-url]
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `DEMOSAU_STATUS {json}` — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (a new
//     wave's figure missing, sums off 100, implausible values, bad fieldwork
//     span, trend table unparseable) — the upstream format changed or the
//     parse went wrong; nothing is written
//   - --check computes everything, prints DEMOSAU_STATUS, never writes
//   - writes are atomic (.tmp + rename)
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
const INDEX_URL = argv.find((a) => !a.startsWith("--")) || "https://demosau.com/methodology-statements/";
const OUT = "data/polls.json";
const SRC_DIR = ".build/demosau-src";
const CYCLE_START = "2025-05-04";
const FETCH_TIMEOUT_MS = 60_000;
const FETCH_TRIES = 3;

// canon 2025 federal election results — the trend table's calibration anchor
const ELEC_2025 = { alp: 34.6, lnp: 31.8, grn: 12.2, onp: 6.4, ind: 15.0 };

// ---------------------------------------------------------------- fetching
// shared cookie jar: since 2026-09-02 demosau.com sits behind SiteGround's
// bot wall, whose pass cookie (set once the PoW below is solved) has to ride
// on every later fetch — index, refetches, and the PDFs alike
const cookieJar = new Map();
function storeCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
async function fetchBuffer(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (auspol-tracker data update)",
          ...(cookieJar.size ? { cookie: [...cookieJar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      storeCookies(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
}

// SiteGround's "sgcaptcha" wall answers each request with a meta-refresh to
// a JS proof-of-work: sha1(challenge ‖ counterBytes) must show `complexity`
// leading zero bits (counter = minimal big-endian bytes, base64(challenge ‖
// counter) goes back as ?sol=). A few million sha1 rounds — ~1s in Node.
function solveSgChallenge(challenge) {
  const complexity = parseInt(challenge.split(":", 1)[0], 10);
  const cb = Buffer.from(challenge, "utf8");
  const shift = 32 - complexity;
  const t0 = Date.now();
  for (let c = 0; ; c++) {
    const len = c < 0x100 ? 1 : c < 0x10000 ? 2 : c < 0x1000000 ? 3 : c < 0x100000000 ? 4 : 6;
    const nb = Buffer.alloc(len);
    nb.writeUIntBE(c, 0, len);
    const d = createHash("sha1").update(cb).update(nb).digest();
    if (d.readUInt32BE(0) >>> shift === 0) {
      return { sol: Buffer.concat([cb, nb]).toString("base64"), ms: Date.now() - t0, hashes: c + 1 };
    }
  }
}

// follow the wall's meta-refresh, solve, submit — on success the jar holds
// the pass cookie. False when html isn't the wall or the challenge page
// didn't parse; the caller's bounded retry loop decides what happens next.
async function passSgCaptcha(html, pageUrl) {
  const m = html.match(/refresh" content="0;([^"]*sgcaptcha[^"]*)/);
  if (!m) return false;
  const chal = (await fetchBuffer(new URL(m[1], pageUrl).href)).toString("utf8");
  const challenge = chal.match(/sgchallenge="([^"]+)"/)?.[1];
  const submit = chal.match(/sgsubmit_url="([^"]+)"/)?.[1];
  if (!challenge || !submit) return false;
  const { sol, ms, hashes } = solveSgChallenge(challenge);
  const u = new URL(submit, pageUrl);
  u.search += `${u.search ? "&" : "?"}sol=${encodeURIComponent(sol)}&s=${ms}:${hashes}`;
  await fetchBuffer(u.href);
  return true;
}

function pdfToText(buf, slug) {
  const pdfPath = join(tmpdir(), `demosau-${slug}.pdf`);
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

// "18-20 August 2026" | "5 October-11 November 2025" | "13 January - 3 March
// 2026" | "13/01/26 -03/03/26" → { dateStart, date } or null
function parsePeriod(raw) {
  const s = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (m) {
    const y1 = 2000 + +m[3], y2 = 2000 + +m[6];
    return { dateStart: iso(y1, +m[2] - 1, +m[1]), date: iso(y2, +m[5] - 1, +m[4]) };
  }
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\.?\s*-\s*(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
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

const pctTokens = (line) => {
  const out = [];
  const re = /(-?\d+(?:\.\d+)?)\s*%/g;
  let m;
  while ((m = re.exec(line))) out.push({ x: m.index, v: parseFloat(m[1]) });
  return out;
};

// ------------------------------------------------------------- leadership
// Preferred-PM (three-choice) chart: a names row ("Anthony Albanese (Labor)
// Angus Taylor (Liberal)  Pauline Hanson (One Nation)  Don't Know") whose
// NAME order varies per release (May/Jun 2026 put Hanson second), then one
// value line per name in the same order (value first on the line; the
// "Change from …%" column sits further right). Row order = bar order.
// Head-to-Head: two side-by-side sub-charts (Albanese vs Hanson one side,
// Albanese vs Liberal leader the other), bars top-to-bottom in name order
// (Albanese, other, Don't Know). The committed `extra` pair is the
// Albanese-vs-Liberal-leader one. Leader Ratings is a real table: "Prime
// Minister X / Opposition Leader Y / One Nation Leader Z" rows with
// Positive, Neutral, Negative, Net Positive, Change % columns (the net and
// change can wrap to a continuation line of lone signed tokens).
// Jan-2026-style releases render all of this as images: nothing parses —
// a note on an existing wave, a guard fail on a new one.
const ROLE_RE = /([A-Z][A-Za-z'.-]+(?: [A-Z][A-Za-z'.-]+){0,2}) \((Labor|Liberal|One Nation)\)|(Don't Know)\b/g;

function leaderRoles(line) {
  const roles = [];
  let m;
  ROLE_RE.lastIndex = 0;
  while ((m = ROLE_RE.exec(line))) {
    if (m[3]) roles.push({ role: "dk", x: m.index });
    else roles.push({ role: m[2] === "Labor" ? "alb" : m[2] === "Liberal" ? "opp" : "han", name: m[1].trim(), x: m.index });
  }
  return roles;
}

const surname = (full) => full.trim().split(/\s+/).pop();

function parsePreferredPM(lines) {
  const namesIdx = lines.findIndex((l) => {
    if (/^\s*Q\./.test(l)) return false;
    const got = new Set(leaderRoles(l).map((r) => r.role));
    return got.has("alb") && got.has("opp") && got.has("han") && got.has("dk");
  });
  if (namesIdx === -1) return { error: "no preferred-PM names row (leadership charts may be images)" };
  const roles = leaderRoles(lines[namesIdx]);
  const values = [];
  for (let i = namesIdx + 1; i < lines.length && values.length < roles.length; i++) {
    const l = lines[i];
    if (/^\s*0%(?:\s|$)/.test(l) || /^\s*(Head to Head|Second Choices|Leader Ratings|Personal Ratings|Q\.)/i.test(l)) break;
    const m = l.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (m) values.push(parseFloat(m[1]));
  }
  if (values.length !== roles.length) return { error: `preferred-PM values ${values.length}/${roles.length} parsed` };
  const ppm = {};
  let oppName = null;
  roles.forEach((r, i) => {
    if (r.role === "alb") ppm.alb = values[i];
    else if (r.role === "opp") { ppm.opp = values[i]; oppName = surname(r.name); }
    else if (r.role === "han") ppm.han = values[i];
  });
  const total = ppm.alb + ppm.opp + ppm.han;
  if (!(total > 65 && total <= 100)) return { error: `preferred-PM three-choice total ${total} implausible` };
  return { ppm, oppName, namesIdx };
}

function parseHeadToHead(lines, afterIdx) {
  const hIdx = lines.findIndex((l, i) => i > afterIdx && /^\s*Head to Head\s*$/i.test(l));
  if (hIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (/^\s*(Second Choices|Leader Ratings|Personal Ratings|Q\. What is your opinion)/i.test(lines[i])) { endIdx = i; break; }
  }
  const block = lines.slice(hIdx, endIdx);
  const pairIdx = block.findIndex((l) => l.includes("(Labor)") && l.includes("(Liberal)"));
  if (pairIdx === -1) return { error: "head-to-head: no Labor+Liberal names line" };
  const toks = [];
  block.forEach((l, li) => {
    if (/^\s*0%(?:\s|$)/.test(l)) return;
    for (const t of pctTokens(l)) toks.push({ ...t, li });
  });
  if (toks.length < 4) return { error: `head-to-head: only ${toks.length} value tokens` };
  const xs = toks.map((t) => t.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const byLine = (a, b) => a.li - b.li || a.x - b.x;
  const right = toks.filter((t) => t.x > mid).sort(byLine);
  const left = toks.filter((t) => t.x <= mid).sort(byLine);
  // the Liberal-leader pair is whichever cluster shares the pair line's side
  const pairLine = block[pairIdx];
  const albX = pairLine.indexOf("(Labor)");
  const cluster = (albX > mid ? right : left);
  if (cluster.length < 2) return { error: "head-to-head: Liberal pair cluster has <2 values" };
  const [alb, opp] = cluster.map((t) => t.v);
  if (cluster.length >= 3 && Math.abs(alb + opp + cluster[2].v - 100) > 3)
    return { error: `head-to-head pair ${alb}/${opp}/${cluster[2].v} sums off 100` };
  return { alb, opp };
}

function parseLeaderRatings(lines) {
  const pats = [
    ["alb", /^\s*Prime Minister ([A-Z][A-Za-z'.-]+(?: [A-Z][A-Za-z'.-]+){1,2})\s{2,}/],
    ["opp", /^\s*Opposition Leader ([A-Z][A-Za-z'.-]+(?: [A-Z][A-Za-z'.-]+){1,2})\s{2,}/],
    ["han", /^\s*One Nation Leader ([A-Z][A-Za-z'.-]+(?: [A-Z][A-Za-z'.-]+){1,2})\s{2,}/],
  ];
  const out = {};
  let oppName = null;
  for (const [role, pat] of pats) {
    let found = null;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pat);
      if (!m) continue;
      let vals = pctTokens(lines[i]).filter((t) => t.x > m[0].length - 2).map((t) => t.v);
      if (vals.length === 3) {
        // net/change wrapped to a continuation line of lone signed tokens
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const t2 = pctTokens(lines[j]);
          if (t2.length === 2 && lines[i + 1] && /^-?\d/.test(lines[j].trim())) { vals = [...vals, ...t2.map((t) => t.v)]; break; }
        }
      }
      if (vals.length >= 3) {
        found = { app: vals[0], dis: vals[2], net: vals.length >= 4 ? vals[3] : vals[0] - vals[2] };
        if (role === "opp") oppName = surname(m[1]);
        break;
      }
    }
    if (!found) return { error: `leader ratings: ${role} row unparsed` };
    out[role === "alb" ? "alb" : role === "opp" ? "opp" : "han"] = found;
  }
  return { ratings: out, oppName };
}

function parseLeadership(lines) {
  const out = {};
  const pm = parsePreferredPM(lines);
  if (pm.error) out.ppmError = pm.error;
  else {
    out.ppm = pm.ppm;
    if (pm.oppName) out.oppName = pm.oppName;
    const h2h = parseHeadToHead(lines, pm.namesIdx);
    if (h2h && !h2h.error) out.ppmExtra = h2h;
  }
  const rat = parseLeaderRatings(lines);
  if (rat.error) out.ratingsError = rat.error;
  else {
    out.approval = rat.ratings;
    if (!out.oppName && rat.oppName) out.oppName = rat.oppName;
  }
  if (!out.ppm && !out.approval) out.leadershipError = out.ppmError || out.ratingsError || "leadership sections unparsed";
  return out;
}

const r1 = (v) => Math.round(v * 10) / 10;

// ------------------------------------------------------------ trend table
// Locate the "May 25 Election" row and calibrate party COLUMN ORDER from the
// known 2025 results; then zip the LAST wave row's tokens positionally
// (columns are non-overlapping and ordered identically in every row, so
// left-to-right zip is exact where nearest-x collides).
function parseTrendTable(lines) {
  const anchorIdx = lines.findIndex((l) => /May\s*25\s*Election/i.test(l));
  if (anchorIdx === -1) return { error: "no 'May 25 Election' anchor row (topline table may be an image)" };

  const calib = pctTokens(lines[anchorIdx]);
  if (calib.length !== 5)
    return { error: `election anchor row has ${calib.length} percentage tokens, expected 5` };
  const order = [];
  for (const t of calib) {
    let best = null;
    for (const [party, target] of Object.entries(ELEC_2025)) {
      if (order.includes(party)) continue;
      const diff = Math.abs(t.v - target);
      if (diff <= 0.7 && (!best || diff < best.diff)) best = { party, diff };
    }
    if (!best) return { error: `election token ${t.v}% matches no 2025 result (±0.7)` };
    order.push(best.party);
  }
  if (order.length !== 5) return { error: "could not calibrate all five party columns" };

  let lastWave = null;
  for (let i = anchorIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*0%\s+/.test(l)) break; // chart axis row ends the table
    const toks = pctTokens(l);
    if (toks.length >= 4 && toks.length <= 8) lastWave = { line: l, toks };
  }
  if (!lastWave) return { error: "no wave row found below the election anchor" };
  if (lastWave.toks.length !== 5)
    return { error: `wave row "${lastWave.line.trim().slice(0, 40)}…" has ${lastWave.toks.length} tokens, expected 5` };

  const vote = {};
  lastWave.toks.forEach((t, i) => { vote[order[i]] = t.v; });
  return { vote };
}

// ------------------------------------------------------------- seat tables
const SEAT_LABEL = { labor: "alp", "one nation": "onp", coalition: "lnp", green: "grn", greens: "grn", other: "ind" };

function parseSeats(text) {
  const p = {};
  const projIdx = text.search(/Projection:\s*Seats Won/i);
  if (projIdx === -1) return { error: "no 'Projection: Seats Won' table" };
  const proj = text.slice(projIdx, projIdx + 1500);
  const projRe = /^\s*(Labor|One Nation|Coalition|Greens?|Other)\s+(\d+)\s+(\d+)\s+([+-]?\d+)\s*$/gim;
  let m;
  while ((m = projRe.exec(proj))) {
    const k = SEAT_LABEL[m[1].toLowerCase()];
    if (k) p[k] = { est: +m[2], chg: +m[4] };
  }
  if (Object.keys(p).length < 4) return { error: `seat projection parsed ${Object.keys(p).length}/5 parties` };

  const clsIdx = text.search(/Seat\s*Clas+s?ifications/i);
  if (clsIdx !== -1) {
    const cls = text.slice(clsIdx, clsIdx + 1800);
    const rngRe = new RegExp(`^\\s*(${Object.keys(SEAT_LABEL).map((s) => s[0].toUpperCase() + s.slice(1)).join("|")})\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+(\\d+)\\s*-\\s*(\\d+)\\s*$`, "gim");
    while ((m = rngRe.exec(cls))) {
      const k = SEAT_LABEL[m[1].toLowerCase()];
      if (k && p[k]) { p[k].lo = +m[2]; p[k].hi = +m[3]; }
    }
  }
  return { seats: { total: 150, basis: "2025 election", p } };
}

// ------------------------------------------------------------ pdf → metrics
function parsePdf(txt, slug, notes) {
  const lines = txt.split("\n");
  const out = { slug };

  const periods = [];
  for (const l of lines) {
    const m = l.match(/fieldwork dates?:?\s*(.{2,60})/i);
    if (!m) continue;
    const pr = parsePeriod(m[1]);
    if (pr) periods.push(pr);
    if (periods.length >= 3) break;
  }
  if (periods.length) {
    out.dateStart = periods[0].dateStart;
    out.date = periods[0].date;
    if (periods.some((p) => p.date !== out.date || p.dateStart !== out.dateStart))
      notes.push(`${slug}: fieldwork lines disagree (${periods.map((p) => `${p.dateStart}→${p.date}`).join(" | ")}); using first`);
  }

  const samples = [];
  const tm = txt.match(/total sample size:?\s*([\d,]+)/i);
  if (tm) samples.push(+tm[1].replace(/,/g, ""));
  const tblRe = /^\s*sample size\s+([\d,]+)\s*$/gim;
  let sm;
  while ((sm = tblRe.exec(txt))) samples.push(+sm[1].replace(/,/g, ""));
  const distinct = [...new Set(samples)];
  if (distinct.length) {
    out.sample = distinct[0]; // cover "Total Sample Size" sorts first; table value only when no cover
    if (distinct.length > 1) notes.push(`${slug}: conflicting sample sizes ${distinct.join(" vs ")}; using ${out.sample}`);
  }

  const cm = txt.match(/client commissioning the research\s+(.{1,60})/i);
  const clientRaw = cm ? cm[1].trim().replace(/\s{2,}.*$/, "").trim() : "";
  out.client = !clientRaw || /self-initiated|demosau/i.test(clientRaw) ? "—" : clientRaw;

  const um = txt.match(/(\d+)%\s*of respondents who were undecided/i);
  if (um) out.undecided = +um[1];

  const methIdx = txt.search(/2PP calculation method/i);
  const methLine = methIdx === -1 ? "" : txt.slice(methIdx, methIdx + 200).replace(/\s+/g, " ");
  out.tppNote = methLine.slice(0, 120);
  if (/N\/A|No (National )?(2PP|TPP) calculated/i.test(methLine)) {
    out.tpp_alp = null; out.tpp_lnp = null;
  } else {
    const pm = txt.match(/two[- ]party preferred basis[\s\S]{0,80}?labor leads the coalition\s+(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i);
    if (pm) { out.tpp_alp = parseFloat(pm[1]); out.tpp_lnp = parseFloat(pm[2]); }
    else {
      out.tpp_alp = null; out.tpp_lnp = null;
      if (methLine) notes.push(`${slug}: 2PP method described but no national topline parsed — storing null`);
    }
  }

  const tr = parseTrendTable(lines, notes);
  if (tr.error) out.trendError = tr.error;
  else Object.assign(out, { alp: tr.vote.alp, lnp: tr.vote.lnp, grn: tr.vote.grn, onp: tr.vote.onp, ind: tr.vote.ind });

  return out;
}

// ------------------------------------------------------------------ guards
function guardNewWave(w, isMRP) {
  const errs = [];
  const need = (name, v) => { if (v == null) errs.push(`${name} missing`); };
  need("date", w.date); need("dateStart", w.dateStart); need("sample", w.sample);
  if (w.trendError) errs.push(`trend table: ${w.trendError}`);
  for (const k of ["alp", "lnp", "grn", "onp", "ind"]) need(k, w[k]);
  if (!isMRP) {
    if (!w.ppm) errs.push(`leadership: ${w.ppmError || w.leadershipError || "preferred-PM unparsed"}`);
    if (!w.approval) errs.push(`leadership: ${w.ratingsError || w.leadershipError || "leader ratings unparsed"}`);
    if ((w.ppm || w.approval) && !w.oppName) errs.push("opposition leader name unresolved");
    else if (w.ppm) for (const k of ["alb", "opp", "han"]) {
      if (w.ppm[k] == null || w.ppm[k] < 2 || w.ppm[k] > 75) errs.push(`ppm.${k}=${w.ppm[k]} implausible`);
    }
    if (w.approval) for (const k of ["alb", "opp", "han"]) {
      if (Math.abs(w.approval[k].net) > 85) errs.push(`approval net ${k}=${w.approval[k].net} implausible`);
    }
  }
  if (w.date && w.dateStart) {
    const span = daysBetween(w.dateStart, w.date);
    const max = isMRP ? 120 : 15;
    if (span < 1 || span > max) errs.push(`field span ${span}d outside 1–${max}d`);
  }
  if (w.sample != null && (w.sample < 500 || w.sample > 20000)) errs.push(`sample=${w.sample} implausible`);
  for (const k of ["alp", "lnp", "grn", "onp", "ind"])
    if (w[k] != null && (w[k] < 1 || w[k] > 60)) errs.push(`${k}=${w[k]} outside 1–60`);
  if (["alp", "lnp", "grn", "onp", "ind"].every((k) => w[k] != null)) {
    const sum = w.alp + w.lnp + w.grn + w.onp + w.ind;
    if (Math.abs(sum - 100) > 1.5) errs.push(`primaries Σ=${sum} not ~100`);
  }
  if (w.tpp_alp != null && w.tpp_lnp != null && Math.abs(w.tpp_alp + w.tpp_lnp - 100) > 1)
    errs.push(`2pp Σ=${w.tpp_alp + w.tpp_lnp} not ~100`);
  if (isMRP) {
    if (!w.seats) errs.push(`MRP seats table: ${w.seatsError || "unparsed"}`);
    else {
      const s = Object.values(w.seats.p).reduce((a, b) => a + b.est, 0);
      if (Math.abs(s - 150) > 2) errs.push(`seat estimates Σ=${s}, expected 150`);
    }
  }
  return errs;
}

// ------------------------------------------------------------------- diff
// Difference of everything parseable against an existing curated row set for
// the same wave. The hand-curated file stays authoritative: differences are
// reported, never imposed. Returns { diffs, missingRows }.
function leadershipDiffs(date, w, D) {
  const diffs = [], missingRows = [];
  const near = (arr) => arr.find((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, date)) <= 10);
  if (w.ppm) {
    const pm = near(D.ppm);
    if (!pm) missingRows.push("ppm");
    else {
      if (pm.alb !== w.ppm.alb) diffs.push(`ppm.alb: pdf=${w.ppm.alb} vs file=${pm.alb}`);
      if (pm.opp !== w.ppm.opp) diffs.push(`ppm.opp: pdf=${w.ppm.opp} vs file=${pm.opp}`);
      if (pm.han !== w.ppm.han) diffs.push(`ppm.han: pdf=${w.ppm.han} vs file=${pm.han}`);
      if (pm.oppName && w.oppName && pm.oppName !== w.oppName) diffs.push(`ppm.oppName: pdf=${w.oppName} vs file=${pm.oppName}`);
      const xe = Array.isArray(pm.extra) && pm.extra[0];
      if (w.ppmExtra && (!xe || xe.alb !== w.ppmExtra.alb || xe.opp !== w.ppmExtra.opp))
        diffs.push(`ppm.extra: pdf=${JSON.stringify(w.ppmExtra)} vs file=${JSON.stringify(xe || null)}`);
    }
  }
  if (w.approval) {
    const ap = near(D.approval);
    if (!ap) missingRows.push("approval");
    else {
      for (const [k, role] of [["alb", "alb"], ["opp", "opp"], ["han", "han"]]) {
        if (ap[k] !== w.approval[role].net) diffs.push(`approval.${k}: pdf=${w.approval[role].net} vs file=${ap[k]}`);
        const d = ap.detail?.[role];
        if (d) {
          if (d.app !== w.approval[role].app) diffs.push(`approval.detail.${role}.app: pdf=${w.approval[role].app} vs file=${d.app}`);
          if (d.dis !== w.approval[role].dis) diffs.push(`approval.detail.${role}.dis: pdf=${w.approval[role].dis} vs file=${d.dis}`);
        }
      }
    }
  }
  return { diffs, missingRows };
}

// Sections with a committed row this release cannot re-verify because the PDF
// renders that chart as an image. Silent ok:true would be a lie, so these get
// flagged on the wave's verified entry rather than swallowed.
function unverifiableSections(w, D, date) {
  const un = [];
  if (!w.ppm && D.ppm.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, date)) <= 10)) un.push("ppm");
  if (!w.approval && D.approval.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, date)) <= 10)) un.push("approval");
  return un;
}

// wave date + leadership data → one ppm row and one approval row, shaped
// exactly like the hand-entered DemosAU leadership entries
function leadershipRows(w) {
  const rows = { ppm: null, approval: null };
  if (w.ppm) {
    rows.ppm = {
      date: w.date,
      firm: "DemosAU",
      alb: r1(w.ppm.alb),
      opp: r1(w.ppm.opp),
      ...(w.oppName ? { oppName: w.oppName } : {}),
      han: r1(w.ppm.han),
      extra: w.ppmExtra ? [{ alb: r1(w.ppmExtra.alb), opp: r1(w.ppmExtra.opp) }] : null,
    };
  }
  if (w.approval) {
    rows.approval = {
      date: w.date,
      firm: "DemosAU",
      alb: r1(w.approval.alb.net),
      opp: r1(w.approval.opp.net),
      ...(w.oppName ? { oppName: w.oppName } : {}),
      han: r1(w.approval.han.net),
      detail: {
        alb: { app: r1(w.approval.alb.app), dis: r1(w.approval.alb.dis) },
        opp: { app: r1(w.approval.opp.app), dis: r1(w.approval.opp.dis) },
        han: { app: r1(w.approval.han.app), dis: r1(w.approval.han.dis) },
      },
    };
  }
  return rows;
}

// ---------------------------------------------------------------- pipelines
// Wave-level comparison of VI inputs (sample/dates/primaries/2pp/MRP seats).
function viDiffs(e, w) {
  const diffs = [];
  const cmp = (k, got, exp) => { if (got != null && exp !== got) diffs.push(`${k}: pdf=${got} vs file=${exp}`); };
  cmp("sample", w.sample, e.sample);
  cmp("date", w.date, e.date);
  cmp("dateStart", w.dateStart, e.dateStart);
  for (const k of ["alp", "lnp", "grn", "onp", "ind"]) cmp(k, w[k], e[k]);
  if (w.tpp_alp != null) cmp("tpp_alp", w.tpp_alp, e.tpp_alp);
  if (w.tpp_lnp != null) cmp("tpp_lnp", w.tpp_lnp, e.tpp_lnp);
  if (w.seats && e.seats?.p)
    for (const [k, v] of Object.entries(w.seats.p)) {
      const h = e.seats.p[k];
      if (!h) continue;
      if (h.est != null && h.est !== v.est) diffs.push(`seats.${k}.est: pdf=${v.est} vs file=${h.est}`);
      if (h.lo != null && v.lo != null && h.lo !== v.lo) diffs.push(`seats.${k}.lo: pdf=${v.lo} vs file=${h.lo}`);
      if (h.hi != null && v.hi != null && v.hi !== h.hi) diffs.push(`seats.${k}.hi: pdf=${v.hi} vs file=${h.hi}`);
    }
  return diffs;
}

function parseWave(txt, slug, isMRP) {
  const w = parsePdf(txt, slug, status.notes);
  if (isMRP) {
    const st = parseSeats(txt);
    if (st.error) w.seatsError = st.error; else w.seats = st.seats;
  } else {
    Object.assign(w, parseLeadership(txt.split("\n")));
  }
  return w;
}

// load → cache → (re)parse one wave PDF. Cached metrics carry CACHE_V; a
// stale schema is re-derived from the cached pdftotext (committed alongside)
// without re-downloading, fetch only when the txt is missing too.
const CACHE_VER = 2;
async function loadWave(url, slug, isMRP) {
  const cachePath = `${SRC_DIR}/${slug}.json`;
  const txtPath = `${SRC_DIR}/${slug}.txt`;
  let w = null;
  if (!FORCE && existsSync(cachePath)) w = JSON.parse(readFileSync(cachePath, "utf8"));
  if (FORCE || !w || w.cacheV !== CACHE_VER) {
    let txt;
    if (!FORCE && existsSync(txtPath)) txt = readFileSync(txtPath, "utf8");
    else { txt = pdfToText(await fetchBuffer(url), slug); writeFileSync(txtPath, txt); }
    const prev = w?.extractedAt;
    w = parseWave(txt, slug, isMRP);
    w.extractedAt = prev || new Date().toISOString();
    w.cacheV = CACHE_VER;
    writeFileSync(cachePath, JSON.stringify(w, null, 2) + "\n");
  }
  return w;
}

// -------------------------------------------------------------------- main
const status = { changed: false, check: CHECK, added: [], backfilled: [], verified: [], mismatches: [], notes: [], skipped_titles: [], out_of_cycle: [], missing_rows: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const existing = D.polls.filter((p) => p.pollster === "DemosAU" || p.pollster === "DemosAU (MRP)");

  const linkRe = /<a[^>]+href="(https:\/\/demosau\.com\/wp-content\/uploads\/[^"]+\.pdf)"[\s\S]{0,400}?icon-list-text">([^<]+)</g;
  const links = [];
  // the index page intermittently serves a linkless body (observed 2026-09-01);
  // retry with fetchBuffer's backoff before declaring a restructure
  for (let t = 1; ; t++) {
    const indexHtml = (await fetchBuffer(INDEX_URL)).toString("utf8");
    links.length = 0;
    let lm;
    while ((lm = linkRe.exec(indexHtml))) links.push({ url: lm[1], title: lm[2].replace(/&amp;/g, "&").trim() });
    if (links.length) break;
    // SiteGround bot wall (since 2026-09-02): solve its PoW once, the pass
    // cookie lands in fetchBuffer's jar and the refetch serves the real page
    if (indexHtml.includes("sgcaptcha") && (await passSgCaptcha(indexHtml, INDEX_URL))) continue;
    if (t >= FETCH_TRIES) throw new Error("no PDF links found on index page (site restructure?)");
    await new Promise((r) => setTimeout(r, 1500 * t));
  }

  const STATE_RE = /victoria|tasmania|queensland|\bWA\b|western australia|\bNSW\b|new south wales|south australia|\bSA\b|sydney|melbourne|brisbane|greyhound/i;
  const candidates = [];
  for (const l of links) {
    const title = l.title;
    const isMRP = /\bMRP\b/i.test(title);
    const isFed = /federal.?poll/i.test(title) || (/capital brief/i.test(title) && /poll/i.test(title));
    if (!(isMRP || isFed) || STATE_RE.test(title)) { status.skipped_titles.push(title); continue; }
    candidates.push({ ...l, pollster: isMRP ? "DemosAU (MRP)" : "DemosAU", isMRP });
  }
  status.candidates = candidates.map((c) => c.title);

  mkdirSync(SRC_DIR, { recursive: true });
  const guardFails = [];
  const newRows = [];
  const newPpmRows = [];
  const newApprovalRows = [];
  const matched = new Set();
  for (const c of candidates) {
    const slug = decodeURIComponent(c.url.split("/").pop().replace(/\.pdf$/i, ""));
    const w = await loadWave(c.url, slug, c.isMRP);

    if (w.date && w.date < CYCLE_START) { status.out_of_cycle.push({ title: c.title, date: w.date }); continue; }

    const match = existing.find((e) =>
      e.pollster === c.pollster &&
      ((w.sample != null && e.sample === w.sample && Math.abs(daysBetween(w.date ?? e.date, e.date)) <= 60) ||
        (w.date && Math.abs(daysBetween(e.date, w.date)) <= 14)));

    if (match) {
      matched.add(match);
      const led = leadershipDiffs(match.date, w, D);
      const diffs = [...viDiffs(match, w), ...led.diffs];
      // parseable leadership data for a wave whose section row is absent is
      // backfilled (same rows the new-wave branch would have written);
      // genuinely absent chart data (image-only releases) stays missing
      const rows = leadershipRows(w);
      for (const sec of led.missingRows) {
        if (!rows[sec]) { status.missing_rows.push({ date: match.date, missing: [sec] }); continue; }
        const bucket = sec === "ppm" ? newPpmRows : newApprovalRows;
        const file = sec === "ppm" ? D.ppm : D.approval;
        if (bucket.some((r) => r.date === match.date) || file.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, match.date)) <= 10)) continue;
        bucket.push(rows[sec]);
        status.backfilled.push({ date: match.date, section: sec, slug });
      }
      const unver = unverifiableSections(w, D, match.date);
      status.verified.push({ date: match.date, pollster: match.pollster, slug, ok: diffs.length === 0,
        ...(w.trendError ? { note: w.trendError } : {}), ...(unver.length ? { unverifiable: unver } : {}) });
      if (diffs.length) status.mismatches.push({ date: match.date, slug, diffs });
      continue;
    }

    const errs = guardNewWave(w, c.isMRP);
    if (errs.length) { guardFails.push(...errs.map((e) => `${slug}: ${e}`)); continue; }

    const row = {
      date: w.date,
      dateStart: w.dateStart,
      pollster: c.pollster,
      client: w.client,
      sample: w.sample,
      ...(w.undecided != null ? { undecided: w.undecided } : {}),
      alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: null,
      tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp,
      ...(w.seats ? { seats: w.seats } : {}),
      url: c.url,
    };
    if (newRows.some((r) => r.date === row.date && r.pollster === row.pollster) ||
        D.polls.some((r) => r.date === row.date && r.pollster === row.pollster)) {
      guardFails.push(`${slug}: duplicate wave ${row.date} ${row.pollster}`);
      continue;
    }
    newRows.push(row);

    const lead = leadershipRows(w);
    if (lead.ppm && !newPpmRows.some((r) => r.date === row.date) &&
        !D.ppm.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, row.date)) <= 10))
      newPpmRows.push(lead.ppm);
    if (lead.approval && !newApprovalRows.some((r) => r.date === row.date) &&
        !D.approval.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, row.date)) <= 10))
      newApprovalRows.push(lead.approval);

    status.added.push({ date: row.date, pollster: row.pollster, slug, alp: row.alp, lnp: row.lnp, onp: row.onp,
      ...(lead.ppm ? { ppm: true } : {}), ...(lead.approval ? { approval: true } : {}) });
  }

  // waves whose release has rolled off the index page are refetched via the
  // curated row's own url so verify coverage never silently drops
  for (const e of existing) {
    if (matched.has(e)) continue;
    const url = typeof e.url === "string" ? e.url : "";
    if (!/^https:\/\/demosau\.com\/wp-content\/uploads\/.*\.pdf$/i.test(url)) continue;
    const slug = decodeURIComponent(url.split("/").pop().replace(/\.pdf$/i, ""));
    const w = await loadWave(url, slug, e.pollster === "DemosAU (MRP)");
    const led = leadershipDiffs(e.date, w, D);
    const diffs = [...viDiffs(e, w), ...led.diffs];
    const rows = leadershipRows(w);
    for (const sec of led.missingRows) {
      if (!rows[sec]) { status.missing_rows.push({ date: e.date, missing: [sec] }); continue; }
      const bucket = sec === "ppm" ? newPpmRows : newApprovalRows;
      const file = sec === "ppm" ? D.ppm : D.approval;
      if (bucket.some((r) => r.date === e.date) || file.some((r) => r.firm === "DemosAU" && Math.abs(daysBetween(r.date, e.date)) <= 10)) continue;
      bucket.push(rows[sec]);
      status.backfilled.push({ date: e.date, section: sec, slug, via: "row-url" });
    }
    const unver = unverifiableSections(w, D, e.date);
    status.verified.push({ date: e.date, pollster: e.pollster, slug, ok: diffs.length === 0, via: "row-url",
      ...(w.trendError ? { note: w.trendError } : {}), ...(unver.length ? { unverifiable: unver } : {}) });
    if (diffs.length) status.mismatches.push({ date: e.date, slug, diffs });
  }

  if (guardFails.length) {
    console.error("DEMOSAU_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("DEMOSAU_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newRows.length || newPpmRows.length || newApprovalRows.length) {
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    D.polls = [...D.polls, ...newRows].sort(byDate);
    D.ppm = [...D.ppm, ...newPpmRows].sort(byDate);
    D.approval = [...D.approval, ...newApprovalRows].sort(byDate);
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      console.log(`wrote ${OUT}: +${newRows.length} DemosAU wave(s): ${status.added.map((a) => `${a.date} (${a.pollster})`).join(", ")}`);
    }
  }
  console.log("DEMOSAU_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("DEMOSAU_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("DEMOSAU_STATUS " + JSON.stringify(status));
  process.exit(1);
}
