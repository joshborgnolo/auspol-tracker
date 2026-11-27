import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch {}
}
if (!puppeteer) throw new Error("puppeteer-core is not resolvable from the working directory or home");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.PAGE || `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/opt/homebrew/bin/chromium", headless: "new" });
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (const width of [1280, 820, 390, 320]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport({ width, height: 900, isMobile: width < 500, hasTouch: width < 500 });
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".rd-mood-tabs button", { timeout: 30000 });
    const labels = await page.$$eval(".rd-mood-tabs button", (els) => els.map((el) => el.textContent.trim()));
    assert.deepEqual(labels, ["Direction", "Trust in government", "Life satisfaction"], "National mood has three views");
    await page.$$eval(".rd-mood-tabs button", (els) => els.find((el) => el.textContent.trim() === "Life satisfaction").click());
    await settle(900);
    const proof = await page.evaluate(() => ({
      chart: !!document.querySelector(".rd-life-chart svg"),
      chartText: document.querySelector(".rd-life-chart")?.textContent || "",
      snapshot: document.querySelector(".rd-life-snapshot")?.textContent || "",
      dots: document.querySelectorAll(".rd-life-chart svg circle").length,
      rows: window.AP.D.lifeSat.series.reduce((n, s) => n + s.readings.length, 0),
      docW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      heading: document.querySelector("#direction .rd-hed")?.textContent || "",
      sourceNotes: document.querySelectorAll(".rd-dirq-house").length,
    }));
    assert.equal(errors.length, 0, `no JS error at ${width}: ${errors.join(" | ")}`);
    assert.ok(proof.chart, "the life-satisfaction chart draws");
    assert.ok(proof.heading.includes("out of 10"), "the latest national mean heads the view");
    assert.ok(proof.chartText.includes("ANUpoll") && proof.chartText.includes("HILDA"), "both time series are keyed");
    assert.ok(proof.chartText.includes("ABS General Social Survey") && proof.chartText.includes("Scanlon Mapping Social Cohesion"), "sparse sources are keyed");
    assert.ok(!proof.chartText.includes("61.5") && !proof.chartText.includes("DemosAU"), "the 0–100 snapshot never enters the 0–10 chart");
    assert.ok(proof.snapshot.includes("DemosAU") && proof.snapshot.includes("61.5/100"), "DemosAU's snapshot retains its own 0–100 basis");
    assert.ok(proof.snapshot.includes("Very satisfied") && proof.snapshot.includes("44.6%"), "the snapshot retains the response distribution");
    assert.ok(proof.dots >= proof.rows, `raw reading marks draw (${proof.dots} >= ${proof.rows})`);
    assert.equal(proof.sourceNotes, 4, "each chart source carries its own question and method note");
    assert.ok(proof.docW <= proof.innerW, `no horizontal document overflow at ${width}: ${proof.docW} <= ${proof.innerW}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("PASS: National mood Life satisfaction, separate source means and scales, responsive down to 320px");
