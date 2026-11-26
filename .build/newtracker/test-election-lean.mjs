/* Each pollster's record against the count (gen-data electionLean), recomputed from the raw
   past-poll rows. A row carries numbers that are not votes (sample, sampleEff, Resolve's soft
   share): counted as minor parties, they once put RedBridge's 2025 final poll at 1.8% for Labor.
   A number field this test doesn't know fails it, until someone says whether it is a vote. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "data", "polls.json"), "utf8"));
const VOTES = ["alp", "lnp", "grn", "onp", "oth", "dem", "dlp"];
const NOT_VOTES = ["soft", "sample", "sampleEff", "tppEra"];
for (const [year, rows] of Object.entries(raw.cyclePolls))
  for (const r of rows)
    for (const [k, v] of Object.entries(r))
      if (typeof v === "number" && !/^tpp_/.test(k)) assert.ok(VOTES.includes(k) || NOT_VOTES.includes(k), `cyclePolls ${year} ${r.firm} ${r.date}: unknown number field "${k}" – a vote or not?`);

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(HERE, "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), { window, console });
const EL = Object.values(window).find((v) => v && v.electionLean).electionLean;
let checked = 0;
for (const [party, byFirm] of Object.entries(EL.parties))
  for (const [firm, cycles] of Object.entries(byFirm))
    for (const c of cycles) {
      /* the final poll: this house's last row before polling day that scores this way */
      const day = raw.elections["e" + c.year].date;
      const mine = raw.cyclePolls[c.year].filter((r) => (EL.canon[r.firm] || r.firm) === firm && r.date <= day && r.alp != null && r.lnp != null && !r.dateApprox)
        .sort((a, b) => a.date.localeCompare(b.date));
      const r = mine[mine.length - 1];
      assert.ok(r, `${firm} ${c.year}: no final poll`);
      const total = VOTES.reduce((t, k) => t + (r[k] || 0), 0);
      const rest = (r.oth || 0) + (r.dem || 0) + (r.dlp || 0);
      const folded = raw.elections["e" + c.year].onp == null;
      const share = party === "oth" ? rest + (folded ? r.onp || 0 : 0) : r[party];
      assert.ok(Math.abs((share * 100) / total - c.poll) <= 0.051, `${firm} ${c.year} ${party}: ${c.poll}, the row gives ${((share * 100) / total).toFixed(1)}`);
      assert.ok(Math.abs(c.poll - c.result - c.err) <= 0.11, `${firm} ${c.year} ${party}: the miss is poll less count`);
      checked++;
    }
assert.ok(checked > 200, "the record is there");
console.log(`PASS: election lean – ${checked} final-poll figures match their rows`);
