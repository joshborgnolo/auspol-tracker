/* assemble.mjs – the Electoral-maps page's script and stylesheet, from their parts.

   map/index.html is hand-maintained (its shell regions filled by
   node .build/site-shell.mjs); its behaviour lives in .build/map/app/:
     app-1-base.js     helpers, colour, the theme's tokens, the data loaders,
                       the "Now" overlay (Farrer by-election, changes of party)
     app-2-map.js      lens values and colours, the canvas map, zoom and pan
     app-2b-draw.js    how the map is drawn: seats, balloons, the surface and its contests
     app-3-chamber.js  the House in its chamber, seat by seat, and the morph
     app-3b-senate.js  the Senate as it sits, drawn by the same renderer
     app-3c-sa.js      South Australia's House of Assembly and Legislative Council floors
     app-4-story.js    the story column: rule-written heads for every lens
     app-5-list.js     the list, its filters and the column distributions
     app-6-ui.js       legend, timeline, tooltip, search, URL, events, boot
     app-7-full.js     the full-screen view: plates over the stage, the elections dock
     app-8-retro.js    the retro view: the map as a desktop program from about 2000
     page.css          the page's own styles (its palette is inline in the page)
     retro.css         the retro view's look (html.mp-retro), after page.css and
                       the retro pages' shared chrome, .build/retro/chrome.css
                       (navbar, banner, tab buttons, menus: the retro All polls
                       page wears the same file)
   This writes map/map.js (one closure, so nothing leaks to window but the
   __map test hook) and map/map.css. Run after editing a part:
     node .build/map/assemble.mjs
   The data in map/data comes from build_map_data.py, geo_build.mjs and
   islands_build.mjs (the islands past the mainland frame, drawn inset); each tracked file's hash
   is stamped into map.js (data-stamp.mjs), so re-run this after rebuilding any data file.
   It also writes each res-<frame>.json's core-<frame>.json (core-split.mjs): the results
   without the polling places' census lanes, which the map loads first; commit them too. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { dataStamps, stampData, metaFacts, stampMeta } from "./data-stamp.mjs";
import { writeCores } from "./core-split.mjs";
import { stampPrevTpp } from "./stamp-agg-prev-tpp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
// each state frame's previous-election two-party totals ride into its own aggregate
// (stamp-agg-prev-tpp.mjs), before the cores split off
stampPrevTpp(ROOT);
// each results file's core (core-split.mjs: the file without its polling places' census
// lanes, what a frame loads first), written before the data stamps are taken
writeCores(ROOT);
const part = (f) => fs.readFileSync(path.join(HERE, "app", f), "utf8");
const app = ["app-1-base.js", "app-2-map.js", "app-2b-draw.js", "app-2c-chart.js", "app-3-chamber.js", "app-3b-senate.js", "app-3c-sa.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js", "app-7-full.js", "app-8-retro.js"].map(part).join("\n");
// each data file's hash goes into the script, so it fetches the data it shipped with (data-stamp.mjs)
// and each election's eyebrow facts, so the eyebrow's floor reads every year's real line (data-stamp.mjs)
// the retro pages' shared drop-downs ride after the app (.build/retro/select.client.js: the era's combo box in the retro view)
const retroSelect = fs.readFileSync(path.join(HERE, "..", "retro", "select.client.js"), "utf8");
const js = stampMeta(stampData(`/* the Electoral map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${app}\n})();\n${retroSelect}`, dataStamps(ROOT)), metaFacts(ROOT));
const css = part("page.css") + "\n" + fs.readFileSync(path.join(HERE, "..", "retro", "chrome.css"), "utf8") + "\n" + part("retro.css");
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
   the same stamps: it starts the landing year's fetches (core, or res on a
   Census-lens landing; geo-lo, islands; data-now on the "now" landing) while
   the scripts download, and
   getJSON (app-1-base.js) drinks from window.__warm instead of racing it. */
{
  const hs = { "map.js": crypto.createHash("sha1").update(js).digest("hex").slice(0, 8), "map.css": crypto.createHash("sha1").update(css).digest("hex").slice(0, 8) };
  const ip = path.join(ROOT, "map", "index.html");
  const html = fs.readFileSync(ip, "utf8");
  let stamped = html.replace(/(src|href)="\/map\/(map\.js|map\.css)(\?v=[0-9a-f]{8})?"/g, (m, attr, f) => `${attr}="/map/${f}?v=${hs[f]}"`);
  const dv = dataStamps(ROOT);
  const warmV = {};
  for (const [f, v] of Object.entries(dv)) if (/^(res-\w+|core-\w+|geo-\w+-lo)\.json$/.test(f) || /^data-now(-\w+)?\.json$/.test(f) || f === "islands.json") warmV[f] = v;
  stamped = stamped.replace(
    /<!--map-data-warm:begin-->[\s\S]*?<!--map-data-warm:end-->/,
    `<!--map-data-warm:begin-->\n<script id="map-data-warm">(function(){var V=${JSON.stringify(warmV)};var NOW_OF={"now":"2025","nswnow":"nsw23","qldnow":"qld24","wanow":"wa25"},NOW_DATA={"now":"data-now.json","nswnow":"data-now-nsw.json","qldnow":"data-now-qld.json","wanow":"data-now-wa.json"};var y=(location.hash.match(/[#&]y=(\\w+)/)||[])[1]||"now";var ry=NOW_OF[y]||y;if(!V["res-"+ry+".json"]){y="now";ry="2025";}var b=(/[#&]l=seifa(&|$)/.test(location.hash)||!V["core-"+ry+".json"]?"res-":"core-")+ry+".json";var q=function(n){var v=V[n];return "/map/data/"+n+(v?"?v="+v:"");};var W=window.__warm={};var go=function(n){W["/map/data/"+n]=fetch(q(n)).then(function(r){return r.json();});};[b,"geo-"+ry+"-lo.json","islands.json"].forEach(go);if(NOW_DATA[y])go(NOW_DATA[y]);})();</script>\n<!--map-data-warm:end-->`);
  if (stamped !== html) { fs.writeFileSync(ip, stamped); console.log("map/index.html stamped", hs["map.js"], hs["map.css"]); }
  else console.log("map/index.html stamps current");
}
