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
const { parseText, SERIES, dmyToIso } = await import("./mood.mjs");

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

/* ------------------------------------------------------- 2. full pipeline */
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native ? "/tmp/" : "/tmp/", "mood-test-"));
fs.mkdirSync(path.join(tmp, "data"));
const FEED = path.join(tmp, "feed-src");
fs.mkdirSync(FEED);
const run = (dir, args = []) => {
  const env = { ...process.env };
  delete env.MOOD_LIB; // the import-stage lib seam must not leak into the child
  let out = "", status = 0;
  try { out = execFileSync("node", [MOOD, ...args, "--feed-dir", dir], { cwd: tmp, encoding: "utf8", env }); }
  catch (e) { status = e.status; out = (e.stdout || "") + (e.stderr || ""); }
  return { out, status };
};
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

// idempotent: rerun, no write, changed:false
const before = fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8");
const again = run(FEED);
assert.equal(again.status, 0, again.out);
assert.ok(again.out.includes('"changed":false'), "second run unchanged: " + again.out.split("\n").pop());
assert.equal(fs.readFileSync(path.join(tmp, "data", "mood.json"), "utf8"), before, "file bytes identical");

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
console.log("3. live data: OK");
console.log("test-mood: all pass");
