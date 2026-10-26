/* sa_chambers_fetch.mjs – the Parliament of South Australia's chamber maps, cached for sa_seating.mjs.

   chamber-maps.parliament.sa.gov.au (a Staffmap site) draws each chamber from one POST its page
   makes on load (AjaxAction.aspx, action=projectstartup): every desk's name and place, and the
   member at it (surname and electorate). A member's card (DetailForm.aspx, loaddetailform) adds
   the full name and party. Neither answers a plain request without the page's session, so this
   drives Chrome: it opens each chamber, keeps the startup response, clicks every member for their
   card, and writes .build/map/src/sa-chambers/<ha|lc>-<date>.json.gz. Run it when the Parliament
   reseats its members (a new Parliament, a ministry change), then node .build/map/sa_seating.mjs:
     node .build/map/sa_chambers_fetch.mjs */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "src", "sa-chambers");
const puppeteer = createRequire(path.join(HERE, "..", "..", "package.json"))("puppeteer-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const FLOORS = { ha: "floor_2020111280982479", lc: "floor_202101222747992" };
const URL0 = "https://chamber-maps.parliament.sa.gov.au/psa1/";

const date = new Date().toISOString().slice(0, 10);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
try {
  for (const [key, floor] of Object.entries(FLOORS)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200 });
    let startup = null;
    const cards = {};
    page.on("response", async (r) => {
      const body = r.request().postData() || "";
      try {
        if (body.includes("action=projectstartup") && body.includes(`pageid=${floor.slice(6)}`)) startup = await r.text();
        const m = body.match(/action=loaddetailform&boxtype=employee&id=(\d+)/);
        if (m) cards[m[1]] = await r.text();
      } catch { /* a response gone before it was read */ }
    });
    await page.goto(`${URL0}#${floor}`, { waitUntil: "networkidle0", timeout: 60000 });
    if (!startup) throw new Error(`${key}: no projectstartup response`);
    const ids = [...JSON.parse(startup)[1].value.matchAll(/class="employeepanel [^"]*" deskid="\d+"/g)].length;
    const emps = [...JSON.parse(startup)[1].value.matchAll(/<div id ="(\d+)" style ="[^"]*" class="employeepanel /g)].map((m) => m[1]);
    if (!emps.length || emps.length !== ids) throw new Error(`${key}: ${emps.length} members read of ${ids}`);
    for (const id of emps) {
      await page.evaluate((id) => { const e = document.getElementById(id); if (e) e.click(); }, id);
      for (let k = 0; k < 50 && !cards[id]; k++) await new Promise((r) => setTimeout(r, 100));
      if (!cards[id]) throw new Error(`${key}: no card for member ${id}`);
    }
    const file = path.join(OUT, `${key}-${date}.json.gz`);
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ fetched: date, url: `${URL0}#${floor}`, startup, cards }, null, 0)));
    console.log(path.relative(process.cwd(), file), emps.length, "members");
    await page.close();
  }
} finally {
  await browser.close();
}
