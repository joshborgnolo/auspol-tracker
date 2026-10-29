/* =============================== the story column ===============================
   The section anatomy of every other page, at column width: a title and its
   meta, a Crimson headline that states the finding, a dek, then the figures.
   Headlines are written by rule from the numbers on screen; each rule covers
   every case it can meet, and says nothing the data can't show. */
const swc = (fam) => `background:var(--m-${fam})`;
const tx = (fam) => `t-${fam}`;
const surname = (n) => n.split(" ").slice(-1)[0];
function pairNames(a, b) { const sa = surname(a.n), sb = surname(b.n); return sa === sb ? [a.n, b.n] : [sa, sb]; }
const famText = (fam) => `var(--${fam}-text)`;
const famFill = (fam) => `var(--${fam})`;
const thePartyFam = (fam) => FAM_PL[fam];
const leaderName = (h) => (h.ab === "CSA" ? "Community Strong" : partyName(h.ab, h.pn));
// a state frame's own words: a state election's opposition is the Liberals (the
// LNP in Queensland), its head of government a premier; its counts and state
// word are South Australia's (the ECSA's) only on an SA frame — New South
// Wales gets the NSWEC's wording, Queensland the ECQ's
const isState = () => STATE_YEARS.has(S.year);
const isSA = () => SA_YEARS.has(S.year);
const isNSW = () => NSW_YEARS.has(S.year);
const isVic = () => VIC_YEARS.has(S.year);
const isQld = () => QLD_YEARS.has(S.year);
// a state frame's elections commission, short form (state frames only)
const commX = () => (isSA() ? "ECSA" : isVic() ? "VEC" : isQld() ? "ECQ" : "NSWEC");
const coalW = (cap) => (isSA() || isVic() ? (cap ? "The Liberals" : "the Liberals") : isQld() ? (cap ? "The LNP" : "the LNP") : cap ? "The Coalition" : "the Coalition");
// the rival's bare name where the hero and margin bars want one ("Liberal"/"LNP"/"Coalition")
const oppNameW = () => (isSA() || isVic() ? "Liberal" : isQld() ? "LNP" : "Coalition");
const leaderT = () => (isState() ? "premier" : "prime minister");
const ausW = () => (isSA() ? "South Australia" : isNSW() ? "New South Wales" : isVic() ? "Victoria" : isQld() ? "Queensland" : "Australia");
const legW = (b) => famLeg(b);
// a family's preferences, possessive: the Liberals' on an SA or Victorian frame,
// the LNP's on a Queensland frame, the Coalition's elsewhere
const possW = (b) => (b === "lnp" && isQld() ? "the LNP’s" : b === "lnp" && (isSA() || isVic()) ? "the Liberals’" : POSS[b]);
// the "now" view: today’s holder won the last count under another banner — the
// winner’s row in the count stays historical but earns a "· now X" note
const movedTo = (m, d) => (m.year === "now" && d.hold && d.hold.n === d.win.n && d.hold.ab !== d.win.ab ? leaderName(d.hold) : null);
function swingPhrase(sw, prev) {
  if (sw == null) return "";
  if (Math.abs(sw) < 0.05) return `no swing since ${prev}`;
  return `a swing of ${pts(sw)} to ${sw > 0 ? "Labor" : coalW()} since ${prev}`;
}
function upDown(v, unit = "points") { const a = Math.abs(v); if (a < 0.05) return "unchanged"; return `${v >= 0 ? "up" : "down"} ${a.toFixed(1)} ${a.toFixed(1) === "1.0" ? unit.replace(/s$/, "") : unit}`; }
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// a rank among n seats, from whichever end is nearer: "the highest", "the third lowest"
function rankWords(r, n, hi = "highest", lo = "lowest") { const q = n - r + 1; if (r <= 10) return r === 1 ? `the ${hi}` : `the ${ordw(r)} ${hi}`; if (q <= 10) return q === 1 ? `the ${lo}` : `the ${ordw(q)} ${lo}`; return `the ${ord(r)} ${hi}`; }
const SUBJ = { alp: "Labor", lnp: "The Coalition", grn: "The Greens", onp: "One Nation", ind: "Independents", oth: "Other candidates" };
const subj = (f) => (f === "alp" || f === "onp" ? SUBJ[f] : SUBJ[f].charAt(0).toLowerCase() + SUBJ[f].slice(1));
const ofN = (k, n) => (k === n ? `all ${n}` : `${k} of the ${n}`);
const byNote = (d) => (d && d.by ? ", at the 2026 by-election" : "");
function seatCount(m, idx, fam) { return idx.filter((i) => m.divs[i].hold.fam === fam).length; }

/* ----- small figure builders ----- */
function upLink() {
  const s = S.sel, m = M();
  if (s.level === "aus") return "";
  const label = s.level === "state" ? "All seats" : s.level === "div" ? STATE_TITLE[s.st] : m.divs[s.div].n;
  const go = s.level === "state" ? "aus" : s.level === "div" ? `state:${s.st}` : `div:${s.div}`;
  return `<button type="button" class="st-up" data-go="${go}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.2 3.8 6l3.8 3.8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${ds(label)}</button>`;
}
function head(title, meta, hed, dek) {
  return `${upLink()}<div class="st-head"><h2>${ds(title)}</h2><span class="rd-meta">${meta}</span></div><h3 class="st-hed">${hed}</h3>${dek ? `<p class="st-dek">${dek}</p>` : ""}`;
}
// the Now page's two-party read: two names, two big figures, a rule between
function heroPair(aName, aPct, aFam, bName, bPct, bFam) {
  return `<div class="hero-read" role="img" aria-label="${ds(aName)} ${f1(aPct)}, ${ds(bName)} ${f1(bPct)}">
    <div class="hero-side a"><span class="hero-name" style="color:${famText(aFam)}"><i style="background:${famFill(aFam)}"></i>${ds(aName)}</span><span class="hero-num" style="color:${famFill(aFam)}">${f1(aPct)}</span></div>
    <span class="hero-rule"></span>
    <div class="hero-side b"><span class="hero-name" style="color:${famText(bFam)}">${ds(bName)}<i style="background:${famFill(bFam)}"></i></span><span class="hero-num" style="color:${famFill(bFam)}">${f1(bPct)}</span></div></div>`;
}
// the site's margin bar: where the lead sits between "◀ A ahead" and "B ahead ▶"
function marginBar(aName, aFam, bName, bFam, lead, span) {
  span = span || (Math.abs(lead) > 18 ? 30 : Math.abs(lead) > 9 ? 20 : 10);
  const x = (v) => 50 - (50 * clamp(v, -span, span)) / span; // positive = A ahead = left
  const ticks = [-span, -span / 2, 0, span / 2, span];
  const lab = (v) => (v === 0 ? "Tied" : `${Math.abs(v)}${Math.abs(v) === span ? " pts" : ""}`);
  const fam = lead >= 0 ? aFam : bFam;
  const bar = lead >= 0 ? `left:${x(lead)}%;width:${50 - x(lead)}%` : `left:50%;width:${x(lead) - 50}%`;
  return `<div class="mbar" aria-hidden="true">
    <span class="side" style="left:0;color:${famText(aFam)}">◀ ${ds(aName)} ahead</span><span class="side" style="right:0;color:${famText(bFam)}">${ds(bName)} ahead ▶</span>
    ${ticks.filter((v) => v !== 0).map((v) => `<span class="grid" style="left:${x(v)}%"></span>`).join("")}<span class="tie" style="left:50%"></span>
    <span class="bar" style="${bar};background:${famFill(fam)}"></span><span class="dot" style="left:${x(lead)}%;background:${famFill(fam)}"></span>
    ${ticks.map((v) => { const xv = x(v), edge = xv <= 0 ? " edge-l" : xv >= 100 ? " edge-r" : ""; return `<span class="tick${v === 0 ? " tied" : ""}${edge}" style="left:${xv}%">${lab(v)}</span>`; }).join("")}</div>`;
}
function statusOf(winPct) { return winPct < 56 ? "marginal" : winPct < 60 ? "fairly safe" : "safe"; }

function candRows(cands, formal, cmp, limit, swingOf, partyOf) {
  const sorted = [...cands].sort((a, b) => b.v - a.v);
  const top = Math.max(30, (100 * sorted[0].v) / formal);
  const pOf = partyOf || ((c) => partyName(c.ab, c.pn));
  const rows = sorted.map((c, k) => {
    const p = (100 * c.v) / formal, tick = cmp ? cmp(c) : null, sw0 = swingOf ? swingOf(c) : c.sw;
    return `<div class="row"${limit && k >= limit ? " data-extra hidden" : ""}><div class="nm" title="${ds(c.n)}, ${esc(pOf(c))}">${ds(c.n)}${c.el ? `<span class="el">elected</span>` : ""}<small>${esc(pOf(c))}</small></div><div class="bar"><i style="width:${(100 * p) / top}%;${swc(c.fam)}"></i>${tick != null ? `<u style="left:${clamp((100 * tick) / top, 0, 100)}%" title="Across the seat: ${f1(tick)}%"></u>` : ""}</div><div class="v">${f1(p)}</div><div class="d">${sw0 == null ? "" : sgn(sw0)}</div></div>`;
  });
  const more = limit && sorted.length > limit ? `<button type="button" class="more" data-more>All ${sorted.length} candidates</button>` : "";
  return `<div class="rows">${rows.join("")}</div>${more}`;
}
function famRows(fp, fpSw) {
  const order = FAMS.filter((b) => fp[b] > 0.05).sort((a, b) => fp[b] - fp[a]);
  const top = Math.max(40, fp[order[0]]);
  // a year with no previous count carries fpSw as an object of nulls (sa26)
  return `<div class="rows">${order.map((b) => `<div class="row"><div class="nm">${legW(b)}</div><div class="bar"><i style="width:${(100 * fp[b]) / top}%;${swc(b)}"></i></div><div class="v ${tx(b)}">${f1(fp[b])}</div><div class="d">${fpSw && fpSw[b] != null ? sgn(fpSw[b]) : ""}</div></div>`).join("")}</div>`;
}
function flowRows(flows, pairA, pairB) {
  const agg = {};
  for (const f of flows) { const b = f.cand.b; (agg[b] = agg[b] || { b, ta: 0, tb: 0, names: [] }); agg[b].ta += f.ta; agg[b].tb += f.tb; agg[b].names.push(f.cand.n); }
  const list = Object.values(agg).filter((x) => x.ta + x.tb > 0).sort((x, y) => y.ta + y.tb - (x.ta + x.tb));
  if (!list.length) return "";
  const [la, lb] = pairNames(pairA, pairB);
  return list.map((x) => { const t = x.ta + x.tb, pa = (100 * x.ta) / t; return `<div class="flow"><div class="fh"><div>${legW(x.b)}</div><span>${int(t)} votes</span></div><div class="fb"><i style="width:calc(${pa}% - 1px);${swc(pairA.fam)}"></i><i style="flex:1;${swc(pairB.fam)}"></i></div><div class="fl"><span><b class="${tx(pairA.fam)}">${f0(pa)}%</b> to ${ds(la)}</span><span>${ds(lb)} <b class="${tx(pairB.fam)}">${f0(100 - pa)}%</b></span></div></div>`; }).join("");
}
function decileRows(get, labelFor) {
  return `<div class="dec">${IX.map((ix) => { const v = get(ix); const cells = Array.from({ length: 10 }, (_, k) => `<i style="${v && k + 1 <= v ? `background:${css(RAMP.seifa[Math.round((k / 9) * 100)])}` : ""}"></i>`).join(""); return `<div class="nm">${IX_NAME[ix]}<small>${IX_ABBR[ix]}${v ? ` · decile ${v}` : " · no score"}${labelFor ? labelFor(ix, v) : ""}</small></div><div class="cells" role="img" aria-label="Decile ${v ?? "unknown"} of 10">${cells}</div>`; }).join("")}</div>`;
}
function linkRows(m, items, fmt, colOf) {
  // the state tag only earns its space when the rows span more than one
  const oneSt = new Set(items.map(({ i }) => m.divs[i].st)).size < 2;
  return `<div class="links">${items.map(({ i, v }) => { const d = m.divs[i]; return `<button type="button" data-go="div:${i}"><i style="background:${colOf ? colOf(i) : "var(--line)"}"></i><span class="nm">${ds(d.n)}${oneSt ? "" : `<small>${STATE_SHORT[d.st]}</small>`}</span><b>${fmt(v, d)}</b></button>`; }).join("")}</div>`;
}
const colCss = (c) => (c ? css(c) : "var(--line)");

function historyChart(d) {
  const h = d.h.filter((r) => r[1] != null || r[3]);
  if (!h.length) return "";
  const W = 340, H = 120, padL = 26, padR = 10, padT = 10, padB = 22;
  const yx = (y) => (y === 2026 ? YEAR_X.now - 0.3 : y);
  const years = h.map((r) => yx(r[0])), y0 = 2004, y1 = Math.max(2025, years[years.length - 1]);
  const x = (y) => padL + ((yx(y) - y0) / Math.max(1, y1 - y0)) * (W - padL - padR);
  const vals = h.map((r) => r[1]).filter((v) => v != null);
  const lo = Math.min(30, Math.floor(Math.min(...vals, 50) / 10) * 10), hi = Math.max(70, Math.ceil(Math.max(...vals, 50) / 10) * 10);
  const yy = (v) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const ptsLine = h.filter((r) => r[1] != null).map((r) => `${x(r[0]).toFixed(1)},${yy(r[1]).toFixed(1)}`).join(" ");
  const grid = [lo, 50, hi].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${yy(v)}" y2="${yy(v)}" stroke="var(--line)" stroke-width="1"${v === 50 ? ' stroke-dasharray="3 3"' : ""}/><text x="${padL - 6}" y="${yy(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${v}</text>`).join("");
  const cur = S.year === "now" ? 2026 : S.year;
  const dots = h.map((r) => {
    const yv = r[1] != null ? r[1] : 50, on = r[0] === cur || (S.year === "now" && r[0] === 2025 && !h.some((q) => q[0] === 2026));
    const yr = r[0] === 2026 ? "now" : r[0];
    const title = r[4] ? `${r[0]} by-election: won by ${r[3]} (${partyName(r[2])}); no Labor v Coalition count` : `${r[0]}: Labor two-party ${f1(r[1])}; won by ${r[3]} (${partyName(r[2])})`;
    return `<g data-year="${yr}" style="cursor:pointer"><title>${ds(title)}</title><circle cx="${x(r[0])}" cy="${yy(yv)}" r="${on ? 5.5 : 4.2}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="2"${r[1] == null ? ' fill-opacity="0.9"' : ""}/>${on ? `<circle cx="${x(r[0])}" cy="${yy(yv)}" r="8.5" fill="none" stroke="var(--ink)" stroke-width="1.4"/>` : ""}</g>`;
  }).join("");
  const xl = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025].map((y) => `<text x="${x(y)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="${y === cur ? "var(--ink)" : "var(--ink-3)"}" font-weight="${y === cur ? 600 : 400}">’${String(y).slice(2)}</text>`).join("") + (h.some((r) => r[0] === 2026) ? `<text x="${x(2026)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">by</text>` : "");
  const runs = [];
  for (const r of h) { const last = runs[runs.length - 1]; if (last && last.n === r[3] && last.ab === r[2]) last.to = r[0]; else runs.push({ n: r[3], ab: r[2], from: r[0], to: r[0], by: r[4] }); }
  const now = S.year === "now" ? M() : null, hold = now ? now.divs[d.i].hold : null;
  if (hold && runs.length && (runs[runs.length - 1].n !== hold.n || runs[runs.length - 1].ab !== hold.ab)) runs.push({ n: hold.n, ab: hold.ab, from: "now", to: "now", switched: true });
  const holders = runs.reverse().map((r) => `<div><i style="${swc(FAM(r.ab))}"></i><span>${ds(r.n)}<small>${esc(leaderName({ ab: r.ab, pn: "" }))}</small></span><span>${r.switched ? "now" : r.by ? `${r.from} by-election` : r.from === r.to ? r.from : `${r.from}–${String(r.to).slice(2)}`}</span></div>`).join("");
  return `<div class="st-sec hist"><h3>Since 2004 <small>Labor’s two-party vote, and who won</small></h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Labor’s two-party share in ${ds(d.n)} at each election since 2004">${grid}<polyline points="${ptsLine}" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linejoin="round"/>${dots}${xl}</svg><div class="holders">${holders}</div><p class="st-note">Boundaries are redrawn between some elections, so the area behind a name can change.</p></div>`;
}

/* ----- the national and state stories ----- */
function areaStats(m, st) {
  const A = m.areas[st], idx = A.idx, N = idx.length;
  const cnt = {}; for (const i of idx) { const f = holdFam(m.divs[i].hold); cnt[f] = (cnt[f] || 0) + 1; }
  return { A, idx, N, cnt };
}
// the crossbench in words: "eight independents, two from One Nation and one each from the Greens and Katter’s Australian"
function crossGroups(m, idx) {
  const xs = {};
  for (const i of idx) { const h = m.divs[i].hold; if (h.fam === "alp" || h.fam === "lnp") continue; const k = crossLabel(h); xs[k] = (xs[k] || 0) + 1; }
  return xs;
}
const listAnd = (a) => (a.length < 2 ? a[0] || "" : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
function crossbenchWords(m, idx) {
  const xs = crossGroups(m, idx);
  const named = (k) => (k === "Greens" ? "the Greens" : k === "Katter" ? "Katter’s Australian" : k);
  const parts = [];
  if (xs.Independents) { parts.push(`${words(xs.Independents)} ${xs.Independents === 1 ? "independent" : "independents"}`); delete xs.Independents; }
  const byN = {};
  for (const [k, n] of Object.entries(xs)) (byN[n] = byN[n] || []).push(named(k));
  for (const n of Object.keys(byN).map(Number).sort((a, b) => b - a)) {
    const ks = byN[n];
    if (n === 1) parts.push(ks.length === 1 ? `one from ${ks[0]}` : `one each from ${listAnd(ks)}`);
    else parts.push(ks.map((k) => `${words(n)} from ${k}`).join(", "));
  }
  return listAnd(parts);
}
// "The crossbench took 15: …", or where one group took every crossbench seat, "The other three went to independents"
function crossSentence(m, idx, verb) {
  const xs = crossGroups(m, idx), keys = Object.keys(xs), c = Object.values(xs).reduce((a, b) => a + b, 0);
  if (!c) return "";
  if (keys.length === 1) {
    const k = keys[0], n = xs[k];
    const who = k === "Independents" ? (n === 1 ? "an independent" : "independents") : k === "Greens" ? "the Greens" : k === "Katter" ? "Katter’s Australian" : k;
    return `The other ${n === 1 ? "seat" : words(n)} ${verb === "holds" ? (n === 1 ? "is held by" : "are held by") : "went to"} ${who}.`;
  }
  return `The crossbench ${verb === "holds" ? "holds" : "took"} ${c}: ${crossbenchWords(m, idx)}.`;
}
function areaHedDek(m, st) {
  const aus = st === "AUS", { A, idx, N, cnt } = areaStats(m, st);
  const where = aus ? "" : ` in ${STATE_NAME[st]}`;
  const ofSeats = aus ? `of the ${N} seats` : `of ${STATE_POSS[st]} ${N} seats`;
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const gov = m.gov, opp = gov === "alp" ? "lnp" : "alp";
  const lead = A.tpp >= 50 ? "alp" : "lnp", leadPct = Math.max(A.tpp, 100 - A.tpp);

  const isNowM = m.year === "now";
  switch (S.lens) {
    case "winner": {
      const g = cnt[gov] || 0, o = cnt[opp] || 0, c = N - g - o;
      if (isNowM) {
        const hed = aus ? `Labor holds ${g} of the ${N} seats` : `Labor holds ${g} ${ofSeats}`;
        let dek = `The Coalition holds ${o}. ${crossSentence(m, idx, "holds")}`;
        if (aus) dek += ` One Nation has two seats it didn’t win at the election: Barnaby Joyce joined it in December 2025, and David Farley won Farrer at the May 2026 by-election.`;
        if (!aus) { const ch = (m.changes || []).filter((x) => m.divs[m.byName.get(x.div)].st === st); if (ch.length) dek += ` Since the election: ${[...new Set(ch.map((x) => x.div))].map((n) => ds(n)).join(" and ")} ${ch.length > 1 ? "have" : "has"} changed hands or party.`; }
        return { hed, dek };
      }
      const maj = Math.floor(N / 2) + 1;
      // a state frame's prev lives under its jurisdiction when the federal GOV
      // table's same-numbered key already belongs to another state (vic's 2018 v SA's)
      const pv = prevYearOf(m.year) ?? (m.res && m.res.prev), pvG = (pv && STATE_YEARS.has(m.year) && PREV_GOV_BY_JUR[YEAR_JUR[m.year]] && PREV_GOV_BY_JUR[YEAR_JUR[m.year]][pv]) ?? GOV[pv], changed = pv && pvG && pvG !== gov;
      let hed;
      if (aus) {
        if (g < maj) hed = `No party won a majority: ${o > g ? `${coalW()} won ${o} seats, Labor ${g}` : `Labor won ${g} seats, ${coalW()} ${o}`}`;
        else if (changed) hed = `${gov === "alp" ? "Labor" : coalW(1)} won government with ${g} of the ${N} seats`;
        else hed = `${gov === "alp" ? "Labor" : coalW(1)} was returned with ${g} of the ${N} seats`;
      } else {
        const best = (cnt.alp || 0) >= (cnt.lnp || 0) ? "alp" : "lnp", bn = cnt[best] || 0;
        hed = `${best === "alp" ? "Labor" : coalW(1)} won ${bn} ${ofSeats}`;
      }
      let dek = aus
        ? `${g < maj ? "" : `${opp === "alp" ? "Labor" : coalW(1)} won ${o}. `}${crossSentence(m, idx, "won")}${c ? " " : ""}${m.year === 2010 ? "Labor kept government with the support of the Greens’ member and three independents. " : ""}${PM[m.year]} ${changed ? "became" : "remained"} ${leaderT()}.`
        : `${(cnt.alp || 0) >= (cnt.lnp || 0) ? coalW(1) : "Labor"} won ${(cnt.alp || 0) >= (cnt.lnp || 0) ? cnt.lnp || 0 : cnt.alp || 0}. ${crossSentence(m, idx, "won")}${c ? " " : ""}Labor’s two-party vote${where} was ${f1(A.tpp)}%${swingPhrase(A.tppSw, prev) ? ", " + swingPhrase(A.tppSw, prev) : ""}.`;
      return { hed, dek };
    }
    case "tpp": {
      const withData = idx.filter((i) => m.divs[i].tpp != null);
      if (S.tppMode === "swing") {
        const s = A.tppSw;
        const to = s >= 0 ? "Labor" : "the Coalition";
        const hed = Math.abs(s) < 0.05 ? `There was no two-party swing${where}` : `The two-party vote${where} swung ${pts(s)} to ${to}`;
        const sw = withData.map((i) => ({ i, v: m.divs[i].tppSw })).filter((x) => x.v != null);
        const toward = sw.filter((x) => (s >= 0 ? x.v > 0 : x.v < 0)).length;
        const big = [...sw].sort((a, b) => (s >= 0 ? b.v - a.v : a.v - b.v))[0];
        const dek = sw.length ? `${toward === 0 ? "None" : cap(ofN(toward, sw.length))} ${toward === 0 ? `of the ${sw.length}` : ""} seats with a measured swing moved towards ${to}.`.replace("  ", " ") + ` The biggest swing that way was ${big ? `${ds(m.divs[big.i].n)}’s, ${pts(big.v)}` : "–"}.` : "";
        return { hed, dek: dek + (isNowM ? " These are the 2025 election’s swings." : "") };
      }
      const hed = `${lead === "alp" ? "Labor" : coalW(1)} won ${f1(leadPct)}% of the two-party vote${where}`;
      const ahead = withData.filter((i) => m.divs[i].tpp > 50).length;
      const sp = swingPhrase(A.tppSw, prev);
      const dek = `${sp ? `That’s ${sp}. ` : ""}On the two-party count Labor led in ${ahead} of the ${withData.length === N ? N : `${withData.length} counted`} seats${where}, ${coalW()} in ${withData.length - ahead}.${isNowM && (aus || st === "NSW") ? " These are the 2025 election’s figures; Labor didn’t stand at the Farrer by-election, so Farrer has none." : ""}`;
      return { hed, dek };
    }
    case "fp": {
      const P = S.party, name = legW(P);
      const stood = idx.filter((i) => m.divs[i].fp[P] > 0);
      if (S.fpMode === "change") {
        const d0 = A.fpSw[P];
        const hed = Math.abs(d0) < 0.05 ? `${Poss(P)} primary vote${where} was unchanged on ${prev}` : `${Poss(P)} primary vote${where} ${d0 >= 0 ? "rose" : "fell"} ${pts(d0)} on ${prev}`;
        const ch = idx.map((i) => ({ i, v: fpChange(m, m.divs[i], P) })).filter((x) => x.v != null);
        const up = ch.filter((x) => x.v > 0).length;
        const best = [...ch].sort((a, b) => b.v - a.v)[0];
        return { hed, dek: ch.length ? `It rose in ${ofN(up, ch.length)} seats with a comparable count${best ? `, most in ${ds(m.divs[best.i].n)} (${sgn(best.v)}${byNote(m.divs[best.i])})` : ""}.` : "" };
      }
      const hed = `${SUBJ[P]} won ${f1(A.fp[P])}% of first preferences${where}`;
      const ranked = stood.map((i) => ({ i, v: m.divs[i].fp[P] })).sort((a, b) => b.v - a.v);
      // a year with no previous count (sa26) doesn't pretend to a change figure
      const dek = `${A.fpSw[P] != null ? `${cap(upDown(A.fpSw[P]))} on ${prev}. ` : ""}${P === "ind" ? "Independents" : P === "oth" ? "Other candidates" : name} stood in ${stood.length === N ? `all ${N}` : `${stood.length} of the ${N}`} seats${ranked.length ? `; the best result was ${ds(m.divs[ranked[0].i].n)}’s ${f1(ranked[0].v)}%${byNote(m.divs[ranked[0].i])}` : ""}.`;
      return { hed, dek };
    }
    case "senate": {
      const P = S.party, r = senArea(m, idx, P), pr = senPron(P);
      if (svYear(m.year) == null) return { hed: `A state election has no Senate`, dek: `The Senate lens reads federal elections; choose one on the timeline.` };
      if (!r) return { hed: `The Senate’s votes are loading`, dek: "" };
      const per = idx.map((i) => ({ i, v: senDivValue(m, m.divs[i]) })).filter((x) => x.v != null).sort((p, q) => q.v - p.v);
      const stoodTxt = r.stood < r.n ? `; ${pr.it} stood for the House in ${r.stood} of the ${r.n} seats` : "";
      if (senGap()) {
        const higher = per.filter((x) => x.v > 0).length;
        return { hed: `${SUBJ[P]} ${senGapWords(r.gap)}${where}`,
          dek: `${f1(r.sen)}% of Senate first preferences against ${f1(r.house)}% in the House${stoodTxt}.${per.length ? ` Seat by seat, ${pr.it} polled higher in the Senate in ${higher === per.length ? `every one of the ${per.length}` : ofN(higher, per.length)}; the gap was widest in ${ds(m.divs[per[0].i].n)} (${sgn(per[0].v)}).` : ""}` };
      }
      return { hed: `${SUBJ[P]} won ${f1(r.sen)}% of the Senate vote${where}`, dek: `Against ${f1(r.house)}% in the House${stoodTxt}.${per.length ? ` ${pr.Its} best Senate seat was ${ds(m.divs[per[0].i].n)}, at ${f1(per[0].v)}%.` : ""}` };
    }
    case "flow": {
      const F = S.from, name = possW(F), rival = vsW();
      let toA = 0, tot = 0, xN = 0, xT = 0;
      const per = [];
      for (const i of idx) { const d = m.divs[i]; if (!flowSeat(d)) continue; let a = 0, t = 0; for (const f of d.flows) if (f.cand.b === F) { a += d.alpSide === 0 ? f.ta : f.tb; t += f.ta + f.tb; if (f.exh != null) { xN += f.exh; xT += f.ta + f.tb + f.exh; } } if (t) { toA += a; tot += t; per.push({ i, v: (100 * a) / t, t }); } }
      if (!tot) return { hed: `None of ${name} preferences were split between Labor and ${rival}${where}`, dek: "" };
      const share = (100 * toA) / tot;
      if (m.res.flBasis === "modelled") {
        const e = flowErrOf(m, F);
        return { hed: `${f0(share)}% of ${name} preferences modelled to go to Labor${S.vs === "onp" ? " over One Nation" : ""}${where}`, dek: `No South Australian count records how ${name} preferences flowed, so each district’s share is modelled from the elections whose splits are published${e ? `; ${flowErrWords(e)}` : ""}. Shown across the ${per.length} districts whose count finished Labor against ${rival}.` };
      }
      const hed = `${f0(share)}% of ${name} preferences went to Labor${S.vs === "onp" ? " over One Nation" : ""}${where}`;
      per.sort((a, b) => a.v - b.v);
      const lo = per[0], hi = per[per.length - 1];
      const opv = m.res.flOpv && xT ? ` Under New South Wales’s optional preferences another ${f0((100 * xN) / xT)}% of ${name} ballots exhausted before the final two.` : "";
      const dek = `Counted in the ${per.length === 1 ? "one seat" : `${per.length} seats`}${where} that finished Labor against ${rival}.${per.length === 1 ? "" : ` The share ran from ${f0(lo.v)}% in ${ds(m.divs[lo.i].n)} to ${f0(hi.v)}% in ${ds(m.divs[hi.i].n)}.`}${opv}`;
      return { hed, dek };
    }
    case "informal": {
      const exh = infModeOf(m) === "exhaust";
      const hed = exh ? `${f1(A.exhPct)}% of ballots${where} exhausted before the final two` : `${f1(A.infPct)}% of ballots${where} were informal`;
      const r = idx.map((i) => ({ i, v: exh ? m.divs[i].exhPct : m.divs[i].infPct })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
      if (exh) {
        const dek = `Under New South Wales’s optional-preferential vote, a ballot leaves the count when its numbered candidates are gone. The highest rate was ${ds(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${ds(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
        return { hed, dek };
      }
      const pa = prev && Y[prev] && Y[prev].areas ? Y[prev].areas[st] : null;
      const dek = `${pa ? `${Math.abs(A.infPct - pa.infPct) < 0.05 ? "Unchanged" : A.infPct >= pa.infPct ? "Up" : "Down"} from ${f1(pa.infPct)}% in ${prev}. ` : ""}The highest rate was ${ds(m.divs[r[0].i].n)}’s ${f1(r[0].v)}%${byNote(m.divs[r[0].i])}; the lowest ${ds(m.divs[r[r.length - 1].i].n)}’s ${f1(r[r.length - 1].v)}%.`;
      return { hed, dek };
    }
    case "cls": {
      if (isState()) return { hed: `${ausW()}’s seats carry no AEC type`, dek: `The inner-metropolitan to rural scale is the AEC’s federal classification; the ${commX()} publishes none of its own.` };
      let best = null;
      const per = CLS.map((c) => { const xs = idx.filter((i) => m.divs[i].cls === c); const a = seatCount(m, xs, "alp"), l = seatCount(m, xs, "lnp"); return { c, n: xs.length, a, l }; });
      for (const p of per) { if (p.n < (aus ? 10 : 3)) continue; for (const [fam, k] of [["alp", p.a], ["lnp", p.l]]) { const sh = k / p.n; if (!best || sh > best.sh) best = { fam, k, n: p.n, c: p.c, sh }; } }
      const verb = isNowM ? "holds" : "won";
      const hed = best ? `${best.fam === "alp" ? "Labor" : "The Coalition"} ${verb} ${best.k === best.n ? `all ${best.n}` : `${best.k} of the ${best.n}`} ${CLS_LOWER[best.c]} seats${where}` : `Seats${where} by the AEC’s type`;
      const dek = per.filter((p) => p.n).map((p) => `${CLS_SHORT[p.c]}: Labor ${p.a}, Coalition ${p.l}${p.n - p.a - p.l ? `, others ${p.n - p.a - p.l}` : ""}`).join(". ") + ".";
      return { hed, dek };
    }
    case "seifa": {
      if (isDemo()) return areaDemo(m, st, idx, where, isNowM);
      const ix = S.index, scored = idx.filter((i) => m.divs[i].seifa[ix] && m.divs[i].seifa[ix].pct != null).sort((a, b) => m.divs[a].seifa[ix].pct - m.divs[b].seifa[ix].pct);
      if (scored.length < 10) return { hed: `${IX_NAME[ix]}${where}`, dek: "" };
      const q = Math.round(scored.length / 5), low = scored.slice(0, q), high = scored.slice(-q);
      const fams = ["alp", "lnp", "ind", "grn", "onp", "oth"];
      const topOf = (xs) => fams.map((f) => [f, seatCount(m, xs, f)]).sort((a, b) => b[1] - a[1]);
      const lt = topOf(low), ht = topOf(high);
      const verb = isNowM ? "holds" : "won";
      const adv = ix === "irsd" ? ["most disadvantaged", "least disadvantaged"] : ix === "ier" ? ["poorest in economic resources", "richest in economic resources"] : ix === "ieo" ? ["lowest on education and occupation", "highest on education and occupation"] : ["least advantaged", "most advantaged"];
      const lead0 = lt[0][0], lv = verb === "holds" ? (lead0 === "ind" || lead0 === "grn" ? "hold" : "holds") : "won";
      const hed = `${cap(FAM_PL[lead0])} ${lv} ${lt[0][1]} of the ${q} ${adv[0]} seats${where}`;
      const hs = ht.filter((x) => x[1]);
      const first = hs[0], rest = hs.slice(1).map(([f, n]) => `${FAM_PL[f]} ${n}`);
      const v1 = verb === "holds" ? (first[0] === "ind" || first[0] === "grn" ? "hold" : "holds") : "won";
      const dek = `Of the ${q} ${adv[1]}, ${FAM_PL[first[0]]} ${v1} ${first[1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Seats are ranked on the ABS’s ${IX_NAME[ix].toLowerCase()} index (${IX_ABBR[ix]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : m.year < 2004 ? "from the 2001 census" : "interpolated between censuses to election day"}.`;
      return { hed, dek };
    }
  }
  return { hed: "", dek: "" };
}

// the census people measures, area level: who holds the fifth of seats at each end
const DM_TOP = { lang: ["seats with the most residents speaking another language at home", "most English-speaking"], a65: ["seats with the most residents aged 65 and over", "with the fewest"], a2034: ["seats with the most residents aged 20 to 34", "with the fewest"], fborn: ["seats with the most residents born overseas", "the most Australia-born"], uni: ["seats with the most residents holding a university qualification", "with the fewest"], blue: ["seats with the most blue-collar workers", "with the fewest"], loinc: ["seats where the most adults live in lower-income households", "with the fewest"], hiinc: ["seats where the most adults live in high-income households", "with the fewest"] };
// the pair-of-phrases for a birthplace country, against the Australia-born share
const COB_TOP = { uk: ["seats where the most residents were born in the United Kingdom", "the most Australia-born"], eng: ["seats where the most residents were born in England", "the most Australia-born"], ind: ["seats where the most residents were born in India", "the most Australia-born"], chn: ["seats where the most residents were born in China", "the most Australia-born"], nzl: ["seats where the most residents were born in New Zealand", "the most Australia-born"], phl: ["seats where the most residents were born in the Philippines", "the most Australia-born"], vnm: ["seats where the most residents were born in Vietnam", "the most Australia-born"], zaf: ["seats where the most residents were born in South Africa", "the most Australia-born"], ita: ["seats where the most residents were born in Italy", "the most Australia-born"], lka: ["seats where the most residents were born in Sri Lanka", "the most Australia-born"], sct: ["seats where the most residents were born in Scotland", "the most Australia-born"] };
// the measures' census basis as copy: 2001 reads its own census area
// figures measured-only (the frame's floor year, its census ~3 months
// before election day); 2004-2019 blend their bracketing censuses; the
// income lanes (2013 on) count adults
const DB = {
  venue: {
    seats: (y) => `From the ${y < 2007 ? 2001 : y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in: the AEC’s record of where voters live begins in 2016.`,
    who: "of residents of the census area it stands in",
    whoAdults: "of the adults of the census area it stands in",
    note: (y) => `From the ${y < 2007 ? 2001 : y < 2013 ? 2006 : 2011} census, of the census areas the polling places stand in.`,
  },
  voter: {
    seats: "From the 2021 census, counted where each seat’s voters live.",
    who: "of residents where this place’s voters live",
    whoAdults: "of the adults where this place’s voters live",
    note: "From the 2021 census, counted where its voters live.",
  },
  // a state election has no AEC vote record to pool on; the figures are the
  // SA1 census areas that make up each district
  sa1: {
    seats: "From the 2021 census, of the SA1 census areas that make up each district.",
    who: "of residents of the district’s SA1 census areas",
    whoAdults: "of the adults of the district’s SA1 census areas",
    note: "From the 2021 census, of the district’s SA1 census areas.",
  },
  // a state polling place reads the ONE SA1 census area its venue stands in
  sa1Booth: {
    who: "of residents of the SA1 census area it stands in",
    whoAdults: "of the adults of the SA1 census area it stands in",
    note: "From the 2021 census, of the SA1 census area the place stands in.",
  },
};
const demoCopy = (m) => {
  if (m.demoBasis === "sa1") return DB.sa1;
  const db = DB[m.demoBasis === "venue" ? "venue" : "voter"];
  // a birthplace-country sub-view never reads the blend epoch: cob rides
  // the measured census (the 2006/2011 editions carry no England or
  // Scotland to blend), so its notes name its own census
  if (isCob() || !m.demoInterp) return m.demoBasis === "venue" ? { seats: db.seats(m.year), who: db.who, whoAdults: db.whoAdults, note: db.note(m.year) } : db;
  const { c0, c1 } = m.demoInterp;
  return {
    seats: `Interpolated between the ${c0} and ${c1} censuses to election day${m.demoBasis === "venue" ? ", of the census areas the polling places stand in" : ", counted where each seat’s voters live"}.`,
    who: db.who,
    whoAdults: db.whoAdults,
    note: `Interpolated between the ${c0} and ${c1} censuses to election day.`,
  };
};
// polling-place cards read one area, not a district pool
const demoBoothCopy = (m) => (m.demoBasis === "sa1" ? DB.sa1Booth : demoCopy(m));
// one income sentence for a seat or place facts list: both band shares,
// then the household median, in the census year's own dollars; "" when
// the place carries no income lane at all
function incFact(m, dm) {
  if (!dm) return "";
  const c = m.incomeCuts || {};
  const parts = [];
  if (dm.loinc != null || dm.hiinc != null) {
    const pair = [];
    if (dm.loinc != null) pair.push(`${f0(100 * dm.loinc)}% of adults live in households earning ${incLoFrag(m)}`);
    if (dm.hiinc != null) pair.push(`${f0(100 * dm.hiinc)}% in households earning ${mny(c.hiEdgeWeekly)} or more a week`);
    parts.push(`${pair.join(", ")}${incEpoch(m)}`);
  }
  if (dm.medIncWeekly != null) parts.push(`the median weekly household income is ${mny(dm.medIncWeekly)}${m.demoInterp && c.dollarsYear ? ` in ${c.dollarsYear} dollars` : ""}`);
  return parts.length ? `${parts.join("; ")}.` : "";
}
const DEMO_EARLY = { hed: "Census figures start at the 2001 election", dek: "The 2001 election reads the 2001 census; every election from 2004 to 2019 blends between the two censuses that bracket it to election day (2004 between the 2001 and 2006 censuses); 2022 reads the 2021 census. The timeline starts at 2001." };
function areaDemo(m, st, idx, where, isNowM) {
  const k = S.index, A = m.areas[st];
  if (!A.demo) return DEMO_EARLY;
  const scored = idx.filter((i) => demoShare(m.divs[i]) != null).sort((a, b) => demoShare(m.divs[b]) - demoShare(m.divs[a]));
  const share = `${f1(demoAreaShare(A.demo))}% ${isInc(k) ? "of the adults" : "of residents"}${where} ${dmVerb(m, k)}`;
  const note = demoCopy(m).seats;
  if (scored.length < 10) return { hed: cap(share), dek: note };
  const q = Math.round(scored.length / 5), high = scored.slice(0, q), low = scored.slice(-q);
  const fams = ["alp", "lnp", "ind", "grn", "onp", "oth"];
  const topOf = (xs) => fams.map((f) => [f, seatCount(m, xs, f)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const verbOf = (f) => (isNowM ? (f === "ind" || f === "grn" ? "hold" : "holds") : "won");
  const ht = topOf(high), lt = topOf(low);
  const top = isCob() ? COB_TOP[S.cob] : DM_TOP[k];
  const hed = `${cap(FAM_PL[ht[0][0]])} ${verbOf(ht[0][0])} ${ht[0][1]} of the ${q} ${top[0]}${where}`;
  const rest = lt.slice(1).map(([f, n]) => `${FAM_PL[f]} ${n}`);
  const dek = `Of the ${q} ${top[1]}, ${FAM_PL[lt[0][0]]} ${verbOf(lt[0][0])} ${lt[0][1]}${rest.length ? `, ${listAnd(rest)}` : ""}. Overall, ${share}. ${note}`;
  return { hed, dek };
}

function storyArea(m, st) {
  const aus = st === "AUS", { A, idx, N, cnt } = areaStats(m, st);
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const { hed, dek } = areaHedDek(m, st);
  const title = aus ? (m.year === "now" ? "The House today" : STATE_YEARS.has(m.year) ? (isNSW() ? "New South Wales election" : isVic() ? "Victorian election" : isQld() ? "Queensland election" : "South Australian election") : `${yearLabel(m.year)} election`) : STATE_TITLE[st];
  // never the date — the eyebrow line above the map already carries it
  const meta = aus ? (m.year === "now" ? `${N} members` : `${N} ${STATE_YEARS.has(m.year) ? "districts" : "seats"}`) : (m.year === "now" ? `${N} seats · members today` : `${N} seats · ${yearLabel(m.year)} election`);
  let h = head(title, meta, hed, dek);
  if (lensNumeric() && !(S.lens === "seifa" && isDemo() && !A.demo)) h += `<div class="st-sec"><h3>Across the seats <small>${esc(lensShort())}${aus ? "" : ", " + STATE_SHORT[st]}</small></h3>${distBlock(m, "seats", idx.map((i) => m.divs[i]), { compact: true })}</div>`;
  // the House: who holds the seats
  if (S.view !== "chamber") {
    const order = ["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f]);
    const counts = order.map((f) => `<span><i style="${swc(f)}"></i>${legW(f)} <b>${cnt[f]}</b></span>`).join("");
    h += `<div class="st-sec"><h3>${m.year === "now" ? "The chamber today" : "The new chamber"} <small>${aus ? "every member in their seat" : `${STATE_POSS[st]} members lit`}</small></h3><div class="st-chamber"><canvas id="minich" aria-label="${isSA() ? "The House of Assembly" : isNSW() || isVic() || isQld() ? "The Legislative Assembly" : "The House of Representatives"}, each member a chair"></canvas></div><div class="counts">${counts}</div></div>`;
  }
  if (m.year === "now" && aus) {
    const ch = m.changes.slice().reverse();
    h += `<div class="st-sec"><h3>Since the election <small>${ch.length} changes</small></h3><div class="changes">${ch.map((c) => `<button type="button" data-go="divname:${esc(c.div)}"><span class="dt">${shortDate(c.date).replace(/ 20(\d\d)$/, " ’$1")}</span><span class="tx"><b>${ds(c.div)}.</b> ${ds(c.text)}.</span></button>`).join("")}</div></div>`;
    h += `<p class="st-note" style="margin-top:22px">The figures below are the 2025 election’s.</p>`;
  }
  // the two-party read
  const swp = swingPhrase(A.tppSw, prev);
  const classicN = m.divs.filter((d) => d.tpp != null).length;
  h += `<div class="st-sec"><h3>Two-party preferred <small>Labor v ${coalW(1).replace("The ", "the ")}${aus ? "" : ", " + STATE_SHORT[st]}</small></h3><div class="hero">${heroPair("Labor", A.tpp, "alp", oppNameW(), 100 - A.tpp, "lnp")}${marginBar("Labor", "alp", oppNameW(), "lnp", A.tpp - (100 - A.tpp), 20)}<p class="hero-verdict"><b>${A.tpp >= 50 ? "Labor" : coalW(1)} ahead</b> by ${pts(Math.abs(2 * A.tpp - 100))}${swp ? `; ${swp}` : ""}.</p></div>${isState() ? `<p class="st-note">Only the ${classicN} districts whose count finished Labor against ${coalW(0)} carry this read; the ${commX()} publishes no notional two-party count for the rest.</p>` : ""}</div>`;
  h += `<div class="st-sec"><h3>Primary vote <small>% of formal votes${prev != null ? ` · change on ${prev}` : ""}</small></h3>${famRows(A.fp, A.fpSw)}</div>`;
  h += `<div class="st-sec"><h3>Informal <small>% of ballots cast</small></h3><div class="big"><span class="v">${f1(A.infPct)}%</span><span class="l">${aus ? "" : `${ausW()} ${f1(m.areas.AUS.infPct)}%`}</span></div></div>`;
  const bySt = aus ? STATES.filter((s) => m.areas[s]) : [];
  // a one-row "by state" table says nothing the headline didn't (SA frames list SA alone)
  if (bySt.length > 1) {
    h += `<div class="st-sec"><h3>By state</h3><table class="tbl"><thead><tr><th>State</th><th>Seats</th><th>Labor 2PP</th><th>Swing</th></tr></thead><tbody>${bySt.map((s) => { const a = m.areas[s]; const sc = {}; for (const i of a.idx) { const f = holdFam(m.divs[i].hold); sc[f] = (sc[f] || 0) + 1; } const bar = ["alp", "grn", "ind", "csa", "oth", "onp", "lnp"].filter((f) => sc[f]).map((f) => `<i style="width:${(100 * sc[f]) / a.idx.length}%;${swc(f)}"></i>`).join(""); return `<tr data-go="state:${s}"><td>${STATE_TITLE[s].replace("Australian Capital Territory", "ACT").replace("Northern Territory", "NT")}</td><td>${a.idx.length}<span class="seatbar">${bar}</span></td><td>${f1(a.tpp)}</td><td>${a.tppSw != null ? sgn(a.tppSw) : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  const close = idx.map((i) => m.divs[i]).filter((d) => !d.by).sort((a, b) => a.margin - b.margin).slice(0, 6).map((d) => ({ i: d.i, v: d.margin }));
  h += `<div class="st-sec"><h3>Closest seats <small>winning margin, points</small></h3>${linkRows(m, close, (v, d) => f1(v), (i) => colCss(m.divCol[i]))}</div>`;
  h += foot(m);
  return h;
}

/* ----- a seat ----- */
// the election a seat's swings are measured against: "Now" shows the 2025
// count (against 2022) everywhere but Farrer, whose by-election is set against 2025
const prevFor = (m, d) => (m.year === "now" ? (d && d.by ? 2025 : 2022) : prevYearOf(m.year) ?? (m.res && m.res.prev));
function seatHedDek(m, d) {
  const prev = prevFor(m, d);
  const [wn, rn] = pairNames(d.win, d.run);
  const wParty = theParty(d.win.ab, d.win.pn), rParty = partyName(d.run.ab, d.run.pn);
  const close = d.votesMargin < 1500 && d.margin < 1;
  switch (S.lens) {
    case "winner": {
      if (d.by) {
        const hed = `One Nation’s David Farley won Farrer at the May 2026 by-election`;
        const dek = `He beat the independent Michelle Milthorpe ${f1(d.winPct)}–${f1(100 - d.winPct)} after preferences. Sussan Ley had held the seat for the Liberals since 2001; their candidate, Raissa Butkowski, ran third on ${f1(d.fp.lnp ? (100 * d.c.find((c) => c.ab === "LP").v) / d.formal : 0)}% of first preferences. Labor didn’t stand.`;
        return { hed, dek };
      }
      const hold = d.hold, switched = m.year === "now" && (hold.n !== d.win.n || hold.ab !== d.win.ab);
      if (switched) {
        const ch = m.changes.filter((c) => c.div === d.n).pop();
        const hed = hold.ab === "CSA" ? `${ds(hold.n)} now sits for Community Strong` : `${ds(hold.n)} now sits for ${esc(leaderName(hold))}`;
        const dek = hold.ab === "CSA"
          ? `She won ${ds(d.n)} as an independent in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)}), and co-founded Community Strong Australia on ${longDate(ch.date)}.`
          : `He won ${ds(d.n)} for the Nationals in 2025, ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)}). He left the Nationals on 27 November 2025 and joined One Nation on ${longDate(ch.date)}.`;
        return { hed, dek };
      }
      let hed;
      const ch = d.change;
      if (ch.kind === "re") hed = close ? `${ds(d.win.n)} held ${ds(d.n)} by ${int(d.votesMargin)} votes` : `${ds(d.win.n)} held ${ds(d.n)}`;
      else if (ch.kind === "held") hed = `${ds(d.win.n)} kept ${ds(d.n)} for ${ds(wParty)}`;
      else if (ch.kind === "gain") hed = ch.prev && FAM(ch.prev[2]) === d.win.fam ? `${ds(d.win.n)} won ${ds(d.n)} from ${ds(ch.prev[3])}` : `${ds(d.win.n)} won ${ds(d.n)} from ${ds(theParty(ch.prev[2]))}`;
      else if (ch.kind === "new") hed = `${ds(d.win.n)} won the new seat of ${ds(d.n)}`;
      else hed = `${ds(d.win.n)} won ${ds(d.n)}`;
      if (close && ch.kind !== "re") hed += ` by ${int(d.votesMargin)} votes`;
      const fpLead = [...d.c].sort((a, b) => b.v - a.v)[0];
      let dek = `${ds(wn)} won the final count ${f1(d.winPct)}–${f1(100 - d.winPct)} against ${ds(rn)} (${esc(rParty)})`;
      if (d.classic && d.tppSw != null) dek += `, ${swingPhrase(d.tppSw, prev)}`;
      dek += ".";
      if (fpLead !== d.win) dek += ` ${ds(surname(fpLead.n))} led on first preferences, ${f1((100 * fpLead.v) / d.formal)}% to ${f1((100 * d.win.v) / d.formal)}%.`;
      dek += ` ${isState() ? "On the usual scale" : "By the AEC’s measure"} that makes ${ds(d.n)} ${statusOf(d.winPct)}.`;
      if (ch.kind === "re" && ch.since < (m.year === "now" ? 2025 : m.year)) dek += ` ${ds(surname(d.win.n))} has held it since ${ch.since}.`;
      return { hed, dek };
    }
    case "tpp": {
      if (d.tpp == null) return { hed: `There was no Labor v ${oppNameW()} count in ${ds(d.n)}`, dek: isState() ? `The ${commX()} publishes a two-party count only where the final pair is Labor against ${coalW(0)}.` : d.by ? "Labor didn’t stand at the by-election, so the AEC counted the final two only: One Nation against the independent." : "" };
      if (S.tppMode === "swing") {
        const s = d.tppSw;
        const hed = s == null ? `${ds(d.n)} has no recorded swing` : Math.abs(s) < 0.05 ? `There was no two-party swing in ${ds(d.n)}` : `${ds(d.n)} swung ${pts(s)} to ${s > 0 ? "Labor" : coalW()}`;
        const aus = m.areas.AUS.tppSw;
        return { hed, dek: s == null ? "" : `Across ${ausW()} the swing was ${pts(aus)} to ${aus > 0 ? "Labor" : coalW()}. The ${isState() ? commX() : "AEC"} measures a seat’s swing against its result last time, adjusted where its boundaries were redrawn.` };
      }
      const lead = d.tpp >= 50;
      const hed = `${lead ? "Labor" : coalW(1)} won ${f1(lead ? d.tpp : 100 - d.tpp)}% of the two-party vote in ${ds(d.n)}`;
      const sp = swingPhrase(d.tppSw, prev);
      const dek = d.classic ? `The final count was Labor against ${coalW()}${sp ? `, ${sp}` : ""}.` : `The final two here were ${ds(rn)} and ${ds(wn)}, so this is the ${isState() ? commX() + "’s" : "AEC’s"} notional count of Labor against ${coalW()}${sp ? `, ${sp}` : ""}.`;
      return { hed, dek };
    }
    case "fp": {
      const P = S.party, name = legW(P), v = d.fp[P];
      if (S.fpMode === "change") {
        const c = fpChange(m, d, P);
        if (c == null) return { hed: `${SUBJ[P]} didn’t stand in ${ds(d.n)} both times`, dek: "" };
        return { hed: Math.abs(c) < 0.05 ? `${Poss(P)} primary vote in ${ds(d.n)} was unchanged` : `${Poss(P)} primary vote ${c >= 0 ? "rose" : "fell"} ${pts(c)} in ${ds(d.n)}`, dek: `${SUBJ[P]} won ${f1(v)}% of first preferences${d.by ? " at the by-election, against the seat’s 2025 count" : ""}.` };
      }
      if (!v) return { hed: `${name === "Independents" ? "No independent" : name} didn’t stand in ${ds(d.n)}`.replace("No independent didn’t", "No independent stood"), dek: "" };
      const aus = m.areas.AUS.fp[P];
      return { hed: `${name} won ${f1(v)}% of first preferences in ${ds(d.n)}`, dek: `Across Australia ${name === "Independents" ? "independents" : name} won ${f1(aus)}%.` };
    }
    case "senate": {
      const P = S.party, name = legW(P), pr = senPron(P);
      if (svYear(m.year) == null) return { hed: `A state election has no Senate`, dek: "" };
      if (d.by) return { hed: `${ds(d.n)}’s by-election had no Senate vote`, dek: `Choose 2025 on the timeline to set the Senate against ${ds(d.n)}’s 2025 House count.` };
      const s = svOf(m), sv = s && svShare(s.divs[d.n], P);
      if (sv == null) return { hed: `The Senate’s votes are loading`, dek: "" };
      const h = d.fp[P], cands = d.c.filter((c) => c.b === P).length, aus = senArea(m, m.areas.AUS.idx, P);
      if (!cands) return { hed: P === "ind" ? `No independent stood for the House in ${ds(d.n)}` : P === "oth" ? `No other candidate stood for the House in ${ds(d.n)}` : `${name} didn’t stand for the House in ${ds(d.n)}`, dek: `${SUBJ[P]} won ${f1(sv)}% of the Senate vote here${aus ? `, against ${f1(aus.sen)}% across Australia` : ""}.` };
      if (senGap()) return { hed: `${SUBJ[P]} ${senGapWords(sv - h)} in ${ds(d.n)}`, dek: `${f1(sv)}% of Senate first preferences against ${f1(h)}% for ${pr.its} House ${cands > 1 ? "candidates" : "candidate"}.${aus ? ` Across Australia the gap was ${sgn(aus.gap)} points.` : ""}` };
      return { hed: `${SUBJ[P]} won ${f1(sv)}% of the Senate vote in ${ds(d.n)}`, dek: `${pr.Its} House ${cands > 1 ? "candidates" : "candidate"} won ${f1(h)}%${aus ? `; across Australia ${pr.its} Senate vote was ${f1(aus.sen)}%` : ""}.` };
    }
    case "flow": {
      const F = S.from, nm = possW(F), rival = vsW();
      if (!flowSeat(d)) return { hed: `${ds(d.n)}’s count didn’t end Labor against ${rival}`, dek: `Its final two were ${ds(d.win.n)} and ${ds(d.run.n)}, so its preferences weren’t split between Labor and ${rival}.${d.vs && d.vs !== S.vs ? ` Set the preferences lens to Labor against ${d.vs === "onp" ? "One Nation" : coalW()} to read it.` : ""}` };
      const v = d.flowAlp[F];
      if (v == null) {
        const stood = d.c.some((c) => c.b === F);
        const who = F === "ind" ? "No independent" : F === "oth" ? "No other candidate" : famLeg(F);
        return { hed: stood ? `${cap(nm)} preferences weren’t distributed in ${ds(d.n)}` : F === "ind" || F === "oth" ? `${who} stood in ${ds(d.n)}` : `${who} didn’t stand in ${ds(d.n)}`, dek: stood ? "Its candidate finished in the final two, so its votes were never passed on." : "" };
      }
      if (m.res.flBasis === "modelled") {
        const e = flowErrOf(m, F);
        return { hed: `${f0(v)}% of ${nm} preferences in ${ds(d.n)} modelled to go to Labor`, dek: `The rest, ${f0(100 - v)}%, to ${rival} — an estimate: South Australia publishes no per-candidate split.${e ? ` ${cap(flowErrWords(e))}.` : ""}` };
      }
      let ex = 0, xt = 0;
      if (m.res.flOpv) for (const f of d.flows) if (f.cand.b === F && f.exh != null) { ex += f.exh; xt += f.ta + f.tb + f.exh; }
      const opc = xt ? ` Another ${f0((100 * ex) / xt)}% of ${nm} ballots exhausted before the final two — New South Wales votes optional-preferential.` : "";
      return { hed: `${f0(v)}% of ${nm} preferences in ${ds(d.n)} went to Labor`, dek: `The rest, ${f0(100 - v)}%, went to ${rival}.${opc}` };
    }
    case "informal": {
      if (infModeOf(m) === "exhaust") {
        const xs = [...m.divs].filter((x) => x.exhPct != null).sort((a, b) => b.exhPct - a.exhPct);
        const r = xs.findIndex((x) => x.i === d.i) + 1;
        return { hed: `${f1(d.exhPct)}% of ${ds(d.n)}’s ballots exhausted before the final two`, dek: `New South Wales votes optional-preferential, so a ballot leaves the count when its numbered candidates are gone. That’s ${rankWords(r, xs.length)} rate of the ${xs.length} seats${byNote(d)}; across the state it was ${f1(m.areas.NSW.exhPct)}%.` };
      }
      const r = [...m.divs].filter((x) => x.infPct != null).sort((a, b) => b.infPct - a.infPct).findIndex((x) => x.i === d.i) + 1;
      return { hed: `${f1(d.infPct)}% of ${ds(d.n)}’s ballots were informal`, dek: `That’s ${rankWords(r, m.divs.length)} rate of the ${m.divs.length} seats${byNote(d)}; across Australia it was ${f1(m.areas.AUS.infPct)}%.` };
    }
    case "cls": return { hed: d.cls ? `${ds(d.n)} is ${/^[aeiou]/i.test(CLS_LOWER[d.cls]) ? "an" : "a"} ${CLS_LOWER[d.cls]} seat` : `${ds(d.n)} has no AEC type on record`, dek: d.cls ? `${CLS_DEF[d.cls]}, in the AEC’s words.` : "" };
    case "seifa": {
      if (isDemo()) {
        const k = S.index;
        if (!d.demo) return m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY : { hed: `${ds(d.n)} has no census figure`, dek: "" };
        const xs = m.divs.filter((x) => demoShare(x) != null).sort((a, b) => demoShare(b) - demoShare(a)), r = xs.findIndex((x) => x.i === d.i) + 1;
        const aus = m.areas.AUS.demo;
        return { hed: `${f0(100 * demoShare(d))}% of ${ds(d.n)}’s ${isInc(k) ? "adults" : "residents"} ${dmVerb(m, k)}`, dek: `That’s ${rankWords(r, xs.length)} share of the ${xs.length} seats; across ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}, ${f1(demoAreaShare(aus))}%. ${demoCopy(m).seats}` };
      }
      const c = d.seifa[S.index];
      if (!c || !c.dec) return { hed: `${ds(d.n)} has no ${IX_ABBR[S.index]} score`, dek: "" };
      const where = c.dec === 10 ? "among the most advantaged tenth of seats" : c.dec === 1 ? "among the least advantaged tenth of seats" : c.dec <= 5 ? `in the ${ordw(c.dec)} tenth of seats, counted from the least advantaged` : `in the ${ordw(11 - c.dec)} tenth of seats, counted from the most advantaged`;
      return { hed: `${ds(d.n)} is ${where}`, dek: `On the ABS’s ${IX_NAME[S.index].toLowerCase()} index (${IX_ABBR[S.index]}), ${m.year === "now" || m.year >= 2022 ? "from the 2021 census" : "interpolated between censuses to election day"}.` };
    }
  }
  return { hed: "", dek: "" };
}

function storyDiv(m, i) {
  const d = m.divs[i];
  const prev = prevFor(m, d);
  const { hed, dek } = seatHedDek(m, d);
  const meta = `${d.cls ? esc(CLS_SHORT[d.cls]) + " · " : ""}${esc(STATE_TITLE[d.st])}${d.by ? " · by-election, 9 May 2026" : ""}`;
  let h = head(d.n, meta, hed, dek);
  const [wn, rn] = pairNames(d.win, d.run);
  h += `<div class="st-sec"><h3>Final count <small>${d.by ? "the by-election’s" : "two candidates"}</small></h3><div class="hero">${heroPair(wn, d.winPct, d.win.fam, rn, 100 - d.winPct, d.run.fam)}${marginBar(wn, d.win.fam, rn, d.run.fam, 2 * d.winPct - 100)}<p class="hero-verdict"><b>${ds(wn)}</b> by ${int(d.votesMargin)} votes · ${statusOf(d.winPct)}</p></div></div>`;
  if (d.tpp != null && !d.classic) h += `<div class="st-sec"><h3>Two-party preferred <small>the AEC’s notional count</small></h3><div class="hero">${heroPair("Labor", d.tpp, "alp", "Coalition", 100 - d.tpp, "lnp")}</div><p class="st-note">${swingPhrase(d.tppSw, prev).replace(/^./, (c) => c.toUpperCase())}.</p></div>`;
  const prevDiv = d.by ? d.by.prev : null;
  const moved = movedTo(m, d);
  const winPartyOf = moved ? (c) => (c === d.win ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  h += `<div class="st-sec"><h3>First preferences <small>% · change${d.by ? " on 2025" : ""}</small></h3>${candRows(d.c, d.formal, null, 7, d.by ? (c) => byChange(c, d, prevDiv) : null, winPartyOf)}</div>`;
  const fl = flowRows(d.flows, d.A, d.B);
  if (fl) h += `<div class="st-sec"><h3>Where preferences went <small>to the final two</small></h3>${fl}</div>`;
  if (d.vt) {
    const vt = d.vt, tot = vt.ord + vt.pre + vt.post + vt.abs + vt.prov;
    const parts = [["On the day", vt.ord - vt.ppvc, "var(--ink-2)"], ["Early, in person", vt.ppvc + vt.pre, "var(--ink-faint)"], ["Postal", vt.post, "var(--accent)"], ["Absent and other", vt.abs + vt.prov, "var(--line)"]];
    h += `<div class="st-sec"><h3>How votes were cast <small>${int(tot)} formal</small></h3><div class="stack">${parts.map(([l, v, c]) => `<i style="width:${(100 * v) / tot}%;background:${c}" title="${l}"></i>`).join("")}</div><div class="stackl">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l}<b>${f0((100 * v) / tot)}%</b></span>`).join("")}</div></div>`;
  }
  h += `<div class="st-sec"><h3>Informal</h3><div class="big"><span class="v">${f1(d.infPct)}%</span><span class="l">of ballots · Australia ${f1(m.areas.AUS.infPct)}%</span></div>${d.by ? `<p class="st-note">Turnout was ${f1((100 * d.by.turnout) / d.by.enrolment)}% of ${int(d.by.enrolment)} enrolled.</p>` : ""}</div>`;
  const incRow = d.demo ? incFact(m, d.demo) : "";
  const origV = isCob() && d.demo && d.demo.cob ? d.demo.cob[S.cob] : null;
  const demoFacts = d.demo ? `<dt>Language</dt><dd>${f0(100 * d.demo.lang)}% of residents speak a language other than English at home</dd><dt>Origin</dt><dd>${origV != null ? `${f0(100 * origV)}% ${COB_VERB[S.cob]}` : `${f0(100 * d.demo.fborn)}% ${DM_VERB.fborn}`}</dd><dt>Education</dt><dd>${f0(100 * d.demo.uni)}% ${DM_VERB.uni}</dd><dt>Work</dt><dd>${f0(100 * d.demo.blue)}% ${DM_VERB.blue}</dd><dt>Age</dt><dd>${f0(100 * d.demo.a65)}% are 65 or older, ${f0(100 * d.demo.a2034)}% are 20 to 34</dd>${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}` : "";
  const hasDeciles = IX.some((ix) => d.seifa[ix] && d.seifa[ix].dec);
  const deciles = hasDeciles ? decileRows((ix) => d.seifa[ix] && d.seifa[ix].dec) : "";
  const seatNote = `${demoCopy(m).note}${deciles ? ` 1 is the most disadvantaged tenth of the ${m.divs.length} seats, 10 the most advantaged.` : ""}`;
  const seatSmall = m.demoBasis === "sa1" ? `ABS census, ${m.demoYear ?? 2021}` : "AEC type · ABS census and SEIFA, deciles among seats";
  if (d.cls || d.demo || deciles) h += `<div class="st-sec"><h3>The seat <small>${seatSmall}</small></h3>${d.cls || d.demo ? `<dl class="facts">${d.cls ? `<dt>Type</dt><dd>${esc(CLS_SHORT[d.cls])}: ${esc(CLS_DEF[d.cls])}</dd>` : ""}${demoFacts}</dl>` : ""}${deciles}<p class="st-note">${seatNote}</p></div>`;
  h += historyChart(d);
  // polling places
  const b = m.booth, js = b.byDiv[i];
  const nPP = js.filter((j) => b.ty[j] === 1).length, nEV = js.filter((j) => b.ty[j] === 5).length, nMob = js.length - nPP - nEV;
  let bl = "";
  if (lensNumeric()) {
    const vals = js.map((j) => ({ j, v: boothValue(m, j) })).filter((x) => x.v != null && b.votes[x.j] >= 100).sort((p, q) => q.v - p.v);
    const fmt = (v) => (S.lens === "seifa" ? `${v}` : (S.lens === "tpp" && S.tppMode === "swing") || (S.lens === "fp" && S.fpMode === "change") || (S.lens === "senate" && senGap()) ? sgn(v) : f1(v));
    const li = (arr) => `<div class="links">${arr.map(({ j, v }) => `<button type="button" data-go="booth:${j}"><i style="background:${colCss(m.boothCol[j])}"></i><span class="nm">${ds(b.name[j])}<small>${int(b.votes[j])} votes</small></span><b>${fmt(v)}</b></button>`).join("")}</div>`;
    if (vals.length >= 6) bl = `<p class="st-note">Highest</p>${li(vals.slice(0, 3))}<p class="st-note">Lowest</p>${li(vals.slice(-3).reverse())}${distBlock(m, "booths", js, { compact: true })}`;
  } else if (S.lens === "winner") {
    const led = {}; for (const j of js) if (b.lead[j]) led[b.lead[j].n] = (led[b.lead[j].n] || 0) + 1;
    bl = `<div class="counts">${[d.A, d.B].map((c) => `<span><i style="${swc(c.fam)}"></i>${ds(surname(c.n))} led <b>${led[c.n] || 0}</b></span>`).join("")}</div>`;
  }
  h += `<div class="st-sec"><h3>Polling places <small>${nPP} on the day · ${nEV} early${nMob ? ` · ${nMob} mobile` : ""}</small></h3>${bl}<div class="act"><button type="button" data-listbooths>All ${js.length} in the list</button>${S.view !== "map" ? `<button type="button" data-showmap>Show on the map</button>` : ""}</div></div>`;
  h += foot(m);
  return h;
}

// a by-election candidate against the 2025 count: the same person if they stood
// then, otherwise the same party where each count has exactly one of it
function byChange(c, d, prevDiv) {
  const pct = (100 * c.v) / d.formal;
  const same = prevDiv.c.find((x) => x.n === c.n);
  if (same) return pct - (100 * same.v) / prevDiv.formal;
  if (c.ab === "IND") return null;
  const now = d.c.filter((x) => x.ab === c.ab), then = prevDiv.c.filter((x) => x.ab === c.ab);
  if (now.length !== 1) return null;
  if (!then.length) return pct;
  return then.length === 1 ? pct - (100 * then[0].v) / prevDiv.formal : null;
}

/* ----- a polling place ----- */
function storyBooth(m, j) {
  const b = m.booth, D = m.divs[b.d[j]], raw = b.raw;
  const where = [b.prem[j], [b.sub[j], b.pc[j]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tc = raw.tcp[j];
  let hed = ds(b.name[j]), dek = "";
  const lead = b.lead[j];
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb, lp = (100 * Math.max(ta, tb)) / tot;
    const left = ta >= tb ? D.A : D.B, right = ta >= tb ? D.B : D.A;
    const [ln, rn] = pairNames(left, right);
    switch (S.lens) {
      case "tpp":
        if (!Number.isNaN(b.tpp[j])) {
          if (S.tppMode === "swing") { const s = nn(b.tppSw[j]); hed = s == null ? `This place has no swing on record` : `${pts(s)} swing to ${s >= 0 ? "Labor" : "the Coalition"} here`; dek = s == null ? "It wasn’t used at the previous election." : ""; }
          else { const t2 = b.tpp[j]; hed = `${t2 >= 50 ? "Labor" : "The Coalition"} won ${f1(Math.max(t2, 100 - t2))}% of the two-party vote here`; }
          break;
        }
      // falls through when there's no two-party count
      default:
        hed = `${ds(ln)} won this place ${f0(lp)}–${f0(100 - lp)}`;
        dek = `${int(b.votes[j])} votes were cast here, ${f1(b.infPct[j])}% informal. Across ${ds(D.n)}, ${ds(surname(D.win.n))} won ${f1(D.winPct)}–${f1(100 - D.winPct)}.`;
        void rn;
    }
    if (S.lens === "fp") { const v = b.fp[S.party][j]; hed = `${famLeg(S.party)} won ${f1(v)}% of first preferences here`; dek = `In ${ds(D.n)} as a whole, ${f1(D.fp[S.party])}%.`; }
    if (S.lens === "senate") {
      const v = senBoothValue(m, j), dv = senDivValue(m, D);
      if (v == null) { hed = senNoValue(m, "booth", D); dek = ""; }
      else if (senGap()) { hed = `${SUBJ[S.party]} ${senGapWords(v)} here`; dek = `${f1(svShare(svOf(m).booths[b.id[j]], S.party))}% of Senate first preferences against ${f1(b.fp[S.party][j])}% in the House.${dv != null ? ` Across ${ds(D.n)} the gap was ${sgn(dv)} points.` : ""}`; }
      else { hed = `${SUBJ[S.party]} won ${f1(v)}% of the Senate vote here`; dek = dv != null ? `In ${ds(D.n)} as a whole, ${f1(dv)}%.` : ""; }
    }
    if (S.lens === "informal") {
      if (infModeOf(m) === "exhaust") { hed = `${f1(D.exhPct)}% of ${ds(D.n)}’s ballots exhausted before the final two`; dek = "New South Wales re-counts ballots by district, not by polling place — the rate shown is the district’s."; }
      else { hed = `${f1(b.infPct[j])}% of ballots here were informal`; dek = `In ${ds(D.n)} as a whole, ${f1(D.infPct)}%.`; }
    }
    if (S.lens === "seifa" && isDemo()) { const k = S.index, v = demoBoothShare(raw, j, m.cobPos || {}), pct = v == null ? null : 100 * v, dv = D.demo && demoShare(D); hed = pct == null ? (m.year !== "now" && m.year < DEMO_FROM ? DEMO_EARLY.hed : "This place has no census figure") : `${f0(pct)}% ${isInc(k) ? demoBoothCopy(m).whoAdults : demoBoothCopy(m).who} ${dmVerb(m, k)}`; dek = pct == null ? "" : `In ${ds(D.n)} as a whole, ${dv != null ? f1(100 * dv) : "–"}%. ${demoBoothCopy(m).note}`; }
    else if (S.lens === "seifa") { const arr = S.basis === "voters" ? raw.vdec[j] : raw.dec[j]; const v = arr ? arr[IX.indexOf(S.index)] : null; hed = v ? `This place is in decile ${v} of 10 on ${IX_ABBR[S.index]}` : `This place has no ${IX_ABBR[S.index]} score`; dek = S.basis === "voters" ? "Scored on where its voters live." : "Scored on the census area it stands in."; }
    if (S.lens === "cls") { hed = `${ds(D.n)} is ${/^[aeiou]/i.test(CLS_LOWER[D.cls] || "") ? "an" : "a"} ${CLS_LOWER[D.cls] || ""} seat`; }
  }
  // the flow hed needs no per-booth count: the NSWEC carries no booth 2CP,
  // so nsw23 booths have no lead/tcp and the copy would never render here
  if (S.lens === "flow") {
    if (m.res.flBasis === "modelled") { hed = flowSeat(D) ? `Preference flows aren’t modelled by polling place` : `No preference split is modelled in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s modelled split is a district figure — read it on the district’s card.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else if (m.res.flOpv) { hed = flowSeat(D) ? `Preference flows aren’t counted by polling place` : `No preference split was counted in ${ds(D.n)}`; dek = flowSeat(D) ? `${ds(D.n)}’s split is a district figure — read it on the district’s card. New South Wales re-counts ballots by district, not by polling place.` : `Its count didn’t finish Labor against ${vsW()}.`; }
    else { const v = flowSeat(D) ? nn(b.flowAlp[S.from][j]) : null; hed = v == null ? `No ${S.from === "ind" ? "independent’s" : famLeg(S.from) + "’"} preferences were split here between Labor and ${vsW()}` : `${f0(v)}% of ${S.from === "ind" ? "independents’" : S.from === "oth" ? "other candidates’" : famLeg(S.from) + "’"} preferences here went to Labor`; }
  }
  let h = head(b.name[j], `${esc(TYPE[b.ty[j]] || "Polling place")}${where ? " · " + ds(where) : ""}`, hed, dek);
  if (lead && tc) {
    const ta = tc[0], tb = tc[1], tot = ta + tb;
    const [an, bn] = pairNames(D.A, D.B);
    h += `<div class="st-sec"><h3>Final count here <small>two candidates</small></h3><div class="hero">${heroPair(an, (100 * ta) / tot, D.A.fam, bn, (100 * tb) / tot, D.B.fam)}${marginBar(an, D.A.fam, bn, D.B.fam, (200 * ta) / tot - 100)}</div></div>`;
  }
  if (!Number.isNaN(b.tpp[j]) && !D.classic) h += `<div class="st-sec"><h3>Two-party preferred <small>notional</small></h3><div class="hero">${heroPair("Labor", b.tpp[j], "alp", "Coalition", 100 - b.tpp[j], "lnp")}</div></div>`;
  if (!Number.isNaN(b.tpp[j])) { const s0 = nn(b.tppSw[j]); h += `<p class="st-note">${s0 == null ? "This place wasn’t used at the previous election, so it has no swing." : Math.abs(s0) < 0.05 ? "No two-party swing here." : `A two-party swing of ${pts(s0)} to ${s0 > 0 ? "Labor" : "the Coalition"} here.`}</p>`; }
  const cands = D.c.map((c, k) => ({ ...c, v: raw.v[j][k], el: false }));
  const pf = raw.prevFp ? raw.prevFp[j] : null;
  const moved = movedTo(m, D);
  const wk = D.c.indexOf(D.win);
  const winPartyOf = moved ? (c) => (c.k === wk ? `${partyName(c.ab, c.pn)} · now ${moved}` : partyName(c.ab, c.pn)) : null;
  if (b.formal[j]) h += `<div class="st-sec"><h3>First preferences here <small>% · tick = the whole seat${pf ? " · change on 2025 here" : ""}</small></h3>${candRows(cands, b.formal[j], (c) => (100 * D.c[c.k].v) / D.formal, 0, pf ? (c) => { const same = D.c.filter((x) => x.b === c.b).length === 1; return same ? (100 * c.v) / b.formal[j] - pf[c.b] : null; } : () => null, winPartyOf)}</div>`;
  const fl = raw.fl[j];
  if (fl && fl.length) { const fb = flowRows(fl.map(([ci, ta, tb]) => ({ cand: D.c[ci], ta, tb })), D.A, D.B); if (fb) h += `<div class="st-sec"><h3>Where preferences went here</h3>${fb}</div>`; }
  const dec = raw.dec[j], vdec = raw.vdec[j], dr = raw.demo && raw.demo[j], dc = demoBoothCopy(m);
  const incRow = dr ? incFact(m, { loinc: dr[6], hiinc: dr[7] }) : "";
  const origB = isCob() && raw.cob && raw.cob[j] ? raw.cob[j][m.cobPos[S.cob]] : null;
  const demoRows = dr ? `<dl class="facts">${dr[0] != null ? `<dt>Language</dt><dd>${f0(100 * dr[0])}% ${dc.who} speak a language other than English at home</dd>` : ""}${dr[3] != null ? `<dt>Origin</dt><dd>${origB != null ? `${f0(100 * origB)}% ${COB_VERB[S.cob]}` : `${f0(100 * dr[3])}% ${DM_VERB.fborn}`}</dd>` : ""}${dr[4] != null ? `<dt>Education</dt><dd>${f0(100 * dr[4])}% ${DM_VERB.uni}</dd>` : ""}${dr[5] != null ? `<dt>Work</dt><dd>${f0(100 * dr[5])}% ${DM_VERB.blue}</dd>` : ""}${incRow ? `<dt>Income</dt><dd>${incRow}</dd>` : ""}${dr[1] != null && dr[2] != null ? `<dt>Age</dt><dd>${f0(100 * dr[1])}% are 65 or older, ${f0(100 * dr[2])}% are 20 to 34</dd>` : ""}</dl><p class="st-note">${dc.note}</p>` : "";
  h += `<div class="st-sec"><h3>The neighbourhood <small>ABS census and SEIFA, national deciles</small></h3>${dec || vdec ? decileRows((ix) => (dec ? dec[IX.indexOf(ix)] : null), (ix) => (vdec && vdec[IX.indexOf(ix)] ? ` · its voters ${vdec[IX.indexOf(ix)]}` : "")) : '<p class="st-note">No SEIFA score: this place has no fixed address, or its census area is too small to publish.</p>'}<p class="st-note">The bars score the census area the place stands in.${isState() ? "" : " From 2016, where the AEC records it, “its voters” scores the areas its voters live in."}</p>${demoRows}</div>`;
  h += `<div class="act"><button type="button" data-go="div:${D.i}">Back to ${ds(D.n)}</button><button type="button" data-listbooths>All places in ${ds(D.n)}</button></div>`;
  h += foot(m);
  return h;
}

function foot(m) {
  const src = m.year === "now" ? "AEC results for the 2025 election (event 31496) and the 2026 Farrer by-election (event 31633); members’ changes of party from the parties and the APH" : QLD_YEARS.has(m.year) ? `ECQ results for the ${yearLabel(m.year)} state election` : SA_YEARS.has(m.year) ? `ECSA results for the ${yearLabel(m.year)} state election` : NSW_YEARS.has(m.year) ? `NSWEC results for the ${yearLabel(m.year)} state election` : VIC_YEARS.has(m.year) ? `VEC results for the ${yearLabel(m.year)} state election` : `AEC results for the ${m.year} election (event ${m.res.event})`;
  return `<p class="st-foot">${src}. ${QLD_YEARS.has(m.year) ? "ECQ boundaries; ABS census" : SA_YEARS.has(m.year) ? "ECSA boundaries; ABS census" : NSW_YEARS.has(m.year) ? "NSWEC boundaries; ABS census" : VIC_YEARS.has(m.year) ? "VEC boundaries; ABS census" : "AEC boundaries and seat types; ABS SEIFA"}.</p>`;
}
let storyKey = "";
function renderStory(force) {
  const m = M(); if (!m) return;
  const s = S.sel;
  if (S.view === "chamber" && S.house === "senate") {
    if (!SENM) return;
    const ss = S.ssel, key = ["senate", S.senLens, ss.level, ss.st, ss.i].join("|");
    if (!force && key === storyKey) return;
    storyKey = key;
    $("#story").innerHTML = storySenate(SENM);
    return;
  }
  const key = [S.year, S.lens, S.tppMode, S.fpMode, S.senMode, S.party, S.from, S.vs, S.index, S.basis, S.view, s.level, s.st, s.div, s.booth, filtersKey()].join("|");
  if (!force && key === storyKey) return;
  storyKey = key;
  const el = $("#story");
  el.innerHTML = s.level === "aus" ? storyArea(m, "AUS") : s.level === "state" ? storyArea(m, s.st) : s.level === "div" ? storyDiv(m, s.div) : storyBooth(m, s.booth);
  // the charts fill in now, not a frame on: a block that grows after the
  // story paints moves everything below it, and a walk's hold with it
  paintMiniChamber(); hydrateDists();
}
