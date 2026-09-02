// Backfill Newspoll and Roy Morgan voting intention from the static historical
// reference CSVs into cyclePolls.2010 in data/polls.json — the Rudd first-term
// cycle added in 8c8e15c was wired up Essential-only, with this CSV pass
// explicitly deferred. Newspoll's better-PM/approval rows already live in
// cycleApproval.2007; Roy Morgan has no archived satisfaction series for the
// era, so this script covers voting intention only.
//
// Sources (schema + quirks: see .matilda/skills/auto-skill-auspol-historical-csv-qa):
//   data/newspoll-primary-vote.csv + newspoll-two-party-preferred.csv — joined
//     on the fieldwork-end date; coalition is combined, democrats/one_nation
//     blank across the whole era, so oth = others and onp = null.
//   data/roymorgan-primary-vote.csv + roymorgan-two-party-preferred.csv —
//     joined on date+mode; election=1 rows skipped (results, not polls); the
//     one mode-blank non-election row (2010-08-21) is dropped because it
//     collides date-for-date with the labelled phone wave and its provenance
//     can't be named apart. Every one_nation cell in the era is the string
//     "< 0.5", i.e. sub-threshold — maps to onp: null, never coerced. oth is
//     the sum of the minor columns (nxt, family_first, democrats,
//     independents, other_parties, other) with "< 0.5"/blank contributing 0.
//
// Row shape matches the curated cycle rows exactly
// ({"date","firm","lnp","alp","grn","onp","oth","tpp_lnp","tpp_alp"}); the
// script also appends the 2010-08-21 "Election" marker from the elections
// table, the convention every other cycle array already follows. Re-runs are
// no-ops: a candidate is skipped when its date+firm already sits in the
// cycle. Dry-run by default; --apply writes data/polls.json.
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const TERM = ["2007-11-24", "2010-08-21"];          // 2007 election day .. 2010 election day
const CYCLE_KEY = "2010";                           // cyclePolls is keyed by the term-END election

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const cycle = D.cyclePolls[CYCLE_KEY];
if (!cycle) throw new Error(`cyclePolls.${CYCLE_KEY} is missing — add the CYC_META row first`);

const parseCsv = (file) =>
  readFileSync(file, "utf8").trim().split("\n").map((l) => l.split(","));
const inTerm = (d) => d > TERM[0] && d <= TERM[1];
// "< 0.5" and blanks are sub-threshold/absent — zero contribution to sums
const num = (c) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c ?? "") ? +c : 0);
const pct = (c) => (/^\s*-?\d+(\.\d+)?\s*$/.test(c ?? "") ? +c : null);

const rows = [];
const dropped = [];

// ---- Newspoll: date,coalition,alp,greens,others,democrats,one_nation --------
const tppNp = Object.fromEntries(
  parseCsv("data/newspoll-two-party-preferred.csv").slice(1)
    .map((c) => [c[0], { tpp_alp: pct(c[1]), tpp_lnp: pct(c[2]) }]));
for (const c of parseCsv("data/newspoll-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0])) continue;
  const t = tppNp[c[0]];
  if (!t) { dropped.push(`Newspoll ${c[0]} — no matching 2PP row`); continue; }
  rows.push({ date: c[0], firm: "Newspoll",
    lnp: pct(c[1]), alp: pct(c[2]), grn: pct(c[3]),
    onp: null, oth: num(c[4]) + num(c[5]) + num(c[6]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- Roy Morgan: date,election,alp,coalition,lib,nat,greens,one_nation,nxt,
//      family_first,democrats,independents,other_parties,other,undecided,mode
const tppRm = new Map(
  parseCsv("data/roymorgan-two-party-preferred.csv").slice(1)
    .filter((c) => c[1] !== "1")
    .map((c) => [`${c[0]}|${c[6]}`, { tpp_alp: pct(c[2]), tpp_lnp: pct(c[3]) }]));
for (const c of parseCsv("data/roymorgan-primary-vote.csv").slice(1)) {
  if (!inTerm(c[0]) || c[1] === "1") continue;
  const mode = c[15].trim();
  if (!mode) { dropped.push(`Morgan ${c[0]} — mode unrecorded; collides with the labelled wave`); continue; }
  const t = tppRm.get(`${c[0]}|${mode}`);
  if (!t) { dropped.push(`Morgan ${c[0]} (${mode}) — no matching 2PP row`); continue; }
  rows.push({ date: c[0], firm: "Morgan",
    lnp: pct(c[3]), alp: pct(c[2]), grn: pct(c[6]),
    onp: null, oth: num(c[8]) + num(c[9]) + num(c[10]) + num(c[11]) + num(c[12]) + num(c[13]),
    tpp_lnp: t.tpp_lnp, tpp_alp: t.tpp_alp });
}

// ---- Election marker (convention: each cycle array closes on its own result)
const e = D.elections.e2010;
if (!e) throw new Error("elections.e2010 missing");
rows.push({ date: TERM[1], firm: "Election",
  lnp: e.lnp, alp: e.alp, grn: e.grn, onp: e.onp, oth: e.oth,
  tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp });

// ---- guards: never insert a dud row ---------------------------------------
const guard = [];
for (const r of rows) {
  if (["lnp", "alp", "grn", "oth", "tpp_lnp", "tpp_alp"].some((k) => r[k] == null || Number.isNaN(r[k])))
    { guard.push(`${r.date} ${r.firm} — null/NaN share`); continue; }
  const sum = r.lnp + r.alp + r.grn + r.oth;
  if (r.firm !== "Election" && (sum < 85 || sum > 100.5))
    { guard.push(`${r.date} ${r.firm} — shares sum ${sum}`); continue; }
  if (Math.abs(r.tpp_lnp + r.tpp_alp - 100) > 0.6)
    { guard.push(`${r.date} ${r.firm} — 2PP sums ${r.tpp_lnp + r.tpp_alp}`); continue; }
}
if (guard.length) {
  console.error("aborting — rows failed sanity checks:\n  " + guard.join("\n  "));
  process.exit(1);
}

// ---- merge: skip any date+firm already on file, splice date-sorted --------
const seen = new Set(cycle.map((p) => p.date + "|" + p.firm));
const fresh = rows.filter((r) => !seen.has(r.date + "|" + r.firm));
const merged = cycle.concat(fresh).toSorted((a, b) => a.date.localeCompare(b.date));
D.cyclePolls[CYCLE_KEY] = merged;

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`existing ${cycle.length} · candidates ${rows.length} · new ${fresh.length} (${[
  `Newspoll ${fresh.filter((r) => r.firm === "Newspoll").length}`,
  `Morgan ${fresh.filter((r) => r.firm === "Morgan").length}`,
  `Election ${fresh.filter((r) => r.firm === "Election").length}`].join(", ")})`);
if (dropped.length) console.log(`dropped: ${dropped.join("; ")}`);
if (fresh.length) console.log(`span ${fresh.map((r) => r.date).sort()[0]} → ${fresh.map((r) => r.date).sort().at(-1)} · cycle total ${merged.length}`);
if (APPLY && fresh.length)
  writeFileSync("data/polls.json", JSON.stringify(D, null, 2) + "\n");
