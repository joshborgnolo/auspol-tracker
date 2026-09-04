// Backfill the 1990–1993 term (Hawke's third, then Keating's first) into
// data/polls.json — Newspoll voting intention into cyclePolls.1993, Newspoll
// leadership ratings into cycleApproval.1990, and the 1990 result into
// elections.e1990. Modelled on .build/assimilate-1993-cycle-csv.mjs; per the
// skill, the era's per-source quirks were re-checked first, and they differ
// from that script's in these load-bearing ways:
//
//   This sits one term ABOVE the archive floor, but the floor barely moved:
//   Morgan's poll-wave table still has NO printed waves in the window (first
//   real wave 1996-03-23), and ACNielsen's CSV opens on 1996-03-02. Newspoll
//   is again the only house on file, and both Morgan and ACNielsen blocks
//   are absent from this script rather than returning zero candidates.
//
//   Newspoll 2PP — five in-window waves print a pair, all in the 1993
//   campaign window (1993-02-14 → 1993-03-11; the table's coverage begins
//   1993-02-14). The other 49 primary waves are KEPT with tpp_lnp/tpp_alp
//   null — null is not a fabricated estimate (the no-fabrication rule
//   stands, per the 1993 revision), and the whole downstream is null-safe.
//   All five paired rows sum to exactly 100 within Newspoll's rounding.
//
//   One Nation — the party didn't exist (founded April 1997); Newspoll's
//   one_nation column is blank on every in-window wave, so all rows carry
//   onp: null. Greens likewise get no separate column this term; blank is
//   null-with-zero-contribution (rows still sum exactly 100), so only
//   lnp/alp/oth are hard-checked.
//
//   Leadership — the first mid-TERM prime-ministerial change on file:
//   Hawke (spilled 1991-12-19) → Keating. Both Newspoll tables partition
//   the window exactly at the spill: sat Hawke 21 (1990-04-22 →
//   1991-12-08) + Keating 32 (1992-01-19 → 1993-03-11) = 53/53, and ppm
//   Hawke 7 + Keating 32 = 39/39 — so the PM side is an eraPick pair
//   ([bob_hawke, paul_keating], chronological), mirroring the 1993 drill's
//   three-name opposition eraPick. Opposition is Hewson the whole term:
//   Newspoll's first in-window rating (1990-04-22) lands AFTER he took the
//   leadership (1990-04-11), so Peacock's caretaker fortnight never
//   appears — no oppSpl on this cycle.
//
//   PPM question STARTS mid-term: Newspoll did not ask better-PM in this
//   window before 1991-07-28. The term's first 15 months carry null ppm —
//   a coverage fact, not a drop.
//
//   The 1990 anchor is the backward win: AEC official first preferences
//   ALP 39.4 / Coalition 43.5 (4,302,127/9,899,674 = 43.46 → 43.5;
//   Morgan's archive prints 43.4 for its own reasons — NOT used), with
//   Labor LOSING the TPP 49.9–50.1 and keeping government on seats. No
//   AEC Greens category existed until 1993 (1990's Greens candidates sit
//   in others), so grn: 0 is a true zero like onp. oth folds the
//   Democrats' 11.3 + others 5.9 = 17.1 at exacts. Row sums exactly 100.
//
// Row shapes are the curated ones: cyclePolls rows
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}), and the
// cycle closes on the 1993-03-13 Election marker from elections.e1993;
// cycleApproval rows ({date,firm,pmNet,oppNet,pmPpm,oppPpm}) with nulls where
// a wave didn't ask. Re-runs are no-ops (dedupe on date+firm). Dry-run by
// default; --apply writes data/polls.json.
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const TERM = ["1990-03-24", "1993-03-13"];          // 1990 election day .. 1993 election day
const CYCLE_KEY = "1993";                           // cyclePolls is keyed by the term-END election
const APPR_KEY = "1990";                            // cycleApproval is keyed by the term-START election

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
//      onp is null everywhere this term (the party didn't exist yet); only
//      five 1993-campaign waves print a 2PP pair — the other 49 rows keep
//      null tpp rather than being dropped (see the header note)
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

// ---- Newspoll ratings: per-leader sparse columns; two PMs this term
//      (chronological eraPick on the PM side this time), Hewson the sole
//      opposition leader all term
const leaderIdx = (hdr, ...names) => names.map((n) => hdr.indexOf(n));
const eraPick = (c, idxs) => {
  for (const i of idxs) { const v = pct(c[i]); if (v != null) return v; }
  return null;
};
const sat = parseCsv("data/newspoll-leader-net-satisfaction.csv");
const satPmIdx = leaderIdx(sat[0], "bob_hawke", "paul_keating");
const satOppIdx = sat[0].indexOf("john_hewson");
const ppmRows = parseCsv("data/newspoll-better-pm.csv");
const ppmPmIdx = leaderIdx(ppmRows[0], "bob_hawke", "paul_keating");
const ppmOppIdx = ppmRows[0].indexOf("john_hewson");
const ppm = Object.fromEntries(ppmRows.slice(1)
  .map((c) => [c[0], { pmPpm: eraPick(c, ppmPmIdx), oppPpm: pct(c[ppmOppIdx]) }]));
for (const c of sat.slice(1)) {
  if (!inTerm(c[0])) continue;
  const pmNet = eraPick(c, satPmIdx);
  if (pmNet == null) { dropped.push(`Newspoll-sat ${c[0]} — no PM reading`); continue; }
  const p = ppm[c[0]] ?? { pmPpm: null, oppPpm: null };
  appr.push({ date: c[0], firm: "Newspoll",
    pmNet, oppNet: pct(c[satOppIdx]), pmPpm: p.pmPpm, oppPpm: p.oppPpm });
}

// ---- Election marker (each cycle array closes on its own result) -----------
const e = D.elections.e1993;
if (!e) throw new Error("elections.e1993 missing — run assimilate-1993-cycle-csv.mjs first");
vi.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- The term-start election itself: AEC 1990 first preferences/2PP.
//      No Greens category yet (grn 0 is a true zero, like onp — see header);
//      oth folds in the Democrats' 11.3 + others 5.9 (= 17.1 at exacts).
D.elections.e1990 ||= { date: TERM[0],
  lnp: 43.5, alp: 39.4, grn: 0, onp: 0, oth: 17.1, tpp_lnp: 50.1, tpp_alp: 49.9 };

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
console.log(`null tpp: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.tpp_alp == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (2PP unprinted except the 1993 campaign window)`);
console.log(`null onp: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.onp == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (party not yet formed)`);
console.log(`null grn: ${D.cyclePolls[CYCLE_KEY].filter((r) => r.grn == null).length} of ${D.cyclePolls[CYCLE_KEY].length} in cycle (no separate Greens column printed)`);
console.log(`null oppNet: ${apFresh.filter((r) => r.oppNet == null).length} of ${apFresh.length} fresh · null ppm: ${apFresh.filter((r) => r.pmPpm == null).length}`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (APPLY && (viFresh.length || apFresh.length || !process.env.NO_WRITE))
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
