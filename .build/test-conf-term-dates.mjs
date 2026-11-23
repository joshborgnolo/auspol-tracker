import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(".build/newtracker/assets/rd-hero.jsx", "utf8");
const marker = "function confTermDates(start, end)";
const start = source.indexOf(marker);
const end = source.indexOf("\n/* the terms on file", start);
assert(start >= 0 && end > start, "the shared closed-term formatter stays in rd-hero.jsx");
const confTermDates = new Function("confIsoMonth", source.slice(start, end) + "\nreturn confTermDates;")((iso) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
});
assert.equal(confTermDates("2022-05-21", "2025-05-03"), "May 2022–2025",
  "matching closing months do not repeat the month name");
assert.equal(confTermDates("2016-07-15", "2019-05-18"), "Jul 2016–May 2019",
  "different closing months retain the month name at both ends");
console.log("PASS: shared closed-term date formatting covers both compact and month-spanning labels");
