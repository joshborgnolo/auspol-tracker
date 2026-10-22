/* Pins for the National-direction panel's group-select payloads in the
   generated 9f09dca2 data asset: directionStates (SEC Newgate's per-State
   series, from data/sec-direction-states.json), directionGroups (the subgroup
   views as headline-anchored POOLED GAPS: Roy Morgan's "Analysis by …" prose
   splits, from data/roymorgan-direction-groups.json, and Essential's
   national-mood gender/age splits, from data/essential-direction-groups.json,
   each wave differenced against its own all-voters print – so a house's lean
   cancels – then the gaps pooled n-weighted month by month onto the
   lean-adjusted average) and directionStateNote (the latest printed state
   extremes). All are federal-only: a BUILD_JUR=vic run must carry none of
   them.
   Run: node .build/newtracker/test-direction-groups.mjs */
import { readdirSync, readFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const NT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(NT, "..", "..");

/* --- the federal run: read the live data asset the page reads --- */
const dataFile = readdirSync(path.join(NT, "assets"))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
assert.ok(dataFile, "could not find the 9f09dca2 data asset (run the build first)");
const win = {};
new Function("window", readFileSync(path.join(NT, "assets", dataFile), "utf8"))(win);
const D = win.AUSPOL;
assert.ok(D, "AUSPOL missing from the data asset");

const r10 = (v) => Math.round(v * 10) / 10;
const head = new Map(D.direction.map((p) => [p.ym, p]));

const SEC_STATES = ["NSW", "VIC", "QLD", "SA", "WA"];

// ---- directionStates: SEC Newgate per-state, five states, right-only early ----
{
  const ds = D.directionStates;
  assert.ok(ds, "directionStates emitted");
  assert.deepEqual(Object.keys(ds).sort(), [...SEC_STATES].sort(),
    "exactly the five mainland states");
  const bank = JSON.parse(readFileSync(path.join(ROOT, "data", "sec-direction-states.json"), "utf8"));
  for (const st of SEC_STATES) {
    const g = ds[st];
    assert.equal(g.label, st);
    assert.equal(g.source, "SEC Newgate", `${st}: credit rides the bank`);
    assert.equal(g.series.length, (bank.series[st] || []).length,
      `${st}: the whole bank carries over`);
    assert.ok(g.series.length >= 9, `${st}: a series long enough to chart`);
    assert.deepEqual(g.head, (bank.series[st] || [])[(bank.series[st] || []).length - 1],
      `${st}: head is the bank's latest raw reading`);
    const bankRows = [...(bank.series[st] || [])].sort((a, b) => a.month.localeCompare(b.month));
    assert.deepEqual(g.series.map((p) => [p.ym, p.right, p.wrong]),
      bankRows.map((r) => [r.month, r.right, r.wrong ?? null]),
      `${st}: the series mirrors the bank's figures month for month`);
    let prevX = -Infinity, prevYm = "";
    const secRowMonths = new Set((JSON.parse(readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).direction || [])
      .filter((d) => d.pollster === "SEC Newgate")
      .flatMap((d) => [d.date, d.published, d.dateStart].filter(Boolean).map((s) => String(s).slice(0, 7))));
    for (const p of g.series) {
      assert.match(p.ym, /^\d{4}-\d{2}$/, `${st}: month-shaped ym`);
      assert.ok(p.ym > prevYm, `${st}: months ascend`);
      assert.ok(p.x > prevX, `${st}: x follows the month`);
      assert.ok(typeof p.right === "number" && p.right >= 0 && p.right <= 100,
        `${st}: right is a printed share`);
      assert.ok(p.wrong === null || (typeof p.wrong === "number" && p.wrong >= 0 && p.wrong <= 100),
        `${st}: wrong is a printed share or unprinted`);
      assert.ok(!(p.ym > "2026-06" && p.wrong == null),
        `${st}: the paired right/wrong era has both`);
      // tip provenance rides from the polls.json direction row its month
      // resolves to: a banked month with no row joins nothing at all
      if (secRowMonths.has(p.ym)) {
        assert.equal(p.pollster, "SEC Newgate", `${st} ${p.ym}: tip credit`);
        assert.match(p.released, /^\d{4}-\d{2}-\d{2}$/, `${st} ${p.ym}: the joined row's date`);
        assert.ok(typeof p.dateLabel === "string" && p.dateLabel.length, `${st} ${p.ym}: fieldwork window`);
      } else {
        assert.equal(p.released, undefined, `${st} ${p.ym}: an unjoined month carries no released date`);
      }
      prevX = p.x; prevYm = p.ym;
    }
  }
  console.log("directionStates: OK");
}

// ---- directionGroups: the merged group set --------------------------------
const dg = D.directionGroups;
assert.ok(dg, "directionGroups emitted");
{
  const EXPECT = ["Men", "Women", "One Nation voters", "Coalition voters", "Other party voters",
                  "Independent voters", "Greens voters", "Labor voters", "18–34", "35–54", "55+"];
  assert.deepEqual(Object.keys(dg).sort(), EXPECT.slice().sort(),
    "one merged key per cut – the gender pair pools Essential and Roy Morgan");
  assert.deepEqual(dg.Men.houses, ["Essential", "Roy Morgan"], "Men merges both houses");
  assert.deepEqual(dg.Women.houses, ["Essential", "Roy Morgan"], "Women merges both houses");
  assert.deepEqual(dg["18–34"].houses, ["Essential"], "the age bands are Essential's alone");
  assert.deepEqual(dg["55+"].houses, ["Essential"], "the age bands are Essential's alone");
  assert.deepEqual(dg["Coalition voters"].houses, ["Roy Morgan"], "the vote cuts are Roy Morgan's alone");
  assert.deepEqual(dg["Labor voters"].houses, ["Roy Morgan"], "the vote cuts are Roy Morgan's alone");
  for (const g of Object.values(dg)) {
    assert.ok(g.dim === "gender" || g.dim === "age" || g.dim === "vote", `${g.label}: the panel's taxonomy`);
    assert.ok(Array.isArray(g.series) && Array.isArray(g.raw), `${g.label}: line and dots`);
    assert.equal(typeof g.sized, "boolean", `${g.label}: sized flag`);
  }
  console.log("directionGroups (set): OK");
}

// ---- directionGroups: raw dots are the wave's own gap, headline-anchored ---
{
  const polls = JSON.parse(readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const rmRows = new Map((polls.direction || []).filter((d) => d.pollster === "Roy Morgan").map((d) => [d.date, d]));
  const rmStore = JSON.parse(readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8"));
  const VOTE = [["One Nation voters", "One Nation", false], ["Coalition voters", "L-NP", false],
                ["Other party voters", "Other", false], ["Independent voters", "Independent", false],
                ["Greens voters", "Greens", false], ["Labor voters", "ALP", true]];
  for (const [date, w] of Object.entries(rmStore.waves)) {
    const row = rmRows.get(date) || null;
    const cells = [
      ...(w.gender ? [["Men", w.gender.Men, true], ["Women", w.gender.Women, true]] : []),
      ...(w.vote ? VOTE.map(([label, k, hasR]) => [label, w.vote[k], hasR]) : []),
    ];
    for (const [label, cell, hasR] of cells) {
      const dot = dg[label].raw.find((d) => d.date === date);
      // a wave with no all-voters row cannot be differenced: no pool, no dot
      if (!row) { assert.equal(dot, undefined, `${label} ${date}: un-differenced, so unfiled`); continue; }
      assert.ok(dot, `${label} ${date}: the wave's dot rides the panel`);
      assert.equal(dot.pollster, "Roy Morgan", `${label} ${date}: tip credit`);
      assert.equal(dot.ym, date.slice(0, 7), `${label} ${date}: ym mirrors the wave`);
      assert.equal(r10(dot.gapW), r10(cell.w - row.wrong),
        `${label} ${date}: the store's own print less the wave's all-voters print`);
      if (hasR) assert.equal(r10(dot.gapR), r10(cell.r - row.right), `${label} ${date}: right gap, verbatim`);
      else {
        assert.equal(dot.gapR, null, `${label} ${date}: no right share, no right gap`);
        assert.equal(dot.right, null, `${label} ${date}: no right share, no right point`);
      }
      const H = head.get(dot.ym);
      assert.equal(dot.wrong, r10(H.wrong + dot.gapW), `${label} ${date}: anchored on the month's headline`);
      if (dot.gapR != null) assert.equal(dot.right, r10(H.right + dot.gapR));
      assert.equal(dot.released, date, `${label} ${date}: the dot identifies its wave`);
      assert.ok(typeof dot.dateLabel === "string" && dot.dateLabel.length, `${label} ${date}: fieldwork window`);
    }
  }
  const essStore = JSON.parse(readFileSync(path.join(ROOT, "data", "essential-direction-groups.json"), "utf8"));
  const waves = Object.keys(essStore.waves).length;
  assert.ok(waves > 0, "the committed Essential store banked waves");
  let inEra = 0;
  for (const [date, w] of Object.entries(essStore.waves)) {
    // a wave older than the headline era has no month to anchor to, and drops
    if (!head.has(date.slice(0, 7))) {
      assert.equal(dg.Men.raw.filter((d) => d.date === date && d.pollster === "Essential").length, 0,
        `${date}: pre-headline, no Essential dot`);
      continue;
    }
    inEra++;
    for (const label of ["Men", "Women", "18–34", "35–54", "55+"]) {
      const cell = w[label];
      const dots = dg[label].raw.filter((d) => d.date === date && d.pollster === "Essential");
      assert.equal(dots.length, 1, `${label} ${date}: one Essential dot per banked wave`);
      const dot = dots[0];
      assert.equal(r10(dot.gapR), r10(cell.r - w.total.r), `${label} ${date}: gapped to the wave's own TOTAL`);
      assert.equal(r10(dot.gapW), r10(cell.w - w.total.w));
      assert.match(dot.released, /^\d{4}-\d{2}-\d{2}$/, `${label} ${date}: tip rides the joined row`);
      assert.ok(typeof dot.dateLabel === "string" && dot.dateLabel.length, `${label} ${date}: fieldwork window`);
    }
  }
  // the houses' own readings stay marked in the pool: each house's dots
  // count its own waves inside the headline era
  const rmGenderWaves = Object.entries(rmStore.waves).filter(([d, w]) => w.gender && rmRows.has(d)).length;
  assert.equal(dg.Men.raw.filter((d) => d.pollster === "Roy Morgan").length, rmGenderWaves,
    "Men: every dir-row-matched RM gender wave gets a dot");
  assert.equal(dg.Men.raw.filter((d) => d.pollster === "Essential").length, inEra,
    "Men: every headline-era Essential wave gets a dot, nothing older");
  console.log("directionGroups (raw gaps): OK");
}

// ---- directionGroups: the pooled line rides the headline ------------------
{
  for (const [label, g] of Object.entries(dg)) {
    const byYm = new Map();
    for (const d of g.raw) { let a = byYm.get(d.ym); if (!a) byYm.set(d.ym, a = []); a.push(d); }
    assert.equal(g.series.length, byYm.size, `${label}: one pool month per month with waves`);
    let prevYm = "";
    for (const p of g.series) {
      assert.match(p.ym, /^\d{4}-\d{2}$/);
      assert.ok(p.ym > prevYm, `${label}: months ascend`);
      prevYm = p.ym;
      const H = head.get(p.ym);
      assert.ok(H, `${label} ${p.ym}: a pool sits only on a headline month`);
      assert.equal(p.x, H.x, `${label} ${p.ym}: on the headline's x`);
      assert.equal(p.wrong, r10(H.wrong + p.gapW), `${label} ${p.ym}: headline plus the pooled gap`);
      if (p.gapR != null) assert.equal(p.right, r10(H.right + p.gapR));
      else assert.equal(p.right, null, `${label} ${p.ym}: no right share anywhere`);
      const rs = byYm.get(p.ym);
      assert.ok(rs && rs.length, `${label} ${p.ym}: a pool to draw from`);
      const gaps = rs.map((d) => d.gapW);
      if (rs.length === 1) {
        assert.deepEqual([p.gapW, p.gapR ?? null], [rs[0].gapW, rs[0].gapR ?? null],
          `${label} ${p.ym}: a single wave's gap is the pool`);
      } else {
        const lo = Math.min(...gaps), hi = Math.max(...gaps);
        assert.ok(p.gapW >= lo - 0.11 && p.gapW <= hi + 0.11,
          `${label} ${p.ym}: the weighted pool lies between its waves' gaps`);
      }
    }
  }
  // the unsized cuts: no margin anywhere, and a multi-wave month pools the
  // waves' gaps UNWEIGHTED (every n null -> every weight 1)
  for (const k of ["Other party voters", "Independent voters"]) {
    assert.equal(dg[k].sized, false, `${k}: unsized`);
    for (const p of dg[k].series) {
      assert.equal(p.wrongCi, null, `${k} ${p.ym}: no base, no margin`);
      assert.equal(p.rightCi, null, `${k} ${p.ym}: no base, no margin`);
    }
    const byYm = new Map();
    for (const d of dg[k].raw) { let a = byYm.get(d.ym); if (!a) byYm.set(d.ym, a = []); a.push(d); }
    let multi = 0;
    for (const [ym, rs] of byYm) {
      if (rs.length < 2) continue;
      multi++;
      const mean = rs.reduce((s, d) => s + d.gapW, 0) / rs.length;
      const p = dg[k].series.find((s) => s.ym === ym);
      assert.ok(p, `${k} ${ym}: the month is pooled`);
      assert.equal(Math.round(p.gapW * 100), Math.round(mean * 100), `${k} ${ym}: unweighted pool`);
    }
    assert.ok(multi > 0, `${k}: a multi-wave month exists to prove the unweighted pool`);
  }
  // figure-for-figure spot pins off the committed stores: Men's gap pair in
  // August and September, Women's September, Labor's September, One Nation's
  const at = (label, ym) => dg[label].series.find((p) => p.ym === ym) || {};
  assert.deepEqual([at("Men", "2026-08").gapR, at("Men", "2026-08").gapW, at("Men", "2026-08").rightCi, at("Men", "2026-08").wrongCi],
    [1.6, 1.4, 1.3, 1.4], "Men Aug-2026 pooled gap + margins");
  assert.deepEqual([at("Men", "2026-09").gapR, at("Men", "2026-09").gapW, at("Men", "2026-09").rightCi, at("Men", "2026-09").wrongCi],
    [2.2, 0.7, 2.1, 2.3], "Men Sep-2026 pooled gap + margins");
  assert.deepEqual([at("Women", "2026-09").gapR, at("Women", "2026-09").gapW], [-2.4, -0.7], "Women Sep-2026");
  assert.deepEqual([at("Labor voters", "2026-09").gapR, at("Labor voters", "2026-09").gapW], [30.3, -35],
    "Labor voters Sep-2026");
  assert.equal(at("One Nation voters", "2026-09").gapW, 29.3, "One Nation voters Sep-2026");
  assert.equal(at("One Nation voters", "2026-09").right, null, "a non-ALP vote group carries no right share");
  // the disagreement the panel says plainly: Essential's Men sit further
  // right-of-the-headline than Roy Morgan's (mean of each house's own gaps)
  const meanOf = (h) => {
    const vs = dg.Men.raw.filter((d) => d.pollster === h && d.gapR != null).map((d) => d.gapR);
    return r10(vs.reduce((a, b) => a + b, 0) / vs.length);
  };
  assert.deepEqual([meanOf("Essential"), meanOf("Roy Morgan")], [4.6, 1.3],
    "Men's right-direction gap: Essential 4.6, Roy Morgan 1.3 – the panel's stated disagreement");
  console.log("directionGroups (pooled): OK");
}

// ---- directionStateNote: always the LATEST printed state extremes ----------
{
  const note = D.directionStateNote;
  assert.ok(note, "the state-extremes note is emitted");
  const store = JSON.parse(readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8"));
  const dates = Object.keys(store.waves).filter((d) => store.waves[d]?.stateExtremes).sort();
  assert.ok(dates.length, "the store has a state-extremes wave");
  const latest = dates[dates.length - 1];
  assert.equal(note.date, latest, "the note follows the newest extremes wave");
  assert.deepEqual({ highest: note.highest, lowest: note.lowest }, store.waves[latest].stateExtremes,
    "the note carries the store's figures verbatim");
  assert.match(note.lowest.state, /^(New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania)$/);
  assert.match(note.highest.state, /^(New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania)$/);
  console.log("directionStateNote: OK");
}

// ---- the JUR gate: none of it may reach the Vic build ----------------------
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), "dirgroups-vic-"));
  const vicPolls = path.join(tmp, "polls.json");
  const vicOut = path.join(tmp, "out");
  // the same conversion the Vic build performs (build.mjs's VIC branch)
  const { vicToMain } = await import("../vic/to-main-schema.mjs");
  const wrapped = vicToMain(JSON.parse(readFileSync(path.join(ROOT, "data", "vic-polls.json"), "utf8")));
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(vicOut, { recursive: true });
  writeFileSync(vicPolls, JSON.stringify(wrapped, null, 2) + "\n");
  execFileSync(process.execPath, [path.join(NT, "gen-data.mjs")],
    { cwd: ROOT, env: { ...process.env, GEN_DATA_POLLS: vicPolls, GEN_DATA_OUT: vicOut }, stdio: "pipe" });
  const vicAsset = path.join(vicOut, dataFile);
  assert.ok(existsSync(vicAsset), "the vic gen-data run wrote its data asset");
  const vwin = {};
  new Function("window", readFileSync(vicAsset, "utf8"))(vwin);
  assert.ok(vwin.AUSPOL, "the vic asset carries AUSPOL");
  assert.equal(vwin.AUSPOL.directionStates, null, "Vic carries no SEC state series");
  assert.equal(vwin.AUSPOL.directionGroups, null, "Vic carries no group splits");
  assert.equal(vwin.AUSPOL.directionStateNote, null, "Vic carries no state-extremes note");
  console.log("vic JUR gate: OK");
}

console.log("test-direction-groups: all OK");
