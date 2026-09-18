/* Past cycles: the board cut by what each government did at its own election.

   A term's outcome is DERIVED from the run of CYCLE_DEFS - a government was
   returned when the next term is governed by the same party - so this probe
   checks the derivation against the actual history rather than against the
   code that produced it. Get this wrong and the tab quietly libels a
   government, which is worse than a layout bug.

   The sitting term has no next term, so no outcome: it is in neither set.

   The two cuts used to be ONE button offering the set you were not looking
   at, so the choices could never be compared and "back to everything" was a
   second control beside it. They are four named shortcuts in the board's
   panel now - All / None / Returned / Ousted - and which one is in effect is
   still derived from the board, never remembered. */
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

/* The record, written out rather than computed: every term since 1972 and
   whether its government survived the election that ended it. */
const RETURNED = [1972, 1975, 1977, 1983, 1984, 1987, 1990, 1996, 1998, 2001,
                  2007, 2013, 2016, 2022];
const OUSTED   = [1974, 1980, 1993, 2004, 2010, 2019];
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
  await page.waitForSelector(".cyc-legend .ap-popbtn", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(`document.querySelector(".cyc-legend .ap-popbtn").click()`);
  await page.waitForSelector(".cyc-row", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));

  const onBoard = () => page.evaluate(`[...document.querySelectorAll(".cyc-row")]
    .filter((c) => !c.className.includes("off"))
    .map((c) => +c.querySelector(".cyc-year").textContent).sort((a, b) => a - b)`);
  /* which shortcut the board is standing on, derived, not remembered */
  const lit = () => page.evaluate(`(() => { const b = [...document.querySelectorAll(".pop-quick-opt")]
    .find((x) => x.className.includes("active")); return b ? b.textContent.trim() : null; })()`);
  const press = (name) => page.evaluate(`(() => { const b = [...document.querySelectorAll(".pop-quick-opt")]
    .find((x) => x.textContent.trim() === "${name}"); if (b) b.click(); return !!b; })()`);

  const all = await onBoard();
  check("every term is on the board to start", all.length, RETURNED.length + OUSTED.length + 1);
  check("…and the board says so", await lit(), "All");
  check("all four cuts are offered at once",
        await page.evaluate(`[...document.querySelectorAll(".pop-quick-opt")].map((b) => b.textContent.trim())`),
        ["All", "None", "Returned", "Ousted"]);

  check("Returned is a control", await press("Returned"), true);
  await new Promise((r) => setTimeout(r, 350));
  check("re-elected only leaves exactly the governments that were returned",
        await onBoard(), RETURNED);
  check("…and the sitting term, which has not faced its election, is not in it",
        (await onBoard()).includes(SITTING), false);
  check("…and that cut is the one lit", await lit(), "Returned");

  await press("Ousted"); await new Promise((r) => setTimeout(r, 350));
  check("ousted only leaves exactly the governments that were turned out",
        await onBoard(), OUSTED);
  check("…and that cut is the one lit", await lit(), "Ousted");

  await press("None"); await new Promise((r) => setTimeout(r, 350));
  check("None clears the board", await onBoard(), []);
  check("…and says so", await lit(), "None");

  /* the two cuts must not overlap and must not between them claim the
     sitting term - that is the whole content of "no outcome yet" */
  check("the two cuts are disjoint",
        RETURNED.filter((y) => OUSTED.includes(y)), []);
  check("the two cuts cover every decided term",
        RETURNED.length + OUSTED.length, all.length - 1);

  check("the way back stands beside them", await press("All"), true);
  await new Promise((r) => setTimeout(r, 350));
  check("…and restores every term", await onBoard(), all);

  /* picking a term off by hand after a cut must not leave a shortcut lying:
     the cut shown is derived from the board, not remembered */
  await press("Returned"); await new Promise((r) => setTimeout(r, 350));
  await page.evaluate(`document.querySelector(".cyc-row .cyc-x").click()`);
  await new Promise((r) => setTimeout(r, 350));
  check("a hand-picked term drops the cut, so no shortcut is lit", await lit(), null);
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
