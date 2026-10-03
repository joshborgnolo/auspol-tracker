/* auspol tracker – "wind the dial back": the masthead mark, replayed across the term.

   The mark is not decoration. Its graduation bars are the primary-vote
   aggregate, its needle is implied two-party preferred, and the right half of
   its arc is coloured for whichever party is Labor's strongest challenger.
   Pressing it lifts the instrument off the masthead, winds it back to the May
   2025 election and lets the term run again, on a stage of its own.

   THE CHOREOGRAPHY
   1. Lift. The dial leaves the masthead at exactly the reading the masthead
      shows - same bars, same needle, same arc - drops out on a curve and grows
      into the instrument, its scale, readings and mercury arriving as it lands.
      The masthead's own copy goes dark while the dial is away from it.
   2. Wind back. The whole term is on screen for a beat, then the playhead runs
      backwards to election day: the trace un-draws, every poll lifts off the
      line, and the needle whips back through seventeen months.
   3. Replay. Every poll drops onto the line as the playhead reaches it and
      streaks into the needle, which takes a small kick toward that poll before
      settling back onto the estimate - the aggregate, shown as what polls do to
      it. A party passing another trades places on the arc; the challenger
      changing hands floods the arc's right side with the new colour. Time
      slows for those moments, so the caption naming each one can be read.
   4. Land on the live estimate - the headline's figure - with a shockwave and
      the whole field of polls shimmering once.
   5. Return. Closing flies the dial home, sliding back to the live reading on
      the way, so it lands as the mark it left.

   WHAT STAYS EXACT
   Everything in motion is interpolation between monthly figures, and every
   resting state is a figure. Paused on a month, the needle, the numbers and
   the line read that month's implied aggregate exactly; the final frame is the
   live nowcast, built from the very inputs GlyphDial draws the masthead from
   (tppLatest on the implied basis, latest.primary). The player this replaced
   rested its bars on September's monthly mean while quoting the live 2PP, so
   it could put One Nation ahead of Labor on first preferences while the
   masthead it flew out of said the opposite. The needle's kicks are the one
   liberty taken, and each decays back onto the estimate within half a second.

   HOW IT RUNS
   One clock. React draws the structure once; a single requestAnimationFrame
   loop (gpEngine) owns everything that moves and writes it straight to the
   DOM and two canvases - transforms, a few SVG attributes, the dots and the
   streaks. A month change costs React one small render (for the slider's
   reading); nothing else goes through it. The loop sleeps when nothing is
   moving. Reduced motion gets the same instrument with no flight, no rewind,
   no particles and no springs: it opens on the live reading and steps month
   by month. */

/* ---- geometry: the masthead mark at ten times its size ------------------ */
const GP = {
  R: 120,          // the arc: GlyphDial's r = 12
  SEAT: 140,       // where every bar stands: GlyphDial's r + 2
  BAR_W: 34,       // GlyphDial's 3.4
  BAR_LEN: 150,    // bar length at MAX_PCT (absolute, so growth is visible)
  MAX_PCT: 40,
  SLOTS: [-54, -18, 18, 54],   // tallest first, left to right
  SWING_PTS: 12,   // a margin this size deflects the needle fully
  SWING_DEG: 34,
  BAR_SEP: 12,     // degrees two bars keep apart while trading places
  LABEL_SEP: 27,   // and their readings
  VB: [-250, -286, 500, 304],
};
/* GlyphDial's own proportions, so the dial leaves and lands as that mark */
const GP_MAST = { minH: 50, maxH: 105, needle: 86, needleW: 17, bead: 19, pivot: 17, arcW: 14, arcOp: 0.5,
                  vb: [0.58, 0.07, 38.39, 26.73], cx: 22, cy: 24.5 };
/* and the stage's: finer strokes on a bigger face */
const GP_LOOK = { needle: 100, needleW: 7, bead: 11, pivot: 12, arcW: 11, barW: 26 };
const GP_IDS = ["alp", "lnp", "grn", "onp"];
const GP_ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON" };
const GP_NAME = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation" };
const GP_SUBJ = { alp: "Labor", lnp: "The Coalition", grn: "The Greens", onp: "One Nation" };
const GP_OBJ = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation" };
const GP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
                   "September", "October", "November", "December"];
const GP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* ms. PLAY is the whole term at full speed; slowing for the captions adds ~3s */
const GP_T = { INTRO: 1200, REWIND: 1450, HOLD: 1000, PLAY: 9000, OUT: 740 };

const gpClamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gpLerp = (a, b, t) => a + (b - a) * t;
const gpSmooth = (t) => t * t * (3 - 2 * t);
const gpInvSmooth = (e) => 0.5 - Math.sin(Math.asin(1 - 2 * gpClamp(e, 0, 1)) / 3);
const gpEaseIO3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const gpEaseIO4 = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
const gpEaseOut3 = (t) => 1 - Math.pow(1 - t, 3);
function gpBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
const gpPolar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
};
const gpArc = (d1, d2, r) => {
  const [ax, ay] = gpPolar(d1, r), [bx, by] = gpPolar(d2, r);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${r} ${r} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
};
// negative = the Labor side, as on the masthead
const gpDeg = (margin) => -gpClamp(margin / GP.SWING_PTS, -1, 1) * GP.SWING_DEG;
const gpBarLen = (v) => Math.max(6, Math.min(1, (v || 0) / GP.MAX_PCT) * GP.BAR_LEN);
/* A damped spring, sub-stepped so a long frame can't blow it up. */
function gpSpring(s, target, k, c, dt) {
  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 240);
    s.v += (-k * (s.x - target) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}
const gpRest = (s, target, eps) => Math.abs(s.v) < eps && Math.abs(s.x - target) < eps;

/* The data's decimal years: year + (day of year - 1) / 365, the way the
   events are written. */
function gpYearX(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y + (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5 / 365;
}
function gpDayOf(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d + " " + GP_MONTHS[m - 1] + " " + y;
}

/* Monotone cubic through the monthly points (Fritsch-Carlson): smooth, and it
   never overshoots a month - so a line between two readings can't invent a
   figure outside them. A series that starts late (ALP v One Nation has no
   election-month figure) reads null before its first point. */
function gpMonotone(X, Y) {
  const xs = [], ys = [];
  X.forEach((x, i) => { if (Y[i] != null && isFinite(Y[i])) { xs.push(x); ys.push(+Y[i]); } });
  const n = xs.length;
  if (!n) return () => null;
  if (n === 1) return (x) => (x < xs[0] - 1e-9 ? null : ys[0]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x < xs[0] - 1e-9) return null;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] +
           (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

/* Push items apart along the dial until none are closer than `sep`. At rest
   the slots are 36 degrees apart, so this only engages while two are trading
   places - and it is what lets an overtake read as one bar sliding past
   another rather than two merging. */
function gpSeparate(items, sep) {
  const a = items.map((o) => ({ ...o })).sort((x, y) => x.a - y.a);
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < a.length - 1; k++) {
      const gap = a[k + 1].a - a[k].a;
      if (gap < sep) { const push = (sep - gap) / 2; a[k].a -= push; a[k + 1].a += push; }
    }
  }
  return a;
}

/* ====================================================================
   The story: one frame a month on the implied 2PP spine, the polls in
   between, and the moments worth stopping for.
   ==================================================================== */
function buildDialStory(D) {
  const implied = !!(D.synth2pp && D.synth2pp.length > 1);
  const spine = implied ? D.synth2pp : D.agg2pp;
  const onSrc = (implied ? D.synthOn : D.alt2pp && D.alt2pp.alp_on) || [];
  const onBy = new Map(onSrc.map((p) => [p.ym, p]));
  const primBy = new Map((D.aggPrimary || []).map((p) => [p.ym, p]));
  const frames = spine.map((m) => {
    const on = onBy.get(m.ym), pr = primBy.get(m.ym) || {};
    const vals = {};
    GP_IDS.forEach((id) => { vals[id] = pr[id] == null ? null : +pr[id]; });
    return { ym: m.ym, x: m.x, election: !!m.election, labL: m.alp, oppL: m.lnp,
             labO: on ? on.a : null, oppO: on ? on.b : null, vals };
  });
  const n = frames.length;
  const last = frames[n - 1];
  /* The final frame is the live reading, built from GlyphDial's own inputs:
     both implied head-to-heads from tppLatest and the 21-day primary nowcast
     (latest.primary) - the needle, the arc and all four bars, so the dial
     comes to rest as the mark it flew out of. */
  const tl = window.AP && window.AP.tppLatest;
  const L = tl ? tl("alp_lnp", "imp") : null, O = tl ? tl("alp_on", "imp") : null;
  if (L && L.b != null) { last.labL = L.a; last.oppL = L.b; last.live = true; }
  if (O && O.b != null) { last.labO = O.a; last.oppO = O.b; last.live = true; }
  const lp = D.latest && D.latest.primary;
  if (last.live && lp) GP_IDS.forEach((id) => { if (lp[id] != null) last.vals[id] = +lp[id]; });
  GP_IDS.forEach((id) => {          // carry a missing reading across from a neighbour
    let prev = null;
    frames.forEach((f) => { if (f.vals[id] == null) f.vals[id] = prev; else prev = f.vals[id]; });
    let next = null;
    for (let i = n - 1; i >= 0; i--) { if (frames[i].vals[id] == null) frames[i].vals[id] = next; else next = frames[i].vals[id]; }
  });
  const allPolls = (D.individualPolls || []).filter((p) => p.x != null);
  /* the live frame sits on the day of the newest poll, so every poll lands
     before the replay does */
  if (last.live) {
    const upd = D.latest && D.latest.updatedISO ? gpYearX(D.latest.updatedISO) : last.x;
    last.x = Math.max(last.x, upd, ...allPolls.map((p) => p.x));
  }

  const X = frames.map((f) => f.x), x0 = X[0], x1 = X[n - 1];
  const mk = (k) => gpMonotone(X, frames.map((f) => f[k]));
  const I = { labL: mk("labL"), oppL: mk("oppL"), labO: mk("labO"), oppO: mk("oppO") };
  const V = {};
  GP_IDS.forEach((id) => { V[id] = gpMonotone(X, frames.map((f) => f.vals[id])); });
  /* Labor against whichever challenger runs it closer AT THIS INSTANT. The two
     contests share Labor's side of 100, so where one challenger overtakes the
     other the two readings are equal and the dial changes contest without a
     jump. */
  const contest = (x) => {
    const oL = I.oppL(x), oO = I.oppO(x);
    return oO != null && oO > oL ? { id: "onp", lab: I.labO(x), opp: oO } : { id: "lnp", lab: I.labL(x), opp: oL };
  };
  const fOf = (x) => {
    if (x <= x0) return 0;
    if (x >= x1) return n - 1;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (X[mid] <= x) lo = mid; else hi = mid; }
    return lo + (x - X[lo]) / (X[hi] - X[lo]);
  };
  const xOfF = (f) => {
    const c = gpClamp(f, 0, n - 1), k = Math.min(n - 2, Math.floor(c));
    return X[k] + (X[k + 1] - X[k]) * (c - k);
  };
  /* The instrument holds each month's reading and rolls into the next one at
     the turn of the month - the middle EB of the way between two monthly
     points - the way the month reel and the figures do. Continuous figures
     were unreadable: a playing odometer was always mid-roll. So the dial, its
     numbers and its captions run on these HELD readings; only the line
     underneath, which is the term as a shape, runs on the smooth curve. */
  const EA = 0.22, EB = 0.56;
  const at = (x) => {
    const fi = fOf(x), k = Math.max(0, Math.min(n - 2, Math.floor(fi)));
    const e = gpSmooth(gpClamp((fi - k - EA) / EB, 0, 1));
    const A = frames[k], B = frames[Math.min(n - 1, k + 1)];
    const L = (a, b) => (a == null || b == null ? null : a + (b - a) * e);
    const vals = {};
    GP_IDS.forEach((id) => { vals[id] = L(A.vals[id], B.vals[id]); });
    const oL = L(A.oppL, B.oppL), oO = L(A.oppO, B.oppO), on = oO != null && oO > oL;
    const lab = on ? L(A.labO, B.labO) : L(A.labL, B.labL), opp = on ? oO : oL;
    const order = GP_IDS.slice().sort((a, b) => vals[b] - vals[a]);
    return { lab, opp, oppId: on ? "onp" : "lnp", margin: lab - opp, deg: gpDeg(lab - opp), vals, order, fe: k + e };
  };

  const perMonth = {};
  allPolls.forEach((p) => { perMonth[p.ym] = (perMonth[p.ym] || 0) + 1; });
  const cur = (D.cycles || []).find((c) => c.current);
  const electionDay = cur && cur.eDate ? gpDayOf(cur.eDate) : "";
  frames.forEach((f, i) => {
    const c = at(f.x);
    f.lab = c.lab; f.opp = c.opp; f.oppId = c.oppId;
    const [y, m] = f.ym.split("-").map(Number);
    f.label = f.live && i === n - 1 ? "Now" : GP_MONTHS[m - 1];
    f.year = f.live && i === n - 1 ? "" : String(y);
    const k = perMonth[f.ym] || 0;
    f.sub = f.live && i === n - 1 ? "Latest estimate, to " + (D.latest.updated || "")
      : f.election ? "Election day, " + electionDay
      : k === 1 ? "1 poll this month" : k + " polls this month";
  });

  /* every poll, on the same contest as the line it lands on */
  const polls = allPolls.map((p) => {
    if (p.x < x0 || p.x > x1 + 1e-6) return null;
    const c = contest(p.x);
    const v = implied ? (c.id === "onp" ? p.alpOnImp : p.alpImp)
                      : (c.id === "onp" ? (p.tppAlt ? p.tppAlt.alp : null) : p.alpN);
    return v == null ? null : { x: Math.min(p.x, x1), v: +v, opp: c.id, house: p.pollster };
  }).filter(Boolean);

  const ys = polls.map((p) => p.v).concat(frames.map((f) => f.lab), [50]);
  const lo = Math.floor(Math.min(...ys) - 0.5), hi = Math.ceil(Math.max(...ys) + 0.5);
  const samples = [];
  for (let i = 0, SN = 520; i <= SN; i++) {
    const x = x0 + ((x1 - x0) * i) / SN, c = contest(x);
    samples.push({ x, v: c.lab, id: c.id });
  }

  /* ---- the moments -------------------------------------------------------
     Found on the same interpolants the dial runs on, so a caption fires when
     the bars actually trade places, not at a month boundary near it. */
  const beats = [];
  const start = at(x0).order;
  const crossed = {};
  let lead = 0;      // 0: the Coalition has always run Labor closest; 1: One Nation has; 2: they've come level
  for (let k = 0; k < n - 1; k++) {
    const A = frames[k], B = frames[k + 1];
    // where in the segment the held readings cross: invert the roll's easing
    const xAt = (e) => X[k] + (EA + EB * gpInvSmooth(e)) * (X[k + 1] - X[k]);
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      const P = GP_IDS[p], Q = GP_IDS[q];
      const da = A.vals[P] - A.vals[Q], db = B.vals[P] - B.vals[Q];
      if ((da > 0) === (db > 0)) continue;
      const win = db > 0 ? P : Q, lose = win === P ? Q : P, key = P + Q;
      const c = (crossed[key] = (crossed[key] || 0) + 1);
      const wasAhead = start.indexOf(win) < start.indexOf(lose);
      beats.push({ x: xAt(da / (da - db)), kind: "pass", a: win, b: lose, back: wasAhead,
                   again: !wasAhead && c > 1, level: Math.abs(db) < 1 });
    }
    /* Which challenger runs Labor closer changes hands more often than it
       means anything: from mid-2026 the two sit within a few tenths of each
       other and the lead flips month to month. The arc shows every flip;
       a caption names only the first, the first time the two come level,
       and any change by a point or more. */
    if (A.oppO != null && B.oppO != null) {
      const ha = A.oppO - A.oppL, hb = B.oppO - B.oppL;
      if ((ha > 0) !== (hb > 0)) {
        const to = hb > 0 ? "onp" : "lnp", gap = Math.abs(hb), x = xAt(ha / (ha - hb));
        if (to === "onp" && lead === 0) { beats.push({ x, kind: "lead", a: to, first: true, level: gap < 1 }); lead = gap < 1 ? 2 : 1; }
        else if (gap < 1 && lead === 1) { beats.push({ x, kind: "lead", a: to, level: true }); lead = 2; }
        else if (gap >= 1) beats.push({ x, kind: "lead", a: to, again: true });
      }
    }
  }
  beats.push({ x: x0, kind: "start" }, { x: x1, kind: "end" });
  beats.sort((a, b) => a.x - b.x);
  const f0 = frames[0];
  beats.forEach((b, i) => { b.id = i; Object.assign(b, gpBeatCopy(b, f0, frames[n - 1], electionDay)); });
  const events = (D.events || []).filter((e) => e.major && e.x >= x0 && e.x <= x1)
    .map((e) => ({ x: e.x, label: e.label, date: gpDayOf(e.date) }));

  // every poll counts toward the tally, including one with no implied figure to plot
  const tally = allPolls.map((p) => Math.min(p.x, x1)).filter((x) => x >= x0).sort((a, b) => a - b);
  return { frames, n, X, x0, x1, polls, events, beats, samples, lo, hi, at, contest, fOf, xOfF, EA, EB,
           implied, VB: GP.VB, tally, total: tally.length };
}

/* Captions. Party names carry their colour; everything else is plain. */
function gpBeatCopy(b, f0, fN, electionDay) {
  /* a crossing by less than a point is a draw, not a pass: monthly
     figures are not that precise */
  if (b.kind === "pass") {
    const verb = b.back ? (b.level ? " edges back ahead of " : " moves back ahead of ")
                        : (b.level ? " draws level with " : " passes ");
    const title = [{ t: GP_SUBJ[b.a], p: b.a }, { t: verb }, { t: GP_OBJ[b.b], p: b.b }, { t: b.again ? " again" : "" }];
    return { title, sub: "First preferences", story: true };
  }
  if (b.kind === "lead") {
    const other = b.a === "onp" ? "lnp" : "onp";
    const title = b.first
      ? [{ t: "One Nation", p: "onp" }, { t: " now runs " }, { t: "Labor", p: "alp" },
         { t: b.level ? " about as close as " : " closer than " }, { t: "the Coalition", p: "lnp" }, { t: " does" }]
      : b.level
        ? [{ t: GP_SUBJ[b.a], p: b.a }, { t: " draws level with " }, { t: GP_OBJ[other], p: other }]
        : [{ t: GP_SUBJ[b.a], p: b.a }, { t: " runs " }, { t: "Labor", p: "alp" }, { t: " closer again" }];
    return { title, sub: b.level && !b.first ? "Two-party preferred, each against Labor" : "Two-party preferred", story: true };
  }
  if (b.kind === "start") {
    return { title: [{ t: "Election day" }], sub: electionDay };
  }
  const m0 = f0.lab - f0.opp, m1 = fN.lab - fN.opp;
  const title = m1 > 0
    ? [{ t: "Labor’s", p: "alp" }, { t: " lead: " + m0.toFixed(1) + " points at the election, " + m1.toFixed(1) + " now" }]
    : m1 < 0
      ? [{ t: "Labor", p: "alp" }, { t: " led by " + m0.toFixed(1) + " points at the election and trails by " + (-m1).toFixed(1) + " now" }]
      : [{ t: "Labor", p: "alp" }, { t: " led by " + m0.toFixed(1) + " points at the election and is level now" }];
  return { title, sub: "Over its closest challenger, two-party preferred" };
}

/* Canvas can't read var(--alp), so the palette is resolved through a probe
   element and a one-pixel canvas: whatever colour syntax the theme writes in
   (oklch, color-mix), what comes back is plain sRGB. Re-read when the theme
   flips. */
function gpPalette(host) {
  const probe = document.createElement("i");
  probe.style.display = "none";
  host.appendChild(probe);
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  const P = {};
  ["alp", "lnp", "grn", "onp", "ink", "ink-2", "ink-3", "ink-faint", "line", "surface", "bg"].forEach((k) => {
    probe.style.color = "var(--" + k + ")";
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#000";
    g.fillStyle = getComputedStyle(probe).color;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    P[k] = [d[0], d[1], d[2]];
  });
  host.removeChild(probe);
  return P;
}
const gpRgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : +a.toFixed(3)) + ")";

/* ====================================================================
   The engine: one clock for everything that moves.
   ==================================================================== */
function gpEngine(M, N, cb, opt) {
  const reduce = !!opt.reduce;
  const F = M.frames, n = M.n, X = M.X, x0 = M.x0, x1 = M.x1, span = x1 - x0;
  const T0 = performance.now();
  const glyph = document.querySelector("button.wm-glyph .wm-dial");
  const fly = !reduce && !!opt.origin && !!glyph;
  let raf = 0, last = T0, dead = false, finished = false;

  const G = { k: 1, pivX: 0, pivY: 0, left: 0, top: 0, lb: {}, tips: {}, tl: null, dpr: 1, pal: null,
              tint: 0.2, narrow: false, mast: null, fxDirty: false, lineH: 40, cache: new WeakMap() };
  const tg0 = M.at(x1);
  const S = {
    x: x1, prevX: x1, mode: reduce || !fly ? "pause" : "intro", modeT: T0,
    fl: { x: fly ? 0 : 1, v: 0 }, shape: fly ? 0 : 1,
    needle: { x: tg0.deg, v: 0 }, bead: { x: 0, v: 0 }, bars: {}, order: tg0.order.slice(),
    arcBase: tg0.oppId, flood: null, shocks: [], comets: [], sparks: [], trail: [],
    dots: M.polls.map(() => ({ s: 2, t: 1, c: false, hit: true })),
    idx: -1, fe: n - 1, blur: 0, beat: null, beatQ: [], beatT: -1e9, ev: -2,
    drag: null, glide: null, coast: null, shimmer: -1, out: null, revealed: !fly, count: -1,
    reelDirect: false, wheelAcc: 0, lastFx: 0, stepT: 0,
  };
  tg0.order.forEach((id, slot) => {
    S.bars[id] = { a: { x: GP.SLOTS[slot], v: 0 }, l: { x: gpBarLen(tg0.vals[id]), v: 0 } };
  });

  /* ---- small DOM writer that skips unchanged values ---- */
  const css = (el, prop, val) => {
    let c = G.cache.get(el);
    if (!c) { c = {}; G.cache.set(el, c); }
    if (c[prop] === val) return;
    c[prop] = val;
    el.style[prop] = val;
  };
  const att = (el, name, val) => {
    let c = G.cache.get(el);
    if (!c) { c = {}; G.cache.set(el, c); }
    const k = "@" + name;
    if (c[k] === val) return;
    c[k] = val;
    el.setAttribute(name, val);
  };

  /* ---- measuring: on open, on resize, on a theme flip ---- */
  const xPx = (x) => G.tl.pl + ((x - x0) / span) * G.tl.pw;
  const yPx = (v) => G.tl.pt + ((M.hi - v) / (M.hi - M.lo)) * G.tl.ph;
  const pxX = (px) => x0 + ((px - G.tl.pl) / G.tl.pw) * span;
  function mastFrom(r) {
    const k = r.width / GP_MAST.vb[2];
    return { x: r.left + (GP_MAST.cx - GP_MAST.vb[0]) * k, y: r.top + (GP_MAST.cy - GP_MAST.vb[1]) * k, k };
  }
  function measure() {
    const r = N.dbox.getBoundingClientRect();
    G.left = r.left; G.top = r.top;
    G.k = r.width / M.VB[2];
    G.pivX = -M.VB[0] * G.k; G.pivY = -M.VB[1] * G.k;
    N.flier.style.transformOrigin = G.pivX.toFixed(2) + "px " + G.pivY.toFixed(2) + "px";
    GP_IDS.forEach((id) => { const el = N.bl[id]; G.lb[id] = { w: el.offsetWidth, h: el.offsetHeight }; });
    G.narrow = window.innerWidth < 700;
    G.lineH = N.reel.firstChild ? N.reel.firstChild.getBoundingClientRect().height || 40 : 40;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    G.dpr = dpr;
    const tr = N.time.getBoundingClientRect();
    const tl = { left: tr.left, top: tr.top, w: tr.width, h: tr.height };
    tl.pl = G.narrow ? 24 : 30; tl.pr = G.narrow ? 4 : 8; tl.pt = 24; tl.pb = G.narrow ? 20 : 24;
    tl.pw = Math.max(10, tl.w - tl.pl - tl.pr); tl.ph = Math.max(10, tl.h - tl.pt - tl.pb);
    G.tl = tl;
    N.tl.width = Math.max(1, Math.round(tl.w * dpr)); N.tl.height = Math.max(1, Math.round(tl.h * dpr));
    G.tlx = N.tl.getContext("2d");
    G.fw = window.innerWidth; G.fh = window.innerHeight;
    N.fx.width = Math.round(G.fw * dpr); N.fx.height = Math.round(G.fh * dpr);
    G.fxx = N.fx.getContext("2d");
    G.trace = M.samples.map((s) => ({ px: xPx(s.x), py: yPx(s.v), id: s.id, x: s.x }));
    G.dotsPx = M.polls.map((p) => ({ px: xPx(p.x), py: yPx(p.v) }));
    if (glyph) G.mast = mastFrom(opt.origin && !G.mast ? opt.origin : glyph.getBoundingClientRect());
    S.ev = -2;            // the event tag re-places itself at the new width
    buildStatic();
  }
  function readTheme() {
    G.pal = gpPalette(N.root);
    G.tint = parseFloat(getComputedStyle(N.root).getPropertyValue("--gp-tint")) || 0.2;
  }

  /* The timeline's furniture - grid, 50 line, months, event pins, the ghost of
     the whole term - drawn once per size and theme, then blitted each frame. */
  function buildStatic() {
    const tl = G.tl, dpr = G.dpr, P = G.pal;
    const c = G.stat || (G.stat = document.createElement("canvas"));
    c.width = N.tl.width; c.height = N.tl.height;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, tl.w, tl.h);
    const font = (w, px) => w + " " + px + 'px "IBM Plex Sans", system-ui, sans-serif';
    g.font = font(500, G.narrow ? 9.5 : 10.5);
    g.textBaseline = "middle"; g.textAlign = "right";
    for (let v = Math.ceil(M.lo / 5) * 5; v <= M.hi; v += 5) {
      const y = Math.round(yPx(v)) + 0.5;
      g.lineWidth = 1;
      if (v === 50) { g.strokeStyle = gpRgba(P["ink-3"], 0.6); g.setLineDash([3, 4]); }
      else { g.strokeStyle = gpRgba(P.line, 1); g.setLineDash([]); }
      g.beginPath(); g.moveTo(tl.pl, y); g.lineTo(tl.pl + tl.pw, y); g.stroke();
      g.fillStyle = gpRgba(P["ink-3"], 1);
      g.fillText(String(v), tl.pl - 7, y);
    }
    g.setLineDash([]);
    // the months along the bottom; January carries its year
    const ticks = [];
    let [yy, mm] = F[0].ym.split("-").map(Number);
    for (;;) {
      mm++; if (mm > 12) { mm = 1; yy++; }
      const x = gpYearX(yy + "-" + String(mm).padStart(2, "0") + "-01");
      if (x > x1) break;
      ticks.push({ x, y: yy, m: mm - 1 });
    }
    const gap = tl.pw / Math.max(1, ticks.length);
    const every = gap < 26 ? 3 : gap < 40 ? 2 : 1;
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    ticks.forEach((tk) => {
      const x = Math.round(xPx(tk.x)) + 0.5, yb = tl.pt + tl.ph;
      g.strokeStyle = gpRgba(P["ink-faint"], 0.8); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, yb + 1); g.lineTo(x, yb + (tk.m === 0 ? 7 : 4)); g.stroke();
      if (tk.m % every !== 0) return;
      g.font = font(tk.m === 0 ? 600 : 500, G.narrow ? 9.5 : 10.5);
      g.fillStyle = gpRgba(tk.m === 0 ? P["ink-2"] : P["ink-3"], 1);
      g.fillText(tk.m === 0 ? String(tk.y) : GP_MON[tk.m], x, yb + (G.narrow ? 15 : 17));
    });
    // event pins
    M.events.forEach((e) => {
      const x = Math.round(xPx(e.x)) + 0.5;
      g.strokeStyle = gpRgba(P["ink-faint"], 0.75); g.lineWidth = 1; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(x, tl.pt - 7); g.lineTo(x, tl.pt + tl.ph); g.stroke();
      g.setLineDash([]);
      g.fillStyle = gpRgba(P["ink-3"], 1);
      g.beginPath(); g.arc(x, tl.pt - 9, 2.3, 0, 6.2832); g.fill();
    });
    // the term ahead, faint
    g.strokeStyle = gpRgba(P["ink-faint"], 0.5); g.lineWidth = 1.4; g.lineJoin = "round";
    g.beginPath();
    G.trace.forEach((s, i) => (i ? g.lineTo(s.px, s.py) : g.moveTo(s.px, s.py)));
    g.stroke();
  }

  /* ---- modes ---- */
  function setMode(m, t) {
    S.mode = m; S.modeT = t;
    N.root.classList.toggle("gp-rw", m === "rewind");
    const running = m === "play" || m === "rewind" || m === "hold" || m === "intro";
    N.root.classList.toggle("gp-run", running);
    cb.onPlaying(running);
  }
  const fiNow = () => M.fOf(S.x);
  function glideTo(x, t) {
    S.coast = null;
    if (reduce) {          // no travel: the reading simply changes
      S.x = gpClamp(x, x0, x1); S.glide = null; S.reelDirect = false;
      setMode("pause", t); announce();
      return;
    }
    S.glide = { x: S.x, v: S.glide && S.mode === "glide" ? S.glide.v : 0, to: gpClamp(x, x0, x1) };
    setMode("glide", t);
  }
  function nearestX(x) { return X[Math.round(M.fOf(x))]; }
  function rewind(t) {
    S.rw = { from: S.x, dur: GP_T.REWIND * gpClamp((S.x - x0) / span, 0.3, 1) };
    S.beatQ = [];
    showBeat(null, t);
    setMode("rewind", t);
  }

  /* ---- what the term shows at the playhead, and the springs that chase it ---- */
  function physics(tg, dt, t) {
    const live = S.mode !== "intro" && !S.out;
    if (reduce) {
      S.needle.x = tg.deg; S.needle.v = 0;
      tg.order.forEach((id, slot) => { const b = S.bars[id]; b.a.x = GP.SLOTS[slot]; b.l.x = gpBarLen(tg.vals[id]); b.a.v = b.l.v = 0; });
    } else {
      gpSpring(S.needle, tg.deg, 200, 13, dt);
      tg.order.forEach((id, slot) => {
        const b = S.bars[id];
        gpSpring(b.a, GP.SLOTS[slot], 150, 17.5, dt);
        gpSpring(b.l, gpBarLen(tg.vals[id]), 240, 17, dt);
      });
      gpSpring(S.bead, 0, 320, 17, dt);
    }
    // a party passing another: sparks off the overtaking bar, a ring off the dial
    const ord = tg.order.join();
    if (ord !== S.order.join()) {
      if (live && !reduce && S.mode !== "rewind") {
        for (let i = 0; i < 4; i++) if (tg.order[i] !== S.order[i]) { overtakeFx(tg.order[i], t); break; }
      }
      S.order = tg.order.slice();
    }
    // the challenger changing hands floods the arc's right side
    if (S.flood) {
      S.flood.dir = tg.oppId === S.flood.to ? 1 : -1;
      S.flood.u += (S.flood.dir * dt) / (reduce ? 0.001 : 0.6);
      if (S.flood.u >= 1) { S.arcBase = S.flood.to; S.flood = null; }
      else if (S.flood.u <= 0) S.flood = null;
    } else if (tg.oppId !== S.arcBase) {
      S.flood = { to: tg.oppId, u: 0, dir: 1 };
      const named = M.beats.some((b) => b.kind === "lead" && Math.abs(b.x - S.x) < 0.06);
      if (live && named && !reduce && S.mode !== "rewind") {
        shock(tg.oppId, t, 0.9);
        const [ax, ay] = gpPolar(45, GP.R);
        burst(G.left + G.pivX + ax * G.k, G.top + G.pivY + ay * G.k, tg.oppId, 16, 260);
      }
    }
  }

  function overtakeFx(id, t) {
    if (t - (S.lastOver || 0) < 220) return;
    S.lastOver = t;
    const b = G.tips[id];
    if (!b) return;
    const [tx, ty] = gpPolar(b.a, b.r);
    burst(G.left + G.pivX + tx * G.k, G.top + G.pivY + ty * G.k, id, 18, 300);
    shock(id, t, 0.6);
  }
  function shock(color, t, k) {
    S.shocks.push({ t0: t, color, k: k || 1 });
    if (S.shocks.length > N.shk.length) S.shocks.shift();
  }
  function burst(x, y, color, count, speed) {
    if (S.sparks.length > 320) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.9);
      S.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.25, age: 0,
                      max: 0.5 + Math.random() * 0.55, col: color, w: 1.1 + Math.random() * 1.5 });
    }
  }

  /* ---- the polls: drop in, lift off, and streak into the needle ---- */
  function updDots(dt, t) {
    const fwd = S.x >= S.prevX;
    const feed = !reduce && (S.mode === "play" || ((S.mode === "drag" || S.mode === "coast") && fwd));
    for (let i = 0; i < M.polls.length; i++) {
      const d = S.dots[i], want = S.x >= M.polls[i].x - 1e-9;
      if (want && (d.s === 0 || d.s === 3)) { d.s = 1; d.t = reduce ? 1 : 0; d.c = feed; d.hit = false; }
      else if (!want && (d.s === 1 || d.s === 2)) { d.s = reduce ? 0 : 3; d.t = 0; }
      if (d.s === 1) {
        d.t = Math.min(1, d.t + dt / 0.5);
        if (!d.hit && d.t >= 0.36) { d.hit = true; if (d.c) comet(i, t); }
        if (d.t >= 1) d.s = 2;
      } else if (d.s === 3) {
        d.t += dt / 0.26;
        if (d.t >= 1) { d.s = 0; d.t = 0; }
      }
    }
    let count = 0;
    while (count < M.tally.length && M.tally[count] <= S.x + 1e-9) count++;
    if (count !== S.count) {
      S.count = count;
      N.count.textContent = count >= M.total ? M.total + " polls" : count + " of " + M.total + " polls";
    }
  }
  function comet(i, t) {
    if (S.comets.length > 40 || !G.dotsPx) return;
    const q = G.dotsPx[i], p = M.polls[i];
    const side = Math.random() < 0.5 ? -1 : 1;
    S.comets.push({ t0: t, dur: 520 + Math.random() * 300, sx: G.tl.left + q.px, sy: G.tl.top + q.py,
                    cx: side * (30 + Math.random() * 110), cy: -(70 + Math.random() * 130),
                    col: p.v >= 50 ? "alp" : p.opp, deg: gpDeg(2 * p.v - 100) });
  }
  const needleLen = () => gpLerp(GP_MAST.needle, GP_LOOK.needle, S.shape);
  function beadPage() {
    const a = (S.needle.x * Math.PI) / 180, L = needleLen() * G.k;
    return { x: G.left + G.pivX + Math.sin(a) * L, y: G.top + G.pivY - Math.cos(a) * L };
  }
  function updFx(dt, t) {
    for (let i = S.comets.length - 1; i >= 0; i--) {
      const c = S.comets[i];
      if (t - c.t0 >= c.dur) {
        // arrival: the bead flares and the needle is pulled toward the poll
        S.bead.v += 5;
        const dd = c.deg - S.needle.x;
        S.needle.v += Math.sign(dd) * Math.min(20, Math.abs(dd) * 2.4);
        S.comets.splice(i, 1);
      }
    }
    const drag = Math.exp(-3.2 * dt);
    for (let i = S.sparks.length - 1; i >= 0; i--) {
      const s = S.sparks[i];
      s.age += dt;
      if (s.age >= s.max) { S.sparks.splice(i, 1); continue; }
      s.vx *= drag; s.vy = s.vy * drag + 340 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    for (let i = S.shocks.length - 1; i >= 0; i--) if (t - S.shocks[i].t0 > 1000) S.shocks.splice(i, 1);
  }

  /* ---- the moments: queued in play so each caption gets read ---- */
  function showBeat(b, t) {
    if (S.beat === b) return;
    S.beat = b;
    if (b) S.beatT = t;
    cb.onBeat(b);
  }
  function updBeats(t) {
    if (S.mode === "play") {
      M.beats.forEach((b) => { if (b.story && b.x > S.prevX && b.x <= S.x) S.beatQ.push(b); });
      if (S.beatQ.length && t - S.beatT > 1150) {
        while (S.beatQ.length > 1 && S.beatQ[0].x < S.x - 0.1) S.beatQ.shift();
        showBeat(S.beatQ.shift(), t);
      } else if (!S.beatQ.length && S.beat && S.beat.kind !== "end" && t - S.beatT > 2800) showBeat(null, t);
    } else if (S.mode === "drag" || S.mode === "coast" || S.mode === "glide" || (S.mode === "pause" && S.userMoved)) {
      let pick = null;
      M.beats.forEach((b) => { if (b.x <= S.x + 1e-6 && S.x - b.x < 0.085) pick = b; });
      showBeat(pick, t);
    }
  }

  /* ---- the slow-downs: time dilates around each moment ---- */
  function speedAt(x, t) {
    let slow = 0;
    for (const b of M.beats) {
      if (!b.story) continue;
      const z = (x - b.x) / 0.02;
      if (z > -3 && z < 3) slow = Math.max(slow, Math.exp(-z * z));
    }
    let f = 1 - 0.5 * slow;
    // a caption still being read holds the clock back, and a queued one more so
    const fresh = gpClamp((t - S.beatT) / 1300, 0, 1);
    if (S.beat && S.beat.story) f *= 0.45 + 0.55 * gpSmooth(fresh);
    if (S.beatQ.length) f *= 0.3;
    return (span / (GP_T.PLAY / 1000)) * f;
  }

  /* ---- the clock ---- */
  function advance(dt, t) {
    S.prevX = S.x;
    switch (S.mode) {
      case "intro":
        if (t - T0 > GP_T.INTRO) rewind(t);
        break;
      case "rewind": {
        const u = Math.min(1, (t - S.modeT) / S.rw.dur);
        S.x = S.rw.from + (x0 - S.rw.from) * gpEaseIO4(u);
        if (u >= 1) {
          S.x = x0;
          setMode("hold", t);
          showBeat(M.beats.find((b) => b.kind === "start"), t);
          shock("alp", t, 1);
        }
        break;
      }
      case "hold":
        if (t - S.modeT > GP_T.HOLD) setMode("play", t);
        break;
      case "play":
        if (reduce) {
          if (t - S.stepT > 1100) {
            S.stepT = t;
            const i = Math.round(fiNow()) + 1;
            S.x = X[Math.min(n - 1, i)];
          }
        } else S.x = Math.min(x1, S.x + speedAt(S.x, t) * dt);
        if (S.x >= x1 - 1e-9) { S.x = x1; land(t); }
        break;
      case "coast":
        S.x += S.coast.v * dt;
        S.coast.v *= Math.exp(-3.4 * dt);
        if (S.x <= x0 || S.x >= x1) { S.x = gpClamp(S.x, x0, x1); S.coast.v = 0; }
        if (Math.abs(S.coast.v) < span * 0.05) glideTo(nearestX(S.x), t);
        break;
      case "glide":
        gpSpring(S.glide, S.glide.to, 95, 19, dt);
        S.x = gpClamp(S.glide.x, x0, x1);
        if (gpRest(S.glide, S.glide.to, span * 1e-4)) {
          S.x = S.glide.to; S.reelDirect = false;
          setMode("pause", t);
          announce();
        }
        break;
      case "outro": {
        const e = t - S.out.t0;
        gpSpring(S.glide, x1, 170, 26, dt);
        S.x = gpClamp(S.glide.x, x0, x1);
        S.shape = S.out.sh0 * (1 - gpEaseIO3(gpClamp((e - 150) / 380, 0, 1)));
        S.fl.x = S.out.fl0 * (1 - gpEaseIO3(gpClamp((e - 120) / 560, 0, 1)));
        if (e > GP_T.OUT) finish();
        break;
      }
      default:
        break;
    }
  }
  function land(t) {
    setMode("pause", t);
    S.ended = true;
    N.root.classList.add("gp-end");
    const tg = M.at(x1);
    S.beatQ = [];
    showBeat(M.beats.find((b) => b.kind === "end"), t);
    if (!reduce) {
      shock(tg.margin >= 0 ? "alp" : tg.oppId, t, 1.3);
      const bp = beadPage();
      burst(bp.x, bp.y, tg.margin >= 0 ? "alp" : tg.oppId, 30, 380);
      S.shimmer = t;
    }
    announce();
  }
  function flight(t, dt) {
    if (S.out) return;
    if (S.fl.x !== 1 || S.fl.v !== 0) {
      gpSpring(S.fl, 1, 72, 12.5, dt);
      if (gpRest(S.fl, 1, 2e-4)) { S.fl.x = 1; S.fl.v = 0; }
    }
    if (S.shape < 1) S.shape = gpEaseIO3(gpClamp((t - T0 - 240) / 640, 0, 1));
    if (!S.revealed && t - T0 > 380) { S.revealed = true; N.root.classList.add("gp-in"); }
  }

  /* ---- painting ---- */
  function flierTransform() {
    const p = S.fl.x;
    if (!G.mast || p === 1) return "none";
    const sx = G.left + G.pivX, sy = G.top + G.pivY;
    const dx = G.mast.x - sx, dy = G.mast.y - sy;
    const s0 = G.mast.k / 10 / G.k, q = 1 - p;
    // a drop and a swing rather than a straight line: the arc bows down first
    const cx = dx * 0.92, cy = dy * 0.1;
    const tx = q * q * dx + 2 * q * p * cx, ty = q * q * dy + 2 * q * p * cy;
    return "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + (s0 + (1 - s0) * p).toFixed(5) + ")";
  }
  function mastLens(vals) {
    const vs = GP_IDS.map((id) => vals[id]), lo = Math.min(...vs), hi = Math.max(...vs), out = {};
    GP_IDS.forEach((id) => {
      out[id] = hi === lo ? GP_MAST.maxH : GP_MAST.minH + ((vals[id] - lo) / (hi - lo)) * (GP_MAST.maxH - GP_MAST.minH);
    });
    return out;
  }
  function paintDial(tg, t) {
    const s = S.shape, lead = tg.margin >= 0 ? "alp" : tg.oppId;
    css(N.flier, "transform", flierTransform());
    // arc: the masthead's heavy half-tone strokes thin into the instrument's tint
    css(N.arc, "opacity", gpLerp(GP_MAST.arcOp, G.tint, s).toFixed(3));
    css(N.arc, "strokeWidth", gpLerp(GP_MAST.arcW, GP_LOOK.arcW, s).toFixed(2));
    css(N.arcB, "stroke", "var(--" + S.arcBase + ")");
    if (S.flood) {
      css(N.arcF, "stroke", "var(--" + S.flood.to + ")");
      css(N.arcF, "strokeDasharray", (gpEaseIO3(gpClamp(S.flood.u, 0, 1)) * 100).toFixed(2) + " 100");
      css(N.arcF, "opacity", "1");
    } else css(N.arcF, "opacity", "0");
    const sIn = gpClamp((s - 0.35) / 0.65, 0, 1);
    css(N.scale, "opacity", sIn.toFixed(3));
    // displayed angles blend from the exact reading (as the masthead draws it)
    // to the spring as the dial takes the stage, and back on the way home
    const nd = gpLerp(tg.deg, S.needle.x, s);
    const merc = Math.abs(nd) > 0.4 ? gpArc(Math.min(0, nd), Math.max(0, nd), GP.R) : "M0 0";
    att(N.merc, "d", merc);
    css(N.merc, "stroke", "var(--" + lead + ")");
    css(N.merc, "strokeWidth", gpLerp(GP_MAST.arcW, GP_LOOK.arcW, s).toFixed(2));
    css(N.merc, "opacity", sIn.toFixed(3));
    // the election's needle, dashed, once the dial has left it
    const ghostOn = S.mode !== "intro" && !S.out && S.x > x0 + span * 0.01 ? 1 : 0;
    att(N.ghost, "transform", "rotate(" + M.at(x0).deg.toFixed(2) + ")");
    css(N.ghost, "opacity", (ghostOn * sIn * 0.75).toFixed(3));
    // bars
    const ml = s < 1 ? mastLens(tg.vals) : null;
    const slotOf = {};
    tg.order.forEach((id, k) => { slotOf[id] = GP.SLOTS[k]; });
    const ring = gpSeparate(GP_IDS.map((id) => ({ id, a: gpLerp(slotOf[id], S.bars[id].a.x, s) })), GP.BAR_SEP * s);
    ring.forEach((b) => {
      const len = s < 1 ? gpLerp(ml[b.id], S.bars[b.id].l.x, s) : S.bars[b.id].l.x;
      const [ix, iy] = gpPolar(b.a, GP.SEAT), [ox, oy] = gpPolar(b.a, GP.SEAT + len);
      const el = N.bar[b.id];
      css(el, "strokeWidth", gpLerp(GP.BAR_W, GP_LOOK.barW, s).toFixed(2));
      att(el, "x1", ix.toFixed(2)); att(el, "y1", iy.toFixed(2));
      att(el, "x2", ox.toFixed(2)); att(el, "y2", oy.toFixed(2));
      G.tips[b.id] = { a: b.a, r: GP.SEAT + len };
    });
    // readings at the bar tips, pushed apart while two bars trade places
    const lop = gpClamp((s - 0.6) / 0.4, 0, 1);
    gpSeparate(ring.map((b) => ({ id: b.id, a: b.a })), GP.LABEL_SEP).forEach((b) => {
      const tip = G.tips[b.id], box = G.lb[b.id], el = N.bl[b.id];
      const rad = (b.a * Math.PI) / 180, sx = Math.sin(rad), cy = -Math.cos(rad);
      const R = tip.r * G.k + 6 + Math.abs(sx) * box.w * 0.5 + Math.abs(cy) * box.h * 0.5;
      css(el, "transform", "translate(" + (G.pivX + sx * R - box.w / 2).toFixed(1) + "px," + (G.pivY + cy * R - box.h / 2).toFixed(1) + "px)");
      css(el, "opacity", lop.toFixed(3));
      const txt = tg.vals[b.id].toFixed(1);
      if (el.__v !== txt) { el.__v = txt; el.lastChild.textContent = txt; }
    });
    // needle, bead, pivot
    const L = needleLen();
    att(N.needle, "transform", "rotate(" + nd.toFixed(3) + ")");
    att(N.nl, "y2", (-L).toFixed(2));
    css(N.nl, "strokeWidth", gpLerp(GP_MAST.needleW, GP_LOOK.needleW, s).toFixed(2));
    css(N.nl, "stroke", "var(--" + lead + ")");
    att(N.bead, "cy", (-L).toFixed(2));
    att(N.bead, "r", (gpLerp(GP_MAST.bead, GP_LOOK.bead, s) * (1 + 0.45 * gpClamp(S.bead.x, -0.4, 1.6))).toFixed(2));
    css(N.bead, "fill", "var(--" + lead + ")");
    att(N.pivot, "r", gpLerp(GP_MAST.pivot, GP_LOOK.pivot, s).toFixed(2));
    // the wake: where the needle has been in the last tenth of a second
    S.trail.push({ t, a: nd });
    while (S.trail.length > 2 && t - S.trail[0].t > 110) S.trail.shift();
    let amin = nd, amax = nd;
    S.trail.forEach((p) => { if (p.a < amin) amin = p.a; if (p.a > amax) amax = p.a; });
    if (amax - amin > 1 && s > 0.5) {
      const [ax, ay] = gpPolar(amin, L), [bx, by] = gpPolar(amax, L);
      att(N.wake, "d", "M0 0L" + ax.toFixed(1) + " " + ay.toFixed(1) + "A" + L + " " + L + " 0 0 1 " + bx.toFixed(1) + " " + by.toFixed(1) + "Z");
      css(N.wake, "fill", "var(--" + lead + ")");
      css(N.wake, "opacity", Math.min(0.24, (amax - amin) / 30).toFixed(3));
    } else css(N.wake, "opacity", "0");
    // shockwaves
    N.shk.forEach((el, i) => {
      const sh = S.shocks[i];
      if (!sh) { css(el, "opacity", "0"); return; }
      const u = gpClamp((t - sh.t0) / 1000, 0, 1), r = GP.R * (1.05 + 1.25 * gpEaseOut3(u) * sh.k);
      att(el, "d", "M" + (-r).toFixed(1) + " 0A" + r.toFixed(1) + " " + r.toFixed(1) + " 0 0 1 " + r.toFixed(1) + " 0");
      css(el, "stroke", "var(--" + sh.color + ")");
      css(el, "strokeWidth", (7 * Math.pow(1 - u, 1.5) + 0.6).toFixed(2));
      css(el, "opacity", (0.55 * Math.pow(1 - u, 1.7)).toFixed(3));
    });
  }

  function odo(el, v) {
    const u = Math.round(v * 10 * 1e4) / 1e4;
    const p0 = ((u % 10) + 10) % 10;
    const p1 = (Math.floor(u / 10) % 10) + Math.max(0, p0 - 9);
    const p2 = (Math.floor(u / 100) % 10) + Math.max(0, (u % 100) - 99);
    const r = el.__r || (el.__r = el.querySelectorAll(".gp-od > span"));
    css(r[0], "transform", "translateY(" + (-p2).toFixed(4) + "em)");
    css(r[1], "transform", "translateY(" + (-p1).toFixed(4) + "em)");
    css(r[2], "transform", "translateY(" + (-p0).toFixed(4) + "em)");
  }
  function paintRead(tg, t, dt) {
    const fe = S.reelDirect ? fiNow() : tg.fe;
    css(N.reel, "transform", "translateY(" + (-fe * 1.15).toFixed(4) + "em)");
    // a reel spinning through months blurs like one
    const vel = dt > 0 ? Math.abs(fe - S.fe) / dt : 0;
    S.fe = fe;
    const bl = reduce ? 0 : Math.round(gpClamp((vel - 6) / 7, 0, 2.5) * 4) / 4;
    if (bl !== S.blur) { S.blur = bl; css(N.reel, "filter", bl ? "blur(" + bl + "px)" : "none"); }
    const idx = Math.round(fe);
    if (idx !== S.idx) {
      S.idx = idx;
      N.wsub.textContent = F[idx].sub;
      cb.onIndex(idx);
    }
    odo(N.numA, tg.lab);
    odo(N.numB, tg.opp);
    if (N.sideB.dataset.opp !== tg.oppId) N.sideB.dataset.opp = tg.oppId;
    // the event tag rides above its pin while the playhead is just past it
    let ev = -1;
    M.events.forEach((e, i) => { if (e.x <= S.x + 1e-6 && S.x - e.x < 0.1) ev = i; });
    if (ev !== S.ev) {
      S.ev = ev;
      if (ev >= 0) {
        const e = M.events[ev];
        N.evText.textContent = e.label;
        const w = N.ev.offsetWidth, px = xPx(e.x);
        const left = gpClamp(px - 9, 0, Math.max(0, G.tl.w - w));
        css(N.ev, "transform", "translateX(" + left.toFixed(1) + "px)");
        N.ev.style.setProperty("--pin", (px - left).toFixed(1) + "px");
      }
      N.ev.classList.toggle("on", ev >= 0);
    }
  }

  function paintTimeline(tg, t) {
    const g = G.tlx, P = G.pal, tl = G.tl, dpr = G.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N.tl.width, N.tl.height);
    g.drawImage(G.stat, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xp = xPx(S.x), yp = yPx(tg.lab), y50 = yPx(50);
    // the polls
    const r0 = G.narrow ? 2.1 : 2.6;
    for (let i = 0; i < M.polls.length; i++) {
      const d = S.dots[i];
      if (d.s === 0) continue;
      const p = M.polls[i], q = G.dotsPx[i];
      let y = q.py, a = 0.8, r = r0;
      if (d.s === 1) { y -= (1 - gpBounce(d.t)) * 34; a *= Math.min(1, d.t * 5); }
      else if (d.s === 3) { y -= gpEaseOut3(d.t) * 18; a *= 1 - d.t; }
      if (S.shimmer > 0) {
        const ph = (t - S.shimmer) / 1100 - q.px / tl.w * 0.7;
        if (ph > 0 && ph < 0.3) { const w = Math.sin((ph / 0.3) * Math.PI); r *= 1 + w; a = Math.min(1, a + w * 0.2); }
      }
      g.fillStyle = gpRgba(p.v >= 50 ? P.alp : P[p.opp], a);
      g.beginPath(); g.arc(q.px, y, r, 0, 6.2832); g.fill();
    }
    // the term so far: the lead as a tint, the contest as a line coloured by challenger
    const tr = G.trace;
    let j = 0;
    while (j < tr.length && tr[j].x <= S.x) j++;
    if (j > 0) {
      g.save();
      g.beginPath(); g.rect(0, 0, tl.w, y50); g.clip();
      g.beginPath(); g.moveTo(tr[0].px, y50);
      for (let i = 0; i < j; i++) g.lineTo(tr[i].px, tr[i].py);
      g.lineTo(xp, yp); g.lineTo(xp, y50); g.closePath();
      g.fillStyle = gpRgba(P.alp, 0.085); g.fill();
      g.restore();
      g.lineWidth = G.narrow ? 2.2 : 2.6; g.lineJoin = "round"; g.lineCap = "round";
      let i = 0;
      while (i < j) {
        const id = tr[i].id;
        g.strokeStyle = gpRgba(P[id], 1);
        g.beginPath(); g.moveTo(tr[Math.max(0, i - 1)].px, tr[Math.max(0, i - 1)].py);
        while (i < j && tr[i].id === id) { g.lineTo(tr[i].px, tr[i].py); i++; }
        if (i >= j) g.lineTo(xp, yp);
        g.stroke();
      }
    }
    // the playhead
    const hx = Math.round(xp) + 0.5;
    g.strokeStyle = gpRgba(P.ink, 0.24); g.lineWidth = 1;
    g.beginPath(); g.moveTo(hx, tl.pt - 6); g.lineTo(hx, tl.pt + tl.ph); g.stroke();
    if (S.mode === "play" && !reduce) {
      const u = ((t - T0) % 1100) / 1100;
      g.strokeStyle = gpRgba(P[tg.oppId], 0.45 * (1 - u)); g.lineWidth = 1.5;
      g.beginPath(); g.arc(xp, yp, 5 + u * 9, 0, 6.2832); g.stroke();
    }
    g.fillStyle = gpRgba(P[tg.oppId], 1); g.strokeStyle = gpRgba(P.bg, 1); g.lineWidth = 2;
    g.beginPath(); g.arc(xp, yp, G.narrow ? 4.5 : 5.2, 0, 6.2832); g.fill(); g.stroke();
  }

  function paintFx(t) {
    const g = G.fxx, P = G.pal;
    if (!S.comets.length && !S.sparks.length) {
      if (G.fxDirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N.fx.width, N.fx.height); G.fxDirty = false; }
      return;
    }
    G.fxDirty = true;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N.fx.width, N.fx.height);
    g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g.lineCap = "round";
    const bp = beadPage();
    S.comets.forEach((c) => {
      const u = gpClamp((t - c.t0) / c.dur, 0, 1);
      const col = P[c.col];
      const pos = (v) => {
        const e = Math.pow(v, 1.7), q = 1 - e;
        const cx = c.sx + c.cx, cy = c.sy + c.cy;
        return [q * q * c.sx + 2 * q * e * cx + e * e * bp.x, q * q * c.sy + 2 * q * e * cy + e * e * bp.y];
      };
      let [px, py] = pos(u);
      for (let k = 1; k <= 7; k++) {
        const v = u - k * 0.03;
        if (v < 0) break;
        const [qx, qy] = pos(v);
        g.strokeStyle = gpRgba(col, 0.75 * (1 - k / 8));
        g.lineWidth = 2.6 * (1 - k / 9);
        g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke();
        px = qx; py = qy;
      }
      const [hx, hy] = pos(u);
      g.fillStyle = gpRgba(col, 1);
      g.beginPath(); g.arc(hx, hy, 2.2, 0, 6.2832); g.fill();
    });
    S.sparks.forEach((s) => {
      const a = Math.pow(1 - s.age / s.max, 1.2);
      g.strokeStyle = gpRgba(P[s.col], a);
      g.lineWidth = s.w;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 0.028, s.y - s.vy * 0.028); g.stroke();
    });
  }

  /* ---- the loop ---- */
  function busy(t) {
    if (S.mode !== "pause") return true;
    if (S.comets.length || S.sparks.length || S.shocks.length || S.flood || G.fxDirty) return true;
    if (S.shimmer > 0 && t - S.shimmer < 2000) return true;
    if (S.fl.x !== 1 || S.shape < 1) return true;
    if (!gpRest(S.needle, M.at(S.x).deg, 0.02) || !gpRest(S.bead, 0, 0.002)) return true;
    for (const id of GP_IDS) { const b = S.bars[id]; if (Math.abs(b.a.v) > 0.02 || Math.abs(b.l.v) > 0.02) return true; }
    if (S.dots.some((d) => d.s === 1 || d.s === 3)) return true;
    if (S.trail.length > 1 && t - S.trail[0].t < 120) return true;
    if (S.blur) return true;
    return false;
  }
  function frame(t) {
    raf = 0;
    if (dead) return;
    const dt = gpClamp((t - last) / 1000, 0, 1 / 20);
    last = t;
    advance(dt, t);
    if (dead || finished) return;
    flight(t, dt);
    const tg = M.at(S.x);
    physics(tg, dt, t);
    updDots(dt, t);
    updFx(dt, t);
    updBeats(t);
    paintDial(tg, t);
    paintRead(tg, t, dt);
    paintTimeline(tg, t);
    paintFx(t);
    if (busy(t)) raf = requestAnimationFrame(frame);
    else S.trail = [];
  }
  function wake() {
    if (!raf && !dead) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function announce() {
    const f = F[Math.round(M.fOf(S.x))], tg = M.at(S.x);
    cb.onAnnounce((f.label === "Now" ? "Now" : f.label + " " + f.year) + ": Labor " + tg.lab.toFixed(1) + ", " +
      GP_NAME[tg.oppId] + " " + tg.opp.toFixed(1) + ", two-party preferred.");
  }

  /* ---- input ---- */
  function takeOver(t) {
    S.userMoved = true;
    S.beatQ = [];
    if (S.mode === "intro") { S.fl.x = Math.max(S.fl.x, 0.999); }
  }
  function onDown(e, kind) {
    if (S.out || (e.button != null && e.button !== 0)) return;
    e.preventDefault();
    const t = performance.now();
    takeOver(t);
    const el = kind === "tl" ? N.time : N.when;
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
    S.drag = { id: e.pointerId, kind, el, y0: e.clientY, f0: fiNow(), samples: [] };
    S.reelDirect = kind === "reel";
    setMode("drag", t);
    onMove(e);
    wake();
  }
  function onMove(e) {
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    if (e.cancelable) e.preventDefault();
    let x;
    if (d.kind === "tl") x = pxX(e.clientX - G.tl.left);
    else x = M.xOfF(d.f0 - (e.clientY - d.y0) / G.lineH);
    S.x = gpClamp(x, x0, x1);
    const t = performance.now();
    d.samples.push({ t, x: S.x });
    while (d.samples.length > 2 && t - d.samples[0].t > 90) d.samples.shift();
    wake();
  }
  function onUp(e) {
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    try { d.el.releasePointerCapture(e.pointerId); } catch (_) { /* fine */ }
    S.drag = null;
    const t = performance.now(), sm = d.samples;
    let v = 0;
    if (sm.length > 1 && t - sm[sm.length - 1].t < 60) {
      const a = sm[0], b = sm[sm.length - 1];
      v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    }
    if (!reduce && Math.abs(v) > span * 0.35) { S.coast = { v }; setMode("coast", t); }
    else glideTo(nearestX(S.x), t);
    wake();
  }
  function onWheel(e) {
    if (S.out) return;
    e.preventDefault();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    S.wheelAcc += e.deltaMode === 1 ? d * 30 : d;
    if (Math.abs(S.wheelAcc) >= 44) { step(Math.sign(S.wheelAcc)); S.wheelAcc = 0; }
  }
  function step(dir) {
    if (S.out) return;
    const t = performance.now();
    takeOver(t);
    const from = S.mode === "glide" ? Math.round(M.fOf(S.glide.to)) : Math.round(fiNow());
    glideTo(X[gpClamp(from + dir, 0, n - 1)], t);
    wake();
  }
  const tlDown = (e) => onDown(e, "tl"), reelDown = (e) => onDown(e, "reel");
  N.time.addEventListener("pointerdown", tlDown);
  N.when.addEventListener("pointerdown", reelDown);
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  N.when.addEventListener("wheel", onWheel, { passive: false });
  N.time.addEventListener("wheel", onWheel, { passive: false });

  const onResize = () => { measure(); wake(); };
  window.addEventListener("resize", onResize);
  // the stage scrolls only on a very short screen; every cached rect moves with it
  N.root.addEventListener("scroll", onResize, { passive: true });
  const mo = new MutationObserver(() => { readTheme(); buildStatic(); wake(); });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) { measure(); wake(); } });

  function finish() {
    if (finished) return;
    finished = true;
    if (glyph) {
      glyph.style.opacity = "";
      // the mark takes the dial back with a small catch
      if (fly && glyph.animate) {
        glyph.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
                      { duration: 460, easing: "ease-out" });
      }
    }
    cb.onDone();
  }

  /* ---- start ---- */
  readTheme();
  measure();
  if (fly) glyph.style.opacity = "0";
  if (!fly) N.root.classList.add("gp-in");
  setMode(S.mode, T0);    // the replay is already under way while the dial flies in
  if (reduce || !fly) {
    S.ended = true;
    N.root.classList.add("gp-end");
    S.beat = M.beats.find((b) => b.kind === "end");
    cb.onBeat(S.beat);
  }
  frame(performance.now());

  return {
    toggle() {
      const t = performance.now();
      if (S.out) return;
      if (S.mode === "play" || S.mode === "rewind" || S.mode === "hold" || S.mode === "intro") {
        if (S.mode === "intro") S.fl.x = Math.max(S.fl.x, 0.999);
        S.userMoved = true;
        setMode("pause", t); announce();
      } else if (S.x >= x1 - 1e-6) this.replay();
      else { S.glide = null; S.coast = null; S.userMoved = false; S.reelDirect = false; setMode("play", t); }
      wake();
    },
    replay() {
      if (S.out) return;
      const t = performance.now();
      S.userMoved = false; S.reelDirect = false; S.ended = false;
      N.root.classList.remove("gp-end");
      if (reduce) { S.x = x0; S.stepT = t; setMode("play", t); showBeat(M.beats.find((b) => b.kind === "start"), t); }
      else rewind(t);
      wake();
    },
    step,
    home() { takeOver(); glideTo(x0, performance.now()); wake(); },
    end() { takeOver(); glideTo(x1, performance.now()); wake(); },
    close() {
      if (S.out || finished) return;
      const t = performance.now();
      N.root.dataset.phase = "leaving";
      cb.onPlaying(false);
      if (!fly) { S.out = { t0: t }; setTimeout(finish, reduce ? 0 : 200); return; }
      if (glyph) G.mast = mastFrom(glyph.getBoundingClientRect());
      S.out = { t0: t, fl0: S.fl.x, sh0: S.shape };
      S.glide = { x: S.x, v: 0, to: x1 };
      S.comets = [];
      S.mode = "outro";
      wake();
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      N.time.removeEventListener("pointerdown", tlDown);
      N.when.removeEventListener("pointerdown", reelDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      N.when.removeEventListener("wheel", onWheel);
      N.time.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      N.root.removeEventListener("scroll", onResize);
      mo.disconnect();
      if (glyph) glyph.style.opacity = "";
    },
  };
}

/* ====================================================================
   The stage.
   ==================================================================== */
function GpOdo({ cls }) {
  // three reels (tens, units, tenths), each 0-9 and a trailing 0 to roll into
  const reel = (k) => (
    <span className="gp-od" key={k}>
      <span>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => <i key={i}>{d}</i>)}</span>
    </span>
  );
  return <span className={"gp-num " + cls} aria-hidden="true">{reel(0)}{reel(1)}<span className="gp-pt">.</span>{reel(2)}</span>;
}

function GpBeat({ beat, out, late }) {
  // frozen at mount: changing the delay mid-animation would make the words skip
  const [held] = useState(late);
  let i = 0;
  const parts = [];
  beat.title.forEach((tok, k) => {
    if (!tok.t) return;
    if (tok.p) {
      parts.push(<span key={k} className="gp-w gp-pw" style={{ "--i": i++, color: "var(--" + tok.p + "-text)" }}>{tok.t}</span>);
      return;
    }
    tok.t.split(/(\s+)/).forEach((w, j) => {
      if (!w) return;
      if (/^\s+$/.test(w)) { parts.push(" "); return; }
      parts.push(<span key={k + "." + j} className="gp-w" style={{ "--i": i++ }}>{w}</span>);
    });
  });
  return (
    <div className={"gp-beat-in" + (out ? " out" : held ? " late" : "")}>
      <div className="gp-beat-t">{parts}</div>
      {beat.sub && <div className="gp-beat-s" style={{ "--i": i }}>{beat.sub}</div>}
    </div>
  );
}

function DialStory({ originRect, onClose }) {
  const D = window.AP.D;
  const M = useMemo(() => buildDialStory(D), []);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const N = useRef({ bl: {}, bar: {}, shk: [] }).current;
  const reg = (k) => (el) => { N[k] = el; };
  const engRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(M.n - 1);
  const [beat, setBeat] = useState(null);
  const [prevBeat, setPrevBeat] = useState(null);
  const [said, setSaid] = useState("");
  const beatRef = useRef(null);

  React.useLayoutEffect(() => {
    const eng = gpEngine(M, N, {
      onPlaying: setPlaying,
      onIndex: setIdx,
      onBeat: (b) => {
        const was = beatRef.current;
        beatRef.current = b;
        setPrevBeat(was && was !== b ? was : null);
        setBeat(b);
        if (b) setSaid(b.title.map((x) => x.t).join("") + (b.sub ? ". " + b.sub + "." : "."));
      },
      onAnnounce: setSaid,
      onDone: () => closeRef.current(),
    }, { reduce, origin: originRect });
    engRef.current = eng;
    return () => eng.destroy();
  }, []);

  // the outgoing caption clears itself once its exit has played
  useEffect(() => {
    if (!prevBeat) return undefined;
    const tm = setTimeout(() => setPrevBeat(null), 300);
    return () => clearTimeout(tm);
  }, [prevBeat]);

  // keys, focus, and the page held still underneath
  useEffect(() => {
    const eng = () => engRef.current;
    const onKey = (ev) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const onButton = ev.target instanceof Element && ev.target.closest("button");
      if (ev.key === "Escape") { ev.preventDefault(); eng().close(); return; }
      if (ev.key === "Tab") {
        const f = [...N.root.querySelectorAll("button, [tabindex='0']")].filter((el) => !el.disabled && el.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        const nx = ev.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        ev.preventDefault(); f[nx].focus();
        return;
      }
      if ((ev.key === " " || ev.key === "Enter") && onButton) return;   // the button's own click
      if (ev.key === " " || ev.key === "k" || ev.key === "K") { ev.preventDefault(); eng().toggle(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { ev.preventDefault(); eng().step(-1); }
      else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { ev.preventDefault(); eng().step(1); }
      else if (ev.key === "Home") { ev.preventDefault(); eng().home(); }
      else if (ev.key === "End") { ev.preventDefault(); eng().end(); }
      else if (ev.key === "r" || ev.key === "R") { ev.preventDefault(); eng().replay(); }
    };
    document.addEventListener("keydown", onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /* Focus starts on play/pause, not on close: Space is what a reader
       presses to stop a playing thing, and on a focused close button it
       would shut the replay instead. */
    N.playBtn && N.playBtn.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
    };
  }, []);

  const cur = M.frames[idx] || M.frames[M.n - 1];
  const valueText = (cur.label === "Now" ? "Now" : cur.label + " " + cur.year) + ": Labor " + cur.lab.toFixed(1) +
    ", " + GP_NAME[cur.oppId] + " " + cur.opp.toFixed(1) + ", two-party preferred";
  const [vx, vy, vw, vh] = M.VB;

  return (
    <div className="dl-backdrop gp" ref={reg("root")} role="dialog" aria-modal="true" aria-labelledby="gp-title">
      <div className="gp-paper" aria-hidden="true"></div>
      <h2 id="gp-title" className="sr-only">The term so far, replayed on the masthead dial</h2>

      <div className="gp-top">
        <div className="gp-eyebrow">
          <span className="gp-eyebrow-t">The term so far</span>
          <span className="gp-rwmark" aria-hidden="true">
            <svg viewBox="0 0 16 10" width="16" height="10"><path d="M8 0v10L0 5zM16 0v10L8 5z" fill="currentColor"></path></svg>
            Winding back
          </span>
          <span className="gp-count" ref={reg("count")}></span>
        </div>
        <button type="button" className="gp-x" ref={reg("closeBtn")} onClick={() => engRef.current.close()}
                aria-label="Close the replay" title="Close (Esc)">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"></path>
          </svg>
        </button>
      </div>

      <div className="gp-stage">
        <div className="gp-when" ref={reg("when")} aria-hidden="true" title="Drag or scroll to move through the months">
          <div className="gp-wline">
            <span className="gp-reelbox">
              <span className="gp-reel" ref={reg("reel")}>
                {M.frames.map((f, i) => (
                  <span key={i}>{f.label}{f.year && <em> {f.year}</em>}</span>
                ))}
              </span>
            </span>
          </div>
          <div className="gp-wsub" ref={reg("wsub")}></div>
        </div>

        <div className="gp-row">
          <div className="gp-side gp-side-a">
            <span className="gp-name"><i></i>Labor</span>
            <span ref={reg("numA")}><GpOdo cls="gp-num-a" /></span>
          </div>
          <div className="gp-dial">
            <div className="gp-dbox" ref={reg("dbox")} style={{ aspectRatio: vw + " / " + vh }}>
              <div className="gp-flier" ref={reg("flier")}>
                <svg className="gp-svg" viewBox={vx + " " + vy + " " + vw + " " + vh} aria-hidden="true">
                  <g className="gp-shocks">
                    {[0, 1, 2, 3].map((i) => <path key={i} className="gp-shock" ref={(el) => { N.shk[i] = el; }}></path>)}
                  </g>
                  <g className="gp-arc" ref={reg("arc")}>
                    <path className="gp-arc-a" d={gpArc(-90, 0, GP.R)}></path>
                    <path className="gp-arc-b" d={gpArc(0, 90, GP.R)} ref={reg("arcB")}></path>
                    <path className="gp-arc-f" d={gpArc(0, 90, GP.R)} pathLength="100" ref={reg("arcF")}></path>
                  </g>
                  <g className="gp-scale" ref={reg("scale")}>
                    {Array.from({ length: 13 }, (_, k) => -12 + k * 2).map((pts) => {
                      const d = gpDeg(pts), lv = pts === 0, mj = pts % 6 === 0;
                      const [ax, ay] = gpPolar(d, GP.R - 8 - (lv ? 26 : mj ? 17 : 9)), [bx, by] = gpPolar(d, GP.R - 8);
                      return <line key={pts} className={"gp-tick" + (lv ? " lv" : mj ? " mj" : "")} x1={ax} y1={ay} x2={bx} y2={by}></line>;
                    })}
                  </g>
                  <path className="gp-merc" ref={reg("merc")}></path>
                  <line className="gp-ghost" x1="0" y1="0" x2="0" y2={-GP_LOOK.needle} ref={reg("ghost")}></line>
                  {GP_IDS.map((id) => (
                    <line key={id} className="gp-bar" stroke={"var(--" + id + ")"}
                          ref={(el) => { N.bar[id] = el; }}></line>
                  ))}
                  <path className="gp-wake" ref={reg("wake")}></path>
                  <g ref={reg("needle")}>
                    <line className="gp-needle" x1="0" y1="0" x2="0" ref={reg("nl")}></line>
                    <circle className="gp-bead" cx="0" ref={reg("bead")}></circle>
                  </g>
                  <circle className="gp-pivot" cx="0" cy="0" ref={reg("pivot")}></circle>
                </svg>
                {GP_IDS.map((id) => (
                  <div key={id} className="gp-bl" ref={(el) => { N.bl[id] = el; }} aria-hidden="true">
                    <b style={{ color: "var(--" + id + "-text)" }}>{GP_ABBR[id]}</b><span>00.0</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="gp-side gp-side-b" ref={reg("sideB")}>
            <span className="gp-name gp-oppname">
              <span className="gp-opp-reel"><span data-id="lnp">Coalition<i></i></span><span data-id="onp">One Nation<i></i></span></span>
            </span>
            <span ref={reg("numB")}><GpOdo cls="gp-num-b" /></span>
          </div>
        </div>

        <div className="gp-beat" aria-hidden="true">
          {prevBeat && <GpBeat key={"o" + prevBeat.id} beat={prevBeat} out />}
          {beat && <GpBeat key={"b" + beat.id} beat={beat} late={!!prevBeat} />}
        </div>
      </div>

      <div className="gp-time" ref={reg("time")} role="slider" tabIndex={0}
           aria-label="Month" aria-valuemin={0} aria-valuemax={M.n - 1} aria-valuenow={idx} aria-valuetext={valueText}>
        <canvas className="gp-tl" ref={reg("tl")} aria-hidden="true"></canvas>
        <div className="gp-ev" ref={reg("ev")} aria-hidden="true"><span ref={reg("evText")}></span></div>
      </div>

      <div className="gp-ctl">
        <button type="button" className={"gp-play" + (playing ? " on" : "")} ref={reg("playBtn")} onClick={() => engRef.current.toggle()}
                aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause (Space)" : "Play (Space)"}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path className="gp-ic-play" d="M6.5 4.2v11.6L16 10z" fill="currentColor"></path>
            <path className="gp-ic-pause" d="M5.5 4.5h3v11h-3zM11.5 4.5h3v11h-3z" fill="currentColor"></path>
          </svg>
        </button>
        <button type="button" className="gp-btn gp-replay" onClick={() => engRef.current.replay()} title="Replay from the election (R)">
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
            <path d="M4.6 8.2A5.8 5.8 0 1 1 4.4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
            <path d="M3.6 3.9v4.8h4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
          Replay
        </button>
        <ul className="gp-key" aria-label="Key">
          <li><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
            <path d="M2 11V4M6 11V1M10 11V5M14 11V7" strokeWidth="2.6" style={{ stroke: "var(--ink-3)" }}></path></svg>First preferences</li>
          <li><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
            <path d="M8 11L5 2.6" strokeWidth="1.7" strokeLinecap="round" style={{ stroke: "var(--ink-3)" }}></path>
            <circle cx="5" cy="2.6" r="1.7" style={{ fill: "var(--ink-3)" }}></circle></svg>Two-party preferred</li>
          <li><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
            <path d="M8 11L11 2.6" strokeWidth="1.4" strokeDasharray="1.2 2" strokeLinecap="round" style={{ stroke: "var(--ink-3)" }}></path></svg>Election day</li>
          <li><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
            <circle cx="8" cy="6" r="2.6" style={{ fill: "var(--ink-3)" }}></circle></svg>One poll</li>
        </ul>
        <span className="gp-hint" aria-hidden="true">Space · ← → · Esc</span>
      </div>

      <canvas className="gp-fx" ref={reg("fx")} aria-hidden="true"></canvas>
      <div className="sr-only" aria-live="polite">{said}</div>
    </div>
  );
}

Object.assign(window, { DialStory, buildDialStory });
