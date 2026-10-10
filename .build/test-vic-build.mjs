#!/usr/bin/env node
/* /vic/ is the main page's own build on Victorian data (BUILD_JUR=vic, since
   2026-10-05). This builds it to a scratch file and pins what makes it
   Victorian, and that it writes nothing of the federal page's.
   Run: node .build/test-vic-build.mjs */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), "vic-build-"));
const OUT = path.join(SCRATCH, "index.html");
const FED = ["index.html", "feed.xml", "sitemap.xml", "robots.txt", "assets/favicon.svg",
             "assets/masthead-dial.svg", "assets/auspol-now.json", "assets/auspol-latest.json",
             "assets/site-shell.css", "assets/site-shell.js",
             // the federal per-tab pages (real-URL tabs since 2026-10-10) are
             // the federal build's alone
             "cycles/index.html", "allpolls/index.html", "info/index.html"];
const before = FED.map((f) => [f, fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f)) : null]);
execFileSync(process.execPath, [path.join(ROOT, ".build/newtracker/build.mjs")],
  { cwd: ROOT, env: { ...process.env, BUILD_JUR: "vic", BUILD_OUT: OUT }, stdio: "pipe" });
for (const [f, was] of before)
  assert.ok(was == null ? !fs.existsSync(path.join(ROOT, f)) : fs.readFileSync(path.join(ROOT, f)).equals(was), `the Vic build left ${f} alone`);

// ---- the page --------------------------------------------------------------------------
const html = fs.readFileSync(OUT, "utf8");
assert.match(html, /<title>vicpol tracker – Victorian state election polling<\/title>/, "its own title");
assert.match(html, /<link rel="canonical" href="https:\/\/auspoltracker\.com\/vic\/">/, "its own canonical URL");
assert.ok(!/(?:href|url\()=?"assets\//.test(html), "shared assets are referenced from the site root");
assert.ok(!/og:image|application\/rss\+xml/.test(html), "no share card or feed of its own");
assert.match(html, /<h1>vicpol tracker<\/h1>/, "the plain-text article is Victorian");
assert.ok(!html.includes("window.AP_INITIAL_TAB="), "the Now document carries no initial-tab constant");

// ---- the per-tab pages the same run emits beside OUT ------------------------------------
// real-URL tabs (2026-10-10): Vic gets All polls and Info pages of its own,
// written beside BUILD_OUT, and a Past cycles page only once a term closes –
// Victoria has none yet, so cycles/ must NOT exist in the scratch dir
for (const [id, label] of [["allpolls", "All polls"], ["info", "Info"]]) {
  const t = fs.readFileSync(path.join(SCRATCH, id, "index.html"), "utf8");
  assert.match(t, new RegExp(`<title>vicpol tracker – ${label}</title>`), `vic/${id}/ has its own title`);
  assert.ok(t.includes(`<link rel="canonical" href="https://auspoltracker.com/vic/${id}/">`), `vic/${id}/ has its own canonical`);
  assert.ok(t.includes(`<meta property="og:url" content="https://auspoltracker.com/vic/${id}/">`)
    && t.includes(`<meta property="og:title" content="vicpol tracker – ${label}">`), `vic/${id}/ has its own og tags`);
  assert.ok(t.includes(`window.AP_INITIAL_TAB=${JSON.stringify(id)};`), `vic/${id}/ opens straight into the ${id} tab`);
  assert.ok(!/(?:href|url\()=?"assets\//.test(t), `vic/${id}/ references no relative assets`);
  assert.ok(t.includes('AP_CYCLE_SRC=null'), `vic/${id}/ keeps the Vic build's null cycle source`);
}
assert.ok(!fs.existsSync(path.join(SCRATCH, "cycles")), "no Past cycles page while Victoria has no past terms");

// ---- the dataset -------------------------------------------------------------------------
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, ".build/vic/out/9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), ctx);
const D = ctx.window.AUSPOL;
assert.equal(D.jur.id, "vic");
assert.equal(D.jur.brand, "vicpol", "the user's wordmark: vicpol tracker");
assert.equal(D.latest.nextElectionISO, "2026-11-28");
assert.ok(!D.cycles.some((c) => !c.current), "no past terms yet, so no Past cycles tab");
// every Victorian Roy Morgan poll is an SMS poll: archived, never aggregated
const rm = D.individualPolls.filter((q) => /Roy Morgan/.test(q.pollster));
assert.ok(rm.length > 0 && rm.every((q) => q.pollster === "Roy Morgan (SMS)" && q.noAgg), "Roy Morgan files as SMS, out of the aggregates");
// One Nation was folded into others before 2026: no month reads it as 0
assert.ok(!D.aggPrimary.some((m) => !m.election && m.onp === 0), "an unreported party-month is null, never 0");
// a one-day poll reads "13 Sep", never "13–13 Sep"
assert.ok(!D.individualPolls.some((q) => /^(\d+)–\1 /.test(q.field || "")), "no same-day ranges");
// each office's holders, month by month and poll by poll
const albWho = D.leaderMonths.filter((r) => r.alb_who).map((r) => r.alb_who);
assert.equal(albWho[0], "Andrews");
assert.equal(albWho[albWho.length - 1], D.jur.eras.alb[D.jur.eras.alb.length - 1].name, "the latest month names the current Premier");
const asked = D.individualPolls.filter((q) => q.ppm || q.ppmSets || (q.appr && q.appr.albNet != null));
assert.ok(asked.length && asked.every((q) => q.who && q.who.alb && q.who.opp), "every leadership poll names who held each office");
const early = asked.find((q) => q.released < "2023-09-27");
if (early) assert.equal(early.who.alb, "Andrews", "a 2023 poll asks about Andrews, not today's Premier");
// the lines are the Kalman smoother's trend (gen-data §1a), and say so
assert.equal(D.latest.method.kind, "kalman", "Victoria's figures are the trend's");
const line = D.synth2pp.filter((m) => !m.election);
assert.equal(line[line.length - 1].alp, D.synthLatest.alp, "the 2PP line ends on the headline");
const moves = line.slice(1).map((m, i) => Math.abs(m.alp - line[i].alp));
const meanMove = moves.reduce((a, b) => a + b, 0) / moves.length;
assert.ok(meanMove < 1.0, `the 2PP trend moves ${meanMove.toFixed(2)} pts a month on average (the monthly average moved 1.7)`);
assert.ok(line.every((m) => m.ci95 > 0), "every month carries the trend's interval, empty months included");
assert.ok(D.individualPolls.filter((q) => q.eff && q.eff.imp).every((q) => q.eff.imp.w === 1), "every poll counts in the trend");
assert.ok(D.synthLatest.changeSe > 0 && typeof D.synthLatest.changeSig === "boolean", "the month's change is tested");
console.log(`vic build ok: ${D.individualPolls.length} polls, ${rm.length} Roy Morgan SMS archived, Premier now ${albWho[albWho.length - 1]}`);
