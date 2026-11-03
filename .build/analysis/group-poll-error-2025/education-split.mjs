#!/usr/bin/env node
/* education-split.mjs: the graduate gap before the election, which seat-model/aes-group-swings could not see.

   That analysis (README "Reopen if") found the polls' Coalition graduate gap +0.45 logit above the AES 2025's in
   each house's first post-election crosstabs, and could not tell whether that was a fast real shift or the
   polls measuring differently from the AES, because "no poll carried education crosstabs before the election".
   bludgertrack-2022-25.json has them: Newspoll (pooled quarters), YouGov (weekly), RedBridge and DemosAU.

   Gap = logit(share among graduates) − logit(share among everyone else), exactly as poll-gaps.mjs: the polls'
   No tertiary and TAFE/Tech cells are combined with the 2021 Census adult mix (poll-gaps' weights), and the AES
   side is poll-gaps' (aes-cells.json, the integrated file's 2025 wave). Each pre-election window's gap is the
   mean of its releases' gaps (as poll-gaps averages its windows), with a binomial standard error times the
   house's design effect from group-error.mjs.

     instrument     = the house's pre-election gap − the AES's (same moment, different instrument)
     change         = the house's post-election gap − its own pre-election gap (same instrument)
   so poll-gaps' "early minus AES" = instrument + early change.

   Run from the repo root:
     node .build/analysis/group-poll-error-2025/education-split.mjs > .build/analysis/group-poll-error-2025/out/education-split.txt */
import { pathToFileURL } from "node:url";
import { FINAL_FROM, PRE_FROM, PRE_TO, ELECTION, releases, fmt } from "./lib.mjs";
import { analyse } from "./group-error.mjs";
import { pollGaps, PARTIES } from "../seat-model/aes-group-swings/poll-gaps.mjs";

const logit = (p) => Math.log(p / (1 - p));
const POST = { Newspoll: "Newspoll", YouGov: "YouGov", RedBridge: "RedBridge/Accent", DemosAU: "DemosAU" };

export function split() {
  const PG = pollGaps(), W = PG.weights, deff = analyse().deff;
  const { list } = releases();
  const gapOfRelease = (R) => {
    const u = R.cells.University, s = R.cells["No tertiary"], t = R.cells["TAFE/Tech"];
    if (!u || !s || !t || [u, s, t].some((c) => c.flags.length)) return null;
    const d = deff[R.house]?.deff ?? 1.5, o = {};
    for (const p of PARTIES) {
      if ([u, s, t].some((c) => c.s[p] == null)) { o[p] = null; continue; } // RedBridge's crosstabs print no One Nation
      const uni = u.s[p] / 100, non = (W.vet * t.s[p] + W.school * s.s[p]) / 100;
      const vUni = (d * uni * (1 - uni)) / u.n, vNon = d * ((W.vet ** 2 * (t.s[p] / 100) * (1 - t.s[p] / 100)) / t.n + (W.school ** 2 * (s.s[p] / 100) * (1 - s.s[p] / 100)) / s.n);
      o[p] = { uni, non, g: logit(uni) - logit(non), v: vUni / (uni * (1 - uni)) ** 2 + vNon / (non * (1 - non)) ** 2 };
    }
    return o;
  };
  const houses = {};
  for (const R of list.filter((R) => R.all && !R.flags.length && POST[R.house])) {
    const g = gapOfRelease(R);
    if (!g) continue;
    const win = R.end >= FINAL_FROM && R.end <= ELECTION ? "final" : R.end >= PRE_FROM && R.end <= PRE_TO ? "pre" : null;
    if (!win) continue;
    ((houses[R.house] = houses[R.house] || { final: [], pre: [] })[win]).push({ release: `${R.start}..${R.end}`, g });
  }
  const mean = (all, p) => {
    const ws = all.filter((w) => w.g[p]);
    return ws.length ? { g: ws.reduce((s, w) => s + w.g[p].g, 0) / ws.length, v: ws.reduce((s, w) => s + w.g[p].v, 0) / ws.length ** 2 } : null;
  };
  const out = [];
  for (const [house, H] of Object.entries(houses)) {
    const post = PG.houses.find((h) => h.house === POST[house]);
    const row = { house, final: H.final.map((w) => w.release), pre: H.pre.map((w) => w.release), parties: {} };
    for (const p of PARTIES) {
      const fin = mean(H.final, p), pre = mean(H.pre, p), base = fin || pre;
      row.parties[p] = {
        final: fin, pre, base: base ? { ...base, from: fin ? "final" : "pre" } : null, aes: PG.aes[p].g,
        early: post?.early?.[p] ?? null, late: post?.late?.[p] ?? null,
        nEarly: post?.nEarly || 0, nLate: post?.nLate || 0,
      };
    }
    out.push(row);
  }
  const across = (f) => Object.fromEntries(PARTIES.map((p) => {
    const v = out.map((h) => f(h.parties[p])).filter((x) => x != null);
    const m = v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    return [p, { mean: m, sd: v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : null, houses: v.length }];
  }));
  return {
    PG, houses: out,
    instrument: across((q) => (q.base ? q.base.g - q.aes : null)),
    earlyChange: across((q) => (q.base && q.early != null ? q.early - q.base.g : null)),
    lateChange: across((q) => (q.base && q.late != null ? q.late - q.base.g : null)),
    earlyVsAes: across((q) => (q.base && q.early != null ? q.early - q.aes : null)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const S = split(), f = (x) => fmt(x, 2), L = (s = "") => console.log(s);
  L("Graduate gap, logit(graduates) − logit(everyone else), before and after the 2025 election, same house; AES 2025 for reference.");
  L(`AES 2025: ` + PARTIES.map((p) => `${p} ${f(S.PG.aes[p].g)}`).join("  "));
  L();
  for (const h of S.houses) {
    L(`${h.house}  (final window: ${h.final.join(", ") || "none"}; pre-campaign: ${h.pre.length} releases)`);
    for (const p of PARTIES) {
      const q = h.parties[p];
      const b = q.base;
      L(`  ${p.padEnd(4)} pre-campaign ${q.pre ? f(q.pre.g) + "±" + Math.sqrt(q.pre.v).toFixed(2) : "  –  "}  final ${q.final ? f(q.final.g) + "±" + Math.sqrt(q.final.v).toFixed(2) : "  –  "}` +
        `  | instrument (${b?.from || "-"} − AES) ${b ? f(b.g - q.aes) : "  –  "}` +
        `  | early post (${q.nEarly}) ${q.early == null ? "  –  " : f(q.early)} change ${b && q.early != null ? f(q.early - b.g) : "  –  "}` +
        `  | late (${q.nLate}) ${q.late == null ? "  –  " : f(q.late)} change ${b && q.late != null ? f(q.late - b.g) : "  –  "}`);
    }
  }
  L();
  const line = (lab, o) => L(`  ${lab.padEnd(40)}` + PARTIES.map((p) => `${p} ${f(o[p].mean)} (sd ${o[p].sd == null ? " – " : o[p].sd.toFixed(2)}, ${o[p].houses})`).join("  "));
  L("Across houses (mean, sd across houses, houses):");
  line("instrument: pre-election poll − AES", S.instrument);
  line("early post-election − AES (poll-gaps)", S.earlyVsAes);
  line("early change: early post − pre, same house", S.earlyChange);
  line("late change: late − pre, same house", S.lateChange);
}
