/* headless probe of the All-polls Preference flows section as rebuilt
   2026-10-13 (design B of that day's mockups, the user's pick after "an
   ill-conceived and disordered hodgepodge - especially on small screens").
   Replaces rd-forced-charts.mjs (the retired three-chart probe). Checks,
   at 1440 and 390, with tooltip bounds also at 360 and 320:
     - anatomy: three contest tabs (Labor v Coalition pressed by default -
       the page's contest), a ledger of three voter-group rows per tab, each
       with a line, then the contest's drift chart (none on Coalition v One
       Nation, where no pollster publishes a two-party figure); the region
       menu sits in the ledger's head, the highlight menu in the chart's;
     - the figures: every ledger cell equals the payload - the 2025 count
       (elec2025r, one decimal), the site's One Nation table and band
       (flowTables), RedBridge/Accent's latest wave, DemosAU's latest MRP
       (All voters = its `all` weighting), each group's share the headline
       primary vote; the "down from" note rides the battery's Yes alone;
     - the line: RedBridge's waves alone draw it (one vertex per wave) and
       DemosAU's triangles stand apart (user call 2026-10-13), the
       assumption a dotted line across every row with a reference;
     - the region menu: a named region empties RedBridge/Accent's column
       and marks (national only), drops the 2026 counts, rekeys DemosAU's
       cells and, on Labor v Coalition, the count column to the class's
       seat replay, and rekeys each group's "…% of the vote" to the
       class's 2025 count (elec2025p) — All voters keeps the headline
       primary;
     - tooltips: every ledger mark and the drift chart's first, middle and
       last dots open a tip inside the screen at 390/360/320 by touch (the
       bug the user reported: DemosAU tips 371-410px on a 390px phone), the
       page never widens; a tap outside puts a touch tip away; a desktop
       mouse click on a RedBridge mark opens that poll in the table;
     - keys: with the pointer over the section <-/-> walks and wraps the
       contest row both ways; while the section is on screen Space cycles
       the region menu (All, inner, outer, regional) - claims released
       off-screen and off-pointer;
     - the page's two-party flip (the house-lean section's switch) carries
       the tab to Labor v One Nation and back.
   Run against a built tree: node .matilda/probe/flows-ledger.mjs
   (PAGE=http://... to run over http, which loads the fonts) */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "allpolls", "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const open = async (w) => {
  const page = await browser.newPage();
  const phone = w < 700;
  await page.setViewport({ width: w, height: phone ? 800 : 900, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#flow-drift .rd-fx-row", { timeout: 30000 });
  return { page, errs, phone };
};
const tab = async (page, i) => { await page.evaluate((i) => document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")[i].click(), i); await wait(200); };
const region = async (page, r) => { await page.select('#flow-drift select[aria-label="Region"]', r); await wait(200); };
const read = (page) => page.evaluate(() => {
  const sec = document.querySelector("#flow-drift");
  return {
    tabs: [...sec.querySelectorAll(".rd-fl-tabs .rd-tab")].map((b) => ({ t: b.textContent, on: b.getAttribute("aria-pressed") === "true" })),
    rows: [...sec.querySelectorAll(".rd-fx-row")].map((r) => ({
      who: r.querySelector(".rd-fx-who b").textContent,
      share: (r.querySelector(".rd-fx-who .rd-ap-sub") || {}).textContent || null,
      cells: [...r.querySelectorAll(".rd-fx-n")].map((c) => c.childNodes[0] ? c.childNodes[0].textContent.trim() : ""),
      band: (r.querySelector(".rd-fx-band") || {}).textContent || null,
      chg: (r.querySelector(".rd-fx-chg") || {}).textContent || null,
      waves: r.querySelectorAll(".rd-fx-dot").length + r.querySelectorAll(".rd-fx-end").length,
      tris: r.querySelectorAll(".rd-fx-tr").length,
      crosses: r.querySelectorAll(".rd-fx-x").length,
      ref: r.querySelectorAll(".rd-fx-ref").length,
      lineVerts: (() => { const p = r.querySelector(".rd-fx-line"); return p ? (p.getAttribute("d").match(/[MC]/g) || []).length : 0; })(),
      empty: (r.querySelector(".rd-fl-empty") || {}).textContent || null,
    })),
    drift: sec.querySelectorAll(".rd-fl-chart").length,
    regInLedger: !!sec.querySelector('.rd-fl-lhead select[aria-label="Region"]'),
    pickInDrift: !!sec.querySelector('.rd-fl-dhead select[aria-label="Highlight a pollster"]'),
    head: sec.querySelector(".rd-hed").textContent,
    sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
});
const expect = (page) => page.evaluate(() => {
  const D = window.AUSPOL, FF = D.flowForced, FT = D.flowTables, PR = D.latest.primary;
  const last = (ws, ck) => { const w = [...(ws || [])].reverse().find((x) => x[ck] != null); return w ? w[ck] : null; };
  const all = (ws) => (ws || []).map((w) => (w.all ? { ...w, ...w.all } : w));
  const reg = (ws, r) => (ws || []).map((w) => (w[r] ? { ...w, ...w[r] } : null)).filter(Boolean);
  return {
    co: { grn: [FF.elec2025r.all.grn, last(FF.vsCoal, "grn"), last(FF.demos, "grn")], onp: [FF.elec2025r.all.onp, last(FF.vsCoal, "onp"), last(FF.demos, "onp")], oth: [FF.elec2025r.all.oth, last(FF.vsCoal, "oth"), last(FF.demos, "oth")] },
    on: { coal: [FT.onp.lnp * 100, last(FF.vsOn, "coal"), last(all(FF.demosOn), "coal")], grn: [FT.onp.grn * 100, last(FF.vsOn, "grn"), last(all(FF.demosOn), "grn")], oth: [FT.onp.oth * 100, last(FF.vsOn, "oth"), last(all(FF.demosOn), "oth")] },
    ln: { alp: [null, null, last(all(FF.lnpOn), "alp")], grn: [null, null, last(all(FF.lnpOn), "grn")], oth: [null, null, last(all(FF.lnpOn), "oth")] },
    onReg: { coal: last(reg(FF.demosOn, "regional"), "coal"), grn: last(reg(FF.demosOn, "regional"), "grn"), oth: last(reg(FF.demosOn, "regional"), "oth") },
    coInner: { grn: FF.elec2025r.inner.grn, onp: FF.elec2025r.inner.onp, oth: FF.elec2025r.inner.oth },
    waves: { co: { grn: FF.vsCoal.filter((w) => w.grn != null).length, onp: FF.vsCoal.filter((w) => w.onp != null).length, oth: FF.vsCoal.filter((w) => w.oth != null).length },
             on: { coal: FF.vsOn.filter((w) => w.coal != null).length, grn: FF.vsOn.filter((w) => w.grn != null).length, oth: FF.vsOn.filter((w) => w.oth != null).length } },
    demosCo: (FF.demos || []).filter((w) => w.onp != null).length,
    demosOn: (FF.demosOn || []).length,
    bys: { coal: (FF.bys || []).filter((d) => d.coal != null).length, grn: (FF.bys || []).filter((d) => d.grn != null).length, oth: (FF.bys || []).filter((d) => d.oth != null).length },
    share: { grn: PR.grn, onp: PR.onp, oth: PR.oth, coal: PR.lnp, alp: PR.alp },
    /* the named-region shares are the 2025 election's over that seat
       class (elec2025p): coal rides the lnp key */
    shareReg: { inner: Object.fromEntries(Object.entries(FF.elec2025p.inner).map(([k, v]) => [k === "lnp" ? "coal" : k, v])),
                outer: Object.fromEntries(Object.entries(FF.elec2025p.outer).map(([k, v]) => [k === "lnp" ? "coal" : k, v])),
                regional: Object.fromEntries(Object.entries(FF.elec2025p.regional).map(([k, v]) => [k === "lnp" ? "coal" : k, v])) },
  };
});
const fig = (v, dp) => (v == null ? "–" : dp != null ? v.toFixed(dp) : Math.round(v * 10) % 10 === 0 ? String(Math.round(v)) : v.toFixed(1));

for (const w of [1440, 390]) {
  const { page, errs, phone } = await open(w);
  const E = await expect(page);
  let s = await read(page);
  check(s.tabs.map((t) => t.t).join("|") === "Labor v Coalition|Labor v One Nation|Coalition v One Nation" && s.tabs[0].on,
    `${w}: three contest tabs, Labor v Coalition pressed by default`);
  check(s.regInLedger && s.pickInDrift, `${w}: the region menu sits in the ledger's head, the highlight menu in the chart's head`);
  check(s.rows.length === 3 && s.drift === 1, `${w}: Labor v Coalition: three rows and its drift chart (${s.rows.length}, ${s.drift})`);
  const coWant = ["grn", "onp", "oth"].map((ck) => [fig(E.co[ck][0], 1), fig(E.co[ck][1]), fig(E.co[ck][2])].join(" "));
  check(s.rows.map((r) => r.cells.join(" ")).join(" / ") === coWant.join(" / "),
    `${w}: Labor v Coalition cells = the 2025 count, RedBridge's and DemosAU's latest (${s.rows.map((r) => r.cells.join(" ")).join(" / ")})`);
  check(s.rows.every((r, i) => r.share === E.share[["grn", "onp", "oth"][i]].toFixed(1) + "% of the vote"), `${w}: each group's share is the headline primary vote`);
  check(s.rows.map((r) => r.waves).join() === [E.waves.co.grn, E.waves.co.onp, E.waves.co.oth].join(), `${w}: one dot per RedBridge wave on each row`);
  check(s.rows.every((r, i) => r.lineVerts === [E.waves.co.grn, E.waves.co.onp, E.waves.co.oth][i]),
    `${w}: each line runs through RedBridge's waves alone (vertices ${s.rows.map((r) => r.lineVerts)})`);
  check(s.rows[1].tris === E.demosCo && s.rows[0].tris === 0, `${w}: DemosAU's national figure stands apart as triangles on the One Nation row (${s.rows[1].tris})`);
  check(s.rows.every((r) => r.ref === 1), `${w}: the 2025 count runs dotted across every row`);
  check(s.rows.filter((r) => r.chg).length <= 1, `${w}: at most one change note - a tail names a group only when the battery says it moved`);
  check(s.sw <= s.iw, `${w}: no sideways overflow (${s.sw}/${s.iw})`);

  await tab(page, 1);
  s = await read(page);
  const onWant = ["coal", "grn", "oth"].map((ck) => [fig(E.on[ck][0]), fig(E.on[ck][1]), fig(E.on[ck][2])].join(" "));
  check(s.rows.map((r) => r.who.replace(" voters", "")).join() === "Coalition,Greens,Other" && s.drift === 1, `${w}: Labor v One Nation lists Coalition, Greens, Other with its drift chart`);
  check(s.rows.map((r) => r.cells.join(" ")).join(" / ") === onWant.join(" / "),
    `${w}: Labor v One Nation cells = the site's table, RedBridge, DemosAU's all-regions weighting (${s.rows.map((r) => r.cells.join(" ")).join(" / ")})`);
  check(s.rows.every((r) => r.band && /^±/.test(r.band)), `${w}: the site's table carries its band`);
  check(s.rows.map((r) => r.crosses).join() === [E.bys.coal, E.bys.grn, E.bys.oth].join(), `${w}: the 2026 counts ride as crosses (${s.rows.map((r) => r.crosses)})`);
  check(s.rows.every((r) => r.tris === E.demosOn), `${w}: DemosAU's quarterlies stand apart as triangles`);
  await region(page, "regional");
  s = await read(page);
  check(s.rows.every((r) => r.cells[1] === "–" && r.waves === 0 && r.crosses === 0), `${w}: a named region drops RedBridge/Accent and the 2026 counts`);
  check(s.rows.map((r) => r.cells[2]).join() === ["coal", "grn", "oth"].map((ck) => fig(E.onReg[ck])).join(), `${w}: Regional rekeys DemosAU to its printed regional cells (${s.rows.map((r) => r.cells[2])})`);
  check(s.rows.every((r, i) => r.share === E.shareReg.regional[["coal", "grn", "oth"][i]].toFixed(1) + "% of the vote"),
    `${w}: a named region rekeys the groups' vote shares to the class's 2025 count (${s.rows.map((r) => r.share)})`);
  await region(page, "");

  await tab(page, 2);
  s = await read(page);
  check(s.rows.map((r) => r.who.replace(" voters", "")).join() === "Labor,Greens,Other" && s.drift === 0, `${w}: Coalition v One Nation lists Labor, Greens, Other and draws no drift chart`);
  check(s.rows.map((r) => r.cells[2]).join() === ["alp", "grn", "oth"].map((ck) => fig(E.ln[ck][2])).join() && s.rows.every((r) => r.cells[0] === "–" && r.cells[1] === "–"),
    `${w}: Coalition v One Nation: DemosAU alone, no assumption, no RedBridge`);

  await tab(page, 0);
  await region(page, "inner");
  s = await read(page);
  check(s.rows.map((r) => r.cells[0]).join() === ["grn", "onp", "oth"].map((ck) => fig(E.coInner[ck], 1)).join(), `${w}: Inner metro rekeys the count column to the class's seat replay (${s.rows.map((r) => r.cells[0])})`);
  check(s.rows.every((r, i) => r.share === E.shareReg.inner[["grn", "onp", "oth"][i]].toFixed(1) + "% of the vote"),
    `${w}: Inner metro rekeys the groups' vote shares to the class's 2025 count (${s.rows.map((r) => r.share)})`);
  check(s.rows.every((r) => r.waves === 0 && r.tris === 0 && r.empty), `${w}: Labor v Coalition by region: no poll marks, the row says why`);
  await region(page, "");

  /* the page's two-party flip carries the tab */
  const flipped = await page.evaluate(() => { const b = document.querySelector("#house-lean .rd-pl-flip"); if (!b) return false; b.click(); return true; });
  await wait(400);
  s = await read(page);
  check(flipped && s.tabs[1].on, `${w}: the page's flip to Labor v One Nation carries the tab (${s.tabs.map((t) => (t.on ? "[" + t.t + "]" : t.t)).join(" ")})`);
  await page.evaluate(() => document.querySelector("#house-lean .rd-pl-flip").click());
  await wait(400);
  s = await read(page);
  check(s.tabs[0].on, `${w}: and back to Labor v Coalition`);

  if (!phone) {
    /* a mouse click on a RedBridge mark opens that poll in the table */
    const pt = await page.evaluate(() => {
      const sp = document.querySelectorAll("#flow-drift .rd-fx-spark")[1];
      sp.scrollIntoView({ block: "center", behavior: "instant" });
      const c = [...sp.querySelectorAll(".rd-fx-hit.link")].pop();
      const b = c.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, label: c.getAttribute("aria-label") };
    });
    await page.mouse.move(pt.x, pt.y); await wait(200);
    const hint = await page.evaluate(() => (document.querySelector("#flow-drift .rd-fx-tip .tip-hint") || {}).textContent || null);
    check(hint === "Click to open this poll in All polls", `${w}: the hover tip offers to open the poll (${hint})`);
    await page.mouse.click(pt.x, pt.y); await wait(900);
    const opened = await page.evaluate(() => document.querySelectorAll(".rd-ldg").length);
    check(opened === 1, `${w}: clicking the mark opens its poll in the table (${pt.label.slice(0, 40)}…)`);

    /* the hover claim hands the arrow keys to the contest row, wrapping
       through the three matchups; blur first in case an earlier pick left
       focus on the region menu */
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.evaluate(() => { const el = document.getElementById("flow-drift"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80); });
    await wait(300);
    const tabsPt = await page.evaluate(() => { const b = document.querySelector("#flow-drift .rd-fl-tabs").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.mouse.move(tabsPt.x, tabsPt.y); await wait(150);
    const onIx = (s) => s.tabs.findIndex((t) => t.on);
    let walkOk = true, cur = -1;
    for (const want of [1, 2, 0]) { await page.keyboard.press("ArrowRight"); await wait(160); cur = onIx(await read(page)); if (cur !== want) walkOk = false; }
    check(walkOk, `${w}: the hover arrow walk steps the contests right and wraps to Labor v Coalition`);
    walkOk = true;
    for (const want of [2, 1, 0]) { await page.keyboard.press("ArrowLeft"); await wait(160); cur = onIx(await read(page)); if (cur !== want) walkOk = false; }
    check(walkOk, `${w}: the hover arrow walk steps the contests left and wraps back`);

    /* Space cycles the region menu while the section is on screen, and
       keeps its scroll day job once the whole section is off it. Park
       deep enough into the section that the earlier Space claimants
       (the table, house-lean) no longer intersect - they would win the
       key (listeners fire in registration order) */
    const regVal = () => page.$eval('#flow-drift select[aria-label="Region"]', (el) => el.value);
    let regsOk = (await regVal()) === "";
    await page.evaluate(() => {
      const el = document.getElementById("flow-drift");
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + Math.min(260, Math.max(0, el.offsetHeight - innerHeight - 100)));
    });
    await wait(350);
    const neighboursOut = await page.evaluate(() => ["rd-ap-top", "house-lean"].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; }));
    check(neighboursOut, `${w}: parked inside the flows section with the table and house-lean off-screen`);
    for (const want of ["inner", "outer", "regional", ""]) { await page.keyboard.press("Space"); await wait(160); if ((await regVal()) !== want) regsOk = false; }
    check(regsOk, `${w}: Space cycles the regions All → Inner metro → Outer metro → Regional → All`);
    /* off-screen the flows claim releases. The section is the view's
       last, so it can't be scrolled out below; parked just above it
       (where house-lean legitimately owns Space) the menu is untouched */
    await page.evaluate(() => { const el = document.getElementById("flow-drift"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - innerHeight - 100); });
    await wait(350);
    const fullyOut = await page.evaluate(() => { const r = document.getElementById("flow-drift").getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; });
    check(fullyOut, `${w}: scrolled clear of the flows section`);
    const regRest = await regVal();
    await page.keyboard.press("Space"); await wait(400);
    check((await regVal()) === regRest, `${w}: off-screen, Space leaves the flows menu be`);

    /* pointer off the section: the claim is gone and the page-level walk
       resumes (page-turn check goes last - it unmounts the section). The
       parked spot must itself be claim-free - the table, the disagreement
       panel and house-lean all claim the arrows - so the tile band at the
       document's end is the spot */
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(300);
    await page.mouse.move(720, 870); await wait(150);
    const spotFree = await page.evaluate(() => { const el = document.elementFromPoint(720, innerHeight - 30); return el ? !el.closest("#flow-drift, #rd-ap-top, #house-lean, #poll-disagreement") : true; });
    check(spotFree, `${w}: pointer parked on a claim-free spot`);
    await page.keyboard.press("ArrowRight"); await wait(700);
    check(await page.evaluate(() => !document.getElementById("flow-drift")), `${w}: pointer off the section, the claim yields to the page walk`);
  }
  check(errs.length === 0, `${w}: no page errors${errs.length ? " (" + errs[0].slice(0, 160) + ")" : ""}`);
  await page.close();
}

/* tooltip bounds: every ledger mark, and the drift chart's first, middle
   and last dots, on every tab, by touch */
for (const w of [390, 360, 320]) {
  const { page, errs } = await open(w);
  let n = 0, bad = [];
  for (const ti of [0, 1, 2]) {
    await tab(page, ti);
    const rows = await page.evaluate(() => [...document.querySelectorAll("#flow-drift .rd-fx-spark")].map((sp) => sp.querySelectorAll(".rd-fx-hit").length));
    for (let ri = 0; ri < rows.length; ri++) for (let k = 0; k < rows[ri]; k++) {
      const pt = await page.evaluate((ri, k) => {
        const sp = document.querySelectorAll("#flow-drift .rd-fx-spark")[ri];
        sp.scrollIntoView({ block: "center", behavior: "instant" });
        const b = sp.querySelectorAll(".rd-fx-hit")[k].getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }, ri, k);
      await page.touchscreen.tap(pt.x, pt.y); await wait(110);
      const t = await page.evaluate(() => { const el = document.querySelector("#flow-drift .rd-fx-tip"); if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, sw: document.documentElement.scrollWidth, hint: !!el.querySelector(".tip-hint") }; });
      n++;
      if (!t || t.l < 0 || t.r > w || t.sw > w || t.t < 44 || t.hint) bad.push(`tab${ti} row${ri} mark${k} ${JSON.stringify(t)}`);
      await page.touchscreen.tap(3, 420); await wait(70);
      const gone = await page.evaluate(() => !document.querySelector("#flow-drift .rd-fx-tip"));
      if (!gone) bad.push(`tab${ti} row${ri} mark${k}: a tap outside left the tip up`);
    }
    const dots = await page.evaluate(() => { const ch = document.querySelector("#flow-drift .rd-fl-chart"); if (!ch) return 0; ch.scrollIntoView({ block: "center", behavior: "instant" }); return ch.querySelectorAll("circle.rd-apd-hit").length; });
    for (const k of dots ? [0, Math.floor(dots / 2), dots - 1] : []) {
      const pt = await page.evaluate((k) => { const b = document.querySelectorAll("#flow-drift .rd-fl-chart circle.rd-apd-hit")[k].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, k);
      await page.touchscreen.tap(pt.x, pt.y); await wait(140);
      const t = await page.evaluate(() => { const el = document.querySelector("#flow-drift .rd-fl-chart .rd-fl-tip"); if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, sw: document.documentElement.scrollWidth }; });
      n++;
      if (!t || t.l < 0 || t.r > w || t.sw > w) bad.push(`drift tab${ti} dot${k} ${JSON.stringify(t)}`);
      await page.touchscreen.tap(3, 420); await wait(70);
    }
  }
  check(bad.length === 0, `${w}: all ${n} tips open inside the screen, never widen the page, carry no open-poll hint on touch, and put away on a tap outside${bad.length ? " - " + bad.slice(0, 3).join("; ") : ""}`);
  check(errs.length === 0, `${w}: no page errors${errs.length ? " (" + errs[0].slice(0, 160) + ")" : ""}`);
  await page.close();
}
await browser.close();
console.log(fails ? `flows-ledger: ${fails} FAILED` : "flows-ledger: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
