#!/usr/bin/env node
/* bootstrap-trove-final-waves.mjs — final polls for the 1946, 1951 and 1954
   elections, the elections the month-placeholder review (fix-1943-58-cycles.mjs,
   2026-10-18) left without a scored wave. The aeforecasts F2F Morgan mirror
   carries no election-eve wave for any of them; the hand-curated Trove corpus
   (data/trove-primary-vote.csv) does, and two of the three record Gallup's
   own allocated "final estimate" basis. Their landing returns all three
   elections to the final-polls record (1946 +0.7, 1951 −1.5, 1954 −1.9 vs
   each election's corrected 2PP).

     node .build/bootstrap-trove-final-waves.mjs          # dry-run (default)
     node .build/bootstrap-trove-final-waves.mjs --apply  # write polls.json

   Each wave files firm "Morgan" with its term's tppEra tag — the SAME APOP
   Gallup series the mirror rows hold under that name — and no dateApprox,
   because the Trove row pins the real publication week where the mirror put
   none. tpp is implied from the FLOW_ERAS set each term is scored on, the
   same computation and rounding as fix-1943-58-cycles.mjs. 1949's final is
   already in (that script's 1b move); the 1943 election-eve forecast stays
   out by user call — scored it would sit against a Mackerras-estimate close
   (58.2), so the miss would stack estimate on estimate.

   - 1946-09-27 – alp 54, lnp 44, oth 2: decided voters only (all but ~84 of
     ~2000); Trove article 78267350.
   - 1951-04-22 – alp 47, lnp 52, oth 1: Gallup's allocated estimate (LCP 52,
     Lab 47); the raw intentions 49/43 with 7 undecided stay in the CSV, Trove
     article 45695923.
   - 1954-05-23 – alp 48, lnp 46, oth 1: contested seats only (114 of them; 5
     uncommitted, so the primaries sum 95 not ~100); Trove article 230779504.

   Idempotent like the fix script: existing (bucket, date, firm) rows get
   their fields re-written in place, so a second --apply is a clean no-op.
   The three buckets' cyclePollBases notes gain a sentence naming the Trove
   provenance and basis of each wave. */
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

const NEW = [
  { bucket: "1946", date: "1946-09-27", lnp: 44, alp: 54, oth: 2, tppEra: "1943" },
  { bucket: "1951", date: "1951-04-22", lnp: 52, alp: 47, oth: 1, tppEra: "1949" },
  { bucket: "1954", date: "1954-05-23", lnp: 46, alp: 48, oth: 1, tppEra: "1951" },
];

for (const n of NEW) {
  const rows = D.cyclePolls[n.bucket];
  if (!rows) throw new Error("no cyclePolls bucket " + n.bucket);
  const e = D.elections["e" + n.bucket];
  if (!e || n.date >= e.date) throw new Error(`${n.date} is not inside the term that closes ${e.date}`);
  let p = rows.find((r) => r.date === n.date && r.firm === "Morgan");
  if (!p) {
    p = { date: n.date, firm: "Morgan", lnp: null, alp: null, grn: null, onp: null, dem: null, dlp: null, oth: null, tpp_lnp: null, tpp_alp: null };
    const at = rows.findIndex((r) => r.firm === "Election");
    rows.splice(at < 0 ? rows.length : at, 0, p);
    log.push(`cyclePolls.${n.bucket}[${n.date}] inserted (pre-Election sentinel)`);
  }
  const w = "cyclePolls." + n.bucket + "[" + n.date + "]";
  set(p, "alp", n.alp, w);
  set(p, "lnp", n.lnp, w);
  set(p, "oth", n.oth, w);
  set(p, "tppEra", n.tppEra, w);
  set(p, "tpp_alp", Math.round(impliedEraAlp2pp(FLOW_ERAS[n.tppEra], { ...p, alp: n.alp, oth: n.oth }) * 10) / 10, w);
  set(p, "tpp_lnp", Math.round((100 - p.tpp_alp) * 10) / 10, w);
  if (p.dateApprox) log.splice(0, 0, `WARN: ${w} carries dateApprox — real-week waves must not`);
}

/* 2. provenance sentences appended to the three buckets' bases notes */
const ADD = {
  "1946|Morgan": " The election-eve wave of 1946-09-27 (decided voters only) files from the hand-curated Trove corpus (data/trove-primary-vote.csv, Trove article 78267350), not the mirror; the publication week is real, so no dateApprox.",
  "1951|Morgan": " The weekend-before wave of 1951-04-22 files Gallup's allocated estimate (LCP 52, Lab 47, 1 independent; the raw 49/43 with 7 undecided stays in data/trove-primary-vote.csv), from the Trove corpus (Trove article 45695923); a real publication week, so no dateApprox.",
  "1954|Morgan": " The weekend-before wave of 1954-05-23 is contested seats only (114 of them; 5 uncommitted, so its primaries sum 95, not ~100), from the Trove corpus (Trove article 230779504); a real publication week, so no dateApprox.",
};
for (const [k, s] of Object.entries(ADD)) {
  if (D.cyclePollBases[k] == null) throw new Error("no cyclePollBases note for " + k);
  set(D.cyclePollBases, k, D.cyclePollBases[k].includes(s.trim().slice(0, 40)) ? D.cyclePollBases[k] : D.cyclePollBases[k] + s, "cyclePollBases");
}

console.log(`bootstrap-trove-final-waves ${APPLY ? "APPLY" : "dry-run"}: ${log.length} change(s)`);
for (const l of log) console.log("  " + (l.length > 200 ? l.slice(0, 200) + "…" : l));
if (APPLY && log.length) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
