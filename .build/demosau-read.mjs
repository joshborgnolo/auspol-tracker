// DemosAU wave from the Capital Brief article: Matilda cites, this verifies.
//
// WHY (2026-10-05): Capital Brief publishes the federal Capital Brief/DemosAU
// poll ~18 h before DemosAU posts the methodology PDF that
// extract-demosau.mjs files from (Sep 2026: article 17 Sep 08:30, PDF the
// next day; the wave was hand-entered). The article's free text carries the
// five primaries, each with its change on the previous poll, and the sample —
// everything but the fieldwork dates (its "conducted earlier this week" was
// wrong for September: fieldwork 10–14 Sep, article the 17th). The user's
// call: file from the article as soon as it appears, verified the way the
// Newspoll reader is, with the fieldwork shown as TBC until the PDF.
//
// A figure is kept only if (newspoll-read.mjs's helpers):
//   1. Matilda's quote is verbatim in the cited paragraph;
//   2. the figure is among the quote's numbers;
//   3. the sentence (or the one before) names the party, and is not about
//      who is best to handle an issue;
//   4. the change the quote gives reconciles with the PREVIOUS committed
//      release of the same kind (monthly poll or MRP): the earlier figure is
//      in the quote, or the quote's own change phrase takes it to the value
//      ("rose two points to 28%"), and it equals that release's figure.
//      Every primary must reconcile — prose alone never files a figure here.
// All five must verify and sum to ~100, or nothing is filed and the
// hand-entry prompt (exit 3) stands as before. The sample is filed when the
// article states it, else the row is samplePending until the PDF.
//
// MRP ARTICLES (2026-10-12): Capital Brief runs DemosAU's quarterly MRP in
// the same "Capital Brief / Demos AU Poll" section as the monthly polls, and
// its changes are on the previous MRP ("up one percentage point from the same
// analysis published in July"), not on the latest monthly poll. The 12 Oct
// 2026 MRP (n=9,740, Aug–Sep) was checked against the September poll, all
// four changes were rejected, and every run went red. An article that says
// it is an MRP (MRP_TEXT) is now checked against the previous `DemosAU
// (MRP)` row first and files as one, its window the fieldwork months the
// article states (fieldworkOf). The window matters: a model whose window
// contains the monthly polls is taken to reuse their respondents and stays
// out of the aggregates (gen-data reusesWaves), and the 4-day provisional
// window a monthly poll gets would count it in them. No months, no filing.
//
// FOLLOW-UPS: Capital Brief runs more pieces on a poll in the days after it,
// in the same section (data centres 1–2 days after the Aug 2026 poll, "Money
// talks" the day after the Jul 2026 MRP, the Canavan piece the same day as
// the Mar 2026 one). Within FOLLOWUP_DAYS of the newest release on file, a
// piece that states no poll figures, or only figures already on file, is set
// aside: there is nothing to hand-enter, so it raises no prompt.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { norm, numbersIn, paragraphsOf, changeImplies, sentenceAround, ISSUE_TALK } from "./newspoll-read.mjs";
import { askMatildaJson } from "./matilda-json.mjs";

const PROMPT = ".build/demosau-read-prompt.md";
export const DM_FIELDS = ["alp", "lnp", "grn", "onp", "oth"];
const LEX = {
  alp: /\b(labor|alp|albanese government)\b/i, lnp: /\b(coalition|liberals?|lnp|nationals)\b/i,
  grn: /\bgreens\b/i, onp: /\bone nation\b/i, oth: /\b(others?|independents?)\b/i,
};
export const CB_FIELD_LAG = 4;  // provisional fieldwork end: days before the article
export const CB_FIELD_SPAN = 4; // ...and its length (Jul–Sep 2026: 3–5 / 2–5 days)
// follow-ups ran 0–3 days after their poll in 2026; releases were 14+ days apart
export const FOLLOWUP_DAYS = 7;
export const MRP_TEXT = /\bMRP\b|multi-?level regression/i;

const DAY = 86400000;
const shiftDay = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// "The poll of 1,583 Australians", "a sample of 1,562 voters", the MRPs'
// "polling of 9,740 Australian voters" / "surveyed 9343 people" /
// "interviewed 6928 voters" ("more than 9,000 Australians" is no sample)
export function sampleOf(text) {
  const m = norm(text).match(/\b(?:(?:poll(?:ing)?|survey|sample)\s+of|surveyed|interviewed|polled)\s+([\d,]{3,6})\s+(?:Australian\s+)?(?:Australians|voters|respondents|people|adults)\b/i);
  return m ? +m[1].replace(/,/g, "") : null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = `(${MONTHS.join("|")})`;
const FIELD_RE = new RegExp(`\\b(?:conducted|surveyed|interviewed|polled|polling|fieldwork|carried out)\\b[^.]{0,80}?`
  + `\\b(?:in|during|between|from|over)\\s+(?:in\\s+)?${MON}(?:\\s+(\\d{1,2})(?!\\d))?(?:,?\\s+(\\d{4}))?`
  + `\\s+(?:and|to|through|until|-|–)\\s+${MON}(?:\\s+(\\d{1,2})(?!\\d))?(?:,?\\s+(\\d{4}))?`, "i");
// The fieldwork an MRP article states — "conducted in August and September"
// (Oct 2026), "between May and July 2026" (Jul), "between in October 5 and
// November 11" (Dec 2025) — as { dateStart, date, exact }. Whole months run
// from the 1st to the month's end, never past the day before publication;
// stated days are exact. A month after the publication month is last year's.
export function fieldworkOf(text, pubDay) {
  const m = norm(String(text ?? "")).match(FIELD_RE);
  if (!m) return null;
  const [, mon1, d1, y1s, mon2, d2, y2s] = m;
  const m1 = MONTHS.indexOf(mon1.toLowerCase()), m2 = MONTHS.indexOf(mon2.toLowerCase());
  const pubY = +pubDay.slice(0, 4), pubM = +pubDay.slice(5, 7) - 1;
  const y2 = y2s ? +y2s : y1s && m1 <= m2 ? +y1s : m2 > pubM ? pubY - 1 : pubY;
  const y1 = y1s ? +y1s : m1 > m2 ? y2 - 1 : y2;
  const iso = (y, mo, d) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dateStart = iso(y1, m1, d1 ? +d1 : 1);
  let date = iso(y2, m2, d2 ? +d2 : new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate());
  if (date >= pubDay) date = shiftDay(pubDay, -1);
  return { dateStart, date, exact: !!(d1 && d2) };
}

// prev: the previous committed release's primaries, others as `oth`; kind
// names it ("wave", "MRP"). `cited` holds every figure whose quote passed
// the citation checks, before any change is reconciled.
export function verifyDemosau(reading, paras, prev, kind = "wave") {
  const verdict = {}, ok = {}, cited = {};
  if (!reading || reading.scope !== "demosau") return { scope: reading?.scope ?? "none", ok, verdict, cited };
  const P = paras.map(norm);
  for (const f of DM_FIELDS) {
    const c = reading.fields?.[f];
    if (!c) { verdict[f] = "not stated"; continue; }
    const para = P[c.para], quote = norm(String(c.quote ?? "")), value = c.value;
    if (para == null) { verdict[f] = `cited paragraph ${c.para} does not exist`; continue; }
    if (!quote || !para.includes(quote)) { verdict[f] = `quote is not verbatim in paragraph ${c.para}`; continue; }
    const nums = numbersIn(quote);
    if (typeof value !== "number" || !nums.some((n) => !n.neg && n.v === value)) { verdict[f] = `quote does not state ${value}`; continue; }
    const { ctx, before } = sentenceAround(para, quote);
    if (!LEX[f].test(ctx) && !LEX[f].test(before + " " + ctx)) { verdict[f] = `sentence does not name ${f}`; continue; }
    if (ISSUE_TALK.test(ctx)) { verdict[f] = "sentence is about issue ratings, not the vote"; continue; }
    cited[f] = value;
    if (typeof c.from !== "number") { verdict[f] = `REFUSED: no change given — every DemosAU primary must reconcile with the previous ${kind}`; continue; }
    let implied = nums.some((n) => n.v === c.from) || changeImplies(quote, value, c.from);
    // the change stated in another sentence (Aug 2026: "One Nation was close
    // behind on 24%" … "its support tumbled five percentage points"): a second
    // verbatim quote whose sentence names the party and whose change phrase
    // takes the earlier figure to the value
    if (!implied && c.changeQuote) {
      const cp = P[c.changeQuote.para], cq = norm(String(c.changeQuote.quote ?? ""));
      if (cp != null && cq && cp.includes(cq)) {
        const s2 = sentenceAround(cp, cq);
        implied = (LEX[f].test(s2.ctx) || LEX[f].test(s2.before + " " + s2.ctx)) && !ISSUE_TALK.test(s2.ctx)
          && (numbersIn(cq).some((n) => n.v === c.from) || changeImplies(cq, value, c.from));
      }
    }
    if (!implied) { verdict[f] = `REFUSED: earlier figure ${c.from} is neither in the quote nor implied by it`; continue; }
    if (prev?.[f] == null) { verdict[f] = `REFUSED: no previous DemosAU ${kind} figure to reconcile with`; continue; }
    if (Math.abs(c.from - prev[f]) > 0.5) { verdict[f] = `REJECTED: the quote's earlier figure ${c.from} is not the previous DemosAU ${kind}'s ${prev[f]}`; continue; }
    ok[f] = value; verdict[f] = `quoted; change reconciles with the previous ${kind}`;
  }
  return { scope: "demosau", ok, verdict, cited };
}

// Matilda's citations for one article, cached per URL. The cache holds while
// the prompt and the article's own text (`textKey`: its free text, JSON-LD
// articleBody) are unchanged; the page's "More in Politics" teasers change
// daily and would otherwise void it.
export function readDemosau({ url, html, textKey, cacheDir, onNote = () => {} }) {
  const headline = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ");
  const paras = paragraphsOf(html, [headline]);
  const prompt = readFileSync(PROMPT, "utf8");
  const hash = createHash("sha1").update(prompt).update("\n").update(textKey || paras.join("\n")).digest("hex").slice(0, 16);
  const file = cacheDir ? `${cacheDir}/cb-${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json` : null;
  let reading = null;
  if (file && existsSync(file)) {
    const c = JSON.parse(readFileSync(file, "utf8"));
    if (c.textHash === hash) reading = c.reading;
  }
  if (!reading) {
    const bundle = { paragraphs: paras.map((text, para) => ({ para, text })) };
    reading = askMatildaJson(prompt + "\n\n## Evidence bundle (JSON)\n\n```json\n" + JSON.stringify(bundle) + "\n```\n",
      { onRetry: (e) => onNote(`matilda retry after: ${e.message.slice(0, 160)}`) });
    if (file) {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, JSON.stringify({ url, textHash: hash, readAt: new Date().toISOString(), reading }, null, 2) + "\n");
    }
  }
  return { reading, paras };
}

// the reading as a filing of one kind of release: verified primaries plus
// every reason it can't file
function filingCheck(reading, paras, prev, kind, sample) {
  const v = verifyDemosau(reading, paras, prev, kind);
  const errs = [];
  if (v.scope !== "demosau") errs.push(`not a DemosAU poll article (${v.scope})`);
  const missing = DM_FIELDS.filter((f) => v.ok[f] == null);
  if (missing.length) errs.push(`unverified: ${missing.map((f) => `${f} (${v.verdict[f]})`).join("; ")}`);
  const vals = DM_FIELDS.map((f) => v.ok[f]);
  if (vals.every((x) => x != null) && Math.abs(vals.reduce((a, b) => a + b, 0) - 100) > 1.5) errs.push(`primaries sum to ${vals.reduce((a, b) => a + b, 0)}`);
  // no sample in the article: filed samplePending, the PDF supplies n
  if (sample != null && (sample < 500 || sample > (kind === "MRP" ? 20000 : 10000))) errs.push(`sample ${sample} implausible`);
  return { ...v, errors: errs };
}

const primaries = (r) => r && { alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, oth: r.ind };

// What the Capital Brief watch (extract-demosau.mjs) does with one article
// newer than every DemosAU row: { row } to file, { followUp } to set aside,
// or { prompt } — figures not on file that don't verify: the hand-entry exit 3.
//   art:     { url, published: Sydney "YYYY-MM-DDTHH:MM", freeText: articleBody }
//   rows:    data/polls.json's polls
//   lastDay: the newest DemosAU row's date/published day (the watch's anchor)
export function planCapitalBrief({ reading, paras, art, rows, lastDay }) {
  const day = art.published.slice(0, 10);
  const freeText = art.freeText || paras.join(" ");
  const sample = sampleOf(freeText);
  const latest = (pollster) => rows.filter((r) => r.pollster === pollster).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  const prevWave = latest("DemosAU"), prevMrp = latest("DemosAU (MRP)");
  const tries = MRP_TEXT.test(freeText) ? [["MRP", prevMrp], ["wave", prevWave]] : [["wave", prevWave]];
  const checks = tries.map(([kind, prev]) => ({ kind, ...filingCheck(reading, paras, primaries(prev), kind, sample) }));
  const hit = checks.find((c) => !c.errors.length);
  if (hit) {
    const vi = { alp: hit.ok.alp, lnp: hit.ok.lnp, grn: hit.ok.grn, onp: hit.ok.onp, ind: hit.ok.oth, oth: null, tpp_alp: null, tpp_lnp: null };
    const pending = sample == null ? { samplePending: true } : {};
    if (hit.kind === "wave") {
      const date = shiftDay(day, -CB_FIELD_LAG);
      if (rows.some((r) => r.pollster === "DemosAU" && Math.abs(daysBetween(r.date, date)) <= 10))
        return { prompt: `a DemosAU row already sits within 10 days of ${date}` };
      return { row: { date, dateStart: shiftDay(date, -CB_FIELD_SPAN), published: art.published, pollster: "DemosAU",
        client: "Capital Brief", sample, ...vi, url: art.url, fieldworkPending: true, ...pending } };
    }
    const win = fieldworkOf(freeText, day);
    if (!win) return { prompt: "the MRP article states no fieldwork months (its window decides whether it reuses the monthly polls)" };
    const span = daysBetween(win.dateStart, win.date);
    if (span < 1 || span > 120) return { prompt: `MRP fieldwork ${win.dateStart}..${win.date} is outside 1–120 days` };
    if (rows.some((r) => r.pollster === "DemosAU (MRP)" && Math.abs(daysBetween(r.date, win.date)) <= 10))
      return { prompt: `a DemosAU (MRP) row already sits within 10 days of ${win.date}` };
    // client as the MRP reports print it ("Self-initiated"), like the other MRP rows
    return { row: { date: win.date, dateStart: win.dateStart, published: art.published, pollster: "DemosAU (MRP)",
      client: "—", sample, ...vi, url: art.url, ...(win.exact ? {} : { fieldworkPending: true }), ...pending } };
  }
  const first = checks[0];
  const after = lastDay ? daysBetween(lastDay, day) : Infinity;
  if (after <= FOLLOWUP_DAYS) {
    if (first.scope !== "demosau") return { followUp: `states no poll figures, ${after} day(s) after the newest release on file` };
    const cited = Object.entries(first.cited);
    for (const r of [prevWave, prevMrp]) {
      const p = primaries(r);
      if (p && cited.length && cited.every(([f, v]) => p[f] != null && Math.abs(v - p[f]) < 0.05))
        return { followUp: `restates the ${r.date} ${r.pollster} figures already on file (${cited.map(([f, v]) => `${f} ${v}`).join(", ")})` };
    }
  }
  return { prompt: first.errors.join("; ") };
}
