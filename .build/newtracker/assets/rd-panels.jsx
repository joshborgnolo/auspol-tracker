/* auspol tracker – the redesign's Snapshot sections (Sep 2026).

   Each existing panel returns one of these while window.AP.rd is set. They
   read the same dataset the panels do and keep the site's machinery - the
   chart engine's travelling window, tooltips and poll links, the copy
   buttons - and write each section's headline from the live figures by a
   rule, so the words turn over with the numbers. */

/* how much of a thing is gone, as a reader says it: "a third", "about half" */
function rdShareWords(p) {
  const c = [[1, 2, "half"], [1, 3, "a third"], [2, 3, "two-thirds"], [1, 4, "a quarter"], [3, 4, "three-quarters"],
             [1, 5, "a fifth"], [2, 5, "two-fifths"], [3, 5, "three-fifths"], [4, 5, "four-fifths"],
             [1, 6, "a sixth"], [1, 8, "an eighth"], [1, 10, "a tenth"]];
  let best = null;
  for (const [a, b, w] of c) {
    const err = Math.abs(p - a / b);
    if (!best || err < best.err) best = { w, err };
  }
  return (best.err < 0.012 ? "" : "about ") + best.w;
}
/* a party as a sentence names it, and at the start of one */
const RD_PARTY_IN = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "minor parties and independents" };
const rdPartyIn = (id) => RD_PARTY_IN[id] || id;
const rdPartyStart = (id) => rdCap(rdPartyIn(id));
const rdPlural = (id) => id === "grn" || id === "oth";

/* month ticks that open on the election itself */
function rdElectionTicks(x0, x1, narrow, elecX) {
  const t = rdXTicks(x0, x1, narrow, { step: x1 - x0 > 1.1 ? (narrow ? 4 : 2) : undefined });
  if (elecX == null || elecX < x0 - 0.01) return t;
  const rest = t.filter((k) => k.x - elecX > 0.1);
  /* "Election" already dates the axis, so the next tick drops a repeat of its year */
  const ey = String(Math.floor(elecX));
  if (rest.length) {
    const lab = rest[0].label;
    const cut = lab.endsWith(" " + ey) ? ey.length + 1 : lab.endsWith(" ’" + ey.slice(2)) ? 4 : 0;
    if (cut) rest[0] = { ...rest[0], label: lab.slice(0, -cut) };
  }
  return [{ x: elecX, label: "Election", strong: true }, ...rest];
}

/* ======================================================================
   Primary vote
   ====================================================================== */
function RdPrimary({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const xDomain = rangeDomain(rangeId);
  const narrow = useNarrow("(max-width: 640px)");
  const [hidden, setHidden] = useState({});
  const now = D.latest.primary;
  const base = D.aggPrimary.find((d) => d.election) || null;
  const lastM = D.aggPrimary[D.aggPrimary.length - 1];
  const NAME = { oth: "Others & independents" };
  const SHORT = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
  /* a phone's line ends carry the parties' letters, as the canvas drew them:
     the full names don't fit beside a 350px plot */
  const ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
  const parts = ["alp", "lnp", "grn", "onp", "oth"].map((id) => ({
    id, color: D.PARTIES[id].color, name: NAME[id] || D.PARTIES[id].name,
    v: now[id], was: base ? base[id] : null, ci: (lastM.ci && lastM.ci[id]) || 0,
  })).sort((a, b) => b.v - a.v);
  const top = parts[0];
  /* the parties the leader cannot be told apart from: the gap to each is
     inside the two figures' 95% margins combined */
  let k = 1;
  while (k < parts.length && top.v - parts[k].v < Math.sqrt(top.ci * top.ci + parts[k].ci * parts[k].ci)) k++;
  const level = parts.slice(0, k);

  const story = (() => {
    const list = (arr) => arr.length === 2 ? arr.join(" and ") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
    const pc = (v) => v.toFixed(1) + "%";
    let head, dek;
    if (k >= 2) {
      head = rdCap(list(level.map((p) => rdPartyIn(p.id)))) + " are level";
      dek = level.map((p, i) => (i === 0 ? rdPartyStart(p.id) : rdPartyIn(p.id)) + ", on " + pc(p.v)).reduce((s, c, i, a) =>
        s + (i === 0 ? c : i === a.length - 1 ? ", and " + c : ", " + c), "") + ", are too close to separate.";
    } else {
      head = rdPartyStart(top.id) + " leads the primary vote";
      dek = rdPartyStart(top.id) + " leads on " + pc(top.v) + ", " + (top.v - parts[1].v).toFixed(1) + " points clear of "
        + rdPartyIn(parts[1].id) + " on " + pc(parts[1].v) + ".";
    }
    /* the biggest faller outside the leading group, if the fall is big */
    const fallers = parts.slice(k).filter((p) => p.was && p.v < p.was && (p.was - p.v) / p.was >= 0.15)
      .sort((a, b) => (b.was - b.v) / b.was - (a.was - a.v) / a.was);
    if (fallers.length) {
      const f = fallers[0];
      dek += " " + rdPartyStart(f.id) + ", on " + pc(f.v) + ", " + (rdPlural(f.id) ? "have" : "has") + " lost "
        + rdShareWords((f.was - f.v) / f.was) + " of " + (rdPlural(f.id) ? "their" : "its") + " election-night vote.";
    }
    return { head, dek };
  })();

  const pts = filterPts(D.aggPrimary, xDomain[0]);
  const visible = parts.filter((p) => !hidden[p.id]);
  const chartSeries = parts.slice().reverse().map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(pts, p.id),
    rdWidth: p.id === "oth" ? 2 : 2.5, dashed: p.id === "oth", dash: p.id === "oth" ? "6 4" : undefined,
    opacity: hidden[p.id] ? 0 : 1, endLabel: narrow ? ABBR[p.id] : SHORT[p.id], rdCap: 4,
  }));
  /* a party toggled off keeps its band, its dots and its election ring on
     the chart at nothing, so they fade out with its line (and back in),
     rather than vanishing the frame the line starts to fade */
  const areas = parts.map((p) => ({
    id: "ci-" + p.id, color: p.color, className: "ci-band", edge: false, hidden: !!hidden[p.id],
    points: pts.filter((d) => d.ci && d.ci[p.id] != null && d[p.id] != null)
      .map((d) => ({ x: d.x, y0: d[p.id] - d.ci[p.id], y1: d[p.id] + d.ci[p.id] })),
  })).filter((a) => a.points.length >= 2);
  const scatter = React.useMemo(() => D.individualPolls
    .filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => parts.filter((p) => q.p && q.p[p.id] != null)
      .map((p) => ({ x: q.x, y: q.p[p.id], color: p.color, label: p.name, meta: q, party: p.id }))), [xDomain[0], xDomain[1]]);
  const shownScatter = React.useMemo(() => scatter.map((d) => (hidden[d.party] ? { ...d, op: 0 } : d)), [scatter, hidden]);
  const marks = base ? parts.map((p) => ({ x: base.x, y: base[p.id], color: p.color, r: 4.5, hidden: !!hidden[p.id] })) : [];
  const evs = (D.events || []).filter((e) => e.major);
  const badges = narrow ? rdEventBadges(evs, xDomain[0], xDomain[1]) : null;
  const eDate = (D.cycles.find((c) => c.current) || {}).eDate;
  const meta = narrow
    ? D.latest.pollsTracked + " national polls, latest fieldwork " + rdDate(D.latest.updatedISO)
    : D.latest.pollsTracked + " national polls since the " + (eDate ? rdDate(eDate, true) + " " : "") + "election, latest fieldwork " + rdDate(D.latest.updatedISO, true);
  const toggle = (id) => setHidden((h) => {
    const next = { ...h, [id]: !h[id] };
    return parts.every((p) => next[p.id]) ? {} : next;   // never an empty chart
  });

  /* A phone lists the five as the canvas drew them: the parties the leader
     can't be told apart from grouped in a tinted box under "Within the margin
     of uncertainty", each row a dot and a name over the change, the figure
     right-aligned so the column reads straight down. A wider screen sets the
     five side by side under a coloured rule, the bracket over the group. */
  const stat = (p) => (
    <button key={p.id} type="button" className="rd-pv-stat" aria-pressed={!hidden[p.id]}
            style={narrow ? undefined : { borderTopColor: p.color }}
            title={(hidden[p.id] ? "Show " : "Hide ") + p.name + " on the chart"}
            onClick={() => toggle(p.id)}>
      <span className="rd-pv-name" style={{ color: inkOf(p.color) }}>
        {narrow && <span className="rd-pv-dot" style={{ background: p.color }}></span>}
        {p.id === "oth" && !narrow ? <><span className="rd-pv-long">{p.name}</span><span className="rd-pv-short">Others</span></> : p.name}
      </span>
      <span className="rd-pv-val">{p.v.toFixed(1)}<span className="rd-pv-pct">%</span></span>
      {p.was != null && (
        <span className="rd-pv-chg">{rdArrow(p.v - p.was)} {Math.abs(p.v - p.was).toFixed(1)} since the election</span>
      )}
    </button>
  );

  return (
    <RdSec id="primary-vote" title="Primary vote" meta={meta}>
      <RdHed head={story.head} dek={story.dek} />
      {narrow ? (
        <div className="rd-pv-list">
          {k >= 2 && (
            <div className="rd-pv-group">
              <div className="rd-pv-grouph">Within the margin of uncertainty</div>
              {parts.slice(0, k).map(stat)}
            </div>
          )}
          <div className="rd-pv-rest">{parts.slice(k >= 2 ? k : 0).map(stat)}</div>
        </div>
      ) : (
        <div className="rd-pv-stats" style={{ "--rd-k": k }}>
          {k >= 2 && (
            <div className="rd-pv-bracket" style={{ gridColumn: "1 / span " + k }}>
              <span></span>Within the margin of uncertainty<span></span>
            </div>
          )}
          {parts.map(stat)}
        </div>
      )}
      <div className="card rd-card rd-pv-chart">
        <TrendChart
          key="rd-pv"
          heightPx={narrow ? 320 : 440}
          padPx={narrow ? { l: 34, r: 6, t: 34, b: 28 } : { l: 40, r: 16, t: 44, b: 30 }}
          xDomain={xDomain} yDomain={[0, 40]} yTicks={[0, 10, 20, 30, 40]}
          yTickFmt={(v) => (v === 0 ? "" : v + "%")} baseline
          xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : null)}
          series={chartSeries} spine={series(pts, "alp")} areas={areas}
          scatter={shownScatter} pollFacet="primary" marks={marks}
          events={badges ? badges.events : evs}
          tooltipTitle={(i) => (pts[i] ? monthLabelFull(pts[i].ym) : "")}
          extraRows={(i) => {
            const d = pts[i];
            if (!d || !d.ci || d.election) return d && d.election ? [{ label: "", value: "The election result" }] : [];
            return [{ label: "95% intervals", value: visible.map((p) => "±" + (d.ci[p.id] != null ? d.ci[p.id].toFixed(1) : "–")).join(" ") }];
          }}
          fmt={(v) => v.toFixed(1)}
          copy={{ title: "Primary vote", sub: story.head, legend: parts.map((p) => ({ label: p.name, color: p.color, kind: p.id === "oth" ? "dashed" : "line" })) }}
        />
        {badges && <RdEventList list={badges.list} />}
        <RdKey className="rd-ckey" items={[
          { kind: "dot", color: "var(--ink-3)", label: "One poll" },
          { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
          base ? { kind: "ring", label: "2025 election result" } : null,
        ]}>
          <span className="rd-grow"></span>
          <RdHow term="primary-vote" from="Primary vote" />
        </RdKey>
      </div>
    </RdSec>
  );
}

/* ======================================================================
   Leadership
   ====================================================================== */
const RD_LEAD_ORDER = ["alb", "taylor", "hanson"];

/* a head-to-head as one bar: each side's share from its end, the gap
   between them the voters who named neither */
function RdHeadBar({ label, right, rightColor, segs, cis }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  const neither = Math.max(0, 100 - total);
  /* "neither" is named only where it fits: a phone's tenth of the bar is
     narrower than the word, and the canvas left that one blank */
  const narrow = useNarrow("(max-width: 640px)");
  /* a segment too narrow for its name and number keeps the number: on a
     phone the three-way bar's smallest share is ~70px, a few short of
     "Taylor 21.3", which ran into the edge. The name moves beneath the bar,
     beside its ± where there is one. Measured against the segment's target
     width, not its current one, so the flex-basis transition can't flicker it. */
  const barRef = React.useRef(null);
  const [tight, setTight] = useState("");
  const key = segs.map((s) => s.name + s.v).join("|");
  React.useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const fit = () => {
      const kids = [...el.children];
      const W = el.clientWidth - 2 * (kids.length - 1);
      const out = segs.filter((s, i) => {
        const c = kids[i], cs = getComputedStyle(c);
        const parts = [...c.children].map((k) => k.offsetWidth);
        const need = parts.reduce((a, b) => a + b, 0) + 6 * (parts.length - 1) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        return need > W * s.v / 100;
      }).map((s) => s.name).join("|");
      setTight((prev) => (prev === out ? prev : out));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  const isTight = (s) => tight.split("|").includes(s.name);
  return (
    <div className="rd-hb" data-hb={label}>
      <div className="rd-hb-top"><b>{label}</b><span style={{ color: rightColor ? inkOf(rightColor) : undefined }}>{right}</span></div>
      <div className="rd-hb-bar" ref={barRef}>
        {segs.map((s, i) => (
          <span key={s.name} className={"rd-hb-seg" + (i === segs.length - 1 && segs.length === 2 ? " end" : "") + (isTight(s) ? " tight" : "")}
                aria-label={s.name + " " + s.v.toFixed(1)} data-mk={s.mk}
                style={{ flexBasis: s.v + "%", background: s.color, color: "var(--on-fill-" + s.party + ")", order: s.order != null ? s.order : i * 2 }}>
            <span className="rd-hb-name">{s.name}</span><b><RollNum value={s.v.toFixed(1)} /></b>
          </span>
        ))}
        {neither > 0.5 && (
          <span className="rd-hb-seg rd-hb-neither" style={{ flexBasis: neither + "%", order: segs.length === 2 ? 1 : 99 }}>
            {neither >= (narrow ? 14 : 7) ? "neither" : ""}</span>
        )}
      </div>
      {cis && (
        <div className="rd-hb-cis">
          {/* ordered as the bar is, so a two-way's ± sits under its own
              leader either side of "neither" */}
          {segs.map((s, i) => <span key={s.name} className={i === segs.length - 1 && segs.length === 2 ? "end" : undefined}
            style={{ flexBasis: s.v + "%", order: s.order != null ? s.order : i * 2 }}>{isTight(s) ? s.name + " " : ""}{s.ci != null ? <>±<RollNum value={s.ci.toFixed(1)} /></> : null}</span>)}
          {neither > 0.5 && <span style={{ flexBasis: neither + "%", order: segs.length === 2 ? 1 : 99 }}></span>}
        </div>
      )}
    </div>
  );
}

function RdLeadership({ rangeId }) {
  const { D, rangeDomain, filterPts, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const xDomain = rangeDomain(rangeId);
  const N = D.leaderNow || {};
  const LM = D.leaderMonths;
  const L = {};
  D.LEADERS.forEach((x) => { L[x.id] = x; });
  const opp = L.taylor, han = L.hanson, pm = L.alb;
  const [ppmView, setPpmView] = useState("two");
  /* two-way <-> three-way is the same people asked a differently shaped
     question, so the chart reshapes rather than being replaced - the gesture
     useMorph gives every such switch. "Both" keeps the lead chart in this slot
     and adds the three-way below it, so reaching it from three-way is the
     morph to two-way. */
  const ppmSlot = (v) => (v === "three" ? "three" : "two");
  const [ppmMorph, choosePpm] = window.AP.useMorph(ppmView, (v) => setPpmView(v), (from, to) => ppmSlot(from) !== ppmSlot(to));
  const [expanded, setExpanded] = useState(null);
  const [own, setOwn] = useState("net");
  const [rawMorph, chooseMetric] = window.AP.useMorph(own, (v) => setOwn(v), (from, to) => from !== "both" && to !== "both" && from !== to);
  const morph = rawMorph;
  const metric = own;
  const r1 = (v) => Math.round(v);
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const signed0 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v));
  const get = (k) => (N[k] ? N[k].v : null);

  /* ---- the headline: preferred PM against net approval ------------------ */
  const story = (() => {
    const a = get("alb_pref"), o = get("taylor_pref"), aH = get("alb_prefH"), h = get("hanson_prefH");
    const net = get("alb_net");
    const first = LM.find((r) => r.alb_net != null);
    if (a == null || o == null || net == null || !first) return null;
    const fall = first.alb_net - net;
    const leads = a > o;
    const round5 = (v) => Math.round(v / 5) * 5;
    const head = (leads ? pm.short + " still leads as preferred PM" : opp.short + " leads as preferred PM")
      + (Math.abs(fall) >= 10 ? ", but his net approval has " + (fall > 0 ? "fallen " : "risen ") + round5(Math.abs(fall)) + " points" : "");
    const leyRows = LM.filter((r) => r.alb_pref != null && r.ley_pref != null);
    const leyLead = leyRows.length ? leyRows.reduce((s, r) => s + r.alb_pref - r.ley_pref, 0) / leyRows.length : null;
    const hanLead = aH != null && h != null ? aH - h : null;
    /* "held steady since it was first measured": the running lead sits within
       a poll's noise of the contest's first monthly reading */
    const hanRows = LM.filter((r) => r.alb_prefH != null && r.hanson_prefH != null);
    const hanSteady = hanLead != null && hanRows.length > 0 && Math.abs(hanLead - (hanRows[0].alb_prefH - hanRows[0].hanson_prefH)) <= 4;
    let dek = leyLead != null && leads && leyLead - (a - o) >= 4
      ? "His lead over the opposition leader has narrowed from " + signed0(leyLead) + " under Ley to " + signed0(a - o) + " under " + opp.short + "."
      : ((leads ? "He leads " : "He trails ") + opp.short + " " + r1(Math.max(a, o)) + "–" + r1(Math.min(a, o)) + " head to head.");
    if (hanLead != null && hanLead > 0)
      dek += " Over " + han.short + (hanLead > a - o ? " his lead is greater (" : " he leads by ")
        + signed0(hanLead) + (hanLead > a - o ? ")" : " points")
        + (hanSteady ? ", and has held steady since it was first measured." : ".");
    return { head, dek };
  })();

  /* ---- preferred PM: the bars ------------------------------------------- */
  /* `mk` is who a segment IS across the switch, the way the chart's lines
     are matched: the two-way's first Albanese and its Taylor and Hanson are
     the three-way's ("3:" marks the three-way bar, so "Both", which shows the
     two side by side, never pairs a segment with one still on screen). The
     head-to-head Albanese has no three-way counterpart. */
  const seg = (Ld, k, order, mk) => ({ name: Ld.short, v: get(k), color: Ld.color, party: Ld.id === "alb" ? "alp" : Ld.id === "taylor" ? "lnp" : "onp", ci: N[k] ? N[k].ci95 : null, order, mk });
  const two = get("alb_pref") != null && get("taylor_pref") != null
    ? { label: pm.short + " v " + opp.short, segs: [seg(pm, "alb_pref", 0, "alb"), seg(opp, "taylor_pref", 2, "taylor")] } : null;
  const twoH = get("alb_prefH") != null && get("hanson_prefH") != null
    ? { label: pm.short + " v " + han.short, segs: [seg(pm, "alb_prefH", 0, "alb-h2h"), seg(han, "hanson_prefH", 2, "hanson")] } : null;
  const three = ["alb_pref3", "taylor_pref3", "hanson_pref3"].every((k) => get(k) != null)
    ? [seg(pm, "alb_pref3", null, "3:alb"), seg(opp, "taylor_pref3", null, "3:taylor"), seg(han, "hanson_pref3", null, "3:hanson")].sort((x, y) => y.v - x.v) : null;
  const leadOf = (segs) => { const w = segs[0].v >= segs[1].v ? segs[0] : segs[1]; return { who: w, m: Math.abs(segs[0].v - segs[1].v) }; };
  const headBar = (h) => {
    const l = leadOf(h.segs);
    return <RdHeadBar key={h.label} label={h.label} right={<>{l.who.name} +<RollNum value={l.m.toFixed(1)} /></>} rightColor={l.who.color} segs={h.segs} cis />;
  };
  const threeBar = three && (
    <RdHeadBar key="three" label="All three" right={<>{three[0].name} +<RollNum value={(three[0].v - three[1].v).toFixed(1)} /> on {three[1].name}</>}
               rightColor={three[0].color} segs={three} cis />
  );
  /* ---- the bars travel between the questions ------------------------------
     As the old design's readout does: a leader in both questions keeps his
     segment, which slides and resizes to where the other question puts him,
     and its figure rolls from the old reading to the new. The layouts are
     different shapes (two bars of two, one bar of three), so React builds new
     elements and nothing can be matched by position: they are matched by
     `mk`. FLIP - where each segment was is read at the click, BEFORE React
     replaces anything, so a switch made mid-flight starts from where the
     segment is on screen; after the render each is put back there with a
     transform and flex-basis and released onto the shared 320ms curve.
     Anything with no counterpart (the head-to-head Albanese, "neither", a
     bar's heading and ± row) fades in. */
  const hbsRef = React.useRef(null);
  const hbSnap = React.useRef(null);
  const ppmPick = (v) => {
    const root = hbsRef.current;
    if (root && v !== ppmView) {
      const rr = root.getBoundingClientRect();
      const segsAt = {};
      root.querySelectorAll("[data-mk]").forEach((n) => {
        const r = n.getBoundingClientRect();
        segsAt[n.dataset.mk] = { x: r.left - rr.left, y: r.top - rr.top, w: r.width,
          d: [...n.querySelectorAll("b .roll-reel")].map((x) => x.style.getPropertyValue("--d")) };
      });
      hbSnap.current = { segs: segsAt, bars: new Set([...root.querySelectorAll("[data-hb]")].map((b) => b.dataset.hb)) };
    }
    choosePpm(v);
  };
  React.useLayoutEffect(() => {
    const prev = hbSnap.current, root = hbsRef.current;
    hbSnap.current = null;
    if (!prev || !root) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const MS = window.AP.MORPH_MS || 320, EASE = window.AP.MORPH_CSS;
    const alias = (k) => (k.startsWith("3:") ? k.slice(2) : "3:" + k);
    const nodes = [...root.querySelectorAll("[data-mk]")];
    const here = new Set(nodes.map((n) => n.dataset.mk));
    const release = [];
    const fadeIn = (n) => {
      n.style.transition = "none"; n.style.opacity = "0";
      release.push(() => { n.style.transition = "opacity " + MS + "ms " + EASE; n.style.opacity = ""; });
    };
    // a figure rolls from the old reading: its reels start on the old digits,
    // paired from the right (units under units), as an odometer lines up
    const seed = (n, was) => {
      const cur = [...n.querySelectorAll("b .roll-reel")];
      const off = cur.length - was.length;
      cur.forEach((reel, i) => {
        const from = was[i - off], to = reel.style.getPropertyValue("--d");
        if (from == null || from === "" || from === to) return;
        reel.style.transition = "none"; reel.style.setProperty("--d", from);
        release.push(() => { reel.style.transition = ""; reel.style.setProperty("--d", to); });
      });
    };
    const moving = [];
    nodes.forEach((n) => {
      const k = n.dataset.mk;
      // its own self if it was there; else its counterpart in the other
      // question, provided that one has gone (under "Both" it hasn't)
      const a = prev.segs[k] || (!here.has(alias(k)) && prev.segs[alias(k)]) || null;
      if (!a) { fadeIn(n); return; }
      seed(n, a.d);
      moving.push({ n, a, basis: n.style.flexBasis });
      // start at the old width, so the flex row lays out the old shape first
      n.style.transition = "none";
      n.style.flexBasis = (a.w / n.parentElement.getBoundingClientRect().width) * 100 + "%";
    });
    [...root.querySelectorAll("[data-hb]")].forEach((b) => {
      if (prev.bars.has(b.dataset.hb)) return;
      b.querySelectorAll(".rd-hb-top, .rd-hb-cis, .rd-hb-neither").forEach(fadeIn);
    });
    const rr = root.getBoundingClientRect();
    moving.forEach((m) => {
      const r = m.n.getBoundingClientRect();
      m.n.style.transform = "translate(" + (m.a.x - (r.left - rr.left)) + "px, " + (m.a.y - (r.top - rr.top)) + "px)";
      release.push(() => {
        m.n.style.transition = "transform " + MS + "ms " + EASE + ", flex-basis " + MS + "ms " + EASE;
        m.n.style.transform = ""; m.n.style.flexBasis = m.basis;
      });
    });
    void root.offsetWidth;          // commit every start state at once, then release them together
    release.forEach((f) => f());
  }, [ppmView]);
  const secondIsHanson = three && three[1].name === han.short;
  const ppmNote = (() => {
    if (ppmView === "two") {
      if (!three) return null;
      return "Asked to choose from all three: " + three.map((s) => s.name + " " + r1(s.v) + "%").join(", ") + "."
        + (secondIsHanson ? " " + han.short + ", not " + opp.short + ", runs second." : "");
    }
    if (ppmView === "three") {
      const rows = LM.filter((r) => r.hanson_pref3 != null && (r.taylor_pref3 != null || r.ley_pref3 != null));
      if (!rows.length) return null;
      const gapOf = (r) => r.hanson_pref3 - (r.taylor_pref3 != null ? r.taylor_pref3 : r.ley_pref3);
      const ahead = rows.every((r) => gapOf(r) > 0);
      const peak = rows.reduce((m, r) => (gapOf(r) > gapOf(m) ? r : m), rows[0]);
      const last = rows[rows.length - 1];
      let s = ahead ? han.short + " has run ahead of the Coalition leader in every month’s three-way average since " + D.monthNameFull(Number(rows[0].ym.slice(5)))
        : han.short + " and the Coalition leader have swapped places in the three-way average";
      if (ahead && gapOf(peak) - gapOf(last) >= 3)
        s += ", though " + opp.short + " has cut the gap from " + r1(gapOf(peak)) + " points in " + D.monthNameFull(Number(peak.ym.slice(5))) + " to " + r1(gapOf(last));
      s += ".";
      const cis = three.map((x) => x.ci || 0);
      if (N.alb_pref3 && N.alb_pref3.ci95 > 1.6 * Math.max(...cis.filter((c, i) => three[i].name !== pm.short)))
        s += " " + pm.short + "’s wide range reflects how differently pollsters ask this question.";
      return s;
    }
    const beats = two && twoH && leadOf(two.segs).who.name === pm.short && leadOf(twoH.segs).who.name === pm.short;
    return (beats ? "Head to head, " + pm.short + " beats both." : "")
      + (secondIsHanson ? " In the three-way question " + han.short + ", not " + opp.short + ", runs second." : "");
  })();

  /* ---- preferred PM: the charts ----------------------------------------- */
  const pts = filterPts(LM, xDomain[0]);
  /* The charts' data only changes with the range and the screen, and a
     switch re-renders this panel on every frame, so each set of lines and
     dots is built once and kept - which also lets a switch's blend find the
     pair of views it lined up on the frame before. */
  const memo = React.useRef({ key: null, m: new Map() });
  const memoKey = xDomain[0] + "|" + xDomain[1] + "|" + narrow;
  if (memo.current.key !== memoKey) memo.current = { key: memoKey, m: new Map() };
  const kept = (k, f) => { const mm = memo.current.m; if (!mm.has(k)) mm.set(k, f()); return mm.get(k); };
  const handover = (D.events || []).find((e) => e.date === "2026-02-12");
  const evs = handover ? [{ ...handover, short: "Ley → Taylor" }] : [];
  /* each month's lead is its polls' own margins averaged (gen-data's
     lead_*), so its 95% band carries a margin's variance rather than two
     shares' bands stacked as if they were independent */
  const run = (k) => pts.filter((r) => r[k] != null).map((r) => ({ x: r.x, y: r[k], ym: r.ym, ci: r[k + "Ci"] }));
  /* mid-switch a line's points carry its band's own edges (ciLo/ciHi, see
     blendRows), which the band is drawn from */
  const bandsOf = (series) => series.map((s) => ({
    id: "ci-" + s.id, color: s.color, className: "ci-band", edge: false, clipX: s.ciClip || s.clipX,
    wipeOf: s.wipe != null ? s.id : undefined,
    points: s.points.some((p) => p.ciHi != null)
      ? s.points.filter((p) => p.ciHi != null && p.ciLo != null).map((p) => ({ x: p.x, y0: p.ciLo, y1: p.ciHi }))
      : s.points.filter((p) => p.ci != null).map((p) => ({ x: p.x, y0: p.y - p.ci, y1: p.y + p.ci })),
  })).filter((a) => a.points.length >= 2);
  const ciRows = (series, i, spine) => {
    const r = spine[i];
    if (!r) return [];
    const cs = series.map((s) => { const p = s.points.find((q) => q.ym === r.ym); return p && p.ci != null ? s.label + " ±" + p.ci.toFixed(1) : null; }).filter(Boolean);
    return cs.length ? [{ label: "95% intervals", value: cs.join(", ") }] : [];
  };
  const leadSeries = kept("leadSeries", () => [
    { id: "ley", label: "over Ley", color: opp.color, points: run("lead_ley"), rdWidth: 2.5, endCap: false },
    /* the lines are named at their ends on a phone too, as the canvas drew
       them: no key under the chart names them */
    { id: "taylor", label: "over " + opp.short, color: opp.color, points: run("lead_taylor"), rdWidth: 2.5, endLabel: "over " + opp.short },
    { id: "hanson", label: "over " + han.short, color: han.color, points: run("lead_hanson"), rdWidth: 2.5, endLabel: "over " + han.short },
  ].filter((s) => s.points.length));
  /* each poll's own lead in each head-to-head it asked: the opposition
     leader ("at") and Hanson ("ah"), never the three-way */
  const leadDots = kept("leadDots", () => D.individualPolls.filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => ["at", "ah"].map((mode) => {
      const c = ppmMatch(q, mode);
      if (!c || c.alb == null) return null;
      const o = mode === "ah" ? "hanson" : c.taylor != null ? "taylor" : c.ley != null ? "ley" : null;
      if (!o || c[o] == null) return null;
      return { x: q.x, y: c.alb - c[o], color: o === "hanson" ? han.color : opp.color, who: o,
               label: "Albanese over " + (o === "hanson" ? "Hanson" : o === "ley" ? "Ley" : opp.short), meta: q };
    })).filter(Boolean));
  const bandVals = (series) => series.flatMap((s) => s.points.flatMap((p) => (p.ci != null ? [p.y - p.ci, p.y + p.ci] : [p.y])));
  const leadVals = bandVals(leadSeries).concat(leadDots.map((d) => d.y));
  const leadFit = fitDomain(leadVals.length ? leadVals : [0, 20], 10, 0);
  const leyPeak = leadSeries.find((s) => s.id === "ley");
  const leadNotes = leyPeak && leyPeak.points.length ? (() => {
    const pk = leyPeak.points.reduce((m, p) => (p.y > m.y ? p : m), leyPeak.points[0]);
    return [{ x: pk.x, y: pk.y, dy: -9, text: "over Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 }];
  })() : [];
  const threeSeries = kept("threeSeries", () => {
    return [
      { id: "alb", label: pm.short, color: pm.color, points: run("alb_pref3"), rdWidth: 2.5, endLabel: pm.short },
      { id: "hanson", label: han.short, color: han.color, points: run("hanson_pref3"), rdWidth: 2.5, endLabel: han.short },
      { id: "ley", label: "Ley", color: opp.color, points: run("ley_pref3"), rdWidth: 2.5, endCap: true },
      { id: "taylor", label: opp.short, color: opp.color, points: run("taylor_pref3"), rdWidth: 2.5, endLabel: opp.short },
    ].filter((s) => s.points.length);
  });
  const firstThree = threeSeries.length ? Math.min(...threeSeries.map((s) => s.points[0].x)) : null;
  /* each poll's three-way shares, one dot per leader in his or her colour -
     the spread the key tells readers to expect, shown rather than asserted */
  const threeDots = kept("threeDots", () => D.individualPolls.filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => {
      const c = ppmMatch(q, "3");
      if (!c) return [];
      const oppK = c.taylor != null ? "taylor" : c.ley != null ? "ley" : null;
      return [["alb", pm.color, pm.short], [oppK, opp.color, oppK === "ley" ? "Ley" : opp.short], ["hanson", han.color, han.short]]
        .filter(([k]) => k && c[k] != null)
        .map(([k, color, label]) => ({ x: q.x, y: c[k], color, label, meta: q, who: k }));
    }));
  const threeTop = Math.max(40, Math.ceil(Math.max(...bandVals(threeSeries), ...threeDots.map((d) => d.y), 0) / 10) * 10);
  const leyRun = threeSeries.find((s) => s.id === "ley");
  /* the note on the empty months before the question was first asked sits
     in them, wrapped to their width and in fewer words where a phone leaves
     too little room: pinned to the plot's left edge, a phone's narrow plot
     ran it across January and over Hanson's line */
  const threeFrom = (() => { const r = LM.find((m) => m.alb_pref3 != null); return r ? rdMonthYear(r.ym).replace(" ", "\u00a0") : ""; })();
  const threeNotes = [
    firstThree != null && firstThree - xDomain[0] > 0.2 ? { span: ["left", { data: Math.min(firstThree, ...threeDots.filter((d) => d.x >= xDomain[0]).map((d) => d.x)) }], y: threeTop * 0.62, text: ["Three-way questions began in " + threeFrom, "First asked in " + threeFrom], cls: "rd-note-it" } : null,
    leyRun && leyRun.points.length ? { x: leyRun.points[leyRun.points.length - 1].x, y: leyRun.points[leyRun.points.length - 1].y, dy: 18, text: "Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 } : null,
  ].filter(Boolean);
  /* a phone's title runs the chart's width, so the Ley → Taylor flag needs
     its own band above the plot or it prints over the title */
  const chartPad = narrow ? { l: 34, r: 6, t: 40, b: 28 } : { l: 40, r: 12, t: 30, b: 30 };
  const lchart = (key, title, props) => (
    <div className="card rd-card rd-ld-chart" key={key}>
      <div className="rd-chead"><span className="rd-chead-t">{title}</span></div>
      <TrendChart key={key} heightPx={narrow ? 250 : 270} padPx={chartPad} xDomain={xDomain}
                  xTicks={rdXTicks(xDomain[0], xDomain[1], narrow)} baseline events={evs}
                  tooltipTitle={(i) => { const s = props.spine || []; return s[i] && s[i].ym ? monthLabelFull(s[i].ym) : ""; }}
                  fmt={(v) => v.toFixed(1)} {...props} />
    </div>
  );
  /* The two views as data, so the one chart can be either or on its way
     between them. Series ids are shared across the views - a line is matched
     by the rival whose colour it is: Albanese's lead over Taylor reshapes into
     Taylor's three-way share, and over Hanson into Hanson's. Albanese's own
     three-way line has no head-to-head counterpart, so it is drawn in (and
     rubbed out on the way back) rather than travelling. */
  /* The key under the chart, in pieces, so a copied chart's caption says
     what the page's key says. The copy is read away from the panel, so it
     also carries the panel's name as its title; its lines are named at
     their ends, so it wants no legend. */
  const keyDots = "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals.";
  const keyThree = "Shares of all respondents. Pollsters leave different shares undecided, so read the order and the gaps rather than the levels.";
  const keyLead = "Lead is " + pm.short + "’s share minus his opponent’s";
  const ppmModel = (v) => v === "three" ? {
    title: "Share in the three-way question, month by month", series: threeSeries, dots: threeDots,
    domain: [0, threeTop], yTicks: rdYTicks(0, threeTop, 10), yTickFmt: (y) => (y === 0 ? "0" : y % 20 === 0 ? y + "%" : ""),
    refLines: [], notes: threeNotes, spine: (threeSeries[0] || { points: [] }).points,
    copy: { title: "Preferred prime minister", sub: "Each leader’s share when asked to choose from all three, month by month",
            legend: [], caption: keyDots + " " + keyThree },
  } : {
    title: pm.short + "’s lead" + (ppmView === "both" ? " head to head" : "") + ", month by month", series: leadSeries, dots: leadDots,
    domain: leadFit.domain, yTicks: rdYTicks(leadFit.domain[0], leadFit.domain[1], 10).filter((y) => y >= 0 || y === leadFit.domain[0]),
    yTickFmt: (y) => (y === 0 ? "Tied" : y > 0 ? "+" + y : "−" + Math.abs(y)),
    refLines: [{ y: 0, color: "var(--ink-3)" }], notes: leadNotes,
    spine: (leadSeries.find((s) => s.id === "taylor") || leadSeries[0] || { points: [] }).points,
    copy: { title: "Preferred prime minister", sub: pm.short + "’s lead over each rival, asked head to head, month by month",
            legend: [], caption: keyDots + " " + keyLead + "." },
  };
  /* The engine widens the right margin to the longest end label showing, so
     each view would get its own plot width and the switch would jolt it.
     One margin for the widest label either view prints (the engine's own
     measure of a label), and the plot keeps its width through the morph. */
  const ppmPad = (() => {
    const room = (t) => [...t].reduce((n, c) => n + (c >= "0" && c <= "9" ? 0.55 : c === " " ? 0.3 : 0.72), 0) * 13 * 0.95 + 12;
    const labs = leadSeries.concat(threeSeries).map((x) => x.endLabel).filter(Boolean);
    return { ...chartPad, r: Math.max(chartPad.r, ...labs.map(room)) };
  })();
  const ppmChart = (key, v, m) => {
    const B = ppmModel(m ? ppmSlot(m.to) : v);
    let series = B.series, cross = null, dom = B.domain;
    if (m) {
      const A = ppmModel(ppmSlot(m.from)), t = m.t;
      const byId = (list) => { const o = {}; list.forEach((x) => (o[x.id] = x)); return o; };
      const a = byId(A.series), b = byId(B.series);
      series = [...new Set(A.series.concat(B.series).map((x) => x.id))].map((id) => {
        if (a[id] && b[id]) {
          const bl = window.AP.blendRows(a[id].points, b[id].points, t, ["y", "ci"]);
          const own = t < 0.5 ? a[id] : b[id];
          // the name fades out and the other view's fades in, crossing at halfway
          return { ...own, points: bl ? bl.rows : own.points, clipX: bl ? bl.clip : null, ciClip: bl ? bl.clips.ci : null, endLabelOpacity: Math.abs(1 - 2 * t) };
        }
        return { ...(a[id] || b[id]), wipe: a[id] ? t : 1 - t, endLabelOpacity: a[id] ? 1 - t : t };
      });
      cross = window.AP.crossClouds(A.dots, B.dots, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.who);
      dom = window.AP.blendDomain(A.domain, B.domain, t);
    }
    const A0 = m ? ppmModel(ppmSlot(m.from)) : null;
    return lchart(key, B.title, {
      padPx: ppmPad, yDomain: dom, yTicks: B.yTicks, yTickFmt: B.yTickFmt, refLines: B.refLines,
      series, areas: bandsOf(series), notes: B.notes,
      morphFrom: A0 ? { yTicks: A0.yTicks, yTickFmt: A0.yTickFmt, refLines: A0.refLines, notes: A0.notes } : null, morphT: m ? m.t : 1,
      scatter: cross ? cross.scatter : B.dots, scatterOut: cross ? cross.scatterOut : [], scatterMove: cross ? cross.scatterMove : [],
      fade: m ? m.t : 1, pollFacet: "leadership", spine: B.spine, copy: B.copy,
      extraRows: (i) => ciRows(B.series, i, B.spine),
    });
  };
  // one persistent slot, so the chart morphs in place rather than remounting
  /* each chart element is kept while nothing it draws changes, so a switch
     in one panel does not rebuild the other panel's chart on every frame */
  const mainPpmChart = React.useMemo(() => ppmChart("rd-ppm", ppmSlot(ppmView), ppmMorph), [ppmView, ppmMorph, memoKey]);
  const threeChart = React.useMemo(() => ppmChart("rd-three", "three", null), [memoKey]);

  /* ---- net approval and favourability ------------------------------------ */
  const leaders = RD_LEAD_ORDER.map((id) => L[id]).filter(Boolean);
  const erasOf = (Ld) => (Ld.id === "taylor" ? ["ley", "taylor"] : [null]);
  const lineFor = (Ld, mt, era) => {
    const k = (era || Ld.id) + "_" + mt;
    return pts.filter((d) => d[k] != null).map((d) => ({ ym: d.ym, x: d.x, v: d[k], ci: d[k + "Ci"] != null ? d[k + "Ci"] : null }));
  };
  const cloudFor = (mt) => {
    const wantFav = mt === "fav";
    return D.individualPolls.filter((q) => q.appr && q.x >= xDomain[0] && q.x <= xDomain[1])
      .flatMap((q) => leaders.flatMap((Ld) => {
        const a = q.appr, out = [];
        const isFav = ((a.metricBy || {})[Ld.id] === "fav");
        if (a[Ld.id + "Net"] != null && isFav === wantFav) out.push(a[Ld.id + "Net"]);
        const alt = a.alt && a.alt[Ld.id];
        if (alt && alt.net != null && (alt.metric === "fav") === wantFav) out.push(alt.net);
        const lab = Ld.id === "taylor" ? (a.oppName || Ld.short) : Ld.short;
        return out.map((y) => ({ x: q.x, y, color: Ld.color, label: lab, meta: q, leader: Ld.id }));
      }));
  };
  const netChart = (mt, key) => {
    const m = key === "main" || key === "a" ? morph : null;
    const runs = (Ld) => erasOf(Ld).map((era) => {
      if (!m) return { era, rows: lineFor(Ld, mt, era), clip: null };
      const b = window.AP.blendRows(lineFor(Ld, m.from, era), lineFor(Ld, m.to, era), m.t, ["v", "ci"]);
      return b ? { era, rows: b.rows, clip: b.clip, ciClip: b.clips.ci } : { era, rows: lineFor(Ld, mt, era), clip: null };
    }).filter((d) => d.rows.length);
    const drawn = leaders.map((Ld) => ({ Ld, runs: runs(Ld) }));
    const series = drawn.flatMap(({ Ld, runs: rs }) => rs.map((d) => ({
      id: Ld.id + (d.era ? "-" + d.era : ""), label: d.era === "ley" ? "Ley" : Ld.short, color: Ld.color,
      points: d.rows.map((r) => ({ x: r.x, y: r.v })), rdWidth: 2.5, clipX: d.clip,
      endCap: d.era !== "ley", endLabel: d.era === "ley" ? null : Ld.short,
    })));
    const areas = drawn.flatMap(({ Ld, runs: rs }) => rs.map((d) => ({
      id: "ci-" + Ld.id + (d.era ? "-" + d.era : ""), color: Ld.color, className: "ci-band", edge: false, clipX: d.ciClip || d.clip,
      points: d.ciClip
        ? d.rows.filter((r) => r.ciHi != null && r.ciLo != null).map((r) => ({ x: r.x, y0: r.ciLo, y1: r.ciHi }))
        : d.rows.filter((r) => r.ci != null).map((r) => ({ x: r.x, y0: r.v - r.ci, y1: r.v + r.ci })) }))).filter((a) => a.points.length >= 2);
    const cross = m ? window.AP.crossClouds(cloudFor(m.from), cloudFor(m.to), m.t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.leader) : null;
    const valsFor = (mm) => leaders.flatMap((Ld) => erasOf(Ld).flatMap((era) => lineFor(Ld, mm, era)).flatMap((d) => d.ci != null ? [d.v - d.ci, d.v + d.ci] : [d.v]))
      .concat(cloudFor(mm).map((d) => d.y));
    const fitFor = (mm) => { const v = valsFor(mm); return fitDomain(v.length ? v : [-20, 20], 20, 0); };
    const tgt = fitFor(mt);
    const dom = m ? window.AP.blendDomain(fitFor(m.from).domain, tgt.domain, m.t) : tgt.domain;
    const leyRun = drawn.find((d) => d.Ld.id === "taylor");
    const ley = leyRun && leyRun.runs.find((r) => r.era === "ley");
    const notes = ley && ley.rows.length ? [{ x: ley.rows[ley.rows.length - 1].x, y: ley.rows[ley.rows.length - 1].v, dy: 18, text: "Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 }] : [];
    const spine = (drawn[0] && drawn[0].runs[0] ? drawn[0].runs[0].rows.filter((r) => !r.mid) : []);
    const title = (mt === "fav" ? "Favourability" : "Net approval") + ", month by month";
    const was = m ? fitFor(m.from).domain : null;
    /* keyed by its SLOT, not its metric: keyed by metric, an approval <->
       favourability switch remounted the chart - which fades in from blank -
       under the very morph that was meant to carry it across */
    return lchart("rd-appr-" + (key === "b" ? "b" : "main"), title, {
      yDomain: dom, yTicks: rdYTicks(tgt.domain[0], tgt.domain[1], 20),
      morphFrom: was ? { yTicks: rdYTicks(was[0], was[1], 20), refLines: [{ y: 0, color: "var(--ink-faint)" }], notes: [] } : null, morphT: m ? m.t : 1,
      yTickFmt: (v) => (v === 0 ? "Even" : v > 0 ? "+" + v : "−" + Math.abs(v)),
      refLines: [{ y: 0, color: "var(--ink-faint)" }], series, areas, notes,
      scatter: cross ? cross.scatter : cloudFor(mt), scatterOut: cross ? cross.scatterOut : [], scatterMove: cross ? cross.scatterMove : [],
      fade: m ? m.t : 1, pollFacet: "leadership", spine,
      /* read away from the panel: its name, its measure, and the key */
      copy: mt === "fav"
        ? { title: "Leaders’ net favourability", sub: "Favourable minus unfavourable views of each leader as a person, month by month",
            legend: [], caption: keyDots + " Polls by RedBridge, DemosAU, Freshwater and Spectre Strategy." }
        : { title: "Leaders’ net approval", sub: "Approve minus disapprove of the job each leader is doing, month by month",
            legend: [], caption: keyDots + " Polls by Newspoll, YouGov, Resolve, Essential and others." },
      extraRows: (i) => { const r = spine[i]; if (!r) return []; const cs = leaders.map((Ld) => { const row = pts.find((p) => p.ym === r.ym); const k = (Ld.id === "taylor" && row && row.taylor_net == null && row.ley_net != null ? "ley" : Ld.id) + "_" + mt + "Ci"; return row && row[k] != null ? "±" + row[k].toFixed(1) : null; }).filter(Boolean); return cs.length ? [{ label: "95% intervals", value: cs.join(", ") }] : []; },
    });
  };

  const apprChart = React.useMemo(() => netChart(metric === "fav" ? "fav" : "net", metric === "both" ? "a" : "main"), [metric, morph, memoKey]);
  const apprFavChart = React.useMemo(() => netChart("fav", "b"), [memoKey]);

  /* the dot plot: now, its 95% interval, and the change */
  const dotRows = (mt) => leaders.map((Ld) => ({ Ld, n: N[Ld.id + "_" + mt] })).filter((r) => r.n);
  const dotDom = [-40, 20];
  const dxp = (v) => ((Math.max(dotDom[0], Math.min(dotDom[1], v)) - dotDom[0]) / (dotDom[1] - dotDom[0])) * 100;
  const dotPlot = (mode) => {
    const rowsA = dotRows("net"), rowsF = dotRows("fav");
    const both = mode === "both";
    const list = both ? leaders.map((Ld) => ({ Ld, a: N[Ld.id + "_net"], f: N[Ld.id + "_fav"] })) : (mode === "fav" ? rowsF : rowsA).map((r) => ({ Ld: r.Ld, a: r.n }));
    return (
      <div className={"rd-dp" + (both ? " both" : "")} role="table" aria-label={both ? "Net approval and favourability now" : (mode === "fav" ? "Net favourability now" : "Net approval now") + ", with 95% intervals and change"}>
        <div className="rd-dp-head" role="row">
          <span></span>
          <span className="rd-dp-axis" aria-hidden="true"><span style={{ left: dxp(0) + "%" }}>Even</span></span>
          <span role="columnheader">{both ? "Approval" : "Now"}</span>
          <span role="columnheader">{both ? "Favour." : "Change"}</span>
        </div>
        {list.map(({ Ld, a, f }) => (
          <div key={Ld.id} className="rd-dp-row" role="row">
            <span role="cell" className="rd-dp-name"><span className="rd-dp-sw" style={{ background: Ld.color }}></span>{Ld.short}</span>
            <span className="rd-dp-track" aria-hidden="true">
              <span className="rd-dp-zero" style={{ left: dxp(0) + "%" }}></span>
              {!both && a && <span className="rd-dp-ci" style={{ left: dxp(a.v - a.ci95) + "%", width: dxp(a.v + a.ci95) - dxp(a.v - a.ci95) + "%", background: Ld.color }}></span>}
              {both && a && f && <span className="rd-dp-link" style={{ left: Math.min(dxp(a.v), dxp(f.v)) + "%", width: Math.abs(dxp(a.v) - dxp(f.v)) + "%", background: Ld.color }}></span>}
              {a && <span className="rd-dp-dot" style={{ left: dxp(a.v) + "%", background: Ld.color }}></span>}
              {both && f && <span className="rd-dp-dot open" style={{ left: dxp(f.v) + "%", borderColor: Ld.color }}></span>}
            </span>
            <span role="cell" className="rd-dp-now">{a ? <RollNum value={signed(a.v)} /> : "—"}</span>
            <span role="cell" className={"rd-dp-chg" + (!both && a && a.changeSig ? " sig" : "")}>
              {both ? (f ? <RollNum value={signed(f.v)} /> : "—")
                : a && a.chg != null ? <>{Math.abs(a.chg) < 0.05 ? "→" : rdArrow(a.chg)} <RollNum value={Math.abs(a.chg) < 0.05 ? "0.0" : Math.abs(a.chg).toFixed(1)} /></> : ""}</span>
          </div>
        ))}
        <div className="rd-dp-foot" aria-hidden="true">
          <span></span>
          <span className="rd-dp-axis">{[-40, -20, 0, 20].map((v) => <span key={v} style={{ left: dxp(v) + "%" }}>{v === 0 ? "0" : v > 0 ? "+" + v : "−" + Math.abs(v)}</span>)}</span>
          <span></span><span></span>
        </div>
      </div>
    );
  };
  const apprNote = (() => {
    if (metric === "both") {
      const d = leaders.map((Ld) => ({ Ld, a: get(Ld.id + "_net"), f: get(Ld.id + "_fav") })).filter((x) => x.a != null && x.f != null);
      const worseJob = d.filter((x) => x.a < x.f - 3), betterJob = d.filter((x) => x.a > x.f + 3);
      const bits = [];
      if (worseJob.length) bits.push("Voters rate " + worseJob.map((x) => x.Ld.short).join(" and ") + "’s job worse than they rate " + (worseJob.length > 1 ? "them" : "him"));
      if (betterJob.length) bits.push((bits.length ? "" : "Voters rate ") + betterJob.map((x) => x.Ld.short).join(" and ") + (bits.length ? " the reverse" : "’s job better than they rate " + (betterJob.length > 1 ? "them" : "her")));
      return (bits.length ? bits.join(", and ") + ". " : "") + "Different pollsters ask each question, so part of each gap reflects who asked.";
    }
    const mt = metric;
    const rows = leaders.map((Ld) => ({ Ld, n: N[Ld.id + "_" + mt] })).filter((r) => r.n);
    const sig = rows.filter((r) => r.n.changeSig);
    let s = "Bars are 95% intervals. ";
    s += !sig.length ? "None of the changes is significant." : sig.length === 1
      ? "Only " + sig[0].Ld.short + "’s " + (sig[0].n.chg < 0 ? "fall" : "rise") + " is statistically significant"
      : sig.map((r) => r.Ld.short).join(" and ") + "’s changes are statistically significant";
    const even = rows.filter((r) => Math.abs(r.n.v) <= r.n.ci95);
    if (sig.length) s += even.length ? ", and " + even.map((r) => r.Ld.short).join(" and ") + "’s range still includes even." : ".";
    else if (even.length) s += " " + even.map((r) => r.Ld.short).join(" and ") + "’s range includes even.";
    if (mt === "fav") {
      const cmp = leaders.map((Ld) => ({ Ld, a: get(Ld.id + "_net"), f: get(Ld.id + "_fav") })).filter((x) => x.a != null && x.f != null);
      const worse = cmp.filter((x) => x.f < x.a - 3).map((x) => x.Ld.short), better = cmp.filter((x) => x.f > x.a + 3).map((x) => x.Ld.short);
      if (worse.length || better.length)
        s += " " + [worse.length ? worse.join(" and ") + " rates worse here than on job approval" : null,
                    better.length ? (worse.length ? "" : "") + better.join(" and ") + " better" : null].filter(Boolean).join(" and ")
          + ", though different pollsters ask each question.";
    }
    return s;
  })();

  const panel = (id, head, dek, tabs, body) => (
    <div className={"rd-ld-panel" + (expanded && expanded !== id ? " rd-hidden" : "")}>
      <RdSub head={head} dek={dek} />
      {tabs}
      {body}
    </div>
  );
  const expandBtn = (id, label) => (
    <button type="button" className="rd-iconbtn" onClick={() => setExpanded(expanded === id ? null : id)}
            aria-label={(expanded === id ? "Show both panels" : "Expand " + label)} title={expanded === id ? "Show both panels" : "Expand"}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={expanded === id
        ? "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"
        : "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"} /></svg>
    </button>
  );

  return (
    <RdSec id="leadership" cls="rd-lead" title="Leadership" meta="Preferred PM and net approval, Newspoll, YouGov, Resolve, Essential and others">
      {story && <RdHed head={story.head} dek={story.dek} />}
      {/* "free" frees the panels from the shared desktop row grid: a "Both"
          view gives its panel extra children (a second chart, the dot-plot
          key), so the two panels' rows no longer pair up - the other panel's
          keys and notes would get parked against this panel's tall chart
          rows, centre themselves in the stretched track and hang in space
          above or below their own charts. Not shared, each panel stacks. */}
      <div className={"rd-ld-grid" + (expanded ? " one" : ppmView === "both" || metric === "both" ? " free" : "")}>
        {panel("ppm", "Preferred prime minister", "“Who would make the better PM?” Asked head to head, and three-way where pollsters offer it.",
          <RdTabs swipe value={ppmView} onChange={ppmPick} ariaLabel="Preferred prime minister question"
                  options={[{ id: "two", label: "Two-way" }, { id: "three", label: "Three-way" }, { id: "both", label: "Both" }]}>
            {!narrow && expandBtn("ppm", "preferred prime minister")}
          </RdTabs>,
          <>
            {/* two bars or one, a note a line longer or shorter: each glides
                to its height (RdGlide), so the chart under it slides. One
                wrapper per row of the panel's subgrid, which lines the two
                panels' rows up; the chart cards stay unwrapped, since their
                spacing reads the key that follows them. */}
            <RdGlide watch={ppmView} className="rd-ld-bars-g">
              <div className="rd-hbs" ref={hbsRef}>
                {ppmView !== "three" && two && headBar(two)}
                {ppmView !== "three" && twoH && headBar(twoH)}
                {ppmView !== "two" && threeBar}
              </div>
            </RdGlide>
            {ppmNote && <RdGlide watch={ppmNote} className={"rd-ld-note-g" + (ppmView === "three" ? " rd-ld-noteup" : "")}><p className="rd-note rd-ld-note">{ppmNote}</p></RdGlide>}
            {mainPpmChart}
            {ppmView === "both" && threeChart}
            <RdKey className="rd-ckey" items={[]}>
              <span className="rd-ld-keytxt">{keyDots + " " + (ppmView === "three" ? keyThree
                : ppmView === "two" ? keyLead + ", which lets one chart carry both head-to-head contests."
                : keyLead + "; three-way figures are shares of all respondents.")}</span>
            </RdKey>
          </>)}
        {panel("appr", metric === "both" ? "Approval and favourability" : metric === "fav" ? "Net favourability" : "Net approval",
          metric === "both" ? "Net ratings of the job each leader is doing, and of each leader as a person."
            : metric === "fav" ? "Favourable minus unfavourable views of each leader as a person. RedBridge, DemosAU, Freshwater and Spectre Strategy."
            : "Approve minus disapprove of the job each leader is doing. Newspoll, YouGov, Resolve, Essential and others.",
          <RdTabs swipe value={metric} onChange={(v) => { if (v === "both" || own === "both") setOwn(v); else chooseMetric(v); }} ariaLabel="Leader rating"
                  options={[{ id: "net", label: "Approval" }, { id: "fav", label: "Favourability" }, { id: "both", label: "Both" }]}>
            {!narrow && expandBtn("appr", "leader ratings")}
          </RdTabs>,
          <>
            <RdGlide watch={metric} className="rd-ld-dp-g">{dotPlot(metric)}</RdGlide>
            {metric === "both" && <RdKey className="rd-dp-key" items={[{ kind: "dot-solid", color: "var(--ink-3)", label: "Approval: the job they’re doing" }, { kind: "dot-open", color: "var(--ink-3)", label: "Favourability: views of them as a person" }]} />}
            <RdGlide watch={apprNote} className="rd-ld-note-g"><p className="rd-note rd-ld-note">{apprNote}</p></RdGlide>
            {apprChart}
            {metric === "both" && apprFavChart}
            <RdKey className="rd-ckey" items={[
              { kind: "dot", color: "var(--ink-3)", label: "One poll" },
              { kind: "lineband", color: "var(--ink-3)", label: "Monthly average and its 95% interval" },
            ]} />
          </>)}
      </div>
      <RdFoot how={{ term: "leadership", from: "Leadership" }}>
        Figures pool the last six weeks of polls. Changes are on the previous period; ▼ in bold marks a significant change.
      </RdFoot>
    </RdSec>
  );
}

/* ======================================================================
   National direction
   ====================================================================== */
/* a count of points as a reader rounds it: "more than 30", "about 10" */
function rdRoughPts(v) {
  const a = Math.abs(v);
  if (a < 12) return String(Math.round(a));
  const tens = Math.floor(a / 10) * 10;
  return a - tens >= 2 ? "more than " + tens : "about " + tens;
}
function RdDirection({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  if (!D.direction.length) return null;
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.direction, xDomain[0]);
  const now = D.directionNow || D.direction[D.direction.length - 1];
  const M = D.direction;
  const wrongLeads = now.wrong >= now.right;
  const big = wrongLeads ? now.wrong : now.right, small = wrongLeads ? now.right : now.wrong;
  const most = wrongLeads ? now.wrong >= Math.max(...M.map((d) => d.wrong)) - 0.05 : now.right >= Math.max(...M.map((d) => d.right)) - 0.05;
  const head = plainShare(big) + " say Australia is " + (wrongLeads ? "on the wrong track" : "heading in the right direction")
    + (most ? ", the most this term" : "");
  const first = M[0];
  const sinceFirst = now.net - first.net;
  const netVerb = (n, up) => n >= 10 ? (up ? "soared" : "plummeted") : n >= 6 ? (up ? "lifted" : "soured") : (up ? "lifted slightly" : "soured slightly");
  const netWord = (d) => (d > 0 ? "improved" : "worsened");
  const upDown = (d) => (d > 0 ? "up " : "down ");
  const dek = (small < 30 ? "Only " : "") + Math.round(small) + "% say we’re " + (wrongLeads ? "heading in the right direction" : "on the wrong track") + ". "
    + (now.chg == null ? ""
      : now.changeSig ? "Net mood has " + netVerb(Math.round(Math.abs(now.chg)), now.chg > 0) + ", " + upDown(now.chg) + Math.round(Math.abs(now.chg)) + " points in a month"
      : "Net mood has held steady for a month")
    + (Math.abs(sinceFirst) >= 5 ? (now.chg == null
      ? "Net mood has " + netWord(sinceFirst) + ", " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025."
      : now.changeSig
        ? (Math.sign(sinceFirst) === Math.sign(now.chg) ? " and " : " but " + upDown(sinceFirst)) + rdRoughPts(sinceFirst) + " points since May 2025."
        : ", though it is " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025.") : ".");
  const signedP = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

  const dots = (D.directionPolls || []).filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]).flatMap((d) => [
    { x: d.x, y: d.right, color: "var(--mood-pos)", label: "Right direction", meta: d },
    { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: "Wrong track", meta: d },
  ]);
  const band = (k, ck) => pts.filter((d) => d[ck] != null).map((d) => ({ x: d.x, y0: d[k] - d[ck], y1: d[k] + d[ck] }));
  const areas = [
    { id: "ci-right", color: "var(--mood-pos)", className: "ci-band", edge: false, points: band("right", "rightCi") },
    { id: "ci-wrong", color: "var(--mood-neg)", className: "ci-band", edge: false, points: band("wrong", "wrongCi") },
  ].filter((a) => a.points.length >= 2);
  const vals = pts.flatMap((p) => [p.right, p.wrong]).concat(dots.map((d) => d.y)).concat(areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
  const lo = Math.floor((Math.min(...vals) + 0.6) / 10) * 10, hi = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
  /* the gap drawn where it now stands, against the month before Bondi */
  const bondi = (D.events || []).find((e) => e.date === "2025-12-14");
  const last = pts[pts.length - 1];
  const base = bondi ? M.find((d) => d.ym === bondi.date.slice(0, 7)) : null;
  const gapNow = last ? Math.abs(last.wrong - last.right) : null;
  /* the gap is named where it is drawn, on a phone too, as the canvas did:
     three short lines beside the bracket rather than a note under the chart */
  const brackets = !last ? [] : !narrow ? [{ x: last.x, y0: last.wrong, y1: last.right, lines: [
    gapNow.toFixed(1) + " points apart in " + D.monthNameFull(Number(last.ym.slice(5))),
    base ? "up from " + Math.abs(base.wrong - base.right).toFixed(1) + " in " + D.monthNameFull(Number(base.ym.slice(5))) + ", before Bondi" : null,
  ].filter(Boolean) }] : [{ x: last.x, y0: last.wrong, y1: last.right, dx: 4, lines: [
    gapNow.toFixed(1) + " points apart", "in " + D.monthNameFull(Number(last.ym.slice(5))) + (base ? ";" : ""),
    base ? Math.abs(base.wrong - base.right).toFixed(1) + " before Bondi" : null,
  ].filter(Boolean) }];
  const evs = bondi ? [bondi] : [];
  const badges = narrow ? rdEventBadges(evs, xDomain[0], xDomain[1]) : null;
  const counts = {};
  (D.directionPolls || []).forEach((d) => { counts[d.pollster] = (counts[d.pollster] || 0) + 1; });
  const total = (D.directionPolls || []).length;
  const houses = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const inactive = (D.directionHousesAll || []).filter((h) => /inactive/.test(h)).map((h) => h.replace(/ \(inactive\)/, ""));
  const active = houses.filter((h) => !inactive.includes(h));
  const top = houses[0];
  const monthNow = last ? D.monthNameFull(Number(last.ym.slice(5))) : "";
  const ymLong = (ym) => D.monthNameFull(Number(ym.slice(5))) + " " + ym.slice(0, 4);
  const topYM = (D.directionPolls || []);
  const others = active.filter((h) => h !== top);
  /* an Oxford comma only here: the house list closes a sentence of its own,
     every other list in the panel keeps rdList's bare "and" */
  const rdListOx = (arr) => arr.length > 2 ? arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1] : rdList(arr);
  const othersClause = others.length ? rdListOx(others) + " supply the rest" : "";
  /* a house on a lone reading says so, dated; a stopped house is dated by its
     first quiet month (gen-data's directionStoppedSince). Both share one
     sentence, closing the footer before the headline note */
  const sparseBits = others.filter((h) => counts[h] === 1).map((h) => {
    const row = topYM.find((d) => d.pollster === h);
    return h + " has supplied only one direction reading, in " + ymLong(row.ym);
  });
  const sinceGroups = new Map();
  inactive.forEach((h) => {
    const ym = (D.directionStoppedSince || {})[h];
    sinceGroups.set(ym, (sinceGroups.get(ym) || []).concat(h));
  });
  const inactiveBits = [...sinceGroups.entries()].map(([ym, hs]) =>
    rdList(hs) + (ym
      ? " became inactive in " + ymLong(ym)
      : (hs.length > 1 ? " have" : " has") + " stopped asking")
  );
  const tail = sparseBits.concat(inactiveBits).join("; ");
  const foot = top ? "Most readings are " + top + (top === "Roy Morgan" ? "’s weekly poll" : "’s") + ": " + counts[top] + " of the " + total + " since May 2025."
    + (othersClause ? " " + othersClause + "." : "")
    + (tail ? " " + tail + "." : "")
    + " The headline figures pool the latest polls, so they can differ a little from " + monthNow + "’s monthly average." : null;
  const asked = rdList(D.directionHouses || []);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";
  return (
    <RdSec id="direction" cls="rd-dir" title="National direction" meta={narrow ? question : question + (asked ? ", " + asked : "")}>
      <RdHed head={head} dek={dek} />
      <div className="rd-dir-figs">
        <div className="rd-dir-fig"><span className="rd-dir-v" style={{ color: "var(--mood-pos)" }}>{now.right.toFixed(1)}<span className="rd-dir-pct">%</span></span>
          <span className="rd-dir-k" style={{ color: "var(--mood-pos)" }}>Right direction</span></div>
        <div className="rd-dir-fig rd-r"><span className="rd-dir-v" style={{ color: "var(--mood-neg)" }}>{now.wrong.toFixed(1)}<span className="rd-dir-pct">%</span></span>
          <span className="rd-dir-k" style={{ color: "var(--mood-neg)" }}>Wrong track</span></div>
      </div>
      <div className="rd-dir-bar" role="img" aria-label={`Right direction ${now.right}%, unsure ${now.unsure}%, wrong track ${now.wrong}%`}>
        <span className="rd-dir-pos" style={{ flexBasis: now.right + "%" }}></span>
        <span className="rd-dir-uns" style={{ flexBasis: now.unsure + "%" }}><span>{now.unsure.toFixed(1)}% unsure</span></span>
        <span className="rd-dir-neg" style={{ flexBasis: now.wrong + "%" }}></span>
      </div>
      <p className="rd-dir-net"><b>Net {signedP(now.net)} points</b>
        {now.chg != null && <>, {rdArrow(now.chg)} {Math.abs(now.chg).toFixed(1)} on a month ago</>}</p>
      <div className="card rd-card rd-dir-chart">
        <div className="rd-chead"><span className="rd-chead-t">{narrow ? "Right direction and wrong track, %" : "Right direction and wrong track, % of voters, month by month"}</span></div>
        {narrow && <RdKey items={[{ kind: "line", color: "var(--mood-neg)", label: "Wrong track" }, { kind: "line", color: "var(--mood-pos)", label: "Right direction" }]} className="rd-tpp-legend" />}
        <TrendChart key="rd-dir" heightPx={narrow ? 280 : 360}
          padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
          xDomain={xDomain} yDomain={[lo, hi]} yTicks={rdYTicks(lo, hi, 10)} yTickFmt={(v) => (v === hi ? v + "%" : String(v))}
          xTicks={rdXTicks(xDomain[0], xDomain[1], narrow)} baseline
          series={[
            { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Wrong track" },
            { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Right direction" },
          ]}
          spine={series(pts, "right")} areas={areas} scatter={dots} pollFacet="direction"
          events={badges ? badges.events : evs} brackets={brackets}
          tooltipTitle={(i) => (pts[i] ? monthLabelFull(pts[i].ym) : "")}
          extraRows={(i) => { const d = pts[i]; return d && d.rightCi != null ? [{ label: "95% intervals", value: "±" + d.rightCi.toFixed(1) + ", ±" + d.wrongCi.toFixed(1) }] : []; }}
          fmt={(v) => v.toFixed(1)}
          copy={{ title: "National direction", sub: head, legend: [{ label: "Right direction", color: "var(--mood-pos)", kind: "line" }, { label: "Wrong track", color: "var(--mood-neg)", kind: "line" }] }}
        />
        {badges && <RdEventList list={badges.list} />}
        <RdKey className="rd-ckey" items={[
          { kind: "dot", color: "var(--ink-3)", label: "One poll" },
          { kind: "lineband", color: "var(--ink-3)", label: "Monthly average, adjusted for each pollster’s lean, and its 95% interval" },
        ]} />
      </div>
      <HowTo paras={[
        <>Each dot is one published reading; the lines are monthly averages, shaded with their 95% intervals.</>,
        <>The lines are adjusted for each pollster’s lean. Only {(D.directionHouses || []).length} pollsters ask this question, so some months rest on a single poll: the dots show which, and the shading shows what that costs in confidence.</>,
      ]} />
      <RdFoot how={{ term: "direction", from: "National direction" }}>{foot}</RdFoot>
    </RdSec>
  );
}
function rdList(arr) {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
}

/* ======================================================================
   Who votes for whom
   ====================================================================== */
const RD_DEMO_SHORT = {
  "18–34": "18–34s", "35–54": "35–54s", "55+": "over-55s", "Gen Z": "Gen Z", Millennials: "Millennials",
  "Gen X": "Gen X", Boomers: "Boomers", Men: "men", Women: "women",
  "Year 12 or less": "voters with Year 12 or less", "TAFE or trade": "TAFE- or trade-qualified voters", University: "university graduates",
  NSW: "NSW voters", Vic: "Victorians", Qld: "Queenslanders", "Rest of Australia": "voters in the other states",
  "Inner metro": "inner-suburban voters", "Outer metro": "outer-suburban voters", Provincial: "provincial voters", Rural: "rural voters",
  "Own outright": "outright owners", Mortgage: "mortgage holders", Renting: "renters",
  "English only": "English-only speakers", "Other language": "voters who speak another language at home",
};
/* one constant headline per switcher party, hand-curated against the pooled
   significances — every trait listed is a significant gap in the current
   pool, so refresh these by hand when the pool moves, as with RD_DEMO_SHORT */
const RD_DEMO_HOME = {
  onp: "One Nation voters are more likely to be 55+, TAFE- or trade-qualified, English-only-speaking, rural, and non-Victorian",
  alp: "Labor voters are more likely to be under 55, university-educated, and urban or provincial",
  lnp: "Coalition voters are more likely to be 55+, university-educated, inner-metro, and outright homeowners",
  grn: "Greens voters are more likely to be 18–34, women, renters, and urban or provincial",
  oth: "Voters for others/independents are more likely to be Gen Z, renting, and NSW-based, and less likely to be provincial or mortgage holders",
};
/* the state panels' titles, as the board wrote them */
const RD_STATE_NAME = { Vic: "Victoria", Qld: "Queensland" };
const RD_DEMO_NOUN = { age: "age", gender: "gender", education: "education" };
/* groups in order as one party colour's ramp, pale to dark (dark mode runs
   the other way, so the last group keeps the most contrast in both) */
const rdRamp = (party, n, i) => (n < 2 ? "var(--" + party + ")" : "var(--ramp-" + party + "-" + (1 + Math.round((i * 3) / (n - 1))) + ")");

function RdDemographics({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const T = D.demographics;
  const [tabId, setTab] = useState("age");
  const [party, setParty] = useState("onp");
  /* A party switch asks the same groups about another party, so it morphs:
     the dot plot's marks glide and their figures roll, and each group's line
     reshapes into its line for the new party (useMorph, as the issues and
     leadership charts do). A switch of GROUPING is different people, so
     nothing there is drawn as turning into anything: the dot plot's rows
     slide by place and the charts fade in. */
  const [partyMorph, chooseParty] = window.AP.useMorph(party, (v) => setParty(v), (a, b) => a !== b);
  /* each party's charts, built once per grouping and range: a switch
     re-renders every frame, and rebuilding both parties' lines and poll
     dots (a pass over every poll) on each one starved the dot plot's own
     motion of frames on a phone */
  const chartCache = React.useRef({});
  if (!T || !T.tabs || !T.tabs.length) return null;
  const tab = T.tabs.find((x) => x.id === tabId) || T.tabs[0];
  const P = D.PARTIES[party];
  /* the prose names them "others/independents" (user dictate): a lower-case
     description whose possessive takes a bare apostrophe */
  const pName = party === "oth" ? "others/independents" : P.name;
  const pPoss = pName + (/s$/.test(pName) ? "’" : "’s"), pColor = P.color;
  const all = T.all[party];
  const ki = T.order.indexOf(party), gpi = DEMO_GRP_PARTY.indexOf(party);
  const short = (g) => RD_DEMO_SHORT[g.label] || DEMO_WHO[g.label] || g.label;

  /* ---- the finding -------------------------------------------------------- */
  const st0 = tab.sets[0];
  const verdict = demoVerdict(st0, party) || "";
  const story = (() => {
    let finding;
    const m = /^Support for .* (rises|falls) significantly (.*)\.$/.exec(verdict);
    const noDiff = /no significant difference/.test(verdict);
    if (m && st0.id === "age") finding = pPoss + " vote " + (m[1] === "rises" ? "climbs" : "falls") + " with age";
    else if (m && st0.id === "generation") finding = pPoss + " vote " + (m[1] === "rises" ? "climbs" : "falls") + " with each older generation";
    else if (m && st0.id === "location") finding = pPoss + " vote " + (m[1] === "rises" ? "climbs" : "falls") + " with distance from the city";
    else if (noDiff) finding = pPoss + " vote is much the same across " + ((DEMO_SET_WORDS[st0.id] || {}).all || "these groups");
    else finding = verdict.replace(/ significantly/, "").replace(/\.$/, "");
    const gs = st0.groups.filter((g) => g.v[party] != null);
    const byV = gs.slice().sort((a, b) => b.v[party] - a.v[party]);
    const top = byV[0], bot = byV[byV.length - 1];
    /* when the polls can't split the groups, quote one fraction for the
       whole set: the rounded top/bottom contrast can draw a gap twice as
       wide as the real one (28.1 v 26.1 reads as three-in-ten v one-in-four) */
    const words = DEMO_SET_WORDS[st0.id] || {};
    const both = words.all === "men and women" || words.all === "owners and renters";
    let dek = noDiff
      ? rdCap(rdFraction(all)) + (both ? " " + words.all + " alike" : " of every " + (words.one || "group")) + " back " + pName + "."
      : top && bot && top !== bot
        ? rdCap(rdFraction(top.v[party])) + " " + short(top) + " back " + pName + ", against " + rdFraction(bot.v[party]) + " " + short(bot) + "."
        : "";
    const st1 = tab.sets[1];
    if (st1) {
      const out = st1.groups.filter((g) => g.v[party] != null)
        .map((g) => ({ g, d: g.v[party] - all, sig: Math.abs(g.v[party] - all) > (g.ci[party] || 0) }))
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      if (out && out.sig) dek += " " + rdCap(short(out.g)) + " " + (/s$/.test(short(out.g)) && !/^Gen/.test(out.g.label) ? "are" : "is") + " the outlier, at " + rdFraction(out.g.v[party]) + ".";
    }
    /* the headline stays put as the grouping tab flips: the per-grouping
       finding leads the dek instead, the figures sentences after it */
    const home = RD_DEMO_HOME[party];
    if (home) dek = dek ? rdCap(finding) + ". " + dek : rdCap(finding) + ".";
    return { head: home || rdCap(finding), dek };
  })();

  /* ---- the dot plot, every set on one scale -------------------------------- */
  const vals = tab.sets.flatMap((st) => st.groups.flatMap((g) => [g.v[party] + (g.ci[party] || 0), g.v[party] - (g.ci[party] || 0)])).concat([all]);
  const hi = Math.max(10, Math.ceil(Math.max(...vals) / 10) * 10);
  const xp = (v) => (Math.max(0, Math.min(hi, v)) / hi) * 100;
  const signedD = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const dotSet = (st, idx) => (
    <div className="rd-wv-set" key={"s" + idx} role="table" aria-label={(st.label || tab.label) + ": " + pPoss + " share of each group’s vote"}>
      <div className="rd-wv-sethead" role="row">
        <span role="columnheader"><b>{st.label || "By " + tab.label.toLowerCase()}</b> <span>{rdList((st.houses || []).map(demoHouse))}</span></span>
        <span className="rd-wv-allcap" aria-hidden="true">{idx === 0 && <span style={{ "--x": xp(all) }}>All voters <RollNum value={all.toFixed(1)} />%</span>}</span>
        <span className="rd-wv-vs" role="columnheader">{idx === 0 ? "vs all voters" : ""}</span>
      </div>
      {st.groups.map((g, gi) => {
        const v = g.v[party], ci = g.ci[party] || 0, d = v - all, sig = Math.abs(d) > ci;
        return (
          <div key={"r" + gi} className="rd-wv-row" role="row"
               title={"Pooled from " + g.n + " poll" + (g.n === 1 ? "" : "s") + ", " + rdList((g.houses || []).map(demoHouse)) + ", ± is the 95% margin"}>
            <span role="cell" className="rd-wv-lab">{g.label}</span>
            <span className="rd-wv-track" aria-hidden="true">
              {/* positions go to CSS as --x/--lo/--hi (percent of the track)
                  and are drawn with transforms, so a switch glides them on
                  the compositor however busy the page's own frames are */}
              <span className="rd-wv-all" style={{ "--x": xp(all) }}></span>
              <span className="rd-wv-ci" style={{ "--lo": xp(v - ci), "--hi": xp(v + ci), color: pColor }}><i className="lo"></i><i className="hi"></i><b></b></span>
              <span className={"rd-wv-dot" + (sig ? "" : " open")} style={{ "--x": xp(v), background: sig ? pColor : undefined, borderColor: pColor }}></span>
            </span>
            <span role="cell" className="rd-wv-v"><b><RollNum value={v.toFixed(1)} />%</b> <span>±<RollNum value={ci.toFixed(1)} /></span></span>
            <span role="cell" className={"rd-wv-d" + (sig ? " sig" : "")} style={sig ? { color: inkOf(pColor) } : undefined}><RollNum value={signedD(d)} /></span>
          </div>
        );
      })}
    </div>
  );
  const axis = (
    <div className="rd-wv-axis" aria-hidden="true">
      <span></span>
      <span className="rd-wv-ticks">{rdYTicks(0, hi, 10).map((v) => <span key={v} style={{ "--x": xp(v) }}>{v}%</span>)}</span>
      <span></span><span></span>
    </div>
  );

  /* ---- the groups month by month, in points -------------------------------- */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const chartsFor = (pty) => {
    const ki = T.order.indexOf(pty), gpi = DEMO_GRP_PARTY.indexOf(pty);
    const allAt = new Map(T.allMonthly.map((m) => [m[0], m[1 + ki]]));
    const setLines = (st) => st.groups.map((g, i) => ({
      g, color: rdRamp(pty, st.groups.length, i),
      pts: (g.monthly || []).filter((m) => m[1 + ki] != null)
        .map((m) => ({ ym: m[0], x: D.mx(m[0]), y: m[1 + ki], ci: m[1 + T.order.length + ki] ?? null })),
    })).filter((l) => l.pts.length);
    return tab.sets.map((st) => {
      const lines = setLines(st);
      if (!lines.length) return null;
      const firstX = Math.min(...lines.map((l) => l.pts[0].x));
      const x0 = Math.max(rangeLo, firstX - 0.06), x1 = rangeHi;
      const drawn = lines.map((l) => ({ ...l, pts: filterPts(l.pts, x0) }));
      const allPts = filterPts(T.allMonthly.map((m) => ({ ym: m[0], x: D.mx(m[0]), y: m[1 + ki] })).filter((d) => d.x >= firstX - 0.01), x0);
      const dots = D.individualPolls.filter((q) => q.grp && q.grp.t && q.x >= x0 && q.x <= x1).flatMap((q) => drawn.map((l) => {
        const v = q.grp.v[D.demoGroups.indexOf(l.g.label)];
        const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
        const base = allAt.get(q.ym);
        return sum > 0 && q.grp.t[gpi] > 0 && base != null
          ? { x: q.x, y: +(base + (100 * v[gpi] / sum - q.grp.t[gpi])).toFixed(1), color: l.color, label: l.g.label, meta: q } : null;
      }).filter(Boolean));
      return { st, drawn, allPts, dots, x0, x1, span: x1 - x0 };
    }).filter(Boolean);
  };
  const yMaxOf = (cs) => Math.max(10, Math.ceil(Math.max(...cs.flatMap((c) => c.drawn.flatMap((l) => l.pts.map((p) => p.y + (p.ci || 0))).concat(c.dots.map((d) => d.y)))) / 10) * 10);
  const chartsCached = (pty) => {
    const k = pty + "|" + tab.id + "|" + rangeLo + "|" + rangeHi;
    return chartCache.current[k] || (chartCache.current[k] = chartsFor(pty));
  };
  const charts = chartsCached(party);
  const yMax = yMaxOf(charts);
  /* mid-switch: the party left behind, its charts and scale, to blend from */
  const pm = partyMorph && partyMorph.from !== party ? partyMorph : null;
  const fromCharts = pm ? chartsCached(pm.from) : null;
  const fromYMax = fromCharts ? yMaxOf(fromCharts) : yMax;
  /* the points gap between the first set's top and bottom groups, then and now */
  const sub = (() => {
    const c = charts[0];
    if (!c || c.drawn.length < 2) return null;
    /* "now" is each group's pooled figure, the one its row above quotes, so
       the gap these words give is the gap a reader can take off the rows (the
       lines' last month said "about 18" beside rows of 34.0 and 17.1) */
    const nowOf = (e) => (e.l.g.v && e.l.g.v[party] != null ? e.l.g.v[party] : e.last.y);
    const ends = c.drawn.map((l) => ({ l, first: l.pts[0], last: l.pts[l.pts.length - 1] }));
    const byNow = ends.slice().sort((a, b) => nowOf(b) - nowOf(a));
    const hiL = byNow[0], loL = byNow[byNow.length - 1];
    const firstYm = [hiL.first.ym, loL.first.ym].sort().pop();
    const fHi = hiL.l.pts.find((p) => p.ym === firstYm), fLo = loL.l.pts.find((p) => p.ym === firstYm);
    if (!fHi || !fLo) return null;
    const gap0 = fHi.y - fLo.y, gap1 = nowOf(hiL) - nowOf(loL);
    const pts = (g) => Math.abs(Math.round(g)) + (Math.abs(Math.round(g)) === 1 ? " point" : " points");
    const noun = RD_DEMO_NOUN[tab.id];
    const grew = (allPts) => allPts.length > 1 && allPts[allPts.length - 1].y - allPts[0].y >= 3;
    const pGrew = grew(c.allPts);
    /* a gap that has changed sides has reversed, not grown: the group ahead
       now was behind then. (The one ahead now can't be behind by more than
       it leads, so a reversal only ever shows as a signed widening.) */
    const move = gap1 - gap0 >= 4 ? (Math.round(gap0) < 0 ? "reversed" : "widened") : gap0 - gap1 >= 4 ? "narrowed" : "held steady";
    const head = (noun ? "The " + noun + " gap" : "The gap between " + short(hiL.l.g) + " and " + short(loL.l.g)) + " has " + move
      + (move === "widened" && pGrew ? " as " + pName + " has grown" : "");
    const trend = demoTrendVerdict(D, c.st, party, (x) => x >= c.x0 && x <= c.x1);
    /* a sentence before this one that already named the gap (two groups) is
       followed by "it", not the same seven words again */
    const theGap = trend && /the gap between /i.test(trend) ? "it" : "the gap between " + short(hiL.l.g) + " and " + short(loL.l.g);
    const dek = (trend ? trend + " " : "") + (move === "held steady" ? "In percentage points " + theGap + " has stayed near " + Math.round(gap1) + "."
      : move === "reversed"
        ? "In percentage points, though, " + short(hiL.l.g) + " were about " + pts(gap0) + " less likely than " + short(loL.l.g) + " to back " + DEMO_VOTE_FOR[party]
          + " in " + rdMonthYear(firstYm) + "; now they are about " + pts(gap1) + " more likely."
        : "In percentage points, though, " + theGap + " has " + (move === "widened" ? "grown" : "shrunk")
          + " from about " + pts(gap0) + " in " + rdMonthYear(firstYm) + " to about " + Math.round(gap1) + " now.");
    return { head, dek };
  })();
  /* Place draws its states as the board drew them: a small panel each, the
     state's line inside its 95% interval against the dashed all-voters line.
     Four states on one plot, each banded, were one brown cloud. The panels
     then share the row evenly with the location chart. */
  const panelled = (c) => c.st.id === "state";
  const even = charts.some(panelled);
  const chartOf = (c) => {
    const A = fromCharts && fromCharts.find((x) => x.st.id === c.st.id);
    const t = pm ? pm.t : 1;
    const blend = (a, b) => (A && a && b && a.length && b.length ? window.AP.blendRows(a, b, t, ["y", "ci"]) : null);
    const allBl = A ? blend(A.allPts, c.allPts) : null;
    const allSeries = { id: "all", label: "All voters", color: "var(--ink)", dash: "4 3", dashed: true, rdWidth: 1.5, endCap: false, clipX: allBl ? allBl.clip : undefined,
                        points: (allBl ? allBl.rows : c.allPts).filter((d) => d.y != null).map((d) => ({ x: d.x, y: d.y })), endLabel: narrow ? null : "All voters" };
    /* each group's rows, blended mid-switch; its interval travels with it */
    const rowsOf = c.drawn.map((l) => {
      const la = A && A.drawn.find((x) => x.g.label === l.g.label);
      const bl = la ? blend(la.pts, l.pts) : null;
      return { l, la, clip: bl ? bl.clip : undefined, ciClip: bl ? bl.clips.ci : undefined, rows: (bl ? bl.rows : l.pts).filter((d) => d.y != null) };
    });
    /* A group's colour travels to the new party's round the hue circle on
       the switch's own clock (the lines no longer ease their stroke in CSS,
       which every re-mixed frame restarted and which snapped at the end). */
    const mixC = window.AP.mixC;
    const colorOf = (r) => (A && r.la ? mixC(r.la.color, r.l.color, t) : r.l.color);
    const pColorNow = pm ? mixC(D.PARTIES[pm.from].color, pColor, t) : pColor;
    const lineOf = (r, color, over) => ({ id: r.l.g.label, label: r.l.g.label, color, rdWidth: 2.2, endCap: false,
      clipX: r.clip, points: r.rows.map((d) => ({ x: d.x, y: d.y })), endLabel: r.l.g.label, ...over });
    /* a month rests on a few hundred of a group's respondents, so its band
       is what says whether two groups, or two months, can be told apart;
       mid-switch it is drawn from the blend's own edges (see blendRows) */
    const bandOf = (r, color) => ({ id: "ci-" + r.l.g.label, color, className: "ci-band", edge: false, clipX: r.ciClip || r.clip,
      points: r.rows.some((d) => d.ciHi != null)
        ? r.rows.filter((d) => d.ciHi != null && d.ciLo != null).map((d) => ({ x: d.x, y0: Math.max(0, d.ciLo), y1: d.ciHi }))
        : r.rows.filter((d) => d.ci != null).map((d) => ({ x: d.x, y0: Math.max(0, d.y - d.ci), y1: d.y + d.ci })) });
    const ciRows = (rs, label) => (i) => {
      const ym = c.allPts[i] && c.allPts[i].ym;
      const cs = rs.map((r) => { const d = r.l.pts.find((q) => q.ym === ym); return d && d.ci != null ? (rs.length > 1 ? r.l.g.label + " " : "") + "±" + d.ci.toFixed(1) : null; }).filter(Boolean);
      return cs.length ? [{ label: label, value: cs.join(", ") }] : [];
    };
    const cross = A ? window.AP.crossClouds(A.dots, c.dots, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label) : null;
    const xDom = A ? window.AP.blendDomain([A.x0, A.x1], [c.x0, c.x1], t) : [c.x0, c.x1];
    const yDom = A ? window.AP.blendDomain([0, fromYMax], [0, yMax], t) : [0, yMax];
    const head = (
      <div className="rd-chead"><span className="rd-chead-t">{c.st.label || "By " + tab.label.toLowerCase()}<span className="rd-chead-meta">since {rdMonthYear(c.drawn.reduce((m, l) => (l.pts[0].ym < m ? l.pts[0].ym : m), "9999"))}</span></span></div>
    );
    if (panelled(c)) {
      const mine = (arr, label) => (arr || []).filter((d) => d.label === label).map((d) => ({ ...d, color: pColorNow }));
      return (
        <div className="card rd-card rd-wv-chart" key={c.st.id} style={{ flex: "1 1 0" }}>
          {head}
          <div className="rd-wv-panels">
            {rowsOf.map((r) => {
              const g = r.l.g, name = RD_STATE_NAME[g.label] || g.label;
              return (
                <div key={g.label} className="rd-sm rd-wv-panel">
                  <div className="rd-sm-top"><span>{name}</span><b>{g.v[party] != null ? g.v[party].toFixed(1) + "%" : ""}</b></div>
                  <TrendChart key={"rd-wv-" + c.st.id + "-" + g.label} heightPx={narrow ? 120 : 140}
                    padPx={{ l: 30, r: 6, t: 8, b: 24 }}
                    xDomain={xDom} yDomain={yDom} yTicks={rdYTicks(0, yMax, 20)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
                    xTicks={rdXTicks(c.x0, c.x1, true)} baseline driven={!!A}
                    series={[{ ...allSeries, rdWidth: 1.25, endLabel: null }, lineOf(r, pColorNow, { rdWidth: 2.25, endLabel: null })]}
                    areas={[bandOf(r, pColorNow)].filter((a) => a.points.length >= 2)}
                    spine={c.allPts.map((d) => ({ x: d.x, y: d.y }))}
                    scatter={mine(cross ? cross.scatter : c.dots, g.label)} scatterOut={mine(cross ? cross.scatterOut : [], g.label)}
                    scatterMove={mine(cross ? cross.scatterMove : [], g.label)}
                    fade={A ? t : 1} pollFacet="primary"
                    tooltipTitle={(i) => (c.allPts[i] ? monthLabelFull(c.allPts[i].ym) : "")}
                    extraRows={ciRows([r], "95% interval")}
                    fmt={(v) => v.toFixed(1)}
                    copy={{ title: "Who votes for whom", sub: pPoss + " share of the vote in " + name + ", month by month",
                            legend: [{ label: name, color: pColor, kind: "line" }, { label: "95% interval", color: pColor, kind: "band" }, { label: "All voters", color: "var(--ink)", kind: "dashed" }] }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
    <div className="card rd-card rd-wv-chart" key={c.st.id} style={even ? { flex: "1 1 0" } : { flexGrow: narrow ? 1 : Math.max(0.35, c.span) }}>
      {head}
      <TrendChart key={"rd-wv-" + c.st.id + "-" + tab.id} heightPx={narrow ? 240 : 260}
        padPx={narrow ? { l: 34, r: 8, t: 12, b: 28 } : { l: 40, r: 12, t: 12, b: 30 }}
        xDomain={xDom} yDomain={yDom} yTicks={rdYTicks(0, yMax, 10)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
        xTicks={rdXTicks(c.x0, c.x1, narrow || c.span < 0.8)} baseline driven={!!A}
        series={[allSeries, ...rowsOf.map((r) => lineOf(r, colorOf(r)))]}
        areas={rowsOf.map((r) => bandOf(r, colorOf(r))).filter((a) => a.points.length >= 2)}
        spine={c.allPts.map((d) => ({ x: d.x, y: d.y }))}
        scatter={cross ? cross.scatter : c.dots} scatterOut={cross ? cross.scatterOut : []} scatterMove={cross ? cross.scatterMove : []}
        fade={A ? t : 1} pollFacet="primary"
        tooltipTitle={(i) => (c.allPts[i] ? monthLabelFull(c.allPts[i].ym) : "")}
        extraRows={ciRows(rowsOf, "95% intervals")}
        fmt={(v) => v.toFixed(1)}
        /* keyed in full: a phone names no line at its end, and "All voters"
           loses its name wherever the groups crowd it */
        copy={{ title: "Who votes for whom", sub: pPoss + " share of the vote, " + (c.st.label || "By " + tab.label).toLowerCase() + ", month by month",
                legend: c.drawn.map((l) => ({ label: l.g.label, color: l.color, kind: "line" }))
                  .concat([{ label: "95% interval", color: pColor, kind: "band" }, { label: "All voters", color: "var(--ink)", kind: "dashed" }]) }}
      />
    </div>
    );
  };

  return (
    <RdSec id="who-votes" cls="rd-wv" title="Who votes for whom" meta={"Pooled from the last " + T.window + " of " + rdList(T.houses.map(demoHouse)) + " polls"}>
      <RdHed head={story.head} dek={story.dek} />
      <RdTabs swipe value={tab.id} onChange={setTab} options={T.tabs.map((x) => ({ id: x.id, label: x.label }))} ariaLabel="Group voters by" className="rd-wv-tabs">
        {!narrow && (
          <span className="rd-chips" role="group" aria-label="Party">
            {DEMO_PARTIES.map((pp) => (
              <button key={pp.id} type="button" className="rd-chip" aria-pressed={party === pp.id} onClick={() => chooseParty(pp.id)}
                      style={party === pp.id ? { background: "var(--tint-" + pp.id + ")", borderColor: D.PARTIES[pp.id].color } : undefined}>
                <span className="rd-sw" style={{ background: D.PARTIES[pp.id].color }}></span>{pp.label}</button>
            ))}
          </span>
        )}
      </RdTabs>
      {narrow && (
        <div className="rd-chips rd-chips-row" role="group" aria-label="Party">
          {DEMO_PARTIES.map((pp) => (
            <button key={pp.id} type="button" className="rd-chip" aria-pressed={party === pp.id} onClick={() => chooseParty(pp.id)}
                    style={party === pp.id ? { background: "var(--tint-" + pp.id + ")", borderColor: D.PARTIES[pp.id].color } : undefined}>
              <span className="rd-sw" style={{ background: D.PARTIES[pp.id].color }}></span>{pp.label}</button>
          ))}
        </div>
      )}
      <div className="card rd-card rd-wv-dots">
        <div className="rd-wv-plot">
          {tab.sets.map((st, i) => dotSet(st, i))}
          {axis}
          {/* one all-voters line from its label to the axis, through every set,
              as the board draws it; a phone keeps it to each row's track */}
          <div className="rd-wv-allline" aria-hidden="true"><span><i style={{ "--x": xp(all) }}></i></span></div>
        </div>
        <RdKey className="rd-ckey rd-wv-key" items={[
          { kind: "dot-solid", color: pColor, label: "Clearly above or below all voters" },
          { kind: "dot-open", color: pColor, label: "Within the margin" },
          { kind: "whisker", color: pColor, label: "95% interval" },
        ]}><span className="rd-key-item rd-wv-keytxt">Right-hand column: difference from all voters, in points</span></RdKey>
      </div>
      {sub && <RdSub head={sub.head} dek={sub.dek} />}
      {/* keyed on the grouping: a switch of it brings the charts in fresh,
          faded rather than cut (a party switch keeps them and morphs) */}
      <div className="rd-wv-charts rd-wv-enter" key={"wv-" + tab.id}>{charts.map(chartOf)}</div>
      <RdKey className="rd-ckey rd-sm-key" items={[
        { kind: "dot", color: "var(--ink-3)", label: "One poll" },
        { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
        { kind: "dash", color: "var(--ink)", label: "All voters" },
      ]} />
      <RdFoot how={{ term: "vote-by-group", from: "Who votes for whom" }}>
        {charts.length > 1 ? (even ? "Every panel shares one scale." : "Both panels share one scale, so each is only as wide as its data.") : null}
      </RdFoot>
    </RdSec>
  );
}

/* ======================================================================
   Where One Nation's voters came from
   ====================================================================== */
/* a container's width, kept current: for drawings laid out in pixels */
function useRdWidth(ref, fallback) {
  const [w, setW] = React.useState(fallback || 800);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setW(el.getBoundingClientRect().width || fallback || 800);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function RdSwitching({ rangeId }) {
  const { D, rangeDomain, filterPts } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const S = D.onSources;
  const boxRef = React.useRef(null);
  const W = useRdWidth(boxRef, 1152);
  if (!S || !S.series.length || !S.series.every((sr) => sr.rate)) return null;
  const Wt = S.weights || {};
  const byId = {};
  S.series.forEach((sr) => { byId[sr.id] = sr; });
  const NAME = { lnp: "Coalition", alp: "Labor", oth: "Others", grn: "Greens" };
  const LONG = { lnp: "Coalition voters", alp: "Labor voters", oth: "Others & independents", grn: "Greens voters" };
  /* One Nation's own 2025 voters: the share still backing it, pooled over
     the same polls as the rates */
  const recent = (S.waves || []).slice(-(S.now && S.now.n ? S.now.n : 5));
  const keptPct = recent.length ? recent.reduce((s, w) => s + w.keptPct * (w.sample || 1), 0) / recent.reduce((s, w) => s + (w.sample || 1), 0) : null;
  const cols = ["lnp", "alp", "oth", "grn"].filter((id) => byId[id]).map((id) => {
    const sr = byId[id];
    const w = id === "oth" ? (Wt.oth || 0) + (Wt.ind || 0) : Wt[id];
    return { id, sr, w, rate: sr.rate.now.v, rateCi: sr.rate.now.ci95, gain: sr.now.v, gainCi: sr.now.ci95, pts: sr.now.pts,
             color: sr.color, tint: "var(--tint-" + id + ")", ink: inkOf(sr.color) };
  });
  const onpW = Wt.onp || 0;
  const keptPts = keptPct != null ? keptPct * onpW / 100 : null;
  const gained = cols.reduce((s, c) => s + (c.pts || 0), 0);
  const onNow = D.latest.primary.onp;

  /* ---- the finding ---------------------------------------------------------- */
  const top = cols.slice().sort((a, b) => b.gain - a.gain)[0];
  const lnp = cols.find((c) => c.id === "lnp"), alp = cols.find((c) => c.id === "alp");
  const head = top ? rdCap(rdFraction(top.gain)) + " of One Nation’s new voters backed " + (top.id === "lnp" ? "the Coalition" : top.id === "alp" ? "Labor" : top.id === "grn" ? "the Greens" : "another party") + " in 2025" : null;
  /* Curated wording (user's, 2026-09-28) with every figure LINKED to the
     pooled rates: parties follow whichever of lnp/alp is higher, share via
     plainShare, ratio rounded to the nearest quarter. */
  const hiC = lnp && alp ? (lnp.rate >= alp.rate ? lnp : alp) : null;
  const loC = hiC ? (hiC === lnp ? alp : lnp) : null;
  const nm = (c) => (c.id === "lnp" ? "Coalition" : "Labor");
  const dek = (!hiC || !loC) ? null
    : nm(hiC) + " voters have flocked to One Nation at about " + (Math.round(hiC.rate / loC.rate * 4) / 4) + " times the rate of " + nm(loC) + " voters. "
    + plainShare(hiC.rate) + " 2025 " + nm(hiC) + " voters now say they’d vote for One Nation.";

  /* ---- the rates, month by month -------------------------------------------- */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const firstX = Math.min(...cols.map((c) => c.sr.rate.monthly[0].x));
  /* the window opens about a month before the first average, as the canvas
     drew it, so the first reading clears the "25%" and "50%" set on the plot */
  const x0 = Math.max(rangeLo, firstX - 0.075), x1 = rangeHi;
  const pollRate = (id) => (S.waves || []).map((w) => {
    const v = w.toOn ? w.toOn[id] : null;
    return v == null ? null : { x: D.mx(w.date.slice(0, 7)) + ((+w.date.slice(8, 10) - 15) / 365), y: v, h: w.pollster, w: w.sample || 1000, meta: { pollster: w.pollster, released: w.date, dateLabel: w.dateStart ? "" : "", sample: w.sample } };
  }).filter(Boolean);
  const fits = cols.map((c) => ({ c, fit: withinHouseSlope(pollRate(c.id).map((d) => ({ h: d.h, t: d.x, w: d.w, y: d.y }))) })).filter((f) => f.fit);
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  const firstYm = cols[0].sr.rate.monthly[0].ym;
  const sinceM = D.monthNameFull(Number(firstYm.slice(5)));
  /* the rates that moved, tested within each pollster, the rest said to hold */
  const subHead = !sig.length ? "The rates have held since " + sinceM
    : sig.length === cols.length ? "Every party’s rate has " + (sig.every((f) => f.fit.b > 0) ? "risen" : sig.every((f) => f.fit.b < 0) ? "fallen" : "moved") + " since " + sinceM
    : "The rates have held since " + sinceM + ", except for " + rdList(sig.map((f) => NAME[f.c.id])) + " voters, whose "
      + (sig.length > 1 ? "rates have" : "rate has") + " " + (sig.every((f) => f.fit.b < 0) ? "fallen" : sig.every((f) => f.fit.b > 0) ? "risen" : "moved");
  const ks = cols.flatMap((c) => c.sr.rate.monthly.map((m) => m.k)).filter((k) => k != null);
  const kLo = Math.min(...ks), kHi = Math.max(...ks);
  const subDek = "Share of each party’s 2025 voters now backing One Nation: each dot is one poll, and the lines are monthly averages, shaded by their 95% interval. "
    + "A month rests on " + (kLo === kHi ? rdNumWord(kLo) : rdNumWord(kLo) + " to " + rdNumWord(kHi)) + " polls, so a move that stays inside the band is noise.";
  const monthsIn = D.MONTHS.filter((ym) => D.mx(ym) >= x0 && D.mx(ym) <= x1 + 0.01);
  const smTicks = monthsIn.length ? [monthsIn[0], monthsIn[Math.floor((monthsIn.length - 1) / 2)], monthsIn[monthsIn.length - 1]]
    .filter((v, i, a) => a.indexOf(v) === i).map((ym) => ({ x: D.mx(ym), label: D.monthName(Number(ym.slice(5))) })) : [];
  /* the scale clears the polls and the tops of the monthly bands */
  const smTop = Math.max(50, Math.ceil(Math.max(...cols.flatMap((c) => pollRate(c.id).map((d) => d.y)
    .concat(c.sr.rate.monthly.map((m) => m.v + (m.ci95 || 0))))) / 25) * 25);

  /* ---- the mosaic ------------------------------------------------------------ */
  const GAP = 4, H = narrow ? 0 : 240;
  const all = cols.concat(onpW ? [{ id: "onp", w: onpW, rate: keptPct, kept: true, color: "var(--onp-deep)", tint: "var(--line-2)", ink: "var(--onp-text)" }] : []);
  const totW = all.reduce((s, c) => s + c.w, 0);
  const usable = W - GAP * (all.length - 1);
  let acc = 0;
  const geo = all.map((c) => { const x = acc, w = (c.w / totW) * usable; acc += w + GAP; return { ...c, x, cw: w }; });
  const fmt1 = (v) => v.toFixed(1);
  /* the column labels, each at the longest wording that clears its
     neighbour: a laptop's One Nation column is too narrow for its name */
  const labOpts = geo.map((c, i) => ({
    nm: c.kept ? ["One Nation", "ON"] : [NAME[c.id]],
    sz: [fmt1(c.w) + "%" + (c.id === "lnp" || c.id === "alp" ? " of 2025 voters" : c.id === "oth" ? ", incl. independents" : ""), fmt1(c.w) + "%"],
    pts: c.kept ? ["≈ " + fmt1(keptPts)] : ["≈ " + fmt1(c.pts) + " points", "≈ " + fmt1(c.pts)],
    sh: c.kept ? ["kept"] : [Math.round(c.gain) + "% ±" + fmt1(c.gainCi) + (i === 0 ? " of One Nation’s gain" : i === 1 ? " of the gain" : ""),
                            Math.round(c.gain) + "% ±" + fmt1(c.gainCi), Math.round(c.gain) + "%"],
  }));
  const lab = {};
  [["nm", 15, 600], ["sz", 12, 400], ["pts", 15, 600], ["sh", 12, 400]].forEach(([key, size, wt]) => {
    const k = geo.map(() => 0);
    const ext = (i) => {
      const w = textWidth(labOpts[i][key][k[i]], size, wt);
      const last = i === geo.length - 1;
      const x = last ? geo[i].x + geo[i].cw : geo[i].x;
      return last ? [x - w, x] : [x, x + w];
    };
    for (let i = 0; i < geo.length - 1; i++) {
      for (let guard = 0; guard < 6 && ext(i)[1] + 10 > ext(i + 1)[0]; guard++) {
        if (k[i] < labOpts[i][key].length - 1) k[i]++;
        else if (k[i + 1] < labOpts[i + 1][key].length - 1) k[i + 1]++;
        else break;
      }
    }
    lab[key] = k.map((j, i) => labOpts[i][key][j]);
  });
  const mosaic = !narrow ? (
    <svg className="rd-mo" width={W} height={H + 110} viewBox={`0 0 ${W} ${H + 110}`} role="img"
         aria-label={"Each 2025 party’s voters as a column sized by its 2025 vote, filled by the share now backing One Nation. "
           + cols.map((c) => NAME[c.id] + " " + fmt1(c.rate) + "%").join(", ") + (keptPct != null ? "; One Nation kept " + Math.round(keptPct) + "% of its own." : ".")}>
      {geo.map((c, i) => {
        const last = i === geo.length - 1;
        const tx = last ? c.x + c.cw : c.x, anchor = last ? "end" : "start";
        const fillH = (c.rate / 100) * H;
        return (
          <g key={c.id}>
            <text className="rd-mo-nm" x={tx} y={16} textAnchor={anchor} style={{ fill: c.ink }}>{lab.nm[i]}</text>
            <text className="rd-mo-sz" x={tx} y={35} textAnchor={anchor}>{lab.sz[i]}</text>
            <rect x={c.x} y={48} width={c.cw} height={H} style={{ fill: c.tint }} />
            <rect className="rd-mo-fill" x={c.x} y={48 + H - fillH} width={c.cw} height={fillH} style={{ fill: c.kept ? "var(--onp-deep)" : "var(--onp)" }} />
            {i === 0 && <text className="rd-mo-sz" x={c.x + 12} y={48 + 22} style={{ fill: c.ink }}>Stayed or went elsewhere</text>}
            {c.kept ? (() => {
              /* a tablet's One Nation column is barely wider than "94%": set
                 in from its edge, the figure ran off the drawing - centred there */
              const fit = c.cw >= textWidth(Math.round(c.rate) + "%", 15, 600) + 20;
              const kx = fit ? c.x + 10 : c.x + c.cw / 2, ka = fit ? "start" : "middle";
              return (
                <>
                  <text className="rd-mo-rates" x={kx} y={48 + H - fillH + 24} textAnchor={ka} style={{ fill: "var(--bg)" }}>{Math.round(c.rate)}%</text>
                  <text className="rd-mo-sz" x={kx} y={48 + H - fillH + 40} textAnchor={ka} style={{ fill: "var(--bg)" }}>kept</text>
                </>
              );
            })() : i === 0 ? (
              <>
                <text className="rd-mo-rate" x={c.x + 14} y={48 + H - fillH + 30}>{fmt1(c.rate)}%</text>
                <text className="rd-mo-sz rd-mo-onfill" x={c.x + 14} y={48 + H - fillH + 48}>now back One Nation</text>
              </>
            ) : (
              <text className="rd-mo-rates" x={c.x + 14} y={fillH >= 22 ? 48 + H - fillH + 20 : 48 + H - fillH - 8}
                    style={fillH >= 22 ? undefined : { fill: "var(--onp-text)" }}>{fmt1(c.rate)}%</text>
            )}
            <text className="rd-mo-pts" x={tx} y={48 + H + 28} textAnchor={anchor}>{lab.pts[i]}</text>
            <text className="rd-mo-sh" x={tx} y={48 + H + 47} textAnchor={anchor}>{lab.sh[i]}</text>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={48 + H} y2={48 + H} className="rd-mo-base" />
    </svg>
  ) : (
    <div className="rd-mo-rows">
      {/* the parties named as the canvas named them, and the first bar
          spelling out what its two parts are, as the laptop's mosaic does */}
      {all.map((c, i) => (
        <div key={c.id} className="rd-mo-row">
          <div className="rd-mo-rtop"><b style={{ color: c.ink }}>{c.kept ? "One Nation" : c.id === "oth" ? "Others & independents" : NAME[c.id]}</b><b>≈ {fmt1(c.kept ? keptPts : c.pts)} pts</b></div>
          <div className="rd-mo-rsub"><span>{fmt1(c.w)}% of 2025 voters</span><span>{c.kept ? Math.round(c.rate) + "% still back it" : Math.round(c.gain) + "% ±" + fmt1(c.gainCi) + " of the gain"}</span></div>
          <div className="rd-mo-rbar" style={{ height: Math.max(16, c.w * 2.6), background: c.tint }}>
            <span style={{ width: c.rate + "%", background: c.kept ? "var(--onp-deep)" : "var(--onp)" }}></span>
            {!c.kept && i === 0 ? (
              <em className="rd-mo-first" style={{ left: "calc(" + c.rate + "% + 8px)" }}>
                <span className="rd-mo-big">{fmt1(c.rate)}%</span><span className="rd-mo-nb">now back One Nation</span></em>
            ) : !c.kept && <em style={{ left: "calc(" + c.rate + "% + 8px)" }}>{fmt1(c.rate)}%</em>}
            {!c.kept && i === 0 && <i className="rd-mo-else" style={{ color: c.ink }}>Stayed or went elsewhere</i>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <RdSec id="switching" cls="rd-sw" title="Where One Nation’s voters came from"
           meta={"How 2025 voters say they’d vote now, " + rdList(S.houses || []) + ", last " + (S.now ? S.now.window : "six weeks")}>
      {head && <RdHed head={head} dek={dek} />}
      <div className="card rd-card rd-mo-wrap" ref={boxRef}>
        {mosaic}
        <p className="rd-note rd-mo-note">Points are shares of all voters. About {Math.round(gained)} gained from other parties{keptPts != null ? ", plus " + Math.round(keptPts) + " kept," : ""} add up to {Math.round(gained + (keptPts || 0))} of One Nation’s {onNow.toFixed(1)} points today.</p>
        <div className="rd-key rd-mo-key">
          <span className="rd-key-item"><RdSwatch kind="square" color="var(--onp)" />Switched to One Nation</span>
          <span className="rd-key-item"><RdSwatch kind="square" color="var(--onp-deep)" />Already One Nation in 2025</span>
          {!narrow && <span className="rd-key-item rd-mo-howread">Width: share of the 2025 vote, Height: share now backing One Nation, Area: voters gained</span>}
        </div>
        {narrow && <p className="rd-note">Bar height: that party’s share of the 2025 vote. Filled width: share now backing One Nation. Filled area: voters One Nation gained.</p>}
      </div>
      <RdSub head={subHead} dek={subDek} />
      <div className="rd-sm-grid">
        {cols.map((c) => {
          const pts = filterPts(c.sr.rate.monthly, x0).map((m) => ({ x: m.x, y: m.v, ym: m.ym, ci: m.ci95 }));
          /* each month inside its 95% interval: a month rests on two to four
             polls, and a party on its share of each, so the band is what
             tells a one-month jump from a move */
          const band = pts.filter((p) => p.ci != null).map((p) => ({ x: p.x, y0: Math.max(0, p.y - p.ci), y1: p.y + p.ci }));
          const dots = pollRate(c.id).filter((d) => d.x >= x0 && d.x <= x1 + 0.02).map((d) => ({ x: d.x, y: d.y, color: c.color, label: LONG[c.id], meta: d.meta }));
          return (
            <div key={c.id} className="card rd-card rd-sm">
              <div className="rd-sm-top"><span style={{ color: c.ink }}>{narrow ? NAME[c.id] : LONG[c.id]}</span><b>{fmt1(c.rate)}%</b></div>
              <TrendChart key={"rd-sm-" + c.id} heightPx={narrow ? 120 : 150} padPx={{ l: 4, r: 4, t: 18, b: 24 }}
                xDomain={[x0, x1]} yDomain={[0, smTop]} yTicks={rdYTicks(0, smTop, 25)}
                yTickFmt={() => ""} xTicks={smTicks} baseline
                series={[{ id: c.id, label: LONG[c.id], color: c.color, rdWidth: narrow ? 2 : 2.5, endCap: false, points: pts }]}
                spine={pts} scatter={dots}
                areas={band.length >= 2 ? [{ id: "ci-" + c.id, color: c.color, className: "ci-band", edge: false, points: band }] : []}
                notes={rdYTicks(25, smTop, 25).map((v) => ({ x: "left", y: v, dy: -4, text: v + "%", size: 11, cls: "rd-sm-ylab" }))}
                tooltipTitle={(i) => (pts[i] ? window.AP.monthLabelFull(pts[i].ym) : "")}
                extraRows={(i) => (pts[i] && pts[i].ci != null ? [{ label: "95% interval", value: "±" + pts[i].ci.toFixed(1) }] : [])}
                fmt={(v) => v.toFixed(1)}
                copy={{ title: LONG[c.id] + " now backing One Nation", sub: "Share of the party’s 2025 voters, month by month",
                        legend: [{ label: "Monthly average", color: c.color, kind: "line" }, { label: "95% interval", color: c.color, kind: "band" }] }}
              />
            </div>
          );
        })}
      </div>
      <RdKey className="rd-ckey rd-sm-key" items={[
        { kind: "dot", color: "var(--ink-3)", label: "One poll" },
        { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
      ]} />
      <RdFoot how={{ term: "vote-switching", from: "Where One Nation’s voters came from" }}>
        2025 vote is as respondents recall it. {narrow ? "Bar heights" : "Column widths"} use the AEC 2025 first-preference result.
      </RdFoot>
    </RdSec>
  );
}

/* ======================================================================
   The issues
   ====================================================================== */
/* the slope test behind issTrendVerdict, kept as figures so a headline can
   be written from it */
function rdIssTrend(D, it, dots) {
  if (!dots.length) return null;
  const per = {};
  for (const d of dots) per[d.pollster] = (per[d.pollster] || 0) + 1;
  const ym = (dots.find((d) => per[d.pollster] >= 2) || dots[0]).date.slice(0, 7);
  const fits = D.issues.parties.map((q) => ({ q, fit: withinHouseSlope(dots.map((d) => ({ h: d.pollster, t: d.x, w: d.n, y: d.s[q] }))) })).filter((f) => f.fit);
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  return { ym, up: sig.filter((f) => f.fit.b > 0).map((f) => f.q), down: sig.filter((f) => f.fit.b < 0).map((f) => f.q), tested: fits.length };
}

function RdIssues({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 760px)");
  const I = D.issues;
  const [view, setView] = useState("trust");
  const [selId, setSelId] = useState(null);
  /* picking another issue asks the same three parties a different question,
     so the chart reshapes into it (useMorph) rather than being swapped out.
     Called before the early return below: a hook can't sit after one. */
  const selNow = selId || (I && I.list && I.list[0] ? I.list[0].id : null);
  const [issMorph, setSel] = window.AP.useMorph(selNow, (v) => setSelId(v), (a, b) => a !== b);
  const [gsetId, setGset] = useState("vote");
  /* What matters to whom: a tablet or phone shows one issue at a time, as the
     canvas's phone board did, with the reader's pick kept across group sets.
     From 1000px down the six columns' bars would fall under 60px. */
  const [whomK, setWhomK] = useState(null);
  const whomList = useNarrow("(max-width: 1000px)");
  /* the dot strip's width on screen, so dots that would print over one
     another can be told apart (see dodge, below) */
  const stripRef = React.useRef(null);
  /* the issues rows' container, so an arrow key can hand focus to the row it
     just selected */
  const rowsRef = React.useRef(null);
  const stripW = useRdWidth(stripRef, 150);
  if (!I || !I.list || !I.list.length) return null;
  const P = I.parties;
  const list = I.list;
  const it = list.find((x) => x.id === selId) || list[0];
  const top = list[0];
  const pName = (q) => D.PARTIES[q].name, pColor = (q) => D.PARTIES[q].color;
  const [rangeLo, rangeHi] = rangeDomain(rangeId);

  /* ---- one issue's chart and its trend ------------------------------------ */
  const chartFor = (x) => {
    const monthPts = (x.monthly || []).map((m) => ({ ym: m[0], x: D.mx(m[0]),
      ...Object.fromEntries(P.map((q, i) => [q, m[1 + i]])), ...Object.fromEntries(P.map((q, i) => ["ci_" + q, m[1 + P.length + i]])) }));
    if (!monthPts.length) return null;
    const xDomain = [Math.max(rangeLo, monthPts[0].x - 0.06), rangeHi];
    const pts = filterPts(monthPts, xDomain[0]);
    const byRow = new Map(D.individualPolls.map((q) => [q.pollster + "|" + q.released, q]));
    const dots = (x.dots || []).filter((d) => d[0] >= xDomain[0] && d[0] <= xDomain[1]).map((d) => {
      const meta = byRow.get(d[1] + "|" + d[2]) || { pollster: demoHouse(d[1]), released: d[2] };
      return { x: d[0], pollster: d[1], date: d[2], n: meta.sample || 1000, meta, s: Object.fromEntries(P.map((q, i) => [q, d[3 + i]])) };
    });
    const scatter = dots.flatMap((d) => P.map((q) => ({ x: d.x, y: d.s[q], color: pColor(q), label: pName(q), meta: d.meta })));
    const areas = P.map((q) => ({ id: "ci-" + q, color: pColor(q), className: "ci-band", edge: false,
      points: pts.filter((d) => d["ci_" + q] != null).map((d) => ({ x: d.x, y0: d[q] - d["ci_" + q], y1: d[q] + d["ci_" + q] })) })).filter((a) => a.points.length >= 2);
    const vals = pts.flatMap((d) => P.map((q) => d[q])).concat(scatter.map((d) => d.y), areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
    const d0 = Math.max(0, Math.floor((Math.min(...vals) + 0.6) / 10) * 10), d1 = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
    return { xDomain, pts, dots, scatter, areas, domain: [d0, d1], trend: rdIssTrend(D, x, dots) };
  };
  const ch = chartFor(it);
  /* mid-switch: both issues' months on one grid, interpolated, with the x
     window, the y range and the bands travelling too, and the dots of a poll
     that asked about both issues crossing over */
  const chDraw = (() => {
    if (!ch) return null;
    const draw = { xDomain: ch.xDomain, domain: ch.domain, pts: ch.pts, areas: ch.areas, scatter: ch.scatter, scatterOut: [], scatterMove: [], fade: 1, clip: null };
    const m = issMorph;
    const a = m && list.find((x) => x.id === m.from), A = a && chartFor(a);
    if (!m || !A) return draw;
    const t = m.t;
    const bl = window.AP.blendRows(A.pts, ch.pts, t, P.concat(P.map((q) => "ci_" + q)));
    if (!bl) return draw;
    const keyOf = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label;
    const cross = window.AP.crossClouds(A.scatter, ch.scatter, t, keyOf);
    return {
      xDomain: window.AP.blendDomain(A.xDomain, ch.xDomain, t), domain: window.AP.blendDomain(A.domain, ch.domain, t),
      pts: bl.rows, clip: bl.clip,
      areas: P.map((q) => ({ id: "ci-" + q, color: pColor(q), className: "ci-band", edge: false, clipX: bl.clip,
        points: bl.rows.filter((d) => d["ci_" + q] != null && d[q] != null).map((d) => ({ x: d.x, y0: d[q] - d["ci_" + q], y1: d[q] + d["ci_" + q] })) })).filter((x) => x.points.length >= 2),
      scatter: cross.scatter, scatterOut: cross.scatterOut, scatterMove: cross.scatterMove, fade: t,
    };
  })();
  const chTop = it === top ? ch : chartFor(top);
  const since = (tr) => tr ? D.monthNameFull(+tr.ym.slice(5)) + (Number(tr.ym.slice(0, 4)) === new Date(Date.parse(D.latest.updatedISO)).getUTCFullYear() ? "" : " " + tr.ym.slice(0, 4)) : "";
  const trendHead = (x, c) => {
    const tr = c && c.trend;
    if (!tr) return null;
    if (!tr.up.length && !tr.down.length) return "No party has gained significant ground since " + since(tr);
    if (tr.up.length) return rdList(tr.up.map((q) => rdPartyStart(q))) + " " + (tr.up.length > 1 ? "have" : "has") + " gained significant ground since " + since(tr);
    return rdList(tr.down.map((q) => rdPartyStart(q))) + " " + (tr.down.length > 1 ? "have" : "has") + " lost significant ground since " + since(tr);
  };

  /* ---- the finding: the top concern, and who is trusted with it ------------- */
  const phrase = ISS_PHRASE[top.id] || top.label.toLowerCase();
  const own = top.own;
  const trTop = chTop && chTop.trend;
  const minor = trTop && trTop.up.length === 1 && trTop.up[0] === "onp" ? "onp" : null;
  const trustHead = !own ? rdCap(phrase.replace(/^the /, "")) + " tops voters’ concerns"
    : own.leadSig ? rdPartyStart(own.lead) + " is most trusted on " + phrase + ", voters’ top concern"
    : minor ? "One Nation has drawn level with the major parties on " + phrase
    : "No party is clearly trusted most on " + phrase + ", voters’ top concern";
  /* Hand-curated dek (user's wording, 2026-09-28), same convention as
     RD_DEMO_HOME: every lead named is a currently-significant pooled gap,
     refreshed by hand when the pool moves — it no longer regenerates. */
  const trustDek = !top.imp ? null
    : "The cost of living is by far the issue most important to voters, but no party is more trusted on it than another. "
    + "Labor leads on housing, health, and climate change, while One Nation leads on crime and immigration. "
    + "The Coalition retains its age-old lead on economic management.";

  /* ---- who's trusted: the rows -------------------------------------------- */
  const dotLo = 20, dotHi = 50;
  const dx = (v) => ((Math.max(dotLo, Math.min(dotHi, v)) - dotLo) / (dotHi - dotLo)) * 100;
  /* Parties within a dot's width of each other on this strip - on a laptop
     the table shares its row with the chart, so a point is about five pixels
     - step apart vertically, centred on the row, rather than printing one
     dot over another (cost of living's 34, 32 and 34 showed as one). */
  const dodge = (own) => {
    const need = 12 / Math.max(1, stripW / (dotHi - dotLo));
    const s = P.map((q) => ({ q, v: own.v[q] })).sort((a, b) => a.v - b.v);
    const off = {};
    let run = [s[0]];
    const flush = () => run.forEach((d, i) => { off[d.q] = (i - (run.length - 1) / 2) * 9; });
    for (let i = 1; i < s.length; i++) {
      if (s[i].v - s[i - 1].v < need) run.push(s[i]);
      else { flush(); run = [s[i]]; }
    }
    flush();
    return off;
  };
  const verdictOf = (x) => !x.own ? null : x.own.leadSig
    ? { text: ISS_PARTY_CAP[x.own.lead] + " ahead", color: inkOf(pColor(x.own.lead)), strong: true }
    : x.own.pairSig ? { text: ISS_PARTY_CAP[x.own.third] + " behind", strong: true }
    : { text: "No clear lead" };
  /* keyboard walk over the issue rows: with a row focused, ArrowDown/ArrowUp
     step the selection a row at a time, focus following (a held key keeps
     walking), clamped at the list's ends */
  const rowKey = (e, x) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x.id); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = list.findIndex((y) => y.id === x.id);
    const j = i + (e.key === "ArrowDown" ? 1 : -1);
    if (j < 0 || j >= list.length) return;
    setSel(list[j].id);
    const rows = rowsRef.current ? rowsRef.current.querySelectorAll(".rd-is-row:not(.rd-is-tally)") : [];
    if (rows[j]) rows[j].focus();
  };
  const row = (x) => {
    const v = verdictOf(x), sel = x.id === it.id;
    const off = x.own ? dodge(x.own) : {};
    return (
      <div key={x.id} className={"rd-is-row" + (sel ? " sel" : "")} role="button" tabIndex={0} aria-pressed={sel}
           onClick={() => setSel(x.id)} onKeyDown={(e) => rowKey(e, x)}
           aria-label={x.label + ": " + (x.imp ? Math.round(x.imp.v) + "% put it in their top three" : "not asked") + "; " + (x.own ? pOrd.map((q) => pName(q) + " " + Math.round(x.own.v[q])).join(", ") + "; " + v.text : "no three-way figures")}>
        <span className="rd-is-lab">{x.label}</span>
        <span className="rd-is-imp">{x.imp ? <><span className="rd-is-bar"><span style={{ width: x.imp.v + "%" }}></span></span><b>{Math.round(x.imp.v)}%</b><span className="rd-is-impw"> rank it top three</span></> : <span className="rd-is-na">not asked</span>}</span>
        <span className="rd-is-dots" aria-hidden="true">
          {[20, 30, 40, 50].map((g) => <span key={g} className="rd-is-gl" style={{ left: dx(g) + "%" }}></span>)}
          <span className="rd-is-third" style={{ left: dx(100 / 3) + "%" }}></span>
          {x.own && P.map((q) => <span key={q} className="rd-is-dot" style={{ left: dx(x.own.v[q]) + "%", top: "calc(50% + " + off[q] + "px)", background: pColor(q) }}></span>)}
        </span>
        <span className="rd-is-nums">{x.own ? pOrd.map((q) => <b key={q} style={{ color: inkOf(pColor(q)) }}>{Math.round(x.own.v[q])}</b>) : null}</span>
        <span className={"rd-is-verdict" + (v && v.strong ? " strong" : "")} style={v && v.color ? { color: v.color } : undefined}>
          {v ? v.text : ""}{x.grnTop && <small>Greens first where offered</small>}</span>
      </div>
    );
  };
  const wide = list.filter((x) => x.imp && x.imp.gap && x.imp.by.length === 2)
    .map((x) => { const [hi, lo] = [...x.imp.by].sort((a, b) => b.v - a.v); return { x, hi, lo, d: hi.v - lo.v }; })
    .sort((a, b) => b.d - a.d).find((w) => w.d >= 5);
  /* the tally its reader is really after - one three-party split for the
     table: each issue's "best on it" shares weighted by how many voters put
     it in their top three (importance x perceived competence), summed to a
     split across the asked issues */
  const tally = (() => {
    const rows = list.filter((x) => x.own && x.imp);
    const wsum = rows.reduce((a, x) => a + x.imp.v, 0);
    if (!wsum) return null;
    return Object.fromEntries(P.map((q) => [q, rows.reduce((a, x) => a + x.imp.v * x.own.v[q], 0) / wsum]));
  })();
  /* every three-party listing on the trust side (head legend, each row's
     figures, the scoreboard chips) reads in scoreboard order, highest first;
     the data arrays stay keyed to P, this is presentation only */
  const pOrd = tally ? P.slice().sort((a, b) => tally[b] - tally[a]) : P;

  /* ---- what matters to whom ------------------------------------------------ */
  const G = I.groups;
  const gtab = G && (G.tabs.find((x) => x.id === gsetId) || G.tabs[0]);
  const allOf = (k) => (G && G.all && G.all[k]) || null;
  const gVerdicts = gtab ? gtab.issues.map((k) => issGroupVerdict(gtab, k)).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  const whomHead = (() => {
    if (!gtab) return null;
    const firstOf = (cells) => gtab.issues.slice().sort((a, b) => ((cells[b] || {}).v || 0) - ((cells[a] || {}).v || 0));
    const allRank = firstOf(Object.fromEntries(gtab.issues.map((k) => [k, allOf(k) || {}])));
    const ranks = gtab.groups.map((g) => firstOf(gtab.cells[g] || {}));
    const sameFirst = ranks.every((r) => r[0] === allRank[0]);
    const first = (ISS_PHRASE[allRank[0]] || allRank[0]);
    /* user trim, 2026-09-28: the "What comes second divides them." tail was
       cut; the first sentence stays generated */
    if (sameFirst) return rdCap(first) + " comes first for everyone.";
    return rdCap(first) + " comes first for most voters, but not all.";
  })();
  const newestPoll = G && G.newest ? D.individualPolls.find((q) => /^RedBridge/.test(q.pollster) && q.released === G.newest) : null;
  const monFull = (lab) => lab.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/g,
    (m) => D.monthNameFull(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m.slice(0, 3)) + 1));
  const gSource = G ? G.house + ", " + (newestPoll ? monFull(newestPoll.dateLabel) + " " + G.newest.slice(0, 4) : rdDate(G.newest, true)) : "";
  const whomCell = (g, k) => {
    const c = g ? gtab.cells[g] && gtab.cells[g][k] : allOf(k);
    if (!c) return <span className="rd-iw-na">–</span>;
    const a = allOf(k);
    const diff = g && a ? c.v - a.v : 0;
    const sig = g && a && Math.abs(diff) > c.ci;
    return (
      <span className={"rd-iw-cell" + (g ? "" : " all") + (sig ? " sig" : "")} title={"± " + c.ci.toFixed(1) + " is the 95% margin"}>
        <span className="rd-iw-bar"><span style={{ width: c.v + "%" }}></span>{g && a && <i style={{ left: a.v + "%" }}></i>}</span>
        <b><RollNum value={String(Math.round(c.v))} />{sig ? <em>{diff > 0 ? "▲" : "▼"}</em> : null}</b>
      </span>
    );
  };
  const groupLong = (g) => rdCap(issWho(g)
    .replace(/^Nationals, LNP and CLP voters$/, "Nationals, LNP, CLP voters"));
  const groupShort = (g) => g.replace(/^Nationals, LNP and CLP$/, "Nationals, LNP, CLP");
  /* the issue the one-issue list opens on: the reader's pick, else the one
     that divides the groups most (the canvas opened on immigration) */
  const whomIssue = !gtab ? null : whomK && gtab.issues.includes(whomK) ? whomK
    : (gtab.issues.map((k) => ({ k, v: issGroupVerdict(gtab, k) })).filter((x) => x.v)
        .sort((a, b) => b.v.gap - a.v.gap)[0] || {}).k || gtab.issues[0];
  /* Rows are keyed by their PLACE, not their group, in both layouts: a
     switch of grouping (age -> gender) or of issue keeps each row's bar and
     figure, so the bar slides to its new share and the figure rolls to it -
     the leadership bars' motion - instead of the table being torn down. */
  const whomRow = (g, k, i) => {
    const c = g ? gtab.cells[g] && gtab.cells[g][k] : allOf(k);
    if (!c) return null;
    const a = allOf(k);
    const diff = g && a ? c.v - a.v : 0;
    const sig = g && a && Math.abs(diff) > c.ci;
    return (
      <div key={g ? "r" + i : "all"} className={"rd-iw-lrow" + (g ? "" : " all") + (sig ? " sig" : "")} role="row"
           title={"± " + c.ci.toFixed(1) + " is the 95% margin"}>
        <span role="rowheader">{g ? groupShort(g) : "All voters"}</span>
        <span className="rd-iw-lbar" aria-hidden="true"><span style={{ width: c.v + "%" }}></span>{g && a && <i style={{ left: a.v + "%" }}></i>}</span>
        <span role="cell" className="rd-iw-lv"><RollNum value={String(Math.round(c.v))} />{sig ? " " + (diff > 0 ? "▲" : "▼") : ""}</span>
      </div>
    );
  };

  const tabs = (
    <RdTabs swipe value={view} onChange={setView} ariaLabel="View" className="rd-is-tabs"
            options={[{ id: "trust", label: "Who’s trusted" }, { id: "whom", label: "What matters to whom" }]} />
  );
  return (
    <RdSec id="issues" cls="rd-is" title="The issues"
           meta={"What voters say matters most, and who they think is best on it, " + rdList(I.houses) + ", last " + I.window}>
      {tabs}
      {/* the two views ask different things of different charts, so a
          switch crossfades them (RdCrossfade) rather than cutting */}
      <RdCrossfade k={view}>
      {view === "trust" ? (
        <>
          <RdHed head={trustHead} dek={trustDek} />
          <div className="rd-is-grid">
            <div className="rd-is-left" ref={rowsRef}>
              {/* Each head sits over its own column: the strip's words over the
                  strip, the key over the three figures it colours (a phone stacks
                  the words and the key over the scale). */}
              <div className="rd-is-head" aria-hidden="true">
                <span></span>
                <span className="rd-is-imph">In voters’ top three</span>
                <span className="rd-is-dotsh">
                  <span className="rd-is-cap">Best on it, % of voters naming one of these three</span>
                  <span className="rd-is-leg">{pOrd.map((q) => <span key={q}><i style={{ background: pColor(q) }}></i>{ISS_PARTY_CAP[q]}</span>)}</span>
                </span>
              </div>
              {list.map(row)}
              {tally && (
                <div className="rd-is-row rd-is-tally"
                     aria-label={"Issue-importance-weighted trust score: " + pOrd.map((q) => pName(q) + " " + Math.round(tally[q])).join(", ")}>
                  <span className="rd-is-tallab">
                    <b>Issue-importance-weighted trust score</b>
                    <small>Each issue counts in proportion to how many voters rank it in their top three</small>
                  </span>
                  <span className="rd-is-tallynums">{pOrd.map((q) => (
                    <span key={q} className="rd-is-score" style={{ background: "color-mix(in oklab, " + pColor(q) + " 12%, transparent)" }}>
                      <b style={{ color: inkOf(pColor(q)) }}>{Math.round(tally[q])}</b>
                      <i style={{ color: inkOf(pColor(q)) }}>{ISS_PARTY_CAP[q]}</i>
                    </span>))}
                  </span>
                </div>
              )}
              <div className="rd-is-axis" aria-hidden="true">
                <span></span><span></span>
                <span className="rd-is-dots" ref={stripRef}>{[20, 30, 40, 50].map((g) => <span key={g} style={{ left: dx(g) + "%" }}>{g === 50 ? "50%" : g}</span>)}
                  <span className="rd-is-thirdlab" style={{ left: dx(100 / 3) + "%" }}>⅓ each</span></span>
                <span></span><span></span>
              </div>
              {wide && <p className="rd-note">{wide.hi.house} and {wide.lo.house} word the importance question differently and disagree most on {ISS_PHRASE[wide.x.id]}: {Math.round(wide.hi.v)}% in {wide.hi.house}’s latest poll, {Math.round(wide.lo.v)}% in {wide.lo.house}’s. The grey bars sit midway between the two pollsters’ usual figures.</p>}
              {list.filter((x) => x.grnTop).map((x) => <p key={"g" + x.id} className="rd-note">{x.grnTop.house} also offers the Greens, who come first on {ISS_PHRASE[x.id]} ({x.grnTop.grn}%).</p>)}
            </div>
            {ch && (
              <div className="card rd-card rd-is-chart">
                <div className="rd-is-ctop"><span>{it.label}</span></div>
                {trendHead(it, ch) && <h4 className="rd-is-chead">{trendHead(it, ch)}</h4>}
                <p className="rd-is-csub">Who voters think is best, month by month, % of those naming Labor, the Coalition or One Nation</p>
                <TrendChart key="rd-is-chart" heightPx={narrow ? 240 : 260} padPx={{ l: 36, r: 10, t: 12, b: 28 }}
                  xDomain={chDraw.xDomain} yDomain={chDraw.domain} yTicks={rdYTicks(ch.domain[0], ch.domain[1], 10)}
                  yTickFmt={(v) => (v === ch.domain[1] ? v + "%" : String(v))} xTicks={rdXTicks(ch.xDomain[0], ch.xDomain[1], true)} baseline
                  series={P.map((q) => ({ id: q, label: pName(q), color: pColor(q), rdWidth: 2.2, endCap: false, clipX: chDraw.clip,
                    points: chDraw.pts.filter((d) => d[q] != null).map((d) => ({ x: d.x, y: d[q] })), endLabel: ISS_PARTY_CAP[q] }))}
                  areas={chDraw.areas} spine={series(ch.pts, P[0])} scatter={chDraw.scatter} scatterOut={chDraw.scatterOut}
                  scatterMove={chDraw.scatterMove} fade={chDraw.fade} driven={!!issMorph} pollFacet="primary"
                  tooltipTitle={(i) => (ch.pts[i] ? monthLabelFull(ch.pts[i].ym) : "")} fmt={(v) => Math.round(v) + ""}
                  copy={{ title: it.label + ": who voters think is best", sub: "Of those naming Labor, the Coalition or One Nation" }} />
                <RdKey className="rd-ckey" items={[{ kind: "dot", color: "var(--ink-3)", label: "One poll" }, { kind: "lineband", color: "var(--ink-3)", label: "Monthly average and 95% interval" }]} />
                <HowTo label="How to read these figures" paras={[
                  <>The grey bar is how many voters put the issue among their three most important. RedBridge and Ipsos both ask every month, in different words, and their figures sit a steady distance apart, so each poll is moved half that distance toward the other before the two are pooled.</>,
                  <>The dots split the voters who named Labor, the Coalition or One Nation as best on the issue. Pollsters also offer other answers, and each offers a different set, so only these three can be pooled.</>,
                ]} />
              </div>
            )}
          </div>
          <RdFoot how={{ term: "issues", from: "The issues" }}>
            Figures pool the last {I.window} of polls, newer and larger polls counting for more. “Ahead” means a lead larger than its own 95% margin; “behind” names a party clearly third. Pick an issue to follow it in the chart.
          </RdFoot>
        </>
      ) : (
        <>
          <RdHed head={whomHead} dek={gVerdicts.length ? gVerdicts.map((v) => v.text).join(" ") : "No two groups differ significantly on any of these issues."} />
          {gtab ? (
            <div className="card rd-card rd-iw">
              {whomList ? (
                /* a tablet or phone: pick the groups and the issue, and read
                   every group's share of that one issue down a single scale */
                <>
                  <span className="rd-iw-k">Group voters by</span>
                  <div className="rd-iw-chips" role="group" aria-label="Group voters by"
                       onKeyDown={rdTabsKey(G.tabs, setGset)}>
                    {G.tabs.map((x) => <button key={x.id} type="button" className="rd-iw-chip" aria-pressed={gtab.id === x.id} onClick={() => setGset(x.id)}>{x.label}</button>)}
                  </div>
                  <span className="rd-iw-k">Issue</span>
                  <div className="rd-iw-chips" role="group" aria-label="Issue">
                    {gtab.issues.map((k) => <button key={k} type="button" className="rd-iw-chip" aria-pressed={whomIssue === k} onClick={() => setWhomK(k)}>{ISS_SHORT[k] || I.labels[k] || k}</button>)}
                  </div>
                  <p className="rd-iw-ltitle"><b>{I.labels[whomIssue] || whomIssue} in their top three, %</b><br />{gSource}</p>
                  <div className="rd-iw-list" role="table" aria-label={"Share of each group putting " + (ISS_PHRASE[whomIssue] || whomIssue) + " in its top three"}>
                    {whomRow(null, whomIssue)}
                    {gtab.groups.map((g, i) => whomRow(g, whomIssue, i))}
                  </div>
                </>
              ) : (
                <>
                  <div className="rd-iw-ctl">
                    <span className="rd-iw-by">Group voters by</span>
                    <RdTabs value={gtab.id} onChange={setGset} options={G.tabs.map((x) => ({ id: x.id, label: x.label }))} ariaLabel="Group voters by" className="rd-tabs-sm rd-iw-tabs" />
                  </div>
                  <p className="rd-iw-src"><b>Share of each group putting each issue in its top three, %</b>, {gSource}</p>
                  {/* a fixed layout, as the canvas's grid was: the label column
                      set, the six issues sharing the rest equally. Sized by
                      their words, short heads like "Housing" took columns
                      narrower than their bars, which pushed the figures
                      under the next column. */}
                  <div className="rd-iw-wrap">
                    <table className="rd-iw-table">
                      <colgroup><col className="rd-iw-labcol" />{gtab.issues.map((k) => <col key={k} />)}</colgroup>
                      <thead><tr><th scope="col"><span className="sr-only">Group</span></th>{gtab.issues.map((k) => <th scope="col" key={k}>{I.labels[k] || k}</th>)}</tr></thead>
                      <tbody>
                        <tr className="all"><th scope="row">All voters</th>{gtab.issues.map((k) => <td key={k}>{whomCell(null, k)}</td>)}</tr>
                        {gtab.groups.map((g, i) => <tr key={"r" + i}><th scope="row">{groupLong(g)}</th>{gtab.issues.map((k) => <td key={k}>{whomCell(g, k)}</td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="rd-key rd-iw-key">
                <span className="rd-key-item"><span className="rd-iw-keybar" aria-hidden="true"><i></i></span>Group’s share, with all voters marked</span>
                <span className="rd-key-item"><b aria-hidden="true">▲▼</b>Differs from all voters by more than the group’s own 95% margin</span>
              </div>
            </div>
          ) : <p className="rd-note">No poll in the last {I.window} published these figures by group.</p>}
          <RdFoot how={{ term: "issues", from: "The issues" }}>
            Only {G ? G.house : "RedBridge"} publishes what matters by group, and only for these {gtab ? rdNumWord(gtab.issues.length) : ""} issues, so its all-voters row can differ from the pooled figures in Who’s trusted. A group’s margin depends on its share of the sample.
          </RdFoot>
        </>
      )}
      </RdCrossfade>
    </RdSec>
  );
}

/* ======================================================================
   Undecided
   ====================================================================== */
/* round denominators only: "one in twenty" is something a reader carries
   away, "one in twenty-three" is not */
const RD_ONE_IN = [3, 4, 5, 10, 20, 50, 100];
const RD_BIG_WORDS = { 50: "fifty", 100: "a hundred" };
/* a small share as "one voter in twenty", the nearest in ratio terms */
function rdOneIn(v) {
  const n = RD_ONE_IN.reduce((b, k) => (Math.abs(Math.log(100 / k / v)) < Math.abs(Math.log(100 / b / v)) ? k : b), RD_ONE_IN[0]);
  return (Math.abs(100 / n - v) < 0.3 ? "one voter in " : "about one voter in ") + (RD_BIG_WORDS[n] || rdNumWord(n));
}
/* the mid-2025 ring and the now dot, per group, on one scale */
function RdShiftPlot({ rows, all, lo, hi, title, source, allLabel }) {
  const X = (v) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  const signedD = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  return (
    <div className="rd-sp" role="table" aria-label={title}>
      <div className="rd-sp-head" role="row">
        <b role="columnheader">{title}</b>
        <span className="rd-sp-allcap" aria-hidden="true">{all != null && <span style={{ left: X(all) + "%" }}>{allLabel}</span>}</span>
        <span className="rd-sp-src" role="columnheader">{source}</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="rd-sp-row" role="row">
          <span role="cell" className="rd-sp-lab">{r.sw && <span className="rd-sp-sw" style={{ background: r.color }}></span>}{r.label}</span>
          <span className="rd-sp-track" aria-hidden="true">
            {all != null && <span className="rd-sp-all" style={{ left: X(all) + "%" }}></span>}
            <span className="rd-sp-link" style={{ left: Math.min(X(r.base), X(r.now)) + "%", width: Math.abs(X(r.now) - X(r.base)) + "%", background: r.color }}></span>
            <span className="rd-sp-ring" style={{ left: X(r.base) + "%" }}></span>
            <span className="rd-sp-dot" style={{ left: X(r.now) + "%", background: r.color }}></span>
          </span>
          <span role="cell" className="rd-sp-v"><b>{r.now.toFixed(1)}%</b> <span>±{r.ci.toFixed(1)}</span></span>
          <span role="cell" className={"rd-sp-d" + (r.sig ? " sig" : "")}>{signedD(r.now - r.base)}</span>
        </div>
      ))}
      <div className="rd-sp-axis" aria-hidden="true">
        <span></span>
        <span className="rd-sp-ticks">{rdYTicks(lo, hi, 10).map((v) => <span key={v} style={{ left: X(v) + "%" }}>{v}%</span>)}</span>
        <span></span><span></span>
      </div>
    </div>
  );
}

function RdUndecided({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const [view, setView] = useState("all");
  const U = D.undecided;
  if (!U || !U.series.length) return null;
  const F = D.firmness, A = U.softAge;
  const byId = {};
  U.series.forEach((s) => { byId[s.id] = s; });
  const first = byId.first, tpp = byId.tpp, soft = byId.soft;
  const nowOf = (s) => (s ? (s.now ? s.now.v : s.latest.v) : null);
  const xDomain = rangeDomain(rangeId);
  const slopeOf = (s) => (s ? withinHouseSlope(s.polls.map((d) => ({ h: d.pollster, t: d.x, w: d.sample || 1000, y: d.v }))) : null);

  /* ---- the finding ----------------------------------------------------------- */
  const story = (() => {
    const u = nowOf(first), sf = nowOf(soft);
    if (u == null) return null;
    const head = rdCap(rdOneIn(u)) + " is undecided." + (sf != null ? " " + rdCap(rdShareWords(sf / 100)) + " of the rest could still switch." : "");
    const moves = [["undecided", first], ["not firm", soft]].map(([nm, s]) => ({ nm, s, f: slopeOf(s) })).filter((m) => m.f);
    const movedSig = moves.filter((m) => m.f.p < 0.05 / moves.length);
    /* the dek is the movement verdict alone (user trim, 2026-09-28): the
       house range and latest-figure sentences it used to append were cut */
    const dek = !movedSig.length ? (moves.length > 1 ? "Neither share has" : "The share has") + " moved significantly since the 2025 election."
      : movedSig.map((m) => "The " + m.nm + " share has " + (m.f.b > 0 ? "risen" : "fallen") + " significantly since the 2025 election.").join(" ");
    return { head, dek };
  })();

  /* ---- all voters: of every 100 ---------------------------------------------- */
  const u = nowOf(first), sf = nowOf(soft);
  const und100 = Math.round(u), soft100 = Math.round(sf * (100 - u) / 100), firm100 = 100 - und100 - soft100;
  const moved = moves100 => moves100;
  const panel = (list, lo, hi, step, key, title, meta) => {
    const drawn = list.map((s) => ({ s, pts: filterPts(s.monthly, xDomain[0]), dots: s.polls.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]) }))
      .filter((d) => d.pts.length >= 2);
    if (!drawn.length) return null;
    /* the board's tones: first preference in ink, after preferences a
       lighter grey (dashed), not firm between. Their polls wear the same
       tones, and after preferences' as open rings - six Essential readings
       carry that line, so they stay on show, but told apart */
    const COL = (s) => (s.id === "soft" ? "var(--ink-2)" : s.id === "tpp" ? "var(--ink-3)" : "var(--ink)");
    const outlier = key === "und" && first.latest && first.latest.v < lo + 2.5 ? first.polls.find((d) => d.released === first.latest.released && d.pollster === first.latest.firm) : null;
    return (
      <div className="card rd-card rd-un-panel" key={key}>
        <div className="rd-un-ptitle"><b>{title}</b><span>{meta}</span></div>
        {list.map((s) => (
          <div key={s.id} className="rd-un-read">
            <RdSwatch kind={s.dashed ? "dash" : "line"} color={COL(s)} />
            <div>
              <div className="rd-un-rtop"><b>{s.id === "soft" ? "Might still change" : s.label}</b><span className="rd-un-rv">{nowOf(s).toFixed(1)}%</span>{s.now && <span className="rd-un-rci">±{s.now.ci95.toFixed(1)}</span>}</div>
              <p>{s.id === "first" ? "Can’t say who they’d vote for. " : s.id === "tpp" ? "Won’t pick between Labor and the Coalition. " : "Named a party but say they could change their mind. "}{rdList(s.houses)}.</p>
            </div>
          </div>
        ))}
        <TrendChart key={"rd-un-" + key} heightPx={narrow ? 200 : 230} padPx={{ l: 36, r: 10, t: 14, b: 28 }}
          xDomain={xDomain} yDomain={[lo, hi]} yTicks={rdYTicks(lo, hi, step)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
          xTicks={rdXTicks(xDomain[0], xDomain[1], narrow)} baseline
          series={drawn.map((d) => ({ id: d.s.id, label: d.s.label, color: COL(d.s), rdWidth: 2, dashed: d.s.dashed, rdCap: 3.5, points: series(d.pts, "v") }))}
          spine={series(drawn[0].pts, "v")}
          scatter={drawn.flatMap((d) => d.dots.map((q) => ({ x: q.x, y: q.v, color: COL(d.s), hollow: d.s.id === "tpp", label: d.s.label, meta: q })))} pollFacet="twopp"
          notes={outlier ? [{ x: outlier.x, y: outlier.v, dy: -8, text: (+outlier.v.toFixed(1)) + "%, " + outlier.pollster + ", " + outlier.dateLabel, anchor: "end", size: 11 }] : []}
          tooltipTitle={(i) => { const p = drawn[0].pts[i]; return p ? monthLabelFull(p.ym) : ""; }}
          fmt={(v) => v.toFixed(1)}
          /* the readouts over the chart say which line is which; the copy
             leaves them behind, so its key says it, with the figures */
          copy={{ title: title, sub: meta, caption: drawn.some((d) => d.s.id === "tpp")
                    ? "Each dot is one poll, open rings for after preferences; lines are monthly averages."
                    : "Each dot is one poll; lines are monthly averages.",
                  legend: drawn.map((d) => ({ label: (d.s.id === "soft" ? "Might still change" : d.s.label) + " " + nowOf(d.s).toFixed(1) + "%",
                                              color: COL(d.s), kind: d.s.dashed ? "dashed" : "line" })) }} />
      </div>
    );
  };
  const changeFoot = (() => {
    const bits = [first, tpp, soft].filter(Boolean).map((s) => {
      const c = s.now ? s.now.chg : null;
      const nm = s.id === "first" ? "first preference" : s.id === "tpp" ? "after preferences" : "not firm";
      return { nm, c, sig: s.now && s.now.changeSig };
    });
    const anySig = bits.some((b) => b.sig);
    return (anySig ? "Changes on the previous period: " : "None of the " + rdNumWord(bits.length) + " has changed significantly on the previous period: ")
      + bits.map((b) => b.nm + " " + (b.c == null ? "n/a" : Math.abs(b.c) < 0.05 ? "unchanged" : (b.c > 0 ? "+" : "−") + Math.abs(b.c).toFixed(1))).join(", ") + ". ± is the 95% margin.";
  })();

  /* ---- by party ---------------------------------------------------------------- */
  const partyView = F && (() => {
    const ids = ["onp", "alp", "lnp", "grn", "oth"].filter((k) => F.now[k] && F.base[k]).sort((a, b) => F.now[b].v - F.now[a].v);
    const apart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
    const rows = ids.map((k) => ({ id: k, label: k === "oth" ? "Others" : D.PARTIES[k].name, color: D.PARTIES[k].color, sw: true,
      now: F.now[k].v, base: F.base[k].v, ci: F.now[k].ci95, sig: apart(F.now[k], F.base[k]) }));
    const vals = rows.flatMap((r) => [r.now, r.base]).concat([F.now.all.v]);
    const lo = Math.floor((Math.min(...vals) - 3) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
    const sigRows = rows.filter((r) => r.sig);
    const allSig = apart(F.now.all, F.base.all);
    const note = "RedBridge asks voters how firm their choice is, a different question from Resolve’s in All voters, so the two views don’t compare directly. "
      + (!sigRows.length ? "Among the parties, no change is significant." : sigRows.length === 1 ? "Among the parties, only the " + (sigRows[0].id === "lnp" ? "Coalition" : sigRows[0].label) + "’s " + (sigRows[0].now < sigRows[0].base ? "fall" : "rise") + " is significant."
        : "Among the parties, " + rdList(sigRows.map((r) => r.label)) + " have changed significantly.")
      + (allSig ? " The share of all voters calling their vote solid has also " + (F.now.all.v < F.base.all.v ? "fallen" : "risen") + " significantly, from " + F.base.all.v.toFixed(1) + "% to " + F.now.all.v.toFixed(1) + "%." : "");
    const biggest = sigRows.slice().sort((a, b) => Math.abs(b.now - b.base) - Math.abs(a.now - a.base))[0];
    const sub = biggest ? (biggest.id === "oth" ? "Minor-party voters" : biggest.label + " voters") + " " + (biggest.now < biggest.base ? "have softened" : "have firmed") + " since mid-2025"
      : "No party’s voters have softened significantly since mid-2025";
    const rolled = F.waves.map((w, i) => {
      const ws = F.waves.slice(Math.max(0, i - F.pool + 1), i + 1);
      const r = { x: w.x, dateLabel: w.dateLabel };
      for (const k of ids.concat(["all"])) { const n = ws.reduce((a, v) => a + v.n[k], 0); r[k] = ws.reduce((a, v) => a + v.n[k] * v.solid[k], 0) / n; }
      return r;
    });
    const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
    const waves = F.waves.filter(inX), lines = rolled.filter(inX);
    const smVals = waves.flatMap((w) => ids.map((k) => w.solid[k]));
    const sLo = Math.floor((Math.min(...smVals) - 2) / 20) * 20, sHi = Math.ceil((Math.max(...smVals) + 2) / 20) * 20;
    const monthOf = (lab) => lab;
    return { rows, lo, hi, note, sub, ids, waves, lines, sLo, sHi };
  })();

  /* ---- by age ---------------------------------------------------------------------- */
  const ageView = A && (() => {
    const B = [{ id: "18-34", label: "18–34" }, { id: "35-54", label: "35–54" }, { id: "55+", label: "55+" }];
    const grey = (i) => ["color-mix(in oklab, var(--ink) 50%, var(--bg))", "color-mix(in oklab, var(--ink) 72%, var(--bg))", "var(--ink)"][i];
    const apart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
    const allNow = soft ? nowOf(soft) : null;
    const rows = B.map((b, i) => ({ id: b.id, label: b.label, color: grey(i), now: A.now[b.id].v, base: A.base[b.id].v, ci: A.now[b.id].ci95, sig: apart(A.now[b.id], A.base[b.id]) }));
    const vals = rows.flatMap((r) => [r.now, r.base]).concat(allNow != null ? [allNow] : []);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10), hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
    const young = A.now["18-34"], old = A.now["55+"];
    const gapSig = apart(young, old);
    const anyChg = rows.filter((r) => r.sig);
    const note = "Resolve doesn’t publish how many people it asked in each age group, so each group is weighted by its share of adults (2021 Census). "
      + (gapSig ? "The gap between 18–34s and over-55s is significant; " : "The gap between 18–34s and over-55s is not significant; ")
      + (anyChg.length ? rdList(anyChg.map((r) => r.label + "s")) + "’ change is significant." : "no group’s change is.");
    const least = rows.slice().sort((a, b) => b.now - a.now)[0];
    const sub = least.id === "18-34" && gapSig ? "Young voters are the least firm" : least.id === "55+" && gapSig ? "Older voters are the least firm" : "No age group is clearly less firm than the others";
    const rolled = A.waves.map((w, i) => {
      const ws = A.waves.slice(Math.max(0, i - A.pool + 1), i + 1);
      const r = { x: w.x, dateLabel: w.dateLabel };
      for (const b of B) { const n = ws.reduce((a, v) => a + v.n[b.id], 0); r[b.id] = ws.reduce((a, v) => a + v.n[b.id] * v.soft[b.id], 0) / n; }
      return r;
    });
    const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
    return { B, grey, rows, lo, hi, note, sub, allNow, waves: A.waves.filter(inX), lines: rolled.filter(inX) };
  })();
  const monthsLabel = (from, to) => from + " → " + to;

  const views = [{ id: "all", label: "All voters" }].concat(F ? [{ id: "party", label: "By party" }] : [], A ? [{ id: "age", label: "By age" }] : []);
  return (
    <RdSec id="undecided" cls="rd-un" title="Undecided" meta={rdList(U.houses) + ", since the 2025 election"}>
      {story && <RdHed head={story.head} dek={story.dek} />}
      <RdTabs value={view} onChange={setView} options={views} ariaLabel="Undecided among" className="rd-un-tabs" />
      {/* each view is its own measure from its own pollsters: a switch
          crossfades them (RdCrossfade) */}
      <RdCrossfade k={view}>
      {view === "all" && (
        <>
          <div className="card rd-card rd-un-100">
            <div className="rd-un-100h"><b>Of every 100 voters</b><span className="rd-un-100b" style={{ width: (soft100 + und100) + "%" }}>About {soft100 + und100} in 100 could still move</span></div>
            {/* a phone keys the bar underneath, as the canvas drew it: a
                four-point segment has no room for its number or its name */}
            {!narrow && (
              <div className="rd-un-100l">
                <span style={{ flexBasis: firm100 + "%" }}><b>Firm</b> named a party and don’t expect to change</span>
                <span style={{ flexBasis: soft100 + "%" }}><b>Not firm</b> <span className="rd-un-long">might still change</span></span>
                <span style={{ flexBasis: und100 + "%" }} className="rd-un-und"><b>Undecided</b></span>
              </div>
            )}
            <div className="rd-un-bar" role="img" aria-label={`Of every 100 voters, about ${firm100} are firm, ${soft100} not firm and ${und100} undecided`}>
              <span className="rd-un-f" style={{ flexBasis: firm100 + "%" }}>{narrow ? "" : firm100}</span>
              <span className="rd-un-s" style={{ flexBasis: soft100 + "%" }}>{narrow ? "" : soft100}</span>
              <span className="rd-un-u" style={{ flexBasis: und100 + "%" }}>{narrow ? "" : und100}</span>
            </div>
            {narrow && (
              <div className="rd-un-key" aria-hidden="true">
                {[["f", firm100, "Firm:", "named a party and don’t expect to change"],
                  ["s", soft100, "Not firm:", "named a party but might change"],
                  ["u", und100, "Undecided:", "can’t say who they’d vote for"]].map(([k, n, b, t]) => (
                  <div key={k}><span className={"rd-un-sw rd-un-" + k}></span><b className="rd-un-kn">{n}</b><span><b>{b}</b> {t}</span></div>
                ))}
              </div>
            )}
            <p className="rd-note">Approximate: combines {rdList(first.houses)}’s undecided share ({u.toFixed(1)}%) with {rdList(soft.houses)}’s firmness question ({Math.round(sf)}% of those who named a party). Pollsters ask these questions differently.</p>
          </div>
          <RdSub head={(() => { const m = [slopeOf(first), slopeOf(soft)].filter(Boolean); return m.every((f) => f.p >= 0.05 / m.length) ? "Steady since the election" : "Moving since the election"; })()}
                 dek="Each dot is one poll, open rings for after preferences; lines are monthly averages. Undecided voters are counted out of all voters and firmness out of those who named a party, so the two panels have different scales." />
          <div className="rd-un-panels">
            {panel([first, tpp].filter(Boolean), 0, 10, 5, "und", "Undecided", "% of all voters")}
            {soft && panel([soft], 0, 40, 10, "soft", "Not firm", "% of voters who named a party")}
          </div>
          <RdFoot how={{ term: "undecided", from: "Undecided" }}>{changeFoot}</RdFoot>
        </>
      )}
      {view === "party" && partyView && (
        <>
          <div className="card rd-card rd-un-sp">
            <RdShiftPlot rows={partyView.rows} all={F.now.all.v} lo={partyView.lo} hi={partyView.hi}
                         title="Share who call their vote solid" source={"RedBridge, mid-2025 → now"} allLabel={"All voters " + F.now.all.v.toFixed(1) + "%"} />
            <RdKey className="rd-ckey" items={[{ kind: "dot-open", color: "var(--ink-3)", label: "Mid-2025 (" + F.base.from + " to " + F.base.to + ")" },
                                                { kind: "dot-solid", color: "var(--ink-3)", label: "Now (" + F.now.from + " to " + F.now.to + ")" }]}>
              <span className="rd-key-item" style={{ color: "var(--ink-3)" }}>Change in bold: significant</span>
            </RdKey>
            <p className="rd-note">{partyView.note}</p>
          </div>
          <RdSub head={partyView.sub} dek="Share of each party’s voters calling their vote solid, pooled three RedBridge waves at a time; dots are single waves. The dashed line is all voters." />
          <div className="rd-sm-grid rd-un-sm">
            {partyView.ids.map((k) => (
              <div key={k} className="card rd-card rd-sm">
                <div className="rd-sm-top"><span style={{ color: inkOf(D.PARTIES[k].color) }}>{k === "oth" ? "Others" : D.PARTIES[k].name}</span><b>{F.now[k].v.toFixed(1)}%</b></div>
                <TrendChart key={"rd-firm-" + k} heightPx={narrow ? 120 : 140} padPx={{ l: 30, r: 6, t: 10, b: 24 }}
                  xDomain={xDomain} yDomain={[partyView.sLo, partyView.sHi]} yTicks={rdYTicks(partyView.sLo, partyView.sHi, 20)}
                  yTickFmt={(v) => v + "%"} xTicks={rdXTicks(xDomain[0], xDomain[1], true)} baseline
                  series={[{ id: "all", label: "All voters", color: "var(--ink)", dashed: true, dash: "4 3", rdWidth: 1.2, endCap: false, points: partyView.lines.map((w) => ({ x: w.x, y: w.all })) },
                           { id: k, label: D.PARTIES[k].name, color: D.PARTIES[k].color, rdWidth: 2.2, rdCap: 3.5, points: partyView.lines.map((w) => ({ x: w.x, y: w[k] })) }]}
                  spine={partyView.lines.map((w) => ({ x: w.x, y: w[k] }))}
                  scatter={partyView.waves.map((w) => ({ x: w.x, y: w.solid[k], color: D.PARTIES[k].color, label: D.PARTIES[k].name, meta: w }))} pollFacet="twopp"
                  tooltipTitle={(i) => (partyView.lines[i] ? partyView.lines[i].dateLabel : "")} fmt={(v) => v.toFixed(0)}
                  /* the dashed line is keyed only in the sub-head over the grid */
                  copy={{ title: (k === "oth" ? "Others" : D.PARTIES[k].name) + " voters calling their vote solid", sub: "Three RedBridge waves at a time",
                          caption: "Dots are single waves.",
                          legend: [{ label: (k === "oth" ? "Others" : D.PARTIES[k].name) + " voters " + F.now[k].v.toFixed(1) + "%", color: D.PARTIES[k].color, kind: "line" },
                                   { label: "All voters " + F.now.all.v.toFixed(1) + "%", color: "var(--ink)", kind: "dashed" }] }} />
              </div>
            ))}
          </div>
          <RdFoot how={{ term: "undecided", from: "Undecided" }}>Figures pool three waves at a time. Two figures differ significantly when the gap between them is larger than their two margins combined.</RdFoot>
        </>
      )}
      {view === "age" && ageView && (
        <>
          <div className="card rd-card rd-un-sp">
            <RdShiftPlot rows={ageView.rows} all={ageView.allNow} lo={ageView.lo} hi={ageView.hi}
                         title="Share not firm, by age" source="Resolve, mid-2025 → now" allLabel={"All voters " + Math.round(ageView.allNow) + "%"} />
            <RdKey className="rd-ckey" items={[{ kind: "dot-open", color: "var(--ink-3)", label: "Mid-2025 (" + A.base.from + " to " + A.base.to + ")" },
                                                { kind: "dot-solid", color: "var(--ink-3)", label: "Now (" + A.now.from + " to " + A.now.to + ")" }]}>
              <span className="rd-key-item" style={{ color: "var(--ink-3)" }}>Change in bold: significant</span>
            </RdKey>
            <p className="rd-note">{ageView.note}</p>
          </div>
          <RdSub head={ageView.sub} dek="Share of each age group who named a party but aren’t firm, pooled three Resolve waves at a time; dots are single waves. The dashed line is all voters." />
          <div className="card rd-card rd-un-age">
            <TrendChart key="rd-soft-age" heightPx={narrow ? 240 : 250} padPx={narrow ? { l: 34, r: 8, t: 14, b: 28 } : { l: 40, r: 12, t: 14, b: 30 }}
              xDomain={xDomain} yDomain={[0, 40]} yTicks={rdYTicks(0, 40, 10)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
              xTicks={rdXTicks(xDomain[0], xDomain[1], narrow)} baseline
              series={[{ id: "all", label: "All voters", color: "var(--ink)", dashed: true, dash: "4 3", rdWidth: 1.4, endCap: false,
                         points: soft ? filterPts(soft.monthly, xDomain[0]).map((m) => ({ x: m.x, y: m.v })) : [], endLabel: narrow ? null : "All voters" },
                       ...ageView.B.map((b, i) => ({ id: b.id, label: b.label, color: ageView.grey(i), rdWidth: 2.2, rdCap: 3.5,
                         points: ageView.lines.map((w) => ({ x: w.x, y: w[b.id] })), endLabel: narrow ? null : b.label }))]}
              spine={ageView.lines.map((w) => ({ x: w.x, y: w["18-34"] }))}
              scatter={ageView.waves.flatMap((w) => ageView.B.map((b, i) => ({ x: w.x, y: w.soft[b.id], color: ageView.grey(i), label: b.label, meta: w })))} pollFacet="twopp"
              tooltipTitle={(i) => (ageView.lines[i] ? ageView.lines[i].dateLabel : "")} fmt={(v) => v.toFixed(0)}
              /* a phone names none of these greys on the chart, so the copy
                 keys them, and carries the sub-head's words about the pooling */
              copy={{ title: "Voters not firm, by age", sub: "Share of each age group who named a party but aren’t firm",
                      caption: "Pooled three Resolve waves at a time; dots are single waves.",
                      legend: ageView.B.map((b, i) => ({ label: b.label, color: ageView.grey(i), kind: "line" }))
                        .concat([{ label: "All voters", color: "var(--ink)", kind: "dashed" }]) }} />
          </div>
          <RdFoot how={{ term: "undecided", from: "Undecided" }}>Figures pool three waves at a time. Two figures differ significantly when the gap between them is larger than their two margins combined.</RdFoot>
        </>
      )}
      </RdCrossfade>
    </RdSec>
  );
}

Object.assign(window, { RdPrimary, rdShareWords, rdPartyIn, rdPartyStart, rdElectionTicks, RdLeadership, RdHeadBar, RdDirection, rdList, rdRoughPts, RdDemographics, RdSwitching, useRdWidth, RdIssues, RdUndecided, RdShiftPlot, rdOneIn });
