/* ====================================================================
   NEXT EXPECTED POLLS – the projection

   Sits under Latest polls and answers the obvious next question: when does
   the next one land? Each house's own recent rhythm drives it – see
   pollCadence in gen-data for how cadence and publication lag are measured.

   Lives in the PLAIN layer (ahead of every component that consumes it, and
   after ed2260de sets window.AP) so there is EXACTLY ONE implementation:
   the page runs it from here, and .build/newtracker/sim-next-polls.mjs
   evals this same file against mocked Sydney clocks instead of mirroring
   it. Top-level consts of a classic script land in the shared global
   lexical scope, so the panel bundle's DAY_MS references (and 73de0c58's
   easternNow call) keep resolving from here. Never re-declare these names
   in a later script – a duplicate top-level const is a parse error for the
   whole script.

   Dates are computed here rather than at build time so the panel stays
   right as the page ages: a slot whose moment has passed without that
   release being added is left exactly where it is and marked overdue,
   rather than rolled forward onto a date nobody has published – the row
   isn't removed until the data for it is.
   ==================================================================== */
const DAY_MS = 86400000;
const NP_HORIZON_DAYS = 28;   // how far out a house's 2nd, 3rd… slots reach
/* A house nobody has timed keeps its whole day: with no hour recorded there is
   no moment to say has passed, so the row stays "today" until today is over
   rather than being rolled off the list by an hour we invented for it. */
const NP_UNTIMED_MINS = 24 * 60;
/* "Now", in the frame this schedule is written in.

   Every date on this page is an Australian calendar date and every release
   hour is an eastern one, so "today" has to be Sydney's today - not the
   reader's. A reader in London at 11pm on the 25th is looking at a schedule
   that is already on the 26th, and was being told a poll due in four hours
   was "tomorrow". The day comes back as UTC midnight, which is the frame
   Date.parse("YYYY-MM-DD") produces and the frame everything here compares
   in, and the clock as minutes past it. */
function easternNow() {
  const d = new Date();
  try {
    const p = {};
    for (const x of new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d)) p[x.type] = x.value;
    // some engines still render midnight as hour 24 rather than 0
    return { day: Date.UTC(+p.year, +p.month - 1, +p.day), mins: (+p.hour % 24) * 60 + +p.minute };
  } catch (e) {
    return { day: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
             mins: d.getHours() * 60 + d.getMinutes() };
  }
}

/* THE SUMMER BREAK. Nobody publishes federal voting intention between
   Christmas and the second week of January: across the 22 summers since
   2004/05 in the record, at most one poll per summer closed fieldwork
   between 22 Dec and 5 Jan, and in 2025/26 not one house published between
   23 Dec and 8 Jan. Where the houses come BACK is not a rhythm - last
   summer Roy Morgan on 12 Jan, Resolve 18 Jan, Newspoll 19 Jan, YouGov
   27 Jan, Essential 28 Jan, RedBridge 1 Feb. So a dated slot that falls in
   the dead zone is not a date at all: it becomes the resumption window, 9
   Jan to 1 Feb, as a loose row (every window consumer already reads that
   shape - see the calendar-month path), and the walk stops there. The
   walk-forward backtest had slots touching Dec/Jan hitting 3 of 8.
   Month-day strings, eastern calendar dates. */
const NP_SUMMER_DEAD = ["12-23", "01-08"];   // no federal release inside, inclusive
const NP_SUMMER_BACK = ["01-09", "02-01"];   // the span last summer's houses resumed across
function npInSummer(ms) {
  const md = new Date(ms).toISOString().slice(5, 10);
  return md >= NP_SUMMER_DEAD[0] || md <= NP_SUMMER_DEAD[1];
}

/* A MONTH-END rhythm (RedBridge/Accent for the AFR): one wave a month, out
   on the house's weekday nearest the month's last day - Sun 1 Mar, 29 Mar,
   3 May, 31 May, 28 Jun, 2 Aug, 30 Aug 2026, every 2026 release. Measured
   as an interval it is 28 or 35 days and a weekly-snapped ±, which drifts
   against the calendar; stated as the rule it has been exact. Declared in
   pollsterRules (release.monthEnd); the rule's own record is measured by
   gen-data, which runs THIS function (so the two cannot drift apart).

   From a release at `fromMs`, the slot is the `dow` nearest the last day of
   the month AFTER the month-end that release belonged to (the month-end
   nearest it: 1 Mar belongs to February's). Nearest in whole days, so the
   distances are 3 and 4 and never tie. UTC-midnight day stamps in and out,
   the frame everything here compares in. */
function npMonthEndSlot(fromMs, dow) {
  const d = new Date(fromMs);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const endPrev = Date.UTC(y, m, 0), endThis = Date.UTC(y, m + 1, 0);
  const base = new Date(fromMs - endPrev < endThis - fromMs ? endPrev : endThis);
  const target = Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 2, 0);
  let k = dow - new Date(target).getUTCDay();
  if (k > 3) k -= 7;
  if (k < -3) k += 7;
  return target + k * DAY_MS;
}

/* The window a row counts with must be the one its ± claims, and for a
   weekday house that is whole weeks, not days. Essential's gaps scatter
   ±4 days, but no Sunday or Friday filing can come of that – the only
   dates the wave can land on are this Wednesday or the ones either side,
   i.e. ±1 week. Measuring in raw days puts the window's far edge on a day
   the house cannot publish: Essential's row was counting down to a Sunday
   when the wave is really open until the Wednesday after. Houses with no
   weekday habit (and loose houses, whose raw span IS the claim) keep the
   day spread. Same +3 as the label: the snap itself can move 3 days. */
function spreadDays(c, sp) {
  return c.releaseDow != null && !c.loose ? 7 * Math.floor((sp + 3) / 7) : sp;
}

/* The projection, lifted out of the panel because the tab bar runs it too.
   Two places working out "when is the next poll" from the same cadence table
   would drift apart the moment either changed, and a countdown in the navbar
   has to be the same claim the panel makes. Moved, not rewritten.
   `nowOverride` ({day, mins}) is the sim/health-check seam: the page never
   passes it and always reads the live Sydney clock. */
function npProject(nowOverride) {
  const { D } = window.AP;
  const cad = D.pollCadence || [];
  if (!cad.length) return { rows: [], t0: 0, nowMs: 0 };
  const eNow = nowOverride || easternNow();
  const t0 = eNow.day;
  const nowMs = t0 + eNow.mins * 60000;
  const dayFloor = (ms) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };

  /* A four-week horizon rather than a fixed count: it answers "what lands this
     month" and sizes itself to how busy the field actually is. A weekly house
     appears four times inside it, a monthly one once – which is the honest
     shape of the schedule, not a repetition bug. The horizon bounds how many
     FURTHER slots of the walk show, never the first: every house holds one
     standing next slot no matter how far out it sits (Spectre Strategy's is
     ~twenty weeks away for most of the year), because a panel that stays
     silent on a slow house only pretends not to know when it lands next. */
  const rows = [];
  const horizon = t0 + NP_HORIZON_DAYS * DAY_MS;
  cad.forEach((c) => {
    /* A CALENDAR-MONTH rhythm (DemosAU) has no day to project: one wave per
       month on no particular day of it, so the slot IS the month - the
       day-of-month range the house has actually filed on (calDays, measured
       by gen-data over the published sequence; the bare month where it is
       absent) of the month after the last recorded wave. Shaped here as a
       loose window whose centre and spread are the range's own mid and
       half-span, so every window consumer (the panel's span and "open now",
       the bar's countdown, the missed count from the close) reads it
       without a special case of its own. */
    if (c.calMonth) {
      const ld = new Date(Date.parse(c.last));
      let sm = (ld.getUTCMonth() + 1) % 12;
      let sy = ld.getUTCFullYear() + (ld.getUTCMonth() === 11 ? 1 : 0);
      /* A slot month named in `skippedMonths` was confirmed absent at the
         publisher by the house's agent - the month-grain counterpart of the
         dated path's `skipped` roll below, and the same off-ramp from the
         never-rolled-forward-on-a-guess rule: the slot steps one month at a
         time to the next UNVERIFIED month rather than holding red on a
         window verified never filed. */
      while ((c.skippedMonths || []).includes(`${sy}-${String(sm + 1).padStart(2, "0")}`)) {
        sm += 1;
        if (sm > 11) { sm = 0; sy += 1; }
      }
      const lastDay = Date.UTC(sy, sm + 1, 0); // the next month's day 0 = this slot's last day
      const open = Date.UTC(sy, sm, c.calDays ? c.calDays[0] : 1);
      /* a habit reaching past the 28th is not owed a day a shorter month
         doesn't have: clamp the close to the slot month's own last day */
      const close = c.calDays ? Math.min(Date.UTC(sy, sm, c.calDays[1]), lastDay) : lastDay;
      const calSpread = (close - open) / 2 / DAY_MS;
      const release = (open + close) / 2;
      const missed = close < t0;
      /* The next window is the house's standing claim and holds its seat
         whatever the horizon - the dated walk's i === 0 rule below - and a
         MOOT slot keeps its seat until a release moves the anchor, the
         hold-the-slot rule everything else obeys */
      rows.push({
        ...c, field: open, release, missed, ahead: 0,
        overdue: missed,
        spread: calSpread, winHalf: calSpread,
        inDays: Math.round((release - t0) / DAY_MS),
        opensIn: Math.round((open - t0) / DAY_MS),
        closesIn: Math.round((close - t0) / DAY_MS),
      });
      return;
    }
    /* A house that keeps a weekday is projected onto it. Interval alone put
       Essential on a Thursday and YouGov on a Tuesday, when between them they
       have published on a Wednesday thirteen times out of fourteen dated
       releases - the interval is a median over waves whose fieldwork has
       shifted by a day or two, and it carries that drift into the answer.
       Nudged to the NEAREST matching weekday, never more than three days, so
       this corrects a rounding error rather than overriding the cadence: a
       house whose interval says three weeks does not get moved a fortnight to
       land on a Wednesday. Uses the same getDay() the row is printed with, so
       the date shown always falls on the weekday claimed for it. */
    const snap = (ms) => {
      if (c.releaseDow == null) return ms;
      let d = c.releaseDow - new Date(ms).getUTCDay();
      if (d > 3) d -= 7;
      if (d < -3) d += 7;
      return ms + d * DAY_MS;
    };
    // the moment a projected release is expected, which is the date plus the
    // hour the house keeps – the thing that is compared against now
    const due = (rel) => rel + (c.releaseMins == null ? NP_UNTIMED_MINS : c.releaseMins) * 60000;
    const relOf = (f) => dayFloor(snap(f + c.lag * DAY_MS));

    /* The next slot after the last recorded release – never rolled forward on
       a guess. A slot whose moment has passed without that release being
       added is overdue, not wrong: the wave may already be out and simply not
       entered yet, or it may be running late, and this page cannot tell
       which. Either way the honest row is the one the data on record actually
       supports, left where it is and marked overdue – it leaves the list only
       once a new release moves `c.last` past it, at which point this slot is
       what got confirmed and the row after it is the fresh guess. */
    /* a month-end house steps month-end to month-end, not by interval:
       its slot IS the release day, so field and release coincide (and the
       slot-relative tails below need no weekday-snap shift) */
    const monthEnd = !!c.monthEnd && c.releaseDow != null;
    const stepFrom = (rel) => npMonthEndSlot(rel, c.releaseDow);
    let field = monthEnd ? stepFrom(Date.parse(c.last)) : Date.parse(c.last) + c.cadence * DAY_MS;
    let release = monthEnd ? field : relOf(field);
    /* A slot named in `skipped` was confirmed absent at the publisher by the
       house's agent, the morning after it passed - so it is not an open bet
       and not overdue, it just isn't coming. Roll to the house's next
       possible release date: one week on for a dated house (the only step a
       weekly-slipping house can take; Essential's 28-day cadence slips to
       35, not 56), a full cadence otherwise. The honest row then is the
       next UNVERIFIED expectation, not a "(or N days ago)" asterisk on a
       release verified never filed. */
    let rolled = false;
    {
      const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
      while ((c.skipped || []).includes(isoDay(release))) {
        rolled = true;
        if (monthEnd) { field = release = stepFrom(release); continue; }
        field += (c.releaseDow != null ? 7 : c.cadence) * DAY_MS;
        release = relOf(field);
      }
    }
    /* A loose house earns its place when its WINDOW opens inside the horizon,
       not when its centre falls inside it: DemosAU's next centre is 30 days
       out and its window opens in 13, so testing the centre would hide a house
       that may well file next week. */
    const reaches = (rel, sp) => (c.loose ? rel - sp * DAY_MS : rel) <= horizon;
    /* i === 0 rides past the horizon on purpose: the next slot is the house's
       one standing claim, and dropping it because it sits more than four
       weeks out is how a quarterly house went unmentioned on the panel for
       most of the year. The horizon's job ends at slot two. */
    for (let i = 0; (i === 0 || reaches(release, Math.max(1, Math.round(c.spread * Math.sqrt(i + 1))))) && i < 12; i++) {
      /* a slot in the summer break: the house's next claim is the
         resumption window (NP_SUMMER_BACK of the January after), shaped as
         a loose row; a further slot there is not projected at all */
      if (npInSummer(release)) {
        if (i === 0) {
          const d = new Date(release);
          const y = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
          const at = (md) => Date.UTC(y, +md.slice(0, 2) - 1, +md.slice(3, 5));
          const open = at(NP_SUMMER_BACK[0]), close = at(NP_SUMMER_BACK[1]);
          const half = (close - open) / 2 / DAY_MS;
          const missed = close < t0;
          rows.push({
            ...c, field, release: (open + close) / 2, ahead: 0,
            loose: true, summer: true, overdue: missed, missed,
            spread: half, winHalf: half, slotEarly: null, slotLate: null, rolled: false,
            inDays: Math.round(((open + close) / 2 - t0) / DAY_MS),
            opensIn: Math.round((open - t0) / DAY_MS),
            closesIn: Math.round((close - t0) / DAY_MS),
          });
        }
        break;
      }
      const overdue = due(release) <= nowMs;
      /* Each further wave is one more interval of drift, so the window widens
         as sqrt(waves) – the second Essential is a looser bet than the first.
         A house on a fixed weekly schedule barely moves; an erratic one
         visibly fans out, which is the point. */
      const sp = Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)));
      /* The window is measured in the units the ± states it in – whole
         weeks for a weekday house (Essential's ±4 days is a ±1 week claim),
         raw days for everyone else. See spreadDays. */
      const winHalf = spreadDays(c, sp);
      /* The tails a label names as alternatives must re-reference to THIS
         slot, not to the median interval they were measured around.
         Essential's median gap is 31.5 days with ±3.5 of scatter, but the
         projected slot snaps back 3.5 days to the 28-day Wednesday – the
         nearest end of the record – so relative to the slot the only
         alternative the record offers is the 35-day Wednesday a WEEK LATE;
         the symmetric ± it carried named a 21-day Wednesday the house has
         never filed on. slotEarly/slotLate rebase the measured tails by how
         far the weekday snap moved this slot (zero when it sits exactly a
         cadence of weeks out: tail 2+ slots stay symmetric, which is right
         – a 63-day claim's alternatives genuinely are 56 and 70). Only a
         dated house gets the pair; everyone else's tails stay as measured.
         Clamped at zero, since an alternative cannot sit off the record. */
      const slotShift = c.releaseDow != null && !c.loose && c.spreadEarly != null
        ? (release - (field + c.lag * DAY_MS)) / DAY_MS
        : null;
      rows.push({
        ...c, field, release, overdue, ahead: i,
        spread: sp, winHalf,
        slotEarly: slotShift == null ? null : Math.max(0, c.spreadEarly + slotShift),
        slotLate: slotShift == null ? null : Math.max(0, c.spreadLate - slotShift),
        /* This slot already landed on the house's measured late step because
           a confirmed skip pushed it there: it IS the late alternative the
           ± would name. Flag it so the row labels don't offer a further
           +1-week date the record never shows (Essential slips 28→35, and
           the rolled 35-day slot then had 42 named as its miss) - only the
           first row of a walk can sit on it. */
        rolled: rolled && i === 0,
        inDays: Math.round((release - t0) / DAY_MS),
        opensIn: Math.round((release - winHalf * DAY_MS - t0) / DAY_MS),
        /* Overdue is not missed while the ± window is still open: the row
           counts on toward the far edge of it, and is only red once that too
           has passed. */
        closesIn: Math.round((release + winHalf * DAY_MS - t0) / DAY_MS),
        missed: overdue && release + winHalf * DAY_MS < t0,
      });
      // an overdue slot isn't a base to project the next one from – that
      // would stack a guess on a slot nothing has confirmed yet
      if (overdue || c.loose) break;   // loose: one window per house, same reason
      if (monthEnd) { field = release = stepFrom(release); continue; }
      field += c.cadence * DAY_MS;
      release = dayFloor(snap(field + c.lag * DAY_MS));
    }
  });
  /* Ordered by when each entry's wave is assumed to land – for a dated row
     that is the date, for a window the day it opens. An overdue row whose
     window is still open sorts at the FAR edge, not the date just missed:
     the assumption is that its poll has not been published, and while the
     window stays open the soonest it can land is that edge – so Essential
     sits under "in 3 days" and "in 5 days", at its own "in 6 days", instead
     of claiming the top of the list with yesterday's slot. A missed row –
     edge passed, dated OR loose – drops to the foot: there is no date left
     to give it. (Loose rows used to keep their window-open date here, which
     put a house whose window closed months ago at the TOP of the list.) */
  const first = (r) => (r.missed ? Infinity
    : r.loose ? r.release - r.spread * DAY_MS
    : r.overdue ? r.release + (r.winHalf != null ? r.winHalf : r.spread) * DAY_MS
    : r.release);
  rows.sort((a, b) => first(a) - first(b));
  return { rows, t0, nowMs };
}
window.AP.nextPolls = npProject;
window.AP.npMonthEndSlot = npMonthEndSlot;
