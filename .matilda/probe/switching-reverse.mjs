/* switching-reverse: the "Where One Nation's voters came from" mosaic draws
   each party's share of One Nation's GAIN as the fill (bar height on laptop,
   fill width on phone) and puts the RATE (share of that party's 2025 voters
   now backing One Nation) in the text under the bars. Asserts the fill
   geometry against AP data, the in-fill figure = gain share, the under-text
   = rate, the key/no-area wording, the kept column untouched, and no page
   overflow — at 1280 and 390. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8971;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    const body = await readFile(p.endsWith("/") ? p + "index.html" : p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    for (const vw of [1280, 390]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: vw, height: 900 });
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#switching", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));

      const exp = await page.evaluate(() => {
        const D = window.AP.D, S = D.onSources;
        const Wt = S.weights || {};
        const byId = {};
        S.series.forEach((sr) => { byId[sr.id] = sr; });
        const recent = (S.waves || []).slice(-(S.now && S.now.n ? S.now.n : 5));
        const keptPct = recent.length ? recent.reduce((s, w) => s + w.keptPct * (w.sample || 1), 0) / recent.reduce((s, w) => s + (w.sample || 1), 0) : null;
        const out = {};
        ["lnp", "alp", "oth", "grn"].filter((id) => byId[id]).forEach((id) => {
          out[id] = { gain: byId[id].now.v, rate: byId[id].rate.now.v };
        });
        return { cols: out, keptPct };
      });
      const fmt1 = (v) => v.toFixed(1);
      const expected = { cols: exp.cols, keptPct: exp.keptPct, fmt1 };

      if (vw === 1280) {
        const geo = await page.evaluate(() => {
          const svg = document.querySelector("#switching svg.rd-mo");
          const gs = [...svg.querySelectorAll("g")];
          return gs.map((g) => {
            const nm = g.querySelector(".rd-mo-nm") ? g.querySelector(".rd-mo-nm").textContent.trim() : "";
            const fill = g.querySelector(".rd-mo-fill");
            const sh = g.querySelector(".rd-mo-sh") ? g.querySelector(".rd-mo-sh").textContent.trim() : "";
            const big = g.querySelector(".rd-mo-rate");
            const mid = g.querySelector(".rd-mo-rates");
            return { nm, h: fill ? +fill.getAttribute("height") : null, sh,
                     big: big ? big.textContent.trim() : null, mid: mid ? mid.textContent.trim() : null,
                     cap: g.querySelector(".rd-mo-onfill") ? g.querySelector(".rd-mo-onfill").textContent.trim() : null };
          });
        });
        const order = ["lnp", "alp", "oth", "grn", "onp"];
        const keyed = {};
        geo.forEach((g) => {
          const id = /^Coalition/.test(g.nm) ? "lnp" : /^Labor/.test(g.nm) ? "alp" : /^Others/.test(g.nm) ? "oth" : /^Greens/.test(g.nm) ? "grn" : /^(One Nation|ON)$/.test(g.nm) ? "onp" : null;
          if (id) keyed[id] = g;
        });
        check("[1280] mosaic draws every party column", order.every((id) => keyed[id]), geo.map((g) => g.nm).join("|"));
        for (const id of ["lnp", "alp", "oth", "grn"]) {
          if (!keyed[id]) continue;
          const want = (expected.cols[id].gain / 100) * 240;
          check(`[1280] ${id} fill height = gain share`, Math.abs(keyed[id].h - want) < 0.5,
                `got ${keyed[id].h}, want ${want.toFixed(1)} (gain ${expected.fmt1(expected.cols[id].gain)})`);
          check(`[1280] ${id} under-bar text carries the rate`, keyed[id].sh.startsWith(expected.fmt1(expected.cols[id].rate) + "%"),
                `got "${keyed[id].sh}"`);
          const fig = id === "lnp" ? keyed[id].big : keyed[id].mid;
          check(`[1280] ${id} in-fill figure is the gain share`, fig === expected.fmt1(expected.cols[id].gain) + "%",
                `got "${fig}", want ${expected.fmt1(expected.cols[id].gain)}%`);
        }
        check("[1280] first column captions the fill as the gain", keyed.lnp && keyed.lnp.cap === "of One Nation’s gain", keyed.lnp ? keyed.lnp.cap : "(none)");
        if (keyed.onp) {
          const want = (expected.keptPct / 100) * 240;
          check("[1280] kept column height still its own share", Math.abs(keyed.onp.h - want) < 0.5, `got ${keyed.onp.h}, want ${want.toFixed(1)}`);
        }
        const strip = await page.evaluate(() => {
          const h = document.querySelector("#switching .rd-mo-howread");
          return h ? h.textContent.trim() : null;
        });
        check("[1280] how-read names height as share of the gain, no area",
          strip === "Width: share of the 2025 vote, Height: share of One Nation’s gain", strip || "(none)");
        const gone = await page.evaluate(() => !document.body.textContent.includes("Stayed or went elsewhere"));
        check("[1280] no stayed/elsewhere caption", gone, "");
      } else {
        const rows = await page.evaluate(() => [...document.querySelectorAll("#switching .rd-mo-row")].map((r) => ({
          nm: r.querySelector(".rd-mo-rtop b").textContent.trim(),
          sub: r.querySelectorAll(".rd-mo-rsub span")[1].textContent.trim(),
          fillW: r.querySelector(".rd-mo-rbar span").style.width,
          big: r.querySelector(".rd-mo-big") ? r.querySelector(".rd-mo-big").textContent.trim() : null,
          em: r.querySelector(".rd-mo-rbar em") ? r.querySelector(".rd-mo-rbar em").textContent.trim() : null,
          hasElse: !!r.querySelector(".rd-mo-else"),
        })));
        const idOf = (nm) => (/^Coalition/.test(nm) ? "lnp" : /^Labor/.test(nm) ? "alp" : /^Others/.test(nm) ? "oth" : /^Greens/.test(nm) ? "grn" : /^(One Nation)$/.test(nm) ? "onp" : null);
        for (const row of rows) {
          const id = idOf(row.nm);
          if (!id) { check(`[390] recognised row "${row.nm}"`, false, ""); continue; }
          if (id === "onp") {
            check("[390] kept row fill stays its own rate", Math.abs(parseFloat(row.fillW) - expected.keptPct) < 0.6, row.fillW);
            continue;
          }
          check(`[390] ${id} fill width = gain share`, Math.abs(parseFloat(row.fillW) - expected.cols[id].gain) < 0.6,
                `got ${row.fillW}, want ≈${expected.cols[id].gain}%`);
          check(`[390] ${id} under-bar text carries the rate`, row.sub === expected.fmt1(expected.cols[id].rate) + "% now back One Nation",
                `got "${row.sub}"`);
          check(`[390] ${id} no stayed/elsewhere caption`, !row.hasElse, "");
        }
        const lnpRow = rows.find((r) => idOf(r.nm) === "lnp");
        check("[390] first row's callout is the gain share",
          !!lnpRow && lnpRow.big === expected.fmt1(expected.cols.lnp.gain) + "%",
          lnpRow ? `big=${lnpRow.big} em="${lnpRow.em}"` : "(no row)");
        const note = await page.evaluate(() => {
          const p = [...document.querySelectorAll("#switching .rd-note")].map((x) => x.textContent).find((t) => t.includes("Bar height"));
          return p || null;
        });
        check("[390] phone note names fill as share of the gain, no area",
          note === "Bar height: that party’s share of the 2025 vote. Bar fill: that party’s share of One Nation’s gain.", note || "(none)");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`[${vw}] no page-level horizontal overflow`, overflow <= 0, `overshoot ${overflow}px`);
      check(`[${vw}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
})();
