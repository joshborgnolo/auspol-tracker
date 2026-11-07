// Probe: the /map/ Winner head's two-party block —
//   1. the govt ink tag sits at the whole head's OUTSIDE content edge on the
//      governing family's side, flush with it wherever the viewport allows —
//      and tucked inside JUST enough to keep its text on screen (-viewportised)
//      where a flush run would leave the page (2026-11-07 a tightened clamp;
//      before this it hung past the figures' own edge, narrower or not). It
//      READS "formed govt" on an election frame, just "govt" on an as-it-stands
//      now frame;
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

// the tag's own measuring fields: names-row pitch, its exact x vs the head's
// content edges, and the same viewport-clamp arithmetic the source applies
const tag = () => page.evaluate(() => {
  const fg = document.querySelector(".st-stat .st-fg");
  if (!fg) return { found: false, count: document.querySelectorAll(".st-stat .st-fg").length };
  const stat = fg.closest(".st-stat");
  const tpp = fg.closest(".st-tpp");
  const r = fg.getBoundingClientRect(), sb = stat.getBoundingClientRect();
  const nm = tpp && tpp.querySelector(".st-nm-l");
  const w = Math.round(fg.offsetWidth), alp = /st-fg-alp/.test(fg.className);
  const room = alp ? sb.left : innerWidth - sb.right;
  const tuck = Math.max(0, w - Math.max(0, room));
  return {
    found: true,
    count: document.querySelectorAll(".st-stat .st-fg").length,
    text: fg.textContent.trim(),
    cls: fg.className,
    parent: fg.parentElement ? fg.parentElement.className.split(" ")[0] : "",
    // inner-flush deltas: 0±2 means the tag's inner face rides its edge exactly
    innerL: Math.round((r.left - sb.left) * 10) / 10,
    innerR: Math.round((sb.right - r.right) * 10) / 10,
    fgL: Math.round(r.left), fgR: Math.round(r.right), fgW: w, vw: innerWidth,
    rowDY: nm ? Math.abs((r.top + r.height / 2) - (nm.getBoundingClientRect().top + nm.getBoundingClientRect().height / 2)) : null,
    // any run of the tag sits inside the section by design: the roomy check
    inView: r.left >= -2 && r.right <= innerWidth + 2,
  };
});
const names = () => page.evaluate(() => {
  const tpp = document.querySelector(".st-stat .st-tpp");
  if (!tpp) return { found: false };
  const [bL, , bR] = [...tpp.children];
  const nL = tpp.querySelector(".st-nm-l"), nR = tpp.querySelector(".st-nm-r");
  if (!nL || !nR) return { found: "tpp only", kids: tpp.children.length };
  const swing = tpp.nextElementSibling;
  return {
    found: true,
    left: nL.textContent.trim(),
    right: nR.textContent.trim(),
    leftFlush: Math.abs(nL.getBoundingClientRect().right - bL.getBoundingClientRect().right),
    rightFlush: Math.abs(nR.getBoundingClientRect().left - bR.getBoundingClientRect().left),
    aboveSwing: nL.getBoundingClientRect().bottom <= (swing ? swing.getBoundingClientRect().top + 1 : Infinity),
  };
});
// inner-flush: deltas read ~0 when the tag's inner face rides its edge exactly
const flushCheck = (okFn, prefix, t, side = "left") => {
  const d = side === "left" ? t.innerL : t.innerR;
  okFn(`${prefix}: inner face flush at its content edge`, Math.abs(d) <= 2 && (side === "left" ? t.fgL >= 0 : t.fgR <= t.vw), JSON.stringify({ d, fgL: t.fgL, fgR: t.fgR }));
};
// the app reads the frame key from the hash at boot only — a hash navigation
// alone won't re-render, so each frame switch needs a reload
const show = async (y) => { await page.goto(`${base}/map/#y=${y}`, { waitUntil: "networkidle2", timeout: 60000 }); await page.reload({ waitUntil: "networkidle2" }); await wait(1500); };

// 2025: Labor won — tag flush at the head's left content edge, on the names row
await show("2025");
let t = await tag();
ok("2025: tag rendered once", t.found && t.count === 1, JSON.stringify(t));
ok("2025: lowercase 'formed govt'", t.text === "formed govt", t.text);
ok("2025: alp-side class", /st-fg-alp/.test(t.cls), t.cls);
ok("2025: on the figures' names row", t.parent === "st-tpp", t.parent);
flushCheck(ok, "2025", t, "left");
ok("2025: on the names row", t.rowDY != null && t.rowDY <= 4, `${t.rowDY}px`);
let nm = await names();
ok("2025: names render", nm.found === true, JSON.stringify(nm));
ok("2025: names ride the figures' INSIDE edges", nm.leftFlush <= 2 && nm.rightFlush <= 2, JSON.stringify(nm));

// a class scope changes the figures; the scope menu's pick travels the tag too
await show("2025");
t = await tag(); nm = await names();
ok("2025 under a class scope: tag still there", t.found && t.count === 1, JSON.stringify(t));
ok("2025 under a class scope: names still there", nm.found === true, JSON.stringify(nm));

// 2013: Coalition won — tag flush at the head's right content edge
await show("2013");
t = await tag();
ok("2013: lnp-side class", /st-fg-lnp/.test(t.cls), t.cls);
flushCheck(ok, "2013", t, "right");

// 2010: hung parliament, Labor kept government — alp side again
await show("2010");
t = await tag();
ok("2010: alp side, flush-checked at its edge", t.found && /st-fg-alp/.test(t.cls), JSON.stringify(t));
flushCheck(ok, "2010", t, "left");

// now frame: the as-it-stands government gets a plain "govt" tag — same
// names-row placement, flush at Labor's outer content edge
await show("now");
t = await tag(); nm = await names();
ok("now frame: lowercase 'govt' tag, rendered once", t.found && t.count === 1 && t.text === "govt", JSON.stringify(t));
ok("now frame: alp-side class", /st-fg-alp/.test(t.cls), t.cls);
flushCheck(ok, "now frame", t, "left");
ok("now frame: on the names row", t.rowDY != null && t.rowDY <= 4, `${t.rowDY}px`);
ok("now frame: names present", nm.found === true && nm.left === "Labor" && nm.right === "Coalition", JSON.stringify(nm));

// a state election: Queensland 2024 (LNP government) — right side, right name reads LNP
await show("qld24");
t = await tag(); nm = await names();
ok("qld24: right-side tag", t.found && /st-fg-lnp/.test(t.cls), JSON.stringify(t));
flushCheck(ok, "qld24", t, "right");
ok("qld24: right figure named LNP", nm.found === true && nm.right === "LNP", JSON.stringify(nm));

// phone rungs: the tag never leaves the viewport (the clamp's role is exactly this)
await show("2025");
await wait(1200);
for (const width of [390, 320]) {
  await page.setViewport({ width, height: 844, deviceScaleFactor: 2 });
  await wait(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${width}px: no horizontal overflow`, over <= 0, `${over}px`);
  const t4 = await tag();
  ok(`${width}px: tag text fully inside the viewport`, t4.found && t4.inView, `${t4.text} at [${t4.fgL}…${t4.fgR}]`);
}
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await show("2013");
await wait(1200);
{
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("2013: no horizontal overflow at 390px", over <= 0, `${over}px`);
  const t3 = await tag();
  ok("2013: tag inside the viewport at 390px", t3.inView, `at [${t3.fgL}…${t3.fgR}]`);
}
// the now frame's log tag at the phone rung too
await show("now");
await wait(1200);
await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 2 });
await wait(500);
{
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("now: no horizontal overflow at 320px", over <= 0, `${over}px`);
  const t4 = await tag();
  ok("now: tag inside the viewport at 320px", t4.found && t4.inView, `innerL ${t4.innerL}px`);
}
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-formed-govt: ok");
process.exit(fails.length ? 1 : 0);
