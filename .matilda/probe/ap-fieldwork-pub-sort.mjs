/* Probe (run: node .matilda/probe/ap-fieldwork-pub-sort.mjs): the All-polls
   table's FIELDWORK/PUB two-way sort head (user call 2026-10-13, reverting
   b4a806e's publication-default sort half a day after it shipped). The date
   column's head is two sortable halves in one cell: FIELDWORK (the default)
   and PUB (publication day, newest first); the month dividers file rows by
   the LIVE half's month - under Pub a wave that crossed a month-end in the
   press (the DemosAU MRP, September fieldwork / published 12 Oct 2026) sits
   under OCTOBER, where b4a806e's ym-keyed grouping made 2026-09 a duplicate
   fragment key and the press says "October" beside a September divider.
   Pins: the split head renders and defaults to Fieldwork-descending;
   divider labels are unique + descending in both views; under Pub every
   row's "released <d> <Mon>" sub names its divider's month; the two views
   file at least one wave differently; clicking Fieldwork restores the exact
   default grouping. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });
await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
await page.goto(APAGE, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-ap-hfp", { timeout: 30000 });
/* the archive renders the newest 30 rows before its "Show all N" fold
   (minShown, rd-allpolls.jsx :2652) - the month-filing contract holds over
   the WHOLE table, so open the fold before reading dividers. The fold also
   RESETS on every sort change (fKey carries sort.key|dir), so re-open it
   after each flip below. */
const openFold = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".rd-ap-more button")].find((el) => /^Show all /.test(el.textContent.trim()));
    if (b) b.click();
  });
  await page.waitForFunction(() => !document.querySelector(".rd-ap-more button"), { timeout: 15000 });
};
await openFold();

const MNF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* the divider strip as [{lab, rows:[who|when…]}…] in display order */
const groupsOf = () => page.evaluate(() => {
  const out = [];
  let cur = null;
  for (const el of document.querySelectorAll(".rd-ap-mrow, .rd-ap-row")) {
    if (el.classList.contains("rd-ap-mrow")) {
      const b = el.querySelector(".rd-ap-mlab b");
      cur = { lab: b ? b.textContent.trim() : el.textContent.trim(), rows: [] };
      out.push(cur);
    } else if (cur) {
      const who = el.querySelector(".rd-ap-who");
      const when = el.querySelector(".rd-ap-when b");
      const sub = el.querySelector(".rd-ap-when .rd-ap-sub");
      cur.rows.push({
        id: ((who ? who.textContent : "") + "|" + (when ? when.textContent : "")).replace(/\s+/g, " ").trim(),
        sub: sub ? sub.textContent.replace(/\s+/g, " ").trim() : null,
      });
    }
  }
  return out;
});
const ymOrderOK = (groups) => {
  const ys = groups.map((g) => {
    const m = g.lab.match(/^([A-Z][a-z]+) (\d{4})/);
    if (!m) return null;
    return +m[2] * 100 + MNF.indexOf(m[1]);
  });
  if (ys.some((y) => y == null || y < 0)) return { ok: false, uniq: false };
  const uniq = new Set(ys).size === ys.length;
  const desc = ys.every((y, i) => i === 0 || y < ys[i - 1]);
  return { ok: uniq && desc, uniq };
};

/* 1. the split head ------------------------------------------------------- */
const head = await page.evaluate(() => {
  const hfp = document.querySelector(".rd-ap-hfp");
  if (!hfp) return null;
  const ths = [...hfp.querySelectorAll(".rd-ap-th")].map((t) => ({
    txt: t.textContent.trim(),
    on: t.classList.contains("on"),
    sort: t.getAttribute("aria-sort"),
    tag: t.tagName.toLowerCase(),
  }));
  return { ths, sep: !!hfp.querySelector(".rd-ap-hfsep"), ariaSortAttrPresent: ths.some((t) => t.sort) };
});
check(!!head && head.ths.length === 2 && head.ths.every((t) => t.tag === "button"),
  `date head is ONE cell of two columnheader buttons (got ${head ? head.ths.map((t) => t.tag + ":" + t.txt).join(" + ") : "NO .rd-ap-hfp"})`);
check(!!head && /^Fieldwork/.test(head.ths[0].txt) && /^Pub/.test(head.ths[1].txt) && head.sep,
  `halves read Fieldwork / Pub (got "${head ? head.ths.map((t) => t.txt).join(", ") : "—"}")`);
check(!!head && head.ths[0].on && !head.ths[1].on && head.ths[0].sort === "descending",
  `Fieldwork half is the live default, descending (on=${head && head.ths.map((t) => t.on).join("/")}, aria-sort=${head && head.ths[0].sort})`);

/* 2. default view = fieldwork filing -------------------------------------- */
const g0 = await groupsOf();
const o0 = ymOrderOK(g0);
check(g0.length > 3 && o0.ok, `default dividers unique + strictly descending (${g0.length} groups${o0.uniq ? "" : ", DUPLICATE LABELS"})`);

/* 3. Pub view --------------------------------------------------------------
   flip via the second half of the split head */
await page.evaluate(() => {
  const ths = [...document.querySelectorAll(".rd-ap-hfp .rd-ap-th")];
  const pub = ths.find((t) => /^Pub/.test(t.textContent.trim()));
  if (pub) pub.click();
});
await page.waitForFunction(
  () => [...document.querySelectorAll(".rd-ap-hfp .rd-ap-th")].some((t) => /^Pub/.test(t.textContent.trim()) && t.classList.contains("on")),
  { timeout: 10000 });
await openFold();
const g1 = await groupsOf();
const o1 = ymOrderOK(g1);
check(g1.length > 3 && o1.ok, `Pub dividers unique + strictly descending (${g1.length} groups${o1.uniq ? "" : ", DUPLICATE LABELS"})`);
/* every row with a "released" sub must name its Pub divider's month */
let subbed = 0, mismatched = [];
for (const g of g1) {
  const dm = g.lab.match(/^([A-Z][a-z]+) (\d{4})/);
  if (!dm) continue;
  for (const r of g.rows) {
    if (!r.sub || !/^released /.test(r.sub)) continue;
    subbed++;
    const sm = MN.find((mn) => new RegExp("released \\d{1,2} " + mn + "\\b").test(r.sub));
    if (!sm || MNF[MN.indexOf(sm)] !== dm[1]) mismatched.push(`${r.id} (${r.sub}) under ${g.lab}`);
  }
}
check(mismatched.length === 0 && subbed >= 10,
  `Pub filing: every released sub names its divider's month (${subbed} rows checked${mismatched.length ? "; OFF BASIS: " + mismatched.slice(0, 3).join("; ") : ""})`);
/* the two views must file at least one wave differently (the month-crossing
   witness - today the DemosAU MRP, Sep fieldwork / 12 Oct published) */
const key0 = new Map(), key1 = new Map();
g0.forEach((g) => g.rows.forEach((r) => key0.set(r.id, g.lab)));
g1.forEach((g) => g.rows.forEach((r) => key1.set(r.id, g.lab)));
const moved = [...key0.keys()].filter((k) => key1.has(k) && key1.get(k) !== key0.get(k));
check(moved.length >= 1, `Pub filing refiles at least one wave to its release month (${moved.length ? moved.map((k) => k.split("|")[0]).slice(0, 2).join(", ") + (moved.length > 2 ? " …" : "") : "none - find the new witness if data changed"})`);

/* 4. back to Fieldwork restores the exact default grouping ---------------- */
await page.evaluate(() => {
  const ths = [...document.querySelectorAll(".rd-ap-hfp .rd-ap-th")];
  const fw = ths.find((t) => /^Fieldwork/.test(t.textContent.trim()));
  if (fw) fw.click();
});
await page.waitForFunction(
  () => [...document.querySelectorAll(".rd-ap-hfp .rd-ap-th")].some((t) => /^Fieldwork/.test(t.textContent.trim()) && t.classList.contains("on")),
  { timeout: 10000 });
await openFold();
const g2 = await groupsOf();
const same = g2.length === g0.length && g2.every((g, i) => g.lab === g0[i].lab && g.rows.length === g0[i].rows.length && g.rows.every((r, j) => r.id === g0[i].rows[j].id));
check(same, `Fieldwork re-click restores the exact default grouping (${g2.length} vs ${g0.length} groups)`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
