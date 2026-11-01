/* state-tables.mjs: a state election's districts given Senate-ballot ranking tables, read from the most
   recent federal Senate ballots at the nearest federal polling place to each state polling place
   (.build/aec-flow-src/senate-ballots/booth-rankings-<year>.json.gz), shrunk toward the state's table
   where few ballots sit behind a cohort, then House-calibrated (the chamber offsets) as the federal model
   is. backtest-states.mjs tests it on six state elections; vic-inputs.mjs uses it for the Victorian
   model. Node only (it reads the stores).

   Returns { SEN, L, fed, sd, tables, distCls, foot }: per district, a ranking table per donor class;
   each district's federal seat type (the class of the federal booths its votes sit nearest); and the
   federal footprint (the district's mapped federal primary shares, for parties that did not stand). */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { stateTable, tiltPair } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const km = (a, b) => { const R = 6371, r = Math.PI / 180; const x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return R * Math.sqrt(x * x + y * y); };
export const COH = ["ALP", "COAL", "GRN", "ON", "OTH-R", "OTH-M", "OTH-L"];
const bucketOfCoh = { ALP: "alp", COAL: "lnp", GRN: "grn", ON: "onp" };

export function stateDistrictTables({ sen, st, res, ST }) {
  const SEN = loadRankings(sen), L = SEN.P.length;
  const fed = J(`map/data/res-${sen}.json`), sd = J(`map/data/${res}.json`);
  const BT = JSON.parse(gunzipSync(readFileSync(`.build/aec-flow-src/senate-ballots/booth-rankings-${sen}.json.gz`)).toString());
  const vec = (sparse) => { const v = new Float64Array(L); for (const [k, n] of Object.entries(sparse || {})) v[+k] = n; return v; };
  const FB = fed.booths, fb = [], fbAll = [];
  for (let i = 0; i < FB.id.length; i++) {
    const dv = fed.divs[FB.d[i]]; if (dv.st !== st || FB.lat[i] == null) continue;
    const t = BT.booths[String(FB.id[i])];
    const pt = { lat: FB.lat[i], lon: FB.lon[i], t, cls: dv.cls };
    if (t) fb.push(pt);
    if (FB.v[i]) { const tot = FB.v[i].reduce((a, b) => a + b, 0); if (tot >= 30) { const sh = {}; FB.v[i].forEach((x, j) => { const c = dv.c[j]; if (c) sh[c[3]] = (sh[c[3]] || 0) + x / tot; }); fbAll.push({ ...pt, sh }); } }
  }
  const SB = sd.booths;
  const distT = sd.divs.map(() => Object.fromEntries(COH.map((k) => [k, new Float64Array(L)])));
  const clsVotes = sd.divs.map(() => ({})), foot = sd.divs.map(() => ({ w: 0 }));
  for (let i = 0; i < SB.id.length; i++) {
    if (SB.lat[i] == null || !SB.v[i]) continue;
    const b = { lat: SB.lat[i], lon: SB.lon[i] };
    let best = null, bd = 1e9; for (const f of fb) { const d = km(b, f); if (d < bd) { bd = d; best = f; } }
    let bestA = null, bdA = 1e9; for (const f of fbAll) { const d = km(b, f); if (d < bdA) { bdA = d; bestA = f; } }
    const dv = sd.divs[SB.d[i]], v = SB.v[i], tot = v.reduce((a, x) => a + x, 0);
    if (bestA && bdA <= 25) { clsVotes[SB.d[i]][bestA.cls] = (clsVotes[SB.d[i]][bestA.cls] || 0) + tot; const F = foot[SB.d[i]]; F.w += tot; for (const k of ["alp", "lnp", "grn", "onp"]) F[k] = (F[k] || 0) + tot * (bestA.sh[k] || 0); }
    if (!best || bd > 25) continue;
    const votesFor = (bk) => v.reduce((a, x, j) => a + (dv.c[j] && (bk === "oth" ? ["oth", "ind"].includes(dv.c[j][3]) : dv.c[j][3] === bk) ? x : 0), 0);
    for (const k of COH) {
      const src = best.t[k]; if (!src) continue;
      const w = votesFor(bucketOfCoh[k] || "oth"); if (w <= 0) continue;
      const s = vec(src), n = s.reduce((a, x) => a + x, 0); if (!n) continue;
      const T = distT[SB.d[i]][k]; for (let p = 0; p < L; p++) T[p] += w * s[p] / n;
    }
  }
  const stT = Object.fromEntries(COH.map((k) => [k, stateTable(SEN, st, k)]));
  const finish = (T, k) => {
    const n = T.reduce((a, x) => a + x, 0), q = new Float64Array(L);
    for (let i = 0; i < L; i++) q[i] = n > 0 ? (T[i] / n) * (n / (n + 400)) + stT[k][i] * (400 / (n + 400)) : stT[k][i];
    let out = q;
    for (const [kk, d] of Object.entries(ST.delta)) { const [c, pair] = kk.split("|"); if (c !== k) continue; out = tiltPair(SEN, out, "ACGO".indexOf(pair[0]), "ACGO".indexOf(pair[1]), d); }
    return out;
  };
  const tables = distT.map((o) => Object.fromEntries(COH.map((k) => [k, finish(o[k], k)])));
  const distCls = clsVotes.map((o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || "Rural");
  return { SEN, L, fed, sd, tables, distCls, foot };
}
