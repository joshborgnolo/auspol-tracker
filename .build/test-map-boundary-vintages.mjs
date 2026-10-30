// Catch correct-name/wrong-boundary failures that division-name joins miss.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(root+p,'utf8'), json=p=>JSON.parse(read(p));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const ctx={};vm.runInNewContext(read('map/vendor/topojson-client-3.1.0.min.js'),ctx);
const decode=(y,l='hi')=>{const t=json(`map/data/geo-${y}-${l}.json`);return ctx.topojson.feature(t,t.objects.divs);};
const polys=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
function ringArea(r) {
  let s=0;const rad=Math.PI/180;
  for(let i=0,j=r.length-1;i<r.length;j=i++)s+=(r[i][0]-r[j][0])*rad*(Math.sin(r[j][1]*rad)+Math.sin(r[i][1]*rad));
  return Math.abs(s)*6371.0088**2/2;
}
const area=f=>polys(f).reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
function inRing(r,[x,y]) {let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++) {const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
const contains=(f,p)=>polys(f).some(rs=>inRing(rs[0],p)&&!rs.slice(1).some(r=>inRing(r,p)));
const frames={2001:decode(2001),2010:decode(2010),2013:decode(2013)};
for(const y of [2001,2010]) {
  const r=json(`map/data/res-${y}.json`);
  assert.equal(r.divs.length,150);assert.equal(frames[y].features.length,150);
  assert.deepEqual(frames[y].features.map(f=>f.properties.name).sort(),r.divs.map(d=>d.n).sort());
  assert.ok(r.divs.every(d=>d.lp.every(Number.isFinite)));
}
// AEC 2010 archive's AREA_SQKM attributes; broad enough for the map's display
// simplification, narrow enough to reject the post-election redistributions.
for(const level of ['lo','hi']) {
  assert.notEqual(hash(read(`map/data/geo-2010-${level}.json`)),hash(read(`map/data/geo-2013-${level}.json`)));
  const fc=decode(2010,level);
  for(const [name,expected] of [['McEwen',10669.8664],['Casey',409.21325],['Kingston',377.26663]]) {
    const km=area(fc.features.find(f=>f.properties.name===name));
    assert.ok(Math.abs(km/expected-1)<.025,`2010 ${level} ${name}: election-day area (${km})`);
  }
}
assert.ok(area(frames[2013].features.find(f=>f.properties.name==='McEwen'))<5000,'2013 keeps its later redistribution');
const m=json('map/data/historical-boundary-sources.json').elections[2001];
assert.equal(m.date,'2001-11-10');assert.equal(m.maps.length,150);
assert.equal(hash(read('map/data/geo-2001-hi.json')),m.geometrySHA256);
assert.equal(read('map/data/geo-2001-hi.json'),read('map/data/geo-2001-lo.json'),'2001 has no lossy low-detail derivative');
assert.equal(json('map/data/geo-2001-hi.json').handbook,true);
assert.equal(json('map/data/geo-2001-hi.json').licence,'https://creativecommons.org/licenses/by-nc-nd/4.0/');
for(const text of ['Parliamentary Handbook','Tim Sherratt','CC BY-NC-ND 4.0','/map/data/historical-boundary-sources.json'])assert.ok(read('map/index.html').includes(text),'visible source attribution: '+text);
const states={};
for(const f of frames[2001].features) {
  const src=m.maps.find(r=>r.canonical_name===f.properties.name);
  states[f.properties.st]=(states[f.properties.st]||0)+1;
  assert.ok(+src.start_date<2001&&(!src.end_date||2001<+src.end_date));
  assert.equal(hash(JSON.stringify(f.geometry.coordinates)),src.polygonSHA256,'all original 2001 coordinates retained');
}
assert.deepEqual(states,{ACT:2,NSW:50,NT:2,QLD:27,SA:12,TAS:5,VIC:37,WA:15});
// Independent AEC 2001 profile areas: coastlines/area methods differ slightly,
// but the old ABS shared-boundary placements fail these intervals.
for(const [name,min,max] of [['Kennedy',560000,566000],['Leichhardt',147000,152000],['Grey',895000,901000],['Wakefield',30000,33000],['Lyons',40000,41300],['Franklin',7800,8100],['Fairfax',4200,4350]]) {
  const km=area(frames[2001].features.find(f=>f.properties.name===name));
  assert.ok(km>min&&km<max,`2001 ${name}: expected historical area, got ${km}`);
}
for(const [pt,name] of [[[141.9847,-16.1879],'Kennedy'],[[140.6883,-33.7235],'Wakefield'],[[146.29,-42.9339],'Franklin']]) {
  assert.deepEqual(frames[2001].features.filter(f=>contains(f,pt)).map(f=>f.properties.name),[name],`2001 remote shared boundary ${pt}`);
}
const earlier=json('map/data/historical-boundary-sources.json').elections[1998].maps;
for(const src of m.maps.filter(r=>r.state==='Queensland'))assert.equal(src.map_id,earlier.find(r=>r.canonical_name===src.canonical_name).map_id,'1998 and 2001 QLD use the same redistribution');
console.log('PASS: 2010 election-day VIC/SA geometry; 2001 original Handbook hashes, remote shared boundaries and complete 150-seat frame');
