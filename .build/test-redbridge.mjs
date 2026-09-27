/* Unit test for extract-redbridge.mjs parsers, run against the cached July
   2026 wave PDF text (the wave already committed to data/polls.json in
   8abac0f). Asserts the parsers recover exactly the committed values, and
   that the safety guard passes the wave. Run: node .build/test-redbridge.mjs */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

process.env.RB_LIB = "1";
const { parsePdf, parseAfrTopic, guardNewWave } = await import("./extract-redbridge.mjs");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC_DIR = path.join(ROOT, ".build", "redbridge-src");

let txtPath = null;
if (existsSync(SRC_DIR)) {
  const hit = readdirSync(SRC_DIR).find((f) => f.includes("july-2026") && f.endsWith(".txt"));
  if (hit) txtPath = path.join(SRC_DIR, hit);
}
if (!txtPath) {
  const probe = path.join(ROOT, ".matilda", "probe", "july-full.txt");
  if (existsSync(probe)) txtPath = probe;
}
assert.ok(txtPath, "no July 2026 PDF text cache found – run node .build/extract-redbridge.mjs --check first");
console.log(`parsing ${txtPath}`);

const notes = [];
const w = parsePdf(readFileSync(txtPath, "utf8"), "july-2026-federal-poll", notes);
if (notes.length) console.log("notes:", notes);
console.log(JSON.stringify(w, null, 2));

// methodology
assert.equal(w.date, "2026-07-30", "fieldwork end");
assert.equal(w.dateStart, "2026-07-27", "fieldwork start");
assert.equal(w.sample, 1001, "sample");

// Table 2 wave row (values committed to data/polls.json)
assert.equal(w.label, "Jul 2026", "wave label");
assert.equal(w.alp, 29); assert.equal(w.lnp, 22); assert.equal(w.grn, 10);
assert.equal(w.onp, 31); assert.equal(w.ind, 8);
assert.equal(w.tppResp, 48, "respondent-allocated TPP");
assert.equal(w.tppVsOn, 53, "ALP-vs-One-Nation TPP");
// Table 1 published respondent-allocated preference split (ALP shares, %)
assert.deepEqual(w.tppSplit, { grn: 87, onp: 16, oth: 61 });
// Table 1's "Labor vs. One Nation" sub-block (ALP shares, %) — and the
// implied-ALP-vs-ON total rebuilt from these splits + the wave's primaries
// must land within ~0.6pt of Table 2's printed figure
assert.deepEqual(w.tppSplitOn, { lnp: 44, grn: 91, oth: 61 });
{
  const s = w.tppSplitOn;
  const implied = w.alp + (w.lnp * s.lnp + w.grn * s.grn + w.ind * s.oth) / 100;
  assert.ok(Math.abs(implied - w.tppVsOn) <= 0.6,
    `implied ALP-vs-ON ${implied.toFixed(2)} vs printed ${w.tppVsOn}`);
}

// vote-softness table: the wave's own row, [solid, soft, very soft]
assert.deepEqual(w.firmness, {
  all: [49, 42, 9], alp: [51, 40, 9], lnp: [47, 44, 9],
  onp: [59, 36, 5], grn: [39, 52, 9], oth: [32, 46, 22],
});

// PPM (Albanese 32, Taylor 15, Hanson 24)
assert.deepEqual(w.ppm, { alb: 32, opp: 15, han: 24 });
assert.equal(w.oppName, "Taylor");

// Table 5 net favourabilities (-19 / -6 / -10 – matches committed rows)
assert.deepEqual(w.nets, { alb: -19, opp: -6, han: -10 });
// detail is Table-5-derived (very+mostly favourable / mostly+very
// unfavourable). NOTE: the committed July row's detail (40/59, 30/36, 40/50)
// was eyeballed from the report figures and intentionally does NOT match;
// the extractor's verify step reports that as a mismatch note but never
// overwrites. Below are the true Table 5 totals.
assert.deepEqual(w.detail, {
  alb: { app: 30, dis: 49 }, opp: { app: 20, dis: 26 }, han: { app: 36, dis: 46 },
});

// the safety guard must accept this wave
const guardErrs = guardNewWave(w, "2026-08-02");
assert.deepEqual(guardErrs, [], `guard errors: ${guardErrs.join(" | ")}`);

console.log("PASS: July 2026 wave parses to the committed values and passes the guard");

// The AFR topic page: only the topic's own story list (tag.assetsConnection)
// counts - a sidebar promo in another content unit must not - and a page
// with no list is null (no evidence), never an empty list.
{
  const blob = { loaderData: { "1-0-20-0": {
    contentUnitsDetails: { contentUnits: [{ assets: [{ urls: { canonical: { path: "/life/car-review-20260927-p60yrf" } }, dates: { firstPublished: "2026-09-26T19:00:00Z" } }] }] },
    tag: { assetsConnection: { assets: [
      { urls: { canonical: { path: "/politics/state-poll-20260915-p60xev" } }, dates: { firstPublished: "2026-09-15T09:55:00Z" } },
      { urls: { canonical: { path: "/politics/federal/wave-20260830-p60srn" } }, dates: { firstPublished: "2026-08-30T08:00:00Z" } },
    ] } },
  } } };
  const page = (o) => `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(o))});</script>`;
  assert.deepEqual(parseAfrTopic(page(blob)).map((x) => x.firstPublished), ["2026-09-15T09:55:00Z", "2026-08-30T08:00:00Z"]);
  assert.equal(parseAfrTopic(page({ loaderData: { a: { tag: { assetsConnection: { assets: [] } } } } })), null);
  assert.equal(parseAfrTopic("<html>no blob</html>"), null);
  console.log("PASS: AFR topic list parses the topic's own stories, and no list is no evidence");
}
