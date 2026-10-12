/* headless probe of DemosAU MRP preference flows (2026-10-12):
   - the opened MRP poll's "Preferences" line in Also in this poll: its region
     chip opens on All regions (gen-data's enrolment-and-vote weighting) and
     presses cycle Inner metro → Outer metro → Regional → All regions, showing
     that region's printed cells, and a press never moves the line's box
     (same width/height at every step);
   - the forced-choice Labor v Coalition chart carries one .rd-ff-dm diamond
     per filed MRP, and the key names them.
   Run against a built tree: node .matilda/probe/mrp-prefs.mjs [shotDir] */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "allpolls", "index.html");
const SHOT = process.argv[2] || null;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
for (const w of [1440, 1024, 768, 390]) {
  console.log("width " + w);
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 1400, deviceScaleFactor: 2, hasTouch: w < 700, isMobile: w < 700 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#flow-drift", { timeout: 30000 });
  const dm = await page.evaluate(() => ({ n: document.querySelectorAll("#flow-drift .rd-ff-dm").length,
    key: !!document.querySelector("#flow-drift .rd-ff-keydm") }));
  check(dm.n === 3, "three DemosAU diamonds (" + dm.n + ")");
  check(dm.key, "the key names the diamonds");
  if (SHOT) {
    const el = await page.$("#flow-drift .rd-ff");
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await wait(300);
    await el.screenshot({ path: path.join(SHOT, `ff-${w}.png`) });
  }
  const opened = await page.evaluate(() => {
    const k = window.AP.pollRowKey({ pollster: "DemosAU (MRP)", released: "2026-09-19" });
    if (!k) return false;
    window.AP.openPoll(k, "twopp", "probe");
    return true;
  });
  check(opened, "opened the Aug–Sep MRP");
  await wait(1200);
  const steps = [];
  for (let i = 0; i < 5; i++) {
    steps.push(await page.evaluate(() => {
      const b = document.querySelector(".rd-ldg-cyc");
      if (!b) return null;
      const line = b.closest(".rd-ldg-line"), r = line.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { region: b.querySelector(".on").textContent, text: line.querySelector(".rd-ldg-lbody").innerText.replace(/\s+/g, " "),
               w: r.width, h: r.height, bw: br.width, bh: br.height };
    }));
    if (SHOT && i < 4) {
      const el = await page.$(".rd-ldg-also");
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await wait(100);
      await el.screenshot({ path: path.join(SHOT, `also-${w}-${i}.png`) });
    }
    await page.click(".rd-ldg-cyc");
    await wait(150);
  }
  check(steps.every(Boolean), "the Preferences line is there");
  if (steps.every(Boolean)) {
    console.log("   " + steps.map((s) => s.region + ": " + s.text).join("\n   "));
    check(steps.map((s) => s.region).join(">") === "All regions>Inner metro>Outer metro>Regional>All regions", "opens on All regions, cycles the three regions and wraps");
    check(/ON 18 to ALP v L\/NP, nationwide/.test(steps[0].text), "the nationwide One Nation flow closes the line");
    check(steps.every((s) => s.w === steps[0].w && s.h === steps[0].h && s.bw === steps[0].bw), "line and chip hold their size");
    check(/L\/NP 48/.test(steps[1].text) && /L\/NP 37/.test(steps[2].text) && /L\/NP 30/.test(steps[3].text), "regional cells read through");
    const lh = await page.evaluate(() => { const l = document.querySelector(".rd-ldg-lines .rd-ldg-line"); return l.getBoundingClientRect().height; });
    console.log("   line h " + steps[0].h + " (first line " + lh + "), chip " + steps[0].bw.toFixed(1) + "×" + steps[0].bh.toFixed(1));
  }
  check(!errs.length, "no page errors " + errs.join(" | "));
  await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
