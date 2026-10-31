// ====================================================================
// BEYOND THE VOTE – the ☰ menu's issues page
// ====================================================================
/* What the pollsters ask beyond voting intention, by topic. The page opens
   on an index of the topics' findings, one sentence each; each topic then
   leads with its finding, charts its recurring question (one chart, a line
   per pollster, coloured by how the pollster asked), runs its questions as
   rows parted by hairlines (the question and its source on the left, the
   answers on the right). New questions join those rows automatically;
   only the older questions sit under "More questions". Recency shows all.
   No boxed cards and no chart per pollster: the 2026-10-18 redesign, the
   canvas's findings index and coloured lines (B) with its rows (A).
   The payload is the sidecar gen-data builds with public-opinion.mjs (the
   curation and every figure's rules live there: sides, printed totals, the
   95% margin behind each "level" and each finding); this file only draws
   it, fetched lazily like the cycle source since nothing else reads it.
   RdPublicOpinion is the redesign section (head + body); PublicOpinionBody is the body
   alone, which the archived classic design mounts without the rd chrome
   (the .pubop-* styles are page-level, not rd-gated). Replaced the /ad-hocs/
   catalogue 2026-10-18. */
const { useState: pubopUseState, useEffect: pubopUseEffect, useMemo: pubopUseMemo, useDeferredValue: pubopUseDeferred } = React;

const PUBOP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pubopDay = (iso) => Number(iso.slice(8, 10)) + " " + PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const pubopMonth = (iso) => PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
/* a month as the chart's axis writes it ("Dec 25") */
const pubopMonYY = (iso) => PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(2, 4);
/* a fieldwork span: one day, a range inside a month, or across months */
const pubopSpan = (f) => {
  if (!f || !f.end) return "";
  if (!f.start || f.start === f.end) return pubopDay(f.end);
  if (f.start.slice(0, 7) === f.end.slice(0, 7)) return Number(f.start.slice(8)) + "–" + pubopDay(f.end);
  if (f.start.slice(0, 4) === f.end.slice(0, 4)) return Number(f.start.slice(8)) + " " + PUBOP_MON[+f.start.slice(5, 7) - 1] + " – " + pubopDay(f.end);
  return pubopDay(f.start) + " – " + pubopDay(f.end);
};
/* shares print as the pollster printed them: whole numbers whole, Freshwater's
   tenths kept, nothing finer */
const pubopN = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1));
const pubopPct = (v) => pubopN(v) + "%";
const pubopSigned = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + pubopN(Math.abs(v));
const pubopHouse = (src, houses, full) => (houses[src.house] ? houses[src.house][full ? "full" : "short"] : src.house);
const pubopCap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pubopWord = (n) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
/* a topic's number, shared by the findings index and the topic's own head */
const pubopNo = (i) => String(i + 1).padStart(2, "0");
/* an answer set inside a sentence ("14% unsure"): lower-cased, unless it
   opens on a name */
const pubopLow = (s) => (!s || /^(?:Australia|Australian|Labor|Liberal|Coalition|One Nation|Greens|Trump|Albanese|Hanson|I\b)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/* ---- the bar: one question's answers on a 0–100 track ------------------- */
/* The agreeing side runs from the left, the disagreeing side ends at the
   right, whatever the pollster left unprinted (a "neither" it never
   published) sits as bare track between them */
function PubOpBar({ segs, tall }) {
  const shown = segs.filter((s) => s.v > 0);
  const rest = Math.max(0, 100 - shown.reduce((t, s) => t + s.v, 0));
  const firstB = shown.findIndex((s) => s.side === "b");
  const at = firstB < 0 ? shown.length : firstB;
  const seq = rest >= 0.5 ? [...shown.slice(0, at), { side: "gap", v: rest }, ...shown.slice(at)] : shown;
  return (
    <span className={"pubop-bar" + (tall ? " pubop-bar-t" : "")} role="img"
      aria-label={shown.map((s) => pubopPct(s.v) + " " + s.label).join(", ")}>
      {seq.map((s, i) => s.side === "gap"
        ? <i key={i} className="pubop-gap" style={{ width: s.v + "%" }} />
        : <i key={i} className={"pubop-seg pubop-" + s.side + s.tone} style={{ width: s.v + "%" }} title={pubopPct(s.v) + " " + s.label} />)}
    </span>
  );
}
function PubOpSwatch({ side, tone }) {
  return <i className={"pubop-sw pubop-" + side + tone} aria-hidden="true" />;
}

/* ---- a single question ---------------------------------------------------- */
function PubOpSplit({ c }) {
  const mids = c.segs.filter((s) => s.side === "m" && s.v > 0);
  const rest = Math.round(100 - c.a - c.b - c.m - (c.x || 0));
  return (
    <div className="pubop-split">
      <div className="pubop-ends">
        <span className="pubop-end"><PubOpSwatch side="a" tone={2} /><b>{pubopPct(c.a)}</b> <span className="pubop-endl">{c.names[0]}</span></span>
        <span className="pubop-end pubop-end-b"><b>{pubopPct(c.b)}</b> <span className="pubop-endl">{c.names[1]}</span><PubOpSwatch side="b" tone={2} /></span>
      </div>
      <PubOpBar segs={c.segs} tall />
      <p className="pubop-mids">
        {mids.map((s, i) => <span key={i}>{pubopPct(s.v)} {pubopLow(s.label)}</span>)}
        {c.x >= 1 ? <span>{pubopPct(c.x)} {pubopLow(c.xLabel || "")}</span> : null}
        {rest >= 3 ? <span>{rest}% not published</span> : null}
      </p>
      {c.sig === false ? <p className="pubop-level">Level: the gap is inside the margin of error.</p> : null}
    </div>
  );
}

/* ---- rows of one question each -------------------------------------------- */
function PubOpStack({ c, houses }) {
  const [all, setAll] = pubopUseState(false);
  const rows = c.show && !all ? c.rows.slice(0, c.show) : c.rows;
  return (
    <div className="pubop-stack">
      <div className="pubop-key">
        {c.legend.map((l, i) => <span key={i}><PubOpSwatch side={l.side} tone={l.tone} />{l.label}</span>)}
        {c.shades ? <span className="pubop-key-n">Stronger answers in full colour, milder ones faded</span> : null}
      </div>
      <div className="pubop-rows">
        {rows.map((r, i) => (
          <div className="pubop-row" key={i}>
            <div className="pubop-rl">
              {c.mode === "battery" ? <span>{r.label}</span> : (
                <>
                  <span className={c.mode === "waves" ? "" : "pubop-rh"}>{r.label || (c.mode === "waves" ? pubopMonth(r.when || r.src.field.end) : pubopHouse(r.src, houses))}
                    {c.mode === "compare" && !r.label ? <span className="pubop-rd"> · {pubopMonth(r.src.field.end)}</span> : null}</span>
                  {r.wording ? <span className="pubop-rw">{r.wording}</span> : null}
                </>
              )}
            </div>
            <span className="pubop-va">{pubopN(r.a)}</span>
            <PubOpBar segs={r.segs} />
            <span className="pubop-vb">{pubopN(r.b)}</span>
            <span className="pubop-net" title={r.sig === false ? "The gap is inside the margin of error" : ""}>{r.sig === false ? "level" : ""}</span>
          </div>
        ))}
      </div>
      {c.show && c.rows.length > c.show ? (
        <button type="button" className="pubop-all" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : "Show all " + c.rows.length}
        </button>
      ) : null}
    </div>
  );
}

/* ---- a ranked list -------------------------------------------------------- */
function PubOpRank({ c }) {
  const [all, setAll] = pubopUseState(false);
  const top = Math.max(...c.rows.map((r) => r.v), 1);
  const rows = !all ? c.rows.slice(0, c.show) : c.rows;
  const tenths = c.rows.some((r) => Math.abs(r.v - Math.round(r.v)) >= 0.05);
  return (
    <div className="pubop-rank">
      {rows.map((r, i) => (
        <div className="pubop-rk" key={i}>
          <span className="pubop-rkl">{r.label}</span>
          <span className="pubop-rkb"><i style={{ width: (r.v / Math.max(top, 50)) * 100 + "%" }} /></span>
          <span className="pubop-rkv">{tenths ? r.v.toFixed(1) + "%" : pubopPct(r.v)}</span>
        </div>
      ))}
      {c.rows.length > c.show ? (
        <button type="button" className="pubop-all" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all " + c.rows.length}</button>
      ) : null}
      {c.base ? <p className="pubop-base">{c.base}</p> : null}
    </div>
  );
}

/* ---- net scores either side of zero ----------------------------------------- */
function PubOpNets({ c }) {
  /* the longest bar stops short of its edge, leaving its figure room */
  const span = Math.max(...c.rows.map((r) => Math.abs(r.v)), 10) * 1.2;
  return (
    <div className="pubop-nets">
      {c.rows.map((r, i) => (
        <div className="pubop-nt" key={i}>
          <span className="pubop-ntl">{r.label}</span>
          <span className="pubop-ntb">
            <i className={r.v >= 0 ? "pubop-a2" : "pubop-b2"}
              style={r.v >= 0 ? { left: "50%", width: (r.v / span) * 50 + "%" } : { right: "50%", width: (-r.v / span) * 50 + "%" }} />
            <b style={r.v >= 0 ? { left: "calc(50% + " + (r.v / span) * 50 + "% + 6px)" } : { right: "calc(50% + " + (-r.v / span) * 50 + "% + 6px)" }}>{pubopSigned(r.v)}</b>
          </span>
        </div>
      ))}
      {c.unit ? <p className="pubop-base">{pubopCap(c.unit)}</p> : null}
    </div>
  );
}

/* ---- a question's figures, as public-opinion.mjs's figuresOf reads them ----
   A list of answers as bars, nets either side of zero, a battery as split
   bars (or, where its answers take no sides, as a table), the same figure's
   earlier waves beside it: a list's as columns to the right of the drawn
   one, a battery's as rows under each statement. A printed TOTAL or net
   sits under its answers in figures, never as a bar. */
const pubopVal = (v, unit) => (v == null ? "–" : unit === "net" ? pubopSigned(v) : unit === "score" ? pubopN(v) : pubopPct(v));
/* waves named to the day ("30 Jun 2026") drop the year they share */
const pubopCols = (cols) => (cols.length > 1 && cols.every((c) => /^\d/.test(c) && c.slice(-4) === cols[0].slice(-4)) ? cols.map((c) => c.slice(0, -5)) : cols);
/* a summary's unit by its name: a net or a change is signed, a TOTAL a share */
const pubopSumUnit = (label) => (/^net\b|\bnet\s|\bchange\b/i.test(label) ? "net" : "%");
const PUBOP_ENT = { rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", amp: "&", nbsp: " " };
const pubopText = (s) => String(s || "").replace(/&(\w+);/g, (m, k) => PUBOP_ENT[k] || m);

/* the figure's own name (only where its question has more than one), then
   what its numbers measure and whom they were asked of */
function PubOpFigHead({ f, solo }) {
  const t = solo ? null : f.title;
  const line = [f.measure ? pubopCap(f.measure) : null, f.base].filter(Boolean).join(" · ");
  if (!t && !line) return null;
  return (
    <div className="pubop-gh">
      {t ? <p className="pubop-ght">{t}</p> : null}
      {line ? <p className="pubop-ghb">{line}</p> : null}
    </div>
  );
}

/* answers as bars, in the order the pollster printed them; a second wave's
   (or an earlier reading's) figures as muted columns to the right */
function PubOpFigList({ f }) {
  const multi = f.cols.length > 1;
  const unit = f.unit === "score" ? "score" : "%";
  const scale = unit === "score" ? f.max : Math.max(50, ...f.rows.map((r) => r.v[0] || 0));
  const w = (v) => Math.max(0, Math.min(100, ((v || 0) / scale) * 100)) + "%";
  return (
    <div className={"pubop-gl" + (multi ? " pubop-gl-m" : "")} role="table" aria-label={f.title || "Answers"} style={{ "--pubop-n": f.cols.length }}>
      {multi ? (
        <div className="pubop-gr pubop-gr-h" role="row">
          <span role="columnheader" className="pubop-gk">Answer</span><span aria-hidden="true" />
          {pubopCols(f.cols).map((c, i) => <span key={i} role="columnheader" className="pubop-gv">{c}</span>)}
        </div>
      ) : null}
      {f.rows.map((r, i) => (
        <div className="pubop-gr" role="row" key={i}>
          <span role="rowheader" className="pubop-gk">{r.label}</span>
          <span className="pubop-gbar" aria-hidden="true"><i style={{ width: w(r.v[0]) }} /></span>
          {r.v.map((v, k) => <span key={k} role="cell" className={"pubop-gv" + (k ? " pubop-gv-o" : "")}>{pubopVal(v, unit)}</span>)}
        </div>
      ))}
      {f.sums.map((r, i) => (
        <div className={"pubop-gr pubop-gr-s" + (i ? "" : " pubop-gr-s1")} role="row" key={"s" + i}>
          <span role="rowheader" className="pubop-gk">{r.label}</span><span aria-hidden="true" />
          {r.v.map((v, k) => <span key={k} role="cell" className={"pubop-gv" + (k ? " pubop-gv-o" : "")}>{pubopVal(v, pubopSumUnit(r.label))}</span>)}
        </div>
      ))}
    </div>
  );
}

/* nets either side of zero, the long-tail kin of PubOpNets */
function PubOpFigNets({ f }) {
  return <PubOpNets c={{ rows: f.rows.map((r) => ({ label: r.label, v: r.v[0] })), unit: null }} />;
}

/* a battery's statements, each a split bar with its two sides' totals at
   its ends; waves of one statement as rows under it */
function PubOpFigSplit({ f }) {
  const multi = f.cols.length > 1;
  const ex = f.extraHeads;
  const row = (key, label, w) => (
    <div className={"pubop-row" + (label == null ? " pubop-row-1" : "")} key={key} style={{ "--pubop-x": ex.length }}>
      {label != null ? <div className="pubop-rl"><span>{label}</span></div> : null}
      <span className="pubop-va">{pubopN(w.a)}</span>
      <PubOpBar segs={w.segs} />
      <span className="pubop-vb">{pubopN(w.b)}</span>
      {w.extra.map((v, k) => <span className="pubop-vx" key={k}>{pubopVal(v, pubopSumUnit(ex[k]))}</span>)}
    </div>
  );
  return (
    <div className={"pubop-stack pubop-gs" + (ex.length ? " pubop-gs-x" : "")}>
      <div className="pubop-key">
        {f.legend.map((l, i) => <span key={i}><PubOpSwatch side={l.side} tone={l.tone} />{pubopCap(l.label)}</span>)}
      </div>
      {ex.length ? (
        <div className={"pubop-row pubop-row-h" + (f.one ? " pubop-row-1" : "")} style={{ "--pubop-x": ex.length }} aria-hidden="true">
          {f.one ? null : <span className="pubop-rlx" />}<span /><span /><span />
          {ex.map((h, k) => <span className="pubop-vx" key={k}>{h}</span>)}
        </div>
      ) : null}
      <div className="pubop-rows">
        {f.rows.map((r, i) => (multi && r.waves.length > 1 ? (
          <div className="pubop-sg" key={i}>
            <p className="pubop-sgl">{r.label}</p>
            {r.waves.map((w, k) => row(k, w.when, w))}
          </div>
        ) : row(i, f.one ? null : r.label + (multi ? " · " + r.waves[0].when : ""), r.waves[0])))}
      </div>
    </div>
  );
}

/* a battery whose answers take no sides, as the pollster tabled it */
function PubOpFigTable({ f }) {
  const multi = f.cols.length > 1;
  const heads = f.heads.concat(f.extraHeads);
  const n = f.heads.length;
  const cells = (w) => w.cells.concat(w.extra).map((v, k) => (
    <td key={k} className={k < n ? "" : "pubop-tc-x"}>{v == null ? "–" : k >= n && pubopSumUnit(heads[k]) === "net" ? pubopSigned(v) : pubopN(v)}</td>
  ));
  return (
    <div className="pubop-twrap">
      <table className="pubop-table pubop-gt">
        <thead><tr><th className="pubop-l" />{heads.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {f.rows.flatMap((r, i) => (r.sect ? [<tr className="pubop-tsec" key={i}><th colSpan={heads.length + 1} scope="colgroup" className="pubop-l">{r.label}</th></tr>]
            : multi && r.waves.length > 1 ? [
              <tr className="pubop-tgrp" key={i + "g"}><th colSpan={heads.length + 1} scope="colgroup" className="pubop-l">{r.label}</th></tr>,
              ...r.waves.map((w, k) => <tr key={i + "-" + k}><th scope="row" className="pubop-l pubop-twv">{w.when}</th>{cells(w)}</tr>)]
            : [<tr key={i}><th scope="row" className="pubop-l">{r.label}{multi ? <span className="pubop-twd"> · {r.waves[0].when}</span> : null}</th>{cells(r.waves[0])}</tr>]))}
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
const PUBOP_LABOR = /\b(?:Rudd|Gillard|Shorten|Albanese)\b/, PUBOP_COAL = /\b(?:Turnbull|Abbott|Morrison|Dutton|Ley|Nelson|Taylor)\b/;
/* a fieldwork label's end, as a decimal year; one printed without its year
   ("12-15 January") follows the row before it */
const pubopYear = (label, prev) => {
  const m = String(label).match(/(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s*$/);
  if (!m) return null;
  const mo = (PUBOP_MONF.indexOf(m[1]) + 0.5) / 12;
  if (m[2]) return +m[2] + mo;
  if (prev == null) return null;
  const y = Math.floor(prev);
  return y + mo > prev ? y + mo : y + 1 + mo;
};
const PUBOP_MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function pubopTraitSeries(f) {
  if (f.kind !== "table" || f.heads.length !== 2 || !f.rows.some((r) => r.sect)) return null;
  let pair = null;
  const pts = [];
  for (const r of f.rows) {
    if (r.sect) {
      const [a, b] = r.label.split(" v ");
      const pa = PUBOP_LABOR.test(a) ? "alp" : PUBOP_COAL.test(a) ? "lnp" : null;
      const pb = PUBOP_LABOR.test(b) ? "alp" : PUBOP_COAL.test(b) ? "lnp" : null;
      if (!pa || !pb || pa === pb) return null;
      pair = { a: [pa, a.replace(/^(?:Mr|Ms|Mrs)\s+/, "")], b: [pb, b.replace(/^(?:Mr|Ms|Mrs)\s+/, "")] };
      continue;
    }
    const x = pubopYear(r.label, pts.length ? pts[pts.length - 1].x : null);
    if (x == null || !pair) return null;
    const c = r.waves[0].cells;
    pts.push({ x, when: r.label, vals: { [pair.a[0]]: [c[0], pair.a[1]], [pair.b[0]]: [c[1], pair.b[1]] } });
  }
  return pts.length ? pts : null;
}
function PubOpTraitChart({ title, pts, x0, x1 }) {
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
    <figure className="pubop-tr">
      <figcaption className="pubop-trt">{title}</figcaption>
      <svg viewBox={"0 0 " + W + " " + H} role="img" aria-label={title + ": agreement with the trait, Labor and Coalition leaders, " + Math.floor(x0) + " to " + Math.floor(x1)}>
        {[30, 50, 70, 90].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="pubop-trg" />
            <text x={L - 5} y={Y(v) + 3.5} className="pubop-trax" textAnchor="end">{v}</text>
          </g>
        ))}
        {[2010, 2015, 2020, 2025].filter((y) => y >= x0 && y <= x1).map((y) => (
          <text key={y} x={X(y)} y={H - 4} className="pubop-trax" textAnchor="middle">{y}</text>
        ))}
        {["lnp", "alp"].map((k) => <path key={k} d={line(k)} className={"pubop-trl pubop-trl-" + k} />)}
        {["lnp", "alp"].map((k) => pts.map((p, i) => (p.vals[k][0] == null ? null : (
          <circle key={k + i} cx={X(p.x)} cy={Y(p.vals[k][0])} r={2.2} className={"pubop-trd pubop-trl-" + k}>
            <title>{p.vals[k][1] + ", " + p.when + ": " + p.vals[k][0] + "%"}</title>
          </circle>
        ))))}
        {["alp", "lnp"].map((k) => { const p = last(k); return p ? (
          <text key={"e" + k} x={X(p.x) + 5} y={Y(p.vals[k][0]) + 3.5} className="pubop-trv">{p.vals[k][0]}</text>) : null; })}
      </svg>
    </figure>
  );
}
function PubOpTraits({ figs }) {
  const all = figs.map((f) => ({ f, pts: pubopTraitSeries(f) }));
  const xs = all.flatMap((a) => a.pts.map((p) => p.x));
  const x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3;
  const measure = figs[0].measure;
  return (
    <div className="pubop-fig">
      <div className="pubop-gh">
        <p className="pubop-ghb">{(measure ? pubopCap(measure) + ", %, " : "") + "for each trait"}</p>
        <p className="pubop-fams">
          <span><i className="pubop-wsw pubop-trs-alp" aria-hidden="true" />Labor leader (Rudd, Gillard, Shorten, Albanese)</span>
          <span><i className="pubop-wsw pubop-trs-lnp" aria-hidden="true" />Coalition leader (Turnbull, Abbott, Morrison, Dutton, Ley)</span>
        </p>
      </div>
      <div className="pubop-trs">{all.map((a, i) => <PubOpTraitChart key={i} title={a.f.title} pts={a.pts} x0={x0} x1={x1} />)}</div>
      <details className="pubop-cuts">
        <summary>The figures, poll by poll</summary>
        {figs.map((f, i) => <div className="pubop-cut" key={i}><p className="pubop-cutt">{f.title}</p><PubOpFigTable f={f} /></div>)}
      </details>
    </div>
  );
}

function PubOpFig({ f, solo }) {
  const body = f.kind === "list" ? <PubOpFigList f={f} />
    : f.kind === "nets" ? <PubOpFigNets f={f} />
    : f.kind === "split" ? <PubOpFigSplit f={f} />
    : <PubOpFigTable f={f} />;
  return (
    <div className={"pubop-fig pubop-fig-" + f.kind}>
      <PubOpFigHead f={f} solo={solo} />
      {body}
    </div>
  );
}

/* ---- the breakdowns by group, behind their own fold --------------------------
   One table a block: the groups across under a banner row (gender, age,
   vote), or, where a cut runs to many groups with short answers, the groups
   down the page under a heading a banner. A battery's cut names its measure
   in its caption. */
const pubopCutsLabel = (cuts) => {
  const bs = [...new Set(cuts.flatMap((c) => (c.banners || []).filter(Boolean)))];
  if (!bs.length || bs.length > 4) return "By group";
  const w = bs.map(pubopLow);
  return "By " + (w.length < 2 ? w[0] : w.slice(0, -1).join(", ") + " and " + w[w.length - 1]);
};
function PubOpCut({ c }) {
  const v = (x) => (x == null ? "–" : pubopN(x));
  if (c.down) {
    const span = c.heads.length + 1;
    return (
      <div className="pubop-cut">
        {c.title ? <p className="pubop-cutt">{c.title}</p> : null}
        <div className="pubop-twrap">
          <table className="pubop-table">
            <thead><tr><th className="pubop-l" />{c.heads.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {c.rows.flatMap((r, i) => {
                const b = c.banners && c.banners[i];
                const head = b && (!i || c.banners[i - 1] !== b)
                  ? [<tr className="pubop-tsec" key={"b" + i}><th colSpan={span} scope="colgroup" className="pubop-l">{b}</th></tr>] : [];
                return head.concat(<tr key={i}><th scope="row" className="pubop-l">{r[0]}</th>{r.slice(1).map((x, k) => <td key={k}>{v(x)}</td>)}</tr>);
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
    <div className="pubop-cut">
      {c.title ? <p className="pubop-cutt">{c.title}</p> : null}
      <div className="pubop-twrap">
        <table className="pubop-table">
          <thead>
            {banner ? <tr className="pubop-tban"><th className="pubop-l" />{runs.map((r, i) => <th key={i} colSpan={r.n} scope="colgroup">{r.b || ""}</th>)}</tr> : null}
            <tr><th className="pubop-l" />{c.heads.map((h, i) => <th key={i} scope="col" className={(runs.some((r) => r.k === i && i) ? "pubop-tb0" : "") + (h.length <= 7 ? " pubop-nw" : "")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => <tr key={i}><th scope="row" className="pubop-l">{r[0]}</th>{r.slice(1).map((x, k) => <td key={k} className={runs.some((q) => q.k === k && k) ? "pubop-tb0" : ""}>{v(x)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function PubOpCuts({ cuts, when }) {
  if (!cuts || !cuts.length) return null;
  return (
    <details className="pubop-cuts">
      <summary>{pubopCutsLabel(cuts)}{when ? <span> · {when}</span> : null}</summary>
      {cuts.map((c, i) => <PubOpCut key={i} c={c} />)}
    </details>
  );
}

/* who asked, when, how many, where it was published, and the exact wording
   a tap away */
function PubOpSource({ src, houses, question }) {
  return (
    <div className="pubop-src">
      <span className="pubop-src-l">
        <b>{pubopHouse(src, houses, true)}</b>
        <span>{pubopSpan(src.field)}</span>
        {src.n ? <span>{src.n.toLocaleString("en-AU")} people</span> : null}
        {src.url ? <a href={src.url} target="_blank" rel="noopener">Source ↗</a> : null}
      </span>
      {question ? (
        <details className="pubop-wd">
          <summary>The question as asked</summary>
          <p>{question}</p>
        </details>
      ) : null}
    </div>
  );
}
/* several polls' sources: one link a poll (or a wave) */
function PubOpSources({ c, houses }) {
  const seen = new Set();
  const links = (c.rows || []).filter((r) => r.src && r.src.url && !seen.has(r.src.url) && seen.add(r.src.url));
  return (
    <div className="pubop-src"><span className="pubop-src-l">
      {c.mode === "waves" ? <b>{pubopHouse(c.src || c.rows[0].src, houses, true)}</b> : null}
      {links.length ? (
        <span className="pubop-srcs">Sources: {links.map((r, i) => (
          <a key={i} href={r.src.url} target="_blank" rel="noopener">{c.mode === "waves" ? pubopMonth(r.src.field.end) : pubopHouse(r.src, houses) + " " + pubopMonth(r.src.field.end)} ↗</a>
        ))}</span>
      ) : null}
    </span></div>
  );
}
/* a listed question's waves: the pollster once, then each wave's dates,
   sample and link, and every wording it was asked in */
function PubOpWaves({ q, houses }) {
  const asked = [...new Set(q.srcs.map((s) => s.question).filter(Boolean))];
  return (
    <div className="pubop-src">
      <b className="pubop-srch">{pubopHouse(q, houses, true)}</b>
      <ul className="pubop-srcw">
        {q.srcs.map((s, i) => (
          <li key={i}>
            <span>{pubopSpan(s.field)}</span>
            {s.n ? <span>{s.n.toLocaleString("en-AU")} people</span> : null}
            {s.url ? <a href={s.url} target="_blank" rel="noopener">Source ↗</a> : null}
          </li>
        ))}
      </ul>
      {asked.length ? (
        <details className="pubop-wd">
          <summary>{asked.length > 1 ? "The questions as asked" : "The question as asked"}</summary>
          {asked.map((x, i) => <p key={i}>{x}</p>)}
        </details>
      ) : null}
    </div>
  );
}

/* ---- one question as a row: what was asked and by whom on the left, the
   answers on the right (stacked on a phone) ---------------------------------- */
function PubOpItem({ c, houses, topic }) {
  const body = c.kind === "split" ? <PubOpSplit c={c} />
    : c.kind === "stack" ? <PubOpStack c={c} houses={houses} />
    : c.kind === "rank" ? <PubOpRank c={c} />
    : c.kind === "nets" ? <PubOpNets c={c} /> : null;
  return (
    <article className={"pubop-item pubop-k-" + c.kind}>
      <div className="pubop-il">
        {topic ? <p className="pubop-qt">{topic}</p> : null}
        <h4 className="pubop-q">{c.title}</h4>
        {c.summary ? <p className="pubop-sum">{c.summary}</p> : null}
        {c.note ? <p className="pubop-note">{c.note}</p> : null}
        {c.src && c.src.field ? <PubOpSource src={c.src} houses={houses} question={c.question} /> : <PubOpSources c={c} houses={houses} />}
      </div>
      <div className="pubop-ir">
        {body}
        <PubOpCuts cuts={c.cuts} when={null} />
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
function PubOpTracker({ c, houses, topic }) {
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
      if (x >= x0 && x <= x1) ticks.push({ x, label: PUBOP_MON[m] + " " + String(y).slice(2) });
    }
  }
  const fmt = (v) => (net ? pubopSigned(v) : pubopPct(v));
  const yt = [];
  for (let v = lo + step; v <= hi + 1e-9; v += step) yt.push(v);
  const ink = (f) => "var(--pubop-w" + f + ")";
  const fams = c.families.map((label, i) => ({ label, i })).filter((f) => c.panels.some((p) => p.fam === f.i));
  /* the readout's spine: each date a poll ended, once */
  const spine = [...new Set(pts.map((q) => q.x))].sort((p, q) => p - q).map((x) => ({ x, y: pts.find((q) => q.x === x).v }));
  const at = (i) => (spine[i] ? pts.filter((q) => q.x === spine[i].x) : []);
  const latest = c.panels.map((p) => ({ p, q: p.points[p.points.length - 1] })).sort((a, b) => b.q.x - a.q.x);
  const rows = pts.slice().sort((p, q) => q.x - p.x);
  return (
    <div className="pubop-tracker">
      {topic ? <p className="pubop-qt">{topic}</p> : null}
      <p className="pubop-tlab">{c.title}</p>
      <p className="pubop-tdek">{c.dek}</p>
      <p className="pubop-fams">
        {fams.map((f) => <span key={f.i}><i className={"pubop-wsw pubop-w" + f.i} aria-hidden="true" />{f.label}</span>)}
      </p>
      <div className="pubop-tbody">
        <div className="pubop-tchart">
          {/* the .card class is the copy-as-image composer's cue to build the
              image from the chart's own copy (title, sub, legend), not to
              photograph the topic around it; .pubop-chart takes off a card's
              chrome in both designs */}
          <div className="card rd-card pubop-chart">
          <TrendChart key={"pubop-" + c.id} heightPx={narrow ? 250 : 320} padPx={{ l: 34, r: 8, t: 20, b: 22 }}
            xDomain={[x0, x1]} yDomain={[lo, hi]} yTicks={yt} yTickFmt={() => ""} xTicks={ticks} baseline
            notes={yt.map((v) => ({ x: "left", y: v, dy: -3, text: net ? (v === 0 ? "Even" : pubopSigned(v)) : v + (v === hi ? "%" : ""), size: 10.5, cls: "pubop-ylab" }))}
            refLines={c.ref != null ? [{ y: c.ref, label: "", color: "var(--ink-faint)" }] : []}
            series={c.panels.map((p) => ({ id: p.house, label: pubopHouse(p, houses), color: ink(p.fam), rdWidth: 2, smooth: false,
              endLabel: pubopHouse(p, houses), points: p.points.map((q) => ({ x: q.x, y: q.v })) }))}
            spine={spine}
            pollFacet={(m) => m.facet || null}
            scatter={pts.map((q) => ({ x: q.x, y: q.v, color: ink(q.fam), label: net ? "Net" : pubopCap(c.names[0]),
              meta: q.rk ? { pollster: q.rk.split("|")[0], released: q.rk.split("|")[1], facet: q.fk, dateLabel: pubopSpan(q.field), sample: q.n }
                : { pollster: pubopHouse(q, houses, true), dateLabel: pubopSpan(q.field), sample: q.n } }))}
            tooltipTitle={(i) => { const qs = at(i); return qs.length === 1 ? pubopSpan(qs[0].field) : qs.length ? pubopDay(qs[0].field.end) : ""; }}
            extraRows={(i) => {
              const qs = at(i);
              return qs.flatMap((q) => {
                const pre = qs.length > 1 ? pubopHouse(q, houses) + ": " : "";
                return net ? [{ label: pre + pubopCap(c.names[0]), value: pubopPct(q.a) }, { label: pre + pubopCap(c.names[1]), value: pubopPct(q.b) }]
                  : [{ label: pre + pubopCap(c.names[1]), value: pubopPct(q.b) }];
              });
            }}
            fmt={fmt}
            copy={{ title: c.title, sub: c.head + "." + (c.note ? " " + c.note : ""),
              span: pubopMonYY(c.first) + " – " + pubopMonYY(c.last),
              caption: "Each dot is one poll; a line joins one pollster’s own readings, coloured by how it asked.",
              legend: fams.map((f) => ({ label: f.label, color: ink(f.i), kind: "line" }))
                .concat(c.ref != null ? [{ label: c.refLabel, color: "var(--ink-faint)", kind: "dashed" }] : []) }}
          />
          <p className="rd-ckey pubop-tkey">
            <span><i className="pubop-dot" aria-hidden="true" />One poll</span>
            <span><i className="pubop-ln" aria-hidden="true" />One pollster’s readings, joined</span>
            {c.ref != null ? <span><i className="pubop-rl0" aria-hidden="true" />{c.refLabel}</span> : null}
          </p>
          </div>
          {c.note ? <p className="pubop-note">{c.note}</p> : null}
        </div>
        <aside className="pubop-latest" aria-label="Latest from each pollster">
          <p className="pubop-lh">Latest from each pollster</p>
          <ul className="pubop-ll">
            {latest.map(({ p, q }) => (
              <li key={p.house}>
                <span className="pubop-lp">
                  <span className="pubop-lnm"><i className={"pubop-ldot pubop-w" + p.fam} aria-hidden="true" />{pubopHouse(p, houses)}
                    <span className="pubop-ld">{pubopDay(q.field.end)}</span></span>
                  <span className="pubop-lq">{p.label}</span>
                </span>
                <b className="pubop-lv">{fmt(q.v)}</b>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <details className="pubop-ledger">
        <summary>All {rows.length} readings</summary>
        <div className="pubop-twrap">
          <table className="pubop-table">
            <thead><tr>
              <th className="pubop-l">Pollster</th><th className="pubop-l">Fieldwork</th><th>Sample</th>
              <th>{c.cols[0]}</th><th>{c.cols[1]}</th><th>{c.cols[2]}</th>{net ? <th>Net</th> : null}<th />
            </tr></thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={i}>
                  <td className="pubop-l">{pubopHouse(q, houses)}</td><td className="pubop-l">{pubopSpan(q.field)}</td>
                  <td>{q.n ? q.n.toLocaleString("en-AU") : "–"}</td>
                  <td>{pubopN(q.a)}</td><td>{pubopN(q.m)}</td><td>{pubopN(q.b)}</td>
                  {net ? <td><b>{pubopSigned(q.v)}</b></td> : null}
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
   the right, the breakdowns by group behind their own fold. A month or a
   pollster lists its long tail the same way, each line naming its topic
   and its day. */
/* a wave's mark (AP.pubopGo's second arg): a trip from a poll's "Public
   opinion" line lands on the pollster's group with exactly THAT wave's
   questions flagged and the folds asked open, so the per-poll claim shows
   the questions it means rather than the pollster's whole catalogue. The
   sources a line carries know their wave (sourceOf's wave field). */
const pubopHasWave = (q, wv) => !!wv && (q.srcs || []).some((s) => s && s.wave === wv);
/* opens a closed <details> once, on mount, and then leaves it to the reader */
const pubopOpenOnce = (el) => { if (el && !el.open) el.open = true; };
function PubOpMore({ label, qs, houses, meta, wv }) {
  const hit = !!wv && qs.some((q) => pubopHasWave(q, wv));
  return (
    <details className="pubop-more" ref={hit ? pubopOpenOnce : null}>
      <summary>{label}<span> · {qs.length}</span></summary>
      <ul className="pubop-ml">
        {qs.map((q) => {
          const wh = pubopHasWave(q, wv);
          return (
          <li key={q.id + q.house} className={wh ? "pubop-wvh" : null}>
            <details className="pubop-mi" ref={wh ? pubopOpenOnce : null}>
              <summary>
                <span className="pubop-mq">{q.title}</span>
                <span className="pubop-mm">{wh ? <em className="pubop-wvh-t">this poll</em> : null}{meta(q)}</span>
              </summary>
              <div className="pubop-mb">
                <div className="pubop-il"><PubOpWaves q={q} houses={houses} /></div>
                <div className="pubop-ir">
                  {q.figs.length > 1 && q.figs.every((f) => pubopTraitSeries(f)) ? <PubOpTraits figs={q.figs} />
                    : q.figs.map((f, i) => <PubOpFig key={i} f={f} solo={q.figs.length === 1} />)}
                  {q.prose.map((p, i) => (
                    <div className="pubop-fig" key={"p" + i}>
                      {q.prose.length > 1 || q.figs.length ? <p className="pubop-ght">{p.when}</p> : null}
                      <blockquote className="pubop-prose">{pubopText(p.text.join(" "))}</blockquote>
                    </div>
                  ))}
                  <PubOpCuts cuts={q.cuts} when={q.srcs.length > 1 ? q.cutsWhen : null} />
                </div>
              </div>
            </details>
          </li>
          );
        })}
      </ul>
    </details>
  );
}
/* a section's count line: "One chart · 6 questions · 9 more" */
const pubopCount = (trackers, items, more) => [
  trackers ? (trackers === 1 ? "One chart" : pubopCap(pubopWord(trackers)) + " charts") : null,
  items ? items + (items === 1 ? " question" : " questions") : null,
  more ? more + " more" : null,
].filter(Boolean).join(" · ");
/* ---- a topic: its number and name, its finding, then the evidence ---------- */
function PubOpTopic({ t, n, houses }) {
  const g = pubopSplitKinds(pubopDated([t]));
  const count = pubopCount(g.trackers.length, g.items.length, g.more.length);
  return (
    <section className="pubop-topic" id={"pubop-" + t.id} aria-labelledby={"pubop-h-" + t.id}>
      <div className="pubop-tk">
        <h3 className="pubop-tt" id={"pubop-h-" + t.id}><span className="pubop-tn">{n}</span>{t.title}</h3>
        <span className="pubop-tc">{count}</span>
      </div>
      {t.finding ? <p className="pubop-hl">{t.finding.text}</p> : null}
      <p className="pubop-tdk">{t.dek}</p>
      {g.trackers.map((e) => <PubOpTracker key={e.b.id} c={e.b} houses={houses} />)}
      <PubOpEntries entries={g.items} houses={houses} />
      {g.more.length ? <PubOpMore label={"More questions on " + (t.about || t.title)} qs={g.more.map((e) => e.q)} houses={houses}
        meta={(q) => pubopHouse(q, houses) + " · " + pubopMonth(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")} /> : null}
    </section>
  );
}
/* ---- the other two orders: newest first and by pollster ------------------
   A tracker dates by its latest reading, a question by its poll's fieldwork
   end (the latest wave's, where it has several), a listed question by its
   latest reading. Every piece of the page goes into one group, newest first
   within it, a tie keeping the topics' own order. */
const pubopLast = (b) => (b.kind === "tracker" ? b.last : b.src && b.src.field ? b.src.field.end
  : (b.rows || []).reduce((d, r) => (r.src && r.src.field && r.src.field.end > d ? r.src.field.end : d), ""));
/* the pollsters behind a piece: a tracker's lines, a question's poll, a
   comparison's rows */
const pubopHousesOf = (b) => (b.kind === "tracker" ? [...new Set(b.panels.map((p) => p.house))]
  : b.src && b.src.house ? [b.src.house] : [...new Set((b.rows || []).map((r) => r.src && r.src.house).filter(Boolean))]);
function pubopDated(topics) {
  const all = [];
  topics.forEach((t) => {
    t.blocks.forEach((b) => all.push({ t, b, date: pubopLast(b) }));
    t.more.forEach((q) => all.push({ t, q, date: q.last }));
  });
  /* Array.prototype.sort is stable, so equal dates keep the topics' order */
  return all.sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : 0));
}
/* At least the six newest questions lead each issue/pollster, alongside
   the curated pieces. Keep every question on the boundary date visible:
   an incoming report must never be split arbitrarily at question six.
   No wall clock or hand-picked ids: the next import takes its own place.
   Recency is a complete chronology, with no editorial visibility gate. */
const PUBOP_LATEST = 6;
function pubopSplitKinds(all, chronological = false) {
  const questions = all.filter((e) => e.q || e.b.kind !== "tracker");
  const cutoff = questions[Math.min(PUBOP_LATEST, questions.length) - 1]?.date || "";
  const entries = all.filter((e) => e.b || chronological || e.date >= cutoff);
  return {
    entries,
    trackers: entries.filter((e) => e.b && e.b.kind === "tracker"),
    items: entries.filter((e) => e.q || e.b.kind !== "tracker"),
    more: all.filter((e) => e.q && !chronological && e.date < cutoff),
  };
}
function PubOpEntries({ entries, houses, topics, wv }) {
  if (!entries.length) return null;
  return <div className="pubop-items">{entries.map((e, i) => {
    const topic = topics ? e.t.short : null;
    return e.q ? <PubOpQuestion key={e.q.id + "|" + e.q.house} m={e.q} houses={houses} topic={topic} wv={wv} />
      : e.b.kind === "tracker" ? <PubOpTracker key={e.b.id} c={e.b} houses={houses} topic={topic} />
      : <PubOpItem key={(e.b.id || "") + i} c={e.b} houses={houses} topic={topic} />;
  })}</div>;
}
/* newest first: one group a month the pieces were last asked in */
function pubopByMonth(topics) {
  const months = [];
  for (const e of pubopDated(topics)) {
    const ym = e.date.slice(0, 7);
    if (!months.length || months[months.length - 1].ym !== ym) months.push({ ym, all: [] });
    months[months.length - 1].all.push(e);
  }
  return months.map((m) => {
    const title = PUBOP_MONF[+m.ym.slice(5, 7) - 1] + " " + m.ym.slice(0, 4);
    return { id: "m-" + m.ym, title, ...pubopSplitKinds(m.all, true) };
  });
}
/* by pollster: one group a pollster, the one with the most questions first,
   holding what it asked alone; a chart or question that sets several
   pollsters side by side goes once, into a last group of its own, and each
   pollster it holds links there */
function pubopByPollster(topics, houses) {
  const own = new Map(), also = new Map(), several = [];
  for (const e of pubopDated(topics)) {
    const hs = e.q ? [e.q.house] : pubopHousesOf(e.b);
    if (hs.length === 1) {
      if (!own.has(hs[0])) own.set(hs[0], []);
      own.get(hs[0]).push(e);
    } else {
      several.push(e);
      hs.forEach((h) => also.set(h, (also.get(h) || 0) + 1));
    }
  }
  const name = (h) => pubopHouse({ house: h }, houses);
  const ids = [...new Set([...own.keys(), ...also.keys()])]
    .sort((p, q) => ((own.get(q) || []).length - (own.get(p) || []).length) || ((also.get(q) || 0) - (also.get(p) || 0)) || name(p).localeCompare(name(q)));
  const groups = ids.map((h) => {
    const n = also.get(h) || 0, mine = own.get(h) || [];
    const cmp = pubopWord(n) + (n === 1 ? " comparison" : " comparisons") + " with other pollsters";
    return {
      id: "p-" + h, title: pubopHouse({ house: h }, houses, true), moreLabel: "More questions from " + name(h),
      lead: n ? <p className="pubop-tdk">{mine.length ? "Also in " : "Only in "}<a href="#pubop-p-several">{cmp}</a>.</p> : null,
      ...pubopSplitKinds(mine),
    };
  });
  if (several.length) groups.push({ id: "p-several", title: "Several pollsters", moreLabel: "",
    lead: <p className="pubop-tdk">Charts and questions that set two or more pollsters side by side.</p>, ...pubopSplitKinds(several) });
  return groups;
}
/* A month or pollster runs in date order across charts and questions,
   every piece naming its topic; an older-question
   line names its pollster too, where the group is not already one */
function PubOpGroup({ g, houses, byHouse, wv }) {
  const topicOf = new Map(g.more.map((e) => [e.q, e.t]));
  const count = pubopCount(g.trackers.length, g.items.length, g.more.length);
  return (
    <section className="pubop-topic pubop-mon" id={"pubop-" + g.id} aria-labelledby={"pubop-h-" + g.id}>
      <div className="pubop-tk">
        <h3 className="pubop-tt" id={"pubop-h-" + g.id}>{g.title}</h3>
        {count ? <span className="pubop-tc">{count}</span> : null}
      </div>
      {g.lead || null}
      <PubOpEntries entries={g.entries} houses={houses} topics wv={byHouse ? wv : null} />
      {g.more.length ? <PubOpMore label={g.moreLabel} qs={g.more.map((e) => e.q)} houses={houses} wv={wv}
        meta={(q) => topicOf.get(q).short + (byHouse ? "" : " · " + pubopHouse(q, houses)) + " · " + pubopDay(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")} /> : null}
    </section>
  );
}
/* ---- the order the questions run in: by issue (the page's own), by
   pollster or newest first. A finding still links to its topic: picked
   while the page runs another way, it turns the page back to the issues
   and lands there. */
const PUBOP_SORTS = [{ id: "issue", label: "By issue" }, { id: "pollster", label: "By pollster" }, { id: "recent", label: "By recency" }];
function PubOpSort({ sort, onSort }) {
  /* the order choice is a view of its own, so it takes the phone swipe
     hand-rolled the way RdTabs' `swipe` prop does it (data-rd-swipe +
     __rdSwipe on the row; the app's touch effect finds and steps it,
     wrapping as the arrow-key walk does) */
  const sortSwipeLive = React.useRef(null);
  sortSwipeLive.current = (dir) => {
    const i = PUBOP_SORTS.findIndex((o) => o.id === sort);
    if (i < 0) return false;
    onSort(PUBOP_SORTS[(i + dir + PUBOP_SORTS.length) % PUBOP_SORTS.length].id);
    return true;
  };
  const sortSwipe = React.useCallback((el) => { if (el) el.__rdSwipe = (dir) => sortSwipeLive.current(dir); }, []);
  /* the hover-claim contract every walking row honours: a pointer anywhere
     over the row's reach arms <-/-> for it without moving DOM focus, and
     real keyboard focus wins. Reach = the whole owner section, matching
     the row's phone swipe (Compare-with's #cyc-summary claim did the same
     for its section) - so pointing at the catalogue steps the order, it
     never turns the page */
  const sortHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("public-opinion");
    if (!sec) return undefined;
    const enter = () => { sortHover.current = true; };
    const leave = () => { sortHover.current = false; };
    sortHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!sortHover.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!sortSwipeLive.current(e.key === "ArrowRight" ? 1 : -1)) return;
      e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  return (
    <div className="pubop-sort">
      <span className="pubop-sort-l" id="pubop-sort-l">Sort</span>
      <div className="pubop-sort-g" role="group" aria-labelledby="pubop-sort-l" ref={sortSwipe} data-rd-swipe=""
           onKeyDown={rdTabsKey(PUBOP_SORTS, onSort)} onClick={rdTabFocus}>
        {PUBOP_SORTS.map((o) => (
          <button key={o.id} type="button" className="pubop-sort-b" aria-pressed={sort === o.id} onClick={() => onSort(o.id)}>
            <span className="pubop-sort-w" data-t={o.label}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- the search box ------------------------------------------------------------
   The All-polls box's idiom over this page's own inventory (its TESTS['q']
   lives in the d1a1d215 asset): query and haystacks lower-cased, every
   white-space token of the query must appear in a piece's haystack, and a
   typed hyphen matches an en dash. A piece's haystack is its own words -
   its question as asked, its answers' labels, its tables' headings - plus
   the name of the topic it belongs to; never pollsters, dates, samples or
   figures. A non-empty query swaps the findings, the order row and the
   topics for the pieces that match; empty is the page as it was. */
const pubopPushW = (parts, s) => { if (s) parts.push(String(s)); };
const pubopSegsW = (segs, parts) => (segs || []).forEach((s) => pubopPushW(parts, s.label));
const pubopRowsW = (rows, parts) => (rows || []).forEach((r) => {
  pubopPushW(parts, r.label);
  pubopPushW(parts, r.wording);
  pubopSegsW(r.segs, parts);
  (r.waves || []).forEach((w) => pubopSegsW(w.segs, parts));
});
const pubopCutsW = (cuts, parts) => (cuts || []).forEach((c) => {
  pubopPushW(parts, c.title);
  (c.heads || []).forEach((h) => parts.push(String(h)));
  (c.banners || []).forEach((b) => pubopPushW(parts, b));
  (c.rows || []).forEach((r) => r.length && pubopPushW(parts, r[0]));
});
const pubopFigsW = (figs, parts) => (figs || []).forEach((f) => {
  [f.title, f.measure, f.base].forEach((s) => pubopPushW(parts, s));
  (f.heads || []).concat(f.extraHeads || []).forEach((h) => parts.push(String(h)));
  (f.legend || []).forEach((l) => pubopPushW(parts, l.label));
  pubopRowsW(f.rows, parts);
  (f.sums || []).forEach((r) => pubopPushW(parts, r.label));
});
/* a featured chart or question: cols are the ledger's answer-column heads
   ("Support", "Unsure", "Oppose"), not dates */
const pubopBlockW = (b) => {
  const parts = [];
  [b.title, b.summary, b.note, b.question, b.xLabel, b.base].forEach((s) => pubopPushW(parts, s));
  (b.names || []).forEach((s) => pubopPushW(parts, s));
  (b.legend || []).forEach((l) => pubopPushW(parts, l.label));
  pubopSegsW(b.segs, parts);
  pubopRowsW(b.rows, parts);
  pubopCutsW(b.cuts, parts);
  if (b.kind === "tracker") {
    [b.dek, b.head, b.refLabel].forEach((s) => pubopPushW(parts, s));
    (b.families || []).forEach((s) => parts.push(String(s)));
    (b.cols || []).forEach((s) => parts.push(String(s)));
    (b.panels || []).forEach((p) => pubopPushW(parts, p.label));
  }
  return parts.join(" ").toLowerCase();
};
/* a long-tail question */
const pubopMoreW = (m) => {
  const parts = [String(m.title || "")];
  (m.srcs || []).forEach((s) => pubopPushW(parts, s.question));
  pubopFigsW(m.figs, parts);
  (m.prose || []).forEach((p) => parts.push(pubopText((p.text || []).join(" "))));
  pubopCutsW(m.cuts, parts);
  return parts.join(" ").toLowerCase();
};
/* a hyphen typed in search finds the en dash, the All-polls box's own rule */
const pubopHayMirror = (words) => words + " " + words.replace(/–/g, "-");

function PubOpSearch({ q, onQ }) {
  return (
    <label className="pubop-search">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
      <input type="search" value={q} onChange={(e) => onQ(e.target.value)} autoCorrect="off" spellCheck={false}
             placeholder="Search a question or its answers" aria-label="Search the questions" />
      {q ? <button type="button" className="pubop-x" onClick={() => onQ("")} aria-label="Clear search">×</button> : null}
    </label>
  );
}

/* The same question row serves automatic placement and search results. */
function PubOpQuestion({ m, houses, topic, wv }) {
  const hit = pubopHasWave(m, wv);
  return (
    <article className={"pubop-item pubop-auto" + (hit ? " pubop-wvh" : "")}>
      <div className="pubop-il">
        {topic ? <p className="pubop-qt">{topic}</p> : null}
        {hit ? <em className="pubop-wvh-t">this poll</em> : null}
        <h4 className="pubop-q">{m.title}</h4>
        <PubOpWaves q={m} houses={houses} />
      </div>
      <div className="pubop-ir">
        {m.figs.length > 1 && m.figs.every((f) => pubopTraitSeries(f)) ? <PubOpTraits figs={m.figs} />
          : m.figs.map((f, i) => <PubOpFig key={i} f={f} solo={m.figs.length === 1} />)}
        {m.prose.map((p, i) => (
          <div className="pubop-fig" key={"p" + i}>
            {m.prose.length > 1 || m.figs.length ? <p className="pubop-ght">{p.when}</p> : null}
            <blockquote className="pubop-prose">{pubopText(p.text.join(" "))}</blockquote>
          </div>
        ))}
        <PubOpCuts cuts={m.cuts} when={m.srcs.length > 1 ? m.cutsWhen : null} />
      </div>
    </article>
  );
}

/* ---- the results: the pieces the box finds, a group a topic -------------------
   The count line reads the All-polls bar's way; under it each topic that
   holds a match runs its charts and questions the way it always does, with
   its long tail open. The first groups draw at once and each painted frame
   adds more, the topics' own fill idiom, so a broad match never commits the
   whole list in one task on a phone. */
const PUBOP_R_FIRST = 3, PUBOP_R_STEP = 3;
function PubOpResults({ q, hits, houses }) {
  const nCharts = hits.reduce((n, g) => n + g.blocks.filter((b) => b.kind === "tracker").length, 0);
  const nItems = hits.reduce((n, g) => n + g.blocks.filter((b) => b.kind !== "tracker").length, 0);
  const nMore = hits.reduce((n, g) => n + g.more.length, 0);
  const total = nCharts + nItems + nMore;
  const [fill, setFill] = pubopUseState({ q, n: PUBOP_R_FIRST });
  const filled = fill.q === q ? fill.n : PUBOP_R_FIRST;
  pubopUseEffect(() => {
    if (filled >= hits.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill((f) => ({ q, n: (f.q === q ? f.n : PUBOP_R_FIRST) + PUBOP_R_STEP })), 0);
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [q, filled, hits.length]);
  if (!total) {
    return <p className="pubop-none">Nothing matches “{q}” — try the words of a question as asked, or of its answers.</p>;
  }
  return (
    <div className="pubop-res">
      <p className="pubop-scope pubop-rcount"><b>{total}</b> {total === 1 ? "match" : "matches"} for “{q}”</p>
      {hits.slice(0, filled).map((g) => {
        const trackers = g.blocks.filter((b) => b.kind === "tracker");
        const items = g.blocks.filter((b) => b.kind !== "tracker");
        return (
          <section className="pubop-topic pubop-mon" key={g.t.id}>
            <div className="pubop-tk">
              <h3 className="pubop-tt">{g.t.title}</h3>
              <span className="pubop-tc">{pubopCount(trackers.length, items.length, g.more.length)}</span>
            </div>
            {trackers.map((c) => <PubOpTracker key={c.id} c={c} houses={houses} />)}
            {items.length ? <div className="pubop-items">{items.map((c, i) => <PubOpItem key={(c.id || "") + i} c={c} houses={houses} />)}</div> : null}
            {g.more.length ? <div className="pubop-items">{g.more.map((m) => <PubOpQuestion key={m.id + "|" + m.house} m={m} houses={houses} />)}</div> : null}
          </section>
        );
      })}
    </div>
  );
}

/* ---- the findings: one sentence a topic, each a link to its topic ---------- */
function PubOpFindings({ topics, onGo }) {
  return (
    <section className="pubop-finds" aria-labelledby="pubop-finds-h">
      <h3 className="pubop-fh" id="pubop-finds-h">The findings</h3>
      <ol className="pubop-fl" role="list">
        {topics.map((t, i) => (t.finding ? (
          <li key={t.id}>
            <a className="pubop-f" href={"#pubop-" + t.id} onClick={() => onGo(t.id)}>
              <span className="pubop-fn" aria-hidden="true">{pubopNo(i)}</span>
              <span className="pubop-fb">
                <span className="pubop-fk">{t.short}</span>
                <span className="pubop-ft">{t.finding.text}</span>
                <span className="pubop-fm">{t.finding.meta}</span>
              </span>
            </a>
          </li>
        ) : null))}
      </ol>
    </section>
  );
}

/* the first topics drawn, and how many more each painted frame adds */
const PUBOP_FIRST = 2, PUBOP_STEP = 2;
function PublicOpinionBody() {
  const { D } = window.AP;
  const [src, setSrc] = pubopUseState(null);
  const [failed, setFailed] = pubopUseState(false);
  const [tries, setTries] = pubopUseState(0);
  const [sort, setSort] = pubopUseState("issue");
  const [jump, setJump] = pubopUseState(null);
  const [q, setQ] = pubopUseState("");
  pubopUseEffect(() => {
    let live = true;
    D.loadOneOffs().then((j) => {
      if (!live) return;
      if (j && Array.isArray(j.topics)) { setSrc(j); setFailed(false); }
      else setFailed(true);
    });
    return () => { live = false; };
  }, [tries]);
  /* a link to a topic (#pubop-immigration) lands once the topics exist. The
     browser's own jump found no such id in the static article it painted
     first, and an element's scrollIntoView fired while the first frames are
     still settling overshot to the page foot, so the page scrolls itself,
     two frames on, to the section's top less the pinned bar's clearance.
     A finding picked while the page runs newest first lands the same way,
     once the issues are back. */
  pubopUseEffect(() => {
    if (!src) return;
    const h = jump ? jump.id : (window.location.hash || "").replace(/^#/, "");
    if (!/^pubop-/.test(h)) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const el = document.getElementById(h);
        if (!el) return;
        const pad = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad), behavior: "instant" });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [src, jump]);
  /* the link still sets its hash as ever; the topic it names exists only
     once the issues are back */
  const onGo = (id) => {
    /* by issue the link's own jump lands it - once its topic is drawn (a
       finding picked while the page is still filling in lands by setJump) */
    if (sort === "issue" && shown >= list.length) return;
    setSort("issue");
    setJump({ id: "pubop-" + id });
  };
  /* the go hook for a cross-tab trip (AP.gotoOpinion): flip the page to
     its By-pollster view and land on the pollster's group. It lives on
     window.AP only while the page itself is mounted - a trip arriving
     before that (or after leaving) is gotoOpinion's seek loop's job. A
     trip that names a wave (gotoOpinion's second arg, from the poll
     ledger's byRow key) carries it in jump.wave for the wave marks. */
  pubopUseEffect(() => {
    window.AP.pubopGo = (h, wave) => { setSort("pollster"); setJump({ id: h, wave: wave || null }); };
    return () => { delete window.AP.pubopGo; };
  }, []);
  const topics = pubopUseMemo(() => (src ? src.topics.filter((t) => t.blocks.length || t.more.length) : []), [src]);
  const groups = pubopUseMemo(() => (sort === "recent" ? pubopByMonth(topics)
    : sort === "pollster" ? pubopByPollster(topics, (src && src.houses) || {}) : null), [topics, sort, src]);
  /* the search box stays on q and matching rides the deferred echo, the
     All-polls box's own convention: a keystroke's urgent render finds every
     input unchanged and skips, and the run happens once the query settles.
     Haystacks build once per payload load, a piece's plus its topic's */
  const dq = pubopUseDeferred(q);
  const ql = dq.trim().toLowerCase();
  const inv = pubopUseMemo(() => topics.map((t) => {
    const tw = ((t.title || "") + " " + (t.short || "") + " " + (t.about || "")).toLowerCase() + " ";
    return { t,
      blocks: t.blocks.map((b) => ({ b, hay: pubopHayMirror(tw + pubopBlockW(b)) })),
      more: t.more.map((m) => ({ m, hay: pubopHayMirror(tw + pubopMoreW(m)) })) };
  }), [topics]);
  const hits = pubopUseMemo(() => {
    if (!ql) return null;
    const toks = ql.split(/\s+/);
    return inv.map((g) => ({
      t: g.t,
      blocks: g.blocks.filter((x) => toks.every((k) => x.hay.includes(k))).map((x) => x.b),
      more: g.more.filter((x) => toks.every((k) => x.hay.includes(k))).map((x) => x.m),
    })).filter((g) => g.blocks.length || g.more.length);
  }, [inv, ql]);
  /* The topics are drawn a few at a time, one batch a painted frame. Every
     topic in one commit cost a 360ms task at 4x CPU on a phone (most of
     a 36,000px page, the tap that opened it frozen till the end); the first
     two fill the screen and the rest land below it, long before a reader
     scrolls there. A jump (a hash, a finding picked mid-fill, a cross-tab
     trip) draws the lot at once so its target exists, and a new order
     starts filling afresh. The next batch waits for the frame after this
     commit has painted - an effect's setState alone would run inside the
     same task. */
  const list = groups || topics;
  const [fill, setFill] = pubopUseState({ sort, n: PUBOP_FIRST });
  const filled = fill.sort === sort ? fill.n : PUBOP_FIRST;
  const shown = jump || /^#pubop-/.test(window.location.hash || "") ? Infinity : filled;
  pubopUseEffect(() => {
    if (!src || shown >= list.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill((f) => ({ sort, n: (f.sort === sort ? f.n : PUBOP_FIRST) + PUBOP_STEP })), 0);
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [src, sort, shown, list.length]);

  if (failed) {
    return (
      <div className="pubop">
        <p className="pubop-note">The questions could not be loaded.{" "}
          <button type="button" className="pubop-retry" onClick={() => setTries((n) => n + 1)}>Try again</button></p>
      </div>
    );
  }
  if (!src) return <div className="pubop"><p className="pubop-note">Loading the questions…</p></div>;
  if (!topics.length) return <div className="pubop"><p className="pubop-note">No questions are on file yet.</p></div>;
  const houses = src.houses || {};
  return (
    <div className="pubop">
      {!ql && <PubOpFindings topics={topics} onGo={onGo} />}
      {/* the search pill and the order tabs share one toolbar row, the
          All-polls bar's composition ([pill][controls …]); below 760px the
          pill takes the row and the sort wraps under it, flex-wrap like
          rd-ap-bar's own handoff. (The row's class is pubop-TOOLS: pubop-bar
          was already taken, by PubOpBar's 0-100 answer track - the toolbar
          inherited the track's 12px height and overflow hidden and read
          as a thin sliver until named apart.) */}
      <div className="pubop-tools"><PubOpSearch q={q} onQ={setQ} />{!ql && <PubOpSort sort={sort} onSort={setSort} />}</div>
      {!ql && <p className="pubop-scope">
        {src.counts.questions} questions from {pubopWord(Object.keys(houses).length)} pollsters
        {" "}since {pubopMonth(src.first)}. The newest questions appear automatically by issue and pollster; by recency shows every question, newest first.
        {" "}Every figure names its pollster, its dates and its sample, and links to its source.
      </p>}
      {ql ? <PubOpResults q={dq.trim()} hits={hits} houses={houses} />
        : groups ? groups.slice(0, shown).map((g) => <PubOpGroup key={g.id} g={g} houses={houses} byHouse={sort === "pollster"} wv={jump && jump.wave} />)
        : topics.slice(0, shown).map((t, i) => <PubOpTopic key={t.id} t={t} n={pubopNo(i)} houses={houses} />)}
      <div className="pubop-how">
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

function RdPublicOpinion() {
  return (
    <section className="rd-sec rd-pubop" id="public-opinion" aria-labelledby="rd-pubop-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-pubop-t">Public opinion</h2>
        <span className="rd-meta">What else Australians tell the pollsters</span>
      </div>
      <RdHed head={window.AP.PAGE_HEAD["public-opinion"]}
        dek={"Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, in " + rdNumWord(window.AUSPOL.publicOpinionTopics) + " topics from Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each opens with what the polls found; where several pollsters asked the same thing, their answers sit side by side."} />
      <PublicOpinionBody />
    </section>
  );
}

const RdPublicOpinionM = React.memo(RdPublicOpinion);
const PublicOpinionBodyM = React.memo(PublicOpinionBody);

Object.assign(window, { RdPublicOpinion: RdPublicOpinionM, PublicOpinionBody: PublicOpinionBodyM });
