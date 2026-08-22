/* make-card.js – regenerate assets/auspol-card.png, the og:image share card.

   WHY IT IS NOT PART OF build.mjs
   The card is a raster image and nothing in the toolchain can rasterise one:
   the build is plain node, with no headless browser and no image library. It
   also draws with the site's own typefaces, and canvas text picks those up
   only from a document that has already loaded them - rasterising an SVG
   instead falls back to system fonts, which is what let the previous card
   drift off-brand without anyone noticing.

   So it runs in the page, by hand. build.mjs cannot make the card, but it does
   refuse to let it go stale silently: it compares assets/auspol-card.json
   against the current data date and prints a loud notice when they diverge,
   and it cache-busts the og:image URL with that date so scrapers refetch a new
   card instead of serving a cached old one.

   WHAT IT SHOWS
   The card used to be a title slide - the masthead and a standfirst - which
   told a reader nothing the link text had not already. For most people a link
   preview IS the article, so this one carries the actual reading: the 2PP
   figures, the margin, the interval around it, and the whole term's trend with
   the lead shaded from the leader's line down to the majority line. Every
   value is read from window.AUSPOL, the same object the page renders from, so
   the card cannot contradict the page it previews.

   It states the uncertainty and, when a month-on-month move does not clear its
   own interval, says so - the page refuses to call such a move real, and a
   card that dropped that caveat would be quoting the site against itself.

   TO REGENERATE
     1. node .claude/serve.js
     2. open index.html in a browser
     3. paste this whole file into the console; it downloads auspol-card.png
     4. move it to assets/ and update assets/auspol-card.json to the new
        `updatedISO` (the script prints it)
*/
(async () => {
  await document.fonts.ready;
  const D = window.AUSPOL, L = D.latest;
  const W = 1200, H = 630, S = 2;              // draw at 2x, export at 1x
  const cv = document.createElement("canvas");
  cv.width = W * S; cv.height = H * S;
  const c = cv.getContext("2d"); c.scale(S, S);

  // resolve the page's own oklch tokens rather than hardcoding hex
  const R = (v) => { const p = document.createElement("span"); p.style.color = v;
    document.body.appendChild(p); const x = getComputedStyle(p).color; p.remove(); return x; };
  const T = {
    bg: R("oklch(0.970 0.008 78)"), ink: R("oklch(0.27 0.012 55)"),
    ink2: R("oklch(0.44 0.012 55)"), ink3: R("oklch(0.52 0.010 58)"),
    line: R("oklch(0.895 0.008 75)"), alp: R("oklch(0.55 0.150 27)"),
    lnp: R("oklch(0.50 0.095 250)"), grn: R("oklch(0.60 0.120 150)"),
    onp: R("oklch(0.66 0.130 58)"),
  };
  const lead = L.alp2pp >= L.lnp2pp ? "alp" : "lnp";
  T.fill = R(lead === "alp" ? "oklch(0.55 0.150 27 / 0.13)" : "oklch(0.50 0.095 250 / 0.13)");

  c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
  const PAD = 70;
  c.textBaseline = "alphabetic";
  const caps = (t, x, y, size, ls, col, w) => {
    c.font = `${w || 700} ${size}px "Public Sans", sans-serif`;
    c.fillStyle = col; c.letterSpacing = ls + "px"; c.fillText(t, x, y);
    const m = c.measureText(t).width; c.letterSpacing = "0px"; return m;
  };

  /* ---- masthead --------------------------------------------------------- */
  c.font = '700 30px "Public Sans", sans-serif';
  c.fillStyle = T.ink3; c.fillText("aus", PAD, 92); const wA = c.measureText("aus").width;
  c.fillStyle = T.ink;  c.fillText("pol", PAD + wA, 92); const wP = c.measureText("pol").width;
  caps("TRACKER", PAD + 1, 112, 13, 4.5, T.ink3, 600);

  /* the masthead dial, same geometry and same data as the favicon in build.mjs:
     graduation bars are the latest primary aggregate sorted tallest first, the
     needle is the 2PP margin */
  (function dial(cx, cy, k) {
    const r = 12 * k, rad = (d) => ((d - 90) * Math.PI) / 180;
    const P = (d, rr) => ({ x: cx + Math.sin((d * Math.PI) / 180) * rr,
                            y: cy - Math.cos((d * Math.PI) / 180) * rr });
    const arc = (a, b, col) => { c.beginPath(); c.arc(cx, cy, r, rad(a), rad(b));
      c.strokeStyle = col; c.lineWidth = 3 * k; c.lineCap = "round"; c.stroke(); };
    arc(-90, 0, T.alp); arc(0, 90, T.lnp);
    const lp = D.aggPrimary[D.aggPrimary.length - 1];
    const ps = [["alp", lp.alp], ["lnp", lp.lnp], ["grn", lp.grn], ["onp", lp.onp]]
      .sort((a, b) => b[1] - a[1]);
    const vs = ps.map((p) => p[1]), mn = Math.min(...vs), mx = Math.max(...vs);
    [-54, -18, 18, 54].forEach((a, i) => {
      const h = (mx === mn ? 10.5 : 5 + ((ps[i][1] - mn) / (mx - mn)) * 5.5) * k;
      const q = P(a, r + 2.4 * k), o = P(a, r + 2.4 * k + h);
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(o.x, o.y);
      c.strokeStyle = T[ps[i][0]]; c.lineWidth = 4.2 * k; c.lineCap = "butt"; c.stroke();
    });
    const g2 = D.agg2pp[D.agg2pp.length - 1], m = g2.alp - g2.lnp;
    const tip = P(-Math.max(-1, Math.min(1, m / 12)) * 34, 8.6 * k);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(tip.x, tip.y);
    c.strokeStyle = m >= 0 ? T.alp : T.lnp; c.lineWidth = 2.8 * k;
    c.lineCap = "round"; c.stroke();
    c.beginPath(); c.arc(cx, cy, 2.2 * k, 0, 7); c.fillStyle = T.ink; c.fill();
  })(PAD + wA + wP + 42, 92, 1.25);

  c.textAlign = "right";
  caps("UPDATED " + L.updated.toUpperCase(), W - PAD, 100, 14, 2.2, T.ink3, 700);
  c.textAlign = "left";
  c.strokeStyle = T.line; c.lineWidth = 1;
  c.beginPath(); c.moveTo(PAD, 133.5); c.lineTo(W - PAD, 133.5); c.stroke();

  /* ---- the figures ------------------------------------------------------ */
  caps("TWO-PARTY PREFERRED", PAD, 180, 15, 2.6, T.ink3, 700);
  const FIG_Y = 290, LAB_Y = 324;
  const fig = (x, label, val, col) => {
    c.font = "600 112px Newsreader, Georgia, serif"; c.fillStyle = col;
    c.fillText(val.toFixed(1), x, FIG_Y);
    const w = c.measureText(val.toFixed(1)).width;
    // label BELOW the figure: beside it, the ascenders collided with the caps
    c.beginPath(); c.arc(x + 6, LAB_Y - 6, 6, 0, 7); c.fillStyle = col; c.fill();
    caps(label, x + 21, LAB_Y, 17, 1.6, T.ink2, 700);
    return w;
  };
  const wL = fig(PAD, "LABOR", L.alp2pp, T.alp);
  fig(PAD + wL + 96, "COALITION", L.lnp2pp, T.lnp);

  const marg = L.alp2pp - L.lnp2pp, chg = L.alp2pp - L.alp2ppPrev;
  c.textAlign = "right";
  c.font = "600 33px Newsreader, Georgia, serif"; c.fillStyle = T.ink;
  c.fillText((marg >= 0 ? "Labor" : "Coalition") + " leads by " + Math.abs(marg).toFixed(1), W - PAD, 248);
  c.font = '400 18px "Public Sans", sans-serif'; c.fillStyle = T.ink3;
  c.fillText("95% interval ±" + L.alp2ppCi95.toFixed(1) + " pts · "
             + L.method.nPolls + " polls in " + L.method.windowDays + " days", W - PAD, 282);
  // the page will not call a move real unless it clears its own interval
  c.fillText((chg > 0 ? "+" : "−") + Math.abs(chg).toFixed(1) + " on a month ago"
             + (L.changeSig ? "" : " — within the margin"), W - PAD, 310);
  c.textAlign = "left";

  /* ---- the term's trend -------------------------------------------------- */
  const CX0 = PAD, CX1 = W - PAD, CY0 = 366, CY1 = 540;
  const xs = D.agg2pp.map((d) => d.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = 43, y1 = 57;
  const sx = (x) => CX0 + ((x - x0) / (x1 - x0)) * (CX1 - CX0);
  const sy = (y) => CY1 - ((y - y0) / (y1 - y0)) * (CY1 - CY0);
  const curve = (pts) => { for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
                    p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); } };
  const aPts = D.agg2pp.map((d) => [sx(d.x), sy(d.alp)]);
  const lPts = D.agg2pp.map((d) => [sx(d.x), sy(d.lnp)]);

  /* Shade the LEAD - the leader's line down to 50% - not the gap between the
     two lines. The lines are exact complements, so the gap is twice the margin
     and reads as a heavier claim than the data makes; the lead is the margin
     itself, and watching it thin out from the election to now is the story. */
  const ldPts = lead === "alp" ? aPts : lPts;
  c.beginPath(); c.moveTo(ldPts[0][0], ldPts[0][1]); curve(ldPts);
  c.lineTo(CX1, sy(50)); c.lineTo(CX0, sy(50)); c.closePath();
  c.fillStyle = T.fill; c.fill();

  c.setLineDash([3, 6]); c.strokeStyle = T.ink3; c.lineWidth = 1.4; c.globalAlpha = 0.7;
  c.beginPath(); c.moveTo(CX0, sy(50)); c.lineTo(CX1, sy(50)); c.stroke();
  c.setLineDash([]); c.globalAlpha = 1;
  caps("50% — MAJORITY", CX0, sy(50) + 21, 12, 1.3, T.ink3, 700);

  [[lPts, T.lnp], [aPts, T.alp]].forEach(([pts, col]) => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); curve(pts);
    c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
    const e = pts[pts.length - 1];
    c.beginPath(); c.arc(e[0], e[1], 8, 0, 7); c.fillStyle = T.bg; c.fill();
    c.beginPath(); c.arc(e[0], e[1], 5, 0, 7); c.fillStyle = col; c.fill();
  });
  // the term's two ends, so the trend is anchored rather than floating
  caps("2025 ELECTION · LABOR " + D.agg2pp[0].alp.toFixed(1), CX0, CY1 + 32, 13, 1.4, T.ink3, 700);
  c.textAlign = "right"; caps("AUG 2026", CX1, CY1 + 32, 13, 1.4, T.ink3, 700); c.textAlign = "left";

  /* ---- footer ------------------------------------------------------------ */
  c.strokeStyle = T.line; c.beginPath(); c.moveTo(PAD, 592.5); c.lineTo(W - PAD, 592.5); c.stroke();
  c.font = '400 17px "Public Sans", sans-serif'; c.fillStyle = T.ink3;
  c.fillText(L.pollsTracked + " polls · " + L.housesTracked
             + " pollsters · house-effect-adjusted aggregate", PAD, 617);
  c.textAlign = "right"; c.font = '600 17px "Public Sans", sans-serif'; c.fillStyle = T.ink2;
  c.fillText("joshborgnolo.github.io/auspol-tracker", W - PAD, 617); c.textAlign = "left";

  /* ---- export at exactly 1200x630, supersampled from the 2x draw --------- */
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const oc = out.getContext("2d");
  oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
  oc.drawImage(cv, 0, 0, W, H);
  const png = out.toDataURL("image/png");
  window.__auspolCard = { png, updatedISO: L.updatedISO };
  console.log("card drawn for data dated " + L.updatedISO
              + " – put this in assets/auspol-card.json");
  const a = document.createElement("a");
  a.download = "auspol-card.png"; a.href = png; a.click();
})();
