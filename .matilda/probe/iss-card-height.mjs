// Measure phone (390px) card heights per All-polls facet and the block
// anatomy of the issues card: what actually drives the extra height, and
// where the pairfig sits relative to the top-issue csub.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try {
    puppeteer = createRequire(join(base, "package.json"))("puppeteer-core");
    break;
  } catch { /* next */ }
}
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.LIVE ? "https://auspoltracker.com/" : `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const FACETS = ["2PP", "Primary", "Leaders", "Direction", "Issues"];

for (const w of [390, 360]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 844 });
  await page.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  for (const f of FACETS) {
    await page.evaluate((label) => {
      const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => n.textContent.trim() === label);
      t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, f);
    await new Promise((r) => setTimeout(r, 450));
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".rd-ap-card")];
      const hs = cards.slice(0, 8).map((c) => +c.getBoundingClientRect().height.toFixed(1));
      const first = cards[0];
      const blocks = first ? [...first.children].map((el) => {
        const b = el.getBoundingClientRect();
        return { cls: el.className.split(" ").find((c) => c.startsWith("rd-ap-c")), h: +b.height.toFixed(1), y: +b.top.toFixed(1) };
      }) : [];
      const pair = first && first.querySelector(".rd-ap-pairfig");
      const pic = first && first.querySelector(".rd-ap-cpic");
      const inEl = pic && pic.querySelector(".rd-ap-in");
      const dots = pic ? [...pic.querySelectorAll(".rd-ap-dot")] : [];
      const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
      return { n: cards.length, hs, blocks, pair: r(pair), picH: pic ? r(pic) : null, inW: r(inEl), nDots: dots.length, cardW: r(first) };
    });
    console.log(`${w}px ${f}: n=${m.n} cardW=${m.cardW && m.cardW.w} heights=[${m.hs.join(", ")}]`);
    if (f === "Issues") console.log(`   blocks: ${m.blocks.map((b) => `${b.cls}=${b.h}`).join(" ")}`);
    if (f === "Issues") console.log(`   pairfig=${JSON.stringify(m.pair)} cpic=${JSON.stringify(m.picH)} inW=${m.inW && m.inW.w} dots=${m.nDots}`);
  }
  await page.close();
}
await browser.close();
