/* Pins the election-time marks in the Primary-vote panel's subpopulation view.
   - The AES diamonds (2026-11-02, follow-up to 30071f5e's Who-votes wiring;
     e779e049 moved the figures to the AES respondent file): for every cut the
     survey measures the site's way (gender, age, generations, education,
     housing, work status) each party's 2025 vote, One Nation and Others
     included, sits as a hollow diamond at the election month.
   - The polls at the election (2026-11-03, D.demoElection): for every cut the
     houses printed before polling day (all of those bar the generations, plus
     language at home) each party's figure over the six weeks before the
     election sits as an open triangle. The lead-ins join the lines from the
     triangles, and hovering the election stop names the polls; on the
     generations the diamonds keep the lead-ins and the AES tip.
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
  const pelLeads = svg ? svg.querySelectorAll('[data-series^="pel-ld-"]').length : 0;
  const aeLeads = svg ? svg.querySelectorAll('[data-series^="ae-ld-"]').length : 0;
  /* dashed AES lead-ins are <g> layers with 2-point dashed paths: count
     short dashed paths in the chart */
  const dashLeads = svg ? [...svg.querySelectorAll("path")].filter((p) =>
    (p.getAttribute("stroke-dasharray") || "").trim() !== "" && (p.getAttribute("d") || "").startsWith("M")).length : 0;
  const burned = [...document.querySelectorAll("body *")].some((n) =>
    n.children.length === 0 && /hit an error and could not display/i.test(n.textContent || ""));
  return { diamonds, triangles, pelLeads, aeLeads, dashLeads, keyText: key ? key.textContent : "", burned };
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
  /* the polls' own election-time figures: every cut but the generations */
  const gen = ["Gen Z", "Millennials", "Gen X", "Boomers"].includes(grp);
  ok(`${grp}: ${gen ? "no triangles (no house cut generations before the election)" : "five triangles (the polls at the election)"}`, s.triangles === (gen ? 0 : 5), `triangle paths=${s.triangles}`);
  ok(`${grp}: lead-ins from the ${gen ? "diamonds" : "triangles"}`, gen ? s.aeLeads >= 4 && s.pelLeads === 0 : s.pelLeads >= 4 && s.aeLeads === 0, `pel=${s.pelLeads} ae=${s.aeLeads}`);
  if (!gen) ok(`${grp}: key names the polls at the election`, /Polls at the 2025 election/.test(s.keyText));

  if (grp === "Men") {
    /* a triangle's tip names the polls and their six weeks; the stop's
       column tip names them too */
    const triBox = await page.evaluate(() => {
      const sec = document.getElementById("primary-vote");
      const svg = sec.querySelector(".rd-pv-chart svg");
      svg.scrollIntoView({ block: "center" });
      const tri = [...svg.querySelectorAll("path.scatter-dot")].find((p) => {
        const d = p.getAttribute("d") || "";
        return (d.match(/ L /g) || []).length === 2 && /Z$/.test(d.trim());
      });
      if (!tri) return null;
      const r = tri.getBoundingClientRect(), b = svg.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: b.y, h: b.height };
    });
    ok("Men: triangle found for hover", !!triBox);
    const tipNow = async () => page.evaluate(() => { const t = document.querySelector(".tip"); return t && t.offsetParent ? t.textContent : ""; });
    if (triBox) {
      await page.mouse.move(triBox.x, triBox.y);
      await new Promise((r) => setTimeout(r, 500));
      const t1 = await tipNow();
      ok("Men: on-triangle tip names the polls and the six weeks", /Polls at the 2025 election/.test(t1) && /six weeks before polling day/.test(t1) && /polls? from/.test(t1), t1.replace(/\s+/g, " ").slice(0, 160));
      await page.mouse.move(triBox.x, triBox.top + triBox.h * 0.12);
      await new Promise((r) => setTimeout(r, 500));
      const t2 = await tipNow();
      ok("Men: stop tip titles May 2025 and names the polls", /May 2025/.test(t2) && /The polls over the six weeks before polling day/.test(t2), t2.replace(/\s+/g, " ").slice(0, 160));
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

/* language at home: the polls cut it before the election, the AES never asked */
await choose("English only");
await new Promise((r) => setTimeout(r, 700));
{
  const s = await cardState();
  ok(`"English only": five triangles, no AES diamonds`, s.triangles === 5 && s.diamonds === 0, `triangles=${s.triangles} diamonds=${s.diamonds}`);
  ok(`"English only": key names the polls, silent on the AES`, /Polls at the 2025 election/.test(s.keyText) && !/Australian Election Study/.test(s.keyText));
  ok(`"English only": no boundary`, !s.burned);
}
/* negative controls: a counted base (the rings) or the all-voters view */
for (const grp of ["NSW", "Rural", ""]) {
  await choose(grp);
  await new Promise((r) => setTimeout(r, 700));
  const s = await cardState();
  ok(`"${grp || "All voters"}": no AES diamonds or poll triangles`, s.diamonds === 0 && s.triangles === 0, `diamonds=${s.diamonds} triangles=${s.triangles}`);
  ok(`"${grp || "All voters"}": key silent on the AES and the polls at the election`, !/Australian Election Study|Polls at the 2025 election/.test(s.keyText));
  ok(`"${grp || "All voters"}": no boundary`, !s.burned);
}
ok("no page errors throughout", errors.length === 0, errors[0] || "");
console.log(bad ? `\n${bad} FAILED` : "\npv-aes: all clean");
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
