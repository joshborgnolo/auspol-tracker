// Backfill the 1996–1998 term (Howard's first) into data/polls.json —
// Newspoll, Roy Morgan and ACNielsen voting intention into cyclePolls.1998,
// Newspoll and ACNielsen leadership ratings into cycleApproval.1996, and the
// 1996 result into elections.e1996. Modelled on
// .build/assimilate-1998-cycle-csv.mjs; per the skill, the era's per-source
// quirks were re-checked first, and they differ from that script's in these
// load-bearing ways:
//
//   One Nation did not exist for the first year of the term — Pauline Hanson
//   won Oxley as a disendorsed-Liberal independent and founded the party in
//   April 1997. All three houses' one_nation columns are blank exactly until
//   then (Newspoll first prints it 1997-04-06; Morgan's blanks run to
//   1997-04-10; ACN blanks its early waves), and blank rows still sum to
//   exactly 100 — nothing is folded anywhere, the party simply isn't in the
//   universe yet. Those rows carry onp: null. Post-April-1997 all three
//   print real one_nation and oth excludes it, as in the later drills.
//
//   Newspoll 2PP — the archive's two-party-preferred table is again empty
//   for the term except the 1998 campaign: five waves (1998-09-06 →
//   1998-10-01) carry a printed pair, and the primary↔2PP join keeps just
//   those five; the other 64 in-window primary waves are dropped for want
//   of a 2PP, same rule as the preceding drills (no fabricated estimates).
//
//   Morgan — 74 in-window waves (1996-03-23 → 1998-09-24), every one
//   mode-BLANK, dates unique across the window (uniq -d empty), 2PP join
//   complete, and cell rounding is MILD this term: sums run 100–104.5, so
//   the loose tolerance caps at 105 rather than the 106.5 later eras
//   needed. Its 1996 and 1998 election rows are election=1 and skipped;
//   the cycle's Election marker comes from elections.e1998 (already on
//   file) and the term-start anchor from the new elections.e1996.
//
//   ACNielsen — the archive's first real wave is 1996-05-05 (the CSV opens
//   on the 1996 election row). 34 in-window waves, sums within 85–102.5,
//   and leadership ratings are mostly filled (24/34 approve pairs, 30/34
//   PPM) with nulls carried where a wave didn't ask.
//
//   Newspoll ratings — satisfaction and PPM columns for Howard and Beazley
//   are filled on every in-window wave (67/67 · 68/68); Beazley led the
//   ALP the whole term, so eraPick stays a one-name list.
//
//   The 1996 anchor itself: AEC official — One Nation is 0 (the party
//   didn't exist), NOT Morgan's convention of printing Hanson-the-
//   independent's ~0.3 inside its one_nation election cell.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 1998-10-03 Election marker from elections.e1998;
// cycleApproval rows ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where
// a wave didn't ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by
// default; --apply writes data/polls.json.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const TERM = ["1996-03-02", "1998-10-03"];          // 1996 election day .. 1998 election day
const CYCLE_KEY = "1998";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "1996";                            // cycleApproval is keyed by the term-START election

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
//      onp is null where the party didn't exist yet (pre-1997-04 waves); the
//      2PP join keeps only the five 1998-campaign waves whose pair is printed
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
  // one_nation (c[7]) is null until the party exists, real after
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
  // that didn't ask at all (four in-window waves carry a ratings block of
  // pure blanks) contributes no approval row, and one that asked only some
  // questions carries nulls on the rest
  const pmNet = pct(c[18]) != null && pct(c[19]) != null ? pct(c[18]) - pct(c[19]) : null;
  const oppNet = pct(c[22]) != null && pct(c[23]) != null ? pct(c[22]) - pct(c[23]) : null;
  const pmPpm = pct(c[25]), oppPpm = pct(c[26]);
  if (pmNet == null && oppNet == null && pmPpm == null && oppPpm == null)
    { dropped.push(`ACNielsen ${c[0]} — wave asked no leadership questions`); continue; }
  appr.push({ date: c[0], firm: "ACNielsen", pmNet, oppNet, pmPpm, oppPpm });
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
const e = D.elections.e1998;
if (!e) throw new Error("elections.e1998 missing");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 1996 first preferences/2PP.
//      ONP is a true 0 — the party didn't exist (header note); oth folds in
//      the Democrats' 6.8.
D.elections.e1996 ||= { date: TERM[0],
  lnp: 46.9, alp: 38.8, grn: 1.7, onp: 0, oth: 12.6, tpp_lnp: 53.6, tpp_alp: 46.4 };

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of vi) {
  if (["lnp", "alp", "grn", "oth", "tpp_lnp", "tpp_alp"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + r.grn + (r.onp ?? 0) + r.oth;
  // ACNielsen redistributed its uncommitted (rounded shares print up to
  // ~102.5) and Morgan's 0.5-grain cells ride to 104.5 this term (milder
  // than the 106.5 of 1999+); both score their own tolerance
  const loose = r.firm === "ACNielsen" || r.firm === "Morgan";
  if (r.firm !== "Election" && (sum < 85 || sum > (loose ? 105 : 100.5)))
    { guard.push(`${r.date} ${r.firm} — shares sum ${sum}`); continue; }
  // Morgan's 0.5-grain 2PP cells print three genuine 101-sum rows this term
  // (45.5+55.5, 54.5+46.5) — print rounding, not a parse failure
  if (Math.abs(r.tpp_lnp + r.tpp_alp - 100) > (r.firm === "Morgan" ? 1.0 : 0.6))
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
  writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
