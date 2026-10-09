/* Assert the missed-slot × marks in the Latest-polls release strip. A
   vacated projection slot (assumed skip, NP_ASSUME_SKIP_DAYS=2) rides
   every later row as `missedSlots`; strip(e) draws a muted-grey × at
   each one inside the visible window. Roy Morgan's Mon 5 Oct slot is
   vacated in the current data (last release Mon 29 Sep), so its row
   renders exactly one ×, positioned at the Mon 5 Oct offset of the
   strip window, plus the legend item in the key. Probe against the
   built tree:  node .matilda/probe/pl-missed-x.mjs  (BASE=… to point at
   another checkout, e.g. BASE=".worktrees/x" from the main checkout) */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.BASE
  ? path.resolve(process.env.BASE)
  : decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });

const fails = [], oks = [];
const check = (name, cond, detail) => {
  if (cond) { oks.push(name); console.log(`${name}: ok`); }
  else fails.push(`${name}${detail ? " - " + detail : ""}`);
};

for (const vp of [{ width: 1280, height: 900, tag: "desktop" }, { width: 390, height: 844, tag: "phone" }]) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.tag === "phone" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.goto(base + "/", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 1500));

  const r = await page.evaluate(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return { ok: false, why: "no #latest-polls section" };
    const proj = window.AP.nextPolls();
    if (!proj || !proj.rows) return { ok: false, why: "no projection rows" };
    /* Roy Morgan carries a vacated Mon 5 Oct slot while its next date
       projects Mon 12 Oct; find whichever rows currently carry recorded
       misses but assert RM specifically (the table row is its own) */
    const missed = proj.rows.filter((x) => x.missedSlots && x.missedSlots.length);
    const rm = proj.rows.find((x) => /Morgan/.test(x.pollster));
    if (!rm) return { ok: false, why: "no Roy Morgan row" };
    const L = proj.t0 - 43 * 86400000, R = proj.t0 + 23 * 86400000;
    /* the strip for a row lives in its .rd-pl-c-tl cell; rows are keyed
       in render order, so index-match the table row to the projection */
    const cells = [...sec.querySelectorAll(".rd-pl-c-tl")];
    const names = [...sec.querySelectorAll(".rd-pl")].length; /* table presence */
    /* find RM's strip: the row whose cell:nth-of-type ordering matches
       the projection's row index is fragile; instead match by the strip
       whose × offsets equal this row's missedSlots positions */
    const posPct = (ms) => ((ms - L) / (R - L)) * 100;
    const want = (rm.missedSlots || []).filter((ms) => ms >= L && ms <= R);
    let rmStrip = null, rmOffsets = null;
    for (const c of cells) {
      const xs = [...c.querySelectorAll(".rd-tl-x")];
      if (!xs.length) continue;
      const offs = xs.map((el) => parseFloat(el.style.left));
      const fits = want.length === xs.length &&
        want.every((ms) => offs.some((o) => Math.abs(o - posPct(ms)) < 0.5));
      if (fits && /Morgan/.test(c.closest("[role=row]").textContent)) { rmStrip = c; rmOffsets = offs; }
    }
    /* key + note copy */
    const key = sec.querySelector(".rd-tl-keyx");
    const note = [...sec.querySelectorAll(".rd-note")].map((n) => n.textContent).join(" ");
    const tlBox = rmStrip ? rmStrip.getBoundingClientRect() : null;
    const xsEl = rmStrip ? [...rmStrip.querySelectorAll(".rd-tl-x")] : [];
    const geo = xsEl.map((el) => {
      const b = el.getBoundingClientRect();
      const before = getComputedStyle(el, "::before");
      const after = getComputedStyle(el, "::after");
      return { left: b.left - tlBox.left, w: b.width, beforeW: parseFloat(before.width),
               afterDisp: after.display, colour: before.backgroundColor };
    });
    return {
      ok: true, t0: proj.t0, missedCount: missed.length,
      rmMissed: (rm.missedSlots || []).map((ms) => new Date(ms).toISOString().slice(0, 10)),
      wantOffsets: want.map(posPct), rmOffsets, inKey: !!key,
      note: /× marks where it stood/.test(note),
      inside: geo.length ? geo.every((g) => g.left >= -1 && g.left + g.w <= tlBox.width + 1) : null,
      bars: geo.length ? geo.every((g) => g.beforeW > 0 && g.afterDisp !== "none") : null,
      cols: cells.length, names,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  check(`${vp.tag} page evaluates`, r.ok !== false, r.why);
  check(`${vp.tag} RM missed slot recorded projection-side`,
        r.ok && r.rmMissed.length >= 1, JSON.stringify(r.rmMissed));
  check(`${vp.tag} one or more rows carry misses`, r.ok && r.missedCount >= 1);
  check(`${vp.tag} × offsets match vacated slot dates`, r.ok && r.rmOffsets &&
        r.rmOffsets.length === r.wantOffsets.length &&
        r.rmOffsets.every((o, i) => Math.abs(o - r.wantOffsets[i]) < 0.5),
        `offsets=${JSON.stringify(r.rmOffsets)} want=${JSON.stringify(r.wantOffsets)}`);
  check(`${vp.tag} × sits inside the strip`, r.ok && r.inside === true, JSON.stringify(r.inside));
  check(`${vp.tag} both strokes drawn`, r.ok && r.bars === true);
  check(`${vp.tag} key carries the × legend`, r.ok && r.inKey === true);
  check(`${vp.tag} note explains the ×`, r.ok && r.note === true);
  check(`${vp.tag} no horizontal overflow`, r.ok && r.overflow <= 0, r.overflow + "px over");
  check(`${vp.tag} no page errors`, errors.length === 0, errors.join("; "));

  await page.close();
}

await browser.close();
server.close();
if (fails.length) { console.log("\nFAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log(`\nALL PASS (${oks.length} checks)`);
