const p=require('/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core');
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});
for (const w of (process.argv[4]||'1280').split(',')){const pg=await b.newPage();await pg.setViewport({width:+w,height:1000,deviceScaleFactor:1.5});await pg.goto('file://'+process.argv[2]);
const els=await pg.$$('figure.ftt');for(let i=0;i<els.length;i++){await els[i].screenshot({path:process.argv[3]+'/tab'+i+'-'+w+'.png'});}}
await b.close();})();
