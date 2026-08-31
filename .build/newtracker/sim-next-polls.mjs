// Simulation of the "an unrecorded release holds its slot" rule, over the
// REAL pollCadence from the built data asset. Mirrors the shipped projection
// (a11e1559 npProject / window.AP.nextPolls) and the nav countdown's item
// derivation (d1a1d215 NextPollTicker) against mocked Sydney clocks, so a
// wave going late can be watched without waiting days for it:
//
//   - slot moment passes, tolerance open: panel counts to the window's edge,
//     ticker counts to the next landing day ("tomorrow" / "any moment now")
//   - tolerance out, release still unrecorded: BOTH show it, red, as
//     "N days overdue" – never rolled forward onto the next slot-week
//   - the release gets recorded: the projection re-anchors, the red clears
//   - a loose (window) house past its window's close: same overdue state,
//     counted from the edge, sorted to the panel's foot
//   - houses declared stopped in pollsterRules are absent from the data
//
// Run after a rebuild:  node .build/newtracker/build.mjs
//                       node .build/newtracker/sim-next-polls.mjs
// Exits non-zero if any expectation fails.

import { readFileSync } from "fs";

const src = readFileSync(new URL("./assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(src);
const D = window.AUSPOL;

const DAY = 86400000;
const NP_HORIZON_DAYS = 28;
const NP_UNTIMED_MINS = 24 * 60;
const NP_MAX_ROWS = 12;

// a Sydney calendar day + minutes past midnight – the app's own frame, so a
// scenario is written in wall-clock terms with no timezone arithmetic
const scen = (label, day, mins = 600) => ({
  label, t0: Date.parse(day + "T00:00:00Z"), nowMs: Date.parse(day + "T00:00:00Z") + mins * 60000,
});
const dayFloor = (ms) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// --- exact algorithm shipped in a11e1559 (npProject) ---
function spreadDays(c, sp) {
  return c.releaseDow != null && !c.loose ? 7 * Math.floor((sp + 3) / 7) : sp;
}
function project(cad, t0, nowMs) {
  const rows = [];
  const horizon = t0 + NP_HORIZON_DAYS * DAY;
  for (const c of cad) {
    const snap = (ms) => {
      if (c.releaseDow == null) return ms;
      let d = c.releaseDow - new Date(ms).getUTCDay();
      if (d > 3) d -= 7;
      if (d < -3) d += 7;
      return ms + d * DAY;
    };
    const due = (rel) => rel + (c.releaseMins == null ? NP_UNTIMED_MINS : c.releaseMins) * 60000;
    let field = Date.parse(c.last) + c.cadence * DAY;
    let release = dayFloor(snap(field + c.lag * DAY));
    const reaches = (rel, sp) => (c.loose ? rel - sp * DAY : rel) <= horizon;
    for (let i = 0; reaches(release, Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)))) && i < 12; i++) {
      const overdue = due(release) <= nowMs;
      const sp = Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)));
      const winHalf = spreadDays(c, sp);
      rows.push({
        ...c, field, release, overdue, ahead: i,
        spread: sp, winHalf,
        inDays: Math.round((release - t0) / DAY),
        opensIn: Math.round((release - winHalf * DAY - t0) / DAY),
        closesIn: Math.round((release + winHalf * DAY - t0) / DAY),
        missed: overdue && release + winHalf * DAY < t0,
      });
      if (overdue || c.loose) break;
      field += c.cadence * DAY;
      release = dayFloor(snap(field + c.lag * DAY));
    }
  }
  const first = (r) => (r.missed ? Infinity
    : r.loose ? r.release - r.spread * DAY
    : r.overdue ? r.release + (r.winHalf != null ? r.winHalf : r.spread) * DAY
    : r.release);
  rows.sort((a, b) => first(a) - first(b));
  rows.length = Math.min(rows.length, NP_MAX_ROWS);
  return rows;
}

// --- exact label rules shipped in a11e1559 (NextPollsPanel) ---
const when = (n) => (n === -1 ? "yesterday"
  : n < 0 ? `${-n} days overdue`
  : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const ago = (n) => (n === 0 ? "earlier today"
  : n === 1 ? "yesterday" : `${n} days ago`);
const panelWhen = (r) => (r.loose
  ? (r.missed ? when(r.closesIn) : r.opensIn <= 0 ? "open now" : "opens " + when(r.opensIn))
  : r.overdue && !r.missed
    ? `${when(r.closesIn)} (or ${ago(-r.inDays)})`
    : when(r.inDays));

// --- exact algorithm shipped in d1a1d215 (NextPollTicker) ---
const tnUntil = (ms) => {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return mins + (mins === 1 ? " min" : " mins");
  const h = Math.round(mins / 60);
  if (h < 36) return h + (h === 1 ? " hour" : " hours");
  const d = Math.round(h / 24);
  if (d < 14) return d + (d === 1 ? " day" : " days");
  const w = Math.round(d / 7);
  return w + (w === 1 ? " week" : " weeks");
};
function ticker(rows, t0, nowMs) {
  const targetOf = (r) => {
    const half = r.winHalf || 0;
    const earliest = r.release - half * DAY;
    if (r.releaseDow == null) return { at: Math.max(earliest, nowMs), byDay: false };
    let t = Math.max(t0, dayFloor(earliest));
    t += ((r.releaseDow - new Date(t).getUTCDay() + 7) % 7) * DAY;
    return { at: t, byDay: true };
  };
  const overdueItems = rows
    .filter((r) => r.missed)
    .map((r) => {
      const days = Math.round(
        (t0 - (r.loose ? r.release + (r.winHalf || 0) * DAY : r.release)) / DAY);
      return {
        firm: r.pollster, site: r.site, overdue: true, days,
        when: days === 1 ? "1 day overdue" : days + " days overdue",
      };
    })
    .sort((a, b) => b.days - a.days);
  const upcomingItems = rows
    .filter((r) => !r.missed)
    .map((r) => ({ r, t: targetOf(r) }))
    .sort((a, b) => a.t.at - b.t.at)
    .map(({ r, t }) => {
      const half = r.winHalf || 0;
      let when;
      if (t.byDay) {
        const days = Math.round((t.at - t0) / DAY);
        when = days === 0 ? (r.release <= nowMs ? "any moment now" : "today")
             : days === 1 ? "tomorrow"
             : tnUntil(days * DAY);
      } else {
        when = t.at <= nowMs ? "any moment now" : tnUntil(t.at - nowMs);
      }
      const maybe = when !== "any moment now" &&
        (half > 7 || !!r.loose ||
         (r.releaseDow != null && t.at - r.release > 7 * DAY) ||
         (r.releaseDow == null && half > 0));
      return { firm: r.pollster, when, maybe, site: r.site };
    });
  return [...overdueItems, ...upcomingItems].slice(0, 2);
}

// ---------------------------------------------------------------------------
const cad = JSON.parse(JSON.stringify(D.pollCadence));
const firm = (rows, name) => rows.find((r) => r.pollster === name);
const fmtT = (items) => items.map((i) =>
  `${i.firm} ${i.when}${i.maybe ? " (maybe)" : ""}${i.overdue ? " [overdue]" : ""}`).join(" | ");

let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
}

// the rebuilt data keeps every house bar the hand-declared stops
{
  const firms = cad.map((c) => c.pollster);
  eq("Essential is on the projection", firms.includes("Essential"), true);
  eq("Fox & Hedgehog declared stopped → absent", firms.includes("Fox & Hedgehog"), false);
  eq("Freshwater declared stopped → absent", firms.includes("Freshwater"), false);
}

// S1 – Tue 1 Sep, 2pm: Essential's slot (Wed 26 Aug 1am) passed 6 days ago,
// its ±1-week tolerance closes tomorrow. Panel reads "tomorrow (or 6 days
// ago)", ticker counts to tomorrow.
{
  const { label, t0, nowMs } = scen("Tue 1 Sep", "2026-09-01", 840);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("Essential overdue, tolerance open", [es && es.overdue, es && es.missed], [true, false]);
  eq("panel reads to the edge with the slot after 'or'", es && panelWhen(es), "tomorrow (or 6 days ago)");
  eq("ticker item 1", items[0] && [items[0].firm, items[0].when, !!items[0].overdue], ["Essential", "tomorrow", false]);
}

// S2 – Wed 2 Sep, 3am: the tolerance edge is today. The wave could be in the
// writing; ticker says so rather than counting to next Wednesday.
{
  const { label, t0, nowMs } = scen("Wed 2 Sep 3am", "2026-09-02", 180);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  eq("Essential still not missed", firm(rows, "Essential").missed, false);
  eq("ticker item 1", items[0] && [items[0].firm, items[0].when], ["Essential", "any moment now"]);
}

// S3 – Thu 3 Sep: tolerance out, release unrecorded. Red "8 days overdue",
// in BOTH places; the ticker leads with it and must NOT read "in 6 days"
// (the old silent roll to next Wednesday).
{
  const { label, t0, nowMs } = scen("Thu 3 Sep", "2026-09-03", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("Essential missed", es && es.missed, true);
  eq("panel red, counted from the slot", es && panelWhen(es), "8 days overdue");
  eq("missed row parks at the panel's foot", rows[rows.length - 1].pollster, "Essential");
  eq("ticker leads with the overdue wave", items[0] && [items[0].firm, items[0].when, !!items[0].overdue], ["Essential", "8 days overdue", true]);
  eq("no Essential countdown after it", items.some((i) => i.firm === "Essential" && !i.overdue), false);
  eq("no (maybe) on an overdue item", items[0] && "maybe" in items[0] ? items[0].maybe : false, false);
}

// S4 – Wed 9 Sep (a week later, unrecorded, and rebuilds have run): the old
// silence gate would have evicted Essential by now (1.5× cadence). It holds.
{
  const { label, t0, nowMs } = scen("Wed 9 Sep", "2026-09-09", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  eq("Essential still on the panel", !!firm(rows, "Essential"), true);
  eq("ticker still leads with it", items[0] && [items[0].firm, items[0].when], ["Essential", "14 days overdue"]);
}

// S5 – the poll is recorded (next build: Essential's last moves to 2 Sep).
// The projection re-anchors and the red clears by itself.
{
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "Essential").last = "2026-09-02";
  const { label, t0, nowMs } = scen("Thu 3 Sep, recorded", "2026-09-03", 600);
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("no missed rows anywhere", rows.every((r) => !r.missed), true);
  eq("Essential re-anchored to Wed 30 Sep", es && es.inDays, 27);
  eq("no overdue item in the ticker", items.every((i) => !i.overdue), true);
}

// S6 – Roy Morgan's Monday filing unrecorded by Tuesday midnight: "1 day
// overdue" immediately (a weekday house with a flat date has no tolerance).
{
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "Roy Morgan").last = "2026-08-24";
  const { label, t0, nowMs } = scen("Tue 1 Sep, Roy Morgan not in", "2026-09-01", 30);
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  eq("ticker item 1", items[0] && [items[0].firm, items[0].when, !!items[0].overdue], ["Roy Morgan", "1 day overdue", true]);
}

// S7 – Sat 10 Oct: DemosAU's loose window (13 Sep – 5 Oct) has closed
// unrecorded. It reads as overdue from the window's close, in both places,
// parked at the panel's foot rather than floating to the top as "open now".
// (Six weeks past the data clock every dated house is blown too, so the
// ticker's two slots go to the most-overdue pair; DemosAU's own item is
// checked on its row alone.)
{
  const { label, t0, nowMs } = scen("Sat 10 Oct", "2026-10-10", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const da = firm(rows, "DemosAU");
  eq("DemosAU missed", da && da.missed, true);
  eq("panel no longer says 'open now'", da && panelWhen(da), "5 days overdue");
  eq("missed rows park at the foot, cadence order", rows.slice(-2).map((r) => r.pollster), ["Essential", "DemosAU"]);
  eq("ticker order: most overdue first", items.map((i) => [i.firm, i.when]),
    [["Essential", "45 days overdue"], ["Roy Morgan", "33 days overdue"]]);
  const daItems = ticker(rows.filter((r) => r.pollster === "DemosAU"), t0, nowMs);
  eq("loose missed leads as overdue in the ticker", daItems[0] && [daItems[0].firm, daItems[0].when, !!daItems[0].overdue],
    ["DemosAU", "5 days overdue", true]);
}

console.log(fails ? `\n${fails} FAILED` : "\nall next-polls expectations held");
process.exit(fails ? 1 : 0);
