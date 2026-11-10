// Probe: the story column's little chamber follows the lens — House chairs
// in the House lenses, the Senate floor's own 76 chairs (from the senators'
// deck AND its seating plan) under the Senate lens and the Preferences tab's
// Senate-ballot reading. Historically (2026-11-10, user report): it drew the
// House's 150 in the Senate lens; and (same day) an earlier attempt at this
// probe's living contract — drawing the senators' deck with no floor plan
// loaded — left a cleared, invisible canvas. Now: the Senate draws, and the
// House stands in every other lens. The mini-chamber is canvas-only output,
// so this samples its pixels: a blank draw counts a handful of transparent
// rows; a chamber counts thousands of opaque ones.
// usage: node .matilda/probe/map-minich-senate.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8791"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });

const shot = () => page.evaluate(() => {
  const c = document.querySelector("#minich");
  if (!c) return { found: false };
  const g = c.getContext("2d");
  const im = g.getImageData(0, 0, c.width, c.height).data;
  let opaque = 0;
  for (let p = 3; p < im.length; p += 4) if (im[p] > 10) opaque++;
  return { found: true, w: c.width, h: c.height, opaque, aria: c.getAttribute("aria-label") || "" };
});

// give the story time to render before sampling, then let decks settle between lens flips
const until = async (fn, ms = 15000, step = 150) => { const t0 = Date.now(); for (;;) { if (await fn()) return true; if (Date.now() - t0 > ms) return false; await wait(step); } };

await page.goto(`${base}/map/index.html`, { waitUntil: "domcontentloaded" });
await until(async () => page.evaluate(() => !!document.querySelector("#minich") && typeof window.__map?.setLens === "function"), 20000);
await wait(1500);
const winnerShot = await shot();
ok("the mini chamber exists in the winner lens and draws the House", winnerShot.found && winnerShot.opaque > 2000 && !winnerShot.aria.includes("Senate"), winnerShot.found ? `aria="${winnerShot.aria.slice(0, 30)}", opaque=${winnerShot.opaque}` : "no canvas");
ok("no page errors on the winner draw", errs.length === 0, errs[0] || "");

await page.evaluate(() => window.__map.setLens("senpref"));
const tillSenpref = await until(async () => page.evaluate(() => window.__map.S.lens === "senpref" && (document.querySelector("#minich")?.getAttribute("aria-label") || "").includes("Senate")), 30000);
await wait(600);
const spShot = await shot();
ok("the Preferences tab's Senate reading flips the little chamber to the Senate floor", tillSenpref && spShot.found && spShot.aria.includes("Senate"), spShot.found ? `aria="${spShot.aria.slice(0, 26)}", opaque=${spShot.opaque}` : "no canvas");
ok("…and it actually draws (no floor-plan-less blank canvas)", spShot.found && spShot.opaque > 2000, `opaque=${spShot.opaque}`);
ok("…whatever it draws is not the House's own picture (different floor)", spShot.found && winnerShot.found && Math.abs(spShot.opaque - winnerShot.opaque) > 300, `senate ${spShot.opaque} vs house ${winnerShot.opaque}`);

await page.evaluate(() => window.__map.setLens("senate"));
const tillSenate = await until(async () => page.evaluate(() => window.__map.S.lens === "senate" && (document.querySelector("#minich")?.getAttribute("aria-label") || "").includes("Senate")), 30000);
await wait(600);
const senShot = await shot();
ok("the Senate lens draws the Senate floor too", tillSenate && senShot.found && senShot.aria.includes("Senate") && senShot.opaque > 2000, senShot.found ? `aria="${senShot.aria.slice(0, 26)}", opaque=${senShot.opaque}` : "no canvas");

ok("no page errors across all lens switches", errs.length === 0, errs[0] || "");
await page.evaluate(() => window.__map.setLens("winner"));
await wait(2500);
const backShot = await shot();
ok("back in the winner lens the House chamber returns", backShot.found && !backShot.aria.includes("Senate") && backShot.opaque > 2000, backShot.found ? `aria="${backShot.aria.slice(0, 26)}", opaque=${backShot.opaque}` : "no canvas");

await browser.close();
if (fails.length) { console.log(`FAIL: ${fails.length} failure(s)`); process.exit(1); }
console.log("PASS: the story column's chamber follows the lens — House chairs in House lenses, the Senate floor's own (plan-loaded) chairs in the Senate lanes");
