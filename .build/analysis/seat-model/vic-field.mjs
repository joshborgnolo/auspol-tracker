/* vic-field.mjs: who is on Victoria's 2026 ballot papers, and where each candidate starts (node; vic-inputs.mjs
   builds the model's districts from it).

   The field is the VEC's own: data/vic-candidates-2026.json, every district's candidates in ballot order as
   nominations closed on 9 November 2026 (734 candidates). Each gets a starting share on the scale of the
   2022 count, which the model's swing then moves:
     Labor, Greens          the party's 2022 Assembly share in the district (Labor did not stand in Narracan's
                            supplementary election: its 2022 Council share there, scaled as below)
     the Coalition          the Liberal and National 2022 shares together where one of them stands now; where
                            both stand (Ripon) the 2022 share split as their last contest there split it
     One Nation             its federal 2025 vote at the federal polling places nearest the district's own
                            (state-tables.mjs `foot`), in all 88 - it stood in five in 2022, too few to scale
     a minor party          its 2022 Assembly share in the district; where it did not stand for the Assembly,
                            its 2022 Legislative Council share there (data/vic-lc-2022-by-district.json) times
                            how its Assembly vote compared with its Council vote where it stood for both; a
                            candidate who stood here in 2022 under another label starts from their own share;
                            a party new to the ballot starts at the median 2022 minor-party candidate's share
     an independent         their own 2022 share if they stood here as an independent then; otherwise the median
                            2022 independent's share, with the spread of 2022's independents as their noise
                            (`sig`: a new independent is a draw from that record, not a known quantity)
   Sitting members (calibrate-state-swing.mjs `pooled`, one pair of terms for Labor, the Coalition and, borrowed,
   the Greens): the district's sitting member - the 2022 winner, or the winner of a by-election since -
   standing again for their party carries `rec`; a party that won the district in 2022 and no longer has that
   member as its candidate carries `ret`. A by-election successor of the same party carries both (the old
   member's personal vote went, the new member's is younger). */
import { readFileSync } from "node:fs";
import { subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";
import { flowClassOf } from "./seat-inputs.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const logit = (p) => Math.log(p / (1 - p));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const letters = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").trim();

/* the VEC's registered party names -> the model's groups; minor parties carry their 2022 Assembly code and
   2022 Council group name where they stood then */
export const MAJOR = {
  "Australian Labor Party - Victorian Branch": { g: "alp", ab: "ALP" },
  "Liberal Party of Australia - Victorian Division": { g: "lp", ab: "LIB" },
  "National Party of Australia - Victoria": { g: "np", ab: "NAT" },
  "Australian Greens Victoria": { g: "grn", ab: "GRN" },
  "One Nation Victoria": { g: "on", ab: "ON" },
};
export const MINOR = {
  "Victorian Socialists": { ab: "VS", la22: "VS", lc22: "Victorian Socialists" },
  "Family First Victoria": { ab: "FF", la22: "FFP", lc22: "Family First Victoria" },
  "Animal Justice Party": { ab: "AJP", la22: "AJP", lc22: "Animal Justice Party" },
  "Libertarian Party (formerly Liberal Democrats)": { ab: "LBT", la22: "LDP", lc22: "Liberal Democrats" },
  "Democratic Labour Party (DLP)": { ab: "DLP", la22: "DLP", lc22: "Labour DLP" },
  "Legalise Cannabis Victoria": { ab: "LC", la22: "LCP", lc22: "Legalise Cannabis Victoria" },
  "Shooters, Fishers and Farmers Party Victoria": { ab: "SFF", la22: "SFF", lc22: "Shooters, Fishers & Farmers Vic" },
  "The West Party": { ab: "WP" }, "The Republican Make Australia Great Again": { ab: "REP" }, "Socialist Alliance": { ab: "SA" },
  "Free Palestine": { ab: "FP" }, "Australian Citizens Party (Victorian Division)": { ab: "CIT" }, "I'm Voting to Avoid the Fine": { ab: "IVAF" },
  "Climate Action Now": { ab: "CAN" }, "Australian Democrats": { ab: "DEM" }, "Safety Victoria – Violent Crime Prevention": { ab: "SV" },
};
/* Victorian parties the shared name rules (senate-flows.mjs) do not know and would file in the centre: the
   2022 Freedom Party, Angry Victorians and Health Australia, and 2026's Republican (Make Australia Great
   Again) on the right; Free Palestine on the left */
const VIC_RIGHT = /freedom party|angry victorians|health australia|republican make australia great again/i, VIC_LEFT = /free palestine/i;
export const flowKeyOf = (group, partyName) => (group === "alp" ? "ALP" : ["lp", "np"].includes(group) ? "COAL" : group === "grn" ? "GRN" : group === "on" ? "ON"
  : String(group).startsWith("member") ? "OTH-M" : VIC_RIGHT.test(partyName) ? "OTH-R" : VIC_LEFT.test(partyName) ? "OTH-L"
  : (() => { const s = subOfName(partyName); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; })());
const P5I = (g) => (g === "alp" ? 0 : ["lp", "np"].includes(g) ? 1 : g === "on" ? 2 : g === "grn" ? 3 : 4);

/* "McKEEMAN, Lachie" -> "Lachie McKeeman"; "VAN KEULEN, L" stays readable */
export function displayName(vec) {
  const [sur, giv = ""] = vec.split(",").map((x) => x.trim());
  const cap = (w) => w.split(/([-'’ ])/).map((p) => (/^[-'’ ]$/.test(p) ? p : /^M[cC][A-Z]/.test(p) && p.length > 3 ? "Mc" + p[2] + p.slice(3).toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join("");
  return `${giv} ${cap(sur)}`.trim();
}
/* the same person in the 2022 store ("Nina Taylor") and on the 2026 ballot ("TAYLOR, Nina"): surname's last
   word + first given name */
const key22 = (n) => { const p = letters(n).split(/\s+/); return p[p.length - 1] + "|" + p[0]; };
const key26 = (n) => { const [s, g = ""] = n.split(","); return letters(s).split(/\s+/).pop() + "|" + letters(g).split(/\s+/)[0]; };

export function vicField({ sd, foot, terms }) {
  const NOM = J("data/vic-candidates-2026.json"), LC = J("data/vic-lc-2022-by-district.json").districts;
  const older = ["res-vic18", "res-vic14"].map((r) => J(`map/data/${r}.json`));
  const plan = J("map/data/la-seating-plan-vic-2026-08-11.json").divisions;
  // 2022's record of independents and minor-party candidates: the medians and the independents' spread
  const ind22 = [], minor22 = [];
  for (const dv of sd.divs) { const tot = sum(dv.c.map((c) => c[4])); for (const c of dv.c) { if (c[3] === "ind") ind22.push(c[4] / tot); else if (c[3] === "oth") minor22.push(c[4] / tot); } }
  const lg = ind22.map(logit), mu = sum(lg) / lg.length;
  const record = { independents: ind22.length, medianIndependent: median(ind22), sigIndependent: Math.sqrt(sum(lg.map((x) => (x - mu) ** 2)) / lg.length), minorCandidates: minor22.length, medianMinor: median(minor22) };
  // a party's Assembly vote against its Council vote, over the districts where it stood for both in 2022
  const lcRatio = (laPred, lcName) => { let a = 0, b = 0; for (const dv of sd.divs) { const v = sum(dv.c.filter(laPred).map((c) => c[4])); if (v > 0) { a += v / sum(dv.c.map((c) => c[4])); b += (LC[dv.n].groups[lcName] || 0) / LC[dv.n].formal; } } return b > 0 ? a / b : null; };
  const ratio = { alp: lcRatio((c) => c[3] === "alp", "Australian Labor Party - Victorian Branch") };
  for (const [name, m] of Object.entries(MINOR)) if (m.lc22) ratio[name] = lcRatio((c) => c[1] === m.la22, m.lc22);
  const tallies = { candidates: 0, standingAgain: 0, memberGone: 0, src: {} };
  const seats = sd.divs.map((dv, i) => {
    const noms = NOM.districts[dv.n]; if (!noms) throw new Error(`no 2026 nominations for ${dv.n}`);
    const tot = sum(dv.c.map((c) => c[4])), sh = (pred) => sum(dv.c.filter(pred).map((c) => c[4])) / tot;
    const lcShare = (lcName) => (LC[dv.n].groups[lcName] || 0) / LC[dv.n].formal;
    const coalNow = noms.filter((c) => ["lp", "np"].includes(MAJOR[c.party]?.g));
    const w22 = dv.c.find((c) => c[6] === 1), w22b = w22[3], w22key = key22(w22[0]);
    const cands = noms.map((c, ballot) => {
      const M = MAJOR[c.party], mi = MINOR[c.party], label = displayName(c.name);
      const same22 = dv.c.find((x) => key22(x[0]) === key26(c.name));     // this person on this district's 2022 ballot
      let g, base, src, sig;
      if (M) {
        g = M.g;
        if (g === "alp") { base = sh((x) => x[3] === "alp"); src = "2022"; if (!(base > 0)) { base = lcShare("Australian Labor Party - Victorian Branch") * ratio.alp; src = "council"; } }
        else if (g === "grn") { base = sh((x) => x[3] === "grn"); src = "2022"; }
        else if (g === "on") { const f = foot[i]; base = f.w ? (f.onp || 0) / f.w : 0.01; src = "footprint"; }
        else {
          const all = sh((x) => x[3] === "lnp"); src = "2022";
          if (coalNow.length === 1) base = all;
          else {                                                      // both partners stand: the split of their last contest here
            const own = sh((x) => x[3] === "lnp" && x[1] === M.ab);
            const both22 = sh((x) => x[1] === "LIB") > 0 && sh((x) => x[1] === "NAT") > 0;
            if (both22) base = own;
            else {
              let frac = 0.5;
              for (const O of older) { const od = O.divs.find((d) => d.n === dv.n); if (!od) continue; const l = sum(od.c.filter((x) => x[1] === "LIB").map((x) => x[4])), n = sum(od.c.filter((x) => x[1] === "NAT").map((x) => x[4])); if (l > 0 && n > 0) { frac = (M.ab === "LIB" ? l : n) / (l + n); src = `2022, split as in ${O.year || O.date?.slice(0, 4) || "its last three-cornered contest"}`; break; } }
              base = all * frac;
            }
          }
        }
      } else if (c.party) {
        g = "oth";
        const own = mi?.la22 ? sh((x) => x[1] === mi.la22) : 0;
        if (own > 0) { base = own; src = "2022"; }
        else if (same22 && ["ind", "oth"].includes(same22[3])) { base = same22[4] / tot; src = "same-person"; }
        else if (mi?.lc22 && ratio[c.party] && lcShare(mi.lc22) > 0) { base = lcShare(mi.lc22) * ratio[c.party]; src = "council"; }
        else { base = record.medianMinor; src = "median"; }
      } else {
        g = "member:" + label;
        if (same22 && same22[3] === "ind") { base = same22[4] / tot; src = "2022"; }
        else { base = record.medianIndependent; src = "median"; sig = record.sigIndependent; }
      }
      base = Math.max(0.003, base);
      const key = flowKeyOf(g, c.party || "Independent"), cls = flowClassOf(key);
      const out = { label, group: g, party: M?.ab || mi?.ab || (c.party ? "OTH" : "IND"), partyName: c.party || "Independent", base, p5: P5I(g), fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), key, cls, clsIdx: FLOW_CLASSES.indexOf(cls), src, ballot: ballot + 1 };
      if (g === "on") out.added = true;                               // the card's note: this base is not a 2022 share
      if (sig != null) out.sig = Math.round(sig * 1e4) / 1e4;
      tallies.src[src.startsWith("2022, split") ? "2022" : src] = (tallies.src[src.startsWith("2022, split") ? "2022" : src] || 0) + 1;
      return out;
    });
    tallies.candidates += cands.length;
    // who holds the district now (the Assembly's seating plan of 11 August 2026), and whether that member is on the ballot
    const bOf = (c) => (c.group === "alp" ? "alp" : ["lp", "np"].includes(c.group) ? "lnp" : c.group === "grn" ? "grn" : c.group === "on" ? "onp" : c.isInd ? "ind" : "oth");
    const now = plan[dv.n], g22 = w22b === "alp" ? "alp" : w22b === "lnp" ? ({ LIB: "lp", NAT: "np" }[w22[1]] || "lp") : w22b === "grn" ? "grn" : w22b === "ind" ? "member:" + w22[0] : "oth";
    const heldGroup = now ? (now.p === "L/N" ? (["lp", "np"].includes(g22) ? g22 : "lp") : { ALP: "alp", GRN: "grn" }[now.p] || "member:" + now.m) : g22;
    const nowB = now ? { ALP: "alp", "L/N": "lnp", GRN: "grn" }[now.p] || "ind" : w22b;
    const nowKey = now ? key22(now.m) : w22key, onBallot = noms.findIndex((c) => key26(c.name) === nowKey);
    const standing = onBallot >= 0 && bOf(cands[onBallot]) === nowB;        // the sitting member, for the party they sit for
    // the terms: the sitting member standing again; the 2022 winner's party without that member
    const add = (c, v) => { c.adj = Math.round(((c.adj || 0) + v) * 1e4) / 1e4; };
    const again = noms.findIndex((c) => key26(c.name) === w22key), kept = again >= 0 && bOf(cands[again]) === w22b;
    if (standing && terms[nowB]) { add(cands[onBallot], terms[nowB].rec); cands[onBallot].member = true; }
    if (!kept && terms[w22b]) for (const c of cands) if (bOf(c) === w22b) add(c, terms[w22b].ret);
    if (standing) tallies.standingAgain++; else tallies.memberGone++;
    const member2022 = { name: w22[0], bucket: w22b, standing: kept };
    return { name: dv.n, cands, member2022,
      held: { group: heldGroup, member: now?.m || w22[0], party: now?.p || w22[1], standing, as: standing ? cands[onBallot].label : null },
      won2022: { group: g22, name: w22[0], party: w22[2] },
      tcp2022: dv.tcp ? dv.tcp.map((t) => ({ name: dv.c[t[0]][0], party: dv.c[t[0]][2], bucket: dv.c[t[0]][3], votes: t[1] })) : null };
  });
  return { seats, record, ratio, tallies, asAt: NOM.asAt, source: NOM.source };
}
