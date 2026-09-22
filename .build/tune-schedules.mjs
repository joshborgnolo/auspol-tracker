#!/usr/bin/env node
/* Schedule tuner — rewrites the poll updaters' cron windows from the houses'
   own recorded release times.

   Each house's caller workflow (.github/workflows/<house>-update.yml) used to
   carry a hand-written cron block, tuned once from whatever the release habit
   looked like the day it was written. Habits drift: Roy Morgan filed at
   16:17–16:30 when its block was written and 15:56 on 2026-09-21; the block
   didn't move, so the first check after that release was 40 minutes late. This
   script measures the habit afresh from data/polls.json — the `published`
   clock times the extractors stamp on every wave — and regenerates the block,
   so the schedule follows the house instead of the other way round.

   What it reads, per house (the same rules gen-data's "Next expected polls"
   uses, so the site and the scheduler never disagree about a house's habit):
     * weekday habit — a weekday that took >= CAD_DOW_SHARE of the last
       CAD_RECENT dated releases, over at least CAD_DOW_MIN of them; a declared
       pollsterRules.<house>.release.dow overrides the measurement, as it does
       on the site
     * release hours — the clock times of the last RECENT_TIMED releases on
       that weekday (all recent releases, for a house with no weekday). Two
       rows that share a publication minute are one release, not two.
     * pollsterRules.<house>.stopped — a stopped house keeps only a daily sweep

   What it writes, per workflow, between the two marker comments
   `# tune-schedules:begin` / `# tune-schedules:end` inside `on.schedule:`
   (everything outside the markers is hand-authored and left alone — the
   Essential skip-confirm slot, the DemosAU hourly pending gate):
     * release window (dense mode) — every DENSE_STEP minutes from PRE_ROLL
       before the EARLIEST recent release to TAIL after the latest habitual one
       (the single latest is set aside once there are enough samples, but the
       window still reaches 20 min past it). GitHub's scheduler runs late
       under load and skips the odd slot outright (it dropped the whole
       2026-09-14 Roy Morgan window), so the window is a comb, not a point.
     * sparse mode — the same window as three checks (start, +30 min past the
       end, +2.5 h past it), for a house whose EXTRACTOR lags the release:
       Newspoll's reads free secondary coverage, which trails the embargo by
       hours to days, so a 10-minute comb at the embargo would find nothing.
     * follow-ups — on the hour for FOLLOW_HOURS after the window, then a late-
       evening backstop; next day at the sweep hour and 19:00; and a daily sweep
       at the house's long-standing morning hour for off-pattern releases.
     * no weekday habit (DemosAU's calendar-month rhythm, Spectre's quarterly)
       — three daily checks bracketing the recent release hours, plus the sweep.

   Cron is UTC and the habit is eastern (Australia/Sydney, DST-observing), so
   the offset in force when the script runs is what converts them. That drifts
   by an hour at each DST change; schedule-tune.yml re-runs weekly for exactly
   that reason, and the header comment it writes records the offset used.

   Usage:
     node .build/tune-schedules.mjs            dry run — print each block + diff status
     node .build/tune-schedules.mjs --apply    rewrite the blocks in place
     node .build/tune-schedules.mjs --check    exit 1 if any block is out of date
     POLLS_JSON=<path>  read another dataset (tests); WORKFLOWS_DIR likewise.
     TUNE_NOW=<ISO instant>  pin the clock (tests: the offset and the header). */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---- policy ---------------------------------------------------------------
const CAD_RECENT = 12;        // dated releases the weekday habit is judged over
const CAD_DOW_MIN = 5;        // ...at least this many before a weekday can be a habit
const CAD_DOW_SHARE = 0.8;    // ...and the share of them that must share it
const RECENT_TIMED = 8;       // timed releases the hour window is measured over
const TRIM_MIN = 6;           // ...set the single latest aside once there are this many
const PRE_ROLL = 10;          // minutes before the earliest recent release the comb starts
const TAIL = 60;              // minutes past the trimmed-latest release it keeps combing
const RAW_TAIL = 20;          // ...and never less than this past the untrimmed latest
const DENSE_STEP = 10;        // comb spacing, minutes (GitHub's floor is 5)
const DENSE_MAX = 20;         // comb slots before the spacing widens
const FOLLOW_HOURS = 3;       // hourly follow-ups after the window
const LATE_BACKSTOP = "22:30";// evening backstop after the follow-ups
const NEXT_DAY_EVENING = "19:00";
const SPARSE_OFFSETS = [30, 150]; // minutes past the window end, sparse mode

const TZ = "Australia/Sydney";
const MARK_BEGIN = "# tune-schedules:begin";
const MARK_END = "# tune-schedules:end";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* One entry per caller workflow. `houses` are pollster names exactly as
   data/polls.json spells them (an MRP series is a different name and is
   deliberately not listed: a quarterly MRP would drag a monthly house's
   window). `sweep` is the house's long-standing daily morning check, kept as
   the catch-all; `mode` picks the window shape (see header); `step` widens
   the comb for an extractor whose run is expensive; `chaseOutliers: false`
   ends the comb at the trimmed-latest release instead of reaching past the
   single latest one; `phase` shifts every weekday slot by that many minutes.

   WHY PHASES: every writer shares one GitHub concurrency group
   (main-writers), and GitHub keeps at most ONE job waiting in a group — a
   third arrival CANCELS the older waiting one ("Canceling since a higher
   priority waiting request for main-writers exists"). Two houses combing
   the same evening on the same minutes therefore throw runs away, and
   nothing red says so. So workflows that share a weekday sit on different
   minutes, the daily sweeps are spread, and the audit below refuses to
   write a schedule in which three writers share a minute. */
const TARGETS = [
  { workflow: "roymorgan-update.yml", houses: ["Roy Morgan"], mode: "dense", sweep: "06:00", phase: 0 },
  { workflow: "resolve-update.yml", houses: ["Resolve"], mode: "dense", sweep: "07:00", phase: 0 },
  // each run is a ~10-minute full crawl of essentialreport.com.au and the
  // writers queue is serialised, so the comb is coarse and stops at the
  // habitual hour; the hourly follow-ups cover the occasional late file.
  // Its daily sweep sits AFTER the morning cluster: a 10-minute holder of
  // the writers queue in the middle of it is what got np-score cancelled.
  { workflow: "essential-update.yml", houses: ["Essential"], mode: "dense", sweep: "07:45",
    step: 30, chaseOutliers: false, phase: 0 },
  // shares its Sunday evening with Resolve: phased 5 min off Resolve's comb
  { workflow: "redbridge-update.yml", houses: ["RedBridge/Accent"], mode: "dense", sweep: "07:20",
    // evening PDF drops — the standing second daily check
    extraDaily: ["18:15"], phase: 5 },
  // secondary coverage lags the Sunday-evening embargo by hours to days
  { workflow: "newspoll-update.yml", houses: ["Newspoll"], mode: "sparse", sweep: "06:10", phase: 2 },
  // The Infogram watchdog: DETECTS a wave from the anonymous slug at the
  // embargo itself (a 10-second job), so it combs the habitual hour itself
  // — figures land through the extractor, not here.
  { workflow: "newspoll-watch.yml", houses: ["Newspoll"], mode: "watch", phase: 4 },
  // fortnightly Wednesday ~05:00; Essential's Wednesday comb ends by ~02:00
  { workflow: "news24-update.yml", houses: ["YouGov"], mode: "dense", sweep: "06:20", phase: 3 },
  // the daily 07:05 sweep stays hand-authored in the file (the run gate
  // names its cron string), so the tuner adds the bracketing checks only
  { workflow: "demosau-update.yml", houses: ["DemosAU"], mode: "dense" },
  { workflow: "spectre-update.yml", houses: ["Spectre Strategy"], mode: "dense", sweep: "06:50" },
  { workflow: "foxhedgehog-update.yml", houses: ["Fox & Hedgehog"], mode: "dense", sweep: "06:35" },
];

// ---- helpers --------------------------------------------------------------
const hm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const toMins = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const medianOf = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const floorTo = (m, step) => Math.floor(m / step) * step;
const ceilTo = (m, step) => Math.ceil(m / step) * step;

/* Eastern offset (minutes east of UTC) in force at `now`. Intl is the only
   DST table node ships; the parts round-trip below is how a wall clock is
   read out of it without a date library. */
function easternOffsetMinutes(now) {
  const f = new Intl.DateTimeFormat("en", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((local - now.getTime()) / 60000);
}

// ---- measure the habit ----------------------------------------------------
function measure(data, house) {
  const rules = data.pollsterRules?.[house] || {};
  // one release per publication minute (see gen-data's byHouse collapse)
  const seen = new Set();
  const releases = [];
  for (const p of data.polls) {
    if (p.pollster !== house || !p.published) continue;
    if (seen.has(p.published)) continue;
    seen.add(p.published);
    const clock = /T(\d{2}):(\d{2})/.exec(p.published);
    releases.push({
      pub: p.published,
      date: p.published.slice(0, 10),
      dow: new Date(p.published.slice(0, 10) + "T00:00:00Z").getUTCDay(),
      mins: clock ? +clock[1] * 60 + +clock[2] : null,
    });
  }
  releases.sort((a, b) => (a.pub < b.pub ? -1 : a.pub > b.pub ? 1 : 0));

  const decl = rules.release || null;
  const recentDated = releases.slice(-CAD_RECENT);
  const tally = {};
  for (const r of recentDated) tally[r.dow] = (tally[r.dow] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const measuredDow = recentDated.length >= CAD_DOW_MIN && top && top[1] / recentDated.length >= CAD_DOW_SHARE
    ? Number(top[0]) : null;
  const calMonth = !!decl?.month;
  const dow = calMonth ? null : (decl && decl.dow != null ? decl.dow : measuredDow);
  const dowEvidence = dow == null ? null
    : decl && decl.dow != null ? "declared in pollsterRules"
    : `${top[1]}/${recentDated.length} recent dated releases`;

  // the hour window: recent timed releases on the habit weekday (all of them
  // where there is no weekday to keep)
  const timedPool = releases.filter((r) => r.mins != null && (dow == null || r.dow === dow));
  const timed = timedPool.slice(-RECENT_TIMED);
  const declMins = decl && /^\d{1,2}:\d{2}$/.test(decl.time || "") ? toMins(decl.time) : null;
  let from = null, to = null, rawTo = null, span = null;
  if (timed.length) {
    const ms = timed.map((r) => r.mins).sort((a, b) => a - b);
    const trim = ms.length >= TRIM_MIN;
    /* The comb's start is the EARLIEST recent release, untrimmed: an early
       file is exactly what a schedule exists to catch, and one no-op slot is
       all a stray early reading costs. The end sets the single latest aside
       once there are enough samples. A house with no weekday to keep is
       bracketed daily, so there the start is trimmed too — DemosAU's record
       holds a midnight and an 8.30pm that would otherwise stretch three
       daily checks across the whole day. */
    from = trim && dow == null ? ms[1] : ms[0];
    rawTo = ms[ms.length - 1];
    to = trim ? ms[ms.length - 2] : rawTo;
    span = [ms[0], rawTo];
  } else if (declMins != null) {
    from = to = rawTo = declMins;
    span = [declMins, declMins];
  }
  return {
    house, stopped: !!rules.stopped, calMonth, dow, dowEvidence,
    from, to, rawTo, span, timedN: timed.length,
    timedFrom: timed.length ? timed[0].pub : null,
    timedTo: timed.length ? timed[timed.length - 1].pub : null,
    hourEvidence: timed.length ? `last ${timed.length} timed releases` : declMins != null ? "declared in pollsterRules" : null,
    median: timed.length ? medianOf(timed.map((r) => r.mins)) : declMins,
  };
}

// ---- lay out slots (eastern local) ----------------------------------------
/* A slot is { dow: 0-6 | null (daily), mins, label }. Labels are what the
   generated comments say; the same label on adjacent slots merges them. */
function layout(target, m) {
  const slots = [];
  const add = (dow, mins, label) => {
    if (mins < 0 || mins >= 1440) return; // fell off the day — the next-day/daily checks cover it
    slots.push({ dow, mins, label });
  };
  const daily = (hhmm, label) => add(null, toMins(hhmm), label);
  const notes = [];

  if (target.sweep) daily(target.sweep, "daily sweep");
  for (const t of target.extraDaily || []) daily(t, "daily sweep");

  if (m.stopped) {
    notes.push(`${m.house} is declared stopped (pollsterRules.stopped): daily sweep only`);
    return { slots, notes };
  }
  if (m.from == null) {
    notes.push(`${m.house}: no timed releases recorded and no declared hour — sweep only`);
    return { slots, notes };
  }

  const start = Math.max(0, floorTo(m.from - PRE_ROLL, DENSE_STEP));
  const chase = target.chaseOutliers !== false && m.dow != null;
  const end = Math.min(1439, ceilTo(chase ? Math.max(m.to + TAIL, m.rawTo + RAW_TAIL) : m.to + TAIL, DENSE_STEP));

  if (m.dow == null) {
    // no weekday: bracket the recent hours every day of the week
    add(null, start, "release hours (no weekday habit)");
    add(null, floorTo(m.median, DENSE_STEP), "release hours (no weekday habit)");
    add(null, end, "release hours (no weekday habit)");
    notes.push(`${m.house}: no weekday habit${m.calMonth ? " (calendar-month rhythm)" : ""} — daily checks at ${hm(start)}, ${hm(floorTo(m.median, DENSE_STEP))}, ${hm(end)}`);
    return { slots, notes };
  }

  const d = m.dow, next = (d + 1) % 7;
  const ph = target.phase || 0;
  const add0 = add;
  // every weekday slot from here on carries the workflow's phase
  const addP = (dow, mins, label) => add0(dow, mins + ph, label);
  if (target.mode === "watch") {
    // a detector, not an extractor: a 10-second job, so it can afford to sit
    // on the embargo itself and re-check every 20 min until just past the
    // latest habitual hour — nothing after that, the daily catch-all covers it
    for (let t = m.from; t <= m.to + 30; t += 20) addP(d, t, "watch: the habitual hour, every 20 min");
    return { slots, notes };
  }
  let lastSlot = start;
  if (target.mode === "dense") {
    let step = target.step || DENSE_STEP;
    while ((end - start) / step + 1 > DENSE_MAX) step += 5;
    for (let t = start; t <= end; t += step) { addP(d, t, `release window, every ${step} min`); lastSlot = t; }
  } else {
    addP(d, start, "release window (sparse: the extractor lags the release)");
    for (const off of SPARSE_OFFSETS) { lastSlot = ceilTo(end + off, DENSE_STEP); addP(d, lastSlot, "release window (sparse: the extractor lags the release)"); }
  }
  // follow-ups on the hour from the last comb slot, then the evening backstop
  const firstHour = ceilTo(lastSlot + 1, 60);
  for (let i = 0; i < FOLLOW_HOURS; i++) addP(d, firstHour + i * 60, "follow-up");
  const late = toMins(LATE_BACKSTOP);
  if (late > firstHour + (FOLLOW_HOURS - 1) * 60) addP(d, late, "late backstop");
  // next day — the morning check is the daily sweep's own minute (unphased,
  // so it folds into it), the evening one carries the phase
  add0(next, toMins(target.sweep || "06:00"), "next-day");
  addP(next, toMins(NEXT_DAY_EVENING), "next-day");
  return { slots, notes };
}

// ---- local slots → UTC cron lines ----------------------------------------
function toCron(slots, offset) {
  // de-dupe on (dow, mins), earliest label wins; drop weekday slots that a
  // daily slot already covers
  const dailyMins = new Set(slots.filter((s) => s.dow == null).map((s) => s.mins));
  const uniq = new Map();
  for (const s of slots) {
    if (s.dow != null && dailyMins.has(s.mins)) continue;
    const k = `${s.dow ?? "*"}|${s.mins}`;
    if (!uniq.has(k)) uniq.set(k, s);
  }
  // group by (utc hour, label) → minutes per dow-set
  const groups = new Map();
  for (const s of uniq.values()) {
    let u = s.mins - offset, dow = s.dow;
    if (u < 0) { u += 1440; if (dow != null) dow = (dow + 6) % 7; }
    if (u >= 1440) { u -= 1440; if (dow != null) dow = (dow + 1) % 7; }
    const hour = Math.floor(u / 60), min = u % 60;
    const key = `${dow ?? "*"}|${hour}|${s.label}`;
    const g = groups.get(key) || { dow, hour, label: s.label, mins: [], local: [] };
    g.mins.push(min);
    g.local.push({ dow: s.dow, mins: s.mins });
    groups.set(key, g);
  }
  // merge identical (hour, minutes, label) across weekdays into one line
  const merged = new Map();
  for (const g of groups.values()) {
    g.mins.sort((a, b) => a - b);
    const key = `${g.hour}|${g.mins.join(",")}|${g.label}`;
    const mg = merged.get(key) || { ...g, dows: [], local: [] };
    if (g.dow != null) mg.dows.push(g.dow);
    mg.local.push(...g.local);
    merged.set(key, mg);
  }
  const lines = [...merged.values()]
    .map((g) => {
      g.local.sort((a, b) => ((a.dow ?? -1) - (b.dow ?? -1)) || (a.mins - b.mins));
      const first = g.local[0], last = g.local[g.local.length - 1];
      const localDows = [...new Set(g.local.map((l) => l.dow))];
      const when = localDows[0] == null ? "daily"
        : localDows.map((x) => DOW[x]).join("/");
      const range = first.mins === last.mins ? hm(first.mins) : `${hm(first.mins)}–${hm(last.mins)}`;
      const dowField = g.dow == null ? "*" : g.dows.sort((a, b) => a - b).join(",");
      return {
        sortKey: [(localDows[0] ?? -1), first.mins],
        text: `- cron: '${g.mins.join(",")} ${g.hour} * * ${dowField}'`,
        comment: `${when} ${range} — ${g.label}`,
      };
    })
    .sort((a, b) => (a.sortKey[0] - b.sortKey[0]) || (a.sortKey[1] - b.sortKey[1]));
  const width = Math.max(...lines.map((l) => l.text.length)) + 1;
  return lines.map((l) => l.text.padEnd(width) + "# " + l.comment);
}

// ---- assemble a block -------------------------------------------------------
function blockFor(target, data, now) {
  const offset = easternOffsetMinutes(now);
  const offLabel = `UTC${offset >= 0 ? "+" : "-"}${Math.floor(Math.abs(offset) / 60)}${offset % 60 ? ":" + String(Math.abs(offset) % 60).padStart(2, "0") : ""}`;
  const ms = target.houses.map((h) => measure(data, h));
  const slots = [], notes = [];
  for (const m of ms) { const l = layout(target, m); slots.push(...l.slots); notes.push(...l.notes); }
  const header = [
    `${MARK_BEGIN} — generated by .build/tune-schedules.mjs; edit the recipe there,`,
    `# or add hand-authored slots after the end marker. Eastern ${offLabel} at generation.`,
  ];
  for (const m of ms) {
    const bits = [];
    if (m.stopped) bits.push("declared stopped");
    else {
      bits.push(m.dow == null ? (m.calMonth ? "no weekday (calendar-month rhythm)" : "no weekday habit")
        : `${DOW[m.dow]} habit (${m.dowEvidence})`);
      if (m.span) bits.push(`files ${hm(m.span[0])}–${hm(m.span[1])} eastern (${m.hourEvidence}${m.timedTo ? `, newest ${m.timedTo}` : ""})`);
      else bits.push("no timed releases");
    }
    header.push(`# ${m.house}: ${bits.join("; ")}`);
  }
  const lines = toCron(slots, offset);
  return { lines: [...header, ...lines, MARK_END], notes, measured: ms, offset };
}

// ---- splice into the workflow file --------------------------------------------
function splice(text, blockLines) {
  const lines = text.split("\n");
  const b = lines.findIndex((l) => l.trim().startsWith(MARK_BEGIN));
  const e = lines.findIndex((l) => l.trim() === MARK_END);
  if (b < 0 || e < 0 || e < b) return null;
  const indent = lines[b].match(/^\s*/)[0];
  const body = blockLines.map((l) => indent + l);
  return [...lines.slice(0, b), ...body, ...lines.slice(e + 1)].join("\n");
}

// ---- collision audit -------------------------------------------------------------
/* Every `- cron:` line in every writer workflow (a caller of poll-agent.yml
   or a member of the main-writers group), expanded to (utc weekday, hour,
   minute) keys. Returns the minutes three or more writers share — the ones
   GitHub will cancel a run on — and, for information, the pairs. */
function expandCron(expr) {
  const [mi, hr, , , dw] = expr.trim().split(/\s+/);
  const list = (f, max) => (f === "*" ? [...Array(max).keys()] : f.split(",").flatMap((x) => {
    const r = /^(\d+)-(\d+)$/.exec(x); return r ? Array.from({ length: +r[2] - +r[1] + 1 }, (_, k) => +r[1] + k) : [+x]; }));
  const keys = [];
  for (const d of list(dw, 7)) for (const h of list(hr, 24)) for (const m of list(mi, 60)) keys.push(`${d % 7}|${h}|${m}`);
  return keys;
}
export function auditCollisions(workflowsDir, overrides = {}) {
  const byKey = new Map();
  for (const f of readdirSync(workflowsDir).filter((x) => x.endsWith(".yml")).sort()) {
    const text = overrides[f] ?? readFileSync(join(workflowsDir, f), "utf8");
    if (!/group: main-writers|poll-agent\.yml/.test(text)) continue;
    for (const m of text.matchAll(/^\s*- cron: '([^']+)'/gm))
      for (const k of expandCron(m[1])) (byKey.get(k) || byKey.set(k, new Set()).get(k)).add(f);
  }
  const fmt = (k, ws) => { const [d, h, mi] = k.split("|").map(Number); return `${DOW[d]} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")} UTC — ${[...ws].join(", ")}`; };
  const triples = [], pairs = [];
  for (const [k, ws] of byKey) { if (ws.size >= 3) triples.push(fmt(k, ws)); else if (ws.size === 2) pairs.push(fmt(k, ws)); }
  return { triples: triples.sort(), pairs: pairs.sort() };
}

// ---- main ----------------------------------------------------------------------
export function tune({ data, workflowsDir, now, apply = false }) {
  const results = [];
  const proposed = {};
  for (const t of TARGETS) {
    const path = join(workflowsDir, t.workflow);
    const { lines, notes, measured } = blockFor(t, data, now);
    let status = "missing";
    let before = null, after = null;
    if (existsSync(path)) {
      before = readFileSync(path, "utf8");
      after = splice(before, lines);
      if (after == null) status = "no-markers";
      else if (after === before) status = "current";
      else status = "stale";
      if (after != null) proposed[t.workflow] = after;
    }
    results.push({ target: t, path, lines, notes, measured, status, after });
  }
  // the schedule as it WOULD be — nothing is written while three writers
  // share a minute anywhere in it (hand-authored slots included)
  const audit = auditCollisions(workflowsDir, proposed);
  if (apply && !audit.triples.length) {
    for (const r of results) if (r.status === "stale") { writeFileSync(r.path, r.after); r.status = "updated"; }
  }
  return Object.assign(results, { audit });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, "/"));
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply"), check = args.has("--check");
  const data = JSON.parse(readFileSync(process.env.POLLS_JSON || "data/polls.json", "utf8"));
  const workflowsDir = process.env.WORKFLOWS_DIR || ".github/workflows";
  const now = process.env.TUNE_NOW ? new Date(process.env.TUNE_NOW) : new Date();
  const results = tune({ data, workflowsDir, now, apply });
  let stale = 0, broken = 0;
  for (const r of results) {
    console.log(`\n== ${r.target.workflow}  [${r.status}]`);
    for (const n of r.notes) console.log(`   note: ${n}`);
    for (const l of r.lines) console.log("   " + l);
    if (r.status === "stale") stale++;
    if (r.status === "missing" || r.status === "no-markers") broken++;
  }
  const { triples, pairs } = results.audit;
  console.log(`\n== writers sharing a minute (main-writers keeps ONE job waiting; a third cancels it)`);
  for (const t of triples) console.log(`   COLLISION ${t}`);
  for (const p of pairs) console.log(`   pair      ${p}`);
  if (!triples.length && !pairs.length) console.log("   none");
  const summary = results.map((r) => `${r.target.workflow}=${r.status}`).join(" ");
  console.log(`\nTUNE_STATUS ${JSON.stringify({ stale, broken, apply, check, collisions: triples.length, offsetMinutes: easternOffsetMinutes(now), results: summary })}`);
  if (broken) { console.error("workflow files without tune-schedules markers — add them before running the tuner"); process.exit(2); }
  if (triples.length) { console.error(`refusing: ${triples.length} minute(s) with three or more writers scheduled — move a hand-authored slot or a phase`); process.exit(3); }
  if (check && stale) process.exit(1);
}
