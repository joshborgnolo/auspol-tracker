// Probe: the /map/ Winner head is ruled top and bottom, with a double rule
// between its sections — so every label in the head (Two-party, Primaries,
// Seats) sits just below one, tightly-spaced twin hairlines — across
// election and Now frames. The informal line left the head for below the
// How-votes-were-cast section 2026-11-07, so the head closes on Seats.
// The map reads the frame from the hash at BOOT ONLY: goto, then reload.
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
const labelsAboveRules = (ks) => ks.every((k, i) => !k.startsWith("LAB(") || ks[i - 1] === "SEP");

// election frame: crowned by a rule, three sections (labels Two-party,
// Primaries, Seats), ruled between, closed by a rule after Seats
await frame(2025);
let ks = await kinds();
ok("2025: four rules — crown, two dividers, close after Seats", ks.filter((k) => k === "SEP").length === 4, JSON.stringify(ks));
// (the seats lead every head since 2026-11-08 — user call: the seat figures first)
ok("2025: crown rule opens the head", ks[0] === "SEP" && ks[1] === "LAB(Seats)", JSON.stringify(ks.slice(0, 2)));
ok("2025: every label has a rule directly above it", labelsAboveRules(ks), JSON.stringify(ks));
ok("2025: closing rule last, after the Primaries section's final label of the head", ks[ks.length - 1] === "SEP" && /^LAB\(Primaries/.test([...ks].reverse().find((k) => k.startsWith("LAB("))), JSON.stringify(ks.slice(-4)));

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

// a filter re-renders the head (the strip's Seat type row): the framing holds, no duplicates
await page.evaluate(() => {
  document.querySelector('#type-filters [data-cls]:not([data-cls=""])').click();
});
await wait(400);
{
  const ks2 = await kinds();
  ok("four rules after a filter change", ks2.filter((k) => k === "SEP").length === 4, `got ${ks2.filter((k) => k === "SEP").length}`);
  ok("labels still ruled above after the filter change", labelsAboveRules(ks2), JSON.stringify(ks2));
  await page.evaluate(() => document.querySelector('#type-filters [data-cls=""]').click());
}

// the Now frame: no swing line, and its "govt" tag rides inside the figures
// grid — so the top-level crown and dividers stand the same
await frame("now");
ks = await kinds();
ok("now: no top-level govt tag (it nests in the grid)", !ks.includes("fg"), JSON.stringify(ks.slice(0, 5)));
ok("now: four rules, crown first", ks.filter((k) => k === "SEP").length === 4 && ks[0] === "SEP" && ks[1] === "LAB(Seats)", JSON.stringify(ks.slice(0, 4)));
ok("now: every label has a rule directly above it", labelsAboveRules(ks), JSON.stringify(ks));

// phone rung: rules don't add overflow
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-head-separators: ok");
process.exit(fails.length ? 1 : 0);
