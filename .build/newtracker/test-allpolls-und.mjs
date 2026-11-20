import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const asset = `.build/newtracker/assets/${readdirSync(".build/newtracker/assets").find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"))}`;
const w = {};
new Function("window", readFileSync(asset, "utf8"))(w);
const D = w.AUSPOL;

assert.equal(typeof D.undecidedCellOf, "function");
assert.deepEqual(D.undecidedCellOf({ pollster: "Essential", undIn: 6, undecided: 4 }),
  { v: 6, included: true, label: "included" }, "a printed undecided-inclusive share wins over the two-party residue");
assert.deepEqual(D.undecidedCellOf({ pollster: "Newspoll", undecidedLeaner: 5 }),
  { v: 5, included: false, label: "excluded" }, "an after-leaner share is excluded from the printed party base");
assert.deepEqual(D.undecidedCellOf({ pollster: "Roy Morgan", undecided: 6.5, undecidedBasis: "first" }),
  { v: 6.5, included: false, label: "excluded" }, "a can't-say share is excluded from the printed party base");
assert.deepEqual(D.undecidedCellOf({ pollster: "EMRS (Tas)", undecidedLeaner: 3.2 }),
  { v: 3, included: false, label: "excluded" }, "EMRS's UND display rounds to the nearest half point (3.2 → 3), excluded");
assert.deepEqual(D.undecidedCellOf({ pollster: "Resolve", undecided: 24, undecidedBasis: "soft" }),
  { v: 0, included: null, label: "not allowed" }, "a forced-choice survey displays zero with no soft share treated as undecided");
assert.equal(D.undecidedCellOf({ pollster: "Roy Morgan", undecided: null }), null,
  "absent stays absent, not zero");

const cells = D.individualPolls.map((p) => ({ p, u: D.undecidedCellOf(p) })).filter((r) => r.u);
assert.ok(cells.some((r) => r.u.included), "the archive has included UND cells");
assert.ok(cells.some((r) => !r.u.included), "the archive has excluded UND cells");
assert.ok(cells.some((r) => r.u.label === "not allowed" && r.u.v === 0), "the archive has Resolve's forced-choice zero");
for (const { p, u } of cells) {
  assert.ok(u.v == null || (Number.isFinite(u.v) && u.v >= 0 && u.v < 100), `${p.pollster} ${p.released}: valid UND share`);
  assert.match(u.label, /^(included|excluded|not allowed)$/);
}
const mrps = cells.filter(({ p }) => p.pollster === "DemosAU (MRP)");
assert.equal(mrps.length, 4, "all four DemosAU MRP rows display their verified undecided treatment");
for (const { p, u } of mrps) {
  assert.equal(u.label, "excluded", `${p.released}: MRP shares regular DemosAU's exclusion basis`);
  assert.equal(u.v, null, `${p.released}: an unpublished remaining share stays a dash`);
}
assert.equal(D.pollBaseOf("DemosAU (MRP)", "primary"), D.pollBaseOf("DemosAU", "primary"),
  "the MRP sub-series uses the regular house's D+L sample base");
for (const file of [
  "DemosAU-OctNov-Federal-MRP-Report-FINAL-1.txt",
  "DemosAU-Federal-MRP-Model-FebMarch-2026-.txt",
  "DemosAU-Report-May-July-2026-MRP-Model-.txt",
  "DemosAU-Report-Aug-Sept-2026-MRP-Model-1.txt",
]) {
  const text = readFileSync(`.build/demosau-src/${file}`, "utf8").replace(/\s+/g, " ");
  assert.match(text, /How were undecided voters handled\?[\s\S]{0,350}(?:leaning|leaner)[\s\S]{0,200}excluded from final totals/i,
    `${file}: methodology explicitly asks a leaner and excludes remaining undecideds`);
}
for (const [d, v] of mrps.map(({ p }) => [p.released, p.undecidedLeaner ?? p.undecided ?? null]))
  assert.equal(v, null, `${d}: source and display agree that no remaining share is published`);

const src = readFileSync(".build/newtracker/assets/rd-allpolls.jsx", "utf8");
assert.ok(src.indexOf('className="rd-ap-th rd-ap-undhead"') > src.indexOf('prims.map((k)'),
  "the UND header follows the party headers, with OTH last among them");
assert.ok(src.includes('className="rd-ap-sub">{und.label}</span>'),
  "desktop cells read the shared inclusion or forced-choice label");
assert.ok(src.includes('<b>{rdApPrimFig(und.v)}</b>, {und.label}'),
  "phone metadata reads the same shared label");
for (const [released, display, source] of [["2026-08-18", 3, 3.2], ["2026-02-19", 4.5, 4.7]]) {
  const row = cells.find(({ p }) => p.pollster === "EMRS (Tas)" && p.released === released);
  assert.equal(row.u.v, display, `${released}: the UND table rounds to the nearest half point`);
  assert.equal(row.p.undecidedLeaner, source, `${released}: the ledger/source keeps its original precision`);
}
assert.ok(src.includes('title="Undecided share, rounded to the nearest half point'),
  "the header states the display rounding rule");

console.log(`PASS: UND cells preserve included, excluded and forced-choice bases (${cells.length} archive rows)`);
