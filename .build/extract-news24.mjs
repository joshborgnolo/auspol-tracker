// Extract the latest YouGov "Public Data" fortnightly federal poll (the
// series News24 Pulse reports) and append rows to data/polls.json: voting
// intention into `polls`, preferred-PM into `ppm`, leader nets into
// `approval`.
//
// Canonical source = YouGov's own editorial releases on yougov.com (the
// series News24 Pulse reports). Discovery is the global YouGov RSS feed
// (yougov.com/en/rss — regional feeds 404; the global feed's ~200 items
// include every AU federal poll article). Candidate titles are pre-screened,
// then each article is verified against the series' distinctive methodology
// sentence ("The YouGov Public Data poll surveyed N Australian voters online
// between …"), which excludes UK polls ("British voters") and state polls
// without needing title keywords.
//
// Figure sources, in order of robustness:
//   primaries/TPP – the article's embedded Datawrapper charts: public
//                   machine-readable TSV at datawrapper.dwcdn.net/{id}/{rev}/
//                   dataset.csv. The VI chart carries "Headline voting
//                   intention" rows and BOTH "Two-party preferred vote vs
//                   Coalition" (kept) and "vs PHON" (ignored) rows. Tracker
//                   convention for this series: `ind` = the "Independents"
//                   row; `oth` = sum of all other headline rows (Community
//                   Strong Australia, Other) — verified against the hand
//                   -curated 2026-07-14 canon row (Ind 6 → ind 6; CSA 2 +
//                   Other 6 → oth 8).
//   satisfaction  – the leader-satisfaction Datawrapper chart (first data
//                   row is the latest wave; cells may carry <span> arrows)
//   ppm           – a "Column/Total" Datawrapper chart when the article has
//                   one (the March 2026 article did); otherwise the prose
//                   pair ("leading 44% to 35%"), which the July article
//                   needed. Prose values equal chart values where both exist.
//   dates/sample  – the Methodology paragraph ("surveyed 1,468 Australian
//                   voters online between 7 and 14 July 2026"); `published`
//                   from the article JSON embedded in the page's transfer
//                   state ("data":{"id":<num>,…"published_at":"isoZ"}),
//                   converted to AEST.
//
// News24 fallback waves additionally run the Infogram rung
// (.build/newspoll-infogram-rung.md): each article's six anonymous `_/`
// embeds (crosstab + dedicated tables) are authoritative for the figures
// they carry; prose keeps sample/published, Wikipedia fills what all
// charts+prose lack, and every cross-source disagreement >0.5pp is logged to
// problems, never silently swapped. The horserace time-series chart is
// corroboration-only (proven Σ=94/102 columns, Σ-guarded). The article DOM
// itself needs Chrome (Akamai cookie wall serves anonymous fetches a 404);
// fetchNews24Article tries anonymous first so Chrome drops out the day the
// wall drops. status.news24 gains `sources` (which leg served each DOM) and
// `infogram` (per-wave ids/kinds/problems); provenance files carry the
// parsed Infogram record so rows re-derive without re-fetching.
//
// Row shapes mirror the existing canon YouGov rows: polls
// {date,published,dateStart,pollster:"YouGov",client:"News24",sample,alp,
// lnp,grn,onp,ind,oth,tpp_alp,tpp_lnp,url}; ppm {date,firm,alb,opp,oppName,
// han:null,extra:null}; approval {date,firm,alb,opp,oppName,han:null,
// detail{alb:{app,dis},opp:{app,dis}}}.
//
// Fallback source: NEWSIE_CHROME=1 reads news24.com.au through the user's
// logged-in Chrome (.build/chrome-article.mjs) for waves YouGov never
// self-releases. The Wikipedia poll table supplies the News24 candidate URLs
// plus independents/others, which News24 prose omits. News24 supplies prose
// leadership metrics, published time and Coalition/One Nation preference
// pairs; either failure degrades to the older Wikipedia-only path, not exit 1.
// Chrome is manual-only because macOS Automation consent is a GUI prompt.
// Fallback rows can now also populate `altTpp` and `ppmHeadToHead` when the
// News24 article names them. At most 4 fallback waves per run; more trips the
// safety guard.
//
// Provenance: parsed figures per wave are saved to .build/news24-src/
// release-<dateIso>.json (yougov.com), news24-<dateIso>.json (news24.com.au
// + Wikipedia gap-fill) or wiki-<dateIso>.json (Wikipedia only) and committed
// alongside.
//
// Usage: node .build/extract-news24.mjs [--check] [--url <yougov-url>]
//   --url parses one YouGov article and prints the record without touching
//   polls.json – development/regression hook (oracle: article 55192,
//   fieldwork end 2026-07-14, expects sample 1468, 28/20/12/26/6/8, TPP
//   53/47, nets -18/-16, ppm 44/35). --news24 parses one News24 URL through
//   Chrome with NEWSIE_CHROME=1 (or N24_NEWS24_FILE for a saved page).
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `N24_STATUS {json}` with changed, added, skipped_existing — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped —
//     upstream layout changed; nothing is written
//   - --check computes everything, prints N24_STATUS, never writes
//   - writes are atomic (.tmp + rename)
//   - test hooks: N24_OUT redirects the write target; N24_SRC_DIR redirects
//     provenance; N24_WIKI_FILE parses local wikitext; N24_WIKI_DEBUG prints
//     parsed fallback waves; N24_NEWS24_FILE parses a saved News24 page;
//     N24_IG_DIR reads Infogram embeds from ig-<id>.html fixture captures
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { IG_EMBED } from "./infogram.mjs";
import { n24IdsOf, n24InfogramFetch, n24Figures, n24Corroborate } from "./news24-infogram.mjs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const URL_OF = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--url"));
const NEWS24_OF = (i => i >= 0 ? argv[i + 1] : null)(argv.indexOf("--news24"));
const OUT = process.env.N24_OUT || "data/polls.json"; // N24_OUT: test hook only
const SRC_DIR = process.env.N24_SRC_DIR || ".build/news24-src";
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_TRIES = 3;
const RSS = "https://yougov.com/en/rss";
const DAY = 86400000;

// Newspoll releases and this series publish ~05:00 AEST; canon `published`
// strings are local-without-offset, so AEST (UTC+10 fixed) is applied here.
const AEST_MS = 10 * 3600_000;

// Fallback wave source: the Wikipedia poll table's wikitext. Used only for
// waves with no yougov.com release — historically the norm (an Aug 2026
// audit found releases for 2 of 18 waves since Dec 2025). Env overrides are
// test hooks: N24_WIKI_FILE parses a local snapshot, N24_WIKI_DEBUG prints
// parsed waves to stderr.
const WIKI_TITLE = "Opinion_polling_for_the_next_Australian_federal_election";
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=${WIKI_TITLE}&action=raw`;
const WIKI_FILE = process.env.N24_WIKI_FILE ?? null;
const WIKI_DEBUG = !!process.env.N24_WIKI_DEBUG;
const MAX_WIKI_ADDS = 4; // fortnightly series: >4 new fallback waves in one run = upstream layout shift
const NEWS24_FILE = process.env.N24_NEWS24_FILE ?? null;

// Candidate-title pre-screen (cheap; the methodology sentence is the gate).
const TITLE_HIT = /yougov public data poll|primary vote|albanese|coalition|one nation|\blabor\b/i;
const TITLE_MISS = /south australia|queensland|victoria\b|new south wales|western australia|tasmania|by-election|state election|britain|british|trump|canada|new zealand/i;

// Leadership era — identical to extract-newspoll.mjs; YouGov ppm/approval
// rows only exist in the Albanese era; the current OL surname keys the ppm
// and satisfaction chart columns.
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
      if (err.status === 403 || err.status === 429) break;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

function fetchNews24Chrome(url) {
  if (NEWS24_FILE) return readFileSync(NEWS24_FILE, "utf8");
  if (!process.env.NEWSIE_CHROME) return null;
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (!/(^|\.)news24\.com\.au$/.test(host)) return null;
  try {
    return execFileSync("node", [".build/chrome-article.mjs", url],
      { encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  } catch {
    return null;
  }
}

// ----------------------------------------------------- News24 Infogram rung
// (spec: .build/newspoll-infogram-rung.md) Each News24 Pulse article embeds
// six static Infogram projects (`_/` ids, fresh per wave); the embeds fetch
// anonymously. The ARTICLE DOM is not anonymous today: Akamai's cookie wall
// serves a 404 "Nocookies" page to plain fetch. The chain below tries
// anonymous first so the day the wall drops, Chrome drops out too.
const IG_DIR = process.env.N24_IG_DIR ?? null; // test hook: dir of ig-<id>.html captures
async function fetchIgEmbed(id) {
  if (IG_DIR) return readFileSync(`${IG_DIR}/ig-${id.replace("_/", "")}.html`, "utf8");
  return (await fetchText(IG_EMBED(id))).text;
}

async function fetchNews24Article(url) {
  if (NEWS24_FILE) return { html: readFileSync(NEWS24_FILE, "utf8"), via: "file" };
  try {
    const { text } = await fetchText(url);
    if (/News24 Pulse/i.test(text) || n24IdsOf(text).length) return { html: text, via: "anon" };
  } catch { /* Akamai cookie wall; Chrome is the fallback */ }
  const html = fetchNews24Chrome(url);
  return html ? { html, via: "chrome" } : { html: null, via: null };
}

// Figure precedence inside a News24 wave: Infogram crosstab + dedicated
// tables are authoritative for what they carry; prose then Wikipedia fill
// only what charts lack (sample, published, candidate discovery). Returns
// problems (BLOCKING — figure/window/era disagreements >0.5pp that must not
// be written silently) separately from notes (corroboration-only signals:
// the hand-maintained horserace's Σ-guarded exclusions and value drift,
// which carry proven errors and can never block a wave). Mutates `wave`
// (vi/dateStart) and `prose` (the parsed News24 rec: sat/ppm/alt/
// ppmHeadToHead, which derived rows read).
async function infogramEnrichNews24(html, wave, prose) {
  const problems = [], notes = [];
  const ids = n24IdsOf(html);
  if (!ids.length) return { ig: null, problems, notes };
  const projects = await n24InfogramFetch(fetchIgEmbed, ids);
  const fig = n24Figures(projects);
  for (const p of fig.problems) (/^horserace .* sums to/.test(p) ? notes : problems).push(p);
  // Snapshot pre-overlay values so every crosscheck names its source.
  const pv = prose?.vi ?? {};
  const wasV = (k) => pv[k] != null ? ["News24 prose", pv[k]]
    : wave !== prose && wave.vi?.[k] != null ? ["Wikipedia", wave.vi[k]] : null;
  const wasP = (v) => (v != null ? ["News24 prose", v] : null);
  const shift = (label, igV, was) => {
    if (igV != null && was && Math.abs(igV - was[1]) > 0.5)
      problems.push(`Infogram ${label} ${igV} != ${was[0]} ${was[1]}`);
  };

  if (fig.vi) for (const k of ["alp", "lnp", "grn", "onp", "ind", "oth"]) {
    if (fig.vi[k] == null) continue;
    shift(k, fig.vi[k], wasV(k));
    wave.vi[k] = fig.vi[k];
  }
  if (fig.tpp) {
    shift("tpp_alp", fig.tpp.tpp_alp, wasP(pv.tpp_alp));
    wave.vi.tpp_alp = fig.tpp.tpp_alp;
    wave.vi.tpp_lnp = fig.tpp.tpp_lnp;
  }
  if (fig.altTpp) {
    shift("alt TPP ALP", fig.altTpp.alpVsOnp_alp, wasP(prose?.altAlp));
    if (prose) { prose.altAlp = fig.altTpp.alpVsOnp_alp; prose.altOnp = fig.altTpp.alpVsOnp_onp; }
  }
  const net = (p) => (p?.app != null && p?.dis != null ? Math.round((p.app - p.dis) * 10) / 10 : null);
  if (fig.approval?.alb) {
    shift("PM net", net(fig.approval.alb), wasP(prose?.sat?.pmNet));
    shift("OL net", net(fig.approval.opp), wasP(prose?.sat?.oppNet));
    if (prose) prose.sat = {
      pmApp: fig.approval.alb.app, pmDis: fig.approval.alb.dis, pmNet: net(fig.approval.alb),
      oppApp: fig.approval.opp?.app ?? null, oppDis: fig.approval.opp?.dis ?? null, oppNet: net(fig.approval.opp),
    };
    // Era drift detector: charts name the OL; LEADERS is a hand-kept table.
    const eraNow = olFor(wave.date ?? today());
    if (fig.approval.oppName && eraNow && fig.approval.oppName !== eraNow.surname)
      problems.push(`Infogram charts name OL "${fig.approval.oppName}" but LEADERS says ${eraNow.surname}`);
  }
  const olTable = fig.ppm.find((p) => p.alb != null && !/hanson/i.test(p.oppRaw ?? ""));
  const hanTable = fig.ppm.find((p) => /hanson/i.test(p.oppRaw ?? ""));
  if (olTable) {
    shift("ppm ALP", olTable.alb, wasP(prose?.ppmA));
    shift("ppm OPP", olTable.opp, wasP(prose?.ppmO));
    if (prose) { prose.ppmA = olTable.alb; prose.ppmO = olTable.opp; }
  }
  if (hanTable) {
    shift("ppm ALP (vs Hanson)", hanTable.alb, wasP(prose?.ppmHan));
    shift("ppm Hanson", hanTable.opp, wasP(prose?.ppmHanOpp));
    if (prose) { prose.ppmHan = hanTable.alb; prose.ppmHanOpp = hanTable.opp; }
  }
  if (fig.window) {
    if (wave.date && fig.window.end !== wave.date)
      problems.push(`Infogram window end ${fig.window.end} != wave date ${wave.date}`);
    if (wave.dateStart && fig.window.start !== wave.dateStart)
      problems.push(`Infogram window start ${fig.window.start} != dateStart ${wave.dateStart}`);
    if (!wave.dateStart) wave.dateStart = fig.window.start;
  }
  if (fig.horserace?.length)
    notes.push(...n24Corroborate(fig.horserace, wave.date, wave.vi));

  const ig = {
    ids, kinds: projects.map((p) => p.kind ?? p.state),
    window: fig.window ?? null,
    vi: fig.vi, tpp: fig.tpp, altTpp: fig.altTpp,
    approval: fig.approval, ppm: fig.ppm.length ? fig.ppm : null,
  };
  return { ig, problems, notes };
}

// ------------------------------------------------------------ text helpers
const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dateIso = (d) => iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const today = () => dateIso(new Date());

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
// Datawrapper pages carry the cell HTML inside JSON strings; \u003C is the
// escaped '<' that clean() can't see otherwise.
const unescapeJson = (s) => s.replace(/\\u003C/gi, "<").replace(/\\u003E/gi, ">").replace(/\\u0026/gi, "&");

// ------------------------------------------------------------- News24 parse
// News24 articles are prose-only. They omit independents/others, which the
// Wikipedia wave record fills after these figures are overlaid.
const N24_PCT = "(\\d{1,2}(?:\\.\\d+)?)";
const N24_PAIR = `${N24_PCT}\\s*[-–]\\s*${N24_PCT}`;

function normaliseNews24(t) {
  return t
    .replace(/(\d[\d.]*)\s*per\s*cent\b/gi, "$1%")
    .replace(/minus-\s*(\d+(?:\.\d+)?)/gi, "-$1")
    .replace(/\b(?:up|down|rose|fell|climbed|increased|decreased)\s+(?:by\s+)?[\d.]+\s*(?:%|percentage points|points)\s+(?=to\b)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function news24Published(html) {
  const byline = html.match(/id="publish-date"[^>]*>\s*([^<]+?)\s*<\/div>/i)?.[1];
  const display = byline?.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+-\s+(\d{1,2}):(\d{2})(AM|PM)/i);
  if (display) {
    const mo = MONTHS[display[1].toLowerCase()];
    let hour = +display[4];
    if (/pm/i.test(display[6]) && hour < 12) hour += 12;
    if (/am/i.test(display[6]) && hour === 12) hour = 0;
    if (mo != null) {
      const date = iso(+display[3], mo, +display[2]);
      return { published: `${date}T${String(hour).padStart(2, "0")}:${display[5]}`, pubIso: date };
    }
  }
  const raw = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
  const t = raw ? new Date(raw) : null;
  if (!t || isNaN(t)) return { published: null, pubIso: null };
  const a = new Date(t.getTime() + AEST_MS);
  return {
    published: `${dateIso(a)}T${String(a.getUTCHours()).padStart(2, "0")}:${String(a.getUTCMinutes()).padStart(2, "0")}`,
    pubIso: dateIso(a),
  };
}

function news24Window(t, pubIso) {
  const m = t.match(/(?:poll|polling|survey)[^.]{0,160}?conducted(?:\s+online)?\s+(?:between|from)\s+([A-Za-z]+)\.?\s+(\d{1,2})\s*(?:and|to|[-–])\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2})(?:\s+(\d{4}))?/i);
  if (!m) return { date: null, dateStart: null };
  const y = m[5] ? +m[5] : pubIso ? +pubIso.slice(0, 4) : new Date().getUTCFullYear();
  const m1 = MONTHS[m[1].toLowerCase().replace(/\.$/, "")];
  const m2 = m[3] ? MONTHS[m[3].toLowerCase().replace(/\.$/, "")] : m1;
  if (m1 == null || m2 == null) return { date: null, dateStart: null };
  return {
    date: iso(y, m2, +m[4]),
    dateStart: iso(m1 > m2 ? y - 1 : y, m1, +m[2]),
  };
}

function news24Percentage(scope, names) {
  const m = scope.match(new RegExp(`\\b(?:${names})(?:'s)?\\b[^%.]{0,180}?${N24_PCT}\\s*%`, "i"));
  return m ? parseFloat(m[1]) : null;
}

function news24Sat(s) {
  if (!s) return null;
  const net = s.match(/net(?:\s+(?:approval|satisfaction)(?:\s+rating)?)?\s*(?:of\s+)?\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  const app = s.match(/(\d+(?:\.\d+)?)\s*%\s+satisfied\b/i)?.[1];
  const dis = s.match(/(\d+(?:\.\d+)?)\s*%\s+dissatisfied\b/i)?.[1];
  const pm = {
    app: app == null ? null : +app,
    dis: dis == null ? null : +dis,
    net: net == null ? null : +net,
  };
  if (pm.net == null && pm.app != null && pm.dis != null)
    pm.net = Math.round((pm.app - pm.dis) * 10) / 10;
  return pm;
}

function parseNews24Article(html, url) {
  const { published, pubIso } = news24Published(html);
  const t = normaliseNews24(clean(html));
  const gate = t.match(/news24(?:\.com\.au)?\s+Pulse\s*\/\s*YouGov\s+poll/i);
  if (!gate) return null;

  const block = t.slice(gate.index, gate.index + 2200);
  const fw = news24Window(t, pubIso);
  const sample = t.match(/(?:poll|survey)\s+of\s+([\d,]+)\s+voters\b/i)?.[1];
  const tpp = t.match(new RegExp(`Labor[^%.]{0,140}?Coalition\\s+${N24_PAIR}`, "i"));
  const alt = t.match(new RegExp(`(?:and|beat)\\s+One Nation(?:,?\\s+with a result of)?\\s+${N24_PAIR}`, "i"));
  const S = t.split(/(?<=[.!?])\s+/);

  const era = olFor(fw.date ?? pubIso ?? today()) ?? LEADERS.ols[LEADERS.ols.length - 1];
  const pmS = S.find((s) => /\balbanese\b/i.test(s) && /satisfied|satisfaction|approval/i.test(s));
  const oppRe = new RegExp(`\\b${era.surname}\\b`, "i");
  const oppS = S.find((s) => oppRe.test(s) && /satisfied|satisfaction|approval|negative rating/i.test(s));
  const pm = news24Sat(pmS), opp = news24Sat(oppS);

  const ppmS = S.find((s) => /preferred prime minister/i.test(s) && /\balbanese\b/i.test(s));
  const ppmPair = ppmS?.match(new RegExp(`(?:moving to|leading(?:\\s+(?:mr\\s+)?${era.surname})?\\s+)?${N24_PCT}\\s*%\\s*(?:compared with|to)\\s+${N24_PCT}\\s*%`, "i"));
  const ppmH = t.match(new RegExp(`led\\s+(?:One Nation leader\\s+)?Pauline Hanson\\s+${N24_PAIR}`, "i"))
    ?? t.match(new RegExp(`Pauline Hanson[^.]{0,180}?led\\s+${N24_PCT}\\s*%\\s+to\\s+${N24_PCT}\\s*%`, "i"));

  return {
    url, date: fw.date, dateStart: fw.dateStart,
    sample: sample ? parseInt(sample.replace(/,/g, ""), 10) : null,
    published,
    vi: {
      alp: news24Percentage(block, "labor|the alp|alp"),
      lnp: news24Percentage(block, "the coalition|coalition"),
      grn: news24Percentage(block, "the greens|greens"),
      onp: news24Percentage(block, "one nation"),
      ind: null, oth: null,
      tpp_alp: tpp ? parseFloat(tpp[1]) : null,
      tpp_lnp: tpp ? parseFloat(tpp[2]) : null,
    },
    sat: (pm || opp) ? {
      pmApp: pm?.app ?? null, pmDis: pm?.dis ?? null, pmNet: pm?.net ?? null,
      oppApp: opp?.app ?? null, oppDis: opp?.dis ?? null, oppNet: opp?.net ?? null,
    } : null,
    ppmA: ppmPair ? parseFloat(ppmPair[1]) : null,
    ppmO: ppmPair ? parseFloat(ppmPair[2]) : null,
    ppmHan: ppmH ? parseFloat(ppmH[1]) : null,
    ppmHanOpp: ppmH ? parseFloat(ppmH[2]) : null,
    altAlp: alt ? parseFloat(alt[1]) : null,
    altOnp: alt ? parseFloat(alt[2]) : null,
  };
}

function mergeNews24Wave(w, n) {
  if (!n) return { wave: w, news24: null, problems: [] };
  const problems = [];
  if (!n.date || n.date !== w.date) problems.push(`News24 date ${n.date ?? "missing"} != Wikipedia ${w.date}`);
  if (n.dateStart && w.dateStart && n.dateStart !== w.dateStart)
    problems.push(`News24 dateStart ${n.dateStart} != Wikipedia ${w.dateStart}`);
  if (!n.published) problems.push("missing News24 published timestamp");
  if (n.sample != null && w.sample != null && n.sample !== w.sample)
    problems.push(`News24 sample ${n.sample} != Wikipedia ${w.sample}`);
  for (const k of ["alp", "lnp", "grn", "onp"]) {
    if (n.vi[k] != null && w.vi[k] != null && Math.abs(n.vi[k] - w.vi[k]) > 0.75)
      problems.push(`News24 ${k} ${n.vi[k]} != Wikipedia ${w.vi[k]}`);
  }
  const vi = { ...w.vi };
  for (const [k, v] of Object.entries(n.vi ?? {})) if (v != null) vi[k] = v;
  const wave = {
    ...w,
    dateStart: n.dateStart ?? w.dateStart,
    sample: n.sample ?? w.sample,
    published: n.published ?? null,
    client: "News24", url: n.url ?? w.url, vi,
    sat: n.sat, ppmA: n.ppmA, ppmO: n.ppmO, ppmHan: n.ppmHan,
    altAlp: n.altAlp, altOnp: n.altOnp, news24: n,
  };
  return { wave, news24: n, problems };
}

// ------------------------------------------------- Datawrapper chart parse
// Fetch and classify each embedded chart's public dataset. Returns rows as
// arrays of trimmed cells. clean() is NOT applied here — its whitespace
// collapse (\s+ -> " ") would destroy the tab-separated structure before
// the \t split. The <span> arrows appear as literal HTML in the raw CSV.
async function chartRows(url) {
  const { text } = await fetchText(url);
  return unescapeJson(text)
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split("\t").map((c) => c.replace(/%/g, "").trim()));
}

// VI chart: rows are [scope, label, value] with a "Headline voting
// intention" scope and "Two-party preferred vote vs …" scopes.
function parseVi(rows) {
  const head = rows.filter((r) => r[0] === "Headline voting intention");
  const tppC = rows.filter((r) => r[0] === "Two-party preferred vote vs Coalition");
  if (!head.length || !tppC.length) return null;
  const get = (label) => head.find((r) => r[1] === label);
  const num = (r) => (r ? parseFloat(r[2]) : null);
  const known = ["Labor", "Coalition", "The Greens", "PHON", "Independents"];
  const others = head.filter((r) => !known.includes(r[1])).reduce((a, r) => a + (parseFloat(r[2]) || 0), 0);
  const tppA = tppC.find((r) => r[1] === "Labor");
  const tppB = tppC.find((r) => r[1] === "Coalition");
  return {
    alp: num(get("Labor")), lnp: num(get("Coalition")), grn: num(get("The Greens")),
    onp: num(get("PHON")), ind: num(get("Independents")),
    oth: others ? Math.round(others * 10) / 10 : null,
    tpp_alp: num(tppA), tpp_lnp: num(tppB),
  };
}

// Leader-satisfaction chart: header cells carry "<Surname> Satisfaction" and
// "<Surname> Dissatisfaction"; the first data row is the latest wave.
function parseSatisfaction(rows, olSurname) {
  const head = rows[0] ?? [];
  const col = (who, kind) => head.findIndex((c) => new RegExp(`^${who} ${kind}$`, "i").test(c));
  const prefix = whoPrefix(olSurname);
  const pmS = col("Albanese", "Satisfaction"), pmD = col("Albanese", "Dissatisfaction");
  const opS = col(prefix, "Satisfaction"), opD = col(prefix, "Dissatisfaction");
  if ([pmS, pmD, opS, opD].some((i) => i < 0)) return null;
  const row = rows.slice(1).find((r) => r.length > Math.max(pmS, pmD, opS, opD) && /\d/.test(r[pmS]));
  if (!row) return null;
  const v = (i) => parseFloat(row[i]);
  const app = (s, d) => ({ app: v(s), dis: v(d) });
  const pm = app(pmS, pmD), op = app(opS, opD);
  return {
    pmApp: pm.app, pmDis: pm.dis, oppApp: op.app, oppDis: op.dis,
    pmNet: Math.round((pm.app - pm.dis) * 10) / 10,
    oppNet: Math.round((op.app - op.dis) * 10) / 10,
  };
}
// Chart headers use the leader's given name sometimes ("Anthony Albanese")
// and surname elsewhere; the OL header matched so far starts with the
// surname's first name unknown — try the surname itself anywhere in the
// header cell.
function whoPrefix(olSurname) { return olSurname; }

// ppm chart (present in some articles): rows [label, total] with leader
// full names and a "Don't know" row.
function parsePpmChart(rows, olSurname) {
  if (!rows.length || rows[0].length < 2 || !/column/i.test(rows[0][0])) return null;
  const find = (who) => rows.find((r) => new RegExp(who, "i").test(r[0]));
  const a = find("Albanese"), o = find(olSurname[0].toUpperCase() + olSurname.slice(1));
  if (!a || !o) return null;
  return { ppmA: parseFloat(a[1]), ppmO: parseFloat(o[1]) };
}

// ------------------------------------------------------------- article parse
// One article URL -> a release record (or null if it's not the federal
// Public Data series). Fetches the page plus its Datawrapper datasets.
async function parseArticle(url, id) {
  const { text: html0 } = await fetchText(url);
  const html = unescapeJson(html0);
  const txt = clean(html);

  // Series gate: the methodology sentence is THE identifier of the federal
  // Public Data series — "surveyed NAustralian voters online between …".
  // ("eligible/enrolled" may precede "Australian voters"; some releases omit
  // the year from the fieldwork window — then it's inferred from the
  // article's published_at.)
  const meth = txt.match(/surveyed\s+[\d,]+\s+(?:eligible\s+|enrolled\s+)?Australian\s+voters\s+online\s+between\s+[^.]{0,60}/i);
  if (!meth) return null;
  const sm = meth[0].match(/surveyed\s+([\d,]+)/i);
  const sample = sm ? parseInt(sm[1].replace(/,/g, ""), 10) : null;
  const fm = meth[0].match(/between\s+(?:([A-Za-z]+)\.?\s+)?(\d{1,2})\s*(?:and|to|[-–])\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?/i);

  // published_at: the article's own JSON block inside the transfer state.
  // Needed up-front because yearless fieldwork windows are dated from it.
  let published = null, pubIso = null;
  const pi0 = html.indexOf(`"id":${id}`);
  if (pi0 >= 0) {
    const pm = html.slice(pi0, pi0 + 6000).match(/"published_at":"([^"]+)"/);
    if (pm) {
      const t = new Date(pm[1]);
      if (!isNaN(t)) {
        const a = new Date(t.getTime() + AEST_MS);
        published = `${dateIso(a)}T${String(a.getUTCHours()).padStart(2, "0")}:${String(a.getUTCMinutes()).padStart(2, "0")}`;
        pubIso = dateIso(a);
      }
    }
  }

  // Phrasing observed: "between 7 and 14 July 2026" (one trailing month) —
  // allow "between 29 December 2025 and 4 January 2026" and, like the March
  // 2026 release, "between 23 and 30 June" with no year at all.
  let dateStart = null, date = null;
  if (fm) {
    let y2 = fm[6] ? +fm[6] : (pubIso ? +pubIso.slice(0, 4) : new Date().getUTCFullYear());
    const m2 = MONTHS[fm[5].toLowerCase()], d2 = +fm[4];
    let mo1 = fm[3] ? MONTHS[fm[3].toLowerCase()]
      : fm[1] ? MONTHS[fm[1].toLowerCase()]
      : m2;
    if (m2 != null && mo1 != null) {
      // Yearless windows straddling Dec/Jan: the end month resolves to the
      // occurrence nearest the publication date (published a few days after
      // fieldwork end, 0–10d lag enforced downstream).
      if (!fm[6] && pubIso) {
        const cand = [y2 - 1, y2, y2 + 1].map((y) => iso(y, m2, d2))
          .sort((a, b) => Math.abs(new Date(a) - new Date(pubIso)) - Math.abs(new Date(b) - new Date(pubIso)));
        y2 = +cand[0].slice(0, 4);
      }
      date = iso(y2, m2, d2);
      let yr1 = y2;
      if (mo1 > m2) yr1 = y2 - 1;
      dateStart = iso(yr1, mo1, +fm[2]);
    }
  }
  if (!date) return null;

  // Datawrapper charts: VI + satisfaction (+optional ppm), rev pinned as embedded.
  const ids = [...new Set([...html.matchAll(/datawrapper\.dwcdn\.net\/([A-Za-z0-9]+)\/(\d+)/g)]
    .map((m) => `${m[1]}/${m[2]}`))];
  const era = olFor(date) ?? LEADERS.ols[LEADERS.ols.length - 1];
  let vi = null, sat = null, ppmChart = null;
  const charts = {};
  for (const cid of ids) {
    const rows = await chartRows(`https://datawrapper.dwcdn.net/${cid}/dataset.csv`);
    charts[cid] = rows;
    vi ??= parseVi(rows);
    sat ??= parseSatisfaction(rows, era.surname);
    ppmChart ??= parsePpmChart(rows, era.surname);
  }
  if (!vi) return null;

  // ppm prose fallback ("leading 44% to 35%" or "leading 44% versus 35%"
  // after the names). Only used when no ppm chart is embedded.
  let ppmA = ppmChart?.ppmA ?? null, ppmO = ppmChart?.ppmO ?? null;
  if (ppmA == null || ppmO == null) {
    const s = txt.match(/preferred Prime Minister[^.]{0,240}?(\d{1,2})\s*%\s*(?:to|versus|vs\.?|–|-)\s*(\d{1,2})\s*%/i);
    if (s) { ppmA = ppmA ?? +s[1]; ppmO = ppmO ?? +s[2]; }
  }

  return { url, id, date, dateStart, sample, published, vi, sat, ppmA, ppmO, charts };
}

// ---------------------------------------------------------------- guard
// requirePublished/requireTpp hold for yougov.com releases; fallback waves
// may legitimately lack a publish timestamp (Wikipedia-only) or a 2PP.
function guard(rec, { requirePublished = true, requireTpp = true, spanMin = 1 } = {}) {
  const errs = [];
  const check = (n, ok) => { if (!ok) errs.push(n); };
  const { vi, sat } = rec;
  const core = { date: rec.date, dateStart: rec.dateStart, sample: rec.sample };
  if (requirePublished) core.published = rec.published;
  for (const [k, v] of Object.entries(core))
    if (v == null) errs.push(`missing ${k}`);
  const viReq = ["alp", "lnp", "grn", "onp", "ind"];
  if (requireTpp) viReq.push("tpp_alp", "tpp_lnp");
  for (const k of viReq) if (vi[k] == null) errs.push(`missing ${k}`);
  if (vi.ind == null && vi.oth == null) errs.push("missing others bucket");
  for (const k of ["alp", "lnp", "grn", "onp", "ind", "oth"])
    if (vi[k] != null) check(`${k}=${vi[k]} in 1–70`, vi[k] >= 1 && vi[k] <= 70);
  const parts = [vi.alp, vi.lnp, vi.grn, vi.onp, vi.ind, vi.oth].filter((v) => v != null);
  if (parts.length >= 5) {
    const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10;
    check(`primaries Σ=${sum} ~100`, Math.abs(sum - 100) <= 1.5);
  }
  if (vi.tpp_alp != null && vi.tpp_lnp != null)
    check(`2pp Σ=${(vi.tpp_alp + vi.tpp_lnp).toFixed(1)} ~100`, Math.abs(vi.tpp_alp + vi.tpp_lnp - 100) <= 1);
  if (rec.ppmA != null) check(`ppmA=${rec.ppmA} in 15–80`, rec.ppmA >= 15 && rec.ppmA <= 80);
  if (rec.ppmO != null) check(`ppmO=${rec.ppmO} in 5–70`, rec.ppmO >= 5 && rec.ppmO <= 70);
  if (rec.ppmA != null && rec.ppmA === rec.ppmO) errs.push(`ppm tie ${rec.ppmA}/${rec.ppmO} — parse suspect`);
  if (rec.ppmHan != null) check(`ppmHan=${rec.ppmHan} in 15–90`, rec.ppmHan >= 15 && rec.ppmHan <= 90);
  if (rec.ppmHanOpp != null) check(`ppmHan other=${rec.ppmHanOpp} in 5–70`, rec.ppmHanOpp >= 5 && rec.ppmHanOpp <= 70);
  if (rec.altAlp != null) check(`alt TPP ALP=${rec.altAlp} in 25–90`, rec.altAlp >= 25 && rec.altAlp <= 90);
  if (rec.altOnp != null) check(`alt TPP ONP=${rec.altOnp} in 10–75`, rec.altOnp >= 10 && rec.altOnp <= 75);
  if (rec.altAlp != null && rec.altOnp != null)
    check(`alt TPP Σ=${(rec.altAlp + rec.altOnp).toFixed(1)} ~100`, Math.abs(rec.altAlp + rec.altOnp - 100) <= 1.5);
  if (sat) {
    for (const [k, v] of Object.entries({ pmNet: sat.pmNet, oppNet: sat.oppNet })) if (v != null) check(`${k}=${v} in −80..80`, v >= -80 && v <= 80);
  }
  check(`date ${rec.date} not future`, rec.date <= today());
  const span = (new Date(rec.date) - new Date(rec.dateStart)) / DAY;
  check(`field span ${span}d in ${spanMin}–14`, span >= spanMin && span <= 14);
  if (rec.published) {
    const lag = (new Date(rec.published.slice(0, 10)) - new Date(rec.date)) / DAY;
    check(`release lag ${lag}d in 0–10`, lag >= 0 && lag <= 10);
  }
  if (rec.date < LEADERS.pm.from) errs.push("pre-Albanese-era date");
  if (rec.sample != null) check(`sample=${rec.sample} in 1000–2500`, rec.sample >= 1000 && rec.sample <= 2500);
  return errs;
}

// ------------------------------------------------------ Wikipedia fallback
// Parse the federal VI table's wikitext into wave records as a stand-in for
// waves YouGov never releases on yougov.com. A poll's TPP-vs-Coalition triple
// sits at the end of its own chunk (rowspan=2 layouts) or trailing the
// primaries (single-row 2025-era layout); the continuation chunk (TPP vs
// PHON) and non-VI tables are ignored. Only [[YouGov]] rows count; MRP rows
// are excluded.
const wikiMonth = (s) => MONTHS[s.toLowerCase().replace(/\.$/, "")] ?? null;
function parseWikiDate(cell, fallbackYear) {
  const s = cell.replace(/\[\[|\]\]/g, "").trim();
  let m = s.match(/^(\d{1,2})\s*(?:([A-Za-z]{3,9})\.?)?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
  if (!m) {
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?$/);
    if (!m) return null;
    const mo = wikiMonth(m[2]), d = +m[1], y = m[3] ? +m[3] : fallbackYear;
    if (mo == null || y == null) return null;
    const dt = iso(y, mo, d);
    return { date: dt, dateStart: dt };
  }
  const m2 = wikiMonth(m[4]), m1 = m[2] ? wikiMonth(m[2]) : m2;
  const y2 = m[5] ? +m[5] : fallbackYear;
  if (m1 == null || m2 == null || y2 == null) return null;
  return { date: iso(y2, m2, +m[3]), dateStart: iso(m1 > m2 ? y2 - 1 : y2, m1, +m[1]) };
}

// Cell content = text after the final "|" (attributes precede it); refs and
// templates, which contain pipes, are stripped beforehand. Citation data
// (url, client) must be harvested from the raw chunk before this runs.
function wikiCells(chunk) {
  const t = chunk
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ");
  const cells = [];
  for (const l of t.split("\n")) {
    const c = l.match(/^([|!])(.*)$/);
    if (!c) continue;
    const pipe = c[2].lastIndexOf("|");
    cells.push({ hdr: c[1] === "!", content: (pipe >= 0 ? c[2].slice(pipe + 1) : c[2]).trim() });
  }
  return cells;
}

const near100 = (sum) => Math.abs(sum - 100) <= 2.5;
const WIKI_PCT = /^'{0,3}(\d{1,2}(?:\.\d{1,2})?)%'{0,3}$/;

// The Coalition shares one colspan=3 cell in this series (form A); tolerate
// pollsters' lib/lnp/nat triple (form B) in case the table layout shifts.
function wikiPrims(tokens) {
  if (tokens.length >= 6) {
    const p = tokens.slice(0, 6);
    if (p.every((v) => v != null) && near100(p.reduce((a, b) => a + b, 0)))
      return { alp: p[0], lnp: p[1], grn: p[2], onp: p[3], ind: p[4], oth: p[5], used: 6 };
  }
  if (tokens.length >= 8) {
    const coal = tokens.slice(1, 4).filter((v) => v != null);
    const rest = tokens.slice(4, 8);
    if (tokens[0] != null && coal.length && rest.every((v) => v != null)) {
      const lnp = Math.round(coal.reduce((a, b) => a + b, 0) * 10) / 10;
      if (near100(tokens[0] + lnp + rest.reduce((a, b) => a + b, 0)))
        return { alp: tokens[0], lnp, grn: rest[0], onp: rest[1], ind: rest[2], oth: rest[3], used: 8 };
    }
  }
  return null;
}

function waveFromCells(cells) {
  const si = cells.findIndex((c) => !c.hdr && /^\d[\d,]{2,}$/.test(c.content));
  if (si < 0) return { fail: "no sample cell" };
  const sample = +cells[si].content.replace(/,/g, "");
  const tokens = [];
  for (const c of cells.slice(si + 1)) {
    const m = c.content.match(WIKI_PCT);
    if (m) tokens.push(parseFloat(m[1]));
    else if (c.content === "") tokens.push(null); // voids where templates sat
    else return { fail: `unexpected cell "${c.content.slice(0, 40)}"` };
    if (tokens.length >= 11) break;
  }
  const prims = wikiPrims(tokens);
  if (!prims) return { fail: `primaries don't sum ~100 [${tokens.join(",")}]` };
  const [ta, tb] = tokens.slice(prims.used, prims.used + 2);
  const tpp = ta != null && tb != null && Math.abs(ta + tb - 100) <= 2
    ? { tpp_alp: ta, tpp_lnp: tb }
    : { tpp_alp: null, tpp_lnp: null };
  const { used, ...vi } = prims;
  return { sample, vi: { ...vi, ...tpp } };
}

function parseWikiYouGov(text) {
  const out = [], unparsed = [];
  let year = null, inVi = false;
  for (const chunk of text.split(/^\|-[^\n]*$/m)) {
    for (const h of chunk.matchAll(/^={2,4}\s*([^=]+?)\s*={2,4}\s*$/gm)) {
      const y = h[1].match(/\b(20\d\d)\b/);
      if (y) year = +y[1];
    }
    if (/\{\|/.test(chunk)) inVi = /Primary vote/i.test(chunk) && /2PP|Two-party.preferred/i.test(chunk);
    else if (/\|\}/.test(chunk)) inVi = false;
    if (!inVi || !/\[\[YouGov\]\]/.test(chunk) || /\bMRP\b/.test(chunk)) continue;
    const um = chunk.match(/\|\s*url\s*=\s*(https?:\/\/[^\s|}\]]+)/);
    const bm = chunk.match(/\[(https?:\/\/[^\s\]]+)\s/);
    let url = um?.[1] ?? bm?.[1] ?? null;
    if (url && /wikipedia\.org/.test(url)) url = null;
    const cm = chunk.match(/\[\S+\s+''([^'']{3,40})''\]/);
    const clientTxt = `${cm?.[1] ?? ""} ${um?.[1] ?? ""}`;
    const client = /australia[ -]?institute/i.test(clientTxt) ? "Australia Inst." : "News24";
    const cells = wikiCells(chunk);
    const dd = cells.find((c) => c.hdr && parseWikiDate(c.content, year));
    if (!dd) { unparsed.push("no parseable date cell"); continue; }
    const fw = parseWikiDate(dd.content, year);
    const w = waveFromCells(cells);
    if (w.fail) { unparsed.push(`${fw.date}: ${w.fail}`); continue; }
    out.push({ ...fw, sample: w.sample, url, client, vi: w.vi });
  }
  const seen = new Set(), waves = [];
  for (const w of out) if (!seen.has(w.date)) { seen.add(w.date); waves.push(w); }
  // The page repeats each house across subpopulation tables (by gender, age,
  // generation, language) that carry no sample column, so a wave read
  // perfectly from the voting-intention table also lands here as "no sample
  // cell" from half a dozen others. Reporting those as failures buries a real
  // one: every recent wave sat in `unparsed` while every recent wave had in
  // fact been parsed correctly. Keep only dates we genuinely never got.
  const got = new Set(waves.map((w) => w.date));
  const realFails = unparsed.filter((u) => {
    const d = /^(\d{4}-\d{2}-\d{2}):/.exec(u);
    return !d || !got.has(d[1]);
  });
  return { waves, unparsed: realFails };
}

// --------------------------------------------------------------- entry
const status = { changed: false, check: CHECK, added: [], skipped_existing: [], candidates: [], releaseFilled: [] };

if (NEWS24_OF) { // dev oracle: parse one News24 article, print the record, exit
  const art = await fetchNews24Article(NEWS24_OF);
  if (!art.html) { console.error("News24 fetch failed: set NEWSIE_CHROME=1 or N24_NEWS24_FILE"); process.exit(1); }
  const rec = parseNews24Article(art.html, NEWS24_OF);
  if (!rec) { console.error("not a News24 Pulse / YouGov federal-poll article"); process.exit(1); }
  const { ig, problems, notes } = await infogramEnrichNews24(art.html, rec, rec);
  console.log(JSON.stringify({
    url: rec.url, via: art.via, date: rec.date, dateStart: rec.dateStart, sample: rec.sample,
    published: rec.published, vi: rec.vi, sat: rec.sat,
    ppmA: rec.ppmA, ppmO: rec.ppmO, ppmHan: rec.ppmHan, ppmHanOpp: rec.ppmHanOpp,
    altAlp: rec.altAlp, altOnp: rec.altOnp,
    infogram: ig, igProblems: problems, igNotes: notes,
  }, null, 2));
  process.exit(0);
}

if (URL_OF) { // dev oracle: parse one article, print the record, exit
  const id = +(URL_OF.match(/articles\/(\d+)/) ?? [])[1];
  const rec = await parseArticle(URL_OF, id || 0);
  if (!rec) { console.error("not a YouGov Public Data federal-poll article"); process.exit(1); }
  console.log(JSON.stringify({ url: rec.url, date: rec.date, dateStart: rec.dateStart, sample: rec.sample, published: rec.published, vi: rec.vi, sat: rec.sat, ppmA: rec.ppmA, ppmO: rec.ppmO }, null, 2));
  process.exit(0);
}

try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const ygDates = new Set(D.polls.filter((p) => p.pollster === "YouGov").map((p) => p.date));
  const latestYg = [...ygDates].sort().pop();
  const youGovByDate = new Map(D.polls.filter((p) => p.pollster === "YouGov").map((p) => [p.date, p]));
  // Waves still waiting on a self-release link (releaseUrl absent, source not
  // already a yougov.com release): keep RSS candidates this old alive so a
  // release published after the wave landed gets backfilled — mirror of the
  // RedBridge extractor's filledRelease logic.
  const fillableFloor = [...youGovByDate.values()]
    .filter((p) => !p.releaseUrl && !(p.url ?? "").startsWith("https://yougov.com/"))
    .map((p) => p.date).sort()[0];

  const rss = (await fetchText(RSS)).text;
  const items = [];
  for (const m of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim();
    const link = b.match(/<link>(https:\/\/yougov\.com\/articles\/[^<]+)<\/link>/)?.[1]?.trim();
    const pubIso = b.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    if (!title || !link) continue;
    if (!TITLE_HIT.test(title) || TITLE_MISS.test(title)) continue;
    items.push({ title, link, pubIso: pubIso ? dateIso(new Date(pubIso)) : null });
  }
  // A wave publishes within days of fieldwork end; the RSS item's pubDate
  // pre-screen drops articles older than the latest known wave — unless a
  // canon wave still lacks its releaseUrl (releases are occasional and can
  // post-date the wave, which usually lands via the Wikipedia path first).
  const cands = items.filter((i) =>
    !i.pubIso || i.pubIso >= (latestYg ?? "") || (fillableFloor && i.pubIso >= fillableFloor));

  const recs = [];
  const seen = new Set();
  for (const it of cands) {
    const id = +(it.link.match(/articles\/(\d+)/) ?? [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    status.candidates.push(it.title.slice(0, 90));
    let rec;
    try { rec = await parseArticle(it.link, id); }
    catch (e) { console.error(`N24_NOTE fetch/parse failed ${it.link}: ${e.message}`); continue; }
    if (!rec) continue; // not the federal Public Data series
    status.candidates.push(`  -> parsed ${rec.date}`);
    recs.push(rec);
  }

  const guardFails = [];
  const newPolls = [], newPpm = [], newAppr = [], newAlt = [], newPpmH = [], sources = [];
  for (const rec of recs.sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (ygDates.has(rec.date)) {
      status.skipped_existing.push(rec.date);
      const hit = youGovByDate.get(rec.date);
      if (hit && !hit.releaseUrl && hit.url !== rec.url) {
        hit.releaseUrl = rec.url;
        status.releaseFilled.push(rec.date);
      }
      continue;
    }
    const errs = guard(rec);
    if (errs.length) { guardFails.push(`${rec.date}: ${errs.join(" | ")}`); continue; }
    const era = olFor(rec.date);
    newPolls.push({
      date: rec.date, published: rec.published, dateStart: rec.dateStart,
      pollster: "YouGov", client: "News24", sample: rec.sample,
      alp: rec.vi.alp, lnp: rec.vi.lnp, grn: rec.vi.grn, onp: rec.vi.onp,
      ind: rec.vi.ind, oth: rec.vi.oth,
      tpp_alp: rec.vi.tpp_alp, tpp_lnp: rec.vi.tpp_lnp, url: rec.url,
    });
    if (rec.ppmA != null && rec.ppmO != null)
      newPpm.push({ date: rec.date, firm: "YouGov", alb: rec.ppmA, opp: rec.ppmO, oppName: era?.oppName ?? null, han: null, extra: null });
    if (rec.sat) {
      newAppr.push({
        date: rec.date, firm: "YouGov", alb: rec.sat.pmNet, opp: rec.sat.oppNet,
        oppName: era?.oppName ?? null, han: null,
        detail: {
          alb: { app: rec.sat.pmApp, dis: rec.sat.pmDis },
          opp: { app: rec.sat.oppApp, dis: rec.sat.oppDis },
        },
      });
    }
    sources.push({
      date: rec.date, file: `release-${rec.date}.json`,
      json: JSON.stringify({
        url: rec.url, id: rec.id, published: rec.published,
        fieldwork: { date: rec.date, dateStart: rec.dateStart, sample: rec.sample },
        vi: rec.vi, satisfaction: rec.sat, ppm: { alb: rec.ppmA, opp: rec.ppmO },
      }, null, 2) + "\n",
    });
    status.added.push({ date: rec.date, primaries: `${rec.vi.alp}/${rec.vi.lnp}/${rec.vi.grn}/${rec.vi.onp}/${rec.vi.ind}`, tpp: `${rec.vi.tpp_alp}/${rec.vi.tpp_lnp}`, ppm: rec.ppmA == null ? null : `${rec.ppmA}/${rec.ppmO}`, pmNet: rec.sat?.pmNet ?? null, oppNet: rec.sat?.oppNet ?? null });
  }

  // Fallback: waves YouGov never released on yougov.com. Wikipedia discovers
  // the wave and its canonical article URL; with NEWSIE_CHROME=1, News24 then
  // enriches that wave before Wikipedia fills the fields News24 omits.
  status.fallback = { source: "wikipedia", checked: 0, added: [], skipped_existing: 0, unparsed: [] };
  status.news24 = {
    enabled: !!(process.env.NEWSIE_CHROME || NEWS24_FILE),
    attempted: 0, enriched: [], skipped: [], problems: [],
    sources: {}, // date -> "anon"|"chrome"|"file" (which leg served the article DOM)
    infogram: {}, // date -> {ids, kinds, problems}
  };
  try {
    const wikiText = WIKI_FILE ? readFileSync(WIKI_FILE, "utf8") : (await fetchText(WIKI_RAW)).text;
    const { waves, unparsed } = parseWikiYouGov(wikiText);
    if (WIKI_DEBUG) console.error("N24_WIKI " + JSON.stringify(waves));
    status.fallback.checked = waves.length;
    status.fallback.unparsed = unparsed.slice(0, 10);
    status.news24.upgraded = [];
    const existingByDate = new Map(D.polls.filter((p) => p.pollster === "YouGov").map((p) => [p.date, p]));
    const newDates = new Set(newPolls.map((p) => p.date));
    const firmRowExists = (key, date) => (D[key] ?? []).some((r) => r.date === date && r.firm === "YouGov");
    const addDerived = (key, rows, row) => {
      if (!firmRowExists(key, row.date)) rows.push(row);
    };
    for (const wikiWave of waves) {
      const existing = existingByDate.get(wikiWave.date) ?? null;
      const news24Url = (() => {
        try { return /(^|\.)news24\.com\.au$/.test(new URL(wikiWave.url ?? "").hostname) ? wikiWave.url : null; }
        catch { return null; }
      })();
      const canUpgrade = !!existing && wikiWave.date === latestYg && existing.client === "News24" && !existing.published && !!news24Url;
      if ((existing || newDates.has(wikiWave.date)) && !canUpgrade) { status.fallback.skipped_existing++; continue; }

      let h = wikiWave, n24 = null, ig = null;
      if (news24Url) {
        status.news24.attempted++;
        const art = await fetchNews24Article(news24Url);
        const parsed = art.html ? parseNews24Article(art.html, news24Url) : null;
        if (parsed) {
          const merged = mergeNews24Wave(wikiWave, parsed);
          const enriched = await infogramEnrichNews24(art.html, merged.wave, merged.news24);
          status.news24.sources[wikiWave.date] = art.via;
          if (enriched.ig)
            status.news24.infogram[wikiWave.date] = {
              ids: enriched.ig.ids.length, kinds: enriched.ig.kinds,
              problems: enriched.problems, notes: enriched.notes,
            };
          if (enriched.notes.length) console.error(`N24_NOTE ${wikiWave.date}: ${enriched.notes.join(" | ")}`);
          const allProblems = [...merged.problems, ...enriched.problems];
          if (allProblems.length) {
            status.news24.problems.push(`${wikiWave.date}: ${allProblems.join(" | ")}`);
          } else {
            h = merged.wave;
            n24 = merged.news24;
            ig = { via: art.via, ...enriched.ig };
            status.news24.enriched.push(h.date);
          }
        } else {
          status.news24.skipped.push(`${wikiWave.date}: News24 ${art.via ?? "fetch"}/parse failed`);
        }
      }
      if (canUpgrade && !n24) continue;

      const errs = guard(h, { requirePublished: !!n24, requireTpp: false, spanMin: 0 });
      if (errs.length) { status.fallback.unparsed.push(`${h.date}: ${errs.join(" | ")}`); continue; }
      const era = olFor(h.date);
      const pollRow = {
        date: h.date, dateStart: h.dateStart,
        pollster: "YouGov", client: h.client, sample: h.sample,
        alp: h.vi.alp, lnp: h.vi.lnp, grn: h.vi.grn, onp: h.vi.onp,
        ind: h.vi.ind, oth: h.vi.oth,
        tpp_alp: h.vi.tpp_alp, tpp_lnp: h.vi.tpp_lnp,
        ...(h.published ? { published: h.published } : {}),
        ...(h.url ? { url: h.url } : {}),
      };
      if (existing) {
        Object.assign(existing, pollRow);
        status.news24.upgraded.push(h.date);
      } else {
        newPolls.push(pollRow);
        newDates.add(h.date);
      }
      if (n24?.ppmA != null && n24.ppmO != null)
        addDerived("ppm", newPpm, { date: h.date, firm: "YouGov", alb: n24.ppmA, opp: n24.ppmO, oppName: era?.oppName ?? null, han: null, extra: null });
      if (n24?.sat && (n24.sat.pmNet != null || n24.sat.oppNet != null)) {
        const detail = {};
        const addSplit = (key, app, dis) => {
          const out = {};
          if (app != null) out.app = app;
          if (dis != null) out.dis = dis;
          if (Object.keys(out).length) detail[key] = out;
        };
        addSplit("alb", n24.sat.pmApp, n24.sat.pmDis);
        addSplit("opp", n24.sat.oppApp, n24.sat.oppDis);
        addDerived("approval", newAppr, {
          date: h.date, firm: "YouGov", alb: n24.sat.pmNet, opp: n24.sat.oppNet,
          oppName: era?.oppName ?? null, han: null,
          detail: Object.keys(detail).length ? detail : null,
        });
      }
      if (n24?.altAlp != null && n24.altOnp != null)
        addDerived("altTpp", newAlt, { date: h.date, firm: "YouGov", alpVsOnp_alp: n24.altAlp, lnpVsOnp_lnp: null });
      if (n24?.ppmHan != null && n24.ppmHanOpp != null)
        addDerived("ppmHeadToHead", newPpmH, { date: h.date, firm: "YouGov", alb: n24.ppmHan, han: n24.ppmHanOpp });
      sources.push({
        date: h.date, file: `${n24 ? "news24" : "wiki"}-${h.date}.json`,
        json: JSON.stringify({
          source: n24 ? "news24+wikipedia" : "wikipedia", title: WIKI_TITLE, url: h.url,
          published: h.published ?? null,
          fieldwork: { date: h.date, dateStart: h.dateStart, sample: h.sample }, vi: h.vi,
          satisfaction: n24?.sat ?? null,
          ppm: n24 ? { alb: n24.ppmA, opp: n24.ppmO, albVsHanson: n24.ppmHan, hanson: n24.ppmHanOpp } : null,
          altTpp: n24 ? { alpVsOnp_alp: n24.altAlp, alpVsOnp_onp: n24.altOnp } : null,
          infogram: ig ?? null,
        }, null, 2) + "\n",
      });
      if (existing) continue;
      status.fallback.added.push(h.date);
      status.added.push({
        date: h.date,
        primaries: `${h.vi.alp}/${h.vi.lnp}/${h.vi.grn}/${h.vi.onp}/${h.vi.ind}`,
        tpp: h.vi.tpp_alp == null ? null : `${h.vi.tpp_alp}/${h.vi.tpp_lnp}`,
        ppm: n24?.ppmA == null ? null : `${n24.ppmA}/${n24.ppmO}`,
        pmNet: n24?.sat?.pmNet ?? null, oppNet: n24?.sat?.oppNet ?? null,
        via: n24 ? "news24+wikipedia" : "wikipedia",
      });
    }
    if (status.fallback.added.length > MAX_WIKI_ADDS)
      guardFails.push(`wiki fallback: ${status.fallback.added.length} new waves > cap ${MAX_WIKI_ADDS}`);
  } catch (e) {
    console.error(`N24_NOTE wiki fallback skipped: ${e.message}`);
    status.fallback.error = String(e?.message || e);
  }

  if (guardFails.length) {
    console.error("N24_GUARD " + guardFails.join(" || "));
    status.guard = guardFails;
    console.log("N24_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  if (sources.length || status.releaseFilled.length) {
    if (newPolls.length) D.polls = [...D.polls, ...newPolls].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const [key, rows] of [["ppm", newPpm], ["approval", newAppr], ["altTpp", newAlt], ["ppmHeadToHead", newPpmH]]) {
      if (!rows.length) continue;
      D[key] ??= [];
      D[key] = [...D[key], ...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    const trailingNl = orig.endsWith("\n") ? "\n" : "";
    const next = JSON.stringify(D, null, 2) + trailingNl;
    status.changed = next !== orig;
    if (status.changed && !CHECK) {
      writeFileSync(OUT + ".tmp", next);
      renameSync(OUT + ".tmp", OUT);
      mkdirSync(SRC_DIR, { recursive: true });
      for (const s of sources) writeFileSync(`${SRC_DIR}/${s.file}`, s.json);
      const parts = [];
      if (newPolls.length) parts.push(`+${newPolls.length} YouGov wave(s): ${status.added.map((a) => a.date).join(", ")}`);
      if (status.news24.upgraded.length) parts.push(`enriched latest News24 wave: ${status.news24.upgraded.join(", ")}`);
      if (status.releaseFilled.length) parts.push(`releaseUrl filled: ${status.releaseFilled.join(", ")}`);
      console.log(`wrote ${OUT}: ${parts.join(", ")}`);
    }
  }
  console.log("N24_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("N24_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("N24_STATUS " + JSON.stringify(status));
  process.exit(1);
}
