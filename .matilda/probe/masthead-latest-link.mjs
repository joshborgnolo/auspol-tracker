import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8961;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const fails = [];
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails.push(name); };

/* expected: the polls.json row the masthead names (newest by pubSort =
   published||date, the same ordering rdLatest sorts pollsterTable by) */
const pj = JSON.parse(await readFile(join(ROOT, "data/polls.json"), "utf8"));
const rows = (pj.polls || pj).filter((p) => p.pollster);
const newest = rows.slice().sort((a, b) => (b.published || b.date).localeCompare(a.published || a.date))[0];
const expectUrl = newest.releaseUrl || newest.url || null;
console.log("expected newest poll: " + newest.pollster + " (released " + (newest.published || newest.date) + ")" + (newest.fieldworkPending ? " [fieldwork pending]" : ""));
console.log("expected release link: " + (expectUrl || "(row has no url)"));

/* 2026-10-12 split contract (user call): when the newest wave's fieldwork
   window is still unknown -
   - the phone's compact one-liner ("Latest poll X, today, N polls") drops
     "TBC" entirely: it names the pollster alone (the short form sheds the
     fact);
   - the big-screen meta block keeps "TBC", linked to the house's dates
     page via field-tbc.mjs, like every other TBC on the site.
   Dated newest waves read identically in both homes. */

const probeView = async (width, height, sel, label) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 200)); fails.push(label + " pageerror"); });
  await page.goto("http://127.0.0.1:" + PORT + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".site-head", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 700));
  const got = await page.evaluate((s) => {
    const a = document.querySelector(s + " a.mh-latest");
    if (!a) return null;
    const cs = getComputedStyle(a);
    const home = document.querySelector(s);
    const homeText = home.textContent.trim().replace(/\s+/g, " ");
    const tbc = home.querySelector("a.rd-tbc");
    return {
      text: a.textContent.trim(),
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
      deco: cs.textDecorationLine,
      color: cs.color,
      parentColor: getComputedStyle(a.parentElement).color,
      plinks: a.querySelectorAll(".plink-mark, .rd-ap-ext, .rd-apd-ext").length,
      homeText,
      tbcText: tbc ? tbc.textContent.trim() : null,
      tbcHref: tbc ? tbc.getAttribute("href") : null,
    };
  }, sel);
  ok(label + ": a.mh-latest renders in the masthead", got !== null);
  if (got === null) { await page.close(); return null; }
  console.log("   " + label + " fact: \"" + got.homeText + "\"");
  ok(label + ": a.mh-latest names the newest poll's pollster alone", got.text === newest.pollster);
  ok(label + ": links to the pollster's release (" + (newest.releaseUrl ? "releaseUrl" : "url") + ")", got.href === expectUrl);
  ok(label + ": opens off-site safely", got.target === "_blank" && /noopener/.test(got.rel || ""));
  ok(label + ": no underline", got.deco === "none");
  ok(label + ": invisible colour (inherits the sentence)", got.color === got.parentColor);
  ok(label + ": no link icon", got.plinks === 0 && !/[↗]/.test(got.text));
  if (newest.fieldworkPending && label === "phone") {
    ok("phone compact line drops TBC", !/TBC/.test(got.homeText) && got.tbcText === null);
  }
  if (newest.fieldworkPending && label === "laptop") {
    ok("laptop meta keeps TBC, linked to the house's dates page", got.tbcText === "TBC" && /^https?:/.test(got.tbcHref || ""));
    if (got.tbcHref) console.log("   TBC → " + got.tbcHref);
  }
  if (newest.fieldworkPending) {
    ok(label + ": no stray 'TBC' text node in the pollster link", !/TBC/.test(got.text));
  }
  const ret = { text: got.text, href: got.href, homeText: got.homeText };
  await page.close();
  return ret;
};

/* phone home: the rd-head-compact sentence under the tagline */
const phone = await probeView(390, 844, ".rd-head-compact", "phone");
/* laptop home: the Latest-poll meta-item in .rd-head-meta */
const desk = await probeView(1280, 900, ".rd-head-meta .meta-v", "laptop");
if (phone && desk) {
  ok("both masthead homes name the same poll", phone.text === desk.text);
  ok("both masthead homes link the same release", phone.href === desk.href);
}

await browser.close();
server.close();
console.log(fails.length ? "FAILED: " + fails.join("; ") : "ALL GREEN");
process.exit(fails.length ? 1 : 0);
