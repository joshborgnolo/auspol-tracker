// Backfill the 2004–2007 term (Howard's fourth) into data/polls.json —
// Newspoll, Roy Morgan and ACNielsen voting intention into cyclePolls.2007,
// Newspoll and ACNielsen leadership ratings into cycleApproval.2004, and the
// 2004 result into elections.e2004. Modelled on
// .build/assimilate-2007-cycle-csv.mjs (the 2007-term drill); per the skill,
// the era's per-source quirks were re-checked first, and they differ from
// that script's in three places:
//
//   Morgan mode — 95 of the 102 waves are mode-BLANK (Morgan was face-to-face
//   only until ~2007; the mode column only fills in from then). The 2007
//   script dropped blank rows because ONE collided date-for-date with a
//   labelled wave; this era's dates are unique in both Morgan files (checked
//   2026-09-03), so blanks join on date|mode cleanly and are kept.
//
//   One Nation — spent (1.2% at the 2004 poll, sub-2 through the term) and
//   Newspoll never printed an ONP column in-era, so the cycle's onp field
//   stays null throughout and ONP is FOLDED into oth on the Morgan/ACNielsen
//   side, matching the Newspoll "others" lump that already includes them. The
//   2007-era script instead excluded ONP from oth entirely; there every
//   Morgan one_nation cell was the sub-threshold string "< 0.5", here real
//   0.5–2 readings would otherwise leave the houses ~1pt apart on the same
//   reality. elections.e2004 keeps onp: null for the same reason (convention
//   from e2010/e2013) — a non-null anchor with all-null readings would draw a
//   flat phantom ONP line across the term (cycleSeries holds the last value).
//
//   ACNielsen (user request) — single wide CSV: primaries + 2PP + satisfaction
//   + PPM; mode=phone on every wave; no undecided column (ACN redistributed
//   them, so VI columns already sum to ~100); date is the LAST day of the
//   printed range. (When this drill shipped the series stopped 2006-06-17; the
//   archive has since been extended through 2012, so a re-run will now also
//   pick up the 2007 in-term waves Feb–Nov.)
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 2007-11-24 Election marker from elections.e2007;
// cycleApproval rows ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where
// a wave didn't ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by
// default; --apply writes data/polls.json.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const TERM = ["2004-10-09", "2007-11-24"];          // 2004 election day .. 2007 election day
const CYCLE_KEY = "2007";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "2004";                            // cycleApproval is keyed by the term-START election

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
const tppNp = Object.fromEntries(
  parseCsv("data/newspoll-two-party-preferred.csv").slice(1)
    .map((c) => [c[0], { tpp_alp: pct(c[1]), tpp_lnp: pct(c[2]) }]));
for (const c of parseCsv("data/newspoll-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0])) continue;
  const t = tppNp[c[0]];
  if (!t) { dropped.push(`Newspoll ${c[0]} — no matching 2PP row`); continue; }
  vi.push({ date: c[0], firm: "Newspoll",
    lnp: pct(c[1]), alp: pct(c[2]), grn: pct(c[3]),
    onp: null, oth: num(c[4]) + num(c[5]) + num(c[6]),
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
  const mode = (c[15] ?? "").trim();           // blank through most of this era
  const t = tppRm.get(`${c[0]}|${mode}`);
  if (!t) { dropped.push(`Morgan ${c[0]} (${mode || "blank"}) — no matching 2PP row`); continue; }
  // one_nation (c[7]) folds into oth this era; see the header note on ONP
  vi.push({ date: c[0], firm: "Morgan",
    lnp: pct(c[3]), alp: pct(c[2]), grn: pct(c[6]),
    onp: null,
    oth: num(c[7]) + num(c[8]) + num(c[9]) + num(c[10]) + num(c[11]) + num(c[12]) + num(c[13]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- ACNielsen VI: date,election,sample,moe,mode,alp,coalition,democrats,
//      greens,independents,one_nation,other,family_first,tpp_alp,tpp_coalition,
//      tpp_flow_alp,tpp_flow_coalition,pm,pm_approve,pm_disapprove,
//      pm_uncommitted,opp_leader,ol_approve,ol_disapprove,ol_uncommitted,
//      ppm_pm,ppm_opp,ppm_uncommitted
//      (28 cols since the 2007–2012 archive extension: family_first, the
//      election-flow tpp_flow pair and the pm name column were added)
const acn = parseCsv("data/acnielsen-polls.csv");
if (acn[0][0] !== "date" || acn[0].length !== 28 || acn[0][12] !== "family_first")
  throw new Error("acnielsen-polls.csv schema changed — re-check column positions");
for (const c of acn.slice(1)) {
  if (!inTerm(c[0]) || c[1] === "1") continue;
  vi.push({ date: c[0], firm: "ACNielsen",
    lnp: pct(c[6]), alp: pct(c[5]), grn: pct(c[8]),
    onp: null, oth: num(c[7]) + num(c[9]) + num(c[10]) + num(c[11]) + num(c[12]),
    tpp_lnp: pct(c[14]), tpp_alp: pct(c[13]) });
  // leadership ratings on the same row — net = approve − disapprove; a wave
  // that didn't ask leaves the field blank and the row carries null
  appr.push({ date: c[0], firm: "ACNielsen",
    pmNet: pct(c[18]) != null && pct(c[19]) != null ? pct(c[18]) - pct(c[19]) : null,
    oppNet: pct(c[22]) != null && pct(c[23]) != null ? pct(c[22]) - pct(c[23]) : null,
    pmPpm: pct(c[25]), oppPpm: pct(c[26]) });
}

// ---- Newspoll ratings: per-leader sparse columns, era column is the one the
//      wave names — PM column is john_howard for the whole term
const leaderIdx = (hdr, ...names) => names.map((n) => hdr.indexOf(n));
const eraPick = (c, idxs) => {
  for (const i of idxs) { const v = pct(c[i]); if (v != null) return v; }
  return null;
};
const sat = parseCsv("data/newspoll-leader-net-satisfaction.csv");
const satOppIdx = leaderIdx(sat[0], "mark_latham", "kim_beazley", "kevin_rudd");
const satPmIdx = sat[0].indexOf("john_howard");
const ppmRows = parseCsv("data/newspoll-better-pm.csv");
const ppmPmIdx = ppmRows[0].indexOf("john_howard");
const ppmOppIdx = leaderIdx(ppmRows[0], "mark_latham", "kim_beazley", "kevin_rudd");
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
const e = D.elections.e2007;
if (!e) throw new Error("elections.e2007 missing");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 2004 first preferences/2PP.
//      ONP's actual 1.2% is folded into oth — see the header note.
D.elections.e2004 ||= { date: TERM[0],
  lnp: 46.7, alp: 37.6, grn: 7.2, onp: null, oth: 8.5, tpp_lnp: 52.7, tpp_alp: 47.3 };

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of vi) {
  if (["lnp", "alp", "grn", "oth", "tpp_lnp", "tpp_alp"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + r.grn + r.oth;
  // ACNielsen redistributed its uncommitted, so its rounded shares print up
  // to ~102 (2006-02-26) rather than exactly 100 — that's the source, not a
  // parse failure, and it scores its own tolerance
  const isAcn = r.firm === "ACNielsen";
  if (r.firm !== "Election" && (sum < 85 || sum > (isAcn ? 103 : 100.5)))
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
console.log(`null oppNet: ${apFresh.filter((r) => r.oppNet == null).length} of ${apFresh.length} fresh · null ppm: ${apFresh.filter((r) => r.pmPpm == null).length}`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (APPLY && (viFresh.length || apFresh.length || !process.env.NO_WRITE))
  writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
