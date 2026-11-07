// E14: "others" as one donor v others by party. Each classic seat's minor-party flow to Labor, predicted from
// (a) one national rate, (b) the seat's own last-election gap, (c) the parties actually standing there, at their
// rates elsewhere in the same election (leave-one-out), (d) the same with last election's party rates.
import { load, sum, mean } from "./lib.mjs";
const RIGHT = new Set(["UAPP", "CYA", "FFP", "LDP", "LTP", "GRPF", "AUC", "CDP", "FACN", "ASP", "KAP", "IMO", "GAP", "AUVA", "RUA", "AFN", "ABFA"]);
const LEFT = new Set(["AJP", "VNS", "SAL", "SOPA", "FUT", "AUP", "SEP", "IAP", "REAS", "AUD"]);
const fam = (code) => (code === "IND" || code === "NAFD" ? "IND" : RIGHT.has(code) ? "R" : LEFT.has(code) ? "L" : "M");
const MAP25 = { UAPP: "CYA", LDP: "LTP" }; // 2022 registrations whose 2025 successors carry another code
function seats(y) {
  const D = load(`map/data/res-${y}.json`), out = {};
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2) continue;
    const pr = dv.tcp.map((t) => dv.c[t[0]][3]); if (!(pr.includes("alp") && pr.includes("lnp"))) continue;
    const ai = pr.indexOf("alp"); const cands = [];
    for (const f of dv.fl || []) { const c = dv.c[f[0]]; if (c[3] !== "oth" && c[3] !== "ind") continue; cands.push({ code: y === 2022 ? (MAP25[c[1]] || c[1]) : c[1], toA: ai === 0 ? f[1] : f[2], n: f[1] + f[2] }); }
    const n = sum(cands.map((c) => c.n)); if (n < 300) continue;
    out[dv.n] = { cands, n, share: sum(cands.map((c) => c.toA)) / n };
  }
  return out;
}
const s25 = seats(2025), s22 = seats(2022);
function rates(S, skip) {
  const p = {}, f = {}; let A = 0, N = 0;
  for (const [name, s] of Object.entries(S)) { if (name === skip) continue; for (const c of s.cands) { (p[c.code] = p[c.code] || [0, 0]); p[c.code][0] += c.toA; p[c.code][1] += c.n; const k = fam(c.code); (f[k] = f[k] || [0, 0]); f[k][0] += c.toA; f[k][1] += c.n; A += c.toA; N += c.n; } }
  return { p, f, nat: A / N };
}
const rateOf = (R, code, minN = 2000) => (R.p[code] && R.p[code][1] >= minN ? R.p[code][0] / R.p[code][1] : R.f[fam(code)] ? R.f[fam(code)][0] / R.f[fam(code)][1] : R.nat);
const comp = (s, R) => sum(s.cands.map((c) => c.n * rateOf(R, c.code))) / s.n;
const R22 = rates(s22);
const err = { flat: [], seat: [], compLoo: [], compPrev: [], compPrevSeat: [] }, W = [];
for (const [name, s] of Object.entries(s25)) {
  const Rl = rates(s25, name);
  W.push(s.n);
  err.flat.push(Math.abs(Rl.nat - s.share));
  const prev = s22[name];
  // national level at 2025 given (as E8/E10): shift last-election predictions by the change in the national rate
  const shift = Rl.nat - R22.nat;
  err.seat.push(Math.abs((prev ? prev.share - R22.nat : 0) + Rl.nat - s.share));
  err.compLoo.push(Math.abs(comp(s, Rl) - s.share));
  // composition at 2022 rates, re-levelled so the 2025 national mean is matched (excluding this seat)
  const lev = Rl.nat - sum(Object.entries(s25).filter(([k]) => k !== name).map(([, z]) => z.n * comp(z, R22))) / sum(Object.entries(s25).filter(([k]) => k !== name).map(([, z]) => z.n));
  const cp = comp(s, R22) + lev;
  err.compPrev.push(Math.abs(cp - s.share));
  const resid22 = prev ? prev.share - comp(prev, R22) : 0;
  err.compPrevSeat.push(Math.abs(cp + 0.5 * resid22 - s.share));
}
const wm = (a) => (100 * sum(a.map((x, i) => x * W[i])) / sum(W)).toFixed(2);
console.log(`2025 classic seats with minor-party flows (${W.length}), vote-weighted MAE of the minor-party flow to Labor (pts):`);
console.log(`  one national rate (LOO)                          ${wm(err.flat)}`);
console.log(`  seat's own 2022 gap + national rate              ${wm(err.seat)}`);
console.log(`  parties standing, 2025 rates elsewhere (LOO)     ${wm(err.compLoo)}`);
console.log(`  parties standing, 2022 rates, re-levelled        ${wm(err.compPrev)}`);
console.log(`  ... plus half the seat's 2022 residual           ${wm(err.compPrevSeat)}`);
const R25 = rates(s25);
console.log("  2025 rates by party (>=10k votes): " + Object.entries(R25.p).filter(([, v]) => v[1] >= 10000).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([k, v]) => `${k} ${(100 * v[0] / v[1]).toFixed(0)}`).join(", "));
