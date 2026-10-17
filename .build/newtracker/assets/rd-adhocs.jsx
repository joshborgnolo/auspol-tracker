// ====================================================================
// AD HOC TOPICAL & ISSUE QUESTIONS – the fifth menu page
// ====================================================================
/* The catalogue of one-off and occasional reads: every question the five
   covered houses asked outside the standing battery (voting intention,
   leader ratings, preferred prime minister). The payload is the
   oneoffs-source sidecar gen-data emits from data/news24-one-offs.json,
   data/redbridge-one-offs.json, data/secnewgate-one-offs.json,
   data/essential-one-offs.json and data/resolve-one-offs.json – fetched
   lazily like the cycle source, since nobody but this page reads it. Themes arrive ordered in the
   payload (adhoc-themes.mjs is the single source of truth, and gen-data
   fails the build on a question it cannot place), so the page trusts the
   order it is handed. RdAdhocs is the redesign section (head + body);
   RdAoEntries is the body alone so the archived classic design can mount
   the same catalogue without the rd chrome (rule 5 – no classic-design
   updates; the body styles are page-level .ao-*, not rd-gated). */
const { useState: aoUseState, useEffect: aoUseEffect, useMemo: aoUseMemo } = React;

const AO_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AO_HOUSES = {
  news24: { short: "News24 Pulse", full: "YouGov – News24 Pulse" },
  redbridge: { short: "RedBridge/Accent", full: "RedBridge/Accent – AFR" },
  secnewgate: { short: "SEC Newgate", full: "SEC Newgate – Mood of the Nation" },
  essential: { short: "Essential Report", full: "Essential Report" },
  resolve: { short: "Resolve", full: "Resolve Political Monitor" },
};

const aoDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + AO_MONTHS[m - 1] + " " + y;
};
/* The span a wave covers: same-day fieldwork collapses to the single day,
   a range inside one month shares the month word. */
const aoSpan = (w) => {
  if (w.dateStart && w.dateEnd && w.dateStart !== w.dateEnd) {
    const [sy, sm] = w.dateStart.split("-").map(Number);
    const [ey, em] = w.dateEnd.split("-").map(Number);
    if (sy === ey && sm === em) {
      return w.dateStart.slice(8) + "–" + Number(w.dateEnd.slice(8)) + " " + AO_MONTHS[sm - 1] + " " + sy;
    }
    return aoDay(w.dateStart) + " – " + aoDay(w.dateEnd);
  }
  return aoDay(w.dateEnd || w.dateStart || w.waveDate);
};
const aoPct = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/* Group the flat entry list into the page's theme → question → wave tree.
   Questions first by series length (a recurring read outranks a one-off),
   ties broken by the newest wave, so fresh material heads its theme. */
function aoGroup(src) {
  const byTheme = new Map();
  for (const e of src.entries || []) {
    if (!byTheme.has(e.theme)) byTheme.set(e.theme, []);
    byTheme.get(e.theme).push(e);
  }
  return (src.themes || []).map((t) => {
    const byQ = new Map();
    for (const e of byTheme.get(t.id) || []) {
      if (!byQ.has(e.id)) byQ.set(e.id, []);
      byQ.get(e.id).push(e);
    }
    const questions = [...byQ.entries()].map(([id, waves]) => {
      waves.sort((a, b) => (a.waveDate < b.waveDate ? 1 : a.waveDate > b.waveDate ? -1 : 0));
      return {
        id,
        question: waves[0].question,
        houses: [...new Set(waves.map((w) => w.house))].sort(),
        waves,
      };
    }).sort((a, b) => {
      if (a.waves.length !== b.waves.length) return b.waves.length - a.waves.length;
      const ad = a.waves[0].waveDate, bd = b.waves[0].waveDate;
      return ad < bd ? 1 : ad > bd ? -1 : a.question.localeCompare(b.question);
    });
    return { ...t, questions };
  }).filter((t) => t.questions.length);
}

/* One wave's share rows, drawn as labelled bars on a common 0–100 track so
   a recurring question's waves read against each other. */
function AoFigs({ rows }) {
  return (
    <div className="ao-figs">
      {rows.map((r, i) => {
        const n = aoPct(r[1]);
        return (
          <div className="ao-fig" key={i}>
            <span className="ao-fl">{r[0]}</span>
            <span className="ao-fb"><i style={{ width: (n === null ? 0 : Math.min(100, Math.max(0, n))) + "%" }} /></span>
            <span className="ao-fv">{n === null ? "–" : n + "%"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* A folded table (News24 demographic crosstabs; RedBridge's per-table
   follow-ups). Two-cell rows render as figures, wider rows as a table. */
function AoTable({ t }) {
  const rows = t.rows || [];
  const asFigs = rows.length > 0 && rows.every((r) => r.length === 2) && !t.headers;
  return (
    <div className="ao-table-b">
      {t.title ? <div className="ao-table-t">{t.title}</div> : null}
      {asFigs ? <AoFigs rows={rows} /> : (
        <div className="ao-twrap">
          <table className="ao-table">
            {t.headers && t.headers.length ? (
              <thead><tr>{t.headers.map((h, hi) => <th key={hi} className={hi ? "" : "ao-l"}>{h}</th>)}</tr></thead>
            ) : null}
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => {
                    const n = aoPct(c);
                    return <td key={ci} className={ci ? "" : "ao-l"}>{ci === 0 ? c : (n === null ? (c || "–") : n + "%")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AoWave({ w, multiHouse }) {
  const all = (w.tables || []);
  const figs = all.length && all[0].rows ? all[0].rows : [];
  const rest = all.slice(1).filter((t) => (t.rows || []).length);
  return (
    <div className="ao-wave">
      <div className="ao-wmeta">
        {multiHouse ? <span className="ao-whouse">{AO_HOUSES[w.house].full}</span> : null}
        <span>{aoSpan(w)}</span>
        {w.sample ? <span>n {w.sample.toLocaleString("en-AU")}</span> : null}
        {w.sampleEff ? <span>effective n {w.sampleEff.toLocaleString("en-AU")}</span> : null}
        {w.url ? <a className="ao-src" href={w.url} target="_blank" rel="noopener">Source ↗</a> : null}
      </div>
      {w.proseOnly || !figs.length ? (
        <p className="ao-only">
          {w.proseOnly
            ? "Asked, but this wave's figures are image-only or reported in prose; the source has them."
            : "No all-voters figures on file for this wave; the source has them."}
        </p>
      ) : (
        <AoFigs rows={figs} />
      )}
      {w.note ? <p className="ao-note">{w.note}</p> : null}
      {rest.length ? (
        <details className="ao-fold">
          <summary>{rest.length === 1 ? "Breakdown table" : "Breakdown tables · " + rest.length}</summary>
          {rest.map((t, ti) => <AoTable key={ti} t={t} />)}
        </details>
      ) : null}
    </div>
  );
}

function RdAoEntries() {
  const { D } = window.AP;
  const [src, setSrc] = aoUseState(null);
  const [failed, setFailed] = aoUseState(false);
  const [tries, setTries] = aoUseState(0);
  aoUseEffect(() => {
    let live = true;
    D.loadOneOffs().then((j) => {
      if (!live) return;
      /* A payload with zero entries is a loaded-but-empty catalogue (a store
         not yet committed on this checkout), not a failure to load. */
      if (j && Array.isArray(j.entries)) { setSrc(j); setFailed(false); }
      else { setFailed(true); }
    });
    return () => { live = false; };
  }, [tries]);
  const themes = aoUseMemo(() => (src ? aoGroup(src) : []), [src]);

  if (failed) {
    return (
      <section className="ao" id="ad-hocs">
        <p className="ao-note">
          The catalogue could not be loaded.{" "}
          <button type="button" className="ao-retry" onClick={() => setTries((n) => n + 1)}>Try again</button>
        </p>
      </section>
    );
  }
  if (!src) {
    return <section className="ao" id="ad-hocs"><p className="ao-note">Loading the catalogue…</p></section>;
  }

  const qCount = themes.reduce((n, t) => n + t.questions.length, 0);
  if (!qCount) {
    return (
      <section className="ao" id="ad-hocs">
        <p className="ao-note">No one-off questions are on file yet. As YouGov – News24 Pulse, RedBridge/Accent, SEC Newgate, Essential Report and Resolve Political Monitor polls publish their first ad hoc questions, they will appear here grouped by theme.</p>
      </section>
    );
  }
  const wCount = (src.entries || []).length;
  return (
    <section className="ao" id="ad-hocs">
      <div className="ao-legend">
        <span>{themes.length + " themes"}</span>
        <span>{qCount + " questions"}</span>
        <span>{wCount + " waves"}</span>
        <span>{"YouGov – News24 Pulse, RedBridge/Accent (via the AFR), SEC Newgate's Mood of the Nation, the Essential Report and the Resolve Political Monitor in The Sydney Morning Herald and The Age"}</span>
      </div>
      {themes.map((t) => (
        <div className="ao-theme" key={t.id}>
          <h3 className="ao-t-t">{t.title}</h3>
          <p className="ao-t-dek">{t.dek}</p>
          <div className="ao-qs">
            {t.questions.map((q) => (
              <div className="ao-card" key={q.id}>
                <div className="ao-chead">
                  <h4 className="ao-q">{q.question}</h4>
                  <div className="ao-chips">
                    {q.houses.map((h) => <span key={h} className={"ao-chip ao-chip-" + h}>{AO_HOUSES[h].short}</span>)}
                    <span className="ao-chip">{q.waves.length > 1 ? q.waves.length + " waves" : "one wave"}</span>
                  </div>
                </div>
                <AoWave w={q.waves[0]} multiHouse={q.houses.length > 1} />
                {q.waves.length > 1 ? (
                  <details className="ao-fold ao-prior">
                    <summary>{q.waves.length - 1 === 1 ? "Earlier wave" : "Earlier waves · " + (q.waves.length - 1)}</summary>
                    {q.waves.slice(1).map((w) => <AoWave key={w.house + w.waveDate} w={w} multiHouse={q.houses.length > 1} />)}
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RdAdhocs() {
  return (
    <section className="rd-sec rd-adhocs" id="ad-hocs" aria-labelledby="rd-ao-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-ao-t">Ad hoc topical and issue questions</h2>
        <span className="rd-meta">The one-offs beyond the standing battery</span>
      </div>
      <RdHed head="Asked once, about the issue of the moment"
        dek="Voting intention, leader ratings and the preferred-prime-minister contest come around every wave; these questions did not. Below is every one-off and occasional topical read on file from YouGov’s News24 Pulse, RedBridge/Accent (published in the Australian Financial Review), SEC Newgate’s Mood of the Nation, the fortnightly Essential Report and the Resolve Political Monitor in The Sydney Morning Herald and The Age, grouped by theme, with every figure each wave published. A question asked more than once collapses into its series; demographic breakdowns sit behind the fold-outs." />
      <RdAoEntries />
    </section>
  );
}

const RdAdhocsM = React.memo(RdAdhocs);
const RdAoEntriesM = React.memo(RdAoEntries);

Object.assign(window, { RdAdhocs: RdAdhocsM, RdAoEntries: RdAoEntriesM });
