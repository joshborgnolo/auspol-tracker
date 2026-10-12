#!/usr/bin/env node
// Offline checks for demosau-seats.mjs: DemosAU MRP seat projections in both
// report layouts. The Feb–Mar 2026 report is the committed pdftotext under
// .build/demosau-src/; the May–Jul 2026 tables are its report's own lines
// (the layout the Aug–Sep 2026 report is expected to keep). Each must give
// the seats the site carries for that model.
import { readFileSync } from "node:fs";
import { parseSeats } from "./demosau-seats.mjs";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// May–Jul 2026: "Central Seat Projection" (Projection / Seat Change)
const julTables = [
  "\fCentral Seat Projection", "                                           Seat", "                  Party      Projection",
  "                                          Change", "                  Labor         68         -26",
  "                One Nation      60          60", "                 Coalition       13        -30",
  "                  Green          3          2", "                  Other          6          -6",
  "                                                   4", "\fRange of Seat Outcomes", "                         5",
  "\fSeat Clasifications", "                        TOTAL",
  "                                          Firm              Lean              In Doubt         Seat Range",
  "                       LEADING",
  "      Labor                68               40                18                  10               60-72",
  "   One Nation              60               27                25                  8                53-66",
  "    Coalition              13               4                  4                  5                11-22",
  "      Green                 3               0                  1                  2                  1-5",
  "      Other                 6               3                  0                  3                 3-7",
].join("\n");
// the 2026-07-11 DemosAU (MRP) row, entered by hand from the same report
eq("May–Jul 2026 layout: the row's seats exactly", parseSeats(julTables), { seats: { total: 150, basis: "2025 election", p: {
  alp: { est: 68, chg: -26, lo: 60, hi: 72 }, onp: { est: 60, chg: 60, lo: 53, hi: 66 }, lnp: { est: 13, chg: -30, lo: 11, hi: 22 },
  grn: { est: 3, chg: 2, lo: 1, hi: 5 }, oth: { est: 6, chg: -6, lo: 3, hi: 7 } } } });

// Feb–Mar 2026: "Projection: Seats Won" (MRP Estimate / 2025 Seats / Change)
const feb = parseSeats(readFileSync(".build/demosau-src/DemosAU-Federal-MRP-Model-FebMarch-2026-.txt", "utf8"));
eq("Feb–Mar 2026 layout still reads (Other on the 2025 result, CA and KAP inside it)", feb, { seats: { total: 150, basis: "2025 election", p: {
  alp: { est: 83, chg: -11, lo: 77, hi: 86 }, onp: { est: 52, chg: 52, lo: 46, hi: 55 }, lnp: { est: 9, chg: -34, lo: 9, hi: 17 },
  grn: { est: 1, chg: 0, lo: 0, hi: 3 }, oth: { est: 5, chg: -7, lo: 2, hi: 6 } } } });
eq("...and allocates the whole chamber", Object.values(feb.seats.p).reduce((a, b) => a + b.est, 0), 150);

eq("a report with no seat table says so", parseSeats("Primary Vote\n  Labor 27%\n").error, "no 'Projection: Seats Won' or 'Central Seat Projection' table");
eq("a table with too few parties is an error, not a partial projection",
  Object.keys(parseSeats("Central Seat Projection\n  Labor   84   -10\n  Coalition  34  -9\n")), ["error"]);

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("all demosau-seats checks pass");
