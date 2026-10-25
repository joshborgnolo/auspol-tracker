// Probe: the census "People" lanes (lang/a65/a2034/fborn/uni/blue + loinc/hiinc) on the LOCAL map build.
// usage: node .matilda/probe/map-census-people.mjs <baseUrl>   (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const page = await browser.newPage();
await page.setCacheEnabled(false);
await page.setViewport({ width: 1200, height: 900 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };
const mark = (s) => console.log(`… ${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. People optgroup carries eight measures, incl. blue-collar and the two income lanes
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
  ok("People has 8 options", people[1].length === 8, people[1].join(" | "));
  ok("Born overseas listed", people[1].some((t) => /born overseas/i.test(t)));
  ok("University educated listed", people[1].some((t) => /university/i.test(t)));
  ok("Blue-collar listed", people[1].some((t) => /blue-collar/i.test(t)));
  ok("Lower income listed", people[1].some((t) => /lower-income household/i.test(t)));
  ok("Higher income listed", people[1].some((t) => /high-income household/i.test(t)));
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
    note: (document.querySelector(".lg-note") || {}).textContent || "",
    aus: m.Y.now.areas && m.Y.now.areas.AUS && m.Y.now.areas.AUS.demo,
  };
});
ok("#i=loinc selects loinc", loNow.sel === "loinc", loNow.sel);
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
    note: (document.querySelector(".lg-note") || {}).textContent || "",
  };
});
ok("#i=hiinc selects hiinc", hi2016.sel === "hiinc", hi2016.sel);
ok("2016 hiinc legend names $4,000 or more in 2021 dollars", /earning \$4,000 or more a week \(2021 dollars\)/.test(hi2016.note), hi2016.note.slice(0, 160));

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
ok("2013 legend cites 2011 census areas", /2011 census/.test(y2013.note), y2013.note.slice(0, 140));
ok("2013 Watson fborn ≈ 52%", y2013.watson && Math.abs(y2013.watson.fborn - 0.5232) < 0.01, JSON.stringify(y2013.watson));
ok("2013 Watson loinc ≈ 31.5%", y2013.watson && Math.abs(y2013.watson.loinc - 0.315) < 0.005, JSON.stringify(y2013.watson));
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
ok("2013 loinc legend names $738 in 2011 dollars", /Share of adults in households earning under \$738 a week \(2011 dollars\)/.test(lo2013.note), lo2013.note.slice(0, 160));
ok("2013 loinc hed uses the adults wording", /of Watson’s adults live in households earning under \$738 a week in 2011 dollars/.test(lo2013.story), lo2013.story.slice(0, 300));
ok("no story renders 'undefined' (loinc)", !/undefined/.test(lo2013.story));

mark("section 3b done");
// 4. 2004 (pre-floor) shows the early copy, not a figure
const y2004 = await page.evaluate(async () => {
  const m = window.__map;
  m.setYear(2004);
  await m.Y[2004].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("2004 legend shows the early-floor copy", /start at the 2007 election/.test(y2004), y2004.slice(0, 160));

// 4b. 2010 is inside the floor now: venue lanes on the 2006 census, no income lanes
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
ok("2010 legend cites the 2006 census", /2006 census/.test(y2010.note), y2010.note.slice(0, 140));
ok("2010 People optgroup drops the income lanes",
  y2010.people && y2010.people.length === 6 && !y2010.people.includes("loinc") && !y2010.people.includes("hiinc"),
  JSON.stringify(y2010.people));

// 4c. an income deep link on 2010 shows the income-start copy, not a figure
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2010&l=seifa&i=loinc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const lo2010 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2010].ready;
  await new Promise((r) => setTimeout(r, 500));
  return (document.querySelector(".lg-note") || {}).textContent || "";
});
ok("2010 income lane shows the income-start copy", /Income figures start at the 2013 election/.test(lo2010), lo2010.slice(0, 160));

mark("section 4 done");
// 5. booth story on 2013 carries venue 'who' phrasing and an Income row WITHOUT a median
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
ok("booth Income row has NO median (booths carry none)", !/median weekly household income/.test(booth.story));
ok("no story renders 'undefined'", !/undefined/.test(y2013.story) && !/undefined/.test(booth.story));

await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "ALL OK");
process.exit(fails.length ? 1 : 0);
