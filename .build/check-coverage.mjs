// Coverage watchdog: answer "has the tracker missed a poll?" without trusting
// any single extractor to notice.
//
// WHY THIS EXISTS
// Every extractor's failure mode is silence. Roy Morgan's discovery reads only
// page 1 of the findings feed (255 pages exist, but pagination is client-side,
// so a release that scrolls off is unreachable); Newspoll and YouGov skip by
// date and never re-check; a rotted parser and a quiet fortnight look
// identical from the outside. Nothing in the pipeline distinguishes "no new
// poll" from "we can no longer see new polls", and the first symptom is a week
// missing from the site.
//
// So this asks an INDEPENDENT witness. The Wikipedia federal polling table is
// maintained by people watching for exactly these releases, cites each one,
// and carries every house the tracker follows - not just the two with clean
// upstream feeds. Comparing it against data/polls.json turns a silent gap into
// a fact with a date on it.
//
// It reads only (pollster, fieldwork-end date) pairs, deliberately. The full
// figure parse in extract-news24.mjs has to cope with per-house column layouts
// - YouGov prints six primaries, Newspoll five with the Coalition under
// colspan=3 - and every one of those is a way to fail. A gap check needs
// neither: a date and a name are enough to say "this wave exists and we do not
// have it", and the extractor that owns the house can then go and fetch it
// properly, with its own provenance and conventions. This never writes to
// polls.json - it reports, it does not fill.
//
// Second, cheaper check that needs no network at all: each house's own history
// gives its cadence, so a house that has gone conspicuously quiet relative to
// its own median gap is flagged even if Wikipedia is also behind.
//
// Usage: node .build/check-coverage.mjs [--json] [--quiet] [--wiki <file>]
//   exit 0 = everything current
//   exit 1 = could not fetch or parse the witness (check is inconclusive)
//   exit 3 = at least one gap or overdue house — deliberately distinct from
//            the extractors' 1/2 so a wrapper can tell a finding from a fault
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const QUIET = argv.includes("--quiet");
const WIKI_FILE = argv.includes("--wiki") ? argv[argv.indexOf("--wiki") + 1] : process.env.COVERAGE_WIKI_FILE || null;
const OUT = "data/polls.json";
const WIKI_TITLE = "Opinion_polling_for_the_next_Australian_federal_election";
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=${WIKI_TITLE}&action=raw`;
const CACHE = ".build/logs/wiki-polls-cache.txt";

// The 2025 election is the cycle floor; anything on or before it belongs to the
// previous cycle and is not the current dataset's business.
const CYCLE_START = "2025-05-03";

// Wikipedia's pollster column -> the tracker's `pollster` key. A house the
// tracker does not follow is not a gap, so anything unmapped is ignored rather
// than reported: the point is to find polls we MEANT to have.
const HOUSE = {
  "yougov": ["YouGov", "YouGov (MRP)"],
  "roy morgan": ["Roy Morgan", "Roy Morgan (SMS)"],
  "newspoll": ["Newspoll"],
  "resolve": ["Resolve"],
  "resolve political monitor": ["Resolve"],
  "demosau": ["DemosAU", "DemosAU (MRP)"],
  "redbridge/accent": ["RedBridge / Accent", "Redbridge", "RedBridge / Accent (MRP)"],
  "redbridge": ["RedBridge / Accent", "Redbridge"],
  "essential media communications": ["Essential"],
  "essential": ["Essential"],
  "freshwater strategy": ["Freshwater"],
  "freshwater": ["Freshwater"],
  "spectre strategy": ["Spectre Strategy"],
  "fox and hedgehog": ["Fox & Hedgehog"],
  "wolf and smith": ["Wolf & Smith"],
};

// A wave's fieldwork end can legitimately sit a day either side of the row the
// tracker keeps - Roy Morgan keys to the fieldwork-ending Sunday, Resolve's
// curated rows sit one day before the source's date - so a gap is only a gap
// when nothing of that house lands within this many days.
const DATE_SLACK_DAYS = 3;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
// Local date, not UTC: an AEST morning is still the previous day in UTC, and a
// watchdog that reports yesterday invites exactly the doubt it exists to remove.
const todayLocal = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate());
};

async function fetchWiki() {
  if (WIKI_FILE) return readFileSync(WIKI_FILE, "utf8");
  const res = await fetch(WIKI_RAW, {
    headers: { "user-agent": "auspol-tracker coverage check (contact via github.com/joshborgnolo/auspol-tracker)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`wikipedia HTTP ${res.status}`);
  const text = await res.text();
  if (text.length < 50_000) throw new Error(`wikitext implausibly short (${text.length} bytes)`);
  try { mkdirSync(".build/logs", { recursive: true }); writeFileSync(CACHE, text); } catch { /* cache is a convenience */ }
  return text;
}

// Fieldwork cell -> the END date. Handles "18–24 Aug", "27 Jul–2 Aug",
// "3–7 Aug", "24 August 2026" and the en/em-dash and abbreviation variants the
// table mixes freely.
function endDate(cell, year) {
  const s = cell.replace(/\[\[|\]\]/g, "").replace(/&nbsp;/g, " ").trim();
  let m = s.match(/^(\d{1,2})\s*(?:([A-Za-z]{3,9})\.?)?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[4].toLowerCase()], y = m[5] ? +m[5] : year;
    return mo && y ? iso(y, mo, +m[3]) : null;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()], y = m[3] ? +m[3] : year;
    return mo && y ? iso(y, mo, +m[1]) : null;
  }
  return null;
}

// Rows are chunks between |- separators. Only the voting-intention tables are
// in scope: a leadership or preferred-PM table repeats the same houses and
// dates and would double-count every wave.
function parseWitness(text) {
  const waves = [];
  let year = null, inVi = false;
  for (const chunk of text.split(/^\|-[^\n]*$/m)) {
    for (const h of chunk.matchAll(/^={2,4}\s*([^=]+?)\s*={2,4}\s*$/gm)) {
      const y = h[1].match(/\b(20\d\d)\b/);
      if (y) year = +y[1];
    }
    if (/\{\|/.test(chunk)) inVi = /Primary vote/i.test(chunk) && /2PP|Two-party.preferred/i.test(chunk);
    else if (/\|\}/.test(chunk)) inVi = false;
    if (!inVi) continue;

    // Pollster: the first wikilink that maps to a house we track. Taking the
    // link rather than the cell keeps refs, colspans and inline styling out.
    let house = null, wikiName = null;
    for (const l of chunk.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const key = l[1].trim().toLowerCase();
      if (HOUSE[key]) { house = HOUSE[key]; wikiName = l[1].trim(); break; }
    }
    if (!house) continue;
    const isMrp = /\bMRP\b/.test(chunk);

    // The fieldwork cell is the row's first header cell.
    let date = null;
    for (const l of chunk.split("\n")) {
      const c = l.match(/^!(.*)$/);
      if (!c) continue;
      const pipe = c[1].lastIndexOf("|");
      const d = endDate((pipe >= 0 ? c[1].slice(pipe + 1) : c[1]).trim(), year);
      if (d) { date = d; break; }
    }
    if (!date || date <= CYCLE_START) continue;
    waves.push({ date, house, wikiName, mrp: isMrp });
  }
  // The same wave can appear in more than one in-scope table.
  const seen = new Set(), out = [];
  for (const w of waves) {
    const k = `${w.house[0]}|${w.date}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(w);
  }
  return out;
}

// A house's own history is the only honest source for what "overdue" means:
// Roy Morgan is weekly, RedBridge monthly, Newspoll lumpy. Median gap over the
// recent waves, so one long summer break does not permanently raise the bar.
function cadence(dates) {
  if (dates.length < 4) return null;
  const recent = dates.slice(-10);
  const gaps = recent.slice(1).map((d, i) => daysBetween(recent[i], d)).filter((g) => g > 0).sort((a, b) => a - b);
  if (!gaps.length) return null;
  return gaps[Math.floor(gaps.length / 2)];
}

const status = { checked: todayLocal(), witness: "wikipedia", missing: [], overdue: [], houses: {}, witness_waves: 0, error: null };

try {
  const D = JSON.parse(readFileSync(OUT, "utf8"));
  const today = todayLocal();

  const byHouse = new Map();
  for (const p of D.polls) {
    if (p.pollster === "Election Result") continue;
    if (!byHouse.has(p.pollster)) byHouse.set(p.pollster, []);
    byHouse.get(p.pollster).push(p.date);
  }
  for (const [, v] of byHouse) v.sort();

  // ---- cadence check (no network) ----------------------------------------
  for (const [house, dates] of [...byHouse].sort()) {
    const last = dates[dates.length - 1];
    const med = cadence(dates);
    const since = daysBetween(last, today);
    status.houses[house] = { waves: dates.length, last, cadence_days: med, days_since: since };
    // 1.8x the house's own median, plus a day's grace, before we call it late.
    if (med != null && since > med * 1.8 + 1) {
      status.overdue.push({ house, last, days_since: since, cadence_days: med });
    }
  }

  // ---- witness check (Wikipedia) -----------------------------------------
  const text = await fetchWiki();
  const waves = parseWitness(text);
  status.witness_waves = waves.length;
  if (waves.length < 20) throw new Error(`witness parsed only ${waves.length} waves — table layout may have changed`);

  for (const w of waves) {
    // An MRP is a different product from the same house and the tracker keeps
    // it under its own "(MRP)" pollster, so match it against that variant
    // rather than reporting every MRP as a missing headline poll.
    const names = w.mrp
      ? w.house.filter((h) => /\(MRP\)/.test(h)).concat(w.house.filter((h) => !/\(MRP\)/.test(h)))
      : w.house.filter((h) => !/\(MRP\)/.test(h));
    const tracked = names.flatMap((h) => byHouse.get(h) ?? []);
    if (!names.some((h) => byHouse.has(h))) continue; // house not tracked at all
    const near = tracked.some((d) => Math.abs(daysBetween(d, w.date)) <= DATE_SLACK_DAYS);
    if (!near) status.missing.push({ date: w.date, house: names[0], wiki: w.wikiName, mrp: w.mrp });
  }
  status.missing.sort((a, b) => (a.date < b.date ? 1 : -1));

  // A house can be past its own cadence for two very different reasons: we
  // stopped seeing its polls, or it stopped publishing them. The witness tells
  // them apart — if Wikipedia has nothing newer either, the house is quiet, not
  // missed, and waking someone for it would train them to ignore this.
  for (const o of status.overdue) {
    const newest = waves
      .filter((w) => w.house.includes(o.house) && w.date > o.last)
      .map((w) => w.date).sort().pop() ?? null;
    o.witness_newer = newest;
    o.verdict = newest ? "missed" : "house quiet (witness agrees)";
  }
} catch (e) {
  status.error = e.message;
  console.log("COVERAGE_STATUS " + JSON.stringify(status));
  if (!JSON_ONLY && !QUIET) console.error("coverage check inconclusive: " + e.message);
  process.exit(1);
}

if (!JSON_ONLY && !QUIET) {
  const n = status.missing.length, o = status.overdue.length;
  if (!n && !o) {
    console.log(`coverage: current — ${Object.keys(status.houses).length} houses, ${status.witness_waves} witness waves, nothing missing`);
  } else {
    if (n) {
      console.log(`coverage: ${n} wave${n === 1 ? "" : "s"} on Wikipedia that polls.json does not have —`);
      for (const m of status.missing.slice(0, 15)) console.log(`  ${m.date}  ${m.house}${m.mrp ? " (MRP)" : ""}`);
      if (n > 15) console.log(`  … and ${n - 15} more`);
    }
    if (o) {
      console.log(`coverage: ${o} house${o === 1 ? "" : "s"} overdue against their own cadence —`);
      for (const h of status.overdue) console.log(`  ${h.house}: last ${h.last}, ${h.days_since}d ago (usually every ~${h.cadence_days}d) — ${h.verdict}`);
    }
  }
}
// Leave the verdict on disk so build.mjs can report it without a network call
// of its own — a build should never depend on Wikipedia being reachable.
try {
  mkdirSync(".build/logs", { recursive: true });
  writeFileSync(".build/logs/coverage-latest.json", JSON.stringify(status, null, 2) + "\n");
} catch { /* the status line below is the real output */ }

console.log("COVERAGE_STATUS " + JSON.stringify(status));
// Only a wave the witness can see and we cannot is worth an alarm. A house that
// has genuinely gone quiet is reported above but must not fail the check, or
// every dormant pollster keeps the light permanently red.
const actionable = status.missing.length + status.overdue.filter((o) => o.witness_newer).length;
process.exit(actionable ? 3 : 0);
