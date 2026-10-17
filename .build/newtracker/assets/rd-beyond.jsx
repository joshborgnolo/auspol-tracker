// ====================================================================
// BEYOND THE VOTE – the ☰ menu's issues page
// ====================================================================
/* What the pollsters ask beyond voting intention, by topic: the recurring
   questions charted pollster by pollster, the questions worth a reader's time
   as cards, and everything else filed under each topic's "More questions".
   The payload is the sidecar gen-data builds with beyond-the-vote.mjs (the
   curation and every figure's rules live there: sides, printed totals, the
   95% margin behind each "level"); this file only draws it, fetched lazily
   like the cycle source since nothing else reads it. RdBeyond is the
   redesign section (head + body); BtvBody is the body alone, which the
   archived classic design mounts without the rd chrome (the .btv-* styles
   are page-level, not rd-gated). Replaced the /ad-hocs/ catalogue
   2026-10-18. */
const { useState: btvUseState, useEffect: btvUseEffect, useMemo: btvUseMemo } = React;

const BTV_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const btvDay = (iso) => Number(iso.slice(8, 10)) + " " + BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const btvMonth = (iso) => BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
/* a fieldwork span: one day, a range inside a month, or across months */
const btvSpan = (f) => {
  if (!f || !f.end) return "";
  if (!f.start || f.start === f.end) return btvDay(f.end);
  if (f.start.slice(0, 7) === f.end.slice(0, 7)) return Number(f.start.slice(8)) + "–" + btvDay(f.end);
  if (f.start.slice(0, 4) === f.end.slice(0, 4)) return Number(f.start.slice(8)) + " " + BTV_MON[+f.start.slice(5, 7) - 1] + " – " + btvDay(f.end);
  return btvDay(f.start) + " – " + btvDay(f.end);
};
/* shares print as the pollster printed them: whole numbers whole, Freshwater's
   tenths kept, nothing finer */
const btvN = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1));
const btvPct = (v) => btvN(v) + "%";
const btvSigned = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + btvN(Math.abs(v));
const btvHouse = (src, houses, full) => (houses[src.house] ? houses[src.house][full ? "full" : "short"] : src.house);
const btvCap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const btvWord = (n) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
/* an answer set inside a sentence ("14% unsure"): lower-cased, unless it
   opens on a name */
const btvLow = (s) => (!s || /^(?:Australia|Australian|Labor|Liberal|Coalition|One Nation|Greens|Trump|Albanese|Hanson|I\b)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
/* a long card takes the row: many rows, or long statements */
const btvWide = (c) => c.kind === "nets" || (c.kind === "stack" && (c.rows.length >= 7
  || c.rows.length * (c.rows.reduce((t, r) => t + (r.label || r.wording || "").length, 0) / c.rows.length) > 220));

/* ---- the bar: one question's answers on a 0–100 track ------------------- */
/* The agreeing side runs from the left, the disagreeing side ends at the
   right, whatever the pollster left unprinted (a "neither" it never
   published) sits as bare track between them */
function BtvBar({ segs, tall }) {
  const shown = segs.filter((s) => s.v > 0);
  const rest = Math.max(0, 100 - shown.reduce((t, s) => t + s.v, 0));
  const firstB = shown.findIndex((s) => s.side === "b");
  const at = firstB < 0 ? shown.length : firstB;
  const seq = rest >= 0.5 ? [...shown.slice(0, at), { side: "gap", v: rest }, ...shown.slice(at)] : shown;
  return (
    <span className={"btv-bar" + (tall ? " btv-bar-t" : "")} role="img"
      aria-label={shown.map((s) => btvPct(s.v) + " " + s.label).join(", ")}>
      {seq.map((s, i) => s.side === "gap"
        ? <i key={i} className="btv-gap" style={{ width: s.v + "%" }} />
        : <i key={i} className={"btv-seg btv-" + s.side + s.tone} style={{ width: s.v + "%" }} title={btvPct(s.v) + " " + s.label} />)}
    </span>
  );
}
function BtvSwatch({ side, tone }) {
  return <i className={"btv-sw btv-" + side + tone} aria-hidden="true" />;
}

/* ---- a single question ---------------------------------------------------- */
function BtvSplit({ c }) {
  const mids = c.segs.filter((s) => s.side === "m" && s.v > 0);
  const rest = Math.round(100 - c.a - c.b - c.m - (c.x || 0));
  return (
    <div className="btv-split">
      <div className="btv-ends">
        <span className="btv-end"><BtvSwatch side="a" tone={2} /><b>{btvPct(c.a)}</b> {c.names[0]}</span>
        <span className="btv-end btv-end-b"><b>{btvPct(c.b)}</b> {c.names[1]}<BtvSwatch side="b" tone={2} /></span>
      </div>
      <BtvBar segs={c.segs} tall />
      <p className="btv-mids">
        {mids.map((s, i) => <span key={i}>{btvPct(s.v)} {btvLow(s.label)}</span>)}
        {c.x >= 1 ? <span>{btvPct(c.x)} {btvLow(c.xLabel || "")}</span> : null}
        {rest >= 3 ? <span>{rest}% not published</span> : null}
      </p>
      {c.sig === false ? <p className="btv-level">Level: the gap is inside the margin of error.</p> : null}
    </div>
  );
}

/* ---- rows of one question each -------------------------------------------- */
function BtvStack({ c, houses }) {
  const [all, setAll] = btvUseState(false);
  const rows = c.show && !all ? c.rows.slice(0, c.show) : c.rows;
  return (
    <div className="btv-stack">
      <div className="btv-key">
        {c.legend.map((l, i) => <span key={i}><BtvSwatch side={l.side} tone={l.tone} />{l.label}</span>)}
        {c.shades ? <span className="btv-key-n">Stronger answers in full colour, milder ones faded</span> : null}
      </div>
      <div className="btv-rows">
        {rows.map((r, i) => (
          <div className="btv-row" key={i}>
            <div className="btv-rl">
              {c.mode === "battery" ? <span>{r.label}</span> : (
                <>
                  <span className={c.mode === "waves" ? "" : "btv-rh"}>{r.label || (c.mode === "waves" ? btvMonth(r.when || r.src.field.end) : btvHouse(r.src, houses))}
                    {c.mode === "compare" && !r.label ? <span className="btv-rd"> · {btvMonth(r.src.field.end)}</span> : null}</span>
                  {r.wording ? <span className="btv-rw">{r.wording}</span> : null}
                </>
              )}
            </div>
            <span className="btv-va">{btvN(r.a)}</span>
            <BtvBar segs={r.segs} />
            <span className="btv-vb">{btvN(r.b)}</span>
            <span className="btv-net" title={r.sig === false ? "The gap is inside the margin of error" : ""}>{r.sig === false ? "level" : ""}</span>
          </div>
        ))}
      </div>
      {c.show && c.rows.length > c.show ? (
        <button type="button" className="btv-all" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : "Show all " + c.rows.length}
        </button>
      ) : null}
      {c.summary ? <p className="btv-sum">{c.summary}</p> : null}
    </div>
  );
}

/* ---- a ranked list -------------------------------------------------------- */
function BtvRank({ c }) {
  const [all, setAll] = btvUseState(false);
  const top = Math.max(...c.rows.map((r) => r.v), 1);
  const rows = !all ? c.rows.slice(0, c.show) : c.rows;
  const tenths = c.rows.some((r) => Math.abs(r.v - Math.round(r.v)) >= 0.05);
  return (
    <div className="btv-rank">
      {rows.map((r, i) => (
        <div className="btv-rk" key={i}>
          <span className="btv-rkl">{r.label}</span>
          <span className="btv-rkb"><i style={{ width: (r.v / Math.max(top, 50)) * 100 + "%" }} /></span>
          <span className="btv-rkv">{tenths ? r.v.toFixed(1) + "%" : btvPct(r.v)}</span>
        </div>
      ))}
      {c.rows.length > c.show ? (
        <button type="button" className="btv-all" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all " + c.rows.length}</button>
      ) : null}
      {c.base ? <p className="btv-base">{c.base}</p> : null}
    </div>
  );
}

/* ---- net scores either side of zero ----------------------------------------- */
function BtvNets({ c }) {
  const span = Math.max(...c.rows.map((r) => Math.abs(r.v)), 10);
  return (
    <div className="btv-nets">
      {c.rows.map((r, i) => (
        <div className="btv-nt" key={i}>
          <span className="btv-ntl">{r.label}</span>
          <span className="btv-ntb">
            <i className={r.v >= 0 ? "btv-a2" : "btv-b2"}
              style={r.v >= 0 ? { left: "50%", width: (r.v / span) * 50 + "%" } : { right: "50%", width: (-r.v / span) * 50 + "%" }} />
            <b style={r.v >= 0 ? { left: "calc(50% + " + (r.v / span) * 50 + "% + 6px)" } : { right: "calc(50% + " + (-r.v / span) * 50 + "% + 6px)" }}>{btvSigned(r.v)}</b>
          </span>
        </div>
      ))}
      {c.unit ? <p className="btv-base">{btvCap(c.unit)}</p> : null}
    </div>
  );
}

/* ---- the pollster's table of record, behind a fold ------------------------- */
function BtvTable({ t }) {
  const rows = t.rows || [];
  const wide = (t.headers && t.headers.length > 2) || rows.some((r) => r.length > 2);
  return (
    <div className="btv-tb">
      {t.title ? <p className="btv-tbt">{t.title}</p> : null}
      <div className="btv-twrap">
        <table className="btv-table">
          {t.headers && t.headers.length ? <thead><tr>{t.headers.map((h, i) => <th key={i} className={i ? "" : "btv-l"}>{h}</th>)}</tr></thead> : null}
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>{r.map((v, ci) => {
                const n = typeof v === "number" ? v : parseFloat(v);
                return <td key={ci} className={ci ? "" : "btv-l"}>{ci === 0 ? v : v == null || v === "" ? "–" : Number.isFinite(n) && !/[a-z]/i.test(String(v)) ? btvN(n) + (wide ? "" : "%") : v}</td>;
              })}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* the line under every card: who asked, when, how many, where it was published,
   and the exact wording a tap away */
function BtvSource({ src, houses, question, extra }) {
  return (
    <div className="btv-src">
      <span className="btv-src-l">
        <b>{btvHouse(src, houses, true)}</b>
        <span>{btvSpan(src.field)}</span>
        {src.n ? <span>{src.n.toLocaleString("en-AU")} people</span> : null}
        {src.url ? <a href={src.url} target="_blank" rel="noopener">Source ↗</a> : null}
      </span>
      {question ? (
        <details className="btv-wd">
          <summary>The question as asked</summary>
          <p>{question}</p>
          {extra}
        </details>
      ) : null}
    </div>
  );
}

function BtvCard({ c, houses }) {
  const body = c.kind === "split" ? <BtvSplit c={c} />
    : c.kind === "stack" ? <BtvStack c={c} houses={houses} />
    : c.kind === "rank" ? <BtvRank c={c} />
    : c.kind === "nets" ? <BtvNets c={c} /> : null;
  const folds = (c.folds || []).filter((t) => (t.rows || []).length);
  return (
    <article className={"btv-card btv-k-" + c.kind + (btvWide(c) ? " btv-wide" : "")}>
      <h4 className="btv-q">{c.title}</h4>
      {body}
      {c.note ? <p className="btv-note">{c.note}</p> : null}
      {c.src && c.src.field ? (
        <BtvSource src={c.src} houses={houses} question={c.question}
          extra={folds.length ? folds.map((t, i) => <BtvTable key={i} t={t} />) : null} />
      ) : (
        <div className="btv-src"><span className="btv-src-l">
          {c.mode === "waves" ? <b>{btvHouse(c.src || c.rows[0].src, houses, true)}</b> : null}
          {(() => {
            const seen = new Set();
            const links = (c.rows || []).filter((r) => r.src && r.src.url && !seen.has(r.src.url) && seen.add(r.src.url));
            return links.length ? (
              <span className="btv-srcs">Sources: {links.map((r, i) => (
                <a key={i} href={r.src.url} target="_blank" rel="noopener">{c.mode === "waves" ? btvMonth(r.src.field.end) : btvHouse(r.src, houses) + " " + btvMonth(r.src.field.end)} ↗</a>
              ))}</span>
            ) : null;
          })()}
        </span></div>
      )}
    </article>
  );
}

/* ---- a tracker: one small chart per pollster -------------------------------- */
function BtvTracker({ c, houses }) {
  const narrow = useNarrow(MQ_PHONE);
  const x0 = Math.min(...c.panels.flatMap((p) => p.points.map((q) => q.x))) - 0.06;
  const x1 = Math.max(...c.panels.flatMap((p) => p.points.map((q) => q.x))) + 0.06;
  const [lo, hi] = c.yDomain;
  const step = hi - lo > 50 ? 25 : 10;
  /* the ticks: each January and July inside the window */
  const ticks = [];
  for (let y = Math.floor(x0); y <= Math.ceil(x1); y++) {
    for (const m of [0, 6]) {
      const x = y + m / 12;
      if (x >= x0 && x <= x1) ticks.push({ x, label: BTV_MON[m] + " " + String(y).slice(2) });
    }
  }
  const fmt = (v) => (c.measure === "net" ? btvSigned(v) : btvPct(v));
  const yt = [];
  for (let v = lo + step; v <= hi + 1e-9; v += step) yt.push(v);
  const rows = c.panels.flatMap((p) => p.points.map((q) => ({ ...q, house: p.house }))).sort((p, q) => q.x - p.x);
  return (
    <div className="btv-tracker">
      <h4 className="btv-th">{c.head}</h4>
      <p className="btv-tdek">{c.dek}</p>
      <p className="btv-tlab">{c.title}</p>
      <div className={"btv-pgrid btv-pg" + c.panels.length}>
        {c.panels.map((p) => {
          const pts = p.points.map((q) => ({ x: q.x, y: q.v }));
          const last = p.points[p.points.length - 1];
          return (
            <div className="btv-panel" key={p.house}>
              <div className="btv-ptop"><span>{btvHouse(p, houses)}</span><b>{fmt(last.v)}</b></div>
              <div className="btv-plab">{p.label}<span> · {p.points.length === 1 ? "one reading" : p.points.length + " readings"}</span></div>
              <TrendChart key={"btv-" + c.id + "-" + p.house} heightPx={narrow ? 118 : 138} padPx={{ l: 30, r: 8, t: 10, b: 22 }}
                xDomain={[x0, x1]} yDomain={[lo, hi]} yTicks={yt} yTickFmt={() => ""} xTicks={ticks} baseline
                notes={yt.map((v) => ({ x: "left", y: v, dy: -3, text: c.measure === "net" ? btvSigned(v) : v + (v === hi ? "%" : ""), size: 10.5, cls: "btv-ylab" }))}
                refLines={c.ref != null ? [{ y: c.ref, label: "", color: "var(--ink-faint)" }] : []}
                series={[{ id: p.house, label: btvHouse(p, houses), color: "var(--ink-2)", rdWidth: 1.6, endCap: false, smooth: false, points: pts }]}
                spine={pts}
                scatter={p.points.map((q) => ({ x: q.x, y: q.v, color: "var(--ink)", label: c.measure === "net" ? "Net" : btvCap(c.names[0]),
                  meta: { pollster: btvHouse(p, houses, true), dateLabel: btvSpan(q.field), sample: q.n } }))}
                tooltipTitle={(i) => (p.points[i] ? btvSpan(p.points[i].field) : "")}
                extraRows={(i) => {
                  const q = p.points[i];
                  return q ? [{ label: btvCap(c.names[0]), value: btvPct(q.a) }, { label: btvCap(c.names[1]), value: btvPct(q.b) }] : [];
                }}
                fmt={fmt}
                copy={{ title: c.title.replace(/, by pollster$/, "") + ": " + btvHouse(p, houses, true), sub: c.head + ". " + p.label, legend: [] }}
              />
            </div>
          );
        })}
      </div>
      <p className="btv-tkey">
        <span><i className="btv-dot" aria-hidden="true" />One poll</span>
        <span><i className="btv-ln" aria-hidden="true" />The line joins one pollster’s own readings</span>
        {c.ref != null ? <span><i className="btv-rl0" aria-hidden="true" />{c.refLabel}</span> : null}
      </p>
      {c.note ? <p className="btv-note">{c.note}</p> : null}
      <details className="btv-ledger">
        <summary>All {rows.length} readings</summary>
        <div className="btv-twrap">
          <table className="btv-table">
            <thead><tr>
              <th className="btv-l">Pollster</th><th className="btv-l">Fieldwork</th><th>Sample</th>
              <th>{c.cols[0]}</th><th>{c.cols[1]}</th><th>{c.cols[2]}</th>{c.measure === "net" ? <th>Net</th> : null}<th />
            </tr></thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={i}>
                  <td className="btv-l">{btvHouse(q, houses)}</td><td className="btv-l">{btvSpan(q.field)}</td>
                  <td>{q.n ? q.n.toLocaleString("en-AU") : "–"}</td>
                  <td>{btvN(q.a)}</td><td>{btvN(q.m)}</td><td>{btvN(q.b)}</td>
                  {c.measure === "net" ? <td><b>{btvSigned(q.v)}</b></td> : null}
                  <td>{q.url ? <a href={q.url} target="_blank" rel="noopener">Source ↗</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ---- the topic's long tail -------------------------------------------------- */
function BtvMore({ t, houses }) {
  return (
    <details className="btv-more">
      <summary>More questions on {t.about || t.title}<span> · {t.more.length}</span></summary>
      <ul className="btv-ml">
        {t.more.map((q) => (
          <li key={q.id + q.house}>
            <details className="btv-mi">
              <summary><span className="btv-mq">{q.title}</span>
                <span className="btv-mm">{btvHouse(q, houses)} · {btvMonth(q.last)}{q.waves.length > 1 ? " · " + q.waves.length + " readings" : ""}</span></summary>
              {q.waves.map((w, i) => (
                <div className="btv-mw" key={i}>
                  {q.waves.length > 1 ? <p className="btv-mwd">{btvSpan(w.field)}</p> : null}
                  {w.tables.length ? w.tables.map((tb, ti) => <BtvTable key={ti} t={tb} />)
                    : <p className="btv-note">{w.prose.length ? w.prose.join(" ").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—") : "The figures are in the source."}</p>}
                  <BtvSource src={w} houses={houses} question={w.question} />
                </div>
              ))}
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}

function BtvTopic({ t, houses }) {
  const trackers = t.blocks.filter((b) => b.kind === "tracker");
  const cards = t.blocks.filter((b) => b.kind !== "tracker");
  return (
    <section className="btv-topic" id={"btv-" + t.id} aria-labelledby={"btv-h-" + t.id}>
      <h3 className="btv-tt" id={"btv-h-" + t.id}>{t.title}</h3>
      <p className="btv-tdk">{t.dek}</p>
      {trackers.map((c) => <BtvTracker key={c.id} c={c} houses={houses} />)}
      {cards.length ? <div className="btv-grid">{cards.map((c, i) => <BtvCard key={(c.id || "") + i} c={c} houses={houses} />)}</div> : null}
      {t.more.length ? <BtvMore t={t} houses={houses} /> : null}
    </section>
  );
}

function BtvBody() {
  const { D } = window.AP;
  const [src, setSrc] = btvUseState(null);
  const [failed, setFailed] = btvUseState(false);
  const [tries, setTries] = btvUseState(0);
  btvUseEffect(() => {
    let live = true;
    D.loadOneOffs().then((j) => {
      if (!live) return;
      if (j && Array.isArray(j.topics)) { setSrc(j); setFailed(false); }
      else setFailed(true);
    });
    return () => { live = false; };
  }, [tries]);
  /* a link to a topic (#btv-immigration) lands once the topics exist. The
     browser's own jump found no such id in the static article it painted
     first, and an element's scrollIntoView fired while the first frames are
     still settling overshot to the page foot, so the page scrolls itself,
     two frames on, to the section's top less the pinned bar's clearance. */
  btvUseEffect(() => {
    if (!src) return;
    const h = (window.location.hash || "").replace(/^#/, "");
    if (!/^btv-/.test(h)) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const el = document.getElementById(h);
        if (!el) return;
        const pad = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad), behavior: "instant" });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [src]);
  const topics = btvUseMemo(() => (src ? src.topics.filter((t) => t.blocks.length || t.more.length) : []), [src]);

  if (failed) {
    return (
      <div className="btv">
        <p className="btv-note">The questions could not be loaded.{" "}
          <button type="button" className="btv-retry" onClick={() => setTries((n) => n + 1)}>Try again</button></p>
      </div>
    );
  }
  if (!src) return <div className="btv"><p className="btv-note">Loading the questions…</p></div>;
  if (!topics.length) return <div className="btv"><p className="btv-note">No questions are on file yet.</p></div>;
  const houses = src.houses || {};
  const more = topics.reduce((n, t) => n + t.more.length, 0);
  return (
    <div className="btv">
      <nav className="btv-nav" aria-label="Topics">
        {topics.map((t) => <a key={t.id} href={"#btv-" + t.id}>{t.short}</a>)}
      </nav>
      <p className="btv-scope">
        {src.counts.featured} questions in charts and cards, and {more} more in the topics’ lists, from {btvWord(Object.keys(houses).length)} pollsters
        {" "}since {btvMonth(src.first)}. Every figure names its pollster, its dates and its sample, and links to its source.
      </p>
      {topics.map((t) => <BtvTopic key={t.id} t={t} houses={houses} />)}
      <div className="btv-how">
        <p><b>How to read the cards.</b> Each bar is one poll’s answers on a scale of 0 to 100, as the pollster printed them, with
          the agreeing side on the left and the disagreeing side on the right; stronger answers are in full colour, milder ones faded. Where
          the two sides are within the poll’s 95% margin of error, the card says “level” rather than naming a winner.
          Pollsters word their questions differently, so compare a pollster with itself before comparing it with another.</p>
        <p><b>What is left out.</b> Questions about sport, holidays and personal habits, state politics, surveys run before
          this term, and questions the main page already tracks, such as whether the country is heading in the right direction.</p>
      </div>
    </div>
  );
}

function RdBeyond() {
  return (
    <section className="rd-sec rd-btv" id="beyond-the-vote" aria-labelledby="rd-btv-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-btv-t">Beyond the vote</h2>
        <span className="rd-meta">What else Australians tell the pollsters</span>
      </div>
      <RdHed head="What Australians think about the issues"
        dek="Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, from Donald Trump and immigration to the budget, the Iran war and the Bondi attack, in ten topics. Where several pollsters asked the same thing, their answers sit side by side." />
      <BtvBody />
    </section>
  );
}

const RdBeyondM = React.memo(RdBeyond);
const BtvBodyM = React.memo(BtvBody);

Object.assign(window, { RdBeyond: RdBeyondM, BtvBody: BtvBodyM });
