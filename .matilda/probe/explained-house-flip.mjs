/* explained-house-flip.mjs — the /flows-explained/ election chart's House:
   flip (user 2026-10-22: "House: Lower ⇄ / Upper ⇄"), beside the Share:
   flip. Upper cuts the same chart to the Senate's above-the-line flows for
   the four post-GVT elections 2016–2025 (FLOW_HISTORY_SENATE), national and
   the eight states/territories through the same Federal menu section; the
   seat-classification entries and the state-ELECTIONS optgroup are House
   features and leave the menu under Upper; the Labor-v-One-Nation tab has
   no Senate bank and snaps back to the Coalition contest on the flip. The
   counts live in .build/aec-flow-src/senate-atl/counts.json, pinned by
   .build/test-senate-atl-flows.mjs; this probe pins the chart-side
   behaviour headlessly against the built page. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 9292;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const pageErrors = [];
const wire = (page) => page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
const houseBtn = (p) => p.$(".ex-fl-card .ex-house .rd-pl-flip");
const houseState = (p) => p.$eval(".ex-fl-card .ex-house .rd-pl-flip", (b) =>
  ({ t: b.textContent.replace(/\s+/g, " ").trim(), pressed: b.getAttribute("aria-pressed"), title: b.title }));
const clickHouse = (p) => p.$eval(".ex-fl-card .ex-house .rd-pl-flip", (b) => b.click());
const meta = (p) => p.$eval(".ex-fl-card .rd-chead-meta", (el) => el.textContent.replace(/\s+/g, " ").trim());
const scopeTitle = (p) => p.$eval(".ex-fl-card .rd-chead-t", (el) => el.childNodes[0].textContent.trim());
const footText = (p) => p.$eval(".ex-fl-card .rd-foot-text", (el) => el.textContent.replace(/\s+/g, " ").trim());
const menuInfo = (p) => p.$eval(".ex-fl-card select.ex-fl-sel", (s) => ({
  value: s.value,
  groups: [...s.querySelectorAll("optgroup")].map((g) => g.label),
  options: [...s.querySelectorAll("option")].map((o) => o.value),
}));
const pickMenu = (p, v) => p.select(".ex-fl-card select.ex-fl-sel", v);
const yearTicks = (p) => p.$$eval(".ex-fl-card svg text", (ts) =>
  ts.map((t) => t.textContent.trim()).filter((t) => /^\d{4}$/.test(t)));
const cardOverflow = (p, w) => p.evaluate((vw) => {
  const els = [...document.querySelectorAll(".ex-fl-card .ex-house .rd-pl-flip, .ex-fl-card .ex-share .rd-pl-flip, .ex-fl-card select.ex-fl-sel")];
  return { doc: document.documentElement.scrollWidth - vw,
           els: els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).length };
}, w);

console.log("== desktop 1280: Lower is the landing, the flip beside Share ==");
const page = await browser.newPage();
wire(page);
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".ex-fl-card .ex-house .rd-pl-flip", { timeout: 20000 });
await sleep(900);

const FED_META = "Australian federal elections";
const SEN_META = "Australian Senate elections, 2016–2025";
{
  const h = await houseState(page);
  ok("the House flip opens Lower, its title the Senate destination",
     h.t === "Lower ⇄" && h.pressed === "false" && h.title === "Switch to Senate flows (above-the-line ballots)",
     JSON.stringify(h));
  ok("it sits beside Share in the desktop tab row",
     await page.evaluate(() => {
       const tabs = document.querySelector(".ex-fl-card .ex-fl-tabs");
       return !!(tabs && tabs.querySelector(".ex-house") && tabs.querySelector(".ex-share"));
     }));
  const m = await menuInfo(page);
  ok("the menu carries the class entries and the state elections under Lower",
     m.groups.length === 2 && m.groups[0] === "Federal elections" && m.groups[1] === "State elections"
       && m.options.some((v) => v.startsWith("fedcl:")), JSON.stringify(m.groups) + " · " + m.options.length + " options");
  ok("…and the eight federal states", (m.options.filter((v) => v.startsWith("fed:"))).length === 8,
     m.options.filter((v) => v.startsWith("fed:")).join(" "));
  ok("the scope is the federal House series", (await meta(page)).startsWith(FED_META), await meta(page));
  ok("the head title pairs Labor with the Coalition",
     (await scopeTitle(page)) === "Preferences to Labor over the Coalition, %", await scopeTitle(page));
  const yt = await yearTicks(page);
  ok("the House series ticks more than the Senate's four", yt.length > 4 && yt[yt.length - 1] === "2025", yt.join("/"));
}

console.log("== desktop: flip to Upper — the Senate's four post-GVT counts ==");
await clickHouse(page);
await sleep(700);
{
  const h = await houseState(page);
  ok("the button names Upper, pressed, its title the House destination",
     h.t === "Upper ⇄" && h.pressed === "true" && h.title === "Switch to House of Representatives flows",
     JSON.stringify(h));
  const m = await menuInfo(page);
  ok("the menu sheds the class entries and the state-elections optgroup",
     m.groups.length === 1 && m.groups[0] === "Federal elections"
       && !m.options.some((v) => v.startsWith("fedcl:")), JSON.stringify(m.groups) + " · " + m.options.join(" "));
  ok("…but keeps national and the eight states", m.options.length === 9 && m.options[0] === "fed", m.options.join(" "));
  ok("the scope cuts to the Senate series", (await meta(page)) === SEN_META, await meta(page));
  const yt = await yearTicks(page);
  ok("the chart ticks the four post-GVT Senate elections",
     JSON.stringify(yt) === JSON.stringify(["2016", "2019", "2022", "2025"]), yt.join("/"));
  const foot = await footText(page);
  ok("the caption is the Senate's, 'named neither' over exhausted",
     foot.startsWith("Counted from the AEC’s ballot-level formal-preferences files") && foot.includes("named neither"),
     foot.slice(0, 90) + "…");
  /* the tooltip: every ATL ballot is live at the count's end, so the note
     gives the share naming neither major - never "exhausted". 2016 Greens:
     share 86.9, neither 15.3. The card sits below the viewport fold, so
     scroll it into view before aiming (a move to off-screen coords fires
     nothing). Pads are css px; the svg's 1000-wide viewBox scales inside. */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  const pt = await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    const r = svg.getBoundingClientRect();
    return { x: r.left + 40, y: r.top + 16 + (1 - 86.9 / 100) * (290 - 16 - 30) };
  });
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2016 hover opens the tooltip with the Senate title",
     !!tip && tip.includes("2016"), tip ? tip.slice(0, 60) : "no tooltip");
  ok("…its note gives the share naming neither major",
     !!tip && tip.includes("named neither major: 15.3%"), tip ? tip.slice(80, 220) : "no tooltip");
  ok("…and nothing says a Senate ballot 'exhausted'",
     !!tip && !tip.toLowerCase().includes("exhaust"), tip ? tip.slice(0, 60) : "no tooltip");
  await page.mouse.move(pt.x, pt.y - 200);
}

console.log("== desktop: the federal states ride the Senate bank ==");
await pickMenu(page, "fed:sa");
await sleep(700);
{
  const senLabels = await page.evaluate(() => {
    const st = window.AUSPOL.flowHistory.fed.sen.states;
    return { sa: st.sa.elections, act: st.act.elections };
  });
  ok("a state pick cuts to that state's Senate bank", (await meta(page)) === senLabels.sa + ", 2016–2025", await meta(page));
  const foot = await footText(page);
  ok("the caption gains the state-bank sentence (gaps = no tickets, never zeros)",
     foot.includes("is an election it had no SA Senate tickets") || foot.includes("Senate tickets — a zero-ballot group draws as a gap"),
     foot.slice(180, 300));
  await pickMenu(page, "fed:act");
  await sleep(700);
  const actFoot = await footText(page);
  ok("the ACT view captions the territories' small-electorate caveat",
     actFoot.includes("territories") && actFoot.includes("Two senators"), actFoot.slice(180, 320));
  const texts = await page.$$eval(".ex-fl-card svg text", (ts) => ts.map((t) => t.textContent.trim()));
  ok("the ACT's all-null One Nation line is dropped, not zeroed",
     !texts.includes("One Nation"), JSON.stringify(texts.filter((t) => /One Nation|Greens|Others/.test(t))));
}
await pickMenu(page, "fed");
await sleep(700);

console.log("== desktop: flipping back, and the snap rules ==");
await clickHouse(page);
await sleep(700);
{
  ok("Lower restores the House series", (await meta(page)).startsWith(FED_META), await meta(page));
  const cls = await page.evaluate(() => {
    const o = [...document.querySelectorAll(".ex-fl-card select.ex-fl-sel option")].find((x) => x.value.startsWith("fedcl:"));
    return o ? o.value : null;
  });
  await pickMenu(page, cls);
  await sleep(600);
  ok("a seat-class view picks under Lower", (await meta(page)).includes("classes") || !(await meta(page)).startsWith(FED_META), await meta(page));
  await clickHouse(page);
  await sleep(700);
  ok("flipping to Upper snaps the class view back to federal national",
     (await menuInfo(page)).value === "fed", (await menuInfo(page)).value);
  ok("…and the Senate national series draws", (await meta(page)) === SEN_META, await meta(page));
  await clickHouse(page);
  await sleep(700);
}
{
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation");
    b.click();
  });
  await sleep(700);
  ok("the One Nation contest keeps the House flip", !!(await houseBtn(page)));
  ok("…and sheds the elections menu", (await page.$(".ex-fl-card select.ex-fl-sel")) === null);
  const ytOn = await yearTicks(page);
  ok("the counted contests tick, not the election years", ytOn.length === 0, ytOn.join("/"));
  await clickHouse(page);
  await sleep(700);
  const pairBack = await page.$$eval(".ex-fl-card .ex-fl-tabs .rd-tab", (ts) =>
    ts.map((t) => ({ t: t.textContent.trim(), p: t.getAttribute("aria-pressed") })));
  ok("flipping House on the One Nation tab snaps to the Coalition contest",
     pairBack[0].p === "true" && pairBack[1].p === "false", JSON.stringify(pairBack));
  ok("…with the Senate series and its menu back",
     (await meta(page)) === SEN_META && !!(await page.$(".ex-fl-card select.ex-fl-sel")), await meta(page));
  await clickHouse(page);
  await sleep(700);
}

console.log("== width sweep: the head controls never overflow (Lower and Upper) ==");
const widths = [320, 360, 414, 561, 640, 700];
const sweep = await browser.newPage();
wire(sweep);
for (const w of widths) {
  await sweep.setViewport({ width: w, height: 780, isMobile: w < 700, hasTouch: w < 700 });
  await sweep.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "domcontentloaded" });
  await sweep.waitForSelector(".ex-fl-card .ex-house .rd-pl-flip", { timeout: 20000 });
  await sleep(700);
  const narrow = w <= 640;
  const ctls = await sweep.$(".ex-fl-card .ex-fl-ctls");
  ok(`at ${w}px the controls sit ${narrow ? "in the flips' head span" : "in the tab row"}`,
     narrow ? !!ctls : !ctls, narrow ? (ctls ? "span found" : "span MISSING") : (ctls ? "stray span" : "no span"));
  let g = await cardOverflow(sweep, w);
  ok(`at ${w}px Lower: no document overflow, all three controls within the viewport`,
     g.doc <= 0 && g.els === 0, `doc ${g.doc}px, ${g.els} stray`);
  await clickHouse(sweep);
  await sleep(800);
  const m = await menuInfo(sweep);
  ok(`at ${w}px Upper: the menu is the Senate nine`, m.options.length === 9 && m.groups.length === 1, m.options.join(" "));
  g = await cardOverflow(sweep, w);
  ok(`at ${w}px Upper: no document overflow, all three controls within the viewport`,
     g.doc <= 0 && g.els === 0, `doc ${g.doc}px, ${g.els} stray`);
}
await sweep.close();

console.log("== the frozen classic design (?design=old): renders, no crash ==");
const old = await browser.newPage();
wire(old);
await old.setViewport({ width: 1280, height: 900 });
await old.goto(`http://127.0.0.1:${PORT}/flows-explained/?design=old`, { waitUntil: "domcontentloaded" });
await sleep(900);
{
  const errs = pageErrors.slice();
  ok("no page error under the classic design", errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  /* the boundary's own source ("This view hit an error…") rides the inline
     React bundle text, so judge the RENDERED .view-error element, not a
     body-text match */
  const boundary = await old.evaluate(() => !!document.querySelector(".view-error"));
  ok("no error boundary renders", !boundary);
  ok("the page still carries its copy", (await old.evaluate(() => document.body.textContent.replace(/\s+/g, " ").length)) > 500);
}
await old.close();

ok("no page error anywhere in the session", pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 2)));
await page.close();
await browser.close();
server.close();
const bad = results.filter(([, p]) => !p);
console.log(bad.length ? `✗ ${bad.length} check(s) failed` : `✓ all ${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
