/* Probe: the Who-trusted dek generator (rd-panels.jsx trustDek IIFE, re-linked from
   the 2026-09-28 frozen string on 2026-10-05). Extracts the COMPILED IIFE out of the
   built index.html and evaluates it against the live issues payload plus mutated
   payloads - every clause must gate on own.leadSig / the by-far / age-old rules.
   Run: node .matilda/probe-issues-trustdek.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* the compiled trustDek IIFE */
const i = html.indexOf("const trustDek = (() => {");
if (i < 0) throw new Error("compiled trustDek generator not found in index.html - the frozen string may be back");
let j = i + "const trustDek = ".length, depth = 0, end = -1;
for (let k = j; k < html.length; k++) {
  const c = html[k];
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (!depth) { if (html.slice(k, k + 4) === "})()") end = k + 4; break; } }
}
if (end < 0) throw new Error("trustDek IIFE brace walk failed");
const iifeSrc = html.slice(j, end);                                     /* "(() => { ... })()" */
const makeDek = new Function("list", "top", "own", "phrase", "ISS_PHRASE",
  "rdCap", "rdPartyIn", "rdPartyStart",
  "const trustDek = " + iifeSrc + "; return trustDek;");

/* helpers, as in scope in rd-panels.jsx (rdPartyStart = rdCap(rdPartyIn)) */
const RD_PARTY_IN = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation" };
const rdPartyIn = (id) => RD_PARTY_IN[id] || id;
const rdCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const rdPartyStart = (id) => rdCap(rdPartyIn(id));
const ISS_PHRASE = { col: "the cost of living", housing: "housing", health: "health",
  economy: "economic management", immigration: "immigration", climate: "climate change",
  crime: "crime", security: "national security" };

/* the live issues payload, brace-walked out of the page */
const o = html.indexOf("const issues = {");
if (o < 0) throw new Error("issues payload not found in the built page");
let p = html.indexOf("{", o), d2 = 0, endP = -1;
for (let k = p; k < html.length; k++) {
  const c = html[k];
  if (c === "{") d2++;
  else if (c === "}") { d2--; if (!d2) { endP = k + 1; break; } }
}
const I = JSON.parse(html.slice(p, endP));

const clone = (x) => JSON.parse(JSON.stringify(x));
const dekFor = (list) => {
  const top = list[0];
  return makeDek(list, top, top.own, ISS_PHRASE[top.id] || top.label.toLowerCase(),
    ISS_PHRASE, rdCap, rdPartyIn, rdPartyStart);
};

let failures = 0;
const check = (name, got, want) => {
  const ok = want instanceof RegExp ? want.test(got) : got === want;
  if (ok) console.log("ok   " + name);
  else { failures++; console.log("FAIL " + name + "\n  got:  " + JSON.stringify(got) + "\n  want: " + (want instanceof RegExp ? want : JSON.stringify(want))); }
};
const notHas = (name, got, frag) => {
  if (!got.includes(frag)) console.log("ok   " + name);
  else { failures++; console.log("FAIL " + name + " - forbidden fragment present: " + frag); }
};

/* 1. the live payload reads exactly as approved today */
const liveDek = dekFor(I.list);
check("live render matches the approved dek", liveDek,
  "The cost of living is by far the issue most important to voters, but no party is more trusted on it than another. "
  + "Labor leads on health and climate change, while One Nation leads on immigration and crime. "
  + "The Coalition retains its age-old lead on economic management.");

/* 2. housing lead turns significant again -> re-enters Labor's list ahead of health */
let L = clone(I.list); L.find((x) => x.id === "housing").own.leadSig = true;
check("significant housing lead re-enters Labor's list (salience order)", dekFor(L),
  /Labor leads on housing, health, and climate change/);

/* 3. top issue gains a clear lead -> trust clause flips, col never re-listed */
L = clone(I.list); const c3 = L[0]; c3.own.leadSig = true; c3.own.lead = "onp";
check("significant top-issue lead flips the trust clause", dekFor(L),
  /The cost of living is by far the issue most important to voters, where One Nation holds a clear lead\./);
notHas("top issue never re-named in a lead list", dekFor(L), "leads on the cost of living");

/* 4. Coalition loses the economy to Labor -> age-old sentence gone, economy joins Labor's list */
L = clone(I.list); const e4 = L.find((x) => x.id === "economy"); e4.own.lead = "alp";
const d4 = dekFor(L);
notHas("no age-old sentence once the sig lead is not the Coalition's", d4, "age-old lead on economic management");
check("economy joins the ordinary list for its new leader", d4, /Labor leads on health, economic management, and climate change/);

/* 5. Coalition economy lead turns non-significant -> economy drops out entirely */
L = clone(I.list); L.find((x) => x.id === "economy").own.leadSig = false;
const d5 = dekFor(L);
notHas("n.s. economy lead is named nowhere", d5, "economic management");
notHas("no Coalition sentence when it leads nothing significant", d5, "The Coalition");

/* 6. nobody leads anything significant -> sentence 1 stands alone */
L = clone(I.list); for (const x of L) if (x.own) x.own.leadSig = false;
check("no significant leads at all -> top-issue sentence only", dekFor(L),
  "The cost of living is by far the issue most important to voters, but no party is more trusted on it than another.");

/* 7. no own data plus missing runner-up -> clause-less sentence, no by far explosion */
L = clone(I.list); L[0].own = null; L.find((x) => x.id === "housing").imp.v = 69.4;   /* not 1.5x clear */
const d7 = dekFor(L);
check("absent own -> trust clause drops", d7, /most important to voters\./);
notHas("holder clause not invented without data", d7, "no party is more trusted");
notHas("by far drops when the 10-point gate fails", d7, "by far");                  /* 69.5 vs 69.4 = 0.1pt gap */

/* 8. Coalition leads something else too -> appended to its age-old sentence */
L = clone(I.list); const s8 = L.find((x) => x.id === "security"); s8.own.lead = "lnp"; s8.own.leadSig = true;
check("Coalition's other leads ride the age-old sentence", dekFor(L),
  /The Coalition retains its age-old lead on economic management, and leads on national security\./);

/* 9. Coalition leads security only, economy n.s. -> ordinary sentence, no age-old */
L = clone(I.list); const s9 = L.find((x) => x.id === "security"); s9.own.lead = "lnp"; s9.own.leadSig = true;
L.find((x) => x.id === "economy").own.leadSig = false;
check("coalition-without-economy renders as an ordinary lead sentence", dekFor(L),
  /The Coalition leads on national security\./);

/* 10. three parties with leads -> two sentences, never a triple-clause run-on */
L = clone(I.list); const s10 = L.find((x) => x.id === "security"); s10.own.lead = "lnp"; s10.own.leadSig = true;
L.find((x) => x.id === "economy").own.leadSig = false;
const d10 = dekFor(L);
notHas("no double 'while' in one sentence", (d10.match(/while/g) || []).length > 1 ? d10 : "", "while");
check("third party's leads start their own sentence", d10, /immigration and crime\. The Coalition leads on national security\./);

/* 11. top.imp missing -> the whole dek drops */
L = clone(I.list); L[0].imp = null;
check("missing top-issue salience -> dek is null", dekFor(L), null);

process.exit(failures ? 1 : 0);
