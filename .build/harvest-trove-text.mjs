#!/usr/bin/env node
/* harvest-trove-text.mjs — fetch the full corrected-OCR text renditions for
   every article id in data/trove-poll-articles.csv (the poll reports), into
   .matilda/trove-harvest/text/<id>.txt. Resumable; skips ids already on disk.

     node .build/harvest-trove-text.mjs [budgetSec]     # default 86400

   The rendition endpoint is open to the SPA session:
     https://trove.nla.gov.au/newspaper/rendition/nla.news-article<ID>.txt
   and returns a small HTML document whose <div class='zone'><p>… carry the
   corrected OCR text. refresh-trove-archive.mjs folds these into
   data/trove-text.jsonl while the bundle fits the repo norm. Same key
   provenance as harvest-trove.mjs (see its header). */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CSV = 'data/trove-poll-articles.csv';
const OUTDIR = process.env.TROVE_TEXT_DIR || '.matilda/trove-harvest/text';
const BUDGET_S = +process.argv[2] || 86400;
const t0 = Date.now();
const overBudget = () => (Date.now() - t0) / 1000 > BUDGET_S;

if (!fs.existsSync(CSV)) { console.error(`no ${CSV} — run .build/refresh-trove-archive.mjs first`); process.exit(1); }
const ids = fs.readFileSync(CSV, 'utf8').split('\n').slice(1)
  .map((l) => l.match(/^(\d+),/)?.[1]).filter(Boolean);
fs.mkdirSync(OUTDIR, { recursive: true });
const todo = ids.filter((id) => !fs.existsSync(path.join(OUTDIR, `${id}.txt`)));
console.log(`${ids.length} poll reports, ${todo.length} texts to fetch`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
const boot = async () => {
  await page.goto('https://trove.nla.gov.au/search/category/newspapers', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 500));
};
await boot();

let done = 0, failed = 0;
for (const id of todo) {
  if (overBudget()) break;
  let text = null;
  for (let attempt = 0; attempt < 3 && text === null; attempt++) {
    text = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u);
        if (!r.ok) return { __err: r.status };
        return { text: await r.text() };
      } catch (err) { return { __err: String(err) }; }
    }, `/newspaper/rendition/nla.news-article${id}.txt`).then((r) => (r.__err ? null : r.text));
    if (text === null) { if (attempt < 2) { await boot(); await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); } }
  }
  if (text === null) { failed++; console.error(`id ${id}: failed after retries`); continue; }
  if (/^<!doctype html/i.test(text.trim()) && text.includes('error-page')) { failed++; continue; }
  fs.writeFileSync(path.join(OUTDIR, `${id}.txt`), text);
  done++;
  if (done % 100 === 0) console.log(`${done}/${todo.length} (${failed} failed)`);
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`done: fetched=${done} failed=${failed} elapsed=${Math.round((Date.now() - t0) / 1000)}s`);
await browser.close();
