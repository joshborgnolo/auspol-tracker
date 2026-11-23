import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.PAGE || `file://${ROOT}/allpolls/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox"],
});
let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) failures++;
};
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  for (const width of [1440, 1000, 768, 390, 320]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
    await settle(800);
    const opened = await page.evaluate(() => {
      const key = window.AP.pollRowKey({ pollster: "DemosAU (MRP)", released: "2025-11-11" });
      window.AP.openPoll(key, "twopp", "probe");
      return Boolean(key);
    });
    check(opened, `${width}: opened the Oct–Nov 2025 DemosAU MRP`);
    await settle(400);
    const summary = await page.evaluate(() => {
      const line = [...document.querySelectorAll(".rd-ap-open .rd-ldg-line")].find((el) => el.querySelector(".rd-ldg-lab")?.textContent === "Demographics");
      return line?.textContent.replace(/\s+/g, " ") || "";
    });
    check(summary.includes("plus One Nation by 2025 vote, place, age and education"), `${width}: the ledger summary points to the new cross-tabulations`);
    await page.evaluate(() => {
      const key = window.AP.pollRowKey({ pollster: "DemosAU (MRP)", released: "2025-11-11" });
      window.AP.openPoll(key, "demographics", "probe");
    });
    await page.waitForSelector(".rd-ap-open .rd-apd-on25", { timeout: 10000 });
    const result = await page.evaluate(() => {
      const payload = window.AUSPOL.individualPolls.find((p) => p.pollster === "DemosAU (MRP)" && p.released === "2025-11-11")?.grp?.onp2025;
      const tables = [...document.querySelectorAll(".rd-ap-open .rd-apd-on25-t")];
      return {
        captions: tables.map((table) => table.caption.textContent.replace(/\s+/g, " ")),
        labels: tables.map((table) => table.parentElement.querySelector(".rd-apd-on25-tag")?.textContent),
        rows: tables.map((table) => [...table.tBodies].flatMap((body) => [...body.rows].filter((row) => !row.classList.contains("rd-apd-on25-loc"))).length),
        values: tables.map((table) => [...table.querySelectorAll("td")].map((cell) => cell.textContent)),
        expected: payload ? ["lnp", "alp"].map((cohort) => Object.values(payload[cohort]).flatMap((ages) => Object.values(ages).flatMap((cells) => Object.values(cells).map(String)))) : [],
        note: document.querySelector(".rd-ap-open .rd-apd-on25 > .rd-apd-note")?.textContent || "",
        documentWidth: document.documentElement.scrollWidth,
        columns: getComputedStyle(document.querySelector(".rd-ap-open .rd-apd-on25-cols")).gridTemplateColumns,
      };
    });
    check(JSON.stringify(result.captions) === JSON.stringify(["One Nation share of 2025 Coalition voters", "One Nation share of 2025 Labor voters"]), `${width}: both report captions render`);
    check(result.labels.every((label) => label === "Modelled, MRP estimates"), `${width}: both tables carry the Modelled, MRP estimates label`);
    check(JSON.stringify(result.rows) === JSON.stringify([9, 9]), `${width}: three locations × three ages in each table`);
    check(result.values.every((values, i) => JSON.stringify(values) === JSON.stringify(result.expected[i])), `${width}: all 45 cells per cohort match the data bundle (90 total)`);
    check(result.note.includes("switch rates, not the primary-vote shares"), `${width}: the table's denominator is explicit`);
    check(result.documentWidth <= width, `${width}: no horizontal document overflow (${result.documentWidth}px)`);
    check(width > 900 ? result.columns.split(" ").length === 2 : !result.columns.includes(" "), `${width}: cohort tables ${width > 900 ? "sit side by side" : "stack"}`);
    check(errors.length === 0, `${width}: no page errors${errors.length ? ` — ${errors.join(" | ")}` : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failures ? 1 : 0);
