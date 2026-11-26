/* test-dawn.mjs – the /dawn/ trial design (.build/dawn/, gen-data §13).
   1. its data ends on the site's own figures: the last week's primaries are
      latest.primary, and the two-party lines end on the site's implied lines;
   2. every branch of the copy rules (copy.mjs) on mutated data, so a head
      can only claim what clears its margin;
   3. the built page: every placeholder filled, its data parses, its past
      terms' sidecar is on disk, the heads are today's rules;
   4. the next-polls page: the site's projection (np-project.js) and its words
      (next-copy.js) evaluated together on mocked Sydney clocks across the
      coming weeks, every head on its rule, and the branches no schedule this
      year reaches on hand-built rows; np-score's report read whole.
   Run: node .build/test-dawn.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { votesHead, votesDek, tppStory, flowsHead, flowNote, verdicts, copyFor } from "./dawn/copy.mjs";
import { latestPollLine, pollPublishedMs } from "./dawn/poll-meta.mjs";
import { sharePosterior, credibleBounds, significantChange } from "./dawn/poll-intervals.mjs";
import { pollHeading } from "./dawn/poll-heading.mjs";
import { sigTriangle, sigMark } from "./dawn/sig-triangle.mjs";
import { buildDawn, flowTotals, readScore } from "./dawn/build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const A = path.join(HERE, "newtracker", "assets");
const D0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-data.json"), "utf8"));
const clone = () => JSON.parse(JSON.stringify(D0));
const r1 = (v) => Math.round(v * 10) / 10;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m); n++; };

/* the latest poll's publication age, rounded in the unit the reader is given */
{
  const P = { latestPoll: { h: "Essential", pub: "2026-11-25T01:00" } };
  const at = pollPublishedMs(P.latestPoll.pub), age = (ms) => latestPollLine(P, at + ms);
  eq(at, Date.parse("2026-11-24T14:00:00Z"), "the publication stamp is Sydney wall time, in daylight saving");
  eq(pollPublishedMs("2026-07-25T01:00"), Date.parse("2026-07-24T15:00:00Z"), "and outside daylight saving");
  eq(pollPublishedMs("2026-11-25T01:00:00+11:00"), at, "an explicit zone reads the same instant");
  eq(age(29000), "Latest poll is Essential’s, published zero minutes ago.");
  eq(age(31000), "Latest poll is Essential’s, published a minute ago.");
  eq(age(59 * 60000 + 29000), "Latest poll is Essential’s, published 59 minutes ago.");
  eq(age(59 * 60000 + 31000), "Latest poll is Essential’s, published 60 minutes ago.");
  eq(age(3600000), "Latest poll is Essential’s, published an hour ago.");
  eq(age(3 * 3600000 + 31 * 60000), "Latest poll is Essential’s, published four hours ago.");
  eq(age(23 * 3600000 + 31 * 60000), "Latest poll is Essential’s, published 24 hours ago.");
  eq(age(86400000), "Latest poll is Essential’s, published yesterday.");
  eq(age(36 * 3600000), "Latest poll is Essential’s, published two days ago.");
  eq(age(9 * 86400000), "Latest poll is Essential’s, published nine days ago.");
  eq(age(10 * 86400000), "Latest poll is Essential’s, published 10 days ago.");
  for (const pub of [undefined, null, "", "2026-11-25"]) eq(latestPollLine({ latestPoll: { h: "Essential", pub } }, at), "Latest poll is Essential’s.", "no age when the clock time is unknown");
  eq(latestPollLine({}, at), "", "no latest-poll clause when no poll is on record");
}

/* subgroup categories are presentation-only; option values are untouched */
{
  const src = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dawn/template.html"), "utf8");
  const split = vm.runInNewContext(src.slice(src.indexOf("function dawnSubgroups("), src.indexOf("const grpSel=")) + ";dawnSubgroups", {})([
    { label: "Age", groups: ["18–34", "35–54", "55+", "Gen Z", "Millennials", "Gen X", "Boomers"] },
    { label: "Place", groups: ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "Non-NSW/Vic/Qld", "Inner metro", "Outer metro", "Provincial", "Rural"] },
    { label: "Home", groups: ["Own outright", "Mortgage", "Renting", "English only", "Other language", "Full time", "Part time", "Retired"] },
  ]);
  const options = label => split.find(t => t.label === label)?.groups || [];
  eq(split.map(t => t.label).join("|"), "Age group|Generation|State or territory|Seat type|Home|Work status|Language at home", "separate menu headings");
  eq(options("Age group").join("|"), "18–34|35–54|55+", "age bands stay out of Generations");
  eq(options("Generation").join("|"), "Gen Z|Millennials|Gen X|Boomers", "named generations stay together");
  eq(options("State or territory").join("|"), "NSW|Vic|Qld|SA|WA|ACT/NT/Tas|Non-NSW/Vic/Qld", "states and the combined remainder stay geographic");
  eq(options("Seat type").join("|"), "Inner metro|Outer metro|Provincial|Rural", "seat types have their own group");
  eq(options("Home").join("|"), "Own outright|Mortgage|Renting", "Home retains only the tenure options");
  eq(options("Work status").join("|"), "Full time|Part time|Retired", "the three employment options get their own category");
  eq(options("Language at home").join("|"), "English only|Other language", "languages get their own category");
  eq(options("Home").includes("English only"), false, "English only does not stay in Home");
  eq(options("Home").includes("Other language"), false, "Other language does not stay in Home");
  const optionLabel = vm.runInNewContext(src.slice(src.indexOf("function dawnSubgroups("), src.indexOf("const grpSel=")) + ";dawnOptionLabel", {});
  const ordinary = ["All voters", "All pollsters", "Men", "Women", "Inner metro", "Outer metro", "Provincial", "Rural", "Non-NSW/Vic/Qld", "Renting", "Full time", "Part time", "Retired", "Year 12 or less", "University", "Other language"];
  eq(ordinary.map(optionLabel).join("|"), "all voters|all pollsters|men|women|inner metro|outer metro|provincial|rural|non-NSW/Vic/Qld|renting|full time|part time|retired|year 12 or less|university|other language", "ordinary menu labels start lowercase");
  const proper = ["Gen Z", "Millennials", "Gen X", "Boomers", "Silent", "NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "English only", "TAFE or trade"];
  eq(proper.map(optionLabel).join("|"), proper.join("|"), "proper nouns and abbreviations retain their capital letters");
}

/* the comparison switch only offers a rival where that series has readings */
{
  const src = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dawn/template.html"), "utf8");
  const logic = src.slice(src.indexOf("const hasTppRival="), src.indexOf("/* the two-party series start"));
  const available = (start, end, v) => vm.runInNewContext(logic + ";hasTppRival()", { WIN: { a: start, b: end }, winRange: w => [w.a, w.b], CUR: { a: 2025 }, TPP: { on: { v } }, GX: [2025, 2026] });
  eq(available(2022, 2024, [50.8]), false, "a past term with no One Nation comparison is Coalition-only");
  eq(available(2025, 2026, [50.8]), true, "a current One Nation series keeps the switch available");
  eq(available(2025, 2026, [null]), false, "a window with no One Nation reading does not enable it");
}

/* a completed term does not repeat a month across its two dates */
{
  const src = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dawn/template.html"), "utf8");
  const helpers = src.slice(src.indexOf("const MON="), src.indexOf("const PK=DATA.parties"));
  const terms = src.slice(src.indexOf("const TERMS="), src.indexOf("let HIST="));
  const bounds = src.slice(src.indexOf("const REACH="), src.indexOf("let WIN="));
  const range = src.slice(src.indexOf("const winRange="), src.indexOf("const inCur="));
  const words = src.slice(src.indexOf("function winWords("), src.indexOf("const winActive="));
  const label = vm.runInNewContext(helpers + terms + "const HIST=null,NOWX=isoX(DATA.asOf);" + bounds + range + words + ";(w)=>winWords(w)", { DATA: { terms: D0.terms, asOf: D0.asOf } });
  eq(label({ kind: "term", year: 2019 }).sub, "Morrison, May 2019–2022", "the end month is omitted when it repeats the opening month");
  eq(label({ kind: "term", year: 2016 }).sub, "Turnbull, then Morrison, Jul 2016–May 2019", "different months are kept in full");
  eq(label({ kind: "term", year: 2025 }).sub, "Albanese, since May 2025", "the current term keeps its open-ended wording");
}

/* which gaps are real: Dawn's ternary calculation against the ledger's own */
{
  const source = fs.readFileSync(path.join(A, "rd-allpolls.jsx"), "utf8");
  const fn = source.slice(source.indexOf("function rdSigTri("), source.indexOf("let rdSigSeq"));
  const reference = (p, n) => vm.runInNewContext(fn + ";rdSigTri", { RD_SIG_TRI: ["alp", "lnp", "onp"], rdIsMrp: (r) => / \(MRP\)$/.test(r.h || ""), rdNEff: () => n, window: { AUSPOL: { undecidedCellOf: (r) => r.u } } })(p);
  for (const u of [null, { label: "excluded", v: 10 }, { label: "included", v: 10 }]) {
    const p = { h: "Essential", k: "verify", p: { alp: 37, lnp: 31, onp: 11.5, grn: 7 }, u };
    const t = sigTriangle(p, 1000), r = reference(p, 1000), label = "with " + (u ? u.label : "no undecided share");
    ok(!!t && !!r, label);
    eq(t.s, r.s, "the three-way combined share " + label);
    t.pr.forEach((v, i) => eq(v, r.pr[i], "renormalised share " + i + " " + label));
    t.cov.forEach((row, i) => row.forEach((v, j) => eq(v, r.cov(i, j), "covariance " + i + j + " " + label)));
    t.pairs.forEach((x, i) => { eq(x.m, r.pairs[i].m, "pairwise margin " + i + " " + label); eq(x.sig, r.pairs[i].sig, "its significance " + label); });
    eq(t.lo, r.lo, "the same zoom " + label);
    eq(t.of100.join(","), r.of100.join(","), "three whole shares still add to 100 " + label);
    eq(t.of100.reduce((a, v) => a + v, 0), 100, "the rounded shares sum to exactly 100");
  }
  for (const p of [{}, { alp: 34, lnp: 33 }, { alp: 0, lnp: 33, onp: 22 }]) eq(sigTriangle({ h: "Essential", p }, 1000), null, "no triangle without all three positive shares");
  eq(sigTriangle({ h: "DemosAU (MRP)", p: { alp: 34, lnp: 33, onp: 22 } }, 1000), null, "a modelled-region projection is not a sampled poll triangle");
  eq(sigTriangle({ h: "Essential", p: { alp: 34, lnp: 33, onp: 22 } }, 0), null, "nor without a sample");
  eq(sigMark({ h: "Essential", p: { alp: 34, lnp: 33, onp: 22 } }, 0), "", "no empty diagram where no sample exists");
  const m = sigMark({ h: "Essential", k: "x", p: { alp: 40, lnp: 30, onp: 25 } }, 1200);
  ok(m.includes("Which gaps are real") && m.includes('role="img"'), "the diagram and its accessible label");
  ok(m.includes("Labor 42, Coalition 32, One Nation 26"), "the three rounded shares read correctly out of their combined 95");
  eq((m.match(/class="tri-blob"/g) || []).length, 3, "the ellipse is clipped into each party's corner");
  eq((m.match(/class="tri-blobline"/g) || []).length, 1, "with one outline for the whole ellipse");
  ok(m.includes("Labor is ahead of both, beyond the margin"), "the narrative reads off the pairwise tests");
}

/* an opened poll's header, in the main ledger's sentence form */
{
  const E = { h: "Essential", c: "The Guardian", d: "2026-11-24", f: "19–24 Nov", pub: "2026-11-25", n: 1017, b: "A", se: 793 };
  eq(pollHeading(E), 'Conducted on 19–24 Nov from a sample of <span class="nocaps">1,017 (<span class="sample-base">A</span>) (eff. 793)</span>, published by The Guardian on Wed 25 Nov.');
  ok(pollHeading({ ...E, se: null }).includes('1,017 (<span class="sample-base">A</span>)</span>'), "a raw sample without an effective figure");
  ok(pollHeading({ ...E, se: null, eb: "TBC" }).includes("(eff. TBC)"), "an effective sample still to come");
  ok(pollHeading({ ...E, se: null, eb: "missing" }).includes("(eff. missing)"), "the older, unfiled effective sample stays named");
  ok(pollHeading({ ...E, se: null, eb: "~790" }).includes("(eff. ~790)") && pollHeading({ ...E, se: null, eb: "~790" }).includes("title=\"Estimated from the raw sample"), "the approximate effective figure and its meaning");
  ok(pollHeading({ ...E, se: null, eb: null, h: "Roy Morgan", c: "Self-published", n: 1500 }, 1.5).includes("(eff. ~1,000)"), "the design-effect estimate for a house that files no effective sample");
  ok(pollHeading({ ...E, c: "Self-published" }).includes("published by Essential"), "a self-published wave names its house, not Self-published");
  ok(pollHeading({ ...E, c: "NEWS24" }).includes("published by the NEWS24"), "an unlisted client takes the article, as on the main ledger");
  ok(pollHeading({ ...E, c: "News24" }).includes("published by News24"), "bare client names do not acquire an article");
  ok(pollHeading({ ...E, c: "Blueprint Institute" }).includes("commissioned by the Blueprint Institute"), "a non-masthead client commissions a poll, named with the main ledger's article");
  ok(pollHeading({ ...E, tbc: true }).startsWith("Conducted on dates TBC from a sample"), "pending fieldwork uses the main header's exact form");
  ok(pollHeading({ ...E, n: null }).includes("an unpublished sample") && !pollHeading({ ...E, n: null }).includes("null"), "a withheld sample stays unpublished, not zero or null");
  ok(!pollHeading({ ...E, n: null, eb: "TBC" }).includes("(eff."), "no effective tag hangs off an unpublished sample");
  ok(pollHeading({ ...E, pub: "2026-11-25T13:00" }).endsWith("Wed 25 Nov, 1 pm."), "an hourly publication stamp where one is known");
  ok(!pollHeading({ ...E, pub: null }).includes("published by The Guardian on "), "no invented publication date");
  ok(pollHeading({ ...E, c: "Consumer Confidence", h: "Roy Morgan", conf: { v: 90 } }).includes("published by Roy Morgan"), "a confidence lane does not present its product line as a publisher");
}

/* The ledger prints percentile bounds. A change uses the uncertainty in both waves. */
{
  const [low, high] = credibleBounds([1, 1]);
  ok(Math.abs(low - 2.5) < 1e-7 && Math.abs(high - 97.5) < 1e-7, "equal-tailed bounds of a uniform posterior");
  const old = sharePosterior(25, 900, 1, 1);
  eq(significantChange(sharePosterior(26, 900, 1, 1), old), false, "one point is inside this change interval");
  eq(significantChange(sharePosterior(35, 900, 1, 1), old), true, "a clear rise");
  eq(significantChange(old, sharePosterior(35, 900, 1, 1)), true, "reversing the waves gives a clear fall");
  eq(significantChange(old, sharePosterior(25, 0, 1, 1)), null, "no verdict without both samples");
  ok(credibleBounds(sharePosterior(0, 900, 1, 1))[1] < 1, "a sampled zero has a small upper bound");
}

/* ---- 1. the data ends on the site's figures ---------------------------- */
const asset = fs.readFileSync(path.join(A, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
const grab = (name) => { const m = asset.match(new RegExp(`const ${name} = (.*);\\n`)); assert.ok(m, "data asset lacks " + name); return JSON.parse(m[1]); };
const latest = grab("latest"), synth = grab("synth2pp"), synthOn = grab("synthOn"), events = grab("events");
const L = D0.weeks.length - 1;
for (const k of D0.parties) {
  eq(r1(D0.prim[k].v[L]), latest.primary[k], `last week's ${k} is the site's headline`);
  eq(D0.prim[k].v.length, D0.weeks.length, `${k}: one value a week`);
  ok(D0.prim[k].lo.every((lo, i) => lo <= D0.prim[k].v[i] && D0.prim[k].v[i] <= D0.prim[k].hi[i]), `${k}: every week inside its band`);
}
eq(D0.weeks[L], latest.updatedISO, "the last week is the newest poll's day");
eq(D0.tpp.imp.v.length, L, "two-party weeks start a week after polling day");
eq(r1(D0.tpp.imp.v[L - 1]), synth[synth.length - 1].alp, "implied v Coalition ends on the site's line");
eq(r1(D0.tpp.on.v[L - 1]), synthOn[synthOn.length - 1].a, "implied v One Nation ends on the site's line");
eq(D0.events.length, events.filter((e) => e.major || ["2026-02-12", "2025-12-08"].includes(e.date)).length, "the events the site's charts mark");
const T = flowTotals(D0);
eq(r1(T.lnp), r1(D0.tpp.imp.v[L - 1]), "the flow diagram's total is the chart's last implied figure");
eq(r1(T.on), r1(D0.tpp.on.v[L - 1]), "against One Nation too");
ok(D0.rank.length === D0.weeks.length && D0.rank.every((r) => r.length === D0.parties.length), "a ranking every week");

/* ---- 2. the copy rules, branch by branch -------------------------------- */
/* set today's primaries: { k: [v, lo, hi] }, the count left as it is */
const withNow = (o) => { const D = clone(); for (const [k, [v, lo, hi]] of Object.entries(o)) { D.prim[k].v[L] = v; D.prim[k].lo[L] = lo; D.prim[k].hi[L] = hi; } return D; };
const E = Object.fromEntries(D0.parties.map((k) => [k, D0.prim[k].v[0]]));   // the count
const flat = () => Object.fromEntries(D0.parties.map((k) => [k, [E[k], E[k] - 1, E[k] + 1]]));
eq(votesHead(withNow(flat())).head, "The primary vote is much where it was at the election", "nothing clears: much the same");
const grow = (k, f, lo) => withNow({ ...flat(), [k]: [E[k] * f, E[k] * lo, E[k] * f + 2] });
eq(votesHead(grow("onp", 2.6, 2.1)).head, "One Nation’s vote has more than doubled", "doubled, read off the interval's lower end");
eq(votesHead(grow("onp", 3.9, 3.6)).head, "One Nation’s vote has more than tripled, but the Coalition is enjoying a rate-rise bounce", "tripled, followed by the Coalition's rate-rise bounce");
eq(votesHead(grow("onp", 4.6, 4.2)).head, "One Nation’s vote has more than quadrupled", "quadrupled");
eq(votesHead(grow("onp", 6, 5.4)).head, "One Nation’s vote has grown more than fivefold", "fivefold");
eq(votesHead(grow("onp", 2.2, 1.9)).head, "One Nation is up " + r1(E.onp * 1.2).toFixed(1) + " points since the election", "a point estimate past double whose interval is not: points");
const fall = (k, v, hi) => withNow({ ...flat(), [k]: [v, v - 1, hi] });
eq(votesHead(fall("lnp", E.lnp * 0.4, E.lnp * 0.48)).head, "The Coalition has lost more than half of its election vote", "half, read off the upper end");
eq(votesHead(fall("lnp", E.lnp * 0.6, E.lnp * 0.66)).head, "The Coalition has lost more than a third of its election vote", "a third");
eq(votesHead(fall("lnp", E.lnp * 0.7, E.lnp * 0.74)).head, "The Coalition has lost more than a quarter of its election vote", "a quarter");
eq(votesHead(fall("lnp", E.lnp * 0.76, E.lnp * 0.8)).head, "The Coalition has lost more than a fifth of its election vote", "a fifth");
eq(votesHead(fall("lnp", E.lnp - 3, E.lnp - 1)).head, "The Coalition is down 3.0 points since the election", "a small fall: points");
eq(votesHead(fall("grn", E.grn - 3, E.grn - 1)).head, "The Greens are down 3.0 points since the election", "a plural name takes a plural verb");
{
  const D = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5], alp: [E.alp - 5, E.alp - 6, E.alp - 4], lnp: [E.lnp - 4, E.lnp - 5, E.lnp - 3] });
  ok(votesDek(D).endsWith("election"), "no secondary movement sentence: " + votesDek(D));
  const D2 = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5], alp: [E.alp - 5, E.alp - 6, E.alp - 4], grn: [E.grn + 2, E.grn + 1, E.grn + 3] });
  ok(votesDek(D2).endsWith("election"), "the caption stays one sentence under mixed changes: " + votesDek(D2));
  const D3 = withNow({ ...flat(), onp: [E.onp * 3, E.onp * 2.5, E.onp * 3.5] });
  eq(votesDek(D3), "% of each party’s first-preference vote since the May 2025 election", "only the measure-label sentence remains");
}
/* the two-party story's curated heading (owner's wording, 25 Nov 2026) */
{
  const st = (onLast, coLast, ciOn = 1, ciCo = 1) => { const D = clone(); const m = D.months; m.on[m.on.length - 1] = [m.on[m.on.length - 1][0], onLast, ciOn]; m.imp[m.imp.length - 1] = [m.imp[m.imp.length - 1][0], coLast, ciCo]; return tppStory(D).head; };
  eq(st(51, 51.5), "Labor retains a narrow 2PP lead over both rivals", "the heading stays curated inside a point");
  eq(st(50, 53, 1, 1), "Labor retains a narrow 2PP lead over both rivals", "and when the rivals pull apart");
  eq(st(54, 51, 1, 1), "Labor retains a narrow 2PP lead over both rivals", "whichever rival runs closer");
  ok(/The two contests have run within .+ of each other since [A-Z][a-z]+(?: \d{4})?\.$/.test(tppStory(D0).dek), "the comparison ends with its dynamic starting month");
}
/* the flow diagram's curated heading; its numerical verdicts stay live */
{
  const set = (lnp, on) => { const D = clone(); const i = D.tpp.imp.v.length - 1; D.tpp.imp.v[i] = lnp[0]; D.tpp.imp.ci[i] = lnp[1]; D.tpp.on.v[i] = on[0]; D.tpp.on.cs[i] = on[1]; D.tpp.on.cf[i] = 0; return D; };
  const L_ = [54, 1], T_ = [50.5, 1.4], R_ = [46, 1];
  const cases = [[L_, L_], [T_, T_], [R_, R_], [L_, T_], [T_, L_], [L_, R_], [R_, L_], [R_, T_], [T_, R_]];
  for (const [a, b] of cases) eq(flowsHead(set(a, b)), "Two-party preferred", "flows heading " + JSON.stringify([a, b]));
  ok(verdicts(set(T_, T_)).lnp.margin === 2.8, "the margin as the site prints it: twice the interval");
}
/* the note under the diagram */
{
  const D = clone();
  ok(/^Preferences (widen|narrow) Labor’s lead over the Coalition from \d+\.\d points on first preferences to \d+\.\d/.test(flowNote(D, "lnp", flowTotals(D).lnp)), "today's note");
  D.nowShares = { ...D.nowShares, alp: 24, lnp: 26 };
  ok(/^Preferences turn Labor’s 2\.0-point deficit against the Coalition on first preferences into a/.test(flowNote(D, "lnp", 52)), "a deficit turned: " + flowNote(D, "lnp", 52));
  ok(/inside the ±/.test(flowNote(D0, "lnp", 50.6)) === (verdicts(D0).lnp.who === null), "inside the margin exactly when the verdict is level");
}

/* ---- 3. the built page --------------------------------------------------- */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  const font = fs.readdirSync(path.join(ROOT, "assets", "fonts")).find((f) => /^commissioner-latin\./.test(f));
  ok(!!font, "the site serves the face the page asks for");
  fs.copyFileSync(path.join(ROOT, "assets", "fonts", font), path.join(tmp, "assets", "fonts", font));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  if (fs.existsSync(path.join(ROOT, "data", "np-report.md"))) fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const r = buildDawn({ root: tmp, assets: A });
  const html = fs.readFileSync(r.file, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}|\/\*\{\{STARS\}\}\*\//.test(html), "every placeholder filled");
  ok(fs.existsSync(path.join(tmp, "dawn", r.hist)), "the past terms' sidecar is beside the page");
  ok(html.includes(`href="${r.hist}"`), "and the page names it");
  ok(html.includes(`/assets/fonts/${font}`), "the face from the site's fonts");
  const data = JSON.parse(html.match(/<script id="dawn-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  eq(data.weeks.length, D0.weeks.length, "the page carries the data");
  /* the bar's backdrop is the sky drawn again inside .sky (so it inherits the sky's colours), clipped as the hero
     is, slid one px per px of scroll; this term's lines open on the 2025 count; lines stop at the plot's edges */
  ok(/<div class="sky"[\s\S]*?<div class="twin"><div class="tsky"[\s\S]*?<\/div>\s*<div class="grain" id="grain"/.test(html), "the bar's sky sits inside the hero's sky");
  ok(/\.tsky\{[^}]*overflow:hidden/.test(html) && /translateY\(-8192px\)/.test(html) && /animation-range:0px 8192px/.test(html), "the bar's sky is clipped like the hero and slides with the scroll");
  ok(/\.menu-on \.twin\{visibility:hidden\}/.test(html) && !/\.nav\{[^}]*background:var\(--bg\)/.test(html), "the open menu shows through the bar; the bar itself has no fill");
  ok(/if\(i0===0&&iS<=1\)\{const c=EST\[k\]\[0\]\.m;pts\.push\(\{x:ELX,y:c\}\)/.test(html) && /const open=\(c,a,band\)=>c==='lnp'&&cnt0!=null/.test(html), "this term's primary and Labor v Coalition lines open on the 2025 count");
  ok(/<clipPath id="\$\{cid\}"><rect x="\$\{ML\}" y="\$\{MT-8\}" width="\$\{PW\}"/.test(html), "lines and bands clip at the plot's edges");
  ok(!html.includes("cursor:crosshair"), "chart hover has no crosshair cursor");
  ok(html.includes('svg .vv{font-family:var(--sans);font-style:normal;fill:var(--mute)}'), "the chart's v separators use upright Commissioner");
  ok(!html.includes("data-duel") && /<h2 id="tpp-h">[^<]*<\/h2>\s*<div class="hd-sw"><button type="button" class="rival-toggle" id="tpp-rival-toggle"/.test(html) && (html.match(/class="rival-toggle"/g) || []).length === 2, "one contest pill in the 2PP heading row at every width, no text toggle");
  ok(/\.hd-sw\{display:flex;align-items:center;height:1\.06em;margin:0;font:400 clamp\(25px,min\(7\.3vw,4\.6vh\),46px\)\/1\.06 var\(--serif\)\}/.test(html) && html.includes("h2{font:400 clamp(25px,min(7.3vw,4.6vh),46px)/1.06 var(--serif);"), "the pill's box is one heading line tall in the heading's font, so it centres on that line");
  ok(/\.rival-toggle\{[^}]*padding:5px 9px;[^}]*font:500 13px/.test(html) && /@media\(max-width:899px\)\{[^@]*\.rival-toggle\{gap:4px;padding:4px 7px;font-size:12px\}/.test(html), "full-size pill on wide screens, the smaller one only on phones");
  const polls = fs.readFileSync(path.join(path.dirname(r.file), "polls/index.html"), "utf8");
  ok(/<label class="pick"><span class="pl">Take&nbsp;<\/span><select id="house">/.test(polls) && /\.pick\{position:relative/.test(polls), "the polls page's pollster menu uses Take");
  ok(polls.includes('<option value="">all pollsters</option>') && !/Every pollster|\(\$\{n\}\)/.test(polls), "the polls page's pollster menu carries no counts");
  ok(html.includes('Math.round(fB*.4)'), "the Sankey separator uses the smaller size");
  ok(html.includes(".tpp .ctl2>.hd-sw>.rival-toggle{min-height:32px") && html.includes("row.insertBefore(box,row.querySelector('.opts'))"), "the compact pill and inferred support follow the year selector on desktop");
  ok(html.includes("svg.onclick=e=>") && html.includes("if(i===chosen)clear()") && html.includes("if(!svg.contains(e.target))clear()"), "repeat and outside clicks clear a selected ribbon");
  ok(html.includes("const MT=TIPH+EVH+(evs.length&&!narrow?8:0)"), "eight extra pixels after desktop event labels, and only there");
  const scale = html.match(/S\.y0=0;S\.y1=([^;]+);/);
  ok(!!scale, "the primaries chart's y-axis rule is in the page");
  const primaryYMax = new Function("ys", `return ${scale[1]}`);
  eq(primaryYMax([59.76]), 60, "July 1975's measured peak leaves the All-view axis at 60, not 70");
  eq(primaryYMax([59.32]), 60, "the inferred support peak uses the same axis");
  eq(primaryYMax([60.01]), 70, "a reading actually above 60 still reaches the next rung");
  ok(/class="flip" id="pv-whisker-mode"/.test(html) && !/id="pv-whisker-mode"[^>]*role="switch"/.test(html) && html.includes("Change since May 2025</span> <span aria-hidden=\"true\">⇄") && html.includes("'95% credible intervals'"), "the primary whisker flip names the reading shown and swaps with ⇄");
  ok(html.includes("rangeLabel.textContent=ciMode?'intervals':'since 2025'"), "interval mode replaces the replay's since-2025 label");
  ok(html.includes(".pb s.ci::before{content:") && html.includes(".pb s.ci>b{position:absolute") && html.includes("<s><b></b></s>"), "intervals carry caps at both ends and a central mean marker");
  ok(html.includes(".pb s.ci::after{left:auto;right:-.75px;top:-3.25px;height:8px") && html.includes(".pb s.ci>b{position:absolute;top:-5.25px;") && html.includes("width:1.5px;height:12px"), "interval end caps stay shorter than the central marker");
  ok(html.includes("curLo[k]=LOW[k][j];curHi[k]=HIGH[k][j];curHalf[k]=HALF[k][j]") && html.includes("[[curW,TEN],[curLo,LOW],[curHi,HIGH],[curHalf,HALF]]"), "the interval bounds and half-widths travel with the replay");
  const drawWhisk = (ciMode, snap = false, half = 12.8) => {
    const style = () => ({ values: {}, setProperty(k, v) { this.values[k] = v; } });
    const row = style(), mark = style(), sb = { alp: { className: "", style: mark } }, ds = { alp: {} }, dv = { alp: {} }, fn = html.match(/function renderW\(snap=false\)\{[\s\S]*?\n\}/)[0];
    let delta = 0, plusMinus = false;
    const odoSet = (el, w, pm) => { if (el === dv.alp) { delta = w; plusMinus = pm; } };
    vm.runInNewContext(fn + ";renderW(" + snap + ")", { PK: ["alp"], curW: { alp: 264.8 }, curLo: { alp: 251.9 }, curHi: { alp: 277.5 }, curHalf: { alp: half }, ciMode, THEN: { alp: 340 }, RV: { alp: {} }, DV: dv, DS: ds, SB: sb, rowOf: { alp: { style: row } }, odoSet, sgn: (v) => v.toFixed(1), f1: (v) => v.toFixed(1), pc: (v) => v });
    return { left: +row.values["--l"].toFixed(2), width: +row.values["--d"].toFixed(2), middle: parseFloat(mark.values["--m"]), klass: sb.alp.className, delta: +delta.toFixed(2), plusMinus, sr: ds.alp.textContent };
  };
  const electionWhisk = drawWhisk(false), intervalWhisk = drawWhisk(true), settledWhisk = drawWhisk(true, true, 6.5);
  eq(electionWhisk.left, 26.48, "the default starts at the estimate against the 2025 result");
  eq(electionWhisk.width, 7.52, "the default spans from the estimate to the 2025 result");
  eq(electionWhisk.klass, "dn", "the default marker points down from a lower estimate");
  eq(electionWhisk.delta, -75.2, "the default figure stays a change on 2025");
  eq(electionWhisk.plusMinus, false, "the default figure is signed, not an interval");
  eq(intervalWhisk.left, 25.19, "interval mode starts at the lower bound");
  eq(intervalWhisk.width, 2.56, "interval mode spans low to high");
  eq(intervalWhisk.middle, 50.39, "the mean marker sits within the interval");
  eq(intervalWhisk.klass, "ci", "the interval marker takes the mean-position style");
  eq(intervalWhisk.delta, 12.8, "the interval figure is half the low-to-high span");
  eq(intervalWhisk.plusMinus, true, "the interval figure uses the plus-minus sign");
  eq(intervalWhisk.sr, "±1.3 percentage points, 95% credible interval", "the interval figure is named for screen readers");
  eq(settledWhisk.delta, 7, "a settled half-width snaps to a whole tenth");
  eq(settledWhisk.sr, "±0.7 percentage points, 95% credible interval", "the settled figure names the snapped tenth");
  const C = copyFor(D0);
  for (const k of ["votesHead", "tppHead", "flowsHead"]) ok(html.includes(C[k].replace(/&/g, "&amp;")), k + " in the page");
  ok(html.includes("% of the vote received by the major parties after minor-party votes are distributed"), "the two-party explanatory dek uses the curated wording");
  ok(html.includes(".flow-match h3{margin:0 0 10px;font:500 19.5px var(--sans);color:var(--mute)}") && html.includes(".flow-phone-title{margin:0 0 10px;font:500 19.5px var(--sans)}"), "the Sankey margin heading is 1.5× its former 13px size on both layouts");
  ok(html.includes(".votes .ctl{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px}") && html.includes(".votes .ctl .opts{margin-top:0;flex-shrink:0}"), "the time window and chart filters share a wrapping row");
  ok(/<div class="pick"><span class="pl">Taking&nbsp;<\/span><button[^>]+id="pv-btn"[^>]*><b id="pv-name">all pollsters<\/b><\/button>/.test(html), "Taking is a separate prefix, not text inside the pollster button");
  ok(!/\.votes \.pick \.pl[^{]*\{[^}]*display:none/.test(html), "the filters' lead words stay visible on small screens");
  const primaryHtml = html.slice(html.indexOf('<section class="sec" id="votes"'), html.indexOf('<section class="sec" id="flows"'));
  ok(primaryHtml.indexOf("data-measured") > primaryHtml.indexOf('id="votes-fig"'), "the primary inference toggle sits beneath its chart");
  ok(html.includes('label:"all pollsters"'), "the first pollster menu option uses lowercase all pollsters");
  ok(html.includes('<option value="">all voters</option>') && !html.includes('<option value="">All voters</option>'), "the all-voters option is sentence case");
  ok(html.includes('value="${esc(gl)}">${esc(dawnOptionLabel(gl))}</option>'), "menu labels are formatted separately from canonical option values");
  ok(html.includes('<span data-party="alp" style="color:var(--alp)">Labor</span>') && html.includes('against <span data-party="${RIV}" style="color:var(--${RIV})">${RIV===\'lnp\'?\'the \':\'\'}${FNAME[RIV]}</span>'), "the Sankey margin colours 'the Coalition' as one party label");
  ok(html.includes("color:var(--${lead>0?'alp':RIV})") && html.includes("header.style.color='var(--mute)'"), "the signed lead follows the winner, with the other connecting words neutral");
  ok(html.includes('name="robots" content="noindex"'), "a trial: kept out of search");
  ok(/const STARS=\[/.test(html), "the sky's stars");
  ok(!html.includes(".skyset") && !html.includes('role="radiogroup" aria-label="Sky"'), "Sky’s Auto, Sunrise and Sunset controls are absent");
  ok(html.includes("const pickMode=") && html.includes("sky.dataset.mode=mode"), "Sky stays automatic by local time instead of a menu choice");
  ok(/window\.AP\.pmEngine\s*=/.test(html), "the browser copy of the model, for the pollster menu");
  ok(!!r.groups && fs.existsSync(path.join(tmp, "dawn", r.groups)) && html.includes(`href="${r.groups}"`), "the vote-by-group sidecar beside the page, named by it");
  ok(/^ghist\.[0-9a-f]{8}\.json$/.test(r.ghist) && fs.existsSync(path.join(tmp, "dawn", r.ghist)) && html.includes(`href="${r.ghist}"`), "the groups' past terms in a sidecar of the page's own");
  ok(!/href="#lead"/.test(html) && /href="polls\/"/.test(html), "one votes link, and the polls page");
  /* the polls page: every poll a dot can open has its row */
  ok(!!r.polls && fs.existsSync(r.polls), "the polls page is built");
  const ph = fs.readFileSync(r.polls, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}/.test(ph), "every polls-page placeholder filled");
  ok(ph.includes("<h1>Federal opinion polls</h1>"), "the polls-page heading survives regeneration");
  ok(ph.includes('<p class="dek">From 13 pollsters, with the newest first. Open a poll for details.</p>'), "the polls-page dek survives regeneration");
  const pollScript = ph.match(/<script>([\s\S]*?)<\/script>/);
  ok(!!pollScript, "the ledger's whole client is present");
  new vm.Script(pollScript[1]);
  const PL = JSON.parse(ph.match(/<script id="polls-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).polls;
  const keys = new Set(PL.map((q) => q.k));
  eq(keys.size, PL.length, "each poll's address is its own");
  ok(D0.polls.every((q) => keys.has(q.k)), "every chart poll's dot has a row to open");
  ok(PL.every((q, i) => !i || PL[i - 1].d >= q.d), "newest first");
  ok(/href="\.\.\/#votes"/.test(ph), "the polls page leads back to the votes pages");
  /* the pages point inside dawn/ but for the favicon and the face: a site
     asset renamed by a commit made without this page would tear the tree */
  ok(!!r.next && fs.existsSync(r.next), "the next-polls page is built");
  const nh = fs.readFileSync(r.next, "utf8");
  ok(!/\{\{[A-Za-z]+\}\}/.test(nh), "every next-page placeholder filled");
  ok(nh.includes(".dek:empty{display:none}") && nh.includes(".hd + .blk{margin-top:clamp(16px,2vh,24px)}"), "the next-polls heading gap is tightened when the summary is empty");
  ok(/window\.AP\.nextPolls\s*=\s*npProject/.test(nh) && /AP\.nextWords\s*=/.test(nh), "the site's projection and its words, inlined");
  const NX = JSON.parse(nh.match(/<script id="next-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  ok(NX.pollCadence.length >= 5 && NX.pollCadence.every((c) => c.tracked !== "confidence"), "every house on a pattern, the confidence gauges left out");
  ok(!!NX.score && NX.score.overall.n > 0, "np-score's record rides along");
  ok(/href="\.\.\/next\/"/.test(ph) && /href="\.\.\/polls\/"/.test(nh) && !/>next polls</.test(html + ph + nh), "the two polls pages link each other through their tabs; no menu lists next polls");
  const outside = [html, ph, nh].flatMap((h) => [...h.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]))
    .filter((u) => u !== "/assets/favicon.svg" && u !== `/assets/fonts/${font}`);
  eq(outside.length, 0, "every local reference stays inside dawn/ " + outside.join(", "));
  ok(/class="logo"/.test(html) && /class="logo"/.test(ph) && /\.nav:not\(\.over\) \.logo\{/.test(html), "the mark's sun, shown once the hero has gone");
  fs.rmSync(tmp, { recursive: true, force: true });
}
/* ---- 4. the next-polls page: the projection and its words on mocked clocks -------- */
{
  const ND = JSON.parse(fs.readFileSync(path.join(A, "dawn-next.json"), "utf8"));
  const ctx = vm.createContext({ Intl, console });
  ctx.window = ctx;
  ctx.AP = { D: { pollCadence: ND.pollCadence, subCadence: ND.subCadence } };
  vm.runInContext(fs.readFileSync(path.join(A, "np-project.js"), "utf8"), ctx, { filename: "np-project.js" });
  vm.runInContext(fs.readFileSync(path.join(HERE, "dawn", "next-copy.js"), "utf8"), ctx, { filename: "next-copy.js" });
  const W = ctx.AP.nextWords, DAY = 86400000;
  const score = readScore(path.join(ROOT, "data", "np-report.md"));
  if (fs.existsSync(path.join(ROOT, "data", "np-report.md"))) {
    ok(!!score, "np-score's report reads: its overall line has the shape the reader expects");
    ok(score.overall.n >= score.overall.h && Object.keys(score.houses).length > 0 && Object.keys(score.ledger).length > 0 && !!score.sinceLabel, "its houses, its ledger and when it began");
  }
  const RULE = {
    today: /^.+ (is|are) due (tonight|this afternoon|this morning|today)$/,
    notout: /^.+ (was due today and isn’t out yet|were due today and aren’t out yet)$/,
    late: /^.+ (is|are) (a day |\w+ days )?late$/,
    next: /^.+ (is|are) due (tomorrow|on (Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day|on \d{1,2} [A-Z][a-z]+)$/,
    window: /^(.+ is expected \d{1,2}[–\d ]*[A-Z][a-z]+.*|.+’s window is open)$/,
    summer: /^Polls return after the summer break$/,
    none: /^No polls are scheduled$/,
  };
  /* sweep the coming eleven weeks at four times of day, the clock as the page reads it (Sydney) */
  const today = Date.UTC(...new Date().toISOString().slice(0, 10).split("-").map((v, i) => +v - (i === 1 ? 1 : 0)));
  const seen = {};
  for (let d = 0; d < 77; d++) for (const mins of [6 * 60, 12 * 60 + 30, 19 * 60, 22 * 60 + 30]) {
    const proj = ctx.AP.nextPolls({ day: today + d * DAY, mins }, { horizonDays: 49, includeTracked: true });
    const c = W.copy(proj, score);
    assert.ok(RULE[c.kind] && RULE[c.kind].test(c.head), `head off its rule (${c.kind}): ${c.head}`);
    assert.ok(!/next four weeks|own rhythm|slipping a week/.test(c.dek), "the dek omits the removed projection and accuracy summaries: " + c.dek);
    assert.ok(!proj.rows.filter((r) => r.tracked).some((r) => c.lead.includes(r.pollster)), "no direction or issues survey is ever the next poll");
    (seen[c.kind] ||= c.head);
  }
  n++;
  for (const k of ["today", "next", "summer"]) ok(!!seen[k], `the sweep reaches the ${k} head (${Object.keys(seen).join(", ")})`);
  ok(!!(seen.late || seen.notout), "the sweep reaches a slot passed with no poll on record");
  /* the branches no schedule this year need reach, on hand-built rows */
  const T = today, row = (o) => ({ ahead: 0, loose: false, overdue: false, missed: false, inDays: 0, release: T, spread: 0, winHalf: 0, opensIn: 0, closesIn: 0, cadence: 14, ...o });
  const C = (rows) => W.copy({ rows, t0: T, nowMs: T + 9 * 3600000 }, null);
  eq(C([row({ pollster: "A", releaseFrom: 19 * 60, releaseTo: 20 * 60 }), row({ pollster: "B", releaseFrom: 18 * 60, releaseTo: 18 * 60 })]).head, "A and B are due tonight", "two due tonight");
  eq(C([row({ pollster: "A", releaseFrom: 9 * 60, releaseTo: 10 * 60 }), row({ pollster: "B", releaseFrom: 18 * 60, releaseTo: 18 * 60 })]).head, "A and B are due today", "hours that straddle the day: today");
  eq(C([row({ pollster: "A" })]).head, "A is due today", "an untimed house: today");
  eq(C([row({ pollster: "A", overdue: true, releaseFrom: 480, releaseTo: 480 })]).head, "A was due today and isn’t out yet", "its hour passed");
  eq(C([row({ pollster: "A", inDays: -1, overdue: true, missed: true, release: T - DAY }), row({ pollster: "B", inDays: -2, overdue: true, release: T - 2 * DAY })]).head, "A and B are late", "late by different days");
  eq(C([row({ pollster: "A", inDays: 3, release: T + 3 * DAY })]).head, "A is due on " + W.WDF[new Date(T + 3 * DAY).getUTCDay()], "inside the week: the weekday");
  eq(C([row({ pollster: "A", inDays: 12, release: T + 12 * DAY })]).head, "A is due on " + W.dmf(T + 12 * DAY), "further out: the date");
  eq(C([row({ pollster: "A", loose: true, inDays: 9, release: T + 9 * DAY, spread: 4, opensIn: 5, closesIn: 13 })]).head, "A is expected " + W.spanF(T + 5 * DAY, T + 13 * DAY), "a window ahead");
  eq(C([row({ pollster: "A", loose: true, inDays: 2, release: T + 2 * DAY, spread: 4, opensIn: -2, closesIn: 6 })]).head, "A’s window is open", "a window open");
  eq(C([row({ pollster: "A", loose: true, summer: true, inDays: 40, release: T + 40 * DAY, spread: 11, opensIn: 29, closesIn: 51 })]).head, "Polls return after the summer break", "the summer break");
  eq(C([]).head, "No polls are scheduled", "nothing on the schedule");
  eq(C([row({ pollster: "A", tracked: "direction", inDays: 1, release: T + DAY }), row({ pollster: "B", inDays: 5, release: T + 5 * DAY })]).lead.join(), "B", "a direction survey is no next poll");
  eq(C([row({ pollster: "A" }), row({ pollster: "B" }), row({ pollster: "C" }), row({ pollster: "D" })]).head, "Four polls are due today", "four or more are counted");
}
/* linked from nowhere */
{
  const hits = ["index.html", "info/index.html", "allpolls/index.html"].filter((f) => fs.existsSync(path.join(ROOT, f)) && /href="\/?dawn\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  eq(hits.length, 0, "no page links /dawn/");
}
console.log(`PASS: dawn – ${n} checks: data ends on the site's figures, every copy branch, the built pages, the next polls on mocked clocks`);
