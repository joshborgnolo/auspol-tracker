/* Pins .build/changelog.mjs, the refresh change log behind the Info tab's
   "Change log" section: the canonical state, and every entry kind
   diffChangelog can emit (poll/flows/finding/meta), plus the quiet-run
   idempotence the unattended writers rely on. Run: node .build/test-changelog.mjs */
import assert from "node:assert/strict";
import { flowsOf, stateOf, initChangelog, diffChangelog, newPollKeys, isoLabel, isoLabelYear, isoLabelLong } from "./changelog.mjs";

const FLOW0 = { grn: 0.882, onp: 0.255, oth: 0.546 };
const FP0 = { lnp: 0.3, grn: 0.91, oth: 0.55 };
const DAY = "2029-01-19";

const S = (over = {}) => stateOf({
  lead: { pair: "alp_on", basis: "imp", alp: 52.3 },
  imp: 52.2, pub: 51.1, on: 52.3, momSig: false,
  flows: flowsOf(FLOW0, FP0, null),
  polls: ["2026-10-08|Newspoll", "2026-10-10|Resolve"],
  moves: {}, movesMeta: {},
  ...over,
});
const SEED_COMMITTED = initChangelog(S(), "2029-01-18").entries;
const diff = (prev, next, pollInfo) => diffChangelog(prev, SEED_COMMITTED, next, DAY, pollInfo);

/* labels */
assert.equal(isoLabel("2029-01-09"), "9 Jan");
assert.equal(isoLabelLong("2029-01-09"), "9 January 2029");
assert.equal(isoLabelYear("2029-01-09"), "9 Jan 2029", "entry labels carry the year");
assert.ok(!isoLabel("2029-01-09").startsWith("0"));

/* stateOf: key order in the raw object never changes the canonical state */
const r1 = { lead: { pair: "alp_on", basis: "imp", alp: 52.34 }, polls: ["b|B", "a|A"], moves: { z: 1, a: -1 }, movesMeta: {} };
const r2 = { ...r1, polls: [...r1.polls].reverse(), moves: { a: -1, z: 1 } };
assert.deepEqual(stateOf(r1), stateOf(r2));
assert.equal(stateOf(r1).lead.alp, 52.3, "lead rounds to one decimal");
assert.ok(stateOf({ polls: undefined }).polls.length === 0, "absent polls become an empty list");

/* flowsOf: one decimal, and ANY figure change flips the hash */
const f0 = flowsOf(FLOW0, FP0, null);
assert.equal(f0.grn, 88.2); assert.equal(f0.band, null);
assert.ok(/^[0-9a-f]{12}$/.test(f0.hash));
assert.notEqual(flowsOf({ ...FLOW0, grn: 0.881 }, FP0, null).hash, f0.hash, "a 0.1pt flow move still flips the hash");
assert.equal(flowsOf(FLOW0, FP0, 0.29).hash !== flowsOf(FLOW0, FP0, null).hash, true, "the band counts too");

/* seed: initChangelog states the day's reading */
const seed = initChangelog(S(), "2029-01-18");
assert.equal(seed.entries.length, 1);
assert.equal(seed.entries[0].kind, "seed");
assert.match(seed.entries[0].text, /The change log starts here — the two-party preferred estimate is 52\.3 \(Labor v One Nation, implied flows\)/);
assert.equal(seed.entries[0].date, "2029-01-18");
assert.equal(seed.entries[0].label, "18 Jan 2029");

/* quiet run: identical state appends nothing and hands the entries back */
{
  const { appended, entries } = diff(S(), S());
  assert.equal(appended.length, 0);
  assert.equal(entries.length, SEED_COMMITTED.length);
}

/* one poll lands and the estimate moves */
{
  const prev = S({ polls: ["2026-10-08|Newspoll"], lead: { pair: "alp_on", basis: "imp", alp: 52.2 } });
  const next = S({ polls: ["2026-10-08|Newspoll", "2026-10-10|Resolve"] });
  const { appended } = diff(prev, next, {
    "2026-10-10|Resolve": { name: "Resolve", fw: "8–10 Oct", sample: 1136, url: "https://example.com/resolve" },
  });
  assert.equal(appended.length, 1);
  const e = appended[0];
  assert.equal(e.kind, "poll");
  assert.equal(e.date, DAY); assert.equal(e.label, "19 Jan 2029");
  assert.match(e.text, /^Resolve \(fieldwork 8–10 Oct, n=1,136\) added — the two-party preferred estimate moved 52\.2 → 52\.3 \(Labor v One Nation, implied flows\)\.$/);
  assert.equal(e.url, "https://example.com/resolve");
}

/* one poll lands and the estimate holds */
{
  const prev = S({ polls: ["2026-10-08|Newspoll"] });
  const next = S();
  const { appended } = diff(prev, next, { "2026-10-10|Resolve": { name: "Resolve", fw: null, sample: null, url: null } });
  assert.equal(appended.length, 1);
  assert.match(appended[0].text, /^Resolve added — the two-party preferred estimate held at 52\.3 \(Labor v One Nation, implied flows\)\.$/);
  assert.ok(!("url" in appended[0]), "no url key when the wave has none");
}

/* several polls in one refresh group into one entry */
{
  const prev = S({ polls: [] });
  const next = S({ polls: ["2026-10-08|Newspoll", "2026-10-10|Resolve"] });
  const { appended } = diff(prev, next, {
    "2026-10-08|Newspoll": { name: "Newspoll", fw: "6–8 Oct", sample: 1200, url: "https://example.com/np" },
    "2026-10-10|Resolve": { name: "Resolve", fw: "8–10 Oct", sample: 1136, url: "https://example.com/resolve" },
  });
  assert.equal(appended.length, 1);
  assert.match(appended[0].text, /^2 polls added — Newspoll \(fieldwork 6–8 Oct, n=1,200\); Resolve \(fieldwork 8–10 Oct, n=1,136\) — the two-party preferred estimate held at 52\.3 \(Labor v One Nation, implied flows\)\.$/);
  /* one link per poll, named – a lone url named only the first */
  assert.deepEqual(appended[0].links, [{ name: "Newspoll", url: "https://example.com/np" }, { name: "Resolve", url: "https://example.com/resolve" }]);
  assert.ok(!("url" in appended[0]), "a several-poll entry links by `links`, not `url`");
}

/* corrections are not new polls: a moved end date or a renamed house pairs
   off with the key it replaced; a genuinely new wave still counts */
{
  const P = ["2026-10-08|Newspoll", "2026-10-10|Resolve", "2026-09-01|Redbridge"];
  assert.deepEqual(newPollKeys(P, ["2026-10-09|Newspoll", "2026-10-10|Resolve", "2026-09-01|Redbridge"]), [], "a corrected date");
  assert.deepEqual(newPollKeys(P, ["2026-10-08|Newspoll", "2026-10-10|Resolve", "2026-09-01|RedBridge/Accent"], { Redbridge: "RedBridge/Accent" }), [], "a renamed house");
  assert.deepEqual(newPollKeys(P, ["2026-10-08|Newspoll", "2026-10-10|Resolve", "2026-09-01|RedBridge/Accent"]), ["2026-09-01|RedBridge/Accent"], "no rename map, no pairing");
  assert.deepEqual(newPollKeys(P, [...P, "2026-10-12|Newspoll"]), ["2026-10-12|Newspoll"], "nothing vanished: a new wave");
  assert.deepEqual(newPollKeys(P, ["2026-10-22|Newspoll", "2026-10-10|Resolve", "2026-09-01|Redbridge"]), ["2026-10-22|Newspoll"], "past a week apart is new");
  const corr = diff(S(), S({ polls: ["2026-10-09|Newspoll", "2026-10-10|Resolve"] })).appended;
  assert.equal(corr.length, 0, "a correction alone logs nothing");
}

/* polls and flows in one refresh: the move is told once, in the poll entry */
{
  const k = "2026-10-12|Newspoll";
  const prev = S();
  const next = S({ polls: [...S().polls, k], flows: flowsOf(FLOW0, { ...FP0, lnp: 0.33 }, null), lead: { pair: "alp_on", basis: "imp", alp: 52.6 }, on: 52.6 });
  const a = diff(prev, next, { [k]: { name: "Newspoll", fw: "9–11 Oct", sample: 1250, url: null } }).appended;
  assert.deepEqual(a.map((e) => e.kind), ["flows", "poll"]);
  assert.equal(a[0].text, "The preference-flow assumptions were updated: Coalition voters' preferences to Labor over One Nation 30.0% → 33.0%.");
  assert.equal(a[1].text, "Newspoll (fieldwork 9–11 Oct, n=1,250) added — the two-party preferred estimate moved 52.3 → 52.6 (Labor v One Nation, implied flows), with the preference-flow update the same day.");
}

/* headline pairing switches */
{
  const prev = S({ lead: { pair: "alp_lnp", basis: "imp", alp: 56.4 } });
  const { appended } = diff(prev, S());
  assert.equal(appended.length, 1);
  assert.equal(appended[0].kind, "meta");
  assert.match(appended[0].text, /headline pairing is now Labor v One Nation \(it was Labor v the Coalition\); the estimate reads 52\.3 \(implied flows\)/);
}

/* headline basis switches */
{
  const prev = S({ lead: { pair: "alp_on", basis: "pub", alp: 51.4 } });
  const { appended } = diff(prev, S());
  assert.equal(appended.length, 1);
  assert.equal(appended[0].kind, "meta");
  assert.match(appended[0].text, /now on implied flows \(it was on published figures\); the estimate reads 52\.3\./);
}

/* a poll whose state has no prior reading is narrated as a reading, not a move */
{
  const prev = S({ lead: null, polls: [] });
  const next = S({ polls: ["2026-10-08|Newspoll"] });
  const { appended } = diff(prev, next, { "2026-10-08|Newspoll": { name: "Newspoll", fw: "6–8 Oct", sample: 1200, url: null } });
  assert.equal(appended.length, 1);
  assert.match(appended[0].text, /added — the estimate reads 52\.3 \(Labor v One Nation, implied flows\)\.$/);
  assert.doesNotMatch(appended[0].text, /moved|held/);
}

/* the flow assumptions move */
{
  const prev = S({ imp: 52.3 });
  const next = S({ flows: flowsOf({ ...FLOW0, grn: 0.874 }, FP0, null), imp: 52.1 });
  const { appended } = diff(prev, next);
  assert.equal(appended.length, 1);
  const e = appended[0];
  assert.equal(e.kind, "flows");
  assert.match(e.text, /^The preference-flow assumptions were updated: Greens voters' preferences to Labor 88\.2% → 87\.4%\. The two-party preferred estimate held at 52\.3 \(Labor v One Nation, implied flows\)\. The implied-basis Labor v the Coalition estimate moved 52\.3 → 52\.1\.$/);
}

/* the Labor v One Nation table moves: named, and the headline's own move
   reported (2026-10-12: it used to log only the Labor v Coalition figure) */
{
  const prev = S();
  const next = S({ flows: flowsOf(FLOW0, { ...FP0, lnp: 0.33 }, null), lead: { pair: "alp_on", basis: "imp", alp: 52.6 }, on: 52.6 });
  const { appended } = diff(prev, next);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].text, "The preference-flow assumptions were updated: Coalition voters' preferences to Labor over One Nation 30.0% → 33.0%. The two-party preferred estimate moved 52.3 → 52.6 (Labor v One Nation, implied flows).");
}

/* the headline on the counted table: one estimate sentence, not two */
{
  const L = { pair: "alp_lnp", basis: "imp", alp: 52.3 };
  const prev = S({ lead: L, imp: 52.3 });
  const next = S({ lead: { ...L, alp: 52.1 }, imp: 52.1, flows: flowsOf({ ...FLOW0, grn: 0.874 }, FP0, null) });
  assert.equal(diff(prev, next).appended[0].text, "The preference-flow assumptions were updated: Greens voters' preferences to Labor 88.2% → 87.4%. The two-party preferred estimate moved 52.3 → 52.1 (Labor v the Coalition, implied flows).");
}

/* per-cell bands (flows.mjs FP_ON_BAND is an object): stored, compared, and
   a state written before they were (band: null) migrates without an entry */
{
  const B0 = { lnp: 0.03, grn: 0.025, oth: 0.04 };
  assert.deepEqual(flowsOf(FLOW0, FP0, B0).band, { lnp: 3, grn: 2.5, oth: 4 });
  const moved = diff(S({ flows: flowsOf(FLOW0, FP0, B0) }), S({ flows: flowsOf(FLOW0, FP0, { ...B0, lnp: 0.04 }) })).appended;
  assert.equal(moved.length, 1);
  assert.match(moved[0].text, /the doubt allowed on Coalition voters' flow to Labor over One Nation ±3\.0 → ±4\.0 points\./);
  assert.equal(diff(S(), S({ flows: flowsOf(FLOW0, FP0, B0) })).appended.length, 0, "null → per-cell band is a migration, not an update");
}

/* a poll whose fieldwork is pending: the phrase is gen-data's whole, not "fieldwork fieldwork…" */
{
  const k = "2026-10-12|Newspoll";
  const t = diff(S(), S({ polls: [...S().polls, k] }), { [k]: { name: "Newspoll", fw: "fieldwork dates TBC", sample: 1200, url: null } }).appended[0].text;
  assert.match(t, /^Newspoll \(fieldwork dates TBC, n=1,200\) added/);
}

/* month-on-month significance flips both ways */
{
  const on = diff(S(), S({ momSig: true })).appended;
  assert.equal(on.length, 1); assert.equal(on[0].kind, "finding");
  assert.match(on[0].text, /is now statistically significant \(implied basis\)/);
  const off = diff(S({ momSig: true }), S()).appended;
  assert.equal(off.length, 1);
  assert.match(off[0].text, /no longer statistically significant/);
}

/* a who-votes-for-whom break appears */
{
  const moves = { "onp|age|55+": 1 };
  const meta = { "onp|age|55+": { party: "onp", group: "55+", setLabel: "By age" } };
  const { appended } = diff(S(), S({ moves, movesMeta: meta }));
  assert.equal(appended.length, 1);
  assert.equal(appended[0].kind, "finding");
  assert.match(appended[0].text, /^55\+ voters \(by age\) now break significantly toward One Nation, relative to all voters\.$/);
}

/* a break falls away */
{
  const prev = S({
    moves: { "onp|age|55+": 1 },
    movesMeta: { "onp|age|55+": { party: "onp", group: "55+", setLabel: "By age" } },
  });
  const { appended } = diff(prev, S());
  assert.equal(appended.length, 1);
  assert.match(appended[0].text, /^55\+ voters \(by age\) no longer break significantly toward One Nation, relative to all voters\.$/);
}

/* plain "Education"-style set labels lose no word */
{
  const moves = { "grn|education|University": 1 };
  const meta = { "grn|education|University": { party: "grn", group: "University", setLabel: "Education" } };
  const { appended } = diff(S(), S({ moves, movesMeta: meta }));
  assert.match(appended[0].text, /^University voters \(by education\) now break significantly toward the Greens/);
}

/* a direction flip ends the old finding and opens the new one */
{
  const prev = S({
    moves: { "onp|age|55+": 1 },
    movesMeta: { "onp|age|55+": { party: "onp", group: "55+", setLabel: "By age" } },
  });
  const next = S({
    moves: { "onp|age|55+": -1 },
    movesMeta: { "onp|age|55+": { party: "onp", group: "55+", setLabel: "By age" } },
  });
  const { appended } = diff(prev, next);
  assert.equal(appended.length, 2);
  assert.match(appended[0].text, /no longer break significantly toward One Nation/);
  assert.match(appended[1].text, /now break significantly away from One Nation/);
}

/* everything that can fire on one day comes out in one entry set */
{
  const prev = S({ polls: [], flows: flowsOf(FLOW0, FP0, null), momSig: false, lead: { pair: "alp_lnp", basis: "imp", alp: 56.4 } });
  const next = S({ momSig: true });
  const { appended } = diff(prev, next, { "2026-10-08|Newspoll": { name: "Newspoll", fw: null, sample: null, url: null }, "2026-10-10|Resolve": { name: "Resolve", fw: null, sample: null, url: null } });
  assert.deepEqual(appended.map((e) => e.kind), ["meta", "poll", "finding"]);
}

/* ---- the widened log (2026-10-12): primaries, leader ratings, direction,
   house effects, every measure's month-on-month significance, and the issues'
   best-party verdicts. W() is S() plus the new fields. */
const PRIM0 = { alp: 27.5, lnp: 21.6, grn: 13.4, onp: 26.1, oth: 11.4 };
const LEAD0 = { alb_net: -21.6, taylor_net: -6.9, hanson_fav: -5.6 };
const DIR0 = { right: 27.1, wrong: 62.2, net: -35.1 };
const LEAN0 = { key: "alp_on|imp", v: { "Roy Morgan": 0.7, Newspoll: -0.4, Resolve: 0.4 } };
const W = (over = {}) => S({
  prim: PRIM0, leaders: LEAD0, dir: DIR0, lean: LEAN0, sig: {}, sigMeta: {},
  issLead: { economy: "lnp", housing: "" }, issLabel: { economy: "Economic management", housing: "Housing" },
  ...over,
});
const RM = "2026-10-11|Roy Morgan";
const RM_INFO = { [RM]: { name: "Roy Morgan", fw: "28 Sep–11 Oct", sample: 2655, url: null } };

/* the old state has none of the new fields: they default to null */
{
  const st = S();
  for (const k of ["prim", "leaders", "lean", "dir", "issLead", "sig"]) assert.equal(st[k], null, `${k} absent → null`);
}

/* migration: the first widened refresh says so once, with where everything
   stands – no move or finding is logged against the missing old figures */
{
  const next = W({ sig: { "prim|onp": 1, "lead|alb_net": -1 }, sigMeta: { "prim|onp": "One Nation's primary vote", "lead|alb_net": "Albanese's net approval" } });
  const { appended } = diff(S(), next);
  assert.deepEqual(appended.map((e) => e.kind), ["seed"]);
  const t = appended[0].text;
  assert.match(t, /^From today the log also records the primary votes/);
  assert.match(t, /Primary votes: Labor 27\.5, the Coalition 21\.6, One Nation 26\.1, the Greens 13\.4, others 11\.4\./);
  assert.match(t, /Leader ratings: Albanese's net approval −21\.6, Taylor's net approval −6\.9, Hanson's net favourability −5\.6\./);
  assert.match(t, /National direction: right track 27\.1, wrong track 62\.2 \(net −35\.1\)\./);
  assert.match(t, /Leading significantly as the best party: the Coalition on economic management\./);
  assert.match(t, /Moving significantly over the past month: One Nation's primary vote \(up\); Albanese's net approval \(down\)\.$/, "primaries listed first");
  /* and with a poll the same day, the poll entry carries no a → b figures */
  const both = diff(S(), W({ polls: [...S().polls, RM] }), RM_INFO).appended;
  assert.deepEqual(both.map((e) => e.kind), ["seed", "poll"]);
  assert.doesNotMatch(both[1].text, /Primary votes|→/);
  assert.match(both[1].text, /^Roy Morgan .* added — the two-party preferred estimate held at 52\.3 \(Labor v One Nation, implied flows\)\. House effect \(Labor v One Nation, implied flows; positive leans Labor\): Roy Morgan \+0\.7\.$/, "a lean with nothing before it reads as a level");
}

/* a log begun on a widened state opens with where everything stands */
{
  const t = initChangelog(W({ sig: { "prim|onp": 1 }, sigMeta: { "prim|onp": "One Nation's primary vote" } }), "2029-01-18").entries[0].text;
  assert.match(t, /^The change log starts here — the two-party preferred estimate is 52\.3 \(Labor v One Nation, implied flows\)\. Primary votes: Labor 27\.5, the Coalition 21\.6, One Nation 26\.1, the Greens 13\.4, others 11\.4\. Leader ratings: /);
  assert.match(t, /Moving significantly over the past month: One Nation's primary vote \(up\)\. From today, every movement in these figures and every statistical finding that comes or goes is recorded here\.$/);
}

/* quiet run on the widened state: nothing */
assert.equal(diff(W(), W()).appended.length, 0);

/* a poll entry quotes what moved since the last entry, as the site prints it */
{
  const prev = W({ polls: S().polls });
  const next = W({
    polls: [...S().polls, RM],
    prim: { ...PRIM0, alp: 27.3, onp: 26.4 },
    leaders: { ...LEAD0, alb_net: -20.0 },
    dir: { right: 28.0, wrong: 62.2, net: -34.2 },
    lean: { ...LEAN0, v: { ...LEAN0.v, "Roy Morgan": 0.8, Newspoll: -0.2 } },
  });
  const { appended } = diff(prev, next, RM_INFO);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].text,
    "Roy Morgan (fieldwork 28 Sep–11 Oct, n=2,655) added — the two-party preferred estimate held at 52.3 (Labor v One Nation, implied flows)." +
    " Primary votes: Labor 27.5 → 27.3, One Nation 26.1 → 26.4." +
    " Leader ratings: Albanese's net approval −21.6 → −20.0." +
    " National direction: right track 27.1 → 28.0, wrong track held at 62.2 (net −35.1 → −34.2)." +
    " House effect (Labor v One Nation, implied flows; positive leans Labor): Roy Morgan +0.7 → +0.8.");
}

/* nothing moved: primaries say so, the rest stay silent; a house new to the
   table shows its first lean; a different pairing/basis is not a move */
{
  const k = "2026-10-12|Wolf & Smith";
  const next = W({ polls: [...S().polls, k], lean: { ...LEAN0, v: { ...LEAN0.v, "Wolf & Smith": 0.6 } } });
  const t = diff(W(), next, { [k]: { name: "Wolf & Smith", fw: null, sample: null, url: null } }).appended[0].text;
  assert.match(t, / Primary votes held\. House effect \(Labor v One Nation, implied flows; positive leans Labor\): Wolf & Smith \+0\.6\.$/);
  const swapped = W({ polls: [...S().polls, RM], lean: { key: "alp_lnp|imp", v: { "Roy Morgan": 1.2 } } });
  assert.match(diff(W(), swapped, RM_INFO).appended[0].text, /\(Labor v the Coalition, implied flows; positive leans Labor\): Roy Morgan \+1\.2\.$/, "no arrow across a basis switch");
  const held = diff(W(), W({ polls: [...S().polls, RM] }), RM_INFO).appended[0].text;
  assert.match(held, /Roy Morgan held at \+0\.7\.$/);
  assert.doesNotMatch(held, /Leader ratings|National direction/, "unmoved leaders and direction stay out");
}

/* month-on-month significance on any measure: begins, ends, flips */
{
  const meta = { "prim|onp": "One Nation's primary vote", "dir|net": "the right-track-minus-wrong-track net" };
  const on = diff(W(), W({ sig: { "prim|onp": 1, "dir|net": -1 }, sigMeta: meta })).appended;
  assert.deepEqual(on.map((e) => e.text), [
    "The rise in One Nation's primary vote over the past month is now statistically significant.",
    "The fall in the right-track-minus-wrong-track net over the past month is now statistically significant.",
  ]);
  assert.ok(on.every((e) => e.kind === "finding"));
  const off = diff(W({ sig: { "prim|onp": 1 }, sigMeta: meta }), W()).appended;
  assert.deepEqual(off.map((e) => e.text), ["The month-on-month rise in One Nation's primary vote is no longer statistically significant."], "the label survives from the old state");
  const flip = diff(W({ sig: { "prim|onp": 1 }, sigMeta: meta }), W({ sig: { "prim|onp": -1 }, sigMeta: meta })).appended;
  assert.deepEqual(flip.map((e) => e.text.slice(0, 30)), ["The month-on-month rise in One", "The fall in One Nation's prima"]);
}

/* the issues' best-party verdict: gained, changed hands, lapsed; an issue
   new to the panel says nothing */
{
  const iss = (economy, housing, extra = {}) => W({ issLead: { economy, housing, ...extra }, issLabel: { economy: "Economic management", housing: "Housing", crime: "Crime" } });
  assert.deepEqual(diff(iss("lnp", ""), iss("lnp", "alp")).appended.map((e) => e.text), ["Labor now leads significantly as the best party on housing."]);
  assert.deepEqual(diff(iss("lnp", ""), iss("onp", "")).appended.map((e) => e.text), ["One Nation now leads significantly as the best party on economic management, taking over from the Coalition."]);
  assert.deepEqual(diff(iss("lnp", ""), iss("", "")).appended.map((e) => e.text), ["No party leads significantly as the best party on economic management any more (the Coalition did)."]);
  assert.equal(diff(iss("lnp", ""), iss("lnp", "", { crime: "onp" })).appended.length, 0);
}

console.log("test-changelog.mjs: OK (states, seed, poll/flows/finding/meta entries, idempotence, the widened figures and findings)");
