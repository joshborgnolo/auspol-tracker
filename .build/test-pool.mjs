// pool() (extract-common.mjs): bounded fan-out used by the News24 and Roy
// Morgan extractors. Pins item-order results, the in-flight ceiling, and
// rejection propagation. Offline (timers only); rides the npm-test chain.
import { pool } from "./extract-common.mjs";

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "ok  " : "NOT OK  ") + name);
  if (!cond) { failures++; if (extra != null) console.log("    -> " + extra); }
};

const sleep = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

// 1. results come back in item order regardless of completion order
{
  const items = [4, 3, 2, 1];
  const out = await pool(items, 4, (n) => sleep(n * 20, n * 10));
  ok("item order preserved", JSON.stringify(out) === "[40,30,20,10]", JSON.stringify(out));
}

// 2. at most `limit` jobs are ever in flight, and the ceiling is reached
{
  let inFlight = 0, peak = 0;
  const items = Array.from({ length: 9 }, (_, i) => i);
  const out = await pool(items, 3, async (n) => {
    inFlight++; peak = Math.max(peak, inFlight);
    const v = n * 2;
    await sleep(15, null);
    inFlight--;
    return v;
  });
  ok("concurrency capped at limit", peak <= 3, "peak=" + peak);
  ok("fan-out actually overlaps", peak >= 2, "peak=" + peak);
  ok("every item ran once", JSON.stringify(out) === "[0,2,4,6,8,10,12,14,16]", JSON.stringify(out));
}

// 3. a rejecting job rejects the pool — the serial loops it replaced threw
{
  let threw = false;
  try {
    await pool([1, 2, 3], 2, (n) => (n === 2 ? Promise.reject(new Error("boom")) : sleep(30, n)));
  } catch (e) { threw = e.message === "boom"; }
  ok("rejection propagates", threw);
}

// 4. edges: empty list, limit above the list length
{
  const empty = await pool([], 2, () => sleep(5, 1));
  ok("empty list -> empty results", Array.isArray(empty) && empty.length === 0);
  const two = await pool(["a", "b"], 9, (s) => sleep(5, s + "!"));
  ok("limit > items tolerated", JSON.stringify(two) === '["a!","b!"]', JSON.stringify(two));
}

console.log(failures ? `\n${failures} FAILURES` : "\npool checks pass");
process.exit(failures ? 1 : 0);
