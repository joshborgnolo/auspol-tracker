/* one-off: re-conduct Kevin Bonham's "Wonk Central: The Track Record Of
   Last-Election Preferences" (kevinbonham.blogspot.com/2015/09/wonk-central-
   track-record-of-last.html, Sep 2015, election updates appended through
   2022) from this repo's committed data. The audit: pretend a pollster
   standing just after election E knows only E's preference flows; apply
   them to the NEXT election's actual primaries; the error vs that
   election's official 2PP is the last-election-preferences (LEF) track
   record.

   The site already RUNS this test: FLOW_LEF (1987-2022) + FLOW (2025) and
   FLOW_ERAS (1943-84) in .build/newtracker/flows.mjs each carry the `bt`
   right-edge backtest, and data/flow-lef.json is its pinned store
   (test-flow-lef.mjs). This script is the independent re-derivation: it
   recomputes every error from the committed ingredients (election
   primaries, official 2PP, measured flow tables) and treats the committed
   bt fields as the cross-check, so it doubles as a probe.

   Inputs (all committed, read via origin/main where JSON):
   - data/polls.json   `elections` — per-election primaries + official 2PP
   - data/flow-lef.json            — 1987-2025 flow tables (measured 1996+,
                                     lumped 1987-93), primaries shares,
                                     anchors, committed backtests
   - flows.mjs FLOW_ERAS           — 1943-84 era tables (oth-flow solved
                                     1943-54; dlp/dem solved-or-pinned
                                     1955-84), with committed bt
   Era rows for 1955-84 CANNOT be re-derived from repo data (the DLP and
   Democrat primary splits each table was calibrated against came from the
   pappubahry election-statistics dataset at derivation time and are not
   committed); those rows print the committed bt flagged, and are kept out
   of the re-derivation counts.

   Run from the repo root: node .build/analysis/bonham-lef-track-record.mjs
   Exit code 1 if a re-derived error drifts from its committed bt, or a
   documented summary figure fails to reproduce. */

import { execSync } from "node:child_process";
import { FLOW_ERAS } from "../newtracker/flows.mjs";

const show = (p) => JSON.parse(execSync(`git show origin/main:${p}`, { maxBuffer: 1 << 28, encoding: "utf8" }));
const D = show("data/polls.json");
const LEF = show("data/flow-lef.json");
const E = Object.fromEntries(Object.entries(D.elections).map(([k, v]) => [+k.slice(1), v]));

const r2 = (x) => Math.round(x * 100) / 100;
const f2 = (x) => (x == null ? "  —  " : (x >= 0 ? "+" : "") + x.toFixed(2));
const pc = (x) => (x == null ? " — " : x.toFixed(1));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mae = (xs) => mean(xs.map((x) => Math.abs(x)));
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

/* ---- the tables, one per opening election ------------------------------ */
/* kind: era-oth (1943-54, recomputable), era-split (1955-84, bt committed
   only), lumped (1987-93), itemised (1996-2022), sitting (2025, untested) */
const OPENINGS = [
  ...Object.entries(FLOW_ERAS).map(([y, t]) => ({
    year: +y, kind: t.dlp == null && t.dem == null ? "era-oth" : "era-split",
    f: t, bt: t.bt ?? null, anchor: 0,
  })),
  ...Object.entries(LEF).map(([y, t]) => ({
    year: +y,
    kind: t.cut === "lumped" ? "lumped" : t.backtest == null ? "sitting" : "itemised",
    f: t, bt: t.backtest ? t.backtest.err : null, anchor: t.anchor ?? 0,
  })),
].sort((a, b) => a.year - b.year);
const closingOf = Object.fromEntries(OPENINGS.map((t, i) => [t.year, OPENINGS[i + 1] ? OPENINGS[i + 1].year : null]));

/* implied ALP 2PP at the CLOSING election under table `t`.
   Itemised folding follows flows.mjs impliedLefAlp2pp: a bucket the opening
   count never met (One Nation in 1996) reads at that count's oth flow. */
function impliedAt(t, cy) {
  if (t.kind === "era-oth") {
    if (cy > 1954) return null; // DLP debuted in 1955: the elections table lumps DLP into oth,
    // but the 1943–54 tables were calibrated on the genuine-others pool — committed bt only
    const e = E[cy];
    return { imp: e.alp + e.oth * t.f.oth, official: e.tpp_alp, all: e.oth };
  }
  if (t.kind === "lumped") {
    const s = LEF[String(cy)].share;
    const minor = s.minor ?? 100 - s.alp - s.lnp; // 1996's shares omit the key; pool is the residual
    return { imp: s.alp + minor * t.f.fMinor, official: LEF[String(cy)].tpp, all: minor };
  }
  if (t.kind === "itemised") {
    const s = LEF[String(cy)].share;
    const fOnp = t.f.f.onp != null && t.f.share.onp >= 0.05 ? t.f.f.onp : t.f.f.oth;
    const imp = s.alp + (s.grn ?? 0) * t.f.f.grn + (s.onp ?? 0) * fOnp + s.oth * t.f.f.oth + t.anchor;
    return { imp, official: LEF[String(cy)].tpp, all: (s.grn ?? 0) + (s.onp ?? 0) + s.oth };
  }
  return null; // era-split | sitting
}

/* per-bucket expectation vs actuality (Bonham's Labexp/Labact) for the
   closings where both the opening and closing tables are measurable */
function bucketDetail(t, cy) {
  const ct = LEF[String(cy)];
  if (!ct) return null;
  if (t.kind === "lumped")
    return [{ b: "all non-majors", share: ct.share.minor ?? 100 - ct.share.alp - ct.share.lnp, exp: t.f.fMinor, act: ct.fMinor }];
  if (t.kind !== "itemised") return null;
  const ctF = ct.f; // every closing with an itemised opening is itemised itself (1998+)
  const rows = [];
  for (const b of ["grn", "onp", "oth"]) {
    const share = ct.share[b];
    if (share == null || share < 0.005) continue;
    const exp = b === "onp" && !(t.f.f.onp != null && t.f.share.onp >= 0.05) ? t.f.f.oth : t.f.f[b];
    const act = ctF[b] ?? null;
    rows.push({ b, share, exp, act, folded: b === "onp" && (t.f.f.onp == null || t.f.share.onp < 0.05) });
  }
  return rows;
}

/* ---- re-derive every testable row -------------------------------------- */
const ALL_SHARE_2013 = 21.07; // 100 − alp 33.38 − lnp 45.55 (Bonham's "2013-level minor-party voting")
const rows = OPENINGS.map((t) => {
  const cy = closingOf[t.year];
  if (cy == null) return { table: t.year, kind: t.kind, closing: null };
  const r = impliedAt(t, cy);
  if (!r) return { table: t.year, kind: t.kind, closing: cy, bt: t.bt };
  const err = r2(r.imp - r.official);
  return { table: t.year, kind: t.kind, closing: cy, imp: r.imp, official: r.official, err, all: r.all, bt: t.bt };
});
const testable = rows.filter((r) => r.err != null);
const errOf = (r) => (r.err != null ? r.err : r.bt);
const inWindow = (lo, hi) => rows.filter((r) => r.closing != null && r.closing >= lo && r.closing <= hi);
const normErr = (r) => errOf(r) * (ALL_SHARE_2013 / (r.all ?? (E[r.closing] ? E[r.closing].oth : ALL_SHARE_2013)));

/* ---- output ------------------------------------------------------------- */
console.log("LAST-ELECTION PREFERENCES — TRACK RECORD, re-derived from this repo's committed data");
console.log("Bonham's test: table of election E × actual primaries of the NEXT election, vs its official 2PP.");
console.log("inputs: origin/main data/polls.json + data/flow-lef.json; flows.mjs FLOW_ERAS (working tree)");
console.log("err = implied ALP 2PP − official ALP 2PP (ALP points; negative = Labor outperformed LEF)\n");

console.log("closing | via | kind      | impl 2PP | off 2PP | err   | ALL  | norm'd | check");
for (const r of rows) {
  if (r.closing == null) {
    console.log(`        | ${r.table} | ${r.kind.padEnd(9)} | untested — table awaits its next election (2028)`);
    continue;
  }
  const via = `${r.table}`;
  if (r.err == null) {
    const bt = f2(r.bt ?? null);
    const why = r.kind === "era-oth" ? "DLP debut 1955 — elections table lumps DLP into oth; the era tables' calibration pool was genuine-others" : "era dem/dlp primaries not in repo";
    console.log(`${r.closing}   | ${via} | ${r.kind.padEnd(9)} |   — committed bt ${bt} (${why})`);
    continue;
  }
  const d = r.bt != null ? Math.abs(r.err - r.bt) : null;
  const check = d == null ? "—" : d <= 0.0051 ? "ok" : d <= 0.015 ? "ok (±0.01 share-rounding)" : `DRIFT (committed ${f2(r.bt)})`;
  console.log(`${r.closing}   | ${via} | ${r.kind.padEnd(9)} |  ${r.imp.toFixed(2).padStart(5)}  |  ${r.official.toFixed(2).padStart(5)} | ${f2(r.err)} | ${pc(r.all)} | ${f2(r2(normErr(r)))} | ${check}`);
}

console.log("\nper-bucket expectation vs realisation (Bonham's Labexp/Labact; folds → oth as flows.mjs does)");
console.log("closing | bucket         | share | exp (prev table) | act (counted here) | act−exp");
for (const r of rows) {
  const dets = r.err != null ? bucketDetail(OPENINGS.find((t) => t.year === r.table), r.closing) : null;
  if (!dets) continue;
  for (const d of dets) {
    const name = d.b === "grn" ? "Greens" : d.b === "onp" ? "One Nation" : d.b === "oth" ? "Others" : d.b;
    const fold = d.folded ? ", folded" : "";
    console.log(`${r.closing}   | ${name.padEnd(14)} | ${pc(d.share)} |   ${d.exp == null ? " —" : (d.exp * 100).toFixed(1)}%${fold}     |   ${d.act == null ? " —" : (d.act * 100).toFixed(1)}%           | ${d.act == null ? "—" : f2(r2((d.act - d.exp) * 100))}`);
  }
}

/* ---- summary statistics, Bonham's frames -------------------------------- */
const statLine = (label, list) => {
  const errs = list.map(errOf);
  const norms = list.map(normErr);
  console.log(`${label.padEnd(34)} n=${String(list.length).padStart(2)}  mean ${f2(r2(mean(errs)))}  |err| ${r2(mae(errs)).toFixed(2)}  sd ${r2(sd(errs)).toFixed(2)}  norm'd |err| ${r2(mae(norms)).toFixed(2)}`);
};
console.log("\nsummary (errors in ALP points; norm'd = scaled to 2013-level minor-party voting, ALL share 21.1)");
statLine("closings 1990–2025 (itemised+lumped)", inWindow(1990, 2025));
statLine("closings 1983–2013 (his 'last twelve')", inWindow(1983, 2013));
statLine("last twelve as of 2025 (1993–2025)", inWindow(1993, 2025));
statLine("closings 1955–1980 (his pre-1983 era)", inWindow(1955, 1980));
statLine("closings 1946–1955 (oth-only tables)", inWindow(1946, 1955));
statLine("all closings 1946–2025", inWindow(1946, 2025));

console.log("\nversus Bonham's published figures");
console.log("election-level errors (his sign converted: negative = Labor outperformed the model):");
const HIS = { 1990: -1.1, 2013: -1.0, 2016: -0.17, 2019: 0.81, 2022: -0.99 };
const NOTE = {
  1990: "divergent by construction — the repo's 1987–93 tables are one lumped minor-party flow (exact vs the opening result by design); his were party-level estimates from seat distributions. flows.mjs documents this.",
  2013: "matches (1.0 his, 1.04 ours) — the case his piece builds around.",
  2016: "close (0.17 his, 0.23 ours) — differences are bucket granularity + anchor, not direction.",
  2019: "matches (0.81 his, 0.83 ours).",
  2022: "matches (0.99 his, 0.97 ours).",
};
for (const [y, his] of Object.entries(HIS)) {
  const ours = rows.find((r) => r.closing === +y);
  console.log(`  ${y}: ours ${f2(errOf(ours))}  his ${f2(his)}  — ${NOTE[y]}`);
}
console.log("  2025: ours " + f2(errOf(rows.find((r) => r.closing === 2025))) + " — postdates his updates (the 2022 table understated Labor by 0.39 pts).");
console.log(`  last twelve to 2013: ours |err| ${r2(mae(inWindow(1983, 2013).map(errOf))).toFixed(2)}  vs his 0.3 points (0.4 norm'd; ours ${r2(mae(inWindow(1983, 2013).map(normErr))).toFixed(2)}).`);
{
  const l12 = inWindow(1993, 2025);
  console.log(`  updated to 2025: the last twelve elections now run 1993–2025 — |err| ${r2(mae(l12.map(errOf))).toFixed(2)} (norm'd ${r2(mae(l12.map(normErr))).toFixed(2)}), signed mean ${f2(r2(mean(l12.map(errOf))))}, vs the 0.3/0.4 he reported to 2013.`);
}
console.log(`  pre-1983 elections: ours |err| ${r2(mae(inWindow(1955, 1980).map(errOf))).toFixed(2)} (norm'd ${r2(mae(inWindow(1955, 1980).map(normErr))).toFixed(2)}) vs his ~0.6 (~1.5 norm'd) — his era flows were measured from partial preference throws; the repo's are solved against each official 2PP, so the repo's pre-1984 miss is mechanically smaller. Different instruments, same conclusion.`);

console.log("\nthe respondent-polling comparison (his §'15,000')");
const obsSD = sd(inWindow(1990, 2025).map(errOf));
console.log(`  A flow estimated from n minor-party voters has sampling sd √(0.25/n); Bonham equates the LEF average-error-as-sd with that (0.4 pts → 0.25/0.004² ≈ 15,600 voters ≈ his 15,000).`);
console.log(`  Same arithmetic on the repo's 1990–2025 record (sd ${r2(obsSD).toFixed(2)} pts): n = 0.25/(${r2(obsSD).toFixed(2)}/100)² ≈ ${Math.round(0.25 / (obsSD / 100) ** 2).toLocaleString()} minor-party voters per poll.`);
console.log(`  Scaling the error on to the 2PP by the 2013 minor share (m=${(ALL_SHARE_2013 / 100).toFixed(3)}) instead gives n = m²·0.25/sd² ≈ ${Math.round(((ALL_SHARE_2013 / 100) ** 2) * 0.25 / (obsSD / 100) ** 2).toLocaleString()} — either way, far beyond any respondent sample a pollster fields (>2,000 minors is rare).`);

/* ---- verification -------------------------------------------------------- */
/* The committed bt comes from aec-flow-history.py's full-precision primary
   counts; this script reads the pinned two-decimal store, so a ±0.01 diff
   on a re-derived rounding boundary is expected — genuine drift is larger. */
const TOL = 0.015;
let fails = 0, rounding = 0, checked = 0;
for (const r of testable) {
  if (r.bt == null) continue;
  checked++;
  const d = Math.abs(r.err - r.bt);
  if (d > 0.0051 && d <= TOL) rounding++;
  if (d > TOL) {
    console.log(`\nFAIL: closing ${r.closing} via ${r.table} re-derived ${f2(r.err)} but committed bt is ${f2(r.bt)}`);
    fails++;
  }
}
{
  const overall = mae(inWindow(1990, 2025).map(errOf));
  if (Math.abs(overall - 0.42) > 0.01) {
    console.log(`\nFAIL: post-1987 mean |error| ${overall.toFixed(3)} drifts the documented 0.42 (flows.mjs FLOW_LEF)`);
    fails++;
  }
  const last12 = mae(inWindow(1983, 2013).map(errOf));
  if (Math.abs(last12 - 0.3) > 0.025)
    console.log(`\nNOTE: last-twelve-to-2013 mean |error| ${last12.toFixed(3)} vs Bonham's published 0.3 — outside loose tolerance`);
}
console.log(`\n${fails === 0 ? "VERIFICATION PASS" : "VERIFICATION FAIL"} — ${checked} committed bt values cross-checked against the re-derivation (${rounding} at ±0.01 share-rounding).`);
process.exit(fails ? 1 : 0);
