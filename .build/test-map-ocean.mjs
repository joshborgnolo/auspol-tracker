/* test-map-ocean.mjs – the electoral map's sea (app-2-map.js, "the ocean" and "the waters' names").
   - map/data/land.json is current with its source (land_build.mjs) and holds every state;
   - the lines of latitude and longitude are exact: gratOf's apex, radii and meridian angles,
     run as shipped, put every graticule point where d3's own projection does, in every
     frame's fit, so the circles and rays layGrat draws on the screen are the projection's;
   - every name of a water stands on water and is written in sentence case;
   - the paint order the sea needs: under the frame before anything, back beneath laySea's
     cut, never tinted by Esri's own sea fill; the italic its names are set in is served.
   node .build/test-map-ocean.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoArea, geoConicEqualArea, geoContains } from "d3-geo";
import * as topojson from "topojson-client";
import { buildLand, LANDS } from "./map/land_build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const map2 = R(".build/map/app/app-2-map.js");

// ---- the land beneath a state's frame
for (const { src, out, tol } of LANDS) {
  const t = JSON.parse(R(out));
  assert.equal(JSON.stringify(t), JSON.stringify(buildLand(JSON.parse(R(src)), tol)), `${out} is current (node .build/map/land_build.mjs, then assemble.mjs)`);
  assert.deepEqual(t.objects.land.geometries.map((g) => g.properties.st), ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"], `${out}: one shape for each state and territory`);
}
// no ring wound the wrong way round (d3 would read it as the globe but it, and fill the screen)
for (const { out } of LANDS) {
  const t = JSON.parse(R(out));
  for (const g of t.objects.land.geometries) {
    const f = topojson.feature(t, g), a = geoArea(f);
    assert.ok(a > 0 && a < 0.1, `${out} ${g.properties.st}: a state's own area (${a.toFixed(4)} sr; the whole globe is 12.57)`);
    // (an outer ring alone is a small patch; a hole alone is the globe less a small patch)
    for (const poly of f.geometry.coordinates) poly.forEach((ring, k) => {
      const ra = geoArea({ type: "Polygon", coordinates: [ring] });
      assert.ok(k ? ra > 2 * Math.PI : ra < 2 * Math.PI, `${out} ${g.properties.st}: every ${k ? "hole" : "outer ring"} wound as d3 reads it (${ring.length} points at ${ring[0]})`);
    });
  }
}
assert.ok(R("map/data/land-hi.json").length < 400e3, "land-hi.json stays thin (context for a state's frame, not a second copy of the seats)");
const land = JSON.parse(R("map/data/land.json"));
const feats = land.objects.land.geometries.map((g) => topojson.feature(land, g));
const onLand = (ll) => feats.some((f) => geoContains(f, ll));
for (const [ll, st] of [[[133.9, -23.7], "NT"], [[146.8, -42], "TAS"], [[117.9, -31], "WA"], [[149.13, -35.3], "ACT"]]) assert.ok(onLand(ll), `land.json: ${st} is land at ${ll}`);

// ---- the graticule, exact
const grat = map2.match(/@grat-begin[^*]*\*\/([\s\S]*?)\/\* @grat-end \*\//);
assert.ok(grat, "app-2-map.js marks gratOf for this test");
const { gratOf, degLat, degLon, tropicOn } = new Function("GRAT_STEP", `${grat[1]}; return { gratOf, degLat, degLon, tropicOn };`)(10);
// the Tropic of Capricorn: each day's own mean axial tilt (arc-second true over the timeline)
{
  const secs = (iso) => -tropicOn(iso) * 3600; // in arcseconds south of the equator
  assert.ok(Math.abs(secs("2000-01-01T12:00:00Z") - 84381.448) < 0.01, "the Tropic sits on J2000.0's mean obliquity, 23°26′21.448″ south");
  // the datebook figures the frames span: 23°26′24.7″ south at 1993, 23°26′09.2″ at 2026
  assert.ok(Math.abs(secs("1993-01-01") - 84384.7) < 0.2, `the Tropic at 1993 stands 23°26′24.7″ south (reads ${secs("1993-01-01").toFixed(1)}″)`);
  assert.ok(Math.abs(secs("2026-01-01") - 84369.2) < 0.2, `the Tropic at 2026 stands 23°26′09.2″ south (reads ${secs("2026-01-01").toFixed(1)}″)`);
  // and creeps north about half a second of arc a year the while between elections
  const creep = (secs("1993-03-13") - secs("2025-05-03")) / ((Date.parse("2025-05-03") - Date.parse("1993-03-13")) / (365.25 * 864e5));
  assert.ok(creep > 0.43 && creep < 0.51, `the drift north runs about half an arcsecond a year (${creep.toFixed(3)}″ between the 1993 and 2025 election days)`);
}
const TR = tropicOn("2025-05-03"); // one framed day's own tropic, for the graticule work below
// a line's degree as an atlas marks it
for (const [v, want] of [[degLat(-30), "30°S"], [degLat(0), "0°"], [degLat(10), "10°N"], [degLon(130), "130°E"], [degLon(310), "50°W"], [degLon(-40), "40°W"], [degLon(180), "180°"], [degLon(0), "0°"], [degLon(170), "170°E"]]) assert.equal(v, want, `degree mark ${want}`);
const fed = { type: "MultiPoint", coordinates: [[112.9, -43.7], [153.7, -10.6]] };
const fits = [
  ["the federal frame", fed, [1000, 880]],
  ["Victoria's frame", { type: "MultiPoint", coordinates: [[140.9, -39.2], [150, -33.9]] }, [1000, 880]],
  ["Western Australia's frame", { type: "MultiPoint", coordinates: [[112.9, -35.2], [129, -13.7]] }, [1000, 880]],
  ["a narrow stage", fed, [300, 900]],
];
for (const [name, ext, size] of fits) {
  const P = geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize(size, ext);
  const G = gratOf(P, TR), tol = 1e-9 * P.scale();
  let worst = 0;
  for (let lat = -80; lat <= 80; lat += 10) for (let lon = -40; lon <= 310; lon += 2.5) {
    const p = P([lon, lat]), r = G.R.get(lat), t = G.t0 + (lon - 132) * G.dt;
    worst = Math.max(worst, Math.hypot(p[0] - (G.C[0] + r * Math.cos(t)), p[1] - (G.C[1] + r * Math.sin(t))));
  }
  assert.ok(worst < tol, `${name}: every parallel is a circle about the apex and every meridian a ray from it (worst ${worst.toExponential(2)} of ${P.scale().toFixed(0)})`);
  let wt = 0;
  for (let lon = -40; lon <= 310; lon += 2.5) { const p = P([lon, TR]), t = G.t0 + (lon - 132) * G.dt; wt = Math.max(wt, Math.hypot(p[0] - (G.C[0] + G.Rt * Math.cos(t)), p[1] - (G.C[1] + G.Rt * Math.sin(t)))); }
  assert.ok(wt < tol, `${name}: the Tropic of Capricorn is drawn on its own circle (worst ${wt.toExponential(2)})`);
  // the apex lies to the south, below the country (the waters' names curve over it)
  assert.ok(G.C[1] > P([132, -44])[1], `${name}: the apex lies south of the map`);
  // the fan the round of longitude spans ends at the projection's own cut, opposite 132E
  const half = 180 * Math.abs(G.dt), cutW = P([-47.9999, -30]), cutE = P([311.9999, -30]);
  const angW = Math.atan2(cutW[1] - G.C[1], cutW[0] - G.C[0]), angE = Math.atan2(cutE[1] - G.C[1], cutE[0] - G.C[0]);
  assert.ok(Math.abs(Math.min(angW, angE) - (G.t0 - half)) < 1e-5 && Math.abs(Math.max(angW, angE) - (G.t0 + half)) < 1e-5, `${name}: the fan ends at the cut`);
  // gratOf keeps one answer a projection, a new one when its fit or its day moves
  assert.equal(gratOf(P, TR), G, `${name}: gratOf is kept on the projection`);
  const G93 = gratOf(P, tropicOn("1993-03-13"));
  assert.notEqual(G93, G, `${name}: another day's Tropic gets its own circle worked out`);
  assert.ok(G93.Rt < G.Rt, `${name}: the 1993 tropic stands south of 2025's, nearer the apex`);
}
{
  const P = geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitSize([1000, 880], fed), G = gratOf(P, TR);
  P.scale(P.scale() * 2);
  assert.notEqual(gratOf(P, TR), G, "gratOf: a projection refitted gets its apex worked out again");
}

// ---- the waters' names
const names = map2.match(/@sea-names-begin \*\/([\s\S]*?)\/\* @sea-names-end \*\//);
assert.ok(names, "app-2-map.js marks SEA_NAMES for this test");
const SEA_NAMES = new Function(`${names[1]}; return SEA_NAMES;`)();
assert.ok(SEA_NAMES.length >= 20, "the oceans, seas, gulfs, straits and big bays are named");
for (const want of ["Indian Ocean", "Southern Ocean", "Pacific Ocean", "Coral Sea", "Tasman Sea", "Arafura Sea", "Timor Sea", "Great Australian\nBight", "Gulf of\nCarpentaria", "Bass Strait", "Torres Strait", "Spencer Gulf", "Gulf St Vincent", "Port Phillip", "Moreton Bay"]) {
  assert.ok(SEA_NAMES.some(([n]) => n === want), `named: ${want.replace("\n", " ")}`);
}
for (const [n, size, spots] of SEA_NAMES) {
  const flat = n.replace(/\n/g, " ");
  // sentence case: each word capitalised but the small ones, never spaced capitals
  assert.ok(!/[A-Z]{2}/.test(n) && n.split(/[ \n]/).every((w) => /^[A-Z][a-z]+$/.test(w) || ["of", "St"].includes(w)), `${flat}: written in sentence case`);
  assert.ok(size >= 12 && size <= 18, `${flat}: a size the sea's lettering runs (12-18px)`);
  assert.ok(spots.length >= 1, `${flat}: at least one spot`);
  for (const sp of spots) {
    assert.ok(!onLand([sp[0], sp[1]]), `${flat}: its spot ${sp.slice(0, 2)} lies on water`);
    if (sp[2] != null) assert.ok(Math.abs(sp[2]) <= 90, `${flat}: a gulf's line reads left to right (|deg| <= 90)`);
  }
}

// ---- the inland waters' names (harbours, bays, lakes, rivers): shown from street zoom on
// Esri's own water, so their spots can't be tested against the AEC's land (the AEC draws its
// seats across every harbour); each was checked against Esri's sea tiles when chosen, and the
// paint lays a name only where its room reads as water there (roomWet)
const wn = map2.match(/@water-names-begin \*\/([\s\S]*?)\/\* @water-names-end \*\//);
assert.ok(wn, "app-2-map.js marks WATER_NAMES for this test");
const WATER_NAMES = new Function(`${wn[1]}; return WATER_NAMES;`)();
for (const want of ["Sydney Harbour", "Botany Bay", "Lake Macquarie", "Port Phillip", "Western Port", "Moreton Bay", "River Derwent", "Swan River", "Darwin Harbour", "Lake Alexandrina"]) assert.ok(WATER_NAMES.some(([n]) => n === want), `water named: ${want}`);
assert.equal(new Set(WATER_NAMES.map(([n]) => n)).size, WATER_NAMES.length, "each water named once");
for (const [n, size, spots] of WATER_NAMES) {
  assert.ok(!/[A-Z]{2}/.test(n) && n.split(" ").every((w) => /^[A-Z][a-z]+$/.test(w) || ["of", "St"].includes(w)), `${n}: written in sentence case`);
  assert.ok(size >= 11 && size <= 13, `${n}: a size below the seas' (11-13px)`);
  assert.ok(spots.length >= 1 && spots.every((sp) => sp.length === 3 && sp[0] > 112 && sp[0] < 154.5 && sp[1] > -44.5 && sp[1] < -9 && Math.abs(sp[2]) <= 90), `${n}: spots [lon, lat, deg] in the frame, reading left to right`);
}
assert.ok(map2.includes('if (kind) { if (kind === "water") out.sea.push(') && map2.includes('"Water area large scale": "water"'), "Esri's lakes and broad rivers join its sea: they read as water at street zoom, as the harbours do");
assert.ok(map2.includes('for (const s of lab.spots) if (s.kind !== "water") spots.push('), "Esri's own water names give way to the atlas lettering's (drawWaterNames)");
assert.ok(/drawSeaNames\(m, placed\);\s*drawWaterNames\(m, placed, obst\);\s*\/\/ the streets' own names last/.test(map2), "the waters' names after the seas', before the streets'");
assert.ok(map2.includes("if (i % 3 === 1) { n++; wet++; continue; }") && map2.includes("return n > 0 && wet / n >= 0.8;"), "a water's name stands where its letters' middle is all water and four-fifths of its room is");

// ---- the paint order
const ui = R(".build/map/app/app-6-ui.js");
const fr = ui.slice(ui.indexOf("function frame(ts)"));
assert.ok(fr.indexOf("drawOcean(m, 1)") > 0 && fr.indexOf("drawOcean(m, 1)") < fr.indexOf("if (!m || !m.divCol) return;"), "frame: the sea is laid first, before anything (and before a frame not yet coloured returns)");
assert.ok(R(".build/map/app/app-3-chamber.js").includes("drawOcean(m, 1 - p / 0.55)"), "the chamber's morph fades the sea with the map");
const laySea = map2.slice(map2.indexOf("function laySea("), map2.indexOf("\n}\n", map2.indexOf("function laySea(")));
assert.ok(laySea.indexOf('"destination-out"') < laySea.indexOf("oceanUnder(m)") && laySea.indexOf("oceanUnder(m)") < laySea.indexOf("ctx.drawImage(seaLay"), "laySea: cut the seats from Esri's sea, lay the ocean back beneath, then the sheet's marks on the water");
assert.ok(laySea.includes("ctx.globalCompositeOperation = st.op; ctx.drawImage(seaLay"), "laySea: the sheet's marks multiply onto the ocean as the streets do onto the land");
assert.ok(/if \(kind === "water"\) out\.sea\.push\([^)]*\); else out\.fills\[kind\]\.push/.test(map2) && map2.includes('"Marine area": "water"'), "Esri's Marine area (and its lakes) are the sea mask only, never a water fill tinting the ocean");
assert.ok(/L\.clip\(st\.known\);[\s\S]{0,260}L\.fillStyle = css\(TH\.bg\); L\.fillRect\(0, 0, W, H\);/.test(map2), "layWaters: plain land under the seats' waters, so Esri's land beyond them never shows the sea");
assert.ok(map2.includes("ctx.save(); ctx.clip(box); layPaper(a); ctx.restore();"), "an island's box shows the sea's paper");
const html = R("map/index.html"), italic = html.match(/font-style: italic;\s*font-weight: 400;[^}]*url\("\/assets\/fonts\/(crimsontext-italic-400-latin\.[0-9a-f]+\.woff2)"\)/);
assert.ok(italic && fs.existsSync(path.join(ROOT, "assets/fonts", italic[1])), "map/index.html serves Crimson Text's italic for the waters' names");
const base = R(".build/map/app/app-1-base.js");
for (const k of ["sea", "seaLine", "seaMark", "seaInk"]) assert.ok(new RegExp(`T\\.${k} = dk \\? lch\\(`).test(base), `the theme carries ${k} for both pages`);
// the lines' degrees and the Tropic's name: laid after the waters' names, clear of the stage's
// controls and the full-screen plates, faded with the rest of the sea's lettering
assert.ok(/ctx\.restore\(\);\s*drawGratLabels\(m, K, G, placed, seen, now, ovA \* fade\);\s*for \(const k of \[\.\.\.seaSince\.keys\(\)\]\) if \(!seen\.has\(k\)\) seaSince\.delete\(k\);/.test(map2), "drawSeaNames: the degrees after the names, before the fades of labels gone are dropped");
assert.ok(map2.includes('[backBtn, nearEl, $("#credit"), $("#zoomer"), $("#filterpill")]') && map2.includes('stampEl.classList.contains("on")'), "the stage's controls and the year's stamp are kept clear");
assert.ok(/const clearGround = \(pad\) => \{ const q = FS\.on \? FS\.ins/.test(map2) && map2.includes("const [c0, c1, c2, c3] = clearGround(2);"), "in full screen the sea's lettering keeps to the ground between the plates");
assert.ok(/ctx\.setLineDash\(dash\); ctx\.lineDashOffset = \(rt \* \(lo - \(t0 - half\)\)\) % per;/.test(map2), "the Tropic is dashed, its dashes pinned to the map");
console.log("test-map-ocean: ok");
