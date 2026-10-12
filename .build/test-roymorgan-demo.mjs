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
   writes. Finding 10366's reads (ocr-10366-{state,city}-{fast,accurate}.json)
   pin the "Australia" column head, the OCR ladder (.accurate first, .fast
   as the fallback) and the Primary Vote for Tasmania HTML table. Run: node .build/test-roymorgan-demo.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  tableImages, CAPTION_RES, SEEN_IMG_RE, parseStateTable, parseCityTable, parseTasTable, num,
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

function sandbox({ rows, caches = {}, cacheRaw, ocrMap, demoFile, fetchPost, rmdTmp }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmd-test-"));
  fs.writeFileSync(path.join(tmp, "polls.json"), JSON.stringify({ polls: rows }));
  fs.writeFileSync(path.join(tmp, "demographics.json"), JSON.stringify(demoFile ?? { waves: [FILE_WAVE] }));
  const src = path.join(tmp, "src");
  fs.mkdirSync(src, { recursive: true });
  for (const [slug, content] of Object.entries(caches))
    fs.writeFileSync(path.join(src, `release-${slug}.json`), JSON.stringify({ content }));
  for (const [slug, raw] of Object.entries(cacheRaw ?? {}))
    fs.writeFileSync(path.join(src, `release-${slug}.json`), raw);
  const outPath = path.join(tmp, "roymorgan-demo.json");
  if (rmdTmp) {
    fs.mkdirSync(rmdTmp, { recursive: true });
    fs.writeFileSync(path.join(rmdTmp, "marker"), "");
  }
  const ctx = {
    pollsPath: path.join(tmp, "polls.json"),
    outPath,
    demographicsPath: path.join(tmp, "demographics.json"),
    srcDir: src,
    writeFiles: true,
    todayIso: "2026-10-09",
    ocrImage: async (url) => {
      if (!(url in (ocrMap ?? {}))) throw new Error(`unexpected image fetch ${url}`);
      return ocrMap[url];
    },
    fetchPost: fetchPost ?? (async (slug) => { throw new Error(`no live fetch in tests (${slug})`); }),
  };
  if (rmdTmp) ctx.tmpPath = rmdTmp;
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

// 11: a corrupt committed cache is noted, re-fetched live and filed through
// the usual gates — never re-read silently run after run
{
  let fetches = 0;
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, NEW_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content },
    cacheRaw: { [SLUG_10370]: "{ this is not JSON" },
    ocrMap: { [IMG.state]: FULL_STATE, [IMG.city]: CITY_LINES },
    fetchPost: async () => { fetches += 1; return { content: CAPTIONED }; },
  });
  const r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(fetches, 1, "the unreadable cache is bypassed exactly once");
  assert.ok(r.notes.some((n) => n.includes(`${SLUG_10370}: committed cache unreadable`)),
    `the corrupt cache is told, not silent (got: ${r.notes.join(" | ") || "none"})`);
  assert.deepEqual(r.filed, [`${DEMO_POLLSTER}|2026-10-05`], "the live-fetched release files through the usual gates");
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")).none, {},
    "a corrupt cache is never remembered as no-tables");
}
console.log("11. corrupt cache: live fallback + note, filed as usual: OK");

// 12: a contentless read (no cache, fetch down) is a note and a retry —
// never a filing and never a none-mark
{
  let fetches = 0;
  const { ctx, outPath } = sandbox({
    rows: [NEW_ROW],
    fetchPost: async () => { fetches += 1; throw new Error("upstream 503"); },
  });
  let r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, false);
  assert.equal(fetches, 1);
  assert.ok(r.notes.some((n) => n.includes("release page fetch failed")), "the failure is told");
  assert.equal(fs.existsSync(outPath), false, "nothing files, no none-mark lands on disk");
  r = await run(ctx);
  assert.equal(fetches, 2, "the next run retries the wave — it was never none-marked");
  assert.equal(fs.existsSync(outPath), false);
}
console.log("12. contentless read: note now, retry next run, never none: OK");

// 13: caption(s) with an unresolvable image = layout guard; caption prose
// with no <img> stays a plain release
{
  const CAPTION_JPG = `<p>Primary Vote by <strong>the State</strong>s</p><p><img src="https://x/state-table.jpg"/></p>`;
  const { ctx, outPath } = sandbox({ rows: [NEW_ROW], caches: { [SLUG_10370]: CAPTION_JPG }, ocrMap: {} });
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, new RegExp(`${SLUG_10370}: table caption and an <img> but no table image resolved`));
  assert.equal(fs.existsSync(outPath), false, "a guarded layout writes no store — no poisoned none-mark");
}
{
  const CAPTION_SQUOTE = `<p>Primary Vote by City</p><img src='https://x/city.png'/>`;
  const { ctx } = sandbox({ rows: [NEW_ROW], caches: { [SLUG_10370]: CAPTION_SQUOTE }, ocrMap: {} });
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /no table image resolved/, "a src the double-quote regex misses is drift, not a plain release");
}
{
  const PROSE = `<p>Primary Vote by State tables return in the next release.</p>`;
  const { ctx, outPath } = sandbox({ rows: [NEW_ROW], caches: { [SLUG_10370]: PROSE }, ocrMap: {} });
  const r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, true);
  assert.deepEqual(r.checkedNone, [SLUG_10370], "caption prose without an image is a plain release");
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")).none, { [SLUG_10370]: "2026-10-09" });
}
assert.ok(CAPTION_RES.city.test(RELEASE_10363.content) && CAPTION_RES.state.test(RELEASE_10363.content)
  && SEEN_IMG_RE.test(RELEASE_10363.content), "the exported guards ride the same captions the parser reads");
console.log("13. caption+unresolved-image guards; prose captions stay plain: OK");

// 14: one resolved table alone files with the vacated-check note, and its
// wave stays recon-clean on re-run
{
  const CITY_ONLY = `<p>Primary Vote by <strong>City/Country</strong></p><p><img src="${IMG.city}"/></p>`;
  const { ctx, outPath } = sandbox({
    rows: [POLL_ROW, NEW_ROW],
    caches: { [SLUG_10363]: RELEASE_10363.content, [SLUG_10370]: CITY_ONLY },
    ocrMap: { [IMG.state]: STATE_LINES, [IMG.city]: CITY_LINES },
  });
  let r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.deepEqual(r.filed, [`${DEMO_POLLSTER}|2026-10-05`]);
  assert.ok(r.notes.some((n) => n.includes(`${SLUG_10370}: only the city table resolved`) && n.includes("state column-sum checks")),
    `the vacated cross-check is told (got: ${r.notes.join(" | ") || "none"})`);
  const w = JSON.parse(fs.readFileSync(outPath, "utf8")).waves.find((x) => x.date === "2026-10-05");
  assert.equal(w.stateImg, null);
  assert.deepEqual(Object.keys(w.dims), ["location"]);
  r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(r.changed, false, "a one-table store wave is recon-clean on re-run");
}
console.log("14. one-table filing: vacated cross-check noted: OK");

// 15: the demo store's own shape is guarded at load (never read into
// memory, never rewritten), and run() sweeps the OCR temp dir at exit
{
  const { ctx, outPath } = sandbox({ rows: [NEW_ROW] });
  fs.writeFileSync(outPath, "{ this is not JSON");
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /demo store shape drifted — not an object/);
  assert.equal(fs.readFileSync(outPath, "utf8"), "{ this is not JSON", "a drifted store is never rewritten");
}
{
  const { ctx, outPath } = sandbox({ rows: [NEW_ROW] });
  fs.writeFileSync(outPath, JSON.stringify({ waves: {}, none: {} }));
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /waves is not an array/);
}
{
  const { ctx, outPath } = sandbox({ rows: [NEW_ROW] });
  fs.writeFileSync(outPath, JSON.stringify({ waves: [], none: { [SLUG_10370]: "yesterday" } }));
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /none \S+: not an ISO day/);
}
{
  const rmdTmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rmd-pin-")), "rmd-work");
  const { ctx } = sandbox({ rows: [NEW_ROW], rmdTmp });
  assert.ok(fs.existsSync(path.join(rmdTmp, "marker")), "the sandbox pre-made the OCR dir");
  const r = await run(ctx);
  assert.equal(r.exit, 0);
  assert.equal(fs.existsSync(rmdTmp), false, "run() swept the OCR temp dir at exit");
}
console.log("15. store-shape guard + temp-dir sweep: OK");

// ---- 16. finding 10366 (12 Oct 2026): "Australia" heads the city table's
// national column, and .fast drops cells that .accurate reads ------------------
const SLUG_10366 = "10366-federal-voting-intention-october-12-2026";
const RELEASE_10366 = JSON.parse(fs.readFileSync(path.join(RM_CACHE_DIR, `release-${SLUG_10366}.json`), "utf8"));
const ROW_10366 = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"))
  .polls.find((p) => p.pollster === DEMO_POLLSTER && p.date === "2026-10-11");
assert.ok(ROW_10366, "oracle: the 2026-10-11 Roy Morgan poll row is on file");
const OCR_10366 = Object.fromEntries(["state", "city"].flatMap((t) => ["fast", "accurate"].map((m) =>
  [`${t}-${m}`, JSON.parse(fs.readFileSync(path.join(FIX, `ocr-10366-${t}-${m}.json`), "utf8"))])));
const IMG_10366 = tableImages(RELEASE_10366.content);
{
  const c = parseCityTable(OCR_10366["city-accurate"]);
  assert.ok(c, "a city table headed Australia / Capital Cities / Regional parses");
  assert.deepEqual([c.missing, c.conflicts, c.totalOk], [[], [], true]);
  // oracles: the printed image, cell by cell
  assert.deepEqual(c.total, { alp: 26, lnp: 21.5, onp: 24, grn: 15, oth: 13.5 });
  assert.deepEqual(c.groups[CITY_GROUP], { alp: 29, lnp: 21, onp: 21, grn: 17, oth: 12 });
  assert.deepEqual(c.groups[REGION_GROUP], { alp: 21.5, lnp: 22, onp: 30.5, grn: 10.5, oth: 15.5 });
  assert.deepEqual(c.total, { alp: ROW_10366.alp, lnp: ROW_10366.lnp, onp: ROW_10366.onp, grn: ROW_10366.grn, oth: ROW_10366.ind },
    "the Australia column is the poll row");
  const s = parseStateTable(OCR_10366["state-accurate"]);
  assert.deepEqual([s.missing, s.conflicts, s.totalOk], [[], [], true]);
  assert.deepEqual(s.now.alp, { NSW: 27.5, Vic: 26.5, Qld: 25, SA: 28, WA: 22 });
  assert.deepEqual(s.now.onp, { NSW: 27.5, Vic: 19, Qld: 28, SA: 14.5, WA: 29.5 });
  // the .fast reads that guarded the release-night run
  assert.ok(parseCityTable(OCR_10366["city-fast"]).missing.includes("lnp region"));
  assert.deepEqual(parseStateTable(OCR_10366["state-fast"]).missing, ["alp WA"]);
}
{
  // the ladder: .accurate first files the wave whole
  const { ctx, outPath } = sandbox({ rows: [ROW_10366], caches: { [SLUG_10366]: RELEASE_10366.content }, demoFile: { waves: [] } });
  const asked = [];
  ctx.ocrImage = async (url, rung) => {
    asked.push(rung.mode);
    return OCR_10366[`${url === IMG_10366.state ? "state" : "city"}-${rung.mode}`];
  };
  let r = await run(ctx);
  assert.equal(r.exit, 0, r.guard);
  assert.deepEqual(r.filed, [`${DEMO_POLLSTER}|2026-10-11`]);
  assert.deepEqual(asked, ["accurate", "accurate"], "a clean first rung reads no further");
  const w = JSON.parse(fs.readFileSync(outPath, "utf8")).waves[0];
  assert.equal(w.dims.state.WA.alp, 22);
  assert.equal(w.dims.location[REGION_GROUP].lnp, 22);
  // Tasmania: the HTML table on the page, its four-week base on the wave
  assert.deepEqual(w.dims.state.Tas, { alp: 27.5, lnp: 14, onp: 23, grn: 17.5, oth: 18 });
  assert.deepEqual(w.tas, { dateStart: "2026-09-14", dateEnd: "2026-10-11", n: 204 });
  assert.deepEqual(Object.keys(w.dims.state), ["NSW", "Vic", "Qld", "SA", "WA", "Tas"]);
  // a clean re-run re-reads the images and the Tasmania table, files nothing
  r = await run(ctx);
  assert.equal(r.exit, 0, r.guard);
  assert.equal(r.changed, false);
  assert.deepEqual(r.notes, []);
  // .accurate wedged on the recon re-read: .fast reads short → a note, not a drift guard
  const before = fs.readFileSync(outPath, "utf8");
  ctx.ocrImage = async (url, rung) => {
    if (rung.mode === "accurate") throw new Error("e5rt error 13");
    return OCR_10366[`${url === IMG_10366.state ? "state" : "city"}-fast`];
  };
  r = await run(ctx);
  assert.equal(r.exit, 0, r.guard);
  assert.ok(r.notes.some((n) => /recon 2026-10-11: no OCR rung read the tables whole/.test(n)), r.notes.join(" | "));
  assert.equal(fs.readFileSync(outPath, "utf8"), before, "a short recon read rewrites nothing");
}
{
  // .accurate wedged on a fresh wave: the .fast rungs' dropped cell is a guard
  const { ctx, outPath } = sandbox({ rows: [ROW_10366], caches: { [SLUG_10366]: RELEASE_10366.content }, demoFile: { waves: [] } });
  ctx.ocrImage = async (url, rung) => {
    if (rung.mode === "accurate") throw new Error("e5rt error 13");
    return OCR_10366[`${url === IMG_10366.state ? "state" : "city"}-fast`];
  };
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /state table: OCR missed figure cell\(s\) alp WA/);
  assert.equal(fs.existsSync(outPath), false);
  // every rung failing is an OCR error, not a quiet parse failure
  ctx.ocrImage = async () => { throw new Error("e5rt error 13"); };
  await assert.rejects(run(ctx), /e5rt error 13/);
}
{
  // parseTasTable: no caption → null; a caption over a table it can't read → error
  assert.equal(parseTasTable(RELEASE_10363.content), null, "10363 printed no Tasmania table");
  const t = parseTasTable(RELEASE_10366.content);
  assert.deepEqual([t.missing, t.totalOk, t.n, t.period], [[], true, 204, { dateStart: "2026-09-14", dateEnd: "2026-10-11" }]);
  const noNow = RELEASE_10366.content.replace(/<strong>Now<\/strong>/, "<strong>Latest</strong>");
  assert.match(parseTasTable(noNow).error, /no Now column/);
  // ... and that guards the wave, nothing written
  const { ctx, outPath } = sandbox({ rows: [ROW_10366], caches: { [SLUG_10366]: noNow }, demoFile: { waves: [] } });
  ctx.ocrImage = async (url, rung) => OCR_10366[`${url === IMG_10366.state ? "state" : "city"}-${rung.mode}`];
  const r = await run(ctx);
  assert.equal(r.exit, 2);
  assert.match(r.guard, /the Tasmania table no longer parses \(the Tasmania table has no Now column\)/);
  assert.equal(fs.existsSync(outPath), false);
  // a Tasmania cell that doesn't add up is the gate's too
  const off = RELEASE_10366.content.replace(/>27\.5</, ">29.5<");
  const s2 = sandbox({ rows: [ROW_10366], caches: { [SLUG_10366]: off }, demoFile: { waves: [] } });
  s2.ctx.ocrImage = ctx.ocrImage;
  const r2 = await run(s2.ctx);
  assert.equal(r2.exit, 2);
  assert.match(r2.guard, /Tasmania table: the Now column sums 102/);
}
console.log("16. 10366: Australia-headed city table + OCR ladder + Tasmania table: OK");

console.log("All Roy Morgan demo-reader pins pass.");
assert.equal(FIRST_WAVE, "2026-09-27");
