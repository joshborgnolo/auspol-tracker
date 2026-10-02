/* cyc-rings: the Past-cycles VOTE charts (2PP, government primary, opposition
   primary) ring every DRAWN term at both of its elections - opening at x=0,
   closing at the next election's result - each in its line's own colour on
   that card (the opposition card's rings wear the opposition party's paint,
   matching its lines). The leadership cards keep none. And each vote line's
   lead-in run - the interpolated bridge from the election-day anchor to the
   term's first poll - draws DOTTED ("0.5 4"), distinct from the interior
   gap-dash ("6 6") and the band mean ("4 3"); leadership cards never dot.
   A past term's line ALSO runs a dotted lead-OUT: the two-point bridge from
   its final poll to its closing-election ring - the same "0.5 4" stroke,
   series id "c{year}-tail".
   Asserts at 1280 and 390:
   - default view: one ring per vote card at px(0), in the current term's
     line colour for that card (tpp/primary: c.color; oppr: the opposition
     party's colour); three leaders charts ringless and dotless.
   - data truth: 1996's closing endRes carries the canonical AEC two-decimal
     primaries (primary 39.52, oppr 40.10) plus the 1993/2016 fixtures; the
     1996 term's own anchor reads the fixed 47.25 (raw[0] 47.3), 1998's the
     fixed 39.52 (39.5).
   - keys: both vote sections say "Each term’s election results".
   - dashes: per vote card the dotted/gap path counts equal an in-page replay
     of obsRuns over the drawn cycles' obs flags, plus one "-tail" dotted
     run per drawn PAST term with a closing result; lead-in dotted paths
     start at px(0), tails end at px(endRes.x).
   - lifting 1996: three rings per vote card, the 1996 pair in its card
     colour, base at px(0)/py(raw[key][0]) and close at
     px(endRes.x)/py(endRes[key]); dash counts follow the replay, and a
     "c1996-tail" dotted run joins the 1996 line's final poll to its ring.
   - Level→Change fades every vote-card ring in place (opacity 0) while the
     dotted runs stay dotted (tail included, at its change-basis position);
     flip back, unlift 1996, and each vote card is back to its single
     current-colour ring, tail-free.
   - no page-level overflow, no page errors. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8971;
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

const px = (cardL, d) => cardL.fx.a + cardL.fx.b * d;
const py = (cardL, v) => cardL.fy.a + cardL.fy.b * v;

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
      await page.waitForSelector("#cyc-tpp .rd-cyc-chart", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));

      /* everything the asserts need, read live: per vote card the ring list,
         the dash counts and the fitted axis transforms (returned as
         coefficients - functions cannot cross the evaluate boundary), plus
         the obsRuns replay over the drawn cycles' obs flags for the
         expected dotted/gap counts */
      const live = (drawnYears) => page.evaluate((years) => {
        const D = window.AP.D;
        const cur = D.cycles.find((c2) => c2.current);
        const c96 = D.cycles.find((c2) => c2.year === 1996);
        const TICK_X = { "Election": 0, "1 year": 12, "1 yr": 12, "2 years": 24, "2 yrs": 24, "3 years": 36, "3 yrs": 36 };
        const fit = (pts, key) => {
          const n = pts.length;
          const md = pts.reduce((a, t) => a + t.d, 0) / n, mp = pts.reduce((a, t) => a + t[key], 0) / n;
          const b = pts.reduce((a, t) => a + (t.d - md) * (t[key] - mp), 0) / pts.reduce((a, t) => a + (t.d - md) ** 2, 0);
          return { a: mp - b * md, b };
        };
        const fitX = (el) => fit([...el.querySelectorAll("text.axis-label.x")]
          .map((t) => ({ p: +t.getAttribute("x"), d: TICK_X[t.textContent.trim()] }))
          .filter((t) => t.d != null)
          .map((t) => ({ d: t.d, x: t.p })), "x");
        const fitY = (el) => fit([...el.querySelectorAll("text.axis-label.y")]
          .map((t) => ({ p: +t.getAttribute("y"), d: parseFloat(t.textContent.trim().replace(/−/g, "-").replace(/[+%,]/g, "")) }))
          .filter((t) => Number.isFinite(t.d))
          .map((t) => ({ d: t.d, y: t.p })), "y");
        /* the peer-mean dot rides the same .rd-mark machinery with a fixed
           var(--ink-2) paint; the election rings are the party-coloured
           siblings - drop the mean so the ring lists count only election
           rings */
        const ringOf = (g) => {
          const c = g.querySelector("circle.rd-ring");
          return { op: getComputedStyle(g).opacity, stroke: c.style.stroke, cstroke: getComputedStyle(c).stroke,
                   cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy") };
        };
        /* same segment-merge the tabbed-views layer's obsRuns does, replayed
           on the raw rows so the expected dash split (dotted lead vs "6 6"
           interior gap) is derived, not retyped. `tail` replays the d1a1d215
           lead-out push: vote cards only, a drawn past term whose closing
           result exists and sits past its final poll earns one dotted
           two-point run ending at px(endRes.x) */
        const replay = (c, key) => {
          let dotted = 0, gap = 0, tails = [];
          const list = (key === "tpp" && c.raw.tppEras) ? c.raw.tppEras
            : [{ months: c.raw.months, vals: c.raw[key], obs: (c.raw.obs || {})[key] }];
          list.forEach((s, si) => {
            const pts = s.months.map((m, i) => ({ x: m, y: s.vals[i] })).filter((p) => p.y != null);
            if (pts.length < 2) return;
            const observed = (m) => { const i = s.months.indexOf(m); return i < 0 ? true : !!(s.obs && s.obs[i]); };
            const runs = [];
            for (let i = 0; i < pts.length - 1; i++) {
              const dashed = !(observed(pts[i].x) && observed(pts[i + 1].x));
              const last = runs[runs.length - 1];
              if (last && last.dashed === dashed) last.points.push(pts[i + 1]);
              else runs.push({ dashed, points: [pts[i], pts[i + 1]] });
            }
            runs.forEach((r) => {
              if (!r.dashed) return;
              if (r.points[0].x === 0) dotted++; else gap++;
            });
            if (si === list.length - 1 && c.endRes && c.endRes[key] != null) {
              const lastPt = pts[pts.length - 1];
              if (c.endRes.x > lastPt.x + 1e-6)
                tails.push({ id: "c" + c.year + (si ? "-e" + si : "") + "-tail", x0: lastPt.x, x1: c.endRes.x, end: c.endRes[key] });
            }
          });
          return { dotted, gap, tails };
        };
        const drawn = years.map((y) => D.cycles.find((c2) => c2.year === y));
        const expect = (key) => drawn.reduce((a, c) => {
          const r = replay(c, key);
          return { dotted: a.dotted + r.dotted + r.tails.length, gap: a.gap + r.gap, tails: a.tails.concat(r.tails) };
        }, { dotted: 0, gap: 0, tails: [] });
        const chartOf = (id, headRe) => [...document.querySelectorAll(id + " .rd-cyc-chart")]
          .find((el) => headRe.test((el.querySelector(".rd-chead-t") || {}).textContent || ""));
        const card = (el, key) => {
          const paths = [...el.querySelectorAll("path.series-line")].map((p) => {
            const nums = ((p.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
            return { id: p.getAttribute("data-series"), dash: p.getAttribute("stroke-dasharray"),
                     d0: nums.length ? nums[0] : null, dEnd: nums.length ? nums[nums.length - 2] : null,
                     dEndY: nums.length ? nums[nums.length - 1] : null, stroke: getComputedStyle(p).stroke };
          });
          const dotted = paths.filter((p) => p.dash === "0.5 4");
          return {
            key,
            rings: [...el.querySelectorAll(".rd-mark")].map(ringOf).filter((r) => r.stroke !== "var(--ink-2)"),
            lineStrokes: paths.filter((p) => p.id !== "cyc-band-mean").map((p) => p.stroke),
            meanDash: (paths.find((p) => p.id === "cyc-band-mean") || {}).dash || null,
            dotted,
            tails: dotted.filter((p) => (p.id || "").endsWith("-tail")),
            leads: dotted.filter((p) => !(p.id || "").endsWith("-tail")),
            gaps: paths.filter((p) => p.dash === "6 6"),
            expected: expect(key),
            fx: fitX(el), fy: fitY(el),
          };
        };
        const c98 = D.cycles.find((c2) => c2.year === 1998);
        return {
          curColor: cur.color, curYear: cur.year,
          curOppColor: D.PARTIES[cur.opp].color,
          c96color: c96.color, c96oppColor: D.PARTIES[c96.opp].color,
          c96endRes: c96.endRes || null,
          c96raw0: { primary: c96.raw.primary[0], oppr: c96.raw.oppr[0], tpp: c96.raw.tpp[0] },
          c19endRes: (D.cycles.find((c2) => c2.year === 2019) || {}).endRes || null,
          c19raw0: ((c22) => c22 ? { primary: c22.raw.primary[0], oppr: c22.raw.oppr[0], tpp: c22.raw.tpp[0] } : null)(D.cycles.find((c2) => c2.year === 2019)),
          c22endRes: (D.cycles.find((c2) => c2.year === 2022) || {}).endRes || null,
          c93endRes: (D.cycles.find((c2) => c2.year === 1993) || {}).endRes || null,
          c16endRes: (D.cycles.find((c2) => c2.year === 2016) || {}).endRes || null,
          c98raw0: c98 ? c98.raw.primary[0] : null,
          tpp: card(document.querySelector("#cyc-tpp .rd-cyc-chart"), "tpp"),
          primary: card(chartOf("#cyc-primary", /^Government/), "primary"),
          oppr: card(chartOf("#cyc-primary", /^Opposition/), "oppr"),
          leadersRings: [...document.querySelectorAll("#cyc-leaders .rd-mark")].filter((g) => {
            const c = g.querySelector("circle.rd-ring");
            return c && c.style.stroke !== "var(--ink-2)";
          }).length,
          leadersDotted: [...document.querySelectorAll("#cyc-leaders path.series-line")].filter((p) => p.getAttribute("stroke-dasharray") === "0.5 4").length,
          tppKey: [...document.querySelectorAll("#cyc-tpp .rd-key-item")].map((n2) => n2.textContent.trim()),
          primKey: [...document.querySelectorAll("#cyc-primary .rd-key-item")].map((n2) => n2.textContent.trim()),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      }, drawnYears);

      /* ---- data truth, width-independent ---------------------------------- */
      {
        const base = await live([2025]);
        check(`[${vw}] 1996 closing result carries the canonical primaries`,
          !!base.c96endRes && Math.abs(base.c96endRes.x - 31.047) < 0.01 && base.c96endRes.tpp === 49
            && base.c96endRes.primary === 39.52 && base.c96endRes.oppr === 40.1,
          JSON.stringify(base.c96endRes));
        check(`[${vw}] 1993 closing carries the fixed 1996 figures (38.69 / 47.25)`,
          !!base.c93endRes && base.c93endRes.primary === 38.69 && base.c93endRes.oppr === 47.25,
          JSON.stringify(base.c93endRes));
        check(`[${vw}] 2016 closing carries the 2019 figures (41.44 / 33.34)`,
          !!base.c16endRes && base.c16endRes.primary === 41.44 && base.c16endRes.oppr === 33.34,
          JSON.stringify(base.c16endRes));
        check(`[${vw}] the 1996 term's own anchor reads the fixed 47.25 (raw[0] 47.3)`,
          base.c96raw0.primary === 47.3 && base.c96raw0.oppr === 38.7,
          JSON.stringify(base.c96raw0));
        check(`[${vw}] the 1998 term's anchor reads the fixed 39.52 (raw[0] 39.5)`,
          base.c98raw0 === 39.5, String(base.c98raw0));
      }

      /* ---- default view ---------------------------------------------------- */
      let L = await live([2025]);
      const VOTE = ["tpp", "primary", "oppr"];
      for (const k of VOTE) {
        const cardL = L[k];
        const wantColor = k === "oppr" ? L.curOppColor : L.curColor;
        check(`[${vw}] default ${k}: exactly one ring`, cardL.rings.length === 1, `saw ${cardL.rings.length}`);
        check(`[${vw}] default ${k}: the ring wears the ${L.curYear} line's colour`,
          cardL.rings.length === 1 && cardL.rings[0].stroke === wantColor,
          cardL.rings.length === 1 ? `${cardL.rings[0].stroke} vs ${wantColor}` : "(no ring)");
        check(`[${vw}] default ${k}: ring paint is a party colour, matched by a series line`,
          cardL.rings.length === 1 && cardL.rings[0].stroke !== "" && cardL.lineStrokes.includes(cardL.rings[0].cstroke),
          cardL.rings.length === 1 ? `${cardL.rings[0].cstroke} vs lines ${JSON.stringify(cardL.lineStrokes)}` : "(no ring)");
        check(`[${vw}] default ${k}: the ring opens the term (cx = px(0))`,
          cardL.rings.length === 1 && Math.abs(cardL.rings[0].cx - px(cardL, 0)) <= 2,
          cardL.rings.length === 1 ? `cx ${cardL.rings[0].cx} vs px(0) ${px(cardL, 0).toFixed(2)}` : "(no ring)");
        check(`[${vw}] default ${k}: dashes follow the obs replay`,
          cardL.dotted.length === cardL.expected.dotted && cardL.gaps.length === cardL.expected.gap,
          `dom dotted ${cardL.dotted.length}/gap ${cardL.gaps.length} vs replay ${cardL.expected.dotted}/${cardL.expected.gap}`);
        check(`[${vw}] default ${k}: every lead path is a cycle's first run from px(0)`,
          cardL.leads.every((p) => p.id === "c" + L.curYear && p.d0 != null && Math.abs(p.d0 - px(cardL, 0)) <= 2),
          JSON.stringify(cardL.leads));
        check(`[${vw}] default ${k}: the sitting term draws no tail`,
          cardL.tails.length === 0, JSON.stringify(cardL.tails.map((p) => p.id)));
        check(`[${vw}] default ${k}: the band mean keeps its own dash`,
          cardL.meanDash === "4 3", String(cardL.meanDash));
      }
      check(`[${vw}] leaders charts carry no rings`, L.leadersRings === 0, `saw ${L.leadersRings}`);
      check(`[${vw}] leaders charts never dot a lead-in`, L.leadersDotted === 0, `saw ${L.leadersDotted}`);
      check(`[${vw}] 2PP key names every term's election results`,
        L.tppKey.some((t) => t === "Each term’s election results"), JSON.stringify(L.tppKey));
      check(`[${vw}] primary key names every term's election results`,
        L.primKey.some((t) => t === "Each term’s election results"), JSON.stringify(L.primKey));

      /* The chip is a TOGGLE since 7964e12 (a second click shuts an open
         board), so open it idempotently and reuse the one board across
         lifts */
      const chipClick = () => page.evaluate(() => {
        const chip = [...document.querySelectorAll("button.rd-chip")].find((b) => /Draw a (past )?term/.test(b.textContent));
        chip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      const ensureBoard = async () => {
        if (await page.evaluate(() => !!document.querySelector(".rd-cc-board"))) return;
        await chipClick();
        await page.waitForSelector(".rd-cc-board", { timeout: 10000 });
      };

      /* ---- dotted lead-in: the current term's lead is solid, so lift
         2019's line purely to exercise the interpolated lead run's dots
         (2019 term: month-1 node unobserved on all three vote cards) ---- */
      await ensureBoard();
      await page.evaluate(() => {
        const term = [...document.querySelectorAll(".rd-cc-term")]
          .find((t) => { const b = t.querySelector(".rd-cc-main b"); return b && b.textContent.trim() === "2019"; });
        term.querySelector(".rd-cc-main").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 700));
      L = await live([2025, 2019]);
      for (const k of VOTE) {
        const cardL = L[k];
        check(`[${vw}] lead-in lifted ${k}: dashes follow the obs replay`,
          cardL.dotted.length === cardL.expected.dotted && cardL.gaps.length === cardL.expected.gap,
          `dom dotted ${cardL.dotted.length}/gap ${cardL.gaps.length} vs replay ${cardL.expected.dotted}/${cardL.expected.gap}`);
        check(`[${vw}] lead-in lifted ${k}: 2019's lead run is dotted, from px(0)`,
          cardL.leads.some((p) => p.id === "c2019" && p.d0 != null && Math.abs(p.d0 - px(cardL, 0)) <= 2)
            && cardL.leads.every((p) => p.d0 != null && Math.abs(p.d0 - px(cardL, 0)) <= 2),
          JSON.stringify(cardL.leads));
        check(`[${vw}] lead-in lifted ${k}: 2019's tail runs to the 2022 closing count`,
          cardL.tails.filter((p) => p.id === "c2019-tail").length === (L.c19endRes && L.c19endRes[k] != null ? 1 : 0),
          JSON.stringify(cardL.tails));
      }
      check(`[${vw}] lead-in lifted: leaders charts still dotless`, L.leadersDotted === 0,
        `saw ${L.leadersDotted}`);
      await page.evaluate(() => {
        const pill = [...document.querySelectorAll(".rd-cc-pill")].find((t) => t.textContent.includes("2019"));
        pill.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 500));

      /* ---- draw 1996's own line from the board ----------------------------- */
      await ensureBoard();
      await page.evaluate(() => {
        const term = [...document.querySelectorAll(".rd-cc-term")]
          .find((t) => { const b = t.querySelector(".rd-cc-main b"); return b && b.textContent.trim() === "1996"; });
        term.querySelector(".rd-cc-main").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 700));
      L = await live([2025, 1996]);
      for (const k of VOTE) {
        const cardL = L[k];
        const c96col = k === "oppr" ? L.c96oppColor : L.c96color;
        const curCol = k === "oppr" ? L.curOppColor : L.curColor;
        const c96rings = cardL.rings.filter((r) => r.stroke === c96col);
        const curRings = cardL.rings.filter((r) => r.stroke === curCol);
        check(`[${vw}] lifted ${k}: three rings on the card`, cardL.rings.length === 3, `saw ${cardL.rings.length}`);
        check(`[${vw}] lifted ${k}: two rings wear 1996's colour, one keeps ${L.curYear}'s`,
          c96rings.length === 2 && curRings.length === 1,
          JSON.stringify(cardL.rings.map((r) => r.stroke)));
        const c96base = L.c96endRes ? c96rings.find((r) => Math.abs(r.cx - px(cardL, 0)) <= 2) : null;
        const c96close = L.c96endRes ? c96rings.find((r) => Math.abs(r.cx - px(cardL, L.c96endRes.x)) <= 2) : null;
        const baseY = k === "tpp" ? L.c96raw0.tpp : L.c96raw0[k];
        const closeV = L.c96endRes ? L.c96endRes[k === "tpp" ? "tpp" : k] : null;
        check(`[${vw}] lifted ${k}: 1996's opening ring sits at px(0)`,
          c96rings.length === 2 && !!c96base,
          c96rings.length === 2 ? `cx ${JSON.stringify(c96rings.map((r) => r.cx))} vs ${px(cardL, 0).toFixed(2)}` : "(rings missing)");
        check(`[${vw}] lifted ${k}: 1996's closing ring sits at the 1998 election (px(${L.c96endRes ? L.c96endRes.x : "?"}))`,
          c96rings.length === 2 && !!c96close,
          c96rings.length === 2 && L.c96endRes ? `cx ${JSON.stringify(c96rings.map((r) => r.cx))} vs ${px(cardL, L.c96endRes.x).toFixed(2)}` : "(rings missing)");
        check(`[${vw}] lifted ${k}: 1996's rings land on the card's own values`,
          !!c96base && !!c96close && closeV != null
            && Math.abs(c96base.cy - py(cardL, baseY)) <= 2
            && Math.abs(c96close.cy - py(cardL, closeV)) <= 2,
          c96base && c96close
            ? `base cy ${c96base.cy} vs py(${baseY}) ${py(cardL, baseY).toFixed(2)} · close cy ${c96close.cy} vs py(${closeV}) ${py(cardL, closeV).toFixed(2)}`
            : "(rings missing)");
        check(`[${vw}] lifted ${k}: rings draw at full weight`, cardL.rings.every((r) => r.op === "1"),
          JSON.stringify(cardL.rings.map((r) => r.op)));
        check(`[${vw}] lifted ${k}: dashes follow the obs replay`,
          cardL.dotted.length === cardL.expected.dotted && cardL.gaps.length === cardL.expected.gap,
          `dom dotted ${cardL.dotted.length}/gap ${cardL.gaps.length} vs replay ${cardL.expected.dotted}/${cardL.expected.gap}`);
        check(`[${vw}] lifted ${k}: every lead path is a first run from px(0)`,
          cardL.leads.every((p) => ["c" + L.curYear, "c1996"].includes(p.id) && p.d0 != null && Math.abs(p.d0 - px(cardL, 0)) <= 2),
          JSON.stringify(cardL.leads));
        const tails96 = cardL.tails.filter((p) => p.id === "c1996-tail");
        const want96 = L.c96endRes && L.c96endRes[k === "tpp" ? "tpp" : k] != null ? 1 : 0;
        const tailV = L.c96endRes ? L.c96endRes[k === "tpp" ? "tpp" : k] : null;
        check(`[${vw}] lifted ${k}: 1996's tail is the only tail`,
          tails96.length === want96 && cardL.tails.length === want96,
          JSON.stringify(cardL.tails.map((p) => p.id)));
        check(`[${vw}] lifted ${k}: the tail ends at the closing ring`,
          want96 === 0 || (Math.abs(tails96[0].dEnd - px(cardL, L.c96endRes.x)) <= 2
            && Math.abs(tails96[0].dEndY - py(cardL, tailV)) <= 2),
          tails96.length ? `dEnd ${tails96[0].dEnd} vs px(${L.c96endRes.x}) ${px(cardL, L.c96endRes.x).toFixed(2)} · dEndY ${tails96[0].dEndY} vs py(${tailV}) ${py(cardL, tailV).toFixed(2)}` : "(no tail)");
      }

      /* ---- change mode fades every ring in place; dots stay dots ---------- */
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".rd-cc-tabs .rd-tab")].find((x) => /^Change/.test(x.textContent.trim()));
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 1600));
      L = await live([2025, 1996]);
      for (const k of VOTE) {
        check(`[${vw}] change mode fades all ${k} rings in place`,
          L[k].rings.length === 3 && L[k].rings.every((r) => r.op === "0"),
          `${L[k].rings.length} rings, ops ${JSON.stringify(L[k].rings.map((r) => r.op))}`);
        check(`[${vw}] change mode keeps the ${k} lead-in dotted`,
          L[k].dotted.length === L[k].expected.dotted,
          `dotted ${L[k].dotted.length} vs ${L[k].expected.dotted}`);
        check(`[${vw}] change mode keeps 1996's ${k} tail dotted`,
          L[k].tails.length === (L.c96endRes && L.c96endRes[k === "tpp" ? "tpp" : k] != null ? 1 : 0),
          JSON.stringify(L[k].tails.map((p) => p.id)));
      }

      /* ---- level, then 1996 back into the band ---------------------------- */
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".rd-cc-tabs .rd-tab")].find((x) => x.textContent.trim() === "Level");
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 1600));
      await page.evaluate(() => {
        const pill = [...document.querySelectorAll(".rd-cc-pill")].find((t) => t.textContent.includes("1996"));
        pill.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 700));
      L = await live([2025]);
      check(`[${vw}] unlifting returns one ring per vote card, current-coloured`,
        VOTE.every((k) => L[k].rings.length === 1 && L[k].rings[0].op === "1"
          && L[k].rings[0].stroke === (k === "oppr" ? L.curOppColor : L.curColor)),
        JSON.stringify(VOTE.map((k) => [k, L[k].rings.map((r) => [r.stroke, r.op])])));

      check(`[${vw}] no page-level horizontal overflow`, L.overflow <= 0, `overshoot ${L.overflow}px`);
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
