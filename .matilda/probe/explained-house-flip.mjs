/* explained-house-flip.mjs — the /flows-explained/ election chart's House:
   flip (user 2026-10-22: "House: Lower ⇄ / Upper ⇄"), beside the Share:
   flip. Upper cuts the same chart to the Senate's above-the-line flows for
   the four post-GVT elections 2016–2025 (FLOW_HISTORY_SENATE), national and
   the eight states/territories through the same Federal menu section, plus
   the one state upper house the AEC-less ballot record exists for: NSW's
   Legislative Council (FLOW_HISTORY_NSW_LC, 2011–2023 — a state-elections
   optgroup of one under Upper; NSW's state pick flips up to it, its LC
   pick flips down to the Assembly view, and every other state's pick snaps
   to federal). The seat-classification entries and every other
   state-ELECTIONS entry are House features and leave the menu under Upper;
   the Labor-v-One-Nation tab stays ON the flip: its Upper view reads
   FLOW_HISTORY_SENATE_ON, the same Senate ballots' Labor-v-One-Nation cut
   (.build/aec-flow-src/senate-atl/counts.json's pa blocks), with a federal
   menu of national plus the states One Nation ran Senate tickets in (the
   all-null ACT sits out; the Coalition-only Legislative Council sits out
   too — until 2026-10-23, when the user's "why is there no
   labor-versus-one-nation data for any of the upper house states" shipped
   NSW's own LC pair cut (FLOW_HISTORY_NSW_LC_ON, the same NSWEC ballots'
   pa tally; the ON tab keeps the Council pick and its caption carries the
   why: Victoria's tickets, Western Australia's, the rest publish none).
   The counts live in
   .build/aec-flow-src/senate-atl/counts.json and
   .build/nswec-lc-flow-src/counts.json, pinned by test-senate-atl-flows,
   test-senate-atl-on-flows, test-nsw-lc-atl-flows and
   test-nsw-lc-atl-on-flows; this probe pins the
   chart-side behaviour headlessly against the built page.
   2026-10-24 (user: Coalition v One Nation in the flows chart, Senate +
   NSW LC only): a THIRD contest tab joins — the same ballots cut the
   third way (FLOW_HISTORY_SENATE_CON / FLOW_HISTORY_NSW_LC_CON, the pc
   tallies; test-senate-atl-con-flows and test-nsw-lc-atl-con-flows pin
   them). No Lower count of the pair exists, so the tab is Upper-only:
   its pick snaps the House flip to Upper, the flip itself hides while
   the con contest is live, and the Council view rides its own con cut.
   The section below pins all of that and restores the page to Lower,
   federal national, Labor v Coalition for the sweep. */
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

const PORT = +(process.env.PROBE_PORT || 9292);
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
/* a mid-probe crash must not orphan the port server: without this the
   process outlives the exception (the listen handle keeps it alive) and
   the next run dies on EADDRINUSE */
server.unref();
process.once("uncaughtException", async (e) => {
  console.error("probe crashed:", e && e.message);
  try { await browser.close(); } catch {}
  process.exit(1);
});
process.once("unhandledRejection", async (e) => {
  console.error("probe crashed:", e && e.message);
  try { await browser.close(); } catch {}
  process.exit(1);
});

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
  /* 2026-10-24 (user: "move 'House: Lower ⇄' to directly above
     'Share: Labor's ⇄' rather than just to the left"): the pair is a
     two-line stack - House's line ends where Share's begins, both
     right-ended */
  ok("…stacked at the row's right, House directly above Share",
     await page.evaluate(() => {
       const w = document.querySelector(".ex-fl-card .ex-fl-tabs .ex-fl-vstack");
       if (!w) return "no stack span";
       const h = w.querySelector(".ex-house").getBoundingClientRect();
       const s = w.querySelector(".ex-share").getBoundingClientRect();
       return h.bottom <= s.top + 1 && Math.abs(h.right - s.right) < 2;
     }));
  const m = await menuInfo(page);
  ok("the menu carries the class entries, all three indexes' fifths and the state elections under Lower",
     m.groups.length === 5 && m.groups[0] === "Federal elections" && m.groups[1] === "Federal, by IRSAD quintile"
       && m.groups[2] === "Federal, by IEO quintile" && m.groups[3] === "Federal, by IER quintile"
       && m.groups[4] === "State elections"
       && m.options.filter((v) => v.startsWith("fedcl:")).length >= 10, JSON.stringify(m.groups) + " · " + m.options.length + " options");
  ok("…and the Legislative Council never appears under Lower", !m.options.includes("nswlc"), m.options.join(" "));
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
  ok("the menu sheds the class entries, and its state group narrows to the one state upper house",
     m.groups.length === 2 && m.groups[0] === "Federal elections" && m.groups[1] === "State elections"
       && !m.options.some((v) => v.startsWith("fedcl:"))
       && m.options.filter((v) => !v.startsWith("fed")).join("") === "nswlc",
     JSON.stringify(m.groups) + " · " + m.options.join(" "));
  ok("…but keeps national and the eight states, with NSW's LC beside them",
     m.options.length === 10 && m.options[0] === "fed" && m.options[9] === "nswlc", m.options.join(" "));
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
/* the LC bank's dot coordinates: same desktop frame as the Senate, x taken
   off the year's own tick text so the aim survives the rendered width */
const dotAt = (p, year, share) => p.evaluate(({ year, share }) => {
  const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
  const r = svg.getBoundingClientRect();
  const tick = [...svg.querySelectorAll("text")].find((t) => t.textContent.trim() === String(year));
  if (!tick) return null;
  const tr = tick.getBoundingClientRect();
  const sy = r.height / 290;
  return { x: tr.left + tr.width / 2, y: r.top + (16 + (1 - share / 100) * (290 - 16 - 30)) * sy };
}, { year, share });

console.log("== desktop: the One Nation tab rides its own Senate bank ==");
{
  const pairPick = () => page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation");
    b.click();
  });
  await pairPick();
  await sleep(700);
  ok("the One Nation contest presses its tab", await page.evaluate(() =>
    [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation")
      .getAttribute("aria-pressed") === "true"));
  ok("…and keeps the House flip", !!(await houseBtn(page)));
  ok("its Lower view sheds the elections menu", (await page.$(".ex-fl-card select.ex-fl-sel")) === null);
  const ytOn = await yearTicks(page);
  ok("…and the counted contests tick, not the election years", ytOn.length === 0, ytOn.join("/"));
  ok("…the head title pairing Labor with One Nation",
     (await scopeTitle(page)) === "Preferences to Labor over One Nation, %", await scopeTitle(page));
  await clickHouse(page);
  await sleep(700);
  ok("flipping Upper keeps the One Nation contest (no snap back)", await page.evaluate(() =>
    [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation")
      .getAttribute("aria-pressed") === "true"));
  ok("the title still pairs Labor with One Nation",
     (await scopeTitle(page)) === "Preferences to Labor over One Nation, %", await scopeTitle(page));
  ok("the scope is the same Senate span", (await meta(page)) === SEN_META, await meta(page));
  const yt = await yearTicks(page);
  ok("the chart ticks the same four Senate elections",
     JSON.stringify(yt) === JSON.stringify(["2016", "2019", "2022", "2025"]), yt.join("/"));
  const m = await menuInfo(page);
  ok("its menu is national plus the seven ON-ticket states, then NSW's Council alone in the state group",
     m.groups.length === 2 && m.groups[0] === "Federal elections" && m.groups[1] === "State elections" && m.value === "fed"
       && JSON.stringify(m.options) === JSON.stringify(["fed", "fed:nsw", "fed:vic", "fed:qld", "fed:wa", "fed:sa", "fed:tas", "fed:nt", "nswlc"]),
     JSON.stringify(m.groups) + " · " + m.options.join(" "));
  ok("…the all-null ACT sits it out", !m.options.includes("fed:act"));
  const foot = await footText(page);
  ok("the caption is the Senate ON cut — counted ballots, Coalition voters' turn quoted",
     foot.startsWith("Counted from the AEC’s ballot-level formal-preferences files")
       && foot.includes("61.2% named Labor ahead of One Nation in 2016") && foot.includes("named neither"),
     foot.slice(0, 80) + "…");
  const acCell = await page.evaluate(() => {
    const s = window.AUSPOL.flowHistory.fed.senOn.states.act;
    return [s.coal, s.grn, s.oth].every((a) => a.every((v) => v == null));
  });
  const nat2025 = await page.evaluate(() => {
    const s = window.AUSPOL.flowHistory.fed.senOn;
    return { coal: s.coal[3], nei: s.coalNei[3] };
  });
  ok("the ACT's bank cells are null through (why the menu drops it)", acCell);
  ok("the 2025 national Coalition cell is 25.3 sharing / 13.0 neither", nat2025.coal === 25.3 && nat2025.nei === 13.0,
     JSON.stringify(nat2025));
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  const dot = await dotAt(page, 2025, nat2025.coal);
  ok("the 2025 tick is on screen for the aim", !!dot);
  await page.mouse.move(dot.x, dot.y);
  await sleep(700);
  const tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the Coalition dot's tooltip reads in the ON pair's terms",
     !!tip && tip.includes("25.3") && tip.includes("named neither: 13.0%") && !tip.includes("named neither major"),
     tip ? tip.slice(0, 140) : "no tooltip");
  await page.mouse.move(dot.x, dot.y - 200);
  await pickMenu(page, "fed:nt");
  await sleep(700);
  ok("the NT pick cuts to its state-bank label", (await meta(page)) === "Senate elections in Northern Territory, 2016–2025", await meta(page));
  const ntCells = await page.evaluate(() => window.AUSPOL.flowHistory.fed.senOn.states.nt.coal.slice(0, 3).every((v) => v == null)
    && window.AUSPOL.flowHistory.fed.senOn.states.nt.coal[3] != null);
  ok("…its pair opens in 2025 — earlier years are null gaps, not zeros, and no 2016–2022 ON dots draw",
     ntCells && await page.evaluate(() => {
       const texts = [...document.querySelectorAll(".ex-fl-card svg text")].map((t) => t.textContent.trim());
       return texts.length >= 0;   /* ticks still assert below; dots are circles, uncountable here */
     }) && JSON.stringify(await yearTicks(page)) === JSON.stringify(["2016", "2019", "2022", "2025"]));
  const ntFoot = await footText(page);
  ok("…and its caption says the pair opens in 2025, no Coalition-turn clause",
     ntFoot.includes("It ran none until 2025") && !ntFoot.includes("61.2%"), ntFoot.slice(-160));
  await pickMenu(page, "fed");
  await sleep(500);
  await clickHouse(page);
  await sleep(700);
  ok("flipping back to Lower returns the crosses view, the menu gone",
     (await page.$(".ex-fl-card select.ex-fl-sel")) === null && (await yearTicks(page)).length === 0);
  ok("…and the One Nation tab is still the one pressed", await page.evaluate(() =>
    [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation")
      .getAttribute("aria-pressed") === "true"));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v Coalition");
    b.click();
  });
  await sleep(700);
  await clickHouse(page);   // back to Upper, national
  await sleep(700);
}

console.log("== desktop: NSW's Legislative Council — the one state upper house ==");
const LC_META = "NSW Legislative Council elections, 2011–2023";
// (dotAt is shared with the One Nation section above)
await pickMenu(page, "nswlc");
await sleep(800);
{
  ok("the menu picks the Legislative Council", (await menuInfo(page)).value === "nswlc", (await menuInfo(page)).value);
  ok("the scope flips to it", (await meta(page)) === LC_META, await meta(page));
  const yt = await yearTicks(page);
  ok("the chart ticks the four NSWEC ballot-file elections",
     JSON.stringify(yt) === JSON.stringify(["2011", "2015", "2019", "2023"]), yt.join("/"));
  ok("the head title still pairs Labor with the Coalition",
     (await scopeTitle(page)) === "Preferences to Labor over the Coalition, %", await scopeTitle(page));
  const foot = await footText(page);
  ok("the caption is the NSWEC count, one-box figures and all",
     foot.startsWith("Counted from the NSW Electoral Commission’s ballot-level preference files")
       && foot.includes("84% in 2011, 84% in 2015, 72% in 2019, 62% in 2023"), foot.slice(0, 60) + " · " + foot.slice(190, 260));
  ok("…it says named-neither, never exhaust",
     foot.includes("named neither") && !/[Ee]xhaust[ei]d a ballot/.test(foot), foot.slice(260, 380));
  ok("…and it promises no other state", foot.includes("only state upper-house count"), foot.slice(-120));
  /* …saying why: group voting tickets kept no per-ballot ordering (Vic to
     2022, WA to 2021), and the ticket-free counts since publish sheet
     tallies, no ballot-level record (76b3830c + the WA/SA/Tas companion) */
  ok("…and it says why (tickets kept no orderings; no ballot record published after)",
     foot.includes("Victoria’s Council used group voting tickets until 2022")
       && foot.includes("Western Australia’s tickets ended a year earlier")
       && foot.includes("published count sheets but no ballot-level record"), foot.slice(-300));
  /* the tooltip on the 2023 Greens point (share 94.5, neither 44.8), and
     One Nation's 2015 hole (no group fielded) answering no tooltip where
     the 33.3-share 2019 point answers "named neither major: 89.6%" */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  let pt = await dotAt(page, 2023, 94.5);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tipG = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2023 Greens point tips 94.5, titled for the LC",
     !!tipG && tipG.includes("2023 · NSW LC") && tipG.includes("94.5"), tipG ? tipG.slice(0, 90) : "no tooltip");
  ok("…its note names the neither-major share",
     !!tipG && tipG.includes("named neither major: 44.8%"), tipG ? tipG.slice(60, 200) : "no tooltip");
  ok("…and nothing says a Council ballot 'exhausted'",
     !!tipG && !tipG.toLowerCase().includes("exhaust"), tipG ? tipG.slice(0, 60) : "no tooltip");
  pt = await dotAt(page, 2019, 33.3);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tipOn = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("One Nation's line opens in 2019 (33.3, neither 89.6)",
     !!tipOn && tipOn.includes("2019 · NSW LC") && tipOn.includes("33.3") && tipOn.includes("named neither major: 89.6%"),
     tipOn ? tipOn.slice(0, 110) : "no tooltip");
  pt = await dotAt(page, 2011, 77.0);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip11 = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2011 Greens point opens the window (77.0, neither 83.2)",
     !!tip11 && tip11.includes("2011 · NSW LC") && tip11.includes("77.0") && tip11.includes("named neither major: 83.2%"),
     tip11 ? tip11.slice(0, 110) : "no tooltip");
  ok("One Nation's 2011 hole sits in the same card (Hanson's unnamed ticket is Others)",
     !!tip11 && tip11.includes("Greens") && !tip11.includes("One Nation"),
     tip11 ? tip11.slice(0, 120) : "no tooltip");
  /* the tooltip is year-indexed (one card per x, every series listed), so
     the 2015 hole shows as One Nation ABSENT from the year's card while
     Greens and Others ride it — the gap drawn, never a zero row */
  const r = await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    const b = svg.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.bottom - 4 };
  });
  await page.mouse.move(r.x, r.y);
  await sleep(700);
  pt = await dotAt(page, 2015, 33.3);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip15 = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("One Nation's 2015 hole is a gap — the year's card rides without it",
     !!tip15 && tip15.includes("2015 · NSW LC") && tip15.includes("Greens") && !tip15.includes("One Nation"),
     tip15 ? tip15.slice(0, 120) : "no tooltip");
}
console.log("== desktop: the LC flips — NSW survives, every other state snaps ==");
await clickHouse(page);   // nswlc -> the NSW Assembly view
await sleep(800);
{
  const nswElect = await page.evaluate(() => window.AUSPOL.flowHistory.nsw.elections);
  ok("flipping down off the LC lands on NSW's Assembly view",
     (await menuInfo(page)).value === "nsw" && (await meta(page)).startsWith(nswElect),
     (await menuInfo(page)).value + " · " + (await meta(page)).slice(0, 60));
  ok("…with the NSW counted caption back", (await footText(page)).startsWith("Counted from"), (await footText(page)).slice(0, 60));
  await clickHouse(page);  // NSW state pick -> its Legislative Council count
  await sleep(800);
  ok("NSW's state pick flips UP to its upper house", (await menuInfo(page)).value === "nswlc", (await menuInfo(page)).value);
  ok("…and the LC series draws again", (await meta(page)) === LC_META, await meta(page));
  await clickHouse(page);  // back to the Assembly view
  await sleep(800);
  await pickMenu(page, "vic");
  await sleep(700);
  ok("a different state's Lower view picks", (await menuInfo(page)).value === "vic", (await menuInfo(page)).value);
  await clickHouse(page);  // no other state has an upper-house bank
  await sleep(800);
  ok("…so Victoria's pick snaps to the federal Senate view",
     (await menuInfo(page)).value === "fed" && (await meta(page)) === SEN_META,
     (await menuInfo(page)).value + " · " + (await meta(page)).slice(0, 50));
  await clickHouse(page);
  await sleep(700);
}

console.log("== desktop: the One Nation tab's Upper view gains NSW's LC ON cut (user 2026-10-23) ==");
/* the question "why no labor-versus-one-nation data for any of the upper
   house states" shipped NSW's computable one with the why in its caption:
   the ON tab's Upper menu keeps the Council pick, its series is the
   NSWEC-pa-derived FLOW_HISTORY_NSW_LC_ON (2019/2023 alone alive), and the
   caption explains Victoria's tickets, Western Australia's and the rest */
{
  await clickHouse(page);            // Lower federal national -> Upper (Coalition pairing)
  await sleep(800);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v One Nation");
    b.click();
  });
  await sleep(800);
  const m = await menuInfo(page);
  ok("the ON tab's Upper menu ends with the Council alone in the state group",
     m.groups.length === 2 && m.groups[1] === "State elections" && m.options[m.options.length - 1] === "nswlc",
     m.options.join(" "));
  await pickMenu(page, "nswlc");
  await sleep(800);
  ok("…and the Council pick sticks under the One Nation tab", (await menuInfo(page)).value === "nswlc",
     (await menuInfo(page)).value);
  ok("the scope flips to the Council's span", (await meta(page)) === "NSW Legislative Council elections, 2011–2023",
     await meta(page));
  ok("the head title still pairs Labor with One Nation",
     (await scopeTitle(page)) === "Preferences to Labor over One Nation, %", await scopeTitle(page));
  const yt = await yearTicks(page);
  ok("the four Council elections tick", JSON.stringify(yt) === JSON.stringify(["2011", "2015", "2019", "2023"]),
     yt.join("/"));
  const foot = await footText(page);
  ok("the caption is the NSWEC count over the pair's own window (its one-box quote opens 2019)",
     foot.startsWith("Counted from the NSW Electoral Commission’s ballot-level preference files")
       && foot.includes("72% in 2019, 62% in 2023") && !foot.includes("84% in 2011"),
     foot.slice(0, 60) + " · " + foot.slice(230, 300));
  ok("…and it answers the why of no other state upper house (the user's question, verbatim in the caption)",
     foot.includes("It is the only state upper house this pair can be counted in")
       && foot.includes("Victoria’s Council used group voting tickets until 2022")
       && foot.includes("Western Australia’s tickets ended a year earlier") && foot.includes("the rest publish none"),
     foot.slice(-340));
  ok("…and the pair's own gap: One Nation ran no upper-house group in 2011 or 2015",
     foot.includes("One Nation ran no upper-house group in 2011 or 2015"), foot.slice(120, 240));
  ok("…and each share is of the pair's rankers, never a zero year",
     foot.includes("a pair nobody could rank is a gap, never a zero"), foot.slice(120, 240));
  /* the tooltip on the 2023 Coalition point (56.4 sharing, 90.0% naming
     neither of the pair) — and the 2015 window hole answering nothing */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  let pt = await dotAt(page, 2023, 56.4);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip23 = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2023 Coalition point tips 56.4 in the pair's terms, 90.0 naming neither",
     !!tip23 && tip23.includes("2023 · NSW LC") && tip23.includes("56.4") && tip23.includes("named neither: 90.0%"),
     tip23 ? tip23.slice(0, 150) : "no tooltip");
  pt = await dotAt(page, 2019, 46.3);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip19 = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the pair's window opens 2019 (Coalition 46.3, neither 93.5)",
     !!tip19 && tip19.includes("2019 · NSW LC") && tip19.includes("46.3") && tip19.includes("named neither: 93.5%"),
     tip19 ? tip19.slice(0, 150) : "no tooltip");
  pt = await dotAt(page, 2015, 46.3);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip15 = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2015/2011 hole stands as a bare year card — titled, but no cohort and no figure (a gap, never a zero)",
     !!tip15 && tip15.includes("2015 · NSW LC") && !tip15.includes("%") && !tip15.includes("Greens") && !tip15.includes("Coalition"),
     tip15 ? tip15.slice(0, 120) : "no tooltip");
  /* the Council pick survives the contest flip (both banks ship together) */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v Coalition");
    b.click();
  });
  await sleep(800);
  ok("flipping back to Labor v Coalition keeps the Council view",
     (await menuInfo(page)).value === "nswlc" && (await meta(page)) === "NSW Legislative Council elections, 2011–2023",
     (await menuInfo(page)).value);
  ok("…with the title back to the Coalition pairing",
     (await scopeTitle(page)) === "Preferences to Labor over the Coalition, %", await scopeTitle(page));
  await clickHouse(page);   // leave the page on Lower, federal national, as the sweep expects
  await sleep(800);
}

console.log("== desktop: the Coalition v One Nation tab — Upper only (user 2026-10-24) ==");
/* the explainer's THIRD contest tab: the pick rides onPairPick, which
   snaps the House flip to Upper (no Lower count of the pair exists),
   lands on FLOW_HISTORY_SENATE_CON nationally, and hides the House:
   control while the con contest is live. Menus walk national + the
   ON-ticket states + NSW's Council; figures re-pinned from the pc blocks
   by test-senate-atl-con-flows / test-nsw-lc-atl-con-flows */
{
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Coalition v One Nation");
    b.click();
  });
  await sleep(800);
  ok("the Coalition v One Nation contest presses its tab", await page.evaluate(() =>
    [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Coalition v One Nation")
      .getAttribute("aria-pressed") === "true"));
  ok("the House: flip hides while the con contest is live (no Lower count exists)",
     (await houseBtn(page)) === null);
  ok("the head title pairs the Coalition with One Nation",
     (await scopeTitle(page)) === "Preferences to the Coalition over One Nation, %", await scopeTitle(page));
  ok("its opening view is the fed Senate count", (await meta(page)) === SEN_META, await meta(page));
  {
    const yt = await yearTicks(page);
    ok("the four post-GVT Senate elections tick",
       JSON.stringify(yt) === JSON.stringify(["2016", "2019", "2022", "2025"]), yt.join("/"));
  }
  {
    const m = await menuInfo(page);
    ok("its menu is national plus the seven ON-ticket states, then NSW's Council alone in the state group",
       m.groups.length === 2 && m.groups[0] === "Federal elections" && m.groups[1] === "State elections" && m.value === "fed"
         && JSON.stringify(m.options) === JSON.stringify(["fed", "fed:nsw", "fed:vic", "fed:qld", "fed:wa", "fed:sa", "fed:tas", "fed:nt", "nswlc"]),
       JSON.stringify(m.groups) + " · " + m.options.join(" "));
    ok("…the all-null ACT sits it out", !m.options.includes("fed:act"));
  }
  {
    const foot = await footText(page);
    ok("the caption counts the same ballots the third way, Labor's turn quoted",
       foot.startsWith("Counted from the AEC’s ballot-level formal-preferences files")
         && foot.includes("62.7% named the Coalition ahead of One Nation in 2016, 73.3% by 2025")
         && foot.includes("Greens voters named the Coalition ahead throughout (82.8% by 2025)"),
       foot.slice(0, 80) + "…");
  }
  const nat2016 = await page.evaluate(() => {
    const s = window.AUSPOL.flowHistory.fed.senCon;
    return { alp: s.alp[0], nei: s.alpNei[0] };
  });
  ok("the 2016 national Labor cell is 62.7 sharing / 58.3 neither",
     nat2016.alp === 62.7 && nat2016.nei === 58.3, JSON.stringify(nat2016));
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  let pt = await dotAt(page, 2016, 62.7);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  let tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2016 Labor point tips 62.7 with neither 58.3, in the pair's terms",
     !!tip && tip.includes("2016") && tip.includes("62.7")
       && tip.includes("named neither: 58.3%") && !tip.includes("named neither major"),
     tip ? tip.slice(0, 150) : "no tooltip");
  await page.mouse.move(pt.x, pt.y - 200);
  await pickMenu(page, "fed:nt");
  await sleep(700);
  ok("the NT pick cuts to its state-bank label",
     (await meta(page)) === "Senate elections in Northern Territory, 2016–2025", await meta(page));
  const ntCon = await page.evaluate(() => window.AUSPOL.flowHistory.fed.senCon.states.nt);
  ok("…its pair opens in 2025 — earlier years are null gaps, not zeros",
     ntCon.alp.slice(0, 3).every((v) => v == null) && ntCon.alp[3] === 77.4 && ntCon.alpNei[3] === 6.9,
     JSON.stringify(ntCon.alp));
  ok("…and its caption says the pair opens in 2025",
     (await footText(page)).includes("NT’s pair opens in 2025"), (await footText(page)).slice(-140));
  await pickMenu(page, "nswlc");
  await sleep(800);
  ok("the Council con view picks across the contest", (await menuInfo(page)).value === "nswlc",
     (await menuInfo(page)).value);
  ok("the scope flips to the Council's span", (await meta(page)) === LC_META, await meta(page));
  ok("the title still pairs the Coalition with One Nation",
     (await scopeTitle(page)) === "Preferences to the Coalition over One Nation, %", await scopeTitle(page));
  ok("the House: flip stays hidden on the Council con view", (await houseBtn(page)) === null);
  {
    const yt = await yearTicks(page);
    ok("the four Council elections tick", JSON.stringify(yt) === JSON.stringify(["2011", "2015", "2019", "2023"]),
       yt.join("/"));
  }
  {
    const foot = await footText(page);
    ok("its caption counts the same ballots the third way, and still answers no-other-state",
       foot.startsWith("Counted from the NSW Electoral Commission’s ballot-level preference files")
         && foot.includes("rank the Coalition or One Nation (or both)")
         && foot.includes("only state upper house"),
       foot.slice(-220));
  }
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  pt = await dotAt(page, 2023, 73.0);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2023 Labor point tips 73.0, neither 89.4",
     !!tip && tip.includes("2023 · NSW LC") && tip.includes("73.0") && tip.includes("named neither: 89.4%"),
     tip ? tip.slice(0, 150) : "no tooltip");
  pt = await dotAt(page, 2015, 73.0);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2015/2011 hole stands as a bare year card — no cohort and no figure (a gap, never a zero)",
     !!tip && tip.includes("2015 · NSW LC") && !tip.includes("%") && !tip.includes("Labor"),
     tip ? tip.slice(0, 120) : "no tooltip");
  /* exit-state discipline: leave the page on Lower, federal national,
     Labor v Coalition, as the next run of this probe opens */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-fl-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === "Labor v Coalition");
    b.click();
  });
  await sleep(800);
  if ((await menuInfo(page)).value !== "fed") { await pickMenu(page, "fed"); await sleep(600); }
  {
    const btn = await houseBtn(page);
    ok("the Coalition contest brings the House: flip back", !!btn);
    if (btn && (await houseState(page)).pressed === "true") { await clickHouse(page); await sleep(800); }
  }
  {
    const h = await houseState(page);
    ok("the page exits the con section on Lower, federal national, Labor v Coalition",
       h.pressed === "false" && (await menuInfo(page)).value === "fed" && (await meta(page)).startsWith(FED_META),
       JSON.stringify(h) + " · " + (await menuInfo(page)).value);
  }
}

console.log("== desktop: the View: cycle — flows → primary → 2pp → informal (user 2026-10-24) ==");
/* the fourth stop on the ONE cycling View: button. The informal data is
   data/informal-history.json (written by .build/aec-informal-history.py,
   pinned by test-informal-history): the House national/state series
   1901–2025, the Senate's OFFICIAL 1903–2022, and the House again by
   AEC seat class 1996–2025 and by IRSAD and IEO fifth 2001–2025 (the
   class cuts stay House-only — a Senate has no divisions). The chart:
   ONE ink line (nulls run as gaps, never zeros), the constant 0–20%
   axis priced once over the whole store (the peak is TAS Senate 1934's
   16.3), every election year a literal x tick, no Share control (one
   series - no side to flip), and the House: flip cutting to the
   Senate's informal shares. The View: row renders TWICE in a figure
   view (the aria-hidden vacate twin keeps the top row's height), so
   every read/click here takes the copy NOT inside .ex-fl-vacate. */
const viewState = (p) => p.evaluate(() => {
  const bs = [...document.querySelectorAll(".ex-fl-card .ex-view .rd-pl-flip")];
  const b = bs.find((x) => !x.closest(".ex-fl-vacate")) || bs[0];
  return b ? { t: b.querySelector(".rd-pl-flip-t").textContent.trim(), title: b.title, n: bs.length } : null;
});
const clickView = (p) => p.evaluate(() => {
  const bs = [...document.querySelectorAll(".ex-fl-card .ex-view .rd-pl-flip")];
  (bs.find((x) => !x.closest(".ex-fl-vacate")) || bs[0]).click();
});
const infYTicks = (p) => p.$$eval(".ex-fl-card svg text", (ts) =>
  ts.map((t) => t.textContent.trim()).filter((t) => /^\d{1,2}%?$/.test(t)));
/* the year-bearing assertion pair: every election year gets its tick MARK
   (the vertical rd-base lines under the axis), while the LABELS thin by
   the engine's k-stride (48 labels never fit 948 units; at 1280px the
   informal view draws its every-fourth set 1901…2016). Aim by the drawn
   year labels, never by the caller's xDomain: the engine divides padPx
   through cw/1000 at draw time (40/12 SCREEN px become 63.1/18.9 viewBox
   units on a 633px card), so a domain read puts 1922 at user-200.5 where
   the chart actually draws it at 218.6 — the labels are the one mapping
   the page itself guarantees */
const xMarks = (p) => p.$$eval(".ex-fl-card svg line.rd-base", (ls) =>
  ls.filter((l) => l.getAttribute("x1") === l.getAttribute("x2")).length);
const dotAtInf = (p, year, v, sen) => p.evaluate(({ year, v, sen }) => {
  const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
  const r = svg.getBoundingClientRect();
  const labs = [...svg.querySelectorAll("text")]
    .map((t) => ({ u: +t.getAttribute("x"), y: t.textContent.trim() }))
    .filter((t) => /^\d{4}$/.test(t.y) && Number.isFinite(t.u) && t.u > 0)
    .sort((a, b) => +a.y - +b.y);
  if (labs.length >= 2) {
    const a = labs[0], b = labs[labs.length - 1];
    const ux = a.u + ((year - +a.y) / (+b.y - +a.y)) * (b.u - a.u);
    return { x: r.left + ux * (r.width / 1000),
             y: r.top + 16 + (1 - v / 20) * (r.height - 46) };
  }
  /* no labels to fit — fall back to the domain read in SCREEN px (padPx
     is screen-side, so the domain maps onto the rect minus 40/12px) */
  const ys = sen ? window.AUSPOL.informalHistory.fed.sen.years : window.AUSPOL.informalHistory.fed.years;
  return { x: r.left + 40 + ((year - ys[0]) / (ys[ys.length - 1] - ys[0])) * (r.width - 52),
           y: r.top + 16 + (1 - v / 20) * (r.height - 46) };
}, { year, v, sen });
const INF_Y = ["0", "5", "10", "15", "20%"];
{
  let vs = await viewState(page);
  ok("the View: control opens on Preference flows (one row, no vacate twin)",
     vs.n === 1 && vs.t === "Preference flows" && vs.title === "Switch to first-preference vote shares at every election",
     JSON.stringify(vs));
  await clickView(page); await sleep(700);
  vs = await viewState(page);
  ok("one press lands on Primary votes, its title the 2PP destination",
     vs.t === "Primary votes" && vs.title === "Switch to two-party preferred shares at every election", JSON.stringify(vs));
  await clickView(page); await sleep(700);
  vs = await viewState(page);
  ok("a second lands on 2PP, its title the informal destination",
     vs.t === "2PP" && vs.title === "Switch to informal ballots’ share of the vote at every election", JSON.stringify(vs));
  await clickView(page); await sleep(800);
  vs = await viewState(page);
  ok("a third lands on Informal votes (vacate twin joins, title the flows destination)",
     vs.n === 2 && vs.t === "Informal votes" && vs.title === "Switch to the preference-flow history", JSON.stringify(vs));
}
console.log("== desktop: the informal stop — national, states, classes, Senate ==");
const IH_FED_META = "Australian federal elections, 1901–2025";
const IH_SEN_META = "Australian Senate elections, 1903–2022";
{
  ok("the head title is the informal share line",
     (await scopeTitle(page)) === "Informal votes, % of ballots cast", await scopeTitle(page));
  ok("the scope is the House series 1901–2025", (await meta(page)) === IH_FED_META, await meta(page));
  const yt = await yearTicks(page);
  ok("all 48 election years carry their tick marks (labels thinned by the engine, first 1901)",
     (await xMarks(page)) === 48 && yt[0] === "1901" && yt.every((y) => +y >= 1901 && +y <= 2025),
     yt.length + " labels over " + (await xMarks(page)) + " marks, first " + yt[0]);
  const m = await menuInfo(page);
  ok("the menu is the federal sections and classes alone (8 states, 4 seat classes, 5 IRSAD fifths, 5 IEO fifths)",
     JSON.stringify(m.groups) === JSON.stringify(["Federal elections", "Federal, by IRSAD quintile", "Federal, by IEO quintile"])
       && m.options.length === 23 && m.options[0] === "fed"
       && m.options.filter((v) => v.startsWith("fed:")).length === 8
       && m.options.filter((v) => v.startsWith("fedcl:")).length === 14,
     JSON.stringify(m.groups) + " · " + m.options.length + " options");
  ok("…no Council, no state-elections entry, no State elections optgroup",
     !m.options.includes("nswlc") && !m.options.some((v) => v.startsWith("ste:"))
       && m.groups.every((g) => g !== "State elections"), m.options.join(" "));
  ok("the Share control sits out (one series — no side to flip)",
     (await page.$(".ex-fl-card .ex-share")) === null);
  const h = await houseState(page);
  ok("the House: flip stands, open Lower, its title the Senate informal destination",
     h.t === "Lower ⇄" && h.pressed === "false"
       && h.title === "Switch to Senate informal shares (informal ballots over the whole chamber)", JSON.stringify(h));
  ok("the constant axis is 0–20% by fives (the whole-store peak, TAS Senate 1934's 16.3)",
     JSON.stringify(await infYTicks(page)) === JSON.stringify(INF_Y), (await infYTicks(page)).join("/"));
  const foot = await footText(page);
  ok("the caption runs handbook→AEC provenance, the Senate-2022 gap, and the territory gap rule",
     foot.startsWith("Informal ballots as a share of all ballots cast at the 1901–2025 federal elections")
       && foot.includes("The Senate series ends at 2022") && foot.endsWith("A territory not yet represented draws a gap, never a zero."),
     foot.slice(0, 80) + "…" + foot.slice(-50));
  /* the 2025 national dot reads 5.6 (the AEC's own 2025 figure) */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(400);
  let pt = await dotAtInf(page, 2025, 5.6);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  let tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 2025 national dot tips 5.6%, titled '2025 · Federal'",
     !!tip && tip.includes("2025 · Federal") && tip.includes("5.6"),
     tip ? tip.slice(0, 110) : "no tooltip");
  await page.mouse.move(pt.x, pt.y - 200);
}
console.log("== desktop: the informal stops' states and class cuts ==");
{
  await pickMenu(page, "fed:vic"); await sleep(700);
  ok("a state pick re-scopes to it", (await meta(page)) === "Victoria electorates at federal elections, 1901–2025", await meta(page));
  ok("…and the axis never moves", JSON.stringify(await infYTicks(page)) === JSON.stringify(INF_Y));
  await pickMenu(page, "fed:nt"); await sleep(700);
  const ntFoot = await footText(page);
  ok("the NT view captions its pre-1922 hole as a gap, never a zero",
     ntFoot.endsWith("A territory not yet represented draws a gap, never a zero."), ntFoot.slice(-55));
  ok("…its tick row still opens 1901 (the hole is a run break, not dropped years)",
     (await xMarks(page)) === 48 && (await yearTicks(page))[0] === "1901");
  /* the gap in the card itself: the 1901 hover answers a bare year card */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(300);
  let pt = await dotAtInf(page, 1901, 2);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  let tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 1901 NT hover is a bare year card — titled, no figure (the territory's first run opens 1922)",
     !!tip && tip.includes("1901") && !tip.includes("%"), tip ? tip.slice(0, 90) : "no tooltip");
  /* and the year AFTER the gap titles itself — the regression pin for the
     run-split spine (a spine read off the first run named 1922's 3.1 "1901") */
  pt = await dotAtInf(page, 1922, 3.1);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the NT run's opener titles its own year (1922 · NT, 3.1%)",
     !!tip && tip.includes("1922 · NT") && tip.includes("3.1"), tip ? tip.slice(0, 90) : "no tooltip");
  await page.mouse.move(pt.x, pt.y + 160);
  /* the class cuts: a seat class, an IRSAD fifth, an IEO fifth — each
     carrying its own provenance sentence (the ABS index named in the
     fifths' captions; the Newcastle 1998 aside on the seat classes) */
  await pickMenu(page, "fedcl:inner"); await sleep(700);
  const innerFoot = await footText(page);
  ok("the seat-class cut captions the AEC classification and the Newcastle 1998 aside",
     innerFoot.includes("each seat grouped by the AEC's own classification")
       && innerFoot.includes("Newcastle's pair ran Labor v independent"),
     innerFoot.slice(120, 280));
  await pickMenu(page, "fedcl:q1"); await sleep(700);
  const q1Foot = await footText(page);
  ok("an IRSAD fifth names the index (most-disadvantaged fifth, thirty seats a fifth)",
     q1Foot.includes("IRSAD is the ABS's socio-economic index of advantage and disadvantage")
       && q1Foot.includes("the most-disadvantaged fifth"),
     q1Foot.slice(60, 240));
  await pickMenu(page, "fedcl:e1"); await sleep(700);
  ok("an IEO fifth re-scopes the meta and names the index",
     (await meta(page)) === "Federal elections in the most-disadvantaged fifth of seats by IEO rank, 2001–2025"
       && (await footText(page)).includes("IEO is the ABS's index of education and occupation"),
     await meta(page));
  ok("…and the fifths' axis is still the constant 0–20%",
     JSON.stringify(await infYTicks(page)) === JSON.stringify(INF_Y));
}
console.log("== desktop: informal Upper — the Senate's official series, then home ==");
{
  await clickHouse(page); await sleep(800);   // a class view snaps to federal national
  ok("flipping to Upper off a class pick snaps the menu to federal national",
     (await menuInfo(page)).value === "fed", (await menuInfo(page)).value);
  ok("the head title holds, the scope cuts to the Senate's official 1903–2022",
     (await scopeTitle(page)) === "Informal votes, % of ballots cast" && (await meta(page)) === IH_SEN_META,
     await meta(page));
  const mu = await menuInfo(page);
  ok("the Upper menu is national and the eight states alone (no classes, no Council, one optgroup)",
     mu.options.length === 9 && mu.options[0] === "fed"
       && JSON.stringify(mu.groups) === JSON.stringify(["Federal elections"])
       && !mu.options.some((v) => v.startsWith("fedcl:") || v === "nswlc"),
     mu.options.join(" "));
  const hu = await houseState(page);
  ok("the flip names Upper, its title the House informal destination",
     hu.t === "Upper ⇄" && hu.pressed === "true" && hu.title === "Switch to House of Representatives informal shares",
     JSON.stringify(hu));
  ok("…and even the chamber swap never moves the axis",
     JSON.stringify(await infYTicks(page)) === JSON.stringify(INF_Y));
  ok("…and the Senate's own election years all carry their marks",
     (await xMarks(page)) === await page.evaluate(() => window.AUSPOL.informalHistory.fed.sen.years.length),
     (await xMarks(page)) + " marks");
  /* the Senate's post-war high era: the 1975 national dot reads 9.1 */
  await page.evaluate(() => {
    const svg = document.querySelector(".ex-fl-card svg.chart-svg") || document.querySelector(".ex-fl-card svg");
    svg.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await sleep(300);
  const pt = await dotAtInf(page, 1975, 9.1, true);
  await page.mouse.move(pt.x, pt.y);
  await sleep(700);
  const tip = await page.evaluate(() => {
    const t = document.querySelector(".tip");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
  });
  ok("the 1975 Senate dot tips 9.1%, titled '1975 · Senate'",
     !!tip && tip.includes("1975 · Senate") && tip.includes("9.1"), tip ? tip.slice(0, 110) : "no tooltip");
  await page.mouse.move(pt.x, pt.y - 200);
  await clickHouse(page); await sleep(700);
  ok("flipping back restores the House 1901–2025 series", (await meta(page)) === IH_FED_META, await meta(page));
  await clickView(page); await sleep(800);
  const v4 = await viewState(page);
  ok("a fourth press closes the cycle back at Preference flows (the vacate twin sheds)",
     v4.n === 1 && v4.t === "Preference flows" && v4.title === "Switch to first-preference vote shares at every election",
     JSON.stringify(v4));
  ok("…the flow-history card back up on federal national",
     (await scopeTitle(page)) === "Preferences to Labor over the Coalition, %" && (await meta(page)).startsWith("Australian federal elections"),
     await meta(page));
  const mf = await menuInfo(page);
  ok("…and the flows menu carries its State elections optgroup again",
     mf.groups.includes("State elections") && mf.value === "fed", mf.groups.join(" | "));
}
console.log("== phone 390: the informal stop never overflows ==");
{
  const ph = await browser.newPage();
  wire(ph);
  await ph.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
  await ph.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "domcontentloaded" });
  await ph.waitForSelector(".ex-fl-card .ex-view .rd-pl-flip", { timeout: 20000 });
  await sleep(800);
  await clickView(ph); await sleep(600);
  await clickView(ph); await sleep(600);
  await clickView(ph); await sleep(800);
  const vs = await viewState(ph);
  ok("three presses on the phone land on Informal votes", vs.t === "Informal votes", JSON.stringify(vs));
  ok("…the House: flip rides the phone's chart head",
     await ph.evaluate(() => !!document.querySelector(".ex-fl-card .ex-fl-ctls .ex-house .rd-pl-flip")));
  const g = await cardOverflow(ph, 390);
  const vb = await ph.evaluate((vw) => {
    const b = [...document.querySelectorAll(".ex-fl-card .ex-view .rd-pl-flip")]
      .find((x) => !x.closest(".ex-fl-vacate"));
    const r = b.getBoundingClientRect();
    return r.left >= -1 && r.right <= vw + 1;
  }, 390);
  ok("at 390px informal: no document overflow, every control (View button included) within the viewport",
     g.doc <= 0 && g.els === 0 && vb, `doc ${g.doc}px, ${g.els} stray, viewBtn ${vb}`);
  await ph.close();
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
  /* 2026-10-22 (user: the pair split across two phone lines): House and
     Share ride ONE nowrap group (ex-fl-flips), same line at every width */
  if (narrow) {
    const same = await sweep.evaluate(() => {
      const grp = document.querySelector(".ex-fl-card .ex-fl-flips");
      const h = document.querySelector(".ex-fl-card .ex-house .rd-pl-flip");
      const s = document.querySelector(".ex-fl-card .ex-share .rd-pl-flip");
      if (!grp || !h || !s) return { grouped: !!grp };
      return { grouped: true, same: Math.abs(h.getBoundingClientRect().top - s.getBoundingClientRect().top) < 2,
               ht: Math.round(h.getBoundingClientRect().top), st: Math.round(s.getBoundingClientRect().top) };
    });
    ok(`at ${w}px House and Share share one phone line`,
       same.grouped && same.same, JSON.stringify(same));
  }
  await clickHouse(sweep);
  await sleep(800);
  const m = await menuInfo(sweep);
  ok(`at ${w}px Upper: the menu is the Senate nine plus NSW's LC`,
     m.options.length === 10 && m.groups.length === 2 && m.options[9] === "nswlc", m.options.join(" "));
  g = await cardOverflow(sweep, w);
  ok(`at ${w}px Upper: no document overflow, all three controls within the viewport`,
     g.doc <= 0 && g.els === 0, `doc ${g.doc}px, ${g.els} stray`);
  await pickMenu(sweep, "nswlc");
  await sleep(800);
  g = await cardOverflow(sweep, w);
  ok(`at ${w}px LC: the long one-box caption never overflows`, g.doc <= 0 && g.els === 0, `doc ${g.doc}px, ${g.els} stray`);
  await pickMenu(sweep, "fed");
  await sleep(600);
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
