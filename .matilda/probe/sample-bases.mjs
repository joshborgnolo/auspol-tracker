/* Probe: every printed sample carries its house's base letters ("1,500 D"),
   set in small caps (.rd-smc), in the Latest polls table and the All polls
   ledger; Essential reads A on primaries and D+L on the 2PP facet (the site
   rescales its published 2PP+ pair to 100); Resolve reads F (forced choice).
   Run after a build: node .matilda/probe/sample-bases.mjs */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const errors = [];
const ok = (c, m) => { console.log((c ? " ok  " : "FAIL ") + m); if (!c) fails++; };
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(base + "/", { waitUntil: "load" }); await wait(2000);
const subs = await page.$$eval(".rd-pl-sub", (els) => els.map((e) => e.textContent));
console.log("  latest:", subs.filter((s) => /\d/.test(s)).slice(0, 4).join(" | "));
ok(subs.some((s) => /\d D$/.test(s)) && subs.some((s) => /\d D\+L$/.test(s)), "Latest polls rows end in D / D+L");
const smc = await page.$$eval(".rd-pl-sub .rd-smc", (els) => els.length ? getComputedStyle(els[0]).fontVariantCaps : null);
ok(smc === "all-small-caps", "letters set in small caps (" + smc + ")");

await page.goto(base + "/allpolls/", { waitUntil: "load" }); await wait(2500);
const ledger = () => page.$$eval(".rd-ap-n > span:first-child", (els) => els.map((e) => [e.closest("[role=row]")?.textContent.match(/^\s*([A-Za-z&/ ]+?)↗/)?.[1] || "", e.textContent]));
let ns = await ledger();
console.log("  ledger 2PP:", ns.slice(0, 8).map((r) => r[1]).join(" | "));
ok(ns.length && ns.filter((r) => r[1] !== "—").every((r) => /^[\d,]+( (D|D\+L|A|F))?$/.test(r[1])), "ledger samples read n + base");
const ess = (rows) => (rows.find((r) => /\d/.test(r[1]) && r[0].startsWith("Essential")) || [])[1];
ok(/ D\+L$/.test(ess(ns) || ""), "Essential reads D+L on the 2PP facet (" + ess(ns) + ")");
await page.evaluate(() => { const b = [...document.querySelectorAll("[role=tab], button")].find((e) => e.textContent.trim() === "Primary"); b && b.click(); });
await wait(1500);
ns = await ledger();
ok(/ A$/.test(ess(ns) || ""), "Essential reads A on the Primary facet (" + ess(ns) + ")");
ok(ns.some((r) => r[0].startsWith("Resolve") && / F$/.test(r[1])), "Resolve reads F");
ok(errors.length === 0, "no page errors " + errors.slice(0, 3).join("; "));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
