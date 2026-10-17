/* Probe: the tab bar's menu button reads "More" with a down chevron where
   the bar has room for it (≥641px), keeping the ☰ icon below that rung.
   Shipped across template.html's .tab.tab-menu gate + the d1a1d215 Tabs
   button + the site-shell.mjs mirror. Asserts, on the main page AND on a
   satellite: icon vs word+chevron per width, the chevron's open flip, the
   menu still opening, and no document overflow across the 561–700 band the
   wider button could have pushed over. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
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
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };

const menuFace = (btn, ic, lab, chev) => {
  const d = (sel) => { const el = document.querySelector(sel);
    return el ? getComputedStyle(el).display : "MISSING"; };
  return { ic: d(ic), lab: d(lab), chev: d(chev),
           text: (document.querySelector(lab) || {}).textContent || "",
           btnW: +(document.querySelector(btn) || { getBoundingClientRect: () => ({ width: -1 }) })
             .getBoundingClientRect().width.toFixed(1) };
};

/* main page, desktop rung: word + chevron, no icon; the chevron flips on
   open and the popover still opens */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  const f = await page.evaluate(menuFace, ".tab.tab-menu", ".tab-menu-ic", ".tab-menu-lab", ".tab-menu-chev");
  ok(f.ic === "none" && f.lab !== "none" && f.lab !== "MISSING", `main@980 word shows, icon hid (ic=${f.ic} lab=${f.lab})`);
  ok(f.chev === "block", `main@980 chevron shows (chev=${f.chev})`);
  ok(f.text === "More", `main@980 the word is "More" (got "${f.text}")`);
  await page.click(".tab.tab-menu"); await wait(300);
  const open = await page.evaluate(() => ({
    expanded: document.querySelector(".tab.tab-menu").getAttribute("aria-expanded"),
    pop: !!document.querySelector(".tab-menu-pop"),
    rot: getComputedStyle(document.querySelector(".tab-menu-chev")).transform,
  }));
  ok(open.expanded === "true" && open.pop, "main@980 the menu still opens");
  ok(open.rot !== "none" && open.rot !== "", `main@980 chevron flips open (transform=${open.rot})`);
  await page.close();
}
/* a menu page names the page instead of "More" */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 844 });
  await page.goto(base + "/disagreement/", { waitUntil: "load" }); await wait(1600);
  const t = await page.evaluate(() => (document.querySelector(".tab-menu-lab") || {}).textContent || "");
  ok(t === "Poll disagreement", `menu page keeps naming the page (got "${t}")`);
  await page.close();
}
/* main page, phone rung: the ☰ stays */
for (const W of [390, 640]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  const f = await page.evaluate(menuFace, ".tab.tab-menu", ".tab-menu-ic", ".tab-menu-lab", ".tab-menu-chev");
  ok(f.ic === "block" && f.lab === "none" && f.chev === "none", `main@${W} the ☰ stays (ic=${f.ic} lab=${f.lab} chev=${f.chev})`);
  await page.close();
}
/* the boundary band: the wider word button never pushes the document wide */
for (const W of [620, 640, 641, 660, 700, 760, 900]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  await page.evaluate(() => window.scrollTo(0, 1200)); await wait(400);   // pinned too
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `main@${W} no horizontal overflow (overshoot ${over}px)`);
  await page.close();
}
/* satellite mirror */
for (const W of [980, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844 });
  await page.goto(base + "/prediction/", { waitUntil: "load" }); await wait(1400);
  const f = await page.evaluate(menuFace, ".sh-menu-btn", ".sh-menu-ic", ".sh-menu-lab", ".sh-menu-chev");
  if (W > 640) {
    ok(f.ic === "none" && f.lab !== "none" && f.chev === "block" && f.text === "More",
       `prediction@${W} word+chevron, no icon (ic=${f.ic} lab=${f.lab} chev=${f.chev} text="${f.text}")`);
  } else {
    ok(f.ic === "block" && f.lab === "none" && f.chev === "none", `prediction@${W} the ☰ stays (ic=${f.ic} lab=${f.lab} chev=${f.chev})`);
  }
  await page.close();
}
/* vic jurisdiction bar inherits the gate */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 844 });
  await page.goto(base + "/vic/", { waitUntil: "load" }); await wait(1600);
  const f = await page.evaluate(menuFace, ".tab.tab-menu", ".tab-menu-ic", ".tab-menu-lab", ".tab-menu-chev");
  ok(f.ic === "none" && f.text === "More", `vic@980 inherits the word gate (ic=${f.ic} text="${f.text}")`);
  await page.close();
}

await browser.close(); server.close();
console.log(fails ? `menu-more: ${fails} FAIL` : "menu-more: all pass");
process.exit(fails ? 1 : 0);
