/* Probe: every printed sample carries its house's base letter ("1,500 D"),
   in the Latest polls table and the All polls ledger.
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
console.log("  latest:", subs.slice(0, 8).join(" | "));
ok(subs.some((s) => /\d D$/.test(s)) && subs.some((s) => /\d D\+L$/.test(s)), "Latest polls rows end in D / D+L");
await page.goto(base + "/allpolls/", { waitUntil: "load" }); await wait(2500);
const ns = await page.$$eval(".rd-ap-n > span:first-child", (els) => els.map((e) => e.textContent));
console.log("  ledger:", ns.slice(0, 10).join(" | "));
ok(ns.length && ns.filter((s) => s !== "—").every((s) => /^[\d,]+( (D|D\+L|A))?$/.test(s)), "ledger samples read n + base");
ok(ns.some((s) => / A$/.test(s)), "an all-voters (A) row shows");
ok(errors.length === 0, "no page errors " + errors.slice(0, 3).join("; "));
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
