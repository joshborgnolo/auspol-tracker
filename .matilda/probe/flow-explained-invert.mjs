import { createRequire } from "module";
const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const BASE = "http://127.0.0.1:8971";
const HEIGHT = 330, PAD_T = 16, INNER = HEIGHT - PAD_T - 40;
const cyFor = (v) => PAD_T + (100 - v) / 100 * INNER; // svg viewBox coords

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE + "/flows-explained/", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".ex-chart svg", { timeout: 30000 });

const read = async () => page.evaluate(() => {
  const chart = document.querySelector(".ex-chart");
  const title = chart.querySelector(".fc-unit").textContent;
  /* the Share flip's button (the Direction ctl before 2026-10-21's "Share:"
   rename); the bar's OTHER flip is the pairing, so address this one by its
   ctl */
  const flip = document.querySelector(".ex-flow-flip .ex-share .rd-pl-flip");
  const cys = Array.from(chart.querySelectorAll("svg circle")).map((c) => c.cy.baseVal.value);
  return { title, flip: flip ? flip.textContent.trim() : null, cys };
});
const clickChip = async (txt) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll(".ex-flow-flip .ex-flow-chips .ex-chip")).find((x) => x.textContent === t);
  b.click();
}, txt);
const clickFlip = async () => page.evaluate(() => {
  document.querySelector(".ex-flow-flip .ex-share .rd-pl-flip").click();
});
const hasCyNear = (cys, want, tol = 0.75) => cys.some((c) => Math.abs(c - want) < tol);

let ok = true;
const say = (good, msg) => { console.log((good ? "PASS " : "FAIL ") + msg); if (!good) ok = false; };

let r = await read();
say(r.flip === "Labor ⇄", "Share button opens as: " + JSON.stringify(r.flip));
say(r.title === "Share preferencing Labor over the Coalition in Australian federal elections", "default title: " + r.title);
say(hasCyNear(r.cys, cyFor(88.2)), "Greens 2025 dot at y for 88.2 (" + cyFor(88.2).toFixed(1) + ")");

await clickFlip();
await new Promise((res) => setTimeout(res, 700));
r = await read();
say(r.flip === "Coalition ⇄", "Share button now reads: " + JSON.stringify(r.flip));
say(r.title === "Share preferencing the Coalition over Labor in Australian federal elections", "inverted title: " + r.title);
say(hasCyNear(r.cys, cyFor(11.8)), "Greens 2025 dot mirrored to y for 11.8 (" + cyFor(11.8).toFixed(1) + ")");

// jurisdiction chip while inverted: basis persists, title switches elections phrase
await clickChip("Vic");
await new Promise((res) => setTimeout(res, 700));
r = await read();
say(r.flip === "Coalition ⇄", "Share persisted past jurisdiction chip: " + JSON.stringify(r.flip));
say(r.title === "Share preferencing the Coalition over Labor in Victorian state elections", "inverted title after Victoria chip: " + r.title);
say(hasCyNear(r.cys, cyFor(15)), "Victoria Greens 2022 dot mirrored to y for 15 (" + cyFor(15).toFixed(1) + ", est 85 -> 15)");

await clickFlip();
await new Promise((res) => setTimeout(res, 700));
r = await read();
say(r.flip === "Labor ⇄", "Share back reads: " + JSON.stringify(r.flip));
say(r.title === "Share preferencing Labor over the Coalition in Victorian state elections", "flipped back: " + r.title);
say(hasCyNear(r.cys, cyFor(85)), "Victoria Greens 2022 dot back at y for 85 (" + cyFor(85).toFixed(1) + ")");

await browser.close();
console.log(ok ? "ALL PASS" : "FAILURES ABOVE");
process.exit(ok ? 0 : 1);
