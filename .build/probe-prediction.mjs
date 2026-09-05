#!/usr/bin/env node
/* Read-only integrity probe for the /prediction/ refresh loop. Exits 0 when
   the generated artifacts are internally consistent, 1 otherwise — run by
   hand after any refresh-loop change, and by the repair agent as its
   ground truth. Checks (fails print ✗, passes print ✓):
     1  data/prediction-history.json parses with a records array
     2  records are strictly date-sorted with no duplicate asOf
     3  every record's age is in (0, 33.5]
     4  every ousted band obeys 0 ≤ lo ≤ median ≤ hi ≤ 1
     5  shareOuster and inSample stay in [0, 1]
     6  numeric features are finite when present (null tolerated early-term)
     7  govAge is a positive integer
     8  ridge.liveP sits in [0, 1]
     9  PREDICTION_STAMP in build.mjs equals the latest record's asOf
    10  PRED_DATA embedded in prediction/index.html matches the history asOfs
    11  every PRED_DATA record carries a non-empty slot map `s`
    12  every o field is in [0, 1] with the same lo≤median≤hi ordering
    13  every data-slot attribute in the page has a key in the latest s map
    14  the page's latest record matches the history file's latest asOf
    15  .build/refresh-prediction.mjs still prints a PRED_STATUS contract
        (static check that the emit line and the due-gate both exist)      */
import { readFileSync } from "node:fs";

const HIST = "data/prediction-history.json";
const PAGE = "prediction/index.html";
const GEN = ".build/newtracker/build.mjs";
const REFRESH = ".build/refresh-prediction.mjs";

let n = 0, fails = 0;
const check = (name, ok, detail = "") => {
  n++;
  if (!ok) fails++;
  console.log(`row ${String(n).padStart(2)} — ${name} ${ok ? "✓" : "✗"}${ok ? "" : "  " + detail}`);
};

// 1–2: history file
let hist = null;
try { hist = JSON.parse(readFileSync(HIST, "utf8")); } catch { /* row below */ }
check("history file parses with records array", !!hist && Array.isArray(hist.records) && hist.records.length > 0);
const recs = hist?.records || [];
let sorted = true;
for (let i = 1; i < recs.length; i++) if (!(recs[i].asOf > recs[i - 1].asOf)) sorted = false;
check("records strictly date-sorted, unique asOf", sorted && recs.length > 0);

// 3–8: record invariants
check("age in (0, 33.5]", recs.every((r) => r.age > 0 && r.age <= 33.5));
check("ousted band ordering 0≤lo≤median≤hi≤1",
  recs.every((r) => r.ousted && r.ousted.lo >= 0 && r.ousted.lo <= r.ousted.median &&
    r.ousted.median <= r.ousted.hi && r.ousted.hi <= 1));
check("shareOuster/inSample in [0,1]",
  recs.every((r) => r.ousted.shareOuster >= 0 && r.ousted.shareOuster <= 1 &&
    r.inSample >= 0 && r.inSample <= 1));
check("numeric features finite when present",
  recs.every((r) => Object.values(r.features || {}).every((v) => v === null || Number.isFinite(v))));
check("govAge positive integer", recs.every((r) => Number.isInteger(r.features?.govAge) && r.features.govAge >= 1));
check("ridge.liveP in [0,1]", recs.every((r) => r.ridge && r.ridge.liveP >= 0 && r.ridge.liveP <= 1));

// 9: sitemap stamp
const latest = recs[recs.length - 1];
const buildSrc = readFileSync(GEN, "utf8");
const stamp = buildSrc.match(/const PREDICTION_STAMP = "(\d{4}-\d{2}-\d{2})"/);
check("PREDICTION_STAMP == latest history asOf", !!stamp && stamp[1] === latest.asOf,
  stamp ? `stamp ${stamp[1]} vs ${latest.asOf}` : "no PREDICTION_STAMP found");

// 10–14: page consistency
const page = readFileSync(PAGE, "utf8");
const m = page.match(/const PRED_DATA = (\[[\s\S]*?\]);/);
const pd = m ? JSON.parse(m[1]) : null;
check("PRED_DATA asOf list matches history",
  !!pd && pd.length === recs.length && pd.every((r, i) => r.asOf === recs[i].asOf),
  pd ? `${pd.length} rows vs ${recs.length}` : "no PRED_DATA block");
check("every PRED_DATA record has a non-empty slot map",
  !!pd && pd.every((r) => r.s && Object.keys(r.s).length > 0));
check("PRED_DATA o fields ordered in [0,1]",
  !!pd && pd.every((r) => r.o && r.o.lo >= 0 && r.o.lo <= r.o.median && r.o.median <= r.o.hi && r.o.hi <= 1 &&
    r.o.shareOuster >= 0 && r.o.shareOuster <= 1));
if (pd) {
  const slots = new Set([...page.matchAll(/data-slot="([^"]+)"/g)].map((x) => x[1]));
  const sKeys = new Set(Object.keys(pd[pd.length - 1].s));
  const missing = [...slots].filter((k) => !sKeys.has(k));
  check("every data-slot attribute covered by latest slot map", missing.length === 0, missing.join(","));
  check("page latest record == history latest asOf", pd[pd.length - 1].asOf === latest.asOf);
} else {
  check("every data-slot attribute covered by latest slot map", false, "no PRED_DATA block");
  check("page latest record == history latest asOf", false, "no PRED_DATA block");
}

// 15: generator contract intact
const src = readFileSync(REFRESH, "utf8");
check("refresh-prediction.mjs emits PRED_STATUS with due gate",
  src.includes("PRED_STATUS") && src.includes("due: false, ran: false") && src.includes("--if-due"));

console.log(`\n${n - fails}/${n} rows pass` + (fails ? ` — ${fails} FAILURE(S)` : ""));
process.exit(fails ? 1 : 0);
