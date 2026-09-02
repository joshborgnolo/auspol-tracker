#!/usr/bin/env node
/* ====================================================================
   CITATION CHECK — the link-rot sweep over the archive's outbound
   URLs. Spec: .build/citation-check-spec.md.

   Every poll row's citation is provenance, and nothing else verifies
   the unique URLs across polls[].url, polls[].releaseUrl,
   polls[].methodUrl and pollsterRules[].site. Status codes lie on this
   archive in both
   directions — News Corp's mastheads answer anonymous GETs with a
   crawler-bot block page (403 to an honest UA today; the "No Cookies"
   200 to browserish UAs), news24.com.au 404s walled-but-alive pages,
   skynews.com.au lives only inside a News24 redirect — so
   classification is rule-based per host, never status-only.

   Verdicts: ok | wall (indeterminate, never an alarm) | moved (final
   URL differs — the redirect-drift headline, not a failure) | gone |
   error (DNS/TLS/timeout/429 — transient, never gone). A cross-host
   redirect wins over a wall match at the destination: the skynews
   citations land on News24's cookie wall, and "this citation now
   resolves via 3 hops to a different host" is the signal worth paying
   attention to while the mapping still exists.

   READ-ONLY against data/polls.json. The agent proposes; a human
   disposes. State lives in data/link-health.json and is written ONLY
   when some entry's verdict, finalUrl, redirect count or intermediate
   hops change (or the URL set itself changes) — lastChecked never
   dirties the file, same rule np-score.mjs follows for its identity
   tuple.

   Exit classes (coverage-doctor.mjs conventions — check-coverage's
   `3` already means "actionable gap"; do not reuse it):

     0  no citation transitioned to gone
     1  INCONCLUSIVE — too many transient errors to judge (>20%)
     2  at least one URL went from ok/wall/moved to gone since the
        last run (a recorded-gone link staying gone does not re-fire)

   Usage:   node .build/check-citations.mjs
   Last stdout line: LINK_STATUS {json} — {verdict, checked, counts,
   newGone, newMoved}.

   Env seams (testing):
     CITATION_CHECK_ROOT        repo root (default: this file's repo root)
     CITATION_CHECK_POLLS       polls.json path
     CITATION_CHECK_STATE       link-health.json path
     CITATION_CHECK_DELAY_MS    inter-request delay (default 300)
     CITATION_CHECK_TIMEOUT_MS  per-hop fetch timeout (default 20000)
     CITATION_CHECK_429_BACKOFF_MS  retry wait after a 429 (default 5000)
     CITATION_CHECK_MAX         sweep only the first N URLs (smoke runs)
     CITATION_CHECK_WALL_JSON   replace the wall-rule table (json array)
   ==================================================================== */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CITATION_CHECK_ROOT ||
  fileURLToPath(new URL("../", import.meta.url));
const POLLS = process.env.CITATION_CHECK_POLLS || join(ROOT, "data/polls.json");
const STATE = process.env.CITATION_CHECK_STATE || join(ROOT, "data/link-health.json");
const DELAY_MS = Number(process.env.CITATION_CHECK_DELAY_MS ?? 300);
const TIMEOUT_MS = Number(process.env.CITATION_CHECK_TIMEOUT_MS ?? 20_000);
const BACKOFF_429_MS = Number(process.env.CITATION_CHECK_429_BACKOFF_MS ?? 5000);
const MAX = Number(process.env.CITATION_CHECK_MAX) || Infinity;
const ERROR_TOLERANCE = 0.2;
const MAX_HOPS = 10;
const UA = "auspol-citation-check (+https://github.com/joshborgnolo/auspol-tracker)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

/* --- the wall rules ---------------------------------------------------
   Title-based, so the fetch needs the first kilobytes of the body, not
   just headers. These are the same detections the newspoll and news24
   extractors already carry; the numbers that justified them are the
   spec's table. Each rule carries an optional expected status, an
   optional <title> regex, or any2xx — tests replace the whole table via
   CITATION_CHECK_WALL_JSON (fixture servers live on 127.0.0.1, and the
   rules key off hostnames). Evaluated against the FINAL response of the
   redirect chain. bodyRe sees the first 16KB of the body, so <title> is
   always in range — prefer a bodyRe that matches both of a wall's
   incarnations over two status-pinned rules when the wall page's STATUS
   is unstable (News Corp's is: a status-pinned rule silently matches
   nothing the week the wall re-skins). */
const WALL_RULES = JSON.parse(process.env.CITATION_CHECK_WALL_JSON || "null") || [
  // News Corp's mastheads answer an anonymous GET with their own block
  // page ("You might have been detected and blocked as a crawler bot!")
  // — 403 to an honest UA since at least 2026-09, 200 with a "No
  // Cookies" title to browserish UAs before that. The body string is
  // the constant across both, so key on it, never on the status
  { host: "theaustralian.com.au", bodyRe: "crawler bot|no cookies" },
  { host: "heraldsun.com.au", bodyRe: "crawler bot" },
  { host: "dailytelegraph.com.au", bodyRe: "crawler bot" },
  { host: "couriermail.com.au", bodyRe: "crawler bot" },
  { host: "thechronicle.com.au", bodyRe: "crawler bot" },
  { host: "news.com.au", bodyRe: "crawler bot" },
  { host: "news24.com.au", status: 404, titleRe: "nocookies" },
  { host: "skynews.com.au", status: 404, titleRe: "nocookies" },
  // Cloudflare's challenge shell ("Just a moment...") — thenewdaily's wall
  { host: "thenewdaily.com.au", titleRe: "^just a moment" },
  // a JS shell / access-denied view is byte-identical to the real thing;
  // nothing short of a logged-in session can tell, so a 2xx proves nothing
  { host: "x.com", any2xx: true },
  { host: "drive.google.com", any2xx: true },
];

function wallMatch(host, port, status, title, body) {
  // a rule host may pin a port ("127.0.0.1:8080" — the test seam); the live
  // table never does, so production matching is port-free hostname only
  const strip = (h) => h.replace(/^www\./, "");
  const h = strip(host);
  const hp = port ? `${h}:${port}` : h;
  for (const r of WALL_RULES) {
    const rh = strip(r.host);
    if (!(hp === rh || h === rh || h.endsWith("." + rh))) continue;
    if (r.any2xx && status >= 200 && status < 300) return r.host;
    if (r.status != null && status !== r.status) continue;
    if (r.titleRe != null && !new RegExp(r.titleRe, "i").test(title)) continue;
    if (r.bodyRe != null && !new RegExp(r.bodyRe, "i").test(body || "")) continue;
    if (r.status != null || r.titleRe != null || r.bodyRe != null) return r.host;
  }
  return null;
}

/* --- redirects --------------------------------------------------------
   `redirect: "follow"` collapses the chain; the hop count IS the drift
   signal, so follow manually. Range on every hop: we only classify from
   status + title and PDFs need a content-type, not a body.

   Every fetched URL is remembered in `visited` (original … terminal).
   When the chain runs more than one redirect, the INTERMEDIATE hops are
   written to the ledger as `hops`: the terminal hop of a walled chain is
   the wall endpoint (news24's /nocookies) but the FIRST hop's Location
   is the publisher's own 301 mapping — the rewrite candidate a human
   acts on. Recording only `finalUrl` throws exactly that hop away. */
async function readPrefix(res, max = 16384) {
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}

class CitationError extends Error {}

async function fetchFinal(url) {
  let current = url;
  const visited = [current];
  for (let hops = 0; hops <= MAX_HOPS; hops++) {
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": UA, range: "bytes=0-16383" },
      });
    } catch (e) {
      throw new CitationError(e.cause?.message || e.message || String(e));
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).href;
      visited.push(current);
      continue;
    }
    let type = res.headers.get("content-type") || "";
    // PDF identity comes from the header, not the magic bytes
    const body = /pdf/i.test(type) ? "" : await readPrefix(res);
    const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [null, ""])[1];
    return { status: res.status, finalUrl: current, redirects: hops, type, title, body, visited };
  }
  throw new CitationError(`too many redirects (>${MAX_HOPS})`);
}

/* moved = the URL that ultimately served differs from the one recorded,
   past benign normalisation (scheme upgrade, case, trailing slash).
   Compared on host+path+query, never fragment. */
function normUrl(u) {
  try {
    const p = new URL(u);
    const path = p.pathname.replace(/\/+$/, "") || "/";
    return `${p.hostname.toLowerCase()}${path}${p.search}`;
  } catch { return u; }
}

/* one retry on 429 before calling it an error */
async function fetchWithBackoff(url) {
  try {
    const got = await fetchFinal(url);
    if (got.status !== 429) return got;
  } catch (e) {
    if (!/429/.test(e.message)) throw e;
  }
  await sleep(BACKOFF_429_MS);
  return fetchFinal(url);
}

/* classify one URL against its fetched response */
function classify(url, got) {
  const fin = new URL(got.finalUrl);
  const wall = wallMatch(fin.hostname, fin.port, got.status, got.title, got.body);
  const hostMoved = normUrl(new URL(url).host) !== normUrl(new URL(got.finalUrl).host);
  // a wall match at ANY status is never an alarm — the page is alive
  // behind the wall; only the cross-host redirect refines it to moved
  if (wall) {
    if (hostMoved) return { verdict: "moved", note: `resolves via ${got.redirects} redirect(s) into the ${wall} wall` };
    return { verdict: "wall", note: `${wall} wall` };
  }
  if (got.status === 404 || got.status === 410) {
    return { verdict: "gone", note: `http ${got.status}` };
  }
  if (got.status >= 200 && got.status < 300) {
    if (/\.pdf(?:[?#]|$)/i.test(url) && !/pdf/i.test(got.type)) {
      // not proof of death — viewers and interstitials exist — so never gone
      return { verdict: "error", note: `expected pdf, got ${got.type || "unknown"}` };
    }
    if (normUrl(url) !== normUrl(got.finalUrl)) {
      return { verdict: "moved", note: `${got.redirects} redirect(s)` };
    }
    return { verdict: "ok", note: "" };
  }
  return { verdict: "error", note: `http ${got.status}` };
}

/* --- collect the sweep list -------------------------------------------- */
function collect() {
  const data = JSON.parse(readFileSync(POLLS, "utf8"));
  const byUrl = new Map(); // url -> {url, fields:Set}
  const add = (u, field) => {
    if (!u || typeof u !== "string") return;
    if (!byUrl.has(u)) byUrl.set(u, { url: u, fields: new Set() });
    byUrl.get(u).fields.add(field);
  };
  for (const p of data.polls || []) {
    add(p.url, "url");
    add(p.releaseUrl, "releaseUrl");
    add(p.methodUrl, "methodUrl");
  }
  // pollsterRules is an object keyed by pollster name
  for (const rule of Object.values(data.pollsterRules || {})) {
    if (rule && rule.site) add(rule.site, "site");
  }
  return [...byUrl.values()];
}

function emit(code, payload) {
  console.log(`LINK_STATUS ${JSON.stringify(payload)}`);
  process.exit(code);
}

async function main() {
  let targets = collect().slice(0, MAX === Infinity ? undefined : MAX);
  console.log(`citation-check: ${targets.length} unique URLs from ${POLLS}`);

  const prev = existsSync(STATE)
    ? new Map(JSON.parse(readFileSync(STATE, "utf8")).links.map((e) => [e.url, e]))
    : new Map();

  const entries = [];
  const counts = { ok: 0, wall: 0, moved: 0, gone: 0, error: 0 };
  for (const [i, t] of targets.entries()) {
    const stamp = today();
    let got = null, verdict = "error", note = "";
    try {
      got = await fetchWithBackoff(t.url);
      ({ verdict, note } = classify(t.url, got));
    } catch (e) {
      note = e.message;
    }
    // a transient error must not overwrite a verdict worth alarming on
    // later: carry the previous one forward and remember the failure
    const base = prev.get(t.url);
    const entry = {
      url: t.url,
      fields: [...t.fields].sort(),
      lastChecked: stamp,
      verdict: verdict === "error" && base && base.verdict !== "error" ? base.verdict : verdict,
      finalUrl: got ? got.finalUrl : base?.finalUrl || t.url,
      redirects: got ? got.redirects : base?.redirects ?? 0,
      status: got ? got.status : 0,
      note,
    };
    // intermediate hops only — original and terminal are url/finalUrl.
    // hops[0] is the publisher's own first Location: the rewrite candidate
    const via = got ? got.visited.slice(1, -1) : base?.hops || [];
    if (via.length) entry.hops = via;
    // lastError carries no timestamp so an identical outage is a stable
    // identity tuple — it is part of the change-detection below
    if (verdict === "error") entry.lastError = note;
    counts[verdict]++;
    entries.push(entry);
    const tag = verdict === "ok" ? "ok  " : verdict.toUpperCase();
    console.log(`citation-check: [${i + 1}/${targets.length}] ${tag} ${t.url}${note ? " — " + note : ""}`);
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  /* transitions: only an alive verdict falling to gone fires. moved counts
     as alive — a citation carried by a redirect chain dying unnoticed is
     exactly the failure this tool exists for. */
  const newGone = entries
    .filter((e) => {
      const was = prev.get(e.url);
      return e.verdict === "gone" && was && ["ok", "wall", "moved"].includes(was.verdict);
    })
    .map((e) => e.url);
  const newMoved = entries
    .filter((e) => {
      const was = prev.get(e.url);
      return e.verdict === "moved" && (!was || was.verdict !== "moved" || was.finalUrl !== e.finalUrl);
    })
    .map((e) => e.url);

  /* state writes are change-triggered, not run-triggered: compare the
     identity tuple (url set + per-entry verdict/finalUrl/redirects/hops/
     lastError) */
  const identity = (list) =>
    JSON.stringify(list.map((e) => [e.url, e.verdict, e.finalUrl, e.redirects, e.hops || [], e.lastError || ""]).sort());
  const prevList = [...prev.values()];
  const dirty = prevList.length !== entries.length || identity(prevList) !== identity(entries);
  if (dirty) {
    writeFileSync(STATE, JSON.stringify({ version: 1, generated: today(), links: entries }, null, 2) + "\n");
    console.log(`citation-check: state changed — wrote ${STATE}`);
  } else {
    console.log("citation-check: no state change — link-health.json untouched");
  }

  const status = {
    verdict: 0,
    checked: entries.length,
    counts,
    newGone,
    newMoved,
  };
  if (counts.error / entries.length > ERROR_TOLERANCE) {
    console.log(`citation-check: ${counts.error}/${entries.length} errored — inconclusive, not an alarm`);
    status.verdict = 1;
    emit(1, status);
  }
  if (newGone.length) {
    console.log(`citation-check: ${newGone.length} citation(s) newly gone`);
    status.verdict = 2;
    emit(2, status);
  }
  console.log(`citation-check: ok ${counts.ok}, wall ${counts.wall}, moved ${counts.moved}, gone ${counts.gone}, error ${counts.error}`);
  emit(0, status);
}

main().catch((e) => {
  console.error("citation-check: internal error: " + (e && e.message ? e.message : e));
  emit(1, { verdict: 1, reason: "internal error", error: String(e && e.message ? e.message : e) });
});
