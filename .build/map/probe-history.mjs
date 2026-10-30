// Manual browser regression probe: start a local server, then
// MAP_URL=http://127.0.0.1:8765 node .build/map/probe-history.mjs
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--force-prefers-reduced-motion']});
const base = process.env.MAP_URL || 'http://127.0.0.1:8765';
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e=>errors.push(e.message));
    await page.setViewport({width, height:900, isMobile:width<500, hasTouch:width<500});
    await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));
    await page.evaluateOnNewDocument(()=>{
      window.__invalidMapArcs=0;
      const arc=CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc=function(...args) {
        if(!args.slice(0,5).every(Number.isFinite)) window.__invalidMapArcs++;
        return arc.apply(this,args);
      };
    });
    await page.goto(`${base}/map/#y=${width < 500 ? 1998 : 1993}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__map,{timeout:60000});
    if (width < 500) {
      for (const year of [1993,1996,1998]) {
        const selector = `.stop[data-year="${year}"] text`;
        await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));
        const point = await page.$eval(selector,e=>{
          const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
          return {x,y,hit:document.elementFromPoint(x,y)?.closest('[data-year]')?.dataset.year};
        });
        assert.equal(point.hit,String(year),`${year}: phone label has its own touch target`);
        await page.touchscreen.tap(point.x,point.y);
        await page.waitForFunction(y=>__map.S.year===y,{timeout:15000},year);
      }
    }
    for (const year of [1993,1996,1998,2001,1993]) {
      await page.evaluate(async y=>{ await __map.setYear(y); __map.goAus(); __map.setView('map'); },year);
      await page.waitForFunction(y=>__map.S.year===y && __map.Y[y]?.divs,{},year);
      if ([1993,1996,1998].includes(year)) {
        const probes=await page.evaluate(()=>{
          const b=__map.Y[__map.S.year].booth.raw;
          return [b.location.findIndex(Boolean),b.location.findIndex((v,j)=>v&&b.inf[j]==null)].filter(j=>j>=0);
        });
        for(const j of probes) {
          await page.evaluate(j=>{__map.setLens('fp');__map.goBooth(j);},j);
          await page.$eval('#stage',e=>e.scrollIntoView({block:'center'}));
          await new Promise(r=>setTimeout(r,600));
          assert.match(await page.$eval('#story',e=>e.textContent),/Approximate location, matched by name to the AEC/);
          assert.equal(await page.evaluate(()=>window.__invalidMapArcs),0,'located booths with missing informal counts draw finite markers');
        }
        await page.screenshot({path:`/private/tmp/history-booths-${year}-${width}.png`});
        await page.evaluate(()=>__map.goAus());
      }
      const state = await page.evaluate(()=>{
        const m=__map.Y[__map.S.year];
        return {divs:m.divs.length,finite:m.geo.bb.every(b=>b.flat().every(Number.isFinite)),width:document.documentElement.scrollWidth,view:innerWidth};
      });
      assert.equal(state.divs,year===1993?147:year===2001?150:148);
      assert.ok(state.finite,`${year}: finite geometry bounds`);
      assert.ok(state.width<=state.view+1,`${width}: no horizontal overflow`);
      for (const lens of ['winner','tpp','fp','senate','flow','informal','cls','seifa']) {
        await page.evaluate(l=>__map.setLens(l),lens);
        await new Promise(r=>setTimeout(r,150));
        const text = await page.$eval('#story',e=>e.textContent);
        assert.ok(!/NaN|undefined|Infinity/.test(text),`${year} ${lens}: ${text.slice(0,200)}`);
      }
      await page.evaluate(()=>{__map.setLens('winner');const m=__map.Y[__map.S.year];__map.goDiv(m.byName.get('Brand'));});
      await new Promise(r=>setTimeout(r,200));
      assert.match(await page.$eval('#story',e=>e.textContent),/Brand/);
      await page.evaluate(()=>{const m=__map.Y[__map.S.year];__map.goBooth(m.booth.byDiv[m.byName.get('Brand')][0]);});
      assert.ok(!/NaN|undefined/.test(await page.$eval('#story',e=>e.textContent)),`${year}: booth card`);
      await page.evaluate(()=>{__map.goAus();__map.setView('chamber');});
      await new Promise(r=>setTimeout(r,200));
      const senateButton = await page.$('[data-house="senate"]');
      assert.ok(senateButton,'Senate chamber control exists');
      await senateButton.click();
      await new Promise(r=>setTimeout(r,350));
      assert.ok(!/NaN|undefined/.test(await page.$eval('#story',e=>e.textContent)),`${year}: Senate card`);
      await page.click('[data-house="reps"]');
      await page.evaluate(()=>__map.setView('map'));
    }
    await page.evaluate(()=>{__map.goAus();__map.setLens('winner');});
    await page.$eval('#stage',e=>e.scrollIntoView({block:'center'}));
    await new Promise(r=>setTimeout(r,700));
    await page.screenshot({path:`/private/tmp/history-${width}.png`});
    assert.deepEqual(errors,[],`${width}: no page exceptions`);
    console.log(`PASS ${width}px: year switching, all lenses, Brand, booth details, House/Senate, no overflow or exceptions`);
    await page.close();
  }
} finally { await browser.close(); }
