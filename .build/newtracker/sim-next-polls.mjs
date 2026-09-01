// Simulation of the "an unrecorded release holds its slot" rule, over the
// REAL pollCadence from the built data asset. Runs the SHIPPED projection
// itself - .build/newtracker/assets/np-project.js, eval'd below, is the same
// window.AP.nextPolls the page runs - and mirrors the nav countdown's item
// derivation and the panel's label rules (d1a1d215 NextPollTicker and the
// a11e1559 labels - both unbaked JSX, not eval-safe) against mocked Sydney
// clocks, so a wave going late can be watched without waiting days for it:
//
//   - slot moment passes, tolerance open: panel counts to the window's edge,
//     ticker counts to the next landing day ("tomorrow" / "any moment now")
//   - tolerance out, release still unrecorded: BOTH show it, red, as
//     "N days overdue" – never rolled forward onto the next slot-week
//   - the release gets recorded: the projection re-anchors, the red clears
//   - a loose (window) house past its window's close: same overdue state,
//     counted from the edge, sorted to the panel's foot
//   - houses declared stopped in pollsterRules are absent from the data
//   - a slot confirmed ABSENT at the publisher (pollsterRules.skippedSlots,
//     written by .build/essential-confirm-skip.mjs after verifying the
//     publisher index the morning after) slips ONE WEEK for a dated house —
//     the only late slip Essential's record shows (28→35 days, never 56):
//     no overdue markers, no "(or N days ago)". polls.json carries a real
//     seed (Essential 2026-08-26), so S1-S4 exercise BOTH sides — the
//     slipped projection on the real row, and the pre-skip behaviour on a
//     copy with the seed stripped (cadHold).
//   - the slipped slot ALREADY is the house's measured late step (35 days),
//     so pmLabel/dayAlt name no "(or +1 week)" alternative past it: the row
//     reads "tomorrow", never "tomorrow (or 8)"
//   - a slot MONTH confirmed absent at the publisher
//     (pollsterRules.skippedMonths, written by .build/demosau-confirm-skip.mjs)
//     slips the calendar-month slot ONE MONTH per confirmed month: no red,
//     no "open now" on a window verified never filed
//
// Run after a rebuild:  node .build/newtracker/build.mjs
//                       node .build/newtracker/sim-next-polls.mjs
// Exits non-zero if any expectation fails.

import { readFileSync } from "fs";

const src = readFileSync(new URL("./assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(src);
const D = window.AUSPOL;

// the shipped projection itself, eval'd like the data asset - NOT a copy.
// It reads window.AP.D at call time, so scenarios pass a mutated cadence
// table by reassigning window.AP.D for the duration of each projection.
window.AP = { D };
eval(readFileSync(new URL("./assets/np-project.js", import.meta.url), "utf8"));

const DAY = 86400000;
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

// --- the shipped projection (assets/np-project.js), with the panel-side row
// cap applied the way NextPollsPanel applies it (a11e1559 truncates rows)
function project(cad, t0, nowMs) {
  window.AP.D = { ...D, pollCadence: cad };
  const { rows } = window.AP.nextPolls({ day: t0, mins: (nowMs - t0) / 60000 });
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
    : when(r.inDays) + (dayAlt(r) || ""));
const npFmt = (ms) => {
  const d = new Date(ms);
  return `${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${D.monthName(d.getUTCMonth() + 1)}`;
};
const spreadLabel = (r) => {
  if (r.releaseDow == null) return ` ± ${r.spread} day${r.spread === 1 ? "" : "s"}`;
  const weeks = Math.floor((r.spread + 3) / 7);
  return weeks === 0 ? "" : ` ± ${weeks} week${weeks === 1 ? "" : "s"}`;
};
const pmLabel = (r) => {
  if (r.rolled) return "";
  if (r.releaseDow != null && r.spreadEarly != null) {
    const widen = Math.sqrt(r.ahead + 1);
    const earlyW = Math.floor((r.spreadEarly * widen + 3) / 7);
    const lateW = Math.floor((r.spreadLate * widen + 3) / 7);
    if (earlyW === 0 && lateW >= 1) return ` (or ${npFmt(r.release + lateW * 7 * DAY)})`;
    if (lateW === 0 && earlyW >= 1) return ` (or ${npFmt(r.release - earlyW * 7 * DAY)})`;
  }
  return spreadLabel(r);
};
const dayAlt = (r) => {
  if (r.rolled) return null;
  if (r.releaseDow != null && r.spreadEarly != null) {
    const widen = Math.sqrt(r.ahead + 1);
    const earlyW = Math.floor((r.spreadEarly * widen + 3) / 7);
    const lateW = Math.floor((r.spreadLate * widen + 3) / 7);
    if (earlyW === 0 && lateW >= 1) return ` (or ${r.inDays + lateW * 7})`;
    if (lateW === 0 && earlyW >= 1 && r.inDays - earlyW * 7 >= 1)
      return ` (or ${r.inDays - earlyW * 7})`;
  }
  return null;
};

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
    if (r.releaseDow == null)
      return { at: Math.max(r.release - half * DAY, nowMs), byDay: false };
    const widen = Math.sqrt((r.ahead || 0) + 1);
    const earlyHalf = r.spreadEarly != null
      ? 7 * Math.floor((r.spreadEarly * widen + 3) / 7)
      : half;
    let t = Math.max(t0, dayFloor(r.release - earlyHalf * DAY));
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
    .filter(((seen) => ({ r }) =>
      !seen.has(r.pollster) && !!seen.add(r.pollster))(new Set()))
    .map(({ r, t }) => {
      const half = r.winHalf || 0;
      let when;
      if (t.byDay) {
        const days = Math.round((t.at - t0) / DAY);
        when = days === 0 ? (r.release <= nowMs ? "any moment now" : "today")
             : days === 1 ? "tomorrow"
             : days + " days";
      } else {
        // no day pinned → "any day now"; "any moment now" is the dated
        // houses' word, for a slot whose moment has arrived TODAY
        when = t.at <= nowMs ? "any day now"
             : Math.round((t.at - nowMs) / 3600000) < 36
             ? tnUntil(t.at - nowMs)
             : Math.round((t.at - t0) / DAY) + " days";
      }
      const maybe = when !== "any moment now" && when !== "any day now" &&
        (half > 7 || !!r.loose ||
         (r.releaseDow != null && t.at - r.release > 7 * DAY) ||
         (r.releaseDow == null && half > 0));
      return { firm: r.pollster, when, maybe, site: r.site };
    });
  /* the shipped bar no longer slices the roll: the candidate list is one
     slot per house, nearest first, and how many show is a fit decision
     measured on the live bar (not simulated here - the screen is the
     budget, the sim only checks the roll's derivation and order) */
  return [...overdueItems, ...upcomingItems];
}

// ---------------------------------------------------------------------------
const cad = JSON.parse(JSON.stringify(D.pollCadence));
// the S1-S3 'hold the slot' behaviour, still reachable on the same data with
// the confirmed-skip seed stripped out of the Essential row
const cadHold = JSON.parse(JSON.stringify(D.pollCadence));
cadHold.find((c) => c.pollster === "Essential").skipped = [];
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

// S1 – Tue 1 Sep, 2pm. Essential's slot (Wed 26 Aug 1am) passed 6 days ago,
// unrecorded. cadHold shows what that used to mean: its ±1-week tolerance
// closes tomorrow, so the panel counts "tomorrow (or 6 days ago)" and the
// ticker counts to tomorrow. The REAL cadence row carries the agent's
// confirmed skip for 26 Aug, so the projection slips the slot ONE WEEK to
// the house's measured late step — Wed 2 Sep, tomorrow — instead of holding
// 26 Aug or leaping a second cadence to 23 Sep.
{
  const { label, t0, nowMs } = scen("Tue 1 Sep", "2026-09-01", 840);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("Essential not overdue, slipped to THIS week's Wed 2 Sep", [es && es.overdue, es && es.missed], [false, false]);
  eq("panel counts to tomorrow, no 'or' alternative", es && panelWhen(es), "tomorrow");
  // DemosAU's calendar-month window is the house's measured filing range,
  // the 9th to the 27th, so on the 1st it hasn't opened yet: Essential's
  // slipped slot leads, and DemosAU counts the days to its own range with
  // the loose-house hedge on
  eq("Essential's slipped slot leads the ticker", items[0] && [items[0].firm, items[0].when], ["Essential", "tomorrow"]);
  // the slipped slot already sits on the house's measured late step (35 days)
  // - the projection IS the alternative, so neither column may name a
  // further +1-week date (the "tomorrow (or 8)" / "(or Wed 9 Sep)" copy a
  // 42-day slot no Essential wave has ever filed on)
  eq("slipped slot rolls no further alternatives", es && [pmLabel(es), dayAlt(es)], ["", null]);
  // a house whose projection did NOT absorb a confirmed skip keeps the
  // honest one-sided tails: Resolve's slot is a week early of its measured
  // late step, so both columns still name it
  const rs = firm(rows, "Resolve");
  eq("un-rolled house still names its late alternative",
     rs && [pmLabel(rs), dayAlt(rs)], [" (or Sun 20 Sep)", " (or 19)"]);
  // the roll is every house's nearest slot, unsliced - on the live bar the
  // fit pass trims this to the room it actually has; the roll itself never
  // caps (a weekly house appears once, not twice inside the same week).
  // DemosAU's open (9 Sep) ties YouGov's slot to the minute; the cadence
  // sort put YouGov's row in first, so it wins the tiebreak
  eq("ticker is the full house roll, nearest slot each", items.map((i) => [i.firm, i.when]),
    [["Essential", "tomorrow"], ["Roy Morgan", "6 days"], ["YouGov", "8 days"],
     ["DemosAU", "8 days"], ["Resolve", "12 days"], ["Newspoll", "19 days"],
     ["RedBridge / Accent", "26 days"]]);
  {
    const da = firm(rows, "DemosAU");
    eq("DemosAU's window opens on the measured 9th, not the 1st", da && panelWhen(da), "opens in 8 days");
    eq("a day-count that wide keeps its hedge", items.find((i) => i.firm === "DemosAU").maybe, true);
  }
  // the hold-the-slot rule, still in force for any unconfirmed slot
  const holdRows = project(cadHold, t0, nowMs);
  const holdItems = ticker(holdRows, t0, nowMs);
  const esHold = firm(holdRows, "Essential");
  eq("without the skip seed: overdue, tolerance open", [esHold.overdue, esHold.missed], [true, false]);
  eq("without the skip seed: panel reads to the edge", panelWhen(esHold), "tomorrow (or 6 days ago)");
  eq("without the skip seed: Essential leads, overdue and counting", [holdItems[0].firm, holdItems[0].when], ["Essential", "tomorrow"]);
}

// S1c – Mon 14 Sep, 10am: DemosAU's window (9–27 Sep) opened five days ago.
// The wave is now due anywhere inside the range, so the bar says so - "any
// day now", the windowed houses' word; "any moment now" belongs to a dated
// house whose moment arrived today (S2's Essential, above).
{
  const { label, t0, nowMs } = scen("Mon 14 Sep", "2026-09-14", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const da = firm(rows, "DemosAU");
  eq("panel reads open, with the window underway", da && panelWhen(da), "open now");
  const daItem = items.find((i) => i.firm === "DemosAU");
  eq("ticker says any day now - not moment, not overdue, no hedge", [daItem.when, !!daItem.overdue, !!daItem.maybe],
    ["any day now", false, false]);
}

// S2 – Wed 2 Sep, 3am: the slipped slot itself expired an hour ago but the
// week of tolerance is still open (edge Wed 9 Sep), so Essential shows the
// overdue-but-counting face — the agent's daily 5am sweep either records
// this poll or confirms 2 Sep as absent too and slips again to 9 Sep.
{
  const { label, t0, nowMs } = scen("Wed 2 Sep 3am", "2026-09-02", 180);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  eq("Essential overdue, tolerance open to 9 Sep", [firm(rows, "Essential").overdue, firm(rows, "Essential").missed], [true, false]);
  eq("ticker item 1", items[0] && [items[0].firm, items[0].when], ["Essential", "any moment now"]);
}

// S3 – Thu 3 Sep: Wed 2 Sep went by unrecorded and UNCONFIRMED (the 5am
// sweep hasn't run yet), so Essential holds that slot's counting face:
// overdue, tolerance edge Wed 9 Sep still 6 days out, "in 6 days (or
// yesterday)". In reality the 05:02 cron confirms 2 Sep absent this morning
// and the projection slips to 9 Sep long before red — shown in the cadHold-
// style unconfirmed case here because the sim's data is frozen.
{
  const { label, t0, nowMs } = scen("Thu 3 Sep", "2026-09-03", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("Essential overdue, tolerance open to 9 Sep", [es && es.overdue, es && es.missed], [true, false]);
  eq("panel counts to the 9 Sep edge, slot was yesterday", es && panelWhen(es), "in 6 days (or yesterday)");
  eq("no red rows anywhere", rows.every((r) => !r.missed), true);
  eq("Essential on the ticker aiming at 9 Sep", items.some((i) => i.firm === "Essential" && i.when === "6 days"), true);
}

// S4 – Wed 9 Sep: the 2 Sep slot's tolerance edge closes today. Edge-day is
// not yet missed (missed needs edge strictly before today), so the counting
// face reads "today (or 7 days ago)"; from tomorrow it would hold red
// "7 days overdue" unless the agent has confirmed 2 Sep and slipped again.
{
  const { label, t0, nowMs } = scen("Wed 9 Sep", "2026-09-09", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const es = firm(rows, "Essential");
  eq("Essential on its tolerance edge, not yet missed", [es && es.overdue, es && es.missed], [true, false]);
  eq("panel reads to the edge day", es && panelWhen(es), "today (or 7 days ago)");
  eq("ticker keeps Essential live", items.some((i) => i.firm === "Essential"), true);
}

// S4b – after the 05:02 sweep confirms 2 Sep absent as well, the projection
// slips to Wed 9 Sep itself. The slot's own 1am moment is already past at
// 10am, so it's the due-day face: tolerance open to 16 Sep, panel counts to
// the edge, ticker says "any moment now" — but no red.
{
  const { label, t0, nowMs } = scen("Wed 9 Sep, 2 Sep confirmed too", "2026-09-09", 600);
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "Essential").skipped = ["2026-08-26", "2026-09-02"];
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  const es = firm(rows, "Essential");
  eq("both slots confirmed: due-day face, tolerance open", [es && es.overdue, es && es.missed], [true, false]);
  eq("panel counts to the 16 Sep edge", es && panelWhen(es), "in 7 days (or earlier today)");
  eq("ticker offers Essential", items.some((i) => i.firm === "Essential" && i.when === "any moment now"), true);
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

// S7 – Sat 10 Oct: DemosAU's calendar-month window (9–27 Sep) has closed
// unrecorded. It reads as overdue from the range's last day, in both places,
// parked at the panel's foot rather than floating to the top as "open now".
// (Six weeks past the data clock every house is blown, so the ticker's roll
// is nothing but red counts, most overdue first; DemosAU's own row is also
// checked on its own below.)
{
  const { label, t0, nowMs } = scen("Sat 10 Oct", "2026-10-10", 600);
  const rows = project(cad, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const da = firm(rows, "DemosAU");
  eq("DemosAU missed", da && da.missed, true);
  eq("panel no longer says 'open now'", da && panelWhen(da), "13 days overdue");
  eq("missed rows park at the foot, cadence order", rows.slice(-2).map((r) => r.pollster), ["Essential", "DemosAU"]);
  // Essential's slipped 2 Sep slot past its own edge too (the frozen sim data
  // can't run the 3 Sep confirmation that would have slipped it on), so it
  // leads the late roll, a week clear of Roy Morgan. DemosAU's window closed
  // on its measured 27th, so on 10 Oct it is thirteen days late, not ten.
  eq("ticker order: most overdue first, all houses kept", items.map((i) => [i.firm, i.when]),
    [["Essential", "38 days overdue"], ["Roy Morgan", "33 days overdue"],
     ["YouGov", "31 days overdue"], ["Resolve", "27 days overdue"],
     ["Newspoll", "20 days overdue"], ["RedBridge / Accent", "13 days overdue"],
     ["DemosAU", "13 days overdue"]]);
  const daItems = ticker(rows.filter((r) => r.pollster === "DemosAU"), t0, nowMs);
  eq("cal-month missed leads as overdue in the ticker", daItems[0] && [daItems[0].firm, daItems[0].when, !!daItems[0].overdue],
    ["DemosAU", "13 days overdue", true]);
}

// S8 – Mon 28 Sep, 10am: September's measured window (9–27) closed yesterday
// and the skip-confirm agent has verified the publisher lists no September
// wave, so skippedMonths rolls the slot to October's range. No red, no
// "open now" hanging on a month confirmed never filed - the row just counts
// to the next UNVERIFIED month, exactly as Essential's week-grain roll does.
{
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "DemosAU").skippedMonths = ["2026-09"];
  const { label, t0, nowMs } = scen("Mon 28 Sep, September confirmed absent", "2026-09-28", 600);
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const da = firm(rows, "DemosAU");
  eq("rolled to the October window, not red", da && [da.overdue, da.missed], [false, false]);
  eq("panel counts to the 9 Oct open", da && panelWhen(da), "opens in 11 days");
  eq("ticker offers the October open, hedged", items.find((i) => i.firm === "DemosAU") && [items.find((i) => i.firm === "DemosAU").when, items.find((i) => i.firm === "DemosAU").maybe], ["11 days", true]);
}

// S8b – the rolled window mid-flight, Mon 12 Oct: the roll lands a reader on
// the same open-window face an unrolled month would have shown.
{
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "DemosAU").skippedMonths = ["2026-09"];
  const { label, t0, nowMs } = scen("Mon 12 Oct, rolled window open", "2026-10-12", 600);
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  const da = firm(rows, "DemosAU");
  eq("rolled window reads open now", da && panelWhen(da), "open now");
  const daItem = items.find((i) => i.firm === "DemosAU");
  eq("ticker says any day now on the rolled window", daItem && [daItem.when, !!daItem.overdue, !!daItem.maybe],
    ["any day now", false, false]);
}

// S8c – Mon 5 Oct with BOTH September and October confirmed absent: the slot
// rolls to November, whose open (9 Nov) sits past the 28-day horizon, so the
// house simply leaves the roll until the horizon catches up with it - a real
// property of the dated houses' skip roll too (a rolled slot past the horizon
// was never rendered), not a new failure mode.
{
  const cad2 = JSON.parse(JSON.stringify(cad));
  cad2.find((c) => c.pollster === "DemosAU").skippedMonths = ["2026-09", "2026-10"];
  const { label, t0, nowMs } = scen("Mon 5 Oct, two months confirmed", "2026-10-05", 600);
  const rows = project(cad2, t0, nowMs);
  const items = ticker(rows, t0, nowMs);
  console.log(`\n${label}:  ticker → ${fmtT(items)}`);
  eq("rolled past the horizon: DemosAU off the panel", firm(rows, "DemosAU"), undefined);
  eq("rolled past the horizon: DemosAU off the ticker", items.some((i) => i.firm === "DemosAU"), false);
}

console.log(fails ? `\n${fails} FAILED` : "\nall next-polls expectations held");
process.exit(fails ? 1 : 0);
