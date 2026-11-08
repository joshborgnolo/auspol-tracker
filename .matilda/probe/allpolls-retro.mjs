// Probe: the retro All polls page (/allpolls/retro/, .build/retro/allpolls.mjs) in a browser —
// its navbar menus (Edit, View, Favorites shared with the retro map, Help, More pages, the
// phone's Pages), the tabs, the pollster checklist, find, time, contest, the sort, a poll opened
// in its row, the CSV, the phone's columns, and the hop from the retro map's navbar and back.
// usage: node .matilda/probe/allpolls-retro.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";
const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = [];
const check = (name, cond, detail) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); if (!cond) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const go = async (hash = "") => { await page.goto(`${base}/allpolls/retro/${hash ? "#" + hash : ""}`, { waitUntil: "load" }); await sleep(400); };
const st = () => page.evaluate(() => ({ hash: location.hash, count: document.querySelector("#ap-count").textContent, rows: document.querySelectorAll("tr.ap-r").length,
  tab: document.documentElement.dataset.apM, houses: [...new Set([...document.querySelectorAll("tr.ap-r th.c-h")].map((t) => t.firstChild.textContent))],
  months: [...document.querySelectorAll("tr.ap-m th")].map((t) => t.textContent.trim()) }));
const open = async (k, sel = `.rt-nav [data-rt-menu="${k}"]`) => { await page.click(sel); await sleep(200); return page.evaluate(() => ({ hidden: document.querySelector(".rt-drop").hidden, items: [...document.querySelectorAll(".rt-drop [role^=menuitem]")].map((b) => (b.disabled ? "(off) " : "") + b.textContent.trim()), focus: document.activeElement && document.activeElement.textContent.trim() })); };
const item = async (text) => { await page.evaluate((t) => [...document.querySelectorAll(".rt-drop [role^=menuitem]")].find((b) => b.textContent.includes(t)).click(), text); await sleep(300); };

await go();
const nav = await page.evaluate(() => [...document.querySelectorAll(".rt-nav .rt-ni, .rt-pages a")].filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
check("the navbar: Home, Edit, View, Favorites, Help, then the site's pages", nav.slice(0, 5).join("|") === "Home|Edit|View|Favorites|Help" && nav.includes("All polls") && nav.includes("More pages"), nav);
check("All polls is this page, marked", await page.evaluate(() => { const a = document.querySelector('.rt-pages a[aria-current="page"]'); return a && a.getAttribute("href") === "/allpolls/retro/"; }));
let s = await st();
check("every poll, newest released first, in month bands", s.rows > 150 && s.count.endsWith(" polls") && /^\S+ 20\d\d/.test(s.months[0]) && /in today’s/.test(s.months[0]), s.months.slice(0, 2));
check("the default view rides no hash", s.hash === "", s.hash);
let m = await open("edit");
check("Edit: find, copy link, clear filters (off with none on)", !m.hidden && m.items[0].startsWith("Find a poll") && m.items.includes("(off) Clear filters") && m.focus.startsWith("Find a poll"), m);
await page.keyboard.press("ArrowRight"); await sleep(200);
m = await page.evaluate(() => ({ label: document.querySelector(".rt-drop").getAttribute("aria-label"), items: [...document.querySelectorAll(".rt-drop [role^=menuitem]")].map((b) => (b.disabled ? "(off) " : "") + b.textContent.trim()) }));
check("the arrows walk the bar to View: the tabs, the contests, the order, the way back", m.label === "View" && m.items[0] === "●Two-party preferred" && m.items.includes("Modern view") && m.items.some((t) => t.includes("Labor v One Nation")), m);
await page.keyboard.press("Escape"); await sleep(150);
check("Escape closes the menu, focus back on its button", await page.evaluate(() => document.querySelector(".rt-drop").hidden && document.activeElement.dataset.rtMenu === "view"));
// the tabs
for (const [tab, want] of [["pri", /ALP|ON|L\/NP/], ["ld", /Better PM/], ["tpp", /Implied/]]) {
  await page.click(`[data-ap-tab="${tab}"]`); await sleep(200);
  const t = await page.evaluate(() => ({ head: document.querySelector("#ap-head").textContent, sel: document.querySelector('.rt-tabs [aria-selected="true"]').dataset.apTab, cap: document.querySelector("#ap-cap").textContent, contest: !document.querySelector(".ap-cwrap").hidden }));
  check(`the ${tab} tab draws its columns`, want.test(t.head) && t.sel === tab && t.contest === (tab === "tpp"), t);
}
// the pollster checklist stays open while it's ticked
m = await open("houses", "#ap-hbtn");
check("the pollster checklist: all, then each house with its count", m.items[0] === "●All pollsters" && m.items.length > 8 && /\d$/.test(m.items[2]), m.items.slice(0, 4));
await item("Resolve"); await item("Newspoll");
s = await st();
check("ticking keeps the list open and filters to the ticked houses", !(await page.evaluate(() => document.querySelector(".rt-drop").hidden)) && s.houses.every((h) => /^(Resolve|Newspoll)/.test(h)) && /h=Resolve,Newspoll/.test(s.hash) && /of \d+ polls/.test(s.count), { houses: s.houses, hash: s.hash });
check("the button names the pick", await page.evaluate(() => document.querySelector("#ap-hbtn").textContent.trim() === "2 pollsters"));
await page.keyboard.press("Escape"); await sleep(150);
// find, then Clear filters
await page.click("#ap-q"); await page.keyboard.type("oct"); await sleep(250);
s = await st();
check("find narrows the list and rides the link", s.rows > 0 && /q=oct/.test(s.hash), s);
m = await open("edit");
check("Clear filters is on with a filter on", m.items.includes("Clear filters"), m.items);
await item("Clear filters");
s = await st();
check("Clear filters clears the houses, the time and the find box", s.hash === "" && s.rows > 150 && (await page.evaluate(() => document.querySelector("#ap-q").value === "")), s.hash);
// "/" finds
await page.click(".ap-cap"); await page.keyboard.press("/"); await sleep(100);
check("/ goes to the find box", await page.evaluate(() => document.activeElement.id === "ap-q"));
await page.keyboard.press("Escape");
// time and contest
await page.select("#ap-t", "3"); await sleep(200); s = await st();
check("the time picker narrows to the last 3 months", /t=3/.test(s.hash) && /of \d+ polls/.test(s.count), s.count);
await page.select("#ap-t", "all"); await page.select("#ap-c", "on"); await sleep(200);
check("the contest picker swaps the two-party columns to Labor v One Nation", await page.evaluate(() => /Labor v One Nation/.test(document.querySelector("#ap-head").textContent) && /c=on|^$/.test(location.hash.replace("#", ""))));
await page.select("#ap-c", "lnp"); await sleep(150);
// the sort
await page.click('[data-sort="lean"]'); await sleep(200); s = await st();
const leans = await page.evaluate(() => [...document.querySelectorAll("tr.ap-r td.c-l:nth-last-child(2)")].map((td) => td.textContent.trim()).slice(0, 6));
check("a column head sorts, largest first, and the month bands step aside", /s=lean\.d/.test(s.hash) && s.months.length === 0, { hash: s.hash, leans });
check("the head shows the sort", await page.evaluate(() => document.querySelector('[data-sort="lean"] .ap-sd').textContent === "▼"));
await page.click('[data-sort="lean"]'); await sleep(150);
check("a second press turns it round", await page.evaluate(() => /s=lean\.a/.test(location.hash)));
await page.click('[data-sort="pub"]'); await sleep(150);
check("Released goes back to the newest first, the page as it opens", await page.evaluate(() => location.hash === "" && document.querySelectorAll("tr.ap-m").length > 0));
// a poll opened in its row, by click and by keyboard
await page.click("tr.ap-r td.c-n"); await sleep(200);
let det = await page.evaluate(() => { const d = document.querySelector(".ap-det"); return d ? d.innerText : null; });
check("a click opens the poll: its figures and sources", det && /First preferences/.test(det) && /Two-party, implied/.test(det) && /Sources/.test(det), det && det.slice(0, 120));
await page.keyboard.press("Enter"); await sleep(200);
check("Enter shuts it again", await page.evaluate(() => !document.querySelector(".ap-det")));
await page.keyboard.press("ArrowDown"); await sleep(100);
check("the arrows walk the polls", await page.evaluate(() => document.activeElement.matches("tr.ap-r") && document.activeElement !== document.querySelector("tr.ap-r")));
// the CSV
const csv = await page.evaluate(async () => {
  let got = null;
  const orig = URL.createObjectURL;
  URL.createObjectURL = (b) => { got = b; return orig.call(URL, b); };
  document.querySelector('[data-ap="csv"]').click();
  URL.createObjectURL = orig;
  return got ? (await got.text()).split("\r\n").length : 0;
});
check("Save as CSV writes the polls in view", csv > 150, csv);
// Favorites: the retro map's list, this page's entries carrying their page
await page.evaluate(() => localStorage.setItem("auspol.map.favs", JSON.stringify([{ t: "Farrer · 2025", h: "y=2025&seat=farrer" }])));
await page.click('[data-ap-tab="pri"]'); await sleep(150);
m = await open("fav");
check("Favorites lists the retro map's saved views too", m.items.includes("Farrer · 2025"), m.items);
await item("Add this view");
const favs = await page.evaluate(() => JSON.parse(localStorage.getItem("auspol.map.favs")));
check("adding saves this view with its page", favs[0].p === "/allpolls/retro/" && favs[0].h === "m=pri" && /^All polls · Primary vote/.test(favs[0].t), favs[0]);
await page.click('[data-ap-tab="tpp"]'); await sleep(150);
m = await open("fav"); await item("All polls · Primary vote");
check("a favourite reopens its view", (await st()).tab === "pri");
m = await open("help");
check("Help: about these polls, how the tracker works, feedback", m.items.join("|") === "About these polls|How the tracker works|Send feedback…", m.items);
await page.keyboard.press("Escape");
m = await open("more");
check("More pages: the rest of the site, the Electoral map in its retro view", await page.evaluate(() => [...document.querySelectorAll(".rt-drop a")].some((a) => a.textContent.includes("Electoral map") && a.getAttribute("href") === "/map/#retro=1")), m.items);
await page.keyboard.press("Escape");
check("no page errors", errs.length === 0, errs);

// a phone: one Pages menu, the figures start on the screen, nothing overflows
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await go();
const ph = await page.evaluate(() => {
  const vis = [...document.querySelectorAll(".rt-nav .rt-ni, .rt-pages a")].filter((e) => e.offsetParent).map((e) => e.textContent.trim());
  const imp = [...document.querySelectorAll("#ap-head th")].find((t) => /Implied/.test(t.textContent));
  const well = document.querySelector(".ap-well").getBoundingClientRect();
  return { vis, overflow: document.documentElement.scrollWidth - innerWidth, impRight: imp ? imp.getBoundingClientRect().right : null, wellRight: well.right, tabs: [...document.querySelectorAll(".rt-tabs button")].map((b) => b.innerText.trim()) };
});
check("phone: Home…Help and one Pages menu", ph.vis.join("|") === "Home|Edit|View|Favorites|Help|Pages", ph.vis);
check("phone: the page doesn't overflow", ph.overflow <= 0, ph.overflow);
check("phone: the implied figure is on the screen", ph.impRight != null && ph.impRight <= ph.wellRight + 1, ph);
check("phone: the tabs keep short names", ph.tabs.slice(0, 3).join("|") === "2PP|Primary|Leaders", ph.tabs);

// the hop from the retro map's navbar, and back
await page.setViewport({ width: 1440, height: 950 });
await page.goto(`${base}/map/#retro=1`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector('.rt-pages a[href="/allpolls/retro/"]'), { timeout: 60000 });
check("the retro map's navbar opens this page for All polls", true);
await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('.rt-pages a[href="/allpolls/retro/"]')]);
check("…and lands here", new URL(page.url()).pathname === "/allpolls/retro/", page.url());

await browser.close();
console.log(fails.length ? `\n${fails.length} failed` : "\nall ok");
process.exit(fails.length ? 1 : 0);
