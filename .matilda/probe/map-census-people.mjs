// Probe: the census "People" lanes (lang/a65/a2034/fborn/uni/blue + loinc/hiinc) on the LOCAL map build.
// usage: node .matilda/probe/map-census-people.mjs <baseUrl>   (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
console.log("probe build: 90s-arc-v2");
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log(`PAGEERROR: ${e.message} :: ${(e.stack || "").split("\n").slice(1, 3).join(" <- ")}`));
page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE:", msg.text().slice(0, 200)); });
await page.setCacheEnabled(false);
await page.setViewport({ width: 1200, height: 900 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };
const mark = (s) => console.log(`… ${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. People optgroup carries the full sixteen-lane set plus the three
// select lenses (the 2026-10-31 arc: public transport to work,
// non-citizens, more than two children, homeless, and the Ancestry
// select-with-twelve menu)
await page.goto(`${base}/map/`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
mark("boot ok");
const opts = await page.evaluate(() => {
  const m = window.__map;
  m.setLens("seifa");
  return new Promise((r) => setTimeout(() => {
    const sel = document.querySelector('select[data-opt="index"]');
    r(sel ? [...sel.querySelectorAll("optgroup")].map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.textContent)]) : null);
  }, 400));
});
const people = opts && opts.find((g) => g[0] === "People");
ok("legend People optgroup exists", !!people, JSON.stringify(opts && opts.map((g) => g[0])));
if (people) {
  // the 2026-10-31 Household-income lens folds the loinc/hiinc menu pair
  // into one entry (-1), the median spectrum landing inside its picker
  ok("People has 18 options (15 measures + Religion + Housing tenure + Ancestry)", people[1].length === 18, people[1].join(" | "));
  ok("Born overseas listed", people[1].some((t) => /born overseas/i.test(t)));
  ok("University educated listed", people[1].some((t) => /university/i.test(t)));
  ok("Blue-collar listed", people[1].some((t) => /blue-collar/i.test(t)));
  ok("Household income listed once", people[1].filter((t) => /household income/i.test(t)).length === 1, people[1].join(" | "));
  ok("Household income sits where lower income sat (after Blue-collar)", /Blue-collar workers \| Household income/.test(people[1].join(" | ")), people[1].join(" | "));
  ok("Year 12 or less listed", people[1].some((t) => /year 12 or less/i.test(t)));
  ok("Indigenous Australians listed", people[1].some((t) => /indigenous/i.test(t)));
  ok("Children under 15 listed", people[1].some((t) => /children under 15/i.test(t)));
  ok("One-parent families listed", people[1].some((t) => /one-parent/i.test(t)));
  ok("Public transport to work listed", people[1].some((t) => /public transport to work/i.test(t)));
  ok("Non-citizens listed", people[1].some((t) => /non-citizens/i.test(t)));
  ok("More than two children listed", people[1].some((t) => /more than two children/i.test(t)));
  ok("Homeless listed", people[1].some((t) => /homeless/i.test(t)));
  ok("Housing tenure listed before Ancestry", people[1][people[1].length - 2] === "Housing tenure", people[1].join(" | "));
  ok("Ancestry listed last", people[1][people[1].length - 1] === "Ancestry", people[1].join(" | "));
}

mark("section 1 done");
// 2. #l=seifa&i=fborn deep link selects the lane and colours the map on 'now'
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=fborn`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const fbornState = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  const sel = document.querySelector('select[data-opt="index"]');
  return { index: sel && sel.value, basis: m.Y.now.demoBasis, note: (document.querySelector(".lg-note") || {}).textContent || "" };
});
ok("#i=fborn selects fborn", fbornState.index === "fborn", JSON.stringify(fbornState));
ok("now basis is voter", fbornState.basis === "voter");
ok("now legend cites 2021 census / voters", /2021 census/.test(fbornState.note), fbornState.note.slice(0, 120));

mark("section 2 done");
// 2b. #i=loinc deep link selects lower-income on 'now'; legend note names the cut in 2021 dollars
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=loinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const loNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return {
    sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    incv: (document.querySelector('select[data-opt="incv"]') || {}).value,
    incvOpts: [...document.querySelectorAll('select[data-opt="incv"] option')].map((o) => o.textContent),
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo,
    hash: location.hash,
  };
});
ok("#i=loinc aliases onto the Household-income lane", loNow.sel === "inc", loNow.sel);
ok("alias picks the lower-income share view", loNow.incv === "lo", JSON.stringify(loNow.incvOpts));
ok("alias rewrites the hash i=inc&iv=lo", /i=inc/.test(loNow.hash) && /iv=lo/.test(loNow.hash), loNow.hash);
ok("now loinc legend names the cut in 2021 dollars", /Share of adults in households earning under \$1,079 a week \(2021 dollars\)/.test(loNow.note), loNow.note.slice(0, 160));
// legend prints "The line marks Australia: 24.5%." — deriveAreas persons-
// weights the division shares; assert the app pool matches that render
ok("now AUS loinc ≈ 24.5% (app persons-weighted pool)", loNow.aus && Math.abs(loNow.aus.loinc - 24.47) < 0.2, JSON.stringify(loNow.aus));

mark("section 2b done");
// 2c. #i=hiinc on 2016: legend names $4,000-or-more in 2021 dollars
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2016&l=seifa&i=hiinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const hi2016 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2016].ready;
  await new Promise((r) => setTimeout(r, 500));
  return {
    sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    incv: (document.querySelector('select[data-opt="incv"]') || {}).value,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
  };
});
ok("#i=hiinc aliases onto the lens", hi2016.sel === "inc" && hi2016.incv === "hi", `${hi2016.sel}/${hi2016.incv}`);
ok("2016 hiinc legend names $4,000 or more (census-year dollars)", /earning \$4,000 or more a week \(census-year dollars\)/.test(hi2016.note), hi2016.note.slice(0, 160));

mark("section 2c done");
// 3. 2013 renders venue-proxy lanes with 2011-census copy, division story and booth facts
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2013&l=seifa&i=fborn`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const y2013 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2013].ready;
  await new Promise((r) => setTimeout(r, 500));
  const note = (document.querySelector(".lg-note") || {}).textContent || "";
  const i = m.Y[2013].byName.get("Watson");
  m.select({ level: "div", st: m.Y[2013].divs[i].st, div: i });
  await new Promise((r) => setTimeout(r, 600));
  const story = document.querySelector("#story") || document.body;
  return { basis: m.Y[2013].demoBasis, note, story: story.innerText, watson: m.Y[2013].divs[i].demo };
});
ok("2013 basis is venue", y2013.basis === "venue");
ok("2013 legend cites the 2011 census areas", /2011 and 2016 censuses/.test(y2013.note), y2013.note.slice(0, 140));
ok("2013 Watson fborn ≈ 52%", y2013.watson && Math.abs(y2013.watson.fborn - 0.5232) < 0.01, JSON.stringify(y2013.watson));
ok("2013 Watson loinc ≈ 31%", y2013.watson && Math.abs(y2013.watson.loinc - 0.31) < 0.005, JSON.stringify(y2013.watson));
ok("2013 division story carries venue copy", /2011 census|census areas the polling places stand in/.test(y2013.story), y2013.story.slice(0, 220));
ok("2013 division facts dl has Origin row", /Origin/.test(y2013.story) && /born overseas/.test(y2013.story), y2013.story.slice(0, 600));
ok("2013 division facts dl has Education row", /Education/.test(y2013.story) && /university/.test(y2013.story));
ok("2013 division facts dl has an Income row", /Income/.test(y2013.story) && /households earning/.test(y2013.story));
ok("2013 Income row gives the household median (Watson $1,046)", /median weekly household income (of |is )\$1,046/.test(y2013.story));

mark("section 3 done");
// 3b. 2013 + loinc: venue cut shown in 2011 dollars, seat facts Income row carries the median
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2013&l=seifa&i=loinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const lo2013 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2013].ready;
  await new Promise((r) => setTimeout(r, 500));
  const note = (document.querySelector(".lg-note") || {}).textContent || "";
  const i = m.Y[2013].byName.get("Watson");
  m.select({ level: "div", st: m.Y[2013].divs[i].st, div: i });
  await new Promise((r) => setTimeout(r, 600));
  const story = document.querySelector("#story") || document.body;
  return { note, story: story.innerText };
});
ok("2013 loinc legend names the epoch-span cut", /Share of adults in households earning under \$738–\$896 a week \(census-year dollars\)/.test(lo2013.note), lo2013.note.slice(0, 160));
ok("2013 loinc hed uses the adults wording", /of Watson’s adults live in households earning under \$738–\$896 a week in census-year dollars/.test(lo2013.story), lo2013.story.slice(0, 300));
ok("no story renders 'undefined' (loinc)", !/undefined/.test(lo2013.story));

mark("section 3b done");
// 4. the '90s arc floor moved to 1993: 1996 sits INSIDE the People
// floor now, interpolated 1991↔1996 to election day
const y1996 = await page.evaluate(async () => {
  const m = window.__map;
  const sel = document.querySelector('select[data-opt="index"]');
  sel.value = "fborn"; // the income floor keeps showing its own copy under loinc
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  m.setYear(1996);
  await m.Y[1996].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("1996 legend interpolates 1991↔1996 (the '90s arc floor)",
  /1991 and 1996/.test(y1996) && /23\.4%/.test(y1996),
  y1996.slice(0, 160));

// 4b. 2010 sits inside the lifted income floor: venue lanes on the
// interp blend, the income pair IS in the optgroup
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2010&l=seifa&i=fborn`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const y2010 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2010].ready;
  await new Promise((r) => setTimeout(r, 500));
  const sel = document.querySelector('select[data-opt="index"]');
  const people = sel && [...sel.querySelectorAll("optgroup")].find((g) => g.label === "People");
  return {
    basis: m.Y[2010].demoBasis,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    people: people ? [...people.querySelectorAll("option")].map((o) => o.value) : null,
  };
});
ok("2010 basis is venue", y2010.basis === "venue", y2010.basis);
ok("2010 legend cites the 2006 census", /2006 and 2011 censuses/.test(y2010.note), y2010.note.slice(0, 140));
ok("2010 People optgroup carries the income lens (17: one Household-income entry, no homeless lane yet, and Ancestry joined)",
  y2010.people && y2010.people.length === 17 && y2010.people.includes("inc") && y2010.people.includes("anc") && !y2010.people.includes("loinc") && !y2010.people.includes("hl"),
  JSON.stringify(y2010.people));

// 4c. an income deep link on 2010 shows the interp income copy: the
// two bracketing editions' cuts span-named in census-year dollars
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2010&l=seifa&i=loinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const lo2010 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2010].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("2010 income lane shows the interp income copy (2010 between the 2006 and 2011 censuses)",
  /earning under \$604–\$738 a week \(census-year dollars\)/.test(lo2010), lo2010.slice(0, 190));

// 4d. the lifted floor's own ends: 2001's single 2001-census cuts and 2004's 2001/2006 span
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2001&l=seifa&i=loinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const lo2001 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2001].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("2001 income lane shows the single-edition 2001 cut",
  /earning under \$456 a week \(2001 dollars\)/.test(lo2001), lo2001.slice(0, 190));
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2004&l=seifa&i=hiinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const hi2004 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2004].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("2004 income lane shows the nearest-side $3,000 edge",
  /earning \$3,000 or more a week \(census-year dollars\)/.test(hi2004), hi2004.slice(0, 190));

mark("section 4 done");
// 5. booth story on 2013 carries venue 'who' phrasing and an Income row WITHOUT a median
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2013&l=seifa&i=fborn`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const booth = await page.evaluate(async () => {
  const m = window.__map;
  m.setYear(2013);
  const Y = m.Y[2013];
  await Y.ready;
  const j = Y.booth.name.findIndex((n, jj) => Y.booth.raw.demo && Y.booth.raw.demo[jj] && Y.booth.raw.demo[jj][5] != null && Y.booth.ty[jj] === 1);
  m.goBooth(j, { fly: false });
  await new Promise((r) => setTimeout(r, 600));
  const story = (document.querySelector("#story") || document.body).innerText;
  return { name: Y.booth.name[j], story };
});
ok("2013 booth story uses 'census area it stands in'", /census area it stands in/.test(booth.story), `${booth.name}: ${booth.story.slice(0, 200)}`);
ok("2013 booth facts show Origin and Education", /Origin/.test(booth.story) && /Education/.test(booth.story));
ok("2013 booth facts show an Income row", /Income/.test(booth.story) && /households earning/.test(booth.story));
ok("booth Income row HAS a median (2026-10-31: the medinc booth lane lands on every income year)",
  /median weekly household income is \$1,0|median weekly household income is \$\d/.test(booth.story), booth.story.match(/Income[\s\S]{0,220}/)?.[0]);
ok("no story renders 'undefined'", !/undefined/.test(y2013.story) && !/undefined/.test(booth.story));

mark("section 5 done");
// 5m. the Household-income lens's median view (2026-10-31): the landing
// measure on the merged lane — a $ spectrum, ticks and the national line
// in dollars, census-year-dollar epochs, per-view hash, the share views
// one picker away
mark("median view");
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2025&l=seifa&i=inc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const med25 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2025].ready;
  await new Promise((r) => setTimeout(r, 600));
  return {
    sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    incv: (document.querySelector('select[data-opt="incv"]') || {}).value,
    incvOpts: [...document.querySelectorAll('select[data-opt="incv"] option')].map((o) => o.textContent),
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    ticks: [...document.querySelectorAll(".lg-ticks span")].map((s) => s.textContent).join("|"),
    hash: location.hash,
    S: { index: m.S.index, incMode: m.S.incMode },
  };
});
ok("#i=inc selects the Household-income lane", med25.sel === "inc" && med25.S.index === "inc", JSON.stringify(med25.S));
ok("the median is the landing measure", med25.incv === "med" && med25.S.incMode === "med", med25.incv);
ok("the picker offers median then the two share views", med25.incvOpts.length === 3 && /median household income/i.test(med25.incvOpts[0]) && /lower-income household/i.test(med25.incvOpts[1]) && /high-income household/i.test(med25.incvOpts[2]), med25.incvOpts.join(" | "));
ok("the default med view leaves iv out of the hash", !/[?&]iv=/.test(med25.hash), med25.hash);
ok("2025 median legend note names the epoch", /Median weekly household income \(2021 dollars\)/.test(med25.note), med25.note.slice(0, 160));
ok("2025 median legend ticks price in dollars", /\$\d,\d/.test(med25.ticks), med25.ticks);
ok("2025 median legend marks the national line", /The line marks Australia: \$1,801/.test(med25.note), med25.note.slice(-140));

await page.goto("about:blank");
await page.goto(`${base}/map/#y=2013&l=seifa&i=inc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const med13 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2013].ready;
  await new Promise((r) => setTimeout(r, 600));
  const i = m.Y[2013].byName.get("Watson");
  m.select({ level: "div", st: m.Y[2013].divs[i].st, div: i });
  await new Promise((r) => setTimeout(r, 600));
  return {
    note2: (document.querySelector(".lg-note") || {}).textContent || "",
    story: (document.querySelector("#story") || document.body).innerText,
  };
});
ok("2013 median legend names census-year dollars", /Median weekly household income \(census-year dollars\)/.test(med13.note2), med13.note2.slice(0, 160));
ok("2013 median legend marks the 2011-census national line", /The line marks Australia: \$1,235/.test(med13.note2), med13.note2.slice(-140));
ok("2013 Watson seat hed carries the median figure", /median household in Watson earns \$1,046 a week/.test(med13.story), med13.story.slice(0, 200));
ok("2013 Watson dek names the national line in epoch dollars", /across Australia, households earn \$1,235 a week in census-year dollars/.test(med13.story), med13.story.slice(0, 400));

// the picker idiom: swap to the lower-income share view through the SAME selects
await page.evaluate(async () => {
  const sel = document.querySelector('select[data-opt="incv"]');
  sel.value = "lo";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
});
const lo13 = await page.evaluate(() => ({
  note: (document.querySelector(".lg-note") || {}).textContent || "",
  hash: location.hash,
}));
ok("switching to the share view through the picker keeps the interp copy", /Share of adults in households earning under \$738–\$896 a week \(census-year dollars\)/.test(lo13.note), lo13.note.slice(0, 180));
ok("the share view lands in the hash (iv=lo)", /iv=lo/.test(lo13.hash), lo13.hash);

// the income lane never appears where its store has none
const menuNow96 = await page.evaluate(async () => {
  const m = window.__map;
  m.setYear(1996);
  await m.Y[1996].ready;
  await new Promise((r) => setTimeout(r, 400));
  const g = [...document.querySelectorAll('select[data-opt="index"] optgroup')].find((x) => x.label === "People");
  return [...g.querySelectorAll("option")].map((o) => o.value);
});
ok("1996 People menu omits Household income (income starts 2001)", !menuNow96.includes("inc"), JSON.stringify(menuNow96));
await page.evaluate(async () => { const m = window.__map; m.setYear("nsw23"); await m.Y.nsw23.ready; await new Promise((r) => setTimeout(r, 400)); });
const menuNsw = await page.evaluate(() => {
  const g = [...document.querySelectorAll('select[data-opt="index"] optgroup')].find((x) => x.label === "People");
  const note = (document.querySelector(".lg-note") || {}).textContent || "";
  return g ? { menu: [...g.querySelectorAll("option")].map((o) => o.value), note } : null;
});
// the today-arc's GCP income lanes on the seven state frames (d2a7dc7d) put
// the Household-income entry on state menus too; the median view names the
// places caveat until state-level booth medians land
ok("nsw23 People menu carries Household income (state-frame income arc)",
  menuNsw && menuNsw.menu.includes("inc"), JSON.stringify(menuNsw && menuNsw.menu));

mark("median view done");
// 5z. the Religion and Housing-tenure select lenses: the deep links open
// straight on No religion and Owned-with-mortgage, a religious option swap
// rides as rl= in the hash, and Wentworth's Jewish share is its own figure
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=rel`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const relNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  const sel = document.querySelector('select[data-opt="index"]');
  const relSel = document.querySelector('select[data-opt="rel"]');
  return {
    sel: sel && sel.value,
    relOptCount: relSel ? relSel.querySelectorAll("option").length : 0,
    relSelVal: relSel && relSel.value,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo,
    wen: m.Y.now.divs[m.Y.now.byName.get("Wentworth")].demo,
  };
});
ok("#i=rel selects the Religion lens", relNow.sel === "rel", relNow.sel);
ok("religion picker offers 10", relNow.relOptCount === 10, String(relNow.relOptCount));
ok("religion picker lands on No religion", relNow.relSelVal === "norel", relNow.relSelVal);
ok("now legend says no religion", /Share of residents who say they have no religion/.test(relNow.note), relNow.note.slice(0, 160));
ok("now AUS norel ≈ 41.5%", relNow.aus && Math.abs(relNow.aus.rel.norel - 41.5) < 0.6, JSON.stringify(relNow.aus && relNow.aus.rel));
ok("Wentworth jew ≈ 12.9%", relNow.wen && Math.abs(relNow.wen.rel.jew - 0.129) < 0.01, JSON.stringify(relNow.wen && relNow.wen.rel));

await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=rel&rl=isl`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const islNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return {
    relSelVal: (document.querySelector('select[data-opt="rel"]') || {}).value,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
  };
});
ok("#rl=isl restores Islam", islNow.relSelVal === "isl", islNow.relSelVal);
ok("now legend says are Muslim", /Share of residents who are Muslim/.test(islNow.note), islNow.note.slice(0, 160));

await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=ten`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const tenNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  const tenSel = document.querySelector('select[data-opt="ten"]');
  return {
    sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    tenOptCount: tenSel ? tenSel.querySelectorAll("option").length : 0,
    tenSelVal: tenSel && tenSel.value,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo,
  };
});
ok("#i=ten selects Housing tenure", tenNow.sel === "ten", tenNow.sel);
ok("tenure picker offers 4", tenNow.tenOptCount === 4, String(tenNow.tenOptCount));
ok("tenure picker lands on owned-with-mortgage", tenNow.tenSelVal === "mort", tenNow.tenSelVal);
ok("now legend says owned with mortgage", /Share of residents whose dwellings are owned with a mortgage/.test(tenNow.note), tenNow.note.slice(0, 160));
ok("now AUS mort ≈ 36.9%", tenNow.aus && Math.abs(tenNow.aus.ten.mort - 36.9) < 0.6, JSON.stringify(tenNow.aus && tenNow.aus.ten));

mark("section 5z done");
// 5z2. the 2026-10-31 lanes arc's people measures: the public-transport,
// non-citizens, more-than-two-children and homeless lanes plus the
// Ancestry select menu (deep links, your-hash-and-pickers restore,
// honest legend notes on each new lane).
// pt: the commute share of employed people per the census's own
// method-of-travel table.
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=pt`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const ptNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return { sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo,
    story: "" };
});
ok("#i=pt selects Public transport", ptNow.sel === "pt", ptNow.sel);
ok("pt note describes PT-by-stated-method journeys",
  /share of employed/i.test(ptNow.note) && /train|tram|bus|ferry/i.test(ptNow.note), ptNow.note.slice(0, 220));
ok("now AUS pt ≈ 3.4% (post-pandemic JTW read)", ptNow.aus && Math.abs(ptNow.aus.pt - 3.4) < 0.4, JSON.stringify(ptNow.aus));

// noncit: residents not listed as Australian citizens by the census
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=noncit`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const ncNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return { note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo };
});
ok("noncit note names the census complement honestly", /not (listed as|counted as) Australian citizens/i.test(ncNow.note), ncNow.note.slice(0, 240));
ok("now AUS noncit ≈ 15%", ncNow.aus && Math.abs(ncNow.aus.noncit - 15.1) < 0.4, JSON.stringify(ncNow.aus));

// bigfam: women who've had three or more children
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=bigfam`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const bfNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return { note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo };
});
ok("bigfam note names women with more than two children", /women aged 15\+ who have had more than two children/i.test(bfNow.note), bfNow.note.slice(0, 220));
ok("now AUS bigfam ≈ 24.7%", bfNow.aus && Math.abs(bfNow.aus.bigfam - 24.7) < 0.4, JSON.stringify(bfNow.aus));

// hl: the ABS homelessness estimate, at SA2-area basis of copy
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=hl`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const hlNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return { note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo };
});
ok("hl note names the ABS estimate + the SA2 area basis",
  /ABS/i.test(hlNow.note) && /homeless/i.test(hlNow.note) && /SA2/.test(hlNow.note),
  hlNow.note.slice(0, 240));
ok("now AUS hl ≈ 0.45%", hlNow.aus && Math.abs(hlNow.aus.hl - 0.45) < 0.08, JSON.stringify(hlNow.aus));

// anc: the Ancestry select menu — #i=anc&an=scottish deep-link restores
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=anc&an=scottish`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const ancNow = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  const ancSel = document.querySelector('select[data-opt="anc"]');
  return { sel: (document.querySelector('select[data-opt="index"]') || {}).value,
    ancOptCount: ancSel ? ancSel.querySelectorAll("option").length : 0,
    ancSelVal: ancSel && ancSel.value,
    hash: location.hash,
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo };
});
ok("#i=anc selects the Ancestry lens", ancNow.sel === "anc", ancNow.sel);
ok("ancestry picker offers the twelve", ancNow.ancOptCount === 12, String(ancNow.ancOptCount));
ok("#an=scottish restores Scottish", ancNow.ancSelVal === "scottish", ancNow.ancSelVal);
ok("the an= param serialises on the hash", /\ban=scottish/.test(ancNow.hash), ancNow.hash);
ok("now legend names Scottish ancestry", /English ancestry|Scottish ancestry/.test(ancNow.note) && /Scottish ancestry/.test(ancNow.note), ancNow.note.slice(0, 200));
ok("ancestry note mentions two ancestries", /up to two ancestries|two ancestries/.test(ancNow.note), ancNow.note.slice(0, 260));
ok("now AUS scottish ≈ 9.3%", ancNow.aus && ancNow.aus.anc && Math.abs(ancNow.aus.anc.scottish - 9.3) < 0.4, JSON.stringify(ancNow.aus && ancNow.aus.anc));
await page.goto("about:blank");
await page.goto(`${base}/map/#l=seifa&i=anc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const ancDef = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y.now.ready;
  await new Promise((r) => setTimeout(r, 500));
  return { sel: (document.querySelector('select[data-opt="anc"]') || {}).value,
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo };
});
ok("ancestry lands on its own first option (English)", ancDef.sel === "english", ancDef.sel);
ok("now AUS english ≈ 35.7%", ancDef.aus && ancDef.aus.anc && Math.abs(ancDef.aus.anc.english - 35.7) < 0.5, JSON.stringify(ancDef.aus && ancDef.aus.anc));
// the 2013 frame carries hl's venue read; 2007/2010 hide the lane
const hl2013 = await page.evaluate(async () => {
  const m = window.__map;
  await m.setYear(2013);
  await m.Y[2013].ready;
  await new Promise((r) => setTimeout(r, 500));
  const sel = document.querySelector('select[data-opt="index"]');
  return { hasHl: ![...sel.options].map((o) => o.value).includes("hl"),
    watsonDiv: (m.Y[2013].byName.get("Watson") != null) ? m.Y[2013].divs[m.Y[2013].byName.get("Watson")].demo : null };
});
ok("2013 People lists homeless (the 2011-era lane lives)", !hl2013.hasHl);
ok("2013 Watson hl ≈ 0.5% (venue SA1 read)", hl2013.watsonDiv && typeof hl2013.watsonDiv.hl === "number" && Math.abs(hl2013.watsonDiv.hl - 0.005) < 0.004, JSON.stringify(hl2013.watsonDiv));
const p2010 = await page.evaluate(async () => {
  const m = window.__map;
  await m.setYear(2010);
  await m.Y[2010].ready;
  await new Promise((r) => setTimeout(r, 300));
  const sel = document.querySelector('select[data-opt="index"]');
  return [...sel.options].map((o) => o.value);
});
ok("2010 People hides homeless (no 2006 homelessness estimates)", !p2010.includes("hl") && p2010.includes("pt") && p2010.includes("anc"), p2010.join(","));

mark("section 5z2 done");
// 6. hover tooltip on an income lane names the income wording, never "undefined":
// goDiv flies the seat into view, then a real pointer sweep over the canvas
// lands on it (hitTest is not exported, so this must drive real mouse events).
async function tipAfterHover(year, incView) {
  const seatName = year === "now" ? "Grayndler" : "Watson";
  await page.evaluate(async (yr, view, nm) => {
    const m = window.__map;
    m.setYear(yr);
    m.setLens("seifa");
    await m.Y[yr].ready;
    const sel = document.querySelector('select[data-opt="index"]');
    if (["med", "lo", "hi"].includes(view)) {
      // a real pick through the merged income lane + its own measure picker
      sel.value = "inc";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      if (view !== "med") {
        const iv = document.querySelector('select[data-opt="incv"]');
        iv.value = view;
        iv.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else {
      sel.value = view;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 400));
    m.goDiv(m.Y[yr].byName.get(nm), { fly: true, dur: 0 });
  }, year, incView, seatName);
  await wait(700);
  const grid = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  let found = "";
  outer: for (let gy = 0.15; gy <= 0.9; gy += 0.05) {
    for (let gx = 0.15; gx <= 0.9; gx += 0.05) {
      await page.mouse.move(grid.left + grid.w * gx, grid.top + grid.h * gy, { steps: 2 });
      await wait(30);
      const t = await page.evaluate(() => {
        const tip = document.querySelector("#tip");
        return tip && !tip.hidden ? tip.innerText : "";
      });
      if (t && t.includes(seatName)) { found = t; break outer; }
    }
  }
  return found;
}
const tipNow = await tipAfterHover("now", "hi");
ok("now hiinc tip found over Grayndler", tipNow.length > 0, tipNow.slice(0, 140));
ok("now hiinc tip has no 'undefined'", !/undefined/.test(tipNow), tipNow.slice(0, 140));
const nowCuts = await page.evaluate(() => window.__map.Y.now.incomeCuts);
ok("now hiinc tip names its cut in 2021 dollars",
  nowCuts && new RegExp(`%\\s+live in households earning \\$${nowCuts.hiEdgeWeekly.toLocaleString("en-AU")} or more a week in ${nowCuts.dollarsYear} dollars`).test(tipNow),
  tipNow.slice(0, 160));
const tip2013 = await tipAfterHover(2013, "lo");
ok("2013 loinc tip found over Watson", tip2013.length > 0, tip2013.slice(0, 140));
ok("2013 loinc tip has no 'undefined'", !/undefined/.test(tip2013), tip2013.slice(0, 140));
const cuts13 = await page.evaluate(() => window.__map.Y[2013].incomeCuts);
ok("2013 loinc tip names its interp-era cut",
  cuts13 && /%\s+live in households earning under \$738–\$896 a week in census-year dollars/.test(tip2013),
  tip2013.slice(0, 160));
const tipFborn = await tipAfterHover(2013, "fborn");
ok("2013 fborn tip carries the non-income verb", /%\s+were born overseas/.test(tipFborn), tipFborn.slice(0, 140));

await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "ALL OK");
process.exit(fails.length ? 1 : 0);
