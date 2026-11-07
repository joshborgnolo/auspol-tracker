// Probe: the /map/ Winner head's two-party block —
//   1. the "formed govt" ink tag shares the figures' NAMES ROW on ELECTION
//      frames only — centred under the dash, beside Labor/Coalition
//      (ink/bg per theme);
//   2. the figures grid names both sides ("Labor" · "Coalition"/"LNP"…), each
//      name flush with its figure's inside edge, above the swing line.
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
  const r = fg.getBoundingClientRect();
  const tpp = fg.closest(".st-tpp");
  const dash = tpp && tpp.querySelector("i");
  const nm = tpp && tpp.querySelector(".st-nm-l");
  const cs = getComputedStyle(fg.querySelector("b"));
  const rr = (x) => x.getBoundingClientRect();
  return {
    found: true,
    count: document.querySelectorAll(".st-stat .st-fg").length,
    text: fg.textContent.trim(),
    parent: fg.parentElement ? fg.parentElement.className.split(" ")[0] : "",
    padX: [parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)],
    dashDX: tpp && dash ? Math.abs((r.left + r.width / 2) - ((rr(dash).left + rr(dash).width / 2))) : null,
    rowDY: nm ? Math.abs((r.top + r.height / 2) - ((rr(nm).top + rr(nm).height / 2))) : null,
  };
});
const names = () => page.evaluate(() => {
  const tpp = document.querySelector(".st-stat .st-tpp");
  if (!tpp) return { found: false };
  const [bL, , bR] = [...tpp.children];
  const nL = tpp.querySelector(".st-nm-l"), nR = tpp.querySelector(".st-nm-r");
  if (!nL || !nR) return { found: "tpp only", kids: tpp.children.length };
  const rL = bL.getBoundingClientRect(), rR = bR.getBoundingClientRect(), nLr = nL.getBoundingClientRect(), nRr = nR.getBoundingClientRect();
  const swing = tpp.nextElementSibling;
  return {
    found: true,
    left: nL.textContent.trim(),
    right: nR.textContent.trim(),
    leftFlush: Math.abs(nLr.right - rL.right),
    rightFlush: Math.abs(nRr.left - rR.left),
    aboveSwing: nLr.bottom <= (swing ? swing.getBoundingClientRect().top + 1 : Infinity),
  };
});
// the app reads the frame key from the hash at boot only — a hash navigation
// alone won't re-render, so each frame switch needs a reload
const show = async (y) => { await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2" }); await wait(1500); };

// 2025: Labor won — tag on the names row under the dash; names flush with inside edges above the swing
await show("2025");
let t = await tag();
ok("2025: tag rendered once", t.found && t.count === 1, JSON.stringify(t));
ok("2025: lowercase 'formed govt'", t.text === "formed govt", t.text);
ok("2025: inside the figures grid", t.parent === "st-tpp", t.parent);
ok("2025: centred under the dash", t.dashDX != null && t.dashDX <= 8, `${t.dashDX}px`);
ok("2025: on the names row", t.rowDY != null && t.rowDY <= 4, `${t.rowDY}px`);
ok("2025: tight box, ≤5px side padding", t.padX && t.padX.every((p) => p <= 5), String(t.padX));
let nm = await names();
ok("2025: names render", nm.found === true, JSON.stringify(nm));
ok("2025: names are Labor · Coalition", nm.left === "Labor" && nm.right === "Coalition", `${nm.left} · ${nm.right}`);
ok("2025: each name flush with its figure's inside edge", nm.leftFlush <= 2 && nm.rightFlush <= 2, `ΔL ${nm.leftFlush}px ΔR ${nm.rightFlush}px`);
ok("2025: names above the swing line", nm.aboveSwing, String(nm.aboveSwing));

// theme: the tag box is ink on paper, both ways
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

// scope swap: the tag and the names stay (a class scope changes figures, not government)
await page.evaluate(() => {
  const trig = document.querySelector("[data-scope-trigger]"); if (trig) trig.click();
  const cls = [...document.querySelectorAll(".st-scm [data-scope]")].find((it) => it.dataset.scope.startsWith("cls:"));
  if (cls) cls.click();
});
await wait(400);
t = await tag(); nm = await names();
ok("2025 under a class scope: tag still there", t.found && t.count === 1, JSON.stringify(t));
ok("2025 under a class scope: names still there", nm.found === true, JSON.stringify(nm));

// 2013: Coalition won — tag rides the same names row under the dash
await show("2013");
t = await tag();
ok("2013: tag on the names row under the dash", t.found && t.parent === "st-tpp" && t.dashDX <= 8 && t.rowDY <= 4, JSON.stringify(t));

// 2010: hung parliament, Labor kept government — same placement
await show("2010");
t = await tag();
ok("2010: tag on the names row under the dash", t.found && t.parent === "st-tpp" && t.dashDX <= 8, JSON.stringify(t));

// now frame: no tag — but the figures' names still label the sides
await show("now");
t = await tag(); nm = await names();
ok("now frame: no tag", !t.found, JSON.stringify(t));
ok("now frame: names present", nm.found === true && nm.left === "Labor" && nm.right === "Coalition", JSON.stringify(nm));

// a state election: Queensland 2024 (LNP government) gets the tag and the LNP's name
await show("qld24");
t = await tag(); nm = await names();
ok("qld24: tag rendered on the names row", t.found && t.parent === "st-tpp" && t.rowDY <= 4, JSON.stringify(t));
ok("qld24: right figure named LNP", nm.found === true && nm.right === "LNP", JSON.stringify(nm));

// phone rungs: the tag widens the dash's middle column, never the page
await show("2025");
await wait(1200);
for (const w of [390, 320]) {
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2 });
  await wait(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`no horizontal overflow at ${w}px`, over <= 0, `${over}px`);
  const clip = await page.evaluate(() => { const r = document.querySelector(".st-stat .st-fg").getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; });
  ok(`tag inside the viewport at ${w}px`, !clip);
}
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-formed-govt: ok");
process.exit(fails.length ? 1 : 0);
