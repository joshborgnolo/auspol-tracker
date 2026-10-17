/* Probe: the /beyond-the-vote/ page (rd-beyond.jsx over the sidecar that
   beyond-the-vote.mjs builds), in both designs at four widths. Asserts no
   errors and no sideways scroll; the topic nav, trackers (one chart per
   pollster), cards and "More questions" lists all render from the payload;
   every "level" on the page is a lead the payload found inside its margin
   (and none is missing); every card names a source; no NaN or undefined
   reaches a reader; a list item opens to its tables; the old /ad-hocs/ link
   lands on the new page with its topic anchor; the static article carries
   the topics as text. BASE=<worktree> serves another tree's build. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let bad = 0;
const fail = (m) => { console.log("FAIL: " + m); bad++; };

const asset = fs.readdirSync(path.join(ROOT, "assets")).find((f) => /^oneoffs-source\..+\.json$/.test(f));
const src = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", asset), "utf8"));
const topics = src.topics.filter((t) => t.blocks.length || t.more.length);
const trackers = topics.flatMap((t) => t.blocks.filter((b) => b.kind === "tracker"));
const cards = topics.flatMap((t) => t.blocks.filter((b) => b.kind !== "tracker"));
const panels = trackers.reduce((n, c) => n + c.panels.length, 0);
/* the levels a reader sees: a single question's, and each stack row on show */
const levels = cards.reduce((n, c) => n + (c.kind === "split" ? (c.sig === false ? 1 : 0)
  : c.kind === "stack" ? (c.show ? c.rows.slice(0, c.show) : c.rows).filter((r) => r.sig === false).length : 0), 0);

for (const design of ["new", "old"]) {
  for (const w of [390, 640, 1024, 1440]) {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${base}/beyond-the-vote/?design=${design}`, { waitUntil: "networkidle0", timeout: 60000 });
    try { await page.waitForSelector(".btv-topic", { timeout: 20000 }); }
    catch { fail(`${design}@${w}: no topics rendered`); await page.close(); continue; }
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(() => {
      const q = (s) => document.querySelectorAll(s);
      const txt = document.querySelector(".btv").innerText;
      return {
        sw: document.documentElement.scrollWidth, title: document.title,
        nav: q(".btv-nav a").length, navOk: [...q(".btv-nav a")].every((a) => document.getElementById(a.getAttribute("href").slice(1))),
        topics: q(".btv-topic").length, trackers: q(".btv-tracker").length, panels: [...q(".btv-panel")].filter((p) => p.querySelector(".chart svg")).length,
        cards: q(".btv-card").length, levels: q(".btv-level").length + [...q(".btv-net")].filter((e) => e.textContent === "level").length,
        unsourced: [...q(".btv-card")].filter((c) => !c.querySelector(".btv-src a[href]")).map((c) => c.querySelector(".btv-q").textContent),
        nan: /\bNaN\b|undefined|\[object/.test(txt), more: q(".btv-more").length,
        rdHead: !!document.querySelector(".rd-btv .rd-hed"),
      };
    });
    const at = `${design}@${w}`;
    if (errs.length) fail(`${at}: errors ${errs.slice(0, 3).join(" | ")}`);
    if (m.sw !== w) fail(`${at}: scrollWidth ${m.sw}`);
    if (m.title !== "auspol tracker – Beyond the vote") fail(`${at}: title "${m.title}"`);
    if (m.nav !== topics.length || !m.navOk) fail(`${at}: nav ${m.nav}/${topics.length}, targets ${m.navOk}`);
    if (m.topics !== topics.length) fail(`${at}: topics ${m.topics}/${topics.length}`);
    if (m.trackers !== trackers.length || m.panels !== panels) fail(`${at}: trackers ${m.trackers}/${trackers.length}, panel charts ${m.panels}/${panels}`);
    if (m.cards !== cards.length) fail(`${at}: cards ${m.cards}/${cards.length}`);
    if (m.levels !== levels) fail(`${at}: levels shown ${m.levels}, payload ${levels}`);
    if (m.unsourced.length) fail(`${at}: cards without a source link: ${m.unsourced.slice(0, 3).join(" | ")}`);
    if (m.nan) fail(`${at}: NaN/undefined in the text`);
    if (m.more !== topics.filter((t) => t.more.length).length) fail(`${at}: More lists ${m.more}`);
    if ((design === "new") !== m.rdHead) fail(`${at}: rd head ${m.rdHead} in the ${design} design`);
    if (design === "new" && w === 1440) {
      /* a list item opens to its figures */
      const opened = await page.evaluate(() => {
        const d = document.querySelector(".btv-more"); d.open = true;
        const it = d.querySelector(".btv-mi"); it.open = true;
        return it.querySelectorAll(".btv-table tr, .btv-note").length;
      });
      if (!opened) fail("a More-questions item opened to nothing");
    }
    await page.close();
  }
}

/* the old path redirects, topic anchor and all, and the topic lands in view */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 900 });
  await page.goto(`${base}/ad-hocs/#btv-trump-us`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#btv-trump-us", { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const r = await page.evaluate(() => ({ path: location.pathname, hash: location.hash,
    top: document.getElementById("btv-trump-us") ? document.getElementById("btv-trump-us").getBoundingClientRect().top : null }));
  if (r.path !== "/beyond-the-vote/" || r.hash !== "#btv-trump-us") fail(`/ad-hocs/ landed on ${r.path}${r.hash}`);
  if (r.top == null || r.top < 0 || r.top > 200) fail(`the topic anchor did not land in view (top ${r.top})`);
  await page.close();
}

/* the static article: the topics as text for a crawler or a no-JS reader */
{
  const html = fs.readFileSync(path.join(ROOT, "beyond-the-vote", "index.html"), "utf8");
  const art = (html.match(/<article class="static-summary">[\s\S]*?<\/article>/) || [""])[0];
  if (!art.includes("<h1>Beyond the vote</h1>")) fail("static article lacks its h1");
  const h2 = (art.match(/<h2>/g) || []).length;
  if (h2 < topics.length) fail(`static article has ${h2} topic heads`);
  if (!art.includes(trackers[0].head.replace(/’/g, "’"))) fail("static article lacks the first tracker's head");
}

await browser.close();
server.close();
console.log(bad ? `${bad} failure(s)` : `PASS: beyond-the-vote page – ${topics.length} topics, ${trackers.length} trackers (${panels} charts), ${cards.length} cards, ${levels} levels, both designs at 390/640/1024/1440, /ad-hocs/ redirect, static article`);
process.exit(bad ? 1 : 0);
