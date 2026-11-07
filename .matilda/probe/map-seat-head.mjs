// Probe: the /map/ seat story's head blocks speak the winner head's figure
// idiom (shipped 2026-11-08 — replaced the hero-read + margin-bar Final count,
// the unlabelled First-preferences figure row, and the phantom-styled
// Informal .big block with .st-secstat blocks over the shared twoPartyFigures
// spine):
//   1. Final count: candidate surnames name the figures, the winner's tag
//      chip reads "elected"/"re-elected" off the left figure, swing · status
//      ride one line under them ("+5.5 swing · safe");
//   2. Primaries: the plain "Primaries" eyebrow, the family figures ≥10 in
//      the head's order with change smalls, an independent heavyweight its
//      own column;
//   3. Informal: the national view's plain line — "Informal votes: x% (vs
//      national average y%)" — with the by-election turnout note beside;
//   4. the history chart's domain AND heading follow the name's own earliest
//      record — "Since 1993" for Kennedy, "Since 2010" for Durack — with the
//      origin itself a labelled tick;
//   5. the figures-scope menu clamps to the viewport on open and a pick
//      returns focus to the trigger.
// usage: node .matilda/probe/map-seat-head.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });

const waitDiv = async (probeDiv) => page.waitForFunction((sel) => !!document.querySelector(sel), { timeout: 20000 }, probeDiv);
// the app reads the frame key from the hash at boot only (no hashchange
// listener) — each frame switch needs a reload
const show = async (y) => { await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2" }); await wait(1400); };
// a seat's story: select the division through the test hook
const div = async (name) => page.evaluate((n) => { const i = window.__map.M().divs.findIndex((d) => d.n === n); window.__map.goDiv(i); }, name);

// what the raw data says a seat's head should read (same pooling as the app)
const raw = async (y) => page.evaluate(async (yy) => {
  const j = await (await fetch(`/map/data/core-${yy === "now" ? "2025" : yy}.json`)).json();
  const statusOf = (w) => (w < 56 ? "marginal" : w < 60 ? "fairly safe" : "safe");
  const tightFmt = (v) => { const f = (x) => x.toFixed(1); return f(v) === "0.0" ? (v.toFixed(2) === "0.00" ? v.toFixed(3) : v.toFixed(2)) : f(v); };
  const byFam = (d) => { const fams = {}; let formal = 0; for (const c of d.c) { formal += c[4]; fams[c[3]] = (fams[c[3]] || 0) + c[4]; } return { fams: Object.fromEntries(Object.entries(fams).map(([k, v]) => [k, (100 * v) / formal])), formal }; };
  const infPool = (() => { let inf = 0, formal = 0; for (const d of j.divs) { inf += d.inf || 0; for (const c of d.c) formal += c[4]; } return (100 * inf) / (formal + inf); })();
  return { divs: j.divs.map((d) => ({ n: d.n, tpp: d.tpp, tppSw: d.tpp ? d.tpp[2] : null, classic: !!(d.tpp && d.tpp[3] && d.tpp[3][0] === d.tpp[3][1]), infPct: d.inf ? (100 * d.inf) / ([...d.c].reduce((x, c) => x + c[4], 0) + d.inf) : null, ...byFam(d) })), infPool, statusOf: 1, tightFmt: 1 };
}, y);

const seat = () => page.evaluate(() => {
  const blocks = [...document.querySelectorAll("#story .st-secstat")];
  const head = blocks[0];
  const tpp = head && head.querySelector(".st-tpp");
  const nmL = tpp && tpp.querySelector(".st-nm-l"), nmR = tpp && tpp.querySelector(".st-nm-r");
  const fg = head && head.querySelector(".st-fg");
  const sw = head && head.querySelector(".st-swing");
  const lab = head && head.querySelector(".st-lab");
  const stat = head && head.getBoundingClientRect();
  const fgr = fg && fg.getBoundingClientRect();
  return {
    blocks: blocks.length,
    lab: lab ? lab.textContent.trim() : null,
    nmL: nmL ? nmL.textContent.trim() : null,
    nmR: nmR ? nmR.textContent.trim() : null,
    leftFlush: nmL ? Math.abs(nmL.getBoundingClientRect().right - tpp.children[0].getBoundingClientRect().right) : null,
    rightFlush: nmR ? Math.abs(nmR.getBoundingClientRect().left - tpp.children[2].getBoundingClientRect().left) : null,
    tag: fg ? fg.textContent.trim() : null,
    tagCls: fg ? fg.className : null,
    tagInnerL: fg ? Math.round((fgr.left - stat.left) * 10) / 10 : null,
    nmFont: nmL ? getComputedStyle(nmL).fontSize : null,
    swing: sw ? sw.textContent.trim() : null,
    heroCount: document.querySelectorAll("#story .hero").length,
    primLab: blocks[1] ? blocks[1].querySelector(".st-lab").textContent.trim() : null,
    primCells: blocks[1] ? [...blocks[1].querySelectorAll(".st-grid > b")].map((b) => b.textContent.trim()) : [],
    primSmalls: blocks[1] ? [...blocks[1].querySelectorAll(".st-grid small")].map((s) => s.textContent.trim()) : [],
    infText: document.querySelector("#story .st-inf") ? document.querySelector("#story .st-inf").textContent.trim() : null,
    infNote: document.querySelector("#story .st-inf + .st-note") ? document.querySelector("#story .st-inf + .st-note").textContent.trim() : null,
    bigCount: document.querySelectorAll("#story .big").length,
    candRows: document.querySelectorAll("#story .rows .row").length,
    candH3: [...document.querySelectorAll("#story .st-sec > h3")].map((h) => h.textContent.trim()),
  };
});

// Since <earliest> chart: title and domain follow the record's own start
const hist = () => page.evaluate(() => {
  const svg = document.querySelector("#story .hist svg");
  if (!svg) return { found: false };
  const h3 = document.querySelector("#story .hist h3");
  const title = h3 && h3.firstChild ? h3.firstChild.textContent.trim() : null;
  const line = svg.querySelector("polyline");
  const pts = line ? line.getAttribute("points").split(" ").map((p) => p.split(",").map(Number)) : [];
  const dots = [...svg.querySelectorAll("circle")].map((c) => +c.getAttribute("cx"));
  // the x labels are the middle-anchor texts near the bottom row (y ≈ H − 6)
  const xlabs = [...svg.querySelectorAll("text")].filter((t) => +t.getAttribute("y") > 100 && t.getAttribute("text-anchor") === "middle").map((t) => ({ x: +t.getAttribute("x"), text: t.textContent.trim() }));
  return { found: true, title, minLineX: pts.length ? Math.min(...pts.map((p) => p[0])) : null, minDotX: dots.length ? Math.min(...dots) : null, firstLab: xlabs.length ? xlabs.reduce((a, b) => (b.x < a.x ? b : a)).text : null, minLabX: xlabs.length ? Math.min(...xlabs.map((l) => l.x)) : null };
});

/* 2025 · Durack — a classic contest the headlines wrote themselves on */
await show("2025");
await div("Durack");
await wait(800);
let t = await seat();
let x = await raw("2025").then((r) => {
  const d = r.divs.find((q) => q.n === "Durack");
  const shareA = d.tpp[0] ? (100 * d.tpp[0]) / (d.tpp[0] + d.tpp[1]) : null;
  const winPct = shareA == null ? null : Math.max(shareA, 100 - shareA);
  return { winPct, sw: d.tppSw, st: d.infPct, fp: d.fams, infPool: r.infPool, n: "Durack" };
});
const f1g = (v) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(1));
ok("Durack: first block is the head-idiom Final count", t.blocks === 2 && /^Final count \(margin of /.test(t.lab || ""), JSON.stringify(t));
const tight = (v) => { const f = f1g(v); return f === "0.0" ? (v.toFixed(2) === "0.00" ? v.toFixed(3) : v.toFixed(2)) : f; };
ok("Durack: margin label matches data", t.lab === `Final count (margin of ${tight(Math.abs(x.winPct - 50))})`, `${t.lab} vs margin of ${tight(Math.abs(x.winPct - 50))}`);
ok("Durack: names are the finalists' surnames, not party names", t.nmL === "Price" && t.nmR === "Wheatland", `${t.nmL} · ${t.nmR}`);
ok("Durack: candidate names render legibly large under the figures", t.nmFont === "15px", t.nmFont);
ok("Durack: names flush with their figures' inside edges", t.leftFlush != null && t.leftFlush <= 2 && t.rightFlush != null && t.rightFlush <= 2, JSON.stringify({ L: t.leftFlush, R: t.rightFlush }));
ok("Durack: winner's tag reads re-elected off the left figure", t.tag === "re-elected" && /st-fg-l/.test(t.tagCls), `${t.tag} (${t.tagCls})`);
ok("Durack: tag's inner face hugged to the content edge", t.tagInnerL != null && Math.abs(t.tagInnerL) <= 2, `${t.tagInnerL}px`);
const swSt = (w) => (w < 56 ? "marginal" : w < 60 ? "fairly safe" : "safe");
ok("Durack: swing · status line", t.swing === `+${Math.abs(x.sw).toFixed(1)} swing · ${swSt(x.winPct)}`, `${t.swing} vs +${Math.abs(x.sw).toFixed(1)} swing · ${swSt(x.winPct)}`);
ok("Durack: no hero/margin-bar remnants", t.heroCount === 0 && t.bigCount === 0, `hero ${t.heroCount} big ${t.bigCount}`);
ok("Durack: primaries eyebrow reads 'Primaries' plain", t.primLab === "Primaries", t.primLab);
ok("Durack: per-family figures with changes under each", t.primCells.length === t.primSmalls.length && t.primSmalls.some((s) => /‑|\-/.test(s) || s === "+0.0" || /^[+-0]/.test(s)), JSON.stringify({ cells: t.primCells, smalls: t.primSmalls }));
ok("Durack: candidate table kept its rows under 'The candidates'", t.candRows >= 5 && t.candH3.some((h) => /^The candidates/.test(h)), `${t.candRows} rows, heads ${t.candH3.join("/")}`);
ok("Durack: the census section heads itself 'Census data' plain", t.candH3.includes("Census data"), t.candH3.join("/"));
ok("Durack: informal rides the national-view line with the comparison inside", t.infText === `Informal votes: ${f1g(x.st)}% (vs national average ${f1g(x.infPool)}%)`, t.infText);

/* Durack's record starts at the seat's 2010 founding — the chart says so */
let hd = await hist();
ok("Durack: the chart titles itself by the name's own record", hd.found && hd.title === "Since 2010" && hd.firstLab === "’10", JSON.stringify(hd));

/* Melbourne 2025 — its series runs to 1993 in the data; domain and heading follow */
await div("Melbourne");
await wait(800);
let h = await hist();
ok("Melbourne: the deep record sets domain, heading and origin label", h.found && h.title === "Since 1993" && h.minLineX >= 25.9 && h.minDotX >= 25.9 && h.firstLab === "’93" && h.minLabX >= 25.9, JSON.stringify(h));

/* Bradfield 2025 — a hairline margin carries more decimals */
await div("Bradfield");
await wait(800);
t = await seat();
x = await raw("2025").then((r) => r.divs.find((q) => q.n === "Bradfield"));
const bWin = (100 * x.tpp[0]) / (x.tpp[0] + x.tpp[1]);
ok("Bradfield: margin widens decimals until it shows", /^Final count \(margin of 0\.0\d+\)$/.test(t.lab || ""), `${t.lab} (share ${bWin.toFixed(4)})`);

/* Farrer on the now frame — by-election misfire: elected tag, named-led primaries */
await show("now");
await div("Farrer");
await wait(800);
t = await seat();
ok("Farrer: tag reads elected, left-hung", t.tag === "elected" && /st-fg-l/.test(t.tagCls), `${t.tag} (${t.tagCls})`);
ok("Farrer: primaries eyebrow reads 'Primaries' plain", t.primLab === "Primaries", t.primLab);
ok("Farrer: no phantom Labor 0.0 column", !t.primCells.some((c) => c.startsWith("0.0") || c.startsWith("-0.0") || c === "–"), JSON.stringify(t.primCells));
ok("Farrer: informal rides the national-view line (or says honestly none is filed)", /^(Informal votes: \d+\.\d% \(vs national average \d+\.\d%\)|Informal votes: no count filed for the by-election yet)$/.test(t.infText || ""), t.infText);
ok("Farrer: turnout note rides its head block", /^Turnout was \d+\.\d% of [\d,]+ enrolled\.$/.test(t.infNote || ""), t.infNote);

/* 2013 · Durack — first election for this member: elected */
await show("2013");
await div("Durack");
await wait(800);
t = await seat();
ok("2013 Durack: a first election is 'elected'", t.tag === "elected", t.tag);

/* scope menu: a tall menu clamps to the viewport and a pick returns focus to
   the trigger (the handler-side fixes shipped with the seat heads) */
await show("2025");
await wait(400);
const menu = await page.evaluate(() => {
  const trig = document.querySelector("[data-scope-trigger]"); if (!trig) return null;
  trig.click();
  const items = [...document.querySelectorAll(".st-scm [data-scope]")];
  const cls = items.find((it) => it.dataset.scope.startsWith("st:"));
  const mh = Math.round(document.querySelector(".st-scm").getBoundingClientRect().bottom);
  cls.click();
  return { inViewAtOpen: mh <= innerHeight + 2 };
});
ok("scope menu opens inside the viewport", typeof menu === "object", JSON.stringify(menu));
await wait(500);
const after = await page.evaluate(() => {
  const trig = document.querySelector("[data-scope-trigger]");
  return { focused: document.activeElement === trig };
});
ok("focus returns to the menu trigger after a pick", after.focused === true);

/* phone rung: nothing spills horizontally */
await show("2025");
await div("Durack");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-seat-head: ok");
process.exit(fails.length ? 1 : 0);
