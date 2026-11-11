// The Marital status select lens on /map/, headless-browser probes:
//
//   - the People menu of the census lens gains "Marital status" on every
//     frame whose res/store carries marKeys, and hides where they sit out
//     the era (nsw15's flat frame packs no select lanes);
//   - landing on an option strings through the URL state
//     (i=mar&ma=<option>) and writes it back untouched;
//   - the legend note names people aged 15+ and the census's registered
//     marital status over any other living arrangement claim (love);
//   - the option set is exactly the five printed categories and Married
//     lands on an unpicked open;
//   - swapping the option repaints (readingKey turns).
//
// Every scenario reloads INTO the URL (the map page applies URL state at
// boot only), on a fresh tab each time. Uses local Chrome.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd(), PORT = 8982, checks = [];
const check = (name, cond) => { assert.ok(cond, name); checks.push(name); console.log("PASS", name); };

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".json") ? "application/json" : "text/html");
    fs.createReadStream(file).pipe(res);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, args: ["--no-sandbox"], protocolTimeout: 180000,
  });
  const errors = [];
  async function scenario(fragment) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/map/#${fragment}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__map && __map.S, { timeout: 120000 });
    return page;
  }

  // 1. 2025: the People menu gains the lens and the model carries the keys
  let page = await scenario("y=2025&l=seifa");
  check("2025 frame carries its marKeys into the model", await page.evaluate(() => (__map.M().marKeys || []).join() === "marr,never,sep,div,wid"));
  check("census menu gains Marital status where keys ride", await page.evaluate(() => document.body.textContent.includes("Marital status")));
  await page.close();

  // 2. landing straight at the lens: Married lands, the basis names its people
  page = await scenario("y=2025&l=seifa&i=mar");
  await page.waitForFunction(() => __map.S.index === "mar", { timeout: 120000 });
  check("an unpicked open lands Married", await page.evaluate(() => __map.S.mar === "marr"));
  const note2025 = await page.evaluate(() => document.querySelector("#legend").innerText + document.querySelector(".lg-basis").innerText);
  check("legend names 15+ people and the registered basis", /people aged 15\+/.test(note2025) && /registered marital status/.test(note2025));
  check("readingKey turns on the option", await page.evaluate(async () => {
    const k1 = __map.readingKey(__map.M());
    __map.S.mar = "wid"; await new Promise((r) => setTimeout(r, 60));
    const k2 = __map.readingKey(__map.M());
    __map.S.mar = "marr";
    return k1 !== k2;
  }));
  const menu = await page.evaluate(() => document.querySelector("#lgmenu-mar") ? document.querySelector("#lgmenu-mar").innerText : "");
  const baseNames = ["Married", "Never married", "Separated", "Divorced", "Widowed"];
  check("the picker lists exactly the five options", baseNames.every((n) => menu.includes(n)));
  check("the picker's wording is option-order Married first",
    menu.indexOf("Married") < menu.indexOf("Never married") && menu.indexOf("Never married") < menu.indexOf("Separated") && menu.indexOf("Separated") < menu.indexOf("Divorced") && menu.indexOf("Divorced") < menu.indexOf("Widowed"));
  await page.close();

  // 3. URL state round-trip at a picked option
  page = await scenario("y=2025&l=seifa&i=mar&ma=wid");
  await page.waitForFunction(() => __map.S.index === "mar" && __map.S.mar === "wid", { timeout: 120000 });
  check("the URL lands the Widowed option", await page.evaluate(() => __map.S.mar === "wid"));
  const widNote = await page.evaluate(() => document.getElementById("legend").innerText);
  check("the legend says Widowed of people 15+", /Widowed/.test(widNote) && /15\+/.test(widNote));
  const urlBack = await page.evaluate(() => new Promise((r) => setTimeout(() => r(location.hash), 400)));
  check("the URL keeps i=mar and ma=wid after ready", /i=mar/.test(urlBack) && /ma=wid/.test(urlBack));
  await page.close();

  // 4. a state frame: vic22 carries key and figure
  page = await scenario("y=vic22&l=seifa");
  await page.waitForFunction(() => __map.M().marKeys, { timeout: 120000 });
  check("vic22 menu carries Marital status", await page.evaluate(() => document.body.textContent.includes("Marital status")));
  check("vic22 division figures land", await page.evaluate(() => {
    const m = __map.M(), d = m.divs.find((d) => /brighton/i.test(d.n));
    return d.demo && d.demo.mar && d.demo.mar.marr > 0.35 && d.demo.mar.marr < 0.65;
  }));
  await page.close();

  // 5. an era-null frame never offers a dead option (its siblings sit out too)
  page = await scenario("y=nsw15&l=seifa");
  check("nsw15 has no select keys at the model (all select lanes stay out)",
    await page.evaluate(() => !__map.M().marKeys && !__map.M().ancKeys && !__map.M().relKeys));
  check("nsw15's menu shows no Marital status entry", await page.evaluate(() => !document.body.textContent.includes("Marital status")));
  await page.close();

  check("no page errors anywhere in the probes", errors.length === 0);
  console.log(`test-map-marital: ok — ${checks.length} checks`);
} finally {
  if (browser) await browser.close();
  server.close();
}
