// Refreshes data/cycles.json, the figures the Past cycles boards draw, from the running site.
// The tab's bands, lines and sentences are computed in the page (pooling, splices, the
// cycle-source sidecar), so this reads them there, with the page's own functions, rather
// than re-deriving them.
// Usage, from the repo root, with the site built:
//   node .claude/serve.js &                          # serves the repo on :8755
//   node design/redesign-2026-09/gen/extract_cycles.js
// Needs Playwright (a global install is fine: NODE_PATH=$(npm root -g)).
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const OUT = process.argv[2] || path.join(__dirname, '..', 'data', 'cycles.json');
// the polls under a line are kept only for the lines the boards draw them under
const KEEP_READINGS = { net: [1974, 1993, 2025] };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:8755/#cycles', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Object.keys(window.AP.D.cycleSource || {}).length > 0);
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    const D = window.AP.D;
    const cycles = D.cycles;
    const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
    const outcomeOf = (i) => { const n = cycles[i + 1]; return n ? (n.gov === cycles[i].gov ? 'returned' : 'ousted') : null; };
    const terms = cycles.map((c, i) => ({
      year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: !!c.current,
      eDate: c.eDate, color: c.color, span: c.span, outcome: outcomeOf(i),
      base: c.base, end: c.end,
      netEras: (c.raw.netEras || []).map((e) => e.name), oppEras: (c.raw.oppEras || []).map((e) => e.name),
      ppmPair: c.raw.ppmPair || null, ppmEras: (c.raw.ppmEras || []).map((e) => e.name),
      tppEras: (c.raw.tppEras || []).map((e) => ({ name: e.name, rival: e.rival, from: e.from })),
    }));
    const metrics = CYC_METRICS.map((M) => {
      const has = (c) => (c.raw[M.key] || []).some((v) => v != null);
      const past = cycles.filter((c) => !c.current && has(c));
      const res = { key: M.key, title: M.title, sub: M.sub, unit: M.unit, leader: M.leader || null };
      for (const mode of ['abs', 'chg']) {
        const chg = mode === 'chg';
        const dom = cycDomain(cycles, M, chg);
        const pooled = past.map((c) => {
          const base = cycBase(c, M.key);
          const flags = (c.raw.obs || {})[M.key];
          return toMonthly(c.raw.months, c.raw[M.key], c.span).map((p, m) => {
            if (p.y == null) return null;
            const i = c.raw.months.indexOf(m);
            return { v: chg ? +(p.y - base).toFixed(2) : p.y, obs: !flags || i < 0 || !!flags[i], who: cycHolderAt(c, M, m), yr: c.year };
          });
        });
        const rows = [];
        for (let m = 0; m <= 36; m++) {
          const vs = []; let polled = 0;
          for (const P of pooled) { const p = P[m]; if (!p) continue; vs.push(p); if (p.obs) polled++; }
          if (!vs.length) continue;
          vs.sort((a, b) => a.v - b.v);
          const nums = vs.map((p) => p.v);
          rows.push({ m, n: vs.length, polled, mean: +(nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2),
            p10: +pctOf(nums, 0.1).toFixed(2), p90: +pctOf(nums, 0.9).toFixed(2), q1: +pctOf(nums, 0.25).toFixed(2), q3: +pctOf(nums, 0.75).toFixed(2),
            vals: vs.map((p) => ({ v: r2(p.v), who: p.who, yr: p.yr })) });
        }
        // every term's own line, split by era where the measure has eras
        const lines = {};
        for (const c of cycles) {
          if (!has(c)) continue;
          const base = cycBase(c, M.key);
          const eras = (M.key === 'net' && c.raw.netEras) || (M.key === 'oppnet' && c.raw.oppEras) || (M.key === 'ppmm' && c.raw.ppmEras) || (M.key === 'tpp' && c.raw.tppEras) || null;
          const segs = eras ? eras.map((e) => ({ name: e.name, months: e.months, vals: e.vals, obs: e.obs, rival: e.rival || null, from: e.from || null }))
                            : [{ name: null, months: c.raw.months, vals: c.raw[M.key], obs: (c.raw.obs || {})[M.key] }];
          lines[c.year] = segs.map((s) => ({ name: s.name, rival: s.rival, from: s.from,
            pts: toMonthly(s.months, s.vals, c.span).filter((p) => p.y != null).map((p) => {
              const i = s.months.indexOf(p.x);
              return [p.x, r2(chg ? p.y - base : p.y), s.obs && i >= 0 ? (s.obs[i] ? 1 : 0) : 1];
            }) }));
        }
        // whole-term monthly series, exactly what the band pools (eras joined), for re-pooling subsets
        const pool = {};
        for (const c of cycles) {
          if (!has(c)) continue;
          const base = cycBase(c, M.key);
          const flags = (c.raw.obs || {})[M.key];
          pool[c.year] = toMonthly(c.raw.months, c.raw[M.key], c.span).map((p, m) => {
            if (p.y == null) return null;
            const i = c.raw.months.indexOf(m);
            return [r2(chg ? p.y - base : p.y), !flags || i < 0 || !!flags[i] ? 1 : 0, cycHolderAt(c, M, m)];
          });
        }
        res[mode] = { domain: dom.domain, ticks: dom.ticks, band: rows, lines, pool, base: Object.fromEntries(cycles.map((c) => [c.year, r2(cycBase(c, M.key))])) };
      }
      // the sitting term's events on this chart
      const cur = cycles.find((c) => c.current);
      res.events = (CYC_EVENTS[cur.year] || []).filter((e) => !e.metrics || e.metrics.includes(M.key))
        .map((e) => ({ date: e.date, short: e.short, label: e.label, major: !!e.major, x: +cycEventMonth(e.date, cur.eDate).toFixed(3) }));
      if (M.key === 'tpp' && cur.raw.tppEras) res.events = res.events.concat(cur.raw.tppEras.filter((e) => e.from).map((e) => ({
        date: e.from, short: 'Now ' + (e.rival === 'alp_on' ? 'v One Nation' : 'v Coalition'), label: 'Labor’s strongest rival becomes ' + (e.rival === 'alp_on' ? 'One Nation' : 'the Coalition'),
        major: true, contest: true, x: +cycEventMonth(e.from, cur.eDate).toFixed(3) })));
      res.hasData = cycles.filter(has).map((c) => c.year);
      // the individual readings under a line (the dots the tab draws for three terms or fewer)
      res.readings = {};
      for (const c of cycles) {
        if (!has(c)) continue;
        res.readings[c.year] = cycleReadings(c, M, D).map((p) => [r2(p.x), r2(p.y), p.iso, p.meta && p.meta.pollster]);
      }
      return res;
    });
    // the page's own rendered sentences, card by card
    const cards = [...document.querySelectorAll('.cycle-card')].map((el) => ({
      title: (el.querySelector('.card-title') || {}).textContent,
      sub: (el.querySelector('.card-sub') || {}).textContent,
      insight: (el.querySelector('.cycle-insight') || {}).textContent,
      summary: (el.querySelector('.ap-pop-summary, .fp-summary, .pop-summary') || {}).textContent || null,
      drawn: [...el.querySelectorAll('.cyc-drawn-item')].map((d) => d.textContent),
      basis: (el.querySelector('.cycle-basis') || {}).textContent || null,
    }));
    const legendBtn = [...document.querySelectorAll('.cyc-legend button')].slice(0, 3).map((b) => b.textContent);
    const cur = cycles.find((c) => c.current);
    const onp = toMonthly(cur.raw.months, cur.raw.onp, cur.span).map((p) => [p.x, p.y == null ? null : r2(p.y)]);
    return { updated: D.latest.updatedISO, current: cur.year, onp, terms, metrics, cards, legendBtn, accuracy: D.accuracy,
             trove: Object.fromEntries(Object.entries(D.cycleSource || {}).map(([y, s]) => [y, s.trove || null])),
             srcCounts: Object.fromEntries(Object.entries(D.cycleSource || {}).map(([y, s]) => [y, { polls: s.polls.length, approval: s.approval.length }])) };
  });
  for (const m of out.metrics) {
    const keep = KEEP_READINGS[m.key] || [];
    m.readings = Object.fromEntries(Object.entries(m.readings).filter(([y]) => keep.includes(+y)));
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('terms', out.terms.length, 'metrics', out.metrics.length, 'cards', out.cards.length, 'bytes', JSON.stringify(out).length);
  console.log('wrote', OUT);
  await browser.close();
})();
