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

// the stat table under the chips follows the basis; figures pinned from the
// worktree bundle (n=71 rows, 2 exact calls, deviation mean 2.1)
const statRows = () => page.evaluate(() =>
  [...document.querySelectorAll(".rd-acc-stats tbody tr")].map((tr) =>
    [...tr.children].map((c) => c.textContent.trim()).join(" = ")));
const statsText = (rows) => rows.join(" | ");

let rows = await statRows();
ok("stat table renders 8 tbody rows", rows.length === 8, statsText(rows));
ok("all row: mean miss 1.3 pts", /All final polls = 1\.3 pts =/.test(rows[0] || ""), rows[0]);
ok("all row: 48% toward Labor (published)", /= 48%$/.test(rows[0] || ""), rows[0]);
ok("average election gap is 2.1 pts", /gap from 50–50 = 2\.1 pts/.test(rows[1] || ""), rows[1]);
ok("best election is 1972", /Best election for the polls = 1972/.test(rows[2] || ""), rows[2]);
ok("worst election is 1984 (published)", /Worst election for the polls = 1984/.test(rows[3] || ""), rows[3]);
ok("Essential row: 1.6 pts", /^Essential\d+ polls = 1\.6 pts =/.test(rows[4] || ""), rows[4]);
ok("Resolve row: 0% toward Labor", /^Resolve\d+ polls = 1\.6 pts = 0%/.test(rows[5] || ""), rows[5]);
ok("Newspoll row: 1.4 pts", /^Newspoll\d+ polls = 1\.4 pts = 50%/.test(rows[6] || ""), rows[6]);
ok("Roy Morgan row: 1.8 pts, 62% Labor", /^Roy Morgan\d+ polls = 1\.8 pts = 62%/.test(rows[7] || ""), rows[7]);
ok("stat note mentions the exact calls", await page.evaluate(() =>
  /exact calls/.test(document.querySelector(".rd-acc-stats-note")?.textContent || "")));

// flip to implied: the whole table must re-derive
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-acc-basis .rd-chip")][1].click();
});
await new Promise((r) => setTimeout(r, 400));
rows = await statRows();
ok("implied: all row stays 1.3 but 51% toward Labor", /All final polls = 1\.3 pts = 51%/.test(rows[0] || ""), rows[0]);
ok("implied: worst election becomes 2019", /Worst election for the polls = 2019/.test(rows[3] || ""), rows[3]);
ok("implied: Essential drops to 1.4", /^Essential\d+ polls = 1\.4 pts = 67%/.test(rows[4] || ""), rows[4]);
ok("implied: Roy Morgan becomes 1.6 pts, 57%", /^Roy Morgan\d+ polls = 1\.6 pts = 57%/.test(rows[7] || ""), rows[7]);

// flip back restores the published figures
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-acc-basis .rd-chip")][0].click();
});
await new Promise((r) => setTimeout(r, 400));
rows = await statRows();
ok("flipping back restores 48% toward Labor", /= 48%$/.test(rows[0] || ""), rows[0]);

await browser.close();
server.close();
if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log("all ok");
