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
const OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vic-build-")), "index.html");
const FED = ["index.html", "feed.xml", "sitemap.xml", "robots.txt", "assets/favicon.svg",
             "assets/masthead-dial.svg", "assets/auspol-now.json", "assets/auspol-latest.json",
             "assets/site-shell.css", "assets/site-shell.js"];
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
console.log(`vic build ok: ${D.individualPolls.length} polls, ${rm.length} Roy Morgan SMS archived, Premier now ${albWho[albWho.length - 1]}`);
