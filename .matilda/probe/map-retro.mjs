// Probe: /map/'s retro view, its navbar menus item by item (Home, Edit, View,
// Favorites with add, list, remove and go, Help, More pages, the phone's Pages)
// usage: node .matilda/probe/map-retro.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";
const base = process.argv[2], pre = "";
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = [];
const check = (name, cond, detail) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); if (!cond) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const boot = async (hash) => { await page.goto(`${base}/map/#${hash}`, { waitUntil: "load" }); await page.waitForFunction(() => window.__map && window.__map.M && window.__map.M(), { timeout: 60000 }); await sleep(2500); };
await boot("retro=1");
const open = async (k) => { await page.click(`.rt-nav [data-rt-menu="${k}"]`); await sleep(250); return page.evaluate(() => ({ hidden: document.querySelector(".rt-drop").hidden, items: [...document.querySelectorAll(".rt-drop [role=menuitem]")].map((b) => (b.disabled ? "(off) " : "") + b.textContent.trim()), focus: document.activeElement && document.activeElement.textContent.trim() })); };
const item = async (text) => { await page.evaluate((t) => [...document.querySelectorAll(".rt-drop [role=menuitem]")].find((b) => b.textContent.includes(t)).click(), text); await sleep(700); };

const nav = await page.evaluate(() => [...document.querySelectorAll(".rt-nav .rt-ni, .rt-pages a")].filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
check("the navbar: Home, Edit, View, Favorites, Help, then the site's pages", nav.slice(0, 5).join("|") === "Home|Edit|View|Favorites|Help" && nav.includes("Past cycles") && nav.includes("More pages"), nav);
check("Home is the site's home page", await page.evaluate(() => document.querySelector(".rt-nav a.rt-ni").getAttribute("href") === "/"));
let m = await open("edit");
check("Edit opens its menu, focus on the first item", !m.hidden && m.items[0].startsWith("Find a seat") && m.focus.startsWith("Find a seat"), m);
check("Clear filters is off with no filter on", m.items.some((t) => t === "(off) Clear filters"), m.items);
await item("Find a seat");
check("Find focuses the search", await page.evaluate(() => document.activeElement && document.activeElement.id === "q"));
await page.click('#state-filters [data-state="NSW"]'); await sleep(1200);
m = await open("edit");
check("Clear filters is on with a filter on", m.items.includes("Clear filters"), m.items);
await item("Clear filters"); await sleep(800);
check("Clear filters clears both", await page.evaluate(() => !window.__map.S.f.st && !window.__map.S.f.cls && window.__map.S.sel.level === "aus"));
m = await open("view");
check("View marks the current view and offers full screen, city names and the way back", m.items[0] === "●Map" && m.items.some((t) => t.startsWith("Full screen")) && m.items.some((t) => t.includes("City names")) && m.items.includes("Modern view"), m.items);
await item("Chamber"); await sleep(800);
check("View › Chamber switches the view", await page.evaluate(() => window.__map.S.view === "chamber"));
m = await open("view");
check("City names is off outside the map", m.items.some((t) => t.startsWith("(off)") && t.includes("City names")), m.items);
await item("Map"); await sleep(800);
await open("view"); await item("City names"); await sleep(400);
check("View › City names toggles them", await page.evaluate(() => window.__map.S.townsOff === true));
await open("view"); await item("City names"); await sleep(300);
// arrows: down walks the menu, right opens the next one
await open("edit");
await page.keyboard.press("ArrowDown"); await sleep(100);
const f2 = await page.evaluate(() => document.activeElement.textContent.trim());
await page.keyboard.press("ArrowRight"); await sleep(250);
const next = await page.evaluate(() => ({ exp: document.querySelector('.rt-nav [data-rt-menu="view"]').getAttribute("aria-expanded"), hidden: document.querySelector(".rt-drop").hidden }));
check("arrows walk the menu and the bar", f2.startsWith("Copy link") && next.exp === "true" && !next.hidden, { f2, next });
await page.keyboard.press("Escape"); await sleep(200);
check("Escape closes the menu, focus back on its button", await page.evaluate(() => document.querySelector(".rt-drop").hidden && document.activeElement.dataset.rtMenu === "view"));
// Favorites
await page.evaluate(() => { const m2 = window.__map.M(); window.__map.goDiv(m2.byName.get("Bradfield")); }); await sleep(1500);
m = await open("fav");
check("Favorites starts empty", m.items[0] === "Add this view to Favorites" && m.items.includes("(off) No favourites yet"), m.items);
await item("Add this view");
const note = await page.evaluate(() => (document.querySelector(".rt-note") || {}).textContent);
check("adding says so", note === "Added to Favorites", note);
m = await open("fav");
check("the view is listed, named for itself", m.items.some((t) => /^Bradfield · \d{4}|^Bradfield · now/.test(t)), m.items);
await page.keyboard.press("Escape");
await page.evaluate(() => window.__map.goAus()); await sleep(1200);
await open("fav"); await item("Add this view"); await sleep(300);
m = await open("fav");
check("a second view lists first", m.items[1] === "The House today" && m.items.length === 3, m.items);
await page.evaluate(() => document.querySelector(".rt-drop [data-rt-favdel]").click()); await sleep(300);
m = await page.evaluate(() => ({ hidden: document.querySelector(".rt-drop").hidden, items: [...document.querySelectorAll(".rt-drop [role=menuitem]")].map((b) => b.textContent.trim()) }));
check("× removes a favourite and the menu stays open", !m.hidden && m.items.length === 2 && /^Bradfield/.test(m.items[1]), m);
// going to a favourite reloads on its view, still in retro
await Promise.all([page.waitForNavigation({ waitUntil: "load" }).catch(() => {}), page.evaluate(() => document.querySelector(".rt-drop [data-rt-fav]").click())]);
await page.waitForFunction(() => window.__map && window.__map.M && window.__map.M(), { timeout: 60000 }); await sleep(2500);
const went = await page.evaluate(() => ({ sel: window.__map.S.sel.level, title: document.querySelector("#story .st-head h2").childNodes[0].textContent, retro: document.documentElement.classList.contains("mp-retro"), hash: location.hash }));
check("a favourite opens its view, in retro", went.sel === "div" && /Bradfield/.test(went.title) && went.retro && /retro=1/.test(went.hash), went);
// Help
m = await open("help");
check("Help: the notes and feedback", m.items.join("|") === "How the map is built|Send feedback…", m.items);
await item("How the map is built"); await sleep(900);
check("How the map is built scrolls to the notes", await page.evaluate(() => Math.abs(document.querySelector(".mp-notes").getBoundingClientRect().top) < 80));
await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
m = await open("more");
check("More pages lists the rest of the site, this page marked", m.items.some((t) => /✓Electoral map/.test(t)) && m.items.length >= 5, m.items);
await page.keyboard.press("Escape");
check("no page errors", errs.length === 0, errs);
// a phone: the site's pages fold into Pages
const ph = await ctx.newPage();
await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await ph.goto(`${base}/map/#retro=1`, { waitUntil: "load" }); await ph.waitForFunction(() => window.__map && window.__map.M && window.__map.M(), { timeout: 60000 }); await sleep(2500);
const pn = await ph.evaluate(() => ({ vis: [...document.querySelectorAll(".rt-nav .rt-ni, .rt-pages a")].filter((e) => e.offsetParent).map((e) => e.textContent.trim()), w: document.querySelector(".rt-nav").scrollWidth <= document.querySelector(".rt-nav").clientWidth + 1 }));
check("phone: Home…Help and one Pages menu, all on one line", pn.vis.join("|") === "Home|Edit|View|Favorites|Help|Pages" && pn.w, pn);
await ph.click('.rt-nav [data-rt-menu="pages"]'); await sleep(300);
const pp = await ph.evaluate(() => [...document.querySelectorAll(".rt-drop [role=menuitem]")].map((b) => b.textContent.trim()));
check("phone: Pages carries every page", pp[0] === "Past cycles" && pp.some((t) => /Electoral map/.test(t)), pp);
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall ok");
await browser.close();
process.exit(fails.length ? 1 : 0);
