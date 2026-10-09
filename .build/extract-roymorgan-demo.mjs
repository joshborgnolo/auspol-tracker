#!/usr/bin/env node
// Roy Morgan "Primary Vote by State" / "Primary Vote by CITY/COUNTRY"
// table-image reader — fields the demographic tables the fortnightly
// releases began publishing on 29 Sep 2026 (finding 10363, the first ever
// to carry them), so the occasional demographic wave files itself instead
// of waiting on a ROYMORGAN_DEMO hand entry. The figures exist ONLY as
// pixels in the release page's two PNGs (the PDF they came from rides the
// findings payload's pdfDownload as an AccessDenied-private S3 object —
// tried 10363's), so this reads them with macOS Vision OCR
// (.build/ocr-image.swift [scale] [fast]) and the pure parsers in
// rm-demo-parse.mjs (pinned by test-roymorgan-demo.mjs against the
// committed OCR reads). Writes data/roymorgan-demo.json, which
// demographics.mjs merges beneath ROYMORGAN_DEMO's hand-entered keys (a
// hand-entered date always wins) — after the model of
// extract-newspoll-quarterly.mjs and data/newspoll-quarterly.json.
//
// Candidates: every "Roy Morgan" poll row dated ≥ FIRST_WAVE. The release
// content comes from the VI extractor's committed cache
// (.build/roymorgan-src/release-<slug>.json), fetched live when the cache
// is absent (healer-filed rows); this extractor never writes that cache. A
// release whose content carries no caption pair files nothing and is
// remembered in store.none, so the slot doesn't re-fetch it every run — a
// genuine layout loss still surfaces, because the (c) findings-cache
// reminder in demo-watch.mjs reads the per-state subsample signature when
// fresh waves lack an entry. A release WITH captions whose tables don't
// parse is a GUARD (exit 2) — the layout changed, not a quiet fortnight —
// and so is a table whose OCR dropped a figure cell: a complement is never
// computed (that's arithmetic on the other cells, not a printed figure).
// 10363's Vic Independents/Others cell is the proven OCR gap, which is why
// its wave stays hand-owned under ROYMORGAN_DEMO.
//
// recon 1: every wave THIS extractor filed is re-read from its recorded
// image URLs and re-parsed every run; drift is a guard (exit 2), never a
// rewrite. recon 2 (read-only): hand-owned waves on file in
// data/demographics.json get the machine read compared cell by cell — OCR
// gaps are skipped, disagreements surface as RMD_NOTE lines.
//
// Cross-checks at filing: the state table's printed TOTAL row ≈ 100 per
// state, the party column per state sums ≈ 100, the city table's TOTAL
// column ≈ 100 per group AND equals the poll row's primaries point for
// point (Roy Morgan's own row gets a free re-verification).
//
// Contract: last stdout line RMD_STATUS {json}; exit 0 ok / 1 fetch-parse
// error / 2 guard trip (nothing written). --check computes, never writes.
// macOS only — anywhere else this notes and exits 0 changed:false (the CI
// twin of roymorgan-updater.sh runs on ubuntu and must not die on a
// machine-learned table pass; the laptop's launchd copies run it).
//
// Store shape: data/roymorgan-demo.json
//   { _about, waves: [ { date, slug, article, published, stateImg, cityImg,
//                        total {alp,lnp,onp,grn,oth} | null,
//                        dims: { state: { NSW: {…} … }, location: { "Capital
//                        Cities": {…}, "Regional/Rural Areas": {…} } } } ],
//     none: { <slug>: <iso day checked> } }
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchText, writeAtomic, TRACKER_UA } from "./extract-common.mjs";
import { tableImages, parseStateTable, parseCityTable, PARTIES, CITY_GROUP, REGION_GROUP } from "./rm-demo-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);

export const DEMO_POLLSTER = "Roy Morgan";
export const FIRST_WAVE = "2026-09-27";   // finding 10363's wave — the first release with the tables
export const RMD = {
  OCR_SCALE: "3",                         // small PNGs lose figure cells at native size
  SUM_LIMIT: 1,                           // column sums and TOTAL rows sit within ±1 of 100
  ROW_LIMIT: 1,                           // the city table's TOTAL column vs the poll row
};

// key-order-insensitive compare for recon (generated files reorder keys).
const canon = (o) => JSON.stringify(o, (k, v) =>
  (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

// -------------------------------------------------------------- OCR (macOS)
const OCR_SRC = path.join(ROOT, ".build", "ocr-image.swift");
const OCR_BIN = path.join(os.homedir(), "Library/Caches/auspol-ocr/ocr-image");
function ocrBinary() {
  const stale = !fs.existsSync(OCR_BIN) || fs.statSync(OCR_BIN).mtimeMs < fs.statSync(OCR_SRC).mtimeMs;
  if (stale) {
    fs.mkdirSync(path.dirname(OCR_BIN), { recursive: true });
    execFileSync("swiftc", ["-O", OCR_SRC, "-o", OCR_BIN], { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 });
  }
  return OCR_BIN;
}
function ocrFile(bin, file) {
  let why = "";
  for (let i = 0; i < 3; i++) {
    const r = spawnSync(bin, [file, RMD.OCR_SCALE, "fast"], { encoding: "utf8", timeout: 120_000 });
    if (r.status === 0) return JSON.parse(r.stdout);
    why = `${r.signal || "exit " + r.status}: ${(r.stderr || "").trim().slice(0, 160)}`;
  }
  throw new Error(`OCR failed on ${file} (${why})`);
}

// ------------------------------------------------------------ runtime deps
function defaultCtx() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rmd-"));
  const ocrImage = process.platform === "darwin"
    ? async (url) => {
      const buf = Buffer.from(await (await fetch(url, { headers: { "user-agent": TRACKER_UA },
        signal: AbortSignal.timeout(60_000) })).arrayBuffer());
      const f = path.join(tmp, `img-${Math.abs([...url].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7))}.png`);
      fs.writeFileSync(f, buf);
      return ocrFile(ocrBinary(), f);
    }
    : null;
  return {
    pollsPath: path.join(ROOT, "data", "polls.json"),
    outPath: path.join(ROOT, "data", "roymorgan-demo.json"),
    demographicsPath: path.join(ROOT, "data", "demographics.json"),
    srcDir: path.join(ROOT, ".build", "roymorgan-src"),
    writeFiles: !process.argv.includes("--check"),
    todayIso: new Date().toISOString().slice(0, 10),
    ocrImage,
    fetchPost: async (slug) => {
      process.env.RM_LIB = "1";
      const { nextData } = await import("./extract-roymorgan.mjs");
      const html = (await fetchText(`https://www.roymorgan.com/findings/${slug}`, { ua: TRACKER_UA })).text;
      return nextData(html, slug)?.props?.pageProps?.findingData?.postBy ?? null;
    },
  };
}

const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };

// The release content: committed cache first, the live page when the row
// was filed without one. Returns null when neither yields content.
async function contentOf(ctx, slug, notes) {
  const cache = path.join(ctx.srcDir, `release-${slug}.json`);
  try {
    if (fs.existsSync(cache)) return readJson(cache, null)?.content ?? null;
  } catch { /* a corrupt cache reads as absent, tried live below */ }
  try {
    const post = await ctx.fetchPost(slug);
    return post?.content ?? null;
  } catch (e) { notes.push(`${slug}: release page fetch failed (${String(e.message).slice(0, 120)})`); return null; }
}

// Read one wave's tables end to end: caption → image → OCR → parse.
// Returns { total, dims, imgs } or null when no captions exist (a plain
// release). Throws on OCR/tool failures; null parses are reported through
// `problems` (a guard at filing, a recon surprise at re-read).
async function readTables(ctx, imgs, problems) {
  const ocrT = async (url) => (url ? ctx.ocrImage(url) : null);
  const stateT = imgs.state ? parseStateTable(await ocrT(imgs.state)) : null;
  if (imgs.state && !stateT) problems.push("the state table no longer parses");
  const cityT = imgs.city ? parseCityTable(await ocrT(imgs.city)) : null;
  if (imgs.city && !cityT) problems.push("the city table no longer parses");
  if (!stateT && !cityT) return null;
  const dims = {};
  if (stateT) {
    dims.state = {};
    for (const st of stateT.states)
      dims.state[st] = Object.fromEntries(PARTIES.map((p) => [p, stateT.now[p][st]]));
  }
  if (cityT) dims.location = { [CITY_GROUP]: cityT.groups[CITY_GROUP], [REGION_GROUP]: cityT.groups[REGION_GROUP] };
  return { total: cityT ? cityT.total : null, dims, stateT, cityT };
}

// The filing path's whole-wave check: no dropped cells, no collisions, the
// printed TOTALs ≈ 100, every column sums ≈ 100, and the city table's TOTAL
// column equals the poll row's primaries. A string is a guard reason.
export function waveProblem(read, row) {
  for (const [name, t] of [["state", read.stateT], ["city", read.cityT]]) {
    if (!t) continue;
    if (t.missing.length) return `${name} table: OCR missed figure cell(s) ${t.missing.join(", ")} — never completed from the row sum`;
    if (t.conflicts.length) return `${name} table: colliding figure cells on ${t.conflicts.join(", ")}`;
    if (!t.totalOk) return `${name} table: a printed TOTAL cell isn't ≈100`;
  }
  if (read.stateT) {
    for (const st of read.stateT.states) {
      const s = PARTIES.reduce((a, p) => a + (read.stateT.now[p][st] ?? 0), 0);
      if (Math.abs(s - 100) > RMD.SUM_LIMIT) return `state table: the ${st} column sums ${+s.toFixed(1)}`;
    }
  }
  if (read.cityT) {
    for (const [g, v] of Object.entries(read.cityT.groups)) {
      const s = PARTIES.reduce((a, p) => a + (v[p] ?? 0), 0);
      if (Math.abs(s - 100) > RMD.SUM_LIMIT) return `city table: the ${g} column sums ${+s.toFixed(1)}`;
    }
    if (row) {
      const prim = { ...row, oth: row.ind };
      for (const p of PARTIES) {
        const a = read.cityT.total[p], b = prim[p];
        if (a == null || b == null) continue;
        if (Math.abs(a - b) > RMD.ROW_LIMIT)
          return `city table's TOTAL ${p} ${a} against the poll row's ${b}`;
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------- run
export async function run(overrides = {}) {
  const ctx = { ...defaultCtx(), ...overrides };
  const store = readJson(ctx.outPath, { waves: [], none: {} });
  store.waves ??= []; store.none ??= {};
  const notes = [], filed = [], checkedNone = [];
  let changed = false;

  const polls = readJson(ctx.pollsPath, { polls: [] }).polls ?? [];
  const rows = polls.filter((p) => p.pollster === DEMO_POLLSTER && p.date >= FIRST_WAVE && p.url);
  const slugOf = (p) => /\/findings\/([\w-]+)/.exec(p.url)?.[1] ?? null;
  const demoFile = readJson(ctx.demographicsPath, { waves: [] });
  const handOwned = new Set((demoFile.waves ?? []).filter((w) => w.pollster === DEMO_POLLSTER).map((w) => w.date));

  // The OCR tool is the one hard capability; without a recogniser there is
  // nothing to verify against and nothing to file. Non-darwin is a note,
  // not an error (the CI twin must sail through).
  if (!ctx.ocrImage) {
    notes.push("no OCR on this platform (macOS Vision only) — the tables pass is a laptop job");
    return { changed: false, filed, checkedNone, notes, exit: 0 };
  }

  // recon 1: machine-filed waves are re-read from their recorded images
  // and must re-parse to exactly what the store carries.
  for (const w of store.waves) {
    try {
      const problems = [];
      const again = await readTables(ctx, { state: w.stateImg, city: w.cityImg }, problems);
      if (!again || problems.length)
        return { guard: `recon ${w.date}: source no longer parses (${problems.join("; ") || "no tables"})`, notes, exit: 2 };
      const dims = canon(w.dims) === canon(again.dims) && canon(w.total ?? null) === canon(again.total ?? null);
      if (!dims) return { guard: `recon ${w.date}: the images no longer read as the recorded wave`, notes, exit: 2 };
    } catch (e) { notes.push(`recon ${w.date}: ${String(e.message).slice(0, 120)}`); }
  }

  // recon 2 (read-only): hand-owned waves with table images get the machine
  // read compared against data/demographics.json; OCR gaps are skipped.
  for (const p of rows) {
    if (!handOwned.has(p.date) || store.waves.some((w) => w.date === p.date)) continue;
    const slug = slugOf(p);
    if (!slug) continue;
    try {
      const content = await contentOf(ctx, slug, notes);
      const imgs = content ? tableImages(content) : null;
      if (!imgs || (!imgs.state && !imgs.city)) continue;
      const problems = [];
      const mine = await readTables(ctx, imgs, problems);
      if (!mine || problems.length) { notes.push(`recon ${p.date}: the machine read failed — the hand entry carries the wave`); continue; }
      const onFile = (demoFile.waves ?? []).find((w) => w.pollster === DEMO_POLLSTER && w.date === p.date);
      const diffs = [];
      for (const [dim, groups] of Object.entries(mine.dims))
        for (const [g, shares] of Object.entries(groups))
          for (const [party, v] of Object.entries(shares)) {
            if (v == null) continue;
            const f = onFile?.dims?.[dim]?.[g]?.[party];
            if (f == null) diffs.push(`${dim} ${g} ${party}: the file has nothing`); // a hand dim the machine adds
            else if (Math.abs(f - v) > 0.01) diffs.push(`${dim} ${g} ${party}: OCR ${v} vs the file's ${f}`);
          }
      if (diffs.length) notes.push(`recon ${p.date}: ${diffs.length} cell(s) differ from the hand-entered wave (${diffs.slice(0, 3).join("; ")}${diffs.length > 3 ? "…" : ""})`);
    } catch (e) { notes.push(`recon ${p.date}: ${String(e.message).slice(0, 120)}`); }
  }

  // candidates: poll rows from the tables era, not machine-filed, not
  // hand-owned, not remembered as a plain release
  for (const p of rows) {
    if (store.waves.some((w) => w.date === p.date) || handOwned.has(p.date)) continue;
    const slug = slugOf(p);
    if (!slug) { notes.push(`${p.date}: no findings slug in ${p.url}`); continue; }
    if (store.none[slug]) continue;
    const content = await contentOf(ctx, slug, notes);
    if (content == null) continue;
    const imgs = tableImages(content);
    if (!imgs.state && !imgs.city) {
      checkedNone.push(slug);
      changed = true;
      store.none[slug] = ctx.todayIso;
      continue;
    }
    const problems = [];
    const read = await readTables(ctx, imgs, problems);
    if (problems.length) return { guard: `${slug}: ${problems.join("; ")}`, notes, exit: 2 };
    const bad = read && waveProblem(read, p);
    if (bad) return { guard: `${slug}: ${bad}`, notes, exit: 2 };
    store.waves.push({
      date: p.date, slug,
      article: `https://www.roymorgan.com/findings/${slug}`,
      published: p.published ?? null,
      stateImg: imgs.state ?? null, cityImg: imgs.city ?? null,
      total: read.total, dims: read.dims,
    });
    store.waves.sort((a, b) => (a.date < b.date ? -1 : 1));
    changed = true;
    filed.push(`${DEMO_POLLSTER}|${p.date}`);
  }

  if (changed && ctx.writeFiles) {
    store._about = "Built by .build/extract-roymorgan-demo.mjs — Roy Morgan's Primary Vote by State / CITY-COUNTRY table images, read by macOS Vision OCR. Machine-filed waves are re-read from their recorded images every run (drift = guard). Consumed by .build/demographics.mjs; ROYMORGAN_DEMO hand-entered keys win. `none` remembers releases checked and found to carry no tables.";
    writeAtomic(ctx.outPath, JSON.stringify(store, null, 2) + "\n");
  }
  return { changed, filed, checkedNone, notes, exit: 0 };
}

async function main() {
  const r = await run();
  for (const n of r.notes ?? []) console.log(`RMD_NOTE ${n}`);
  if (r.guard) {
    console.error(`RMD_GUARD ${r.guard}`);
    console.log(`RMD_STATUS ${JSON.stringify({ changed: false, guard: r.guard, notes: r.notes })}`);
    return r.exit ?? 2;
  }
  console.log(`RMD_STATUS ${JSON.stringify({ changed: r.changed, filed: r.filed, checkedNone: r.checkedNone, notes: r.notes })}`);
  return r.exit ?? 0;
}

if (!LIB_MODE) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`RMD_ERROR ${String(e?.stack || e).slice(0, 400)}`);
    console.log(`RMD_STATUS ${JSON.stringify({ changed: false, error: String(e.message || e).slice(0, 200) })}`);
    process.exit(1);
  });
}
