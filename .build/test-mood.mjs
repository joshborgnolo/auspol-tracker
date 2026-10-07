/* Tests for mood.mjs — the extractor behind data/mood.json and the
   Snapshot's "The economic mood" panel. Three stages:
     1. MOOD_LIB import: parseText grammar pins against real feed headlines
        (the forms the desk has actually used, copied from the 2019–2026
        dump), out-of-band rejection, NZ/Indonesia filters.
     2. --feed-dir subprocess: a synthetic two-topic fixture drives the full
        pipeline in a temp cwd — title-wins disagreement, chain
        reconciliation dropping a printed change, idempotency, guard trips.
     3. Live structural pins on the committed data/mood.json (drift-tolerant:
        counts are >=, not ==).
   Run: node .build/test-mood.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOOD = path.join(ROOT, ".build", "mood.mjs");

process.env.MOOD_LIB = "1";
const { parseText, SERIES, dmyToIso, parseWMDesc, parseNabPdf, nabMeasure, safeName,
        resolveWinYear, parseRmConsumerPdf, parseRmBusinessPost, parseWestpacPdf, parseNabFw, surveyMonthOf } = await import("./mood.mjs");

/* ---------------------------------------------------------------- 1. grammar */
const C = { anchor: SERIES.consumer.anchor, band: SERIES.consumer.band };
const B = { anchor: SERIES.business.anchor, band: SERIES.business.band };
const T = (text, { anchor, band }, want) => {
  const got = parseText(text, anchor, band);
  if (want === null) { assert.equal(got, null, JSON.stringify(text) + " -> null"); return; }
  assert.ok(got, JSON.stringify(text) + " should parse");
  assert.equal(got.v, want[0], "value for " + JSON.stringify(text));
  assert.equal(got.chg, want[1], "change for " + JSON.stringify(text));
};

// P1 — dir + Npts -> V
T("ANZ-Roy Morgan Consumer Confidence down 3.4pts to 67.1 – lowest since May after RBA raises interest rates to 15-year high", C, [67.1, -3.4]);
T("Roy Morgan Business Confidence up 3.1pts to 79.1; driven by a jump of 16.7pts in Victoria after Premier Allan resigns", B, [79.1, 3.1]);
T("ANZ-Roy Morgan Consumer Confidence was up 0.3pts (+0.3%) to 114.3", C, [114.3, 0.3]);
T("ANZ-Roy Morgan Consumer Confidence plunged 11.1pts (-8.7%) to 87.2", C, [87.2, -11.1]);
// P2 — dir -> V (incl. superlative wrapped)
T("Roy Morgan Business Confidence hits a new record low of 76", B, [76, null]);
T("ANZ-Roy Morgan Consumer Confidence consolidates to 110.1", C, [110.1, null]);
// P3 — value-bearing superlative
T("Business Confidence ended 2019 at 8 month low of 104.5", B, [104.5, null]);
// P4 — (virtually) unchanged … at V: RM's 'unchanged' is a rounding verdict, no chg
T("ANZ-Roy Morgan Consumer Confidence virtually unchanged at 75 before this week's Reserve Bank interest rate meeting", C, [75, null]);
T("ANZ-Roy Morgan Consumer Confidence is virtually unchanged at 75.6 in mid-July", C, [75.6, null]);
T("Roy Morgan Business Confidence virtually unchanged in February at 108.5 as Reserve Bank cuts interest rates", B, [108.5, null]);
// P5 — bare assertion in a summary lane
T("Consumer Confidence was 114.3 in August", C, [114.3, null]);
// the 2023-05-02 disagreement pair — the summary is a stale copy, the title wins upstream
T("ANZ-Roy Morgan Consumer Confidence up 1.8pts to 79.8 and has now spent a record nine straight weeks below 80", C, [79.8, 1.8]);
T("ANZ-Roy Morgan Consumer Confidence was up 0.8pts to 78.0 this week and has now spent eight straight weeks below the mark of 80 – the longest stretch below 80 since June 2020.", C, [78.0, 0.8]);
// out-of-band value -> no row (a percentage is never an index value)
T("ANZ-Roy Morgan Consumer Confidence up by 1.7% to 155.3", C, null);
T("ANZ-Roy Morgan Consumer Confidence up 1.5pts to 147.5", C, null);
T("Roy Morgan Business Confidence down 4.6pts to 172.4", B, null);
// a waveless posting yields nothing
T("Roy Morgan releases its annual report on media accuracy", B, null);
// the 'unchanged' clause hides downstream of the real figure — anchor window keeps it out
T("ANZ-Roy Morgan Consumer Confidence up 1.5pts to 76.5 – highest rating since early March after RBA leaves rates unchanged", C, [76.5, 1.5]);
T("Roy Morgan Business Confidence drops 3pts to 98.7 in November after RBA leaves interest rates unchanged again", B, [98.7, -3]);

// slug filters
const cons = (slug) => SERIES.consumer.include.test(slug.replace(/^\d+-/, "")) && !SERIES.consumer.exclude.some((x) => x.test(slug.replace(/^\d+-/, "")));
const bus = (slug) => SERIES.business.include.test(slug.replace(/^\d+-/, "")) && !SERIES.business.exclude.some((x) => x.test(slug.replace(/^\d+-/, "")));
assert.ok(cons("10080-anz-roy-morgan-consumer-confidence-october-6"));
assert.ok(!cons("10352-anz-roy-morgan-nz-consumer-confidence-september-2026"), "NZ wave is excluded");
assert.ok(!cons("10352-anz-roy-morgan-good-time-to-buy-consumer-confidence"));
assert.ok(bus("10336-roy-morgan-business-confidence-august-2026"));
assert.ok(bus("roy-morgan-business-confidence-plummeted-14-2pts-to-a-new-record-low-of-only-76-5-in-april-as-the-conflict-in-the-middle-east-continued-without-resolution"));
assert.ok(!bus("10142-roy-morgan-consumer-confidence-weekly-update-business-confidencepill"));
assert.ok(!bus("10142-roy-morgan-mining-business-confidence-august-2026"));

assert.equal(dmyToIso("6/10/2026"), "2026-10-06");
assert.equal(dmyToIso("29/09/2026"), "2026-09-29");
assert.equal(dmyToIso("1/1/2019"), "2019-01-01");
assert.equal(dmyToIso("2026-10-06"), null);
assert.equal(dmyToIso(""), null);
console.log("1. grammar: OK");

/* ----------------------------------------------------- 1b. Westpac grammar */
// every meta-description form the IQ desk has printed (2022→2026 dump)
const W = (desc, want) => {
  const got = parseWMDesc(desc);
  if (want === null) { assert.equal(got, null, JSON.stringify(desc) + " -> null"); return; }
  assert.ok(got, JSON.stringify(desc) + " should parse");
  assert.equal(got.v, want[0], "level for " + JSON.stringify(desc));
  assert.equal(got.chg, want[1], "change for " + JSON.stringify(desc));
  assert.equal(got.toMon, want[2], "toMon for " + JSON.stringify(desc));
};
W("Westpac consumer sentiment rose 2.2% to 100 in February from 97.8 in January.", [100, 2.2, 1]);
W("Consumer sentiment fell to 82.2 in June from 83.6 in May, a decline of 1.7%.", [82.2, -1.4, 5]);
// the trailing-period trap: [\d.]+ once ate the sentence-final dot and NaN'd the whole wave
W("Consumer sentiment lifted to 83.6 in June from 82.2.", [83.6, 1.4, 5]);
// month inherited from before the to-level
W("Consumer sentiment rose 5.1% in April, to 90.1 from 85.7 in March.", [90.1, 4.4, 3]);
// unchanged-at variant: level alone, no change (a rounding verdict)
W("Consumer sentiment was unchanged at 78.5 in March.", [78.5, null, 2]);
// percentage that contradicts the levels rejects the wave (levels rule)
W("Consumer sentiment rose 22% to 100 in February from 97.8 in January.", null);
// no figure, no wave (video-only pages carry a media blurb only)
W("A short video from Westpac's Chief Economist, Bill Evans.", null);
// out-of-band levels never file
W("Consumer sentiment fell to 13.6 in June from 82.2 in May.", null);

/* --------------------------------------------------------- 1c. NAB grammar */
// the measure sentence owns its figures; nothing outside the sentence counts
{
  const txt = "Business conditions fell to -4 index points. Profitability remains weak at -8 index points and trading held at +1 index points. Business confidence rose to +6 index points.";
  const cond = nabMeasure(txt, "conditions"), conf = nabMeasure(txt, "confidence");
  assert.equal(cond.level, -4, "conditions level stays in its own sentence");
  assert.equal(conf.level, 6, "confidence reads its own sentence only");
}
// the "held at" variant files a level
{
  const got = nabMeasure("Business conditions remained at +7 index points.", "conditions");
  assert.equal(got.level, 7, "remained-at level variant");
}
// a quote or paren may sit between the full stop and the next capital
{
  const txt = 'Business conditions eased again in May," said Dr Auld. "Capex picked up to +6 index points."';
  assert.equal(nabMeasure(txt, "conditions").level, null, "quote boundary stops the bleed");
}
// 2025-era: label + embargo + sentential levels, Table-1 rows agreeing
{
  const era1 = [
    "Embargoed until 11:30am AEST, 10 June 2025",
    "NAB Monthly Business Survey May-25",
    "Narrowing gap between conditions and confidence",
    "NAB Economics",
    "Summary",
    "Business conditions eased again in May to 0 index points. Business confidence rose 3pt to +2 index points in May.",
    "Table 1: Key Monthly Business Survey Statistics",
    "Mar-25 Apr-25 May-25",
    "Net balance",
    "Business confidence                        -2          -1            2",
    "Business conditions                         3           2            0",
  ].join("\n");
  const g = parseNabPdf(era1);
  assert.equal(g.date, "2025-06-10");
  assert.deepEqual(g.survey, { mon: 4, yr: 2025 });
  assert.equal(g.conf.level, 2); assert.equal(g.conf.chg, 3);
  assert.equal(g.cond.level, 0);
}
// 2026-era banner: levels from the banner pair; the interleaved caption text
// must NOT serve up the confidence sentence as conditions (Aug-26 shape)
{
  const era2 = [
    "August 2026",
    "NAB Monthly Business Survey",
    "   -8            Index",
    "                 points                              -1            Index",
    "                 points",
    "   Business Confidence                                Business Conditions",
    "   Fell 2pts (unrounded)                              Fell 5pts to be in negative territory",
    "   to -8 index points                                 for the first time in 6 years",
    "Summary",
    "Business confidence fell 2pts in August and remains well below its long-run average. Business conditions also declined this month, falling 5pts (unrounded) and turning negative for the first time in 6 years.",
  ].join("\n");
  const g = parseNabPdf(era2);
  assert.deepEqual(g.survey, { mon: 7, yr: 2026 });
  assert.equal(g.conf.level, -8, "banner confidence");
  assert.equal(g.cond.level, -1, "banner conditions (not the -8 from the confidence caption)");
  assert.equal(g.conf.chg, -2);
  assert.equal(g.cond.chg, -5);
}
// banner and sentence that disagree never average: the measure is dropped
{
  const bad = [
    "July 2026",
    "NAB Monthly Business Survey",
    "   +4            Index",
    "                 points                              -1            Index",
    "                 points",
    "   Business Confidence                               Business Conditions",
    "Summary",
    "Business confidence rose to +7 index points.",
  ].join("\n");
  const g = parseNabPdf(bad);
  assert.equal(g.conf.level, null, "banner/prose disagreement drops the measure");
  assert.equal(g.cond.level, -1, "conditions still takes the banner level (no conflicting sentence)");
}
// the footer's survey-conduct line rides the PLAIN witness: layout mode on
// a 2025-era two-column page interleaves the other column's words into the
// sentence, where neither footer grammar branch matches
{
  const scrambled = [
    "May 2025",
    "NAB Monthly Business Survey",
    "   Survey conducted from 22   Table 2 key results    30 April, covering around 350 businesses across the non-farm sector.",
  ].join("\n");
  const plain = "May 2025\nNAB Monthly Business Survey\nSurvey conducted from 22 to 30 April, covering around 350 businesses across the non-farm sector.";
  const g = parseNabPdf(scrambled, plain);
  assert.deepEqual(g.survey, { mon: 4, yr: 2025 });
  assert.equal(g.fw.n, 350, "footer n comes from the plain witness");
  assert.deepEqual(g.fw.win, { d1: 22, m1: 3, d2: 30, m2: 3 }, "footer window comes from the plain witness");
  assert.equal(parseNabPdf(scrambled).fw.n, null, "an interleaved footer in layout mode files nothing");
}
console.log("1b. westpac+NAB grammar: OK");

/* ------------------------------------------- 1c. enrichment window + lanes */
// the yearless printed window resolves its year off the release date
{
  const w = resolveWinYear({ d1: 28, m1: 8, d2: 4, m2: 9 }, "2026-10-06");
  assert.deepEqual(w, { fwStart: "2026-09-28", fwEnd: "2026-10-04" }, "28 Sep–4 Oct before a 6 Oct release");
  const x = resolveWinYear({ d1: 29, m1: 11, d2: 4, m2: 0 }, "2022-01-04");
  assert.deepEqual(x, { fwStart: "2021-12-29", fwEnd: "2022-01-04" }, "the Christmas window crosses the year");
  assert.equal(resolveWinYear({ d1: 1, m1: 1, d2: 7, m2: 1 }, "2026-10-06"), null, "a stale window files nothing");
}
// the consumer release PDF: n sentence + both printed "Last week" cell forms
{
  const t26 = [
    "ANZ-Roy Morgan Australian Consumer Confidence",
    "Last week           Weekly          Four-week",
    "28 Sep\u20124 Oct       change, pts     average",
    "Consumer confidence fell 3.4pts last week to 67.1pts after the RBA raised rates.",
    "The weekly ANZ-Roy Morgan Australian Consumer Confidence rating is based on 1,019 interviews conducted online and over the telephone during the week to Sunday.",
  ].join("\n");
  const g = parseRmConsumerPdf(t26);
  assert.equal(g.n, 1019);
  assert.deepEqual(g.win, { d1: 28, m1: 8, d2: 4, m2: 9 }, "the 2026 '28 Sep–4 Oct' cell");
  const t22 = [
    "Last week       Weekly      Four-week",
    " (17\u201323 Oct)    change, %      average",
    "Rating is based on 1,476 interviews conducted online and by telephone during the week to Sunday.",
  ].join("\n");
  const g2 = parseRmConsumerPdf(t22);
  assert.equal(g2.n, 1476, "looser 2022 phrasing still files the n");
  assert.deepEqual(g2.win, { d1: 17, m1: 9, d2: 23, m2: 9 }, "the 2022 '(17–23 Oct)' cell");
}
// the business post: dated source-line n beats the lagging block quote
{
  const post = [
    "Source: Roy Morgan Business Single Source, August 2025, n=1,189, August 2026, n=1,094.",
    "The latest Roy Morgan Business Confidence results for July are based on 1,094 detailed interviews with a cross-section of Australian businesses.",
  ].join(" ");
  assert.deepEqual(parseRmBusinessPost(post, { mon: 7, yr: 2026 }), { n: 1094 }, "the stale 'for July' month word never costs the n");
  const clash = post.replace("1,094 detailed interviews", "1,200 detailed interviews");
  assert.deepEqual(parseRmBusinessPost(clash, { mon: 7, yr: 2026 }), { n: null }, "a quote/line disagreement files nothing");
}
// the westpac bulletin print (a genuine 4-day window); the 2025-era
// bulletins wrap mid-phrase ("conducted in the\nweek from …")
{
  const g = parseWestpacPdf("This latest survey is based on 1200 adults aged 18 years and over, across Australia. It was conducted in the week from 28 September to 1 October.");
  assert.equal(g.n, 1200);
  assert.deepEqual(g.win, { d1: 28, m1: 8, d2: 1, m2: 9 });
  const w = parseWestpacPdf("This latest survey is based on 1200 adults aged 18 years and over, across Australia. It was conducted in the\nweek from 11 August to 15 August 2025.");
  assert.equal(w.n, 1200);
  assert.deepEqual(w.win, { d1: 11, m1: 7, d2: 15, m2: 7 }, "the wrapped 'in the week' still files");
}
// the NAB footer (an approximate n, filed as printed); the 2025-era PDFs
// print the range form — month once, optional trailing year
{
  const g = parseNabFw("Survey conducted from 24 August to 31 August, covering around 455 businesses across the non-farm sector.");
  assert.equal(g.n, 455);
  assert.deepEqual(g.win, { d1: 24, m1: 7, d2: 31, m2: 7 });
  const r = parseNabFw("Survey conducted from 22 to 30 April, covering around 350 businesses across the non-farm sector.");
  assert.equal(r.n, 350);
  assert.deepEqual(r.win, { d1: 22, m1: 3, d2: 30, m2: 3 }, "the month-once range form");
  const y = parseNabFw("Survey conducted from 22 to 30 April 2025, covering around 350 businesses.");
  assert.equal(y.n, 350);
  assert.deepEqual(y.win, r.win, "a printed year changes nothing");
  const c = parseNabFw("Survey conducted from 24 August to 31 August, covering around 1,094 businesses.");
  assert.equal(c.n, 1094, "a comma'd n parses");
}
// the business survey month: slug-titled wave, then the release-minus-one rule
assert.deepEqual(surveyMonthOf({ slug: "10336-roy-morgan-business-confidence-august-2026", date: "2026-09-08" }), { mon: 7, yr: 2026 });
assert.deepEqual(surveyMonthOf({ slug: "roy-morgan-business-confidence-plummeted-14-2pts", date: "2026-05-04" }), { mon: 3, yr: 2026 });
console.log("1c. enrichment grammar: OK");

/* ------------------------------------------------------- 2. full pipeline */
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native ? "/tmp/" : "/tmp/", "mood-test-"));
fs.mkdirSync(path.join(tmp, "data"));
const FEED = path.join(tmp, "feed-src");
const WP_DIR = path.join(tmp, "westpac-src");
const NAB_DIR = path.join(tmp, "nab-src");
fs.mkdirSync(FEED);
fs.mkdirSync(WP_DIR);
fs.mkdirSync(NAB_DIR);
const run = (dir, args = []) => {
  const env = { ...process.env };
  delete env.MOOD_LIB; // the import-stage lib seam must not leak into the child
  let out = "", status = 0;
  try { out = execFileSync("node", [MOOD, ...args, "--feed-dir", dir, "--westpac-dir", WP_DIR, "--nab-dir", NAB_DIR], { cwd: tmp, encoding: "utf8", env }); }
  catch (e) { status = e.status; out = (e.stdout || "") + (e.stderr || ""); }
  return { out, status };
};
const fix = (dir, url, suffix, text) => fs.writeFileSync(`${dir}/${safeName(url)}${suffix}`, text);
const mkItem = (id, slug, date, title, summary) => ({ id, slug, release_date: date.split("-").reverse().join("/"), title, summary });
fs.writeFileSync(path.join(FEED, "consumer-confidence-page-1.json"), JSON.stringify([
  mkItem(1, "10098-anz-roy-morgan-consumer-confidence-september-29", "2026-09-29", "ANZ-Roy Morgan Consumer Confidence up 1.2pts to 83.4 a week before cheap petrol ends", ""),
  // printed change -2.1 can't reconcile with the implied -0.7 off the 09-15 row -> dropped
  mkItem(2, "10097-anz-roy-morgan-consumer-confidence-september-22", "2026-09-22", "ANZ-Roy Morgan Consumer Confidence down 2.1pts to 82.2 as petrol prices hit a one-year high", ""),
  // title/summary disagreement: the summary is a stale copy, the title wins
  mkItem(3, "10096-anz-roy-morgan-consumer-confidence-september-15", "2026-09-15", "ANZ-Roy Morgan Consumer Confidence up 1.4pts to 82.9 – highest for five months as tax cuts arrive", "ANZ-Roy Morgan Consumer Confidence was up 0.4pts to 81.9 last week and is now up three straight weeks."),
  mkItem(4, "10095-anz-roy-morgan-consumer-confidence-statement-bushfires", "2026-09-08", "Roy Morgan statement on the bushfire emergency", "Roy Morgan offers its condolences."),
  // a wave too far in the past for the chain gate (>14d from the next row)
  mkItem(5, "10094-anz-roy-morgan-consumer-confidence-august-18", "2026-08-18", "ANZ-Roy Morgan Consumer Confidence up 0.1pts to 81.5 after the RBA cuts rates in August", ""),
  // excluded waves: NZ series is a different jurisdiction
  mkItem(6, "10093-anz-roy-morgan-nz-consumer-confidence-september-2026", "2026-09-30", "ANZ-Roy Morgan New Zealand Consumer Confidence virtually unchanged in September at 97.6", ""),
]));
// business: title wins over a stale summary copy (same trick as 2023-05-02);
// September's printed -2.5 can't reconcile with the implied -9.8 off July -> dropped
fs.writeFileSync(path.join(FEED, "business-confidence-page-1.json"), JSON.stringify([
  mkItem(11, "10336-roy-morgan-business-confidence-august-2026", "2026-09-08", "Roy Morgan Business Confidence down 2.5pts to 76.6 in August after the RBA cuts interest rates", "Roy Morgan Business Confidence was up 1.2pts to 79.1 in August as tax cuts arrive"),
  mkItem(12, "10300-roy-morgan-business-confidence-plummeted-14-2pts-to-a-new-record-low-of-only-76-5-in-april", "2026-05-04", "Roy Morgan Business Confidence plummeted 14.2pts to a new record low of only 76.5 in April as the conflict in the Middle East continued without resolution", ""),
  // 64d off the previous row: past the 45d gate, so the printed change stands unchecked
  mkItem(13, "10325-roy-morgan-business-confidence-june-2026", "2026-07-07", "Roy Morgan Business Confidence up 9.9pts to 86.4 in June as the Middle East ceasefire holds", ""),
  // inside the gate; the print matches the implied 86.4 -> 78.0 and is kept
  mkItem(14, "10330-roy-morgan-business-confidence-july-2026", "2026-08-05", "Roy Morgan Business Confidence down 8.4pts to 78.0 in July as Middle East tensions drag on", ""),
]));

/* ------------------------------ 2a2. RM enrichment fixtures: post pages
   keyed safeName(postUrl)+".page.html" and release-PDF texts keyed
   safeName(pdfUrl)+".pdf.txt" — the consumer sample sentence and its
   yearless Last-week window; the business state chart's dated source
   pairs. */
const rmUrl = (slug) => `https://www.roymorgan.com/findings/${slug}`;
// consumer: the 81.5 wave's window is "(17–23 October)" — a year-bracketed
// cell that resolves to no window within reach of an August release, so
// that row files its n but never a fieldwork window
const clPdf = (id) => `https://www.roymorgan.com/wp-content/uploads/2026/09/anz-rm-consumer-confidence-${id}.pdf`;
for (const [slug, v, n, win] of [
  ["10098-anz-roy-morgan-consumer-confidence-september-29", "83.4", "1,019", "(28 Sep – 4 Oct)"],
  ["10097-anz-roy-morgan-consumer-confidence-september-22", "82.2", "1,076", "(16–22 September)"],
  ["10096-anz-roy-morgan-consumer-confidence-september-15", "82.9", "1,054", "(30 Aug – 5 Sep)"],
  ["10094-anz-roy-morgan-consumer-confidence-august-18", "81.5", "1,476", "(17–23 October)"],
]) {
  const pdf = clPdf(slug.slice(0, 5));
  fix(FEED, rmUrl(slug), ".page.html", `<html><body><p>ANZ-Roy Morgan Australian Consumer Confidence</p><a href="${pdf}">Download the release (PDF)</a></body></html>`);
  fix(FEED, pdf, ".pdf.txt", [
    `ANZ-Roy Morgan Australian Consumer Confidence ${v}`,
    `The weekly ANZ-Roy Morgan Australian Consumer Confidence rating is based on ${n} interviews conducted online and over the telephone during the week to Sunday.`,
    `           This week        A week ago        Last week`,
    `Index         ${v.padStart(6)}              ${v}              ${win} ${v}`,
  ].join("\n"));
}
// business: the June wave's post is absent (no fixture), so its n stays
// null; the others file n from the dated Single Source pairs, with the
// trailing sentence as a figure-only cross-check (its month lags)
const nextData = (content) => `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { findingData: { postBy: { content } } } } })}</script></head><body/></html>`;
// 10336 mirrors the live page's THREE Source lines: the long-run trend
// line first (its "Dec 2010-Aug 2026" range matches no n= pair), the
// per-month dated pairs second, then the trailing-quarter line whose
// single "June – August 2026, n=3,300" pair is a 3-month sum that must
// not be misread as the survey month's n (expects >=2 pairs per line).
fix(FEED, rmUrl("10336-roy-morgan-business-confidence-august-2026"), ".page.html",
  nextData(`<p>Roy Morgan Business Confidence fell in August.</p><p>Source: Roy Morgan Business Single Source, Dec 2010-Aug 2026. Average monthly sample over the last 12 months = 1,159.</p><p>Source: Roy Morgan Business Single Source, July 2026, n=1,189, August 2026, n=1,094.</p><p>Source: Roy Morgan Business Single Source, June – August 2026, n=3,300.</p><blockquote><p>Roy Morgan Business Confidence results for July are based on 1,094 detailed interviews.</p></blockquote>`));
fix(FEED, rmUrl("10330-roy-morgan-business-confidence-july-2026"), ".page.html",
  nextData(`<p>Source: Roy Morgan Business Single Source, June 2026, n=1,150, July 2026, n=985.</p><blockquote><p>Roy Morgan Business Confidence results for July are based on 985 detailed interviews.</p></blockquote>`));
fix(FEED, rmUrl("10300-roy-morgan-business-confidence-plummeted-14-2pts-to-a-new-record-low-of-only-76-5-in-april"), ".page.html",
  nextData(`<p>Source: Roy Morgan Business Single Source, March 2026, n=1,087, April 2026, n=372.</p><blockquote><p>Roy Morgan Business Confidence results for April are based on 372 detailed interviews.</p></blockquote>`));

/* --------------------------------------------- 2b. westpac + NAB fixtures
   Same contract as --feed-dir: sitemap.xml in the dir, pages and PDF text
   keyed by safeName(url)+".html"/".txt". Westpac pages carry the meta
   description + the .time-detail display stamp; NAB articles carry the
   PDF link, PDFs carry the full pdftotext -layout output. */
const wpPage = (desc, stamp) => `<html><head><meta name="description" content="${desc}"/></head><body><div class="time-detail"><span>10:30 ${stamp}</span></div></body></html>`;
fs.writeFileSync(path.join(WP_DIR, "sitemap.xml"), `<?xml version="1.0"?>
<urlset>
<url><loc>https://www.westpaciq.com.au/economics/2026/09/consumer-sentiment-september-2026/</loc></url>
<url><loc>https://www.westpaciq.com.au/economics/2026/10/consumer-sentiment-october-2026/</loc></url>
<url><loc>https://www.westpaciq.com.au/economics/2026/11/consumer-sentiment-november-2026/</loc></url>
<url><loc>https://www.westpaciq.com.au/economics/2026/09/video-consumer-sentiment/</loc></url>
</urlset>`);
// enrichment: the September bulletin rides a library PDF on the page; the
// October wave carries no bulletin link, so its row stays bare
const WP_PDF = "https://library.westpaciq.com.au/content/dam/public/westpaciq/secure/ER20260909BullConsumerSentiment.pdf";
fix(WP_DIR, "https://www.westpaciq.com.au/economics/2026/09/consumer-sentiment-september-2026/", ".html",
  wpPage("Consumer sentiment rose 2.2% to 100.0 in September from 97.8 in August.", "September 09 2026").replace("</body>", `<a href="${WP_PDF}">Read the full report</a></body>`));
fix(WP_DIR, WP_PDF, ".txt", "Westpac Consumer Sentiment Bulletin September 2026 … This latest survey is based on 1200 adults aged 18 years and over, across Australia. It was conducted in the week from 1 September to 5 September.");
fix(WP_DIR, "https://www.westpaciq.com.au/economics/2026/10/consumer-sentiment-october-2026/", ".html",
  wpPage("Consumer sentiment fell 3.4% to 96.6 in October from 100.0 in September.", "October 06 2026"));
// a percentage that contradicts the levels: the wave never files
fix(WP_DIR, "https://www.westpaciq.com.au/economics/2026/11/consumer-sentiment-november-2026/", ".html",
  wpPage("Consumer sentiment rose 22% to 90.1 in November from 88.1 in October.", "November 10 2026"));
// NAB: a 2026-era banner wave, a 2025-era embargo+Table-1 wave, and a
// PDF/article disagreement that must DROP the wave. The video URL above
// and any waveless page are never fetched (video) or rejected (geometry).
const nabArt = (pdfPath, extra = "") => `<html><body>${extra}<a href="${pdfPath}">Download the PDF</a></body></html>`;
const NAB_A = "https://www.nab.com.au/news/economy-markets/monthly-business-survey-august-2026";
const NAB_S = "https://www.nab.com.au/news/economy-markets/monthly-business-survey-september-2026";
const NAB_O = "https://www.nab.com.au/news/economy-markets/monthly-business-survey-october-2026";
const PDF_A = "https://www.nab.com.au/content/dam/nab/documents/news/2026/august-monthly-business-survey.pdf";
const PDF_S = "https://www.nab.com.au/content/dam/nab/documents/news/2026/september-monthly-business-survey.pdf";
const PDF_O = "https://www.nab.com.au/content/dam/nab-email-composer/embargo/october-monthly-business-survey-sdlfkh.pdf";
fs.writeFileSync(path.join(NAB_DIR, "sitemap.xml"), `<?xml version="1.0"?>
<urlset>
<url><loc>${NAB_A}/</loc><lastmod>2026-08-11</lastmod></url>
<url><loc>${NAB_S}/</loc><lastmod>2026-09-09</lastmod></url>
<url><loc>${NAB_O}/</loc><lastmod>2026-10-06</lastmod></url>
</urlset>`);
fix(NAB_DIR, NAB_A, ".html", nabArt("/content/dam/nab/documents/news/2026/august-monthly-business-survey.pdf"));
fix(NAB_DIR, PDF_A, ".txt", [
  "August 2026",
  "NAB Monthly Business Survey",
  "   +6            Index",
  "                 points                              +2            Index",
  "                 points",
  "   Business Confidence                                Business Conditions",
  "Summary",
  "Business confidence rose 6pts to +6 index points. Business conditions improved 2pts to +2 index points.",
  "Survey conducted from 4 August to 8 August, covering around 462 businesses across the non-farm sector.",
].join("\n"));
fix(NAB_DIR, NAB_S, ".html", nabArt("/content/dam/nab/documents/news/2026/september-monthly-business-survey.pdf"));
// the 2025-era two-column layout: the footer sentence survives only in the
// plain witness — in layout mode the other column's words interleave into
// it, where no footer grammar branch matches (no figure may come of it)
fix(NAB_DIR, PDF_S, ".txt", [
  "Embargoed until 11:30am AEST, 9 September 2026",
  "NAB Monthly Business Survey Sep-26",
  "Summary",
  "Business confidence fell 2pts to +4 index points in September. Business conditions eased to 0 index points.",
  "Table 1: Key Monthly Business Survey Statistics",
  "Jul-26 Aug-26 Sep-26",
  "Net balance",
  "Business confidence                        6           6            4",
  "Business conditions                        2           2            0",
  "   Survey conducted from 1   Table 2 chart heading   8 September, covering around 350 businesses across the non-farm sector.",
].join("\n"));
fix(NAB_DIR, PDF_S, ".plain.txt", [
  "Embargoed until 11:30am AEST, 9 September 2026",
  "NAB Monthly Business Survey Sep-26",
  "Summary",
  "Business confidence fell 2pts to +4 index points in September. Business conditions eased to 0 index points.",
  "Survey conducted from 1 to 8 September, covering around 350 businesses across the non-farm sector.",
].join("\n"));
// PDF says confidence +4 (banner + Summary agree); the article prose says +9
// — the disagreement drops the whole wave (never pick a side).
fix(NAB_DIR, NAB_O, ".html", nabArt("/content/dam/nab-email-composer/embargo/october-monthly-business-survey-sdlfkh.pdf", "Business confidence lifted to +9 index points."));
fix(NAB_DIR, PDF_O, ".txt", [
  "October 2026",
  "NAB Monthly Business Survey",
  "   +4            Index",
  "                 points                              -3            Index",
  "                 points",
  "   Business Confidence                               Business Conditions",
  "Summary",
  "Business confidence fell 8pts to +4 index points.",
].join("\n"));

const first = run(FEED);
assert.equal(first.status, 0, first.out);
const m = first.out.match(/MOOD_STATUS (\{.*\})/);
assert.ok(m, "MOOD_STATUS line printed");
const st = JSON.parse(m[1]);
assert.equal(st.changed, true);
assert.equal(st.rows.consumer, 4, "four parseable consumer waves");
assert.equal(st.rows.business, 4, "four business waves");
assert.deepEqual(st.added.consumer, ["2026-08-18", "2026-09-15", "2026-09-22", "2026-09-29"]);
const doc = JSON.parse(fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8"));
const consRows = Object.fromEntries(doc.consumer.rows.map((r) => [r.date, r]));
assert.equal(consRows["2026-08-18"].v, 81.5);
assert.equal(consRows["2026-08-18"].chg, 0.1, "first row keeps its printed change (no chain yet)");
assert.equal(consRows["2026-09-15"].v, 82.9, "title wins the title/summary disagreement");
assert.equal(consRows["2026-09-15"].chg, 1.4, "title's printed change also wins");
assert.equal(consRows["2026-09-22"].v, 82.2);
assert.equal(consRows["2026-09-22"].chg, null, "printed -2.1 doesn't reconcile with implied 82.9->82.2 (-0.7): dropped");
assert.equal(consRows["2026-09-29"].v, 83.4);
assert.equal(consRows["2026-09-29"].chg, 1.2, "implied 82.2->83.4 matches the print: kept");
assert.ok(!consRows["2026-09-30"], "NZ wave never files");
assert.ok(!consRows["2026-09-08"], "a waveless statement never files");
const busRows = Object.fromEntries(doc.business.rows.map((r) => [r.date, r]));
assert.equal(busRows["2026-05-04"].v, 76.5, "P3b reversed superlative");
assert.equal(busRows["2026-05-04"].chg, -14.2);
assert.equal(busRows["2026-07-07"].v, 86.4);
assert.equal(busRows["2026-07-07"].chg, 9.9, "64d gap is past the 45d gate: printed change stands unchecked");
assert.equal(busRows["2026-08-05"].chg, -8.4, "print matches implied 86.4->78.0: kept");
assert.equal(busRows["2026-09-08"].v, 76.6, "title wins over the stale summary's 79.1");
assert.equal(busRows["2026-09-08"].chg, null, "printed -2.5 doesn't reconcile with implied 78.0->76.6 (-1.4): dropped");

// westpac + NAB lanes off the hermetic fixture trees
assert.equal(st.rows.westpacConsumer, 2, "two parseable westpac waves");
assert.equal(st.rows.nabBusiness, 2, "two verifiable NAB waves (the disagreement wave is dropped)");
assert.ok(first.out.includes("video-consumer-sentiment") === false, "video URL filtered before fetch");
assert.ok(/consumer-sentiment-november-2026\/.*skipped/s.test(first.out), "contradictory-percentage westpac wave skipped");
assert.ok(first.out.includes("confidence PDF 4 != article 9"), "NAB PDF/article disagreement logged");
assert.ok(first.out.includes("wave dropped"), "NAB disagreement wave dropped");
const wRows = Object.fromEntries(doc.westpacConsumer.rows.map((r) => [r.date, r]));
assert.equal(wRows["2026-09-09"].v, 100.0);
assert.equal(wRows["2026-09-09"].chg, 2.2);
assert.equal(wRows["2026-09-09"].url, "https://www.westpaciq.com.au/economics/2026/09/consumer-sentiment-september-2026/");
assert.equal(wRows["2026-10-06"].v, 96.6);
assert.equal(wRows["2026-10-06"].chg, -3.4);
assert.ok(!wRows["2026-11-10"], "contradictory % never files");
const nRows = Object.fromEntries(doc.nabBusiness.rows.map((r) => [r.date, r]));
assert.deepEqual(doc.nabBusiness.rows.map((r) => r.ym), ["2026-08", "2026-09"], "banner wave + embargo wave, in date order");
assert.equal(nRows["2026-08-11"].v, 6, "banner-era confidence (Summary, banner as second witness)");
assert.equal(nRows["2026-08-11"].cond, 2, "banner-era conditions is NOT the confidence caption");
assert.equal(nRows["2026-08-11"].chg, 6, "first row keeps its printed change (no chain yet)");
assert.equal(nRows["2026-09-09"].v, 4, "embargo-era confidence");
assert.equal(nRows["2026-09-09"].cond, 0, "embargo-era conditions agree with Table 1");
assert.equal(nRows["2026-09-09"].chg, -2, "29d gap: print matches the implied 6->4 chain");
assert.ok(!nRows["2026-10-06"], "PDF/article disagreement drops the wave");
assert.equal(doc.nabBusiness.base.includes("+100"), true, "shift disclosure rides the series base");
assert.equal(doc._about.includes("SHIFTED +100"), true, "shift disclosure in _about");

// per-release enrichment: sample + survey window from each lane's own print
assert.deepEqual(st.enrich.consumer, { n: 4, fw: 3 }, "every consumer wave files its n; the 81.5 wave's year-bracket window resolves nowhere near its release");
assert.deepEqual(st.enrich.business, { n: 3, fw: 4 }, "the 07-07 post names no dated n; every wave still knows its survey month");
assert.deepEqual(st.enrich.westpacConsumer, { n: 1, fw: 1 }, "October's bulletin isn't out yet");
assert.deepEqual(st.enrich.nabBusiness, { n: 2, fw: 2 }, "both PDFs carry the footer line");
assert.equal(consRows["2026-08-18"].n, 1476, "the 2010s short body parses too");
assert.ok(consRows["2026-08-18"].fwStart == null, "its year-(17–23 Oct) cell resolves no honest window near an August release");
assert.equal(consRows["2026-09-22"].n, 1076);
assert.deepEqual([consRows["2026-09-22"].fwStart, consRows["2026-09-22"].fwEnd], ["2026-09-16", "2026-09-22"]);
assert.equal(consRows["2026-09-15"].n, 1054);
assert.equal(consRows["2026-09-15"].fwStart, "2026-08-30", "a cross-month window ending ten days back still resolves");
assert.equal(consRows["2026-09-29"].n, 1019);
assert.deepEqual([consRows["2026-09-29"].fwStart, consRows["2026-09-29"].fwEnd], ["2026-09-28", "2026-10-04"]);
assert.equal(busRows["2026-05-04"].n, 372, "the short business body parses too");
assert.equal(busRows["2026-05-04"].fwm, "2026-04");
assert.equal(busRows["2026-07-07"].n, undefined, "the 07-07 post names no dated n");
assert.equal(busRows["2026-07-07"].fwm, "2026-06", "a monthless slug falls back to the month before release");
assert.equal(busRows["2026-08-05"].n, 985);
assert.equal(busRows["2026-08-05"].fwm, "2026-07");
assert.equal(busRows["2026-09-08"].n, 1094);
assert.equal(busRows["2026-09-08"].fwm, "2026-08");
assert.equal(wRows["2026-09-09"].n, 1200);
assert.deepEqual([wRows["2026-09-09"].fwStart, wRows["2026-09-09"].fwEnd], ["2026-09-01", "2026-09-05"]);
assert.equal(nRows["2026-08-11"].n, 462);
assert.deepEqual([nRows["2026-08-11"].fwStart, nRows["2026-08-11"].fwEnd], ["2026-08-04", "2026-08-08"]);
assert.equal(nRows["2026-09-09"].n, 350, "the September wave's n rides the plain witness (layout interleaved it)");
assert.deepEqual([nRows["2026-09-09"].fwStart, nRows["2026-09-09"].fwEnd], ["2026-09-01", "2026-09-08"], "its window too");

// idempotent: rerun, no write, changed:false
const before = fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8");
const again = run(FEED);
assert.equal(again.status, 0, again.out);
assert.ok(again.out.includes('"changed":false'), "second run unchanged: " + again.out.split("\n").pop());
assert.equal(fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8"), before, "file bytes identical");

// cohort backfill: strip the advisory fields off the on-file rows, then
// `--enrich-all <ISO>` must re-read only rows released on/after the date —
// everything older keeps its now-empty advisory fields. Fresh discovery
// always parses a new wave straight out of its own print, so the bound
// gates the RETRO-fitting pass on rows already on file.
const stripRow = (r, drop) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)));
const ADVISORY = ["n", "fwStart", "fwEnd"];
const seeded = JSON.parse(before);
seeded.consumer.rows = seeded.consumer.rows.map((r) => stripRow(r, ADVISORY));
seeded.business.rows = seeded.business.rows.map((r) => stripRow(r, [...ADVISORY, "fwm"])); // re-derives off the slug, no fetch
seeded.westpacConsumer.rows = seeded.westpacConsumer.rows.map((r) => stripRow(r, ADVISORY));
seeded.nabBusiness.rows = seeded.nabBusiness.rows.map((r) => stripRow(r, ADVISORY));
fs.writeFileSync(path.join(tmp, "data", "mood.json"), JSON.stringify(seeded, null, 1) + "\n");
const cohort = run(FEED, ["--enrich-all", "2026-09-20"]);
assert.equal(cohort.status, 0, cohort.out);
const cst = JSON.parse(cohort.out.match(/MOOD_STATUS (\{.*\})/)[1]);
assert.deepEqual(cst.rows, { consumer: 4, business: 4, westpacConsumer: 2, nabBusiness: 2 }, "a bound never costs a wave row");
assert.deepEqual(cst.enrich.consumer, { n: 2, fw: 2 }, "bound 09-20 re-reads the 09-22 and 09-29 waves only");
assert.deepEqual(cst.enrich.business, { n: 0, fw: 4 }, "every business wave is pre-bound: no n fetched, but fwm still derives off the slug");
assert.deepEqual(cst.enrich.westpacConsumer, { n: 0, fw: 0 }, "September's bulletin is pre-bound; October's has none");
assert.deepEqual(cst.enrich.nabBusiness, { n: 0, fw: 0 }, "both NAB waves pre-date the bound");
const cdoc = JSON.parse(fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8"));
const cRows = Object.fromEntries(cdoc.consumer.rows.map((r) => [r.date, r]));
assert.equal(cRows["2026-09-29"].n, 1019, "the newest wave is inside the cohort");
assert.deepEqual([cRows["2026-09-22"].fwStart, cRows["2026-09-22"].fwEnd], ["2026-09-16", "2026-09-22"], "the 09-22 wave is inside the cohort");
assert.equal(cRows["2026-09-15"].n, undefined, "the 09-15 wave sits before the bound: unenriched");
assert.equal(cRows["2026-09-15"].fwStart, undefined, "its window is unenriched too");
assert.equal(cRows["2026-08-18"].n, undefined, "pre-bound rows never fetch inside a cohort run");
const cBus = Object.fromEntries(cdoc.business.rows.map((r) => [r.date, r]));
assert.equal(cBus["2026-09-08"].n, undefined, "pre-bound business wave skips the post fetch");
assert.equal(cBus["2026-09-08"].fwm, "2026-08", "but its survey month still derives from the slug with no fetch");
// restore the full-enrichment file for the sections that follow
run(FEED);

// GUARD: a topic returning no candidates trips exit 2
const emptyDir = path.join(tmp, "empty-src");
fs.mkdirSync(emptyDir);
fs.writeFileSync(path.join(emptyDir, "consumer-confidence-page-1.json"), JSON.stringify([mkItem(1, "x-roy-morgan-weekly-update", "2026-10-01", "Roy Morgan Weekly Update", "")]));
fs.writeFileSync(path.join(emptyDir, "business-confidence-page-1.json"), JSON.stringify([]));
const guard = run(emptyDir);
assert.equal(guard.status, 2, "empty first page trips the guard");
console.log("2. pipeline: OK");

/* ------------------------------------------- 3. live data/mood.json pins */
const live = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mood.json"), "utf8"));
for (const [k, band] of [["consumer", SERIES.consumer.band], ["business", SERIES.business.band]]) {
  const rows = live[k].rows;
  assert.ok(rows.length >= (k === "consumer" ? 300 : 80), k + " has hundreds of waves");
  for (const r of rows) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.date), "iso date " + r.date);
    assert.ok(r.v >= band[0] - 5 && r.v <= band[1] + 5, `${k} ${r.date} in band: ${r.v}`);
    assert.ok(r.url.startsWith("https://www.roymorgan.com/findings/"));
  }
  const dates = rows.map((r) => r.date);
  assert.deepEqual([...dates].sort(), dates, k + " sorted");
  const seen = new Set(dates);
  assert.equal(seen.size, dates.length, k + " has no duplicate dates");
}
assert.equal(live.consumer.rows.at(-1).v, 67.1);
assert.equal(live.business.rows.at(-1).v, 79.1);
assert.equal(live.consumer.base, "ANZ-Roy Morgan, index, 100 = neutral");
// westpacConsumer + nabBusiness — own band and URL rules (the roymorgan.com
// rule above deliberately does NOT reach these lanes)
for (const r of live.westpacConsumer.rows) {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.date), "iso date " + r.date);
  assert.ok(r.v >= 40 && r.v <= 125, `westpacConsumer ${r.date} in WM_BAND: ${r.v}`);
  assert.ok(r.chg == null || Math.abs(r.chg) <= 20, `westpacConsumer ${r.date} sane change: ${r.chg}`);
  assert.ok(/^https:\/\/www\.westpaciq\.com\.au\/economics\//.test(r.url), "westpac URL host " + r.url);
}
assert.ok(live.westpacConsumer.rows.length >= 50, "westpacConsumer backfill depth (Jan 2022 -> )");
for (const r of live.nabBusiness.rows) {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.date), "iso date " + r.date);
  assert.ok(r.v >= -80 && r.v <= 80, `nabBusiness ${r.date} in NAB_BAND: ${r.v}`);
  assert.ok(typeof r.cond === "number" && r.cond >= -80 && r.cond <= 80, `nabBusiness ${r.date} cond in band: ${r.cond}`);
  assert.ok(/^\d{4}-\d{2}$/.test(r.ym), `nabBusiness ${r.date} ym ${r.ym}`);
  assert.ok(r.ym <= r.date.slice(0, 7), `nabBusiness ${r.date} fieldwork ${r.ym} never after release`);
  assert.ok(/^https:\/\/www\.nab\.com\.au\/news\/economy-markets\//.test(r.url), "nab URL host " + r.url);
}
assert.ok(live.nabBusiness.rows.length >= 14, "nabBusiness backfill depth (Apr 2025 -> )");
assert.ok(live.nabBusiness.base.includes("plotted +100"), "shift disclosure on the series base");
// per-release enrichment pins (advisory fields; coverage grows as releases land)
for (const k of ["consumer", "business", "westpacConsumer", "nabBusiness"]) {
  for (const r of live[k].rows) {
    if (r.n != null) assert.ok(Number.isInteger(r.n) && r.n >= 100 && r.n <= 6000, `${k} ${r.date} sane n: ${r.n}`);
    if (r.fwStart != null) {
      assert.ok(r.fwStart <= r.fwEnd && r.fwEnd <= r.date, `${k} ${r.date} window ends at/before release`);
      assert.ok((Date.parse(r.date) - Date.parse(r.fwEnd)) / 864e5 <= 40, `${k} ${r.date} window within reach of release`);
    }
    if (r.fwm != null) {
      assert.ok(/^\d{4}-\d{2}$/.test(r.fwm), `${k} ${r.date} fwm ${r.fwm}`);
      assert.ok(r.fwm <= r.date.slice(0, 7), `${k} ${r.date} survey month never after release`);
    }
  }
  if (k === "business") {
    const MON = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
    for (const r of live[k].rows) {
      const sm = /business-confidence-(\w+)-(\d{4})/.exec(r.slug || "");
      if (sm && MON[sm[1].toLowerCase()]) assert.equal(r.fwm, `${sm[2]}-${MON[sm[1].toLowerCase()]}`, `${r.date} fwm matches its slug month`);
    }
  }
}
// term-coverage pin: every confidence-facet row (since the 2025-05-03 election)
// carries its provenance — n + fieldwork where the house prints them. Release
// dates are RELEASE dates: a new release files without its figures until its
// own steady-state enrichment run (≤40d gate) passes, so rows younger than the
// enrich horizon are exempt here — the facet's em-dash for them is transient,
// and the steady-state "no candidates older than horizon remain" pin above is
// what chases them. Older than the horizon every row must carry its figures;
// the three business dates below are genuinely bare releases (no dated n in
// print), so the facet honestly shows an em-dash for them and only them.
const TERM = "2025-05-03";
const ENRICH_HORIZON = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
const inTerm = (r) => r.date >= TERM && r.date < ENRICH_HORIZON;
const BARE_BUSINESS_N = new Set(["2025-08-04", "2025-11-11", "2026-07-07"]);
for (const r of live.consumer.rows) if (inTerm(r)) {
  assert.ok(r.n != null, `consumer ${r.date} term row has n`);
  assert.ok(r.fwStart != null, `consumer ${r.date} term row has fieldwork`);
}
for (const r of live.westpacConsumer.rows) if (inTerm(r)) {
  assert.ok(r.n != null, `westpacConsumer ${r.date} term row has n`);
  assert.ok(r.fwStart != null, `westpacConsumer ${r.date} term row has fieldwork`);
}
for (const r of live.nabBusiness.rows) if (inTerm(r)) {
  assert.ok(r.n != null, `nabBusiness ${r.date} term row has n`);
  assert.ok(r.fwStart != null, `nabBusiness ${r.date} term row has fieldwork`);
}
for (const r of live.business.rows) if (inTerm(r)) {
  assert.ok(r.fwm != null, `business ${r.date} term row has survey month`);
  assert.ok(r.n != null || BARE_BUSINESS_N.has(r.date), `business ${r.date} term row has n (or is a known bare release)`);
}
for (const k of ["westpacConsumer", "nabBusiness"]) {
  const dates = live[k].rows.map((r) => r.date);
  assert.deepEqual([...dates].sort(), dates, k + " sorted");
  assert.equal(new Set(dates).size, dates.length, k + " has no duplicate dates");
}
console.log("3. live data: OK");
console.log("test-mood: all pass");
