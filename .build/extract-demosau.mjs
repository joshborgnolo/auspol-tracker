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
// Provenance: each candidate's parsed metrics cache to
// .build/demosau-src/<slug>.json and its pdftotext output to <slug>.txt
// (committed alongside). A cached candidate is never re-downloaded
// (--force re-downloads everything), so routine runs fetch only the index.
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
async function fetchBuffer(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker data update)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
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
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m;
  while ((m = re.exec(line))) out.push({ x: m.index, v: parseFloat(m[1]) });
  return out;
};

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

// -------------------------------------------------------------------- main
const status = { changed: false, check: CHECK, added: [], verified: [], mismatches: [], notes: [], skipped_titles: [], out_of_cycle: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const existing = D.polls.filter((p) => p.pollster === "DemosAU" || p.pollster === "DemosAU (MRP)");

  const indexHtml = (await fetchBuffer(INDEX_URL)).toString("utf8");
  const linkRe = /<a[^>]+href="(https:\/\/demosau\.com\/wp-content\/uploads\/[^"]+\.pdf)"[\s\S]{0,400}?icon-list-text">([^<]+)</g;
  const links = [];
  let lm;
  while ((lm = linkRe.exec(indexHtml))) links.push({ url: lm[1], title: lm[2].replace(/&amp;/g, "&").trim() });
  if (!links.length) throw new Error("no PDF links found on index page (site restructure?)");

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
  for (const c of candidates) {
    const slug = decodeURIComponent(c.url.split("/").pop().replace(/\.pdf$/i, ""));
    const cachePath = `${SRC_DIR}/${slug}.json`;
    let w;
    if (!FORCE && existsSync(cachePath)) {
      w = JSON.parse(readFileSync(cachePath, "utf8"));
    } else {
      const txt = pdfToText(await fetchBuffer(c.url), slug);
      w = parsePdf(txt, slug, status.notes);
      if (c.isMRP) {
        const st = parseSeats(txt);
        if (st.error) w.seatsError = st.error; else w.seats = st.seats;
      }
      w.extractedAt = new Date().toISOString();
      writeFileSync(cachePath, JSON.stringify(w, null, 2) + "\n");
      writeFileSync(`${SRC_DIR}/${slug}.txt`, txt);
    }

    if (w.date && w.date < CYCLE_START) { status.out_of_cycle.push({ title: c.title, date: w.date }); continue; }

    const match = existing.find((e) =>
      e.pollster === c.pollster &&
      ((w.sample != null && e.sample === w.sample && Math.abs(daysBetween(w.date ?? e.date, e.date)) <= 60) ||
        (w.date && Math.abs(daysBetween(e.date, w.date)) <= 14)));

    if (match) {
      const diffs = [];
      const cmp = (k, got, exp) => { if (got != null && exp !== got) diffs.push(`${k}: pdf=${got} vs file=${exp}`); };
      cmp("sample", w.sample, match.sample);
      cmp("date", w.date, match.date);
      cmp("dateStart", w.dateStart, match.dateStart);
      for (const k of ["alp", "lnp", "grn", "onp", "ind"]) cmp(k, w[k], match[k]);
      if (w.tpp_alp != null) cmp("tpp_alp", w.tpp_alp, match.tpp_alp);
      if (w.tpp_lnp != null) cmp("tpp_lnp", w.tpp_lnp, match.tpp_lnp);
      if (w.seats && match.seats?.p)
        for (const [k, v] of Object.entries(w.seats.p)) {
          const h = match.seats.p[k];
          if (!h) continue;
          if (h.est != null && h.est !== v.est) diffs.push(`seats.${k}.est: pdf=${v.est} vs file=${h.est}`);
          if (h.lo != null && v.lo != null && h.lo !== v.lo) diffs.push(`seats.${k}.lo: pdf=${v.lo} vs file=${h.lo}`);
          if (h.hi != null && v.hi != null && v.hi !== h.hi) diffs.push(`seats.${k}.hi: pdf=${v.hi} vs file=${h.hi}`);
        }
      status.verified.push({ date: match.date, pollster: match.pollster, slug, ok: diffs.length === 0, ...(w.trendError ? { note: w.trendError } : {}) });
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
    status.added.push({ date: row.date, pollster: row.pollster, slug, alp: row.alp, lnp: row.lnp, onp: row.onp });
  }

  if (guardFails.length) {
    console.error("DEMOSAU_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("DEMOSAU_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newRows.length) {
    D.polls = [...D.polls, ...newRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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
