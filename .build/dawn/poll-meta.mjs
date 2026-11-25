let sydneyFmt;
function sydneyWallMs(ms) {
  sydneyFmt ||= new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = {};
  for (const x of sydneyFmt.formatToParts(ms)) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
}

export function pollPublishedMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso || "");
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (m[7] === "Z") return wall;
  if (m[7]) {
    const zone = /^([+-])(\d{2}):?(\d{2})$/.exec(m[7]);
    const offset = (+zone[2] * 60 + +zone[3]) * (zone[1] === "+" ? 1 : -1);
    return wall - offset * 60000;
  }
  /* Poll stamps are Sydney wall time, without a zone. Two passes also land
     correctly when that date is inside daylight saving. */
  let ms = wall - 10 * 3600000;
  for (let i = 0; i < 2; i++) ms += wall - sydneyWallMs(ms);
  return ms;
}

export function latestPollLine(D, nowMs = Date.now()) {
  const p = D.latestPoll;
  if (!p || !p.h) return "";
  let s = `Latest poll is ${p.h}’s`;
  const published = pollPublishedMs(p.pub);
  if (published == null) return s + ".";
  const age = Math.max(0, nowMs - published);
  const [n, unit] = age < 3600000 ? [Math.round(age / 60000), "minute"]
    : age < 86400000 ? [Math.round(age / 3600000), "hour"]
    : [Math.round(age / 86400000), "day"];
  return `${s}, ${n} ${unit}${n === 1 ? "" : "s"} ago.`;
}
