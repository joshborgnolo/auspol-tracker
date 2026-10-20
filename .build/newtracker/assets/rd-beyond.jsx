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
        <span className="btv-end"><BtvSwatch side="a" tone={2} /><b>{btvPct(c.a)}</b> <span className="btv-endl">{c.names[0]}</span></span>
        <span className="btv-end btv-end-b"><b>{btvPct(c.b)}</b> <span className="btv-endl">{c.names[1]}</span><BtvSwatch side="b" tone={2} /></span>
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
  /* the longest bar stops short of its edge, leaving its figure room */
  const span = Math.max(...c.rows.map((r) => Math.abs(r.v)), 10) * 1.2;
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

/* ---- a question's figures, as beyond-the-vote.mjs's figuresOf reads them ----
   A list of answers as bars, nets either side of zero, a battery as split
   bars (or, where its answers take no sides, as a table), the same figure's
   earlier waves beside it: a list's as columns to the right of the drawn
   one, a battery's as rows under each statement. A printed TOTAL or net
   sits under its answers in figures, never as a bar. */
const btvVal = (v, unit) => (v == null ? "–" : unit === "net" ? btvSigned(v) : unit === "score" ? btvN(v) : btvPct(v));
/* waves named to the day ("30 Jun 2026") drop the year they share */
const btvCols = (cols) => (cols.length > 1 && cols.every((c) => /^\d/.test(c) && c.slice(-4) === cols[0].slice(-4)) ? cols.map((c) => c.slice(0, -5)) : cols);
/* a summary's unit by its name: a net or a change is signed, a TOTAL a share */
const btvSumUnit = (label) => (/^net\b|\bnet\s|\bchange\b/i.test(label) ? "net" : "%");
const BTV_ENT = { rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", amp: "&", nbsp: " " };
const btvText = (s) => String(s || "").replace(/&(\w+);/g, (m, k) => BTV_ENT[k] || m);

/* the figure's own name (only where its question has more than one), then
   what its numbers measure and whom they were asked of */
function BtvFigHead({ f, solo }) {
  const t = solo ? null : f.title;
  const line = [f.measure ? btvCap(f.measure) : null, f.base].filter(Boolean).join(" · ");
  if (!t && !line) return null;
  return (
    <div className="btv-gh">
      {t ? <p className="btv-ght">{t}</p> : null}
      {line ? <p className="btv-ghb">{line}</p> : null}
    </div>
  );
}

/* answers as bars, in the order the pollster printed them; a second wave's
   (or an earlier reading's) figures as muted columns to the right */
function BtvFigList({ f }) {
  const multi = f.cols.length > 1;
  const unit = f.unit === "score" ? "score" : "%";
  const scale = unit === "score" ? f.max : Math.max(50, ...f.rows.map((r) => r.v[0] || 0));
  const w = (v) => Math.max(0, Math.min(100, ((v || 0) / scale) * 100)) + "%";
  return (
    <div className={"btv-gl" + (multi ? " btv-gl-m" : "")} role="table" aria-label={f.title || "Answers"} style={{ "--btv-n": f.cols.length }}>
      {multi ? (
        <div className="btv-gr btv-gr-h" role="row">
          <span role="columnheader" className="btv-gk">Answer</span><span aria-hidden="true" />
          {btvCols(f.cols).map((c, i) => <span key={i} role="columnheader" className="btv-gv">{c}</span>)}
        </div>
      ) : null}
      {f.rows.map((r, i) => (
        <div className="btv-gr" role="row" key={i}>
          <span role="rowheader" className="btv-gk">{r.label}</span>
          <span className="btv-gbar" aria-hidden="true"><i style={{ width: w(r.v[0]) }} /></span>
          {r.v.map((v, k) => <span key={k} role="cell" className={"btv-gv" + (k ? " btv-gv-o" : "")}>{btvVal(v, unit)}</span>)}
        </div>
      ))}
      {f.sums.map((r, i) => (
        <div className={"btv-gr btv-gr-s" + (i ? "" : " btv-gr-s1")} role="row" key={"s" + i}>
          <span role="rowheader" className="btv-gk">{r.label}</span><span aria-hidden="true" />
          {r.v.map((v, k) => <span key={k} role="cell" className={"btv-gv" + (k ? " btv-gv-o" : "")}>{btvVal(v, btvSumUnit(r.label))}</span>)}
        </div>
      ))}
    </div>
  );
}

/* nets either side of zero, the long-tail kin of BtvNets */
function BtvFigNets({ f }) {
  return <BtvNets c={{ rows: f.rows.map((r) => ({ label: r.label, v: r.v[0] })), unit: null }} />;
}

/* a battery's statements, each a split bar with its two sides' totals at
   its ends; waves of one statement as rows under it */
function BtvFigSplit({ f }) {
  const multi = f.cols.length > 1;
  const ex = f.extraHeads;
  const row = (key, label, w) => (
    <div className={"btv-row" + (label == null ? " btv-row-1" : "")} key={key} style={{ "--btv-x": ex.length }}>
      {label != null ? <div className="btv-rl"><span>{label}</span></div> : null}
      <span className="btv-va">{btvN(w.a)}</span>
      <BtvBar segs={w.segs} />
      <span className="btv-vb">{btvN(w.b)}</span>
      {w.extra.map((v, k) => <span className="btv-vx" key={k}>{btvVal(v, btvSumUnit(ex[k]))}</span>)}
    </div>
  );
  return (
    <div className={"btv-stack btv-gs" + (ex.length ? " btv-gs-x" : "")}>
      <div className="btv-key">
        {f.legend.map((l, i) => <span key={i}><BtvSwatch side={l.side} tone={l.tone} />{btvCap(l.label)}</span>)}
      </div>
      {ex.length ? (
        <div className={"btv-row btv-row-h" + (f.one ? " btv-row-1" : "")} style={{ "--btv-x": ex.length }} aria-hidden="true">
          {f.one ? null : <span className="btv-rlx" />}<span /><span /><span />
          {ex.map((h, k) => <span className="btv-vx" key={k}>{h}</span>)}
        </div>
      ) : null}
      <div className="btv-rows">
        {f.rows.map((r, i) => (multi && r.waves.length > 1 ? (
          <div className="btv-sg" key={i}>
            <p className="btv-sgl">{r.label}</p>
            {r.waves.map((w, k) => row(k, w.when, w))}
          </div>
        ) : row(i, f.one ? null : r.label + (multi ? " · " + r.waves[0].when : ""), r.waves[0])))}
      </div>
    </div>
  );
}

/* a battery whose answers take no sides, as the pollster tabled it */
function BtvFigTable({ f }) {
  const multi = f.cols.length > 1;
  const heads = f.heads.concat(f.extraHeads);
  const n = f.heads.length;
  const cells = (w) => w.cells.concat(w.extra).map((v, k) => (
    <td key={k} className={k < n ? "" : "btv-tc-x"}>{v == null ? "–" : k >= n && btvSumUnit(heads[k]) === "net" ? btvSigned(v) : btvN(v)}</td>
  ));
  return (
    <div className="btv-twrap">
      <table className="btv-table btv-gt">
        <thead><tr><th className="btv-l" />{heads.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {f.rows.flatMap((r, i) => (r.sect ? [<tr className="btv-tsec" key={i}><th colSpan={heads.length + 1} scope="colgroup" className="btv-l">{r.label}</th></tr>]
            : multi && r.waves.length > 1 ? [
              <tr className="btv-tgrp" key={i + "g"}><th colSpan={heads.length + 1} scope="colgroup" className="btv-l">{r.label}</th></tr>,
              ...r.waves.map((w, k) => <tr key={i + "-" + k}><th scope="row" className="btv-l btv-twv">{w.when}</th>{cells(w)}</tr>)]
            : [<tr key={i}><th scope="row" className="btv-l">{r.label}{multi ? <span className="btv-twd"> · {r.waves[0].when}</span> : null}</th>{cells(r.waves[0])}</tr>]))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- a trait series by leader pairing, as small multiples -------------------
   Newspoll's leader traits since 2008 come as one table a trait, segmented
   by PM v opposition leader. Each trait draws as a small chart with a line
   for Labor's leader and one for the Coalition's (the leaders change along
   the line, so a change of government swaps who holds office, not the
   colours); the tables stay behind a fold. Used only where every figure is
   such a table and every name places in a party. */
const BTV_LABOR = /\b(?:Rudd|Gillard|Shorten|Albanese)\b/, BTV_COAL = /\b(?:Turnbull|Abbott|Morrison|Dutton|Ley|Nelson|Taylor)\b/;
/* a fieldwork label's end, as a decimal year; one printed without its year
   ("12-15 January") follows the row before it */
const btvYear = (label, prev) => {
  const m = String(label).match(/(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s*$/);
  if (!m) return null;
  const mo = (BTV_MONF.indexOf(m[1]) + 0.5) / 12;
  if (m[2]) return +m[2] + mo;
  if (prev == null) return null;
  const y = Math.floor(prev);
  return y + mo > prev ? y + mo : y + 1 + mo;
};
const BTV_MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function btvTraitSeries(f) {
  if (f.kind !== "table" || f.heads.length !== 2 || !f.rows.some((r) => r.sect)) return null;
  let pair = null;
  const pts = [];
  for (const r of f.rows) {
    if (r.sect) {
      const [a, b] = r.label.split(" v ");
      const pa = BTV_LABOR.test(a) ? "alp" : BTV_COAL.test(a) ? "lnp" : null;
      const pb = BTV_LABOR.test(b) ? "alp" : BTV_COAL.test(b) ? "lnp" : null;
      if (!pa || !pb || pa === pb) return null;
      pair = { a: [pa, a.replace(/^(?:Mr|Ms|Mrs)\s+/, "")], b: [pb, b.replace(/^(?:Mr|Ms|Mrs)\s+/, "")] };
      continue;
    }
    const x = btvYear(r.label, pts.length ? pts[pts.length - 1].x : null);
    if (x == null || !pair) return null;
    const c = r.waves[0].cells;
    pts.push({ x, when: r.label, vals: { [pair.a[0]]: [c[0], pair.a[1]], [pair.b[0]]: [c[1], pair.b[1]] } });
  }
  return pts.length ? pts : null;
}
function BtvTraitChart({ title, pts, x0, x1 }) {
  const W = 260, H = 120, L = 26, R = 30, T = 8, B = 18;
  const X = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - (v - 20) / 70) * (H - T - B);
  const line = (k) => {
    let d = "", pen = false;
    for (const p of pts) {
      const v = p.vals[k][0];
      if (v == null) { pen = false; continue; }
      d += (pen ? "L" : "M") + X(p.x).toFixed(1) + "," + Y(v).toFixed(1);
      pen = true;
    }
    return d;
  };
  const last = (k) => [...pts].reverse().find((p) => p.vals[k][0] != null);
  return (
    <figure className="btv-tr">
      <figcaption className="btv-trt">{title}</figcaption>
      <svg viewBox={"0 0 " + W + " " + H} role="img" aria-label={title + ": agreement with the trait, Labor and Coalition leaders, " + Math.floor(x0) + " to " + Math.floor(x1)}>
        {[30, 50, 70, 90].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="btv-trg" />
            <text x={L - 5} y={Y(v) + 3.5} className="btv-trax" textAnchor="end">{v}</text>
          </g>
        ))}
        {[2010, 2015, 2020, 2025].filter((y) => y >= x0 && y <= x1).map((y) => (
          <text key={y} x={X(y)} y={H - 4} className="btv-trax" textAnchor="middle">{y}</text>
        ))}
        {["lnp", "alp"].map((k) => <path key={k} d={line(k)} className={"btv-trl btv-trl-" + k} />)}
        {["lnp", "alp"].map((k) => pts.map((p, i) => (p.vals[k][0] == null ? null : (
          <circle key={k + i} cx={X(p.x)} cy={Y(p.vals[k][0])} r={2.2} className={"btv-trd btv-trl-" + k}>
            <title>{p.vals[k][1] + ", " + p.when + ": " + p.vals[k][0] + "%"}</title>
          </circle>
        ))))}
        {["alp", "lnp"].map((k) => { const p = last(k); return p ? (
          <text key={"e" + k} x={X(p.x) + 5} y={Y(p.vals[k][0]) + 3.5} className="btv-trv">{p.vals[k][0]}</text>) : null; })}
      </svg>
    </figure>
  );
}
function BtvTraits({ figs }) {
  const all = figs.map((f) => ({ f, pts: btvTraitSeries(f) }));
  const xs = all.flatMap((a) => a.pts.map((p) => p.x));
  const x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3;
  const measure = figs[0].measure;
  return (
    <div className="btv-fig">
      <div className="btv-gh">
        <p className="btv-ghb">{(measure ? btvCap(measure) + ", %, " : "") + "for each trait"}</p>
        <p className="btv-fams">
          <span><i className="btv-wsw btv-trs-alp" aria-hidden="true" />Labor leader (Rudd, Gillard, Shorten, Albanese)</span>
          <span><i className="btv-wsw btv-trs-lnp" aria-hidden="true" />Coalition leader (Turnbull, Abbott, Morrison, Dutton, Ley)</span>
        </p>
      </div>
      <div className="btv-trs">{all.map((a, i) => <BtvTraitChart key={i} title={a.f.title} pts={a.pts} x0={x0} x1={x1} />)}</div>
      <details className="btv-cuts">
        <summary>The figures, poll by poll</summary>
        {figs.map((f, i) => <div className="btv-cut" key={i}><p className="btv-cutt">{f.title}</p><BtvFigTable f={f} /></div>)}
      </details>
    </div>
  );
}

function BtvFig({ f, solo }) {
  const body = f.kind === "list" ? <BtvFigList f={f} />
    : f.kind === "nets" ? <BtvFigNets f={f} />
    : f.kind === "split" ? <BtvFigSplit f={f} />
    : <BtvFigTable f={f} />;
  return (
    <div className={"btv-fig btv-fig-" + f.kind}>
      <BtvFigHead f={f} solo={solo} />
      {body}
    </div>
  );
}

/* ---- the breakdowns by group, behind their own fold --------------------------
   One table a block: the groups across under a banner row (gender, age,
   vote), or, where a cut runs to many groups with short answers, the groups
   down the page under a heading a banner. A battery's cut names its measure
   in its caption. */
const btvCutsLabel = (cuts) => {
  const bs = [...new Set(cuts.flatMap((c) => (c.banners || []).filter(Boolean)))];
  if (!bs.length || bs.length > 4) return "By group";
  const w = bs.map(btvLow);
  return "By " + (w.length < 2 ? w[0] : w.slice(0, -1).join(", ") + " and " + w[w.length - 1]);
};
function BtvCut({ c }) {
  const v = (x) => (x == null ? "–" : btvN(x));
  if (c.down) {
    const span = c.heads.length + 1;
    return (
      <div className="btv-cut">
        {c.title ? <p className="btv-cutt">{c.title}</p> : null}
        <div className="btv-twrap">
          <table className="btv-table">
            <thead><tr><th className="btv-l" />{c.heads.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {c.rows.flatMap((r, i) => {
                const b = c.banners && c.banners[i];
                const head = b && (!i || c.banners[i - 1] !== b)
                  ? [<tr className="btv-tsec" key={"b" + i}><th colSpan={span} scope="colgroup" className="btv-l">{b}</th></tr>] : [];
                return head.concat(<tr key={i}><th scope="row" className="btv-l">{r[0]}</th>{r.slice(1).map((x, k) => <td key={k}>{v(x)}</td>)}</tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  /* the banner row: one cell a run of the same banner */
  const runs = [];
  (c.banners || c.heads.map(() => null)).forEach((b, k) => {
    const last = runs[runs.length - 1];
    if (last && last.b === b) last.n++;
    else runs.push({ b, n: 1, k });
  });
  const banner = runs.some((r) => r.b);
  return (
    <div className="btv-cut">
      {c.title ? <p className="btv-cutt">{c.title}</p> : null}
      <div className="btv-twrap">
        <table className="btv-table">
          <thead>
            {banner ? <tr className="btv-tban"><th className="btv-l" />{runs.map((r, i) => <th key={i} colSpan={r.n} scope="colgroup">{r.b || ""}</th>)}</tr> : null}
            <tr><th className="btv-l" />{c.heads.map((h, i) => <th key={i} scope="col" className={(runs.some((r) => r.k === i && i) ? "btv-tb0" : "") + (h.length <= 7 ? " btv-nw" : "")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => <tr key={i}><th scope="row" className="btv-l">{r[0]}</th>{r.slice(1).map((x, k) => <td key={k} className={runs.some((q) => q.k === k && k) ? "btv-tb0" : ""}>{v(x)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function BtvCuts({ cuts, when }) {
  if (!cuts || !cuts.length) return null;
  return (
    <details className="btv-cuts">
      <summary>{btvCutsLabel(cuts)}{when ? <span> · {when}</span> : null}</summary>
      {cuts.map((c, i) => <BtvCut key={i} c={c} />)}
    </details>
  );
}

/* who asked, when, how many, where it was published, and the exact wording
   a tap away */
function BtvSource({ src, houses, question }) {
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
/* a listed question's waves: the pollster once, then each wave's dates,
   sample and link, and every wording it was asked in */
function BtvWaves({ q, houses }) {
  const asked = [...new Set(q.srcs.map((s) => s.question).filter(Boolean))];
  return (
    <div className="btv-src">
      <b className="btv-srch">{btvHouse(q, houses, true)}</b>
      <ul className="btv-srcw">
        {q.srcs.map((s, i) => (
          <li key={i}>
            <span>{btvSpan(s.field)}</span>
            {s.n ? <span>{s.n.toLocaleString("en-AU")} people</span> : null}
            {s.url ? <a href={s.url} target="_blank" rel="noopener">Source ↗</a> : null}
          </li>
        ))}
      </ul>
      {asked.length ? (
        <details className="btv-wd">
          <summary>{asked.length > 1 ? "The questions as asked" : "The question as asked"}</summary>
          {asked.map((x, i) => <p key={i}>{x}</p>)}
        </details>
      ) : null}
    </div>
  );
}

/* ---- one question as a row: what was asked and by whom on the left, the
   answers on the right (stacked on a phone) ---------------------------------- */
function BtvItem({ c, houses }) {
  const body = c.kind === "split" ? <BtvSplit c={c} />
    : c.kind === "stack" ? <BtvStack c={c} houses={houses} />
    : c.kind === "rank" ? <BtvRank c={c} />
    : c.kind === "nets" ? <BtvNets c={c} /> : null;
  return (
    <article className={"btv-item btv-k-" + c.kind}>
      <div className="btv-il">
        <h4 className="btv-q">{c.title}</h4>
        {c.summary ? <p className="btv-sum">{c.summary}</p> : null}
        {c.note ? <p className="btv-note">{c.note}</p> : null}
        {c.src && c.src.field ? <BtvSource src={c.src} houses={houses} question={c.question} /> : <BtvSources c={c} houses={houses} />}
      </div>
      <div className="btv-ir">
        {body}
        <BtvCuts cuts={c.cuts} when={null} />
      </div>
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
            pollFacet={(m) => m.facet || null}
            scatter={pts.map((q) => ({ x: q.x, y: q.v, color: ink(q.fam), label: net ? "Net" : btvCap(c.names[0]),
              meta: q.rk ? { pollster: q.rk.split("|")[0], released: q.rk.split("|")[1], facet: q.fk, dateLabel: btvSpan(q.field), sample: q.n }
                : { pollster: btvHouse(q, houses, true), dateLabel: btvSpan(q.field), sample: q.n } }))}
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

/* ---- the topic's long tail --------------------------------------------------
   One line a question, the question on the left and whose and when on the
   right; a line opens across the full width to the same row as a featured
   question: the pollster's waves and wording on the left, the figures on
   the right, the breakdowns by group behind their own fold. */
function BtvMore({ t, houses }) {
  return (
    <details className="btv-more">
      <summary>More questions on {t.about || t.title}<span> · {t.more.length}</span></summary>
      <ul className="btv-ml">
        {t.more.map((q) => (
          <li key={q.id + q.house}>
            <details className="btv-mi">
              <summary>
                <span className="btv-mq">{q.title}</span>
                <span className="btv-mm">{btvHouse(q, houses)} · {btvMonth(q.last)}{q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : ""}</span>
              </summary>
              <div className="btv-mb">
                <div className="btv-il"><BtvWaves q={q} houses={houses} /></div>
                <div className="btv-ir">
                  {q.figs.length > 1 && q.figs.every((f) => btvTraitSeries(f)) ? <BtvTraits figs={q.figs} />
                    : q.figs.map((f, i) => <BtvFig key={i} f={f} solo={q.figs.length === 1} />)}
                  {q.prose.map((p, i) => (
                    <div className="btv-fig" key={"p" + i}>
                      {q.prose.length > 1 || q.figs.length ? <p className="btv-ght">{p.when}</p> : null}
                      <blockquote className="btv-prose">{btvText(p.text.join(" "))}</blockquote>
                    </div>
                  ))}
                  <BtvCuts cuts={q.cuts} when={q.srcs.length > 1 ? q.cutsWhen : null} />
                </div>
              </div>
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
        <h2 className="rd-title" id="rd-btv-t">Public opinion</h2>
        <span className="rd-meta">What else Australians tell the pollsters</span>
      </div>
      <RdHed head={window.AP.PAGE_HEAD["beyond-the-vote"]}
        dek={"Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, in " + rdNumWord(window.AUSPOL.beyondTopics) + " topics from Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each opens with what the polls found; where several pollsters asked the same thing, their answers sit side by side."} />
      <BtvBody />
    </section>
  );
}

const RdBeyondM = React.memo(RdBeyond);
const BtvBodyM = React.memo(BtvBody);

Object.assign(window, { RdBeyond: RdBeyondM, BtvBody: BtvBodyM });
