/* Probe: with the tab bar pinned and the 2PP score docked (.tabs.show-score),
   the "Past cycles" tab keeps its FULL label at every phone width - the
   Snapshot→Now rename freed the room the old ≤420px "Cycles" swap was
   buying, and the swap mechanism was ripped out. Asserts, at each width:
   - the cycles tab's own <span> reads "Past cycles";
   - no .tab-label-short / .tab-label-long spans exist anywhere;
   - the tab row does not horizontally overflow the bar's seat;
   - the page does not grow wider than the viewport;
   - the Info pin-hide contract is untouched (hidden ≤380px with the score
     docked, visible at 390px). */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../..", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = [];
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails.push(name); };

for (const W of [420, 390, 360, 320]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 160)); fails.push(W + " pageerror"); });
  await page.goto(`http://127.0.0.1:${server.address().port}/cycles/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tabs .tab", { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForSelector(".tabs.show-score", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 400));

  const r = await page.evaluate(() => {
    const tabs = document.querySelector(".tabs");
    const cyc = [...document.querySelectorAll(".tabs .tab")].find((t) => t.textContent.includes("cycles"));
    const spans = [...cyc.querySelectorAll("span")];
    const lab = spans.find((s) => s.className.includes("tab-label"));
    const info = [...document.querySelectorAll(".tabs .tab")].find((t) => t.textContent.trim() === "Info");
    const hero = cyc.querySelector(".tab-label") || cyc;
    return {
      showScore: tabs.classList.contains("show-score"),
      heroText: lab.textContent.trim(),
      ownSpanCount: spans.length,
      longShort: document.querySelectorAll(".tab-label-long, .tab-label-short").length,
      tabClass: lab.className,
      heroRect: (() => { const q = hero.getBoundingClientRect(); return { l: Math.round(q.left * 10) / 10, r: Math.round(q.right * 10) / 10 }; })(),
      bar: (() => { const q = tabs.getBoundingClientRect(); return { l: Math.round(q.left * 10) / 10, r: Math.round(q.right * 10) / 10 }; })(),
      infoShown: info ? getComputedStyle(info).display !== "none" : null,
      scrollW: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    };
  });
  ok(W + ": bar is docked with score (show-score)", r.showScore);
  ok(W + ": cycles tab reads 'Past cycles' in full", r.heroText === "Past cycles");
  ok(W + ": no tab-label-short/long machinery in the DOM", r.longShort === 0);
  ok(W + ": cycles tab sits inside the bar's seat", r.heroRect.r <= r.bar.r + 1 && r.heroRect.l >= r.bar.l - 1);
  ok(W + ": page does not overflow (" + r.scrollW + " <= " + (r.iw + 1) + ")", r.scrollW <= r.iw + 1);
  if (W <= 380) {
    ok(W + ": Info still yields the docked score (pinHide)", r.infoShown === false);
  } else {
    ok(W + ": Info keeps its seat at " + W + "px", r.infoShown === true);
  }
  if (!r.showScore || r.heroText !== "Past cycles" || r.longShort) console.log("   detail:", JSON.stringify(r));
  await page.close();
}
await browser.close();
server.close();
console.log(fails.length ? "FAILED: " + fails.join("; ") : "ALL GREEN");
process.exit(fails.length ? 1 : 0);
