/* land_build.mjs – map/data/land.json and land-hi.json: Australia's land, one shape a
   state, for the ocean.

   The map lays an atlas's sea under the seats (app-2-map.js, "the ocean"). A federal
   frame's seats cover the whole country, but a state's frame draws only its own state,
   and on a sea the rest of the country would read as water. So every state frame lays
   the other states beneath its seats as plain land, from these files.

   Each is a 2025 federal geometry with each state's divisions merged (topojson
   mergeArcs), only the arcs the merged shapes use, the topology's quantisation kept:
     land.json     from geo-2025-lo.json, as it is (the coast the federal frames draw)
     land-hi.json  from geo-2025-hi.json, each arc thinned to within HI_TOL metres
                   (Douglas-Peucker; an arc's ends stay, so neighbours still meet), for
                   a state's frame zoomed past K_HI, where its own seats turn hi too.
                   The AEC's full hi coast would be 356KB gzipped for context only.
   Re-run after rebuilding either source, then node .build/map/assemble.mjs (the data
   stamps); test-map-ocean.mjs checks both files are current:
     node .build/map/land_build.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const HI_TOL = 300;
export const LANDS = [
  { src: "map/data/geo-2025-lo.json", out: "map/data/land.json", tol: 0 },
  { src: "map/data/geo-2025-hi.json", out: "map/data/land-hi.json", tol: HI_TOL },
];

// an arc's points kept within tol metres of it (its ends always), in quantised units
function thin(pts, tol, [sx, sy], [, ty]) {
  if (pts.length < 3) return pts;
  const P = pts.map(([x, y]) => [x * sx * 111320 * Math.cos(((ty + y * sy) * Math.PI) / 180), y * sy * 110540]);
  const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
  keep[0] = keep[pts.length - 1] = 1;
  while (stack.length) {
    const [a, b] = stack.pop(), [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let far = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const t = L2 ? Math.max(0, Math.min(1, ((P[i][0] - ax) * dx + (P[i][1] - ay) * dy) / L2)) : 0;
      const d = Math.hypot(P[i][0] - ax - t * dx, P[i][1] - ay - t * dy);
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function buildLand(src, tol = 0) {
  const byState = new Map();
  for (const g of src.objects.divs.geometries) {
    const st = g.properties.st;
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(g);
  }
  // the arcs the merged shapes use, renumbered in the order first met (~i: arc i reversed)
  const keep = new Map(), arcs = [];
  const renum = (i) => {
    const a = i < 0 ? ~i : i;
    if (!keep.has(a)) { keep.set(a, arcs.length); arcs.push(src.arcs[a]); }
    return i < 0 ? ~keep.get(a) : keep.get(a);
  };
  const geometries = [...byState.keys()].sort().map((st) => {
    const m = topojson.mergeArcs(src, byState.get(st));
    return { type: m.type, arcs: m.arcs.map((poly) => poly.map((ring) => ring.map(renum))), properties: { st } };
  });
  const out = { type: "Topology", transform: src.transform, arcs, objects: { land: { type: "GeometryCollection", geometries } } };
  if (tol > 0) {
    // (topojson's arcs are delta-coded under a transform: decoded, thinned, coded again)
    const abs = arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => [(x += dx), (y += dy)]); });
    const thinned = abs.map((a) => thin(a, tol, src.transform.scale, src.transform.translate));
    // a ring the thinning would collapse or turn inside out keeps its arcs whole: d3 reads
    // a ring wound the wrong way round as the whole globe but it, and fills the screen
    const ringOf = (ring, A) => { const pts = []; ring.forEach((i, k) => { const a = i < 0 ? A[~i].slice().reverse() : A[i]; pts.push(...(k ? a.slice(1) : a)); }); return pts; };
    const area = (pts) => { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; s += x0 * y1 - x1 * y0; } return s / 2; };
    const distinct = (pts) => new Set(pts.map((p) => p[0] + "," + p[1])).size;
    for (const g of geometries) for (const poly of g.arcs) for (const ring of poly) {
      const a0 = area(ringOf(ring, abs)), t = ringOf(ring, thinned), a1 = area(t);
      if (distinct(t) < 4 || Math.sign(a1) !== Math.sign(a0) || Math.abs(a1) < 0.5 * Math.abs(a0)) for (const i of ring) thinned[i < 0 ? ~i : i] = abs[i < 0 ? ~i : i];
    }
    out.arcs = thinned.map((a) => { let px = 0, py = 0; return a.map(([X, Y]) => { const d = [X - px, Y - py]; px = X; py = Y; return d; }); });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { src, out, tol } of LANDS) {
    const t = buildLand(JSON.parse(fs.readFileSync(path.join(ROOT, src), "utf8")), tol);
    const body = JSON.stringify(t);
    fs.writeFileSync(path.join(ROOT, out), body);
    console.log(out, body.length, "bytes,", t.objects.land.geometries.length, "states,", t.arcs.length, "arcs");
  }
}
