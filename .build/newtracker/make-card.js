/* make-card.js – regenerate assets/auspol-card.png (the og:image share card).

   NOT part of `node build.mjs`. The card carries no live figures, so it only
   needs regenerating when the BRANDING changes, not when the data does. That
   is deliberate: a card with numbers on it would be stale the moment a new
   poll landed, and every scraper caches it anyway.

   It runs in the page rather than in node because it draws with the site's own
   typefaces — Newsreader and Public Sans are loaded by index.html, and canvas
   text picks them up from the document. Rasterising an SVG instead would fall
   back to system fonts, which is what made the previous card drift off-brand.

   To regenerate:
     1. serve the repo   (node .claude/serve.js)
     2. open index.html in a browser, then paste this file into the console
     3. it downloads auspol-card.png – move it to assets/

   The dial is the masthead glyph on the same geometry as the favicon in
   build.mjs: graduation bars are the latest primary aggregate sorted tallest
   first, the needle is the 2PP margin. It reads them from window.AUSPOL, so
   the mark on the card matches the mark on the page. */
(async () => {
  await document.fonts.ready;
  const D = window.AUSPOL;
  const lp = D.aggPrimary[D.aggPrimary.length - 1];
  const g2 = D.agg2pp[D.agg2pp.length - 1];
  const W = 1200, H = 630, S = 2;                  // draw at 2x, export at 1x
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

  c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = T.line; c.lineWidth = 1; c.strokeRect(48.5, 48.5, W - 97, H - 97);

  const M = 88;
  c.textBaseline = "alphabetic";
  c.font = '700 46px "Public Sans", sans-serif';
  c.fillStyle = T.ink3; c.fillText("aus", M, 152);
  const wA = c.measureText("aus").width;
  c.fillStyle = T.ink; c.fillText("pol", M + wA, 152);
  const wP = c.measureText("pol").width;
  c.font = '600 19px "Public Sans", sans-serif'; c.fillStyle = T.ink3;
  c.letterSpacing = "6px"; c.fillText("TRACKER", M + 2, 184); c.letterSpacing = "0px";

  (function dial(cx, cy, k) {
    const r = 12 * k;
    const rad = (d) => ((d - 90) * Math.PI) / 180;
    const P = (d, rr) => ({ x: cx + Math.sin((d * Math.PI) / 180) * rr,
                            y: cy - Math.cos((d * Math.PI) / 180) * rr });
    const arc = (d1, d2, col) => { c.beginPath(); c.arc(cx, cy, r, rad(d1), rad(d2));
      c.strokeStyle = col; c.lineWidth = 3.0 * k; c.lineCap = "round"; c.stroke(); };
    arc(-90, 0, T.alp); arc(0, 90, T.lnp);
    const parties = [["alp", lp.alp], ["lnp", lp.lnp], ["grn", lp.grn], ["onp", lp.onp]]
      .sort((a, b) => b[1] - a[1]);
    const vs = parties.map((p) => p[1]), mn = Math.min(...vs), mx = Math.max(...vs);
    const ang = [-54, -18, 18, 54];
    parties.forEach((p, i) => {
      const h = (mx === mn ? 10.5 : 5 + ((p[1] - mn) / (mx - mn)) * 5.5) * k;
      const inn = P(ang[i], r + 2.4 * k), out = P(ang[i], r + 2.4 * k + h);
      c.beginPath(); c.moveTo(inn.x, inn.y); c.lineTo(out.x, out.y);
      c.strokeStyle = T[p[0]]; c.lineWidth = 4.2 * k; c.lineCap = "butt"; c.stroke();
    });
    const margin = g2.alp - g2.lnp;
    const deg = -Math.max(-1, Math.min(1, margin / 12)) * 34;
    const tip = P(deg, 8.6 * k);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(tip.x, tip.y);
    c.strokeStyle = margin >= 0 ? T.alp : T.lnp; c.lineWidth = 2.8 * k;
    c.lineCap = "round"; c.stroke();
    c.beginPath(); c.arc(cx, cy, 2.4 * k, 0, 7); c.fillStyle = T.ink; c.fill();
  })(M + wA + wP + 72, 128, 1.9);

  c.fillStyle = T.ink; c.font = "600 82px Newsreader, Georgia, serif";
  c.fillText("Australian federal polling,", M, 342);
  c.fillText("aggregated", M, 434);
  c.strokeStyle = T.line; c.beginPath(); c.moveTo(M, 478); c.lineTo(W - M, 478); c.stroke();
  c.fillStyle = T.ink2; c.font = '400 27px "Public Sans", sans-serif';
  c.fillText("Two-party preferred · Primary vote · Leadership", M, 520);
  c.fillStyle = T.ink3; c.font = "italic 400 24px Newsreader, Georgia, serif";
  c.fillText("Pooled across every published national poll.", M, 558);

  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const oc = out.getContext("2d");
  oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
  oc.drawImage(cv, 0, 0, W, H);
  const a = document.createElement("a");
  a.download = "auspol-card.png"; a.href = out.toDataURL("image/png"); a.click();
})();
