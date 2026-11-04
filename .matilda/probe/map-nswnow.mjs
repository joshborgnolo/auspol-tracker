/* The /map/ NSW "now" frame (nswnow) end to end, headless: the 2023
   Assembly plus the four by-elections since (Epping, Hornsby, Pittwater
   19 Oct 2024; Kiama 13 Sep 2025) and the members' moves, riding the
   federal Now's overlay machinery generalised by NOW_OF. Asserts the frame
   boots on its own deep link and stop, the banner/chamber/story all read
   as-it-stands, each by-election's winner files as today's holder, and the
   same-place onset of change rides the 2023 booths. */
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
  const { page, errors } = await boot(base + "/map/#y=nswnow");
  const st = await page.evaluate(() => {
    const S = window.__map.S, m = window.__map.Y[S.year];
    const story = document.querySelector("#story") ? document.querySelector("#story").innerText : "";
    const meta = document.querySelector("#mp-meta") ? document.querySelector("#mp-meta").innerText : "";
    const nowStops = [...document.querySelectorAll("#time .yr")].filter((el) => /^(Now|NSW now)$/.test(el.textContent.trim()));
    return { year: S.year, asOf: m.asOf, meta, story,
             nowStopCount: nowStops.length, nowStopLabels: nowStops.map((el) => el.textContent.trim()),
             nswnowOn: nowStops.some((el) => el.textContent.trim() === "NSW now" && el.classList.contains("on")),
             chamber: m.divs.reduce((a, d) => { const f = { alp: 0, lnp: 0, grn: 0, ind: 0, onp: 0, oth: 0, csa: 0 }[d.hold.fam]; a[d.hold.fam] = (a[d.hold.fam] || 0) + 1; return a; }, {}) };
  });
  check("nswnow: deep link lands the frame", st.year === "nswnow", "year " + st.year);
  check("nswnow: banner reads as it stands", /Legislative Assembly as it stands/.test(st.meta), st.meta.slice(0, 90));
  check("nswnow: banner carries the asOf date", /4 November 2026/.test(st.meta), st.meta.slice(0, 90));
  check("nswnow: chamber as it sits is 46/35/3/9",
        st.chamber.alp === 46 && st.chamber.lnp === 35 && st.chamber.grn === 3 && st.chamber.ind === 9,
        JSON.stringify(st.chamber));
  check("nswnow: government story names the tally", /Labor holds 46 of the 93 seats/.test(st.story), st.story.slice(0, 180));
  check("nswnow: changes panel files 8 changes", /Since the election\s*8 changes/.test(st.story.replace(/\s+/g, " ")), "");
  check("nswnow: Kiama and Pittwater are the two seat swaps told",
        /McInerney won Kiama/.test(st.story) && /Scruby took Pittwater/.test(st.story), "");
  check("nswnow: NSW row carries the Now stop and it is on", st.nowStopCount >= 2 && st.nswnowOn,
        `${st.nowStopCount} now-stops, on=${st.nswnowOn}`);
  check("nswnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

// each by-election winner holds its seat, and Kiama's by-election page reads its count
{
  const { page, errors } = await boot(base + "/map/#y=nswnow");
  const out = await page.evaluate(async () => {
    const seen = (n) => Array.from(document.querySelectorAll("*")).some((el) => el.children.length === 0 && el.textContent.includes(n));
    window.__map.goState("NSW");
    await new Promise((r) => setTimeout(r, 700));
    const storyA = document.querySelector("#story").innerText;
    window.__map.goDiv(window.__map.Y.nswnow.byName.get("Kiama"));
    await new Promise((r) => setTimeout(r, 700));
    const storyK = document.querySelector("#story").innerText;
    window.__map.goDiv(window.__map.Y.nswnow.byName.get("Pittwater"));
    await new Promise((r) => setTimeout(r, 700));
    const storyP = document.querySelector("#story").innerText;
    const m = window.__map.Y.nswnow;
    const D = m.divs[m.byName.get("Kiama")];
    return { storyA, storyK, storyP,
             kiamaHold: D.hold.n, kiamaWin: D.win.n,
             eppingHold: m.divs[m.byName.get("Epping")].hold.n,
             hornsbyHold: m.divs[m.byName.get("Hornsby")].hold.n,
             pittHold: m.divs[m.byName.get("Pittwater")].hold.n };
  });
  check("nswnow: the NSW state story files the by-elections", /Kiama.*by-election|by-election.*Kiama/s.test(out.storyA)
        || /McInerney won Kiama/.test(out.storyA), out.storyA.slice(0, 200));
  check("nswnow: each by-election's winner holds its seat",
        out.kiamaHold === "Katelin McInerney" && out.eppingHold === "Monica Tudehope" &&
        out.hornsbyHold === "James Wallace" && out.pittHold === "Jacqui Scruby",
        JSON.stringify(out));
  check("nswnow: Kiama won September 2025's by-election, not the general",
        /Katelin McInerney won Kiama at the September 2025 by-election/.test(out.storyK), out.storyK.slice(0, 220));
  check("nswnow: Kiama's seat page is tagged a by-election", /by-election, 13 September 2025/.test(out.storyK), out.storyK.slice(0, 120));
  check("nswnow: Pittwater's seat is tagged October 2024's", /by-election, 19 October 2024/.test(out.storyP), out.storyP.slice(0, 120));
  check("nswnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

// the same-place onset: a Kiama booth reads its change against the 2023 count
{
  const { page, errors } = await boot(base + "/map/#y=nswnow");
  const out = await page.evaluate(async () => {
    const m = window.__map.Y.nswnow;
    const b = m.booth, js = b.byDiv[m.byName.get("Kiama")];
    // find a geocoded booth with a prevFp (a 2023 place back on the roll)
    const j = js.find((k) => b.raw.prevFp && b.raw.prevFp && b.raw.prevFp[k]);
    window.__map.goBooth(j);
    await new Promise((r) => setTimeout(r, 800));
    const story = document.querySelector("#story").innerText;
    return { name: b.name[j], story };
  });
  check("nswnow: a re-used 2023 place reads change on its 2023 count",
        /change on 2023/.test(out.story.replace(/\s+/g, " ")), (out.name || "") + " :: " + out.story.slice(0, 200));
  check("nswnow: booth boot is clean", errors.length === 0, errors[0]);
  await page.close();
}

// search labels members, never "elected"
{
  const { page, errors } = await boot(base + "/map/#y=nswnow");
  const hit = await page.evaluate(async () => {
    const inp = document.querySelector("#q");
    inp.value = "McInerney";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    return document.body.innerText.includes("Member for Kiama");
  });
  check("nswnow: seats are Members on the now frame, not Members elected", hit === true, "");
  check("nswnow: search boot is clean", errors.length === 0, errors[0]);
  await page.close();
}

// the federal Now is untouched by the generalisation
{
  const { page, errors } = await boot(base + "/map/#y=now");
  const st = await page.evaluate(() => ({
    year: window.__map.S.year,
    meta: document.querySelector("#mp-meta").innerText,
    story: document.querySelector("#story").innerText,
  }));
  check("nswnow: the federal Now still stands", st.year === "now" && /House as it stands/.test(st.meta), st.meta.slice(0, 90));
  check("nswnow: Farrer's by-election notice survives", /by-election/.test(st.story) && /Farrer/.test(st.story), "");
  check("nswnow: no page errors", errors.length === 0, errors[0]);
  await page.close();
}

await browser.close();
server.close();
console.log(`${oks.length} ok, ${fails.length} fail`);
for (const f of fails) console.log("FAIL", f);
process.exit(fails.length ? 1 : 0);
