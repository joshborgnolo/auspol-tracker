const p=require('/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core');
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});
for (const w of [900,390]){const pg=await b.newPage();await pg.setViewport({width:w,height:1000});await pg.goto('file://'+process.argv[2]);
const y=()=>pg.$eval('#fig-2019 .ft-btn',e=>e.getBoundingClientRect().top+scrollY);const a=await y();await pg.click('#fig-2019 .ft-btn');await new Promise(r=>setTimeout(r,600));console.log(w,a,await y());}
await b.close();})();
