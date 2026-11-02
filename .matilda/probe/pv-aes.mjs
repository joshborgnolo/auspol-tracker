/* Pins the AES diamonds in the Primary-vote panel's subpopulation view
   (2026-11-02, follow-up to 30071f5e's Who-votes wiring; e779e049 moved the
   figures to the AES respondent file): for every cut the survey measures
   the site's way (gender, age, generations, education, housing, work
   status) each party's 2025 vote, One Nation and Others included,
   sits as a hollow diamond at the election month, lead-ins join the lines,
   hovering the election stop tips the AES figures, every other subpop view
   and the all-voters view stay untouch­ed, and nothing hits the boundary.
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
  /* dashed AES lead-ins are <g> layers with 2-point dashed paths: count
     short dashed paths in the chart */
  const dashLeads = svg ? [...svg.querySelectorAll("path")].filter((p) =>
    (p.getAttribute("stroke-dasharray") || "").trim() !== "" && (p.getAttribute("d") || "").startsWith("M")).length : 0;
  const burned = [...document.querySelectorAll("body *")].some((n) =>
    n.children.length === 0 && /hit an error and could not display/i.test(n.textContent || ""));
  return { diamonds, dashLeads, keyText: key ? key.textContent : "", burned };
});

/* since e779e049 the AES figures come from its respondent file: every party
   (One Nation coded apart), every cut it measures the site's way */
for (const [grp, expD] of [["Men", 5], ["Women", 5], ["Gen Z", 5], ["Millennials", 5], ["Gen X", 5], ["Boomers", 5], ["18–34", 5], ["University", 5], ["Renting", 5], ["Retired", 5]]) {
  await choose(grp);
  await new Promise((r) => setTimeout(r, 800));
  const s = await cardState();
  ok(`${grp}: five diamonds (every party)`, s.diamonds === expD, `diamond paths=${s.diamonds}`);
  ok(`${grp}: key names the source`, /Australian Election Study 2025/.test(s.keyText));
  ok(`${grp}: dotted lead-ins present`, s.dashLeads >= 4, `dashed paths=${s.dashLeads}`);
  ok(`${grp}: no boundary`, !s.burned);

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
      ok("Gen Z: on-diamond tip names the survey", /Australian Election Study 2025/.test(t1), t1.replace(/\s+/g, " ").slice(0, 80));
      ok("Gen Z: on-diamond tip prints the AES share and the group's respondents", /\d\.\d/.test(t1.split("2025")[1] || "") && /231 respondents/.test(t1), t1.replace(/\s+/g, " ").slice(0, 140));
      ok("Gen Z: on-diamond tip says not pooled", /not pooled/.test(t1));
      /* column stop: same x, clear of the dots */
      await page.mouse.move(diaBox.x, diaBox.top + diaBox.h * 0.12);
      await new Promise((r) => setTimeout(r, 500));
      const t2 = await tipText();
      ok("Gen Z: stop tip titles May 2025", /May 2025/.test(t2), t2.replace(/\s+/g, " ").slice(0, 60));
      ok("Gen Z: stop tip names the AES and its respondents", /Australian Election Study 2025, 231 respondents/.test(t2), t2.replace(/\s+/g, " ").slice(0, 140));
    }
  }
}

/* negative controls */
for (const grp of ["NSW", "Rural", "English only", ""]) {
  await choose(grp);
  await new Promise((r) => setTimeout(r, 700));
  const s = await cardState();
  ok(`"${grp || "All voters"}": no AES diamonds`, s.diamonds === 0, `diamonds=${s.diamonds}`);
  ok(`"${grp || "All voters"}": key silent on the AES`, !/Australian Election Study/.test(s.keyText));
  ok(`"${grp || "All voters"}": no boundary`, !s.burned);
}
ok("no page errors throughout", errors.length === 0, errors[0] || "");
console.log(bad ? `\n${bad} FAILED` : "\npv-aes: all clean");
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
