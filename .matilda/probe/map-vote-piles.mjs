// Probe: /map/'s "How votes were cast" block and the key's "Not drawn" line (build_vote_piles.py, app-4-story vtBlock, app-2b-draw undrawnHTML).
// usage: node .matilda/probe/map-vote-piles.mjs <baseUrl>   (serve the repo root first, not with python's http.server)
//  - 2025's rows, the sentence, and the key's lead, which with the balloons' net ink must come to the AEC's national lead
//  - the line and the block follow the selection; 2019's lead runs the other way
//  - mobile teams take a row only where they matter (Lingiari, the NT), so the day's row there is the day
//  - no two-party column where the count has none (1993, a Labor v Greens seat before 2016), with a note saying so
//  - no block and no line in a state frame; Now's by-election seat has none, while the national block is the election's
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const open = async (hash, w = 1440, h = 1000) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errs.push(`${hash}: ${e.message}`));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${base}/map/#${hash}`, { waitUntil: "networkidle2", timeout: 60000 });
  for (let i = 0; i < 80; i++) { if (await page.evaluate("!!(window.__map && window.__map.M())")) break; await wait(200); }
  await wait(1500);
  return page;
};
const read = (page) => page.evaluate(() => {
  const sec = [...document.querySelectorAll(".st-sec")].find((x) => x.querySelector("h3") && /How votes were cast/.test(x.querySelector("h3").textContent));
  const u = document.querySelector(".lg-undrawn");
  return {
    key: u ? u.textContent : null,
    head: sec ? [...sec.querySelectorAll("thead th")].map((t) => t.textContent) : null,
    rows: sec ? [...sec.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent)) : null,
    notes: sec ? [...sec.querySelectorAll(".st-note")].map((n) => n.textContent) : null,
  };
});
const seat = async (page, name) => { await page.evaluate((n) => __map.goDiv(__map.M().divs.findIndex((d) => d.n === n)), name); await wait(900); };

let p = await open("y=2025&l=tpp&draw=balloons");
let r = await read(p);
ok("2025 key", r.key === "Not drawn: 3.2m postal and other votes, Labor by 242,000", r.key);
ok("2025 rows", JSON.stringify(r.rows) === JSON.stringify([["On the day", "41.0%", "58.0"], ["Early centres", "38.6%", "53.0"], ["Early, by declaration", "3.4%", "56.3"], ["Postal", "13.6%", "51.6"], ["Absent and other", "3.4%", "60.2"]]), JSON.stringify(r.rows));
ok("2025 sentence", r.notes[0] === "Labor’s two-party share was 6.3 points lower by post than on the day, and 4.9 lower at early centres.", r.notes[0]);
const sums = await p.evaluate(() => { const m = __map.M(), B = __map.balloonSet(m); let ink = 0; for (let a = 0; a < B.n; a++) ink += B.V[a] >= 50 ? B.C[a] : -B.C[a]; const t = m.res.agg.AUS.tpp; return { ink: Math.round(ink), lead: t[0] - t[1], off: __map.undrawnOf(m).lead, n: __map.undrawnOf(m).n }; });
ok("the balloons' ink and the key's lead come to the national lead exactly", sums.ink + sums.off === sums.lead, JSON.stringify(sums));
await p.evaluate(() => __map.goState("VIC")); await wait(900); r = await read(p);
ok("the line follows a state", r.key === "Not drawn: 1.0m postal and other votes, Labor by 100,000", r.key);
await seat(p, "Macnamara"); r = await read(p);
ok("the line follows a seat", /^Not drawn: 33,600 postal and other votes, Labor by 3,050$/.test(r.key), r.key);
ok("Macnamara's rows", r.rows.find((x) => x[0] === "Postal")[2] === "50.0" && r.rows[0][0] === "On the day", JSON.stringify(r.rows));
ok("a seat has no drawing note", r.notes.length === 1, JSON.stringify(r.notes));
await seat(p, "Lingiari"); r = await read(p);
const L = Object.fromEntries(r.rows.map((x) => [x[0], x]));
ok("Lingiari's mobile teams have their own row", L["Mobile teams"] && L["Mobile teams"][2] === "81.5" && L["On the day"][2] === "49.0", JSON.stringify(r.rows));
await seat(p, "Solomon"); r = await read(p);
ok("Solomon's stay in the day's row", !r.rows.some((x) => x[0] === "Mobile teams"), JSON.stringify(r.rows));
await p.evaluate(() => __map.goState("NT")); await wait(900); r = await read(p);
ok("so do the NT's, at state level, get a row", r.rows.some((x) => x[0] === "Mobile teams"), JSON.stringify(r.rows));
await p.close();

p = await open("y=2019&l=tpp&draw=balloons"); r = await read(p);
ok("2019's lead runs the other way", r.key === "Not drawn: 2.6m postal and other votes, Coalition by 163,000", r.key);
await p.close();
p = await open("y=2025&l=tpp&draw=surface"); r = await read(p);
ok("the surface has the line too", /^Not drawn: 3\.2m/.test(r.key || ""), r.key);
await p.close();
p = await open("y=2025&l=tpp&draw=seats"); r = await read(p);
ok("the seats fill with the final count, so no line", r.key === null, r.key);
await p.close();
p = await open("y=2025&l=winner&draw=balloons"); r = await read(p);
ok("a lens that isn't the two-party lead says no lead", r.key === "Not drawn: 3.2m postal and other votes", r.key);
await p.close();

p = await open("y=2013&l=tpp&draw=balloons"); r = await read(p);
ok("before 2016 the area says whose seats", r.notes.some((n) => /139 of 150 seats/.test(n)), JSON.stringify(r.notes));
await seat(p, "Melbourne"); r = await read(p);
ok("a Labor v Greens seat has no two-party column", r.head.length === 2 && r.notes.some((n) => /only where the final two/.test(n)), JSON.stringify(r));
await p.close();
p = await open("y=2007&l=tpp&draw=balloons"); r = await read(p);
ok("no early centres before 2010", !r.rows.some((x) => x[0] === "Early centres") && r.notes[0] === "Labor’s two-party share was 6.6 points lower by post than on the day.", r.notes[0]);
await p.close();
p = await open("y=1993&l=tpp&draw=balloons"); r = await read(p);
ok("1993 has shares only, and says why", r.head.length === 2 && r.notes.some((n) => /1993 count/.test(n)), JSON.stringify(r));
ok("1993 reads the not-drawn votes without a lead", r.key === "Not drawn: 2.1m postal and other votes", r.key);
await p.close();
p = await open("y=sa26&l=tpp&draw=balloons"); r = await read(p);
ok("a state frame has neither", r.key === null && r.rows === null, JSON.stringify(r));
await p.close();
p = await open("y=now&l=tpp&draw=balloons"); r = await read(p);
ok("Now's national block is the election's", r.rows[0][1] === "41.0%" && r.rows[3][2] === "51.6", JSON.stringify(r.rows));
await seat(p, "Farrer"); r = await read(p);
ok("Now's by-election seat has neither", r.key === null && r.rows === null, JSON.stringify(r));
await p.close();

ok("no page errors", !errs.length, errs.join(" | "));
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}: ${fails.join("; ")}` : "PASS");
process.exit(fails.length ? 1 : 0);
