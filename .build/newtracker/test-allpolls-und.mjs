import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const asset = `.build/newtracker/assets/${readdirSync(".build/newtracker/assets").find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"))}`;
const w = {};
new Function("window", readFileSync(asset, "utf8"))(w);
const D = w.AUSPOL;

assert.equal(typeof D.undecidedCellOf, "function");
assert.deepEqual(D.undecidedCellOf({ pollster: "Essential", undIn: 6, undecided: 4 }),
  { v: 6, included: true }, "a printed undecided-inclusive share wins over the two-party residue");
assert.deepEqual(D.undecidedCellOf({ pollster: "Newspoll", undecidedLeaner: 5 }),
  { v: 5, included: false }, "an after-leaner share is excluded from the printed party base");
assert.deepEqual(D.undecidedCellOf({ pollster: "Roy Morgan", undecided: 6.5, undecidedBasis: "first" }),
  { v: 6.5, included: false }, "a can't-say share is excluded from the printed party base");
assert.equal(D.undecidedCellOf({ pollster: "Resolve", undecided: 24, undecidedBasis: "soft" }), null,
  "soft support is not presented as an undecided share");
assert.equal(D.undecidedCellOf({ pollster: "Roy Morgan", undecided: null }), null,
  "absent stays absent, not zero");

const cells = D.individualPolls.map((p) => ({ p, u: D.undecidedCellOf(p) })).filter((r) => r.u);
assert.ok(cells.some((r) => r.u.included), "the archive has included UND cells");
assert.ok(cells.some((r) => !r.u.included), "the archive has excluded UND cells");
for (const { p, u } of cells) {
  assert.ok(Number.isFinite(u.v) && u.v >= 0 && u.v < 100, `${p.pollster} ${p.released}: valid UND share`);
  assert.equal(typeof u.included, "boolean");
}

const src = readFileSync(".build/newtracker/assets/rd-allpolls.jsx", "utf8");
assert.ok(src.indexOf('className="rd-ap-th rd-ap-undhead"') > src.indexOf('prims.map((k)'),
  "the UND header follows the party headers, with OTH last among them");
assert.ok(src.includes('und.included ? "included" : "excluded"'),
  "both desktop and phone read the same inclusion basis");

console.log(`PASS: UND cells preserve included/excluded bases (${cells.length} archive rows)`);
