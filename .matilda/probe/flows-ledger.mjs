/* headless probe of the Preference flows section as rebuilt
   2026-10-13 (design B of that day's mockups, the user's pick after "an
   ill-conceived and disordered hodgepodge - especially on small screens"),
   running against its own /flows/ tab page since 0f7eb4bd (2026-10-15)
   moved disagreement/leans/flows off All polls. The section IS the page
   (~1550px tall at 1440 > any desktop viewport), so the Space/hover
   claims stay hot to the document's end - the old "scroll the section
   off-screen" release checks are structural pins now. Clicking a poll
   mark swaps the view to All polls inside the same document; the probe
   reloads PAGE afterwards to get back (the ☰ menu items are plain
   anchors, useless on file://).
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
       seat replay;
     - the poll columns' heads open their waves: the RedBridge and
       DemosAU heads (house name + fieldwork months) ride the mark-click
       chain's AP.pollRowKey -> AP.openPoll route, the figure cells
       plain text; a change note's month opens the wave it names; a
       named region drops the RedBridge head's button ("national only"
       has no poll row); desktop clicks and Enter land the poll's row
       in the table;
     - tooltips: every ledger mark and the drift chart's first, middle and
       last dots open a tip inside the screen at 390/360/320 by touch (the
       bug the user reported: DemosAU tips 371-410px on a 390px phone), the
       page never widens; a tap outside puts a touch tip away, and so do
       the next-to-the-mark taps that used to swallow it - a row label,
       the note, the drift chart's own blank (user report 2026-10-19); a
       desktop mouse click on a RedBridge mark opens that poll in the
       table;
     - keys: with the pointer over the section <-/-> walks and wraps the
       contest row both ways; while the section is on screen Space cycles
       the region menu (All, inner, outer, regional) - claims released
       on its own page: the claims hold to the document's end and yield
       only off-pointer, to the <-/-> page walk (right turns to the
       Preference-flows explainer, left to Pollster leans);
     - a click on a poll mark swaps the view to All polls with its ledger
       open; the probe reloads PAGE to get back.
   Run against a built tree: node .matilda/probe/flows-ledger.mjs
   (PAGE=http://... to run over http, which loads the fonts) */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "flows", "index.html");
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
      btns: r.querySelectorAll(".rd-fx-n > button").length,
      moBtns: r.querySelectorAll("button.rd-fx-mo").length,
      waves: r.querySelectorAll(".rd-fx-dot").length + r.querySelectorAll(".rd-fx-end").length,
      tris: r.querySelectorAll(".rd-fx-tr").length,
      crosses: r.querySelectorAll(".rd-fx-x").length,
      ref: r.querySelectorAll(".rd-fx-ref").length,
      lineVerts: (() => { const p = r.querySelector(".rd-fx-line"); return p ? (p.getAttribute("d").match(/[MC]/g) || []).length : 0; })(),
      empty: (r.querySelector(".rd-fl-empty") || {}).textContent || null,
    })),
    heads: [...sec.querySelectorAll(".rd-fx-hrow .rd-ap-th")].map((th) => ({ t: th.textContent, btn: !!th.querySelector("button.rd-fx-th") })),
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
  check(s.rows.every((r) => r.btns === 0), `${w}: the RedBridge and DemosAU figures are plain text - the open-poll links live on the column heads (${s.rows.map((r) => r.btns)})`);
  check(s.heads[2].btn && s.heads[3].btn, `${w}: the RedBridge and DemosAU column heads are open-poll buttons (${s.heads.map((h) => h.t).join(" | ")})`);
  check(s.rows.every((r) => r.moBtns === (r.chg ? 1 : 0)), `${w}: a change note's month opens the wave it names (${s.rows.map((r) => r.moBtns)})`);
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
  check(s.rows.every((r) => r.btns === 0) && s.heads[2].btn && s.heads[3].btn,
    `${w}: Labor v One Nation: house figures plain, both column heads the buttons`);
  await region(page, "regional");
  s = await read(page);
  check(s.rows.every((r) => r.cells[1] === "–" && r.waves === 0 && r.crosses === 0), `${w}: a named region drops RedBridge/Accent and the 2026 counts`);
  check(s.rows.map((r) => r.cells[2]).join() === ["coal", "grn", "oth"].map((ck) => fig(E.onReg[ck])).join(), `${w}: Regional rekeys DemosAU to its printed regional cells (${s.rows.map((r) => r.cells[2])})`);
  check(s.rows.every((r) => r.btns === 0) && !s.heads[2].btn && s.heads[3].btn,
    `${w}: the rekeyed DemosAU head keeps its button, RedBridge's "national only" doesn't (${s.heads.slice(2).map((h) => h.t)})`);
  await region(page, "");

  await tab(page, 2);
  s = await read(page);
  check(s.rows.map((r) => r.who.replace(" voters", "")).join() === "Labor,Greens,Other" && s.drift === 0, `${w}: Coalition v One Nation lists Labor, Greens, Other and draws no drift chart`);
  check(s.rows.map((r) => r.cells[2]).join() === ["alp", "grn", "oth"].map((ck) => fig(E.ln[ck][2])).join() && s.rows.every((r) => r.cells[0] === "–" && r.cells[1] === "–"),
    `${w}: Coalition v One Nation: DemosAU alone, no assumption, no RedBridge`);
  check(s.rows.every((r) => r.btns === 0) && !s.heads[2].btn && s.heads[3].btn,
    `${w}: Coalition v One Nation: the DemosAU head alone is the button (${s.heads.slice(2).map((h) => h.t)})`);

  await tab(page, 0);
  await region(page, "inner");
  s = await read(page);
  check(s.rows.map((r) => r.cells[0]).join() === ["grn", "onp", "oth"].map((ck) => fig(E.coInner[ck], 1)).join(), `${w}: Inner metro rekeys the count column to the class's seat replay (${s.rows.map((r) => r.cells[0])})`);
  check(s.rows.every((r) => r.waves === 0 && r.tris === 0 && r.empty), `${w}: Labor v Coalition by region: no poll marks, the row says why`);
  await region(page, "");

  /* (the two-party flip used to ride this probe when house-lean shared
     the All-polls page; 0f7eb4bd gave each section its own page, so the
     flip-carry check now lives entirely on the /leans/ probe) */

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
    /* back to the flows view: the ☰/tab chrome is plain anchors, useless
       on file:// - reload PAGE (the mark-click swap was client-side) */
    await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector("#flow-drift .rd-fx-row", { timeout: 30000 });
    await wait(400);

    /* the poll columns' heads open the wave they headline: RedBridge's
       head and DemosAU's MRP head - click, keyboard Enter, and the aria
       label; PAGE reloads put the view back (the swaps are client-side) */
    const reload = async () => { await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 }); await page.waitForSelector("#flow-drift .rd-fx-row", { timeout: 30000 }); await wait(300); };
    const headAt = async (i) => page.evaluate((i) => {
      const b = [...document.querySelectorAll("#flow-drift .rd-fx-hrow .rd-ap-th button.rd-fx-th")][i];
      b.scrollIntoView({ block: "center", behavior: "instant" });
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute("aria-label"), text: b.textContent };
    }, i);
    const clickHead = async (i, tag) => {
      const h = await headAt(i);
      check(/^(RedBridge\/Accent|DemosAU MRP), .+ - open this poll in the All polls table$/.test(h.label),
        `${w}: the ${tag} head's aria label names its poll (${h.label.slice(0, 56)}…)`);
      await page.mouse.click(h.x, h.y); await wait(900);
      const opened = await page.evaluate(() => document.querySelectorAll(".rd-ldg").length);
      check(opened === 1, `${w}: clicking the ${tag} column head opens its poll in the table (${h.text.slice(0, 26)}…)`);
      await reload();
    };
    await clickHead(0, "RedBridge");
    await clickHead(1, "DemosAU MRP");
    /* Enter on a focused head opens it too */
    await page.evaluate(() => document.querySelector("#flow-drift .rd-fx-hrow button.rd-fx-th").focus());
    await wait(120);
    await page.keyboard.press("Enter"); await wait(900);
    check(await page.evaluate(() => document.querySelectorAll(".rd-ldg").length) === 1, `${w}: Enter on a focused column head opens its poll`);
    await reload();

    /* and a change note's month opens the wave it names (today's note:
       "down from … in Feb", so February's RedBridge wave). None today =
       the battery finds no move and nothing is wired */
    let mo = null;
    for (const ti of [0, 1, 2]) {
      if (ti) await tab(page, ti);
      mo = await page.evaluate(() => {
        const b = document.querySelector("#flow-drift .rd-fx-chg button.rd-fx-mo");
        if (!b) return null;
        b.scrollIntoView({ block: "center", behavior: "instant" });
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute("aria-label"), text: b.textContent };
      });
      if (mo) break;
    }
    if (mo) {
      check(/^(RedBridge\/Accent|DemosAU MRP), .+ - open this poll in the All polls table$/.test(mo.label),
        `${w}: the change note's month names its wave (${mo.label.slice(0, 56)}…)`);
      await page.mouse.click(mo.x, mo.y); await wait(900);
      check(await page.evaluate(() => document.querySelectorAll(".rd-ldg").length) === 1, `${w}: clicking the note's month (${mo.text}) opens that wave's poll`);
      await reload();
    } else {
      check(true, `${w}: no change note today - no month button to click (re-pin when the battery next says a cohort moved)`);
    }
    await tab(page, 0);
    await wait(400);

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

    /* Space cycles the region menu while the section is on screen. On
       its own page it's the only Space claimant - park deep into the
       section and confirm it's the view the claim sees */
    const regVal = () => page.$eval('#flow-drift select[aria-label="Region"]', (el) => el.value);
    let regsOk = (await regVal()) === "";
    await page.evaluate(() => {
      const el = document.getElementById("flow-drift");
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + Math.min(260, Math.max(0, el.offsetHeight - innerHeight - 100)));
    });
    await wait(350);
    const sectInView = await page.evaluate(() => { const r = document.getElementById("flow-drift").getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    check(sectInView, `${w}: parked with the flows section in view (its own page's only Space claim)`);
    for (const want of ["inner", "outer", "regional", ""]) { await page.keyboard.press("Space"); await wait(160); if ((await regVal()) !== want) regsOk = false; }
    check(regsOk, `${w}: Space cycles the regions All → Inner metro → Outer metro → Regional → All`);
    /* the SELECTED contest tab owns Space the roll's way: a click's focus
       sits on it (rdTabFocus), where native Space would only re-pick the
       same contest, so the roll claims the key and the tab's pick and focus
       stay put (user report 2026-10-16). An unpressed tab keeps the key's
       day job - it activates natively */
    await page.evaluate(() => document.querySelector("#flow-drift .rd-fl-tabs .rd-tab[aria-pressed='true']").focus());
    await wait(150);
    let tabRollOk = (await regVal()) === "";
    for (const want of ["inner", "outer"]) { await page.keyboard.press("Space"); await wait(160); if ((await regVal()) !== want) tabRollOk = false; }
    check(tabRollOk, `${w}: Space from the selected contest tab still rolls the region menu`);
    const contestKept = await page.evaluate(() => {
      const a = document.activeElement;
      return !!(a && a.matches && a.matches("#flow-drift .rd-fl-tabs .rd-tab") && a.getAttribute("aria-pressed") === "true" && a.textContent.indexOf("Labor v Coalition") === 0);
    });
    check(contestKept, `${w}: the roll leaves the contest tab pressed and focused`);
    await page.evaluate(() => document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")[1].focus());
    await wait(120);
    await page.keyboard.press("Space"); await wait(250);
    check((await read(page)).tabs[1].on, `${w}: an unpressed contest tab keeps Space's day job (activates it)`);
    check((await regVal()) === "outer", `${w}: the unpressed tab's Space leaves the region menu be`);
    /* restore: contest Labor v Coalition, region All voters, focus off the row */
    await page.evaluate(() => document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")[0].click());
    await region(page, "");
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await wait(200);
    /* the section IS the /flows/ page post-split (≈1550px tall > the
       900px desktop viewport), so like /leans/ it can never leave the
       viewport: the Space claim stays hot to the document's end. Pin the
       structure and the consequence - Space still rolls at the very
       bottom. A layout that makes the section exitable breaks the
       structure check - rewrite this phase as a release test then. */
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(350);
    const stillIn = await page.evaluate(() => { const r = document.getElementById("flow-drift").getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    check(stillIn, `${w}: the flows section still intersects at the document's end (full-page panel)`);
    const regRest = await regVal();
    await page.keyboard.press("Space"); await wait(250);
    check((await regVal()) !== regRest, `${w}: Space at the document's end still rolls the region menu`);
    await region(page, "");

    /* pointer off the section: the claim is gone and the page-level walk
       resumes (page-turn check goes last - it unmounts the section). The
       tile band at the document's end is the claim-free spot - post-split
       the other arrow claimants (table, disagreement, house-lean) all
       live on pages of their own. Blur first: the region restore leaves
       the <select> focused, where ArrowRight never reaches the page */
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await wait(100);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(300);
    await page.mouse.move(720, 870); await wait(150);
    const spotFree = await page.evaluate(() => { const el = document.elementFromPoint(720, innerHeight - 30); return el ? !el.closest("#flow-drift, #rd-ap-top, #house-lean, #poll-disagreement") : true; });
    check(spotFree, `${w}: pointer parked on a claim-free spot`);
    await page.keyboard.press("ArrowRight"); await wait(700);
    check(await page.evaluate(() => !document.getElementById("flow-drift") && !!document.querySelector(".view-flows-explained")),
      `${w}: pointer off the section, the claim yields to the page walk (turns to the explainer)`);
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
  if (w === 390) {
    /* dismissal (user report 2026-10-19): a touch tip puts away from the
       NEXT touch tap anywhere nearby - the ledger's own blanks (a row
       label, the note) and the drift chart's blank all used to swallow
       the tap and leave the tip standing */
    await tab(page, 0);
    const tapAt = async (fn) => { const p = await page.evaluate(fn); await page.touchscreen.tap(p.x, p.y); await wait(150); };
    const fxHas = () => page.evaluate(() => !!document.querySelector("#flow-drift .rd-fx-tip"));
    const drHas = () => page.evaluate(() => !!document.querySelector("#flow-drift .rd-fl-chart .rd-fl-tip"));
    const markGeo = () => {
      const sp = document.querySelectorAll("#flow-drift .rd-fx-spark")[1];
      sp.scrollIntoView({ block: "center", behavior: "instant" });
      const b = sp.querySelectorAll(".rd-fx-hit")[2].getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    let go = true;
    await tapAt(markGeo);
    go = go && (await fxHas());
    await tapAt(() => { const el = document.querySelector("#flow-drift .rd-fx-note"); el.scrollIntoView({ block: "center", behavior: "instant" }); const b = el.getBoundingClientRect(); return { x: b.x + Math.min(40, b.width / 2), y: b.y + b.height / 2 }; });
    go = go && !(await fxHas());
    await tapAt(markGeo);
    go = go && (await fxHas());
    await tapAt(() => { const b = document.querySelectorAll("#flow-drift .rd-fx-row .rd-fx-who b")[1].getBoundingClientRect(); return { x: b.x + 10, y: b.y + b.height / 2 }; });
    go = go && !(await fxHas());
    check(go, `${w}: a ledger tip puts away from a tap on the note, and again on a row label`);
    await tapAt(() => {
      const ch = document.querySelector("#flow-drift .rd-fl-chart");
      ch.scrollIntoView({ block: "center", behavior: "instant" });
      const b = ch.querySelectorAll("circle.rd-apd-hit")[1].getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    go = await drHas();
    const blank = await page.evaluate(() => {
      const sv = document.querySelector("#flow-drift .rd-fl-chart svg");
      const sb = sv.getBoundingClientRect();
      const hits = [...sv.querySelectorAll(".rd-apd-hit")].map((c) => { const b = c.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      for (const fy of [5, 12, 20]) for (const fx of [3, 5, 7, 1.5, 8.5]) {
        const x = sb.left + (sb.width * fx) / 10, y = sb.top + fy;
        if (hits.every((h) => Math.hypot(h.x - x, h.y - y) > 12)) return { x, y };
      }
      return null;
    });
    if (blank) {
      await page.touchscreen.tap(blank.x, blank.y); await wait(150);
      go = go && !(await drHas());
      check(go, `${w}: a drift tip puts away from a tap on its own chart's blank`);
    } else {
      check(true, `${w}: no clear blank on the drift chart today - its tuck-away tap stays unpinned this run`);
    }
  }
  check(errs.length === 0, `${w}: no page errors${errs.length ? " (" + errs[0].slice(0, 160) + ")" : ""}`);
  await page.close();
}
await browser.close();
console.log(fails ? `flows-ledger: ${fails} FAILED` : "flows-ledger: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
