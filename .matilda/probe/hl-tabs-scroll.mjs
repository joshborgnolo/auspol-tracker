/* House-lean measure row — every measure keeps its tab down to the phone
   (2026-10-03). Was: Greens and Others tabs dropped off the row under
   912/985px and their views were unreachable on a phone. Now: all seven
   tabs always render and the row's tab group scrolls sideways with a
   right-edge fade where the seven no longer fit (the .rd-ap-pinnav
   idiom); a view change landing past the strip's edge glides it into
   view via the strip's own scroller only (never the page), and a 24px
   padding runway keeps the last tab clear of the fade at max scroll.
   Sideways ONLY: overflow-y:clip locks the strip's other axis (a bare
   overflow-x:auto computes overflow-y to auto and the strip wobbled
   up and down under a thumb - user report same day).
   Run from the repo root: node .matilda/probe/hl-tabs-scroll.mjs
   Rebuild first (node .build/newtracker/build.mjs) — this probes the
   COMMITTED index.html artifact. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8963;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
  if (!cond) bad++;
};

/* Mount the app fresh at one viewport and open the All-polls tab. The
   width sweep needs a fresh page LOAD per width - one reused tab
   resizing through the ~16kpx document trips scroll-anchoring artefacts
   in the rect reads (frame-margins trap), so each rung gets its own
   page. */
async function atWidth(vw, vh) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh });
  await page.goto(`http://127.0.0.1:${PORT}/#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-hl-tabs .rd-tab", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

async function measure(page) {
  return page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".rd-hl-tabs .rd-tab")];
    const group = document.querySelector('.rd-hl-tabs [role="group"]');
    const row = document.querySelector(".rd-hl-tabs");
    const cs = getComputedStyle(group);
    return {
      views: tabs.map((t) => ({ id: t.textContent, on: t.getAttribute("aria-pressed") === "true",
                                left: t.getBoundingClientRect().left, right: t.getBoundingClientRect().right })),
      gL: group.getBoundingClientRect().left, gR: group.getBoundingClientRect().right,
      rowR: row.getBoundingClientRect().right,
      scrollW: group.scrollWidth, clientW: group.clientWidth,
      scrollH: group.scrollHeight, clientH: group.clientHeight,
      ox: cs.overflowX, oy: cs.overflowY,
      mask: cs.maskImage || cs.webkitMaskImage || "", padR: cs.paddingRight,
      font: tabs.length ? getComputedStyle(tabs[0]).fontSize : "",
      flex: tabs.length ? getComputedStyle(tabs[0]).flexGrow : "",
      winScrollY: window.scrollY,
      winW: document.documentElement.clientWidth,
    };
  });
}

/* one label at every width since 2026-10-03 (user: "One Nation–Coalition
   split") - the phone's bare "Split" and the desktop's "One Nation v
   Coalition" both retired once the row could scroll. The split sits
   SECOND, straight after Two-party (user call same day). */
const EXPECT = ["Two-party", "One Nation–Coalition split", "Labor", "Coalition", "One Nation", "Greens", "Others"];

/* expectScroll: true = the strip must overflow and the reveal test runs;
   false = desktop gate, seven tabs fit with no scroll; null = either is
   legitimate at that width (the fit boundary sits inside the rung band),
   so just log what happened. */
async function rung(vw, vh, expectScroll, expectLabels) {
  const tag = `${vw}px`;
  const page = await atWidth(vw, vh);
  const m = await measure(page);
  ok(`${tag}: seven tabs, right labels`, m.views.length === 7 && m.views.every((v, i) => v.id === expectLabels[i]),
     m.views.map((v) => v.id).join("|"));
  const overflowing = m.scrollW > m.clientW + 1;
  if (vw <= 984) {
    ok(`${tag}: group overflow-x auto`, m.ox === "auto", m.ox);
    /* not user-scrollable vertically: overflow-y must compute hidden or
       clip - a bare overflow-x:auto computes y to auto, and an auto
       strip is drag/rubber-band scrollable, which is the wobble the
       user reported. (clip computes to hidden beside overflow-x:auto
       under CSS Overflow 3 today; either locked value passes.) */
    ok(`${tag}: y-axis not user-scrollable`, m.oy === "hidden" || m.oy === "clip", m.oy);
    ok(`${tag}: vertical slack under a pixel`, m.scrollH - m.clientH <= 1,
       `scrollH ${m.scrollH} clientH ${m.clientH}`);
    ok(`${tag}: right-edge fade mask`, m.mask.includes("linear-gradient"), m.mask || "(none)");
    ok(`${tag}: fade runway`, parseFloat(m.padR) === 24, m.padR);
    ok(`${tag}: tab size/flex`, m.font === (vw <= 760 ? "14px" : "15px") && m.flex === "0",
       `font ${m.font} flexGrow ${m.flex}`);
  } else {
    ok(`${tag}: no scroller at desktop`, m.ox !== "auto", m.ox);
  }
  if (expectScroll === true) ok(`${tag}: strip overflows`, overflowing, `scrollW ${m.scrollW} clientW ${m.clientW}`);
  else if (expectScroll === false) ok(`${tag}: strip fits without scroll`, !overflowing, `scrollW ${m.scrollW} clientW ${m.clientW}`);
  else console.log(`  ..  ${tag}: strip ${overflowing ? "scrolls" : "fits"} (either fine here)  — scrollW ${m.scrollW} clientW ${m.clientW}`);
  /* the strip itself never stretches the page (the page's pre-existing
     narrow-width overflow is elsewhere - pinned as out of scope here) */
  ok(`${tag}: strip stays on-page`, m.rowR <= m.winW + 1, `row right ${m.rowR} vs page ${m.winW}`);

  if (overflowing) {
    /* the glide is only owed when the LAST tab actually sits off the
       strip at rest - near the 985px fit boundary the overflow can be
       a sliver (at 800px it is 11px) with every tab already visible,
       and then the correct behaviour is no motion at all */
    const lastOffStrip = await page.evaluate(() => {
      const g = document.querySelector('.rd-hl-tabs [role="group"]');
      g.scrollLeft = 0;
      const t = [...document.querySelectorAll(".rd-hl-tabs .rd-tab")].at(-1);
      return t.getBoundingClientRect().right > g.getBoundingClientRect().right + 0.5;
    });
    if (!lastOffStrip) {
      console.log(`  ..  ${tag}: last tab already on-strip at rest — glide not owed here`);
    } else {
    /* a view change landing on an off-strip tab must glide it into view
       WITHOUT moving the page (never scrollIntoView). Baseline: press the
       FIRST tab (always on-strip at rest), park the strip's scroll at 0,
       then press the LAST tab, scrolled off right. */
    const before = m.winScrollY;
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".rd-hl-tabs .rd-tab")];
      tabs[0].click();
    });
    await new Promise((r) => setTimeout(r, 200));
    await page.evaluate(() => {
      document.querySelector('.rd-hl-tabs [role="group"]').scrollLeft = 0;
    });
    await new Promise((r) => setTimeout(r, 150));
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".rd-hl-tabs .rd-tab")];
      tabs[tabs.length - 1].click();
    });
    await new Promise((r) => setTimeout(r, 900));
    const n = await measure(page);
    const last = n.views[6];
    ok(`${tag}: last tab pressed`, last.on === true);
    ok(`${tag}: strip scrolled`, n.views[0].left < n.gL - 10, `first tab left ${n.views[0].left.toFixed(1)} vs strip ${n.gL.toFixed(1)}`);
    ok(`${tag}: last tab lands on the runway`, Math.abs(last.right - (n.gR - 24)) < 2,
       `right ${last.right.toFixed(1)} vs ${(n.gR - 24).toFixed(1)} expected`);
    ok(`${tag}: page did not scroll`, Math.abs(n.winScrollY - before) < 1, `scrollY ${before} -> ${n.winScrollY}`);
    /* and back: stepping to the FIRST tab glides the strip home */
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".rd-hl-tabs .rd-tab")];
      tabs[0].click();
    });
    await new Promise((r) => setTimeout(r, 900));
    const o = await measure(page);
    ok(`${tag}: strip glides back`, Math.abs(o.views[0].left - o.gL) < 2, `first tab left ${o.views[0].left.toFixed(1)} vs strip ${o.gL.toFixed(1)}`);
    }
  }
  await page.close();
}

await rung(390, 844, true, EXPECT);                 // phone
await rung(360, 800, true, EXPECT);                 // small phone
await rung(800, 1024, null, EXPECT);                // the 761-984 band
await rung(1100, 900, false, EXPECT);               // desktop gate

await browser.close();
server.close();
console.log(bad ? `\n${bad} FAILED` : "\nALL CHECKS PASSED");
process.exit(bad ? 1 : 0);
