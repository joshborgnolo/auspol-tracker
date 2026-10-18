// ====================================================================
// BEYOND THE VOTE – the ☰ menu's issues page
// ====================================================================
/* What the pollsters ask beyond voting intention, by topic. The page opens
   on an index of the topics' findings, one sentence each; each topic then
   leads with its finding, charts its recurring question (one chart, a line
   per pollster, coloured by how the pollster asked), runs its questions as
   rows parted by hairlines (the question and its source on the left, the
   answers on the right), and files everything else under "More questions".
   No boxed cards and no chart per pollster: the 2026-10-18 redesign, the
   canvas's findings index and coloured lines (B) with its rows (A).
   The payload is the sidecar gen-data builds with beyond-the-vote.mjs (the
   curation and every figure's rules live there: sides, printed totals, the
   95% margin behind each "level" and each finding); this file only draws
   it, fetched lazily like the cycle source since nothing else reads it.
   RdBeyond is the redesign section (head + body); BtvBody is the body
   alone, which the archived classic design mounts without the rd chrome
   (the .btv-* styles are page-level, not rd-gated). Replaced the /ad-hocs/
   catalogue 2026-10-18. */
const { useState: btvUseState, useEffect: btvUseEffect, useMemo: btvUseMemo } = React;

const BTV_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const btvDay = (iso) => Number(iso.slice(8, 10)) + " " + BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const btvMonth = (iso) => BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
/* a month as the chart's axis writes it ("Dec 25") */
const btvMonYY = (iso) => BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(2, 4);
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
/* a topic's number, shared by the findings index and the topic's own head */
const btvNo = (i) => String(i + 1).padStart(2, "0");
/* an answer set inside a sentence ("14% unsure"): lower-cased, unless it
   opens on a name */
const btvLow = (s) => (!s || /^(?:Australia|Australian|Labor|Liberal|Coalition|One Nation|Greens|Trump|Albanese|Hanson|I\b)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

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

/* who asked, when, how many, where it was published, and the exact wording
   a tap away */
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
/* several polls' sources: one link a poll (or a wave) */
function BtvSources({ c, houses }) {
  const seen = new Set();
  const links = (c.rows || []).filter((r) => r.src && r.src.url && !seen.has(r.src.url) && seen.add(r.src.url));
  return (
    <div className="btv-src"><span className="btv-src-l">
      {c.mode === "waves" ? <b>{btvHouse(c.src || c.rows[0].src, houses, true)}</b> : null}
      {links.length ? (
        <span className="btv-srcs">Sources: {links.map((r, i) => (
          <a key={i} href={r.src.url} target="_blank" rel="noopener">{c.mode === "waves" ? btvMonth(r.src.field.end) : btvHouse(r.src, houses) + " " + btvMonth(r.src.field.end)} ↗</a>
        ))}</span>
      ) : null}
    </span></div>
  );
}

/* ---- one question as a row: what was asked and by whom on the left, the
   answers on the right (stacked on a phone) ---------------------------------- */
function BtvItem({ c, houses }) {
  const body = c.kind === "split" ? <BtvSplit c={c} />
    : c.kind === "stack" ? <BtvStack c={c} houses={houses} />
    : c.kind === "rank" ? <BtvRank c={c} />
    : c.kind === "nets" ? <BtvNets c={c} /> : null;
  const folds = (c.folds || []).filter((t) => (t.rows || []).length);
  return (
    <article className={"btv-item btv-k-" + c.kind}>
      <div className="btv-il">
        <h4 className="btv-q">{c.title}</h4>
        {c.summary ? <p className="btv-sum">{c.summary}</p> : null}
        {c.note ? <p className="btv-note">{c.note}</p> : null}
        {c.src && c.src.field ? (
          <BtvSource src={c.src} houses={houses} question={c.question}
            extra={folds.length ? folds.map((t, i) => <BtvTable key={i} t={t} />) : null} />
        ) : <BtvSources c={c} houses={houses} />}
      </div>
      <div className="btv-ir">{body}</div>
    </article>
  );
}

/* ---- a tracker: every pollster on one chart --------------------------------
   Each line joins one pollster's own readings and is never joined to
   another's; its colour is the family of wording the pollster asked in
   (levels differ with the wording), its name sits at its end, and the list
   beside the chart gives each pollster's latest. A dot is one poll; the
   readout follows the dates the polls ended. */
function BtvTracker({ c, houses }) {
  const narrow = useNarrow(MQ_PHONE);
  const net = c.measure === "net";
  const pts = c.panels.flatMap((p) => p.points.map((q) => ({ ...q, house: p.house, fam: p.fam })));
  const x0 = Math.min(...pts.map((q) => q.x)) - 0.06;
  const x1 = Math.max(...pts.map((q) => q.x)) + 0.06;
  const [lo, hi] = c.yDomain;
  const step = c.yStep || (hi - lo > 50 ? 25 : 10);
  /* the ticks: each January and July inside the window */
  const ticks = [];
  for (let y = Math.floor(x0); y <= Math.ceil(x1); y++) {
    for (const m of [0, 6]) {
      const x = y + m / 12;
      if (x >= x0 && x <= x1) ticks.push({ x, label: BTV_MON[m] + " " + String(y).slice(2) });
    }
  }
  const fmt = (v) => (net ? btvSigned(v) : btvPct(v));
  const yt = [];
  for (let v = lo + step; v <= hi + 1e-9; v += step) yt.push(v);
  const ink = (f) => "var(--btv-w" + f + ")";
  const fams = c.families.map((label, i) => ({ label, i })).filter((f) => c.panels.some((p) => p.fam === f.i));
  /* the readout's spine: each date a poll ended, once */
  const spine = [...new Set(pts.map((q) => q.x))].sort((p, q) => p - q).map((x) => ({ x, y: pts.find((q) => q.x === x).v }));
  const at = (i) => (spine[i] ? pts.filter((q) => q.x === spine[i].x) : []);
  const latest = c.panels.map((p) => ({ p, q: p.points[p.points.length - 1] })).sort((a, b) => b.q.x - a.q.x);
  const rows = pts.slice().sort((p, q) => q.x - p.x);
  return (
    <div className="btv-tracker">
      <p className="btv-tlab">{c.title}</p>
      <p className="btv-tdek">{c.dek}</p>
      <p className="btv-fams">
        {fams.map((f) => <span key={f.i}><i className={"btv-wsw btv-w" + f.i} aria-hidden="true" />{f.label}</span>)}
      </p>
      <div className="btv-tbody">
        <div className="btv-tchart">
          {/* the .card class is the copy-as-image composer's cue to build the
              image from the chart's own copy (title, sub, legend), not to
              photograph the topic around it; .btv-chart takes off a card's
              chrome in both designs */}
          <div className="card rd-card btv-chart">
          <TrendChart key={"btv-" + c.id} heightPx={narrow ? 250 : 320} padPx={{ l: 34, r: 8, t: 20, b: 22 }}
            xDomain={[x0, x1]} yDomain={[lo, hi]} yTicks={yt} yTickFmt={() => ""} xTicks={ticks} baseline
            notes={yt.map((v) => ({ x: "left", y: v, dy: -3, text: net ? (v === 0 ? "Even" : btvSigned(v)) : v + (v === hi ? "%" : ""), size: 10.5, cls: "btv-ylab" }))}
            refLines={c.ref != null ? [{ y: c.ref, label: "", color: "var(--ink-faint)" }] : []}
            series={c.panels.map((p) => ({ id: p.house, label: btvHouse(p, houses), color: ink(p.fam), rdWidth: 2, smooth: false,
              endLabel: btvHouse(p, houses), points: p.points.map((q) => ({ x: q.x, y: q.v })) }))}
            spine={spine}
            scatter={pts.map((q) => ({ x: q.x, y: q.v, color: ink(q.fam), label: net ? "Net" : btvCap(c.names[0]),
              meta: { pollster: btvHouse(q, houses, true), dateLabel: btvSpan(q.field), sample: q.n } }))}
            tooltipTitle={(i) => { const qs = at(i); return qs.length === 1 ? btvSpan(qs[0].field) : qs.length ? btvDay(qs[0].field.end) : ""; }}
            extraRows={(i) => {
              const qs = at(i);
              return qs.flatMap((q) => {
                const pre = qs.length > 1 ? btvHouse(q, houses) + ": " : "";
                return net ? [{ label: pre + btvCap(c.names[0]), value: btvPct(q.a) }, { label: pre + btvCap(c.names[1]), value: btvPct(q.b) }]
                  : [{ label: pre + btvCap(c.names[1]), value: btvPct(q.b) }];
              });
            }}
            fmt={fmt}
            copy={{ title: c.title, sub: c.head + "." + (c.note ? " " + c.note : ""),
              span: btvMonYY(c.first) + " – " + btvMonYY(c.last),
              caption: "Each dot is one poll; a line joins one pollster’s own readings, coloured by how it asked.",
              legend: fams.map((f) => ({ label: f.label, color: ink(f.i), kind: "line" }))
                .concat(c.ref != null ? [{ label: c.refLabel, color: "var(--ink-faint)", kind: "dashed" }] : []) }}
          />
          <p className="rd-ckey btv-tkey">
            <span><i className="btv-dot" aria-hidden="true" />One poll</span>
            <span><i className="btv-ln" aria-hidden="true" />One pollster’s readings, joined</span>
            {c.ref != null ? <span><i className="btv-rl0" aria-hidden="true" />{c.refLabel}</span> : null}
          </p>
          </div>
          {c.note ? <p className="btv-note">{c.note}</p> : null}
        </div>
        <aside className="btv-latest" aria-label="Latest from each pollster">
          <p className="btv-lh">Latest from each pollster</p>
          <ul className="btv-ll">
            {latest.map(({ p, q }) => (
              <li key={p.house}>
                <span className="btv-lp">
                  <span className="btv-lnm"><i className={"btv-ldot btv-w" + p.fam} aria-hidden="true" />{btvHouse(p, houses)}
                    <span className="btv-ld">{btvDay(q.field.end)}</span></span>
                  <span className="btv-lq">{p.label}</span>
                </span>
                <b className="btv-lv">{fmt(q.v)}</b>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <details className="btv-ledger">
        <summary>All {rows.length} readings</summary>
        <div className="btv-twrap">
          <table className="btv-table">
            <thead><tr>
              <th className="btv-l">Pollster</th><th className="btv-l">Fieldwork</th><th>Sample</th>
              <th>{c.cols[0]}</th><th>{c.cols[1]}</th><th>{c.cols[2]}</th>{net ? <th>Net</th> : null}<th />
            </tr></thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={i}>
                  <td className="btv-l">{btvHouse(q, houses)}</td><td className="btv-l">{btvSpan(q.field)}</td>
                  <td>{q.n ? q.n.toLocaleString("en-AU") : "–"}</td>
                  <td>{btvN(q.a)}</td><td>{btvN(q.m)}</td><td>{btvN(q.b)}</td>
                  {net ? <td><b>{btvSigned(q.v)}</b></td> : null}
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

/* ---- a topic: its number and name, its finding, then the evidence ---------- */
function BtvTopic({ t, n, houses }) {
  const trackers = t.blocks.filter((b) => b.kind === "tracker");
  const items = t.blocks.filter((b) => b.kind !== "tracker");
  const count = [
    trackers.length ? (trackers.length === 1 ? "One chart" : btvCap(btvWord(trackers.length)) + " charts") : null,
    items.length ? items.length + (items.length === 1 ? " question" : " questions") : null,
    t.more.length ? t.more.length + " more" : null,
  ].filter(Boolean).join(" · ");
  return (
    <section className="btv-topic" id={"btv-" + t.id} aria-labelledby={"btv-h-" + t.id}>
      <div className="btv-tk">
        <h3 className="btv-tt" id={"btv-h-" + t.id}><span className="btv-tn">{n}</span>{t.title}</h3>
        <span className="btv-tc">{count}</span>
      </div>
      {t.finding ? <p className="btv-hl">{t.finding.text}</p> : null}
      <p className="btv-tdk">{t.dek}</p>
      {trackers.map((c) => <BtvTracker key={c.id} c={c} houses={houses} />)}
      {items.length ? <div className="btv-items">{items.map((c, i) => <BtvItem key={(c.id || "") + i} c={c} houses={houses} />)}</div> : null}
      {t.more.length ? <BtvMore t={t} houses={houses} /> : null}
    </section>
  );
}

/* ---- the findings: one sentence a topic, each a link to its topic ---------- */
function BtvFindings({ topics }) {
  return (
    <section className="btv-finds" aria-labelledby="btv-finds-h">
      <h3 className="btv-fh" id="btv-finds-h">The findings</h3>
      <ol className="btv-fl" role="list">
        {topics.map((t, i) => (t.finding ? (
          <li key={t.id}>
            <a className="btv-f" href={"#btv-" + t.id}>
              <span className="btv-fn" aria-hidden="true">{btvNo(i)}</span>
              <span className="btv-fb">
                <span className="btv-fk">{t.short}</span>
                <span className="btv-ft">{t.finding.text}</span>
                <span className="btv-fm">{t.finding.meta}</span>
              </span>
            </a>
          </li>
        ) : null))}
      </ol>
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
      <BtvFindings topics={topics} />
      <p className="btv-scope">
        {src.counts.featured} questions in charts and answers, and {more} more in the topics’ lists, from {btvWord(Object.keys(houses).length)} pollsters
        {" "}since {btvMonth(src.first)}. Every figure names its pollster, its dates and its sample, and links to its source.
      </p>
      {topics.map((t, i) => <BtvTopic key={t.id} t={t} n={btvNo(i)} houses={houses} />)}
      <div className="btv-how">
        <p><b>How the findings are called.</b> Each topic opens with what its first chart or question found. A side is said
          to lead only where the gap clears the poll’s 95% margin of error, and to be a majority only where its share clears
          half by its own margin; inside the margin, the answer is “level” and the voters “divided”.</p>
        <p><b>How to read the answers.</b> Each bar is one poll’s answers on a scale of 0 to 100, as the pollster printed them, with
          the agreeing side on the left and the disagreeing side on the right; stronger answers are in full colour, milder ones faded.
          In the charts, each line joins one pollster’s own readings and is coloured by how that pollster asked. Pollsters word
          their questions differently, so compare a pollster with itself before comparing it with another.</p>
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
        dek="Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, in ten topics from Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each opens with what the polls found; where several pollsters asked the same thing, their answers sit side by side." />
      <BtvBody />
    </section>
  );
}

const RdBeyondM = React.memo(RdBeyond);
const BtvBodyM = React.memo(BtvBody);

Object.assign(window, { RdBeyond: RdBeyondM, BtvBody: BtvBodyM });
