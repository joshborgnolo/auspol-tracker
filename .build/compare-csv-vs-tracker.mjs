/* compare-csv-vs-tracker.mjs — READ-ONLY discrepancy scan.
   Compares the four Newspoll archive CSVs in data/ against every Newspoll series
   in data/polls.json (cyclePolls primaries/2PP, cycleApproval pmNet/oppNet +
   pmPpm/oppPpm, modern polls/ppm/approval arrays).
   Matching: tracker date vs nearest CSV wave within +-4 days.
   Prints discrepancies only; writes nothing. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DAY = 86400000;

function loadCsv(name) {
  const lines = fs.readFileSync(path.join(ROOT, "data", name), "utf8").trim().split("\n");
  const cols = lines[0].split(",").slice(1);
  const recs = new Map(); // iso -> {col: num}
  for (const line of lines.slice(1)) {
    const [date, ...vals] = line.split(",");
    const rec = {};
    vals.forEach((v, i) => { if (v !== "") rec[cols[i]] = Number(v); });
    recs.set(date, rec);
  }
  return { recs, dates: [...recs.keys()].sort() };
}
const primary = loadCsv("newspoll-primary-vote.csv");
const tpp = loadCsv("newspoll-two-party-preferred.csv");
const betterpm = loadCsv("newspoll-better-pm.csv");
const netsat = loadCsv("newspoll-leader-net-satisfaction.csv");
const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));

function nearest(csv, iso) {
  let best = null, bd = Infinity;
  for (const d of csv.dates) {
    const dd = Math.abs(Date.parse(d) - Date.parse(iso));
    if (dd < bd) { bd = dd; best = d; }
  }
  return bd <= 4 * DAY ? best : null;
}

// ---- era tables: date -> pm/opp leader column -------------------------------
const PM_ERAS = [
  ["1900-01-01", "bob_hawke"], ["1991-12-20", "paul_keating"], ["1996-03-11", "john_howard"],
  ["2007-12-03", "kevin_rudd"], ["2010-06-24", "julia_gillard"], ["2013-06-27", "kevin_rudd"],
  ["2013-09-18", "tony_abbott"], ["2015-09-15", "malcolm_turnbull"], ["2018-08-24", "scott_morrison"],
  ["2022-05-23", "anthony_albanese"], ["2025-05-03", "was_supported_party_undefined"],
];
const OPP_ERAS = [
  ["1900-01-01", "john_howard"], ["1989-05-09", "andrew_peacock"], ["1990-04-03", "john_hewson"],
  ["1994-05-23", "alexander_downer"], ["1995-01-30", "john_howard"], ["1996-03-19", "kim_beazley"],
  ["2001-11-22", "simon_crean"], ["2003-12-02", "mark_latham"], ["2005-01-28", "kim_beazley"],
  ["2006-12-04", "kevin_rudd"], ["2007-12-06", "brendan_nelson"], ["2008-09-16", "malcolm_turnbull"],
  ["2009-12-01", "tony_abbott"], ["2013-10-13", "bill_shorten"], ["2019-06-03", "anthony_albanese"],
  ["2022-05-30", "peter_dutton"],
];
const eraLeader = (eras, iso) => {
  let lead = null;
  for (const [from, name] of eras) if (iso >= from) lead = name;
  return lead;
};

const discrepancies = [];
const note = (kind, msg) => discrepancies.push({ kind, msg });

function cmpVal(kind, datePlain, label, trackerVal, csvVal) {
  if (trackerVal == null && csvVal == null) return;
  if (trackerVal == null && csvVal != null) return; // tracker legitimately omits series it doesn't chart
  if (trackerVal != null && csvVal == null) { note(kind, `${datePlain} ${label}: tracker=${trackerVal} but CSV blank`); return; }
  if (Math.abs(trackerVal - csvVal) > 0.001) note(kind, `${datePlain} ${label}: tracker=${trackerVal} vs CSV=${csvVal}`);
}

// ---- 1. cyclePolls: primaries + 2PP ------------------------------------------
let cpChecked = 0, cpNoWave = 0;
for (const [cy, list] of Object.entries(P.cyclePolls)) {
  for (const e of list) {
    if (e.firm !== "Newspoll" && e.pollster !== "Newspoll") continue;
    const pWave = nearest(primary, e.date), tWave = nearest(tpp, e.date);
    if (!pWave && !tWave) { cpNoWave++; continue; }
    cpChecked++;
    if (pWave) {
      const pv = primary.recs.get(pWave);
      const demon = pv.democrats ?? 0;
      cmpVal("cyclePolls", `${e.date} (csv ${pWave})`, "lnp", e.lnp, pv.coalition);
      cmpVal("cyclePolls", `${e.date} (csv ${pWave})`, "alp", e.alp, pv.alp);
      cmpVal("cyclePolls", `${e.date} (csv ${pWave})`, "grn", e.grn, pv.greens);
      cmpVal("cyclePolls", `${e.date} (csv ${pWave})`, "onp", e.onp, pv.one_nation);
      // tracker oth = archive others + democrats (democrats folded into others)
      const othCsv = pv.others != null || demon ? (pv.others ?? 0) + demon : null;
      cmpVal("cyclePolls", `${e.date} (csv ${pWave})`, "oth", e.oth, othCsv);
    } else note("cyclePolls", `${e.date}: no primary-vote CSV wave within 4d`);
    if (tWave) {
      const tv = tpp.recs.get(tWave);
      cmpVal("cyclePolls", `${e.date} (csv ${tWave})`, "tpp_alp", e.tpp_alp, tv.alp);
      cmpVal("cyclePolls", `${e.date} (csv ${tWave})`, "tpp_lnp", e.tpp_lnp, tv.coalition);
    } else if (e.tpp_alp != null || e.tpp_lnp != null) note("cyclePolls", `${e.date}: no TPP CSV wave within 4d (tracker has tpp)`);
  }
}

// ---- 2. cycleApproval: pmNet/oppNet + preferred-PM ----------------------------
let caChecked = 0, caNoWave = 0;
for (const [cy, list] of Object.entries(P.cycleApproval)) {
  for (const e of list) {
    if (e.firm !== "Newspoll") continue;
    const nWave = nearest(netsat, e.date);
    const bWave = nearest(betterpm, e.date);
    if (!nWave && !bWave) { caNoWave++; continue; }
    caChecked++;
    const pmLead = eraLeader(PM_ERAS, e.date), oppLead = eraLeader(OPP_ERAS, e.date);
    if (nWave) {
      const nv = netsat.recs.get(nWave);
      cmpVal("cycleApproval pmNet", `${e.date} (csv ${nWave})`, pmLead, e.pmNet, nv[pmLead]);
      cmpVal("cycleApproval oppNet", `${e.date} (csv ${nWave})`, oppLead, e.oppNet, nv[oppLead]);
    } else note("cycleApproval", `${e.date}: no netsat CSV wave within 4d`);
    if ((e.pmPpm != null || e.oppPpm != null) && bWave) {
      const bv = betterpm.recs.get(bWave);
      cmpVal("cycleApproval pmPpm", `${e.date} (csv ${bWave})`, pmLead, e.pmPpm, bv[pmLead]);
      cmpVal("cycleApproval oppPpm", `${e.date} (csv ${bWave})`, oppLead, e.oppPpm, bv[oppLead]);
    } else if (e.pmPpm != null || e.oppPpm != null) note("cycleApproval", `${e.date}: no betterPM CSV wave within 4d (tracker has ppm)`);
  }
}

// ---- string palettes fix: pm era guard ---------------------------------------
// (nothing here; PM_ERAS tail placeholder never matches a CSV col, cmp treats missing csv as blank)

// ---- 3. modern polls array (2022+) vs primaries/TPP (csv ends 2022-04-03) ----
let mpChecked = 0;
for (const e of P.polls) {
  if (e.pollster !== "Newspoll" || e.isElection) continue;
  const pWave = nearest(primary, e.date), tWave = nearest(tpp, e.date);
  if (!pWave && !tWave) continue; // outside archive coverage — expected
  mpChecked++;
  if (pWave) {
    const pv = primary.recs.get(pWave);
    cmpVal("polls", `${e.date} (csv ${pWave})`, "lnp", e.lnp, pv.coalition);
    cmpVal("polls", `${e.date} (csv ${pWave})`, "alp", e.alp, pv.alp);
    cmpVal("polls", `${e.date} (csv ${pWave})`, "grn", e.grn, pv.greens);
    cmpVal("polls", `${e.date} (csv ${pWave})`, "onp", e.onp, pv.one_nation);
  }
  if (tWave) {
    const tv = tpp.recs.get(tWave);
    cmpVal("polls", `${e.date} (csv ${tWave})`, "tpp_alp", e.tpp_alp, tv.alp);
  }
}

// ---- 4. modern ppm array (alb vs oppName) vs better-PM ------------------------
let ppmChecked = 0;
const OPP_NAME = { Ley: null, Dutton: "peter_dutton", Albanese: "anthony_albanese", Morrison: "scott_morrison", Shorten: "bill_shorten", Turnbull: "malcolm_turnbull" };
for (const e of P.ppm) {
  if (e.firm !== "Newspoll") continue;
  const bWave = nearest(betterpm, e.date);
  if (!bWave) continue;
  ppmChecked++;
  const bv = betterpm.recs.get(bWave);
  const albCol = eraLeader(PM_ERAS, e.date) === "anthony_albanese" ? "anthony_albanese" : "anthony_albanese";
  cmpVal("ppm", `${e.date} (csv ${bWave})`, "alb", e.alb, bv[albCol]);
  const oppCol = OPP_NAME[e.oppName];
  if (oppCol) cmpVal("ppm", `${e.date} (csv ${bWave})`, `opp(${e.oppName})`, e.opp, bv[oppCol]);
}

// ---- 5. modern approval array vs netsat (csv ends 2024-06-30) -----------------
let apChecked = 0;
for (const e of P.approval) {
  if (e.firm !== "Newspoll") continue;
  const nWave = nearest(netsat, e.date);
  if (!nWave) continue;
  apChecked++;
  const nv = netsat.recs.get(nWave);
  cmpVal("approval", `${e.date} (csv ${nWave})`, "alb", e.alb, nv.anthony_albanese);
  const oppCol = OPP_NAME[e.oppName];
  if (oppCol && e.opp != null) cmpVal("approval", `${e.date} (csv ${nWave})`, `opp(${e.oppName})`, e.opp, nv[oppCol]);
}

// ---- report -------------------------------------------------------------------
console.log(`checked: cyclePolls ${cpChecked} (${cpNoWave} outside CSV coverage), cycleApproval ${caChecked} (${caNoWave} outside), modern polls ${mpChecked}, ppm ${ppmChecked}, approval ${apChecked}`);
console.log(`\nDISCREPANCIES: ${discrepancies.length}`);
for (const d of discrepancies) console.log(`[${d.kind}] ${d.msg}`);
