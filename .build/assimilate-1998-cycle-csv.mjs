// Backfill the 1998–2001 term (Howard's second) into data/polls.json —
// Newspoll, Roy Morgan and ACNielsen voting intention into cyclePolls.2001,
// Newspoll and ACNielsen leadership ratings into cycleApproval.1998, and the
// 1998 result into elections.e1998. Modelled on
// .build/assimilate-2001-cycle-csv.mjs; per the skill, the era's per-source
// quirks were re-checked first, and they differ from that script's in these
// load-bearing ways:
//
//   Newspoll 2PP — the archive's two-party-preferred table is essentially
//   empty between 1996 and the 2001 campaign: in-window only six waves
//   (2001-10-07 → 2001-11-08) carry a printed pair. The usual primary↔2PP
//   join therefore KEEPS just those six; the other 73 in-window primary
//   waves are dropped for want of a 2PP, same rule as the preceding drills
//   (no fabricated estimates). Newspoll primaries themselves print a real
//   one_nation column on ALL 79 in-window waves, so onp stays real and oth
//   is the printed others+democrats lump.
//
//   One Nation was at its peak — 8.43% at the 1998 election — and printed
//   as real numbers everywhere: Newspoll all 79 waves, Morgan all 85
//   in-window waves (5.5 → 2.5 across the term, 0.5-grain as ever), ACN on
//   all 27 of its waves. So oth is the minor-party lump EXCLUDING
//   one_nation throughout, same as the 2001 drill.
//
//   Morgan mode — every in-window wave is mode-BLANK. Dates are unique
//   across the window (uniq -d empty), so the blank-mode date|mode join is
//   safe. Both Morgan election rows in the window (the 1998-10-01
//   preliminary AND the 1998-10-03 final) are election=1 and skipped; the
//   cycle's Election marker comes from elections.e2001 instead (and the
//   term-start anchor from the new elections.e1998).
//
//   ACNielsen — the archive starts 1996, but its next wave after the 1998
//   election is 1999-02-27: in-window waves run 1999-02-27 → 2001-11-08
//   (27 waves), none in late 1998. Ibid the earlier drills: phone mode,
//   uncommitted redistributed (shares can print ~102), date is the LAST
//   day of the printed range. Its election=1 1998/2001 rows are skipped.
//
//   Leadership — Beazley led the ALP for the whole term, so eraPick is a
//   one-name list; kim_beazley and john_howard are filled on ALL 79
//   satisfaction and better-PM waves alike (79/79 · 79/79).
//
//   The 1998 result itself is the odd one out: Labor WON the two-party
//   vote 51.0–49.0 but lost the seats, so elections.e1998 carries
//   tpp_lnp 49.0 / tpp_alp 51.0 — tpp_alp higher than tpp_lnp is correct
//   here.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 2001-11-10 Election marker from elections.e2001;
// cycleApproval rows ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where
// a wave didn't ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by
// default; --apply writes data/polls.json.
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const TERM = ["1998-10-03", "2001-11-10"];          // 1998 election day .. 2001 election day
const CYCLE_KEY = "2001";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "1998";                            // cycleApproval is keyed by the term-START election

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
//      onp is real on every in-window wave (see the header note); the 2PP
//      join keeps only the six campaign waves whose pair is printed
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

// ---- Morgan VI: date,election,alp,coalition,lib,nat,greens,one_nation,nxt,
//      family_first,democrats,independents,other_parties,other,undecided,mode
const tppRm = new Map(
  parseCsv("data/roymorgan-two-party-preferred.csv").slice(1)
    .filter((c) => c[1] !== "1")
    .map((c) => [`${c[0]}|${(c[6] ?? "").trim()}`, { tpp_alp: pct(c[2]), tpp_lnp: pct(c[3]) }]));
for (const c of parseCsv("data/roymorgan-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0]) || c[1] === "1") continue;
  const mode = (c[15] ?? "").trim();           // all blank in this window
  const t = tppRm.get(`${c[0]}|${mode}`);
  if (!t) { dropped.push(`Morgan ${c[0]} (${mode || "blank"}) — no matching 2PP row`); continue; }
  // one_nation (c[7]) is REAL in-era, so it carries the cycle's onp series
  // instead of folding into oth; see the header note
  vi.push({ date: c[0], firm: "Morgan",
    lnp: pct(c[3]), alp: pct(c[2]), grn: pct(c[6]),
    onp: pct(c[7]),
    oth: num(c[8]) + num(c[9]) + num(c[10]) + num(c[11]) + num(c[12]) + num(c[13]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- ACNielsen VI: date,election,sample,moe,mode,alp,coalition,democrats,
//      greens,independents,one_nation,other,family_first,tpp_alp,tpp_coalition,
//      tpp_flow_alp,tpp_flow_coalition,pm,pm_approve,pm_disapprove,
//      pm_uncommitted,opp_leader,ol_approve,ol_disapprove,ol_uncommitted,
//      ppm_pm,ppm_opp,ppm_uncommitted  (28-col schema)
const acn = parseCsv("data/acnielsen-polls.csv");
if (acn[0][0] !== "date" || acn[0].length !== 28 || acn[0][12] !== "family_first")
  throw new Error("acnielsen-polls.csv schema changed — re-check column positions");
for (const c of acn.slice(1)) {
  if (!inTerm(c[0]) || c[1] === "1") continue;
  vi.push({ date: c[0], firm: "ACNielsen",
    lnp: pct(c[6]), alp: pct(c[5]), grn: pct(c[8]),
    onp: pct(c[10]), oth: num(c[7]) + num(c[9]) + num(c[11]) + num(c[12]),
    tpp_lnp: pct(c[14]), tpp_alp: pct(c[13]) });
  // leadership ratings on the same row — net = approve − disapprove; a wave
  // that didn't ask leaves the field blank and the row carries null
  appr.push({ date: c[0], firm: "ACNielsen",
    pmNet: pct(c[18]) != null && pct(c[19]) != null ? pct(c[18]) - pct(c[19]) : null,
    oppNet: pct(c[22]) != null && pct(c[23]) != null ? pct(c[22]) - pct(c[23]) : null,
    pmPpm: pct(c[25]), oppPpm: pct(c[26]) });
}

// ---- Newspoll ratings: per-leader sparse columns; Beazley is the sole
//      opposition leader this term (one-name eraPick), Howard the PM column
const leaderIdx = (hdr, ...names) => names.map((n) => hdr.indexOf(n));
const eraPick = (c, idxs) => {
  for (const i of idxs) { const v = pct(c[i]); if (v != null) return v; }
  return null;
};
const sat = parseCsv("data/newspoll-leader-net-satisfaction.csv");
const satOppIdx = leaderIdx(sat[0], "kim_beazley");
const satPmIdx = sat[0].indexOf("john_howard");
const ppmRows = parseCsv("data/newspoll-better-pm.csv");
const ppmPmIdx = ppmRows[0].indexOf("john_howard");
const ppmOppIdx = leaderIdx(ppmRows[0], "kim_beazley");
const ppm = Object.fromEntries(ppmRows.slice(1)
  .map((c) => [c[0], { pmPpm: pct(c[ppmPmIdx]), oppPpm: eraPick(c, ppmOppIdx) }]));
for (const c of sat.slice(1)) {
  if (!inTerm(c[0])) continue;
  const pmNet = pct(c[satPmIdx]);
  if (pmNet == null) { dropped.push(`Newspoll-sat ${c[0]} — no Howard reading`); continue; }
  const p = ppm[c[0]] ?? { pmPpm: null, oppPpm: null };
  appr.push({ date: c[0], firm: "Newspoll",
    pmNet, oppNet: eraPick(c, satOppIdx), pmPpm: p.pmPpm, oppPpm: p.oppPpm });
}

// ---- Election marker (each cycle array closes on its own result) -----------
const e = D.elections.e2001;
if (!e) throw new Error("elections.e2001 missing");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 1998 first preferences/2PP.
//      Labor won the 2PP 51.0–49.0 but lost government on seats (header
//      note); ONP keeps its true 8.4 — its peak — and oth folds in the
//      Democrats' 5.1.
D.elections.e1998 ||= { date: TERM[0],
  lnp: 39.2, alp: 40.1, grn: 1.7, onp: 8.4, oth: 10.6, tpp_lnp: 49.0, tpp_alp: 51.0 };

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of vi) {
  if (["lnp", "alp", "grn", "oth", "tpp_lnp", "tpp_alp"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + r.grn + (r.onp ?? 0) + r.oth;
  // ACNielsen redistributed its uncommitted, so its rounded shares print up
  // to ~102 rather than exactly 100, and in-era Morgan cells ride similarly
  // high, this window topping out at 106.5 (1999-07-04: 43+47+4.5+3.5
  // +6.5+2 as printed, lib+nat=coalition, undecided blank — the source's
  // own 0.5-grain cell rounding, not a parse failure); both score their
  // own tolerance
  const loose = r.firm === "ACNielsen" || r.firm === "Morgan";
  if (r.firm !== "Election" && (sum < 85 || sum > (loose ? 106.5 : 100.5)))
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
console.log(`null onp: ${viFresh.filter((r) => r.onp == null).length} of ${viFresh.length} fresh · real onp span ${span(viFresh.filter((r) => r.onp != null))}`);
console.log(`null oppNet: ${apFresh.filter((r) => r.oppNet == null).length} of ${apFresh.length} fresh · null ppm: ${apFresh.filter((r) => r.pmPpm == null).length}`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (APPLY && (viFresh.length || apFresh.length || !process.env.NO_WRITE))
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
