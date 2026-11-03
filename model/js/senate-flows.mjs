/* senate-flows.mjs: the seat model's preference layer, built on Senate ballot rankings.

   data/senate-rankings-<year>.json (extract-senate-rankings.py) gives, per division and
   first-preference cohort, how many ballots ranked Labor (A), the Coalition (C), the Greens (G)
   and One Nation (O) in each order. A House count among those four families can be replayed
   exactly on those orders: whoever is excluded, each ballot sits with the first of the four it
   names among the candidates still standing. So no pairwise flow table and no "renormalise over
   whoever is left" (Luce) assumption is needed; tested 2026-11-01, that assumption misplaces
   right-wing minor parties' three-way splits by ~12 pts and inherited votes by up to ~27.

   Ballots naming none of the standing families are shared out in proportion to those that name
   one (the same rule as the "share of those naming either" figures that matched the House).

   Exports:
     loadRankings(year)              tables per division / state / nation, with aggregate cohorts
                                     (COAL = all Coalition subs; OTH, OTH-R/-L/-M by class)
     cohortKeyFor(candidate)         House candidate -> Senate cohort key (party name rules)
     cohortTable(R, div, key)        probability vector over the 65 orders, shrunk toward the
                                     state and national tables when the cohort is thin
     tiltPair(p, x, y, dLogit)       House calibration: multiply the ballots ranking x ahead of y
     moveFirst(p, fam)               the same voters re-ranked with `fam` first (switchers)
     routing(p)                      F[S][y]: share whose first family among set S is y;
                                     G[x][S][y]: the same for ballots currently held by x
                                     (first among S+x is x), so later rounds stay path-exact
*/
/* Pure: no node imports, so the /model/ page runs this same file in the browser (copied there by
   .build/model/assemble.mjs). senate-io.mjs holds the node file loader. */

export const FAM = ["A", "C", "G", "O"];
export const FAM_OF_GROUP = { alp: 0, lp: 1, np: 1, lnp: 1, clp: 1, grn: 2, on: 3 };
const popcount = (S) => ((S & 1) + ((S >> 1) & 1) + ((S >> 2) & 1) + ((S >> 3) & 1));

/* ---- party names -> Senate sub-families (same rules as extract-senate-rankings.py) ---- */
export const SUB_CLASS = {
  TOP: "R", FF: "R", LDP: "R", KAP: "R", XTN: "R", CIT: "R", GAP: "R", SFF: "R", RGT: "R",
  AJP: "L", SOC: "L", FUS: "L", IAP: "L", AV: "L", REA: "L",
  LCA: "M", SAP: "M", DEM: "M", JLN: "M", POC: "M", CTR: "M", IND: "M",
};
const RULES = [
  [/one nation/, "ON"], [/^a\.l\.p|labor\b|labor party|country labor/, "ALP"], [/democratic labou?r|labour dlp|\bdlp\b/, "OTH:RGT"],
  [/green/, "GRN"], [/^lnp$|liberal national/, "COAL:LNP"], [/country liberal|^nt clp$|\bclp\b/, "COAL:CLP"],
  [/liberal ?& ?national|liberal\/the nationals|liberal and nationals/, "COAL:LN"], [/liberal democrat/, "OTH:LDP"],
  [/^liberal$|^liberal party|^the liberal party/, "COAL:LIB"], [/conservative national|anning/, "OTH:RGT"],
  [/^the nationals|^national party|^nationals/, "COAL:NAT"], [/trumpet|united australia|palmer/, "OTH:TOP"],
  [/family first/, "OTH:FF"], [/katter/, "OTH:KAP"], [/rennick|libertarian|heart/, "OTH:LDP"], [/christian|fred nile/, "OTH:XTN"],
  [/citizens/, "OTH:CIT"], [/great australian/, "OTH:GAP"], [/shooters/, "OTH:SFF"],
  [/liberty alliance|conservatives|rise up|australia first|nationalist|sustainable population|australian federation|informed medical|values party|better families|antipaedophile|seniors united|no carbon tax|smokers|australian liberty/, "OTH:RGT"],
  [/animal justice/, "OTH:AJP"], [/cannabis|marijuana|hemp/, "OTH:LCA"], [/socialist/, "OTH:SOC"], [/fusion|science|pirate|secular|climate/, "OTH:FUS"],
  [/sustainable australia/, "OTH:SAP"], [/democrats/, "OTH:DEM"], [/indigenous|aboriginal/, "OTH:IAP"], [/australia's voice/, "OTH:AV"],
  [/sex party|reason/, "OTH:REA"], [/lambie/, "OTH:JLN"], [/pocock/, "OTH:POC"], [/xenophon|centre alliance|hinch|lazarus|justice party/, "OTH:CTR"],
];
export function subOfName(name) {
  const n = String(name || "").trim().toLowerCase();
  for (const [rx, k] of RULES) if (rx.test(n)) return k;
  return "OTH:IND";
}
/* House candidate {group, party (code), partyName} -> cohort key */
export function cohortKeyFor(c) {
  if (c.group === "alp") return "ALP";
  if (c.group === "grn") return "GRN";
  if (c.group === "on") return "ON";
  if (c.group === "lp") return "COAL:LIB";
  if (c.group === "np") return "COAL:NAT";
  if (c.group === "lnp" || c.group === "clp") return "COAL";
  if (String(c.group).startsWith("member") || c.group === "ind-declared" || c.party === "IND" || !c.party) return "OTH-M";
  const k = subOfName(c.partyName || "");
  return k.startsWith("OTH:") ? k : "OTH-M";
}

/* ---- rankings: from the parsed data/senate-rankings-<year>.json (senate-io.mjs reads the file in node;
   the /model/ page's worker fetches it) ---- */
export function rankingsFrom(j, year = j.year) {
  const P = j.patterns, L = P.length;
  const pat = P.map((p) => [...p].map((ch) => FAM.indexOf(ch)));
  const pidx = Object.fromEntries(P.map((p, i) => [p, i]));
  const div = {}, state = {}, nat = {};
  const add = (store, key, v) => { const t = (store[key] = store[key] || new Float64Array(L)); for (let i = 0; i < L; i++) t[i] += v[i]; };
  for (const [name, d] of Object.entries(j.divisions)) {
    const D = (div[name] = { st: d.st, n: d.n, t: {} });
    const S = (state[d.st] = state[d.st] || {});
    for (const [c, sparse] of Object.entries(d.t)) {
      const v = new Float64Array(L);
      for (const [k, n] of Object.entries(sparse)) v[+k] = n;
      const keys = [c];
      if (c.startsWith("COAL:")) keys.push("COAL");
      if (c.startsWith("OTH:")) keys.push("OTH", "OTH-" + (j.subClass[c.slice(4)] || "M"));
      for (const k of keys) { add(D.t, k, v); add(S, k, v); add(nat, k, v); }
    }
  }
  /* ---- zero-One-Nation states: ACT every year so far, NT 2016-2022 - One Nation never stood a
     Senate ticket there, so no ACT/NT ballot can rank O anywhere and a House count with One Nation
     standing (the ACT's real 2022 field had one House candidate per seat; the model's 2028
     assumption adds one there too) would receive ~no transfers to it, however its voters would
     have marked it. Graft O into the state's tables: each base order's ballots re-split among O's
     insertion positions - and the never-rank-it base itself - by how the same cohort's ballots
     placed O in the states where it stood (the raw national tables net of the zero-O states).
     Every split lands on patterns projecting back to the same base, so masses are preserved and
     every routing, tilt and pair share over a standing set without O is identical: the 2025
     replay and every O-free count run bitwise unchanged. */
  {
    const byBase = new Array(L);
    for (let i = 0; i < L; i++) (byBase[pidx[P[i].replace("O", "")]] ||= []).push(i);
    const hasO = {};
    for (const d of Object.values(j.divisions)) for (const sparse of Object.values(d.t))
      for (const [k, n] of Object.entries(sparse)) if (n > 0 && P[+k].includes("O")) hasO[d.st] = true;
    const zeroO = new Set();
    for (const d of Object.values(j.divisions)) zeroO.add(d.st);
    for (const st of Object.keys(hasO)) zeroO.delete(st);
    if (zeroO.size) {
      const natX = {};
      for (const [name, d] of Object.entries(j.divisions)) {
        if (zeroO.has(d.st)) continue;
        for (const [c, sparse] of Object.entries(d.t)) {
          const v = new Float64Array(L);
          for (const [k, n] of Object.entries(sparse)) v[+k] = n;
          const keys = [c];
          if (c.startsWith("COAL:")) keys.push("COAL");
          if (c.startsWith("OTH:")) keys.push("OTH", "OTH-" + (j.subClass[c.slice(4)] || "M"));
          for (const k of keys) add(natX, k, v);
        }
      }
      const refFor = (key) => { for (const k of fallbackKeys(key)) if (natX[k] && total(natX[k]) > 0) return natX[k]; return null; };
      const graft = (v, ref) => {
        const out = new Float64Array(L);
        for (let b = 0; b < L; b++) {
          const w = v[b]; if (!w) continue;
          const ins = byBase[b];
          let rt = 0;
          for (const i of ins) rt += ref[i];
          if (rt <= 0) { out[b] += w; continue; }
          for (const i of ins) out[i] += w * ref[i] / rt;
        }
        return out;
      };
      for (const st of zeroO) {
        for (const [k, v] of Object.entries(state[st] || {})) { const ref = refFor(k); if (ref) state[st][k] = graft(v, ref); }
        for (const d of Object.values(div)) if (d.st === st) for (const [k, v] of Object.entries(d.t)) { const ref = refFor(k); if (ref) d.t[k] = graft(v, ref); }
      }
    }
  }
  return { year, P, pat, pidx, div, state, nat };
}
const total = (v) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i]; return s; };
const fallbackKeys = (key) => key.startsWith("OTH:") ? [key, "OTH-" + (SUB_CLASS[key.slice(4)] || "M"), "OTH"]
  : key.startsWith("OTH-") ? [key, "OTH"] : key.startsWith("COAL:") ? [key, "COAL"] : [key];
/* shrunk probability vector: division counts + N_DIV pseudo-ballots of the state table, whose own
   counts carry N_ST pseudo-ballots of the national table; a key missing at a level drops to its
   class (sub-family -> R/L/M -> all others; Coalition sub -> Coalition) */
export const N_DIV = 400, N_ST = 2000;
export function cohortTable(R, divName, key) {
  const L = R.P.length;
  const pick = (store) => { for (const k of fallbackKeys(key)) if (store?.[k] && total(store[k]) > 0) return store[k]; return null; };
  const natT = pick(R.nat);
  if (!natT) throw new Error(`no Senate table at all for cohort ${key}`);
  const pn = natT.map((x) => x / total(natT));
  const d = R.div[divName];
  const stT = d ? pick(R.state[d.st]) : null;
  const ps = new Float64Array(L);
  const ns = stT ? total(stT) : 0;
  for (let i = 0; i < L; i++) ps[i] = ((stT ? stT[i] : 0) + N_ST * pn[i]) / (ns + N_ST);
  /* the division table must be the SAME key as the state's (a Coalition sub absent in the division
     but present in the state falls through to the state's sub, not the division's pooled table) */
  let dv = null;
  if (d) for (const k of fallbackKeys(key)) { if (d.t[k] && total(d.t[k]) > 0) { dv = d.t[k]; break; } if (R.state[d.st]?.[k]) break; }
  const nd = dv ? total(dv) : 0;
  const p = new Float64Array(L);
  for (let i = 0; i < L; i++) p[i] = ((dv ? dv[i] : 0) + N_DIV * ps[i]) / (nd + N_DIV);
  return p;
}
/* the state's table (shrunk toward the nation), no division term */
export function stateTable(R, st, key) {
  const L = R.P.length;
  const pick = (store) => { for (const k of fallbackKeys(key)) if (store?.[k] && total(store[k]) > 0) return store[k]; return null; };
  const natT = pick(R.nat), stT = pick(R.state[st]);
  const pn = natT.map((x) => x / total(natT)), ns = stT ? total(stT) : 0, ps = new Float64Array(L);
  for (let i = 0; i < L; i++) ps[i] = ((stT ? stT[i] : 0) + N_ST * pn[i]) / (ns + N_ST);
  return ps;
}
/* share ranking x ahead of y among ballots naming either (x, y family indexes) */
export function pairShare(R, p, x, y) {
  let a = 0, b = 0;
  for (let i = 0; i < p.length; i++) {
    if (!p[i]) continue;
    const q = R.pat[i], ix = q.indexOf(x), iy = q.indexOf(y);
    if (ix < 0 && iy < 0) continue;
    if (iy < 0 || (ix >= 0 && ix < iy)) a += p[i]; else b += p[i];
  }
  return a + b > 0 ? a / (a + b) : 0.5;
}
/* House calibration: logit shift dLogit on the x-ahead-of-y pair share (exact for one pair) */
export function tiltPair(R, p, x, y, dLogit) {
  if (!dLogit) return p;
  const k = Math.exp(dLogit), out = new Float64Array(p.length);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = R.pat[i], ix = q.indexOf(x), iy = q.indexOf(y);
    const ahead = ix >= 0 && (iy < 0 || ix < iy);
    out[i] = p[i] * (ahead ? k : 1);
    s += out[i];
  }
  // keep ballots naming neither at their share: rescale only the named part
  let named0 = 0, named1 = 0;
  for (let i = 0; i < p.length; i++) { const q = R.pat[i]; if (q.indexOf(x) >= 0 || q.indexOf(y) >= 0) { named0 += p[i]; named1 += out[i]; } }
  const f = named1 > 0 ? named0 / named1 : 1;
  for (let i = 0; i < p.length; i++) { const q = R.pat[i]; if (q.indexOf(x) >= 0 || q.indexOf(y) >= 0) out[i] *= f; }
  return out;
}
/* switchers: the same ballots with family `fam` moved to the front */
export function moveFirst(R, p, fam) {
  const ch = FAM[fam], out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) {
    if (!p[i]) continue;
    const np = ch + R.P[i].replace(ch, "");
    out[R.pidx[np]] += p[i];
  }
  return out;
}
export function mix(parts) { // [[weight, vector]]
  const L = parts[0][1].length, out = new Float64Array(L); let w = 0;
  for (const [a, v] of parts) { w += a; for (let i = 0; i < L; i++) out[i] += a * v[i]; }
  for (let i = 0; i < L; i++) out[i] /= w || 1;
  return out;
}
/* routing tables. F[S*4+y]; G[(x*16+S)*4+y] for x not in S */
export function routing(R, p) {
  const L = p.length, F = new Float64Array(64), G = new Float64Array(256);
  const firstIn = (q, S) => { for (const f of q) if ((S >> f) & 1) return f; return -1; };
  const unnamed = new Float64Array(16);
  for (let S = 1; S < 16; S++) {
    const acc = [0, 0, 0, 0]; let un = 0;
    for (let i = 0; i < L; i++) { if (!p[i]) continue; const f = firstIn(R.pat[i], S); if (f < 0) un += p[i]; else acc[f] += p[i]; }
    const t = acc[0] + acc[1] + acc[2] + acc[3];
    for (let y = 0; y < 4; y++) F[S * 4 + y] = t > 0 ? acc[y] / t : ((S >> y) & 1) / popcount(S);
    unnamed[S] = un;
  }
  for (let x = 0; x < 4; x++) for (let S = 1; S < 16; S++) {
    if ((S >> x) & 1) continue;
    const Sx = S | (1 << x);
    const acc = [0, 0, 0, 0]; let named = 0;
    for (let i = 0; i < L; i++) {
      if (!p[i]) continue;
      const q = R.pat[i];
      if (firstIn(q, Sx) !== x) continue;
      named += p[i];
      const f = firstIn(q, S);
      if (f >= 0) acc[f] += p[i]; // ballots naming x but none of S: shared out below
    }
    const t = acc[0] + acc[1] + acc[2] + acc[3];
    const unX = unnamed[Sx] * F[Sx * 4 + x];           // never-named ballots x was holding
    const restX = named - t;                            // named x, nothing in S
    for (let y = 0; y < 4; y++) {
      const cond = t > 0 ? acc[y] / t : F[S * 4 + y];
      const w = t + restX + unX;
      G[(x * 16 + S) * 4 + y] = w > 0 ? (t * cond + (restX + unX) * F[S * 4 + y]) / w : F[S * 4 + y];
    }
  }
  return { F, G };
}
