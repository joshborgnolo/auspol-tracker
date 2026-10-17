/* cyc-early-terms: the 1943–72 Past-cycles batch, as corrected 2026-10-18
   (.build/fix-1943-58-cycles.mjs). Data pins, then the page:
   - e1951/e1954 carry the AEC pairs (ALP 49.3 / 50.7), and so do the two
     terms' Election sentinels and the cycle end results built from them;
   - every FLOW_ERAS set from 1943 to 1954 reproduces its own election
     (the one free constant solved), 1955 carries the pooled DLP 0.27 and
     lands 1958 exactly, and every era row's stored tpp is its set's figure;
   - the accuracy record holds no dateApprox wave, 1954/1966/1969 drop out
     (month-placeholder finals) and 1949 scores on its 1949-12-03 final;
   - the static results table names the side that formed government
     (1954, 1961, 1969, 1990, 1998 went to the 2PP loser), and the worst-
     miss sentence names the lone house instead of "every house";
   - the page itself: Past cycles renders in both designs without console
     errors, and a month-placeholder dot's tooltip label reads "May 1954"
     style (cycDotDate with approx).
   BASE=<checkout> overrides the default repo root. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.env.BASE || "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8987;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

let fails = 0;
const ok = (c, m) => { if (c) console.log("  ok   " + m); else { fails++; console.log("  FAIL " + m); } };

const D = JSON.parse(readFileSync(join(ROOT, "data/polls.json"), "utf8"));
const { FLOW_ERAS, impliedEraAlp2pp } = await import(join(ROOT, ".build/newtracker/flows.mjs"));
const bundle = readFileSync(join(ROOT, ".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
const grab = (name) => { const i = bundle.indexOf("const " + name + " = "); return JSON.parse(bundle.slice(i + name.length + 9, bundle.indexOf("\n", i)).replace(/;$/, "")); };

console.log("data");
ok(D.elections.e1951.tpp_alp === 49.3 && D.elections.e1951.tpp_lnp === 50.7, "e1951 ALP 49.3 / L-NP 50.7");
ok(D.elections.e1954.tpp_alp === 50.7 && D.elections.e1954.tpp_lnp === 49.3, "e1954 ALP 50.7 / L-NP 49.3");
for (const b of ["1951", "1954"]) {
  const s = D.cyclePolls[b].find((p) => p.firm === "Election");
  ok(s.tpp_alp === D.elections["e" + b].tpp_alp, `cyclePolls.${b} sentinel matches e${b}`);
}
for (const y of ["1943", "1946", "1949", "1951", "1954"]) {
  const e = D.elections["e" + y];
  const self = impliedEraAlp2pp(FLOW_ERAS[y], { alp: e.alp, oth: 100 - e.alp - e.lnp });
  ok(Math.abs(self - e.tpp_alp) < 0.01, `FLOW_ERAS[${y}] reproduces ${y} (${self.toFixed(2)} v ${e.tpp_alp})`);
}
ok(FLOW_ERAS[1955].dlp === 0.27, "FLOW_ERAS[1955] carries the pooled DLP 0.27");
ok(Math.abs(impliedEraAlp2pp(FLOW_ERAS[1955], { alp: 42.81, dlp: 9.41, oth: 1.23 }) - 45.9) < 0.01, "1955 set lands 1958 (DLP 9.41 itemised)");
let drift = 0;
for (const rows of Object.values(D.cyclePolls))
  for (const p of rows) if (p.tppEra != null) {
    const a = Math.round(impliedEraAlp2pp(FLOW_ERAS[p.tppEra], p) * 10) / 10;
    if (a !== p.tpp_alp) drift++;
  }
ok(drift === 0, `every era row's tpp is its set's figure (${drift} drifted)`);
ok(!D.cyclePolls["1951"].some((p) => p.date === "1949-12-15"), "the mis-dated 1949-12-15 wave left the 1949–51 term");
const fin = D.cyclePolls["1949"].find((p) => p.date === "1949-12-03");
ok(fin && fin.tppEra === "1946" && !fin.dateApprox, "1949's final wave sits in its own term, dated 1949-12-03");

const acc = grab("accuracy"), defs = grab("CYCLE_DEFS");
const years = acc.cycles.map((c) => c.year);
ok(![1954, 1966, 1969].some((y) => years.includes(y)), "1954/1966/1969 month-placeholder finals are not scored");
ok(years.includes(1949) && acc.cycles.find((c) => c.year === 1949).houses[0].date === "1949-12-03", "1949 scores on its 1949-12-03 final");
const datesScored = new Set(acc.cycles.flatMap((c) => c.houses.map((h) => c.year + "|" + h.date)));
let approxScored = 0;
for (const [b, rows] of Object.entries(D.cyclePolls)) for (const p of rows) if (p.dateApprox && datesScored.has(b + "|" + p.date)) approxScored++;
ok(approxScored === 0, "no dateApprox wave in the accuracy record");
const end = (y) => defs.find((c) => c.year === y).endRes.tpp;
ok(end(1949) === 50.7 && end(1951) === 49.3, "1949–51 ends Menzies 50.7, 1951–54 ends Menzies 49.3");
const c1951 = defs.find((c) => c.year === 1951), c1949 = defs.find((c) => c.year === 1949);
ok(c1949.oppLead === "Chifley" && c1951.oppLead === "Chifley → Evatt", "Chifley → Evatt handover sits in the 1951 term");

console.log("static copy");
const html = readFileSync(join(ROOT, "cycles/index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
const text = html.replace(/<[^>]+>/g, " ").replace(/&#8211;/g, "–").replace(/\s+/g, " ");
for (const [y, who] of [[1951, "Coalition"], [1954, "Coalition"], [1961, "Coalition"], [1969, "Coalition"], [1990, "Labor"], [1998, "Coalition"], [2010, "Labor"]])
  ok(new RegExp(`\\b${y} ${who} `).test(text), `results table: ${y} won by ${who}`);
const w = acc.worstCycle;
ok(w.n === 1 ? text.includes(`when ${w.houses[0].firm} was the only pollster`) && !/at \d{4} by [\d.]+, with every house/.test(text)
             : true, `worst miss (${w.year}, ${w.n} house) worded for its house count`);

console.log("page");
const server = http.createServer(async (req, res) => {
  try {
    let p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  for (const design of ["new", "old"]) {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://localhost:${PORT}/cycles/${design === "old" ? "?design=old" : ""}`, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const label = await page.evaluate(() => (typeof cycDotDate === "function" ? [cycDotDate("1954-05-15", "month"), cycDotDate("1972-11-25")] : null));
    if (design === "new") ok(label && /^May 1954$/.test(label[0]) && /^25 Nov/.test(label[1]), `dot date labels: ${JSON.stringify(label)}`);
    const hasCycles = await page.evaluate(() => document.body.innerText.includes("1943"));
    ok(hasCycles, `${design} design: Past cycles lists the 1943 term`);
    ok(errs.length === 0, `${design} design: no console errors${errs.length ? " – " + errs.slice(0, 2).join(" | ") : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? `\n${fails} FAIL` : "\nall ok");
process.exit(fails ? 1 : 0);
