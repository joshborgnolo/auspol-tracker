import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1366, height: 1000 });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("#primary-vote .rd-pv-head .ap-pop", { timeout: 30000 });
await page.waitForSelector("#confidence .rd-cwin-tools .ap-pop");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);

const ok = (condition, label, detail) => {
  console.log((condition ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " — " + JSON.stringify(detail)));
  assert.ok(condition, label);
};
const labels = (scope) => page.evaluate((scope) => [...document.querySelectorAll(scope + " .ap-popbtn")].map((b) => ({
  label: b.querySelector(".ap-popbtn-lab").textContent,
  summary: b.querySelector(".ap-popbtn-val") ? b.querySelector(".ap-popbtn-val").textContent : null,
  open: b.getAttribute("aria-expanded") === "true",
  focused: document.activeElement === b,
})), scope);
const open = async (scope, label) => {
  const closed = await page.evaluate(({ scope, label }) => {
    const button = [...document.querySelectorAll(scope + " .ap-popbtn")].find((b) => b.querySelector(".ap-popbtn-lab").textContent === label);
    if (!button) throw new Error("No menu " + label + " under " + scope);
    button.scrollIntoView({ block: "center" });
    button.setAttribute("data-filter-probe", label);
    return button.getAttribute("aria-expanded") !== "true";
  }, { scope, label });
  if (closed) await page.click(`${scope} [data-filter-probe="${label}"]`);
  await page.waitForSelector(scope + " .ap-panel", { timeout: 5000 });
  await sleep(130);
};
const pick = async (scope, label, choice) => {
  await open(scope, label);
  await page.evaluate(({ scope, choice }) => {
    const panel = [...document.querySelectorAll(scope + " .ap-panel")].at(-1);
    const row = [...panel.querySelectorAll(".ap-check")].find((b) => b.querySelector(".ap-check-lab").textContent === choice);
    if (!row) throw new Error("No option " + choice + " in " + scope);
    row.click();
  }, { scope, choice });
  await sleep(200);
};
const escape = async (scope, label) => {
  await page.keyboard.press("Escape");
  await sleep(100);
  return page.evaluate(({ scope, label }) => {
    const b = [...document.querySelectorAll(scope + " .ap-popbtn")].find((x) => x.querySelector(".ap-popbtn-lab").textContent === label);
    return b && b.getAttribute("aria-expanded") === "false" && document.activeElement === b;
  }, { scope, label });
};
const outside = async () => { await page.mouse.click(3, 3); await sleep(120); };
const chooseGender = async () => {
  await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-tabs button")].find((b) => b.textContent.trim() === "Gender")?.click());
  await sleep(850);
};

const PV = "#primary-vote .rd-pv-head";
ok(!(await page.evaluate(() => !!document.querySelector("#primary-vote select"))), "Primary has no native select left");
await pick(PV, "Among", "Men");
const groupPicked = await labels(PV);
ok(groupPicked.length === 1 && groupPicked[0].summary === "Men" && !groupPicked[0].open && groupPicked[0].focused,
  "Primary group selection closes immediately and restores focus", groupPicked);
await open(PV, "Among");
ok(await escape(PV, "Among"), "Primary group Escape closes and returns focus");
await pick(PV, "Among", "All voters");
await outside();
ok((await labels(PV)).every((x) => !x.open), "Primary group closes on outside click");
await pick(PV, "Pollsters", "Essential");
const pvOneHouse = await labels(PV);
ok(pvOneHouse[1].summary === "1 pollster" && pvOneHouse[1].open, "Pollster checkbox stays open after one selection", pvOneHouse);
await pick(PV, "Pollsters", "Resolve");
const pvTwoHouses = await labels(PV);
ok(pvTwoHouses[1].summary === "2 pollsters" && pvTwoHouses[1].open, "Pollster checkbox stays open for multiple selections", pvTwoHouses);
await page.evaluate((scope) => document.querySelector(scope + " .ap-clear").click(), PV);
await sleep(120);
ok((await labels(PV))[1].summary === "All", "Primary pollster Clear restores all houses", await labels(PV));
ok(await escape(PV, "Pollsters"), "Primary pollster Escape closes and returns focus");

await chooseGender();
const WV = "#who-votes .rd-wv-gap-set";
await page.waitForSelector(WV + " .rd-wv-gap-choice .ap-popbtn");
const beforeGap = await labels(WV);
ok(beforeGap.some((b) => b.label === "Compare" && b.summary === "Women") && beforeGap.some((b) => b.label === "Reference" && b.summary === "Men"), "Who-votes comparison and reference faces show their current groups", beforeGap);
await pick(WV, "Reference", "Women");
const swapped = await labels(WV);
ok(swapped.every((b) => !b.open) && swapped.some((b) => b.label === "Compare" && b.summary === "Men") && swapped.some((b) => b.label === "Reference" && b.summary === "Women"),
  "Who-votes reference selection swaps groups and closes immediately", swapped);
await open(WV, "Reference");
ok(await escape(WV, "Reference"), "Who-votes Escape closes and returns focus");
await pick(WV, "Compare", "Men");
ok((await labels(WV))[0].focused && !(await labels(WV))[0].open, "Who-votes Compare also closes and restores focus", await labels(WV));
await pick(WV, "Reference", "Men");
ok((await labels(WV)).some((b) => b.label === "Compare" && b.summary === "Women"), "Who-votes reference can be restored");

const CF = "#confidence .rd-cwin-tools";
const cf0 = await labels(CF);
ok(cf0.some((b) => b.label === "Draw a past term" && !b.summary), "Economic sentiment term menu starts without drawn additions", cf0);
const years = await page.evaluate(async () => {
  const { D } = window.AUSPOL;
  return ["2019", "2016"];
});
for (const year of years) await pick(CF, "Draw a past term", year);
const cfDrawn = await labels(CF);
ok(cfDrawn.some((b) => b.summary === "2 terms") && cfDrawn[0].open, "Economic term checkboxes accumulate while staying open", cfDrawn);
await page.evaluate((scope) => document.querySelector(scope + " .ap-clear").click(), CF);
await sleep(120);
ok(!(await labels(CF))[0].summary, "Economic sentiment Clear lines removes the drawn terms");
ok(await escape(CF, "Draw a past term"), "Economic sentiment Escape closes and returns focus");

for (const width of [390, 320]) {
  await page.setViewport({ width, height: 900 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#primary-vote .rd-pv-head .ap-pop");
  await sleep(700);
  await open(PV, "Among");
  const phonePop = await page.evaluate(() => {
    const p = document.querySelector("#primary-vote .rd-pv-head .ap-panel").getBoundingClientRect();
    return { left: p.left, right: p.right, viewport: innerWidth, doc: document.documentElement.scrollWidth };
  });
  ok(phonePop.left >= 0 && phonePop.right <= width && phonePop.doc <= width, `Primary group popover fits the ${width}px phone`, phonePop);
  await page.keyboard.press("Escape");
  await chooseGender();
  await open(WV, "Reference");
  const flipped = await page.evaluate(() => {
    const p = document.querySelector("#who-votes .rd-wv-gap-set .ap-panel");
    const r = p.getBoundingClientRect();
    return { left: r.left, right: r.right, viewport: innerWidth, flip: p.classList.contains("flip"), doc: document.documentElement.scrollWidth };
  });
  ok(flipped.left >= 0 && flipped.right <= width && flipped.doc <= width, `Who-votes right-edge popover fits the ${width}px phone`, flipped);
}

ok(errors.length === 0, "No browser errors while operating the five menus", errors);
await browser.close();
server.close();
console.log("All five shared panel dropdown checks passed");
