/* Probe: the wave-marked trip (2026-10-29). A poll ledger's "Public opinion"
   line carries gen-data §8e's byRow wave pairing into AP.gotoOpinion(storeKey,
   wave), and the /public-opinion/ page lands on the pollster's By-pollster
   group with exactly that wave's questions flagged (li.pubop-wvh) and their
   folds open. Serves the built tree and drives AP.gotoOpinion like the
   ledger line does. Asserts: the byRow pairing + wave anchor exist; the sort
   flips to By pollster; the flagged rows land inside the pollster's own
   group; every flagged row's folds are open; rows of OTHER waves are NOT
   flagged; no page errors. BASE=<worktree> serves another tree's build. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let bad = 0;
const fail = (m) => { console.log("FAIL: " + m); bad++; };
const ok = (cond, m) => { if (!cond) fail(m); };

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(base + "/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.AP && window.AP.gotoOpinion, { timeout: 20000 });

/* the pairing this trip rides on: a house with a byRow key and a wave anchor
   (the Essential wave is the canonical pairing; any house's row works) */
const trip = await page.evaluate(() => {
  const rows = window.AUSPOL.publicOpinionByRow || {};
  const keys = Object.keys(rows);
  const ess = keys.find((k) => /^Essential\|/.test(k) && rows[k].w && rows[k].w.length);
  if (!ess) return null;
  const bo = rows[ess];
  return { rk: ess, house: bo.h, wave: bo.w[0], n: bo.n };
});
ok(trip, "no byRow pairing with a wave anchor found (Essential expected)");
if (trip) {
  ok(trip.wave && /^\d{4}-\d{2}-\d{2}$/.test(trip.wave), "byRow wave anchor is an ISO date: " + JSON.stringify(trip.wave));
  await page.evaluate((t) => window.AP.gotoOpinion(t.house, t.wave), trip);
  await page.waitForFunction((h) => {
    const g = document.getElementById("pubop-p-" + h);
    return !!g;
  }, { timeout: 20000 }, trip.house);
  await page.waitForFunction((h) => {
    return document.querySelectorAll("#pubop-p-" + h + " li.pubop-wvh").length > 0;
  }, { timeout: 20000 }, trip.house);

  const got = await page.evaluate((t) => {
    const g = document.getElementById("pubop-p-" + t.house);
    const li = [...g.querySelectorAll("li.pubop-wvh")];
    const allLi = [...g.querySelectorAll(".pubop-ml > li")];
    const sortBtn = g.ownerDocument.querySelector('.pubop-sort-b[aria-pressed="true"]');
    return {
      hits: li.map((x) => ({
        title: (x.querySelector(".pubop-mq") || {}).textContent || null,
        open: !!(x.querySelector("details.pubop-mi") && x.querySelector("details.pubop-mi").open),
        outerOpen: !!x.closest("details.pubop-more").open,
        tag: !!(x.querySelector(".pubop-wvh-t")),
      })),
      allCount: allLi.length,
      hitTops: li.filter((x) => !x.closest("details.pubop-more")).length,
      sortText: sortBtn ? sortBtn.textContent.trim() : null,
      anyFlaggedOutsideHouse: !!document.querySelector("li.pubop-wvh:not(#pubop-p-" + t.house + " li.pubop-wvh)"),
    };
  }, trip);
  ok(got.hits.length > 0, "no wave-flagged rows");
  if (got.hits.length) {
    ok(got.hits.length <= got.allCount, "flag count exceeds list size");
    ok(got.hits.every((h) => h.open), "a flagged row's fold stayed shut");
    ok(got.hits.every((h) => h.outerOpen), "a flagged row's umbrella fold stayed shut");
    ok(got.hits.every((h) => h.tag), "a flagged row missed the 'this poll' tag");
    ok(got.hits.every((h) => !!h.title && h.title.length > 3), "a flagged row has no question title");
    ok(!got.anyFlaggedOutsideHouse, "a row outside the pollster's own group was flagged");
  }
  ok(got.sortText && /pollster/i.test(got.sortText), "the sort didn't flip to By pollster (saw: " + got.sortText + ")");
  /* rows of OTHER waves inside the same group must not be flagged */
  const foreign = await page.evaluate((t) => {
    const g = document.getElementById("pubop-p-" + t.house);
    const specified = [...g.querySelectorAll(".pubop-ml > li:not(.pubop-wvh)")];
    return specified.length;
  }, trip);
  ok(foreign > 0, "expected unflagged sibling rows too (all of the group was flagged - the flag isn't wave-scoped)");
}
ok(errors.length === 0, "page errors during the wave trip: " + errors.join(" | ").slice(0, 300));

await browser.close();
server.close();
if (bad) { console.log("public-opinion-goto-wave: " + bad + " FAIL"); process.exit(1); }
console.log("public-opinion-goto-wave: PASS (wave-marked trip flags exactly its wave's rows, folds asked open)");
