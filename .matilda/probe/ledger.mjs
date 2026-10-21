/* The poll ledger (RdLedger, rd-allpolls.jsx): one renderer for an opened
   poll in All polls and in the Latest and next polls table (user call
   2026-10-11, design A of two mocked). Pins:
     1. every All-polls tab opens the poll on that tab's own measure (the
        lead), beside How it counts, with the poll's other measures as one
        line each - never the open tab's own;
     2. the Latest table opens the same ledger: its tab leads, the release
        rhythm is the companion;
     3. pressing a line switches All polls to that tab with the row held on
        its pixel, and switches the Latest table's own tabs in place;
     4. printed figures the old views never showed: a second published 2PP on
        2025 flows, Fox & Hedgehog's Coalition v One Nation and three-cornered
        figures, a printed rival share that leaves undecided inside the
        hundred (Essential's 48-46);
     5. a change prints at the figure's printed precision (a half-point move
        reads its half, never "▼ 0");
     6. the Primary tab's How it counts: one strip per party, and a
        reckoning whose rows are the bundle's own pyd/peff, summing down
        the column;
     7. no sideways scroll with a poll open at 320-1440px, and none from the
        pinned bar at 761-790px on Confidence;
     8. no page errors;
     9. the To One Nation line trips out to the switching panel: cross-tab
        from All polls (history back returns with the poll still open),
        a same-tab scroll from the Latest table;
    10. the Public opinion line trips out to the /public-opinion/ page's
        By-pollster view, landed on the pollster's own group - away from
        BOTH ledger homes, so the Latest table's line is ↗ too.
   Truth comes from the page's own bundle (window.AUSPOL): the probe pins the
   WIRING, never the day's data.
   Run from the repo root: node .matilda/probe/ledger.mjs
   Rebuild first (node .build/newtracker/build.mjs) - probes the BUILT pages. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable"); process.exit(2); }

const PORT = 8957;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
/* a page navigating away aborts its in-flight requests; writing 200 or 404
   onto a dead socket throws ERR_HTTP_HEADERS_SENT and takes the probe's
   node process down with it (observed 2026-10-21 under box load), so the
   write is dropped where the client already hung up */
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(join(ROOT, p));
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { if (!res.destroyed && !res.headersSent) { res.writeHead(404); res.end(); } }
});
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://127.0.0.1:${PORT}`;

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 240) : ""));
  if (!cond) bad++;
};
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const errors = [];
const newPage = async (w, h = 1600) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(w + ": " + e.message));
  await page.setViewport({ width: w, height: h, isMobile: w < 640, hasTouch: w < 640 });
  return page;
};
const toAllPolls = async (page, q = "") => {
  await page.goto(BASE + "/allpolls/" + q, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
  await settle(500);
};
const tab = async (page, lab) => {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll(".rd-ap-tabs [role=group] button")].find((n) => (n.textContent || "").trim() === l);
    if (b) b.click();
  }, lab);
  await settle(700);
};
/* open the newest row of a house on the current tab (desktop rows or phone cards) */
const openHouse = (page, house) => page.evaluate(async (h) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nameOf = (n) => ((n.querySelector("[role=rowheader] b, .rd-ap-firm") || {}).textContent || "").replace(/↗/g, "").trim();
  const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].find((n) => nameOf(n) === h);
  if (!row) return false;
  const op = document.querySelector(".rd-ap-row.open, .rd-ap-card.open");
  if (op && op !== row) { op.click(); await wait(250); }
  if (!row.classList.contains("open")) row.click();
  await wait(700);
  return true;
}, house);
const ledgerOf = (page) => page.evaluate(() => {
  const lg = document.querySelector(".rd-ap-open .rd-ldg");
  if (!lg) return null;
  const norm = (t) => (t || "").replace(/\s+/g, " ").trim();
  const lead = lg.querySelector(":scope > .rd-ldg-lead");
  return {
    head: norm((lg.querySelector(".rd-ldg-sent") || {}).textContent),
    srcs: [...lg.querySelectorAll(".rd-ldg-srcs a, .rd-ldg-srcs button")].map((a) => norm(a.textContent)),
    leadH: norm((lead && lead.querySelector(".rd-ldg-h, .rd-apd-h") || {}).textContent),
    has: {
      tpp: !!(lead && lead.querySelector(".rd-ldg-tpp")), prim: !!(lead && lead.querySelector(".rd-ldg-prim")),
      ldr: !!(lead && lead.querySelector(".rd-ldg-ldr, .rd-ldg-ppm")), dir: !!(lead && lead.querySelector(".rd-ldg-dir")),
      iss: !!(lead && lead.querySelector(".rd-apd-isr")), dem: !!(lead && lead.querySelector(".rd-apd-demr:not(.rd-apd-isr)")),
      conf: !!(lead && lead.querySelector(".rd-ldg-conf")),
    },
    side: norm((lg.querySelector(":scope > .rd-ldg-side") || {}).textContent),
    rk: !!lg.querySelector(".rd-ldg-side .rd-ldg-rk"),
    lines: [...lg.querySelectorAll(".rd-ldg-line .rd-ldg-lab")].map((n) => norm(n.textContent)),
    leadText: norm(lead && lead.textContent),
    text: norm(lg.textContent),
  };
});

/* ---------------------------------------------------------------- 1, 4, 5, 6 */
console.log("== All polls: each tab leads with its own measure ==");
{
  const page = await newPage(1440);
  await toAllPolls(page);
  const TABS = [
    ["2PP", "RedBridge/Accent", "tpp", "Two-party preferred", "2PP"],
    ["Primary", "Roy Morgan", "prim", "Primary vote, %", "Primary"],
    ["Leadership", "Newspoll", "ldr", "Leaders", "Leadership"],
    ["Direction", "SEC Newgate", "dir", "The country is heading", "Direction"],
    ["Issues", "Ipsos", "iss", "Issue by issue", "Issues"],
    ["Demographics", "YouGov", "dem", "The vote by group", "Demographics"],
  ];
  for (const [t, house, k, head, lineLab] of TABS) {
    await tab(page, t);
    const opened = await openHouse(page, house);
    const L = opened ? await ledgerOf(page) : null;
    ok(`${t}: ${house} opens on the tab's measure`, !!L && L.has[k] && L.leadH.startsWith(head), L ? L.leadH + " · " + JSON.stringify(L.has) : "no ledger");
    ok(`${t}: the head band carries the sentence and Report an error`, !!L && /^Conducted on|^From /.test(L.head) && L.srcs.includes("Report an error"), L ? L.srcs.join(" | ") : "");
    ok(`${t}: How it counts sits beside it`, !!L && /^How it (counts|reads)/.test(L.side), L ? L.side.slice(0, 60) : "");
    ok(`${t}: no line repeats the open tab's measure`, !!L && !L.lines.includes(lineLab.toUpperCase()) && !L.lines.includes(lineLab), L ? L.lines.join(" | ") : "");
    if (["2PP", "Primary", "Leadership", "Direction"].includes(t))
      ok(`${t}: How it counts is a reckoning`, !!L && L.rk, L ? L.side.slice(0, 90) : "");
  }
  await tab(page, "Confidence");
  const confOpened = await page.evaluate(async () => { const r = document.querySelector(".rd-ap-row"); if (!r) return false; r.click(); await new Promise((x) => setTimeout(x, 600)); return true; });
  const LC = confOpened ? await ledgerOf(page) : null;
  ok("Confidence: a release opens on its gauge, How it reads beside it", !!LC && LC.has.conf && /^How it reads/.test(LC.side), LC ? LC.leadH : "no ledger");

  /* 4: figures the old views never showed */
  const truth = await page.evaluate(() => {
    const P = window.AUSPOL.individualPolls;
    const newest = (h, f) => P.filter((p) => p.pollster === h && (!f || f(p))).sort((a, b) => (a.released < b.released ? 1 : -1))[0];
    const flows = newest("RedBridge/Accent", (p) => p.tppFlows != null) || newest("Roy Morgan", (p) => p.tppFlows != null);
    const fox = newest("Fox & Hedgehog", (p) => p.tpp3 && p.tppAlt2);
    const ess = newest("Essential", (p) => p.alp != null && p.lnp != null && Math.abs(p.alp + p.lnp - 100) > 0.5);
    return {
      flows: flows && { h: flows.pollster, r: flows.released, v: flows.tppFlows },
      fox: fox && { r: fox.released, t3: fox.tpp3, a2: fox.tppAlt2 },
      ess: ess && { r: ess.released, a: ess.alp, b: ess.lnp },
    };
  });
  await tab(page, "2PP");
  const openKey = async (h, r) => { await page.evaluate((k) => window.AP.openPoll(k, "twopp", "the probe"), window_key(h, r)); await settle(900); };
  function window_key(h, r) { return h + "|" + r; }
  if (truth.flows) {
    await openKey(truth.flows.h, truth.flows.r);
    const L = await ledgerOf(page);
    ok(`${truth.flows.h}'s second published pair, on 2025 flows, shows (${truth.flows.v}–${100 - truth.flows.v})`,
       !!L && /Published, on 20\d\d flows/.test(L.leadText) && L.leadText.includes(truth.flows.v + "–" + (100 - truth.flows.v)), L ? L.leadText.slice(0, 200) : "no ledger");
  } else console.log("  --  no 2025-flows wave in the bundle: skipped");
  if (truth.fox) {
    await openKey("Fox & Hedgehog", truth.fox.r);
    const L = await ledgerOf(page);
    ok(`Fox & Hedgehog's Coalition v One Nation (${truth.fox.a2.lnp}–${truth.fox.a2.onp}) and three-cornered split show`,
       !!L && L.leadText.includes("Coalition v One Nation") && L.leadText.includes(truth.fox.a2.lnp + "–" + truth.fox.a2.onp)
         && L.leadText.includes("Three-cornered") && L.leadText.includes("ON " + truth.fox.t3.onp), L ? L.leadText.slice(0, 260) : "no ledger");
  } else console.log("  --  no Fox & Hedgehog three-cornered wave: skipped");
  if (truth.ess) {
    await openKey("Essential", truth.ess.r);
    const L = await ledgerOf(page);
    ok(`Essential's printed pair keeps its undecided inside the hundred (${truth.ess.a}–${truth.ess.b})`,
       !!L && L.leadText.includes(truth.ess.a + "–" + truth.ess.b), L ? L.leadText.slice(0, 200) : "no ledger");
  } else console.log("  --  no Essential wave with an undecided residue: skipped");

  /* 5: a half-point published move prints its half */
  const half = await page.evaluate(() => {
    const P = window.AUSPOL.individualPolls;
    const keys = [["alp2pp", "lnp"], ["altAlpOn", "onp"]];
    for (const p of [...P].sort((a, b) => (a.released < b.released ? 1 : -1))) {
      const d = (p.chg && p.chg.d) || {};
      for (const [k, c] of keys) if (d[k] != null && Math.abs(Math.abs(d[k]) - 0.5) < 0.01) return { h: p.pollster, r: p.released, k, d: d[k], c };
    }
    return null;
  });
  if (half) {
    await openKey(half.h, half.r);
    const L = await ledgerOf(page);
    const want = (half.d > 0 ? "▲ " : "▼ ") + "0.5";
    ok(`a half-point change prints its half (${half.h} ${half.r} ${half.k}: "${want}")`, !!L && L.leadText.includes(want), L ? L.leadText.slice(0, 220) : "no ledger");
    ok("…and nowhere reads a bare ▲/▼ 0", !!L && !/[▲▼] 0(?![.\d])/.test(L.leadText), L ? (L.leadText.match(/[▲▼] 0(?![.\d])/) || [""])[0] : "");
  } else console.log("  --  no half-point published change in the bundle: skipped");

  /* 6: the Primary tab's How it counts adds up */
  await tab(page, "Primary");
  for (const house of ["Roy Morgan", "RedBridge/Accent"]) {
    await openHouse(page, house);
    const R = await page.evaluate((h) => {
      const lg = document.querySelector(".rd-ap-open .rd-ldg");
      const tbl = lg && lg.querySelector(".rd-ldg-rkp");
      if (!tbl) return null;
      const heads = [...tbl.querySelectorAll("thead th.num")].map((n) => n.textContent.trim());
      const rows = Object.fromEntries([...tbl.querySelectorAll("tbody tr")].map((tr) => [tr.querySelector("th").textContent.trim(), [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())]));
      const strips = lg.querySelectorAll(".rd-ldg-prow:not(.rd-ldg-phead)").length;
      const P = window.AUSPOL.individualPolls.filter((p) => p.pollster === h).sort((a, b) => (a.released < b.released ? 1 : -1));
      const field = (lg.querySelector(".rd-ldg-sent") || {}).textContent || "";
      const p = P.find((q) => field.includes(q.field)) || P[0];
      return { heads, rows, strips, p: { p: p.p, pyd: p.pyd, peff: p.peff, noAgg: !!p.noAgg } };
    }, house);
    if (!R) { ok(`Primary: ${house}'s reckoning present`, false, "no table"); continue; }
    const LABK = { ON: "onp", ALP: "alp", "L/NP": "lnp", GRN: "grn", OTH: "oth" };
    const num = (t) => (t === "—" ? null : +t.replace("−", "-").replace("+", ""));
    const off = [];
    R.heads.forEach((lab, j) => {
      const k = LABK[lab], y = R.p.pyd[k];
      const x = R.p.p[k], v = y[0], he = y[1];
      const lean = Math.round((x - v) * 10) / 10, less = he == null ? null : Math.round((lean - he) * 10) / 10;
      const cell = (row) => num((R.rows[row] || [])[j]);
      if (cell("This poll") !== +x) off.push(lab + " this poll");
      if (Math.abs(cell("Polls around it") - v) > 0.001) off.push(lab + " around");
      if (Math.abs(cell("Lean") - lean) > 0.001) off.push(lab + " lean");
      if (he != null && Math.abs(cell("House lean") - he) > 0.001) off.push(lab + " house lean");
      if (less != null && Math.abs(cell("Less house lean") - less) > 0.001) off.push(lab + " less");
      const pe = R.p.peff;
      const pr = pe && (pe.w ? pe[k] : pe.t && pe.t[k]);
      const mv = R.rows["Moves today’s"] || R.rows["Moved them on release"];
      if (pr && mv && Math.abs(num(mv[j]) - Math.round((pr[1] - pr[0]) * 10) / 10) > 0.001) off.push(lab + " moves");
    });
    ok(`Primary: ${house}'s reckoning is the bundle's pyd/peff, summing down the column`, off.length === 0, off.join(", ") || R.heads.join(" "));
    ok(`Primary: ${house} draws one strip per party`, R.strips === R.heads.length, R.strips + " strips, " + R.heads.length + " parties");
  }
  await page.close();
}

/* ---------------------------------------------------------------- 3: the line press */
console.log("== a line press ==");
{
  const page = await newPage(1440, 2400);
  await toAllPolls(page);
  await openHouse(page, "RedBridge/Accent");
  const line = await page.evaluateHandle(() => [...document.querySelectorAll(".rd-ap-open .rd-ldg-line.go")].find((n) => /Leadership/i.test(n.textContent)));
  await page.evaluate((el) => el && el.scrollIntoView({ block: "center", behavior: "instant" }), line);
  await settle(300);
  const before = await page.evaluate(() => Math.round(document.querySelector(".rd-ap-row.open").getBoundingClientRect().top));
  const box = await line.boundingBox();
  if (box) await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await settle(1200);
  const after = await page.evaluate(() => {
    const row = document.querySelector(".rd-ap-row.open");
    const tabOn = ([...document.querySelectorAll(".rd-ap-tabs [role=group] button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent;
    const lead = document.querySelector(".rd-ap-open .rd-ldg-lead .rd-ldg-h");
    return { top: row ? Math.round(row.getBoundingClientRect().top) : null, tab: tabOn, lead: lead && lead.textContent };
  });
  ok("All polls: pressing the Leadership line opens the Leadership tab on the same poll", after.tab && after.tab.trim() === "Leadership" && after.lead === "Leaders", JSON.stringify(after));
  ok("…with the row held on its pixel", after.top != null && Math.abs(after.top - before) <= 2, `${before} → ${after.top}`);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.waitForSelector(".rd-pl-row");
  const lat = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item")].find((n) => /RedBridge/.test(n.querySelector(".rd-pl-c-name").textContent));
    item.querySelector(".rd-pl-c-figs").click();
    await wait(600);
    const lg = item.querySelector(".rd-ldg");
    const side = lg && lg.querySelector(":scope > .rd-ldg-side .rd-pld-rhythm");
    const lead0 = lg && (lg.querySelector(".rd-ldg-lead .rd-ldg-h") || {}).textContent;
    const ln = lg && [...lg.querySelectorAll(".rd-ldg-line.go")].find((n) => /Primary/.test(n.textContent));
    if (ln) ln.click();
    await wait(800);
    const lead1 = (item.querySelector(".rd-ldg-lead .rd-ldg-h") || {}).textContent;
    const tabOn = ([...document.querySelectorAll("#latest-polls .rd-pl-tabs button")].find((b) => b.getAttribute("aria-pressed") === "true" || b.classList.contains("on")) || {}).textContent;
    const away = lg && [...lg.querySelectorAll(".rd-ldg-line.go .rd-ldg-arrow")].map((a) => a.textContent);
    return { ledger: !!lg, rhythm: !!side, lead0, lead1, tabOn, open: item.classList.contains("open"), away };
  });
  ok("Latest: the row opens the same ledger, the release rhythm beside it", lat.ledger && lat.rhythm && lat.lead0 === "Two-party preferred", JSON.stringify(lat).slice(0, 200));
  ok("Latest: pressing the Primary line switches the table's own tab in place", lat.open && lat.lead1 === "Primary vote, %", JSON.stringify({ lead1: lat.lead1, tab: lat.tabOn }));
  ok("Latest: lines for tabs this table lacks point out (↗)", Array.isArray(lat.away) && lat.away.includes("↗"), JSON.stringify(lat.away));
  await page.close();
}

/* ---------------------------------------------------------------- 9: the To One Nation line */
console.log("== the To One Nation line trips to the switching panel ==");
{
  const page = await newPage(1440, 2400);
  await toAllPolls(page);
  const swv = await page.evaluate(() => {
    const P = window.AUSPOL.individualPolls.filter((p) => p.sw).sort((a, b) => (a.released < b.released ? 1 : -1));
    return P.length ? { h: P[0].pollster, r: P[0].released } : null;
  });
  if (!swv) console.log("  --  no vote-switching wave in the bundle: skipped");
  else {
    await page.evaluate((k) => window.AP.openPoll(k, "twopp", "the probe"), swv.h + "|" + swv.r);
    await settle(900);
    const meta = await page.evaluate(() => {
      const l = [...document.querySelectorAll(".rd-ap-open .rd-ldg-line")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "To One Nation");
      return l ? { tag: l.tagName, go: l.classList.contains("go"), title: l.getAttribute("title") || "", arrow: (l.querySelector(".rd-ldg-arrow") || {}).textContent } : null;
    });
    ok(`All polls: ${swv.h}'s To One Nation line is a go line, tipped for the Snapshot (↗)`,
       !!meta && meta.tag === "BUTTON" && meta.go && meta.title === "Open where One Nation’s voters came from on the Snapshot" && meta.arrow === "↗", JSON.stringify(meta));
    const line = await page.evaluateHandle(() => [...document.querySelectorAll(".rd-ap-open .rd-ldg-line.go")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "To One Nation"));
    await page.evaluate((el) => el && el.scrollIntoView({ block: "center", behavior: "instant" }), line);
    await settle(300);
    const box = await line.boundingBox();
    if (box) await page.mouse.click(box.x + 30, box.y + box.height / 2);
    await settle(1400);
    const hop = await page.evaluate(() => {
      const sec = document.getElementById("switching");
      return { path: window.location.pathname, secTop: sec ? Math.round(sec.getBoundingClientRect().top) : null };
    });
    ok("…pressing it lands the Snapshot on the switching panel", hop.path === "/" && hop.secTop != null && hop.secTop >= 30 && hop.secTop <= 160, JSON.stringify(hop));
    await page.evaluate(() => window.history.back());
    await settle(1400);
    const back = await page.evaluate((h) => {
      const row = document.querySelector(".rd-ap-row.open");
      const nm = row ? ((row.querySelector("[role=rowheader] b") || {}).textContent || "") : "";
      return { path: window.location.pathname, nm, drawer: !!document.querySelector(".rd-ap-open .rd-ldg") };
    }, swv.h);
    ok("…and history back returns to All polls with the poll still open", back.path === "/allpolls/" && back.drawer && back.nm.includes(swv.h), JSON.stringify(back));
  }
  await page.close();

  const page2 = await newPage(1440, 2400);
  await page2.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 90000 });
  await page2.waitForSelector(".rd-pl-row", { timeout: 30000 });
  await settle(500);
  const lat = await page2.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const houses = new Set(window.AUSPOL.individualPolls.filter((p) => p.sw).map((p) => p.pollster));
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item")].find((n) => {
      const nm = (n.querySelector(".rd-pl-c-name") || {}).textContent || "";
      return [...houses].some((h) => nm.includes(h));
    });
    if (!item) return { skip: "no vote-switching house in the latest table" };
    const name = item.querySelector(".rd-pl-c-name").textContent.replace(/↗/g, "").trim();
    item.querySelector(".rd-pl-c-figs").click();
    await wait(700);
    const line = [...item.querySelectorAll(".rd-ldg-line")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "To One Nation");
    if (!line) return { skip: name + " carries no switching line" };
    const meta = { tag: line.tagName, go: line.classList.contains("go"), title: line.getAttribute("title") || "", arrow: (line.querySelector(".rd-ldg-arrow") || {}).textContent };
    line.click();
    await wait(1000);
    const sec = document.getElementById("switching");
    return { name, meta, path: window.location.pathname, secTop: sec ? Math.round(sec.getBoundingClientRect().top) : null, stillOpen: item.classList.contains("open") };
  });
  if (lat.skip) console.log("  --  " + lat.skip);
  else {
    ok(`Latest: ${lat.name}'s line is a go line tipped to the panel on this page (→)`,
       lat.meta.tag === "BUTTON" && lat.meta.go && lat.meta.title === "Show where One Nation’s voters came from" && lat.meta.arrow === "→", JSON.stringify(lat.meta));
    ok("…pressing it scrolls to the switching panel, row still open", lat.path === "/" && lat.secTop != null && lat.secTop >= 30 && lat.secTop <= 160 && lat.stillOpen, JSON.stringify({ secTop: lat.secTop, stillOpen: lat.stillOpen }));
  }
  await page2.close();
}

/* ---------------------------------------------------------------- 10: the Public opinion line */
console.log("== the Public opinion line trips to the pollster’s group ==");
{
  const page = await newPage(1440, 2400);
  await toAllPolls(page);
  const opw = await page.evaluate(() => {
    const bo = window.AUSPOL.beyondByRow || {};
    const ks = Object.keys(bo);
    if (!ks.length) return null;
    const k = ks.sort((a, b) => (a.split("|")[1] < b.split("|")[1] ? 1 : -1))[0];
    const p = k.split("|");
    return { key: k, h: p[0], r: p[1], store: bo[k].h, n: bo[k].n };
  });
  if (!opw) console.log("  --  no beyondByRow entry in the bundle: skipped");
  else {
    await page.evaluate((k) => window.AP.openPoll(k, "twopp", "the probe"), opw.key);
    await settle(900);
    const meta = await page.evaluate(() => {
      const l = [...document.querySelectorAll(".rd-ap-open .rd-ldg-line")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "Public opinion");
      return l ? { tag: l.tagName, go: l.classList.contains("go"), title: l.getAttribute("title") || "", arrow: (l.querySelector(".rd-ldg-arrow") || {}).textContent, body: (l.querySelector(".rd-ldg-lbody") || {}).textContent || "" } : null;
    });
    ok(`All polls: ${opw.h}'s Public opinion line is a go line, tipped for the page (↗)`,
       !!meta && meta.tag === "BUTTON" && meta.go && meta.title === "Open what else this poll asked on Public opinion" && meta.arrow === "↗", JSON.stringify(meta));
    ok(`…the line counts its ${opw.n} question${opw.n === 1 ? "" : "s"} in the body`, !!meta && meta.body.includes(`${opw.n} question`), meta && meta.body.slice(-160));
    const line = await page.evaluateHandle(() => [...document.querySelectorAll(".rd-ap-open .rd-ldg-line.go")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "Public opinion"));
    await page.evaluate((el) => el && el.scrollIntoView({ block: "center", behavior: "instant" }), line);
    await settle(300);
    const box = await line.boundingBox();
    if (box) await page.mouse.click(box.x + 30, box.y + box.height / 2);
    await settle(1600);
    const hop = await page.evaluate((store) => {
      const sec = document.getElementById("btv-p-" + store);
      const pressed = document.querySelector(".btv-sort-b[aria-pressed=true]");
      return { path: window.location.pathname, sort: pressed ? pressed.textContent.trim() : null, secTop: sec ? Math.round(sec.getBoundingClientRect().top) : null };
    }, opw.store);
    ok(`…pressing it lands the Public opinion page’s By-pollster view on the ${opw.h} group (#btv-p-${opw.store} at its 64px clearance)`,
       hop.path === "/public-opinion/" && hop.sort === "By pollster" && hop.secTop != null && hop.secTop >= 30 && hop.secTop <= 160, JSON.stringify(hop));
    await page.evaluate(() => window.history.back());
    await settle(1400);
    const back = await page.evaluate((h) => {
      const row = document.querySelector(".rd-ap-row.open");
      const nm = row ? ((row.querySelector("[role=rowheader] b") || {}).textContent || "") : "";
      return { path: window.location.pathname, nm, drawer: !!document.querySelector(".rd-ap-open .rd-ldg") };
    }, opw.h);
    ok("…and history back returns to All polls with the poll still open", back.path === "/allpolls/" && back.drawer && back.nm.includes(opw.h), JSON.stringify(back));
  }
  await page.close();

  const page2 = await newPage(1440, 2400);
  await page2.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 90000 });
  await page2.waitForSelector(".rd-pl-row", { timeout: 30000 });
  await settle(500);
  const lat = await page2.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const bo = window.AUSPOL.beyondByRow || {};
    const houses = [...new Set(Object.keys(bo).map((k) => k.split("|")[0]))];
    if (!houses.length) return { skip: "no beyondByRow entry in the bundle" };
    let item = null, line = null, name = "";
    for (const it of document.querySelectorAll("#latest-polls .rd-pl-item")) {
      const nm = ((it.querySelector(".rd-pl-c-name") || {}).textContent || "").replace(/↗/g, "").trim();
      if (!houses.some((h) => nm.includes(h))) continue;
      it.querySelector(".rd-pl-c-figs").click();
      await wait(700);
      const l = [...it.querySelectorAll(".rd-ldg-line")].find((n) => (n.querySelector(".rd-ldg-lab") || {}).textContent === "Public opinion");
      if (l) { item = it; line = l; name = nm; break; }
    }
    if (!item) return { skip: "no latest-table wave pairs a Public opinion line" };
    const ip = window.AUSPOL.individualPolls.filter((p) => name.includes(p.pollster) && bo[p.pollster + "|" + p.released]).sort((a, b) => (a.released < b.released ? 1 : -1))[0];
    const meta = { tag: line.tagName, go: line.classList.contains("go"), title: line.getAttribute("title") || "", arrow: (line.querySelector(".rd-ldg-arrow") || {}).textContent };
    line.click();
    await wait(1600);
    const sec = ip ? document.getElementById("btv-p-" + bo[ip.pollster + "|" + ip.released].h) : null;
    const pressed = document.querySelector(".btv-sort-b[aria-pressed=true]");
    return { name, store: ip ? bo[ip.pollster + "|" + ip.released].h : null, meta, path: window.location.pathname,
             sort: pressed ? pressed.textContent.trim() : null, secTop: sec ? Math.round(sec.getBoundingClientRect().top) : null };
  });
  if (lat.skip) console.log("  --  " + lat.skip);
  else {
    ok(`Latest: ${lat.name}'s line is away from the Snapshot too, tipped for the page (↗)`,
       lat.meta.tag === "BUTTON" && lat.meta.go && lat.meta.title === "Open what else this poll asked on Public opinion" && lat.meta.arrow === "↗", JSON.stringify(lat.meta));
    ok(`…pressing it lands the By-pollster view on #btv-p-${lat.store}`, lat.path === "/public-opinion/" && lat.sort === "By pollster" && lat.secTop != null && lat.secTop >= 30 && lat.secTop <= 160, JSON.stringify({ secTop: lat.secTop, sort: lat.sort }));
  }
  await page2.close();
}

/* ---------------------------------------------------------------- 7: overflow */
console.log("== no sideways scroll ==");
{
  const off = [];
  for (const w of [320, 390, 768, 1024, 1440]) {
    const page = await newPage(w, 1400);
    await toAllPolls(page);
    for (const t of ["2PP", "Primary", w < 761 ? "Leaders" : "Leadership", "Direction", "Issues", "Demographics", "Confidence"]) {
      await tab(page, t);
      for (const h of ["RedBridge/Accent", "Roy Morgan", "Newspoll", "YouGov"]) {
        if (!(await openHouse(page, h))) continue;
        const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (o > 0) off.push(`${w} ${t} ${h} +${o}`);
      }
    }
    await page.goto(BASE + "/", { waitUntil: "networkidle0" });
    await page.waitForSelector(".rd-pl-row");
    const lo = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      for (const item of document.querySelectorAll("#latest-polls .rd-pl-item")) {
        item.querySelector(".rd-pl-c-figs").click();
        await wait(250);
        const o = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        if (o > 0) out.push(item.querySelector(".rd-pl-c-name").textContent + " +" + o);
        item.querySelector(".rd-pl-c-figs").click();
        await wait(100);
      }
      return out;
    });
    lo.forEach((x) => off.push(`${w} latest ${x}`));
    await page.close();
  }
  ok("no sideways scroll with a poll open, 320-1440px, both tables", off.length === 0, off.slice(0, 6).join(" | "));
  const pin = [];
  for (const w of [761, 768, 775, 790]) {
    const page = await newPage(w, 1000);
    await toAllPolls(page, "?f=c");
    await page.evaluate(() => window.scrollTo(0, document.querySelector(".rd-ap-table").getBoundingClientRect().top + window.scrollY + 400));
    await settle(400);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) pin.push(`${w} +${o}`);
    await page.close();
  }
  ok("the pinned bar seats Confidence's tabs and count at 761-790px", pin.length === 0, pin.join(" | "));
}

ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(bad ? `\n${bad} FAIL` : "\nledger: ALL CHECKS PASSED");
process.exit(bad ? 1 : 0);
