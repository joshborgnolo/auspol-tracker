// MapInfo MIF/MID (Region objects) -> GeoJSON FeatureCollection.
// Rings in a MapInfo region carry no outer/hole flag, so nesting decides:
// a ring inside an odd number of the region's other rings is a hole of the
// smallest ring that holds it.
// usage: node mif2geojson.mjs <out.geojson> <a.mif> [b.mif ...]   (the .mid sits beside each .mif)
import fs from "fs";
import path from "path";

const [, , outPath, ...mifs] = process.argv;

function midPath(mif) {
  const dir = path.dirname(mif), base = path.basename(mif).replace(/\.mif$/i, "");
  const hit = fs.readdirSync(dir).find((f) => f.toLowerCase() === (base + ".mid").toLowerCase());
  if (!hit) throw new Error("no MID beside " + mif);
  return path.join(dir, hit);
}

// MID rows: comma-delimited, double-quoted strings
function parseMidLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
const bbox = (r) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of r) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
function inRing(pt, r) {
  const [x, y] = pt; let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function regionToGeometry(rings) {
  rings = rings.filter((r) => r.length >= 4);
  if (!rings.length) return null;
  const info = rings.map((r) => ({ r, bb: bbox(r), area: Math.abs(ringArea(r)) }));
  // a ring's probe point: its first vertex nudged a hair towards its own bbox centre
  for (const a of info) {
    const cx = (a.bb[0] + a.bb[2]) / 2, cy = (a.bb[1] + a.bb[3]) / 2;
    a.probe = [a.r[0][0] + (cx - a.r[0][0]) * 1e-6, a.r[0][1] + (cy - a.r[0][1]) * 1e-6];
  }
  for (const a of info) {
    a.holders = info.filter((b) => b !== a && b.area > a.area && a.bb[0] >= b.bb[0] && a.bb[2] <= b.bb[2] && a.bb[1] >= b.bb[1] && a.bb[3] <= b.bb[3] && inRing(a.probe, b.r));
    a.depth = a.holders.length;
  }
  const polys = [];
  const outerOf = new Map();
  for (const a of info.filter((x) => x.depth % 2 === 0)) {
    const ring = ringArea(a.r) < 0 ? a.r : [...a.r].reverse(); // outer ring counter-clockwise (RFC 7946)
    const p = [ring];
    polys.push(p);
    outerOf.set(a, p);
  }
  for (const a of info.filter((x) => x.depth % 2 === 1)) {
    const host = a.holders.filter((h) => h.depth === a.depth - 1).sort((p, q) => p.area - q.area)[0];
    const p = outerOf.get(host);
    if (!p) continue;
    p.push(ringArea(a.r) > 0 ? a.r : [...a.r].reverse()); // holes clockwise
  }
  return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
}

const features = [];
for (const mif of mifs) {
  const lines = fs.readFileSync(mif, "latin1").split(/\r?\n/);
  const midRows = fs.readFileSync(midPath(mif), "latin1").split(/\r?\n/).filter((l) => l.trim().length).map(parseMidLine);
  let i = 0;
  const cols = [];
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    const m = l.match(/^Columns\s+(\d+)/i);
    if (m) { const n = +m[1]; for (let k = 1; k <= n; k++) cols.push(lines[i + k].trim().split(/\s+/)[0]); i += n; continue; }
    if (/^Data$/i.test(l)) { i++; break; }
  }
  let obj = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }
    const rm = l.match(/^Region\s+(\d+)/i);
    if (rm) {
      const n = +rm[1]; i++;
      const rings = [];
      for (let k = 0; k < n; k++) {
        while (i < lines.length && !lines[i].trim()) i++;
        const cnt = parseInt(lines[i].trim(), 10); i++;
        const ring = [];
        for (let c = 0; c < cnt; c++, i++) { const [x, y] = lines[i].trim().split(/\s+/).map(Number); ring.push([x, y]); }
        if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push([...ring[0]]);
        rings.push(ring);
      }
      const row = midRows[obj] || [];
      const props = {};
      cols.forEach((c, k) => (props[c] = row[k]));
      const geometry = regionToGeometry(rings);
      if (geometry) features.push({ type: "Feature", properties: props, geometry });
      obj++;
      continue;
    }
    if (/^(None)$/i.test(l)) { obj++; i++; continue; }
    if (/^(Point|Line|Pline|Text|Rect|Roundrect|Ellipse|Arc)\b/i.test(l)) throw new Error(`unexpected ${l} object in ${mif}`);
    i++; // Pen / Brush / Center and other style lines
  }
  if (obj !== midRows.length) throw new Error(`${mif}: ${obj} objects but ${midRows.length} MID rows`);
}
fs.writeFileSync(outPath, JSON.stringify({ type: "FeatureCollection", features }));
console.log(outPath, features.length, "features");
