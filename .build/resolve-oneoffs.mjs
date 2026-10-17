#!/usr/bin/env node
/* resolve-oneoffs.mjs – VALIDATOR + tripwire for data/resolve-one-offs.json.

   The Resolve Political Monitor publishes no machine-readable one-off feed:
   the topical questions live only in the weekly SMH/Age article prose, so
   the store is hand-curated (like data/newspoll-one-offs.json). This script
   is its guard. It checks, and exits non-zero on any failure:

   1. STORE SHAPE – top-level keys, per-entry key set, generated == newest
      waveDate, (id, waveDate) uniqueness, kebab-case ids.
   2. WAVE ANCHORING – every entry's waveDate/url/sample/dateStart/published
      matches the corresponding polls.json Resolve row (the store rides the
      canonical rows, never its own dates).
   3. THEME COVERAGE – every id resolves through adhoc-themes.mjs (which
      throws on an unmapped id; the build would fail later anyway – here the
      failure is named at curation time).
   4. TABLE GEOMETRY – first table is the headline read; rows carry
      [label, ...values]; headered tables' row widths match; values are
      0–100 numbers or null (null = the wave printed no numeral – never
      infer from complements or trend sentences).
   5. WAVE REVIEW TRIPWIRE – every polls.json Resolve wave older than
      REVIEW_GRACE_DAYS must either be covered by the store or listed in
      NO_TOPICALS (waves whose article carried no topical questions), so a
      newly landed Resolve wave nags until its article has been read.

   Usage: node .build/resolve-oneoffs.mjs        (exit 0 clean, 1 problems)
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { themeOf } from "./newtracker/adhoc-themes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_GRACE_DAYS = 7;

/* Waves whose articles were read and carried NO topical questions – the
   tripwire's whitelist. Extend only after reading the wave's article. */
const NO_TOPICALS = new Set(["2025-08-16", "2025-09-13"]);

const ENTRY_KEYS = ["id", "waveDate", "dateStart", "dateEnd", "published", "sample",
  "sampleEff", "url", "question", "notes", "tables"];
const TABLE_KEYS = ["title", "source", "headers", "rows"];

const problems = [];
const bad = (msg) => problems.push(msg);

const store = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "resolve-one-offs.json"), "utf8"));
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).polls
  .filter((p) => p.pollster === "Resolve");

/* 1 – store shape */
for (const k of Object.keys(store)) {
  if (!["_about", "generated", "_readme", "entries"].includes(k)) bad(`unknown top-level key "${k}"`);
}
const entries = store.entries || [];
const waves = new Set(entries.map((e) => e.waveDate));
const maxWave = [...waves].sort().at(-1);
if (store.generated !== maxWave) bad(`generated=${store.generated} != newest waveDate ${maxWave}`);
const seen = new Set();
for (const e of entries) {
  const tag = `${e.id || "?"} @ ${e.waveDate || "?"}`;
  const keys = Object.keys(e);
  if (keys.join("|") !== ENTRY_KEYS.join("|")) bad(`${tag}: key set/order drift (${keys.join("|")})`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id || "")) bad(`${tag}: id not kebab-case`);
  const dup = `${e.id}|${e.waveDate}`;
  if (seen.has(dup)) bad(`${tag}: duplicate (id, waveDate)`);
  seen.add(dup);
  if (e.dateEnd !== e.waveDate) bad(`${tag}: dateEnd ${e.dateEnd} != waveDate ${e.waveDate}`);
  if (e.dateStart && !(e.dateStart <= e.waveDate)) bad(`${tag}: dateStart after waveDate`);
  if (typeof e.question !== "string" || e.question.length < 8) bad(`${tag}: question missing/too short`);
  if (e.notes !== null && typeof e.notes !== "string") bad(`${tag}: notes must be a string or null`);
  if (e.sampleEff !== null && !Number.isFinite(e.sampleEff)) bad(`${tag}: sampleEff must be null or a number`);

  /* 2 – wave anchoring */
  const row = polls.find((p) => p.date === e.waveDate);
  if (!row) { bad(`${tag}: no polls.json Resolve row for waveDate`); }
  else {
    if (row.url !== e.url) bad(`${tag}: url != polls.json row url`);
    if (e.sample !== (row.sample ?? null)) bad(`${tag}: sample ${e.sample} != polls.json ${row.sample ?? null}`);
    if ((row.dateStart || null) !== e.dateStart) bad(`${tag}: dateStart != polls.json ${row.dateStart || null}`);
    if (row.published && e.published !== row.published) {
      bad(`${tag}: published ${e.published} != polls.json ${row.published}`);
    }
  }

  /* 3 – theme coverage (themeOf throws on an unmapped id) */
  try { themeOf(e.id); } catch (err) { bad(`${tag}: ${err.message}`); }

  /* 4 – table geometry */
  if (!Array.isArray(e.tables) || !e.tables.length) bad(`${tag}: needs at least one table`);
  for (const [ti, t] of (e.tables || []).entries()) {
    const tkeys = Object.keys(t);
    if (tkeys.join("|") !== TABLE_KEYS.join("|")) bad(`${tag} table ${ti}: key set/order drift (${tkeys.join("|")})`);
    if (t.title !== null && typeof t.title !== "string") bad(`${tag} table ${ti}: title must be a string or null`);
    if (t.source !== e.url) bad(`${tag} table ${ti}: source must repeat the entry url`);
    if (t.headers !== null && (!Array.isArray(t.headers) || t.headers[0] !== "")) {
      bad(`${tag} table ${ti}: headers must be null or start with ""`);
    }
    if (!Array.isArray(t.rows) || !t.rows.length) bad(`${tag} table ${ti}: rows missing`);
    for (const [ri, r] of (t.rows || []).entries()) {
      if (!Array.isArray(r) || r.length < 2 || typeof r[0] !== "string" || !r[0]) {
        bad(`${tag} table ${ti} row ${ri}: needs [label, ...values]`);
        continue;
      }
      if (t.headers && r.length !== t.headers.length) {
        bad(`${tag} table ${ti} row ${ri}: width ${r.length} != headers ${t.headers.length}`);
      }
      if (!t.headers && r.length !== 2) {
        bad(`${tag} table ${ti} row ${ri}: headless rows are [label, value] pairs only (width ${r.length})`);
      }
      for (const v of r.slice(1)) {
        if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 100)) {
          bad(`${tag} table ${ti} row "${r[0]}": value ${v} not 0–100 or null`);
        }
      }
    }
  }
}

/* 5 – wave review tripwire */
const today = new Date();
const grace = new Date(today.getTime() - REVIEW_GRACE_DAYS * 86400e3);
for (const p of polls) {
  if (new Date(p.date) > grace) continue;
  if (NO_TOPICALS.has(p.date)) continue;
  if (!waves.has(p.date)) {
    bad(`polls.json Resolve wave ${p.date} has no one-offs coverage – read ${p.url || "the wave article"} `
      + `and either file its topical questions or add it to NO_TOPICALS`);
  }
}

if (problems.length) {
  console.error(`resolve-oneoffs: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`resolve-oneoffs: clean – ${entries.length} entries over ${waves.size} waves, `
  + `${new Set(entries.map((e) => e.id)).size} ids, newest ${maxWave}; `
  + `${polls.length} Resolve waves on file (${NO_TOPICALS.size} whitelisted topical-free)`);
