// Resolve wave: fieldwork window, sample, url and published time from the
// SMH/Age article, for rows assimilate-resolve-vi.mjs filed `fieldworkPending`.
//
// WHY (2026-10-11): the Resolve agent only ever read the Political Monitor
// interactive's data.json, which carries figures but no fieldwork window, no
// sample and no article time. Those came from a hand-stamp (1b77d28) that
// nothing in the pipeline performed, so the 2026-10-10 wave sat on
// "Conducted on dates TBC" and a day-precision published while the article
// ("Voters cool on Hanson…", 6:00pm 11 Oct) said "the 2250 voters Resolve
// Political Monitor surveyed from Tuesday to Saturday of last week" (user: why
// didn't the resolve agent find the article and add fieldwork dates and
// publication date/time?). The 2026-09-12 row's url and time were stamped
// by hand but its dateStart never was.
//
// How: the topic page (plain fetch, no paywall wall for the HTML) lists the
// federal Resolve stories. For each Resolve row missing its window, the
// stories whose URL slug date is the row's published day (= csv wave date)
// are read; published = the earliest of their JSON-LD datePublished in
// Sydney time; the window, sample and url come from the earliest story that
// states the window. Window phrasings seen: "from August 9 to 15",
// "from September 6 to 12", "surveyed from Tuesday to Saturday of last week"
// (weekdays resolve to the latest such days before the article's day). The
// window must end within 3 days of the row's placing (csv date - 1); a
// different end re-dates the VI row and its ppm/approval siblings. "More than
// 2200 voters" is not a sample: only an exact count is filed.
//
// Dry-run by default; --apply writes data/polls.json. --topic FILE and
// --article URL=FILE read saved HTML instead of fetching (tests).
// The same sweep reads the newest wave's leadership (see "leadership" below).
// Last line: RESOLVE_READ_STATUS {"stamped":[...],"pending":[...],"leaders":[...],"warnings":[...]}
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeAtomic } from "./atomic-write.mjs";

const TOPIC = "https://www.smh.com.au/topic/resolve-political-monitor-6fhy";
const ORIGIN = "https://www.smh.com.au";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const DAY = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const saved = new Map(argv.flatMap((a, i) => argv[i - 1] === "--article" ? [a.split("=")] : []));

async function get(url) {
  if (url === TOPIC && opt("--topic")) return readFileSync(opt("--topic"), "utf8");
  if (/datawrapper/.test(url) && opt("--dw")) return readFileSync(`${opt("--dw")}/${url.split("/")[3]}.tsv`, "utf8");
  if (saved.has(url)) return readFileSync(saved.get(url), "utf8");
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-AU" } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

export const textOf = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&rsquo;/g, "’")
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ");

const iso = (t) => new Date(t).toISOString().slice(0, 10);
const sydney = (utc) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

// the article's own datePublished (the page also embeds related stories'
// stamps; the article's is the JSON-LD one, the first datePublished)
export const publishedOf = (html) => html.match(/"datePublished":"(\d{4}-\d{2}-\d{2}T[\d:.]+Z)"/)?.[1] ?? null;

// fieldwork window stated in the text, resolved against the article's day
export function windowOf(text, articleDay) {
  const t0 = Date.parse(articleDay);
  const yr = +articleDay.slice(0, 4);
  const M = MONTHS.join("|"), W = WEEKDAYS.join("|");
  const day = (y, m, d) => { let t = Date.UTC(y, m, d); if (t > t0) t = Date.UTC(y - 1, m, d); return t; };
  // "from August 9 to 15", "from September 30 to October 4", "between October 4 and 10"
  let m = text.match(new RegExp(`(?:from|between)\\s+(${M})\\s+(\\d{1,2})\\s+(?:to|and|–|-)\\s+(?:(${M})\\s+)?(\\d{1,2})\\b`, "i"));
  if (m) {
    const m1 = MONTHS.indexOf(m[1].toLowerCase()), m2 = m[3] ? MONTHS.indexOf(m[3].toLowerCase()) : m1;
    const end = day(yr, m2, +m[4]);
    let start = Date.UTC(new Date(end).getUTCFullYear(), m1, +m[2]);
    if (start > end) start = Date.UTC(new Date(end).getUTCFullYear() - 1, m1, +m[2]);
    return { dateStart: iso(start), date: iso(end), phrase: m[0] };
  }
  // "from 4 to 10 October"
  m = text.match(new RegExp(`(?:from|between)\\s+(\\d{1,2})\\s+(?:(${M})\\s+)?(?:to|and|–|-)\\s+(\\d{1,2})\\s+(${M})\\b`, "i"));
  if (m) {
    const m2 = MONTHS.indexOf(m[4].toLowerCase()), m1 = m[2] ? MONTHS.indexOf(m[2].toLowerCase()) : m2;
    const end = day(yr, m2, +m[3]);
    let start = Date.UTC(new Date(end).getUTCFullYear(), m1, +m[1]);
    if (start > end) start = Date.UTC(new Date(end).getUTCFullYear() - 1, m1, +m[1]);
    return { dateStart: iso(start), date: iso(end), phrase: m[0] };
  }
  // "surveyed from Tuesday to Saturday of last week": the latest such days
  // before the article's own day, only when the sentence is about the survey
  m = text.match(new RegExp(`(?:surveyed|conducted|polled|in the field)\\s+(?:\\w+\\s+){0,4}?(?:from|between)\\s+(${W})\\s+(?:to|and)\\s+(${W})\\b`, "i"));
  if (m) {
    const ws = WEEKDAYS.indexOf(m[1].toLowerCase()), we = WEEKDAYS.indexOf(m[2].toLowerCase());
    let end = t0 - DAY;
    while (new Date(end).getUTCDay() !== we) end -= DAY;
    let start = end;
    while (new Date(start).getUTCDay() !== ws) start -= DAY;
    return { dateStart: iso(start), date: iso(end), phrase: m[0] };
  }
  return null;
}

// an exact sample beside the survey wording ("surveyed 2250 voters", "the
// 2250 voters Resolve Political Monitor surveyed"); "more than 2200" is not one
export function sampleOf(text) {
  const pats = [
    /(?<!more than |over |about |around |almost |nearly )\b(\d,?\d{3})\s+(?:voters|respondents|Australians|people)\s+(?:\S+\s+){0,5}?(?:surveyed|polled|were surveyed)/i,
    /\bsurveyed\s+(\d,?\d{3})\s+(?:voters|respondents|Australians|people)/i,
    /\bsample\s+of\s+(\d,?\d{3})\b/i,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) return +m[1].replace(",", "");
  }
  return null;
}

// ---- leadership: what the payload lacks ---------------------------------
// data.json carries Albanese's and the opposition leader's performance
// (good/poor) but neither Hanson's performance (asked since the 6–11 Jul 2026
// wave) nor anyone's net likeability (2026-10-11 audit, user: "resolve
// publishes likeability … but this is not recorded because it's not in the
// interactive data file"). Both come from the story: its Datawrapper tables
// first (a Good/Undecided/Poor table by leader; a NET LIKEABILITY table by
// month), else the prose. A prose likeability figure is filed only when its
// own sentence says likeability, its clause names exactly one tracked leader,
// and either the clause states no earlier figure or the earlier figure it
// states ("fell from 7 points to zero", "fell 2 points to 8", "improved by 1
// point to minus 15") is the previous wave's — a misread can't reconcile.
export const LEADERS = { alb: /\bAlbanese/, opp: /\bTaylor/, han: /\bHanson/ };
const WORDNUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const NUM = String.raw`(minus\s+|plus\s+|[-−–+]\s?)?(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b`;
const val = (sign, n) => (WORDNUM[n?.toLowerCase()] ?? +n) * (/^(minus|[-−–])/i.test(sign || "") ? -1 : 1);

// tab-separated Datawrapper dataset.csv -> {head: [...], rows: [[label, ...cells]]}
export const dwTable = (tsv) => {
  const lines = tsv.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const cells = lines.map((l) => l.split("\t").map((c) => c.replace(/<[^>]+>/g, "").trim()));
  return { head: cells[0] || [], rows: cells.slice(1) };
};
const pct = (c) => (c == null || c === "" || isNaN(parseFloat(c)) ? null : Math.round(parseFloat(c)));

// a Good / Undecided / Poor table with leaders as columns -> {lk: {app, dis}}
export function perfOf(t) {
  const out = {};
  const good = t.rows.find((r) => /^(total\s+)?good$/i.test(r[0])), poor = t.rows.find((r) => /^(total\s+)?poor$/i.test(r[0]));
  if (!good || !poor) return out;
  t.head.forEach((h, i) => {
    for (const [lk, re] of Object.entries(LEADERS))
      if (i > 0 && re.test(h) && pct(good[i]) != null && pct(poor[i]) != null) out[lk] = { app: pct(good[i]), dis: pct(poor[i]) };
  });
  return out;
}

// a NET LIKEABILITY table, leaders as rows, months as columns: the last column
// is this wave, and only when its header names the wave's month
export function likeTableOf(t, waveDay) {
  if (!/likeab/i.test(t.head[0] || "")) return {};
  const last = t.head.length - 1, mon = new Date(waveDay).toLocaleString("en-AU", { month: "short", timeZone: "UTC" });
  if (!new RegExp(`^${mon}`, "i").test(t.head[last])) return {};
  const out = {};
  for (const r of t.rows) for (const [lk, re] of Object.entries(LEADERS)) if (re.test(r[0]) && pct(r[last]) != null) out[lk] = pct(r[last]);
  return out;
}

// prose likeability, reconciled against prev ({lk: previous wave's net})
export function likeProseOf(text, prev = {}) {
  const ok = {}, refused = [];
  for (const sent of text.split(/(?<=[.”])\s+/)) {
    if (!/likeab/i.test(sent)) continue;
    for (const clause of sent.split(/,?\s+(?:while|whereas|but|and)\s+|;\s*/)) {
      const who = Object.entries(LEADERS).filter(([, re]) => re.test(clause)).map(([lk]) => lk);
      if (who.length !== 1) continue;
      const lk = who[0];
      let v = null, from = null, m;
      if ((m = clause.match(new RegExp(String.raw`\bfrom\s+${NUM}(?:\s+points?)?\s+to\s+${NUM}`, "i")))) {
        from = val(m[1], m[2]); v = val(m[3], m[4]);
      } else if ((m = clause.match(new RegExp(String.raw`\b(fell|fallen|dropped|slid|slipped|declined|down|rose|risen|improved|increased|lifted|climbed|up|gained)\s+(?:by\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:percentage\s+)?points?\s+to\s+${NUM}`, "i")))) {
        v = val(m[3], m[4]);
        const d = WORDNUM[m[2].toLowerCase()] ?? +m[2];
        from = /^(fell|fallen|dropped|slid|slipped|declined|down)/i.test(m[1]) ? v + d : v - d;
      } else if (/likeab/i.test(clause) && (m = clause.match(new RegExp(String.raw`\b(?:on|at|of|was|is|to)\s+${NUM}(?!\s*(?:per\s+cent\s+of|%\s+of))`, "i")))) {
        v = val(m[1], m[2]);
        const c = clause.match(/\b(\d{1,2}|one|two|three|four|five)\s+(?:percentage\s+)?points?\s+(improvement|rise|gain|fall|drop|decline)\s+on\s+last\s+month/i);
        if (c) { const d = WORDNUM[c[1].toLowerCase()] ?? +c[1]; from = /improvement|rise|gain/i.test(c[2]) ? v - d : v + d; }
      }
      if (v == null || ok[lk] != null) continue;
      if (from != null && prev[lk] != null && from !== prev[lk]) { refused.push(`${lk}: "${clause.trim()}" gives last month ${from}, the previous wave has ${prev[lk]}`); continue; }
      ok[lk] = v;
    }
  }
  return { ok, refused };
}

// federal Resolve stories on the topic page, by URL slug day
export function storiesOf(topicHtml) {
  const seen = new Set(), out = [];
  for (const m of topicHtml.matchAll(/href="(\/politics\/federal\/[a-z0-9-]+-(\d{4})(\d{2})(\d{2})-p[0-9a-z]+\.html)"/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ url: ORIGIN + m[1], day: `${m[2]}-${m[3]}-${m[4]}` });
  }
  return out;
}

async function main() {
  const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
  const todo = D.polls.filter((p) => p.pollster === "Resolve" && p.assimilated && (p.fieldworkPending || !p.dateStart)
    && Date.parse(p.date) >= Date.parse("2026-09-01"));
  // the newest wave's leadership, for a fortnight after release: Hanson's
  // performance and the likeability nets the payload doesn't carry
  const appr = D.approval.filter((a) => a.firm === "Resolve").sort((a, b) => a.date.localeCompare(b.date));
  const lastA = appr.at(-1), lastP = D.polls.filter((p) => p.pollster === "Resolve").at(-1);
  const lead = lastA && lastP && lastA.date === lastP.date && lastA.date >= "2026-10-01"
    && Date.now() - Date.parse(lastP.published ?? lastP.date) < 14 * DAY
    && !(lastA.detail?.han && ["alb", "opp", "han"].every((k) => lastA.detail?.fav?.[k] != null)) ? lastA : null;
  const status = { stamped: [], pending: [], leaders: [], warnings: [] };
  if (!todo.length && !lead) { console.log("RESOLVE_READ_STATUS " + JSON.stringify(status)); return; }

  const stories = storiesOf(await get(TOPIC));
  const dwCache = new Map();
  const readDay = async (pubDay) => {
    const read = [];
    for (const s of stories.filter((x) => x.day === pubDay)) {
      try {
        const html = await get(s.url);
        const text = textOf(html);
        if (!/Resolve Political Monitor/i.test(text)) continue;
        const pub = publishedOf(html);
        const dws = [...new Set(html.match(/datawrapper\.dwcdn\.net\/[A-Za-z0-9]+\/\d+/g) || [])];
        read.push({ ...s, pub, text, dws, win: windowOf(text, pubDay), n: sampleOf(text) });
      } catch (e) { status.warnings.push(`${s.url}: ${e.message}`); }
    }
    return read;
  };
  let changed = false;
  for (const row of todo) {
    // the published day: the row's own stamp, else the csv day (date + 1)
    const pubDay = (row.published ?? iso(Date.parse(row.date) + DAY)).slice(0, 10);
    const cands = stories.filter((s) => s.day === pubDay);
    const read = await readDay(pubDay);
    const withWin = read.filter((r) => r.win && r.pub).sort((a, b) => a.pub.localeCompare(b.pub));
    if (!withWin.length) {
      status.pending.push({ date: row.date, pubDay, stories: cands.length, read: read.length });
      // the article lands by release night; a pending row two days on is a miss
      if (Date.now() - Date.parse(pubDay) > 2 * DAY)
        status.warnings.push(`Resolve ${row.date}: no SMH story dated ${pubDay} states the fieldwork window (${cands.length} candidate(s) on the topic page)`);
      continue;
    }
    const src = withWin[0];
    const first = read.filter((r) => r.pub).sort((a, b) => a.pub.localeCompare(b.pub))[0];
    const shift = (Date.parse(src.win.date) - Date.parse(row.date)) / DAY;
    if (Math.abs(shift) > 3) {
      status.warnings.push(`Resolve ${row.date}: article window ${src.win.dateStart}–${src.win.date} ("${src.win.phrase}") is ${shift} days off the wave's placing; not stamped`);
      status.pending.push({ date: row.date, pubDay, refused: src.win.phrase });
      continue;
    }
    const was = row.date;
    if (shift) {
      for (const k of ["ppm", "approval"])
        for (const r of D[k]) if (r.firm === "Resolve" && r.date === was) r.date = src.win.date;
      row.date = src.win.date;
    }
    // the hand-stamped rows' key order: date, published, dateStart, pollster…
    const { date, published, fieldworkPending, dateStart, ...rest } = row;
    const stamped = { date, published: sydney(first.pub), dateStart: src.win.dateStart, ...rest };
    stamped.url = src.url;
    if (src.n) stamped.sample = src.n;
    for (const k of Object.keys(row)) delete row[k];
    Object.assign(row, stamped);
    changed = true;
    status.stamped.push({ date: row.date, was: shift ? was : undefined, dateStart: row.dateStart, published: row.published,
      sample: src.n, url: src.url, phrase: src.win.phrase });
  }
  if (lead) {
    const vi = D.polls.find((p) => p.pollster === "Resolve" && p.date === lead.date);
    const pubDay = (vi.published ?? iso(Date.parse(lead.date) + DAY)).slice(0, 10);
    const read = (await readDay(pubDay)).sort((a, b) => (a.pub || "").localeCompare(b.pub || ""));
    const perf = {}, likeT = {};
    for (const r of read) for (const id of r.dws) {
      try {
        if (!dwCache.has(id)) dwCache.set(id, dwTable(await get(`https://${id}/dataset.csv`)));
        const t = dwCache.get(id);
        for (const [k, v] of Object.entries(perfOf(t))) perf[k] ??= v;
        for (const [k, v] of Object.entries(likeTableOf(t, lead.date))) likeT[k] ??= v;
      } catch (e) { status.warnings.push(`${id}: ${e.message}`); }
    }
    // the previous wave's likeability, Hanson's in her pre-July slot too
    const prevA = appr.at(-2);
    const prev = Object.fromEntries(["alb", "opp", "han"].map((k) => [k,
      prevA?.detail?.fav?.[k] ?? (k === "han" && prevA && prevA.date < "2026-07-06" ? prevA.han : null)]));
    if (prevA && prevA.oppName !== lead.oppName) prev.opp = null;
    const prose = {};
    for (const r of read) {
      const { ok, refused } = likeProseOf(r.text, prev);
      for (const [k, v] of Object.entries(ok)) prose[k] ??= v;
      for (const x of refused) status.warnings.push(`Resolve ${lead.date} likeability refused — ${x}`);
    }
    const fav = { ...prose, ...likeT };
    const det = lead.detail ?? {};
    const did = {};
    // the payload's own splits stand; a disagreeing table is reported, never filed
    for (const k of ["alb", "opp"])
      if (perf[k] && det[k] && (perf[k].app !== det[k].app || perf[k].dis !== det[k].dis))
        status.warnings.push(`Resolve ${lead.date} ${k} performance: story table ${perf[k].app}/${perf[k].dis}, payload ${det[k].app}/${det[k].dis}`);
    if (perf.han && !det.han) { det.han = perf.han; lead.han = perf.han.app - perf.han.dis; did.han = det.han; }
    for (const [k, v] of Object.entries(fav)) {
      if (det.fav?.[k] != null) continue;
      (det.fav ??= {})[k] = v; (did.fav ??= {})[k] = v;
    }
    if (Object.keys(did).length) {
      // detail's key order: alb, opp, han, fav
      if (det.fav) det.fav = Object.fromEntries(["alb", "opp", "han"].filter((k) => det.fav[k] != null).map((k) => [k, det.fav[k]]));
      lead.detail = Object.fromEntries(["alb", "opp", "han", "fav"].filter((k) => det[k]).map((k) => [k, det[k]]));
      changed = true;
      status.leaders.push({ date: lead.date, ...did, from: { table: Object.keys(likeT), prose: Object.keys(prose).filter((k) => !(k in likeT)) } });
    }
  }
  if (changed && APPLY) {
    // keep the archive in date order after a re-date
    D.polls.sort((a, b) => a.date.localeCompare(b.date));
    writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  }
  console.log("RESOLVE_READ_STATUS " + JSON.stringify({ ...status, applied: APPLY && changed }));
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => {
  console.log("RESOLVE_READ_STATUS " + JSON.stringify({ stamped: [], pending: [], warnings: [`read failed: ${e.message}`] }));
  process.exit(1);
});
