/* test-state-flows.mjs – pins the state flow estimates on the preference
   flows explainer's chart (user call 2026-10-20): the states are the
   two-class pile model's ESTIMATES (data/state-flows-est.csv, written by
   .build/estimate-state-flows.py), never the parsers' blended replay; only
   elections whose counts reached a Labor v Coalition final in at least 40
   seats reach the chart (Victoria from 24: its 2006-18 counts stopped once
   a candidate passed half the vote, their error measured under that same
   stopping rule in the vicstop band – user call 2026-10-23), One Nation's
   line only where at least the calibrated minimum ballots stand behind it,
   each point with its 90% error; the federal back-test that justifies them
   rides flowHistory.fed.backtest for the Info entry, and must keep showing
   the model beating the replay it replaced.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_CLASSIC = 40;
// per-jurisdiction floors (user call 2026-10-23): mirror STATE_MIN_CLASSIC_JUR
const MIN_JUR = { vic: 24 };
const minCl = (j) => MIN_JUR[j] || MIN_CLASSIC;

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
  } else if (r.jurisdiction === "vic" && bt0.settings.vic_band &&
             +r.n_classic >= bt0.settings.vic_band[0] && +r.n_classic <= bt0.settings.vic_band[1]) {
    // vic's stop-rule years: the vicstop band's own measured error (user
    // call 2026-10-23: shipped only while the band keeps it under 8 points)
    assert.ok(+r.n_classic >= minCl("vic") && +r.n_classic < Math.min(...bt0.settings.cal_n),
      `vic ${r.year}: a stop-rule count (${r.n_classic})`);
    assert.ok(+r.err90 > 0 && +r.err90 < 8, `vic ${r.year} ${r.party}: within the ship gate (${r.err90})`);
    const want = bt0.vicstop[r.party];
    assert.ok(want && +r.err90 === want.p90, `vic ${r.year} ${r.party}: quotes the vicstop band's p90 (${bt0.vicstop[r.party] && bt0.vicstop[r.party].p90})`);
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
assert.deepEqual(Object.keys(bt.federal).map(Number), [1996, 1998, 2001, 2007, 2010, 2013, 2016, 2019, 2022, 2025],
  "the back-test covers the ten federal elections counted by division (2004 has no such count)");
// 1984-93 and 2004: estimated only, from full distributions (1983's stopped at a majority)
assert.deepEqual(Object.keys(bt.federal_hist).map(Number), [1984, 1987, 1990, 1993, 2004], "the estimated-only federal elections");
for (const [y, d] of Object.entries(bt.federal_hist)) {
  assert.ok(d.classic >= 130 && d.dropped.length <= 8, `${y}: ${d.classic} classic seats, ${d.dropped.length} dropped`);
  assert.ok(d.oth && d.oth.err90 > 0, `${y}: others estimated with an error`);
}
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
  if (+r.n_classic >= minCl(r.jurisdiction) && ["grn", "oth"].includes(r.party) && r.est_flow_to_alp !== "") {
    (shown[r.jurisdiction] ||= new Set()).add(+r.year);
  }
}
// 2007's NSW tally-sheet count rides the all-seats store, not the estimator CSV
const nswEarly = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-nsw-allseats.json"), "utf8"))
  .years.filter((y) => y < 2015);
if (shown.nsw) nswEarly.forEach((y) => shown.nsw.add(y));
assert.deepEqual(Object.keys(FH).filter((k) => k !== "fed").sort(), Object.keys(shown).sort(),
  "exactly the jurisdictions with an election of 40+ classic seats (Vic 24+) get a chip");
assert.ok(!FH.nt, "the Northern Territory's small counts stay off the chart");
assert.deepEqual([...FH.qld.years], [2004, 2006, 2009, 2012, 2015, 2017, 2020, 2024],
  "Queensland shows 2004-2024, its optional-preferential years included");
assert.deepEqual([...FH.qld.opv], [2004, 2006, 2009, 2012, 2015], "Queensland's optional-preferential years carry exhausted shares");
assert.ok(FH.qld.grnExh.slice(0, 5).every((x) => x > 0) && FH.qld.grnExh.slice(5).every((x) => x == null),
  "Queensland's Greens exhausted share: the OPV years only");
assert.deepEqual([...FH.nsw.years], [2007, 2015, 2019, 2023],
  "NSW counts 2007 (the Paper's printed tally-sheet count) plus 2015-2023, every election with ballot-level data (2011 published none)");
assert.deepEqual([...FH.vic.years], [2006, 2010, 2014, 2018, 2022],
  "Victoria shows all five: 2006-18 ship under their own floor with the vicstop band's measured error (user call 2026-10-23)");
const VS = bt.vicstop;
assert.ok(VS && VS.grn && VS.oth, "the vicstop band rides the back-test json");
assert.ok(VS.oth.p90 < 8, `the vicstop others error ships under the user's 8-point gate (${VS.oth.p90})`);
assert.ok(VS.grn.mae < VS.grn.replay_mae && VS.oth.mae < VS.oth.replay_mae,
  "the vicstop model still beats the replay behind it");
assert.ok(VS.band && VS.band.in_band > 0, "vicstop's band measured at least one trial");
for (const [k, S] of Object.entries(FH)) {
  if (k === "fed") continue;
  assert.equal(S.estimated, k !== "nsw", `${k} is drawn as ${k === "nsw" ? "a count" : "an estimate"}`);
  assert.equal(!!S.counted, k === "nsw", `${k}: counted only for NSW`);
  assert.deepEqual([...S.years], [...shown[k]].sort((a, b) => a - b), `${k}: the years the rule allows`);
  if (k === "nsw") {
    // NSW is the count: allseats from 2015 (solid), 2007's tally-sheet count a
    // classic-coverage point (hollow), classic figures sidecarred from 2015
    assert.equal(S.allSeats, true, "nsw: marked an all-seats count");
    assert.deepEqual([...S.hollowYears], [...S.years.filter((y) => y < 2015)],
      "nsw: only the pre-file tally-sheet year rings hollow");
    for (const b of ["grn", "onp", "oth"]) {
      assert.ok(S.classic[b] && S.classic[b + "Exh"], `nsw: the classic sidecar carries ${b} and its exhausted share`);
      assert.deepEqual([...S.classic[b].keys()], [...S.years.keys()], `nsw: classic ${b} covers the four years`);
      // 2007 predates the ballot-file count: its classic figure was never counted
      assert.equal(S.classic[b][0], null, `nsw: no classic ${b} figure for 2007`);
      // 2015's One Nation row in the estimator is an empty one (they did not
      // run): the classic figure for it stays null; the other buckets count
      if (b === "onp") assert.equal(S.classic.onp[1], null, "nsw: no classic onp figure for 2015 (One Nation did not run)");
      else assert.equal(S.classic[b][1] != null && S.classic[b][2] != null && S.classic[b][3] != null, true, `nsw: classic ${b} is counted from 2015`);
    }
    assert.equal(S.classicFrom, 2015, "nsw: classicFrom marks the sidecar's first year");
  } else {
    assert.deepEqual([...S.hollowYears], [...S.years], `${k}: estimated views mark every point classic-seats`);
  }
  S.years.forEach((y, i) => {
    if (k === "nsw" && y < 2015) {
      // 2007's count predates One Nation's NSW return: no onp estimate row,
      // no pile in the store (test-nsw-allseats pins the empty piles)
      assert.equal(S.onp[i], null, "nsw 2007: no One Nation flow (they did not run)");
      return;
    }
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
      if (S.counted) {
        // NSW's chart figure is the all-seats count from data/state-flows-nsw-allseats.json
        // (pinned from the ballot files by test-nsw-allseats.mjs; its 2007 row
        // stands alone); the estimator's classic figure rides the classic
        // sidecar from 2015 for the like-for-like tooltip line.
        if (row) {
          assert.equal(S.classic[b][i], Math.round(+row.est_flow_to_alp * 1000) / 10,
            `${k} ${S.years[i]} ${b}: the classic sidecar is the estimator's figure`);
        } else assert.equal(S.classic[b][i], null, `${k} ${S.years[i]} ${b}: no classic figure before the ballot files`);
      } else {
        assert.equal(v, Math.round(+row.est_flow_to_alp * 1000) / 10, `${k} ${S.years[i]} ${b}: the estimator's figure`);
      }
    });
  }
}
const B = FH.fed.backtest;
assert.ok(B && B.elections === 10, "the federal back-test rides fed.backtest");
// the federal chart: 1984-93 estimates (bars) ahead of the 1996-2025 counts (none)
assert.deepEqual([...FH.fed.estYears], [1984, 1987, 1990, 1993], "the federal series' estimated years");
assert.deepEqual([...FH.fed.years.slice(0, 5)], [1984, 1987, 1990, 1993, 1996], "estimates lead into the counts");
FH.fed.years.forEach((y, i) => {
  const isEst = y < 1996;
  for (const b of ["grn", "oth"]) {
    if (FH.fed[b][i] == null) continue;
    assert.equal(FH.fed[b + "Err"][i] != null, isEst, `fed ${y} ${b}: a bar only on an estimate`);
  }
});
assert.equal(FH.fed.grn[0], null, "no Greens flow in 1984 (no Greens party stood)");
assert.deepEqual([...FH.fed.hollowYears], [1996, 1998, 2001],
  "only the pre-2004 federal points are marked classic-seats (all-seats from 2004)");
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
assert.equal(Object.keys(bt.noncoal_check).length, 10, "the Coalition cell is checked on the ten counted federal elections");
const libMiss = Math.max(...Object.values(bt.noncoal_check).filter((d) => d.coal).map((d) => Math.abs(d.coal.model - d.coal.counted)));
assert.ok(Math.abs(C.err90.lib - libMiss) < 0.006, "the Liberal bar is the check's largest miss");
assert.ok(art.includes(`at ${C.model.minor.toFixed(1)}%, below independents`), "the minor-party figure in the prose is the estimator's");
const dl = C.model.lib - 33.9;
assert.ok(art.includes("The site puts Liberal voters " + (Math.abs(dl) < 0.3 ? "about where Bonham does" : dl > 0 ? "a little more Labor&rsquo;s way than Bonham does" : "a little less Labor&rsquo;s way than Bonham does")),
  "the Liberal comparison with Bonham follows the estimate");

// FH.nsw's drawn figures equal the all-seats store's, 2007 included
{
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-nsw-allseats.json"), "utf8"));
  const ix = Object.fromEntries(all.years.map((y, i) => [y, i]));
  FH.nsw.years.forEach((y, i) => {
    for (const b of ["grn", "onp", "oth"]) {
      assert.equal(FH.nsw[b][i], all[b][ix[y]] ?? null, `nsw ${y} ${b}: the store's figure on the chart`);
      assert.equal(FH.nsw[b + "Exh"][i], all[b + "Exh"]?.[ix[y]] ?? null, `nsw ${y} ${b}: the store's exhausted share`);
    }
  });
}

console.log(`PASS: state flows – ${Object.keys(shown).length} states on the chart (${Object.entries(shown).map(([k, s]) => k + " " + s.size).join(", ")}), `
  + `back-test Greens ${B.grn.model} v replay ${B.grn.replay}, others ${B.oth.model} v ${B.oth.replay}, Queensland within ${B.qld}`);
