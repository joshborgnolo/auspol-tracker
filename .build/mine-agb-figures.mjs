#!/usr/bin/env node
/* mine-agb-figures.mjs — best-effort parse of vote-figure sentences out of the
   71 AGB McNair mention articles:

     data/agb-mcnair-mentions.csv           article index (mine-agb-mcnair.mjs)
     .matilda/trove-harvest/text/<id>.txt   full OCR text
     → data/agb-mcnair-figures.csv          one row per article, figure columns

     node .build/mine-agb-figures.mjs

   Rows are parsed, not transcribed: verify against the excerpt in the mentions
   CSV before citing. Guards: sentences naming another pollster are excluded;
   issue/approval sentences skip the vote slots; the preferred-PM zone is kept
   out of the primary scan; state-titled rows are noted. Values bind two ways —
   PAIRED ("38 per cent support for the ALP") then LABEL-FIRST ("support for
   Labor was down to 43 per cent", trailing value wins in movement chains).
   "Government" maps to ALP 1990–96; plural "others"/independents/greens → oth. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HARVEST = path.join(ROOT, ".matilda", "trove-harvest");
const MENTIONS = path.join(ROOT, "data", "agb-mcnair-mentions.csv");
const OUT = path.join(ROOT, "data", "agb-mcnair-figures.csv");

const HOUSE = [
  /\ba\.?\s?g\.?\s?b\.?\s*[:\-–]?\s*mcnair/i,
  /\ba\.?\s?g\.?\s?b\.?\s+(poll|survey|research)/i,
  /mcnair\s+(poll|survey)/i,
  /saulwick[^a-zA-Z]{0,30}(a\.?\s?g\.?\s?b\.?|mcnair)/i,
];

const PC = String.raw`(?:per\s*c[a-z]{2,3}t|percent(?:age)?|pc)`; // per cent / per ccnt / percent / pc
const NUM = String.raw`(\d{1,2}(?:\.\d+)?)`;
const PC_RE = new RegExp(PC, "i");
const NUMPC_G = new RegExp(NUM + String.raw`\s*` + PC, "gi");
const NUMPC_1 = new RegExp(NUM + String.raw`\s*` + PC, "i");
const MOVE_RE = new RegExp(
  String.raw`from\s+` + NUM + String.raw`(?:\s*` + PC + String.raw`)?[^.]{0,25}?\bto\s+` + NUM
  + String.raw`|(?:jumped|rose|increased|fell|dropped|slipped|declined|grew|improved|lifted)\s+(?:by\s+)?` + NUM + String.raw`\s*` + PC + String.raw`\s+to\s+` + NUM
, "i");
const BARE_RE = new RegExp(String.raw`\b(?:was|were|is|sat|on|at|to|of|by)\s+` + NUM + String.raw`\s*(?=[.,;:]|$)`);

const PARTIES = [
  ["alp", /\b(?:a\.?\s?l\.?\s?p\.?|labor(?:\s+party)?|government)s?\b/i],
  ["coalition", /\b(?:coalition|liberals?|lib(?:eral)?[-\s/]national(?:\s+part(?:y|ies))?|opposition|conservatives)\b/i],
  ["dem", /\b(?:australian\s+)?democrats\b/i],
  ["oth", /\b(?:others|other\s+part(?:y|ies)|independents?|greens?)\b/i],
  ["und", /\b(?:undecided|uncommitted|don'?t\s+knows?|not\s+committed)\b/i],
];
const TPP_RE = /(?:two[-\s]party|distribution of preferences|after preferences)/i;
const OTHERS_HOUSE = /\b(?:newspoll|morgan|nielsen|spectrum|anop|gallup|quadrant|harrison)\b/i;
const ISSUE_WORD = /\b(?:approv\w*|disapprov\w*|rating|believ\w*|satisfaction|republic|referendum|flag|tax|wages?|unemployment|interest\s+rates?)\b/i;

const leaderAt = (d) => {
  const pm = d < "1991-12-20" ? "Hawke" : "Keating";
  let opp = "Howard";
  if (d < "1990-04-01") opp = "Peacock";
  else if (d < "1994-05-23") opp = "Hewson";
  else if (d < "1995-01-30") opp = "Downer";
  return { pm, opp };
};
const SURNAMES = "(?:Hawke|Keating|Peacock|Hewson|Downer|Howard)";

const ENTITIES = { "&#8212;": "—", "&mdash;": "—", "&#8211;": "–", "&ndash;": "–", "&#8217;": "’", "&rsquo;": "’", "&#8216;": "‘", "&lsquo;": "‘", "&#8220;": "“", "&ldquo;": "“", "&#8221;": "”", "&rdquo;": "”", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&nbsp;": " " };
const plain = (s) => String(s)
  .replace(/<[^>]+>/g, " ")
  .replace(/&[#a-z]+;/gi, (m) => ENTITIES[m] ?? " ")
  .replace(/\s+/g, " ")
  .trim();

const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      cell += c;
    } else {
      if (c === '"') { inQ = true; continue; }
      if (c === ",") { row.push(cell); cell = ""; continue; }
      if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const sentences = (t) => t
  .replace(/\b(Mr|Mrs|Ms|Dr|Senator)\.\s/g, "$1_DOT_ ")
  .replace(/\b([A-Z])\.\s/g, "$1_DOT_ ")
  .split(/(?<=[.!?])\s+/)
  .map((s) => s.replace(/_DOT_\s/g, ". "));

/* label-first value: scan the clause AFTER the label; movement chains yield
   the trailing (current) figure; plain clauses the last percent in them;
   bare "on N" only when the sentence (or its predecessor) used percent units */
const labelValue = (s, i1, allowBare) => {
  /* \x00-protect decimal points so clause-cutting doesn't split 43.5 at the dot */
  const gap = s.slice(i1, i1 + 90).replace(/(\d)\.(\d)/g, "$1\x00$2");
  const stop = gap.search(/[.,;:]/);
  const clause = (stop >= 0 ? gap.slice(0, stop) : gap).replace(/\x00/g, ".");
  const move = clause.match(MOVE_RE);
  if (move) return move[2] ?? move[4];
  const pcs = [...clause.matchAll(NUMPC_G)];
  if (pcs.length) return pcs[pcs.length - 1][1];
  if (allowBare) { const bare = clause.match(BARE_RE); if (bare) return bare[1]; }
  return null;
};

const parseRow = (id, date, title, txt) => {
  const out = { n: "", fieldwork: "", alp: "", coalition: "", dem: "", oth: "", und: "", tpp_alp: "", pm: "", pm_pct: "", opp: "", opp_pct: "", notes: [] };
  if (!txt) { out.notes.push("title-only"); return out; }
  if (/NSW|Victoria|Queensland|\bQld\b|Tasmania|South Australia|Western Australia|\bWA\b|\bSA\b|Premier|state\b/i.test(title)) out.notes.push("state-title");
  const t = plain(txt);

  /* centre the window on the first house mention */
  let centre = 0;
  for (const re of HOUSE) { const m = t.match(re); if (m) { centre = m.index; break; } }
  let win = t.slice(Math.max(0, centre - 400), centre + 3200);
  /* a mid-text slice leaves a sentence fragment at the window edge — drop it */
  if (centre - 400 > 0) {
    const boundary = win.search(/[.!?]\s+/);
    if (boundary > 0) win = win.slice(boundary + 2);
  }

  const n = win.match(/(?:survey|poll|sample)\s+(?:of\s+)?(?:about\s+|almost\s+|nearly\s+|some\s+)?(\d{3,5})(?:\s+(?:electors|voters|respondents|people|Australians))?/i)
       ?? win.match(/(\d{3,5})\s+(?:electors|voters|respondents)\b(?:\s+(?:were\s+)?(?:polled|surveyed|interviewed))?/i);
  if (n) out.n = n[1];
  const fw = win.match(/(?:conducted|taken|polled|surveyed|done)\s+(over|on|during|between|last|in|at)\s+([^.;]{3,90})/i);
  if (fw && !PC_RE.test(fw[2])) out.fieldwork = (fw[1] + " " + fw[2]).trim().replace(/\s+/g, " ");

  const sents = sentences(win);
  /* preferred-PM zone index first, so the primary scan can skip it */
  const pmIdx = sents.findIndex((s) => /(?:better|preferred)\s+prime\s+minister/i.test(s));

  for (let si = 0; si < sents.length; si++) {
    const s = sents[si];
    const hasPc = PC_RE.test(s), hasBare = BARE_RE.test(s);
    if (!hasPc && !hasBare) continue;
    if (TPP_RE.test(s)) {
      if (!out.tpp_alp) {
        const m = /\b(?:a\.?\s?l\.?\s?p\.?|labor|government)s?\b/i.exec(s);
        if (m) {
          const v = labelValue(s, m.index + m[0].length, hasPc)
                 ?? [...s.slice(0, m.index).matchAll(NUMPC_G)].pop()?.[1];
          if (v) out.tpp_alp = v;
        }
      }
      continue;
    }
    if (OTHERS_HOUSE.test(s)) continue;
    if (ISSUE_WORD.test(s)) continue;
    if (pmIdx >= 0 && si >= pmIdx && si <= pmIdx + 1) continue;
    const allowBare = hasPc || (si > 0 && PC_RE.test(sents[si - 1]));

    /* PAIRED pass: "38 per cent support for the ALP", "11 per cent undecided".
       A conjunction-led gap ("49 per cent and the Opposition") means the
       number belongs to the PREVIOUS label — reject those. */
    for (const [slot, re] of PARTIES) {
      if (out[slot]) continue;
      const pair = s.match(new RegExp(NUM + String.raw`\s*` + PC + String.raw`([^.,;\d]{0,30}?)` + re.source, re.flags));
      if (pair && !/^\s*(?:and|but|while|to|against|compared|versus|v\.?)\b/i.test(pair[2])) {
        if (slot === "coalition" && /\bnational(?:\s+part(?:y|ies))?\b/i.test(s) && !/\blib(?:eral)?[-\s/]/i.test(s) && /\bleader|senator|\bmp\b/i.test(s)) continue;
        out[slot] = pair[1];
      }
    }
    /* equal-share: "the ALP and the Coalition each have 40 per cent" */
    const eq = s.match(new RegExp(String.raw`\b([A-Za-z][\w.\s/-]{1,30}?)\s+and\s+(?:the\s+)?([A-Za-z][\w.\s/-]{1,25}?)\s+each\s+(?:have|has|polled?|recorded|scored|are\s+on|won)\s+` + NUM, "i"));
    if (eq) {
      let hit = false;
      for (const g of [1, 2]) for (const [slot, re] of PARTIES) {
        if (!out[slot] && re.test(eq[g])) { out[slot] = eq[3]; hit = true; }
      }
      if (hit) continue;
    }
    /* LABEL-FIRST pass: "support for Labor was down two points to 43 per cent" */
    for (const [slot, re] of PARTIES) {
      if (out[slot]) continue;
      const m = re.exec(s);
      if (!m) continue;
      if (slot === "coalition" && /\bnational(?:\s+part(?:y|ies))?\b/i.test(s) && !/\blib(?:eral)?[-\s/]/i.test(s) && /\bleader|senator|\bmp\b/i.test(s)) continue;
      const v = labelValue(s, m.index + m[0].length, allowBare);
      if (v !== null) out[slot] = v;
    }
  }

  if (pmIdx >= 0) {
    const zone = sents.slice(pmIdx, pmIdx + 2).join(" ");
    const { pm, opp } = leaderAt(date);
    out.pm = pm; out.opp = opp;
    for (const [who, slot] of [[pm, "pm_pct"], [opp, "opp_pct"]]) {
      const a = zone.match(new RegExp(NUM + String.raw`\s*` + PC + String.raw`[^.]{0,60}?(?:Mr\s+|Dr\s+)?` + who, "i"));
      const b = zone.match(new RegExp(String.raw`(?:Mr\s+|Dr\s+)?` + who + String.raw`[^.]{0,50}?\b(?:on|at|to|of|by)\s+` + NUM + String.raw`(?:\s*` + PC + ")?", "i"));
      const v = (b && b[1]) ?? (a && a[1]);
      if (v) out[slot] = v;
    }
    if (!out.pm_pct && !out.opp_pct) { out.pm = ""; out.opp = ""; }
  }

  /* sum sanity: majors-only reportage sums ~80 normally, so only flag
     overflows (impossible) and off-range 3+ slot sums */
  const parts = ["alp", "coalition", "dem", "oth", "und"].filter((k) => out[k] !== "").map((k) => parseFloat(out[k]));
  if (parts.length >= 2) {
    const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10;
    if (sum > 104 || (parts.length >= 3 && (sum < 88 || sum > 102))) out.notes.push(`sum=${sum}`);
  }
  if (!out.alp && !out.coalition && !out.tpp_alp && !out.pm_pct) out.notes.push("no-figures");
  return out;
};

if (!fs.existsSync(MENTIONS)) { console.error(`no ${MENTIONS} — run .build/mine-agb-mcnair.mjs first`); process.exit(1); }
const [header, ...rows] = parseCsv(fs.readFileSync(MENTIONS, "utf8"));
if (header[0] !== "id") { console.error("unexpected mentions CSV header"); process.exit(1); }

const outRows = [];
let qaFig = 0, qaFull = 0;
for (const r of rows) {
  const [id, date, , title, , , url] = r;
  const p = path.join(HARVEST, "text", `${id}.txt`);
  const txt = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const f = parseRow(id, date, title, txt);
  if (f.alp || f.coalition || f.tpp_alp || f.pm_pct) qaFig++;
  if (f.alp && f.coalition) qaFull++;
  outRows.push([id, date, title, f.n, f.fieldwork, f.alp, f.coalition, f.dem, f.oth, f.und, f.tpp_alp, f.pm, f.pm_pct, f.opp, f.opp_pct, f.notes.join("|"), url]);
}

const out = ["id,date,title,n,fieldwork,alp,coalition,dem,oth,und,tpp_alp,pm,pm_pct,opp,opp_pct,note,url",
  ...outRows.map((r) => r.map(csvCell).join(",")),
].join("\n") + "\n";
fs.writeFileSync(OUT, out);
console.log(`rows: ${outRows.length} · with figures: ${qaFig} · with alp+coalition: ${qaFull}`);
console.log("flagged:", outRows.filter((r) => r[15]).map((r) => `${r[0]}:${r[15]}`).join("  ") || "none");
console.log(`wrote ${OUT}`);
