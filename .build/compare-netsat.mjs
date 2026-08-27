/* compare-netsat.mjs — READ-ONLY check: Newspoll net satisfaction from
   data/newspoll-leader-net-satisfaction.csv vs cycleApproval rows in
   data/polls.json. Prints discrepancies; writes nothing.
   Role mapping: cycle 2016 = Morrison(pm) v Shorten(opp);
   cycle 2019 = Morrison(pm) v Shorten then Albanese(opp);
   cycle 2022 = Albanese(pm) v Dutton(opp).
   CSV dates look like publication dates; tracker uses fieldwork-end dates,
   so matching tolerates a date window and reports the keying gap. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const FIRM = "Newspoll";
const DAY = 86400000, WINDOW = 7 * DAY;

// ---- load CSV ----------------------------------------------------------
const csv = fs.readFileSync(path.join(ROOT, "data", "newspoll-leader-net-satisfaction.csv"), "utf8").trim().split("\n");
const csvHead = csv[0].split(",").slice(1); // leader columns
const csvRows = [];
for (const line of csv.slice(1)) {
  const [date, ...vals] = line.split(",");
  csvHead.forEach((leader, i) => {
    if (vals[i] !== "") csvRows.push({ leader, date, net: Number(vals[i]) });
  });
}

// ---- load tracker ------------------------------------------------------
const db = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const cycles = db.cycleApproval;
console.log("cycleApproval keys:", Object.keys(cycles).join(", "));
for (const [k, rows] of Object.entries(cycles)) {
  const np = rows.filter((r) => r.firm === FIRM);
  const ds = np.map((r) => r.date).sort();
  console.log(`  ${k}: ${rows.length} rows, ${np.length} ${FIRM}, ${ds[0]} -> ${ds.at(-1)}`);
}

// role map: which tracker {cycle, field} each CSV column maps to
function roleFor(leader, date) {
  if (leader === "bill_shorten") return date < "2019-05-18" ? ["2016", "oppNet"] : null;
  if (leader === "scott_morrison") {
    if (date < "2019-05-18") return ["2016", "pmNet"];
    if (date < "2022-05-21") return ["2019", "pmNet"];
    return null;
  }
  if (leader === "anthony_albanese") {
    if (date < "2022-05-21") return ["2019", "oppNet"];
    return ["2022", "pmNet"];
  }
  if (leader === "peter_dutton") return ["2022", "oppNet"];
  return null;
}

// ---- CSV -> tracker direction ------------------------------------------
const t = Date.parse.bind(Date);
const unmatchedCsv = [], valueMismatch = [], matched = [];
for (const row of csvRows) {
  const role = roleFor(row.leader, row.date);
  if (!role) { unmatchedCsv.push({ ...row, reason: "outside term coverage" }); continue; }
  const [cyc, field] = role;
  const cands = (cycles[cyc] ?? []).filter((r) => r.firm === FIRM && r[field] != null);
  let best = null;
  for (const r of cands) {
    const gap = Math.abs(t(r.date) - t(row.date));
    if (gap <= WINDOW && (!best || gap < best.gap)) best = { r, gap };
  }
  if (!best) { unmatchedCsv.push({ ...row, reason: `no ${FIRM} row near ${row.date} in cycle ${cyc}` }); continue; }
  matched.push({ csv: row, tracker: best.r, field, gapDays: Math.round(best.gap / DAY) });
  if (best.r[field] !== row.net) {
    valueMismatch.push({ leader: row.leader, csvDate: row.date, trackerDate: best.r.date, field, csvNet: row.net, trackerNet: best.r[field] });
  }
}

// ---- tracker -> CSV direction ------------------------------------------
const matchedTrackerKeys = new Set(matched.map((m) => m.tracker.date + "|" + m.field));
const unmatchedTracker = [];
for (const [cyc, field, leaders] of [["2016", "pmNet"], ["2016", "oppNet"], ["2019", "pmNet"], ["2019", "oppNet"], ["2022", "pmNet"], ["2022", "oppNet"]]) {
  for (const r of (cycles[cyc] ?? []).filter((r) => r.firm === FIRM && r[field] != null)) {
    if (!matchedTrackerKeys.has(r.date + "|" + field) && r[field] != null && !(field === "oppNet" && cyc === "2016" && r.date > "2019-05-17")) {
      // skip rows legitimately absent from CSV (e.g. 2016-cycle Turnbull-era, other opp leaders) unless in CSV window
      const inWindow = r.date >= "2019-01-01" && r.date <= "2024-07-07";
      if (inWindow) unmatchedTracker.push({ cycle: cyc, field, date: r.date, net: r[field] });
    }
  }
}

// ---- report -------------------------------------------------------------
const dateGaps = matched.filter((m) => m.gapDays > 0).map((m) => `${m.csv.leader} csv ${m.csv.date} vs tracker ${m.tracker.date} (${m.gapDays}d)`);
console.log("\n=== value mismatches (same poll, different net) ===");
console.log(valueMismatch.length ? valueMismatch.map((m) => `${m.leader}: csv ${m.csvDate}=${m.csvNet} vs tracker ${m.trackerDate} ${m.field}=${m.trackerNet}`).join("\n") : "none");
console.log("\n=== CSV readings with no matching tracker row ===");
console.log(unmatchedCsv.length ? unmatchedCsv.map((m) => `${m.leader} ${m.date} net ${m.net} — ${m.reason}`).join("\n") : "none");
console.log("\n=== tracker Newspoll readings (in CSV window) missing from CSV ===");
console.log(unmatchedTracker.length ? unmatchedTracker.map((m) => `cycle ${m.cycle} ${m.date} ${m.field}=${m.net}`).join("\n") : "none");
console.log("\n=== date keying gaps (publication vs fieldwork-end), matched pairs ===");
console.log(dateGaps.length ? dateGaps.join("\n") : "none");
console.log(`\nsummary: ${csvRows.length} CSV cells, ${matched.length} matched, ${valueMismatch.length} value mismatches, ${unmatchedCsv.length} CSV-only, ${unmatchedTracker.length} tracker-only, ${dateGaps.length} date-key differences`);
