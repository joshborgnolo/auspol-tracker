// verify the cls-lens list-view cell isn't flush against the preceding numeric
// column (the seat-type column sits after Swing): serve the repo root first,
// e.g. python3 -m http.server 8765, then
// MAP_URL=http://127.0.0.1:8765 node .matilda/probe/map-cls-cell-pad.mjs
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--force-prefers-reduced-motion']});
const base = process.env.MAP_URL || 'http://127.0.0.1:8765';
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(e.message));
  await page.setViewport({width:1280, height:900});
  await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));
  const boot = async (frag) => {
    for (let i = 0; i < 4; i++) {
      await page.goto(`${base}/map/${frag}`, {waitUntil:'domcontentloaded'});
      try { await page.waitForFunction(()=>window.__map, {timeout:15000}); return; } catch (e) { /* flake: reload */ }
    }
    throw new Error('map boot never completed: ' + frag);
  };

  // 1. seat-type lens, list view: cls text cell follows the numeric swing cell
  await boot('#y=2022&l=cls&v=list');
  await page.waitForSelector('.ls-row', {timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.ls-row') && document.querySelector('.ls-row').children.length === 7);
  const cls = await page.evaluate(() => {
    const row = document.querySelector('.ls-row');
    const cells = [...row.children];
    const swing = cells[4], clsCell = cells[5];
    const pad = getComputedStyle(clsCell).paddingLeft;
    const swingTxt = (() => { const r = document.createRange(); r.selectNodeContents(swing); return r.getBoundingClientRect(); })();
    const clsTxt = (() => { const r = document.createRange(); r.selectNodeContents(clsCell); return r.getBoundingClientRect(); })();
    return {pad, gap: clsTxt.left - swingTxt.right, clsText: clsCell.textContent.trim()};
  });
  assert.equal(cls.pad, '8px', 'cls text cell carries 8px left padding after a numeric cell');
  assert.ok(cls.gap >= 6, `cls text starts clear of the swing text (gap ${cls.gap}px)`);
  assert.ok(/^(Inner metro|Outer metro|Provincial|Rural)/.test(cls.clsText), `cls cell is plain class text, got "${cls.clsText}"`);
  const head = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.ls-hc')];
    const i = hs.findIndex((e) => e.textContent.includes('Seat type'));
    return i >= 5 ? getComputedStyle(hs[i]).paddingLeft : null;
  });
  assert.equal(head, '8px', 'the Seat type header cell picks up the same 8px');

  // 2. control: another lens leaves every existing seam untouched
  await boot('#y=2022&v=list');
  await page.waitForSelector('.ls-row', {timeout:30000});
  const ctrl = await page.evaluate(() => {
    const cells = [...document.querySelector('.ls-row').children];
    return cells.map((c) => getComputedStyle(c).paddingLeft);
  });
  assert.deepEqual(ctrl, ['0px','0px','8px','8px','8px','8px','8px'], 'name/win cells keep 0 left padding, numeric cells keep their 8px — the new selector only fires num->text');

  // 3. phone (compact two-column list): the selector never matches there
  await page.setViewport({width:390, height:900, isMobile:true, hasTouch:true});
  await boot('#y=2022&l=cls&v=list');
  await page.waitForSelector('.ls-row', {timeout:30000});
  const ph = await page.evaluate(() => {
    const cells = [...document.querySelector('.ls-row').children];
    return {n: cells.length, pads: cells.map((c) => getComputedStyle(c).paddingLeft)};
  });
  assert.equal(ph.n, 2, 'compact list keeps its two columns');
  assert.deepEqual(ph.pads, ['0px','8px'], 'compact columns unchanged');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: cls text cell respaced 0->8px after the numeric seam; control seams unchanged');
} finally {
  await browser.close();
}
