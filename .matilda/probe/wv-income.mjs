/* wv-income.mjs — the Who-votes INCOME tab (tilt pooling, 2026-10-16).
   The tab is spliced onto D.demographics' tabs inside RdDemographics only
   (repo rule 5: never into the shared demographics payload), pooling each
   house's own lowest and highest income bands as tilts. Checks:

   desktop — the tab sits last in the group row, straight after Home; the
     live D.demographics.tabs carries no "income"; the dek gains the
     bands note ONLY on the income tab; the sethead pill names each
     in-window house's own brackets; both rows' figures track the live
     D.demoIncome payload for the picked party (onp default, then Labor);
     per-wave rug dots render.
   phone — same essentials at 390px.
   ?design=old — the frozen classic panel never hears about it: no Income
     option in its segmented row, no earners rows anywhere in the card. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9027;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the page's own copies of the payloads (the assertions price themselves
   off these, not off hard-coded vintage figures) */
const payload = (page) => page.evaluate(() => {
  const D = window.AP.D;
  return { demoTabs: D.demographics.tabs.map((t) => ({ id: t.id, label: t.label })),
           income: D.demoIncome };
});
const tabLabels = (page) => page.$$eval("#who-votes .rd-wv-tabs .rd-tab", (bs) => bs.map((b) => b.textContent.trim()));
const clickTab = async (page, label) => {
  await page.evaluate((want) => {
    const b = [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === want);
    b.click();
  }, label);
};
const dekText = (page) => page.$eval("#who-votes .rd-dek", (el) => el.textContent);
/* the dot-plot's group rows as {label, figure} pairs */
const rows = (page) => page.$$eval("#who-votes .rd-wv-set .rd-wv-row", (rs) => rs.map((r) => ({
  label: r.querySelector(".rd-wv-lab").textContent.trim(),
  fig: parseFloat(r.querySelector(".rd-wv-v b").textContent),
})));

console.log("== desktop: the Income tab rides beside demographics ==");
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes .rd-wv-tabs .rd-tab", { timeout: 20000 });
await sleep(600);

const P = await payload(page);
ok("D.demoIncome is emitted beside (never inside) D.demographics",
   P.income && !P.demoTabs.some((t) => t.id === "income"),
   "demoTabs " + P.demoTabs.map((t) => t.id).join(","));
ok("demoIncome is a single income set of the two earners tilts",
   P.income && P.income.sets.length === 1 &&
   JSON.stringify(P.income.sets[0].groups.map((g) => g.label)) === JSON.stringify(["Lower earners", "Higher earners"]),
   P.income && P.income.sets[0].groups.map((g) => g.label).join(" / "));

const labels0 = await tabLabels(page);
ok("the tab row ends …Home, Income", JSON.stringify(labels0.slice(-2)) === JSON.stringify(["Home", "Income"]),
   labels0.join(" | "));
ok("every payload tab is on the row, income last",
   JSON.stringify(labels0) === JSON.stringify(P.demoTabs.map((t) => t.label).concat(["Income"])));

const dekAge = await dekText(page);
ok("a demographics tab's dek names no income bands", !/lowest and highest bands/.test(dekAge));

await clickTab(page, "Income");
await sleep(900);
const dekInc = await dekText(page);
ok("the income dek carries the own-bands caveat",
   /Each house counts at its own lowest and highest bands\./.test(dekInc));

/* the sethead pill: one span per in-window house, naming its own brackets */
const pill = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-bands .rd-wv-band")]
  .map((el) => el.textContent.trim()));
const wantHouses = P.income.sets[0].houses.filter((h) => P.income.sets[0].bands[h]);
ok("the bands pill lists every in-window house",
   pill.length === wantHouses.length, pill.length + " vs " + wantHouses.length);
{
  const misses = [];
  for (const h of wantHouses) {
    const b = P.income.sets[0].bands[h];
    const hit = pill.some((t) => t.includes(b.low[0]) && t.includes(b.high[0]));
    if (!hit) misses.push(h);
  }
  ok("each pill spells its house's own low and high brackets", misses.length === 0,
     misses.length ? "missing: " + misses.join(", ") : pill.join(" ‖ "));
}

/* figures track the live payload for the picked party */
const figures = (pty, got) =>
  P.income.sets[0].groups.every((g) => {
    const r = got.find((x) => x.label === g.label);
    return r && Math.abs(r.fig - g.v[pty]) < 0.06;
  });
{
  const got = await rows(page);
  ok("both earners rows render in order",
     JSON.stringify(got.map((r) => r.label)) === JSON.stringify(["Lower earners", "Higher earners"]));
  ok("figures match the payload's One Nation tilts", figures("onp", got),
     got.map((r) => r.label + " " + r.fig).join(", ") + " vs " +
     P.income.sets[0].groups.map((g) => "onp " + g.v.onp).join(", "));
  const rug = await page.$$eval("#who-votes .rd-wv-rug", (els) => els.length);
  ok("per-wave rug dots render on the income rows", rug > 0, rug + " rug spans");
}

/* switch party: the same rows re-read against the payload's ALP tilts */
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("#who-votes .rd-chips .rd-chip")]
    .find((b) => /Labor/.test(b.textContent));
  chip.click();
});
await sleep(900);
{
  const got = await rows(page);
  ok("figures re-track the payload on the party switch (Labor)", figures("alp", got),
     got.map((r) => r.label + " " + r.fig).join(", ") + " vs " +
     P.income.sets[0].groups.map((g) => "alp " + g.v.alp).join(", "));
}
await page.close();

console.log("== phone 390px ==");
const mob = await browser.newPage();
await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await mob.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await mob.waitForSelector("#who-votes .rd-wv-tabs .rd-tab", { timeout: 20000 });
await sleep(600);
const labelsM = await tabLabels(mob);
ok("phone tab row also ends …Home, Income", JSON.stringify(labelsM.slice(-2)) === JSON.stringify(["Home", "Income"]),
   labelsM.join(" | "));
await clickTab(mob, "Income");
await sleep(900);
ok("phone dek carries the own-bands caveat",
   /Each house counts at its own lowest and highest bands\./.test(await dekText(mob)));
{
  const n = await mob.$$eval("#who-votes .rd-wv-bands .rd-wv-band", (els) => els.length);
  ok("phone shows the bands pill", n === wantHouses.length, n + " spans");
  const got = await rows(mob);
  ok("phone figures match the payload's One Nation tilts", figures("onp", got),
     got.map((r) => r.label + " " + r.fig).join(", "));
}
await mob.close();

console.log("== ?design=old: the frozen classic panel never sees it ==");
const old = await browser.newPage();
await old.setViewport({ width: 1280, height: 900 });
await old.goto(`http://127.0.0.1:${PORT}/index.html?design=old`, { waitUntil: "domcontentloaded" });
await old.waitForSelector("section.card .card-title", { timeout: 20000 });
await sleep(800);
const oldDemo = await old.evaluate(() => {
  const sec = [...document.querySelectorAll("section.card")]
    .find((s) => { const h = s.querySelector(".card-title"); return h && /Who votes for whom/.test(h.textContent); });
  if (!sec) return null;
  return { options: [...sec.querySelectorAll(".demo-ctl .seg-btn")].map((b) => b.textContent.trim()),
           text: sec.textContent };
});
ok("the classic Who-votes card renders", !!oldDemo);
if (oldDemo) {
  ok("no Income option in the classic group row", !oldDemo.options.includes("Income"),
     oldDemo.options.join(" | "));
  ok("the classic card names no earners tilts", !/Lower earners|Higher earners/.test(oldDemo.text));
  /* rendered copy only - the sentence ships in script bodies for the
     redesign (glossary + dek note), which innerText rightly ignores */
  ok("no own-bands caveat in anything the frozen page renders",
     !(await old.evaluate(() => document.body.innerText)).match(/lowest and highest bands/));
}
await old.close();

const fails = results.filter(([, p]) => !p);
console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ` — ${fails.length} FAILED` : ""));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
