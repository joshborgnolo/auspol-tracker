/* Poll-detail typography pass (2026-09-03, second critique of the expanded
   breakdown): the panel was one flat run of 14px sentences with 16px figures.
   It is now three voices — a provenance LIST, tracked upper-case KICKERS over
   ruled sections, and FIGURES that step above the words carrying them.

   Everything hangs off four tokens on .poll-detail, so this asserts the
   tokens' effects rather than a table of hard-coded rules:
     --pd-lab   118px  provenance label column (both grids share it)
     --pd-body   16px  the sentences
     --pd-fig    22px  every published figure
     --pd-hero   40px  the first head-to-head only
   plus the kicker (10.5px / 600 / uppercase / tracked), the meta pair
   (11.5px label, 14px value), the basis caption (14px, 18px figure), and the
   700px reading measure the ruled sections are set to.

   Row expansion: the Latest table renders ~8 rows immediately; click the
   .exp-btn toggle, .poll-detail mounts. The archive is behind the All-polls
   tab. Row 1 of the archive is a multi-matchup wave, which is what proves the
   hero step applies to the FIRST pair and to nothing else. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8741, "127.0.0.1", ok));

let failures = 0;
const check = (label, got, want) => {
  if (got === want) { console.log(`  ok   ${label} = ${want}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}: got ${got}, want ${want}`);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1280, height: 900 } });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto("http://127.0.0.1:8741/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".exp-btn", { timeout: 30000 });
  await page.click(".exp-btn");
  await page.waitForSelector(".poll-detail .pd-sec-lead", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  const t = await page.evaluate(`(() => {
    const p = document.querySelector(".poll-detail");
    const px = (el) => el ? getComputedStyle(el).fontSize : null;
    const st = (sel) => { const el = p.querySelector(sel); return el ? getComputedStyle(el) : null; };
    const k = st(".pd-sec .pd-k");
    const lead = p.querySelector(".pd-sec-lead");
    const hero = lead.querySelector("p.pd-s-hero");
    return {
      kSize: k && k.fontSize, kWeight: k && k.fontWeight,
      kCase: k && k.textTransform, kTracked: k && parseFloat(k.letterSpacing) > 0.9,
      secRule: st(".pd-sec").borderTopStyle,
      metaK: px(p.querySelector(".pd-meta-k")),
      metaV: px(p.querySelector(".pd-meta-v")),
      /* one label column for BOTH provenance grids - the band the table
         builds and the release rows the shared ledger builds */
      labCols: [...p.querySelectorAll(".pd-meta-items")]
                 .map((g) => getComputedStyle(g).gridTemplateColumns.split(" ")[0]),
      relRows: p.querySelectorAll(".pd-rel .pd-meta-i").length,
      heroWords: px(hero), heroFig: px(hero && hero.querySelector("b")),
      bodyWords: px(p.querySelector(".pd-sec:not(.pd-sec-lead) .pd-s")),
      bodyFig: px(p.querySelector(".pd-sec:not(.pd-sec-lead) .pd-s b")),
      basis: px(p.querySelector(".pd-s-basis")),
      basisFig: px(p.querySelector(".pd-s-basis b")),
      netFig: px(p.querySelector(".pd-s .netv")),
      chg: px(p.querySelector(".pd-s:not(.pd-s-hero) .chg")),
      heroChg: px(hero && hero.querySelector(".chg")),
      absent: px(p.querySelector(".pd-sec .pd-absent")),
      grpWrap: getComputedStyle(p.querySelector(".pd-grp")).whiteSpace,
      /* the move now carries direction in colour, and "no move" stays out of
         the pair - all three read off the .chg-up/.chg-down tokens */
      chgUp: (() => { const e = p.querySelector(".chg.up"); return e && getComputedStyle(e).color; })(),
      chgDown: (() => { const e = p.querySelector(".chg.down"); return e && getComputedStyle(e).color; })(),
      chgFlat: (() => { const e = p.querySelector(".chg.flat"); return e && getComputedStyle(e).color; })(),
      /* .pd-k is set in --ink-3, so it is the resolved rgb() to compare
         against - reading the custom property back gives an oklch() string
         that never equals a computed color */
      inkThree: getComputedStyle(p.querySelector(".pd-k")).color,
      /* every move is parenthesised - none is comma-led */
      commaLedMove: /,\s*[▲▼–]/.test(p.textContent),
      /* the figure/label junction is wider than a bare word-space, and the
         gap BETWEEN two pairs is wider still */
      gaps: (() => {
        const sec = [...p.querySelectorAll(".pd-sec")]
          .find((x) => /First preferences/i.test(x.querySelector(".pd-k").textContent));
        const g = [...sec.querySelectorAll(".pd-grp")];
        const r = (el) => el.getBoundingClientRect();
        const inner = r(g[0].querySelector("b")).left - r(g[0].querySelector(".pd-lab")).right;
        const between = r(g[1]).left - r(g[0]).right;
        return { inner: Math.round(inner), between: Math.round(between) };
      })(),
      measure: Math.round(p.querySelector(".pd-simple").getBoundingClientRect().width),
      leadSections: p.querySelectorAll(".pd-sec-lead").length,
      heroLines: lead.querySelectorAll("p.pd-s-hero").length,
    };
  })()`);
  console.log(t);
  check("kicker size", t.kSize, "10.5px");
  check("kicker weight", t.kWeight, "600");
  check("kicker upper case", t.kCase, "uppercase");
  check("kicker tracked", t.kTracked, true);
  check("each section is ruled", t.secRule, "solid");
  check("meta label", t.metaK, "11.5px");
  check("meta value", t.metaV, "14px");
  check("one label column for every provenance grid",
        new Set(t.labCols).size === 1 && t.labCols[0] === "118px", true);
  check("release rides the provenance list", t.relRows > 0, true);
  check("hero words", t.heroWords, "18px");
  check("hero figure", t.heroFig, "40px");
  check("hero move", t.heroChg, "13px");
  check("body words", t.bodyWords, "16px");
  check("body figure", t.bodyFig, "22px");
  check("net takes the figure size", t.netFig, "22px");
  check("basis caption", t.basis, "14px");
  check("basis figure sits under the section's", t.basisFig, "18px");
  check("move", t.chg, "11px");
  check("absent line takes the body size", t.absent, "16px");
  check("figure and its label never break apart", t.grpWrap, "nowrap");
  check("a rise is green", t.chgUp && t.chgUp !== t.inkThree, true);
  check("a fall is red, and not the same colour as a rise", t.chgDown && t.chgDown !== t.chgUp, true);
  check("no move stays neutral", !t.chgFlat || t.chgFlat === t.inkThree, true);
  check("no move is ever comma-led", t.commaLedMove, false);
  // a bare space at 16px IBM Plex Sans measures ~4.4px; the junction carries a
  // word-spacing supplement on top of it, the run between pairs carries more
  check("figure/label junction beats a bare word-space", t.gaps.inner >= 6, true);
  check("gap between pairs beats the gap inside one",
        t.gaps.between > t.gaps.inner, true);
  check("ledger set to the reading measure", t.measure, 700);
  check("exactly one lead section", t.leadSections, 1);
  check("at most one hero line", t.heroLines <= 1, true);

  // the second consumer: All-polls archive expansion. Row 1 carries three
  // matchups, so it is the one that proves the hero applies to the first only.
  await page.evaluate(`
    ([...document.querySelectorAll('button, a')].find((el) =>
      /^all polls$/i.test(el.textContent.trim())) || {}).click?.()`);
  await page.waitForSelector(".poll-table.archive .poll-row", { timeout: 30000 });
  await page.evaluate(`document.querySelectorAll(".exp-btn")[1].click()`);
  await page.waitForSelector(".poll-table.archive .poll-detail .pd-sec-lead", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));
  const arch = await page.evaluate(`(() => {
    const p = document.querySelector(".poll-detail");
    const px = (el) => el ? getComputedStyle(el).fontSize : null;
    const lead = p.querySelector(".pd-sec-lead");
    const lines = [...lead.querySelectorAll("p.pd-s:not(.pd-s-basis)")];
    return {
      matchups: lines.length,
      heroFig: px(lines[0].querySelector("b")),
      restFig: lines.slice(1).map((l) => px(l.querySelector("b"))),
      kicker: px(p.querySelector(".pd-k")),
      controlsDocked: (() => {
        const band = p.querySelector(".pd-meta"), tail = p.querySelector(".pd-meta-tail");
        return !!tail && tail.getBoundingClientRect().right
               > band.getBoundingClientRect().right - 40;
      })(),
    };
  })()`);
  console.log(arch);
  check("archive shows every matchup", arch.matchups > 1, true);
  check("archive hero figure", arch.heroFig, "40px");
  check("supporting matchups step down",
        arch.restFig.every((s) => s === "22px"), true);
  check("archive kicker", arch.kicker, "10.5px");
  check("controls stay docked to the band's right edge", arch.controlsDocked, true);

  /* The narrow ladder. .ap-wrap is overflow:visible so an over-wide panel
     pushes the PAGE sideways - the nowrap figure/label groups are the new
     way that could happen, so every archive row is opened at phone width and
     the document is measured. */
  await page.setViewport({ width: 375, height: 900 });
  await new Promise((r) => setTimeout(r, 400));
  const n = await page.evaluate(`document.querySelectorAll(".exp-btn").length`);
  let worst = 0;
  for (let i = 0; i < n; i++) {
    await page.evaluate(`document.querySelectorAll(".exp-btn")[${i}].click()`);
    await new Promise((r) => setTimeout(r, 40));
    const w = await page.evaluate(`document.documentElement.scrollWidth`);
    if (w > worst) worst = w;
    await page.evaluate(`document.querySelectorAll(".exp-btn")[${i}].click()`);
  }
  check(`no panel of ${n} pushes the page sideways at 375px`, worst <= 375, true);
  if (worst > 375) console.log(`       widest document: ${worst}px`);
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
