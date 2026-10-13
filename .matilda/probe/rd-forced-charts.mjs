/* headless geometry probe of the RdForced "forced to choose" trio in the
   All-polls Preference flows section (moved from /preference-flows/ 2026-10-10;
   REGROUPED the same day from one chart per voter cohort to one chart per
   QUESTION, and a THIRD chart joined 2026-10-13: DemosAU's MRP prints the
   Coalition pressed against One Nation by region alone, so its reading is
   a DemosAU-only chart — all diamonds, never a line). Data: gen-data §7db
   D.flowForced = {house, vsOn, vsCoal, elec2025, demos?, demosOn, lnpOn},
   the MRP carriers keyed FOUR WAYS (inner/outer/regional as printed and
   `all` the site's enrolment-and-vote weighting of them, marked wt) — the
   region select above the charts only REKEYS a wave, never recomputes it.
   The section head's DemosAU MRP region select (All voters / Inner metro /
   Outer metro / Regional) rekeys the DemosAU figures on all three charts;
   RedBridge/Accent's waves and the election's rings are national as printed.
   Renders allpolls/ at desktop and phone rungs and asserts GEOMETRY, never
   screenshots (auspol-headless-geometry-verify): the Labor-contest figures
   share a row side by side on desktop with the Coalition v One Nation figure
   below them, all three stacking full-width on a phone, the Labor charts
   drawing ONE cohort-coloured line per cohort (Labor v One Nation asks
   Greens, Coalition and Other voters; Labor v the Coalition asks Greens,
   One Nation and Other voters; Coalition v One Nation asks Labor, Greens
   and Other voters), every line's dots vmap that cohort's published shares
   at distinct months, end labels ride a dodged per-cohort name+value block
   at the last dot's x, gridlines are five, and the class tokens are the
   party hues (grn/lnp/onp/oth/alp), not an a/b alp/rival scheme. The June 2026
   Coalition split is the dataset's one derived cell (estCohort "coal": the
   report printed CLP/LNP/Nat and Liberal rows, no combined row) — its note
   rides that cohort's June hit in the Labor-v-One-Nation chart alone. The
   dots ride the standard wave-dot idiom: tooltips carry "Click to open this
   poll in All polls" (never a wave-report link), a mouse click or Enter
   opens the poll row, and the wave's forced-choice figures sit in the opened
   poll's Also-in-this-poll as a Preferences line (RdLgFlowsLine, the DemosAU
   MRP Preferences line's shape): an "If forced to choose" lead, one
   contest-titled group per question ("to ALP v ON" / "to ALP v L/NP") with
   the printed cohort shares as party-tagged figures, the June wave's
   combined-rows note as the line's tail, and NOT A ROW of the drawer's
   two-party table. Every wave mark
   rides its printed fieldwork window's TRUE midpoint: gen-data stamps each
   wave its fractional month index (xm — RedBridge's Mon→Mon windows land
   near month ends) and a printed-window label (win, "24–30 Sep 2026"),
   the renderer anchors dots and hit labels to that x/text instead of the
   whole-month grid, and this probe re-derives each dot's x from the
   printed tick scale (the mrp-prefs recipe), one 1.5px tolerance, never
   snapped to a slot (the fleet-anchoring user call 2026-10-13). The Labor
   v the Coalition chart alone carries the May 2025 ELECTION RINGS: one
   .rd-ring per cohort at the election's true date x, vmap'ing the AEC's
   printed 2025 preference flows (Greens 88.2 / One Nation 25.5 / Other
   54.6 to Labor — the same pair the section's benchmark sentence uses;
   gen-data elec2025), each ring's <title> naming the election, cohort and
   figure, and the svg's aria carried a spoken "Open rings" note. The
   Latest-tab poll detail carries the same figures as "forced, <cohort>
   voters, ALP v …" ledger lines (tppLines). The card titles TELL the story: all three
   cohorts' latest Labor shares, with a "— <Cohort> voters up/down from NN%
   in <that cohort's first wave month>" tail iff the straight-line drift
   battery says Yes for EXACTLY ONE cohort on the chart (a title never
   claims a move the table won't stand behind); the pressed-choice rows sit
   in the trend-significance table as a third set ("Pressed-choice share"),
   Holm's correction across the NINE (three charts x three cohorts — the
   Coalition's share on the third chart, Labor's on the pair) — recomputed
   here independently from window.AUSPOL.flowForced, never trusted from the
   page.
*/
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.join(ROOT, "index.html");
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

/* the cohort lexicon, mirroring the renderer's FF_COHORTS map */
const CONAME = { grn: "Greens", coal: "Coalition", onp: "One Nation", oth: "Other", alp: "Labor" };
/* the titles' prose name ("50% of other voters") */
const PROSE = { grn: "Greens", coal: "Coalition", onp: "One Nation", oth: "other", alp: "Labor" };
const CLS = { grn: "grn", coal: "lnp", onp: "onp", oth: "oth", alp: "alp" };
/* in page order since 2026-10-13: Labor v Coalition left, Labor v One
   Nation right (the upper drift pair's order), Coalition v One Nation in
   the .rd-ff-ln row beneath. extKey names a chart's DemosAU MRP diamond
   extras - the third chart's readings ARE MRP carriers (lnpOn), so it has
   none of its own and draws no line. The Coalition chart alone carries
   the election */
const CHARTS = [
  { q: "co", cohorts: ["grn", "onp", "oth"], anchor: "Labor", anchorShort: "Labor", rival: "the Coalition", rivalShort: "Coalition", vsKey: "vsCoal", extKey: "demos", elec: true },
  { q: "on", cohorts: ["grn", "coal", "oth"], anchor: "Labor", anchorShort: "Labor", rival: "One Nation", rivalShort: "One Nation", vsKey: "vsOn", extKey: "demosOn", elec: false },
  { q: "ln", cohorts: ["alp", "grn", "oth"], anchor: "the Coalition", anchorShort: "the Coalition", rival: "One Nation", rivalShort: "One Nation", vsKey: null, extKey: null, elec: false },
];
const FI = { co: 0, on: 1, ln: 2 };
/* the battery's own definition order, mirroring the renderer's ffQ */
const FF_DEFS = [CHARTS[1], CHARTS[0], CHARTS[2]];
const FF_MRP_HOUSE = "DemosAU (MRP)";
/* the region select's options, mirroring FF_REGIONS */
const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];

/* the region menu's rekey, mirrored from the renderer's rekeyMrp: "" reads
   a carrier's `all` (the site's enrolment-and-vote weighting, marked wt),
   a named region its printed cells; a wave without that print drops out */
const rekeyMrp = (ws, reg) => (ws || []).map((w) => {
  if (!reg) return { ...w, ...w.all, wt: true };
  const t = w[reg];
  return t ? { ...w, ...t, wt: undefined } : null;
}).filter(Boolean);
/* a chart's wave list at a region: RedBridge's pair as printed, the ln
   chart's MRP carriers rekeyed */
const wavesOf = (FF, q, reg) => (q === "ln" ? rekeyMrp(FF.lnpOn, reg) : FF[CHARTS[FI[q]].vsKey]);
const extOf = (FF, q, reg) => {
  if (q === "co") return FF.demos || [];     /* DemosAU's ONE national print - the menu doesn't touch it */
  if (q === "on") return rekeyMrp(FF.demosOn, reg);
  return [];
};

/* the pressed-choice battery, recomputed independently of the page: one
   straight line per (chart, cohort) through its pressed-share dots (w=1
   like the renderer's, x each wave's own xm/12 year fraction - the MRP
   quarterlies sit between month ticks), Holm across the NINE; a cohort's
   Yes licenses a tail naming it in its chart's title and its table row's
   verdict */
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
/* the empirical month-index → x map from a figure's printed tick labels
   (year tokens propagate down the list, as in .matilda/probe/mrp-prefs.mjs);
   x maps any payload xm through it */
const MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const axisMap = (ticks) => {
  const slots = [];
  let yr = null;
  for (const l of ticks) {
    const m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( ’(\d{2}))?$/.exec(l.s);
    if (!m) return { err: "unparsed tick label " + JSON.stringify(l.s) };
    if (m[3]) yr = 2000 + Number(m[3]);
    if (yr == null) return { err: "first tick carries no year" };
    slots.push([yr * 12 + MON_ABBR.indexOf(m[1]), l.x]);
  }
  if (slots.length < 2) return { err: "fewer than two month ticks" };
  const [m1, x1] = slots[0], [m2, x2] = slots[slots.length - 1];
  const per = (x2 - x1) / (m2 - m1);
  return { x: (xm) => x1 + (xm - m1) * per };
};
const fmtMax = (got, want) => got.length ? Math.max(...got.map((x, k) => Math.abs(x - want[k]))).toFixed(2) : "–";
const winInAria = (w, a) => a.startsWith("RedBridge/Accent, " + (w.win || monY(w.ym)) + ":");
function lineFit(pts) {          /* pts: {x, v} - x the wave's own xm/12, exactly as the page fits */
  const n = pts.length;
  const df = n - 2;
  if (df < 3) return null;
  const tb = pts.reduce((a, p) => a + p.x, 0) / n, yb = pts.reduce((a, p) => a + p.v, 0) / n;
  const dm = pts.map((p) => ({ dt: p.x - tb, dy: p.v - yb }));
  const sxx = dm.reduce((a, p) => a + p.dt * p.dt, 0);
  if (!(sxx > 0)) return null;
  const b = dm.reduce((a, p) => a + p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  const t = se > 0 ? b / se : 0;
  return { b, t, p: se > 0 ? tTail(t, df) : 1 };
}
function expectedForced(FF, reg) {
  /* the trend table keeps the renderer's ffQ order: Labor v One Nation
     first, then Labor v the Coalition, then Coalition v One Nation */
  const rows = FF_DEFS.flatMap((c) => {
    const waves = wavesOf(FF, c.q, reg);
    return c.cohorts.map((ck) => {
      const ws = waves.filter((w) => w[ck] != null);
      return { key: c.q + ck, ck, q: c.q, waves: ws,
               fit: lineFit(ws.map((w) => ({ x: w.xm / 12, v: w[ck] }))) };
    });
  });
  const tested = rows.filter((r) => r.fit), sigK = [];
  for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (r.fit.p >= 0.05 / (tested.length - i)) break;
    sigK.push(r.key);
  }
  for (const r of rows) r.sig = sigK.includes(r.key);
  const title = (c) => {
    const waves = wavesOf(FF, c.q, reg);
    const parts = c.cohorts.map((ck) => {
      const w = [...waves].reverse().find((x) => x[ck] != null);
      return `${w[ck]}% of ${PROSE[ck]} voters`;
    });
    const list = parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
    const moved = rows.filter((r) => r.q === c.q && r.sig && r.waves[0][r.ck] !== r.waves[r.waves.length - 1][r.ck]);
    const tail = moved.length !== 1 ? "" : (() => {
      const r = moved[0], f = r.waves[0][r.ck], la = r.waves[r.waves.length - 1][r.ck];
      return " — " + PROSE[r.ck] + " voters " + (la > f ? "up" : "down") + " from " + f + "% in " + monY(r.waves[0].ym);
    })();
    return list + " prefer " + c.anchor + " over " + c.rival + tail;
  };
  const cells = (r) => [r.waves[0][r.ck] + " → " + r.waves[r.waves.length - 1][r.ck],
    r.fit ? sgn1(r.fit.b, true) : "–", r.fit ? sgn1(r.fit.t) : "–",
    r.fit ? (r.sig ? "Yes" : "No") : "–"];
  const name = (r) => CONAME[r.ck] + " voters, " + (r.q === "co" ? "v Coalition" : "v One Nation");
  return { titles: CHARTS.map(title),
           rows: rows.map((r) => ({ name: name(r), cells: cells(r), sig: r.sig })) };
}
/* per-fig expectations straight from the payload at a region: dot and
   diamond sequences per cohort (in payload order), the latest share per
   cohort, hit tally. An MRP-housed wave draws diamonds, never a dot */
function expectFig(FF, q, reg) {
  const c = CHARTS[FI[q]], isMrp = (w) => w.house === FF_MRP_HOUSE;
  const waves = wavesOf(FF, q, reg), ext = extOf(FF, q, reg), el = c.elec && FF.elec2025 ? [FF.elec2025] : [];
  const dots = {}, dms = {}, latest = {}, counts = {}, dmCounts = {};
  /* one hit per (mark group, cohort) - wave dots, MRP diamonds, election
     rings alike; one tab stop per group; a button where the group has a
     poll row to open (waves and MRPs, never the election) */
  let nHits = 0;
  for (const w of [...waves, ...ext, ...el]) for (const ck of c.cohorts) if (w[ck] != null) nHits++;
  for (const ck of c.cohorts) {
    const ws = waves.filter((w) => w[ck] != null);
    const waveDots = ws.filter((w) => !isMrp(w)), waveDms = ws.filter(isMrp);
    dots[CLS[ck]] = waveDots.map((w) => w[ck]);
    counts[CLS[ck]] = waveDots.length;
    dms[CLS[ck]] = [...waveDms, ...ext.filter((d) => d[ck] != null)].map((w) => w[ck]);
    dmCounts[CLS[ck]] = dms[CLS[ck]].length;
    latest[ck] = ws.length ? ws[ws.length - 1][ck] : null;
  }
  const tabbable = waves.length + ext.length + el.length;
  const nButtons = waves.length + ext.length;
  return { nHits, dots, dms, counts, dmCounts, latest, tabbable, nButtons,
           nDm: Object.values(dmCounts).reduce((a, n) => a + n, 0),
           ms: [...new Set(waves.map((w) => w.ym))] };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const gotoFlows = async (w) => {
  await page.setViewport({ width: w, height: 1200, deviceScaleFactor: 1 });
  await page.goto(APAGE, { waitUntil: "networkidle0", timeout: 60000 });
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
    const dmPts = {};
    for (const cls of ["grn", "lnp", "onp", "oth", "alp"]) {
      dots[cls] = [...fig.querySelectorAll(".rd-ff-dot." + cls)].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
      dmPts[cls] = [...fig.querySelectorAll("path.rd-ff-dm." + cls)].map((p) => {
        const m = /^M([\d.]+) ([\d.]+)/.exec(p.getAttribute("d"));
        return m ? { x: +m[1], y: +m[2] + 5.5 } : null;   /* the diamond's own centre */
      }).filter(Boolean);
    }
    const hits = [...fig.querySelectorAll("circle.rd-apd-hit")];
    const elsT = [...fig.querySelectorAll(".rd-ff-el")];
    const elvsT = [...fig.querySelectorAll(".rd-ff-elv")];
    out.figs.push({
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top),
      vb: svg.getAttribute("viewBox"),
      W: +svg.getAttribute("width"),
      aria: svg.getAttribute("aria-label") || "",
      ticks: [...fig.querySelectorAll("text.rd-dis-ax")].map((t) => ({ s: t.textContent.trim(), x: +t.getAttribute("x") })).filter((l) => /^[A-Z]/.test(l.s)),
      q: fig.dataset.q,
      inLn: !!fig.closest(".rd-ff-ln"),
      erings: [...fig.querySelectorAll("circle.rd-ring")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy"),
               cls: c.getAttribute("class").replace("rd-ring rd-ff-ring ", "") })),
      leads: [...fig.querySelectorAll("path.rd-ff-lead")].map((p) => ({ cls: p.getAttribute("class").replace("rd-ff-lead ", ""),
               d: p.getAttribute("d"), dash: p.getAttribute("stroke-dasharray") })),
      nDm: fig.querySelectorAll("path.rd-ff-dm").length,
      dmPts,
      waveArias: hits.filter((h) => h.classList.contains("wave")).map((h) => h.getAttribute("aria-label") || ""),
      titled: fig.querySelectorAll("title").length,
      lines, dots,
      nHits: hits.length,
      tabbable: hits.filter((h) => h.getAttribute("tabindex") === "0").length,
      nButtons: hits.filter((h) => h.getAttribute("role") === "button").length,
      contest: (fig.closest(".rd-fl-one").querySelector(".rd-fl-name") || {}).textContent || null,
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
  out.ffDeK = !!sec.querySelector(".rd-ff-head .rd-ff-d");
  out.h4s = [...sec.querySelectorAll(".rd-ff .rd-fl-one .rd-fl-ct h4")].map((h) => h.textContent.trim());
  out.sel = (() => {
    const s = sec.querySelector('.rd-ff-head select.rd-pv-sel');
    return s ? { aria: s.getAttribute("aria-label"), value: s.value,
                 options: [...s.options].map((o) => [o.value, o.textContent.trim()]) } : null;
  })();
  const det = sec.querySelector("details.rd-tsig");
  if (det) {
    out.tsigHeads = [...det.querySelectorAll(".rd-tsig-table thead th")].map((h) => h.textContent.trim());
    const bodies = [...det.querySelectorAll(".rd-tsig-table tbody")];
    const pr = bodies.find((tb) => {
      const s = tb.querySelector("tr.rd-tsig-set th");
      return s && s.textContent.trim() === "Pressed-choice share";
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
    const iNote = nodes.findIndex((el) => el.classList.contains("rd-fl-read"));
    const iFF = nodes.findIndex((el) => el.classList.contains("rd-ff"));
    const iTsig = nodes.findIndex((el) => el.classList.contains("rd-tsig"));
    return { iKey, iNote, iFF, iTsig };
  })();
  out.sw = document.documentElement.scrollWidth;
  out.iw = window.innerWidth;
  return out;
});

const FF = await (async () => {
  await page.setViewport({ width: 1366, height: 1200, deviceScaleFactor: 1 });
  await page.goto(APAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ff svg .rd-ff-line.grn", { timeout: 30000 });
  return page.evaluate(() => window.AUSPOL.flowForced);
})();
check(!!FF && FF.house === "RedBridge/Accent" && Array.isArray(FF.vsOn) && Array.isArray(FF.vsCoal) && Array.isArray(FF.lnpOn),
  `payload: D.flowForced carries the pair and the DemosAU lnpOn carriers (${FF && Object.keys(FF).join("/")})`);
check(!!FF && FF.lnpOn.length >= 2 && FF.lnpOn.every((w) => w.all && w.all.alp != null && w.all.grn != null && w.all.oth != null && typeof w.all.alp === "number"),
  `payload: every lnpOn carrier's \`all\` weighting keys alp/grn/oth (${FF && FF.lnpOn.length} waves)`);
const EXP = FF ? CHARTS.map((c) => expectFig(FF, c.q, "")) : null;
const FFexp = FF ? expectedForced(FF, "") : null;

// ---------------- desktop rung --------------------------------------------
await gotoFlows(1366);
const d = await measure();
check(d.nFig === 3, `desktop: three forced-choice figures, the pair plus Coalition v One Nation (${d.nFig})`);
check(d.h3 === "What voters say they’d do with their preferences", `desktop: section head names no one house (${JSON.stringify(d.h3)})`);
check(d.ffDeK, "desktop: the dek rides the section head");
check(JSON.stringify(d.figs.map((f) => f.q)) === '["co","on","ln"]' && d.figs[0].contest === "Labor v Coalition" && d.figs[1].contest === "Labor v One Nation" && d.figs[2].contest === "Coalition v One Nation",
  `desktop: Labor v Coalition left, Labor v One Nation right, Coalition v One Nation below, each led by its contest (${d.figs.map((f) => f.contest).join(" | ")})`);
check(!!d.sel && d.sel.aria === "DemosAU MRP region", `desktop: the region select rides the section head (${d.sel && d.sel.aria})`);
check(d.sel && JSON.stringify(d.sel.options) === JSON.stringify(FF_REGIONS),
  `desktop: region options are All voters / Inner metro / Outer metro / Regional (${JSON.stringify(d.sel && d.sel.options)})`);
check(d.sel && d.sel.value === "", `desktop: the select opens on All voters (${JSON.stringify(d.sel && d.sel.value)})`);
check(JSON.stringify(d.figs[0].ticks) === JSON.stringify(d.figs[1].ticks) && JSON.stringify(d.figs[0].ticks) === JSON.stringify(d.figs[2].ticks),
  "desktop: all three charts share one month axis (identical tick labels and x)");
check(d.figs.every((f) => f.titled === 0), "desktop: no native <title> tooltips - every mark tips through the shared card");
check(d.orderKeyThenForced.iKey > -1 && d.orderKeyThenForced.iNote === d.orderKeyThenForced.iKey + 1
    && d.orderKeyThenForced.iFF === d.orderKeyThenForced.iKey + 2,
  `desktop: the reading note sits under the drift key, the forced trio under it (key idx ${d.orderKeyThenForced.iKey}, note idx ${d.orderKeyThenForced.iNote}, forced idx ${d.orderKeyThenForced.iFF})`);
check(d.orderKeyThenForced.iTsig === d.orderKeyThenForced.iFF + 1,
  `desktop: the drift battery follows the forced trio (tsig idx ${d.orderKeyThenForced.iTsig})`);
{
  const [a, b, c] = d.figs;
  check(a.w > 400 && Math.abs(a.w - b.w) <= 2, `desktop: two equal-width charts side by side (${a.w}px, ${b.w}px)`);
  check(Math.abs(b.left - a.right) > 20, `desktop: a gap separates the two charts (${b.left - a.right}px)`);
  check(Math.abs(a.top - b.top) <= 1, `desktop: charts share a row (top ${a.top} vs ${b.top})`);
  check(c.inLn && c.top > a.top + a.h - 1, `desktop: the third chart reads as its own row below the pair (top ${c.top} after ${a.top + a.h})`);
  check(Math.abs(c.left - a.left) <= 1 && Math.abs(c.w - a.w) <= 2,
    `desktop: the third chart opens the row at the pair's width (${c.left}px, ${c.w}px of ${a.w}px)`);
}
for (const [i, f] of d.figs.entries()) {
  const cam = CHARTS[i], exp = EXP[i];
  const tag = cam.q === "on" ? "v-ON chart" : cam.q === "co" ? "v-Coalition chart" : "Coalition-v-ON chart";
  const lone = cam.q === "ln";
  check(f.lines.length === (lone ? 0 : 3),
    `desktop ${tag}: ${lone ? "no lines - a DemosAU-only chart is all diamonds" : "three cohort lines"} (${f.lines.length})`);
  if (!lone) {
    check(JSON.stringify(f.lines.map((l) => l.cls).sort()) === JSON.stringify(cam.cohorts.map((c) => CLS[c]).sort()),
      `desktop ${tag}: line classes are the party hues ${cam.cohorts.map((c) => CLS[c]).join("/")} (${f.lines.map((l) => l.cls).join(", ")})`);
    check(new Set(f.lines.map((l) => l.d)).size === 3, `desktop ${tag}: three distinct line paths`);
  }
  for (const ck of cam.cohorts) {
    const cls = CLS[ck];
    check(f.dots[cls].length === exp.counts[cls],
      `desktop ${tag} ${CONAME[ck]}: ${exp.counts[cls]} dots, one per published wave (${f.dots[cls].length})`);
    if (exp.counts[cls]) check(new Set(f.dots[cls].map((p) => Math.round(p.x))).size === f.dots[cls].length,
      `desktop ${tag} ${CONAME[ck]}: dots sit at distinct months`);
    check(f.dmPts[cls].length === exp.dmCounts[cls],
      `desktop ${tag} ${CONAME[ck]}: ${exp.dmCounts[cls]} DemosAU diamonds, one per MRP cohort cell (${f.dmPts[cls].length})`);
  }
  check(f.gls === 5, `desktop ${tag}: five gridlines`);
  check(f.nHits === exp.nHits, `desktop ${tag}: ${exp.nHits} hit circles, one per cohort mark (${f.nHits})`);
  check(f.tabbable === exp.tabbable && f.nButtons === exp.nButtons,
    `desktop ${tag}: one tab stop per mark group, a button wherever a poll row opens (${f.tabbable}/${f.nButtons} of ${exp.tabbable}/${exp.nButtons})`);
  check(f.nDm === exp.nDm, `desktop ${tag}: one DemosAU diamond per MRP cohort cell (${f.nDm} of ${exp.nDm})`);
  check(f.els.length === 3 && JSON.stringify(f.els) === JSON.stringify(cam.cohorts.map((c) => CONAME[c])),
    `desktop ${tag}: end labels name the three cohorts (${f.els.join(" · ")})`);
  check(JSON.stringify(f.elvs) === JSON.stringify(cam.cohorts.map((c) => String(exp.latest[c]))),
    `desktop ${tag}: end values are the latest shares (${f.elvs.join(" · ")})`);
  check(f.elxs.every((x) => x === f.W - 76), `desktop ${tag}: end labels hug the axis end (${f.elxs.join(",")} = W−84+8)`);
  const labYs = [...f.elys].sort((p, q) => p - q);
  check(labYs.every((y, j) => j === 0 || y - labYs[j - 1] >= 27),
    `desktop ${tag}: the end-label dodge keeps blocks apart (min gap ${Math.min(...labYs.slice(1).map((y, j) => Math.round(y - labYs[j])))})`);
  const bot = 236 - 34;
  check(Object.values(f.dots).every((arr) => arr.every((p) => p.y > 0 && p.y < bot))
      && Object.values(f.dmPts).every((arr) => arr.every((p) => p.y > 16 && p.y < bot)),
    `desktop ${tag}: every mark inside the plot`);
  for (const ck of cam.cohorts) {
    const got = f.dots[CLS[ck]].map((p) => Math.round(100 * (bot - p.y) / (bot - 16)));
    check(JSON.stringify(got) === JSON.stringify(exp.dots[CLS[ck]]),
      `desktop ${tag} ${CONAME[ck]}: dots vmap the published shares (${JSON.stringify(got)})`);
    const gotDm = f.dmPts[CLS[ck]].map((p) => Math.round(1000 * (bot - p.y) / (bot - 16)) / 10);
    check(JSON.stringify(gotDm) === JSON.stringify(exp.dms[CLS[ck]].map((v) => Math.round(10 * v) / 10)),
      `desktop ${tag} ${CONAME[ck]}: diamonds vmap the MRP shares (${JSON.stringify(gotDm)} vs ${JSON.stringify(exp.dms[CLS[ck]])})`);
  }
  /* every wave hit aria names the wave's own printed fieldwork window, not
     a month-of-the-grid: the renderer speaks w.win */
  const wsList = cam.vsKey ? FF[cam.vsKey] : null;
  if (wsList) check(f.waveArias.length && f.waveArias.every((s) => wsList.some((w) => winInAria(w, s)) && /: (Greens|Coalition|One Nation|Other) voters, Labor \d+, (Coalition|One Nation) \d/.test(s)),
    `desktop ${tag}: every wave hit's aria reads "RedBridge/Accent, <window>: <cohort> voters, Labor N, <rival> M"`);
  else {
    const mA = f.arias.filter((s) => s.startsWith("DemosAU MRP, "));
    check(mA.length === f.nHits && mA.every((s) => /: (Labor|Greens|Other) voters, the Coalition [\d.]+, One Nation [\d.]+/.test(s)),
      `desktop ${tag}: every hit's aria reads "DemosAU MRP, <window>: <cohort> voters, the Coalition N, One Nation M"`);
    check(mA.every((s) => s.includes("all regions, our weighting of DemosAU’s printed regional tables")),
      `desktop ${tag} (All voters): every MRP aria flags our weighting (${mA.length})`);
  }
  /* every mark rides its wave's TRUE fieldwork midpoint: derive the
     empirical month-index → x map from the printed tick labels (year
     tokens propagate), then every mark must sit at its payload xm through
     it, not at its month's slot */
  const tk = axisMap(f.ticks);
  check(!!tk && !tk.err, `desktop ${tag}: tick labels parsed${tk && tk.err ? " – " + tk.err : ""}`);
  if (tk) {
    const markXs = (arr, list) => {
      const want = list.map((w) => tk.x(w.xm));
      const got = arr.map((p) => p.x);
      return got.length === want.length && got.every((x, k) => Math.abs(x - want[k]) < 1.5) ? null : [got, want];
    };
    if (wsList) for (const ck of cam.cohorts) {
      const off = markXs(f.dots[CLS[ck]], wsList.filter((w) => w[ck] != null));
      check(!off, `desktop ${tag} ${CONAME[ck]}: dots sit at their waves' true midpoints${off ? " (" + fmtMax(...off) + "px off)" : ""}`);
    }
    if (!lone) for (const ck of cam.cohorts) {
      const extWaves = extOf(FF, cam.q, "").filter((w) => w[ck] != null);
      const off = markXs(f.dmPts[CLS[ck]].slice(-extWaves.length), extWaves);
      check(!off, `desktop ${tag} ${CONAME[ck]}: diamonds sit at their MRPs' true midpoints${off ? "" : ""}`);
    } else for (const ck of cam.cohorts) {
      const off = markXs(f.dmPts[CLS[ck]], wavesOf(FF, "ln", "").filter((w) => w[ck] != null));
      check(!off, `desktop ${tag} ${CONAME[ck]}: diamonds sit at their MRPs' true midpoints${off ? "" : ""}`);
    }
    const e = FF.elec2025;
    if (cam.q === "co" && e) {
      check(f.erings.length === 3, `desktop ${tag}: three election rings, one per cohort (${f.erings.length})`);
      check(Math.abs(e.xm - (2025 * 12 + 4 + 2 / 31)) < 1e-3, `payload: the election rides 3 May 2025 on the month-index scale (xm ${e.xm})`);
      check(JSON.stringify(f.erings.map((g) => g.cls).sort()) === JSON.stringify(cam.cohorts.map((c) => CLS[c]).sort()),
        `desktop ${tag}: each ring takes its cohort's colour (${f.erings.map((g) => g.cls).join(",")})`);
      /* each ring joins its cohort's first wave dot with the primary chart's
         dotted lead-in */
      check(f.leads.length === 3 && f.leads.every((l) => {
        const ring = f.erings.find((g) => g.cls === l.cls), dot = f.dots[l.cls][0];
        const m = /^M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)$/.exec(l.d);
        return ring && dot && m && l.dash === "0.5 4" && Math.abs(+m[1] - ring.x) < 0.5 && Math.abs(+m[2] - ring.y) < 0.5
          && Math.abs(+m[3] - dot.x) < 0.5 && Math.abs(+m[4] - dot.y) < 0.5;
      }), `desktop ${tag}: three dotted lead-ins, ring to the cohort's first wave (${f.leads.length})`);
      const eVals = [["grn", e.grn], ["onp", e.onp], ["oth", e.oth]];
      check(f.erings.every((g) => Math.abs(g.x - tk.x(e.xm)) < 1.5),
        `desktop ${tag}: the rings sit at the election's true date x (${f.erings.map((g) => g.x.toFixed(1)).join(",")} vs ${tk.x(e.xm).toFixed(1)})`);
      check(JSON.stringify(f.erings.map((g) => Math.round(1000 * (bot - g.y) / (bot - 16)) / 10).sort((p, q) => p - q)) === JSON.stringify(eVals.map((p) => p[1]).sort((p, q) => p - q)),
        `desktop ${tag}: the rings vmap the election's flows (${eVals.map((p) => p[1]).join("/")})`);
      check(f.aria.includes("Open rings mark the 2025 election’s counted preferences: Greens " + e.grn + ", One Nation " + e.onp + ", Other " + e.oth + "."),
        `desktop ${tag}: the svg's spoken note carries the election result`);
    } else {
      check(f.erings.length === 0 && f.leads.length === 0, `desktop ${tag}: no election rings or lead-ins on the v-One-Nation chart (${f.erings.length})`);
      check(!f.aria.includes("Open rings"), `desktop ${tag}: no election note in the aria`);
    }
  }
}
{
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  const ariaOn = d.figs[FI.on].waveArias.filter((s) => s.startsWith("RedBridge/Accent, " + juneOn.win + ":"));
  const juneCoal = ariaOn.find((s) => s.includes("Coalition voters"));
  check(!!juneCoal && juneCoal.includes(`Coalition voters, Labor ${juneOn.coal}, One Nation ${100 - juneOn.coal}`) && juneCoal.includes("combines") && juneCoal.includes("CLP/LNP/Nat"),
    `desktop v-ON June: the Coalition dot's aria reads the combined-rows note (${JSON.stringify(juneCoal)})`);
  check(ariaOn.filter((s) => !s.includes("Coalition voters")).every((s) => !s.includes("combines")),
    "desktop v-ON June: the printed cohorts' arias stay plain");
  check(!d.figs[FI.co].arias.some((s) => s.includes("combines")),
    "desktop v-Coalition: no est note anywhere on the second chart (all cells printed)");
}
const viewH = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH === 236, `desktop: plot height 236 (${viewH})`);

// the titles tell all three cohorts' latest shares; tails ride the battery
check(d.h4s.length === 3 && d.h4s[0] === FFexp.titles[0],
  `desktop: v-Coalition title is the three-share line${FFexp.titles[0].includes(" — ") ? " + its one-cohort tail" : ""} (${JSON.stringify(d.h4s[0])})`);
check(d.h4s.length === 3 && d.h4s[1] === FFexp.titles[1],
  `desktop: v-ON title is the three-share line${FFexp.titles[1].includes(" — ") ? " + tail" : ""} (${JSON.stringify(d.h4s[1])})`);
check(d.h4s.length === 3 && d.h4s[2] === FFexp.titles[2],
  `desktop: Coalition-v-ON title is the DemosAU three-share line${FFexp.titles[2].includes(" — ") ? " + tail" : ""} (${JSON.stringify(d.h4s[2])})`);
// the trend-significance table's pressed set carries the same battery, nine rows
check(d.tsigHeads && JSON.stringify(d.tsigHeads) === JSON.stringify(["Series", "First → last", "Slope, pts/yr", "t", "Significant"]),
  `tsig heads fit gaps and shares (${JSON.stringify(d.tsigHeads)})`);
check(d.pressed && d.pressed.length === 9 && JSON.stringify(d.pressed.map((r) => r.name)) === JSON.stringify(FFexp.rows.map((r) => r.name)),
  `pressed set: nine rows, all three charts' cohorts in ffQ order (${JSON.stringify((d.pressed || []).map((r) => r.name))})`);
for (const [i, exp] of FFexp.rows.entries()) {
  const row = d.pressed && d.pressed[i];
  check(!!row && JSON.stringify(row.cells) === JSON.stringify(exp.cells),
    `pressed ${exp.name}: figures recomputed (${JSON.stringify(row && row.cells)} vs ${JSON.stringify(exp.cells)})`);
  check(!!row && row.yes === (exp.sig ? 1 : 0),
    `pressed ${exp.name}: Yes-wash iff the battery says Yes (${row && row.yes} yes-td on a ${exp.cells[3]})`);
}

// ---- the region select REKEYS the DemosAU marks, never recomputes --------
{
  const reg = "inner", regName = "Inner metro";
  await page.select('.rd-ff-head select.rd-pv-sel[aria-label="DemosAU MRP region"]', reg);
  await new Promise((r) => setTimeout(r, 300));
  const dr = await measure();
  const expIn = [expectFig(FF, "on", reg), expectFig(FF, "ln", reg)];
  const fExpIn = expectedForced(FF, reg);
  check(dr.sel && dr.sel.value === reg, `region menu: the select reads ${regName}`);
  /* RedBridge's own pair are untouched: identical wave dots as before */
  check(JSON.stringify(dr.figs[1].lines) === JSON.stringify(d.figs[1].lines)
      && JSON.stringify(dr.figs[0].dots) === JSON.stringify(d.figs[0].dots),
    `region menu: RedBridge's lines and the Coalition chart stay national as printed`);
  /* DemosAU's diamonds re-key to the region's printed cells on BOTH the
     v-ON chart's extras and the third chart; the co chart's national
     diamonds stand */
  const ln = dr.figs[2], on = dr.figs[1], bot2 = 236 - 34;
  for (const ck of CHARTS[2].cohorts) {
    const got = ln.dmPts[CLS[ck]].map((p) => Math.round(1000 * (bot2 - p.y) / (bot2 - 16)) / 10);
    const want = expIn[1].dms[CLS[ck]].map((v) => Math.round(10 * v) / 10);
    check(JSON.stringify(got) === JSON.stringify(want),
      `region menu Coalition-v-ON ${CONAME[ck]}: diamonds now read the printed ${regName} cells (${JSON.stringify(got)})`);
  }
  for (const ck of CHARTS[1].cohorts) {
    const got = on.dmPts[CLS[ck]].map((p) => Math.round(1000 * (bot2 - p.y) / (bot2 - 16)) / 10);
    const want = expIn[0].dms[CLS[ck]].map((v) => Math.round(10 * v) / 10);
    check(JSON.stringify(got) === JSON.stringify(want),
      `region menu v-ON ${CONAME[ck]}: diamonds now read the printed ${regName} cells (${JSON.stringify(got)})`);
  }
  check(JSON.stringify(dr.figs[0].dmPts) === JSON.stringify(d.figs[0].dmPts),
    "region menu: the Coalition chart's one national DemosAU diamond set is untouched");
  /* our-weighting wording leaves the MRP arias on a named region - those
     are the report's printed cells now */
  check(ln.arias.filter((s) => s.startsWith("DemosAU MRP, ")).every((s) => !s.includes("our weighting")),
    `region menu Coalition-v-ON: no our-weighting flag on ${regName} (printed cells)`);
  /* the third chart's title and the battery recompute on the region's
     cells; the RedBridge pair's rows stand */
  check(dr.h4s.length === 3 && dr.h4s[2] === fExpIn.titles[2],
    `region menu: the third chart's title follows the printed ${regName} cells (${JSON.stringify(dr.h4s[2])})`);
  check(dr.h4s[0] === d.h4s[0] && dr.h4s[1] === d.h4s[1],
    "region menu: the RedBridge pair's titles stand (national as printed)");
  check(dr.pressed && dr.pressed.length === 9
      && JSON.stringify(dr.pressed.map((r) => r.cells)) === JSON.stringify(fExpIn.rows.map((r) => r.cells)),
    `region menu: the pressed rows follow the printed ${regName} cells (${JSON.stringify((dr.pressed || []).map((r) => r.cells[0]))})`);
  await page.select('.rd-ff-head select.rd-pv-sel[aria-label="DemosAU MRP region"]', "");
  await new Promise((r) => setTimeout(r, 300));
  const dBack = await measure();
  check(JSON.stringify(dBack.figs[2].dmPts) === JSON.stringify(d.figs[2].dmPts) && dBack.sel && dBack.sel.value === "",
    "region menu: All voters restores our weighting of the regional tables");
}

/* hover/click helpers: find one cohort's hit on one figure by its aria
   prefix (ym) and cohort phrase — the canvas is shared, so every pick
   scrolls first, then re-measures the centre */
const hitAt = async (fi, ym, co) => {
  const sel = (fi, ym, co) => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][fi];
    return [...fig.querySelectorAll("circle.rd-apd-hit")].find((h) => {
      const a = h.getAttribute("aria-label") || "";
      return a.startsWith(ym + ":") && a.includes(": " + co + " voters");
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
    sub: (t.querySelector(".rd-ff-tipsub .tip-label") || {}).textContent || null,
    on: (t.querySelector(".tip-row.on .tip-label") || {}).textContent || null,
    sw: [...t.querySelectorAll(".tip-row .rd-ff-sw")].map((x) => x.getAttribute("class").replace("tip-swatch rd-ff-sw ", "")),
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

// tips: every mark tips through the one card - the group's title (house +
// window, or the election), a sub naming the question, then every cohort's
// Labor share at that date with a swatch in the mark's shape, the hovered
// cohort's row picked out
const lastOn = FF.vsOn[FF.vsOn.length - 1], lastCo = FF.vsCoal[FF.vsCoal.length - 1];
const lastOnWin = lastOn.win;
const RB = (win) => "RedBridge/Accent, " + win;
{
  const tip = await hover(FI.on, RB(lastOnWin), "Coalition");
  check(!!tip && tip.title === RB(lastOnWin), `v-ON ${lastOnWin} coal hover: tip titled "RedBridge/Accent, <window>" (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.sub === "Would pick Labor over One Nation", `v-ON tip: the question as its sub (${JSON.stringify(tip && tip.sub)})`);
  check(tip && JSON.stringify(tip.rows.filter((r) => r.endsWith(" voters"))) === JSON.stringify(["Greens voters", "Coalition voters", "Other voters"])
      && tip.vals.includes(`${lastOn.coal}%`) && tip.vals.includes(`${lastOn.grn}%`) && tip.vals.includes(`${lastOn.oth}%`),
    `v-ON tip: every cohort's share at the wave (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.on === "Coalition voters", `v-ON tip: the hovered cohort's row is picked out (${JSON.stringify(tip && tip.on)})`);
  check(tip && tip.sw.every((x) => x.startsWith("wave ")), `v-ON tip: dot swatches for a wave (${JSON.stringify(tip && tip.sw)})`);
  check(tip && tip.rows.includes("Sample") && tip.vals.includes(`n = ${lastOn.n.toLocaleString()}`), `v-ON tip: sample row ${lastOn.n}`);
  check(tip && tip.hint === "Click to open this poll in All polls", `v-ON tip: the standard open-poll hint (${JSON.stringify(tip && tip.hint)})`);
  check(tip && tip.link === false, "v-ON tip: no wave-report link in the tip (it lives in the opened poll's ledger)");
  check(tip && tip.est.length === 0 && tip.wrap === 0, "v-ON tip: no est note on a printed wave");
}
// the June est note rides the v-ON chart's June wave alone
{
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  const tipJ = await hover(FI.on, RB(juneOn.win), "Greens");
  check(!!tipJ && tipJ.est.length === 1 && tipJ.est[0].includes("CLP/LNP/Nat (34)") && tipJ.est[0].includes("Liberal (37)"),
    `v-ON June tip: the combined-rows note rides the June wave (${JSON.stringify(tipJ && tipJ.est)})`);
  check(tipJ && tipJ.hint === "Click to open this poll in All polls", `v-ON June tip: the open-poll hint beside the est note (${JSON.stringify(tipJ && tipJ.hint)})`);
  check(tipJ && tipJ.wrap === 1, `v-ON June tip: only the est note is a wrapped row (${tipJ && tipJ.wrap})`);
  check(tipJ && tipJ.vals.includes(`${juneOn.coal}%`), `v-ON June tip: the derived 36 (read ${JSON.stringify(tipJ && tipJ.vals)})`);
}
// the v-Coalition chart's tips name the Coalition as the rival
{
  const tip = await hover(FI.co, RB(lastCo.win), "Greens");
  check(!!tip && tip.title === RB(lastCo.win) && tip.sub === "Would pick Labor over the Coalition",
    `v-Coalition ${lastCo.win} Greens hover: title + question (${JSON.stringify(tip && [tip.title, tip.sub])})`);
  check(tip && tip.vals.includes(`${lastCo.grn}%`) && tip.vals.includes(`${lastCo.onp}%`), `v-Coalition tip: ${lastCo.grn} / ${lastCo.onp}`);
}
// the election rings tip like the primary chart's: ring swatches, no open hint
{
  const e = FF.elec2025;
  const tip = await hover(FI.co, "2025 election, " + e.win, "One Nation");
  check(!!tip && tip.title === "2025 election, " + e.win && tip.sub === "Preferences counted reaching Labor over the Coalition",
    `election ring hover: tip names the election (${JSON.stringify(tip && [tip.title, tip.sub])})`);
  check(tip && [e.grn, e.onp, e.oth].every((v) => tip.vals.includes(v + "%")) && tip.sw.every((x) => x.startsWith("elec ")) && tip.on === "One Nation voters",
    `election ring tip: the three counted flows, ring swatches, hovered row picked (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.hint === null, "election ring tip: no open hint (the election has no poll row)");
}
// DemosAU diamonds tip too, on all three charts, and open their MRP's row
for (const c of CHARTS) {
  const mrp = c.q === "ln" ? wavesOf(FF, "ln", "") : extOf(FF, c.q, "");
  if (!mrp.length) continue;
  const dd = mrp[mrp.length - 1], ck = c.cohorts.find((k) => dd[k] != null);
  const tip = await hover(FI[c.q], "DemosAU MRP, " + dd.win, CONAME[ck]);
  check(!!tip && tip.title === "DemosAU MRP, " + dd.win && tip.vals.includes(dd[ck] + "%") && tip.sw.every((x) => x.startsWith("mrp ")),
    `${c.q} DemosAU diamond hover: titled by its window, diamond swatches, ${CONAME[ck]} ${dd[ck]}% (${JSON.stringify(tip && [tip.title, tip.vals])})`);
  check(tip && tip.sub === "Would pick " + c.anchor + " over " + c.rival + (dd.wt ? " (all regions: our weighting)" : ""),
    `${c.q} DemosAU tip: the question, flagged where it's our weighting (${JSON.stringify(tip && tip.sub)})`);
  check(tip && tip.hint === "Click to open this poll in All polls", `${c.q} DemosAU tip: opens its MRP's row (${JSON.stringify(tip && tip.hint)})`);
  if (c.q === "ln") {
    check(tip && tip.on === CONAME[ck] + " voters" && tip.rows.filter((r) => r.endsWith(" voters")).length === 3,
      `ln DemosAU tip: the hovered row picked out of the three cohorts (${JSON.stringify(tip && tip.rows)})`);
    check(dd.n == null || (!!tip && tip.rows.includes("Sample") && tip.vals.includes(`n = ${dd.n.toLocaleString()}`)), `ln DemosAU tip: sample row ${dd.n}`);
  }
}

/* the drawer's forced splits ride an Also-in-this-poll Preferences line
   (RdLgFlowsLine): this reader maps the line into {lead, head, groups,
   tails}. puppeteer evaluates only its first argument as a function —
   install the reader on the page and call it through the window from here
   on */
const PREFS_READ = (det) => {
  const line = det.querySelector(".rd-ldg-line.flows");
  if (!line) return null;
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
  const groups = {};
  for (const g of line.querySelectorAll(".rd-ldg-grp")) {
    const t = txt(g.querySelector(".rd-ldg-li.lbl"));
    groups[t] = Object.fromEntries([...g.querySelectorAll(".rd-ldg-li:not(.lbl)")].map((li) => {
      const em = li.querySelector("em"), b = li.querySelector("b");
      return em && b ? [em.textContent.trim(), Number(b.textContent.trim())] : null;
    }).filter(Boolean));
  }
  return { lead: txt(line.querySelector(".rd-ldg-lab")),
           head: txt(line.querySelector(".rd-ldg-lbody > .rd-ldg-li.lbl")),
           groups,
           tails: [...line.querySelectorAll(".rd-ldg-lbody > .rd-ldg-li:not(.lbl)")].map(txt) };
};
await page.evaluate((src) => { window.__prefsRead = (0, eval)("(" + src + ")"); }, PREFS_READ.toString());
/* the line's figures keyed by its short party tags, recomputed against the
   payload below — never trusted from the page */
const GLAB = { coal: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const grpHas = (prefs, title, want) => {
  const g = prefs && prefs.groups && prefs.groups[title];
  return !!g && Object.entries(want).every(([k, v]) => v == null || g[GLAB[k]] === v);
};

// click the latest v-ON Coalition dot with a real mouse: the wave opens in
// All polls, named by the return button, and the wave's forced-choice
// figures sit in its Also-in-this-poll Preferences line
{
  const c = await hitAt(FI.on, RB(lastOnWin), "Coalition");
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
      const tpp = det.querySelector(".rd-ldg-tpp");
      const back = [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).find((t) => t.startsWith("Back to "));
      return { head, back: back || null,
               prefs: window.__prefsRead(det),
               subRows: det.querySelectorAll(".rd-ldg-tpp tr.sub").length,
               forcedLeft: !!tpp && /forced to choose/i.test(tpp.textContent) };
    });
  } catch (e) { /* land stays null */ }
  check(!!land && land.head === "RedBridge/Accent",
    `click ${lastOnWin} coal dot: the wave's poll row opens in All polls (${JSON.stringify(land && land.head)})`);
  check(!!land && land.back === "Back to the forced-choice flow chart",
    `…the return button names the forced-choice chart (${JSON.stringify(land && land.back)})`);
  /* the forced rows left the drawer two-party table entirely */
  check(!!land && land.subRows === 0 && land.forcedLeft === false,
    `ledger: no forced rows left in the two-party table (${land && JSON.stringify([land.subRows, land.forcedLeft])})`);
  check(!!land && land.prefs && land.prefs.lead === "Preferences" && land.prefs.head === "If forced to choose",
    `ledger: the "If forced to choose" Preferences line leads the figures (${JSON.stringify(land && land.prefs)})`);
  /* every figure recomputed from the payload: each cohort's printed Labor
     share on the wave's one question group, never trusted from the page */
  check(!!land && grpHas(land.prefs, "to ALP v ON", { coal: lastOn.coal, grn: lastOn.grn, oth: lastOn.oth }),
    `ledger: ALP-v-One-Nation group — Coalition ${lastOn.coal}, Greens ${lastOn.grn}, Other ${lastOn.oth} (${JSON.stringify(land && land.prefs && land.prefs.groups["to ALP v ON"])})`);
  check(!!land && grpHas(land.prefs, "to ALP v L/NP", { grn: lastCo.grn, onp: lastCo.onp, oth: lastCo.oth }),
    `ledger: ALP-v-Coalition group — Greens ${lastCo.grn}, One Nation ${lastCo.onp}, Other ${lastCo.oth} (${JSON.stringify(land && land.prefs && land.prefs.groups["to ALP v L/NP"])})`);
  check(!!land && land.prefs && land.prefs.tails.every((t) => !/combined row was printed/.test(t)),
    `ledger: no combined-rows tail on a printed wave (${JSON.stringify(land && land.prefs && land.prefs.tails)})`);
}

// the June wave's drawer rides the combined-rows note as its Preferences
// line's tail (the wave's Coalition split is the dataset's one derived cell)
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
      return { prefs: window.__prefsRead(det),
               subRows: det.querySelectorAll(".rd-ldg-tpp tr.sub").length };
    });
  } catch (e) { /* jun stays null */ }
  check(!!jun && jun.prefs && jun.subRows === 0 && jun.prefs.head === "If forced to choose",
    `June wave drawer: the splits ride the Preferences line, not the table (${JSON.stringify(jun && jun.prefs && jun.prefs.head)})`);
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  check(!!jun && grpHas(jun.prefs, "to ALP v ON", { coal: juneOn.coal }),
    `June wave drawer: the derived Coalition split ${juneOn.coal} sits in the ALP-v-One-Nation group (${JSON.stringify(jun && jun.prefs && jun.prefs.groups["to ALP v ON"])})`);
  check(!!jun && jun.prefs && jun.prefs.tails.some((t) => /combined row was printed/.test(t) && /CLP\/LNP\/Nat/.test(t)),
    `June wave drawer: the combined-rows note is the Preferences line's tail (${JSON.stringify(jun && jun.prefs && jun.prefs.tails)})`);
}

// ---------------- phone rung ------------------------------------------------
await gotoFlows(390);
const m = await measure();
check(m.nFig === 3, `phone: three figures (${m.nFig})`);
check(!!m.sel && m.sel.value === "", `phone: the region select rides the head, still on All voters`);
{
  const [a, b, c] = m.figs;
  check(m.figs.every((f) => Math.abs(f.w - m.secW) <= 2), `phone: all three charts fill the section width (${m.figs.map((f) => f.w).join("/")} of ${m.secW}px)`);
  check(b.top > a.top + a.h - 1 && c.top > b.top + b.h - 1, `phone: the trio stacks (${a.top}, ${b.top}, ${c.top})`);
  check(Math.abs(a.top - b.top) > 40 && Math.abs(b.top - c.top) > 40, `phone: real vertical stride between charts (${b.top - a.top}, ${c.top - b.top})`);
  check(m.sw <= m.iw + 1, `phone: no horizontal overflow (sw ${m.sw} vs iw ${m.iw})`);
  check(c.inLn, "phone: the third chart rows through .rd-ff-ln on the phone too");
  for (const [i, f] of [a, b, c].entries()) {
    const cam = CHARTS[i], tag = cam.q === "on" ? "v-ON" : cam.q === "co" ? "v-Coalition" : "Coalition-v-ON";
    check(f.lines.length === (cam.q === "ln" ? 0 : 3), `phone ${tag}: ${cam.q === "ln" ? "no lines - all diamonds" : "three cohort lines"} (${f.lines.length})`);
    check(f.nHits === EXP[i].nHits, `phone ${tag}: ${EXP[i].nHits} hit circles, one per cohort mark (${f.nHits})`);
    check(JSON.stringify(f.els) === JSON.stringify(cam.cohorts.map((x) => CONAME[x])),
      `phone ${tag}: same three cohort end labels (${f.els.join(" · ")})`);
  }
}
check(m.h4s.length === 3 && m.h4s[0] === FFexp.titles[0] && m.h4s[1] === FFexp.titles[1] && m.h4s[2] === FFexp.titles[2],
  `phone: same dynamic titles as desktop (${JSON.stringify(m.h4s)})`);
const viewH2 = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH2 === 200, `phone: plot height 200 (${viewH2})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "rd-forced-charts: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);

