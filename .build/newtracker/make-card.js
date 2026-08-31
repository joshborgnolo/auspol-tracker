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
   the lead shaded from the leader's line down to the tie line. Every
   value is read from window.AUSPOL, the same object the page renders from, so
   the card cannot contradict the page it previews.

   It states the uncertainty and, when a month-on-month move does not clear its
   own interval, says so - the page refuses to call such a move real, and a
   card that dropped that caveat would be quoting the site against itself.

   TO REGENERATE
     node .build/newtracker/render-card.mjs

   That runs this file in real headless Chrome and writes both the png and the
   date in assets/auspol-card.json; rebuild afterwards so og:image is stamped
   with it. Everything about the drawing still lives here - render-card.mjs
   only drives it.

   By hand, if that machine has no Chrome or no puppeteer-core: node
   .claude/serve.js, open index.html, paste this whole file into the console,
   move the download into assets/, and put the printed `updatedISO` into
   assets/auspol-card.json.
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
    bg: R("oklch(0.985 0.004 91.4)"), ink: R("oklch(0.27 0.012 55)"),
    ink2: R("oklch(0.44 0.012 55)"), ink3: R("oklch(0.52 0.010 58)"),
    line: R("oklch(0.895 0.008 75)"), alp: R("oklch(0.55 0.150 27)"),
    lnp: R("oklch(0.50 0.095 250)"), grn: R("oklch(0.60 0.120 150)"),
    onp: R("oklch(0.66 0.130 58)"),
  };
  T.panel = R("oklch(0.988 0.005 80)");
  T.alpFill = R("oklch(0.55 0.150 27 / 0.13)");
  T.lnpFill = R("oklch(0.50 0.095 250 / 0.13)");

  c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
  const PAD = 70;
  c.textBaseline = "alphabetic";
  const caps = (t, x, y, size, ls, col, w) => {
    c.font = `${w || 700} ${size}px "Source Sans 3", sans-serif`;
    c.fillStyle = col; c.letterSpacing = ls + "px"; c.fillText(t, x, y);
    const m = c.measureText(t).width; c.letterSpacing = "0px"; return m;
  };

  /* ---- masthead --------------------------------------------------------- */
  /* One lockup, drawn from the site's spec - see .wm-name / .wm-track in
     template.html: both words at 30px, told apart by weight alone. The card
     used to set its own, 700 weight over 13px tracked caps, which made it a
     third version of a wordmark that only has one. The offsets are the
     header's own, read off the rendered lockup: the second baseline sits
     29.5px under the first, and the dial's arc centre 43.8px right of the text
     block and 20.33px under it - which is where the pivot has to sit for the
     dial's painted extent to centre on the wordmark's, since the pivot is 11
     units below the middle of what gets drawn. */
  const BL1 = 92, BL2 = BL1 + 29.5;
  /* The two words are set at different weights, so at their own tracking they
     end at different places and the l of auspol and the r of tracker do not
     line up. The header solves this by measuring the shortfall and closing it
     over the narrower word's gaps rather than by hand-tuning a number; the
     card drew its own fixed pair instead and stayed misaligned. Same algorithm
     here, so the next change of face carries itself in both places.

     Letter-spacing lands after the LAST letter too, widening the box by one
     more unit than it widens the ink. What has to line up is the ink, so the
     trailing unit comes off both measurements before they are compared - the
     header's note on the same subtraction. */
  const ink = (text, weight, ls) => {
    c.font = `${weight} 30px "Source Sans 3", sans-serif`;
    c.letterSpacing = ls + "px";
    const w = c.measureText(text).width;
    c.letterSpacing = "0px";
    return w - ls;
  };
  let lsName = -0.75, lsTrack = -0.9;
  const inkName = ink("auspol", 800, lsName), inkTrack = ink("tracker", 400, lsTrack);
  if (inkName >= inkTrack) lsTrack += (inkName - inkTrack) / ("tracker".length - 1);
  else                     lsName += (inkTrack - inkName) / ("auspol".length - 1);
  const wMark = Math.max(inkName, inkTrack);
  c.font = '800 30px "Source Sans 3", sans-serif'; c.letterSpacing = lsName + "px";
  c.fillStyle = T.ink; c.fillText("auspol", PAD, BL1);
  c.font = '400 30px "Source Sans 3", sans-serif'; c.letterSpacing = lsTrack + "px";
  c.fillStyle = T.ink3; c.fillText("tracker", PAD, BL2);
  c.letterSpacing = "0px";

  /* Placement derived from the scale instead of baked for one of them. The
     two numbers this replaces - 43.8 across and 20.33 down - were measured off
     the lockup at k=1.485 and silently encoded it: at 1.5x they would have put
     the dial's left edge 4px INSIDE the l of auspol and its top 12px above the
     card's margin. Both are now what they always meant.

     DIAL_LEFT and DIAL_DROP come off the header's own viewBox (0.58 0.07 38.39
     26.73, pivot at 22 24.5): the drawing reaches 21.42 units left of the pivot
     and the pivot sits 11.065 units below the middle of it. So the left edge
     lands a fixed ink gap past the wordmark whatever the size, and the drawing
     centres on the lockup rather than the pivot doing so - which is the whole
     point of the second number, since the dial is far from symmetric about its
     own pivot. */
  const DIAL_K = 2.2275;            // 1.5x the 1.485 this was drawn at
  const DIAL_GAP = 12;              // wordmark's right ink edge to the dial's left
  const DIAL_LEFT = 21.42, DIAL_DROP = 11.065;
  const WM_MID = 95.9;              // the lockup's optical centre, cap of auspol to baseline of tracker

  /* The masthead dial. This is a hand-copy of the header's glyph, and it had
     drifted: it drew the right half of the arc in Coalition blue and swung the
     needle on ALP v L/NP no matter what, where the header and the favicon both
     pick Labor's STRONGEST challenger - whichever opponent polls the highest
     2PP against them. One Nation has been taking that place in some months, so
     the card could state a contest the site was not showing. Its strokes had
     drifted too: an opaque arc a third heavier than the header's half-opacity
     hairline, bars seated further out, a needle with no tip, a pivot in the
     wrong ink. All of it is the header's now, times k - which is what the
     header itself does when it renders a 12-unit dial at 57px.

     The favicon in build.mjs stays heavier on purpose: it is read at 16px,
     where a 1.4-unit hairline disappears. Same data, same geometry, thicker
     pen. This one is drawn near the header's own size, so it takes the
     header's weights. */
  (function dial(cx, cy, k) {
    const r = 12 * k, rad = (d) => ((d - 90) * Math.PI) / 180;
    const P = (d, rr) => ({ x: cx + Math.sin((d * Math.PI) / 180) * rr,
                            y: cy - Math.cos((d * Math.PI) / 180) * rr });
    // whichever opponent polls the highest 2PP against Labor
    const g2 = D.agg2pp[D.agg2pp.length - 1];
    const gon = D.alt2pp && D.alt2pp.alp_on && D.alt2pp.alp_on[D.alt2pp.alp_on.length - 1];
    const cands = [{ id: "lnp", lab: g2.alp, opp: g2.lnp }];
    if (gon) cands.push({ id: "onp", lab: gon.a, opp: gon.b });
    const top = cands.slice().sort((x, y) => y.opp - x.opp)[0];
    const oppCol = T[top.id], margin = top.lab - top.opp;

    const arc = (a, b, col) => { c.beginPath(); c.arc(cx, cy, r, rad(a), rad(b));
      c.strokeStyle = col; c.lineWidth = 1.4 * k; c.lineCap = "round"; c.stroke(); };
    c.globalAlpha = 0.5; arc(-90, 0, T.alp); arc(0, 90, oppCol); c.globalAlpha = 1;

    const lp = D.aggPrimary[D.aggPrimary.length - 1];
    const ps = [["alp", lp.alp], ["lnp", lp.lnp], ["grn", lp.grn], ["onp", lp.onp]]
      .sort((a, b) => b[1] - a[1]);
    const vs = ps.map((p) => p[1]), mn = Math.min(...vs), mx = Math.max(...vs);
    [-54, -18, 18, 54].forEach((a, i) => {
      const h = (mx === mn ? 10.5 : 5 + ((ps[i][1] - mn) / (mx - mn)) * 5.5) * k;
      const q = P(a, r + 2 * k), o = P(a, r + 2 * k + h);
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(o.x, o.y);
      c.strokeStyle = T[ps[i][0]]; c.lineWidth = 3.4 * k; c.lineCap = "butt"; c.stroke();
    });

    const deg = -Math.max(-1, Math.min(1, margin / 12)) * 34;
    const col = margin >= 0 ? T.alp : oppCol, tip = P(deg, 8.6 * k);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(tip.x, tip.y);
    c.strokeStyle = col; c.lineWidth = 1.7 * k; c.lineCap = "round"; c.stroke();
    c.beginPath(); c.arc(tip.x, tip.y, 1.9 * k, 0, 7); c.fillStyle = col; c.fill();
    // pivot last, so it caps the needle rather than sitting under it
    c.beginPath(); c.arc(cx, cy, 1.7 * k, 0, 7); c.fillStyle = T.ink3; c.fill();
    console.log("card dial · needle " + deg.toFixed(1) + "deg vs " + top.id
                + " · " + ps.map((x) => x[0] + " " + x[1].toFixed(1)).join(", "));
  })(PAD + wMark + DIAL_GAP + DIAL_LEFT * DIAL_K, WM_MID + DIAL_DROP * DIAL_K, DIAL_K);

  /* The reading rides in the masthead band, right-aligned under the date.
     The band was 143px tall carrying one 14px line; the figures below need
     the whole middle of the card, and this is the only place the standfirst
     fits without taking it from them. */
  const marg = L.alp2pp - L.lnp2pp, chg = L.alp2pp - L.alp2ppPrev;
  c.textAlign = "right";
  caps("UPDATED " + L.updated.toUpperCase(), W - PAD, 74, 13, 2.2, T.ink3, 700);
  c.font = "600 40px Newsreader, Georgia, serif"; c.fillStyle = T.ink;
  c.fillText((marg >= 0 ? "Labor" : "Coalition") + " leads by " + Math.abs(marg).toFixed(1), W - PAD, 116);
  // one line, not two: the caveats belong beside the sentence they qualify.
  // The page will not call a move real unless it clears its own interval.
  c.font = '400 15px "Source Sans 3", sans-serif'; c.fillStyle = T.ink3;
  c.fillText("95% interval ±" + L.alp2ppCi95.toFixed(1) + " pts · "
             + L.method.nPolls + " polls in " + L.method.windowDays + " days · "
             + (chg > 0 ? "+" : "−") + Math.abs(chg).toFixed(1) + " on a month ago"
             + (L.changeSig ? "" : ", within the margin"), W - PAD, 142);
  c.textAlign = "left";
  c.strokeStyle = T.line; c.lineWidth = 1;
  c.beginPath(); c.moveTo(PAD, 162.5); c.lineTo(W - PAD, 162.5); c.stroke();

  /* ---- the figures ------------------------------------------------------ */
  /* No eyebrow over them. "TWO-PARTY PREFERRED" labelled a row that already
     says LABOR and COALITION inline, under a standfirst that has just said
     who leads and by how much - three namings of one measure.

     150px and centred on the card, arranged the way the page's own hero
     arranges them - Labor 51.4 | 48.6 Coalition - so the labels sit inline
     and no separate label row is needed. They are the only element that
     survives a 360px thumbnail, so they get the middle. */
  const FIG_Y = 330, FIG_PX = 150, GAP = 22, DOT = 4.5;
  const figFont = "600 " + FIG_PX + 'px Newsreader, Georgia, serif';
  /* Sentence case, so no tracking - 1.8px is what carries small caps and what
     pulls lowercase apart - and 22px rather than 20 to hold the optical size
     caps had, since only the L and the C now reach cap height. */
  const LAB_PX = 22;
  const measLabel = (t) => { c.font = `700 ${LAB_PX}px "Source Sans 3", sans-serif`;
    return c.measureText(t).width; };
  const measFig = (v) => { c.font = figFont; return c.measureText(v.toFixed(1)).width; };

  const wLabTxt = measLabel("Labor"), wCoaTxt = measLabel("Coalition");
  const wAlp = measFig(L.alp2pp), wLnp = measFig(L.lnp2pp);
  const rowW = DOT * 2 + 10 + wLabTxt + GAP + wAlp + GAP + 1 + GAP + wLnp
             + GAP + wCoaTxt + 10 + DOT * 2;
  let x = (W - rowW) / 2;

  /* Centred on the label's cap height, not floating above it - derived from
     the size rather than the 7 that was measured for 20px caps, so it stays
     centred if the label is ever resized again. */
  const DOT_Y = FIG_Y - LAB_PX * 0.3625;
  const dot = (cx, col) => { c.beginPath(); c.arc(cx, DOT_Y, DOT, 0, 7);
    c.fillStyle = col; c.fill(); };
  const figure = (v, col) => { c.font = figFont; c.fillStyle = col;
    c.fillText(v.toFixed(1), x, FIG_Y); x += c.measureText(v.toFixed(1)).width; };

  dot(x + DOT, T.alp); x += DOT * 2 + 10;
  caps("Labor", x, FIG_Y, LAB_PX, 0, T.ink2, 700); x += wLabTxt + GAP;
  figure(L.alp2pp, T.alp); x += GAP;
  c.strokeStyle = T.line; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x + 0.5, FIG_Y - 104); c.lineTo(x + 0.5, FIG_Y); c.stroke();
  x += 1 + GAP;
  figure(L.lnp2pp, T.lnp); x += GAP;
  caps("Coalition", x, FIG_Y, LAB_PX, 0, T.ink2, 700); x += wCoaTxt + 10;
  dot(x + DOT, T.lnp);

  /* ---- the term's trend -------------------------------------------------- */
  /* The plot sits on its own, lighter panel running the full width and bled
     off the bottom edge. The panel is what makes the bleed read as deliberate
     rather than as a forgotten margin, and the footer sits inside it, so no
     rule is needed to close it off.

     It bleeds LEFT but stops at the right margin: the past runs off the edge,
     the present - the end dots, which are what the card is about - keeps its
     70px of air. */
  c.fillStyle = T.panel; c.fillRect(0, 372, W, H - 372);
  const CX0 = 0, CX1 = W - PAD, CY0 = 392, CY1 = 578;
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
     itself, and watching it thin out from the election to now is the story.

     Both lines are shaded, each in its own tint, and the whole thing is
     clipped to ABOVE the tie line. That is what makes a mid-term change of
     lead render correctly: a line only encloses area above 50 while it is
     actually ahead, and the stretch where it trails is clipped away. Shading
     one line for the whole term instead - whoever happens to lead today -
     drew a self-intersecting polygon that filled inverted for the period they
     were behind. Today Labor leads throughout, so this changes nothing yet. */
  c.save();
  c.beginPath(); c.rect(0, CY0 - 40, W, sy(50) - (CY0 - 40)); c.clip();
  [[aPts, T.alpFill], [lPts, T.lnpFill]].forEach(([pts, fill]) => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); curve(pts);
    c.lineTo(CX1, sy(50)); c.lineTo(CX0, sy(50)); c.closePath();
    c.fillStyle = fill; c.fill();
  });
  c.restore();

  /* The 50% rule, unlabelled. It carried "50% – TIE" - kept as "tie" rather
     than "majority", since 50% 2PP is a tied national vote and not a majority
     of seats - but the shading already runs from the leader's line down to
     this rule, and the standfirst has said who leads and by how much. A
     dashed line under a lead reads as the tie without being told. */
  c.setLineDash([3, 6]); c.strokeStyle = T.ink3; c.lineWidth = 1.4; c.globalAlpha = 0.7;
  c.beginPath(); c.moveTo(CX0, sy(50)); c.lineTo(CX1, sy(50)); c.stroke();
  c.setLineDash([]); c.globalAlpha = 1;

  [[lPts, T.lnp], [aPts, T.alp]].forEach(([pts, col]) => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); curve(pts);
    c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
    const e = pts[pts.length - 1];
    c.beginPath(); c.arc(e[0], e[1], 8, 0, 7); c.fillStyle = T.panel; c.fill();
    c.beginPath(); c.arc(e[0], e[1], 5, 0, 7); c.fillStyle = col; c.fill();
  });
  // the term's two ends, so the trend is anchored rather than floating
  /* Sentence case, so the tracking goes with it: 1.4px is what makes small
     caps legible and what makes lowercase look pulled apart. The right-hand
     label takes the chart axis's own form - month, curly apostrophe, two
     digits - the same string buildXTicks writes on the site. */
  caps("2025 election · Labor " + D.agg2pp[0].alp.toFixed(1), PAD, 604, 13.5, 0, T.ink3, 600);
  c.textAlign = "right"; caps("Aug \u201926", W - PAD, 604, 13.5, 0, T.ink3, 600); c.textAlign = "left";

  /* ---- footer ------------------------------------------------------------ */
  /* No rule: the footer sits inside the plot's panel, and the panel's own top
     edge already divides it from the reading above. The old bottom ran 32px
     from the plot to these labels and then 24px to the provenance with 13px
     left under it, which read as cramped; it is 26 / 28 / 22 now. */
  /* Centred, on the axis labels' own baseline. Dropping the provenance line
     left the card stacking two right-aligned items 18px apart above an empty
     left half; the bottom is one row now, and the margin under it went from
     18px to 26. */
  c.textAlign = "center"; c.font = '600 17px "Source Sans 3", sans-serif'; c.fillStyle = T.ink2;
  c.fillText("auspoltracker.com", W / 2, 604); c.textAlign = "left";

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
