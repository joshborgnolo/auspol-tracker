// Newspoll article reading: Matilda cites, this module verifies.
//
// WHY: The Australian's Newspoll story states every figure in prose, and the
// regex parser in extract-newspoll.mjs pairs them up wrongly once a story
// juggles three leaders and two preferred-PM contests. On the 2026-09-17
// wave it read "down from 37 per cent in September last year" as a 37/63
// 2PP (Newspoll had suspended its 2PP), gave Hanson's 44/51 to Taylor,
// took the three-way 44/24 for the head-to-head and found Hanson's net as
// both -7 and -15 — the run guarded and the wave was entered by hand.
//
// HOW: the article is split into paragraphs; Matilda (newspoll-read-prompt.md)
// answers, per figure, the paragraph and the exact words that state it.
// Nothing Matilda says is kept unless this module can re-read it:
//   1. the quote is a verbatim run of the cited paragraph;
//   2. the figure is among the quote's numbers (digits or words, signed for
//      nets: "minus seven");
//   3. the quote names what the figure measures (party, leader, contest —
//      LEX below); a primary quote about who "handles" an issue is refused;
//   4. an earlier figure the sentence gives ("fell from 29 per cent to 27",
//      "remained at 30", "fell a point to 29") must equal the previous
//      committed wave — a mismatch means the sentence is about some other
//      comparison, and the figure is refused;
//   5. each leader's satisfied − dissatisfied must equal the net (±1) when
//      all three were read, and the PPM contests must sum to ≤100 — else the
//      leader's / contest's figures are all refused.
// The caller (extract-newspoll.mjs) then merges the verified record with
// the other outlets and Infogram exactly as before, so its sum, range and
// cross-source conflict guards still stand behind all of this.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { askMatildaJson } from "./matilda-json.mjs";

const PROMPT = ".build/newspoll-read-prompt.md";
export const NP_READ_FIELDS = ["alp", "lnp", "grn", "onp", "ind", "oth", "tpp_alp",
  "pmApp", "pmDis", "pmNet", "oppApp", "oppDis", "oppNet", "hanApp", "hanDis", "hanNet",
  "ppmA", "ppmO", "ppm3A", "ppm3O", "ppm3H"];
const NETS = new Set(["pmNet", "oppNet", "hanNet"]);

// ------------------------------------------------------------- text
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"').replace(/&rsquo;|&lsquo;/gi, "'").replace(/&ldquo;|&rdquo;/gi, '"')
  .replace(/&mdash;/gi, "—").replace(/&ndash;/gi, "–");
// one form for both sides of the verbatim check: soft hyphens (News Corp
// sprinkles U+00AD through words: "Mr ­Albanese"), curly quotes, odd spaces
export const norm = (s) => decode(s).replace(/­/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();

export function paragraphsOf(html, lead = []) {
  const out = [], seen = new Set();
  for (const t of [...lead, ...[...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1])]) {
    const p = norm(String(t ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
    if (p.length < 30 || p.length > 1500 || /[{}]|=>|function\s*\(/.test(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= 60) break;
  }
  return out;
}

const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// every number a quote states, with its sign: "minus 27" / "-27" / "minus
// seven" are negative; "twenty-one" is 21; a hyphen inside a word
// ("two-party", "one-on-one") is not a minus
export function numbersIn(quote) {
  const q = norm(quote).toLowerCase().replace(/[−–]/g, "-");
  const out = [];
  let prevWord = null;
  for (const m of q.matchAll(/[+-]?\d+(?:\.\d+)?|[a-z]+(?:-[a-z]+)?/g)) {
    let tok = m[0], neg = false;
    if (/^[+-]/.test(tok)) {
      // a sign only after a space, bracket or the start: "52-48" is a pair
      if (m.index === 0 || /[\s(]/.test(q[m.index - 1])) neg = tok[0] === "-";
      tok = tok.slice(1);
    }
    if (prevWord === "minus" || prevWord === "negative") neg = true;
    let v;
    if (/^\d/.test(tok)) { v = +tok; prevWord = null; }
    else {
      prevWord = tok;
      const [a, b] = tok.split("-");
      if (WORDS[a] == null) continue;
      // "twenty-one" is 21; any other hyphenated pair ("one-on-one") counts
      // its first word only
      const compound = b != null && WORDS[a] >= 20 && WORDS[a] % 10 === 0 && WORDS[b] >= 1 && WORDS[b] <= 9;
      v = WORDS[a] + (compound ? WORDS[b] : 0);
    }
    out.push({ v: neg ? -v : v, neg });
  }
  return out;
}

// what a quote must name for each figure (all must match)
function lex(field, era) {
  const pm = /\b(albanese|prime minister|pm)\b/i;
  const opp = new RegExp(`\\b(${era.opp}|opposition leader)\\b`, "i");
  const han = new RegExp(`\\b(${era.third}|one nation leader)\\b`, "i");
  const sat = /satisf|approv|rating|performance|net\b/i;
  const better = /better|preferred|prime minister|\bpm\b|contest|head-to-head|one-on-one/i;
  return {
    alp: [/\b(labor|alp|albanese government)\b/i], lnp: [/\b(coalition|liberals?|lnp|nationals)\b/i], grn: [/\bgreens\b/i],
    onp: [/\bone nation\b/i], ind: [/\b(others?|independents?)\b/i], oth: [/\bothers?\b|\bminor\b/i],
    tpp_alp: [/two[- ]party|\b2pp\b/i],
    pmApp: [pm, sat], pmDis: [pm, sat], pmNet: [pm, sat],
    oppApp: [opp, sat], oppDis: [opp, sat], oppNet: [opp, sat],
    hanApp: [han, sat], hanDis: [han, sat], hanNet: [han, sat],
    ppmA: [better], ppmO: [better], ppm3A: [better], ppm3O: [better], ppm3H: [better, han],
  }[field];
}
// does the quote's own change phrase take `from` to `value`? "fell a point
// to 29" (30 → 29), "up two points to 11", "remained at 30" (30 → 30)
function changeImplies(quote, value, from) {
  const q = norm(quote).toLowerCase();
  if (from === value) return /\b(remain(?:s|ed)?|stay(?:s|ed)?|steady|unchanged|static|held|holds?|flat)\b/.test(q);
  const m = q.match(/\b(a|one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+(?:percentage\s+)?points?\b/);
  if (!m) return false;
  const size = m[1] === "a" ? 1 : WORDS[m[1]] ?? +m[1];
  const down = /\b(fell|fall(?:s|ing)?|drop(?:s|ped|ping)?|down|slid|slip(?:s|ped)?|lost|los(?:es|ing)|declin\w*|dipp?\w*|eased|shed)\b/.test(q);
  const up = /\b(rose|ris(?:es|ing)|up|gain\w*|climb\w*|jump\w*|lift\w*|increas\w*|grew|improv\w*|edged up)\b/.test(q);
  if (down === up) return false;
  return Math.abs((value - from) - (down ? -size : size)) < 0.05;
}

// the sentence(s) of `para` that hold `quote` (quote is verbatim in para)
function sentenceAround(para, quote) {
  const i = para.indexOf(quote), j = i + quote.length;
  const bounds = [0, ...[...para.matchAll(/[.!?]["']?\s+/g)].map((m) => m.index + m[0].length), para.length];
  const start = Math.max(...bounds.filter((b) => b <= i));
  const end = Math.min(...bounds.filter((b) => b >= j));
  const prevStart = Math.max(...bounds.filter((b) => b < start), 0);
  return { ctx: para.slice(start, end), before: para.slice(prevStart, start) };
}
const PRIMARY = new Set(["alp", "lnp", "grn", "onp", "ind", "oth"]);
const ISSUE_TALK = /\b(handle|handling|manage|management|trust(?:ed)?|best party|better party|issues?)\b/i;

// --------------------------------------------------------------- verify
// `prev`: the previous committed Newspoll's figure per field (null where
// unknown); `era`: { pm, opp, third } surnames.
export function verifyReading(reading, paras, prev, era) {
  const verdict = {}, ok = {};
  if (!reading || reading.scope !== "newspoll") return { scope: reading?.scope ?? "none", ok, verdict };
  const normParas = paras.map((p) => norm(p));
  for (const f of NP_READ_FIELDS) {
    const c = reading.fields?.[f];
    if (!c) { verdict[f] = "not stated"; continue; }
    const para = normParas[c.para];
    const quote = norm(String(c.quote ?? ""));
    const value = typeof c.value === "number" ? c.value : NaN;
    if (para == null) { verdict[f] = `cited paragraph ${c.para} does not exist`; continue; }
    if (!quote || !para.includes(quote)) { verdict[f] = `quote is not verbatim in paragraph ${c.para}`; continue; }
    const nums = numbersIn(quote);
    const hit = NETS.has(f)
      ? nums.some((n) => n.v === value && (value >= 0 ? !n.neg : true))
      : nums.some((n) => !n.neg && n.v === value);
    if (!Number.isFinite(value) || !hit) { verdict[f] = `quote does not state ${c.value}`; continue; }
    // what the figure measures is checked on the sentence(s) holding the
    // quote: Matilda quotes tightly ("62 per cent dissatisfied") and the
    // sentence is where the leader or contest is named
    const { ctx, before } = sentenceAround(para, quote);
    // a pronoun's antecedent ("Its primary vote now stands at 29 per cent",
    // "giving him a net approval rating of zero") sits one sentence back
    const miss = lex(f, era).find((re) => !re.test(ctx) && !re.test(before + " " + ctx));
    if (miss) { verdict[f] = `sentence does not name what ${f} measures (${miss})`; continue; }
    if (PRIMARY.has(f) && ISSUE_TALK.test(ctx)) { verdict[f] = "sentence is about issue ratings, not the vote"; continue; }
    if ((f === "ppmA" || f === "ppmO") && /three-way|three way|three-cornered/i.test(ctx)) { verdict[f] = "two-way PPM cited from the three-way contest"; continue; }
    // the earlier figure is in the quote, or follows from a change the quote
    // states ("fell a point to 29 per cent", "remains at 28"); either way it
    // must be the previous Newspoll's, else the sentence is about some other
    // comparison (April 2026: "slid from a historic high of 27 per cent in
    // February") and the figure is refused
    if (typeof c.from === "number" && prev?.[f] != null) {
      if (!nums.some((n) => n.v === c.from) && !changeImplies(quote, value, c.from)) { verdict[f] = `earlier figure ${c.from} is neither in the quote nor implied by it`; continue; }
      if (Math.abs(c.from - prev[f]) > 0.5) { verdict[f] = `REJECTED: the sentence's earlier figure ${c.from} is not the previous Newspoll's ${prev[f]}`; continue; }
      ok[f] = value; verdict[f] = "quoted; earlier figure matches the previous Newspoll";
      continue;
    }
    ok[f] = value; verdict[f] = "quoted";
  }
  // satisfied − dissatisfied = net, per leader
  for (const [a, d, n] of [["pmApp", "pmDis", "pmNet"], ["oppApp", "oppDis", "oppNet"], ["hanApp", "hanDis", "hanNet"]]) {
    if (ok[a] == null || ok[d] == null) continue;
    const bad = ok[a] + ok[d] > 100.5 || (ok[n] != null && Math.abs(ok[a] - ok[d] - ok[n]) > 1);
    if (!bad) continue;
    const why = `REJECTED: satisfied ${ok[a]} − dissatisfied ${ok[d]} ≠ net ${ok[n] ?? "?"} (or Σ > 100)`;
    for (const k of [a, d, n]) if (ok[k] != null) { delete ok[k]; verdict[k] = why; }
  }
  // Newspoll's net is satisfied − dissatisfied: when the story gives the pair
  // but not the net (Ley, Jul 2025: 35/42), the net follows
  for (const [a, d, n] of [["pmApp", "pmDis", "pmNet"], ["oppApp", "oppDis", "oppNet"], ["hanApp", "hanDis", "hanNet"]])
    if (ok[n] == null && ok[a] != null && ok[d] != null) { ok[n] = Math.round((ok[a] - ok[d]) * 10) / 10; verdict[n] = "satisfied − dissatisfied (net not stated)"; }
  for (const set of [["ppmA", "ppmO"], ["ppm3A", "ppm3O", "ppm3H"]]) {
    const vals = set.map((k) => ok[k]).filter((v) => v != null);
    if (vals.reduce((s, v) => s + v, 0) > 100.5)
      for (const k of set) if (ok[k] != null) { delete ok[k]; verdict[k] = "REJECTED: the contest's shares sum past 100"; }
  }
  if (ok.ppmA != null && ok.ppmA === ok.ppm3A && ok.ppmO != null && ok.ppmO === ok.ppm3O)
    for (const k of ["ppmA", "ppmO"]) { delete ok[k]; verdict[k] = "REJECTED: two-way contest identical to the three-way"; }
  if (ok.tpp_alp != null) ok.tpp_lnp = Math.round((100 - ok.tpp_alp) * 10) / 10;
  return { scope: "newspoll", ok, verdict };
}

// ----------------------------------------------------------------- read
// One Matilda reading per article text, cached by URL + text hash so slots
// that meet the same story again don't re-ask.
export function readArticle({ url, paras, era, prev, cacheDir, onNote = () => {} }) {
  const hash = createHash("sha1").update(paras.join("\n")).digest("hex").slice(0, 16);
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const file = cacheDir ? `${cacheDir}/${key}.json` : null;
  let reading = null;
  if (file && existsSync(file)) {
    const c = JSON.parse(readFileSync(file, "utf8"));
    if (c.textHash === hash) reading = c.reading;
  }
  if (!reading) {
    const bundle = { era, paragraphs: paras.map((text, para) => ({ para, text })) };
    const prompt = readFileSync(PROMPT, "utf8") + "\n\n## Evidence bundle (JSON)\n\n```json\n" + JSON.stringify(bundle) + "\n```\n";
    reading = askMatildaJson(prompt, { onRetry: (e) => onNote(`matilda retry after: ${e.message.slice(0, 160)}`) });
    if (file) {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, JSON.stringify({ url, textHash: hash, readAt: new Date().toISOString(), reading }, null, 2) + "\n");
    }
  }
  return { reading, ...verifyReading(reading, paras, prev, era) };
}

// The previous committed Newspoll's figures in reader field names.
export function prevNewspoll(D, before) {
  const p = D.polls.filter((r) => r.pollster === "Newspoll" && r.date < before).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (!p) return {};
  const near = (sec) => (D[sec] ?? []).find((r) => r.firm === "Newspoll" && r.date === p.date);
  const ap = near("approval"), pp = near("ppm");
  const threeWay = pp && pp.han != null && Array.isArray(pp.extra) && pp.extra.length;
  return {
    date: p.date, alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, ind: p.ind, oth: p.oth, tpp_alp: p.tpp_alp,
    pmNet: ap?.alb, oppNet: ap?.opp, hanNet: ap?.han,
    pmApp: ap?.detail?.alb?.app, pmDis: ap?.detail?.alb?.dis, oppApp: ap?.detail?.opp?.app, oppDis: ap?.detail?.opp?.dis,
    hanApp: ap?.detail?.han?.app, hanDis: ap?.detail?.han?.dis,
    ppm3A: threeWay ? pp.alb : null, ppm3O: threeWay ? pp.opp : null, ppm3H: threeWay ? pp.han : null,
    ppmA: threeWay ? pp.extra[0].alb : pp?.alb, ppmO: threeWay ? pp.extra[0].opp : pp?.opp,
  };
}
