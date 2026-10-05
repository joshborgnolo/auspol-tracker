#!/usr/bin/env node
// Offline checks for demosau-read.mjs's verification (the Capital Brief
// filing path, 2026-10-05). Paragraphs are made-up text in Capital Brief's
// style; the readings are what Matilda would answer, right and wrong. (The
// Matilda call was backtested against the Jul–Sep 2026 articles.)
import { verifyDemosau, sampleOf } from "./demosau-read.mjs";

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const paras = [
  "Exclusive poll: Voters back social media reform",
  "The latest Capital Brief/DemosAU poll also shows Labor’s primary vote rose two percentage points over the past month to 28%, its best result since February.",
  "However, One Nation remains close behind on 26%, also up two points from the August poll, while the Coalition slipped five points to 20%. The Greens climbed one point to 13%, with others steady on 13%.",
  "The poll of 1,583 Australians was conducted earlier this week.",
  "One Nation was close behind on 24%.",
  "While One Nation is still two points off the lead, its support tumbled five percentage points over the past month.",
  "On which party is best to handle the economy, the Coalition rose to 31%.",
];
const prev = { alp: 26, lnp: 25, grn: 12, onp: 24, oth: 13 };
const cite = (para, quote, value, from, changeQuote) => ({ para, quote, value, from, ...(changeQuote ? { changeQuote } : {}) });
const read = (fields, p = prev) => verifyDemosau({ scope: "demosau", fields }, paras, p);

let v = read({
  alp: cite(1, "Labor’s primary vote rose two percentage points over the past month to 28%", 28, 26),
  onp: cite(2, "One Nation remains close behind on 26%, also up two points from the August poll", 26, 24),
  lnp: cite(2, "the Coalition slipped five points to 20%", 20, 25),
  grn: cite(2, "The Greens climbed one point to 13%", 13, 12),
  oth: cite(2, "others steady on 13%", 13, 13),
});
eq("a right reading verifies all five", v.ok, { alp: 28, lnp: 20, grn: 13, onp: 26, oth: 13 });
eq("sample from the methodology line", sampleOf(paras.join(" ")), 1583);
eq("no sample stated", sampleOf("The poll was conducted last week."), null);

v = read({ onp: cite(4, "One Nation was close behind on 24%", 24, 29, { para: 5, quote: "its support tumbled five percentage points over the past month" }) },
  { ...prev, onp: 29 });
eq("a change stated in another sentence that names the party", v.ok.onp, 24);
v = read({ onp: cite(4, "One Nation was close behind on 24%", 24, 29) }, { ...prev, onp: 29 });
eq("no change at all is refused", v.ok.onp, undefined);
v = read({ alp: cite(1, "Labor’s primary vote rose two percentage points over the past month to 28%", 28, 26) }, { ...prev, alp: 27 });
eq("a change that doesn't reconcile with the previous wave is rejected", [v.ok.alp, /^REJECTED/.test(v.verdict.alp)], [undefined, true]);
v = read({ lnp: cite(6, "the Coalition rose to 31%", 31, 25) });
eq("an issue rating is not a primary", v.ok.lnp, undefined);
v = read({ grn: cite(2, "The Greens climbed two points to 13%", 13, 11) }, { ...prev, grn: 11 });
eq("a quote not verbatim is refused", v.ok.grn, undefined);
v = read({ lnp: cite(2, "the Coalition slipped five points to 20%", 20, 24) }, { ...prev, lnp: 24 });
eq("a change phrase that doesn't take the earlier figure to the value is refused", v.ok.lnp, undefined);
eq("scope other files nothing", verifyDemosau({ scope: "other", fields: {} }, paras, prev).ok, {});

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("all demosau-read checks pass");
