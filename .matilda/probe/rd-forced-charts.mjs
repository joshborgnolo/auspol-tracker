/* headless geometry probe of the RdForced "forced to choose" pair in the
   All-polls Preference flows section (moved from /preference-flows/ 2026-10-10;
   data: gen-data §7db D.flowForced). Renders index.html#allpolls at desktop and
   phone rungs and asserts GEOMETRY, never screenshots
   (auspol-headless-geometry-verify): the two figures share a row side by side
   on desktop and stack full-width on a phone, each svg vmaps every wave's a
   (Labor split) share to a dot at a distinct x with its y matching the
   published figure, end labels sit inside the radius, the rival class on the
   One-Nation-voters chart is `is-lnp` (blue, not orange), gridlines are five,
   and the June est note rides the June dot's aria-label on the coal chart only.
   The dots ride the standard wave-dot idiom: tooltips carry "Click to open
   this poll in All polls" (never a wave-report link), a mouse click or Enter
   opens the poll row in All polls, and the wave's forced-choice figures sit
   in the opened poll's ledger: the archive drawer's matchup grid carries a
   "<Cohort> voters, if forced to choose" row per cohort — Coalition and
   One Nation (one column each) plus Greens and Other (both columns) —
   (RdApDetail), with the June wave's combined-rows note under the grid.
   The Latest-tab poll detail carries the same figures as "forced, <cohort>
   voters, ALP v …" ledger lines (tppLines). Since 2026-10-10 the card
   titles TELL the story (latest wave's Labor share, with a ", up/down from
   NN% in <first wave's month>" tail iff the series' straight-line drift
   battery says Yes), and the pressed-choice pair sits in the
   trend-significance table as a third set — both recomputed here
   independently from window.AUSPOL.flowForced, never trusted from the page.
*/
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.join(ROOT, "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

/* the pressed-choice battery, recomputed independently of the page: one
   straight line per cohort through its Labor-share dots (w=1 like the
   renderer's, x the mid-month decimal gen-data emits), Holm across the two;
   a cohort's Yes licenses its title tail and its table row's verdict */
function tTail(t, df) {
  const th = Math.atan(Math.abs(t) / Math.sqrt(df)), c2 = Math.cos(th) ** 2;
  let term = 1, sum = 1;
  if (df % 2) {
    for (let k = 1; k <= (df - 3) / 2; k++) sum += (term *= (2 * k) / (2 * k + 1) * c2);
    return 1 - (2 / Math.PI) * (th + (df > 1 ? Math.sin(th) * Math.cos(th) * sum : 0));
  }
  for (let k = 1; k <= (df - 2) / 2; k++) sum += (term *= (2 * k - 1) / (2 * k) * c2);
  return 1 - Math.sin(th) * sum;
}
const sgn1 = (v, s) => (v < 0 ? "−" : s && v > 0 ? "+" : "") + Math.abs(v).toFixed(1);
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monY = (ym) => { const [y, m] = ym.split("-").map(Number); return MON[m - 1] + " " + y; };
const mxm = (ym) => { const [y, m] = ym.split("-").map(Number); return y + (m - 1 + 0.5) / 12; };
function lineFit(waves) {
  const n = waves.length;
  if (n - 2 < 3) return null;
  const tb = waves.reduce((a, w) => a + mxm(w.ym), 0) / n, yb = waves.reduce((a, w) => a + w.a, 0) / n;
  const dm = waves.map((w) => ({ dt: mxm(w.ym) - tb, dy: w.a - yb }));
  const df = n - 2, sxx = dm.reduce((a, p) => a + p.dt * p.dt, 0);
  const b = dm.reduce((a, p) => a + p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  return { b, t: b / se, p: tTail(b / se, df) };
}
function expectedForced(FF) {
  const rows = [["coal", FF.coal], ["on", FF.on]].map(([key, waves]) => ({ key, waves, fit: lineFit(waves) }));
  const tested = rows.filter((r) => r.fit), sigK = [];
  for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (r.fit.p >= 0.05 / (tested.length - i)) break;
    sigK.push(r.key);
  }
  const title = (r) => {
    const f = r.waves[0], la = r.waves[r.waves.length - 1], sig = sigK.includes(r.key);
    const base = r.key === "coal" ? la.a + "% of Coalition voters prefer Labor over One Nation"
      : "Just " + la.a + "% of One Nation voters prefer Labor over the Coalition";
    return !sig || la.a === f.a ? base
      : base + ", " + (la.a > f.a ? "up" : "down") + " from " + f.a + "% in " + monY(f.ym);
  };
  const cells = (r) => {
    const sig = sigK.includes(r.key);
    return [r.waves[0].a + " → " + r.waves[r.waves.length - 1].a,
      r.fit ? sgn1(r.fit.b, true) : "–", r.fit ? sgn1(r.fit.t) : "–",
      r.fit ? (sig ? "Yes" : "No") : "–"];
  };
  return Object.fromEntries(rows.map((r) => [r.key,
    { title: title(r), cells: cells(r), sig: sigK.includes(r.key) }]));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const gotoFlows = async (w) => {
  await page.setViewport({ width: w, height: 1200, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ff svg .rd-ff-line.a", { timeout: 30000 });
  await page.evaluate(() => document.querySelector(".rd-ff").scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 350));
};

const measure = () => page.evaluate(() => {
  const figs = [...document.querySelectorAll(".rd-ff figure.rd-ff")];
  const out = { nFig: figs.length, figs: [] };
  for (const fig of figs) {
    const svg = fig.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const lineA = fig.querySelector(".rd-ff-line.a");
    const lineB = fig.querySelector(".rd-ff-line.b");
    const dotsA = [...fig.querySelectorAll(".rd-ff-dot.a")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
    const dotsB = [...fig.querySelectorAll(".rd-ff-dot.b")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
    const hits = [...fig.querySelectorAll("circle.rd-apd-hit")];
    const gls = fig.querySelectorAll(".rd-ff-gl").length;
    const els = [...fig.querySelectorAll(".rd-ff-el")].map((t) => t.textContent);
    const elvs = [...fig.querySelectorAll(".rd-ff-elv")].map((t) => t.textContent);
    out.figs.push({
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top),
      vb: svg.getAttribute("viewBox"),
      a: lineA.getAttribute("d").slice(0, 8), bcls: lineB.getAttribute("class"),
      bBiggerThanA: lineB.getAttribute("d") !== lineA.getAttribute("d"),
      dotsA, dotsB, nHits: hits.length, gls, els, elvs,
      arias: hits.map((h) => h.getAttribute("aria-label") || ""),
      xMax: Math.max(...dotsA.map((d) => d.x)),
      elX: +fig.querySelector(".rd-ff-el.a").getAttribute("x"),
      elvText: fig.querySelector(".rd-ff-elv.a").textContent,
    });
  }
  const sec = document.querySelector("#flow-drift");
  out.secW = Math.round(sec.getBoundingClientRect().width);
  out.h3 = sec.querySelector(".rd-ff-t") ? sec.querySelector(".rd-ff-t").textContent : null;
  out.h4s = [...sec.querySelectorAll(".rd-ff-two .rd-fl-ct h4")].map((h) => h.textContent.trim());
  const det = sec.querySelector("details.rd-tsig");
  if (det) {
    out.tsigHeads = [...det.querySelectorAll(".rd-tsig-table thead th")].map((h) => h.textContent.trim());
    const bodies = [...det.querySelectorAll(".rd-tsig-table tbody")];
    const pr = bodies.find((tb) => {
      const s = tb.querySelector("tr.rd-tsig-set th");
      return s && s.textContent.trim() === "Pressed-choice Labor share";
    });
    out.pressed = pr ? [...pr.querySelectorAll("tr:not(.rd-tsig-set)")].map((tr) => ({
      name: tr.querySelector("th").textContent.trim(),
      cells: [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()),
      yes: tr.querySelectorAll("td.rd-tsig-yes").length,
    })) : null;
  }
  out.orderKeyThenForced = (() => {
    const nodes = [...sec.children];
    const iKey = nodes.findIndex((el) => el.classList.contains("rd-ckey") && el.classList.contains("rd-fl-key"));
    const iFF = nodes.findIndex((el) => el.classList.contains("rd-ff"));
    const iTsig = nodes.findIndex((el) => el.classList.contains("rd-tsig"));
    return { iKey, iFF, iTsig };
  })();
  out.sw = document.documentElement.scrollWidth;
  out.iw = window.innerWidth;
  return out;
});

// ---------------- desktop rung --------------------------------------------
await gotoFlows(1366);
const d = await measure();
check(d.nFig === 2, `desktop: two forced-choice figures (${d.nFig})`);
check(d.h3 === "When pressed, where do their voters go?", `desktop: section head is the forced-choice line`);
check(d.orderKeyThenForced.iKey > -1 && d.orderKeyThenForced.iFF === d.orderKeyThenForced.iKey + 1,
  `desktop: the forced pair sits directly under the drift key (key idx ${d.orderKeyThenForced.iKey}, forced idx ${d.orderKeyThenForced.iFF})`);
check(d.orderKeyThenForced.iTsig === d.orderKeyThenForced.iFF + 1,
  `desktop: the drift battery follows the forced pair (tsig idx ${d.orderKeyThenForced.iTsig})`);
{
  const [a, b] = d.figs;
  check(a.w > 400 && Math.abs(a.w - b.w) <= 2, `desktop: two equal-width charts side by side (${a.w}px, ${b.w}px)`);
  check(Math.abs(b.left - a.right) > 20, `desktop: a gap separates the two charts (${b.left - a.right}px)`);
  check(Math.abs(a.top - b.top) <= 1, `desktop: charts share a row (top ${a.top} vs ${b.top})`);
  for (const [i, f] of d.figs.entries()) {
    const tag = i === 0 ? "coal" : "on";
    check(f.dotsA.length === 7 && f.dotsB.length === 7, `desktop ${tag}: seven waves per line (${f.dotsA.length}/${f.dotsB.length})`);
    check(f.gls === 5, `desktop ${tag}: five gridlines`);
    check(f.els.length === 2 && f.els[0] === "Labor", `desktop ${tag}: Labor end label first (${f.els.join(" · ")})`);
    check(f.elvText === (i === 0 ? "41" : "15"), `desktop ${tag}: latest Labor share ends the line (${f.elvText})`);
    check(f.dotsA.every((p) => p.y > 0 && p.y < 196), `desktop ${tag}: every Labor dot inside the plot`);
    check(f.elX === f.xMax + 8, `desktop ${tag}: end labels hug the last dot's x (x=${f.elX} = ${f.xMax}+8)`);
    check(f.nHits === 14, `desktop ${tag}: 14 hit circles (${f.nHits})`);
  }
  check(d.figs[0].els[1] === "One Nation", `desktop coal: rival labelled One Nation (${d.figs[0].els[1]})`);
  check(d.figs[1].els[1] === "Coalition", `desktop on: rival labelled Coalition (${d.figs[1].els[1]})`);
  check(d.figs[1].bcls.includes("is-lnp") && !d.figs[0].bcls.includes("is-lnp"),
    `desktop: the ON-voters rival line is blue (is-lnp), the coal-voters rival stays orange`);
  check(d.figs[0].bBiggerThanA && d.figs[1].bBiggerThanA, "desktop: both charts draw two distinct lines");
  const juneAria = d.figs[0].arias.find((s) => s.startsWith("June 2026:"));
  check(!!juneAria && juneAria.includes("Labor 36, One Nation 64") && juneAria.includes("combines"),
    `desktop coal: June dot aria reads the combined-rows note (${JSON.stringify(juneAria)})`);
  const onJune = d.figs[1].arias.find((s) => s.startsWith("June 2026:"));
  check(!!onJune && onJune.includes("Labor 21, the Coalition 79") && !onJune.includes("combines"),
    `desktop on: June dot aria is the plain printed figure (${JSON.stringify(onJune)})`);
}
const viewH = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));

// tip: hover the Sep dot of the coal chart — the standard open-poll hint,
// not a report link (the report link lives in the opened poll's ledger)
{
  await page.evaluate(() => {
    const hits = [...document.querySelectorAll("figure.rd-ff")][0].querySelectorAll("circle.rd-apd-hit[aria-label^='September 2026']");
    const r = hits[0].getBoundingClientRect();
    hits[0].scrollIntoView({ block: "center" });
  });
  const c = await page.evaluate(() => {
    const h = [...document.querySelectorAll("figure.rd-ff")][0].querySelector("circle.rd-apd-hit[aria-label^='September 2026']");
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  const tip = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const t = fig.querySelector(".tip.rd-ff-tip");
    if (!t || t.offsetParent === null) return null;
    return {
      title: t.querySelector(".tip-title").textContent,
      rows: [...t.querySelectorAll(".tip-row .tip-label")].map((l) => l.textContent.trim()),
      vals: [...t.querySelectorAll(".tip-row .tip-val")].map((v) => v.textContent.trim()),
      hint: (t.querySelector("div.tip-hint") || {}).textContent || null,
      link: !!t.querySelector("a.rd-ff-lnk"),
      est: t.querySelectorAll(".tip-sub.tip-hint").length,
    };
  });
  check(!!tip && tip.title === "September 2026", `coal Sep hover: tip opens titled September 2026 (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.rows.includes("Labor") && tip.vals.includes("41%"), `coal Sep tip: Labor row 41% (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.rows.includes("One Nation") && tip.vals.includes("59%"), `coal Sep tip: One Nation row 59%`);
  check(tip && tip.rows.includes("Sample") && tip.vals.includes("n = 1,000"), `coal Sep tip: sample row`);
  check(tip && tip.hint === "Click to open this poll in All polls", `coal Sep tip: the standard open-poll hint (${JSON.stringify(tip && tip.hint)})`);
  check(tip && tip.link === false, `coal Sep tip: no wave-report link in the tip (it moved to the ledger)`);
  check(tip && tip.est === 0, `coal Sep tip: no est note on a printed wave`);

  // June dot on the coal chart carries the est note
  const junC = await page.evaluate(() => {
    const h = [...document.querySelectorAll("figure.rd-ff")][0].querySelector("circle.rd-apd-hit[aria-label^='June 2026']");
    const r = h.getBoundingClientRect();
    h.scrollIntoView({ block: "center" });
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(junC.x, junC.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  const tipJ = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const t = fig.querySelector(".tip.rd-ff-tip");
    if (!t || t.offsetParent === null) return null;
    return {
      title: t.querySelector(".tip-title").textContent,
      est: [...t.querySelectorAll(".tip-sub.tip-hint")].map((s) => s.textContent.trim()),
      hint: (t.querySelector("div.tip-hint") || {}).textContent || null,
      wrap: t.querySelectorAll(".tip-row.tip-hintwrap").length,
    };
  });
  check(!!tipJ && tipJ.title === "June 2026" && tipJ.est.length === 1 && tipJ.est[0].includes("CLP/LNP/Nat (34)") && tipJ.est[0].includes("Liberal (37)"),
    `coal June tip: the combined-rows note rides the June dot (${JSON.stringify(tipJ && tipJ.est)})`);
  check(tipJ && tipJ.hint === "Click to open this poll in All polls", `coal June tip: the open-poll hint beside the est note (${JSON.stringify(tipJ && tipJ.hint)})`);
  check(tipJ && tipJ.wrap === 1, `coal June tip: only the est note is a wrapped row (${tipJ && tipJ.wrap})`);
}

// svg vmaps the data: y of each Labor dot equals the published share
{
  const expected = {
    0: [32, 31, 32, 36, 44, 32, 41],   // coal-voters chart, Labor splits Feb..Sep
    1: [23, 25, 21, 21, 16, 17, 15],   // ON-voters chart, Labor splits
  }[0];
  const pairs = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const svg = fig.querySelector("svg");
    const H = +svg.getAttribute("height");
    const top = 16, bot = H - 34;
    return [...fig.querySelectorAll(".rd-ff-dot.a")].map((c) => Math.round(100 * (bot - (+c.getAttribute("cy"))) / (bot - top)));
  });
  check(JSON.stringify(pairs) === JSON.stringify(expected), `coal chart Labor dots vmap the published splits (${JSON.stringify(pairs)})`);
}
check(viewH === 230, `desktop: plot height 230 (${viewH})`);

// the titles tell the latest wave's story; tails ride the battery's Yes
const FFexp = expectedForced(await page.evaluate(() => window.AUSPOL.flowForced));
check(d.h4s.length === 2 && d.h4s[0] === FFexp.coal.title,
  `desktop: coal title is the latest-share line${FFexp.coal.sig ? " + its significant-change tail" : ""} (${JSON.stringify(d.h4s[0])})`);
check(d.h4s.length === 2 && d.h4s[1] === FFexp.on.title,
  `desktop: ON title leads with Just + latest share${FFexp.on.sig ? " + tail" : ""} (${JSON.stringify(d.h4s[1])})`);
// the trend-significance table's pressed set carries the same battery
check(d.tsigHeads && JSON.stringify(d.tsigHeads) === JSON.stringify(["Series", "First → last", "Slope, pts/yr", "t", "Significant"]),
  `tsig heads fit gaps and shares (${JSON.stringify(d.tsigHeads)})`);
check(d.pressed && d.pressed.length === 2 && d.pressed[0].name === "Coalition voters" && d.pressed[1].name === "One Nation voters",
  `pressed set: one row per chart, coal first (${JSON.stringify((d.pressed || []).map((r) => r.name))})`);
for (const [i, tag] of ["coal", "on"].entries()) {
  const row = d.pressed && d.pressed[i];
  const exp = FFexp[tag];
  check(!!row && JSON.stringify(row.cells) === JSON.stringify(exp.cells),
    `pressed ${tag}: figures recomputed (${JSON.stringify(row && row.cells)} vs ${JSON.stringify(exp.cells)})`);
  check(!!row && row.yes === (exp.sig ? 1 : 0),
    `pressed ${tag}: Yes-wash iff the battery says Yes (${row && row.yes} yes-td on a ${exp.cells[3]})`);
}

// click the Sep dot of the coal chart with a real mouse: the wave opens in
// All polls, named by the return button, and its wave's forced-choice
// figures sit in the poll ledger's "as published" section
{
  const c = await page.evaluate(() => {
    const h = [...document.querySelectorAll("figure.rd-ff")][0].querySelector("circle.rd-apd-hit[aria-label^='September 2026']");
    h.scrollIntoView({ block: "center", behavior: "instant" });
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(c.x, c.y);
  let land = null;
  try {
    await page.waitForSelector(".rd-ap-row.open", { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 400));
    land = await page.evaluate(() => {
      const row = document.querySelector(".rd-ap-row.open");
      const det = document.querySelector(".rd-ap-open");
      if (!row || !det) return null;
      const head = ((row.querySelector("[role=rowheader] b") || {}).textContent || "").replace(/↗/g, "").trim();
      /* each forced row of the matchup grid: its key span followed by the
         two column cells (only the rival's column carries figures) */
      const forced = [...det.querySelectorAll(".rd-apd-grid .rd-apd-k")]
        .filter((k) => k.textContent.includes("forced to choose"))
        .map((k) => {
          const cells = [];
          for (let n = k.nextElementSibling; n && cells.length < 2; n = n.nextElementSibling)
            cells.push(n.textContent.replace(/\s+/g, " ").trim());
          return { key: k.textContent.trim(), cells };
        });
      const estNote = [...det.querySelectorAll(".rd-apd-note")].map((s) => s.textContent.replace(/\s+/g, " ").trim());
      const back = [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).find((t) => t.startsWith("Back to "));
      return { head, forced, estNote, back: back || null };
    });
  } catch (e) { /* land stays null */ }
  check(!!land && land.head === "RedBridge/Accent",
    `click Sep coal dot: the wave's poll row opens in All polls (${JSON.stringify(land && land.head)})`);
  check(!!land && land.back === "Back to the forced-choice flow chart",
    `…the return button names the forced-choice chart (${JSON.stringify(land && land.back)})`);
  const coalRow = land && land.forced.find((x) => x.key === "Coalition voters, if forced to choose");
  const onpRow = land && land.forced.find((x) => x.key === "One Nation voters, if forced to choose");
  check(!!coalRow && coalRow.cells.some((t) => t.includes("41") && t.includes("59") && t.includes("▲ 9")),
    `ledger: Coalition-voters forced row 41 – 59 (▲ 9) in the v-One-Nation column (${JSON.stringify(coalRow)})`);
  check(!!onpRow && onpRow.cells.some((t) => t.includes("15") && t.includes("85") && t.includes("▼ 2")),
    `ledger: One-Nation-voters forced row 15 – 85 (▼ 2) in the v-Coalition column (${JSON.stringify(onpRow)})`);
  const grnRow = land && land.forced.find((x) => x.key === "Greens voters, if forced to choose");
  const othRow = land && land.forced.find((x) => x.key === "Other voters, if forced to choose");
  check(!!grnRow && grnRow.cells.some((t) => t.includes("90 – 10") && t.includes("0")) && grnRow.cells.some((t) => t.includes("82 – 18") && t.includes("▲ 4")),
    `ledger: Greens-voters forced row 90 – 10 v ON and 82 – 18 (▲ 4) v Coalition (${JSON.stringify(grnRow)})`);
  check(!!othRow && othRow.cells.some((t) => t.includes("57 – 43") && t.includes("▼ 2")) && othRow.cells.some((t) => t.includes("50 – 50")),
    `ledger: Other-voters forced row 57 – 43 (▼ 2) v ON and 50 – 50 v Coalition (${JSON.stringify(othRow)})`);
  check(!!land && land.estNote.every((n) => !n.includes("combined row was printed")),
    `ledger: no combined-rows note on a printed wave (${JSON.stringify(land && land.estNote)})`);
}

// the June wave's drawer carries the combined-rows note under the matchup grid
{
  await page.evaluate(() => window.AP.openPoll("RedBridge/Accent|2026-06-26", "twopp", "the probe"));
  let jun = null;
  try {
    await page.waitForFunction(() => {
      const row = document.querySelector(".rd-ap-row.open");
      return row && ((row.querySelector("[role=rowheader] b") || {}).textContent || "").includes("RedBridge/Accent");
    }, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 300));
    jun = await page.evaluate(() => {
      const det = document.querySelector(".rd-ap-open");
      if (!det) return null;
      const keys = [...det.querySelectorAll(".rd-apd-grid .rd-apd-k")].map((k) => k.textContent.trim());
      const estNote = [...det.querySelectorAll(".rd-apd-note")].map((s) => s.textContent.replace(/\s+/g, " ").trim());
      const cell = (() => {
        const k = [...det.querySelectorAll(".rd-apd-grid .rd-apd-k")].find((x) => x.textContent.includes("Coalition voters"));
        if (!k) return null;
        const cells = [];
        for (let n = k.nextElementSibling; n && cells.length < 2; n = n.nextElementSibling)
          cells.push(n.textContent.replace(/\s+/g, " ").trim());
        return cells;
      })();
      return { keys, estNote, coalCell: cell };
    });
  } catch (e) { /* jun stays null */ }
  check(!!jun && ["Coalition", "One Nation", "Greens", "Other"].every((c) => jun.keys.includes(`${c} voters, if forced to choose`)),
    `June wave drawer: all four cohort forced rows present (${JSON.stringify(jun && jun.keys)})`);
  check(!!jun && Array.isArray(jun.coalCell) && jun.coalCell.some((t) => t.includes("36") && t.includes("64") && t.includes("▲ 4")),
    `June wave drawer: forced split 36 – 64 (▲ 4) rides the v-One-Nation column (${JSON.stringify(jun && jun.coalCell)})`);
  check(!!jun && jun.estNote.some((n) => n.includes("combined row was printed") && n.includes("CLP/LNP/Nat")),
    `June wave drawer: the combined-rows note sits under the matchup grid (${JSON.stringify(jun && jun.estNote)})`);
}

// ---------------- phone rung ------------------------------------------------
await gotoFlows(390);
const m = await measure();
check(m.nFig === 2, `phone: two figures (${m.nFig})`);
{
  const [a, b] = m.figs;
  check(Math.abs(a.w - m.secW) <= 2 && Math.abs(b.w - m.secW) <= 2, `phone: charts fill the section width (${a.w}px of ${m.secW}px)`);
  check(b.top > a.top + a.h - 1, `phone: charts stack (${a.top}+${a.h} then ${b.top})`);
  check(Math.abs(a.top - b.top) > 40, `phone: real vertical stride between charts (${b.top - a.top})`);
  check(m.sw <= m.iw + 1, `phone: no horizontal overflow (sw ${m.sw} vs iw ${m.iw})`);
}
check(m.h4s.length === 2 && m.h4s[0] === FFexp.coal.title && m.h4s[1] === FFexp.on.title,
  `phone: same dynamic titles as desktop (${JSON.stringify(m.h4s)})`);
const viewH2 = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH2 === 190, `phone: plot height 190 (${viewH2})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "rd-forced-charts: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
