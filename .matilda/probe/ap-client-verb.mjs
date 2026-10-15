/* Probe (run: node .matilda/probe/ap-client-verb.mjs, from the repo root of
   the checkout under test): a non-self client's wave must carry the right
   verb in the opened detail sentence — the RD_AP_COMMISSIONED clients
   (Blueprint Institute, Climate Council, Australia Inst., Amplify) read
   "commissioned by ‹client›"; every other client (never a masthead) reads
   "published by ‹client›". Searches each client into view, opens the first
   filtered row and asserts the head sentence's verb. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
const APAGE = PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 200)); fails++; });
await page.setViewport({ width: 1366, height: 980 });
await page.goto(APAGE, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll(".rd-ap .rd-ap-row").length > 0, { timeout: 30000 });

const targets = await page.evaluate(() => {
  const seen = new Set();
  return (window.AUSPOL.individualPolls || [])
    .filter((p) => p.client && !/^self/i.test(p.client))
    .filter((p) => (seen.has(p.client) ? false : (seen.add(p.client), true)))
    .slice(0, 12)
    .map((p) => ({ pollster: p.pollster, client: p.client }));
});
check(targets.length > 0, `distinct clients present in dataset (n=${targets.length})`);
check(targets.some((t) => t.client === "Blueprint Institute"), "a Blueprint Institute (commissioned-registry) row is in the dataset");

for (const t of targets) {
  /* close any open row from the previous iteration, then search via the
     native value setter (React-controlled input) */
  const closed = await page.evaluate(() => {
    const openRow = document.querySelector(".rd-ap-open .rd-ap-row");
    if (openRow) { openRow.click(); return true; }
    return false;
  });
  if (closed) await page.waitForFunction(() => !document.querySelector(".rd-ap-open"), { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    const s = document.querySelector(".rd-ap-search input");
    if (!s || !s.value) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(s, "");
    s.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  const allCount = await page.evaluate(() => document.querySelectorAll(".rd-ap .rd-ap-row").length);
  await page.evaluate((q) => {
    const s = document.querySelector(".rd-ap-search input");
    if (!s) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(s, q);
    s.dispatchEvent(new Event("input", { bubbles: true }));
  }, t.client.replace(/ Inst\.$| Institute$/u, ""));
  await page.waitForFunction(
    (n) => document.querySelectorAll(".rd-ap .rd-ap-row").length !== n,
    { timeout: 5000 }, allCount).catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
  const nRows = await page.evaluate(() => document.querySelectorAll(".rd-ap .rd-ap-row").length);
  check(nRows > 0, `searching "${t.client}" surfaces rows (n=${nRows})`);
  if (nRows < 1) continue;
  /* walk filtered rows until the opened head names this client (search can
     token-collide, e.g. "Australia Inst." vs "The Australian") */
  let head = null;
  for (let i = 0; i < Math.min(nRows, 40); i++) {
    const openRow = await page.evaluate(() => {
      const r = document.querySelector(".rd-ap-open .rd-ap-row");
      if (r) { r.click(); return true; } return false;
    });
    if (openRow) await page.waitForFunction(() => !document.querySelector(".rd-ap-open"), { timeout: 5000 }).catch(() => {});
    await page.evaluate((i) => { [...document.querySelectorAll(".rd-ap .rd-ap-row")][i].click(); }, i);
    await page.waitForFunction(() => !!document.querySelector(".rd-ap-open .rd-apd-h"), { timeout: 8000 }).catch(() => {});
    const h = await page.evaluate(() => {
      const el = document.querySelector(".rd-ap-open .rd-apd-h");
      return el ? el.textContent.trim() : null;
    });
    if (h && h.includes(t.client)) { head = h; break; }
  }
  check(head != null, `a filtered row's sentence names ${t.client}`);
  if (!head) continue;
  const commissioned = !!{ "Blueprint Institute": 1, "Climate Council": 1, "Australia Inst.": 1, Amplify: 1 }[t.client];
  const want = (commissioned ? "commissioned" : "published") + " by ";
  const bad = (commissioned ? "published" : "commissioned") + " by ";
  check(head.includes(" " + want) && !head.includes(" " + bad),
    `${t.client}: head reads "${want.trim()}" (${JSON.stringify(head.slice(0, 120))})`);
}

/* SOURCE pins mirror conf-byline's (the fix lives beside it) */
const src = await import("fs").then((fs) => fs.default.readFileSync(path.resolve(process.cwd(), ".build/newtracker/assets/rd-allpolls.jsx"), "utf8"));
check(src.includes('RD_AP_COMMISSIONED = { "Blueprint Institute": 1, "Climate Council": 1, "Australia Inst.": 1, Amplify: 1 }')
  && src.includes('const commissioned = !selfBy && RD_AP_COMMISSIONED[p.client]'),
  "source: commissioned gated to the non-masthead registry");

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
