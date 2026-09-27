// Measures each PastCycles board's content height and writes gen/cycles_heights.json,
// so every board is exactly as tall as what it holds. Run after cycles_build.py, then
// run cycles_build.py again. Webfonts are served from the site's own copies of the same
// faces (.build/newtracker/fonts), so the measure matches what the canvas renders.
//   python3 design/redesign-2026-09/gen/cycles_build.py
//   node design/redesign-2026-09/gen/measure_cycles.js
//   python3 design/redesign-2026-09/gen/cycles_build.py
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const FONTS = path.join(__dirname, '..', '..', '..', '.build', 'newtracker', 'fonts');
const css = [['400', 'normal', 'crimsontext-400-latin'], ['600', 'normal', 'crimsontext-600-latin'], ['700', 'normal', 'crimsontext-700-latin'],
  ['400', 'italic', 'crimsontext-italic-400-latin'], ['600', 'italic', 'crimsontext-italic-600-latin'], ['700', 'italic', 'crimsontext-italic-700-latin']]
  .map(([w, st, f]) => `@font-face{font-family:"Crimson Text";font-style:${st};font-weight:${w};src:url(https://fonts.gstatic.com/local/${f}.woff2) format("woff2")}`)
  .concat(['@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:300 700;src:url(https://fonts.gstatic.com/local/ibmplexsans-latin.woff2) format("woff2")}']).join('\n');
(async () => {
  const dir = path.join(__dirname, '..', 'canvas', 'project') + '/';
  const out = path.join(__dirname, 'cycles_heights.json');
  const names = fs.readdirSync(dir).filter((f) => /^PastCycles.*\.dc\.html$/.test(f)).map((f) => f.replace('.dc.html', ''));
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  const browser = await chromium.launch();
  for (const n of names) {
    const w = n.includes('Phone') ? 390 : 1280;
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
    await page.route('https://fonts.gstatic.com/**', (r) => { const f = r.request().url().split('/').pop(); r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'font/woff2' }, body: fs.readFileSync(path.join(FONTS, f)) }); });
    await page.goto('file://' + dir + n + '.dc.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const h = await page.evaluate(() => {
      const root = document.querySelector('x-dc > div');
      const kids = [...root.children];
      const top = root.getBoundingClientRect().top;
      return Math.max(...kids.map((k) => k.getBoundingClientRect().bottom - top));
    });
    prev[n] = Math.ceil(h);
    console.log(n, h, '->', prev[n]);
    await page.close();
  }
  fs.writeFileSync(out, JSON.stringify(prev, null, 1) + '\n');
  await browser.close();
})();
