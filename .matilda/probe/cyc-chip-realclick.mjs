/* repro 2026-10-02: "+ Draw a term" chip ignores real laptop clicks but
   works on the phone. Round one proved the CLICK reaches the chip at
   every width; round two found the real break: the board sheet stays
   anchored to the Summary section's controls row while the chip floats
   on the Two-party divider, so a reader who scrolls to the chip clicks
   it and the sheet opens hundreds of pixels UP the page, out of view.
   The phone only worked because at <=900px the sheet is a fixed bottom
   sheet. Fix (rd-cycles.jsx/rd.css): >=901px, an open whose home isn't
   on screen parks the sheet against the top of the viewport (.body).

   This probe clicks with REAL mouse/touch events, records
   elementFromPoint at the chip centre, then asserts the OPEN SHEET's
   placement contract at every width: out-of-home-view opens follow the
   viewport; opens with the home in view stay put; the phone sheet is
   unchanged. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9011;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, detail) => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : "")); if (!ok) fails.push(name); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function boot(W, H, touch, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Compare with"]', { timeout: 20000 });
  await sleep(800);
  return { page, pageErrors };
}

/* placement contract for the sheet that is currently OPEN */
async function checkBoardPlacement(page, tag, expectFollow) {
  const bvis = await page.evaluate(() => {
    const b = document.querySelector(".rd-cc-board");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const probes = [];
    for (const [fx, fy] of [[0.5, 0.06], [0.5, 0.5], [0.1, 0.5], [0.9, 0.5], [0.5, 0.94]]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { probes.push({ fx, fy, clip: true }); continue; }
      const el = document.elementFromPoint(x, y);
      probes.push({ fx, fy, top: el ? String(el.className || el.tagName).slice(0, 60) : "(none)",
                    board: !!(el && el.closest && el.closest(".rd-cc-board")) });
    }
    const cs = getComputedStyle(b);
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
             pos: cs.position, cls: b.className, z: cs.zIndex, op: cs.opacity, vis: cs.visibility, probes,
             inView: r.top >= 0 && r.top < innerHeight && r.bottom > 0 };
  });
  if (!bvis) { check(`[${tag}] the board opened`, false, "no .rd-cc-board"); return; }
  console.log(`  [${tag}] board rect ${JSON.stringify(bvis.rect)} pos=${bvis.pos} z=${bvis.z} cls=${bvis.cls}`);
  bvis.probes.forEach((p) => console.log(`    probe(${p.fx},${p.fy}) ${p.clip ? "off-viewport" : `top="${p.top}" board?=${p.board}`}`));
  const owned = bvis.probes.filter((p) => !p.clip && p.board).length;
  check(`[${tag}] the open board shows itself`, bvis.inView && owned >= 1,
    `rect ${JSON.stringify(bvis.rect)}; on-viewport probes=${bvis.probes.length - bvis.probes.filter((p) => p.clip).length} owned=${owned}`);
  check(`[${tag}] the open board owns its pixels`, bvis.probes.every((p) => p.clip || p.board),
    JSON.stringify(bvis.probes.find((pp) => !pp.clip && !pp.board) || {}));
  if (expectFollow === true) {
    check(`[${tag}] the board followed the viewport`, bvis.pos === "fixed", `pos=${bvis.pos} cls=${bvis.cls}`);
    check(`[${tag}] the board parked under the tabs`, bvis.rect.y >= 72 && bvis.rect.y <= 96, `top=${bvis.rect.y}`);
  }
  if (expectFollow === false) {
    check(`[${tag}] the board stayed home`, bvis.pos === "absolute", `pos=${bvis.pos} cls=${bvis.cls}`);
  }
}

async function run(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "");
  const { page, pageErrors } = await boot(W, H, touch, tag);

  const chipInfo = await page.evaluate(() => {
    const chip = document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    if (!chip) return null;
    chip.scrollIntoView({ block: "center" });
    const r = chip.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    window.__evlog = [];
    ["pointerdown", "pointerup", "mousedown", "mouseup", "click"].forEach((n) =>
      document.addEventListener(n, (e) => {
        const t = e.target;
        window.__evlog.push(n + "@" + (t.className || t.tagName)
          + (t.closest ? " chip?=" + !!t.closest("#cyc-tpp .rd-cyc-chipmove .rd-chip") : ""));
      }, true));
    const top = document.elementFromPoint(cx, cy);
    const chain = [];
    let n = top;
    while (n && chain.length < 6) { chain.push(n.tagName.toLowerCase() + "." + String(n.className || "").replace(/\s+/g, ".")); n = n.parentElement; }
    return { cx: Math.round(cx), cy: Math.round(cy),
             topEl: top ? String(top.className || top.tagName) : "(none)",
             topIsChip: !!(top && top.closest && top.closest("#cyc-tpp .rd-cyc-chipmove .rd-chip")),
             chain: chain.join(" < "),
             rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  check(`[${tag}] chip found`, !!chipInfo, "no chip");
  if (!chipInfo) { await page.close(); return; }
  console.log(`  [${tag}] chip rect ${JSON.stringify(chipInfo.rect)} centre (${chipInfo.cx},${chipInfo.cy})`);
  console.log(`  [${tag}] elementFromPoint: ${chipInfo.topEl}`);
  console.log(`  [${tag}] ancestor chain: ${chipInfo.chain}`);
  check(`[${tag}] chip wins the hit test`, chipInfo.topIsChip, `top element: ${chipInfo.topEl}`);

  if (touch) {
    await page.touchscreen.tap(chipInfo.cx, chipInfo.cy);
  } else {
    await page.mouse.move(chipInfo.cx, chipInfo.cy);
    await page.mouse.down();
    await page.mouse.up();
  }
  await sleep(500);
  const st = await page.evaluate(() => ({ board: !!document.querySelector(".rd-cc-board"), log: window.__evlog }));
  console.log(`  [${tag}] event log: ${JSON.stringify(st.log)}`);
  check(`[${tag}] real press opens the board`, st.board, "board stayed closed");

  /* the chip-centred scroll leaves the sheet's home far off-screen: the
     laptop sheet must have followed the viewport; the phone sheet was
     always fixed, so its contract is just placement */
  if (st.board) {
    await checkBoardPlacement(page, tag, touch ? null : true);
    await page.evaluate(() => { document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip").click(); });
    await sleep(400);
  }
  check(`[${tag}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
  await page.close();
}

/* the home rung: with the sheet's home (under the Summary controls row)
   comfortably on screen, an open must STAY home instead of following the
   viewport. Runs tall so the chip is on screen too and the real mouse
   can do the clicking; falls back to a synthetic toggle when the layout
   is taller than the viewport (the gating logic is what's under test). */
async function homeRung() {
  const tag = "1440px-home";
  const { page, pageErrors } = await boot(1440, 1400, false, tag);
  const prep = await page.evaluate(() => {
    const cc = document.querySelector(".rd-cc");
    cc.scrollIntoView({ block: "start" });
    window.scrollBy(0, -150);
    const chip = document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    const r = chip.getBoundingClientRect();
    return { chipTop: Math.round(r.top), chipInView: r.top >= 72 && r.bottom <= innerHeight,
             cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) };
  });
  console.log(`  [${tag}] chip viewport top ${prep.chipTop}; in view=${prep.chipInView}`);
  if (prep.chipInView) {
    await page.mouse.move(prep.cx, prep.cy);
    await page.mouse.down();
    await page.mouse.up();
  } else {
    await page.evaluate(() => { document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip").click(); });
  }
  await sleep(500);
  const open = await page.evaluate(() => !!document.querySelector(".rd-cc-board"));
  check(`[${tag}] the board opened`, open, "closed");
  if (open) {
    await checkBoardPlacement(page, tag, false);
    await page.evaluate(() => { document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-chip").click(); });
    await sleep(400);
  }
  check(`[${tag}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
  await page.close();
}

try {
  await run(1440, 960, false);
  await run(390, 844, true);
  await homeRung();
} finally { await browser.close(); server.close(); }
console.log(fails.length === 0 ? "ALL GREEN" : `${fails.length} FAILURES`);
process.exit(fails.length === 0 ? 0 : 1);
