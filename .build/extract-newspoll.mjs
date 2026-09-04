// Extract the latest Newspoll federal releases and append rows to
// data/polls.json (the tracker's canonical current-cycle dataset): voting
// intention into `polls`, preferred-PM into `ppm`, leader nets into
// `approval`.
//
// Newspoll has no data endpoint: News Corp publishes numbers only inside
// paywalled articles, so this extractor reads FREE coverage and merges the
// pieces. Discovery is the Bing News RSS query "newspoll" for the AU market
// (plus the publisher-of-record topic page theaustralian.com.au/topics/
// newspoll — bot-walled for plain fetch, so its tiles are read through the
// NEWSIE_CHROME session when set, and yield "Newspoll:" release titles+links
// only, never figures: 1c5c3ea, reverted f14a46f); Bing item links are
// apiclick.aspx?...&url=<encoded> wrappers and decode IN-PROCESS to the
// publisher URL — Google News RSS was tried first but its /rss/articles/
// links now serve a JS shell with the publisher URL behind a rotating
// internal RPC, so Google discovery was dropped. Candidate stories are
// fetched from a ranked allowlist of outlets and each article yields a
// PARTIAL release record; records for the same fieldwork window are merged
// (rank wins ties, a same-field disagreement >0.5pp is a guard failure, not
// a coin flip).
//
// Source ranking (stored url/client come from the best-ranked source fetched):
//   0 theaustralian.com.au  – publisher; standfirst/JSON-LD only, 403/429 ->
//                             archive.md/newest snapshot of the same URL ->
//                             NEWSIE_CHROME=1 only: rendered read through the
//                             user's logged-in Chrome (chrome-article.mjs)
//   1 aapnews.aap.com.au    – free AAP wire
//   2 abc.net.au            – free
//   3 thenewdaily.com.au    – free but Cloudflare-walled; archive.md fallback
//   4 theconversation.com   – free; Beaumont analyses carry full figures
//   5 thenightly.com.au     – free
//   6 msn.com               – syndication mirror (news.com.au etc); the HTML
//                             page is a JS shell, so articles are read via
//                             MSN's content-view JSON render endpoint
// Hand-keyed precedent for secondary-source rows exists in polls.json
// (2025-08-14 client "The New Daily", 2025-09-11 url thenightly).
//
// Parse targets (coverage prose style, post-normalisation "per cent"->"%",
// change phrases stripped): primaries ALP/Coalition/Greens/One Nation and an
// "Others (incl. independents)" bucket mapped to `ind`, matching the
// hand-entered Newspoll rows (a source that splits independents from others
// fills `oth` too); TPP "Labor X% of the two-party preferred" with the
// complement derived as 100-X; satisfaction "net approval rating of
// minus-17" or app/dis pairs per leader; preferred-PM pair; fieldwork window
// either explicit ("from Month D to Month D") or relative to publication
// ("between Monday and Thursday last week"); sample "survey of 1,283 voters".
// A 2025-09-11 thenightly release and the hand-keyed 2025-07-17 The
// Australian row are the regression oracles (see --url).
//
// Row shapes mirror the existing Newspoll entries: polls
// {date,published,dateStart,pollster,client,sample,alp,lnp,grn,onp,ind,oth,
// tpp_alp,tpp_lnp,url}; ppm {date,firm,alb,opp,oppName,han:null,extra:null};
// approval {date,firm,alb,opp,oppName,han:null,detail} (detail carries
// {app,dis} per leader only when BOTH were explicitly stated). Leadership
// rows are Albanese-era only (pm/opp slots are hardcoded downstream in
// gen-data.mjs); releases dated before 2022-05-23 write VI only.
//
// Provenance: each parsed article's cleaned text + figures are saved to
// .build/newspoll-src/release-<dateIso>.json and committed alongside.
//
// Usage: node .build/extract-newspoll.mjs [--check] [--url <article-url>]
//   --url parses one article (any allowlist host) and prints the record
//   without touching polls.json – development/regression hook.
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `NP_STATUS {json}` with changed, added, skipped_existing — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (missing
//     figures, sums off 100, implausible values, source conflict, leader-era
//     mismatch) — upstream phrasing changed or the parse went wrong; nothing
//     is written
//   - --check computes everything, prints NP_STATUS, never writes
//   - writes are atomic (.tmp + rename)
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { IG_SLUG, IG_EMBED, igWindow, infogramLive, infogramStatic, attachTarget,
  IG_DAY_WINDOW, IG_STA_WINDOW } from "./infogram.mjs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const URL_OF = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--url"));
const OUT = "data/polls.json";
const SRC_DIR = ".build/newspoll-src";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;
const BING = "https://www.bing.com/news/search?q=newspoll&format=rss&mkt=en-AU";
const TOPIC = "https://www.theaustralian.com.au/topics/newspoll?eafs_enabled=false";
const DAY = 86400000;

// Ranked source allowlist: host suffix -> [client name, rank]
const SOURCES = [
  ["theaustralian.com.au", "The Australian", 0],
  ["aapnews.aap.com.au", "AAP", 1],
  ["abc.net.au", "ABC", 2],
  ["thenewdaily.com.au", "The New Daily", 3],
  ["theconversation.com", "The Conversation", 4],
  ["thenightly.com.au", "The Nightly", 5],
  ["msn.com", "MSN", 6],
];
const sourceFor = (url) => {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  for (const [suf, client, rank] of SOURCES)
    if (host === suf || host.endsWith("." + suf)) return { client, rank, host };
  return null;
};

// State-poll and off-topic headlines stay out; federal launches only.
const EXCLUDE = /\b(nsw|victoria(?:n)?|queensland|western australia|south australia|tasmania|by-election|state poll|bradfield|goldstein|senate estimate|u.s.|us election)\b/i;

// Leadership era table (Albanese-era only; VI rows are written regardless).
// Era bounds follow the fieldwork-end dates of the canonical polls.json rows.
const LEADERS = {
  pm: { name: "Albanese", oppName: null, from: "2022-05-23" },
  ols: [
    { surname: "dutton", oppName: "Dutton", from: "2022-05-30", to: "2025-05-12" },
    { surname: "ley", oppName: "Ley", from: "2025-05-13", to: "2026-02-08" },
    { surname: "taylor", oppName: "Taylor", from: "2026-02-09", to: null },
  ],
};
const olFor = (date) => LEADERS.ols.find((o) => date >= o.from && (!o.to || date <= o.to)) ?? null;

// ---------------------------------------------------------------- fetching
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
async function fetchOnce(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return { url: res.url, text: await res.text() };
}
async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try { return await fetchOnce(url); } catch (err) {
      lastErr = err;
      if (err.status === 403 || err.status === 429) break; // walls don't lift on retry
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}
async function fetchArticle(url) {
  // MSN syndication pages are JS shells; the body lives behind MSN's
  // content-view JSON endpoint, keyed by the /ar-<id> segment. Wrap the JSON
  // fields in just enough HTML for articleBits to find title + pubdate.
  const msn = url.match(/msn\.com\/([a-z]{2}-[a-z]{2})\/[^?]*\/ar-([A-Za-z0-9]+)/i);
  if (msn) {
    const j = JSON.parse((await fetchText(`https://assets.msn.com/content/view/v2/Detail/${msn[1]}/${msn[2]}?disableEdgeCache=true`)).text);
    const title = (j.title ?? "").replace(/</g, "&lt;");
    const pubd = j.publishedDateTime ?? "";
    // MSN aggregates; the underlying publisher (provider.name) and its
    // canonical link (sourceHref) are the honest provenance for the row.
    return {
      url, canon: j.sourceHref ?? null, provider: j.provider?.name ?? null,
      text: `<title>${title}</title><meta property="article:published_time" content="${pubd}"><p>${j.abstract ?? ""}</p>${j.body ?? ""}`,
    };
  }
  // NEWSIE_CHROME=1 only: rendered read of the page in the user's logged-in
  // Chrome (chrome-article.mjs drives it via AppleScript; needs Chrome's
  // "Allow JavaScript from Apple Events" plus one-time Automation consent).
  // Interactive rescue path — launchd never sets NEWSIE_CHROME, so scheduled
  // runs keep the plain + archive.md behaviour exactly.
  const chromeFallback = () => {
    if (!process.env.NEWSIE_CHROME) return null;
    if (!/(^|\.)theaustralian\.com\.au$/.test(new URL(url).hostname)) return null;
    try {
      const text = execFileSync("node", [".build/chrome-article.mjs", url],
        { encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
      return { url, text };
    } catch {
      return null; // helper already said why on stderr; caller keeps falling
    }
  };
  const archiveFallback = async (cause) => {
    const arc = await fetchText(`https://archive.md/newest/${url}`).catch(() => null);
    if (arc && !/<title>\s*no cookies\b/i.test(arc.text)) return arc; // final URL is the snapshot page; same parser applies
    const chrome = chromeFallback();
    if (chrome) { console.error("NP_NOTE archive.md unusable; read theaustralian via NEWSIE_CHROME session"); return chrome; }
    if (arc) return arc; // snapshot of the wall page is still better than nothing
    throw cause;
  };
  try {
    const page = await fetchText(url);
    // theaustralian.com.au answers bots with a 200 "No Cookies" challenge
    // page rather than a 403; detect it by title and take the archive path.
    if (/<title>\s*no cookies\b/i.test(page.text))
      return archiveFallback(Object.assign(new Error("no-cookies wall"), { status: 403 }));
    return page;
  } catch (err) {
    if (err.status !== 403 && err.status !== 429) throw err;
    return archiveFallback(err);
  }
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&lsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

// Unified percentage grammar: "34 per cent" and "34%" both become "34%";
// "minus-17"/"minus 17" -> "-17"; trailing change clauses are dropped so
// "rose 4 points to 10%" yields 10, and "up from 6.4%" never wins a slot.
function normalise(t) {
  return t
    .replace(/(\d[\d.]*)\s*per\s*cent\b/gi, "$1%")
    .replace(/(\d[\d.]*)\s*pc\b/gi, "$1%")
    .replace(/minus-?\s*(\d+(?:\.\d+)?)/gi, "-$1")
    .replace(/(\d)\s*percentage points?\b/gi, "$1pp")
    .replace(/\(\s*(?:up|down|unchanged|both unchanged|no change|steady)[^)]*\)/gi, "")
    .replace(/\b(?:up|down|rose|rising|fell|falling|slumped?|slumping|dropped|dropping|grew|growing|increased?|decreased?|jumped?|edged|eased|improved?|crashed|collapsed?|plunged?|gained|lost|losing)\s+(?:support\s+|by\s+|to\s+a\s+(?:record|historic)[^%]{0,24}?)?[\d.]+\s*%(?:\s*|\s*points?\s*)(?=(?:to|at)\s)/gi, "")
    .replace(/\bunchanged\s+(?=(?:at|on)\s+[\d.])/gi, "");
}

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dateIso = (d) => iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const today = () => dateIso(new Date());
const PCT = "([\\d.]+)\\s*%";
function sentences(t) { return t.split(/(?<=[.!?])\s+/); }

// Roundup columns cover rival firms' polls alongside Newspoll ("the
// Redbridge poll gave the Coalition a 53–47 lead"). Those sentences
// satisfy every scope regex, so they're excluded before any matching; a
// Newspoll sentence never names a firm other than Newspoll itself.
const OTHER_FIRM = /\b(redbridge|freshwater|essential (?:poll|report|media)|roy morgan|\bmorgan\b|resolve (?:poll|strategic)|demosau|yougov|ucomms|jws|accent research)\b/i;

// First % within a sentence after the party name wins; long window covers
// "One Nation appears to have taken advantage … with its primary vote
// rising to 10%". Reverse: "53% for the Coalition". The alternation must be
// GROUPED in both patterns — an ungrouped `x|y` spills over the whole regex,
// so a bare "coalition" mention with no figure matches rev and yields NaN.
function findParty(scope, names) {
  const fwd = new RegExp(`\\b(?:${names})(?:'s)?\\b[^%.]{0,120}?${PCT}`, "i");
  const rev = new RegExp(`${PCT}\\s*(?:of the (?:primary|first[- ]preference)[^%]{0,30}?\\s)?(?:for|to)\\s+(?:the\\s+)?(?:${names})\\b`, "i");
  for (const s of scope) {
    const m = s.match(fwd) ?? s.match(rev);
    if (m && m[1] != null) return parseFloat(m[1]);
  }
  return null;
}

// Roundups keep describing a rival poll's figures WITHOUT re-naming the
// firm ("In a three-way preferred PM question, Albanese had 31% …" —
// Redbridge's three-way printed sentence-after-sentence under the
// "Redbridge and Accent Research poll" intro, with no firm name of its own
// — 2026-08-30). Once a firm is named, sentences are dropped until one
// re-anchors on "Newspoll".
function dropForeign(sents) {
  const out = [];
  let foreign = false;
  for (const s of sents) {
    if (OTHER_FIRM.test(s)) { foreign = true; continue; }
    if (foreign) {
      if (/\bnewspoll\b/i.test(s)) foreign = false;
      else continue;
    }
    out.push(s);
  }
  return out;
}

// "core support for the Greens and Others fell to 13% and 9% respectively":
// figures pair positionally with the named entities. Without this rule the
// naive forward regex assigned the FIRST figure to every party in the chain
// (ind was read as 13, the Greens figure — the 2026-08-28 conflict).
const RESPEC_PARTY = /one nation(?:'s)?|\b(?:the )?coalition\b|\bliberal-national\b|\blabor\b|\bthe alp\b|\bgreens\b|\bindependents\b|\ball others\b|\bother parties\b|\bothers\b/gi;
const respecKey = (tok) => (/one nation/i.test(tok) ? "onp"
  : /coalition|liberal/i.test(tok) ? "lnp"
  : /labor|the alp/i.test(tok) ? "alp"
  : /greens/i.test(tok) ? "grn" : "ind");
function respectivelyMap(scope) {
  const out = {};
  for (const s of scope) {
    const cut = s.search(/\brespectively\b/i);
    if (cut < 0) continue;
    // only the clause up to "respectively" pairs entities with figures;
    // the sentence may then run on into other questions' numbers
    const seg = s.slice(0, cut);
    const ents = [...seg.matchAll(RESPEC_PARTY)].map((m) => respecKey(m[0]));
    const figs = [...seg.matchAll(/([\d.]+)\s*%/g)].map((m) => parseFloat(m[1]));
    if (ents.length < 2 || ents.length !== figs.length) continue;
    ents.forEach((k, i) => { if (out[k] == null) out[k] = figs[i]; });
  }
  return out;
}

function parseArticle(text, pubDateIso) {
  const t = normalise(text);
  const S = dropForeign(sentences(t));
  // Whole-text fallbacks ("poll of 1,242 voters", "conducted … X to Y") run
  // over the same firm-filtered corpus so a rival poll's sample or window
  // can't win by document position.
  const tNP = S.join(" ");
  const missing = [];
  const primScope = S.filter((s) => /primary vote|first[- ]preference|core support|primary support/i.test(s));
  const scope = primScope.length ? primScope
    : S.filter((s) => !/two[- ]party|2pp|satisfied|satisfaction|preferred (?:prime minister|pm)/i.test(s));
  const r = {};

  r.alp = findParty(scope, "labor|the alp|alp");
  r.lnp = findParty(scope, "the coalition|coalition|l-np|lnp|liberal-national");
  r.onp = findParty(scope, "one nation");
  r.grn = findParty(scope, "the greens|greens");
  // Tracker Newspoll convention: the combined "others … includes minor
  // parties and independents" bucket lands in `ind`; a source listing the
  // two separately fills both columns. The combo sentence carries ONE
  // figure, so independents must not be re-read from it (double-count).
  for (const k of ["alp", "lnp", "onp", "grn"]) if (r[k] == null) missing.push(k);
  const comboScope = scope.filter((s) => /other/i.test(s) && /independent/i.test(s));
  const indSplit = comboScope.length ? null : findParty(scope, "independents");
  const othSplit = findParty(scope, "others|other parties");
  // Newspoll's published bucket is combined others+independents; the
  // tracker's convention lands it in `ind` (every canonical Newspoll row
  // sets ind, none sets oth). A lone "others X%" or "independents X%"
  // figure is that bucket; oth fills only when both are stated separately.
  if (comboScope.length) { r.ind = othSplit; r.oth = null; }
  else if (indSplit != null && othSplit != null) { r.ind = indSplit; r.oth = othSplit; }
  else { r.ind = indSplit ?? othSplit; r.oth = null; }
  // "A fell to 13% and 9% respectively" positions override regex grabs.
  const resp = respectivelyMap(scope);
  for (const k of ["alp", "lnp", "onp", "grn", "ind"]) if (resp[k] != null) r[k] = resp[k];
  if (r.ind == null && r.oth == null) missing.push("others bucket");

  // --- TPP: 2pp-anchored ALP figure, or an "X-Y"/"X to Y" pair near Labor.
  // Newspoll also publishes a Labor–One Nation preference matchup ("Albanese
  // led Hanson … after preferences"); that is a pairwise preference measure,
  // not the Coalition two-party figure the tpp columns model — excluded.
  r.tpp_alp = null; r.tpp_lnp = null;
  const tppScope = S.filter((s) => /two[- ]party|2pp|after preferences/i.test(s)
    && !/\bhanson\b|\bone nation\b/i.test(s));
  for (const s of tppScope) {
    let m = s.match(new RegExp(`labor[^%.]{0,40}?${PCT}`, "i"))
         ?? s.match(new RegExp(`${PCT}[^%.]{0,20}?to labor`, "i"));
    if (m) { r.tpp_alp = parseFloat(m[1]); break; }
    m = s.match(/labor[^%.]{0,30}?(?:leads?|ahead)?[^%.]{0,20}?(\d{2})\s*[-–]\s*(\d{2})/i);
    if (m) { r.tpp_alp = +m[1]; r.tpp_lnp = +m[2]; break; }
  }
  if (r.tpp_alp != null && r.tpp_lnp == null) r.tpp_lnp = Math.round((100 - r.tpp_alp) * 10) / 10;

  // --- fieldwork window (needed before leadership: the OL surname is era-keyed)
  r.date = null; r.dateStart = null;
  let fm = tNP.match(/(?:conducted|taken|surveyed|carried out|fieldwork)[^%.]{0,60}?\bfrom\s+([A-Za-z]+)\.?\s+(\d{1,2})\s*(?:to|[-–])\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2})/i)
        ?? tNP.match(/(?:poll|survey)[^%.]{0,40}?\bbetween\s+([A-Za-z]+)\.?\s+(\d{1,2})\s*(?:and|to|[-–])\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2})/i);
  if (fm) {
    const pubY = pubDateIso ? +pubDateIso.slice(0, 4) : new Date().getUTCFullYear();
    const mo1 = MONTHS[fm[1].toLowerCase()], mo2 = fm[3] ? MONTHS[fm[3].toLowerCase()] : mo1;
    if (mo1 != null && mo2 != null) {
      /* publication year is the END-date year (lag 0–10d); a Dec→Jan window
         starts in the prior December */
      r.dateStart = iso(mo2 < mo1 ? pubY - 1 : pubY, mo1, +fm[2]);
      r.date = iso(pubY, mo2, +fm[4]);
    }
  }
  if (r.date == null && pubDateIso) {
    // "conducted … between Monday and Thursday last week": for a Sunday/
    // Monday release the fieldwork week is the Mon–Sun week containing the
    // previous Monday (the 2025-09-11 oracle publishes "last week" for the
    // Mon–Thu of its own release week; derivation verified against it).
    const rel = tNP.match(/\b(?:between|from)\s+(mon|tues?|wed|thurs?|fri|sat(?:ur)?|sun)(?:day)?\s+(?:and|to|through)\s+(mon|tues?|wed|thurs?|fri|sat(?:ur)?|sun)(?:day)?\s+(?:last week|this week)?/i);
    if (rel) {
      const DOW = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, satur: 6 };
      const pub = new Date(pubDateIso + "T00:00:00Z");
      let back = (pub.getUTCDay() + 6) % 7;
      if (back === 0) back = 7;
      const monday = new Date(pub.getTime() - back * DAY);
      const s = new Date(monday.getTime() + (DOW[rel[1].toLowerCase()] - 1) * DAY);
      const e = new Date(monday.getTime() + (DOW[rel[2].toLowerCase()] - 1) * DAY);
      r.dateStart = dateIso(s);
      r.date = dateIso(e);
    }
  }
  if (r.date == null) missing.push("fieldwork window");

  const eraOl = olFor(r.date ?? pubDateIso ?? today()) ?? LEADERS.ols[LEADERS.ols.length - 1];
  r.oppSurname = eraOl.surname;

  // --- leadership: stated nets win; app/dis pairs fill net by arithmetic.
  // Newspoll has polled Hanson's net approval alongside the leaders since
  // mid-2026 — captured in hanNet when stated.
  r.pmNet = null; r.oppNet = null; r.pmApp = null; r.pmDis = null; r.oppApp = null; r.oppDis = null;
  r.hanNet = null;
  const leadScope = (re) => S.filter((s) => re.test(s));
  const netOf = (scopeL) => {
    for (const s of scopeL) {
      if (!/net/i.test(s)) continue;
      const m = s.match(/net\s+(?:approval|satisfaction)(?:\s+rating)?[^%\d-]{0,40}?(-?\d+(?:\.\d+)?)\b/i)
             ?? s.match(/\b(-?\d+(?:\.\d+)?)\s*(?:\s*points?)?\s+net\b/i);
      if (m) return parseFloat(m[1]);
    }
    return null;
  };
  const pairOf = (scopeL) => {
    let app = null, dis = null;
    for (const s of scopeL) {
      // (?<!dis): "dissatisfied" contains "satisfied"; a sentence quoting
      // both figures still yields each to its own branch.
      if (app == null && /(?<!dis)satisfied/i.test(s)) {
        const m = s.match(new RegExp(`${PCT}[^%.]{0,30}(?<!dis)satisfied`, "i"))
               ?? s.match(/(?<!dis)satisfied[^%]{0,30}?([\d.]+)\s*%/i);
        if (m) app = parseFloat(m[1]);
      }
      if (dis == null && /dissatisfied/i.test(s)) {
        const m = s.match(new RegExp(`${PCT}[^%.]{0,40}dissatisfied`, "i"))
               ?? s.match(/dissatisfied[^%]{0,30}?([\d.]+)\s*%/i);
        if (m) dis = parseFloat(m[1]);
      }
    }
    return { app, dis };
  };
  const pmS = leadScope(/\balbanese\b/i);
  const oppS = leadScope(new RegExp(`\\b${eraOl.surname}\\b`, "i"));
  r.pmNet = netOf(pmS);
  r.oppNet = netOf(oppS);
  r.hanNet = netOf(leadScope(/\bhanson\b/i));
  r.hanApp = null; r.hanDis = null;
  { const p = pairOf(pmS); r.pmApp = p.app; r.pmDis = p.dis; }
  { const p = pairOf(oppS); r.oppApp = p.app; r.oppDis = p.dis; }
  { const p = pairOf(leadScope(/\bhanson\b/i)); r.hanApp = p.app; r.hanDis = p.dis; }
  if (r.pmNet == null && r.pmApp != null && r.pmDis != null) r.pmNet = Math.round((r.pmApp - r.pmDis) * 10) / 10;
  if (r.oppNet == null && r.oppApp != null && r.oppDis != null) r.oppNet = Math.round((r.oppApp - r.oppDis) * 10) / 10;

  // --- preferred PM: named figures, or a bare "51 to 31" pair ordered by
  // name. Newspoll since mid-2026 asks BOTH a head-to-head (Albanese vs OL,
  // "margin of 44% to 35%") and a three-way ("Mr Albanese leads with 46% of
  // support, ahead of Senator Hanson on 31% and Mr Taylor on 23%"). Canonical
  // rows carry the three-way in ppmA/O/H and the head-to-head in extra.
  r.ppmA = null; r.ppmO = null; r.ppmH = null;
  r.ppm3A = null; r.ppm3H = null; r.ppm3O = null;
  const ppmS = S.filter((s) => /preferred (?:prime minister|pm)\b|better (?:prime minister|pm)\b/i.test(s));
  const HON_OR_NAME = "(?:(?:senator|mr|ms|mrs|dr)\\s+|[A-Z][a-z]+\\s+)";
  // A surname inside a comparison enumeration ("… well ahead of Pauline
  // Hanson and Angus Taylor on 46%" — 46 belongs to the subject) or heading
  // a "Name and P% for Other" list does not own the figure that follows;
  // forward candidates in those structures are rejected. Reverse matches
  // ("23% for Angus Taylor") admit an honorific or first name.
  const ppmFig = (s, sur) => {
    const fwd = new RegExp(`\\b${sur}\\b[^%.]{0,50}?${PCT}`, "gi");
    for (const m of s.matchAll(fwd)) {
      const pre = s.slice(Math.max(0, m.index - 100), m.index);
      const spear = pre.search(/(?:ahead of|behind|against|versus|vs\.?)\s/i);
      if (spear >= 0 && !/%/.test(pre.slice(spear))) continue;
      // m[0] ends at the matched %, so enumeration tails ("… and 23% for
      // Angus Taylor") can't be seen in it — test the text that FOLLOWS the
      // surname in the sentence instead.
      const tail = s.slice(m.index, m.index + 100);
      if (new RegExp(`^\\b${sur}\\b\\s+and\\s+(?:${HON_OR_NAME})?[A-Z][a-z]+\\s+on\\s`, "i").test(tail)) continue;
      if (new RegExp(`^\\b${sur}\\b\\s+and\\s+${PCT}\\s+(?:for|to|behind)\\s`, "i").test(tail)) continue;
      return parseFloat(m[1]);
    }
    const rev = s.match(new RegExp(`${PCT}[^%.]{0,30}?(?:for|to|behind)\\s+${HON_OR_NAME}?${sur}\\b`, "i"));
    return rev ? parseFloat(rev[1]) : null;
  };
  for (const s of ppmS) {
    r.ppmA ??= ppmFig(s, "albanese");
    r.ppmO ??= ppmFig(s, eraOl.surname);
    r.ppmH ??= ppmFig(s, "hanson");
    // "Albanese … remains ahead of X and Y on 46%": with the surname matches
    // enumeration-rejected, the trailing figure is the subject's own share.
    if (r.ppmA == null) {
      const lead = s.match(new RegExp(`\\balbanese\\b[^%.]{0,140}?\\b(?:ahead of|behind)\\b[^%.]{0,110}?\\bon\\s+${PCT}`, "i"));
      if (lead) r.ppmA = parseFloat(lead[1]);
    }
    if (r.ppmA == null || r.ppmO == null) {
      const pair = s.match(/(\d{1,2})\s*%\s*(?:to|[-–])\s*(\d{1,2})\s*%/);
      if (pair && pair.index != null) {
        const leaderRe = new RegExp(`\\b(albanese|${LEADERS.ols.map((o) => o.surname).join("|")})\\b`, "gi");
        const names = [...s.matchAll(leaderRe)].map((x) => ({ n: x[1].toLowerCase(), i: x.index }));
        const before = names.filter((x) => x.i < pair.index).pop();
        const after = names.find((x) => x.i > pair.index);
        if (before) (before.n === "albanese" ? r.ppmA ??= +pair[1] : r.ppmO ??= +pair[1]);
        if (after) (after.n === "albanese" ? r.ppmA ??= +pair[2] : r.ppmO ??= +pair[2]);
        // Head-to-head phrased with one leader unnamed ("Albanese leads the
        // Opposition Leader … by a margin of 44% to 35%"): the pair's other
        // figure is the partner's. Not applied in PM–Hanson pairwise
        // sentences, where the partner is Hanson, not the OL.
        if (!/\bhanson\b/i.test(s)) {
          if (before && !after) (before.n === "albanese" ? r.ppmO ??= +pair[2] : r.ppmA ??= +pair[2]);
          if (after && !before) (after.n === "albanese" ? r.ppmO ??= +pair[1] : r.ppmA ??= +pair[1]);
        }
      }
    }
    if (r.ppmA != null && r.ppmO != null && r.ppmH != null) break;
  }
  // Three-way from The Australian's own wording ("Mr Albanese leads with
  // 46% of support, ahead of Senator Hanson on 31% and Mr Taylor on 23%"):
  // the PM owns the figure AFTER "leads with", each rival gets the figure
  // after their name; undecided remainder is implied, not stated.
  {
    const tri = tNP.match(new RegExp(`\\balbanese\\b[^.]{0,90}?leads?\\s+with\\s+([\\d.]+)\\s*%[^.]{0,140}?hanson\\b[^%]{0,30}?([\\d.]+)\\s*%[^%]{0,40}?\\b${eraOl.surname}\\b[^%]{0,30}?([\\d.]+)\\s*%`, "i"));
    if (tri) { r.ppm3A ??= +tri[1]; r.ppm3H ??= +tri[2]; r.ppm3O ??= +tri[3]; }
  }

  // --- sample size ("survey of 1,283 voters"); 800–3000 or it isn't Newspoll's
  const sm = tNP.match(/([\d][\d,]{2,5})\s+(?:voters|respondents|electors|australians|people)\b/i);
  r.sample = sm ? parseInt(sm[1].replace(/,/g, ""), 10) : null;
  if (r.sample != null && (r.sample < 800 || r.sample > 3000)) r.sample = null;
  if (r.sample == null) missing.push("sample");
  return { r, missing };
}

// --------------------------------------------------------------- discovery
function articleBits(html) {
  const ld = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { for (const b of [JSON.parse(m[1])].flat()) ld.push(b); } catch { /* malformed ld+json */ }
  }
  const arts = ld.filter((b) => /NewsArticle|Article|Report/i.test(b?.["@type"] ?? ""));
  const pick = (k) => arts.map((a) => a[k]).find((v) => typeof v === "string" && v.trim()) ?? null;
  const metaC = (re) => html.match(re)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const ogd = metaC(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
           ?? metaC(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const title = metaC(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pubd = pick("datePublished") ?? metaC(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i);
  let pubIso = null;
  if (pubd) { const d = new Date(pubd); if (!isNaN(d)) pubIso = dateIso(d); }
  const head = [pick("headline"), pick("description"), ogd, title].filter(Boolean).join(" ");
  return { entryText: head + " " + clean(html), pubIso, headline: pick("headline") ?? title };
}

// Bing News RSS item links are click-through wrappers carrying the publisher
// URL percent-encoded in the `url` query parameter; anything else is kept as
// it stands. No network round-trip needed, and nothing to rotate like the
// discarded Google News approach.
function bingUrl(link) {
  if (!/\bbing\.com\/news\/apiclick/.test(link)) return link;
  const raw = link.replace(/&amp;/g, "&");
  try { return new URLSearchParams(new URL(raw).search).get("url") ?? link; }
  catch { return link; }
}

// The topic page is wall-covered for bots: plain fetch gets the 200
// "No Cookies" challenge, so the rendered read goes through Chrome when
// NEWSIE_CHROME is set — the same rescue rung article fetches use.
async function topicHtml() {
  try {
    const p = await fetchText(TOPIC);
    if (!/<title>\s*no cookies\b/i.test(p.text) && p.text.includes("/news-story/")) return p.text;
  } catch { /* News Corp wall; RSS usually suffices */ }
  if (!process.env.NEWSIE_CHROME) return null;
  try {
    return execFileSync("node", [".build/chrome-article.mjs", TOPIC],
      { encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  } catch { return null; }
}

async function discover() {
  const out = [];
  try {
    const rss = (await fetchText(BING)).text;
    for (const m of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const b = m[1];
      const title = b.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = b.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();
      const pub = b.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
      if (!title || !link || !/newspoll/i.test(title) || EXCLUDE.test(title)) continue;
      out.push({ title, link: bingUrl(link), pubIso: pub ? dateIso(new Date(pub)) : null });
    }
  } catch (e) { console.error("NP_NOTE bing discovery failed: " + e.message); }
  // Publisher-of-record discovery. The tile stream mixes commentary, state
  // polls and evergreens, so the gate is deliberate: federal RELEASE
  // headlines begin "Newspoll:". Titles and links are ALL that is taken —
  // 1c5c3ea (reverted f14a46f) transcribed a satisfaction split off the
  // tile standfirsts, which mix waves; figures are only ever read from a
  // fetched article itself.
  const tp = await topicHtml().catch(() => null);
  if (tp) {
    let n = 0;
    for (const m of tp.matchAll(/<h3[^>]*>\s*<a[^>]*href="(https:\/\/www\.theaustralian\.com\.au\/[^"]*\/news-story\/[a-f0-9]{16,})"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = clean(m[2]).replace(/&amp;/g, "&");
      if (!/^newspoll:/i.test(title) || EXCLUDE.test(title)) continue;
      out.push({ title, link: m[1], pubIso: null });
      n++;
    }
    if (n) console.error(`NP_NOTE topic page yielded ${n} "Newspoll:" release headline(s)`);
  }
  return out;
}

// ---------------------------------------------------------------- infogram
// Rank-0 corroborator (spec: .build/newspoll-infogram-rung.md; orchestration
// in ./infogram.mjs). Embeds are NOT pinned to their article, so their
// figures date only from the charts' own labels and can only ever JOIN a
// coverage-formed cluster (never found one): a chart-only release would fail
// the existing missing-sample guard by design. Unavailability degrades to a
// note — the prose pipeline must survive an Infogram outage; structural
// drift is a guard and fails loudly (exit 2), per the spec's durability rule.

// ------------------------------------------------------------- merge/guard
const FIELDS = ["alp", "lnp", "grn", "onp", "ind", "oth", "tpp_alp", "tpp_lnp",
  "pmNet", "oppNet", "pmApp", "pmDis", "oppApp", "oppDis", "ppmA", "ppmO", "ppmH",
  "hanNet", "hanApp", "hanDis", "ppm3A", "ppm3H", "ppm3O", "sample"];
function mergeCluster(recs) {
  const m = { conflicts: [] };
  for (const k of ["date", "dateStart"]) {
    const vals = recs.map((r) => ({ c: r.src.client, v: r.r[k] })).filter((x) => x.v);
    m[k] = vals[0]?.v ?? null;
    for (const x of vals.slice(1)) if (x.v !== m[k]) m.conflicts.push(`${k}: ${m[k]} (${vals[0].c}) vs ${x.v} (${x.c})`);
  }
  for (const f of FIELDS) {
    const vals = recs.filter((r) => r.r[f] != null).sort((a, b) => a.src.rank - b.src.rank);
    m[f] = vals[0]?.r[f] ?? null;
    for (const x of vals.slice(1)) if (Math.abs(x.r[f] - m[f]) > 0.5) m.conflicts.push(`${f}: ${m[f]} (${vals[0].src.client}) vs ${x.r[f]} (${x.src.client})`);
  }
  return m;
}

function guardCluster(m, clusterPub) {
  const errs = [];
  const check = (n, ok) => { if (!ok) errs.push(n); };
  for (const k of ["date", "dateStart", "sample", "alp", "lnp", "grn", "onp"]) if (m[k] == null) errs.push(`missing ${k}`);
  if (m.ind == null && m.oth == null) errs.push("missing others/independents bucket");
  for (const [k, v] of [["alp", m.alp], ["lnp", m.lnp], ["grn", m.grn], ["onp", m.onp], ["ind", m.ind], ["oth", m.oth]])
    if (v != null) check(`${k}=${v} in 1–60`, v >= 1 && v <= 60);
  const parts = [m.alp, m.lnp, m.grn, m.onp, m.ind, m.oth].filter((v) => v != null);
  if (parts.length >= 5) {
    const sum = parts.reduce((a, b) => a + b, 0);
    check(`primaries Σ=${sum.toFixed(1)} ~100`, Math.abs(sum - 100) <= 1.5);
  }
  if (m.tpp_alp != null && m.tpp_lnp != null)
    check(`2pp Σ=${(m.tpp_alp + m.tpp_lnp).toFixed(1)} ~100`, Math.abs(m.tpp_alp + m.tpp_lnp - 100) <= 1);
  if (m.ppmA != null) check(`ppmA=${m.ppmA} in 15–80`, m.ppmA >= 15 && m.ppmA <= 80);
  if (m.ppmO != null) check(`ppmO=${m.ppmO} in 5–70`, m.ppmO >= 5 && m.ppmO <= 70);
  if (m.ppmH != null) check(`ppmH=${m.ppmH} in 5–70`, m.ppmH >= 5 && m.ppmH <= 70);
  if (m.ppm3A != null) check(`ppm3A=${m.ppm3A} in 15–80`, m.ppm3A >= 15 && m.ppm3A <= 80);
  if (m.ppm3O != null) check(`ppm3O=${m.ppm3O} in 5–70`, m.ppm3O >= 5 && m.ppm3O <= 70);
  if (m.ppm3H != null) check(`ppm3H=${m.ppm3H} in 5–70`, m.ppm3H >= 5 && m.ppm3H <= 70);
  // An equal pair means the subject's figure got misattributed to a trailing
  // candidate — the failure mode the enumeration rejection targets.
  if (m.ppmA != null && m.ppmA === m.ppmO) errs.push(`ppm tie ${m.ppmA}/${m.ppmO} — parse suspect`);
  // Sum the consistent set: three-way shares when captured, else the classic
  // pair (ppmA/ppmO are the head-to-head in the three-way era and would
  // double-count the three-way ppmH).
  const ppmTri = m.ppm3A != null;
  const ppmParts = (ppmTri ? [m.ppm3A, m.ppm3O, m.ppm3H] : [m.ppmA, m.ppmO, m.ppmH]).filter((v) => v != null);
  const ppmBaseFull = ppmTri ? m.ppm3O != null : m.ppmA != null && m.ppmO != null;
  if (ppmBaseFull) {
    const ppmSum = Math.round(ppmParts.reduce((a, b) => a + b, 0) * 10) / 10;
    check(`ppm Σ=${ppmSum} ≤ 100.5`, ppmSum <= 100.5);
  }
  for (const [k, v] of [["pmNet", m.pmNet], ["oppNet", m.oppNet], ["hanNet", m.hanNet]])
    if (v != null) check(`${k}=${v} in −80..80`, v >= -80 && v <= 80);
  if (m.date) {
    check(`date ${m.date} not future`, m.date <= today());
    if (m.dateStart) {
      const span = (new Date(m.date) - new Date(m.dateStart)) / DAY;
      check(`field span ${span}d in 1–7`, span >= 1 && span <= 7);
    }
    if (clusterPub) {
      const lag = (new Date(clusterPub) - new Date(m.date)) / DAY;
      check(`release lag ${lag}d in 0–10`, lag >= 0 && lag <= 10);
    }
    if ([m.pmNet, m.oppNet, m.ppmA, m.ppmO].some((v) => v != null) && m.date < LEADERS.pm.from)
      errs.push("leadership figures for a pre-Albanese-era date");
  }
  if (m.sample != null) check(`sample=${m.sample} in 800–3000`, m.sample >= 800 && m.sample <= 3000);
  for (const c of m.conflicts) errs.push("conflict: " + c);
  return errs;
}

// --------------------------------------------------------------- entry
const status = { changed: false, check: CHECK, added: [], skipped_existing: [], candidates: [], undated: [] };
const FILE_OF = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--file"));
const PUBDATE = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--pubdate"));

if (URL_OF || FILE_OF) { // dev oracle: parse one article, print the record, exit
  const html = FILE_OF ? readFileSync(FILE_OF, "utf8") : (await fetchArticle(URL_OF)).text;
  const bits = articleBits(html);
  const { r, missing } = parseArticle(bits.entryText, PUBDATE ?? bits.pubIso);
  console.log(JSON.stringify({ headline: bits.headline, pubIso: PUBDATE ?? bits.pubIso, figures: r, missing }, null, 2));
  process.exit(0);
}

try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const npDates = new Set(D.polls.filter((p) => p.pollster === "Newspoll").map((p) => p.date));
  // A story published before the latest known release's fieldwork-end date
  // cannot describe a newer release; skipping it keeps stale evergreen items
  // (Bing relevance-surfaces months-old wire pieces) out of the guard path.
  const latestNp = [...npDates].sort().pop();

  const items = await discover();
  const seen = new Set();
  const recs = [];
  // The Australian's links still matter when the fetch is walled: kept for
  // the row's provenance URL once a cluster date is known.
  const failedAus = [];
  for (const it of items) {
    const url = it.link;
    if (seen.has(url)) continue;
    if (latestNp && it.pubIso && it.pubIso < latestNp) continue;
    seen.add(url);
    const src = sourceFor(url);
    if (!src) continue;
    let art;
    try { art = await fetchArticle(url); }
    catch (e) {
      if (src.client === "The Australian" && it.pubIso) failedAus.push({ url, pubIso: it.pubIso });
      console.error(`NP_NOTE fetch failed ${url}: ${e.message}`); continue;
    }
    const bits = articleBits(art.text);
    const pubIso = bits.pubIso ?? it.pubIso;
    if (EXCLUDE.test(bits.headline ?? "")) continue;
    const { r, missing } = parseArticle(bits.entryText, pubIso);
    status.candidates.push((bits.headline ?? it.title).slice(0, 90));
    // Infogram embed ids ride in rendered/article DOMs (rung B input).
    const igIds = [...art.text.matchAll(/infogram-embed[^>]*?data-id="([0-9a-f-]{36})"/gi)].map((m) => m[1].toLowerCase());
    recs.push({ src, url: art.canon ?? url, client: art.provider ?? src.client, title: bits.headline ?? it.title, pubIso, r, missing, igIds });
  }

  const clusters = new Map();
  const undated = [];
  for (const rec of recs) {
    if (!rec.r.date) { undated.push(rec); continue; }
    if (!clusters.has(rec.r.date)) clusters.set(rec.r.date, []);
    clusters.get(rec.r.date).push(rec);
  }
  // Coverage pieces that state figures but no fieldwork window: Newspoll
  // coverage publishes within days of fieldwork end (guardCluster enforces a
  // 0–10d release lag), so an undated article attaches to the cluster whose
  // date sits in that window — only when exactly one cluster qualifies;
  // ambiguity (or none) leaves it out. Conflicting figures it carries are
  // still caught downstream by the merge disagreement guard.
  for (const rec of undated) {
    const p = rec.pubIso;
    const hits = p ? [...clusters.keys()].filter((d) => p >= d && (new Date(p) - new Date(d)) / DAY <= 10) : [];
    if (hits.length === 1) { clusters.get(hits[0]).push(rec); continue; }
    status.undated.push((rec.title ?? "").slice(0, 90));
  }

  const guardFails = [];
  const newPpmH = [];
  const embed = { live: null, static: null, recon: null };

  // ---- infogram rung A (live project) — corroborate or fill, never found
  const A = await infogramLive(fetchText, latestNp);
  embed.live = A.state;
  if (A.state === "guard") guardFails.push("infogram: " + A.why);
  else if (A.state !== "ok") console.error(`NP_NOTE infogram live rung ${A.state}${A.why ? " — " + A.why : ""}`);
  if (A.state === "ok") {
    let d = attachTarget([...clusters.keys()], A.pubIso, IG_DAY_WINDOW, A.figs.alp,
      (dd) => mergeCluster(clusters.get(dd).filter((c) => !c.embed)), DAY);
    if (!d) { console.error(`NP_NOTE infogram live (label ${A.pubIso}) found no agreeing cluster to join`); embed.live = "unattached"; }
    else {
      const era = olFor(d) ?? LEADERS.ols[LEADERS.ols.length - 1];
      const figs = { ...A.figs, oppNet: A.figs.oppNetByEra[era.surname] ?? null };
      delete figs.oppNetByEra;
      // A chart naming a different OL than the era table expects is a note
      // (era boundary just moved), not grounds to poison the release.
      if (A.betterpmOppName && !A.betterpmOppName.toLowerCase().includes(era.surname)) {
        console.error(`NP_NOTE infogram better-PM names "${A.betterpmOppName}" vs era OL ${era.oppName} — dropping live ppm pair, keeping the rest`);
        figs.ppmA = null; figs.ppmO = null; figs.oppNet = null;
      }
      if (A.tppResumed) console.error("NP_NOTE infogram tpp feed has a numeric 2PP again — Newspoll resumed publishing it");
      clusters.get(d).push({ src: { client: "The Australian", rank: -1 }, embed: "live",
        url: IG_SLUG, title: "Infogram live project", pubIso: A.pubIso,
        r: { date: d, dateStart: null, ...figs }, missing: [] });
      embed.live = `attached@${d}`;
      if (A.ppmUnc != null) console.error(`NP_NOTE infogram better-PM uncommitted ${A.ppmUnc}% (not modelled — corroboration only)`);
    }
  }

  // ---- infogram rung B (per-wave static embeds)
  const igIds = [...new Set(recs.flatMap((c) => c.igIds ?? []))].slice(0, 6);
  const statics = igIds.length ? await infogramStatic(fetchText, igIds) : [];
  const staticOk = statics.filter((s) => s.state === "ok");
  for (const s of statics.filter((x) => x.state === "note"))
    console.error(`NP_NOTE infogram embed ${s.id.slice(0, 8)}: ${s.why}`);
  for (const s of staticOk) {
    const label = s.parsed.hanson?.fieldworkLabel;
    if (!label) { console.error(`NP_NOTE infogram embed ${s.id.slice(0, 8)}: no Hanson window label — skipping`); continue; }
    // Date the figures from the chart's own window label; the year comes
    // from whichever candidate actually lands on a cluster (never the clock).
    let hit = null;
    for (const y of [new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1]) {
      const w = igWindow(label, `${y}-12-31`);
      if (!w) break;
      const cands = [...clusters.keys()]
        .filter((d) => Math.abs((new Date(d) - new Date(w.end)) / DAY) <= IG_STA_WINDOW)
        .sort((a, b) => Math.abs(new Date(a) - new Date(w.end)) - Math.abs(new Date(b) - new Date(w.end)));
      if (cands.length) { hit = { d: cands[0], w }; break; }
    }
    if (!hit) { console.error(`NP_NOTE infogram embed ${s.id.slice(0, 8)}: window "${label}" matches no cluster — skipping`); s.derived = { label, attached: false }; continue; }
    const { d, w } = hit;
    const era = olFor(d) ?? LEADERS.ols[LEADERS.ols.length - 1];
    const rk = s.parsed.ranked ?? {};
    if (rk.oppName && !rk.oppName.toLowerCase().includes(era.surname)) {
      guardFails.push(`infogram static: ranked-PM OL "${rk.oppName}" vs era ${era.oppName} at ${d} — parse or era table drift`);
      continue;
    }
    const { hanApp, hanDis } = s.parsed.hanson ?? {};
    clusters.get(d).push({ src: { client: "The Australian", rank: -1 }, embed: "static",
      url: IG_EMBED(s.id), title: "Infogram static embed", pubIso: null,
      r: { date: d, dateStart: w.start, hanApp, hanDis,
        hanNet: hanApp != null && hanDis != null ? Math.round((hanApp - hanDis) * 10) / 10 : null,
        ppm3A: rk.ppm3A ?? null, ppm3H: rk.ppm3H ?? null, ppm3O: rk.ppm3O ?? null },
      missing: [] });
    s.derived = { label, attached: d };
    // The distributed pair is the ALB–ONP preference matchup — the
    // ppmHeadToHead section modelled across sections. Insert once.
    const dist = s.parsed.distributed;
    if (dist?.isAlbHan && dist.alb != null && dist.han != null && d >= LEADERS.pm.from
      && !D.ppmHeadToHead?.some((r) => r.date === d && r.firm === "Newspoll")
      && !newPpmH.some((r) => r.date === d))
      newPpmH.push({ date: d, firm: "Newspoll", alb: dist.alb, han: dist.han });
  }
  embed.static = staticOk.length
    ? staticOk.map((s) => `${s.id.slice(0, 8)}→${s.derived?.attached ?? "unattached"}`).join(",")
    : igIds.length ? `0 of ${igIds.length} usable` : "no ids (no article DOM)";

  // Netsat archive reconciliation — READ-ONLY. Pairs by publication label
  // within +0..5d, requires the ALB net to agree, then compares the era OL.
  // Divergences are notes for adjudication, never auto-writes.
  if (A.state === "ok") {
    const divergent = [], gaps = [];
    let paired = 0, exact = 0;
    for (const p of A.netsat) {
      if (!p.iso || p.pm == null) continue;
      const rows = (D.approval ?? []).filter((r) => r.firm === "Newspoll"
        && (new Date(p.iso) - new Date(r.date)) / DAY >= 0 && (new Date(p.iso) - new Date(r.date)) / DAY <= IG_DAY_WINDOW);
      const tr = rows.sort((a, b) => a.date < b.date ? 1 : -1)[0];
      if (!tr || tr.alb == null || Math.abs(tr.alb - p.pm) > 0.5) continue;
      paired++;
      const eraK = (tr.oppName ?? "").toLowerCase();
      const feedOpp = p[eraK] ?? null;
      if (tr.opp == null && feedOpp != null) { gaps.push(`${tr.date}: tracker opp null, infogram ${tr.oppName} ${feedOpp}`); continue; }
      if (tr.opp == null || feedOpp == null) { exact++; continue; }
      if (Math.abs(tr.opp - feedOpp) <= 0.5) exact++;
      else divergent.push(`${tr.date}: tracker ${tr.oppName} ${tr.opp} vs infogram ${feedOpp}`);
    }
    embed.recon = { paired, exact, divergent, gaps };
    for (const x of divergent) console.error("NP_NOTE netsat recon divergent — " + x);
    for (const x of gaps) console.error("NP_NOTE netsat recon gap — " + x);
  }

  const newPolls = [], newPpm = [], newAppr = [], sources = [];
  for (const [date, cl] of [...clusters.entries()].sort()) {
    if (npDates.has(date)) { status.skipped_existing.push(date); continue; }
    cl.sort((a, b) => a.src.rank - b.src.rank);
    const m = mergeCluster(cl);
    const pubIso = cl.map((c) => c.pubIso).filter(Boolean).sort()[0] ?? null;
    const errs = guardCluster(m, pubIso);
    if (errs.length) { guardFails.push(`${date}: ${errs.join(" | ")}`); continue; }
    // Provenance comes from real articles, never an embed record — rank −1
    // sorts them first, so the row's client/url pick must skip them.
    const best = cl.find((c) => !c.embed) ?? cl[0];
    const era = olFor(date);
    // Provenance URL: prefer the publisher of record's own link when one
    // theaustralian.com story falls uniquely inside this release's window
    // (its fetch is usually cookie-walled, but the link still identifies
    // the story); otherwise the outlet the figures were actually read from.
    const ausHits = failedAus.filter((f) => f.pubIso >= date && (new Date(f.pubIso) - new Date(date)) / DAY <= 10);
    const ausUrl = new Set(ausHits.map((f) => f.url)).size === 1 ? ausHits[0].url : null;
    // `client` travels with that URL. The figures are read from whichever free
    // outlet carried them, and `best.client` is that outlet's name - often a
    // syndication brand like "NewsWire" rather than a masthead. When the
    // publisher of record has been identified well enough to cite, the row
    // should say so in both fields: a row citing theaustralian.com while
    // naming its client "NewsWire" reads as a different poll from the one a
    // hand-entered row records, and the curated Newspoll rows say
    // "The Australian" whenever the URL does.
    const client = ausUrl ? "The Australian" : best.client;
    // `published` = the night the release landed. Newspoll files Sunday evening
    // about 20:00 AEST and the curated rows pin that hour rather than pretend
    // to a precision the coverage does not carry; the DATE is the publisher of
    // record's own when we identified it, else the earliest outlet to run the
    // figures, which is the same evening. Left null when nothing in the cluster
    // is dated - an invented timestamp is worse than an absent one.
    const pubDates = [...(ausHits.map((f) => f.pubIso)), ...cl.map((c) => c.pubIso)].filter(Boolean).sort();
    const published = pubDates.length ? `${ausHits[0]?.pubIso ?? pubDates[0]}T20:00` : null;
    newPolls.push({
      date, published, dateStart: m.dateStart, pollster: "Newspoll", client, sample: m.sample,
      alp: m.alp, lnp: m.lnp, grn: m.grn, onp: m.onp, ind: m.ind, oth: m.oth,
      tpp_alp: m.tpp_alp ?? null, tpp_lnp: m.tpp_lnp ?? null, url: ausUrl ?? best.url,
    });
    // Canonical Newspoll ppm row: the three-way shares are the headline
    // fields; the PM–OL head-to-head pairs off in `extra`.
    const ppmTri = m.ppm3A != null && m.ppm3O != null;
    if ((ppmTri || (m.ppmA != null && m.ppmO != null)) && date >= LEADERS.pm.from)
      newPpm.push({ date, firm: "Newspoll", alb: ppmTri ? m.ppm3A : m.ppmA, opp: ppmTri ? m.ppm3O : m.ppmO,
        oppName: era?.oppName ?? null, han: ppmTri ? m.ppm3H : m.ppmH ?? null,
        extra: ppmTri && m.ppmA != null && m.ppmO != null ? [{ alb: m.ppmA, opp: m.ppmO }] : null });
    if ((m.pmNet != null || m.oppNet != null) && date >= LEADERS.pm.from) {
      const detail = {};
      if (m.pmApp != null && m.pmDis != null) detail.alb = { app: m.pmApp, dis: m.pmDis };
      if (m.oppApp != null && m.oppDis != null) detail.opp = { app: m.oppApp, dis: m.oppDis };
      if (m.hanApp != null && m.hanDis != null) detail.han = { app: m.hanApp, dis: m.hanDis };
      newAppr.push({ date, firm: "Newspoll", alb: m.pmNet, opp: m.oppNet, oppName: era?.oppName ?? null, han: m.hanNet ?? null, detail: Object.keys(detail).length ? detail : null });
    }
    sources.push({
      date, json: JSON.stringify({
        cluster: cl.map(({ src, url, title, pubIso: p, r, missing }) => ({ client: src.client, url, title, pubIso: p, figures: r, missing })),
        merged: m,
      }, null, 2) + "\n",
    });
    status.added.push({ date, client, primaries: `${m.alp}/${m.lnp}/${m.grn}/${m.onp}/${m.ind ?? m.oth}`, tpp: m.tpp_alp == null ? null : `${m.tpp_alp}/${m.tpp_lnp}`, pmNet: m.pmNet, oppNet: m.oppNet, hanNet: m.hanNet ?? null, ppm: m.ppmA == null ? null : `${m.ppmA}/${m.ppmO}${m.ppmH != null ? `/${m.ppmH}` : ""}` });
  }
  if (guardFails.length) {
    console.error("NP_GUARD " + guardFails.join(" || "));
    status.guard = guardFails;
    console.log("NP_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (newPolls.length || newPpmH.length) {
    if (newPolls.length)
      D.polls = [...D.polls, ...newPolls].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const [key, rows] of [["ppm", newPpm], ["approval", newAppr], ["ppmHeadToHead", newPpmH]])
      if (rows.length) D[key] = [...(D[key] ?? []), ...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      if (newPolls.length) {
        mkdirSync(SRC_DIR, { recursive: true });
        for (const s of sources) writeFileSync(`${SRC_DIR}/release-${s.date}.json`, s.json);
        console.log(`wrote ${OUT}: +${newPolls.length} Newspoll release(s): ${status.added.map((a) => a.date).join(", ")}`);
      }
      if (newPpmH.length) console.log(`wrote ${OUT}: +${newPpmH.length} Newspoll ppmHeadToHead row(s): ${newPpmH.map((r) => r.date).join(", ")}`);
    }
    if (newPpmH.length) status.ppmHeadToHead = newPpmH.map((r) => `${r.date} ${r.alb}/${r.han}`);
  }
  status.embed = embed;
  console.log("NP_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("NP_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("NP_STATUS " + JSON.stringify(status));
  process.exit(1);
}
