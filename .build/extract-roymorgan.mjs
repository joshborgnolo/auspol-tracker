// Extract the latest Roy Morgan federal-voting-intention releases from the
// findings feed (https://www.roymorgan.com/findings) and append their rows to
// data/polls.json (the tracker's canonical current-cycle dataset).
//
// There is no data file upstream: the site is a Next.js app whose listing
// cards ride in the page's __NEXT_DATA__ JSON, and each release's figures
// live in its prose. A release qualifies when its topics include
// "Federal Poll" AND its slug contains "federal-voting-intention" — press
// round-ups (topic "Press Release" only) and specials like the post-Budget
// SMS poll (slug "federal-voting-post-budget-special-sms-morgan-poll-…") are
// different products and stay out.
//
// Parsing target (all in findingData.postBy.content, entity/HTML cleaned):
//   - the lead sentence lists every party's share with the week-on-week
//     change mixed in ("ALP primary support is down 1.5% to 27%", "unchanged
//     at 27.5%", "One Nation 27% (up 2%)", down 2% AT 12%…). The change
//     phrases are stripped, then each party is read as NAME … to/at/on V%.
//     Verified against live releases 2026-03-30 → 2026-08-24 (17/19; the two
//     misses are pre-April narrative-era and a wrong-by-one dateStart that was
//     hand-entered in polls.json, matching the release text here).
//   - stated-preference 2PP: the first "ALP x%" … "L-NP y%" pair after the
//     "vote their preferences" anchor (the ALP-vs-One-Nation pair and the
//     2025-election preference-flow pair also appear in the text and are NOT
//     what the tracker series' tpp_alp/tpp_lnp store).
//   - election-flows 2PP: releases also print an ALP/L-NP pair "allocated
//     based on how Australians voted at the 2025 Federal Election" — a
//     clause can intervene ("…marginally closer … Allocating the preference
//     flows … shows the ALP on 55% …"), so the window is generous and "the
//     ALP on x%" phrasing is accepted. Stored as tpp_flows (ALP share only;
//     L-NP is its complement). Eras that never print the pair have no such
//     phrase at all and the pair stays null — an anchor WITHOUT a pair is
//     only a warning, but a parsed pair that fails the plausibility guards
//     aborts the run.
//   - ALP v One Nation 2PP: weekly since 2026-05-17 (polls.json wave date;
//     released May 18) the release closes with an ALP-vs-One-Nation
//     head-to-head after the anchor "contest is set to be between the ALP
//     and One Nation" (two estimator phrasings — "the Morgan Poll estimates
//     …" and "Roy Morgan estimates …"). Filed as an altTpp record {date,
//     firm, alpVsOnp_alp, lnpVsOnp_lnp:null}, never a polls-row field;
//     absent anchors before that wave are NOT a warning.
//   - fieldwork period "conducted from Month D – Month D, YYYY", sample
//     "cross-section of N electors", and (when present) the "can't say" share,
//     which is undecided BESIDE the primaries, not inside them.
//
// Row shape mirrors the hand-entered Roy Morgan entries already in
// data/polls.json; `date` is the fieldwork-ending Sunday, `published` the
// CMS post datetime converted UTC → Australia/Melbourne. Rows are inserted
// in date order (validate.mjs demands a globally sorted array). An existing
// (date, "Roy Morgan") polls row is never re-added, but its release can
// still contribute: a parsed ALP-v-One-Nation pair whose (date, firm) key
// is missing from altTpp is appended there even when the polls row exists
// (self-heals a wave missed on its original run). A run that adds neither
// writes nothing.
//
// Provenance: each appended release's parsed post JSON is saved to
// .build/roymorgan-src/release-<slug>.json and committed alongside.
//
// Usage: node .build/extract-roymorgan.mjs [--check] [feed-url]
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `RM_STATUS {json}` with changed, added, skipped — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (a figure
//     missing, sums off 100, implausible values, non-Sunday period end,
//     release date inconsistent with the field period) — the upstream format
//     changed or the parse went wrong; nothing is written
//   - --check computes everything, prints RM_STATUS, never writes
//   - writes are atomic (.tmp + rename)
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FEED_URL = argv.find((a) => !a.startsWith("--")) || "https://www.roymorgan.com/findings";
const OUT = "data/polls.json";
const SRC_DIR = ".build/roymorgan-src";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;

// ---------------------------------------------------------------- fetching
async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker data update)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch failed after ${FETCH_TRIES} tries: ${url}: ${lastErr.message}`);
}

function nextData(html, what) {
  const m = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no __NEXT_DATA__ in ${what}`);
  return JSON.parse(m[1]);
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip the week-on-week change phrases so "down 1.5% to 27%", "unchanged at
// 27.5%", "27% (up 2%)", "increased support 1% to 25.5%" and "down 2% at 12%"
// all collapse to "<party> … to/at/on <value>%".
function normaliseLead(lead) {
  return lead
    .replace(/\(\s*(?:up|down|unchanged|both unchanged|no change)[^)]*\)/gi, "")
    .replace(/\b(?:up|down|rose|fell|increased|decreased|dropped|declined|grew)\s+(?:support\s+|by\s+)?[\d.]+\s*%\s*(?:points?\s*)?(?=\s*(?:to|at)\s)/gi, "")
    .replace(/\bunchanged\s+(?=(?:at|on)\s+[\d.])/gi, "");
}
const BOUND = "(?:to|at|on|is|was|were|are)";
const toValIn = (scope, name) => {
  const m = scope.match(new RegExp("\\b" + name + "\\b\\s+(?:on\\s+)?([\\d.]+)\\s*%", "i"))
       ?? scope.match(new RegExp("\\b" + name + "\\b[^%]{0,60}?\\b" + BOUND + "\\s+([\\d.]+)\\s*%", "i"));
  return m ? parseFloat(m[1]) : null;
};
const IND_NAME = "(?:Independents?\\s*\\/\\s*Other Parties|Other Parties\\s*\\/\\s*Independents?)";

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const sundayOf = (dateIso) => new Date(dateIso + "T00:00:00Z").getUTCDay() === 0;

// --------------------------------------------------------------- the parse
function parseRelease(post) {
  const t = clean(post.content);
  const missing = [];
  const eIdx = t.indexOf("electors.");
  const lead = normaliseLead(eIdx === -1 ? t : t.slice(0, eIdx + 8));
  if (eIdx === -1) missing.push("lead sentence (…electors.)");

  const alp = toValIn(lead, "ALP");
  const onp = toValIn(lead, "One Nation");
  const lnp = toValIn(lead, "L-NP Coalition");
  const lib = toValIn(lead, "Liberals?");
  const nat = toValIn(lead, "Nationals");
  const grn = toValIn(lead, "Greens");
  const ind = toValIn(lead, IND_NAME);
  for (const [k, v] of [["alp", alp], ["onp", onp], ["lnp", lnp], ["lib", lib], ["nat", nat], ["grn", grn], ["ind", ind]])
    if (v == null) missing.push(k);

  const undM = t.match(/([\d.]+)%\s*\((?:up|down|unchanged)[^)]*\)\s*[^)]{0,40}?can.?t say/i)
        ?? t.match(/([\d.]+)%[^%]{0,60}?can.?t say/i);
  const undecided = undM ? parseFloat(undM[1]) : null; // optional: some eras omit the line

  const sampleM = t.match(/cross-section of ([\d,]+) electors/i);
  if (!sampleM) missing.push("sample");

  const pm = t.match(/conducted from\s+([A-Za-z]+)\.?\s+(\d+)\s*[-–]\s*(?:([A-Za-z]+)\.?\s+)?(\d+),\s+(\d{4})/i);
  let dateStart = null, date = null;
  if (!pm) missing.push("field period");
  else {
    const [, m1, d1, m2, d2, y] = pm;
    const mo1 = MONTHS[m1.toLowerCase()];
    const mo2 = m2 ? MONTHS[m2.toLowerCase()] : mo1;
    if (mo1 == null || mo2 == null) missing.push(`field months ${m1}/${m2}`);
    else {
      /* the printed year belongs to the END date; a Dec→Jan window starts in
         the prior year */
      dateStart = iso(mo2 < mo1 ? +y - 1 : +y, mo1, +d1);
      date = iso(+y, mo2, +d2);
    }
  }

  let tpp_alp = null, tpp_lnp = null;
  const wi = t.search(/vote.\s*their preferences/i);
  if (wi === -1) missing.push("2pp anchor");
  else {
    const w = t.slice(wi, wi + 300);
    const pa = w.match(/ALP\s*([\d.]+)%/i);
    const pl = pa && w.slice(w.indexOf(pa[0]) + pa[0].length).match(/L-NP(?:\s+Coalition)?\s+([\d.]+)%/i);
    if (!pa || !pl) missing.push("2pp pair");
    else { tpp_alp = parseFloat(pa[1]); tpp_lnp = parseFloat(pl[1]); }
  }

  let tpp_flows = null, tpp_flows_lnp = null, flowsPairMissing = false;
  const fi = t.search(/2025 Federal Election/i);
  if (fi !== -1) {
    const w = t.slice(fi, fi + 700);
    const pa = w.match(/ALP\s+(?:on\s+)?([\d.]+)\s*%/i);
    const pl = pa && w.slice(w.indexOf(pa[0]) + pa[0].length).match(/L-NP(?:\s+Coalition)?\s+(?:on\s+)?([\d.]+)\s*%/i);
    if (pa && pl) { tpp_flows = parseFloat(pa[1]); tpp_flows_lnp = parseFloat(pl[1]); }
    else flowsPairMissing = true;
  }

  // ALP v One Nation 2PP — weekly since wave date 2026-05-17, anchored on
  // "...contest is set to be between the ALP and One Nation" (absent before
  // that wave, no warning then). Two estimator phrasings — "the Morgan Poll
  // estimates … (narrowly )?(leading|in front of)" and "Roy Morgan
  // estimates … in front of". The window goes through normaliseLead() first:
  // the week-on-week change parentheticals ("(up 2.5%)") contain "%" and a
  // [^%]* gap would mis-latch. The 2026-05-17 variant ("the ALP 54% leads
  // One Nation 46%", post-budget SMS-poll flows) is already recorded in
  // altTpp and its release is out of the feed — documented, not parsed here.
  let tpp_onp = null, tpp_onp_onp = null, onpPairMissing = false;
  const oi = t.search(/contest is set to be between the ALP and One Nation/i);
  if (oi !== -1) {
    const w = normaliseLead(t.slice(oi, oi + 500));
    const op = w.match(/the ALP\s+(?:on\s+)?([\d.]+)\s*%[^%]{0,60}?(?:leading|leads?|in front of)\s+One Nation\s+(?:on\s+)?([\d.]+)\s*%/i);
    if (op) { tpp_onp = parseFloat(op[1]); tpp_onp_onp = parseFloat(op[2]); }
    else onpPairMissing = true;
  }

  // CMS post datetime (UTC) → Australia/Melbourne local, "YYYY-MM-DDTHH:MM"
  let published = null;
  const pd = post.date;
  if (pd) {
    const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(pd) ? pd : pd + "Z");
    if (isNaN(d)) missing.push(`published date "${pd}"`);
    else {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en", {
        timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(d).map((x) => [x.type, x.value]));
      published = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    }
  }

  return {
    date, dateStart, published, alp, lnp, grn, onp, ind, undecided, lib, nat,
    tpp_alp, tpp_lnp, tpp_flows, tpp_flows_lnp, flowsPairMissing,
    tpp_onp, tpp_onp_onp, onpPairMissing,
    sample: sampleM ? +sampleM[1].replace(/,/g, "") : null,
    missing,
  };
}

// ------------------------------------------------------------------ guards
function guardRelease(r, slug, releaseDate) {
  const errs = [];
  if (r.missing.length) errs.push(`unparsed: ${r.missing.join(", ")}`);
  const check = (name, ok) => { if (!ok) errs.push(name); };
  if (r.date) {
    check("period end is a Sunday", sundayOf(r.date));
    if (r.dateStart) {
      const span = (new Date(r.date) - new Date(r.dateStart)) / DAY;
      check(`field span 1–15d (got ${span})`, span >= 1 && span <= 15);
    }
    if (releaseDate) {
      const lag = (new Date(releaseDate) - new Date(r.date)) / DAY;
      check(`release-date lag 0–10d (got ${lag})`, lag >= 0 && lag <= 10);
    }
  }
  for (const [k, v] of Object.entries({ alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, ind: r.ind, lib: r.lib, nat: r.nat }))
    if (v != null) check(`${k}=${v} in 0.5–60`, v >= 0.5 && v <= 60);
  if ([r.alp, r.lnp, r.grn, r.onp, r.ind].every((v) => v != null)) {
    const sum = r.alp + r.lnp + r.grn + r.onp + r.ind;
    check(`primaries Σ=${sum.toFixed(1)} ~100`, Math.abs(sum - 100) <= 1.0);
  }
  if (r.lib != null && r.nat != null && r.lnp != null)
    check(`lib+nat=${(r.lib + r.nat).toFixed(1)} ≈ lnp=${r.lnp}`, Math.abs(r.lib + r.nat - r.lnp) <= 0.75);
  if (r.tpp_alp != null && r.tpp_lnp != null)
    check(`2pp Σ=${r.tpp_alp + r.tpp_lnp} ~100`, Math.abs(r.tpp_alp + r.tpp_lnp - 100) <= 1.0);
  if (r.tpp_flows != null && r.tpp_flows_lnp != null) {
    check(`flows 2pp Σ=${r.tpp_flows + r.tpp_flows_lnp} ~100`, Math.abs(r.tpp_flows + r.tpp_flows_lnp - 100) <= 1.0);
    check(`flows alp=${r.tpp_flows} in 40–65`, r.tpp_flows >= 40 && r.tpp_flows <= 65);
  }
  if (r.tpp_onp != null && r.tpp_onp_onp != null) {
    check(`onp 2pp Σ=${r.tpp_onp + r.tpp_onp_onp} ~100`, Math.abs(r.tpp_onp + r.tpp_onp_onp - 100) <= 1.0);
    check(`onp alp=${r.tpp_onp} in 40–65`, r.tpp_onp >= 40 && r.tpp_onp <= 65);
  }
  if (r.undecided != null) check(`undecided=${r.undecided} in 0–25`, r.undecided > 0 && r.undecided <= 25);
  if (r.sample != null) check(`sample=${r.sample} in 500–10000`, r.sample >= 500 && r.sample <= 10000);
  return errs.map((e) => `${slug}: ${e}`);
}

// -------------------------------------------------------------------- main
const status = { changed: false, check: CHECK, added: [], skipped_existing: [], warnings: [], feed: FEED_URL };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const rmDates = new Set(D.polls.filter((p) => p.pollster === "Roy Morgan").map((p) => p.date));
  const altBy = new Set((D.altTpp || []).map((a) => a.date + "|" + a.firm));

  const feed = nextData(await fetchText(FEED_URL), "findings feed");
  const posts = feed?.props?.pageProps?.pageData?.postData?.posts;
  if (!Array.isArray(posts)) throw new Error("feed pageData.postData.posts missing (site restructure?)");
  const candidates = posts.filter((p) =>
    (p.topics || []).some((t) => t.name === "Federal Poll") &&
    /federal-voting-intention/.test(p.slug || ""));
  status.candidates = candidates.map((c) => c.slug);

  const newRows = [];
  const guardFails = [];
  const sources = [];
  const altAdds = [];
  for (const c of candidates) {
    const post = nextData(await fetchText(`https://www.roymorgan.com/findings/${c.slug}`), c.slug)
      ?.props?.pageProps?.findingData?.postBy;
    if (!post?.content) { guardFails.push(`${c.slug}: no findingData.postBy.content`); continue; }
    const r = parseRelease(post);
    if (r.flowsPairMissing) status.warnings.push(`${c.slug}: "2025 Federal Election" anchor present but no flows pair parsed`);
    if (r.onpPairMissing) status.warnings.push(`${c.slug}: "between the ALP and One Nation" anchor present but no ALP-v-ON pair parsed`);
    const rd = post.findings?.releaseDate?.split("/").reverse().join("-"); // "24/08/2026" → 2026-08-24
    const rdOk = rd && /^\d{4}-\d{2}-\d{2}$/.test(rd) ? rd : null;
    const existed = !!(r.date && rmDates.has(r.date));
    const errs = guardRelease(r, c.slug, rdOk);
    // For a wave already recorded in polls[], only its altTpp contribution is
    // still live — guard just that pair; poll-field guards belong to the
    // row's original run (historic rows predate some checks).
    guardFails.push(...(existed ? errs.filter((e) => /\bonp (?:2pp Σ|alp=)/.test(e)) : errs));
    if (r.tpp_onp != null && r.date) {
      const k = r.date + "|Roy Morgan";
      if (!altBy.has(k) && !altAdds.some((a) => a.date + "|" + a.firm === k)) {
        altAdds.push({ date: r.date, firm: "Roy Morgan", alpVsOnp_alp: r.tpp_onp, lnpVsOnp_lnp: null });
        if (existed) status.alt_healed = [...(status.alt_healed || []), r.date];
      }
    }
    if (existed) { status.skipped_existing.push(r.date); continue; }
    if (guardFails.length) continue;
    newRows.push({
      date: r.date,
      published: r.published,
      dateStart: r.dateStart,
      pollster: "Roy Morgan",
      client: "—",
      sample: r.sample,
      ...(r.undecided != null ? { undecided: r.undecided } : {}),
      alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, ind: r.ind, oth: null,
      tpp_alp: r.tpp_alp, tpp_lnp: r.tpp_lnp,
      ...(r.tpp_flows != null ? { tpp_flows: r.tpp_flows } : {}),
      lnpSplit: { Lib: r.lib, Nat: r.nat },
      url: `https://www.roymorgan.com/findings/${c.slug}`,
    });
    sources.push({ slug: c.slug, json: JSON.stringify(post, null, 2) + "\n" });
    status.added.push({ date: r.date, slug: c.slug, alp: r.alp, lnp: r.lnp, onp: r.onp, tpp: `${r.tpp_alp}/${r.tpp_lnp}`, flows: r.tpp_flows, onp2pp: r.tpp_onp != null ? `${r.tpp_onp}/${r.tpp_onp_onp}` : null });
  }
  for (const w of status.warnings) console.warn("RM_WARN " + w);
  if (guardFails.length) {
    console.error("RM_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("RM_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newRows.length || altAdds.length) {
    if (newRows.length) {
      D.polls = [...D.polls, ...newRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    if (altAdds.length) {
      D.altTpp = [...(D.altTpp || []), ...altAdds].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      console.log(`altTpp: +${altAdds.length} Roy Morgan ALP-v-One-Nation pair(s): ${altAdds.map((a) => a.date).join(", ")}`);
    }
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      if (sources.length) {
        mkdirSync(SRC_DIR, { recursive: true });
        for (const s of sources) writeFileSync(`${SRC_DIR}/release-${s.slug}.json`, s.json);
      }
      if (newRows.length) console.log(`wrote ${OUT}: +${newRows.length} Roy Morgan wave(s): ${status.added.map((a) => a.date).join(", ")}`);
    }
  } else {
    status.changed = false;
  }
  console.log("RM_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("RM_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("RM_STATUS " + JSON.stringify(status));
  process.exit(1);
}
