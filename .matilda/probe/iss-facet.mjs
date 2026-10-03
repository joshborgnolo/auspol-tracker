// Headless acceptance probe for the All-polls Issues facet (Ipsos built
// into the table, SEC Newgate's direction-only rows riding in, and the
// "how it counts" rail tailored to issues). Mirror of dir-facet.mjs.
//
//  1. The facet strip carries Issues after Direction (the arrow-key walk
//     uses the same FACETS order), and ?f=i deep-links onto it
//  2. The facet lists every iss-bearing wave: individual-with-iss + SEC
//     Newgate's direction-only rows + the nine issuesOnlyPolls — and the
//     tally denominates against the archive's full extent (of N_all)
//  3. Ipsos rows never leave the Issues facet (no VI, no leadership)
//  4. Every row carries two figure cells (top issue / best on it) and an
//     .rd-ap-d2i cell stacking the 2nd/3rd-issue figure cells from the
//     wave's salience row
//  5. The "With issues figures" scope pill self-arms on the facet
//  6. An opened Ipsos row shows the salience bars grid and the issues rail
//     (Asked / question forms / usual lean / in today's panel) with NO 2PP
//     chart — the rail never says "Labor's" on this facet
//  7. An opened SEC row shows "Named without prompting" + the not-pooled
//     note (its concerns bank is any-mentions, not a forced pick)
//  8. VW=390 VH=844: the phone rung mounts cards carrying the 2nd/3rd
//     issues as a csub under the top issue
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
const PAGE = `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};

// expected row counts, read off the live data bundle in the page
const expectOf = async (page) => page.evaluate(() => {
  const D = window.AUSPOL;
  const withIss = (a) => (a || []).filter((p) => p.iss).length;
  const individual = D.individualPolls || [], dirOnly = D.directionOnlyPolls || [], issOnly = D.issuesOnlyPolls || [];
  return {
    nAll: individual.length + dirOnly.length + issOnly.length,
    nIssAll: withIss(individual) + withIss(dirOnly) + issOnly.length,
    issOnly: issOnly.length,
    secIss: (dirOnly.filter((p) => /^SEC Newgate/.test(p.pollster) && p.iss)).length,
  };
});

async function showAll(page) {
  await page.evaluate(() => {
    const link = [...document.querySelectorAll(".rd-ap-more .rd-link")]
      .find((n) => /^Show all/.test(n.textContent.trim()));
    if (link) link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => !document.querySelector(".rd-ap-more"), { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

async function pickFacet(page, re) {
  await page.evaluate((src) => {
    const rx = new RegExp(src);
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => rx.test(n.textContent.trim()));
    if (!t) throw new Error(`facet tab ${src} not found`);
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, re.source);
  await new Promise((r) => setTimeout(r, 800));
}

async function tallyOf(page) {
  const el = await page.evaluate(() => {
    const c = document.querySelector(".rd-ap-count");
    return c ? c.textContent.replace(/\s+/g, " ").trim() : null;
  });
  if (!el) return null;
  const m = el.match(/^(\d+)(?: of (\d+))? polls$/);
  return m ? { shown: +m[1], of: m[2] ? +m[2] : null, text: el } : { raw: el };
}

async function pollsterCounts(page) {
  return page.evaluate(() => [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].map((r) => {
    const b = r.querySelector("[role='rowheader'] b, .rd-ap-firm");
    return b ? b.textContent.replace(/↗/g, "").trim() : "?";
  }));
}

async function openRowContaining(page, re) {
  const ok = await page.evaluate((src) => {
    const rx = new RegExp(src);
    const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].find((r) => rx.test(r.textContent));
    if (!row) return null;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return row.textContent.slice(0, 60);
  }, re.source);
  if (!ok) return null;
  await new Promise((r) => setTimeout(r, 600));
  return page.evaluate(() => {
    const detail = document.querySelector(".rd-ap-open .rd-apd");
    if (!detail) return null;
    return {
      head: (detail.querySelector(".rd-apd-h") || {}).textContent || "",
      grids: [...detail.querySelectorAll(".rd-apd-grid")].map((g) => g.textContent.replace(/\s+/g, " ").trim()),
      notes: [...detail.querySelectorAll(".rd-apd-note")].map((g) => g.textContent.replace(/\s+/g, " ").trim()),
      issRows: detail.querySelectorAll(".rd-apd-issrow").length,
      issBars: detail.querySelectorAll(".rd-apd-issbar i").length,
      rail: (detail.querySelector(".rd-apd-r") || {}).textContent.replace(/\s+/g, " ").trim(),
      railCtrl: (detail.querySelector(".rd-apd-r .rd-apd-ct") || {}).textContent || "",
      railSvg: !!detail.querySelector(".rd-apd-r svg"),
      keys: [...detail.querySelectorAll(".rd-apd-r .rd-apd-k")].map((k) => k.textContent.trim()),
    };
  });
}

// ----------------------------------------------------------------- desktop
console.log("== All-polls Issues facet (desktop) ==");
const vw = Number(process.env.VW || 1280), vh = Number(process.env.VH || 900);
const page1 = await browser.newPage();
await page1.setViewport({ width: vw, height: vh });
const errs1 = [];
page1.on("pageerror", (e) => errs1.push(String(e)));
await page1.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
await page1.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));

const exp = await expectOf(page1);
console.log("  bundle:", JSON.stringify(exp));

// tab strip order (this is also the arrow-key walk order)
const tabLabels = await page1.evaluate(() =>
  [...document.querySelectorAll(".rd-ap-tabs button")].map((b) => b.textContent.trim()));
const iIss = tabLabels.indexOf("Issues"), iDir = tabLabels.findIndex((t) => /^Direction$/.test(t));
check("an Issues tab sits right after Direction in the strip (and its key walk)",
  iIss > -1 && iIss === iDir + 1, tabLabels.join(" | "));

// tab-class fade machinery: rows keyed rd-ap-ciss with its own keyframe
const fadeReady = await page1.evaluate(() => !!document.querySelector('style, link[href*="assets"]'));
check("page references the stylesheets", fadeReady);

await pickFacet(page1, /^Issues$/);
await page1.waitForSelector(".rd-ap-row, .rd-ap-card", { timeout: 15000 });
await showAll(page1);

// 1: every iss-bearing row, nothing else
const counts1 = await pollsterCounts(page1);
const ipsosR = counts1.filter((w) => /^Ipsos/.test(w)).length;
const secR = counts1.filter((w) => /^SEC Newgate/.test(w)).length;
check(`all ${exp.issOnly} Ipsos waves land on the Issues facet`, ipsosR === exp.issOnly, `${ipsosR}/${exp.issOnly}`);
check(`all ${exp.secIss} SEC Newgate concerns waves land too`, secR === exp.secIss, `${secR}/${exp.secIss}`);
check("the facet lists exactly the iss-bearing waves",
  counts1.length === exp.nIssAll, `${counts1.length}/${exp.nIssAll}`);

// 2: the tally denominates against the archive's full extent
const issTally = await tallyOf(page1);
check("Issues tally counts against the full archive",
  !!issTally && issTally.shown === exp.nIssAll && issTally.of === exp.nAll,
  issTally ? issTally.text : "no .rd-ap-count");

// 3: the facet's scope self-arms. The rd view hides auto pills by design
// (shownPills filters !f.auto — the facet tab itself carries the scope), so
// the armed scope is read off the tally instead: a scoped subset of the
// full archive, which the tally check above has already pinned. Here: the
// hidden "With issues figures" auto pill must NOT leak into the rd pills
// strip (parity with the Direction facet).
const pillLeak = await page1.evaluate(() =>
  [...document.querySelectorAll(".rd-ap-pill")].map((n) => n.textContent.trim()).find((t) => /With issues figures/.test(t)) || null);
check("the scope stays implicit (no leaked auto pill — parity with Direction facet)",
  pillLeak === null, pillLeak ? `leaked: ${pillLeak}` : "clean");

// 4: the row is the direction facet's grammar — three one-line issue
// readings, the party-ownership dot strip, the rail verdict. Top/2nd/3rd
// are figure-over-label rd-ap-dnum cells; the picture column draws the
// wave's as-printed best-party shares as dots on the shared 0–45 scale;
// the rail cell names the winner. A best-party-only wave (Resolve's)
// rightly shows three dash cells under the strip. The retired stacked
// rd-ap-d2i (the tall-row offender) is pinned absent.
const rowAnatomy = await page1.evaluate(() => {
  const rows = [...document.querySelectorAll(".rd-ap-row")];
  const an = rows.map((r, i) => {
    const nums = [...r.querySelectorAll(":scope > .rd-ap-dnum")];
    const pic = r.querySelector(":scope > .rd-ap-pic");
    const net = r.querySelector(":scope > .rd-ap-netcell");
    return {
      i,
      nNums: nums.length,
      filled: nums.map((n) => !!n.querySelector("b")),
      d2i: !!r.querySelector(".rd-ap-d2i"),
      pic: !!pic,
      dots: pic ? pic.querySelectorAll(".rd-ap-dot").length : 0,
      gls: pic ? pic.querySelectorAll(".rd-ap-gl").length : 0,
      net: !!net,
      netFilled: !!(net && net.querySelector("b")),
    };
  });
  const head = [...(document.querySelectorAll(".rd-ap-hrow > *") || [])].map((h) => (h.textContent || "").trim());
  return {
    rows: rows.length,
    head: head.filter(Boolean),
    headCap: (document.querySelector(".rd-ap-hrow .rd-ap-hpic .rd-ap-cap") || {}).textContent || "",
    headTk: document.querySelectorAll(".rd-ap-hrow .rd-ap-hpic .rd-ap-tk").length,
    notThree: an.filter((a) => a.nNums !== 3).map((a) => a.i),
    runnerNoTop: an.filter((a) => (a.filled[1] || a.filled[2]) && !a.filled[0]).map((a) => a.i),
    d2iLeft: an.filter((a) => a.d2i).map((a) => a.i),
    noPic: an.filter((a) => !a.pic).map((a) => a.i),
    noNet: an.filter((a) => !a.net).map((a) => a.i),
    badDots: an.filter((a) => a.dots > 0 && (a.dots < 2 || a.dots > 4 || a.gls !== 4)).map((a) => a.i),
    dotsNoNet: an.filter((a) => a.dots > 0 && !a.netFilled).map((a) => a.i),
    netNoDots: an.filter((a) => a.netFilled && a.dots === 0).map((a) => a.i),
    withDots: an.filter((a) => a.dots > 0).length,
  };
});
check("every row is three issue cells + the ownership strip + the rail verdict",
  rowAnatomy.notThree.length === 0 && rowAnatomy.noPic.length === 0 && rowAnatomy.noNet.length === 0,
  `three-cells off: ${rowAnatomy.notThree.join(",") || "none"} · strip missing: ${rowAnatomy.noPic.join(",") || "none"} · rail missing: ${rowAnatomy.noNet.join(",") || "none"}`);
check("the stacked 2nd/3rd cell is gone (the facet's tall-row offender)",
  rowAnatomy.d2iLeft.length === 0, `left on: ${rowAnatomy.d2iLeft.join(",") || "none"}`);
check("the ownership strip draws 2–4 party dots over 4 gridlines, verdict beside them",
  rowAnatomy.withDots > 0 && rowAnatomy.badDots.length === 0 && rowAnatomy.dotsNoNet.length === 0 && rowAnatomy.netNoDots.length === 0,
  `${rowAnatomy.withDots}/${rowAnatomy.rows} dotted; bad ${rowAnatomy.badDots.join(",") || "none"}; dots-without-verdict ${rowAnatomy.dotsNoNet.join(",") || "none"}; verdict-without-dots ${rowAnatomy.netNoDots.join(",") || "none"}`);
check("a row naming a 2nd or 3rd issue always fills its top-issue cell",
  rowAnatomy.runnerNoTop.length === 0, `rows off: ${rowAnatomy.runnerNoTop.join(",") || "none"}`);
check("the column head names the scale the strip draws on",
  rowAnatomy.head.includes("2nd") && rowAnatomy.head.includes("3rd")
    && rowAnatomy.headCap === "Best"
    && rowAnatomy.headTk === 4,
  rowAnatomy.headCap + ` · ticks ${rowAnatomy.headTk}`);

// 5: Ipsos never leaves the facet (no VI, no leadership rows to stand on)
console.log("== Ipsos stays put ==");
for (const [lab, re] of [["2PP", /^2PP$/], ["Primary", /^Primary$/], ["Leaders", /^Leaders(?:hip)?$/], ["Direction", /^Direction$/]]) {
  await pickFacet(page1, re);
  await showAll(page1);
  const t = await tallyOf(page1);
  const withIpsos = (await pollsterCounts(page1)).filter((w) => /^Ipsos/.test(w)).length;
  check(`${lab} facet carries no Ipsos rows`, withIpsos === 0, withIpsos ? `${withIpsos} bled through` : "clean");
  check(`${lab} tally still denominates against the full archive`,
    !!t && t.of === exp.nAll, t ? t.text : "no .rd-ap-count");
}
// 5b: row-height parity — the facet walk pins the table on constant row
// geometry, so every facet's poll rows must measure identically (the
// stacked 2nd/3rd cell once left Issues rows ~20px past the 58px contract
// and this facet's landings drifted under the reader)
console.log("== row-height parity across facets ==");
const rowHeightMedians = {};
for (const [lab, re] of [["issues", /^Issues$/], ["twopp", /^2PP$/], ["primary", /^Primary$/], ["leadership", /^Leaders(?:hip)?$/], ["direction", /^Direction$/]]) {
  await pickFacet(page1, re);
  await showAll(page1);
  rowHeightMedians[lab] = await page1.evaluate(() => {
    const hs = [...document.querySelectorAll(".rd-ap-row")].map((r) => r.getBoundingClientRect().height).sort((a, b) => a - b);
    return hs.length ? hs[Math.floor(hs.length / 2)] : null;
  });
}
const hVals = Object.values(rowHeightMedians).filter((v) => v != null);
const hSpread = hVals.length ? Math.max(...hVals) - Math.min(...hVals) : null;
check("poll rows stand at the same height on every facet",
  hVals.length === 5 && hSpread <= 0.75,
  Object.entries(rowHeightMedians).map(([l, v]) => `${l} ${v == null ? "?" : v.toFixed(2)}`).join(" · "));

// back to Issues for the detail passes
await pickFacet(page1, /^Issues$/);
await showAll(page1);

// 6: opened Ipsos row — salience grid + issues rail, no 2PP anywhere
console.log("== opened rows: the issues rail ==");
const ipD = await openRowContaining(page1, /^Ipsos/);
check("an Ipsos row opens with its salience bars grid",
  !!ipD && ipD.issRows >= 5 && ipD.grids.some((g) => /The issues voters name/.test(g)),
  ipD ? `${ipD.issRows} iss rows, ${ipD.grids.length} grids` : "no detail");
check("Ipsos rail carries the issues facts, no 2PP",
  !!ipD && ipD.railSvg && /Asked/.test(ipD.rail) && /most capable of managing/.test(ipD.rail)
    && /usual lean/.test(ipD.rail) && /In today.{0,4}s panel/.test(ipD.rail) && !/Labor’s/.test(ipD.rail),
  ipD ? `${ipD.rail.slice(0, 240)} | svg:${ipD.railSvg}` : "no detail");
check("Ipsos detail shows no matchup grid and no primary chips",
  !!ipD && !ipD.grids.join(" ").includes("Implied, on 2025 flows") && !ipD.grids.join(" ").includes("Primary vote, %"),
  ipD ? "grids: " + ipD.grids.length : "no detail");

// 7: opened SEC row — unprompted concerns, kept out of the pooled series
const secD = await openRowContaining(page1, /^SEC Newgate/);
check("a SEC row shows the unprompted concerns block, flagged as not pooled",
  !!secD && secD.grids.some((g) => /Named without prompting/.test(g))
    && secD.notes.some((n) => /any mentions|can’t sit beside/.test(n)),
  secD ? secD.notes.join(" · ").slice(0, 120) : "no detail");
// SEC's any-mentions can pool into ownership (hence its usual-lean fact)
// but never into the salience pair-lean ("Between the question forms").
check("SEC issues rail says unprompted, and never touches the salience pair-lean",
  !!secD && /unprompted/.test(secD.rail) && !/question forms/.test(secD.rail),
  secD ? secD.rail.slice(0, 160) : "no detail");

// 8: an opened VI+issues row — issues rail, no 2PP rail chart
const hs = await page1.evaluate(() => [...new Set([...document.querySelectorAll(".rd-ap-row")]
  .map((r) => (r.querySelector("[role='rowheader'] b") || {}).textContent || "Ipsos"))]);
const viHouse = hs.find((h) => !/^Ipsos|^SEC/.test(h)) || "RedBridge";
const viD = await openRowContaining(page1, new RegExp("^" + viHouse));
check(`a ${viHouse} wave's issues rail swaps the 2PP chart for the pooled issues line`,
  !!viD && !/Labor’s/.test(viD.rail) && /Asked/.test(viD.rail),
  viD ? viD.railCtrl || viD.rail.slice(0, 140) : "no detail");
check(`${viHouse} pools its top issue against the other house (pair / lean / panel facts)`,
  !!viD && /question forms|usual lean|In today.{0,4}s panel/.test(viD.rail),
  viD ? viD.keys.join(" | ") : "no detail");

// 8b: the mini-chart wave dots are drawn on the SAME basis as the pooled
// line — three-party shares summing to ~100 (the as-printed payload sums
// well under; that was the always-low-dots bug, fixed in RdApIssMini)
const dotVals = await page1.evaluate(() => {
  const d = document.querySelector(".rd-ap-open .rd-apd");
  const svg = d && d.querySelector(".rd-apd-mini svg");
  if (!svg) return null;
  const axes = [...svg.querySelectorAll(".rd-apd-ax")].map((t) => ({ v: +t.textContent, y: +t.getAttribute("y") - 4 }));
  const two = axes.filter((a) => isFinite(a.v));
  if (two.length < 2) return null;
  two.sort((a, b) => a.y - b.y); // higher y = lower value
  const pxPerUnit = (two[two.length - 1].y - two[0].y) / (two[0].v - two[two.length - 1].v);
  const vOf = (cy) => two[0].v + (two[0].y - cy) / pxPerUnit;
  // each point draws as halo+dot pairs of circles sharing a cy
  const cys = [...new Set([...svg.querySelectorAll("circle")].map((c) => +c.getAttribute("cy")))];
  return cys.map(vOf);
});
const dotSum = dotVals && dotVals.length ? dotVals.reduce((a, b) => a + b, 0) : null;
check("the wave’s own dots sit on the three-party basis (sum to ~100, like the pooled line)",
  dotSum != null && Math.abs(dotSum - 100) < 2.5,
  dotSum == null ? "no dots" : `dots sum to ${dotSum.toFixed(1)}`);

// 8c: the wave dot's x is the fieldwork MIDPOINT (gen-data's fmid), not the
// release stamp — the pooled line is fieldwork-timed, so release-date x
// hung every dot ~3 days right of the window it claimed. Ipsos is the
// sharpest case: no `published`, years of rows whose released = close of
// fieldwork (2–7 Dec → 4th vs 7th at the dot).
await openRowContaining(page1, /^Ipsos/);
const xOf = await page1.evaluate(() => {
  const D = window.AUSPOL;
  const d = document.querySelector(".rd-ap-open .rd-apd");
  const svg = d && d.querySelector(".rd-apd-mini svg");
  if (!svg) return null;
  const cand = (D.issuesOnlyPolls || []).filter((q) => /Ipsos/.test(q.pollster))
    .sort((a, b) => a.x - b.x).pop();
  if (!cand || !cand.fmid) return { err: cand ? "row has no fmid" : "no Ipsos candidate" };
  const iM = D.MONTHS.indexOf(cand.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const days = (iso) => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
  const t0 = days(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const W = +svg.getAttribute("viewBox").split(" ")[2];
  const Xf = (iso) => 30 + ((days(iso) - t0) / (t1 - t0)) * (W - 16 - 30);
  /* one wave dot per party, all at the same cx (halo+dot pairs) */
  const cxs = [...new Set([...svg.querySelectorAll("circle")].map((c) => +c.getAttribute("cx")))];
  if (cxs.length !== 1) return { err: "cx spread: " + cxs.join(",") };
  return {
    cx: cxs[0], expMid: Xf(cand.fmid), expRel: Xf(cand.released),
    field: cand.field, fmid: cand.fmid, released: cand.released,
  };
});
check("the wave dot sits at its fieldwork midpoint, not its release stamp",
  !!xOf && !xOf.err && Math.abs(xOf.cx - xOf.expMid) < 2 && Math.abs(xOf.cx - xOf.expRel) > 2,
  xOf ? (xOf.err || `${xOf.field}: cx ${xOf.cx.toFixed(1)} | mid ${xOf.expMid.toFixed(1)} | released ${xOf.expRel.toFixed(1)}`) : "no svg");

check("no page errors on the desktop pass", errs1.length === 0, errs1[0] || "");
await page1.close();

// ----------------------------------------------------------------- ?f=i URL
console.log("== ?f=i deep link ==");
const page2 = await browser.newPage();
await page2.setViewport({ width: vw, height: vh });
await page2.goto(`${PAGE}?f=i#allpolls`, { waitUntil: "domcontentloaded" });
await page2.waitForSelector(".rd-ap-row, .rd-ap-card", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 700));
await showAll(page2);
const urlActive = await page2.evaluate(() =>
  ([...document.querySelectorAll(".rd-ap-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent || null);
const urlCounts = await pollsterCounts(page2);
check("?f=i lands on the Issues tab", urlActive === "Issues", `active: ${urlActive}`);
check("?f=i mounts the full iss row set", urlCounts.length === exp.nIssAll, `${urlCounts.length}/${exp.nIssAll}`);
await page2.close();

// --------------------------------------------------------------------- phone
console.log("== phone rung (390px) ==");
const page3 = await browser.newPage();
await page3.setViewport({ width: 390, height: 844 });
const errs3 = [];
page3.on("pageerror", (e) => errs3.push(String(e)));
await page3.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
await page3.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));
await pickFacet(page3, /^Issues$/);
await page3.waitForSelector(".rd-ap-card", { timeout: 15000 });
await showAll(page3);

// Same contract as the desktop rows: a card carries a "2nd … · 3rd …"
// csub iff its top-issue cell is filled (best-party-only waves rightly
// have neither), figures sitting beside each issue's name; cards with an
// ownership reading carry the desktop picture column's phone rung — the
// party-dot strip under the pinned scale.
const cardAnatomy = await page3.evaluate(() => {
  const cards = [...document.querySelectorAll(".rd-ap-card")];
  const an = cards.map((c) => {
    const runnerSub = [...c.querySelectorAll(".rd-ap-csub")].find((d) => /^2nd /.test(d.textContent)) || null;
    const txt = runnerSub ? runnerSub.textContent.trim().replace(/\s+/g, " ") : "";
    const digitFigs = runnerSub ? [...runnerSub.querySelectorAll("b")].filter((b) => /\d/.test(b.textContent || "")).length : 0;
    const runnerOk = !runnerSub || (/^2nd [^·]+?\d/.test(txt) && (!/3rd/.test(txt) || / · 3rd [^·]+?\d/.test(txt)) && digitFigs >= 1);
    const topFilled = /\d/.test((c.querySelector(".rd-ap-pairfig") || {}).textContent || "");
    return { nxt: !!runnerSub, runnerOk, topFilled, dots: c.querySelectorAll(".rd-ap-cpic .rd-ap-pic .rd-ap-dot").length };
  });
  return {
    cardsN: cards.length,
    withNxt: an.filter((a) => a.nxt).length,
    nxtNoTop: an.filter((a) => a.nxt && !a.topFilled).length,
    badNxt: an.filter((a) => !a.runnerOk).length,
    withDots: an.filter((a) => a.dots > 0).length,
    badDots: an.filter((a) => a.dots > 0 && (a.dots < 2 || a.dots > 4)).length,
    ipsos: cards.filter((c) => /Ipsos/.test(c.textContent)).length,
  };
});
check("phone: the 2nd/3rd csub keeps its figures beside the issue names, under a filled top issue",
  cardAnatomy.withNxt > 0 && cardAnatomy.nxtNoTop === 0 && cardAnatomy.badNxt === 0,
  `${cardAnatomy.withNxt}/${cardAnatomy.cardsN} with the csub; topless ${cardAnatomy.nxtNoTop}; bad ${cardAnatomy.badNxt}`);
check("phone: the ownership dot strip rides the cards whose wave asked the question",
  cardAnatomy.withDots > 0 && cardAnatomy.badDots === 0,
  `${cardAnatomy.withDots}/${cardAnatomy.cardsN} cards dotted, ${cardAnatomy.badDots} malformed`);
check("phone: the Ipsos cards are there", cardAnatomy.ipsos === exp.issOnly, `${cardAnatomy.ipsos}/${exp.issOnly}`);

const ipPhone = await openRowContaining(page3, /^Ipsos/);
check("phone: an opened Ipsos card stacks to one column with the salience grid",
  !!ipPhone && ipPhone.issRows >= 5 && /Asked/.test(ipPhone.rail) && !/Labor’s/.test(ipPhone.rail),
  ipPhone ? `${ipPhone.issRows} iss rows` : "no detail");
// The phone pinned head runs the same scale grammar as desktop: the
// caption names the dot strip's measure; the 0-30 tick ladder sits under it
// (the pdx scale still runs to 45, so a share over 30 draws past the last
// line - the sanctioned overflow).
const phoneHead = await page3.evaluate(() => {
  const ph = document.querySelector(".rd-ap-phead");
  if (!ph) return { cap: "", ticks: 0 };
  return { cap: (ph.querySelector(".rd-ap-cap") || {}).textContent || "", ticks: ph.querySelectorAll(".rd-ap-tk").length };
});
check("phone: the pinned head carries the issues scale caption and 0-30 ticks",
  phoneHead.cap === "Best on the top issue, %" && phoneHead.ticks === 4,
  JSON.stringify(phoneHead));
check("no page errors on the phone rung", errs3.length === 0, errs3[0] || "");
await page3.close();

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
