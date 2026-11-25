/* Verify non-VI measure routing in the rendered page, not only its JSON.
   Uses the same generated documents and real Chrome as the site's probes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CHROME = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome-stable", "/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("No Chrome executable found; set CHROME for this browser regression");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let file = new URL(req.url, "http://localhost").pathname;
  if (file.endsWith("/")) file += "index.html";
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT) || !fs.existsSync(full)) { res.writeHead(404); res.end(); return; }
  res.setHeader("content-type", TYPES[path.extname(full)] || "application/octet-stream");
  fs.createReadStream(full).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => { errors.push(e.message); console.error(e.message); });
  page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#latest-polls", { timeout: 30000 });
  const clickFacet = async (name) => {
    const target = await page.evaluateHandle((label) => {
      const section = document.querySelector("#latest-polls");
      return [...section.querySelectorAll("button,[role='tab']")].find((x) => x.textContent.trim().match(label));
    }, name);
    const element = target.asElement();
    assert.ok(element, `Latest facet found: ${name}`);
    await element.focus();
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 350));
  };
  const latestText = () => page.$eval("#latest-polls", (el) => el.textContent.replace(/\s+/g, " "));
  await clickFacet(/^Leadership$/);
  await page.waitForFunction(() => /^Leaders(?:hip)?$/.test(document.querySelector("#latest-polls [aria-pressed='true']")?.textContent || ""));
  await page.waitForFunction(() => document.querySelector("#latest-polls").textContent.includes("19–24 Nov"));
  const ld = await latestText();
  assert.match(ld, /Essential.*19–24 Nov/s, "Latest Leadership shows the new standalone report");
  assert.ok(ld.includes("−28") && ld.includes("−7"), ld);
  const primary = await page.evaluate(() => {
    const r = window.AUSPOL.pollsterTable.find((p) => p.pollster === "Essential");
    return { released: r.released, alp: r.p.alp, latestReleased: r.leadershipLatest.released };
  });
  assert.deepEqual(primary, { released: "2026-10-27", alp: 28, latestReleased: "2026-11-24" }, "VI and leadership candidates stay distinct");

  const open = async (pollster, date, facet) => {
    await page.evaluate(({ pollster, date, facet }) => window.AP.openPoll(`${pollster}|${date}`, facet, "non-VI regression"), { pollster, date, facet });
    await page.waitForFunction((needle) => document.querySelector(".rd-ap-open")?.textContent.includes(needle), { timeout: 30000 }, pollster);
    return page.$eval(".rd-ap-open", (el) => el.textContent.replace(/\s+/g, " "));
  };
  const approval = await open("Essential", "2026-11-24", "leadership");
  assert.ok(approval.includes("Albanese") && approval.includes("Taylor"));
  for (const value of [32, 60, 35, 42]) assert.ok(approval.includes(String(value)), `the approval ledger carries ${value}`);
  assert.ok(!approval.includes("No voting intention") || !approval.includes("Primary vote"), "no phantom VI appears");
  const direction = await open("Essential", "2026-11-24", "direction");
  assert.ok(direction.includes("24") && direction.includes("60") && direction.includes("16"), "the same wave carries mood too");
  const demos = await open("DemosAU", "2026-11-22", "demographics");
  assert.ok(/after leaner/.test(demos), "DemosAU uses the after-leaner undecided basis");
  assert.match(demos, /\b6(?:\.0)?%/, "DemosAU shows the weighted 6% undecided value");
  for (const text of ["Men", "Women", "18–34", "University", "Under $45k", "Inner metro", "English only"]) assert.ok(demos.includes(text), `cohorts carry ${text}`);
  assert.ok(!demos.includes("Undecided people (52)"), "raw vi_dk subgroup count never replaces weighted undecided");
  assert.deepEqual(errors, [], "no browser errors while switching these views");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log("test-standalone-surfaces: ok");
