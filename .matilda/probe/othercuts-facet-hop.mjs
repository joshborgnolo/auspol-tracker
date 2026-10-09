// Acceptance probe for the 2026-10-10 Other-cuts facet-leak fix (user bug:
// "once you go on 'other cuts' in all polls table, navigating to the other
// facets doesn't work. it gets stuck and you have to refresh").
//
// Root cause: rd-allpolls.jsx's demFams (the Other-cuts stacked family
// tables) computed without a facet gate, so the surviving demSplit="country"
// state rendered the fam tables on EVERY facet after a hop (0 rows on
// Confidence, franken-tables elsewhere).
//
// Fix: demFams is gated on facet === "demographics". Pinned here:
//  1. demographics/Other-cuts still stacks (fam rows + family heads)
//  2. every facet hop from it draws normal rows, no fam rows, no errors
//  3. hopping back to Demographics restores the stacked Other-cuts view
//  4. keyboard ArrowRight from the facet menu doesn't leak either (the
//     rdTabs walk drives the same state)
//  5. same at a phone width
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch {}
}
if (!puppeteer) { console.error("no puppeteer-core"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.PAGE || `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

async function open(vw, qs, { touch = false } = {}) {
  const page = await browser.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: vw, height: 900, isMobile: touch, hasTouch: touch });
  await page.goto(`${PAGE}?${qs}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await settle(1500);
  return page;
}
const snap = (page) => page.evaluate(() => ({
  facet: ([...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent,
  famRows: document.querySelectorAll(".rd-ap-frow").length,
  famLabs: [...document.querySelectorAll(".rd-ap-frow .rd-ap-flab b")].map((b) => b.textContent),
  rows: document.querySelectorAll(".rd-ap-row, .rd-ap-card").length,
  empty: !!document.querySelector(".rd-ap-empty"),
}));
const clickTab = (page, lab) => page.evaluate((lab) => {
  const b = [...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((n) => n.textContent.trim() === lab);
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}, lab);

console.log("== desktop 1280 ==");
{
  const page = await open(1280, "f=g&g=b");
  let s = await snap(page);
  check("lands Demographics / Other cuts, five stacked family tables", s.facet === "Demographics" && s.famRows === 5, JSON.stringify(s.famLabs));

  // the user's UI path: leave via every tab
  for (const lab of ["2PP", "Primary", "Leadership", "Direction", "Issues", "Confidence"]) {
    await clickTab(page, lab);
    await settle();
    s = await snap(page);
    check(`${lab}: facet switches and draws normal rows`, s.facet === lab && s.famRows === 0 && s.rows > 0 && !s.empty,
      `${s.facet} famRows=${s.famRows} rows=${s.rows} empty=${s.empty}`);
  }
  check("no page errors on the hop-out walk", page.errs.length === 0, page.errs.join(" | "));

  await clickTab(page, "Demographics");
  await settle();
  s = await snap(page);
  check("back on Demographics: Other cuts kept, families re-stack", s.facet === "Demographics" && s.famRows === 5, `famRows=${s.famRows}`);

  // keyboard path: walk right off Demographics (Demographics → Confidence)
  await page.evaluate(() => {
    const cur = [...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((b) => b.getAttribute("aria-pressed") === "true");
    cur.focus();
    cur.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  });
  await settle();
  s = await snap(page);
  check("ArrowRight to Confidence: normal rows, no fam rows", s.facet === "Confidence" && s.famRows === 0 && s.rows > 0, `famRows=${s.famRows} rows=${s.rows}`);

  // split state must survive the round trip without leaking: pick Other cuts
  // by UI from a flat split, then hop straight to 2PP
  await clickTab(page, "Demographics");
  await settle();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === "Gender");
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(600);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === "Other cuts");
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle();
  s = await snap(page);
  check("UI-picked Other cuts re-stacks", s.famRows === 5, `famRows=${s.famRows}`);
  await clickTab(page, "2PP");
  await settle();
  s = await snap(page);
  check("hop to 2PP from a UI-picked Other cuts: clean", s.facet === "2PP" && s.famRows === 0 && s.rows > 0, `famRows=${s.famRows} rows=${s.rows}`);
  check("no page errors (desktop full walk)", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

console.log("== phone 390 ==");
{
  const page = await open(390, "f=g&g=b", { touch: true });
  let s = await snap(page);
  check("phone: Other cuts stacks", s.famRows === 5, `famRows=${s.famRows}`);
  // the phone facet menu is a button-backed <select> substitute: dispatch the
  // same change the menu would (its control sits in .rd-ap-tabs too)
  await clickTab(page, "2PP");
  await settle();
  s = await snap(page);
  check("phone: hop to 2PP clean", s.famRows === 0 && s.rows > 0, `famRows=${s.famRows} rows=${s.rows}`);
  check("phone: no page errors", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
