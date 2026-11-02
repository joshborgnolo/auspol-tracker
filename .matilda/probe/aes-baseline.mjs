// Probe + review dump: the AES 2025 election baseline (user ruling 2026-11-02).
//  1. Who votes for whom: rdDemoShift's head/dek per party, with and without
//     the §7gb election test (`elec` emptied = the copy before the change);
//     every election sentence names only passing rows, at most two claims,
//     never a group the slope claims already name.
//  2. Primary vote group view: each AES-measured group's stat "since" rows and
//     dek, with D.demoAes on and off (off = before the change); on, every
//     row reads "since the election (AES)"; a faller clause only when the
//     fall clears both margins.
// Prints the before/after pairs for review. Run: node .matilda/probe/aes-baseline.mjs
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
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed++; else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.setViewport({ width: 1280, height: 1000 });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#primary-vote select", { timeout: 30000 });
await settle(1500);

console.log("== Who votes for whom: composition-trend copy ==");
const wv = await page.evaluate(() => {
  const D = window.AUSPOL;
  const out = {};
  for (const p of ["onp", "alp", "lnp", "grn", "oth"]) {
    const dt = D.demoTrend[p];
    const after = window.rdDemoShift(dt, D.demographics, p);
    const before = window.rdDemoShift({ ...dt, elec: [] }, D.demographics, p);
    const named = new Set((dt.moves || []).map((m) => m.group));
    out[p] = { before, after, pass: dt.elec.filter((r) => r.claim ?? r.sig).map((r) => r.group), named: [...named] };
  }
  return out;
});
for (const [p, r] of Object.entries(wv)) {
  console.log(`\n[${p}] passes: ${r.pass.join(", ") || "none"}`);
  console.log("  BEFORE  " + r.before.head + "\n          " + r.before.dek);
  console.log("  AFTER   " + r.after.head + "\n          " + r.after.dek);
  const es = (r.after.dek.split("Measured from the election")[1] || "");
  check(`${p}: election sentence only when a row passes`, !!es === r.pass.length > 0 || (r.pass.length > 0 && !es && r.pass.every((g) => r.named.includes(g))));
  check(`${p}: before-copy unchanged except the added sentence/head`, r.pass.length === 0 ? r.after.dek === r.before.dek && r.after.head === r.before.head : true);
}

console.log("\n== Primary vote group view ==");
const choose = (v) => page.evaluate((v) => {
  const sel = document.querySelector('#primary-vote select[aria-label="The primary vote among"]');
  sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true }));
}, v);
const read = () => page.evaluate(() => {
  const sec = document.getElementById("primary-vote");
  return {
    dek: (sec.querySelector(".rd-hed .rd-dek, .rd-dek") || {}).textContent || "",
    chg: [...sec.querySelectorAll(".rd-pv-stat")].map((b) => (b.querySelector(".rd-pv-name") || {}).textContent + " " + ((b.querySelector(".rd-pv-chg") || {}).textContent || "–")),
  };
});
const GROUPS = ["Men", "Women", "18–34", "35–54", "55+", "Gen Z", "Millennials", "Gen X", "Boomers", "Year 12 or less", "TAFE or trade", "University", "Own outright", "Mortgage", "Renting", "Full time", "Part time", "Retired"];
const res = {};
for (const g of GROUPS) { await choose(g); await settle(500); res[g] = { after: await read() }; }
await page.evaluate(() => { window.__aes = window.AUSPOL.demoAes; window.AUSPOL.demoAes = null; });
for (const g of GROUPS) { await choose("NSW"); await settle(200); await choose(g); await settle(500); res[g].before = await read(); }
await page.evaluate(() => { window.AUSPOL.demoAes = window.__aes; });
for (const g of GROUPS) {
  const { before, after } = res[g];
  console.log(`\n[${g}]`);
  console.log("  BEFORE  " + before.chg.join(" | "));
  console.log("  AFTER   " + after.chg.join(" | "));
  if (before.dek !== after.dek) console.log("  DEK BEFORE  " + before.dek + "\n  DEK AFTER   " + after.dek);
  check(`${g}: every change row reads since the election (AES)`, after.chg.every((c) => /since the election \(AES\)/.test(c)), after.chg[0]);
}
check("no page errors", errs.length === 0, errs.join(" ; "));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
