// data/trust-government.json – the National mood section's Trust view
// (gen-data §5t). Hand-filed, so this checks what a hand can get wrong:
// one line series, every series sourced and worded, readings dated
// YYYY-MM in order, shares in range, the line's waves carrying their 95%
// margin and a declared panel, and the OECD average never standing alone.
import fs from "node:fs";
import assert from "node:assert/strict";
const d = JSON.parse(fs.readFileSync(new URL("../data/trust-government.json", import.meta.url), "utf8"));
const S = d.series;
assert.ok(Array.isArray(S) && S.length, "series");
assert.equal(S.filter((s) => s.role === "line").length, 1, "exactly one line series");
const ids = new Set();
for (const s of S) {
  assert.ok(!ids.has(s.id), "unique id " + s.id); ids.add(s.id);
  for (const k of ["house", "question", "measure", "source"]) assert.ok(s[k], s.id + " has " + k);
  assert.ok(["line", "dot", "long"].includes(s.role), s.id + " role");
  assert.match(s.source, /^https:\/\//, s.id + " source is a URL");
  let last = "";
  for (const r of s.readings) {
    assert.match(r.date, /^\d{4}-(0[1-9]|1[0-2])$/, s.id + " date " + r.date);
    assert.ok(r.date >= last, s.id + " readings in date order at " + r.date); last = r.date;
    assert.ok(typeof r.v === "number" && r.v > 0 && r.v < 100, s.id + " share " + r.v);
    if (s.modes) assert.ok(s.modes.some((m) => m.id === r.mode), s.id + " mode " + r.mode);
  }
  if (s.role === "line") {
    for (const r of s.readings) {
      assert.ok(r.ci > 0 && r.ci < 10, "line wave " + r.date + " carries its 95% margin");
      if (s.panels) assert.ok(s.panels.some((p) => p.id === r.panel), "line wave " + r.date + " names a declared panel");
    }
    assert.ok(s.readings.length >= 8, "the line has enough waves to be a line");
  }
}
// a global average is drawn only beside its own survey's Australian figure
// (the lean that moves it onto ANUpoll's terms is that survey's)
for (const [avg, own] of [["oecd-avg", "oecd-au"], ["edelman-avg", "edelman"]]) {
  if (!ids.has(avg)) continue;
  assert.ok(ids.has(own), avg + " needs the " + own + " series");
  const au = new Set(S.find((s) => s.id === own).readings.map((r) => r.date));
  for (const r of S.find((s) => s.id === avg).readings) {
    assert.ok(au.has(r.date), avg + " round " + r.date + " pairs an Australian reading");
    assert.ok(r.countries > 1, avg + " round " + r.date + " says how many countries it averages");
  }
}

// The AES long-view headline uses a live ten-point-rounded share, framed to
// emphasise how low trust is rather than imply an exact percentage.
const jsx = fs.readFileSync(new URL("./newtracker/assets/rd-panels.jsx", import.meta.url), "utf8");
const helperSource = jsx.match(/  function trustNoMoreThan\(v\) \{[\s\S]*?\n  \}/);
assert.ok(helperSource, "AES headline rounding helper");
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const trustNoMoreThan = new Function("NUM_WORDS", helperSource[0] + "; return trustNoMoreThan;")(words);
assert.equal(trustNoMoreThan(32), "No more than three in ten");
assert.equal(trustNoMoreThan(34.99), "No more than three in ten");
assert.equal(trustNoMoreThan(35), "No more than four in ten");
assert.equal(trustNoMoreThan(5), "No more than one in ten");
assert.equal(trustNoMoreThan(95), "No more than ten in ten");
assert.match(jsx, /trustNoMoreThan\(aesNow\.v\) \+ " Australians say people in government can be trusted"/);

console.log("trust-government: ok (" + S.length + " series, " + S.reduce((n, s) => n + s.readings.length, 0) + " readings)");
