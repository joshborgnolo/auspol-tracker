// Headless probe: the flows-explained jurisdiction chips show the SHORT face
// (Federal, Vic, WA, SA, Qld, NSW) while the chart's own copy keeps the full
// jurisdiction name (user call 2026-10-20; full names ride S.elections in the
// fc-unit line). Serves the worktree on a port; run against a built tree.
import { createRequire } from "module";
const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const BASE = process.env.PROBE_BASE || "http://127.0.0.1:8972";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

let ok = true;
const say = (good, msg) => { console.log((good ? "PASS " : "FAIL ") + msg); if (!good) ok = false; };
const J = JSON.stringify;

for (const path of ["/flows-explained/"]) {
  await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll(".ex-flow-chips button").length > 0, { timeout: 30000 });

  const chips = await page.evaluate(() =>
    [...document.querySelectorAll(".ex-flow-chips button")].map((b) => b.textContent.trim()));
  say(J(chips) === J(["Federal", "Vic", "WA", "SA", "Qld", "NSW"]),
    `${path} chip faces are the short forms: ${J(chips)}`);

  // the chart's own copy must keep the full jurisdiction words
  const unitFed = await page.evaluate(() =>
    (document.querySelector(".ex-chart .fc-unit") || {}).textContent || "");
  say(/Australian federal elections/.test(unitFed), `${path} unit line keeps the full words: ${J(unitFed.trim())}`);

  // pick the NSW chip: face short, surrounding copy still full
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-flow-chips button")].find((x) => x.textContent.trim() === "NSW");
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const unitNsw = await page.evaluate(() =>
    (document.querySelector(".ex-chart .fc-unit") || {}).textContent || "");
  say(/New South Wales state elections/.test(unitNsw), `${path} NSW unit line keeps the full words: ${J(unitNsw.trim())}`);
  say(!/\bNSW\b/.test(unitNsw), `${path} unit line never falls back to the abbreviation`);

  // the full name is still available to the tooltip string baked on the chart aria
  const aria = await page.evaluate(() => {
    const s = document.querySelector(".ex-chart svg[aria-label]");
    return s ? s.getAttribute("aria-label") : "";
  });
  if (aria) say(/New South Wales/.test(aria), `${path} chart aria keeps the full name: ${J(aria.slice(0, 90))}…`);
}

await browser.close();
console.log(ok ? "ALL PASS" : "FAILURES ABOVE");
process.exit(ok ? 0 : 1);
