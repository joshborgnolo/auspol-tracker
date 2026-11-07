#!/usr/bin/env node
/* extract-incumbency.mjs: who was the sitting member in every House contest 1993-2025, aligned with the
   candidates of map/data/res-<year>.json (same division, same ballot order), written to
   data/house-incumbency.json for the seat model's long calibration (calibrate-swing.mjs, backtest-chain.mjs).

   The res stores' own sitting column (c[7]) cannot be used: from 2007 it is always 0 (the AEC file has no
   SittingMemberFl), in 2004 the file's '#' marks the WINNER, and the statistics-era frames compare names
   with the previous winner of the same-named division only.

   Sources, all committed under .build/aec-flow-src:
     2007-2025    booth/oracle/fpvvt-<year>.csv.gz HistoricElected 'Y' (by-election winners included:
                  Wentworth 2019 Phelps Y; renamed seats included: Fenner 2019 Leigh Y; any sitting MP: Banks,
                  member for Chisholm, flagged in Flinders 2019 - classed 2 below)
     1993-2004    the previous general election's winners re-contesting (1990: psephos/1990, the final count's
                  capitalised name or the outright winner; 1993/1998: hcands Member '#' = elected; 1996/2001:
                  fpvvt Elected Y; 2004: fpvvt '#', which in that file marks the winner), plus by-election winners
                  (BYELECTIONS). The 1996/2001 CD-ROM SittingMemberFl is NOT used: it misses by-election winners
                  (Abbott, Latham, Georgiou 1996) and long-serving members (Cadman, Jones, Pyne 1996).
   Output per year and division: sitting flags in res c[] order, plus the division's previous winner's
   name and whether that winner re-contested (anywhere). */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SRC = ".build/aec-flow-src";
const YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const PREV = { 1996: 1993, 1998: 1996, 2001: 1998, 2004: 2001, 2007: 2004, 2010: 2007, 2013: 2010, 2016: 2013, 2019: 2016, 2022: 2019, 2025: 2022 };
const BYELECTIONS = { // winners of by-elections held between the previous general election and this one (pre-2007; the AEC's
  // HistoricElected covers them from 2007). Wills 1992 (Cleary) was voided: vacant at the 1993 dissolution.
  1993: [{ st: "VIC", div: "Menzies", surname: "ANDREWS" }],
  1996: [{ st: "NSW", div: "Werriwa", surname: "LATHAM" }, { st: "NSW", div: "Mackellar", surname: "BISHOP" }, { st: "NSW", div: "Warringah", surname: "ABBOTT" },
    { st: "WA", div: "Fremantle", surname: "LAWRENCE" }, { st: "SA", div: "Bonython", surname: "EVANS" }, { st: "VIC", div: "Kooyong", surname: "GEORGIOU" },
    { st: "ACT", div: "Canberra", surname: "SMYTH" }, { st: "NSW", div: "Wentworth", surname: "THOMSON" }],
  1998: [{ st: "NSW", div: "Blaxland", surname: "HATTON" }],
  2001: [{ st: "QLD", div: "Ryan", surname: "SHORT" }, { st: "VIC", div: "Aston", surname: "PEARCE" }],
  2004: [{ st: "NSW", div: "Cunningham", surname: "ORGAN" }],
};
const famOf = (p) => { const x = String(p || "").toUpperCase(); return x === "ALP" ? "A" : /^(LP|LIB|NP|NPA|NAT|NATS|CLP|LNP|LNQ|CL)$/.test(x) ? "C" : /^(GRN|GWA|AGV|TG)$/.test(x) ? "G" : x ? "X:" + x : "X"; };
const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z]/g, "");

function csvRows(text) { // quote-aware
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"') q = true; else if (ch === ",") { row.push(f); f = ""; } else if (ch === "\n") { row.push(f.replace(/\r$/, "")); out.push(row); row = []; f = ""; } else f += ch;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}
function fpvvt(year) {
  const rows = csvRows(gunzipSync(readFileSync(`${SRC}/booth/oracle/fpvvt-${year}.csv.gz`)).toString("utf8"));
  const H = rows[1], ix = (k) => H.indexOf(k);
  const out = [];
  for (const r of rows.slice(2)) {
    if (r.length < H.length - 1 || r[ix("CandidateID")] === "999") continue;
    const bp = +r[ix("BallotPosition")]; if (!bp || bp >= 900) continue;
    out.push({ st: r[ix("StateAb")], div: r[ix("DivisionNm")], bp, surname: norm(r[ix("Surname")]), given: norm(r[ix("GivenNm")]), fam: famOf(r[ix("PartyAb")]),
      sitFlag: ix("SittingMemberFl") >= 0 ? r[ix("SittingMemberFl")] === "#" : null,
      hist: ix("HistoricElected") >= 0 ? r[ix("HistoricElected")] === "Y" : null,
      elected: ix("Elected") >= 0 ? r[ix("Elected")] === "Y" : null });
  }
  return out;
}
function hcands(year) { // statistics-era candidate lists: State;Division;Ballot Position;Member(=elected);Candidate;...
  const lines = readFileSync(`${SRC}/hcands-${year}.txt`, "latin1").split(/\r?\n/).filter(Boolean);
  const H = lines[0].split(";");
  return lines.slice(1).map((l) => l.split(";")).filter((r) => +r[2] > 0 && +r[2] < 900 && r[4]).map((r) => {
    const [sur, giv] = r[4].split(",").map((s) => s.trim());
    return { st: r[0], div: r[1], bp: +r[2], surname: norm(sur), given: norm(giv), fam: famOf(r[5]), elected: r[3] === "#" };
  });
}
function psephos1990() { // winners of 1990: the capitalised name in each division's last count, or the outright primary winner
  const out = [];
  for (const f of readdirSync(`${SRC}/psephos/1990`)) {
    const st = f.replace("1990reps", "").replace(".txt", "").toUpperCase();
    const L = readFileSync(`${SRC}/psephos/1990/${f}`, "latin1").split(/\r?\n/);
    for (let i = 0; i < L.length; i++) {
      const m = /^((?:Mc)?[A-Z][A-Z' -]+)(?:, (ACT|NSW|NT|Qld|SA|Tas|Vic|WA))?\s*$/.exec(L[i]); if (m && !m[2] && m[1].trim() !== "NORTHERN TERRITORY") continue;
      if (!m || !/^=+/.test(L[i + 1] || "")) continue;
      const div = m[1].trim(); if (!m[2] && st !== "NT") continue; let j = i + 2; const cands = [];
      while (j < L.length && !/^Candidate\s+Party/.test(L[j])) j++;
      j += 2;
      while (j < L.length && !/^-{10}/.test(L[j])) { const r = /^(.+?)\s{2,}(\S*)\s+([\d,]+)\s+([\d.]+)/.exec(L[j]); if (r) cands.push({ name: r[1].replace(/[*+]/g, "").replace(/^Hon\.? |^Dr\.? |^Rev\.? /g, "").trim(), sitting: /\*/.test(r[1]), party: r[2], votes: +r[3].replace(/,/g, "") }); j++; }
      let k = j, last = null;
      for (; k < L.length; k++) { if ((/^(?:Mc)?[A-Z][A-Z' -]+, (ACT|NSW|NT|Qld|SA|Tas|Vic|WA)\s*$/.test(L[k]) || /^NORTHERN TERRITORY\s*$/.test(L[k])) && /^=+/.test(L[k + 1] || "")) break; if (/count: /.test(L[k])) last = k; }
      let winner = null;
      if (last != null) for (let q = last + 2; q < k && !/^-{10}/.test(L[q]); q++) { const w = /^((?:[A-Z]|Mc)[A-Z'-]*(?: (?:Mc)?[A-Z][A-Z'-]+)*)\s*[*+]?\s+[\d,]/.exec(L[q]); if (w && /[A-Z]{2}/.test(w[1]) && w[1].replace(/^Mc/, "") === w[1].replace(/^Mc/, "").toUpperCase()) { winner = w[1]; break; } }
      if (!winner) { const tot = cands.reduce((a, c) => a + c.votes, 0), top = [...cands].sort((a, b) => b.votes - a.votes)[0]; if (top && top.votes > tot / 2) winner = top.name.split(" ").pop().toUpperCase(); }
      const wt = winner ? winner.split(" ") : [], wi = wt.length > 1 ? wt[0][0] : null;
      const wc = winner && cands.find((c) => norm(c.name.split(" ").pop()) === norm(wt[wt.length - 1]) && (!wi || norm(c.name)[0] === wi));
      out.push({ st: st === "QLD" ? "QLD" : st, div: div.replace(/\b([A-Z])([A-Z'-]*)/g, (a, b, c) => b + c.toLowerCase()), winnerSurname: wc ? norm(wc.name.split(" ").pop()) : (winner ? norm(winner.split(" ").pop()) : null), winnerGiven: wc ? norm(wc.name.split(" ")[0]) : null, winnerFam: wc ? famOf(wc.party) : null });
      i = k - 1;
    }
  }
  return out;
}
const titleDiv = (s) => norm(s);
const RES = Object.fromEntries(YEARS.map((y) => [y, JSON.parse(readFileSync(`map/data/res-${y}.json`, "utf8"))]));

/* winners per year: { st|DIV -> {surname, given} } from the AEC files */
function winnersOf(year) {
  if (year === 1990) return psephos1990().filter((w) => w.winnerSurname).map((w) => ({ st: w.st, div: titleDiv(w.div), surname: w.winnerSurname, given: w.winnerGiven, fam: w.winnerFam }));
  if (year === 1993 || year === 1998) return hcands(year).filter((c) => c.elected).map((c) => ({ st: c.st, div: titleDiv(c.div), surname: c.surname, given: c.given, fam: c.fam }));
  if (year === 2004) return fpvvt(year).filter((c) => c.sitFlag).map((c) => ({ st: c.st, div: titleDiv(c.div), surname: c.surname, given: c.given, fam: c.fam })); // 2004's '#' marks the winner
  return fpvvt(year).filter((c) => c.elected).map((c) => ({ st: c.st, div: titleDiv(c.div), surname: c.surname, given: c.given, fam: c.fam }));
}
function candidatesOf(year) {
  if (year === 1993 || year === 1998) return hcands(year);
  return fpvvt(year);
}
const out = { _about: "Sitting members in every House contest 1993-2025 (extract-incumbency.mjs). years[year][division] = { sit: [per res-<year> candidate, ballot order: 1 sitting member for this division (or its renamed/abolished predecessor, or a by-election winner here), 2 an MP who moved here from a division that still exists, 0 not an MP], prevWinner: previous general election's winner of the same-named division (surname), prevWinnerStood: 1 if that person stood again anywhere at this election }. Sitting = the member for that division at dissolution re-contesting it (AEC SittingMemberFl/HistoricElected where published; derived from the previous winners plus by-elections for 1993, 1998 and 2004).", years: {} };
const report = [];
for (const year of YEARS) {
  const cands = candidatesOf(year), R = RES[year];
  const prevYear = year === 1993 ? 1990 : PREV[year];
  const prevW = winnersOf(prevYear);
  const divsNow = new Set(R.divs.map((d) => titleDiv(d.n)));
  const yearOut = {};
  let nSit = 0, nDiv = 0;
  for (const dv of R.divs) {
    const cs = cands.filter((c) => titleDiv(c.div) === titleDiv(dv.n)).sort((a, b) => a.bp - b.bp);
    if (cs.length !== dv.c.length) throw new Error(`${year} ${dv.n}: ${cs.length} source candidates v ${dv.c.length} in res`);
    cs.forEach((c, i) => { const rn = norm(dv.c[i][0].split(" ").pop()); if (!rn.endsWith(c.surname.slice(-3)) && !c.surname.endsWith(rn.slice(-3))) throw new Error(`${year} ${dv.n} ballot ${i + 1}: ${c.surname} v ${dv.c[i][0]}`); });
    // sitMP: the source's "sitting member" flag (AEC) or the derived one; then each flagged candidate is
    // classed 1 (member for this division or its renamed/abolished predecessor, or a by-election winner)
    // or 2 (an MP who moved here from a division that still exists: e.g. Banks, Chisholm -> Flinders 2019)
    const pw = prevW.find((w) => w.st === dv.st && w.div === titleDiv(dv.n));
    const by = (BYELECTIONS[year] || []).find((b) => b.st === dv.st && titleDiv(b.div) === titleDiv(dv.n));
    const samePerson = (w, c) => w.surname === c.surname && (!w.given || !c.given || w.given[0] === c.given[0] || (w.fam && w.fam === c.fam && !w.fam.startsWith("X")));
    const strictPerson = (w, c) => w.surname === c.surname && w.given && c.given && w.given[0] === c.given[0] && (!w.fam || w.fam === c.fam || w.given === c.given); // a party change (Hanson: LP ballot 1996, HAN 1998) needs the full given name
    const elsewhere = (c) => prevW.find((w) => w.st === dv.st && w.div !== titleDiv(dv.n) && strictPerson(w, c))
      || (BYELECTIONS[year] || []).map((b) => ({ st: b.st, div: titleDiv(b.div), surname: b.surname })).find((w) => w.st === dv.st && w.div !== titleDiv(dv.n) && w.surname === c.surname && (c.party == null || true));
    let sitMP;
    if (year >= 2007) sitMP = cs.map((c) => (c.hist ? 1 : 0));
    else sitMP = cs.map((c) => ((by && c.surname === by.surname) || (pw && samePerson(pw, c)) || elsewhere(c) ? 1 : 0));
    let sit = cs.map((c, i) => {
      if (!sitMP[i]) return 0;
      if (by && c.surname === by.surname) return 1;
      if (pw && samePerson(pw, c)) return 1;
      const e = elsewhere(c);
      if (e) return divsNow.has(e.div) ? 2 : 1;
      return 1; // flagged but no previous general-election win: a by-election winner here
    });
    // two claimants (the division's previous winner and a member whose own division was abolished): the
    // previous winner keeps it
    if (sit.filter((x) => x === 1).length > 1) sit = sit.map((x, i) => (x === 1 && !((pw && samePerson(pw, cs[i])) || (by && cs[i].surname === by.surname)) ? 2 : x));
    if (sit.filter((x) => x === 1).length > 1) throw new Error(`${year} ${dv.n}: more than one sitting member for the division`);
    const stoodAnywhere = pw ? cands.some((c) => c.st === dv.st && c.surname === pw.surname && (!pw.given || !c.given || c.given[0] === pw.given[0])) : null;
    yearOut[dv.n] = { sit, prevWinner: pw ? pw.surname : null, prevWinnerStood: stoodAnywhere == null ? null : stoodAnywhere ? 1 : 0 };
    nSit += sit.some((x) => x === 1) ? 1 : 0; nDiv++;
  }
  // sanity: how many sitting members won
  let sitWon = 0, sitLost = 0;
  for (const dv of R.divs) { const s = yearOut[dv.n].sit; dv.c.forEach((c, i) => { if (s[i] === 1) { if (c[6] === 1) sitWon++; else sitLost++; } }); }
  report.push(`${year}: ${nSit}/${nDiv} divisions with the sitting member standing; won ${sitWon}, lost ${sitLost}`);
  out.years[year] = yearOut;
}
writeFileSync("data/house-incumbency.json", JSON.stringify(out) + "\n");
console.log(report.join("\n"));
console.log("wrote data/house-incumbency.json");
