/* Probe: the More menu's folder (2026-10-18, the user's pick of five
   mockups, "more textured, substantial"). The menu lists each page under
   its own headline with the figure that headline stands on, so the probe
   holds every row to its page: the row's line IS the page's head as the
   page renders it, and its figure is a number the page prints. Then the
   paper: at every rung the sheet hangs from the bar's rule inside the
   screen, the tab sits on its top edge, the figure column lines up, Info
   joins only where the pinned phone bar has dropped its tab, and nothing
   widens the document. Then the keys, the archived design's plain list,
   dark mode's party inks, the satellites' copy (auspol-now.json) and /vic/.
   Run after a build: node .matilda/probe/menu-ledger.mjs */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
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
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };
const errors = [];
const open = async ({ W, H = 844, url = "/", pin = false, dark = false, btn = ".tab.tab-menu" }) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(url + "@" + W + " " + e.message));
  await page.setViewport({ width: W, height: H });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
  await page.goto(base + url, { waitUntil: "load" }); await wait(1400);
  if (pin) { await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "instant" })); await wait(700); }
  await page.click(btn); await wait(350);
  return page;
};
/* every visible row: its id, numeral, line and figure */
const rowsOf = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).map((e) => {
  const q = (c) => { const el = e.querySelector(c); return el ? el.textContent.replace(/​/g, "") : null; };
  const id = e.getAttribute("data-id") || new URL(e.href).pathname.replace(/^\/(vic\/)?|\/$/g, "");
  return { id, n: q(".tab-menu-n, .sh-menu-n"), t: q(".tab-menu-t, .sh-menu-t"), d: q(".tab-menu-d, .sh-menu-d"),
           v: q(".tab-menu-v, .sh-menu-v"), c: q(".tab-menu-c, .sh-menu-c"), chip: q(".tab-menu-chip, .sh-menu-chip") };
});

/* ---- 1. every row says what its page says ---------------------------------- */
let main = null;
{
  const page = await open({ W: 1280, H: 900 });
  main = await page.evaluate(rowsOf, ".tab-menu-pop .tab-menu-item");
  ok(main.map((r) => r.id).join(" ") === "disagreement leans flows flows-explained public-opinion changelog",
    "the menu's six pages, in TABS order (" + main.map((r) => r.id).join(", ") + ")");
  ok(main.every((r, i) => r.n === String(i + 1)), "numbered 1 to " + main.length);
  ok(main.every((r) => r.d && r.d.length > 12), "every page has its line");
  await page.close();
}
const row = (id) => main.find((r) => r.id === id) || {};
const headOf = async (url, sel) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(url + " " + e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(base + url, { waitUntil: "load" }); await wait(1600);
  const out = await page.evaluate((s) => {
    const h = document.querySelector(s);
    const all = (c) => [...document.querySelectorAll(c)].map((e) => e.textContent);
    return { head: h ? h.textContent : null, dek: (h && h.nextElementSibling && h.nextElementSibling.classList.contains("rd-dek")) ? h.nextElementSibling.textContent : null,
             dis: [...document.querySelectorAll(".rd-dis-panel")].map((p) => ({ name: (p.querySelector(".rd-dis-name") || {}).textContent, sub: (p.querySelector(".rd-dis-sub") || {}).textContent })),
             topics: document.querySelectorAll(".btv-topic").length, clDate: (document.querySelector(".cl-date") || {}).textContent || null,
             months: all(".rd-dis-ax") };
  }, sel);
  await page.close();
  return out;
};
{
  const dis = await headOf("/disagreement/", ".view-disagreement .rd-hed");
  ok(dis.head === row("disagreement").d, `disagreement: the line is the page's head ("${row("disagreement").d}")`);
  const who = (row("disagreement").c || "").replace(/ v chance$/i, "").toLowerCase();
  const panel = dis.dis.find((p) => (p.name || "").toLowerCase() === who);
  ok(panel && panel.sub.endsWith(", " + row("disagreement").v), `disagreement: ${row("disagreement").v} is ${who}'s printed ratio (${panel && panel.sub})`);
  const lean = await headOf("/leans/", ".view-leans .rd-hed");
  ok(lean.head === row("leans").d, `leans: the line is the two-party tab's head ("${row("leans").d}")`);
  const mag = (row("leans").v || "").replace(/^[+−]/, "");
  ok(lean.head.includes("by " + mag + " point"), `leans: ${row("leans").v} is the head's own lean`);
  ok((row("leans").v || "").startsWith("+") === / to Labor,/.test(lean.head), "leans: + means towards Labor, as the head says");
  const fl = await headOf("/flows/", ".view-flows .rd-hed");
  ok(fl.head === row("flows").d, `flows: the line is the page's head ("${row("flows").d}")`);
  if (row("flows").v) ok((row("flows").v.endsWith("%") ? fl.dek : fl.head + fl.dek).includes(row("flows").v.replace(/^[+−]/, "")),
    `flows: ${row("flows").v} is printed in the page's own words`);
  const ex = await headOf("/flows-explained/", ".view-flows-explained .rd-hed");
  ok(ex.head === row("flows-explained").d && row("flows-explained").chip === "Explainer", "explainer: its head, and its kind for a figure");
  const btv = await headOf("/public-opinion/", ".view-public-opinion .rd-hed");
  ok(btv.head === row("public-opinion").d, "Public opinion: the line is the page's head");
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  {
    const oneoffs = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "oneoffs-source.json"), "utf8"));
    const dates = [];
    for (const t of oneoffs.topics) for (const o of [...(t.blocks || []), ...(t.more || [])]) for (const d of [o.last, o.wave]) if (d) dates.push(d);
    dates.sort();
    const biso = dates[dates.length - 1];
    ok(row("public-opinion").v === +biso.slice(8, 10) + " " + MN[+biso.slice(5, 7) - 1] && row("public-opinion").c === "Latest entry",
      `Public opinion: ${row("public-opinion").v}, "Latest entry", is the catalogue's newest wave (${biso})`);
  }
  const cl = await headOf("/changelog/", ".view-changelog .rd-hed");
  const iso = cl.clDate || "";
  ok(iso && row("changelog").v === +iso.slice(8, 10) + " " + MN[+iso.slice(5, 7) - 1], `changelog: ${row("changelog").v} is the newest entry's date (${iso})`);
  const info = await headOf("/info/", ".info .rd-hed");
  ok(info.head && info.head.length > 10, "info: its head reads (" + info.head + ")");
  main.infoHead = info.head;
}

/* ---- 2. the paper, rung by rung ---------------------------------------------- */
for (const W of [320, 360, 390, 414, 430, 600, 640, 641, 700, 860, 1024, 1280, 1440]) {
  const phone = W <= 640;
  const page = await open({ W, H: phone ? 760 : 900, pin: phone });
  const m = await page.evaluate(() => {
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const pop = document.querySelector(".tab-menu-pop"), btn = document.querySelector(".tab.tab-menu"), pp = document.querySelector(".tab-menu-paper");
    const items = [...pop.querySelectorAll(".tab-menu-item")].filter((e) => e.offsetParent !== null);
    return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, pop: R(pop), btn: R(btn), paper: R(pp),
             vis: getComputedStyle(pp).visibility, gA: parseFloat(pop.style.getPropertyValue("--gap-a")), gB: parseFloat(pop.style.getPropertyValue("--gap-b")),
             figR: items.map((e) => Math.round(e.querySelector(".tab-menu-f").getBoundingClientRect().right)),
             txtL: items.map((e) => Math.round(e.querySelector(".tab-menu-txt").getBoundingClientRect().left)),
             ids: items.map((e) => new URL(e.href).pathname), info: items.some((e) => e.classList.contains("tab-menu-info")),
             docked: document.querySelector(".tabs").classList.contains("show-score"),
             stuck: document.querySelector(".tabs").classList.contains("pinned") && getComputedStyle(document.querySelector(".tabs")).position === "sticky" };
  });
  const near = (a, b, d = 1) => Math.abs(a - b) <= d;
  const inL = m.pop.l >= 8 - 0.5 || near(m.pop.l, m.paper.l), inR = m.pop.r <= m.vw - 8 + 0.5 || near(m.pop.r, m.paper.r);
  ok(m.sw <= m.vw, `${W}: no horizontal overflow (${m.sw - m.vw}px)`);
  ok(inL && inR, `${W}: the sheet sits inside the screen, or squares off with the tab (${m.pop.l.toFixed(1)}–${m.pop.r.toFixed(1)})`);
  ok(m.vis === "visible" && m.paper.l >= m.pop.l - 0.5 && m.paper.r <= m.pop.r + 0.5, `${W}: the tab stands on the sheet's top edge`);
  ok(near(m.pop.t, m.btn.b) && near(m.paper.b, m.pop.t), `${W}: the sheet hangs from the rule, flush under the tab`);
  ok(near(m.gA, m.paper.l - m.pop.l + 1, 1.5) && near(m.gB, m.paper.r - m.pop.l - 1, 1.5), `${W}: the top edge opens between the tab's sides`);
  ok(m.figR.every((x) => near(x, m.figR[0])) && m.txtL.every((x) => near(x, m.txtL[0])), `${W}: the ledger's columns line up`);
  ok(m.info === (W <= 420 && m.docked), `${W}: Info ${m.info ? "joins" : "stays off"} the menu (docked=${m.docked})`);
  if (m.stuck) ok(m.pop.b <= m.vh - 12 + 1, `${W}: on the stuck bar the sheet fits the screen, its rows scrolling (${Math.round(m.pop.b)} of ${m.vh})`);
  await page.close();
}
/* Info's line, where it joins */
{
  const page = await open({ W: 390, pin: true });
  const rows = await page.evaluate(rowsOf, ".tab-menu-pop .tab-menu-item");
  const info = rows.find((r) => r.id === "info");
  ok(info && info.n === "7" && info.d === main.infoHead, `390 pinned: Info is 7, under its own head ("${info && info.d}")`);
  await page.close();
}

/* ---- 3. keys -------------------------------------------------------------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1400);
  await page.focus(".tab.tab-menu");
  await page.keyboard.press("ArrowDown"); await wait(250);
  const a = await page.evaluate(() => ({ open: !!document.querySelector(".tab-menu-pop"), first: document.activeElement && document.activeElement.querySelector && (document.activeElement.querySelector(".tab-menu-t") || {}).textContent }));
  ok(a.open && a.first === "Poll disagreement", `ArrowDown opens the menu on its first page (${a.first})`);
  await page.keyboard.press("End"); await wait(100);
  const b = await page.evaluate(() => (document.activeElement.querySelector(".tab-menu-t") || {}).textContent);
  ok(b === "Changelog", `End walks to the last page (${b})`);
  await page.keyboard.press("Escape"); await wait(150);
  const c = await page.evaluate(() => ({ open: !!document.querySelector(".tab-menu-pop"), btn: document.activeElement === document.querySelector(".tab.tab-menu") }));
  ok(!c.open && c.btn, "Escape closes it and hands focus back to the button");
  await page.close();
}

/* ---- 4. the archived design keeps its plain list ------------------------------- */
{
  const page = await open({ W: 1280, url: "/?design=old" });
  const o = await page.evaluate(() => ({ list: !!document.querySelector(".tab-menu-list"), n: document.querySelectorAll(".tab-menu-n").length,
    paper: !!document.querySelector(".tab-menu-paper"), tips: [...document.querySelectorAll(".tab-menu-pop .tab-menu-d")].length,
    rd: document.body.classList.contains("rd") }));
  ok(!o.rd && !o.list && !o.n && !o.paper && o.tips >= 6, "design=old: the plain list, its tips, no paper or numerals");
  await page.close();
}

/* ---- 5. dark mode: the figures keep their party's ink -------------------------- */
{
  const page = await open({ W: 1280, dark: true });
  const d = await page.evaluate(() => [...document.querySelectorAll(".tab-menu-v")].filter((v) => /\btm-/.test(v.className)).map((v) => {
    const tone = v.className.match(/tm-(\w+)/)[1], t = document.createElement("span");
    t.style.color = `var(--${tone}-text)`; document.body.appendChild(t);
    const want = getComputedStyle(t).color; t.remove();
    return getComputedStyle(v).color === want;
  }));
  ok(d.length >= 2 && d.every(Boolean), `dark: ${d.length} figures in their party's text ink`);
  await page.close();
}

/* ---- 6. the satellites carry the same lines ------------------------------------- */
{
  const page = await open({ W: 1280, url: "/feedback/", btn: ".sh-menu-btn" });
  const sat = await page.evaluate(rowsOf, "#sh-menu .sh-menu-item");
  const same = main.every((r) => { const s = sat.find((x) => x.id === r.id); return s && s.d === r.d && s.v === r.v && s.c === r.c && s.chip === r.chip; });
  ok(same && sat.filter((s) => s.id !== "info").length === main.length, "feedback: the same six lines and figures as the main page's menu");
  const m = await page.evaluate(() => {
    const pop = document.getElementById("sh-menu").getBoundingClientRect(), pp = document.querySelector(".sh-menu-paper").getBoundingClientRect(),
      btn = document.querySelector(".sh-menu-btn").getBoundingClientRect();
    return { join: Math.abs(pop.top - btn.bottom) <= 1 && pp.left >= pop.left - 0.5, sw: document.documentElement.scrollWidth, vw: innerWidth };
  });
  ok(m.join && m.sw <= m.vw, "feedback: the folder hangs from the bar, the tab on its edge, no overflow");
  await page.close();
}

/* ---- 7. /vic/: its three pages, each under its own head ------------------------- */
{
  const page = await open({ W: 1280, url: "/vic/" });
  const vic = await page.evaluate(rowsOf, ".tab-menu-pop .tab-menu-item");
  ok(vic.map((r) => r.id).join(" ") === "disagreement leans flows" && vic.every((r) => r.d), "vic: the three pages, each with its line");
  await page.close();
  const lean = await headOf("/vic/leans/", ".view-leans .rd-hed");
  ok(lean.head === (vic.find((r) => r.id === "leans") || {}).d, `vic: the leans line is its page's head ("${lean.head}")`);
}

ok(!errors.length, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
server.close();
console.log(fails ? `menu-ledger: ${fails} FAIL` : "menu-ledger: all pass");
process.exit(fails ? 1 : 0);
