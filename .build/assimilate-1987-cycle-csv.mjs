// Backfill the 1987–1990 term (Hawke's third — the "John Howard first term
// as opposition leader" era) into data/polls.json — Newspoll voting
// intention into cyclePolls.1990, Newspoll leadership ratings into
// cycleApproval.1987, and the 1987 result into elections.e1987. Modelled on
// the 1990 and 1993 siblings; per the skill, the era's per-source quirks
// were re-checked first, and they differ from those scripts' in these
// load-bearing ways:
//
//   Morgan and ACNielsen remain ABSENT (Morgan's wave table opens
//   1996-03-23; ACNielsen's CSV opens 1996-03-02). Newspoll is again the
//   only house on file, and their blocks are omitted rather than returning
//   zero candidates.
//
//   Newspoll 2PP — ZERO in-window rows: the two-party-preferred table's
//   coverage begins 1993-02-14, a full term away. Every one of the 34
//   primary waves is KEPT with tpp_lnp/tpp_alp null — null is not a
//   fabricated estimate (per the 1993 revision), and the cyc tpp line
//   degrades honestly to its election anchors on both ends. The guard's
//   half-pair and printed-pair checks simply never fire this term.
//
//   One Nation — didn't exist (founded April 1997); Newspoll's one_nation
//   column is blank on every in-window wave, so all rows carry onp: null.
//   Greens likewise get no separate column; blank is
//   null-with-zero-contribution (rows still sum exactly 100), so only
//   lnp/alp/oth are hard-checked.
//
//   Leadership — Hawke the PM column throughout (34 sat readings,
//   1987-08-23 → 1990-03-22 — every in-window sat row is his). The
//   opposition changes mid-term: Howard (replaced 1989-05-09) → Peacock.
//   The sat table partitions cleanly at the spill: Howard 21 (1987-08-23 →
//   1989-05-07) + Peacock 13 (1989-05-21 → 1990-03-22) = 34/34, so
//   eraPick is the chronological pair [john_howard, andrew_peacock] —
//   note the column ORDER quirk: john_howard also names the PPM-PM
//   column in a LATER term; read the era's columns by name, never by
//   position.
//
//   PPM barely exists this term: Newspoll asked better-PM only in the
//   1990 campaign fortnight (1990-03-04, 03-18, 03-22 — Hawke v Peacock,
//   3 rows), not regularly until mid-1991. The bulk of the term carries
//   null ppm — a coverage fact, not a drop.
//
//   The 1987 anchor: AEC official first preferences ALP 45.8 / Coalition
//   45.7 (Lib 34.32 + Nat 11.35 = 45.67 → 45.7; Morgan's archive prints
//   45.9 — its own convention, NOT used, same rule as e1996), TPP
//   50.8–49.2. No AEC Greens category existed in 1987 — grn: 0 is a true
//   zero like onp; oth folds the Democrats' 6.0 + Independents 0.3 +
//   others 2.2 = 8.5. Row sums exactly 100.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 1990-03-24 Election marker from elections.e1990 (seeded
// by assimilate-1990-cycle-csv.mjs — run it FIRST); cycleApproval rows
// ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where a wave didn't
// ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by default;
// --apply writes data/polls.json.
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const TERM = ["1987-07-11", "1990-03-24"];          // 1987 election day .. 1990 election day
const CYCLE_KEY = "1990";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "1987";                            // cycleApproval is keyed by the term-START election

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
//      onp is null everywhere this term (the party didn't exist yet); NO
//      in-window wave prints a 2PP (the table opens 1993-02-14) — all 34
//      rows keep null tpp (see the header note)
const tppNp = Object.fromEntries(
  parseCsv("data/newspoll-two-party-preferred.csv").slice(1)
    .map((c) => [c[0], { tpp_alp: pct(c[1]), tpp_lnp: pct(c[2]) }]));
for (const c of parseCsv("data/newspoll-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0])) continue;
  const t = tppNp[c[0]] ?? { tpp_alp: null, tpp_lnp: null };
  vi.push({ date: c[0], firm: "Newspoll",
    lnp: pct(c[1]), alp: pct(c[2]), grn: pct(c[3]),
    onp: pct(c[6]), oth: num(c[4]) + num(c[5]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- Newspoll ratings: Hawke the PM column start to end; two opposition
//      leaders this term (chronological eraPick Howard → Peacock)
const leaderIdx = (hdr, ...names) => names.map((n) => hdr.indexOf(n));
const eraPick = (c, idxs) => {
  for (const i of idxs) { const v = pct(c[i]); if (v != null) return v; }
  return null;
};
const sat = parseCsv("data/newspoll-leader-net-satisfaction.csv");
const satPmIdx = sat[0].indexOf("bob_hawke");
const satOppIdx = leaderIdx(sat[0], "john_howard", "andrew_peacock");
const ppmRows = parseCsv("data/newspoll-better-pm.csv");
const ppmPmIdx = ppmRows[0].indexOf("bob_hawke");
const ppmOppIdx = leaderIdx(ppmRows[0], "john_howard", "andrew_peacock");
const ppm = Object.fromEntries(ppmRows.slice(1)
  .map((c) => [c[0], { pmPpm: pct(c[ppmPmIdx]), oppPpm: eraPick(c, ppmOppIdx) }]));
for (const c of sat.slice(1)) {
  if (!inTerm(c[0])) continue;
  const pmNet = pct(c[satPmIdx]);
  if (pmNet == null) { dropped.push(`Newspoll-sat ${c[0]} — no PM reading`); continue; }
  const p = ppm[c[0]] ?? { pmPpm: null, oppPpm: null };
  appr.push({ date: c[0], firm: "Newspoll",
    pmNet, oppNet: eraPick(c, satOppIdx), pmPpm: p.pmPpm, oppPpm: p.oppPpm });
}

// ---- Election marker (each cycle array closes on its own result) -----------
const e = D.elections.e1990;
if (!e) throw new Error("elections.e1990 missing — run assimilate-1990-cycle-csv.mjs first");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 1987 first preferences/2PP.
//      No Greens category yet (grn 0 is a true zero, like onp — see header);
//      oth folds in the Democrats' 6.0 + Independents 0.3 + others 2.2.
D.elections.e1987 ||= { date: TERM[0],
  lnp: 45.7, alp: 45.8, grn: 0, onp: 0, oth: 8.5, tpp_lnp: 49.2, tpp_alp: 50.8 };

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of vi) {
  if (["lnp", "alp", "oth"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + (r.grn ?? 0) + (r.onp ?? 0) + r.oth;
  // Newspoll is the only house and its rows print exactly 100
  if (r.firm !== "Election" && (sum < 85 || sum > 100.5))
    { guard.push(`${r.date} ${r.firm} — shares sum ${sum}`); continue; }
  // a 2PP arrives whole or not at all: half a pair is a parse bug, and a
  // printed pair sums to 100 within Newspoll's strict rounding
  if ((r.tpp_lnp == null) !== (r.tpp_alp == null))
    { guard.push(`${r.date} ${r.firm} — half a 2PP pair`); continue; }
  if (r.tpp_lnp != null && Math.abs(r.tpp_lnp + r.tpp_alp - 100) > 0.6)
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
console.log(`null tpp: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.tpp_alp == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (2PP unprinted all term — table opens 1993-02-14)`);
console.log(`null onp: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.onp == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (party not yet formed)`);
console.log(`null grn: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.grn == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (no separate Greens column printed)`);
console.log(`null oppNet: ${apFresh.filter((r) => r.oppNet == null).length} of ${apFresh.length} fresh · null ppm: ${apFresh.filter((r) => r.pmPpm == null).length}`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (APPLY && (viFresh.length || apFresh.length || !process.env.NO_WRITE))
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
