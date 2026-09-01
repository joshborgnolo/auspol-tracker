#!/usr/bin/env node
// check-news24-chrome.mjs — preflight for the News24 enrichment leg.
//
// LOCAL ONLY. This is the one check that cannot run on CI: the six per-wave
// Infogram ids exist only in the rendered article DOM, and there is no
// anonymous route to them (no public listing, no search, no usable RSS, and
// the walled page ships an empty infogram array). So the leg depends on macOS
// Automation consent, a reachable Chrome, and a live news24.com.au login —
// three things you would otherwise discover had broken at the worst possible
// moment, when a wave lands and quietly degrades to a VI-only row.
//
// Runs against the LATEST ALREADY-RECORDED wave, so it is a pure read that
// needs no new release and self-updates as waves land. It cannot prove the
// NEXT wave's fresh ids will parse — only that every layer beneath them is
// alive today.
//
// Exit 0 healthy / 1 broken, and the message names WHICH layer failed,
// because that is what decides the fix.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { IG_EMBED } from "./infogram.mjs";
import { n24IdsOf, n24InfogramFetch } from "./news24-infogram.mjs";

const OUT = process.env.PC_OUT ?? "data/polls.json";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REQUIRED = ["crosstab", "approvals", "ppm", "tpp"]; // every YouGov row but the primaries
const say = (o) => console.log(`PC_STATUS ${JSON.stringify(o)}`);
const die = (layer, msg, extra = {}) => {
  console.error(`News24 enrichment preflight FAILED at: ${layer}`);
  console.error(`  ${msg}`);
  say({ ok: false, layer, ...extra });
  process.exit(1);
};

const polls = JSON.parse(readFileSync(OUT, "utf8"));
const wave = (polls.polls ?? [])
  .filter((r) => /yougov/i.test(r.pollster ?? "") && /news24\.com\.au/.test(r.url ?? ""))
  .sort((a, b) => a.date.localeCompare(b.date)).pop();
if (!wave) die("target", "no recorded YouGov wave carries a news24.com.au url to probe");

let html = null;
try {
  html = execFileSync("node", [".build/chrome-article.mjs", wave.url],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
} catch (e) {
  const m = [e?.stderr, e?.message].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 300);
  die("chrome", `chrome-article.mjs failed — Chrome unreachable, or macOS Automation consent was reset ` +
    `(a Chrome update can do that). Re-grant under System Settings > Privacy & Security > Automation, ` +
    `and check View > Developer > "Allow JavaScript from Apple Events". Detail: ${m}`, { url: wave.url });
}

const ids = n24IdsOf(html ?? "");
if (!ids.length) {
  // Distinguish a dead login from a restructured page: a subscriber view of a
  // Pulse article names the series even when the embeds have moved.
  const looksLikeArticle = /News24 Pulse/i.test(html ?? "");
  die(looksLikeArticle ? "layout" : "session",
    looksLikeArticle
      ? `Chrome returned the article but it carries NO div.infogram-embed[data-id] — News24 has restructured. ` +
        `The parser keys on that attribute; re-derive ids before the next wave.`
      : `Chrome returned a page with neither embeds nor the "News24 Pulse" marker — the logged-in ` +
        `news24.com.au session has most likely expired. Sign in again in Chrome.`,
    { url: wave.url, bytes: (html ?? "").length });
}
if (ids.length < 6)
  die("layout", `only ${ids.length} embed id(s) found, expected 6 — News24 changed the article's chart set.`,
    { url: wave.url, ids });

const fetchEmbed = async (id) => {
  const res = await fetch(IG_EMBED(id), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};
const projects = await n24InfogramFetch(fetchEmbed, ids);
const kinds = projects.filter((p) => p.state === "ok").map((p) => p.kind);
const notes = projects.filter((p) => p.state !== "ok").map((p) => `${p.id}: ${p.why}`);
const missing = REQUIRED.filter((k) => !kinds.includes(k));
if (missing.length)
  die("parser", `embeds fetched, but these chart kinds no longer classify: ${missing.join(", ")}. ` +
    `Every YouGov row except the primaries comes from those. Kinds seen: ${JSON.stringify(kinds)}` +
    (notes.length ? ` | notes: ${notes.join(" | ")}` : ""),
    { url: wave.url, kinds, missing, notes });

console.error(`News24 enrichment preflight OK — Chrome, session, ${ids.length} embeds and all required ` +
  `chart kinds are alive against the ${wave.date} article.`);
say({ ok: true, date: wave.date, ids: ids.length, kinds, notes, fired: false });
