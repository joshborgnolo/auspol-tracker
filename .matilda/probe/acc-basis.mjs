// Headless probe for the accuracy-panel basis toggle ("How the final polls
// have done"): default view is the published basis, the
// "Primaries on last-election flows" chip re-derives the firm board and
// per-cycle dots without a reload, and flipping back restores it. Run against
// a served copy (file:// blocks the module scripts). Exits non-zero on any
// failed assertion.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.env.AUSPOL_PROBE_ROOT || (await import("node:url")).fileURLToPath(new URL("../../", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = readFileSync(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `\n      ${extra}`}`);
};

await page.goto(`http://127.0.0.1:${port}/cycles/`, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate(() => {
  const el = document.querySelector("#final-polls");
  if (el) el.scrollIntoView();
});
await new Promise((r) => setTimeout(r, 800));

const chips = await page.evaluate(() =>
  [...document.querySelectorAll(".rd-acc-basis .rd-chip")].map((b) => ({
    label: b.textContent.trim(), on: b.getAttribute("aria-pressed") === "true" || b.classList.contains("on"),
  })));
ok("basis toggle renders two chips", chips.length === 2, JSON.stringify(chips));
ok("published basis is the default-on chip",
  chips.length === 2 && /^published two-party$/i.test(chips[0].label) && chips[0].on && !chips[1].on,
  JSON.stringify(chips));

const firmBoard = () => page.evaluate(() =>
  [...document.querySelectorAll(".rd-acc-board .rd-acc-firm, .rd-acc-firms .rd-acc-firm")].map((n) => n.textContent.trim()).join(" | ")
  || document.querySelector(".rd-acc") && document.querySelector(".rd-acc").textContent.slice(0, 400));
const headText = () => page.evaluate(() => {
  const acc = document.querySelector("#final-polls");
  const h = acc && acc.querySelector("h3.rd-hed, .rd-hed");
  return h ? h.textContent.trim() : "";
});

const before = await firmBoard();
const headBefore = await headText();
ok("default head has no flows suffix", !/flows of the last election/.test(headBefore), headBefore);

// flip to implied
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".rd-acc-basis .rd-chip")];
  btns[1].click();
});
await new Promise((r) => setTimeout(r, 400));
const after = await firmBoard();
const headAfter = await headText();
ok("implied head gains the flows suffix", /flows of the last election/.test(headAfter), headAfter);
ok("firm board changes when the basis flips", before !== after, `before: ${before.slice(0, 120)}\nafter: ${after.slice(0, 120)}`);
ok("implied chip is now on, published off", await page.evaluate(() => {
  const b = [...document.querySelectorAll(".rd-acc-basis .rd-chip")];
  return b[0].getAttribute("aria-pressed") === "false" && b[1].getAttribute("aria-pressed") === "true";
}));

// flip back: the board must restore exactly
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-acc-basis .rd-chip")][0].click();
});
await new Promise((r) => setTimeout(r, 400));
const restored = await firmBoard();
ok("flipping back restores the published board", restored === before, restored.slice(0, 120));

// the summary strip and pollster table under the chips follow the basis;
// figures pinned from the worktree bundle (72 polls, 6 level at 50-50)
const sumCells = () => page.evaluate(() =>
  [...document.querySelectorAll(".rd-acc-sum .rd-acc-firm")].map((d) => d.innerText.replace(/\s+/g, " ").trim()));
const statRows = () => page.evaluate(() =>
  [...document.querySelectorAll(".rd-acc-stats tbody tr")].map((tr) =>
    [...tr.children].map((c) => c.textContent.trim()).join(" = ")));
const thead = await page.evaluate(() => [...document.querySelectorAll(".rd-acc-stats thead th")].map((t) => getComputedStyle(t).textTransform));
ok("table heads are sentence case", thead.length && thead.every((t) => t === "none"), thead.join());

let sum = await sumCells(), rows = await statRows();
ok("strip has four cells", sum.length === 4, sum.join(" | "));
ok("average miss 1.5, 34 high / 36 low", /^Average miss 1\.5 pts 34 polls too high on Labor, 36 too low/.test(sum[0] || ""), sum[0]);
ok("wrong side ahead 12 of 72", /^Wrong side ahead 12 of 72 polls/.test(sum[1] || ""), sum[1]);
ok("closest is 2016 among multi-pollster elections (not 1972)", /^Closest election 2016 Five pollsters, 0\.4/.test(sum[2] || ""), sum[2]);
ok("furthest is 2019 (not 1984)", /^Furthest election 2019 Five pollsters, 2\.9/.test(sum[3] || ""), sum[3]);
/* Ipsos sits out (no longer a current house) and YouGov's single final poll
   comes in beside the repeat-record houses - user call 2026-10-23 */
ok("table: 2025's current pollsters, closest first", rows.map((r) => r.split(" = ")[0]).join() === "Newspoll,Resolve,Essential,Roy Morgan,YouGov", rows.join(" | "));
ok("Roy Morgan row", rows[3] === "Roy Morgan = 23 = 2.0 pts = 0.9 Labor = 6 of 23", rows[3]);
ok("Resolve row", rows[1] === "Resolve = 2 = 1.6 pts = 1.6 Coalition = 0 of 2", rows[1]);
ok("YouGov row (one election)", rows[4] === "YouGov = 1 = 3.0 pts = 3.0 Coalition = 0 of 1", rows[4]);
ok("note names the six level polls", await page.evaluate(() =>
  /six polls at exactly 50–50/.test(document.querySelector(".rd-acc-stats-note")?.textContent || "")));

// flip to implied: the whole summary must re-derive
await page.evaluate(() => { [...document.querySelectorAll(".rd-acc-basis .rd-chip")][1].click(); });
await new Promise((r) => setTimeout(r, 400));
sum = await sumCells(); rows = await statRows();
ok("implied: 36 high / 34 low", /36 polls too high on Labor, 34 too low/.test(sum[0] || ""), sum[0]);
ok("implied: wrong side ahead 15 of 72", /^Wrong side ahead 15 of 72/.test(sum[1] || ""), sum[1]);
ok("implied: furthest 2019 at 3.3", /^Furthest election 2019 Five pollsters, 3\.3/.test(sum[3] || ""), sum[3]);
ok("implied: Essential 1.4, 0.3 Labor", rows.includes("Essential = 6 = 1.4 pts = 0.3 Labor = 1 of 6"), rows.join(" | "));
ok("implied: YouGov 1.3, 1.3 Coalition", rows.includes("YouGov = 1 = 1.3 pts = 1.3 Coalition = 0 of 1"), rows.join(" | "));
ok("implied: no Ipsos row", !rows.some((r) => r.startsWith("Ipsos")), rows.join(" | "));
ok("implied: no level-poll clause", await page.evaluate(() =>
  !/exactly 50–50/.test(document.querySelector(".rd-acc-stats-note")?.textContent || "")));

// flip back restores the published figures
await page.evaluate(() => { [...document.querySelectorAll(".rd-acc-basis .rd-chip")][0].click(); });
await new Promise((r) => setTimeout(r, 400));
sum = await sumCells();
ok("flipping back restores 12 of 72", /^Wrong side ahead 12 of 72/.test(sum[1] || ""), sum[1]);

await browser.close();
server.close();
if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log("all ok");
