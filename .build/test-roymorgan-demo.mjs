/* Pins for the Roy Morgan table-image reader (extract-roymorgan-demo.mjs +
   rm-demo-parse.mjs). Oracles: the committed OCR reads of finding 10363's two
   tables (.build/roymorgan-demo-src/ocr-10363-{state,city}.json), the
   committed findings cache (.build/roymorgan-src/release-10363-…json), and
   the committed wave on file in data/demographics.json (Roy Morgan
   2026-09-27) — a fixture parse must reproduce its committed wave figure for
   figure, bar the one cell the OCR never reads (Vic Independents/Others "9",
   which is exactly why that wave stays hand-owned: a wave the OCR doesn't
   read perfectly is never machine-filed). Integration: run() in tmp sandbox
   contexts with fixture-backed fetches and OCR — a complete synthetic read
   files; a dropped cell, a broken skeleton and recon drift all guard (exit 2)
   with nothing written. No network, no real polls.json/demographics.json
   writes. Run: node .build/test-roymorgan-demo.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  tableImages, parseStateTable, parseCityTable, num,
  CITY_GROUP, REGION_GROUP, PARTIES,
} from "./rm-demo-parse.mjs";
import { run, waveProblem, FIRST_WAVE, DEMO_POLLSTER } from "./extract-roymorgan-demo.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const FIX = path.join(ROOT, ".build", "roymorgan-demo-src");
const STATE_LINES = JSON.parse(fs.readFileSync(path.join(FIX, "ocr-10363-state.json"), "utf8"));
const CITY_LINES = JSON.parse(fs.readFileSync(path.join(FIX, "ocr-10363-city.json"), "utf8"));
const RM_CACHE_DIR = path.join(ROOT, ".build", "roymorgan-src");
const RELEASE_10363 = JSON.parse(fs.readFileSync(
  path.join(RM_CACHE_DIR, "release-10363-federal-voting-intention-september-29-2026.json"), "utf8"));
const IMG = {
  city: "https://roymorgan-cms-prod.s3.ap-southeast-2.amazonaws.com/wp-content/uploads/2026/09/29052148/image-31.png",
  state: "https://roymorgan-cms-prod.s3.ap-southeast-2.amazonaws.com/wp-content/uploads/2026/09/29052212/image-32.png",
};
const FILE_WAVE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "demographics.json"), "utf8"))
  .waves.find((w) => w.pollster === DEMO_POLLSTER && w.date === "2026-09-27");
assert.ok(FILE_WAVE, "oracle: the hand-entered 2026-09-27 wave is on file");
const POLL_ROW = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"))
  .polls.find((p) => p.pollster === DEMO_POLLSTER && p.date === "2026-09-27");
assert.ok(POLL_ROW, "oracle: the 2026-09-27 Roy Morgan poll row is on file");

// ---- 1. num: the OCR figure shapes ------------------------------------------
assert.equal(num("28.5"), 28.5);
assert.equal(num("28,5"), 28.5, "decimal comma");
assert.equal(num("28·5"), 28.5, "decimal middot");
assert.equal(num("100."), 100);
assert.equal(num("9"), 9);
assert.equal(num("9%"), 9);
assert.equal(num("101"), null, "out of range is not a share");
assert.equal(num("Now"), null);
assert.equal(num(""), null);
assert.equal(num(null), null);
console.log("1. num: OK");

// ---- 2. tableImages: captions map to their full-size images -----------------
{
  const imgs = tableImages(RELEASE_10363.content);
  assert.deepEqual(imgs, { city: IMG.city, state: IMG.state },
    "the two captions resolve to the release's two full-size PNGs");
  assert.deepEqual(tableImages("<p>primary vote tables are elsewhere</p>"), { city: null, state: null });
  assert.equal(tableImages(`Primary&nbsp;Vote <em>by</em> State <figure><img srcset="t.png 300w" src="${IMG.state}"/></figure>`).state, IMG.state,
    "srcset thumbnails never outrank the full-size src");
}
console.log("2. tableImages: OK");

// ---- 3. state table fixture == the committed hand wave (one unread cell) ----
{
  const t = parseStateTable(STATE_LINES);
  assert.ok(t, "the state table parses");
  assert.deepEqual(t.states, ["NSW", "Vic", "Qld", "SA", "WA"]);
  assert.deepEqual(t.states, Object.keys(FILE_WAVE.dims.state), "same state set as the hand wave");
  assert.deepEqual(t.missing, ["oth Vic"], "exactly the one cell the OCR never reads is reported");
  assert.deepEqual(t.conflicts, []);
  assert.equal(t.totalOk, true);
  for (const st of ["NSW", "Qld", "SA", "WA"])
    for (const p of PARTIES)
      assert.equal(t.now[p][st], FILE_WAVE.dims.state[st][p], `${st} ${p} matches the hand-entered wave`);
  for (const p of ["alp", "lnp", "onp", "grn"])
    assert.equal(t.now[p].Vic, FILE_WAVE.dims.state.Vic[p], `Vic ${p} matches the hand-entered wave`);
  assert.equal(t.now.oth.Vic, null, "Vic Independents/Others is the unread cell");
  assert.equal(FILE_WAVE.dims.state.Vic.oth, 9, "…and the hand entry carries it as 9");
  assert.equal(parseStateTable([]), null, "no skeleton, no table");
}
console.log("3. state table == committed wave (Vic oth unread): OK");

// ---- 4. city table fixture == the location dim + poll-row primaries ---------
{
  const t = parseCityTable(CITY_LINES);
  assert.ok(t, "the city table parses");
  assert.deepEqual(t.missing, []);
  assert.deepEqual(t.conflicts, []);
  assert.equal(t.totalOk, true);
  assert.deepEqual(t.groups[CITY_GROUP], FILE_WAVE.dims.location[CITY_GROUP], "Capital Cities == the filed dim");
  assert.deepEqual(t.groups[REGION_GROUP], FILE_WAVE.dims.location[REGION_GROUP], "Regional/Rural == the filed dim");
  assert.deepEqual(t.total, FILE_WAVE.total, "the TOTAL column == the filed total");
  assert.equal(t.total.alp, POLL_ROW.alp);
  assert.equal(t.total.lnp, POLL_ROW.lnp);
  assert.equal(t.total.onp, POLL_ROW.onp);
  assert.equal(t.total.grn, POLL_ROW.grn);
  assert.equal(t.total.oth, POLL_ROW.ind, "Independents/Others rides the poll row's ind");
  // spot oracles, so the oracle files above can never drift empty
  assert.equal(t.groups[CITY_GROUP].alp, 28.5);
  assert.equal(t.groups[REGION_GROUP].onp, 32);
  assert.equal(t.total.onp, 25.5);
}
console.log("4. city table == committed location dim + poll row: OK");

// ---- 5. waveProblem: the whole-wave filing gate ------------------------------
{
  const okState = JSON.parse(JSON.stringify(STATE_LINES))
    .concat([{ x: 0.483, y: 0.818, w: 0.02, h: 0.038, text: "9" }]); // the missing Vic cell, back in place
  const st = parseStateTable(okState);
  const ct = parseCityTable(CITY_LINES);
  const build = (stateT, cityT) => ({
    stateT, cityT,
    total: cityT ? cityT.total : null,
    dims: cityT ? { location: { [CITY_GROUP]: cityT.groups[CITY_GROUP], [REGION_GROUP]: cityT.groups[REGION_GROUP] } } : {},
  });
  assert.equal(waveProblem(build(st, ct), POLL_ROW), null, "a complete read files");
  const dropped = parseStateTable(STATE_LINES); // the real fixture's missing cell
  assert.match(waveProblem(build(dropped, ct), POLL_ROW), /OCR missed figure cell\(s\) oth Vic/, "a dropped cell is a guard, never a completion");
  const badSum = JSON.parse(JSON.stringify(okState));
  badSum.find((t) => t.text === "27.5" && t.y === 0.409).text = "29.5"; // WA alp Now
  assert.match(waveProblem(build(parseStateTable(badSum), ct), POLL_ROW), /the WA column sums 102/, "a sum two points off trips");
  const badRow = { ...POLL_ROW, alp: 30 };
  assert.match(waveProblem(build(st, ct), badRow), /TOTAL alp 26 against the poll row's 30/, "the TOTAL column must equal the poll row");
}
console.log("5. waveProblem gate: OK");

// ---- 6-10. run() integration in a tmp sandbox, fixture-backed ----------------
const SLUG_10363 = "10363-federal-voting-intention-september-29-2026";
const SLUG_10370 = "10370-federal-voting-intention-october-5-2026";
const NEW_ROW = {
  date: "2026-10-05", published: "2026-10-05T10:00", dateStart: "2026-09-28",
  pollster: DEMO_POLLSTER, client: "—", sample: 2500,
  alp: 26, lnp: 22.5, grn: 14.5, onp: 25.5, ind: 11, oth: null,
  tpp_alp: 52.5, tpp_lnp: 47.5,
  url: `https://www.roymorgan.com/findings/${SLUG_10370}`,
};
const FULL_STATE = STATE_LINES.concat([{ x: 0.483, y: 0.818, w: 0.02, h: 0.038, text: "9" }]);
const CAPTIONED = `
<p>Voting intention …</p>
<p>Primary Vote by <strong>City/Country</strong> <img src="${IMG.city}" srcset="${IMG.city.replace(".png", "-300x160.png")} 300w"/></p>
<p>Primary Vote by <strong>the State</strong>s <img src="${IMG.state}" srcset="${IMG.state.replace(".png", "-300x160.png")} 300w"/></p>`;

function sandbox({ rows, caches, ocrMap, demoFile }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmd-test-"));
  fs.writeFileSync(path.join(tmp, "polls.json"), JSON.stringify({ polls: rows }));
  fs.writeFileSync(path.join(tmp, "demographics.json"), JSON.stringify(demoFile ?? { waves: [FILE_WAVE] }));
  const src = path.join(tmp, "src");
  fs.mkdirSync(src, { recursive: true });
  for (const [slug, content] of Object.entries(caches))
    fs.writeFileSync(path.join(src, `release-${slug}.json`), JSON.stringify({ content }));
  const outPath = path.join(tmp, "roymorgan-demo.json");
  const ctx = {
    pollsPath: path.join(tmp, "polls.json"),
    outPath,
    demographicsPath: path.join(tmp, "demographics.json"),
    srcDir: src,
    writeFiles: true,
    todayIso: "2026-10-09",
    ocrImage: async (url) => {
      if (!(url in ocrMap)) throw new Error(`unexpected image fetch ${url}`);
      return ocrMap[url];
    },
    fetchPost: async (slug) => { throw new Error(`no live fetch in tests (${slug})`); },
  };
  return { tmp, ctx, outPath };
}

// 6: the hand-owned wave is recon-2'd cleanly and never machine-filed
{
  const { ctx } = sandbox({
    rows: [POLL_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content },
    ocrMap: { [IMG.state]: STATE_LINES, [IMG.city]: CITY_LINES },
  });
  const r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, false, "nothing files over a hand-entered wave");
  assert.deepEqual(r.filed, []);
  assert.ok(!r.notes.some((n) => n.includes("differ")), `recon-2 finds no disagreement (got: ${r.notes.join(" | ") || "none"})`);
}
console.log("6. hand-owned wave: recon-2 clean, nothing filed: OK");

// 7: a fresh wave whose OCR drops a cell GUARDS — the wave is never machine-filed
{
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, NEW_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content, [SLUG_10370]: CAPTIONED },
    ocrMap: { [IMG.state]: STATE_LINES, [IMG.city]: CITY_LINES },
  });
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, new RegExp(`${SLUG_10370}: state table: OCR missed figure cell\\(s\\) oth Vic`));
  assert.equal(fs.existsSync(outPath), false, "a guarded run writes nothing");
}
console.log("7. dropped cell: guard exit 2, nothing written: OK");

// 8: a complete read files — and re-running is idempotent over a clean recon
{
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, NEW_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content, [SLUG_10370]: CAPTIONED },
    ocrMap: { [IMG.state]: FULL_STATE, [IMG.city]: CITY_LINES },
  });
  let r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, true);
  assert.deepEqual(r.filed, [`${DEMO_POLLSTER}|2026-10-05`]);
  const store = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const w = store.waves[0];
  assert.equal(w.date, "2026-10-05");
  assert.equal(w.slug, SLUG_10370);
  assert.equal(w.article, NEW_ROW.url);
  assert.equal(w.stateImg, IMG.state);
  assert.equal(w.cityImg, IMG.city);
  assert.deepEqual(w.total, { alp: 26, lnp: 22.5, onp: 25.5, grn: 14.5, oth: 11 });
  assert.equal(w.dims.state.Vic.oth, 9, "the re-completed cell lands verbatim");
  assert.deepEqual(w.dims.location[CITY_GROUP], { alp: 28.5, lnp: 22.5, onp: 22, grn: 16, oth: 11.5 });
  assert.deepEqual(w.dims.location[REGION_GROUP], { alp: 22, lnp: 23, onp: 32, grn: 13, oth: 10 });
  assert.deepEqual(Object.keys(w.dims), ["state", "location"]);
  // recon idempotence: a second run over the same images files nothing again
  r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, false);
  assert.deepEqual(r.filed, []);
}
console.log("8. complete read: files exactly; recon-clean re-run: OK");

// 9: recon drift is a guard, never a rewrite
{
  const tampered = FULL_STATE.map((t) => (t.text === "28.5" && t.y === 0.409 ? { ...t, text: "29" } : t));
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, NEW_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content, [SLUG_10370]: CAPTIONED },
    ocrMap: { [IMG.state]: FULL_STATE, [IMG.city]: CITY_LINES },
  });
  let r = await run(ctx);
  assert.equal(r.exit, 0, "first run files the wave");
  const before = fs.readFileSync(outPath, "utf8");
  ctx.ocrImage = async (url) => (url === IMG.state ? tampered : CITY_LINES);
  r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /recon 2026-10-05: the images no longer read as the recorded wave/);
  assert.equal(fs.readFileSync(outPath, "utf8"), before, "a guarded recon rewrites nothing");
}
console.log("9. recon drift: guard, never a rewrite: OK");

// 10: plain releases are remembered (none); a broken skeleton guards
{
  const SLUG_PLAIN = "10365-federal-voting-intention-october-7-2026";
  const plainRow = { ...NEW_ROW, date: "2026-10-07", url: `https://www.roymorgan.com/findings/${SLUG_PLAIN}` };
  const plain = "<p>Australia's federal voting intention … nothing else.</p>";
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, plainRow],
    caches: { [SLUG_10363]: RELEASE_10363.content, [SLUG_PLAIN]: plain },
    ocrMap: { [IMG.state]: STATE_LINES, [IMG.city]: CITY_LINES },
  });
  let r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, true);
  assert.deepEqual(r.checkedNone, [SLUG_PLAIN]);
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")).none, { [SLUG_PLAIN]: "2026-10-09" });
  let fetches = 0;
  ctx.fetchPost = async () => { fetches += 1; throw new Error("never fetched again"); };
  r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, false, "a remembered plain release is skipped (cache file carries the no-table note)");
  assert.deepEqual(r.checkedNone, []);
  // a caption pair present but the table unreadable = layout guard, not none
  const { ctx: ctx2 } = sandbox({
    rows: [plainRow],
    caches: { [SLUG_PLAIN]: CAPTIONED },
    ocrMap: { [IMG.state]: [{ x: 0, y: 0, w: 0, h: 0, text: "garbage" }], [IMG.city]: CITY_LINES },
  });
  const r2 = await run(ctx2);
  assert.equal(r2.exit, 2);
  assert.match(r2.guard, new RegExp(`${SLUG_PLAIN}: the state table no longer parses`));
}
console.log("10. none memory + unparseable-table guard: OK");

console.log("All Roy Morgan demo-reader pins pass.");
assert.equal(FIRST_WAVE, "2026-09-27");
