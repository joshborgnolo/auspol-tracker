/* headless probe of the Preference-flows-explained card's Space claim
   (d464f137's spacebar viewport claim, .build/newtracker/assets/
   rd-allpolls.jsx RdExplained): flipping the chart's "Share:" side,
   "Labor ⇄" / the rival's name.
   The claim flips the Share side while the card intersects the viewport
   and hands Space back the moment it leaves. The 2026-10-21 admission
   (user report): clicking a contest tab ("Labor v Coalition" /
   "Labor v One Nation") leaves Chrome's focus on the now-pressed tab,
   where the key would only dead-fire the same contest pick — the
   SELECTED tab owns Space the flip's way, the /flows/ ledger's contest
   admission (flows-ledger.mjs pins that one). Checks, desktop 1440:
     - landing anatomy: two contest tabs, Labor v Coalition pressed, the
       Share control reading "Share: Labor ⇄", unpressed;
     - blurred focus: Space flips the Share side (button texts invert,
       the .rd-chead title swaps the sides), the page never moves;
     - selected contest tabs: after a mouse pick of EITHER tab (the
       click's focus sits on it), Space flips the Share side with the
       tab's pick and focus staying put, again with no page scroll;
     - day jobs kept: an UNPRESSED contest tab keeps native Space (its
       native activation picks it — the contest flips, Share untouched);
       the elections menu keeps its Space (Share untouched); the focused
       Share button natively taps itself exactly once (no double-flip);
     - release: with the card scrolled clear off screen, Space is the
       page scroll's again and the Share side sits untouched.
   Run against a built tree: node .matilda/probe/explained-space-share.mjs
   (PAGE=http://... to run over http, which loads the fonts) */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "flows-explained", "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#flows-explained .ex-fl-tabs .rd-tab", { timeout: 30000 });
await wait(300);

const read = () => page.evaluate(() => {
  const sec = document.querySelector("#flows-explained");
  const share = sec.querySelector(".ex-share .rd-pl-flip");
  const card = sec.querySelector(".ex-fl-card");
  return {
    tabs: [...sec.querySelectorAll(".ex-fl-tabs .rd-tab")].map((b) => ({ t: b.textContent, on: b.getAttribute("aria-pressed") === "true" })),
    shareLabel: (sec.querySelector(".ex-share .rd-pl-ctl-l") || {}).textContent || null,
    shareText: share.textContent.replace(/\s+/g, " ").trim(),
    shareOn: share.getAttribute("aria-pressed") === "true",
    title: sec.querySelector(".ex-fl-head .rd-chead-t").childNodes[0].textContent.trim(),
    focused: (document.activeElement && (document.activeElement.textContent.replace(/\s+/g, " ").trim() + "|" + document.activeElement.tagName)) || null,
    sel: sec.querySelector(".ex-fl-sel") ? "here" : null,
    y: Math.round(window.scrollY),
    cardOut: (() => { const r = card.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; })(),
  };
});
const park = async () => {
  await page.evaluate(() => {
    document.querySelector("#flows-explained .ex-fl-card").scrollIntoView({ block: "center" });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  await wait(300);
};
const clickTab = async (label) => {
  const el = await page.evaluateHandle((t) => {
    return [...document.querySelectorAll("#flows-explained .ex-fl-tabs .rd-tab")].find((b) => b.textContent.includes(t));
  }, label);
  await el.asElement().click();
  await wait(250);
};
const space = async () => { await page.keyboard.press("Space"); await wait(200); };

console.log("== landing anatomy ==");
{
  await park();
  const r = await read();
  check(r.tabs.length === 2 && r.tabs[0].on && !r.tabs[1].on, "two contest tabs, Labor v Coalition pressed: " + JSON.stringify(r.tabs));
  check(r.shareLabel === "Share:", "the control is labelled Share: — got " + JSON.stringify(r.shareLabel));
  check(r.shareText === "Labor ⇄" && !r.shareOn, "Share opens unpressed as Labor ⇄ — got " + JSON.stringify(r.shareText));
  check(r.title.indexOf("Preferences to Labor over the Coalition") === 0, "the title names the Labor side: " + r.title);
}

console.log("== blurred focus: Space flips the Share side ==");
{
  const y0 = (await read()).y;
  await space();
  let r = await read();
  check(r.shareText === "Coalition ⇄" && r.shareOn, "Space flipped Share to Coalition ⇄ — got " + JSON.stringify(r.shareText));
  check(r.title.indexOf("Preferences to the Coalition over Labor") === 0, "the title swapped sides: " + r.title);
  check(r.y === y0, "the page never scrolled while claimed (y " + y0 + " -> " + r.y + ")");
  await space();
  r = await read();
  check(r.shareText === "Labor ⇄" && !r.shareOn, "a second Space flipped Share back — got " + JSON.stringify(r.shareText));
}

console.log("== the selected contest tab owns Space the flip's way ==");
{
  await page.evaluate(() => document.querySelector("#flows-explained .ex-fl-card").scrollIntoView({ block: "center" }));
  await wait(300);
  await clickTab("Labor v One Nation");
  let r = await read();
  check(r.tabs[1].on, "the click picked Labor v One Nation");
  check(r.focused !== null && r.focused.indexOf("Labor v One Nation") === 0 && r.focused.endsWith("|BUTTON"),
    "the click's focus sits on the picked tab — got " + JSON.stringify(r.focused));
  const y0 = r.y;
  await space();
  r = await read();
  check(r.shareText === "One Nation ⇄" && r.shareOn, "Space from the selected One Nation tab flipped Share — got " + JSON.stringify(r.shareText));
  check(r.title.indexOf("Preferences to One Nation over Labor") === 0, "the One Nation chart's title swapped sides: " + r.title);
  check(r.tabs[1].on, "the contest pick stayed put (still Labor v One Nation)");
  check(r.focused && r.focused.indexOf("Labor v One Nation") === 0, "the tab kept its focus — got " + JSON.stringify(r.focused));
  check(r.y === y0, "no scroll from the pressed tab (y " + y0 + " -> " + r.y + ")");
  await space();
  r = await read();
  check(r.shareText === "Labor ⇄" && !r.shareOn, "and flipped back on the next Space — got " + JSON.stringify(r.shareText));
  await clickTab("Labor v Coalition");
  r = await read();
  check(r.tabs[0].on, "back on Labor v Coalition");
  const y1 = r.y;
  await space();
  r = await read();
  check(r.shareText === "Coalition ⇄" && r.shareOn, "the Coalition tab's admission flips Share too — got " + JSON.stringify(r.shareText));
  check(r.tabs[0].on && r.y === y1, "pick and scroll both stayed put on the Coalition tab");
}

console.log("== day jobs kept ==");
{
  // an unpressed contest tab keeps native Space: activation picks it
  await page.evaluate(() => {
    [...document.querySelectorAll("#flows-explained .ex-fl-tabs .rd-tab")][1].focus();
  });
  await wait(150);
  await space();
  let r = await read();
  check(r.tabs[1].on, "an unpressed contest tab keeps Space's day job (native activation picked Labor v One Nation)");
  check(r.shareOn && r.shareText === "One Nation ⇄", "…and the share side sat that native pick out (the label just followed the pairing) — got " + JSON.stringify(r.shareText));
  // the elections menu keeps its Space (its native open); the menu only
  // mounts on the Coalition history, so pick it back first
  await clickTab("Labor v Coalition");
  await page.evaluate(() => document.querySelector("#flows-explained .ex-fl-sel").focus());
  await wait(150);
  await space();
  r = await read();
  check(r.shareText === "Coalition ⇄", "the elections menu kept its Space (Share untouched) — got " + JSON.stringify(r.shareText));
  check(r.focused === null || r.focused.endsWith("|SELECT"), "the menu kept its focus — got " + JSON.stringify(r.focused));
  // the focused Share button natively taps itself exactly once
  await page.evaluate(() => document.querySelector("#flows-explained .ex-share .rd-pl-flip").focus());
  await wait(150);
  await space();
  r = await read();
  check(r.shareText === "Labor ⇄" && !r.shareOn, "a focused Share button taps itself exactly once — got " + JSON.stringify(r.shareText));
}

console.log("== off the card, Space is the page's again ==");
{
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const card = document.querySelector("#flows-explained .ex-fl-card");
    /* offsetTop is offsetParent-relative, not document-relative - park by
       the rect (spacebar claim's viewport check) */
    window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY + card.offsetHeight + 200);
  });
  await wait(300);
  const r0 = await read();
  check(r0.cardOut, "parked with the whole card off screen");
  const y0 = r0.y;
  await space();
  const r = await read();
  check(r.y > y0, "Space scrolled the page with the claim released (y " + y0 + " -> " + r.y + ")");
  check(r.shareText === "Labor ⇄", "the Share side sat untouched — got " + JSON.stringify(r.shareText));
}

check(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
await browser.close();
console.log(fails ? "FAILURES: " + fails : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
