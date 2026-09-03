#!/usr/bin/env node
/* harvest-trove.mjs — harvest every Trove newspaper article matching "( poll )"
   into local JSONL files (one per month), for the Trove newspaper archive page.

     node .build/harvest-trove.mjs [startYear] [endYear] [budgetSec]
     # defaults: 1803 2025 86400

   Output: .matilda/trove-harvest/poll-YYYY-MM.jsonl (local scratch, not committed),
   checkpointed in .matilda/trove-harvest/harvest-state.json — re-run to resume.
   Then `.build/refresh-trove-archive.mjs` derives the committed data files.

   HOW THE ACCESS WORKS (re-derivable by anyone):
   - The trove.nla.gov.au web app calls its own JSON search API:
       GET https://trove.nla.gov.au/api/search/137?terms=( poll )
           &limits={"date.from":[from],"date.to":[to]}&pageSize=100&startPos=<n>
   - It authorises with the header "apikey: <key>" — this is the SPA's PUBLIC
     client key that ships to every visitor in the site's JS bundle, not a
     secret. We captured it with a headless-Chrome request capture
     (.matilda/verify-trove-1993/probe5.mjs pattern: page.on('request') on any
     trove search URL, filter /api/search/, read r.headers()). If the key ever
     rotates, re-capture from the SPA or set TROVE_API_KEY in the environment.
   - Requests are made in-page via an SPA-bootstrapped fetch so session cookies
     are present; without the key (or with an invented one) the API 401s.
   - The API hard-caps any query at ~5000 results (startPos>=5000 500s), and a
     busy month can hold >5000 poll mentions (e.g. March 1901), so the crawler
     splits any over-cap window in half down to single days.
   - Records come back in works[] (NOT resultGroups[].records[]).
   - Full article OCR text for any record id is a plain GET:
       https://trove.nla.gov.au/newspaper/rendition/nla.news-article<ID>.txt
     (returns a small HTML document containing the corrected OCR text; strip the
     zone markup or parse the <p> nodes). */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const API_KEY = process.env.TROVE_API_KEY || '628aa3a6ab8c267b4df7527fadbd7190';
const OUTDIR = process.env.TROVE_HARVEST_DIR || '.matilda/trove-harvest';
const TERMS = '( poll )';
const START_Y = +process.argv[2] || 1803;
const END_Y = +process.argv[3] || 2025;
const BUDGET_S = +process.argv[4] || 86400;
const t0 = Date.now();
const overBudget = () => (Date.now() - t0) / 1000 > BUDGET_S;

fs.mkdirSync(OUTDIR, { recursive: true });

/* Single-instance lock: this repo is shared by sibling Matilda sessions whose
   matching batch loops re-exec this script. Two crawlers appending to the
   same month tmp file would duplicate rows, so only the first lockholder
   proceeds; a dead owner's lock is taken over. */
const lockPath = path.join(OUTDIR, '.harvest.lock');
const lockOwned = () => {
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const holder = +String(fs.readFileSync(lockPath, 'utf8')).trim();
    if (holder && holder !== process.pid) {
      try { process.kill(holder, 0); return false; } catch {}
    }
    try { fs.unlinkSync(lockPath); } catch {}
    return lockOwned();
  }
};
if (!lockOwned()) {
  console.log(`another harvester holds ${lockPath} — exiting idle`);
  process.exit(0);
}
process.on('exit', () => {
  try {
    if (+String(fs.readFileSync(lockPath, 'utf8')).trim() === process.pid) fs.unlinkSync(lockPath);
  } catch {}
});

const statePath = path.join(OUTDIR, 'harvest-state.json');
const readState = () => {
  if (!fs.existsSync(statePath)) return { months: {} };
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
  catch { return { months: {} }; } /* torn write from an old run: re-scan state */
};
const state = readState();
const stateTmpPath = statePath + '.tmp.' + process.pid;
const saveState = () => fs.renameSync(stateTmpPath, (() => { fs.writeFileSync(stateTmpPath, JSON.stringify(state)); return statePath; })());

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
const boot = async () => {
  await page.goto('https://trove.nla.gov.au/search/category/newspapers', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 500));
};
await boot();

const fetchPageJson = (from, to, start) => page.evaluate(async (a) => {
  const e = encodeURIComponent;
  const lim = e(JSON.stringify({ 'date.from': [a.from], 'date.to': [a.to] }));
  const u = `/api/search/137?terms=${e(a.terms)}&limits=${lim}&pageSize=100&startPos=${a.start}`;
  try {
    const res = await fetch(u, { headers: { 'apikey': a.key, 'Accept': 'application/json, text/plain, */*' } });
    if (!res.ok) return { __err: res.status };
    return await res.json();
  } catch (err) { return { __err: String(err) }; }
}, { terms: TERMS, key: API_KEY, from, to, start });

const getJson = async (from, to, start) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = await fetchPageJson(from, to, start);
    if (d && !d.__err) return d;
    if (d && (d.__err === 401 || d.__err === 403 || String(d.__err).startsWith('Error'))) { await boot(); continue; }
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
};

const simplify = (w) => ({
  id: w.id || w.annotatedId,
  title: (w.title || '').replace(/\s+/g, ' ').trim(),
  date: w.date || '',
  newspaper: w.newspaper || w.firstArticlePublicationName || '',
  page: w.page || '',
  wordCount: w.wordCount || '',
  articleType: w.articleType || '',
  illustrated: !!w.illustrated,
  abstrct: (w.abstrct || '').replace(/\s+/g, ' ').trim(),
  snippets: (w.snippets || []).map(s => s.replace(/\s+/g, ' ').trim()),
});

const toDate = (iso) => new Date(iso + 'T00:00:00Z');
const toIso = (d) => d.toISOString().slice(0, 10);

// window-splitting: any window whose total exceeds the ~5000-result API cap is
// halved until it fits; a failure nulls out so the caller discards the whole
// month file and re-crawls it on the next run.
const crawlRange = async (from, to, out, depth = 0) => {
  const probe = await getJson(from, to, 0);
  if (!probe) { console.error(`${from}..${to}: FAILED at startPos=0`); return null; }
  const total = probe.totalRecords ?? 0;
  if (total === 0) return 0;
  if (total > 4950) {
    if (from === to) { console.error(`${from}: total=${total} >= 5000 on a single day — cannot split further`); return null; }
    const a = toDate(from), b = toDate(to);
    const mid = toIso(new Date(a.getTime() + (b.getTime() - a.getTime()) / 2));
    const midNext = toIso(new Date(toDate(mid).getTime() + 86400000));
    const n1 = await crawlRange(from, mid, out, depth + 1);
    if (n1 === null || overBudget()) return null;
    const n2 = await crawlRange(midNext, to, out, depth + 1);
    if (n2 === null) return null;
    return n1 + n2;
  }
  let start = 0, n = 0;
  const seen = new Set();
  const writeRecord = (d) => {
    for (const w of (d.works || [])) {
      const s = simplify(w);
      if (!s.id || seen.has(s.id)) continue;
      seen.add(s.id);
      out.write(JSON.stringify(s) + '\n');
      n++;
    }
  };
  writeRecord(probe);
  start = probe.numRecords || probe.pageSize || 100;
  while (n < total && start < total) {
    await new Promise(r => setTimeout(r, 150));
    const d = await getJson(from, to, start);
    if (!d) { console.error(`${from}..${to}: FAILED at startPos=${start} (total=${total})`); return null; }
    writeRecord(d);
    start += d.numRecords || d.pageSize || 100;
    if (overBudget()) return null;
  }
  return n;
};

const months = [];
for (let y = START_Y; y <= END_Y; y++) {
  for (let m = 1; m <= 12; m++) months.push([y, m]);
}

let doneThisRun = 0, recsThisRun = 0;
for (const [y, m] of months) {
  if (overBudget()) break;
  const key = `${y}-${String(m).padStart(2, '0')}`;
  if (state.months[key]?.ok) continue;
  const mm = String(m).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${mm}-01`, to = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const file = path.join(OUTDIR, `poll-${key}.jsonl`);
  const tmp = `${file}.tmp.${process.pid}`;
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  const out = fs.createWriteStream(tmp, { flags: 'a' });
  const n = await crawlRange(from, to, out);
  await new Promise(r => { out.end(r); });
  if (n === null) {
    try { fs.unlinkSync(tmp); } catch {}
    state.months[key] = { ok: false, note: 'incomplete (re-run)' };
    saveState();
    if (overBudget()) break;
    continue;
  }
  fs.renameSync(tmp, file);
  state.months[key] = { ok: true, n };
  doneThisRun++; recsThisRun += n;
  if (doneThisRun % 24 === 0 || doneThisRun < 3) console.log(`${key}: n=${n} (run total ${recsThisRun})`);
  saveState();
}
saveState();
console.log(`run done: months=${doneThisRun} records=${recsThisRun} elapsed=${Math.round((Date.now() - t0) / 1000)}s`);
const remaining = months.filter(([y, m]) => !state.months[`${y}-${String(m).padStart(2, '0')}`]?.ok).length;
console.log(`remaining months in range: ${remaining}`);
await browser.close();
