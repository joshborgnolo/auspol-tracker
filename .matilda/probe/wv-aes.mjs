// Probe: Who votes for whom's Australian Election Study 2025 points (gen-data
// DEMO_AES, from the AES respondent file via .build/extract-aes-2025.py).
// For every party, one hollow diamond per group at May 2025 on the Gender,
// By age, By generation, Education, By housing and By work status charts;
// none on By language at home (not asked) or the Place tab (the AEC count
// marks those); dotted lead-ins; the key names the study; the tip reads the
// AES's share, the group's respondents and "not pooled"; the election-month
// guide reads the groups' AES shares and all voters at the result; no page
// errors. Screens to OUT (default $CLAUDE_JOB_DIR/tmp or /tmp).
// Run: node .matilda/probe/wv-aes.mjs  (PAGE=<url> to test a served build)
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable from ~ or cwd"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.PAGE || `file://${ROOT}/index.html`;
const OUT = process.env.OUT || (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + "/tmp" : "/tmp");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const click = (page, sel, text) => page.evaluate((sel, text) => {
  const b = [...document.querySelectorAll(sel)].find((n) => n.textContent.trim() === text || n.getAttribute("aria-label") === text);
  if (!b) return false;
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}, sel, text);
/* the AES diamonds: hollow scatter paths drawn on the chart ground */
const diamonds = (page) => page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart")].map((card) => ({
  head: (card.querySelector(".rd-chead-t") || {}).firstChild?.textContent || "",
  n: card.querySelectorAll('path.scatter-dot[fill="var(--chart-bg)"]').length,
})));

for (const vw of [1280, 390]) {
  console.log(`== ${vw} ==`);
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: vw, height: 1000 });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#who-votes .rd-wv-tabs", { timeout: 30000 });
  await page.evaluate(() => document.getElementById("who-votes").scrollIntoView());
  await settle(1500);
  const chipSel = "#who-votes .rd-chip";
  for (const [party, want] of [["Labor", true], ["One Nation", true], ["Others", true]]) {
    await click(page, chipSel, party);
    await settle(900);
    await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", "Gender");
    await settle(900);
    const g = await diamonds(page);
    check(`${party}: Gender chart ${want ? "has 2" : "has no"} AES points`, (g[0] && g[0].n) === (want ? 2 : 0), JSON.stringify(g));
    const key = await page.evaluate(() => /Australian Election Study 2025/.test(document.querySelector("#who-votes .rd-sm-key")?.textContent || ""));
    check(`${party}: key ${want ? "names" : "omits"} the study`, key === want);
    if (party === "Labor") {
      await page.evaluate(() => document.querySelector("#who-votes .rd-wv-charts").scrollIntoView({ block: "center" }));
      await settle(400);
      const el = await page.$("#who-votes .rd-wv-charts");
      await el.screenshot({ path: `${OUT}/wv-aes-gender-${vw}.png` });
      /* hover the first diamond and read the tip */
      const box = await page.evaluate(() => {
        const d = document.querySelector('#who-votes .rd-wv-chart path.scatter-dot[fill="var(--chart-bg)"]');
        const r = d.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.move(box.x, box.y);
      await settle(400);
      const tip = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("tip names the AES, its share, the group's respondents, not pooled", /Australian Election Study 2025/.test(tip) && /not pooled/.test(tip)
        && (/Men ?30\.9/.test(tip) && /940 respondents/.test(tip) || /Women ?36\.2/.test(tip) && /1,004 respondents/.test(tip)), tip.slice(0, 200));
      await el.screenshot({ path: `${OUT}/wv-aes-gender-tip-${vw}.png` });
      /* the guide at the election x, well above the diamonds: the lead-ins'
         rows - the groups' printed AES shares, all voters at the result */
      const svgTop = await page.evaluate(() => document.querySelector("#who-votes .rd-wv-chart svg").getBoundingClientRect().bottom - 80);
      await page.mouse.move(5, 5);
      await settle(200);
      await page.mouse.move(box.x + 4, svgTop);
      await settle(400);
      const guide = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("election-month guide: groups' AES shares, all voters at the result", /May 2025/.test(guide) && /Women ?36\.2/.test(guide) && /Men ?30\.9/.test(guide) && /All voters ?34\.6/.test(guide) && /Groups: Australian Election Study 2025/.test(guide), guide.slice(0, 220));
      /* lead-ins: two groups + all voters, dotted */
      const leads = await page.evaluate(() => document.querySelectorAll('#who-votes .rd-wv-chart [data-series^="ae-"]').length);
      check("dotted lead-ins drawn (2 groups + all voters)", leads >= 3, String(leads));
      await page.mouse.move(5, 5);
    }
    await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", "Age");
    await settle(900);
    const a = await diamonds(page);
    const byGen = a.find((c) => /generation/i.test(c.head)), byAge = a.find((c) => /age/i.test(c.head));
    check(`${party}: By generation has 4 AES points`, (byGen && byGen.n) === 4, JSON.stringify(a));
    check(`${party}: By age has 3`, (byAge && byAge.n) === 3);
    if (party === "Labor") {
      const el = await page.$("#who-votes .rd-wv-charts");
      await el.screenshot({ path: `${OUT}/wv-aes-age-${vw}.png` });
    }
    for (const [tabName, want2] of [["Education", { education: 3 }], ["Home", { housing: 3, "work status": 3, language: 0 }], ["Place", { state: 0, location: 0 }]]) {
      await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", tabName);
      await settle(900);
      const cs = await diamonds(page);
      for (const [lab, n] of Object.entries(want2)) {
        const c = cs.find((x) => x.head.toLowerCase().includes(lab));
        /* Place's state panels draw no cards with a by-line head of their
           own; a missing card counts as none */
        check(`${party}: ${tabName} / ${lab} has ${n}`, (c ? c.n : 0) === n, JSON.stringify(cs));
      }
      if (party === "Labor" && tabName === "Home") {
        const el = await page.$("#who-votes .rd-wv-charts");
        await el.screenshot({ path: `${OUT}/wv-aes-home-${vw}.png` });
      }
    }
  }
  check("no page errors", errs.length === 0, errs.join(" ; "));
  await page.close();
}
await browser.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
