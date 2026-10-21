/* Probe: the Public opinion page's order control (rd-beyond.jsx BtvSort),
   in both designs at four widths. Asserts the control sits straight under
   the findings and opens on "By issue"; "Newest first" swaps the topics for
   months that hold every chart, question and long-tail question exactly
   once, each chart and question naming its topic; the tabs keep their
   widths across a pick (the bold twin); no sideways scroll, with a month's
   long tail and a row open; a finding picked while newest first turns the
   page back to the issues and lands on its topic with its hash; the arrow
   keys flip the order; no errors. BASE=<worktree> serves another tree's
   build; SHOTS=<dir> saves a viewport shot of each state. */
import puppeteer from "puppeteer-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const OUT = process.env.SHOTS || null;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const asset = fs.readdirSync(path.join(ROOT, "assets")).find((f) => /^oneoffs-source\..+\.json$/.test(f));
const src = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", asset), "utf8"));
const topics = src.topics.filter((t) => t.blocks.length || t.more.length);
const nTr = topics.flatMap((t) => t.blocks.filter((b) => b.kind === "tracker")).length;
const nIt = topics.flatMap((t) => t.blocks.filter((b) => b.kind !== "tracker")).length;
const nMore = topics.reduce((n, t) => n + t.more.length, 0);
let bad = 0; const fail = (m) => { console.log("FAIL " + m); bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const design of ["new", "old"]) for (const w of [390, 640, 1024, 1440]) {
  const page = await browser.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.setViewport({ width: w, height: 1000 });
  await page.goto(`${base}/beyond-the-vote/?design=${design}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".btv-topic", { timeout: 20000 }); await sleep(300);
  const pre = await page.evaluate(() => ({ pressed: [...document.querySelectorAll(".btv-sort-b")].map((b) => b.getAttribute("aria-pressed") + ":" + b.textContent),
    after: document.querySelector(".btv-finds").nextElementSibling.className, topics: document.querySelectorAll(".btv-topic:not(.btv-mon)").length,
    bw: [...document.querySelectorAll(".btv-sort-b")].map((b) => b.getBoundingClientRect().width) }));
  if (pre.pressed.join() !== "true:By issue,false:Newest first") fail(`${design}@${w} default ${pre.pressed}`);
  if (pre.after !== "btv-sort") fail(`${design}@${w} control not under findings: ${pre.after}`);
  if (pre.topics !== topics.length) fail(`${design}@${w} topics ${pre.topics}`);
  // shoot the control in issue view
  await page.evaluate(() => document.querySelector(".btv-sort").scrollIntoView({ behavior: "instant", block: "center" })); await sleep(150);
  if (OUT) await page.screenshot({ path: `${OUT}/${design}-${w}-issue.png`, captureBeyondViewport: false });
  await page.click(".btv-sort-b:nth-child(2)"); await sleep(500);
  const m = await page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    return { bw: q(".btv-sort-b").map((b) => b.getBoundingClientRect().width), pressed: q(".btv-sort-b").map((b) => b.getAttribute("aria-pressed")),
      months: q(".btv-mon h3").map((h) => h.textContent), topics: q(".btv-topic:not(.btv-mon)").length,
      trackers: q(".btv-tracker").length, items: q(".btv-item").length, more: q(".btv-ml > li").length,
      tags: q(".btv-mon .btv-qt").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      txt: /\bNaN\b|undefined|\[object/.test(document.querySelector(".btv").innerText),
      lines: q(".btv-tracker").map((t) => t.querySelectorAll("path.series-line").length),
      metas: q(".btv-mon .btv-mm").slice(0, 3).map((e) => e.textContent),
      firstY: document.querySelector(".btv-sort").getBoundingClientRect().top };
  });
  if (m.bw.join() !== pre.bw.join()) fail(`${design}@${w} tab widths moved ${pre.bw} -> ${m.bw}`);
  if (m.topics) fail(`${design}@${w} topics left in recency view`);
  if (m.trackers !== nTr || m.items !== nIt || m.more !== nMore) fail(`${design}@${w} counts ${m.trackers}/${m.items}/${m.more} v ${nTr}/${nIt}/${nMore}`);
  if (m.tags !== nTr + nIt) fail(`${design}@${w} topic tags ${m.tags}`);
  if (m.sw > m.cw) fail(`${design}@${w} sideways scroll ${m.sw}>${m.cw}`);
  if (m.txt) fail(`${design}@${w} NaN/undefined`);
  if (m.lines.some((n) => !n)) fail(`${design}@${w} tracker without lines ${m.lines}`);
  if (OUT) await page.screenshot({ path: `${OUT}/${design}-${w}-recent-top.png`, captureBeyondViewport: false });
  await page.evaluate(() => document.querySelectorAll(".btv-mon")[1].scrollIntoView({ behavior: "instant" })); await sleep(300);
  if (OUT) await page.screenshot({ path: `${OUT}/${design}-${w}-recent-m2.png`, captureBeyondViewport: false });
  // open a month's long tail and one row
  await page.evaluate(() => { const d = document.querySelector(".btv-mon .btv-more"); d.open = true; d.querySelector(".btv-mi").open = true; d.scrollIntoView({ behavior: "instant" }); }); await sleep(300);
  if (OUT) await page.screenshot({ path: `${OUT}/${design}-${w}-recent-more.png`, captureBeyondViewport: false });
  const sw2 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (sw2) fail(`${design}@${w} sideways scroll with a row open`);
  // a finding sends the page back to the issues and lands on its topic
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(100);
  const id = await page.evaluate(() => document.querySelectorAll(".btv-f")[3].getAttribute("href").slice(1));
  await page.evaluate(() => document.querySelectorAll(".btv-f")[3].click()); await sleep(600);
  const land = await page.evaluate((id) => { const el = document.getElementById(id); return { ok: !!el, top: el ? el.getBoundingClientRect().top : null, hash: location.hash,
    pressed: [...document.querySelectorAll(".btv-sort-b")].map((b) => b.getAttribute("aria-pressed")).join(), path: location.pathname }; }, id);
  if (!land.ok || land.top < 0 || land.top > 140 || land.hash !== "#" + id || land.pressed !== "true,false" || land.path !== "/beyond-the-vote/") fail(`${design}@${w} finding landing ${JSON.stringify(land)}`);
  // keyboard: arrow right flips
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.focus(".btv-sort-b"); await page.keyboard.press("ArrowRight"); await sleep(300);
  const kb = await page.evaluate(() => document.querySelectorAll(".btv-mon").length);
  if (!kb) fail(`${design}@${w} arrow key did not flip`);
  if (errs.length) fail(`${design}@${w} errors ${errs.slice(0, 3)}`);
  await page.close();
}
await browser.close(); server.close();
console.log(bad ? bad + " failure(s)" : "ALL PASS");
