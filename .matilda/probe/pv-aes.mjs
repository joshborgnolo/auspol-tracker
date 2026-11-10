/* Pins the election-time marks in the Primary-vote panel's subpopulation view
   (2026-11-10: one estimate, gen-data DEMO_VOTE).
   For every cut the AES or the houses measured at the election (gender, age,
   generations, education, housing, work status, language at home) each
   party's 2025 vote among the group sits as ONE hollow diamond at the
   election month: the polls over the six weeks before polling day and the
   Australian Election Study 2025 weighted together, or the one source that
   cut the group (AES: generations; polls: language). No triangles.
   Lead-ins join the lines only where one source stands behind the mark; the
   diamond's tip quotes the readings and the stop's column tip names them.
   Every other subpop view and the all-voters view stay untouched, and nothing
   hits the boundary.
   Run: node .matilda/probe/pv-aes.mjs  */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8975;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1800));

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!cond) bad++;
};

const choose = async (value) => page.evaluate((v) => {
  const sel = document.querySelector('#primary-vote select[aria-label="The primary vote among"]');
  sel.value = v;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, value);
const cardState = () => page.evaluate(() => {
  const sec = document.getElementById("primary-vote");
  const key = sec.querySelector(".rd-ckey");
  const svg = sec.querySelector(".rd-pv-chart svg");
  const diamonds = svg ? [...svg.querySelectorAll("path")].filter((p) => {
    const d = p.getAttribute("d") || "";
    return (d.match(/ L /g) || []).length === 3 && /Z$/.test(d.trim());
  }).length : 0;
  const triangles = svg ? [...svg.querySelectorAll("path.scatter-dot")].filter((p) => {
    const d = p.getAttribute("d") || "";
    return (d.match(/ L /g) || []).length === 2 && /Z$/.test(d.trim());
  }).length : 0;
  /* a lead-in is a drawn segment; a both-source mark rides as one point */
  const evLeads = svg ? [...svg.querySelectorAll('path[data-series^="ev-ld-"]')].filter((n) => /L/.test(n.getAttribute("d") || "")).length : 0;
  /* dashed AES lead-ins are <g> layers with 2-point dashed paths: count
     short dashed paths in the chart */
  const dashLeads = svg ? [...svg.querySelectorAll("path")].filter((p) =>
    (p.getAttribute("stroke-dasharray") || "").trim() !== "" && (p.getAttribute("d") || "").startsWith("M")).length : 0;
  const burned = [...document.querySelectorAll("body *")].some((n) =>
    n.children.length === 0 && /hit an error and could not display/i.test(n.textContent || ""));
  return { diamonds, triangles, evLeads, dashLeads, keyText: key ? key.textContent : "", burned };
});

for (const [grp, expD] of [["Men", 5], ["Women", 5], ["Gen Z", 5], ["Millennials", 5], ["Gen X", 5], ["Boomers", 5], ["18–34", 5], ["University", 5], ["Renting", 5], ["Retired", 5]]) {
  await choose(grp);
  await new Promise((r) => setTimeout(r, 800));
  const s = await cardState();
  ok(`${grp}: five diamonds (every party), no triangles`, s.diamonds === expD && s.triangles === 0, `diamond paths=${s.diamonds} triangles=${s.triangles}`);
  ok(`${grp}: key names the estimate, not its sources`, /Estimated vote at the 2025 election/.test(s.keyText) && !/Polls at the 2025 election/.test(s.keyText));
  ok(`${grp}: no boundary`, !s.burned);
  /* one source (generations: the AES) keeps the lead-ins; both, none */
  const gen = ["Gen Z", "Millennials", "Gen X", "Boomers"].includes(grp);
  ok(`${grp}: ${gen ? "lead-ins from the diamonds (one source)" : "no lead-ins (two sources behind the mark)"}`, gen ? s.evLeads >= 4 : s.evLeads === 0, `ev=${s.evLeads}`);

  if (grp === "Men") {
    const box = await page.evaluate(() => {
      const sec = document.getElementById("primary-vote");
      const svg = sec.querySelector(".rd-pv-chart svg");
      svg.scrollIntoView({ block: "center" });
      const dia = [...svg.querySelectorAll("path.scatter-dot")].find((p) => {
        const d = p.getAttribute("d") || "";
        return (d.match(/ L /g) || []).length === 3 && /Z$/.test(d.trim());
      });
      if (!dia) return null;
      const r = dia.getBoundingClientRect(), b = svg.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: b.y, h: b.height };
    });
    ok("Men: diamond found for hover", !!box);
    const tipNow = async () => page.evaluate(() => { const t = document.querySelector(".tip"); return t && t.offsetParent ? t.textContent : ""; });
    if (box) {
      await page.mouse.move(box.x, box.y);
      await new Promise((r) => setTimeout(r, 500));
      const t1 = await tipNow();
      ok("Men: on-diamond tip names the estimate, both readings and the margin", /Estimated vote at the 2025 election/.test(t1) && /Polls in the six weeks before polling day \d/.test(t1) && /Australian Election Study \d/.test(t1) && /940 respondents/.test(t1) && /weighted together, ±\d/.test(t1), t1.replace(/\s+/g, " ").slice(0, 240));
      await page.mouse.move(box.x, box.top + box.h * 0.12);
      await new Promise((r) => setTimeout(r, 500));
      const t2 = await tipNow();
      const want = await page.evaluate(() => window.AUSPOL.demoVote.sets.gender.groups.Men.alp[0].toFixed(1));
      ok("Men: stop tip titles May 2025, names both sources and reads Labor at the estimate", /May 2025/.test(t2) && /Estimated from the polls before the election and the Australian Election Study 2025/.test(t2) && t2.includes(want), t2.replace(/\s+/g, " ").slice(0, 200));
      await page.mouse.move(5, 5);
    }
  }

  if (grp === "Gen Z") {
    /* two hover surfaces: on the diamond itself the point tip (pollster,
       printed share, not pooled); on the stop's x the column tip (the
       month's title + the AES row naming the figures as printed) */
    const diaBox = await page.evaluate(() => {
      const sec = document.getElementById("primary-vote");
      const svg = sec.querySelector(".rd-pv-chart svg");
      svg.scrollIntoView({ block: "center" });
      const dia = [...svg.querySelectorAll("path")].map((p) => {
        const d = p.getAttribute("d") || "";
        return (d.match(/ L /g) || []).length === 3 && /Z$/.test(d.trim()) ? p : null;
      }).filter(Boolean)[0];
      if (!dia) return null;
      const r = dia.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: s.y, h: s.height };
    });
    ok("Gen Z: diamond found for hover", !!diaBox);
    const tipText = async () => page.evaluate(() => {
      const t = document.querySelector(".tip");
      return t && t.offsetParent ? t.textContent : "";
    });
    if (diaBox) {
      await page.mouse.move(diaBox.x, diaBox.y);
      await new Promise((r) => setTimeout(r, 500));
      const t1 = await tipText();
      ok("Gen Z: on-diamond tip names the survey as the one source, its respondents and the margin", /From the Australian Election Study 2025/.test(t1) && /231 respondents/.test(t1) && /±\d/.test(t1), t1.replace(/\s+/g, " ").slice(0, 160));
      /* column stop: same x, clear of the dots */
      await page.mouse.move(diaBox.x, diaBox.top + diaBox.h * 0.12);
      await new Promise((r) => setTimeout(r, 500));
      const t2 = await tipText();
      ok("Gen Z: stop tip titles May 2025", /May 2025/.test(t2), t2.replace(/\s+/g, " ").slice(0, 60));
      ok("Gen Z: stop tip names the AES and its respondents", /Australian Election Study 2025, 231 respondents/.test(t2), t2.replace(/\s+/g, " ").slice(0, 140));
    }
  }
}

/* language at home: the polls cut it before the election, the AES never asked */
await choose("English only");
await new Promise((r) => setTimeout(r, 700));
{
  const s = await cardState();
  ok(`"English only": five diamonds from the polls alone, with lead-ins`, s.triangles === 0 && s.diamonds === 5 && s.evLeads >= 4, `triangles=${s.triangles} diamonds=${s.diamonds} ev=${s.evLeads}`);
  ok(`"English only": key names the estimate`, /Estimated vote at the 2025 election/.test(s.keyText));
  ok(`"English only": no boundary`, !s.burned);
}
/* negative controls: a counted base (the rings) or the all-voters view */
for (const grp of ["NSW", "Rural", ""]) {
  await choose(grp);
  await new Promise((r) => setTimeout(r, 700));
  const s = await cardState();
  ok(`"${grp || "All voters"}": no AES diamonds or poll triangles`, s.diamonds === 0 && s.triangles === 0, `diamonds=${s.diamonds} triangles=${s.triangles}`);
  ok(`"${grp || "All voters"}": key silent on the election estimate`, !/Australian Election Study|Polls at the 2025 election|Estimated vote/.test(s.keyText));
  ok(`"${grp || "All voters"}": no boundary`, !s.burned);
}
ok("no page errors throughout", errors.length === 0, errors[0] || "");
console.log(bad ? `\n${bad} FAILED` : "\npv-aes: all clean");
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
