/* Probe: the Public opinion page's search (rd-public-opinion.jsx PubOpSearch over
   PubOpResults, shipped with the page's .pubop-tools row), in both designs at two
   widths. Asserts typing a word out of a question swaps the findings, the
   order row and the spell line for a results view whose topic groups carry
   the matched pieces (the long tail drawn open, never folded); the topic's
   own name finds every one of its pieces (the topic rides each piece's
   haystack); every token of a query must match (the All-polls box's AND);
   a hyphen finds an en dash where the payload's own words hold one; a miss
   names itself; the × clears back to the page as it was, with its count of
   topics; typed digits and arrow keys never flip the order or leave the
   page while the box is focused; no console errors, no sideways scroll.
   BASE=<worktree> serves another tree's build. */
import puppeteer from "puppeteer-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const pubDoc = fs.readFileSync(path.join(ROOT, "public-opinion", "index.html"), "utf8");
const hashed = pubDoc.match(/oneoffs-source\.[0-9a-f]+\.json/);
/* the copy the page fetches: assets/ can hold older oneoffs-source by hash */
const asset = hashed ? hashed[0] : fs.readdirSync(path.join(ROOT, "assets")).find((f) => /^oneoffs-source\..+\.json$/.test(f));
const src = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", asset), "utf8"));
const topics = src.topics.filter((t) => t.blocks.length || t.more.length);
const nTopics = topics.length;
let bad = 0; const fail = (m) => { console.log("FAIL " + m); bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the typed tokens, all drawn from the payload so the probe rides its drift:
   one word out of a long-tail question's title, the last long word of the
   first topic's name, and one en-dashed word-pair from any title or
   question, where the payload offers one */
const STOP = new Set(["among", "about", "after", "before", "between", "should", "could", "would", "their", "which", "where", "there", "australia", "australians"]);
const wordingPick = (() => {
  for (const t of topics) for (const m of t.more) {
    const words = (String(m.title || "").toLowerCase().match(/[a-z][a-z]{5,}/g) || []).filter((x) => !STOP.has(x));
    if (words.length) return { token: words[0], topic: t.title, title: m.title };
  }
  return null;
})();
const t0 = topics[0];
const t0Pieces = t0.blocks.length + t0.more.length;
const t0Token = (String(t0.title).toLowerCase().match(/[a-z][a-z]{3,}/g) || []).slice(-1)[0];
const dashPick = (() => {
  const texts = [];
  for (const t of topics) {
    texts.push(t.title, t.short || "");
    t.more.forEach((m) => { texts.push(m.title, ...(m.srcs || []).map((s) => s.question || "")); });
  }
  for (const text of texts) {
    const w = String(text).toLowerCase().match(/[a-z]{2,}–[a-z]{2,}/);
    if (w) return { en: w[0], hy: w[0].replace("–", "-") };
  }
  return null;
})();

/* replace the box's query (the × click and the focus land on the elements
   themselves: clearing reflows the page around a coordinate, and a raw
   .value= never reaches a controlled React input) */
async function type(page, text) {
  await page.evaluate(() => {
    const x = document.querySelector(".pubop-x");
    if (x) x.click();
    document.querySelector(".pubop-tools input").focus();
  });
  if (text) await page.keyboard.type(text);
}

for (const design of ["new", "old"]) for (const w of [390, 1440]) {
  const page = await browser.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.setViewport({ width: w, height: 1000 });
  await page.goto(`${base}/public-opinion/?design=${design}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".pubop-tools input", { timeout: 20000 }); await sleep(300);
  const here = await page.evaluate(() => ({
    ph: document.querySelector(".pubop-tools input").getAttribute("placeholder"),
    type: document.querySelector(".pubop-tools input").type,
    val: document.querySelector(".pubop-tools input").value,
    x: !!document.querySelector(".pubop-x"),
    pillW: document.querySelector(".pubop-search").getBoundingClientRect().width,
    barW: document.querySelector(".pubop-tools").getBoundingClientRect().width,
    barH: document.querySelector(".pubop-tools").getBoundingClientRect().height,
  }));
  if (!here.ph) fail(`${design}@${w} the box has no placeholder`);
  if (here.type !== "search") fail(`${design}@${w} the box's type is ${here.type}`);
  if (here.val !== "") fail(`${design}@${w} the box opens with text in it`);
  if (here.x) fail(`${design}@${w} an empty box shows a clearer`);
  /* the toolbar row must hold its pill: a height under the 36px pill means
     the row clipped it (the 2026-10-28 pubop-bar answer-track class collision
     shrank it to a 12px sliver - the row is .pubop-tools since) */
  if (here.barH < 36) fail(`${design}@${w} the toolbar row is ${here.barH}px tall, under its 36px pill`);
  /* the All-polls pill's own width: 330 on the wide rung, full width on the
     phone rung (the ladder in template.html beside the .pubop-sort rules) */
  if (w >= 1001 && Math.round(here.pillW) !== 330) fail(`${design}@${w} the pill is ${here.pillW}px wide, expected 330`);
  if (w <= 760 && Math.abs(here.pillW - here.barW) > 1) fail(`${design}@${w} the phone pill stops ${here.barW - here.pillW}px short of its row`);

  /* keyboard focus rings the pill's container, never a second rectangle on
     the inset input (the rd.css tail kill beside rd-ap-search's, plus the
     template's classic-sheet kill) */
  await page.keyboard.press("Tab");
  await page.evaluate(() => document.querySelector(".pubop-search input").focus());
  const focus = await page.evaluate(() => ({ pill: getComputedStyle(document.querySelector(".pubop-search")).outlineStyle,
    inner: getComputedStyle(document.querySelector(".pubop-search input")).outlineStyle }));
  await page.evaluate(() => document.activeElement.blur());
  if (focus.inner !== "none") fail(`${design}@${w} keyboard focus rings the inset input - the inner rectangle (${focus.inner})`);
  if (focus.pill !== "solid") fail(`${design}@${w} keyboard focus never rings the pill itself (${focus.pill})`);

  if (!wordingPick) { fail("no long-tail question offered a token"); await page.close(); continue; }

  /* a word out of a long-tail question (its topic's group draws first) */
  await type(page, wordingPick.token); await sleep(800);
  const r = await page.evaluate(() => ({
    finds: !!document.querySelector(".pubop-finds"), sort: !!document.querySelector(".pubop-sort"),
    scope: !!document.querySelector(".pubop > p.pubop-scope"),
    count: (document.querySelector(".pubop-rcount b") || {}).textContent || null,
    groups: [...document.querySelectorAll(".pubop-res .pubop-topic")].map((g) => g.querySelector("h3").textContent),
    hits: [...document.querySelectorAll(".pubop-hit .pubop-q")].map((e) => e.textContent),
    none: !!document.querySelector(".pubop-none"),
    val: document.querySelector(".pubop-tools input").value,
    sw: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (r.val !== wordingPick.token) fail(`${design}@${w} the box lost the query: "${r.val}"`);
  if (r.finds || r.sort) fail(`${design}@${w} the findings or the order row stayed on show while searching`);
  if (r.scope) fail(`${design}@${w} the spell line stayed on show while searching`);
  if (r.none) fail(`${design}@${w} a token from a question showed the empty state`);
  if (!r.count || r.count === "0") fail(`${design}@${w} no count line on results`);
  if (!r.hits.includes(wordingPick.title)) fail(`${design}@${w} the question is not among the hits: ${wordingPick.title}`);
  if (!r.groups.includes(wordingPick.topic)) fail(`${design}@${w} its topic is not in the results: ${r.groups}`);
  if (r.sw) fail(`${design}@${w} sideways scroll on results`);

  /* the topic's own name finds every one of its pieces; its group draws first */
  await type(page, t0Token); await sleep(800);
  const k = await page.evaluate((want) => {
    const g = [...document.querySelectorAll(".pubop-res .pubop-topic")].find((s) => s.querySelector("h3").textContent === want);
    if (!g) return { missing: true };
    return { trackers: g.querySelectorAll(".pubop-tracker").length, items: g.querySelectorAll(".pubop-item").length };
  }, t0.title);
  if (k.missing) fail(`${design}@${w} "${t0Token}" never found the ${t0.title} topic`);
  else if (k.trackers + k.items !== t0Pieces) fail(`${design}@${w} "${t0Token}" left pieces of the topic behind: ${k.trackers}+${k.items} of ${t0Pieces}`);

  /* every token must match (the word plus a made-up one: nothing) */
  await type(page, wordingPick.token + " zzzzx"); await sleep(800);
  if (await page.evaluate(() => !document.querySelector(".pubop-none"))) fail(`${design}@${w} an impossible AND still matched`);

  /* a miss names itself, quote and all, and no results remain */
  await type(page, "zzzzx"); await sleep(800);
  const none = await page.evaluate(() => ({ msg: (document.querySelector(".pubop-none") || {}).textContent || null,
    groups: document.querySelectorAll(".pubop-res .pubop-topic").length }));
  if (!none.msg || !/Nothing matches/.test(none.msg)) fail(`${design}@${w} the miss never named itself: ${none.msg}`);
  if (!/zzzzx/.test(none.msg || "")) fail(`${design}@${w} the miss does not quote the query: ${none.msg}`);
  if (none.groups) fail(`${design}@${w} the miss kept ${none.groups} result groups`);

  /* a hyphen finds an en dash, where the payload's own words hold one */
  if (dashPick) {
    const counts = {};
    for (const [kind, token] of [["en", dashPick.en], ["hy", dashPick.hy]]) {
      await type(page, token); await sleep(800);
      counts[kind] = await page.evaluate(() => (document.querySelector(".pubop-rcount b") || { textContent: "0" }).textContent);
    }
    if (counts.en === "0" || counts.hy === "0") fail(`${design}@${w} the en-dash pair matched nothing: ${dashPick.en} (${counts.en},${counts.hy})`);
    else if (counts.en !== counts.hy) fail(`${design}@${w} hyphen ≠ en dash: ${counts.hy} v ${counts.en}`);
  } else console.log("note: no en-dashed word in titles or wordings; the hyphen pin is skipped");

  /* typed digits and arrow keys stay in the box (the sort reads its default
     page first: the queries above leave it under the empty state) */
  await type(page, ""); await sleep(700);
  const press0 = await page.$$eval(".pubop-sort-b", (bs) => bs.map((b) => b.getAttribute("aria-pressed")).join());
  await type(page, "9"); await sleep(500);
  const typ = await page.evaluate(() => ({ path: location.pathname, val: document.querySelector(".pubop-tools input").value, finds: !!document.querySelector(".pubop-finds") }));
  if (typ.path !== "/public-opinion/") fail(`${design}@${w} a digit navigated to ${typ.path}`);
  if (typ.val !== "9") fail(`${design}@${w} the typed digit never landed in the box: "${typ.val}"`);
  if (typ.finds) fail(`${design}@${w} a typed query left the default page up`);
  await page.keyboard.press("Backspace"); await sleep(700);
  await page.evaluate(() => document.querySelector(".pubop-tools input").focus());
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowLeft"); await sleep(300);
  const press2 = await page.$$eval(".pubop-sort-b", (bs) => bs.map((b) => b.getAttribute("aria-pressed")).join());
  if (press0 !== press2) fail(`${design}@${w} arrows flipped the order row while the box was focused: ${press0} -> ${press2}`);
  /* the × restores the whole page */
  await type(page, wordingPick.token); await sleep(500);
  await page.evaluate(() => document.querySelector(".pubop-tools").scrollIntoView({ behavior: "instant", block: "center" }));
  await sleep(250);
  await page.click(".pubop-x"); await sleep(800);

  /* the page as it was */
  const back = await page.evaluate(() => ({
    finds: !!document.querySelector(".pubop-finds"), sort: !!document.querySelector(".pubop-sort"),
    topics: document.querySelectorAll(".pubop-topic:not(.pubop-mon)").length,
    val: document.querySelector(".pubop-tools input").value, x: !!document.querySelector(".pubop-x"),
    sw: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (!back.finds || !back.sort) fail(`${design}@${w} the findings or the order row never came back`);
  if (back.topics !== nTopics) fail(`${design}@${w} ${back.topics} topics after clearing, expected ${nTopics}`);
  if (back.val !== "") fail(`${design}@${w} the box kept text: "${back.val}"`);
  if (back.x) fail(`${design}@${w} the empty box kept its clearer`);
  if (back.sw) fail(`${design}@${w} sideways scroll after clearing`);

  if (errs.length) fail(`${design}@${w} page errors: ${errs.slice(0, 3).join(" | ")}`);
  await page.close();
}
await browser.close(); server.close();
if (bad) { console.log(`${bad} failures`); process.exit(1); }
console.log(`ok: public-opinion search (2 designs × 2 widths; "${wordingPick.token}" ${wordingPick.topic}; "${t0Token}" ${t0.title}${dashPick ? `; "${dashPick.en}"` : ""})`);
