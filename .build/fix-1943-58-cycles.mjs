#!/usr/bin/env node
/* fix-1943-58-cycles.mjs — corrections to the 1943–58 past-cycles batch
   (bootstrap-1943-58-cycles.mjs) found in the 2026-10-18 review. Idempotent:
   every step writes the value it should hold, so a second --apply changes
   nothing.

     node .build/fix-1943-58-cycles.mjs          # dry-run (default)
     node .build/fix-1943-58-cycles.mjs --apply  # write polls.json

   1. elections.e1951 / e1954 carried their two-party pair swapped (the
      bootstrap's literal; its header table had them right). AEC: 1951 ALP
      49.3, 1954 ALP 50.7. The two terms' closing "Election" sentinel rows
      copied the same swap.
   2. Era rows re-implied: every tppEra row's tpp is recomputed from the
      FLOW_ERAS set its tag names, so the 1943–1955 refit in flows.mjs
      reaches the stored figures (validate's 2pp-flip check inverts against
      the same constants).
   3. cyclePollBases notes for the 1946–1958 buckets quote the refitted
      sets' right-edge backtests.
   1b. The 1949-12-15 wave is the 1949 election's final poll, mis-dated
      after polling day (below).
   4. Month-placeholder dates: the mirror dates most 1940s–60s waves to the
      15th (or the 1st) of the month they were published in, so the day is
      not a fieldwork date. An era row on day 15 or 01 that is the only
      wave in its calendar month gets dateApprox: "month"; the final-polls
      record will not count it inside a 14-day window it may not sit in,
      and the dots say "May 1954" rather than "15 May 1954". */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";
import { FLOW_ERAS, impliedEraAlp2pp } from "./newtracker/flows.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const log = [];
const set = (obj, k, v, where) => {
  if (obj[k] === v) return;
  log.push(`${where}.${k}: ${JSON.stringify(obj[k])} → ${JSON.stringify(v)}`);
  obj[k] = v;
};

/* 1. the swapped pairs */
const TPP = { e1951: [49.3, 50.7], e1954: [50.7, 49.3] }; // [alp, lnp]
for (const [k, [alp, lnp]] of Object.entries(TPP)) {
  set(D.elections[k], "tpp_alp", alp, `elections.${k}`);
  set(D.elections[k], "tpp_lnp", lnp, `elections.${k}`);
  const bucket = k.slice(1);
  const s = D.cyclePolls[bucket].find((p) => p.firm === "Election");
  set(s, "tpp_alp", alp, `cyclePolls.${bucket}[Election]`);
  set(s, "tpp_lnp", lnp, `cyclePolls.${bucket}[Election]`);
}

/* 1b. the mirror's "1949-12-15" wave (LCP 50, Lab 48, others 2) is
   Gallup's final pre-election estimate, published the weekend before the
   10 Dec 1949 election – data/trove-primary-vote.csv, Trove article
   230739836: "Raw intentions weekend before 10 Dec election; allocated
   estimate was LCP50 Lab48". The mirror's mid-month placeholder put it
   five days AFTER polling day, in the 1949–51 term. It is the 1946–49
   term's last wave: re-dated to the publication week, re-tagged to the
   1946 flow set (step 2 re-implies it). The assimilator excludes the
   mirror date so a refresh doesn't file it twice. */
{
  const from = D.cyclePolls["1951"], at = from.findIndex((p) => p.date === "1949-12-15" && p.firm === "Morgan");
  if (at >= 0) {
    const [p] = from.splice(at, 1);
    delete p.dateApprox;
    p.date = "1949-12-03";
    p.tppEra = "1946";
    const to = D.cyclePolls["1949"], before = to.findIndex((r) => r.firm === "Election");
    to.splice(before, 0, p);
    log.push("cyclePolls.1951[1949-12-15] → cyclePolls.1949[1949-12-03] (tppEra 1946)");
  }
}

/* 2. re-imply every era row from its tagged set (same rounding as the
   assimilator) */
const r1 = (v) => Math.round(v * 10) / 10;
for (const [bucket, rows] of Object.entries(D.cyclePolls))
  for (const p of rows) {
    if (p.tppEra == null) continue;
    const a = impliedEraAlp2pp(FLOW_ERAS[p.tppEra], p);
    if (a == null) continue;
    const tA = r1(a);
    set(p, "tpp_alp", tA, `cyclePolls.${bucket}[${p.date}]`);
    set(p, "tpp_lnp", r1(100 - tA), `cyclePolls.${bucket}[${p.date}]`);
  }

/* 3. provenance notes, as bootstrap-1943-58 wrote them, with the refit's
   backtests */
const note = (open, bt, inBudget, extra = "") => {
  const anchor = open === "1943" || open === "1946"
    ? "that election's published Mackerras-estimate 2PP – the AEC's own TPP series starts in 1949"
    : "that election's official 2PP";
  return "F2F Morgan Gallup waves from the aeforecasts mirror (no live-poll metadata upstream). Morgan published no national 2PP this far back, so tpp is IMPLIED last-election-flows: primaries read through the "
    + open + " election's calibrated constants (FLOW_ERAS[" + open + "] in flows.mjs, anchored to " + anchor
    + extra
    + " – the Kevin Bonham Wonk Central method; right-edge backtest "
    + bt + (inBudget ? ", smaller than the 0.6-point average miss Bonham reports for last-election flows at the 1955–80 elections"
                     : ", larger than the 0.6-point average miss Bonham reports for last-election flows at the 1955–80 elections")
    + (open === "1943" ? " against an estimated close itself" : "")
    + "). Democrats/DLP primaries are itemised in dem/dlp row fields (the era's changeable minor-party print conventions make folding them into oth unreliable); the tppEra row tag names the era set used. Most waves are dated to the 15th of their month by the mirror; those rows carry dateApprox \"month\".";
};
const NOTES = {
  "1946|Morgan": note("1943", "−1.59 vs the closing election's estimated 2PP", false),
  "1949|Morgan": note("1946", "−0.53 vs official", true),
  "1951|Morgan": note("1949", "−0.04 vs official", true),
  "1954|Morgan": note("1951", "+1.31 vs official", false),
  "1955|Morgan": note("1954", "−0.48 vs official", true),
  "1958|Morgan": note("1955", "0.00 vs official", true,
    ", except the new Anti-Communist Labor/DLP flow, which carries the pooled DLP-era 0.27 – solved against 1955 alone it is 0.002, which puts the 1957–58 waves 2–3 points too low for Labor"),
};
for (const [k, v] of Object.entries(NOTES)) set(D.cyclePollBases, k, v, "cyclePollBases");

/* 4. month-placeholder dates. The month count is the MIRROR's (F2F Morgan
   rows per calendar month), not polls.json's: the dedupe drops some
   upstream rows, and a campaign month the mirror dates 5th/15th/25th is a
   ten-day series, not a monthly one. A row the mirror marks "#Exact date
   given" is never a placeholder. */
const perMonth = new Map(), exact = new Set();
for (const l of readFileSync("data/bonham-additional-aeforecasts.csv", "utf8").split("\n").slice(1)) {
  const f = l.split(",");
  if (f[1] !== "F2F Morgan") continue;
  perMonth.set(f[0].slice(0, 7), (perMonth.get(f[0].slice(0, 7)) || 0) + 1);
  if (/#Exact date/i.test(l)) exact.add(f[0]);
}
for (const [bucket, rows] of Object.entries(D.cyclePolls))
  for (const p of rows) {
    if (p.tppEra == null || p.dateApprox) continue;
    const day = p.date.slice(8, 10);
    if ((day === "15" || day === "01") && perMonth.get(p.date.slice(0, 7)) === 1 && !exact.has(p.date))
      set(p, "dateApprox", "month", `cyclePolls.${bucket}[${p.date}]`);
  }

console.log(`fix-1943-58 ${APPLY ? "APPLY" : "dry-run"}: ${log.length} change(s)`);
for (const l of log) console.log("  " + (l.length > 200 ? l.slice(0, 200) + "…" : l));
if (APPLY && log.length) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
