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
//      DemosAU wave: the earlier figure is in the quote, or the quote's own
//      change phrase takes it to the value ("rose two points to 28%"), and it
//      equals that wave's figure. Every primary must reconcile — prose alone
//      never files a figure here.
// All five must verify and sum to ~100, or nothing is filed and the
// hand-entry prompt (exit 3) stands as before. The sample is filed when the
// article states it, else the row is samplePending until the PDF.
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

// "The poll of 1,583 Australians", "a sample of 1,562 voters"
export function sampleOf(text) {
  const m = norm(text).match(/\b(?:poll|survey|sample)\s+of\s+([\d,]{3,6})\s+(?:Australians|voters|respondents|people|adults)\b/i);
  return m ? +m[1].replace(/,/g, "") : null;
}

// prev: the previous committed DemosAU wave's primaries, others as `oth`
export function verifyDemosau(reading, paras, prev) {
  const verdict = {}, ok = {};
  if (!reading || reading.scope !== "demosau") return { scope: reading?.scope ?? "none", ok, verdict };
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
    if (typeof c.from !== "number") { verdict[f] = "REFUSED: no change given — every DemosAU primary must reconcile with the previous wave"; continue; }
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
    if (prev?.[f] == null) { verdict[f] = "REFUSED: no previous DemosAU figure to reconcile with"; continue; }
    if (Math.abs(c.from - prev[f]) > 0.5) { verdict[f] = `REJECTED: the quote's earlier figure ${c.from} is not the previous DemosAU wave's ${prev[f]}`; continue; }
    ok[f] = value; verdict[f] = "quoted; change reconciles with the previous wave";
  }
  return { scope: "demosau", ok, verdict };
}

export function readDemosau({ url, html, prev, cacheDir, onNote = () => {} }) {
  const headline = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ");
  const paras = paragraphsOf(html, [headline]);
  const hash = createHash("sha1").update(paras.join("\n")).digest("hex").slice(0, 16);
  const file = cacheDir ? `${cacheDir}/cb-${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json` : null;
  let reading = null;
  if (file && existsSync(file)) {
    const c = JSON.parse(readFileSync(file, "utf8"));
    if (c.textHash === hash) reading = c.reading;
  }
  if (!reading) {
    const bundle = { paragraphs: paras.map((text, para) => ({ para, text })) };
    const prompt = readFileSync(PROMPT, "utf8") + "\n\n## Evidence bundle (JSON)\n\n```json\n" + JSON.stringify(bundle) + "\n```\n";
    reading = askMatildaJson(prompt, { onRetry: (e) => onNote(`matilda retry after: ${e.message.slice(0, 160)}`) });
    if (file) {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, JSON.stringify({ url, textHash: hash, readAt: new Date().toISOString(), reading }, null, 2) + "\n");
    }
  }
  const v = verifyDemosau(reading, paras, prev);
  const sample = sampleOf(paras.join(" "));
  const vals = DM_FIELDS.map((f) => v.ok[f]);
  const errs = [];
  if (v.scope !== "demosau") errs.push(`not a DemosAU poll article (${v.scope})`);
  const missing = DM_FIELDS.filter((f) => v.ok[f] == null);
  if (missing.length) errs.push(`unverified: ${missing.map((f) => `${f} (${v.verdict[f]})`).join("; ")}`);
  if (vals.every((x) => x != null) && Math.abs(vals.reduce((a, b) => a + b, 0) - 100) > 1.5) errs.push(`primaries sum to ${vals.reduce((a, b) => a + b, 0)}`);
  // no sample in the article: filed samplePending, the PDF supplies n
  if (sample != null && (sample < 500 || sample > 10000)) errs.push(`sample ${sample} implausible`);
  return { reading, ...v, sample, errors: errs };
}
