/* auspol tracker – the redesign's "Latest and next polls" (Sep 2026).

   One row per pollster replaces the Snapshot's two panels: its newest poll,
   a strip of its releases either side of today, and the earliest its next
   could land. The projection is np-project.js's (the same one the tab bar's
   countdown runs), and the figures are the Latest table's own, so nothing
   here is a second estimate of anything. */

const RD_PL_FACETS = [{ id: "twopp", label: "2PP" }, { id: "primary", label: "Primary" }, { id: "leadership", label: "Leadership" }];
/* primary columns rank by the site aggregate like every other party
   listing (the All-polls/Latest tables read the same latest.primaryOrder
   walk) - user call 2026-10-03: a fixed Labor, Coalition, Greens, One
   Nation, Other ladder is "unprincipled". This map is only the id->label
   lookup and the drift fallback; the live order comes from the data. */
const RD_PL_LABEL = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const RD_PL_FALLBACK = ["alp", "lnp", "grn", "onp", "oth"];
const RD_STALE_DAYS = 42;
/* how far out the Calendar fold-out under the table lays its slots: the same
   projection the Next column reads, horizon widened to two months by name */
const RD_CAL_DAYS = 62;

/* the table's shape of a poll, for a pollster with a projection but no row
   in the Latest table (one that has gone quiet) */
function rdPollRow(p) {
  const pub = p.published || p.released;
  const d = new Date(pub.slice(0, 10) + "T00:00:00Z");
  const lab = d.getUTCDate() + " " + window.AUSPOL.monthName(d.getUTCMonth() + 1);
  return { pollster: p.pollster, client: p.client, field: p.dateLabel || p.field, released: p.released,
           published: p.published, publishedLabel: lab, pubSort: pub, sample: p.sample,
           alpImp: p.alpImp, alpOnImp: p.alpOnImp, alp2pp: p.alp, lnp2pp: p.lnp, p: p.p || {},
           tppAlt: p.tppAlt, tppAlt2: p.tppAlt2, ppmSets: p.ppmSets, appr: p.appr || {}, chg: p.chg, url: p.url, methodUrl: p.methodUrl, links: p.links,
           // fieldwork not yet published: shown as TBC (see rdFieldTxt)
           ...(p.fieldPending ? { fieldPending: true, fieldUrl: p.fieldUrl } : {}) };
}

/* a poll's outbound links as gen-data names them (§6a): the house's own
   release, its APC methodology statement and the press report it was read
   from, each labelled for its source. A link the house hasn't posted yet
   reads "not yet out" in a fainter ink and opens the page it files them on.
   Shared by the Latest polls detail and the opened poll in All polls. */
function rdPollLinks(links) {
  return (links || []).map((l) => (
    <a key={l.k} className={"rd-link rd-link-ext" + (l.pending ? " rd-link-pend" : "")} href={l.href} target="_blank" rel="noopener noreferrer"
       title={l.title} onClick={(ev) => ev.stopPropagation()}>
      <span className="rd-link-t">{l.t}</span> <span className="rd-apd-ext" aria-hidden="true">↗</span>
    </a>
  ));
}

/* where a pollster's NAME goes, in every row that shows one poll: that
   poll's own release where there is one, else the report it was read from -
   never its methodology statement, nor a page about the house as a whole.
   The title says which, since the name can't. */
function rdPollNameLink(p, mark = "plink-mark") {
  const ok = (p.links || []).filter((x) => !x.pending);
  const l = ok.find((x) => x.k === "release") || ok.find((x) => x.k === "cite");
  return l
    ? <a href={l.href} target="_blank" rel="noopener noreferrer" title={"Opens " + l.t} onClick={(ev) => ev.stopPropagation()}>{p.pollster}<span className={mark} aria-hidden="true">↗</span></a>
    : p.pollster;
}

function RdPolls({ tppBasis, setTppBasis, tppMatchup, setTppMatchup }) {
  const { D } = window.AP;
  /* [id, label] pairs in the aggregate's current order; an unknown key
     drops out silently rather than misorder the ladder */
  const plParties = ((D.latest && D.latest.primaryOrder) || RD_PL_FALLBACK)
    .filter((k) => k in RD_PL_LABEL).map((k) => [k, RD_PL_LABEL[k]]);
  /* a tablet has no room for the release strip beside five columns, so it
     takes the phone's cards too */
  const narrow = useNarrow("(max-width: 900px)");
  const phone = useNarrow(MQ_PHONE);
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({ key: "latest", dir: -1 });
  const [open, setOpen] = useState(null);
  /* an earlier release's readout, as a chart's poll dot has one:
     { id, row, key, left, src } - src is the input that raised it */
  const [tl, setTl] = useState(null);
  const tlBox = React.useRef(null);
  const tlPtr = React.useRef(null);
  /* the readout centres on its dot, so a dot near the page's edge would put
     half of it off screen: once it is laid out, it is nudged back inside the
     viewport (8px clear), the nudge measured from its centred place */
  const tlTipRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tlTipRef.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, M = 8;
    const dx = r.left < M ? M - r.left : r.right > vw - M ? vw - M - r.right : 0;
    el.style.marginLeft = dx + "px";
  }, [tl && tl.id]);
  // a readout a finger raised stays up until the next tap somewhere else
  window.useDismissOutside(tlBox, !!(tl && tl.src === "touch"), () => setTl(null));
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
      /* past its hour on the day itself it isn't "due 0 days ago": it is
         simply not out yet */
      return { date: wdm(edge), sub: when(r.closesIn) + (r.inDays === 0 ? ", not out yet"
        : ", due " + (r.inDays === -1 ? "yesterday" : -r.inDays + " days ago")) };
    }
    const alt = altOf(r), hr = hourWords(r);
    return { date: wdm(r.release), sub: (inHours(r) || when(r.inDays)) + (alt ? ", or " + dm(alt) : hr ? ", " + hr : "") };
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
      const primFig = (v) => {
        if (v == null) return "—";
        const [i, f] = (+v).toFixed(1).split(".");
        if (f === "0") return i;
        if (f === "5") return <span className="rd-pl-halfwrap">{i}<b className="rd-pl-frac rd-pl-half">½</b></span>;
        return <>{i}<b className="rd-pl-frac">{"." + f}</b></>;
      };
      return (
        <div className="rd-pl-prim">
          {plParties.map(([id]) => (
            <span key={id} style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>
              {primFig(r.p ? r.p[id] : null)}</span>
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
        ? (() => { const os = Object.keys(ppm).filter((k) => k !== "alb" && k !== "unc");
                   const who = (o) => { const L = (window.LEADER_META || {})[o]; return apWho(r, o, L ? L.label : rdCap(o)); };
                   // a three-way question lists every contender; head to head keeps the pair form
                   return os.length > 1 ? apWho(r, "alb", "Albanese") + " " + ppm.alb + ", " + os.map((o) => who(o) + " " + ppm[o]).join(", ")
                     : apWho(r, "alb", "Albanese") + " " + ppm.alb + "–" + ppm[os[0]] + " " + who(os[0]); })()
        : null;
      return (
        <div className="rd-pl-lead">
          <span className="rd-pl-main">{ppmTxt || <span className="rd-pl-none">{window.JUR ? "No preferred-" + window.JUR.office.alb + " question" : "No preferred-PM question"}</span>}</span>
          <span className="rd-pl-sub"><span className="rd-pl-netl">Net: </span>{apWho(r, "alb", "Albanese")}{" "}{net(a.albNet)}, {opp} {net(a.taylorNet)}{a.hansonNet != null ? ", " + apWho(r, "hanson", "Hanson") + " " + net(a.hansonNet) : ""}</span>
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
    ? <div className="rd-pl-prim rd-pl-primh">{plParties.map(([id, lab]) => (
        <span key={id} style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>{lab}</span>))}</div>
    : facet === "leadership" ? (window.JUR ? "Preferred " + window.JUR.office.alb + ", net approval" : "Preferred PM, net approval") : "Labor v " + rivalName;

  /* ---- the release strip -------------------------------------------------- */
  const L = t0 - 43 * DAY_MS, R = t0 + 23 * DAY_MS;
  const pos = (ms) => ((ms - L) / (R - L)) * 100;
  const ticks = [-42, -28, -14, 0, 14].map((k) => ({ x: pos(t0 + k * DAY_MS), label: k === 0 ? "Today" : dm(t0 + k * DAY_MS), today: k === 0 }));
  /* the readout: the poll as this row would show it, on the facet in view -
     figCell run on that poll, so it can never disagree with the table */
  const tlTip = (t) => {
    const q = D.individualPolls.find((x) => x.pollster + "|" + x.released === t.key);
    if (!q) return null;
    const pr = rdPollRow(q);
    return (
      <div ref={tlTipRef} className="tip tip-dot rd-tl-tip" style={{ left: t.left + "%", top: "50%" }} aria-hidden="true">
        <div className="tip-title">{q.pollster}</div>
        <div className="rd-tl-tipdate">Fieldwork {pr.fieldPending ? "TBC" : pr.field}, published {pr.publishedLabel}</div>
        {figCell({ poll: pr })}
        {q.sample ? <div className="tip-sub">n = {q.sample.toLocaleString()}</div> : null}
        {t.src !== "touch" && <div className="tip-hint">{t.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls"}</div>}
      </div>
    );
  };
  const strip = (e) => {
    const r = e.next;
    const marks = [];
    const recent = (r && r.recent) || [];
    recent.forEach((x) => {
      const ms = Date.parse((x.pub || x.field).slice(0, 10));
      if (Math.abs(ms - e.pubMs) < DAY_MS / 2) return;
      if (ms < L || ms > R) return;
      /* An earlier release behaves as a chart's poll dot does: pointing at
         it (or focusing it) shows the poll, and only then does a mouse click
         open it in All polls. A tap shows it and nothing more - on a touch
         screen the tap is the only way to read a dot, so it can't also be the
         trip. The row's own poll is the dark dot and has no readout: the row
         already is it. */
      const key = window.AP.pollRowKey && window.AP.pollRowKey({ pollster: e.poll.pollster, released: x.field });
      if (!key) {
        marks.push(<span key={"e" + ms} className="rd-tl-dot" style={{ left: pos(ms) + "%" }} aria-hidden="true"></span>);
        return;
      }
      const id = key, row = e.poll.pollster, left = pos(ms);
      const show = (src) => setTl({ id, row, key, left, src });
      const hide = (src) => setTl((t) => (t && t.id === id && (!src || t.src === src) ? null : t));
      // openPoll is looked up at the click: the app registers it after this table's first render
      const go = () => { setTl(null); if (window.AP.openPoll) window.AP.openPoll(key, facet, "latest and next polls"); };
      marks.push(<button key={"e" + ms} type="button" className={"rd-tl-dot rd-tl-dotlink" + (tl && tl.id === id ? " on" : "")}
                         style={{ left: left + "%" }} aria-label={row + "’s poll of " + dm(ms) + ": open in All polls"}
                         onPointerDown={(ev) => { tlPtr.current = ev.pointerType; }}
                         onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show("mouse"); }}
                         onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide("mouse"); }}
                         onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show("focus"); }}
                         onBlur={() => hide("focus")}
                         onClick={(ev) => {
                           ev.stopPropagation();
                           const ptr = ev.detail === 0 ? "key" : tlPtr.current;
                           tlPtr.current = null;
                           if (ptr === "mouse" || ptr === "key") { go(); return; }
                           if (tl && tl.id === id) setTl(null); else show("touch");
                         }}></button>);
    });
    if (e.pubMs >= L) marks.push(<span key="latest" className="rd-tl-latest" style={{ left: pos(e.pubMs) + "%" }}></span>);
    else marks.push(<span key="latest" className="rd-tl-off rd-tl-offl" aria-hidden="true"><span className="rd-tl-dot"></span>{dm(e.pubMs)}</span>);
    if (r) {
      if (r.loose && !irregular(r)) {
        const a = Math.max(L, r.release - r.spread * DAY_MS), b = Math.min(R, r.release + r.spread * DAY_MS);
        marks.push(<span key="win" className="rd-tl-win" style={{ left: pos(a) + "%", width: (pos(b) - pos(a)) + "%" }}></span>);
      } else if (r.release > R) {
        marks.push(<span key="next" className="rd-tl-off rd-tl-offr" aria-hidden="true">{D.monthName(new Date(r.release).getUTCMonth() + 1)}<span className="rd-tl-ring"></span></span>);
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
      /* not hidden whole: the earlier-release dots are links. Every other
         mark is empty or hidden itself, so they are all a reader meets */
      <div className="rd-tl" ref={tl && tl.row === e.poll.pollster ? tlBox : undefined}>
        <span className="rd-tl-base"></span>
        {ticks.map((t) => <span key={t.label} className={"rd-tl-grid" + (t.today ? " today" : "")} style={{ left: t.x + "%" }}></span>)}
        {marks}
        {tl && tl.row === e.poll.pollster && tlTip(tl)}
      </div>
    );
  };

  /* ---- a row opened: the poll in full, and the rhythm behind the projection */
  const detail = (e) => {
    const r = e.poll, pj = e.next;
    const f = figOf(r);
    /* the All-polls expansion's movement markers, beside the figures they
       belong to: each measure's change on the same pollster's previous poll
       that published it (gen-data's chg, keyed d[k] against ref date r[k]) */
    const cgd = (r.chg && r.chg.d) || {};
    const plus = (k, dec) => {
      const s = rdApChg(cgd[k], dec);
      return s ? <> <span className="rd-apd-chg">{s}</span></> : null;
    };
    const clause = (items) => items.map(([txt, k, dec], i) => (
      <React.Fragment key={k}>{i > 0 && ", "}{txt}{plus(k, dec)}</React.Fragment>
    ));
    const imp = clause([r.alpOnImp != null ? ["Labor " + r.alpOnImp.toFixed(1) + " – " + (100 - r.alpOnImp).toFixed(1) + " One Nation", "impOn", 1] : null,
                        r.alpImp != null ? ["Labor " + r.alpImp.toFixed(1) + " – " + (100 - r.alpImp).toFixed(1) + " Coalition", "imp", 1] : null].filter(Boolean));
    const pub = clause([r.tppAlt ? ["Labor " + r.tppAlt.alp + " – " + r.tppAlt.onp + " One Nation", "altAlpOn", 0] : null,
                        r.alp2pp != null ? ["Labor " + r.alp2pp + " – " + (r.lnp2pp != null ? r.lnp2pp : 100 - r.alp2pp) + " Coalition", "alp2pp", 0] : null].filter(Boolean));
    const ppm = ppmContests(r).map((s) => {
      const os = Object.keys(s).filter((k) => k !== "alb" && k !== "unc");
      return [apWho(r, "alb", "Albanese") + " " + s.alb, ...os.map((o) => {
        const Lm = (window.LEADER_META || {})[o];
        return apWho(r, o, Lm ? Lm.label : rdCap(o)) + " " + s[o];
      })].join(", ");
    }).join("; ");
    /* the two-party figures' 95% margins (All polls' rdPollMargin, read off
       the archive's copy of this poll, which carries every field it needs),
       one per basis: a range where the two contests' margins differ */
    const ip = D.individualPolls.find((q) => q.pollster === r.pollster && q.released === r.released);
    const moeOf = (isPub) => {
      if (!ip) return null;
      const ms = [isPub ? (r.tppAlt ? "onp" : null) : (r.alpOnImp != null ? "onp" : null),
                  isPub ? (r.alp2pp != null ? "lnp" : null) : (r.alpImp != null ? "lnp" : null)]
        .filter(Boolean).map((c) => rdPollMargin(ip, c, isPub)).filter((m) => m != null).map((m) => m.toFixed(1));
      if (!ms.length) return null;
      const lo = Math.min(...ms), hi = Math.max(...ms);
      return "±" + (lo === hi ? lo.toFixed(1) : lo.toFixed(1) + "–" + hi.toFixed(1)) + (isPub ? " on the published" : " on the implied");
    };
    const moes = [imp.length > 0 && moeOf(false), pub.length > 0 && moeOf(true)].filter(Boolean);
    const moeTxt = moes.length ? moes.join(", ") + (moes.length > 1 ? " figures" : " figure") + ", " + rdMarginBasis(ip) : null;
    /* the movable share of the electorate as this wave reads it, on whichever
       basis the house asks: can't-say (first), the not-firm share of the
       decided (soft), the residue inside a printed two-party pair (tpp), or
       RedBridge's vote-softness triple (gen-data's firmAll) - the All-polls
       expansion's Decidedness row reads the same four bases */
    const dec = (() => {
      if (r.undecided != null) {
        const b = r.undecidedBasis || "first";
        return <>{r.undecided}% {b === "soft" ? "not firm" : "undecided"}{plus("und", 1)}{" – "}
          {b === "soft" ? "named a party, but might yet change their mind"
            : b === "tpp" ? "unallocated inside the printed two-party pair"
            : "couldn’t name a party when first asked"}</>;
      }
      const f = Array.isArray(r.firmAll) && r.firmAll.length === 3 ? r.firmAll : null;
      if (f) return <>{f[1] + f[2]}% not firm{" – solid " + f[0] + ", soft " + f[1] + ", very soft " + f[2] + ", on the wave’s own vote-softness table"}</>;
      return null;
    })();
    const a = r.appr || {};
    const net = (v) => (v == null ? null : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v));
    const nets = clause([[apWho(r, "alb", "Albanese"), a.albNet, "albNet"], [a.oppName || "Taylor", a.taylorNet, "taylorNet"], [apWho(r, "hanson", "Hanson"), a.hansonNet, "hansonNet"]]
      .filter(([, v]) => v != null).map(([n, v, k]) => [n + " " + net(v), k, 0]));
    /* where a change marker shows, name the poll it is measured against,
       as the All-polls expansion's note does */
    const refIso = r.chg && r.chg.r ? (r.chg.r.pOnp || r.chg.r.pAlp || r.chg.r.impOn || r.chg.r.imp || r.chg.r.alp2pp) : null;
    const prev = refIso ? D.individualPolls.find((x) => x.pollster === r.pollster && x.released === refIso) : null;
    const key = window.AP.pollRowKey && window.AP.pollRowKey({ pollster: r.pollster, released: r.released });
    const recent = ((pj && pj.recent) || []).slice(-5).reverse();
    const nx = nextWords(e);
    const then = e.proj.filter((x) => x.ahead === 1)[0];
    return (
      <div className="rd-pl-detail">
        <div className="rd-pld-poll">
          <div className="rd-pld-h">{rdPollHead({ ...(D.individualPolls.find((q) => q.pollster === r.pollster && q.released === r.released) || {}), ...r })}</div>
          {r.p && (
            <div className="rd-pld-prim">
              {plParties.map(([id, lab]) => r.p[id] != null && (
                <span key={id}><b style={{ color: id === "oth" ? "var(--ink-3)" : inkOf("var(--" + id + ")") }}>{lab}</b>
                  <span style={{ color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")") }}>{+r.p[id].toFixed(1)}</span>
                  <span className="rd-apd-chg">{rdApChg(cgd[{ alp: "pAlp", lnp: "pLnp", grn: "pGrn", onp: "pOnp", oth: "pOth" }[id]], 0) || "\u00a0"}</span></span>
              ))}
            </div>
          )}
          <dl className="rd-pld-dl">
            {imp.length > 0 && <><dt>Two-party, implied</dt><dd>{imp}</dd></>}
            {pub.length > 0 && <><dt>As published</dt><dd>{pub}</dd></>}
            {moeTxt && <><dt>Margin of error</dt><dd>{moeTxt}</dd></>}
            {dec && <><dt>Decidedness</dt><dd>{dec}</dd></>}
            {ppm && <><dt>{window.JUR ? "Preferred " + window.JUR.office.alb : "Preferred prime minister"}</dt><dd>{ppm}</dd></>}
            {nets.length > 0 && <><dt>Net approval</dt><dd>{nets}</dd></>}
          </dl>
          {prev && <div className="rd-apd-sub rd-apd-note">Changes are on {r.pollster}’s {prev.field} poll.</div>}
          <div className="rd-pld-links">
            {key && window.AP.openPoll && <button type="button" className="rd-link" onClick={(ev) => { ev.stopPropagation(); window.AP.openPoll(key, facet, "latest and next polls"); }}>Open in All polls →</button>}
            {rdPollLinks(r.links)}
          </div>
        </div>
        {pj && (
          <div className="rd-pld-rhythm">
            <div className="rd-pld-h">{r.pollster}’s rhythm, last {rdNumWord(recent.length)} releases</div>
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
            {/* the house's "where it lands first" page (pollsterRules.site) belongs
                with the wait for the next poll, not on the name of the last one;
                the row's Next date carries the same link */}
            {e.next && e.next.site && <a className="rd-link rd-link-ext rd-pld-site" href={e.next.site} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}><span className="rd-link-t">Where the next one lands first</span> <span className="rd-apd-ext" aria-hidden="true">↗</span></a>}
          </div>
        )}
      </div>
    );
  };

  /* the All-polls facet-walk contract, here too: switching view (tabs,
     arrow walk, row nav, swipe) or flipping the matchup/basis holds the
     TABLE at its spot on screen while anything above it reflows - on
     narrow widths the twopp-only .rd-pl-ctlrow mount/unmount between the
     tab row and the table is the live height change (the pin's RO-on-
     ancestors answers it before the frame paints), and leaving twopp
     takes the controls out of the desktop tab row. Anchor the table
     itself first: pinning the tab row would hold the tabs and let the
     table ride the ctlrow's height (All-polls' .rd-ap-pctl lesson). The
     rows keep their pollster keys across a hop, so no reseat reshuffle.
     Ask for the pin on fine pointers too, like the All-polls facet walk
     and cycles' compare walk (the user's standing call: the laptop walk
     holds the way a phone's does). */
  const pinPl = () => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return;
    rdPinScroll([
      sec.querySelector(".rd-pl"),
      sec.querySelector(".rd-pl-tabs"),
    ], true);
  };
  const pickFacet = (id) => { pinPl(); setFacet(id); };
  const flipPick = () => { pinPl(); if (setTppMatchup) setTppMatchup(onMatch ? "alp_lnp" : "alp_on"); };
  const basisPick = () => { pinPl(); setTppBasis(basis === "imp" ? "resp" : "imp"); };

  const basisWord = onMatch ? (basis === "resp" ? "as published" : "implied flows") : (basis === "resp" ? "as published" : "implied flows");
  const controls = facet === "twopp" && (
    <span className="rd-pl-ctl">
      {!narrow && <span className="rd-pl-ctl-l">Two-party:</span>}
      <button type="button" className="rd-pl-flip" onClick={flipPick}
              title={"Show Labor v " + (onMatch ? "the Coalition" : "One Nation") + " instead"}>
        Labor v {rivalName} <span aria-hidden="true">⇄</span></button>
      <span className="rd-pl-ctl-l">, {narrow ? (basis === "resp" ? "published" : "implied") : basisWord}</span>
      <RdQPop label="How the two-party figures are counted" align="left">
        <h4>How the two-party figures are counted</h4>
        <p>{basis === "resp"
          ? "Each pollster’s own published figures, from where its respondents say their preferences would go."
          : "Each poll’s primary votes, run through one fixed set of preference flows, so every pollster is read the same way."}</p>
        <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
          <RdSwitch on={basis === "resp"} onToggle={basisPick} label="Show the pollsters’ published figures" /></div>
        <p className="rd-qnote">The switch changes the whole page, the headline figures included.</p>
      </RdQPop>
    </span>
  );

  /* Pointing at the card makes its facet row the arrow-key target without
     moving DOM focus. Real keyboard focus still wins, and the capture phase
     beats the page's own left/right page turn. */
  const hoverKeys = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return undefined;
    const enter = () => { hoverKeys.current = true; };
    const leave = () => { hoverKeys.current = false; };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!hoverKeys.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      const n = RD_PL_FACETS.length;
      const i = RD_PL_FACETS.findIndex((x) => x.id === facet);
      if (i < 0) return;
      pickFacet(RD_PL_FACETS[(i + (e.key === "ArrowRight" ? 1 : -1) + n) % n].id);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [facet]);

  /* Spacebar flips the two-party contest and p the published/implied
     basis while the table is on screen - the tab row's "Labor v X ⇄"
     button and the "Show the pollsters’ published figures" switch, by
     key. The claim is the viewport (IntersectionObserver, not the
     pointer) and twopp-facet only; in every other state, or while real
     focus is anywhere but the page, space keeps its scroll day job and
     p is left alone. */
  const spaceFlip = React.useRef(null);
  spaceFlip.current = facet === "twopp" && setTppMatchup ? flipPick : null;
  const pubFlip = React.useRef(null);
  pubFlip.current = facet === "twopp" && setTppBasis ? basisPick : null;
  React.useEffect(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver((es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current) return;
      const isPub = e.key === "p" || e.key === "P";
      if (!isPub && e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (!isPub && e.shiftKey)) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const act = isPub ? pubFlip.current : spaceFlip.current;
      if (!act) return;
      e.preventDefault();
      if (!e.repeat) act();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);

  /* up/down pollster to pollster: with a row focused, an arrow steps the
     focus a row; when the row was open, the expanded readout travels with it
     (clamped at the ends). Left and right walk the facet views, the tab
     row's own walk (wrapping round the ends), with the focus staying on
     the row. Enter or space opens and closes from the keyboard. */
  const plRef = React.useRef(null);
  const rowNav = (e, i) => {
    if (e.target !== e.currentTarget) return;
    const r = sorted[i].poll, isOpen = open === r.pollster;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : r.pollster); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const f = (RD_PL_FACETS.findIndex((x) => x.id === facet) + (e.key === "ArrowRight" ? 1 : -1) + RD_PL_FACETS.length) % RD_PL_FACETS.length;
      pickFacet(RD_PL_FACETS[f].id);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const j = i + (e.key === "ArrowDown" ? 1 : -1);
    const nx = sorted[j];
    if (!nx) return;
    if (isOpen) setOpen(nx.poll.pollster);
    const rows = plRef.current ? plRef.current.querySelectorAll(".rd-pl-item > .rd-pl-row") : [];
    if (rows[j]) rows[j].focus();
  };

  /* ---- the calendar fold-out: the projection laid out by month ---------
     The same projection the table's Next column reads, horizon widened to
     two months (npProject's opts.horizonDays), as a list: a date is the
     earliest that house's wave could land, a span a window the wave can
     fall anywhere in. Only a house's first slot can already be due - the
     walk stops there - so the due lead-in lists at most one per house, the
     same standing claim the table makes rather than a second guess. */
  const calProj = window.AP.nextPolls ? window.AP.nextPolls(null, { horizonDays: RD_CAL_DAYS }) : { rows: [] };
  const calOver = [], calItems = [];
  const calDays = new Map();   /* a release date -> the houses landing on it */
  calProj.rows.forEach((r) => {
    if (r.overdue) { calOver.push(r); return; }
    const me = { name: r.pollster, site: r.site };
    if (r.loose && !irregular(r)) {
      calItems.push({ key: "w" + r.pollster, at: r.release - r.spread * DAY_MS, close: r.release + r.spread * DAY_MS, win: true, spread: r.spread, who: [me] });
    } else if (irregular(r)) {
      calItems.push({ key: "i" + r.pollster + "-" + (r.ahead || 0), at: r.release, irr: true, spread: r.spread, who: [me] });
    } else {
      const iso = new Date(r.release).toISOString().slice(0, 10);
      let e = calDays.get(iso);
      if (!e) { e = { key: "d" + iso, at: r.release, who: [] }; calDays.set(iso, e); calItems.push(e); }
      e.who.push(me);
    }
  });
  calOver.sort((a, b) => a.release - b.release);
  calItems.sort((a, b) => a.at - b.at);
  calItems.forEach((it) => {
    if (it.win) it.q = it.at <= t0 ? "open now" : "window";
    else if (it.irr) it.q = "give or take " + Math.round(it.spread) + " days";
    else if (it.at === t0) it.q = "today";
    else if (it.at === t0 + DAY_MS) it.q = "tomorrow";
  });
  const calMonths = [];
  calItems.forEach((it) => {
    const ym = new Date(it.at).toISOString().slice(0, 7);
    const g = calMonths[calMonths.length - 1];
    if (!g || g.ym !== ym) calMonths.push({ ym, items: [it] });
    else g.items.push(it);
  });
  /* the date cell: weekday and day inside the month its head names; a
     window keeps both ends, an irregular house keeps its "about" */
  const calSpanTxt = (a, b) => {
    const A = new Date(a), B = new Date(b);
    return A.getUTCMonth() === B.getUTCMonth() ? A.getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b);
  };
  const calDateTxt = (it) => it.win ? calSpanTxt(it.at, it.close)
    : it.irr ? "About " + dm(it.at)
    : WDs(it.at) + " " + new Date(it.at).getUTCDate();
  const calOverTxt = (r) => r.loose && !irregular(r) ? calSpanTxt(r.release - r.spread * DAY_MS, r.release + r.spread * DAY_MS)
    : irregular(r) ? "About " + dm(r.release)
    : wdm(r.release);
  /* a house name links out to where its wave lands first (its
     pollsterRules.site) - the same claim the Next column's date makes */
  const calWho = (w, i) => (
    <span key={String(i)}>{i > 0 ? ", " : ""}{w.site
      ? <a href={w.site} target="_blank" rel="noopener noreferrer" title={"Where " + w.name + "’s next poll lands first"}>{w.name}<span className="plink-mark" aria-hidden="true">↗</span></a>
      : w.name}</span>);

  return (
    <RdSec id="latest-polls" cls="rd-polls" facet={facet} title="Latest and next polls"
           meta={entries.length + " pollsters, latest release " + (narrow ? dm(newest.pubMs) : wdm(newest.pubMs))}>
      <p className="rd-dek rd-pl-dek">
        {phone ? "The newest poll from each pollster, and the earliest its next could land. Tap a pollster for the full poll."
          : "The newest poll from each pollster, and the earliest its next could land, projected from its recent rhythm." + (narrow ? " Tap a pollster for the full poll." : " Open a row for the full poll and the releases behind the projection.")}
      </p>
      <RdTabs swipe value={facet} onChange={pickFacet} options={narrow ? RD_PL_FACETS.map((f) => (f.id === "leadership" ? { ...f, label: "Leaders" } : f)) : RD_PL_FACETS}
              ariaLabel="Poll table view" className="rd-pl-tabs">
        {!narrow && controls}
      </RdTabs>
      {narrow && controls && <div className="rd-pl-ctlrow">{controls}</div>}
      <div className="rd-pl" role="table" aria-label="Latest poll and next expected release, by pollster" ref={plRef}>
        <div className="rd-pl-head" role="row">
          <span role="columnheader" className="rd-pl-c-name">
            <button type="button" className="rd-pl-sort" onClick={() => onSort("pollster")}>Pollster</button></span>
          <span role="columnheader" className="rd-pl-c-latest">
            <button type="button" className={"rd-pl-sort" + (sort.key === "latest" ? " on" : "")} onClick={() => onSort("latest")}>Latest <span aria-hidden="true">{caret("latest")}</span></button></span>
          <span role="columnheader" className="rd-pl-c-figs"><RdSwap k={facet}>{figHead}</RdSwap></span>
          <span role="columnheader" className="rd-pl-c-tl">
            <span className="rd-pl-tlcap">Releases, next</span>
            <span className="rd-pl-ticks">{ticks.map((t) => <span key={t.label} className={t.today ? "today" : ""} style={{ left: t.x + "%" }}>{t.label}</span>)}</span>
          </span>
          <span role="columnheader" className="rd-pl-c-next">
            <button type="button" className={"rd-pl-sort" + (sort.key === "next" ? " on" : "")} onClick={() => onSort("next")}>Next, at the earliest <span aria-hidden="true">{caret("next")}</span></button></span>
          <span className="rd-pl-c-exp" aria-hidden="true"></span>
        </div>
        {sorted.map((e, i) => {
          const r = e.poll, isOpen = open === r.pollster, nx = nextWords(e);
          const cad = cadWords(e);
          return (
            <div key={r.pollster} className={"rd-pl-item" + (isOpen ? " open" : "") + (e.stale ? " stale" : "")}>
              <div className="rd-pl-row" role="row" onClick={() => setOpen(isOpen ? null : r.pollster)} tabIndex={0} aria-expanded={isOpen} onKeyDown={(ev) => rowNav(ev, i)}>
                <span role="cell" className="rd-pl-c-name">
                  <span className="rd-pl-main">
                    {rdPollNameLink(r)}
                  </span>
                  <span className="rd-pl-sub">{r.client}{cad ? ", " + cad : ""}{e.stale ? <span className="rd-pl-long">, no poll in six weeks</span> : null}</span>
                </span>
                <span role="cell" className="rd-pl-c-latest">
                  <span className="rd-pl-main">{r.publishedLabel || r.releasedLabel}</span>
                  <span className="rd-pl-sub">{r.fieldPending ? "fieldwork TBC" : r.field}{r.sample ? ", " + r.sample.toLocaleString() : ""}</span>
                </span>
                <span role="cell" className="rd-pl-c-figs"><RdSwap k={facet}>{figCell(e)}</RdSwap></span>
                <span role="cell" className="rd-pl-c-tl">{strip(e)}</span>
                <span role="cell" className={"rd-pl-c-next" + (nx.missed ? " missed" : "")}>
                  <span className="rd-pl-main"><span className="rd-pl-short">Next </span>{e.next && e.next.site
                    /* the house's "where it lands first" page rides the projected
                       date: same treatment as the pollster name's link (rd.css
                       .rd-pl-main a + plink-mark) */
                    ? <a href={e.next.site} target="_blank" rel="noopener noreferrer" title={"Where " + r.pollster + "’s next poll lands first"} onClick={(ev) => ev.stopPropagation()}>{nx.date}<span className="plink-mark" aria-hidden="true">↗</span></a>
                    : nx.date}</span>
                  <span className="rd-pl-sub">{nx.sub}</span>
                </span>
                <span className="rd-pl-c-exp">
                  <button type="button" className={"rd-pl-exp" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                          aria-label={(isOpen ? "Close " : "Open ") + r.pollster + "’s poll and release rhythm"}
                          onClick={(ev) => { ev.stopPropagation(); setOpen(isOpen ? null : r.pollster); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
                </span>
                <span className="rd-pl-foot1" aria-hidden="true">
                  <span><b>{r.publishedLabel || r.releasedLabel}</b>, {r.fieldPending ? "fieldwork TBC" : r.field}</span>
                  <span className={nx.missed ? "missed" : ""}>Next <b>{nx.date}</b>{nx.sub ? ", " + nx.sub.replace(/, .*$/, "") : ""}</span>
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
      {(calMonths.length > 0 || calOver.length > 0) && (
        <details className="rd-evdrop rd-cal">
          <summary>Release calendar</summary>
          <div className="rd-cal-body">
            {calOver.length > 0 && (
              <div className="rd-cal-sec rd-cal-sec-over">
                <h4 className="rd-cal-m">Due, not yet recorded</h4>
                <ul className="rd-cal-list">
                  {calOver.map((r) => (
                    <li key={r.pollster}>
                      <span className="rd-cal-d">{calOverTxt(r)}</span>
                      <span className="rd-cal-w">{calWho({ name: r.pollster, site: r.site }, 0)}</span>
                      {r.missed && <span className="rd-cal-q">{when(r.closesIn)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {calMonths.map((g) => (
              <div className="rd-cal-sec" key={g.ym}>
                <h4 className="rd-cal-m">{rdMonthYear(g.ym)}</h4>
                <ul className="rd-cal-list">
                  {g.items.map((it) => (
                    <li key={it.key}>
                      <span className="rd-cal-d">{calDateTxt(it)}</span>
                      <span className="rd-cal-w">{it.who.map((w, i) => calWho(w, i))}</span>
                      {it.q && <span className="rd-cal-q">{it.q}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="rd-note">The table’s own projections two months out: a date is the earliest that house’s wave could land; a span is a window the wave can fall anywhere in, from a house that keeps no set day. Both come from each house’s recent rhythm, never from a promise — a house that misses its slot stays listed until its wave is added.</p>
        </details>
      )}
    </RdSec>
  );
}

Object.assign(window, { RdPolls });
