#!/usr/bin/env node
/* harvest-bulletin-gallup.mjs — The Bulletin's Morgan Gallup Poll column,
   1973–1984, from the NLA's digitised run on Trove, for the pre-1987
   past-cycle leadership lines.

     node .build/harvest-bulletin-gallup.mjs            # both stages, resumable
     node .build/harvest-bulletin-gallup.mjs --search   # stage A only
   Output (scratch, uncommitted): .matilda/bulletin-gallup/
     articles.jsonl   one line per Trove magazine article ("PUBLIC OPINION …")
     issues/<issue>.json   the poll column's OCR blocks for that issue

   WHY THE BULLETIN: Trove's newspaper corpus after 1954 is essentially the
   Canberra Times, which ran a leader rating a few times a year at most
   (0–6 hits a year for "gallup satisfied"). The Morgan Gallup Poll itself
   was published in The Bulletin from 1973, weekly, with trend tables —
   "OPINION OF FRASER / Approve Disapprove Undecided / Feb 14,21 49 32 19 …"
   — and the NLA digitised The Bulletin through 1984 as a Trove magazine.

   HOW THE ACCESS WORKS (re-derivable):
   Stage A — Trove's SPA search API for the magazines category is
     GET /api/search/134?terms=( "Morgan Gallup" )&limits={"decade":["197"]}
     with the SPA's public client key in an `apikey` header, called in-page
     (session cookies) exactly as harvest-trove.mjs does for newspapers;
     year limits are ignored for this category, decade limits work. Each
     work carries `onlineUrl` https://nla.gov.au/nla.obj-<section>.
   Stage B — the section URL redirects to
     https://nla.gov.au/nla.obj-<issue>/view?sectionId=nla.obj-<section>,
     and https://nla.gov.au/nla.obj-<issue>/ocr returns the WHOLE issue's
     OCR as JSON: pages[] → print[] → ps[] blocks (each with an article id
     `aid`) → ls[] lines → ws[] words. There is no public section→aid map,
     so the poll column is found by its own text: blocks mentioning Morgan
     Gallup, or "OPINION OF <NAME>" / "Approve Disapprove" tables, and the
     other blocks sharing those articles' aids. One 4MB fetch per issue,
     cached; ~600 issues. Polite pacing, resumable. */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const API_KEY = process.env.TROVE_API_KEY || "c4ab54b30f7090a31937b3ae2d7458ed"; // rotates; see harvest-trove-leaders.mjs
const OUTDIR = process.env.BULLETIN_DIR || ".matilda/bulletin-gallup";
const TERMS = '( "Morgan Gallup" )';
const DECADES = ["197", "198"];
const SEARCH_ONLY = process.argv.includes("--search");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

fs.mkdirSync(path.join(OUTDIR, "issues"), { recursive: true });
const artPath = path.join(OUTDIR, "articles.jsonl");
const articles = new Map();
if (fs.existsSync(artPath)) for (const l of fs.readFileSync(artPath, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); articles.set(r.section, r); }

// ---- stage A: the article list -------------------------------------------------
if (!articles.size) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto("https://trove.nla.gov.au/search/category/magazines", { waitUntil: "networkidle2", timeout: 90000 });
  const search = (decade, start) => page.evaluate(async (a) => {
    const e = encodeURIComponent;
    const u = `/api/search/134?terms=${e(a.terms)}&limits=${e(JSON.stringify({ decade: [a.decade] }))}&pageSize=100&startPos=${a.start}`;
    try { const res = await fetch(u, { headers: { apikey: a.key, Accept: "application/json" } }); if (!res.ok) return { __err: res.status }; return await res.json(); }
    catch (err) { return { __err: String(err) }; }
  }, { terms: TERMS, key: API_KEY, decade, start });
  for (const decade of DECADES) {
    let start = 0, total = null;
    while (total == null || start < total) {
      const d = await search(decade, start);
      if (!d || d.__err) { console.error(`decade ${decade} start ${start}: ${d?.__err}`); break; }
      total = d.totalRecords ?? 0;
      for (const w of d.works || []) {
        const section = (w.onlineUrl || "").split("/").pop();
        if (!/^nla\.obj-\d+$/.test(section) || articles.has(section)) continue;
        const m = /\((\d{1,2} [A-Za-z]+ \d{4})\)\s*$/.exec(w.title || "");
        const rec = { section, title: (w.title || "").replace(/\s+/g, " ").trim(), issueDate: m ? m[1] : null, year: w.yearRange || null, magazine: w.firstArticlePublicationName || "" };
        articles.set(section, rec);
        fs.appendFileSync(artPath, JSON.stringify(rec) + "\n");
      }
      console.log(`decade ${decade}: ${Math.min(start + 100, total)}/${total}`);
      start += 100;
      if (!(d.works || []).length) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  await browser.close();
}
console.log(`articles: ${articles.size}`);
if (SEARCH_ONLY) process.exit(0);

// ---- stage B: one OCR fetch per issue, keep the poll column -------------------------
const POLL_RE = /morgan gallup|opinion of [a-z]+|approve\s+disapprove|better prime minister|preferred prime minister|voting intention|first preference/i;
const issueOf = new Map(); // section → issue id
const issueIdxPath = path.join(OUTDIR, "issue-of.json");
if (fs.existsSync(issueIdxPath)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(issueIdxPath, "utf8")))) issueOf.set(k, v);
const saveIssueIdx = () => fs.writeFileSync(issueIdxPath, JSON.stringify(Object.fromEntries(issueOf)));

async function resolveIssue(section) {
  if (issueOf.has(section)) return issueOf.get(section);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://nla.gov.au/${section}`, { headers: { "user-agent": UA }, redirect: "manual", signal: AbortSignal.timeout(45_000) });
      const loc = res.headers.get("location") || "";
      let m = /(nla\.obj-\d+)\/view/.exec(loc);
      if (!m && res.status === 200) m = /(nla\.obj-\d+)\/view\?sectionId=/.exec(await res.text());
      const issue = m ? m[1] : null;
      if (issue) { issueOf.set(section, issue); saveIssueIdx(); }
      return issue;
    } catch (e) {
      console.error(`${section}: resolve attempt ${attempt} ${e.message}`);
      await new Promise((r) => setTimeout(r, 8000 * attempt));
    }
  }
  return null;
}

async function fetchIssue(issue, section) {
  const out = path.join(OUTDIR, "issues", `${issue}.json`);
  if (fs.existsSync(out)) return true;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://nla.gov.au/${issue}/ocr?sectionId=${section}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const pages = await res.json();
      // text per block, then every block of any article that has a poll block
      const blocks = [];
      for (const p of pages) for (const pr of p.print || []) for (const b of pr.ps || []) {
        const text = (b.ls || []).map((l) => (l.ws || []).map((w) => w.w).join(" ")).join("\n");
        blocks.push({ pgid: p.pgid, aid: b.aid, id: b.id, text });
      }
      const pollAids = new Set(blocks.filter((b) => POLL_RE.test(b.text)).map((b) => b.aid));
      const kept = blocks.filter((b) => pollAids.has(b.aid));
      fs.writeFileSync(out + ".tmp", JSON.stringify({ issue, fetched: new Date().toISOString(), pages: pages.length, blocks: kept }));
      fs.renameSync(out + ".tmp", out);
      return true;
    } catch (e) {
      console.error(`${issue}: attempt ${attempt} ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  return false;
}

// A small pool: the NLA takes several seconds to serve each issue's OCR, and
// ~600 of them serially is hours. Four in flight is still polite.
const CONCURRENCY = Number(process.env.BULLETIN_CONCURRENCY || 4);
let done = 0, failed = 0;
const list = [...articles.values()].sort((a, b) => (a.year || "").localeCompare(b.year || ""));
const inFlight = new Set();
const worker = async () => {
  while (list.length) {
    const a = list.shift();
    const issue = await resolveIssue(a.section);
    if (!issue) { failed++; console.error(`${a.section}: no issue id (${a.title})`); continue; }
    if (fs.existsSync(path.join(OUTDIR, "issues", `${issue}.json`)) || inFlight.has(issue)) continue;
    inFlight.add(issue);
    const ok = await fetchIssue(issue, a.section);
    inFlight.delete(issue);
    if (ok) done++; else failed++;
    if ((done + failed) % 20 === 0) console.log(`issues fetched ${done}, failed ${failed}, distinct ${new Set(issueOf.values()).size}`);
    await new Promise((r) => setTimeout(r, 300));
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`issues fetched this run: ${done}, failed: ${failed}, distinct issues: ${new Set(issueOf.values()).size}`);
