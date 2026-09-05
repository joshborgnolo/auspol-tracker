/* UTC instant → Australia/Melbourne local wall-clock string.

   Canon `published` strings in data/polls.json are local WITHOUT an offset,
   and Melbourne observes AEDT (UTC+11) October–April. Extractors used to
   apply a fixed +10h ("AEST"), which puts a summer release in the wrong
   hour and — near local midnight — on the wrong DAY, a wrong date being
   what fieldwork-window year inference then reads. Modelled on
   extract-roymorgan.mjs's CMS-date conversion; the three extractors that
   hand-rolled +10h (news24, spectre, foxhedgehog) use this instead. */

const MELB = new Intl.DateTimeFormat("en", {
  timeZone: "Australia/Melbourne",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// Canon `published` local form: "YYYY-MM-DDTHH:MM". NaN/invalid in → null.
export function melbourneMinute(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const p = Object.fromEntries(MELB.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
