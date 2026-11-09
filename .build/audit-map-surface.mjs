// Reproducible source audit and geographically held-out sensitivity checks.
// Outputs .build/map/surface-audit.json; never mutates election inputs.
import fs from 'node:fs';
import vm from 'node:vm';
const draw=fs.readFileSync('.build/map/app/app-2b-draw.js','utf8');
const code=draw.slice(draw.indexOf('function surfaceEngine() {'),draw.indexOf('\n/* ----- the rasters -----'));
const E=vm.runInNewContext(`(${code})()`,{}), frames=[];
for(const file of fs.readdirSync('map/data').filter(f=>/^core-.+\.json$/.test(f)).sort()) {
 const r=JSON.parse(fs.readFileSync('map/data/'+file)), b=r.booths, frame={frame:file.slice(5,-5),formal:r.divs.reduce((s,d)=>s+d.c.reduce((s,c)=>s+c[4],0),0),booths:b?.id.length||0,ordinaryLocated:0,ordinaryFormal:0,locatedEarlyFormal:0,unlocatedFormal:0,ordinaryTpp:0,ordinaryTcp:0,ordinaryInformal:0};
 if(b)for(let j=0;j<b.id.length;j++) {
  const formal=b.v[j].reduce((a,v)=>a+v,0),located=Number.isFinite(b.lat[j])&&Math.abs(b.lat[j])<=90&&Number.isFinite(b.lon[j])&&Math.abs(b.lon[j])<=180;
  if(!located)frame.unlocatedFormal+=formal;
  if(located&&b.ty[j]===5)frame.locatedEarlyFormal+=formal;
  if(located&&b.ty[j]===1&&formal>0) {frame.ordinaryLocated++;frame.ordinaryFormal+=formal;if(b.tpp[j]&&b.tpp[j][0]+b.tpp[j][1]>0)frame.ordinaryTpp++;if(b.tcp[j]&&b.tcp[j][0]+b.tcp[j][1]>0)frame.ordinaryTcp++;if(b.inf[j]!=null)frame.ordinaryInformal++;}
 }
 frame.ordinaryFormalPct=+(100*frame.ordinaryFormal/frame.formal).toFixed(2);frames.push(frame);
}
const r=JSON.parse(fs.readFileSync('map/data/core-2025.json')),b=r.booths,rows=[];
for(let j=0;j<b.id.length;j++){const t=b.tpp[j];if(b.ty[j]===1&&Number.isFinite(b.lon[j])&&Number.isFinite(b.lat[j])&&t&&t[0]+t[1]>0)rows.push({j,lon:b.lon[j],lat:b.lat[j],w:t[0]+t[1],v:100*t[0]/(t[0]+t[1]),seat:r.divs[b.d[j]].n,cls:r.divs[b.d[j]].cls});}
const rad=Math.PI/180,n=(Math.sin(-18*rad)+Math.sin(-36*rad))/2,c=1+Math.sin(-18*rad)*(2*n-Math.sin(-18*rad)),r0=Math.sqrt(c)/n,p={k:6371,tx:0,ty:0,n,c,r0,rotate:-132};
const project=(lon,lat)=>{const rho=Math.sqrt(c-2*n*Math.sin(lat*rad))/n,t=(lon-132)*rad*n;return [p.k*rho*Math.sin(t),-p.k*(r0-rho*Math.cos(t))];};
const D={n:rows.length,u:1,projection:p,maxKm:25,minKm:2,minMass:100,fadeMass:400,lon:Float64Array.from(rows,q=>q.lon),lat:Float64Array.from(rows,q=>q.lat),w:Float64Array.from(rows,q=>q.w),x:Float64Array.from(rows,q=>project(q.lon,q.lat)[0]),y:Float64Array.from(rows,q=>project(q.lon,q.lat)[1]),ch:[Float64Array.from(rows,q=>q.v)]};
const samples=rows.map((q,i)=>i).filter((i)=>i%29===0), sensitivity=[];
for(const maxKm of [10,25,50]) {
 const groups={};
 for(const i of samples) {
  const row=rows[i],w=Float64Array.from(D.w);for(let j=0;j<rows.length;j++)if(Math.abs(rows[j].lon-row.lon)<0.0001&&Math.abs(rows[j].lat-row.lat)<0.0001)w[j]=0;
  const d={...D,w,maxKm},v=E.at(d,D.x[i],D.y[i]),g=groups[row.cls]??={sample:0,predicted:0,errors:[]};g.sample++;if(v){g.predicted++;g.errors.push(Math.abs(v.values[0]-row.v));}
 }
 for(const g of Object.values(groups)){g.errors.sort((a,b)=>a-b);g.medianAbsoluteErrorPP=g.errors.length?+((g.errors[Math.floor((g.errors.length-1)/2)]+g.errors[Math.floor(g.errors.length/2)])/2).toFixed(2):null;g.meanAbsoluteErrorPP=g.errors.length?+(g.errors.reduce((a,v)=>a+v,0)/g.errors.length).toFixed(2):null;delete g.errors;}
 sensitivity.push({maxKm,groups});
}
const metrics={audited:'2026-11-09',scope:'Every shipped core frame; all source voting types and counted local TPP/TCP/informal availability. Holdout is 2025 ordinary polling places, every 29th eligible record, removing all records at the same site. It tests prediction of held-out polling-place results, not residents or unsampled land.',frames,holdout:sensitivity};
fs.writeFileSync('.build/map/surface-audit.json',JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify({frames:frames.length,latest:frames.find(x=>x.frame==='2025'),holdout:sensitivity},null,2));
