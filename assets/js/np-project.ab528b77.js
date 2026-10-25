const DAY_MS = 86400000;
const NP_HORIZON_DAYS = 28;
const NP_ASSUME_SKIP_DAYS = 2;
const NP_UNTIMED_MINS = 24 * 60;
const NP_COUNT_SPAN = 2 * 60;
let npEastFmt = null;
function easternNow() {
  const d = new Date();
  try {
    const p = {};
    npEastFmt = npEastFmt || new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    for (const x of npEastFmt.formatToParts(d)) p[x.type] = x.value;
    return {
      day: Date.UTC(+p.year, +p.month - 1, +p.day),
      mins: +p.hour % 24 * 60 + +p.minute
    };
  } catch (e) {
    return {
      day: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
      mins: d.getHours() * 60 + d.getMinutes()
    };
  }
}
const NP_SUMMER_DEAD = ["12-23", "01-08"];
const NP_SUMMER_BACK = ["01-09", "02-01"];
function npInSummer(ms) {
  const md = new Date(ms).toISOString().slice(5, 10);
  return md >= NP_SUMMER_DEAD[0] || md <= NP_SUMMER_DEAD[1];
}
function npMonthEndSlot(fromMs, dow) {
  const d = new Date(fromMs);
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  const endPrev = Date.UTC(y, m, 0),
    endThis = Date.UTC(y, m + 1, 0);
  const base = new Date(fromMs - endPrev < endThis - fromMs ? endPrev : endThis);
  const target = Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 2, 0);
  let k = dow - new Date(target).getUTCDay();
  if (k > 3) k -= 7;
  if (k < -3) k += 7;
  return target + k * DAY_MS;
}
function spreadDays(c, sp) {
  return c.releaseDow != null && !c.loose ? 7 * Math.floor((sp + 3) / 7) : sp;
}
let npProjMemo = null;
function npProject(nowOverride, opts) {
  const horizonDays = opts && opts.horizonDays != null ? opts.horizonDays : NP_HORIZON_DAYS;
  const tracked = !!(opts && opts.includeTracked);
  if (!nowOverride) {
    const e = easternNow(),
      k = e.day + e.mins * 60000;
    if (npProjMemo && npProjMemo.k === k && npProjMemo.h === horizonDays && npProjMemo.t === tracked) return npProjMemo.v;
    const v = npProjectAt(e, horizonDays, tracked);
    npProjMemo = {
      k,
      h: horizonDays,
      t: tracked,
      v
    };
    return v;
  }
  return npProjectAt(nowOverride, horizonDays, tracked);
}
function npProjectAt(nowOverride, horizonDays, includeTracked) {
  const {
    D
  } = window.AP;
  const cad = (D.pollCadence || []).filter(c => includeTracked || !c.tracked);
  if (!cad.length) return {
    rows: [],
    t0: 0,
    nowMs: 0
  };
  const eNow = nowOverride || easternNow();
  const t0 = eNow.day;
  const nowMs = t0 + eNow.mins * 60000;
  const dayFloor = ms => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const rows = [];
  const horizon = t0 + (horizonDays || NP_HORIZON_DAYS) * DAY_MS;
  cad.forEach(c => {
    if (c.calMonth) {
      const ld = new Date(Date.parse(c.last));
      let sm = (ld.getUTCMonth() + 1) % 12;
      let sy = ld.getUTCFullYear() + (ld.getUTCMonth() === 11 ? 1 : 0);
      while ((c.skippedMonths || []).includes(`${sy}-${String(sm + 1).padStart(2, "0")}`)) {
        sm += 1;
        if (sm > 11) {
          sm = 0;
          sy += 1;
        }
      }
      const lastDay = Date.UTC(sy, sm + 1, 0);
      const open = Date.UTC(sy, sm, c.calDays ? c.calDays[0] : 1);
      const close = c.calDays ? Math.min(Date.UTC(sy, sm, c.calDays[1]), lastDay) : lastDay;
      const calSpread = (close - open) / 2 / DAY_MS;
      const release = (open + close) / 2;
      const missed = close < t0;
      rows.push({
        ...c,
        field: open,
        release,
        missed,
        ahead: 0,
        overdue: missed,
        spread: calSpread,
        winHalf: calSpread,
        inDays: Math.round((release - t0) / DAY_MS),
        opensIn: Math.round((open - t0) / DAY_MS),
        closesIn: Math.round((close - t0) / DAY_MS)
      });
      return;
    }
    const snap = ms => {
      if (c.releaseDow == null) return ms;
      let d = c.releaseDow - new Date(ms).getUTCDay();
      if (d > 3) d -= 7;
      if (d < -3) d += 7;
      return ms + d * DAY_MS;
    };
    const due = rel => rel + (c.releaseMins == null ? NP_UNTIMED_MINS : c.releaseMins) * 60000;
    const relOf = f => dayFloor(snap(f + c.lag * DAY_MS));
    const monthEnd = !!c.monthEnd && c.releaseDow != null;
    const stepFrom = rel => npMonthEndSlot(rel, c.releaseDow);
    let field = monthEnd ? stepFrom(Date.parse(c.last)) : Date.parse(c.last) + c.cadence * DAY_MS;
    let release = monthEnd ? field : relOf(field);
    let rolled = false;
    const missedSlots = [];
    {
      const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
      let meSlot = release;
      const rollOn = () => {
        rolled = true;
        if (monthEnd) {
          if (release === meSlot) release = meSlot + 7 * DAY_MS;else release = meSlot = stepFrom(meSlot);
          field = release;
          return;
        }
        field += (c.releaseDow != null ? 7 : c.cadence) * DAY_MS;
        release = relOf(field);
      };
      while ((c.skipped || []).includes(isoDay(release))) rollOn();
      if (!c.loose) while (!npInSummer(release) && release + NP_ASSUME_SKIP_DAYS * DAY_MS < t0) {
        missedSlots.push(release);
        rollOn();
      }
    }
    const reaches = (rel, sp) => (c.loose ? rel - sp * DAY_MS : rel) <= horizon;
    for (let i = 0; (i === 0 || reaches(release, Math.max(1, Math.round(c.spread * Math.sqrt(i + 1))))) && i < 12; i++) {
      if (npInSummer(release)) {
        if (i === 0) {
          const d = new Date(release);
          const y = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
          const at = md => Date.UTC(y, +md.slice(0, 2) - 1, +md.slice(3, 5));
          const open = at(NP_SUMMER_BACK[0]),
            close = at(NP_SUMMER_BACK[1]);
          const half = (close - open) / 2 / DAY_MS;
          const missed = close < t0;
          rows.push({
            ...c,
            field,
            release: (open + close) / 2,
            ahead: 0,
            loose: true,
            summer: true,
            overdue: missed,
            missed,
            spread: half,
            winHalf: half,
            slotEarly: null,
            slotLate: null,
            rolled: false,
            missedSlots: missedSlots.length ? missedSlots.slice() : null,
            inDays: Math.round(((open + close) / 2 - t0) / DAY_MS),
            opensIn: Math.round((open - t0) / DAY_MS),
            closesIn: Math.round((close - t0) / DAY_MS)
          });
        }
        break;
      }
      const overdue = due(release) <= nowMs;
      const sp = Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)));
      const winHalf = spreadDays(c, sp);
      const slotShift = c.releaseDow != null && !c.loose && c.spreadEarly != null ? (release - (field + c.lag * DAY_MS)) / DAY_MS : null;
      rows.push({
        ...c,
        field,
        release,
        overdue,
        ahead: i,
        spread: sp,
        winHalf,
        slotEarly: slotShift == null ? null : Math.max(0, c.spreadEarly + slotShift),
        slotLate: slotShift == null ? null : Math.max(0, c.spreadLate - slotShift),
        rolled: rolled && i === 0,
        missedSlots: missedSlots.length ? missedSlots.slice() : null,
        inDays: Math.round((release - t0) / DAY_MS),
        opensIn: Math.round((release - winHalf * DAY_MS - t0) / DAY_MS),
        closesIn: Math.round((release + winHalf * DAY_MS - t0) / DAY_MS),
        missed: overdue && release + winHalf * DAY_MS < t0
      });
      if (overdue || c.loose) break;
      if (monthEnd) {
        field = release = stepFrom(release);
        continue;
      }
      field += c.cadence * DAY_MS;
      release = dayFloor(snap(field + c.lag * DAY_MS));
    }
  });
  const first = r => r.missed ? Infinity : r.loose ? r.release - r.spread * DAY_MS : r.overdue ? r.release + (r.winHalf != null ? r.winHalf : r.spread) * DAY_MS : r.release;
  rows.sort((a, b) => first(a) - first(b));
  return {
    rows,
    t0,
    nowMs
  };
}
window.AP.nextPolls = npProject;
const TN_DAY = 86400000;
const tnUntil = ms => {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return mins + (mins === 1 ? " min" : " mins");
  const h = Math.round(mins / 60);
  if (h < 36) return h + (h === 1 ? " hour" : " hours");
  const d = Math.round(h / 24);
  if (d < 14) return d + (d === 1 ? " day" : " days");
  const w = Math.round(d / 7);
  return w + (w === 1 ? " week" : " weeks");
};
function npTickerItems(proj) {
  const rows = proj ? proj.rows : [];
  const nowMs = proj ? proj.nowMs : 0;
  const t0 = proj ? proj.t0 : 0;
  const dayFloor = ms => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const targetOf = r => {
    const half = r.winHalf || 0;
    if (r.releaseDow == null) return {
      at: Math.max(r.release - half * TN_DAY, nowMs),
      byDay: false
    };
    const widen = Math.sqrt((r.ahead || 0) + 1);
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const earlyHalf = se != null ? 7 * Math.floor((se * widen + 3) / 7) : half;
    let t = Math.max(t0, dayFloor(r.release - earlyHalf * TN_DAY));
    t += (r.releaseDow - new Date(t).getUTCDay() + 7) % 7 * TN_DAY;
    return {
      at: t,
      byDay: true
    };
  };
  const isWindowRow = r => r.loose && r.releaseDow == null;
  const windowOpen = r => r.release - (r.winHalf || 0) * TN_DAY <= nowMs;
  const windowItems = rows.filter(r => isWindowRow(r) && !r.missed && windowOpen(r)).map(r => ({
    firm: r.pollster,
    when: "any day now",
    maybe: false,
    site: r.site
  }));
  const overdueItems = rows.filter(r => r.missed && !isWindowRow(r)).map(r => {
    const days = Math.round((t0 - (r.loose ? r.release + (r.winHalf || 0) * TN_DAY : r.release)) / TN_DAY);
    return {
      firm: r.pollster,
      site: r.site,
      overdue: true,
      days,
      when: days === 1 ? "1 day overdue" : days + " days overdue"
    };
  }).sort((a, b) => b.days - a.days);
  const dueOf = it => it.t.at + (it.t.byDay ? (it.r.releaseMins == null ? 24 * 60 : it.r.releaseMins) * 60000 : 0);
  const upcomingItems = rows.filter(r => !r.missed && !isWindowRow(r)).map(r => ({
    r,
    t: targetOf(r)
  })).sort((a, b) => dueOf(a) - dueOf(b)).filter((seen => ({
    r
  }) => !seen.has(r.pollster) && !!seen.add(r.pollster))(new Set())).map(({
    r,
    t
  }) => {
    const half = r.winHalf || 0;
    let when;
    if (t.byDay) {
      const days = Math.round((t.at - t0) / TN_DAY);
      const dueMs = t.at + (r.releaseMins == null ? 24 * 60 : r.releaseMins) * 60000;
      const left = dueMs - nowMs;
      const hourless = r.releaseFrom != null && r.releaseTo - r.releaseFrom > NP_COUNT_SPAN;
      const bandShut = r.releaseTo != null && nowMs > t.at + r.releaseTo * 60000;
      if (days === 0 && bandShut) return null;
      when = days === 0 ? dueMs <= nowMs ? "any moment now" : hourless ? t.at + r.releaseFrom * 60000 - nowMs <= (r.releaseTo - r.releaseFrom) * 60000 ? "any moment now" : "today" : r.releaseMins != null && Math.round(left / 3600000) < 12 ? tnUntil(left) : "today" : days === 1 ? "tomorrow" : days + " days";
    } else {
      when = t.at <= nowMs ? "any day now" : Math.round((t.at - nowMs) / 3600000) < 36 ? tnUntil(t.at - nowMs) : Math.round((t.at - t0) / TN_DAY) + " days";
    }
    const lateW = r.releaseDow != null && !r.rolled ? Math.floor(((r.slotLate != null ? r.slotLate : r.spreadLate || 0) * Math.sqrt((r.ahead || 0) + 1) + 3) / 7) : 0;
    const laterSlot = t.byDay && lateW >= 1 && t.at < r.release + lateW * 7 * TN_DAY;
    const maybe = when !== "any moment now" && when !== "any day now" && (half > 7 || !!r.loose || laterSlot || r.releaseDow != null && t.at - r.release > 7 * TN_DAY || r.releaseDow == null && half > 0);
    return {
      firm: r.pollster,
      when,
      maybe,
      site: r.site
    };
  }).filter(Boolean);
  const items = [...overdueItems, ...upcomingItems, ...windowItems];
  return items;
}
window.AP.nextPollItems = npTickerItems;
window.AP.npMonthEndSlot = npMonthEndSlot;