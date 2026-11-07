// Probe: the /map/ Winner head's sections each close on a double rule —
// two hairlines, tightly spaced (one after the two-party block, one after
// Primaries, one closing the Seats block) — over the named-sides figures
// grid and the formed-govt tag, and across election and Now frames. The map
// reads the frame from the hash at BOOT ONLY: goto a frame, then reload.
// usage: node .matilda/probe/map-head-separators.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const kinds = () => page.evaluate(() => [...document.querySelector(".st-stat").children].map((x) => x.classList.contains("st-sep") ? "SEP" : x.classList.contains("st-lab") ? `LAB(${x.textContent.trim().split(/[ (]/)[0]})` : x.className.split(" ")[0].replace("st-", "")));
const frame = async (y) => { await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2", timeout: 60000 }); await wait(1200); };
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });

// election frame: figures+names grid (the tag rides inside it), swing, THEN the rule
await frame(2025);
let ks = await kinds();
ok("2025: three separators", ks.filter((k) => k === "SEP").length === 3, JSON.stringify(ks));
ok("2025: two-party block (lab, tpp, swing) closes on its rule", JSON.stringify(ks.slice(0, 5)) === JSON.stringify(["LAB(Two-party)", "tpp", "swing", "SEP", "LAB(Primaries)"]), JSON.stringify(ks.slice(0, 5)));
ok("2025: rule after the primary grid, before Seats", ks.some((k, i) => k === "SEP" && ks[i + 1] === "LAB(Seats)"), JSON.stringify(ks));
ok("2025: closing rule last, after Informal", ks.length > 1 && ks[ks.length - 1] === "SEP" && ks[ks.length - 2] === "LAB(Informal:)", JSON.stringify(ks.slice(-3)));

// the rule itself: two 1px hairlines, tightly spaced, full width of the head
const geom = await page.evaluate(() => {
  const head = document.querySelector(".st-stat");
  return [...head.querySelectorAll(".st-sep")].map((s) => {
    const cs = getComputedStyle(s), r = s.getBoundingClientRect(), hr = head.getBoundingClientRect();
    return { top: cs.borderTopWidth, bot: cs.borderBottomWidth, h: r.height, w: r.width, hw: hr.width };
  });
});
ok("every separator is two 1px lines", geom.every((g) => g.top === "1px" && g.bot === "1px"), JSON.stringify(geom.map((g) => [g.top, g.bot])));
ok("the two lines are tightly spaced (4px tall, 2px apart)", geom.every((g) => g.h === 4), JSON.stringify(geom.map((g) => g.h)));
ok("each separator spans the head's width", geom.every((g) => Math.abs(g.w - g.hw) < 1), JSON.stringify(geom.map((g) => `${g.w}/${g.hw}`)));

// a scope swap re-renders the head: still exactly three rules, no duplicates
await page.evaluate(() => {
  document.querySelector("[data-scope-trigger]").click();
  const it = [...document.querySelectorAll(".st-scm [data-scope]")].find((x) => x.dataset.scope.startsWith("cls:"));
  it.click();
});
await wait(400);
const seps2 = await page.evaluate(() => document.querySelectorAll(".st-stat > .st-sep").length);
ok("three separators after a scope change", seps2 === 3, `got ${seps2}`);

// the Now frame: no tag, no swing — the rule still closes the figures block
await frame("now");
ks = await kinds();
ok("now: no formed-govt tag", !ks.includes("fg"), JSON.stringify(ks.slice(0, 4)));
ok("now: three separators, first right after the figures", ks.filter((k) => k === "SEP").length === 3 && JSON.stringify(ks.slice(0, 3)) === JSON.stringify(["LAB(Two-party)", "tpp", "SEP"]), JSON.stringify(ks.slice(0, 6)));

// phone rung: rules don't add overflow
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-head-separators: ok");
process.exit(fails.length ? 1 : 0);
