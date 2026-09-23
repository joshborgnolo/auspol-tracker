/* Unit tests for the crosstab readers behind data/vote-switching.json and
   data/demographics.json – the parsers and gate in crosstab-parse.mjs, and
   crosstabOfHtml / decodeUx in crosstab-sources.mjs – against committed
   sources: a YouGov crosstab chart saved from e.infogram.com and the
   RedBridge report text extract-redbridge.mjs caches. Each layout a reader
   had to learn is pinned here. No network. Run: node .build/test-crosstabs.mjs */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT, crosstabOfHtml, decodeUx } from "./crosstab-sources.mjs";
import {
  switchingOf, ygGroup, youGovDims, demosLabel, redbridgeTable, resolveWaves,
  sharesProblem, dimsProblem, totalProblem,
} from "./crosstab-parse.mjs";
import { harmonize, DEMO_SETS, DEMO_SHARE } from "./newtracker/demo-groups.mjs";

const polls = JSON.parse(readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const poll = (house, date) => polls.find((p) => p.pollster === house && p.date === date);

// ---- YouGov: the 24 Aug 2026 crosstab --------------------------------------------
const t = crosstabOfHtml(readFileSync(path.join(ROOT, ".build/news24-src/ig-fixtures-2026-08-24/ig-YM46DvOTftyx9pNzV67y.html"), "utf8"));
assert.ok(t, "the crosstab sheet is found among the chart's sheets");
const d = youGovDims(t);
assert.deepEqual(d.total, { alp: 29, lnp: 21, onp: 26, grn: 12, oth: 12 }, "Total column, independents and Community Strong folded into oth");
assert.deepEqual(d.dims.gender.Men, { alp: 32, lnp: 23, onp: 24, grn: 10, oth: 10 });
// this wave headed its age columns "NET 18-34 | 35 - 49 | NET 50+"
assert.deepEqual(d.dims.age, {
  "18–34": { alp: 30, lnp: 12, onp: 15, grn: 26, oth: 17 },
  "35–49": { alp: 32, lnp: 19, onp: 26, grn: 13, oth: 10 },
  "50+": { alp: 27, lnp: 27, onp: 33, grn: 4, oth: 10 },
});
assert.deepEqual(d.dims.generation["Gen Z"], { alp: 33, lnp: 12, onp: 12, grn: 27, oth: 15 });
assert.deepEqual(d.dims.education.University, { alp: 32, lnp: 24, onp: 14, grn: 16, oth: 14 });
assert.equal(dimsProblem(d.dims), null, "every group passes the gate");
assert.equal(totalProblem(d.total, poll("YouGov", "2026-08-24")), null, "Total column matches the published primaries");
const s = switchingOf(t);
assert.deepEqual(s.rows.onp, { alp: 2, lnp: 4, onp: 90, grn: 1, ind: 0, oth: 2, "community-strong": 0 }, "2025 One Nation voters' row");
assert.deepEqual(Object.keys(s.rows).sort(), ["alp", "grn", "ind", "lnp", "onp", "oth"]);
assert.equal(sharesProblem(s.rows), null);

// every header style YouGov has used for these groups in 2026
const HEADERS = {
  "Age: 18-34": ["age", "18–34"], "Age: 35 - 49": ["age", "35–49"], "Age: 65+": ["age", "65+"],   // Feb–Mar
  "Age 18-34": ["age", "18–34"], "Age 50+": ["age", "50+"],                                        // Jun–Aug
  "NET 18-34": ["age", "18–34"], "35 - 49": ["age", "35–49"], "NET 50+": ["age", "50+"],           // 24 Aug
  "Aged 18-34": ["age", "18–34"], "Aged 35 - 49": ["age", "35–49"], "Aged 50+": ["age", "50+"],    // Sep on
  Male: ["gender", "Men"], Female: ["gender", "Women"],
  "Generation: GenZ": ["generation", "Gen Z"], "Generation: Boomer": ["generation", "Boomers"],
  "Gen Z": ["generation", "Gen Z"], Boomer: ["generation", "Boomers"], "Silent Generation": ["generation", "Silent"], // 24 Mar
  "Up to Year 12 education": ["education", "Year 12 or less"], "TAFE/College education": ["education", "TAFE or college"],
  "Tertiary Education": ["education", "University"],
  "Household income 100-149k": null, "Income: <100k": null, "Voted Labor in 2025": null, "Region: Rural": null, NSW: null,
};
for (const [h, want] of Object.entries(HEADERS)) assert.deepEqual(ygGroup(h), want, `header "${h}"`);

// ---- RedBridge: the first-preference table, read by its own column header ---------------
const RB_DIR = path.join(ROOT, ".build", "redbridge-src");
const rb = (month) => {
  const f = readdirSync(RB_DIR).find((x) => x.includes(`${month}-2026-federal-poll`) && x.endsWith(".txt"));
  assert.ok(f, `RedBridge ${month} 2026 text cached`);
  return redbridgeTable(readFileSync(path.join(RB_DIR, f), "utf8"));
};
// February: the Coalition as Liberal, Liberal National and National columns
const feb = rb("february");
assert.deepEqual(feb.columns, ["alp", "lnp", "lnp", "lnp", "onp", "grn", "oth"]);
assert.deepEqual(feb.total, { alp: 32, lnp: 19, onp: 28, grn: 12, oth: 9 });
assert.deepEqual(feb.dims.generation["Gen Z"], { alp: 30, lnp: 16, onp: 12, grn: 32, oth: 10 });
// April: a Country Liberal column as well
const apr = rb("april");
assert.deepEqual(apr.columns, ["alp", "lnp", "lnp", "lnp", "lnp", "onp", "grn", "oth"]);
assert.deepEqual(apr.dims.gender.Men, { alp: 35, lnp: 22, onp: 26, grn: 9, oth: 8 });
assert.deepEqual(apr.dims.education.University, { alp: 38, lnp: 23, onp: 16, grn: 12, oth: 11 });
// August: one Coalition column, respondent-allocated two-party columns and N after the parties
const aug = rb("august");
assert.deepEqual(aug.columns, ["alp", "lnp", "onp", "grn", "oth"]);
assert.deepEqual(aug.dims.gender.Women, { alp: 28, lnp: 20, onp: 29, grn: 14, oth: 9 });
assert.deepEqual(Object.keys(aug.dims), ["softness", "generation", "gender", "location", "education", "housing"]);
for (const [month, date] of [["february", "2026-02-27"], ["april", "2026-04-30"], ["may", "2026-05-28"],
                             ["june", "2026-06-26"], ["july", "2026-07-30"], ["august", "2026-08-28"]]) {
  const tb = rb(month);
  assert.equal(dimsProblem(tb.dims), null, `${month}: every group sums to about 100`);
  assert.equal(totalProblem(tb.total, poll("RedBridge/Accent", date)), null, `${month}: All voters row matches the published primaries`);
}
// a column it doesn't know is no table at all, never a guess
const odd = `First preference vote intention
                   Labor   Coalition   One Nation   Teals   Greens   Other
        All voters    29      22          28          5        10        6
    Gender
            Women     28      20          29          6        11        6`;
assert.equal(redbridgeTable(odd), null, "an unknown party column");

// ---- Resolve: decoding and the series ------------------------------------------------
assert.equal(decodeUx("2l"), 38);
assert.equal(decodeUx("2l.83"), 38.83, "the fraction rides verbatim");
assert.equal(decodeUx("31.88"), 22.88, "a value that looks plain is still obfuscated");
const enc = (v) => { const [i, f] = String(v).split("."); return (Number(i) ^ 123).toString(36) + (f ? "." + f : ""); };
const series = (pairs) => pairs.map(([date, v]) => ({ date, value: enc(v) }));
const q = { answers: [
  { answer: "ALP", age: [{ key: "age-18-34", timeseries: series([["12/04/2025", 40], ["14/09/2026", 28.5]]) }],
    gender: [{ key: "Male", timeseries: series([["14/09/2026", 27]]) }, { key: "QLD", timeseries: series([["14/09/2026", 99]]) }] },
  { answer: "IND", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 6]]) }], gender: [] },
  { answer: "OTH", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 4.25]]) }], gender: [] },
  { answer: "UND", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 9]]) }], gender: [] },
] };
const rw = resolveWaves(q);
assert.equal(rw.length, 1, "months before the term are dropped");
assert.equal(rw[0].date, "2026-09-14");
assert.deepEqual(rw[0].dims, { age: { "18–34": { alp: 28.5, oth: 10.25 } }, gender: { Men: { alp: 27 } } },
  "IND and OTH fold into oth; the stray QLD key and undecided are ignored");
// the Feb 2026 Ley scenario is a point in the series, not a poll
const scen = resolveWaves({ answers: [{ answer: "ALP", age: [], gender: [{ key: "Male", timeseries: series([["12/02/2026", 31], ["14/02/2026", 33]]) }] }] });
assert.deepEqual(scen.map((w) => w.date), ["2026-02-14"], "the 12 Feb 2026 Ley scenario is dropped");

// ---- DemosAU chart labels -------------------------------------------------------------
assert.equal(demosLabel("gender", "Males"), "Men");
assert.equal(demosLabel("gender", "Females"), "Women");
assert.equal(demosLabel("age", "18-34"), "18–34");
assert.equal(demosLabel("education", "TAFE / Trade"), "TAFE");

// ---- the gate --------------------------------------------------------------------------
assert.equal(sharesProblem({ Men: { alp: 50, lnp: 48 } }), null, "rounding passes");
assert.match(sharesProblem({ Men: { alp: 32, lnp: 13, onp: 4, grn: 2, oth: 28 } }), /sum to 79/, "a misread column fails");
assert.match(sharesProblem({ Men: { alp: NaN, lnp: 100 } }), /0 to 100/);
assert.match(sharesProblem({ Men: {} }), /0 to 100/);
assert.equal(dimsProblem({}), "no groups");
assert.equal(totalProblem({ alp: 30, onp: 29 }, { alp: 31, onp: 28 }), null, "a point of rounding passes");
assert.match(totalProblem({ alp: 30, onp: 26 }, { alp: 30, onp: 28 }), /onp total 26/);

// ---- the common groups the vote-by-group figures pool (newtracker/demo-groups.mjs) ----------
const sh = (alp, lnp, onp, grn, oth) => ({ alp, lnp, onp, grn, oth });
// YouGov: 18–34 joins; 35–49 and 50+ are other people and don't; the Silent generation doesn't
const yg = harmonize({ pollster: "YouGov", dims: {
  gender: { Men: sh(30, 20, 30, 10, 10), Women: sh(30, 20, 26, 14, 10) },
  age: { "18–34": sh(30, 12, 15, 26, 17), "35–49": sh(32, 19, 26, 13, 10), "50+": sh(27, 27, 33, 4, 9) },
  generation: { "Gen Z": sh(33, 12, 12, 27, 16), Boomers: sh(28, 30, 30, 4, 8), Silent: sh(25, 40, 25, 2, 8) },
  education: { "Year 12 or less": sh(26, 18, 34, 12, 10), "TAFE or college": sh(22, 17, 34, 10, 17), University: sh(30, 20, 20, 14, 16) },
} });
assert.deepEqual(Object.keys(yg.age), ["18–34"], "YouGov joins the age bands only at 18–34");
assert.deepEqual(Object.keys(yg.generation), ["Gen Z", "Boomers"], "the Silent generation has no common group");
assert.deepEqual(yg.education["TAFE or trade"], sh(22, 17, 34, 10, 17), "TAFE or college is TAFE or trade");
assert.deepEqual(Object.keys(yg.education), ["Year 12 or less", "TAFE or trade", "University"]);
// DemosAU: its bands match Resolve's; School and TAFE map across; a segment it left off is 0
const dm = harmonize({ pollster: "DemosAU", dims: {
  age: { "18–34": sh(31, 14, 16, 25, 14), "35–54": sh(28, 21, 27, 13, 11), "55+": sh(22, 26, 33, 6, 13) },
  education: { School: { alp: 26, lnp: 19, onp: 35, oth: 20 }, TAFE: sh(24, 20, 34, 11, 11), University: sh(30, 25, 18, 15, 12) },
} });
assert.deepEqual(Object.keys(dm.age), ["18–34", "35–54", "55+"]);
assert.deepEqual(dm.education["Year 12 or less"], sh(26, 19, 35, 0, 20), "School is Year 12 or less; a missing segment is 0");
// RedBridge: its two school rows merge 39:61
const rbH = harmonize({ pollster: "RedBridge/Accent", dims: {
  education: { "Below Year 12": sh(27, 25, 41, 3, 4), "Year 12": sh(28, 22, 17, 26, 7), "TAFE or trade": sh(26, 19, 37, 6, 12), University: sh(36, 26, 18, 13, 7) },
} });
const merged = rbH.education["Year 12 or less"];
for (const [k, want] of Object.entries({ alp: 27.61, lnp: 23.17, onp: 26.36, grn: 17.03, oth: 5.83 }))
  assert.ok(Math.abs(merged[k] - want) < 0.01, `RedBridge school rows merge 39:61 (${k} ${merged[k]})`);
// every common group has a population share for its sampling-error floor
for (const set of DEMO_SETS) for (const g of set.groups) assert.ok(DEMO_SHARE[g] > 0 && DEMO_SHARE[g] < 1, `share for ${g}`);

console.log("PASS: crosstab readers – YouGov crosstab, RedBridge tables (three layouts), Resolve series, the gate, the common groups");
