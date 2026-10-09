/* Assert the Economic-sentiment calendar fold (conf-calendar feature,
   2026-10-09): the four confidence gauges left the Latest-polls fold
   (pl-calendar.mjs asserts that side) and list in their OWN "Release
   calendar", mounted by RdConfCal inside #confidence between the
   crossfaded chart and the how-to. It renders only the projection's
   tracked:"confidence" rows (nextPolls horizonDays:62,
   includeTracked:true - the same widened call the polls calendar makes),
   starts closed, chips each series weekly/monthly, links the names out,
   and a phone rung keeps no horizontal overflow.
   Serve the tree under test: BASE=".worktrees/np-calendar" node
   .matilda/probe/conf-calendar.mjs   (from the main checkout) */
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
  /* the Snapshot tab's confidence panel only mounts once the Snapshot
     renders; give the page its build before probing */
  await page.goto(base + "/", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 1500));

  const r0 = await page.evaluate(() => {
    const sec = document.getElementById("confidence");
    if (!sec) return { ok: false, why: "no #confidence section" };
    const det = sec.querySelector("details.rd-conf-cal");
    if (!det) return { ok: false, why: "no details.rd-conf-cal" };
    const chart = sec.querySelector(".rd-confidence-chart");
    const hint = sec.querySelector(".table-hint");
    const dTop = det.getBoundingClientRect().top;
    return {
      ok: true,
      summary: (det.querySelector("summary") || {}).textContent || null,
      open: det.open,
      belowChart: chart ? dTop >= chart.getBoundingClientRect().bottom - 1 : null,
      aboveHint: hint ? dTop <= hint.getBoundingClientRect().top + 1 : null,
      /* exactly one calendar in this section, and not the polls one */
      onlyOne: sec.querySelectorAll("details.rd-cal").length === 1,
      ownClass: !det.closest("#latest-polls"),
    };
  });
  check(`${vp.tag} details exists`, r0.ok !== false, r0.why);
  check(`${vp.tag} summary reads Release calendar`, r0.ok && r0.summary === "Release calendar",
        JSON.stringify(r0.summary));
  check(`${vp.tag} starts closed`, r0.ok && r0.open === false, "open=" + r0.open);
  check(`${vp.tag} sits under the chart`, r0.ok && r0.belowChart === true, "belowChart=" + r0.belowChart);
  check(`${vp.tag} sits above the how-to`, r0.ok && r0.aboveHint === true, "aboveHint=" + r0.aboveHint);
  check(`${vp.tag} the section's only calendar`, r0.ok && r0.onlyOne === true);
  check(`${vp.tag} not under latest-polls`, r0.ok && r0.ownClass === true);

  /* open it */
  await page.evaluate(() => {
    const s = document.querySelector("#confidence details.rd-conf-cal summary");
    if (s) s.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const r1 = await page.evaluate(() => {
    const det = document.querySelector("#confidence details.rd-conf-cal");
    if (!det || !det.open) return { ok: false, why: "did not open" };
    /* re-derive the expected list from the SAME widened projection call,
       restricted to the confidence rows - exactly what RdConfCal renders */
    const proj = window.AP.nextPolls(null, { horizonDays: 62, includeTracked: true });
    const all = proj.rows;
    const rows = all.filter((r) => r.tracked === "confidence");
    const DAY = 86400000;
    const irr = (r) => r.cadence > 60;
    let over = 0, wins = 0, irrs = 0;
    const days = new Map();
    rows.forEach((r) => {
      if (r.overdue) { over += 1; return; }
      if (r.loose && !irr(r)) { wins += 1; return; }
      if (irr(r)) { irrs += 1; return; }
      const iso = new Date(r.release).toISOString().slice(0, 10);
      days.set(iso, (days.get(iso) || 0) + 1);
    });
    const expectedLi = over + wins + irrs + days.size;
    const liCount = det.querySelectorAll(".rd-cal-list li").length;
    const overCount = det.querySelectorAll(".rd-cal-sec-over li").length;
    /* month heads, in render order, vs expected ym sequence */
    const heads = [...det.querySelectorAll(".rd-cal-m")].map((el) => el.textContent.trim());
    const items = [];
    rows.forEach((r) => {
      if (r.overdue) return;
      if (r.loose && !irr(r)) items.push(r.release - r.spread * DAY);
      else items.push(r.release);
    });
    items.sort((a, b) => a - b);
    const yms = [];
    items.forEach((ms) => {
      const ym = new Date(ms).toISOString().slice(0, 7);
      if (!yms.length || yms[yms.length - 1] !== ym) yms.push(ym);
    });
    const MN = (ym) => { const [y, m] = ym.split("-").map(Number); return window.AUSPOL.monthNameFull(m) + " " + y; };
    const expectedHeads = [...(over ? ["Due, not yet recorded"] : []), ...yms.map(MN)];
    /* every projected row lands its series name exactly once across the
       fold's name cells (a weekly series lists once per projected slot;
       dated same-day entries merge two names into one cell, never
       repeat one) */
    const names = [...det.querySelectorAll(".rd-cal-w")].map((w) => w.textContent);
    const confNames = rows.map((r) => r.pollster);
    const want = {};
    confNames.forEach((n) => { want[n] = (want[n] || 0) + 1; });
    const counts = {};
    names.forEach((t) => [...new Set(confNames)].forEach((n) => { if (t.includes(n)) counts[n] = (counts[n] || 0) + 1; }));
    /* chips: one per rendered series entry, weekly iff the row's cadence
       is ten days or fewer */
    const chips = [...det.querySelectorAll(".rd-cal-track")].map((t) => t.textContent.trim());
    const wantFreq = rows.map((r) => (r.cadence <= 10 ? "weekly" : "monthly"));
    return {
      ok: true, expectedLi, liCount, over, overCount, heads, expectedHeads,
      confNames, counts, want, chips, wantFreq,
      nWk: wantFreq.filter((f) => f === "weekly").length,
      nMo: wantFreq.filter((f) => f === "monthly").length,
      chipsWk: chips.filter((f) => f === "weekly").length,
      chipsMo: chips.filter((f) => f === "monthly").length,
      links: [...det.querySelectorAll(".rd-cal-w a")].map((a) => ({
        txt: a.textContent.trim(), href: a.getAttribute("href") || "",
        tgt: a.getAttribute("target"), mark: !!a.querySelector(".plink-mark") })),
      noteTxt: (det.querySelector(".rd-note") || {}).textContent || "",
      liTexts: [...det.querySelectorAll(".rd-cal-list li")].slice(0, 6).map((li) => li.textContent.trim()),
    };
  });
  check(`${vp.tag} opens`, r1.ok !== false, r1.why);
  check(`${vp.tag} four confidence rows projected`, r1.ok && r1.confNames.length >= 4,
        `confNames=${JSON.stringify(r1.confNames)}`);
  check(`${vp.tag} li count == projection`, r1.ok && r1.expectedLi === r1.liCount,
        `li=${r1.liCount} want ${r1.expectedLi}`);
  check(`${vp.tag} due count == overdue rows`, r1.ok && r1.overCount === r1.over,
        `over li=${r1.overCount} want ${r1.over}`);
  check(`${vp.tag} month heads`, r1.ok && JSON.stringify(r1.heads) === JSON.stringify(r1.expectedHeads),
        `heads=${JSON.stringify(r1.heads)} want ${JSON.stringify(r1.expectedHeads)}`);
  check(`${vp.tag} every row lists its series`, r1.ok &&
        Object.keys(r1.want).every((n) => r1.counts[n] === r1.want[n]) &&
        Object.keys(r1.counts).every((n) => r1.want[n] === r1.counts[n]),
        `counts=${JSON.stringify(r1.counts)} want ${JSON.stringify(r1.want)}`);
  check(`${vp.tag} freq chips render`, r1.ok && r1.chips.length === r1.wantFreq.length &&
        r1.chipsWk === r1.nWk && r1.chipsMo === r1.nMo,
        `chips=${JSON.stringify(r1.chips)} want ${r1.nWk} weekly + ${r1.nMo} monthly`);
  check(`${vp.tag} names link out`, r1.ok && r1.links.length === r1.wantFreq.length &&
        r1.links.every((l) => /^https:\/\//.test(l.href) && l.tgt === "_blank" && l.mark && l.txt.endsWith("↗")),
        JSON.stringify((r1.links || []).slice(0, 3)));
  check(`${vp.tag} note names the four gauges`, r1.ok &&
        r1.noteTxt.includes("ANZ–Roy Morgan") && r1.noteTxt.includes("Westpac–MI") &&
        r1.noteTxt.includes("NAB") && r1.noteTxt.includes("four gauges"),
        (r1.noteTxt || "").slice(0, 120));
  if (vp.tag === "desktop") console.log("   first rows:", JSON.stringify(r1.liTexts), "chips:", JSON.stringify(r1.chips));

  const r2 = await page.evaluate(() => ({
    hOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check(`${vp.tag} no horizontal overflow`, r2.hOver <= 0, "over by " + r2.hOver + "px");
  check(`${vp.tag} no page errors`, errors.length === 0, errors.join("; "));

  await page.close();
}

await browser.close();
server.close();
if (fails.length) { console.log("\nFAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log(`\nALL PASS (${oks.length} checks)`);
