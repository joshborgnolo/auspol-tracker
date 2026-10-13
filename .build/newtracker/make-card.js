/* make-card.js – build assets/auspol-card.png, the og:image share card.

   WHY IT IS NOT PART OF build.mjs
   The card is a raster image and nothing in the toolchain can rasterise one:
   the build is plain node, with no headless browser and no image library. So
   the card is built inside the page instead, from window.AUSPOL - the same
   object the page renders from, which is what keeps the card from
   contradicting the page it previews - and render-card.mjs photographs it
   there in headless Chrome.

   build.mjs cannot make the card, but it does refuse to let it go stale
   silently: it compares assets/auspol-card.json against what the card would
   show now and prints a loud notice when they diverge, and it cache-busts the
   og:image URL with that stamp so scrapers refetch a new card instead of
   serving a cached old one.

   WHAT IT SHOWS
   A stadium scoreboard, picked from the October 2026 mockups. For most people
   a link preview IS the article, so the card carries the reading itself:
   - the two-party score, Labor against the rival the site leads with;
   - the verdict on the lead, judged against its own margin the way the hero
     judges it, so a lead inside the margin reads TOO CLOSE TO CALL;
   - the move on a month ago, called significant only when it clears its own
     margin, as the hero calls it;
   - the first-preference ladder. A party shares the place above it when the
     gap is inside the two figures' margins combined: the primary-vote
     panel's level test, run from the top of each group down. The arrows
     count places gained or lost since the election result;
   - MONTH n/N: n months since the election, of the N the term can run to
     (the election to the latest date the next one can be held).
   Every value is read from window.AUSPOL.

   HOW IT IS DRAWN
   HTML and CSS in a shadow root pinned over the page's top-left corner at
   1200x630, so none of the page's styles can reach it. Every glyph is Doto, a
   dot-matrix face (SIL Open Font License), loaded here from
   .build/newtracker/fonts/doto-card.woff2: a static ROND 100 / wght 900
   instance cut down to the characters the card prints. The page never loads
   it. Doto has no ± and no arrows, and it draws "." as a five-dot cross. So
   those glyphs are SVG dots on Doto's own grid (100-unit pitch, 90-unit dots,
   5 columns by 7 rows). A fallback font would put a system glyph in the
   middle of an LED line, or a missing-glyph box on a CI runner with few
   fonts.

   The glow is rationed. Every blurred halo is a gradient the PNG encoder
   cannot squeeze, and a halo on every line made a 399 KB card, past the
   ~300 KB some chat apps take for a link preview. So the two scores keep the
   wide halo, the names and the verdict a tight one, and the small type none:
   about 230 KB, and no different at feed size.

   TO REGENERATE
     node .build/newtracker/render-card.mjs

   That runs this file in real headless Chrome, photographs the card and
   writes both the png and its stamp in assets/auspol-card.json; rebuild
   afterwards so og:image is stamped with it. Everything about the card lives
   here - render-card.mjs only drives it.

   By hand, if that machine has no Chrome or no puppeteer-core: node
   .claude/serve.js, open index.html, paste this whole file into the console,
   then in Elements right-click <div id="auspol-card"> (the last child of
   <html>) and choose Capture node screenshot. Move the download to
   assets/auspol-card.png and put the stamp the console prints into
   assets/auspol-card.json.
*/
(async () => {
  try {
  await document.fonts.ready;
  const D = window.AUSPOL;
  /* Default basis is IMPLIED preference flows (the site's own default): each
     poll's primaries re-allocated at the fixed 2025 flow table, aggregated.
     That is the figure the hero leads with and the one the share card quotes,
     so the card never contradicts the page it previews. Falls back to the
     published respondent-allocated aggregate when synthLatest is absent. */
  const IS_IMP = !!(D.synthLatest && D.synthLatest.alp != null);
  /* synthLatest carries alp/lnp/ci95/n, not the latest payload's
     alp2pp/alp2ppCi95/method – merge like build.mjs's headlineView so the
     rest of the card reads one shape, whichever basis is drawn. The dates,
     windowDays and the primary panel are not basis-dependent. */
  const L = IS_IMP
    ? { ...D.latest,
        alp2pp: D.synthLatest.alp, lnp2pp: D.synthLatest.lnp,
        alp2ppCi95: D.synthLatest.ci95,
        alp2ppPrev: D.synthLatest.prev != null ? D.synthLatest.prev : D.latest.alp2ppPrev,
        changeSig: D.synthLatest.changeSig,
        method: { ...D.latest.method, nPolls: D.synthLatest.n } }
    : D.latest;
  /* WHICH CONTEST THE CARD QUOTES
     Labor against the rival the site leads with - gen-data's rivalLead, the
     margin-gated ruling over the implied series that the hero, the favicon and
     the masthead all defer to. When the ON pairing is quoted its figures come
     from latest.onImp - the pairing's only quoted level, the primaries read
     through one first-principles flow set - with the pollsters' published
     head-to-heads (altLatest.alp_on) the only fallback. The implied pairing's
     ± is its margin: the polls' sampling interval and the flow table's own
     range in quadrature, the hero's "margin" too.
     Mirror: build.mjs's cardContest builds this same view. */
  const onImp = D.latest.onImp && D.latest.onImp.a != null ? D.latest.onImp : null;
  const onPub = D.altLatest && D.altLatest.alp_on && D.altLatest.alp_on.a != null
    ? D.altLatest.alp_on : null;
  const VS_ON = D.latest.rivalLead === "alp_on" && !!(onImp || onPub);
  /* One normalised view of the quoted contest, so nothing below branches on
     the matchup again. */
  const Q = VS_ON ? {
    opp: "onp", oppLab: "One Nation",
    a: onImp ? onImp.a : onPub.a, b: onImp ? onImp.b : onPub.b,
    ci: onImp ? (onImp.ci95 != null ? onImp.ci95 : onImp.band) : onPub.ci95,
    prev: onImp ? onImp.aPrev : onPub.aPrev,
    sig: !!(onImp ? onImp.changeSig : onPub.changeSig),
    n: onImp ? onImp.n : onPub.n, imp: !!onImp,
  } : {
    opp: "lnp", oppLab: "Coalition",
    a: L.alp2pp, b: L.lnp2pp,
    ci: L.alp2ppCi95,
    prev: L.alp2ppPrev, sig: !!L.changeSig,
    n: L.method.nPolls, imp: IS_IMP,
  };

  /* ---- what the scoreboard says ----------------------------------------- */
  const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const RIVAL = Q.oppLab.toUpperCase();
  /* The verdict, on the hero's own terms (rd-hero.jsx): the lead and its
     margin at one decimal, and a lead no bigger than its margin is too close
     to call. Phrased for a ticker; the hero says the same in sentences. */
  const lead = +(Q.a - Q.b).toFixed(1), margin = +(2 * Q.ci).toFixed(1);
  const tooClose = Math.abs(lead) <= margin;
  const leader = lead > 0 ? "LABOR" : lead < 0 ? RIVAL : null;
  const verdict = !tooClose ? "▶ " + leader + " UP BY " + r1(Math.abs(lead)) + ", OUTSIDE ± " + r1(margin)
    : leader ? "▶ TOO CLOSE TO CALL: " + leader + " UP BY " + r1(Math.abs(lead)) + ", INSIDE ± " + r1(margin)
    : "▶ DEAD LEVEL, INSIDE ± " + r1(margin);
  /* The month's move, called as the hero calls it: "within the margin" unless
     the move clears its own interval. With no month-ago figure the line says
     what the reading rests on instead. */
  const mom = Q.prev != null ? +(Q.a - Q.prev).toFixed(1) : null;
  const moveLine = mom == null ? Q.n + " POLLS IN " + L.method.windowDays + " DAYS"
    : Math.abs(mom) < 0.05 ? "LABOR UNCHANGED ON A MONTH AGO"
    : "LABOR " + (mom > 0 ? "▲" : "▼") + r1(Math.abs(mom)) + " ON A MONTH AGO, "
      + (Q.sig ? "A SIGNIFICANT " + (mom > 0 ? "RISE" : "FALL") : "WITHIN THE MARGIN");
  /* The date the page's own stamp shows: the newest poll's fieldwork end,
     the hero's "updated", not the day it was published. */
  const [uy, um, ud] = L.updatedISO.split("-").map(Number);
  const dateLab = ud + " " + MON[um - 1] + " " + uy;

  /* The ladder: the headline primaries (latest.primary, the figures the
     primary-vote hero quotes), each with the latest month's 95% margin.
     Mirror: build.mjs's cardLadder. */
  const IDS = ["alp", "lnp", "grn", "onp", "oth"];
  const ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ONP", oth: "OTH" };
  const P = D.latest.primary;
  const lastCi = (D.aggPrimary[D.aggPrimary.length - 1] || {}).ci || {};
  const elect = D.aggPrimary.find((d) => d.election) || D.aggPrimary[0];
  const rows = IDS.filter((id) => P[id] != null)
    .map((id) => ({ id, v: P[id], ci: lastCi[id] || 0 }))
    .sort((a, b) => b.v - a.v);
  let anchor = null;
  rows.forEach((p, i) => {
    if (anchor && anchor.v - p.v < Math.hypot(anchor.ci, p.ci)) p.place = anchor.place;
    else { p.place = i + 1; anchor = p; }
  });
  const wasOrder = IDS.filter((id) => elect[id] != null).sort((a, b) => elect[b] - elect[a]);
  rows.forEach((p) => {
    p.tied = rows.filter((q) => q.place === p.place).length > 1;
    const was = wasOrder.indexOf(p.id) + 1;
    p.moved = was ? was - p.place : 0;
  });
  const elecYear = elect.ym.slice(0, 4);
  /* MONTH n/N: whole months from the election to the reading, out of the
     whole months from the election to the latest date the next one can be
     held - read off nextElectionDue ("By 20 May 2028") with the masthead's
     own pattern. With no date to read, the month stands alone. */
  const ey = Number(elect.ym.slice(0, 4)), em = Number(elect.ym.slice(5, 7));
  const round = (uy - ey) * 12 + um - em;
  const due = /(\d{1,2}) (\w+) (\d{4})/.exec(L.nextElectionDue || "");
  const dueMon = due ? MON.indexOf(due[2].slice(0, 3).toUpperCase()) + 1 : 0;
  const termMonths = dueMon ? (Number(due[3]) - ey) * 12 + dueMon - em : null;
  const monthLab = "MONTH " + round + (termMonths > round ? "/" + termMonths : "");

  /* ---- drawing ---------------------------------------------------------- */
  const FONT_URL = ".build/newtracker/fonts/doto-card.woff2";
  const face = new FontFace("Doto", "url(" + FONT_URL + ")", { weight: "900" });
  await face.load();
  document.fonts.add(face);
  if (!document.fonts.check('900 60px "Doto"')) throw new Error("Doto did not load from " + FONT_URL);

  /* Doto's grid, in its own units: a 600 advance, 700 to the cap line, dots
     of 90 at a pitch of 100, centred 50 in from the left edge and 50 up from
     the baseline. Rows below run top to bottom, so the last sits at 650. The
     arrows run a column or two wider than a letter so they read at the
     ladder's size; a glyph's advance is its ink plus the 105 Doto leaves. */
  const GLYPH = {
    "▲": [".......", ".......", "...#...", "..###..", ".#####.", "#######", "......."],
    "▼": [".......", ".......", "#######", ".#####.", "..###..", "...#...", "......."],
    "▶": ["#...", "##..", "###.", "####", "###.", "##..", "#..."],
    "±": [".....", "..#..", "#####", "..#..", ".....", "#####", "....."],
  };
  const svgDots = (dots, w) => '<svg class="g" viewBox="0 0 ' + w + ' 700" style="width:' + (w / 1000)
    + 'em" aria-hidden="true">' + dots.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="45"/>').join("") + "</svg>";
  const glyph = (ch) => {
    const dots = [], rows = GLYPH[ch];
    rows.forEach((row, r) => [...row].forEach((c, k) => { if (c === "#") dots.push([50 + 100 * k, 50 + 100 * r]); }));
    return svgDots(dots, Math.max(600, rows[0].length * 100 + 105));
  };
  /* A full stop is one dot on the baseline row in a 200-unit cell, placed so
     the gaps to the glyphs either side match: Doto leaves 105 units after a
     glyph's ink and 5 before the next one's. */
  const point = () => svgDots([[50, 650]], 200);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const led = (s) => [...s].map((ch) => ch === "." ? point() : GLYPH[ch] ? glyph(ch) : esc(ch)).join("");

  const LED = {
    alp: ["#FF5A4A", "255, 90, 74"], onp: ["#FFA53D", "255, 165, 61"], lnp: ["#5EB0FF", "94, 176, 255"],
    grn: ["#5BE38A", "91, 227, 138"], oth: ["#D9D3C4", "217, 211, 196"],
    white: ["#F4F1E8", "244, 241, 232"], amber: ["#FFC94D", "255, 201, 77"],
    up: ["#5BE38A", "91, 227, 138"], down: ["#FF5A4A", "255, 90, 74"], flat: ["#B9B3A6", "0, 0, 0"],
  };
  const lit = (k) => "--c:" + LED[k][0] + ";--g:" + LED[k][1];

  const team = (name, v, k, top, size) =>
    '<div class="team" style="top:' + top + "px;" + lit(k) + '"><span class="name" style="font-size:' + size + 'px">'
    + led(name) + '</span><span class="score">' + led(r1(v)) + "</span></div>";
  const ladderRows = rows.map((p) => {
    const mv = p.moved > 0 ? ["up", "▲" + p.moved] : p.moved < 0 ? ["down", "▼" + (-p.moved)] : ["flat", "="];
    return '<div class="lrow"><span class="rank" style="' + lit("white") + '">' + (p.tied ? "=" : "") + p.place + "</span>"
      + '<span class="abbr" style="' + lit(p.id) + '">' + led(ABBR[p.id]) + "</span>"
      + '<span class="val" style="' + lit(p.id) + '">' + led(r1(p.v)) + "</span>"
      + '<span class="mv" style="' + lit(mv[0]) + '">' + led(mv[1]) + "</span></div>";
  }).join("");

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .card { position: relative; width: 1200px; height: 630px; padding: 16px; overflow: hidden;
      background: #23272A; font: 900 30px/1 "Doto", monospace; letter-spacing: 0.04em; color: var(--c);
      -webkit-font-smoothing: antialiased; }
    .rivets { position: absolute; left: 0; right: 0; height: 16px;
      background: radial-gradient(#3A4044 2px, transparent 2.6px) 12px 0 / 40px 16px; }
    .panel { position: relative; width: 1168px; height: 598px; overflow: hidden; border-radius: 4px;
      background: #060707 radial-gradient(#141817 1.5px, transparent 1.9px) 0 0 / 7px 7px;
      box-shadow: inset 0 0 0 2px #000, inset 0 0 60px rgba(0, 0, 0, 0.9); }
    [style*="--c"] { color: var(--c); }
    .g { height: 0.7em; vertical-align: baseline; fill: currentColor; overflow: visible; }
    .hdr { position: absolute; left: 30px; right: 30px; top: 22px; display: flex; justify-content: space-between; white-space: nowrap; }
    .rule-h { position: absolute; left: 30px; right: 30px; height: 4px;
      background: radial-gradient(#5D5A52 1.6px, transparent 2px) 0 0 / 7px 4px; }
    .rule-v { position: absolute; left: 780px; top: 92px; width: 4px; height: 358px;
      background: radial-gradient(#5D5A52 1.6px, transparent 2px) 0 0 / 4px 7px; }
    .head { position: absolute; top: 94px; display: flex; align-items: baseline; justify-content: space-between;
      font-size: 26px; white-space: nowrap; }
    .head .sub { font-size: 18px; color: #B9B3A6; text-shadow: none; }
    .team { position: absolute; left: 30px; width: 726px; height: 150px; display: flex; align-items: center;
      justify-content: space-between; white-space: nowrap; }
    .name { font-size: 72px; text-shadow: 0 0 7px rgba(var(--g), 0.85); }
    .score { font-size: 150px; letter-spacing: 0.02em; text-shadow: 0 0 10px rgba(var(--g), 0.85), 0 0 34px rgba(var(--g), 0.4); }
    .score .g { filter: drop-shadow(0 0 8px rgba(var(--g), 0.85)); }
    .tick .g { filter: drop-shadow(0 0 4px rgba(var(--g), 0.85)); }
    .ladder { position: absolute; left: 812px; top: 136px; width: 330px; }
    .lrow { display: grid; grid-template-columns: 58px 112px 104px 56px; align-items: baseline; height: 50px;
      font-size: 38px; white-space: nowrap; }
    .rank { text-align: right; padding-right: 12px; }
    .val, .mv { text-align: right; }
    .mv { font-size: 26px; }
    .key { position: absolute; left: 812px; width: 330px; font-size: 16px; line-height: 22px; color: #B9B3A6; white-space: nowrap; }
    .tick { position: absolute; left: 30px; right: 30px; top: 492px; font-size: 40px; white-space: nowrap;
      text-shadow: 0 0 7px rgba(var(--g), 0.85); }
    .foot { position: absolute; left: 30px; right: 30px; top: 548px; display: flex; justify-content: space-between;
      gap: 24px; font-size: 24px; white-space: nowrap; }
  `;
  const HTML = '<div class="card">'
    + '<div class="rivets" style="top:0"></div><div class="rivets" style="bottom:0"></div>'
    + '<div class="panel">'
    + '<div class="hdr" style="' + lit("white") + '"><span>' + led("AUSPOL TRACKER") + '</span><span style="'
      + lit("amber") + '">' + led(dateLab.toUpperCase()) + "</span><span>" + led(monthLab) + "</span></div>"
    + '<div class="rule-h" style="top:70px"></div>'
    + '<div class="head" style="left:30px;width:726px;' + lit("white") + '"><span>' + led("TWO-PARTY PREFERRED")
      + '</span><span class="sub">' + led(Q.imp ? "IMPLIED FLOWS" : "AS PUBLISHED") + "</span></div>"
    + team("LABOR", Q.a, "alp", 128, 72)
    + team(RIVAL, Q.b, Q.opp, 288, VS_ON ? 56 : 60)
    + '<div class="rule-v"></div>'
    + '<div class="head" style="left:812px;width:330px;' + lit("white") + '"><span>' + led("THE LADDER")
      + '</span><span class="sub">' + led("1ST PREFS") + "</span></div>"
    + '<div class="ladder">' + ladderRows + "</div>"
    + '<div class="key" style="top:' + (136 + rows.length * 50 + 10) + 'px">'
      + led("= LEVEL, INSIDE THE MARGIN") + "<br>" + led("▲▼ PLACES SINCE " + elecYear) + "</div>"
    + '<div class="rule-h" style="top:470px"></div>'
    + '<div class="tick" style="' + lit("amber") + '">' + led(verdict) + "</div>"
    + '<div class="foot" style="' + lit("white") + '"><span>' + led(moveLine) + "</span><span>"
      + led("AUSPOLTRACKER.COM") + "</span></div>"
    + "</div></div>";

  /* Pinned over the page's top-left corner, on <html> rather than <body> so
     the boot-time body{visibility:hidden} and any body transform can't touch
     it. A second run replaces the first. */
  const old = document.getElementById("auspol-card");
  if (old) old.remove();
  const host = document.createElement("div");
  host.id = "auspol-card";
  host.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:630px;z-index:2147483647;visibility:visible;margin:0;padding:0";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = "<style>" + CSS + "</style>" + HTML;
  document.documentElement.appendChild(host);
  await document.fonts.ready;
  /* Lines whose length the data sets shrink a pixel at a time until their
     box holds them: the longest ticker ("TOO CLOSE TO CALL: ONE NATION BY
     ...") runs past 1100px at the 40px it is set in. */
  const shrink = (box, target) => {
    for (let guard = 40; box.scrollWidth > box.clientWidth + 0.5 && guard > 0; guard--)
      target.style.fontSize = parseFloat(getComputedStyle(target).fontSize) - 1 + "px";
  };
  root.querySelectorAll(".team").forEach((t) => shrink(t, t.querySelector(".name")));
  shrink(root.querySelector(".tick"), root.querySelector(".tick"));
  shrink(root.querySelector(".foot"), root.querySelector(".foot > span"));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  /* Stamped on the date of the newest poll's publication, with the fig
     block beside it: render-card's staleness gate compares both against
     build.mjs's assets/auspol-latest.json, so a moved figure, a moved
     ladder or a new fieldwork date all redraw the card without launching
     Chrome when none has. Same shape as build.mjs's cardFigs – mirror any
     change in both files. render-card.mjs appends the design hash. */
  const fig = {
    vs: VS_ON ? "onp" : "lnp",
    alp: Q.a.toFixed(1), lnp: Q.b.toFixed(1), ci: Q.ci.toFixed(1),
    mom: (Q.a - (Q.prev != null ? Q.prev : Q.a)).toFixed(1), sig: Q.sig,
    basis: Q.imp ? "imp" : "pub",
    date: L.updatedISO,
    prim: IDS.map((id) => (P[id] != null ? P[id].toFixed(1) : "-")).join("/"),
    pci: IDS.map((id) => (lastCi[id] != null ? (+lastCi[id]).toFixed(1) : "-")).join("/"),
    due: L.nextElectionDue || "",
  };
  window.__auspolCard = { selector: "#auspol-card", publishedISO: L.publishedISO, fig };
  console.log("card built for data published " + L.publishedISO + " – stamp for assets/auspol-card.json:\n"
    + JSON.stringify({ publishedISO: L.publishedISO, fig }));
  } catch (e) {
    window.__auspolCard = { error: String((e && e.message) || e) };
    console.error("make-card:", e);
  }
})();
