#!/usr/bin/env node
// Roy Morgan national-direction "Analysis by …" prose reader — banks each
// release's printed subpopulation splits (gender pair, voting-intention
// wrong-shares, state highest/lowest) into data/roymorgan-direction-groups.json,
// which gen-data §5 emits as the direction panel's group views.
//
// Sources: the VI extractor's committed release caches ONLY
// (.build/roymorgan-src/release-<slug>.json) — never a live fetch. A wave
// predating the cache horizon (or a healer-filed wave with no cache) is
// noted once and skipped, not chased. The national pair and fieldwork date
// come from the VI extractor's OWN parseRelease (RM_LIB mode) and must
// equal the wave's direction row in polls.json exactly — a drifted cache
// or row guards, never a silent rewrite. The group blocks themselves parse
// through rm-direction-parse.mjs (pinned by test-roymorgan-direction.mjs).
//
// Filing contract (same discipline as extract-roymorgan-demo.mjs):
//   * a release prints whichever block it prints (the fortnights
//     alternate: gender+vote, vote only, or state extremes only) — absence
//     is not an error;
//   * a block whose head anchor is present but unreadable is a GUARD
//     (layout change), nothing written that run;
//   * machine-filed waves re-parse every run and must reproduce the stored
//     entry figure for figure — drift is exit 2, never an overwrite;
//   * the store's own shape is validated at load: a drifted
//     data/roymorgan-direction-groups.json guards rather than being
//     silently reset (a torn read would re-file or overwrite the record).
//
// Contract: last stdout line RMDIR_STATUS {json}; exit 0 ok / 1 error /
// 2 guard trip (nothing written). --check computes, never writes.
// Pure text — no macOS dependency, so the CI twin of roymorgan-updater.sh
// files it too.
//
// Store shape: data/roymorgan-direction-groups.json
//   { _about, waves: { "2026-10-11": { slug,
//       gender?: { Men: {r,w}, Women: {r,w} },
//       vote?:   { "One Nation": {w}, "L-NP": {w}, Other: {w},
//                  Independent: {w}, Greens: {w}, ALP: {w, r} },
//       stateExtremes?: { highest: {state, w}, lowest: {state, w} } } } }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clean, writeAtomic } from "./extract-common.mjs";
import { parseDirectionGroups, VOTE_GROUPS, STATES_FULL } from "./rm-direction-parse.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);
const CHECK = process.argv.includes("--check");
export const DIR_POLLSTER = "Roy Morgan";

function defaultCtx() {
  return {
    pollsPath: path.join(ROOT, "data", "polls.json"),
    outPath: process.env.RMDIR_STORE || path.join(ROOT, "data", "roymorgan-direction-groups.json"),
    srcDir: process.env.RMDIR_SRC || path.join(ROOT, ".build", "roymorgan-src"),
    writeFiles: !CHECK,
  };
}

// key-order-insensitive compare (generated files reorder keys) — the recon
// equality check.
const canon = (o) => JSON.stringify(o, (k, v) =>
  (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };

// The store is this reader's own committed memory (see the header): a shape
// drift means a hand-edit or a torn write — guard, never silently reset.
function storeProblem(store) {
  if (!store || typeof store !== "object" || Array.isArray(store)) return "not an object";
  if (!store.waves || typeof store.waves !== "object" || Array.isArray(store.waves)) return "waves is not an object";
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const share = (v) => typeof v === "number" && v >= 0 && v <= 100;
  for (const [date, w] of Object.entries(store.waves)) {
    if (!iso.test(date)) return `a wave's date is off (${JSON.stringify(date)})`;
    if (!w || typeof w !== "object") return `wave ${date}: not an object`;
    if (typeof w.slug !== "string" || !w.slug) return `wave ${date}: no slug`;
    if (w.gender != null) {
      for (const g of ["Men", "Women"])
        if (!share(w.gender[g]?.w) || !share(w.gender[g]?.r)) return `wave ${date}: gender.${g} is off`;
    }
    if (w.vote != null) {
      for (const g of VOTE_GROUPS) {
        if (!share(w.vote[g]?.w)) return `wave ${date}: vote.${g} is off`;
        if (w.vote[g].r != null && !share(w.vote[g].r)) return `wave ${date}: vote.${g}.r is off`;
      }
    }
    if (w.stateExtremes != null) {
      for (const k of ["highest", "lowest"]) {
        const e = w.stateExtremes[k];
        if (!STATES_FULL.includes(e?.state) || !share(e?.w)) return `wave ${date}: stateExtremes.${k} is off`;
      }
    }
  }
  return null;
}

// One cache → the wave's store entry, or a guard string. `dirRow` is the
// wave's polls.json direction row (its national pair is the whole-wave
// checksum for the cache parse).
function entryOf(cache, dirRow, rel) {
  const r = rel.parseRelease(cache);           // the VI extractor's own parser
  if (r.date !== dirRow.date) return `cache's fieldwork end ${r.date} ≠ the direction row's ${dirRow.date}`;
  if (r.dirRight !== dirRow.right || r.dirWrong !== dirRow.wrong)
    return `cache's national pair ${r.dirRight}/${r.dirWrong} ≠ the direction row's ${dirRow.right}/${dirRow.wrong}`;
  const p = parseDirectionGroups(clean(cache.content));
  if (p.problems) return p.problems[0];
  const ks = Object.keys(p.groups);
  return ks.length ? { entry: { slug: rel.slug, ...p.groups } } : null;   // national pair only, no cuts printed
}

// ------------------------------------------------------------------- run
export async function run(overrides = {}) {
  const ctx = { ...defaultCtx(), ...overrides };
  const notes = [], filed = [];
  process.env.RM_LIB = "1";
  const rm = await import("./extract-roymorgan.mjs");
  const rel = { parseRelease: (post) => rm.parseRelease(post) };
  if (fs.existsSync(ctx.outPath)) {
    const bad = storeProblem(readJson(ctx.outPath, null));
    if (bad) return { guard: `direction-groups store shape drifted — ${bad}; refusing to read or rewrite it`, notes, exit: 2 };
  }
  const store = readJson(ctx.outPath, { waves: {} });
  store.waves ??= {};
  let changed = false;

  const P = readJson(ctx.pollsPath, { polls: [], direction: [] });
  const slugOf = new Map(P.polls.filter((p) => p.pollster === DIR_POLLSTER && p.url)
    .map((p) => [p.date, /\/findings\/([\w-]+)/.exec(p.url)?.[1]]).filter(([, s]) => s));
  const dirRows = (P.direction ?? []).filter((d) => d.pollster === DIR_POLLSTER);
  /* a pooled multi-wave release rides several rows with one slug — the
     late-January 2026 special prints the 2026-01-25 week's figures but
     three January rows carry its url. The committed cache parses to one of
     those weeks and can verify only that row; the rest are treated like
     waves without a cache (skipped, not guarded). */
  const slugDates = new Map();
  for (const d of dirRows) {
    const s = slugOf.get(d.date);
    if (!s) continue;
    const set = slugDates.get(s) ?? new Set();
    set.add(d.date);
    slugDates.set(s, set);
  }
  const sharedSlug = new Set([...slugDates].filter(([, ds]) => ds.size > 1).map(([s]) => s));
  let skippedNoCache = 0, skippedSharedWave = 0;
  for (const d of dirRows) {
    const slug = slugOf.get(d.date);
    const cache = slug && path.join(ctx.srcDir, `release-${slug}.json`);
    if (!slug || !fs.existsSync(cache)) { skippedNoCache++; continue; }
    const post = readJson(cache, null);
    if (!post || post.content == null)
      return { guard: `${slug}: committed cache unreadable — the wave's cuts can't be verified`, notes, exit: 2, filed };
    if (sharedSlug.has(slug) && rel.parseRelease(post).date !== d.date) { skippedSharedWave++; continue; }
    const got = entryOf(post, d, { ...rel, slug });
    if (typeof got === "string") return { guard: `${slug}: ${got}`, notes, exit: 2, filed };
    if (!got) {
      if (store.waves[d.date]) return { guard: `recon ${d.date}: the cache's group cuts are gone`, notes, exit: 2 };
      notes.push(`${slug}: national pair only — no group cuts printed this wave`);
      continue;
    }
    if (store.waves[d.date]) {
      if (canon(store.waves[d.date]) !== canon(got.entry))
        return { guard: `recon ${d.date}: the cache no longer reads as the recorded wave`, notes, exit: 2 };
      continue;
    }
    store.waves[d.date] = got.entry;
    changed = true;
    filed.push(d.date);
  }
  // date-ordered keys, so the committed diff is one hunk per new wave
  store.waves = Object.fromEntries(Object.entries(store.waves).sort(([a], [b]) => a.localeCompare(b)));
  store._about = "Roy Morgan's national-direction splits as printed in each fortnightly release's 'Analysis by …' prose – the gender pair, the voting-intention wrong-track shares (ALP carries its right-direction share too), and the state highest/lowest extremes (the full state direction table is paywalled; only the extremes print). Banked by .build/extract-roymorgan-direction.mjs from the committed release caches; the national pair in each cache is re-verified against the wave's direction row in polls.json every run. A release prints whichever blocks it prints – absent blocks are simply not on the record that fortnight. The direction panel's group select reads this via gen-data.";
  if (skippedNoCache) notes.push(`${skippedNoCache} Roy Morgan direction wave(s) predate the committed cache horizon – skipped`);
  if (skippedSharedWave) notes.push(`${skippedSharedWave} Roy Morgan direction wave(s) ride a pooled multi-wave release whose committed cache prints another week – skipped`);
  if (changed && ctx.writeFiles) writeAtomic(ctx.outPath, JSON.stringify(store, null, 1) + "\n");
  return { changed, filed, notes, exit: 0 };
}

// ------------------------------------------------------------------- CLI
if (!LIB_MODE) {
  (async () => {
    const st = await run();
    for (const n of st.notes ?? []) console.log("RMDIR_NOTE " + n);
    if (st.guard) console.error("RMDIR_GUARD " + st.guard);
    const { guard, ...rest } = st;
    if (guard) rest.guard = guard;
    console.log("RMDIR_STATUS " + JSON.stringify({ ...rest, changed: !!rest.changed }));
    process.exit(st.exit ?? (st.guard ? 2 : 0));
  })().catch((e) => {
    console.error("RMDIR_ERROR " + (e?.message || e));
    console.log("RMDIR_STATUS " + JSON.stringify({ changed: false, error: String(e?.message || e) }));
    process.exit(1);
  });
}
