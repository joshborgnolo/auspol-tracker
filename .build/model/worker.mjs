/* worker.mjs: the /model/ page's engine room - copied to model/js/worker.mjs by .build/model/assemble.mjs.
   Runs the seat model's own modules (model/js/*.mjs are byte-identical copies of
   .build/analysis/seat-model/*.mjs, pinned by .build/model/test-model-bundle.mjs) on a reader's settings.

   Messages in:
     { type: "init", inputsUrl, senateUrl }
     { type: "run", id, mode, now5, levers, uncertainty, polErrMult, seatNoiseMult, flowNoiseMult, fade, draws, seed }
   Messages out:
     { type: "ready", levels }                       the levers' levels as the model stands
     { type: "central", id, result }                 the single no-noise projection (immediate)
     { type: "progress", id, p }                     share of the simulations done
     { type: "result", id, result }                  the simulations, tallied as the official files are
     { type: "error", message }
   A run cannot be interrupted inside its loop; the page discards a busy worker and starts a fresh one when
   the reader changes something mid-run. */
import { rankingsFrom } from "./senate-flows.mjs";
import { buildSeatsFrom, leverLevels } from "./seat-build.mjs";
import { runMany, projectOnce } from "./model-sim.mjs";

let INPUTS = null, SEN = null;
const cache = new Map();
const seatsFor = (levers) => {
  const k = JSON.stringify(levers || {});
  if (!cache.has(k)) {
    if (cache.size > 6) cache.delete(cache.keys().next().value);
    cache.set(k, buildSeatsFrom({ seats: INPUTS.seats, hist: INPUTS.build.hist, comp: INPUTS.build.comp, ST: INPUTS.build.ST, SEN }, { composition: true, levers }));
  }
  return cache.get(k);
};

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      const [inp, sen] = await Promise.all([fetch(m.inputsUrl).then((r) => r.json()), fetch(m.senateUrl).then((r) => r.json())]);
      INPUTS = inp; SEN = rankingsFrom(sen);
      const base = seatsFor(null);
      self.postMessage({ type: "ready", levels: leverLevels(SEN, base) });
      return;
    }
    if (m.type === "run") {
      const seats = seatsFor(m.levers);
      const base = INPUTS.settings[m.mode === "forecast" ? "forecast" : "nowcast"];
      const S = { ...base,
        now5: m.now5 || base.now5,
        uncertainty: m.uncertainty !== false,
        polErrMult: m.polErrMult ?? 1, seatNoiseMult: m.seatNoiseMult ?? 1, flowNoiseMult: m.flowNoiseMult ?? 1,
        fade: m.mode === "forecast" ? (m.fade || base.fade) : null };
      self.postMessage({ type: "central", id: m.id, result: projectOnce(seats, S) });
      if (S.uncertainty && m.draws > 0) {
        const result = runMany(seats, S, { draws: m.draws, seed: m.seed || 20261101, progressEvery: 50, onProgress: (p) => self.postMessage({ type: "progress", id: m.id, p }) });
        self.postMessage({ type: "result", id: m.id, result });
      }
    }
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
