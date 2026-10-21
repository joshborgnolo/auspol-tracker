/* Pins for .build/extract-essential-direction.mjs, which banks Essential's
   national-mood breakdowns (Men/Women, 18–34/35–54/55+) out of the committed
   CSV mirror (data/essential-report.csv) into
   data/essential-direction-groups.json for the direction panel's group
   select.

   Oracles: the committed CSV mirror, the committed store it produced, and
   polls.json's Essential direction[] rows. Integration (all runs in tmp
   sandboxes via the extractor's ESS_DIR_* env overrides; no network, nothing
   outside tmp written):
     1. the committed CSV banked to a tmp path reproduces the committed store
        byte for byte, with figure-for-figure spot pins on the first wave
        (2022-06-14), a mid-series wave (2024-10-21), the curated outlier (csv
        2026-01-28 → dirRow 2026-01-23, the CSV−5 curation deviation) and the
        latest wave (2026-09-29); a re-run is changed:false;
     2. guards refuse to write: a wave cell gone missing, a cell sum drifting
        past the print tolerance, a wave's cells scatterable beyond the
        WAVE_GAP cluster window, and a reproduced TOTAL cell that no longer
        reconciles with its polls.json direction row.
   Run: node .build/test-essential-direction.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const EXTRACT = path.join(HERE, "extract-essential-direction.mjs");
const CSV_REAL = path.join(ROOT, "data", "essential-report.csv");
const POLLS_REAL = path.join(ROOT, "data", "polls.json");
const STORE = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "essential-direction-groups.json"), "utf8"));
const NLINES = fs.readFileSync(CSV_REAL, "utf8").trim().split("\n");

const runIn = (env) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "essdir-test-"));
  const out = path.join(tmp, "out.json");
  const res = { tmp, out };
  try {
    const stdout = execFileSync(process.execPath, [EXTRACT, "--apply"], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, ESS_DIR_OUT: out, ...env },
    });
    res.code = 0;
    res.stdout = stdout;
  } catch (e) {
    res.code = e.status;
    res.stdout = String(e.stdout || "");
  }
  res.status = res.stdout.trim().split("\n").pop();
  res.written = fs.existsSync(res.out);
  res.store = res.written ? JSON.parse(fs.readFileSync(res.out, "utf8")) : null;
  res.cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  return res;
};
const writeCsv = (tmp, lines) => {
  const p = path.join(tmp, "report.csv");
  fs.writeFileSync(p, lines.join("\n") + "\n");
  return p;
};

/* ---- 1. the committed CSV reproduces the committed store ------------------ */
{
  const r = runIn({});
  assert.equal(r.code, 0, `clean run: ${r.status}`);
  const st = JSON.parse(r.status.slice("ESS_DIR_STATUS ".length));
  assert.equal(st.waves, 51, "51 mood clusters in the committed CSV");
  assert.equal(st.reconciled, Object.keys(STORE.waves).length, "every wave reconciles against polls.json");
  assert.equal(st.guards, 0);
  assert.equal(r.written, true, "first run writes");
  assert.deepEqual(r.store.waves, STORE.waves, "wave for wave, figure for figure, the committed store");

  // first wave: the CSV's first full cluster
  assert.deepEqual(STORE.waves["2022-06-14"], {
    csv: "2022-06-15",
    Men: { r: 51, w: 29, u: 20 },
    Women: { r: 45, w: 25, u: 31 },
    "18–34": { r: 49, w: 30, u: 22 },
    "35–54": { r: 49, w: 25, u: 26 },
    "55+": { r: 45, w: 26, u: 28 },
    total: { r: 48, w: 27, u: 25 },
    dirRow: "2022-06-15",
  }, "first wave figures (the pre-assimilator csv-dated archive era)");

  // a mid-series wave from the curated era
  assert.deepEqual(STORE.waves["2024-10-21"], {
    csv: "2024-10-22",
    Men: { r: 36, w: 52, u: 13 },
    Women: { r: 25, w: 52, u: 22 },
    "18–34": { r: 40, w: 41, u: 19 },
    "35–54": { r: 27, w: 52, u: 21 },
    "55+": { r: 25, w: 61, u: 14 },
    total: { r: 30, w: 52, u: 18 },
    dirRow: "2024-10-22",
  }, "mid-series wave figures");

  // the curated outlier: csv 2026-01-28's direction row sits at 2026-01-23
  // (csv - 5), the dating deviation ROW_SWEEP exists for
  assert.deepEqual(STORE.waves["2026-01-27"], {
    csv: "2026-01-28",
    Men: { r: 34, w: 54, u: 12 },
    Women: { r: 25, w: 53, u: 22 },
    "18–34": { r: 37, w: 47, u: 16 },
    "35–54": { r: 28, w: 55, u: 17 },
    "55+": { r: 25, w: 58, u: 17 },
    total: { r: 29, w: 54, u: 17 },
    dirRow: "2026-01-23",
  }, "the csv-5 curated outlier resolves its row");

  // the latest wave
  assert.deepEqual(STORE.waves["2026-09-29"], {
    csv: "2026-09-30",
    Men: { r: 29, w: 61, u: 10 },
    Women: { r: 21, w: 59, u: 20 },
    "18–34": { r: 28, w: 55, u: 17 },
    "35–54": { r: 23, w: 62, u: 15 },
    "55+": { r: 24, w: 62, u: 14 },
    total: { r: 25, w: 60, u: 15 },
    dirRow: "2026-09-29",
  }, "latest wave figures");

  // every wave carries a cell for every band with shares that sum to print
  for (const [date, w] of Object.entries(STORE.waves)) {
    for (const g of ["Men", "Women", "18–34", "35–54", "55+", "total"]) {
      assert.ok(w[g], `${date}: ${g} cell`);
      assert.ok(Math.abs(w[g].r + w[g].w + w[g].u - 100) <= 2, `${date}: ${g} cell sums to print`);
    }
    assert.ok(w.dirRow, `${date}: dirRow joined`);
  }

  r.cleanup();
  console.log("1. committed CSV == committed store: OK");
}

/* ---- 2. no-op hygiene: a re-run over the same inputs writes nothing ------- */
{
  const r = runIn({});
  assert.equal(r.code, 0, `clean run: ${r.status}`);
  // run again onto the SAME committed store path shape: a tmp out seeded with
  // the first run's bytes expects changed:false
  const r2 = (() => {
    const stdout = execFileSync(process.execPath, [EXTRACT, "--apply"], {
      cwd: ROOT, encoding: "utf8",
      env: { ...process.env, ESS_DIR_OUT: r.out },
    });
    return stdout.trim().split("\n").pop();
  })();
  const st2 = JSON.parse(r2.slice("ESS_DIR_STATUS ".length));
  assert.equal(st2.changed, false, "a quiet re-run writes nothing");
  r.cleanup();
  console.log("2. no-op byte-stability: OK");
}

/* ---- 3. guards: a printed cell gone, sums drifting, cluster scatter ------- */
{
  const csvTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "essdir-csv-"));
  const csvIn = (tmp, lines) => writeCsv(tmp, lines);

  // (a) drop the Trend Unsure cell of the first wave: the cluster refuses
  const miss = NLINES.filter((l) => l !== "national_mood,E563,National mood (Trend),Trend,Unsure,,,2022-06-15,25,");
  assert.equal(miss.length, NLINES.length - 1, "fixture sanity: the line really existed");
  let cTmp = csvTmp();
  let r = runIn({ ESS_DIR_CSV: csvIn(cTmp, miss) });
  assert.equal(r.code, 2, `a missing answer guards: ${r.status}`);
  assert.match(r.stdout, /ESS_DIR_GUARD/, "the guard names itself");
  assert.match(r.stdout, /Unsure unprinted/, "the guard names the missing answer");
  assert.equal(r.written, false, "nothing written");
  r.cleanup(); fs.rmSync(cTmp, { recursive: true, force: true });

  // (b) drift a cell's sum past the 100 +/- 2 print tolerance
  const drift = NLINES.map((l) => l === "national_mood,E563,National mood (Trend),Trend,Right direction,,,2022-06-15,48,"
    ? "national_mood,E563,National mood (Trend),Trend,Right direction,,,2022-06-15,44," : l);
  cTmp = csvTmp();
  r = runIn({ ESS_DIR_CSV: csvIn(cTmp, drift) });
  assert.equal(r.code, 2, `a drifting cell sum guards: ${r.status}`);
  assert.match(r.stdout, /sums to/, "the guard names the sum");
  assert.equal(r.written, false, "nothing written");
  r.cleanup(); fs.rmSync(cTmp, { recursive: true, force: true });

  // (c) scatter one band 8 days away from its wave's TOTAL: the cluster breaks
  const scatter = NLINES.map((l) => l === "national_mood,E563,National mood (Male Trend),Male,Right direction,,,2022-06-15,51,"
    ? "national_mood,E563,National mood (Male Trend),Male,Right direction,,,2022-06-24,51," : l);
  cTmp = csvTmp();
  r = runIn({ ESS_DIR_CSV: csvIn(cTmp, scatter) });
  assert.equal(r.code, 2, `a scattered band guards: ${r.status}`);
  assert.match(r.stdout, /ESS_DIR_GUARD/, "the scatter trips a guard");
  assert.match(r.stdout, /unprinted|printed twice|missing a wave/, "the guard names the cluster break");
  assert.equal(r.written, false, "nothing written");
  r.cleanup(); fs.rmSync(cTmp, { recursive: true, force: true });

  console.log("3. CSV guard classes: OK");
}

/* ---- 4. guards: the polls.json reconcile ---------------------------------- */
{
  // flip the first wave's printed wrong track on its polls.json row: the
  // reproduced TOTAL cell can no longer reconcile, so the run refuses
  const polls = JSON.parse(fs.readFileSync(POLLS_REAL, "utf8"));
  const row = polls.direction.find((d) => d.pollster === "Essential" && d.date === "2022-06-15");
  assert.ok(row, "fixture sanity: the 2022-06-15 direction row exists");
  row.wrong = 40;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "essdir-polls-"));
  const pollsPath = path.join(tmp, "polls.json");
  fs.writeFileSync(pollsPath, JSON.stringify(polls));
  const r = runIn({ ESS_DIR_POLLS: pollsPath });
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(r.code, 2, `recon drift guards: ${r.status}`);
  assert.match(r.stdout, /vs polls\.json/, "the guard names the mismatch");
  assert.equal(r.written, false, "nothing written");
  r.cleanup();
  console.log("4. direction-row reconcile guard: OK");
}

console.log("test-essential-direction: all OK");
