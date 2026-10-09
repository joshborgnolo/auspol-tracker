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
  essentialWaves, essentialMatch,
  sharesProblem, dimsProblem, totalProblem,
} from "./crosstab-parse.mjs";
import { harmonize, DEMO_SETS, DEMO_SHARE } from "./newtracker/demo-groups.mjs";

const polls = JSON.parse(readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls;
const poll = (house, date) => polls.find((p) => p.pollster === house && p.date === date);
const demoWaves = JSON.parse(readFileSync(path.join(ROOT, "data", "demographics.json"), "utf8")).waves; // two-party sums are the whole point here; the data re-derives from the sources every regeneration, so leave the file in shape for them
const wave = (house, date) => demoWaves.find((w) => w.pollster === house && w.date === date);

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

// ---- YouGov: the 27 Jan 2026 crosstab (pre-switching-columns) -----------------
/* Sky News Pulse, before the 2025-vote columns: the sheet keys on
   National | Male | Female, "National" is the whole poll restated (the
   `total` youGovDims hands back), and the Coalition prints as its parties –
   lnp sums as the reads accumulate. */
const tj = crosstabOfHtml(readFileSync(path.join(ROOT, ".build/news24-src/ig-fixtures-2026-01-27/ig-B9xevRv6O7Od5O3AHCQi.html"), "utf8"));
assert.ok(tj, "the pre-switching crosstab sheet is found among the chart's sheets");
assert.equal(ygGroup("National"), null, "the National column is not a group");
const dj = youGovDims(tj);
assert.deepEqual(dj.total, { alp: 31, lnp: 20, onp: 25, grn: 12, oth: 12 },
  "the National column, Liberal + LNP + National summed to the poll row's 20");
assert.equal(totalProblem(dj.total, poll("YouGov", "2026-01-27")), null, "National matches the published primaries");
assert.deepEqual(dj.dims.gender.Men, { alp: 35, lnp: 20, onp: 25, grn: 9, oth: 11 });
assert.deepEqual(dj.dims.age["18–24"], { alp: 36, lnp: 13, onp: 8, grn: 32, oth: 11 });
assert.deepEqual(dj.dims.age["65+"], { alp: 23, lnp: 33, onp: 34, grn: 1, oth: 9 });
assert.deepEqual(Object.keys(dj.dims.age), ["18–24", "25–34", "35–49", "50–64", "65+"], "the young band split this wave only");
assert.deepEqual(dj.dims.location.Rural, { alp: 23, lnp: 20, onp: 35, grn: 9, oth: 13 });
assert.deepEqual(dj.dims.state.Qld, { alp: 33, lnp: 18, onp: 28, grn: 11, oth: 10 });
assert.deepEqual(dj.dims.income["$50–99k"], { alp: 29, lnp: 21, onp: 31, grn: 9, oth: 10 });
assert.equal(dimsProblem(dj.dims), null, "every group passes the gate");

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
  "Region: Inner metro": ["location", "Inner metro"], "Region:  Provincial": ["location", "Provincial"],     // Feb–May
  "Region: Rural": ["location", "Rural"],
  "Inner Metropolitan": ["location", "Inner metro"], "Outer Metropolitan": ["location", "Outer metro"],    // Mar on
  Provincial: ["location", "Provincial"], Rural: ["location", "Rural"],
  NSW: ["state", "NSW"], VIC: ["state", "Vic"], QLD: ["state", "Qld"], SA: ["state", "SA"], WA: ["state", "WA"],
  "ACT/NT/TAS": ["state", "ACT/NT/Tas"],                                                                  // Jun on
  "Own outright": ["housing", "Own outright"], Mortgage: ["housing", "Mortgage"], Rent: ["housing", "Renting"], // 24 Mar
  "Housing: Own outright": ["housing", "Own outright"], "Housing: Mortgage-holder": ["housing", "Mortgage"],
  "Housing: Renter": ["housing", "Renting"],                                                              // Apr–May
  "Own home outright": ["housing", "Own outright"], "Mortgaging home": ["housing", "Mortgage"],
  "Renting home": ["housing", "Renting"],                                                                 // Jun on
  "Only English spoken at home": ["language", "English only"], "Other language spoken at home": ["language", "Other language"],
  // household income: the four-bracket scheme, and the two-bracket scheme it
  // replaced mid-2026 – the brackets ride in the label so the facet's pair
  // naming stays honest about which scheme a wave printed
  "Household income <50k": ["income", "Under $50k"], "Household income 50-99k": ["income", "$50–99k"],
  "Household income 100-149k": ["income", "$100–149k"], "Household income 150k+": ["income", "$150k+"],
  "Income: <100k": ["income", "Under $100k"], "Income less than $100k": ["income", "Under $100k"],
  "Income more than $100k": ["income", "$100k or more"],
  // not read: the 2025 vote (the One Nation panel's), parental status
  // ("parent" is not "rent"), employment and class
  "Voted Labor in 2025": null,
  "No, I am neither a parent or guardian": null, "Parental Status: Yes, children <18": null,
  "Full time": null, Retired: null, "Class: Working class": null,
};
for (const [h, want] of Object.entries(HEADERS)) assert.deepEqual(ygGroup(h), want, `header "${h}"`);
// the 24 Aug wave's place, housing and language columns
assert.deepEqual(d.dims.state.Qld, { alp: 27, lnp: 22, onp: 34, grn: 10, oth: 7 });
assert.deepEqual(Object.keys(d.dims.state), ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas"]);
assert.deepEqual(d.dims.location.Rural, { alp: 18, lnp: 21, onp: 35, grn: 12, oth: 15 });
assert.deepEqual(d.dims.housing.Renting, { alp: 29, lnp: 8, onp: 27, grn: 21, oth: 16 });
assert.deepEqual(d.dims.language["Other language"], { alp: 34, lnp: 22, onp: 22, grn: 15, oth: 8 });
// … and its income columns, in the two-bracket scheme of the time
assert.deepEqual(d.dims.income, {
  "Under $100k": { alp: 26, lnp: 17, onp: 34, grn: 13, oth: 10 },
  "$100k or more": { alp: 30, lnp: 23, onp: 23, grn: 12, oth: 11 },
}, "24 Aug 2026 printed the two-bracket income scheme");
// a group printed as two columns: 21 Apr 2026 carried income twice
// ("Household income: <100k" and "Income: <100k", figures identical) – the
// first sighting of the pair stands, folded party rows untouched
const dupOf = (offset) => ({ head: ["", "Total", "Household income: <100k", "Income: <100k"], rows: [
  ["Labor", "30", "29", String(29 + offset)],
  ["Coalition", "20", "19", String(19 + offset)],
  ["One Nation", "28", "29", String(29 + offset)],
  ["The Greens", "12", "13", String(13 + offset)],
  ["Independent", "4", "4", String(4 + offset)],
  ["Other", "6", "6", String(6 + offset)],
] });
assert.deepEqual(youGovDims(dupOf(0)).dims.income,
  { "Under $100k": { alp: 29, lnp: 19, onp: 29, grn: 13, oth: 10 } }, "an identical copy reads once");
assert.match(sharesProblem(youGovDims(dupOf(2)).dims.income), /sum to/, "a copy that disagrees stays and trips the gate");

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
// December 2025 and January 2026: no "First preference vote intention"
// subtitle yet – the numbered-table title is the anchor, and the header's
// last cell is one combined "LABOR 2PP" (its Figure caption above must not
// anchor, nor the 2PP column read as a party)
const dec = redbridgeTable(readFileSync(path.join(RB_DIR, "afr,-redbridge-group-and-accent-research-federal-poll.txt"), "utf8"));
assert.deepEqual(dec.columns, ["alp", "lnp", "onp", "grn", "oth"], "Dec 2025: one Coalition column, then LABOR 2PP breaks");
assert.deepEqual(dec.total, { alp: 35, lnp: 26, onp: 17, grn: 13, oth: 9 });
assert.deepEqual(dec.dims.generation["Gen Z"], { alp: 30, lnp: 26, onp: 5, grn: 33, oth: 6 });
assert.deepEqual(dec.dims.education["Below Year 12"], { alp: 28, lnp: 31, onp: 26, grn: 10, oth: 5 });
assert.equal(dimsProblem(dec.dims), null, "Dec 2025: every group sums to about 100");
assert.equal(totalProblem(dec.total, poll("RedBridge/Accent", "2025-12-12")), null, "Dec 2025: All voters matches the poll row");
const jan = rb("january");
assert.deepEqual(jan.columns, ["alp", "lnp", "lnp", "lnp", "lnp", "onp", "grn", "oth"], "Jan 2026: Coalition as four columns");
assert.deepEqual(jan.total, { alp: 34, lnp: 19, onp: 26, grn: 11, oth: 10 }, "Jan 2026: the four Coalition columns sum to the published 19");
assert.deepEqual(jan.dims.generation.Boomers, { alp: 35, lnp: 21, onp: 35, grn: 1, oth: 8 });
assert.deepEqual(jan.dims.gender.Women, { alp: 36, lnp: 19, onp: 23, grn: 13, oth: 9 });
assert.equal(dimsProblem(jan.dims), null, "Jan 2026: every group sums to about 100");
assert.equal(totalProblem(jan.total, poll("RedBridge/Accent", "2026-01-29")), null, "Jan 2026: All voters matches the poll row");
// August: one Coalition column, respondent-allocated two-party columns and N after the parties
const aug = rb("august");
assert.deepEqual(aug.columns, ["alp", "lnp", "onp", "grn", "oth"]);
assert.deepEqual(aug.dims.gender.Women, { alp: 28, lnp: 20, onp: 29, grn: 14, oth: 9 });
assert.deepEqual(Object.keys(aug.dims), ["softness", "generation", "gender", "location", "education", "housing"]);
assert.deepEqual(Object.keys(aug.dims.location), ["Inner metro", "Outer metro", "Provincial", "Rural"], "location labels tidied to YouGov's");
assert.deepEqual(aug.dims.location.Rural, { alp: 22, lnp: 17, onp: 41, grn: 8, oth: 12 });
assert.deepEqual(Object.keys(aug.dims.housing), ["Own outright", "Mortgage", "Renting and other"], "Renting and other keeps its name");
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

// the July 2025 fold table (AFR's four-party table folds One Nation into
// "Others"): the gate reads only the keys that printed, and compares totals
// only where BOTH sides carry the key – in either direction
const jul = wave("RedBridge/Accent", "2025-06-30");
assert.ok(jul, "the July 2025 AFR fold wave is filed");
assert.equal(jul.source, "https://datawrapper.dwcdn.net/FexJm/2/");
assert.equal(jul.read, "published table");
assert.deepEqual(jul.total, { alp: 37, lnp: 31, grn: 11, oth: 21 }, "the four-party total sits with the poll row");
assert.equal(totalProblem(jul.total, poll("RedBridge/Accent", "2025-06-30")), null,
  "the fold-table total matches the poll row where both print");
const junPNG = poll("RedBridge/Accent", "2025-06-30");
assert.equal(totalProblem({ onp: junPNG.onp, ind: junPNG.ind }, jul.total), null,
  "polled figures the table folds away are no defect of the table");
assert.equal(totalProblem(jul.total, {}), null, "nothing to compare against is no defect");
assert.equal(sharesProblem(jul.dims.age), null, "four-party rows sum to 100 on their own");
assert.deepEqual(Object.keys(jul.dims.age["65+"]).sort(), ["alp", "grn", "lnp", "oth"], "no onp key in the fold wave");
assert.equal(jul.dims.age["65+"].grn, 1, "the 65+ Greens cell, kept from the embed's CSV");
assert.deepEqual(Object.keys(jul.dims.gender).sort(), ["Men", "Women"]);
assert.deepEqual(jul.dims.location["Inner metro"], { alp: 43, lnp: 29, grn: 11, oth: 17 });
assert.deepEqual(jul.dims.location["Rural"], { alp: 32, lnp: 32, grn: 8, oth: 28 });
assert.deepEqual(jul.dims.age["50–64"], { alp: 37, lnp: 34, grn: 5, oth: 24 });
assert.equal(sharesProblem(jul.dims.gender), null);

// the November 2025 wave (REDBRIDGE_NOV_DEMO): no Accent report ever existed,
// so the generational table enters by hand from the AFR piece's table as
// Wikipedia's subpopulation chapter transcribed it – pinned cell by cell so
// the transcription can't drift under a later "fix"
const nov = wave("RedBridge/Accent", "2025-11-13");
assert.ok(nov, "the November 2025 AFR wave is filed");
assert.equal(nov.source, "https://www.afr.com/politics/federal/one-nation-closing-in-on-coalition-as-ley-s-rating-hits-record-low-20251116-p5nfq2");
assert.equal(nov.read, "published table");
assert.deepEqual(nov.total, { alp: 38, lnp: 24, grn: 9, onp: 18, oth: 11 },
  "the printed five-party total maps the poll row's ind 11 to oth");
assert.equal(totalProblem(nov.total, poll("RedBridge/Accent", "2025-11-13")), null,
  "the total sits with the poll row");
assert.deepEqual(Object.keys(nov.dims), ["generation"], "the piece printed only the generational cut");
assert.deepEqual(Object.keys(nov.dims.generation), ["Gen Z", "Millennials", "Gen X", "Boomers"],
  "series labels, not the table's 'Baby boomers'");
assert.deepEqual(nov.dims.generation["Gen Z"], { alp: 51, lnp: 10, grn: 24, onp: 5, oth: 10 },
  "Gen Z lnp 10 is the cell the AFR prose itself quotes");
assert.deepEqual(nov.dims.generation["Millennials"], { alp: 34, lnp: 23, grn: 11, onp: 18, oth: 14 },
  "Millennials lnp 23 likewise");
assert.deepEqual(nov.dims.generation["Gen X"], { alp: 38, lnp: 26, grn: 6, onp: 20, oth: 10 },
  "Gen X lnp 26 is the table's Lib 22 + Nat 4 combined");
assert.deepEqual(nov.dims.generation["Boomers"], { alp: 34, lnp: 30, grn: 3, onp: 24, oth: 9 });
assert.ok(Object.values(nov.dims.generation).every((r) => Object.keys(r).length === 5),
  "Independents fold into Others across every group, as the table has it");
assert.equal(sharesProblem(nov.dims.generation), null, "every group row sums to 100");

// the shifts super-poll (June 2025 – March 2026 trend report, n=5,563): its
// five trend tables backfill state/generation/country/language on the July
// 2025 wave and file three previously unfiled waves – pinned cell by cell
assert.deepEqual(jul.dims.state, {
  NSW: { alp: 38, lnp: 30, grn: 9, oth: 23 }, Vic: { alp: 36, lnp: 31, grn: 12, oth: 21 },
  Qld: { alp: 32, lnp: 35, grn: 12, oth: 21 }, WA: { alp: 41, lnp: 31, grn: 11, oth: 17 } },
  "June states ride the wave's four-party fold (One Nation rises into Others)");
assert.deepEqual(jul.dims.generation, {
  "Gen Z": { alp: 41, lnp: 18, grn: 28, oth: 13 }, Millennials: { alp: 38, lnp: 22, grn: 14, oth: 26 },
  "Gen X": { alp: 36, lnp: 33, grn: 6, oth: 25 }, Boomers: { alp: 37, lnp: 42, grn: 2, oth: 19 } });
assert.deepEqual(jul.dims.country, {
  Australia: { alp: 36, lnp: 31, grn: 11, oth: 22 },
  "Another country": { alp: 44, lnp: 30, grn: 10, oth: 16 } });
assert.deepEqual(jul.dims.language, {
  "English only": { alp: 37, lnp: 31, grn: 11, oth: 21 },
  "Other language": { alp: 46, lnp: 24, grn: 13, oth: 17 } });
assert.equal(sharesProblem(jul.dims.state), null, "four-party state rows sum to 100");
assert.equal(sharesProblem(jul.dims.language), null, "four-party language rows sum to 100");

const sep = wave("RedBridge/Accent", "2025-09-08");
assert.ok(sep, "the September 2025 wave, unfiled since the protected tweet, is filed");
assert.equal(sep.read, "published table");
assert.deepEqual(sep.total, { alp: 35, lnp: 30, grn: 11, onp: 11, oth: 13 },
  "five-party as the shifts table prints it");
assert.equal(totalProblem(sep.total, poll("RedBridge/Accent", "2025-09-08")), null,
  "the total sits with the poll row");
assert.deepEqual(sep.dims.gender, {
  Men: { alp: 37, lnp: 32, grn: 7, onp: 12, oth: 12 },
  Women: { alp: 33, lnp: 29, grn: 14, onp: 11, oth: 13 } });
assert.deepEqual(sep.dims.generation, {
  "Gen Z": { alp: 33, lnp: 18, grn: 31, onp: 5, oth: 13 },
  Millennials: { alp: 38, lnp: 26, grn: 14, onp: 9, oth: 13 },
  "Gen X": { alp: 34, lnp: 32, grn: 7, onp: 14, oth: 13 },
  Boomers: { alp: 34, lnp: 38, grn: 2, onp: 14, oth: 12 } });
assert.deepEqual(sep.dims.country, {
  Australia: { alp: 33, lnp: 31, grn: 11, onp: 12, oth: 13 },
  "Another country": { alp: 41, lnp: 30, grn: 8, onp: 9, oth: 12 } });
assert.deepEqual(sep.dims.language, {
  "English only": { alp: 34, lnp: 31, grn: 11, onp: 11, oth: 13 },
  "Other language": { alp: 43, lnp: 21, grn: 15, onp: 9, oth: 12 } });
assert.deepEqual(sep.dims.state, {
  NSW: { alp: 34, lnp: 29, grn: 10, onp: 12, oth: 15 },
  Vic: { alp: 34, lnp: 32, grn: 12, onp: 9, oth: 13 },
  Qld: { alp: 31, lnp: 32, grn: 12, onp: 16, oth: 9 },
  WA: { alp: 44, lnp: 28, grn: 7, onp: 10, oth: 11 } });
assert.equal(sharesProblem(sep.dims.state), null, "five-party state rows sum to 100");

const nov26 = wave("RedBridge/Accent", "2025-11-26");
assert.ok(nov26, "the late-November 2025 wave is filed from the shifts tables");
assert.deepEqual(nov26.total, { alp: 35, lnp: 26, grn: 10, onp: 18, oth: 11 });
assert.equal(totalProblem(nov26.total, poll("RedBridge/Accent", "2025-11-26")), null,
  "the total sits with the poll row");
assert.deepEqual(nov26.dims.gender, {
  Men: { alp: 37, lnp: 26, grn: 8, onp: 19, oth: 10 },
  Women: { alp: 33, lnp: 26, grn: 13, onp: 16, oth: 12 } });
assert.deepEqual(nov26.dims.generation, {
  "Gen Z": { alp: 38, lnp: 18, grn: 27, onp: 8, oth: 9 },
  Millennials: { alp: 37, lnp: 23, grn: 14, onp: 15, oth: 11 },
  "Gen X": { alp: 33, lnp: 27, grn: 8, onp: 21, oth: 11 },
  Boomers: { alp: 33, lnp: 32, grn: 2, onp: 22, oth: 11 } });
assert.deepEqual(nov26.dims.country, {
  Australia: { alp: 33, lnp: 26, grn: 11, onp: 19, oth: 11 },
  "Another country": { alp: 44, lnp: 25, grn: 9, onp: 13, oth: 9 } });
assert.deepEqual(nov26.dims.language, {
  "English only": { alp: 34, lnp: 27, grn: 10, onp: 18, oth: 11 },
  "Other language": { alp: 44, lnp: 19, grn: 13, onp: 12, oth: 12 } });
assert.deepEqual(nov26.dims.state, {
  NSW: { alp: 35, lnp: 23, grn: 10, onp: 18, oth: 14 },
  Vic: { alp: 35, lnp: 30, grn: 11, onp: 14, oth: 10 },
  Qld: { alp: 32, lnp: 30, grn: 9, onp: 22, oth: 7 },
  WA: { alp: 39, lnp: 24, grn: 12, onp: 17, oth: 8 } });
assert.equal(sharesProblem(nov26.dims.generation), null);

const shifts = wave("RedBridge/Accent (shifts)", "2026-03-19");
assert.ok(shifts, "the March 2026 super-poll wave is filed under its own NO_AGG house");
assert.equal(shifts.sample, 5563, "the report's super-poll n");
assert.equal("total" in shifts, false, "the report prints no all-voters topline, so none is filed");
assert.deepEqual(shifts.dims.gender, {
  Men: { alp: 32, lnp: 21, grn: 10, onp: 29, oth: 8 },
  Women: { alp: 30, lnp: 20, grn: 13, onp: 27, oth: 10 } });
assert.deepEqual(shifts.dims.generation, {
  "Gen Z": { alp: 33, lnp: 13, grn: 31, onp: 15, oth: 8 },
  Millennials: { alp: 32, lnp: 17, grn: 15, onp: 26, oth: 10 },
  "Gen X": { alp: 31, lnp: 19, grn: 8, onp: 33, oth: 9 },
  Boomers: { alp: 30, lnp: 27, grn: 3, onp: 32, oth: 8 } });
assert.deepEqual(shifts.dims.country, {
  Australia: { alp: 30, lnp: 21, grn: 12, onp: 28, oth: 9 },
  "Another country": { alp: 36, lnp: 20, grn: 10, onp: 26, oth: 8 } });
assert.deepEqual(shifts.dims.language, {
  "English only": { alp: 30, lnp: 20, grn: 12, onp: 29, oth: 9 },
  "Other language": { alp: 39, lnp: 20, grn: 15, onp: 16, oth: 10 } });
assert.deepEqual(shifts.dims.state, {
  NSW: { alp: 31, lnp: 20, grn: 11, onp: 28, oth: 10 },
  Vic: { alp: 29, lnp: 23, grn: 14, onp: 25, oth: 9 },
  Qld: { alp: 28, lnp: 22, grn: 10, onp: 33, oth: 7 },
  WA: { alp: 35, lnp: 19, grn: 12, onp: 27, oth: 7 } },
  "One Nation passes Labor in every printed state cut but Western Australia's");
assert.equal(sharesProblem(shifts.dims.country), null);

// ---- Resolve: decoding and the series ------------------------------------------------
assert.equal(decodeUx("2l"), 38);
assert.equal(decodeUx("2l.83"), 38.83, "the fraction rides verbatim");
assert.equal(decodeUx("31.88"), 22.88, "a value that looks plain is still obfuscated");
const enc = (v) => { const [i, f] = String(v).split("."); return (Number(i) ^ 123).toString(36) + (f ? "." + f : ""); };
const series = (pairs) => pairs.map(([date, v]) => ({ date, value: enc(v) }));
const q = { answers: [
  { answer: "ALP", age: [{ key: "age-18-34", timeseries: series([["12/04/2025", 40], ["14/09/2026", 28.5]]) }],
    gender: [{ key: "Male", timeseries: series([["14/09/2026", 27]]) }, { key: "QLD", timeseries: series([["14/09/2026", 99]]) }],
    states: [{ key: "National", timeseries: series([["14/09/2026", 27.5]]) }, { key: "Qld", timeseries: series([["14/09/2026", 24.25]]) },
             { key: "Rest of Australia", timeseries: series([["14/09/2026", 31]]) }] },
  { answer: "IND", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 6]]) }], gender: [] },
  { answer: "OTH", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 4.25]]) }], gender: [] },
  { answer: "UND", age: [{ key: "age-18-34", timeseries: series([["14/09/2026", 9]]) }], gender: [] },
] };
const rw = resolveWaves(q);
assert.equal(rw.length, 1, "months before the term are dropped");
assert.equal(rw[0].date, "2026-09-14");
assert.deepEqual(rw[0].dims, { age: { "18–34": { alp: 28.5, oth: 10.25 } }, gender: { Men: { alp: 27 } },
  state: { Qld: { alp: 24.25 }, "Rest of Australia": { alp: 31 } } },
  "IND and OTH fold into oth; the stray QLD key, National and undecided are ignored");
// the Feb 2026 Ley scenario is a point in the series, not a poll
const scen = resolveWaves({ answers: [{ answer: "ALP", age: [], gender: [{ key: "Male", timeseries: series([["12/02/2026", 31], ["14/02/2026", 33]]) }] }] });
assert.deepEqual(scen.map((w) => w.date), ["2026-02-14"], "the 12 Feb 2026 Ley scenario is dropped");

// ---- DemosAU chart labels -------------------------------------------------------------
assert.equal(demosLabel("gender", "Males"), "Men");
assert.equal(demosLabel("gender", "Females"), "Women");
assert.equal(demosLabel("age", "18-34"), "18–34");
assert.equal(demosLabel("education", "TAFE / Trade"), "TAFE");
assert.equal(demosLabel("location", "Inner Metro"), "Inner metro");
assert.equal(demosLabel("location", "Regional/Rural"), "Regional or rural");
assert.equal(demosLabel("housing", "Home Owner"), "Own outright", "Apr–Jul 2026's third bar, beside Renter and Mortgage Holder");
assert.equal(demosLabel("housing", "Own Home Outright"), "Own outright");
assert.equal(demosLabel("housing", "Mortgage holder"), "Mortgage");
assert.equal(demosLabel("housing", "Renter"), "Renting");
assert.equal(demosLabel("language", "English"), "English only");
assert.equal(demosLabel("language", "LOTE"), "Other language");
assert.equal(demosLabel("language", "Other language at home"), "Other language");
// the Income chart's brackets, tidied to YouGov's label scheme
assert.equal(demosLabel("income", "<$45K"), "Under $45k");
assert.equal(demosLabel("income", "$45-125K"), "$45–125k");
assert.equal(demosLabel("income", "$125K+"), "$125k+");

// ---- Essential: the Primary Vote+ visuals, matched wave by wave ----------------------------
// the fold and the question filter, on a synthetic two-group wave
const essRow = (vis, ans, v) => `2026-09-30,primary,"Primary Vote+",${vis},${ans},${v}`;
const essCsv = ["date,dataset,question,visual,answer,value_pct",
  essRow("Overall", "Labor", 29), essRow("Overall", "TOTAL: Coalition", 22), essRow("Overall", "Greens", 12),
  essRow("Overall", "One Nation", 25), essRow("Overall", "Independent or Other Party", 9), essRow("Overall", "Undecided", 3),
  essRow("Male", "Labor", 26), essRow("Male", "TOTAL: Coalition", 24), essRow("Male", "Greens", 9),
  essRow("Male", "One Nation", 29), essRow("Male", "Independent or Other Party", 8), essRow("Male", "Undecided", 4),
  "2026-09-30,primary,\"Some other question\",Overall,Labor,50"].join("\n");
const mini = essentialWaves(essCsv).get("2026-09-30");
assert.deepEqual(mini.total, { alp: 29, lnp: 22, grn: 12, onp: 25, oth: 12 }, "Independent/other and undecided fold into oth");
assert.deepEqual(mini.dims.gender.Men, { alp: 26, lnp: 24, grn: 9, onp: 29, oth: 12 });
assert.equal(Object.keys(mini.dims).length, 1, "age bars absent are simply absent; another question's row is ignored");
// the matcher: five days, nearest agreeing wave, nothing waved past 0.6 off
const mkWave = (a, l, o, g) => ({ total: { alp: a, lnp: l, onp: o, grn: g, oth: 10 }, dims: {} });
const two = new Map([["2026-09-30", mkWave(29, 22, 25, 12)], ["2026-10-03", mkWave(29.5, 22, 25, 12)]]);
assert.equal(essentialMatch(two, { date: "2026-09-29", alp: 29.2, lnp: 22, onp: 25, grn: 12 }), "2026-09-30", "the closer, nearest figure wins");
assert.equal(essentialMatch(two, { date: "2026-10-09", alp: 29, lnp: 22, onp: 25, grn: 12 }), null, "five days is the window");
assert.ok(!essentialMatch(new Map([["2026-09-30", mkWave(29, 20, 25, 12)]]), { date: "2026-09-29", alp: 29, lnp: 22, onp: 25, grn: 12 }), "0.6 off the published row never matches");
// the committed CSV keeps every on-file Essential row green end to end
const ew = essentialWaves(readFileSync(path.join(ROOT, "data", "essential-report.csv"), "utf8"));
for (const p of polls.filter((x) => x.pollster === "Essential" && x.date >= "2025-05-03")) {
  const dte = essentialMatch(ew, p);
  assert.ok(dte, `Essential ${p.date} matches a Primary Vote+ wave in the CSV`);
  const w = ew.get(dte);
  assert.equal(dimsProblem(w.dims), null, `Essential ${p.date}: every group sums to about 100`);
  assert.equal(totalProblem(w.total, p), null, `Essential ${p.date}: Overall matches the published primaries`);
}
const essSep = ew.get(essentialMatch(ew, poll("Essential", "2026-09-29")));
assert.deepEqual(essSep.dims.age["55+"], { alp: 25, lnp: 28, onp: 28, grn: 4, oth: 15 });
assert.deepEqual(essSep.dims.gender.Men, { alp: 29, lnp: 25, onp: 28, grn: 9, oth: 9 });

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
// DemosAU: its bands match Resolve's; School and TAFE map across; a segment
// the printed table left off entirely stays null, never 0
const dm = harmonize({ pollster: "DemosAU", dims: {
  age: { "18–34": sh(31, 14, 16, 25, 14), "35–54": sh(28, 21, 27, 13, 11), "55+": sh(22, 26, 33, 6, 13) },
  education: { School: { alp: 26, lnp: 19, onp: 35, oth: 20 }, TAFE: sh(24, 20, 34, 11, 11), University: sh(30, 25, 18, 15, 12) },
} });
assert.deepEqual(Object.keys(dm.age), ["18–34", "35–54", "55+"]);
assert.deepEqual(dm.education["Year 12 or less"], sh(26, 19, 35, null, 20), "School is Year 12 or less; an unprinted party stays null, never a zero share");
// RedBridge: its two school rows merge 39:61
const rbH = harmonize({ pollster: "RedBridge/Accent", dims: {
  education: { "Below Year 12": sh(27, 25, 41, 3, 4), "Year 12": sh(28, 22, 17, 26, 7), "TAFE or trade": sh(26, 19, 37, 6, 12), University: sh(36, 26, 18, 13, 7) },
} });
const merged = rbH.education["Year 12 or less"];
for (const [k, want] of Object.entries({ alp: 27.61, lnp: 23.17, onp: 26.36, grn: 17.03, oth: 5.83 }))
  assert.ok(Math.abs(merged[k] - want) < 0.01, `RedBridge school rows merge 39:61 (${k} ${merged[k]})`);
// YouGov's SA, WA and ACT/NT/Tas are the Non-NSW/Vic/Qld bucket at their 2025 vote shares; all three or none –
// and SA and WA also join as common groups of their own (Roy Morgan cuts them too, no ACT/NT/Tas)
const ygPlace = harmonize({ pollster: "YouGov", dims: {
  state: { NSW: sh(29, 19, 26, 12, 15), SA: sh(34, 14, 40, 6, 6), WA: sh(37, 21, 21, 13, 8), "ACT/NT/Tas": sh(36, 21, 21, 8, 14) },
  location: { "Inner metro": sh(36, 24, 15, 12, 13), Rural: sh(18, 21, 35, 12, 15) },
  housing: { Renting: sh(29, 8, 27, 21, 16) }, language: { "English only": sh(28, 21, 27, 11, 14) },
} });
const rest = ygPlace.state["Non-NSW/Vic/Qld"];
for (const [k, want] of Object.entries({ alp: 35.809, lnp: 18.732, onp: 27.156, grn: 9.637, oth: 8.666 }))
  assert.ok(Math.abs(rest[k] - want) < 0.01, `YouGov's three smaller regions merge at 2025 vote shares (${k} ${rest[k]})`);
assert.deepEqual(Object.keys(ygPlace.state), ["NSW", "SA", "WA", "Non-NSW/Vic/Qld"]);
assert.deepEqual(ygPlace.state.SA, sh(34, 14, 40, 6, 6), "SA passes through as its own group");
assert.deepEqual(ygPlace.state.WA, sh(37, 21, 21, 13, 8), "WA passes through as its own group");
const morganLike = harmonize({ dims: { state: { SA: sh(34, 14, 40, 6, 6), WA: sh(37, 21, 21, 13, 8) } } });
assert.deepEqual(Object.keys(morganLike.state), ["SA", "WA"],
  "a wave missing one of the three smaller regions doesn't join the Non-NSW/Vic/Qld bucket, but SA and WA still join on their own (Roy Morgan)");
assert.deepEqual(Object.keys(ygPlace.location), ["Inner metro", "Rural"]);
assert.deepEqual(ygPlace.housing.Renting, sh(29, 8, 27, 21, 16));
// DemosAU's Regional or rural is two common groups at once, and joins at neither
const dmPlace = harmonize({ pollster: "DemosAU", dims: {
  location: { "Inner metro": sh(32, 28, 18, 13, 9), "Outer metro": sh(28, 17, 27, 15, 13), "Regional or rural": sh(23, 16, 34, 8, 19) },
  housing: { "Own outright": sh(24, 25, 25, 10, 16), Mortgage: sh(28, 23, 26, 13, 10), Renting: sh(31, 13, 26, 16, 14) },
  language: { "English only": sh(25, 21, 27, 13, 14), "Other language": sh(38, 18, 18, 14, 12) },
} });
assert.deepEqual(Object.keys(dmPlace.location), ["Inner metro", "Outer metro"], "Regional or rural joins nowhere");
assert.deepEqual(Object.keys(dmPlace.housing), ["Own outright", "Mortgage", "Renting"]);
assert.deepEqual(Object.keys(dmPlace.language), ["English only", "Other language"]);
// RedBridge's Renting and other is wider than renters: it joins only at the owner groups
const rbPlace = harmonize({ pollster: "RedBridge/Accent", dims: {
  location: { "Inner metro": sh(30, 27, 21, 13, 9), "Outer metro": sh(37, 18, 27, 14, 4), Provincial: sh(25, 29, 24, 12, 10), Rural: sh(22, 17, 41, 8, 12) },
  housing: { "Own outright": sh(30, 29, 29, 5, 7), Mortgage: sh(29, 18, 33, 11, 9), "Renting and other": sh(29, 19, 21, 21, 10) },
} });
assert.deepEqual(Object.keys(rbPlace.location), ["Inner metro", "Outer metro", "Provincial", "Rural"]);
assert.deepEqual(Object.keys(rbPlace.housing), ["Own outright", "Mortgage"], "Renting and other joins nowhere");
// Resolve's four states join as they are
assert.deepEqual(Object.keys(harmonize({ pollster: "Resolve", dims: { state: {
  NSW: sh(28, 25, 29, 12, 6), Vic: sh(30, 24, 23, 15, 8), Qld: sh(24, 25, 28, 10, 13), "Rest of Australia": sh(31, 24, 24, 11, 10) } } }).state),
  ["NSW", "Vic", "Qld", "Non-NSW/Vic/Qld"]);
// income is read per house for the All-polls demographics facet, but the
// brackets share no cut point (and YouGov's are household, DemosAU's personal),
// so it joins no common group
assert.equal(harmonize({ pollster: "YouGov", dims: { income: { "Under $50k": sh(26, 20, 30, 14, 10), "$150k+": sh(38, 28, 18, 6, 10) } } }).income,
  undefined, "income joins no common group");
// the July 2025 AFR fold table (One Nation folded into Others): harmonize
// keeps the unprinted party null on the common sets, never a zero share –
// a printed zero and an unfilled cell must not pool the same
const julFold = harmonize({ pollster: "RedBridge/Accent", dims: {
  gender: { Men: { alp: 39, lnp: 32, grn: 8, oth: 21 }, Women: { alp: 36, lnp: 30, grn: 13, oth: 21 } },
} });
assert.deepEqual(julFold.gender.Men, { alp: 39, lnp: 32, onp: null, grn: 8, oth: 21 }, "the folded-away party is null, not 0");
assert.deepEqual(julFold.gender.Women, { alp: 36, lnp: 30, onp: null, grn: 13, oth: 21 });
// a printed zero is a real figure and stays one
const printedZero = harmonize({ pollster: "YouGov", dims: { age: { "18–34": { alp: 30, lnp: 12, onp: 0, grn: 26, oth: 17 } } } });
assert.deepEqual(printedZero.age["18–34"], sh(30, 12, 0, 26, 17), "a party that printed 0 keeps 0");

// every common group has a population share for its sampling-error floor
for (const set of DEMO_SETS) for (const g of set.groups) assert.ok(DEMO_SHARE[g] > 0 && DEMO_SHARE[g] < 1, `share for ${g}`);

// ---- vote-switching: the hand-entered shifts wave --------------------------------
/* Accent's "shifts" report Figure 9 (fieldwork 6–19 Mar 2026, n=5,563) – a
   stacked-bar chart measured by hand (printed labels where shown, bar widths
   otherwise, an undecided/won't-vote residue cell no other house prints).
   No automation reads this house, so vote-switching.mjs carries the wave
   forward verbatim; pinned cell by cell so a later "fix" can't drift it. */
const vsWaves = JSON.parse(readFileSync(path.join(ROOT, "data", "vote-switching.json"), "utf8")).waves;
const shiftsVs = vsWaves.find((w) => w.pollster === "RedBridge/Accent (shifts)" && w.date === "2026-03-19");
assert.ok(shiftsVs, "the shifts Figure 9 wave is filed");
assert.equal(shiftsVs.read, "measured from the chart");
assert.deepEqual(Object.keys(shiftsVs.rows).sort(), ["alp", "dnr", "grn", "lnp", "onp", "oth"],
  "six recalled-vote cohorts, no ind row (folded into oth as the chart prints it)");
assert.deepEqual(shiftsVs.rows.alp, { alp: 71, lnp: 4, onp: 12, grn: 5, oth: 3, und: 5 });
assert.deepEqual(shiftsVs.rows.lnp, { alp: 3, lnp: 56, onp: 33, grn: 1, oth: 3, und: 4 });
assert.deepEqual(shiftsVs.rows.grn, { alp: 5, lnp: 2, onp: 3, grn: 84, oth: 4, und: 3 });
assert.deepEqual(shiftsVs.rows.onp, { alp: 0.7, lnp: 0.8, onp: 96, grn: 0.3, oth: 1.4, und: 0.4 },
  "One Nation retention 96, the print's headline cell");
assert.deepEqual(shiftsVs.rows.oth, { alp: 5, lnp: 5, onp: 27, grn: 3, oth: 55, und: 5 });
assert.deepEqual(shiftsVs.rows.dnr, { alp: 11, lnp: 8, onp: 18, grn: 5, oth: 12, und: 46 });

console.log("PASS: crosstab readers – YouGov crosstab (income brackets too), RedBridge tables (three layouts + the July 2025 AFR fold), Resolve series, Essential Primary Vote visuals, DemosAU labels, the gate, the common groups (place and home too, unprinted parties null), the shifts vote-switching wave");
