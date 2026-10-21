/* Probe: the /public-opinion/ page (at /beyond-the-vote/ until 2026-10-21;
   rd-beyond.jsx over the sidecar that beyond-the-vote.mjs builds – both
   keep their legacy names), in both designs at four widths. Asserts no
   errors and no sideways scroll; the findings index (one link a topic, each
   landing on its topic, each sentence the payload's) and each topic's
   finding; the trackers (one chart each, a line per pollster, the latest
   list beside the chart from 900px and under it below, a copy button);
   the question rows (answers beside the question where they fit, under it
   on a phone) and "More questions" lists all render from the payload (every
   list item opening to its figures, no store marking showing, the page
   holding its width with everything open), with
   no boxed card or per-pollster panel left; every "level" on the page is a
   lead the payload found inside its margin (and none is missing); every row
   names a source; no NaN or undefined reaches a reader; a list item opens
   to its tables; both retired links (/ad-hocs/ and /beyond-the-vote/) land
   on the new page with their topic anchors; the static article carries the
   findings and topics as
   text. BASE=<worktree> serves another tree's build. */
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
const finds = topics.filter((t) => t.finding).map((t) => t.finding.text);
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
    await page.goto(`${base}/public-opinion/?design=${design}`, { waitUntil: "networkidle0", timeout: 60000 });
    try { await page.waitForSelector(".btv-topic", { timeout: 20000 }); }
    catch { fail(`${design}@${w}: no topics rendered`); await page.close(); continue; }
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(() => {
      const q = (s) => document.querySelectorAll(s);
      const txt = document.querySelector(".btv").innerText;
      const box = (e) => e.getBoundingClientRect();
      return {
        sw: document.documentElement.scrollWidth, title: document.title,
        finds: [...q(".btv-f")].map((a) => ({ ok: !!document.getElementById(a.getAttribute("href").slice(1)), text: a.querySelector(".btv-ft").textContent })),
        heads: [...q(".btv-hl")].map((e) => e.textContent),
        topics: q(".btv-topic").length, trackers: q(".btv-tracker").length,
        charts: [...q(".btv-tracker")].map((t) => t.querySelectorAll(".chart svg.chart-svg").length),
        lines: [...q(".btv-tracker")].map((t) => t.querySelectorAll("path.series-line").length),
        copyBtns: [...q(".btv-tracker")].filter((t) => t.querySelector(".chart-copy-btn")).length,
        beside: [...q(".btv-tracker")].map((t) => { const c = box(t.querySelector(".btv-tchart")), l = box(t.querySelector(".btv-latest")); return l.left >= c.right - 1 ? "beside" : l.top >= c.bottom - 1 ? "under" : "overlap"; }),
        items: q(".btv-item").length, levels: q(".btv-level").length + [...q(".btv-net")].filter((e) => e.textContent === "level").length,
        rowLay: [...q(".btv-item")].map((it) => { const l = box(it.querySelector(".btv-il")), r = box(it.querySelector(".btv-ir")); return r.left >= l.right - 1 ? "beside" : r.top >= l.bottom - 1 ? "under" : "overlap"; }),
        boxes: q(".btv-card, .btv-panel, .btv-pgrid, .btv-grid").length,
        unsourced: [...q(".btv-item")].filter((c) => !c.querySelector(".btv-src a[href]")).map((c) => c.querySelector(".btv-q").textContent),
        nan: /\bNaN\b|undefined|\[object/.test(txt), more: q(".btv-more").length,
        rdHead: !!document.querySelector(".rd-btv .rd-hed"),
      };
    });
    const at = `${design}@${w}`;
    if (errs.length) fail(`${at}: errors ${errs.slice(0, 3).join(" | ")}`);
    if (m.sw !== w) fail(`${at}: scrollWidth ${m.sw}`);
    if (m.title !== "auspol tracker – Public opinion") fail(`${at}: title "${m.title}"`);
    if (m.finds.length !== finds.length || m.finds.some((f) => !f.ok)) fail(`${at}: findings index ${m.finds.length}/${finds.length}, every target ${m.finds.every((f) => f.ok)}`);
    if (m.finds.some((f, i) => f.text !== finds[i])) fail(`${at}: an indexed finding is not the payload's`);
    if (m.heads.join("|") !== finds.join("|")) fail(`${at}: the topics' headlines are not their findings`);
    if (m.topics !== topics.length) fail(`${at}: topics ${m.topics}/${topics.length}`);
    if (m.trackers !== trackers.length || m.charts.some((n) => n !== 1)) fail(`${at}: trackers ${m.trackers}/${trackers.length}, charts each ${m.charts}`);
    if (m.lines.reduce((a, b) => a + b, 0) !== panels) fail(`${at}: tracker lines ${m.lines}, pollsters ${panels}`);
    if (m.copyBtns !== trackers.length) fail(`${at}: copy buttons on ${m.copyBtns}/${trackers.length} trackers`);
    if (m.beside.some((b) => b !== (w >= 900 ? "beside" : "under"))) fail(`${at}: latest list ${m.beside}`);
    if (m.items !== cards.length) fail(`${at}: question rows ${m.items}/${cards.length}`);
    if (w <= 640 && m.rowLay.some((r) => r !== "under")) fail(`${at}: a phone row is not stacked (${m.rowLay.join(",")})`);
    if (w >= 1024 && m.rowLay.some((r) => r !== "beside")) fail(`${at}: a wide row is stacked (${m.rowLay.join(",")})`);
    if (m.boxes) fail(`${at}: ${m.boxes} boxed card or panel element(s) left`);
    if (m.levels !== levels) fail(`${at}: levels shown ${m.levels}, payload ${levels}`);
    if (m.unsourced.length) fail(`${at}: rows without a source link: ${m.unsourced.slice(0, 3).join(" | ")}`);
    if (m.nan) fail(`${at}: NaN/undefined in the text`);
    if (m.more !== topics.filter((t) => t.more.length).length) fail(`${at}: More lists ${m.more}`);
    if ((design === "new") !== m.rdHead) fail(`${at}: rd head ${m.rdHead} in the ${design} design`);
    if (design === "new" && (w === 1440 || w === 390)) {
      /* every list item opens to its figures (or the article's words), as
         many as the payload holds, with no store marking in the text, and
         the page still fits its width with every item and fold open */
      const o = await page.evaluate(() => {
        document.querySelectorAll(".btv-more, .btv-mi, .btv-cuts").forEach((d) => { d.open = true; });
        const its = [...document.querySelectorAll(".btv-mi")];
        return { n: its.length, empty: its.filter((it) => !it.querySelector(".btv-fig")).map((it) => it.querySelector(".btv-mq").textContent),
          figs: document.querySelectorAll(".btv-mi .btv-fig").length, sw: document.documentElement.scrollWidth,
          trs: document.querySelectorAll(".btv-mi .btv-tr svg path.btv-trl").length,
          marks: [...document.querySelectorAll(".btv-mi .btv-fig")].map((f) => f.textContent).filter((t) => /\bTables? \d|\(%\)|values?:|value order|\(April \d{4}/.test(t)).length };
      });
      const moreN = topics.reduce((n, t) => n + t.more.length, 0);
      /* a traits series (tables segmented by leader pairing) draws as one grid of small charts */
      const traits = (q) => q.figs.length > 1 && q.figs.every((f) => f.kind === "table" && f.heads.length === 2 && f.rows.some((r) => r.sect));
      const figN = topics.reduce((n, t) => n + t.more.reduce((k, q) => k + (traits(q) ? 1 : q.figs.length) + q.prose.length, 0), 0);
      const trN = topics.reduce((n, t) => n + t.more.filter(traits).reduce((k, q) => k + q.figs.length, 0), 0);
      if (o.n !== moreN) fail(`${at}: More items ${o.n}/${moreN}`);
      if (o.empty.length) fail(`${at}: items opened to nothing: ${o.empty.slice(0, 3).join(" | ")}`);
      if (o.figs !== figN) fail(`${at}: opened figures ${o.figs}/${figN}`);
      if (o.trs !== trN * 2) fail(`${at}: trait charts draw ${o.trs} lines, want two a trait (${trN * 2})`);
      if (o.marks) fail(`${at}: ${o.marks} figure(s) show a store's table numbers, units or packed readings`);
      if (o.sw !== w) fail(`${at}: with every item open the page is ${o.sw}px wide`);
    }
    await page.close();
  }
}

/* the two retired paths redirect, topic anchor and all, and the topic lands
   in view — /ad-hocs/ since 2026-10-18, /beyond-the-vote/ since 2026-10-21 */
for (const from of ["ad-hocs", "beyond-the-vote"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 900 });
  await page.goto(`${base}/${from}/#btv-trump-us`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#btv-trump-us", { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const r = await page.evaluate(() => ({ path: location.pathname, hash: location.hash,
    top: document.getElementById("btv-trump-us") ? document.getElementById("btv-trump-us").getBoundingClientRect().top : null }));
  if (r.path !== "/public-opinion/" || r.hash !== "#btv-trump-us") fail(`/${from}/ landed on ${r.path}${r.hash}`);
  if (r.top == null || r.top < 0 || r.top > 200) fail(`/${from}/: the topic anchor did not land in view (top ${r.top})`);
  await page.close();
}

/* the static article: the topics as text for a crawler or a no-JS reader */
{
  const html = fs.readFileSync(path.join(ROOT, "public-opinion", "index.html"), "utf8");
  const art = (html.match(/<article class="static-summary">[\s\S]*?<\/article>/) || [""])[0];
  if (!art.includes("<h1>Public opinion</h1>")) fail("static article lacks its h1");
  const h2 = (art.match(/<h2>/g) || []).length;
  if (h2 < topics.length) fail(`static article has ${h2} topic heads`);
  if (!art.includes(trackers[0].head.replace(/’/g, "’"))) fail("static article lacks the first tracker's head");
  if (!art.includes("<h2>The findings</h2>") || finds.some((f) => !art.includes(f.replace(/&/g, "&amp;")))) fail("static article lacks the findings");
}

await browser.close();
server.close();
console.log(bad ? `${bad} failure(s)` : `PASS: public-opinion page – ${finds.length} findings, ${topics.length} topics, ${trackers.length} trackers (${panels} lines), ${cards.length} rows, ${levels} levels, no boxes, both designs at 390/640/1024/1440, /ad-hocs/ + /beyond-the-vote/ redirects, static article`);
process.exit(bad ? 1 : 0);
