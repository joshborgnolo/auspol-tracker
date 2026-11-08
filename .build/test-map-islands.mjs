/* test-map-islands.mjs – pins the island sea-spot clamps (app-2-map.js seaSpots):

   - full screen: the parked plates are off the sea, so the page chrome's
     remembered foot (the cities strip and the zoom hint) must NOT be read as
     the boxes' clearance floor — it once shoved the western pair 220px down
     onto the WA coast, Christmas Island sitting on Durack (2026-11-08).
   - the page itself: the floor stands — the hint and the cities show over the
     map's top there, so the pair still keeps out from under them.
   The slice runs in a bare vm with stub chrome; the numbers below track a
   1512×980 stage at the full-screen fit (HOME k 0.895 over a 1000×830 box).
   Run: node .build/test-map-islands.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(ROOT, ".build/map/app/app-2-map.js"), "utf8");
const i = app.indexOf("let seaMemo = null"), j = app.indexOf("function islandCards(m) {");
assert.ok(i >= 0 && j > i, "seaSpots slice markers");
const slice = app.slice(i, j);

const prelude = `
let Wpx = 1512, Hpx = 980;
const FS = { on: false, ins: { t: 60, r: 14, b: 78, l: 406 } };
const hint = { textContent: "zoom", offsetHeight: 17, getBoundingClientRect: () => ({ bottom: 341 }) };
const cities = { hidden: false, offsetHeight: 95, getBoundingClientRect: () => ({ bottom: 287 }) };
const $ = (s) => (s === "#hint" ? hint : s === "#cities" ? cities : { getBoundingClientRect: () => ({ top: 0 }) });
const isPhone = () => false;
const HOME = { k: 0.895, x: 485, y: 96 };
const ISL_PAIRS = [["christmas", "cocos"], ["norfolk", "lordhowe"]];
const ISL_AT = { side: [[0.14, 0.145], [1.015, 0.78]], stacked: [[0.2, -0.15], [0.86, 1.07]] };
const ISL_SHORT = { cocos: "Cocos Islands" }, ISL_CAP = 15;
const SANS = "sans-serif";
const ctx = { font: "", measureText: (s) => ({ width: s.length * 7 }) };
const hitCtx = { isPointInPath: () => false };
const geoOf = () => ({ paths: null });
const M = { year: 2025, isl: ["christmas", "cocos", "norfolk", "lordhowe"].map((key) => ({ key, name: { christmas: "Christmas Island", cocos: "Cocos (Keeling) Islands", norfolk: "Norfolk Island", lordhowe: "Lord Howe Island" }[key] })), divs: [] };
const hb = [[0, 0], [1000, 830]], A = 64, P = { t: 96, b: 96, l: 418, r: 64 };
`;

const tail = `
;(() => {
  const y = () => seaSpots(M, hb, A, P).christmas[1];
  FS.on = true;
  const yFs = y();
  if (yFs > 200) throw new Error("full screen soaked the page chrome's foot into the sea spots (got y=" + yFs + "): Christmas Island sat on the WA coast");
  FS.on = false;
  const yPage = y();
  if (yPage < 350) throw new Error("the page's chrome foot no longer clears the sea spots (got y=" + yPage + ")");
  if (!(seaTop.w === Wpx && Math.abs(seaTop.top - 355) < 1)) throw new Error("the page chrome's foot is not remembered (got " + JSON.stringify(seaTop) + ")");
})();`;

vm.runInContext(prelude + slice + tail, vm.createContext({}));
console.log("PASS test-map-islands");
