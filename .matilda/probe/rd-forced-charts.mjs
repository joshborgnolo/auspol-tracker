/* headless geometry probe of the RdForced "forced to choose" trio in the
   All-polls Preference flows section — the four-mark-kinds contract of
   2026-10-13. Renderers source + facts pinned by .build/test-flow-splits.mjs;
   this probe asserts GEOMETRY and interaction, never screenshots
   (auspol-headless-geometry-verify):
     - RedBridge/Accent's waves ride as DOTS (r=3) and JOIN their cohort's
       line — the monthly spine of each chart;
     - DemosAU's MRP readings ride as hollow TRIANGLES (.rd-ff-tr) and join
       the SAME lines (user 2026-10-13: "the MRP readings behave like the
       RedBridge dots, just differently shaped" — so a cohort's line runs
       through both houses' marks in date order; the probe verifies every
       line path threads its triangles as well as its dots);
     - the 2025 election's rings ride elec2025r carriers: the NATIONAL
       all, typed from the estimate's own FLOW constants (the AEC's TPP
       flow cut — every formal ballot redistributed ALP v Coalition),
       plus the three seat-classification replays (inner/outer/regional —
       this site's per-seat DoP replay of the classic seats,
       .build/aec-2025-region-tpp-flows.mjs; scoped and flagged der on
       every consumer). Each ring is a one-cohort open ring at 3 May 2025;
       on All voters it joins the first wave by its dotted lead-in;
     - the 2026 state/by-election counts ride as CROSSES (.rd-ff-x) on the
       Labor-v-One-Nation chart only, on their own election days, joined to
       NO line; on a named region they vanish (national counts); SA 2026
       (Bonham estimates), Secret Harbour's early-voting-centre count.
       Farrer's two crosses are GONE (user 2026-10-13: its counts measured
       independent national contests, not One Nation voters);
     - the region menu (All voters / Inner metro / Outer metro / Regional)
       rekeys the DemosAU regional figures, and DROPS every national mark —
       RedBridge/Accent's waves AND DemosAU's one national MRP table — from
       EVERY chart (a national wave can't speak to a named region; user
       2026-10-13, the day's third call on it: "in the regions view in the
       Labor-v-Coalition preference flows chart, there should be no
       RedBridge/Accent polls… It's just DemosAU, ALP, One Nation"). On a
       named region the v-Coalition chart draws its three election rings
       alone, rekeyed to that class's seat replay; All voters keeps its
       national waves, triangles, rings and lead-ins;
     - the third chart's title paints Coalition in coalition blue and One
       Nation orange (probe asserts the two spans carry the party text-vars
       via getComputedStyle, not a hard-coded colour);
     - tips carry every cohort's share with the mark's own swatch shape;
       arias read "… voters, preferences to Labor N, Coalition M" for the
       counted kinds and use the wave's printed lbl (SA's Coalition row
       says "Liberal voters", its Other row "Independent voters").
   The battery (pressed-choice rows of the trend-significance table) is
   recomputed here from window.AUSPOL.flowForced, never trusted from the
   page. x-anchoring is the fleet recipe: derive an empirical month-index →
   x map from each figure's printed tick labels and demand every mark sit
   at its own payload xm through that map (1.5px tolerance).
*/
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.join(ROOT, "index.html");
const APAGE = PAGE.endsWith("/") ? PAGE + "allpolls/" : PAGE.replace(/index\.html$/, "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const CONAME = { grn: "Greens", coal: "Coalition", onp: "One Nation", oth: "Other", alp: "Labor" };
const PROSE = { grn: "Greens", coal: "Coalition", onp: "One Nation", oth: "other", alp: "Labor" };
const CLS = { grn: "grn", coal: "lnp", onp: "onp", oth: "oth", alp: "alp" };
/* page order: Labor v Coalition left, Labor v One Nation right, Coalition
   v One Nation below. hasWaves = RedBridge's dots join; hasExtras =
   DemosAU's all-voters mental carriers extend the spine; hasBys = crosses */
const CHARTS = [
  { q: "co", cohorts: ["grn", "onp", "oth"], anchor: "Labor", rival: "the Coalition", vsKey: "vsCoal", extKey: "demos", elec: true, bys: false },
  { q: "on", cohorts: ["grn", "coal", "oth"], anchor: "Labor", rival: "One Nation", vsKey: "vsOn", extKey: "demosOn", elec: false, bys: true },
  { q: "ln", cohorts: ["alp", "grn", "oth"], anchor: "the Coalition", rival: "One Nation", vsKey: null, extKey: null, elec: false, bys: false },
];
const FI = { co: 0, on: 1, ln: 2 };
const FF_DEFS = [CHARTS[1], CHARTS[0], CHARTS[2]];
const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];
const FF_MRP_HOUSE = "DemosAU (MRP)";

/* the region rekey, mirrored from the renderer */
const rekeyMrp = (ws, reg) => (ws || []).map((w) => {
  if (!reg) return { ...w, ...w.all, wt: true };
  const t = w[reg];
  return t ? { ...w, ...t, wt: undefined } : null;
}).filter(Boolean);
/* a chart's LINE-CARRYING waves at a region: a mixed list is just merged by
   date in the renderer — mirror it here. RedBridge drops out on a region. */
const wavesOf = (FF, q, reg) => (q === "ln" ? rekeyMrp(FF.lnpOn, reg) : reg ? [] : FF[CHARTS[FI[q]].vsKey]);
const extOf = (FF, q, reg) => (q === "co" ? (reg ? [] : FF.demos || []) : q === "on" ? rekeyMrp(FF.demosOn, reg) : []);
const bysOf = (FF, q, reg) => (q === "on" && !reg ? FF.bys || [] : []);
const elecOf = (FF, q, reg) => (q === "co" && FF.elec2025r ? [FF.elec2025r[reg] || FF.elec2025r.all] : []);
const isMrp = (w) => w.house === FF_MRP_HOUSE;

/* the pressed-choice battery, recomputed independently of the page */
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
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monY = (ym) => { const [y, m] = ym.split("-").map(Number); return MON[m - 1] + " " + y; };
function lineFit(pts) {
  const n = pts.length, df = n - 2;
  if (df < 3) return null;
  const tb = pts.reduce((a, p) => a + p.x, 0) / n, yb = pts.reduce((a, p) => a + p.v, 0) / n;
  const dm = pts.map((p) => ({ dt: p.x - tb, dy: p.v - yb }));
  const sxx = dm.reduce((a, p) => a + p.dt * p.dt, 0);
  if (!(sxx > 0)) return null;
  const b = dm.reduce((a, p) => a + p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  return { b, t: se > 0 ? b / se : 0, p: se > 0 ? tTail(b / se, df) : 1 };
}
function expectedForced(FF, reg) {
  /* mirror the renderer's ffQ exactly: the pair's battery rides its own
     RedBridge series (waves, never extras; never region-gated — titles
     stand while the chart's lines move), the third chart's rides the MRP
     carriers rekeyed on the region select */
  const battOf = (q) => {
    if (q === "ln") return rekeyMrp(FF.lnpOn, reg);
    return FF[CHARTS[FI[q]].vsKey];
  };
  const rows = FF_DEFS.flatMap((c) => c.cohorts.map((ck) => {
    const ws = battOf(c.q).filter((w) => w[ck] != null);
    return { key: c.q + ck, ck, q: c.q, waves: ws,
             fit: lineFit(ws.map((w) => ({ x: w.xm / 12, v: w[ck] }))) };
  }));
  const tested = rows.filter((r) => r.fit), sigK = [];
  for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (r.fit.p >= 0.05 / (tested.length - i)) break;
    sigK.push(r.key);
  }
  for (const r of rows) r.sig = sigK.includes(r.key);
  const title = (c) => {
    const ws = battOf(c.q);
    const parts = c.cohorts.map((ck) => `${[...ws].reverse().find((x) => x[ck] != null)[ck]}% of ${PROSE[ck]} voters`);
    const list = parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
    const moved = rows.filter((r) => r.q === c.q && r.sig && r.waves[0][r.ck] !== r.waves[r.waves.length - 1][r.ck]);
    const tail = moved.length !== 1 ? "" : (() => {
      const r = moved[0], f = r.waves[0][r.ck], la = r.waves[r.waves.length - 1][r.ck];
      return " — " + PROSE[r.ck] + " voters " + (la > f ? "up" : "down") + " from " + f + "% in " + monY(r.waves[0].ym);
    })();
    return list + " prefer " + c.anchor + " over " + c.rival + tail;
  };
  const cells = (r) => [r.waves[0][r.ck] + " → " + r.waves[r.waves.length - 1][r.ck],
    r.fit ? rdTsSgn1(r.fit.b, true) : "–", r.fit ? rdTsSgn1(r.fit.t) : "–",
    r.fit ? (r.sig ? "Yes" : "No") : "–"];
  const name = (r) => CONAME[r.ck] + " voters, " + (r.q === "co" ? "v Coalition" : "v One Nation");
  return { titles: CHARTS.map(title),
           rows: rows.map((r) => ({ name: name(r), cells: cells(r), sig: r.sig })) };
}
const rdTsSgn1 = (v, signed) => (v < 0 ? "−" : signed && v > 0 ? "+" : "") + Math.abs(v).toFixed(1);

/* the empirical month-index → x map from a figure's printed tick labels */
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
  return { x: (xm) => x1 + (xm - m1) * per, per };
};
const fmtMax = (got, want) => got.length ? Math.max(...got.map((x, k) => Math.abs(x - want[k]))).toFixed(2) : "–";

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

/* mark geometry: where a dot/triangle/cross's CENTRE is in its own drawing
   coords after we parse the leading Move of its path (or cx/cy on a dot).
   Triangle draws APEX first (M x y-5.4 …): centre y = apex + 5.4.
   Cross draws top-left first (M x-4.2 y-4.2 …): centre = parsed + 4.2. */
const TRAY = 5.4, XRAY = 4.2;

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
    const dots = {}, tris = {}, xs = {};
    for (const cls of ["grn", "lnp", "onp", "oth", "alp"]) {
      dots[cls] = [...fig.querySelectorAll(".rd-ff-dot." + cls)].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
      tris[cls] = [...fig.querySelectorAll("path.rd-ff-tr." + cls)].map((p) => {
        const m = /^M([\d.]+) ([\d.]+)/.exec(p.getAttribute("d"));
        return m ? { x: +m[1], y: +m[2] + 5.4 } : null;      /* apex → datum */
      }).filter(Boolean);
      xs[cls] = [...fig.querySelectorAll("path.rd-ff-x." + cls)].map((p) => {
        const m = /^M([\d.]+) ([\d.]+)/.exec(p.getAttribute("d"));
        return m ? { x: +m[1] + 4.2, y: +m[2] + 4.2 } : null; /* top-left → datum */
      }).filter(Boolean);
    }
    const hits = [...fig.querySelectorAll("circle.rd-apd-hit")];
    out.figs.push({
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top),
      W: +svg.getAttribute("width"),
      aria: svg.getAttribute("aria-label") || "",
      ticks: [...fig.querySelectorAll("text.rd-dis-ax")].map((t) => ({ s: t.textContent.trim(), x: +t.getAttribute("x") })).filter((l) => /^[A-Z]/.test(l.s)),
      q: fig.dataset.q, inLn: !!fig.closest(".rd-ff-ln"),
      erings: [...fig.querySelectorAll("circle.rd-ring")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy"),
               cls: c.getAttribute("class").replace("rd-ring rd-ff-ring ", "") })),
      leads: [...fig.querySelectorAll("path.rd-ff-lead")].map((p) => ({ cls: p.getAttribute("class").replace("rd-ff-lead ", ""),
               d: p.getAttribute("d"), dash: p.getAttribute("stroke-dasharray") })),
      nTr: fig.querySelectorAll("path.rd-ff-tr").length,
      nX: fig.querySelectorAll("path.rd-ff-x").length,
      tris, xs,
      waveArias: hits.filter((h) => h.classList.contains("wave")).map((h) => h.getAttribute("aria-label") || ""),
      mrpArias: hits.filter((h) => h.classList.contains("mrp")).map((h) => h.getAttribute("aria-label") || ""),
      xArias: hits.filter((h) => h.classList.contains("byelec")).map((h) => h.getAttribute("aria-label") || ""),
      elecArias: hits.filter((h) => h.classList.contains("elec")).map((h) => h.getAttribute("aria-label") || ""),
      namedSpans: (() => {
        const el = fig.closest(".rd-fl-one") && fig.closest(".rd-fl-one").querySelectorAll(".rd-fl-name span");
        if (!el || !el.length) return null;
        return [...el].map((s) => ({ cls: s.getAttribute("class"), txt: s.textContent,
                 colour: getComputedStyle(s).color }));
      })(),
      lines, dots,
      nHits: hits.length,
      tabbable: hits.filter((h) => h.getAttribute("tabindex") === "0").length,
      nButtons: hits.filter((h) => h.getAttribute("role") === "button").length,
      contest: (fig.closest(".rd-fl-one").querySelector(".rd-fl-name") || {}).textContent || null,
      arias: hits.map((h) => h.getAttribute("aria-label") || ""),
      gls: fig.querySelectorAll(".rd-ff-gl").length,
      els: [...fig.querySelectorAll(".rd-ff-el")].map((t) => t.textContent),
      elxs: [...fig.querySelectorAll(".rd-ff-el")].map((t) => +t.getAttribute("x")),
      elys: [...fig.querySelectorAll(".rd-ff-el")].map((t) => +t.getAttribute("y")),
      elvs: [...fig.querySelectorAll(".rd-ff-elv")].map((t) => t.textContent),
      emptyNote: (fig.querySelector(".rd-fl-empty") || {}).textContent || null,
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
  /* the Labor-v-Coalition chart draws on every menu view now (user
     2026-10-13 reversal) — the old stand-in paragraph is gone; kept as a
     null pin so the stand-in can't quietly return */
  out.emptyCell = (sec.querySelector(".rd-fl-emptycell") || {}).textContent || null;
  /* the Flows table is NO FOLD (user 2026-10-13, hours after shipping the
     <details> form: "take it out of that dropdown view and remove that
     dropdown view... just always display the tables above the charts") -
     an always-visible .rd-ft block directly under the forced-choice head,
     above the three charts. The trend-significance battery is the
     section's only fold left */
  const dets = [...sec.querySelectorAll("details")];
  out.dets = dets.map((dt) => { const s = dt.querySelector("summary"); return s ? s.textContent.trim() : ""; });
  /* the forced block's direct children, as element-order tokens, so the
     mount order head → tables → chart pair → third chart → key is pinned */
  const ffc = sec.querySelector(".rd-ff");
  out.ffKids = ffc ? [...ffc.children].map((el) => {
    const has = (x) => el.classList && el.classList.contains(x);
    return has("rd-ff-head") ? "head" : has("rd-ft") ? "tables" : has("rd-fl-two") ? "pair"
      : has("rd-ff-ln") ? "ln" : has("rd-ckey") ? "key" : el.tagName.toLowerCase();
  }) : [];
  const bySummary = (want) => dets.find((dt) => (dt.querySelector("summary") || {}).textContent === want);
  const det = bySummary("Trend-significance table");
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
  const ftab = ffc ? ffc.querySelector(".rd-ft") : null;
  out.ftInDetails = !!(ftab && ftab.closest("details"));
  if (ftab) {
    /* .rd-ft anatomy: a view line, then one table per contest — caption
       (contest + the "Share … %" clause), a header row whose first th is
       the sr-only "Voters" corner (skipped), cohort rows down the side
       (th.rd-ft-sw + name), figures in the cells (nil = "–") */
    out.ftView = ((ftab.querySelector(".rd-ft-view") || {}).textContent || "").replace(/\s+/g, " ").trim() || null;
    out.ftTables = [...ftab.querySelectorAll("table.rd-ft-table")].map((tb) => ({
      caption: ((tb.querySelector("caption") || {}).textContent || "").replace(/\s+/g, " ").trim(),
      cols: [...tb.querySelectorAll("thead th")].slice(1).map((h) => h.textContent.replace(/\s+/g, " ").trim()),
      rows: [...tb.querySelectorAll("tbody tr")].map((tr) => ({
        name: ((tr.querySelector("th") || {}).textContent || "").trim(),
        cells: [...tr.querySelectorAll("td")].map((td) => td.textContent.replace(/\s+/g, " ").trim()),
      })),
    }));
    out.ftNote = ((ftab.querySelector(".rd-ft-note") || {}).textContent || "").replace(/\s+/g, " ").trim() || null;
  }
  /* the key row under the trio: line/triangle/cross/ring tokens in order */
  const key = [...sec.querySelectorAll(".rd-ff-key .rd-key-item")].map((k) => k.textContent.trim());
  out.keyItems = key;
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
check(!!FF && FF.house === "RedBridge/Accent" && Array.isArray(FF.vsOn) && Array.isArray(FF.lnpOn),
  `payload: D.flowForced carries the pair, the lnpOn carriers, and its house`);
check(!!FF && FF.elec2025r && Object.keys(FF.elec2025r).sort().join(",") === "all,inner,outer,regional" && FF.elec2025r.all.grn != null,
  `payload: elec2025r carries the national carrier plus the three seat-classification replays (${FF && FF.elec2025r ? Object.keys(FF.elec2025r).join("/") : "none"})`);
check(!!FF && FF.elec2025r && Math.abs(FF.elec2025r.all.grn - 88.19) < 1e-9 && Math.abs(FF.elec2025r.all.onp - 25.5) < 1e-9 && Math.abs(FF.elec2025r.all.oth - 54.55) < 1e-9,
  `payload: the national carrier rides the AEC's TPP flow cut — GRN 88.19 / ON 25.50 / IND+OTH 54.55 to Labor (${FF && FF.elec2025r ? [FF.elec2025r.all.grn, FF.elec2025r.all.onp, FF.elec2025r.all.oth].join("/") : "none"})`);
{
  const REPLAY = { inner: [86.41, 33.8, 55.68], outer: [79.32, 35.34, 52.46], regional: [76.9, 31.46, 49.01] };
  const ok = FF && Object.entries(REPLAY).every(([rk, want]) => {
    const r = FF.elec2025r[rk];
    return r && r.der === true && r.scopeTtl && r.scopeNote && [r.grn, r.onp, r.oth].every((v, i) => Math.abs(v - want[i]) < 1e-9);
  });
  check(!!ok, `payload: the region replacements ride the replay script's constants, flagged der with scope prose (${FF ? Object.entries(FF.elec2025r).filter(([k]) => k !== "all").map(([k, r]) => k + " " + r.grn + "/" + r.onp + "/" + r.oth).join("; ") : "none"})`);
}
check(!!FF && Array.isArray(FF.bys) && FF.bys.length === 2,
  `payload: two 2026-count crosses (${FF && (FF.bys || []).length})`);
check(!!FF && (FF.bys || []).every((b) => !/^farr/.test(b.key)),
  "payload: no Farrer cross survives (its counts measured independent contests)");
const lineWavesOfNat = (q) => {
  const ws = q === "ln" ? rekeyMrp(FF.lnpOn, "") : FF[CHARTS[FI[q]].vsKey];
  const ex = q === "ln" ? [] : extOf(FF, q, "");
  return q === "ln" ? ws : [...ws, ...ex].sort((a, b) => a.xm - b.xm);
};
const FFexpNat = FF ? expectedForced(FF, "") : null;
/* the site's own flow constants — the Flows table's second row per contest */
const FT = await page.evaluate(() => window.AUSPOL.flowTables || null);
check(!!FT && FT.lnp && FT.onp && FT.onBand, "payload: window.AUSPOL.flowTables carries the site's flow tables");

// ---------------- desktop rung: national ----------------------------------
await gotoFlows(1366);
const d = await measure();
check(d.nFig === 3, `desktop: three forced-choice figures (${d.nFig})`);
check(d.h3 === "What voters say they’d do with their preferences", `desktop: the section head (${JSON.stringify(d.h3)})`);
check(d.ffDeK, "desktop: the dek rides the section head");
check(JSON.stringify(d.figs.map((f) => f.q)) === '["co","on","ln"]',
  `desktop: page order co / on / ln (${d.figs.map((f) => f.q).join(" | ")})`);
check(d.emptyCell == null, "desktop: no national-only empty cell at national");
check(d.figs[0].contest === "Labor v Coalition" && d.figs[1].contest === "Labor v One Nation" && d.figs[2].contest === "Coalition v One Nation",
  `desktop: contest spans name the three charts (${d.figs.map((f) => f.contest).join(" | ")})`);
check(!!d.sel && d.sel.aria === "DemosAU MRP region" && d.sel.value === "",
  `desktop: the region select rides the head, open on All voters (${d.sel && d.sel.aria})`);
check(d.sel && JSON.stringify(d.sel.options) === JSON.stringify(FF_REGIONS),
  `desktop: options All voters / Inner metro / Outer metro / Regional`);
check(JSON.stringify(d.figs[0].ticks) === JSON.stringify(d.figs[1].ticks) && JSON.stringify(d.figs[0].ticks) === JSON.stringify(d.figs[2].ticks),
  "desktop: all three charts share one month axis");

/* the third chart's name is two party-inked spans; assert they carry their
   text-var colours via getComputedStyle — never a hard-coded hex */
{
  const ns = d.figs[2].namedSpans;
  check(!!ns && ns.length === 2 && ns[0].cls === "rd-fl-xb" && ns[1].cls === "rd-fl-xo",
    `desktop Coalition-v-ON: two inked spans rd-fl-xb / rd-fl-xo (${ns && ns.map((s) => s.cls).join(",")})`);
  const want = await page.evaluate(() => ({
    b: getComputedStyle(document.querySelector(".rd-fl-xb")).color,
    o: getComputedStyle(document.querySelector(".rd-fl-xo")).color,
    /* the benchmark consumers of the same vars: the upper pair's
       contest spans paint lnp/onp via .rd-fl-name.{lnp,onp} */
    lnpC: getComputedStyle(document.querySelectorAll(".rd-fl-name.lnp")[0]).color,
    onpC: getComputedStyle(document.querySelectorAll(".rd-fl-name.onp")[0]).color,
    base: getComputedStyle(document.querySelector(".rd-fl-ct h4")).color,
  }));
  check(want.b === want.lnpC && want.o === want.onpC,
    `desktop Coalition-v-ON: Coalition paints the Coalition blue, One Nation the One Nation orange (${want.b} / ${want.o})`);
  check(want.b !== want.o, "desktop Coalition-v-ON: the two inks differ from each other");
  check(want.b !== want.base && want.o !== want.base,
    "desktop Coalition-v-ON: both spans break from the title's inherited ink");
}

/* the lines: every chart now draws lines through BOTH houses' marks */
for (const [i, f] of d.figs.entries()) {
  const cam = CHARTS[i];
  const tag = cam.q === "on" ? "v-ON" : cam.q === "co" ? "v-Coalition" : "Coalition-v-ON";
  const lineWaves = lineWavesOfNat(cam.q);
  check(f.lines.length === 3,
    `desktop ${tag}: three cohort lines (MRP marks join) — found ${f.lines.length}`);
  check(JSON.stringify(f.lines.map((l) => l.cls).sort()) === JSON.stringify(cam.cohorts.map((c) => CLS[c]).sort()),
    `desktop ${tag}: line classes are the party hues ${cam.cohorts.map((c) => CLS[c]).join("/")}`);
  /* per cohort: dot count = RedBridge's, triangle count = the MRP's (the
     co chart has all-voters DemosAU extras; ln is all-triangle) */
  const rbk = wavesOf(FF, cam.q, ""), mrk = cam.q === "ln" ? lineWaves : extOf(FF, cam.q, "");
  for (const ck of cam.cohorts) {
    const cls = CLS[ck];
    const wantDots = cam.q === "ln" ? 0 : rbk.filter((w) => w[ck] != null).length;
    const wantTris = cam.q === "ln" ? mrk.filter((w) => w[ck] != null).length : mrk.filter((w) => w[ck] != null).length;
    check(f.dots[cls].length === wantDots,
      `desktop ${tag} ${CONAME[ck]}: ${wantDots} wave dots (${f.dots[cls].length})`);
    check(f.tris[cls].length === wantTris,
      `desktop ${tag} ${CONAME[ck]}: ${wantTris} MRP triangles (${f.tris[cls].length})`);
  }
  check(f.gls === 5, `desktop ${tag}: five gridlines`);
  const bot = 236 - 34;      /* plot bottom: desktop H=236, margins 34/16 */
  /* the line threads every mark: count line vertices == per-cohort marks,
     and the line passes through each mark's centre within 1.5px */
  const tk = axisMap(f.ticks);
  check(!!tk && !tk.err, `desktop ${tag}: tick labels parsed${tk && tk.err ? " – " + tk.err : ""}`);
  if (tk) {
    for (const [li, lcls] of cam.cohorts.map((c) => CLS[c]).entries()) {
      const path = f.lines.find((l) => l.cls === lcls);
      if (!path) { check(false, `desktop ${tag} .${lcls}: line found`); continue; }
      /* monotoneXY: M/L starts a segment, C's third number pair ends it —
         segment ENDS are the marks, controls are not */
      const verts = [...path.d.matchAll(/([ML])([\d. ,]+)|C([\d. ,]+)/g)].map((m) => {
        const s = m[2] != null ? m[2] : m[3];
        const ns = s.trim().split(/[ ,]+/).map(Number);
        return { x: ns[ns.length - 2], y: ns[ns.length - 1] };
      });
      const marks = lineWaves.filter((w) => w[cam.cohorts[li]] != null);
      check(verts.length === marks.length,
        `desktop ${tag} .${lcls}: line has one vertex per mark (${verts.length} of ${marks.length})`);
      const per = Math.max(...marks.map((w, k) => Math.abs(tk.x(w.xm) - verts[k].x)));
      check(per < 1.5, `desktop ${tag} .${lcls}: vertices sit at their waves' x (${per.toFixed(2)}px max drift)`);
      const yeds = Math.max(...verts.map((v, k) => Math.abs(100 * (bot - v.y) / (bot - 16) - marks[k][cam.cohorts[li]])));
      check(yeds < 0.06,
        `desktop ${tag} .${lcls}: vertices sit at their waves' y (${yeds.toFixed(3)}pt max drift) — the triangles bend the line like dots`);
    }
    /* triangles sit at their own mid-x too (not snapped to month slots) */
    for (const ck of cam.cohorts) {
      const cls = CLS[ck];
      const list = (cam.q === "ln" ? lineWaves : extOf(FF, cam.q, "")).filter((w) => w[ck] != null);
      const got = f.tris[cls].map((p) => p.x), want = list.map((w) => tk.x(w.xm));
      const off = got.length === want.length && got.every((x, k) => Math.abs(x - want[k]) < 1.5);
      check(off, `desktop ${tag} ${CONAME[ck]}: triangles at their MRPs' midpoints (${JSON.stringify(got.map((x) => +x.toFixed(1)))})`);
    }
    /* wave dots at their printed windows' midpoints */
    for (const ck of cam.cohorts) {
      const cls = CLS[ck];
      if (cam.q === "ln") continue;
      const list = wavesOf(FF, cam.q, "").filter((w) => w[ck] != null);
      const got = f.dots[cls].map((p) => p.x), want = list.map((w) => tk.x(w.xm));
      const off = got.length === want.length && got.every((x, k) => Math.abs(x - want[k]) < 1.5);
      check(off, `desktop ${tag} ${CONAME[ck]}: dots at their waves' midpoints${off ? "" : " (" + fmtMax(got, want) + "px off)"}`);
    }
  }
  /* vmapping: dots+triangles render their published shares on the value
     axis — recombine per cohort in date order */
  for (const [li, ck] of cam.cohorts.entries()) {
    const cls = CLS[ck];
    const list = lineWaves.filter((w) => w[ck] != null);
    const got = [...(f.dots[cls] || []), ...(f.tris[cls] || [])].sort((a, b) => a.x - b.x)
      .map((p) => 100 * (bot - p.y) / (bot - 16));
    const want = list.map((w) => w[ck]);
    check(got.length === want.length && got.every((v, k) => Math.abs(v - want[k]) <= 0.06),
      `desktop ${tag} ${CONAME[ck]}: dots+triangles vmap the shares (${JSON.stringify(got.map((v) => +v.toFixed(2)))})`);
  }
  /* hit-circles: one per (group, cohort) — waves+MRP+election+crosses */
  const eo = elecOf(FF, cam.q, ""), bs = bysOf(FF, cam.q, "");
  const wantHits = lineWaves.reduce((a, w) => a + cam.cohorts.filter((ck) => w[ck] != null).length, 0)
    + eo.reduce((a, e) => a + cam.cohorts.filter((ck) => e[ck] != null).length, 0)
    + bs.reduce((a, b) => a + cam.cohorts.filter((ck) => b[ck] != null).length, 0);
  check(f.nHits === wantHits, `desktop ${tag}: ${wantHits} hit circles (${f.nHits})`);
  /* one tab stop & one button per group (CSV: coal chart groups = waves,
     demos, election; v-ON = waves, demosOn, bys; ln = lnpOn waves) */
  const nGroups = (cam.q === "ln" ? lineWaves.length
    : (new Set([...wavesOf(FF, cam.q, "").map((w) => w.date), ...extOf(FF, cam.q, "").map((w) => w.date),
                ...bs.map((b) => "x" + b.key), ...eo.map(() => "e")])).size);
  const nKeyed = nGroups - eo.length - bs.length;      /* rings and crosses name no poll row */
  check(f.tabbable === nGroups && f.nButtons === nKeyed,
    `desktop ${tag}: one tab stop per group, a button wherever a poll row opens (${f.tabbable}/${f.nButtons} of ${nGroups}/${nKeyed})`);
}

/* the election rings on the Coalition chart: one open ring per cohort at
   the national elec2025r.all TPP-flow-cut figures, at 3 May 2025, each
   joined to its cohort's first wave (dot or triangle — the MRP is the
   January one) */
{
  const f = d.figs[FI.co], cam = CHARTS[FI.co], tk = axisMap(f.ticks);
  const e = FF.elec2025r.all, bot2 = 236 - 34;
  check(f.erings.length === 3, `desktop v-Coalition: three national election rings (${f.erings.length})`);
  check(Math.abs(e.xm - (2025 * 12 + 4 + 2 / 31)) < 1e-3, `desktop v-Coalition: the election rides 3 May 2025 (xm ${e.xm})`);
  check(JSON.stringify(f.erings.map((g) => g.cls).sort()) === JSON.stringify(cam.cohorts.map((c) => CLS[c]).sort()),
    `desktop v-Coalition: rings take their cohorts' colours (${f.erings.map((g) => g.cls).join(",")})`);
  check(f.erings.every((g) => Math.abs(g.x - tk.x(e.xm)) < 1.5),
    `desktop v-Coalition: rings sit at the true election x (map ${tk.x(e.xm).toFixed(1)})`);
  check(f.erings.length === cam.cohorts.length && cam.cohorts.every((ck) => {
    const ring = f.erings.find((g) => g.cls === CLS[ck]);
    return ring && Math.abs(100 * (bot2 - ring.y) / (bot2 - 16) - e[ck]) <= 0.06;
  }), `desktop v-Coalition: rings vmap the TPP-flow-cut counted flows ${e.grn}/${e.onp}/${e.oth}`);
  const eVals = [["grn", e.grn], ["onp", e.onp], ["oth", e.oth]];
  /* each ring joins its cohort's first mark with the dotted lead-in —
     the MRP's Jan–Mar reading is the first point for the One Nation
     cohort, RedBridge's Feb wave for the rest */
  check(f.leads.length === 3, `desktop v-Coalition: three lead-ins (${f.leads.length})`);
  for (const ck of cam.cohorts) {
    const cls = CLS[ck];
    const ring = f.erings.find((g) => g.cls === cls), lead = f.leads.find((l) => l.cls === cls);
    const first = lineWavesOfNat("co").filter((w) => w[ck] != null)[0];
    const isMrpMark = extOf(FF, "co", "").some((w) => w.xm === first.xm);
    const fw = ((isMrpMark ? f.tris[cls] : f.dots[cls]) || [])[0];
    const m = lead && /^M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)$/.exec(lead.d);
    const ok = ring && lead && m && lead.dash === "0.5 4"
      && Math.abs(+m[1] - ring.x) < 0.5 && Math.abs(+m[2] - ring.y) < 0.5
      && Math.abs(+m[3] - fw.x) < 0.5 && Math.abs(+m[4] - fw.y) < 0.5;
    check(ok, `desktop v-Coalition ${CONAME[ck]}: the lead-in joins the ring to the first ${isMrpMark ? "triangle" : "dot"}`);
  }
  check(f.aria.includes("Open rings mark the 2025 election’s counted preferences: Greens " + e.grn + ", One Nation " + e.onp + ", Other " + e.oth + "."),
    "desktop v-Coalition: the svg's spoken note carries the counted flows (" + Math.round(e.grn * 100) / 100 + "/" + e.onp + "/" + e.oth + ")");
  check(!f.aria.includes("inner-metro") && !f.aria.includes("rural and provincial"),
    "desktop v-Coalition: no regional scope note on the national carrier");
  /* the crossed chart shows its own note */
  const fOn = d.figs[FI.on];
  check(fOn.erings.length === 0 && fOn.leads.length === 0, "desktop v-ON: no rings or lead-ins (no count of this choice)");
  check(!fOn.aria.includes("Open rings"), "desktop v-ON: no election note in the aria");
  check(fOn.emptyNote === "No election count of this choice", `desktop v-ON: the empty-note says so (${JSON.stringify(fOn.emptyNote)})`);
}

/* the crosses on Labor v One Nation: two counts (SA 2026 / Secret Harbour)
   at their own days, never on a line */
{
  const f = d.figs[FI.on], tk = axisMap(f.ticks), bot2 = 236 - 34;
  const want = FF.bys;
  const nX = want.reduce((a, b) => a + ["coal", "grn", "oth"].filter((k) => b[k] != null).length, 0);
  check(f.nX === nX, `desktop v-ON: ${nX} crosses, one per cohort cell of the two counts (${f.nX})`);
  for (const b of want) {
    const xs2 = [];
    for (const k of ["coal", "grn", "oth"]) {
      if (b[k] == null) continue;
      const hit = f.xs[CLS[k === "coal" ? "coal" : k]].filter((p) => Math.abs(p.x - tk.x(b.xm)) < 1.5 && Math.abs(Math.round(1000 * (bot2 - p.y) / (bot2 - 16)) / 10 - b[k]) < 0.06);
      check(hit.length === 1, `desktop v-ON ${b.label} ${CONAME[k]}: a ${b[k]} cross on its own day (${hit.length} at its x)`);
    }
  }
  /* crosses never join a line: asserted by the per-cohort vertex census
     above (each line's vertex count = its in-line marks, crosses excluded) */
  /* cross arias: name the count, the cohort, "preferences to Labor N" */
  check(f.xArias.length === nX, `desktop v-ON: every cross carries its own aria (${f.xArias.length})`);
  const aCross = (k, lbl) => f.xArias.find((a) => a.startsWith(k + ",") && a.includes(lbl + " voters, preferences to Labor"));
  const seen = [["South Australia 2026", "Liberal", 33.9], ["South Australia 2026", "Greens", 84.8],
                ["South Australia 2026", "Independent", 55.9], ["Secret Harbour by-election", "Liberal", 29.8],
                ["Secret Harbour by-election", "Greens", 90]];
  for (const [k, lbl, v] of seen) {
    const a = aCross(k, lbl);
    check(!!a && a.includes(`Labor ` + (Number.isInteger(v) ? v : v.toFixed(1))) && a.includes(", One Nation " + (Number.isInteger(100 - v) ? 100 - v : (100 - v).toFixed(1))),
      `desktop v-ON cross: "${k}, …: ${lbl} voters, preferences to Labor ${v}, One Nation ${100 - v}"${a ? "" : " — MISSING"}`);
  }
  check(f.aria.includes("Crosses mark the 2026 state and by-election counts."),
    "desktop v-ON: the spoken note names the crosses");
}

/* wave arias still speak RedBridge, window first */
{
  const f = d.figs[FI.on], june = FF.vsOn.find((w) => w.ym === "2026-06");
  check(f.waveArias.length === 3 * FF.vsOn.length, `desktop v-ON: three wave arias per RedBridge wave (${f.waveArias.length})`);
  const jc = f.waveArias.find((a) => a.startsWith("RedBridge/Accent, " + june.win + ": Coalition voters"));
  check(!!jc && jc.includes(`Labor ${june.coal}, One Nation ${100 - june.coal}`) && jc.includes("combines the report’s printed CLP/LNP/Nat and Liberal rows"),
    `desktop v-ON June: the Coalition dot's aria carries the combined-rows note (${JSON.stringify(jc && jc.slice(0, 120) + "…")})`);
  check(f.waveArias.filter((s) => !s.includes("Coalition voters")).every((s) => !s.includes("combines")),
    "desktop v-ON: only the June Coalition dot speaks the est note");
  check(d.figs[FI.co].waveArias.every((s) => !s.includes("combines")),
    "desktop v-Coalition: no est note anywhere on the other chart");
}

/* end labels: one name+value block per cohort, at the last mark's x, the
   text dodged in y by cluster-centring */
for (const [i, f] of d.figs.entries()) {
  const cam = CHARTS[i], tag = cam.q === "on" ? "v-ON" : cam.q === "co" ? "v-Coalition" : "Coalition-v-ON";
  const lineWaves = lineWavesOfNat(cam.q);
  check(JSON.stringify(f.els) === JSON.stringify(cam.cohorts.map((c) => CONAME[c])),
    `desktop ${tag}: end labels name the cohorts (${f.els.join(" · ")})`);
  check(JSON.stringify(f.elvs) === JSON.stringify(cam.cohorts.map((ck) => {
    const w = [...lineWaves].reverse().find((x) => x[ck] != null);
    return String(w[ck]);
  })),
    `desktop ${tag}: end values are the latest shares (${f.elvs.join(" · ")})`);
  check(f.elxs.every((x) => x === f.W - 76), `desktop ${tag}: end labels hug the axis end (W−76 = ${f.elxs[0]})`);
  const labYs = [...f.elys].sort((p, q) => p - q);
  check(labYs.every((y, j) => j === 0 || y - labYs[j - 1] >= 27),
    `desktop ${tag}: the end-label dodge keeps blocks apart (min gap ${Math.min(...labYs.slice(1).map((y, j) => Math.round(y - labYs[j])))})`);
}

/* the spoken xnote: triangles on every chart, crosses on the v-ON one */
for (const [i, f] of d.figs.entries()) {
  const cam = CHARTS[i], tag = cam.q === "on" ? "v-ON" : cam.q === "co" ? "v-Coalition" : "Coalition-v-ON";
  const lineWaves = lineWavesOfNat(cam.q);
  const last = lineWaves[lineWaves.length - 1];
  const mrpCk = cam.cohorts.filter((ck) => isMrp(last) && last[ck] != null);
  check(f.aria.includes("Triangles mark DemosAU’s MRP readings"),
    `desktop ${tag}: the spoken note names the triangles`);
}
check(d.figs[FI.co].aria.includes("Crosses mark") === false && d.figs[FI.ln].aria.includes("Crosses mark") === false,
  "desktop v-Coalition & Coalition-v-ON: no crosses note where no crosses draw");

/* the key row: four tokens — line, triangle, cross, ring */
check(JSON.stringify(d.keyItems) === JSON.stringify(["RedBridge/Accent, monthly", "DemosAU MRP, quarterly", "2026 state and by-election counts", "2025 election, as counted"]),
  `desktop: the key row names the four kinds (${JSON.stringify(d.keyItems)})`);

/* titles and the pressed battery (recomputed from the payload) */
check(JSON.stringify(d.h4s) === JSON.stringify(FFexpNat.titles),
  `desktop: the three titles are the three-share lines + any battery tails (${JSON.stringify(d.h4s)})`);
check(d.pressed && d.pressed.length === 9 && JSON.stringify(d.pressed.map((r) => r.name)) === JSON.stringify(FFexpNat.rows.map((r) => r.name)),
  `pressed set: nine rows in ffQ order (${JSON.stringify((d.pressed || []).map((r) => r.name))})`);
for (const [i, exp] of FFexpNat.rows.entries()) {
  const row = d.pressed && d.pressed[i];
  check(!!row && JSON.stringify(row.cells) === JSON.stringify(exp.cells),
    `pressed ${exp.name}: figures recomputed (${JSON.stringify(row && row.cells)} vs ${JSON.stringify(exp.cells)})`);
  check(!!row && row.yes === (exp.sig ? 1 : 0),
    `pressed ${exp.name}: Yes iff the battery says Yes (${exp.cells[3]})`);
}

/* the pressed-set head above the battery, and the section-h4 battery's
   own head */
check(d.tsigHeads && d.tsigHeads[0] === "Series" && d.tsigHeads.length === 5,
  `tsig heads (${JSON.stringify(d.tsigHeads)})`);

/* the Flows table (user 2026-10-13; the RdTsig fold became the .rd-ft
   per-contest grids, then the .rd-ft fold was UN-FOLDED the same day —
   always the first thing under the forced-choice head, above the three
   charts, never a dropdown): recomputed from the payload + the site's
   flowTables — cohorts down the side, sources across: the election's
   TPP count (national on All voters; on a named region the class's seat
   replay under a "2025, <class> seats" label — the AEC counts the cut
   nationally only, so a regional column is this site's replay, flagged
   as such), the site's national constants as the yardstick on every
   view, then each house's latest wave (RedBridge/Accent and DemosAU's
   national MRP are national-only columns, DemosAU's regional tables
   rekey). Figures print through the renderer's ftFig precision rule,
   replicated here so float edges round identically */
const ftFig = (v, dp) => (dp != null ? v.toFixed(dp) : Math.round(v * 10) % 10 === 0 ? String(Math.round(v)) : v.toFixed(1));
const SMON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const smonY = (ym) => { const [y, m] = ym.split("-").map(Number); return SMON[m - 1] + " " + y; };
const ftLt = {
  co: FF.vsCoal[FF.vsCoal.length - 1], on: FF.vsOn[FF.vsOn.length - 1],
  dm: FF.demos && FF.demos[FF.demos.length - 1],
  mn: FF.demosOn && FF.demosOn[FF.demosOn.length - 1],
  ln: FF.lnpOn && FF.lnpOn[FF.lnpOn.length - 1],
};
const mrpSub = (w) => "MRP, " + w.win.replace(/^.*?([A-Z][a-z]{2} \d{4})$/, "$1");
/* reg: "" national view, else a region key + its menu name */
const wantFlows = (reg, regName) => {
  const elecH = "Election" + (reg ? "2025, " + regName + " seats" : "2025 count");
  const siteH = "This site" + (reg ? "national" : "assumes");
  const mrp = (w) => (reg ? w[reg] : w.all);
  const el = (reg && FF.elec2025r[reg]) || FF.elec2025r.all;
  const stCo = FT && { grn: FT.lnp.grn * 100, onp: FT.lnp.onp * 100, oth: FT.lnp.oth * 100 };
  const stOn = FT && { coal: FT.onp.lnp * 100, grn: FT.onp.grn * 100, oth: FT.onp.oth * 100 };
  const stOnB = FT && { coal: FT.onBand.lnp * 100, grn: FT.onBand.grn * 100, oth: FT.onBand.oth * 100 };
  const cells = (d0, cks, dp, band) => cks.map((ck) => (d0 && d0[ck] != null
    ? ftFig(d0[ck], dp) + (band && band[ck] != null ? " ±" + ftFig(band[ck]) : "") : "–"));
  const t = [];
  t.push({
    caption: "Labor v CoalitionShare of each group’s voters choosing Labor, %",
    cols: [elecH, stCo && siteH, !reg && `RedBridge${smonY(ftLt.co.ym)}`, !reg && ftLt.dm && `DemosAU${mrpSub(ftLt.dm)}`].filter(Boolean),
    rows: ["grn", "onp", "oth"].map((ck, i) => ({
      name: CONAME[ck],
      cells: [cells(el, [ck], 1)[0], stCo && cells(stCo, [ck], 1)[0],
        !reg && cells(ftLt.co, [ck])[0], !reg && ftLt.dm && cells(ftLt.dm, [ck])[0]].filter((x) => x !== false),
    })),
  });
  t.push({
    caption: "Labor v One NationShare of each group’s voters choosing Labor, %",
    cols: [stOn && siteH, !reg && `RedBridge${smonY(ftLt.on.ym)}`, ftLt.mn && `DemosAU${mrpSub(ftLt.mn)}${reg ? "" : "*"}`].filter(Boolean),
    rows: ["coal", "grn", "oth"].map((ck) => ({
      name: CONAME[ck],
      cells: [stOn && cells(stOn, [ck], null, stOnB)[0],
        !reg && cells(ftLt.on, [ck])[0], ftLt.mn && cells(mrp(ftLt.mn), [ck])[0]].filter((x) => x !== false),
    })),
  });
  if (ftLt.ln) t.push({
    caption: "Coalition v One NationShare of each group’s voters choosing the Coalition, %",
    cols: [`DemosAU${mrpSub(ftLt.ln)}${reg ? "" : "*"}`],
    rows: ["alp", "grn", "oth"].map((ck) => ({ name: CONAME[ck], cells: cells(mrp(ftLt.ln), [ck]) })),
  });
  return { view: (reg ? regName + " seats" : "All voters") + ", from the menu above", tables: t };
};
const checkFlows = (g, reg, regName, tag) => {
  const w = wantFlows(reg, regName);
  check(g.ftView === w.view, `flows table ${tag}: the view line reads for this menu (${JSON.stringify(g.ftView)})`);
  check(g.ftTables && g.ftTables.length === w.tables.length,
    `flows table ${tag}: ${w.tables.length} contest tables (${g.ftTables && g.ftTables.length})`);
  (g.ftTables || []).forEach((tb, i) => {
    const wt = w.tables[i];
    if (!wt) return;
    check(tb.caption === wt.caption, `flows table ${tag} [${i}]: caption (${JSON.stringify(tb.caption)})`);
    check(JSON.stringify(tb.cols) === JSON.stringify(wt.cols),
      `flows table ${tag} [${i}]: source columns (${JSON.stringify(tb.cols)})`);
    check(JSON.stringify(tb.rows) === JSON.stringify(wt.rows),
      `flows table ${tag} [${wt.caption.split("Share")[0]}]: cohort figures (${JSON.stringify(tb.rows.map((r) => r.cells))})`);
  });
  /* the election column rekeys with the rings: the national TPP count on
     All voters, the class's seat replay on a named region */
  const el = (reg && FF.elec2025r[reg]) || FF.elec2025r.all, elCells = [ftFig(el.grn, 1), ftFig(el.onp, 1), ftFig(el.oth, 1)];
  check(!!g.ftTables && g.ftTables[0] && JSON.stringify(g.ftTables[0].rows.map((r) => r.cells[0])) === JSON.stringify(elCells),
    `flows table ${tag}: the Election column rides ${reg ? "the class's replay" : "the national TPP count"} (${JSON.stringify(elCells)})`);
};
{
  /* the un-folded contract (user 2026-10-13): the tables are the FIRST
     thing under the forced-choice head, above the three charts, wearing
     no dropdown; the trend-significance battery is the section's only
     fold left and carries "Flows table" nowhere */
  check(JSON.stringify(d.ffKids) === JSON.stringify(["head", "tables", "pair", "ln", "key"]),
    `flows table: always the first thing under the head, above the three charts (${d.ffKids.join(" > ")})`);
  check(d.ftInDetails === false && !d.dets.includes("Flows table")
    && JSON.stringify(d.dets) === JSON.stringify(["Trend-significance table"]),
    `flows table: no <details> carries it (folds left in the section: ${d.dets.join(", ") || "none"})`);
  checkFlows(d, "", null, "national");
  check(!!d.ftNote && /which the commission counts nationally/.test(d.ftNote) && /This site/.test(d.ftNote) && /2026 state and by-election counts stay on the charts/.test(d.ftNote),
    "flows table: the note records the national election count, the this-site yardstick and the chart-only 2026 counts");
}
const viewH = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH === 236, `desktop: plot height 236 (${viewH})`);
check(d.sw <= d.iw + 1, `desktop: no horizontal overflow (sw ${d.sw} vs iw ${d.iw})`);

// ---- the region select: rekeys DemosAU, drops RedBridge from every chart,
//      drops the v-Co chart's national marks too, and rekeys the rings ----
const SWEEP = [["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];
const setReg = async (val) => {
  await page.select('.rd-ff-head select.rd-pv-sel[aria-label="DemosAU MRP region"]', val);
  await new Promise((r) => setTimeout(r, 400));
  return measure();
};
const lineWavesOfReg = (q, reg) => {
  if (q === "ln") return rekeyMrp(FF.lnpOn, reg);
  const ws = reg ? [] : FF[CHARTS[FI[q]].vsKey];
  return [...ws, ...extOf(FF, q, reg)].sort((a, b) => a.xm - b.xm);
};
for (const [val, regName] of SWEEP) {
  const dr2 = await setReg(val);
  const bot2 = 236 - 34;
  check(dr2.sel && dr2.sel.value === val, `region ${regName}: the select reads ${val}`);
  /* user 2026-10-13, the day's third call: "in the regions view in the
     Labor-v-Coalition preference flows chart, there should be no
     RedBridge/Accent polls… It's just DemosAU, ALP, One Nation" — every
     national mark (dots AND triangles) drops from every chart on a named
     region; the Coalition chart stands on its three election rings alone,
     rekeyed to the seat-classification replay */
  check(dr2.nFig === 3 && JSON.stringify(dr2.figs.map((f) => f.q)) === '["co","on","ln"]',
    `region ${regName}: all three figures stand — every national mark drops, the region's rings and DemosAU cells carry (${dr2.figs.map((f) => f.q).join(",") || "none"})`);
  check(dr2.emptyCell == null, `region ${regName}: no national-only stand-in paragraph (the chart draws its rings)`);
  const byQ = Object.fromEntries(dr2.figs.map((f) => [f.q, f]));
  {
    /* v-Coalition on a named region: NO dots, NO triangles, NO lines, NO
       lead-ins — the three election rings alone, at the class replay's
       own values */
    const a = d.figs[FI.co], f = byQ.co, cam = CHARTS[FI.co];
    const e = FF.elec2025r[val] || FF.elec2025r.all, botR = 236 - 34;
    check(Object.values(f.dots).every((arr) => arr.length === 0) && f.nTr === 0 && f.nX === 0,
      `region ${regName} v-Coalition: no RedBridge dots and no DemosAU triangles (dots ${Object.entries(f.dots).map(([k, v]) => k + ":" + v.length).join(",")}, tris ${f.nTr})`);
    check(f.lines.length === 0 && f.leads.length === 0,
      `region ${regName} v-Coalition: nothing left to draw a line or a lead-in through`);
    check(f.gls === 5, `region ${regName} v-Coalition: five gridlines stand`);
    check(f.erings.length === 3 && cam.cohorts.every((ck) => f.erings.some((g) => g.cls === CLS[ck])),
      `region ${regName} v-Coalition: the three election rings stand alone on the chart`);
    const tkR = axisMap(f.ticks);
    const nat = FF.elec2025r.all;
    check(cam.cohorts.every((ck) => {
      const ring = f.erings.find((g) => g.cls === CLS[ck]);
      return ring && Math.abs(ring.x - tkR.x(e.xm)) < 1.5 && Math.abs(100 * (botR - ring.y) / (botR - 16) - e[ck]) <= 0.06;
    }), `region ${regName} v-Coalition: the rings vmap the class replay's figures ${e.grn}/${e.onp}/${e.oth} (not the national ${nat.grn}/${nat.onp}/${nat.oth})`);
    check(cam.cohorts.some((ck) => Math.abs(f.erings.find((g) => g.cls === CLS[ck]).y - a.erings.find((g) => g.cls === CLS[ck]).y) > 4),
      `region ${regName} v-Coalition: the rings visibly MOVE from the All-voters view's — the rekey shows`);
    check(f.aria.includes(e.scopeNote) && f.aria.includes("Greens " + e.grn) && f.aria.includes("One Nation " + e.onp) && f.aria.includes("Other " + e.oth),
      `region ${regName} v-Coalition: the spoken note scopes the replay and names its figures`);
    check(f.elecArias.length === 3 && f.elecArias.every((s) => s.startsWith("2025 election, " + e.scopeTtl)),
      `region ${regName} v-Coalition: the ring arias title the class's own count ("2025 election, ${e.scopeTtl}")`);
  }
  /* v-ON: NO RedBridge dots at all — the MRP's regional triangles alone */
  {
    const f = byQ.on, cam = CHARTS[FI.on];
    const lineWaves = rekeyMrp(FF.demosOn, val);
    check(f.nTr === lineWaves.length * 3 && Object.values(f.dots).every((arr) => arr.length === 0),
      `region ${regName} v-ON: no RedBridge dots — ${f.nTr} triangles from ${lineWaves.length} regional MRPs`);
    check(f.nX === 0, `region ${regName} v-ON: no crosses either (national counts)`);
    check(f.gls === 5, `region ${regName} v-ON: five gridlines stand`);
    check(f.lines.length === 3, `region ${regName} v-ON: the triangles still carry three lines`);
    for (const [li, ck] of cam.cohorts.entries()) {
      const cls = CLS[ck];
      const list = lineWaves.filter((w) => w[ck] != null);
      const got = f.tris[cls].slice().sort((a, b) => a.x - b.x).map((p) => Math.round(100 * (bot2 - p.y) / (bot2 - 16)));
      check(JSON.stringify(got) === JSON.stringify(list.map((w) => w[ck])),
        `region ${regName} v-ON ${CONAME[ck]}: triangles vmap the printed regional cells (${JSON.stringify(got)})`);
    }
    check(f.aria.includes("Triangles mark DemosAU’s MRP readings") && f.aria.includes("all-regions weighting") === false && f.aria.includes("Crosses mark") === false,
      `region ${regName} v-ON: the spoken note names triangles only — no weighting flag on printed cells, no crosses`);
    check(f.aria.includes("all-regions weighting") === false, `region ${regName} v-ON: no our-weighting note on printed cells`);
  }
  /* the third chart rekeys to the region's printed cells */
  {
    const f = byQ.ln, cam = CHARTS[FI.ln];
    const lineWaves = rekeyMrp(FF.lnpOn, val);
    check(f.lines.length === 3 && f.nTr === lineWaves.length * 3,
      `region ${regName} Coalition-v-ON: ${lineWaves.length} regional MRPs still draw three lines`);
    for (const [li, ck] of cam.cohorts.entries()) {
      const got = f.tris[CLS[ck]].slice().sort((a, b) => a.x - b.x).map((p) => Math.round(100 * (bot2 - p.y) / (bot2 - 16)));
      const want = lineWaves.filter((w) => w[ck] != null).map((w) => w[ck]);
      check(JSON.stringify(got) === JSON.stringify(want),
        `region ${regName} Coalition-v-ON ${CONAME[ck]}: triangles vmap the printed cells (${JSON.stringify(got)})`);
    }
    check(f.aria.includes("all-regions weighting") === false, `region ${regName} Coalition-v-ON: no our-weighting note on printed cells`);
  }
  check(JSON.stringify(dr2.keyItems) === JSON.stringify(d.keyItems),
    `region ${regName}: the key stands whole — "2025 election, as counted" stays (${JSON.stringify(dr2.keyItems)})`);
  /* the flows table FOLLOWS the menu on a named region — RedBridge's
     column drops with its dots, DemosAU's regional cells print as the
     report does, and the Election column rekeys to the class's seat
     replay — while This site stays the national yardstick */
  checkFlows(dr2, val, regName, regName);
  const ofPhrase = { "Inner metro": "inner metro", "Outer metro": "outer metro", "Regional": "regional or rural" }[regName];
  check(!!dr2.ftNote && dr2.ftNote.includes("on this view replayed for the seats classed " + ofPhrase) && /our replay, not its own/.test(dr2.ftNote) && /the national one in every region/.test(dr2.ftNote),
    `region ${regName} flows table: the note says the election column replays the class's seats while the this-site yardstick stays national`);
  /* the pressed battery across all nine rows follows the region's cells */
  const fExp = expectedForced(FF, val);
  check(dr2.pressed && JSON.stringify(dr2.pressed.map((r) => r.cells)) === JSON.stringify(fExp.rows.map((r) => r.cells)),
    `region ${regName}: the nine pressed rows recompute on the region's cells`);
  check(JSON.stringify(dr2.h4s[2]) === JSON.stringify(fExp.titles[2]),
    `region ${regName}: the third title follows the region`);
  check(dr2.h4s[0] === d.h4s[0] && dr2.h4s[1] === d.h4s[1],
    `region ${regName}: the RedBridge pair's titles stand`);
}
const dBack = await setReg("");
check(JSON.stringify(dBack.figs[FI.on].dots) === JSON.stringify(d.figs[FI.on].dots) && dBack.figs[FI.on].nX > 0,
  "region menu off: national RedBridge dots and the crosses return");

// ---------------- hovers: tips ---------------------------------------------
const hitAt = async (fi, match) => {
  const has = await page.evaluate((fi, match) => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][fi];
    const h = [...fig.querySelectorAll("circle.rd-apd-hit")].find((x) => {
      const a = x.getAttribute("aria-label") || "";
      return a.startsWith(match.pre + ":") && a.includes(": " + match.lbl + " voters");
    });
    if (!h) return false;
    h.scrollIntoView({ block: "center" });
    return true;
  }, fi, match);
  if (!has) return null;
  await new Promise((r) => setTimeout(r, 300));
  return page.evaluate((fi, match) => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][fi];
    const h = [...fig.querySelectorAll("circle.rd-apd-hit")].find((x) => {
      const a = x.getAttribute("aria-label") || "";
      return a.startsWith(match.pre + ":") && a.includes(": " + match.lbl + " voters");
    });
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, fi, match);
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
    est: [...t.querySelectorAll(".tip-sub.tip-hint")].map((s) => s.textContent.trim()),
    wrap: t.querySelectorAll(".tip-row.tip-hintwrap").length,
  };
}, fi);
const hover = async (fi_v, pre, lbl) => {
  const c = await hitAt(fi_v, { pre, lbl });
  if (!c) return null;
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  return readTip(fi_v);
};

const lastOn = FF.vsOn[FF.vsOn.length - 1], lastCo = FF.vsCoal[FF.vsCoal.length - 1];
const lastDemosOn = rekeyMrp(FF.demosOn, "")[FF.demosOn.length - 1];
const lastLnp = rekeyMrp(FF.lnpOn, "")[FF.lnpOn.length - 1];
const RB = (win) => "RedBridge/Accent, " + win;
{
  const tip = await hover(FI.on, RB(lastOn.win), "Coalition");
  check(!!tip && tip.title === RB(lastOn.win) && tip.sub === "Would pick Labor over One Nation",
    `v-ON ${lastOn.win} Coalition hover: tip titled RedBridge + window (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.vals.includes(`${lastOn.coal}%`) && tip.vals.includes(`${lastOn.grn}%`) && tip.vals.includes(`${lastOn.oth}%`)
      && tip.sw.every((x) => x.startsWith("wave ")) && tip.on === "Coalition voters"
      && tip.hint === "Click to open this poll in All polls",
    `v-ON wave tip: every cohort's share with dot swatches, the open hint (${JSON.stringify(tip && tip.vals)})`);
}
{
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  const tip = await hover(FI.on, RB(juneOn.win), "Greens");
  check(!!tip && tip.est.length === 1 && tip.est[0].includes("CLP/LNP/Nat (34)") && tip.est[0].includes("Liberal (37)") && tip.est[0].includes("no combined row was printed")
      && tip.vals.includes(`${juneOn.coal}%`) && tip.vals.includes(`${juneOn.grn}%`),
    `v-ON June tip: the combined-rows note rides the June wave (${JSON.stringify(tip && tip.est)})`);
  check(tip && tip.hint === "Click to open this poll in All polls", `v-ON June tip: the open-poll hint beside the est note`);
  check(tip && tip.wrap === 1, `v-ON June tip: only the est note wraps (${tip && tip.wrap})`);
}
{
  const tip = await hover(FI.co, RB(lastCo.win), "Greens");
  check(!!tip && tip.title === RB(lastCo.win) && tip.sub === "Would pick Labor over the Coalition" && tip.vals.includes(`${lastCo.grn}%`),
    `v-Coalition ${lastCo.win} Greens hover: title + question (${JSON.stringify(tip && [tip.title, tip.sub])})`);
}
/* the election ring tips like the primary chart's */
{
  const e = FF.elec2025r.all;
  const tip = await hover(FI.co, "2025 election, as counted", "One Nation");
  check(!!tip && tip.title === "2025 election, as counted" && tip.sub === "Preferences counted reaching Labor over the Coalition"
      && [e.grn, e.onp, e.oth].every((v) => tip.vals.includes(v + "%"))
      && tip.sw.every((x) => x.startsWith("elec ")) && tip.on === "One Nation voters" && tip.hint === null,
    `election ring tip: the counted flows, ring swatches, no open hint ("no poll row") (${JSON.stringify(tip && tip.vals)})`);
}
/* the crosses tip too: the count's name, its printed-order cohort names,
   its own provenance sub, cross swatches, no open hint */
{
  const sa = FF.bys.find((b) => b.key === "sa2026");
  const tip = await hover(FI.on, "South Australia 2026, " + sa.win, "Liberal");
  check(!!tip && tip.title === "South Australia 2026, " + sa.win && tip.sub === sa.sub
      && tip.vals.includes(`33.9%`) && tip.vals.includes(`84.8%`) && tip.vals.includes(`55.9%`)
      && tip.sw.every((x) => x.startsWith("byelec ")) && tip.on === "Liberal voters" && tip.hint === null,
    `SA cross tip: the count's name, its three cohorts, its provenance (${JSON.stringify(tip && tip.vals)})`);
  check(tip && JSON.stringify(tip.rows.filter((r) => r.endsWith(" voters"))) === JSON.stringify(["Greens voters", "Liberal voters", "Independent voters"]),
    "SA cross tip: the cohort rows name the count's own parties in chart order (Greens/Liberal/Independent)");
}
{
  const tip = await hover(FI.on, "Secret Harbour by-election, 29 Aug 2026", "Greens");
  check(!!tip && tip.title === "Secret Harbour by-election, 29 Aug 2026"
      && tip.sub === "Green’s count of the early voting centre, 47% of the votes"
      && tip.rows.filter((r) => r.endsWith(" voters")).length === 2 && tip.hint === null,
    `Harbour cross tip: the count's own provenance and pair (${JSON.stringify(tip && tip.rows)})`);
}
/* the MRP triangles tip on all three charts, with the triangle swatch, and
   open their MRP's row */
for (const q of ["co", "on", "ln"]) {
  const mrp = q === "ln" ? lastLnp : q === "on" ? lastDemosOn : FF.demos[FF.demos.length - 1];
  if (!mrp) continue;
  const ck = CHARTS[FI[q]].cohorts.find((k) => mrp[k] != null);
  const pre = "DemosAU MRP, " + mrp.win;
  const tip = await hover(FI[q], pre, (mrp.lbl && mrp.lbl[ck]) || CONAME[ck]);
  check(!!tip && tip.title === pre && tip.vals.includes(String(mrp[ck]).endsWith("%") ? String(mrp[ck]) : mrp[ck] + "%") && tip.sw.every((x) => x.startsWith("mrp "))
      && tip.hint === "Click to open this poll in All polls",
    `${q} MRP triangle tip: triangle swatches, the open hint (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.sub && tip.sub.startsWith("Would pick " + CHARTS[FI[q]].anchor + " over " + CHARTS[FI[q]].rival),
    `${q} MRP tip: the question as its sub (${JSON.stringify(tip && tip.sub)})`);
  if (q !== "co") check(tip && tip.sub.includes("all regions: our weighting"), `${q} MRP tip (All voters): our-weighting flagged`);
}

/* a click opens the wave's own row in All polls, and the forced splits
   ride the drawer's Preferences line (RdLgFlowsLine, mirrored from the
   ledger probes) — the line is NEVER a row of the two-party table */
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
const GLAB = { coal: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const grpHas = (prefs, title, want) => {
  const g = prefs && prefs.groups && prefs.groups[title];
  return !!g && Object.entries(want).every(([k, v]) => v == null || g[GLAB[k]] === v);
};
{
  const c = await hitAt(FI.on, { pre: RB(lastOn.win), lbl: "Coalition" });
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
  } catch (e) {}
  check(!!land && land.head === "RedBridge/Accent",
    `click ${lastOn.win} Coalition dot: the wave's poll row opens in All polls (${JSON.stringify(land && land.head)})`);
  check(!!land && land.back === "Back to the forced-choice flow chart",
    `…the return button names the forced-choice chart (${JSON.stringify(land && land.back)})`);
  check(!!land && land.subRows === 0 && land.forcedLeft === false,
    `ledger: no forced rows left in the two-party table (${land && JSON.stringify([land.subRows, land.forcedLeft])})`);
  check(!!land && land.prefs && land.prefs.lead === "Preferences" && land.prefs.head === "If forced to choose",
    `ledger: the Preferences line reads "If forced to choose" (${JSON.stringify(land && land.prefs)})`);
  check(!!land && grpHas(land.prefs, "to ALP v ON", { coal: lastOn.coal, grn: lastOn.grn, oth: lastOn.oth }),
    `ledger: ALP-v-ON group vmaps the wave's own row (${JSON.stringify(land && land.prefs && land.prefs.groups["to ALP v ON"])})`);
  check(!!land && grpHas(land.prefs, "to ALP v L/NP", { grn: lastCo.grn, onp: lastCo.onp, oth: lastCo.oth }),
    `ledger: ALP-v-L/NP group vmaps the wave's own row (${JSON.stringify(land && land.prefs && land.prefs.groups["to ALP v L/NP"])})`);
  check(!!land && land.prefs && land.prefs.tails.every((t) => !/combined row was printed/.test(t)),
    "ledger: no combined-rows tail on a printed wave");
}
/* the June drawer's combined-rows note rides the preferences line's tail */
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
  } catch (e) {}
  const juneOn = FF.vsOn.find((w) => w.ym === "2026-06");
  check(!!jun && jun.prefs && jun.subRows === 0 && jun.prefs.head === "If forced to choose",
    `June drawer: the splits ride the Preferences line, not the table`);
  check(!!jun && grpHas(jun.prefs, "to ALP v ON", { coal: juneOn.coal }),
    `June drawer: the derived Coalition split ${juneOn.coal} lands in the ALP-v-ON group`);
  check(!!jun && jun.prefs && jun.prefs.tails.some((t) => /combined row was printed/.test(t) && /CLP\/LNP\/Nat/.test(t)),
    `June drawer: the combined-rows note is the line's tail`);
}

// ---------------- phone rung ------------------------------------------------
await gotoFlows(390);
const m2 = await measure();
check(m2.nFig === 3, `phone: three figures (${m2.nFig})`);
check(!!m2.sel && m2.sel.value === "", `phone: region select rides the head, on All voters (${m2.sel && m2.sel.value})`);
check(JSON.stringify(m2.ffKids) === JSON.stringify(["head", "tables", "pair", "ln", "key"]),
  `phone: the tables stand above the charts, no fold (${m2.ffKids.join(" > ")})`);
{
  const [a, b, c] = m2.figs;
  check(a.w === b.w && b.w === c.w, `phone: the three charts share the section width (${a.w}/${b.w}/${c.w})`);
  check(b.top > a.top + 10 && c.top > b.top + 10, `phone: charts stack (${a.top} → ${b.top} → ${c.top})`);
  check(m2.sw <= m2.iw + 1, `phone: no horizontal overflow (sw ${m2.sw} vs iw ${m2.iw})`);
  for (const [i, f] of [a, b, c].entries()) {
    const cam = CHARTS[i], tag = cam.q === "on" ? "v-ON" : cam.q === "co" ? "v-Coalition" : "Coalition-v-ON";
    check(f.lines.length === 3, `phone ${tag}: three cohort lines (${f.lines.length})`);
    check(JSON.stringify(f.els.length ? f.els.map((s) => s.replace(/’/g, "'")) : []) === JSON.stringify(cam.cohorts.map((x) => CONAME[x])),
      `phone ${tag}: the cohort end labels stand (${f.els.join(" · ")})`);
  }
  const onL = lineWavesOfNat("on");
  const eo = FF.elec2025r.all;
  const e3 = m2.figs[FI.co].erings;
  check(e3.length === 3, `phone v-Coalition: the three election rings (${e3.length})`);
  check(m2.figs[FI.on].nX === m2.figs[FI.on].xArias.length, `phone v-ON: every cross still carries an aria`);
  check(m2.figs[FI.on].nX > 0, `phone v-ON: the crosses draw at phone width (${m2.figs[FI.on].nX})`);
}
check(JSON.stringify(m2.h4s) === JSON.stringify(FFexpNat.titles), "phone: same dynamic titles");
check(JSON.stringify(m2.keyItems) === JSON.stringify(d.keyItems), "phone: the four-token key row stands");
const viewH2 = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH2 === 200, `phone: plot height 200 (${viewH2})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "rd-forced-charts: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
