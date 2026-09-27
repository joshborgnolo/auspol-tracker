/* auspol tracker – the redesign's "Latest and next polls" (Sep 2026).

   One row per pollster replaces the Snapshot's two panels: its newest poll,
   a strip of its releases either side of today, and the earliest its next
   could land. The projection is np-project.js's (the same one the tab bar's
   countdown runs), and the figures are the Latest table's own, so nothing
   here is a second estimate of anything. */

const RD_PL_FACETS = [{ id: "twopp", label: "2PP" }, { id: "primary", label: "Primary" }, { id: "leadership", label: "Leadership" }];
const RD_PL_PARTIES = [["alp", "ALP"], ["lnp", "L/NP"], ["grn", "GRN"], ["onp", "ON"], ["oth", "OTH"]];
const RD_STALE_DAYS = 42;

/* the table's shape of a poll, for a pollster with a projection but no row
   in the Latest table (one that has gone quiet) */
function rdPollRow(p) {
  const pub = p.published || p.released;
  const d = new Date(pub.slice(0, 10) + "T00:00:00Z");
  const lab = d.getUTCDate() + " " + window.AUSPOL.monthName(d.getUTCMonth() + 1);
  return { pollster: p.pollster, client: p.client, field: p.dateLabel || p.field, released: p.released,
           published: p.published, publishedLabel: lab, pubSort: pub, sample: p.sample,
           alpImp: p.alpImp, alpOnImp: p.alpOnImp, alp2pp: p.alp, lnp2pp: p.lnp, p: p.p || {},
           tppAlt: p.tppAlt, tppAlt2: p.tppAlt2, ppmSets: p.ppmSets, appr: p.appr || {}, chg: p.chg, url: p.url };
}

function RdPolls({ tppBasis, setTppBasis, tppMatchup, setTppMatchup }) {
  const { D } = window.AP;
  /* a tablet has no room for the release strip beside five columns, so it
     takes the phone's cards too */
  const narrow = useNarrow("(max-width: 900px)");
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({ key: "latest", dir: -1 });
  const [open, setOpen] = useState(null);
  const measure = window.AP.measureOfMatchup(tppMatchup);
  const basis = tppBasis || "imp";
  const proj = window.AP.nextPolls ? window.AP.nextPolls() : { rows: [], t0: 0, nowMs: 0 };
  const { t0, nowMs } = proj;

  /* ---- one entry per pollster ------------------------------------------- */
  const byP = new Map();
  D.pollsterTable.forEach((r) => byP.set(r.pollster, { poll: r, proj: [] }));
  proj.rows.forEach((r, i) => {
    if (!byP.has(r.pollster)) {
      const last = D.individualPolls.filter((q) => q.pollster === r.pollster)
        .sort((a, b) => (a.released < b.released ? 1 : -1))[0];
      if (!last) return;
      byP.set(r.pollster, { poll: rdPollRow(last), proj: [] });
    }
    const e = byP.get(r.pollster);
    if (e.order == null) e.order = i;
    e.proj.push(r);
  });
  const entries = [...byP.values()].map((e) => {
    const pubMs = Date.parse(e.poll.pubSort.slice(0, 10));
    const stale = t0 - pubMs > RD_STALE_DAYS * DAY_MS;
    return { ...e, pubMs, stale, next: e.proj.find((r) => r.ahead === 0) || e.proj[0] || null };
  });
  const sorted = entries.slice().sort((a, b) => {
    if (sort.key === "next") {
      const va = a.order != null ? a.order : 1e9, vb = b.order != null ? b.order : 1e9;
      return sort.dir < 0 ? va - vb : vb - va;
    }
    if (sort.key === "pollster") return sort.dir < 0 ? a.poll.pollster.localeCompare(b.poll.pollster) : b.poll.pollster.localeCompare(a.poll.pollster);
    return sort.dir < 0 ? (b.poll.pubSort > a.poll.pubSort ? 1 : -1) : (a.poll.pubSort > b.poll.pubSort ? 1 : -1);
  });
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const caret = (key) => (sort.key === key ? (sort.dir < 0 ? "▾" : "▴") : "▿");
  const newest = entries.slice().sort((a, b) => b.pubMs - a.pubMs)[0];
  const staleOnes = entries.filter((e) => e.stale);

  /* ---- words ------------------------------------------------------------- */
  const WDs = (ms) => WD[new Date(ms).getUTCDay()].slice(0, 3);
  const dm = (ms) => { const d = new Date(ms); return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1); };
  const wdm = (ms) => WDs(ms) + " " + dm(ms);
  const isoD = (iso) => dm(Date.parse(iso.slice(0, 10)));
  const when = (n) => (n === -1 ? "yesterday" : n < 0 ? -n + " days overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days");
  const inHours = (r) => {
    if (r.inDays !== 0 || r.releaseMins == null) return null;
    const ms = r.release + r.releaseMins * 60000 - nowMs;
    if (ms <= 0 || Math.round(ms / 3600000) >= 12) return null;
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return "in " + mins + " min" + (mins === 1 ? "" : "s");
    const h = Math.round(mins / 60);
    return "in " + h + " hour" + (h === 1 ? "" : "s");
  };
  const hourWords = (r) => {
    if (r.releaseFrom == null || r.releaseTo == null) return null;
    if (r.releaseVals && r.releaseVals.length >= 2) return releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
    if (r.releaseTo - r.releaseFrom <= 20) return clockLabel(r.releaseFrom);
    return "about " + clockLabel(Math.round((r.releaseMid != null ? r.releaseMid : (r.releaseFrom + r.releaseTo) / 2) / 60) * 60);
  };
  /* the one real alternative a dated house's record offers: a week late */
  const altOf = (r) => {
    if (!r || r.rolled || r.loose) return null;
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow == null || se == null) return null;
    const widen = Math.sqrt(r.ahead + 1);
    const earlyW = Math.floor((se * widen + 3) / 7), lateW = Math.floor((sl * widen + 3) / 7);
    if (earlyW === 0 && lateW >= 1) return r.release + lateW * 7 * DAY_MS;
    if (lateW === 0 && earlyW >= 1) return r.release - earlyW * 7 * DAY_MS;
    return null;
  };
  const irregular = (r) => r && r.cadence > 60;
  const cadWords = (e) => (!e.next ? "" : irregular(e.next) ? "irregular" : e.next.calMonth ? "monthly" : cadenceLabel(e.next.cadence));
  /* the Next column: a date and, under it, how far off and the hour or the
     week-late alternative */
  const nextWords = (e) => {
    const r = e.next;
    if (!r) return { date: "—", sub: "" };
    if (r.loose && !irregular(r)) {
      const a = r.release - r.spread * DAY_MS, b = r.release + r.spread * DAY_MS;
      const da = new Date(a), db = new Date(b);
      const span = da.getUTCMonth() === db.getUTCMonth()
        ? da.getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b);
      return { date: span, sub: r.missed ? when(r.closesIn) : r.opensIn <= 0 ? "window open now" : "window opens " + when(r.opensIn), missed: r.missed };
    }
    if (irregular(r)) return { date: "About " + dm(r.release), sub: "give or take " + Math.round(r.spread) + " days", far: true };
    if (r.missed) return { date: wdm(r.release), sub: when(r.closesIn), missed: true };
    if (r.overdue) {
      const edge = r.release + r.winHalf * DAY_MS;
      return { date: wdm(edge), sub: when(r.closesIn) + " · due " + (r.inDays === -1 ? "yesterday" : -r.inDays + " days ago") };
    }
    const alt = altOf(r), hr = hourWords(r);
    return { date: wdm(r.release), sub: (inHours(r) || when(r.inDays)) + (alt ? " · or " + dm(alt) : hr ? " · " + hr : "") };
  };

  /* ---- the figures ------------------------------------------------------- */
  const onMatch = measure === "onp";
  const rivalName = onMatch ? "One Nation" : "Coalition";
  const figOf = (r) => {
    let a = null, b = null;
    if (onMatch) {
      if (basis === "resp") { if (r.tppAlt) { a = r.tppAlt.alp; b = r.tppAlt.onp; } }
      else if (r.alpOnImp != null) { a = r.alpOnImp; b = +(100 - r.alpOnImp).toFixed(1); }
    } else if (basis === "resp") {
      if (r.alp2pp != null) { a = r.alp2pp; b = r.lnp2pp != null ? r.lnp2pp : +(100 - r.alp2pp).toFixed(1); }
    } else if (r.alpImp != null) { a = r.alpImp; b = +(100 - r.alpImp).toFixed(1); }
    if (a == null) return null;
    const key = onMatch ? (basis === "resp" ? "altAlpOn" : "impOn") : (basis === "resp" ? "alp2pp" : "imp");
    const d = r.chg && r.chg.d ? r.chg.d[key] : null, since = r.chg && r.chg.r ? r.chg.r[key] : null;
    return { a, b, m: +(a - b).toFixed(1), d, since };
  };
  const bColor = onMatch ? "var(--onp)" : "var(--lnp)";
  const figCell = (e) => {
    const r = e.poll;
    if (facet === "primary") {
      return (
        <div className="rd-pl-prim">
          {RD_PL_PARTIES.map(([id]) => (
            <span key={id} style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>
              {r.p && r.p[id] != null ? String(+r.p[id].toFixed(1)) : "—"}</span>
          ))}
        </div>
      );
    }
    if (facet === "leadership") {
      const ppm = ppmContests(r)[0];
      const a = r.appr || {};
      const opp = a.oppName || "Taylor";
      const net = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v));
      const ppmTxt = ppm && ppm.alb != null
        ? (() => { const o = Object.keys(ppm).find((k) => k !== "alb" && k !== "unc");
                   const L = (window.LEADER_META || {})[o]; return "Albanese " + ppm.alb + "–" + ppm[o] + " " + (L ? L.label : rdCap(o)); })()
        : null;
      return (
        <div className="rd-pl-lead">
          <span className="rd-pl-main">{ppmTxt || <span className="rd-pl-none">No preferred-PM question</span>}</span>
          <span className="rd-pl-sub">Net: Albanese {net(a.albNet)} · {opp} {net(a.taylorNet)}{a.hansonNet != null ? " · Hanson " + net(a.hansonNet) : ""}</span>
        </div>
      );
    }
    const f = figOf(r);
    if (!f) return <div className="rd-pl-fig"><span className="rd-pl-none">Not asked this wave</span></div>;
    const leadA = f.m >= 0;
    return (
      <div className="rd-pl-fig">
        <span className="rd-pl-main">
          <span style={{ color: "var(--alp-text)" }}>{f.a.toFixed(1)}</span>
          <span className="rd-pl-dash">–</span>
          <span style={{ color: inkOf(bColor) }}>{f.b.toFixed(1)}</span>
          <span className="rd-pl-tag" style={{ color: inkOf(leadA ? "var(--alp)" : bColor) }}>
            {leadA ? "ALP" : onMatch ? "ON" : "L/NP"} +{Math.abs(f.m).toFixed(1)}</span>
        </span>
        {(f.d != null || narrow) && (
          <span className="rd-pl-sub">
            {narrow && <span className="rd-pl-tag" style={{ color: inkOf(leadA ? "var(--alp)" : bColor) }}>
              {leadA ? "ALP" : onMatch ? "ON" : "L/NP"} +{Math.abs(f.m).toFixed(1)}</span>}
            {f.d != null && <span className="rd-pl-long">Labor {Math.abs(f.d) < 0.05 ? "unchanged" : rdArrow(f.d) + " " + Math.abs(f.d).toFixed(1)} since its {f.since ? isoD(f.since) + " " : "previous "}poll</span>}
            {f.d != null && <span className="rd-pl-short">{Math.abs(f.d) < 0.05 ? "→ 0.0" : rdArrow(f.d) + " " + Math.abs(f.d).toFixed(1)}</span>}
          </span>
        )}
      </div>
    );
  };
  const figHead = facet === "primary"
    ? <div className="rd-pl-prim rd-pl-primh">{RD_PL_PARTIES.map(([id, lab]) => (
        <span key={id} style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>{lab}</span>))}</div>
    : facet === "leadership" ? "Preferred PM · net approval" : "Labor v " + rivalName;

  /* ---- the release strip -------------------------------------------------- */
  const L = t0 - 43 * DAY_MS, R = t0 + 23 * DAY_MS;
  const pos = (ms) => ((ms - L) / (R - L)) * 100;
  const ticks = [-42, -28, -14, 0, 14].map((k) => ({ x: pos(t0 + k * DAY_MS), label: k === 0 ? "Today" : dm(t0 + k * DAY_MS), today: k === 0 }));
  const strip = (e) => {
    const r = e.next;
    const marks = [];
    const recent = (r && r.recent) || [];
    recent.forEach((x) => {
      const ms = Date.parse((x.pub || x.field).slice(0, 10));
      if (Math.abs(ms - e.pubMs) < DAY_MS / 2) return;
      if (ms >= L && ms <= R) marks.push(<span key={"e" + ms} className="rd-tl-dot" style={{ left: pos(ms) + "%" }}></span>);
    });
    if (e.pubMs >= L) marks.push(<span key="latest" className="rd-tl-latest" style={{ left: pos(e.pubMs) + "%" }}></span>);
    else marks.push(<span key="latest" className="rd-tl-off rd-tl-offl"><span className="rd-tl-dot"></span>{dm(e.pubMs)}</span>);
    if (r) {
      if (r.loose && !irregular(r)) {
        const a = Math.max(L, r.release - r.spread * DAY_MS), b = Math.min(R, r.release + r.spread * DAY_MS);
        marks.push(<span key="win" className="rd-tl-win" style={{ left: pos(a) + "%", width: (pos(b) - pos(a)) + "%" }}></span>);
      } else if (r.release > R) {
        marks.push(<span key="next" className="rd-tl-off rd-tl-offr">{D.monthName(new Date(r.release).getUTCMonth() + 1)}<span className="rd-tl-ring"></span></span>);
      } else {
        const alt = altOf(r);
        if (alt && alt <= R) marks.push(<span key="alt" className="rd-tl-alt" style={{ left: pos(Math.min(r.release, alt)) + "%", width: Math.abs(pos(alt) - pos(r.release)) + "%" }}></span>);
        if (alt && alt <= R) marks.push(<span key="altr" className="rd-tl-later" style={{ left: pos(alt) + "%" }}></span>);
        marks.push(<span key="next" className={"rd-tl-next" + (r.missed ? " missed" : "")} style={{ left: pos(r.release) + "%" }}></span>);
      }
      e.proj.filter((x) => x.ahead >= 1 && x.release <= R).forEach((x) =>
        marks.push(<span key={"l" + x.release} className="rd-tl-later" style={{ left: pos(x.release) + "%" }}></span>));
    }
    return (
      <div className="rd-tl" aria-hidden="true">
        <span className="rd-tl-base"></span>
        {ticks.map((t) => <span key={t.label} className={"rd-tl-grid" + (t.today ? " today" : "")} style={{ left: t.x + "%" }}></span>)}
        {marks}
      </div>
    );
  };

  /* ---- a row opened: the poll in full, and the rhythm behind the projection */
  const detail = (e) => {
    const r = e.poll, pj = e.next;
    const f = figOf(r);
    const imp = [r.alpOnImp != null ? "Labor " + r.alpOnImp.toFixed(1) + " – " + (100 - r.alpOnImp).toFixed(1) + " One Nation" : null,
                 r.alpImp != null ? "Labor " + r.alpImp.toFixed(1) + " – " + (100 - r.alpImp).toFixed(1) + " Coalition" : null].filter(Boolean).join(" · ");
    const pub = [r.tppAlt ? "Labor " + r.tppAlt.alp + " – " + r.tppAlt.onp + " One Nation" : null,
                 r.alp2pp != null ? "Labor " + r.alp2pp + " – " + (r.lnp2pp != null ? r.lnp2pp : 100 - r.alp2pp) + " Coalition" : null].filter(Boolean).join(" · ");
    const ppm = ppmContests(r).map((s) => {
      const o = Object.keys(s).find((k) => k !== "alb" && k !== "unc");
      const Lm = (window.LEADER_META || {})[o];
      return "Albanese " + s.alb + " · " + (Lm ? Lm.label : rdCap(o)) + " " + s[o];
    }).join("; ");
    const a = r.appr || {};
    const net = (v) => (v == null ? null : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v));
    const nets = [["Albanese", a.albNet], [a.oppName || "Taylor", a.taylorNet], ["Hanson", a.hansonNet]]
      .filter(([, v]) => v != null).map(([n, v]) => n + " " + net(v)).join(" · ");
    const key = window.AP.pollRowKey && window.AP.pollRowKey({ pollster: r.pollster, released: r.released });
    const pubDate = r.published ? WDs(Date.parse(r.published.slice(0, 10))) + " " + isoD(r.published) : null;
    const recent = ((pj && pj.recent) || []).slice(-5).reverse();
    const nx = nextWords(e);
    const then = e.proj.filter((x) => x.ahead === 1)[0];
    return (
      <div className="rd-pl-detail">
        <div className="rd-pld-poll">
          <div className="rd-pld-h">This poll · fieldwork {r.field}{r.sample ? " · " + r.sample.toLocaleString() + " voters" : ""}{r.client ? " · " + r.client : ""}{pubDate ? ", " + pubDate : ""}</div>
          {r.p && (
            <div className="rd-pld-prim">
              {RD_PL_PARTIES.map(([id, lab]) => r.p[id] != null && (
                <span key={id}><b style={{ color: id === "oth" ? "var(--ink-3)" : inkOf("var(--" + id + ")") }}>{lab}</b>
                  <span style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>{+r.p[id].toFixed(1)}</span></span>
              ))}
            </div>
          )}
          <dl className="rd-pld-dl">
            {imp && <><dt>Two-party, implied</dt><dd>{imp}</dd></>}
            {pub && <><dt>As published</dt><dd>{pub}</dd></>}
            {ppm && <><dt>Preferred prime minister</dt><dd>{ppm}</dd></>}
            {nets && <><dt>Net approval</dt><dd>{nets}</dd></>}
          </dl>
          <div className="rd-pld-links">
            {key && window.AP.openPoll && <button type="button" className="rd-link" onClick={(ev) => { ev.stopPropagation(); window.AP.openPoll(key, facet, "latest and next polls"); }}>Open in All polls →</button>}
            {r.url && <a className="rd-link" href={r.url} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>Read the release ↗</a>}
          </div>
        </div>
        {pj && (
          <div className="rd-pld-rhythm">
            <div className="rd-pld-h">{r.pollster}’s rhythm · last {rdNumWord(recent.length)} releases</div>
            <table className="rd-pld-tab">
              <thead><tr><th>Field to</th><th>Published</th><th>Gap</th></tr></thead>
              <tbody>
                {recent.map((x) => (
                  <tr key={x.field}>
                    <td>{isoD(x.field)}</td>
                    <td>{x.pub ? (x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>{WDs(Date.parse(x.pub)) + " " + isoD(x.pub)}</a> : WDs(Date.parse(x.pub)) + " " + isoD(x.pub)) : "—"}</td>
                    <td>{x.gap != null ? x.gap + " days" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rd-pld-foot">
              {pj.calMonth
                ? <>One release a month, on no set day: between the {pj.calDays ? pj.calDays[0] + "th and the " + pj.calDays[1] + "th" : "start and the end"} so far. <b>Next: {nx.date}.</b></>
                : irregular(pj)
                  ? <>Median {Math.round(pj.cadence)} days between releases across the last {pj.gapsUsed} gaps, give or take {Math.round(pj.spread)}. <b>Next: {nx.date.replace(/^About/, "about")}.</b></>
                  : <>Median {pj.cadence} days between {pj.basis === "published" ? "publications" : "fieldwork ends"} across the last {pj.gapsUsed} gaps.{" "}
                    <b>Next: {nx.date}{hourWords(pj) ? ", " + hourWords(pj).replace(/^about /, "about ") + " " + easternAbbr(pj.release) : ""}</b>, at the earliest{then ? "; then " + wdm(then.release) : ""}.</>}
            </p>
          </div>
        )}
      </div>
    );
  };

  const basisWord = onMatch ? (basis === "resp" ? "as published" : "implied flows") : (basis === "resp" ? "as published" : "implied flows");
  const controls = facet === "twopp" && (
    <span className="rd-pl-ctl">
      {!narrow && <span className="rd-pl-ctl-l">Two-party:</span>}
      <button type="button" className="rd-pl-flip" onClick={() => setTppMatchup && setTppMatchup(onMatch ? "alp_lnp" : "alp_on")}
              title={"Show Labor v " + (onMatch ? "the Coalition" : "One Nation") + " instead"}>
        Labor v {rivalName} <span aria-hidden="true">⇄</span></button>
      <span className="rd-pl-ctl-l">· {narrow ? (basis === "resp" ? "published" : "implied") : basisWord}</span>
      <RdQPop label="How the two-party figures are counted" align="left">
        <h4>How the two-party figures are counted</h4>
        <p>{basis === "resp"
          ? "Each pollster’s own published figures, from where its respondents say their preferences would go."
          : "Each poll’s primary votes, run through one fixed set of preference flows, so every pollster is read the same way."}</p>
        <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
          <RdSwitch on={basis === "resp"} onToggle={() => setTppBasis(basis === "imp" ? "resp" : "imp")} label="Show the pollsters’ published figures" /></div>
        <p className="rd-qnote">The switch changes the whole page, the headline figures included.</p>
      </RdQPop>
    </span>
  );

  return (
    <RdSec id="latest-polls" cls="rd-polls" facet={facet} title="Latest and next polls"
           meta={entries.length + " pollsters · latest release " + (narrow ? dm(newest.pubMs) : wdm(newest.pubMs))}>
      <p className="rd-dek rd-pl-dek">
        The newest poll from each pollster, and the earliest its next could land, projected from its recent rhythm.
        {narrow ? " Tap a pollster for the full poll." : " Open a row for the full poll and the releases behind the projection."}
      </p>
      <RdTabs value={facet} onChange={setFacet} options={narrow ? RD_PL_FACETS.map((f) => (f.id === "leadership" ? { ...f, label: "Leaders" } : f)) : RD_PL_FACETS}
              ariaLabel="Poll table view" className="rd-pl-tabs">
        {!narrow && controls}
      </RdTabs>
      {narrow && controls && <div className="rd-pl-ctlrow">{controls}</div>}
      <div className="rd-pl" role="table" aria-label="Latest poll and next expected release, by pollster">
        <div className="rd-pl-head" role="row">
          <span role="columnheader" className="rd-pl-c-name">
            <button type="button" className="rd-pl-sort" onClick={() => onSort("pollster")}>Pollster</button></span>
          <span role="columnheader" className="rd-pl-c-latest">
            <button type="button" className={"rd-pl-sort" + (sort.key === "latest" ? " on" : "")} onClick={() => onSort("latest")}>Latest <span aria-hidden="true">{caret("latest")}</span></button></span>
          <span role="columnheader" className="rd-pl-c-figs">{figHead}</span>
          <span role="columnheader" className="rd-pl-c-tl">
            <span className="rd-pl-tlcap">Releases · next</span>
            <span className="rd-pl-ticks">{ticks.map((t) => <span key={t.label} className={t.today ? "today" : ""} style={{ left: t.x + "%" }}>{t.label}</span>)}</span>
          </span>
          <span role="columnheader" className="rd-pl-c-next">
            <button type="button" className={"rd-pl-sort" + (sort.key === "next" ? " on" : "")} onClick={() => onSort("next")}>Next, at the earliest <span aria-hidden="true">{caret("next")}</span></button></span>
          <span className="rd-pl-c-exp" aria-hidden="true"></span>
        </div>
        {sorted.map((e) => {
          const r = e.poll, isOpen = open === r.pollster, nx = nextWords(e);
          const cad = cadWords(e);
          return (
            <div key={r.pollster} className={"rd-pl-item" + (isOpen ? " open" : "") + (e.stale ? " stale" : "")}>
              <div className="rd-pl-row" role="row" onClick={() => setOpen(isOpen ? null : r.pollster)}>
                <span role="cell" className="rd-pl-c-name">
                  <span className="rd-pl-main">
                    {e.next && e.next.site
                      ? <a href={e.next.site} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()} title={"Where " + r.pollster + " publishes"}>{r.pollster}<span className="plink-mark" aria-hidden="true">↗</span></a>
                      : r.pollster}
                  </span>
                  <span className="rd-pl-sub">{r.client}{cad ? " · " + cad : ""}{e.stale ? <span className="rd-pl-long"> · no poll in six weeks</span> : null}</span>
                </span>
                <span role="cell" className="rd-pl-c-latest">
                  <span className="rd-pl-main">{r.publishedLabel || r.releasedLabel}</span>
                  <span className="rd-pl-sub">{r.field}{r.sample ? " · " + r.sample.toLocaleString() : ""}</span>
                </span>
                <span role="cell" className="rd-pl-c-figs">{figCell(e)}</span>
                <span role="cell" className="rd-pl-c-tl">{strip(e)}</span>
                <span role="cell" className={"rd-pl-c-next" + (nx.missed ? " missed" : "")}>
                  <span className="rd-pl-main"><span className="rd-pl-short">Next </span>{nx.date}</span>
                  <span className="rd-pl-sub">{nx.sub}</span>
                </span>
                <span className="rd-pl-c-exp">
                  <button type="button" className={"rd-pl-exp" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                          aria-label={(isOpen ? "Close " : "Open ") + r.pollster + "’s poll and release rhythm"}
                          onClick={(ev) => { ev.stopPropagation(); setOpen(isOpen ? null : r.pollster); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
                </span>
                <span className="rd-pl-foot1" aria-hidden="true">
                  <span><b>{r.publishedLabel || r.releasedLabel}</b> · {r.field}</span>
                  <span className={nx.missed ? "missed" : ""}>Next <b>{nx.date}</b>{nx.sub ? " · " + nx.sub.replace(/ · .*$/, "") : ""}</span>
                </span>
              </div>
              {isOpen && detail(e)}
            </div>
          );
        })}
      </div>
      <RdKey className="rd-pl-key" items={[
        { kind: "dot-solid", color: "var(--ink)", label: "Latest release" },
        { kind: "dot", color: "var(--ink-3)", label: "Earlier releases" },
        { kind: "ring", label: "Next, at the earliest" },
      ]}>
        <span className="rd-key-item"><span className="rd-tl-keyalt" aria-hidden="true"></span>Or a week later</span>
        <span className="rd-key-item"><span className="rd-tl-keywin" aria-hidden="true"></span>Window, for irregular pollsters</span>
      </RdKey>
      <p className="rd-note">
        Projections read each pollster’s last eight gaps between releases: they mark the earliest a poll could land, not the likeliest.
        {" "}A pollster that misses its slot shows as overdue until the release is added.
        {staleOnes.length > 0 && <> {staleOnes.map((e) => e.poll.pollster).join(" and ")} {staleOnes.length > 1 ? "have" : "has"} not published in six weeks, so {staleOnes.length > 1 ? "their polls are" : "its poll is"} outside the averages.</>}
      </p>
    </RdSec>
  );
}

Object.assign(window, { RdPolls });
