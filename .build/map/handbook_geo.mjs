// Lossless Handbook GeoJSON -> unquantized TopoJSON. No simplification,
// clipping, snapping, gap filling, coordinate rounding or island deletion.
// One arc per ring preserves the source coordinate sequence, including Z.
// Source files: pinned revision and SHA-256s in handbook-boundaries-audit.json.
// node .build/map/handbook_geo.mjs [cache-directory]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';
import * as d3 from 'd3';
import polylabel from 'polylabel';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cache = process.argv.slice(2).find(a=>!a.startsWith('--')) || `${root}/.matilda/handbook-boundaries`;
const fetchMissing = process.argv.includes('--fetch');
const out = `${root}/map/data`;
const audit = JSON.parse(fs.readFileSync(`${root}/.build/map/handbook-boundaries-audit.json`));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sources = {source:audit.source, revision:audit.revision,
  copyright:'Commonwealth of Australia (Parliamentary Handbook); extracted by Tim Sherratt',
  licence:'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  terms:'https://www.aph.gov.au/Help/Disclaimer_Privacy_Copyright',
  conversion:'Lossless GeoJSON to unquantized TopoJSON. All polygon coordinates and rings retained; no geometry repairs or simplification. Non-commercial display.', elections:{}};
const resState = name => ({'New South Wales':'NSW','Victoria':'VIC','Queensland':'QLD','Western Australia':'WA','South Australia':'SA','Tasmania':'TAS','Australian Capital Territory':'ACT','Northern Territory':'NT'})[name];
const polygons = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : g.type === 'GeometryCollection' ? g.geometries.flatMap(polygons) : g.type === 'Point' ? [] : (()=>{throw Error(g.type);})();

for (const year of [1993, 1996, 1998]) {
  const selection = audit.elections[year].selection;
  const features = [];
  for (const record of selection) {
    const file = `${cache}/source/geojson/${record.geojson_file}`;
    if (!fs.existsSync(file) && fetchMissing) {
      const response = await fetch(`https://raw.githubusercontent.com/wragge/historical-federal-electorate-boundaries/${audit.revision}/geojson/${encodeURIComponent(record.geojson_file)}`);
      if (!response.ok) throw Error(`Source download failed: ${response.status} ${record.geojson_file}`);
      fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
    }
    const original = fs.readFileSync(file);
    if (hash(original) !== record.sha256) throw Error(`Source hash changed: ${record.geojson_file}`);
    const st = resState(record.state);
    features.push({type:'Feature', properties:{name:record.canonical_name, st, map_id:record.map_id},
      geometry:{type:'MultiPolygon',coordinates:JSON.parse(original).features.flatMap(f=>polygons(f.geometry))}});
  }
  const fc = {type:'FeatureCollection',features};
  const resultPath = `${out}/${year === 1996 ? 'res' : 'data'}-${year}.json`;
  const res = JSON.parse(fs.readFileSync(resultPath));
  const byName = new Map(res.divs.map(d => [d.n, d]));
  const arcs = [], geometries = [], seen = new Set();
  const records = audit.elections[year].selection.map(r=>({...r}));
  for (const f of fc.features) {
    const {name, st, map_id} = f.properties;
    const record = records.find(r=>r.map_id === map_id);
    const original = fs.readFileSync(`${cache}/source/geojson/${record.geojson_file}`);
    if (hash(original) !== record.sha256) throw Error(`${year} ${name}: source hash changed`);
    const originalPolys = JSON.parse(original).features.flatMap(f=>polygons(f.geometry));
    if (JSON.stringify(originalPolys) !== JSON.stringify(f.geometry.coordinates)) throw Error(`${year} ${name}: assembled coordinates differ from source`);
    record.polygonSHA256 = hash(JSON.stringify(originalPolys));
    if (!byName.has(name) || byName.get(name).st !== st || seen.has(name)) throw Error(`${year}: unjoined ${name}`);
    seen.add(name);
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    geometries.push({type:'MultiPolygon', properties:{name, st, map_id}, arcs:polys.map(p => p.map(r => {
      if (JSON.stringify(r[0]) !== JSON.stringify(r.at(-1))) throw Error(`Unclosed source ring: ${name}`);
      arcs.push(r); return [arcs.length - 1];
    }))});
  }
  if (seen.size !== byName.size) throw Error(`${year}: missing division`);
  const topo = {type:'Topology', objects:{divs:{type:'GeometryCollection', geometries}}, arcs,
    handbook:true, sourceRevision:audit.revision, copyright:sources.copyright, licence:sources.licence,
    source:audit.source, attribution:'/map/data/historical-boundary-sources.json'};
  const roundtrip = topojson.feature(topo, topo.objects.divs);
  for (let i = 0; i < fc.features.length; i++) {
    if (JSON.stringify(roundtrip.features[i].geometry) !== JSON.stringify(fc.features[i].geometry)) throw Error(`${year}: geometry changed`);
  }
  // Display fitting and label placement only. Original published arcs above
  // stay untouched. D3 requires clockwise exterior rings; winding is a
  // display convention, not an edit to the source geometry.
  const display = structuredClone(fc);
  for (const f of display.features) for (const p of f.geometry.coordinates) {
    for (let i = 0; i < p.length; i++) {
      const large = d3.geoArea({type:'Polygon', coordinates:[p[i]]}) > 2 * Math.PI;
      if (large === (i === 0)) p[i].reverse();
    }
  }
  const fit = {type:'MultiPoint', coordinates:display.features.flatMap(f => f.geometry.coordinates.flat(2)).filter(([x,y])=>x>=112&&x<=154.5&&y>=-44.5&&y<=-9)};
  const proj = d3.geoConicEqualArea().parallels([-18,-36]).rotate([-132,0]).fitSize([1000,880], fit);
  for (const f of display.features) {
    const polys = f.geometry.coordinates.filter(p => p[0].some(([x,y])=>x>=112&&x<=154.5&&y>=-44.5&&y<=-9));
    const best = polys.sort((a,b)=>Math.abs(d3.polygonArea(b[0].map(proj)))-Math.abs(d3.polygonArea(a[0].map(proj))))[0];
    byName.get(f.properties.name).lp = proj.invert(polylabel(best.map(r=>r.map(proj)), .5));
  }
  const body = JSON.stringify(topo);
  fs.writeFileSync(`${out}/geo-${year}-lo.json`, body);
  fs.writeFileSync(`${out}/geo-${year}-hi.json`, body);
  res.boundarySource = 'Parliamentary Handbook, via Tim Sherratt; CC BY-NC-ND 4.0. Original geometry retained.';
  fs.writeFileSync(`${out}/res-${year}.json`, JSON.stringify(res));
  sources.elections[year] = {date:res.date, divisions:seen.size, geometrySHA256:hash(body),
    maps:records};
  console.log(year, seen.size, 'lossless geometries;', body.length, 'bytes; coordinate round-trip exact');
}
fs.writeFileSync(`${out}/historical-boundary-sources.json`, JSON.stringify(sources));

// Timeline summaries are derived from the exact same certified result records.
const summary = JSON.parse(fs.readFileSync(`${out}/summary.json`));
for (const year of [1993,1996,1998]) {
  const r = JSON.parse(fs.readFileSync(`${out}/res-${year}.json`));
  summary.seats[year] = {}; summary.tpp[year] = {};
  for (const [st, a] of Object.entries(r.agg)) {
    const tally = {};
    for (const d of r.divs.filter(d=>st==='AUS'||d.st===st)) {
      const c = d.c.find(c=>c[6]); tally[c[3]] = (tally[c[3]]||0)+1;
    }
    summary.seats[year][st] = tally;
    summary.tpp[year][st] = 100 * a.tpp[0] / (a.tpp[0]+a.tpp[1]);
  }
}
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(summary));

// Inset coastlines are the site's existing schematic layer. The 1993–98
// Handbook polygons omit these islands; their seat association is recorded
// independently in the AEC's polling-place returns. Do not graft modern
// coastline coordinates into the licensed historical boundary files.
const islands = JSON.parse(fs.readFileSync(`${out}/islands.json`));
for (const year of [1993,1996,1998]) {
  const r = JSON.parse(fs.readFileSync(`${out}/res-${year}.json`));
  const seat = name => {
    const hits = r.booths.n.flatMap((n,i)=>n===name?[r.divs[r.booths.d[i]].n]:[]);
    if(hits.length!==1)throw Error(`${year}: ambiguous island place ${name}`);
    return hits[0];
  };
  if(seat('Home Island')!==seat('West Island'))throw Error('Cocos seat mismatch');
  islands.owner[year] = {norfolk:null, lordhowe:seat('Lord Howe Island'), christmas:seat('Christmas Island'), cocos:seat('Home Island')};
}
fs.writeFileSync(`${out}/islands.json`, JSON.stringify(islands));
