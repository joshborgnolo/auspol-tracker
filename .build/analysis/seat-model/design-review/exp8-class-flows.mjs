// E8a: does seat classification predict a seat's preference flows at the NEXT election better than the national rate?
// Classic (ALP v Coalition) seats, per-seat TCP flows from the map data (fl = [cand, votes to tcp[0], votes to tcp[1]]).
import { load, sum, mean } from "./lib.mjs";
const YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025];
const CLS = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", "Provincial": "prov", "Rural": "rural" };
const bucketOf = (b) => (b === "grn" ? "grn" : b === "onp" ? "onp" : b === "alp" || b === "lnp" ? null : "oth");
const data = {};
for (const y of YEARS) {
  const D = load(`maps/data/res-${y}.json`);
  const seats = {};
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2) continue;
    const pair = dv.tcp.map((t) => dv.c[t[0]][3]);
    if (!(pair.includes("alp") && pair.includes("lnp"))) continue;
    const alpIdx = pair.indexOf("alp");
    const acc = {};
    for (const f of dv.fl || []) {
      const b = bucketOf(dv.c[f[0]][3]); if (!b) continue;
      const toAlp = alpIdx === 0 ? f[1] : f[2], tot = f[1] + f[2];
      acc[b] = acc[b] || [0, 0]; acc[b][0] += toAlp; acc[b][1] += tot;
    }
    seats[dv.n] = { cls: CLS[dv.cls] || dv.cls, uni: dv.demo?.uni, acc };
  }
  data[y] = seats;
}
function rates(seats, donor) {
  const nat = [0, 0], cls = {};
  for (const s of Object.values(seats)) { const a = s.acc[donor]; if (!a || a[1] < 200) continue; nat[0] += a[0]; nat[1] += a[1]; cls[s.cls] = cls[s.cls] || [0, 0]; cls[s.cls][0] += a[0]; cls[s.cls][1] += a[1]; }
  return { nat: nat[0] / nat[1], cls: Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, v[0] / v[1]])) };
}
console.log("Predicting each classic seat's donor->Labor share at election E, given the national level at E (so only the seat-to-seat pattern is tested).");
console.log("Vote-weighted mean absolute error, pts. 'class(E-1)' = national(E) + that class's gap at E-1; 'seat(E-1)' = national(E) + the seat's own gap at E-1;");
console.log("'shrunk' = national(E) + 0.5*seat gap + 0.5*class gap; 'class(E) oracle' = the class rates of election E itself (the ceiling for any class adjustment).\n");
for (const donor of ["grn", "onp", "oth"]) {
  console.log(`${donor.toUpperCase()}   E      n   flat   class(E-1)  seat(E-1)  shrunk   class(E) oracle`);
  const tot = { flat: [0, 0], cprev: [0, 0], seat: [0, 0], shrunk: [0, 0], cnow: [0, 0] };
  for (let i = 1; i < YEARS.length; i++) {
    const E = YEARS[i], P = YEARS[i - 1];
    const rE = rates(data[E], donor), rP = rates(data[P], donor);
    const acc = { flat: [0, 0], cprev: [0, 0], seat: [0, 0], shrunk: [0, 0], cnow: [0, 0] };
    let n = 0;
    for (const [name, s] of Object.entries(data[E])) {
      const a = s.acc[donor]; if (!a || a[1] < 200) continue;
      const actual = a[0] / a[1], w = a[1];
      const prevSeat = data[P][name]?.acc[donor];
      if (!prevSeat || prevSeat[1] < 200 || rP.cls[s.cls] == null) continue;   // same seat set for every column
      n++;
      const clsGap = rP.cls[s.cls] - rP.nat, seatGap = prevSeat[0] / prevSeat[1] - rP.nat;
      const preds = { flat: rE.nat, cprev: rE.nat + clsGap, seat: rE.nat + seatGap, shrunk: rE.nat + 0.5 * seatGap + 0.5 * clsGap, cnow: rE.cls[s.cls] };
      for (const k of Object.keys(preds)) { acc[k][0] += w * Math.abs(preds[k] - actual); acc[k][1] += w; tot[k][0] += w * Math.abs(preds[k] - actual); tot[k][1] += w; }
    }
    if (n < 5) { console.log(`      ${E}  ${String(n).padStart(4)}   (too few)`); continue; }
    const f = (k) => (100 * acc[k][0] / acc[k][1]).toFixed(2).padStart(6);
    console.log(`      ${E}  ${String(n).padStart(4)}  ${f("flat")}     ${f("cprev")}     ${f("seat")}  ${f("shrunk")}        ${f("cnow")}`);
  }
  const g = (k) => (100 * tot[k][0] / tot[k][1]).toFixed(2).padStart(6);
  console.log(`      all         ${g("flat")}     ${g("cprev")}     ${g("seat")}  ${g("shrunk")}        ${g("cnow")}\n`);
}
