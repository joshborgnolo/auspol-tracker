/* Pins the past-cycles summary controls row (.rd-cc-row) phone contract:
   the row's contents measure 544.7px against a 320-387px phone row, so one
   line is impossible - user picked "hide the label, two rows" (rd.css's
   640px block: display:none on .rd-cc-row > .rd-cc-l and > .rd-cc-sep).
   Phone rungs: label+sep hidden, term chips on line 1, Level/Change on
   line 2, no horizontal overflow. 640px rung (media-inclusive): still
   hidden, everything on one line. Desktop: label+sep visible, one line.
   Asserts via the BUILT index.html (read_file cannot do geometry). */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8943;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
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
  headless: "new",
});
const fails = [];
let checks = 0;
const check = (tag, ok, what) => {
  checks++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${tag}: ${what}`);
  if (!ok) fails.push(`${tag}: ${what}`);
};

async function probe(W, H, want) {
  const tag = `${W}x${H}`;
  const page = await browser.newPage();
  page.on("pageerror", (e) => fails.push(`${tag}: PAGEEXCEPTION ${String(e).slice(0, 180)}`));
  await page.setViewport({ width: W, height: H, hasTouch: true });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cyc-summary .rd-cc-row", { timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));

  const m = await page.evaluate(() => {
    const row = document.querySelector("#cyc-summary .rd-cc-row");
    const rr = row.getBoundingClientRect();
    const kids = [...row.children].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        cls: el.className,
        text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
        display: getComputedStyle(el).display,
        w: Math.round(r.width * 10) / 10,
        top: r.top,
        bottom: r.bottom,
        right: Math.round(r.right * 100) / 100,
      };
    });
    return {
      rowW: Math.round(rr.width * 10) / 10,
      rowR: rr.right,
      kids,
    };
  });

  console.log("\n=== " + tag + " ===");
  m.kids.forEach((k, i) => console.log(`  kid[${i}] ${k.cls} ${k.display} w=${k.w} top=${Math.round(k.top * 10) / 10} "${k.text}"`));
  const lbl = m.kids.find((k) => k.cls.includes("rd-cc-l"));
  const sep = m.kids.find((k) => k.cls.includes("rd-cc-sep"));
  const wantHide = want.hideLabel;
  check(tag, (lbl.display === "none") === wantHide, `compare label ${wantHide ? "hidden" : "shown"} (got ${lbl.display})`);
  check(tag, (sep.display === "none") === wantHide, `group separator ${wantHide ? "hidden" : "shown"} (got ${sep.display})`);
  const vis = m.kids.filter((k) => k.display !== "none");
  /* align-items:center — kids of different heights vertically centre within a
     flex line, so "same line" = vertically OVERLAPPING bands, not equal tops */
  const bands = [];
  for (const k of [...vis].sort((a, b) => a.top - b.top)) {
    const last = bands[bands.length - 1];
    if (last && k.top < last.bottom - 1) last.bottom = Math.max(last.bottom, k.bottom), last.kids.push(k);
    else bands.push({ bottom: k.bottom, kids: [k] });
  }
  const lines = bands.length;
  check(tag, lines === want.lines, `visible controls on ${want.lines} line(s) (got ${lines}; ${JSON.stringify(vis.map((k) => Math.round(k.top * 10) / 10))})`);
  const over = vis.filter((k) => k.right > m.rowR + 0.51);
  check(tag, over.length === 0, `no visible control overflows the row right edge (${m.rowW})`);
  if (want.lines === 2) {
    /* both groups are .rd-cc-tabs, and phone drops the " past terms"
       wording to just "All" - the Re-elected chip is the width-stable tell */
    check(tag, bands[0].kids.length === 1 && bands[0].kids[0].text.includes("Re-elected"), "line 1 is the term-chip tabs group");
    check(tag, bands[1].kids.some((k) => k.text.includes("Level")), "line 2 carries the Level/Change group");
  }
  await page.close();
}

await probe(360, 780, { hideLabel: true, lines: 2 });
await probe(390, 844, { hideLabel: true, lines: 2 });
await probe(430, 932, { hideLabel: true, lines: 2 });
await probe(640, 980, { hideLabel: true, lines: 1 });
await probe(1280, 900, { hideLabel: false, lines: 1 });
console.log(`\n${checks - fails.length} passed, ${fails.length} failed`);
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
