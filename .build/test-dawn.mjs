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
   5. the leadership ratings page: today's figures are the site's own, its
      weeks and ranks hold together, every branch of its head, and the built
      page whole with the blocks it shares with the votes page; its
      favourability chart the same;
   6. the mood page: today's direction and trust are the site's own, every
      branch of its heads and dek, and the built page;
  12. the public opinion page: a slide a finding off the site's sidecar, the
      site's styles and component carried whole, and the built page.
   Run: node .build/test-dawn.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { votesHead, votesDek, tppStory, flowsHead, flowNote, verdicts, copyFor, leadersHead, leadersDek, leaderMoves, favHead, favDek, moodHead, moodDek, trustHead, trustDek, lifeHead, lifeDek, plainShare, tenthShare, ppmHead, ppmDek, cycleRank, cycleRankLine, cycleHead, cycleDek, cycleLit, cycleMode, cycleChapeau, cycleStatsHtml, cycleNow, CYCLE_STATS, splitChapeau, splitHead, splitDek, splitMonths, spreadHead, spreadDek, spreadNow } from "./dawn/copy.mjs";
import { latestPollLine, pollPublishedMs } from "./dawn/poll-meta.mjs";
import { sharePosterior, credibleBounds, significantChange } from "./dawn/poll-intervals.mjs";
import { pollHeading } from "./dawn/poll-heading.mjs";
import { sigTriangle, sigMark } from "./dawn/sig-triangle.mjs";
import { disagreeData, engine } from "./dawn/disagree-data.mjs";
import { emapData, groupOf, GROUPS, YEARS } from "./dawn/emap-data.mjs";
import { heroSlides, newestPublished, rowQuestions, pubopCss, HERO_ROWS } from "./dawn/po-data.mjs";
import { emapChapeau, emapHead, opinionLede, closestHead, closestSeats } from "./dawn/copy.mjs";
import { decidedData, decidedStory, partyStory, ageStory, ofHundred, oneIn, oneInShare } from "./dawn/decided-data.mjs";
import { buildDawn, flowTotals, readScore, sharedBlock } from "./dawn/build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const A = path.join(HERE, "newtracker", "assets");
const D0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-data.json"), "utf8"));
const clone = () => JSON.parse(JSON.stringify(D0));
const r1 = (v) => Math.round(v * 10) / 10;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m); n++; };

/* demographics' comparison sentences name every party in its Dawn colour */
{
  const css = fs.readFileSync(path.join(HERE, "dawn", "template-demographics.html"), "utf8");
  const { demographicsMarkup } = await import("./dawn/demographics.mjs");
  for (const [key, token] of [["alp", "alp"], ["onp", "on"], ["lnp", "lnp"], ["grn", "grn"]]) {
    ok(css.includes(`.finding .party-name.${key}{color:var(--${token})}`), `demographics: ${key}'s finding text uses the Dawn ${token} colour`);
  }
  const findings = demographicsMarkup.findings().split('<div id="finding-').slice(1);
  eq(findings.length, 6, "one comparison per facet");
  const panels = demographicsMarkup.panels();
  const widths = [...panels.matchAll(/class="demo-interval" style="left:[^;]+;width:([\d.]+)%"/g)];
  eq(widths.length, 88, "one interval per demographic estimate");
  ok(widths.every(match => Number(match[1]) > 0), "every plotted interval has positive width");
  for (const finding of findings)
    eq((finding.match(/class="party-name (alp|onp|lnp|grn)"/g) || []).length, 2, "both comparison parties carry their colour class");
}

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
  for (const eb of [null, "TBC", "missing", "~790"]) {
    ok(pollHeading({ ...E, se: null, eb }).includes("(eff. undisclosed)"), "an unfiled effective sample is undisclosed, including " + eb);
  }
  ok(!pollHeading({ ...E, se: null, eb: "~790" }).includes("Estimated from the raw sample"), "no model-estimate tooltip remains on the raw sample");
  ok(pollHeading({ ...E, se: null, eb: null, h: "Roy Morgan", c: "Self-published", n: 1500 }, 1.5).includes("(eff. undisclosed)"), "a design-effect estimate is not presented as the house's figure");
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
  ok(html.includes('#tpp:has(#cmp-pub[aria-checked="true"]):has(#cmp-ext[aria-checked="true"])') && html.includes("var(--ext) + 57px") && !html.includes(".tpp .keys{min-height:84px"), "comparison rows expand their panel instead of shrinking the originally taller plot");
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
  eq((html.match(/S\.govShade=1/g) || []).length, 2, "the primary and 2PP scenes both retain government shading under long-window events");
  for (const k of ["votesHead", "tppHead", "flowsHead"]) ok(html.includes(C[k].replace(/&/g, "&amp;")), k + " in the page");
  ok(html.includes("% of the vote received by the major parties after minor-party votes are distributed, under preference-flow assumptions"), "the two-party explanatory dek names its preference-flow assumptions");
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
  ok(!/\.hero\{[^}]*cursor:pointer/.test(html), "the non-clickable sun and hero do not show a pointer cursor");
  ok(html.includes("function settleOutcomeLabels(svg, upLimit, dnLimit)") && html.includes("if (!touches(label)) continue;"), "2PP labels keep their normal positions unless a data series touches them");
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
  ok(ph.includes("@media(max-width:40em){.ctl .search{flex:1 0 100%;max-width:none}.ctl .pick .pl{display:none}}"), "phone search is full-width above the compact pollster and date filters");
  ok(ph.includes("const effTxt=p=>p.se != null?") && ph.includes(":'eff. undisclosed';"), "unfiled row-level effective samples read undisclosed");
  ok(ph.includes('<div class="measure-line"><h2 id="measure-plain" hidden></h2><h2 class="fopt" data-for="primary"><button type="button" class="vote-flip" id="vote-mode"'), "the primary measure heading carries the voting-mode toggle");
  const filterMarkup = ph.slice(ph.indexOf('<div class="ctl">'), ph.indexOf('<div class="measure-line">'));
  ok(!filterMarkup.includes('id="vote-mode"'), "the filters do not duplicate the primary heading's toggle");
  const pollScript = ph.match(/<script>([\s\S]*?)<\/script>/);
  ok(!!pollScript, "the ledger's whole client is present");
  new vm.Script(pollScript[1]);
  ok(ph.includes("primary:'Voting intention (%)'") && ph.includes("const measure=showingConsideration?'Voting consideration (%)':facetTitle[F]"), "the primary facet names voting intention and voting consideration");
  ok(ph.includes("$('#method-key').innerHTML=showingConsideration?'Which parties voters <em>would consider</em> supporting':F==='primary'?'First preferences'"), "the primary subtitles distinguish first preferences with an italic would-consider phrase");
  const undecidedFor = vm.runInNewContext(ph.slice(ph.indexOf("function undecided(p){"), ph.indexOf("function resultCells(p){")) + ";undecided", { num: String });
  eq(undecidedFor({ h: "Resolve", b: "F", u: { v: 0, label: "not allowed" } }), "0%, forced choice", "Resolve shows its forced-choice zero");
  eq(undecidedFor({ h: "Another house", b: "F", u: { v: 0, label: "not allowed" } }), "Forced choice", "the Resolve wording change does not leak to other houses");
  eq(undecidedFor({}), "Unreported", "an unreported undecided value is unchanged");
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
/* the leadership ratings */
{
  const L0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-leaders.json"), "utf8")), copy = () => JSON.parse(JSON.stringify(L0));
  const data = fs.readFileSync(path.join(A, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const now = JSON.parse(data.match(/const leaderNow = (.*);\n/)[1]);
  const KEY = { Albanese: "alb_net", Taylor: "taylor_net", Hanson: "hanson_net" }, LW = L0.weeks.length - 1;
  const running = L0.series.filter((x) => !x.to);
  eq(running.length, 3, "three leaders today");
  for (const x of running) {
    eq(r1(x.v[x.v.length - 1]), now[KEY[x.person]].v, `${x.person}'s last week is the site's figure`);
    eq(x.i0 + x.v.length - 1, LW, `${x.person}'s line reaches the last week`);
  }
  for (const x of L0.series) ok(x.v.length === x.lo.length && x.v.length === x.hi.length && x.v.every((v, i) => x.lo[i] <= v && v <= x.hi[i]), `${x.id}: each week inside its interval`);
  eq(L0.rank.length, L0.weeks.length, "a ranking for every week");
  for (const o of ["pm", "opp"]) ok(L0.weeks.every((w, i) => L0.series.filter((x) => x.role === o && i >= x.i0 && i < x.i0 + x.v.length).length <= 1), `one ${o} a week`);
  ok(L0.polls.every((p) => L0.series[p.s] && Number.isFinite(p.net)) && L0.past.every((p) => L0.people[p[2]]), "every dot belongs to a leader");
  ok(L0.history.every((h) => h.m.every((m) => m[0] < 2025.4)), "the past lines stop at the election");
  /* the head: only a change whose interval clears zero, the largest first */
  const flat = copy(); for (const x of flat.series) x.since = { chg: 3, lo: -2, hi: 8 };
  eq(leadersHead(flat).head, "The leaders’ ratings are much where they started", "nothing clears");
  const one = copy(); for (const x of one.series) x.since = { chg: -30, lo: -40, hi: 1 };
  const han = one.series.find((x) => x.person === "Hanson"); han.since = { chg: 12.34, lo: 1, hi: 20 };
  ok(/^Hanson’s net rating has risen 12\.3 points since [A-Z][a-z]+ 20\d\d$/.test(leadersHead(one).head), "a smaller change that clears beats larger ones that don't; a first rating after polling day dates its start");
  const took = copy(); for (const x of took.series) x.since = { chg: 0, lo: -1, hi: 1 }; took.series.find((x) => x.person === "Taylor").since = { chg: -9, lo: -15, hi: -3 };
  eq(leadersHead(took).head, "Taylor’s net rating has fallen 9.0 points since taking the job", "a leader who took over");
  const pm = copy(); for (const x of pm.series) x.since = { chg: 0, lo: -1, hi: 1 }; pm.series.find((x) => x.person === "Albanese").since = { chg: -20, lo: -28, hi: -12 };
  eq(leadersHead(pm).head, "Albanese’s net rating has fallen 20.0 points since the election", "a line from polling day");
  ok(leaderMoves(L0).every((m) => m.person !== "Ley"), "a leader who has gone leads no head");
  /* favourability: the same lines read through the favourability pollsters */
  const KF = { Albanese: "alb_fav", Taylor: "taylor_fav", Hanson: "hanson_fav" };
  for (const x of L0.fav.series.filter((q) => !q.to)) {
    if (now[KF[x.person]]) eq(r1(x.v[x.v.length - 1]), now[KF[x.person]].v, `${x.person}'s favourability today is the site's figure`);
    eq(x.i0 + x.v.length - 1, LW, `${x.person}'s favourability reaches the last week`);
  }
  for (const x of L0.fav.series) ok(x.v.length === x.lo.length && x.v.every((v, i) => x.lo[i] <= v && v <= x.hi[i]), `${x.id}: favourability inside its interval`);
  ok(L0.fav.polls.every((p) => L0.fav.series[p.s] && Number.isFinite(p.net)) && L0.fav.past.every((p) => L0.people[p[2]]), "every favourability dot belongs to a leader");
  const nofav = copy(); for (const x of nofav.fav.series) x.since = { chg: 2, lo: -3, hi: 7 };
  eq(favHead(nofav).head, "The leaders’ favourability is much where it started", "no favourability change clears");
  const fall = copy(); for (const x of fall.fav.series) x.since = { chg: 0, lo: -1, hi: 1 }; fall.fav.series.find((x) => x.person === "Albanese").since = { chg: -12, lo: -18, hi: -6 };
  eq(favHead(fall).head, "Albanese’s net favourability has fallen 12.0 points since the election", "the favourability head");
  eq(leadersDek(L0), "% approving each leader’s job performance less % disapproving, since the May 2025 election", "the owner's wording, job performance");
  eq(favDek(L0), "% having a favourable opinion of each leader less % unfavourable, since the May 2025 election", "the owner's wording, favourability");
  /* preferred prime minister: today's shares are the site's, and the head's every branch */
  const SITE_PPM = { "pm-opp": "alb_prefD", "alb-han": "alb_prefHD" };
  for (const p of L0.ppm.series.filter((q) => !q.to)) {
    eq(r1(p.v[p.v.length - 1]), now[SITE_PPM[p.contest]].v, `Albanese v ${p.opp} today is the site's figure`);
    eq(p.i0 + p.v.length - 1, LW, `Albanese v ${p.opp} reaches the last week`);
  }
  ok(L0.ppm.polls.every((p) => L0.ppm.series[p.s] && p.v > 0 && p.v < 100), "every preferred-PM dot belongs to a pairing, on the two-way basis");
  const pair = (contest, opp, lo, hi, to) => ({ contest, pm: "Albanese", opp, lead: { v: (lo + hi) / 2, lo, hi }, ...(to ? { to } : {}) });
  const PH = (...series) => ppmHead({ ppm: { series } });
  eq(PH(pair("alb-han", "Hanson", 6, 20), pair("pm-opp", "Taylor", -9, 5)), "Albanese and Taylor are level as preferred prime minister; Albanese leads Hanson", "level and ahead, the opposition first");
  eq(PH(pair("pm-opp", "Taylor", 2, 12), pair("alb-han", "Hanson", 6, 20)), "Albanese leads both Taylor and Hanson as preferred prime minister");
  eq(PH(pair("pm-opp", "Taylor", -14, -2), pair("alb-han", "Hanson", -3, 5)), "Taylor leads Albanese as preferred prime minister; Albanese and Hanson are level");
  eq(PH(pair("pm-opp", "Ley", 2, 12, "2026-02-13"), pair("pm-opp", "Taylor", -9, 5)), "Albanese and Taylor are level as preferred prime minister", "a pairing that has ended says nothing");
  eq(PH(), "Preferred prime minister");
  eq(ppmDek(L0), "% preferring each as prime minister, of those who chose one of the two, since the May 2025 election");
  /* the built page */
  const base = fs.readFileSync(path.join(HERE, "dawn", "template.html"), "utf8");
  for (const k of ["css", "logo", "sky", "dates", "window", "chart", "events", "odometer", "nav"]) ok(sharedBlock(base, k).length > 100, `template.html marks the shared block ${k}`);
  assert.throws(() => sharedBlock(base, "missing")); n++;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-lead-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).leaders, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "every placeholder filled");
  eq(JSON.parse(built.match(/<script id="dawn-data" type="application\/json">(.*?)<\/script>/s)[1]).asOf, L0.asOf, "its data parses");
  const js = built.slice(built.lastIndexOf("<script>") + 8, built.lastIndexOf("</script>"));
  new vm.Script(js); n++;
  ok(built.includes(leadersHead(L0).head) && built.includes(leadersDek(L0)), "the head and dek are today's rules");
  ok(built.includes(favHead(L0).head) && built.includes(favDek(L0)) && /id="fav-svg"/.test(built), "the favourability chart and its words");
  eq((built.match(/data-win aria-label/g) || []).length, 3, "three charts, a window each");
  ok(built.indexOf('id="ratings-svg"') < built.indexOf('id="ppm-svg"') && built.indexOf('id="ppm-svg"') < built.indexOf('id="fav-svg"'), "preferred PM sits between job performance and favourability");
  ok(built.includes(ppmHead(L0)) && built.includes(ppmDek(L0)), "the preferred-PM words");
  ok(built.includes("function windowedChart("), "each chart its own window");
  ok(/name="robots" content="noindex"/.test(built), "unlisted");
  ok(built.includes("const POLLS_HREF='../polls/'"), "its dots open the polls page");
  ok(built.includes("tip.addEventListener('mousedown',e=>e.preventDefault());"), "the readout's link survives its own press");
  ok(built.includes("direct:true};") && built.includes("q:'?facet=leaders'"), "a pressed dot opens its poll on the Leaders view");
  const rows = new Set(JSON.parse(fs.readFileSync(path.join(A, "dawn-polls.json"), "utf8")).polls.map((p) => p.k));
  ok(L0.polls.concat(L0.fav.polls, L0.ppm.polls).every((p) => rows.has(p.k)), "every rating dot this term has a row in the polls table");
  ok(/<div class="cols still" id="pv"/.test(built) && /\.cl-bar\{/.test(built) && built.includes("r.style.transform=`translateX("), "the hero is a column chart that trades places sideways");
  for (const f of ["template.html", "template-polls.html", "template-next.html"]) ok(/href="(\.\.\/)?leadership-ratings\/">leadership ratings</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists the page`);
}
/* the mood */
{
  const M0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-mood.json"), "utf8")), copy = () => JSON.parse(JSON.stringify(M0));
  const data = fs.readFileSync(path.join(A, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const grabM = (name) => JSON.parse(data.match(new RegExp(`const ${name} = (.*);\n`))[1]);
  const dir = grabM("directionNow"), tg = grabM("trustGov"), W = M0.weeks.length - 1;
  eq(r1(M0.right.v[W]), dir.right, "today's right direction is the site's");
  eq(r1(M0.wrong.v[W]), dir.wrong, "today's wrong track is the site's");
  eq(M0.unsure[W], dir.unsure, "today's unsure is the site's");
  eq(M0.trust.now.v, tg.model.now.v, "today's trust is the site's");
  eq(M0.life.now.v, grabM("lifeSat").model.now.v, "today's life satisfaction is the site's");
  const lf = copy(); lf.life.now = { v: 6.3, lowest: null, election: { date: "2025-05-03", chg: -0.12, sig: false }, year: { chg: -0.12, sig: false } };
  lf.life.latestPrint = { ym: "2026-06", v: 6.22, lowest: true };
  eq(lifeHead(lf), "Australians rate their lives 6.3 out of 10", "no superlative the model doesn't carry");
  ok(lifeDek(lf).includes("Not significantly changed since just after the May 2025 election."), "no change claimed inside the interval");
  ok(lifeDek(lf).endsWith("printed 6.22 in June 2026, the lowest of any wave on file."), "ANUpoll's own low is its prints'");
  lf.life.latestPrint.lowest = false; lf.life.now.lowest = { since: "2020-04" }; lf.life.now.election = { date: "2025-05-03", chg: -0.3, sig: true };
  eq(lifeHead(lf), "Australians rate their lives 6.3 out of 10, the lowest since April 2020", "the model's own superlative");
  ok(lifeDek(lf).includes("Down 0.30 points since just after the May 2025 election.") && lifeDek(lf).endsWith("in June 2026."), "a significant fall is named, and no low claimed");
  eq(M0.weeks[0], M0.election.date, "the weeks open on polling day");
  for (const k of ["right", "wrong"]) ok(M0[k].v.length === M0.weeks.length && M0[k].v.every((v, i) => M0[k].lo[i] <= v && v <= M0[k].hi[i]), `${k}: a figure a week, inside its interval`);
  ok(M0.weeks.every((w, i) => Math.abs(M0.right.v[i] + M0.wrong.v[i] + M0.unsure[i] - 100) < 0.2), "the bar's three parts make the whole every week");
  ok(M0.polls.every((p) => p.m >= M0.election.date && p.r > 0 && p.w > 0) && M0.pastPolls.every((p) => p[0] < M0.election.date), "the dots divide at the election");
  /* the heads: plain fractions, and a superlative only when the line bears it out */
  eq(plainShare(62), "More than three in five"); eq(plainShare(58.9), "Almost three in five"); eq(plainShare(25.2), "About one in four"); eq(plainShare(50.1), "About half of");
  const top = copy(); top.wrong.v = top.wrong.v.map(() => 55); top.right.v = top.right.v.map(() => 30); top.wrong.v[W] = 62;
  eq(moodHead(top), "More than three in five say Australia is on the wrong track, the most this term", "today's is the term's highest");
  top.wrong.v[3] = 63;
  eq(moodHead(top), "More than three in five say Australia is on the wrong track", "a higher week drops the claim");
  const sunny = copy(); sunny.right.v = sunny.right.v.map(() => 70); sunny.right.v[W] = 58; sunny.wrong.v = sunny.wrong.v.map(() => 30);
  eq(moodHead(sunny), "Almost three in five say Australia is heading in the right direction", "the right direction ahead");
  const t = copy(); t.trust.now = { v: 26, low2020: null, year: { chg: -1, sig: false } };
  eq(trustHead(t), "Fewer than three in ten Australians say people in government can be trusted to do the right thing");
  for (const [v, w] of [[27.4, "Fewer than three in ten"], [25, "Fewer than three in ten"], [24.9, "More than two in ten"], [30.4, "About three in ten"], [29.6, "About three in ten"], [32, "More than three in ten"], [4, "Fewer than one in ten"], [7, "Fewer than one in ten"]]) eq(tenthShare(v), w, "trust in tenths at " + v);
  ok(trustDek(t).endsWith("Not significantly changed on a year earlier."), "no change claimed inside the interval");
  t.trust.now = { v: 26, low2020: { since: "2020-01" }, year: { chg: 5.25, sig: true } };
  ok(trustHead(t).endsWith(", the lowest since January 2020"), "the model's own superlative");
  ok(trustDek(t).endsWith("Up 5.3 points on a year earlier."), "a significant rise is named");
  /* the built page */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-mood-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).mood, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "mood: every placeholder filled");
  const moodData = JSON.parse(built.match(/<script id="dawn-data" type="application\/json">(.*?)<\/script>/s)[1]);
  eq(moodData.asOf, M0.asOf, "mood: its data parses");
  const readings = moodData.lifeHistory.flatMap(s => s.readings.map(([date, raw, converted]) =>
    ({ date, key: s.key, raw, value: converted ?? (s.scale === "0–100" ? raw / 10 : raw) })));
  ok(readings.every(r => Number.isFinite(r.value) && r.value >= 0 && r.value <= 10), "all historical scores are on the plotted scale");
  eq(readings.find(r => r.date === "1948").value, 6.68, "Gallup's three-category responses use the archive's conversion");
  eq(readings.find(r => r.key === "phone" && r.date === "2024-06").value, 7.5, "the 2024 phone sample is retained");
  eq(readings.find(r => r.key === "online" && r.date === "2024-06").value.toFixed(2), "6.77", "the parallel online sample has its own score");
  eq(moodData.life.months[0][4], "2019-10", "historical dots do not extend the fitted line");
  new vm.Script(built.slice(built.lastIndexOf("<script>") + 8, built.lastIndexOf("</script>"))); n++;
  ok([moodHead(M0), moodDek(M0), trustHead(M0), trustDek(M0), lifeHead(M0), lifeDek(M0)].every((w) => built.includes(w)), "mood: its words are today's rules");
  ok(built.includes('id="life-svg"') && built.includes("wLife=windowedChart"), "mood: life satisfaction has its own chart window");
  eq((built.match(/S\.govShade=1/g) || []).length, 3, "direction, trust and life satisfaction opt into retained government shading under long-window events");
  for (const id of ["direction", "trust", "life", "cohesion"]) {
    ok(built.includes('aria-controls="questions-' + id + '"') && built.includes('<dialog class="q-panel" id="questions-' + id + '"'), "mood: question link opens the guide for " + id);
  }
  ok(built.includes('class="seg" role="radiogroup" aria-label="Cohesion measure"'), "mood: cohesion uses the Dawn segmented control");
  ok(built.includes("S.events=winEvents("), "mood: every long-range mood view has event data, including cohesion's all-history view");
  ok(built.includes("S.govs&&(!evs.length||S.govShade)"), "the shared renderer can preserve government fills under event rules");
  ok(built.includes("if(evs.length)B.forEach(v=>v.nm='')"), "government names yield to event names when both would collide");
  ok(/name="robots" content="noindex"/.test(built), "mood: unlisted");
  ok(built.includes("direct:true};") && built.includes("q:'?facet=direction'"), "mood: a pressed dot opens its poll on the Direction view");
  const rows = new Set(JSON.parse(fs.readFileSync(path.join(A, "dawn-polls.json"), "utf8")).polls.map((p) => p.k));
  ok(M0.polls.every((p) => (p.k ? rows.has(p.k) : p.h === "Ipsos" || p.h === "McKinnon")), "mood: only Ipsos and McKinnon, which the polls table doesn't carry, have no row");
  ok(/class="md-bar"[^>]*><i class="y"><\/i><i class="u"><\/i><i class="n"><\/i><\/div>/.test(built) && /\.md-bar\{[^}]*border-radius:999px;overflow:hidden/.test(built), "the hero is one rounded bar: right, unsure, wrong");
  ok(/--yes:#0b8f8c;--no:#8e1f41;--neu:#a7a2ae/.test(built), "turquoise, burgundy and grey");
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html"]) ok(/href="(\.\.\/)?mood\/">mood</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists the mood page`);
}
/* past cycles */
{
  const C0 = JSON.parse(fs.readFileSync(path.join(A, "dawn-cycles.json"), "utf8")), N = cycleNow(C0);
  const data = fs.readFileSync(path.join(A, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
  const defs = JSON.parse(data.match(/const CYCLE_DEFS = (.*);\n/)[1]), site = defs.find((c) => c.current), cur = C0.terms.find((x) => x.current);
  const last = (a) => a[a.length - 1];
  for (const k of ["tpp", "primary", "oppr"]) eq(cur[k][N], r1(last(site[k]) - site[k][0]), `this term's ${k} change is the site's`);
  eq(cur.net[N], last(site.net), "this term's net approval is the site's");
  eq(cur.ppmm[N], last(site.ppmm), "this term's preferred-PM lead is the site's");
  /* week by week to the day */
  ok(C0.days.every((d, i) => (i < N ? d === 7 * i : d >= 7 * (i - 1) && d < 7 * i + 1)), "a point a week, the last at the day this term has reached");
  eq(C0.days[N], Math.round((Date.parse(C0.asOf.slice(0, 10)) - Date.parse(C0.election.date)) / 864e5), "that day is the newest poll's");
  ok(C0.terms.every((x) => ["tpp", "primary", "oppr", "net", "ppmm"].every((k) => x[k].length === C0.days.length)), "every term on the same grid");
  const t49 = C0.terms.find((x) => x.year === 1949), t72 = C0.terms.find((x) => x.year === 1972);
  ok(t49.primary[N] == null && t72.primary[N] == null, "a term that had ended has no figure");
  const t74 = C0.terms.find((x) => x.year === 1974);
  eq(t74.govLead, "Whitlam", "a vote line is the elected government's, not the caretaker's");
  ok(t74.brk.net.length >= 1, "a line breaks where the leader changes");
  eq(cycleChapeau(C0), C0.months + " months in:", "said in whole months");
  /* every branch of the rank */
  const mk = (vals, now, key = "primary") => ({ months: 18, days: [0, 7], terms: [...vals.map((v, i) => ({ base: { primary: 100, oppr: 100 }, year: 1990 + 3 * i, govLead: "L" + i, pm: "L" + i, oppParty: "O" + i, [key]: [0, v] })), { base: { primary: 100, oppr: 100 }, year: 2025, current: 1, govLead: "Now", pm: "Now", oppParty: "Opp", [key]: [0, now] }] });
  const line = (vals, now, key) => cycleRankLine(cycleRank(mk(vals, now, key), key || "primary"));
  eq(line([1, -2, 3, 0], -5), "Worst on record, back to 1990");
  eq(line([-9, 2, 1, 0], -5), "Worst since 1990 (L0)");
  eq(line([-9, 2, 1, 0, 3, 4, -6], -5), "Second worst since 1990 (L0)", "only the last term was worse since then");
  eq(line([1, 2, 3, 0, -6], -5), "Second worst on record, back to 1990");
  eq(line([-9, -8, -7, 1], -5), "4th worst of 5 terms");
  eq(line([-9, 2], 1.5), "No decline", "a vote that rose is unranked");
  eq(line([-9, 20, 30, 10], 4, "net"), "Worst since 1990 (L0)", "a leader figure ranks whatever its sign");
  eq(line([-5, 2, 3, 4], -5), "Worst since 1990 (L0)", "a tie counts against this term");
  eq(cycleHead(mk([1, 2, 3], -5), "primary", "points"), "No government on record has lost this much primary vote 18 months in", "the record head");
  eq(cycleHead(mk([1, 2, 3], -5), "primary"), "No government on record has lost a bigger share of its primary vote 18 months in", "the primary charts open on the share");
  eq(cycleHead(mk([-9, 2, 1, 0], -5), "primary", "points"), "Not since L0’s 1990 term has a government lost this much primary vote 18 months in");
  eq(cycleHead(mk([-9, 2, 1, 0], -5), "primary"), "Not since L0’s 1990 term has a government lost this big a share of its primary vote 18 months in");
  eq(cycleHead(mk([-9, 2, 1, 0, -6], -5, "net"), "net"), "Only one prime minister since L0’s 1990 term has been rated lower 18 months in");
  eq(cycleHead(mk([-9, 2, 1, 0], 2), "primary"), "The government’s primary vote has not fallen since the election, 18 months in");
  /* 10 points from 50 is a smaller share than 8 from 32 */
  const two = mk([-10, 2, 1], -8);
  two.terms[0].base = { primary: 50 }; two.terms[3].base = { primary: 32 };
  eq(cycleRankLine(cycleRank(two, "primary", "points")), "Worst since 1990 (L0)", "in points the bigger fall is worse");
  eq(cycleRankLine(cycleRank(two, "primary")), "Worst on record, back to 1990", "as a share the smaller start loses more");
  ok(cycleDek(two, "primary").endsWith(". L0’s 1990 term lost more points by this stage, but from a bigger starting vote."), "the share dek names a term that lost more points");
  ok(!cycleDek(two, "primary", "points").includes("starting vote"), "and the points dek has no need to");
  eq(cycleMode("net") + cycleMode("tpp") + cycleMode("ppmm"), "pointspointspoints", "only the primary votes are read as shares");
  for (const k of ["primary", "oppr"]) {
    ok(C0.terms.every((x) => x[k][N] == null || x.base[k] > 0), `${k}: every term read has its starting vote`);
    eq(r1(cur.base[k]), r1(site[k][0]), `this term's ${k} starting vote is the site's`);
  }
  for (const k of ["primary", "net", "ppmm", "oppr"]) {
    const lit = cycleLit(C0, k), prev = C0.terms.filter((x) => !x.current).slice(-1)[0], r = cycleRank(C0, k);
    ok(lit[0] === cur.year && lit.includes(prev.year) && (!r.W || lit.includes(r.W.year)) && lit.length === 5 && new Set(lit).size === 5, `${k}: this term, last term and the one the rank names are brought out`);
  }
  eq(CYCLE_STATS.map((x) => x.key).join(), "tpp,primary,net,ppmm,oppr", "the hero's five figures");
  /* the built page */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-cyc-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).cycles, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "cycles: every placeholder filled");
  new vm.Script(built.slice(built.lastIndexOf("<script>") + 8, built.lastIndexOf("</script>"))); n++;
  ok(built.includes(cycleStatsHtml(C0)) && built.includes(cycleChapeau(C0)) && ["primary", "net", "ppmm", "oppr"].every((k) => built.includes(cycleHead(C0, k)) && built.includes(cycleDek(C0, k))), "cycles: its words are today's rules");
  const order = ["primary", "net", "ppmm", "oppr"].map((k) => built.indexOf(`id="${k}-svg"`));
  ok(order.every((v, i) => v > 0 && (!i || v > order[i - 1])), "the four panels in the asked order");
  ok(/name="robots" content="noindex"/.test(built), "cycles: unlisted");
  eq((built.match(/class="seg cy-mode"/g) || []).length, 2, "both primary charts carry the share / points switch");
  const V = JSON.parse(built.match(/<script id="dawn-data" type="application\/json">(.*?)<\/script>/s)[1]).views;
  for (const k of ["primary", "oppr"]) for (const m of ["share", "points"]) ok(V[k][m].head === cycleHead(C0, k, m) && V[k][m].dek === cycleDek(C0, k, m) && V[k][m].lit.join() === cycleLit(C0, k, m).join(), `${k} ${m}: the switch's words and terms`);
  const weekly = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-history-weekly.json"), "utf8")), model = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-history-model.json"), "utf8"));
  eq(weekly.input, model.input, "the weekly history is built from the same inputs as the monthly model");
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html", "template-mood.html"]) ok(/href="(\.\.\/)?past-cycles\/">past cycles</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists past cycles`);
}
/* poll disagreement */
{
  const P = disagreeData(A, A), E = engine(A, A);
  /* the figures are the main site's own: its engine, read straight */
  const last = (rows) => rows[rows.length - 1];
  for (const s of P.spread.primary.concat(P.spread.twopp).filter((x) => x.id !== "split")) {
    const want = E.AP.discord(s.id).filter((d) => d.sigma != null).pop(), got = last(s.m);
    ok(Math.abs(got[1] - want.sigma) < 0.006 && Math.abs(got[2] - want.floor) < 0.006, `${s.name}: the site's spread and chance floor`);
  }
  for (const [key, view, onM, pub] of [["split", "split"], ["tpp-lnp-imp", "tpp", false, false], ["tpp-on-pub", "tpp", true, true], ["lnp", "lnp", true, false], ["grn", "grn", true, false]]) {
    const story = E.AP.leanStory(view, !!onM, !!pub);
    eq(P.leans[key].head, story.head, `${key}: the site's lean head`);
    eq(P.leans[key].rows.length, E.AP.leanRows(E.AP.leanKey(view, !!onM, !!pub)).length, `${key}: every pollster the site lists`);
  }
  /* the split: One Nation's lean less the Coalition's, and its own spread */
  const HL = E.AP.leanSeries();
  for (const r of P.hero) eq(r.v, last(HL.split[r.h]).v, `${r.h}: the split lean`);
  ok(P.hero.every((r, i) => !i || P.hero[i - 1].v >= r.v), "the opening panel runs widest towards One Nation first");
  const sp = P.spread.primary.find((x) => x.id === "split"), sum = P.spread.primary.find((x) => x.id === "rd_right");
  ok(sp && sp.m.length && last(sp.m)[2] > last(sum.m)[2], "the split's sampling floor is a difference's, wider than the sum's");
  /* the multinomial variance of the difference, checked by hand on one poll's shares */
  const a = 0.25, b = 0.22, F = { onp: 1, lnp: -1, alp: 0, grn: 0, oth: 0 }, shares = { alp: 28, lnp: 22, onp: 25, grn: 13, oth: 12 };
  const e1 = Object.entries(F).reduce((t, [k, v]) => t + (shares[k] / 100) * v, 0), e2 = Object.entries(F).reduce((t, [k, v]) => t + (shares[k] / 100) * v * v, 0);
  ok(Math.abs((e2 - e1 * e1) - (a + b - (a - b) ** 2)) < 1e-12, "the swapped table gives the difference's variance");
  ok(P.record && P.record.parties.grn.every((r) => !r.sig || r.p < 0.05), "an election-record lean is called only when its test passes");
  /* the words */
  const row = (h, ...vals) => ({ h, s: vals.map((v, i) => ["2025-0" + (6 + i), v]) });
  const six = (a, b, c) => ({ hero: [row("A", a[0], b[0], c[0]), row("B", a[1], b[1], c[1]), ...["C", "D", "E", "F"].map((h) => row(h, 0, 0, 0))] });
  eq(splitHead(six([1, -1], [2, -2], [2, -2])), "Pollsters are further apart on the split than in June");
  eq(splitHead(six([1, -1], [4, -4], [2.5, -1.5])), "Pollsters are further apart on the split than in June, though closer than at July’s peak");
  eq(splitHead(six([3, -3], [2, -2], [1, -1])), "Pollsters are closer on the split than in June");
  eq(splitHead(six([1, -1], [1, -1], [1.3, -1.1])), "Pollsters are about as far apart on the split as in June", "under a point is no change");
  eq(splitChapeau(P), splitMonths(P).slice(-1)[0].gap.toFixed(1) + " points apart:");
  const fake = (spl, other) => ({ siteHead: "The site’s head", spread: { primary: [{ id: "split", m: [["2026-11", ...spl]] }, { id: "p_lnp", m: [["2026-11", ...other]] }, { id: "rd_right", m: [["2026-11", 1.5, 1.5]] }] } });
  eq(spreadHead(fake([3, 2], [2, 1.5])), "Pollsters differ most on One Nation v the Coalition", "the split leads when it is furthest beyond chance in points");
  eq(spreadHead(fake([2.2, 2], [3, 1.5])), "The site’s head", "else the main site's");
  eq(spreadHead(fake([2.2, 2], [1.5, 1.5])), "The site’s head", "a split within chance is never headlined");
  ok(!spreadDek(fake([3, 2], [2, 1.5])).includes("combined"), "the combined vote is mentioned only when it too is beyond chance");
  /* the built page */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-dis-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).disagree, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "disagreement: every placeholder filled");
  new vm.Script(built.slice(built.lastIndexOf("<script>") + 8, built.lastIndexOf("</script>"))); n++;
  ok([splitHead(P), splitDek(P), spreadHead(P), spreadDek(P), splitChapeau(P)].every((w) => built.includes(w)), "disagreement: its words are today's rules");
  ok(!/class="pd still"/.test(built) && /class="pdl still" id="pv"/.test(built), "the opening table doesn't take the votes page's .pd styles");
  ok(/--cy7:/.test(built), "the pollsters' line colours are defined here");
  ok(/name="robots" content="noindex"/.test(built), "disagreement: unlisted");
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html", "template-mood.html", "template-cycles.html"]) ok(/href="(\.\.\/)?poll-disagreement\/">poll disagreement</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists poll disagreement`);
}
/* decidedness */
{
  const rows = new Set(JSON.parse(fs.readFileSync(path.join(A, "dawn-polls.json"), "utf8")).polls.map((p) => p.k));
  const K = (h, released) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + released;
  const P = decidedData(A, A, { keys: rows, key: K }), D = engine(A, A).D, U = D.undecided;
  const by = Object.fromEntries(U.series.map((x) => [x.id, x]));
  for (const x of P.und.concat(P.soft)) { eq(x.now, by[x.id].now.v, `${x.name}: today's figure is the site's`); eq(x.m.length, by[x.id].monthly.length, `${x.name}: every month`); }
  /* of every 100, the site's arithmetic */
  const o = ofHundred(by.first.now.v, by.soft.now.v);
  eq(o.und, Math.round(by.first.now.v)); eq(o.soft, Math.round((by.soft.now.v * (100 - by.first.now.v)) / 100)); eq(o.firm + o.soft + o.und, 100, "a hundred voters");
  ok(["firm", "soft", "und"].every((k) => P.hero.now[k] === o[k]), "the opening bar ends on today");
  ok(P.hero.months.every((m) => m.firm + m.soft + m.und === 100), "every month's bar makes a hundred");
  eq(oneIn(6.5), "about one voter in twenty"); eq(oneInShare(27), "about one in four"); eq(oneInShare(25.4), "one in four"); eq(oneIn(5.1), "one voter in twenty");
  /* heads on their rules */
  const line = (id, v, sig, chg = 0) => ({ id, now: { v, since: { sig, chg, from: "2025-06" } } });
  const FF = (a, b) => ({ now: { onp: a, alp: b } });
  const U0 = { series: [line("first", 5, false), line("leaner", 6, false), line("tpp", 12, false), line("soft", 25, false), line("softRB", 50, false)] };
  const st = decidedStory(U0, FF({ v: 60, ci95: 2 }, { v: 50, ci95: 2 }));
  eq(st.head, "One voter in twenty is undecided, one in four might change their mind, and the One Nation vote is firmest");
  eq(st.dek, "None of the five measures has moved significantly since the 2025 election.");
  ok(!decidedStory(U0, FF({ v: 52, ci95: 3 }, { v: 50, ci95: 3 })).head.includes("firmest"), "a party is firmest only when apart from the next");
  U0.series[3] = line("soft", 25, true, -3);
  eq(decidedStory(U0, null).dek, "Resolve’s soft share has fallen significantly since the 2025 election.");
  const now = (v, ci95 = 2) => ({ v, ci95 });
  const F0 = { now: { alp: now(50), lnp: now(44), onp: now(58), grn: now(44), oth: now(35), all: now(48) }, base: { alp: now(51), lnp: now(59), onp: now(51), grn: now(45), oth: now(36), all: now(52), from: "a", to: "b" } };
  F0.now.from = "c"; F0.now.to = "d";
  eq(partyStory(F0).head, "Coalition voters have softened since July 2025, while One Nation voters have hardened");
  const flat = { now: { ...F0.now }, base: { ...F0.now, from: "a", to: "b" } };
  eq(partyStory(flat).head, "No party’s voters have softened significantly since July 2025", "nothing claimed without a change that clears");
  const age = (a, b, c) => ({ now: { "18-34": now(a), "35-54": now(b), "55+": now(c) }, base: { "18-34": now(a), "35-54": now(b), "55+": now(c) } });
  eq(ageStory(age(34, 27, 20)).head, "Young voters are the least firm");
  eq(ageStory(age(29, 28, 20)).head, "Young voters are less firm than older voters");
  eq(ageStory(age(26, 25, 24)).head, "No age group is clearly less firm than the others");
  /* the dots open real rows */
  const keys = P.und.concat(P.soft).flatMap((x) => x.polls.filter((q) => q[4]).map((q) => q[4]));
  ok(keys.length > 50 && keys.every((k) => rows.has(k)), "a dot's poll is a row of the polls table");
  /* the built page */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-dec-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).decided, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "decidedness: every placeholder filled");
  new vm.Script(built.slice(built.lastIndexOf("<script>") + 8, built.lastIndexOf("</script>"))); n++;
  const S = decidedStory(U, D.firmness);
  ok([S.head, S.dek, partyStory(D.firmness).head, ageStory(U.softAge).head].every((w) => built.includes(w)), "decidedness: its heads are today's rules");
  ok(/class="dc-bar"[^>]*><i[^>]*><\/i><i[^>]*><\/i><i[^>]*><\/i><\/div>/.test(built) && /\.dc-bar\{[^}]*border-radius:999px;overflow:hidden/.test(built), "the opening panel is one rounded bar: firm, soft, undecided");
  ok(/name="robots" content="noindex"/.test(built), "decidedness: unlisted");
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html", "template-mood.html", "template-cycles.html", "template-disagree.html"]) ok(/href="(\.\.\/)?decidedness\/">decidedness</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists decidedness`);
}
/* electoral map */
{
  const E = emapData(ROOT);
  const core = JSON.parse(fs.readFileSync(path.join(ROOT, "map", "data", "core-2025.json"), "utf8"));
  eq(E.seats.length, 150, "every 2025 seat");
  for (const D of core.divs) {
    const s = E.seats.find((q) => q.n === D.n), t = D.tcp.map((q) => q[1]);
    eq(s.votes, Math.abs(t[0] - t[1]), `${D.n}: the lead in votes`);
    ok(Math.abs(s.m - (100 * Math.max(...t)) / (t[0] + t[1]) + 50) <= 0.006 && s.m >= 0, `${D.n}: the margin is the winner's share over 50`);
  }
  /* the House: the seat bar is the map's own count, at every election */
  eq(E.history.length, YEARS.length);
  const bar = Object.fromEntries(GROUPS.map(([k]) => [k, E.seats.filter((s) => groupOf(s.ab) === k).length]));
  eq(JSON.stringify(E.history.at(-1).seats), JSON.stringify(bar), "the 2025 bar is the map's seats counted");
  ok(E.history.every((h) => h.total >= 147 && h.total <= 151), "each House is whole");
  eq(Object.values(E.today.seats).reduce((a, b) => a + b, 0), 150, "today's House");
  /* heads on their rules */
  const H = (seats) => ({ history: [{ seats }] });
  eq(emapHead(H({ alp: 94, lnp: 43, ind: 10 })), "Labor won a majority: 94 seats to the Coalition’s 43");
  eq(emapHead(H({ alp: 72, lnp: 73, ind: 5 })), "No party won a majority in the House", "73 of 150 is no majority");
  eq(emapChapeau(H({ alp: 49, lnp: 95, ind: 4 })), "The Coalition won 95 of 148 seats:");
  const S = (ms) => ({ seats: ms.map(([m, votes], i) => ({ n: "S" + i, m, votes })) });
  eq(closestHead(S([[2, 4000], [1.4, 2000]])), "The closest seat was S1, won by 2,000 votes", "a margin of a point or more is not under one");
  eq(closestHead(S([[0.2, 1], [3, 5000]])), "One seat had a margin under a point; the closest, S0, came down to 1 vote");
  const close = closestSeats(E);
  ok(close.length === 10 && close.every((s, i) => !i || s.m >= close[i - 1].m), "the ten closest, closest first");
  /* the built page */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-map-"));
  fs.mkdirSync(path.join(tmp, "assets", "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) if (f.startsWith("commissioner")) fs.writeFileSync(path.join(tmp, "assets", "fonts", f), "");
  fs.mkdirSync(path.join(tmp, "data"));
  fs.copyFileSync(path.join(ROOT, "data", "np-report.md"), path.join(tmp, "data", "np-report.md"));
  const built = fs.readFileSync(buildDawn({ root: tmp, assets: A }).emap, "utf8");
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "electoral map: every placeholder filled");
  ok(built.includes("section.hero{margin-top:0}"), "electoral map: map.css's own .hero rule can't push the sunrise down");
  ok(built.includes(".sunk .tsky{visibility:hidden}") && built.includes("classList.toggle('sunk'"), "electoral map: past the sunrise the bar can't show the sky copy");
  const own = built.lastIndexOf("<script>") + 8;
  new vm.Script(built.slice(own, built.indexOf("</script>", own))); n++;
  /* the map is /map/'s own engine, in Dawn's dress, with the page's menus and rows around it */
  ok(/classList\.add\('mp-dawn'\)/.test(built) && /<script src="\/map\/map\.js\?v=[0-9a-f]{8}"><\/script>/.test(built) && /href="\/map\/map\.css\?v=[0-9a-f]{8}"/.test(built), "electoral map: runs the full map's own script and styles");
  for (const id of ["dm-year", "dm-basis", "dm-opts", "dm-filters", "dm-places", "dm-draw", "stage", "cv", "story", "legend", "dm-notes", "q", "sugg"]) ok(built.includes(`id="${id}"`), `electoral map: #${id}`);
  ok(built.includes('id="dm-hint">Tap a seat on the map, or a seat type or state or territory above, to read it here.'), "electoral map: the hint covers seats, seat types and states or territories");
  /* big screens: the square map, and the figures in the column beside it. The script that moves them asks the stylesheet's question */
  const big = "(min-width:1100px) and (min-height:600px)";
  ok(built.includes(`@media ${big}{`) && built.includes(`matchMedia('${big}')`), "electoral map: the layout and the script switch on the same screens");
  ok(built.includes(".dm-view.mp-view{grid-column:2;grid-row:1;height:var(--em-sq);margin:0}") && built.includes("grid-template-columns:minmax(0,1fr) var(--em-sq)"), "electoral map: the big screen's map is square, on the right");
  ok(built.includes('id="dm-side"') && built.indexOf('id="dm-info"') < built.indexOf('id="view"') && built.includes("(big.matches?info:$('.wrap',seatSec)).append(...figures)"), "electoral map: the seat's figures move into the left column");
  const engine = fs.readFileSync(path.join(ROOT, "map", "map.js"), "utf8");
  ok(engine.includes('new CustomEvent("dawn-map"') && engine.includes("if (dawnOn()) dawnTheme(T);"), "electoral map: the engine carries its Dawn half");
  const data = JSON.parse(built.match(/<script id="dawn-data" type="application\/json">(.*?)<\/script>/s)[1]);
  for (const y of [...YEARS, "now"]) ok(typeof data.heads[y] === "string" && data.heads[y].length > 20, `electoral map: a heading for ${y}`);
  ok(!/ won /.test(data.heads.now), "electoral map: today's House holds, it didn't win");
  ok([emapHead(E), closestHead(E), emapChapeau(E)].every((w) => built.includes(w)), "electoral map: its heads are today's rules");
  ok(built.includes('href="/map/"') && /name="robots" content="noindex"/.test(built), "electoral map: links the full map, unlisted");
  ok(Buffer.byteLength(built) < 200e3, "electoral map: the page stays light");
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html", "template-mood.html", "template-cycles.html", "template-disagree.html", "template-decided.html"]) {
    const src = fs.readFileSync(path.join(HERE, "dawn", f), "utf8");
    ok(/href="(\.\.\/)?electoral-map\/">electoral map</.test(src) && !/seats <small>soon/.test(src), `${f}'s menu lists the electoral map`);
  }
}
/* 12. the public opinion page: the site's own catalogue component, styles and
   sidecar under a sunrise of its findings */
{
  const src = JSON.parse(fs.readFileSync(path.join(A, "oneoffs-source.json"), "utf8"));
  const topics = src.topics.filter((t) => t.finding);
  const slides = heroSlides(src);
  eq(slides.length, topics.length, "opinion: a slide for every topic's finding");
  const share = (v) => v == null || (Number.isFinite(v) && v >= 0 && v <= 100);
  for (const [i, sl] of slides.entries()) {
    const t = topics[i], b = t.blocks.find((x) => x.id === t.finding.of);
    ok(sl.id === t.id && sl.text === t.finding.text && sl.meta === t.finding.meta && b, `opinion: ${t.id} states the site's finding over the block it reads`);
    ok(sl.of.startsWith(b.title), `opinion: ${t.id} names the figures under it`);
    if (sl.kind === "two") ok(sl.a === b.a && sl.b === b.b, `opinion: ${t.id}'s two shares are the block's`);
    else {
      ok(sl.rows.length > 0 && sl.rows.length <= HERO_ROWS, `opinion: ${t.id}'s rows fit the sunrise`);
      ok(sl.rows.every((r) => sl.kind === "list" ? share(r.v) && r.v != null : share(r.a) && r.a != null && share(r.b)), `opinion: ${t.id}'s rows carry shares`);
    }
    if (sl.kind === "pairs") eq(sl.rows.length + sl.more, b.kind === "tracker" ? b.panels.length : b.rows.length, `opinion: ${t.id} counts the polls it leaves below`);
  }
  const tcss = pubopCss(fs.readFileSync(path.join(HERE, "newtracker", "template.html"), "utf8"));
  ok(/\.pubop-bar\s*\{/.test(tcss) && /@media[^{]*\{[^@]*\.pubop-row\s*\{/.test(tcss) && !tcss.includes(".pubop-ss"), "opinion: the site's rules come across, media queries kept, the static article's left out");
  eq((tcss.match(/\{/g) || []).length, (tcss.match(/\}/g) || []).length, "opinion: the lifted rules are whole");
  const file = path.join(ROOT, "dawn", "public-opinion", "index.html");
  const built = fs.readFileSync(file, "utf8");
  ok(/name="robots" content="noindex"/.test(built), "opinion: unlisted");
  ok(!/\{\{[A-Za-z:]+\}\}/.test(built), "opinion: every placeholder filled");
  ok(built.includes(opinionLede(src, newestPublished(src))), "opinion: today's lede");
  const data = JSON.parse(built.match(/<script id="dawn-data" type="application\/json">(.*?)<\/script>/s)[1]);
  const im = data.immigration;
  ok(im.rows.some(r => r.key === "scanlon-telephone") && im.rows.some(r => r.key === "scanlon-current"), "immigration: separate Scanlon methods");
  ok(im.trend.every((r,i) => (!i || r.x > im.trend[i-1].x) && 0 < r.lo && r.lo < r.v && r.v < r.hi && r.hi < 100), "immigration: chronological estimates within their probability intervals");
  ok(im.scores.some(r => r.last != null) && im.scores.every(r => Number.isFinite(r.expanded.v) && Number.isFinite(r.direct.v)), "immigration: both models tested on the same targets");
  eq(JSON.stringify(data.slides), JSON.stringify(slides), "opinion: the page's slides are today's");
  const po = built.match(/href="\.\.\/(po\.[0-9a-f]{8}\.json)"/)[1], app = built.match(/src="\.\.\/(po-app\.[0-9a-f]{8}\.js)"/)[1];
  eq(fs.readFileSync(path.join(ROOT, "dawn", po), "utf8"), fs.readFileSync(path.join(A, "oneoffs-source.json"), "utf8"), "opinion: its sidecar is the site's own");
  const code = fs.readFileSync(path.join(ROOT, "dawn", app), "utf8");
  new vm.Script(code); n++;
  ok(code.includes("PublicOpinionBody") && code.includes("function rdTabsKey("), "opinion: its script is the site's component and the helpers it borrows");
  /* every global the component takes from the app it was written for, the page provides */
  const jsx = fs.readFileSync(path.join(A, "rd-public-opinion.jsx"), "utf8");
  for (const g of ["TrendChart", "useNarrow", "MQ_PHONE"]) ok(!jsx.includes(g) || built.includes(`window.${g}=`), `opinion: the page provides ${g}`);
  const polls = new Set(JSON.parse(fs.readFileSync(path.join(A, "dawn-polls.json"), "utf8")).polls.map((p) => p.k));
  ok(data.rows.length > 0 && data.rows.every((k) => polls.has(k)), "opinion: a chart's dot links only a poll the polls page has");
  const own = built.indexOf("<script>\n{") + 8;
  new vm.Script(built.slice(own, built.indexOf("</script>", own))); n++;
  for (const f of ["template.html", "template-polls.html", "template-next.html", "template-leaders.html", "template-mood.html", "template-cycles.html", "template-disagree.html", "template-decided.html", "template-emap.html"])
    ok(/href="(\.\.\/)?public-opinion\/">public opinion</.test(fs.readFileSync(path.join(HERE, "dawn", f), "utf8")), `${f}'s menu lists public opinion`);
  /* each release that asked more links to its questions from its poll */
  const by = rowQuestions(src), pollsPage = fs.readFileSync(path.join(ROOT, "dawn", "polls", "index.html"), "utf8");
  eq([...by.keys()].filter((k) => !polls.has(k)).join(" "), "", "opinion: every release with questions has its row on the polls page");
  const carried = JSON.parse(pollsPage.match(/<script id="polls-data" type="application\/json">(.*?)<\/script>/s)[1]).polls.filter((p) => p.po);
  ok(by.size > 0 && carried.length === by.size && carried.every((p) => JSON.stringify(p.po) === JSON.stringify(by.get(p.k))), "opinion: the polls page carries each release's questions");
  ok(pollsPage.includes('href="../public-opinion/?pollster=') && built.includes("window.AP.pubopGo('pubop-p-'+from"), "opinion: a poll's link, and the trip that answers it");
  ok(jsx.includes("window.AP.pubopGo = (h, wave)"), "opinion: the component still offers the trip");
}
/* linked from nowhere */
{
  const hits = ["index.html", "info/index.html", "allpolls/index.html"].filter((f) => fs.existsSync(path.join(ROOT, f)) && /href="\/?dawn\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  eq(hits.length, 0, "no page links /dawn/");
}
console.log(`PASS: dawn – ${n} checks: data ends on the site's figures, every copy branch, the built pages, the next polls on mocked clocks`);
