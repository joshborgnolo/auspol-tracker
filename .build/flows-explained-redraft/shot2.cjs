const p=require('/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core');
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});
for (const w of (process.argv[4]||'900').split(',')){const pg=await b.newPage();await pg.setViewport({width:+w,height:1000,deviceScaleFactor:2});
await pg.goto('file://'+process.argv[2]);
for (const sel of process.argv[3].split(',')){const el=await pg.$(sel);if(!el)continue;await el.screenshot({path:process.argv[5]+'/'+sel.replace(/\W/g,'')+'-'+w+'.png'});
const btn=await el.$('button');if(btn){await btn.click();await new Promise(r=>setTimeout(r,500));await el.screenshot({path:process.argv[5]+'/'+sel.replace(/\W/g,'')+'-'+w+'-on.png'});}}}
await b.close();})();
