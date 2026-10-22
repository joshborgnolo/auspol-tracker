/* Pins for the RedBridge/Accent national-direction reader
   (extract-redbridge-direction.mjs + rb-direction-parse.mjs), which files
   both the headline polls.json direction[] rows and the
   data/redbridge-direction-groups.json breakdown store from the committed
   APC-statement caches (.build/redbridge-src/<slug>.{json,txt}) — never a
   live fetch.

   Oracles: the three section-bearing statement caches (Nov-2025, Jan-2026,
   May-2026) and the committed store waves they reproduce. Integration:
   run() in a tmp sandbox (tmp polls.json + tmp store; the real caches
   read-only) writes exactly the _about provenance move and reproduces the
   committed waves figure for figure; a re-run is changed:false. Guard
   trips: a corrupted store shape, a tampered cache text, a drifted
   direction row, a row on a section-less wave, and a tampered filed wave
   all stop the run at exit 2 with nothing written — and the row-filing
   path is exercised by deleting the May-2026 row from a tmp polls.json.
   No network.
   Run: node .build/test-redbridge-direction.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseDirectionTables } from "./rb-direction-parse.mjs";
import { run, DIR_POLLSTER } from "./extract-redbridge-direction.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, ".build", "redbridge-src");
const STORE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), "utf8"));
const POLLS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));

// The three section-bearing waves the committed store records, keyed to
// their caches (the table numbers are print facts of the statements —
// change them here if a reissued statement re-flows, never in the parser).
const SECTION_WAVES = {
  "2025-11-13": "afr-redbridge-group-and-accent-research-november-2025-federal-poll",
  "2026-01-29": "afr,-redbridge-group-and-accent-research-january-2026-federal-poll",
  "2026-05-28": "afr,-redbridge-group-and-accent-research-may-2026-federal-poll",
};
const slack = (slug, ext) => path.join(SRC, `${slug}.${ext}`);
const parseCache = (slug) => parseDirectionTables(fs.readFileSync(slack(slug, "txt"), "utf8"));
const cacheRec = (slug) => JSON.parse(fs.readFileSync(slack(slug, "json"), "utf8"));

// ---- 1. the three section caches read as the committed store, figure for figure
{
  for (const [date, slug] of Object.entries(SECTION_WAVES)) {
    const want = STORE.waves[date];
    assert.ok(want, `fixture sanity: the committed store carries ${date}`);
    const p = parseCache(slug);
    assert.equal(p.section, true, `${slug}: section found (${p.guard ?? "no-section"})`);
    assert.deepEqual(p.total, want.total, `${date}: total`);
    assert.deepEqual(p.dims, want.dims, `${date}: dims`);
    const tables = p.tables.length === 1 ? `Table ${p.tables[0]}` : `Tables ${p.tables.join("–")}`;
    assert.deepEqual({ url: cacheRec(slug).pdfUrl, tables }, want.src, `${date}: src`);
  }
  // the committed all-voters totals reconcile with the direction rows
  for (const [date] of Object.entries(SECTION_WAVES)) {
    const row = POLLS.direction.find((d) => d.pollster === DIR_POLLSTER && d.date === date);
    assert.ok(row, `fixture sanity: a direction row sits on ${date}`);
    assert.deepEqual(STORE.waves[date].total, { r: row.right, w: row.wrong, u: row.unsure }, `${date}: total == direction row`);
  }
  console.log("1. committed caches == committed store: OK");
}

// ---- 2. every other committed statement cache parses section-less ---------
{
  const sectionSlugs = new Set(Object.values(SECTION_WAVES));
  const others = fs.readdirSync(SRC).filter((f) => f.endsWith("federal-poll.json"))
    .map((f) => f.replace(/\.json$/, "")).filter((s) => !sectionSlugs.has(s));
  assert.ok(others.length >= 6, "fixture sanity: several section-less statements on file");
  for (const slug of others)
    assert.equal(parseCache(slug).section, false, `${slug}: no direction section`);
  console.log(`2. ${others.length} section-less caches parse clean: OK`);
}

// ---- 3. integration: run() in a tmp sandbox -------------------------------
async function sandbox() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rbdir-test-"));
  const pollsPath = path.join(tmp, "polls.json"), storePath = path.join(tmp, "groups.json");
  fs.copyFileSync(path.join(ROOT, "data", "polls.json"), pollsPath);
  fs.copyFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), storePath);
  // the provenance migration must run whatever epoch the committed store is
  // in — seed the sandbox store with a legacy hand-entry provenance marker
  const seeded = JSON.parse(fs.readFileSync(storePath, "utf8"));
  seeded._about = "hand-entered legacy provenance (seeded by the test)";
  fs.writeFileSync(storePath, JSON.stringify(seeded));
  return { tmp, pollsPath, storePath };
}
{
  const { tmp, pollsPath, storePath } = await sandbox();
  const pollsBefore = fs.readFileSync(pollsPath, "utf8");
  const st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 0, `clean run: ${st.guard ?? ""}`);
  assert.equal(st.changed, true, "first run writes (the hand-entry _about moves to machine provenance)");
  assert.deepEqual([...st.filedRows, ...st.filedWaves], [], "every section wave reconciles against the committed record");
  const got = JSON.parse(fs.readFileSync(storePath, "utf8"));
  assert.deepEqual(got.waves, STORE.waves, "the tmp store reproduces the committed store wave for wave");
  assert.ok(!/hand-entered/.test(got._about), "the _about provenance now names the machine");
  assert.equal(fs.readFileSync(pollsPath, "utf8"), pollsBefore, "polls.json untouched when nothing files");
  const st2 = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st2.exit, 0, `idempotent re-run: ${st2.guard ?? ""}`);
  assert.equal(st2.changed, false, "a quiet re-run writes nothing");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("3. tmp-sandbox integration: OK");
}

// ---- 4. row filing: delete the May-2026 row; the run must re-file it byte-stably
{
  const { tmp, pollsPath, storePath } = await sandbox();
  fs.rmSync(storePath); // file both the row and the store wave fresh
  const D = JSON.parse(fs.readFileSync(pollsPath, "utf8"));
  D.direction = D.direction.filter((d) => !(d.pollster === DIR_POLLSTER && d.date === "2026-05-28"));
  fs.writeFileSync(pollsPath, JSON.stringify(D, null, 2) + (fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8").endsWith("\n") ? "\n" : ""));
  const st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 0, `row-filing run: ${st.guard ?? ""}`);
  assert.deepEqual(st.filedRows, ["2026-05-28"], "the missing May-2026 row files");
  assert.deepEqual(st.filedWaves.sort(), Object.keys(STORE.waves).sort(), "all three waves file into an empty store");
  const filed = JSON.parse(fs.readFileSync(pollsPath, "utf8"));
  const row = filed.direction.find((d) => d.pollster === DIR_POLLSTER && d.date === "2026-05-28");
  assert.ok(row, "the row is in polls.json");
  assert.deepEqual([row.dateStart, row.right, row.wrong, row.unsure], ["2026-05-25", 25, 63, 12], "with the statement's figures and window");
  const dates = filed.direction.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort(), "direction[] stays date-sorted");
  const text = fs.readFileSync(pollsPath, "utf8");
  assert.ok(!/\{\n\s+"alp": \d+,\n\s+"lnp": \d+,\n\s+"onp": \d+\n\s+\}/.test(text), "hand-entered tpp3 one-liners stay one-line");
  assert.ok(text.endsWith("\n"), "the trailing newline survives");
  // and the freshly filed store validates against its own reader next run
  const st2 = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st2.changed, false, "the re-run reconciles the freshly filed record");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("4. row + store filing: OK");
}

// ---- 5. guards: nothing ever writes on a guard ----------------------------
{
  const { tmp, pollsPath, storePath } = await sandbox();
  // (a) a drifted store shape
  fs.writeFileSync(storePath, JSON.stringify({ _about: "x", waves: [] }));
  let st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 2, "a drifted store shape guards");
  assert.match(st.guard, /store shape drifted/, st.guard);
  assert.equal(fs.readFileSync(storePath, "utf8"), JSON.stringify({ _about: "x", waves: [] }), "the drifted store is untouched");
  // (b) a tampered cache text (tmp srcDir: only the May wave, figure flipped)
  const src = path.join(tmp, "src");
  fs.mkdirSync(src, { recursive: true });
  const slug = SECTION_WAVES["2026-05-28"];
  fs.copyFileSync(slack(slug, "json"), path.join(src, `${slug}.json`));
  const txt = fs.readFileSync(slack(slug, "txt"), "utf8");
  fs.writeFileSync(path.join(src, `${slug}.txt`), txt.replaceAll(/All voters(\s+)25(\s+)63(\s+)12/g, "All voters$1 26$2 63$3 12"));
  fs.copyFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), storePath);
  st = await run({ pollsPath, storePath, srcDir: src, writeFiles: true });
  assert.equal(st.exit, 2, "a tampered cache text guards");
  assert.ok(st.guard, st.guard);
  assert.deepEqual(JSON.parse(fs.readFileSync(storePath, "utf8")).waves, STORE.waves, "the store is never rewritten on a guard");
  // (c) a filed store wave the cache no longer reproduces (a sum-preserving
  // tamper, so the shape gate passes and the recon compare is what bites)
  const s = JSON.parse(fs.readFileSync(storePath, "utf8"));
  s.waves["2026-05-28"].total.r = 26;
  fs.writeFileSync(storePath, JSON.stringify(s, null, 1) + "\n");
  st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 2, "recon drift guards");
  assert.match(st.guard, /no longer reads as the recorded store wave/, st.guard);
  assert.equal(JSON.parse(fs.readFileSync(storePath, "utf8")).waves["2026-05-28"].total.r, 26,
    "the store is never rewritten on a recon guard");
  // (d) a drifted committed direction row
  const D2 = JSON.parse(fs.readFileSync(pollsPath, "utf8"));
  D2.direction.find((d) => d.pollster === DIR_POLLSTER && d.date === "2026-05-28").wrong += 5;
  fs.writeFileSync(pollsPath, JSON.stringify(D2));
  fs.copyFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), storePath);
  st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 2, "a drifted direction row guards");
  assert.match(st.guard, /committed direction row/, st.guard);
  // (e) a row dated on a section-less wave
  const D3 = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  D3.direction.push({ date: cacheRec("afr-redbridge-group-and-accent-research-august-2026-federal-poll").date, dateStart: "2026-08-24", pollster: DIR_POLLSTER, right: 20, wrong: 60, unsure: 20 });
  fs.writeFileSync(pollsPath, JSON.stringify(D3));
  st = await run({ pollsPath, storePath, writeFiles: true });
  assert.equal(st.exit, 2, "a row on a section-less wave guards");
  assert.match(st.guard, /prints no direction section/, st.guard);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("5. guard trips: OK");
}

console.log("test-redbridge-direction: all OK");
