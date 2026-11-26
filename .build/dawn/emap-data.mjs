/* The electoral map page's figures (/dawn/electoral-map/), from the main site's /map/ data
   (map/data): each 2025 seat's two-candidate count, the House since (data-now.json: members who
   changed party, by-elections), the seats each party won at every election back to 1993, and the
   2025 boundaries.

   The boundaries are the map's own (geo-2025-hi.json, TopoJSON), projected here (Mercator, the
   mainland and Tasmania 1000 units wide; the external territories left off) and simplified arc by
   arc, so neighbours still share one border. A border keeps detail in proportion to the smallest
   seat on it: a city seat is drawn finely, an outback one coarsely. */
import fs from "node:fs";
import path from "node:path";

export const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
/* the seat bar's groups, in the order it draws them */
export const GROUPS = [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"], ["ind", "Independents"], ["oth", "Others"]];
export const groupOf = (ab) => (ab === "ALP" ? "alp" : ["LP", "NP", "LNP", "CLP", "LNQ"].includes(ab) ? "lnp" : ab === "GRN" ? "grn" : ab === "ON" ? "onp" : ab === "IND" ? "ind" : "oth");
const PARTY = { ALP: "Labor", LP: "Liberal", NP: "Nationals", LNP: "Liberal National", CLP: "Country Liberal", GRN: "Greens", ON: "One Nation", IND: "Independent", KAP: "Katter’s Australian", XEN: "Centre Alliance", CSA: "Community Strong Australia" };
export const partyName = (ab) => PARTY[ab] || ab;
const CITIES = [["Sydney", 151.02, -33.84, 0.46], ["Melbourne", 145.05, -37.85, 0.42], ["Brisbane", 153.02, -27.5, 0.45], ["Perth", 115.9, -31.95, 0.34], ["Adelaide", 138.6, -34.92, 0.32]];
const BOX = { w: 112.9, e: 153.75, s: -43.75, n: -10.0 };
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const SCALE = 1000 / (((BOX.e - BOX.w) * Math.PI) / 180);
const project = ([lon, lat]) => [(((lon - BOX.w) * Math.PI) / 180) * SCALE, (merc(BOX.n) - merc(lat)) * SCALE];
export const HEIGHT = Math.ceil(project([BOX.w, BOX.s])[1]);

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
  keep[0] = keep[pts.length - 1] = 1;
  /* a closed arc starts and ends on one point: keep the point farthest from it too */
  if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) {
    let far = 0, fd = -1;
    pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
    keep[far] = 1; stack.length = 0; stack.push([0, far], [far, pts.length - 1]);
  }
  while (stack.length) {
    const [a, b] = stack.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let worst = -1, wd = tol;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len; if (d > wd) { wd = d; worst = i; } }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };

export function seatShapes(topo) {
  const { scale, translate } = topo.transform;
  const lonlat = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });
  const arcs = lonlat.map((a) => a.map(project));
  const polys = (g) => (g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : []);
  const ringOf = (ids, A) => ids.flatMap((i, k) => { const a = i < 0 ? [...A[~i]].reverse() : A[i]; return k ? a.slice(1) : a; });
  const inBox = (ids) => ringOf(ids, lonlat).every(([lon, lat]) => lon >= BOX.w - 0.2 && lon <= BOX.e + 0.2 && lat >= BOX.s - 0.2 && lat <= BOX.n + 0.9);
  const geoms = topo.objects.divs.geometries;
  const areaOf = geoms.map((g) => polys(g).filter((p) => inBox(p[0])).reduce((t, p) => t + ringArea(ringOf(p[0], arcs)), 0));
  const tolOf = new Array(arcs.length).fill(Infinity);
  geoms.forEach((g, gi) => polys(g).forEach((p) => p.forEach((ring) => ring.forEach((i) => { const k = i < 0 ? ~i : i; tolOf[k] = Math.min(tolOf[k], Math.max(0.012, Math.min(0.55, Math.sqrt(areaOf[gi]) * 0.012))); }))));
  const slim = arcs.map((a, i) => simplify(a, Number.isFinite(tolOf[i]) ? tolOf[i] : 0.5));
  const fmt = (v) => String(Math.round(v * 100) / 100);
  return geoms.map((g, gi) => {
    const rings = polys(g).filter((p) => inBox(p[0])).flatMap((p) => p.map((ids) => ringOf(ids, slim))).filter((r) => r.length > 2);
    /* islets too small to see at any zoom go, never a seat's largest ring */
    const largest = Math.max(...rings.map(ringArea)), floor = Math.min(0.35, areaOf[gi] * 0.004);
    const kept = rings.filter((r) => ringArea(r) >= Math.min(floor, largest));
    const xs = kept.flatMap((r) => r.map((q) => q[0])), ys = kept.flatMap((r) => r.map((q) => q[1]));
    return { n: g.properties.name, d: kept.map((r) => "M" + r.map((q) => fmt(q[0]) + " " + fmt(q[1])).join("L") + "Z").join(""),
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 100) / 100) };
  });
}

export function emapData(root) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "map", "data", f), "utf8"));
  const core = read("core-2025.json"), now = read("data-now.json"), shapes = new Map(seatShapes(read("geo-2025-hi.json")).map((s) => [s.n, s]));
  const seats = core.divs.map((D) => {
    /* the count lists the final pair by ballot order: the winner is the larger */
    const [a, b] = [...D.tcp].sort((p, q) => q[1] - p[1]), w = D.c[a[0]], l = D.c[b[0]], total = a[1] + b[1];
    const shape = shapes.get(D.n);
    if (!shape) throw new Error("emap: no boundary for " + D.n);
    const seat = { n: D.n, st: D.st, cls: D.cls, who: w[0], ab: w[1], vs: l[0], vsAb: l[1], m: Math.round((100 * a[1] / total - 50) * 100) / 100, votes: a[1] - b[1], d: shape.d, box: shape.box, at: project(D.lp).map((v) => Math.round(v * 10) / 10) };
    /* what has changed since: a member's new party, or a by-election's winner */
    const holder = now.holders && now.holders[D.n];
    if (holder) {
      const story = now.changes.filter((c) => c.div === D.n);
      seat.now = { who: holder.n, ab: holder.ab, text: story.length ? story[story.length - 1].text : "", date: story.length ? story[story.length - 1].date : "" };
    }
    return seat;
  });
  const count = (list, ab) => { const o = Object.fromEntries(GROUPS.map(([k]) => [k, 0])); for (const s of list) o[groupOf(ab(s))]++; return o; };
  const history = YEARS.map((y) => {
    const d = y === 2025 ? core : read("core-" + y + ".json"), by = Object.fromEntries(GROUPS.map(([k]) => [k, 0]));
    for (const [ab, n] of Object.entries(d.agg.AUS.seats)) by[groupOf(ab)] += n;
    return { y, date: d.date, seats: by, total: Object.values(by).reduce((t, v) => t + v, 0) };
  });
  const today = { asOf: now.asOf, seats: count(seats, (s) => (s.now ? s.now.ab : s.ab)), changed: seats.filter((s) => s.now).length };
  const cities = CITIES.map(([name, lon, lat, r]) => {
    const inside = seats.filter((s, i) => { const [x, y] = core.divs[i].lp; return Math.hypot(x - lon, y - lat) <= r; });
    const pts = inside.map((s) => s.at), pad = 4;
    const x0 = Math.min(...pts.map((p) => p[0])) - pad, x1 = Math.max(...pts.map((p) => p[0])) + pad, y0 = Math.min(...pts.map((p) => p[1])) - pad, y1 = Math.max(...pts.map((p) => p[1])) + pad;
    return { name, view: [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * 10) / 10), n: inside.length };
  });
  /* the national view takes in every seat: the Torres Strait reaches above the mainland frame */
  const lo = (i) => Math.floor(Math.min(...seats.map((s) => s.box[i]))), hi = (i) => Math.ceil(Math.max(...seats.map((s) => s.box[i])));
  const frame = [lo(0), lo(1), hi(2) - lo(0), hi(3) - lo(1)];
  return { v: 1, asOf: now.asOf, election: { date: core.date }, frame, seats, history, today, cities };
}
