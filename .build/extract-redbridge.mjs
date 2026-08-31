// Extract AFR / RedBridge Group / Accent Research monthly federal polls from
// accent-research.com into data/polls.json (+ companion ppm / approval /
// altTpp rows). Written to the same automation contract as
// extract-demosau.mjs — see its header for the shared conventions.
//
// DISCOVERY (server-side, no browser): the Wix sitemap index exposes
//   https://www.accent-research.com/dynamic-projects_*_sitemap.xml
// listing every /projects/<slug> page. Monthly federal polls match
//   /projects/afr%2C-redbridge-group-and-accent-research-(<month>-<yyyy>-)?federal-poll
// which also EXCLUDES by construction: state polls ("…-victorian-state-poll",
// "…-queensland-state-poll"), snapshots ("…-victorian-public-opinion-snapshot"),
// the MRP releases ("a-fragmented-electorate", May 2026 — tracked separately
// with the "(MRP)" pollster suffix and out of scope here), the trend report
// ("australian-financial-review%2C-redbridge-group-…"), and campaign-track
// pages. The one month-less slug ("…-federal-poll", the Dec 2025 wave) is
// accepted; its wave month is taken from the PDF, not the URL.
//
// PROJECT PAGE (Wix Thunderbolt SPA — curl gets only the shell): each page is
// client-rendered and its PDF lives behind a file-upload viewer widget that
// constructs the usrfiles.com URL ONLY when clicked (the URL appears in
// neither the SSR HTML, the hydrated DOM, nor the siteassets JSONs — verified
// 2026-08-29). So the page is rendered in headless Chrome driven over raw
// CDP (node ≥22 global WebSocket — no npm dependencies, Chrome is spawned
// per wave on an OS-assigned debug port and killed afterwards). The page also
// yields the publication date line ("2 August 2026") and the link to the AFR
// coverage, which is preferred over the PDF as the row's `url` (Feb 2026 is
// the only committed row citing the usrfiles PDF directly).
//
// AFR TOPIC-PAGE CROSS-CHECK (added Aug 2026): AFR publishes each wave's
// coverage on release Sunday 18:00, but the accent-research.com project
// page + PDF can lag by days — sitemap discovery alone missed the 30 Aug
// 2026 wave. Main() additionally fetches the AFR RedBridge-Accent topic
// page (AFR_TOPIC) and reports articles dated after the latest committed
// wave's published date in RB_STATUS.afrTopicNotes. Detection only: the
// article body is trimmed behind AFR's paywall for automation, so figures
// still come from the Accent PDF (or manual ingest, as this wave was).
//
// PDF (40MB+, 130+ pages, poppler pdftotext -layout): every figure the
// tracker needs is a LIVE-TEXT TABLE — no OCR required:
//   - Methodology (internal p1): fieldwork line "conducted between Monday 27
//     July and Thursday 30 July 2026", sample "N = 1,001".
//   - Table N "Federal vote intention … by wave" (wave history, descending):
//     ALP / Coalition / One Nation / Greens / Other primaries plus three TPP
//     flavours — vs-Coalition 2025-flows, vs-Coalition respondent-allocated,
//     vs-One-Nation respondent-allocated. Current wave = first row.
//     `tpp_alp`/`tpp_lnp` = RESPONDENT-ALLOCATED vs-Coalition (matches every
//     committed row; Jul 2026 = 48/52, not the 50/50 headline). The vs-ON
//     value feeds altTpp.alpVsOnp_alp; "-" before Dec 2025.
//   - Table N "Favourability ratings and name recognition of political
//     figures": per-leader wave rows (very/mostly favourable, neither,
//     mostly/very unfavourable, not sure, not heard, NET). Tracker approval
//     rows store the NET (RedBridge "approval" is a favourability question —
//     see metricRules); detail.app/dis = (very+mostly) / (unfavourable pair)
//     computed from the same row. NOTE: the committed Jul 2026 detail
//     (alb 40/59, opp 30/36, han 40/50) matches NO transform of its Table-5
//     row (30/49, 20/26, 36/46) — origin unknown, possibly eyeballed from
//     Figure 5. The extractor recomputes detail consistently from the table;
//     verification therefore reports Jul-2026 detail as a mismatch note but
//     never overwrites it.
//   - Table N "Preferred Prime Minister, by demographic characteristics":
//     header names give the opposition leader (column between "Albanese" and
//     "Pauline Hanson" — Angus Taylor in the current era); the "All voters"
//     row gives alb / opp / han three-way PPM.
//   Leader identity caveat: the PM surname ("Albanese") and third-party
//   leader ("Pauline Hanson") are looked up literally in the PPM header —
//   if the cast changes the extractor guards fail loudly rather than
//   misfiling a row.
//
// ROW CONVENTIONS (verified against the 15 committed RedBridge rows):
//   pollster "RedBridge / Accent" (AFR-commissioned; "Redbridge" is used for
//   other clients and never collides here), firm = same in companion
//   sections; client "AFR"; date = fieldwork END, dateStart = start;
//   published = AFR embargo date with hour pinned "T18:00" (observed
//   18:00/20:00 in committed rows — verification compares the date part
//   only); "Other parties and candidates" → ind with oth: null; no
//   `undecided` key (committed AFR rows omit it); rows sorted by date in
//   every section (validate.mjs enforces polls order).
//
// Provenance: parsed metrics cache to .build/redbridge-src/<slug>.json and
// the pdftotext output to <slug>.txt (the 40MB PDFs themselves are NOT
// kept). Cached waves are never re-downloaded unless --force. Existing
// (firm,date) rows are NEVER overwritten — matches are verified field by
// field and divergences reported in RB_STATUS.mismatches.
//
// Usage: node .build/extract-redbridge.mjs [--check] [--force] [sitemap-url]
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line `RB_STATUS {json}`
//   - exit 1 = fetch/parse error; exit 2 = safety guard tripped (upstream
//     format changed or implausible numbers) — nothing is written
//   - --check computes everything, prints RB_STATUS, never writes
//   - writes are atomic (.tmp + rename)
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FORCE = argv.includes("--force");
const SITEMAP_INDEX = argv.find((a) => !a.startsWith("--")) || "https://www.accent-research.com/sitemap.xml";
const OUT = "data/polls.json";
const SRC_DIR = ".build/redbridge-src";
const POLLSTER = "RedBridge / Accent";
const CYCLE_START = "2025-05-04";
const FETCH_TIMEOUT_MS = 60_000;
const PDF_TIMEOUT_MS = 180_000;
const FETCH_TRIES = 3;
const CHROME = process.env.RB_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE_SLUG_RE = /^\/projects\/afr%2C-redbridge-group-and-accent-research-(?:([a-z]+)-(\d{4})-)?federal-poll$/i;
// AFR's RedBridge-Accent poll topic page. AFR publishes each wave's coverage
// SUNDAY EVENING, while the accent-research.com project page + PDF can lag
// by days (August 2026: article out 30 Aug, no Accent slug yet) — so the
// sitemap alone misses fresh waves. The cross-check below surfaces them.
const AFR_TOPIC = process.env.RB_AFR_TOPIC || "https://www.afr.com/topic/redbridge-accent-poll-6ikd";

// ---------------------------------------------------------------- fetching
async function fetchBuffer(url, timeoutMs = FETCH_TIMEOUT_MS) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker data update)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- headless chrome
function launchChrome() {
  return new Promise((resolve, reject) => {
    const prof = mkdtempSync(join(tmpdir(), "redbridge-chrome-"));
    const child = spawn(CHROME, [
      "--headless=new", "--no-first-run", "--disable-extensions",
      "--remote-debugging-port=0", `--user-data-dir=${prof}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let buf = "", settled = false;
    const to = setTimeout(() => { if (!settled) { settled = true; child.kill("SIGKILL"); reject(new Error("chrome: DevTools ws line not seen within 30s")); } }, 30_000);
    child.stderr.on("data", (c) => {
      buf += c;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m && !settled) { settled = true; clearTimeout(to); resolve({ child, wsUrl: m[1], prof }); }
    });
    child.on("error", (e) => { if (!settled) { settled = true; clearTimeout(to); reject(new Error(`chrome spawn: ${e.message}`)); } });
    child.on("exit", (code) => { if (!settled) { settled = true; clearTimeout(to); reject(new Error(`chrome exited early (${code})`)); } });
  });
}

// Minimal CDP client over node's global WebSocket: request/response by id,
// plus a buffered event stream that waitEvent() scans (buffer first, then
// live) so events fired between steps are never missed.
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 0;
    const pending = new Map();
    const buffer = [];
    const waiters = [];
    ws.onmessage = (me) => {
      let msg;
      try { msg = JSON.parse(me.data); } catch { return; }
      if (msg.id != null && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message || JSON.stringify(msg.error))) : p.res(msg.result ?? {});
      } else if (msg.method) {
        buffer.push(msg);
        if (buffer.length > 8000) buffer.shift();
        for (let i = waiters.length - 1; i >= 0; i--) {
          if (waiters[i].pred(msg)) {
            clearTimeout(waiters[i].to);
            waiters[i].res(msg);
            waiters.splice(i, 1);
          }
        }
      }
    };
    ws.onopen = () => resolve({
      send: (method, params = {}, sessionId) => new Promise((res, rej) => {
        const id = ++nextId;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
      waitEvent: (pred, timeoutMs, what) => {
        const hit = buffer.find(pred);
        if (hit) return Promise.resolve(hit);
        return new Promise((res, rej) => {
          const w = { pred, res, to: null };
          w.to = setTimeout(() => {
            const i = waiters.indexOf(w);
            if (i >= 0) waiters.splice(i, 1);
            rej(new Error(`timeout waiting for ${what}`));
          }, timeoutMs);
          waiters.push(w);
        });
      },
      close: () => { try { ws.close(); } catch {} },
    });
    ws.onerror = () => reject(new Error("CDP websocket connect failed"));
  });
}

const PDFISH = /\.pdf($|\?)/i;

// Render a project page, click the file-upload viewer, and capture the
// usrfiles PDF URL (new tab, redirect, or in-page request). Returns the PDF
// URL plus the hydrated page text and outgoing links.
async function scrapeProjectPage(url) {
  const { child, wsUrl, prof } = await launchChrome();
  let cdp = null;
  try {
    cdp = await connectCdp(wsUrl);
    await cdp.send("Target.setDiscoverTargets", { discover: true });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Page.navigate", { url }, sessionId);
    const isPdfEvent = (e) =>
      ((e.method === "Target.targetCreated" || e.method === "Target.targetInfoChanged") && PDFISH.test(e.params?.targetInfo?.url || "")) ||
      (e.method === "Page.frameNavigated" && PDFISH.test(e.params?.frame?.url || "")) ||
      (e.method === "Network.requestWillBeSent" && PDFISH.test(e.params?.request?.url || "") && /usrfiles\.com|\/ugd\//i.test(e.params.request.url));
    const evUrl = (e) =>
      e.method === "Network.requestWillBeSent" ? e.params.request.url
      : e.method === "Page.frameNavigated" ? e.params.frame.url
      : e.params.targetInfo.url;

    const dbg = (...a) => { if (process.env.RB_DEBUG) console.error("[rb-debug]", ...a); };
    let found = false;
    for (let i = 0; i < 25 && !found; i++) {
      await sleep(2000);
      const r = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `!!document.querySelector('[data-hook="file-upload-viewer"] button')`,
      }, sessionId);
      if (r.result?.value === true) found = true;
    }
    if (!found) throw new Error("viewer button never appeared (page structure changed?)");

    // 1) the viewer is often an <a href> directly to the PDF once hydrated —
    //    no click needed; also the most reliable source
    const domRes = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `JSON.stringify([...document.querySelectorAll('[data-hook="file-upload-viewer"] a, [data-hook="file-upload-viewer"] iframe')].map((e) => e.href || e.src || null).filter(Boolean))`,
    }, sessionId);
    const viewerUrls = JSON.parse(domRes.result?.value || "[]");
    dbg("viewer dom urls:", viewerUrls);
    let pdfUrl = viewerUrls.find((u) => PDFISH.test(u)) || null;

    // 2) otherwise click: real coordinates via Input.dispatchMouseEvent
    //    (trusted gesture, so a window.open popup is allowed); a synthetic
    //    .click() fallback keeps the old path for JS handlers that don't
    //    need trust
    for (let attempt = 0; attempt < 3 && !pdfUrl; attempt++) {
      const boxRes = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => { const b = document.querySelector('[data-hook="file-upload-viewer"] button'); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
      }, sessionId);
      const pt = boxRes.result?.value;
      dbg("attempt", attempt + 1, "click point", pt);
      if (pt) {
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 }, sessionId);
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 }, sessionId);
      } else {
        await cdp.send("Runtime.evaluate", {
          expression: `document.querySelector('[data-hook="file-upload-viewer"] button').click()`,
        }, sessionId);
      }
      try {
        const ev = await cdp.waitEvent(isPdfEvent, 12_000, "PDF url after viewer click");
        pdfUrl = evUrl(ev);
      } catch { dbg("no pdf event on attempt", attempt + 1); }
    }
    if (!pdfUrl) throw new Error("viewer click produced no PDF url after 3 attempts");

    const info = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `JSON.stringify({text:document.body.innerText.slice(0,8000),links:[...document.querySelectorAll('a')].map(a=>a.href)})`,
    }, sessionId);
    const { text, links } = JSON.parse(info.result?.value || "{}");
    return { pdfUrl, text: text || "", links: links || [] };
  } finally {
    try { cdp?.close(); } catch {}
    child.kill("SIGKILL");
    try { rmSync(prof, { recursive: true, force: true }); } catch {}
  }
}

// --------------------------------------------------------------- pdf text
function pdfToText(buf, slug) {
  const pdfPath = join(tmpdir(), `redbridge-${slug}.pdf`);
  writeFileSync(pdfPath, buf);
  const bins = ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext"];
  let lastErr;
  for (const bin of bins) {
    try {
      return execFileSync(bin, ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
    } catch (err) {
      if (err.code === "ENOENT") { lastErr = err; continue; }
      throw new Error(`pdftotext failed on ${slug}: ${err.message.slice(0, 200)}`);
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
const MON_ABBR = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Sept: 8, Oct: 9, Nov: 10, Dec: 11 };

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);
const abbrOf = (monthIndex) => Object.keys(MON_ABBR).find((k) => MON_ABBR[k] === monthIndex);

// "Monday 27 July and Thursday 30 July 2026" → { d1, m1, y1, d2, m2, y2 }.
// Older reports omit the year entirely ("Monday 25 May and Thursday 28
// May.") — years come back null and parsePdf fills them from the wave row.
function parseFieldwork(txt) {
  const m = txt.match(/conducted between\s+([\s\S]{0,150}?)\./i);
  if (!m) return null;
  const s = m[1]
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "")
    .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  let mm = s.match(/(\d{1,2}) ([A-Za-z]+)(?: (\d{4}))? and (\d{1,2}) ([A-Za-z]+)(?: (\d{4}))?/);
  if (mm) {
    const M1 = MONTHS[mm[2].toLowerCase()], M2 = MONTHS[mm[5].toLowerCase()];
    if (M1 != null && M2 != null)
      return { d1: +mm[1], m1: M1, y1: mm[3] ? +mm[3] : null, d2: +mm[4], m2: M2, y2: mm[6] ? +mm[6] : null };
  }
  mm = s.match(/(\d{1,2}) and (\d{1,2}) ([A-Za-z]+)(?: (\d{4}))?/);
  if (mm) {
    const M = MONTHS[mm[3].toLowerCase()];
    if (M != null)
      return { d1: +mm[1], m1: M, y1: mm[4] ? +mm[4] : null, d2: +mm[2], m2: M, y2: mm[4] ? +mm[4] : null };
  }
  return null;
}

// "2 August 2026" line on the rendered project page → "2026-08-02"
function parsePublished(pageText) {
  const m = (pageText || "").match(/^\s*(\d{1,2}) ([A-Za-z]+) (\d{4})\s*$/m);
  if (!m) return null;
  const M = MONTHS[m[2].toLowerCase()];
  return M == null ? null : iso(+m[3], M, +m[1]);
}

// Text between a table caption and the first terminator heading.
// s+10 start offset keeps the caption itself from matching its own
// terminator patterns.
function sliceBetween(txt, startRe, ...endRes) {
  const s = txt.search(startRe);
  if (s === -1) return null;
  let e = txt.length;
  for (const re of endRes) {
    const i = txt.slice(s + 10).search(re);
    if (i !== -1 && s + 10 + i < e) e = s + 10 + i;
  }
  return txt.slice(s, e);
}

// ----------------------------------------------------------- table parsing
// Table 2 "Federal vote intention for the House of Representatives, by wave":
// rows of `Mon YYYY` + 5 primary ints + 3 TPP cells ("-" where unpublished).
// The current wave is the FIRST data row; column order is fixed
// (Labor, Coalition, One Nation, Greens, Other, then the three ALP TPPs).
function parseTable2(txt) {
  const sec = sliceBetween(txt, /Table \d+: Federal vote intention/i, /\n\s*(?:Table|Figure) \d+:/);
  if (!sec) return { error: "vote-intention wave table not found" };
  const rows = [];
  // two print eras:
  //   8 cells (Jun 2026 report on): Labor, Coalition, One Nation, Greens,
  //     Other, then the three ALP TPPs
  //   11 cells (older): Labor, Liberal, Liberal National, National, Country
  //     Liberal, One Nation, Greens, Other Parties and Candidates, then the
  //     three ALP TPPs. Coalition is the sum of the four split cells.
  const re = /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{4})((?:\s+(?:\d+|[-–])){8,11})\s*$/gm;
  let m;
  while ((m = re.exec(sec))) {
    const cells = m[3].trim().split(/\s+/).map((v) => (/^[-–]$/.test(v) ? null : +v));
    if (cells.length !== 8 && cells.length !== 11) continue;
    // p = coalition column count: 1 in the new 8-cell layout, 4 in the
    // old 11-cell layout (Liberal/Lib-Nat/National/Country-Liberal)
    const p = cells.length - 7;
    rows.push({
      label: `${m[1]} ${m[2]}`, year: +m[2], month: MON_ABBR[m[1]],
      alp: cells[0],
      lnp: p === 1 ? cells[1] : cells.slice(1, 5).reduce((a, v) => a + (v || 0), 0),
      onp: cells[1 + p],
      grn: cells[2 + p],
      ind: cells[3 + p],
      tppHist: cells[4 + p],
      tppResp: cells[5 + p],
      tppVsOn: cells[6 + p],
    });
  }
  if (!rows.length) return { error: "no wave rows parsed under the vote-intention table" };
  const seen = new Set();
  const uniq = rows.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
  const w = uniq[0];
  const { label, year, month, ...vals } = w;
  return { wave: { label, year, month, ...vals }, rowCount: uniq.length };
}

// Table 5 "Favourability ratings and name recognition of political figures":
// leader-name headings each introducing `Mon YYYY` rows of
// veryFav mostlyFav neither mostlyUnfav veryUnfav notSure notHeard NET.
// The slice deliberately runs to the institutions section heading — the
// demographic tables in between (All voters, Gen-Z, …) can never match the
// wave-row shape, and neither can a mid-table "(continued)" caption.
function parseTable5(txt) {
  const sec = sliceBetween(txt, /Table \d+: Favourability ratings and name recognition of political figures/i,
    /\n\s*(?:Table \d+: )?\s*Favourability ratings.*of institutions/i);
  if (!sec) return { error: "favourability wave table (Table 5) not found" };
  const rowRe = /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s*$/;
  // leader headings print either as a surname line (Jul 2026 report on)
  // or a full-name line (older reports); key sections by surname either way
  const headRe = /^\s{0,10}([A-Z][a-z]{2,14}(?:\s+[A-Z][a-z]{2,14})?)\s*$/;
  const leaders = {};
  const lines = sec.split("\n");
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const hm = lines[i].match(headRe);
    if (hm) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && rowRe.test(lines[j])) { cur = hm[1].split(" ").pop(); continue; }
    }
    const rm = lines[i].match(rowRe);
    if (rm && cur) {
      (leaders[cur] ||= []).push({ label: `${rm[1]} ${rm[2]}`, nums: rm.slice(3, 11).map(Number) });
    }
  }
  if (!Object.keys(leaders).length) return { error: "no leader sections parsed in favourability table" };
  return { leaders };
}

// Table 30-ish "Preferred Prime Minister, by demographic characteristics":
// header carries the three candidates (PM column, opposition-leader column,
// Pauline Hanson), the "All voters" row carries their values.
function parsePpm(txt) {
  const sec = sliceBetween(txt, /Table \d+: Preferred Prime Minister/i, /\n\s*(?:Table|Figure) \d+:/);
  if (!sec) return { error: "preferred prime minister table not found" };
  const am = sec.match(/All voters\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
  if (!am) return { error: "'All voters' row not found in PPM table" };
  // header wraps across two layout lines ("Anthony … Angus Taylor  Pauline
  // … Not sure / Albanese  Hanson  same  these"), so names are not
  // contiguous in the collapsed string; the opposition leader is whatever
  // sits between "Anthony" and "Pauline" (its last word is the surname)
  const head = sec.slice(0, sec.indexOf("All voters")).replace(/\s+/g, " ");
  const nm = head.match(/Anthony\s+(.+?)\s+Pauline\b/);
  if (!nm) return { error: "PPM header layout changed – could not find Anthony/Pauline columns" };
  const oppName = nm[1].trim().split(" ").pop().replace(/[^A-Za-z]/g, "");
  if (!/^[A-Z][a-z]{1,14}$/.test(oppName)) return { error: `implausible opp surname "${oppName}"` };
  return { ppm: { alb: +am[1], opp: +am[2], han: +am[3] }, oppName };
}

// ---------------------------------------------------------------- pdf → wave
function parsePdf(txt, slug, notes) {
  const out = { slug };

  const fw = parseFieldwork(txt);

  const sm = txt.match(/sample of N = ([\d,]+)/i) || txt.match(/\bN = ([\d,]+)\b/);
  if (sm) out.sample = +sm[1].replace(/,/g, "");
  else out.fwError = (out.fwError ? out.fwError + "; " : "") + "sample N not parsed";

  const t2 = parseTable2(txt);
  if (t2.error) out.table2Error = t2.error;
  else Object.assign(out, t2.wave, { waveRows: t2.rowCount });

  // fieldwork years: explicit in the methodology when printed, else filled
  // from the wave-table year, else from the cover's release-month line
  // ("December, 2025" — with a Dec-fieldwork/Jan-release wrap) — never guessed
  if (!fw) out.fwError = "fieldwork dates not parsed from methodology";
  else {
    let coverY = null;
    const cm = txt.match(/^\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\w*), (\d{4})\s*$/m);
    if (cm && MONTHS[cm[1].toLowerCase().replace(/,$/, "")] != null)
      coverY = fw.m2 > MONTHS[cm[1].toLowerCase()] ? +cm[2] - 1 : +cm[2];
    const y2 = fw.y2 ?? out.year ?? coverY;
    const y1 = fw.y1 ?? (y2 != null ? (fw.m1 > fw.m2 ? y2 - 1 : y2) : null);
    if (y2 == null || y1 == null)
      out.fwError = "fieldwork years not derivable (absent from methodology and no wave table year)";
    else {
      out.dateStart = iso(y1, fw.m1, fw.d1);
      out.date = iso(y2, fw.m2, fw.d2);
    }
  }

  const pp = parsePpm(txt);
  if (pp.error) out.ppmError = pp.error;
  else Object.assign(out, { ppm: pp.ppm, oppName: pp.oppName });

  const t5 = parseTable5(txt);
  if (t5.error) out.favError = t5.error;
  else {
    const pick = (surname) => t5.leaders[surname]?.[0];
    const alb = pick("Albanese");
    const han = pick("Hanson");
    const opp = out.oppName ? pick(out.oppName) : null;
    for (const [key, row] of [["Albanese", alb], ["Hanson", han], [out.oppName || "opp", opp]]) {
      if (!row) { notes.push(`${slug}: no favourability wave row for ${key}`); continue; }
      if (out.label && row.label !== out.label)
        notes.push(`${slug}: ${key} favourability row is ${row.label}, wave is ${out.label} — using wave row anyway`);
    }
    out.nets = {
      alb: alb ? alb.nums[7] : null,
      opp: opp ? opp.nums[7] : null,
      han: han ? han.nums[7] : null,
    };
    out.detail = {
      alb: alb ? { app: alb.nums[0] + alb.nums[1], dis: alb.nums[3] + alb.nums[4] } : null,
      opp: opp ? { app: opp.nums[0] + opp.nums[1], dis: opp.nums[3] + opp.nums[4] } : null,
      han: han ? { app: han.nums[0] + han.nums[1], dis: han.nums[3] + han.nums[4] } : null,
    };
  }
  return out;
}

// ------------------------------------------------------------------ guards
function guardNewWave(w, pubIso) {
  const errs = [];
  const need = (name, v) => { if (v == null) errs.push(`${name} missing`); };
  need("date", w.date); need("dateStart", w.dateStart); need("sample", w.sample);
  need("wave label", w.label); need("published", pubIso);
  if (w.table2Error) errs.push(`table2: ${w.table2Error}`);
  if (w.ppmError) errs.push(`ppm: ${w.ppmError}`);
  if (w.favError) errs.push(`favourability: ${w.favError}`);
  if (w.fwError) errs.push(`methodology: ${w.fwError}`);
  for (const k of ["alp", "lnp", "grn", "onp", "ind"]) need(k, w[k]);
  need("tppResp", w.tppResp);
  if (!w.oppName) errs.push("opposition leader name missing");
  for (const [n, v] of Object.entries(w.nets || {})) if (v == null) errs.push(`net favourability ${n} missing`);
  for (const [n, v] of Object.entries(w.detail || {})) if (v == null) errs.push(`favourability detail ${n} missing`);
  if (w.ppm) for (const k of ["alb", "opp", "han"]) if (w.ppm[k] == null) errs.push(`ppm.${k} missing`);

  if (w.date && w.dateStart) {
    const span = daysBetween(w.dateStart, w.date);
    if (span < 1 || span > 10) errs.push(`field span ${span}d outside 1–10d`);
    if (w.year != null && +w.date.slice(0, 4) !== w.year) errs.push(`methodology year ${w.date.slice(0, 4)} vs table wave year ${w.year}`);
    if (w.month != null && +w.date.slice(5, 7) !== w.month + 1) errs.push(`methodology month ${w.date.slice(5, 7)} vs table wave month ${w.month + 1}`);
  }
  if (pubIso && w.date) {
    const lag = daysBetween(w.date, pubIso);
    if (lag < 0 || lag > 40) errs.push(`published ${pubIso} is ${lag}d from fieldwork end`);
  }
  if (w.sample != null && (w.sample < 500 || w.sample > 5000)) errs.push(`sample=${w.sample} implausible`);
  for (const k of ["alp", "lnp", "grn", "onp", "ind"])
    if (w[k] != null && (w[k] < 1 || w[k] > 70)) errs.push(`${k}=${w[k]} outside 1–70`);
  if (["alp", "lnp", "grn", "onp", "ind"].every((k) => w[k] != null)) {
    const sum = w.alp + w.lnp + w.grn + w.onp + w.ind;
    if (Math.abs(sum - 100) > 1.5) errs.push(`primaries Σ=${sum} not ~100`);
  }
  if (w.tppResp != null && (w.tppResp < 25 || w.tppResp > 75)) errs.push(`tppResp=${w.tppResp} implausible`);
  if (w.tppVsOn != null && (w.tppVsOn < 25 || w.tppVsOn > 75)) errs.push(`tppVsOn=${w.tppVsOn} implausible`);
  if (w.ppm && w.ppm.alb != null && w.ppm.opp != null && w.ppm.han != null && w.ppm.alb + w.ppm.opp + w.ppm.han > 100)
    errs.push(`ppm trio Σ=${w.ppm.alb + w.ppm.opp + w.ppm.han} > 100`);
  for (const [n, v] of Object.entries(w.nets || {}))
    if (v != null && (v < -90 || v > 90)) errs.push(`net ${n}=${v} implausible`);
  return errs;
}

// -------------------------------------------------------------------- main
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const status = { changed: false, check: CHECK, added: [], verified: [], mismatches: [], notes: [], skipped_slugs: [] };
if (process.env.RB_LIB !== "1") try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);

  // ---- discovery: sitemap index -> dynamic-projects sitemap -> federal-poll slugs
  const indexXml = (await fetchBuffer(SITEMAP_INDEX)).toString("utf8");
  const sub = indexXml.match(/<loc>(https:\/\/www\.accent-research\.com\/[^<]*dynamic-projects[^<]*)<\/loc>/);
  if (!sub) throw new Error("no dynamic-projects sitemap found in the sitemap index (site restructure?)");
  const projXml = (await fetchBuffer(sub[1])).toString("utf8");
  const urls = [...projXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const candidates = [];
  for (const u of urls) {
    const path = new URL(u).pathname;
    const m = path.match(PAGE_SLUG_RE);
    if (m) {
      candidates.push({
        url: u,
        slug: decodeURIComponent(path.split("/").pop()),
        slugMonth: m[1] ? MONTHS[m[1].toLowerCase()] : null,
        slugYear: m[2] ? +m[2] : null,
      });
    } else if (path.startsWith("/projects/")) {
      status.skipped_slugs.push(path.split("/").pop());
    }
  }
  if (!candidates.length) throw new Error("no federal-poll project pages found in the projects sitemap (site restructure?)");
  status.candidates = candidates.map((c) => c.slug);

  // ---- AFR topic-page cross-check: detection only (the article itself is
  // paywall-trimmed to automation, so figures still come from the Accent
  // PDF). An AFR article dated after the LATEST PUBLISHED committed wave
  // means a wave is live in AFR but not yet on accent-research.com — report
  // it in RB_STATUS.afrTopicNotes instead of silently missing the poll.
  try {
    const topic = (await fetchBuffer(AFR_TOPIC)).toString("utf8");
    const latestPub = Math.max(...D.polls.filter((r) => r.pollster === POLLSTER).map((r) => (r.published || r.date).slice(0, 10).replace(/-/g, "")).map(Number));
    const fresh = new Map();
    for (const m of topic.matchAll(/href="([^"]*?-(20\d{6})-p[0-9a-z]+)"/g)) {
      const day = +m[2];
      if (day > latestPub && !fresh.has(m[1])) fresh.set(m[1], day);
    }
    for (const [path, day] of [...fresh].sort((a, b) => a[1] - b[1])) {
      const url = path.startsWith("http") ? path : `https://www.afr.com${path}`;
      const iso = String(day).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
      (status.afrTopicNotes ||= []).push(url);
      status.notes.push(
        `AFR topic page lists a post-${String(latestPub).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")} article (${iso}) with no Accent project page yet — detect-only; ingest figures manually or wait for the Accent PDF: ${url}`);
    }
  } catch (err) {
    status.notes.push(`AFR topic-page cross-check failed: ${err.message} — sitemap discovery unaffected`);
  }

  mkdirSync(SRC_DIR, { recursive: true });
  const guardFails = [];
  const newRows = { polls: [], ppm: [], approval: [], altTpp: [] };

  for (const c of candidates) {
    const cachePath = `${SRC_DIR}/${c.slug}.json`;
    let w;
    if (!FORCE && existsSync(cachePath)) {
      w = JSON.parse(readFileSync(cachePath, "utf8"));
    } else {
      const page = await scrapeProjectPage(c.url);
      const pdfUrl = page.pdfUrl;
      const pubIso = parsePublished(page.text);
      const afrUrl = (page.links || []).find((l) => /^https:\/\/(www\.)?afr\.com\//.test(l)) || null;
      const pdfBuf = await fetchBuffer(pdfUrl, PDF_TIMEOUT_MS);
      const txt = pdfToText(pdfBuf, c.slug);
      w = parsePdf(txt, c.slug, status.notes);
      Object.assign(w, { pubIso, pdfUrl, afrUrl, extractedAt: new Date().toISOString() });
      writeFileSync(cachePath, JSON.stringify(w, null, 2) + "\n");
      writeFileSync(`${SRC_DIR}/${c.slug}.txt`, txt);
    }

    if (w.date && w.date < CYCLE_START) { status.notes.push(`${c.slug}: wave ${w.date} out of cycle — skipped`); continue; }
    if (c.slugMonth != null && w.month != null && (c.slugMonth !== w.month || c.slugYear !== w.year))
      status.notes.push(`${c.slug}: slug implies ${c.slugYear}-${c.slugMonth + 1} but table wave is ${w.label} — trusting the PDF`);

    // ---- match/verify against committed rows; never overwrite
    const near = (arr, keyField, days = 14) =>
      arr.find((r) => r[keyField] === POLLSTER && w.date && Math.abs(daysBetween(r.date, w.date)) <= days);
    const matchPoll =
      near(D.polls, "pollster") ||
      D.polls.find((r) => r.pollster === POLLSTER && w.sample != null && r.sample === w.sample && w.date && Math.abs(daysBetween(r.date, w.date)) <= 60);

    if (matchPoll) {
      const diffs = [];
      const cmp = (k, got, exp) => { if (got != null && exp !== got) diffs.push(`${k}: pdf=${got} vs file=${exp}`); };
      cmp("date", w.date, matchPoll.date);
      cmp("dateStart", w.dateStart, matchPoll.dateStart);
      cmp("sample", w.sample, matchPoll.sample);
      for (const k of ["alp", "lnp", "grn", "onp", "ind"]) cmp(k, w[k], matchPoll[k]);
      cmp("tpp_alp", w.tppResp, matchPoll.tpp_alp);
      cmp("tpp_lnp", w.tppResp != null ? 100 - w.tppResp : null, matchPoll.tpp_lnp);
      if (w.pubIso && matchPoll.published && matchPoll.published.slice(0, 10) !== w.pubIso)
        diffs.push(`published: page=${w.pubIso} vs file=${matchPoll.published.slice(0, 10)}`);

      for (const [sec, keyField, check] of [
        ["ppm", "firm", (r, d) => { cmp("ppm.alb", w.ppm?.alb, r.alb); cmp("ppm.opp", w.ppm?.opp, r.opp); cmp("ppm.han", w.ppm?.han, r.han); if (w.oppName && r.oppName !== w.oppName) d.push(`oppName: pdf=${w.oppName} vs file=${r.oppName}`); }],
        ["approval", "firm", (r, d) => { cmp("approval.alb", w.nets?.alb, r.alb); cmp("approval.opp", w.nets?.opp, r.opp); cmp("approval.han", w.nets?.han, r.han);
          if (r.detail && w.detail) for (const who of ["alb", "opp", "han"]) for (const k of ["app", "dis"]) cmp(`detail.${who}.${k}`, w.detail[who]?.[k], r.detail[who]?.[k]); }],
        ["altTpp", "firm", (r) => cmp("alpVsOnp_alp", w.tppVsOn, r.alpVsOnp_alp)],
      ]) {
        const row = D[sec].find((r) => r[keyField] === POLLSTER && w.date && Math.abs(daysBetween(r.date, w.date)) <= 14);
        if (!row) { status.notes.push(`${c.slug}: no ${sec} row near ${w.date} for an existing wave — left for manual entry`); continue; }
        const d2 = [];
        check(row, d2);
        diffs.push(...d2.map((s) => `${sec}: ${s}`));
      }

      status.verified.push({ date: matchPoll.date, slug: c.slug, ok: diffs.length === 0 });
      if (diffs.length) status.mismatches.push({ date: matchPoll.date, slug: c.slug, diffs });
      continue;
    }

    // wave may already be committed under a different RedBridge label (rows
    // before May 2026 use plain "Redbridge" for the AFR waves): never
    // auto-duplicate the date — the labels need a human to reconcile
    const nearAny = D.polls.find(
      (r) => /redbridge/i.test(r.pollster || "") && w.date && Math.abs(daysBetween(r.date, w.date)) <= 10);
    if (nearAny) {
      status.notes.push(
        `${c.slug}: wave ${w.date} already committed as "${nearAny.pollster}" on ${nearAny.date} — not duplicating as "${POLLSTER}"; reconcile labels manually`);
      continue;
    }

    // ---- new wave: guard, assemble, queue
    const errs = guardNewWave(w, w.pubIso);
    if (c.slugMonth != null && w.month != null && (c.slugMonth !== w.month || c.slugYear !== w.year))
      errs.push(`slug month ${c.slugYear}-${c.slugMonth + 1} != table wave ${w.label}`);
    if (errs.length) { guardFails.push(...errs.map((e) => `${c.slug}: ${e}`)); continue; }
    if ([...newRows.polls, ...D.polls].some((r) => r.date === w.date && r.pollster === POLLSTER)) {
      guardFails.push(`${c.slug}: duplicate wave ${w.date} ${POLLSTER}`);
      continue;
    }

    const parsed = {
      polls: clean({
        date: w.date, published: w.pubIso ? `${w.pubIso}T18:00` : undefined, dateStart: w.dateStart,
        pollster: POLLSTER, client: "AFR", sample: w.sample,
        alp: w.alp, lnp: w.lnp, grn: w.grn, onp: w.onp, ind: w.ind, oth: null,
        tpp_alp: w.tppResp, tpp_lnp: w.tppResp != null ? 100 - w.tppResp : null,
        url: w.afrUrl || w.pdfUrl,
      }),
      ppm: { date: w.date, firm: POLLSTER, alb: w.ppm.alb, opp: w.ppm.opp, oppName: w.oppName, han: w.ppm.han, extra: null },
      approval: { date: w.date, firm: POLLSTER, alb: w.nets.alb, opp: w.nets.opp, oppName: w.oppName, han: w.nets.han, detail: w.detail },
      ...(w.tppVsOn != null ? { altTpp: { date: w.date, firm: POLLSTER, alpVsOnp_alp: w.tppVsOn, lnpVsOnp_lnp: null } } : {}),
    };
    for (const [sec, row] of Object.entries(parsed)) newRows[sec].push(row);
    status.added.push({
      date: w.date, slug: c.slug, alp: parsed.polls.alp, lnp: parsed.polls.lnp, onp: parsed.polls.onp,
      tpp: parsed.polls.tpp_alp, ppm: parsed.ppm.alb, nets: parsed.approval.alb,
    });
  }

  if (guardFails.length) {
    console.error("RB_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("RB_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (Object.values(newRows).some((r) => r.length)) {
    for (const sec of ["polls", "ppm", "approval", "altTpp"])
      if (newRows[sec].length) D[sec] = [...D[sec], ...newRows[sec]].sort(byDate);
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      console.log(`wrote ${OUT}: ${status.added.map((a) => `${a.date} (${a.slug})`).join(", ")}`);
    }
  }
  console.log("RB_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("RB_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("RB_STATUS " + JSON.stringify(status));
  process.exit(1);
}

// parser exports for .build/test-redbridge.mjs (RB_LIB=1 import skips the
// main block above)
export { parsePdf, parseTable2, parseTable5, parsePpm, sliceBetween, guardNewWave };
