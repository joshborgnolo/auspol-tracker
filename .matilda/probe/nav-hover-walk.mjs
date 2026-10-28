/* Probe: hover-claimed arrow walks (user report 2026-10-21 - "hovering over
   the menu bar or over content doesn't bring it into focus such that arrow
   walking works"). Two claims, both armed by the pointer alone, never by
   moving DOM focus, both released when the pointer leaves:
   1. the navbar (Tabs in d1a1d215) - hovering the bar steps the VISIBLE
      bar tabs, wrapping; on a menu page right goes to the first bar tab.
      The ☰ menu owns the keys while open, and real keyboard focus on a tab
      wins over the claim.
   2. the Public opinion Sort row (PubOpSort) - hovering anywhere in
      section#public-opinion steps issue -> pollster -> recency, wrapping.
   Where neither claim is armed the page-level walk keeps its turn.
   BASE=<tree> serves another tree's build. */
import puppeteer from "puppeteer-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.env.BASE || decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const fail = (m) => { console.log("FAIL " + m); bad++; };
const page = await browser.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.setViewport({ width: 1280, height: 800 });
const arrow = async (key) => { await page.keyboard.press(key); await sleep(420); };
const navSpot = async () => page.evaluate(() => { const r = document.querySelector("nav.tabs").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
const active = () => page.evaluate(() => {
  const el = document.querySelector('[role="tab"][aria-selected="true"]');
  return { tab: el ? el.id.replace(/^tab-/, "") : null, path: location.pathname,
           ae: (document.activeElement || {}).tagName };
});

/* ---- Phase A: the navbar's hover claim -------------------------------- */
await page.goto(`${base}/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("nav.tabs [role='tab']", { timeout: 20000 }); await sleep(400);
const barIds = await page.evaluate(() => [...document.querySelectorAll(".tabs-list [role='tab']")].map((t) => t.id.replace(/^tab-/, "")));
if (barIds.length < 3) fail(`expected at least 3 bar tabs, saw ${barIds.length}`);
const pathOf = (id) => page.evaluate((id2) => window.AP.tabToPath(id2), id);
{
  const s = await navSpot();
  await page.mouse.move(s.x, s.y); await sleep(200);
}
const seq = [...barIds.slice(1), barIds[0]];                 /* right-walk from the first */
for (let i = 0; i < seq.length; i++) {
  await arrow("ArrowRight");
  const s = await active();
  if (s.tab !== seq[i]) fail(`hover-walk right ${i + 1}: active ${s.tab}, wanted ${seq[i]}`);
  const wantPath = await pathOf(seq[i]);
  if (s.path !== wantPath) fail(`hover-walk right ${i + 1}: path ${s.path}, wanted ${wantPath}`);
  if (s.ae !== "BODY" && s.ae !== "HTML") fail(`hover-walk right ${i + 1}: focus moved to ${s.ae}`);
}
{ /* and back */
  await arrow("ArrowLeft");
  const s = await active();
  if (s.tab !== barIds[barIds.length - 1]) fail(`hover-walk back: active ${s.tab}, wanted ${barIds[barIds.length - 1]}`);
}
{ /* pointer off the bar releases the claim: from a menu page the page-level
     walk turns to the menu page's own successor, never to a bar tab */
  await page.goto(`${base}/disagreement/`, { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(500);
  const s = await navSpot();
  await page.mouse.move(s.x, s.y); await sleep(200);
  await arrow("ArrowRight");
  const hovered = await active();
  if (hovered.tab !== barIds[0]) fail(`menu page, hovering bar: right went to ${hovered.tab}, wanted the first bar tab ${barIds[0]}`);
  /* off the bar the page-level walk resumes - from All polls it turns to
     DISAGREEMENT, the first menu page, where a leaked nav claim would jump
     the menu pages straight to Info. Park the pointer on the masthead:
     unpinned the nav sits below it, and no section claim reaches there */
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
  await page.mouse.move(640, 12); await sleep(250);
  const spot = await page.evaluate(() => { const el = document.elementFromPoint(640, 12); return el ? el.closest("nav.tabs") != null : false; });
  if (spot) fail("the 640,12 hover spot is inside the nav, not the masthead - the off-bar check is meaningless here");
  await arrow("ArrowRight"); const o1 = await active();
  if (o1.tab !== barIds[1]) fail(`off the bar, right 1: active ${o1.tab}, wanted ${barIds[1]}`);
  await arrow("ArrowRight"); const o2 = await active();
  if (o2.tab !== barIds[2]) fail(`off the bar, right 2: active ${o2.tab}, wanted ${barIds[2]}`);
  await arrow("ArrowRight"); const o3 = await active();
  if (o3.path !== "/disagreement/") fail(`off the bar, right 3: on ${o3.path}, wanted the page walk's turn to /disagreement/ (a leaked nav claim jumps to Info)`);
}
{ /* the open ☰ menu owns the keys */
  await page.goto(`${base}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("nav.tabs [role='tab']", { timeout: 20000 }); await sleep(400);
  await page.click("button.tab-menu"); await sleep(250);
  const s = await active();
  await arrow("ArrowRight");
  const after = await active();
  if (after.tab !== s.tab) fail(`menu open: right moved the bar to ${after.tab} from ${s.tab}`);
  const open = await page.evaluate(() => document.querySelector("button.tab-menu").getAttribute("aria-expanded"));
  if (open !== "true") fail("menu closed by an arrow key");
  await page.keyboard.press("Escape"); await sleep(200);
}
{ /* real keyboard focus on a tab wins over the claim: the ARIA walk moves
     BOTH selection and focus (selection follows focus); the hover claim
     never moves focus - so the focus move is what proves the focused
     handler, not the claim, stepped. Two rights from focused cycles:
     the first claims what the pointer gave up (now -> cycles), the second
     lands on allpolls AND moves focus there */
  const s = await navSpot();
  await page.mouse.move(s.x, s.y); await sleep(150);
  await page.evaluate(() => document.getElementById("tab-cycles").focus());
  await arrow("ArrowRight");
  await arrow("ArrowRight");
  const st = await active();
  if (st.tab !== "allpolls") fail(`focused walk: two rights landed on ${st.tab}, wanted allpolls`);
  const aeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
  if (aeId !== "tab-allpolls") fail(`focused walk: focus did not follow to tab-allpolls (on ${aeId})`);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
}

/* ---- Phase B: the Sort row's catalogue-wide hover claim --------------- */
await page.goto(`${base}/public-opinion/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".pubop-sort-g", { timeout: 20000 }); await sleep(400);
const pressed = () => page.evaluate(() => [...document.querySelectorAll(".pubop-sort-b")].map((b) => b.getAttribute("aria-pressed")).join());
if (await pressed() !== "true,false,false") fail(`sort starts ${await pressed()}, wanted issue pressed`);
{ /* pointer on the sort row */
  const y = await page.evaluate(() => { const g = document.querySelector(".pubop-sort-g"); g.scrollIntoView({ behavior: "instant", block: "center" }); const r = g.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
  await page.mouse.move(y.x, y.y); await sleep(200);
}
const sortSeq = ["false,true,false", "false,false,true", "true,false,false"];
for (let i = 0; i < sortSeq.length; i++) {
  await arrow("ArrowRight");
  const p = await pressed();
  if (p !== sortSeq[i]) fail(`sort hover-walk ${i + 1}: pressed ${p}, wanted ${sortSeq[i]}`);
  const s = await active();
  if (s.path !== "/public-opinion/") fail(`sort hover-walk ${i + 1}: path drifted to ${s.path}`);
  if (s.ae !== "BODY" && s.ae !== "HTML") fail(`sort hover-walk ${i + 1}: focus moved to ${s.ae}`);
}
{ /* pointer deep in the catalogue (a topic head) still owns the step */
  const spot = await page.evaluate(() => {
    const h = [...document.querySelectorAll(".pubop-mon h3, .pubop-topic h3")][3];
    h.scrollIntoView({ behavior: "instant", block: "center" });
    const r = h.getBoundingClientRect();
    return { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(spot.x, spot.y); await sleep(200);
  await arrow("ArrowRight");
  const p = await pressed();
  if (p !== "false,true,false") fail(`deep in the catalogue: pressed ${p}, wanted pollster`);
}
{ /* pointer above the section (the masthead) releases it: page turn */
  await page.mouse.move(640, 12); await sleep(250);
  await arrow("ArrowRight");
  const s = await active();
  if (s.path === "/public-opinion/") fail("after leaving the catalogue the sort claim still armed (no page turn)");
  const gone = await page.evaluate(() => !document.querySelector(".pubop-sort-g"));
  if (!gone) fail("sort row still mounted after the page turn");
}
if (errs.length) fail(`page errors ${errs.slice(0, 3)}`);
await browser.close(); server.close();
console.log(bad ? bad + " failure(s)" : "ALL PASS: navbar hover-walk wraps, yields to menu and real focus; sort claim reaches the catalogue and releases on leave");
