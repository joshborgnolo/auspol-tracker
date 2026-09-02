// Backfill the 1993–1996 term (Keating's second) into data/polls.json —
// Newspoll voting intention into cyclePolls.1996, Newspoll leadership
// ratings into cycleApproval.1993, and the 1993 result into
// elections.e1993. Modelled on .build/assimilate-1996-cycle-csv.mjs; per the
// skill, the era's per-source quirks were re-checked first, and they differ
// from that script's in these load-bearing ways:
//
//   This is the deepest the archives reach — Morgan's poll-wave table has
//   NO printed waves in the window at all (its first real wave is
//   1996-03-23, post-election; the 1993-03-13 and 1996-03-02 rows are
//   election=1 markers), and ACNielsen's archive OPENS on the
//   1996-03-02 election row (first real wave 1996-05-05). So Newspoll is
//   the only house on file, and both Morgan and ACNielsen blocks are
//   absent from this script rather than returning zero candidates.
//
//   Newspoll 2PP — as in the later drills, the two-party-preferred table
//   is empty for the term except the campaign: six waves (1996-01-21 →
//   1996-02-29) carry a printed pair and the primary↔2PP join keeps just
//   those six; the other 71 in-window primary waves are dropped for want
//   of a 2PP (no fabricated estimates). All six kept rows sum to exactly
//   100.
//
//   One Nation — the party didn't exist (founded April 1997); Newspoll's
//   one_nation column is blank on every kept row and the columns still
//   sum to exactly 100, so the six rows carry onp: null, same rule as the
//   pre-formation swathe of the 1996 drill.
//
//   Leadership — three opposition leaders this term (two-name eraPick
//   would misread it): Hewson (spilled 1994-05-23), Downer (resigned
//   1995-01-30), Howard. The sparse Columns partition the window cleanly:
//   satisfaction 30 Hewson + 18 Downer + 29 Howard = 77/77, and PPM
//   30 + 14 + 30 = 74/74, all against Keating (77/77 · 74/74). eraPick is
//   chronological ["john_hewson","alexander_downer","john_howard"].
//
//   The 1993 anchor is the sweetest victory: AEC official first
//   preferences ALP 44.9 / Coalition 44.3 with the TPP 51.4–48.6
//   (cross-checked against Morgan's 1993-03-13 election rows — PV
//   44.9/44.3 and TPP 51.4/48.6). ONP is a true 0 (party didn't exist);
//   oth folds in the Democrats' 3.8 + others 5.1 = 8.9; greens 1.9 as
//   printed. Row sums exactly 100.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 1996-03-02 Election marker from elections.e1996;
// cycleApproval rows ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where
// a wave didn't ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by
// default; --apply writes data/polls.json.
//
// Note on blanks: 1996-01-21 prints greens blank too (sub-threshold, the row
// still sums to exactly 100) — grn and onp may both be null on a kept row,
// which the cycle renderer already tolerates (null onp exists in the 1996
// cycle's pre-formation swathe).
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const TERM = ["1993-03-13", "1996-03-02"];          // 1993 election day .. 1996 election day
const CYCLE_KEY = "1996";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "1993";                            // cycleApproval is keyed by the term-START election

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
D.cyclePolls[CYCLE_KEY] ||= [];
D.cycleApproval[APPR_KEY] ||= [];

const parseCsv = (file) =>
  readFileSync(file, "utf8").trim().split("\n").map((l) => l.split(","));
const inTerm = (d) => d > TERM[0] && d <= TERM[1];
// "< 0.5" and blanks are sub-threshold/absent — zero contribution to sums
const num = (c) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c ?? "") ? +c : 0);
const pct = (c) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c ?? "") ? +c : null);

const vi = [];
const appr = [];
const dropped = [];

// ---- Newspoll VI: date,coalition,alp,greens,others,democrats,one_nation ---
//      onp is null everywhere this term (the party didn't exist yet); the
//      2PP join keeps only the six 1996-campaign waves whose pair is printed
const tppNp = Object.fromEntries(
  parseCsv("data/newspoll-two-party-preferred.csv").slice(1)
    .map((c) => [c[0], { tpp_alp: pct(c[1]), tpp_lnp: pct(c[2]) }]));
for (const c of parseCsv("data/newspoll-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0])) continue;
  const t = tppNp[c[0]];
  if (!t) { dropped.push(`Newspoll ${c[0]} — no matching 2PP row`); continue; }
  vi.push({ date: c[0], firm: "Newspoll",
    lnp: pct(c[1]), alp: pct(c[2]), grn: pct(c[3]),
    onp: pct(c[6]), oth: num(c[4]) + num(c[5]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- Newspoll ratings: per-leader sparse columns; three opposition leaders
//      this term (chronological eraPick), Keating the PM column throughout
const leaderIdx = (hdr, ...names) => names.map((n) => hdr.indexOf(n));
const eraPick = (c, idxs) => {
  for (const i of idxs) { const v = pct(c[i]); if (v != null) return v; }
  return null;
};
const sat = parseCsv("data/newspoll-leader-net-satisfaction.csv");
const satOppIdx = leaderIdx(sat[0], "john_hewson", "alexander_downer", "john_howard");
const satPmIdx = sat[0].indexOf("paul_keating");
const ppmRows = parseCsv("data/newspoll-better-pm.csv");
const ppmPmIdx = ppmRows[0].indexOf("paul_keating");
const ppmOppIdx = leaderIdx(ppmRows[0], "john_hewson", "alexander_downer", "john_howard");
const ppm = Object.fromEntries(ppmRows.slice(1)
  .map((c) => [c[0], { pmPpm: pct(c[ppmPmIdx]), oppPpm: eraPick(c, ppmOppIdx) }]));
for (const c of sat.slice(1)) {
  if (!inTerm(c[0])) continue;
  const pmNet = pct(c[satPmIdx]);
  if (pmNet == null) { dropped.push(`Newspoll-sat ${c[0]} — no Keating reading`); continue; }
  const p = ppm[c[0]] ?? { pmPpm: null, oppPpm: null };
  appr.push({ date: c[0], firm: "Newspoll",
    pmNet, oppNet: eraPick(c, satOppIdx), pmPpm: p.pmPpm, oppPpm: p.oppPpm });
}

// ---- Election marker (each cycle array closes on its own result) -----------
const e = D.elections.e1996;
if (!e) throw new Error("elections.e1996 missing");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 1993 first preferences/2PP.
//      ONP is a true 0 — the party didn't exist (header note); oth folds in
//      the Democrats' 3.8 + others 5.1.
D.elections.e1993 ||= { date: TERM[0],
  lnp: 44.3, alp: 44.9, grn: 1.9, onp: 0, oth: 8.9, tpp_lnp: 48.6, tpp_alp: 51.4 };

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of vi) {
  if (["lnp", "alp", "oth", "tpp_lnp", "tpp_alp"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + (r.grn ?? 0) + (r.onp ?? 0) + r.oth;
  // Newspoll is the only house and its kept rows print exactly 100
  if (r.firm !== "Election" && (sum < 85 || sum > 100.5))
    { guard.push(`${r.date} ${r.firm} — shares sum ${sum}`); continue; }
  if (Math.abs(r.tpp_lnp + r.tpp_alp - 100) > 0.6)
    { guard.push(`${r.date} ${r.firm} — 2PP sums ${r.tpp_lnp + r.tpp_alp}`); continue; }
}
for (const r of appr)
  if (r.pmNet == null && r.pmPpm == null)
    guard.push(`${r.date} ${r.firm} — no PM reading at all`);
if (guard.length) {
  console.error("aborting — rows failed sanity checks:\n  " + guard.join("\n  "));
  process.exit(1);
}

// ---- merge: skip any date+firm already on file, splice date-sorted --------
const splice = (key, rows, target) => {
  const cycle = D[target][key];
  const seen = new Set(cycle.map((p) => p.date + "|" + p.firm));
  const fresh = rows.filter((r) => !seen.has(r.date + "|" + r.firm));
  D[target][key] = cycle.concat(fresh).toSorted((a, b) => a.date.localeCompare(b.date));
  return [cycle.length, fresh];
};

const [viBefore, viFresh] = splice(CYCLE_KEY, vi, "cyclePolls");
const [apBefore, apFresh] = splice(APPR_KEY, appr, "cycleApproval");
const fmt = (list) => {
  const by = {};
  for (const r of list) by[r.firm] = (by[r.firm] || 0) + 1;
  return Object.entries(by).map(([f, n]) => `${f} ${n}`).join(", ") || "none";
};
const span = (list) => list.length
  ? `${list.map((r) => r.date).sort()[0]} → ${list.map((r) => r.date).sort().at(-1)}` : "—";

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`VI:  existing ${viBefore} · candidates ${vi.length} · new ${viFresh.length} (${fmt(viFresh)}) · span ${span(viFresh)} · cyclePolls.${CYCLE_KEY} total ${D.cyclePolls[CYCLE_KEY].length}`);
console.log(`appr: existing ${apBefore} · candidates ${appr.length} · new ${apFresh.length} (${fmt(apFresh)}) · span ${span(apFresh)} · cycleApproval.${APPR_KEY} total ${D.cycleApproval[APPR_KEY].length}`);
console.log(`null onp: ${viFresh.filter((r) => r.onp == null).length} of ${viFresh.length} fresh (party not yet formed)`);
console.log(`null oppNet: ${apFresh.filter((r) => r.oppNet == null).length} of ${apFresh.length} fresh · null ppm: ${apFresh.filter((r) => r.pmPpm == null).length}`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (APPLY && (viFresh.length || apFresh.length || !process.env.NO_WRITE))
  writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
