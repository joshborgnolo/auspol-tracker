// temp probe: spacebar cycles the figures-scope menu after a pick/label-close
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const RROOT = path.resolve(import.meta.dirname, "../..");
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(path.join(RROOT, p));
    res.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`http://127.0.0.1:${port}/maps/`, { waitUntil: "networkidle0" });
await page.waitForSelector(".st-scwrap [data-scope-trigger]", { timeout: 20000 });

const labels = () => page.$$eval(".st-scm [data-scope]", (bs) => bs.map((b) => b.textContent));
const trigger = () => page.$eval(".st-scwrap [data-scope-trigger]", (b) => b.textContent.trim());
const space = async () => { await page.keyboard.press("Space"); await new Promise((r) => setTimeout(r, 250)); };
const clickTrig = () => page.evaluate(() => document.querySelector(".st-scwrap [data-scope-trigger]").click());
const clickItem = (i) => page.evaluate((i2) => document.querySelectorAll(".st-scm [data-scope]")[i2].click(), i);
const menuOpen = () => page.evaluate(() => !!document.querySelector(".st-scm:not([hidden])"));
const fail = (m) => { console.log("FAIL:", m); process.exitCode = 1; };

console.log("menu:", (await labels()).join(" | "));
console.log("initial trigger:", await trigger());

// 1. open the menu, pick an item (index 3)
await clickTrig();
if (!(await menuOpen())) fail("trigger click should open the menu");
const all = await labels();
await clickItem(3);
await new Promise((r) => setTimeout(r, 300));
const afterPick = await trigger();
console.log("after pick #4:", afterPick);
if (!afterPick.startsWith(all[3])) fail(`picked item should relabel the trigger to "${all[3]}", got "${afterPick}"`);
if (await menuOpen()) fail("menu should be closed after a pick");

// 2. spacebar steps forward through the menu's items
await space();
const afterSp1 = await trigger();
console.log("after space ×1:", afterSp1);
if (!afterSp1.startsWith(all[4])) fail(`space should step to "${all[4]}", got "${afterSp1}"`);
await space();
console.log("after space ×2:", await trigger(), "| menu open:", await menuOpen());
if (await menuOpen()) fail("space must not reopen the menu");

// 3. wraps around the 13 items: from #4 (index 3), 6 presses lands on index 9
await space(); await space(); await space(); await space();
const wrapped = await trigger();
console.log("after space ×6:", wrapped);
if (!wrapped.startsWith(all[9])) fail(`six spaces from #4 should land on "${all[9]}", got "${wrapped}"`);

// 4. shift+space walks back
await page.keyboard.down("Shift"); await page.keyboard.press("Space"); await page.keyboard.up("Shift");
await new Promise((r) => setTimeout(r, 250));
const back = await trigger();
console.log("after shift+space:", back);
if (!back.startsWith(all[8])) fail(`shift+space should step back to "${all[8]}", got "${back}"`);

// 5. label-close path: open then close by clicking the label; space must cycle from current
await clickTrig();
await clickTrig();
if (await menuOpen()) fail("second label click should close the menu");
await space();
const afterClose = await trigger();
console.log("after label-close + space:", afterClose);
if (!afterClose.startsWith(all[9])) fail(`space after label-close should step to "${all[9]}", got "${afterClose}"`);

// 6. clicking elsewhere disarms
await page.evaluate(() => document.querySelector(".st-scwrap [data-scope-trigger]").closest("h1,h2,section,div")?.nextElementSibling);
await page.evaluate(() => document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 })));
await new Promise((r) => setTimeout(r, 150));
const before = await trigger();
await space();
const afterOutside = await trigger();
console.log("after outside click + space:", afterOutside, "(expected", before + ")");
if (afterOutside !== before) fail("space should disarm after clicking elsewhere");

await browser.close();
server.close();
console.log(process.exitCode ? "PROBE FAILED" : "PROBE PASS");
