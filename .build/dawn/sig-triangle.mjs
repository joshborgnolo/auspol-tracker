const ID = ["alp", "lnp", "onp"];
const CO = { alp: "alp", lnp: "lnp", onp: "on" };
const NM = ["Labor", "Coalition", "One Nation"], AB = ["Labor", "the Coalition", "One Nation"], CAP = ["Labor", "The Coalition", "One Nation"];
const fmt = v => Math.round(v * 10) / 10;

/* The three shares renormalise to 100. The 1.96 ellipse gives the original
   pairwise 95% tests; it is not a chi-square joint-confidence region. */
export function sigTriangle(p, n) {
  const q = p && p.p;
  if (!q || / \(MRP\)$/.test(p.h || "") || !n || ID.some(k => q[k] == null || !(+q[k] > 0))) return null;
  const u = p.u;
  if (u && u.label === "excluded" && u.v > 0) n *= 1 - u.v / 100;
  const raw = ID.map(k => +q[k]), s = raw.reduce((a, v) => a + v, 0), pr = raw.map(v => v / s), n3 = n * s / 100;
  if (!(n3 > 0)) return null;
  const cov = ID.map((_, i) => ID.map((_, j) => ((i === j ? pr[i] : 0) - pr[i] * pr[j]) / n3));
  const Z = 1.96;
  const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
    const g = pr[i] - pr[j], m = Z * Math.sqrt(Math.max(0, pr[i] + pr[j] - g * g) / n3);
    return { i, j, g, m, sig: Math.abs(g) > m };
  });
  let lo = 20;
  while (lo > 0 && pr.some((v, i) => 100 * (v - Z * Math.sqrt(cov[i][i])) - 3 < lo)) lo -= 5;
  const of100 = pr.map(v => Math.floor(v * 100)), left = 100 - of100.reduce((a, v) => a + v, 0);
  pr.map((v, i) => [v * 100 - of100[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => of100[i]++);
  return { raw, s, pr, cov, Z, pairs, lo, of100 };
}

export function sigMark(p, n) {
  const T = sigTriangle(p, n);
  if (!T) return "";
  const W = 320, S = 240, H0 = 30, h = S * Math.sqrt(3) / 2;
  const V = [[W / 2, H0], [W / 2 - S / 2, H0 + h], [W / 2 + S / 2, H0 + h]];
  const span = 1 - 3 * T.lo / 100, mid = (a, b) => [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2];
  const at = f => { const w = f.map(v => (v - T.lo / 100) / span); return [0, 1].map(r => w.reduce((t, v, i) => t + v * V[i][r], 0)); };
  const G = [W / 2, H0 + h * 2 / 3], pt = xy => xy.map(v => v.toFixed(1)).join(","), kite = k => [V[k], mid(k, (k + 1) % 3), G, mid(k, (k + 2) % 3)].map(pt).join(" ");
  const M = [0, 1].map(r => ID.map((_, k) => V[k][r] / span));
  const C = [0, 1].map(r => [0, 1].map(c => {
    let v = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += M[r][i] * T.cov[i][j] * M[c][j];
    return v;
  }));
  const tr = C[0][0] + C[1][1], det = C[0][0] * C[1][1] - C[0][1] * C[0][1];
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = Math.max(0, tr - l1);
  const ang = Math.atan2(l1 - C[0][0], C[0][1] || 1e-12) * 180 / Math.PI;
  const D = at(T.pr), blob = { cx: D[0], cy: D[1], rx: T.Z * Math.sqrt(l1), ry: T.Z * Math.sqrt(l2), transform: `rotate(${ang.toFixed(2)} ${D[0].toFixed(1)} ${D[1].toFixed(1)})` };
  const uid = "tri-" + String(p.k).replace(/[^A-Za-z0-9_.-]/g, "-");
  const pair = (i, j) => T.pairs.find(x => (x.i === i && x.j === j) || (x.i === j && x.j === i));
  const rank = [0, 1, 2].sort((a, b) => T.pr[b] - T.pr[a]), L = rank[0], tied = rank.slice(1).filter(k => !pair(L, k).sig);
  const s1 = !tied.length ? CAP[L] + " is ahead of both, beyond the margin: the blob sits wholly in its corner."
    : tied.length === 2 ? "No party is clearly ahead: the blob reaches all three corners."
    : CAP[L] + " is ahead in this poll, but not clearly: the blob reaches into " + AB[tied[0]] + "’s corner.";
  const s2 = tied.length === 2 ? "" : pair(rank[1], rank[2]).sig ? " " + CAP[rank[1]] + " is clearly ahead of " + AB[rank[2]] + "."
    : " " + CAP[rank[1]] + " and " + AB[rank[2]] + " are within the margin of each other.";
  const shares = NM.map((n, i) => n + " " + T.of100[i]).join(", "), step = T.lo ? 5 : 10;
  const blobs = Object.entries(blob).map(([k, v]) => `${k}="${typeof v === "number" ? v.toFixed(4) : v}"`).join(" ");
  let s = `<section class="sigw" aria-labelledby="${uid}-h"><h3 id="${uid}-h">Which gaps are real</h3><p class="sig-say">${s1}${s2}</p><div class="sig-row"><svg class="sig-tri" viewBox="0 0 ${W} ${H0 + h + 26}" role="img" aria-label="Triangle of the Labor, Coalition and One Nation shares: ${shares}. ${s1}${s2}"><defs>`;
  for (let k = 0; k < 3; k++) s += `<clipPath id="${uid}-k${k}"><polygon points="${kite(k)}"/></clipPath>`;
  s += "</defs>";
  for (const id of ID) s += `<polygon points="${kite(ID.indexOf(id))}" style="fill:var(--${CO[id]})" class="tri-kite"/>`;
  for (let v = T.lo + step; v < 100 - 2 * T.lo - 1e-9; v += step) for (let k = 0; k < 3; k++) {
    const a = (k + 1) % 3, b = (k + 2) % 3, rest = 1 - v / 100, e1 = [0, 0, 0], e2 = [0, 0, 0];
    e1[k] = e2[k] = v / 100; e1[a] = rest - T.lo / 100; e1[b] = e2[a] = T.lo / 100; e2[b] = rest - T.lo / 100;
    if (rest - T.lo / 100 < T.lo / 100 - 1e-9) continue;
    const p1 = at(e1), p2 = at(e2);
    s += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" class="tri-grid"/>`;
  }
  for (const id of ID) s += `<ellipse ${blobs} clip-path="url(#${uid}-k${ID.indexOf(id)})" style="fill:var(--${CO[id]})" class="tri-blob"/>`;
  s += `<ellipse ${blobs} class="tri-blobline"/><polygon points="${V.map(pt).join(" ")}" class="tri-edge"/>`;
  for (let k = 0; k < 3; k++) {
    s += `<line x1="${G[0]}" y1="${G[1]}" x2="${V[k][0]}" y2="${V[k][1]}" class="tri-med dash"/>`;
    s += `<line x1="${G[0]}" y1="${G[1]}" x2="${mid((k + 1) % 3, (k + 2) % 3)[0]}" y2="${mid((k + 1) % 3, (k + 2) % 3)[1]}" class="tri-med"/>`;
  }
  s += `<circle cx="${D[0].toFixed(1)}" cy="${D[1].toFixed(1)}" r="3.5" class="tri-dot"><title>${shares} of every 100 votes for the three</title></circle>`;
  for (let k = 0; k < 3; k++) {
    const x = V[k][0] + (k === 1 ? 2 : k === 2 ? -2 : 0), y = k === 0 ? V[k][1] - 9 : V[k][1] + 20;
    s += `<text x="${x}" y="${y}" text-anchor="middle" class="tri-v" style="fill:var(--${CO[ID[k]]})">${NM[k]}</text>`;
  }
  s += `</svg><div class="sig-text"><p>The white dot is this poll: Labor, the Coalition and One Nation as shares of their combined ${fmt(T.s)}%, so ${shares} of every 100. The nearer a corner, the bigger that party’s share. Each shaded corner is where that party leads; the faint lines are ${step} points apart${T.lo ? `, and the triangle shows only where each party has at least ${T.lo}` : ""}.</p>`;
  s += "<p>The blob around the dot is the poll’s margin of error, 1.96 standard errors in every direction. Where it crosses a solid line, the two parties either side can’t be told apart at 95%; a dashed line does the same for second and third place. The Greens and others are left out, and whole-number shares can hide up to a point of a gap.</p></div></div></section>";
  return s;
}
