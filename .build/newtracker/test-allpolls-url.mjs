// Fixture test for the All-polls archive URL state in the tabbed-views
// asset — the bitmask pack/unpack fns (archMask/archUnpack) and the frozen
// URL_HOUSES ordering — exercised against the REAL site data: the POLL_TAGS
// ids parsed out of the asset itself, and the live base-house list parsed
// out of the 9f09dca2 data asset (the same object the shipped page reads).
//
// The machinery lives at module scope, so the test slices its source out of
// the asset (from "const URL_HOUSES = [" to just before "function pollTagIds")
// and evals it cold. The assertions therefore run the SHIPPED code path, not
// a copy of it — and the bit↔house/tag mapping can never silently drift from
// the houses and tags the site actually ships: a new house landing in the
// data asset without a matching URL_HOUSES APPEND fails loudly here.
//
// Run:
//   node .build/newtracker/test-allpolls-url.mjs
// Exits non-zero if any expectation fails.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `\n      ${extra}`}`);
};
const die = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };

/* --- the machinery's one home: whichever asset file carries URL_HOUSES --- */
const asset = readdirSync(new URL("./assets/", import.meta.url))
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ f, src: readFileSync(fileURLToPath(new URL(`./assets/${f}`, import.meta.url)), "utf8") }))
  .find((a) => a.src.includes("const URL_HOUSES = ["));
if (!asset) die("could not find the tabbed-views asset (const URL_HOUSES marker)");

/* --- lift the shipped fns + frozen ordering --- */
const start = asset.src.indexOf("const URL_HOUSES = [");
const end = asset.src.indexOf("function pollTagIds", start);
if (start < 0 || end < 0) die("could not locate the archive URL-state block in the asset");
const { URL_HOUSES, archMask, archUnpack } = new Function(
  asset.src.slice(start, end) + "; return { URL_HOUSES, archMask, archUnpack };")();

/* --- the real tag ids, straight from POLL_TAGS in the same asset --- */
const tagStart = asset.src.indexOf("const POLL_TAGS = [");
if (tagStart < 0) die("POLL_TAGS not found in the asset");
const TAGS = [...asset.src.slice(tagStart, asset.src.indexOf("];", tagStart))
  .matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
if (TAGS.length < 9) die(`POLL_TAGS parse looks short (${TAGS.length} tags)`);

/* --- the live house list, from the 9f09dca2 data asset the page reads --- */
const dataFile = readdirSync(new URL("./assets/", import.meta.url))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
if (!dataFile) die("could not find the 9f09dca2 data asset");
const win = {};
new Function("window", readFileSync(fileURLToPath(new URL(`./assets/${dataFile}`, import.meta.url)), "utf8"))(win);
const polls = win.AUSPOL && win.AUSPOL.individualPolls;
if (!Array.isArray(polls) || !polls.length) die("individualPolls missing from the data asset");
const baseHouse = (h) => h.replace(/ \((MRP|SMS)\)$/, "");
const liveHouses = [...new Set(polls.map((p) => baseHouse(p.pollster)))].sort();

const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const S = (...v) => new Set(v);

/* --- the frozen house order: pinned verbatim, alphabetical today, covers
     every house the live data offers, and no order member matches the b-token
     grammar itself (or a legacy comma value could parse as a mask) --- */
ok("URL_HOUSES is the pinned 12-house list", JSON.stringify(URL_HOUSES) === JSON.stringify([
  "Agenda C Synesis", "DemosAU", "Essential", "Fox & Hedgehog", "Freshwater",
  "Newspoll", "RedBridge / Accent", "Resolve", "Roy Morgan", "Spectre Strategy",
  "Wolf & Smith", "YouGov",
]), JSON.stringify(URL_HOUSES));
ok("every live house has a bit in URL_HOUSES", liveHouses.every((h) => URL_HOUSES.includes(h)),
  `live-only: ${JSON.stringify(liveHouses.filter((h) => !URL_HOUSES.includes(h)))}`);
ok("no house name parses as a b-token", URL_HOUSES.every((h) => !/^b[0-9a-z]+$/.test(h)));
ok("no tag id parses as a b-token", TAGS.every((t) => !/^b[0-9a-z]+$/.test(t)));

/* --- pack/unpack round-trips --- */
const rt = (order, set, name) => {
  const tok = archMask(order, set);
  const back = archUnpack(tok, order);
  ok(name, !!back && eq(back, set), `${tok} → ${JSON.stringify(back && [...back])}`);
};
rt(URL_HOUSES, S(), "round-trip: empty pollster set");
rt(URL_HOUSES, S("Newspoll"), "round-trip: single pollster (Newspoll = bit 5)");
rt(URL_HOUSES, S(...URL_HOUSES), "round-trip: every pollster");
rt(TAGS, S(...TAGS), "round-trip: every tag");
ok("empty pollster set packs to b0 (writer omits the param instead)", archMask(URL_HOUSES, S()) === "b0");

/* --- the reported monstrosity: ?w=DemosAU,Newspoll,RedBridge / Accent,
     Roy Morgan,YouGov&t=6&h=2pp,2x2pp → w bit-sum 2+32+64+256+2048 = 2402 --- */
{
  const who = S("DemosAU", "Newspoll", "RedBridge / Accent", "Roy Morgan", "YouGov");
  const tok = archMask(URL_HOUSES, who);
  ok("reported URL's pollster set packs to the 4-char mask b1uq", tok === "b1uq", tok);
  const back = archUnpack(tok, URL_HOUSES);
  ok("…and restores the same five houses", !!back && eq(back, who));
  const tagTok = archMask(TAGS, S("2pp", "2x2pp"));
  ok("reported URL's tag set packs to b3", tagTok === "b3", tagTok);
}
ok("single-pollster example stays tiny: Newspoll → bw", archMask(URL_HOUSES, S("Newspoll")) === "bw");

/* --- legacy comma links still parse: the mask reader must hand EVERY
     pre-bitmask spelling back to the legacy path --- */
const legacyW = "DemosAU,Newspoll,RedBridge / Accent,Roy Morgan,YouGov";
const legacyH = "2pp,2x2pp";
ok("legacy w list is not the mask form", archUnpack(legacyW, URL_HOUSES) === null);
ok("legacy h list is not the mask form", archUnpack(legacyH, TAGS) === null);
ok("legacy single values are not the mask form",
  archUnpack("Newspoll", URL_HOUSES) === null && archUnpack("2pp", TAGS) === null
  && archUnpack("dir", TAGS) === null && archUnpack("Essential", URL_HOUSES) === null);
ok("empty/absent values are not the mask form",
  archUnpack("", URL_HOUSES) === null && archUnpack(null, TAGS) === null);

// legacy lifecycle: restore via the legacy path, repack as a mask, restore again
{
  const legacy = (raw, order) => raw.split(",").filter((v) => order.includes(v));
  const h = new Set(legacy(legacyW, URL_HOUSES));
  const back = archUnpack(archMask(URL_HOUSES, h), URL_HOUSES);
  ok("legacy restore → repack → restore preserves the set", !!back && eq(back, h));
}

/* --- forwards tolerance: bits beyond the frozen orders drop silently, so
     a link from a FUTURE build (more houses/tags appended) never selects
     anything here by accident --- */
{
  const hiH = "b" + (2 ** URL_HOUSES.length).toString(36);
  const back = archUnpack(hiH, URL_HOUSES);
  ok("unknown high house bits decode to nothing", !!back && eq(back, S()), `${hiH}`);
  const hiT = "b" + (2 ** TAGS.length).toString(36);
  ok("unknown high tag bits decode to nothing", eq(archUnpack(hiT, TAGS), S()));
}

/* --- the shipped wiring: readers branch on the mask grammar, the writer
     emits masks, and the legacy keys stay in the OWNED scrub list --- */
ok("reader: w branches through archUnpack", asset.src.includes("archUnpack(raw, URL_HOUSES)"));
ok("reader: h branches through archUnpack", asset.src.includes("archUnpack(raw, POLL_TAGS.map((t) => t.id))"));
ok("writer: w emits the mask", asset.src.includes('p.set("w", archMask(URL_HOUSES, sel))'));
ok("writer: h emits the mask", asset.src.includes('p.set("h", archMask(POLL_TAGS.map((t) => t.id), tagSel))'));
{
  const m = /const OWNED = \[([^\]]+)\]/.exec(asset.src);
  ok("OWNED still scrubs the legacy keys (who/has spot-check)",
    !!m && m[1].includes('"who"') && m[1].includes('"has"') && m[1].includes('"w"') && m[1].includes('"h"'));
}

if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log(`\nall ok — ${URL_HOUSES.length} houses (${liveHouses.length} live), ${TAGS.length} tags, ${asset.f}`);
