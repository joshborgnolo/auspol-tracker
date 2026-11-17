/* independents.mjs: independents as a draw from the record (node side; calibrate-independents.mjs writes
   the record, seat-inputs.mjs and backtest-long.mjs build each seat's table from it, model-sim.mjs draws).

   An independent is a candidate, not a party: a seat's independent vote does not follow a national swing,
   and who stands is not known until nominations close. So the model reads both off what happened before.

     Sitting independents   the logit change in a sitting independent's own vote at the election they next
                            contested (27 since 1996): its mean is their drift, its spread their noise.
     Everyone else          every seat a party holds gets one independent challenge, whose share is drawn
                            from what happened NEXT in seats whose strongest losing independent had polled
                            about the same (`slotTable`): the cases of the last `window` elections, each
                            weighted by how near its previous share was (a normal kernel on the logit scale,
                            width `h`). A seat with no independent to speak of draws from the seats that had
                            none: mostly nothing, now and then a serious challenger. A seat whose independent
                            polled 25% draws from the seats where one had: some came back as strong, some
                            were gone.
     Waves                  each simulated election takes ALL its seats' draws from one of the window's
                            elections, so a year like 2022 (fifteen new challengers above 10%, five winners)
                            arrives whole or not at all, as it did.

   Levels are shares of the formal vote as counted. In a seat whose strongest independent polled under
   `replace` last time the smaller independents stay in the field as they are, and only a drawn challenge
   of `serious` or more is added; from `replace` up the drawn share stands in for that candidate. */
const logit = (p) => Math.log(p / (1 - p));
const sum = (a) => a.reduce((s, x) => s + x, 0);

export const IND_K = { window: 3, floor: 0.01, h: 0.5, serious: 0.1, replace: 0.05 };

/* the window: the `n` elections in the record before `before` (or the last n) */
export function windowYears(years, before = Infinity, n = IND_K.window) {
  return years.filter((y) => y < before).slice(-n);
}

/* Huber location and scale (k = 1.5 robust SDs, as swing-fit.mjs), shrunk towards no drift by n / (n + n0) */
export function sittingFit(ds, { k = 1.5, n0 = 0 } = {}) {
  const n = ds.length; if (!n) return { n: 0, drift: 0, sig: null };
  let m = sum(ds) / n, s = Math.sqrt(sum(ds.map((x) => (x - m) ** 2)) / n) || 0.3;
  for (let it = 0; it < 50; it++) {
    const e = ds.map((x) => x - m), mad = 1.4826 * [...e.map(Math.abs)].sort((a, b) => a - b)[Math.floor(n / 2)] || s;
    const w = e.map((x) => (Math.abs(x) <= k * mad ? 1 : k * mad / Math.abs(x)));
    const m2 = sum(ds.map((x, i) => w[i] * x)) / sum(w);
    s = mad; if (Math.abs(m2 - m) < 1e-9) { m = m2; break; } m = m2;
  }
  const rms = Math.sqrt(sum(ds.map((x) => (x - m) ** 2)) / n);
  return { n, mean: m, drift: m * n / (n + n0), sig: rms, robustSd: s };
}

/* one seat's table: for each election of the window, the levels its challenge can take and their
   cumulative weights; `central` is the pooled weighted median (the no-noise projection's level) */
export function slotTable(trans, years, tp, K = IND_K) {
  const x = logit(Math.max(tp, K.floor)), keep = tp >= K.replace;
  const cases = (ys) => {
    const m = new Map();
    for (const r of trans) {
      if (!ys.includes(r.E)) continue;
      const w = Math.exp(-0.5 * ((x - logit(Math.max(r.tp, K.floor))) / K.h) ** 2); if (w < 1e-6) continue;
      const lv = !keep && r.te < K.serious ? 0 : Math.round(r.te * 1e4) / 1e4;
      m.set(lv, (m.get(lv) || 0) + w);
    }
    return m;
  };
  const table = (m) => {
    const tot = sum([...m.values()]);
    const e = [...m.entries()].filter(([, w]) => w / tot >= 1e-4).sort((a, b) => a[0] - b[0]), t2 = sum(e.map(([, w]) => w));
    let c = 0; const lv = [], cum = [];
    for (const [l, w] of e) { c += w / t2; lv.push(l); cum.push(Math.round(c * 1e6) / 1e6); }
    cum[cum.length - 1] = 1;
    return { lv, cum, weight: tot };
  };
  const pooled = table(cases(years));
  // an election with under half a case's weight near this seat says nothing about it: the pooled window stands in
  const per = years.map((y) => { const m = cases([y]); const tot = sum([...m.values()]); return tot >= 0.5 ? table(m) : pooled; });
  const med = pooled.lv[pooled.cum.findIndex((c) => c >= 0.5)];
  return { lv: per.map((t) => t.lv), cum: per.map((t) => t.cum), central: med, n: Math.round(pooled.weight * 10) / 10,
    mean: Math.round(sum(pooled.lv.map((l, i) => l * (pooled.cum[i] - (i ? pooled.cum[i - 1] : 0)))) * 1e4) / 1e4 };
}

/* the seats' tables for one run: one shared table for every seat at or under the floor, its own for the rest.
   seats: [{ name, tp }] (party-held seats); returns { years, tables: { id: table }, idOf: { name: id } } */
export function slotTables(trans, years, seats, K = IND_K) {
  const tables = { _new: slotTable(trans, years, 0, K) }, idOf = {};
  for (const s of seats) { if (s.tp <= K.floor) { idOf[s.name] = "_new"; continue; } tables[s.name] = slotTable(trans, years, s.tp, K); idOf[s.name] = s.name; }
  return { years, tables, idOf };
}
