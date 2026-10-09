#!/usr/bin/env node
// Newspoll (pooled) QUARTERLY aggregate extractor — the absence that built the
// reminders watch (21c2e99): The Australian publishes one pooled wave a
// quarter (n≈5,000, the full nine-dimension subpopulation table) and the
// hand-entered NEWSPOLL_DEMO blocks in demographics.mjs can never trip an
// alarm when one is missed (the Apr–Jun 2026 quarter sat unentered three
// months). This module discovers the quarter, reads its demographics from
// the two deterministic surfaces, and files BOTH the NO_AGG "Newspoll
// (pooled)" polls.json row and the data/newspoll-quarterly.json demographics
// source (consumed by demographics.mjs, NEWSPOLL_DEMO keys win). Surfaces,
// per the 2026 quarters:
//   * the article's own Infogram "Primary vote by …" multi-sheet table
//     (e.infogram.com/_/<id> — anonymous; sheetnames [State, Sex, Age,
//     Education, Household Income, Working Status, Language at home,
//     Religion, Housing], party rows, the State sheet's All column = the
//     published national total); Q2/Q3 2026 were Infogram-only, and
//   * the open full-tables PDF on the origin CDN
//     (origin.theaustralian.com.au/wp-content/uploads/<yyyy>/<mm> of the
//     PUBLISHED month — Q1 2026: …/2026/04/newspoll5april2026.pdf), whose
//     PRIMARY VOTE block carries ALL + 26 group columns and whose footer
//     carries the fieldwork window and n.
// Embed ids and the published clock come from the article body — The
// Australian's pages are pay+bot-walled for us, so the body rungs are MSN's
// content-view JSON (free, CI-safe) then, on the laptop, the user's Chrome
// (.build/chrome-article.mjs, NEWSIE_CHROME). The PDF rung needs no body.
// Contract: last stdout line NPQ_STATUS {json}; exit 0 ok / 1 fetch-parse
// error / 2 guard trip (nothing written). No exit-3 hand-entry prompt: a
// trip surfaces via the wrapper log and the 10-day pooled key-match /
// 110-day cadence reminders (demo-watch.mjs) into the NEWSPOLL_DEMO manual
// path. `--check` mutates nothing (recon still runs). Waves this extractor
// files are re-parsed from their recorded source every run (drift = guard,
// never a rewrite); NEWSPOLL_DEMO-owned waves only get the read-only recon
// NOTE against data/demographics.json.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { infographicDataOf } from "./infogram.mjs";
import { fetchText, MONTHS, clean, writeAtomic, melbourneMinute } from "./extract-common.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DAY = 864e5;
const LIB_MODE = !process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url);

export const POOLSTER = "Newspoll (pooled)";
export const NPQ = {
  SAMPLE_MIN: 3000, SAMPLE_MAX: 7000,     // pooled quarters seen: 3811–4967
  SPAN_MIN_DAYS: 45, SPAN_MAX_DAYS: 130,  // quarter windows seen: 74–110d
  LAG_MAX_DAYS: 21,                       // fieldwork end → published
};

// ------------------------------------------------------------------ dates
const MONTH_NAMES = Object.keys(MONTHS).filter((k) => k.length > 3);
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function proseDate(text, anchorIso) {
  const m = /([A-Z][a-z]+)\.?\s+(\d{1,2})\b/.exec(text);
  if (!m || MONTHS[m[1].toLowerCase()] == null) return null;
  const y = +(anchorIso || new Date().toISOString()).slice(0, 4);
  let d = iso(y, MONTHS[m[1].toLowerCase()], +m[2]);
  if (anchorIso && d > anchorIso) d = iso(y - 1, MONTHS[m[1].toLowerCase()], +m[2]);
  return d;
}

// "between January 12 and March 26" / "between 13 July and 18 September".
export function proseWindow(text, anchorIso) {
  const m = /between\s+(?:the\s+)?([A-Z][a-z]+\.?\s+\d{1,2}|\d{1,2}\s+[A-Z][a-z]+)\s+and\s+([A-Z][a-z]+\.?\s+\d{1,2}|\d{1,2}\s+[A-Z][a-z]+)/.exec(text);
  if (!m) return null;
  const norm = (s) => (/^\d/.test(s) ? s.replace(/^(\d{1,2})\s+([A-Z][a-z]+\.?)$/, "$2 $1") : s);
  const end = proseDate(norm(m[2]).replace(/\./, ""), anchorIso);
  const start = end && proseDate(norm(m[1]).replace(/\./, ""), end);
  return start && start < end ? { start, end } : null;
}

export function proseSample(text) {
  const m = /with\s+([\d,]{4,})\s+voters|sample\s+of\s+([\d,]{4,})|\bn\s*=\s*([\d,]{4,})/.exec(text);
  return m ? +((m[1] ?? m[2] ?? m[3]).replace(/,/g, "")) : null;
}

// ------------------------------------------------- label maps (print→canon)
export const PARTY_OF = {
  "labor": "alp", "coalition": "lnp", "greens": "grn",
  "pauline hanson's one nation": "onp", "one nation": "onp", "others": "oth",
};
export const SHEET_DIM = {
  "State": "state", "Sex": "gender", "Age": "age", "Education": "education",
  "Household Income": "income", "Working Status": "working",
  "Language at home": "language", "Religion": "religion", "Housing": "housing",
};
const GROUP_LABEL = {
  "male": "Men", "female": "Women", "vic": "Vic", "qld": "Qld",
  "tafe / college": "TAFE", "tafe/ technical": "TAFE",
  "<$50k": "Under $50k", "$50k - $99k": "$50–99k", "$100k - $149k": "$100–149k",
  "other / not working": "Other", "speak other language": "Other language",
  "owned outright": "Own outright", "owned with mortgage": "Mortgage", "rented": "Renting",
};
export function tidyGroup(label) {
  const s = String(label ?? "").trim();
  if (!s) return "";
  return GROUP_LABEL[s.toLowerCase()] ?? s.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
}

// key-order-insensitive compare for recon (generated files reorder keys).
const canon = (o) => JSON.stringify(o, (k, v) =>
  (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

// ---------------------------------------------------- Infogram table parse
// The quarterly table is the ONE chart in a story whose sheetnames are our
// dims and whose rows are party names — the Q3 article carried four embeds
// and exactly one matched. Identified by shape, never position.
export function quarterlyChartsOf(data) {
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    const cd = o.chartData;
    if (Array.isArray(cd?.sheetnames) && cd.sheetnames.length >= 5 && Array.isArray(cd.data) && cd.data.length === cd.sheetnames.length) {
      const names = cd.sheetnames.map((s) => String(s));
      if (names.every((n) => SHEET_DIM[n]) && names.includes("State")) out.push(cd);
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

export function parseQuarterlyEmbed(html) {
  const data = infographicDataOf(html);
  if (!data) return null;
  const charts = quarterlyChartsOf(data);
  if (charts.length !== 1) return null; // 0 = not here; >1 = ambiguous layout
  const cd = charts[0];
  const dims = {};
  let total = null;
  for (let s = 0; s < cd.sheetnames.length; s++) {
    const dim = SHEET_DIM[String(cd.sheetnames[s])];
    const sheet = cd.data[s];
    if (!dim || !Array.isArray(sheet) || sheet.length < 2) return null;
    const header = sheet[0].map((c) => tidyGroup(c?.value ?? c ?? ""));
    for (const row of sheet.slice(1)) {
      const label = String(row[0]?.value ?? row[0] ?? "").trim();
      const party = PARTY_OF[label.toLowerCase()];
      if (!party) return null; // an unrecognised row = a table we don't know
      row.slice(1).forEach((cell, i) => {
        const g = header[i + 1];
        if (!g) return;
        const raw = String(cell?.value ?? cell ?? "").trim();
        if (raw === "") return;
        const v = +raw;
        if (!Number.isFinite(v)) return;
        if (g === "All") { (total ??= {})[party] = v; return; }
        ((dims[dim] ??= {})[g] ??= {})[party] = v;
      });
    }
  }
  return total ? { total, dims } : null;
}

// ---------------------------------------------------------- tables-PDF parse
// One known layout (Q1 2026): PRIMARY VOTE block, header wrapped over three
// lines, five party rows of ALL + 26 group values. Positional — a different
// group count never matches (housing arrives that way if a future PDF
// prints it), so a layout change trips the guard instead of misfiling.
export const PDF_GROUPS = [
  ["state", ["NSW", "Vic", "Qld", "SA", "WA"]],
  ["gender", ["Men", "Women"]],
  ["age", ["18–34", "35–49", "50–64", "65+"]],
  ["education", ["No tertiary", "TAFE", "University"]],
  ["income", ["Under $50k", "$50–99k", "$100–149k", "$150k+"]],
  ["working", ["Full time", "Part time", "Retired", "Other"]],
  ["language", ["English only", "Other language"]],
  ["religion", ["Christian", "No religion"]],
];
const PDF_PARTIES = [["Labor", "alp"], ["Coalition", "lnp"], ["Greens", "grn"], ["One Nation", "onp"], ["Others", "oth"]];

export function parseTablesPdf(text) {
  const i = text.indexOf("PRIMARY VOTE");
  if (i < 0) return null;
  const block = text.slice(i, i + 4000);
  if (!["NSW", "Female", "65+", "University", "$150k+", "Retired", "Christian"].every((p) => block.includes(p))) return null;
  const nGroups = PDF_GROUPS.reduce((a, [, gs]) => a + gs.length, 0);
  const rows = {};
  for (const [printed, key] of PDF_PARTIES) {
    const m = new RegExp(`^${printed}\\s+((?:\\d+\\s+){${nGroups + 1}})`, "m").exec(block);
    if (!m) return null;
    rows[key] = m[1].trim().split(/\s+/).map(Number);
    if (rows[key].some((v) => !Number.isFinite(v))) return null;
  }
  const total = {}, dims = {};
  const flat = PDF_GROUPS.flatMap(([dim, gs]) => gs.map((g) => [dim, g]));
  for (const [, p] of PDF_PARTIES) {
    total[p] = rows[p][0];
    rows[p].slice(1).forEach((v, j) => {
      const [dim, g] = flat[j];
      ((dims[dim] ??= {})[g] ??= {})[p] = v;
    });
  }
  return { total, dims };
}

// ------------------------------------------------------------------ guards
export function guardWave(w) {
  const s = w.total.alp + w.total.lnp + w.total.grn + w.total.onp + w.total.oth;
  if (!(s >= 98 && s <= 102)) return `primaries sum ${s}`;
  if (w.sample != null && (w.sample < NPQ.SAMPLE_MIN || w.sample > NPQ.SAMPLE_MAX))
    return `sample ${w.sample} outside ${NPQ.SAMPLE_MIN}–${NPQ.SAMPLE_MAX}`;
  if (w.dateStart) {
    const span = (Date.parse(w.date) - Date.parse(w.dateStart)) / DAY;
    if (!(span >= NPQ.SPAN_MIN_DAYS && span <= NPQ.SPAN_MAX_DAYS))
      return `field span ${span}d outside ${NPQ.SPAN_MIN_DAYS}–${NPQ.SPAN_MAX_DAYS}`;
  }
  const pub = (w.published ?? "").slice(0, 10);
  if (pub) {
    const lag = (Date.parse(pub) - Date.parse(w.date)) / DAY;
    if (!(lag >= 0 && lag <= NPQ.LAG_MAX_DAYS)) return `release lag ${lag}d outside 0–${NPQ.LAG_MAX_DAYS}`;
  }
  if (!w.dims.state) return "no state sheet";
  for (const [dim, groups] of Object.entries(w.dims))
    for (const [g, sh] of Object.entries(groups)) {
      const t = (sh.alp ?? 0) + (sh.lnp ?? 0) + (sh.grn ?? 0) + (sh.onp ?? 0) + (sh.oth ?? 0);
      if (t < 95 || t > 105) return `${dim} ${g} sums ${t}`;
    }
  return null;
}

// blind uploads probes for the wave's PUBLISHED month (skill
// auspol-newspoll-tables-pdf: folder = published month, never fieldwork).
export function probeNames(pubDay) {
  const [y, mo, d] = pubDay.slice(0, 10).split("-").map(Number);
  const month = MONTH_NAMES[mo - 1];
  const cap = month[0].toUpperCase() + month.slice(1);
  return [...new Set([
    `newspoll${d}${month}${y}.pdf`, `Newspoll_${d}_${cap}_${y}.pdf`,
    "Newspoll.pdf", `newspoll${month}${y}.pdf`, `Newspoll_${cap}_${y}.pdf`,
  ])].map((n) => `https://origin.theaustralian.com.au/wp-content/uploads/${y}/${pad(mo)}/${n}`);
}

// ----------------------------------------------------------- runtime deps
// Everything side-effecting flows through ctx so the test runs the real
// pipeline in a sandbox with fixture-backed fakes and an injected clock.
function defaultCtx() {
  return {
    pollsPath: path.join(ROOT, "data", "polls.json"),
    outPath: path.join(ROOT, "data", "newspoll-quarterly.json"),
    demographicsPath: path.join(ROOT, "data", "demographics.json"),
    srcDir: path.join(ROOT, ".build", "newspoll-quarterly-src"),
    writeFiles: !process.argv.includes("--check"),
    nowIso: new Date().toISOString(),
    fetchText: async (url) => (await fetchText(url)).text,
    fetchBuffer: async (url) => Buffer.from(await (await fetch(url)).arrayBuffer()),
    headOk: async (url) => { try { return (await fetch(url, { method: "HEAD" })).ok; } catch { return false; } },
    pdfText: (buf, slug) => pdfToText(buf, slug),
    chrome: (url) => {
      if (!process.env.NEWSIE_CHROME) return null;
      try {
        return execFileSync("node", [path.join(HERE, "chrome-article.mjs"), url],
          { encoding: "utf8", maxBuffer: 1 << 26, timeout: 120000 });
      } catch { return null; }
    },
  };
}

function pdfToText(buf, slug) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "npq-"));
  const f = path.join(tmp, slug + ".pdf");
  try {
    fs.writeFileSync(f, buf);
    for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
      try { return execFileSync(bin, ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 1 << 24 }); }
      catch (e) { if (e.code !== "ENOENT") throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 160)}`); }
    }
    throw new Error("pdftotext (poppler) not found on PATH");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ------------------------------------------------------------- discovery
async function discover(ctx, latestPooled) {
  const out = [];
  try {
    const rss = await ctx.fetchText("https://www.bing.com/news/search?q=newspoll+quarterly&format=rss&mkt=en-AU");
    for (const m of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const title = /<title>([\s\S]*?)<\/title>/.exec(m[1])?.[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
      const link = /<link>([\s\S]*?)<\/link>/.exec(m[1])?.[1].trim() ?? "";
      const pub = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(m[1])?.[1].trim() ?? "";
      let url = link;
      const q = /[?&]url=([^&]+)/.exec(link);
      if (q && /\bbing\b/.test(new URL(link, "https://www.bing.com").hostname)) url = decodeURIComponent(q[1]);
      if (/quarter/i.test(title) && url) out.push({ title, url, pubIso: pub ? new Date(pub).toISOString() : null });
    }
  } catch { /* a discovery rung down degrades to the others, never fatal */ }
  try {
    const j = JSON.parse(await ctx.fetchText("https://pollbludger.net/wp-json/wp/v2/search?search=Newspoll&per_page=20"));
    for (const it of j) if (/quarter/i.test(it.title ?? "") && it.url) out.push({ title: it.title, url: it.url, pubIso: null });
  } catch { /* same */ }
  const fresh = (c) => !latestPooled || !c.pubIso || c.pubIso.slice(0, 10) >= latestPooled;
  return out.filter((c) => fresh(c) && /theaustralian\.com\.au|msn\.com|pollbludger\.net|news\.com\.au|skynews\.com\.au/.test(c.url));
}

async function bodyOf(ctx, url) {
  let body = null;
  if (/msn\.com/.test(url)) {
    const id = /\/ar-([\w]+)/.exec(url)?.[1];
    if (id) {
      try {
        const j = JSON.parse(await ctx.fetchText(`https://assets.msn.com/content/view/v2/Detail/en-au/${id}?disableEdgeCache=true`));
        body = Array.isArray(j.body) ? j.body.map((s) => s.content ?? "").join("\n") : String(j.body ?? "");
      } catch { body = null; }
    }
  }
  if (!body) { try { body = await ctx.fetchText(url); } catch { body = null; } }
  if (body && /<title>no cookies/i.test(body)) body = null;      // bot wall 200 page
  if (!body && /theaustralian\.com\.au/.test(url)) body = ctx.chrome(url); // laptop rung
  return body;
}

// embed ids: "_/<id>" URLs on e.infogram.com, or embed-div data-id — a
// data-id value may carry the "_/" prefix itself, so allow the slash.
export function bodyFacts(html, anchorIso) {
  if (!html) return {};
  const ids = [...new Set([
    ...[...html.matchAll(/e\.infogram\.com\/(_\/)?([A-Za-z0-9]+)/g)].map((m) => `${m[1] ?? ""}${m[2]}`),
    ...[...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]).filter((v) => /^(_\/)?[A-Za-z0-9_-]{4,}$/.test(v)),
  ])];
  const tables = [...html.matchAll(/https:\/\/origin\.theaustralian\.com\.au\/wp-content\/uploads\/[\d/]+[^"'\s]+\.pdf/g)][0]?.[0] ?? null;
  const pub = /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1]
    ?? /article:published_time[^>]+content="([^"]+)"/i.exec(html)?.[1] ?? null;
  const text = clean(html);
  return {
    ids, tables,
    published: pub ? melbourneMinute(new Date(pub)) : null,
    window: proseWindow(text, anchorIso), sample: proseSample(text),
  };
}

const readJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };

// ------------------------------------------------------------------- run
export async function run(overrides = {}) {
  const ctx = { ...defaultCtx(), ...overrides };
  const D = readJson(ctx.pollsPath, {});
  const rows = D.polls ?? [];
  const poolRows = rows.filter((p) => p.pollster === POOLSTER);
  const filedDates = new Set(poolRows.map((p) => p.date));
  const store = readJson(ctx.outPath, { waves: [] });
  store.waves ??= [];
  const notes = [], guarded = [], filed = [], healed = [], skippedExisting = [];
  let changed = false;

  // recon 1: every wave THIS extractor filed is re-parsed from its recorded
  // source and re-compared; drift is a guard (exit 2), never a rewrite.
  for (const w of store.waves) {
    try {
      let again = null;
      if (w.kind === "infogram" && w.ig) again = parseQuarterlyEmbed(await ctx.fetchText(`https://e.infogram.com/${w.ig}?src=embed`));
      else if (w.kind === "pdf" && w.tablesUrl) again = parseTablesPdf(ctx.pdfText(await ctx.fetchBuffer(w.tablesUrl), "npq-recon"));
      if (!again) return { guard: `recon ${w.date}: source no longer parses`, notes, exit: 2 };
      if (canon(again.total) !== canon(w.total) || canon(again.dims) !== canon(w.dims))
        return { guard: `recon ${w.date}: source figures drifted from the recorded wave`, notes, exit: 2 };
    } catch (e) { notes.push(`recon ${w.date}: ${String(e.message).slice(0, 120)}`); }
  }
  // recon 2 (read-only): NEWSPOLL_DEMO-owned pooled waves with a tablesUrl
  // on their polls.json row get the PDF re-parsed and compared against
  // data/demographics.json; divergence is an NPQ_NOTE, never a write.
  const demo = readJson(ctx.demographicsPath, { waves: [] });
  for (const p of poolRows) {
    if (!p.tablesUrl || store.waves.some((w) => w.date === p.date)) continue;
    try {
      const again = parseTablesPdf(ctx.pdfText(await ctx.fetchBuffer(p.tablesUrl), "npq-recon2"));
      const onFile = (demo.waves ?? []).find((w) => w.pollster === POOLSTER && w.date === p.date);
      if (again && onFile && (canon(again.total) !== canon(onFile.total) || canon(again.dims) !== canon(onFile.dims)))
        notes.push(`recon ${p.date}: live PDF and the recorded wave disagree`);
    } catch { /* the origin CDN serving a stale 404 for a while is not news */ }
  }

  const latestPooled = poolRows.map((p) => (p.published ?? p.date).slice(0, 10)).sort().pop() ?? null;
  for (const c of await discover(ctx, latestPooled)) {
    const pubDay = (c.pubIso ?? "").slice(0, 10);
    const body = await bodyOf(ctx, c.url);
    const facts = body ? bodyFacts(body, pubDay || ctx.nowIso.slice(0, 10)) : {};
    let wave = null;

    // rung 1: full-tables PDF (body-linked, else blind probe of its month)
    let pdfUrl = facts.tables ?? null;
    if (!pdfUrl && pubDay) for (const u of probeNames(pubDay)) { if (await ctx.headOk(u)) { pdfUrl = u; break; } }
    if (pdfUrl) {
      try {
        const text = ctx.pdfText(await ctx.fetchBuffer(pdfUrl), "np-quarterly");
        // Window anchor ladder: the discovery item's date, the article's
        // published clock, then the PDF's own upload month (a y/m is in
        // the CDN path — undated discovery items must not mis-year the
        // year-less "between M d and M d" footer and thereby skip dedupe).
        const up = /uploads\/(\d{4})\/(\d{2})\//.exec(pdfUrl);
        const uploadAnchor = up ? `${up[1]}-${up[2]}-28` : null;
        const win = proseWindow(text, pubDay || facts.published || uploadAnchor || ctx.nowIso.slice(0, 10)) ?? facts.window ?? null;
        // Date-known dedupe BEFORE the guards: a stale discovery item for
        // an already-filed wave must not re-enter the guard path (the 2025
        // quarterly PDFs legitimately print a two-party table – guarded
        // on new filings, but expected on those older rows).
        if (win?.end && filedDates.has(win.end)) {
          skippedExisting.push(`${POOLSTER}|${win.end}`);
          const ex = rows.find((p) => p.pollster === POOLSTER && p.date === win.end);
          const n = proseSample(text) ?? facts.sample ?? null;
          if (ex?.samplePending && n != null
            && n >= NPQ.SAMPLE_MIN && n <= NPQ.SAMPLE_MAX && ctx.writeFiles) {
            ex.sample = n; delete ex.samplePending;
            changed = true; healed.push(`${POOLSTER}|${win.end}`);
          }
          continue;
        }
        const parsed = parseTablesPdf(text);
        if (!parsed) return { guard: `pdf ${pdfUrl}: PRIMARY VOTE block unreadable`, notes, exit: 2 };
        if (/TWO.?PARTY|PREFERRED VOTE/i.test(text)) { guarded.push(`${pdfUrl}: a two-party table printed – the parser only files primaries`); continue; }
        wave = {
          date: win?.end ?? null, dateStart: win?.start ?? null,
          published: facts.published ?? (pubDay || null),
          sample: proseSample(text) ?? facts.sample ?? null,
          total: parsed.total, dims: parsed.dims, kind: "pdf", source: pdfUrl,
        };
      } catch (e) { notes.push(`pdf ${pdfUrl}: ${String(e.message).slice(0, 120)}`); }
    }

    // rung 2: the article's own Infogram embeds (body rung only)
    if (!wave && facts.ids?.length) {
      for (const id of facts.ids) {
        let parsed = null;
        try { parsed = parseQuarterlyEmbed(await ctx.fetchText(`https://e.infogram.com/${id}?src=embed`)); }
        catch { continue; }
        if (!parsed) continue;
        wave = {
          date: facts.window?.end ?? null, dateStart: facts.window?.start ?? null,
          published: facts.published ?? null,
          sample: facts.sample ?? null,
          total: parsed.total, dims: parsed.dims, kind: "infogram", ig: id, source: `https://e.infogram.com/${id}?src=embed`,
        };
        break;
      }
    }
    if (!wave || !wave.date) { if (body || pdfUrl) notes.push(`pending ${c.url}: no quarterly wave parsed`); continue; }

    const url = /theaustralian\.com\.au|msn\.com|news\.com\.au|skynews\.com\.au/.test(c.url) ? c.url
      : (wave.kind === "pdf" ? wave.source : c.url);
    const row = {
      date: wave.date,
      ...(wave.published ? { published: wave.published } : {}),
      ...(wave.dateStart ? { dateStart: wave.dateStart } : {}),
      pollster: POOLSTER, client: "The Australian",
      ...(wave.sample != null ? { sample: wave.sample } : { samplePending: true }),
      alp: wave.total.alp, lnp: wave.total.lnp, grn: wave.total.grn,
      onp: wave.total.onp, ind: wave.total.oth,
      oth: null, tpp_alp: null, tpp_lnp: null, url,
      ...(wave.kind === "pdf" ? { tablesUrl: wave.source } : {}),
    };

    const existing = filedDates.has(wave.date) && rows.find((p) => p.pollster === POOLSTER && p.date === wave.date);
    if (existing) {
      skippedExisting.push(`${POOLSTER}|${wave.date}`);
      if (existing.samplePending && wave.sample != null
        && wave.sample >= NPQ.SAMPLE_MIN && wave.sample <= NPQ.SAMPLE_MAX && ctx.writeFiles) {
        existing.sample = wave.sample; delete existing.samplePending;
        changed = true; healed.push(`${POOLSTER}|${wave.date}`);
      }
      continue;
    }

    const bad = guardWave(wave);
    if (bad) { guarded.push(`${url}: ${bad}`); continue; }

    if (ctx.writeFiles) {
      const at = rows.findIndex((p) => p.date > wave.date);
      rows.splice(at < 0 ? rows.length : at, 0, row);
      filedDates.add(wave.date);
      store.waves.push({
        date: wave.date, dateStart: wave.dateStart ?? null,
        published: wave.published ?? null,
        sample: wave.sample ?? null, samplePending: wave.sample == null,
        article: url, source: url,
        ...(wave.kind === "pdf" ? { tablesUrl: wave.source } : { ig: wave.ig }),
        kind: wave.kind, total: wave.total, dims: wave.dims,
      });
      store.waves.sort((a, b) => (a.date < b.date ? -1 : 1));
      changed = true;
    }
    filed.push(`${POOLSTER}|${wave.date}`);
  }

  if (changed && ctx.writeFiles) {
    store._about = "Built by .build/extract-newspoll-quarterly.mjs — Newspoll (pooled) quarterly aggregate figures, re-verified against source every run (drift = guard). Consumed by .build/demographics.mjs; NEWSPOLL_DEMO hand-entered keys win.";
    writeAtomic(ctx.outPath, JSON.stringify(store, null, 2) + "\n");
    writeAtomic(ctx.pollsPath, JSON.stringify(D, null, 2) + "\n");
  }
  return { changed, filed, healed, guarded, skippedExisting, notes, exit: 0 };
}

async function main() {
  const r = await run();
  for (const n of r.notes ?? []) console.log(`NPQ_NOTE ${n}`);
  if (r.guard) {
    console.error(`NPQ_GUARD ${r.guard}`);
    console.log(`NPQ_STATUS ${JSON.stringify({ changed: false, guard: r.guard, notes: r.notes })}`);
    return r.exit ?? 2;
  }
  for (const g of r.guarded ?? []) console.log(`NPQ_GUARD ${g}`);
  console.log(`NPQ_STATUS ${JSON.stringify({ changed: r.changed, filed: r.filed, healed: r.healed, guarded: r.guarded, skippedExisting: r.skippedExisting, notes: r.notes })}`);
  return r.exit ?? 0;
}

if (!LIB_MODE) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`NPQ_ERROR ${String(e?.stack || e).slice(0, 400)}`);
    console.log(`NPQ_STATUS ${JSON.stringify({ changed: false, error: String(e.message || e).slice(0, 200) })}`);
    process.exit(1);
  });
}
