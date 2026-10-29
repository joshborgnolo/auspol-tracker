const RD_PL_FACETS = [{
  id: "twopp",
  label: "2PP"
}, {
  id: "primary",
  label: "Primary"
}, {
  id: "leadership",
  label: "Leadership"
}];
const RD_PL_LABEL = {
  alp: "ALP",
  lnp: "L/NP",
  grn: "GRN",
  onp: "ON",
  oth: "OTH"
};
const RD_PL_FALLBACK = ["alp", "lnp", "grn", "onp", "oth"];
const RD_STALE_DAYS = 42;
const RD_CAL_DAYS = 62;
const RD_CAL_TRACK = {
  direction: "Mood of the Nation",
  issues: "Issues Monitor"
};
function rdPollRow(p) {
  const pub = p.published || p.released;
  const d = new Date(pub.slice(0, 10) + "T00:00:00Z");
  const lab = d.getUTCDate() + " " + window.AUSPOL.monthName(d.getUTCMonth() + 1);
  return {
    pollster: p.pollster,
    client: p.client,
    field: p.dateLabel || p.field,
    released: p.released,
    published: p.published,
    publishedLabel: lab,
    pubSort: pub,
    sample: p.sample,
    alpImp: p.alpImp,
    alpOnImp: p.alpOnImp,
    alp2pp: p.alp,
    lnp2pp: p.lnp,
    p: p.p || {},
    tppAlt: p.tppAlt,
    tppAlt2: p.tppAlt2,
    ppmSets: p.ppmSets,
    appr: p.appr || {},
    chg: p.chg,
    url: p.url,
    methodUrl: p.methodUrl,
    links: p.links,
    ...(p.fieldPending ? {
      fieldPending: true,
      fieldUrl: p.fieldUrl
    } : {})
  };
}
function rdPollLinks(links) {
  const out = [];
  for (const l of links || []) {
    out.push(React.createElement("a", {
      key: l.k,
      className: "rd-link rd-link-ext" + (l.pending ? " rd-link-pend" : ""),
      href: l.href,
      target: "_blank",
      rel: "noopener noreferrer",
      title: l.title,
      onClick: ev => ev.stopPropagation()
    }, React.createElement("span", {
      className: "rd-link-t"
    }, l.t), " ", React.createElement("span", {
      className: "rd-apd-ext",
      "aria-hidden": "true"
    }, "\u2197")));
    if (l.wb) out.push(React.createElement("a", {
      key: l.k + "-wb",
      className: "rd-link rd-link-ext rd-link-arch",
      href: l.wb,
      target: "_blank",
      rel: "noopener noreferrer",
      title: l.wbTitle || "An archived copy on the Wayback Machine",
      onClick: ev => ev.stopPropagation()
    }, React.createElement("span", {
      className: "rd-link-t"
    }, "Archived copy"), " ", React.createElement("span", {
      className: "rd-apd-ext",
      "aria-hidden": "true"
    }, "\u2197")));
  }
  return out;
}
function rdPollNameLink(p, mark = "plink-mark") {
  const ok = (p.links || []).filter(x => !x.pending);
  const l = ok.find(x => x.k === "release") || ok.find(x => x.k === "cite");
  return l ? React.createElement("a", {
    href: l.href,
    target: "_blank",
    rel: "noopener noreferrer",
    title: "Opens " + l.t,
    onClick: ev => ev.stopPropagation()
  }, p.pollster, React.createElement("span", {
    className: mark,
    "aria-hidden": "true"
  }, "\u2197")) : p.pollster;
}
function RdPolls({
  tppBasis,
  setTppBasis,
  tppMatchup,
  setTppMatchup
}) {
  const {
    D
  } = window.AP;
  const plParties = (D.latest && D.latest.primaryOrder || RD_PL_FALLBACK).filter(k => k in RD_PL_LABEL).map(k => [k, RD_PL_LABEL[k]]);
  const narrow = useNarrow("(max-width: 900px)");
  const phone = useNarrow(MQ_PHONE);
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({
    key: "latest",
    dir: -1
  });
  const [open, setOpen] = useState(null);
  const [tl, setTl] = useState(null);
  const tlBox = React.useRef(null);
  const tlPtr = React.useRef(null);
  const tlTipRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tlTipRef.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect(),
      vw = document.documentElement.clientWidth,
      M = 8;
    const dx = r.left < M ? M - r.left : r.right > vw - M ? vw - M - r.right : 0;
    el.style.marginLeft = dx + "px";
  }, [tl && tl.id]);
  window.useDismissOutside(tlBox, !!(tl && tl.src === "touch"), () => setTl(null));
  const measure = window.AP.measureOfMatchup(tppMatchup);
  const basis = tppBasis || "imp";
  const proj = window.AP.nextPolls ? window.AP.nextPolls() : {
    rows: [],
    t0: 0,
    nowMs: 0
  };
  const {
    t0,
    nowMs
  } = proj;
  const byP = new Map();
  D.pollsterTable.forEach(r => byP.set(r.pollster, {
    poll: r,
    proj: []
  }));
  proj.rows.forEach((r, i) => {
    if (!byP.has(r.pollster)) {
      const last = D.individualPolls.filter(q => q.pollster === r.pollster).sort((a, b) => a.released < b.released ? 1 : -1)[0];
      if (!last) return;
      byP.set(r.pollster, {
        poll: rdPollRow(last),
        proj: []
      });
    }
    const e = byP.get(r.pollster);
    if (e.order == null) e.order = i;
    e.proj.push(r);
  });
  const entries = [...byP.values()].map(e => {
    const pubMs = Date.parse(e.poll.pubSort.slice(0, 10));
    const stale = t0 - pubMs > RD_STALE_DAYS * DAY_MS;
    return {
      ...e,
      pubMs,
      stale,
      next: e.proj.find(r => r.ahead === 0) || e.proj[0] || null
    };
  });
  const sorted = entries.slice().sort((a, b) => {
    if (sort.key === "next") {
      const va = a.order != null ? a.order : 1e9,
        vb = b.order != null ? b.order : 1e9;
      return sort.dir < 0 ? va - vb : vb - va;
    }
    if (sort.key === "pollster") return sort.dir < 0 ? a.poll.pollster.localeCompare(b.poll.pollster) : b.poll.pollster.localeCompare(a.poll.pollster);
    return sort.dir < 0 ? b.poll.pubSort > a.poll.pubSort ? 1 : -1 : a.poll.pubSort > b.poll.pubSort ? 1 : -1;
  });
  const onSort = key => setSort(s => s.key === key ? {
    key,
    dir: -s.dir
  } : {
    key,
    dir: -1
  });
  const caret = key => sort.key === key ? sort.dir < 0 ? "▾" : "▴" : "▿";
  const newest = entries.slice().sort((a, b) => b.pubMs - a.pubMs)[0];
  const staleOnes = entries.filter(e => e.stale);
  const WDs = ms => WD[new Date(ms).getUTCDay()].slice(0, 3);
  const dm = ms => {
    const d = new Date(ms);
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const wdm = ms => WDs(ms) + " " + dm(ms);
  const isoD = iso => dm(Date.parse(iso.slice(0, 10)));
  const when = n => n === -1 ? "yesterday" : n < 0 ? -n + " days overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
  const inHours = r => {
    if (r.inDays !== 0 || r.releaseMins == null) return null;
    const ms = r.release + r.releaseMins * 60000 - nowMs;
    if (ms <= 0 || Math.round(ms / 3600000) >= 12) return null;
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return "in " + mins + " min" + (mins === 1 ? "" : "s");
    const h = Math.round(mins / 60);
    return "in " + h + " hour" + (h === 1 ? "" : "s");
  };
  const hourWords = r => {
    if (r.releaseFrom == null || r.releaseTo == null) return null;
    if (r.releaseVals && r.releaseVals.length >= 2) return releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
    if (r.releaseTo - r.releaseFrom <= 20) return clockLabel(r.releaseFrom);
    return "about " + clockLabel(Math.round((r.releaseMid != null ? r.releaseMid : (r.releaseFrom + r.releaseTo) / 2) / 60) * 60);
  };
  const altOf = r => {
    if (!r || r.rolled || r.loose) return null;
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow == null || se == null) return null;
    const widen = Math.sqrt(r.ahead + 1);
    const earlyW = Math.floor((se * widen + 3) / 7),
      lateW = Math.floor((sl * widen + 3) / 7);
    if (earlyW === 0 && lateW >= 1) return r.release + lateW * 7 * DAY_MS;
    if (lateW === 0 && earlyW >= 1) return r.release - earlyW * 7 * DAY_MS;
    return null;
  };
  const irregular = r => r && r.cadence > 60;
  const cadWords = e => !e.next ? "" : irregular(e.next) ? "irregular" : e.next.calMonth ? "monthly" : cadenceLabel(e.next.cadence);
  const nextWords = e => {
    const r = e.next;
    if (!r) return {
      date: "—",
      sub: ""
    };
    if (r.loose && !irregular(r)) {
      const a = r.release - r.spread * DAY_MS,
        b = r.release + r.spread * DAY_MS;
      const da = new Date(a),
        db = new Date(b);
      const span = da.getUTCMonth() === db.getUTCMonth() ? da.getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b);
      return {
        date: span,
        sub: r.missed ? when(r.closesIn) : r.opensIn <= 0 ? "window open now" : "window opens " + when(r.opensIn),
        missed: r.missed
      };
    }
    if (irregular(r)) return {
      date: "About " + dm(r.release),
      sub: "give or take " + Math.round(r.spread) + " days",
      far: true
    };
    if (r.missed) return {
      date: wdm(r.release),
      sub: when(r.closesIn),
      missed: true
    };
    if (r.overdue) {
      const edge = r.release + r.winHalf * DAY_MS;
      return {
        date: wdm(edge),
        sub: when(r.closesIn) + (r.inDays === 0 ? ", not out yet" : ", due " + (r.inDays === -1 ? "yesterday" : -r.inDays + " days ago"))
      };
    }
    const alt = altOf(r),
      hr = hourWords(r);
    return {
      date: wdm(r.release),
      sub: (inHours(r) || when(r.inDays)) + (alt ? ", or " + dm(alt) : hr ? ", " + hr : "")
    };
  };
  const onMatch = measure === "onp";
  const rivalName = onMatch ? "One Nation" : "Coalition";
  const figOf = r => {
    let a = null,
      b = null;
    if (onMatch) {
      if (basis === "resp") {
        if (r.tppAlt) {
          a = r.tppAlt.alp;
          b = r.tppAlt.onp;
        }
      } else if (r.alpOnImp != null) {
        a = r.alpOnImp;
        b = +(100 - r.alpOnImp).toFixed(1);
      }
    } else if (basis === "resp") {
      if (r.alp2pp != null) {
        a = r.alp2pp;
        b = r.lnp2pp != null ? r.lnp2pp : +(100 - r.alp2pp).toFixed(1);
      }
    } else if (r.alpImp != null) {
      a = r.alpImp;
      b = +(100 - r.alpImp).toFixed(1);
    }
    if (a == null) return null;
    const key = onMatch ? basis === "resp" ? "altAlpOn" : "impOn" : basis === "resp" ? "alp2pp" : "imp";
    const d = r.chg && r.chg.d ? r.chg.d[key] : null,
      since = r.chg && r.chg.r ? r.chg.r[key] : null;
    return {
      a,
      b,
      m: +(a - b).toFixed(1),
      d,
      since
    };
  };
  const bColor = onMatch ? "var(--onp)" : "var(--lnp)";
  const figCell = e => {
    const r = e.poll;
    if (facet === "primary") {
      const primFig = v => {
        if (v == null) return "—";
        const [i, f] = (+v).toFixed(1).split(".");
        if (f === "0") return i;
        if (f === "5") return React.createElement("span", {
          className: "rd-pl-halfwrap"
        }, i, React.createElement("b", {
          className: "rd-pl-frac rd-pl-half"
        }, "\xBD"));
        return React.createElement(React.Fragment, null, i, React.createElement("b", {
          className: "rd-pl-frac"
        }, "." + f));
      };
      return React.createElement("div", {
        className: "rd-pl-prim"
      }, plParties.map(([id]) => React.createElement("span", {
        key: id,
        style: {
          color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")")
        }
      }, primFig(r.p ? r.p[id] : null))));
    }
    if (facet === "leadership") {
      const ppm = ppmContests(r)[0];
      const a = r.appr || {};
      const opp = a.oppName || "Taylor";
      const net = v => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
      const ppmTxt = ppm && ppm.alb != null ? (() => {
        const os = Object.keys(ppm).filter(k => k !== "alb" && k !== "unc");
        const who = o => {
          const L = (window.LEADER_META || {})[o];
          return apWho(r, o, L ? L.label : rdCap(o));
        };
        return os.length > 1 ? apWho(r, "alb", "Albanese") + " " + ppm.alb + ", " + os.map(o => who(o) + " " + ppm[o]).join(", ") : apWho(r, "alb", "Albanese") + " " + ppm.alb + "–" + ppm[os[0]] + " " + who(os[0]);
      })() : null;
      return React.createElement("div", {
        className: "rd-pl-lead"
      }, React.createElement("span", {
        className: "rd-pl-main"
      }, ppmTxt || React.createElement("span", {
        className: "rd-pl-none"
      }, window.JUR ? "No preferred-" + window.JUR.office.alb + " question" : "No preferred-PM question")), React.createElement("span", {
        className: "rd-pl-sub"
      }, React.createElement("span", {
        className: "rd-pl-netl"
      }, "Net: "), apWho(r, "alb", "Albanese"), " ", net(a.albNet), ", ", opp, " ", net(a.taylorNet), a.hansonNet != null ? ", " + apWho(r, "hanson", "Hanson") + " " + net(a.hansonNet) : ""));
    }
    const f = figOf(r);
    if (!f) return React.createElement("div", {
      className: "rd-pl-fig"
    }, React.createElement("span", {
      className: "rd-pl-none"
    }, "Not asked this wave"));
    const leadA = f.m >= 0;
    return React.createElement("div", {
      className: "rd-pl-fig"
    }, React.createElement("span", {
      className: "rd-pl-main"
    }, React.createElement("span", {
      style: {
        color: "var(--alp-text)"
      }
    }, f.a.toFixed(1)), React.createElement("span", {
      className: "rd-pl-dash"
    }, "\u2013"), React.createElement("span", {
      style: {
        color: inkOf(bColor)
      }
    }, f.b.toFixed(1)), React.createElement("span", {
      className: "rd-pl-tag",
      style: {
        color: inkOf(leadA ? "var(--alp)" : bColor)
      }
    }, leadA ? "ALP" : onMatch ? "ON" : "L/NP", " +", Math.abs(f.m).toFixed(1))), (f.d != null || narrow) && React.createElement("span", {
      className: "rd-pl-sub"
    }, narrow && React.createElement("span", {
      className: "rd-pl-tag",
      style: {
        color: inkOf(leadA ? "var(--alp)" : bColor)
      }
    }, leadA ? "ALP" : onMatch ? "ON" : "L/NP", " +", Math.abs(f.m).toFixed(1)), f.d != null && React.createElement("span", {
      className: "rd-pl-long"
    }, "Labor ", Math.abs(f.d) < 0.05 ? "unchanged" : rdArrow(f.d) + " " + Math.abs(f.d).toFixed(1), " since its ", f.since ? isoD(f.since) + " " : "previous ", "poll"), f.d != null && React.createElement("span", {
      className: "rd-pl-short"
    }, Math.abs(f.d) < 0.05 ? "→ 0.0" : rdArrow(f.d) + " " + Math.abs(f.d).toFixed(1))));
  };
  const figHead = facet === "primary" ? React.createElement("div", {
    className: "rd-pl-prim rd-pl-primh"
  }, plParties.map(([id, lab]) => React.createElement("span", {
    key: id,
    style: {
      color: id === "oth" ? "var(--ink-2)" : inkOf("var(--" + id + ")")
    }
  }, lab))) : facet === "leadership" ? window.JUR ? "Preferred " + window.JUR.office.alb + ", net approval" : "Preferred PM, net approval" : "Labor v " + rivalName;
  const L = t0 - 43 * DAY_MS,
    R = t0 + 23 * DAY_MS;
  const pos = ms => (ms - L) / (R - L) * 100;
  const ticks = [-42, -28, -14, 0, 14].map(k => ({
    x: pos(t0 + k * DAY_MS),
    label: k === 0 ? "Today" : dm(t0 + k * DAY_MS),
    today: k === 0
  }));
  const tlTip = t => {
    const q = D.individualPolls.find(x => x.pollster + "|" + x.released === t.key);
    if (!q) return null;
    const pr = rdPollRow(q);
    return React.createElement("div", {
      ref: tlTipRef,
      className: "tip tip-dot rd-tl-tip",
      style: {
        left: t.left + "%",
        top: "50%"
      },
      "aria-hidden": "true"
    }, React.createElement("div", {
      className: "tip-title"
    }, q.pollster), React.createElement("div", {
      className: "rd-tl-tipdate"
    }, pr.fieldPending ? "TBC" : "Fieldwork " + pr.field, ", published ", pr.publishedLabel), figCell({
      poll: pr
    }), q.sample ? React.createElement("div", {
      className: "tip-sub"
    }, "n = ", q.sample.toLocaleString()) : null, t.src !== "touch" && React.createElement("div", {
      className: "tip-hint"
    }, t.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls"));
  };
  const strip = e => {
    const r = e.next;
    const marks = [];
    const recent = r && r.recent || [];
    recent.forEach(x => {
      const ms = Date.parse((x.pub || x.field).slice(0, 10));
      if (Math.abs(ms - e.pubMs) < DAY_MS / 2) return;
      if (ms < L || ms > R) return;
      const key = window.AP.pollRowKey && window.AP.pollRowKey({
        pollster: e.poll.pollster,
        released: x.field
      });
      if (!key) {
        marks.push(React.createElement("span", {
          key: "e" + ms,
          className: "rd-tl-dot",
          style: {
            left: pos(ms) + "%"
          },
          "aria-hidden": "true"
        }));
        return;
      }
      const id = key,
        row = e.poll.pollster,
        left = pos(ms);
      const show = src => setTl({
        id,
        row,
        key,
        left,
        src
      });
      const hide = src => setTl(t => t && t.id === id && (!src || t.src === src) ? null : t);
      const go = () => {
        setTl(null);
        if (window.AP.openPoll) window.AP.openPoll(key, facet, "latest and next polls");
      };
      marks.push(React.createElement("button", {
        key: "e" + ms,
        type: "button",
        className: "rd-tl-dot rd-tl-dotlink" + (tl && tl.id === id ? " on" : ""),
        style: {
          left: left + "%"
        },
        "aria-label": row + "’s poll of " + dm(ms) + ": open in All polls",
        onPointerDown: ev => {
          tlPtr.current = ev.pointerType;
        },
        onPointerEnter: ev => {
          if (ev.pointerType === "mouse") show("mouse");
        },
        onPointerLeave: ev => {
          if (ev.pointerType === "mouse") hide("mouse");
        },
        onFocus: ev => {
          if (ev.target.matches(":focus-visible")) show("focus");
        },
        onBlur: () => hide("focus"),
        onClick: ev => {
          ev.stopPropagation();
          const ptr = ev.detail === 0 ? "key" : tlPtr.current;
          tlPtr.current = null;
          if (ptr === "mouse" || ptr === "key") {
            go();
            return;
          }
          if (tl && tl.id === id) setTl(null);else show("touch");
        }
      }));
    });
    if (e.pubMs >= L) marks.push(React.createElement("span", {
      key: "latest",
      className: "rd-tl-latest",
      style: {
        left: pos(e.pubMs) + "%"
      }
    }));else marks.push(React.createElement("span", {
      key: "latest",
      className: "rd-tl-off rd-tl-offl",
      "aria-hidden": "true"
    }, React.createElement("span", {
      className: "rd-tl-dot"
    }), dm(e.pubMs)));
    if (r) {
      (r.missedSlots || []).forEach(ms => {
        if (ms < L || ms > R) return;
        marks.push(React.createElement("span", {
          key: "x" + ms,
          className: "rd-tl-x",
          style: {
            left: pos(ms) + "%"
          },
          "aria-hidden": "true"
        }));
      });
      if (r.loose && !irregular(r)) {
        const a = Math.max(L, r.release - r.spread * DAY_MS),
          b = Math.min(R, r.release + r.spread * DAY_MS);
        marks.push(React.createElement("span", {
          key: "win",
          className: "rd-tl-win",
          style: {
            left: pos(a) + "%",
            width: pos(b) - pos(a) + "%"
          }
        }));
      } else if (r.release > R) {
        marks.push(React.createElement("span", {
          key: "next",
          className: "rd-tl-off rd-tl-offr",
          "aria-hidden": "true"
        }, D.monthName(new Date(r.release).getUTCMonth() + 1), React.createElement("span", {
          className: "rd-tl-ring"
        })));
      } else {
        const alt = altOf(r);
        if (alt && alt <= R) marks.push(React.createElement("span", {
          key: "alt",
          className: "rd-tl-alt",
          style: {
            left: pos(Math.min(r.release, alt)) + "%",
            width: Math.abs(pos(alt) - pos(r.release)) + "%"
          }
        }));
        if (alt && alt <= R) marks.push(React.createElement("span", {
          key: "altr",
          className: "rd-tl-later",
          style: {
            left: pos(alt) + "%"
          }
        }));
        marks.push(React.createElement("span", {
          key: "next",
          className: "rd-tl-next" + (r.missed ? " missed" : ""),
          style: {
            left: pos(r.release) + "%"
          }
        }));
      }
      e.proj.filter(x => x.ahead >= 1 && x.release <= R).forEach(x => marks.push(React.createElement("span", {
        key: "l" + x.release,
        className: "rd-tl-later",
        style: {
          left: pos(x.release) + "%"
        }
      })));
    }
    return (React.createElement("div", {
        className: "rd-tl",
        ref: tl && tl.row === e.poll.pollster ? tlBox : undefined
      }, React.createElement("span", {
        className: "rd-tl-base"
      }), ticks.map(t => React.createElement("span", {
        key: t.label,
        className: "rd-tl-grid" + (t.today ? " today" : ""),
        style: {
          left: t.x + "%"
        }
      })), marks, tl && tl.row === e.poll.pollster && tlTip(tl))
    );
  };
  const detail = e => {
    const r = e.poll,
      pj = e.next;
    const ip = D.individualPolls.find(q => q.pollster === r.pollster && q.released === r.released) || r;
    const key = window.AP.pollRowKey && window.AP.pollRowKey({
      pollster: r.pollster,
      released: r.released
    });
    const recent = (pj && pj.recent || []).slice(-5).reverse();
    const nx = nextWords(e);
    const then = e.proj.filter(x => x.ahead === 1)[0];
    const yr = Number(String(r.released || ip.released || "").slice(0, 4));
    const report = "/feedback/?msg=" + encodeURIComponent(`${r.pollster}, ${r.fieldPending ? "TBC" : r.field} ${yr} – `);
    const rhythm = pj && React.createElement("div", {
      className: "rd-pld-rhythm"
    }, React.createElement("div", {
      className: "rd-pld-h"
    }, r.pollster, "\u2019s rhythm, last ", rdNumWord(recent.length), " releases"), React.createElement("table", {
      className: "rd-pld-tab"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Field to"), React.createElement("th", null, "Published"), React.createElement("th", null, "Gap"))), React.createElement("tbody", null, recent.map(x => React.createElement("tr", {
      key: x.field
    }, React.createElement("td", null, isoD(x.field)), React.createElement("td", null, x.pub ? x.url ? React.createElement("a", {
      href: x.url,
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: ev => ev.stopPropagation()
    }, WDs(Date.parse(x.pub)) + " " + isoD(x.pub)) : WDs(Date.parse(x.pub)) + " " + isoD(x.pub) : "—"), React.createElement("td", null, x.gap != null ? x.gap + " days" : ""))))), React.createElement("p", {
      className: "rd-pld-foot"
    }, pj.calMonth ? React.createElement(React.Fragment, null, "One release a month, on no set day: between the ", pj.calDays ? pj.calDays[0] + "th and the " + pj.calDays[1] + "th" : "start and the end", " so far. ", React.createElement("b", null, "Next: ", nx.date, ".")) : irregular(pj) ? React.createElement(React.Fragment, null, "Median ", Math.round(pj.cadence), " days between releases across the last ", pj.gapsUsed, " gaps, give or take ", Math.round(pj.spread), ". ", React.createElement("b", null, "Next: ", nx.date.replace(/^About/, "about"), ".")) : React.createElement(React.Fragment, null, pj.rhythmFrom ? React.createElement(React.Fragment, null, "Every ", Math.round(pj.cadence), " days since ", isoD(pj.rhythmSince), ", when it moved from every ", Math.round(pj.rhythmFrom), ".") : React.createElement(React.Fragment, null, "Median ", pj.cadence, " days between ", pj.basis === "published" ? "publications" : "fieldwork ends", " across the last ", pj.gapsUsed, " gaps", pj.slotsSkipped ? React.createElement(React.Fragment, null, ", with ", pj.slotsSkipped === 1 ? "one release" : pj.slotsSkipped + " releases", " it skipped counted as skipped rather than as longer gaps") : "", "."), " ", React.createElement("b", null, "Next: ", nx.date, hourWords(pj) ? ", " + hourWords(pj).replace(/^about /, "about ") + " " + easternAbbr(pj.release) : ""), ", at the earliest", then ? "; then " + wdm(then.release) : "", ".")), e.next && e.next.site && React.createElement("a", {
      className: "rd-link rd-link-ext rd-pld-site",
      href: e.next.site,
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: ev => ev.stopPropagation()
    }, React.createElement("span", {
      className: "rd-link-t"
    }, "Where the next one lands first"), " ", React.createElement("span", {
      className: "rd-apd-ext",
      "aria-hidden": "true"
    }, "\u2197")));
    return React.createElement("div", {
      className: "rd-pl-detail"
    }, React.createElement(RdLedger, {
      p: ip,
      facet: facet,
      onM: onMatch,
      latest: true,
      moe: rdLgMoe(ip),
      side: r.noAgg ? React.createElement(React.Fragment, null, React.createElement("p", {
        className: "rd-ldg-noagg"
      }, React.createElement("b", null, "Outside the aggregates."), " ", r.noAggWhy), rhythm) : rhythm,
      onLine: id => {
        if (id === "twopp" || id === "primary" || id === "leadership") pickFacet(id);else if (id === "switching") {
          if (window.AP.gotoSwitching) window.AP.gotoSwitching();
        } else if (id === "opinion") {
          const bo = window.AUSPOL.publicOpinionByRow && window.AUSPOL.publicOpinionByRow[ip.pollster + "|" + ip.released];
          if (bo && window.AP.gotoOpinion) window.AP.gotoOpinion(bo.h, bo.w && bo.w[0]);
        } else if (key && window.AP.openPoll) window.AP.openPoll(key, id, "latest and next polls");
      },
      sources: r.links && r.links.length ? rdPollLinks(r.links) : null,
      foot: React.createElement(React.Fragment, null, key && window.AP.openPoll && React.createElement("button", {
        type: "button",
        className: "rd-link",
        onClick: ev => {
          ev.stopPropagation();
          window.AP.openPoll(key, facet, "latest and next polls");
        }
      }, "Open in All polls \u2192"), React.createElement("a", {
        className: "rd-link",
        href: report,
        onClick: ev => ev.stopPropagation()
      }, "Report an error"))
    }));
  };
  const pinPl = () => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return;
    rdPinScroll([sec.querySelector(".rd-pl"), sec.querySelector(".rd-pl-tabs")], true);
  };
  const pickFacet = id => {
    pinPl();
    setFacet(id);
  };
  const flipPick = () => {
    pinPl();
    if (setTppMatchup) setTppMatchup(onMatch ? "alp_lnp" : "alp_on");
  };
  const basisPick = () => {
    pinPl();
    setTppBasis(basis === "imp" ? "resp" : "imp");
  };
  const basisWord = onMatch ? basis === "resp" ? "as published" : "implied flows" : basis === "resp" ? "as published" : "implied flows";
  const controls = facet === "twopp" && React.createElement("span", {
    className: "rd-pl-ctl"
  }, !narrow && React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Two-party:"), React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    onClick: flipPick,
    title: "Show Labor v " + (onMatch ? "the Coalition" : "One Nation") + " instead"
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, "Labor v ", rivalName), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4")), React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, ", ", narrow ? basis === "resp" ? "published" : "implied" : basisWord), React.createElement(RdQPop, {
    label: "How the two-party figures are counted",
    align: "left"
  }, React.createElement("h4", null, "How the two-party figures are counted"), React.createElement("p", null, basis === "resp" ? "Each pollster’s own published figures, from where its respondents say their preferences would go." : "Each poll’s primary votes, run through one fixed set of preference flows, so every pollster is read the same way."), React.createElement("div", {
    className: "rd-qrow"
  }, React.createElement("span", null, "Show the pollsters\u2019 published figures"), React.createElement(RdSwitch, {
    on: basis === "resp",
    onToggle: basisPick,
    label: "Show the pollsters\u2019 published figures"
  })), React.createElement("p", {
    className: "rd-qnote"
  }, "The switch changes the whole page, the headline figures included.")));
  const hoverKeys = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return undefined;
    const enter = () => {
      hoverKeys.current = true;
    };
    const leave = () => {
      hoverKeys.current = false;
    };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = e => {
      if (!hoverKeys.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      const n = RD_PL_FACETS.length;
      const i = RD_PL_FACETS.findIndex(x => x.id === facet);
      if (i < 0) return;
      pickFacet(RD_PL_FACETS[(i + (e.key === "ArrowRight" ? 1 : -1) + n) % n].id);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [facet]);
  const spaceFlip = React.useRef(null);
  spaceFlip.current = facet === "twopp" && setTppMatchup ? flipPick : null;
  const pubFlip = React.useRef(null);
  pubFlip.current = facet === "twopp" && setTppBasis ? basisPick : null;
  React.useEffect(() => {
    const sec = document.getElementById("latest-polls");
    if (!sec) return undefined;
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(sec);
    const key = e => {
      if (!inView.current) return;
      const isPub = e.key === "p" || e.key === "P";
      if (!isPub && e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !isPub && e.shiftKey) return;
      const a = document.activeElement;
      const onTab = !isPub && a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true" && !!(a.closest && a.closest('.rd-pl-tabs [role="group"]'));
      if (!onTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const act = isPub ? pubFlip.current : spaceFlip.current;
      if (!act) return;
      e.preventDefault();
      if (!e.repeat) act();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const plRef = React.useRef(null);
  const rowNav = (e, i) => {
    if (e.target !== e.currentTarget) return;
    const r = sorted[i].poll,
      isOpen = open === r.pollster;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(isOpen ? null : r.pollster);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const f = (RD_PL_FACETS.findIndex(x => x.id === facet) + (e.key === "ArrowRight" ? 1 : -1) + RD_PL_FACETS.length) % RD_PL_FACETS.length;
      pickFacet(RD_PL_FACETS[f].id);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const j = i + (e.key === "ArrowDown" ? 1 : -1);
    const nx = sorted[j];
    if (!nx) return;
    if (isOpen) setOpen(nx.poll.pollster);
    const rows = plRef.current ? plRef.current.querySelectorAll(".rd-pl-item > .rd-pl-row") : [];
    if (rows[j]) rows[j].focus();
  };
  const calProj = window.AP.nextPolls ? window.AP.nextPolls(null, {
    horizonDays: RD_CAL_DAYS,
    includeTracked: true
  }) : {
    rows: []
  };
  const calRows = calProj.rows.filter(r => r.tracked !== "confidence");
  const calOver = [],
    calItems = [];
  const calDays = new Map();
  calRows.forEach(r => {
    if (r.overdue) {
      calOver.push(r);
      return;
    }
    const me = {
      name: r.pollster,
      site: r.site,
      tracked: r.tracked
    };
    if (r.loose && !irregular(r)) {
      calItems.push({
        key: "w" + r.pollster,
        at: r.release - r.spread * DAY_MS,
        close: r.release + r.spread * DAY_MS,
        win: true,
        spread: r.spread,
        who: [me]
      });
    } else if (irregular(r)) {
      calItems.push({
        key: "i" + r.pollster + "-" + (r.ahead || 0),
        at: r.release,
        irr: true,
        spread: r.spread,
        who: [me]
      });
    } else {
      const iso = new Date(r.release).toISOString().slice(0, 10);
      let e = calDays.get(iso);
      if (!e) {
        e = {
          key: "d" + iso,
          at: r.release,
          who: []
        };
        calDays.set(iso, e);
        calItems.push(e);
      }
      e.who.push({
        ...me,
        hr: hourWords(r)
      });
    }
  });
  calOver.sort((a, b) => a.release - b.release);
  calItems.sort((a, b) => a.at - b.at);
  calItems.forEach(it => {
    if (it.win) it.q = it.at <= t0 ? "open now" : "window";else if (it.irr) it.q = "give or take " + Math.round(it.spread) + " days";else if (it.at === t0) it.q = "today";else if (it.at === t0 + DAY_MS) it.q = "tomorrow";
  });
  const calMonths = [];
  calItems.forEach(it => {
    const ym = new Date(it.at).toISOString().slice(0, 7);
    const g = calMonths[calMonths.length - 1];
    if (!g || g.ym !== ym) calMonths.push({
      ym,
      items: [it]
    });else g.items.push(it);
  });
  const calSpanTxt = (a, b) => {
    const A = new Date(a),
      B = new Date(b);
    return A.getUTCMonth() === B.getUTCMonth() ? A.getUTCDate() + "–" + dm(b) : dm(a) + "–" + dm(b);
  };
  const calDateTxt = it => it.win ? calSpanTxt(it.at, it.close) : it.irr ? "About " + dm(it.at) : WDs(it.at) + " " + new Date(it.at).getUTCDate();
  const calOverTxt = r => r.loose && !irregular(r) ? calSpanTxt(r.release - r.spread * DAY_MS, r.release + r.spread * DAY_MS) : irregular(r) ? "About " + dm(r.release) : wdm(r.release);
  const calWho = (w, i) => React.createElement("span", {
    key: String(i),
    className: "rd-cal-wi"
  }, i > 0 ? React.createElement("span", {
    className: "rd-cal-wsep",
    "aria-hidden": "true"
  }, ", ") : null, w.site ? React.createElement("a", {
    href: w.site,
    target: "_blank",
    rel: "noopener noreferrer",
    title: "Where " + w.name + "’s next release lands first"
  }, w.name, React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")) : w.name, w.hr ? React.createElement("span", {
    className: "rd-cal-t"
  }, ", ", w.hr) : null, w.tracked && RD_CAL_TRACK[w.tracked] ? React.createElement("span", {
    className: "rd-cal-track"
  }, RD_CAL_TRACK[w.tracked]) : null);
  return React.createElement(RdSec, {
    id: "latest-polls",
    cls: "rd-polls",
    facet: facet,
    title: "Latest and next polls",
    meta: new Set(entries.map(e => e.poll.pollster.replace(/\s*\(.*\)$/, ""))).size + " pollsters, latest release " + (narrow ? dm(newest.pubMs) : wdm(newest.pubMs))
  }, React.createElement("p", {
    className: "rd-dek rd-pl-dek"
  }, phone ? "The newest poll from each pollster, and the earliest its next could land. Tap a pollster for the full poll." : "The newest poll from each pollster, and the earliest its next could land, projected from its recent rhythm." + (narrow ? " Tap a pollster for the full poll." : " Open a row for the full poll and the releases behind the projection.")), React.createElement(RdTabs, {
    swipe: true,
    value: facet,
    onChange: pickFacet,
    options: narrow ? RD_PL_FACETS.map(f => f.id === "leadership" ? {
      ...f,
      label: "Leaders"
    } : f) : RD_PL_FACETS,
    ariaLabel: "Poll table view",
    className: "rd-pl-tabs"
  }, !narrow && controls), narrow && controls && React.createElement("div", {
    className: "rd-pl-ctlrow"
  }, controls), React.createElement("div", {
    className: "rd-pl",
    role: "table",
    "aria-label": "Latest poll and next expected release, by pollster",
    ref: plRef
  }, React.createElement("div", {
    className: "rd-pl-head",
    role: "row"
  }, React.createElement("span", {
    role: "columnheader",
    className: "rd-pl-c-name"
  }, React.createElement("button", {
    type: "button",
    className: "rd-pl-sort",
    onClick: () => onSort("pollster")
  }, "Pollster")), React.createElement("span", {
    role: "columnheader",
    className: "rd-pl-c-latest"
  }, React.createElement("button", {
    type: "button",
    className: "rd-pl-sort" + (sort.key === "latest" ? " on" : ""),
    onClick: () => onSort("latest")
  }, "Latest ", React.createElement("span", {
    "aria-hidden": "true"
  }, caret("latest")))), React.createElement("span", {
    role: "columnheader",
    className: "rd-pl-c-figs"
  }, React.createElement(RdSwap, {
    k: facet
  }, figHead)), React.createElement("span", {
    role: "columnheader",
    className: "rd-pl-c-tl"
  }, React.createElement("span", {
    className: "rd-pl-tlcap"
  }, "Releases, next"), React.createElement("span", {
    className: "rd-pl-ticks"
  }, ticks.map(t => React.createElement("span", {
    key: t.label,
    className: t.today ? "today" : "",
    style: {
      left: t.x + "%"
    }
  }, t.label)))), React.createElement("span", {
    role: "columnheader",
    className: "rd-pl-c-next"
  }, React.createElement("button", {
    type: "button",
    className: "rd-pl-sort" + (sort.key === "next" ? " on" : ""),
    onClick: () => onSort("next")
  }, "Next, at the earliest ", React.createElement("span", {
    "aria-hidden": "true"
  }, caret("next")))), React.createElement("span", {
    className: "rd-pl-c-exp",
    "aria-hidden": "true"
  })), sorted.map((e, i) => {
    const r = e.poll,
      isOpen = open === r.pollster,
      nx = nextWords(e);
    const cad = cadWords(e);
    return React.createElement("div", {
      key: r.pollster,
      className: "rd-pl-item" + (isOpen ? " open" : "") + (e.stale ? " stale" : "")
    }, React.createElement("div", {
      className: "rd-pl-row",
      role: "row",
      onClick: () => setOpen(isOpen ? null : r.pollster),
      tabIndex: 0,
      "aria-expanded": isOpen,
      onKeyDown: ev => rowNav(ev, i)
    }, React.createElement("span", {
      role: "cell",
      className: "rd-pl-c-name"
    }, React.createElement("span", {
      className: "rd-pl-main"
    }, rdPollNameLink(r)), React.createElement("span", {
      className: "rd-pl-sub"
    }, r.client, cad ? ", " + cad : "", e.stale ? React.createElement("span", {
      className: "rd-pl-long"
    }, ", no poll in six weeks") : null)), React.createElement("span", {
      role: "cell",
      className: "rd-pl-c-latest"
    }, React.createElement("span", {
      className: "rd-pl-main"
    }, r.publishedLabel || r.releasedLabel), React.createElement("span", {
      className: "rd-pl-sub"
    }, r.fieldPending ? React.createElement(React.Fragment, null, "fieldwork ", rdFieldTbc(r)) : r.field, r.sample ? ", " + r.sample.toLocaleString() : "")), React.createElement("span", {
      role: "cell",
      className: "rd-pl-c-figs"
    }, React.createElement(RdSwap, {
      k: facet
    }, figCell(e))), React.createElement("span", {
      role: "cell",
      className: "rd-pl-c-tl"
    }, strip(e)), React.createElement("span", {
      role: "cell",
      className: "rd-pl-c-next" + (nx.missed ? " missed" : "")
    }, React.createElement("span", {
      className: "rd-pl-main"
    }, React.createElement("span", {
      className: "rd-pl-short"
    }, "Next "), e.next && e.next.site ? React.createElement("a", {
      href: e.next.site,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Where " + r.pollster + "’s next poll lands first",
      onClick: ev => ev.stopPropagation()
    }, nx.date, React.createElement("span", {
      className: "plink-mark",
      "aria-hidden": "true"
    }, "\u2197")) : nx.date), React.createElement("span", {
      className: "rd-pl-sub"
    }, nx.sub)), React.createElement("span", {
      className: "rd-pl-c-exp"
    }, React.createElement("button", {
      type: "button",
      className: "rd-pl-exp" + (isOpen ? " open" : ""),
      "aria-expanded": isOpen,
      "aria-label": (isOpen ? "Close " : "Open ") + r.pollster + "’s poll and release rhythm",
      onClick: ev => {
        ev.stopPropagation();
        setOpen(isOpen ? null : r.pollster);
      }
    }, React.createElement("svg", {
      viewBox: "0 0 10 10",
      width: "9",
      height: "9",
      "aria-hidden": "true"
    }, React.createElement("path", {
      d: "M3 1.5L7.5 5 3 8.5z"
    })))), React.createElement("span", {
      className: "rd-pl-foot1",
      "aria-hidden": "true"
    }, React.createElement("span", null, React.createElement("b", null, r.publishedLabel || r.releasedLabel), ", ", r.fieldPending ? React.createElement(React.Fragment, null, "fieldwork ", rdFieldTbc(r, -1)) : r.field), React.createElement("span", {
      className: nx.missed ? "missed" : ""
    }, "Next ", React.createElement("b", null, nx.date), nx.sub ? ", " + nx.sub.replace(/, .*$/, "") : ""))), isOpen && detail(e));
  })), React.createElement(RdKey, {
    className: "rd-pl-key",
    items: [{
      kind: "dot-solid",
      color: "var(--ink)",
      label: "Latest release"
    }, {
      kind: "dot",
      color: "var(--ink-3)",
      label: "Earlier releases"
    }, {
      kind: "ring",
      label: "Next, at the earliest"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-tl-keyalt",
    "aria-hidden": "true"
  }), "Or a week later"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-tl-keywin",
    "aria-hidden": "true"
  }), "Window, for irregular pollsters"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-tl-keyx",
    "aria-hidden": "true"
  }), "A slot no release kept")), React.createElement("p", {
    className: "rd-note"
  }, "Projections read each pollster\u2019s last eight gaps between releases: they mark the earliest a poll could land, not the likeliest.", " ", "A pollster that misses its slot shows as overdue for two days, then the forecast moves on to the next plausible date \u2014 the \xD7 marks where it stood.", staleOnes.length > 0 && React.createElement(React.Fragment, null, " ", staleOnes.map(e => e.poll.pollster).join(" and "), " ", staleOnes.length > 1 ? "have" : "has", " not published in six weeks, so ", staleOnes.length > 1 ? "their polls are" : "its poll is", " outside the averages.")), (calMonths.length > 0 || calOver.length > 0) && React.createElement("details", {
    className: "rd-evdrop rd-cal"
  }, React.createElement("summary", null, "Release calendar"), React.createElement("div", {
    className: "rd-cal-body"
  }, calOver.length > 0 && React.createElement("div", {
    className: "rd-cal-sec rd-cal-sec-over"
  }, React.createElement("h4", {
    className: "rd-cal-m"
  }, "Due, not yet recorded"), React.createElement("ul", {
    className: "rd-cal-list"
  }, calOver.map(r => React.createElement("li", {
    key: r.pollster
  }, React.createElement("span", {
    className: "rd-cal-d"
  }, calOverTxt(r)), React.createElement("span", {
    className: "rd-cal-w"
  }, calWho({
    name: r.pollster,
    site: r.site,
    tracked: r.tracked
  }, 0)), r.missed && React.createElement("span", {
    className: "rd-cal-q"
  }, when(r.closesIn)))))), calMonths.map(g => React.createElement("div", {
    className: "rd-cal-sec",
    key: g.ym
  }, React.createElement("h4", {
    className: "rd-cal-m"
  }, rdMonthYear(g.ym)), React.createElement("ul", {
    className: "rd-cal-list"
  }, g.items.map(it => React.createElement("li", {
    key: it.key
  }, React.createElement("span", {
    className: "rd-cal-d"
  }, calDateTxt(it)), React.createElement("span", {
    className: "rd-cal-w"
  }, it.who.map((w, i) => calWho(w, i))), it.q && React.createElement("span", {
    className: "rd-cal-q"
  }, it.q))))))), React.createElement("p", {
    className: "rd-note"
  }, "The table\u2019s own projections two months out: a date is the earliest that house\u2019s wave could land; a span is a window the wave can fall anywhere in, from a house that keeps no set day. Both come from each house\u2019s recent rhythm, never from a promise \u2014 a house that misses its slot stays listed until its wave is added. The Mood of the Nation and Issues Monitor rows (SEC Newgate, Ipsos) publish no vote polls; they are the releases the Direction and issues panels read.")));
}
Object.assign(window, {
  RdPolls
});