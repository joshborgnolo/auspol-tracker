/* ====================================================================
   THE MENU PAGES' FINDINGS – each page's head, written once

   The More menu (Tabs, d1a1d215) lists every menu page under the page's
   own headline and the figure that headline stands on, so the menu can
   never say what the page doesn't. Three of those headlines are findings
   with rules of their own (Poll disagreement, Pollster leans,
   Respondent-allocated preference flows); they used to be written inside
   their components, and now the
   components and the menu both read them from here.

   Lives in the PLAIN layer for the reason np-project.js does: there is
   EXACTLY ONE implementation. The page runs it from here, and build.mjs
   runs this same file in node, after the dataset and the engine
   (ed2260de), to write the lines into auspol-now.json, where site-shell.js
   fills them into the satellites' menu. So it may call only what the plain
   layer defines - window.AUSPOL, the engine's window.AP and the helpers at
   the foot of ed2260de - never a component's. Top-level consts here land in
   the shared global lexical scope like np-project.js's (FF_COHORTS and
   flFig are the flows page's too); never re-declare them in a later script.

   Each finding keeps the rules it had in its component, and every claim
   clears its own test: the disagreement's 1.2× band, a lean's displayed
   tenth, the flows' ±ci95 drift margin and Holm-corrected slopes. The
   menu's figure is the number the page itself prints for the headline's
   claim, at the page's own precision:
     Poll disagreement   the widest spread-to-chance ratio among the
                         parties the headline names (all four when it names
                         none), as each panel prints it: "1.5×"
     Pollster leans      the headline's own lean, signed as the table prints
                         it (+ towards Labor), on the two-party tab the page
                         opens on
     Respondent-allocated preference flows
                         the move the headline reports, where it reports
                         one: the pollsters' drift in points, or the share
                         of the voter group now picking the side it names
     Flows explained     the two frozen flow tables the implied figures are
                         read through, one mini-row per matchup: each voter
                         group's share of preferences reaching Labor, a bare
                         whole number in the group's tone
     Election map        the seats the largest party holds today, in its
                         tone, under "Labor holds 94 of the 150 seats" (and
                         how many seats have changed hands or party since
                         the election, where any have)
     Public opinion      the date the catalogue's newest entry published
     Changelog           the date of the newest entry
   A headline that reports no single quantity ("no pollster leans away from
   the pack", preferences "still flowing much as they did") gets no figure,
   and Info has none to give.
   ==================================================================== */

/* the flows page's voter groups (its ledger rows, the battery's cohorts) */
const FF_COHORTS = {
  coal: { name: "Coalition", prose: "Coalition", cls: "lnp", share: "lnp" },
  grn:  { name: "Greens", prose: "Greens", cls: "grn", share: "grn" },
  onp:  { name: "One Nation", prose: "One Nation", cls: "onp", share: "onp" },
  oth:  { name: "Other", prose: "other", cls: "oth", share: "oth" },
  alp:  { name: "Labor", prose: "Labor", cls: "alp", share: "alp" },
};
/* a figure at its source's precision: a fixed-precision column (the counts,
   dp 1) prints it on every row, the rest print as their source does - the
   waves whole numbers, DemosAU's 21.5 with its half */
const flFig = (v, dp) => (dp != null ? v.toFixed(dp) : Math.round(v * 10) % 10 === 0 ? String(Math.round(v)) : v.toFixed(1));

(function () {
  const AP = window.AP;
  const D = window.AUSPOL;

  /* ---------------------------------------------------------- Poll disagreement
     From the primaries, whichever tab the page has open. A party's polls
     disagree when their spread is 1.2 times what sampling error alone would
     produce, the panels' "a little beyond chance" */
  const DIS_PARTY = { p_onp: ["One Nation", "onp"], p_lnp: ["Coalition", "lnp"], p_alp: ["Labor", "alp"], p_grn: ["Greens", "grn"] };
  AP.disStory = function disStory() {
    const lastOf = (id) => { const s = AP.discord(id).filter((d) => d.sigma != null); return s.length ? s[s.length - 1] : null; };
    const on = lastOf("p_onp"), co = lastOf("p_lnp"), right = lastOf("rd_right"), alp = lastOf("p_alp"), grn = lastOf("p_grn");
    const beyond = (d) => d && d.R >= 1.2;
    /* the figure: the widest ratio among the parties the head names */
    const figOf = (ids) => {
      const top = ids.map((id) => [id, lastOf(id)]).filter(([, d]) => d && d.R != null)
        .sort((a, b) => b[1].R - a[1].R)[0];
      return top ? { v: top[1].R.toFixed(1) + "×", cap: DIS_PARTY[top[0]][0] + " v chance", tone: DIS_PARTY[top[0]][1] } : null;
    };
    let head, dek, fig;
    if (on && co && right && (beyond(on) || beyond(co)) && !beyond(right)) {
      const r = (on.R + co.R) / 2;
      const how = r < 1.3 ? "a little further than" : r < 1.75 ? "about half as much again as" : r < 2.25 ? "about twice as far as" : "more than twice as far as";
      head = "Pollsters agree on the size of the right’s vote but disagree on its split";
      dek = `Polls of One Nation’s vote typically sit ${on.sigma.toFixed(1)} points from the trend through them, and polls of the Coalition’s ${co.sigma.toFixed(1)}: ${how} sampling error alone would put them. `
        + `Add the two parties together, though, and their combined vote varies only as much as chance allows${alp && !beyond(alp) ? ", as Labor’s does" : ""}.`;
      fig = figOf(["p_onp", "p_lnp"].filter((id) => beyond(id === "p_onp" ? on : co)));
    } else {
      const all = [["One Nation’s", on, "p_onp"], ["the Coalition’s", co, "p_lnp"], ["Labor’s", alp, "p_alp"], ["the Greens’", grn, "p_grn"]].filter(([, d]) => d);
      const wide = all.filter(([, d]) => beyond(d));
      if (!wide.length) {
        head = "The polls agree about as closely as sampling error allows";
        dek = "Polls of every party’s vote sit about as far from the trend through them as their samples alone would put them"
          + (all.some(([, d]) => d.R < 0.8) ? ", and some sit closer than chance allows, which can mean pollsters steering towards each other." : ".");
        fig = figOf(all.map(([, , id]) => id));
      } else {
        head = "The polls disagree on " + rdList(wide.map(([n]) => n)) + " vote";
        dek = wide.map(([n, d]) => `Polls of ${n} vote typically sit ${d.sigma.toFixed(1)} points from the trend through them, against ${d.floor.toFixed(1)} from sampling error alone.`).join(" ");
        fig = figOf(wide.map(([, , id]) => id));
      }
    }
    return { head, dek, fig };
  };

  /* ---------------------------------------------------------- Pollster leans
     One finding per measure tab, worded in the open measure's own terms: who
     leans furthest on it, by how much, and who comes next. The tabs: "tpp"
     (the page's two-party contest, onM = against One Nation, pub = the
     published figures), "split" (One Nation against the Coalition), and each
     party's primary. */
  /* One Nation against the Coalition: each pollster's lean on the gap
     between the two primaries. The estimator is linear and all but one poll
     files both, so that lean is its One Nation lean less its Coalition lean;
     taken from the two series the tabs beside it draw, it always agrees
     with them to the decimal. */
  let leanCache = null;
  AP.leanSeries = function leanSeries() {
    const HL0 = D.houseLean || {};
    if (leanCache && leanCache.src === HL0) return leanCache.HL;
    const HL = { ...HL0, split: Object.fromEntries(Object.keys(HL0.onp || {}).filter((h) => (HL0.lnp || {})[h]).map((h) => {
      const co = Object.fromEntries(HL0.lnp[h].map((d) => [d.ym, d.v]));
      return [h, HL0.onp[h].filter((d) => co[d.ym] != null)
        .map((d) => ({ ym: d.ym, v: Math.round((d.v - co[d.ym]) * 10) / 10, on: d.v, co: co[d.ym] }))];
    })) };
    leanCache = { src: HL0, HL };
    return HL;
  };
  /* the series a tab reads: the two-party tab's follows the contest and basis */
  AP.leanKey = (view, onM, pub) => (view === "tpp" ? (pub ? (onM ? "onpub" : "tpp") : (onM ? "onimp" : "imp")) : view);
  /* each pollster's series on it, with its latest lean */
  AP.leanRows = (key) => {
    const HL = AP.leanSeries();
    return Object.keys(HL[key] || {}).map((h) => {
      const s = HL[key][h] || [];
      return { h, s, v: s.length ? s[s.length - 1].v : 0 };
    }).filter((r) => r.s.length);
  };
  AP.leanStory = function leanStory(view, onM, pub) {
    const rowsOf = AP.leanRows;
    const key = AP.leanKey(view, onM, pub);
    const hlWords = (id) => {
      if (id === "tpp") {
        const rival = onM ? "One Nation" : "the Coalition";
        return { hi: (pl) => `lean${pl ? "" : "s"} furthest to Labor`,
          lo: (pl) => `lean${pl ? "" : "s"} furthest to ${rival}` };
      }
      if (id === "split") return { hi: (pl) => `read${pl ? "" : "s"} One Nation widest against the Coalition`,
        lo: (pl) => `read${pl ? "" : "s"} One Nation narrowest against the Coalition` };
      const whose = { alp: "Labor’s", lnp: "the Coalition’s", onp: "One Nation’s", grn: "the Greens’", oth: "the others’" }[id];
      return { hi: (pl) => `read${pl ? "" : "s"} ${whose} vote highest`,
        lo: (pl) => `read${pl ? "" : "s"} ${whose} vote lowest` };
    };
    const hlJoin = (ns) => ns.length > 2 ? ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1] : ns.join(" and ");
    let head = null, dek = null, fig = null;
    const hsr = rowsOf(key).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).filter((r) => Math.abs(r.v) >= 0.05);
    if (hsr.length) {
      const words = hlWords(view === "tpp" ? "tpp" : view);
      const tail = " The averages take each lean out before the polls are combined.";
      const fmtPt = (v) => `${v.toFixed(1)} point${v.toFixed(1) === "1.0" ? "" : "s"}`;
      /* a shared lean needs the leader's way as well as its distance: a -1.2
         beside a +1.2 is the OUTLIER on the other side, not a fellow traveller.
         "About the same" = within one displayed tenth (0.1pt) of the leader,
         so two pollsters level at the top are BOTH named in the headline */
      const sgn = hsr[0].v > 0;
      const tied = hsr.filter((r) => (r.v > 0) === sgn && Math.abs(r.v) >= Math.abs(hsr[0].v) - 0.1);
      const next = hsr.filter((r) => !tied.includes(r));
      /* the head's figure is the tied group's FLOOR, so "A and B lean
         furthest, and by 1.2 points" stays true of every house named */
      const pl = tied.length > 1, topV = Math.min(...tied.map((r) => Math.abs(r.v)));
      head = `${hlJoin(tied.map((r) => r.h))} ${(sgn ? words.hi : words.lo)(pl)}, and ${topV <= 1 ? "only " : ""}by ${fmtPt(topV)}`;
      if (!next.length) {
        dek = "No other pollster leans measurably either way." + tail;
      } else {
        const nextMax = Math.abs(next[0].v);
        const nextTied = next.filter((r) => Math.abs(r.v) >= nextMax - 0.1);
        dek = `${hlJoin(nextTied.map((r) => r.h))} ${nextTied.length > 1 ? "are" : "is"} next, ${fmtPt(nextMax)} off`
          + (next.length > nextTied.length ? "; no other pollster is further out" : "")
          + `.${topV >= 1 && nextMax <= topV / 2 ? ` ${pl ? "They are" : "It is"} well clear of the pack.` : ""}${tail}`;
      }
      /* the menu's figure: that same floor, signed the table's way, in the
         colour of the side it leans to */
      const tone = view === "tpp" ? (sgn ? "alp" : onM ? "onp" : "lnp") : view === "split" ? (sgn ? "onp" : "lnp") : view;
      fig = { v: rdSigned(sgn ? topV : -topV, 1), cap: pl ? tied.length + " pollsters" : tied[0].h, tone };
    } else if (rowsOf(key).length) {
      head = "No pollster leans away from the pack here";
      dek = "Every pollster sits level with the pollsters polling beside it. The averages take out any lean that builds up.";
    }
    return { head, dek, fig };
  };

  /* --------------------------------------- Respondent-allocated preference flows
     The head and dek, on written rules. A move in the pollsters' own
     two-party figures (a drift clear of its margin) leads, as the strongest
     evidence; else a clear move in what voters say (the battery's Yes
     rows) leads; else preferences are still flowing as at the election.
     Every clause clears its own test: the drift's ±ci95, the battery's
     Holm-corrected slope. Null where the dataset carries no drift (the page
     draws nothing then either). */
  AP.flowStory = function flowStory() {
    const FD = D.flowDrift, FO = D.flowDriftOn;
    const FF = D.flowForced, FT = D.flowTables;
    if (!FD || !FO || !FD.now || !FO.now) return null;
    const nC = FD.now, nO = FO.now;
    const mi = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
    const E = FF && FF.elec2025r;

    /* ---- the pressed-choice battery: one straight line per voter group
       through RedBridge's monthly answers (DemosAU's three quarterlies for
       the Coalition v One Nation contest - too few to fit), w=1 (every wave
       is ~1,000), Holm's correction across the rows. Always the All-voters
       series, so the head never moves with the region menu. A Yes is what
       the ledger's "down from 23 in Feb" and the section head ride, so no
       copy claims a move the battery won't stand behind */
    const allMrp = (ws) => (ws || []).map((w) => (w.all ? { ...w, ...w.all } : w));
    const ff = FF ? [
      ["on", FF.vsOn, ["grn", "coal", "oth"]], ["co", FF.vsCoal, ["grn", "onp", "oth"]], ["ln", allMrp(FF.lnpOn), ["alp", "grn", "oth"]],
    ].flatMap(([cq, waves, cks]) => cks.map((ck) => {
      const s = waves.filter((w) => w[ck] != null);
      return { key: cq + ck, ck, q: cq, waves: s,
        fit: withinHouseSlope(s.map((w) => ({ h: cq + ck, t: (w.xm ?? mi(w.ym)) / 12, w: 1, y: w[ck] }))) };
    })) : [];
    {
      const tested = ff.filter((r) => r.fit), sigK = [];
      for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
        if (r.fit.p >= 0.05 / (tested.length - i)) break;
        sigK.push(r.key);
      }
      for (const r of ff) r.sig = sigK.includes(r.key);
    }
    const movedOf = (cq, ck) => {
      const r = ff.find((x) => x.key === cq + ck);
      if (!r || !r.sig) return null;
      const f = r.waves[0][ck], la = r.waves[r.waves.length - 1][ck];
      return f === la ? null : { from: f, to: la, ym: r.waves[0].ym, up: la > f };
    };

    const s1 = (v) => Math.abs(v).toFixed(1);
    const phr = (v, who) => (Math.abs(v) < 0.05 ? "level against " + who
      : s1(v) + " points kinder to " + (v > 0 ? "Labor against " + who : who));
    const ci = Math.max(nC.ci95, nO.ci95);
    const worst = Math.max(Math.abs(nC.v), Math.abs(nO.v));
    const outC = Math.abs(nC.v) > nC.ci95, outO = Math.abs(nO.v) > nO.ci95;
    const moves = ff.filter((r) => movedOf(r.q, r.ck)).map((r) => ({ ...r, m: movedOf(r.q, r.ck) }));
    const anchorOf = (cq) => (cq === "ln" ? "the Coalition" : "Labor");
    const rivalOf = (cq) => (cq === "co" ? "the Coalition" : "One Nation");
    const voiceMove = moves.length === 1 ? moves[0] : null;
    const head = outC || outO
      ? (outC && outO ? "Preferences have moved since the election, in both contests"
        : "Preferences " + (outO ? "against One Nation" : "against the Coalition") + " have moved " + ((outO ? nO.v : nC.v) > 0 ? "towards Labor" : "away from Labor") + " since the election")
      : voiceMove ? FF_COHORTS[voiceMove.ck].name + " voters say they’d now send " + anchorOf(voiceMove.q) + " " + (voiceMove.m.up ? "more" : "fewer") + " preferences"
      : moves.length > 1 ? "Voters say their preferences have shifted since " + rdMonthYear(moves[0].m.ym).split(" ")[0]
      : "Preferences are still flowing much as they did at the election";
    const dekA = "This site’s two-party figures assume fixed preference flows: the " + rdElecYear + " count against the Coalition, and a table built from " + rdElecYear + "’s ballots against One Nation.";
    const dekB = voiceMove
      ? (() => {
        const r = voiceMove, m = r.m;
        /* the assumption the answer is set beside: two figures quoted, no
           claim of a gap between them (the battery tests the move, not this) */
        const refTxt = r.q === "co" && E ? ", against the " + flFig(E.all[r.ck], 1) + "% the " + rdElecYear + " count sent " + anchorOf(r.q) + "’s way"
          : r.q === "on" && FT ? ", against the " + flFig(FT.onp[r.ck === "coal" ? "lnp" : r.ck] * 100) + "% the site assumes" : "";
        return " Asked to choose, " + m.to + "% of " + FF_COHORTS[r.ck].prose + " voters now pick " + anchorOf(r.q) + " over " + rivalOf(r.q)
          + " in " + (r.q === "ln" ? "DemosAU’s MRP" : "RedBridge/Accent’s poll") + ", " + (m.up ? "up" : "down") + " from " + m.from + "% in " + rdMonthYear(m.ym).split(" ")[0] + refTxt + ".";
      })()
      : moves.length > 1 ? " Asked to choose, " + moves.map((r) => FF_COHORTS[r.ck].prose + " voters " + (r.m.up ? "up" : "down") + " from " + r.m.from + "% to " + r.m.to + "%").join("; ") + "."
      : " Voters’ own answers to pollsters haven’t clearly moved since February either.";
    const dekC = " The pollsters’ own two-party figures " + (outC || outO ? "have moved: they sit " : voiceMove || moves.length ? "don’t show it yet: they sit " : "sit where their primary votes and the flows put them: ")
      + phr(nC.v, "the Coalition") + ", and " + phr(nO.v, "One Nation") + ", "
      + (worst < ci / 2 ? "well inside" : worst <= ci ? "inside" : "outside") + " the margin of ±" + ci.toFixed(1) + ".";
    const dek = FF ? dekA + (voiceMove || moves.length ? dekB : "") + dekC
      : "The pollsters’ own two-party figures sit where their primary votes and the " + rdElecYear + " flows put them: " + phr(nC.v, "the Coalition") + ", and " + phr(nO.v, "One Nation") + ", "
        + (worst < ci / 2 ? "well inside" : worst <= ci ? "inside" : "outside") + " the margin of ±" + ci.toFixed(1) + ". A shift in where voters send their preferences would show here first.";
    /* the menu's figure: the drift the head names (the wider of the two when
       both moved), signed as the drift chart prints it, or the share of the
       one group whose answers moved, as the dek quotes it */
    let fig = null;
    if (outC || outO) {
      const onWay = outO && (!outC || Math.abs(nO.v) >= Math.abs(nC.v));
      const v = onWay ? nO.v : nC.v;
      fig = { v: rdSigned(v, 1), cap: "Pts v " + (onWay ? "One Nation" : "Coalition"), tone: v > 0 ? "alp" : onWay ? "onp" : "lnp" };
    } else if (voiceMove) {
      fig = { v: voiceMove.m.to + "%", cap: (voiceMove.ck === "oth" ? "Others" : FF_COHORTS[voiceMove.ck].name) + " to " + anchorOf(voiceMove.q).replace(/^the /, ""),
        tone: FF_COHORTS[voiceMove.ck].cls };
    }
    return { head, dek, fig, ff, movedOf };
  };

  /* ---------------------------------------------------------- the static heads
     The pages whose head is a title rather than a finding: the components
     head themselves with these, and the menu quotes them */
  AP.PAGE_HEAD = {
    "flows-explained": "There are two ways to get a two-party figure from a poll",
    "public-opinion": "Australians’ views on topical subjects",
    info: "Answers to questions you may have",
  };

  /* ---------------------------------------------------------- Changelog
     The newest entry's first sentence, as the log wrote it, less the two
     asides a menu line has no room for: a poll's fieldwork and sample
     ("(fieldwork 10–29 Jul, n=5,007)") and the estimate's contest and basis
     ("(Labor v the Coalition, implied flows)", its pairName and basisName).
     Everything else - the house names' own brackets, "(it was Labor v One
     Nation)" - stays. The log's sentences are .build/changelog.mjs's
     templates, so the cut is exact (test-changelog pins it) */
  AP.changelogGist = (text) => {
    const m = String(text || "").match(/^.*?\.(?=\s|$)/);
    return (m ? m[0] : String(text || ""))
      .replace(/ \(fieldwork [^)]*\)/g, "")
      .replace(/ \((?:Labor v [^,)]+, )?(?:implied flows|published figures)\)/g, "")
      .replace(/\.$/, "");
  };

  /* ---------------------------------------------------------- the flows explainer
     The one static-title page WITH a figure: the two frozen flow tables the
     implied two-party figures are read through, drawn straight off
     flowTables - the cells the estimator itself reads, so the menu can
     never quote a table the page doesn't use. Per matchup, a trio of bare
     whole-number shares reaching Labor, each in its voter group's tone,
     over a "To Labor v <rival>" caption (spelled-out "versus" would not
     fit the figure column; "v" is the menu's own idiom). The explainer
     prints the same figures at its own precision (88.2/25.5/54.5 against
     the Coalition, 91/30/55 against One Nation); the graphic rounds them
     whole. Against the Coalition the trio is Greens / One Nation / Others -
     the counted cut; against One Nation it is Greens / Coalition / Others,
     the built one (a One-Nation-to-Labor cell cannot exist in a final two
     of Labor v One Nation). Rows follow the headline matchup
     (latest.rivalLead, the hero's rule). A missing cell or table gives way
     to the "Explainer" chip, the shape it wore without a figure. */
  AP.flowsExplainedFig = function flowsExplainedFig() {
    const T = D.flowTables;
    if (!T || !T.lnp || !T.onp) return null;
    const row = (tab, keys, cap) => {
      const cells = keys.map(([k, tone]) => (typeof tab[k] === "number" ? { v: String(Math.round(tab[k] * 100)), tone } : null));
      return cells.every(Boolean) ? { cap, cells } : null;
    };
    const co = row(T.lnp, [["grn", "grn"], ["onp", "onp"], ["oth", "oth"]], "To Labor v Coalition");
    const on = row(T.onp, [["grn", "grn"], ["lnp", "lnp"], ["oth", "oth"]], "To Labor v One Nation");
    if (!co || !on) return null;
    return { rows: ((D.latest || {}).rivalLead || "alp_lnp") === "alp_on" ? [on, co] : [co, on] };
  };

  /* ---------------------------------------------------------- the menu's lines
     { id: { head, fig: { v, cap, tone } | { rows: [{ cap, cells }] } | null,
     chip } } for every menu page (and Info, which joins the phone's menu),
     each on the state its page opens in: Pollster leans on the two-party
     tab of Labor's main rival (as MenuPageView opens it) and the reader's
     basis (pub). A finding that throws gives way to the page's tip rather
     than taking the menu down */
  AP.menuLines = function menuLines({ onM, pub = false } = {}) {
    const L = D.latest || {};
    const onM0 = onM != null ? onM : AP.measureOfMatchup(L.rivalLead) !== "lnp";
    const out = {};
    const put = (id, f) => {
      try { const v = f(); if (v && v.head) out[id] = v; }
      catch (e) { if (typeof console !== "undefined") console.error("menu line " + id + " failed", e); }
    };
    put("disagreement", () => { const s = AP.disStory(); return { head: s.head, fig: s.fig }; });
    put("leans", () => { const s = AP.leanStory("tpp", onM0, pub); return { head: s.head, fig: s.fig }; });
    put("flows", () => { const s = AP.flowStory(); return s && { head: s.head, fig: s.fig }; });
    put("flows-explained", () => {
      const fig = AP.flowsExplainedFig();
      return { head: AP.PAGE_HEAD["flows-explained"], fig, ...(fig ? {} : { chip: "Explainer" }) };
    });
    /* the House today (/map/, a page outside this build): the largest party's
       seats out of the chamber's, and the seats that have changed hands or
       party since the election by by-election or defection */
    put("map", () => {
      const H = D.house;
      if (!H) return null;
      const [lead, n] = Object.entries(H.seats).sort((a, b) => b[1] - a[1])[0];
      const who = { alp: "Labor", lnp: "The Coalition" }[lead];
      if (!who) return null;
      const W = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
      const k = H.changed, kw = W[k] || String(k);
      return { head: `${who} holds ${n} of the ${H.total} seats`
          + (k ? `; ${kw} ${k === 1 ? "has" : "have"} changed hands or party since the election` : ""),
        fig: { v: String(n), cap: lead === "alp" ? "Labor seats" : "Coalition seats", tone: lead } };
    });
    /* the catalogue's newest wave as a date figure, as the changelog row's */
    put("public-opinion", () => {
      if (!D.beyondLatest) return { head: AP.PAGE_HEAD["public-opinion"], fig: null };
      const [, mo, dd] = D.beyondLatest.split("-").map(Number);
      return { head: AP.PAGE_HEAD["public-opinion"], fig: { v: dd + " " + D.monthName(mo), cap: "Latest entry" } };
    });
    put("changelog", () => {
      const log = D.changelog || [];
      const e = log[log.length - 1];
      if (!e) return null;
      const [, mo, dd] = e.date.split("-").map(Number);
      return { head: AP.changelogGist(e.text), fig: { v: dd + " " + D.monthName(mo), cap: "Latest entry" } };
    });
    put("info", () => ({ head: AP.PAGE_HEAD.info, fig: null }));
    return out;
  };
})();
