#!/usr/bin/env node
// Roy Morgan "Primary Vote by State" / "Primary Vote by CITY/COUNTRY"
// table-image reader — fields the demographic tables the fortnightly
// releases began publishing on 29 Sep 2026 (finding 10363, the first ever
// to carry them), so the occasional demographic wave files itself instead
// of waiting on a ROYMORGAN_DEMO hand entry. The figures exist ONLY as
// pixels in the release page's two PNGs (the PDF they came from rides the
// findings payload's pdfDownload as an AccessDenied-private S3 object —
// tried 10363's), so this reads them with macOS Vision OCR
// (.build/ocr-image.swift [scale] [fast], through the RMD.OCR_LADDER
// rungs) and the pure parsers in
// rm-demo-parse.mjs (pinned by test-roymorgan-demo.mjs against the
// committed OCR reads). Writes data/roymorgan-demo.json, which
// demographics.mjs merges beneath ROYMORGAN_DEMO's hand-entered keys (a
// hand-entered date always wins) — after the model of
// extract-newspoll-quarterly.mjs and data/newspoll-quarterly.json.
//
// Candidates: every "Roy Morgan" poll row dated ≥ FIRST_WAVE. The release
// content comes from the VI extractor's committed cache
// (.build/roymorgan-src/release-<slug>.json), fetched live when the cache
// is absent (healer-filed rows) or unreadable (a corrupt cache is noted and
// re-fetched live, then parses through the normal gates); this extractor
// never writes that cache. A release whose content carries no caption
// files nothing and is remembered in store.none, so the slot doesn't
// re-check it every run — a genuine layout loss still surfaces, because
// the (c) findings-cache reminder in demo-watch.mjs reads the per-state
// subsample signature when fresh waves lack an entry. A release WITH
// captions whose tables don't parse is a GUARD (exit 2) — the layout
// changed, not a quiet fortnight — and so is a caption paired with an
// <img> the parser cannot resolve to a .png (a none-mark there would
// silence the wave permanently); caption prose with no <img> at all is a
// plain release and is remembered. A table whose OCR dropped a figure
// cell guards too: a complement is never computed (that's arithmetic on
// the other cells, not a printed figure). 10363's Vic Independents/Others
// cell is the proven OCR gap, which is why its wave stays hand-owned
// under ROYMORGAN_DEMO. A wave filing off ONE table (its partner's image
// unresolved) is noted — the city-TOTAL-vs-poll-row cross-check is
// vacated for that wave until both tables land. The store's own shape is
// validated at load: a drifted data/roymorgan-demo.json guards rather
// than being silently reset and rewritten.
//
// Tasmania (from finding 10366, 12 Oct 2026): a third table, "Primary
// Vote for Tasmania", printed as an HTML <table> on the page — read from
// the release content by parseTasTable, no OCR. It files as dims.state.Tas
// beside the fortnight's mainland states, though its base is a FOUR-week
// pool (n≈200) — the way the hand-entered four-weekly aggregates of Nov
// 2025–Feb 2026 already file their Tas cut; the wave records that base as
// `tas {dateStart, dateEnd, n}`. A Tasmania caption whose table doesn't
// read guards like a broken image table.
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
//                        dims: { state: { NSW: {…} … Tas? }, location: { "Capital
//                        cities": {…}, "Regional/rural areas": {…} } },
//                        tas? { dateStart, dateEnd, n } } ],
//     none: { <slug>: <iso day checked> } }
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchText, writeAtomic, TRACKER_UA } from "./extract-common.mjs";
import { tableImages, CAPTION_RES, SEEN_IMG_RE, parseStateTable, parseCityTable, parseTasTable, PARTIES, CITY_GROUP, REGION_GROUP } from "./rm-demo-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);

export const DEMO_POLLSTER = "Roy Morgan";
export const FIRST_WAVE = "2026-09-27";   // finding 10363's wave — the first release with the tables
export const RMD = {
  // Each table image is read rung by rung until one parses clean (no
  // dropped or colliding cell, TOTALs ≈100). Small PNGs lose figure cells
  // at native size, hence the upscale. .accurate leads: .fast dropped cells
  // in both of 10366's tables (12 Oct 2026: ALP WA, L-NP Regional, two
  // TOTALs) where .accurate read every one. .fast stays as the fallback for
  // the days .accurate's Neural Engine path wedges (e5rt error 13, seen
  // when this reader shipped 9 Oct) — a rung whose OCR fails steps down.
  OCR_LADDER: [{ scale: "3", mode: "accurate" }, { scale: "3", mode: "fast" }, { scale: "4", mode: "fast" }],
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
function ocrFile(bin, file, rung) {
  let why = "";
  const args = [file, rung.scale, ...(rung.mode === "fast" ? ["fast"] : [])];
  for (let i = 0; i < 3; i++) {
    const r = spawnSync(bin, args, { encoding: "utf8", timeout: 120_000 });
    if (r.status === 0) return JSON.parse(r.stdout);
    why = `${r.signal || "exit " + r.status}: ${(r.stderr || "").trim().slice(0, 160)}`;
  }
  throw new Error(`OCR (${rung.scale}x ${rung.mode}) failed on ${file} (${why})`);
}

// ------------------------------------------------------------ runtime deps
function defaultCtx() {
  // The image dir is made lazily — a run that OCRs nothing (a quiet
  // fortnight, a guard before any candidate) leaves no rmd-* dir behind —
  // and whatever was made is swept at every run() exit via tmpPath below.
  let tmp = null;
  const ensureTmp = () => (tmp ??= fs.mkdtempSync(path.join(os.tmpdir(), "rmd-")));
  // ocrImage(url, rung) — the image is downloaded once per run and read at
  // each rung the ladder asks for.
  const files = new Map();
  const ocrImage = process.platform === "darwin"
    ? async (url, rung = RMD.OCR_LADDER[0]) => {
      if (!files.has(url)) {
        const buf = Buffer.from(await (await fetch(url, { headers: { "user-agent": TRACKER_UA },
          signal: AbortSignal.timeout(60_000) })).arrayBuffer());
        const f = path.join(ensureTmp(), `img-${Math.abs([...url].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7))}.png`);
        fs.writeFileSync(f, buf);
        files.set(url, f);
      }
      return ocrFile(ocrBinary(), files.get(url), rung);
    }
    : null;
  return {
    pollsPath: path.join(ROOT, "data", "polls.json"),
    outPath: path.join(ROOT, "data", "roymorgan-demo.json"),
    demographicsPath: path.join(ROOT, "data", "demographics.json"),
    srcDir: path.join(ROOT, ".build", "roymorgan-src"),
    writeFiles: !process.argv.includes("--check"),
    todayIso: new Date().toISOString().slice(0, 10),
    tmpPath: () => tmp,   // null unless the OCR pass made its image dir; swept at every run() exit
    ocrImage,
    fetchPost: async (slug) => {
      process.env.RM_LIB = "1";
      const { nextData } = await import("./extract-roymorgan.mjs");
      const html = (await fetchText(`https://www.roymorgan.com/findings/${slug}`, { ua: TRACKER_UA })).text;
      return nextData(html, slug)?.props?.pageProps?.findingData?.postBy ?? null;
    },
  };
}

// readJson swallows a parse failure into the default — callers that need to
// KNOW a file was unreadable (contentOf, the store load) must compare
// against a sentinel default, never `?? dflt` a second fallback behind it.
const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };

// The release content: committed cache first, the live page when the cache
// is absent (healer-filed rows) or unreadable. A null always travels with
// a note — the candidate loop skips a contentless read WITHOUT remembering
// it, so a transient failure retries next run and a corrupt cache is
// re-fetched live once, not re-read silently forever.
async function contentOf(ctx, slug, notes) {
  const cache = path.join(ctx.srcDir, `release-${slug}.json`);
  if (fs.existsSync(cache)) {
    const hit = readJson(cache, null)?.content;
    if (hit != null) return hit;
    notes.push(`${slug}: committed cache unreadable — re-fetched live`);
  }
  try {
    const post = await ctx.fetchPost(slug);
    if (post?.content != null) return post.content;
    notes.push(`${slug}: the release page carries no content (layout drift?)`);
    return null;
  } catch (e) { notes.push(`${slug}: release page fetch failed (${String(e.message).slice(0, 120)})`); return null; }
}

// One table image through the OCR ladder: the first clean parse wins. When
// no rung reads clean, the first skeleton-matching parse comes back, so the
// filing gate names its dropped cells; null when no rung matched. A rung
// whose OCR fails steps down; only a ladder where every rung failed throws.
const cleanTable = (t) => !!t && !t.missing.length && !t.conflicts.length && t.totalOk;
async function readImage(ctx, url, parse) {
  let best = null, read = false, err = null;
  for (const rung of RMD.OCR_LADDER) {
    let t;
    try { t = parse(await ctx.ocrImage(url, rung)); read = true; } catch (e) { err = e; continue; }
    if (cleanTable(t)) return t;
    best ??= t;
  }
  if (!read) throw err;
  return best;
}

// Read one wave's tables end to end: caption → image → OCR → parse.
// Returns { total, dims, imgs } or null when no captions exist (a plain
// release). Throws on OCR/tool failures; null parses are reported through
// `problems` (a guard at filing, a recon surprise at re-read).
async function readTables(ctx, imgs, problems, tas = null) {
  if (tas?.error) problems.push(`the Tasmania table no longer parses (${tas.error})`);
  const tasT = tas && !tas.error ? tas : null;
  const stateT = imgs.state ? await readImage(ctx, imgs.state, parseStateTable) : null;
  if (imgs.state && !stateT) problems.push("the state table no longer parses");
  const cityT = imgs.city ? await readImage(ctx, imgs.city, parseCityTable) : null;
  if (imgs.city && !cityT) problems.push("the city table no longer parses");
  if (!stateT && !cityT && !tasT) return null;
  const dims = {};
  if (stateT) {
    dims.state = {};
    for (const st of stateT.states)
      dims.state[st] = Object.fromEntries(PARTIES.map((p) => [p, stateT.now[p][st]]));
  }
  if (tasT) (dims.state ??= {}).Tas = Object.fromEntries(PARTIES.map((p) => [p, tasT.now[p] ?? null]));
  if (cityT) dims.location = { [CITY_GROUP]: cityT.groups[CITY_GROUP], [REGION_GROUP]: cityT.groups[REGION_GROUP] };
  return { total: cityT ? cityT.total : null, dims, stateT, cityT, tasT };
}

// The filing path's whole-wave check: no dropped cells, no collisions, the
// printed TOTALs ≈ 100, every column sums ≈ 100, and the city table's TOTAL
// column equals the poll row's primaries. A string is a guard reason.
export function waveProblem(read, row) {
  for (const [name, t] of [["state", read.stateT], ["city", read.cityT], ["Tasmania", read.tasT]]) {
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
  if (read.tasT) {
    const s = PARTIES.reduce((a, p) => a + (read.tasT.now[p] ?? 0), 0);
    if (Math.abs(s - 100) > RMD.SUM_LIMIT) return `Tasmania table: the Now column sums ${+s.toFixed(1)}`;
    if (!read.tasT.period || !read.tasT.n) return "Tasmania table: its interviewing-dates line (period, n) doesn't read";
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

// The store is this reader's own committed memory; a shape drift means a
// hand-edit or a torn write, and reading on would file and reconcile
// against fantasy state — guard, never silently reset (re-reading a corrupt
// store as { waves: [], none: {} } would re-file old waves or overwrite the
// committed record on the next write). A string is a guard reason.
function storeProblem(store) {
  if (!store || typeof store !== "object" || Array.isArray(store)) return "not an object";
  if (!Array.isArray(store.waves)) return "waves is not an array";
  if (!store.none || typeof store.none !== "object" || Array.isArray(store.none)) return "none is not an object";
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const w of store.waves) {
    if (!w || typeof w !== "object") return "a wave is not an object";
    if (!iso.test(w.date ?? "")) return `a wave's date is off (${JSON.stringify(w.date)})`;
    if (typeof w.slug !== "string" || !w.slug) return `wave ${w.date}: no slug`;
    if (!w.dims || typeof w.dims !== "object" || Array.isArray(w.dims)) return `wave ${w.date}: dims is not an object`;
    if (w.total != null && (typeof w.total !== "object" || Array.isArray(w.total))) return `wave ${w.date}: total is off`;
    for (const k of ["stateImg", "cityImg"])
      if (w[k] != null && typeof w[k] !== "string") return `wave ${w.date}: ${k} is off`;
  }
  for (const [slug, day] of Object.entries(store.none))
    if (!iso.test(String(day))) return `none ${slug}: not an ISO day`;
  return null;
}

// ------------------------------------------------------------------- run
export async function run(overrides = {}) {
  const ctx = { ...defaultCtx(), ...overrides };
  const notes = [], filed = [], checkedNone = [];
  // Every exit sweeps the OCR temp dir — a guard trip leaks no rmd-* dir.
  // defaultCtx exposes it as a nullary function (lazily made, may be null);
  // a test harness hands a plain path string.
  const done = (r) => {
    const t = typeof ctx.tmpPath === "function" ? ctx.tmpPath() : ctx.tmpPath;
    if (t) try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* best-effort */ }
    return r;
  };
  if (fs.existsSync(ctx.outPath)) {
    const bad = storeProblem(readJson(ctx.outPath, null));
    if (bad) return done({ guard: `demo store shape drifted — ${bad}; refusing to read or rewrite it`, notes, exit: 2 });
  }
  const store = readJson(ctx.outPath, { waves: [], none: {} });
  store.waves ??= []; store.none ??= {};
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
    return done({ changed: false, filed, checkedNone, notes, exit: 0 });
  }

  // recon 1: machine-filed waves are re-read from their recorded images
  // and must re-parse to exactly what the store carries.
  for (const w of store.waves) {
    try {
      const problems = [];
      // a wave filed with Tasmania re-reads it from the release content
      let tas = null;
      if (w.dims?.state?.Tas) {
        const content = await contentOf(ctx, w.slug, notes);
        if (content == null) { notes.push(`recon ${w.date}: release content unavailable — recon skipped`); continue; }
        tas = parseTasTable(content) ?? { error: "the caption is gone" };
      }
      const again = await readTables(ctx, { state: w.stateImg, city: w.cityImg }, problems, tas);
      if (!again || problems.length)
        return done({ guard: `recon ${w.date}: source no longer parses (${problems.join("; ") || "no tables"})`, notes, exit: 2 });
      // every rung read short this run (.accurate wedged, .fast dropping a
      // cell): an OCR gap, not evidence the image moved — note, don't guard
      if ([again.stateT, again.cityT].some((t) => t && !cleanTable(t))) {
        notes.push(`recon ${w.date}: no OCR rung read the tables whole this run — recon skipped`);
        continue;
      }
      const dims = canon(w.dims) === canon(again.dims) && canon(w.total ?? null) === canon(again.total ?? null);
      if (!dims) return done({ guard: `recon ${w.date}: the images no longer read as the recorded wave`, notes, exit: 2 });
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
      const tas = content ? parseTasTable(content) : null;
      if (!imgs || (!imgs.state && !imgs.city && !tas)) continue;
      const problems = [];
      const mine = await readTables(ctx, imgs, problems, tas);
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
    if (content == null) continue;   // a read failure: noted inside contentOf, retried next run, never remembered
    const imgs = tableImages(content);
    const tas = parseTasTable(content);
    if (!imgs.state && !imgs.city && !tas) {
      // A caption with an <img> we cannot resolve (jpg, a moved src, …) is
      // the table layout having moved — guard, never remember: a blind
      // none-mark silences the wave for good (the 12-day Wikipedia
      // blindness class). Caption prose alone (no img) is a plain release.
      if ((CAPTION_RES.city.test(content) || CAPTION_RES.state.test(content)) && SEEN_IMG_RE.test(content))
        return done({ guard: `${slug}: table caption and an <img> but no table image resolved — the release layout shifted`, notes, exit: 2 });
      checkedNone.push(slug);
      changed = true;
      store.none[slug] = ctx.todayIso;
      continue;
    }
    if ((imgs.state || imgs.city) && (!imgs.state || !imgs.city))
      notes.push(imgs.city == null
        ? `${slug}: only the state table resolved — the city-TOTAL-vs-poll-row cross-check is vacated this wave`
        : `${slug}: only the city table resolved — the state column-sum checks are vacated this wave`);
    const problems = [];
    const read = await readTables(ctx, imgs, problems, tas);
    if (problems.length) return done({ guard: `${slug}: ${problems.join("; ")}`, notes, exit: 2 });
    const bad = read && waveProblem(read, p);
    if (bad) return done({ guard: `${slug}: ${bad}`, notes, exit: 2 });
    store.waves.push({
      date: p.date, slug,
      article: `https://www.roymorgan.com/findings/${slug}`,
      published: p.published ?? null,
      stateImg: imgs.state ?? null, cityImg: imgs.city ?? null,
      total: read.total, dims: read.dims,
      ...(read.tasT ? { tas: { ...read.tasT.period, n: read.tasT.n } } : {}),
    });
    store.waves.sort((a, b) => (a.date < b.date ? -1 : 1));
    changed = true;
    filed.push(`${DEMO_POLLSTER}|${p.date}`);
  }

  if (changed && ctx.writeFiles) {
    store._about = "Built by .build/extract-roymorgan-demo.mjs — Roy Morgan's Primary Vote by State / CITY-COUNTRY table images, read by macOS Vision OCR, and the Primary Vote for Tasmania HTML table (dims.state.Tas; a four-week pool, its base in `tas`). Machine-filed waves are re-read from their recorded images every run (drift = guard). Consumed by .build/demographics.mjs; ROYMORGAN_DEMO hand-entered keys win. `none` remembers releases checked and found to carry no tables.";
    writeAtomic(ctx.outPath, JSON.stringify(store, null, 2) + "\n");
  }
  return done({ changed, filed, checkedNone, notes, exit: 0 });
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
