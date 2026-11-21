const p=require('/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core');
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});
for (const w of [1280,390]){const pg=await b.newPage();await pg.setViewport({width:w,height:1100});await pg.goto('file://'+process.argv[2]);await new Promise(r=>setTimeout(r,800));
await pg.screenshot({path:process.argv[3]+'/top-'+w+'.png'});
const el=await pg.$('#fig-2019');await el.scrollIntoView();await el.screenshot({path:process.argv[3]+'/sh19-'+w+'.png'});}
await b.close();})();
