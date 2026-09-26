/* issues.mjs – builds data/issues.json: what voters say matters (salience)
   and which party they think is best on each issue (ownership), per poll
   wave, as each pollster asks it. The Snapshot's Issues panel and its Info
   entry are drawn from this file.

   Runs itself: the RedBridge, Resolve and YouGov/News24 updaters call it
   after every new wave (non-fatal), and the weekly crosstabs-update
   workflow (.build/crosstabs-updater.sh) runs it too.
     RedBridge – the report text extract-redbridge.mjs caches
                 (.build/redbridge-src/). Salience: "which of the following
                 issues would be most important to you when deciding who will
                 receive your vote? Please rank your top 3" (14 issues). Best
                 party: "Which of the following do you believe is best able
                 to deal with…" (6 issues, 9 from March 2026). From April 2026
                 each report prints a summary table of both, for its own wave
                 and the one before – so March, whose report was never cached,
                 is read from April's. Before April the summaries are charts
                 only, and each issue's all-voters figure is read from its
                 table by group instead (4 to 6 issues a wave). Salience by
                 group (vote, generation, gender, place, education, home and
                 how firm the vote is) comes from those tables too.
     Resolve   – "Which party you think would perform best in each of these
                 areas", every month since April 2021 (18 areas), from
                 data/resolve-political-monitor.csv (extract-resolve-rpm.mjs
                 keeps it). One Nation joined the options in July 2026.
     YouGov    – the News24 Pulse chart "Which party is best at handling…",
                 read from Infogram when a wave's article carries it: charts
                 the News24 extractor records but doesn't read ("unmodelled")
                 are fetched and kept if they have its shape, plus
                 KNOWN_IG_ISSUES found by hand. Most waves carry none.
     Ipsos     – the Issues Monitor's national reports, cached as text by
                 extract-ipsos.mjs (.build/ipsos-src/), which the weekly
                 crosstabs run calls first. Salience: "What would you say are
                 the three most important issues facing Australia today?"
                 (three of 19, no ranks). Best party: "most capable of
                 managing" each of the month's five top issues, One Nation
                 an option from June 2026. Fieldwork dates and the effective
                 sample come from the month's methodology statement where
                 one is cached.
     DemosAU   – the report text extract-demosau.mjs caches
                 (.build/demosau-src/): "Which political party do you trust
                 more to handle the following issues?", asked in February
                 2026 (12 issues). Every cached report is read, so a wave
                 that asks it again joins by itself; the DemosAU updater
                 runs this script too.
   Shares are stored as published, each house's options as it offers them
   (see issues-parse.mjs for the keys). Nothing is saved on a guess: every
   row passes the gate in issues-parse.mjs, a wave printed twice (a report's
   own summary and the next report's previous-wave columns; an Ipsos month
   in its own report, the bound year and every later report's page 2) must
   agree within a point, and a report's tables by group must match its
   summary. A wave that fails stays pending and is retried every run; one
   pending STALE_DAYS after fieldwork closed is listed as `stale`, and the
   weekly run fails on it so a person (or agent-repair) looks. So does
   Ipsos gone quiet: no report for IP_QUIET_DAYS after the newest one's
   fieldwork closed.

   Usage: node .build/issues.mjs
   Last line: ISSUES_STATUS {"changed":…,"added":[…],"pending":[…],"stale":[…],"unknown":[…]} */
import fs from "node:fs";
import path from "node:path";
import { ROOT, IG } from "./crosstab-sources.mjs";
import { infographicDataOf } from "./infogram.mjs";
import {
  ISSUES, rbSalienceSummary, rbOwnershipSummary, rbGroupTables, resolveOwnership, ygIssuesOf,
  ipReports, ipStatement, IP_FIRST, daOwnership, salienceProblem, ownershipProblem,
} from "./issues-parse.mjs";

const OUT = path.join(ROOT, "data", "issues.json");
const RB = "RedBridge/Accent";
const FIRST_RB = "2025-12-01";          // the first report extract-redbridge.mjs cached this term
const FIRST_YG = "2026-08-01";          // News24 Pulse (Sky News Pulse pages need a browser)
const STALE_DAYS = 16;
/* Ipsos publishes about 3½ weeks after fieldwork closes, and a month's
   report can be later still over summer (December's came out in January):
   ninety days without a newer one means it stopped, or its page moved. */
const IP_QUIET_DAYS = 90;
const MATCH_DAYS = 4;                   // Resolve's series date sits a day or so off its poll row
/* YouGov issue charts found by hand in waves whose chart list the News24
   extractor no longer holds (its cache keeps only the newest wave). */
const KNOWN_IG_ISSUES = { "2026-08-24": "_/TBlBtAE3k0f4YBE6MIpF" };

const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const pending = [], unknown = new Set(), added = [], dropped = [];
const key = (w) => w.pollster + "|" + w.date;
const had = new Set([...(prev.salience || []), ...(prev.ownership || [])].map(key));
const rowOf = (house, date, days = 0) => {
  const ms = Date.parse(date);
  return polls.filter((p) => p.pollster === house && Math.abs(Date.parse(p.date) - ms) <= days * 864e5)
    .sort((a, b) => Math.abs(Date.parse(a.date) - ms) - Math.abs(Date.parse(b.date) - ms))[0] || null;
};
const base = (p, extra = {}) => ({ pollster: p.pollster, date: p.date, dateStart: p.dateStart ?? null,
  sample: p.sample ?? null, sampleEff: p.sampleEff ?? null, source: p.releaseUrl || p.url || null, ...extra });

// ---- RedBridge ----------------------------------------------------------------------
const rbDir = path.join(ROOT, ".build", "redbridge-src");
const reports = [];
for (const f of fs.existsSync(rbDir) ? fs.readdirSync(rbDir) : []) {
  if (!f.endsWith(".json")) continue;
  let j; try { j = JSON.parse(fs.readFileSync(path.join(rbDir, f), "utf8")); } catch { continue; }
  const txt = path.join(rbDir, f.replace(/\.json$/, ".txt"));
  if (!j.date || j.date < FIRST_RB || !fs.existsSync(txt)) continue;
  const t = fs.readFileSync(txt, "utf8");
  reports.push({ date: j.date, s: rbSalienceSummary(t), o: rbOwnershipSummary(t), g: rbGroupTables(t) });
}
reports.sort((a, b) => (a.date < b.date ? -1 : 1));
const rbRows = polls.filter((p) => p.pollster === RB && p.date >= FIRST_RB && !/MRP/.test(p.pollster));
const rbByMonth = (ym) => rbRows.filter((p) => p.date.slice(0, 7) === ym);

/* Every RedBridge figure, from every place it is printed, keyed by wave date:
   "sal|col" → [{ v, from }], so a wave printed twice can be checked. */
const seen = new Map();
const note = (date, k, v, from) => { const m = seen.get(date) || new Map(); (m.get(k) || m.set(k, []).get(k)).push({ v, from }); seen.set(date, m); };
const groups = new Map();               // date → { sal: { col: dims } }
for (const r of reports) {
  for (const u of [...(r.s?.unknown || []), ...(r.o?.unknown || []), ...r.g.unknown]) unknown.add(`RedBridge ${r.date}: ${u}`);
  // the summaries: this report's wave and, by its month, the one before
  const sides = [[r.s, "sal"], [r.o, "own"]];
  for (const [tbl, kind] of sides) {
    if (!tbl) continue;
    const [curYm, prevYm] = tbl.months;
    if (curYm !== r.date.slice(0, 7)) { pending.push(`${RB}|${r.date}: its ${kind} summary is headed ${curYm}`); continue; }
    const prevRows = rbByMonth(prevYm);
    for (const [k, [cur, before]] of Object.entries(tbl.issues)) {
      if (cur) note(r.date, kind + "|" + k, cur, `${r.date} summary`);
      if (before && prevRows.length === 1) note(prevRows[0].date, kind + "|" + k, before, `${r.date} summary (previous wave)`);
    }
  }
  // the tables by group: their all-voters rows, and the groups themselves
  for (const [kind, tabs] of [["sal", r.g.salience], ["own", r.g.ownership]]) {
    for (const [k, t] of Object.entries(tabs)) {
      if (t.total) note(r.date, kind + "|" + k, kind === "sal" ? { ...t.total, top3: t.total.r1 + t.total.r2 + t.total.r3 } : t.total, `${r.date} table by group`);
      if (kind === "sal" && Object.keys(t.dims).length) ((groups.get(r.date) || groups.set(r.date, {}).get(r.date))[k] = t.dims);
    }
  }
}
/* One wave's figures: every printing of each issue must agree (±1 on every
   cell, the rounding of two tables); the summary's cells win, being the
   house's own figure for the issue. A disagreement leaves the WAVE pending. */
const salience = [], ownership = [], salienceGroups = [];
const PRINT_TOL = 1;
for (const [date, m] of [...seen.entries()].sort()) {
  const p = rowOf(RB, date);
  if (!p) { pending.push(`${RB}|${date}: no poll row for the wave`); continue; }
  const sal = {}, own = {}, bad = [];
  for (const [kk, vs] of m.entries()) {
    const [kind, k] = kk.split("|");
    const first = vs.find((x) => /summary$/.test(x.from)) || vs[0];
    for (const x of vs) {
      const off = Object.keys(first.v).filter((q) => x.v[q] != null && Math.abs(x.v[q] - first.v[q]) > PRINT_TOL);
      if (off.length) bad.push(`${ISSUES[k]}: ${x.from} differs from ${first.from} on ${off.join(", ")}`);
    }
    const prob = kind === "sal" ? salienceProblem(first.v) : ownershipProblem(first.v);
    if (prob) { bad.push(`${ISSUES[k]} (${kind === "sal" ? "salience" : "best party"}): ${prob}`); continue; }
    (kind === "sal" ? sal : own)[k] = kind === "sal" ? { r1: first.v.r1, r2: first.v.r2, r3: first.v.r3, top3: first.v.top3 } : first.v;
  }
  if (bad.length) { pending.push(`${RB}|${date}: ${bad.slice(0, 3).join("; ")}`); continue; }
  const read = [...new Set([...m.values()].flatMap((vs) => vs.map((x) => (/summary/.test(x.from) ? "summary table" : "tables by group"))))];
  if (Object.keys(sal).length) salience.push(base(p, { read: read.join(" and "), question: "rank top 3 of 14", issues: sal }));
  if (Object.keys(own).length) ownership.push(base(p, { read: read.join(" and "), question: "best able to deal with",
    options: ["alp", "lnp", "onp", "grn", "equal", "none", "unsure"], issues: own }));
  const g = groups.get(date);
  if (g) {
    const gbad = [];
    for (const [k, dims] of Object.entries(g))
      for (const [d, gs] of Object.entries(dims))
        for (const [gname, v] of Object.entries(gs)) { const e = salienceProblem(v); if (e) gbad.push(`${ISSUES[k]} ${gname}: ${e}`); }
    if (gbad.length) pending.push(`${RB}|${date}: salience by group – ${gbad.slice(0, 3).join("; ")}`);
    else salienceGroups.push(base(p, { issues: g }));
  }
}
// a RedBridge wave read nowhere at all: pending until its report is cached
for (const p of rbRows) if (!seen.has(p.date)) pending.push(`${RB}|${p.date}: no report cached for the wave and no later report reprints it`);

// ---- Resolve ------------------------------------------------------------------------
try {
  const csv = fs.readFileSync(path.join(ROOT, "data", "resolve-political-monitor.csv"), "utf8");
  const rs = resolveOwnership(csv);
  for (const u of rs.unknown) unknown.add(`Resolve: ${u}`);
  for (const c of rs.clash) pending.push(`Resolve|${c.split(" ")[0]}: two labels for one item disagree (${c})`);
  const clashDates = new Set(rs.clash.map((c) => c.split(" ")[0]));
  const newest = rs.waves.length ? rs.waves[rs.waves.length - 1].date : null;
  for (const w of rs.waves) {
    if (clashDates.has(w.date)) continue;
    const p = rowOf("Resolve", w.date, MATCH_DAYS);
    /* An item that fails the gate is left out of its wave, not the wave out
       of the file: the series has old upstream defects (2023-02-19 carries
       5 for every option of two items). A defect in the NEWEST wave is
       pending as well, so a new one is retried and, if it lasts, alarms. */
    for (const [k, sh] of Object.entries(w.issues)) {
      const e = ownershipProblem(sh);
      if (!e) continue;
      delete w.issues[k];
      dropped.push({ pollster: "Resolve", date: w.date, issue: k, reason: e });
      if (w.date === newest) pending.push(`Resolve|${w.date}: ${ISSUES[k]}: ${e}`);
    }
    if (!Object.keys(w.issues).length) continue;
    ownership.push({ ...(p ? base(p) : { pollster: "Resolve", date: w.date, dateStart: null, sample: null, sampleEff: null, source: null }),
      seriesDate: w.date, read: "published series", question: "perform best in each of these areas",
      options: Object.values(w.issues).some((sh) => sh.onp != null) ? ["alp", "lnp", "onp", "oth", "unsure"] : ["alp", "lnp", "oth", "unsure"],
      ...(w.note ? { note: w.note } : {}), issues: w.issues });
  }
} catch (e) {
  pending.push(`Resolve: ${String(e.message || e).slice(0, 160)}`);
  for (const w of prev.ownership || []) if (w.pollster === "Resolve") ownership.push(w);
}

// ---- YouGov --------------------------------------------------------------------------
const ygRows = polls.filter((p) => p.pollster === "YouGov" && p.date >= FIRST_YG);
for (const p of ygRows) {
  const kept = (prev.ownership || []).find((w) => w.pollster === "YouGov" && w.date === p.date);
  if (kept) { ownership.push(kept); continue; }
  const ids = [];
  if (KNOWN_IG_ISSUES[p.date]) ids.push(KNOWN_IG_ISSUES[p.date]);
  const f = path.join(ROOT, ".build", "news24-src", `news24-${p.date}.json`);
  if (fs.existsSync(f)) {
    const ig = JSON.parse(fs.readFileSync(f, "utf8")).infogram || {};
    (ig.ids || []).forEach((id, i) => { if ((ig.kinds || [])[i] === "unmodelled") ids.push(id); });
  }
  for (const id of ids) {
    let data = null;
    try { data = infographicDataOf(await (await fetch(IG(id), { headers: { "User-Agent": "Mozilla/5.0" } })).text()); }
    catch { pending.push(`YouGov|${p.date}: chart ${id} didn't load`); continue; }
    const t = data && ygIssuesOf(data);
    if (!t) continue;
    for (const u of t.unknown) unknown.add(`YouGov ${p.date}: ${u}`);
    const bad = Object.entries(t.issues).map(([k, sh]) => { const e = ownershipProblem(sh); return e && `${ISSUES[k]}: ${e}`; }).filter(Boolean);
    if (bad.length) { pending.push(`YouGov|${p.date}: ${bad.slice(0, 3).join("; ")}`); break; }
    ownership.push(base(p, { source: IG(id).replace("?src=embed", ""), read: "published chart", question: t.question,
      options: ["alp", "lnp", "onp", "grn", "unsure"], issues: t.issues }));
    console.log(`YouGov|${p.date}: issues chart ${id} – ${Object.keys(t.issues).length} issues`);
    break;
  }
}

// ---- Ipsos -----------------------------------------------------------------------------
/* Every month from IP_FIRST, read from its own report: the 19 issues from
   page 2, the best party on the five top issues from page 1. Every printing
   of the month must agree within a point – page 1's five against page 2,
   the monthly report against the bound year, and each later report's page 2
   against the month's own column – or the month waits. */
const IP = "Ipsos";
const ipDir = path.join(ROOT, ".build", "ipsos-src");
const ipOwn = new Map(), ipReprint = new Map(), ipStat = new Map();
for (const f of fs.existsSync(ipDir) ? fs.readdirSync(ipDir).filter((x) => x.endsWith(".txt")).sort() : []) {
  const t = fs.readFileSync(path.join(ipDir, f), "utf8");
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(ipDir, f.replace(/\.txt$/, ".json")), "utf8")); } catch {}
  const st = ipStatement(t);
  if (st) { ipStat.set(st.ym, st); continue; }
  for (const r of ipReports(t)) {
    if (r.ym < IP_FIRST) continue;
    for (const u of r.unknown) unknown.add(`Ipsos ${r.ym}: ${u}`);
    (ipOwn.get(r.ym) || ipOwn.set(r.ym, []).get(r.ym)).push({ r, pdf: meta.pdf || null, bound: /REPORTS_\d{4}$/.test(f.replace(/\.txt$/, "")) });
    for (const [ym, v] of Object.entries(r.reprint)) (ipReprint.get(ym) || ipReprint.set(ym, []).get(ym)).push({ v, from: r.ym });
  }
}
let ipNewest = null;
for (const [ym, prints] of [...ipOwn.entries()].sort()) {
  // the month's own report before the bound year; of two copies, the one the page links last
  const main = prints.filter((p) => !p.bound).pop() || prints[0], r = main.r, st = ipStat.get(ym);
  const date = (st && st.end) || r.end || `${ym}-28`, dateStart = (st && st.start) || r.start || null;
  const bad = prints.flatMap((p) => p.r.problems);
  if (!bad.length) {
    for (const p of prints) {
      if (p === main) continue;
      for (const [k, v] of Object.entries(r.all)) if (p.r.all[k] == null || Math.abs(p.r.all[k] - v) > PRINT_TOL) bad.push(`${ISSUES[k]}: printed ${v} and ${p.r.all[k]}`);
      for (const [k, sh] of Object.entries(r.own)) for (const [q, v] of Object.entries(sh))
        if (p.r.own[k]?.[q] == null || Math.abs(p.r.own[k][q] - v) > PRINT_TOL) bad.push(`${ISSUES[k]} (best party, ${q}): printed ${v} and ${p.r.own[k]?.[q]}`);
    }
    for (const x of ipReprint.get(ym) || [])
      for (const [k, v] of Object.entries(x.v)) if (r.all[k] == null || Math.abs(r.all[k] - v) > PRINT_TOL) bad.push(`${ISSUES[k]}: ${r.all[k]} in its own report, ${v} in ${x.from}'s`);
    const n = Object.keys(r.all).length, sum = Object.values(r.all).reduce((a, b) => a + b, 0);
    // three issues each: the 19 shares make about 300
    if (n !== 19 || Math.abs(sum - 300) > 10) bad.push(`${n} issues summing to ${sum}, not 19 near 300`);
    for (const [k, v] of Object.entries(r.all)) { const e = salienceProblem({ top3: v }); if (e) bad.push(`${ISSUES[k]}: ${e}`); }
    for (const [k, sh] of Object.entries(r.own)) { const e = ownershipProblem(sh); if (e) bad.push(`${ISSUES[k]} (best party): ${e}`); }
  }
  if (!ipNewest || date > ipNewest) ipNewest = date;
  if (bad.length) { pending.push(`${IP}|${date}: ${[...new Set(bad)].slice(0, 3).join("; ")}`); continue; }
  const row = {
    pollster: IP, date, dateStart, sample: (st && st.sample) || r.sample || null, sampleEff: (st && st.sampleEff) || null, source: main.pdf,
    ...(st && st.end && (st.start !== r.start || st.end !== r.end)
      ? { note: `fieldwork dates from Ipsos's methodology statement; the report prints ${r.start} to ${r.end}` } : {}),
  };
  salience.push({ ...row, read: "report", question: "pick 3 of 19",
    issues: Object.fromEntries(Object.entries(r.all).map(([k, v]) => [k, { top3: v }])) });
  ownership.push({ ...row, read: "report", question: "most capable of managing",
    options: Object.values(r.own).some((sh) => sh.onp != null) ? ["alp", "lnp", "onp", "grn", "oth", "unsure", "none"]
      : ["alp", "lnp", "grn", "oth", "unsure", "none"], issues: r.own });
}

// ---- DemosAU ---------------------------------------------------------------------------
/* Its "trust more to handle" table, in whichever cached report prints one;
   the wave's dates and samples from its poll row. */
const DA = "DemosAU";
const daDir = path.join(ROOT, ".build", "demosau-src");
const daSeen = new Set();
for (const f of fs.existsSync(daDir) ? fs.readdirSync(daDir).filter((x) => x.endsWith(".txt")).sort() : []) {
  const tb = daOwnership(fs.readFileSync(path.join(daDir, f), "utf8"));
  if (!tb) continue;
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(daDir, f.replace(/\.txt$/, ".json")), "utf8")); } catch {}
  for (const u of tb.unknown) unknown.add(`DemosAU ${meta.date || f}: ${u}`);
  const p = meta.date ? rowOf(DA, meta.date) : null;
  if (!p) { pending.push(`${DA}|${meta.date || f}: no poll row for the wave`); continue; }
  if (daSeen.has(p.date)) continue;               // one wave, printed in two cached reports
  const bad = Object.entries(tb.issues).map(([k, sh]) => { const e = ownershipProblem(sh); return e && `${ISSUES[k]}: ${e}`; }).filter(Boolean);
  if (!Object.keys(tb.issues).length) bad.push("the trust table didn't read");
  if (bad.length) { pending.push(`${DA}|${p.date}: ${bad.slice(0, 3).join("; ")}`); continue; }
  daSeen.add(p.date);
  ownership.push(base(p, { read: "report", question: "trust more to handle",
    options: ["alp", "lnp", "onp", "grn", "unsure"], issues: tb.issues }));
}

// ---- write -----------------------------------------------------------------------------
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster));
for (const arr of [salience, ownership, salienceGroups]) arr.sort(byDate);
for (const w of [...salience, ...ownership]) if (!had.has(key(w)) && !added.includes(key(w))) added.push(key(w));
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const onFile = new Set([...salience, ...ownership].map(key));
const stale = pending.map((m) => m.split(":")[0]).filter((k) => k.includes("|") && !onFile.has(k)
  && daysAgo(k.split("|")[1]) > STALE_DAYS);
// Ipsos gone quiet – or never cached – is stale too: nothing newer will arrive by itself
if (!ipNewest || daysAgo(ipNewest) > IP_QUIET_DAYS) {
  pending.push(`${IP}|quiet: ${ipNewest ? `no report since the one whose fieldwork closed ${ipNewest}` : "no report cached"} – is extract-ipsos.mjs still finding the Issues Monitor page?`);
  stale.push(`${IP}|quiet`);
}
const doc = {
  _about: "What voters say matters, and which party they think is best on each issue, per poll wave, as each pollster asks it. salience[].issues[issue] = {r1, r2, r3, top3}: % ranking it first, second, third, and in their top three (RedBridge); {top3} alone where a house asks for three without ranking them (Ipsos). salienceGroups[].issues[issue][dim][group] = {r1, r2, r3, not}. ownership[].issues[issue] = % naming each option: alp, lnp (the Coalition; RedBridge's Liberal and National summed), onp, grn, oth (someone else), equal (all about equal), none, unsure – only the options that house offers. Issue keys in `issues`. Built by .build/issues.mjs – see its header for sources.",
  issues: ISSUES,
  salience, salienceGroups, ownership,
  // items left out of a wave because they failed the gate (see the header)
  dropped,
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next;
if (changed) { fs.writeFileSync(OUT + ".tmp", next); fs.renameSync(OUT + ".tmp", OUT); }
for (const m of pending) console.log("pending", m);
for (const u of unknown) console.log("unknown label", u, "– map it in issues-parse.mjs once checked");
console.log(`salience ${salience.length} waves, by group ${salienceGroups.length}, ownership ${ownership.length} (${[...new Set(ownership.map((w) => w.pollster))].join(", ")})`);
console.log("ISSUES_STATUS " + JSON.stringify({ changed, added: added.filter((k) => !k.startsWith("Resolve|")).concat(
  added.some((k) => k.startsWith("Resolve|")) ? [`Resolve (${added.filter((k) => k.startsWith("Resolve|")).length} waves)`] : []),
  pending: pending.map((m) => m.split(":")[0]), stale: [...new Set(stale)], unknown: [...unknown] }));
