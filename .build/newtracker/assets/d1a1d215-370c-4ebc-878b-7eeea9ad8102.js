/* auspol tracker – tabbed views: Tabs nav (with docked 2PP score), Past cycles overlay, All polls archive */

// ---- CSV export plumbing, shared by the archive and the past-cycles download ----
const csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
// rows = array of arrays, first row the header. Leading BOM so Excel opens
// UTF-8 without mangling the en dashes in fieldwork labels.
const csvText = (rows) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
const downloadCsv = (filename, rows) => {
  const blob = new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path>
  </svg>
);

// ====================================================================
// TabScore – compact 2PP readout docked at the right of the tab bar.
// Appears once the bar pins to the viewport top, on EVERY tab – the
// national score travels with you. Click = jump to the Snapshot hero.
// The contest shown FOLLOWS the hero's 2PP switch (App owns that state and
// hands it down): the same definitions and the same nowcast accessor as the
// hero readout, so the two figures can never disagree.
// ====================================================================
function TabScore({ onGoHero, matchup }) {
  const MM = window.AP.tppMatchups;
  // anything unrecognised (or a matchup with no current figure) falls back
  // to the headline contest – the hero itself never offers one without data
  const id = MM && MM[matchup] && window.AP.tppLatest(matchup) ? matchup : "alp_lnp";
  const M = MM[id], v = window.AP.tppLatest(id);
  return (
    <button className="tab-score" onClick={onGoHero}
            title={"Latest " + M.label + " two-party preferred – go to Snapshot"}>
      <span className="ts-eyebrow">2PP</span>
      <span className="ts-party">
        <span className="ts-abbr">{M.a.abbr}</span>
        <span className="ts-num" style={{ color: inkOf(M.a.color) }}>{v.a.toFixed(1)}</span>
      </span>
      <span className="ts-sep" aria-hidden="true"></span>
      <span className="ts-party">
        <span className="ts-num" style={{ color: inkOf(M.b.color) }}>{v.b.toFixed(1)}</span>
        <span className="ts-abbr">{M.b.abbr}</span>
      </span>
    </button>
  );
}

// ====================================================================
// Tabs – editorial underlined nav beneath the header
// ====================================================================
function Tabs({ tabs, active, onChange, tppMatchup }) {
  // Sticky on every view. Once pinned, a compact 2PP score docks into the
  // right side of the bar – the headline number stays visible on every tab.
  const [pinned, setPinned] = React.useState(false);
  const sentRef = React.useRef(null);
  const btnRefs = React.useRef({});

  /* Arrow-key navigation. Without it the role="tab" markup was a promise the
     widget didn't keep: a screen reader announced "tab, 1 of 3" and then the
     arrow keys – the only way the pattern says to move between tabs – did
     nothing. Selection follows focus, which is the right call here because
     switching views is instant and has no side effects. */
  const onTabKeyDown = (e) => {
    const ids = tabs.map((t) => t.id);
    const i = ids.indexOf(active);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const el = btnRefs.current[next];
    if (el) el.focus();
  };

  // The docked score is a shortcut home: switch to Snapshot (where the 2PP
  // hero lives) and ride to the top. If already on Snapshot, just glide up.
  const goHero = () => {
    if (active !== "snapshot") onChange("snapshot");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // A zero-height sentinel sits at the tab bar's natural flow position. When it
  // scrolls above the viewport top, the sticky bar has caught the top edge –
  // flip pinned so it can condense and lift off the content.
  React.useEffect(() => {
    const el = sentRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => setPinned(!e.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <React.Fragment>
      <div ref={sentRef} className="tabs-sentinel" aria-hidden="true"></div>
      {/* role="tablist" belongs on the element that actually OWNS the tabs. It
          used to sit on the <nav>, two wrappers up, which both broke the
          ownership the pattern requires and overwrote the nav's landmark. */}
      <nav className={"tabs sticky" + (pinned ? " pinned" : "")} aria-label="Views">
        <div className="tabs-inner">
          <div className="tabs-set" role="tablist" aria-label="Views"
               onKeyDown={onTabKeyDown}>
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id}
                      id={"tab-" + t.id} aria-controls={"panel-" + t.id}
                      /* roving tabindex: the tab strip is ONE tab stop and the
                         arrow keys move within it, per the ARIA tabs pattern */
                      tabIndex={active === t.id ? 0 : -1}
                      ref={(el) => { btnRefs.current[t.id] = el; }}
                      className={"tab" + (active === t.id ? " active" : "")}
                      onClick={() => onChange(t.id)}>
                <span className="tab-label">{t.label}</span>
                {t.note != null && <span className="tab-note">{t.note}</span>}
              </button>
            ))}
          </div>
          <TabScore onGoHero={goHero} matchup={tppMatchup} />
        </div>
      </nav>
    </React.Fragment>
  );
}

// ====================================================================
// PAST CYCLES – every term aligned to its election day
// ====================================================================
// y-windows are fitted to the real data per metric+mode (see cycDomain) –
// fixed windows clip real history (e.g. net approval spans −44…+41)
const CYC_METRICS = [
  { key: "net", title: "Leader net approval", sub: "Sitting prime minister · approve minus disapprove",
    unit: "", fmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    step: 20, refAbs: 0, refAbsLabel: "even" },
  { key: "oppnet", title: "Opposition leader net approval", sub: "Sitting opposition leader · approve minus disapprove",
    leader: "opp", unit: "", fmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    step: 10, refAbs: 0, refAbsLabel: "even", han: true },
  { key: "primary", title: "Government primary vote", sub: "First-preference support for the governing party",
    unit: "%", fmt: (v) => v.toFixed(1),
    step: 5, refAbs: null },
  { key: "tpp", title: "Government two-party preferred", sub: "Governing party 2PP",
    unit: "%", fmt: (v) => v.toFixed(1),
    step: 5, refAbs: 50, refAbsLabel: "50 – tie" },
];

// domain over ALL cycles (not just visible ones) so toggling a cycle off
// never rescales the chart under the pointer
// a cycle's baseline for "change since" mode: its election-day anchor where it
// has one, else its first actual reading – measures that start late (leader
// approval) have no month-0 value to subtract
const cycBase = (c, key) => {
  const v = c.base[key];
  if (v != null) return v;
  const first = c.raw[key].find((x) => x != null);
  return first != null ? first : 0;
};

function cycDomain(cycles, M, chg) {
  const vals = cycles.flatMap((c) => c.raw[M.key]
    .filter((v) => v != null)
    .map((v) => (chg ? v - cycBase(c, M.key) : v)));
  // Hanson joins the domain whether or not her box is ticked, for the same
  // reason hidden cycles do: ticking a box should reveal a line, not rescale
  // the axis under the pointer.
  if (M.han) vals.push(...cycles.flatMap((c) => (c.raw.han || [])
    .filter((v) => v != null)
    .map((v) => (chg ? v - cycBase(c, "han") : v))));
  const ref = chg ? 0 : M.refAbs;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (ref != null) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
  const step = M.step;
  const d0 = Math.floor((lo - step * 0.3) / step) * step;
  const d1 = Math.ceil((hi + step * 0.3) / step) * step;
  const ticks = [];
  for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
  return { domain: [d0, d1], ticks };
}

const CYC_XDOMAIN = [-1.6, 37.6];
const CYC_XTICKS = [
  { x: 0, label: "Election" }, { x: 12, label: "1 yr" },
  { x: 24, label: "2 yrs" }, { x: 36, label: "3 yrs" },
];
const CYC_SPINE = [];
for (let m = 0; m <= 36; m++) CYC_SPINE.push({ x: m });

function cycMonthLabel(m) {
  if (m <= 0) return "Election day";
  if (m % 12 === 0) return (m / 12) + (m === 12 ? " year in" : " years in");
  return m + " months in";
}

/* The calendar month a cycle month lands on. Only ever shown when a single
   cycle is on the chart: with six terms overlaid, "month 11" is the whole
   point of the alignment and a date would belong to only one of them. Alone,
   the reader is looking at one term and counting forward from an election date
   they have to remember is work the tooltip can just do.
   Named from the election month rather than by adding days, because the
   buckets behind the line are averaged months (365.25/12) - this is the month
   the bucket sits in, not an exact date. */
function cycMonthOf(eDate, m) {
  const [y, mo] = eDate.split("-").map(Number);
  const t = (mo - 1) + Math.max(0, m);
  return window.AP.D.monthNameFull((t % 12) + 1) + " " + (y + Math.floor(t / 12));
}

/* Events pinned to one term, drawn only while that term stands alone on the
   chart: overlaid with five other cycles a date belongs to no single line.
   x is derived from the cycle's election date at render, in the same
   months-since-election units as the cycles themselves. An optional metrics
   whitelist pins the event to those chart measures alone. */
const cycEventMonth = (iso, eDate) => (Date.parse(iso) - Date.parse(eDate)) / 86400000 / MS_MONTH_C;
const CYC_EVENTS = {
  2010: [
    {
      date: "2010-12-15", short: "Refugee tragedy",
      label: "Boat sinks off Christmas Island",
      desc: "A boat loaded with refugees sinks off Christmas Island, killing 48 people aboard. The tragedy provoked criticism of the Gillard government’s refugee policy.",
      major: true,
    },
    {
      date: "2011-02-24", short: "Carbon pricing scheme",
      label: "Gillard announces a carbon pricing scheme",
      desc: "To combat climate change, Gillard announced a plan to legislate for the introduction of a fixed price to be imposed on carbon pollution from 1 July 2012. The Clean Energy Act 2011 was enacted on 18 November.",
      major: true,
    },
  ],
  2013: [
    {
      date: "2013-11-18", short: "Indonesia spy row",
      label: "Indonesia recalls ambassador over spying revelations",
      desc: "Indonesia recalls its ambassador after leaked documents reveal Australia spied on president Susilo Bambang Yudhoyono.",
      major: true,
    },
    {
      date: "2014-05-13", short: "Hockey’s first budget",
      label: "Joe Hockey delivers the 2014 federal budget",
      desc: "Treasurer Joe Hockey delivers the Abbott government’s first federal budget with deep cuts to health, education, and welfare.",
      major: true,
    },
    {
      date: "2015-01-26", short: "Prince Philip knighted",
      label: "Abbott announces knighthood for Prince Philip",
      desc: "Prime Minister Tony Abbott awards Prince Philip a knighthood in the Order of Australia, drawing widespread ridicule.",
      major: true,
    },
    {
      date: "2015-09-15", short: "Abbott → Turnbull",
      label: "Turnbull replaces Abbott as prime minister",
      desc: "Malcolm Turnbull defeats Tony Abbott in a Liberal leadership spill and is sworn in as prime minister.",
      major: true,
    },
  ],
  2016: [
    {
      date: "2017-10-17", short: "Clean Energy Target dumped",
      label: "Coalition dumps the Clean Energy Target",
      desc: "The Coalition dumps the Clean Energy Target in favour of Malcolm Turnbull’s new plan, a National Energy Guarantee.",
      major: true,
    },
    {
      date: "2017-11-15", short: "Marriage survey Yes vote",
      label: "Marriage postal survey returns a Yes vote",
      desc: "The Australian Marriage Law Postal Survey delivers a national Yes vote for same-sex marriage.",
      major: true,
    },
    {
      date: "2018-07-28", short: "Super Saturday by-elections",
      label: "Super Saturday by-elections return every incumbent",
      desc: "Five federal by-elections return every incumbent – Labor holds Braddon, Fremantle, Longman and Perth, and Centre Alliance holds Mayo, with the Coalition winning none.",
      major: true,
    },
    {
      date: "2018-08-21", short: "Dutton challenges Turnbull",
      label: "Dutton mounts a leadership challenge",
      desc: "Home Affairs minister Peter Dutton challenges Malcolm Turnbull for the Liberal leadership, losing the spill 48 votes to 35.",
      major: true,
    },
    {
      date: "2018-08-24", short: "Turnbull → Morrison",
      label: "Morrison replaces Turnbull as prime minister",
      desc: "Malcolm Turnbull resigns and Scott Morrison defeats Peter Dutton in the Liberal leadership spill, becoming prime minister.",
      major: true,
    },
  ],
  2019: [
    {
      date: "2019-11-09", short: "Bushfire emergency",
      label: "Queensland declares a state of emergency",
      desc: "Queensland declares a state of emergency amid catastrophic bushfire conditions – two days before NSW follows.",
      major: true,
    },
    {
      date: "2020-03-11", short: "COVID-19 pandemic",
      label: "WHO declares COVID-19 a pandemic",
      desc: "The World Health Organization declares the COVID-19 outbreak a pandemic.",
      major: true,
    },
    {
      date: "2021-02-15", short: "Higgins allegations",
      label: "Brittany Higgins goes public",
      desc: "Former Liberal staffer Brittany Higgins goes public with allegations that she was raped inside Parliament House.",
      major: true,
    },
  ],
  2022: [
    {
      date: "2023-10-14", short: "Voice referendum defeated",
      label: "Voice to Parliament referendum defeated",
      desc: "Australians vote No to enshrining an Aboriginal and Torres Strait Islander Voice to Parliament in the Constitution – the proposal fails nationally and in every state.",
      major: true,
    },
    {
      date: "2023-11-07", short: "RBA cash rate hits 4.35%",
      label: "RBA hikes the cash rate to a 12-year high",
      desc: "The RBA board hikes the cash rate 25 basis points to 4.35% – the central bank’s 13th rate rise since May 2022, widely anticipated by economists.",
      major: true,
    },
    {
      date: "2025-03-28", short: "Election called",
      label: "Albanese announces the federal election",
      desc: "Albanese announces the federal election, kicking off a campaign that produced a dramatic rise in Labor support.",
      major: true,
    },
  ],
  2025: [
    {
      date: "2025-05-28", short: "1st Coalition split",
      label: "First Coalition dissolution",
      desc: "The Liberal–National Coalition dissolves for the first time, weeks after the 2025 election defeat.",
      major: true,
    },
    {
      date: "2025-12-14", short: "Bondi shooting",
      label: "Bondi Beach shooting",
      desc: "A shooting at Bondi Beach in Sydney.",
      major: true,
    },
    {
      date: "2026-01-22", short: "2nd Coalition split",
      label: "Coalition dissolves again",
      desc: "Second dissolution of the Liberal–National Coalition.",
      major: true,
    },
    {
      date: "2026-02-12", short: "Ley → Taylor",
      label: "Taylor replaces Ley as opposition leader",
      desc: "Angus Taylor replaces Sussan Ley as Leader of the Liberal Party and Opposition Leader.",
      major: true,
      metrics: ["oppnet"],
    },
    {
      date: "2026-05-12", short: "2026 Budget",
      label: "2026 federal Budget",
      desc: "Treasurer Jim Chalmers delivers the Albanese government’s fifth federal budget, with sweeping CGT changes.",
      major: true,
    },
  ],
};

/* ---- the readings behind a cycle's line --------------------------------
   These charts are monthly averages, and an average is a claim about polls
   the reader cannot see. Narrow the board to ONE term and they appear: the
   cloud under a line is what the line is made of, and how much it is
   scattering is half of what a term's trajectory means.

   One and not a handful, because a cloud is a much heavier mark than a line.
   Two lines cross and stay legible; two clouds occupy the same space and
   become one, and the reader has to decode which points belong to which term
   before they can read either. A single term has nothing to disentangle, and
   is also the moment the reader has said they want to look closely.

   Same rule as the line it sits under, in both directions: a favourability
   net never joins an approve-minus-disapprove cloud, and the election-day row
   is not a poll, so neither is a dot. */
const CYC_DOT_MAX = 1;
const MS_MONTH_C = 365.25 / 12;

/* The same month-bucket test cycleSeries applies when it builds the line, not
   a lookalike: the cloud is meant to BE what the line is made of, so a poll
   the line counts and the dot drops (or the reverse) is a contradiction on
   one chart. No row disagrees today; expressing it twice is how that stops
   being true later. */
const inCycleRange = (m) => { const k = Math.round(m); return k >= 0 && k <= 36; };

function cycDotDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + window.AP.D.monthName(m) + " " + y;
}

function cycleReadings(c, M, D) {
  const out = [];
  const key = M.key, isOpp = M.leader === "opp";
  if (c.current) {
    const mOf = (iso) => (Date.parse(iso) - Date.parse(c.eDate)) / 86400000 / MS_MONTH_C;
    for (const p of D.individualPolls) {
      const mb = (p.appr && p.appr.metricBy) || {};
      let y = null;
      if (key === "primary") y = p.p ? p.p[c.gov] : null;
      else if (key === "tpp") y = p[c.gov];
      else if (key === "net") y = (mb.alb || "approval") === "fav" ? null : (p.appr ? p.appr.albNet : null);
      else if (key === "oppnet") y = (mb.taylor || "approval") === "fav" ? null : (p.appr ? p.appr.taylorNet : null);
      if (y == null) continue;
      out.push({ x: mOf(p.released), y,
                 meta: { pollster: p.pollster, dateLabel: p.dateLabel, sample: p.sample, released: p.released } });
    }
    return out;
  }
  const src = (D.cycleSource || {})[c.year];
  if (!src) return out;
  if (key === "primary" || key === "tpp") {
    const f = key === "tpp" ? "tpp_" + c.gov : c.gov;
    for (const p of src.polls) {
      if (p[f] == null || p.firm === "Election" || !inCycleRange(p.m)) continue;
      out.push({ x: p.m, y: p[f], meta: { pollster: p.firm, dateLabel: cycDotDate(p.date) } });
    }
  } else {
    const f = isOpp ? "oppNet" : "pmNet";
    for (const r of src.approval) {
      if (r[f] == null || r.metric === "fav" || !inCycleRange(r.m)) continue;
      out.push({ x: r.m, y: r[f], meta: { pollster: r.firm, dateLabel: cycDotDate(r.date) } });
    }
  }
  return out;
}

/* ---- where the line runs between readings, not through them -------------
   cycleSeries interpolates a month nothing was polled in, and a solid line
   through that point claims a measurement that was never taken. Rare - four
   single months across every past cycle and metric - which is exactly why it
   is worth marking: a dash here is a real signal about those four months,
   not a caveat smeared over the whole chart.

   The line is split into runs and handed over as several series, because
   `dashed` applies to a whole stroke. Consecutive runs SHARE their boundary
   point so the line stays visually continuous across the change, and every
   run keeps the cycle's own label - the tooltip collapses them back into the
   one row the reader thinks they are hovering.

   A segment is dashed when EITHER end is an unpolled month: both the approach
   to an invented point and the departure from it are drawn between readings,
   and dashing only one side would point at the wrong half. */
function obsRuns(pts, observed) {
  if (pts.length < 2) return [{ dashed: false, points: pts }];
  const runs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dashed = !(observed(pts[i].x) && observed(pts[i + 1].x));
    const last = runs[runs.length - 1];
    if (last && last.dashed === dashed) last.points.push(pts[i + 1]);
    else runs.push({ dashed, points: [pts[i], pts[i + 1]] });
  }
  return runs;
}

/* Shape is assigned WITHIN a colour, not across the board: the point is to
   separate two Coalition terms from each other, and giving the lone Labor
   term beside them a triangle would be decoration standing in for a
   distinction that colour already makes. So the first term of each party
   keeps circles and only a second and third need a shape of their own.

   DORMANT at CYC_DOT_MAX = 1: one term on the board is one colour, so every
   cloud drawn today is circles. Kept because the rule is the hard part and
   the threshold is one number - raise it and two same-coloured terms are
   still told apart, in the legend and on the chart, without rediscovering
   why colour alone could not do it. */
const CYC_SHAPES = ["circle", "triangle", "diamond"];
function cycShapes(shown) {
  const seen = {}, out = {};
  for (const c of shown) {
    const n = (seen[c.color] = (seen[c.color] || 0) + 1);
    out[c.year] = CYC_SHAPES[n - 1] || "circle";
  }
  return out;
}

// linear-interpolate quarterly (or monthly) anchors onto a 0..maxM month grid.
// Only KNOWN anchors are interpolated between: a measure can start late (the
// Morrison term's first reading is month 2, and its 2016 predecessor's opens
// on the election), and those months stay null rather than borrowing the
// first reading.
function toMonthly(months, vals, maxM) {
  const anchors = [];
  for (let i = 0; i < months.length; i++) {
    if (vals[i] != null) anchors.push({ m: months[i], v: vals[i] });
  }
  const out = [];
  for (let m = 0; m <= maxM; m++) {
    if (!anchors.length || m < anchors[0].m || m > anchors[anchors.length - 1].m) {
      out.push({ x: m, y: null });
      continue;
    }
    let k = 0;
    while (k < anchors.length - 1 && anchors[k + 1].m <= m) k++;
    const a = anchors[k], b = anchors[Math.min(k + 1, anchors.length - 1)];
    const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
    out.push({ x: m, y: +(a.v + (b.v - a.v) * t).toFixed(2) });
  }
  return out;
}

function CycleChart({ metric, cycles, mode, hidden, hi, showHan, setHan, shapes }) {
  const { D } = window.AP;
  const M = metric;
  const chg = mode === "chg";
  const isOpp = M.leader === "opp";

  /* Hanson is available only where the data is: the current cycle, and only
     from rows whose metric is approval. hanAvail gates both the line and the
     tickbox, so if the readings are ever removed the control disappears with
     them rather than offering an empty line. */
  const HAN_COLOR = D.PARTIES.onp.color;
  const hanCycle = M.han ? cycles.find((c) => c.current) : null;
  const hanRaw = (hanCycle && hanCycle.raw.han) || null;
  const hanAvail = !!(hanRaw && hanRaw.some((v) => v != null));
  /* Name the first READING, not the first month bucket it lands in: the
     earliest rating is 19 Feb 2026, which rounds into the month-10 bucket
     centred on early March, and a provenance note that says "March" about a
     February poll is exactly the kind of small lie this page tries not to
     tell. */
  const hanFrom = hanAvail ? (() => {
    const dates = D.individualPolls
      .filter((p) => p.appr && p.appr.hansonNet != null &&
                     (!p.appr.metricBy || p.appr.metricBy.hanson !== "fav"))
      .map((p) => p.released)
      .sort();
    if (!dates.length) return null;
    return new Date(dates[0] + "T00:00:00")
      .toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  })() : null;

  // build a monthly series per visible cycle. Past cycles are tinted by the
  // governing party (red Labor / blue Coalition terms) at reduced opacity and
  // carry a year label at the line's end – identifiable at rest, not only on
  // hover, which uniform grey reference lines couldn't manage with real data.
  const shown = cycles.filter((c) => !hidden.has(c.year));
  /* One cycle left on the chart: the year on every readout row is then drawing
     a distinction against nothing, so the row keeps the leader alone and the
     title takes the calendar month instead. */
  const solo = shown.length === 1 ? shown[0] : null;
  const soloEvents = solo
    ? (CYC_EVENTS[solo.year] || [])
        .filter((e) => !e.metrics || e.metrics.includes(M.key))
        .map((e) => ({ ...e, x: cycEventMonth(e.date, solo.eDate) }))
    : [];
  /* Hanson's control belongs to HER cycle alone: no past term rated her, so
     the tickbox appears only when the current term stands solo, and the line
     follows the same gate – widening back to every cycle drops her line with
     the control instead of leaving a line nothing on screen can switch off. */
  const hanCtl = M.han && hanAvail && solo === hanCycle;
  const built = shown.flatMap((c) => {
    const base = cycBase(c, M.key);
    const monthly = toMonthly(c.raw.months, c.raw[M.key], c.span);
    // months with no reading are dropped, so the line begins where the polling
    // does instead of running flat out of a value that was never measured
    const pts = monthly.filter((p) => p.y != null)
      .map((p) => ({ x: p.x, y: chg ? +(p.y - base).toFixed(2) : p.y }));
    const isHi = hi === c.year;
    const dim = hi != null && !isHi && !c.current;
    let width, weight, opacity, labOp;
    if (c.current) { width = isHi ? 4 : 3.6; weight = 3; opacity = 1; labOp = 1; }
    else if (isHi) { width = 3; weight = 2; opacity = 1; labOp = 1; }
    else { width = 1.7; weight = dim ? 0 : 1; opacity = dim ? 0.13 : 0.42; labOp = dim ? 0.2 : 0.75; }
    const leadName = isOpp ? c.oppLead : c.lead;
    const label = solo ? leadName : c.year + " · " + leadName;
    /* Months are the x values, and `months` is 0..n, but look the index up
       rather than assume it: the flags have to describe the same month the
       point does or the dash lands on the wrong segment. Absent obs data
       (an older payload) marks nothing, so the line just stays solid. */
    const flags = (c.raw.obs || {})[M.key];
    const observed = (m) => {
      if (!flags) return true;
      const i = c.raw.months.indexOf(m);
      return i < 0 ? true : !!flags[i];
    };
    /* The dash says the line is crossing a gap; this says what the number in
       the readout is. Without it the tooltip hands back a flat figure for a
       month nobody polled, which is the whole thing being marked. Only the
       unpolled month itself is annotated - the readings either side of it are
       real, and the dedupe hands each boundary month to its solid run first. */
    if (flags) pts.forEach((p) => { if (!observed(p.x)) p.note = "no poll · interpolated"; });
    const runs = obsRuns(pts, observed);
    return runs.map((run, i) => ({
      id: "c" + c.year + (i ? "-" + i : ""), label, color: c.color, width,
      points: run.points, weight, current: c.current, opacity, dashed: run.dashed,
      // the end label and the end-cap dot belong to the LINE, so only its
      // last run carries them – otherwise a split line grows a dot and a
      // year at every run boundary
      ...(i === runs.length - 1
        ? { endLabel: "’" + String(c.year).slice(2), endLabelOpacity: labOp }
        : { endCap: false }),
    }));
  });
  /* The polls the lines are averages of, once the board is narrow enough to
     read them. Each cloud takes its line's colour and shape, and follows it
     into "change since election" mode - a cloud left on absolute levels under
     a line drawn as change would agree with it nowhere. Dimming a cycle takes
     its dots down with it, or a faded line ends up with a louder cloud than
     the one being pointed at. */
  const dotsOn = !!shapes && shown.length > 0 && shown.length <= CYC_DOT_MAX;
  /* Memoised on the things that actually move a dot. The 2010 term alone is
     402 points of primary vote on one chart, still well past the ~240 this
     scatter was built for, and a fresh array on every unrelated render - a
     tooltip opening, a sibling chart re-rendering - hands React 402 new
     elements to reconcile each time. The key is the shown years rather than
     the array, since `shown`, `shapes` and `solo` are all rebuilt every
     render and all three are decided by exactly that list. */
  const shownKey = shown.map((c) => c.year).join(",");
  const scatter = React.useMemo(() => (!dotsOn ? [] : shown.flatMap((c) => {
    const base = cycBase(c, M.key);
    const leadName = isOpp ? c.oppLead : c.lead;
    const label = solo ? leadName : c.year + " · " + leadName;
    const dim = hi != null && hi !== c.year && !c.current;
    return cycleReadings(c, M, D).map((p) => ({
      x: p.x, y: chg ? +(p.y - base).toFixed(2) : p.y,
      color: c.color, shape: shapes[c.year], label, meta: p.meta, op: dim ? 0.3 : 1,
    }));
  })), [dotsOn, shownKey, M.key, isOpp, chg, hi]);
  /* Hanson – one line, not one per cycle. She has been rated for part of the
     current term and in no term before it, so there is no past-cycle
     counterpart to draw and nothing to align her against. Points come straight
     off the sparse series: a month with no reading contributes no vertex, so
     the line spans the gap without the tooltip claiming a value there. Straight
     segments rather than the usual spline – with this few readings a curve
     invents motion between them. */
  if (hanCtl && showHan) {
    const hBase = cycBase(hanCycle, "han");
    const pts = hanCycle.raw.months
      .map((m, i) => ({ x: m, y: hanRaw[i] }))
      .filter((p) => p.y != null)
      .map((p) => ({ x: p.x, y: chg ? +(p.y - hBase).toFixed(2) : p.y }));
    const dimmed = hi != null && !hanCycle.current;
    built.push({
      id: "cyc-han", label: "Hanson · One Nation", color: HAN_COLOR,
      width: 2.2, points: pts, weight: 2.5, smooth: false, dashed: true,
      opacity: dimmed ? 0.2 : 0.9,
      endLabel: "PH", endLabelOpacity: dimmed ? 0.2 : 0.85,
    });
  }

  // draw muted first, highlighted, current last (on top)
  built.sort((a, b) => a.weight - b.weight);

  const { domain, ticks } = cycDomain(cycles, M, chg);
  const refY = chg ? 0 : M.refAbs;
  const refLabel = chg ? "Election result" : M.refAbsLabel;
  const refLines = refY != null ? [{ y: refY, label: refLabel, color: "var(--ink-faint)", align: "left" }] : [];

  // insight: current government vs the average past government at the same month
  const cur = cycles.find((c) => c.current);
  let insight = null;
  if (cur && !hidden.has(cur.year)) {
    const mNow = cur.span;
    const curVal = chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key];
    // a peer only counts if it was actually measured at this month – comparing
    // against a cycle whose approval series hadn't started yet is comparing
    // against nothing
    const peers = cycles.filter((c) => !c.current && c.span >= mNow).map((c) => {
      const mly = toMonthly(c.raw.months, c.raw[M.key], c.span);
      const v = mly[mNow] ? mly[mNow].y : null;
      if (v == null) return null;
      return chg ? v - cycBase(c, M.key) : v;
    }).filter((v) => v != null);
    if (peers.length) {
      const avg = peers.reduce((s, v) => s + v, 0) / peers.length;
      const d = curVal - avg;
      const better = d >= 0;
      const subjLabel = isOpp ? `the ${D.PARTIES[cur.opp].name} opposition` : D.PARTIES[cur.gov].name;
      insight = { d: Math.abs(d), better, mNow, subjLabel, peerNoun: isOpp ? "opposition" : "government" };
    }
  }

  return (
    <section className="card cycle-card">
      <div className="card-head cycle-head">
        <div>
          <h2 className="card-title">{M.title}</h2>
          <p className="card-sub">{M.sub}</p>
          {hanCtl && (
            <label className={"cyc-han" + (showHan ? " on" : "")}
                   title={"Pauline Hanson, on the same approve-minus-disapprove basis. " +
                          "Rated in the current term only, from " + hanFrom + " – no past cycle asked about her, " +
                          "and favourability ratings are left out, so the line is short."}>
              <input type="checkbox" checked={!!showHan}
                     onChange={(e) => setHan(e.target.checked)} />
              Hanson
            </label>
          )}
        </div>
        {insight && (() => {
          /* Prose, not a table cell: a gap of exactly nine points reads as
             "9%", not "9.0%", and the sign is dropped because the
             "above"/"below" that follows already carries the direction
             (M.fmt keeps its decimal for the chart's tooltips). */
          const shown = M.fmt(insight.d).replace(/^[+−-]/, "").replace(/\.0+$/, "");
          /* A gap that ROUNDS AWAY has to change the sentence, not just the
             number: "sits 0 above the average" states a difference and denies
             it in the same breath. Tested on the rendered string rather than
             on d, because rounding is what the reader sees – 0.4 points prints
             as 0, and "in line with" is what 0.4 points means. */
          const level = parseFloat(shown) === 0;
          if (level) return (
            <p className="cycle-insight">
              {cycMonthLabel(insight.mNow)}, {insight.subjLabel} is{" "}
              <span className="ci-delta level">in line with</span>{" "}
              the average {insight.peerNoun} at this point.
            </p>
          );
          return (
            <p className="cycle-insight">
              {cycMonthLabel(insight.mNow)}, {insight.subjLabel} sits{" "}
              <span className={"ci-delta " + (insight.better ? "pos" : "neg")}>
                {shown}{M.unit}
              </span>{" "}
              {insight.better ? "above" : "below"} the average {insight.peerNoun} at this point.
            </p>
          );
        })()}
      </div>
      <TrendChart
        key={"cyc-" + M.key + "-" + mode}
        height={300} xDomain={CYC_XDOMAIN} yDomain={domain} yTicks={ticks}
        unit={M.unit} axisFont={20}
        pad={{ l: 56, r: 44, t: 16, b: 40 }}
        xTicks={CYC_XTICKS} refLines={refLines}
        series={built} spine={CYC_SPINE} scatter={scatter} events={soloEvents}
        tooltipTitle={(i) => cycMonthLabel(CYC_SPINE[i].x)
                             + (solo ? " – " + cycMonthOf(solo.eDate, CYC_SPINE[i].x) : "")}
        fmt={M.fmt}
      />
    </section>
  );
}

function CycleLegend({ cycles, hidden, hi, setHi, toggle, showAll, hideAll, shapes }) {
  const anyHidden = hidden.size > 0;
  return (
    <div className="cyc-legend" onMouseLeave={() => setHi(null)}>
      <div className="cyc-legend-row">
        {cycles.map((c) => {
          const off = hidden.has(c.year);
          return (
            <button key={c.year} type="button"
                    className={"cyc-chip" + (off ? " off" : "") + (c.current ? " current" : "")}
                    /* --cyc paints the chip border and tint; --cyc-text is the
                       same party at the text threshold, for the "now" badge */
                    style={{ "--cyc": c.color, "--cyc-text": inkOf(c.color) }}
                    aria-pressed={!off}
                    onMouseEnter={() => setHi(c.year)} onFocus={() => setHi(c.year)}
                    onClick={() => toggle(c.year)}>
              {/* the swatch takes the same shape as the term's dots, or the
                  cloud under two same-coloured lines is undecodable */}
              <span className={"cyc-swatch" + (shapes && shapes[c.year] && shapes[c.year] !== "circle"
                                               ? " sw-" + shapes[c.year] : "")}
                    style={{ background: c.color }}></span>
              <span className="cyc-year">{c.year}</span>
              <span className="cyc-lead">{c.lead}</span>
              {c.current && <span className="cyc-now">Now</span>}
            </button>
          );
        })}
      </div>
      {/* One control, both directions. "Show all" existed on its own, so
          clearing the board meant unpicking six chips one at a time – and the
          reason to clear it is the same reason the chips exist: to compare two
          terms without the other four behind them. */}
      <button type="button" className="cyc-showall"
              onClick={anyHidden ? showAll : hideAll}>
        {anyHidden ? "Show all cycles" : "Remove all cycles"}
      </button>
    </div>
  );
}

/* ---- Past-cycles downloads --------------------------------------------
   The charts here are monthly aggregates of polls taken up to sixteen years
   ago, and until now nothing on the page let you see the readings underneath
   them or check the alignment. Two files rather than one, because they answer
   different questions: the series is what is plotted, the source rows are
   where it came from.

   Both are keyed by CYCLE year – the election that STARTED the term, which is
   what the legend calls each line. That matters: internally the voting-intention
   rows are stored under the election that ENDED the term. Exporting the storage
   keys would misalign the two halves by a full parliament. */
function cycleSeriesRows(cycles) {
  const rows = [[
    "cycle", "government", "prime_minister", "opposition_leader", "is_current",
    "months_since_election", "govt_primary_pct", "govt_2pp_pct",
    "pm_net_approval", "opp_leader_net_approval", "hanson_net_approval",
  ]];
  cycles.forEach((c) => {
    const r = c.raw;
    r.months.forEach((m, i) => rows.push([
      c.year, c.gov === "alp" ? "Labor" : "Coalition", c.pm, c.oppLead, c.current ? "yes" : "no",
      m, r.primary[i], r.tpp[i], r.net[i], r.oppnet[i],
      // blank for every past cycle and for months of this one where nobody
      // asked – the series is sparse and the download says so
      r.han ? r.han[i] : null,
    ]));
  });
  return rows;
}

/* One label for a row that can carry two or three leaders on two different
   questions. Collapses to the plain metric name when they agree, which is the
   usual case, and names the exception when they do not. */
function apprMetricLabel(a) {
  const by = a.metricBy || {};
  const parts = [];
  if (a.albNet != null) parts.push(["Albanese", by.alb]);
  if (a.taylorNet != null) parts.push(["opposition leader", by.taylor]);
  if (a.hansonNet != null) parts.push(["Hanson", by.hanson]);
  const name = (m) => (m === "fav" ? "net favourability" : "net approval");
  if (!parts.length) return null;
  const kinds = new Set(parts.map(([, m]) => m));
  if (kinds.size === 1) return name(parts[0][1]);
  return parts.map(([who, m]) => who + ": " + name(m)).join("; ");
}

function cycleSourceRows(cycles, D) {
  const rows = [[
    "cycle", "series", "date", "months_since_election", "pollster",
    "primary_alp", "primary_lnp", "primary_grn", "primary_onp", "primary_oth",
    "tpp_alp", "tpp_lnp", "pm_net", "opp_leader_net", "hanson_net", "leader_metric",
    "pm_preferred", "opp_leader_preferred",
  ]];
  /* Preferred PM is its own series rather than two more columns on the
     leader-rating row: it is a different question, asked of the same wave,
     and one row per question is what lets a reader filter the file by
     `series` and get a clean set. Shares only - the uncommitted remainder is
     the rest of 100 and is not stored either side of the split.
     The opposition leader's key inside a ppm set is that leader's own name
     ("ley" before the February 2026 handover, "taylor" after), so it is found
     by elimination rather than looked up. */
  const ppmOpp = (s) => {
    const k = Object.keys(s).find((x) => x !== "alb" && x !== "hanson" && x !== "unc");
    return k ? s[k] : null;
  };
  const mainPpm = (p) => p.ppm || (p.ppmSets && p.ppmSets[0]) || null;
  const byYear = new Map(cycles.map((c) => [c.year, c]));
  Object.entries(D.cycleSource || {}).forEach(([year, src]) => {
    const c = byYear.get(Number(year));
    if (!c) return;
    src.polls.forEach((p) => rows.push([
      year, "voting_intention", p.date, p.m, p.firm,
      p.alp, p.lnp, p.grn, p.onp, p.oth, p.tpp_alp, p.tpp_lnp, null, null, null, null,
      null, null,
    ]));
    src.approval.forEach((a) => {
      if (a.pmNet != null || a.oppNet != null) rows.push([
        year, "leader_rating", a.date, a.m, a.firm,
        null, null, null, null, null, null, null, a.pmNet, a.oppNet, null,
        a.metric === "fav" ? "net favourability" : "net approval", null, null,
      ]);
      if (a.pmPpm != null || a.oppPpm != null) rows.push([
        year, "preferred_pm", a.date, a.m, a.firm,
        null, null, null, null, null, null, null, null, null, null, null,
        a.pmPpm ?? null, a.oppPpm ?? null,
      ]);
    });
  });
  /* The current cycle's source rows are individualPolls, already in the payload
     – read them from there rather than shipping a second copy. */
  const cur = cycles.find((c) => c.current);
  if (cur) {
    const eDate = Date.parse(cur.eDate);
    const mo = (iso) => Math.round(((Date.parse(iso) - eDate) / 86400000 / 30.436875) * 10) / 10;
    D.individualPolls.forEach((p) => {
      rows.push([cur.year, "voting_intention", p.released, mo(p.released), p.pollster,
        p.p.alp, p.p.lnp, p.p.grn, p.p.onp, p.p.oth, p.alp, p.lnp, null, null, null, null,
        null, null]);
      /* The MAIN contest only. A wave may also publish a two-way where the
         headline is three-way, and those are separate measures that would be
         nonsense stacked in one column - they stay in the payload for the
         charts that keep them apart. */
      const mp = mainPpm(p);
      if (mp) rows.push([cur.year, "preferred_pm", p.released, mo(p.released), p.pollster,
        null, null, null, null, null, null, null, null, null, null, null,
        mp.alb ?? null, ppmOpp(mp)]);
      const a = p.appr;
      if (a && (a.albNet != null || a.taylorNet != null || a.hansonNet != null))
        rows.push([cur.year, "leader_rating", p.released, mo(p.released), p.pollster,
          null, null, null, null, null, null, null, a.albNet, a.taylorNet, a.hansonNet ?? null,
          /* buildAppr reports a metric PER LEADER (metricBy), never a single
             row-level one – a house can ask approval about the PM and
             favourability about Hanson in the same wave. This column read a
             non-existent a.metric and so labelled every row "net approval",
             including the favourability rows the charts deliberately exclude.
             Name the leaders separately where they disagree. */
          apprMetricLabel(a), null, null]);
    });
  }
  return rows.slice(0, 1).concat(
    rows.slice(1).sort((x, y) => (x[0] - y[0]) || String(x[2]).localeCompare(String(y[2]))));
}

/* ---- How the final polls did ------------------------------------------
   Everywhere else the page can only describe how far the polls disagree with
   EACH OTHER. Five past elections are the one place a poll can be checked
   against the thing it was estimating, so this is the only honest answer to
   "should I believe the number at the top of this page".

   The measure is one poll per house - its last with a 2PP inside the window -
   equally weighted, because what matters is how many separate attempts missed
   the same way, not how many people each rang. */
function AccuracyPanel() {
  const { D } = window.AP;
  const A = D.accuracy;
  /* The dots used to carry a title="" – the browser's own tooltip, which
     arrives a second late, in a font that appears nowhere else on the page,
     and cannot say "+1.2" in the colour that means Labor. Every other hover
     on this page is the chart readout, so these dots get it too. Declared
     above the early return: a hook that runs only on some renders is a hook
     React cannot keep in order. */
  const [hov, setHov] = useState(null);
  if (!A || !A.cycles.length) return null;
  const SPAN = 5;                                   // points either side of the result
  const pct = (err) => 50 + (Math.max(-SPAN, Math.min(SPAN, err)) / SPAN) * 50;
  const col = (err) => (err > 0 ? "var(--alp)" : "var(--lnp)");
  const oneSided = A.cycles.filter((c) => c.sameSide);

  const TIP_W = 184;                                // matches .acc-tip's width
  const sgn = (v) => (v > 0 ? "+" : "") + v.toFixed(1);
  const lean = (err) => (err > 0 ? "Labor overstated" :
                         err < 0 ? "Labor understated" : "Exactly on the result");
  const fmtDay = (iso) => new Date(iso + "T00:00:00")
    .toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  /* Clamp to the dot's OWN track, the way the chart clamps its readout to the
     plot: a house four points out sits against the rail, and an unclamped
     panel would hang over the error column beside it. The flip is for the
     first row only, whose upward readout would otherwise leave the card. */
  const open = (e, raw, tip) => {
    const w = (e.currentTarget.parentElement || {}).clientWidth || 1;
    const half = (Math.min(TIP_W, w) / 2 / w) * 100;
    setHov({ ...tip, left: Math.min(100 - half, Math.max(half, raw)) });
  };
  const close = () => setHov(null);
  const bothWays = oneSided.length > 1
    && oneSided.some((c) => c.err > 0) && oneSided.some((c) => c.err < 0);

  return (
    <section className="card acc-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">How the final polls did</h2>
          <p className="card-sub">
            Each house’s last two-party figure in the {A.windowDays} days before polling day,
            against the result · one row per election
          </p>
        </div>
        <div className="dir-net">
          <span className="dir-net-label">Average miss</span>
          <span className="dir-net-val">{A.meanAbs}<span className="pct"> pts</span></span>
        </div>
      </div>

      <div className="acc-scale" aria-hidden="true">
        <span className="acc-scale-l" style={{ color: "var(--lnp)" }}>← Labor understated</span>
        <span className="acc-scale-c">Result</span>
        <span className="acc-scale-r" style={{ color: "var(--alp)" }}>Labor overstated →</span>
      </div>

      <div className="acc-rows">
        {A.cycles.map((c, ri) => (
          <div className="acc-row" key={c.year}>
            <div className="acc-label">
              <span className="acc-year">{c.year}</span>
              {/* results are carried at the precision the AEC published them
                  (2019 is 48.47); one decimal is the precision every other
                  figure on the page is read at */}
              <span className="acc-detail">{c.mean.toFixed(1)} v {c.result.toFixed(1)}</span>
            </div>
            <div className="acc-track">
              <span className="acc-zero"></span>
              {[-SPAN / 2, SPAN / 2].map((t) => (
                <span key={t} className="acc-tick" style={{ left: pct(t) + "%" }}></span>
              ))}
              {c.houses.map((h) => (
                <span key={h.firm} className="acc-dot" role="img"
                      style={{ left: pct(h.err) + "%", background: col(h.err) }}
                      aria-label={`${h.firm}, ${fmtDay(h.date)}: Labor ${h.alp2pp.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(h.err)}`}
                      onMouseEnter={(e) => open(e, pct(h.err), {
                        year: c.year, flip: ri === 0, title: h.firm, date: fmtDay(h.date),
                        rows: [
                          { label: "Poll", value: h.alp2pp.toFixed(1), color: col(h.err) },
                          { label: "Result", value: c.result.toFixed(1) },
                          { label: "Miss", value: sgn(h.err), strong: col(h.err) },
                        ],
                        sub: lean(h.err),
                      })}
                      onMouseLeave={close}></span>
              ))}
              <span className="acc-mean" role="img"
                    style={{ left: pct(c.err) + "%", background: col(c.err) }}
                    aria-label={`Average of the ${c.n} final polls of ${c.year}: ${c.mean.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(c.err)}`}
                    onMouseEnter={(e) => open(e, pct(c.err), {
                      year: c.year, flip: ri === 0,
                      title: `Average of ${c.n} final poll${c.n === 1 ? "" : "s"}`,
                      date: fmtDay(c.eDate),
                      rows: [
                        { label: "Poll average", value: c.mean.toFixed(1), color: col(c.err) },
                        { label: "Result", value: c.result.toFixed(1) },
                        { label: "Miss", value: sgn(c.err), strong: col(c.err) },
                      ],
                      sub: lean(c.err),
                    })}
                    onMouseLeave={close}></span>
              {hov && hov.year === c.year && (
                <div className={"tip acc-tip" + (hov.flip ? " acc-tip-below" : "")}
                     style={{ left: hov.left + "%" }}>
                  <div className="tip-title">{hov.title}</div>
                  <div className="tip-date">{hov.date}</div>
                  {hov.rows.map((r, i) => (
                    <div className="tip-row" key={i}>
                      {/* every row carries a swatch, the unswatched ones an
                          invisible one, so three short labels start on one
                          left edge instead of stepping in and out */}
                      <span className="tip-swatch" style={{ background: r.color || "transparent" }}></span>
                      <span className="tip-label">{r.label}</span>
                      <span className="tip-val" style={r.strong ? { color: r.strong } : null}>{r.value}</span>
                    </div>
                  ))}
                  <div className="tip-sub">{hov.sub}</div>
                </div>
              )}
            </div>
            <div className="acc-err" style={{ color: col(c.err) }}>
              {c.err > 0 ? "+" : ""}{c.err}
            </div>
            <div className="acc-note">
              {c.n} house{c.n === 1 ? "" : "s"}
              {c.sameSide && <span className="acc-flag" title="Every house missed the same way – the signature of an industry-wide problem rather than one firm's noise">All one way</span>}
            </div>
          </div>
        ))}
      </div>

      <p className="table-hint">
        Big dots are the average of that election’s final polls; small dots are the individual
        houses – hover one for its figure. Exit polls are excluded, and a house that publishes an
        undecided-inclusive pair is normalised first, so its arithmetic isn’t scored as a miss.
        {bothWays && (
          <> The two elections where every house missed the same way, {oneSided.map((c) => c.year).join(" and ")},
          {" "}missed in <strong>opposite directions</strong> – so this is not a standing lean that
          today’s figures could be corrected for. It is the size of the error, not its direction,
          that carries.</>
        )}
      </p>

      <div className="acc-firms">
        <div className="acc-firms-h">By house, where there is more than one election to judge on</div>
        <div className="acc-firms-grid">
          {A.firms.filter((f) => f.n > 1).map((f) => (
            <div className="acc-firm" key={f.firm}>
              <span className="acc-firm-n">{f.firm}</span>
              <span className="acc-firm-v" title="Average size of the miss, ignoring direction">
                {f.meanAbs}<span className="pct"> pts</span>
              </span>
              <span className="acc-firm-c">{f.n} elections</span>
            </div>
          ))}
        </div>
        <p className="table-hint">
          Average miss ignoring direction. Houses are not merged across renames of
          different operations, so a firm only appears against the elections it
          actually published a final poll for.
        </p>
      </div>
    </section>
  );
}

function PastCyclesView() {
  const { D } = window.AP;
  const cycles = D.cycles;
  const [mode, setMode] = useState("abs");
  const [hidden, setHidden] = useState(new Set());
  const [hi, setHi] = useState(null);
  const [showHan, setShowHan] = useState(false);

  /* A chip may now turn off the last line. It used to refuse, on the grounds
     that an empty chart is useless – but the way back is one button away and
     sits right under the chips, and refusing a click that was plainly meant
     reads as the page being broken rather than careful. */
  const toggle = (year) => setHidden((h) => {
    const n = new Set(h);
    n.has(year) ? n.delete(year) : n.add(year);
    return n;
  });
  /* Shapes are a property of what is CURRENTLY on the board, so they are
     worked out once here and handed to the legend and all four charts – a
     chip and the dots it explains must never disagree about which term is
     the triangle. */
  const shownCycles = cycles.filter((c) => !hidden.has(c.year));
  const shapes = shownCycles.length <= CYC_DOT_MAX ? cycShapes(shownCycles) : null;

  const showAll = () => setHidden(new Set());
  const hideAll = () => setHidden(new Set(cycles.map((c) => c.year)));

  const exportSeries = () => downloadCsv(
    `auspol-tracker-cycles-series-${D.latest.updatedISO}.csv`, cycleSeriesRows(cycles));
  const exportSource = () => downloadCsv(
    `auspol-tracker-cycles-source-polls-${D.latest.updatedISO}.csv`, cycleSourceRows(cycles, D));

  return (
    <div className="view view-cycles">
      <div className="view-intro">
        <p className="view-lede">
          Every federal term since 2010, aligned to its election day so that each government’s
          trajectory can be read off a shared clock. The current Albanese government is drawn
          <strong> bold</strong>; past governments sit behind, tinted by the party in power –
          red for Labor terms, blue for Coalition – with the year marked where each line ends.
          Hover a cycle below to bring it forward, and select just one to see more details.
        </p>
        <div className="cyc-controls">
          <TextToggle value={mode} onChange={setMode} ariaLabel="Measure"
            options={[{ id: "abs", label: "Absolute level" }, { id: "chg", label: "Change since election" }]} />
          <div className="cyc-export">
            <span className="cyc-export-label">Download</span>
            <button className="ap-export" onClick={exportSeries}
              title="The monthly values plotted on these charts, one row per cycle per month">
              <DownloadIcon />Chart series
            </button>
            <button className="ap-export" onClick={exportSource}
              title="The individual polls the monthly averages are built from">
              <DownloadIcon />Source polls
            </button>
          </div>
        </div>
      </div>

      <CycleLegend cycles={cycles} hidden={hidden} hi={hi} setHi={setHi}
        toggle={toggle} showAll={showAll} hideAll={hideAll} shapes={shapes} />

      <div className="cyc-charts">
        {CYC_METRICS.map((m) => (
          <CycleChart key={m.key} metric={m} cycles={cycles} mode={mode} hidden={hidden} hi={hi}
                      showHan={showHan} setHan={setShowHan} shapes={shapes} />
        ))}
      </div>

      <AccuracyPanel />

      <p className="cyc-foot">
        The plotted series and the individual polls behind it are both downloadable above.{" "}
        Past cycles run the full ~3-year term to the next election; the current cycle stops at the
        latest reading.{" "}
        {showHan && (
          <span>
            Hanson is drawn on the opposition chart from {"“"}approve minus disapprove{"”"} readings only,
            which is why her line is short: most houses rate her on favourability, a different
            question that is never blended into these lines, and no past cycle asked about her
            at all.{" "}
          </span>
        )}
        {mode === "chg"
          ? "Lines show movement relative to each party’s own election result."
          : "Approval lines splice the sitting prime minister – and opposition leader – where a term changed leaders mid-stream."}
      </p>
    </div>
  );
}

// ====================================================================
// ALL POLLS – full sortable / filterable archive
// ====================================================================
// archive sortable header = the shared SortTh (panels.jsx), via its `k` alias
const ArchSortTh = window.SortTh;

// archive facet helpers ----------------------------------------------
// leadership facet cell – the sortable net stays the headline figure, with
// the same approve / don't-know / disapprove split the snapshot's approval
// bars use rendered at micro scale beneath it. Ragged-tolerant: a leader the
// pollster didn't ask about shows a dash; a net-only reading shows just the net.
// right-track / wrong-track for one poll, mirroring ArchApprCell: the net, then
// a bar carrying the three shares so the split behind it is visible at a glance.
function ArchDirCell({ d }) {
  const { NetVal } = window;
  if (!d) return <span className="dash" title="This poll didn’t ask the direction question">—</span>;
  return (
    <div className="arch-appr"
         title={`Right direction ${d.right} · Unsure ${d.unsure} · Wrong track ${d.wrong}`}>
      <span><NetVal v={d.net} /></span>
      <div className="arch-appr-bar" aria-hidden="true">
        <span className="arch-dir-right" style={{ width: d.right + "%" }}></span>
        <span className="arch-appr-dk" style={{ width: d.unsure + "%" }}></span>
        <span className="arch-dir-wrong" style={{ width: d.wrong + "%" }}></span>
      </div>
    </div>
  );
}

function ArchApprCell({ s, net, metric }) {
  const { NetVal, FavMark } = window;
  if (net == null) return <span className="dash" title="Not asked by this pollster">—</span>;
  const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
  const fav = metric === "fav";
  return (
    <div className="arch-appr"
         title={s ? (fav ? `Positive ${s.app} · Neutral ${dk} · Negative ${s.dis}` : `Approve ${s.app} · Don't know / never heard of ${dk} · Disapprove ${s.dis}`) : undefined}>
      <span><NetVal v={net} /><FavMark metric={metric} /></span>
      {s && (
        <div className="arch-appr-bar" aria-hidden="true">
          <span className="arch-appr-app" style={{ width: s.app + "%" }}></span>
          <span className="arch-appr-dk" style={{ width: dk + "%" }}></span>
          <span className="arch-appr-dis" style={{ width: s.dis + "%" }}></span>
        </div>
      )}
    </div>
  );
}

// "As published" – the poll's headline figures exactly as the pollster released
// them, as plain numerals (dot-coded by party) with any shape-flags inline.
// Numerals, not a 0–100 bar: at archive scale every 53/47 bar looks identical,
// so the ink carries nothing – the figures themselves are the record.
function ArchPublished({ p }) {
  const { tppContests, tppFlag } = window;
  const c0 = tppContests(p)[0];
  if (!c0) return <span className="dash" title="No two-party or head-to-head figure published – primaries only">—</span>;
  const flag = tppFlag(p);
  return (
    <div className="apub" aria-label={c0.segs.map((s) => `${s.label} ${s.value}`).join(", ")}>
      {c0.segs.map((s, i) => (
        <span key={i} className="apub-seg" title={s.label}>
          <span className="apub-dot" style={{ background: s.color }}></span>
          {s.value.toFixed(1)}
        </span>
      ))}
      {flag && <span className="facet-flag">{flag}</span>}
    </div>
  );
}

// One lead-info helper drives the bar, the held-by filter and the sort, so
// they can never disagree. Returns null when the poll didn't publish the
// selected measure. m is signed: + = first-named party of the matchup leads.
function archLeadInfo(p, measure) {
  if (measure === "onp") {
    if (!p.tppAlt) return null;
    const m = +(p.tppAlt.alp - p.tppAlt.onp).toFixed(1);
    return { m, who: m >= 0 ? "alp" : "onp", lab: m >= 0 ? "ALP" : "ON",
             color: m >= 0 ? "var(--alp)" : "var(--onp)",
             note: " on the published ALP v One Nation matchup" };
  }
  if (measure === "lnponp") {
    if (!p.tppAlt2) return null;
    const m = +(p.tppAlt2.lnp - p.tppAlt2.onp).toFixed(1);
    return { m, who: m >= 0 ? "lnp" : "onp", lab: m >= 0 ? "L/NP" : "ON",
             color: m >= 0 ? "var(--lnp)" : "var(--onp)",
             note: " on the published L/NP v One Nation matchup" };
  }
  if (measure === "3cp") {
    if (!p.tpp3) return null;
    const e = [["alp", "ALP", p.tpp3.alp, "var(--alp)"], ["lnp", "L/NP", p.tpp3.lnp, "var(--lnp)"], ["onp", "ON", p.tpp3.onp, "var(--onp)"]]
      .sort((a, b) => b[2] - a[2]);
    const margin = +(e[0][2] - e[1][2]).toFixed(1);
    return { m: e[0][0] === "alp" ? margin : -margin, who: e[0][0], lab: e[0][1], color: e[0][3],
             note: ` over ${e[1][1]} on the published 3-cornered figures` };
  }
  if (p.alp == null && p.alp2pp == null) return null;   // no published 2PP this wave
  // margin from the published pair (undecided-inclusive pairs don't sum 100);
  // latest-table rows name the same fields alp2pp/lnp2pp
  const alp = p.alp2pp != null ? p.alp2pp : p.alp;
  const lnp = p.lnp2pp != null ? p.lnp2pp : p.lnp;
  const m = +(alp - (lnp != null ? lnp : 100 - alp)).toFixed(1);
  return { m, who: m >= 0 ? "alp" : "lnp", lab: m >= 0 ? "ALP" : "L/NP",
           color: m >= 0 ? "var(--alp)" : "var(--lnp)",
           note: " on the two-party ALP v L/NP measure" +
                 (p.tppKind === "3cp" ? " · derived from the published 3-cornered figures" : "") };
}

const LEAD_MAX = { lnp: 14, onp: 32, lnponp: 32, "3cp": 14 }; // pts of lead that fill a half-bar
function ArchLead({ p, measure }) {
  const li = archLeadInfo(p, measure);
  if (!li) return <span className="dash" title="This pollster didn’t publish the selected matchup this wave">—</span>;
  const max = LEAD_MAX[measure] || LEAD_MAX.lnp;
  const w = Math.min(Math.abs(li.m), max) / max * 50;
  return (
    <div className="arch-lead" title={`${li.lab} leads by ${Math.abs(li.m).toFixed(1)}${li.note}`}>
      <div className="arch-lead-bar" aria-hidden="true">
        <span className="arch-lead-fill"
              style={li.m >= 0
                ? { right: "50%", width: w + "%", background: li.color, borderRadius: "3px 0 0 3px" }
                : { left: "50%", width: w + "%", background: li.color, borderRadius: "0 3px 3px 0" }}></span>
        <span className="arch-lead-mid"></span>
      </div>
      <span className="arch-lead-val" style={{ color: inkOf(li.color) }}>
        {li.m > 0 ? "+" : ""}{li.m.toFixed(1)}
      </span>
    </div>
  );
}
// full per-poll breakdown for an ARCHIVE poll – mirrors the Latest-polls
// detail, but driven off the archive row shape (alp/lnp 2PP, p primary, ppm,
// appr) which carries no commissioning client / method / direction fields.
function ArchPollDetail({ p, onBack, backLabel }) {
  const { ShareBar, NetVal, ApprBlock, primarySegs, tppContests, tppHeading, ppmContests, ppmContestSegs, ppmLabel, ppmKind, LEADER_META, pubStamp } = window;
  const contests = ppmContests(p);
  const tcs = tppContests(p);
  return (
    <div className="poll-detail">
      <div className="pd-meta">
        <span className="pd-meta-i"><span className="pd-meta-k">Fieldwork</span> {p.field}</span>
        {/* The date the poll came OUT, and the hour where the release recorded
            one. This line has always been labelled "Published" and has always
            printed `fullDate`, which is the last day of FIELDWORK - the same
            substitution the Latest-polls column was corrected for, still being
            made one tab across. Where no publication date was recorded the
            fieldwork end still stands in, but now says that it is doing so. */}
        <span className="pd-meta-i"><span className="pd-meta-k">Published</span>{" "}
          {pubStamp(p.published, { year: true })
            || <span className="pd-est"
                     title="Publication date not recorded for this poll – showing the last day of fieldwork">
                 {p.fullDate}
               </span>}
        </span>
        <span className="pd-meta-i"><span className="pd-meta-k">Sample</span> {p.sample != null ? "n = " + p.sample.toLocaleString() : "—"}</span>
        {p.lean != null && <span className="pd-meta-i"><span className="pd-meta-k">House lean</span> {p.lean > 0 ? "+" : ""}{p.lean.toFixed(1)} vs aggregate</span>}
        {p.hfx != null && <span className="pd-meta-i"><span className="pd-meta-k">House effect</span> {p.hfx.v > 0 ? "+" : ""}{p.hfx.v.toFixed(1)} vs consensus</span>}
        {/* the way back rides the line that already describes this poll, rather
            than inventing a band of its own above the panel */}
        {onBack && (
          <button className="back-to-chart" onClick={(e) => { e.stopPropagation(); onBack(); }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Back to {backLabel || "the chart"}
          </button>
        )}
        {/* Corrections are nearly always about ONE poll, and the reader who
            has a row open is looking at the figure they doubt. Seeding the
            footer's form from here means the pollster and field dates - the
            two things that identify a row in data/polls.json - arrive already
            written, rather than being retyped from memory after scrolling
            away from them. Only rendered when a form exists to seed. */}
        {window.AP_FEEDBACK && (
          <button className="back-to-chart pd-report"
                  onClick={(e) => { e.stopPropagation(); window.AP.reportPoll && window.AP.reportPoll(p); }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            Report an error
          </button>
        )}
      </div>
      <div className="pd-grid">
        <div className="pd-block">
          <div className="pd-k">{tppHeading(tcs)}</div>
          {tcs.length === 0
            ? <div className="pd-absent">No two-party figure published with this poll</div>
            : <div className="pd-contests">
                {tcs.map((c, i) => (
                  <div className="pd-contest" key={i}>
                    {tcs.length > 1 && <div className="pd-contest-lab">{c.lab}</div>}
                    <ShareBar segs={c.segs} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">First preferences</div>
          <ShareBar segs={primarySegs(p)} />
        </div>
        <div className="pd-block">
          <div className="pd-k">Preferred PM{contests.length > 1 ? " · " + contests.length + " matchups" : contests.length === 1 && ppmKind(contests[0]) === "three-way" ? " · three-way" : ""}</div>
          {contests.length === 0
            ? <div className="pd-absent">No preferred-PM question this wave</div>
            : <div className="pd-contests">
                {contests.map((c, i) => (
                  <div className="pd-contest" key={i}>
                    {contests.length > 1 && <div className="pd-contest-lab">{ppmLabel(c)}</div>}
                    <ShareBar segs={ppmContestSegs(c, i === 0 ? p.chg : null)} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">{window.apprHeading(p.appr)}</div>
          <ApprBlock appr={p.appr} chg={p.chg} />
        </div>
        {/* seat projection spans the full grid – it is a chamber, not a
            per-poll measure, and needs the width to read at 150 seats */}
        {p.dir && (
          <div className="pd-block">
            <div className="pd-k">National direction</div>
            <ShareBar segs={[
              { key: "right",  label: "Right direction", value: p.dir.right,  color: "var(--mood-pos)",
                delta: p.dir.chg ? { v: p.dir.chg.right, refDate: p.dir.ref } : null },
              { key: "unsure", label: "Unsure",          value: p.dir.unsure, color: "var(--line-2)" },
              { key: "wrong",  label: "Wrong track",     value: p.dir.wrong,  color: "var(--mood-neg)",
                delta: p.dir.chg ? { v: p.dir.chg.wrong, refDate: p.dir.ref } : null },
            ]} />
          </div>
        )}
        {p.undecided != null && <window.UndecidedLine v={p.undecided} chg={p.chg} basis={p.undecidedBasis} />}
        {p.seats && (
          <div className="pd-block pd-block-wide">
            <div className="pd-k">Seat projection</div>
            <window.SeatProjection seats={p.seats} />
          </div>
        )}
      </div>
    </div>
  );
}

// data-content tags – shown on each archive row and used as filters, so you can
// see (and select for) what a poll actually measures without expanding it.
const POLL_TAGS = [
  { id: "2pp",   label: "2PP",   title: "Two-party preferred – one matchup (ALP v L/NP)" },
  { id: "2x2pp", label: "2×2PP", title: "Two 2PP matchups – e.g. ALP v L/NP and ALP v ON" },
  { id: "3x2pp", label: "3×2PP", title: "Three 2PP matchups – ALP v L/NP, ALP v ON and L/NP v ON" },
  { id: "3pp",   label: "3PP",   title: "Three-way party-preferred – ALP / L/NP / ON in one distribution" },
  { id: "ppm",   label: "PPM",   title: "Preferred prime minister" },
  { id: "aprv",  label: "Aprv",  title: "Leader approval (approve − disapprove)" },
  { id: "fav",   label: "Fav",   title: "Leader favourability (positive − negative)" },
  { id: "seats", label: "Seats", title: "Modelled seat projection with range – MRP polls only" },
  { id: "dir",   label: "Dir",   title: "National direction – right direction / wrong track" },
];
const POLL_TAG_META = Object.fromEntries(POLL_TAGS.map((t) => [t.id, t]));
function pollTagIds(p) {
  const a = p.appr || {};
  const hasNet = a.albNet != null || a.taylorNet != null || a.hansonNet != null;
  const t = [];
  // count of two-party head-to-head matchups published: ALP v L/NP, ALP v ON,
  // L/NP v ON. One → 2pp, two → 2×2pp, three → 3×3pp (tiered, not additive).
  const nMatch = (p.alp != null ? 1 : 0) + (p.tppAlt ? 1 : 0) + (p.tppAlt2 ? 1 : 0);
  if (nMatch >= 3) t.push("3x2pp");
  else if (nMatch === 2) t.push("2x2pp");
  else if (nMatch === 1) t.push("2pp");
  if (p.tpp3) t.push("3pp");          // a genuine three-cornered party-preferred (3CP)
  if (window.ppmContests(p).length) t.push("ppm");
  // metric is per leader, so one poll can carry BOTH tags (e.g. Resolve:
  // approval for the majors, favourability/likeability for Hanson)
  const mb = a.metricBy || {};
  let anyAprv = false, anyFav = false;
  for (const [id, nk] of [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]]) {
    // a leader can carry BOTH measures in one wave, so each is tagged on its own
    const alt = a.alt && a.alt[id];
    if (alt) { if (alt.metric === "fav") anyFav = true; else anyAprv = true; }
    if (a[nk] == null) continue;
    if (mb[id] === "fav") anyFav = true; else anyAprv = true;
  }
  if (anyAprv) t.push("aprv");
  if (anyFav) t.push("fav");
  if (p.seats && p.seats.p) t.push("seats");
  if (p.dir) t.push("dir");
  return t;
}

/* ---- filter bar ----------------------------------------------------------
   The archive is the most multifaceted thing here: 149 polls from 17 houses,
   each publishing a different subset of nine measures. The controls for that
   used to sit on screen ALL AT ONCE – a search box, seventeen pollster chips
   over two rows, four time buttons, nine data-type chips, three matchups and
   three lead-holders: thirty-six controls stacked four rows deep before the
   first poll. Everything was reachable and nothing was findable, and the one
   thing you could never see was which of the thirty-six were actually on.

   So the surface is inverted. One row at rest – search, and a button per
   FACET of the question ("who ran it", "when", "what's in it"). Each opens a
   panel with the options and, beside each option, how many polls it would
   leave given everything else already set. What IS on shows underneath as
   removable pills, which is the only state a reader has to keep in their head.

   A popover is a listbox, not a dialog: click outside or press Escape to
   close, and focus goes back to the button that opened it. */
function FilterPop({ id, label, summary, open, setOpen, children }) {
  const box = useRef(null), panel = useRef(null);
  const isOpen = open === id;
  const [flip, setFlip] = useState(false);
  React.useEffect(() => {
    if (!isOpen) { setFlip(false); return; }
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(null);
      const b = box.current && box.current.querySelector(".ap-popbtn");
      if (b) b.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [isOpen]);
  // a panel that would hang off the right edge hangs off its button's right
  // edge instead – measured, because which button that is depends on the width
  React.useLayoutEffect(() => {
    if (!isOpen || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) setFlip(true);
  }, [isOpen]);
  return (
    <div className="ap-pop" ref={box}>
      <button type="button" className={"ap-popbtn" + (summary ? " on" : "") + (isOpen ? " open" : "")}
              aria-expanded={isOpen} aria-haspopup="true"
              onClick={() => setOpen(isOpen ? null : id)}>
        <span className="ap-popbtn-lab">{label}</span>
        {summary && <span className="ap-popbtn-val">{summary}</span>}
        <svg className="ap-caret" viewBox="0 0 24 24" width="11" height="11" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && <div className={"ap-panel" + (flip ? " flip" : "")} ref={panel} role="group" aria-label={label}>{children}</div>}
    </div>
  );
}
/* One option row, whether it behaves as a checkbox (pollsters, data types) or
   a radio (time). The count is what makes the panel worth opening: it is
   computed against every OTHER active filter, so it answers "how many polls
   would this leave", not "how many exist somewhere". */
function PopRow({ on, radio, label, note, n, onClick }) {
  return (
    <button type="button" className={"ap-check" + (on ? " on" : "") + (radio ? " radio" : "")}
            role={radio ? "radio" : "checkbox"} aria-checked={on} onClick={onClick}>
      <span className="ap-tick" aria-hidden="true"></span>
      <span className="ap-check-lab">{label}{note && <span className="ap-check-note">{note}</span>}</span>
      {n != null && <span className="ap-check-n">{n}</span>}
    </button>
  );
}

// ====================================================================
// VariancePanel – how far apart the polls sit, against the spread that
// sampling error alone would produce.  One panel per archive facet, so
// the measures on screen are the ones the table below is showing.
//
// Deliberately computed over EVERY poll in the archive, never the
// filtered subset: "how much do pollsters disagree" is a property of the
// industry, and filtering to one house would make it meaningless.  The
// date range still moves the chart window, because that's just framing.
// ====================================================================
function VariancePanel({ facet, rangeId }) {
  const { D, discord, discordFacet, discordRead, rangeDomain, buildXTicks, monthLabelFull } = window.AP;
  const [hidden, setHidden] = useState({});

  // a measure with no computable window anywhere (e.g. Hanson's net, polled
  // by too few houses at a time) is dropped rather than shown as a flat gap
  const rows = discordFacet(facet)
    .map((m) => ({ m, pts: discord(m.id) }))
    .filter((r) => r.pts.some((d) => d.sigma != null));
  if (!rows.length) return null;

  const xDomain = rangeDomain(rangeId);
  const inWin = (d) => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const shown = rows.filter((r) => !hidden[r.m.id]);
  const vis = shown.length ? shown : rows;      // never blank the chart entirely

  const chartSeries = rows.map((r) => ({
    id: r.m.id, label: r.m.label, color: r.m.color, width: 3,
    opacity: hidden[r.m.id] ? 0 : 1,
    points: r.pts.filter((d) => d.sigma != null && inWin(d))
      .map((d) => ({ x: d.x, y: d.sigma, note: d.R.toFixed(2) + "×" })),
  })).filter((s) => s.points.length > 1);

  // Within a facet every measure's sampling floor is near enough the same
  // curve (similar shares, similar samples), so ONE band carries it – a line
  // dipping into the shaded region is tighter than chance allows.
  const floorPts = D.MONTHS.map((ym, i) => {
    const fs = vis.map((r) => r.pts[i]).filter((d) => d && d.floor != null).map((d) => d.floor);
    return fs.length ? { x: D.mx(ym), y0: 0, y1: fs.reduce((s, v) => s + v, 0) / fs.length } : null;
  }).filter((d) => d && inWin(d));

  const spine = D.MONTHS.map((ym) => ({ x: D.mx(ym), y: 0 })).filter(inWin);
  const spineYm = D.MONTHS.filter((ym) => inWin({ x: D.mx(ym) }));

  const vals = [];
  chartSeries.forEach((s) => { if (s.opacity !== 0) s.points.forEach((p) => vals.push(p.y)); });
  floorPts.forEach((d) => vals.push(d.y1));
  const step = Math.max(...vals) > 6 ? 2 : 1;
  const { domain, ticks } = fitDomain(vals.length ? vals : [0, 1], step, 0);

  // latest computable reading per measure – the pollsters' current standing
  const latest = rows.map((r) => {
    const pts = r.pts.filter((d) => d.sigma != null);
    return { m: r.m, d: pts[pts.length - 1] };
  });
  const unitNote = facet === "leadership" ? "net approval points" : "percentage points";

  return (
    <section className="ap-var">
      <div className="ap-var-head">
        <div>
          <h3 className="ap-var-title">Poll disagreement</h3>
          <p className="card-sub">
            How far apart the polls sit, against the spread sampling error alone would produce.
            Shaded = that chance floor; a line inside it means the houses are running tighter than
            random sampling permits. Measured across all {D.individualPolls.length} polls – the filters
            above don’t narrow it.
          </p>
        </div>
        <div className="legend">
          {latest.map(({ m, d }) => {
            const read = discordRead(d.R);
            return (
              <button key={m.id} type="button"
                      className={"legend-chip" + (hidden[m.id] ? " off" : "")}
                      aria-pressed={!hidden[m.id]}
                      title={m.label + " – " + d.sigma.toFixed(2) + "pp spread vs a " + d.floor.toFixed(2) + "pp floor · " + read.label}
                      onClick={() => setHidden((h) => ({ ...h, [m.id]: !h[m.id] }))}>
                <span className="legend-swatch" style={{ background: m.color }}></span>
                <span className="legend-name">{m.label}</span>
                <span className={"legend-val vr-" + read.id}>{d.R.toFixed(2)}×</span>
              </button>
            );
          })}
        </div>
      </div>

      <TrendChart
        key={"var-" + facet + "-" + rangeId}
        height={300} xDomain={xDomain} yDomain={domain} yTicks={ticks}
        unit="pp" pad={{ l: 54, r: 20, t: 18, b: 40 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        areas={[{ id: "floor", color: "var(--ink-faint)", opacity: 0.14, points: floorPts }]}
        series={chartSeries} spine={spine}
        tooltipTitle={(i) => monthLabelFull(spineYm[i])}
        extraRows={(i) => {
          const f = floorPts.filter((d) => d.x === (spine[i] || {}).x)[0];
          return f ? [{ label: "Chance floor", value: f.y1.toFixed(2) + "pp" }] : [];
        }}
        fmt={(v) => v.toFixed(2)}
      />

      <div className="ap-var-read">
        {latest.map(({ m, d }) => {
          const read = discordRead(d.R);
          return (
            <div key={m.id} className={"vr-tile" + (hidden[m.id] ? " off" : "")}>
              <span className="vr-name" style={{ color: inkOf(m.color) }}>{m.label}</span>
              <span className="vr-sigma">{d.sigma.toFixed(2)}<em>pp</em></span>
              <span className={"vr-pill vr-" + read.id}>{read.label}</span>
              <span className="vr-sub">
                {d.R.toFixed(2)}× the {d.floor.toFixed(2)}pp floor
                {d.excess > 0.05 && <> · {d.excess.toFixed(2)}pp unexplained</>}
              </span>
            </div>
          );
        })}
      </div>

      <p className="table-hint ap-var-note">
        Spread is the recency-weighted standard deviation of each poll’s distance from a local trend,
        in {unitNote} – recency-weighted only, because weighting by sample size would mute exactly the
        small divergent polls being measured. The floor is what a design effect of {window.AP.DISC.DEFF} and
        each poll’s own sample size predict. Their ratio reads: under 0.80× herded · around 1× as close as
        sampling allows · over 1.20× the houses genuinely differ.
        {facet === "leadership" && " Leadership residuals are pooled within each leader-era and metric, so the Ley → Taylor handover and the approval/favourability mix aren’t counted as pollsters disagreeing."}
      </p>
    </section>
  );
}

function AllPollsView({ focus, onBack, backLabel }) {
  const { D } = window.AP;
  const { ShareBar, NetVal, tppContests, tppFlag, ppmContests, ppmContestSegs, ppmFlag } = window;
  const houses = [];
  D.individualPolls.forEach((p) => { if (!houses.includes(p.pollster)) houses.push(p.pollster); });
  houses.sort();

  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());     // pollster filter; empty = all
  const [lead, setLead] = useState("all");        // all | alp | lnp/onp (per matchup)
  const [measure, setMeasure] = useState("lnp");  // lead matchup: lnp = ALP v L/NP · onp = ALP v ON
  const [range, setRange] = useState("all");      // all | 12 | 6 | 3
  const [tagSel, setTagSel] = useState(new Set()); // data-content tags; empty = all
  const [sort, setSort] = useState({ key: "date", dir: -1 });
  const [facet, setFacet] = useState("twopp");
  const [open, setOpen] = useState(null);     // expanded ROW
  const [pop, setPop] = useState(null);       // open filter popover
  /* Each view hides the columns it can't fill; it should hide the ROWS it
     can't fill too. Two thirds of the archive publishes no direction reading,
     and the old table answered "Direction" with 95 rows of dashes and left the
     reader to discover the Contains filter. So the view arms that filter
     itself – as a visible, removable pill, not a hidden default. */
  const [scope, setScope] = useState(true);

  /* Arriving from a dot on a chart. The view is remounted on every tab change,
     so its filters are already at their defaults - the only one that could
     hide the poll being asked for is the view's own scope, which is dropped.
     The facet comes from the chart that was clicked, so a leadership dot lands
     on the leadership columns rather than on 2PP. */
  React.useEffect(() => {
    if (!focus) return;
    setScope(false);
    if (focus.facet) setFacet(focus.facet);
    setOpen(focus.key);
  }, [focus]);
  // …and once the row is actually on the page, put it under the reader's eye.
  // Centred, because a row scrolled to the top would sit under the pinned bar.
  const bodyRef = useRef(null);
  React.useEffect(() => {
    if (!focus || open !== focus.key || !bodyRef.current) return;
    const row = bodyRef.current.querySelector("tr.arch-row.open");
    if (row) row.scrollIntoView({ block: "center", behavior: "auto" });
  }, [focus, open, facet]);
  const toggleTag = (id) => setTagSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const onMeasure = (mv) => { setMeasure(mv); setLead("all"); };
  /* What each view needs a poll to have published. Primary vote is on every
     poll in the archive, so it has nothing to scope and gets no pill. */
  const FACET_SCOPE = {
    twopp: { has: (p) => p.alp != null || p.tppAlt || p.tppAlt2 || p.tpp3, label: "With a 2PP" },
    primary: null,
    leadership: { has: (p) => window.ppmContests(p).length > 0 || (p.appr && (p.appr.albNet != null || p.appr.taylorNet != null || p.appr.hansonNet != null)), label: "With leadership numbers" },
    direction: { has: (p) => !!p.dir, label: "With a direction reading" },
  };
  const FACETS = [
    { id: "twopp", label: "2PP" },
    { id: "primary", label: "Primary" },
    { id: "leadership", label: "Leadership" },
    { id: "direction", label: "Direction" },
  ];
  const onFacet = (f) => {
    setFacet(f); setSort({ key: "date", dir: -1 }); setOpen(null); setPop(null); setScope(true);
    // the matchup/ahead pair describes the 2PP lead column – it is hidden
    // outside that facet, so its filter must not keep biting invisibly
    if (f !== "twopp") { setLead("all"); setMeasure("lnp"); }
  };

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const toggleHouse = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });

  const aggByYm = {};
  D.agg2pp.forEach((d) => { aggByYm[d.ym] = d.alp; });

  const rows = D.individualPolls.map((p) => {
    const [y, mo] = p.ym.split("-").map(Number);
    const fullDate = `${p.day} ${D.monthName(mo)} ${String(y).slice(2)}`;
    const tags = pollTagIds(p);
    // house lean uses the NORMALISED share (alpN) so undecided-inclusive
    // pairs compare fairly with the aggregate; null when no 2PP published
    const lean = p.alpN != null && aggByYm[p.ym] != null ? +(p.alpN - aggByYm[p.ym]).toFixed(1) : null;
    // house effect is fixed per pollster (built over the whole sample), so the
    // same value rides on every row that pollster owns; null when unmeasured
    const hfx = (((D.houseEffects || {}).tpp || {})[p.pollster]) || null;
    // searchable haystack – everything a row knows, so the search box matches
    // fieldwork dates, samples, 2PP / primary / matchup figures, nets, flags
    const f1 = (v) => (v != null ? v.toFixed(1) : null);
    const hayParts = [
      p.pollster, p.field, fullDate, p.sample != null ? String(p.sample) : null,
      f1(p.alp), f1(p.lnp),
      lean != null ? (lean > 0 ? "+" : "") + lean.toFixed(1) : null,
      f1(p.p.alp), f1(p.p.lnp), f1(p.p.grn), f1(p.p.onp), f1(p.p.oth),
    ].filter(Boolean);
    if (p.tpp3) hayParts.push(p.tpp3.alp.toFixed(1), p.tpp3.lnp.toFixed(1), p.tpp3.onp.toFixed(1), "3-cornered 3cp");
    if (p.tppAlt) hayParts.push(p.tppAlt.alp.toFixed(1), p.tppAlt.onp.toFixed(1), "alp v on one nation matchup");
    if (p.tppAlt2) hayParts.push(p.tppAlt2.lnp.toFixed(1), p.tppAlt2.onp.toFixed(1), "lnp v on one nation matchup");
    if (p.appr.albNet != null) hayParts.push("albanese " + p.appr.albNet);
    if (p.appr.taylorNet != null) hayParts.push("taylor " + p.appr.taylorNet);
    if (p.appr.hansonNet != null) hayParts.push("hanson " + p.appr.hansonNet);
    if (p.seats && p.seats.p) {
      hayParts.push("seat projection mrp");
      for (const k in p.seats.p) hayParts.push(k + " " + p.seats.p[k].est + " seats");
    }
    if (p.dir) {
      hayParts.push("direction right track wrong track",
        f1(p.dir.right), f1(p.dir.wrong), f1(p.dir.unsure),
        (p.dir.net > 0 ? "+" : "") + p.dir.net);
    }
    hayParts.push(...tags);   // so "fav", "ppm" etc. match in the search box too
    const hay = hayParts.join(" ").toLowerCase();
    return {
      ...p, year: y, mo, fullDate, lean, hfx, tags,
      hay: hay + " " + hay.replace(/–/g, "-"),   // hyphen typed in search matches the en dash
    };
  });

  // only offer tag filters for data types actually present in the archive, so
  // e.g. "3PP" appears as a chip only once a three-cornered poll exists
  const availableTags = new Set();
  rows.forEach((r) => r.tags.forEach((tg) => availableTags.add(tg)));
  const shownTags = POLL_TAGS.filter((t) => availableTags.has(t.id));

  const latestX = D.mx(D.MONTHS[D.MONTHS.length - 1]);
  const x0 = range === "all" ? -Infinity : latestX - Number(range) / 12 - 0.06;
  const ql = q.trim().toLowerCase();

  /* One predicate per filter, kept as a list rather than inlined, so the
     panels can ask the question the numbers beside each option answer: how
     many polls would this leave, given everything else already set. That means
     counting with exactly one predicate lifted out – `without(f)`. */
  const scoping = scope && FACET_SCOPE[facet];
  const TESTS = [
    ["who", (p) => !sel.size || sel.has(p.pollster)],
    // a row must contain EVERY selected data type (AND)
    ["has", (p) => !tagSel.size || [...tagSel].every((tg) => p.tags.includes(tg))],
    ["lead", (p) => { if (lead === "all") return true; const li = archLeadInfo(p, measure); return !!li && li.who === lead; }],
    ["when", (p) => range === "all" || p.x >= x0],
    ["q", (p) => !ql || ql.split(/\s+/).every((t) => p.hay.includes(t))],
    ["scope", (p) => !scoping || scoping.has(p)],
  ];
  const passing = (p, skip) => TESTS.every(([k, f]) => k === skip || f(p));
  const filtered = rows.filter((p) => passing(p, null));
  const without = (skip) => rows.filter((p) => passing(p, skip));

  // option counts, each against every other filter
  const houseRows = without("who");
  const houseN = {};
  houseRows.forEach((p) => { houseN[p.pollster] = (houseN[p.pollster] || 0) + 1; });
  const tagRows = without("has");
  const tagN = {};
  tagRows.forEach((p) => p.tags.forEach((t) => { tagN[t] = (tagN[t] || 0) + 1; }));
  const whenRows = without("when");
  const rangeN = (r) => (r === "all" ? whenRows.length
    : whenRows.filter((p) => p.x >= latestX - Number(r) / 12 - 0.06).length);
  /* Ranked by how much a house polls, not alphabetically: Roy Morgan has 42
     waves here and Agenda C Synesis one, and an A–Z list buries the names a
     reader is looking for among the ones they have never heard of. Ranked by
     the count IN VIEW, which doesn't reshuffle under the reader's hand –
     selecting a pollster can't change a number computed with the pollster
     filter lifted out, so the order only moves when another panel does. */
  const houseRank = [...houses].sort((a, b) => (houseN[b] || 0) - (houseN[a] || 0) || a.localeCompare(b));

  const getVal = (p, key) => {
    switch (key) {
      case "date": return p.x;
      case "pollster": return p.pollster;
      case "sample": return p.sample ?? -Infinity;
      case "alp": {
        const li = archLeadInfo(p, measure);
        return li ? li.m : -Infinity;
      }
      case "lean": return p.lean ?? -Infinity;
      case "hfx": return p.hfx ? p.hfx.v : -Infinity;
      case "p.alp": return p.p.alp;
      case "p.lnp": return p.p.lnp;
      case "p.grn": return p.p.grn;
      case "p.onp": return p.p.onp;
      case "appr.albNet": return p.appr.albNet != null ? p.appr.albNet : -Infinity;
      case "appr.taylorNet": return p.appr.taylorNet != null ? p.appr.taylorNet : -Infinity;
      case "appr.hansonNet": return p.appr.hansonNet != null ? p.appr.hansonNet : -Infinity;
      case "ppm.alb": { const c = ppmContests(p)[0]; return c && c.alb != null ? c.alb : -Infinity; }
      case "dir.right": return p.dir ? p.dir.right : -Infinity;
      case "dir.wrong": return p.dir ? p.dir.wrong : -Infinity;
      case "dir.net": return p.dir ? p.dir.net : -Infinity;
      default: return 0;
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const va = getVal(a, sort.key), vb = getVal(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    // stable tiebreak: newest first
    return b.x - a.x;
  });

  const total = rows.length;
  const clearAll = () => {
    setQ(""); setSel(new Set()); setLead("all"); setMeasure("lnp"); setRange("all");
    setTagSel(new Set()); setScope(false); setPop(null);
  };
  // Boolean(): the chain ends on a Set size, so with no filters this was the
  // NUMBER 0 – and {0 && <button/>} renders a literal 0 next to the poll count.
  const anyFilter = Boolean(ql || sel.size || lead !== "all" || range !== "all" || tagSel.size);

  /* What is currently on, as removable pills. The scope pill is marked `auto`
     – dashed, quieter – because the view set it, not the reader. */
  const RANGE_LAB = { "12": "Last 12 months", "6": "Last 6 months", "3": "Last 3 months" };
  const MEASURE_LAB = { lnp: "ALP v L/NP", onp: "ALP v ON", lnponp: "L/NP v ON" };
  const HOLDER_LAB = { alp: "ALP", lnp: "L/NP", onp: "ON" };
  const pills = [];
  if (ql) pills.push({ k: "q", lab: "“" + q.trim() + "”", off: () => setQ("") });
  [...sel].forEach((h) => pills.push({ k: "h" + h, lab: h, off: () => toggleHouse(h) }));
  if (range !== "all") pills.push({ k: "r", lab: RANGE_LAB[range], off: () => setRange("all") });
  [...tagSel].forEach((t) => pills.push({ k: "t" + t, lab: (POLL_TAG_META[t] || {}).label || t, off: () => toggleTag(t) }));
  if (lead !== "all") pills.push({ k: "l", lab: HOLDER_LAB[lead] + " ahead", off: () => setLead("all") });
  if (scoping) pills.push({ k: "s", lab: scoping.label, auto: true, off: () => setScope(false) });

  // ---- CSV export of the CURRENTLY filtered + sorted rows -----------------
  // A flat, analysis-friendly schema (one row per poll), independent of the
  // active facet – so the download always carries every measure, for exactly
  // the rows the filters left on screen, in the order they're shown.
  const CSV_COLS = [
    ["Pollster", (p) => p.pollster],
    ["Fieldwork", (p) => p.field],
    ["Fieldwork end", (p) => p.released],
    ["Sample", (p) => p.sample],
    ["Primary ALP", (p) => p.p.alp], ["Primary L/NP", (p) => p.p.lnp],
    ["Primary GRN", (p) => p.p.grn], ["Primary ON", (p) => p.p.onp], ["Primary OTH", (p) => p.p.oth],
    ["2PP ALP", (p) => p.alp], ["2PP L/NP", (p) => p.lnp],
    ["ALP v ON", (p) => (p.tppAlt ? p.tppAlt.alp : "")],
    ["L/NP v ON", (p) => (p.tppAlt2 ? p.tppAlt2.lnp : "")],
    ["House lean", (p) => p.lean],
    ["House effect", (p) => (p.hfx ? p.hfx.v : "")],
    ["PPM Albanese", (p) => { const c = ppmContests(p)[0]; return c ? c.alb ?? "" : ""; }],
    ["PPM Opp. ldr", (p) => { const c = ppmContests(p)[0]; return c ? (c.taylor ?? c.ley ?? "") : ""; }],
    ["PPM Hanson", (p) => { const c = ppmContests(p)[0]; return c ? (c.hanson ?? "") : ""; }],
    ["Albanese metric", (p) => (p.appr.metricBy ? p.appr.metricBy.alb : "")],
    ["Opp. ldr metric", (p) => (p.appr.metricBy ? p.appr.metricBy.taylor : "")],
    ["Hanson metric", (p) => (p.appr.metricBy ? p.appr.metricBy.hanson : "")],
    ["Albanese net", (p) => p.appr.albNet],
    ["Opp. ldr net", (p) => p.appr.taylorNet],
    ["Hanson net", (p) => p.appr.hansonNet],
    // seat projections are MRP-only, so these columns are empty for most rows
    ["Seats ALP", (p) => (p.seats && p.seats.p.alp ? p.seats.p.alp.est : "")],
    ["Seats L/NP", (p) => (p.seats && p.seats.p.lnp ? p.seats.p.lnp.est : "")],
    ["Seats GRN", (p) => (p.seats && p.seats.p.grn ? p.seats.p.grn.est : "")],
    ["Seats ON", (p) => (p.seats && p.seats.p.onp ? p.seats.p.onp.est : "")],
    ["Seats OTH", (p) => (p.seats && p.seats.p.oth ? p.seats.p.oth.est : "")],
    ["Right direction", (p) => (p.dir ? p.dir.right : "")],
    ["Wrong track", (p) => (p.dir ? p.dir.wrong : "")],
    ["Direction unsure", (p) => (p.dir ? p.dir.unsure : "")],
    ["Direction net", (p) => (p.dir ? p.dir.net : "")],
    ["Contains", (p) => p.tags.join(" ")],
  ];
  const exportCsv = () => downloadCsv(
    `auspol-tracker-polls-${D.latest.updatedISO}.csv`,
    [CSV_COLS.map((c) => c[0]), ...sorted.map((p) => CSV_COLS.map((c) => c[1](p)))]);

  return (
    <div className="view view-allpolls">
      <div className="ap-head">
        <div>
          <h2 className="card-title">All polls</h2>
          <p className="card-sub">
            Every individual national poll in the archive · {total} polls from {houses.length} pollsters,
            {" "}{(() => {  // span computed from the data, so it stays honest as polls are added
              const f = D.individualPolls[0], l = D.individualPolls[D.individualPolls.length - 1];
              const lab = (p) => { const [y, m] = p.ym.split("-").map(Number); return D.monthNameFull(m) + " " + y; };
              return lab(f) + "–" + lab(l);   // range: tight en dash, never spaced
            })()}
          </p>
        </div>
        <TextToggle value={facet} onChange={onFacet} options={FACETS}
          ariaLabel="Archive table view" caps />
      </div>

      <div className="ap-bar">
        <div className="ap-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>
          </svg>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search anything…" aria-label="Search polls" />
          {q && <button className="ap-search-x" onClick={() => setQ("")} aria-label="Clear search">×</button>}
        </div>

        <FilterPop id="who" label="Pollster" open={pop} setOpen={setPop}
          summary={sel.size === 0 ? null : sel.size === 1 ? [...sel][0] : sel.size + " selected"}>
          <div className="ap-pop-head">
            <span>{houses.length} pollsters</span>
            {sel.size > 0 && <button className="ap-clear" onClick={() => setSel(new Set())}>Clear</button>}
          </div>
          <div className="ap-poplist" role="group" aria-label="Pollsters">
            {houseRank.map((h) => (
              <PopRow key={h} on={sel.has(h)} label={h} n={houseN[h] || 0} onClick={() => toggleHouse(h)} />
            ))}
          </div>
        </FilterPop>

        <FilterPop id="when" label="Time" open={pop} setOpen={setPop}
          summary={range === "all" ? null : RANGE_LAB[range]}>
          {/* a set of role="radio" rows is only a choice to a screen reader if a
              radiogroup says so – otherwise each one reads as a stray control */}
          <div className="ap-poplist" role="radiogroup" aria-label="Time span">
            {[["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => (
              <PopRow key={id} radio on={range === id} label={lab} n={rangeN(id)} onClick={() => setRange(id)} />
            ))}
          </div>
        </FilterPop>

        <FilterPop id="has" label="Contains" open={pop} setOpen={setPop}
          summary={tagSel.size === 0 ? null : tagSel.size === 1 ? (POLL_TAG_META[[...tagSel][0]] || {}).label : tagSel.size + " measures"}>
          <div className="ap-pop-head">
            <span>What the poll published</span>
            {tagSel.size > 0 && <button className="ap-clear" onClick={() => setTagSel(new Set())}>Clear</button>}
          </div>
          <div className="ap-poplist" role="group" aria-label="Measures published">
            {shownTags.map((t) => (
              <PopRow key={t.id} on={tagSel.has(t.id)} label={t.label} note={t.title}
                      n={tagN[t.id] || 0} onClick={() => toggleTag(t.id)} />
            ))}
          </div>
          <p className="ap-pop-foot">Selecting two asks for polls carrying both.</p>
        </FilterPop>

        {/* The lead column is a 2PP idea, so its controls live and die with
            that view – and they are one button, because choosing the matchup
            and filtering by who holds it are the same thought. */}
        {facet === "twopp" && (
          <FilterPop id="lead" label="Lead" open={pop} setOpen={setPop}
            summary={[measure !== "lnp" ? MEASURE_LAB[measure] : null, lead !== "all" ? HOLDER_LAB[lead] + " ahead" : null].filter(Boolean).join(" · ") || null}>
            <div className="ap-pop-head"><span>Show the lead in</span></div>
            <div className="ap-poplist" role="radiogroup" aria-label="Lead column matchup">
              {["lnp", "onp", "lnponp"].map((m) => (
                <PopRow key={m} radio on={measure === m} label={MEASURE_LAB[m]}
                        n={rows.filter((r) => archLeadInfo(r, m)).length} onClick={() => onMeasure(m)} />
              ))}
            </div>
            <div className="ap-pop-head bordered"><span>Held by</span></div>
            <div className="ap-poplist" role="radiogroup" aria-label="Lead held by">
              {[{ id: "all", label: "Either" }].concat(
                ({ lnp: ["alp", "lnp"], onp: ["alp", "onp"], lnponp: ["lnp", "onp"] })[measure]
                  .map((id) => ({ id, label: HOLDER_LAB[id] }))).map((o) => (
                <PopRow key={o.id} radio on={lead === o.id} label={o.label}
                        n={o.id === "all" ? without("lead").length
                           : without("lead").filter((r) => { const li = archLeadInfo(r, measure); return li && li.who === o.id; }).length}
                        onClick={() => setLead(o.id)} />
              ))}
            </div>
          </FilterPop>
        )}

        <div className="ap-bar-end">
          <span className="ap-count">
            <strong>{sorted.length}</strong>{sorted.length !== total ? " of " + total : ""} {sorted.length === 1 ? "poll" : "polls"}
          </span>
          {/* big screens only – a spreadsheet export is a desktop task, and the
              button would crowd the narrow filter stack on phones */}
          <button className="ap-export" onClick={exportCsv}
                  title="Download these rows as CSV – exactly the current filters and order"
                  aria-label={"Export " + sorted.length + " polls as CSV"}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {pills.length > 0 && (
        <div className="ap-active">
          {pills.map((f) => (
            <span key={f.k} className={"ap-pill" + (f.auto ? " auto" : "")}>
              {f.lab}
              <button type="button" onClick={f.off} aria-label={"Remove filter: " + f.lab}>×</button>
            </span>
          ))}
          {pills.length > 1 && <button className="ap-clear" onClick={clearAll}>Clear all</button>}
        </div>
      )}

      <div className="table-wrap ap-wrap">
        <table className="poll-table archive">
          {/* 149 rows whose only name was a heading three elements away. Said
              once, out of sight, so a screen reader meets the table already
              knowing what it is and how much of it the filters left. */}
          <caption className="sr-only">
            All polls, {(FACETS.find((f) => f.id === facet) || {}).label} columns –
            {" "}{sorted.length} of {total} polls
          </caption>
          <thead>
            <tr>
              <th scope="col" className="exp-col" aria-hidden="true"></th>
              <ArchSortTh label="Pollster" k="pollster" sort={sort} onSort={onSort} className="ta-l" />
              <ArchSortTh label="Fieldwork" short="Field" k="date" sort={sort} onSort={onSort} className="ta-l" />
              <ArchSortTh label="Sample" k="sample" sort={sort} onSort={onSort} className="hide-md" />

              {facet === "twopp" && (<>
                <th scope="col" className="ta-l apub-col hide-md"
                    title="What the pollster published – a conventional 2PP, a 3-cornered preferred, or extra matchups">As published</th>
                <ArchSortTh label={({ lnp: "Lead · ALP v L/NP", onp: "Lead · ALP v ON", lnponp: "Lead · L/NP v ON", "3cp": "Lead · 3-cornered" })[measure]} short="Lead" k="alp" sort={sort} onSort={onSort} />
                {/* hide-sm: the last column to go on a phone – see the .hide-sm
                    note in the stylesheet. The row detail carries "House lean". */}
                <ArchSortTh label="House lean" short="Lean" k="lean" sort={sort} onSort={onSort} className="hide-sm" />
                <ArchSortTh label="House effect" short="H/fx" k="hfx" sort={sort} onSort={onSort} className="hide-sm" />
              </>)}
              {facet === "primary" && (<>
                <ArchSortTh label="ALP" k="p.alp" sort={sort} onSort={onSort} />
                <ArchSortTh label="L/NP" k="p.lnp" sort={sort} onSort={onSort} />
                <ArchSortTh label="GRN" k="p.grn" sort={sort} onSort={onSort} />
                <ArchSortTh label="ON" k="p.onp" sort={sort} onSort={onSort} />
                <th scope="col" className="hide-md">OTH</th>
              </>)}
              {facet === "leadership" && (<>
                <ArchSortTh label="Preferred PM" k="ppm.alb" sort={sort} onSort={onSort} className="ta-l two-pp-col hide-md" />
                <ArchSortTh label="Alb net" short="Alb" k="appr.albNet" sort={sort} onSort={onSort} />
                {/* the archive spans the Ley → Taylor handover, so the column
                    belongs to the OFFICE, not a name */}
                <ArchSortTh label="Opp. ldr net" short="Opp" k="appr.taylorNet" sort={sort} onSort={onSort} />
                <ArchSortTh label="Hanson net" short="Han" k="appr.hansonNet" sort={sort} onSort={onSort} />
              </>)}
              {facet === "direction" && (<>
                <ArchSortTh label="Right direction" short="Right" k="dir.right" sort={sort} onSort={onSort} />
                <ArchSortTh label="Wrong track" short="Wrong" k="dir.wrong" sort={sort} onSort={onSort} />
                <th scope="col" className="hide-md">Unsure</th>
                <ArchSortTh label="Net" k="dir.net" sort={sort} onSort={onSort} />
              </>)}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {sorted.map((p, i) => {
              const alpLead = p.alp >= 50;
              /* Identity, not position: this used to carry the row's index,
                 so re-sorting the table silently closed whatever was open -
                 and nothing outside could ask for a particular poll. House
                 plus fieldwork end is the same key AP.pollRowKey hands out. */
              const rowId = p.pollster + "|" + p.released;
              const arrived = !!focus && focus.key === rowId;
              const isOpen = open === rowId;
              const colCount = facet === "primary" ? 9 : facet === "leadership" ? 8 : facet === "direction" ? 8 : 8;
              return (
                <React.Fragment key={rowId}>
                <tr className={"poll-row arch-row" + (isOpen ? " open" : "") + (arrived ? " arrived" : "")}
                    onClick={() => setOpen(isOpen ? null : rowId)}>
                  <td className="exp-col">
                    <button className={"exp-btn" + (isOpen ? " open" : "")}
                            aria-label={isOpen ? "Collapse" : "Expand full breakdown"}
                            aria-expanded={isOpen}>▸</button>
                  </td>
                  <td className="ta-l pollster-cell">
                    <PollsterName name={p.pollster} url={p.url} />
                    {p.tags.length > 0 && (
                      <span className="poll-tags" aria-label={"Contains " + p.tags.map((id) => POLL_TAG_META[id].label).join(", ")}>
                        {p.tags.map((id) => (
                          <span key={id} className={"ptag t-" + id + (tagSel.has(id) ? " hit" : "")}
                                title={POLL_TAG_META[id].title}>{POLL_TAG_META[id].label}</span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="ta-l muted">{p.field}</td>
                  <td className="num muted hide-md">{p.sample != null ? p.sample.toLocaleString() : "—"}</td>

                  {facet === "twopp" && (<>
                  <td className="ta-l apub-col hide-md"><ArchPublished p={p} /></td>
                  <td className="num"><ArchLead p={p} measure={measure} /></td>
                  <td className="num hide-sm">
                    {p.lean == null
                      ? <span className="dash" title="No published 2PP to compare with the aggregate">—</span>
                      : <span className={"arch-lean " + (p.lean > 0.05 ? "alp" : p.lean < -0.05 ? "lnp" : "flat")}
                              title="Difference from the aggregate that month">
                          {p.lean > 0 ? "+" : ""}{p.lean.toFixed(1)}
                        </span>}
                  </td>
                  <td className="num hide-sm">
                    {p.hfx == null
                      ? <span className="dash" title="Not enough published polls to measure a house effect">—</span>
                      : <span className={"arch-lean " + (p.hfx.v > 0.05 ? "alp" : p.hfx.v < -0.05 ? "lnp" : "flat")}
                              title={`House effect: this pollster's 2PP sits ${p.hfx.v > 0 ? "+" : ""}${p.hfx.v.toFixed(1)} pts ${p.hfx.v >= 0 ? "to Labor" : "to the Coalition"} against the cross-pollster consensus (n=${p.hfx.n})`}>
                          {p.hfx.v > 0 ? "+" : ""}{p.hfx.v.toFixed(1)}
                        </span>}
                  </td>
                  </>)}
                  {facet === "primary" && (<>
                  <td className="num" style={{ color: "var(--alp-text)", fontWeight: 600 }}>{p.p.alp != null ? p.p.alp.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--lnp-text)", fontWeight: 600 }}>{p.p.lnp != null ? p.p.lnp.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--grn-text)" }}>{p.p.grn != null ? p.p.grn.toFixed(1) : "—"}</td>
                  <td className="num" style={{ color: "var(--onp-text)" }}>{p.p.onp != null ? p.p.onp.toFixed(1) : "—"}</td>
                  <td className="num muted hide-md">{p.p.oth != null ? p.p.oth.toFixed(1) : "—"}</td>
                  </>)}
                  {facet === "leadership" && (<>
                  <td className="two-pp-col share-col hide-md">
                    {ppmContests(p).length === 0
                      ? <span className="dash" title="No preferred-PM question this wave">—</span>
                      : <ShareBar segs={ppmContestSegs(ppmContests(p)[0])} compact flag={ppmFlag(ppmContests(p))} />}
                  </td>
                  <td className="num"><ArchApprCell s={p.appr.alb} net={p.appr.albNet} metric={p.appr.metricBy && p.appr.metricBy.alb} /></td>
                  <td className="num"><ArchApprCell s={p.appr.taylor} net={p.appr.taylorNet} metric={p.appr.metricBy && p.appr.metricBy.taylor} /></td>
                  <td className="num"><ArchApprCell s={p.appr.hanson} net={p.appr.hansonNet} metric={p.appr.metricBy && p.appr.metricBy.hanson} /></td>
                  </>)}
                  {facet === "direction" && (<>
                  <td className="num" style={{ color: "var(--mood-pos)", fontWeight: 600 }}>
                    {p.dir ? <>{p.dir.right.toFixed(1)}<ChgTag v={p.dir.chg && p.dir.chg.right} refDate={p.dir.ref} /></> : <span className="dash">—</span>}
                  </td>
                  <td className="num" style={{ color: "var(--mood-neg)", fontWeight: 600 }}>
                    {p.dir ? <>{p.dir.wrong.toFixed(1)}<ChgTag v={p.dir.chg && p.dir.chg.wrong} refDate={p.dir.ref} /></> : <span className="dash">—</span>}
                  </td>
                  <td className="num muted hide-md">{p.dir ? p.dir.unsure.toFixed(1) : "—"}</td>
                  <td className="num"><ArchDirCell d={p.dir} /></td>
                  </>)}
                </tr>
                {isOpen && (
                  <tr className="detail-row">
                    <td colSpan={colCount}>
                      <ArchPollDetail p={p} onBack={arrived ? onBack : null} backLabel={backLabel} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {sorted.length === 0 && (
              <tr className="arch-empty">
                <td colSpan={facet === "primary" ? 9 : facet === "leadership" ? 8 : 8}>
                  No polls match these filters. <button className="ap-clear" onClick={clearAll}>Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="table-hint">
        Tap any poll for its full breakdown · dates are fieldwork windows (publication dates sit in the
        breakdown) · “as published” lists each poll’s headline figures exactly as the pollster released them ·
        the lead bar shows the selected matchup where a pollster published it · “house lean” is the poll minus
        the aggregate for that month · <strong>house effect</strong> is how far that pollster systematically
        sits from the cross-house consensus on 2PP – its own average lean across every poll it has published,
        shrunk toward zero when it has published few; the aggregates subtract it, and it is a property of the
        pollster, not of this one poll · “—” means the pollster didn’t publish that measure · search matches
        anything in a row · click any column heading to sort.
      </p>

      <VariancePanel facet={facet} rangeId={range} />
    </div>
  );
}

Object.assign(window, { Tabs, PastCyclesView, AllPollsView,
  // shared cell renderers reused by the latest-polls table
  ArchSortTh, ArchPublished, ArchLead, ArchApprCell, ArchDirCell, archLeadInfo });
