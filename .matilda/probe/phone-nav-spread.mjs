/* Probe: phone nav-bar spread — the ☰ shares the tab row's even
   space-between spread (shipped with the rd.css display:contents unboxing,
   2026-10-15). Before it, the boxed .tabs-list spread its own four tabs and
   the ☰ sat glued to Info at gap 0 beside the tabs' ~26px, most visible on
   a phone. Asserts (a) the main page's resting bar spaces ALL FIVE bar
   items evenly, (b) that rhythm matches the preference-flows satellite's
   flat .sh-tabs-set row, (c) the ☰ menu dropdown lands at the same
   geometry on both pages, and (d) the docked-score state still closes the
   tabs up at the left with the score owning the right end. Sibling of
   phone-nav-diff.mjs measurements (the scratch diff table). */
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
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };

const gapsOf = (tabSel) => {
  const rs = [...document.querySelectorAll(tabSel)]
    .filter((a) => a.offsetParent !== null)
    .map((a) => a.getBoundingClientRect());
  return { count: rs.length, gaps: rs.slice(1).map((r, i) => +(r.left - rs[i].right).toFixed(1)),
           first: +rs[0].left.toFixed(1), last: +rs[rs.length - 1].right.toFixed(1) };
};
const menuGeom = (popSel) => {
  const m = document.querySelector(popSel);
  if (!m || m.offsetParent === null) return null;
  const r = m.getBoundingClientRect();
  const it = m.querySelector("[role='menuitem']");
  const ics = it && getComputedStyle(it);
  return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1),
           pad: getComputedStyle(m).padding,
           itemPad: ics && `${ics.paddingTop} ${ics.paddingLeft}` };
};
const even = (g) => g.count === 5 && g.gaps.length === 4 &&
  g.gaps.every((x) => Math.abs(x - g.gaps[0]) < 0.11);

for (const W of [390, 320]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  const rest = await page.evaluate(gapsOf, ".tabs-set .tab");
  console.log(`main ${W} rest`, JSON.stringify(rest));
  ok(even(rest), `main ${W}: all five bar items space evenly (${rest.gaps.join("/")})`);
  ok(rest.gaps[3] > 0, `main ${W}: the ☰ is not glued to the tab before it (gap ${rest.gaps[3]})`);
  await page.click(".tab.tab-menu"); await wait(250);
  const mainMenu = await page.evaluate(menuGeom, ".tab-menu-pop");
  await page.keyboard.press("Escape"); await wait(150);
  /* docked score: Info yields at ≤420 and the rest close left */
  await page.evaluate(() => window.scrollTo(0, 1600)); await wait(900);
  const score = await page.evaluate(gapsOf, ".tabs-set .tab");
  const scoreBox = await page.evaluate(() => {
    const s = document.querySelector(".tab-score");
    return s && getComputedStyle(s).opacity === "1" ? s.getBoundingClientRect().left : null;
  });
  console.log(`main ${W} score`, JSON.stringify(score), "scoreL", scoreBox);
  ok(scoreBox !== null, `main ${W}: the 2PP score docks`);
  ok(score.gaps.length >= 3 && score.gaps.every((x) => Math.abs(x) < 0.11),
     `main ${W}: docked bar closes the tabs up left (gaps ${score.gaps.join("/")})`);
  ok(scoreBox !== null && score.last <= scoreBox + 1,
     `main ${W}: no tab slides under the docked score (last tab ends ${score.last}, score at ${scoreBox})`);

  const sat = await browser.newPage();
  await sat.setViewport({ width: W, height: 844 });
  await sat.goto(base + "/preference-flows/", { waitUntil: "load" }); await wait(1400);
  const satRest = await sat.evaluate(gapsOf, ".sh-tabs-set .sh-tab");
  console.log(`shell ${W} rest`, JSON.stringify(satRest));
  ok(even(satRest), `shell ${W}: the satellite row spaces all five evenly (${satRest.gaps.join("/")})`);
  ok(Math.abs(rest.gaps[0] - satRest.gaps[0]) <= 2.5,
     `main v shell ${W}: the spread rhythm matches (main ${rest.gaps[0]}, sat ${satRest.gaps[0]})`);
  ok(rest.first === satRest.first && rest.last === satRest.last,
     `main v shell ${W}: the row runs the same edges (${rest.first}…${rest.last})`);
  await sat.click(".sh-menu-btn"); await wait(250);
  const satMenu = await sat.evaluate(menuGeom, ".sh-menu");
  /* docked score on the satellite: the main page's same contract – the
     tabs close up left and NOTHING slides under the score. Asserts the
     2026-10-15 repair: at ≤380 the shell's score kept its party letters
     and painted over the ☰ (1px at 340px wide, 21px at 320px), so the
     pinned ☰'s taps opened the score's link to "/" instead of the menu */
  await sat.evaluate(() => document.querySelector(".sh-menu-btn").click()); await wait(200);
  await sat.evaluate(() => window.scrollTo(0, 1600)); await wait(900);
  const satScore = await sat.evaluate(gapsOf, ".sh-tabs-set .sh-tab");
  const satScoreL = await sat.evaluate(() => {
    const s = document.querySelector(".sh-score");
    return s && getComputedStyle(s).opacity === "1" ? s.getBoundingClientRect().left : null;
  });
  console.log(`shell ${W} score`, JSON.stringify(satScore), "scoreL", satScoreL);
  ok(satScoreL !== null, `shell ${W}: the 2PP score docks`);
  ok(satScore.gaps.length >= 3 && satScore.gaps.every((x) => Math.abs(x) < 0.11),
     `shell ${W}: docked bar closes the tabs up left (gaps ${satScore.gaps.join("/")})`);
  ok(satScoreL !== null && satScore.last <= satScoreL + 1,
     `shell ${W}: the ☰ stays clear of the docked score (last ends ${satScore.last}, score at ${satScoreL})`);
  await sat.click(".sh-menu-btn"); await wait(250);
  const satPinned = await sat.evaluate(() => ({
    open: !document.getElementById("sh-menu").hidden, path: location.pathname }));
  ok(satPinned.open && satPinned.path === "/preference-flows/",
     `shell ${W}: the pinned ☰ opens the menu (no stray navigation to "${satPinned.path}")`);
  await sat.close();
  console.log(`menu ${W}`, JSON.stringify({ main: mainMenu, sat: satMenu }));
  ok(mainMenu && satMenu, `menu ${W}: both dropdowns open`);
  if (mainMenu && satMenu) {
    ok(mainMenu.right === satMenu.right && mainMenu.w === satMenu.w,
       `menu ${W}: same width, same right edge (main ${mainMenu.w}@${mainMenu.right}, sat ${satMenu.w}@${satMenu.right})`);
    ok(mainMenu.pad === satMenu.pad && mainMenu.itemPad === satMenu.itemPad,
       `menu ${W}: same insets (pop ${mainMenu.pad}, items ${mainMenu.itemPad})`);
  }
  await page.close();
}
await browser.close();
server.close();
if (fails) { console.log("FAILURES:", fails); process.exit(1); }
console.log("phone-nav-spread: all ok");
