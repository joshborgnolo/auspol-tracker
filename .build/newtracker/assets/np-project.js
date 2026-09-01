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
const NP_HORIZON_DAYS = 28;   // one month of schedule
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
     appears four times, a monthly one once – which is the honest shape of the
     schedule, not a repetition bug. */
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
      /* earns its place when the window opens inside the horizon, like any
         loose house - but a MOOT slot keeps its seat until a release moves
         the anchor, the same hold-the-slot rule everything else obeys */
      if (open <= horizon || missed) {
        rows.push({
          ...c, field: open, release, missed, ahead: 0,
          overdue: missed,
          spread: calSpread, winHalf: calSpread,
          inDays: Math.round((release - t0) / DAY_MS),
          opensIn: Math.round((open - t0) / DAY_MS),
          closesIn: Math.round((close - t0) / DAY_MS),
        });
      }
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
    let field = Date.parse(c.last) + c.cadence * DAY_MS;
    let release = relOf(field);
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
        field += (c.releaseDow != null ? 7 : c.cadence) * DAY_MS;
        release = relOf(field);
      }
    }
    /* A loose house earns its place when its WINDOW opens inside the horizon,
       not when its centre falls inside it: DemosAU's next centre is 30 days
       out and its window opens in 13, so testing the centre would hide a house
       that may well file next week. */
    const reaches = (rel, sp) => (c.loose ? rel - sp * DAY_MS : rel) <= horizon;
    for (let i = 0; reaches(release, Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)))) && i < 12; i++) {
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
      rows.push({
        ...c, field, release, overdue, ahead: i,
        spread: sp, winHalf,
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
