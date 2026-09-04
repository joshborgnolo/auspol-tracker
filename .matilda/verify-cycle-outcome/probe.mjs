/* Past cycles: the board cut by what each government did at its own election.

   A term's outcome is DERIVED from the run of CYCLE_DEFS - a government was
   returned when the next term is governed by the same party - so this probe
   checks the derivation against the actual history rather than against the
   code that produced it. Get this wrong and the tab quietly libels a
   government, which is worse than a layout bug.

   The sitting term has no next term, so no outcome: it is in neither set. */
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

/* The record, written out rather than computed: every term since 1987 and
   whether its government survived the election that ended it. */
const RETURNED = [1987, 1990, 1996, 1998, 2001, 2007, 2013, 2016, 2022];
const OUSTED   = [1993, 2004, 2010, 2019];
const SITTING  = 2025;

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
await new Promise((ok) => server.listen(8746, "127.0.0.1", ok));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1280, height: 1000 } });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto("http://127.0.0.1:8746/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(`(() => { const b = [...document.querySelectorAll("button,a")]
    .find((x) => /^Past cycles$/i.test(x.textContent.trim())); if (b) b.click(); })()`);
  await page.waitForSelector(".cyc-chip", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1800));

  const onBoard = () => page.evaluate(`[...document.querySelectorAll(".cyc-chip")]
    .filter((c) => !c.className.includes("off"))
    .map((c) => +c.querySelector(".cyc-year").textContent).sort((a, b) => a - b)`);
  const label = () => page.evaluate(`(() => { const b = [...document.querySelectorAll(".cyc-showall")]
    .find((x) => /governments only/.test(x.textContent)); return b ? b.textContent.trim() : null; })()`);
  const press = () => page.evaluate(`(() => { const b = [...document.querySelectorAll(".cyc-showall")]
    .find((x) => /governments only/.test(x.textContent)); b.click(); return true; })()`);
  const pressAll = () => page.evaluate(`(() => { const b = [...document.querySelectorAll(".cyc-showall")]
    .find((x) => /^Show all cycles$/.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`);

  const all = await onBoard();
  check("every term is on the board to start", all.length, RETURNED.length + OUSTED.length + 1);
  check("the control offers the re-elected cut first", await label(),
        "Show re-elected governments only");

  await press(); await new Promise((r) => setTimeout(r, 350));
  check("re-elected only leaves exactly the governments that were returned",
        await onBoard(), RETURNED);
  check("…and the sitting term, which has not faced its election, is not in it",
        (await onBoard()).includes(SITTING), false);
  check("…and the control now offers the other cut", await label(),
        "Show ousted governments only");

  await press(); await new Promise((r) => setTimeout(r, 350));
  check("ousted only leaves exactly the governments that were turned out",
        await onBoard(), OUSTED);
  check("…and it offers the re-elected cut again", await label(),
        "Show re-elected governments only");

  /* the two cuts must not overlap and must not between them claim the
     sitting term - that is the whole content of "no outcome yet" */
  check("the two cuts are disjoint",
        RETURNED.filter((y) => OUSTED.includes(y)), []);
  check("the two cuts cover every decided term",
        RETURNED.length + OUSTED.length, all.length - 1);

  check("the way back is the control beside it", await pressAll(), true);
  await new Promise((r) => setTimeout(r, 350));
  check("…which restores every term", await onBoard(), all);

  /* picking a chip off by hand after a cut must not leave the label lying:
     the cut shown is derived from the board, not remembered */
  await press(); await new Promise((r) => setTimeout(r, 350));
  await page.evaluate(`document.querySelector(".cyc-chip .cyc-x").click()`);
  await new Promise((r) => setTimeout(r, 350));
  check("a hand-picked chip drops the cut, so the label resets", await label(),
        "Show re-elected governments only");
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
