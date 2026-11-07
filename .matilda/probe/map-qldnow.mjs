/* The /map/ Qld "now" frame (qldnow) end to end, headless: the 2024
   Legislative Assembly with the two by-elections since (Hinchinbrook
   29 Nov 2025, Stafford 16 May 2026) and the members' moves (Sullivan's
   May-2025 expulsion from Labor, his death, Dametto's resignation),
   riding the generalised Now overlay. Asserts boot-on-hash, the as-it-
   stands banner/tally/story/chamber, each by-election's winner filed as
   today's holder, and the federal Now untouched. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
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
  if (cond) oks.push(name);
  else fails.push(`${name}${detail ? " - " + detail : ""}`);
};

const boot = async (url) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__map && window.__map.S, { timeout: 15000 });
  await page.waitForFunction(() => {
    const m = window.__map.S, seen = window.__map.Y[m.year];
    return seen && seen.divs && seen.divs.length;
  }, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  return { page, errors };
};

// deep link boots the frame
{
  const { page, errors } = await boot(base + "/map/#y=qldnow");
  const st = await page.evaluate(() => {
    const S = window.__map.S, m = window.__map.Y[S.year];
    const story = document.querySelector("#story") ? document.querySelector("#story").innerText : "";
    const meta = document.querySelector("#mp-meta") ? document.querySelector("#mp-meta").innerText : "";
    const nowStops = [...document.querySelectorAll("#time .yr")].filter((el) => /^(Now|NSW now|QLD now)$/.test(el.textContent.trim()));
    const qStop = nowStops.find((el) => el.textContent.trim() === "QLD now");
    return { year: S.year, asOf: m.asOf, meta, story,
             qldStopCls: qStop ? qStop.getAttribute("class") : null,
             chamber: m.divs.reduce((a, d) => { a[d.hold.fam] = (a[d.hold.fam] || 0) + 1; return a; }, {}) };
  });
  check("qldnow: deep link lands the frame", st.year === "qldnow", "year " + st.year);
  check("qldnow: banner reads as it stands", /Legislative Assembly as it stands/.test(st.meta), st.meta.slice(0, 90));
  check("qldnow: chamber as it sits is 53/36/1/1/2",
        st.chamber.lnp === 53 && st.chamber.alp === 36 && st.chamber.grn === 1 &&
        st.chamber.ind === 1 && st.chamber.oth === 2, JSON.stringify(st.chamber));
  check("qldnow: government story names the tally", /Liberal National holds 53|Coalition holds 53|LNP holds 53/.test(st.story), st.story.slice(0, 180));
  check("qldnow: changes panel files 5 changes", /Since the election\s*5 changes/.test(st.story.replace(/\s+/g, " ")), "");
  check("qldnow: the swaps are told",
        /Chiesa took Hinchinbrook/.test(st.story) && /Richmond/.test(st.story), "");
  check("qldnow: Qld row carries the Now stop and it is on",
        st.qldStopCls && st.qldStopCls.includes("on"),
        `class=${st.qldStopCls}`);
  check("qldnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

// each by-election winner holds its seat
{
  const { page, errors } = await boot(base + "/map/#y=qldnow");
  const out = await page.evaluate(() => {
    const m = window.__map.Y.qldnow;
    const D = m.divs[m.byName.get("Hinchinbrook")];
    return {
      hinchHold: D.hold.n, hinchWin: D.win.n,
      staffHold: m.divs[m.byName.get("Stafford")].hold.n,
      staffWin: m.divs[m.byName.get("Stafford")].win.n,
      sullivanSeat: m.divs[m.byName.get("Stafford")],
    };
  });
  check("qldnow: Hinchinbrook sits LNP", out.hinchHold === "Wayde Chiesa", out.hinchHold);
  check("qldnow: Stafford sits Labor", out.staffHold === "Luke Richmond", out.staffHold);
  check("qldnow: winner records carry the by-election rows",
        out.hinchWin === "Wayde Chiesa" && out.staffWin === "Luke Richmond",
        `${out.hinchWin}/${out.staffWin}`);
  check("qldnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

// Stafford's seat page reads its own by-election
{
  const { page, errors } = await boot(base + "/map/#y=qldnow");
  const out = await page.evaluate(async () => {
    window.__map.goDiv(window.__map.Y.qldnow.byName.get("Stafford"));
    await new Promise((r) => setTimeout(r, 700));
    return { k: document.querySelector("#story").innerText };
  });
  check("qldnow: Stafford won May 2026's by-election, not the general",
        /Luke Richmond won Stafford at the May 2026 by-election/.test(out.k), out.k.slice(0, 220));
  check("qldnow: Stafford's seat page is tagged a by-election", /by-election, 16 May 2026/.test(out.k), out.k.slice(0, 120));
  check("qldnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

// the federal Now is untouched by the generalisation
{
  const { page, errors } = await boot(base + "/map/#y=now");
  const st = await page.evaluate(() => ({
    year: window.__map.S.year,
    meta: document.querySelector("#mp-meta").innerText,
  }));
  check("qldnow: the federal Now still stands", st.year === "now" && /current House of Representatives/.test(st.meta), st.meta.slice(0, 90));
  check("qldnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

await browser.close();
server.close();
console.log(`${oks.length} ok, ${fails.length} fail`);
for (const f of fails) console.log("FAIL", f);
process.exit(fails.length ? 1 : 0);
