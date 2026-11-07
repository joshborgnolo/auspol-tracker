// Probe: the /map/ Winner head's "formed govt" ink tag — sits under the
// two-party figures of ELECTION frames only, hugging the governing family's
// side (left for Labor, right for Coalition), ink-on-paper per the theme.
// usage: node .matilda/probe/map-formed-govt.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });

const tag = () => page.evaluate(() => {
  const fg = document.querySelector(".st-stat .st-fg");
  if (!fg) return { found: false, count: document.querySelectorAll(".st-stat .st-fg").length };
  return {
    found: true,
    count: document.querySelectorAll(".st-stat .st-fg").length,
    text: fg.textContent.trim(),
    align: getComputedStyle(fg).alignSelf,
    prev: fg.previousElementSibling ? fg.previousElementSibling.className : "",
    next: fg.nextElementSibling ? fg.nextElementSibling.className + "|" + fg.nextElementSibling.textContent.trim().slice(0, 20) : "",
  };
});
// the app reads the frame key from the hash at boot only — a hash navigation
// alone won't re-render, so each frame switch needs a reload
const show = async (y) => { await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2" }); await wait(1500); };

// 2025: Labor won — tag on the left, straight after the two-party figures, before Primaries
await show("2025");
let t = await tag();
ok("2025: tag rendered once", t.found && t.count === 1, JSON.stringify(t));
ok("2025: lowercase 'formed govt'", t.text === "formed govt", t.text);
ok("2025: hugging Labor's (left) side", t.align === "flex-start", t.align);
ok("2025: under the two-party figures", t.prev === "st-swing" || t.prev === "st-tpp", t.prev);
ok("2025: before the Primaries label", /^st-lab\|Primaries/.test(t.next || ""), t.next);

// theme: the box is ink on paper, both ways
const theme = await page.evaluate(async () => {
  const H = document.documentElement, b = document.querySelector(".st-stat .st-fg > b");
  const read = () => { const cs = getComputedStyle(b); return { bg: cs.backgroundColor, fg: cs.color }; };
  H.classList.remove("sh-dark"); H.classList.add("sh-light");
  const light = read();
  H.classList.remove("sh-light"); H.classList.add("sh-dark");
  const dark = read();
  return { light, dark };
});
const lum = (s) => parseFloat((s.match(/oklch\(([\d.]+)/) || [])[1]);
ok("light theme: dark box, pale text", lum(theme.light.bg) < 0.5 && lum(theme.light.fg) > 0.5, JSON.stringify(theme.light));
ok("dark theme: pale box, dark text", lum(theme.dark.bg) > 0.5 && lum(theme.dark.fg) < 0.5 && theme.dark.bg !== theme.light.bg, JSON.stringify(theme.dark));

// scope swap: the tag stays (a class scope changes the figures, not the government)
await page.evaluate(() => {
  const trig = document.querySelector("[data-scope-trigger]"); if (trig) trig.click();
  const cls = [...document.querySelectorAll(".st-scm [data-scope]")].find((it) => it.dataset.scope.startsWith("cls:"));
  if (cls) cls.click();
});
await wait(400);
t = await tag();
ok("2025 under a class scope: tag still there", t.found && t.count === 1, JSON.stringify(t));

// 2013: Coalition won — tag on the right
await show("2013");
t = await tag();
ok("2013: tag hugging the Coalition's (right) side", t.found && t.align === "flex-end", JSON.stringify(t));

// 2010: hung parliament, Labor kept government — tag on the left
await show("2010");
t = await tag();
ok("2010: tag on Labor's (left) side", t.found && t.align === "flex-start", JSON.stringify(t));

// now: an as-it-stands frame gets no tag
await show("now");
t = await tag();
ok("now frame: no tag", !t.found, JSON.stringify(t));

// a state election: Queensland 2024 (LNP government) gets the right-side tag
await show("qld24");
t = await tag();
ok("qld24: tag rendered", t.found, JSON.stringify(t));
ok("qld24: hugging the LNP's (right) side", t.align === "flex-end", t.align);

// phone rung: no new horizontal overflow
await show("2025");
await wait(1200);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await wait(600);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("no horizontal overflow at 390px", over <= 0, `${over}px`);
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-formed-govt: ok");
process.exit(fails.length ? 1 : 0);
