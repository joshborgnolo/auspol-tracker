/* auspol — lower panels: primary vote, leaders, pollster table */

// ---- small shared UI ------------------------------------------------
function Segmented({ options, value, onChange, size }) {
  return (
    <div className={"segmented" + (size === "sm" ? " segmented-sm" : "")} role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id}
                className={"seg-btn" + (value === o.id ? " active" : "")}
                onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

// quiet, editorial control — reads as type, not a widget
// Render a matchup label ("ALP v L/NP") as shared party tokens + a quiet
// "v" connective, so party abbreviations share one vocabulary with the
// sticky scoreboard. Non-matchup labels (3M, Leadership…) pass through plain.
function toggleLabel(label) {
  if (typeof label === "string" && / v /.test(label)) {
    const [a, b] = label.split(" v ");
    return (
      <>
        <span className="party-tok">{a}</span>
        <span className="tt-vs">v</span>
        <span className="party-tok">{b}</span>
      </>
    );
  }
  return label;
}

function TextToggle({ options, value, onChange, caps, ariaLabel }) {
  return (
    <div className={"text-toggle" + (caps ? " tt-caps" : "")} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <React.Fragment key={o.id}>
          {i > 0 && <span className="tt-div" aria-hidden="true"></span>}
          <button role="radio" aria-checked={value === o.id}
                  className={"tt-opt" + (value === o.id ? " active" : "")}
                  onClick={() => onChange(o.id)}>
            {o.dots && o.dots.length === 2 ? (
              <>
                <span className="tt-dot tt-dot-l" aria-hidden="true" style={{ background: o.dots[0] }}></span>
                {toggleLabel(o.label)}
                <span className="tt-dot tt-dot-r" aria-hidden="true" style={{ background: o.dots[1] }}></span>
              </>
            ) : (
              <>
                {o.dots && (
                  <span className="tt-dots" aria-hidden="true">
                    {o.dots.map((c, k) => (
                      <span key={k} className="tt-dot" style={{ background: c }}></span>
                    ))}
                  </span>
                )}
                {toggleLabel(o.label)}
              </>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- ragged-series helpers (real data: not every leader is polled every
// month, so series are built from non-null readings only) -------------
function seriesNN(pts, key) {
  return pts.map((d) => ({ x: d.x, y: d[key] })).filter((p) => p.y != null);
}
// last two published readings for a key → { v, ym, prev, prevYm } (or null).
// prevYm is carried so a delta can name the month it measures from — these are
// PUBLISHED readings, so the gap is often more than one month.
function lastReadings(rows, key) {
  const nn = rows.filter((r) => r[key] != null);
  if (!nn.length) return null;
  const last = nn[nn.length - 1], prev = nn[nn.length - 2];
  return { v: last[key], ym: last.ym, prev: prev ? prev[key] : null, prevYm: prev ? prev.ym : null };
}
// what a snapshot-panel delta is measured against, spelled out — these compare
// monthly AGGREGATE readings, unlike the archive's ChgTag which compares a
// single pollster with its own previous poll
function readoutDeltaTitle(r) {
  if (!r || r.prevYm == null) return undefined;
  return "Change since " + window.AP.monthLabelFull(r.prevYm)
       + " — this leader's previous published monthly reading across all pollsters,"
       + " not one pollster's own last poll";
}
// short month tag ("May") for a reading older than the latest row
function staleTag(ym, latestYm) {
  if (!ym || ym === latestYm) return null;
  return window.AP.D.monthName(Number(ym.slice(5, 7)));
}
// y-domain fitted to the data, snapped outward to `step`, edge ticks trimmed
function fitDomain(vals, step, include) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (include != null) { lo = Math.min(lo, include); hi = Math.max(hi, include); }
  const d0 = Math.floor((lo - step * 0.4) / step) * step;
  const d1 = Math.ceil((hi + step * 0.4) / step) * step;
  const ticks = [];
  for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
  return { domain: [d0, d1], ticks };
}

function Delta({ value, suffix = "", goodUp = true, small, title }) {
  if (value == null) return null;
  const up = value > 0, flat = Math.abs(value) < 0.05;
  const cls = flat ? "flat" : (up === goodUp ? "up" : "down");
  const arrow = flat ? "→" : up ? "▲" : "▼";
  return (
    <span className={"delta " + cls + (small ? " delta-sm" : "")} title={title}>
      <span className="delta-arrow">{arrow}</span>
      {flat ? "no change" : `${up ? "+" : ""}${value.toFixed(1)}${suffix}`}
    </span>
  );
}

// ---- Primary vote ---------------------------------------------------
function PrimaryVotePanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const [xDomain] = [rangeDomain(rangeId)];
  const [hidden, setHidden] = useState({});
  const latest = D.aggPrimary[D.aggPrimary.length - 1];
  // labels & series ordered by descending latest primary-vote share
  const parts = [
    { id: "alp", ...D.PARTIES.alp },
    { id: "lnp", ...D.PARTIES.lnp },
    { id: "grn", ...D.PARTIES.grn },
    { id: "onp", ...D.PARTIES.onp },
    { id: "oth", ...D.PARTIES.oth },
  ].sort((a, b) => latest[b.id] - latest[a.id]);
  const pts = filterPts(D.aggPrimary, xDomain[0]);
  // every party stays mounted; hiding a chip fades its line via opacity so
  // legend toggles feel continuous instead of popping
  const chartSeries = parts.map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(pts, p.id),
    width: p.id === "oth" ? 2 : 3,
    dashed: p.id === "oth",
    opacity: hidden[p.id] ? 0 : 1,
  }));

  // The published readings behind each line. This chart needs them MORE than
  // the 2PP one does — the houses diverge further on primary shares than on
  // two-party (One Nation's spread runs beyond sampling error), so smooth
  // lines alone overstate how settled the picture is. Five clouds at once
  // would be a mess, so a dot is drawn only while its party is un-hidden:
  // the legend chips already toggle the lines, and now they isolate a cloud.
  const primaryScatter = D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => parts
      .filter((party) => !hidden[party.id] && p.p && p.p[party.id] != null)
      .map((party) => ({ x: p.x, y: p.p[party.id], color: party.color,
                         label: party.name, meta: p })));

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Primary vote</h2>
          <p className="card-sub">First-preference support, poll aggregate</p>
        </div>
        <div className="legend">
          {parts.map((p) => (
            <button key={p.id}
                    className={"legend-chip" + (hidden[p.id] ? " off" : "") + (p.id === "oth" ? " residual" : "")}
                    onClick={() => setHidden((h) => ({ ...h, [p.id]: !h[p.id] }))}>
              <span className="legend-swatch" style={{ background: p.color }}></span>
              <span className="legend-name">{p.name}</span>
              <span className="legend-val">{latest[p.id].toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
      <TrendChart
        key={"pv-" + rangeId}
        height={340} xDomain={xDomain} yDomain={[0, 40]}
        yTicks={[10, 20, 30, 40]} unit="%" axisFont={20}
        pad={{ l: 58, r: 20, t: 18, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={chartSeries} spine={series(pts, "alp")}
        scatter={primaryScatter}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => v.toFixed(1)}
      />
      <p className="table-hint">
        Each dot is one published poll’s first-preference figure; the lines are
        sample-weighted, house-effect-adjusted monthly averages. Use the party
        chips above to isolate one party’s readings.
      </p>
    </section>
  );
}

// opposition-leader handover: Angus Taylor replaced Sussan Ley on 12 Feb 2026.
// The opp-leader line splices the two, so both leadership charts mark the point
// (x = decimal year, same convention as the data's event markers).
const OPP_HANDOVER = (() => {
  const doy = (Date.UTC(2026, 1, 12) - Date.UTC(2026, 0, 1)) / 86400000;
  return { x: 2026 + doy / 365, short: "Ley → Taylor",
           label: "Angus Taylor becomes Opposition Leader",
           desc: "Replaces Sussan Ley · 12 February 2026" };
})();

// ---- Leadership: shared leader selector over two panels -------------
// One control picks which leaders are in view; Preferred-PM and Net-approval
// both reflect that set. The Coalition slot is an OFFICE ("Opposition leader")
// because its series splices Ley → Taylor; Albanese and Hanson are named
// because they are continuous individuals.
function LeaderSelector({ leaders, sel, onToggle }) {
  return (
    <div className="leader-select">
      <span className="ls-label">Leaders in view</span>
      <div className="ls-chips">
        {leaders.map((L) => {
          const on = sel.includes(L.id);
          const last = on && sel.length === 1;
          return (
            <button key={L.id} type="button"
                    className={"ls-chip" + (on ? " on" : "")}
                    style={on ? { "--chip": L.color } : null}
                    aria-pressed={on} disabled={last} title={last ? "Keep at least one leader in view" : undefined}
                    onClick={() => onToggle(L.id)}>
              <span className="ls-dot" style={{ background: L.color }}></span>
              {L.name}{L.current ? <span className="ls-cur"> · {L.current}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Expand / switch / minimise for the leadership pair. Rendered inside each
   card head, and only while the panels actually share a row — below the
   two-column breakpoint they're already full width, so the control would
   promise something it can't do. */
const PZ_ICON = {
  expand: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  minimise: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
  swap: "M4 9h13l-3-3M20 15H7l3 3",
};
function PzBtn({ icon, label, onClick }) {
  return (
    <button type="button" className={"pz-btn pz-" + icon} onClick={onClick} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={PZ_ICON[icon]} />
      </svg>
    </button>
  );
}
function PanelZoom({ expanded, onExpand, onSwap, onClose, label, otherLabel }) {
  if (!expanded) return <PzBtn icon="expand" label={"Expand " + label} onClick={onExpand} />;
  return (
    <div className="pz-group">
      {otherLabel && <PzBtn icon="swap" label={"Show " + otherLabel + " instead"} onClick={onSwap} />}
      <PzBtn icon="minimise" label="Show both panels" onClick={onClose} />
    </div>
  );
}

function LeadershipSection({ rangeId }) {
  const { D } = window.AP;
  const [sel, setSel] = useState(["alb", "taylor", "hanson"]);
  /* pair  — preferred PM | net rating (default)
     ppm   — preferred PM full width
     appr  — net rating full width
     both  — approval | favourability, the two net measures side by side */
  const [view, setView] = useState("pair");
  const order = D.LEADERS.map((L) => L.id);
  const toggle = (id) =>
    setSel((s) => {
      if (s.includes(id)) return s.length === 1 ? s : s.filter((x) => x !== id);
      return order.filter((x) => s.includes(x) || x === id);
    });
  const selLeaders = D.LEADERS.filter((L) => sel.includes(L.id));
  return (
    <section className="leadership">
      <div className="leadership-head">
        <h2 className="section-h">Leadership</h2>
        <LeaderSelector leaders={D.LEADERS} sel={sel} onToggle={toggle} />
      </div>
      <p className="leadership-note">
        The Coalition line splices leaders — <strong>Ley</strong> led to February 2026, <strong>Taylor</strong> since.
        Leadership questions run irregularly, so lines connect published readings.
      </p>
      {/* Both children stay mounted while a column collapses to 0fr, so the
          grid can animate rather than the panel popping out of existence.
          `both` swaps the left child for a second net-rating panel. */}
      <div className={"two-col lead-grid lg-" + view}>
        {view === "both" ? (
          <ApprovalPanel key="appr-net" rangeId={rangeId} leaders={selLeaders}
            metric="net" lockMetric
            chrome={<PanelZoom expanded label="approval" onClose={() => setView("pair")} />} />
        ) : (
          <PreferredPMPanel rangeId={rangeId} leaders={selLeaders}
            chrome={<PanelZoom expanded={view === "ppm"} label="preferred prime minister"
              otherLabel="net rating"
              onExpand={() => setView("ppm")} onSwap={() => setView("appr")}
              onClose={() => setView("pair")} />} />
        )}
        <ApprovalPanel key={view === "both" ? "appr-fav" : "appr"}
          rangeId={rangeId} leaders={selLeaders}
          {...(view === "both" ? { metric: "fav", lockMetric: true } : {})}
          onBoth={() => setView("both")}
          chrome={view === "both"
            ? <PanelZoom expanded label="favourability" onClose={() => setView("pair")} />
            : <PanelZoom expanded={view === "appr"} label="net rating"
                otherLabel="preferred prime minister"
                onExpand={() => setView("appr")} onSwap={() => setView("ppm")}
                onClose={() => setView("pair")} />} />
      </div>
    </section>
  );
}

// ---- Preferred PM ---------------------------------------------------
function PreferredPMPanel({ rangeId, leaders, chrome }) {
  const { D, rangeDomain, filterPts, buildXTicks } = window.AP;
  // Houses leave anywhere from 16% to 50% uncommitted on this question, so a
  // published share says as much about the format as about the leader. The
  // second basis divides by the people who named someone, which makes the
  // houses comparable — but it is a different quantity, so it is a labelled
  // choice rather than a silent correction.
  const [basis, setBasis] = useState("pub");
  const suf = basis === "pub" ? "_pref" : "_prefN";
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;
  // each leader's latest published reading (pollsters skip leaders some months)
  const reads = {};
  leaders.forEach((L) => { reads[L.id] = lastReadings(D.leaderMonths, L.id + suf); });
  // sitting PM (Albanese) is always shown first; the rest descend by preference
  const ordered = [...leaders].sort((a, b) => {
    if (a.id === "alb") return -1;
    if (b.id === "alb") return 1;
    return ((reads[b.id] || {}).v ?? -1) - ((reads[a.id] || {}).v ?? -1);
  });
  // the published readings behind the line, on whichever basis is showing
  const ppmScatter = D.individualPolls
    .filter((p) => p.ppm && p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => {
      const c = p.ppm;
      const den = (c.alb || 0) + (c.taylor || 0) + (c.ley || 0) + (c.hanson || 0);
      return leaders.map((L) => {
        // the opposition slot is an office: Ley's readings belong to the same
        // line as Taylor's, exactly as the trend splices them
        const raw = L.id === "taylor" ? (c.taylor != null ? c.taylor : c.ley) : c[L.id];
        if (raw == null) return null;
        const y = basis === "pub" ? raw : (den > 0 ? (raw / den) * 100 : null);
        return y == null ? null : { x: p.x, y, color: L.color, label: L.short, meta: p };
      }).filter(Boolean);
    });

  // y-window fitted to the readings in view, scatter included
  const prefVals = leaders.flatMap((L) => D.leaderMonths.map((r) => r[L.id + suf]).filter((v) => v != null))
    .concat(ppmScatter.map((d) => d.y));
  const { domain, ticks } = fitDomain(prefVals.length ? prefVals : [30, 50], 10);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">Preferred prime minister</h3>
          <p className="card-sub">
            {basis === "pub"
              ? "“Who would make the better PM?” · as published — houses leave 16–50% uncommitted, so shares aren’t directly comparable"
              : "“Who would make the better PM?” · share of those who named someone — comparable across houses, but a three-way contest still divides further than a two-way"}
          </p>
        </div>
        <div className="card-head-tools">
          <TextToggle caps value={basis} onChange={setBasis} ariaLabel="Preferred-PM basis"
            options={[{ id: "pub", label: "As published" }, { id: "dec", label: "Share of decided" }]} />
          {chrome}
        </div>
      </div>
      <div className="leader-readout">
        {ordered.map((L) => {
          const r = reads[L.id];
          const tag = r && staleTag(r.ym, latestYm);
          return (
            <div className="leader" key={L.id}>
              <div className="leader-dot" style={{ background: L.color }}></div>
              <div>
                <div className="leader-name">{L.short}{tag && <span className="stale-tag" title={"Latest published reading · " + tag}> {tag}</span>}</div>
                <div className="leader-num">{r ? r.v : "—"}{r && <span className="pct">%</span>}</div>
              </div>
              {r && r.prev != null && <Delta value={r.v - r.prev} suffix="" small title={readoutDeltaTitle(r)} />}
            </div>
          );
        })}
      </div>
      <TrendChart
        key={"ppm-" + basis + "-" + rangeId + "-" + leaders.map((L) => L.id).join(".")}
        height={250} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="%" axisFont={20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        events={leaders.some((L) => L.id === "taylor") ? [OPP_HANDOVER] : []}
        series={ordered.map((L) => (
          { id: L.id, label: L.short, color: L.color, points: seriesNN(pts, L.id + suf) }
        ))}
        spine={pts.map((d) => ({ x: d.x }))}
        scatter={ppmScatter}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => v.toFixed(0)}
      />
    </section>
  );
}

// ---- Leader approval ------------------------------------------------
function ApprovalPanel({ rangeId, leaders, chrome, metric: metricProp, lockMetric, onBoth }) {
  const { D, rangeDomain, filterPts, buildXTicks } = window.AP;
  // approval (approve − disapprove) and favourability (positive − negative)
  // are DIFFERENT questions from different pollsters — a toggle, never a blend
  const [own, setOwn] = useState("net");
  // controlled when the section pins this panel to one measure (the side-by-side
  // "both" view), self-managed otherwise
  const metric = metricProp != null ? metricProp : own;
  const setMetric = (v) => (v === "both" ? onBoth && onBoth() : setOwn(v));
  const suf = "_" + metric;                       // _net | _fav
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;
  const reads = {};
  leaders.forEach((L) => { reads[L.id] = lastReadings(D.leaderMonths, L.id + suf); });
  // sitting PM (Albanese) is always shown first; the rest descend by net reading
  const ordered = [...leaders].sort((a, b) => {
    if (a.id === "alb") return -1;
    if (b.id === "alb") return 1;
    return ((reads[b.id] || {}).v ?? -99) - ((reads[a.id] || {}).v ?? -99);
  });
  // Published readings behind the lines, for the ACTIVE metric only. A net is a
  // difference of two proportions, so it carries more sampling noise than a
  // single share — the monthly line hides more here than on any other chart.
  // The metric filter is not optional: approval and favourability are different
  // questions, and blending their clouds would undo the same separation the
  // aggregate takes care to keep.
  const wantFav = metric === "fav";
  const apprScatter = D.individualPolls
    .filter((p) => p.appr && p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => leaders.flatMap((L) => {
      const a = p.appr, out = [];
      const isFav = ((a.metricBy || {})[L.id] === "fav");
      if (a[L.id + "Net"] != null && isFav === wantFav) out.push(a[L.id + "Net"]);
      // a house can publish BOTH measures for one leader in a wave; the second
      // lives in `alt` and belongs on the other tab
      const alt = a.alt && a.alt[L.id];
      if (alt && alt.net != null && (alt.metric === "fav") === wantFav) out.push(alt.net);
      return out.map((y) => ({ x: p.x, y, color: L.color, label: L.short, meta: p }));
    }));

  const netVals = leaders.flatMap((L) => D.leaderMonths.map((r) => r[L.id + suf]).filter((v) => v != null))
    .concat(apprScatter.map((d) => d.y));
  const { domain, ticks } = fitDomain(netVals.length ? netVals : [-20, 20], 10, 0);
  const NET_MAX = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">{metric === "net" ? "Leader net approval" : "Leader net favourability"}</h3>
          <p className="card-sub">
            {metric === "net"
              ? "Approve minus disapprove · Newspoll, YouGov, Resolve, Essential and others"
              : "Positive minus negative · Redbridge, DemosAU and Freshwater ask favourability, not approval"}
          </p>
        </div>
        <div className="card-head-tools">
          {/* "Both" is a layout, not a third metric — it splits the panel in
              two rather than blending the measures, which is the one thing
              this toggle exists to prevent. Hidden when the section has
              already pinned this panel to a single measure. */}
          {!lockMetric && (
            <TextToggle caps value={metric} onChange={setMetric} ariaLabel="Net metric"
              options={[{ id: "net", label: "Approval" }, { id: "fav", label: "Favourability" },
                        ...(onBoth ? [{ id: "both", label: "Both" }] : [])]} />
          )}
          {chrome}
        </div>
      </div>
      <div className="approval-readout">
        {ordered.map((L) => {
          const r = reads[L.id];
          const net = r ? r.v : null;
          const tag = r && staleTag(r.ym, latestYm);
          const w = net == null ? 0 : Math.min(Math.abs(net), NET_MAX) / NET_MAX * 50;
          return (
            <div className="appr" key={L.id}>
              <div className="appr-top">
                <span className="leader-dot" style={{ background: L.color }}></span>
                <span className="leader-name">{L.short}{tag && <span className="stale-tag" title={"Latest published reading · " + tag}> {tag}</span>}</span>
                {net == null
                  ? <span className="net dash">—</span>
                  : <span className={"net " + (net >= 0 ? "pos" : "neg")}>{net > 0 ? "+" : ""}{net}</span>}
                {/* same movement indicator the preferred-PM readout carries —
                    a net that moved is as much news as a share that moved */}
                {r && r.prev != null && <Delta value={r.v - r.prev} suffix="" small title={readoutDeltaTitle(r)} />}
              </div>
              {/* diverging net bar — the source publishes nets only, no
                  approve/disapprove split to stack */}
              <div className="appr-netbar" aria-hidden="true">
                <span className="anb-mid"></span>
                {net != null && (
                  <span className="anb-fill" style={net >= 0
                    ? { left: "50%", width: w + "%", background: "var(--mood-pos)" }
                    : { right: "50%", width: w + "%", background: "var(--mood-neg)" }}></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <TrendChart
        key={"appr-" + metric + "-" + rangeId + "-" + leaders.map((L) => L.id).join(".")}
        height={250} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="" axisFont={20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={[{ y: 0, label: "even", color: "var(--ink-faint)" }]}
        events={leaders.some((L) => L.id === "taylor") ? [OPP_HANDOVER] : []}
        series={ordered.map((L) => (
          { id: L.id, label: L.short + " net", color: L.color, points: seriesNN(pts, L.id + suf) }
        ))}
        spine={pts.map((d) => ({ x: d.x }))}
        scatter={apprScatter}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(0)}
      />
    </section>
  );
}

// "Roy Morgan, Essential and Freshwater" — a plain English list, capped so a
// long roster degrades to "and others" rather than swallowing the subtitle.
// Roy Morgan reports this question in half-points, and the chart's formatter
// also writes the tooltip — rounding an individual poll's 61.5 to 62 would
// misstate it. Axis ticks land on whole numbers, so they stay clean.
const dirFmt = (v) => (v % 1 ? v.toFixed(1) : v.toFixed(0));

function houseList(names, max = 4) {
  if (!names || !names.length) return "";
  if (names.length > max) return names.slice(0, max).join(", ") + " and others";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

// ---- National direction (right track / wrong track) -----------------
function DirectionPanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const asked = houseList(D.directionHouses);
  const question = "“Is the country heading in the right direction, or on the wrong track?”";
  // no right-track / wrong-track series in the dataset yet — keep the panel
  // as an honest empty state so the question has a home when it's polled
  if (!D.direction.length) {
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">National direction</h2>
            <p className="card-sub">{question}</p>
          </div>
        </div>
        <p className="pd-absent">No national direction series yet — none of the tracked pollsters currently
           publish a right-direction / wrong-track question. It will appear here when one does.</p>
      </section>
    );
  }
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.direction, xDomain[0]);
  const latest = D.direction[D.direction.length - 1];
  const prev = D.direction[D.direction.length - 2];
  const netDelta = prev ? latest.net - prev.net : null;

  // y-window fitted to the data — a fixed one clipped the real range the
  // moment wrong-track climbed past 60
  // the published readings behind the two lines — this series leans on three
  // houses and some months carry a single poll, so the spread is the point
  const dirScatter = (D.directionPolls || [])
    .filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1])
    .flatMap((d) => [
      { x: d.x, y: d.right, color: "var(--mood-pos)", label: "Right direction", meta: d },
      { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: "Wrong track", meta: d },
    ]);

  // domain has to cover the raw readings too, not just the smoothed means
  const vals = pts.flatMap((p) => [p.right, p.wrong])
    .concat(dirScatter.map((d) => d.y));
  const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const yTicks = [];
  for (let v = lo + 5; v < hi; v += 5) yTicks.push(v);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">National direction</h2>
          <p className="card-sub">{question}{asked ? " · " + asked : ""}</p>
        </div>
        <div className="dir-net">
          <span className="dir-net-label">Net</span>
          <span className={"dir-net-val " + (latest.net >= 0 ? "pos" : "neg")}>
            {latest.net > 0 ? "+" : ""}{latest.net}
          </span>
          {netDelta != null && <Delta value={netDelta} suffix="" small />}
        </div>
      </div>

      <div className="dir-readout">
        <div className="dir-side">
          <span className="dir-k" style={{ color: "var(--mood-pos)" }}>Right direction</span>
          <span className="dir-v">{latest.right}<span className="pct">%</span></span>
        </div>
        <div className="dir-bar">
          <span className="dir-pos" style={{ width: latest.right + "%" }}></span>
          <span className="dir-uns" style={{ width: latest.unsure + "%" }}></span>
          <span className="dir-neg" style={{ width: latest.wrong + "%" }}></span>
        </div>
        <div className="dir-side ta-r">
          <span className="dir-k" style={{ color: "var(--mood-neg)" }}>Wrong track</span>
          <span className="dir-v">{latest.wrong}<span className="pct">%</span></span>
        </div>
      </div>

      <TrendChart
        key={"dir-" + rangeId}
        height={250} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={20}
        pad={{ l: 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={[
          { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right") },
          { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong") },
        ]}
        spine={series(pts, "right")}
        scatter={dirScatter}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={dirFmt}
      />
      <p className="table-hint">
        Each dot is one published reading; the lines are house-effect-adjusted
        monthly averages. Only {asked ? D.directionHouses.length : 0} houses ask
        this question, so some months rest on a single poll — the dots show which.
      </p>
    </section>
  );
}

// ---- Latest polls — faceted, ragged-tolerant ledger ----------------
const PARTY_C = {
  alp: "var(--alp)", lnp: "var(--lnp)", grn: "var(--grn)",
  onp: "var(--onp)", oth: "var(--oth)", unc: "var(--line-2)",
};

// segment builders — each returns a list the ShareBar can render at ANY arity
// A poll may publish SEVERAL headline voting-intention figures — a
// conventional 2PP, a three-cornered preferred (ALP / L‑NP / ON), an
// ALP v ON head-to-head — or a combination. Normalise them into a list of
// contests, exactly the way ppmContests does for preferred PM:
//   [{ kind, lab, flag, segs: [{label, value, color}] }]
// contests[0] is the row's headline bar; the rest surface as facet-flags in
// the compact row and as full bars in the expanded detail.
function tppContests(r) {
  const alp = r.alp2pp != null ? r.alp2pp : r.alp;   // canonical ALP v L/NP
  const lnp = r.lnp2pp != null ? r.lnp2pp : r.lnp;   // (latest vs archive row shape)
  const out = [];
  // ALP v L/NP delta vs the pollster's last poll; L/NP moves the opposite way
  const dAlp = segDelta(r.chg, "alp2pp");
  const dLnp = dAlp ? { v: +(-dAlp.v).toFixed(1), refDate: dAlp.refDate } : null;
  if (r.tppKind === "3cp" && r.tpp3) {
    out.push({ kind: "3cp", lab: "3-cornered · ALP / L‑NP / ON", flag: "3-cornered", segs: [
      { label: "ALP", value: r.tpp3.alp, color: PARTY_C.alp },
      { label: "L/NP", value: r.tpp3.lnp, color: PARTY_C.lnp },
      { label: "ON", value: r.tpp3.onp, color: PARTY_C.onp },
    ] });
    if (alp != null) out.push({ kind: "2pp", lab: "2PP · ALP v L/NP · derived", derived: true, flag: null, segs: [
      { label: "ALP", value: alp, color: PARTY_C.alp, delta: dAlp },
      { label: "L/NP", value: lnp, color: PARTY_C.lnp, delta: dLnp },
    ] });
  } else if (alp != null) {
    out.push({ kind: "2pp", lab: "2PP · ALP v L/NP", flag: null, segs: [
      { label: "ALP", value: alp, color: PARTY_C.alp, delta: dAlp },
      { label: "L/NP", value: lnp, color: PARTY_C.lnp, delta: dLnp },
    ] });
  }
  // each One Nation head-to-head carries its OWN change vs the pollster's last
  // publication of that same matchup; ON moves opposite its opponent
  const mirror = (d) => (d ? { v: +(-d.v).toFixed(1), refDate: d.refDate } : null);
  const dAltAlp = segDelta(r.chg, "altAlpOn");
  const dAlt2Lnp = segDelta(r.chg, "altLnpOn");
  if (r.tppAlt) out.push({ kind: "alt", lab: "2PP · ALP v ON", flag: "+ALP v ON", segs: [
    { label: "ALP", value: r.tppAlt.alp, color: PARTY_C.alp, delta: dAltAlp },
    { label: "ON", value: r.tppAlt.onp, color: PARTY_C.onp, delta: mirror(dAltAlp) },
  ] });
  if (r.tppAlt2) out.push({ kind: "alt2", lab: "2PP · L/NP v ON", flag: "+L/NP v ON", segs: [
    { label: "L/NP", value: r.tppAlt2.lnp, color: PARTY_C.lnp, delta: dAlt2Lnp },
    { label: "ON", value: r.tppAlt2.onp, color: PARTY_C.onp, delta: mirror(dAlt2Lnp) },
  ] });
  return out;
}
// flag text for the compact voting-intention cell ("3-cornered · +ALP v ON")
function tppFlag(r) {
  const f = tppContests(r).map((c) => c.flag).filter(Boolean);
  return f.length ? f.join(" · ") : null;
}
// heading for the detail block — names the single measure, counts several
function tppHeading(cs) {
  if (cs.length > 1) return "After preferences · " + cs.length + " measures";
  if (cs.length === 1 && cs[0].kind === "3cp") return "Three-cornered preferred";
  return "Two-party preferred";
}
function primarySegs(r) {
  return [
    { label: "ALP", value: r.p.alp, color: PARTY_C.alp, delta: segDelta(r.chg, "pAlp") },
    { label: "L/NP", value: r.p.lnp, color: PARTY_C.lnp, delta: segDelta(r.chg, "pLnp") },
    { label: "GRN", value: r.p.grn, color: PARTY_C.grn, delta: segDelta(r.chg, "pGrn") },
    { label: "ON", value: r.p.onp, color: PARTY_C.onp, delta: segDelta(r.chg, "pOnp") },
    { label: "OTH", value: r.p.oth, color: PARTY_C.oth, muted: true },
  ].filter((s) => s.value != null);   // a pollster may not publish every party
}
// leader identity → label + colour (shared by table PM bars & net columns)
const LEADER_META = {
  alb:    { label: "Albanese", color: PARTY_C.alp },
  taylor: { label: "Taylor",   color: PARTY_C.lnp },
  ley:    { label: "Ley",      color: PARTY_C.lnp },
  hanson: { label: "Hanson",   color: PARTY_C.onp },
  bandt:  { label: "Bandt",    color: PARTY_C.grn },
};
const PPM_ORDER = ["alb", "ley", "taylor", "bandt", "hanson"];

// segments for ONE preferred-PM contest object, e.g. {alb, taylor, unc}.
// `chg` is passed only for a poll's MAIN contest — extra matchups are a
// different question, so a change vs last poll wouldn't be like-for-like.
const PPM_CHG_KEY = { alb: "ppmAlb", ley: "ppmOpp", taylor: "ppmOpp", hanson: "ppmHan" };
function ppmContestSegs(c, chg) {
  const segs = PPM_ORDER.filter((id) => c[id] != null)
    .map((id) => ({ label: LEADER_META[id].label, value: c[id], color: LEADER_META[id].color,
                    delta: PPM_CHG_KEY[id] ? segDelta(chg, PPM_CHG_KEY[id]) : null }));
  if (c.unc != null) segs.push({ label: "Undecided", value: c.unc, color: PARTY_C.unc, muted: true });
  return segs;
}
// a poll may test ONE preferred-PM question (r.ppm) or SEVERAL pairwise
// matchups (r.ppmSets: [{alb, taylor, unc}, {alb, hanson, unc}]). Normalise.
function ppmContests(r) {
  if (Array.isArray(r.ppmSets)) return r.ppmSets;
  if (r.ppm) return [r.ppm];
  return [];
}
function ppmLabel(c) {
  if (c.label) return c.label;
  return PPM_ORDER.filter((id) => c[id] != null).map((id) => LEADER_META[id].label).join(" v ");
}
function ppmKind(c) {
  return PPM_ORDER.filter((id) => c[id] != null).length >= 3 ? "three-way" : "two-way";
}
// flag text for the compact table cell
function ppmFlag(cs) {
  if (cs.length > 1) return cs.length + " matchups";
  if (cs.length === 1 && ppmKind(cs[0]) === "three-way") return "3-way";
  return null;
}
function dirSegs(r) {
  const unsure = 100 - r.dir.right - r.dir.wrong;
  return [
    { label: "Right direction", value: r.dir.right, color: "var(--mood-pos)" },
    { label: "Unsure", value: unsure, color: PARTY_C.unc, muted: true },
    { label: "Wrong track", value: r.dir.wrong, color: "var(--mood-neg)" },
  ];
}

/* The pollster's name in a poll table (Latest polls AND the All-polls
   archive). Where the row knows which published release it came from, the
   name IS the link to it — an archive like this is meant to be checked
   against its sources, and the firm's name is the thing you'd reach for.
   Rows are click-to-expand, so the anchor swallows the click rather than
   toggling the row open on its way out. Falls back to plain text for the
   handful of polls with no citation. */
function PollsterName({ name, url }) {
  if (!url) return <span className="pollster-name">{name}</span>;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { /* keep the link, drop the hint */ }
  return (
    <a className="pollster-name pollster-link" href={url}
       target="_blank" rel="noopener noreferrer"
       onClick={(e) => e.stopPropagation()}
       title={host ? `Read the published poll · ${host}` : "Read the published poll"}>
      {name}<span className="plink-mark" aria-hidden="true">↗</span>
    </a>
  );
}

// arity-agnostic stacked share bar — renders however many segments it is given.
// `flag` renders inline at the end of the key row (never a second line, so
// flagged rows keep the same height as plain ones).
function ShareBar({ segs, compact, flag }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 100;
  return (
    <div className={"share" + (compact ? " share-compact" : "")}>
      <div className="sbar" role="img"
           aria-label={segs.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {segs.map((s, i) => (
          <span key={i} className="sbar-seg"
                style={{ width: (s.value / total * 100) + "%", background: s.color }}></span>
        ))}
      </div>
      <div className="share-keys">
        {segs.map((s, i) => (
          <span key={i} className={"skey" + (s.muted ? " muted" : "")}>
            <span className="skey-dot" style={{ background: s.color }}></span>
            <span className="skey-lab">{s.label}</span>
            <span className="skey-val">{s.value}</span>
            {/* change vs the pollster's last poll — detail only; the compact
                table cells stay clean */}
            {!compact && s.delta && <ChgTag v={s.delta.v} refDate={s.delta.refDate} />}
          </span>
        ))}
        {flag && <span className="facet-flag">{flag}</span>}
      </div>
    </div>
  );
}

function NetVal({ v }) {
  return <span className={"netv " + (v >= 0 ? "pos" : "neg")}>{v > 0 ? "+" : ""}{v}</span>;
}

// Seat projection — MRP polls only. A seat count is a different animal from a
// vote share: it is a count out of the chamber, and the number that decides
// government is the majority line, not the leader. So the bar is drawn to
// scale in SEATS with the majority marked, and each party carries the
// modelled range, which is what an MRP is actually claiming.
// Seat projections name the crossbench more finely than voting intention does
// (a released MRP separates Centre Alliance, Katter's and independents, which
// the vote-share model folds into one "others"). So seats carry their own
// label/colour map rather than borrowing PARTIES, and unknown keys degrade to
// the neutral crossbench grey instead of throwing.
const SEAT_META = {
  alp: { name: "ALP",  color: "var(--alp)" },
  lnp: { name: "L/NP", color: "var(--lnp)" },
  onp: { name: "ON",   color: "var(--onp)" },
  grn: { name: "GRN",  color: "var(--grn)" },
  ind: { name: "IND",  color: "var(--oth)" },
  ca:  { name: "CA",   color: "var(--oth)" },
  kap: { name: "KAP",  color: "var(--oth)" },
  oth: { name: "OTH",  color: "var(--oth)" },
};
function SeatProjection({ seats }) {
  if (!seats || !seats.p) return null;
  const total = seats.total || 150;
  const majority = seats.majority || Math.floor(total / 2) + 1;
  // largest first — an MRP's story is who leads the chamber, not ballot order
  const rows = Object.keys(seats.p).filter((id) => seats.p[id] && seats.p[id].est != null)
    .map((id) => { const m = SEAT_META[id] || { name: id.toUpperCase(), color: "var(--oth)" };
                   return { id, ...seats.p[id], name: m.name, color: m.color }; })
    .sort((a, b) => b.est - a.est);
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + r.est, 0);
  const lead = rows[0];
  return (
    <div className="seatproj">
      <div className="seatbar" role="img"
           aria-label={rows.map((r) => `${r.name} ${r.est} seats`).join(", ") + `, majority ${majority} of ${total}`}>
        {rows.map((r) => (
          <span key={r.id} className="seatbar-seg" title={`${r.name} ${r.est} seats (${r.lo}–${r.hi})`}
                style={{ width: (r.est / total * 100) + "%", background: r.color }}></span>
        ))}
        <span className="seatbar-maj" style={{ left: (majority / total * 100) + "%" }}
              title={`${majority} seats needed for a majority`}></span>
      </div>
      <div className="seatbar-note">
        <span className="seat-majlab">{majority} for majority</span>
        {lead.est < majority && (
          <span className="seat-hung">no party at a majority — {lead.name} short by {majority - lead.est}</span>
        )}
      </div>
      <div className="seat-rows">
        {rows.map((r) => (
          <div className="seat-row" key={r.id}>
            <span className="skey-dot" style={{ background: r.color }}></span>
            <span className="seat-name">{r.name}</span>
            <span className="seat-est">{r.est}</span>
            {r.lo != null && r.hi != null && <span className="seat-range">{r.lo}–{r.hi}</span>}
            {r.chg != null && (
              <span className={"seat-chg " + (r.chg > 0 ? "up" : r.chg < 0 ? "down" : "flat")}>
                {r.chg === 0 ? "–" : (r.chg > 0 ? "▲" : "▼") + Math.abs(r.chg)}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="seat-basis">
        Modelled seat estimate with range · {sum} of {total} seats allocated
        {seats.basis ? ` · change vs the ${seats.basis}, not this pollster’s previous poll` : ""}
      </p>
    </div>
  );
}

// tiny tag beside a net that ISN'T plain approval, so it's never mistaken for
// approve−disapprove: "fav" = favourability (positive − negative), "perf" =
// Resolve's good/poor performance rating (good − poor).
function FavMark({ metric }) {
  if (metric !== "fav") return null;
  return <span className="fav-mark" title="Net favourability / likeability (positive minus negative) — a different question from approval, not directly comparable">fav</span>;
}

// block heading for a poll's leader ratings. A poll can mix metrics per leader
// (Resolve: approval for the majors, likeability for Hanson) — name the measure
// when they agree, fall back to the neutral "Leader ratings" when they don't.
function apprHeading(appr) {
  const mb = appr.metricBy || {};
  const ms = ["alb", "taylor", "hanson"]
    .filter((id) => appr[id + "Net"] != null)
    .map((id) => mb[id] || "approval");
  if (!ms.length) return "Leader ratings";
  if (ms.every((m) => m === "fav")) return "Leader favourability";
  if (ms.every((m) => m === "approval")) return "Leader approval";
  return "Leader ratings";
}

// change indicator vs the SAME pollster's previous poll that reported this
// measure. Direction only (▲ up / ▼ down / – no change) in neutral ink — no
// green/red, because "up" isn't inherently good in a party-neutral tracker.
// ref = ISO date of the poll compared against (surfaced in the tooltip).
function ChgTag({ v, refDate }) {
  if (v == null) return null;
  const { D } = window.AP;
  const flat = Math.abs(v) < 0.05;
  const lab = refDate ? (() => { const [, m, d] = refDate.split("-").map(Number); return d + " " + D.monthName(m); })() : null;
  return (
    <span className={"chg" + (flat ? " flat" : v > 0 ? " up" : " down")}
          title={"vs this pollster’s previous poll" + (lab ? " (" + lab + ")" : "")}>
      {flat ? "–" : (v > 0 ? "▲" : "▼") + Math.abs(v)}
    </span>
  );
}
// a seg's optional delta = { v, refDate }; null when there's no prior reading
function segDelta(chg, key) {
  if (!chg || chg.d[key] == null) return null;
  return { v: chg.d[key], refDate: chg.r[key] };
}

// leader approval — approve / don't-know / disapprove split per leader,
// mirroring the snapshot panel's bars, with the net at right. Ragged-
// tolerant: a leader the pollster didn't poll shows a dash, and a net-only
// reading (no published split) shows just the net.
function ApprBlock({ appr, chg }) {
  // nothing published at all → say so once instead of three dashed rows
  if (appr.albNet == null && appr.taylorNet == null && appr.hansonNet == null) {
    return <div className="pd-absent">No leader approval or favourability published with this poll</div>;
  }
  return (
    <div className="pd-apprs">
      {["alb", "taylor", "hanson"].map((id) => {
        const s = appr[id], net = appr[id + "Net"];
        const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
        // metric is PER LEADER — one poll can ask approval of the majors and
        // favourability (likeability) of a minor-party leader
        const mt = (appr.metricBy && appr.metricBy[id]) || "approval";
        const segNames = mt === "fav" ? ["Positive", "Neutral", "Negative"]
          : ["Approve", "Don't know / never heard of", "Disapprove"];
        // the opposition slot is an office — label it by who held it (Ley →
        // Taylor, spliced Feb 2026) when the poll records that
        const label = id === "taylor" && appr.oppName ? appr.oppName : LEADER_META[id].label;
        // some waves publish BOTH measures for the same leader (Resolve rates
        // the majors on performance and likeability). They answer different
        // questions, so the second one sits beside the first — never averaged
        // into it, never shown as a correction of it.
        const alt = appr.alt && appr.alt[id];
        return (
          <div className="pd-appr" key={id}>
            <div className="pd-appr-top">
              <span className="skey-dot" style={{ background: LEADER_META[id].color }}></span>
              <span className="pd-appr-name">{label}</span>
              <span className="pd-appr-net">
                {net == null
                  ? <span className="dash" title="Not asked by this pollster">—</span>
                  : <><NetVal v={net} /><FavMark metric={mt} /><ChgTag v={(chg && chg.d[id + "Net"] != null) ? chg.d[id + "Net"] : null} refDate={chg && chg.r[id + "Net"]} /></>}
              </span>
            </div>
            {s && (
              <div className="appr-bar pd-appr-bar"
                   title={`${segNames[0]} ${s.app} · ${segNames[1]} ${dk} · ${segNames[2]} ${s.dis}`}>
                <span className="appr-app" style={{ width: s.app + "%" }}>{s.app}</span>
                <span className="appr-dk" style={{ width: dk + "%" }}>{dk}</span>
                <span className="appr-dis" style={{ width: s.dis + "%" }}>{s.dis}</span>
              </div>
            )}
            {alt && (
              <div className="pd-appr-alt"
                   title="This pollster asked both questions of this leader in the same wave — favourability (positive minus negative) is not directly comparable with approval">
                <span className="pd-appr-alt-k">
                  also {alt.metric === "fav" ? "favourability" : "approval"}
                </span>
                <NetVal v={alt.net} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Direction net — dashed when the poll didn't ask the question.
// Lives in the expanded detail only: it isn't part of any facet's question,
// so it earns no permanent column in the compact table.
function DirCell({ r }) {
  if (!r.dir) return <span className="dash" title="Not asked by this pollster">—</span>;
  const net = r.dir.right - r.dir.wrong;
  return <NetVal v={net} />;
}

// sortable column header — shared by the latest-polls AND archive tables.
// `sortKey` (or its archive alias `k`) names the column; an optional `short`
// label swaps in at narrow widths (.lbl-l / .lbl-s), full label as tooltip.
// The header stays a columnheader. It previously carried role="button", which
// overrode the implicit role — that both invalidated aria-sort and cost
// screen-reader users the column association on every sortable column.
// Keyboard activation is handled by tabIndex + onKeyDown instead.
function SortTh({ label, short, sortKey, k, sort, onSort, className }) {
  const key = sortKey != null ? sortKey : k;
  const active = sort.key === key;
  return (
    <th scope="col" className={(className || "") + " sortable" + (active ? " sorted" : "")}
        onClick={() => onSort(key)}
        tabIndex={0}
        title={short ? label : undefined}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(key); } }}
        aria-sort={active ? (sort.dir < 0 ? "descending" : "ascending") : "none"}>
      <span className="th-in">
        {short
          ? <React.Fragment><span className="lbl-l">{label}</span><span className="lbl-s">{short}</span></React.Fragment>
          : label}
        <span className="caret" aria-hidden="true">{active ? (sort.dir < 0 ? "▾" : "▴") : "⇅"}</span>
      </span>
    </th>
  );
}

// full per-poll breakdown — shows EVERYTHING the poll measured, ragged set and all
function PollDetail({ r }) {
  return (
    <div className="poll-detail">
      <div className="pd-meta">
        <span className="pd-meta-i"><span className="pd-meta-k">Commissioned by</span> {r.client}</span>
        {r.mode && <span className="pd-meta-i"><span className="pd-meta-k">Method</span> {r.mode}</span>}
        <span className="pd-meta-i"><span className="pd-meta-k">Sample</span> {r.sample ? "n = " + r.sample.toLocaleString() : "—"}</span>
        <span className="pd-meta-i"><span className="pd-meta-k">Field</span> {r.field}</span>
      </div>
      <div className="pd-grid">
        <div className="pd-block">
          <div className="pd-k">{tppHeading(tppContests(r))}</div>
          {tppContests(r).length === 0
            ? <div className="pd-absent">No two-party figure published with this poll</div>
            : <div className="pd-contests">
                {tppContests(r).map((c, i) => (
                  <div className="pd-contest" key={i}>
                    {tppContests(r).length > 1 && <div className="pd-contest-lab">{c.lab}</div>}
                    <ShareBar segs={c.segs} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">First preferences</div>
          <ShareBar segs={primarySegs(r)} />
        </div>
        <div className="pd-block">
          <div className="pd-k">Preferred PM{ppmContests(r).length > 1 ? " · " + ppmContests(r).length + " matchups" : ppmContests(r).length === 1 && ppmKind(ppmContests(r)[0]) === "three-way" ? " · three-way" : ""}</div>
          {ppmContests(r).length === 0
            ? <div className="pd-absent">No preferred-PM question this wave</div>
            : <div className="pd-contests">
                {ppmContests(r).map((c, i) => (
                  <div className="pd-contest" key={i}>
                    {ppmContests(r).length > 1 && <div className="pd-contest-lab">{ppmLabel(c)}</div>}
                    <ShareBar segs={ppmContestSegs(c, i === 0 ? r.chg : null)} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">{apprHeading(r.appr)}</div>
          <ApprBlock appr={r.appr} chg={r.chg} />
        </div>
        {/* only when the poll actually asked it — Roy Morgan asks every week,
            Essential most waves, and nobody else, so a permanent "not asked"
            row would be noise on most pollsters */}
        {r.dir && (
          <div className="pd-block pd-wide">
            <div className="pd-k">National direction</div>
            <ShareBar segs={dirSegs(r)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* House effect cell. Distinct from the archive's "house lean", which is one
   poll minus that month's aggregate; this is the pollster's SYSTEMATIC shrunk
   mean deviation on a measure, constant across their polls — which is why it
   belongs in Latest polls, where each house appears exactly once.
   A firm with too few readings shows "—", never 0. */
function HouseFx({ he, firm, pos, neg, unit = "pp" }) {
  const h = he ? he[firm] : null;
  if (!h) return <span className="dash" title="Too few polls from this house on this measure to estimate a lean">—</span>;
  const flat = Math.abs(h.v) < 0.05;
  const toward = h.v > 0 ? pos : neg;
  return (
    <span className={"hfx" + (flat ? " flat" : "")}
          style={!flat && toward ? { color: toward.color } : null}
          title={flat
            ? `No measurable lean — sits on the cross-house consensus (from ${h.n} poll${h.n === 1 ? "" : "s"})`
            : `Runs ${Math.abs(h.v).toFixed(1)}${unit} ${h.v > 0 ? "above" : "below"} the cross-house consensus`
              + (toward ? `, i.e. leans ${toward.name}` : "") + ` — estimated from ${h.n} poll${h.n === 1 ? "" : "s"}, shrunk toward zero`}>
      {flat ? "0.0" : (h.v > 0 ? "+" : "−") + Math.abs(h.v).toFixed(1)}
      {toward && !flat && <span className="hfx-who">{toward.short}</span>}
    </span>
  );
}

/* ====================================================================
   NEXT EXPECTED POLLS
   Sits under Latest polls and answers the obvious next question: when does
   the next one land? Each house's own recent rhythm drives it — see
   pollCadence in gen-data for how cadence and publication lag are measured.

   Dates are computed here rather than at build time so the panel stays right
   as the page ages: if a predicted release has already passed, that wave has
   presumably been published and simply isn't in this archive, so the estimate
   rolls forward and the panel says the data is behind.
   ==================================================================== */
const DAY_MS = 86400000;
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// name the rhythm in the words people actually use for it
function cadenceLabel(d) {
  if (d >= 6.5 && d <= 7.5) return "weekly";
  if (d >= 13 && d <= 15) return "fortnightly";
  if (d >= 20 && d <= 22) return "every 3 weeks";
  if (d >= 27 && d <= 32) return "monthly";
  if (d >= 40 && d <= 48) return "every 6 weeks";
  return `every ${Math.round(d)} days`;
}

function NextPollsPanel() {
  const { D } = window.AP;
  const cad = D.pollCadence || [];
  if (!cad.length) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();

  const rows = cad.map((c) => {
    let field = Date.parse(c.last) + c.cadence * DAY_MS;
    let release = field + c.lag * DAY_MS;
    let missed = 0;
    // page older than the prediction — roll on, counting the waves we've missed
    while (release < t0 && missed < 60) { field += c.cadence * DAY_MS; release = field + c.lag * DAY_MS; missed++; }
    return { ...c, field, release, missed, inDays: Math.round((release - t0) / DAY_MS) };
  }).sort((a, b) => a.release - b.release).slice(0, 3);

  const behind = rows.some((r) => r.missed > 0);
  const fmt = (ms) => {
    const d = new Date(ms);
    return `${WD[d.getDay()].slice(0, 3)} ${d.getDate()} ${D.monthName(d.getMonth() + 1)}`;
  };
  const when = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

  return (
    <section className="card next-polls">
      <div className="np-head">
        <h2 className="card-title">Next expected polls</h2>
        <p className="card-sub">
          Estimated from each pollster’s own recent rhythm — not announced schedules.
        </p>
      </div>

      <ol className="np-list">
        {rows.map((r) => (
          <li className="np-row" key={r.pollster}>
            <span className="np-firm">{r.pollster}</span>
            <span className="np-date">
              {fmt(r.release)}
              <span className="np-pm"> ± {r.spread} day{r.spread === 1 ? "" : "s"}</span>
            </span>
            <span className="np-when">{when(r.inDays)}</span>
            <span className="np-cadence">
              {cadenceLabel(r.cadence)} · {r.waves} waves
              {r.missed > 0 && <span className="np-missed"> · {r.missed} since this data</span>}
            </span>
          </li>
        ))}
      </ol>

      <p className="np-foot">
        Each estimate is the house’s median gap between fieldwork-end dates over its last eight
        waves, plus the time it takes to publish. The ± is how much that gap actually moves, so a
        metronomic house shows a tight window and an erratic one a loose one. Publication lag is
        read from release URLs that carry their own date — 38 Roy Morgan releases put it at a
        median of one day after fieldwork closes, which is the default applied to houses whose
        URLs don’t say. Only houses currently holding a pattern appear; one that has broken its
        own rhythm is left out rather than given an invented date.
        {behind && " Some dates have already passed — those waves are out but not yet in this archive."}
      </p>
    </section>
  );
}

function PollsterTable() {
  const { D } = window.AP;
  const HE = D.houseEffects || {};
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({ key: "released", dir: -1 });
  const [open, setOpen] = useState(null);

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));

  const getVal = (r, key) => {
    switch (key) {
      case "released": return r.released;
      case "sample": return r.sample ?? -Infinity;
      case "hfx.tpp": { const h = (HE.tpp || {})[r.pollster]; return h ? h.v : -Infinity; }
      case "hfx.alb": { const h = ((HE.appr || {}).alb || {})[r.pollster]; return h ? h.v : -Infinity; }
      case "alp2pp": return r.alp2pp ?? -Infinity;
      case "p.alp": return r.p.alp ?? -Infinity;
      case "p.lnp": return r.p.lnp ?? -Infinity;
      case "p.grn": return r.p.grn ?? -Infinity;
      case "p.onp": return r.p.onp ?? -Infinity;
      case "ppm.alb": { const c = ppmContests(r)[0]; return c && c.alb != null ? c.alb : -Infinity; }
      case "appr.albNet": return r.appr.albNet != null ? r.appr.albNet : -Infinity;
      case "appr.taylorNet": return r.appr.taylorNet != null ? r.appr.taylorNet : -Infinity;
      case "appr.hansonNet": return r.appr.hansonNet != null ? r.appr.hansonNet : -Infinity;
      default: return 0;
    }
  };
  const rows = [...D.pollsterTable].sort((a, b) => {
    const va = getVal(a, sort.key), vb = getVal(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return 0;
  });

  const newest = [...D.pollsterTable].sort((a, b) => b.released.localeCompare(a.released));
  const fmtWin = (iso) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${D.monthNameFull(m)}`;
  };
  const windowLabel = `${fmtWin(newest[newest.length - 1].released)}\u2013${fmtWin(newest[0].released)}`;

  const FACETS = [
    { id: "twopp", label: "2PP" },
    { id: "primary", label: "Primary" },
    { id: "leadership", label: "Leadership" },
  ];

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Latest polls</h2>
          <p className="card-sub">
            The most recent poll from each active pollster · {windowLabel} · {rows.length} pollsters
          </p>
        </div>
        <TextToggle value={facet} onChange={setFacet} options={FACETS}
          ariaLabel="Poll table view" caps />
      </div>

      <div className="table-wrap">
        <table className="poll-table faceted">
          <thead>
            <tr>
              <th scope="col" className="exp-col" aria-hidden="true"></th>
              <th scope="col" className="ta-l">Pollster</th>
              <SortTh label="Published" sortKey="released" sort={sort} onSort={onSort} className="ta-l" />
              <th scope="col" className="ta-l">Field dates</th>
              <SortTh label="Sample" sortKey="sample" sort={sort} onSort={onSort} />

              {facet === "twopp" && (<>
                <SortTh label="Two-party preferred" sortKey="alp2pp" sort={sort} onSort={onSort} className="share-col ta-l" />
                <SortTh label="House effect" short="H/fx" sortKey="hfx.tpp" sort={sort} onSort={onSort} />
              </>)}
              {facet === "primary" && (<>
                <SortTh label="ALP" sortKey="p.alp" sort={sort} onSort={onSort} />
                <SortTh label="L/NP" sortKey="p.lnp" sort={sort} onSort={onSort} />
                <SortTh label="GRN" sortKey="p.grn" sort={sort} onSort={onSort} />
                <SortTh label="ON" sortKey="p.onp" sort={sort} onSort={onSort} />
                <th scope="col">OTH</th>
              </>)}
              {facet === "leadership" && (<>
                <SortTh label="Preferred PM" sortKey="ppm.alb" sort={sort} onSort={onSort} className="share-col ta-l" />
                <SortTh label="Alb net" sortKey="appr.albNet" sort={sort} onSort={onSort} />
                <SortTh label="Taylor net" sortKey="appr.taylorNet" sort={sort} onSort={onSort} />
                <SortTh label="Hanson net" sortKey="appr.hansonNet" sort={sort} onSort={onSort} />
              </>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.pollster;
              return (
                <React.Fragment key={r.pollster}>
                  <tr className={"poll-row" + (isOpen ? " open" : "")}
                      onClick={() => setOpen(isOpen ? null : r.pollster)}>
                    <td className="exp-col">
                      <button className={"exp-btn" + (isOpen ? " open" : "")}
                              aria-label={isOpen ? "Collapse" : "Expand full breakdown"}
                              aria-expanded={isOpen}>▸</button>
                    </td>
                    <td className="ta-l pollster-cell">
                      <PollsterName name={r.pollster} url={r.url} />
                      <span className="pollster-mode">{r.client}</span>
                    </td>
                    <td className="ta-l"><span className="released-pill">{r.releasedLabel}</span></td>
                    <td className="ta-l muted">{r.field}</td>
                    <td className="num muted">{r.sample != null ? r.sample.toLocaleString() : "—"}</td>

                    {facet === "twopp" && (<>
                      <td className="share-col">
                        {/* Several houses (Newspoll, Resolve, the MRPs) publish no
                            headline 2PP. Rather than spend the row's widest column
                            on a dash, fall back to the first preferences they DID
                            publish — flagged, because a primary-vote bar must never
                            be mistaken for a two-party one. */}
                        {tppContests(r)[0]
                          ? <ShareBar segs={tppContests(r)[0].segs} compact flag={tppFlag(r)} />
                          : primarySegs(r).length
                            ? <div className="tpp-fallback"
                                   title="This pollster published no two-party-preferred figure — showing first preferences instead">
                                <ShareBar segs={primarySegs(r)} compact flag="first preferences · no 2PP" />
                              </div>
                            : <span className="dash" title="No two-party figure published with this poll">—</span>}
                      </td>
                      <td className="num">
                        {/* sign maps to a party here, because the 2PP measure IS
                            an ALP share — positive means it runs Labor-high.
                            The column carries one row per matchup the house
                            publishes, matching the 2PP cell beside it: a lean on
                            ALP v L/NP says nothing about a lean on ALP v ON, so
                            they are estimated and shown separately. */}
                        <HouseFx he={HE.tpp} firm={r.pollster}
                                 pos={{ name: "Labor", short: "ALP", color: PARTY_C.alp }}
                                 neg={{ name: "the Coalition", short: "L/NP", color: PARTY_C.lnp }} />
                        {(HE.alp_on || {})[r.pollster] && (
                          <span className="hfx-sub">
                            <span className="hfx-tag">v ON</span>
                            <HouseFx he={HE.alp_on} firm={r.pollster}
                                     pos={{ name: "Labor", short: "ALP", color: PARTY_C.alp }}
                                     neg={{ name: "One Nation", short: "ON", color: PARTY_C.onp }} />
                          </span>
                        )}
                      </td>
                    </>)}
                    {facet === "primary" && (<>
                      {/* each party's lean sits under its OWN figure — the effects
                          are per party, so one column couldn't carry them without
                          arbitrarily picking a party. Neutral ink: here the sign
                          means "more/less of this party", already named by the
                          column, so a colour would add nothing. */}
                      {["alp", "lnp", "grn", "onp", "oth"].map((k) => (
                        <td className={"num" + (k === "oth" ? " muted" : "")} key={k}
                            style={k === "oth" ? null : { color: PARTY_C[k] }}>
                          {r.p[k] ?? "—"}
                          <span className="hfx-sub">
                            <HouseFx he={(HE.primary || {})[k]} firm={r.pollster} />
                          </span>
                        </td>
                      ))}
                    </>)}
                    {facet === "leadership" && (<>
                      <td className="share-col">
                        {ppmContests(r).length === 0
                          ? <span className="dash" title="No preferred-PM question this wave">—</span>
                          : <ShareBar segs={ppmContestSegs(ppmContests(r)[0])} compact flag={ppmFlag(ppmContests(r))} />}
                      </td>
                      {/* net ratings ARE debiased, so each carries its house effect.
                          Preferred PM is not (its house effects are format
                          artefacts, not lean) — see the footnote. */}
                      {[["alb", "albNet", "alb"], ["taylor", "taylorNet", "opp"], ["hanson", "hansonNet", "han"]].map(([id, nk, hk]) => (
                        <td className="num" key={id}>
                          {r.appr[nk] == null
                            ? <span className="dash" title="Not asked by this pollster">—</span>
                            : <><NetVal v={r.appr[nk]} /><FavMark metric={r.appr.metricBy && r.appr.metricBy[id]} /></>}
                          <span className="hfx-sub">
                            <HouseFx he={(HE.appr || {})[hk]} firm={r.pollster} unit=" pts" />
                          </span>
                        </td>
                      ))}
                    </>)}
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      {/* 5 base cols + facet cols (twopp gained a house-effect column) */}
                      <td colSpan={facet === "primary" ? 10 : facet === "leadership" ? 9 : 7}><PollDetail r={r} /></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-hint">
        Tap any poll to see its full breakdown · click a column heading to sort · “—” means the pollster didn’t ask that question.
        {" "}<strong>House effect</strong> is how far that pollster systematically sits from the cross-house
        consensus on this measure — its own average lean across every poll it has published, shrunk toward
        zero when it has published few. The aggregates subtract it. It is a property of the pollster, not of
        this one poll, and it is measured separately for every measure.
        {facet === "leadership" && " Preferred PM carries no house effect: the gaps between houses there track how many respondents each leaves uncommitted rather than which leader they favour, so a flat correction would shift the level without making the numbers comparable."}
      </p>
    </section>
  );
}

Object.assign(window, { Segmented, TextToggle, Delta, SortTh, fitDomain, PrimaryVotePanel, PreferredPMPanel, ApprovalPanel, DirectionPanel, PollsterTable, NextPollsPanel,
  // shared facet/render helpers reused by the All-polls archive table
  ShareBar, NetVal, FavMark, ChgTag, ApprBlock, apprHeading, SeatProjection, tppContests, tppFlag, tppHeading, primarySegs, dirSegs, ppmContests, ppmContestSegs, ppmLabel, ppmKind, ppmFlag, LEADER_META, PPM_ORDER, PARTY_C });
