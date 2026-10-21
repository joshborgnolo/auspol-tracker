/* test-state-flows.mjs – pins the state flow estimates on the preference
   flows explainer's chart (user call 2026-10-20): the states are the
   two-class pile model's ESTIMATES (data/state-flows-est.csv, written by
   .build/estimate-state-flows.py), never the parsers' blended replay; only
   elections whose counts reached a Labor v Coalition final in at least 40
   seats reach the chart, One Nation's line only where it won 2% of the
   primary vote, each point with its 90% error; the federal back-test that justifies them rides
   flowHistory.fed.backtest for the Info entry, and must keep showing the
   model beating the replay it replaced.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_CLASSIC = 40;

// ---- the estimator's outputs -----------------------------------------------
const csv = fs.readFileSync(path.join(ROOT, "data", "state-flows-est.csv"), "utf8").trim().split(/\r?\n/);
const head = csv.shift().split(",");
assert.deepEqual(head, ["jurisdiction", "year", "party", "method", "est_alp_votes", "est_coal_votes", "est_flow_to_alp", "err90", "exhausted_share", "n_classic"],
  "state-flows-est.csv keeps its column contract");
const rows = csv.map((ln) => Object.fromEntries(ln.split(",").map((v, i) => [head[i], v])));
const bt0 = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8"));
for (const r of rows) {
  assert.ok(["grn", "onp", "oth"].includes(r.party), `only crossbench buckets are estimated (${r.party})`);
  if (r.est_flow_to_alp === "") continue;
  const f = +r.est_flow_to_alp;
  assert.ok(f >= 0 && f <= 1, `${r.jurisdiction} ${r.year} ${r.party}: a share (${f})`);
  // below the calibration's smallest seat count the error was never measured:
  // such an estimate carries none (and gen-data never draws it)
  assert.ok(["model", "counted"].includes(r.method), `${r.jurisdiction} ${r.year}: a method`);
  if (r.method === "counted") {
    assert.equal(r.jurisdiction, "nsw", "only NSW's ballot-level data is counted");
    assert.equal(r.err90, "", "a count carries no error figure");
    assert.ok(+r.exhausted_share >= 0 && +r.exhausted_share < 1, `${r.year} ${r.party}: an exhausted share`);
  } else if (+r.n_classic < Math.min(...bt0.settings.cal_n)) {
    assert.equal(r.err90, "", `${r.jurisdiction} ${r.year} ${r.party}: no untested error figure at ${r.n_classic} seats`);
  } else {
    assert.ok(+r.err90 > 0 && +r.err90 < 15, `${r.jurisdiction} ${r.year} ${r.party}: an error figure (${r.err90})`);
  }
  // an estimate's exhausted share comes only from optional-preferential
  // counts: Queensland to 2015, the Northern Territory in 2016 (full
  // preferential again from 2020)
  if (r.method === "model" && r.exhausted_share !== "") {
    const opv = (r.jurisdiction === "qld" && +r.year <= 2015) || (r.jurisdiction === "nt" && +r.year === 2016);
    assert.ok(opv, `${r.jurisdiction} ${r.year} ${r.party}: an exhausted share only under optional numbering`);
    assert.ok(+r.exhausted_share > 0 && +r.exhausted_share < 1, `${r.jurisdiction} ${r.year} ${r.party}: an exhausted share`);
  }
}
const bt = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8"));
assert.equal(Object.keys(bt.federal).length, 6, "the back-test covers the six federal elections 2010-2025");
for (const N of bt.settings.cal_n) assert.ok(bt.calibration[String(N)], `calibration has its ${N}-seat row`);

// ---- what the chart is handed ----------------------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
// (the sandbox's arrays carry its own realm's prototype: spread before a
// strict deep comparison)
const FH = sandbox.window.AUSPOL.flowHistory;
const prim = {};
fs.readFileSync(path.join(ROOT, "data", "state-flows.csv"), "utf8").trim().split(/\r?\n/).slice(1)
  .forEach((ln) => { const c = ln.split(","); if (c[2] === "onp") prim[c[0] + c[1]] = +c[4]; });
const shown = {};
for (const r of rows) {
  if (+r.n_classic >= MIN_CLASSIC && ["grn", "oth"].includes(r.party) && r.est_flow_to_alp !== "") {
    (shown[r.jurisdiction] ||= new Set()).add(+r.year);
  }
}
assert.deepEqual(Object.keys(FH).filter((k) => k !== "fed").sort(), Object.keys(shown).sort(),
  "exactly the jurisdictions with an election of 40+ classic seats get a chip");
assert.ok(!FH.nt, "the Northern Territory's small counts stay off the chart");
assert.deepEqual([...FH.qld.years], [2004, 2006, 2009, 2012, 2015, 2017, 2020, 2024],
  "Queensland shows 2004-2024, its optional-preferential years included");
assert.deepEqual([...FH.qld.opv], [2004, 2006, 2009, 2012, 2015], "Queensland's optional-preferential years carry exhausted shares");
assert.ok(FH.qld.grnExh.slice(0, 5).every((x) => x > 0) && FH.qld.grnExh.slice(5).every((x) => x == null),
  "Queensland's Greens exhausted share: the OPV years only");
assert.deepEqual([...FH.nsw.years], [2015, 2019, 2023], "NSW counts 2015-2023, every election with ballot-level data (2011 published none)");
assert.deepEqual([...FH.vic.years], [2022], "Victoria shows 2022 alone (its 2006-18 counts stopped at a majority)");
for (const [k, S] of Object.entries(FH)) {
  if (k === "fed") continue;
  assert.equal(S.estimated, k !== "nsw", `${k} is drawn as ${k === "nsw" ? "a count" : "an estimate"}`);
  assert.equal(!!S.counted, k === "nsw", `${k}: counted only for NSW`);
  assert.deepEqual([...S.years], [...shown[k]].sort((a, b) => a - b), `${k}: the years the rule allows`);
  S.years.forEach((y, i) => {
    const row = rows.find((r) => r.jurisdiction === k && +r.year === y && r.party === "onp");
    const base = row ? +row.est_alp_votes + +row.est_coal_votes : 0;
    const want = row && row.est_flow_to_alp !== "" && (row.method === "counted" || base >= bt.onp_min_ballots);
    assert.equal(S.onp[i] != null, !!want, `${k} ${y}: One Nation drawn if counted or on ${bt.onp_min_ballots}+ ballots (${base})`);
  });
  for (const b of ["grn", "onp", "oth"]) {
    S[b].forEach((v, i) => {
      if (v == null) return;
      assert.ok(v > 0 && v < 100, `${k} ${S.years[i]} ${b}: a percentage`);
      if (S.counted) assert.ok(S[b + "Exh"][i] != null, `${k} ${S.years[i]} ${b}: carries its exhausted share`);
      else assert.ok(S[b + "Err"][i] > 0, `${k} ${S.years[i]} ${b}: carries its 90% error`);
      const row = rows.find((r) => r.jurisdiction === k && +r.year === S.years[i] && r.party === b);
      assert.equal(v, Math.round(+row.est_flow_to_alp * 1000) / 10, `${k} ${S.years[i]} ${b}: the estimator's figure`);
    });
  }
}
const B = FH.fed.backtest;
assert.ok(B && B.elections === 6, "the federal back-test rides fed.backtest");
assert.ok(B.grn.model < B.grn.replay && B.oth.model < B.oth.replay,
  "the model still beats the replay it replaced, Greens and others alike");
assert.ok(B.grn.model <= 1.5, `the Greens estimate stays within 1.5 points of the federal counts on average (${B.grn.model})`);
// the optional-preferential estimates' exhausted shares, tested on NSW's
// counts; the tooltip says "about" and the Info entry quotes this miss
assert.ok(B.nsw && B.nsw.exh != null && B.nsw.exh > 0 && B.nsw.exh <= 5, `NSW exhausted shares within 5 points (${B.nsw && B.nsw.exh})`);
assert.ok(B.qld != null && B.qld <= 2, `Queensland's counted flows within 2 points (${B.qld})`);

// ---- the renderer and the Info entry ---------------------------------------
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(ap.includes("\"Estimated from \" + S.srcAs"), "a state's caption calls it an estimate");
// a state is captioned "Counted" only in the branch the counted flag guards (NSW)
assert.ok(ap.includes("const cnt = !!S.counted;") && ap.includes("? \"Counted from \" + S.srcAs"),
  "only a counted state is captioned as counted");
assert.equal(ap.split("\"Counted from \" + S.srcAs").length, 2, "one counted caption, in the cnt branch");
assert.ok(ap.includes("<RdFoot how={{ term: \"flow-history\""), "the chart's How it's built opens its Info entry");
const info = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"), "utf8");
assert.ok(info.includes("{ id: \"flow-history\", term: \"Counted and estimated flows\""), "the Info entry exists");

// ---- SA 2026's Labor v One Nation row in the explainer is the estimator's ----
const C = bt.contests && bt.contests["sa-2026-alp-onp"];
assert.ok(C && C.seats === 25, "SA 2026's 25 Labor v One Nation finals are estimated");
const art = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "explained-article.html"), "utf8");
const want = `this site&rsquo;s estimate, ${C.seats} seats, with its 90% error)</td><td>${C.model.lib.toFixed(1)} &plusmn;${C.err90.lib.toFixed(1)}</td><td>${C.model.grn.toFixed(1)} &plusmn;${C.err90.grn.toFixed(1)}</td><td>${C.model.oth.toFixed(1)} &plusmn;${C.err90.oth.toFixed(1)}</td>`;
assert.ok(art.includes(want), `the explainer's SA 2026 row quotes the estimator, with its 90% errors (${want})`);
assert.ok(art.includes(`the site&rsquo;s figure for them: ${C.model.ind.toFixed(1)}`), "the independents-only comparison with Bonham quotes the estimator");
// the prose's "differ by up to X, inside the range" is the estimator's
const gap = Math.max(Math.abs(C.model.lib - 33.9), Math.abs(C.model.grn - 84.8), Math.abs(C.model.ind - 55.9));
const inside = Math.abs(C.model.lib - 33.9) <= C.err90.lib && Math.abs(C.model.grn - 84.8) <= C.err90.grn && Math.abs(C.model.ind - 55.9) <= C.err90.oth;
assert.ok(art.includes(`The two differ by up to ${gap.toFixed(1)} points, ${inside ? "inside" : "outside"} the site&rsquo;s range`), "the SA comparison sentence matches the numbers");
// the SA bars' sources: the 25-seat contest calibration and the Coalition-cell check
assert.deepEqual([...bt.settings.contest_n], [C.seats], "the contest calibration runs at the contest's own seat count");
assert.equal(Object.keys(bt.noncoal_check).length, 6, "the Coalition cell is checked on six federal elections");
const libMiss = Math.max(...Object.values(bt.noncoal_check).filter((d) => d.coal).map((d) => Math.abs(d.coal.model - d.coal.counted)));
assert.ok(Math.abs(C.err90.lib - libMiss) < 0.006, "the Liberal bar is the check's largest miss");
assert.ok(art.includes(`at ${C.model.minor.toFixed(1)}%, below independents`), "the minor-party figure in the prose is the estimator's");

console.log(`PASS: state flows – ${Object.keys(shown).length} states on the chart (${Object.entries(shown).map(([k, s]) => k + " " + s.size).join(", ")}), `
  + `back-test Greens ${B.grn.model} v replay ${B.grn.replay}, others ${B.oth.model} v ${B.oth.replay}, Queensland within ${B.qld}`);
