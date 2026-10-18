/* test-beyond.mjs – pins the rules behind the /beyond-the-vote/ page
   (.build/newtracker/beyond-the-vote.mjs): how an answer's wording places
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
  splitFinding, tallyFinding, rankFinding, findingMeta } = __test;

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
  for (const t of out.topics) for (const q of t.more) assert.ok(q.title && q.waves.length, `${q.id} lists with its waves`);
  for (const t of out.topics) {
    if (!t.blocks.length) { assert.equal(t.finding, null, `${t.id}: no blocks, no finding`); continue; }
    assert.ok(t.finding && t.finding.text && t.finding.meta, `${t.id} opens on a finding`);
    assert.equal(t.finding.of, t.blocks[0].id, `${t.id}'s finding reads its first block`);
    assert.ok(!/[{}]|undefined|NaN/.test(t.finding.text + t.finding.meta), `${t.id}'s finding is filled: "${t.finding.text}"`);
  }
}
console.log("PASS: beyond the vote – sides, printed totals, margins, tallies, wave summaries, tracker heads (mutated), findings (every branch), payload");
