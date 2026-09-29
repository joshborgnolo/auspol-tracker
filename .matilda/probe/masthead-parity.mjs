/* Probe: masthead parity – the satellite and main-page mastheads differ in
   WRAPPER by design (satellite: the whole-lockup <a> home inside the
   wordmark; main page: a text-only h1 beside a dial-only circular <button>
   in .lockup), so parity is asserted on the PARTS – one live inline dial
   with the same colours, angles, heights and 57px width, identical wordmark
   type, squared-off ink – plus the four-view tab bar on both and /#story
   opening the dial story. Also pins the main page's rewiring: h1 text-only,
   the player's box hugging the dial alone at border-radius 50%. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const lockupFn = () => {
  const wm = document.querySelector(".wordmark.stacked");
  const name = wm.querySelector(".wm-name"), track = wm.querySelector(".wm-track");
  /* the dial sits INSIDE .wordmark on a satellite but BESIDE it (in .lockup)
     on the main page – look it up at document scope, not off the wordmark */
  const dial = document.querySelector("svg.wm-dial");
  const ink = (el) => {
    const ls = parseFloat(getComputedStyle(el).letterSpacing);
    return el.getBoundingClientRect().width - (isNaN(ls) ? 0 : ls);
  };
  const bars = dial ? [...dial.querySelectorAll(".wm-bar")] : [];
  const needleG = dial && dial.querySelector(".wm-needle-g");
  return {
    nameFont: getComputedStyle(name).fontFamily.split(",")[0].trim(),
    nameSize: getComputedStyle(name).fontSize,
    nameWeight: getComputedStyle(name).fontWeight,
    trackWeight: getComputedStyle(track).fontWeight,
    nameInk: Math.round(ink(name) * 10) / 10,
    trackInk: Math.round(ink(track) * 10) / 10,
    imgs: document.querySelectorAll(".wordmark img, .lockup img, .wm-glyph img").length,
    dialSvgs: document.querySelectorAll("svg.wm-dial").length,
    dialW: dial ? Math.round(dial.getBoundingClientRect().width) : 0,
    arcStroke: dial ? getComputedStyle(dial.querySelector(".wm-arc")).stroke : null,
    barStrokes: bars.map((b) => getComputedStyle(b).stroke),
    /* the main page's react sets the dash as an inline STYLE, the shell's as
       an ATTRIBUTE – read whichever it is; inline style serialises comma-
       separated, so normalise commas before splitting */
    barDashes: bars.map((b) => (b.style.strokeDasharray || b.getAttribute("stroke-dasharray") || "")
      .trim().replace(/,/g, " ").split(/\s+/).map((s) => (+s).toFixed(2)).join(" ")),
    needle: needleG ? getComputedStyle(needleG).transform : null,
    /* token parity means "resolves the same where the dial sits" – main page
       scopes dark tokens at body.dark, the shell at :root, so documentElement
       values legitimately differ; read it off the dial instead */
    alp: dial ? getComputedStyle(dial).getPropertyValue("--alp").trim() : null,
  };
};

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("pageerror(main):", e.message));
await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
const main = await page.evaluate(lockupFn);
console.log("main     ", JSON.stringify(main));

/* the main page's rewired lockup: the player is wired to the dial alone and
   shaped to its contour, not a box around words+dial */
const mainBtn = await page.evaluate(() => {
  const h1 = document.querySelector("h1.wordmark");
  const btn = document.querySelector("button.wm-glyph");
  const r = btn.getBoundingClientRect();
  return {
    h1Buttons: h1.querySelectorAll("button").length,
    onlyChild: btn.children.length === 1 && btn.children[0].matches("svg.wm-dial"),
    btnW: Math.round(r.width * 10) / 10,
    btnH: Math.round(r.height * 10) / 10,
    radius: getComputedStyle(btn).borderRadius,
  };
});
console.log("main-btn ", JSON.stringify(mainBtn));
ok(mainBtn.h1Buttons === 0, "main h1 is text-only (no button inside the wordmark)");
ok(mainBtn.onlyChild, "the player's only child is the dial svg");
ok(Math.abs(mainBtn.btnW - 63) <= 1.5 && Math.abs(mainBtn.btnH - 45.7) <= 1.5,
   `button hugs the dial alone (${mainBtn.btnW}×${mainBtn.btnH} ≈ 57+6 × 39.7+6)`);
ok(mainBtn.radius === "50%", `button follows the dial's contour (border-radius ${mainBtn.radius})`);

/* hover grows NO shape on the dial: clipped to the ellipse the shared 6%
   ink wash read as a grey oval, so the main page paints nothing on hover
   (the scale transform alone answers the pointer) */
await page.hover("button.wm-glyph");
await wait(300);
const mainHoverBg = await page.evaluate(() => getComputedStyle(document.querySelector("button.wm-glyph")).backgroundColor);
ok(mainHoverBg === "rgba(0, 0, 0, 0)", `main dial grows no hover shape (${mainHoverBg})`);
await page.mouse.move(0, 0);

await page.setViewport({ width: 390, height: 844 });
await wait(700);
const phone = await page.evaluate(() => {
  const lock = document.querySelector(".lockup");
  const btn = document.querySelector("button.wm-glyph").getBoundingClientRect();
  const tog = document.querySelector(".theme-seg").getBoundingClientRect();
  return { padR: getComputedStyle(lock).paddingRight,
           btnRight: Math.round(btn.right * 10) / 10, togLeft: Math.round(tog.left * 10) / 10 };
});
console.log("phone    ", JSON.stringify(phone));
ok(phone.padR === "92px", `phone: the 92px toggle clearance moved to .lockup (${phone.padR})`);
ok(phone.togLeft >= phone.btnRight, `phone: theme toggle clear of the dial button (${phone.btnRight} ≤ ${phone.togLeft})`);

const sat = await browser.newPage();
await sat.setViewport({ width: 1280, height: 900 });
sat.on("pageerror", (e) => console.log("pageerror(sat):", e.message));
/* the Newspoll archive embeds third-party Infogram, which stalls the load
   event well past 30s – domcontentloaded is enough for the lockup */
await sat.goto(base + "/archives/newspoll/", { waitUntil: "domcontentloaded" }); await wait(1600);
const arch = await sat.evaluate(lockupFn);
console.log("archive  ", JSON.stringify(arch));

ok(arch.imgs === 0 && arch.dialSvgs === 1, "satellite: <img> stand-in swapped for one live inline dial svg");
/* type parity is family + weight + the squared-off ink, NOT size: the rd
   layer (rd.css:402) deliberately wears the main wordmark bigger (34px
   desktop / 32px narrow) than the shell's 30px – the split is the design */
ok(arch.nameFont === main.nameFont &&
   arch.nameWeight === main.nameWeight && arch.trackWeight === main.trackWeight,
   `wordmark type: same face and weights (${main.nameFont}, ${main.nameWeight}/${main.trackWeight})`);
ok(main.nameSize === "34px" && arch.nameSize === "30px",
   `wordmark size split holds (main ${main.nameSize} rd, sat ${arch.nameSize} shell)`);
ok(arch.alp === main.alp, `--alp resolves identically (${main.alp})`);
ok(arch.arcStroke === main.arcStroke, `arc colour identical (${main.arcStroke})`);
ok(JSON.stringify(arch.barStrokes) === JSON.stringify(main.barStrokes), "graduation colours identical");
ok(JSON.stringify(arch.barDashes) === JSON.stringify(main.barDashes),
   `graduation heights identical (${main.barDashes.join(" · ")})`);
/* the needle is read mid-settle on each page – same angle within animation
   jitter, not the same sampled matrix */
const ang = (m) => { const v = m.match(/matrix\(([-\d.]+),\s*([-\d.]+)/); return Math.atan2(+v[2], +v[1]); };
ok(/matrix/.test(main.needle) && /matrix/.test(arch.needle) &&
   Math.abs(ang(main.needle) - ang(arch.needle)) < 1e-3,
   `needle settled at the same angle (main ${ang(main.needle).toFixed(5)}rad, sat ${ang(arch.needle).toFixed(5)}rad)`);
ok(main.dialW === 57 && arch.dialW === 57, `dial renders at the masthead's 57px (main ${main.dialW}, sat ${arch.dialW})`);
ok(Math.abs(main.nameInk - main.trackInk) < 0.6 && Math.abs(arch.nameInk - arch.trackInk) < 0.6,
   `both lockups squared off (main ${main.nameInk}v${main.trackInk} · sat ${arch.nameInk}v${arch.trackInk})`);

/* …while the satellites keep the shared 6% ink wash on their whole-lockup
   pill (only the main-page dial button paints nothing on hover) */
await sat.hover("a.wm-glyph");
await wait(300);
const satHoverBg = await sat.evaluate(() => getComputedStyle(document.querySelector("a.wm-glyph")).backgroundColor);
ok(satHoverBg !== "rgba(0, 0, 0, 0)", `satellite lockup keeps its hover wash (${satHoverBg})`);

const satTabs = await sat.evaluate(() => [...document.querySelectorAll(".sh-tabs-set .sh-tab")].map((t) => t.textContent.trim()));
ok(satTabs.length === 4 && !/archives/i.test(satTabs.join("|")), "satellite tab bar: " + satTabs.join(" | "));
const mainArch = await page.evaluate(() => !!document.querySelector('.tabs a[href*="/archives"], .tabs-set a[href*="/archives"]'));
const satArch = await sat.evaluate(() => !!document.querySelector('.sh-tabs a[href*="/archives"]'));
ok(!mainArch, "main navbar carries no Archives link");
ok(!satArch, "satellite navbar carries no Archives link");

const sp = await browser.newPage();
await sp.setViewport({ width: 1280, height: 900 });
sp.on("pageerror", (e) => console.log("pageerror(story):", e.message));
await sp.goto(base + "/#story", { waitUntil: "load" }); await wait(1500);
const story = await sp.evaluate(() => ({
  backdrop: !!document.querySelector(".dl-backdrop"),
  hash: window.location.hash }));
ok(story.backdrop, "/#story opens the dial story");
ok(story.hash === "", "the #story hash is eaten once opened");

await browser.close(); server.close();
console.log(fails ? `FAILED (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
