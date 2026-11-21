const p=require('/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core');
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});const pg=await b.newPage();await pg.setViewport({width:900,height:1000});
await pg.goto('file://'+process.argv[2]);
console.log(await pg.evaluate(()=>{const r=document.querySelector('#fig-2019 .dp-row:nth-child(2)');const l=r.querySelector('.dp-l').getBoundingClientRect(),t=r.querySelector('.dp-t').getBoundingClientRect(),s=r.querySelector('.dp-t svg').getBoundingClientRect();return JSON.stringify({l:[l.top,l.height],t:[t.top,t.height],s:[s.top,s.height]})}));await b.close();})();
