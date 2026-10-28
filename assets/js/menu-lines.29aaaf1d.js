const FF_COHORTS = {
  coal: {
    name: "Coalition",
    prose: "Coalition",
    cls: "lnp",
    share: "lnp"
  },
  grn: {
    name: "Greens",
    prose: "Greens",
    cls: "grn",
    share: "grn"
  },
  onp: {
    name: "One Nation",
    prose: "One Nation",
    cls: "onp",
    share: "onp"
  },
  oth: {
    name: "Other",
    prose: "other",
    cls: "oth",
    share: "oth"
  },
  alp: {
    name: "Labor",
    prose: "Labor",
    cls: "alp",
    share: "alp"
  }
};
const flFig = (v, dp) => dp != null ? v.toFixed(dp) : Math.round(v * 10) % 10 === 0 ? String(Math.round(v)) : v.toFixed(1);
(function () {
  const AP = window.AP;
  const D = window.AUSPOL;
  const DIS_PARTY = {
    p_onp: ["One Nation", "onp"],
    p_lnp: ["Coalition", "lnp"],
    p_alp: ["Labor", "alp"],
    p_grn: ["Greens", "grn"]
  };
  AP.disStory = function disStory() {
    const lastOf = id => {
      const s = AP.discord(id).filter(d => d.sigma != null);
      return s.length ? s[s.length - 1] : null;
    };
    const on = lastOf("p_onp"),
      co = lastOf("p_lnp"),
      right = lastOf("rd_right"),
      alp = lastOf("p_alp"),
      grn = lastOf("p_grn");
    const beyond = d => d && d.R >= 1.2;
    const figOf = ids => {
      const top = ids.map(id => [id, lastOf(id)]).filter(([, d]) => d && d.R != null).sort((a, b) => b[1].R - a[1].R)[0];
      return top ? {
        v: top[1].R.toFixed(1) + "×",
        cap: DIS_PARTY[top[0]][0] + " v chance",
        tone: DIS_PARTY[top[0]][1]
      } : null;
    };
    let head, dek, fig;
    if (on && co && right && (beyond(on) || beyond(co)) && !beyond(right)) {
      const r = (on.R + co.R) / 2;
      const how = r < 1.3 ? "a little further than" : r < 1.75 ? "about half as much again as" : r < 2.25 ? "about twice as far as" : "more than twice as far as";
      head = "Pollsters agree on the size of the right’s vote but disagree on its split";
      dek = `Polls of One Nation’s vote typically sit ${on.sigma.toFixed(1)} points from the trend through them, and polls of the Coalition’s ${co.sigma.toFixed(1)}: ${how} sampling error alone would put them. ` + `Add the two parties together, though, and their combined vote varies only as much as chance allows${alp && !beyond(alp) ? ", as Labor’s does" : ""}.`;
      fig = figOf(["p_onp", "p_lnp"].filter(id => beyond(id === "p_onp" ? on : co)));
    } else {
      const all = [["One Nation’s", on, "p_onp"], ["the Coalition’s", co, "p_lnp"], ["Labor’s", alp, "p_alp"], ["the Greens’", grn, "p_grn"]].filter(([, d]) => d);
      const wide = all.filter(([, d]) => beyond(d));
      if (!wide.length) {
        head = "The polls agree about as closely as sampling error allows";
        dek = "Polls of every party’s vote sit about as far from the trend through them as their samples alone would put them" + (all.some(([, d]) => d.R < 0.8) ? ", and some sit closer than chance allows, which can mean pollsters steering towards each other." : ".");
        fig = figOf(all.map(([,, id]) => id));
      } else {
        head = "The polls disagree on " + rdList(wide.map(([n]) => n)) + " vote";
        dek = wide.map(([n, d]) => `Polls of ${n} vote typically sit ${d.sigma.toFixed(1)} points from the trend through them, against ${d.floor.toFixed(1)} from sampling error alone.`).join(" ");
        fig = figOf(wide.map(([,, id]) => id));
      }
    }
    return {
      head,
      dek,
      fig
    };
  };
  let leanCache = null;
  AP.leanSeries = function leanSeries() {
    const HL0 = D.houseLean || {};
    if (leanCache && leanCache.src === HL0) return leanCache.HL;
    const HL = {
      ...HL0,
      split: Object.fromEntries(Object.keys(HL0.onp || {}).filter(h => (HL0.lnp || {})[h]).map(h => {
        const co = Object.fromEntries(HL0.lnp[h].map(d => [d.ym, d.v]));
        return [h, HL0.onp[h].filter(d => co[d.ym] != null).map(d => ({
          ym: d.ym,
          v: Math.round((d.v - co[d.ym]) * 10) / 10,
          on: d.v,
          co: co[d.ym]
        }))];
      }))
    };
    leanCache = {
      src: HL0,
      HL
    };
    return HL;
  };
  AP.leanKey = (view, onM, pub) => view === "tpp" ? pub ? onM ? "onpub" : "tpp" : onM ? "onimp" : "imp" : view;
  AP.leanRows = key => {
    const HL = AP.leanSeries();
    return Object.keys(HL[key] || {}).map(h => {
      const s = HL[key][h] || [];
      return {
        h,
        s,
        v: s.length ? s[s.length - 1].v : 0
      };
    }).filter(r => r.s.length);
  };
  AP.leanStory = function leanStory(view, onM, pub) {
    const rowsOf = AP.leanRows;
    const key = AP.leanKey(view, onM, pub);
    const hlWords = id => {
      if (id === "tpp") {
        const rival = onM ? "One Nation" : "the Coalition";
        return {
          hi: pl => `lean${pl ? "" : "s"} furthest to Labor`,
          lo: pl => `lean${pl ? "" : "s"} furthest to ${rival}`
        };
      }
      if (id === "split") return {
        hi: pl => `read${pl ? "" : "s"} One Nation widest against the Coalition`,
        lo: pl => `read${pl ? "" : "s"} One Nation narrowest against the Coalition`
      };
      const whose = {
        alp: "Labor’s",
        lnp: "the Coalition’s",
        onp: "One Nation’s",
        grn: "the Greens’",
        oth: "the others’"
      }[id];
      return {
        hi: pl => `read${pl ? "" : "s"} ${whose} vote highest`,
        lo: pl => `read${pl ? "" : "s"} ${whose} vote lowest`
      };
    };
    const hlJoin = ns => ns.length > 2 ? ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1] : ns.join(" and ");
    let head = null,
      dek = null,
      fig = null;
    const hsr = rowsOf(key).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).filter(r => Math.abs(r.v) >= 0.05);
    if (hsr.length) {
      const words = hlWords(view === "tpp" ? "tpp" : view);
      const tail = " The averages take each lean out before the polls are combined.";
      const fmtPt = v => `${v.toFixed(1)} point${v.toFixed(1) === "1.0" ? "" : "s"}`;
      const sgn = hsr[0].v > 0;
      const tied = hsr.filter(r => r.v > 0 === sgn && Math.abs(r.v) >= Math.abs(hsr[0].v) - 0.1);
      const next = hsr.filter(r => !tied.includes(r));
      const pl = tied.length > 1,
        topV = Math.min(...tied.map(r => Math.abs(r.v)));
      head = `${hlJoin(tied.map(r => r.h))} ${(sgn ? words.hi : words.lo)(pl)}, and ${topV <= 1 ? "only " : ""}by ${fmtPt(topV)}`;
      if (!next.length) {
        dek = "No other pollster leans measurably either way." + tail;
      } else {
        const nextMax = Math.abs(next[0].v);
        const nextTied = next.filter(r => Math.abs(r.v) >= nextMax - 0.1);
        dek = `${hlJoin(nextTied.map(r => r.h))} ${nextTied.length > 1 ? "are" : "is"} next, ${fmtPt(nextMax)} off` + (next.length > nextTied.length ? "; no other pollster is further out" : "") + `.${topV >= 1 && nextMax <= topV / 2 ? ` ${pl ? "They are" : "It is"} well clear of the pack.` : ""}${tail}`;
      }
      const tone = view === "tpp" ? sgn ? "alp" : onM ? "onp" : "lnp" : view === "split" ? sgn ? "onp" : "lnp" : view;
      fig = {
        v: rdSigned(sgn ? topV : -topV, 1),
        cap: pl ? tied.length + " pollsters" : tied[0].h,
        tone
      };
    } else if (rowsOf(key).length) {
      head = "No pollster leans away from the pack here";
      dek = "Every pollster sits level with the pollsters polling beside it. The averages take out any lean that builds up.";
    }
    return {
      head,
      dek,
      fig
    };
  };
  AP.flowStory = function flowStory() {
    const FD = D.flowDrift,
      FO = D.flowDriftOn;
    const FF = D.flowForced,
      FT = D.flowTables;
    if (!FD || !FO || !FD.now || !FO.now) return null;
    const nC = FD.now,
      nO = FO.now;
    const mi = ym => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
    const E = FF && FF.elec2025r;
    const allMrp = ws => (ws || []).map(w => w.all ? {
      ...w,
      ...w.all
    } : w);
    const ff = FF ? [["on", FF.vsOn, ["grn", "coal", "oth"]], ["co", FF.vsCoal, ["grn", "onp", "oth"]], ["ln", allMrp(FF.lnpOn), ["alp", "grn", "oth"]]].flatMap(([cq, waves, cks]) => cks.map(ck => {
      const s = waves.filter(w => w[ck] != null);
      return {
        key: cq + ck,
        ck,
        q: cq,
        waves: s,
        fit: withinHouseSlope(s.map(w => ({
          h: cq + ck,
          t: (w.xm ?? mi(w.ym)) / 12,
          w: 1,
          y: w[ck]
        })))
      };
    })) : [];
    {
      const tested = ff.filter(r => r.fit),
        sigK = [];
      for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
        if (r.fit.p >= 0.05 / (tested.length - i)) break;
        sigK.push(r.key);
      }
      for (const r of ff) r.sig = sigK.includes(r.key);
    }
    const movedOf = (cq, ck) => {
      const r = ff.find(x => x.key === cq + ck);
      if (!r || !r.sig) return null;
      const f = r.waves[0][ck],
        la = r.waves[r.waves.length - 1][ck];
      return f === la ? null : {
        from: f,
        to: la,
        ym: r.waves[0].ym,
        up: la > f
      };
    };
    const s1 = v => Math.abs(v).toFixed(1);
    const phr = (v, who) => Math.abs(v) < 0.05 ? "level against " + who : s1(v) + " points kinder to " + (v > 0 ? "Labor against " + who : who);
    const ci = Math.max(nC.ci95, nO.ci95);
    const worst = Math.max(Math.abs(nC.v), Math.abs(nO.v));
    const outC = Math.abs(nC.v) > nC.ci95,
      outO = Math.abs(nO.v) > nO.ci95;
    const moves = ff.filter(r => movedOf(r.q, r.ck)).map(r => ({
      ...r,
      m: movedOf(r.q, r.ck)
    }));
    const anchorOf = cq => cq === "ln" ? "the Coalition" : "Labor";
    const rivalOf = cq => cq === "co" ? "the Coalition" : "One Nation";
    const voiceMove = moves.length === 1 ? moves[0] : null;
    const head = outC || outO ? outC && outO ? "Preferences have moved since the election, in both contests" : "Preferences " + (outO ? "against One Nation" : "against the Coalition") + " have moved " + ((outO ? nO.v : nC.v) > 0 ? "towards Labor" : "away from Labor") + " since the election" : voiceMove ? FF_COHORTS[voiceMove.ck].name + " voters say they’d now send " + anchorOf(voiceMove.q) + " " + (voiceMove.m.up ? "more" : "fewer") + " preferences" : moves.length > 1 ? "Voters say their preferences have shifted since " + rdMonthYear(moves[0].m.ym).split(" ")[0] : "Preferences are still flowing much as they did at the election";
    const dekA = "This site’s two-party figures assume fixed preference flows: the " + rdElecYear + " count against the Coalition, and a table built from " + rdElecYear + "’s ballots against One Nation.";
    const dekB = voiceMove ? (() => {
      const r = voiceMove,
        m = r.m;
      const refTxt = r.q === "co" && E ? ", against the " + flFig(E.all[r.ck], 1) + "% the " + rdElecYear + " count sent " + anchorOf(r.q) + "’s way" : r.q === "on" && FT ? ", against the " + flFig(FT.onp[r.ck === "coal" ? "lnp" : r.ck] * 100) + "% the site assumes" : "";
      return " Asked to choose, " + m.to + "% of " + FF_COHORTS[r.ck].prose + " voters now pick " + anchorOf(r.q) + " over " + rivalOf(r.q) + " in " + (r.q === "ln" ? "DemosAU’s MRP" : "RedBridge/Accent’s poll") + ", " + (m.up ? "up" : "down") + " from " + m.from + "% in " + rdMonthYear(m.ym).split(" ")[0] + refTxt + ".";
    })() : moves.length > 1 ? " Asked to choose, " + moves.map(r => FF_COHORTS[r.ck].prose + " voters " + (r.m.up ? "up" : "down") + " from " + r.m.from + "% to " + r.m.to + "%").join("; ") + "." : " Voters’ own answers to pollsters haven’t clearly moved since February either.";
    const dekC = " The pollsters’ own two-party figures " + (outC || outO ? "have moved: they sit " : voiceMove || moves.length ? "don’t show it yet: they sit " : "sit where their primary votes and the flows put them: ") + phr(nC.v, "the Coalition") + ", and " + phr(nO.v, "One Nation") + ", " + (worst < ci / 2 ? "well inside" : worst <= ci ? "inside" : "outside") + " the margin of ±" + ci.toFixed(1) + ".";
    const dek = FF ? dekA + (voiceMove || moves.length ? dekB : "") + dekC : "The pollsters’ own two-party figures sit where their primary votes and the " + rdElecYear + " flows put them: " + phr(nC.v, "the Coalition") + ", and " + phr(nO.v, "One Nation") + ", " + (worst < ci / 2 ? "well inside" : worst <= ci ? "inside" : "outside") + " the margin of ±" + ci.toFixed(1) + ". A shift in where voters send their preferences would show here first.";
    let fig = null;
    if (outC || outO) {
      const onWay = outO && (!outC || Math.abs(nO.v) >= Math.abs(nC.v));
      const v = onWay ? nO.v : nC.v;
      fig = {
        v: rdSigned(v, 1),
        cap: "Pts v " + (onWay ? "One Nation" : "Coalition"),
        tone: v > 0 ? "alp" : onWay ? "onp" : "lnp"
      };
    } else if (voiceMove) {
      fig = {
        v: voiceMove.m.to + "%",
        cap: (voiceMove.ck === "oth" ? "Others" : FF_COHORTS[voiceMove.ck].name) + " to " + anchorOf(voiceMove.q).replace(/^the /, ""),
        tone: FF_COHORTS[voiceMove.ck].cls
      };
    }
    return {
      head,
      dek,
      fig,
      ff,
      movedOf
    };
  };
  AP.PAGE_HEAD = {
    "flows-explained": "There are two ways to get a two-party figure from a poll",
    "public-opinion": "Australians’ views on topical subjects",
    info: "Answers to questions you may have"
  };
  AP.changelogGist = text => {
    const m = String(text || "").match(/^.*?\.(?=\s|$)/);
    return (m ? m[0] : String(text || "")).replace(/ \(fieldwork [^)]*\)/g, "").replace(/ \((?:Labor v [^,)]+, )?(?:implied flows|published figures)\)/g, "").replace(/\.$/, "");
  };
  AP.flowsExplainedFig = function flowsExplainedFig() {
    const T = D.flowTables;
    if (!T || !T.lnp || !T.onp) return null;
    const row = (tab, keys, cap) => {
      const cells = keys.map(([k, tone]) => typeof tab[k] === "number" ? {
        v: String(Math.round(tab[k] * 100)),
        tone
      } : null);
      return cells.every(Boolean) ? {
        cap,
        cells
      } : null;
    };
    const co = row(T.lnp, [["grn", "grn"], ["onp", "onp"], ["oth", "oth"]], "To Labor v Coalition");
    const on = row(T.onp, [["grn", "grn"], ["lnp", "lnp"], ["oth", "oth"]], "To Labor v One Nation");
    if (!co || !on) return null;
    return {
      rows: ((D.latest || {}).rivalLead || "alp_lnp") === "alp_on" ? [on, co] : [co, on]
    };
  };
  AP.menuLines = function menuLines({
    onM,
    pub = false
  } = {}) {
    const L = D.latest || {};
    const onM0 = onM != null ? onM : AP.measureOfMatchup(L.rivalLead) !== "lnp";
    const out = {};
    const put = (id, f) => {
      try {
        const v = f();
        if (v && v.head) out[id] = v;
      } catch (e) {
        if (typeof console !== "undefined") console.error("menu line " + id + " failed", e);
      }
    };
    put("disagreement", () => {
      const s = AP.disStory();
      return {
        head: s.head,
        fig: s.fig
      };
    });
    put("leans", () => {
      const s = AP.leanStory("tpp", onM0, pub);
      return {
        head: s.head,
        fig: s.fig
      };
    });
    put("flows", () => {
      const s = AP.flowStory();
      return s && {
        head: s.head,
        fig: s.fig
      };
    });
    put("flows-explained", () => {
      const fig = AP.flowsExplainedFig();
      return {
        head: AP.PAGE_HEAD["flows-explained"],
        fig,
        ...(fig ? {} : {
          chip: "Explainer"
        })
      };
    });
    put("map", () => {
      const H = D.house;
      if (!H) return null;
      const [lead, n] = Object.entries(H.seats).sort((a, b) => b[1] - a[1])[0];
      const who = {
        alp: "Labor",
        lnp: "The Coalition"
      }[lead];
      if (!who) return null;
      const W = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
      const k = H.changed,
        kw = W[k] || String(k);
      return {
        head: `${who} holds ${n} of the ${H.total} seats` + (k ? `; ${kw} ${k === 1 ? "has" : "have"} changed hands or party since the election` : ""),
        fig: {
          v: `${Math.round(100 * n / H.total)}%`,
          cap: lead === "alp" ? "Labor seats" : "Coalition seats",
          tone: lead
        }
      };
    });
    put("public-opinion", () => {
      if (!D.publicOpinionLatest) return {
        head: AP.PAGE_HEAD["public-opinion"],
        fig: null
      };
      const [, mo, dd] = D.publicOpinionLatest.split("-").map(Number);
      return {
        head: AP.PAGE_HEAD["public-opinion"],
        fig: {
          v: dd + " " + D.monthName(mo),
          cap: "Latest entry"
        }
      };
    });
    put("changelog", () => {
      const log = D.changelog || [];
      const e = log[log.length - 1];
      if (!e) return null;
      const [, mo, dd] = e.date.split("-").map(Number);
      return {
        head: AP.changelogGist(e.text),
        fig: {
          v: dd + " " + D.monthName(mo),
          cap: "Latest entry"
        }
      };
    });
    put("info", () => ({
      head: AP.PAGE_HEAD.info,
      fig: null
    }));
    return out;
  };
})();