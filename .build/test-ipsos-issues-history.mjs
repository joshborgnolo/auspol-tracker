/* Offline full-corpus pins for the historical Ipsos Issues Monitor store. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildHistory, readSalienceTable, legacyOwnership, periodTokens } from "./ipsos-issues-history.mjs";

const data = buildHistory();
const at = (source, scope = "Australia", ym) => data.reports.find((r) => r.source === source && r.scope === scope && (!ym || r.ym === ym));
const own = at("national-2013-08"), state = at("national-2013-09", "Victoria");
assert.equal(data.coverage.sources, 105);
assert.equal(data.coverage.reports, 265);
assert.equal(data.coverage.nationalReports, 102);
assert.equal(data.coverage.stateReports, 163);
assert.equal(data.coverage.salienceRows, 4362);
assert.equal(data.coverage.methods, 35);
assert.equal(data.coverage.firstNationalReport, "2013-08");
assert.equal(data.coverage.lastNationalReport, "2026-10");
assert.equal(data.unread.length, 0);
console.log("1. Every cached national/state report and methodology source reads: OK");

assert.equal(own.salience.length, 21);
assert.equal(own.salience[0].basis, "two-month pool");
assert.deepEqual([own.salience[0].startMonth, own.salience[0].endMonth], ["2010-11", "2010-12"]);
assert.equal(own.salience[0].issues.health, 48);
assert.equal(own.current.health, 39);
assert.equal(own.current.col, 33);
assert.equal(own.current.unemployment, 24);
assert.deepEqual(own.ownership.health, { alp: 29, lnp: 30, grn: 4, oth: 2, unsure: 20, none: 15 });
assert.deepEqual(own.top5, ["health", "col", "economy", "crime", "unemployment"]);
assert.equal(state.current.health, 47);
assert.equal(state.current.transport, 28);
assert.equal(state.salience.at(-1).basis, "quarter");
assert.equal(state.salience.at(-1).endMonth, "2013-09");
assert.equal(state.sample, 750);
assert.equal(at("states-2014-q1-nsw", "New South Wales").current.crime, 39);
assert.equal(at("states-2014-q1-nsw", "New South Wales").current.health, 37);
assert.equal(at("states-2015-q2-queensland", "Queensland").current.health, 42);
assert.equal(at("states-2015-q2-queensland", "Queensland").current.col, 33);
console.log("2. Legacy mixed-period and 2013 capability/state tables: OK");

assert.equal(readSalienceTable(fs.readFileSync(".build/ipsos-history-src/national-2015-03.txt", "utf8").split("\f")[1], { ym: "2015-03" }).entries.length, 28);
const march2015 = at("national-2015-03");
assert.equal(march2015.salience.at(-1).endMonth, "2015-03");
assert.equal(march2015.current.health, 36);
const victoria2017 = at("states-2017", "Victoria", "2017-03");
assert.equal(victoria2017.salience.length, 8);
assert.equal(Object.keys(victoria2017.current).length, 19);
assert.equal(victoria2017.current.crime, 51);
assert.equal(victoria2017.current.health, 29);
const victoriaJune2018 = at("states-2018", "Victoria", "2018-06");
assert.equal(victoriaJune2018.current.crime, 43);
assert.equal(victoriaJune2018.current.health, 25);
console.log("3. Split-period and single-quarter state tables: OK");

const covid = at("national-2020", "Australia", "2020-08");
assert.equal(covid.salience.length, 18);
assert.equal(covid.current.economy, 54);
assert.equal(covid.current.health, 40);
assert.equal(covid.current.col, 21);
const august2026 = at("IM_Nat_Aug_26_v1");
assert.equal(august2026.salience.length, 24);
assert.equal(Object.keys(august2026.current).length, 19);
assert.equal(august2026.current.col, 63);
assert.equal(august2026.current.petrol, 19);
assert.equal(august2026.ownership.immigration.onp, 29);
assert.equal(august2026.comparisons.previous.issues.col, 65);
assert.equal(august2026.comparisons.election.issues.economy, 32);
assert.equal(august2026.comparisons.election.label, "MAY 25");
console.log("4. COVID-specific typo, annual history and current ownership/comparisons: OK");

const state2016 = at("states-2016", "Victoria", "2016-03");
assert.deepEqual(state2016.comparisons.election.issues, { health: 40, transport: 28, crime: 27, drugs: 17, housing: 20 });
assert.deepEqual(state2016.restOfAustralia, { health: 40, transport: 16, crime: 31, drugs: 21, housing: 27 });
const state2024 = at("states-2024", "Victoria", "2024-03");
assert.equal(state2024.comparisons.previous.issues.col, 61);
assert.equal(state2024.comparisons.election.issues.health, 45);
assert.equal(state2024.restOfAustralia.economy, 21);
const method = data.methods.find((m) => m.ym === "2023-12" && m.sampleEff === 955);
assert.equal(method.end, "2023-12-12");
assert.equal(method.sample, 1000);
assert.equal(method.sampleEff, 955);
assert.ok(data.sources.some((s) => s.id === "national-commentaries" && /^https:\/\/www\.ipsos\.com\//.test(s.url)));
assert.ok(data.sources.every((s) => /^https:\/\/www\.ipsos\.com\//.test(s.url) && /^[0-9a-f]{64}$/.test(s.textSha256)));
console.log("5. State regressions, fraction cells and methodology provenance: OK");

const reportKeys = new Set();
for (const r of data.reports) {
  const reportKey = `${r.source}|${r.scope}|${r.ym}`;
  assert.ok(!reportKeys.has(reportKey), reportKey);
  reportKeys.add(reportKey);
  assert.match(r.ym, /^\d{4}-\d{2}$/);
  if (r.salience) {
    const keys = new Set();
    for (const row of r.salience) {
      const key = `${row.basis}|${row.label}|${row.endMonth || row.year}`;
      assert.ok(!keys.has(key), `${reportKey}: duplicate ${key}`);
      keys.add(key);
      if (row.endMonth) assert.ok(row.endMonth <= r.ym, `${reportKey}: future period ${row.endMonth}`);
      for (const value of Object.values(row.issues)) assert.ok(value == null || (Number.isFinite(value) && value >= 0 && value <= 100));
    }
  }
  if (r.ownership) for (const shares of Object.values(r.ownership)) {
    // Some old printed bar charts do not sum to 100 (June 2014 has 102 on
    // the economy and 92 on cost of living). Preserve them verbatim; this
    // catches column corruption, not force-fits the publisher's figures.
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    assert.ok(sum >= 90 && sum <= 110, `${reportKey}: party shares sum ${sum}`);
  }
}
assert.deepEqual(periodTokens("JAN-MAR 2017")[0], { label: "JAN-MAR 2017", start: 1, end: 3, year: 2017, index: 0, endIndex: 12 });
assert.deepEqual(legacyOwnership(fs.readFileSync(".build/ipsos-history-src/national-2013-08.txt", "utf8").split("\f")[0], {}).top5, own.top5);
console.log("6. Schema, unique dated rows, bounds and capability sums: OK");

const expected = JSON.stringify(data, null, 2) + "\n";
assert.ok(fs.existsSync("data/ipsos-issues-history.json"), "generate the history archive first");
assert.equal(fs.readFileSync("data/ipsos-issues-history.json", "utf8"), expected);
assert.equal(JSON.stringify(buildHistory()), JSON.stringify(data));
console.log("7. Deterministic regeneration and disk parity: OK");
console.log("test-ipsos-issues-history: all OK");
