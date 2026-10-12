#!/usr/bin/env node
// Offline checks for demosau-read.mjs's verification (the Capital Brief
// filing path, 2026-10-05). Paragraphs are made-up text in Capital Brief's
// style; the readings are what Matilda would answer, right and wrong. (The
// Matilda call was backtested against the Jul–Sep 2026 articles.) The
// planCapitalBrief cases (2026-10-12) use the free text of the 17 Sep 2026
// poll article and the 12 Oct 2026 MRP article.
import { verifyDemosau, sampleOf, fieldworkOf, planCapitalBrief, MRP_TEXT } from "./demosau-read.mjs";

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

// ---- the quarterly MRP and its sample/fieldwork phrasing (2026-10-12) -----
eq("an MRP's 'polling of N Australian voters'", sampleOf("The data is based on polling of 9,740 Australian voters conducted in August and September."), 9740);
eq("'surveyed N people'", sampleOf("DemosAU's MRP model, which surveyed 9343 people between May and July 2026"), 9343);
eq("'interviewed N voters'", sampleOf("DemosAU interviewed 6928 voters across the country"), 6928);
eq("'more than 9,000 Australians' is not a sample", sampleOf("The latest quarterly Capital Brief/DemosAU MRP poll of more than 9,000 Australians shows"), null);
eq("Oct 2026: 'conducted in August and September'",
  fieldworkOf("The data is based on polling of 9,740 Australian voters conducted in August and September.", "2026-10-12"),
  { dateStart: "2026-08-01", date: "2026-09-30", exact: false });
eq("Jul 2026: 'between May and July 2026' stops the day before publication",
  fieldworkOf("The data was produced using DemosAU's MRP model, which surveyed 9343 people between May and July 2026 and projected a result", "2026-07-28"),
  { dateStart: "2026-05-01", date: "2026-07-27", exact: false });
eq("Dec 2025: stated days are exact (the committed Oct–Nov 2025 row's window)",
  fieldworkOf("DemosAU interviewed 6928 voters across the country between in October 5 and November 11.", "2025-12-02"),
  { dateStart: "2025-10-05", date: "2025-11-11", exact: true });
eq("months after the publication month are last year's",
  fieldworkOf("The poll was conducted in November and December.", "2027-01-20"), { dateStart: "2026-11-01", date: "2026-12-31", exact: false });
eq("a monthly poll's 'conducted earlier this week' is no window",
  fieldworkOf("The poll of 1,583 Australians was conducted earlier this week.", "2026-09-17"), null);

// rows as data/polls.json carries them (others in `ind`)
const ROW = (date, pollster, alp, lnp, grn, onp, ind, extra = {}) => ({ date, pollster, alp, lnp, grn, onp, ind, ...extra });
const AUG = ROW("2026-08-20", "DemosAU", 26, 25, 12, 24, 13, { published: "2026-08-24T08:51" });
const SEP = ROW("2026-09-14", "DemosAU", 28, 20, 13, 26, 13, { published: "2026-09-17T08:30" });
const MRP_JUL = ROW("2026-07-11", "DemosAU (MRP)", 26, 21, 13, 30, 10, { dateStart: "2026-05-27", published: "2026-07-27T07:10" });
const ROWS = [MRP_JUL, AUG, SEP];

// 12 Oct 2026: the quarterly MRP, its changes on the July MRP
const OCT_URL = "https://www.capitalbrief.com/newsletter/hanson-slips-in-latest-capital-brief-poll-9d5b141e-3f50-4e8b-80e2-c248274752bc/";
const octParas = [
  "Hanson slips in latest Capital Brief poll",
  "Exclusive new polling conducted for Capital Brief shows a seven percentage point decline in support for One Nation in its rural and regional heartland, with the Nationals under Matt Canavan gaining support and Anthony Albanese and Labor back within reach of a majority government.",
  "The insurgent One Nation continues to record a healthy primary vote, but the exclusive Capital Brief/DemosAU poll suggests it is failing to win enough preferences from Coalition voters to translate that support into seats.",
  "The data is based on polling of 9,740 Australian voters conducted in August and September. DemosAU uses its multilevel regression and poststratification (MRP) model, including a Monte Carlo probability model, to project likely seat outcomes and ranges.",
  "As at 30 September, Labor led on primary votes with 27% support, up one percentage point from the same analysis published in July.",
  "One Nation recorded 26%, down four points from the previous quarter. The Coalition rose one point to 22%, the Greens held steady at 13% and others rose two points to 12%.",
  "The analysis projects Labor would win between 73 and 85 seats, a significant improvement from the 60 to 72 seats projected in the June quarter. A party needs 76 seats for a majority.",
];
const octArt = { url: OCT_URL, published: "2026-10-12T08:57", freeText: octParas.slice(1).join(" ") };
// what Matilda answered on the 12 Oct runs (the from-figures are the July MRP's)
const octReading = { scope: "demosau", fields: {
  alp: cite(4, "Labor led on primary votes with 27% support, up one percentage point from the same analysis published in July", 27, 26),
  onp: cite(5, "One Nation recorded 26%, down four points from the previous quarter", 26, 30),
  lnp: cite(5, "The Coalition rose one point to 22%", 22, 21),
  grn: cite(5, "the Greens held steady at 13%", 13, 13),
  oth: cite(5, "others rose two points to 12%", 12, 10),
} };
eq("the MRP article says it is one", MRP_TEXT.test(octArt.freeText), true);
const OCT_ROW = { date: "2026-09-30", dateStart: "2026-08-01", published: "2026-10-12T08:57", pollster: "DemosAU (MRP)",
  client: "—", sample: 9740, alp: 27, lnp: 22, grn: 13, onp: 26, ind: 12, oth: null, tpp_alp: null, tpp_lnp: null,
  url: OCT_URL, fieldworkPending: true };
const plan = (reading, paras, art, rows, lastDay) => planCapitalBrief({ reading, paras, art, rows, lastDay });
eq("12 Oct MRP files as DemosAU (MRP), reconciled with the July MRP, window = the stated months",
  plan(octReading, octParas, octArt, ROWS, "2026-09-17"), { row: OCT_ROW });
let pl = plan(octReading, octParas, octArt, [AUG, SEP], "2026-09-17");
eq("no previous MRP on file: it prompts, it never files as a monthly poll",
  [pl.row, /no previous DemosAU MRP figure/.test(pl.prompt || "")], [undefined, true]);
const noMonths = { ...octArt, freeText: octArt.freeText.replace(" conducted in August and September", "") };
pl = plan(octReading, octParas.map((p) => p.replace(" conducted in August and September", "")), noMonths, ROWS, "2026-09-17");
eq("an MRP article with no fieldwork months prompts (a 4-day window would count it in the aggregates)",
  [pl.row, /no fieldwork months/.test(pl.prompt || "")], [undefined, true]);
eq("once filed, the same figures again are a follow-up (the report's own day is skipped before this)",
  Object.keys(plan(octReading, octParas, octArt, [...ROWS, OCT_ROW], "2026-10-11")), ["followUp"]);

// 17 Sep 2026: the monthly poll, its changes on the August poll
const SEP_URL = "https://www.capitalbrief.com/newsletter/exclusive-poll-voters-back-social-media-reform-fbd908f1-a09e-4d1e-9713-9c8c02dd0d31/";
const sepParas = [
  "Exclusive poll: Voters back social media reform",
  "A new poll shows nearly two-thirds of Australians back the Albanese government's push to allow internet users to opt out of algorithmically recommended content and require digital service providers to accept a duty of care.",
  "The latest Capital Brief/DemosAU poll also shows Labor's primary vote rose two percentage points over the past month to 28%, its best result since February.",
  "However, One Nation remains close behind on 26%, also up two points from the August poll, while the Coalition slipped five points to 20%. The Greens climbed one point to 13%, with others steady on 13%.",
  "The poll of 1,583 Australians was conducted earlier this week and has a margin of error of plus or minus 3.3 percentage points.",
];
const sepArt = { url: SEP_URL, published: "2026-09-17T08:30", freeText: sepParas.slice(1).join(" ") };
const sepReading = { scope: "demosau", fields: {
  alp: cite(2, "Labor's primary vote rose two percentage points over the past month to 28%", 28, 26),
  onp: cite(3, "One Nation remains close behind on 26%, also up two points from the August poll", 26, 24),
  lnp: cite(3, "the Coalition slipped five points to 20%", 20, 25),
  grn: cite(3, "The Greens climbed one point to 13%", 13, 12),
  oth: cite(3, "others steady on 13%", 13, 13),
} };
const SEP_ROW = { date: "2026-09-13", dateStart: "2026-09-09", published: "2026-09-17T08:30", pollster: "DemosAU",
  client: "Capital Brief", sample: 1583, alp: 28, lnp: 20, grn: 13, onp: 26, ind: 13, oth: null, tpp_alp: null, tpp_lnp: null,
  url: SEP_URL, fieldworkPending: true };
eq("17 Sep poll files as before: provisional window, fieldwork TBC",
  plan(sepReading, sepParas, sepArt, [MRP_JUL, AUG], "2026-08-24"), { row: SEP_ROW });
const sepMrpMention = { ...sepArt, freeText: sepArt.freeText + " DemosAU's July MRP model had One Nation on 30%." };
eq("a monthly poll's article that mentions the MRP still files as the monthly poll",
  plan(sepReading, sepParas, sepMrpMention, [MRP_JUL, AUG], "2026-08-24"), { row: SEP_ROW });

// follow-ups (Capital Brief's data-centre pieces 1–2 days after the Aug 2026
// poll; "Money talks" the day after the Jul 2026 MRP)
const dcParas = ["Data discontent", "Less than a quarter (23%) of the 1,562 people surveyed said they would support a data centre in their area, while 44% were opposed."];
const dcArt = { url: "https://www.capitalbrief.com/newsletter/data-discontent/", published: "2026-09-18T16:52", freeText: dcParas[1] };
pl = plan({ scope: "other", fields: {} }, dcParas, dcArt, ROWS, "2026-09-17");
eq("a piece with no poll figures the day after a poll is set aside", [Object.keys(pl), /no poll figures/.test(pl.followUp)], [["followUp"], true]);
eq("...but nine days on it still prompts", Object.keys(plan({ scope: "other", fields: {} }, dcParas, { ...dcArt, published: "2026-09-26T08:00" }, ROWS, "2026-09-17")), ["prompt"]);
const mtParas = ["Money talks", "One Nation's national primary vote was 30%, followed by Labor on 26% and the Coalition on 21%."];
const mtArt = { url: "https://www.capitalbrief.com/newsletter/money-talks/", published: "2026-07-28T08:47", freeText: mtParas[1] };
pl = plan({ scope: "demosau", fields: { onp: cite(1, "One Nation's national primary vote was 30%", 30, null), alp: cite(1, "Labor on 26%", 26, null),
  lnp: cite(1, "the Coalition on 21%", 21, null) } }, mtParas, mtArt, [MRP_JUL], "2026-07-27");
eq("a piece restating the figures on file is set aside", [Object.keys(pl), /restates the 2026-07-11 DemosAU \(MRP\)/.test(pl.followUp)], [["followUp"], true]);
pl = plan({ scope: "demosau", fields: { onp: cite(1, "One Nation's national primary vote was 30%", 30, null) } }, mtParas, mtArt,
  [{ ...MRP_JUL, onp: 29 }], "2026-07-27");
eq("...but a figure that is NOT on file prompts", Object.keys(pl), ["prompt"]);
pl = plan({ scope: "demosau", fields: {} }, mtParas, mtArt, [MRP_JUL], "2026-07-27");
eq("...and so does a poll reading that cites nothing", Object.keys(pl), ["prompt"]);

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("all demosau-read checks pass");
