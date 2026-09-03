/* Poll-detail typography pass (2026-09-03, responding to critique of the
   expanded breakdown): expand the latest row of the Latest-polls table and
   one archive row, and assert the computed type ladder —
     .pd-k section kicker     11.5px / 600   (was 11px / 700)
     .pd-meta-k meta label    10.5px / 600   (was 700)
     .pd-s body               14px / lh 21   (1.5, was 1.55)
     .poll-detail .chg        10.5px / 600   (was 11px / 700)
     .pd-sec-lead .pd-s > b   16px           (vote-share headline figures)
   Row expansion: the Latest table renders ~8 rows immediately; click the
   .exp-btn toggle, .poll-detail mounts. */
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
    const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
    const pk = cs(".poll-detail .pd-sec .pd-k");
    const mk = cs(".poll-detail .pd-meta-k");
    const ps = cs(".poll-detail .pd-sec-lead .pd-s");
    const chg = document.querySelector(".poll-detail .chg");
    const leadB = document.querySelector(".poll-detail .pd-sec-lead .pd-s > b");
    const bodyB = document.querySelector(".poll-detail .pd-sec:not(.pd-sec-lead) .pd-s b");
    const noteB = document.querySelector(".poll-detail .pd-sec-lead .pd-s .pd-s-note b");
    return {
      kSize: pk && pk.fontSize, kWeight: pk && pk.fontWeight,
      mWeight: mk && mk.fontWeight,
      sLh: ps && ps.lineHeight,
      chgSize: chg && getComputedStyle(chg).fontSize,
      chgWeight: chg && getComputedStyle(chg).fontWeight,
      leadSize: leadB && getComputedStyle(leadB).fontSize,
      bodySize: bodyB && getComputedStyle(bodyB).fontSize,
      noteSize: noteB ? getComputedStyle(noteB).fontSize : "(no note b)",
      leadSections: document.querySelectorAll(".poll-detail .pd-sec-lead").length,
    };
  })()`);
  console.log(t);
  check("kicker size", t.kSize, "11.5px");
  check("kicker weight", t.kWeight, "600");
  check("meta label weight", t.mWeight, "600");
  check("line height", t.sLh, "21px");
  check("chg size", t.chgSize, "10.5px");
  check("chg weight", t.chgWeight, "600");
  check("lead figure size", t.leadSize, "16px");
  check("body figure size", t.bodySize, "14px");
  check("note figure stays body size", t.noteSize === "14px" || t.noteSize === "(no note b)", true);
  check("exactly one lead section", t.leadSections, 1);

  // the second consumer: All-polls archive expansion
  await page.evaluate(`
    ([...document.querySelectorAll('button, a')].find((el) =>
      /all polls/i.test(el.textContent)) || {}).click?.()`);
  await page.waitForSelector(".poll-table.archive .poll-row", { timeout: 30000 });
  await page.click(".poll-table.archive .exp-btn");
  await page.waitForSelector(".poll-table.archive .poll-detail .pd-sec-lead", { timeout: 15000 });
  const arch = await page.evaluate(`(() => {
    const b = document.querySelector(".poll-detail .pd-sec-lead .pd-s > b");
    const k = document.querySelector(".poll-detail .pd-sec .pd-k");
    return { leadSize: b && getComputedStyle(b).fontSize, kWeight: k && getComputedStyle(k).fontWeight };
  })()`);
  console.log(arch);
  check("archive lead figure size", arch.leadSize, "16px");
  check("archive kicker weight", arch.kWeight, "600");
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
