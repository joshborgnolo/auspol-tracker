/* Probe (run: node .matilda/probe/conf-published.mjs, from the repo root of
   the checkout under test): a confidence release must say WHEN it came out.
   The emitter used to stop at `released: r.date` - a sort key the header
   sentence never reads - so "Conducted on …, published by NAB" had no
   " on <date>" tail on any of the four lanes, and the row cell's
   "released X" sub never rendered either. The fix emits published: r.date
   (date-only, the Ipsos precedent - confidence.json rows carry no clock
   time) and rdEffTbc bails early on conf rows so a confidence lane can't
   inherit its namesake poll house's effective-sample filing habit
   ("Roy Morgan" the lane vs Roy Morgan the poll house).
   Walks to the Confidence facet, opens one row per lane and asserts the
   "on <Wkd d Mon>" tail matches that lane's latest published date from the
   dataset; asserts the row-cell "released X" subs render; opens a 2PP-facet
   row as the poll-side regression guard; ends with SOURCE pins on the
   emitter key and the rdEffTbc guard. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
const APAGE = PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const LANES = [
  { match: (t) => t.includes("ANZ–Roy Morgan"), house: "ANZ–Roy Morgan" },
  { match: (t) => t.includes("Westpac–MI"), house: "Westpac–MI" },
  { match: (t) => t.includes("Business Confidence") && t.includes("Roy Morgan") && !t.includes("ANZ–Roy"), house: "Roy Morgan" },
  { match: (t) => t.includes("NAB"), house: "NAB" },
];
const TIME_TAIL = /, \d{1,2} (am|pm)$/;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

await page.setViewport({ width: 1366, height: 980, deviceScaleFactor: 1 });
await page.goto(APAGE + "?f=c", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(
  () => {
    const a = document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']");
    return a && a.textContent.trim() === "Confidence" && document.querySelectorAll(".rd-ap .rd-ap-row").length > 0;
  },
  { timeout: 30000 });

/* the row-cell "released X" sub renders (every confidence row now carries
   published; the first visible page alone should be well over a dozen) */
const cellSubs = await page.evaluate(() =>
  [...document.querySelectorAll(".rd-ap .rd-ap-row .rd-ap-when .rd-ap-sub")].map((el) => el.textContent.trim()),
);
check(cellSubs.length > 12, `row cells show the "released X" sub (n=${cellSubs.length})`);
check(cellSubs.every((t) => /^released \d{1,2} \S{3} /.test(t) || /^released \d{1,2} \S{3}$/.test(t)),
  `every visible released-sub is a bare date (${JSON.stringify(cellSubs.slice(0, 2))})`);

/* one row per lane: the header sentence ends " on <lane's latest published>",
   date-only (no hour tail), and never gains an eff-sample badge */
for (const lane of LANES) {
  const idx = await page.evaluate((src) => {
    const f = new Function("t", "return (" + src + ")(t)");
    const rows = [...document.querySelectorAll(".rd-ap .rd-ap-row")];
    return rows.findIndex((r) => f(r.textContent));
  }, lane.match.toString());
  check(idx >= 0, `lane row present in first page of Confidence rows (${lane.house})`);
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
  const got = await page.evaluate((house) => {
    const el = document.querySelector(".rd-ap-open .rd-apd-h");
    const D = window.AUSPOL;
    const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const latest = (D.confidenceOnlyPolls || []).filter((r) => r.pollster === house)
      .reduce((m, r) => (r.published > m ? r.published : m), "");
    const t = new Date(latest + "T00:00:00Z");
    const expected = " on " + WD[t.getUTCDay()] + " " + t.getUTCDate() + " " + D.monthName(t.getUTCMonth() + 1);
    return { head: el ? el.textContent.trim() : null, expected, latest };
  }, lane.house);
  check(got.head != null, `detail sentence rendered for ${lane.house}`);
  if (got.head == null) continue;
  check(got.head.endsWith(got.expected),
    `sentence ends " on ${got.expected.slice(4)}" (${JSON.stringify(got.head.slice(Math.max(0, got.head.indexOf("published by") - 1), got.head.length))})`);
  check(got.head.includes("published by " + lane.house + " on "), "byline kept the house and gained the date");
  check(!TIME_TAIL.test(got.head), "date-only tail — no hour (the extractor stamps no clock time)");
  check(!got.head.includes("eff. TBC"), "no eff-sample badge on a confidence release");
}

/* regression guard: a real poll's dated tail / eff badge path is untouched */
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
check(/published by .+ on (Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} \w{3}/.test(pollHead),
  `poll row's dated tail intact (${JSON.stringify(pollHead.slice(Math.max(0, pollHead.indexOf("published by") - 1), pollHead.length))})`);

/* SOURCE pins */
const src = (await import("fs")).default;
check(src.readFileSync(path.resolve(process.cwd(), ".build/newtracker/gen-data.mjs"), "utf8").includes("published: r.date,"),
  "gen-data emits published on confidence rows");
check(src.readFileSync(path.resolve(process.cwd(), ".build/newtracker/assets/rd-allpolls.jsx"), "utf8")
  .includes("if (p.conf || p.sampleEff != null || !p.published) return false;"),
  "rdEffTbc bails before the habit look-back on confidence rows");

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
