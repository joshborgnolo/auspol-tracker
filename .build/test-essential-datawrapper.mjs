import assert from "node:assert/strict";
import { parseDatawrapperTable } from "./essential-datawrapper.mjs";

const fixture = "      Jul'26  Nov'26  Change\n" +
  "Strongly support        7%      5%      -2%\n" +
  "Somewhat support        21%     18%     -3%\n" +
  "Neither support nor oppose      27%     21%     -6%\n" +
  "Somewhat oppose 12%     12%     0%\n" +
  "Strongly oppose 24%     36%     11%\n" +
  "Unsure  9%      8%      0%";
const read = parseDatawrapperTable(fixture);
assert.equal(read.rows.length, 6);
assert.ok(read.rows.some((r) => r.ans === "Neither support, nor oppose"), "the comma variant maps to the existing answer");
assert.equal(new Set(read.rows.map((r) => r.ans)).size, 6, "each response appears exactly once");
assert.deepEqual(Object.values(read.previous), [7, 21, 27, 12, 24, 9]);
assert.deepEqual(Object.values(read.current), [5, 18, 21, 12, 36, 8]);
assert.ok(read.rows.every((r) => r.date === "2026-11-25" && r.vis === "Overall" && r.ds === "support_for_new_data_centre_being_built_in_local_area"));
assert.match(read.notes.join("; "), /Strongly oppose: printed change 11 but 24 -> 36 is 12/);
assert.match(read.notes.join("; "), /Unsure: printed change 0 but 9 -> 8 is -1/);
assert.match(read.source.article, /^https:\/\/www\.theguardian\.com\/australia-news\/2026\/nov\/25\//);
assert.throws(() => parseDatawrapperTable(fixture.replace("Nov'26", "Oct'26")), /unexpected current or previous period headings/);
assert.throws(() => parseDatawrapperTable(fixture.replace("Unsure  9%", "Unknown label  9%")), /unrecognised row/);
console.log("test-essential-datawrapper: ok");
