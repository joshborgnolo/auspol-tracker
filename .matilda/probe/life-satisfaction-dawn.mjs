import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const puppeteer = createRequire(join(process.cwd(), "package.json"))("puppeteer-core");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
let server = null;
const PAGE = process.env.PAGE || await (async () => {
  const { createServer } = await import("node:http");
  const fs = await import("node:fs");
  const { resolve, extname, sep } = await import("node:path");
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = resolve(ROOT, "." + p);
    if (!file.startsWith(resolve(ROOT) + sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader("Content-Type", { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(file)] || "application/octet-stream");
    fs.createReadStream(file).on("error", () => { res.writeHead(404); res.end(); }).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}/dawn/mood/`;
})();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/opt/homebrew/bin/chromium", headless: "new" });
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (const width of [1366, 820, 390, 320]) {
    const page = await browser.newPage();
    const errors = [], failed = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => failed.push(r.url()));
    await page.setViewport({ width, height: 1000, isMobile: width < 500, hasTouch: width < 500 });
    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => document.querySelector("#life-sources")?.children.length === 4 && document.querySelector("#life-svg")?.childElementCount > 0, { timeout: 30000 });
    const read = () => page.evaluate(() => ({
      head: document.querySelector("#life-h")?.textContent || "",
      dek: document.querySelector("#life > .wrap > header > .dek")?.textContent || "",
      source: document.querySelector("#life-src")?.textContent || "",
      key: document.querySelector("#life-key")?.textContent || "",
      notes: [...document.querySelectorAll("#life-sources h3")].map((el) => el.textContent),
      rows: document.querySelectorAll("#life-table tr").length - 1,
      demo: document.querySelector("#demo-v")?.textContent || "",
      demoMeta: document.querySelector("#demo-meta")?.textContent || "",
      bands: [...document.querySelectorAll("#demo-dist > div")].map((el) => el.textContent),
      svg: document.querySelector("#life-svg")?.innerHTML || "",
      docW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    }));
    const initial = await read();
    assert.ok(initial.head.includes("ANUpoll life satisfaction averaged 6.22 out of 10"), "the ANUpoll latest wave heads the Dawn section");
    assert.ok(initial.dek.includes("Unchanged from 11–26 March 2026"), "its exact comparison window drives the dek");
    assert.ok(initial.source.includes("never pool their levels") && initial.source.includes("Annual HILDA and ABS"), "the raw, separate-source method is explained");
    for (const name of ["HILDA", "ABS General Social Survey", "Scanlon Mapping Social Cohesion"]) assert.ok(initial.key.includes(name), name + " is keyed and narrated from the same store");
    assert.equal(initial.notes.length, 4, "all four source method notes draw");
    assert.equal(initial.rows, 19, "all 19 0–10 means have accessible table rows");
    assert.equal(initial.demo, "61.5", "DemosAU retains the published 61.5 score");
    assert.ok(initial.demoMeta.includes("n = 4,263"), "the DemosAU sample is printed");
    assert.equal(initial.bands.length, 5, "the five DemosAU response bands draw");
    assert.ok(initial.bands.some((b) => b.includes("Satisfied44.6%")), "the published response shares are intact");
    assert.deepEqual(errors, [], `no JavaScript error at ${width}: ${errors.join(" | ")}`);
    assert.deepEqual(failed, [], `no failed page asset at ${width}: ${failed.join(" | ")}`);
    await page.$eval("#life .life-notes details", (el) => { el.open = true; });
    await settle(50);
    assert.equal(await page.$$eval("#life-sources section", (els) => els.length), 4, "the how-each-survey-asks fold opens");
    const labels = await page.$$eval("#life .win button", (els) => els.map((el) => el.textContent.trim()));
    assert.ok(labels.length > 1, "Dawn's normal time-window controls exist");
    await Promise.all([
      settle(150),
      page.$$eval("#life .win button", (els) => els[els.length - 1].click()),
    ]);
    await settle(500);
    const longer = await read();
    assert.notEqual(longer.svg, initial.svg, "switching the time window redraws the chart");
    await page.$eval("#life-svg", (el) => el.scrollIntoView({ block: "center" }));
    await page.$eval("#life-svg", (el) => el.focus({ preventScroll: true }));
    await page.keyboard.press("ArrowLeft");
    await settle(150);
    const tip = await page.$eval("#life-fig .tip", (el) => el.textContent);
    assert.ok(tip.length > 8 && (tip.includes("ANUpoll") || tip.includes("HILDA") || tip.includes("ABS")), "keyboard navigation exposes a real survey reading, not an empty chart");
    const final = await read();
    assert.ok(final.docW <= final.innerW, `no horizontal document overflow at ${width}: ${final.docW} <= ${final.innerW}`);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
console.log("PASS: Dawn mood life satisfaction, 19 accessible means, separate source methods, DemosAU distribution, time window, keyboard reading and responsive width");
