import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8983;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
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

const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function walkRow(page, name, sel) {
  const n = await page.$$eval(sel, (els) => els.length);
  if (n < 2) { fails.push(name + ": only " + n + " tabs"); return; }
  /* click like a pointer user: Safari/Firefox-mac leave the button UNFOCUSED,
     which is what the rdTabFocus click handler repairs */
  await page.click(sel);
  await sleep(120);
  const fIdx = await page.evaluate((s) => {
    const els = [...document.querySelectorAll(s)];
    return els.indexOf(document.activeElement && document.activeElement.closest ? document.activeElement.closest("button") : null);
  }, sel);
  if (fIdx !== 0) { fails.push(name + ": click left focus at " + fIdx); return; }
  const state = () => page.evaluate((s) => {
    const els = [...document.querySelectorAll(s)];
    return {
      pressed: els.findIndex((b) => b.getAttribute("aria-pressed") === "true"),
      active: els.indexOf(document.activeElement && document.activeElement.closest ? document.activeElement.closest("button") : null),
    };
  }, sel);
  const step = async (key, want, tag) => {
    await page.keyboard.press(key);
    await sleep(80);
    const s = await state();
    if (s.pressed !== want || s.active !== want)
      fails.push(name + " " + tag + " want " + want + " got " + JSON.stringify(s));
  };
  for (let j = 1; j < n; j++) { await step("ArrowRight", j, "right[" + j + "]"); if (fails.some((f) => f.startsWith(name))) return; }
  await step("ArrowRight", 0, "wrapRight");
  await step("ArrowLeft", n - 1, "wrapLeft");
  for (let j = n - 2; j >= 0; j--) { await step("ArrowLeft", j, "left[" + j + "]"); if (fails.some((f) => f.startsWith(name))) return; }
}

async function gotoView(page, hash, waitSel) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForSelector(waitSel, { timeout: 15000 });
  await sleep(700);
}

/* laptop rung: every RdTabs/builder row the request named */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#issues", { timeout: 20000 });
  await sleep(600);
  /* the Time-range toggle exists on BOTH the 2PP hero and the Primary
     card - walk each scoped to its section */
  await walkRow(page, "hero-range", '#two-party [aria-label="Time range"] button');
  await walkRow(page, "primary-range", '#primary-vote [aria-label="Time range"] button');
  await walkRow(page, "latest-polls", '#latest-polls .rd-tabs [role="group"] button');
  await walkRow(page, "ppm-question", '[aria-label="Preferred prime minister question"] button');
  await walkRow(page, "leader-rating", '[aria-label="Leader rating"] button');
  await walkRow(page, "who-votes-groups", '#who-votes [aria-label="Group voters by"] button');
  await walkRow(page, "undecided", '[aria-label="Decidedness among"] button');
  /* the whom view sits behind its own tab */
  await page.evaluate(() => document.querySelectorAll('#issues .rd-is-tabs button')[1].click());
  await sleep(700);
  await walkRow(page, "whom-groups", '#issues [aria-label="Group voters by"] button');
  /* All polls and Past cycles are page views of their own (hash-driven) */
  await gotoView(page, "allpolls", '.rd-ap-tabs [role="group"] button');
  await walkRow(page, "all-polls", '.rd-ap-tabs [role="group"] button');
  await gotoView(page, "cycles", '[aria-label="Compare with"] button');
  await walkRow(page, "cycles-compare", '[aria-label="Compare with"] button');
  await walkRow(page, "cycles-measure", '[aria-label="Measure"] button');
  await page.close();
}

/* tablet rung: the whom panel's grouping menu (an RdTabs since 1e2838f)
   takes the same walk */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#issues", { timeout: 20000 });
  await sleep(600);
  await page.evaluate(() => document.querySelectorAll('#issues .rd-is-tabs button')[1].click());
  await sleep(700);
  await walkRow(page, "whom-menu", '#issues .rd-iw-tabs [aria-label="Group voters by"] button');
  await page.close();
}

console.log(fails.length ? "FAIL " + fails.join(", ") : "ok");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
