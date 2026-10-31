/* The All-polls 2PP facet head's poll count must equal the estimator's own
   window membership (synthLatest.n - the number the hero's "weighted aggregate
   of N polls" quotes), never a release-date count: a wave's printed end date
   can sit inside the three weeks its fieldwork MIDPOINT (and hence estimator
   weight) has already left - the window that said "six" while five polls
   carried the whole weight (worked 2026-10-31, rdApWinMid in rd-allpolls.jsx).
   Asserts on the built page (desktop, default implied basis):
     1. the 2PP facet head says "comes from <numword> polls" where <numword>
        is the midpoint-window count recomputed from the data asset's rows
        (mid in [updatedISO - 21d, updatedISO], fallback released), AND equals
        synthLatest.n in-world;
     2. the newest in-window wave's expanded detail says "as one of <same>".
   Truth comes from the same 9f09dca2 data asset the page reads (the probe
   pins the WIRING, never the day's data).
   Run from the repo root: node .matilda/probe/ap-headline-count.mjs
   Rebuild first (node .build/newtracker/build.mjs) — probes the BUILT pages
   in the working tree. */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8953;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const dataFile = (await readdir(join(ROOT, ".build/newtracker/assets")))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
const world = {};
new Function("window", await readFile(join(ROOT, ".build/newtracker/assets", dataFile), "utf8"))(world);
const D = world.AUSPOL;
if (!D || !D.synthLatest || !D.latest) { console.error("probe setup: AUSPOL payload unreadable"); process.exit(1); }

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const WORD_OF = Object.fromEntries(WORDS.map((w, i) => [w, i]));
const dayMs = (iso) => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
const winMid = (p) => (p.mid != null ? p.mid : dayMs(p.released));
const upd = dayMs(D.latest.updatedISO);
const winDays = (D.latest.method && D.latest.method.windowDays) || 21;
const expected = D.individualPolls.filter((p) => {
  const t = winMid(p);
  return t >= upd - winDays * 864e5 && t <= upd && p.alpImp != null;
});
const nWord = WORDS[expected.length];
if (!nWord) { console.error("probe setup: window count out of word range: " + expected.length); process.exit(1); }
const newest = expected.slice().sort((a, b) => dayMs(b.released) - dayMs(a.released))[0];

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 240) : ""));
  if (!cond) bad++;
};

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.setViewport({ width: 1440, height: 1600 });
await page.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 900));

const headText = await page.evaluate(() => document.body.innerText);
const m = headText.match(/\.{0,1}\s*Labor[’']s\s+([\d.]+)\s+comes from\s+([a-z-]+)\s+poll/);
ok("2PP head names the midpoint-window count", !!m && m[2] === nWord,
  m ? "head: Labor's " + m[1] + " comes from " + m[2] + " (want " + nWord + ")" : "head phrase not found");
ok("head figure is the implied headline", !!m && m[1] === D.synthLatest.alp.toFixed(1),
  m ? "figure " + m[1] + " vs synthLatest " + D.synthLatest.alp : "head phrase not found");
ok("estimator agrees (synthLatest.n)", D.synthLatest.n === expected.length,
  "synthLatest.n=" + D.synthLatest.n + " vs window " + expected.length);

if (newest) {
  await page.evaluate((key) => window.AP && window.AP.openPoll && window.AP.openPoll(key),
    newest.pollster + "|" + newest.released);
  await new Promise((r) => setTimeout(r, 700));
  const detail = await page.evaluate(() => document.body.innerText);
  ok("newest wave's detail says \"as one of " + nWord + "\"",
    detail.includes("as one of " + nWord),
    newest.pollster + " " + newest.field + " detail text scan");
}

ok("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(bad ? "ap-headline-count: " + bad + " FAIL" : "ap-headline-count: all green");
process.exit(bad ? 1 : 0);
