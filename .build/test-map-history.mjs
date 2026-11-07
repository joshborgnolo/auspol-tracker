// Offline release gates for the 1993/1996/1998 map frames. Uses the same
// vendored TopoJSON reader as the browser, so CI needs no extra GIS packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const ctx={}; vm.runInNewContext(read('map/vendor/topojson-client-3.1.0.min.js'),ctx);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=json('map/data/historical-boundary-sources.json');
const certified=json('data/division-results.json').elections;
const expected={1993:{NSW:50,VIC:38,QLD:25,WA:14,SA:12,TAS:5,ACT:2,NT:1},1996:{NSW:50,VIC:37,QLD:26,WA:14,SA:12,TAS:5,ACT:3,NT:1},1998:{NSW:50,VIC:37,QLD:27,WA:14,SA:12,TAS:5,ACT:2,NT:1}};
const frame={};
for (const y of [1993,1996,1998]) {
  const r=json(`map/data/res-${y}.json`), rec=source.elections[y];
  assert.equal(r.divs.length,y===1993?147:148);
  const counts={};
  for(const d of r.divs) {
    counts[d.st]=(counts[d.st]||0)+1;
    const want=certified[y][d.n]; assert.ok(want,`${y}: ${d.n} certified name`);
    assert.equal(d.st,want.state);
    assert.equal(d.c.reduce((a,c)=>a+c[4],0),want.formalVote,`${y} ${d.n}: certified primary total`);
    assert.equal(d.inf,want.informalVote);
    assert.equal(d.c.filter(c=>c[6]).length,1);
    if (want.alpTppVote+want.coalitionTppVote>0) assert.deepEqual(d.tpp.slice(0,2),[want.alpTppVote,want.coalitionTppVote]);
    else assert.equal(d.tpp,null,`${y} ${d.n}: missing TPP is not zero`);
    assert.ok(d.lp.every(Number.isFinite));
    assert.ok(d.h.some(h=>h[0]===1993)||!certified[1993][d.n]);
    assert.ok(d.h.some(h=>h[0]===1998)||!certified[1998][d.n]);
  }
  assert.deepEqual(counts,expected[y]);
  const t=json(`map/data/geo-${y}-lo.json`);
  assert.equal(t.handbook,true);assert.equal(t.transform,undefined,'no quantization');
  assert.equal(read(`map/data/geo-${y}-lo.json`),read(`map/data/geo-${y}-hi.json`),'no lossy low-resolution variant');
  assert.equal(hash(read(`map/data/geo-${y}-lo.json`)),rec.geometrySHA256);
  const fc=ctx.topojson.feature(t,t.objects.divs); frame[y]=fc;
  assert.deepEqual(fc.features.map(f=>f.properties.name).sort(),r.divs.map(d=>d.n).sort());
  for (const f of fc.features) {
    const m=rec.maps.find(m=>m.canonical_name===f.properties.name);
    assert.ok(m);assert.equal(f.properties.map_id,m.map_id);
    assert.ok(+m.start_date<y&&(!m.end_date||y<+m.end_date),'election strictly inside the indexed era');
    assert.equal(hash(JSON.stringify(f.geometry.coordinates)),m.polygonSHA256,`${y} ${m.canonical_name}: all source coordinates retained`);
  }
}
for(const [a,b,states] of [[1993,1996,['ACT','QLD','VIC']],[1996,1998,['ACT','QLD','WA']]]) {
  const before=source.elections[a].maps,after=source.elections[b].maps;
  const changed=new Set();
  for(const y of [a,b]) for(const d of json(`map/data/res-${y}.json`).divs) {
    if(before.find(r=>r.canonical_name===d.n)?.map_id!==after.find(r=>r.canonical_name===d.n)?.map_id)changed.add(d.st);
  }
  assert.deepEqual([...changed].sort(),states);
}
function inRing(r,[x,y]) {let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++) {const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(f,p) {return f.geometry.coordinates.some(poly=>inRing(poly[0],p)&&!poly.slice(1).some(r=>inRing(r,p)));}
// AEC 1996's Collie polling places belong to Brand. This town-location
// probe catches the old ABS frame's later-era WA geometry.
for(const y of [1993,1996,1998]) assert.equal(contains(frame[y].features.find(f=>f.properties.name==='Brand'),[116.156801,-33.36357]),y!==1998,`${y}: Collie/Brand redistribution`);
for(const y of [1993,1998]) {
  const r=json(`map/data/res-${y}.json`);
  assert.equal(r.booths.id.length,y===1993?8431:8311);
  assert.equal(r.coverage.boothCoordinates,'approximate');
  assert.equal(r.booths.location.filter(Boolean).length,r.booths.lat.filter(x=>x!==null).length,'every estimated coordinate has provenance');
  assert.ok(r.booths.inf.some(x=>x>0),'recorded informal votes retained');
  assert.equal(r.divs.find(d=>d.n===r.speaker).c.find(c=>c[6])[0],y===1993?'Stephen Paul Martin':'Neil Andrew');
  const national=r.agg.AUS, sv=json(`map/data/senate-vote-${y}.json`);
  assert.equal(national.formal,r.divs.reduce((s,d)=>s+d.c.reduce((s,c)=>s+c[4],0),0));
  assert.equal(national.inf,r.divs.reduce((s,d)=>s+d.inf,0));
  for(const d of r.divs)assert.ok(sv.divs[d.n]);
  if(y===1993) {
    assert.equal(r.coverage.firstPreferenceDifferences.length,75);
    assert.equal(r.coverage.informalDifferences.length,17);
    for(const [name] of r.coverage.firstPreferenceDifferences)assert.deepEqual(r.divs.find(d=>d.n===name).fl,[],'do not invent balancing preference transfers');
    assert.ok(r.booths.tpp.every(x=>x===null)&&r.booths.tcp.every(x=>x===null));
  } else assert.equal(r.divs.find(d=>d.n==='Newcastle').tpp,null);
}
assert.equal(json('map/data/senate-1998.json').senators.find(s=>s.n==='Kay Denman').term,2005,'Denman elected in 1998, not continuing class');
// Each estimate is traceable to an actual source venue and inside the original
// historical polygon. This JS containment check is independent of the builder.
const locations=json('data/booth-locations-history.json');
for(const [p,h] of Object.entries(locations.sourceSHA256)) assert.equal(hash(fs.readFileSync(path.join(root,p))),h,`${p}: matching input hash`);
const venueSources={};
for(const y of [2007,2010,2013,2016,2019,2022,2025]) venueSources[y]=new Map(json(`data/booth-seifa-${y}.json`).booths.map(b=>[`${b.div}|${b.boothId}`,b]));
for(const y of [1993,1996,1998]) {
  const r=json(`map/data/res-${y}.json`), B=r.booths, saved=locations.elections[y];
  const geoms=new Map(frame[y].features.map(f=>[f.properties.name,f]));
  const counts={};
  for(let j=0;j<B.id.length;j++) {
    const p=saved.places[B.id[j]], d=r.divs[B.d[j]], m=p.match;
    assert.equal(p.name,B.n[j]);assert.equal(p.division,d.n);
    counts[p.status]=(counts[p.status]||0)+1;
    if(!m) {assert.equal(B.lat[j],null);assert.equal(B.lon[j],null);assert.equal(B.location[j],null);continue;}
    assert.equal(B.ty[j],1,'only ordinary fixed places get estimated markers');
    assert.equal(p.status,'matched');
    const v=venueSources[m.year].get(`${m.div}|${m.boothId}`);
    assert.ok(v);assert.equal(v.type,'Polling place');
    assert.equal(v.premisesState||v.state,d.st);
    assert.equal(m.booth,v.booth);assert.equal(m.venue,v.venue);
    assert.deepEqual([B.lat[j],B.lon[j]],[v.lat,v.lon],'original source coordinates, no rounding or centroid');
    assert.deepEqual([m.lat,m.lon],[v.lat,v.lon]);
    assert.deepEqual(B.location[j],[m.year,m.venue,m.method]);
    assert.ok(contains(geoms.get(d.n),[m.lon,m.lat]),`${y} ${d.n} ${p.name}: inside historical boundary`);
  }
  assert.deepEqual(counts,saved.counts);assert.deepEqual(r.coverage.boothLocationCounts,counts);
  assert.ok(counts.matched>6000,'substantial ordinary-place coverage');
  const administrative=Object.values(saved.places).filter(p=>/^Sydney \(/.test(p.name));
  assert.ok(administrative.length>40);assert.ok(administrative.every(p=>!p.match),'allocated city returns cannot become local venues');
}
process.stdout.write(execFileSync('python3',[path.join(root,'.build/map/test_historical_booth_locations.py')]));
console.log('PASS: historical maps — 443 division/result joins, exact source-coordinate hashes, redistribution states, Collie/Brand, certified totals and honest data gaps');
