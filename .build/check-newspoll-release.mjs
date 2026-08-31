#!/usr/bin/env node
// check-newspoll-release.mjs — Newspoll release watchdog (spec:
// .build/newspoll-infogram-rung.md). Like coverage-check, this job's FAILURE
// is the message: exit 1 means "a Newspoll wave exists that canon hasn't
// landed", delivered as a GitHub notification email.
//
// Why this can run on CI when the Newspoll extractor can't: rung A addresses
// the live Infogram project by a stable slug, so it needs no article, no
// cookies and no Chrome — the paywall is irrelevant. It DETECTS ONLY and
// never writes. Figures from a rolling live project must not be dated from
// the story they ride in on, and the label is a PUBLICATION date, so turning
// this into a writer would reintroduce exactly the trap the rung was built
// to avoid. Landing the wave stays the extractor's job.
import { readFileSync } from "node:fs";
import { infogramLive, IG_DAY_WINDOW } from "./infogram.mjs";

const OUT = process.env.NP_OUT ?? "data/polls.json";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000, FETCH_TRIES = 3;
const DAY = 86_400_000;

async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
      return { text: await res.text() };
    } catch (err) {
      lastErr = err;
      if (err.status === 403 || err.status === 429) break;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

const say = (o) => console.log(`NP_WATCH ${JSON.stringify(o)}`);

const polls = JSON.parse(readFileSync(OUT, "utf8"));
const nps = polls.polls.filter((r) => /newspoll/i.test(r.pollster ?? "")).map((r) => r.date).sort();
const latestNp = nps[nps.length - 1] ?? null;
if (!latestNp) { console.error("no Newspoll rows in canon — nothing to compare against"); say({ state: "no-canon", fired: false }); process.exit(0); }

const A = await infogramLive(fetchText, latestNp);

// The live label is a PUBLICATION date sitting 0–IG_DAY_WINDOW days after
// fieldwork end, so "newer than canon" alone is a false positive for the wave
// already recorded (2026-08-30 label vs the 2026-08-28 row). Only a label
// beyond that window can belong to an unrecorded wave.
const threshold = new Date(Date.parse(`${latestNp}T00:00:00Z`) + IG_DAY_WINDOW * DAY).toISOString().slice(0, 10);

if (A.state === "unavailable") {
  // A CDN blip must not page anyone; the extractor's own runs still cover us.
  console.error(`NP_WATCH soft: infogram unavailable — ${A.why}`);
  say({ state: A.state, why: A.why, latestNp, fired: false });
  process.exit(0);
}
if (A.state === "guard") {
  console.error(`NP_WATCH guard: ${A.why}`);
  say({ state: "guard", why: A.why, latestNp, fired: true });
  process.exit(1);
}
if (A.state === "stale" || A.pubIso <= threshold) {
  say({ state: A.state === "stale" ? "stale" : "current", latestNp, threshold, label: A.pubIso ?? null, fired: false });
  process.exit(0);
}

const f = A.figs;
const netsatLast = A.netsat?.[A.netsat.length - 1] ?? null;
console.error(`Newspoll release detected: Infogram label ${A.pubIso}, canon's latest wave is ${latestNp}.`);
console.error(`  primaries  alp ${f.alp} lnp ${f.lnp} onp ${f.onp} grn ${f.grn} ind ${f.ind}`);
console.error(`  better PM  alb ${f.ppmA} ${A.betterpmOppName ?? "opp"} ${f.ppmO} (uncommitted ${A.ppmUnc ?? "?"})`);
console.error(`  net sat    pm ${f.pmNet}, opp-by-era ${JSON.stringify(f.oppNetByEra)}`);
if (A.tppResumed) console.error("  NOTE: the 2PP feed is no longer N/A — Newspoll may have resumed publishing 2PP.");
console.error(`  Run: node .build/extract-newspoll.mjs --check   (figures land via the extractor, never from here)`);
console.error(`  While you are here, settle the open question in .build/newspoll-infogram-rung.md: refetch`);
console.error(`  https://e.infogram.com/8b461452-4d45-46fc-8d8f-d1c761a4932e?src=embed — if it now serves THIS`);
console.error(`  wave, rung B is article-free too and Newspoll can leave Chrome behind entirely.`);
say({ state: "release", latestNp, threshold, label: A.pubIso, refreshed: A.refreshed,
  figs: f, tppResumed: !!A.tppResumed, netsatLast: netsatLast?.iso ?? null, fired: true });
process.exit(1);
