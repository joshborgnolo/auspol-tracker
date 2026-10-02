#!/usr/bin/env node
/* healer.mjs — the layout healer's deterministic half.

   The failure this exists for: an upstream layout change whose page text is
   fine but whose anchors the extractor's parser no longer finds — the class
   that blinded both Wikipedia readers for twelve days in Sep 2026. The
   extractor's own answer is exit 2 ("a safety guard tripped — upstream
   layout changed; nothing is written"), which already reaches healer.yml's
   gate through the failed run's log.

   The loop, and who is allowed to do what:

     gate        (--gate) reads the failed run's downloaded Actions log and
                 reuses classify-failure.mjs verbatim. heal only when the
                 wrapper reports the extractor's "exit 2" — a guard trip.
                 Transient upstream failures, push races and dirty-tree
                 refusals are never healer work.
     evidence    (--fetch-evidence) re-fetches the live source into
                 .build/healer-src/evidence/<house>/ (gitignored): the
                 findings-search feed and release texts for Roy Morgan, the
                 raw wikitext for News24/Wikipedia. Shape-canary-guarded and
                 capped, so a flapping source wastes at most a bounded fetch.
     the agent   (healer.yml, not this script) is a headless matilda-code
                 session that reads the evidence files and writes candidate
                 rows to .build/healer-out/<house>.json. It has no git
                 credentials and touches no data file. Zero waves is a
                 successful, quiet outcome.
     acceptance  (--accept) decides what — if anything — becomes a commit
                 candidate. Three deterministic gates per wave, all of which
                 must pass:
                   1. the house's OWN guard function, imported from the
                      extractor (guardRelease / guard) — the healer must pass
                      the same checks the deterministic pipeline enforces;
                   2. dedupe against data/polls.json by (pollster, date);
                   3. the faithfulness firewall: every filed figure must
                      appear verbatim in the cached evidence text.
                 Accepted rows are inserted into data/polls.json (sorted,
                 atomic write, same shapes the extractors emit), the same
                 provenance sidecars as an extractor run are written beside
                 them, and a run proof lands in .build/healer-src/ for the
                 reviewer. healer.yml then commits row + proof + rebuilt
                 artifacts on a repair/healer-<house>-<run> branch and files
                 the review issue. Nothing here can reach main unreviewed.

   What it deliberately does NOT do: fix the parser (agent-repair.yml's
   job), derive series other than the VI row (altTpp/direction/leadership
   self-heal via the repaired extractor's existing wave-missed paths), or
   file provisional rows — the healer's output IS the canonical row, gated
   through human review.

   Usage:
     node .build/healer.mjs --gate --logdir <dir>
     node .build/healer.mjs --fetch-evidence --house roymorgan|news24 [--evidence-dir <dir>]
     node .build/healer.mjs --accept --house roymorgan|news24 [--out <file>] [--evidence-dir <dir>] [--polls <file>] [--check]

   Exit codes (the extractor contract, mirrored): 0 ok (changed or not);
   1 fetch/internal error; 2 the agent's output was malformed JSON — an
   acceptance-schema defect, never silently rescued.

   Env hooks: HEALER_WIKI_FILE reads the Wikipedia table from a local
   snapshot instead of fetching (mirrors N24_WIKI_FILE). */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchText, clean, TRACKER_UA, writeAtomic } from "./extract-common.mjs";
import { classify } from "./classify-failure.mjs";

const SRC_DIR = ".build/healer-src";
const EVIDENCE_ROOT = `${SRC_DIR}/evidence`; // gitignored — bulky fetched text
const OUT_ROOT = ".build/healer-out";
const POLLS = "data/polls.json";

const HOUSES = new Set(["roymorgan", "news24"]);

// Extractor mains run on import; their *_LIB envs turn them into libraries.
// Set the flag BEFORE the dynamic import, per house, on first use.
async function rmLib() {
  process.env.RM_LIB = "1";
  return import("./extract-roymorgan.mjs");
}
async function n24Lib() {
  process.env.N24_LIB = "1";
  return import("./extract-news24.mjs");
}

// ------------------------------------------------------------------- gate
// The "Show the updater log" step of poll-agent.yml tails .build/logs/*.log
// into the Actions log on every run, so the wrapper's FAIL lines survive in
// `gh run view --log[-failed]` output — behind a "<job>\t<step>\t<ISO>Z "
// prefix (and the odd ANSI code). Strip up to the first ISO timestamp.
const LOG_PREFIX = /^.*?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z /;
// …and the wrapper's own stamp inside the tail the log step echoes
// ("2026-10-02 00:12:44 FAIL extract (exit 2): …").
const WRAPPER_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /;

export function failLinesOf(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").replace(LOG_PREFIX, "").replace(WRAPPER_TS, "").replace(/\r$/, ""))
    .filter((l) => /^FAIL\b/.test(l));
}

/* The verdict that gates the whole healer. The FAIL line's "(exit N)" is the
   wrapper's own exit code (every wrapper re-exits with the extractor's
   code), so it stands in for classify()'s second argument. heal is ONLY the
   guard-trip kind: every other class is upstream noise, a race, or an opaque
   defect that belongs to agent-repair, not to wave-level first aid. */
export function gateVerdict(failLines) {
  const last = failLines[failLines.length - 1] ?? null;
  const exit = last ? Number(/\(exit (\d+)\)/.exec(last)?.[1] ?? 1) : 1;
  const verdict = classify(last ? [{ stamp: "", text: last }] : [], exit);
  return { heal: verdict.kind === "exit-2", exit, ...verdict };
}

function* walkFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else yield p;
  }
}

export function gateFromDir(dir) {
  let lines = [];
  if (existsSync(dir)) for (const f of walkFiles(dir)) lines = lines.concat(failLinesOf(readFileSync(f, "utf8")));
  return gateVerdict(lines);
}

// ------------------------------------------------------- faithfulness wall
// Sources print shares as "27%" / "27.5%" and samples as "1,501". The filed
// JSON number must match one of its printed forms — bare digits are NOT
// evidence (a day-of-month appears everywhere). This is the check an
// invented figure can never pass.
export function figureCandidates(v, kind) {
  if (kind === "sample") return [...new Set([String(v), Number(v).toLocaleString("en-US")])];
  return [...new Set([`${v}%`, `${Number(v).toFixed(1)}%`])];
}

export function unfaithfulFields(text, fields) {
  const miss = [];
  for (const f of fields)
    if (!figureCandidates(f.value, f.kind).some((c) => text.includes(c))) miss.push(`${f.name}=${f.value}`);
  return miss;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const DAY = 86400000;

// Mirrors the CMS-datetime conversion inline in extract-roymorgan.mjs's
// main (post.date, UTC → Australia/Melbourne "YYYY-MM-DDTHH:MM"). Kept in
// step by hand: the row's `published` must read exactly like an extractor
// row's, which is why the agent is never asked to supply it.
function melbournePublished(pd) {
  if (!pd) return null;
  const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(pd) ? pd : pd + "Z");
  if (isNaN(d)) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ------------------------------------------------------------ fetch evidence
const RM_FEED_PAGES = 2; // newest first; the wave that tripped the guard is recent
const RM_RECENT_DAYS = 21;
const RM_RELEASE_CAP = 4;

async function fetchRmEvidence(dir) {
  const rm = await rmLib();
  mkdirSync(dir, { recursive: true });
  const files = [];
  const manifest = { house: "roymorgan", fetched: new Date().toISOString(), feed: rm.FEED_DEFAULT, releases: [], feedError: null };
  let posts = [];
  try {
    for (let page = 1; page <= RM_FEED_PAGES; page++) {
      const { arr, totalPages } = await rm.fetchFeedPage(rm.FEED_DEFAULT, page);
      posts.push(...arr);
      if (!arr.length || (totalPages != null && page >= totalPages)) break;
    }
    writeFileSync(join(dir, "findings-feed.raw.json"), JSON.stringify(posts, null, 2) + "\n");
    files.push("findings-feed.raw.json");
  } catch (err) {
    // The endpoint itself changed or is down. The bare URL's raw answer is
    // the agent's only lead on where the feed went.
    manifest.feedError = String(err?.message || err);
    posts = [];
    try {
      const res = await fetch(`${rm.FEED_DEFAULT}?page=1`, { headers: { "user-agent": TRACKER_UA } });
      writeFileSync(join(dir, "findings-feed-raw.txt"), `HTTP ${res.status}\n\n${await res.text()}`);
      files.push("findings-feed-raw.txt");
    } catch (e2) {
      manifest.feedError += `; raw probe failed: ${e2?.message || e2}`;
    }
  }
  // Same filters as the extractor's candidate walk: the "Federal Poll"
  // topic plus the federal-voting-intention slug (specials stay out).
  const candidates = posts.filter((p) =>
    (!Array.isArray(p.topics) || p.topics.some((t) => t.name === "Federal Poll")) &&
    /federal-voting-intention/.test(p.slug || ""));
  const recent = candidates
    .filter((c) => {
      const iso = rm.dmyToIso(c.release_date);
      return iso && (Date.now() - Date.parse(iso)) / DAY <= RM_RECENT_DAYS;
    })
    .slice(0, RM_RELEASE_CAP);
  for (const c of recent) {
    const slug = c.slug;
    const url = `https://www.roymorgan.com/findings/${slug}`;
    const entry = { slug, url, releaseDateIso: rm.dmyToIso(c.release_date) ?? null, postDate: null, textFile: null };
    manifest.releases.push(entry);
    try {
      const { text } = await fetchText(url, { ua: TRACKER_UA });
      let post = null;
      try {
        post = rm.nextData(text, slug)?.props?.pageProps?.findingData?.postBy;
      } catch { /* payload moved — the raw page is still evidence */ }
      if (post?.content) {
        entry.postDate = post.date ?? null;
        entry.textFile = `rel-${slug}.txt`;
        writeFileSync(join(dir, `post-${slug}.json`), JSON.stringify(post, null, 2) + "\n");
        writeFileSync(join(dir, entry.textFile), clean(post.content) + "\n");
        files.push(`post-${slug}.json`, entry.textFile);
      } else {
        entry.textFile = `page-${slug}.html`;
        entry.note = "no findingData.postBy — release page structure changed";
        writeFileSync(join(dir, entry.textFile), text);
        files.push(entry.textFile);
      }
    } catch (err) {
      entry.error = String(err?.message || err);
    }
  }
  // Zero candidates (or a dead feed): the listing page is the fallback map.
  if (!posts.length || !candidates.length) {
    try {
      const { text } = await fetchText("https://www.roymorgan.com/findings", { ua: TRACKER_UA });
      writeFileSync(join(dir, "findings.html"), text);
      files.push("findings.html");
    } catch { /* best-effort probe */ }
  }
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  files.push("manifest.json");
  return files;
}

async function fetchN24Evidence(dir) {
  const n24 = await n24Lib();
  mkdirSync(dir, { recursive: true });
  const wikiText = process.env.HEALER_WIKI_FILE
    ? readFileSync(process.env.HEALER_WIKI_FILE, "utf8")
    : (await fetchText(n24.WIKI_RAW)).text;
  writeFileSync(join(dir, "wiki.txt"), wikiText);
  const manifest = { house: "news24", fetched: new Date().toISOString(), source: n24.WIKI_RAW, files: ["wiki.txt"] };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return ["wiki.txt", "manifest.json"];
}

// ---------------------------------------------------------------- accept
// Agent output: { waves: [...], notes?: string } in .build/healer-out/<house>.json.
// A missing file or an empty waves array is a quiet no-op, not an error.

const RM_REQUIRED = ["date", "dateStart", "sample", "alp", "lnp", "grn", "onp", "ind", "lib", "nat", "tpp_alp", "tpp_lnp"];

async function acceptRm({ llm, evidenceDir, D }) {
  const rm = await rmLib();
  const manifest = JSON.parse(readFileSync(join(evidenceDir, "manifest.json"), "utf8"));
  const bySlug = new Map((manifest.releases ?? []).map((r) => [r.slug, r]));
  const existing = new Set(D.polls.filter((p) => p.pollster === "Roy Morgan").map((p) => p.date));
  const out = { accepted: [], rejected: [], rows: [], sources: [], proofs: [] };
  const seen = new Set();
  for (const w of llm.waves) {
    if (!w || typeof w !== "object") { out.rejected.push({ wave: "?", reasons: ["not an object"] }); continue; }
    const slug = typeof w.slug === "string" ? w.slug : "?";
    const reject = (reasons) => out.rejected.push({ wave: slug, reasons: Array.isArray(reasons) ? reasons : [reasons] });
    const entry = bySlug.get(slug);
    if (!entry) { reject("slug not in the fetched evidence manifest — only waves whose releases were fetched this run may be filed"); continue; }
    if (!entry.textFile) { reject("no release text was fetched for this slug"); continue; }
    const bad = RM_REQUIRED.filter((k) => (k === "sample" ? !isNum(w[k]) : k.startsWith("date") ? !isDate(w[k]) : !isNum(w[k])));
    if (bad.length) { reject(`missing or invalid: ${bad.join(", ")}`); continue; }
    if (w.undecided != null && !isNum(w.undecided)) { reject("undecided not numeric"); continue; }
    if (w.tpp_flows != null && !isNum(w.tpp_flows)) { reject("tpp_flows not numeric"); continue; }
    if (existing.has(w.date) || seen.has(w.date)) { reject(`${w.date} already has a Roy Morgan row`); continue; }
    const record = {
      date: w.date, dateStart: w.dateStart,
      alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, lib: w.lib, nat: w.nat,
      undecided: w.undecided ?? null,
      tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp,
      tpp_flows: w.tpp_flows ?? null,
      tpp_flows_lnp: w.tpp_flows == null ? null : Math.round((100 - w.tpp_flows) * 10) / 10,
      tpp_onp: null, tpp_onp_onp: null, dirRight: null, dirWrong: null,
      sample: w.sample, missing: [],
    };
    const guardErrs = rm.guardRelease(record, slug, entry.releaseDateIso ?? null);
    if (guardErrs.length) { reject(guardErrs); continue; }
    const text = readFileSync(join(evidenceDir, entry.textFile), "utf8");
    const fields = [
      { name: "sample", value: w.sample, kind: "sample" },
      ...["alp", "lnp", "grn", "onp", "ind", "lib", "nat", "tpp_alp", "tpp_lnp"].map((n) => ({ name: n, value: w[n], kind: "pct" })),
      ...(w.undecided != null ? [{ name: "undecided", value: w.undecided, kind: "pct" }] : []),
      ...(w.tpp_flows != null ? [{ name: "tpp_flows", value: w.tpp_flows, kind: "pct" }] : []),
    ];
    const unfaith = unfaithfulFields(text, fields);
    if (unfaith.length) { reject([`figures not found verbatim in the release text: ${unfaith.join(", ")}`]); continue; }
    seen.add(w.date);
    out.rows.push({
      date: w.date,
      published: melbournePublished(entry.postDate) ?? null,
      dateStart: w.dateStart,
      pollster: "Roy Morgan",
      client: "—",
      sample: w.sample,
      ...(w.undecided != null ? { undecided: w.undecided } : {}),
      alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: null,
      tpp_alp: w.tpp_alp, tpp_lnp: w.tpp_lnp,
      ...(w.tpp_flows != null ? { tpp_flows: w.tpp_flows } : {}),
      lnpSplit: { Lib: w.lib, Nat: w.nat },
      url: entry.url,
    });
    out.accepted.push({ date: w.date, slug });
    // Same provenance sidecar the extractor commits for this release.
    const postJson = join(evidenceDir, `post-${slug}.json`);
    if (existsSync(postJson))
      out.sources.push({ file: `.build/roymorgan-src/release-${slug}.json`, json: readFileSync(postJson, "utf8") });
    out.proofs.push({ date: w.date, slug, url: entry.url });
  }
  return out;
}

const N24_CLIENTS = new Set(["News24", "Australia Inst."]);

async function acceptN24({ llm, evidenceDir, D }) {
  const n24 = await n24Lib();
  const text = readFileSync(join(evidenceDir, "wiki.txt"), "utf8");
  const existing = new Set(D.polls.filter((p) => p.pollster === "YouGov").map((p) => p.date));
  const out = { accepted: [], rejected: [], rows: [], sources: [], proofs: [] };
  const seen = new Set();
  for (const w of llm.waves) {
    if (!w || typeof w !== "object") { out.rejected.push({ wave: "?", reasons: ["not an object"] }); continue; }
    const reject = (reasons) => out.rejected.push({ wave: w.date ?? "?", reasons: Array.isArray(reasons) ? reasons : [reasons] });
    const errors = [];
    if (!isDate(w.date)) errors.push("date not ISO");
    if (!isDate(w.dateStart)) errors.push("dateStart not ISO");
    if (!isNum(w.sample)) errors.push("sample not numeric");
    if (!N24_CLIENTS.has(w.client)) errors.push(`client must be one of ${[...N24_CLIENTS].join(" / ")}`);
    for (const k of ["alp", "lnp", "grn", "onp", "ind", "oth"]) if (!isNum(w[k])) errors.push(`${k} not numeric`);
    if ((w.tpp_alp == null) !== (w.tpp_lnp == null)) errors.push("tpp pair must be both present or both absent");
    if (w.tpp_alp != null && (!isNum(w.tpp_alp) || !isNum(w.tpp_lnp))) errors.push("tpp pair not numeric");
    if (w.url != null && (typeof w.url !== "string" || !/^https:\/\//.test(w.url) || /wikipedia\.org/.test(w.url)))
      errors.push("url must be a real https citation, never a wikipedia.org mirror");
    if (errors.length) { reject(errors); continue; }
    if (existing.has(w.date) || seen.has(w.date)) { reject(`${w.date} already has a YouGov row`); continue; }
    const rec = {
      date: w.date, dateStart: w.dateStart, sample: w.sample, published: null,
      vi: { alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: w.oth, tpp_alp: w.tpp_alp ?? null, tpp_lnp: w.tpp_lnp ?? null },
    };
    // The exact guard call the extractor's Wikipedia fallback leg makes.
    const guardErrs = n24.guard(rec, { requirePublished: false, requireTpp: false, spanMin: 0 });
    if (guardErrs.length) { reject(guardErrs); continue; }
    const fields = [
      { name: "sample", value: w.sample, kind: "sample" },
      ...["alp", "lnp", "grn", "onp", "ind", "oth"].map((n) => ({ name: n, value: w[n], kind: "pct" })),
      ...(w.tpp_alp != null
        ? [{ name: "tpp_alp", value: w.tpp_alp, kind: "pct" }, { name: "tpp_lnp", value: w.tpp_lnp, kind: "pct" }]
        : []),
    ];
    const unfaith = unfaithfulFields(text, fields);
    if (unfaith.length) { reject([`figures not found verbatim in the wikitext: ${unfaith.join(", ")}`]); continue; }
    seen.add(w.date);
    out.rows.push({
      date: w.date, dateStart: w.dateStart,
      pollster: "YouGov", client: w.client, sample: w.sample,
      alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: w.oth,
      tpp_alp: w.tpp_alp ?? null, tpp_lnp: w.tpp_lnp ?? null,
      ...(w.url ? { url: w.url } : {}),
    });
    out.accepted.push({ date: w.date, client: w.client });
    // Same sidecar the extractor's fallback leg commits for a wiki wave.
    out.sources.push({
      file: `.build/news24-src/wiki-${w.date}.json`,
      json: JSON.stringify({
        source: "wikipedia", title: "Opinion_polling_for_the_next_Australian_federal_election",
        url: w.url ?? null, published: null,
        fieldwork: { date: w.date, dateStart: w.dateStart, sample: w.sample },
        vi: { alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: w.oth, tpp_alp: w.tpp_alp ?? null, tpp_lnp: w.tpp_lnp ?? null },
        satisfaction: null, ppm: null, altTpp: null, infogram: null,
        healer: true,
      }, null, 2) + "\n",
    });
    out.proofs.push({ date: w.date, url: w.url ?? null, client: w.client });
  }
  return out;
}

/* Apply one agent-output file. Returns the status object (also printed as
   HEALER_STATUS). Everything the run decided, on both sides of the line,
   lands in the proof file for the review issue. srcRoot exists so tests can
   point the writes at a temp tree; production leaves it at ".". */
export async function acceptRun(house, { outFile, evidenceDir, pollsPath = POLLS, check = false, runUrl = null, srcRoot = "." }) {
  const status = { phase: "accept", house, accepted: [], rejected: [], changed: false, check };
  if (!existsSync(outFile)) {
    status.note = "no agent output file — the agent filed nothing, a successful outcome";
    return status;
  }
  const llm = JSON.parse(readFileSync(outFile, "utf8")); // malformed JSON: caller turns this into exit 2
  if (!Array.isArray(llm.waves) || !llm.waves.length) {
    status.note = "the agent filed zero waves — nothing to accept, a successful outcome";
    status.agentNotes = llm.notes ?? null;
    return status;
  }
  const orig = readFileSync(pollsPath, "utf8");
  const D = JSON.parse(orig);
  const acc = house === "roymorgan" ? await acceptRm({ llm, evidenceDir, D }) : await acceptN24({ llm, evidenceDir, D });
  status.accepted = acc.accepted;
  status.rejected = acc.rejected;
  status.agentNotes = llm.notes ?? null;
  if (!acc.rows.length) return status;
  D.polls = [...D.polls, ...acc.rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = JSON.stringify(D, null, 2) + (orig.endsWith("\n") ? "\n" : "");
  status.changed = next !== orig;
  if (!status.changed || check) return status;
  writeAtomic(pollsPath, next);
  for (const s of acc.sources) {
    const target = join(srcRoot, s.file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, s.json);
  }
  const proof = {
    house, runUrl, filed: new Date().toISOString(),
    acceptance: "house guard functions imported from the extractor + (pollster,date) dedupe + every figure verbatim in the fetched evidence text",
    accepted: acc.proofs, rejected: acc.rejected,
    agentOutput: llm,
  };
  const key = acc.accepted.map((a) => a.date).join("+");
  const proofFile = `${SRC_DIR}/${house}-${key}-proof.json`;
  mkdirSync(join(srcRoot, SRC_DIR), { recursive: true });
  writeFileSync(join(srcRoot, proofFile), JSON.stringify(proof, null, 2) + "\n");
  status.proof = proofFile;
  return status;
}

// ------------------------------------------------------------------- entry
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, "/"));
if (isMain) {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

  if (argv.includes("--gate")) {
    const v = gateFromDir(arg("--logdir", "."));
    console.log("HEALER_GATE " + JSON.stringify(v));
    process.exit(0);
  }

  const house = arg("--house", "");
  if (!HOUSES.has(house)) {
    console.error(`healer: --house must be one of ${[...HOUSES].join(", ")}`);
    process.exit(2);
  }
  const evidenceDir = arg("--evidence-dir", join(EVIDENCE_ROOT, house));

  if (argv.includes("--fetch-evidence")) {
    try {
      const files = house === "roymorgan" ? await fetchRmEvidence(evidenceDir) : await fetchN24Evidence(evidenceDir);
      console.log("HEALER_STATUS " + JSON.stringify({ phase: "evidence", house, dir: evidenceDir, files }));
    } catch (err) {
      console.error("HEALER_ERROR " + (err?.message || err));
      console.log("HEALER_STATUS " + JSON.stringify({ phase: "evidence", house, error: String(err?.message || err) }));
      process.exit(1);
    }
    process.exit(0);
  }

  if (argv.includes("--accept")) {
    const outFile = arg("--out", join(OUT_ROOT, `${house}.json`));
    const runUrl = process.env.HEALER_RUN_URL || null;
    let status;
    try {
      status = await acceptRun(house, {
        outFile, evidenceDir,
        pollsPath: arg("--polls", POLLS),
        check: argv.includes("--check"),
        runUrl,
      });
    } catch (err) {
      console.error("HEALER_ERROR " + (err?.message || err));
      console.log("HEALER_STATUS " + JSON.stringify({ phase: "accept", house, error: String(err?.message || err) }));
      process.exit(2); // malformed agent output / acceptance-schema defect
    }
    console.log("HEALER_STATUS " + JSON.stringify(status));
    process.exit(0);
  }

  console.error("healer: one of --gate, --fetch-evidence, --accept is required");
  process.exit(2);
}
