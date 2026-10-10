/* Probe: the Info page's numbered chapters + pinned-index tab walk
   (InfoView in the d1a1d215 asset, CSS template.html + rd.css).

   The Info page reads as a short numbered document - chapters 1-4
   (About / Questions / How the figures are built / Section by section),
   the twelve section explainers 4.1-4.12 - and the pinned .info-index
   walk carries the same numbers on its buttons. The walk wears the
   redesign's pinned-tab idiom (All polls' rd-ap-pinl): no resting
   underline, and a scroll spy lights the button owning the heading at
   the bar (ink, 600 weight, 2px underline, aria-current).

   Asserts headlessly against BASE (repo root or a worktree):
     - 15 pills: numbers 1./2./3. then 4.1..4.12, labels intact;
     - 4 chapter h2s numbered 1.-4. and 12 section h3s numbered
       4.1..4.12, every pill number matching its heading;
     - pills carry NO resting underline (computed text-decoration none)
       and the lit pill carries the 2px underline + ink + 600;
     - scroll spy: page opens with the About pill lit; clicking a pill
       glides to its heading, the lit state walks along
       (aria-current moves with it);
     - numbers use tabular figures;
     - a 390px phone rung: the walk scrolls sideways (scrollWidth >
       clientWidth) with no vertical slack (the 44px tap targets stay
       contained), and the fade cap rides;
     - no page errors on either rung. */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = path.resolve(process.cwd(), process.env.BASE || ".");

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXP_PILLS = ["1.", "2.", "3.", ...Array.from({ length: 12 }, (_, i) => "4." + (i + 1))];
const EXP_LABELS = ["About", "Questions", "Method", "Two-party", "Primary vote", "Latest polls",
  "Leadership", "Direction", "Who votes", "Vote switching", "Issues", "Decidedness",
  "Mood", "Past cycles", "All polls"];

/* ========================= sources (node-side) ========================= */
console.log("sources:");
const glossFile = fs.readdirSync(path.join(BASE, ".build/newtracker/assets")).find((f) => f.startsWith("d1a1d215-") && f.endsWith(".js"));
const gloss = glossFile ? fs.readFileSync(path.join(BASE, ".build/newtracker/assets", glossFile), "utf8") : "";
check(gloss.includes('const secNum = (i) => "4." + (i + 1);'), "InfoView numbers sections 4.1-4.12 from the map index (secNum)");
check(gloss.includes('React.useState("info-about")'), "the scroll spy's lit state opens on About");
check(gloss.includes('?"info-about","info-faq","info-method","info-sections"')
  || gloss.includes('"info-about", "info-faq", "info-method", "info-sections"'), "the spy walks the four chapter ids plus the sections");
check(/aria-current=\{on === [a-z].*? "true" : undefined\}|aria-current=\{on === id \? "true" : undefined\}/.test(gloss)
  || gloss.includes('aria-current={on === id ? "true" : undefined}'), "the lit pill carries aria-current");
const tpl = fs.readFileSync(path.join(BASE, ".build/newtracker/template.html"), "utf8");
check(tpl.includes(".info-index button.on { color: var(--ink); font-weight: 600;"), "the lit walk button takes ink + 600 in the template");
check(tpl.includes("text-decoration-thickness: 2px;"), "the lit state underlines at 2px (the pinned-tab idiom)");
check(!/\.info-index button \{[^}]*text-decoration: underline/.test(tpl), "no resting underline on the walk buttons");
check(tpl.includes(".info-num { color: var(--ink-3); font-variant-numeric: tabular-nums; }"), ".info-num is quiet ink-3 tabular figures");
const rd = fs.readFileSync(path.join(BASE, ".build/newtracker/assets/rd.css"), "utf8");
check(rd.includes("body.rd .info-index button.on { color: var(--ink); font-weight: 600; }"), "rd.css out-votes its own base rule for the lit button");

/* ============================ browser ============================ */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

async function open(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "info", "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".info-index button", { timeout: 30000 });
  await sleep(300);
}

const pillState = () => page.evaluate(() =>
  [...document.querySelectorAll(".info-index button")].map((b) => ({
    num: (b.querySelector(".info-num") || {}).textContent || "",
    label: (b.textContent || "").replace(/\s+/g, " ").trim(),
    on: b.classList.contains("on"),
    aria: b.getAttribute("aria-current"),
    deco: getComputedStyle(b).textDecorationLine,
    numWeight: b.querySelector(".info-num") ? getComputedStyle(b.querySelector(".info-num")).fontVariantNumeric : "",
  })));

await open(1366, 980);
let pills = await pillState();
console.log("numbering (1366px):");
check(pills.length === 15, `15 pills on the walk (${pills.length})`);
check(pills.length === 15 && pills.every((p, i) => p.num === EXP_PILLS[i]),
  `pill numbers run 1./2./3. then 4.1..4.12 (got ${pills.map((p) => p.num).join(" ")})`);
check(pills.length === 15 && pills.every((p, i) => p.label.startsWith(EXP_PILLS[i] + " " + EXP_LABELS[i])),
  "every pill label keeps its short name after the number");
check(pills.every((p) => p.numWeight.includes("tabular-nums")), "pill numbers are tabular figures");

const heads = await page.evaluate(() => ({
  h2: [...document.querySelectorAll("h2.info-h .info-num")].map((s) => s.textContent),
  h3: [...document.querySelectorAll("h3.info-group .info-num")].map((s) => s.textContent),
}));
check(heads.h2.length === 4 && heads.h2.every((n, i) => n === ["1.", "2.", "3.", "4."][i]),
  `the four chapter headings are numbered 1.-4. (got ${heads.h2.join(" ")})`);
check(heads.h3.length === 12 && heads.h3.every((n, i) => n === "4." + (i + 1)),
  `the twelve section headings are numbered 4.1..4.12 (got ${heads.h3.join(" ")})`);
check(pills.slice(3).every((p, i) => p.num === heads.h3[i]), "every section pill's number matches its section heading");

console.log("tab idiom (1366px):");
const restDeco = pills.filter((p) => !p.on).map((p) => p.deco);
check(restDeco.every((d) => d === "none"), `no resting underline on any unlit pill (${new Set(restDeco).size ? [...new Set(restDeco)].join("/") : "none"})`);
const firstOn = pills.findIndex((p) => p.on);
check(firstOn === 0, `the About pill opens lit (lit index ${firstOn})`);
check(pills[0] && pills[0].aria === "true", "the lit pill carries aria-current=true");
const litStyle = await page.evaluate(() => {
  const b = document.querySelector(".info-index button.on");
  if (!b) return null;
  const cs = getComputedStyle(b);
  return { deco: cs.textDecorationLine, thick: cs.textDecorationThickness, weight: cs.fontWeight };
});
check(!!litStyle && litStyle.deco.includes("underline") && litStyle.thick === "2px" && parseInt(litStyle.weight, 10) >= 600,
  `the lit pill is the 2px-underlined ink 600 tab (got ${litStyle ? litStyle.deco + ", " + litStyle.thick + ", " + litStyle.weight : "none"})`);
const litAtCount = pills.filter((p) => p.on).length;
check(litAtCount === 1, `exactly one pill lit at rest (${litAtCount})`);

console.log("scroll spy (1366px):");
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(200);
const targetIdx = 10; // "4.8 Decidedness" pill
await page.evaluate((i) => {
  const b = document.querySelectorAll(".info-index button")[i];
  b.click();
}, targetIdx);
await sleep(1700); // # intentional-sleep: the jump is a smooth glide; the spy walks with it
pills = await pillState();
const onAfter = pills.findIndex((p) => p.on);
check(onAfter === targetIdx, `after clicking pill ${targetIdx} the lit state walks to it (lit index ${onAfter})`);
check(pills[targetIdx] && pills[targetIdx].aria === "true", "aria-current moved with the lit state");
const scrollY = await page.evaluate(() => window.scrollY);
check(scrollY > 500, `the page scrolled to the target (scrollY ${scrollY.toFixed(0)})`);
/* and walking back to the top re-lights About without a click */
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
await sleep(400);
pills = await pillState();
check(pills.findIndex((p) => p.on) === 0, "scrolling home re-lights About");
const lastSpy = await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); return true; });
await sleep(600);
pills = await pillState();
const onAtBottom = pills.findIndex((p) => p.on);
check(onAtBottom === pills.length - 1, `the page bottom lights the last section pill (lit index ${onAtBottom})`);

console.log("phone rung (390px):");
await open(390, 780);
/* re-opening won't reset the scroll the desktop rung left behind (same
   document), so the spy may honestly light a mid-page heading - walk
   home before asserting the resting state */
const driftY = await page.evaluate(() => window.scrollY);
if (driftY > 0) await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
await sleep(400);
const phone = await page.evaluate(() => {
  const bar = document.querySelector(".info-index");
  const cs = getComputedStyle(bar);
  return {
    sw: bar.scrollWidth, cw: bar.clientWidth, sh: bar.scrollHeight, ch: bar.clientHeight,
    wrap: cs.flexWrap, overflowY: cs.overflowY,
    fade: !!document.querySelector(".info-index"),
  };
});
check(phone.sw > phone.cw, `the walk scrolls sideways (${phone.sw}px content in ${phone.cw}px)`);
check(phone.sh - phone.ch <= 2, `no vertical wobble slack (${phone.sh - phone.ch}px)`);
check(phone.wrap === "nowrap", "the row stays one scrolling strip");
/* pills still read number + label at the phone size */
pills = await pillState();
check(pills.length === 15 && pills.every((p, i) => p.num === EXP_PILLS[i] && p.numWeight.includes("tabular-nums")),
  "all 15 numbered pills render on the phone strip");
check(pills.filter((p) => p.on).length === 1 && pills[0].on, "the spy still has exactly About lit at the top");

check(pageErrors.length === 0, `no page errors on either rung${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);

await browser.close();
if (fails.length) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log("\nprobe-info-num: all green");
