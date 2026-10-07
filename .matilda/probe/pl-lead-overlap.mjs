import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8963;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

for (const W of [375, 390, 430]) {
  await page.setViewport({ width: W, height: 844 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#latest-polls .rd-pl-row");

  for (const label of ["Leaders", "2PP", "Primary"]) {
    const tabBox = await page.evaluate((label) => {
      const scope = document.querySelector("#latest-polls");
      const b = [...scope.querySelectorAll("button")].find((x) => x.textContent.trim() === label);
      if (!b) return null;
      b.scrollIntoView({ block: "center" });
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, label);
    if (!tabBox) { console.log(`W${W} ${label}: TAB NOT FOUND`); failures++; continue; }
    await page.mouse.click(Math.min(tabBox.x, W - 5), tabBox.y);
    await sleep(500);

    const rows = await page.evaluate(() => {
      const ink = (el) => {
        if (!el) return null;
        const rng = document.createRange();
        rng.selectNodeContents(el);
        const r = rng.getBoundingClientRect();
        return { l: +r.left.toFixed(1), r: +r.right.toFixed(1) };
      };
      return [...document.querySelectorAll("#latest-polls .rd-pl-item")].map((it) => {
        const nameC = it.querySelector(".rd-pl-c-name");
        const figsC = it.querySelector(".rd-pl-c-figs");
        const nameMain = nameC && nameC.querySelector(".rd-pl-main");
        const figsMain = figsC && (figsC.querySelector(".rd-pl-main") || figsC.querySelector(".rd-pl-prim"));
        return {
          name: nameMain ? nameMain.textContent.trim().replace(/\s+/g, " ") : "(none)",
          char: nameMain ? getComputedStyle(nameMain).textOverflow : "",
          fs: figsMain ? getComputedStyle(figsMain).fontSize : "",
          nameInk: ink(nameMain),
          figsInk: ink(figsMain),
          cellR: nameC ? +nameC.getBoundingClientRect().right.toFixed(1) : 0,
        };
      });
    });

    console.log(`\n=== W=${W} · ${label} ===`);
    for (const r of rows) {
      if (!r.nameInk || !r.figsInk) { console.log(`${r.name}: missing measure`); failures++; continue; }
      // ink paints clipped at the name cell's right edge (overflow:hidden)
      const paintR = Math.min(r.nameInk.r, r.cellR);
      const overlap = paintR - r.figsInk.l;
      const trunc = Math.max(0, r.nameInk.r - r.cellR);
      const tag = overlap > 0.5 ? `  OVERLAP ${overlap.toFixed(1)}px` : trunc > 0.5 ? `  ellipsized ${trunc.toFixed(1)}px` : `  ok`;
      if (overlap > 0.5) failures++;
      console.log(`${r.name.padEnd(26)} cellR=${String(r.cellR).padStart(6)} figsL=${String(r.figsInk.l).padStart(6)} figs@${r.fs}${tag}`);
    }
  }
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  if (docW > W) { failures++; console.log(`W${W}: PAGE OVERFLOW scrollWidth=${docW}`); }
}

console.log(failures ? `\nFAIL (${failures})` : "\nALL PASS");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
