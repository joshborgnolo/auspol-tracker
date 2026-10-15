/* The All-polls confidence facet's consumer ⇄ business lane flip
   (shipped 2026-10-15). Every expectation is derived live from the data
   bundle - the per-lane counts move as releases land, so nothing here
   hardcodes 91/33/124. Asserts:
   1. desktop (1360): the tab row carries a "Confidence:" control whose
      flip labels the ACTIVE lane; default is consumer with (consumer rows)
      of (release total) in the pin count, and no ?b in the URL
   2. clicking (or Space) switches to the business lane - count flips to
      the business share of the same total, label flips, URL gains b=1;
      a second flip restores consumer and drops the param
   3. a deep link ?f=c&b=1 opens straight on the business lane
   4. phone (390): the flip sits in its own .rd-ap-pctl row and the page
      doesn't overflow
   5. the classic design (?design=old) is untouched - no flip control,
      no b param (the lane flip is redesign chrome) */
import http from "http";
import fs from "fs";
import path from "path";
import process from "process";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.resolve(process.cwd());
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
  if (!p) p = "index.html";
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200);
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 200)); fails++; });

const goto = async (w, qs) => {
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: w <= 760, hasTouch: w <= 760 });
  await page.goto(`${base}/allpolls/index.html${qs}`, { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(1200);
  await page.evaluate(() => {
    const t = document.querySelector(".rd-ap-tabs");
    if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 40);
  });
  await sleep(400);
};
const state = () => page.evaluate(() => ({
  pinn: (document.querySelector(".rd-ap-pinnl") || {}).textContent || null,
  ctlLab: (document.querySelector(".rd-ap-tabs .rd-pl-ctl-l") || {}).textContent || null,
  flip: (document.querySelector(".rd-ap-tabs .rd-pl-ctl .rd-pl-flip") || {}).textContent || null,
  pctlFlip: (document.querySelector(".rd-ap-ctlslot .rd-pl-flip") || {}).textContent || null,
  head: (document.querySelector(".rd-ap h2.rd-hed") || {}).textContent || null,
  url: location.search,
}));

await goto(1360, "?f=c");
/* expected lane sizes, derived from the same rows the client renders */
const lanes = await page.evaluate(() => {
  const rows = (window.AUSPOL && window.AUSPOL.confidenceOnlyPolls) || [];
  const BUS = new Set(["business", "nabBusiness"]);
  let cons = 0, bus = 0;
  rows.forEach((p) => { if (!p.conf) return; if (BUS.has(p.conf.k)) bus++; else cons++; });
  return { cons, bus, tot: rows.length };
});
check(lanes.tot > 0 && lanes.cons > 0 && lanes.bus > 0, `bundle has both lanes (${lanes.cons} consumer / ${lanes.bus} business of ${lanes.tot})`);

console.log("== desktop 1360, ?f=c ==");
let s = await state();
check(s.pinn === `${lanes.cons} of ${lanes.tot} releases`, `default consumer lane count: ${JSON.stringify(s.pinn)}`);
check(s.ctlLab === "Confidence:", `tab-row label: ${JSON.stringify(s.ctlLab)}`);
check(/^\s*Consumer confidence/.test(s.flip || ""), `default flip labels the active lane: ${JSON.stringify(s.flip)}`);
check(/consumer gauges/.test(s.head || ""), `default head reads the consumer gauges: ${JSON.stringify(s.head)}`);
check(!s.url.includes("b=1"), "consumer lane writes no b param");

await page.evaluate(() => document.querySelector(".rd-ap-tabs .rd-pl-ctl .rd-pl-flip").click());
await sleep(700);
s = await state();
check(s.pinn === `${lanes.bus} of ${lanes.tot} releases`, `flipped business lane count: ${JSON.stringify(s.pinn)}`);
check(/^\s*Business confidence/.test(s.flip || ""), `business flip label: ${JSON.stringify(s.flip)}`);
check(/business gauges/.test(s.head || ""), `head follows the lane: ${JSON.stringify(s.head)}`);
check(s.url.includes("f=c") && s.url.includes("b=1"), `URL carries f=c&b=1: ${s.url}`);

await page.evaluate(() => document.querySelector(".rd-ap-tabs .rd-pl-ctl .rd-pl-flip").click());
await sleep(700);
s = await state();
check(s.pinn === `${lanes.cons} of ${lanes.tot} releases`, `flip back → consumer: ${JSON.stringify(s.pinn)}`);
check(!s.url.includes("b=1"), "b param cleared on consumer");

console.log("== Space flips the lane ==");
await page.keyboard.press(" ");
await sleep(700);
s = await state();
check(s.pinn === `${lanes.bus} of ${lanes.tot} releases`, `space → business: ${JSON.stringify(s.pinn)}`);
await page.keyboard.press(" ");
await sleep(700);
s = await state();
check(s.pinn === `${lanes.cons} of ${lanes.tot} releases`, `space → consumer: ${JSON.stringify(s.pinn)}`);

console.log("== deep link ?f=c&b=1 ==");
await goto(1360, "?f=c&b=1");
s = await state();
check(s.pinn === `${lanes.bus} of ${lanes.tot} releases`, `deep link on business: ${JSON.stringify(s.pinn)}`);
check(/^\s*Business confidence/.test(s.flip || ""), "deep link flip label business");

console.log("== phone 390 ==");
await goto(390, "?f=c");
s = await state();
check(s.pinn === `${lanes.cons} of ${lanes.tot} releases`, `phone consumer count: ${JSON.stringify(s.pinn)}`);
check(/^\s*Consumer confidence/.test(s.pctlFlip || ""), `phone pctl-row flip: ${JSON.stringify(s.pctlFlip)}`);
const docW = await page.evaluate(() => document.documentElement.scrollWidth);
check(docW <= 390, `no phone overflow (${docW})`);

console.log("== classic ?design=old untouched ==");
await goto(1360, "?design=old&f=c");
s = await page.evaluate(() => ({
  flipInTabs: !!document.querySelector(".rd-pl-flip"),
  url: location.search,
}));
check(!s.flipInTabs, "classic shows no flip control");
check(!s.url.includes("b=1"), "classic URL carries no b param");

await browser.close();
server.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
