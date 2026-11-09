// Probe: the retro Now and Past cycles pages (/retro/, /cycles/retro/: .build/retro/now.mjs,
// cycles.mjs, pages.client.js) in a browser — the navbar (Home is /retro/, the site's pages
// open their retro twins), the view tabs and their hash, each panel's controls (the contest,
// who votes by group and party, the latest polls' tabs), Past cycles' Compare with / Measure
// toolbar and the final polls' basis, a pasted link opening its view, Favorites shared with the
// retro map, Modern view, charts redrawn to their frames, phones without sideways scroll, and
// the hops from the retro map's and the retro All polls page's navbars.
// usage: node .matilda/probe/retro-pages.mjs <baseUrl>  (serve the repo root first)
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
const go = async (p, hash = "") => { await page.goto(`${base}${p}${hash ? "#" + hash : ""}`, { waitUntil: "load" }); await sleep(350); };
const hed = (id) => page.evaluate((id) => { const h = document.querySelector(`#${id} .rp-hed`); return h ? h.textContent.trim() : null; }, id);
const visible = () => page.evaluate(() => [...document.querySelectorAll(".rp-view .rp-panel")].filter((p) => p.offsetParent).map((p) => p.id));
const menu = async (k) => { await page.click(`.rt-nav [data-rt-menu="${k}"]`); await sleep(150); return page.evaluate(() => ({ hidden: document.querySelector(".rt-drop").hidden, items: [...document.querySelectorAll(".rt-drop [role^=menuitem]")].map((b) => (b.disabled ? "(off) " : "") + b.textContent.trim()) })); };
const pick = async (text) => { await page.evaluate((t) => [...document.querySelectorAll(".rt-drop [role^=menuitem]")].find((b) => b.textContent.includes(t)).click(), text); await sleep(250); };

/* ---------------------------------------------------------------- Now */
await go("/retro/");
const nav = await page.evaluate(() => [...document.querySelectorAll(".rt-nav .rt-ni, .rt-pages a")].filter((e) => e.offsetParent).map((e) => [e.textContent.trim(), e.getAttribute("href")]));
check("the navbar: Home (this page), Edit, View, Favorites, Help", nav.slice(0, 5).map((x) => x[0]).join("|") === "Home|Edit|View|Favorites|Help" && nav[0][1] === "/retro/", nav.slice(0, 5));
check("the site's pages open their retro twins", nav.some(([t, h]) => t === "Past cycles" && h === "/cycles/retro/") && nav.some(([t, h]) => t === "All polls" && h === "/allpolls/retro/"), nav.slice(5));
check("Home is marked as the page", await page.evaluate(() => document.querySelector('.rt-nav a[href="/retro/"]').getAttribute("aria-current") === "page"));
check("opens on Voting intention: the two-party, primary vote and decidedness panels", JSON.stringify(await visible()) === JSON.stringify(["tpp", "primary", "decided"]), await visible());
check("no hash on the page as it opens", await page.evaluate(() => location.hash === ""));
const tpp0 = await page.evaluate(() => [...document.querySelectorAll("#tpp .rp-tside b")].map((b) => b.textContent));
check("the hero's pair, as the modern page prints it", tpp0.length === 2 && tpp0.every((v) => /^\d\d\.\d$/.test(v)), tpp0);
// the contest
await page.select('#tpp select[data-ctl="c"]', await page.evaluate(() => [...document.querySelectorAll('#tpp select[data-ctl="c"] option')][1].value));
await sleep(250);
const tpp1 = await page.evaluate(() => ({ pair: [...document.querySelectorAll("#tpp .rp-tside i")].map((b) => b.textContent), hash: location.hash }));
check("the contest switch draws the other contest", /One Nation|Coalition/.test(tpp1.pair[1]) && tpp1.pair[1] !== "" && /tpp=/.test(tpp1.hash), tpp1);
// the views
for (const [v, want] of [["polls", ["polls"]], ["leaders", ["leaders"]], ["voters", ["who", "switching"]], ["mood", ["mood", "issues", "sentiment"]], ["vote", ["tpp", "primary", "decided"]]]) {
  await page.click(`.rt-tabs [data-rp-tab="${v}"]`); await sleep(200);
  const s = await page.evaluate(() => ({ hash: location.hash, sel: document.querySelector('.rt-tabs [aria-selected="true"]').dataset.rpTab }));
  check(`the ${v} tab shows its panels`, JSON.stringify(await visible()) === JSON.stringify(want) && s.sel === v && (v === "vote" ? !/v=/.test(s.hash) : s.hash.includes("v=" + v)), { panels: await visible(), ...s });
}
// who votes: a party, then a group
await page.click('.rt-tabs [data-rp-tab="voters"]'); await sleep(150);
const w0 = await hed("who");
await page.select('#who select[data-ctl="p"]', "labor"); await sleep(250);
const w1 = await hed("who");
await page.click('#who .rp-ptabs [data-v="education"]'); await sleep(250);
const w2 = await page.evaluate(() => ({ hed: document.querySelector("#who .rp-hed").textContent, sets: [...document.querySelectorAll("#who .rp-wvset legend")].map((l) => l.firstChild.textContent.trim()), hash: location.hash }));
check("who votes: each party its own headline", w0 !== w1 && /^Labor/.test(w1), [w0, w1]);
check("who votes: the group tab draws that group", w2.sets.some((s) => /education/i.test(s)) && /who=education\.labor/.test(w2.hash), w2);
// the latest polls' tabs: the contest only on the two-party tab
await page.click('.rt-tabs [data-rp-tab="polls"]'); await sleep(150);
await page.click('#polls .rp-ptabs [data-v="primary"]'); await sleep(250);
const pl = await page.evaluate(() => ({ head: document.querySelector("#polls thead").textContent, dis: document.querySelector('#polls select[data-ctl="c"]').disabled, rows: document.querySelectorAll("#polls tbody tr").length }));
check("latest polls: the primary tab, its contest switch off", pl.dis && pl.rows >= 6, pl);
// a pasted link opens its view, drawn
await go("/retro/", "v=voters&who=place.greens");
const pasted = await page.evaluate(() => ({ view: document.documentElement.dataset.rpView, hed: document.querySelector("#who .rp-hed").textContent, tab: document.querySelector('#who .rp-ptabs [aria-selected="true"]').dataset.v, party: document.querySelector('#who select[data-ctl="p"]').value }));
check("a pasted link opens its view and panel state", pasted.view === "voters" && /^Greens/.test(pasted.hed) && pasted.tab === "place" && pasted.party === "greens", pasted);
// menus
let m = await menu("view");
check("View: the views, then Modern view", m.items[0].includes("Voting intention") && m.items.some((t) => t.includes("Modern view")), m.items);
await page.keyboard.press("Escape"); await sleep(100);
m = await menu("edit");
check("Edit: copy the link, reset the view (on when the view is changed)", m.items[0].includes("Copy link") && m.items.some((t) => t === "Reset this view"), m.items);
await pick("Reset this view");
check("Reset this view clears the panel state, keeping the view", await page.evaluate(() => location.hash === "#v=voters" && document.querySelector('#who select[data-ctl="p"]').value === "one-nation"), await page.evaluate(() => location.hash));
// Favorites: shared with the retro map, this page's entries carrying their page
await page.evaluate(() => localStorage.setItem("auspol.map.favs", JSON.stringify([{ t: "A map view", h: "lens=winner" }])));
m = await menu("fav");
check("Favorites lists the retro map's saved views", m.items.some((t) => t.includes("A map view")), m.items);
await pick("Add this view to Favorites");
const favs = await page.evaluate(() => JSON.parse(localStorage.getItem("auspol.map.favs")));
check("a favourite saved here carries its page", favs[0].p === "/retro/" && favs[0].h === "v=voters" && /Now · Voters/.test(favs[0].t), favs[0]);
// charts fit their frames, on a phone too
await page.setViewport({ width: 375, height: 800 }); await sleep(450);
await go("/retro/");
const fit = await page.evaluate(() => [...document.querySelectorAll("figure[data-chart]")].filter((f) => f.offsetParent).map((f) => { const w = f.querySelector(".rp-cwell"); const s = w.querySelector("svg"); return [Math.round(w.clientWidth - 12), +s.getAttribute("width")]; }));
check("on a phone each chart is drawn at its frame's width", fit.length > 0 && fit.every(([a, b]) => Math.abs(a - b) <= 3), fit);
for (const v of ["vote", "polls", "leaders", "voters", "mood"]) {
  await page.click(`.rt-tabs [data-rp-tab="${v}"]`); await sleep(250);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(`phone, ${v}: nothing pushes the page sideways`, o.sw <= o.iw, o);
}
const ph = await page.evaluate(() => ({ pagesBtn: !!document.querySelector(".rt-pagesb").offsetParent, short: [...document.querySelectorAll(".rt-tabs .rp-ts")].filter((s) => s.offsetParent).map((s) => s.textContent) }));
check("phone: the site's pages fold into one menu, the views keep short names", ph.pagesBtn && ph.short.length === 5, ph);
await page.setViewport({ width: 1440, height: 950 });

/* ---------------------------------------------------------------- Past cycles */
await go("/cycles/retro/");
check("Past cycles is marked in the navbar", await page.evaluate(() => document.querySelector('.rt-pages a[href="/cycles/retro/"]').getAttribute("aria-current") === "page"));
check("opens on All measures with the toolbar", JSON.stringify(await visible()) === JSON.stringify(["measures"]) && await page.evaluate(() => !document.querySelector(".rp-tool").hidden));
const c0 = await hed("measures");
await page.click('.rp-tool input[value="change-since-election"]'); await sleep(250);
const c1 = await hed("measures");
check("Measure re-words the finding, as the modern page does", c0 !== c1, [c0, c1]);
await page.click('.rt-tabs [data-rp-tab="leaders"]'); await sleep(200);
const l0 = await hed("leaders");
await page.select('.rp-tool select[data-ctl="cmp"]', "ousted"); await sleep(250);
const l1 = await page.evaluate(() => ({ hed: document.querySelector("#leaders .rp-hed").textContent, hash: location.hash }));
check("Compare with rescopes the leadership finding", l0 !== l1.hed && /ousted/.test(l1.hed) && /cmp=ousted/.test(l1.hash) && /mode=change-since-election/.test(l1.hash), [l0, l1]);
await page.click('.rt-tabs [data-rp-tab="final"]'); await sleep(200);
check("the final polls hide the toolbar (it doesn't rescope them)", await page.evaluate(() => document.querySelector(".rp-tool").hidden));
const f0 = await hed("final");
await page.evaluate(() => [...document.querySelectorAll("#final .rp-radios input")][1].click()); await sleep(250);
const f1 = await hed("final");
check("the final polls' second basis re-words the finding", f0 !== f1, [f0, f1]);
m = await menu("view");
check("View lists the views and the toolbar's choices", m.items.some((t) => t.startsWith("●Final polls")) && m.items.some((t) => t.includes("Compare with: Ousted")), m.items);
await pick("Modern view");
await sleep(400);
check("Modern view goes to the modern Past cycles page and forgets the look", page.url().endsWith("/cycles/") && (await page.evaluate(() => localStorage.getItem("auspol.map.retro"))) === null, page.url());

/* ---------------------------------------------------------------- the hops in */
await go("/allpolls/retro/");
const apNav = await page.evaluate(() => ({ home: document.querySelector(".rt-nav a.rt-ni").getAttribute("href"), cyc: (document.querySelector('.rt-pages a[href^="/cycles/"]') || {}).getAttribute?.call(document.querySelector('.rt-pages a[href^="/cycles/"]'), "href") }));
check("the retro All polls page's Home and Past cycles open the twins", apNav.home === "/retro/" && apNav.cyc === "/cycles/retro/", apNav);
await go("/map/", "retro=1");
await sleep(1200);
const mapNav = await page.evaluate(() => ({ home: (document.querySelector(".rt-nav a.rt-ni") || {}).getAttribute?.call(document.querySelector(".rt-nav a.rt-ni"), "href"), pages: [...document.querySelectorAll(".rt-pages a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]) }));
check("the retro map's Home opens /retro/, Past cycles /cycles/retro/, and Now isn't listed twice", mapNav.home === "/retro/" && mapNav.pages.some(([t, h]) => t === "Past cycles" && h === "/cycles/retro/") && !mapNav.pages.some(([t, h]) => h === "/retro/"), mapNav);

check("no page errors", errs.length === 0, errs);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
