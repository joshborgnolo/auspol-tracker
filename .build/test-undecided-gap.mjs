/* Pins the 1972–2004 undecided readings (data/undecided-gap-readings.json,
   merged by .build/assimilate-undecided-gap.mjs): every one quotes the
   figure it records, links its source, and is in the history; the merge is
   a no-op when re-run; and the terms they fill are modelled.
   Run: node .build/test-undecided-gap.mjs */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const R = JSON.parse(readFileSync("data/undecided-gap-readings.json", "utf8")).readings;
const W = JSON.parse(readFileSync("data/undecided-history.json", "utf8")).waves;
const M = JSON.parse(readFileSync("data/undecided-history-model.json", "utf8"));
const WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
/* OCR misreadings the quote keeps as printed */
const OCR = { "1980-06-22": /live percent/i };
const carries = (r) => {
  const q = r.quote.toLowerCase(), u = r.und;
  if (new RegExp(`(^|[^0-9.])${String(u).replace(".", "\\.")}([^0-9]|$)`).test(q)) return true;
  if (Number.isInteger(u) && new RegExp(`\\b${WORD[u]}\\b`).test(q)) return true;
  if (new RegExp(`(^|[^0-9])${100 - u}\\s*(per|%)`).test(q)) return true;
  if (r.house === "Newspoll") { /* uncommitted plus refused, the house's later convention */
    const m = q.match(/(\d+) percent "uncommitted".*?(\d+) percent "refused"/);
    if (m && +m[1] + +m[2] === u) return true;
  }
  return !!(OCR[r.end] && OCR[r.end].test(q));
};
for (const r of R) {
  const id = `${r.house} ${r.end}`;
  assert.ok(r.quote && carries(r), `${id}: the quote carries the figure ${r.und}`);
  assert.ok(/^https:\/\//.test(r.url), `${id}: a source link`);
  assert.ok(r.basis === "first" || r.basis === "leaner", `${id}: basis`);
  assert.ok(r.end >= "1972-01-01" && r.end < "2004-10-09", `${id}: inside 1972 – the 2004 election`);
  const w = W.find((x) => x.house === r.house && x.end === r.end);
  assert.ok(w && w.und === r.und && w.basis === r.basis && w.quote === r.quote, `${id}: merged into the history`);
}
const out = execFileSync(process.execPath, [".build/assimilate-undecided-gap.mjs"], { encoding: "utf8" });
assert.ok(out.includes(`${R.length} readings, 0 new, ${R.length} already present`), "re-running the merge is a no-op");
const term = (y) => M.terms.find((t) => t.year === y);
for (const y of [1974, 1975, 1977, 1980, 1983, 1984]) {
  const t = term(y);
  assert.ok(t && t.series.first && t.series.first.houses.includes("Morgan Gallup"), `term ${y}: a Morgan Gallup line`);
}
assert.ok(term(2004) && term(2004).series.leaner && term(2004).series.leaner.houses.includes("Newspoll"), "term 2004: a Newspoll line");
for (const y of [1998, 2001, 2004]) {
  const t = term(y);
  assert.ok(t && t.series.first && t.series.first.houses.includes("Roy Morgan"), `term ${y}: a Roy Morgan line`);
}
console.log(`test-undecided-gap: OK (${R.length} readings, terms 1974–84 and 1998–2004 modelled)`);
