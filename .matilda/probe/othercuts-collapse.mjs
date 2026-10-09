// Acceptance probe for the 2026-10-10 Other-cuts collapsible family tables
// (user: "make the different tables in 'other cuts' in demographics facet of
// all polls table collapsable").
//
// Each of the stacked family tables (six since 5fa1726 added Tasmanian
// electorates) folds away from its own head
// (.rd-ap-frow, rd-allpolls.jsx's famHead -> famShut state). Pinned here:
//  1. heads render expanded by default (aria-expanded, open chevron, no count)
//  2. clicking a head folds its table: rows AND month rows leave the DOM, the
//     head gains .shut, aria-expanded flips false and shows an "N polls" count
//  3. clicking its chevron (stopPropagation path) re-opens the table
//  4. keyboard: Enter/Space on a focused head toggles it
//  5. the up/down row walk's position math skips a folded family
//     (demFamOffset): ArrowDown from fam 3's first row lands on its second
//     row while fam 2 sits folded above it
//  6. fold choices survive a facet hop away and back, and a split hop via
//     Gender (famShut persists like demSplit - state resets only on refresh)
//  7. same on a phone width, where the folded head keeps its count visible
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

// one segment per family head: the rows/month rows between it and the next head
const segs = (page) => page.evaluate(() => {
  const rowCls = (el) => el.classList.contains("rd-ap-row") || el.classList.contains("rd-ap-card");
  const out = []; let cur = null;
  for (const el of document.querySelector(".rd-ap-table").children) {
    if (el.classList.contains("rd-ap-frow")) {
      cur = {
        lab: el.querySelector(".rd-ap-flab b").textContent,
        shut: el.classList.contains("shut"),
        expanded: el.getAttribute("aria-expanded"),
        chev: !!el.querySelector(".rd-ap-chev"),
        chevOpen: el.querySelector(".rd-ap-chev") && el.querySelector(".rd-ap-chev").classList.contains("open"),
        fn: (el.querySelector(".rd-ap-fn") || null) ? el.querySelector(".rd-ap-fn").textContent : null,
        rows: 0, months: 0,
      };
      out.push(cur);
    } else if (cur && rowCls(el)) cur.rows++;
    else if (cur && el.classList.contains("rd-ap-mrow")) cur.months++;
  }
  return out;
});

const totalRows = (page) => page.evaluate(() => document.querySelectorAll(".rd-ap-row, .rd-ap-card").length);
const clickHead = (page, i, chevOnly = false) => page.evaluate(([i, chevOnly]) => {
  const h = [...document.querySelectorAll(".rd-ap-frow")][i];
  (chevOnly ? h.querySelector(".rd-ap-chev") : h).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}, [i, chevOnly]);
const keyHead = (page, i, key) => page.evaluate(([i, key]) => {
  const h = [...document.querySelectorAll(".rd-ap-frow")][i];
  h.focus();
  h.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}, [i, key]);
const clickTab = (page, lab) => page.evaluate((lab) => {
  const b = [...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((n) => n.textContent.trim() === lab);
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}, lab);
const pickSplit = (page, lab) => page.evaluate((lab) => {
  const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === lab);
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}, lab);

console.log("== desktop 1280 ==");
{
  const page = await open(1280, "f=g&g=b");
  let s = await segs(page);
  check("six family heads, all expanded, chevroned, count hidden", s.length === 6 && s.every((x) => !x.shut && x.expanded === "true" && x.chev && x.chevOpen && x.fn == null),
    JSON.stringify(s.map((x) => [x.lab, x.shut, x.expanded, x.rows])));
  const chevAlign = await page.evaluate(() => {
    const f = document.querySelector(".rd-ap-frow .rd-ap-chev").getBoundingClientRect();
    const r = document.querySelector(".rd-ap-row .rd-ap-chev").getBoundingClientRect();
    return { dRight: Math.round(Math.abs(f.right - r.right)), fh: Math.round(f.height) };
  });
  check("head chevron lines up on the rows' last column, at head-line height", chevAlign.dRight <= 2 && chevAlign.fh <= 20, JSON.stringify(chevAlign));

  // fold the first family
  const before = { rows: await totalRows(page), first: s[0].rows, firstMonths: s[0].months };
  check("first family has rows to fold", before.first > 0 && before.firstMonths >= 1, `rows=${before.first} months=${before.firstMonths}`);
  await clickHead(page, 0);
  await settle(600);
  s = await segs(page);
  const afterFold = await totalRows(page);
  check("click folds: rows and month rows leave the DOM", s[0].shut && s[0].expanded === "false" && s[0].rows === 0 && s[0].months === 0, JSON.stringify(s[0]));
  check("fold removes exactly the family's rows", afterFold === before.rows - before.first, `${before.rows} -> ${afterFold}`);
  check("folded head shows its poll count", s[0].fn === `${before.first} poll${before.first === 1 ? "" : "s"}`, s[0].fn);
  check("folded head's chevron closes", s[0].chev && !s[0].chevOpen, "");
  check("the other five families stay open", s.slice(1).every((x) => !x.shut && x.rows > 0), JSON.stringify(s.slice(1).map((x) => [x.lab, x.rows])));

  // chevron click (stopPropagation path) re-opens
  await clickHead(page, 0, true);
  await settle(600);
  s = await segs(page);
  check("chevron re-opens the family's table", !s[0].shut && s[0].expanded === "true" && s[0].rows === before.first, JSON.stringify(s[0]));
  check("row total back", (await totalRows(page)) === before.rows, `${await totalRows(page)} vs ${before.rows}`);

  // keyboard: Space folds again, Enter re-opens
  await keyHead(page, 0, " ");
  await settle(600);
  s = await segs(page);
  check("Space on the head folds", s[0].shut, "");
  await keyHead(page, 0, "Enter");
  await settle(600);
  s = await segs(page);
  check("Enter on the head re-opens", !s[0].shut && s[0].rows === before.first, "");

  // walk math past a folded family: fold fam 1, ArrowDown from fam 2's first
  // row must land on fam 2's second row (not skip ahead by fam 1's row count)
  await clickHead(page, 1);
  await settle(600);
  const walk = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".rd-ap-table > .rd-ap-frow")];
    const table = heads[0].parentElement;
    const kids = [...table.children];
    const h2 = heads[2];
    const r0 = kids.slice(kids.indexOf(h2) + 1).find((el) => el.classList.contains("rd-ap-row"));
    r0.focus();
    r0.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    const act = document.activeElement;
    const next = kids.slice(kids.indexOf(r0) + 1).find((el) => el.classList.contains("rd-ap-row"));
    return { moved: act === next, left: act !== r0, nextExists: !!next };
  });
  check("ArrowDown inside a fam below a folded one steps one row", walk.moved === true, JSON.stringify(walk));
  s = await segs(page);
  check("fam 1 folded, fam 2 rows intact during the walk", s[1].shut && !s[2].shut && s[2].rows > 0, "");

  // fold state survives a facet hop away and back
  await clickTab(page, "2PP");
  await settle();
  check("hop to 2PP: no fam heads", (await page.evaluate(() => document.querySelectorAll(".rd-ap-frow").length)) === 0, "");
  await clickTab(page, "Demographics");
  await settle();
  s = await segs(page);
  check("back on Other cuts: fam 1 still folded, rest open", s.length === 6 && s[1].shut && s.every((x, i) => i === 1 || !x.shut), JSON.stringify(s.map((x) => x.shut)));

  // ...and a split hop out (Gender) and back
  await pickSplit(page, "Gender");
  await settle(600);
  check("Gender split: no family heads", (await page.evaluate(() => document.querySelectorAll(".rd-ap-frow").length)) === 0, "");
  await pickSplit(page, "Other cuts");
  await settle(600);
  s = await segs(page);
  check("Other cuts re-picked: fam 1 still folded", s.length === 6 && s[1].shut, JSON.stringify(s.map((x) => x.shut)));

  check("no page errors (desktop)", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

console.log("== phone 390 ==");
{
  const page = await open(390, "f=g&g=b", { touch: true });
  let s = await segs(page);
  check("phone: six expanded family heads", s.length === 6 && s.every((x) => !x.shut), JSON.stringify(s.map((x) => x.lab)));
  const before = { rows: await totalRows(page), first: s[0].rows };
  await clickHead(page, 0);
  await settle(600);
  s = await segs(page);
  const after = await totalRows(page);
  check("phone: head tap folds the table", s[0].shut && s[0].rows === 0 && after === before.rows - before.first, `${before.rows} -> ${after}`);
  const fnShown = await page.evaluate(() => {
    const fn = document.querySelector(".rd-ap-frow.shut .rd-ap-fn");
    return fn ? getComputedStyle(fn).display : "missing";
  });
  check("phone: folded head keeps its poll count on show", fnShown !== "none" && fnShown !== "missing", fnShown);
  const chevBox = await page.evaluate(() => {
    const b = document.querySelector(".rd-ap-frow.shut .rd-ap-chev");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  check("phone: the head's chevron renders", !!chevBox && chevBox.w > 0 && chevBox.h > 0, JSON.stringify(chevBox));
  check("phone: no page errors", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
