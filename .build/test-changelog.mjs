/* Pins .build/changelog.mjs, the refresh change log behind the Info tab's
   "Change log" section: the canonical state, and every entry kind
   diffChangelog can emit (poll/flows/finding/meta), plus the quiet-run
   idempotence the unattended writers rely on. Run: node .build/test-changelog.mjs */
import assert from "node:assert/strict";
import { flowsOf, stateOf, initChangelog, diffChangelog, isoLabel, isoLabelLong } from "./changelog.mjs";

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
assert.equal(seed.entries[0].label, "18 Jan");

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
  assert.equal(e.date, DAY); assert.equal(e.label, "19 Jan");
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
  assert.match(e.text, /^The preference-flow assumptions were updated: Greens voters' preferences to Labor 88\.2% → 87\.4%\. The implied-basis two-party estimate moved 52\.3 → 52\.1 \(Labor v the Coalition\)\.$/);
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

console.log("test-changelog.mjs: OK (states, seed, poll/flows/finding/meta entries, idempotence)");
