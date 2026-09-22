#!/usr/bin/env node
/* extract-bulletin-gallup.mjs — read the Morgan Gallup leader-rating tables
   out of The Bulletin's OCR (harvest-bulletin-gallup.mjs) into
   data/bulletin-leader-approval.csv, one row per (leader, wave), majority-
   voted across every issue that reprinted the wave.

     node .build/extract-bulletin-gallup.mjs            # report, write CSV
     node .build/extract-bulletin-gallup.mjs --dump     # print every parsed table with its source

   THE TABLES. The column printed a trend table per leader, in a few
   wordings that all reduce to the same shape:
       MR WHITLAM AS PM            OPINION OF FRASER        SNEDDEN IN OPPOSITION
       Approve Disapprove Undecided
       %       %          %
       June    47  34  19
       April:                       <- a month with several waves is a
       Early   47  39  14              header line followed by sub-rows
       Feb 14,21   49 32 19         <- fortnightly waves name their weekends
       Jan 31/Feb 7  49 28 23
   A heading is an all-caps line naming a leader; the rows are a date label
   followed by exactly three integers summing to ~100 (OCR tolerance ±3).

   DATES. The row label is resolved to a fieldwork END date: an explicit day
   (or the last of several) is used as printed; a month alone is the 15th;
   Early/Mid/Late are the 7th/15th/24th. The year comes from the issue date,
   rolling back a year for a month later than the issue's (a December row in
   a January issue). `date_basis` records which rule fired.

   ROLES. The leader's role at that date comes from the era table below —
   the heading's own wording (AS PM / IN OPPOSITION) is checked against it
   and a disagreement is reported, never silently resolved.

   VOTING. The same wave is printed in three to six consecutive issues; a
   figure is taken by majority across printings, and a wave whose printings
   disagree on the winning figure by more than a tie is reported with every
   variant. Nothing is written for a wave the OCR read only once with a
   sum off 100. */
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.BULLETIN_DIR || ".matilda/bulletin-gallup";
const OUT = "data/bulletin-leader-approval.csv";
const DUMP = process.argv.includes("--dump");

// leader surname → [{role, from, to}]; dates are eastern calendar days
const ERAS = {
  mcmahon: [{ role: "pm", from: "1971-03-10", to: "1972-12-05" }, { role: "opposition", from: "1972-12-05", to: "1972-12-20" }],
  whitlam: [{ role: "opposition", from: "1967-02-08", to: "1972-12-05" }, { role: "pm", from: "1972-12-05", to: "1975-11-11" }, { role: "opposition", from: "1975-11-11", to: "1977-12-22" }],
  snedden: [{ role: "opposition", from: "1972-12-20", to: "1975-03-21" }],
  fraser: [{ role: "opposition", from: "1975-03-21", to: "1975-11-11" }, { role: "pm", from: "1975-11-11", to: "1983-03-11" }],
  hayden: [{ role: "opposition", from: "1977-12-22", to: "1983-02-03" }],
  hawke: [{ role: "other", from: "1970-01-01", to: "1983-02-03" }, { role: "opposition", from: "1983-02-03", to: "1983-03-11" }, { role: "pm", from: "1983-03-11", to: "1991-12-20" }],
  peacock: [{ role: "opposition", from: "1983-03-11", to: "1985-09-05" }, { role: "opposition", from: "1989-05-09", to: "1990-04-03" }],
  howard: [{ role: "opposition", from: "1985-09-05", to: "1989-05-09" }],
};
const roleAt = (leader, iso) => (ERAS[leader] || []).find((e) => iso >= e.from && iso < e.to)?.role ?? null;
// the reverse: who held an office on a date ("APPROVAL OF PRIME MINISTER" names no one)
const holderOf = (role, iso) => Object.keys(ERAS).find((l) => roleAt(l, iso) === role) ?? null;

const MONTHS = { dan: 1, jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, mch: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MONTH_RE = "(?:dan|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|mch|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const parseIssueDate = (s) => { const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(s || ""); return m && MONTHS[m[2].toLowerCase()] ? { y: +m[3], m: MONTHS[m[2].toLowerCase()], d: +m[1] } : null; };

/* A row label → { m, d, basis } or null. Handles "June", "Feb 14,21",
   "Feb 14/21", "Jan 31/Feb 7", "Feb 28/Mch 6", "March 13,20", "Mch 27/Apr 3",
   "Early"/"Mid"/"Late" (with the month carried from an "April:" header). */
function parseLabel(label, carry) {
  const raw = label.replace(/\([^)]*\)/g, " ").replace(/(\d{1,2})(19\d\d)\b/, "$1 $2").replace(/[.]/g, "")
    // OCR fuses a one-digit day onto the month: "Marl" (Mar 1), "Aprils" (April 5), "Junel" (June 1)
    .replace(new RegExp(`^(${MONTH_RE})([ils])(?=[\\s,/]|$)`, "i"), (_, mo, ch) => `${mo} ${{ l: 1, i: 1, s: 5 }[ch.toLowerCase()]}`)
    .replace(new RegExp(`([/,]\\s*)(${MONTH_RE})([ils])(?=[\\s,]|$)`, "i"), (_, sep, mo, ch) => `${sep}${mo} ${{ l: 1, i: 1, s: 5 }[ch.toLowerCase()]}`)
    .replace(/[\s,;:‘’']+$/, "").trim();
  // a wave named only relative to an election ("Pre-election", "Before May
  // election"): a real reading, but undatable from the label — skipped, and
  // the table goes on
  if (/^(pre-?election|before .*election|election|post-?election)$/i.test(raw)) return { skip: true };
  let s = raw.replace(/^(?:election day|election|polling day|poll)\s*:?\s*/i, "").trim();
  let m;
  // a bare year line ("1976") heads a group of rows; a year can also prefix
  // ("1977 Jan 15,22") or trail ("Dec 13, 1975") a label
  if (/^19\d\d(?:\s*%)*$/.test(s)) return { yearHeader: +s.slice(0, 4) };
  let year = null;
  if ((m = /^(19\d\d)\s+(.*)$/.exec(s))) { year = +m[1]; s = m[2].trim(); }
  else if ((m = /^(.*?)[,\s]+(19\d\d)$/.exec(s))) { year = +m[2]; s = m[1].trim(); }
  const withYear = (r) => (r && year ? { ...r, year } : r);
  // "Feb/Mar", "March/April", "Jun/July": a reading spanning two months, dated
  // to the middle of the second
  if ((m = new RegExp(`^(${MONTH_RE})\\s*/\\s*(${MONTH_RE})$`, "i").exec(s))) return withYear({ m: MONTHS[m[2].toLowerCase()], d: 15, basis: "months" });
  // "Aug: Early" / "April Mid" — month and sub-wave on one line
  if ((m = new RegExp(`^(${MONTH_RE})\\s*:?\\s+(early|mid|late)$`, "i").exec(s))) return withYear({ m: MONTHS[m[1].toLowerCase()], d: { early: 7, mid: 15, late: 24 }[m[2].toLowerCase()], basis: m[2].toLowerCase() });
  if ((m = new RegExp(`^(${MONTH_RE})\\s*:?$`, "i").exec(s))) return withYear({ m: MONTHS[m[1].toLowerCase()], d: 15, basis: "month", header: /:$/.test(s) });
  if ((m = /^(early|mid|late)(?:\s+(?:in\s+)?([A-Za-z]+))?$/i.exec(s))) {
    const mo = m[2] && MONTHS[m[2].toLowerCase()] ? MONTHS[m[2].toLowerCase()] : carry;
    if (!mo) return null;
    return withYear({ m: mo, d: { early: 7, mid: 15, late: 24 }[m[1].toLowerCase()], basis: m[1].toLowerCase() });
  }
  // "Jan 31/Feb 7" or "Feb 28/Mch 6" → the second date
  if ((m = new RegExp(`^(${MONTH_RE})\\s*(\\d{1,2})\\s*[/,&-]\\s*(${MONTH_RE})\\s*(\\d{1,2})$`, "i").exec(s))) return withYear({ m: MONTHS[m[3].toLowerCase()], d: +m[4], basis: "printed" });
  // "Feb 14,21" / "March 13,20" / "Feb 14/21" / "Feb 14-21" / "Feb 14" → the last day
  if ((m = new RegExp(`^(${MONTH_RE})\\s*(\\d{1,2}(?:\\s*[/,&-]\\s*\\d{1,2})*)$`, "i").exec(s))) {
    const days = m[2].split(/[/,&-]/).map((x) => +x.trim()).filter((x) => x >= 1 && x <= 31);
    return days.length ? withYear({ m: MONTHS[m[1].toLowerCase()], d: days[days.length - 1], basis: "printed" }) : null;
  }
  // "14,21 Feb" / "31 Jan-7 Feb"
  if ((m = new RegExp(`^(\\d{1,2})(?:\\s*[/,&-]\\s*\\d{1,2})*\\s*[/,&-]?\\s*(\\d{1,2})?\\s+(${MONTH_RE})$`, "i").exec(s))) return withYear({ m: MONTHS[m[3].toLowerCase()], d: +(m[2] || m[1]), basis: "printed" });
  return null;
}

const LEADER_RE = /\b(WHITLAM|SNEDDEN|FRASER|HAYDEN|HAWKE|PEACOCK|HOWARD|McMAHON|MCMAHON)\b/;
const headingOf = (line) => {
  const t = line.replace(/[’'.]/g, "").trim();
  if (!/^[A-Z][A-Z\s:,\-]+$/.test(t) && !/^(MR|OPINION OF|APPROVAL OF)/i.test(t)) return null;
  if (/PREMIER|DEPUTY|PRESIDENT|ACTU|COUNTRY PARTY|NCP|\bCP\b|LIBERAL LEADER|VERSUS|\bV\b/i.test(t)) return null; // state leaders, deputies, pairings
  const hint = /\bPM\b|PRIME MINISTER/i.test(t) ? "pm" : /OPPOSITION/i.test(t) ? "opposition" : null;
  const lm = LEADER_RE.exec(t.toUpperCase());
  // 1979–82 wording names the office alone: the holder is resolved per row date
  if (!lm) return hint && /^(APPROVAL|OPINION) OF/i.test(t) ? { leader: null, hint } : null;
  return { leader: lm[1].toLowerCase(), hint };
};

// ---- parse every issue -------------------------------------------------------------
const articles = new Map();
for (const l of fs.readFileSync(path.join(DIR, "articles.jsonl"), "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); articles.set(r.section, r); }
const issueOf = JSON.parse(fs.readFileSync(path.join(DIR, "issue-of.json"), "utf8"));
const issueDate = {}; // issue → {y,m,d}
for (const [section, issue] of Object.entries(issueOf)) { const a = articles.get(section); const d = a && parseIssueDate(a.issueDate); if (d) issueDate[issue] = d; }

const readings = []; // {leader, role, hint, date, basis, approve, disapprove, undecided, issue, issueIso}
const problems = [];
for (const f of fs.readdirSync(path.join(DIR, "issues")).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, "issues", f), "utf8"));
  const idate = issueDate[j.issue];
  if (!idate) { problems.push(`${j.issue}: no issue date`); continue; }
  const issueIso = iso(idate.y, idate.m, idate.d);
  // a heading and its table can sit in different OCR blocks: join each
  // article's blocks (same aid, page order) before reading
  const byAid = new Map();
  for (const b of j.blocks) (byAid.get(b.aid) || byAid.set(b.aid, []).get(b.aid)).push(b.text);
  for (const [, texts] of byAid) {
    const article = texts.join("\n");
    const lines = article.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const h = headingOf(lines[i]);
      if (!h) continue;
      /* an office-only heading ("APPROVAL OF OPPOSITION LEADER") also heads
         the column's STATE tables; only an article that names the federal
         holder of that office at the issue date is read */
      if (!h.leader) {
        const holder = holderOf(h.hint, issueIso);
        if (!holder || !new RegExp(`\\b${holder}\\b`, "i").test(article)) { problems.push(`${issueIso}: office-only table "${lines[i]}" in an article not naming ${holder || "the holder"} — skipped`); continue; }
      }
      // the Approve/Disapprove header within the next 3 lines
      let k = i + 1;
      // "Approve Disapprove Undecided" until 1979, "Approval Disapproval Undecided" from 1980
      while (k < lines.length && k <= i + 3 && !/approv/i.test(lines[k])) k++;
      if (k >= lines.length || !/approv/i.test(lines[k]) || !/disapprov/i.test(lines[k])) continue;
      k++;
      // the "% % %" line, which OCR renders as anything short without digits
      if (k < lines.length && !/\d/.test(lines[k]) && lines[k].length <= 12) k++;
      let carry = null, carryYear = null, rows = 0, lastMonth = null;
      for (; k < lines.length; k++) {
        let line = lines[k].replace(/[|]/g, " ");
        // a label wrapped onto its own line above its three figures
        if (!/\d{1,2}\s+\d{1,2}\s+\d{1,2}\s*$/.test(line) && k + 1 < lines.length && /^\d{1,2}[,.'’]*\s+\d{1,2}[,.'’]*\s+\d{1,2}\s*$/.test(lines[k + 1]) && parseLabel(line, carry)) { line = line + " " + lines[k + 1]; k++; }
        const rm = /^(.*?)[\s:]+(\d{1,2})[\s,.'’]+(\d{1,2})[\s,.'’]+(\d{1,2})\s*$/.exec(line);
        if (!rm) {
          const lab = parseLabel(line, carry);
          // a dated row whose figures the OCR mangled ("Aug 4/11 68 21 ii"): note, read on
          const lm = /^(.*?)[\s:]+\d/.exec(line);
          if (!lab && lm && parseLabel(lm[1], carry) && !parseLabel(lm[1], carry).yearHeader) { problems.push(`${issueIso} ${h.leader ?? h.hint}: short row "${line}"`); continue; }
          // the "% % %" line with OCR debris in it ("%'” % 5 “", "Wo *55 %")
          if (!lab && rows === 0 && /%/.test(line) && !new RegExp(MONTH_RE, "i").test(line)) continue;
          if (lab && lab.yearHeader) { carryYear = lab.yearHeader; continue; }
          // a short figure-less line before the first row: a wrapped label
          // ("Before May" / "election 57 26 17") or OCR debris — read on
          if (!lab && rows === 0 && !/\d/.test(line) && line.length <= 16) continue;
          if (lab && lab.header) { carry = lab.m; continue; }
          if (lab && lab.basis === "month" && !lab.header && rows === 0) { carry = lab.m; continue; }
          if (lab && lab.skip) continue;
          // a dated row the OCR left short of three figures: note it, read on
          if (lab && /\d/.test(line)) { problems.push(`${issueIso} ${h.leader}: short row "${line}"`); continue; }
          break; // the table ended
        }
        const lab = parseLabel(rm[1], carry);
        if (!lab) break;
        if (lab.skip) continue;
        if (lab.yearHeader) { carryYear = lab.yearHeader; lastMonth = null; continue; }
        if (lab.basis === "month") carry = lab.m;
        const a = +rm[2], d = +rm[3], u = +rm[4];
        if (Math.abs(a + d + u - 100) > 3) { problems.push(`${issueIso} ${h.leader}: row "${line}" sums ${a + d + u}`); rows++; continue; }
        /* year: a year printed on the label or on a header line starts the
           count; the rows run chronologically, so a month stepping backwards
           (Dec → Jan) advances it; a table with no year at all starts from the
           issue's year, rolled back when its first month is after the issue's;
           and no wave can post-date the issue that printed it. */
        if (lab.year) carryYear = lab.year;
        else if (carryYear == null) carryYear = lab.m > idate.m ? idate.y - 1 : idate.y;
        else if (lastMonth != null && lab.m < lastMonth) carryYear++;
        lastMonth = lab.m;
        let y = carryYear;
        if (iso(y, lab.m, lab.d) > issueIso) y--;
        /* a digest that re-lists the previous year's waves with no year line
           (a 1978 issue printing Whitlam's 1977 campaign readings) lands on a
           year in which the leader held no office; the era table is the
           check, and the row moves back a year, noted */
        if (h.leader && !roleAt(h.leader, iso(y, lab.m, lab.d)) && roleAt(h.leader, iso(y - 1, lab.m, lab.d))) {
          problems.push(`${issueIso} ${h.leader}: "${line}" re-dated ${y} → ${y - 1} (no office held in ${y})`);
          y--; carryYear = y;
        }
        const date = iso(y, lab.m, lab.d);
        /* an office-only table is about the office's holder WHEN PRINTED —
           Hawke's April 1983 "OPINION OF PRIME MINISTER" lists his February
           readings, taken while he led the opposition — so the person comes
           from the issue date and the role from the row date */
        const leader = h.leader || holderOf(h.hint, issueIso);
        if (!leader) { problems.push(`${issueIso} ${h.hint}: no ${h.hint} holder known at ${date}`); continue; }
        const role = roleAt(leader, date);
        if (h.hint && role && h.hint !== role) problems.push(`${issueIso} ${leader}: heading says ${h.hint}, era table says ${role} at ${date}`);
        readings.push({ leader, role: role || h.hint || "unknown", hint: h.hint, officeOnly: !h.leader, date, basis: lab.basis, approve: a, disapprove: d, undecided: u, issue: j.issue, issueIso, label: rm[1].trim() });
        rows++;
      }
      if (DUMP && rows) console.log(`${issueIso} ${j.issue} ${lines[i]} → ${rows} rows`);
      if (!rows) problems.push(`${issueIso} ${h.leader}: table under "${lines[i]}" yielded no rows; next: ${lines.slice(k, k + 3).join(" | ")}`);
      i = k;
    }
  }
}

// ---- vote across printings ---------------------------------------------------------
/* A month-only row ("April") in a later digest table restates a month the
   column had already reported wave by wave ("April: Early / Mid / Late",
   or "Feb 14,21"). Where dated waves exist for a leader-month, the digest
   row is dropped rather than voted against them. */
const datedMonths = new Set(readings.filter((r) => r.basis !== "month").map((r) => `${r.leader}|${r.date.slice(0, 7)}`));
const voted = readings.filter((r) => r.basis !== "month" || !datedMonths.has(`${r.leader}|${r.date.slice(0, 7)}`));
const byKey = new Map();
for (const r of voted) { const k = `${r.leader}|${r.date}`; (byKey.get(k) || byKey.set(k, []).get(k)).push(r); }
const out = [], disputed = [];
for (const [k, rs] of byKey) {
  const tally = new Map();
  for (const r of rs) { const v = `${r.approve}|${r.disapprove}|${r.undecided}`; const t = tally.get(v) || { n: 0, first: r.issueIso }; t.n++; if (r.issueIso < t.first) t.first = r.issueIso; tally.set(v, t); }
  /* majority; a tie goes to the reading that sums exactly to 100, then to
     the EARLIEST printing (the column's own fresh table, before the digests)
     — and is recorded as disputed so the CSV says so */
  const ranked = [...tally.entries()].sort((a, b) => (b[1].n - a[1].n)
    || (Math.abs(a[0].split("|").reduce((x, y) => x + +y, 0) - 100) - Math.abs(b[0].split("|").reduce((x, y) => x + +y, 0) - 100))
    || a[1].first.localeCompare(b[1].first));
  const [win, { n }] = ranked[0];
  const tie = ranked.length > 1 && ranked[1][1].n === n;
  if (tie && n === 1 && rs.some((r) => r.officeOnly)) { disputed.push(`${k}: singleton tie on office-only tables ${ranked.map(([v]) => v).join(" vs ")} → dropped`); continue; }
  if (tie) disputed.push(`${k}: tie ${ranked.map(([v, c]) => v + "×" + c.n).join(" vs ")} → ${win}`);
  const [approve, disapprove, undecided] = win.split("|").map(Number);
  const r0 = rs[0];
  const issues = [...new Set(rs.map((r) => r.issue))];
  out.push({ date: r0.date, leader: r0.leader, role: r0.role, approve, disapprove, undecided, net: approve - disapprove,
    printings: rs.length, agreeing: n, disputed: tie ? 1 : 0, date_basis: r0.basis, label: r0.label, issues: issues.join(" "), first_issue: rs.map((r) => r.issueIso).sort()[0] });
}
out.sort((a, b) => a.date.localeCompare(b.date) || a.leader.localeCompare(b.leader));

const header = "date,leader,role,approve,disapprove,undecided,net,printings,agreeing,disputed,date_basis,label,first_issue,issues";
const csv = [header, ...out.map((r) => [r.date, r.leader, r.role, r.approve, r.disapprove, r.undecided, r.net, r.printings, r.agreeing, r.disputed, r.date_basis, JSON.stringify(r.label), r.first_issue, r.issues].join(","))].join("\n") + "\n";
fs.writeFileSync(OUT + ".tmp", csv); fs.renameSync(OUT + ".tmp", OUT);

const byYear = {};
for (const r of out) { const y = r.date.slice(0, 4); byYear[y] = byYear[y] || { pm: 0, opposition: 0, other: 0, unknown: 0 }; byYear[y][r.role] = (byYear[y][r.role] || 0) + 1; }
console.log(`readings parsed: ${readings.length} across ${Object.keys(issueDate).length} dated issues → ${out.length} waves (${disputed.length} disputed, ${problems.length} problems)`);
for (const [y, c] of Object.entries(byYear).sort()) console.log(`  ${y}  pm ${c.pm}  opp ${c.opposition}  other ${c.other}  unknown ${c.unknown}`);
if (disputed.length) { console.log("disputed:"); for (const d of disputed) console.log("  " + d); }
if (problems.length) { console.log("problems (first 30):"); for (const p of problems.slice(0, 30)) console.log("  " + p); }
console.log(`wrote ${OUT}`);
