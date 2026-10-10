/* Probe (run: node .matilda/probe/conf-byline.mjs, from the repo root of the
   checkout under test): the Confidence facet's opened-row sentence
   ("Conducted on …, published by …") must byline the HOUSE that prints the
   gauge, never its product line. A confidence release keeps its product
   (Consumer Confidence, Consumer Sentiment, Business Confidence) in the
   client slot, and rdPollHead read any non-self client as a publisher -
   every confidence row printed "published by the Consumer Confidence".
   The fix bylines the pollster slot's house on confidence rows (p.conf)
   and leaves the client path alone for real polls. Walks to the Confidence
   facet, opens one row per lane, asserts the sentence; opens a 2PP-facet
   poll row as the regression guard for the client/pollster path; ends with
   a SOURCE pin on the p.conf branch in rdPollHead. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const LANES = [
  { match: (t) => t.includes("ANZ–Roy Morgan"), house: "ANZ–Roy Morgan", by: "published by ANZ–Roy Morgan" },
  { match: (t) => t.includes("Westpac–MI"), house: "Westpac–MI", by: "published by Westpac–MI" },
  { match: (t) => t.includes("Business Confidence") && t.includes("Roy Morgan") && !t.includes("ANZ–Roy"), house: "Roy Morgan", by: "published by Roy Morgan" },
  { match: (t) => t.includes("NAB"), house: "NAB", by: "published by NAB" },
];
const PRODUCT_BYLINE = /published by the (Consumer|Business) (Confidence|Sentiment)/;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

await page.setViewport({ width: 1366, height: 980, deviceScaleFactor: 1 });
await page.goto(PAGE + "allpolls/?f=c", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(
  () => {
    const a = document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']");
    return a && a.textContent.trim() === "Confidence" && document.querySelectorAll(".rd-ap .rd-ap-row").length > 0;
  },
  { timeout: 30000 });

/* one row per lane, byline is the house and never the product */
for (const lane of LANES) {
  const idx = await page.evaluate((src) => {
    const f = new Function("t", "return (" + src + ")(t)");
    const rows = [...document.querySelectorAll(".rd-ap .rd-ap-row")];
    return rows.findIndex((r) => f(r.textContent));
  }, lane.match.toString());
  check(idx >= 0, `lane row present in first page of Confidence rows (${lane.by.replace("published by ", "")})`);
  if (idx < 0) continue;
  await page.evaluate((i) => {
    [...document.querySelectorAll(".rd-ap .rd-ap-row")][i].click();
  }, idx);
  await page.waitForFunction(
    (house) => {
      const d = document.querySelector(".rd-ap-open .poll-detail");
      return d && d.getAttribute("data-pollster") === house && d.querySelector(".rd-apd-h");
    },
    { timeout: 10000 }, lane.house).catch(() => {});
  const head = await page.evaluate(() => {
    const el = document.querySelector(".rd-ap-open .rd-apd-h");
    return el ? el.textContent.trim() : null;
  });
  check(head != null, `detail sentence rendered for ${lane.by.replace("published by ", "")}`);
  if (head == null) continue;
  check(head.includes(lane.by), `byline is the house (${JSON.stringify(head.slice(Math.max(0, head.indexOf("published by") - 1), head.indexOf("published by") + 45))})`);
  check(!PRODUCT_BYLINE.test(head), "never the product line as publisher");
}

/* regression guard: a real poll's client/pollster byline is untouched */
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-ap-tabs .rd-tab")].find((el) => el.textContent.trim() === "2PP")?.click();
});
await page.waitForFunction(
  () => {
    const a = document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']");
    return a && a.textContent.trim() !== "Confidence" && document.querySelectorAll(".rd-ap .rd-ap-row").length > 0;
  },
  { timeout: 15000 }).catch(() => { check(false, "2PP facet opened after the Confidence walk"); });
await page.evaluate(() => { document.querySelector(".rd-ap .rd-ap-row").click(); });
await page.waitForFunction(() => !!document.querySelector(".rd-ap-open .rd-apd-h"), { timeout: 10000 });
const pollHead = await page.evaluate(() => document.querySelector(".rd-ap-open .rd-apd-h").textContent.trim());
check(pollHead.includes("published by ") && (pollHead.startsWith("Conducted on ") || pollHead.startsWith("From ")),
  `poll row sentence intact (${JSON.stringify(pollHead.slice(0, 60))}…)`);

/* SOURCE pin: confidence rows byline the house slot, not the product-slot client */
const src = await import("fs").then((fs) => fs.default.readFileSync(path.resolve(process.cwd(), ".build/newtracker/assets/rd-allpolls.jsx"), "utf8"));
check(src.includes('"published by " + (p.conf ? p.pollster : p.client'), "rdPollHead bylines the house on confidence rows");

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
