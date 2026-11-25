/* auspol tracker /dawn/next/ – the next expected polls, in words.

   A classic script, no imports: the page inlines it after np-project.js (the site's one projection,
   window.AP.nextPolls), and test-dawn evals these same two files against mocked Sydney clocks, the
   way .build/newtracker/sim-next-polls.mjs evals np-project.js. Every slot's date and countdown is
   the site's own wording – rd-polls.jsx's nextWords, a11e1559's clockLabel, releaseLabel and
   cadenceLabel – carried over unchanged, so this page and the site's Latest-and-next table cannot
   drift into two house styles for one claim.

   THE HEAD names what lands next on the schedule. Polls only: a direction or issues survey (a
   tracked row) is no next poll, and nor is a house's MRP or pooled re-cut. In this order:
     today   a slot due today whose hour hasn't passed: "Newspoll is due tonight" – tonight from 5 pm,
             this afternoon from noon, this morning before, by the hours the house has recorded;
             plain "today" for an untimed house, or hours that straddle two of those
     notout  due today, its hour passed, not yet on record: "Newspoll was due today and isn't out yet"
     late    a dated slot passed inside its two days' grace, or a window shut within the week:
             "Roy Morgan is a day late"
     next    the soonest slot still ahead, when it is a date: "due tomorrow", "due on Sunday" (inside
             six days), "due on 12 January"
     window  when the soonest is a window: "DemosAU is expected 12–27 December", or once it has
             opened "DemosAU's window is open"
     summer  when the soonest is the summer resumption: "Polls return after the summer break"
     none    nothing on the schedule: "No polls are scheduled"
   Houses sharing the slot are named together ("A and B", "A, B and C"); four or more are counted.

   THE DEK: a sentence of the head's detail (the hour; the week-late date the house's record offers;
   how long a window stays open), the next four weeks' count, and the projection's own record from
   np-score's report, a fact of the build. */
(function () {
  "use strict";
  const AP = (window.AP = window.AP || {});
  const DAY = 86400000;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WDF = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WD3 = WDF.map((w) => w.slice(0, 3));
  const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const num = (n) => NUM[n] || String(n);
  const at = (ms) => new Date(ms);
  const dm = (ms) => at(ms).getUTCDate() + " " + MON[at(ms).getUTCMonth()];
  const dmf = (ms) => at(ms).getUTCDate() + " " + MONF[at(ms).getUTCMonth()];
  const wdm = (ms) => WD3[at(ms).getUTCDay()] + " " + dm(ms);
  const span = (a, b) => (at(a).getUTCMonth() === at(b).getUTCMonth() ? at(a).getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b));
  const spanF = (a, b) => (at(a).getUTCMonth() === at(b).getUTCMonth() ? at(a).getUTCDate() + "–" + dmf(b) : dmf(a) + " – " + dmf(b));

  /* ---- the site's clock and rhythm words (a11e1559), unchanged ---------------------------- */
  function clockParts(mins) {
    const h = Math.floor(mins / 60), mi = mins % 60;
    const ap = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { num: mi ? `${h12}:${String(mi).padStart(2, "0")}` : `${h12}`, ap };
  }
  function clockLabel(mins) { const c = clockParts(mins); return `${c.num} ${c.ap}`; }
  const RELEASE_TIGHT_MINS = 120;
  function releaseLabel(from, to, mid, vals) {
    if (from == null || to == null) return null;
    if (from === to) return clockLabel(from);
    if (vals && vals.length >= 2) {
      const ps = vals.map(clockParts);
      return ps.every((p) => p.ap === ps[0].ap)
        ? `${ps.slice(0, -1).map((p) => p.num).join(", ")} or ${ps[ps.length - 1].num} ${ps[0].ap}`
        : vals.slice(0, -1).map(clockLabel).join(", ") + ` or ${clockLabel(vals[vals.length - 1])}`;
    }
    if (to - from > RELEASE_TIGHT_MINS) return clockLabel(Math.round(mid != null ? mid : (from + to) / 2));
    const a = clockParts(from), b = clockParts(to);
    return a.ap === b.ap ? `${a.num}–${b.num} ${b.ap}` : `${clockLabel(from)}–${clockLabel(to)}`;
  }
  function cadenceLabel(d) {
    if (d >= 6.5 && d <= 7.5) return "weekly";
    if (d >= 13 && d <= 15) return "fortnightly";
    if (d >= 20 && d <= 22) return "every 3 weeks";
    if (d >= 27 && d <= 32) return "monthly";
    if (d >= 40 && d <= 48) return "every 6 weeks";
    return `every ${Math.round(d)} days`;
  }

  /* ---- a slot in words: rd-polls.jsx's, unchanged ------------------------------------------ */
  const when = (n) => (n === -1 ? "yesterday" : n < 0 ? -n + " days overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days");
  function inHours(r, nowMs) {
    if (r.inDays !== 0 || r.releaseMins == null) return null;
    const ms = r.release + r.releaseMins * 60000 - nowMs;
    if (ms <= 0 || Math.round(ms / 3600000) >= 12) return null;
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return "in " + mins + " min" + (mins === 1 ? "" : "s");
    const h = Math.round(mins / 60);
    return "in " + h + " hour" + (h === 1 ? "" : "s");
  }
  function hourWords(r) {
    if (r.releaseFrom == null || r.releaseTo == null) return null;
    if (r.releaseVals && r.releaseVals.length >= 2) return releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
    if (r.releaseTo - r.releaseFrom <= 20) return clockLabel(r.releaseFrom);
    return "about " + clockLabel(Math.round((r.releaseMid != null ? r.releaseMid : (r.releaseFrom + r.releaseTo) / 2) / 60) * 60);
  }
  /* the one real alternative a dated house's record offers: a week late (or early) */
  function altOf(r) {
    if (!r || r.rolled || r.loose) return null;
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow == null || se == null) return null;
    const widen = Math.sqrt(r.ahead + 1);
    const earlyW = Math.floor((se * widen + 3) / 7), lateW = Math.floor((sl * widen + 3) / 7);
    if (earlyW === 0 && lateW >= 1) return r.release + lateW * 7 * DAY;
    if (lateW === 0 && earlyW >= 1) return r.release - earlyW * 7 * DAY;
    return null;
  }
  const irregular = (r) => !!r && r.cadence > 60;
  const rhythm = (r) => (!r ? "" : irregular(r) ? "irregular" : r.calMonth ? "monthly" : cadenceLabel(r.cadence));
  /* a sub-series' rhythm: quarterly where it is, else the interval in months; with too few releases
     to measure, how many there have been */
  function subRhythm(r, releases) {
    const c = r && r.cadence;
    if (!c) return num(releases) + (releases === 1 ? " release" : " releases");
    if (c >= 80 && c <= 100) return "quarterly";
    if (c < 45) return cadenceLabel(c);
    const m = Math.round((c / 30.44) * 2) / 2;
    return "every " + Math.floor(m) + (m % 1 ? "½" : "") + " months";
  }
  /* the Next column: a date and, under it, how far off and the hour or the week-late alternative */
  function nextWords(r, nowMs, sub) {
    if (!r) return { date: "—", sub: sub ? "too few releases to project" : "" };
    if (r.loose && !irregular(r)) {
      const a = r.release - r.spread * DAY, b = r.release + r.spread * DAY;
      return { date: span(a, b), sub: r.missed ? when(r.closesIn) : r.opensIn <= 0 ? "window open now" : "window opens " + when(r.opensIn), missed: r.missed, win: true };
    }
    if (irregular(r)) return r.missed
      ? { date: "About " + dm(r.release), sub: when(r.closesIn), missed: true }
      : { date: "About " + dm(r.release), sub: "give or take " + Math.round(r.spread) + " days", far: true };
    if (r.missed) return { date: wdm(r.release), sub: when(r.closesIn), missed: true };
    if (r.overdue) {
      const edge = r.release + r.winHalf * DAY;
      return { date: wdm(edge), sub: when(r.closesIn) + (r.inDays === 0 ? ", not out yet" : ", due " + (r.inDays === -1 ? "yesterday" : -r.inDays + " days ago")) };
    }
    const alt = altOf(r), hr = hourWords(r);
    return { date: wdm(r.release), sub: (inHours(r, nowMs) || when(r.inDays)) + (alt ? ", or " + dm(alt) : hr ? ", " + hr : "") };
  }

  /* ---- the head and dek -------------------------------------------------------------------- */
  const names = (rs) => {
    const xs = rs.map((r) => r.pollster);
    return xs.length === 1 ? xs[0] : xs.length === 2 ? xs[0] + " and " + xs[1] : xs.length === 3 ? xs[0] + ", " + xs[1] + " and " + xs[2] : num(xs.length) + " polls";
  };
  const isAre = (rs, one, many) => (rs.length === 1 ? one : many);
  const atH = (h) => (/^\d/.test(h) ? "at " + h : h);   // "at 6 pm", "about 8 pm"
  const Cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const partOf = (m) => (m < 12 * 60 ? "this morning" : m < 17 * 60 ? "this afternoon" : "tonight");
  /* the one part of the day every named house's recorded hours fall in, else none */
  function dayPart(rs) {
    const parts = new Set();
    for (const r of rs) {
      if (r.releaseFrom == null || r.releaseTo == null) return null;
      parts.add(partOf(r.releaseFrom)); parts.add(partOf(r.releaseTo));
    }
    return parts.size === 1 ? [...parts][0] : null;
  }
  function copy(proj, score) {
    const { rows, t0 } = proj;
    const polls = rows.filter((r) => !r.tracked);
    const R = polls.filter((r) => r.ahead === 0);
    const dated = (r) => !r.loose;
    const today = R.filter((r) => dated(r) && r.inDays === 0 && !r.overdue);
    const notOut = R.filter((r) => dated(r) && r.inDays === 0 && r.overdue);
    const lateBy = (r) => (dated(r) ? -r.inDays : -r.closesIn);
    const late = R.filter((r) => (dated(r) ? r.inDays < 0 && r.overdue : r.missed && r.closesIn >= -7));
    const ahead = R.filter((r) => !r.overdue && !r.missed);
    let kind, head, lead = [];
    if (today.length) {
      kind = "today"; lead = today;
      head = names(today) + isAre(today, " is", " are") + " due " + (dayPart(today) || "today");
    } else if (notOut.length) {
      kind = "notout"; lead = notOut;
      head = names(notOut) + isAre(notOut, " was due today and isn’t out yet", " were due today and aren’t out yet");
    } else if (late.length) {
      kind = "late"; lead = late;
      const ds = [...new Set(late.map(lateBy))];
      head = names(late) + isAre(late, " is ", " are ") + (ds.length === 1 ? (ds[0] === 1 ? "a day" : num(ds[0]) + " days") + " late" : "late");
    } else if (ahead.length) {
      const f = ahead[0];
      if (dated(f)) {
        kind = "next"; lead = ahead.filter((r) => dated(r) && r.release === f.release);
        const n = f.inDays;
        head = names(lead) + isAre(lead, " is", " are") + " due " + (n === 1 ? "tomorrow" : n <= 6 ? "on " + WDF[at(f.release).getUTCDay()] : "on " + dmf(f.release));
      } else if (f.summer) {
        kind = "summer"; lead = [f]; head = "Polls return after the summer break";
      } else {
        kind = "window"; lead = [f];
        head = f.opensIn <= 0 ? f.pollster + "’s window is open" : f.pollster + " is expected " + spanF(f.release - f.spread * DAY, f.release + f.spread * DAY);
      }
    } else { kind = "none"; head = "No polls are scheduled"; }
    head = head.charAt(0).toUpperCase() + head.slice(1);   // "Four polls are due today"

    const s = [];
    const one = lead.length === 1 ? lead[0] : null;
    if (kind === "today" || kind === "next") {
      const alt = one && kind === "next" ? altOf(one) : null;
      const hrs = lead.map((r) => [r, hourWords(r)]);
      if (alt) s.push("Its record has it slipping a week at times, to " + dmf(alt) + ".");
      else if (one && hrs[0][1]) s.push("It usually lands " + atH(hrs[0][1]) + ", Sydney time.");
      else if (lead.length > 1 && hrs.every(([, h]) => h)) s.push(hrs.map(([r, h], i) => r.pollster + (i ? " " : " usually lands ") + atH(h)).join(", ") + ", Sydney time.");
    } else if (kind === "notout" && one) {
      const hr = hourWords(one), edge = one.release + one.winHalf * DAY;
      s.push((hr ? "It usually lands " + atH(hr) + "." : "") + (one.winHalf > 0 ? (hr ? " " : "") + "Its window stays open until " + wdm(edge) + "." : ""));
    } else if (kind === "late" && one) {
      s.push(dated(one) ? "It was due on " + WDF[at(one.release).getUTCDay()] + (lateBy(one) >= 2 ? "; from tomorrow, its next date takes over." : "; after two days without it, its next date takes over.")
        : "Its window shut on " + dmf(one.release + one.spread * DAY) + ".");
    } else if (kind === "window" && one) {
      s.push(one.opensIn > 0 ? "Its window opens " + when(one.opensIn) + "." : "It could land any day until " + dmf(one.release + one.spread * DAY) + ".");
    } else if (kind === "summer") {
      s.push("Nobody publishes between 23 December and 8 January; last summer the pollsters came back between 9 January and 1 February.");
    }
    const four = polls.filter((r) => !r.missed && (r.loose ? r.opensIn <= 28 : r.inDays >= 0 && r.inDays <= 28));
    const houses = new Set(four.map((r) => r.pollster)).size;
    s.push(!four.length ? "No poll is expected in the next four weeks."
      : four.length > 10 ? "Over the next four weeks, " + four.length + " polls are expected, from " + houses + " pollsters."
      : Cap(four.length === 1 ? "one poll is" : num(four.length) + " polls are") + " expected over the next four weeks" + (houses > 1 ? ", from " + num(houses) + " pollsters." : "."));
    const o = score && score.overall;
    if (o && o.n >= 5) s.push("Each date comes from the pollster’s own rhythm; since " + (score.sinceLabel || "September") + ", " + o.h + " of " + o.n + " have landed inside their window.");
    return { kind, head, dek: s.filter(Boolean).join(" "), lead: lead.map((r) => r.pollster), t0 };
  }

  AP.nextWords = { DAY, MON, MONF, WDF, WD3, num, dm, dmf, wdm, span, spanF, clockLabel, releaseLabel, cadenceLabel,
    when, inHours, hourWords, altOf, irregular, rhythm, subRhythm, nextWords, copy };
})();
