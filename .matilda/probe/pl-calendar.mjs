/* Assert the Latest-polls Calendar fold-out (np-calendar feature): the
   details sits under the table, its summary reads "Release calendar", it
   opens to month-headed lists; the li set is EXACTLY the widened,
   tracked-admitting projection (nextPolls horizonDays=62,
   includeTracked:true) minus the economic-confidence rows, which moved to
   Economic sentiment's own fold (2026-10-09; conf-calendar.mjs probes
   that one); tracked houses carry their monitor chip and the default
   28-day call stays poll-only; phone rung keeps no horizontal overflow.
   Serve the tree under test: BASE=".worktrees/np-calendar" node
   .matilda/probe/pl-calendar.mjs   (from the main checkout) */
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

  const r0 = await page.evaluate(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return { ok: false, why: "no #latest-polls section" };
    const det = sec.querySelector("details.rd-cal");
    if (!det) return { ok: false, why: "no details.rd-cal" };
    const table = sec.querySelector(".rd-pl");
    const summary = det.querySelector("summary");
    return {
      ok: true,
      summary: summary ? summary.textContent.trim() : null,
      open: det.open,
      lastChild: sec.lastElementChild === det,
      belowTable: table ? det.getBoundingClientRect().top >= table.getBoundingClientRect().bottom - 1 : null,
    };
  });
  check(`${vp.tag} details exists`, r0.ok !== false, r0.why);
  check(`${vp.tag} summary reads Release calendar`, r0.summary === "Release calendar", JSON.stringify(r0.summary));
  check(`${vp.tag} starts closed`, r0.open === false, "open=" + r0.open);
  check(`${vp.tag} last child of section`, r0.lastChild === true);
  check(`${vp.tag} sits under the table`, r0.belowTable === true, "belowTable=" + r0.belowTable);

  /* open it (native details toggle on the summary) */
  await page.evaluate(() => {
    const s = document.querySelector("#latest-polls details.rd-cal summary");
    if (s) s.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const r1 = await page.evaluate(() => {
    const det = document.querySelector("#latest-polls details.rd-cal");
    if (!det || !det.open) return { ok: false, why: "did not open" };
    /* re-derive the expected list from the SAME widened projection call,
       minus the confidence rows, which list under Economic sentiment's
       own fold; the calendar opts the tracked releases in, the default
       call must not */
    const proj = window.AP.nextPolls(null, { horizonDays: 62, includeTracked: true });
    const projDef = window.AP.nextPolls();               /* default horizon must survive */
    const DAY = 86400000;
    const calRows = proj.rows.filter((r) => r.tracked !== "confidence");
    const irr = (r) => r.cadence > 60;
    let over = 0, wins = 0, irrs = 0;
    const days = new Map();
    calRows.forEach((r) => {
      if (r.overdue) { over += 1; return; }
      if (r.loose && !irr(r)) { wins += 1; return; }
      if (irr(r)) { irrs += 1; return; }
      const iso = new Date(r.release).toISOString().slice(0, 10);
      days.set(iso, (days.get(iso) || 0) + 1);
    });
    const expectedLi = over + wins + irrs + days.size;
    const liCount = det.querySelectorAll(".rd-cal-list li").length;
    const overCount = det.querySelectorAll(".rd-cal-sec-over li").length;
    /* filing-hour assertions: dated slots name the hour the house files
       at after their linked name (the same hourWords recline as the Next
       column's), while windows, irregular slots and the due-in list carry
       none. The expectations are derived IN PAGE from each projection
       row's release fields, replicating rd-polls.jsx's hourWords and the
       wall-clock renderers of the a11e1559 asset, so nothing here
       hardcodes a house's habit. */
    const clockParts = (mins) => {
      const h = Math.floor(mins / 60), mi = mins % 60;
      const ap = h < 12 ? "am" : "pm";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return { num: mi ? `${h12}:${String(mi).padStart(2, "0")}` : `${h12}`, ap };
    };
    const clockLabel = (mins) => { const c = clockParts(mins); return `${c.num} ${c.ap}`; };
    const RELEASE_TIGHT_MINS = 120;
    const releaseLabel = (from, to, mid, vals) => {
      if (from == null || to == null) return null;
      if (from === to) return clockLabel(from);
      if (vals && vals.length >= 2) {
        const ps = vals.map(clockParts);
        return ps.every((p) => p.ap === ps[0].ap)
          ? `${ps.slice(0, -1).map((p) => p.num).join(", ")} or ${ps[ps.length - 1].num} ${ps[0].ap}`
          : vals.slice(0, -1).map(clockLabel).join(", ") + ` or ${clockLabel(vals[vals.length - 1])}`;
      }
      if (to - from > RELEASE_TIGHT_MINS) return clockLabel(Math.round(mid != null ? mid : (from + to) / 2));
      const a = clockParts(from), b = clockParts(to);
      return a.ap === b.ap ? `${a.num}–${b.num} ${b.ap}`
                           : `${clockLabel(from)}–${clockLabel(to)}`;
    };
    const hourWords = (r) => {
      if (r.releaseFrom == null || r.releaseTo == null) return null;
      if (r.releaseVals && r.releaseVals.length >= 2) return releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
      if (r.releaseTo - r.releaseFrom <= 20) return clockLabel(r.releaseFrom);
      return "about " + clockLabel(Math.round((r.releaseMid != null ? r.releaseMid : (r.releaseFrom + r.releaseTo) / 2) / 60) * 60);
    };
    const expectedHours = {};
    calRows.forEach((r) => {
      if (r.tracked === "confidence") return;
      if (r.overdue) return;
      if (r.loose && !irr(r)) return;
      if (irr(r)) return;
      const hr = hourWords(r);
      if (hr) (expectedHours[r.pollster] = expectedHours[r.pollster] || []).push(hr);
    });
    /* month heads, in render order, vs expected ym sequence */
    const heads = [...det.querySelectorAll(".rd-cal-m")].map((el) => el.textContent.trim());
    const items = [];
    calRows.forEach((r) => {
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
    /* the default-horizon call's further slots still stop at 28 days */
    const t0 = projDef.t0;
    const defBeyond = projDef.rows.filter((r) => (r.ahead || 0) >= 1 && !r.overdue)
      .map((r) => r.loose && !irr(r) ? r.release - r.spread * DAY : r.release);
    return {
      ok: true, expectedLi, liCount, over, overCount, heads, expectedHeads,
      defOK: defBeyond.every((ms) => ms <= t0 + 28 * DAY + 60000),
      liTexts: [...det.querySelectorAll(".rd-cal-list li")].slice(0, 4).map((li) => li.textContent.trim()),
      qualSample: [...det.querySelectorAll(".rd-cal-q")].map((q) => q.textContent.trim()).slice(0, 8),
      /* tracked-release rows: rendered chips vs the projection's tracked
         set, and the default call's purity; the confidence rows are
         projected but must NOT render here (Economic sentiment's fold) */
      nTracked: proj.rows.filter((r) => r.tracked && r.tracked !== "confidence").length,
      confNames: proj.rows.filter((r) => r.tracked === "confidence").map((r) => r.pollster),
      trackChips: [...det.querySelectorAll(".rd-cal-track")].map((t) => t.textContent.trim()),
      liAll: [...det.querySelectorAll(".rd-cal-list li")].map((li) => li.textContent),
      overAll: [...det.querySelectorAll(".rd-cal-sec-over li")].map((li) => li.textContent),
      defTracked: projDef.rows.filter((r) => r.tracked).length,
      noteTxt: (det.querySelector(".rd-note") || {}).textContent || "",
      /* date column: unspaced en-dash spans, one shared right edge so the
         house names line up vertically */
      calDates: [...det.querySelectorAll(".rd-cal-d")].map((d) => d.textContent),
      calAlign: ((rights) => (rights.length ? Math.round((Math.max(...rights) - Math.min(...rights)) * 10) / 10 : 0))(
        [...det.querySelectorAll(".rd-cal-d")].map((d) => d.getBoundingClientRect().right)),
      calFits: [...det.querySelectorAll(".rd-cal-d")].every((d) => d.scrollWidth <= d.clientWidth + 1),
      /* house-name cells: name links out to its where-it-lands-first page
         with the ↗ plink-mark; a house without a site stays plain text */
      links: [...det.querySelectorAll(".rd-cal-w a")].map((a) => ({
        txt: a.textContent.trim(), href: a.getAttribute("href") || "",
        tgt: a.getAttribute("target"), mark: !!a.querySelector(".plink-mark") })),
      emptyW: [...det.querySelectorAll(".rd-cal-w")].filter((c) => !c.children.length).length,
      expectedHours,
      /* per who-entry: the pollster name and, if rendered, the hour text
         that trails it (", 6 pm" shape). The overdue list and the window
         /irregular items must show NONE of these. */
      calWi: [...det.querySelectorAll(".rd-cal-list .rd-cal-wi")].map((wi) => {
        const a = wi.querySelector("a");
        const t = wi.querySelector(".rd-cal-t");
        let n = a ? a.textContent : "";
        if (!n) { const tn = [...wi.childNodes].find((x) => x.nodeType === 3 && x.textContent.trim()); n = tn ? tn.textContent : ""; }
        return { n: n.replace(/↗\s*$/, "").trim(), hr: t ? t.textContent : null,
                 afterLink: t ? !!(t.previousSibling && t.previousSibling.nodeType !== 9) : false };
      }),
      calHours: [...det.querySelectorAll(".rd-cal-t")].map((t) => t.textContent),
      calOverT: det.querySelectorAll(".rd-cal-sec-over .rd-cal-t").length,
      calOverWi: det.querySelectorAll(".rd-cal-sec-over .rd-cal-wi").length,
    };
  });
  check(`${vp.tag} opens`, r1.ok !== false, r1.why);
  check(`${vp.tag} li count == projection`, r1.ok && r1.expectedLi === r1.liCount,
        `li=${r1.liCount} want ${r1.expectedLi}`);
  check(`${vp.tag} due count == overdue rows`, r1.ok && r1.overCount === r1.over,
        `over li=${r1.overCount} want ${r1.over}`);
  check(`${vp.tag} month heads`, r1.ok && JSON.stringify(r1.heads) === JSON.stringify(r1.expectedHeads),
        `heads=${JSON.stringify(r1.heads)} want ${JSON.stringify(r1.expectedHeads)}`);
  check(`${vp.tag} default horizon stays 28d`, r1.ok && r1.defOK === true);
  check(`${vp.tag} tracked rows render`, r1.ok && r1.nTracked >= 2,
        `tracked in projection=${r1.nTracked}`);
  check(`${vp.tag} no confidence rows render`, r1.ok && r1.confNames.length >= 1 &&
        ![...r1.liAll, ...r1.overAll].some((t) => r1.confNames.some((n) => t.includes(n))),
        `conf=${JSON.stringify(r1.confNames)}`);
  check(`${vp.tag} tracked chips render`, r1.ok &&
        r1.trackChips.includes("Mood of the Nation") && r1.trackChips.includes("Issues Monitor") &&
        r1.trackChips.length >= 2,
        `chips=${JSON.stringify(r1.trackChips)}`);
  check(`${vp.tag} default call stays poll-only`, r1.ok && r1.defTracked === 0,
        `defTracked=${r1.defTracked}`);
  check(`${vp.tag} date spans unspaced`, r1.ok && r1.calDates.every((t) => !/\s–\s/.test(t)),
        JSON.stringify((r1.calDates || []).filter((t) => /–/.test(t)).slice(0, 6)));
  check(`${vp.tag} name column aligned`, r1.ok && r1.calAlign <= 1 && r1.calFits,
        `edge spread ${r1.calAlign}px, fits=${r1.calFits}`);
  check(`${vp.tag} note names monitored houses`, r1.ok && /SEC Newgate/.test(r1.noteTxt) && /Ipsos/.test(r1.noteTxt),
        (r1.noteTxt || "").slice(0, 120));
  check(`${vp.tag} names link out`, r1.ok && r1.links.length > 0 &&
        r1.links.every((l) => /^https:\/\//.test(l.href) && l.tgt === "_blank" && l.mark && l.txt.endsWith("↗")),
        JSON.stringify((r1.links || []).slice(0, 3)));
  check(`${vp.tag} no empty name cells`, r1.ok && r1.emptyW === 0, "empty=" + r1.emptyW);
  /* filing hours: the multiset a dated slot prints after its name must be
     exactly hourWords(projection row) - same house, same instances. */
  const hrGot = {};
  (r1.calWi || []).forEach((w) => { if (w.hr) (hrGot[w.n] = hrGot[w.n] || []).push(w.hr.replace(/^, /, "")); });
  const hrNorm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o)
    .map(([k, v]) => [k, [...v].sort()]).sort()));
  check(`${vp.tag} fold hours == hourWords(projection)`, r1.ok && hrNorm(hrGot) === hrNorm(r1.expectedHours || {}),
        `got=${hrNorm(hrGot)} want=${hrNorm(r1.expectedHours || {})}`);
  check(`${vp.tag} at least one dated slot shows its hour`,
        r1.ok && Object.values(r1.expectedHours || {}).flat().length >= 1 && (r1.calWi || []).some((w) => w.hr),
        JSON.stringify(r1.expectedHours));
  check(`${vp.tag} overdue rows carry no hour`, r1.ok && r1.calOverT === 0, `overT=${r1.calOverT}`);
  check(`${vp.tag} hour text shaped like ', 6 pm'`, r1.ok && (r1.calHours || [])
        .every((t) => /^, (?:about )?.*(am|pm)$/.test(t)),
        JSON.stringify((r1.calHours || []).slice(0, 5)));
  if (vp.tag === "desktop") console.log("   first rows:", JSON.stringify(r1.liTexts), "quals:", JSON.stringify(r1.qualSample),
                                        "hours:", JSON.stringify(Object.values(r1.expectedHours || {}).flat().slice(0, 6)));

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
