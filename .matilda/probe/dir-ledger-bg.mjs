/* Pin the direction-ledger breakdown (gen-data dir.bg → RdLgDir) on the
   worktree build: expand Direction-facet rows and assert the printed
   splits render, per wave:
   · SEC Newgate waves → the five-state pair line
   · Roy Morgan waves that printed splits → gender pair / voting-intention
     wrong-shares (Labor voters' right share in the "(right N)" tail)
   · waves with no printed split (RM 2026-10-11, Essential, and every row
     still inside the file's own copy) → NO breakdown line
   Also pins the cell-row CSS actually applying (13px cells, 11px heads). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 8776;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const failures = [];
const ok = (label, cond, extra) => { console.log((cond ? " ok " : "FAIL") + " " + label + (extra ? " — " + extra : "")); if (!cond) failures.push(label); };

await page.goto(`http://127.0.0.1:${PORT}/allpolls/?f=d`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll(".rd-ap-row").length > 0, { timeout: 30000 })
  .catch(() => console.log("warn: rows did not arrive in 30s"));

const rows = await page.evaluate(async () => {
  const out = [];
  const els = [...document.querySelectorAll(".rd-ap-row")];
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    el.scrollIntoView({ block: "center" });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r2) => setTimeout(r2, 600));
    const det = document.querySelector(".rd-ap-detail, [class*=rd-ap-det]");
    const cur = document.querySelector(".rd-ldg-dircut");
    out.push({
      name: (el.innerText || "").trim().split("\n")[0].slice(0, 60),
      cuts: cur ? cur.innerText : null,
      headPx: cur ? getComputedStyle(cur.querySelector(".rd-ldg-dircut-h")).fontSize : null,
      rowPx: cur ? getComputedStyle(cur.querySelector(".rd-ldg-dircut-r")).fontSize : null,
      boundary: document.body.innerText.includes("hit an error"),
    });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); // collapse
    await new Promise((r2) => setTimeout(r2, 260));
    if (out[out.length - 1].boundary) break;
  }
  return out;
});
console.log("rows walked:", rows.length);
ok("no boundary anywhere", rows.every((r) => !r.boundary));

const byKey = (frag, date) => rows.find((r) => r.name.includes(frag) && r.name.includes(date) && r.cuts);
const byKeyAbs = (frag, date) => rows.find((r) => r.name.includes(frag) && r.name.includes(date));

// SEC Newgate 2026-09-14 → 2026-09 state table
const sec = byKey("SEC Newgate", "Sep 2026") || rows.find((r) => r.name.includes("SEC Newgate") && r.cuts);
ok("an SEC Newgate row carries a state line", !!sec, sec ? sec.name : "");
if (sec) {
  const t = sec.cuts.replace(/\s+/g, " ");
  ok("SEC head", t.includes("By state, per cent right–wrong:"));
  ok("SEC five states", ["NSW", "VIC", "QLD", "SA", "WA"].every((s) => t.includes(" " + s)), t.slice(0, 220));
  ok("SEC head 11px / cells 13px", sec.headPx === "11px" && sec.rowPx === "13px", sec.headPx + " / " + sec.rowPx);
}
// Roy Morgan wave with the gender split printed → gender pair + voting-intention wrong-shares
const rmCutRows = rows.filter((r) => r.name.includes("Roy Morgan") && r.cuts);
const rm = rmCutRows.find((r) => r.cuts.includes("By gender"));
ok("a Roy Morgan September row carries splits", !!rm, rm ? rm.name : rows.filter((r) => r.name.includes("Roy Morgan") && r.cuts).map((r) => r.name).join(" · "));
if (rm) {
  const t = rm.cuts.replace(/\s+/g, " ");
  ok("RM gender head + pair", t.includes("By gender, per cent right–wrong:") && /Men 24\.5–62\.5/.test(t) && /Women 23–61\.5/.test(t), t.slice(0, 260));
  ok("RM vote head + wrong-shares", t.includes("By voting intention, per cent saying wrong track:")
      && /One Nation 91/.test(t) && /Coalition 76/.test(t) && /Other parties 69/.test(t)
      && /Independents 60/.test(t) && /Greens 59/.test(t), t.slice(0, 260));
  ok("RM Labor right-share tail", /Labor 26\ ?\(right 54\)/.test(t), t.slice(0, 300));
}
// Roy Morgan 2026-10-11 (state-extremes-only fortnight) → no breakdown line
const rm2 = byKeyAbs("Roy Morgan", "Oct 2026");
ok("RM 2026-10-11 has NO breakdown line", !rm2 || !rm2.cuts, rm2 ? rm2.name + " cuts=" + (rm2.cuts || "").slice(0, 60) : "(row not in walked set)");
// a no-split house row → no breakdown line
const ess = rows.find((r) => r.name.includes("Essential"));
ok("an Essential row has NO breakdown line", !ess || !ess.cuts);

console.log(0);
server.close();
await browser.close();
process.exit(failures.length ? 1 : 0);
