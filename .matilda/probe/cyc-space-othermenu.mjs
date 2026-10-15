/* cyc-space-othermenu: pins the Past-cycles summary's Space complement claim
   (rd-cycles.jsx ~:1182, ninth site in auspol-spacebar-viewport-claim). Space
   rides VIEWPORT visibility and steps whichever #cyc-summary menu bar is NOT
   selected - press N times and it keeps cycling the SAME one. "Selected" =
   a pressed .rd-cc-tabs tab holding focus (the rule-4 pressed-tab admission),
   else the pointer's arrow claim (measure row hovered). A focused UNPRESSED
   tab or any other control keeps its native Space; the page never scrolls
   (even on held-key repeats) nor walks either menu while the claim is live
   and focused. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9025;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

/* the summary's two menu bars identified by their aria-labels; textContent
   carries the compare rows' count span, so labels are matched by substring */
const stateJs = `window.__st = (() => {
  const sec = document.getElementById("cyc-summary");
  const p = (lab) => {
    const g = sec.querySelector('[aria-label="' + lab + '"]');
    const b = [...g.querySelectorAll("[aria-pressed]")].find((x) => x.getAttribute("aria-pressed") === "true");
    return b ? b.textContent.trim() : null;
  };
  return { cmp: p("Compare with"), meas: p("Measure") };
})()`;

/* the claims live at the current scroll position: every viewport-claim
   section that exists, is displayed and intersects (returned names) */
const claimsJs = `window.__claims = (() => {
  const ids = ["cyc-summary", "rd-ap-top", "latest-polls", "house-lean", "two-party", "primary-vote", "flow-drift", "who-votes", "switching"];
  const out = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) out.push(id);
  }
  return out;
})()`;

const read = (page, js) => page.evaluate(js);

const space = async (page, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await new Promise((r) => setTimeout(r, 200));
  }
};
const blur = (page) => page.evaluate(() => document.activeElement && document.activeElement.blur());

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.setViewport({ width: 1440, height: 960 });
    await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('#cyc-summary [aria-label="Measure"]', { timeout: 45000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1200));

    const park = async () => {
      await page.evaluate(() => {
        const sec = document.getElementById("cyc-summary");
        window.scrollTo(0, sec.offsetTop - 120);
        document.activeElement && document.activeElement.blur();
      });
      await new Promise((r) => setTimeout(r, 500));
    };
    await park();

    const claims = await read(page, claimsJs);
    check("parked: the summary is the only viewport claim live",
      claims.length === 1 && claims[0] === "cyc-summary", JSON.stringify(claims));

    /* A. unfocused baseline: Space walks the SAME menu (Measure) each press */
    const s0 = await read(page, stateJs);
    const LEVELS = ["Level", "Change since election"];
    const CMPS = ["All past terms", "Re-elected", "Ousted"];
    check("A: load picks sit in the two menu bars",
      !!s0.meas && LEVELS.some((l) => s0.meas.includes(l)) && !!s0.cmp && CMPS.some((c) => s0.cmp.includes(c)),
      JSON.stringify(s0));
    const y0 = await page.evaluate(() => window.scrollY);
    const seq = [s0.meas];
    for (let i = 0; i < 4; i++) {
      await space(page);
      const s = await read(page, stateJs);
      seq.push(s.meas);
      check("A: press " + (i + 1) + " steps the measure row, compare row untouched",
        s.meas !== seq[seq.length - 2] && s.cmp === s0.cmp, JSON.stringify(s));
    }
    check("A: the two-option walk cycles back to the load default",
      seq[2] === s0.meas && seq[4] === s0.meas, JSON.stringify(seq));
    check("A: the page never scrolled while claimed", Math.abs(await page.evaluate(() => window.scrollY) - y0) < 1, "");

    /* B. pointer on the measure row flips Space onto the COMPARE roster */
    await page.hover('#cyc-summary [aria-label="Measure"]');
    await new Promise((r) => setTimeout(r, 400));
    let prev = s0.cmp, moved = true, measHeld = true;
    for (let i = 0; i < 2; i++) {
      await space(page);
      const s = await read(page, stateJs);
      if (s.cmp === prev) moved = false;
      if (s.meas !== s0.meas) measHeld = false;
      prev = s.cmp;
    }
    check("B: pointer on the measure row makes Space step the compare roster", moved, "");
    check("B: the measure pick is untouched while the pointer claims it", measHeld, "");
    check("B: the page never scrolled while claimed", Math.abs(await page.evaluate(() => window.scrollY) - y0) < 1, "");

    /* pointer away (into the section, off both rows): back to measure */
    const spot = await page.evaluate(() => {
      const r = document.getElementById("cyc-summary").getBoundingClientRect();
      return { x: Math.round(r.left + Math.min(40, r.width / 4)), y: Math.round(Math.min(r.bottom - 6, innerHeight - 6)) };
    });
    await page.mouse.move(spot.x, spot.y);
    await new Promise((r) => setTimeout(r, 400));
    await space(page);
    let s = await read(page, stateJs);
    check("B: pointer off the rows puts Space back on the measure row",
      s.meas !== s0.meas && s.cmp === prev, JSON.stringify(s));

    /* C. a pressed tab holding focus: Space steps the OTHER menu */
    await page.click('#cyc-summary [aria-label="Measure"] button[aria-pressed="false"]');
    await new Promise((r) => setTimeout(r, 300));
    const fc = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { tag: a.tagName, pressed: a.getAttribute("aria-pressed"), group: a.closest('[aria-label]') && a.closest('[aria-label]').getAttribute("aria-label") } : null;
    });
    check("C: the clicked measure tab holds focus as the pressed tab",
      !!fc && fc.tag === "BUTTON" && fc.pressed === "true" && fc.group === "Measure", JSON.stringify(fc));
    const sC = await read(page, stateJs);
    await space(page);
    s = await read(page, stateJs);
    check("C: Space with the focused pressed tab steps the OTHER (compare) row",
      s.cmp !== sC.cmp && s.meas === sC.meas, JSON.stringify({ from: sC, to: s }));
    check("C: the page never scrolled while claimed", Math.abs(await page.evaluate(() => window.scrollY) - y0) < 1, "");
    const stillFocused = await page.evaluate(() => {
      const a = document.activeElement;
      return a && a.getAttribute("aria-pressed") === "true";
    });
    check("C: the pressed tab keeps its focus (no re-pick, no blur)", stillFocused === true, "");
    await blur(page);

    /* D. a focused UNPRESSED tab keeps native Space (it picks itself) */
    await page.evaluate(() => {
      const g = document.querySelector('#cyc-summary [aria-label="Measure"]');
      const t = [...g.querySelectorAll("[aria-pressed]")].find((b) => b.getAttribute("aria-pressed") === "false");
      t.focus();
    });
    const sD = await read(page, stateJs);
    await space(page);
    s = await read(page, stateJs);
    check("D: native Space on a focused unpressed tab picks THAT tab",
      s.meas !== sD.meas && s.cmp === sD.cmp, JSON.stringify({ from: sD, to: s }));
    await blur(page);

    /* E. any other focused control keeps its native Space (chart checkbox) */
    const box = await page.evaluate(() => {
      const b = document.querySelector("#cyc-primary .rd-cyc-ctls input");
      if (!b) return null;
      b.focus();
      return b.checked;
    });
    if (box === null) {
      check("E: a chart overlay checkbox exists to focus", false, "no input found");
    } else {
      const sE = await read(page, stateJs);
      await space(page);
      const after = await page.evaluate(() => {
        const b = document.querySelector("#cyc-primary .rd-cyc-ctls input");
        return { checked: b.checked, st: null };
      });
      s = await read(page, stateJs);
      check("E: native Space toggles the focused checkbox", after.checked !== box, "before=" + box + " after=" + after.checked);
      check("E: the summary menus stay put for another control's Space",
        s.meas === sE.meas && s.cmp === sE.cmp, JSON.stringify({ from: sE, to: s }));
      await blur(page);
    }

    /* F. held-key repeats are swallowed, never machine-gunned (re-park first:
       block D's native pick re-flows the head, and the pin-scroll that keeps
       the controls row steady is a legit scroll; moved content can also slide
       the measure row under the parked pointer, so re-ground the pointer on
       the section floor before judging) */
    await park();
    const spotF = await page.evaluate(() => {
      const r = document.getElementById("cyc-summary").getBoundingClientRect();
      return { x: Math.round(r.left + Math.min(40, r.width / 4)), y: Math.round(Math.min(r.bottom - 6, innerHeight - 6)) };
    });
    await page.mouse.move(spotF.x, spotF.y);
    await new Promise((r) => setTimeout(r, 400));
    const yF = await page.evaluate(() => window.scrollY);
    const sF = await read(page, stateJs);
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 250));
    s = await read(page, stateJs);
    check("F: held-key repeats step nothing", s.meas === sF.meas && s.cmp === sF.cmp, JSON.stringify({ from: sF, to: s }));
    check("F: held-key repeats never scroll", Math.abs(await page.evaluate(() => window.scrollY) - yF) < 1, "");
    await space(page);
    s = await read(page, stateJs);
    check("F: a fresh press still steps once", s.meas !== sF.meas && s.cmp === sF.cmp, JSON.stringify(s));

    /* G. off the claim: Space keeps its scroll day job */
    const s2 = await read(page, stateJs);
    const outBelow = await page.evaluate(() => {
      const sec = document.getElementById("cyc-summary");
      window.scrollTo(0, sec.offsetTop + sec.offsetHeight + 200);
      return true;
    }).then(async () => {
      /* the page's smooth scroll-behavior animates scrollTo - wait it out
         before asserting positions */
      await new Promise((r) => setTimeout(r, 1300));
      return page.evaluate(() => {
        const r = document.getElementById("cyc-summary").getBoundingClientRect();
        return { y: window.scrollY, out: r.bottom <= 0 || r.top >= innerHeight };
      });
    });
    check("G: scrolled clear below the summary", outBelow.out, JSON.stringify(outBelow));
    await space(page);
    const yB = await page.evaluate(() => window.scrollY);
    s = await read(page, stateJs);
    check("G: off-claim Space scrolls the page", yB > outBelow.y + 100, "scrollY " + outBelow.y + " -> " + yB);
    check("G: off-claim Space leaves both menus untouched", s.meas === s2.meas && s.cmp === s2.cmp, JSON.stringify(s));

    /* G-above does not exist: #cyc-summary is the page's FIRST section, so
       even at scrollY 0 part of it intersects the viewport and the claim
       stays live (the mirror of flow-drift's only-above exit) - the below
       direction is the only native day-job negative */
    check("no page exceptions across the whole sweep", pageErrors.length === 0, pageErrors[0] || "");
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
