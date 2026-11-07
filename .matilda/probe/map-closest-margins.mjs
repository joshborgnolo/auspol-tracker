// Probe: /map/'s "Closest seats" list widens its decimal places until a hairline
// margin shows (1dp → 2dp → 3dp), and every row carries its vote margin
// "(26 votes)" beside the figure.
// usage: node .matilda/probe/map-closest-margins.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
await page.goto(`${base}/map/#y=2025`, { waitUntil: "networkidle2", timeout: 60000 });
await wait(1500);

const sec = await page.evaluate(() => {
  const h3s = [...document.querySelectorAll("#story .st-sec h3")];
  const h3 = h3s.find((h) => /^Closest seats/.test(h.textContent));
  if (!h3) return null;
  return [...h3.parentElement.querySelectorAll(".links button")].map((b) => ({
    nm: b.querySelector(".nm")?.childNodes[0]?.textContent.trim(),
    st: b.querySelector(".nm small")?.textContent.trim(),
    v: b.querySelector("b")?.childNodes[0]?.textContent.trim(),
    votes: b.querySelector("b small")?.textContent.trim(),
  }));
});
console.log("rows:", JSON.stringify(sec, null, 1));
ok("section found", !!sec);
if (sec) {
  ok("six seats", sec.length === 6, `${sec.length}`);
  const br = sec.find((r) => r.nm === "Bradfield");
  ok("Bradfield listed", !!br);
  // margin is winPct − 50 (56,114/56,088 votes → 0.0116 pt over 26 votes) — one decimal printed "0.0"
  if (br) {
    ok("Bradfield margin two decimals", br.v === "0.01", br.v);
    ok("Bradfield votes margin shown", br.votes === "(26 votes)", br.votes);
  }
  ok("no 0.0 row remains", sec.every((r) => r.v !== "0.0"), sec.map((r) => r.v).join(","));
  ok("rest stay one decimal", sec.filter((r) => r !== br).every((r) => /^\d+\.\d$/.test(r.v)), sec.map((r) => r.v).join(","));
  ok("every row carries (x votes)", sec.every((r) => /^\((\d[\d,]*|…) votes?\)$/.test(r.votes || "")), sec.map((r) => r.votes).join(","));
}
ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-closest-margins: ok");
process.exit(fails.length ? 1 : 0);
