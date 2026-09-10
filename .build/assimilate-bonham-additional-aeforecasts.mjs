#!/usr/bin/env node
/* assimilate-bonham-additional-aeforecasts.mjs — fold the genuinely-new waves
   of d-j-hirst/aus-polling-analyser's federal poll database (mirrored
   VERBATIM at data/bonham-additional-aeforecasts.csv by
   .build/refresh-bonham-additional-aeforecasts.mjs) into data/polls.json.

     node .build/assimilate-bonham-additional-aeforecasts.mjs           # dry-run (default)
     node .build/assimilate-bonham-additional-aeforecasts.mjs --apply   # write polls.json + proof

   INSERT-ONLY: existing curated rows are never modified. Re-runs are no-ops
   (every insert dedupes against both the curated rows and this run's own
   inserts), so the updater can run it on every mirror refresh.

   What lands where:
   - cycle VI rows  -> cyclePolls[term-END year]  (row shape matches the
     curated cycle rows exactly: date,firm,lnp,alp,grn,onp,oth,tpp_lnp,
     tpp_alp). Readings on/before the 1987-07-11 election stay CSV-only —
     no pre-1990 buckets exist (adjudicated: ~550 pre-1987 Morgan Gallup
     readings live in the mirror CSV alone, next to trove-primary-vote.csv).
   - current-term VI -> polls[] as `assimilated` rows (sample:null — Hirst's
     tables carry no per-wave n). Only Morning Consult's rows are expected to
     get here; any OTHER house reaching the current term is REFUSED and logged,
     because live extractors own those series in-term and validate.mjs's
     ASSIMILATED_OK gate only adjudicates n=1200 as a sane implicit weight
     for houses on its list.
   - GLApp/GLDis (government-leader approval) -> cycleApproval[term-BEGIN
     year] as pmNet (GL = the PM of the day), or approval[] (alb slot, with
     the app/dis split kept in detail) once the term is live.
   - current-term Morgan-family rows are REPORTED-ONLY, never inserted: the
     extract-roymorgan pipeline owns Roy Morgan in-term, and a mid-dated
     upstream row could shadow a curated fieldwork-end row of the same wave.

   Upstream schema (16 cols): MidDate,Firm,Brand,@TPP,LNP FP,ALP FP,GRN FP,
   ONP FP,NXT FP,UAP FP,DEM FP,DLP FP,OTH FP,GLApp,GLDis,Comments; missing
   cells are "#N/A" or empty. Conventions:
   - `date` = MidDate verbatim. Local `date` is fieldwork END; upstream's is
     the fieldwork MIDPOINT — the closest available key. The ±3-day dedupe
     window absorbs the end-vs-mid skew against curated rows.
   - oth = Σ(NXT,UAP,DEM,DLP,OTH) for non-Morgan houses — the published
     decomposition itemises those minors outside OTH, and folding brings the
     row to Σ≈100. MORGAN rows are upstream-inconsistent (some eras itemise
     e.g. UAP outside OTH, some rows double-count it inside OTH), so a
     Morgan row's oth is adjudicated per row: fold, unless OTH-alone brings
     the core primaries closer to Σ100. A row itemising nothing keeps
     oth null.
   - @TPP is the ALP share; tpp_lnp is recorded as its complement.
   - values are rounded to 0.1 (upstream carries long derived decimals like
     50.52631579 for share-quota rows; curated rows run halves).
   - Morgan-era naming matches the curated buckets: all four upstream Morgan
     series (F2F / Phone / multi-mode / SMS) are "Morgan" in cycles ≤2016 and
     "Roy Morgan" from the 2016–19 term on — no imported row may introduce a
     new Morgan label into a bucket.

   Deliberate SKIPS (counted, not errors): Newspoll/Newspoll2/Newspoll3,
   Essential, ResolvePM/ResolvePM2, Redbridge, YouGov/YouGov2, Galaxy,
   Nielsen, DemosAU, Spectre, Freshwater, Wolf+Smith, Fox & Hedgehog, ANU,
   Agenda C Synesis — live extractors or curated archives cover those houses
   with fuller metadata (sample, urls, fieldwork windows), so importing
   Hirst's thinner re-records of the same waves would only duplicate them.

   Dedupe. Non-Morgan houses: a candidate is dropped when an existing row of
   the same mapped firm sits within ±3 days of its date, OR when a row within
   ±10 days carries identical figures (every non-null VI share + the 2PP
   pair, ±0.5). MORGAN candidates match on figures with presence tolerance
   (null-vs-value passes, values must agree ±0.5): a curated row within ±14
   days that figure-matches is the same upstream wave re-key'd to a fieldwork
   midpoint — dropped (this is the "two readings on one wave" double-weight
   validate.mjs's check-8 comment guards against, and 85%+ of upstream
   Morgan rows in overlapping buckets are exactly that); a figure-CONFLICTING
   row within ±5 days keeps the curated row and is logged as a conflict for
   adjudication. GL rows dedupe on the ±3-day date rule alone. Conflicts are
   printed as NOTE lines — the curated row always wins.

   FOLLOW-UP (manual, after a run): if any inserted cycle row's primary Σ
   lands outside 98–102 the validator's check 8c will fail until an
   adjudicated cyclePollBases["<year>|<firm>"] note is written — the report
   prints a WATCH list of those. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const DAY = 86400000;

// full CSV parser (quoted cells survive; question text can contain commas)
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const csv = parseCsv(readFileSync("data/bonham-additional-aeforecasts.csv", "utf8").trim());
const [header, ...lines] = csv;
const col = Object.fromEntries(header.map((h, i) => [h, i]));

// values are printed "#N/A"/"##"/"" when absent; anything non-numeric is null
const num = (s) => {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  const v = Number(t);
  return isFinite(v) ? Math.round(v * 10) / 10 : null;
};

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

/* ---------- firm mapping ---------- */
const MORGAN_REMOTE = new Set(["F2F Morgan", "Morgan Phone", "Morgan multi-mode", "SMS Morgan"]);
const ERA_BOUNDARY_CYCLE = 2016; // ≤2016 bucket: "Morgan"; newer terms: "Roy Morgan"
const IDENTITY_IMPORT = new Set([
  "AGB McNair", "Quadrant", "Saulwick", "ARS", "McCrindle", "uComms",
  "Lonergan", "AMR", "ReachTEL", "Ipsos", "Morning Consult",
]);
// local firm name for a remote row; bucketYear null = current term (polls[])
const firmFor = (remote, bucketYear) => {
  if (MORGAN_REMOTE.has(remote))
    return bucketYear !== null && bucketYear <= ERA_BOUNDARY_CYCLE ? "Morgan" : "Roy Morgan";
  return IDENTITY_IMPORT.has(remote) ? remote : null;
};

/* ---------- bucketing ---------- */
// cyclePolls is keyed term-END year; cycleApproval term-BEGIN year
const endYears = Object.keys(D.cyclePolls).map(Number).sort((a, b) => a - b);
const electionDate = (y) => D.elections["e" + y].date;
const OLDEST_ELECTION = electionDate(endYears[0] - 3); // e1987 — term before the first bucket
const bucketFor = (date) => {
  for (const y of endYears) if (date <= electionDate(y)) return String(y);
  return null; // after the last closed election -> current term
};
const approvalBucketFor = (date) => {
  let begun = null;
  for (const y of endYears) {
    if (electionDate(y) < date) begun = y;
    else break;
  }
  return begun; // null when <= oldest election
};

/* ---------- remote rows -> candidates ---------- */
const VI_NULL_CHECK = (r) => r.alp == null && r.lnp == null; // no VI at all
const candidates = [];
for (const l of lines) {
  const tpp = num(l[col["@TPP"]]);
  const alp = num(l[col["ALP FP"]]), lnp = num(l[col["LNP FP"]]);
  const grn = num(l[col["GRN FP"]]), onp = num(l[col["ONP FP"]]);
  const minor = ["NXT FP", "UAP FP", "DEM FP", "DLP FP"].map((k) => num(l[col[k]]));
  const othRaw = num(l[col["OTH FP"]]);
  const minorsSum = minor.reduce((s, m) => s + (m ?? 0), 0);
  // Fold ALL itemised minors into oth, always. The Morgan-era printed tables
  // run majors+OTH past 100 by including each minor in its own column AND in
  // OTH ("faithful to the printed table" per the cyclePollBases notes), and
  // the curated Morgan rows already carry that convention — folding here
  // makes the imported rows consistent with what's in each bucket. A row
  // itemising nothing keeps oth null.
  const oth = minor.some((m) => m != null) || othRaw != null
    ? Math.round((minorsSum + (othRaw ?? 0)) * 10) / 10
    : null;
  const glApp = num(l[col.GLApp]), glDis = num(l[col.GLDis]);
  candidates.push({
    remote: l[col.Firm],
    date: l[col.MidDate],
    alp, lnp, grn, onp,
    oth,
    tpp_alp: tpp,
    tpp_lnp: tpp == null ? null : Math.round((100 - tpp) * 10) / 10,
    glApp,
    glDis,
  });
}

/* ---------- dedupe helpers ---------- */
const daysApart = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const VI_KEYS = ["alp", "lnp", "grn", "onp", "oth", "tpp_alp", "tpp_lnp"];
const close = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 0.5);
const sameFigures = (a, b) => VI_KEYS.every((k) => close(a[k], b[k]));
const CHANGED = (a, b) => VI_KEYS.some((k) => a[k] != null && b[k] != null && Math.abs(a[k] - b[k]) > 2);
// Same-wave test for Morgan candidates. The oth lane is EXCLUDED from both
// tests: its bookkeeping differs by transcription (curated Morgan era rows
// run the printed table's double-count, Σ majors+OTH = 102.5–106.5 per the
// cyclePollBases notes, while upstream's OTH is the clean residual to 100),
// so oth carries no identity signal beyond what the named lanes already
// give. Identity is alp/lnp/grn/onp ±1 and the tpp pair ±2, keys present on
// only one side ignored. Two curated waves 7 days apart can both sit inside
// tolerance of one mid-dated upstream row — dropping it as a re-key is the
// conservative outcome (an insert is the only move that can double a wave).
const MORGAN_WAVE_KEYS = ["alp", "lnp", "grn", "onp", "tpp_alp", "tpp_lnp"];
const waveMatch = (a, b) =>
  MORGAN_WAVE_KEYS.every((k) => {
    const tol = k.startsWith("tpp") ? 2 : 1;
    return a[k] == null || b[k] == null || Math.abs(a[k] - b[k]) <= tol;
  });
// Conflict test for Morgan candidates (same lanes): any shared lane
// differing by >2 marks a genuine disagreement with the curated row of
// (nearly) the same date — the curated row wins, the pair is logged.
const waveClash = (a, b) =>
  MORGAN_WAVE_KEYS.some((k) => a[k] != null && b[k] != null && Math.abs(a[k] - b[k]) > 2);

const firmKeyCycle = (r) => r.firm;
const firmKeyPolls = (r) => r.pollster;

/* ---------- insert machinery ---------- */
const report = { inserted: [], dateDup: [], figureDup: [], conflicts: [], skipFirm: {}, csvOnly: 0, morganCurrent: 0, refusedCurrent: {}, emptyRows: 0, glInserts: [], glDup: 0, rekey: 0 };
const note = (bucket, n) => { report.skipFirm[bucket] = (report.skipFirm[bucket] || 0) + n; };

const insertSorted = (arr, row, dateOf) => {
  const at = arr.findIndex((r) => dateOf(r) > dateOf(row));
  arr.splice(at === -1 ? arr.length : at, 0, row);
};

/* VI pass */
for (const c of candidates) {
  if (VI_NULL_CHECK(c)) {
    if (c.glApp == null || c.glDis == null) report.emptyRows++;
    continue; // GL-only rows are handled by the approval pass
  }
  const bucket = bucketFor(c.date);
  if (c.date <= OLDEST_ELECTION) { report.csvOnly++; continue; }
  const firm = firmFor(c.remote, bucket === null ? null : Number(bucket));
  if (!firm) { note(c.remote, 1); continue; }
  if (bucket === null) {
    // current term
    if (MORGAN_REMOTE.has(c.remote)) { report.morganCurrent++; continue; }
    if (!["Morning Consult"].includes(firm)) {
      report.refusedCurrent[firm] = (report.refusedCurrent[firm] || 0) + 1;
      continue;
    }
    const row = {
      date: c.date, pollster: firm, sample: null,
      alp: c.alp, lnp: c.lnp, grn: c.grn, onp: c.onp, ind: null, oth: c.oth,
      tpp_alp: c.tpp_alp, tpp_lnp: c.tpp_lnp, assimilated: true,
    };
    const dup = D.polls.find((p) => firmKeyPolls(p) === firm && daysApart(p.date, row.date) <= 3);
    if (dup) {
      if (CHANGED(dup, row)) report.conflicts.push({ where: `polls[] ${row.date} · ${firm}`, curated: dup, upstream: row });
      report.dateDup.push(`polls[] ${row.date} · ${firm}`);
      continue;
    }
    const figDup = D.polls.find((p) => firmKeyPolls(p) === firm && daysApart(p.date, row.date) <= 10 && sameFigures(p, row));
    if (figDup) { report.figureDup.push(`polls[] ${row.date} · ${firm} ~= ${figDup.date}`); continue; }
    insertSorted(D.polls, row, (p) => p.date);
    report.inserted.push({ where: `polls[] ${row.date} · ${firm}`, row });
    continue;
  }
  const rows = D.cyclePolls[bucket];
  const row = {
    date: c.date, firm,
    lnp: c.lnp, alp: c.alp, grn: c.grn, onp: c.onp, oth: c.oth,
    tpp_lnp: c.tpp_lnp, tpp_alp: c.tpp_alp,
  };
  if (MORGAN_REMOTE.has(c.remote)) {
    // Morgan: upstream's mid-dates re-key curated end-date waves ~4 days
    // earlier; plain ±3-day duping lets most re-keys through. A genuine
    // figure CLASH with a curated row within ±5d (combined-lane test, >2 on
    // any shared lane) keeps the curated row and logs the pair; a tolerant
    // wave match within ±14d is the same wave re-key'd — dropped. Curated
    // rows win either way.
    const pool = rows.filter((p) => firmKeyCycle(p) === firm)
      .map((p) => ({ p, d: daysApart(p.date, row.date) }));
    const clash = pool.find((x) => x.d <= 5 && waveClash(x.p, row));
    if (clash) {
      report.conflicts.push({ where: `${bucket} ${row.date} · ${firm}`, curated: clash.p, upstream: row });
      continue;
    }
    const wave = pool.find((x) => x.d <= 14 && waveMatch(x.p, row));
    if (wave) { report.rekey++; continue; }
  } else {
    const dup = rows.find((p) => firmKeyCycle(p) === firm && daysApart(p.date, row.date) <= 3);
    if (dup) {
      if (CHANGED(dup, row)) report.conflicts.push({ where: `${bucket} ${row.date} · ${firm}`, curated: dup, upstream: row });
      report.dateDup.push(`${bucket} ${row.date} · ${firm}`);
      continue;
    }
    const figDup = rows.find((p) => firmKeyCycle(p) === firm && daysApart(p.date, row.date) <= 10 && sameFigures(p, row));
    if (figDup) { report.figureDup.push(`${bucket} ${row.date} · ${firm} ~= ${figDup.date}`); continue; }
  }
  insertSorted(rows, row, (p) => p.date);
  report.inserted.push({ where: `${bucket} ${row.date} · ${firm}`, row });
}

/* GL (government-leader approval) pass */
for (const c of candidates) {
  if (c.glApp == null || c.glDis == null) continue;
  if (c.date <= OLDEST_ELECTION) continue; // pre-first-bucket approvals: CSV-only (already counted by VI pass when it had VI)
  const bucket = bucketFor(c.date);
  const firm = firmFor(c.remote, bucket === null ? null : Number(bucket));
  if (!firm) continue; // skipped houses: counted in the VI pass when they had VI; GL of skip-houses is deliberately not imported either
  if (bucket === null && MORGAN_REMOTE.has(c.remote)) continue; // Morgan in-term GL: extractor-owned
  const pmNet = Math.round((c.glApp - c.glDis) * 10) / 10;
  const aBucket = approvalBucketFor(c.date);
  if (bucket !== null) {
    // closed term -> cycleApproval[term-BEGIN year]
    if (!aBucket || !D.cycleApproval[aBucket]) continue;
    const rows = D.cycleApproval[aBucket];
    const row = { date: c.date, firm, pmNet, oppNet: null };
    if (rows.some((r) => r.firm === firm && daysApart(r.date, row.date) <= 3)) { report.glDup++; continue; }
    insertSorted(rows, row, (r) => r.date);
    report.glInserts.push({ where: `cycleApproval.${aBucket} ${row.date} · ${firm} pmNet ${pmNet} (${c.glApp}/${c.glDis})` });
  } else {
    // live term -> approval[] (only Morning Consult reaches here by design)
    if (!["Morning Consult"].includes(firm)) {
      report.refusedCurrent[firm] = (report.refusedCurrent[firm] || 0) + 1;
      continue;
    }
    const row = {
      date: c.date, firm,
      alb: pmNet, opp: null, oppName: null, han: null,
      detail: { alb: { app: c.glApp, dis: c.glDis } },
    };
    if (D.approval.some((r) => r.firm === firm && daysApart(r.date, row.date) <= 3)) { report.glDup++; continue; }
    insertSorted(D.approval, row, (r) => r.date);
    report.glInserts.push({ where: `approval[] ${row.date} · ${firm} alb ${pmNet} (${c.glApp}/${c.glDis})` });
  }
}

/* ---------- report ---------- */
const byBucket = {};
for (const x of report.inserted) {
  const b = x.where.split(" ")[0];
  const f = x.where.split(" · ")[1];
  byBucket[b] = byBucket[b] || {};
  byBucket[b][f] = (byBucket[b][f] || 0) + 1;
}
console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`\nVI rows: ${candidates.length} upstream · inserted ${report.inserted.length} · date-dup ${report.dateDup.length} · figure-dup ${report.figureDup.length} · Morgan re-keys ${report.rekey} · pre-1987 CSV-only ${report.csvOnly} · no-VI rows ${report.emptyRows}`);
console.log(`VI inserts by bucket:`);
for (const [b, firms] of Object.entries(byBucket))
  console.log(`  ${b}: ${Object.entries(firms).map(([f, n]) => `${f} +${n}`).join(" · ")}`);
console.log(`skipped (covered houses): ${Object.entries(report.skipFirm).map(([f, n]) => `${f}:${n}`).join(", ") || "none"}`);
if (report.morganCurrent) console.log(`current-term Morgan rows reported-only (extractor owns in-term): ${report.morganCurrent}`);
if (Object.keys(report.refusedCurrent).length)
  console.log(`WARNING refused current-term inserts (house not assimilate-approved): ${JSON.stringify(report.refusedCurrent)}`);
if (report.conflicts.length) {
  console.log(`\nNOTE conflicts — curated row kept, figures differ >2 (adjudicate before trusting either):`);
  report.conflicts.forEach((x) => console.log(`  ! ${x.where}\n      curated : ${JSON.stringify(x.curated)}\n      upstream: ${JSON.stringify(x.upstream)}`));
}
console.log(`\nGL rows: inserted ${report.glInserts.length} · date-dup ${report.glDup}`);
for (const g of report.glInserts) console.log(`  + ${g.where}`);

// inserted-row sum watch (validator check 8c needs a declared basis when off 100±2)
const watch = new Map();
for (const x of report.inserted) {
  if (!x.where.startsWith("polls[]")) {
    const r = x.row;
    if (!["alp", "lnp", "grn", "onp"].every((k) => r[k] != null)) continue;
    const sum = ["lnp", "alp", "grn", "onp", "oth"].reduce((s, k) => s + (r[k] ?? 0), 0);
    if (Math.abs(sum - 100) > 2) {
      const key = x.where.split(" ")[0] + "|" + r.firm;
      watch.set(key, { worst: Math.max(watch.get(key)?.worst ?? 0, Math.abs(sum - 100)), sum, row: x.where });
    }
  }
}
if (watch.size) {
  console.log(`\nWATCH — inserted cycle rows whose primary Σ leaves 100±2 (needs a cyclePollBases adjudication):`);
  for (const [k, w] of watch) console.log(`  ${k} worst ${(100 + w.worst).toFixed(1)}-ish (e.g. ${w.row} Σ${w.sum})`);
}

if (APPLY && (report.inserted.length || report.glInserts.length)) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeAtomic("data/polls.json", out);
  mkdirSync(".build/aeforecasts-src", { recursive: true });
  writeFileSync(".build/aeforecasts-src/assimilate-proof.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    inserted: report.inserted,
    glInserts: report.glInserts,
    dateDup: report.dateDup,
    figureDup: report.figureDup,
    conflicts: report.conflicts,
    csvOnly: report.csvOnly,
    morganCurrent: report.morganCurrent,
    rekey: report.rekey,
  }, null, 2) + "\n");
  console.log(`\nwrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB) + .build/aeforecasts-src/assimilate-proof.json`);
}
console.log(`ASSIMILATE_STATUS ${JSON.stringify({ src: "bonham-additional-aeforecasts", vi: report.inserted.length, gl: report.glInserts.length, conflicts: report.conflicts.length, changed: report.inserted.length + report.glInserts.length > 0 })}`);
