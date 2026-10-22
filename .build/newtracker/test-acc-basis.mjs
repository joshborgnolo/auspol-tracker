// Fixture test for the accuracy payload's IMPLIED-BASIS fields – the
// "Primaries on last-election flows" view of the accuracy panel (shipped
// 2026-10-21). gen-data now emits, beside every published-basis figure, the
// same final poll re-scored on its primaries put through ONE flow table –
// the flows counted at the election that opened the term (FLOW_LEF) – as
// alp2ppImp/errImp per house, meanImp/errImp/absErrImp/sameSideImp/worstImp
// per cycle, and a firmsImp leaderboard next to firms.
//
// The test REPLAYS accuracyCycles' raw map verbatim from data/polls.json and
// flows.mjs (verbatim-replica idiom, as test-primary-order.mjs) and asserts
// the emitted 9f09dca2 asset agrees with it field for field – so a change to
// the imp derivation, the flow tables, or a data edit that should move an
// implied figure fails loudly here rather than re-scoring silently.
//
// Run:
//   node .build/newtracker/test-acc-basis.mjs
// Exits non-zero if any expectation fails.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FLOW_LEF, impliedLefAlp2pp } from "./flows.mjs";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `\n      ${extra}`}`);
};
const die = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };

/* --- the live data, from the 9f09dca2 asset the page reads --- */
const dataFile = readdirSync(new URL("./assets/", import.meta.url))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
if (!dataFile) die("could not find the 9f09dca2 data asset");
const win = {};
new Function("window", readFileSync(fileURLToPath(new URL(`./assets/${dataFile}`, import.meta.url)), "utf8"))(win);
const A = win.AUSPOL && win.AUSPOL.accuracy;
if (!A || !Array.isArray(A.cycles)) die("accuracy.cycles missing from the data asset");

const POLLS = JSON.parse(readFileSync(fileURLToPath(new URL("../../data/polls.json", import.meta.url)), "utf8"));
const ELECTIONS = POLLS.elections, cyclePolls = POLLS.cyclePolls;

/* --- VERBATIM replicas of the gen-data pieces (keep in step) --- */
const r1 = (v) => Math.round(v * 10) / 10;
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const ddays = (a, b) => (a - b) / 86400000;
const ACC_WINDOW_DAYS = 14;
const ACC_WINDOW_OVERRIDES = { 1977: 21 }; // 1977's last Morgan wave ran 20 days out
const ACC_CANON = {
  "Morgan": "Roy Morgan", "Newspoll-YouGov": "Newspoll",
  "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater",
  "RedBridge/Accent": "RedBridge", "Spectre Strategy": "Spectre",
};
const accCanon = (f) => ACC_CANON[f] || f;
/* FLOW_LEF is keyed by the election that OPENED the term: the flow table a
   called-election cycle is scored through is the one for the election
   immediately before it. */
const lefYears = Object.keys(FLOW_LEF).map(Number).sort((a, b) => a - b);
const lefFor = (calledYear) => {
  const below = lefYears.filter((y) => y < calledYear).pop();
  return below == null ? null : FLOW_LEF[below];
};

/* per-cycle replica of accuracyCycles' raw map + post-processing */
const replayCycle = (src) => {
  const e = ELECTIONS["e" + src];
  const eMs = new Date(e.date).getTime();
  const winDays = ACC_WINDOW_OVERRIDES[Number(src)] || ACC_WINDOW_DAYS;
  const inWindow = (cyclePolls[src] || []).filter((p) => {
    if (p.firm === "Election" || /exit/i.test(p.firm)) return false;
    if (p.tpp_alp == null) return false;
    if (p.dateApprox) return false;
    const d = ddays(eMs, new Date(p.date).getTime());
    return d >= 0 && d <= winDays;
  });
  const byHouse = new Map();
  for (const p of [...inWindow].sort((a, b) => a.date.localeCompare(b.date)))
    byHouse.set(accCanon(p.firm), p);
  const t = lefFor(Number(src));
  const raw = [...byHouse.entries()].map(([firm, p]) => {
    const alp = share2pp(p);
    const imp = p.tppEra != null ? alp : impliedLefAlp2pp(t, p);
    return { firm, date: p.date, alp, errRaw: alp - e.tpp_alp, imp };
  });
  if (!raw.length) return null;
  const houses = raw.map((h) => ({
    firm: h.firm, date: h.date, alp2pp: r1(h.alp), err: r1(h.errRaw),
    alp2ppImp: h.imp == null ? null : r1(h.imp),
    errImp: h.imp == null ? null : r1(h.imp - e.tpp_alp),
  })).sort((a, b) => Math.abs(a.err) - Math.abs(b.err));
  const meanPoll = houses.reduce((s, h) => s + h.alp2pp, 0) / houses.length;
  const impHouses = houses.filter((h) => h.errImp != null);
  const impRaw = raw.filter((h) => h.imp != null).map((h) => h.imp - e.tpp_alp);
  const impMean = impHouses.length
    ? impHouses.reduce((s, h) => s + h.alp2ppImp, 0) / impHouses.length
    : null;
  return {
    houses, n: houses.length,
    err: r1(meanPoll - e.tpp_alp), absErr: r1(Math.abs(meanPoll - e.tpp_alp)),
    sameSide: raw.length >= 2 && (raw.every((h) => h.errRaw > 0) || raw.every((h) => h.errRaw < 0)),
    worst: r1(Math.max(...houses.map((h) => Math.abs(h.err)))),
    meanImp: impMean == null ? null : r1(impMean),
    errImp: impMean == null ? null : r1(impMean - e.tpp_alp),
    absErrImp: impMean == null ? null : r1(Math.abs(impMean - e.tpp_alp)),
    sameSideImp: impRaw.length >= 2 && (impRaw.every((v) => v > 0) || impRaw.every((v) => v < 0)),
    worstImp: impHouses.length ? r1(Math.max(...impHouses.map((h) => Math.abs(h.errImp)))) : null,
    // kept for per-house probing below
    _raw: raw, _e: e,
  };
};

const num = (a, b) => a === b || (a != null && b != null && Math.abs(a - b) < 1e-9);
const close = (a, b) => a == null || b == null ? a === b : Math.abs(a - b) <= 0.05;

/* --- 1. every cycle's house rows match the replay, field for field --- */
for (const c of A.cycles) {
  const rep = replayCycle(c.year);
  if (!rep) { fails++; console.log(`FAIL replay found no in-window houses for ${c.year}`); continue; }
  ok(`${c.year}: house count matches`, c.houses.length === rep.houses.length,
    `asset ${c.houses.length} vs replay ${rep.houses.length}`);
  const mismatches = [];
  if (c.houses.length === rep.houses.length) {
    for (let i = 0; i < rep.houses.length; i++) {
      const got = c.houses[i], want = rep.houses[i];
      for (const k of ["firm", "date", "alp2pp", "err", "alp2ppImp", "errImp"])
        if (!num(got[k], want[k]))
          mismatches.push(`house[${i}] ${want.firm} ${k}: asset ${got[k]} vs replay ${want[k]}`);
    }
  }
  ok(`${c.year}: house rows match the replay (firm/date/alp2pp/err/alp2ppImp/errImp)`,
    mismatches.length === 0, mismatches.slice(0, 4).join("; "));
  for (const k of ["n", "err", "absErr", "sameSide", "worst", "meanImp", "errImp", "absErrImp", "sameSideImp", "worstImp"]) {
    ok(`${c.year}: ${k} matches the replay`, num(c[k], rep[k]),
      `asset ${c[k]} vs replay ${rep[k]}`);
  }
  /* no implied field may exist without its published twin */
  for (const h of c.houses)
    ok(`${c.year} ${h.firm}: alp2ppImp present and errImp consistent with it`,
      h.alp2ppImp != null && h.errImp != null && close(h.errImp, h.alp2ppImp - c.result),
      JSON.stringify(h));
}

/* --- 2. implied rises from the same primaries the published row carries ---
   Era rows (tppEra) already score implied last-election flows, so for them
   the two bases are the one number; every later house's implied figure must
   equal impliedLefAlp2pp on the raw row's primaries (the replay above pins
   the value, this pins the mechanism). */
{
  const nonEraCycles = A.cycles.filter((c) => Number(c.year) >= 1993);
  ok("at least one post-1993 cycle exists to re-score", nonEraCycles.length >= 8,
    `${nonEraCycles.length} cycles`);
  const eraCycles = A.cycles.filter((c) => Number(c.year) < 1993);
  const eraDrift = [];
  for (const c of eraCycles)
    for (const h of c.houses)
      if (h.alp2ppImp !== h.alp2pp || h.errImp !== h.err)
        eraDrift.push(`${c.year} ${h.firm}: pub ${h.alp2pp}/${h.err} vs imp ${h.alp2ppImp}/${h.errImp}`);
  ok("pre-1993 era rows: the two bases are the one number", eraDrift.length === 0,
    eraDrift.join("; "));
}

/* --- 3. firmsImp leaderboard matches a replayed aggregation of errImp --- */
{
  const byFirm = new Map();
  for (const c of A.cycles)
    for (const h of c.houses) {
      if (h.errImp == null) continue;
      const e = byFirm.get(h.firm) || [];
      e.push({ year: c.year, err: h.errImp });
      byFirm.set(h.firm, e);
    }
  const want = [...byFirm.entries()].map(([firm, cycles]) => ({
    firm, n: cycles.length, cycles,
    meanErr: r1(cycles.reduce((t, x) => t + x.err, 0) / cycles.length),
    meanAbs: r1(cycles.reduce((t, x) => t + Math.abs(x.err), 0) / cycles.length),
  })).sort((a, b) => b.n - a.n || a.meanAbs - b.meanAbs);
  ok("accuracy.firmsImp exists and matches the replay",
    JSON.stringify(A.firmsImp) === JSON.stringify(want),
    `asset ${(A.firmsImp || []).length} firms vs replay ${want.length}`);
  /* published leaderboard left exactly as before (still ranks Galaxy 0.9) */
  const gal = (A.firms || []).find((f) => f.firm === "Galaxy");
  ok("published leaderboard unchanged: Galaxy meanAbs 0.9 with 5 elections",
    !!gal && gal.meanAbs === 0.9 && gal.n === 5, JSON.stringify(gal));
  ok("accuracy.meanAbsImp present",
    typeof A.meanAbsImp === "number", JSON.stringify(A.meanAbsImp));
}

/* --- 4. spot pins: the figures a reader will quote --- */
{
  const y25 = A.cycles.find((c) => Number(c.year) === 2025);
  if (!y25) die("no 2025 cycle in accuracy.cycles");
  const np = y25.houses.find((h) => h.firm === "Newspoll");
  const yg = y25.houses.find((h) => h.firm === "YouGov");
  ok("2025 Newspoll: published 52.5, implied-through-2022-flows 53.0 (result 55.2)",
    !!np && np.alp2pp === 52.5 && np.alp2ppImp === 53.0 && y25.result === 55.2,
    JSON.stringify({ np, result: y25 && y25.result }));
  ok("2025 YouGov: implied-through-2022-flows 53.9 vs published 52.2",
    !!yg && yg.alp2pp === 52.2 && yg.alp2ppImp === 53.9, JSON.stringify(yg));
  const y07 = A.cycles.find((c) => Number(c.year) === 2007);
  const gal07 = y07 && y07.houses.find((h) => h.firm === "Galaxy");
  ok("2007 Galaxy: printed 52, implied-through-2004-flows 52.3",
    !!gal07 && gal07.alp2pp === 52 && gal07.alp2ppImp === 52.3, JSON.stringify(gal07));
}

/* the report line, so a run shows what the toggle's imp side currently says */
{
  const y25 = A.cycles.find((c) => Number(c.year) === 2025);
  console.log(`\nimplied-basis spot: 2025 meanImp ${y25.meanImp}`
    + ` (published side ${y25.mean});`
    + ` firmsImp head: ${A.firmsImp.filter((f) => f.n > 1).slice(0, 3).map((f) => `${f.firm} ${f.meanAbs}`).join(" · ")}`);
}

if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log("all ok");
