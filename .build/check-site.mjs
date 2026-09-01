#!/usr/bin/env node
/* ====================================================================
   DEPLOYED-SITE CHECK — the watchdog for the last unwatched stage.

   Every other stage has a witness: extractors guard, validate.mjs guards
   the data, check-coverage.mjs witnesses coverage against Wikipedia,
   np-score.mjs scores the projection. Then build.mjs exits 0, the wrapper
   pushes, GitHub Pages builds — and nobody looks at what is SERVED. This
   script does. Spec: .build/site-check-spec.md.

   The core invariant: DEPLOYED BYTES EQUAL COMMITTED BYTES at the
   checked-out commit. The committed index.html IS the expected value —
   nothing is re-derived from data/polls.json (that would reimplement
   gen-data and recreate the mirror-drift this repo just finished
   deleting). Compare hashes; extract asset URLs; GET them.

   Exit classes (coverage-doctor.mjs conventions, not check-coverage's):

     0  deployed bytes == committed bytes for all five served files, and
        every assets/… reference in the deployed html resolves (200,
        non-empty).
     1  INCONCLUSIVE — the site could not be reached, DNS/TLS failed, the
        response was not html (except on the scheduled backstop — see
        class 2), or the local tree is dirty or ahead of origin/main and
        the comparison would lie. An unreachable host is not proof of a
        broken build while a deploy may be in flight; a watchdog that
        cries wolf gets muted.
     2  DEFECT — content mismatch after the grace window, a referenced
        asset missing, or (on the scheduled daily backstop only) the site
        unreachable: nothing is deploying then, so DNS/TLS/reachability
        failure no longer has a benign explanation. CI fails the job on
        this class only.

   Pages is asynchronous: a push to main deploys ~20–30 s later. On the
   workflow_run path (pinned to the deployed commit) a hash mismatch is
   retried with backoff for a grace window (default 5 min) before it is
   called; the daily backstop gets a short grace (30 s) since nothing
   should be mid-deploy.

   The other trap: main moves during the run. The workflow checks out
   `${{ github.event.workflow_run.head_sha }}` — the comparison is only
   meaningful against the commit Pages actually built.

   A DIRTY WORKING TREE MAKES THIS LIE. Outside CI the script refuses to
   run against a tree whose served files differ from HEAD: a 31-byte
   uncommitted rebuild once looked exactly like a stale deploy. So does a
   HEAD ahead of origin/main — Pages builds origin, so committed-but-
   unpushed bytes were never deployed; that case refuses identically.

   Deliberately NOT checked: whether the data is current
   (check-coverage.mjs owns that, with an independent witness), and
   anything rendered — the page is React over inlined data, so bytes and
   asset URLs only, never scraped strings.

   Usage:   node .build/check-site.mjs
   Last stdout line: SITE_STATUS {json} — {verdict, url, sha, liveBytes,
   localBytes, firstDiffAt, assets:{checked,failed:[]}} (+ file/reason
   where relevant).

   Env seams (testing):
     SITE_CHECK_URL       base URL to check      (default https://auspoltracker.com/)
     SITE_CHECK_ROOT      local checkout root    (default: this file's repo root)
     SITE_CHECK_GRACE_MS  mismatch grace window  (default 5 min on workflow_run, else 30 s)
     SITE_CHECK_SLEEP_MS  fixed retry interval   (default: 15/20/30/45/60 s backoff)
   ==================================================================== */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not URL.pathname: the working copy's path carries a space */
const ROOT = process.env.SITE_CHECK_ROOT ||
  fileURLToPath(new URL("../", import.meta.url));
const BASE = (process.env.SITE_CHECK_URL || "https://auspoltracker.com/")
  .replace(/\/+$/, "") + "/";
const FILES = ["index.html", "feed.xml", "sitemap.xml", "robots.txt", "auspol-polling.html"];
const EVENT = process.env.GITHUB_EVENT_NAME || "local";
const GRACE_MS = Number(process.env.SITE_CHECK_GRACE_MS) ||
  (EVENT === "workflow_run" ? 5 * 60_000 : 30_000);
/* On the daily backstop nothing is deploying, so an unreachable host has no
   benign explanation: TLS expiry, DNS breakage, the site down. Only the
   workflow_run path (Pages mid-build, previous deploy still serving) and
   ad-hoc local runs get to call unreachability inconclusive. */
const UNREACHABLE_CLASS = EVENT === "schedule" ? 2 : 1;
const FIXED_SLEEP = Number(process.env.SITE_CHECK_SLEEP_MS) || 0;
const BACKOFF = [15_000, 20_000, 30_000, 45_000, 60_000];
const FETCH_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function emit(code, extra = {}) {
  const status = {
    verdict: code, url: BASE, sha: headSha(),
    liveBytes: liveBytes("index.html"), localBytes: localBytes("index.html"),
    firstDiffAt: extra.firstDiffAt ?? null,
    assets: { checked: assetsChecked, failed: assetsFailed },
    ...extra,
  };
  console.log(`SITE_STATUS ${JSON.stringify(status)}`);
  process.exit(code);
}

/* the commit the comparison is being made against — unknown outside a repo */
function headSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return "unknown"; }
}

const locals = {};   // committed bytes per served file
const lives = {};    // last fetched live bytes per served file
let assetsChecked = 0;
let assetsFailed = [];
function liveBytes(f) { return lives[f] ? lives[f].length : null; }
function localBytes(f) { return locals[f] ? locals[f].length : null; }

/* byte offset of the first difference — the one number that turns
   "something is wrong" into a diagnosis */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? null : n;
}

class FetchFail extends Error {}

async function fetchBuf(path) {
  let res;
  try {
    res = await fetch(BASE + path, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": "auspol-site-check (github.com workflow)" },
    });
  } catch (e) {
    throw new FetchFail(e.cause?.message || e.message || String(e));
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get("content-type") || "", buf };
}

/* A dirty working tree makes every comparison lie: refuse outside CI.
   (Not-a-repo or no-git means there's nothing to guard — proceed.) */
function dirtyGuard() {
  if (process.env.GITHUB_ACTIONS) return;
  let dirty;
  try {
    dirty = execFileSync("git", ["diff", "--name-only", "HEAD", "--", ...FILES],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return; }
  if (!dirty) return;
  console.log(`site-check: refusing to compare against a dirty checkout — ` +
    `the comparison is only meaningful at a committed state:\n  ${dirty.split("\n").join("\n  ")}`);
  emit(1, { reason: "working tree dirty", dirty: dirty.split("\n") });
}

/* Committed-but-unpushed work is the same lie one step later: Pages builds
   origin/main, so a local HEAD even one commit ahead would be compared
   against bytes that were never deployed and read as a class-2 defect.
   Downgrade exactly the way the dirty case does. Skipped in CI, where the
   checkout is pinned to the deployed SHA by design. */
function aheadGuard() {
  if (process.env.GITHUB_ACTIONS) return;
  let ahead;
  try {
    ahead = Number(execFileSync("git", ["rev-list", "--count", "origin/main..HEAD"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch { return; } // no origin/main ref — nothing to guard
  if (!ahead) return;
  console.log(`site-check: HEAD is ${ahead} commit(s) ahead of origin/main — ` +
    `those bytes were never deployed, so any mismatch is spurious. Push, then re-run.`);
  emit(1, { reason: "ahead of origin/main", ahead });
}

async function main() {
  console.log(`site-check: ${BASE} vs ${ROOT} (${FILES.length} files, grace ${GRACE_MS / 1000}s)`);
  dirtyGuard();
  aheadGuard();
  for (const f of FILES) locals[f] = readFileSync(join(ROOT, f));

  /* 1 — reachable */
  let first;
  try {
    first = await fetchBuf("index.html");
  } catch (e) {
    console.log(`site-check: unreachable: ${e.message}` +
      (UNREACHABLE_CLASS === 2 ? " — scheduled backstop: nothing is deploying, this is an outage" : ""));
    emit(UNREACHABLE_CLASS, { reason: "unreachable", error: e.message });
  }
  if (first.status !== 200) {
    console.log(`site-check: HTTP ${first.status} — inconclusive, not a defect`);
    emit(1, { reason: `http ${first.status}` });
  }
  if (!/text\/html/i.test(first.type) || !first.buf.length) {
    console.log(`site-check: bad response (type "${first.type}", ${first.buf.length} bytes) — inconclusive`);
    emit(1, { reason: "not html" });
  }
  lives["index.html"] = first.buf;
  console.log(`site-check: reachable, ${first.buf.length} bytes`);

  /* 2+4 — freshness/integrity of every served file, with one shared grace
     window (Pages is asynchronous; a deploy finishing applies to all five) */
  const pending = new Set(FILES);
  const deadline = Date.now() + GRACE_MS;
  let attempt = 0;
  while (pending.size) {
    attempt++;
    for (const f of [...pending]) {
      let got;
      try { got = await fetchBuf(f); } catch (e) { got = { status: 0, buf: null, err: e.message }; }
      if (got.status === 200 && got.buf && got.buf.equals(locals[f])) {
        lives[f] = got.buf;
        pending.delete(f);
        console.log(`site-check: ${f} ok (${got.buf.length} bytes, attempt ${attempt})`);
        continue;
      }
      if (got.buf) lives[f] = got.buf;
      if (Date.now() >= deadline) {
        /* out of grace on this file: http failure reads as "missing served
           file"; byte mismatch carries the diagnosis offset */
        if (!got.buf) {
          console.log(`site-check: ${f}: no usable response after grace (${got.err || `http ${got.status}`})`);
          emit(2, { file: f, reason: `no usable response (${got.err || `http ${got.status}`})` });
        }
        const off = firstDiff(locals[f], got.buf);
        console.log(`site-check: ${f}: MISMATCH after ${GRACE_MS / 1000}s grace — ` +
          `local ${locals[f].length}b (sha ${sha256(locals[f]).slice(0, 12)}) vs ` +
          `live ${got.buf.length}b (sha ${sha256(got.buf).slice(0, 12)}), first diff at byte ${off}`);
        emit(2, { file: f, reason: "content mismatch after grace", firstDiffAt: off });
      }
      if (got.buf) {
        const off = firstDiff(locals[f], got.buf);
        console.log(`site-check: ${f}: mismatch (first diff at byte ${off}; local ${locals[f].length}b vs live ${got.buf.length}b) — inside grace, retrying`);
      } else {
        console.log(`site-check: ${f}: fetch failed (${got.err || `http ${got.status}`}) — inside grace, retrying`);
      }
    }
    if (!pending.size) break;
    if (Date.now() >= deadline) continue; // let the loop's deadline branch fire
    const wait = FIXED_SLEEP || BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)];
    await sleep(wait);
  }

  /* 3 — referenced assets resolve. index.html can be byte-perfect while a
     hashed asset it names was never emitted; cycle-source is fetched at
     runtime, so its absence breaks a whole tab while the page still loads.

     References are extracted from QUOTED contexts only — attributes, JS
     string literals, css url() — never bare text: the deployed page carries
     a source comment that merely MENTIONS "assets/np-project.js (the plain
     layer…)", and a bare regex once extracted that and phoned home a 404 on
     a file that is inlined by design. Found live, 2026-09-01, on this
     checker's first run against production. */
  const html = lives["index.html"].toString("utf8");
  const assets = new Set();
  // an optional ?query rides along (the og card's reference is cache-busted
  // "?v=date", and the reference as deployed is what must resolve)
  const REF = "assets\\/[\\w./-]+(?:\\?[^\\s\"'<>()\\]]*)?";
  for (const re of [
    new RegExp(`["'\`]([^"'\`\\n]{0,400}?${REF})["'\`]`, "g"), // quoted strings (attrs, JS literals)
    new RegExp(`url\\(\\s*["']?([^'"\\)\\s]*?${REF})["']?\\s*\\)`, "g"), // css url()
  ]) {
    let m;
    while ((m = re.exec(html))) assets.add(m[1].slice(m[1].lastIndexOf("assets/")));
  }
  const assetList = [...assets].sort();
  for (const a of assetList) {
    assetsChecked++;
    try {
      const got = await fetchBuf(a);
      if (got.status === 200 && got.buf.length > 0) {
        console.log(`site-check: asset ok  ${a} (${got.buf.length} bytes)`);
        continue;
      }
      console.log(`site-check: asset MISSING ${a} (http ${got.status}${got.buf.length ? "" : ", empty"})`);
    } catch (e) {
      console.log(`site-check: asset MISSING ${a} (${e.message})`);
    }
    assetsFailed.push(a);
  }
  if (assetsFailed.length) {
    emit(2, { reason: "referenced asset(s) missing" });
  }

  console.log(`site-check: deployed bytes match committed bytes; ${assetsChecked} asset(s) resolve`);
  emit(0);
}

main().catch((e) => {
  console.error("site-check: internal error: " + (e && e.message ? e.message : e));
  emit(1, { reason: "internal error", error: e && e.message ? e.message : String(e) });
});
