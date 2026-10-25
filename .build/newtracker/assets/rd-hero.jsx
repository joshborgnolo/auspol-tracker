/* auspol tracker – the redesign's two-party section (Sep 2026).

   Hero (73de0c58) owns the state and the machinery: which contest, which
   basis, the morph clock that both switches run on, and the accessors that
   read each contest on each basis. This draws the redesign's layout from
   them: the figures and a lead-scale gauge centred under the masthead, the
   verdict in words, the method line with its "?", and a chart of Labor's
   share against BOTH rivals, the chosen contest drawn heavy with its dots
   and interval, the other as a thin line for comparison. */

const RD_RANGES = [{ id: "3", label: "3 mo" }, { id: "6", label: "6 mo" },
                   { id: "12", label: "12 mo" }, { id: "all", label: "All" }];

/* The lead and its margin on the lead's own scale: points either side of a
   tie, Labor's lead drawn to the LEFT, as the figures above read. The span is
   the lead plus or minus its 95% margin (on implied Labor v One Nation, its
   margin of polls and flows); a tie inside
   it is the verdict "too close to call", drawn. Plain boxes rather than svg
   geometry so the span and dot can travel on a CSS transition when the
   contest or basis changes, on the same curve the figures roll on. */
function rdGaugeSeed() {
  /* content width is min(1152, vw - 2*gutter) with gutter clamp(20,5vw,64),
     and the gauge caps at 760 - so this seed is exact on phones and on
     every desktop band, and at most a scrollbar's width out in the narrow
     tablet band. window.innerWidth is a viewport read: it does not force
     the layout a getBoundingClientRect here would, and THAT layout inside
     the first commit is what the boot window is made of. */
  const vw = (typeof window !== "undefined" && window.innerWidth) || 1280;
  const g = Math.min(64, Math.max(20, 0.05 * vw));
  return Math.min(760, Math.max(280, Math.min(1152, vw - 2 * g)));
}
/* the hero chart's own seed: same content column, no caps - the hero
   TrendChart fills it edge to edge, so this lets the engine skip its
   commit-time width read too (the one remaining forced layout there). */
function rdHeroChartSeed() {
  const vw = (typeof window !== "undefined" && window.innerWidth) || 1280;
  const g = Math.min(64, Math.max(20, 0.05 * vw));
  return Math.min(1152, vw - 2 * g);
}

/* ---- the lead dot's click hop, and its one-in-150 parachute jump ------- */
const rdClamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rdLerp = (a, b, u) => a + (b - a) * u;
const rdWin = (t, a, b) => rdClamp((t - a) / (b - a), 0, 1);
const rdOutCubic = (u) => 1 - (1 - u) ** 3;
const rdInOutSine = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const rdInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
/* a damped spring's step response: 0 until t = 0, then over and back to 1 */
function rdSpring(t, zeta, hz) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}

/* The everyday hop is ballistics with a cartoon's squash and stretch: a
   crouch, one arc under one gravity (slowing on the way up, quickening on
   the way down), a stretch that follows the speed, a squash on each landing,
   one rebound at a restitution of 0.42, a settle. It is sampled at 120 Hz
   into keyframes on the individual translate and scale properties, which
   WAAPI plays off the main thread without touching the dot's own transform
   (its centring); transform-origin 0 100% pivots the squash on its foot. Times
   in ms, the height in px. */
const RD_HOP = { crouch: 80, air: 380, contact: 55, e: 0.42, contact2: 40, settle: 165, h: 16 };
RD_HOP.ms = RD_HOP.crouch + RD_HOP.air * (1 + RD_HOP.e) + RD_HOP.contact + RD_HOP.contact2 + RD_HOP.settle;
RD_HOP.airborne = RD_HOP.crouch + RD_HOP.air;   // a click before the first landing waits for it
function rdHopAt(t) {
  const { crouch: C, air: A, contact: K, e: E, contact2: K2, h } = RD_HOP;
  const v0 = 4 * h / A, g = 8 * h / (A * A), A2 = A * E;
  const str = (v) => 0.8 * Math.abs(v) / v0;    // the stretch a speed earns
  let y = 0, d = 0;                             // d: squash < 0 < stretch
  if (t < C) d = -0.55 * rdOutCubic(t / C);
  else if (t < C + A) {
    const s = t - C;
    y = -(v0 * s - 0.5 * g * s * s);
    d = str(v0 - g * s) - 1.35 * Math.exp(-s / 18);
  } else if (t < C + A + K) {
    const u = (t - C - A) / K;
    d = 0.8 * Math.exp(-u * K / 9) - Math.sin(Math.PI * u);
  } else if (t < C + A + K + A2) {
    const s = t - C - A - K;
    y = -(E * v0 * s - 0.5 * g * s * s);
    d = str(E * v0 - g * s) - str(E * v0) * Math.exp(-s / 18);
  } else if (t < C + A + K + A2 + K2) {
    const u = (t - C - A - K - A2) / K2;
    d = str(E * v0) * Math.exp(-u * K2 / 9) - 0.45 * Math.sin(Math.PI * u);
  } else {
    const s = t - C - A - K - A2 - K2;
    d = 0.12 * Math.sin(2 * Math.PI * s / 115) * Math.exp(-s / 55);
  }
  const sy = d >= 0 ? 1 + 0.16 * d : 1 + 0.22 * d;
  return { y, sx: 1 / sy, sy };                 // area-true
}
let rdHopFrames = null;
function rdHopKeys() {
  if (rdHopFrames) return rdHopFrames;
  const n = Math.ceil(RD_HOP.ms * 0.12);
  rdHopFrames = [];
  for (let i = 0; i <= n; i++) {
    const s = rdHopAt((i / n) * RD_HOP.ms);
    rdHopFrames.push({ offset: i / n, translate: "0 " + s.y.toFixed(2) + "px",
                       scale: s.sx.toFixed(4) + " " + s.sy.toFixed(4) });
  }
  return rdHopFrames;
}

/* The one-in-150 click: the dot crouches and launches, and a stick figure
   sprouts from it - the dot is its head. It cartwheels to the top of its
   flight, flails as it starts to fall, pulls a chute in the dot's colour and
   sways down on a pendulum that dies away as it nears the gauge. It lands on
   the band, the canopy slumps and fades, it throws its arms up, and
   cannonballs back into its slot as the dot again, with a ripple.

   It flies in an overlay over the viewport (the hero's section clips its
   overflow: content-visibility). One rAF loop paints a pure function of time,
   rdChuteAt, so the flight is the same at any frame rate; the slot is re-read
   every frame while it is near the viewport, so a scroll or a contest switch
   mid-flight still brings the figure home.

   Figure space: the head's centre at the origin, y down, px. The canopy's
   skirt hangs 46 above the head, the swing's pivot 156 above it; the feet
   land on the band's top edge, 8 above the slot's centre. */
const RD_FIG = { sh: 13, hip: 29, ua: 9, fa: 9, th: 10, sn: 10, com: 24,
                 canW: 31, canH: 26, canY: -46, pivot: -156, ground: -8 };
/* poses, in degrees: [left shoulder, left elbow, right shoulder, right elbow,
   left hip, left knee, right hip, right knee]. A limb's first segment is
   measured from straight down, outward positive; an elbow bends on outward,
   a knee folds the shin back in. The head is big, so raised arms read only
   up and out, \o/ */
const RD_POSE = {
  launch: [118, 16, 118, 16, 14, 0, 14, 0],
  star: [100, 0, 100, 0, 30, 0, 30, 0],
  hang: [128, 22, 128, 22, 9, 8, 9, 8],
  ready: [72, 12, 72, 12, 9, 8, 9, 8],
  tada: [126, -4, 126, -4, 9, 8, 9, 8],
  spring: [96, 30, 96, 30, 30, 55, 30, 55],
  tuck: [40, 90, 40, 90, 50, 110, 50, 110],
};
const rdMixPose = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
function rdLimbs(p) {
  const at = (x, y, len, deg, side) => [x + side * len * Math.sin(deg * Math.PI / 180), y + len * Math.cos(deg * Math.PI / 180)];
  const S = [0, RD_FIG.sh], Hp = [0, RD_FIG.hip];
  const eL = at(0, RD_FIG.sh, RD_FIG.ua, p[0], -1), eR = at(0, RD_FIG.sh, RD_FIG.ua, p[2], 1);
  const kL = at(0, RD_FIG.hip, RD_FIG.th, p[4], -1), kR = at(0, RD_FIG.hip, RD_FIG.th, p[6], 1);
  return { N: [0, 6], S, Hp, eL, eR, kL, kR,
           hL: at(eL[0], eL[1], RD_FIG.fa, p[0] + p[1], -1), hR: at(eR[0], eR[1], RD_FIG.fa, p[2] + p[3], 1),
           fL: at(kL[0], kL[1], RD_FIG.sn, p[4] - p[5], -1), fR: at(kR[0], kR[1], RD_FIG.sn, p[6] - p[7], 1) };
}
const rdFootY = (p) => { const L = rdLimbs(p); return Math.max(L.fL[1], L.fR[1]); };

/* the flight's timetable, in seconds, from where the dot sits on screen: the
   top of the flight about 120px under the viewport's top (220 to 640 above
   the slot), the rise under one gravity, a quarter-second's fall before the
   pull, and a descent rate that puts the feet on the band after D seconds */
function rdChutePlan(vy, rnd) {
  const H = rdClamp(vy - 120, 220, 640);
  const rise = rdClamp(0.62 + H / 1400, 0.72, 1);
  const g = 2 * H / (rise * rise);
  const C = 0.16, ta = C + rise, tdep = ta + 0.24, ts = tdep + 0.1, k = 0.14;
  const D = rdClamp(1.4 + H / 250, 2, 3.8);
  const ys = -H + 0.5 * g * (ts - ta) ** 2, vs = g * (ts - ta);
  const ek = k * (1 - Math.exp(-D / k));
  const Vd = (RD_FIG.ground - rdFootY(RD_POSE.hang) - ys - vs * ek) / (D - ek);
  const ttd = ts + D, tcb = ttd + 0.9;
  const gc = 1600, yst = RD_FIG.ground - rdFootY(RD_POSE.spring), v0c = Math.sqrt(2 * gc * 10);
  const tland = tcb + v0c / gc + Math.sqrt(2 * (10 - yst) / gc);
  const sign = () => (rnd() < 0.5 ? -1 : 1);
  return { H, rise, g, C, ta, tdep, ts, k, ys, vs, Vd, D, ttd, tcb, gc, yst, v0c, tland, end: tland + 0.55,
           spin: sign(), sway: sign(), drop: sign(), wind: sign() };
}

/* the scene at time t: the rig's offset from the slot (ox, oy), its swing
   (sw, about the pivot), the figure's own turn (fr, about fpx/fpy), the
   pose, how far the limbs have sprouted (sc), the head's squash, the canopy */
function rdChuteAt(P, t) {
  const s = { ox: 0, oy: 0, sw: 0, fr: 0, fpx: 0, fpy: 0, pose: RD_POSE.hang, sc: 1, hsx: 1, hsy: 1, can: null, ripple: -1 };
  let d = 0;                                    // the head's squash < 0 < stretch
  if (t < P.C) {                                // the crouch
    s.sc = 0;
    d = -1.1 * rdOutCubic(t / P.C);
  } else if (t < P.ta) {                        // the launch, sprouting, a cartwheel to the top
    const tau = t - P.C, u = tau / P.rise;
    s.oy = -P.H * (1 - (1 - u) ** 2);
    d = 0.9 * (1 - u) - 2 * Math.exp(-tau / 0.03);
    s.sc = rdSpring(tau - 0.02, 0.5, 4.4);
    s.pose = rdMixPose(RD_POSE.launch, RD_POSE.star, rdInOutSine(rdWin(u, 0.35, 0.72)));
    s.fr = P.spin * 360 * rdInOutSine(rdWin(u, 0.3, 1));
    s.fpy = RD_FIG.com;
  } else if (t < P.ts) {                        // over the top: a flail, then the pull
    const tau = t - P.ta, w = 2 * Math.PI * 5.5 * tau;
    s.oy = -P.H + 0.5 * P.g * tau * tau;
    const flail = [118 + 30 * Math.sin(w), 40 + 25 * Math.sin(w + 1), 118 - 30 * Math.sin(w), 40 - 25 * Math.sin(w + 1),
                   22 + 12 * Math.sin(w + 0.6), 30 + 30 * Math.sin(w + 2), 22 - 12 * Math.sin(w + 0.6), 30 - 30 * Math.sin(w + 2)];
    s.pose = rdMixPose(rdMixPose(RD_POSE.star, flail, rdInOutSine(rdWin(tau, 0, 0.08))), RD_POSE.hang, rdInOutSine(rdWin(t, P.tdep, P.ts)));
  } else if (t < P.ttd) {                       // under the canopy
    const tau = t - P.ts, u = tau / P.D, w = 2 * Math.PI / 1.85;
    s.oy = P.ys + P.Vd * tau + (P.vs - P.Vd) * P.k * (1 - Math.exp(-tau / P.k));
    const env = (1 - Math.exp(-tau / 0.2)) * (1 - u) ** 1.5;
    s.sw = P.sway * 17 * env * Math.sin(w * tau);
    s.ox = P.wind * 12 * Math.sin(Math.PI * u) ** 2;
    s.fr = -P.sway * 5 * env * Math.sin(w * tau - 0.9);       // the body trails the swing
    const kick = Math.sin(Math.PI * rdWin(u, 0.3, 0.6)), kw = Math.sin(2 * Math.PI * 2.4 * tau);
    const p = RD_POSE.hang.slice();
    p[4] += 7 * env * Math.sin(w * tau - 1.5) + 14 * kick * Math.max(0, kw);
    p[5] += 45 * kick * Math.max(0, kw);
    p[6] += -6 * env * Math.sin(w * tau - 1.2) + 14 * kick * Math.max(0, -kw);
    p[7] += 45 * kick * Math.max(0, -kw);
    s.pose = p;
  } else if (t < P.tcb) {                       // touchdown: knees take it, arms out, up, then a crouch to spring
    const tau = t - P.ttd, b = 55 * (tau / 0.08) * Math.exp(1 - tau / 0.08);
    const p = rdMixPose(rdMixPose(rdMixPose(RD_POSE.hang, RD_POSE.ready, rdInOutSine(rdWin(tau, 0, 0.15))),
                                  RD_POSE.tada, rdInOutSine(rdWin(tau, 0.25, 0.45))), RD_POSE.spring, rdInOutSine(rdWin(tau, 0.62, 0.9)));
    p[4] += 0.6 * b; p[5] += b; p[6] += 0.6 * b; p[7] += b;
    s.pose = p;
    s.oy = RD_FIG.ground - rdFootY(p);
  } else if (t < P.tland) {                     // the cannonball home
    const tau = t - P.tcb, v0 = P.v0c;
    s.oy = P.yst - v0 * tau + 0.5 * P.gc * tau * tau;
    s.sc = 1 - rdWin(tau, 0, 0.24) ** 3;
    s.pose = rdMixPose(RD_POSE.spring, RD_POSE.tuck, rdInOutSine(rdWin(tau, 0, 0.12)));
    s.fr = P.spin * 360 * rdInOutSine(rdWin(tau, 0, 0.32));
    const v = P.gc * tau - v0;
    if (v > 0) d = 0.5 * v / (P.gc * (P.tland - P.tcb) - v0);
  } else {                                      // the splash: the fall's stretch turns to squash, and wobbles out
    const tau = t - P.tland;
    s.sc = 0;
    d = 0.5 * Math.exp(-tau / 0.009) - 1.1 * (1 - Math.exp(-tau / 0.008)) * Math.exp(-tau / 0.09) * Math.cos(2 * Math.PI * 3.6 * tau);
    s.ripple = tau;
  }
  if (t >= P.tdep) {                            // the canopy: a streamer, a bloom, a breath
    const c = t - P.tdep, can = { x: 0, y: RD_FIG.canY, r: 0, sx: 1, sy: 1, o: 1, slack: 0 };
    if (c < 0.12) {
      const u = rdOutCubic(c / 0.12);
      can.y = rdLerp(8, RD_FIG.canY + 6, u); can.sx = 0.18; can.sy = rdLerp(0.2, 1.05, u);
    } else {
      const e = c - 0.12, br = Math.sin(2 * Math.PI * c / 0.95) * rdWin(c, 0.4, 1);
      can.sx = rdLerp(0.18, 1, rdSpring(e, 0.4, 2.8)) * (1 + 0.03 * br);
      can.sy = rdLerp(1.05, 1, rdSpring(e, 0.45, 3)) * (1 - 0.025 * br);
      can.y = rdLerp(RD_FIG.canY + 6, RD_FIG.canY, rdSpring(e, 0.6, 3));
    }
    if (t >= P.ttd) {                           // spilled: it slumps to one side and fades
      const tau = t - P.ttd, p = rdInOutCubic(rdWin(tau, 0, 0.85));
      can.x = P.drop * 34 * p; can.y = rdLerp(RD_FIG.canY, -10, p); can.r = P.drop * 80 * p ** 1.3;
      can.sx *= 1 - 0.3 * p; can.sy *= 1 - 0.72 * p;
      can.o = 1 - rdInOutSine(rdWin(tau, 0.3, 0.85)); can.slack = p;
    }
    if (can.o > 0) s.can = can;
  }
  s.hsy = d >= 0 ? 1 + 0.25 * d : 1 + 0.3 * d;
  s.hsx = 1 / s.hsy;
  return s;
}

/* Fly the figure from the dot `dot`, in the colour colOf() returns; done()
   runs when it is home. Returns { stop } to end it early. */
function rdChute(dot, colOf, done) {
  const NS = "http://www.w3.org/2000/svg";
  const box = document.createElement("div");
  box.className = "rd-chute";
  box.setAttribute("aria-hidden", "true");
  /* the canopy: seven skirt points round a hemisphere seen side on, so six
     gores narrowing to the edges, their hems scalloped up between the lines */
  const SK = [-90, -60, -30, 0, 30, 60, 90].map((a) => RD_FIG.canW * Math.sin(a * Math.PI / 180));
  const mer = (x, flag, to) => (Math.abs(x) < 0.01 ? "L " + to : "A " + Math.abs(x).toFixed(2) + " " + RD_FIG.canH + " 0 0 " + flag + " " + to);
  let gores = "";
  for (let i = 0; i < 6; i++) {
    const a = SK[i], b = SK[i + 1];
    gores += '<path class="rd-chute-gore' + (i % 2 ? " alt" : "") + '" d="M 0 ' + -RD_FIG.canH
      + " " + mer(b, b > 0 ? 1 : 0, b.toFixed(2) + " 0")
      + " Q " + ((a + b) / 2).toFixed(2) + " -4.5 " + a.toFixed(2) + " 0 "
      + mer(a, a > 0 ? 0 : 1, "0 " + -RD_FIG.canH) + ' Z"/>';
  }
  box.innerHTML = '<svg xmlns="' + NS + '"><g class="rd-chute-fx"></g><g class="rd-chute-rig">'
    + '<g class="rd-chute-can">' + gores + '</g><path class="rd-chute-lines"/>'
    + '<path class="rd-chute-halo"/><path class="rd-chute-body"/>'
    + '<ellipse class="rd-chute-ring"/><ellipse class="rd-chute-head"/></g></svg>';
  document.body.appendChild(box);
  const q = (c) => box.querySelector(".rd-chute-" + c);
  const fx = q("fx"), rig = q("rig"), canG = q("can"), lines = q("lines"), halo = q("halo"), body = q("body"),
        ring = q("ring"), head = q("head");
  const mk = (tag, cls) => { const el = document.createElementNS(NS, tag); el.setAttribute("class", "rd-chute-" + cls); fx.appendChild(el); return el; };
  /* a puff of dust off the band at take-off, three streaks under the launch,
     a ripple at the splash */
  const dust = [0, 1, 2, 3, 4, 5].map((i) => ({ el: mk("circle", "dust"), a: (i < 3 ? -1 : 1) * (12 + (i % 3) * 22) * Math.PI / 180,
                                                  v: 70 + ((i * 37) % 50), r: 1.3 + (i % 3) * 0.55 }));
  const streaks = [[-6, 0.07, 0.32], [0, 0.11, 0.45], [6, 0.08, 0.28]].map(([dx, lag, o]) => ({ el: mk("line", "streak"), dx, lag, o }));
  const rip = mk("circle", "ripple");

  let r = dot.getBoundingClientRect();
  let ax = r.left + r.width / 2, ay = r.top + r.height / 2, scx = window.scrollX, scy = window.scrollY;
  const P = rdChutePlan(ay, Math.random);
  const f2 = (v) => v.toFixed(2);
  const show = (el, on) => { el.style.display = on ? "" : "none"; return on; };
  let col = null;
  function paint(t) {
    /* the slot: read while it is near the viewport (a far one may sit in
       skipped content), otherwise carried along by the scroll */
    const px = ax + scx - window.scrollX, py = ay + scy - window.scrollY;
    scx = window.scrollX; scy = window.scrollY;
    if (py > -300 && py < window.innerHeight + 300) {
      r = dot.getBoundingClientRect();
      ax = r.left + r.width / 2; ay = r.top + r.height / 2;
    } else { ax = px; ay = py; }
    const c = colOf();
    if (c !== col) { col = c; box.style.setProperty("--chute", c); }
    const s = rdChuteAt(P, t);
    rig.setAttribute("transform", "translate(" + f2(ax + s.ox) + " " + f2(ay + s.oy) + ") rotate(" + f2(s.sw) + " 0 " + RD_FIG.pivot + ")");
    /* the figure: the pose's limbs, sprouted by sc and turned by fr */
    const L = rdLimbs(s.pose), rad = s.fr * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    const fpx = s.fpx * s.sc, fpy = s.fpy * s.sc;
    const T = (p) => { const x = p[0] * s.sc - fpx, y = p[1] * s.sc - fpy; return [fpx + x * cs - y * sn, fpy + x * sn + y * cs]; };
    const pt = (p) => { const v = T(p); return f2(v[0]) + " " + f2(v[1]); };
    const d = s.sc < 0.02 ? "" : "M" + pt(L.N) + "L" + pt(L.Hp)
      + "M" + pt(L.hL) + "L" + pt(L.eL) + "L" + pt(L.S) + "L" + pt(L.eR) + "L" + pt(L.hR)
      + "M" + pt(L.fL) + "L" + pt(L.kL) + "L" + pt(L.Hp) + "L" + pt(L.kR) + "L" + pt(L.fR);
    body.setAttribute("d", d); halo.setAttribute("d", d);
    const hc = T([0, 0]), hcy = hc[1] + 8 * (1 - s.hsy);  // squashed on its foot
    [[head, 8], [ring, 10]].forEach(([el, rr]) => {
      el.setAttribute("cx", f2(hc[0])); el.setAttribute("cy", f2(hcy));
      el.setAttribute("rx", f2(rr * s.hsx)); el.setAttribute("ry", f2(rr * s.hsy));
    });
    /* the canopy, and its lines from the hem to the hands */
    show(canG, !!s.can);
    show(lines, !!s.can);
    if (s.can) {
      const k = s.can, kr = k.r * Math.PI / 180, hL = T(L.hL), hR = T(L.hR);
      canG.setAttribute("transform", "translate(" + f2(k.x) + " " + f2(k.y) + ") rotate(" + f2(k.r) + ") scale(" + f2(k.sx) + " " + f2(k.sy) + ")");
      canG.style.opacity = lines.style.opacity = f2(k.o);
      let lp = "";
      SK.forEach((x, i) => {
        const kx = k.x + x * k.sx * Math.cos(kr), ky = k.y + x * k.sx * Math.sin(kr);
        (i < 3 ? [hL] : i > 3 ? [hR] : [hL, hR]).forEach((h) => {   // the middle line splits to both hands
          lp += "M" + f2(kx) + " " + f2(ky) + "Q" + f2((kx + h[0]) / 2) + " " + f2((ky + h[1]) / 2 + 14 * k.slack) + " " + f2(h[0]) + " " + f2(h[1]);
        });
      });
      lines.setAttribute("d", lp);
    }
    const tl = t - P.C;
    dust.forEach((p) => {
      if (!show(p.el, tl > 0 && tl < 0.45)) return;
      const dist = p.v * 0.12 * (1 - Math.exp(-tl / 0.12));
      p.el.setAttribute("cx", f2(ax + Math.sin(p.a) * dist + (p.a < 0 ? -6 : 6)));
      p.el.setAttribute("cy", f2(ay + 8 - Math.cos(p.a) * dist * 0.35));
      p.el.setAttribute("r", f2(p.r * (1 + tl)));
      p.el.style.opacity = f2(0.55 * (1 - tl / 0.45));
    });
    const yAt = (tt) => (tt <= P.C ? 0 : -P.H * (1 - (1 - (tt - P.C) / P.rise) ** 2)), foot = 52 * Math.min(1, s.sc);
    streaks.forEach((k) => {
      if (!show(k.el, tl > 0 && tl < 0.5 * P.rise)) return;
      const y1 = ay + s.oy + foot, y2 = Math.max(y1, ay + Math.min(yAt(t - k.lag) + foot, 0));
      k.el.setAttribute("x1", f2(ax + s.ox + k.dx)); k.el.setAttribute("x2", f2(ax + s.ox + k.dx));
      k.el.setAttribute("y1", f2(y1)); k.el.setAttribute("y2", f2(y2));
      k.el.style.opacity = f2(k.o * (1 - tl / (0.5 * P.rise)));
    });
    if (show(rip, s.ripple >= 0 && s.ripple < 0.5)) {
      const u = s.ripple / 0.5;
      rip.setAttribute("cx", f2(ax)); rip.setAttribute("cy", f2(ay));
      rip.setAttribute("r", f2(10 + 16 * rdOutCubic(u)));
      rip.style.opacity = f2(0.7 * (1 - u));
      rip.style.strokeWidth = f2(1.8 * (1 - u) + 0.4);
    }
  }
  /* the dot hides under the figure's head for the flight; the clock steps
     at most 50ms a frame, so a backgrounded tab resumes, not skips */
  let raf = 0, clock = 0, last = 0, over = false;
  const stop = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    box.remove();
    dot.style.opacity = "";
    if (done) done();
  };
  const tick = (now) => {
    clock += Math.min(50, now - last);
    last = now;
    if (!dot.isConnected || clock >= P.end * 1000) return stop();
    paint(clock / 1000);
    raf = requestAnimationFrame(tick);
  };
  paint(0);
  dot.style.opacity = "0";
  raf = requestAnimationFrame((now) => { last = now; tick(now); });
  return { stop };
}

function RdLeadGauge({ lead, margin, aName, bName, aColor, bColor }) {
  const ref = React.useRef(null);
  /* seeded, never unmeasured: the frames one and two of this strip are the
     boot window, and a wrong-width paint is both rarer and smaller with a
     viewport seed than with a 0/760 fallback the observer must then fix */
  const [w, setW] = React.useState(rdGaugeSeed);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return undefined;
    /* the observer's own measurement, not a rect read: a read here forced
       a layout whenever an earlier callback in the delivery had written */
    const fit = (entries) => {
      const box = entries && entries[0] && entries[0].borderBoxSize && entries[0].borderBoxSize[0];
      setW(Math.min(760, (box ? box.inlineSize : el.parentElement.getBoundingClientRect().width) || 760));
    };
    /* no synchronous fit() here - reading the parent's rect inside the
       first commit forces a full-document layout. Any seed correction the
       observer's initial callback carries lands one frame later instead. */
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);
  /* mounts collapsed on the tie and settles out, like the old gauge's mercury */
  const [settled, setSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    if (settled) return undefined;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  const cx = w / 2;
  const unit = Math.min(28, (cx - 49) / 10);            // px per point
  const dom = (cx - 8) / unit;
  const cl = (v) => Math.max(-dom, Math.min(dom, v));
  const X = (v) => cx - cl(v) * unit;                   // a Labor lead travels left
  const lo = margin != null ? lead - margin : lead, hi = margin != null ? lead + margin : lead;
  const col = lead >= 0 ? aColor : bColor;
  const L = settled ? X(hi) : cx, R = settled ? X(lo) : cx, P = settled ? X(lead) : cx;
  /* idle-click Easter egg: the dot hops on a click (rdHopKeys); about one
     click in 150 it jumps with a parachute instead (rdChute). Both drive the
     dot's element directly, never a re-render, so it keeps a keyboard user's
     focus; a click while it is still in the air waits for the landing. */
  const dotRef = React.useRef(null);
  const colRef = React.useRef(col);
  colRef.current = col;
  const hopRef = React.useRef({ t: -1e9, anim: null, chute: null });
  React.useEffect(() => () => { if (hopRef.current.chute) hopRef.current.chute.stop(); }, []);
  const boing = () => {
    const el = dotRef.current, h = hopRef.current, now = performance.now();
    if (REDUCED_MOTION || !el || h.chute || now - h.t < RD_HOP.airborne) return;
    h.t = now;
    if (h.anim) { h.anim.cancel(); h.anim = null; }
    if (Math.random() < 1 / 150) h.chute = rdChute(el, () => colRef.current, () => { h.chute = null; h.t = -1e9; });
    else if (el.animate) h.anim = el.animate(rdHopKeys(), { duration: RD_HOP.ms });
  };
  const sideX = Math.max(0, cx - 10 * unit - 56);
  const say = aName + (lead >= 0 ? " ahead by " : " behind by ") + Math.abs(lead).toFixed(1) + " points"
    + (margin != null ? ", give or take " + margin.toFixed(1) + (lo <= 0 && hi >= 0 ? ": a tie is inside that range." : ": a tie is outside that range.") : ".");
  return (
    <div className="rd-lg" ref={ref} style={{ width: w }} role="img" aria-label={say} title={say}>
      <span className="rd-lg-side" style={{ left: sideX, color: inkOf(aColor) }}>◀ {aName} ahead</span>
      <span className="rd-lg-side" style={{ right: sideX, color: inkOf(bColor) }}>{bName} ahead ▶</span>
      {[-10, -5, 5, 10].map((v) => <span key={v} className="rd-lg-grid" style={{ left: X(v) }}></span>)}
      <span className="rd-lg-tie" style={{ left: cx }}></span>
      {margin != null && (
        <>
          <span className="rd-lg-span" style={{ left: L, width: Math.max(0, R - L), background: col }}></span>
          <span className="rd-lg-cap" style={{ left: L, background: col }}></span>
          <span className="rd-lg-cap" style={{ left: R, background: col }}></span>
        </>
      )}
      <span
        ref={dotRef}
        className="rd-lg-dot"
        style={{ left: P, background: col }}
        onClick={boing}
        role="button" tabIndex={0} aria-label="Bounce"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boing(); } }}
      ></span>
      {[-10, -5, 5, 10].map((v) => (
        <span key={"t" + v} className="rd-lg-tick" style={{ left: X(v) }}>{Math.abs(v) === 10 && unit >= 20 ? "10 pts" : Math.abs(v)}</span>
      ))}
      <span className="rd-lg-tick rd-lg-tied" style={{ left: cx }}>Tied</span>
    </div>
  );
}

function RdHero(p) {
  const { rangeId, setRangeId, matchup, basis, morph, chooseMatchup, chooseBasis, orderedMatchups,
          latest, unc, monthDelta, leadSwing, impOffered, impOnOffered, impBasis, impOnBasis, adjusted,
          iDataOf, iScatOf, showScatter, showSynth, setShowSynth, otherContests, xDomain, domainRef } = p;
  const { D, filterPts, blendRows, mixC, blendDomain, monthLabelFull } = window.AP;
  /* /vic/'s lines are a Kalman smoother's trend through every poll (gen-data
     §1a), its figures the trend's own; only the published Labor v One Nation,
     too thin to adjust, stays a plain monthly average */
  const KAL = !!(D.latest.method && D.latest.method.kind === "kalman");
  const lineWord = (contest, basis) => (KAL && !(contest === "alp_on" && basis === "resp") ? "trend" : "monthly average");
  const M = window.AP.tppMatchups;
  const m = M[matchup];
  const narrow = useNarrow(MQ_PHONE);
  const b0 = basis || "imp";

  /* ---- the figures and the words under them ---------------------------- */
  const lead = +(latest.a - latest.b).toFixed(1);
  const margin = unc ? +(2 * unc.ci95).toFixed(1) : null;       // on the lead's scale
  const leader = lead > 0 ? m.a.name : lead < 0 ? m.b.name : null;
  const tooClose = margin != null && Math.abs(lead) <= margin;
  /* The implied Labor v One Nation margin has two parts, the polls' sampling
     error and the doubt about the flow table, added in quadrature (gen-data
     §7f). The verdict is judged on the whole and keeps the Coalition
     verdict's shape, so a switch between the contests never changes its
     line count (a "(polls ±3.4, flows ±2.8)" tail wrapped it at 480-600px);
     the parts are named in the term's title, the "?" panel, the key and the
     chart's tooltip. */
  const partsOf = (u) => (u && u.flows && u.cs != null && u.cf != null
    ? { cs: +(2 * u.cs).toFixed(1), cf: +(2 * u.cf).toFixed(1) } : null);
  const parts = partsOf(unc);
  const marginTerm = parts
    ? <RdTerm id="fp-flows" from="two-party preferred"
        title={"Polls ±" + parts.cs.toFixed(1) + " and flows ±" + parts.cf.toFixed(1) + ": the polls’ sampling error and the doubt about the flow table, together"}>margin</RdTerm>
    : <RdTerm id="margin-of-error" from="two-party preferred" title="What a margin of error means">margin</RdTerm>;
  const leadWords = Math.abs(lead).toFixed(1) + "-point lead";
  const verdict = margin == null
    ? <><b>{leader ? leader + " ahead." : "Tied."}</b>{leader ? " " + (leader === m.a.name ? m.a.name : m.b.name) + " leads by " + Math.abs(lead).toFixed(1) + " points." : ""}</>
    : tooClose
      ? <><b>Too close to call.</b> {leader ? leader + "’s " + leadWords + " is inside the ±" + margin.toFixed(1) + " " : "The two are level, inside the ±" + margin.toFixed(1) + " "}{marginTerm}.</>
      : <><b>{leader} ahead.</b> Its {leadWords} is outside the ±{margin.toFixed(1)} {marginTerm}.</>;
  const sig = unc ? unc.changeSig : undefined;
  const moved = Math.abs(monthDelta) >= 0.05;
  const change = (
    <>
      {m.a.name} {moved ? <>{rdArrow(monthDelta)} <RollNum value={Math.abs(monthDelta).toFixed(1)} /> on a month ago</> : "unchanged on a month ago"}
      {moved && sig === false && <>, within the <RdTerm id="margin-of-error" from="two-party preferred">margin</RdTerm></>}
      {moved && sig === true && <>, a significant {monthDelta > 0 ? "rise" : "fall"}</>}
      {leadSwing != null && Math.abs(leadSwing) >= 0.05 && <>, <span className="rd-tpp-swing">{rdArrow(leadSwing)} {Math.abs(leadSwing).toFixed(1)} since the {rdElecYear} election</span></>}
    </>
  );
  const hasBases = (matchup === "alp_lnp" && impOffered) || (matchup === "alp_on" && impOnOffered);
  const onImp = hasBases && b0 === "imp";
  /* a phone's words are the short ones either way, so flipping the basis
     keeps the line to one line */
  const basisWords = !hasBases ? (m.real ? "Pollsters’ published figures" : "Published head-to-heads")
    : onImp ? (narrow ? "Implied flows" : "Implied preference flows") : (narrow ? "As published" : "Pollsters’ published figures");
  const provenance = (
    <>
      {KAL && adjusted ? (
        <>{basisWords}, <RdTerm id="weighted-aggregate" from="two-party preferred" title="What the smoothed trend means">smoothed trend</RdTerm>
          {unc && <>{" "}of {unc.n} polls to {rdDate(D.latest.updatedISO)}</>}</>
      ) : (<>
      {basisWords}, <RdTerm id={adjusted ? "weighted-aggregate" : "monthly-average"} from="two-party preferred"
        title={"What " + (adjusted ? "a weighted aggregate" : "a monthly average") + " means"}>
        {adjusted ? "weighted aggregate" : "monthly average"}</RdTerm>
      {unc && <>{" "}of {unc.n} poll{unc.n === 1 ? "" : "s"} {narrow ? "to " : "in the " + D.latest.method.windowDays + " days to "}{rdDate(D.latest.updatedISO)}</>}
      </>)}
    </>
  );
  /* what the other basis would say, quoted in the "?" before anyone switches */
  const other = hasBases ? tppLatest(matchup, onImp ? "resp" : "imp") : null;
  const otherSays = other && other.a != null
    ? (other.a >= other.b ? m.a.name + " ahead " + other.a.toFixed(1) + "–" + other.b.toFixed(1)
                          : m.b.name + " ahead " + other.b.toFixed(1) + "–" + other.a.toFixed(1))
    : null;
  const howCounted = !hasBases
    ? "The pollsters’ own head-to-head figures, averaged. Too few pollsters ask this pairing for it to be weighted or corrected for each one’s lean."
    : !onImp
      ? (KAL ? "The pollsters’ own two-party figures, from where their respondents say their preferences would go, as a smoothed trend through every poll, adjusted for each pollster’s lean. The ± is its 95% interval."
        : "The pollsters’ own two-party figures, from where their respondents say their preferences would go, weighted towards the most recent and adjusted for each pollster’s lean. The ± is the 95% margin.")
      : matchup === "alp_on"
        ? (window.JUR
            ? "Each poll’s primary votes, run through preference flows taken from counted ballots. No " + window.JUR.adj + " election has counted Labor against One Nation, so for that pairing the site borrows the flows it builds for the federal page. The ± counts both the polls’ sampling error and the doubt about those flows." + (KAL ? " The line is a smoothed trend through every poll." : "")
            : "Each poll’s primary votes, run through preference flows taken from counted ballots. No federal election has counted Labor against One Nation, so for that pairing the site builds the flows itself. The ± counts both the polls’ sampling error and the doubt about those flows.")
          + (parts ? " On the lead today that’s ±" + (2 * unc.ci95).toFixed(1) + ": ±" + parts.cs.toFixed(1) + " from the polls and ±" + parts.cf.toFixed(1) + " from the flows, added as independent errors." : "")
        : window.JUR
          ? "Each poll’s primary votes, run through the preference flows counted at the " + rdElecYear + " election (One Nation’s, too few then to measure, from the 2025 federal count)." + (KAL ? " The line is a smoothed trend through every poll, and the ± its 95% interval." : " The ± is the 95% margin: how far the polls in the window disagree, plus their sampling error.")
          : "Each poll’s primary votes, run through the preference flows counted at the 2025 election. The ± is the 95% margin: how far the polls in the window disagree, plus their sampling error.";
  const qPanel = (
    <RdQPop label="How this is counted, and the pollsters’ published figures" align="left">
      <h4>How this is counted</h4>
      <p>{howCounted}</p>
      {hasBases && (
        <>
          <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
            <RdSwitch on={!onImp} onToggle={chooseBasis} label="Show the pollsters’ published figures" /></div>
          <p className="rd-qnote">{onImp
            ? "Their own head-to-heads, from where respondents say their preferences would go." + (otherSays ? " Against " + (m.b.name === "Coalition" ? "the Coalition" : m.b.name) + " they have " + otherSays + "." : "")
            : "The default reads every poll’s primary votes through fixed flows." + (otherSays ? " On those it has " + otherSays + "." : "")}</p>
        </>
      )}
      <a href="/flows-explained/">Read the full explainer →</a>
    </RdQPop>
  );

  /* ---- the chart: Labor's share against both rivals -------------------- */
  const laborIds = orderedMatchups.filter((id) => M[id].vsLabor);
  const otherOf = (id) => (M[id] && M[id].vsLabor ? laborIds.find((x) => x !== id) || null : null);
  /* A switch draws two scenes on every frame, and a scene's rows, its window
     and its dots only change with the range or the dots toggle - so each is
     worked out once per scene and kept. Only the blend is new per frame. */
  const memo = React.useRef({ key: null, m: new Map() });
  const memoKey = xDomain[0] + "|" + xDomain[1] + "|" + showScatter;
  if (memo.current.key !== memoKey) memo.current = { key: memoKey, m: new Map() };
  const kept = (k, f) => { const m = memo.current.m; if (!m.has(k)) m.set(k, f()); return m.get(k); };
  const ptsOf = (id, b) => kept("p" + id + b, () => filterPts(iDataOf(id, b), xDomain[0]));
  const scene = (id, b) => kept("s" + id + b, () => {
    const o = otherOf(id);
    return { id, o, main: ptsOf(id, b), other: o ? ptsOf(o, b) : null,
             mc: M[id].b.color, oc: o ? M[o].b.color : null };
  });
  const fromB = morph ? (morph.fromBasis || b0) : b0, toB = morph ? (morph.toBasis || b0) : b0;
  const S = scene(matchup, b0);
  const A = morph ? scene(morph.from, fromB) : null, B = morph ? scene(morph.to, toB) : null;
  const t = morph ? morph.t : 1;
  const mainBl = morph && A.main.length && B.main.length ? blendRows(A.main, B.main, t, ["a", "ci95"]) : null;
  const otherBl = morph && A.other && B.other && A.other.length && B.other.length ? blendRows(A.other, B.other, t, ["a"]) : null;
  const mainRows = mainBl ? mainBl.rows : S.main;
  const otherRows = morph ? (otherBl ? otherBl.rows : null) : S.other;
  const mainCol = morph ? mixC(A.mc, B.mc, t) : S.mc;
  const otherCol = morph ? (A.oc && B.oc ? mixC(A.oc, B.oc, t) : null) : S.oc;
  const vsName = (id) => "v " + M[id].b.name;
  const shown = morph ? morph.to : matchup;
  const labelMain = M[shown].vsLabor ? vsName(shown) : M[shown].a.name + " v " + M[shown].b.name;
  const labelOther = otherOf(shown) ? vsName(otherOf(shown)) : null;

  /* the compare overlay: the chosen contest on the basis the chart is NOT on */
  const cmpAvail = hasBases;
  const cmpData = !cmpAvail ? null : matchup === "alp_on"
    ? (onImp ? M.alp_on.data : D.synthOn)
    : (onImp ? D.agg2pp : D.synth2pp);
  const cmpOn = showSynth && cmpAvail && !morph && cmpData && cmpData.length > 1;
  const cmpName = onImp ? "As published" : "Implied";
  const cmpBox = onImp ? "Published 2PP" : "Implied 2PP";
  const sensOn = cmpOn && matchup === "alp_lnp" && D.flowSens && D.flowSens.length > 1;
  /* the band re-prices One Nation's flow at the 2022 FEDERAL table's; /vic/'s
     own 2022 election is a different count, so it says which */
  const sensLabel = "Range if One Nation preferences flowed as " + (window.JUR ? "at the 2022 federal election" : "in 2022");

  /* the outside-aggregate overlay, offered on the Coalition and One
     Nation contests - the two where a comparator publishes the matchup.
     Every line is its author's own published figures: BludgerTrack's trend
     and Kevin Bonham's 2PP ride the Coalition contest, Bonham's shadow-2PP
     the One Nation one. His are monthly averages of the figure his sidebar
     showed each day, ending on his current one (gen-data §6b); until
     2026-10-05 the Coalition line was a rebuild of his method, which ran
     half a point high and zig-zagged */
  const EXT_KB = "#7e52a8", EXT_BT = "#10998d";
  const [showExt, setShowExt] = useState(false);
  const ext = D.extAgg || null;
  const extBt = ext && ext.bt && ext.bt.points && ext.bt.points.length > 1 ? ext.bt.points : null;
  const extKb = ext && ext.bonham && ext.bonham.line && ext.bonham.line.length > 1 ? ext.bonham.line : null;
  const extSh = ext && ext.bonham && ext.bonham.shadow && ext.bonham.shadow.length > 1 ? ext.bonham.shadow : null;
  const isCoal = shown === "alp_lnp", isOn = shown === "alp_on";
  const extAvail = (isCoal && !!(extBt || extKb)) || (isOn && !!extSh);
  const extOn = showExt && extAvail && !morph;
  const extBox = "Outside estimates";
  /* the pair, one group under a "Compare" lead-in: rides the range-tabs row
     on a laptop, opens its own row above the chart (next to the legend it
     changes) on a phone. The lead-in carries the "Compare" word once */
  const cmpCtl = (cmpAvail || extAvail) ? (
    <div className="rd-tpp-cmp" role="group" aria-label="Compare">
      <span className="rd-tpp-cmp-l">Compare</span>
      {cmpAvail ? <RdCheck checked={showSynth} onChange={setShowSynth}>{cmpBox}</RdCheck> : null}
      {extAvail ? <RdCheck checked={showExt} onChange={setShowExt}>{extBox}</RdCheck> : null}
    </div>
  ) : null;
  /* the key entries name the publisher, carry his CURRENT figure as HE
     publishes it - each line's last point, which is his latest figure, not
     a monthly average - and link out to where he publishes (RdKey grows an
     href branch for them) */
  const extFig = (pts) => pts && pts.length ? " (" + pts[pts.length - 1].y.toFixed(1) + "%)" : "";
  const extBtHref = "https://" + (ext && ext.bt && ext.bt.feed ? ext.bt.feed : "");
  const extKbHref = "https://" + (ext && ext.bonham && ext.bonham.site ? ext.bonham.site : "");
  const lblExtBt = "BludgerTrack’s estimate" + extFig(extBt);
  const lblExtKb = "Bonham’s estimate" + extFig(extKb);
  const lblExtSh = "Bonham’s estimate" + extFig(extSh);

  const series = [];
  if (otherRows && otherRows.length > 1)
    series.push({ id: "other", label: labelOther || "", color: otherCol, rdWidth: 2, endCap: false,
                  points: otherRows.filter((d) => d.a != null).map((d) => ({ x: d.x, y: d.a })),
                  clipX: otherBl ? otherBl.clip : null, endLabel: narrow ? null : labelOther });
  if (cmpOn)
    series.push({ id: "cmp", label: cmpName, color: mainCol, rdWidth: 2, dashed: true, endCap: false,
                  points: filterPts(cmpData.map((d) => ({ x: d.x, y: d.alp != null ? d.alp : d.a })), xDomain[0]),
                  endLabel: narrow ? null : cmpName });
  /* the comparators sit UNDER the house line (pushed before it), thin and
     coloured by publisher - purple Bonham, aquamarine BludgerTrack - so
     they never read as family with the party lines; SOLID (user 2026-10-02:
     the 1.5px stand-out colours differentiate, the dash only made them
     look dotted). NO end labels (user 2026-10-02): the key below the
     chart already names them, and publisher names have no -text token so
     the engine ink-diluted them away from the line colour anyway. On the
     One Nation contest the only outside line is Bonham's shadow-2PP;
     BludgerTrack carries no One Nation pairing */
  if (extOn) {
    if (isCoal && extKb)
      series.push({ id: "kbonham", label: "Bonham’s estimate", color: EXT_KB, rdWidth: 1.5, endCap: false,
                    points: filterPts(extKb, xDomain[0]), endLabel: null });
    if (isOn && extSh)
      series.push({ id: "kbsh", label: "Bonham’s estimate", color: EXT_KB, rdWidth: 1.5, endCap: false,
                    points: filterPts(extSh, xDomain[0]), endLabel: null });
    if (isCoal && extBt)
      series.push({ id: "btrack", label: "BludgerTrack’s estimate", color: EXT_BT, rdWidth: 1.5, endCap: false,
                    points: filterPts(extBt, xDomain[0]), endLabel: null });
  }
  if (adjusted || morph)
    series.push({ id: "main", label: labelMain, color: mainCol, rdWidth: 3, endCap: false,
                  points: mainRows.map((d) => ({ x: d.x, y: d.a })),
                  clipX: mainBl ? mainBl.clip : null, endLabel: narrow ? null : labelMain });
  const areas = [];
  /* mid-switch the band is drawn from the blend's own edges (see blendRows) */
  const bandPts = mainBl
    ? mainRows.filter((d) => d.ci95Hi != null && d.ci95Lo != null).map((d) => ({ x: d.x, y0: d.ci95Lo, y1: d.ci95Hi }))
    : mainRows.filter((d) => d.ci95 != null && d.ci95 > 0).map((d) => ({ x: d.x, y0: d.a - d.ci95, y1: d.a + d.ci95 }));
  if (bandPts.length >= 2)
    areas.push({ id: "band", color: mainCol, className: "ci-band", edge: false, clipX: mainBl ? mainBl.clips.ci95 : null, points: bandPts });
  if (sensOn)
    /* a bracket's bound, not a third line: dotted and faint, so beside the
       compare dash in the same colour it never reads as another series */
    areas.push({ id: "sens", color: "var(--lnp)", className: "rd-sens", edge: true,
                 edgeWidth: 1, edgeDash: "1.8 3", edgeOpacity: 0.35,
                 points: filterPts(D.flowSens.map((d) => ({ x: d.x, y0: d.lo, y1: d.hi })), xDomain[0]) });

  /* the dots: each poll's reading of Labor's share in the chosen contest,
     coloured by the contest. A poll that published both contests is one
     fieldwork asked two ways, so its dot travels between them. */
  const cloudFor = (id, b) => (!showScatter ? [] : D.individualPolls
    .filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .map((q) => {
      const pair = iScatOf(id, b)(q);
      return pair ? { x: q.x, y: pair[0].y, color: M[id].b.color, label: M[id].a.name + " v " + M[id].b.name, meta: q } : null;
    }).filter(Boolean));
  const settled = React.useMemo(() => cloudFor(matchup, b0), [matchup, b0, rangeId, showScatter]);
  const split = React.useMemo(() => {
    if (!morph) return null;
    const key = (d) => d.meta.pollster + "|" + d.meta.released;
    const ca = cloudFor(morph.from, fromB), cb = cloudFor(morph.to, toB);
    const ia = new Map(ca.map((d) => [key(d), d])), ib = new Map(cb.map((d) => [key(d), d]));
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return { travel, leaving, arriving };
  }, [morph ? morph.from : null, morph ? morph.to : null, morph ? fromB : null, morph ? toB : null, rangeId, showScatter]);
  const scatter = split ? split.arriving : settled;
  const scatterOut = split ? split.leaving : [];
  const scatterMove = !split ? [] : split.travel.map(([a, b]) => ({
    x: a.x, y: a.y + (b.y - a.y) * t, color: mixC(a.color, b.color, t), label: b.label, meta: b.meta }));

  /* the last election's result, a count rather than a poll: the Coalition contest's first
     point, rung in that contest line's colour as the primary chart's rings are */
  const elec = D.agg2pp.find((d) => d.election);
  const ringOn = elec && (shown === "alp_lnp" || otherOf(shown) === "alp_lnp");
  const marks = ringOn ? [{ x: elec.x, y: elec.alp, color: M.alp_lnp.b.color, label: narrow ? null : rdElecYear + " election: " + elec.alp.toFixed(1) }] : [];

  /* the window fits everything drawn, both contests, their dots and interval */
  const domainOf = (id, b) => kept("d" + id + b + ringOn, () => {
    const v = [50];
    const sc = scene(id, b);
    sc.main.forEach((d) => { v.push(d.a); if (d.ci95) v.push(d.a - d.ci95, d.a + d.ci95); });
    if (sc.other) sc.other.forEach((d) => v.push(d.a));
    if (showScatter) D.individualPolls.forEach((q) => {
      if (q.x < xDomain[0] || q.x > xDomain[1]) return;
      const pair = iScatOf(id, b)(q);
      if (pair) v.push(pair[0].y);
    });
    if (ringOn && elec.x >= xDomain[0]) v.push(elec.alp);
    /* a stray dot may sit a hair past a gridline without buying a whole
       empty band of window */
    return [Math.floor((Math.min(...v) + 0.3) / 5) * 5, Math.ceil((Math.max(...v) - 0.3) / 5) * 5];
  });
  const yBase = domainOf(matchup, b0);
  /* outside estimates on: stretch the window to their values too (they hug
     the house line, so in practice this almost never moves it), keeping the
     5-point lattice domainOf rounds to */
  const yTarget = !extOn ? yBase : (() => {
    const v = [];
    if (isCoal) {
      if (extKb) for (const d of extKb) if (d.x >= xDomain[0]) v.push(d.y);
      if (extBt) for (const d of extBt) if (d.x >= xDomain[0]) v.push(d.y);
    } else if (isOn && extSh) {
      for (const d of extSh) if (d.x >= xDomain[0]) v.push(d.y);
    }
    if (!v.length) return yBase;
    return [Math.min(yBase[0], Math.floor((Math.min(...v) + 0.3) / 5) * 5),
            Math.max(yBase[1], Math.ceil((Math.max(...v) - 0.3) / 5) * 5)];
  })();
  /* a switch that took over from another starts from the window on screen */
  const yFrom = morph ? (morph.fromDomain || domainOf(morph.from, fromB)) : null;
  const yDomain = morph ? blendDomain(yFrom, yTarget, t) : yTarget;
  if (domainRef) domainRef.current = yDomain;
  const yTicks = rdYTicks(yTarget[0], yTarget[1], 5);
  /* the window being left keeps its own labels until they slide out, "%" on
     its top one (TrendChart crossfades the two sets) */
  const yTop = (dm) => Math.floor(dm[1] / 5 + 1e-9) * 5;
  const yFromTicks = yFrom ? rdYTicks(Math.ceil(yFrom[0] / 5 - 1e-9) * 5, yTop(yFrom), 5) : null;

  /* events: rdChartEvents' shared set – the one the Primary vote chart
     marks – on EVERY contest's view, so the markers are identical whichever
     matchup pill is up, over the months that contest's lines run. Mid-switch
     the chart is handed both scenes' events and slides one set into the
     other (TrendChart's eventsFrom), so the markers change with the lines,
     not after them. */
  const evsOf = (sc) => {
    const rows = [sc.main, sc.other].filter((r) => r && r.length);
    if (!rows.length) return [];
    const x0 = Math.min(...rows.map((r) => r[0].x)), x1 = Math.max(...rows.map((r) => r[r.length - 1].x));
    return rdChartEvents(D.events, x0, x1);
  };
  const evsAll = evsOf(morph ? B : S);
  const evsWas = morph ? evsOf(A) : null;
  const badges = narrow ? rdEventBadges("tp", evsAll, xDomain[0], xDomain[1]) : null;
  const badgesWas = narrow && evsWas ? rdEventBadges("tp", evsWas, xDomain[0], xDomain[1]) : null;
  const events = badges ? badges.events : evsAll;
  const eventsWas = evsWas ? (badgesWas ? badgesWas.events : evsWas) : null;
  /* the phone list under the chart opens an event's panel by tapping its
     number; a tap on another number hands the panel over, and an event that
     leaves the window is put away by the chart's own reconciliation */
  const [evtOpen, setEvtOpen] = useState(null);
  const pickEv = (e) => { setEvtOpen((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };

  const aName = m.a.name, rival = M[matchup].vsLabor ? "Rival" : m.b.name;
  const notes = [
    { x: "left", y: 50, dy: -7, text: "▲ " + aName + " ahead", size: narrow ? 11 : 12 },
    { x: "left", y: 50, dy: 16, text: "▼ " + rival + " ahead", size: narrow ? 11 : 12 },
  ];
  const chartTitle = M[matchup].vsLabor ? "Labor’s two-party-preferred vote, %" : "The Coalition’s two-party share against One Nation, %";
  const flowsBand = matchup === "alp_on" && onImp;
  /* The hover guide steps along the main line's months, and on the default
     contest (v One Nation, first asked months after polling day) that left
     the election ring with no month of its own: hovering it read out the ON
     line's first month. Where the ring is drawn and the main line starts
     after it, the election is the guide's first stop, as it is on the
     primary-vote chart, and says what it is. */
  const spineRows = (ringOn && elec.x >= xDomain[0] && mainRows.length && mainRows[0].x > elec.x + 1e-6
    ? [{ ...elec, a: elec.alp }] : []).concat(mainRows.filter((d) => !d.mid));
  const spine = spineRows.map((d) => ({ x: d.x, y: d.a, ym: d.ym }));

  /* ---- the finding over the chart --------------------------------------
     About the two Labor contests together, whichever one the chart is set
     to: how far each has moved since both were first asked, and whether they
     have converged. Written from the monthly figures on the chosen basis. */
  const story = kept("story" + b0, () => {
    const on = iDataOf("alp_on", b0).filter((d) => !d.election), co = iDataOf("alp_lnp", b0).filter((d) => !d.election);
    if (!on.length || !co.length || !M.alp_on || !laborIds.includes("alp_on")) return null;
    const coBy = {}; co.forEach((d) => { coBy[d.ym] = d; });
    const both = on.filter((d) => coBy[d.ym]);
    if (both.length < 3) return null;
    const f = both[0], l = both[both.length - 1];
    const on0 = f.a, on1 = l.a, co0 = coBy[f.ym].a, co1 = coBy[l.ym].a;
    const gap = on1 - co1;
    /* "closer" only when the gap clears both contests' margins combined -
       conservative, as the two share their polls - and never inside a point */
    const gapCi = Math.hypot(l.ci95 || 0, coBy[l.ym].ci95 || 0);
    const head = Math.abs(gap) < 1 || Math.abs(gap) <= gapCi ? "One Nation now runs Labor as close as the Coalition does"
      : gap < 0 ? "One Nation now runs Labor closer than the Coalition does"
      : "The Coalition still runs Labor closer than One Nation does";
    const verb = (a, b) => (b < a ? (a - b >= 10 ? "plunged" : "fallen") : "risen");
    const pc = (v) => Math.round(v) + "%";
    let dek = "Labor’s 2PP against One Nation has " + (Math.round(on0) === Math.round(on1) ? "held near " + pc(on1) + " since " + rdMonthYear(f.ym)
      : verb(on0, on1) + " from " + pc(on0) + " in " + rdMonthYear(f.ym) + " to " + pc(on1) + " now")
      + "; against the Coalition, " + (Math.round(co0) === Math.round(co1) ? "it has held near " + pc(co1) : "from " + pc(co0) + " to " + pc(co1)) + ".";
    /* the longest recent run the two have stayed close */
    let k = both.length - 1, worst = Math.abs(gap);
    while (k > 0) {
      const g = Math.abs(both[k - 1].a - coBy[both[k - 1].ym].a);
      if (Math.max(worst, g) > 1.5) break;
      worst = Math.max(worst, g); k--;
    }
    const runLen = both.length - k;
    const phrase = rdPointsPhrase(Math.max(worst, 0.01));
    if (runLen >= 3 && phrase && k > 0) {
      const [yy, mm] = both[k].ym.split("-").map(Number);
      const since = D.monthNameFull(mm) + (yy === Number(l.ym.slice(0, 4)) ? "" : " " + yy);
      dek += " Since " + since + " the two contests have run within " + phrase + " of each other.";
    }
    return { head, dek };
  });

  /* ---- the key ---------------------------------------------------------- */
  const keyItems = [
    showScatter && settled.length ? { kind: "dot", color: mainCol, label: "One poll, " + (hasBases ? (onImp ? "implied flows" : "as published") : "as published") } : null,
    (adjusted || morph) ? { kind: bandPts.length >= 2 ? "lineband" : "line", color: mainCol,
      label: (lineWord(shown, b0) === "trend" ? "Trend" : narrow ? "Monthly" : "Monthly average") + (bandPts.length >= 2 ? (flowsBand ? (narrow ? ", margin incl. flows" : " and its margin, polls and flows") : (narrow ? ", 95% interval" : " and its 95% interval")) : "") } : null,
    (!narrow && labelOther) ? { kind: "line", color: otherCol, label: labelOther + ", " + lineWord(otherOf(shown), b0) } : null,
    /* on a phone the extras live in the legend above the chart; the key
       below names them only where that legend never renders (laptop), so
       a ticked phone view stops listing them twice */
    cmpOn && !narrow ? { kind: "dash", color: mainCol, label: cmpName + ", " + lineWord(matchup, onImp ? "resp" : "imp") } : null,
    extOn && !narrow && isCoal && extBt ? { kind: "line", color: EXT_BT, label: lblExtBt, href: extBtHref } : null,
    extOn && !narrow && isCoal && extKb ? { kind: "line", color: EXT_KB, label: lblExtKb, href: extKbHref } : null,
    extOn && !narrow && isOn && extSh ? { kind: "line", color: EXT_KB, label: lblExtSh, href: extKbHref } : null,
    sensOn ? { kind: "band", color: "var(--lnp)", label: sensLabel } : null,
    ringOn ? { kind: "ring", label: narrow ? rdElecYear + " election" : rdElecYear + " election result" } : null,
  ];
  /* The copy's key, worded as a laptop words it whatever the screen: the
     image is laid out wide, and a phone's lines carry no names at their
     ends, so the key names both. The election ring is keyed only where the
     chart leaves it unlabelled. */
  const copyKey = [
    keyItems.find((k) => k && k.kind === "dot"),
    (adjusted || morph) ? { kind: "line", color: mainCol,
      label: labelMain + ", " + lineWord(shown, b0) + (bandPts.length >= 2 ? (flowsBand ? " and its margin, polls and flows" : " and its 95% interval") : "") } : null,
    labelOther ? { kind: "line", color: otherCol, label: labelOther + ", " + lineWord(otherOf(shown), b0) } : null,
    cmpOn ? { kind: "dashed", color: mainCol, label: cmpName + ", " + lineWord(matchup, onImp ? "resp" : "imp") } : null,
    extOn && isCoal && extBt ? { kind: "line", color: EXT_BT, label: lblExtBt } : null,
    extOn && isCoal && extKb ? { kind: "line", color: EXT_KB, label: lblExtKb } : null,
    extOn && isOn && extSh ? { kind: "line", color: EXT_KB, label: lblExtSh } : null,
    sensOn ? { kind: "shade", color: "var(--lnp)", label: sensLabel } : null,
    ringOn && narrow ? { kind: "ring", color: "var(--ink)", label: rdElecYear + " election result" } : null,
  ].filter(Boolean);

  const tooltipTitle = (i) => { const d = spine[i] || spine[spine.length - 1]; return d && d.ym ? monthLabelFull(d.ym) : ""; };
  const extraRows = (i) => {
    const d = spineRows[i];
    // by date, not flag: the Coalition line's own first row is the result too
    if (d && ringOn && Math.abs(d.x - elec.x) < 1e-6) return [{ label: "", value: "The election result" }];
    if (!d || !d.ci95) return [];
    // the implied ALP v ON month's ± is a margin of two parts, named
    const two = flowsBand && d.cs != null && d.cf != null ? " (polls ± " + d.cs.toFixed(1) + ", flows ± " + d.cf.toFixed(1) + ")" : "";
    return [{ label: flowsBand ? "Margin" : "95% interval", value: "± " + d.ci95.toFixed(1) + " pts" + two + (d.k ? ", " + d.k + " poll" + (d.k === 1 ? "" : "s") : "") }];
  };

  const meta = narrow
    ? "After preferences, updated " + rdDate(D.latest.updatedISO, true)
    : "After preferences, " + D.latest.pollsTracked + " polls from " + D.latest.housesTracked + " pollsters, updated " + rdDate(D.latest.updatedISO, true);

  /* the tab's on-this-page index, in the hero's eyebrow as Past cycles and
     All polls carry theirs in theirs; the Snapshot's sections run ten deep,
     so the links are the exact section titles scrolled to. The list reads as
     one sentence, "and" before the last and no commas - words only, the look
     is unchanged */
  const snapNav = [
    ["latest-polls", "Latest and next polls"],
    ["leadership", "Leadership"],
    D.demographics ? ["who-votes", "Who votes for whom"] : null,   // /vic/ has neither
    D.issues ? ["issues", "The issues"] : null,
  ].filter(Boolean);
  const snapGo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: SM, block: "start" }); };

  /* a sideways swipe on the chart flips the 2PP contest, wrapping round the
     matchups like the computer's arrow keys wrap a row - the card bears the
     exact claim so the gesture reaches it past the chart's own scrub. And
     two quick presses on open chart - the engine only fires onDoubleEmpty
     when the press picks no poll and no event, so a dot's tap and an
     event's keep their own jobs - step it the same way */
  const swipeLive = React.useRef(null);
  swipeLive.current = (dir) => {
    const i = orderedMatchups.indexOf(matchup);
    if (i < 0 || orderedMatchups.length < 2) return false;
    chooseMatchup(orderedMatchups[(i + dir + orderedMatchups.length) % orderedMatchups.length]);
    return true;
  };
  const swipeMark = React.useCallback((el) => { if (el) el.__rdSwipe = (dir) => swipeLive.current(dir); }, []);

  /* two quick presses on the headline figures flip the contest, one step
     along the matchups like a sideways swipe - the numbers themselves
     carry the claim (the names and the rule between them do not), and the
     pair is read off pointerdown so a mouse double-click and a phone
     double-tap are the same gesture. The second press's default is killed:
     left to the browser it would select the digits. */
  const numTap = React.useRef({ t: 0, x: 0, y: 0 });
  const numPress = (e) => {
    if (!(e.target.closest && e.target.closest(".rd-tpp-num"))) return;
    const now = performance.now(), p = numTap.current;
    const pair = now - p.t < 500 && Math.abs(e.clientX - p.x) < 30 && Math.abs(e.clientY - p.y) < 30;
    p.t = now; p.x = e.clientX; p.y = e.clientY;
    if (!pair || orderedMatchups.length < 2) return;
    p.t = 0;
    e.preventDefault();
    const i = orderedMatchups.indexOf(matchup);
    chooseMatchup(orderedMatchups[(i + 1 + orderedMatchups.length) % orderedMatchups.length]);
  };

  /* Pointing at the chart card makes its range menu the arrow-key target
     without moving DOM focus: the card claims bare presses on the page
     itself, a focused control (the menu's own walk, the compare checkbox)
     still wins, and leaving the card hands the page turn back. The pin
     holds the card's screen spot while the shared range reflows the twin
     card below it. */
  const chartEl = React.useRef(null);
  const hoverKeys = React.useRef(false);
  const chartMark = React.useCallback((el) => { chartEl.current = el; if (el) el.__rdSwipe = (dir) => swipeLive.current(dir); }, []);
  React.useEffect(() => {
    const sec = chartEl.current;
    if (!sec) return undefined;
    const enter = () => { hoverKeys.current = true; };
    const leave = () => { hoverKeys.current = false; };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!hoverKeys.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const i = RD_RANGES.findIndex((o) => o.id === rangeId);
      if (i < 0) return;
      e.preventDefault();
      rdPinScroll(sec);
      setRangeId(RD_RANGES[(i + (e.key === "ArrowRight" ? 1 : -1) + RD_RANGES.length) % RD_RANGES.length].id);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [rangeId]);

  /* Spacebar steps the 2PP contest while this section is on screen - the
     "Switch 2PP" chips by key, one matchup on like the chart card's
     sideways swipe. The claim is the viewport (an IntersectionObserver
     read, the all-polls table's shape), never the pointer: off the
     section, with Shift held (space's scroll-back), or with real focus on
     a control, the key keeps its day job. */
  const spaceStep = React.useRef(null);
  spaceStep.current = orderedMatchups.length > 1 ? () => swipeLive.current(1) : null;
  React.useEffect(() => {
    const sec = document.getElementById("two-party");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (e.key !== " " || !inView.current) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const act = spaceStep.current;
      if (!act) return;
      e.preventDefault();
      if (!e.repeat) act();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);

  return (
    <section className="rd-sec rd-first rd-tpp" id="two-party" aria-labelledby="rd-tpp-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-tpp-t">Two-party preferred</h2>
        <span className="rd-meta">{meta}</span>
        {!narrow && <nav className="rd-eyebrow-tools rd-snap-nav" aria-label="On this page">{snapNav.map(([id, lab], i) => <button key={id} type="button" onClick={() => snapGo(id)}>{(i === snapNav.length - 1 ? "and " : "") + lab}</button>)}</nav>}
      </div>
      {/* The section's headline under its heading, as every other section
         has it, so the opening view reads down a left edge before the
         centred figures. A phone keeps the figures first: there the
         headline and its dek would push the verdict and scale off the first
         screen, and the figure is what the page is opened for. */}
      {story && !narrow && <RdHed head={story.head} dek={story.dek} />}
      <div className="rd-tpp-top">
        {/* the figures swipe like the chart under them: marked self so only
            this strip of numbers and names claims the gesture - the
            "ahead" scale directly below it, and the words below that, keep
            their plain page turn. A press on the numbers is double-counted
            here (numPress): two quick ones flip the contest */}
        <div className="rd-tpp-read" ref={swipeMark} data-rd-swipe-self="" onPointerDown={numPress}>
          <div className="rd-tpp-side rd-a">
            <span className="rd-tpp-name" style={{ color: inkOf(m.a.color) }}><span className="rd-tpp-dot" style={{ background: m.a.color }}></span>{m.a.name}</span>
            <RollNum className="rd-tpp-num" value={latest.a.toFixed(1)} style={{ color: inkOf(m.a.color) }} spinIn />
          </div>
          <span className="rd-tpp-rule" aria-hidden="true"></span>
          <div className="rd-tpp-side rd-b">
            <RollNum className="rd-tpp-num" value={latest.b.toFixed(1)} style={{ color: inkOf(m.b.color) }} spinIn />
            <span className="rd-tpp-name" style={{ color: inkOf(m.b.color) }}>{m.b.name}<span className="rd-tpp-dot" style={{ background: m.b.color }}></span></span>
          </div>
        </div>
        <RdLeadGauge lead={lead} margin={margin} aName={m.a.name} bName={m.b.name} aColor={m.a.color} bColor={m.b.color} />
        <p className="rd-tpp-verdict">{verdict}</p>
        <p className="rd-tpp-change">{change}</p>
        <p className="rd-tpp-prov">{provenance}{qPanel}
          {hasBases && !onImp && !narrow && <>, <button type="button" className="rd-link" onClick={chooseBasis}>Back to implied flows</button></>}
        </p>
        {/* a phone has no room for the way back on the line itself, so it
            opens a line of its own, gliding (RdGlide) */}
        {narrow && (
          <RdGlide className="rd-tpp-back" watch={hasBases && !onImp ? "back" : ""}>
            {hasBases && !onImp ? <button type="button" className="rd-link" onClick={chooseBasis}>Back to implied flows</button> : null}
          </RdGlide>
        )}
        {otherContests.length > 0 && (
          <div className="rd-tpp-switch">
            <span className="rd-tpp-switch-l">Switch 2PP</span>
            {otherContests.map((o) => (
              <button key={o.id} type="button" className="rd-chip" onClick={() => chooseMatchup(o.id)}
                      title={"Show " + M[o.id].a.name + " v " + M[o.id].b.name}>
                {M[o.id].a.name} v {M[o.id].b.name}
                <span className="rd-chip-fig">
                  <span style={{ color: inkOf(M[o.id].a.color) }}>{o.v.a.toFixed(1)}</span>
                  <span className="rd-chip-dash">–</span>
                  <span style={{ color: inkOf(M[o.id].b.color) }}>{o.v.b.toFixed(1)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {story && narrow && <RdSub head={story.head} dek={story.dek} level={3} glide />}

      <div className="card rd-card rd-tpp-chart" ref={chartMark} data-rd-swipe-exact="">
        <RdTabs value={rangeId} onChange={setRangeId} options={RD_RANGES} ariaLabel="Time range" className="rd-tabs-sm" swipeSelf pin>
          {!narrow && cmpCtl}
        </RdTabs>
        {narrow && cmpCtl}
        <div className="rd-chead"><span className="rd-chead-t">{chartTitle}</span></div>
        {narrow && (
          <RdKey className="rd-tpp-legend" items={[
            { kind: "line", color: mainCol, label: labelMain },
            labelOther ? { kind: "line", color: otherCol, label: labelOther } : null,
            cmpOn ? { kind: "dash", color: mainCol, label: cmpName } : null,
            extOn && isCoal && extBt ? { kind: "line", color: EXT_BT, label: lblExtBt, href: extBtHref } : null,
            extOn && isCoal && extKb ? { kind: "line", color: EXT_KB, label: lblExtKb, href: extKbHref } : null,
            extOn && isOn && extSh ? { kind: "line", color: EXT_KB, label: lblExtSh, href: extKbHref } : null,
          ]} />
        )}
        <TrendChart
          key="rd-hero"
          heightPx={narrow ? 300 : 372}
          widthSeed={rdHeroChartSeed()}
          padPx={narrow ? { l: 30, r: 6, t: 34, b: 28 } : { l: 40, r: 16, t: 52, b: 30 }}
          xDomain={xDomain} yDomain={yDomain} yTicks={yTicks}
          yTickFmt={(v) => (v === yTarget[1] ? v + "%" : String(v))}
          morphFrom={yFrom ? { yTicks: yFromTicks, yTickFmt: (v) => (v === yTop(yFrom) ? v + "%" : String(v)),
                               refLines: [{ y: 50, color: "var(--ink-faint)" }], notes } : null} morphT={t}
          xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, elec ? elec.x : null)} baseline
          refLines={[{ y: 50, color: "var(--ink-faint)" }]}
          notes={notes} marks={marks} ringAtX={ringOn ? elec.x : null} events={events} eventsFrom={eventsWas} eventMix={t}
          evt={evtOpen} onEvt={setEvtOpen}
          series={series} spine={spine}
          scatter={scatter} scatterOut={scatterOut} scatterMove={scatterMove}
          areas={areas} fade={morph ? t : 1}
          pollFacet="twopp"
          onDoubleEmpty={() => swipeLive.current(1)}
          tooltipTitle={tooltipTitle} extraRows={extraRows}
          fmt={(v) => v.toFixed(1)}
          /* the finding first, then how it is counted: "weighted aggregate
             of 8 polls to 2 Oct" alone read as if the whole chart rested on
             eight polls, when that is the latest window */
          copy={{ title: chartTitle.replace(/, %$/, ""),
                  sub: (story && M[matchup].vsLabor ? story.head + ". " : "")
                    + basisWords.replace(/^Implied flows$/, "Implied preference flows").replace(/^As published$/, "Pollsters’ published figures")
                    + (KAL ? ", smoothed trend through every poll" + (unc ? ", " + unc.n + " polls to " + rdDate(D.latest.updatedISO, true) : "")
                      : ", monthly averages" + (unc ? "; the latest reading pools the " + unc.n + " poll" + (unc.n === 1 ? "" : "s") + " in the " + D.latest.method.windowDays + " days to " + rdDate(D.latest.updatedISO, true) : "")) + ".",
                  legend: copyKey.map((k) => ({ label: k.label, color: k.color, kind: k.kind })) }}
        />
        {badges && <RdEventList list={badges.list} from={badgesWas ? badgesWas.list : null} mix={t} onPick={pickEv} openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />}
        <RdKey className="rd-ckey" items={keyItems} />
      </div>
      <RdFoot how={KAL ? { term: "weighted-aggregate", from: "Two-party preferred" } : { href: "/flows-explained/" }}>
        {KAL ? "Figures are a smoothed trend through every poll this term, adjusted for each pollster’s lean, and can step at a change of leader. Changes are on a month ago. The chart follows the matchup chosen above."
          : "Figures pool the last " + D.latest.method.windowDays + " days of polls, weighted towards the most recent and adjusted for each pollster’s lean. Changes are on a month ago. The chart follows the matchup chosen above."}
        {extOn && isCoal && <> BludgerTrack’s line is its published trend. Bonham’s is his published figure, averaged by month like ours, from the launch of his aggregate in September 2025.</>}
        {extOn && isOn && <> Bonham’s line is his published shadow-2PP, averaged by month like ours. He converts each poll’s primary votes with his own estimates of 2025 preferences and averages the latest ten polls, at most two from each pollster. Our flows differ, so the two lines need not agree.</>}
      </RdFoot>
    </section>
  );
}

Object.assign(window, { RdHero, RdLeadGauge });
