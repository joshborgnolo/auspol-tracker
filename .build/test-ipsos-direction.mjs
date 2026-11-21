/* Offline pins for .build/ipsos-direction.mjs. No network, no PDF dependency:
   this reads the committed pdftotext caches and data output only.
   Run: node .build/test-ipsos-direction.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildData, parseReport, directionTable, countrySamples, bands, Guard, NoCountryTable }
  from "./ipsos-direction.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, ".build", "ipsos-direction-src");
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
const built = buildData(manifest);
const waves = built.waves;
const of = (month) => { const w = waves.find((q) => q.month === month); assert.ok(w, `wave ${month} exists`); return w; };
const source = (part) => { const s = manifest.sources.find((q) => q.text.includes(part)); assert.ok(s, `cache ${part} exists`); return s; };
const raw = (part) => fs.readFileSync(path.join(SRC, source(part).text), "utf8");
const close = (got, want, label) => assert.ok(Math.abs(got - want) < 1e-9, `${label}: ${got} != ${want}`);

// 1. The user-facing October 2026 anchor: exact published figures, source,
// fieldwork, complete roster and clearly approximate (not achieved) AU n.
{
  assert.equal(manifest.failures.length, 0, "all discovered primary PDFs are cached");
  assert.equal(waves.filter((w) => w.month <= "2026-10").length, 90, "the complete accessible corpus files 90 waves");
  assert.equal(waves[0].month, "2016-09");
  const w = of("2026-10");
  assert.deepEqual(w.australia, { right: 36, wrong: 64, sample: 1000, sampleApprox: true });
  assert.deepEqual(w.globalAverage, { right: 37, wrong: 63, sample: 24527 });
  assert.equal(w.start, "2026-09-25"); assert.equal(w.end, "2026-10-09");
  assert.equal(w.fieldwork, "September 25th 2026 - October 9th 2026");
  assert.equal(w.countries.length, 30);
  const au = w.countries.filter((c) => c.code === "AU");
  assert.equal(au.length, 1); assert.deepEqual(au[0], { code: "AU", name: "Australia", right: 36, wrong: 64, sample: 1000, sampleApprox: true });
  assert.deepEqual(w.countries.find((c) => c.code === "SG"), { code: "SG", name: "Singapore", right: 79, wrong: 21, sample: 500, sampleApprox: true });
  assert.deepEqual(w.countries.find((c) => c.code === "TH"), { code: "TH", name: "Thailand", right: 45, wrong: 55, sample: 500, sampleApprox: true });
  assert.deepEqual(w.countries.find((c) => c.code === "IN"), { code: "IN", name: "India", right: 61, wrong: 39, sample: 1000, sampleApprox: true });
  assert.deepEqual(w.countries.find((c) => c.code === "FR"), { code: "FR", name: "France", right: 7, wrong: 93, sample: 1000, sampleApprox: true });
  assert.ok(w.countries.every((c) => !/world|global average|global country average/i.test(c.name)), "the publisher average is not a country row");
  assert.ok(w.countries.every((c) => c.sampleApprox), "this report's printed n is approximate for every country");
  console.log("1. October 2026 figures, fieldwork, total/approx samples and 30-country roster: OK");
}

// 2. Quantile sufficiency: pins for the middle half and middle 80%.
{
  assert.deepEqual(bands([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    { q10: 10, q25: 25, q50: 50, q75: 75, q90: 90 });
  const w = of("2026-10");
  const right = bands(w.countries.map((c) => c.right));
  assert.equal(right.q25, 25); assert.equal(right.q50, 36); assert.equal(right.q75, 43.75);
  close(right.q10, 23.7, "October right-direction q10"); assert.equal(right.q90, 61);
  const net = bands(w.countries.map((c) => c.right - c.wrong));
  close(net.q10, -52.6, "October net q10"); assert.equal(net.q25, -50); assert.equal(net.q50, -28);
  assert.equal(net.q75, -12.5); assert.equal(net.q90, 22);
  assert.ok(!Object.hasOwn(w, "q50"), "rows, not opaque precomputed averages, are exposed for the renderer");
  console.log("2. Quartile/middle-80% boundaries, including net lead: OK");
}

// 3. Historical forms: 2016 exception list, 2021 roster typo, June 2024's
// split right-cell order and publisher World 38/62 (not complement-derived).
{
  const old = of("2016-09");
  assert.equal(old.globalAverage.sample, 18014); assert.equal(old.australia.sampleApprox, true);
  assert.equal(old.countries.find((c) => c.code === "BE").sample, 500);
  assert.equal(old.countries.find((c) => c.code === "AU").sample, 1000);
  assert.equal(old.start, "2016-08-26"); assert.equal(old.end, "2016-09-09");
  const nov = of("2021-11");
  assert.equal(nov.countries.length, 28, "methodology's explicit 28 roster resolves stale base-note 27");
  assert.equal(nov.globalAverage.sample, 19021);
  assert.equal(nov.australia.right, 56); assert.equal(nov.australia.wrong, 44);
  const jun = of("2024-06");
  assert.equal(jun.countries.length, 29);
  assert.equal(jun.countries.find((c) => c.code === "MY").right, 65);
  assert.equal(jun.countries.find((c) => c.code === "TH").right, 57);
  assert.equal(jun.australia.right, 48); assert.equal(jun.australia.wrong, 52);
  const jul = of("2024-07");
  assert.deepEqual({ right: jul.globalAverage.right, wrong: jul.globalAverage.wrong }, { right: 38, wrong: 62 });
  assert.equal(jul.australia.right, 45);
  console.log("3. Historical exception lists, roster typology and split-cell alignment: OK");
}

// 4. Exact-date discipline: a source's impossible end year stays null.
{
  const sep = of("2019-09");
  assert.equal(sep.start, "2019-08-23"); assert.equal(sep.end, null);
  assert.match(sep.fieldwork, /September 6th 2018/);
  assert.ok(waves.every((w) => w.australia.sampleApprox && w.australia.sample != null),
    "every accepted wave has a printed approximate Australia n, never an invented exact n");
  assert.equal(waves.filter((w) => w.globalAverage.sample != null).length, 61, "61 exact global totals are printed");
  console.log("4. Nulls for unproven dates/exactness and total-sample coverage: OK");
}

// 5. Current sample groups are read explicitly, not spread from a global n.
{
  const text = raw("October-26-f75b5835");
  const report = parseReport(text, source("October-26-f75b5835"));
  const samples = countrySamples(text, report.countries.map((c) => ({ code: c.code })));
  assert.equal(Object.keys(samples).length, 30);
  assert.deepEqual(samples.AU, { sample: 1000, sampleApprox: true });
  assert.deepEqual(samples.AR, { sample: 500, sampleApprox: true });
  assert.deepEqual(samples.SG, { sample: 500, sampleApprox: true });
  assert.equal(report.globalAverage.sample, 24527);
  assert.notEqual(report.globalAverage.sample, samples.AU.sample, "the global total is not used as an Australian n");
  console.log("5. Per-country methodology group coverage and exactness: OK");
}

// 6. Decimal spelling is read, not coerced away; malformed sums are refused.
{
  const good = `RIGHT DIRECTION VS. WRONG TRACK MONITOR
Global country average 60.5% 39.5%
Australia 60.5% 39.5%
Canada 70% 30%
France 20% 80%
Base: Representative sample of 2,000 adults aged 16-74 in 3 participating countries, January 1st 2020 - January 5th 2020.`;
  const table = directionTable(good);
  assert.equal(table.countries.find((c) => c.code === "AU").right, 39.5);
  assert.equal(table.global.right, 39.5);
  assert.throws(() => directionTable(good.replace("Australia 60.5% 39.5%", "Australia 58% 40%")), Guard);
  console.log("6. Decimal-cell handling and printed-pair sum guard: OK");
}

// 7. Layout-drift rejection: anchors, country removal, malformed cells and a
// duplicate World row must stop, never produce a partial credible-looking wave.
{
  const text = raw("October-26-f75b5835"), src = source("October-26-f75b5835");
  assert.doesNotThrow(() => parseReport(text, src));
  assert.throws(() => parseReport(text.replace("Right vs. wrong direction", "Right vs. removed direction"), src), NoCountryTable);
  assert.throws(() => parseReport(text.replace("Australia                        64%                                                        36%", "Australia                        64%"), src), Guard);
  assert.throws(() => parseReport(text.replace(/\n\s+Japan\s+64%\s+36%[^\n]*/, "\n"), src), Guard);
  assert.throws(() => parseReport(text.replace("World                            63%", "World"), src), Guard);
  console.log("7. Anchor/roster/malformed-table guards: OK");
}

// 8. Store shape and deterministic/idempotent regeneration.
{
  const expected = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "ipsos-direction.json"), "utf8"));
  assert.deepEqual(built.waves, expected.waves, "the checked-in data is exactly the offline regenerated output");
  assert.deepEqual(buildData(manifest).waves, built.waves, "a second offline build is byte-equivalent at the data level");
  assert.equal(built.omitted.length, 9, "nine primary decks without an all-country table are explicitly omitted");
  const au = (w) => w.countries.filter((c) => c.code === "AU");
  for (const w of waves) {
    assert.match(w.month, /^\d{4}-\d{2}$/); assert.ok(w.source && /^https:\/\//.test(w.sourceUrl));
    for (const p of [w.australia, w.globalAverage, ...w.countries]) {
      assert.ok(Number.isFinite(p.right) && Number.isFinite(p.wrong));
      assert.ok(Math.abs(p.right + p.wrong - 100) <= 1);
      assert.ok(p.sample == null || Number.isInteger(p.sample));
      if (p.sampleApprox) assert.ok(p.sample != null);
    }
    assert.equal(au(w).length, 1); assert.equal(new Set(w.countries.map((c) => c.code)).size, w.countries.length);
    assert.ok(!w.countries.some((c) => /world|global average|global country average/i.test(c.name)));
  }
  assert.equal(waves.reduce((n, w) => n + w.countries.length, 0), 2546);
  console.log("8. Store schema, unique rows, omissions and deterministic regeneration: OK");
}

console.log("test-ipsos-direction: all OK");
