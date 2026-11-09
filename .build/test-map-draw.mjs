/* Map drawings and bounded Surface: real count bases, geographic support,
   zoom invariance and app wiring. Browser QA: test-map-surface-browser.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { FP_ON, FLOW_HISTORY_SENATE_ON as ON, FLOW_HISTORY_SENATE_CON as CON } from "./newtracker/flows.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const draw = R(".build/map/app/app-2b-draw.js"), ui = R(".build/map/app/app-6-ui.js");
const between = (a, b) => { const i = draw.indexOf(a), j = draw.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return draw.slice(i, j); };

/* ----- local surface: arithmetic, support, geography and render invariance ----- */
const src = between("function surfaceEngine() {", "\n/* ----- the rasters -----");
const engine = () => vm.runInNewContext(`(${src})()`, {}), E = engine();
const pts = (list) => {
  const D = { n: list.length, u: 1, maxKm: 25, minKm: 2, minMass: 100, fadeMass: 400, bg: 0xffeeeeee,
    x: Float64Array.from(list, q => q[0]), y: Float64Array.from(list, q => q[1]), w: Float64Array.from(list, q => q[2]), ch: [Float64Array.from(list, q => q[3])],
    lo: 0, hi: 100, fam: false, band: new Uint8Array(4096).map((_, k) => Math.min(9, Math.floor(10*k/4096))), col: Uint32Array.from({length:10}, (_, k) => (0xff000000 | 10+20*k) >>> 0) };
  return D;
};
{
  const D = pts([[0,0,1000,20],[0,0,3000,80]]), s = E.at(D,0,0);
  assert.equal(s.values[0],65,'the pooled share uses its ballot denominator');
  assert.equal(s.count,2); assert.equal(s.radius,25,'co-located records do not shrink the bandwidth');
  assert.equal(E.at(D,25,0),null,'no value at the hard radius');
  assert.equal(E.at(D,100,0),null,'empty country never inherits a national or seat average');
  assert.equal(E.at(pts([[0,0,99,95]]),0,0),null,'too little ballot support is not painted');
  const A = pts([[0,0,1000,20]]), B = pts([[0,0,1000,20],[26,0,1e9,100]]);
  assert.equal(E.at(A,0,0).values[0],E.at(B,0,0).values[0],'an arbitrarily large distant outlier has zero influence');
}
{
  const D = pts([[-1,-1,1000,20],[1,-1,1000,40],[-1,1,1000,60],[1,1,1000,80]]), s = E.at(D,0,0);
  assert.ok(Math.abs(s.values[0]-50)<1e-10); assert.ok(s.radius<3,'dense neighbourhoods retain local detail');
  assert.ok(s.alpha>=0 && s.alpha<=1);
  const first = E.at(D,0,0).values[0];
  for(const px of [0.1,0.5,1,2]) {
    const J={px,x0:-10,y0:-10,nx:40,ny:40}, out=new Uint32Array(E.raster(D,J).rgba);
    for(let y=0;y<J.ny;y++) for(let x=0;x<J.nx;x++) {
      const q=E.at(D,J.x0+(x+0.5)*px,J.y0+(y+0.5)*px);
      if(!q) assert.equal(out[y*J.nx+x],D.bg,'unsupported pixels stay neutral at every zoom');
    }
    assert.equal(E.at(D,0,0).values[0],first,'rendering never changes the field');
  }
  assert.equal(engine().at(D,0,0).values[0],first,'worker and fallback use the same field');
  const B=pts([[-2,-2,1000,20],[2,-2,1000,40],[-2,2,1000,60],[2,2,1000,80]]);B.u=2;
  assert.equal(E.at(B,0,0).values[0],first,'map scaling preserves kilometre distances');
}
{
  const D=pts([[0,0,1000,20],[0,0,3000,80]]);D.fam=true;D.nb=10;D.ch=[new Float64Array([0.2,0.8]),new Float64Array([0.8,0.2])];D.col=new Uint32Array(20).fill(0xff123456);
  const s=E.at(D,0,0);assert.ok(Math.abs(s.values[0]+s.values[1]-1)<1e-10,'final-count shares conserve ballot mass');
  assert.equal(s.values[0],0.65);
}
{
  // Actual conic projection, independent forward math. Same Earth radius as haversine.
  const rad=Math.PI/180,n=(Math.sin(-18*rad)+Math.sin(-36*rad))/2,c=1+Math.sin(-18*rad)*(2*n-Math.sin(-18*rad)),r0=Math.sqrt(c)/n;
  const centreRho=Math.sqrt(c-2*n*Math.sin(-27*rad))/n, centreTheta=3*rad*n;
  const projection={k:1200,tx:500,ty:440,n,c,r0,rotate:-132,cx:centreRho*Math.sin(centreTheta),cy:r0-centreRho*Math.cos(centreTheta)};
  const project=(lon,lat)=>{const rho=Math.sqrt(c-2*n*Math.sin(lat*rad))/n,t=(lon-132)*rad*n;return [projection.tx+projection.k*(rho*Math.sin(t)-projection.cx),projection.ty-projection.k*(r0-rho*Math.cos(t)-projection.cy)];};
  for(const [lon,lat] of [[130,-25],[133,-22],[151.2,-33.9],[115.9,-31.9],[147,-43],[96.8,-12.2]]) {
    const xy=project(lon,lat),D=pts([[...xy,2000,42]]);D.projection=projection;D.lon=[lon];D.lat=[lat];
    const ll=E.lonlat(D,...xy);assert.ok(Math.abs(ll[0]-lon)<1e-8&&Math.abs(ll[1]-lat)<1e-8,'inverse projection returns original geography');
    assert.ok(Math.abs(E.at(D,...xy).values[0]-42)<1e-9);
    assert.equal(E.at(D,...project(lon,lat+26/6371/rad)),null,'26 km on Earth is out of support in every tested region');
  }
}
{
  // Compare the spatial index with a full distance scan, including duplicated sites,
  // excluded records and neighbours on both sides of a longitude wrap.
  const rad=Math.PI/180,n=(Math.sin(-18*rad)+Math.sin(-36*rad))/2,c=1+Math.sin(-18*rad)*(2*n-Math.sin(-18*rad)),r0=Math.sqrt(c)/n;
  const projection={k:1200,tx:500,ty:440,n,c,r0,rotate:-132};
  const project=(lon,lat)=>{const rho=Math.sqrt(c-2*n*Math.sin(lat*rad))/n,t=(lon-132)*rad*n;return [500+1200*rho*Math.sin(t),440-1200*(r0-rho*Math.cos(t))];};
  const dist=(a,b)=>{const h=Math.sin((a[1]-b[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((a[0]-b[0])*rad/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)));};
  for(const lon of [130,151.2,179.98]) {
    const rows=Array.from({length:85},(_,i)=>{const q=i%79;return [lon+0.26*Math.sin(q*2.7),-25+0.26*Math.cos(q*1.7),i%11?500+i*13:0,(i*37)%101];});
    rows[0]=[lon,-25,0,100];
    const D=pts(rows.map(([x,y,w,v])=>[...project(x,y),w,v]));D.projection=projection;D.lon=rows.map(q=>q[0]>180?q[0]-360:q[0]);D.lat=rows.map(q=>q[1]);
    for(let j=0;j<15;j++) {
      const ll=[lon+0.2*Math.sin(j),-25+0.2*Math.cos(j)],near=rows.map((r,i)=>({i,d:dist(ll,r)})).filter(q=>D.w[q.i]>0&&q.d<25);
      const sites=[...new Map(near.map(q=>[rows[q.i].slice(0,2).join(','),q.d])).values()].sort((a,b)=>a-b);
      const radius=sites.length>=4?Math.min(25,Math.max(2,2*sites[3])):25;
      let mass=0,total=0,count=0;
      for(const q of near)if(q.d<radius){const t=q.d/radius,w=(1-t)**4*(1+4*t)*D.w[q.i];mass+=w;total+=w*D.ch[0][q.i];count++;}
      const actual=E.at(D,...project(...ll));
      if(mass<100)assert.equal(actual,null);else {
        assert.ok(Math.abs(actual.values[0]-total/mass)<1e-8,'indexed value matches full great-circle scan');
        assert.ok(Math.abs(actual.mass-mass)<1e-6,'indexed support matches full scan');
        assert.equal(actual.count,count);assert.ok(Math.abs(actual.radius-radius)<1e-8);
      }
    }
  }
}
// Input eligibility and denominator tests use the application functions directly.
{
  const input=between('function surfaceDenominator(m, j) {','const SURF_MAX_KM');
  const context={S:{lens:'informal',from:'grn'},axisOf:()=>null,svOf:()=>({booths:{1:[900]}}),spOf:()=>({booths:{1:[]}}),spCells:()=>({x:12,y:18})};
  vm.createContext(context);vm.runInContext(input,context);
  const b={ty:[1],x:[0],y:[0],d:[0],id:[1],formal:[800],votes:[1000],raw:{lat:[-25],lon:[130],tcp:[[300,400]],tpp:[[350,450]],fl:[[[0,25,35,40]]]}};
  const m={booth:b,divs:[{c:[{b:'grn'}]}]};
  for(const [lens,w] of [['informal',1000],['winner',700],['tpp',800],['flow',60],['senate',900],['senpref',30],['fp',800],['seifa',0]]) {context.S.lens=lens;assert.equal(context.surfaceDenominator(m,0),w,`${lens} uses its own denominator`);}
  assert.ok(context.surfaceEligible(m,0));
  for(const t of [2,3,4,5]) {b.ty[0]=t;assert.equal(context.surfaceEligible(m,0),false,'non-local voting types excluded even with coordinates');}
  b.ty[0]=1;b.raw.lat[0]=null;assert.equal(context.surfaceEligible(m,0),false,'unlocated ordinary booth excluded');
  const body=between('function surfaceData(m) {','/* A local descriptive surface');
  assert.ok(!body.includes('drawValue(')&&!body.includes('seatSpots(')&&!body.includes('estBooths('),'no imputed local data or synthetic locations enter the surface');
}

/* ----- the contests' numbers ----- */
const num = (name) => vm.runInNewContext(`(${between(`const ${name} = {`, "\n};").replace(`const ${name} = `, "")}})`, {});
const level = vm.runInNewContext(`(${/const AXIS_LEVEL = (\{[^}]*\})/.exec(draw)[1]})`, {});
for (const f of ["lnp", "grn", "oth"]) assert.equal(level[f], Math.round(FP_ON[f] * 100), `AXIS_LEVEL.${f} is flows.mjs FP_ON`);
const rates = JSON.parse(JSON.stringify(num("AXIS_RATES"))); // (out of its vm context: strict equality reads the prototype too)
const at = (T, st, y, k) => T.states[st][k][T.years.indexOf(y)];
for (const [frame, st, y] of [["qld20", "qld", 2019], ["qld24", "qld", 2025], ["qldnow", "qld", 2025]]) {
  assert.deepEqual(rates[frame].AO, { lnp: at(ON, st, y, "coal"), grn: at(ON, st, y, "grn"), oth: at(ON, st, y, "oth") }, `${frame}: Labor v One Nation is ${st}'s ${y} Senate ballots`);
}
for (const [frame, st, y] of [["qld20", "qld", 2019], ["qld24", "qld", 2025], ["qldnow", "qld", 2025], ["sa26", "sa", 2025]]) {
  assert.deepEqual(rates[frame].CO, { alp: at(CON, st, y, "alp"), grn: at(CON, st, y, "grn"), oth: at(CON, st, y, "oth") }, `${frame}: the Coalition v One Nation is ${st}'s ${y} Senate ballots`);
}

/* ----- where the contests are offered ----- */
const frames = vm.runInNewContext(`(${/const AXIS_FRAMES = (\{[^}]*\})/.exec(draw)[1]})`, {});
const stood = (y) => { const d = JSON.parse(R(`map/data/core-${y}.json`)).divs; return d.filter((x) => x.c.some((c) => c[3] === "onp")).length / d.length; };
const NOW_OF = { now: "2025", qldnow: "qld24" };
for (const f of Object.keys(frames)) assert.ok(stood(NOW_OF[f] || f) >= 0.75, `${f}: One Nation stood in three seats in four`);
for (const f of fs.readdirSync(path.join(ROOT, "map/data")).filter((n) => /^core-\w+\.json$/.test(n)).map((n) => n.slice(5, -5))) {
  // (1998 and 2001 qualify on candidates but have no Senate ballots to read)
  if (frames[f] == null && f !== "1998" && f !== "2001") assert.ok(stood(f) < 0.75, `${f}: One Nation stood widely, so it should offer the contests`);
}
for (const y of new Set(Object.entries(frames).filter(([f]) => !/^(qld|sa)/.test(f)).map(([, v]) => v))) assert.ok(fs.existsSync(path.join(ROOT, `map/data/senate-prefs-${y}.json`)), `${y}'s Senate orders are on file`);

/* ----- the Greens pairings ----- */
{ // menued on the federal frames only: they read the ballot files' own tallies (54 counts a row), which the constant-rate state frames' series don't carry
  assert.ok(ui.includes('const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];') || draw.includes('const AXIS_GREEN_PAIRS = [["GO", "Greens v One Nation"], ["GA", "Greens v Labor"], ["GC", "Greens v the Coalition"]];'), "the three Greens pairings are menued: against One Nation, Labor, the Coalition");
  assert.ok(draw.includes("...(m && STATE_YEARS.has(m.year) ? [] : AXIS_GREEN_PAIRS)]"), "the Greens pairings ride only the federal frames' menus");
  assert.ok(draw.includes('const axisOffers = (m, pair) => SP_PAIRS[pair] != null && (!AXIS_GREEN_SET.has(pair) || !STATE_YEARS.has(m.year));'), "a pairing is offered only where its evidence carries it");
  assert.ok(draw.includes('return axisOffers(m, S.axis) ? S.axis : "AC";'), "a pairing the frame can't carry falls back to the count, the choice kept for the walk back");
  assert.ok(draw.includes('pair === "CO" || pair === "GO" ? 40 : 30'), "the One Nation pairings run the long-spread scale, the others' the usual");
  assert.ok(draw.includes('(cap ? "The Greens" : "the Greens")'), "a pairing names its Greens");
  assert.ok(ui.includes("axisOpts(m)"), "the key's contest menu is the frame's own");
  assert.ok(ui.includes("!AXIS_GREEN_SET.has(spp)"), "the Senate preferences lens keeps its own three (a crafted Greens sp address can't reach it)");
  for (const y of [2022, 2025]) {
    const f = JSON.parse(R(`map/data/senate-prefs-${y}.json`));
    assert.deepEqual(f.pairs, ["AC", "AO", "CO", "GO", "GA", "GC"], `senate-prefs-${y}'s slots run AC AO CO GO GA GC, the order the app's k0 walks`);
    assert.ok(f.donors.GO.join() === "alp,lnp,oth" && f.donors.GA.join() === "lnp,onp,oth" && f.donors.GC.join() === "alp,onp,oth", `senate-prefs-${y}: each Greens pairing tallies the three groups whose preferences decide it`);
  }
  // where a seat really ran the pairing, its count stands: Melbourne's 2025 final two were Labor and
  // the Greens, Ryan's the LNP and the Greens
  const core25 = JSON.parse(R("map/data/core-2025.json"));
  const finalFams = (n) => { const d = core25.divs.find((x) => x.n === n); return d.tcp.map(([i]) => d.c[i][3]).sort().join("+"); };
  assert.equal(finalFams("Melbourne"), "alp+grn", "Melbourne 2025's final two were Labor and the Greens, the count Greens v Labor reads there");
  assert.equal(finalFams("Ryan"), "grn+lnp", "Ryan 2025's final two were the LNP and the Greens, the count Greens v the Coalition reads there");
  assert.ok(draw.includes("fs.includes(fa) && fs.includes(fb)"), "a seat whose final two was the pairing keeps its count inside it");
}

/* ----- the contest row under Seats ----- */
{ // a seats drawing has no say in the pairing, so the row greys, never drops (the pick's kept for the walk back)
  assert.ok(ui.includes('S.draw === "seats" ?') && ui.includes("paint as balloons or a surface"), "as seats the contest row greys with the reason on it, rather than leaving");
  assert.ok(ui.includes('opt("axis", pair, axisOpts(m), off)'), "the greyed row names the contest in force (seats counts the counted one)");
  assert.ok(ui.includes("function lgMenu(key, items, cur, aria, off)"), "a panel menu can grey whole by its state");
  assert.ok(R(".build/map/app/page.css").includes(".lg-bmenu > .st-sclab:disabled"), "the greyed trigger is styled like an unfit Draw chip");
}

/* ----- the wiring ----- */
assert.ok(/closest\("[^"]*\[data-draw\][^"]*"\)/.test(ui), "the page's click handler listens for the drawing's buttons");
assert.ok(ui.includes('if (t.dataset.draw) { setDraw(t.dataset.draw); return; }'), "and acts on them");
assert.ok(ui.includes('p.set("draw", S.draw)') && ui.includes('p.get("draw")'), "the URL carries the drawing both ways");
assert.ok(ui.includes('p.set("ax", S.axis)') && ui.includes('p.get("ax")'), "the URL carries the contest both ways");
assert.ok(!/for \(const dw of S\.view === "map" \? DRAWS\.map/.test(ui) && /for \(const dw of \[S\.draw\]\)/.test(ui), "the key holds only the current drawing's booth faces, so slimmer views stop inheriting taller surfaces' peaks");
assert.ok(ui.includes('recolor(false);\n  $$(".mp-views .rd-tab")'), "leaving the map for the chamber or the list drops a built contest's colours");
const index = R("map/index.html");
assert.ok(index.includes("Labor v One Nation, the Coalition v One Nation, and the Greens v One Nation, Labor and the Coalition are not counted"), "the page's notes name the built contests, the Greens pairings among them");

/* ----- the zoom carries on past the gesture, the same in every browser -----
   (it went missing in Chrome and Firefox for ten days: their pinch sends no lift, so it had been
   switched off for them. The pace rule runs here on made-up streams; real input is in
   .matilda/probe/map-zoom-residual.mjs) */
const mapSrc = R(".build/map/app/app-2-map.js");
const rule = /function pinchPace\(ss, beat\) \{[\s\S]*?\n\}\n/.exec(mapSrc)[0];
const consts = /Z_NOW = (\d+)[\s\S]*?Z_BEFORE = (\d+)/.exec(mapSrc);
const pinchPace = vm.runInNewContext(`const Z_NOW = ${consts[1]}, Z_BEFORE = ${consts[2]}; const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }; (${rule.trim()})`, { Math });
const stream = (ds, beat = 16) => ds.map((d, i) => [i * beat, d]);
const flat = (n, d) => Array.from({ length: n }, () => d);
assert.ok(Math.abs(pinchPace(stream(flat(26, 0.087)), 16) - 5.4) < 0.3, "lifted in motion, it carries on at that pace");
assert.ok(Math.abs(pinchPace(stream(flat(26, -0.087)), 16) + 5.4) < 0.3, "out as well as in");
assert.ok(Math.abs(pinchPace(stream(flat(20, 0.087), 65), 65) - 1.34) < 0.1, "at a busy map's slow beat too");
assert.ok(pinchPace(stream([...flat(22, 0.087), ...[0.9, 0.8, 0.7, 0.6, 0.55, 0.5].map((f) => 0.087 * f)]), 16) > 2, "slowing but still moving at the lift, it carries on");
assert.ok(pinchPace(stream([...flat(22, 0.087), ...[1, 0.8, 0.6, 0.42, 0.28, 0.17, 0.09, 0.04].map((f) => 0.087 * f)]), 16) < 0.6, "coming to rest, it doesn't");
assert.equal(pinchPace(stream([0.087, 0.087]), 16), 0, "a twitch has no pace to read");
assert.ok(mapSrc.includes("pinchStep(px, py, -e.deltaY / (100 * Math.LN2), e.timeStamp);"), "a ctrl-wheel pinch (Chrome, Firefox) feeds the release");
assert.equal((mapSrc.match(/zoomRelease\(/g) || []).length, 3, "the one release rule serves the ctrl-wheel pinch, Safari's and a phone's");
assert.ok(!/navigator\.userAgent|isSafari|isChrome|isFirefox/.test(mapSrc), "nothing in the map turns on the browser");

console.log("test-map-draw: ok");
