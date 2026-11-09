// Real-page regression/QA for Surface. Run from repository root; uses local Chrome.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), port=8981, errors=[], checks=[], points=[];
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');fs.createReadStream(file).pipe(res);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
let browser;
const check=(name,cond)=>{assert.ok(cond,name);checks.push(name);console.log('PASS',name);};
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox'],protocolTimeout:180000});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1280,height:900});
 const start=Date.now();
 await page.goto(`http://127.0.0.1:${port}/map/#y=2025&l=tpp&draw=surface`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__map&&__map.SF.base,{timeout:120000});
 console.log('Initial surface ms',Date.now()-start);
 const read=await page.evaluate(async()=>{
  const a=__map,m=a.M(),D=a.SF.data,b=m.booth,E=a.surfaceEngine();
  const points=[];
  for(const [name,lon,lat] of [['Petermann',130,-25],['Yuendumu–Anmatjere',133,-22],['Barkly',133,-20],['Alice Springs',133.882,-23.702],['Sydney',151.2,-33.87],['Wagga Wagga',147.37,-35.11]]) {
   const xy=m.proj([lon,lat]),ll=E.lonlat(D,...xy),v=await a.surfaceAt(...xy);
   points.push({name,lon,lat,value:v,projectionError:Math.max(Math.abs(lon-ll[0]),Math.abs(lat-ll[1]))});
  }
  const coverage=[];
  for(const name of ['Lingiari','Sydney','Riverina']){const i=m.byName.get(name),d=m.divs[i];coverage.push({name,total:d.formal,ordinary:D.seatVotes[i],sites:D.seatN[i]});}
  const unsupportedTip=a.tipFor({kind:'div',i:m.byName.get('Lingiari')});
  return {points,coverage,n:D.n,types:[...new Set(D.boothIndex.map(j=>b.ty[j]))],unsupportedTip};
 });
 points.push(...read.points);console.log(JSON.stringify(read,null,2));
 check('only ordinary geocoded polling places supply Surface',read.types.join()==='1');
 check('desert locations have no invented estimate',read.points.slice(0,3).every(p=>p.value===null));
 check('urban and regional centres retain local readings',read.points.slice(3).every(p=>p.value!==null));
 check('surface inverse matches live D3 projection',read.points.every(p=>p.projectionError<1e-8));
 check('unsupported tooltip says so and labels whole-seat result separately',read.unsupportedTip.includes('No supported local estimate')&&read.unsupportedTip.includes('The whole seat:'));
 const sensitivities=await page.evaluate(()=>{
  const a=__map,m=a.M(),D=a.SF.data,coords=[[130,-25],[133,-22],[133,-20],[151.2,-33.87],[147.37,-35.11]];
  return [10,25,50].map(maxKm=>{const copy={...D,maxKm},E=a.surfaceEngine();return {maxKm,values:coords.map(ll=>{const v=E.at(copy,...m.proj(ll));return v?{v:v.values[0],radius:v.radius,count:v.count}:null;})};});
 });console.log('Sensitivity',JSON.stringify(sensitivities));
 await page.evaluate(()=>__map.goDiv(__map.M().byName.get('Lingiari'),{dur:0}));
 await page.waitForFunction(()=>__map.SF.base&&!__map.SF.busy,{timeout:120000});
 fs.mkdirSync('/tmp/auspol-surface-qa',{recursive:true});
 await (await page.$('#stage')).screenshot({path:'/tmp/auspol-surface-qa/lingiari.png'});
 check('coverage updates to Lingiari',await page.evaluate(()=>document.querySelector('#legend').innerText.includes('16 polling places')&&document.querySelector('#legend').innerText.includes('17%')));
 check('seat zoom draws a local surface',await page.evaluate(()=>!!(__map.SF.view||__map.SF.base)));
 check('Surface markers only show its contributing ordinary places',await page.evaluate(()=>__map.M()._vis.every(j=>__map.SF.sources.has(j))));
 check('island tooltip never samples the mainland behind its inset',await page.evaluate(()=>__map.tipFor({kind:'div',i:__map.M().byName.get('Lingiari'),isl:'Christmas Island'}).includes('No surface drawn for this island')));
 const cityStart=Date.now();
 await page.evaluate(()=>__map.goDiv(__map.M().byName.get('Sydney'),{dur:0}));
 const pointStart=Date.now();
 const cityReading=await page.evaluate(async()=>await __map.surfaceAt(...__map.M().proj([151.2,-33.87])));
 check('point readings stay responsive while a city raster renders',Date.now()-pointStart<2000&&cityReading?.v>0);
 await page.waitForFunction(()=>__map.SF.view&&!__map.SF.busy,{timeout:120000});
 console.log('Sydney detailed raster ms',Date.now()-cityStart);
 await (await page.$('#stage')).screenshot({path:'/tmp/auspol-surface-qa/sydney.png'});
 check('city zoom uses a detailed raster with local coverage',await page.evaluate(()=>document.querySelector('#legend').innerText.includes('48 polling places')&&__map.SF.view.J.px<__map.SF.base.J.px));
 await page.evaluate(()=>__map.setDraw('seats'));
 // Capture data contracts for all eligible lenses without queuing costly full rasters.
 const lanes=await page.evaluate(()=>{
  const a=__map,m=a.M(),out=[];
  for(const lens of ['winner','fp','informal','flow','seifa']){a.S.lens=lens;const d=a.surfaceData(m);out.push({lens,reason:a.surfaceReason(m),n:d?.D.n||0});}
  a.S.lens='tpp';a.S.tppMode='swing';out.push({lens:'swing',reason:a.surfaceReason(m),n:a.surfaceData(m)?.D.n||0});
  a.S.tppMode='share';return out;
 });console.log('Lanes',JSON.stringify(lanes));
 check('census and unpoolable change measures cannot enter Surface',lanes.filter(x=>['seifa','swing'].includes(x.lens)).every(x=>x.n===0&&x.reason));
 // Exercise lazy Senate data and modelled contests through the real UI setters.
 for(const lens of ['senate','senpref']) {
  await page.evaluate(lens=>{__map.S.senMode='share';__map.setLens(lens);},lens);
  await page.waitForFunction(lens=>__map.S.lens===lens&&__map.surfaceData(__map.M())?.D.n>0,{timeout:90000},lens);
  const result=await page.evaluate(()=>{const a=__map,m=a.M(),D=a.surfaceData(m).D,v=a.surfaceEngine().at(D,...m.proj([151.2,-33.87]));return {lens:a.S.lens,n:D.n,value:v?.values[0]};});
  console.log('Senate lane',JSON.stringify(result));
  check(`${lens}: local counts produce a bounded city reading`,result.n>0&&result.value>=0&&result.value<=100);
 }
 await page.evaluate(()=>{__map.setLens('tpp');__map.setDraw('surface');__map.setAxis('AO');});
 await page.waitForFunction(()=>__map.S.axis==='AO'&&__map.SF.key===__map.readingKey(__map.M())&&__map.SF.base&&!__map.SF.busy,{timeout:120000});
 check('alternative contest is explicitly labelled modelled',await page.evaluate(()=>document.querySelector('#legend').innerText.includes('Modelled contest')&&__map.SF.data.n>0));
 await page.goto("about:blank");
 await page.goto(`http://127.0.0.1:${port}/map/#y=2025&l=seifa&i=inc&draw=surface`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__map&&__map.AR.base,{timeout:120000});
 check('old census Surface links resolve to Areas',await page.evaluate(()=>__map.drawOf(__map.M())==='areas'&&document.querySelector('[data-draw="surface"]').disabled&&document.querySelector('[data-draw="areas"]').getAttribute('aria-pressed')==='true'));
 const target=await page.evaluate(()=>{const a=__map,m=a.M(),h=a.areasHit(m,...m.proj([133,-22]));return a.areasValue(a.AR.pack,m,h.i,'incMed');});
 check('Yuendumu–Anmatjere retains its published $866 area median',target===866);
 // Check mobile layout, unsupported early frames and state missing TPP without full national raster jobs.
 await page.setViewport({width:390,height:844});
 check('mobile page has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const y of ['qld24',1993,2022,'now']) {
  await page.evaluate(y=>{__map.setDraw('seats');__map.setYear(y);},y);
  await page.waitForFunction(y=>window.__map&&__map.M()?.year===y&&__map.M().divs&&__map.M().booth,{timeout:90000},y);
  const result=await page.evaluate(()=>{const a=__map,m=a.M();a.S.lens='tpp';a.S.tppMode='share';const tp=a.surfaceData(m);a.S.lens='fp';const fp=a.surfaceData(m);return {year:m.year,tpp:tp?.D.n||0,fp:fp?.D.n||0};});
  console.log('Frame',JSON.stringify(result));
  if(y==='qld24'||y===1993)check(`${y}: no seat-imputed TPP`,result.tpp===0);
 }
 check('no browser errors',errors.length===0);
 fs.writeFileSync('/tmp/auspol-surface-qa/results.json',JSON.stringify({checks,read,sensitivities,lanes,errors},null,2));
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
