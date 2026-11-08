// Probe: /map/'s State and Seat type filters (one pair for every view and lens),
// the head (seats first, crossbench-only key), the steady city-names toggle, one
// full-screen button, the Retro switch and the phone's search atop the map
// usage: node .matilda/probe/map-filters.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";
const base = process.argv[2], pre = "";
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = [];
const check = (name, cond, detail) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); if (!cond) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(hash, width = 1440) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width < 500 ? 844 : 950, isMobile: width < 500, hasTouch: width < 500 });
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  await page.goto(`${base}/map/#${pre}${hash}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__map && window.__map.M && window.__map.M(), { timeout: 60000 });
  await sleep(2500);
  return page;
}
const st = (page) => page.evaluate(() => {
  const m = window.__map, S = m.S, r = document.querySelector("#stage").getBoundingClientRect(), lg = document.querySelector("#legend").getBoundingClientRect();
  return { f: { st: S.f.st, cls: S.f.cls }, sel: S.sel.level + (S.sel.st ? ":" + S.sel.st : ""), title: (document.querySelector("#story .st-head h2") || {}).textContent, meta: (document.querySelector("#story .st-head .rd-meta") || {}).textContent,
    stage: [Math.round(r.top), Math.round(r.height)], legendH: Math.round(lg.height), T: [+m.T.k.toFixed(4), +m.T.x.toFixed(1), +m.T.y.toFixed(1)],
    pressedSt: [...document.querySelectorAll("#state-filters [aria-pressed=true]")].map((b) => b.textContent), pressedCls: [...document.querySelectorAll("#type-filters [aria-pressed=true]")].map((b) => b.textContent) };
});

// 1. the city-names toggle moves nothing
// (a phone's toggle rides its Jump to menu: the tablet width keeps the chip row)
for (const [label, w] of [["desktop", 1440], ["tablet", 700]]) {
  const page = await open("", w);
  const a = await st(page);
  const shifts = await page.evaluate(async () => {
    const out = []; const ro = new ResizeObserver(() => out.push(document.querySelector("#stage").getBoundingClientRect().height)); ro.observe(document.querySelector("#legend")); ro.observe(document.querySelector("#stage"));
    await new Promise((r) => setTimeout(r, 300)); out.length = 0;
    const b = document.querySelector("[data-towns]"); const w0 = b.getBoundingClientRect().width;
    b.click(); await new Promise((r) => setTimeout(r, 600)); const w1 = document.querySelector("[data-towns]").getBoundingClientRect().width;
    document.querySelector("[data-towns]").click(); await new Promise((r) => setTimeout(r, 600));
    ro.disconnect(); return { resizes: out.length, w0, w1, txt: document.querySelector("[data-towns]").textContent };
  });
  const b = await st(page);
  check(`${label}: city names toggle keeps the stage still`, a.stage.join() === b.stage.join() && a.legendH === b.legendH && a.T.join() === b.T.join() && shifts.resizes === 0, { before: a.stage, after: b.stage, legend: [a.legendH, b.legendH], T: [a.T, b.T], ...shifts });
  check(`${label}: toggle box keeps its width`, Math.abs(shifts.w0 - shifts.w1) < 0.5, shifts);
  check(`${label}: no page errors`, page.errs.length === 0, page.errs);
  await page.close();
}

// 2. the filters: one pair, read alike everywhere
{
  const page = await open("");
  let s = await st(page);
  check("national: no filter pressed but All", s.pressedSt.join() === "All" && s.pressedCls.join() === "All", s);
  await page.click('#state-filters [data-state="NSW"]'); await sleep(1500);
  s = await st(page);
  check("NSW chip: the State filter and the selection are one", s.f.st === "NSW" && s.sel === "state:NSW" && /New South Wales/.test(s.title), s);
  await page.click('#type-filters [data-cls="Rural"]'); await sleep(1200);
  s = await st(page);
  check("Rural on NSW: both filters, head titled by the type, meta names the state", s.f.cls === "Rural" && s.f.st === "NSW" && /^Rural/.test(s.title) && /New South Wales/.test(s.meta), s);
  const nRural = await page.evaluate(() => { const m = window.__map.M(); return m.divs.filter((d) => d.st === "NSW" && d.cls === "Rural").length; });
  check("the head counts the intersection", new RegExp(`\\b${nRural}\\b`).test(s.meta), { nRural, meta: s.meta });
  // every lens keeps the filter and the same figures block
  for (const l of ["tpp", "fp", "informal", "seifa", "winner"]) {
    await page.evaluate((l) => window.__map.setLens(l), l); await sleep(900);
    const h = await page.evaluate(() => ({ title: document.querySelector("#story .st-head h2").textContent, labs: [...document.querySelectorAll("#story .st-stat > .st-lab")].map((e) => e.textContent.split(" (")[0]), find: !!document.querySelector("#story .st-find") }));
    check(`lens ${l}: same head (Seats, Two-party, Primaries) under the filter`, /^Rural/.test(h.title) && h.labs[0] === "Seats" && h.labs.includes("Two-party preferred") && h.labs.some((x) => /^Primaries/.test(x)), h);
  }
  // the chamber and the list read the same pair
  await page.evaluate(() => window.__map.setView("list")); await sleep(1200);
  const rows = await page.evaluate(() => ({ count: (document.querySelector(".ls-count") || {}).textContent, hasStateSel: !!document.querySelector('.ls-sel[data-fsel="st"]'), hasClsSel: !!document.querySelector('.ls-sel[data-fsel="cls"]'), rowsShown: document.querySelectorAll(".ls-row").length, filterRows: !!document.querySelector("#state-filters") && !!document.querySelector("#type-filters") }));
  check("list: filtered to the pair; no duplicate State/Seat type selects; filter rows shown", rows.count && rows.count.startsWith(String(nRural)) && !rows.hasStateSel && !rows.hasClsSel && rows.filterRows, rows);
  await page.evaluate(() => window.__map.setView("chamber")); await sleep(1500);
  const ch = await page.evaluate(() => ({ filterRows: !!document.querySelector("#state-filters") && !!document.querySelector("#type-filters"), pill: !document.querySelector("#filterpill").hidden }));
  check("chamber: filter rows shown, no duplicate pill", ch.filterRows && !ch.pill, ch);
  await page.evaluate(() => window.__map.setView("map")); await sleep(1200);
  // a seat outside the state lets the State filter go, keeps the type
  await page.evaluate(() => { const m = window.__map.M(); window.__map.goDiv(m.byName.get("Mallee")); }); await sleep(1500);
  s = await st(page);
  check("a Vic seat: State filter lets go, Seat type stays", s.f.st === null && s.f.cls === "Rural" && s.pressedSt.join() === "All", s);
  // the up link clears everything
  await page.evaluate(() => window.__map.goAus()); await sleep(1000);
  s = await st(page);
  check("goAus keeps the type (the head offers All seats)", s.f.cls === "Rural" && /^Rural/.test(s.title), s);
  await page.click("#story .st-up"); await sleep(1000);
  s = await st(page);
  check("All seats clears the type too", s.f.cls === null && s.f.st === null && /House today/.test(s.title), s);
  // a state frame drops both
  await page.click('#type-filters [data-cls="Inner Metropolitan"]').catch(() => {});
  await page.evaluate(() => { const b = document.querySelector('#type-filters [data-cls]:not([data-cls=""])'); b && b.click(); }); await sleep(800);
  await page.evaluate(() => window.__map.setYear("nsw23")); await sleep(5000);
  s = await st(page);
  check("a state election frame: no filters, no filter rows", s.f.st === null && s.f.cls === null && s.pressedSt.length === 0 && s.pressedCls.length === 0, s);
  check("no page errors", page.errs.length === 0, page.errs);
  await page.close();
}

// 3. seats first, crossbench-only key
{
  const page = await open("");
  const h = await page.evaluate(() => ({ labs: [...document.querySelectorAll("#story .st-stat > .st-lab")].map((e) => e.textContent), key: [...document.querySelectorAll("#story .st-seat-legend > *")].map((e) => e.textContent.trim()), brace: !!document.querySelector("#story .st-xb-brace") }));
  check("Seats lead the head", /^Seats/.test(h.labs[0]), h.labs);
  check("the seat key is the crossbench only, labelled so", /^Crossbench\s*15/.test(h.key[0]) && !h.key.some((k) => /^Labor|^Coalition/.test(k)) && h.brace, h.key);
  // a seat: its figures lead, the finding follows
  await page.evaluate(() => { const m = window.__map.M(); window.__map.goDiv(m.byName.get("Bradfield")); }); await sleep(1500);
  const sv = await page.evaluate(() => { const el = document.querySelector("#story"); const kids = [...el.children].map((c) => c.className || c.tagName); return { kids: kids.slice(0, 6), find: (el.querySelector(".st-find") || {}).textContent }; });
  check("seat view: figures before the finding", sv.kids.indexOf("st-sec") > -1 && sv.kids.indexOf("st-sec") < sv.kids.indexOf("st-find"), sv);
  await page.evaluate(() => window.__map.setLens("tpp")); await sleep(1000);
  check("seat view on the two-party lens renders (wn fix)", page.errs.length === 0, page.errs);
  await page.close();
}

// 4. one way into full screen; the retro switch round trip
{
  const page = await open("");
  const fsb = await page.evaluate(() => ({ zfs: !!document.querySelector("#zfs"), fsgo: !!document.querySelector("#fsgo") && getComputedStyle(document.querySelector("#fsgo")).display !== "none" }));
  check("one full-screen button (the eyebrow's)", !fsb.zfs && fsb.fsgo, fsb);
  await page.click("#retrogo"); await sleep(1500);
  const r = await page.evaluate(() => ({ on: document.documentElement.classList.contains("mp-retro"), hash: location.hash, banner: !!document.querySelector(".rt-banner") && getComputedStyle(document.querySelector(".rt-banner")).display !== "none", fake: !!document.querySelector(".rt-titlebar, .rt-menubar, .rt-address, .rt-taskbar, .rt-status"), saved: localStorage.getItem("auspol.map.retro") }));
  check("Retro: on, in the hash, saved, no pretend browser furniture", r.on && /retro=1/.test(r.hash) && r.banner && !r.fake && r.saved === "1", r);
  await page.evaluate(() => window.__map.setView("chamber")); await sleep(1200);
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".rt-tabs [data-rt-view]")].map((b) => b.dataset.rtView + ":" + b.getAttribute("aria-selected")));
  check("Retro tabs follow the view", tabs.includes("chamber:true") && tabs.includes("map:false"), tabs);
  await page.click(".rt-modern"); await sleep(1500);
  const o = await page.evaluate(() => ({ on: document.documentElement.classList.contains("mp-retro"), hash: location.hash, saved: localStorage.getItem("auspol.map.retro") }));
  check("Modern view: off, out of the hash, forgotten", !o.on && !/retro/.test(o.hash) && o.saved === null, o);
  check("no page errors", page.errs.length === 0, page.errs);
  await page.close();
}
// 5. the phone's search stands atop the map; its panel is a grid of four menus
{
  const page = await open("", 390);
  const g = await page.evaluate(() => ({ labs: [...document.querySelectorAll(".lg-cgrid > .lg-label")].map((e) => e.textContent), chips: !!document.querySelector("#state-filters, #type-filters, #cities, .mp-legend .lg-draw"), fj: getComputedStyle(document.querySelector(".mp-fj-menu")).display !== "none" }));
  check("phone: State, Seat type, Draw and Jump to as one grid of menus, no chip rows, the elections as a menu", g.labs.join("|") === "State|Seat type|Draw|Jump to" && !g.chips && g.fj, g);
  const p = await page.evaluate(() => { const s = document.querySelector(".mp-search"), st = document.querySelector("#stage"); return { above: s.getBoundingClientRect().bottom <= st.getBoundingClientRect().top + 1, inLegend: !!s.closest("#legend") }; });
  check("phone: search atop the map, out of the strip", p.above && !p.inLegend, p);
  await page.close();
  const d = await open("", 1440);
  const q = await d.evaluate(() => { const s = document.querySelector(".mp-search"); return { inToolbar: !!s.closest("#legend .lg-toolbar") }; });
  check("desktop: search in the strip's Base row", q.inToolbar, q);
  await d.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall ok");
await browser.close();
process.exit(fails.length ? 1 : 0);
