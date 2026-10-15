/* rd-tpp-cmp: the 2PP chart card's "Compare" checkbox group (2026-10-15).
   The pair ("Published 2PP"/"Implied 2PP" + "Outside estimates") rides one
   .rd-tpp-cmp group under a "Compare" lead-in: inside the range-tabs row on
   a laptop, on its own row above the chart on a phone. Asserts headlessly:
   - the group's HOME per width (in .rd-tabs ≥641px; a direct card child
     after the tabs and before .rd-chead ≤640px), and no bare label.rd-check
     remains a direct child of the card,
   - the drawn box: 16px, authored 1.5px border, 3px radius, transparent at
     rest, var(--ink-2) filled with a ::after tick when checked,
   - text sizes: 14px checks beside the range tabs, 13px on a phone,
   - the pair never splits a line at ANY width ≥360; at ≤340 the second
     item wraps alone, the lead-in and first item stay together, and the
     min-height rung holds the group at the two-line height, so flipping to
     the one-item Labor v One Nation contest never moves the row,
   - the row's y AND height hold within 1px across a contest flip (chip
     click and SPACE bar) at every rung,
   - the basis flip swaps the first item's label to "Implied 2PP",
   - a ticked phone view lists the extras only in the top legend, never
     again in the key below (laptop keeps them in the key),
   - no horizontal document overflow at any rung,
   - /vic/ renders the group (single basis item) without overflow,
   - ?design=old is untouched: no .rd-tpp-cmp exists there.

   Serves a SNAPSHOT of index.html + vic/index.html + fonts out of /tmp so a
   sibling session's rebuilds can't move the floor mid-probe (a shared main
   checkout's build folds every working-tree change in). Row geometry is
   measured scroll-invariant (rect.top + scrollY): Space claims the key only
   while the hero owns the viewport, so the flip step parks where ONLY
   #two-party claims (gotcha 4 of auspol-spacebar-viewport-claim), blurs any
   click-focused control first, and asserts the contest actually changed so
   a swallowed key can't pass vacuously.
   NOTE: headless Chrome matches no (pointer: coarse) media, so the 18px
   touch glyph is asserted by source rule, not pixels. Chrome's used-value
   border-width rounding varies by window width (1.5px reads back 1px on
   some phone rungs) — the pin is the authored rule text plus a ±0.6
   computed tolerance. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

/* snapshot the page + the files it touches so sibling rebuilds can't
   interleave with the run */
const SNAP = fs.mkdtempSync(path.join(os.tmpdir(), "rd-tpp-cmp-"));
fs.mkdirSync(path.join(SNAP, "vic"), { recursive: true });
fs.mkdirSync(path.join(SNAP, "assets", "fonts"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(SNAP, "index.html"));
fs.copyFileSync(path.join(ROOT, "vic", "index.html"), path.join(SNAP, "vic", "index.html"));
for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts")))
  fs.copyFileSync(path.join(ROOT, "assets", "fonts", f), path.join(SNAP, "assets", "fonts", f));
process.on("exit", () => { try { fs.rmSync(SNAP, { recursive: true, force: true }); } catch {} });
console.log("snapshot of index.html mtime " + fs.statSync(path.join(ROOT, "index.html")).mtime.toISOString());

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  p = path.join(SNAP, p);
  if (!p.startsWith(SNAP) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "  ok  " : " FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* one geometry+state read of everything the width assertions need; all
   verticals are SCROLL-INVARIANT (viewport top + scrollY) */
const readGroup = () => page.evaluate(() => {
  const sy = window.scrollY;
  const card = document.querySelector(".rd-tpp-chart");
  const g = card && card.querySelector(".rd-tpp-cmp");
  if (!card || !g) return { present: false };
  const R = (el) => el ? el.getBoundingClientRect() : null;
  const ry = (r) => r ? { top: +(r.top + sy).toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1),
                          h: +r.height.toFixed(1) } : null;
  const labs = [...g.querySelectorAll("label.rd-check")];
  const boxes = labs.map((l) => l.querySelector("input"));
  const cs = (el) => getComputedStyle(el);
  const inTabs = !!g.closest(".rd-tabs");
  const tabs = card.querySelector(".rd-tabs");
  const chead = card.querySelector(".rd-chead");
  const bare = [...card.children].filter((c) => c.classList && c.classList.contains("rd-check")).length;
  const domAfter = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const inp = boxes[0];
  const st = inp ? cs(inp) : null;
  const tick = boxes[1] || boxes[0];
  const tickedStyle = (() => {
    if (!tick) return null;
    const was = tick.checked;
    if (!was) tick.click();
    const on = cs(tick);
    const after = getComputedStyle(tick, "::after");
    const out = { bg: on.backgroundColor, border: on.borderColor,
                  mask: after.webkitMaskImage || after.maskImage };
    if (!was) tick.click();
    tick.blur();
    return out;
  })();
  /* authored rule text: reliable where Chrome's used-value rounding isn't */
  const authored = [...document.styleSheets].flatMap((s) => {
    try { return [...s.cssRules]; } catch { return []; }
  }).flatMap((r) => (r.media ? [...r.cssRules] : [r]).concat(r.cssRules ? [...r.cssRules] : []))
    .filter((r) => r.selectorText && /rd-check input/.test(r.selectorText))
    .map((r) => r.cssText)
    .join(" ");
  return {
    present: true, inTabs, bare, scrollY: sy,
    dom: {
      afterTabs: domAfter(tabs, g),
      beforeChead: domAfter(g, chead),
    },
    geom: { group: ry(R(g)), tabs: ry(R(tabs)), chead: ry(R(chead)) },
    labelTop: g.querySelector(".rd-tpp-cmp-l") ? +(R(g.querySelector(".rd-tpp-cmp-l")).top + sy).toFixed(1) : null,
    itemTops: labs.map((l) => +(R(l).top + sy).toFixed(1)),
    /* row membership by centre: the 44px tap-target labels and the 18.8px
       lead-in share a flex line while their TOPS differ */
    labelC: g.querySelector(".rd-tpp-cmp-l")
      ? +(R(g.querySelector(".rd-tpp-cmp-l")).top + R(g.querySelector(".rd-tpp-cmp-l")).height / 2 + sy).toFixed(1) : null,
    itemCs: labs.map((l) => +(R(l).top + R(l).height / 2 + sy).toFixed(1)),
    texts: labs.map((l) => l.textContent.trim()),
    leadIn: (g.querySelector(".rd-tpp-cmp-l") || {}).textContent || null,
    aria: g.getAttribute("role") + "|" + g.getAttribute("aria-label"),
    itemFont: labs[0] ? +parseFloat(cs(labs[0]).fontSize).toFixed(1) : null,
    input: st ? { w: +parseFloat(st.width).toFixed(1), h: +parseFloat(st.height).toFixed(1),
                  bw: parseFloat(st.borderTopWidth), br: parseFloat(st.borderTopLeftRadius),
                  bg: st.backgroundColor,
                  appearance: st.appearance || st.webkitAppearance } : null,
    authoredBorder: authored,
    ticked: tickedStyle,
    scrollOK: document.documentElement.scrollWidth <= window.innerWidth + 1,
    docW: document.documentElement.scrollWidth, vw: window.innerWidth,
    nInputs: boxes.length,
  };
});

const contestName = () => page.evaluate(() =>
  (document.querySelector(".rd-tpp-side.rd-b .rd-tpp-name") || {}).textContent || "");

const gotoContest = async (wantB) => {
  for (let i = 0; i < 4; i++) {
    if ((await contestName()).includes(wantB)) return true;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll(".rd-tpp-switch .rd-chip")].find((x) => x.textContent.includes("Labor v"));
      if (b) { b.click(); b.blur(); }
    });
    await sleep(950); // intentional-sleep: the contest morph runs ~320ms
  }
  return false;
};

const setBoxes = async (on) => page.evaluate((want) => {
  const boxes = [...document.querySelectorAll(".rd-tpp-cmp input[type=checkbox]")];
  boxes.forEach((b) => { if (!!b.checked !== want) b.click(); b.blur(); });
  return boxes.length;
}, on);

/* park the page where ONLY the hero's space-claim is live (probe gotcha 4),
   then Space; the caller asserts the contest really stepped, so a swallowed
   key can't pass vacuously */
const flipSpace = async () => {
  await page.evaluate(() => {
    if (document.activeElement) document.activeElement.blur();
    document.getElementById("two-party").scrollIntoView({ block: "center" });
  });
  await sleep(900); // intentional-sleep: the IntersectionObserver claim arms async
  await page.evaluate(() => window.scrollBy(0, 1));
  await sleep(250); // intentional-sleep: observer re-fires after the nudge
  const parkOK = await page.evaluate(() => {
    const out = [];
    for (const id of ["primary-vote", "latest-polls", "who-votes"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out.push(id + ":" + (r.bottom <= 0 || r.top >= innerHeight));
    }
    return { ok: out.every((s) => s.endsWith("true")), out };
  });
  const before = await contestName();
  await page.keyboard.press("Space");
  await sleep(1000); // intentional-sleep: the contest morph runs ~320ms
  const after = await contestName();
  return { parkOK, changed: before !== after, before, after };
};

const WIDTHS = [1280, 1024, 700, 641, 430, 390, 360, 340, 320];

for (const w of WIDTHS) {
  const phone = w <= 640, band = w > 640 && w <= 700, wrapRung = w < 360;
  await page.setViewport({ width: w, height: 950, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-tpp-chart .rd-tpp-cmp", { timeout: 30000 });
  await gotoContest("Coalition");
  const g0 = await readGroup();
  const t = w + "px";
  check(t + ": group present", g0.present);
  if (!g0.present) continue;
  check(t + ": no sideways scroll", g0.scrollOK, "docW=" + g0.docW + " vw=" + g0.vw);
  check(t + ": exactly two boxes", g0.nInputs === 2, g0.nInputs + " inputs");
  check(t + ": labels", g0.texts.join("|") === "Published 2PP|Outside estimates", g0.texts.join("|"));
  check(t + ": lead-in says Compare with the group role", g0.leadIn === "Compare" && g0.aria === "group|Compare", g0.leadIn + " " + g0.aria);
  check(t + ": no bare boxes under the card", g0.bare === 0, g0.bare + " bare");
  check(t + ": drawn box is 16px with a 3px radius, appearance off",
    g0.input && g0.input.w === 16 && g0.input.h === 16 && g0.input.br === 3 && g0.input.appearance === "none",
    g0.input ? JSON.stringify(g0.input) : "?");
  check(t + ": border is authored 1.5px and computes within 0.6",
    /1\.5px/.test(g0.authoredBorder) && Math.abs(g0.input.bw - 1.5) <= 0.6,
    "computed=" + g0.input.bw);
  if (phone) {
    check(t + ": group opens its own row after the tabs, before chead",
      !g0.inTabs && g0.dom.afterTabs && g0.dom.beforeChead,
      "inTabs=" + g0.inTabs + " afterTabs=" + g0.dom.afterTabs + " beforeChead=" + g0.dom.beforeChead);
    check(t + ": phone items are 13px", g0.itemFont === 13, g0.itemFont + "px");
    if (!wrapRung)
      check(t + ": all three pieces share one line",
        g0.itemCs.length === 2 && g0.labelC !== null &&
        Math.abs(g0.itemCs[0] - g0.itemCs[1]) <= 1 && Math.abs(g0.itemCs[0] - g0.labelC) <= 1,
        "labelC=" + g0.labelC + " itemCs=" + g0.itemCs.join(","));
    else {
      check(t + ": lead-in and the first item stay together",
        g0.labelC !== null && Math.abs(g0.itemCs[0] - g0.labelC) <= 1,
        "labelC=" + g0.labelC + " itemC0=" + g0.itemCs[0]);
      check(t + ": wrapped rung holds the reserved two-line 96px",
        Math.abs(g0.geom.group.h - 96) <= 1, "h=" + g0.geom.group.h);
    }
  } else {
    check(t + ": group rides the tabs row", g0.inTabs, "");
    check(t + ": desktop items are 14px beside the range tabs", g0.itemFont === 14, g0.itemFont + "px");
    check(t + ": the pair never splits (one line)", g0.itemTops.length === 2 && g0.itemTops[0] === g0.itemTops[1],
      g0.itemTops.join(","));
    if (band) {
      check(t + ": 641–700 group sits whole (its own line or the tabs line)",
        Math.abs(g0.itemTops[0] - g0.itemTops[1]) < 0.5, g0.itemTops.join(","));
    }
  }
  /* tick: box paints ink-2 with the masked tick */
  check(t + ": ticked box fills and the masked tick shows",
    g0.ticked && g0.ticked.mask.includes("data:image/svg") && g0.ticked.bg !== g0.input.bg,
    g0.ticked ? JSON.stringify(g0.ticked) : "?");
  /* the row must not move on a contest flip */
  const before = g0.geom.group;
  check(t + ": reached Coalition contest OK", await gotoContest("Coalition"));
  const flip = async () => {
    await page.evaluate(() => {
      const other = [...document.querySelectorAll(".rd-tpp-switch .rd-chip")].find((x) => x.textContent.includes("Labor v"));
      if (other) { other.click(); other.blur(); }
    });
    await sleep(950); // intentional-sleep: the contest morph runs ~320ms
  };
  await flip();
  const toName = await contestName();
  check(t + ": chip flip reached the other contest", toName.includes("One Nation"), "now: " + toName);
  const g1 = await readGroup();
  check(t + ": contest flip keeps the row's y and height",
    Math.abs(g1.geom.group.top - before.top) <= 1 && Math.abs(g1.geom.group.h - before.h) <= 1,
    "top " + before.top + "→" + g1.geom.group.top + " h " + before.h + "→" + g1.geom.group.h);
  await flip(); // back to Coalition
  /* space-bar flip also holds the row */
  const s0 = await readGroup();
  const sf = await flipSpace();
  const s1 = await readGroup();
  check(t + ": space-bar parked where only the hero claims", sf.parkOK.ok, sf.parkOK.out.join(" "));
  check(t + ": space-bar actually flips the contest", sf.changed, sf.before + " → " + sf.after);
  check(t + ": space-bar flip keeps the row's y and height",
    Math.abs(s1.geom.group.top - s0.geom.group.top) <= 1 && Math.abs(s1.geom.group.h - s0.geom.group.h) <= 1,
    "top " + s0.geom.group.top + "→" + s1.geom.group.top + " h " + s0.geom.group.h + "→" + s1.geom.group.h);
  /* back to Coalition for the tick phase */
  await gotoContest("Coalition");
  const r0 = await readGroup();
  await setBoxes(true);
  await sleep(450); // intentional-sleep: the overlay series reconcile on the next frames
  const r1 = await readGroup();
  check(t + ": ticking both boxes keeps the row's y and height",
    Math.abs(r1.geom.group.top - r0.geom.group.top) <= 1 && Math.abs(r1.geom.group.h - r0.geom.group.h) <= 1,
    "top " + r0.geom.group.top + "→" + r1.geom.group.top);
  check(t + ": no sideways scroll with both on", r1.scrollOK, "docW=" + r1.docW);
  /* phone: extras listed once (top legend), not again in the key below */
  if (phone) {
    const dupe = await page.evaluate(() => {
      const key = [...document.querySelectorAll(".rd-tpp-chart .rd-ckey .rd-key-item")].map((e) => e.textContent);
      const legend = [...document.querySelectorAll(".rd-tpp-chart .rd-tpp-legend .rd-key-item")].map((e) => e.textContent);
      const extra = (x) => /BludgerTrack|Bonham|As published/.test(x);
      return { inKey: key.filter(extra).length, inLegend: legend.filter(extra).length };
    });
    check(t + ": ticked extras in the top legend only, not the key below", dupe.inLegend >= 3 && dupe.inKey === 0,
      "legend=" + dupe.inLegend + " key=" + dupe.inKey);
  } else {
    const key = await page.evaluate(() =>
      [...document.querySelectorAll(".rd-tpp-chart .rd-ckey .rd-key-item")].filter((e) => /BludgerTrack|Bonham/.test(e.textContent)).length);
    check(t + ": desktop key still names the extras", key === 2, key + " items");
  }
  await setBoxes(false);
  await sleep(300); // intentional-sleep: the overlay series reconcile on the next frames
}

/* ---------------- basis flip swaps the first item's label ---------------- */
await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-tpp-chart .rd-tpp-cmp", { timeout: 30000 });
{
  const before = await readGroup();
  check("basis: first item is Published 2PP on the implied basis", before.texts[0] === "Published 2PP", before.texts[0]);
  /* the "?" lives in .rd-tpp-prov, in the head ABOVE the chart card */
  await page.evaluate(() => {
    const q = document.querySelector(".rd-tpp-prov .rd-qpop");
    if (q && !q.querySelector(".rd-qpanel")) q.querySelector(".rd-qbtn").click();
  });
  await page.waitForSelector(".rd-tpp-prov .rd-qpop .rd-qpanel", { timeout: 10000 });
  await page.evaluate(() => {
    const sw = document.querySelector(".rd-tpp-prov .rd-qpop .rd-qpanel .rd-qrow .rd-switch");
    if (sw) { sw.click(); sw.blur(); }
  });
  await sleep(1000); // intentional-sleep: the basis morph runs ~320ms
  const after = await readGroup();
  check("basis: label flips to Implied 2PP on published figures", after.texts[0] === "Implied 2PP", after.texts[0]);
  await page.evaluate(() => {
    if (document.activeElement) document.activeElement.blur();
    const sw = document.querySelector(".rd-tpp-prov .rd-qpop .rd-qpanel .rd-qrow .rd-switch");
    if (sw) sw.click();
  });
  await sleep(1000); // intentional-sleep: the basis morph runs ~320ms
}

/* ------------------------- vic + the old design ------------------------- */
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/vic/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-tpp-chart", { timeout: 30000 });
{
  const v = await readGroup();
  check("vic: group present on the phone view", v.present === true);
  if (v.present) {
    check("vic: basis item offered, outside estimates absent", v.nInputs >= 1 && !v.texts.includes("Outside estimates"), v.texts.join("|"));
    check("vic: group above the chart head", !v.inTabs && v.dom.afterTabs && v.dom.beforeChead, "");
    check("vic: no sideways scroll", v.scrollOK, "docW=" + v.docW);
  }
}
await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/index.html?design=old`, { waitUntil: "networkidle0", timeout: 60000 });
await sleep(1200); // intentional-sleep: the classic design mounts its own hero
{
  const oldCmp = await page.evaluate(() => !!document.querySelector(".rd-tpp-cmp"));
  const oldHasCompare = await page.evaluate(() =>
    [...document.querySelectorAll("label")].some((l) => /Compare/.test(l.textContent)));
  check("old design: no .rd-tpp-cmp group", oldCmp === false);
  check("old design: its own compare toggle survives", oldHasCompare === true);
}

await browser.close();
server.close();
console.log(fails ? "\n" + fails + " check(s) FAILED" : "\nall checks passed");
process.exit(fails ? 1 : 0);
