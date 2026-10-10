/* headless geometry probe of the RdForced "forced to choose" pair in the
   All-polls Preference flows section (moved from /preference-flows/ 2026-10-10;
   REGROUPED the same day from one chart per voter cohort to one chart per
   QUESTION; data: gen-data §7db D.flowForced = {house, vsOn, vsCoal}, each
   wave carrying every cohort's Labor share on the one date). Renders
   index.html#allpolls at desktop and phone rungs and asserts GEOMETRY, never
   screenshots (auspol-headless-geometry-verify): the two figures share a row
   side by side on desktop and stack full-width on a phone, each svg draws ONE
   cohort-coloured line per cohort (Labor v One Nation asks Greens, Coalition
   and Other voters; Labor v the Coalition asks Greens, One Nation and Other
   voters), every line's dots vmap that cohort's published Labor shares at
   distinct months, end labels ride a dodged per-cohort name+value block at
   the last dot's x, gridlines are five, and the class tokens are the party
   hues (grn/lnp/onp/oth), not an a/b alp/rival scheme. The June 2026
   Coalition split is the dataset's one derived cell (estCohort "coal": the
   report printed CLP/LNP/Nat and Liberal rows, no combined row) — its note
   rides that cohort's June hit in the Labor-v-One-Nation chart alone. The
   dots ride the standard wave-dot idiom: tooltips carry "Click to open this
   poll in All polls" (never a wave-report link), a mouse click or Enter
   opens the poll row, and the wave's forced-choice figures sit in the opened
   poll's ledger: the archive drawer's matchup grid carries a "<Cohort>
   voters, if forced to choose" row per cohort — Coalition and One Nation
   (one column each) plus Greens and Other (both columns) — (RdApDetail),
   with the June wave's combined-rows note under the grid. The Latest-tab
   poll detail carries the same figures as "forced, <cohort> voters, ALP v
   …" ledger lines (tppLines). The card titles TELL the story: all three
   cohorts' latest Labor shares, with a "— <Cohort> voters up/down from NN%
   in <that cohort's first wave month>" tail iff the straight-line drift
   battery says Yes for EXACTLY ONE cohort on the chart (a title never
   claims a move the table won't stand behind); the pressed-choice rows sit
   in the trend-significance table as a third set, Holm's correction across
   the six — both recomputed here independently from window.AUSPOL.flowForced,
   never trusted from the page.
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

/* the cohort lexicon and the two charts' rosters, mirroring the renderer's
   FF_COHORTS map and its two call sites exactly */
const CONAME = { grn: "Greens", coal: "Coalition", onp: "One Nation", oth: "Other" };
const CLS = { grn: "grn", coal: "lnp", onp: "onp", oth: "oth" };
const CHARTS = [
  { q: "on", cohorts: ["grn", "coal", "oth"], rival: "One Nation", vsKey: "vsOn" },
  { q: "co", cohorts: ["grn", "onp", "oth"], rival: "the Coalition", vsKey: "vsCoal" },
];

/* the pressed-choice battery, recomputed independently of the page: one
   straight line per (chart, cohort) through its Labor-share dots (w=1 like
   the renderer's, x the mid-month decimal gen-data's D.mx mirrors), Holm
   across the SIX; a cohort's Yes licenses a tail naming it in its chart's
   title and its table row's verdict */
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
function lineFit(pts) {
  const n = pts.length;
  if (n - 2 < 3) return null;
  const tb = pts.reduce((a, p) => a + mxm(p.ym), 0) / n, yb = pts.reduce((a, p) => a + p.v, 0) / n;
  const dm = pts.map((p) => ({ dt: mxm(p.ym) - tb, dy: p.v - yb }));
  const df = n - 2, sxx = dm.reduce((a, p) => a + p.dt * p.dt, 0);
  const b = dm.reduce((a, p) => a + p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  return { b, t: b / se, p: tTail(b / se, df) };
}
function expectedForced(FF) {
  const rows = CHARTS.flatMap((c) => c.cohorts.map((ck) => {
    const waves = FF[c.vsKey].filter((w) => w[ck] != null);
    return { key: c.q + ck, ck, q: c.q, waves, fit: lineFit(waves.map((w) => ({ ym: w.ym, v: w[ck] }))) };
  }));
  const tested = rows.filter((r) => r.fit), sigK = [];
  for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (r.fit.p >= 0.05 / (tested.length - i)) break;
    sigK.push(r.key);
  }
  for (const r of rows) r.sig = sigK.includes(r.key);
  const title = (c) => {
    const waves = FF[c.vsKey];
    const parts = c.cohorts.map((ck) => {
      const w = [...waves].reverse().find((x) => x[ck] != null);
      return `${w[ck]}% of ${CONAME[ck]} voters`;
    });
    const list = parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
    const moved = rows.filter((r) => r.q === c.q && r.sig && r.waves[0][r.ck] !== r.waves[r.waves.length - 1][r.ck]);
    const tail = moved.length !== 1 ? "" : (() => {
      const r = moved[0], f = r.waves[0][r.ck], la = r.waves[r.waves.length - 1][r.ck];
      return " — " + CONAME[r.ck] + " voters " + (la > f ? "up" : "down") + " from " + f + "% in " + monY(r.waves[0].ym);
    })();
    return list + " prefer Labor over " + c.rival + tail;
  };
  const cells = (r) => [r.waves[0][r.ck] + " → " + r.waves[r.waves.length - 1][r.ck],
    r.fit ? sgn1(r.fit.b, true) : "–", r.fit ? sgn1(r.fit.t) : "–",
    r.fit ? (r.sig ? "Yes" : "No") : "–"];
  const name = (r) => CONAME[r.ck] + " voters, v " + (r.q === "on" ? "One Nation" : "Coalition");
  return { titles: [title(CHARTS[0]), title(CHARTS[1])],
           rows: rows.map((r) => ({ name: name(r), cells: cells(r), sig: r.sig })) };
}
/* per-fig expectations straight from the payload: dot sequences per cohort
   (in wave order), latest share per cohort, hit tally */
function expectFig(FF, ci) {
  const c = CHARTS[ci], waves = FF[c.vsKey];
  const dots = {}, latest = {}, counts = {};
  let nHits = 0;
  for (const w of waves) for (const ck of c.cohorts) if (w[ck] != null) nHits++;
  for (const ck of c.cohorts) {
    const ws = waves.filter((w) => w[ck] != null);
    dots[CLS[ck]] = ws.map((w) => w[ck]);
    counts[CLS[ck]] = ws.length;
    latest[ck] = ws.length ? ws[ws.length - 1][ck] : null;
  }
  const tabbable = waves.filter((w) => w[c.cohorts[0]] != null).length;
  return { nHits, dots, counts, latest, tabbable,
           ms: [...new Set(waves.map((w) => w.ym))] };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const gotoFlows = async (w) => {
  await page.setViewport({ width: w, height: 1200, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ff svg .rd-ff-line.grn", { timeout: 30000 });
  await page.evaluate(() => document.querySelector(".rd-ff").scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 350));
};

const measure = () => page.evaluate(() => {
  const figs = [...document.querySelectorAll(".rd-ff figure.rd-ff")];
  const out = { nFig: figs.length, figs: [] };
  for (const fig of figs) {
    const svg = fig.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const lines = [...fig.querySelectorAll(".rd-ff-line")].map((p) => ({
      cls: p.getAttribute("class").replace("rd-ff-line ", ""),
      d: p.getAttribute("d"),
    }));
    const dots = {};
    for (const cls of ["grn", "lnp", "onp", "oth"])
      dots[cls] = [...fig.querySelectorAll(".rd-ff-dot." + cls)].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
    const hits = [...fig.querySelectorAll("circle.rd-apd-hit")];
    const elsT = [...fig.querySelectorAll(".rd-ff-el")];
    const elvsT = [...fig.querySelectorAll(".rd-ff-elv")];
    out.figs.push({
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top),
      vb: svg.getAttribute("viewBox"),
      lines, dots,
      nHits: hits.length,
      tabbable: hits.filter((h) => h.getAttribute("tabindex") === "0").length,
      nButtons: hits.filter((h) => h.getAttribute("role") === "button").length,
      arias: hits.map((h) => h.getAttribute("aria-label") || ""),
      gls: fig.querySelectorAll(".rd-ff-gl").length,
      els: elsT.map((t) => t.textContent),
      elxs: elsT.map((t) => +t.getAttribute("x")),
      elys: elsT.map((t) => +t.getAttribute("y")),
      elvs: elvsT.map((t) => t.textContent),
      xMax: Math.max(...[].concat(...Object.values(dots)).map((d) => d.x)),
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

const FF = await (async () => {
  await page.setViewport({ width: 1366, height: 1200, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ff svg .rd-ff-line.grn", { timeout: 30000 });
  return page.evaluate(() => window.AUSPOL.flowForced);
})();
check(!!FF && FF.house === "RedBridge/Accent" && Array.isArray(FF.vsOn) && Array.isArray(FF.vsCoal),
  `payload: D.flowForced is the question-keyed pair (${FF && Object.keys(FF).join("/")})`);
const EXP = FF ? [expectFig(FF, 0), expectFig(FF, 1)] : null;
const FFexp = FF ? expectedForced(FF) : null;

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
}
for (const [i, f] of d.figs.entries()) {
  const cam = CHARTS[i], exp = EXP[i], tag = i === 0 ? "v-ON chart" : "v-Coalition chart";
  check(f.lines.length === 3, `desktop ${tag}: three cohort lines (${f.lines.length})`);
  check(JSON.stringify(f.lines.map((l) => l.cls).sort()) === JSON.stringify(cam.cohorts.map((c) => CLS[c]).sort()),
    `desktop ${tag}: line classes are the party hues ${cam.cohorts.map((c) => CLS[c]).join("/")} (${f.lines.map((l) => l.cls).join(", ")})`);
  check(new Set(f.lines.map((l) => l.d)).size === 3, `desktop ${tag}: three distinct line paths`);
  for (const ck of cam.cohorts) {
    const cls = CLS[ck];
    check(f.dots[cls].length === exp.counts[cls],
      `desktop ${tag} ${CONAME[ck]}: ${exp.counts[cls]} dots, one per published wave (${f.dots[cls].length})`);
    check(new Set(f.dots[cls].map((p) => Math.round(p.x))).size === f.dots[cls].length,
      `desktop ${tag} ${CONAME[ck]}: dots sit at distinct months`);
  }
  check(f.gls === 5, `desktop ${tag}: five gridlines`);
  check(f.nHits === exp.nHits, `desktop ${tag}: ${exp.nHits} hit circles, one per cohort dot (${f.nHits})`);
  check(f.tabbable === exp.tabbable && f.nButtons === exp.tabbable,
    `desktop ${tag}: the first cohort's hit alone is the focusable button (${f.tabbable}/${f.nButtons} of ${exp.tabbable})`);
  check(f.els.length === 3 && JSON.stringify(f.els) === JSON.stringify(cam.cohorts.map((c) => CONAME[c])),
    `desktop ${tag}: end labels name the three cohorts (${f.els.join(" · ")})`);
  check(JSON.stringify(f.elvs) === JSON.stringify(cam.cohorts.map((c) => String(exp.latest[c]))),
    `desktop ${tag}: end values are the latest shares (${f.elvs.join(" · ")})`);
  check(f.elxs.every((x) => x === f.xMax + 8), `desktop ${tag}: end labels hug the last dot's x (${f.elxs.join(",")} = ${f.xMax}+8)`);
  const labYs = [...f.elys].sort((p, q) => p - q);
  check(labYs.every((y, j) => j === 0 || y - labYs[j - 1] >= 27),
    `desktop ${tag}: the end-label dodge keeps blocks apart (min gap ${Math.min(...labYs.slice(1).map((y, j) => Math.round(y - labYs[j])))})`);
  const bot = 230 - 34;
  check(Object.values(f.dots).every((arr) => arr.every((p) => p.y > 0 && p.y < bot)),
    `desktop ${tag}: every dot inside the plot`);
  for (const ck of cam.cohorts) {
    const got = f.dots[CLS[ck]].map((p) => Math.round(100 * (bot - p.y) / (bot - 16)));
    check(JSON.stringify(got) === JSON.stringify(exp.dots[CLS[ck]]),
      `desktop ${tag} ${CONAME[ck]}: dots vmap the published shares (${JSON.stringify(got)})`);
  }
  check(f.arias.every((s) => /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}: (Greens|Coalition|One Nation|Other) voters — Labor \d/.test(s)),
    `desktop ${tag}: every hit aria reads "<month> <year>: <cohort> voters — Labor N, …"`);
}
{
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  const ariaOn = d.figs[0].arias.filter((s) => s.startsWith("June 2026:"));
  const juneCoal = ariaOn.find((s) => s.includes("Coalition voters"));
  check(!!juneCoal && juneCoal.includes(`Coalition voters — Labor ${juneOn.coal}, One Nation ${100 - juneOn.coal}`) && juneCoal.includes("combines") && juneCoal.includes("CLP/LNP/Nat"),
    `desktop v-ON June: the Coalition dot's aria reads the combined-rows note (${JSON.stringify(juneCoal)})`);
  check(ariaOn.filter((s) => !s.includes("Coalition voters")).every((s) => !s.includes("combines")),
    "desktop v-ON June: the printed cohorts' arias stay plain");
  check(!d.figs[1].arias.some((s) => s.includes("combines")),
    "desktop v-Coalition: no est note anywhere on the second chart (all cells printed)");
}
const viewH = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH === 230, `desktop: plot height 230 (${viewH})`);

// the titles tell all three cohorts' latest shares; tails ride the battery
check(d.h4s.length === 2 && d.h4s[0] === FFexp.titles[0],
  `desktop: v-ON title is the three-share line${FFexp.titles[0].includes(" — ") ? " + its one-cohort tail" : ""} (${JSON.stringify(d.h4s[0])})`);
check(d.h4s.length === 2 && d.h4s[1] === FFexp.titles[1],
  `desktop: v-Coalition title is the three-share line${FFexp.titles[1].includes(" — ") ? " + tail" : ""} (${JSON.stringify(d.h4s[1])})`);
// the trend-significance table's pressed set carries the same battery, six rows
check(d.tsigHeads && JSON.stringify(d.tsigHeads) === JSON.stringify(["Series", "First → last", "Slope, pts/yr", "t", "Significant"]),
  `tsig heads fit gaps and shares (${JSON.stringify(d.tsigHeads)})`);
check(d.pressed && d.pressed.length === 6 && JSON.stringify(d.pressed.map((r) => r.name)) === JSON.stringify(FFexp.rows.map((r) => r.name)),
  `pressed set: six rows, both charts' cohorts in order (${JSON.stringify((d.pressed || []).map((r) => r.name))})`);
for (const [i, exp] of FFexp.rows.entries()) {
  const row = d.pressed && d.pressed[i];
  check(!!row && JSON.stringify(row.cells) === JSON.stringify(exp.cells),
    `pressed ${exp.name}: figures recomputed (${JSON.stringify(row && row.cells)} vs ${JSON.stringify(exp.cells)})`);
  check(!!row && row.yes === (exp.sig ? 1 : 0),
    `pressed ${exp.name}: Yes-wash iff the battery says Yes (${row && row.yes} yes-td on a ${exp.cells[3]})`);
}

/* hover/click helpers: find one cohort's hit on one figure by its aria
   prefix (ym) and cohort phrase — the canvas is shared, so every pick
   scrolls first, then re-measures the centre */
const hitAt = async (fi, ym, co) => {
  const sel = (fi, ym, co) => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][fi];
    return [...fig.querySelectorAll("circle.rd-apd-hit")].find((h) => {
      const a = h.getAttribute("aria-label") || "";
      return a.startsWith(ym + ":") && a.includes(co + " voters");
    });
  };
  const has = await page.evaluate((fi, ym, co, sel) => {
    const h = eval(sel)(fi, ym, co);
    if (!h) return false;
    h.scrollIntoView({ block: "center" });
    return true;
  }, fi, ym, co, sel.toString());
  if (!has) return null;
  await new Promise((r) => setTimeout(r, 350));
  return page.evaluate((fi, ym, co, sel) => {
    const h = eval(sel)(fi, ym, co);
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, fi, ym, co, sel.toString());
};
const readTip = (fi) => page.evaluate((fi) => {
  const fig = [...document.querySelectorAll("figure.rd-ff")][fi];
  const t = fig.querySelector(".tip.rd-ff-tip");
  if (!t || t.offsetParent === null) return null;
  return {
    title: t.querySelector(".tip-title").textContent,
    rows: [...t.querySelectorAll(".tip-row .tip-label")].map((l) => l.textContent.trim()),
    vals: [...t.querySelectorAll(".tip-row .tip-val")].map((v) => v.textContent.trim()),
    hint: (t.querySelector("div.tip-hint") || {}).textContent || null,
    link: !!t.querySelector("a.rd-ff-lnk"),
    est: [...t.querySelectorAll(".tip-sub.tip-hint")].map((s) => s.textContent.trim()),
    wrap: t.querySelectorAll(".tip-row.tip-hintwrap").length,
  };
}, fi);
const hover = async (fi, ym, co) => {
  const c = await hitAt(fi, ym, co);
  if (!c) return null;
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  return readTip(fi);
};

// tips: the latest wave on the v-ON chart's Coalition cohort — the standard
// open-poll chrome, per-cohort title, no report link, no est on a printed wave
const lastOn = FF.vsOn[FF.vsOn.length - 1], lastCo = FF.vsCoal[FF.vsCoal.length - 1];
const lastOnYm = monY(lastOn.ym);
{
  const tip = await hover(0, lastOnYm, "Coalition");
  check(!!tip && tip.title === `${lastOnYm} · Coalition voters`,
    `v-ON ${lastOnYm} coal hover: tip titled "<month> · Coalition voters" (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.rows.includes("Labor") && tip.vals.includes(`${lastOn.coal}%`),
    `v-ON coal tip: Labor row ${lastOn.coal}% (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.rows.includes("One Nation") && tip.vals.includes(`${100 - lastOn.coal}%`),
    `v-ON coal tip: One Nation row ${100 - lastOn.coal}%`);
  check(tip && tip.rows.includes("Sample") && tip.vals.includes(`n = ${lastOn.n.toLocaleString()}`),
    `v-ON coal tip: sample row ${lastOn.n}`);
  check(tip && tip.hint === "Click to open this poll in All polls", `v-ON coal tip: the standard open-poll hint (${JSON.stringify(tip && tip.hint)})`);
  check(tip && tip.link === false, "v-ON coal tip: no wave-report link in the tip (it lives in the opened poll's ledger)");
  check(tip && tip.est.length === 0 && tip.wrap === 0, "v-ON coal tip: no est note on a printed wave");
}
// the June est note rides only the v-ON chart's Coalition cohort
{
  const tipJ = await hover(0, "June 2026", "Coalition");
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  check(!!tipJ && tipJ.title === "June 2026 · Coalition voters"
      && tipJ.est.length === 1 && tipJ.est[0].includes("CLP/LNP/Nat (34)") && tipJ.est[0].includes("Liberal (37)"),
    `v-ON June coal tip: the combined-rows note rides the June dot (${JSON.stringify(tipJ && tipJ.est)})`);
  check(tipJ && tipJ.hint === "Click to open this poll in All polls", `v-ON June coal tip: the open-poll hint beside the est note (${JSON.stringify(tipJ && tipJ.hint)})`);
  check(tipJ && tipJ.wrap === 1, `v-ON June coal tip: only the est note is a wrapped row (${tipJ && tipJ.wrap})`);
  check(tipJ && tipJ.vals.includes(`${juneOn.coal}%`), `v-ON June coal tip: the derived 36 (read ${JSON.stringify(tipJ && tipJ.vals)})`);
  const tipG = await hover(0, "June 2026", "Greens");
  check(!!tipG && tipG.est.length === 0 && tipG.wrap === 0, "v-ON June Greens tip: no est note on a printed cohort");
}
// the v-Coalition chart's tips name the Coalition as the rival
{
  const tip = await hover(1, monY(lastCo.ym), "Greens");
  check(!!tip && tip.title === `${monY(lastCo.ym)} · Greens voters`,
    `v-Coalition ${monY(lastCo.ym)} Greens hover: per-cohort title (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.rows.includes("Coalition") && !tip.rows.includes("the Coalition"),
    `v-Coalition Greens tip: rival row reads Coalition bare (${JSON.stringify(tip && tip.rows)})`);
  check(tip && tip.vals.includes(`${lastCo.grn}%`) && tip.vals.includes(`${100 - lastCo.grn}%`),
    `v-Coalition Greens tip: ${lastCo.grn} / ${100 - lastCo.grn}`);
}

// click the latest v-ON Coalition dot with a real mouse: the wave opens in
// All polls, named by the return button, and its wave's forced-choice
// figures sit in the poll ledger's "as published" section
{
  const c = await hitAt(0, lastOnYm, "Coalition");
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
         two column cells (only the asked rival's column carries figures) */
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
    `click ${lastOnYm} coal dot: the wave's poll row opens in All polls (${JSON.stringify(land && land.head)})`);
  check(!!land && land.back === "Back to the forced-choice flow chart",
    `…the return button names the forced-choice chart (${JSON.stringify(land && land.back)})`);
  /* every forced row's figures recomputed from the payload: the pair text
     "<v> – <100−v>" rides the asked rival's column, with the wave-on-wave
     arrow iff the share moved */
  const prevOf = (vs, ck) => {
    const ws = vs.filter((w) => w[ck] != null);
    return ws.length > 1 ? ws[ws.length - 2][ck] : ws[0][ck];
  };
  const arrow = (v, p) => (v > p ? `▲ ${Math.abs(v - p)}` : v < p ? `▼ ${Math.abs(v - p)}` : null);
  const rowsByKey = Object.fromEntries((land && land.forced || []).map((x) => [x.key, x.cells]));
  const row = (co) => rowsByKey[`${CONAME[co]} voters, if forced to choose`];
  check(!!land && ["coal", "onp", "grn", "oth"].every((co) => row(co)), 
    `ledger: all four cohort forced rows present (${JSON.stringify(land && land.forced.map((x) => x.key))})`);
  const pairChk = (cells, v, p, tag) => {
    const inCells = cells.some((t) => t.includes(`${v} – ${100 - v}`));
    const a = arrow(v, p);
    return inCells && (a === null ? true : cells.some((t) => t.includes(a)));
  };
  check(!!row("coal") && pairChk(row("coal"), lastOn.coal, prevOf(FF.vsOn, "coal")),
    `ledger: Coalition-voters row ${lastOn.coal} – ${100 - lastOn.coal} v One Nation (${JSON.stringify(row("coal"))})`);
  check(!!row("onp") && pairChk(row("onp"), lastCo.onp, prevOf(FF.vsCoal, "onp")),
    `ledger: One-Nation-voters row ${lastCo.onp} – ${100 - lastCo.onp} v Coalition (${JSON.stringify(row("onp"))})`);
  check(!!row("grn") && pairChk(row("grn"), lastOn.grn, prevOf(FF.vsOn, "grn")) && pairChk(row("grn"), lastCo.grn, prevOf(FF.vsCoal, "grn")),
    `ledger: Greens-voters row carries BOTH questions (${JSON.stringify(row("grn"))})`);
  check(!!row("oth") && pairChk(row("oth"), lastOn.oth, prevOf(FF.vsOn, "oth")) && pairChk(row("oth"), lastCo.oth, prevOf(FF.vsCoal, "oth")),
    `ledger: Other-voters row carries BOTH questions (${JSON.stringify(row("oth"))})`);
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
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  check(!!jun && Array.isArray(jun.coalCell) && jun.coalCell.some((t) => t.includes(`${juneOn.coal}`) && t.includes(`${100 - juneOn.coal}`)),
    `June wave drawer: forced split ${juneOn.coal} – ${100 - juneOn.coal} rides the v-One-Nation column (${JSON.stringify(jun && jun.coalCell)})`);
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
  for (const [i, f] of [a, b].entries()) {
    const tag = i === 0 ? "v-ON" : "v-Coalition";
    check(f.lines.length === 3, `phone ${tag}: three cohort lines (${f.lines.length})`);
    check(f.nHits === EXP[i].nHits, `phone ${tag}: ${EXP[i].nHits} hit circles, one per cohort dot (${f.nHits})`);
    check(JSON.stringify(f.els) === JSON.stringify(CHARTS[i].cohorts.map((c) => CONAME[c])),
      `phone ${tag}: same three cohort end labels (${f.els.join(" · ")})`);
  }
}
check(m.h4s.length === 2 && m.h4s[0] === FFexp.titles[0] && m.h4s[1] === FFexp.titles[1],
  `phone: same dynamic titles as desktop (${JSON.stringify(m.h4s)})`);
const viewH2 = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH2 === 190, `phone: plot height 190 (${viewH2})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "rd-forced-charts: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);

