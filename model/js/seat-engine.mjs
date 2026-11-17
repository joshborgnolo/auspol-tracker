/* seat-engine.mjs: the seat model's core (layers 3-5), shared by the 2028 run (swing-simulate.mjs)
   and the backtests (backtest-chain.mjs). Generic over a list of seat specs:

     { name, st, cls, w (formal votes), z (education z-score), cands: [
         { label, group, p5 (0 alp, 1 lnp, 2 on, 3 grn, 4 oth), fam (0 A, 1 C, 2 G, 3 O, -1 none),
           isInd, base (2025-style share, 0-1), route ({F, G} from senate-flows.routing), cls (flow class),
           free (optional: an independent whose share is its own record's, not a party's swing) } ],
       iota: { flowClass: share of a transferring pile an independent standing in the seat takes },
       iotaX (optional, read before iota): { own: { flowClass: that share while a party of the voters' own side
         of politics is still standing }, cross: { flowClass: the share once only the other side is }, sib: the
         share of a Coalition candidate's pile when its partner is still standing },
       sib: share of an excluded Coalition partner's own vote its standing partner takes }

   One simulated election:
     1. national targets per p5 key (the caller draws them: nowcast + polling error, or oracle)
     2. seat shares by a LOGIT swing: every candidate's logit(base) + state, demographic, class,
        education-slope and seat terms, then one shift per p5 key solved so the vote-weighted national
        total hits the target exactly (iterated with per-seat normalisation); a `free` candidate's share is
        ilogit(logit(base) + its own deviation) as it stands, the seat's other candidates share the rest, and
        its key's national target is met by that key's other candidates
     3. the count: per candidate, the votes it holds are tracked by ORIGIN candidate; at each exclusion
        a held bundle goes (a) partly to a standing independent (iota), (b) to a standing Coalition
        partner (sib), (c) otherwise over the big four by the origin's Senate-ranking routing - G
        (path-exact) when the excluded candidate is one of the big four, F otherwise - tilted by the
        draw's flow shocks. */

export const P5 = ["alp", "lnp", "on", "grn", "oth"];
export const FAMS = ["A", "C", "G", "O"];
export const FLOW_CLASSES = ["ALP", "COAL", "GRN", "ON", "OTH-R", "OTH-M", "OTH-L"];
/* the big-four families on each donor class's own side of politics, as a mask over A C G O (Labor and the
   Greens: 5; the Coalition and One Nation: 10). A centre minor party's voters have no side: their "own"
   case is any count with more than one of the big four still standing. */
export const OWN_SIDE = { ALP: 5, GRN: 5, "OTH-L": 5, COAL: 10, ON: 10, "OTH-R": 10 };

/* ---- seeded random numbers ---- */
export function rng(seed) {
  let u = seed >>> 0, spare = null;
  const u01 = () => { u = (u + 0x6D2B79F5) >>> 0; let t = u; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const norm = () => { if (spare != null) { const s = spare; spare = null; return s; } let a, b, r; do { a = 2 * u01() - 1; b = 2 * u01() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = b * f; return a * f; };
  const chi2 = (k) => { let s = 0; for (let i = 0; i < k; i++) { const z = norm(); s += z * z; } return s; };
  // Student-t with integer df, scaled to unit variance (so sigma keeps its meaning)
  const t = (df) => norm() / Math.sqrt(chi2(df) / df) * Math.sqrt((df - 2) / df);
  return { u01, norm, t };
}
const ilogit = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

/* ---- layer 3: seat shares ---- */
export function spreadShares(seats, targets, dev, R, groups) {
  // dev(seatIdx, candIdx) -> logit deviation for this draw (state, demo, class, education, seat noise)
  // groups (optional): [{ idx: [seat indexes], targets: [5] }] solves one shift per group and key (oracle state totals)
  if (groups) {
    const out = new Array(seats.length);
    for (const g of groups) { const sub = g.idx.map((i) => seats[i]); const sh = spreadShares(sub, g.targets, (i, j) => dev(g.idx[i], j), R); g.idx.forEach((i, k) => (out[i] = sh[k])); }
    return out;
  }
  const X = seats.map((s, i) => s.cands.map((c, j) => logit(Math.max(c.base, 1e-4)) + dev(i, j)));
  const c5 = new Float64Array(5);
  const W = seats.reduce((a, s) => a + s.w, 0);
  // free candidates: their shares as drawn (a seat's free candidates together capped at 90%), and what they
  // take of each key's national vote
  const fixed = new Float64Array(seats.length), freeNat = new Float64Array(5);
  let freeShare = null;
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    for (let j = 0; j < s.cands.length; j++) {
      const c = s.cands[j]; if (!c.free || !(c.base > 0)) continue;
      const p = ilogit(X[i][j]); if (!(p > 0)) continue;
      (freeShare = freeShare || seats.map((q) => new Float64Array(q.cands.length)))[i][j] = p; fixed[i] += p;
    }
    if (fixed[i] > 0.9) { const f = 0.9 / fixed[i]; for (let j = 0; j < s.cands.length; j++) freeShare[i][j] *= f; fixed[i] = 0.9; }
    if (fixed[i] > 0) for (let j = 0; j < s.cands.length; j++) if (freeShare[i][j] > 0) freeNat[s.cands[j].p5] += s.w * freeShare[i][j];
  }
  let sh = null;
  for (let round = 0; round < 4; round++) {
    for (let k = 0; k < 5; k++) {
      if (targets[k] <= 0) continue;
      // the key's other candidates meet what the free ones leave of its target (never under a twentieth of it)
      const target = freeNat[k] > 0 ? Math.max(targets[k] - freeNat[k] / W, 0.05 * targets[k]) : targets[k];
      let c = c5[k];
      for (let it = 0; it < 30; it++) {
        let f = 0, d = 0;
        for (let i = 0; i < seats.length; i++) {
          const s = seats[i], norm = round === 0 ? (fixed[i] > 0 ? 1 - fixed[i] : 1) : sh[i].norm;
          for (let j = 0; j < s.cands.length; j++) if (s.cands[j].p5 === k && s.cands[j].base > 0 && !s.cands[j].free) { const p = ilogit(X[i][j] + c) * norm; f += s.w * p; d += s.w * p * (1 - p); }
        }
        const g = f / W - target;
        if (Math.abs(g) < 1e-9 || d === 0) break;
        c -= g / (d / W);
      }
      c5[k] = c;
    }
    sh = seats.map((s, i) => {
      const v = s.cands.map((c, j) => (c.base > 0 && !c.free ? ilogit(X[i][j] + c5[c.p5]) : 0));
      const t = v.reduce((a, b) => a + b, 0) || 1;
      if (!(fixed[i] > 0)) { const out = v.map((x) => x / t); out.norm = 1 / t; return out; }
      const room = 1 - fixed[i], out = v.map((x, j) => (freeShare[i][j] > 0 ? freeShare[i][j] : x / t * room)); out.norm = room / t; return out;
    });
  }
  return sh;
}

/* ---- layer 4: the count ---- */
export function count(seat, shares, shock, seatShock) {
  // shock[flowClassIdx*4 + fam] (log multipliers, national); seatShock: same for this seat (or null)
  const cands = seat.cands, n = cands.length;
  const hold = new Float64Array(n * n), standing = new Uint8Array(n).fill(1);
  for (let c = 0; c < n; c++) hold[c * n + c] = shares[c];
  let nStand = 0; for (let c = 0; c < n; c++) if (shares[c] > 0) nStand++; else standing[c] = 0;
  const tally = new Float64Array(n);
  const r = new Float64Array(4);
  while (nStand > 2) {
    let x = -1, lo = Infinity;
    for (let c = 0; c < n; c++) if (standing[c]) { let t = 0; for (let o = 0; o < n; o++) t += hold[c * n + o]; tally[c] = t; if (t < lo) { lo = t; x = c; } }
    standing[x] = 0; nStand--;
    let S = 0; const famC = [[], [], [], []], inds = [];
    for (let c = 0; c < n; c++) if (standing[c]) { if (cands[c].fam >= 0) { S |= 1 << cands[c].fam; famC[cands[c].fam].push(c); } else if (cands[c].isInd) inds.push(c); }
    const xFam = cands[x].fam;
    const sibStanding = xFam === 1 && famC[1].length > 0;
    for (let o = 0; o < n; o++) {
      let a = hold[x * n + o]; if (a <= 0) continue;
      hold[x * n + o] = 0;
      // (a) a standing independent takes its share of anything moving that is not its own
      if (inds.length) {
        // what the independent takes depends on who else is left (seat.iotaX, where given): `own` while a
        // party of the voters' own side of politics is still standing, `cross` once only the other side is,
        // `sib` from a Coalition candidate excluded with its partner standing; else the one share per class
        const cl = cands[o].cls, X = seat.iotaX;
        let io;
        if (X) { const m = OWN_SIDE[cl]; io = (sibStanding ? X.sib : (m ? (S & m) !== 0 : (S & (S - 1)) !== 0) ? X.own[cl] : X.cross[cl]) ?? seat.iota[cl] ?? seat.iota._ ?? 0; }
        else io = seat.iota[cl] ?? seat.iota._ ?? 0;
        if (io > 0) {
          const give = a * io; let tt = 0; for (const c of inds) tt += tally[c] || 1e-9;
          for (const c of inds) hold[c * n + o] += give * (tally[c] || 1e-9) / tt;
          a -= give;
        }
      }
      // (b) an excluded Coalition partner with its partner still standing
      let Sx = S;
      if (sibStanding) {
        if (o === x) { const g = a * seat.sib; addFam(famC[1], hold, n, o, g, tally); a -= g; Sx = S & ~2; }
        else { addFam(famC[1], hold, n, o, a, tally); continue; }
      }
      if (a <= 0) continue;
      if (!Sx) { // none of the big four standing: share over whoever is left by tally
        let tt = 0; const left = []; for (let c = 0; c < n; c++) if (standing[c]) { left.push(c); tt += tally[c] || 1e-9; }
        for (const c of left) hold[c * n + o] += a * (tally[c] || 1e-9) / tt;
        continue;
      }
      // (c) over the big four by the origin's rankings
      const rt = cands[o].route;
      const useG = xFam >= 0 && !sibStanding && rt;
      let tot = 0;
      for (let y = 0; y < 4; y++) {
        if (!((Sx >> y) & 1)) { r[y] = 0; continue; }
        let v = rt ? (useG ? rt.G[(xFam * 16 + Sx) * 4 + y] : rt.F[Sx * 4 + y]) : 1;
        if (shock) { const k = cands[o].clsIdx * 4 + y; v *= Math.exp(shock[k] + (seatShock ? seatShock[k] : 0)); }
        r[y] = v; tot += v;
      }
      if (tot <= 0) { for (let y = 0; y < 4; y++) r[y] = (Sx >> y) & 1; tot = 0; for (let y = 0; y < 4; y++) tot += r[y]; }
      for (let y = 0; y < 4; y++) if (r[y] > 0) addFam(famC[y], hold, n, o, a * r[y] / tot, tally);
    }
  }
  const fin = []; for (let c = 0; c < n; c++) if (standing[c]) { let t = 0; for (let o = 0; o < n; o++) t += hold[c * n + o]; fin.push([c, t]); }
  fin.sort((p, q) => q[1] - p[1]);
  return fin; // [[candIdx, votes], ...] winner first
}
function addFam(list, hold, n, o, amount, tally) {
  if (list.length === 1) { hold[list[0] * n + o] += amount; return; }
  let tt = 0; for (const c of list) tt += tally[c] || 1e-9;
  for (const c of list) hold[c * n + o] += amount * (tally[c] || 1e-9) / tt;
}

/* ---- correlated national errors on the logit scale (Student-t), p5 order ---- */
export function cholesky(M) {
  const n = M.length, L = M.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = M[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
  }
  return L;
}
export function drawNational(base5, sig5, L, R, df) {
  // base5: shares (sum 1); returns perturbed shares (sum 1)
  const z = [0, 1, 2, 3, 4].map(() => R.norm());
  const scale = df ? Math.sqrt((df - 2) / (sumSq(R, df))) : 1;
  const e = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) { let s = 0; for (let k = 0; k <= i; k++) s += L[i][k] * z[k]; e[i] = s * sig5[i] * scale; }
  const v = base5.map((p, i) => (p > 0 ? ilogit(logit(p) + e[i]) : 0));
  const t = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / t);
}
function sumSq(R, df) { let s = 0; for (let i = 0; i < df; i++) { const z = R.norm(); s += z * z; } return s; }
