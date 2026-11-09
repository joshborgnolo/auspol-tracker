#!/usr/bin/env node
/* resolve-oneoffs-file.mjs – AUTO-FILER for data/resolve-one-offs.json.

   WHY (2026-11-09): the 2026-11-07 wave's topical charts (Responsibility for
   living costs; the Marrickville golf-club grant trust battery) sat uncurated
   until a hand-entry (29b8a0ec) while the figures lived in the article's own
   Datawrapper datasets — machine-readable the whole time (user: the agent
   should add this stuff automatically). This script files a wave's topical
   questions itself: the wave's SMH article is located like
   resolve-article-read.mjs does, its datawrapper.dwcdn.net iframe charts are
   read directly (chart page og meta = title/question; <id>/dataset.csv =
   the figures), and:
   - figures are VERBATIM from the publisher's dataset, never from any
     model — known series (SERIES_SEED) file deterministically; anything
     else asks Matilda only for the organising metadata (id / theme /
     concise question / notes) with the figures already bound, and a
     deterministic verifier gates the verdict before it lands (rule 6:
     no LLM number ever lands — LLM notes may cite only numerals that
     appear in the evidence bundle),
   - the modelled series this pipeline already reads (leader performance,
     net likeability) are skipped deterministically, never offered to the
     model,
   - a trend table files only when its latest non-empty column names the
     wave's month (the same guard as the likeability lane),
   - a written store is revalidated with resolve-oneoffs.mjs and rolled
     back byte-for-byte if the guard trips.

   New ids also land in adhoc-themes.mjs's THEME_OF (the validator's theme
   coverage check throws otherwise), appended to the verdict's theme
   section.

   Dry-run by default; --apply writes data/resolve-one-offs.json (and
   .build/newtracker/adhoc-themes.mjs). --topic FILE, --article URL=FILE,
   --dw DIR (datasets as DIR/<id>.tsv, chart pages as DIR/<id>.html) read
   saved files instead of fetching (tests). --wave <date> limits the run.
   MATILDA_DISABLE=1 (or no CLI, no MATILDA_API_KEY) keeps the run
   deterministic-only: unseeded charts are flagged, never filed; the guard's
   7-day tripwire still nags for a human — the laptop/launchd case.

   Last line: RESOLVE_ONEOFF_STATUS {"filed":[...],"skipped":[...],"flagged":[...],"warnings":[...],"applied":bool} */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeAtomic } from "./atomic-write.mjs";
import { storiesOf, textOf, dwTable } from "./resolve-article-read.mjs";
import { NO_TOPICALS } from "./resolve-oneoffs.mjs";
import { THEMES } from "./newtracker/adhoc-themes.mjs";
import { matildaCli, askMatildaJson } from "./matilda-json.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, "data", "resolve-one-offs.json");
const THEMES_PATH = path.join(ROOT, ".build", "newtracker", "adhoc-themes.mjs");
const TOPIC = "https://www.smh.com.au/topic/resolve-political-monitor-6fhy";
const DAY = 86400000;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const WAVE = opt("--wave");
const savedArts = new Map(argv.flatMap((a, i) => argv[i - 1] === "--article" ? [a.split("=")] : []));

async function get(url) {
  if (url === TOPIC && opt("--topic")) return fs.readFileSync(opt("--topic"), "utf8");
  if (savedArts.has(url)) return fs.readFileSync(savedArts.get(url), "utf8");
  const dw = opt("--dw");
  const idp = url.match(/dwcdn\.net\/([A-Za-z0-9]+\/\d+)/)?.[1];
  if (dw && idp) {
    const name = idp.split("/")[0];
    return fs.readFileSync(path.join(dw, `${name}${url.endsWith("dataset.csv") ? ".tsv" : ".html"}`), "utf8");
  }
  const r = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36", "accept-language": "en-AU" },
  });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

export const pct = (c) => (c == null || String(c).trim() === "" || isNaN(parseFloat(c)) ? null : Math.round(parseFloat(c)));
export const metaOf = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i"));
  if (!m) return null;
  return m[1].replace(/&quot;/g, '"').replace(/&#039;|&#39;|&rsquo;/g, "’").replace(/&amp;/g, "&");
};
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-]?\d*$/i;

/* Charts this pipeline already consumes elsewhere (never topical one-offs) */
export const modelledReason = (t) => {
  const firsts = t.rows.map((r) => (r[0] || "").toLowerCase());
  if (/likeab/i.test(t.head.join(" "))) return "likeability (resolve-article-read's lane)";
  if (firsts.some((x) => /^(total\s+)?good$/.test(x)) && firsts.some((x) => /^(total\s+)?poor$/.test(x)))
    return "performance table (resolve-article-read's lane)";
  return null;
};

/* Deterministic series keys: chart headline/question → store id. Extend one
   line per recurring chart family as waves recur; the verifier guards the
   rest. (test-resolve-oneoffs-file pins each entry.) */
export const SERIES_SEED = [
  { id: "cost-of-living-blame", when: (t, q) => /responsib\w*[^.]{0,40}living costs/i.test(`${t} ${q}`) },
];

/* t = {head, rows} from the dataset. Trend tables (month-headed columns)
   project to the wave's column; crosstabs file every column. Mutates `extra`
   with {trendPrev, firstAsked} for the notes. */
export function shapeTable(t, waveDate, extra) {
  const head = t.head.slice();
  const monthCols = head.slice(1).filter((h) => MONTH_RE.test(String(h).trim())).length;
  if (head.length >= 3 && monthCols >= 2) {
    let c = head.length - 1;
    while (c > 0 && !t.rows.some((r) => String(r[c] ?? "").trim() !== "")) c -= 1;
    if (c === 0) return { rows: [], why: "no figures in any column" };
    const mon = MONTH_SHORT[new Date(waveDate).getUTCMonth()];
    const curName = String(head[c]).trim();
    if (!new RegExp(`^${mon}`, "i").test(curName))
      return { rows: [], why: `last non-empty column "${curName}" is not ${mon} (the wave’s month) – the dataset is behind` };
    let prev = c - 1;
    while (prev > 0 && !t.rows.some((r) => String(r[prev] ?? "").trim() !== "")) prev -= 1;
    extra.trendPrev = prev > 0 && prev !== c ? String(head[prev]).trim() : null;
    for (const r of t.rows) {
      if (r[0] && String(r[c] ?? "").trim() !== "" && (prev === 0 || String(r[prev] ?? "").trim() === ""))
        (extra.firstAsked ??= []).push(cleanLabel(r[0]));
    }
    extra.prevCol = prev > 0 ? prev : null;
    extra.curCol = c;
    return { rows: t.rows.map((r) => [cleanLabel(r[0]), pct(r[c])]), headers: null, why: null, tPrev: extra.trendPrev, prevVals: prev > 0 ? t.rows.map((r) => [cleanLabel(r[0]), pct(r[prev])]) : null };
  }
  return { rows: t.rows.map((r) => [cleanLabel(r[0]), ...r.slice(1, head.length).map(pct)]), headers: null, why: null, tPrev: null, prevVals: null };
}

/* strip the publisher's footnote carets off labels ("AI data centre
   construction^" → "AI data centre construction"); the note is compiler-carried */
export const cleanLabel = (s) => String(s ?? "").replace(/\^+\s*$/, "").trim();
export const dedupeRows = (rows) => {
  const seen = new Set(), out = [];
  for (const r of rows) {
    if (!r[0] || seen.has(r[0])) continue;
    seen.add(r[0]);
    out.push(r);
  }
  return out;
};

export const checks = (rows) => {
  if (!rows.length || rows.every((r) => r.slice(1).every((v) => v == null))) return "no figures";
  for (const r of rows)
    for (const v of r.slice(1))
      if (v != null && !(v >= 0 && v <= 100)) return `value ${v} out of 0–100`;
  return null;
};

export const sumNote = (rows, headers) => {
  if (!headers) {
    const s = rows.reduce((a, r) => a + (r[1] ?? 0), 0);
    return s !== 100 ? `The responses sum to ${s} per cent from rounding.` : null;
  }
  const bits = [];
  for (let c = 1; c < headers.length; c++) {
    const s = rows.reduce((a, r) => a + (r[c] ?? 0), 0);
    if (s !== 100 && rows.some((r) => r[c] != null)) bits.push(`the ${headers[c]} column sums to ${s}`);
  }
  return bits.length ? `Column sums differ from 100 from rounding (${bits.join("; ")}).` : null;
};

export const trendNote = (rows, prevVals, prevHead) => {
  if (!prevVals || !prevHead) return null;
  let best = null;
  for (const [i, r] of rows.entries()) {
    const prev = prevVals[i]?.[1];
    if (r[1] == null || prev == null) continue;
    const d = r[1] - prev;
    if (!best || Math.abs(d) > Math.abs(best.d)) best = { l: r[0], d, prev, cur: r[1] };
  }
  if (!best || best.d === 0) return null;
  const dir = best.d < 0 ? `eased ${-best.d} points from` : `rose ${best.d} points from`;
  return `${best.l} ${dir} ${best.prev} per cent in ${prevHead} (now ${best.cur}).`;
};

async function readPrompt() {
  return fs.readFileSync(path.join(HERE, "resolve-oneoffs-read-prompt.md"), "utf8");
}

/* Deterministic gate on an LLM verdict: shape checks, theme/id rules, and
   the notes-numeral poison test (rule 6: any numeral the notes mention must
   be verbatim in the evidence; on violation the notes drop, never rewrite). */
export function verifyVerdict(verdict, evidenceText, storeIds) {
  if (verdict?.kind === "skip") return { verdict: "skip", why: verdict.reason || "not a topical one-off" };
  const bad = (w) => ({ verdict: null, why: w });
  if (typeof verdict !== "object" || verdict === null || verdict.kind !== "file") return bad("verdict missing kind:file");
  const { id, themeId, question, notes } = verdict;
  if (typeof id !== "string" || !KEBAB.test(id)) return bad(`id "${id}" not kebab-case`);
  if (storeIds.has(id)) return bad(`id "${id}" already exists in the store`);
  if (!THEMES.some((t) => t.id === themeId)) return bad(`themeId "${themeId}" not a theme`);
  if (typeof question !== "string" || question.length < 8 || question.length > 240) return bad("question unusable");
  let cleanNotes = typeof notes === "string" ? notes.trim() : "";
  if (cleanNotes.length > 1000) cleanNotes = "";
  const numsOf = (s) => new Set((s.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => x.replace(/,/g, "")));
  const evNums = numsOf(evidenceText);
  for (const n of numsOf(cleanNotes)) {
    if (!evNums.has(n)) { cleanNotes = ""; break; }
  }
  return { verdict: { id, themeId, question: question.trim(), notes: cleanNotes || null }, why: null };
}

/* The LLM lane: ask for organising metadata only (no figures — those are
   already bound from the dataset), then verify deterministically. */
function llmEntry(evidenceText, { prompt, storeIds }) {
  if (!matildaCli()) return { verdict: null, why: "no CLI (deterministic-only run)" };
  let verdict = null;
  try {
    verdict = askMatildaJson(prompt, { wall: "3m", tools: 3 });
  } catch (e) {
    return { verdict: null, why: `matilda: ${e.message}` };
  }
  return verifyVerdict(verdict, evidenceText, storeIds);
}

async function main() {
  const storeRaw = fs.readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(storeRaw);
  const themesRaw = fs.readFileSync(THEMES_PATH, "utf8");
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const rows = D.polls.filter((p) => p.pollster === "Resolve");
  const covered = new Set(store.entries.map((e) => e.waveDate));
  const pending = rows.filter((p) => !covered.has(p.date) && !NO_TOPICALS.has(p.date) && (!WAVE || p.date === WAVE));
  const status = { filed: [], skipped: [], flagged: [], warnings: [], applied: false };
  if (!pending.length) { console.log("RESOLVE_ONEOFF_STATUS " + JSON.stringify(status)); return; }

  const stories = storiesOf(await get(TOPIC));
  const storeIds = new Set(store.entries.map((e) => e.id));
  let storeChanged = false;
  const newThemes = [];
  let promptMemo = null;

  for (const row of pending) {
    const pubDay = (row.published ?? new Date(Date.parse(row.date) + DAY).toISOString()).slice(0, 10);
    const cands = stories.filter((s) => s.day === pubDay);
    let story = null, text = "", dwIds = [];
    for (const s of cands) {
      try {
        const html = await get(s.url);
        const t = textOf(html);
        if (!/Resolve Political Monitor/i.test(t)) continue;
        if (!story) { story = { ...s, html }; text = t; } else text += " " + t;
        dwIds.push(...(html.match(/datawrapper\.dwcdn\.net\/[A-Za-z0-9]+\/\d+/g) || []));
      } catch (e) { status.warnings.push(`${s.url}: ${e.message}`); }
    }
    dwIds = [...new Set(dwIds)];
    if (!story) {
      status.warnings.push(`Resolve ${row.date}: no SMH story dated ${pubDay} found; tripwire stands`);
      continue;
    }
    if (!dwIds.length) {
      status.warnings.push(`Resolve ${row.date}: ${story.url} embeds no datawrapper charts; if it carries no topical questions the wave belongs in NO_TOPICALS in resolve-oneoffs.mjs`);
      continue;
    }

    let waveFiled = false;
    for (const idp of dwIds) {
      const chartId = idp.split("/").at(-2);
      const tag = `${row.date} ${chartId}`;
      let t, title = "", cnQ = "";
      try {
        const page = await get(`https://datawrapper.dwcdn.net/${idp}/`);
        title = metaOf(page, "og:title") ?? "";
        cnQ = (metaOf(page, "og:description") ?? "").replace(/^Q:\s*/i, "");
        t = dwTable(await get(`https://datawrapper.dwcdn.net/${idp}/dataset.csv`));
      } catch (e) { status.warnings.push(`${tag}: ${e.message}`); continue; }
      const skip = modelledReason(t);
      if (skip) { status.skipped.push({ wave: row.date, chart: chartId, title, why: skip }); continue; }
      const extra = { trendPrev: null, firstAsked: null, prevCol: null, curCol: null };
      const shaped = shapeTable(t, row.date, extra);
      if (shaped.why) { status.flagged.push({ wave: row.date, chart: chartId, title, why: shaped.why }); continue; }
      const rowsOut = dedupeRows(shaped.rows);
      const badRows = checks(rowsOut);
      if (badRows) { status.flagged.push({ wave: row.date, chart: chartId, title, why: badRows }); continue; }
      const headers = t.head.length > 2 && shaped.tPrev == null && rowsOut.some((r) => r.length === t.head.length)
        ? ["", ...t.head.slice(1)] : null;

      const seed = SERIES_SEED.find((s) => s.when(title, cnQ));
      let meta = null, from = "deterministic";
      if (seed && storeIds.has(seed.id)) {
        if (!(cnQ || title)) { status.flagged.push({ wave: row.date, chart: chartId, title, why: "chart carries no question text or title" }); continue; }
        meta = { id: seed.id, themeId: null, question: (cnQ || title).slice(0, 240), notes: null };
      } else {
        const evidence = JSON.stringify({
          chartTitle: title, chartQuestion: cnQ,
          dataset: { head: t.head, rows: t.rows.slice(0, 30) },
          article: text.slice(0, 3500),
          wave: { date: row.date, dateStart: row.dateStart ?? null, sample: row.sample ?? null, url: row.url ?? story.url },
          themes: THEMES.map((x) => `${x.id} – ${x.title}`),
          existingIds: [...storeIds],
        });
        const prompt = promptMemo ?? (promptMemo = await readPrompt());
        const r = llmEntry(`${title} ${cnQ} ${JSON.stringify(t.rows)} ${text.slice(0, 3500)}`,
          { prompt: prompt.replace("<EVIDENCE>", evidence), storeIds });
        if (r.verdict === "skip") { status.skipped.push({ wave: row.date, chart: chartId, title, why: r.why }); continue; }
        if (!r.verdict) { status.flagged.push({ wave: row.date, chart: chartId, title, why: r.why }); continue; }
        meta = r.verdict; from = "llm";
        newThemes.push({ id: meta.id, themeId: meta.themeId });
      }

      const notesBits = [meta.notes];
      const rn = sumNote(rowsOut, headers);
      if (rn) notesBits.push(rn);
      const tn = trendNote(rowsOut, shaped.prevVals, shaped.tPrev);
      if (tn) notesBits.push(tn);
      if (extra.firstAsked?.length) notesBits.push(`'${extra.firstAsked.join("', '")}' was asked for the first time.`);
      const entry = {
        id: meta.id,
        waveDate: row.date,
        dateStart: row.dateStart ?? null,
        dateEnd: row.date,
        published: row.published ?? null,
        sample: row.sample ?? null,
        sampleEff: row.sampleEff ?? null,
        url: row.url ?? story.url,
        question: meta.question,
        notes: notesBits.filter(Boolean).join(" ") || null,
        tables: [{ title: null, source: row.url ?? story.url, headers, rows: rowsOut }],
      };
      store.entries.push(entry);
      storeIds.add(entry.id);
      storeChanged = true;
      waveFiled = true;
      status.filed.push({ wave: row.date, id: entry.id, from, chart: chartId });
    }
    if (waveFiled) covered.add(row.date);
  }

  if (storeChanged) {
    store.generated = [...new Set(store.entries.map((e) => e.waveDate))].sort().at(-1);
    const latestWave = rows.at(-1).date;
    store._about = store._about
      .replace(/the \d+ Resolve waves on file/, `the ${rows.length} Resolve waves on file`)
      .replace(/latest: \d{4}-\d{2}-\d{2}/, `latest: ${latestWave}`);
    let themesNext = themesRaw;
    for (const { id, themeId } of newThemes) {
      if (themesNext.includes(`"${id}"`)) continue;
      const start = themesNext.indexOf(`\n  /* ${themeId} */`);
      if (start < 0) { status.warnings.push(`THEME_OF: no anchor for theme ${themeId} (id ${id}); mapping unwritten`); status.flagged.push({ id, why: "theme mapping unwritten" }); continue; }
      const end = themesNext.indexOf("\n  /* ", start + 1);
      const block = themesNext.slice(start, end === -1 ? themesNext.length : end);
      const nl = block.lastIndexOf(",\n");
      if (nl < 0) { status.warnings.push(`THEME_OF: theme ${themeId} block has no mapping line for id ${id}`); continue; }
      const replaced = block.slice(0, nl + 2) + `  "${id}": "${themeId}",\n` + block.slice(nl + 2);
      themesNext = themesNext.slice(0, start) + replaced + themesNext.slice(end === -1 ? themesNext.length : end);
    }
    if (APPLY) {
      writeAtomic(STORE_PATH, JSON.stringify(store, null, 2) + "\n");
      if (themesNext !== themesRaw) writeAtomic(THEMES_PATH, themesNext);
      const v = spawnSync("node", [path.join(HERE, "resolve-oneoffs.mjs")], { encoding: "utf8" });
      if (v.status !== 0) {
        writeAtomic(STORE_PATH, storeRaw);
        writeAtomic(THEMES_PATH, themesRaw);
        status.warnings.push(`guard revalidation tripped, store rolled back: ${(v.stderr || "").trim().split("\n")[0]}`);
        status.filed = [];
      } else {
        status.applied = true;
      }
    }
  }
  console.log("RESOLVE_ONEOFF_STATUS " + JSON.stringify(status));
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  main().catch((e) => {
    console.log("RESOLVE_ONEOFF_STATUS " + JSON.stringify({ filed: [], skipped: [], flagged: [], warnings: [`filer failed: ${e.message}`], applied: false }));
    process.exit(1);
  });
}
