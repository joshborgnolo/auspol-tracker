/* Probe: masthead parity – since 2026-10-02 the satellite and main-page
   mastheads wear the SAME current design: the lockup split into a text-only
   wordmark beside a dial-only contour-shaped control (button on the main
   page, home/story <a> pair on the satellites – the page's own title keeps
   the <h1>), wordmark 34px desktop / 32px phone both sides, dial 57px /
   54px both sides, no hover wash anywhere on the dial. Parity is asserted
   on the structure AND the parts – one live inline dial with the same
   colours, angles and heights, squared-off ink, the rd status block's
   three facts with notes, the compact phone line naming the newest poll,
   the four-view tab bar, /#story opening the dial story – and since the
   2026-10-03 chrome contract, every rendered masthead WORD identical on
   both pages (site-shell.mjs mainChrome lifts them from the main page's
   compiled masthead), plus the satellite's no-JS header still wearing
   the same words baked in at apply time. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { mainChrome } from "../../.build/site-shell.mjs";
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
  /* the dial sits BESIDE the wordmark on both designs (in .lockup on the
     main page, in .sh-lockup on the satellites) – look it up at document
     scope, not off the wordmark */
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
    trackInk3: getComputedStyle(track).color,
    nameInk: Math.round(ink(name) * 10) / 10,
    trackInk: Math.round(ink(track) * 10) / 10,
    taglineSize: getComputedStyle(document.querySelector(".tagline, .sh-tagline")).fontSize,
    imgs: document.querySelectorAll(".wordmark img, .lockup img, .sh-lockup img, .wm-glyph img").length,
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

/* the main page's lockup: the player is wired to the dial alone and shaped
   to its contour, not a box around words+dial */
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
    metaSubs: [...document.querySelectorAll(".rd-head-meta .meta-s")].map((s) => s.textContent),
  };
});
console.log("main-btn ", JSON.stringify(mainBtn));
ok(mainBtn.h1Buttons === 0, "main h1 is text-only (no button inside the wordmark)");
ok(mainBtn.onlyChild, "the player's only child is the dial svg");
ok(Math.abs(mainBtn.btnW - 63) <= 1.5 && Math.abs(mainBtn.btnH - 45.7) <= 1.5,
   `button hugs the dial alone (${mainBtn.btnW}×${mainBtn.btnH} ≈ 57+6 × 39.7+6)`);
ok(mainBtn.radius === "50%", `button follows the dial's contour (border-radius ${mainBtn.radius})`);
ok(mainBtn.metaSubs.length === 3, `main status block has three notes (${mainBtn.metaSubs.join(" · ")})`);

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
           nameSize: getComputedStyle(document.querySelector(".wm-name")).fontSize,
           dialW: Math.round(document.querySelector("svg.wm-dial").getBoundingClientRect().width),
           compact: getComputedStyle(document.querySelector(".rd-head-compact")).display,
           btnRight: Math.round(btn.right * 10) / 10, togLeft: Math.round(tog.left * 10) / 10 };
});
console.log("phone    ", JSON.stringify(phone));
ok(phone.padR === "92px", `phone: the 92px toggle clearance moved to .lockup (${phone.padR})`);
ok(phone.togLeft >= phone.btnRight, `phone: theme toggle clear of the dial button (${phone.btnRight} ≤ ${phone.togLeft})`);
ok(phone.nameSize === "32px", `main phone wordmark 32px (${phone.nameSize})`);
ok(phone.dialW === 54, `main phone dial 54px (${phone.dialW})`);
ok(phone.compact === "flex", `main phone compact line shows (${phone.compact})`);
await page.setViewport({ width: 1280, height: 900 });

const sat = await browser.newPage();
await sat.setViewport({ width: 1280, height: 900 });
sat.on("pageerror", (e) => console.log("pageerror(sat):", e.message));
/* the Newspoll archive embeds third-party Infogram, which stalls the load
   event well past 30s – domcontentloaded is enough for the lockup */
await sat.goto(base + "/archives/newspoll/", { waitUntil: "domcontentloaded" }); await wait(1600);
const arch = await sat.evaluate(lockupFn);
console.log("archive  ", JSON.stringify(arch));

ok(arch.imgs === 0 && arch.dialSvgs === 1, "satellite: <img> stand-in swapped for one live inline dial svg");
/* the satellite lockup, split exactly as the main page's: the wordmark
   alone (its link the way home), the dial's own control beside it */
const satLock = await sat.evaluate(() => {
  const lock = document.querySelector(".sh-lockup");
  const wm = lock && lock.querySelector("a.wordmark.stacked");
  const dial = lock && lock.querySelector("a.wm-glyph");
  const r = dial && dial.getBoundingClientRect();
  return {
    lockup: !!lock,
    wmLinkedHome: wm ? wm.getAttribute("href") : null,
    wmInnerCount: wm ? wm.querySelectorAll("a, button").length : -1,
    dialOnlyChild: dial ? dial.children.length === 1 && dial.children[0].matches("svg.wm-dial") : false,
    dialW: r ? Math.round(r.width * 10) / 10 : 0,
    dialH: r ? Math.round(r.height * 10) / 10 : 0,
    dialRadius: dial ? getComputedStyle(dial).borderRadius : null,
    metaSubs: [...document.querySelectorAll(".sh-meta .sh-meta-s")].map((s) => s.textContent),
    hasCompact: !!document.querySelector(".sh-head-compact"),
  };
});
console.log("sat-lock ", JSON.stringify(satLock));
ok(satLock.lockup, "satellite carries the split lockup (.sh-lockup)");
ok(satLock.wmLinkedHome === "/", `the satellite wordmark links home (${satLock.wmLinkedHome})`);
ok(satLock.wmInnerCount === 0, "the satellite wordmark is text-only");
ok(satLock.dialOnlyChild, "the satellite dial control's only child is the live svg");
ok(Math.abs(satLock.dialW - 63) <= 1.5 && Math.abs(satLock.dialH - 45.7) <= 1.5,
   `satellite dial hugs the same box (${satLock.dialW}×${satLock.dialH} ≈ 63 × 45.7)`);
ok(satLock.dialRadius === "50%", `satellite dial follows the contour too (border-radius ${satLock.dialRadius})`);
ok(satLock.hasCompact, "the satellite carries the phone compact line");
ok(satLock.metaSubs.length === 3 &&
   /^published (today|yesterday|\d+ (days|weeks|months) ago)$/.test(satLock.metaSubs[0]) &&
   /^\d+ pollsters$/.test(satLock.metaSubs[1]) && /^\d+ months at most$/.test(satLock.metaSubs[2]),
   `satellite status block notes match the design (${satLock.metaSubs.join(" · ")})`);

/* type parity: face, weights and SIZES – the rd redesign's 34px wordmark
   and 16px tagline, worn identically on both */
ok(arch.nameFont === main.nameFont &&
   arch.nameWeight === main.nameWeight && arch.trackWeight === main.trackWeight,
   `wordmark type: same face and weights (${main.nameFont}, ${main.nameWeight}/${main.trackWeight})`);
ok(arch.nameSize === "34px" && arch.nameSize === main.nameSize,
   `wordmark size parity (main ${main.nameSize}, sat ${arch.nameSize})`);
ok(arch.trackInk3 === main.trackInk3, `wordmark track ink identical (${main.trackInk3})`);
ok(arch.taglineSize === "16px" && arch.taglineSize === main.taglineSize,
   `tagline size parity (main ${main.taglineSize}, sat ${arch.taglineSize})`);
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

/* …and the satellite dial grows no hover shape either – the contour is the
   main page's, so the wash went with it */
await sat.hover("a.wm-glyph");
await wait(300);
const satHoverBg = await sat.evaluate(() => getComputedStyle(document.querySelector("a.wm-glyph")).backgroundColor);
ok(satHoverBg === "rgba(0, 0, 0, 0)", `satellite dial grows no hover shape (${satHoverBg})`);
await sat.mouse.move(0, 0);

/* phone rung, same sizes as the main page's: 32px wordmark, 54px dial,
   the toggle's 92px clearance on the lockup row, the compact line shown */
await sat.setViewport({ width: 390, height: 844 });
await wait(700);
const satPhone = await sat.evaluate(() => {
  const lock = document.querySelector(".sh-lockup");
  const dial = document.querySelector("a.wm-glyph").getBoundingClientRect();
  const tog = document.querySelector(".sh-theme").getBoundingClientRect();
  const compact = document.querySelector(".sh-head-compact");
  return { padR: getComputedStyle(lock).paddingRight,
           nameSize: getComputedStyle(document.querySelector(".wm-name")).fontSize,
           dialW: Math.round(document.querySelector("svg.wm-dial").getBoundingClientRect().width),
           compactDisplay: getComputedStyle(compact).display,
           compactText: compact.textContent.replace(/\s+/g, " ").trim(),
           dialRight: Math.round(dial.right * 10) / 10, togLeft: Math.round(tog.left * 10) / 10 };
});
console.log("sat-phone", JSON.stringify(satPhone));
ok(satPhone.padR === "92px", `satellite phone: 92px toggle clearance on the lockup row (${satPhone.padR})`);
ok(satPhone.togLeft >= satPhone.dialRight, `satellite phone: theme toggle clear of the dial (${satPhone.dialRight} ≤ ${satPhone.togLeft})`);
ok(satPhone.nameSize === "32px", `satellite phone wordmark 32px (${satPhone.nameSize})`);
ok(satPhone.dialW === 54, `satellite phone dial 54px (${satPhone.dialW})`);
ok(satPhone.compactDisplay === "flex", `satellite phone compact line shows (${satPhone.compactDisplay})`);
ok(/^Latest poll .+?, (today|yesterday|\d+ (days|weeks|months) ago), \d+ polls$/.test(satPhone.compactText),
   `compact names the newest poll as the main page's does (${satPhone.compactText})`);
await sat.setViewport({ width: 1280, height: 900 });

const satTabs = await sat.evaluate(() => [...document.querySelectorAll(".sh-tabs-set .sh-tab")].map((t) => t.innerText.trim()));
ok(satTabs.length === 4 && !/archives/i.test(satTabs.join("|")), "satellite tab bar: " + satTabs.join(" | "));
/* the tab bar is LIFTED from the main page's TABS (site-shell.mjs mainTabs):
   a rename on the main page (Snapshot → Now, 2026-10-03) must land here
   verbatim with one apply, and this check is what fails if it didn't */
const mainTabs = await page.evaluate(() => [...document.querySelectorAll(".tabs-set .tab")].map((t) => t.innerText.trim()));
ok(JSON.stringify(satTabs) === JSON.stringify(mainTabs),
   `tab labels match the main page's (main ${mainTabs.join(" | ")}, sat ${satTabs.join(" | ")})`);
/* …and the tabs must NAVIGATE: the fillCopy rebuild derives each href from
   the tab id (2026-10-03 hotfix – t.href wrote the string "undefined", and a
   click on a satellite went to <satellite>/undefined). The scrape runs after
   the page's own fetch, so this is the REBUILT set, not the bake */
const chrome = mainChrome();
const satTabHrefs = await sat.evaluate(() => [...document.querySelectorAll(".sh-tabs-set .sh-tab")].map((t) => t.getAttribute("href")));
const expectHrefs = chrome.tabs.map((t) => "/#" + t.id);
ok(!satTabHrefs.some((h) => h === null || /undefined|^#|^$/.test(h)), "no satellite tab href is undefined/empty");
ok(JSON.stringify(satTabHrefs) === JSON.stringify(expectHrefs),
   `satellite tabs navigate to the main page's views (${satTabHrefs.join(" ")})`);
const tabType = await sat.evaluate(() => ({
  fam: getComputedStyle(document.querySelector(".sh-tabs .sh-tab")).fontFamily.slice(0, 40),
  size: getComputedStyle(document.querySelector(".sh-tabs .sh-tab")).fontSize }));
/* the navbar's own set (".tabs .tab" also matches the inner facet tabs') */
const mainTabType = await page.evaluate(() => ({
  fam: getComputedStyle(document.querySelector(".tabs-set .tab .tab-label")).fontFamily.slice(0, 40),
  size: getComputedStyle(document.querySelector(".tabs-set .tab .tab-label")).fontSize }));
ok(tabType.fam === mainTabType.fam && tabType.size === mainTabType.size,
   `tab row type parity (main ${mainTabType.fam} ${mainTabType.size}, sat ${tabType.fam} ${tabType.size})`);
const mainArch = await page.evaluate(() => !!document.querySelector('.tabs a[href*="/archives"], .tabs-set a[href*="/archives"]'));
const satArch = await sat.evaluate(() => !!document.querySelector('.sh-tabs a[href*="/archives"]'));
ok(!mainArch, "main navbar carries no Archives link");
ok(!satArch, "satellite navbar carries no Archives link");

/* every masthead WORD is now one contract: site-shell.mjs mainChrome()
   lifts them out of the main page's compiled masthead, shellHeader bakes
   them into the satellites. So both pages must render the same strings,
   and those strings must BE the lift. The classes differ (.rd- vs .sh-);
   the scrape takes a selector map per page. (`chrome` was lifted up at the
   tab-nav check.) */
const scrapeChrome = (S) => {
  const txt = (s, a) => { const el = document.querySelector(s); if (!el) return null;
    return a ? el.getAttribute(a) : el.textContent.replace(/\s+/g, " ").trim(); };
  const sigOf = (b) => { const g = b && b.querySelector("svg"); if (!g) return null;
    const shapes = [...g.querySelectorAll("path,line,circle,polyline,polygon,rect")].map((c) =>
      c.getAttribute("d") || [c.getAttribute("x1"), c.getAttribute("y1"), c.getAttribute("x2"), c.getAttribute("y2"),
                              c.getAttribute("cx"), c.getAttribute("cy"), c.getAttribute("r"), c.getAttribute("points")]
        .filter((v) => v !== null).join(","));
    return (g.getAttribute("viewBox") || "") + "|" + shapes.join(";"); };
  return {
    skip: txt(S.skip),
    wmName: txt(".wm-name"), wmTrack: txt(".wm-track"), wmSr: txt(".wm-sr"),
    tagline: txt(S.tagline),
    metaK: [...document.querySelectorAll(S.metaK)].map((el) => el.textContent.replace(/\s+/g, " ").trim()),
    theme: [...document.querySelectorAll(S.themeBtn)].map((b) => ({ l: b.getAttribute("aria-label"), s: sigOf(b) })),
    score: txt(S.score),
    dialTitle: txt(S.dial, "title"), dialAction: txt("#wm-action"),
    compactB: txt(S.compactB),
  };
};
const MAIN_CH = { skip: "a.skip-link", tagline: ".tagline", metaK: ".rd-head-meta .meta-k",
                  themeBtn: '.theme-seg [aria-label$=" mode"]', score: ".ts-eyebrow",
                  dial: "button.wm-glyph", compactB: ".rd-head-compact b" };
const SAT_CH = { skip: "a.sh-skip", tagline: ".sh-tagline", metaK: ".sh-meta .sh-meta-k",
                 themeBtn: '.sh-theme [aria-label$=" mode"]', score: ".sh-score .sh-eyebrow",
                 dial: "a.wm-glyph", compactB: ".sh-head-compact b" };
const mainW = await page.evaluate(scrapeChrome, MAIN_CH);
const satW = await sat.evaluate(scrapeChrome, SAT_CH);
console.log("main-w   ", JSON.stringify(mainW));
console.log("sat-w    ", JSON.stringify(satW));
for (const k of ["skip", "wmName", "wmTrack", "wmSr", "score", "dialTitle", "dialAction", "compactB"])
  ok(mainW[k] !== null && mainW[k] === satW[k], `rendered ${k} identical on both pages (${satW[k]})`);
ok(JSON.stringify(mainW.metaK) === JSON.stringify(satW.metaK), `status labels identical (${satW.metaK.join(" · ")})`);
ok(JSON.stringify(mainW.theme) === JSON.stringify(satW.theme) && mainW.theme.length === 2,
   `theme labels AND artwork identical (${satW.theme.map((t) => t.l).join(", ")})`);
/* …and the satellite's words are the contract's, not a copy that drifted */
ok(satW.skip === chrome.skip, `skip link carries the lift ("${chrome.skip}")`);
ok(satW.wmName === chrome.wm.name && satW.wmTrack === chrome.wm.track && satW.wmSr === chrome.wm.sr,
   "the wordmark's words are the lift");
ok(JSON.stringify(satW.metaK) === JSON.stringify([chrome.meta.k1, chrome.meta.k2, chrome.meta.k3]),
   "the status-block labels are the lift");
ok(satW.theme[0].l === chrome.theme.light.label && satW.theme[1].l === chrome.theme.dark.label,
   "the theme labels are the lift");
ok(satW.score === chrome.score.eyebrow, `the score eyebrow is the lift ("${chrome.score.eyebrow}")`);
ok(satW.dialTitle === chrome.dial.title && satW.dialAction === chrome.dial.action, "the dial titles are the lift");
ok(satW.compactB === chrome.compact.b, `the compact head is the lift ("${chrome.compact.b}")`);
ok(mainW.tagline.startsWith(chrome.tagline.a.trim()) && mainW.tagline.endsWith(chrome.tagline.b),
   `the main tagline frames its past word with the lift (${mainW.tagline})`);
ok(satW.tagline.startsWith(chrome.tagline.a.trim()) && satW.tagline.endsWith(chrome.tagline.b),
   `the satellite tagline frames it likewise (${satW.tagline})`);

const sp = await browser.newPage();
await sp.setViewport({ width: 1280, height: 900 });
sp.on("pageerror", (e) => console.log("pageerror(story):", e.message));
await sp.goto(base + "/#story", { waitUntil: "load" }); await wait(1500);
const story = await sp.evaluate(() => ({
  backdrop: !!document.querySelector(".dl-backdrop"),
  hash: window.location.hash }));
ok(story.backdrop, "/#story opens the dial story");
ok(story.hash === "", "the #story hash is eaten once opened");

/* the BAKED fallback: with page scripts off, auspol-now.json's copy block
   can't reach the DOM, so everything the satellite wears must come from
   what shellHeader baked at apply time – assert the whole contract is
   there, down to the tagline's "twenty" placeholder (only the bake says
   it; the runtime overlay would have replaced it by now) */
const nojs = await browser.newPage();
await nojs.setJavaScriptEnabled(false);
await nojs.setViewport({ width: 1280, height: 900 });
await nojs.goto(base + "/feedback/", { waitUntil: "domcontentloaded" });
const baked = await nojs.evaluate(scrapeChrome, SAT_CH);
console.log("baked    ", JSON.stringify(baked));
ok(baked.wmName === chrome.wm.name && baked.wmTrack === chrome.wm.track && baked.wmSr === chrome.wm.sr,
   "no-JS: the wordmark's words are baked in");
ok(baked.skip === chrome.skip, "no-JS: the skip link is baked in");
ok(baked.tagline.startsWith(chrome.tagline.a.trim()) && baked.tagline.includes("twenty") &&
   baked.tagline.endsWith(chrome.tagline.b), `no-JS: the tagline is baked in, placeholder intact (${baked.tagline})`);
ok(JSON.stringify(baked.metaK) === JSON.stringify([chrome.meta.k1, chrome.meta.k2, chrome.meta.k3]),
   "no-JS: the status-block labels are baked in");
ok(JSON.stringify(baked.theme) === JSON.stringify(satW.theme), "no-JS: the theme switch is baked in, artwork inline");
ok(baked.score === chrome.score.eyebrow && baked.dialTitle === chrome.dial.title && baked.dialAction === chrome.dial.action,
   "no-JS: the score eyebrow and dial titles are baked in");
ok(baked.compactB === chrome.compact.b, "no-JS: the compact head is baked in");
await nojs.close();

await browser.close(); server.close();
console.log(fails ? `FAILED (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
