/* Pins for the Roy Morgan national-direction prose reader
   (extract-roymorgan-direction.mjs + rm-direction-parse.mjs), which banks the
   "Analysis by …" group splits from the committed release caches into
   data/roymorgan-direction-groups.json for the direction panel's group select.

   Oracles: the six committed release caches (.build/roymorgan-src/release-10…
   .json) and the committed store rows they produced. Integration: run() in a
   tmp sandbox (tmp outPath; the real caches and the real polls.json as
   read-only fixtures) files exactly the committed six waves; a re-run is
   changed:false; a corrupted store shape, a corrupted cache and a tampered
   filed wave all guard (exit 2) with nothing written. No network.
   Run: node .build/test-roymorgan-direction.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseGender, parseVote, parseStateExtremes, parseDirectionGroups, VOTE_GROUPS, STATES_FULL }
  from "./rm-direction-parse.mjs";
import { clean } from "./extract-common.mjs";
import { run, DIR_POLLSTER } from "./extract-roymorgan-direction.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, ".build", "roymorgan-src");
const STORE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8"));
const POLLS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));

/* The committed store, keyed by slug — the oracle every cache read below is
   aimed at. */
const WAVES_BY_SLUG = Object.fromEntries(Object.entries(STORE.waves).map(([d, w]) => [w.slug, { date: d, ...w }]));
assert.ok(Object.keys(WAVES_BY_SLUG).length >= 6, "the committed store carries the cache-era waves");
const cacheOf = (slug) => JSON.parse(fs.readFileSync(path.join(SRC, `release-${slug}.json`), "utf8"));
const groupsOf = (slug) => parseDirectionGroups(clean(cacheOf(slug).content));

// ---- 1. the six committed caches read as the committed store, figure for figure
{
  for (const [slug, want] of Object.entries(WAVES_BY_SLUG)) {
    const p = groupsOf(slug);
    assert.deepEqual(Object.keys(p), ["groups"], `${slug}: no parse problems`);
    for (const block of ["gender", "vote", "stateExtremes"])
      assert.deepEqual(p.groups[block] ?? null, want[block] ?? null, `${slug}: ${block} matches the store`);
  }
  console.log("1. committed caches == committed store: OK");
}

// ---- 2. the state-extremes scope: the demographic-table echo cannot leak in
{
  // 10366's release carries "lowest in South Australia (14.5%)" in a
  // demographic-table note AND the Analysis-by-state "lowest … (54%)"; the
  // parser must land on 54.
  const p = groupsOf("10366-federal-voting-intention-october-12-2026");
  assert.deepEqual(p.groups.stateExtremes.lowest, { state: "South Australia", w: 54 },
    "the direction block's lowest, not a demographic-table echo");
  const cached = clean(cacheOf("10366-federal-voting-intention-october-12-2026").content);
  assert.ok((cached.match(/lowest in South Australia/g) || []).length >= 2,
    "fixture sanity: the 14.5% echo really is in this release");
  console.log("2. state-extremes scoping: OK");
}

// ---- 3. unit shapes: alternates the parser must take ------------------------
{
  const onp = (w) => `One Nation supporters (${w}%)`;
  const ln = (w) => `L-NP supporters (${w}%)`;
  const oth = (w) => `Other Party supporters (${w}%)`;
  // 10353's phrasing: "supporters of Independent candidates", "L-NP" without
  // "Coalition", no Greens-first reorder here but an ellipsis-free list.
  const v = parseVote(`Analysis by voting intention shows ${onp(95)}, ${ln(77)}, ${oth(68)}, supporters of Independent candidates (63%), and Greens supporters (60%) say that the country is 'going in the wrong direction'. In contrast, only 30% of ALP supporters say the country is 'going in the wrong direction' – a slim majority of 51% say the country is 'going in the right direction'.`);
  assert.deepEqual(v, {
    "One Nation": { w: 95 }, "L-NP": { w: 77 }, Other: { w: 68 },
    Independent: { w: 63 }, Greens: { w: 60 }, ALP: { w: 30, r: 51 },
  }, "the Independent-candidates / slim-majority forms");
  // no right-direction majority sentence at all → ALP r is null, not an error
  const bare = parseVote(`Analysis by voting intention shows ${onp(50)}, ${ln(60)}, ${oth(70)}, Independent supporters (40%), and Greens supporters (30%) say that the country is 'going in the wrong direction'. In contrast, only 20% of ALP supporters say the country is 'going in the wrong direction'.`);
  assert.equal(bare.ALP.r, null, "an unprinted ALP right share files as null");
  // a dangling right-direction clause is an error, never silently dropped
  const dangle = parseVote(`Analysis by voting intention shows ${onp(50)}, ${ln(60)}, ${oth(70)}, Independent supporters (40%), and Greens supporters (30%) say that the country is 'going in the wrong direction'. In contrast, only 20% of ALP supporters say the country is 'going in the wrong direction' – a majority say the country is 'going in the right direction'.`);
  assert.ok(dangle.error, "a right-direction clause with no figure errors");
  // gender and state housekeeping. 10113's gender block is a two-party
  // preferred cut ("women supporting the ALP on 61% …"), not direction
  // prose: an anchor whose own text never mentions direction within its
  // first 400 chars is ABSENT, never a guard trip — while a direction-
  // mentioning block whose figures no longer read still errors.
  assert.equal(parseGender("Analysis by state shows a majority in all states believe the country is going in the wrong direction."), null, "no gender anchor → null");
  assert.equal(parseGender("Analysis by gender shows women supporting the ALP on 61% compared to the L-NP on 39% on a two-party preferred basis."), null, "a non-direction gender block is absent");
  assert.ok(parseGender("Analysis by gender shows Australians are split on the country's direction in an entirely new way.").error, "a shifted direction-gender block errors");
  assert.equal(parseVote("x"), null, "no vote anchor → null");
  assert.equal(parseStateExtremes("Analysis by gender shows 60% of men and 58% of women say Australia is 'going in the wrong direction'."), null, "no state anchor → null");
  assert.ok(parseStateExtremes("Analysis by state shows a majority in all states believe the country is going in the wrong direction.").error,
    "a state block with unlabelled extremes errors");
  console.log("3. unit alternates: OK");
}

// ---- 4. integration: run() in a tmp sandbox files the committed waves ------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmdir-test-"));
  const out = path.join(tmp, "groups.json");
  const st = await run({ outPath: out, writeFiles: true });
  assert.equal(st.exit, 0, `clean run: ${st.guard ?? ""}`);
  assert.equal(st.changed, true, "first run writes");
  const got = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.deepEqual(got.waves, STORE.waves, "the tmp store reproduces the committed store wave for wave");
  assert.ok(st.filed.includes("2026-10-11"), "the cache-era waves file");
  const st2 = await run({ outPath: out, writeFiles: true });
  assert.equal(st2.exit, 0, `idempotent re-run: ${st2.guard ?? ""}`);
  assert.equal(st2.changed, false, "a quiet re-run writes nothing");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("4. tmp-sandbox integration: OK");
}

// ---- 5. guards: a corrupt store, a corrupt cache, recon drift → exit 2 -----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmdir-guard-"));
  // (a) the store's own shape drifts (hand-edit / torn write) → guard, no rewrite
  const badShape = path.join(tmp, "badshape.json");
  fs.writeFileSync(badShape, JSON.stringify({ _about: "x", waves: [] }));
  let st = await run({ outPath: badShape, writeFiles: true });
  assert.equal(st.exit, 2, "a drifted store shape guards");
  assert.match(st.guard, /store shape drifted/, st.guard);
  assert.equal(fs.readFileSync(badShape, "utf8"), JSON.stringify({ _about: "x", waves: [] }), "the drifted store is untouched");
  // (b) a committed cache gone unreadable → guard
  const srcDir = path.join(tmp, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  const slug = "10328-federal-voting-intention-august-31-2026";
  fs.writeFileSync(path.join(srcDir, `release-${slug}.json`), JSON.stringify({ slug }));
  st = await run({ outPath: path.join(tmp, "b.json"), srcDir, writeFiles: true });
  assert.equal(st.exit, 2, "an unreadable cache guards");
  assert.match(st.guard, /cache unreadable/, st.guard);
  assert.ok(!fs.existsSync(path.join(tmp, "b.json")), "nothing written");
  // (c) a filed wave the cache no longer reproduces → recon guard, no rewrite
  const strayed = path.join(tmp, "strayed.json");
  await run({ outPath: strayed, writeFiles: true });
  const s = JSON.parse(fs.readFileSync(strayed, "utf8"));
  s.waves["2026-08-30"].gender.Men.w = 1;
  fs.writeFileSync(strayed, JSON.stringify(s, null, 1) + "\n");
  st = await run({ outPath: strayed, writeFiles: true });
  assert.equal(st.exit, 2, "recon drift guards");
  assert.match(st.guard, /no longer reads as the recorded wave/, st.guard);
  assert.equal(JSON.parse(fs.readFileSync(strayed, "utf8")).waves["2026-08-30"].gender.Men.w, 1,
    "the store is never rewritten on a guard");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("5. guard trips: OK");
}

// ---- 6. the extractor's checksum: the direction row and the cache must agree
{
  // Flip one direction row in a tmp polls.json; the wave's cache parse can no
  // longer equal the row, so the run must guard rather than file.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmdir-row-"));
  const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const row = polls.direction.find((d) => d.pollster === DIR_POLLSTER && d.date === "2026-10-11");
  row.wrong += 5;
  const pollsPath = path.join(tmp, "polls.json");
  fs.writeFileSync(pollsPath, JSON.stringify(polls));
  const st = await run({ outPath: path.join(tmp, "out.json"), pollsPath, writeFiles: true });
  assert.equal(st.exit, 2, "a drifted direction row guards");
  assert.match(st.guard, /national pair/, st.guard);
  assert.ok(!fs.existsSync(path.join(tmp, "out.json")), "nothing written");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("6. national-pair checksum: OK");
}

console.log("test-roymorgan-direction: all OK");
