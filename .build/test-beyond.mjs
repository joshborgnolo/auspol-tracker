/* test-beyond.mjs – pins the rules behind the /public-opinion/ page
   (named /beyond-the-vote/ until 2026-10-21; the builder
   .build/newtracker/beyond-the-vote.mjs keeps its file name): how an
   answer's wording places
   it, how a side's printed TOTAL is quoted, the margin behind every
   "level", and every branch of the generated copy – the trackers' heads,
   the cross-pollster tallies and the one-pollster wave summaries – on
   mutated inputs as well as today's payload, so a head can never claim
   what its numbers do not clear. Then the payload itself: every store
   question filed, every featured card built, every figure sane.
   Usage: node .build/test-beyond.mjs */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStores, buildBeyond, FEATURES, __test } from "./newtracker/beyond-the-vote.mjs";
import { THEMES, THEME_OF } from "./newtracker/adhoc-themes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { classify, splitOf, leadOf, tallyOf, wavesSummary, TRACKER_COPY, tableRows,
  splitFinding, tallyFinding, rankFinding, findingMeta, tidyTitle, tidyHead, unpack, groupOf, matchKey, figuresOf } = __test;

// ---- an answer's side, from its wording --------------------------------------------
for (const [label, side] of [
  ["Strongly support", "a"], ["Somewhat oppose", "b"], ["Neither support nor oppose", "m"],
  ["Not likely at all", "b"], ["Not sure", "m"], ["Don’t know", "m"], ["I haven't heard of them", "x"],
  ["% TOTAL: Positive", "a"], ["Support (total)", "a"], ["TOTAL: Oppose", "b"], ["Very unfavourable", "b"],
  ["Generally positive", "a"], ["Yes", "a"], ["No", "b"], ["About right", "m"], ["No difference", "m"],
  ["Australia should be monocultural", "o"],
]) assert.equal(classify(label), side, `"${label}" reads as ${side}`);
assert.equal(classify("Too high", { a: /too high/i }), "a", "a card's own sides win");

// ---- a side's total: the printed TOTAL where there is one --------------------------
{
  const s = splitOf([["Strongly support", 20], ["Somewhat support", 34], ["Neither", 28], ["Somewhat oppose", 10],
    ["Strongly oppose", 7], ["TOTAL support", 55], ["TOTAL oppose", 17]]);
  assert.equal(s.a, 55, "the printed total is quoted, not the rounded parts' 54");
  assert.equal(s.b, 17);
  assert.deepEqual(s.segs.map((g) => g.side + g.tone), ["a2", "a1", "m0", "b1", "b2"], "strong answers outermost, mild ones lighter");
  const t = splitOf([["Support (total)", 33], ["Oppose (total)", 32]]);
  assert.equal(t.a, 33, "a TOTAL stands in where a side has no parts");
  assert.equal(t.segs.length, 2);
  const u = splitOf([["Agree", 61], ["Disagree", 21]]);
  assert.deepEqual(u.segs.map((g) => g.tone), [2, 2], "a side with one weight wears the full colour");
  assert.throws(() => splitOf([["Support", 30], ["Something else", 20]]), /unplaced answers/, "a featured card must place every answer");
}

// ---- the margin behind "level" -------------------------------------------------------
{
  const n = 2252 / 1.6;
  const L = leadOf(32, 36, n);
  assert.ok(L.moe > 4 && L.moe < 4.6 && L.sig === false, "32 v 36 on n_eff 1407 is level (margin ±4.3)");
  assert.equal(leadOf(30, 63, 1232 / 1.6).sig, true, "30 v 63 is a lead");
  assert.equal(leadOf(30, 63, null).sig, null, "no sample, no verdict either way");
}

// ---- crosstab leaks: a table keeps its own rows -------------------------------------
assert.deepEqual(tableRows({ rows: [["Yes", 70], ["No", 15], ["Yes", 72, 68], ["No", 13, 17], ["Yes", 70]] }),
  [["Yes", 70], ["No", 15]], "rows wider than the table, and repeats, are another table's");

// ---- tallies: every branch -------------------------------------------------------------
{
  const row = (lead, sig) => ({ lead, sig });
  const T = ["support leads", "opposition leads"];
  assert.equal(tallyOf([row(-9, true), row(-30, true)], T), "Opposition leads in both polls.");
  assert.equal(tallyOf([row(9, true), row(30, true), row(12, true)], T), "Support leads in all three polls.");
  assert.equal(tallyOf([row(14, true), row(-9, true), row(1, false), row(0, false)], T),
    "Support leads in one of the four polls and opposition leads in one; two are level.");
  assert.equal(tallyOf([row(2, false), row(1, false)], T), "Every one is level.");
  assert.equal(tallyOf([row(22, true), row(4, null)], T), "Support leads in one of the two polls; one has no sample size on file to judge by.");
}

// ---- one pollster's waves --------------------------------------------------------------
{
  const w = (a, b, end, n, neff = null) => ({ a, b, src: { field: { end }, n, neff } });
  assert.equal(wavesSummary([w(46, 39, "2026-09-29", 1008, 865), w(41, 41, "2025-09-29", 1001, 822)], ["positive", "negative"]),
    "Positive: 46%, up from 41% in September 2025.", "published effective samples: 5 points clears ±4.7");
  assert.equal(wavesSummary([w(46, 39, "2026-09-29", 1008), w(41, 41, "2025-09-29", 1001)], ["positive", "negative"]),
    "Positive: 46%, much the same as the 41% in September 2025.", "estimated effective samples: 5 points is inside ±5.5");
  assert.equal(wavesSummary([w(12, 72, "2026-05-18", 1210), w(14, 64, "2026-02-09", 2166)], ["safer", "less safe"]),
    "Less safe: 72%, up from 64% in February 2026.", "the side ahead in the latest is the one reported");
  assert.equal(wavesSummary([w(9, 39, "2026-06-30", 1502), w(7, 42, "2026-03-10", 1425)], ["better off", "worse off"]),
    "Worse off: 39%, much the same as the 42% in March 2026.");
  assert.equal(wavesSummary([w(9, 39, "2026-06-30", null), w(7, 42, "2026-03-10", 1425)], ["a", "b"]), null, "no sample, no claim");
}

// ---- tracker heads on mutated readings --------------------------------------------------
{
  const pt = (v, a, b, se, end = "2026-06-01") => ({ v, a, b, m: 100 - a - b, se, field: { end }, house: "x" });
  const P = (house, pts) => ({ house, points: pts });
  const deep = [P("freshwater", [pt(-36, 25, 61, 2.8, "2025-10-20"), pt(-47, 20, 67, 2.7)]), P("redbridge", [pt(-59, 14, 73, 2.5)])];
  assert.equal(TRACKER_COPY.trump(deep).head, "Every pollster finds Donald Trump deeply unpopular");
  const mild = [P("freshwater", [pt(-20, 35, 55, 2.8)]), P("redbridge", [pt(-59, 14, 73, 2.5)])];
  assert.equal(TRACKER_COPY.trump(mild).head, "Every pollster finds Donald Trump unpopular", "'deeply' needs every latest at -30 or below");
  const even = [P("freshwater", [pt(-3, 44, 47, 2.8)]), P("redbridge", [pt(-59, 14, 73, 2.5)])];
  assert.equal(TRACKER_COPY.trump(even).head, "Pollsters differ on how Australians see Donald Trump", "a net inside its margin of zero breaks 'every'");
  assert.match(TRACKER_COPY.trump(deep).dek, /Freshwater’s latest reading is 11 points lower than its first, in October 2025\./);
  const flat = [P("freshwater", [pt(-45, 21, 66, 3, "2025-10-20"), pt(-47, 20, 67, 3)])];
  assert.match(TRACKER_COPY.trump(flat).dek, /Freshwater’s latest is much the same as its first, in October 2025\./, "a change inside its margin is 'much the same'");
  const sh = (v, se) => ({ v, a: v, b: 5, m: 95 - v, se, field: { end: "2026-09-01" }, house: "x" });
  assert.equal(TRACKER_COPY.immigration([P("resolve", [sh(57, 1.3)]), P("essential", [sh(56, 1.7)])]).head, "In every poll, a majority want less immigration");
  assert.equal(TRACKER_COPY.immigration([P("resolve", [sh(52, 1.5)]), P("essential", [sh(56, 1.7)])]).head,
    "In every poll, wanting less immigration is the most common answer", "a majority must clear 50 by its own margin");
  assert.equal(TRACKER_COPY.immigration([P("resolve", [{ ...sh(40, 1.5), b: 45, m: 15 }])]).head,
    "Pollsters differ on whether Australians want less immigration");
}

// ---- the findings: every branch, on mutated figures -------------------------------------
{
  /* one question: a lead only past its margin, a majority only where the
     share clears half by its own margin */
  const P = FEATURES["trust-democracy"][0].find;
  const q = (a, b, n) => { const L = leadOf(a, b, n ? n / 1.6 : null); return { a, b, sig: L.sig, src: { n, neff: null } }; };
  assert.equal(splitFinding(q(34, 56, 1062), P, 1.6), "56% say the Albanese government has fallen short of their expectations");
  assert.equal(splitFinding(q(30, 48, 1062), P, 1.6),
    "More say the Albanese government has fallen short of their expectations than met them, 48% to 30%", "48% is no majority");
  assert.equal(splitFinding(q(60, 30, 1062), P, 1.6), "60% say the Albanese government has met or exceeded their expectations");
  assert.equal(splitFinding(q(47, 33, 1062), P, 1.6),
    "More say the Albanese government has met their expectations than fallen short, 47% to 33%");
  assert.equal(splitFinding(q(44, 47, 1062), P, 1.6),
    "Voters are divided on whether the Albanese government has lived up to their expectations, 44% to 47%", "inside the margin: divided");
  assert.equal(splitFinding(q(34, 56, null), P, 1.6),
    "56% say the Albanese government has fallen short of their expectations, and 34% that it has met them", "no sample: no verdict");
  assert.equal(splitFinding(q(30, 52, 16000), P, 1.6), "52% say the Albanese government has fallen short of their expectations",
    "52% on a big sample clears half by its margin");
  assert.equal(splitFinding(q(30, 52, 1062), P, 1.6),
    "More say the Albanese government has fallen short of their expectations than met them, 52% to 30%", "52% on 1,062 does not");
  /* several polls: the tally in words */
  const T = FEATURES["housing-budget"][0];
  const rows = (...xs) => ({ rows: xs.map(([lead, sig]) => ({ lead, sig })) });
  assert.equal(tallyFinding(rows([-9, true], [-20, true], [-4, true]), T.find, T.tally),
    "Negative verdicts on the May budget outnumber positive ones in all three polls");
  assert.equal(tallyFinding(rows([9, true], [20, true]), T.find, T.tally), "Positive verdicts on the May budget outnumber negative ones in both polls");
  assert.equal(tallyFinding(rows([-9, true], [2, false], [-20, true], [3, null]), T.find, T.tally),
    "Negative verdicts on the May budget outnumber positive ones in two of the four polls");
  assert.equal(tallyFinding(rows([9, true], [2, false], [1, false]), T.find, T.tally),
    "Positive verdicts on the May budget outnumber negative ones in one of the three polls");
  assert.equal(tallyFinding(rows([9, true], [-12, true], [-8, true]), T.find, T.tally),
    "Polls disagree on the May budget: positive verdicts lead in one, negative verdicts lead in two");
  assert.equal(tallyFinding(rows([2, false], [1, null]), T.find, T.tally), "Neither poll finds a clear lead either way on the May budget");
  assert.equal(tallyFinding(rows([2, false], [1, false], [0, false]), T.find, T.tally), "No poll finds a clear lead either way on the May budget");
  assert.equal(tallyFinding(rows([-9, true]), T.find, T.tally), "Negative verdicts on the May budget outnumber positive ones in the one poll");
  /* a ranked list: the top answer alone only past the margin over the next */
  const K = FEATURES["cost-of-living"][0].find;
  const rk = (n, ...xs) => ({ rows: xs.map(([label, v]) => ({ label, v })), src: { n, neff: null } });
  assert.equal(rankFinding(rk(2250, ["Federal Labor", 46], ["Global factors", 26]), K, 1.6),
    "46% hold federal Labor primarily responsible for the cost-of-living crunch");
  assert.equal(rankFinding(rk(1000, ["Global factors", 30], ["Federal Labor", 28]), K, 1.6),
    "Blame for the cost-of-living crunch splits between global factors, at 30%, and federal Labor, at 28%", "30 v 28 is inside the margin");
  assert.equal(rankFinding(rk(null, ["The Reserve Bank", 40], ["Federal Labor", 20]), K, 1.6),
    "40% hold the Reserve Bank primarily responsible for the cost-of-living crunch, and 20% federal Labor", "no sample: both, no verdict");
  /* whose figures */
  const pts = (k) => Array.from({ length: k }, () => ({}));
  assert.equal(findingMeta({ kind: "tracker", panels: [{ points: pts(2) }, { points: pts(1) }], first: "2025-12-07" }),
    "Two pollsters, three readings since December 2025");
  assert.equal(findingMeta({ kind: "tracker", panels: [{ points: pts(9) }, { points: pts(7) }], first: "2025-07-16" }),
    "Two pollsters, 16 readings since July 2025");
  assert.equal(findingMeta({ kind: "stack", mode: "compare", rows: [{ src: { field: { end: "2026-05-20" } } }, { src: { field: { end: "2026-05-12" } } }] }),
    "Two polls, May 2026");
  assert.equal(findingMeta({ kind: "stack", mode: "compare", rows: [{ src: { field: { end: "2026-01-16" } } }, { src: { field: { end: "2025-12-20" } } }] }),
    "Two polls, December 2025 to January 2026");
  assert.equal(findingMeta({ kind: "split", src: { house: "essential", field: { end: "2026-05-24" } } }), "Essential, May 2026");
  /* every topic's first block words every outcome its kind can reach, and
     no later block carries a finding it would never be asked for */
  const KEYS = { split: ["aMaj", "aMore", "bMaj", "bMore", "level", "none"], stack: ["a", "b", "topic"], rank: ["one", "tie", "none"] };
  for (const [id, specs] of Object.entries(FEATURES)) {
    const s0 = specs[0];
    if (s0.kind !== "tracker") {
      assert.ok(s0.find && (s0.kind !== "stack" || s0.mode === "compare"), `${id} leads with a block that words its finding`);
      for (const k of KEYS[s0.kind]) assert.ok(typeof s0.find[k] === "string", `${id}'s finding words its "${k}" outcome`);
    }
    specs.slice(1).forEach((s) => assert.ok(!s.find, `${id}: only the first block's finding is read`));
  }
}

// ---- the long tail: a question's tables as a reader reads them ---------------------------
{
  /* titles lose table numbers, units, value orders and dates; a base becomes its own line */
  assert.deepEqual(tidyTitle("Table 40: How much voters have seen, read or heard about the Federal Budget, by demographic characteristics, 28 September - 2 October"),
    { title: "How much voters have seen, read or heard about the Federal Budget", base: null, measure: null });
  assert.deepEqual(tidyTitle("Tables 41-43: How voters rate the impact of the federal budget (asked of those who had heard anything, N=868)"),
    { title: "How voters rate the impact of the federal budget", base: "Asked of those who had heard anything (868 people)", measure: null });
  assert.deepEqual(tidyTitle("Level of appeal (% among One Nation supporters) — values: very appealing, somewhat appealing, don't know"),
    { title: "Level of appeal", base: "Among One Nation supporters", measure: null });
  assert.equal(tidyTitle("Good or bad time to do the following currently (%) — Sep '26 national").title, "Good or bad time to do the following currently");
  assert.equal(tidyTitle("How much voters have seen, read or heard about the Federal Budget (25-28 May)").title, "How much voters have seen, read or heard about the Federal Budget");
  assert.equal(tidyTitle("Rating of Australia's relationship with specific country (%) — Excellent / very good / good, Nov '25").measure, "Excellent, very good or good");
  assert.equal(tidyTitle("Headline (%)").title, null, "a headline table is the figure, not its title");
  assert.equal(tidyHead("TOTAL: Positive"), "Total positive");
  assert.equal(tidyHead("Total contributing Sep '26"), "Total contributing Sep 2026");
  /* earlier readings packed into a label become columns; a net's working goes */
  assert.deepEqual(unpack("Driven less or combined multiple destinations into one trip (April 2026: 54)"),
    { label: "Driven less or combined multiple destinations into one trip", then: [{ when: "Apr 2026", v: 54, of: null }], tag: null });
  assert.deepEqual(unpack("New Zealand (Apr '25/Nov '25: 89/88)").then, [{ when: "Apr 2025", v: 89 }, { when: "Nov 2025", v: 88 }]);
  assert.equal(unpack("At the current point in time — [Major problem, Minor problem] (April 2026 total problem: 93)").label, "At the current point in time");
  assert.equal(unpack("Net awareness (deal+amount − notmuch+nothing)").label, "Net awareness");
  assert.deepEqual(unpack("UK (Nov 23)"), { label: "UK", then: [], tag: "Nov 2023" });
  /* the groups a crosstab breaks into, by banner */
  for (const [h, g] of [["Gender: Male", "Gender Male"], ["Age 35 - 49", "Age 35–49"], ["Voted Labor in 2025", "2025 vote Labor"],
    ["TOTAL: Coalition", "Vote Coalition"], ["L/NP", "Vote Coalition"], ["Household income: <100k", "Income <100k"], ["NSW Respondents", "State NSW"]]) {
    const x = groupOf(h);
    assert.equal(x && x.banner + " " + x.label, g, `"${h}" is ${g}`);
  }
  assert.ok(groupOf("Australia").all && groupOf("Total").all, "the all-voters column or row");
  assert.equal(groupOf("Strongly agree"), null, "an answer is no group");
  assert.equal(matchKey("Pauline Hanson's One Nation"), matchKey("One Nation"), "a party's long name matches its short one");

  /* RedBridge's budget module, two waves: awareness as a list a wave a
     column, the verdicts unflattened into a battery a statement a row
     group, the bases merged, the table numbers and dates gone */
  const flat = (g, xs) => xs.map(([a, v]) => [g + " — " + a, v]);
  const budget = (end, start, n, aw, country, you, base) => ({ id: "budget", house: "redbridge", waveDate: end, dateStart: start, dateEnd: end, sample: n,
    tables: [
      { title: "Table 40: How much voters have seen, read or heard about the Federal Budget, by demographic characteristics, 28 September - 2 October", headers: null,
        rows: [["A great deal", aw[0]], ["A fair amount", aw[1]], ["Not very much", aw[2]], ["Nothing at all", aw[3]], ["Net awareness", aw[0] + aw[1] - aw[2] - aw[3]]] },
      { title: "Tables 41-43: How voters rate the impact of the federal budget (asked of those who had heard anything, N=" + base + ")", headers: null,
        rows: [...flat("For the country as a whole", country), ...flat("For you personally", you)] },
    ] });
  const verdict = (vg, g, ni, b, vb, ns) => [["very good", vg], ["good", g], ["no impact", ni], ["bad", b], ["very bad", vb], ["not sure", ns], ["net good", vg + g - b - vb]];
  const out = figuresOf([
    budget("2026-10-02", "2026-09-28", 1000, [10, 35, 40, 15], verdict(2, 17, 13, 33, 20, 15), verdict(1, 9, 30, 34, 15, 11), 868),
    budget("2026-05-28", "2026-05-25", 1005, [21, 44, 29, 6], verdict(3, 20, 10, 31, 22, 14), verdict(1, 10, 31, 32, 16, 10), 950),
  ]);
  const [aw, vd] = out.figs;
  assert.equal(aw.kind, "list");
  assert.equal(aw.title, "How much voters have seen, read or heard about the Federal Budget");
  assert.deepEqual(aw.cols, ["Oct 2026", "May 2026"], "each wave a column, latest first");
  assert.deepEqual(aw.rows.map((r) => r.v), [[10, 21], [35, 44], [40, 29], [15, 6]]);
  assert.deepEqual(aw.sums, [{ label: "Net awareness", v: [-10, 30] }], "the net sits under its answers, never as a bar");
  assert.equal(vd.kind, "split", "the verdicts take sides, so they split");
  assert.deepEqual(vd.heads, ["Very good", "Good", "No impact", "Bad", "Very bad", "Not sure"]);
  assert.deepEqual(vd.extraHeads, ["Net good"]);
  assert.equal(vd.base, "Asked of those who had heard anything (868 people in Oct 2026, 950 in May 2026)");
  assert.deepEqual(vd.rows.map((r) => r.label), ["For the country as a whole", "For you personally"]);
  assert.deepEqual(vd.rows[0].waves.map((w) => [w.when, w.a, w.b, w.extra[0]]), [["Oct 2026", 19, 53, -34], ["May 2026", 23, 53, -30]]);
  assert.ok(vd.legend.some((l) => l.side === "m" && l.label === "No impact or not sure"), "the merged middle is named for its answers");

  /* a YouGov crosstab: the Total column is the figure, the groups a cut a
     banner each; a table filed twice once */
  const yg = figuresOf([{ id: "x", house: "news24", waveDate: "2026-06-30", dateEnd: "2026-06-30", tables: [
    { title: null, headers: ["Party", "Total", "Gender: Male", "Gender: Female", "Age 18-34", "Voting intention: Labor"], rows: [["Labor", "41", "42", "39", "50", "96"], ["Greens", "23", "19", "26", "36", "25"]] },
    { title: null, headers: ["Party", "%"], rows: [["Labor", "41"], ["Greens", "23"]] },
  ] }]);
  assert.equal(yg.figs.length, 1, "the re-filed list restates the Total column");
  assert.deepEqual(yg.figs[0].rows.map((r) => [r.label, r.v[0]]), [["Labor", 41], ["Greens", 23]]);
  assert.deepEqual(yg.cuts[0].banners, ["Gender", "Gender", "Age", "Vote"]);
  assert.deepEqual(yg.cuts[0].heads, ["Male", "Female", "18–34", "Labor"]);

  /* Essential: a one-answer slice is dropped; a battery's cut names its
     measure where the groups average to it, and is dropped where not */
  const grid = { title: "All voters", headers: ["", "Strongly support", "Somewhat support", "Neither", "Somewhat oppose", "Strongly oppose"],
    rows: [["Item A", 20, 30, 25, 15, 10], ["Item B", 10, 20, 30, 25, 15]] };
  const es = (cut) => figuresOf([{ id: "e", house: "essential", waveDate: "2026-05-01", dateEnd: "2026-05-01", tables: [
    { title: "Strongly support", headers: null, rows: [["Item A", 20], ["Item B", 10]] }, grid,
    { title: "By gender", headers: ["", "Male", "Female"], rows: cut }] }]);
  const named = es([["Item A", 52, 48], ["Item B", 31, 29]]);
  assert.equal(named.figs.length, 1, "the one-answer slice restates the grid");
  assert.equal(named.figs[0].kind, "split");
  assert.equal(named.cuts[0].title, "Total support", "men and women average to the all-voters support total");
  assert.equal(es([["Item A", 70, 60], ["Item B", 5, 6]]).cuts.length, 0, "a cut no all-voters figure explains stays in the source");
}

// ---- the payload ------------------------------------------------------------------------------
{
  const entries = readStores(ROOT);
  for (const e of entries) assert.ok(THEME_OF[e.id], `${e.id} is filed under a topic or cut`);
  const out = buildBeyond(entries, { deff: 1.6 });
  assert.equal(out.topics.length, THEMES.length, "every topic rides the payload, in order");
  assert.equal(out.topics[0].id, THEMES[0].id);
  const featured = Object.values(FEATURES).reduce((n, f) => n + f.length, 0);
  assert.equal(out.counts.featured, featured, "every featured card was built");
  const seg = (s) => assert.ok(s.v >= 0 && s.v <= 100, "a share is a share");
  for (const t of out.topics) for (const b of t.blocks) {
    if (b.kind === "split") {
      b.segs.forEach(seg);
      assert.ok(b.a + b.b + b.m + b.x <= 101.5, `${b.title}: the shares fit on one track`);
      assert.ok(b.src && b.src.field.end && b.src.house, `${b.title} names its source`);
    } else if (b.kind === "stack") {
      assert.ok(b.rows.length >= 2, `${b.title} has rows`);
      for (const r of b.rows) { r.segs.forEach(seg); assert.ok(r.a + r.b + r.m <= 101.5, `${b.title}: a row fits its track`); }
    } else if (b.kind === "tracker") {
      for (const p of b.panels) for (const q of p.points)
        assert.ok(q.v >= b.yDomain[0] && q.v <= b.yDomain[1], `${b.title}: ${p.house} ${q.field.end} sits inside the chart`);
      assert.ok(b.head && b.dek, `${b.title} carries its head and dek`);
      assert.ok(b.families.length >= 1 && b.families.length <= 2, `${b.title}: one or two wording families (the validated pair)`);
      for (const p of b.panels) assert.ok(b.families[p.fam], `${b.title}: ${p.house} names its wording family`);
    } else if (b.kind === "rank" || b.kind === "nets") {
      assert.ok(b.rows.length >= 2 && b.rows.every((r) => Number.isFinite(r.v)), `${b.title} ranks numbers`);
    }
  }
  const trump = out.topics.find((t) => t.id === "trump-us").blocks.find((b) => b.kind === "tracker");
  const sec = trump.panels.find((p) => p.house === "secnewgate").points.find((q) => q.field.end === "2025-11-03");
  assert.equal(sec.v, -39, "SEC Newgate's November 2025 net quotes its printed 60% negative (21 - 60), not the parts' 59");
  /* the stores as filed: a trend chart's month point sits with the report
     that asked the question (happiness was asked on 30 Sep 2026 only; the
     Melbourne Cup on 29 Oct 2025), and no all-voters grid carries a column
     no row fills */
  const waves = (id, house) => entries.filter((e) => e.id === id && e.house === house).map((e) => e.waveDate).sort();
  assert.deepEqual(waves("happiness-personal", "essential"), ["2026-09-29"], "happiness: one wave, the 30 Sep 2026 report's");
  assert.deepEqual(entries.find((e) => e.id === "happiness-personal").tables[0].rows[0], ["My life overall", 6.4], "happiness: its chart's Sep'26 point is the wave's all-voters figure");
  for (const id of ["melbourne-cup-attitudes", "melbourne-cup-betting", "melbourne-cup-interest"])
    assert.deepEqual(waves(id, "essential"), ["2025-10-28"], `${id}: the 29 Oct 2025 report's alone`);
  for (const e of entries) for (const t of e.tables) {
    if (!t.headers || !t.rows.length) continue;
    t.headers.forEach((h, i) => assert.ok(!i || t.rows.some((r) => r[i] != null), `${e.id} @ ${e.waveDate}: "${h}" is a column no row fills`));
  }
  const fall = entries.find((e) => e.id === "housing-values-fall" && e.waveDate === "2026-09-14").tables[0].rows;
  assert.deepEqual(fall, [["For Australia — good thing (Sep '26)", 57], ["For Australia — bad thing (Sep '26)", 21],
    ["For you personally — good thing (Sep '26)", 38], ["For you personally — bad thing (Sep '26)", 29]], "SEC Newgate's September totals as page 22 prints them");
  for (const t of out.topics) for (const q of t.more) {
    assert.ok(q.title && q.srcs.length, `${q.id} lists with its waves`);
    assert.ok(q.figs.length || q.prose.length, `${q.id} (${q.house}) opens to figures or the article's words`);
    for (const f of q.figs) {
      const txt = [f.title, f.base, f.measure, ...(f.heads || []), ...(f.extraHeads || []), ...f.rows.map((r) => r.label), ...(f.sums || []).map((r) => r.label)].join(" | ");
      assert.ok(!/\bTables? \d|\(%\)|values?:|value order|\[[A-Z]|\(April \d{4}|['’]\d{2}\b|\bTOTAL\b/.test(txt), `${q.id}: a store's own markings reach the reader: ${txt.slice(0, 160)}`);
      const nums = f.kind === "list" || f.kind === "nets" ? f.rows.concat(f.sums || []).flatMap((r) => r.v) : f.rows.flatMap((r) => r.waves.flatMap((w) => [...w.cells, ...w.extra]));
      assert.ok(nums.every((v) => v == null || Number.isFinite(v)), `${q.id}: every figure a number`);
      if (f.kind === "list" || f.kind === "nets") assert.ok(f.rows.every((r) => r.v.length === f.cols.length), `${q.id}: a list row a value a column`);
    }
    for (const c of q.cuts) assert.ok(c.rows.every((r) => r.length === c.heads.length + 1), `${q.id}: a cut row a value a group`);
  }
  for (const t of out.topics) {
    if (!t.blocks.length) { assert.equal(t.finding, null, `${t.id}: no blocks, no finding`); continue; }
    assert.ok(t.finding && t.finding.text && t.finding.meta, `${t.id} opens on a finding`);
    assert.equal(t.finding.of, t.blocks[0].id, `${t.id}'s finding reads its first block`);
    assert.ok(!/[{}]|undefined|NaN/.test(t.finding.text + t.finding.meta), `${t.id}'s finding is filled: "${t.finding.text}"`);
  }
}
console.log("PASS: beyond the vote – sides, printed totals, margins, tallies, wave summaries, tracker heads (mutated), findings (every branch), the long tail's tables (titles, packed readings, groups, waves, cuts), payload");
