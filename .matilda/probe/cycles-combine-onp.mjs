/* cycles-combine-onp: the Past-cycles primary-chart overlays draw the current
   term's SUMMED line ("Combine L/NP and ON") and the lone One Nation line
   ("One Nation this term") on the opposition chart; the government's primary
   chart offers no boxes. Asserts the box sets, the end-notes' figures against
   the cycle data (level AND change modes), the party colour, that unticking
   removes each note, and that nothing overflows the page — at 1280 and 390.
   Also the summary table's "One Nation's primary vote" and
   "L/NP + ON combined primary vote" rows (below "Opposition's primary vote"):
   row order, level figures, past-term strips, and change-mode figures. Also
   "Hanson's net approval" (below "Opposition leader's net approval"): its
   strip and rank are the opposition leader's peer set (no past term rated
   her - raw.han null-pads), its figure the sitting term's own Hanson reading. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8968;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    const body = await readFile(p.endsWith("/") ? p + "index.html" : p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    for (const vw of [1280, 390]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: vw, height: 900 });
      await page.goto(`http://127.0.0.1:${PORT}/#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
      // hash "cycles" lands the tab (readHash keys on it); no button hunt is
      // needed at either width - the phone row relabels it "Cycles"
      await page.waitForSelector("#cyc-primary .rd-cyc-chart", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));

      const expected = await page.evaluate(() => {
        const cur = window.AP.D.cycles.find((c) => c.current);
        const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
        const lastIdx = (ok) => cur.raw.months.reduce((acc, m, i) => (ok(i) ? i : acc), -1);
        const lvl = (fields, baseSum) => {
          const i = lastIdx((ix) => fields.every((f) => cur.raw[f][ix] != null));
          const sum = +fields.reduce((a, f) => a + cur.raw[f][i], 0).toFixed(1);
          return { lvl: sum.toFixed(1), chg: signed(+(sum - baseSum).toFixed(1)) };
        };
        /* Hanson's now-figure is her last READING (end.han); her change
           anchor is the first non-null month of the sparse series (cycBase
           on base.han - month-0 was never a Hanson reading) */
        const hanEnd = cur.end.han;
        const hanBase = (cur.base.han != null ? cur.base.han : (cur.raw.han || []).find((v) => v != null)) || 0;
        /* the Albanese-over-Hanson preferred-PM row follows the same sparse
           rules off raw.ppmh / end.ppmh */
        const ppmhEnd = cur.end.ppmh;
        const ppmhBase = (cur.base.ppmh != null ? cur.base.ppmh : (cur.raw.ppmh || []).find((v) => v != null)) || 0;
        return { comb: lvl(["oppr", "onp"], cur.base.oppr + cur.base.onp), onpV: lvl(["onp"], cur.base.onp),
                 han: { lvl: signed(+hanEnd.toFixed(1)), chg: signed(+(hanEnd - hanBase).toFixed(1)) },
                 ppmh: { lvl: signed(+ppmhEnd.toFixed(1)), chg: signed(+(ppmhEnd - ppmhBase).toFixed(1)) } };
      });

      /* the summary table's rows: names in order, the Now/Change cell, and
         how many past-term dots sit on the strip */
      const readSummary = () => page.evaluate(() => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].map((r) => ({
        name: r.querySelector(".rd-cs-name b").textContent.trim(),
        now: r.querySelector(".rd-cs-now").textContent.trim(),
        dots: r.querySelectorAll(".rd-cs-dot").length,
        rank: r.querySelector(".rd-cs-rank").textContent.trim(),
      })));
      const EXPECTED_NAMES = ["Two-party preferred", "Government’s primary vote", "Opposition’s primary vote",
        "One Nation’s primary vote", "L/NP + ON combined primary vote", "Preferred PM, lead", "Preferred PM, lead",
        "Prime minister’s net approval", "Opposition leader’s net approval", "Hanson’s net approval"];

      const snap = () => page.evaluate(() => {
        const charts = [...document.querySelectorAll("#cyc-primary .rd-cyc-chart")];
        const chk = (ch) => [...ch.querySelectorAll(".rd-check")].map((l) => l.textContent.trim());
        const svgTexts = (ch) => [...ch.querySelectorAll("svg text")].map((t) => t.textContent.trim());
        const checkOn = (ch) => [...ch.querySelectorAll(".rd-check input")].map((i) => i.checked);
        return {
          nCharts: charts.length,
          govChecks: charts[0] ? chk(charts[0]) : [],
          govOn: charts[0] ? checkOn(charts[0]) : [],
          oppChecks: charts[1] ? chk(charts[1]) : [],
          oppOn: charts[1] ? checkOn(charts[1]) : [],
          oppTexts: charts[1] ? svgTexts(charts[1]) : [],
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      /* click the checkbox whose label TEXT matches, on chart gi (0 gov, 1
         opp): a fixed input-index goes stale the moment a box is added */
      const tick = async (gi, label) => {
        await page.evaluate(([gi, label]) => {
          const chs = [...document.querySelectorAll("#cyc-primary .rd-cyc-chart")];
          const lab = [...chs[gi].querySelectorAll(".rd-check")]
            .find((l) => l.textContent.trim() === label);
          lab.querySelector("input").click();
        }, [gi, label]);
        await new Promise((r) => setTimeout(r, 900));
      };

      let s = await snap();
      check(`[${vw}] primary section draws its two charts`, s.nCharts === 2, `saw ${s.nCharts}`);
      check(`[${vw}] government chart offers no boxes`, s.govChecks.length === 0, JSON.stringify(s.govChecks));
      check(`[${vw}] opposition chart offers its two boxes`,
        JSON.stringify(s.oppChecks) === JSON.stringify(["Combine L/NP and ON", "One Nation this term"]),
        JSON.stringify(s.oppChecks));
      check(`[${vw}] all boxes start unticked`, s.oppOn.every((v) => !v), JSON.stringify(s.oppOn));
      check(`[${vw}] no overlay note before any tick`,
        !s.oppTexts.some((t) => /^(L\/NP \+ ON|One Nation) /.test(t)),
        JSON.stringify(s.oppTexts.filter((t) => /ON/.test(t))));

      // --- the summary table's One Nation and L/NP + ON combined rows
      let rows = await readSummary();
      check(`[${vw}] summary rows run tpp, gov, opp, ON, combined, leaders`,
        JSON.stringify(rows.map((r) => r.name)) === JSON.stringify(EXPECTED_NAMES),
        JSON.stringify(rows.map((r) => r.name)));
      const onpRow = rows.find((r) => r.name === "One Nation’s primary vote");
      const combRow = rows.find((r) => r.name === "L/NP + ON combined primary vote");
      check(`[${vw}] level: One Nation row reads ` + expected.onpV.lvl,
        onpRow && onpRow.now === expected.onpV.lvl + "%", onpRow ? onpRow.now : "(no row)");
      check(`[${vw}] level: combined row reads ` + expected.comb.lvl,
        combRow && combRow.now === expected.comb.lvl + "%", combRow ? combRow.now : "(no row)");
      check(`[${vw}] both new strips carry past-term dots`,
        !!(onpRow && combRow) && onpRow.dots > 0 && combRow.dots > 0,
        "onp " + (onpRow ? onpRow.dots : "n/a") + ", comb " + (combRow ? combRow.dots : "n/a"));
      const hanRow = rows.find((r) => r.name === "Hanson’s net approval");
      const oppNetRow = rows.find((r) => r.name === "Opposition leader’s net approval");
      check(`[${vw}] level: Hanson row reads her own ` + expected.han.lvl,
        hanRow && hanRow.now === expected.han.lvl, hanRow ? hanRow.now : "(no row)");
      check(`[${vw}] Hanson strip carries the opposition row’s peer dots`,
        !!(hanRow && oppNetRow) && hanRow.dots === oppNetRow.dots && hanRow.dots > 0,
        "han " + (hanRow ? hanRow.dots : "n/a") + " vs oppnet " + (oppNetRow ? oppNetRow.dots : "n/a"));
      check(`[${vw}] Hanson row ranks against past opposition leaders`,
        !!hanRow && /(Highest|Lowest|Middle) of \d+|(highest|lowest) of \d+/.test(hanRow.rank),
        hanRow ? hanRow.rank : "(no row)");
      /* the second Preferred-PM row is Albanese's lead over Hanson (the
         H2H pair): its own figure, but the main row's past-term peer dots
         and company */
      const ppmRows = rows.filter((r) => r.name === "Preferred PM, lead");
      const ppmhRow = ppmRows[1];
      check(`[${vw}] two Preferred-PM rows: the second is Albanese v Hanson`,
        ppmRows.length === 2 && !!ppmhRow, JSON.stringify(rows.map((r) => r.name)));
      check(`[${vw}] level: Albanese-over-Hanson row reads the H2H margin ` + expected.ppmh.lvl,
        ppmhRow && ppmhRow.now === expected.ppmh.lvl, ppmhRow ? ppmhRow.now : "(no row)");
      check(`[${vw}] its strip carries the preferred-PM row’s peer dots`,
        ppmRows.length === 2 && ppmhRow.dots === ppmRows[0].dots && ppmhRow.dots > 0,
        "ppmh " + (ppmhRow ? ppmhRow.dots : "n/a") + " vs ppmm " + (ppmRows[0] ? ppmRows[0].dots : "n/a"));
      check(`[${vw}] its rank joins past PMs’ preferred-PM leads`,
        !!ppmhRow && /(Highest|Lowest|Middle) of \d+|(highest|lowest) of \d+/.test(ppmhRow.rank),
        ppmhRow ? ppmhRow.rank : "(no row)");

      // --- One Nation this term (all boxes start off, so these ticks are on→)
      await tick(1, "One Nation this term");
      s = await snap();
      let note = s.oppTexts.filter((t) => /^One Nation /.test(t));
      check(`[${vw}] level: ticked ON draws its end-note`, note.length === 1, JSON.stringify(note));
      check(`[${vw}] level: note reads One Nation ${expected.onpV.lvl}`,
        note[0] === "One Nation " + expected.onpV.lvl, note[0] || "(none)");
      check(`[${vw}] ON note is in the party colour`, await page.evaluate(() => {
        const t = [...document.querySelectorAll("#cyc-primary .rd-cyc-chart svg text")]
          .find((x) => /^One Nation /.test(x.textContent.trim()));
        return t && t.style.fill === "var(--onp-text)";
      }), "");

      await tick(1, "Combine L/NP and ON");
      s = await snap();
      check(`[${vw}] both: ON + L/NP+ON notes coexist`,
        s.oppTexts.filter((t) => /^One Nation /.test(t)).length === 1 &&
        s.oppTexts.filter((t) => /^L\/NP \+ ON /.test(t)).length === 1,
        JSON.stringify(s.oppTexts.filter((t) => /ON/.test(t))));
      await tick(1, "One Nation this term");
      s = await snap();
      check(`[${vw}] unticking ON leaves the combined note alone`,
        !s.oppTexts.some((t) => /^One Nation /.test(t)) &&
        s.oppTexts.some((t) => t === "L/NP + ON " + expected.comb.lvl),
        JSON.stringify(s.oppTexts.filter((t) => /ON/.test(t))));

      /* --- change-since mode. State here: comb ON, One Nation OFF; tick One
         Nation back on, then switch. */
      await tick(1, "One Nation this term");
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("#cyc-summary .rd-tab, #cyc-summary button")]
          .find((x) => /Change since election|^Change$/.test(x.textContent.trim()));
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 1200));
      s = await snap();
      const onpChg = s.oppTexts.filter((t) => /^One Nation /.test(t));
      const combChg = s.oppTexts.filter((t) => /^L\/NP \+ ON /.test(t));
      check(`[${vw}] change: ON note carries its change figure`,
        onpChg.length === 1 && onpChg[0] === "One Nation " + expected.onpV.chg,
        JSON.stringify(onpChg) + " want " + expected.onpV.chg);
      check(`[${vw}] change: combined note carries the summed change`,
        combChg.length === 1 && combChg[0] === "L/NP + ON " + expected.comb.chg,
        JSON.stringify(combChg) + " want " + expected.comb.chg);

      // the summary table's two new rows in change mode
      rows = await readSummary();
      const onpRowC = rows.find((r) => r.name === "One Nation’s primary vote");
      const combRowC = rows.find((r) => r.name === "L/NP + ON combined primary vote");
      check(`[${vw}] change: One Nation row carries its change`,
        onpRowC && onpRowC.now === expected.onpV.chg,
        (onpRowC ? onpRowC.now : "(no row)") + " want " + expected.onpV.chg);
      check(`[${vw}] change: combined row carries the summed change`,
        combRowC && combRowC.now === expected.comb.chg,
        (combRowC ? combRowC.now : "(no row)") + " want " + expected.comb.chg);
      const hanRowC = rows.find((r) => r.name === "Hanson’s net approval");
      check(`[${vw}] change: Hanson row carries her own change`,
        hanRowC && hanRowC.now === expected.han.chg,
        (hanRowC ? hanRowC.now : "(no row)") + " want " + expected.han.chg);
      const ppmhRowC = rows.filter((r) => r.name === "Preferred PM, lead")[1];
      check(`[${vw}] change: Albanese-over-Hanson row carries the H2H change`,
        ppmhRowC && ppmhRowC.now === expected.ppmh.chg,
        (ppmhRowC ? ppmhRowC.now : "(no row)") + " want " + expected.ppmh.chg);

      // spelling guard: One Nation must render as words on the live chart
      check(`[${vw}] no bare "ON " note or "1N" typo on the chart`,
        !s.oppTexts.some((t) => /1N/.test(t)),
        JSON.stringify(s.oppTexts.filter((t) => /1N/.test(t))));

      /* back to level and clear everything. State here: comb ON, One Nation
         ON - so untick ON and comb and nothing more. */
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("#cyc-summary .rd-tab, #cyc-summary button")]
          .find((x) => /^\s*Level\s*$/.test(x.textContent.trim()));
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 1200));
      await tick(1, "One Nation this term");
      await tick(1, "Combine L/NP and ON");
      s = await snap();
      check(`[${vw}] all notes gone once unticked`,
        !s.oppTexts.some((t) => /^(One Nation|L\/NP \+ ON) /.test(t)),
        JSON.stringify(s.oppTexts.filter((t) => /ON/.test(t))));
      check(`[${vw}] no page-level horizontal overflow`, s.overflow <= 0, `overshoot ${s.overflow}px`);
      check(`[${vw}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
})();
