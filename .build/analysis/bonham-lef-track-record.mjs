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

   Two readings are printed. The SITE'S BUCKETS reading above runs the
   repo's own tables (fixed Greens / One Nation / rest buckets, one lumped
   flow 1987-93). BONHAM'S RULE re-runs the test the way his piece sets it
   up - every party that polled 4%+ at the opening election read at its own
   flow (Democrats kept for 1996 at 3.75%), everything else at that
   election's flow of the untracked rest - on party-level tables from
   bonham-party-flows.json (bonham-party-flows.py: AEC counts by party
   1996-2025, the pile-model estimate 1984-93). Only the second is his
   test; the first is the site's. A third section reruns the site's tables
   on the REAL final polls' primary votes (accuracy-panel scoring) - both
   through last-election flows and through each election's OWN counted
   flows, isolating the pollsters' primary-vote error; the comparand
   /lef-success/ quotes beside the 0.43.

   Run from the repo root: node .build/analysis/bonham-lef-track-record.mjs
   Exit code 1 if a re-derived error drifts from its committed bt, or a
   documented summary figure fails to reproduce. */

import { execSync } from "node:child_process";
import fs from "node:fs";
import { FLOW_ERAS, FLOW_LEF, impliedLefAlp2pp } from "../newtracker/flows.mjs";

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
/* normalising scales by 21.1 ÷ the closing's minor share, so with a 2-4%
   minor vote (1946-54) it multiplies a miss five to ten times: Bonham
   starts at 1955 and so do the normalised figures here */
const statLine = (label, list) => {
  const errs = list.map(errOf);
  const norms = list.filter((r) => r.closing >= 1955).map(normErr);
  const cb = list.filter((r) => r.err == null).length;
  console.log(`${label.padEnd(34)} n=${String(list.length).padStart(2)}  mean ${f2(r2(mean(errs)))}  |err| ${r2(mae(errs)).toFixed(2)}  sd ${r2(sd(errs)).toFixed(2)}  norm'd |err| ${norms.length ? r2(mae(norms)).toFixed(2) : " — "}${cb ? `   (${cb} committed-bt only)` : ""}`);
};
console.log("\nsummary (errors in ALP points; norm'd = scaled to 2013-level minor-party voting, ALL share 21.1, closings 1955+ only)");
console.log("committed-bt rows are the 1955-87 era tables, whose pinned constants (f_oth 0.45, DLP 0.27) were pooled across the era - hindsight, see flows.mjs FLOW_ERAS");
statLine("closings 1990–2025 (itemised+lumped)", inWindow(1990, 2025));
statLine("closings 1983–2013 (his 'last twelve')", inWindow(1983, 2013));
statLine("last twelve as of 2025 (1993–2025)", inWindow(1993, 2025));
statLine("closings 1955–1980 (his pre-1983 era)", inWindow(1955, 1980));
statLine("closings 1946–1955 (oth-only tables)", inWindow(1946, 1955));
statLine("all closings 1946–2025", inWindow(1946, 2025));
statLine("closings 1955–2025 (his span)", inWindow(1955, 2025));

console.log("\nversus Bonham's published figures");
console.log("election-level errors (his sign converted: negative = Labor outperformed the model):");
const HIS = { 1990: -1.1, 2013: -1.0, 2016: -0.17, 2019: 0.81, 2022: -0.99 };
const NOTE = {
  1990: "the site's 1987 table is one lumped minor-party flow, so the Greens joining the minor pool in 1990 (his stated cause of the miss) is absorbed; Bonham's rule below reads it",
};
for (const [y, his] of Object.entries(HIS)) {
  const ours = errOf(rows.find((r) => r.closing === +y));
  const gap = Math.abs(ours - his);
  console.log(`  ${y}: ours ${f2(ours)}  his ${f2(his)}  — ${gap < 0.1 ? "matches" : gap < 0.3 ? "close" : "differs"} (gap ${gap.toFixed(2)})${NOTE[y] ? "; " + NOTE[y] : ""}`);
}
console.log("  2025: ours " + f2(errOf(rows.find((r) => r.closing === 2025))) + " — postdates his updates (the 2022 table understated Labor by 0.39 pts).");
console.log(`  last twelve to 2013: ours |err| ${r2(mae(inWindow(1983, 2013).map(errOf))).toFixed(2)}  vs his 0.3 points (0.4 norm'd; ours ${r2(mae(inWindow(1983, 2013).map(normErr))).toFixed(2)}).`);
{
  const l12 = inWindow(1993, 2025);
  console.log(`  updated to 2025: the last twelve elections now run 1993–2025 — |err| ${r2(mae(l12.map(errOf))).toFixed(2)} (norm'd ${r2(mae(l12.map(normErr))).toFixed(2)}), signed mean ${f2(r2(mean(l12.map(errOf))))}, vs the 0.3/0.4 he reported to 2013.`);
}
console.log(`  pre-1983 elections: ours |err| ${r2(mae(inWindow(1955, 1980).map(errOf))).toFixed(2)} (norm'd ${r2(mae(inWindow(1955, 1980).map(normErr))).toFixed(2)}) vs his ~0.6 (~1.5 norm'd) — NOT comparable: his flows were measured from partial preference throws; the repo's era tables pin constants pooled over the whole era (f_oth 0.45, DLP 0.27, the 1955 set chosen to land 1958), so they carry knowledge of the elections they are tested on, and the pre-1984 2PPs they are scored against are themselves estimates.`);

console.log("\nthe respondent-polling comparison (his '15,000')");
{
  /* Bonham states the figure without its working. The sampling arithmetic:
     asking n minor-party voters estimates their flow with sd √(0.25/n); that
     moves the 2PP by m × that, m the minor share. RMS (not sd about the
     mean) is the error that bias counts in. */
  const list = inWindow(1990, 2025).map(errOf);
  const rms = Math.sqrt(mean(list.map((x) => x * x)));
  const m = ALL_SHARE_2013 / 100;
  console.log(`  Bonham gives "about 15,000 minor party voters" without working; 0.25/0.004² ≈ 15,600 is what treating a 0.4-pt 2PP error as a FLOW error gives — a guess at his arithmetic, not his.`);
  console.log(`  On the 2PP, n = m²·0.25/rms²: the 1990–2025 record (rms ${rms.toFixed(2)} pts) at m=${m.toFixed(3)} needs n ≈ ${Math.round(m * m * 0.25 / (rms / 100) ** 2).toLocaleString()} minor-party voters; at 2025's m=0.336, ≈ ${Math.round(0.336 ** 2 * 0.25 / (rms / 100) ** 2).toLocaleString()}.`);
  console.log(`  So sampling error alone does not rule respondent preferences out — a 3,000-person poll holds ~1,000 minor-party voters today. Their record against LEF (2004, 2013's mixed result) is a matter of respondents' answers not matching their ballots, not of sample size.`);
}

/* ---- Bonham's rule: party-level tables ---------------------------------- */
const BPF = JSON.parse(fs.readFileSync(new URL("./bonham-party-flows.json", import.meta.url), "utf8")).tables;
const MAJOR = new Set(["alp", "lnp"]);
const flowOf = (v) => (v && v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : null);
/* tracked at opening E: 4%+ of the vote at E, the Democrats kept for 1996 */
const trackedAt = (y, t) => Object.keys(t.share).filter((p) => !MAJOR.has(p) && !p.startsWith("x:") && (t.share[p] >= 4 || (p === "dem" && +y === 1993)));
function bonhamTable(y) {
  const t = BPF[y];
  const tr = trackedAt(y, t);
  const rest = [0, 0];
  for (const [p, v] of Object.entries(t.votes)) if (!tr.includes(p)) { rest[0] += v[0]; rest[1] += v[1]; }
  const f = Object.fromEntries(tr.map((p) => [p, flowOf(t.votes[p])]));
  const fOth = flowOf(rest);
  const minor = (s) => 100 - s.alp - s.lnp;
  const read = (s) => s.alp + tr.reduce((a, p) => a + (s[p] ?? 0) * f[p], 0) + (minor(s) - tr.reduce((a, p) => a + (s[p] ?? 0), 0)) * fOth;
  return { y: +y, cut: t.cut, tr, f, fOth, anchor: t.tpp - read(t.share), read };
}
const BY = Object.keys(BPF).map(Number).sort((a, b) => a - b);
const bonhamRows = BY.slice(0, -1).map((y, i) => {
  const T = bonhamTable(y), c = BY[i + 1], C = BPF[c];
  const imp = T.read(C.share) + T.anchor;
  return { table: y, closing: c, cut: T.cut, tr: T.tr, f: T.f, fOth: T.fOth, imp, official: C.tpp, err: r2(imp - C.tpp), all: 100 - C.share.alp - C.share.lnp, demShare: C.share.dem ?? 0, demOpen: BPF[y].share.dem ?? 0 };
});
console.log("\nBONHAM'S RULE — 4%+ parties at their own last-election flow, the rest at the untracked flow (bonham-party-flows.json)");
console.log("closing | via  | flows from      | tracked (flow to ALP)                       | Others | err   | site's buckets | his");
for (const r of bonhamRows) {
  const site = rows.find((x) => x.closing === r.closing);
  const tr = r.tr.map((p) => `${p} ${(r.f[p] * 100).toFixed(1)}`).join(", ") || "none";
  const src = r.cut === "model" ? "model estimate" : r.cut === "classic-tcp" ? "AEC classic seats" : "AEC all seats";
  console.log(`${r.closing}   | ${r.table} | ${src.padEnd(15)} | ${tr.padEnd(43)} | ${(r.fOth * 100).toFixed(1)}   | ${f2(r.err)} | ${f2(site ? errOf(site) : null)}          | ${HIS[r.closing] != null ? f2(HIS[r.closing]) : ""}`);
}
const bw = (lo, hi) => bonhamRows.filter((r) => r.closing >= lo && r.closing <= hi);
const bStat = (label, l) => console.log(`${label.padEnd(34)} n=${String(l.length).padStart(2)}  mean ${f2(r2(mean(l.map((r) => r.err))))}  |err| ${r2(mae(l.map((r) => r.err))).toFixed(2)}  norm'd |err| ${r2(mae(l.map((r) => r.err * ALL_SHARE_2013 / r.all))).toFixed(2)}`);
bStat("closings 1987–2013 (his window, from 1987)", bw(1987, 2013));
bStat("closings 1987–2025", bw(1987, 2025));
bStat("last twelve as of 2025 (1993–2025)", bw(1993, 2025));
{
  const chk = JSON.parse(fs.readFileSync(new URL("./bonham-party-flows.json", import.meta.url), "utf8")).dem_check;
  const gaps = Object.values(chk).map((c) => c.model - c.counted);
  console.log(`  1984–93 tables are model estimates: the same labelled model on 1996–2001, where the AEC counted Democrats by party, reads them ${Object.entries(chk).map(([y, c]) => `${y} ${f2(r2(c.model - c.counted))}`).join(", ")} pts (mean ${f2(r2(mean(gaps)))});`);
  for (const r of bonhamRows.filter((r) => r.cut === "model"))
    /* the anchor takes up the opening's share × the flow error, so what
       reaches the closing is the CHANGE in the Democrat share × that error */
    console.log(`    ${r.closing}: a ${Math.abs(mean(gaps)).toFixed(1)}-pt Democrat flow error moves its err by ~${((r.demShare - r.demOpen) * Math.abs(mean(gaps)) / 100).toFixed(2)} pts (Democrats ${r.demOpen.toFixed(1)}% → ${r.demShare.toFixed(1)}%; the anchor absorbs the opening's share)`);
  console.log("  1983's count stopped at a majority, so no 1983 table and no 1984 closing under this rule.");
  /* 2025's judgement call: the UAP (4.1% in 2022) is tracked but did not
     stand; Clive Palmer's 2025 vehicle was Trumpet of Patriots (AEC code
     CYA, the renamed Australian Federation Party) - a different registered
     party, so the code-strict rule reads it at Others */
  /* 2022's: under the 4% rule One Nation (3.1%) and the UAP (3.4%) are
     2019 Others; his 2022 update names their flows apart, so he likely
     tracked them - that reading lands within 0.04 of his -0.99 */
  {
    const t = BPF[2019], C = BPF[2022], tr = ["grn", "onp", "uap"];
    const rest = [0, 0];
    for (const [p, v] of Object.entries(t.votes)) if (!tr.includes(p)) { rest[0] += v[0]; rest[1] += v[1]; }
    const fo = flowOf(rest);
    const rd = (s) => s.alp + tr.reduce((a, p) => a + (s[p] ?? 0) * flowOf(t.votes[p]), 0) + (100 - s.alp - s.lnp - tr.reduce((a, p) => a + (s[p] ?? 0), 0)) * fo;
    console.log(`  2022 sensitivity: One Nation and the UAP read at their own 2019 flows moves 2022 from ${f2(bonhamRows.find((r) => r.closing === 2022).err)} to ${f2(r2(rd(C.share) + t.tpp - rd(t.share) - C.tpp))} (his -0.99).`);
  }
  const r25 = bonhamRows.find((r) => r.closing === 2025);
  const cya = BPF[2025].share["x:CYA"] ?? 0;
  const alt = r2(r25.err + cya * (r25.f.uap - r25.fOth));
  console.log(`  2025 sensitivity: Trumpet of Patriots (${cya.toFixed(1)}%) read at the UAP's 2022 flow (${(r25.f.uap * 100).toFixed(1)}) instead of Others (${(r25.fOth * 100).toFixed(1)}) moves 2025 from ${f2(r25.err)} to ${f2(alt)}.`);
}

/* ---- the real pollsters' primaries through the same tables -------------- */
/* The article's imaginary pollster gets every primary exactly right, so its
   misses are the flow drift's alone. The comparand the page quotes beside
   it: the REAL final polls' primary votes, scored the site's accuracy-panel
   way (one final poll per house within fourteen days of the election,
   house means equally weighted), run two ways:
   - through the same last-election-flows engine (the opening election's
     FLOW_LEF table) — flow drift and poll error combined;
   - through the CLOSING election's own counted table (data/flow-lef.json's
     entry for the election itself, flows f + anchor), where the flow
     drift is right by construction, so what remains is the pollsters'
     primary-vote error. That is the 0.xx the page quotes.
   Mirrors accuracyCycles in gen-data.mjs — the window, the canon map and
   impliedLefAlp2pp all duplicate it, and drift between the two should make
   you re-read this comment, not "fix" one side. */
const ACC_WIN = 14; // gen-data.mjs ACC_WINDOW_DAYS
const RENAME = { Morgan: "Roy Morgan", "Newspoll-YouGov": "Newspoll", "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater", "RedBridge/Accent": "RedBridge", "Spectre Strategy": "Spectre" }; // gen-data.mjs ACC_CANON
/* impliedLefAlp2pp applied to the LEF store's own shape: the closing
   election's counted table t = LEF[year] ({cut, f, fMinor, share, anchor}).
   Same rescale/fold rules as flows.mjs: a declared-basis set (Σ≠100±2 with
   oth present) rescales to 100; an un-itemised bucket reads at the election
   share-weighted oth mix; a share-below-0.05% bucket folds into oth. */
const impliedAtOwnTable = (y, p) => {
  const t = LEF[String(y)];
  if (!t || p.alp == null || p.lnp == null) return null;
  const COLS = ["alp", "lnp", "grn", "onp", "oth"];
  const sum = COLS.reduce((s, k) => s + (p[k] ?? 0), 0);
  const k = p.oth != null && Math.abs(sum - 100) > 2 ? 100 / sum : 1;
  const v = (c) => (p[c] == null ? null : p[c] * k);
  const alp = v("alp"), lnp = v("lnp");
  const anchor = t.anchor ?? 0;
  if (t.cut === "lumped") return alp + (100 - alp - lnp) * t.fMinor + anchor;
  const grn = v("grn"), onp = v("onp");
  const oth = p.oth != null ? v("oth") : Math.max(0, 100 - alp - lnp - (grn ?? 0) - (onp ?? 0));
  const f = (b) => (t.f[b] != null && t.share[b] >= 0.05 ? t.f[b] : t.f.oth);
  const folded = ["oth", ...(grn == null ? ["grn"] : []), ...(onp == null ? ["onp"] : [])];
  const w = folded.reduce((s, b) => s + t.share[b], 0);
  const fOth = w ? folded.reduce((s, b) => s + f(b) * t.share[b], 0) / w : t.f.oth;
  return alp + (grn != null ? f("grn") * grn : 0) + (onp != null ? f("onp") * onp : 0) + fOth * oth + anchor;
};
{
  const tables = Object.keys(FLOW_LEF).map(Number).sort((a, b) => a - b);
  const closings = [...tables, 2025]; // each table is tested at the next election
  const crow = [];
  for (let i = 1; i < closings.length; i++) {
    const cy = closings[i], oy = closings[i - 1];
    const e = E[cy], t = FLOW_LEF[oy];
    if (!t) continue; // 1987: no 1984 table committed
    const eMs = new Date(e.date).getTime();
    const win = (D.cyclePolls[cy] || []).filter((p) => {
      if (p.firm === "Election" || /exit/i.test(p.firm)) return false;
      if (p.tpp_alp == null) return false;
      if (p.dateApprox) return false;
      const d = (eMs - new Date(p.date).getTime()) / 86400000;
      return d >= 0 && d <= ACC_WIN;
    });
    const byHouse = new Map();
    for (const p of [...win].sort((a, b) => a.date.localeCompare(b.date)))
      byHouse.set(RENAME[p.firm] || p.firm, p);
    const houses = [...byHouse.values()].map((p) => {
      const lef = impliedLefAlp2pp(t, p);
      const own = impliedAtOwnTable(cy, p);
      return lef == null || own == null ? null : { firm: RENAME[p.firm] || p.firm, lef: lef - e.tpp_alp, own: own - e.tpp_alp };
    }).filter(Boolean);
    if (!houses.length) continue;
    crow.push({ cy, houses, lef: mean(houses.map((h) => h.lef)), own: mean(houses.map((h) => h.own)) });
  }
  console.log("\nREAL FINAL POLLS' PRIMARIES through the flow tables (accuracy-panel scoring: one poll per house ≤14 days out, house means equally weighted, implied basis)");
  console.log("closing | houses | miss via last-election flows | miss via this election's own flows (the pollsters' primary error, ALP pts)");
  for (const c of crow) {
    const per = c.houses.map((h) => `${h.firm} ${f2(r2(h.lef))}/${f2(r2(h.own))}`).join(", ");
    console.log(`${c.cy}   | ${String(c.houses.length).padStart(6)} | ${f2(r2(c.lef)).padStart(6)} | ${f2(r2(c.own)).padStart(6)}   (${per})`);
  }
  const span = inWindow(crow[0].cy, 2025).map(errOf);
  console.log(`mean |miss| across the ${crow.length} scoreable closings (${crow[0].cy}–${crow[crow.length - 1].cy}):`);
  console.log(`  via last-election flows: ${mae(crow.map((c) => c.lef)).toFixed(2)} ALP points — the flow drift and the poll error together (the exact-primary pollster's ${r2(mae(span)).toFixed(2)} over the same elections is the whole drift term)`);
  console.log(`  via this election's own flows: ${mae(crow.map((c) => c.own)).toFixed(2)} ALP points — the pollsters' primary-vote error alone, the figure the page quotes beside the 0.43`);
  console.log(`  signed means: ${f2(r2(mean(crow.map((c) => c.lef))))} (last-election flows) / ${f2(r2(mean(crow.map((c) => c.own))))} (own flows); the flow assumption's own signed mean is ${f2(r2(mean(span)))}`);
  console.log("  1987 has no score (no committed 1984 flow table) and 1990 none either (the committed finals carry no published 2PP, so they fall the accuracy panel's tpp_alp gate even though their primaries are on file); the poll rows here are the committed cyclePolls, same sets the accuracy panel reads.");
}

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
