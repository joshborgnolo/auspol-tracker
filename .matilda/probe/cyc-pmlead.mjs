/* cyc-pmlead: the Past-cycles Leadership section carries, directly under
   the full-width "Prime minister's net approval" card, a second full-width
   card - the PM's net approval LEAD over his strongest rival (user call
   2026-10-17). Per month it is the PM's net less the higher of the
   opposition leader's and Hanson's net, computed ON the aligned month
   grids in gen-data, so the card's line and the summary table's "PM net
   approval, lead" row are the one arithmetic. Hanson only ever figures in
   the sitting term (no past cycle rated her), so every past term's rival
   is its opposition leader alone. gen-data emits the pmlead grid beside
   its pairing splice (pmleadEras, named like preferred PM's union-of-
   splices eras) and single-pair name (pmleadPair); the sitting term's
   last month is clobbered with the live leaderNow pools' lead.
   Pins: card position and full width; the "Even" zero-yard tick; the
   clobbered current-term end label; the sitting term's Ley→Taylor era
   split; 1990's Hawke→Keating era names; and every cycle's grid identity
   pmlead ≡ net − max(oppnet, han) below the clobber - exact to the 0.01
   emitted step, so a renderer or emitter drifting off the shipped series
   fails here. 1963's all-null grid guards the pre-approval terms against
   fabrication. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.env.BASE || "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8985;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    let p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
try {
  await new Promise((res) => server.listen(PORT, res));
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1500 });
  await page.goto(`http://localhost:${PORT}/cycles/index.html`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForFunction(() => (document.body.textContent || "").includes("net approval lead"), { timeout: 20000 });

  const dom = await page.evaluate(() => {
    const full = [...document.querySelectorAll("body *")].find((e) =>
      e.textContent.trim().startsWith("Prime minister’s net approval lead")
      && e.children.length === 0);
    const card = full && full.closest(".rd-cyc-one");
    const cards = [...document.querySelectorAll(".rd-cyc-one")];
    const idx = cards.indexOf(card);
    const prevTitle = idx > 0 ? (cards[idx - 1].textContent || "").slice(0, 120) : "";
    const paths = card ? [...card.querySelectorAll("svg path")].filter((p) => p.getAttribute("d") && p.getAttribute("stroke-width")).length : 0;
    const svgText = card ? [...card.querySelectorAll("svg text")].map((t) => t.textContent) : [];
    const ct = card ? card.textContent : "";
    return {
      inOne: !!card,
      idx,
      prevIsNet: prevTitle.includes("net approval") && prevTitle.includes("disapprove"),
      hasEven: svgText.includes("Even"),
      hasAvg: svgText.includes("Average"),
      endLabel: svgText.filter((t) => /^Albanese/.test(t)),
      ordinarySub: /strongest rival/.test(ct),
      paths,
    };
  });
  check("card is a full-width .rd-cyc-one", dom.inOne);
  check("card sits directly after the PM net-approval card", dom.idx > 0 && dom.prevIsNet, "idx " + dom.idx);
  check("head copy names the strongest rival", dom.ordinarySub);
  check("zero-yard tick reads Even", dom.hasEven);
  check("average label and the clobbered Albanese −19.x end label show",
    dom.hasAvg && dom.endLabel.some((t) => /^Albanese −19/.test(t)), JSON.stringify(dom.endLabel));
  check("band + average + current line stroke out", dom.paths >= 3, dom.paths + " stroked paths");

  const data = await page.evaluate(() => {
    const D = window.AUSPOL;
    const cur = D.cycles.find((c) => c.current);
    const exp = +(D.leaderNow.alb_net.v - Math.max(D.leaderNow.taylor_net.v, D.leaderNow.hanson_net ? D.leaderNow.hanson_net.v : -Infinity)).toFixed(1);
    const ident = (c, skipLast) => {
      const n = c.raw.net, o = c.raw.oppnet, h = c.raw.han, l = c.raw.pmlead;
      const bad = [];
      for (let i = 0; i < n.length; i++) {
        if (skipLast && i === n.length - 1) continue;
        const rival = Math.max(o[i] != null ? o[i] : -Infinity, h[i] != null ? h[i] : -Infinity);
        const want = n[i] != null && rival !== -Infinity ? +(n[i] - rival).toFixed(2) : null;
        if (l[i] !== want) bad.push(`m${c.raw.months[i]}:${l[i]}!=${want}`);
      }
      return bad;
    };
    const h90 = D.cycles.find((c) => c.year === 1990);
    const c63 = D.cycles.find((c) => c.year === 1963);
    const c75 = D.cycles.find((c) => c.year === 1975);
    return {
      exp, curEnd: cur.end.pmlead,
      curBad: ident(cur, true), h90Bad: ident(h90), c75Bad: ident(c75),
      lastGrid: cur.raw.pmlead[cur.raw.pmlead.length - 1],
      lastObs: cur.raw.obs.pmlead[cur.raw.obs.pmlead.length - 1],
      obsLenOk: cur.raw.obs.pmlead.length === cur.raw.months.length,
      pair: cur.raw.pmleadPair,
      eras: (cur.raw.pmleadEras || []).map((e) => ({ n: e.name, last: e.vals.filter((v) => v != null).pop() })),
      h90pair: h90.raw.pmleadPair,
      h90eras: (h90.raw.pmleadEras || []).map((e) => ({
        n: e.name,
        firstMeasured: e.months[e.vals.findIndex((v) => v != null)],
        lastMeasured: e.months[e.vals.length - 1 - [...e.vals].reverse().findIndex((v) => v != null)],
      })),
      c75pair: c75.raw.pmleadPair,
      c75eras: c75.raw.pmleadEras || null,
      c63null: c63.raw.pmlead.every((v) => v == null) && c63.raw.obs.pmlead.every((b) => !b),
      baseOk: cur.base.pmlead === cur.raw.pmlead[0],
    };
  });
  check("sitting term end equals the pools' lead over the stronger rival", data.curEnd === data.exp, `end ${data.curEnd} vs exp ${data.exp}`);
  check("clobbered last grid month carries that figure, flagged observed", data.lastGrid === data.exp && data.lastObs === true, `last ${data.lastGrid} obs ${data.lastObs}`);
  check("sitting term grid ≡ net − max(oppnet, han) below the clobber", data.curBad.length === 0, data.curBad.slice(0, 3).join("; "));
  check("1990 grid ≡ net − oppnet exactly", data.h90Bad.length === 0, data.h90Bad.slice(0, 3).join("; "));
  check("1975 grid ≡ net − oppnet exactly", data.c75Bad.length === 0, data.c75Bad.slice(0, 3).join("; "));
  check("obs grid tracks the month spine", data.obsLenOk);
  check("base slot is the first grid month", data.baseOk);
  check("sitting pairing starts 'Albanese v Ley'", data.pair === "Albanese v Ley", String(data.pair));
  check("sitting eras splice Ley → Taylor, the Taylor run ending clobbered",
    data.eras.length >= 2 && data.eras[0].n === "Albanese v Ley" && data.eras[data.eras.length - 1].n === "Albanese v Taylor" && data.eras[data.eras.length - 1].last === data.exp,
    JSON.stringify(data.eras));
  check("1990 pair is Hawke v Hewson", data.h90pair === "Hawke v Hewson", String(data.h90pair));
  check("1990 eras splice Hawke → Keating at the Dec-1991 month",
    data.h90eras.length === 2 && data.h90eras[0].n === "Hawke v Hewson" && data.h90eras[1].n === "Keating v Hewson"
      && data.h90eras[0].lastMeasured === 20 && data.h90eras[1].firstMeasured === 21,
    JSON.stringify(data.h90eras));
  check("1975 keeps one pairing, no era split", data.c75pair === "Fraser v Whitlam" && !data.c75eras, `${data.c75pair} eras:${JSON.stringify(data.c75eras)}`);
  check("pre-approval-era 1963 grid is empty, not fabricated", data.c63null === true);
} finally {
  await browser.close();
  server.close();
}
process.exit(fails ? 1 : 0);
