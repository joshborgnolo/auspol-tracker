/* assemble.mjs – the Election map's script and stylesheet, from their parts.

   map/index.html is hand-maintained (its shell regions filled by
   node .build/site-shell.mjs); its behaviour lives in .build/map/app/:
     app-1-base.js     helpers, colour, the theme's tokens, the data loaders,
                       the "Now" overlay (Farrer by-election, changes of party)
     app-2-map.js      lens values and colours, the canvas map, zoom and pan
     app-3-chamber.js  the House in its chamber, seat by seat, and the morph
     app-3b-senate.js  the Senate as it sits, drawn by the same renderer
     app-3c-sa.js      South Australia's House of Assembly and Legislative Council floors
     app-4-story.js    the story column: rule-written heads for every lens
     app-5-list.js     the list, its filters and the column distributions
     app-6-ui.js       legend, timeline, tooltip, search, URL, events, boot
     page.css          the page's own styles (its palette is inline in the page)
   This writes map/map.js (one closure, so nothing leaks to window but the
   __map test hook) and map/map.css. Run after editing a part:
     node .build/map/assemble.mjs
   The data in map/data comes from build_map_data.py, geo_build.mjs and
   islands_build.mjs (the islands past the mainland frame, drawn inset); each tracked file's hash
   is stamped into map.js (data-stamp.mjs), so re-run this after rebuilding any data file. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { dataStamps, stampData, metaFacts, stampMeta } from "./data-stamp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const part = (f) => fs.readFileSync(path.join(HERE, "app", f), "utf8");
const app = ["app-1-base.js", "app-2-map.js", "app-3-chamber.js", "app-3b-senate.js", "app-3c-sa.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js"].map(part).join("\n");
// each data file's hash goes into the script, so it fetches the data it shipped with (data-stamp.mjs)
// and each election's eyebrow facts, so the eyebrow's floor reads every year's real line (data-stamp.mjs)
const js = stampMeta(stampData(`/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${app}\n})();\n`, dataStamps(ROOT)), metaFacts(ROOT));
const css = part("page.css");
const write = (rel, body) => {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === body) return console.log(rel, "unchanged");
  fs.writeFileSync(p, body);
  console.log(rel, body.length, "bytes");
};
write("map/map.js", js);
write("map/map.css", css);

/* the page's asset URLs take a short content hash (?v=): Pages serves the
   unqueried files with only a short TTL, but a phone's heuristic cache can
   hold them long past a release (bit on 2026-10-25 – new build invisible on
   a phone that had the old map.js pinned). The head's data-warm script gets
   the same stamps: it starts the landing year's fetches (res, geo-lo,
   islands; data-now on the "now" landing) while the scripts download, and
   getJSON (app-1-base.js) drinks from window.__warm instead of racing it. */
{
  const hs = { "map.js": crypto.createHash("sha1").update(js).digest("hex").slice(0, 8), "map.css": crypto.createHash("sha1").update(css).digest("hex").slice(0, 8) };
  const ip = path.join(ROOT, "map", "index.html");
  const html = fs.readFileSync(ip, "utf8");
  let stamped = html.replace(/(src|href)="\/map\/(map\.js|map\.css)(\?v=[0-9a-f]{8})?"/g, (m, attr, f) => `${attr}="/map/${f}?v=${hs[f]}"`);
  const dv = dataStamps(ROOT);
  const warmV = {};
  for (const [f, v] of Object.entries(dv)) if (/^(res-\w+|geo-\w+-lo)\.json$/.test(f) || f === "data-now.json" || f === "islands.json") warmV[f] = v;
  stamped = stamped.replace(
    /<!--map-data-warm:begin-->[\s\S]*?<!--map-data-warm:end-->/,
    `<!--map-data-warm:begin-->\n<script id="map-data-warm">(function(){var V=${JSON.stringify(warmV)};var y=(location.hash.match(/[#&]y=(\\w+)/)||[])[1]||"now";var ry=y==="now"?"2025":y;var b="res-"+ry+".json";if(!V[b]){y="now";ry="2025";b="res-"+ry+".json";}var q=function(n){var v=V[n];return "/map/data/"+n+(v?"?v="+v:"");};var W=window.__warm={};var go=function(n){W["/map/data/"+n]=fetch(q(n)).then(function(r){return r.json();});};[b,"geo-"+ry+"-lo.json","islands.json"].forEach(go);if(y==="now")go("data-now.json");})();</script>\n<!--map-data-warm:end-->`);
  if (stamped !== html) { fs.writeFileSync(ip, stamped); console.log("map/index.html stamped", hs["map.js"], hs["map.css"]); }
  else console.log("map/index.html stamps current");
}
