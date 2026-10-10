// Coverage watchdog: answer "has the tracker missed a poll?" without trusting
// any single extractor to notice.
//
// WHY THIS EXISTS
// Every extractor's failure mode is silence. Roy Morgan's discovery walks its
// WordPress feed's x-wp-totalpages pagination but still stops 14 days behind
// the newest recorded wave (older releases are unreachable to it); Newspoll
// and YouGov skip by date and never re-check; a rotted parser and a quiet
// fortnight look identical from the outside. Nothing in the pipeline
// distinguishes "no new poll" from "we can no longer see new polls", and the
// first symptom is a week missing from the site.
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
// A THIRD, detection-only output: a pollster on the witness table that the
// tracker does not follow. The HOUSE map used to be where those rows died,
// which meant a brand-new pollster was invisible to every layer of the
// pipeline. parseWitness now reads the FIRM CELL of such a row — the next
// cell after the fieldwork date — for a wikilink or a plain-text firm name,
// and the checker emits the surviving candidates as status.first_contact
// plus a FIRST_CONTACT {json} line, ALWAYS unfiltered. Noise is cut at
// source: a chunk with no vote figures is an event annotation, not a poll
// row; a candidate naming any known house (linked aliases like
// [[Resolve (poll)|Resolve]], or unlinked firm cells like "Freshwater
// Strategy" on a client-linked row) is a labelling variant, not a new house.
// First-contact.yml's gate then applies seen-file suppression (fire-once per
// name) itself; emission here never reads the seen file, so the import
// agent's own diagnostic run of this script still shows its house. Unknown
// names never change the exit code: an untracked house is a first contact,
// not a gap.
//
// Usage: node .build/check-coverage.mjs [--json] [--quiet] [--wiki <file>]
//   exit 0 = everything current
//   exit 1 = could not fetch or parse the witness (check is inconclusive)
//   exit 3 = at least one gap or overdue house — deliberately distinct from
//            the extractors' 1/2 so a wrapper can tell a finding from a fault
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { melbourneDate } from "./melbourne-time.mjs";

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const QUIET = argv.includes("--quiet");
const WIKI_FILE = argv.includes("--wiki") ? argv[argv.indexOf("--wiki") + 1] : process.env.COVERAGE_WIKI_FILE || null;
// COVERAGE_POLLS swaps the tracker-data read — coverage-doctor's DOCTOR_POLLS
// fixture seam depends on it (the doctor runs this script in-process).
const OUT = process.env.COVERAGE_POLLS ?? "data/polls.json";
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
  "redbridge/accent": ["RedBridge/Accent", "Redbridge", "RedBridge/Accent (MRP)"],
  "redbridge": ["RedBridge/Accent", "Redbridge"],
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
// Melbourne-local date, not UTC and not the runner's local clock: CI slots
// fire in UTC, so an AEST/AEDT morning reads as the previous day, and a
// watchdog that reports yesterday invites exactly the doubt it exists to
// remove. Repo convention (per .build/melbourne-time.mjs) is that every
// "what day is it" question is asked in Australia/Melbourne.
const todayLocal = () => melbourneDate(new Date());

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

// The source URLs a row's <ref> tags give a wave — the first-contact import
// agent's starting links. Capped at 3; a wave rarely carries more.
function refsOf(chunk) {
  const out = [];
  for (const m of chunk.matchAll(/<ref\b[^>/]*>([\s\S]*?)<\/ref>/g)) {
    for (const u of m[1].matchAll(/https?:\/\/[^\s\]|}<>]+/g)) {
      const url = u[0].replace(/[.,;)]+$/, "");
      if (!out.includes(url)) out.push(url);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

// The text of a table cell line, with any rowspan/colspan attribute prefix
// stripped. <ref> tags go FIRST: their {{Cite …}} templates are full of
// `|param=` pipes, and a naive attribute cut at the last pipe slices into
// the citation and leaves `language=en-AU}}</ref>` as the "content". Then
// the attribute block and the content split at a `|`; the piped DISPLAY
// half of a wikilink ([[target|display]]) is a trap for a naive
// lastIndexOf, so the cut is the last `|` before the first `[[` when the
// cell is linked, else the last `|` outright.
function cellContent(line) {
  let s = line.replace(/^[!|]\s*/, "")
    .replace(/<ref\b[\s\S]*?(?:<\/ref>|$)/g, "")
    .replace(/<ref\b[^>]*\/>/g, "");
  const linkAt = s.indexOf("[[");
  const cut = linkAt >= 0 ? s.lastIndexOf("|", linkAt) : s.lastIndexOf("|");
  if (cut >= 0) s = s.slice(cut + 1);
  return s.trim();
}

// A firm name as the HOUSE map keys it: lowercase, whitespace collapsed,
// "&" read as "and" (the table writes "Fox & Hedgehog", the map keys
// "fox and hedgehog"), {{nbsp}}-style templates stripped.
const houseKey = (s) => s.toLowerCase()
  .replace(/\{\{[^{}]*\}\}/g, " ")
  .replace(/&/g, " and ")
  .replace(/\s+/g, " ").trim();

// The first-contact candidate name from a row's FIRM CELL — the cell after
// the fieldwork date. Linked cells yield the piped display text (or the
// target); a firm the table never linked (Freshwater's row links the News
// Corp client instead) yields the cell's plain text. Anything else — empty,
// markup wreckage over 60 chars — is no candidate at all.
function firmCandidate(cell) {
  let s = cell.replace(/<ref\b[\s\S]*?(?:<\/ref>|$)/g, "").replace(/<ref\b[^>]*\/>/g, "").replace(/\{\{[^{}]*\}\}/g, "").trim();
  const l = s.match(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/);
  if (!l) s = s.replace(/\[(?:https?:\/\/[^\s\]]+)\s*([^\]]*)\]/g, "$1").replace(/'''?/g, "").trim();
  const name = (l ? (l[2] ?? l[1]) : s).trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}

// Rows are chunks between |- separators. Only the voting-intention tables are
// in scope: a leadership or preferred-PM table repeats the same houses and
// dates and would double-count every wave.
function parseWitness(text) {
  // {{nowrap|…}} wraps many live date cells (every MRP row carries one), and
  // the date scan's lastIndexOf("|") cut then lands INSIDE the template and
  // leaves "29 Apr – 14 May}}" for endDate's anchored patterns to reject —
  // the row died silently. Unwrap the single-argument template up front;
  // {{efn|…}} and friends are left alone.
  text = text.replace(/\{\{\s*nowrap\s*\|([^{}]*)\}\}/gi, "$1");
  const waves = [], unknowns = [];
  let year = null, inVi = false;
  for (const chunk of text.split(/^\|-[^\n]*$/m)) {
    for (const h of chunk.matchAll(/^={2,4}\s*([^=]+?)\s*={2,4}\s*$/gm)) {
      const y = h[1].match(/\b(20\d\d)\b/);
      if (y) year = +y[1];
    }
    if (/\{\|/.test(chunk)) inVi = /Primary vote/i.test(chunk) && /2PP|Two-party.preferred/i.test(chunk);
    else if (/\|\}/.test(chunk)) inVi = false;
    if (!inVi) continue;

    // Pollster: the first wikilink that maps to a house we track, matched on
    // the link target OR its piped display text ([[Resolve (poll)|Resolve]],
    // [[The Sydney Morning Herald#resolve|Resolve Political Monitor]] — the
    // same house wearing client-side aliases). Failing that, the firm cell's
    // PLAIN text is tried — DemosAU's, RedBridge/Accent's and Freshwater's
    // cells are unlinked on the live table. Links are read only OUTSIDE
    // <ref> tags and the downstream client cell: the citation's own
    // publisher/work links ([[Nine Entertainment]], [[News Corp Australia]])
    // and the client column are not the pollster.
    const refStripped = chunk.replace(/<ref\b[\s\S]*?(?:<\/ref>|$)/g, "").replace(/<ref\b[^>]*\/>/g, "");
    const lines = refStripped.split("\n");
    let date = null, dateLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const c = lines[i].match(/^[!|](?![-}])(.*)$/);
      if (!c) continue;
      const pipe = c[1].lastIndexOf("|");
      const d = endDate((pipe >= 0 ? c[1].slice(pipe + 1) : c[1]).trim(), year);
      if (d) { date = d; dateLine = i; break; }
    }
    if (!date || date <= CYCLE_START) continue;
    let firmCell = null;
    for (let j = dateLine + 1; j < lines.length; j++) {
      if (/^[!|](?![-}])/.test(lines[j])) { firmCell = cellContent(lines[j]); break; }
    }
    let house = null, wikiName = null;
    for (const l of (firmCell ?? refStripped).matchAll(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g)) {
      const hk = houseKey(l[1]), hd = l[2] ? houseKey(l[2]) : null;
      if (HOUSE[hk] || (hd && HOUSE[hd])) {
        house = HOUSE[hk] ?? HOUSE[hd];
        wikiName = (l[2] ?? l[1]).trim();
        break;
      }
    }
    const firm = firmCell ? firmCandidate(firmCell) : null;
    /* "(MRP)" firm cells are plain text on the live table ("DemosAU (MRP)",
       "RedBridge/Accent (MRP)") and never match a HOUSE key as written, so
       the row fell into the first-contact branch — where isKnownName's
       substring suppression then swallowed it whole: neither a wave nor a
       surfaced name. Match the house on the firm name minus the
       parenthetical; isMrp below carries the variant. */
    if (!house && firm) {
      const base = firm.replace(/\s*\(MRP\)\s*$/i, "");
      const hit = HOUSE[houseKey(firm)] ?? (base !== firm ? HOUSE[houseKey(base)] : undefined);
      if (hit) { house = hit; wikiName = firm; }
    }
    const isMrp = /\bMRP\b/.test(chunk);

    if (!house) {
      /* First-contact candidate: only a row with vote figures is a poll
         row — the table's colspan event annotations ("X resigns as
         leader") carry a parseable date cell and party/person wikilinks
         but never a % figure, and were the false candidates here until
         this gate. The name is the firm cell's own — link display, link
         target, or plain text for a firm the table never linked. */
      if (/%/.test(chunk) && firm) unknowns.push({ name: firm, date, refs: refsOf(chunk) });
      continue;
    }
    waves.push({ date, house, wikiName, mrp: isMrp });
  }
  // The same wave can appear in more than one in-scope table. An MRP row and
  // a regular row of the one house on the one date are different products,
  // not dupes — the flag is part of the key.
  const seen = new Set(), out = [];
  for (const w of waves) {
    const k = `${w.house[0]}|${w.mrp ? "m" : "r"}|${w.date}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(w);
  }
  // Unknown names likewise dedupe to one entry per name, dates newest first.
  const byName = new Map(), unk = [];
  for (const u of unknowns) {
    const key = u.name.toLowerCase().replace(/\s+/g, " ");
    const cur = byName.get(key) ?? { name: u.name, dates: [], refs: [] };
    if (!cur.dates.includes(u.date)) cur.dates.push(u.date);
    for (const r of u.refs) if (!cur.refs.includes(r) && cur.refs.length < 3) cur.refs.push(r);
    byName.set(key, cur);
  }
  for (const u of byName.values()) {
    u.dates.sort().reverse();
    unk.push(u);
  }
  unk.sort((a, b) => (a.dates[0] < b.dates[0] ? 1 : -1));
  return { waves: out, unknowns: unk };
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

const status = { checked: todayLocal(), witness: "wikipedia", missing: [], overdue: [], houses: {}, witness_waves: 0, fallback_rows: 0, first_contact: [], error: null };

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
  /* Provisional rows the Poll Bludger fallback filed (D.fallbackPolls) —
     the SITE carries these waves, the house's own extractor does not. They
     never count as coverage here: a missing wave one of them covers is
     still reported, marked `provisional: true`, so the doctor can say "the
     page is whole, the pipeline is not" instead of either crying defect
     every morning or going quiet about a broken extractor. */
  const fallbackByHouse = new Map();
  for (const f of D.fallbackPolls || []) {
    if (!fallbackByHouse.has(f.pollster)) fallbackByHouse.set(f.pollster, []);
    fallbackByHouse.get(f.pollster).push(f.date);
  }
  status.fallback_rows = (D.fallbackPolls || []).length;
  const provisionallyCovered = (names, date) =>
    names.some((h) => (fallbackByHouse.get(h) ?? []).some((d) => Math.abs(daysBetween(d, date)) <= DATE_SLACK_DAYS));

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
  const { waves, unknowns } = parseWitness(text);
  status.witness_waves = waves.length;
  /* An unlinked pollster cell is plain text, so its row can never resolve
     through HOUSE — the candidate instead comes from the cell and the
     known-name suppression here absorbs that house's aliases: every HOUSE
     value variant, every HOUSE key ("freshwater strategy") the table
     writes unlinked, and every canonical house name. Substring either way
     ("Resolve" inside "The Sydney Morning Herald#resolve"-style leftovers
     is impossible in a firm cell, but "uComms for Capital Brief" should
     still surface — it does, no known name is a substring of it). */
  const known = new Set();
  const addKnown = (n) => { const k = houseKey(n); if (k) known.add(k); };
  for (const h of byHouse.keys()) addKnown(h);
  for (const variants of Object.values(HOUSE)) variants.forEach(addKnown);
  Object.keys(HOUSE).forEach(addKnown);
  const isKnownName = (name) => {
    const k = houseKey(name);
    for (const b of known) if (k.includes(b) || (k.length >= 4 && b.includes(k))) return true;
    return false;
  };
  status.first_contact = unknowns.filter((u) => !isKnownName(u.name));
  if (waves.length < 20) throw new Error(`witness parsed only ${waves.length} waves — table layout may have changed`);

  for (const w of waves) {
    /* An MRP is a different product from the same house and the tracker
       keeps it under its own "(MRP)" pollster, so ONLY that variant's rows
       can cover it — unioning the main series' dates in (as this used to)
       let a regular wave within the slack silently mask a missing MRP
       report. A wave whose house has no "(MRP)" variant in HOUSE has nothing
       to match against and skips, as untracked-MRP waves always have. */
    const names = w.mrp
      ? w.house.filter((h) => /\(MRP\)/.test(h))
      : w.house.filter((h) => !/\(MRP\)/.test(h));
    if (!names.some((h) => byHouse.has(h))) continue; // house (or its MRP) not tracked at all
    const tracked = names.flatMap((h) => byHouse.get(h) ?? []);
    const near = tracked.some((d) => Math.abs(daysBetween(d, w.date)) <= DATE_SLACK_DAYS);
    if (!near) status.missing.push({ date: w.date, house: names[0], wiki: w.wikiName, mrp: w.mrp,
      ...(provisionallyCovered(names, w.date) ? { provisional: true } : {}) });
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
    if (newest && provisionallyCovered([o.house], newest)) o.provisional = true;
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
      // m.house already carries the "(MRP)" variant name when m.mrp is set
      for (const m of status.missing.slice(0, 15)) console.log(`  ${m.date}  ${m.house}${m.provisional ? "  (on the page provisionally, via the Poll Bludger fallback)" : ""}`);
      if (n > 15) console.log(`  … and ${n - 15} more`);
    }
    if (o) {
      console.log(`coverage: ${o} house${o === 1 ? "" : "s"} overdue against their own cadence —`);
      for (const h of status.overdue) console.log(`  ${h.house}: last ${h.last}, ${h.days_since}d ago (usually every ~${h.cadence_days}d) — ${h.verdict}`);
    }
  }
  if (status.first_contact.length) {
    console.log(`coverage: ${status.first_contact.length} pollster name${status.first_contact.length === 1 ? "" : "s"} on the witness table the tracker does not follow (first contact — not a gap):`);
    for (const u of status.first_contact) console.log(`  ${u.name} — newest wave ${u.dates[0]}${u.refs.length ? `  (${u.refs[0]})` : ""}`);
  }
}
// Leave the verdict on disk so build.mjs can report it without a network call
// of its own — a build should never depend on Wikipedia being reachable.
try {
  mkdirSync(".build/logs", { recursive: true });
  writeFileSync(".build/logs/coverage-latest.json", JSON.stringify(status, null, 2) + "\n");
} catch { /* the status line below is the real output */ }

// The first-contact line rides every run — even a quiet one — so the
// first-contact.yml gate has a stable parse target. Detection only: this
// list is NEVER filtered by .build/first-contact-seen.json (the gate owns
// suppression), and never feeds the exit code below.
console.log("FIRST_CONTACT " + JSON.stringify(status.first_contact));
console.log("COVERAGE_STATUS " + JSON.stringify(status));
// Only a wave the witness can see and we cannot is worth an alarm. A house that
// has genuinely gone quiet is reported above but must not fail the check, or
// every dormant pollster keeps the light permanently red.
const actionable = status.missing.length + status.overdue.filter((o) => o.witness_newer).length;
process.exit(actionable ? 3 : 0);
