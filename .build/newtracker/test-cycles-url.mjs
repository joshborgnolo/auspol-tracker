// Fixture test for the past-cycles URL state in the tabbed-views asset —
// the bitmask pack/unpack fns (cycPack/cycUnpack), the legacy dotted-year
// parser (cycYears), and the writer's legacy-l scrub rule — exercised
// against the REAL site term list parsed out of gen-data.mjs's CYC_META.
//
// The fns live inside PastCyclesView, so the test slices their source out
// of the asset (from "const cycBits =" to just before "const currentYear")
// and evals them with a [{year, current}] array standing in for the app's
// D.cycles. The assertions therefore run the SHIPPED code path, not a copy
// of it — and the bitmask bit↔term mapping can never silently drift from
// the term list gen-data actually emits.
//
// Run:
//   node .build/newtracker/test-cycles-url.mjs
// Exits non-zero if any expectation fails.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `\n      ${extra}`}`);
};
const die = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };

/* --- the machinery's one home: whichever asset file carries cycBits --- */
const asset = readdirSync(new URL("./assets/", import.meta.url))
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ f, src: readFileSync(fileURLToPath(new URL(`./assets/${f}`, import.meta.url)), "utf8") }))
  .find((a) => a.src.includes("const cycBits ="));
if (!asset) die("could not find the tabbed-views asset (const cycBits marker)");

/* --- the real term list, from CYC_META in gen-data.mjs --- */
const genData = readFileSync(fileURLToPath(new URL("./gen-data.mjs", import.meta.url)), "utf8");
const metaStart = genData.indexOf("const CYC_META = [");
if (metaStart < 0) die("CYC_META not found in gen-data.mjs");
const metaEnd = genData.indexOf("];", metaStart);
const YEARS = [...genData.slice(metaStart, metaEnd).matchAll(/\{ year: (\d{4}),/g)].map((m) => +m[1]);
if (YEARS.length < 21) die(`CYC_META parse looks short (${YEARS.length} terms)`);
const cycles = YEARS.map((year) => ({ year, current: year === YEARS[YEARS.length - 1] }));

/* --- lift the shipped fns --- */
const start = asset.src.indexOf("const cycBits =");
const end = asset.src.indexOf("const currentYear", start);
if (start < 0 || end < 0) die("could not locate the URL-state block in the asset");
const { cycUnpack, cycPack, cycYears } = new Function("cycles",
  asset.src.slice(start, end) + "; return { cycUnpack, cycPack, cycYears };")(cycles);

const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const S = (...y) => new Set(y);

/* --- pack contract --- */
ok("empty state packs to nothing", cycPack(S(), S()) === null);
ok("hidden 1972 packs to bit 0", cycPack(S(1972), S()) === "b1");
ok("hidden first two terms packs bits 0,1", cycPack(S(1972, 1974), S()) === "b3");
ok("lift-only writes b-<mask> with empty hidden part", cycPack(S(), S(1974)) === "b-2");

const allYears = S(...YEARS);
const allToken = cycPack(allYears, S());
ok("all-terms hidden token equals (2^n − 1) in base36",
  allToken === "b" + (2 ** YEARS.length - 1).toString(36), allToken);
ok("all-terms token stays within 6 base36 chars", /^b[0-9a-z]{1,6}$/.test(allToken));

/* --- round-trips through the shipped pack+unpack pair --- */
const rt = (h, l, name) => {
  const tok = cycPack(h, l);
  const back = tok == null ? { hidden: S(), lifted: S() } : cycUnpack(tok);
  ok(name, !!back && eq(back.hidden, h) && eq(back.lifted, l),
    `${tok} → hidden ${[...back.hidden]} lifted ${[...back.lifted]}`);
};
rt(S(), S(), "round-trip: empty");
rt(allYears, S(), "round-trip: every term hidden");
rt(S(), S(1972, 1975), "round-trip: lift-only");
rt(S(1972, 1984, 1987, 1993, 2013), S(1983, 2010), "round-trip: mixed hidden+lifted");
// the state the reported 84-char URL encoded: every term hidden but 1984 & 1987
rt(S(...YEARS.filter((y) => y !== 1984 && y !== 1987)), S(), "round-trip: reported URL's state");

/* --- legacy dotted-year links still restore exactly --- */
ok("legacy: 4-digit pre-2000 + 2-digit 2000s", eq(cycYears("1972.1975.10.19"), S(1972, 1975, 2010, 2019)));
ok("legacy: commas tolerated", eq(cycYears("1972,10"), S(1972, 2010)));
ok("legacy: unknown terms dropped", eq(cycYears("1972.90.31.2099"), S(1972)));
ok("legacy: empty raw", eq(cycYears(""), S()) && eq(cycYears(null), S()));
ok("legacy values are NOT the new form", cycUnpack("1972.10") === null && cycUnpack("10.19") === null);

// legacy lifecycle: restore from the old writer's output, repack, restore again
{
  const h = cycYears("1972.1975.01.10.22");
  const l = cycYears("83,93");
  const back = cycUnpack(cycPack(h, l));
  ok("legacy restore → repack → restore preserves both halves",
    !!back && eq(back.hidden, h) && eq(back.lifted, l));
}

/* --- forwards tolerance: bits beyond the current list drop silently --- */
{
  const beyond = "b" + (2 ** YEARS.length).toString(36);
  const back = cycUnpack(beyond);
  ok("unknown high bits decode to nothing (terms append-only contract)",
    !!back && eq(back.hidden, S()) && eq(back.lifted, S()),
    `${beyond} → hidden ${[...back.hidden]}`);
}

/* --- the writer's l-scrub guard: legacy year lists only, never lead letters --- */
{
  const m = /l != null && (\/\^\[0-9\.,\]\+\$\/)\.test\(l\)/.exec(asset.src);
  const re = m && eval(m[1]);
  ok("asset carries the year-shaped l scrub guard", !!re);
  ok("guard matches legacy l lists", !!re && re.test("83.90") && re.test("1972"));
  ok("guard spares the archive's lead letters (l=a|l|o)",
    !!re && !re.test("a") && !re.test("l") && !re.test("o"));
}

if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log(`\nall ok — ${YEARS.length} terms, ${asset.f}`);
