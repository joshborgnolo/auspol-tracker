/* Tests for .build/extract-newspoll-quarterly.mjs – the "Newspoll (pooled)"
   quarterly-aggregate agent. Oracles: the committed fixtures in
   .build/newspoll-quarterly-src/ (Q3-2026 Infogram embed + Q1-2026 and
   Nov-2025 tables-PDF text) and the committed waves in
   data/demographics.json; a fixture parse must reproduce its committed wave
   figure for figure. Integration: run() in a tmp sandbox with fixture-backed
   fetches – a stale in-flight discovery item (Poll Bludger thread linking
   the old 2025/12 PDF) must dedupe, never trip the two-party guard
   (regression: the year-less footer was anchored to the run year, so the
   dedupe date never matched). Runs the sandboxed validate.mjs on the run
   output, twice (plain row + samplePending variant). No network.
   Run: node .build/test-newspoll-quarterly.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  POOLSTER, NPQ, proseDate, proseWindow, proseSample, tidyGroup,
  quarterlyChartsOf, parseQuarterlyEmbed, parseTablesPdf, guardWave,
  probeNames, run,
} from "./extract-newspoll-quarterly.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, ".build", "newspoll-quarterly-src");
const IG_HTML = fs.readFileSync(path.join(SRC, "ig-8Tko917VckLB6BkkGNwe-2026-09-18.html"), "utf8");
const Q1_TXT = fs.readFileSync(path.join(SRC, "tables-2026-03-26.txt"), "utf8");
const Q4_TXT = fs.readFileSync(path.join(SRC, "tables-2025-11-20.txt"), "utf8");
const DEMO = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "demographics.json"), "utf8"));
const waveOnFile = (date) => DEMO.waves.find((w) => w.pollster === POOLSTER && w.date === date);
const Q1_PDF = "https://origin.theaustralian.com.au/wp-content/uploads/2026/04/newspoll5april2026.pdf";
const Q4_PDF = "https://origin.theaustralian.com.au/wp-content/uploads/2025/12/Newspoll.pdf";
const Q1_ART = "https://www.theaustralian.com.au/fake/q1-quarterly";
const Q3_ART = "https://www.theaustralian.com.au/fake/q3-quarterly";
const PB_THREAD = "https://pollbludger.net/2026/07/06/fake-miscellany-thread/";

// ---- 1. prose parsers -------------------------------------------------------
assert.deepEqual(proseWindow(Q4_TXT, "2025-12-28"), { start: "2025-09-29", end: "2025-11-20" },
  "the year-less footer anchors to the PDF upload month (an empty anchor would mis-year it 2026)");
assert.deepEqual(proseWindow(Q1_TXT, "2026-04-05"), { start: "2026-01-12", end: "2026-03-26" });
assert.deepEqual(proseWindow("conducted between 2 December and 6 January with 4001 voters", "2027-02-01"),
  { start: "2026-12-02", end: "2027-01-06" }, "a window spanning new year");
assert.equal(proseDate("interviewed November 20 and again", "2025-12-01"), "2025-11-20");
assert.equal(proseSample(Q4_TXT), 3774);
assert.equal(proseSample(Q1_TXT), 4927);
assert.equal(proseSample("a sample of 5,123 voters"), 5123);
assert.equal(proseSample("respondents (n = 4,001) were"), 4001);
assert.equal(proseSample("online, with 811 voters polled"), null, "a three-digit n is not a quarterly sample");
console.log("1. prose parsers: OK");

// ---- 2. label maps ----------------------------------------------------------
assert.equal(tidyGroup("TAFE / College"), "TAFE");
assert.equal(tidyGroup("TAFE/ Technical"), "TAFE");
assert.equal(tidyGroup("<$50k"), "Under $50k");
assert.equal(tidyGroup("Other / Not working"), "Other");
assert.equal(tidyGroup("Owned Outright"), "Own outright");
assert.equal(tidyGroup("Speak other language"), "Other language");
assert.equal(tidyGroup("$50k - $99k"), "$50–99k");
assert.equal(tidyGroup("QLD"), "Qld");
assert.equal(tidyGroup("35-49"), "35–49", "hyphens straighten to en-dashes");
console.log("2. label maps: OK");

// ---- 3. Infogram embed parse == committed Q3-2026 wave ----------------------
const q3 = parseQuarterlyEmbed(IG_HTML);
assert.ok(q3, "the Q3 embed parses for its fixture");
assert.deepEqual(q3.total, waveOnFile("2026-09-18").total, "Q3 totals match the committed wave");
assert.deepEqual(q3.dims, waveOnFile("2026-09-18").dims, "every Q3 group figure matches the committed wave");
assert.equal(q3.total.onp, 30, "spot oracle: Q3 national One Nation 30");
assert.equal(q3.dims.state.Qld.onp, 36, "spot oracle: Queensland One Nation 36");
assert.equal(q3.dims.state.SA.alp, 32, "spot oracle: South Australia Labor 32");
assert.equal(q3.dims.income["Under $50k"].onp, 33, "spot oracle: <$50k One Nation 33");
assert.equal(q3.dims.housing.Renting.onp, 30, "spot oracle: renting One Nation 30");
assert.equal(q3.dims.working["Other"].grn, 24, "spot oracle: other/non-working Greens 24");
assert.equal(parseQuarterlyEmbed("<html>no entities here</html>"), null, "an unrelated page parses to null");
console.log("3. Infogram parse == committed Q3 wave: OK");

// ---- 4. tables-PDF parse == committed Q1-2026 / Nov-2025 waves --------------
const q1 = parseTablesPdf(Q1_TXT);
assert.ok(q1, "the Q1 tables text parses");
assert.ok(!Object.keys(q1.dims).includes("housing"), "Q1 printed no housing sheet (it debuts 2026-06)");
assert.deepEqual(q1.total, waveOnFile("2026-03-26").total);
assert.deepEqual(q1.dims, waveOnFile("2026-03-26").dims, "every Q1 group figure matches the committed wave");
assert.equal(q1.dims.state.Qld.onp, 30, "spot oracle: Q1 Queensland One Nation 30");
assert.equal(q1.dims.income["Under $50k"].onp, 29, "spot oracle: Q1 <$50k One Nation 29");
assert.equal(q1.dims.religion["No religion"].alp, 34, "spot oracle: Q1 no-religion Labor 34");
const q4 = parseTablesPdf(Q4_TXT);
assert.ok(q4, "the 2PP-carrying Nov-2025 tables text still parses its PRIMARY VOTE block");
assert.deepEqual(q4.total, waveOnFile("2025-11-20").total);
assert.deepEqual(q4.dims, waveOnFile("2025-11-20").dims, "every Nov-2025 group figure matches the corrected committed wave");
assert.equal(q4.dims.income["$50–99k"].lnp, 25, "corrected oracle: $50–99k Coalition 25 (not 26)");
assert.equal(q4.dims.income["$100–149k"].alp, 38, "corrected oracle: $100–149k Labor 38 (not 35)");
assert.equal(q4.dims.income["$150k+"].oth, 12, "corrected oracle: $150k+ Others 12 (not 13)");
assert.equal(q4.dims.working["Part time"].grn, 20, "corrected oracle: part-time Greens 20 (not 11)");
assert.equal(q4.dims.working["Part time"].onp, 12, "corrected oracle: part-time One Nation 12 (not 17)");
assert.equal(parseTablesPdf("nothing at all"), null, "no PRIMARY VOTE block → null");
assert.equal(parseTablesPdf(Q1_TXT.replace(/^Labor\s+(\d+)\s+((?:\d+\s+){25}\d+)/m, "Labor            $1 36")), null,
  "a row whose 27 values stop matching the positional shape (26 columns) → null, never a truncated read");
const sixEduCheck = parseTablesPdf(Q1_TXT.replace("$100k -", "$100k–"));
assert.ok(sixEduCheck === null || typeof sixEduCheck === "object", "header punctuation variance must parse or null, never crash");
console.log("4. tables-PDF parse == committed waves: OK");

// ---- 5. the wave guard ------------------------------------------------------
const q3Wave = { date: "2026-09-18", dateStart: "2026-07-13", published: "2026-09-19T10:05", sample: 4967, total: q3.total, dims: q3.dims };
assert.equal(guardWave(q3Wave), null, "the real Q3 shape passes");
assert.ok(/primaries sum/.test(guardWave({ ...q3Wave, total: { ...q3.total, alp: q3.total.alp + 5 } })));
assert.ok(/field span/.test(guardWave({ ...q3Wave, dateStart: "2026-09-01" })), "a 17-day field window is not a quarter");
assert.ok(/field span/.test(guardWave({ ...q3Wave, dateStart: "2026-01-01" })), "a 260-day window is not a quarter");
assert.ok(/sample/.test(guardWave({ ...q3Wave, sample: 2100 })), `sample below ${NPQ.SAMPLE_MIN} is refused`);
assert.ok(/sample/.test(guardWave({ ...q3Wave, sample: 9000 })), `sample above ${NPQ.SAMPLE_MAX} is refused`);
assert.ok(/release lag/.test(guardWave({ ...q3Wave, published: "2026-11-19T10:05" })), "a 60-day release lag is refused");
assert.equal(guardWave({ ...q3Wave, published: null }), null, "no published clock is tolerated (row carries no published field)");
assert.equal(guardWave({ ...q3Wave, sample: null }), null, "no n is tolerated (row carries samplePending)");
const noState = { ...q3Wave, dims: Object.fromEntries(Object.entries(q3.dims).filter(([d]) => d !== "state")) };
assert.equal(guardWave(noState), "no state sheet");
const badGroup = { ...q3Wave, dims: { ...q3.dims, state: { ...q3.dims.state, NSW: { alp: 0, lnp: 20, grn: 10, onp: 20, oth: 10 } } } };
assert.ok(/state NSW sums 60/.test(guardWave(badGroup)), "a mis-columned group fails the 95–105 share gate");
console.log("5. guardWave accept/refuse ladder: OK");

// ---- 6. quarterly-chart shape id --------------------------------------------
{
  const single = quarterlyChartsOf({ chartData: { sheetnames: ["A"], data: [[[]]] } });
  assert.equal(single.length, 0, "a one-sheet chart is not the quarterly table");
  const shuffled = JSON.parse(JSON.stringify(q3.dims));
  assert.equal(Object.keys(shuffled).filter((k) => k === "state").length, 1);
  const wrongName = { chartData: { sheetnames: ["State", "Sex", "Age", "Education", "Mystery"], data: [[[[["x"]]]], [], [], [], []] } };
  assert.equal(quarterlyChartsOf(wrongName).length, 0, "an unknown sheet name disqualifies the chart");
}
assert.equal(probeNames("2025-12-01").some((u) => u.includes("/2025/12/")), true,
  "blind probes stay inside the PUBLISHED month, never the fieldwork month");
console.log("6. shape id + probe months: OK");

// ---- 7. polls.json round-trip stability -------------------------------------
{
  const real = fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8");
  assert.equal(JSON.stringify(JSON.parse(real), null, 2) + "\n", real,
    "data/polls.json survives parse→stringify(2) byte-identical, so whole-file reserialise writes stay diff-quiet");
}
console.log("7. polls.json round-trip: OK");

// ---- sandbox helper ----------------------------------------------------------
// run() against a tmp tree: real polls.json minus the 2026 pooled rows (they
// re-file from fixtures), the real demographics.json (read-only recon 2),
// and sandboxed validate.mjs + its imports for the gate checks.
function sandbox({ q1Text = Q1_TXT, undatedQ1 = false, dropRows = ["2026-03-26", "2026-06-26", "2026-09-18"] } = {}) {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), "npq-test-"));
  fs.mkdirSync(path.join(sb, "data"), { recursive: true });
  fs.mkdirSync(path.join(sb, ".build", "newtracker"), { recursive: true });
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  D.polls = D.polls.filter((p) => !(p.pollster === POOLSTER && dropRows.includes(p.date)));
  fs.writeFileSync(path.join(sb, "data", "polls.json"), JSON.stringify(D, null, 2) + "\n");
  fs.copyFileSync(path.join(ROOT, "data", "demographics.json"), path.join(sb, "data", "demographics.json"));
  for (const f of ["validate.mjs", "flows.mjs", "house-renames.mjs"])
    fs.copyFileSync(path.join(ROOT, ".build", "newtracker", f), path.join(sb, ".build", "newtracker", f));
  const texts = { [Q1_PDF]: q1Text, [Q4_PDF]: Q4_TXT };
  const bodies = {
    [Q1_ART]: `<html>{"datePublished": "2026-04-05T09:00:00.000Z"} Newspoll quarterly tables
      <a href="${Q1_PDF}">full tables</a></html>`,
    [Q3_ART]: `<html>{"datePublished": "2026-09-19T00:05:00.000Z"} The Newspoll quarterly aggregate
      of polls conducted between 13 July and 18 September with 4,967 voters across Australia.
      <div class="infogram-embed" data-id="8Tko917VckLB6BkkGNwe"></div></html>`,
    [PB_THREAD]: `<html>An open thread on the quarterly Newspoll breakdowns,
      <a href="${Q4_PDF}">last quarter's tables</a> still worth a look.</html>`,
  };
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title>Newspoll quarterly tables January to March</title><link>${Q1_ART}</link>${undatedQ1 ? "" : "<pubDate>Sun, 05 Apr 2026 09:00:00 GMT</pubDate>"}</item>
    <item><title>Newspoll quarterly aggregate July to September</title><link>${Q3_ART}</link><pubDate>Sat, 19 Sep 2026 00:05:00 GMT</pubDate></item>
    <item><title>Not a quarterly story</title><link>https://news.com.au/fake/other</link><pubDate>Sat, 19 Sep 2026 00:05:00 GMT</pubDate></item>
    </channel></rss>`;
  const ctx = {
    pollsPath: path.join(sb, "data", "polls.json"),
    outPath: path.join(sb, "data", "newspoll-quarterly.json"),
    demographicsPath: path.join(sb, "data", "demographics.json"),
    writeFiles: true,
    nowIso: "2026-10-09T00:00:00.000Z",
    chrome: () => null,
    headOk: async () => false,
    pdfText: (buf) => {
      const url = buf.toString().slice(5);
      if (!(url in texts)) throw new Error(`unexpected pdf fetch ${url}`);
      return texts[url];
    },
    fetchBuffer: async (url) => Buffer.from("PDF::" + url),
    fetchText: async (url) => {
      if (url.includes("bing.com")) return rss;
      if (url.includes("pollbludger.net/wp-json")) return JSON.stringify([{ title: "Monday miscellany: quarterly breakdowns", url: PB_THREAD }]);
      if (url.includes("e.infogram.com/8Tko917VckLB6BkkGNwe")) return IG_HTML;
      for (const [u, b] of Object.entries(bodies)) if (url === u) return b;
      throw new Error(`unexpected fetch ${url}`);
    },
  };
  const validate = () => {
    try {
      execFileSync(process.execPath, [path.join(sb, ".build", "newtracker", "validate.mjs")], { stdio: "pipe" });
      return true;
    } catch (e) { return e.stdout; }
  };
  return { sb, ctx, validate,
    polls: () => JSON.parse(fs.readFileSync(path.join(sb, "data", "polls.json"), "utf8")).polls,
    store: () => JSON.parse(fs.readFileSync(path.join(sb, "data", "newspoll-quarterly.json"), "utf8")) };
}

// ---- 8. integration: file Q1 + Q3, dedupe the stale thread ------------------
{
  const { sb, ctx, validate, polls, store } = sandbox();
  const r1 = await run(ctx);
  assert.equal(r1.exit, 0);
  assert.equal(r1.changed, true);
  assert.deepEqual([...r1.filed].sort(), ["Newspoll (pooled)|2026-03-26", "Newspoll (pooled)|2026-09-18"],
    "both quarters file from the rung-1 PDF and rung-2 embed");
  assert.deepEqual(r1.skippedExisting, ["Newspoll (pooled)|2025-11-20"],
    "the stale thread's old PDF dedupes on its own date – the two-party guard never wakes (regression)");
  assert.deepEqual(r1.guarded, []);
  const rows = polls().filter((p) => p.pollster === POOLSTER);
  assert.equal(rows.length, 4, "the two dropped waves refile (2025-09-11 and 2025-11-20 were kept)");
  const dates = polls().map((p) => p.date);
  assert.deepEqual(dates, [...dates].sort(), "the insert keeps polls.json date-sorted");
  const w1 = rows.find((p) => p.date === "2026-03-26");
  assert.deepEqual({ ...w1, url: "<url>", tablesUrl: "<tables>" }, {
    date: "2026-03-26", published: "2026-04-05T19:00", dateStart: "2026-01-12",
    pollster: "Newspoll (pooled)", client: "The Australian", sample: 4927,
    alp: 32, lnp: 20, grn: 12, onp: 25, ind: 11, oth: null,
    tpp_alp: null, tpp_lnp: null, url: "<url>", tablesUrl: "<tables>",
  }, "the PDF-filed Q1 row carries n from the PDF footer and figures from the Q1 table");
  const w3 = rows.find((p) => p.date === "2026-09-18");
  assert.deepEqual({ ...w3, url: "<url>" }, {
    date: "2026-09-18", published: "2026-09-19T10:05", dateStart: "2026-07-13",
    pollster: "Newspoll (pooled)", client: "The Australian", sample: 4967,
    alp: 29, lnp: 19, grn: 13, onp: 30, ind: 9, oth: null,
    tpp_alp: null, tpp_lnp: null, url: "<url>",
  }, "the embed-filed Q3 row carries n and window from the article prose");
  assert.equal(w1.tablesUrl, Q1_PDF);
  assert.ok(!("tablesUrl" in w3));
  assert.ok(w1.ind === w1.ind && w3.ind === 9, "the Others column lands in ind");
  const st = store();
  assert.equal(st.waves.length, 2);
  assert.equal(st.waves[0].date, "2026-03-26");
  assert.equal(st.waves[0].kind, "pdf");
  assert.equal(st.waves[1].date, "2026-09-18");
  assert.equal(st.waves[1].kind, "infogram");
  assert.deepEqual(st.waves[0].dims, waveOnFile("2026-03-26").dims, "store dims == committed Q1 wave");
  assert.deepEqual(st.waves[1].dims, waveOnFile("2026-09-18").dims, "store dims == committed Q3 wave");
  assert.equal(validate(), true, "the sandboxed validator accepts the two plain rows");
  // run #2: nothing new – recon re-parses the two stored waves from source,
  // every discovery item dedupes, and no file is touched.
  const storeBytes = fs.readFileSync(path.join(sb, "data", "newspoll-quarterly.json"), "utf8");
  const pollsBytes = fs.readFileSync(path.join(sb, "data", "polls.json"), "utf8");
  const r2 = await run(ctx);
  assert.equal(r2.exit, 0);
  assert.equal(r2.changed, false, "recon re-parsing the filed waves converges (nothing drifts)");
  assert.deepEqual([...r2.skippedExisting].sort(),
    ["Newspoll (pooled)|2025-11-20", "Newspoll (pooled)|2026-09-18"],
    "undated items re-dedupe every run; a dated item older than the latest pooled wave never reaches the fetch (recon 1 keeps recorded waves honest)");
  assert.deepEqual(r2.guarded, []);
  assert.equal(fs.readFileSync(path.join(sb, "data", "newspoll-quarterly.json"), "utf8"), storeBytes, "a quiet run rewrites nothing");
  assert.equal(fs.readFileSync(path.join(sb, "data", "polls.json"), "utf8"), pollsBytes, "a quiet run rewrites nothing");
  fs.rmSync(sb, { recursive: true, force: true });
}
console.log("8. integration run + validate + idempotent rerun: OK");

// ---- 9. integration: samplePending files, a later run heals -----------------
{
  const q1NoN = Q1_TXT.replace(/with 4927 voters/, "with voters nationwide");
  assert.equal(proseSample(q1NoN), null, "the trimmed footer carries no n");
  const { sb, ctx, validate, polls } = sandbox({ q1Text: q1NoN });
  const a = await run(ctx);
  assert.equal(a.exit, 0);
  const pendingRow = polls().find((p) => p.pollster === POOLSTER && p.date === "2026-03-26");
  assert.equal(pendingRow.samplePending, true, "a wave found with no n files with samplePending");
  assert.ok(!("sample" in pendingRow));
  assert.equal(validate(), true, "the validator excuses samplePending on non-election rows (house-agnostic:257–267)");
  // a later run with the n-carrying source heals the row in place — reached
  // through an UNDATED rediscovery item (the dated RSS item is below the
  // latest-pooled freshness filter once the newer Q3 wave has filed)
  const { ctx: ctx2 } = sandbox({ undatedQ1: true }); // fresh ctx object over the same sandbox
  ctx2.pollsPath = ctx.pollsPath; ctx2.outPath = ctx.outPath; ctx2.demographicsPath = ctx.demographicsPath;
  const b = await run(ctx2);
  assert.equal(b.exit, 0);
  assert.deepEqual(b.healed, ["Newspoll (pooled)|2026-03-26"], "the second run heals n in place");
  const healedRow = polls().find((p) => p.pollster === POOLSTER && p.date === "2026-03-26");
  assert.equal(healedRow.sample, 4927);
  assert.ok(!("samplePending" in healedRow));
  fs.rmSync(sb, { recursive: true, force: true });
}
console.log("9. samplePending + in-place n heal: OK");

// ---- 10. a NEW wave whose PDF prints a two-party table is refused loudly ----
{
  const { sb, ctx, polls } = sandbox({ q1Text: Q1_TXT + "\nTWO-PARTY PREFERRED\nLabor 51 Coalition 49\n" });
  const r = await run(ctx);
  assert.equal(r.exit, 0, "guards are non-fatal – a refusal is a loud note, not a crash");
  assert.equal(r.guarded.length, 1, "the two-party-printing PDF trips the primaries-only guard");
  assert.equal(r.filed.includes("Newspoll (pooled)|2026-03-26"), false);
  assert.ok(!polls().some((p) => p.pollster === POOLSTER && p.date === "2026-03-26"),
    "the refused wave writes no row (the plain Newspoll wave ending that day is untouched)");
  fs.rmSync(sb, { recursive: true, force: true });
}
console.log("10. two-party guard on a new wave: OK");
