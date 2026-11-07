// Probe: /map/'s margin list — the "Most marginal <small>/ Safest" section
// with its up/down-arrow toggle in the head. The list widens decimal places
// until a hairline margin shows (1dp → 2dp → 3dp), every row carries its vote
// margin "(26 votes)" beside the figure, and the head's toggle flips the
// section from tightest to widest margins and back.
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

const readSec = (headRe) => page.evaluate((re) => {
  const h3s = [...document.querySelectorAll("#story .st-sec h3")];
  const h3 = h3s.find((h) => new RegExp(re).test(h.textContent));
  if (!h3) return null;
  const head = h3.childNodes[0]?.textContent.trim();
  const btn = h3.querySelector("button[data-close-toggle]");
  const strokes = btn ? [...btn.querySelectorAll("path")].map((p) => p.getAttribute("stroke")) : [];
  const br = btn?.getBoundingClientRect(), hr = h3.getBoundingClientRect(), sm = h3.querySelector("small")?.getBoundingClientRect();
  return {
    head,
    button: !!btn,
    title: btn?.getAttribute("title") || "",
    strokes,
    rightAligned: !!br && hr.right - br.right < 2,
    onLine: !!br && !!sm && Math.abs(br.top + br.height / 2 - (sm.top + sm.height / 2)) < 6,
    rows: [...h3.parentElement.querySelectorAll(".links button")].map((b) => ({
      nm: b.querySelector(".nm")?.childNodes[0]?.textContent.trim(),
      v: b.querySelector("b")?.childNodes[0]?.textContent.trim(),
      votes: b.querySelector("b small")?.textContent.trim(),
    })),
  };
}, headRe.source);

let sec = await readSec(/^Most marginal seats\b/);
console.log("marginal rows:", JSON.stringify(sec?.rows, null, 1));
ok("marginal head found", !!sec);
assertMarginal(sec);

// the toggle flips the read to Safest
await page.click("#story [data-close-toggle]");
await wait(300);
sec = await readSec(/^Safest seats\b/);
console.log("safest rows:", JSON.stringify(sec?.rows, null, 1));
ok("safest head found", !!sec);
ok("head reads Safest seats", sec?.head === "Safest seats", sec?.head);
ok("safest button present", !!(sec && sec.button));
if (sec) {
  ok("safest title offers the way back", sec.title === "Show most marginal seats", sec.title);
  ok("six seats", sec.rows.length === 6, `${sec.rows.length}`);
  const nums = sec.rows.map((r) => parseFloat(r.v));
  ok("margins run wide to narrow", nums.every((v, i) => i === 0 || nums[i - 1] >= v), sec.rows.map((r) => r.v).join(","));
  ok("safest rows stay one decimal", sec.rows.every((r) => /^\d+\.\d$/.test(r.v)), sec.rows.map((r) => r.v).join(","));
  ok("safest rows carry (x votes)", sec.rows.every((r) => /^\((\d[\d,]*|…) votes?\)$/.test(r.votes || "")), sec.rows.map((r) => r.votes).join(","));
  ok("Bradfield gone from Safest", sec.rows.every((r) => r.nm !== "Bradfield"));
  ok("up arrow lit, down dim", sec.strokes.join() === "var(--ink),var(--ink-3)", sec.strokes.join(","));
}

// and flips straight back
await page.click("#story [data-close-toggle]");
await wait(300);
sec = await readSec(/^Most marginal seats\b/);
ok("toggle returns to Most marginal seats", !!sec);
assertMarginal(sec);

function assertMarginal(sec) {
  if (!sec) return;
  ok("head reads Most marginal seats", sec.head === "Most marginal seats", sec.head);
  ok("six seats", sec.rows.length === 6, `${sec.rows.length}`);
  ok("button present in head", sec.button);
  ok("title offers Safest", sec.title === "Show safest seats", sec.title);
  ok("button right-aligned in head", sec.rightAligned);
  ok("button sits on the head's line", sec.onLine);
  ok("down arrow lit, up dim", sec.strokes.join() === "var(--ink-3),var(--ink)", sec.strokes.join(","));
  const br = sec.rows.find((r) => r.nm === "Bradfield");
  ok("Bradfield listed", !!br);
  // margin is winPct − 50 (56,114/56,088 votes → 0.0116 pt over 26 votes) — one decimal printed "0.0"
  if (br) {
    ok("Bradfield margin two decimals", br.v === "0.01", br.v);
    ok("Bradfield votes margin shown", br.votes === "(26 votes)", br.votes);
  }
  ok("no 0.0 row remains", sec.rows.every((r) => r.v !== "0.0"), sec.rows.map((r) => r.v).join(","));
  ok("rest stay one decimal", sec.rows.filter((r) => r !== br).every((r) => /^\d+\.\d$/.test(r.v)), sec.rows.map((r) => r.v).join(","));
  ok("every row carries (x votes)", sec.rows.every((r) => /^\((\d[\d,]*|…) votes?\)$/.test(r.votes || "")), sec.rows.map((r) => r.votes).join(","));
}

ok("no page errors", errs.length === 0, errs[0] || "");
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "map-closest-margins: ok");
process.exit(fails.length ? 1 : 0);
