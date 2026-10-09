// Headless acceptance probe for the All-polls Demographics facet (user call
// 2026-10-04: design A of the three mocked - each party's vote in one of a
// poll's groups minus its vote in another, on the Primary facet's five
// figures and strip). Mirrors iss-facet.mjs's harness.
//
//  1. The sixth facet tab reads "Demographics" (phones too, since the phone
//     menu scrolls - 2026-10-08; it read "Groups" there before), sits last
//     in the arrow-key walk, and ?f=g deep-links onto it
//  2. Each split (Age, Gender, Education, Place, Home) lists exactly the
//     polls window.demPairOf finds that pair for - expectations computed
//     in-page off the live bundle, never baked - and writes ?g= for all but
//     age, the default
//  3. A row's five figures are its pair's gaps in whole points, the sub
//     names the pair, and the strip draws one dot per figure on the shared
//     ±40 scale with an Even line
//  4. Geometry parity with the other facets: tab row 44px, headings and rows
//     the same height as Primary's (58px rows, 122px phone cards), the table
//     top identical to Primary's on a laptop and to 2PP's where both carry a
//     control row (under 1000px), no sideways overflow from 320 to 1440
//  5. Sorting a party's column orders the rows by that party's gap
//  6. An opened poll leads with its whole printed table (every group, the
//     compared pair marked) and How it counts carries its own three keys,
//     with no two-party chart
//  7. ?design=old&f=g lands the old table on 2PP without a page error
//  8. Who votes for whom's poll dots (the rug and the trend charts) open the
//     poll here on their tab's split, falling back to a split the poll
//     prints (a Resolve dot from By state opens split by age)
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try {
    puppeteer = createRequire(join(base, "package.json"))("puppeteer-core");
    break;
  } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable from ~ or cwd"); process.exit(2); }

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
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

async function open(vw, qs = "", { touch = false, vh = 1000 } = {}) {
  const page = await browser.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: vw, height: vh, isMobile: touch, hasTouch: touch });
  await page.goto(`${PAGE}${qs ? "?" + qs : ""}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await settle(1500);
  return page;
}
async function showAll(page) {
  await page.evaluate(() => {
    const link = [...document.querySelectorAll(".rd-ap-more .rd-link")].find((n) => /^Show all/.test(n.textContent.trim()));
    if (link) link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(500);
}
const geometry = (page, phone) => page.evaluate((phone) => {
  const R = (el) => (el ? el.getBoundingClientRect() : null);
  const rows = [...document.querySelectorAll(phone ? ".rd-ap-card" : ".rd-ap-row")].map((r) => +r.getBoundingClientRect().height.toFixed(2));
  const sorted = rows.slice().sort((a, b) => a - b);
  return {
    tabs: +R(document.querySelector(".rd-ap-tabs")).height.toFixed(2),
    head: +R(document.querySelector(phone ? ".rd-ap-phead" : ".rd-ap-hrow")).height.toFixed(2),
    /* from the tab row, not the page: since 2026-10-08 each facet heads the
       table with its own head and dek, so the doc-top differs by design */
    top: +(R(document.querySelector(".rd-ap-table")).top - R(document.querySelector(".rd-ap-tabs")).top).toFixed(2),
    med: sorted[Math.floor(sorted.length / 2)], lo: sorted[0], hi: sorted[sorted.length - 1], n: rows.length,
    docW: document.documentElement.scrollWidth,
  };
}, phone);

/* ---------------------------------------------------------------- 1, 2, 3 */
console.log("== desktop 1280: tab, splits, rows ==");
{
  const page = await open(1280, "f=g");
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].map((b) => [b.textContent.trim(), b.getAttribute("aria-pressed")]));
  check("sixth facet tab reads Demographics", tabs.length >= 6 && tabs[5][0] === "Demographics", JSON.stringify(tabs.map((t) => t[0])));
  check("?f=g lands on it", tabs[5] && tabs[5][1] === "true");
  const SPLITS = [["age", "Age", null], ["gender", "Gender", "g"], ["education", "Education", "e"], ["place", "Place", "p"], ["home", "Home", "h"]];
  for (const [id, lab, letter] of SPLITS) {
    await page.evaluate((lab) => {
      const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === lab);
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, lab);
    await settle(600);
    await showAll(page);
    const r = await page.evaluate((id) => {
      const D = window.AUSPOL;
      const want = D.individualPolls.filter((p) => window.demPairOf(p, id)).length;
      const rows = [...document.querySelectorAll(".rd-ap-row")];
      const first = rows[0];
      const figs = first ? [...first.querySelectorAll(".rd-ap-dgap .rd-ap-pnums b")].map((b) => b.textContent) : [];
      const sub = first ? (first.querySelector(".rd-ap-dgap .rd-ap-sub") || {}).textContent : "";
      const dots = first ? first.querySelectorAll(".rd-ap-pic .rd-ap-dot").length : 0;
      const even = first ? !!first.querySelector(".rd-ap-pic .rd-ap-avg") : false;
      // the first row's poll, recomputed: whole-point gaps in the head's party order
      const heads = [...document.querySelectorAll(".rd-ap-hrow .rd-ap-pnums .rd-ap-th")].map((t) => t.textContent.replace(/[^A-Z/]/g, ""));
      const KEY = { ALP: "alp", "L/NP": "lnp", GRN: "grn", ON: "onp", OTH: "oth" };
      const who = first ? first.querySelector("[role=rowheader] b").textContent.replace(/↗/g, "").trim() : null;
      const field = first ? first.querySelector(".rd-ap-when b").textContent.trim() : null;
      const p = D.individualPolls.find((q) => q.pollster === who && q.field === field);
      const pr = p && window.demPairOf(p, id);
      const txt = (v) => (v == null ? "—" : Math.abs(v) < 0.5 ? "0" : (v > 0 ? "+" : "−") + Math.abs(Math.round(v)));
      const exp = pr ? heads.map((h) => txt(pr.gap[KEY[h]])) : [];
      return { n: rows.length, want, figs, exp, sub, lab: pr && pr.lab, dots, even, count: document.querySelector(".rd-ap-count b").textContent, g: new URLSearchParams(location.search).get("g") };
    }, id);
    check(`${lab}: lists the ${r.want} polls with that pair`, r.n === r.want && +r.count === r.want, `${r.n} rows, count ${r.count}`);
    check(`${lab}: URL ${letter ? "g=" + letter : "has no g"}`, r.g === letter, `g=${r.g}`);
    check(`${lab}: first row's figures are its pair's gaps`, JSON.stringify(r.figs) === JSON.stringify(r.exp), `${r.figs.join(" ")} v ${r.exp.join(" ")}`);
    check(`${lab}: sub names the pair`, r.sub === r.lab + ", in points", r.sub);
    check(`${lab}: one dot per figure and an Even line`, r.dots === r.figs.filter((f) => f !== "—").length && r.even, `${r.dots} dots`);
  }
  /* 5: sort by One Nation's gap, largest first */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === "Age");
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(500);
  await page.evaluate(() => {
    const th = [...document.querySelectorAll(".rd-ap-hrow .rd-ap-th")].find((t) => /^ON/.test(t.textContent.trim()));
    th.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(600);
  const col = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".rd-ap-hrow .rd-ap-pnums .rd-ap-th")].map((t) => t.textContent.trim());
    const i = heads.findIndex((h) => /^ON/.test(h));
    return [...document.querySelectorAll(".rd-ap-row")].map((r) => r.querySelectorAll(".rd-ap-dgap .rd-ap-pnums b")[i].textContent)
      .map((t) => (t === "—" ? -Infinity : +t.replace("−", "-").replace("+", "")));
  });
  check("sorting the ON column orders rows by One Nation's gap", col.length > 3 && col.every((v, j) => j === 0 || col[j - 1] >= v), col.slice(0, 6).join(" "));
  check("no page errors (desktop walk)", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

/* ---------------------------------------------------------------- 4 */
console.log("== geometry parity ==");
for (const [vw, phone] of [[1440, false], [1280, false], [1001, false], [1000, false], [901, false], [820, false], [600, true], [390, true], [360, true], [320, true]]) {
  const page = await open(vw, "", { touch: phone });
  const G = {};
  for (const [name, qs] of [["twopp", ""], ["primary", "f=p"], ["dem", "f=g"]]) {
    await page.goto(`${PAGE}${qs ? "?" + qs : ""}#allpolls`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
    await settle(1200);
    G[name] = await geometry(page, phone);
  }
  const d = G.dem, pr = G.primary, tw = G.twopp;
  const ctlRow = vw <= 1220;   // the control row's own-row cut: 1240px for the picker's seventh button (Birth country), re-cut 1220px same-day when it renamed Other cuts
  check(`${vw}: tab row 44px`, d.tabs === 44 && pr.tabs === 44, `${d.tabs}/${pr.tabs}`);
  check(`${vw}: headings match Primary`, Math.abs(d.head - pr.head) < 0.5, `${d.head} v ${pr.head}`);
  check(`${vw}: rows match Primary (${phone ? "122" : "58"}px)`, Math.abs(d.med - pr.med) < 0.5 && d.hi - d.lo < 0.75, `${d.lo}-${d.hi} v ${pr.med}`);
  check(`${vw}: table top ${ctlRow ? "= 2PP's (control row)" : "= Primary's"}`, Math.abs(d.top - (ctlRow ? tw.top : pr.top)) < 0.5, `${d.top} v ${ctlRow ? tw.top : pr.top}`);
  check(`${vw}: no sideways overflow`, d.docW <= vw && tw.docW <= vw, `${d.docW}/${tw.docW}`);
  if (phone) {
    const lab = await page.evaluate(() => [...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].map((b) => b.textContent.trim())[5]);
    check(`${vw}: phone tab reads Demographics`, lab === "Demographics", lab);
  }
  check(`${vw}: no page errors`, page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

/* ------------------------------------------------- 4b: a split pick holds the table
   Scrolled into the table, a pick reflows the rows (a different poll set)
   and the head's captions; pinAp holds the table's top where it was, as a
   facet hop does - the phone pick runs from the control row */
console.log("== a split pick holds the table ==");
for (const [vw, phone] of [[1440, false], [390, true]]) {
  const page = await open(vw, "f=g", { touch: phone, vh: 900 });
  await page.evaluate(() => {
    const t = document.querySelector(".rd-ap-table");
    window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 250, behavior: "instant" });
  });
  await settle(500);
  const drift = [];
  for (const lab of ["Education", "Gender", "Home", "Age"]) {
    const before = await page.evaluate(() => document.querySelector(".rd-ap-table").getBoundingClientRect().top);
    await page.evaluate((lab) => {
      const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => n.textContent.trim() === lab);
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, lab);
    await settle(900);
    const after = await page.evaluate(() => document.querySelector(".rd-ap-table").getBoundingClientRect().top);
    drift.push(+(after - before).toFixed(1));
  }
  check(`${vw}: the table holds its spot through four picks`, drift.every((d) => Math.abs(d) < 3), drift.join(" / ") + "px");
  check(`${vw}: no page errors`, page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

/* ---------------------------------------------------------------- 6 */
console.log("== an opened poll ==");
for (const [vw, phone] of [[1280, false], [390, true]]) {
  const page = await open(vw, "f=g", { touch: phone });
  await page.evaluate((phone) => document.querySelector(phone ? ".rd-ap-card" : ".rd-ap-row").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })), phone);
  await settle(800);
  const r = await page.evaluate((phone) => {
    const d = document.querySelector(".rd-ap-open .rd-apd");
    if (!d) return null;
    const row = document.querySelector(phone ? ".rd-ap-card.open" : ".rd-ap-row.open");
    const who = row.querySelector(phone ? ".rd-ap-firm" : "[role=rowheader] b").textContent.replace(/↗/g, "").trim();
    const D = window.AUSPOL;
    const cands = D.individualPolls.filter((q) => q.pollster === who && q.grp && window.demPairOf(q, "age"));
    const groups = [...d.querySelectorAll(".rd-apd-demwrap .rd-apd-demr:not(.rd-apd-demh):not(.rd-apd-demall)")];
    const p = cands.find((q) => Object.values(q.grp.d).reduce((a, r) => a + r.length, 0) === groups.length);
    const pr = p && window.demPairOf(p, "age");
    const marked = groups.filter((g) => g.classList.contains("on")).map((g) => g.firstChild.textContent);
    const cols = [...d.querySelectorAll(".rd-apd-demcols > .rd-apd-dem")];
    const shownHeads = cols.filter((c) => { const h = c.querySelector(".rd-apd-demh"); return h && getComputedStyle(h).display !== "none"; }).length;
    return {
      first: d.firstElementChild && d.firstElementChild.className,
      groups: groups.length, poll: !!p, marked, pair: pr ? [pr.a, pr.b] : null,
      cols: cols.length, shownHeads,
      keys: [...d.querySelectorAll(".rd-apd-r .rd-apd-k")].map((k) => k.textContent.trim()),
      railSvg: !!d.querySelector(".rd-apd-r svg"),
      docW: document.documentElement.scrollWidth,
    };
  }, phone);
  check(`${vw}: the table leads the opened poll`, r && r.first === "rd-apd-demwrap", r && r.first);
  check(`${vw}: every printed group listed`, r && r.poll, r && `${r.groups} groups`);
  check(`${vw}: the compared pair marked`, r && r.pair && JSON.stringify(r.marked) === JSON.stringify(r.pair), r && JSON.stringify(r.marked));
  check(`${vw}: ${phone ? "one head on a phone" : "three columns, each headed"}`, r && (phone ? r.shownHeads === 1 : r.cols === 3 && r.shownHeads === 3), r && `${r.cols} cols, ${r.shownHeads} heads`);
  check(`${vw}: How it counts keys`, r && JSON.stringify(r.keys) === JSON.stringify(["Printed", "In Who votes for whom", "In today’s figures"]), r && r.keys.join(" | "));
  check(`${vw}: no two-party chart in the rail`, r && !r.railSvg);
  check(`${vw}: opened poll stays inside the page`, r && r.docW <= vw, r && String(r.docW));
  check(`${vw}: no page errors`, page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

/* ---------------------------------------------------------------- 8
   Who votes for whom's poll dots open the poll on this facet (user call
   2026-10-04): a rug dot on the tab's own split; a dot whose poll can't
   draw that split (a Resolve dot from By state - it prints no city and
   country cut) on the first split the poll can; a trend-chart dot the same
   way. Mouse clicks only - a tap reads a dot, it doesn't travel */
console.log("== Who votes for whom dots open the facet ==");
{
  const page = await browser.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: 1280, height: 900 });
  const landing = () => page.evaluate(() => ({
    hash: location.hash,
    facet: ([...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent,
    split: ([...document.querySelectorAll(".rd-ap-dpick button")].find((b) => b.getAttribute("aria-checked") === "true") || {}).textContent,
    open: !!document.querySelector(".rd-ap-row.open"),
    who: ((document.querySelector(".rd-ap-row.open [role=rowheader] b") || {}).textContent || "").replace(/↗/g, "").trim(),
    table: !!document.querySelector(".rd-ap-open .rd-apd-demwrap"),
  }));
  const toWv = async (tabLabel) => {
    await page.goto(`${PAGE}#now`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#who-votes .rd-wv-tabs button", { timeout: 30000 });
    await settle(1200);
    if (tabLabel !== "Age") {
      await page.evaluate((lab) => {
        const b = [...document.querySelectorAll("#who-votes .rd-wv-tabs button")].find((n) => n.textContent.trim() === lab);
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }, tabLabel);
      await settle(900);
    }
  };
  // a rug dot, clicked with a real mouse at its own centre
  const clickRug = async (setRe, firmRe) => {
    const pt = await page.evaluate((setSrc, firmSrc) => {
      const sets = [...document.querySelectorAll("#who-votes .rd-wv-set")].filter((s) => new RegExp(setSrc).test(s.querySelector(".rd-wv-sethead").textContent));
      const dot = sets.flatMap((s) => [...s.querySelectorAll(".rd-wv-rug b[role=button]")]).find((b) => new RegExp(firmSrc).test(b.getAttribute("aria-label")));
      if (!dot) return null;
      dot.scrollIntoView({ block: "center", behavior: "instant" });
      const r = dot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, lab: dot.getAttribute("aria-label") };
    }, setRe.source, firmRe.source);
    if (!pt) return null;
    await page.mouse.move(pt.x, pt.y);
    await settle(200);
    await page.mouse.click(pt.x, pt.y);
    await settle(1600);
    return pt.lab;
  };

  await toWv("Age");
  const l1 = await clickRug(/^By age/, /^YouGov|^DemosAU|^Resolve/);
  const a1 = await landing();
  check("an Age rug dot opens All polls", !!l1 && a1.hash === "#allpolls", l1 + " -> " + a1.hash);
  check("…on Demographics, split by age, the poll open with its table", a1.facet === "Demographics" && a1.split === "Age" && a1.open && a1.table, JSON.stringify(a1));
  check("…the poll the dot named", !!l1 && l1.startsWith(a1.who), a1.who);

  await toWv("Place");
  const l2 = await clickRug(/^By state/, /^Resolve/);
  const a2 = await landing();
  check("a Resolve dot from By state falls back to a split Resolve prints", !!l2 && a2.facet === "Demographics" && a2.split === "Age" && a2.open && a2.who === "Resolve", (l2 || "no dot") + " -> " + JSON.stringify(a2));
  await toWv("Place");
  const l3 = await clickRug(/^By location/, /^YouGov|^RedBridge/);
  const a3 = await landing();
  check("a By location dot opens split by place", !!l3 && a3.split === "Place" && a3.open, (l3 || "no dot") + " -> " + JSON.stringify(a3));

  // a trend-chart dot: hover the chart until the tip names a poll, then click
  await toWv("Gender");
  const hit = await page.evaluate(() => {
    const dots = [...document.querySelectorAll("#who-votes .rd-wv-chart svg .scatter-dot")];
    const d = dots.find((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.top > 0; }) || dots[0];
    if (!d) return null;
    d.scrollIntoView({ block: "center", behavior: "instant" });
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (hit) {
    await page.mouse.move(hit.x - 3, hit.y);
    await settle(150);
    await page.mouse.move(hit.x, hit.y);
    await settle(300);
    await page.mouse.click(hit.x, hit.y);
    await settle(1600);
  }
  const a4 = await landing();
  check("a Gender trend-chart dot opens Demographics split by gender", !!hit && a4.hash === "#allpolls" && a4.facet === "Demographics" && a4.split === "Gender" && a4.open, JSON.stringify(a4));
  check("no page errors (dot trips)", page.errs.length === 0, page.errs.join(" | "));
  await page.close();
}

/* ---------------------------------------------------------------- 7 */
console.log("== old design ==");
{
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${PAGE}?design=old&f=g#allpolls`, { waitUntil: "domcontentloaded" });
  await settle(2500);
  const r = await page.evaluate(() => ({ rows: document.querySelectorAll("tr.arch-row").length, f: new URLSearchParams(location.search).get("f") }));
  check("?design=old&f=g opens the old table", r.rows > 0, `${r.rows} rows`);
  check("…on 2PP (the old table has no demographics columns)", r.f === null, `f=${r.f}`);
  check("no page errors (old design)", errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
