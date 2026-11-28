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
      key: document.querySelector(".rd-life-chart")?.textContent || "",
      cards: document.querySelectorAll("#direction .card").length,
      docW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      heading: document.querySelector("#direction .rd-hed")?.textContent || "",
      fig: document.querySelector("#direction .rd-dir-figs")?.textContent || "",
      notes: document.querySelector("#direction .rd-dirq")?.textContent || "",
      now: window.AP.D.lifeSat.model.now,
    }));
    assert.equal(errors.length, 0, `no JS error at ${width}: ${errors.join(" | ")}`);
    assert.ok(proof.chart, "the life-satisfaction chart draws");
    assert.equal(proof.cards, 1, "one chart card, as the other mood views");
    assert.ok(proof.heading.includes("out of 10"), "the estimate heads the view");
    assert.ok(proof.fig.includes(proof.now.v.toFixed(2)) && proof.fig.includes("95% interval"), "the figure carries its interval");
    assert.ok(proof.key.includes("Estimate on ANUpoll’s terms") && !proof.key.includes("HILDA"), "this term's key names only what it shows");
    await page.$$eval("#direction button", (els) => els.find((el) => el.textContent.trim() === "All").click());
    await settle(900);
    const all = await page.$eval(".rd-life-chart", (el) => el.textContent);
    assert.ok(all.includes("HILDA, as printed, not in the line") && all.includes("Scanlon Mapping Social Cohesion, as printed, not in the line"), "All keys what is left out of the line");
    assert.ok(!proof.key.includes("DemosAU") && proof.notes.includes("DemosAU") && proof.notes.includes("61.5 out of 100"), "DemosAU sits in the notes, off the chart");
    assert.ok(proof.docW <= proof.innerW, `no horizontal document overflow at ${width}: ${proof.docW} <= ${proof.innerW}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("PASS: National mood Life satisfaction, one model line and one card, responsive down to 320px");
