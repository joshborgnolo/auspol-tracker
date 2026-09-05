/* HOUSE_RENAMES – one home for the current-term pollster canonical map.

   A house occasionally carries two spellings in polls.json (a pre-rebrand
   label next to the current one). Downstream — gen-data's estimator and
   every leadership/chart series — must see ONE name per house or the old
   spelling splits the series in two. The rename used to be invented three
   times (gen-data.mjs, deff-backtest.mjs and, after the validate.mjs
   duplicate check started keying on renamed names, validate.mjs); those
   copies drift, so it lives here.

   Only the CURRENT cycle. Past-cycle firm strings are canonicalised
   separately, by ACC_CANON in gen-data.mjs, where the rules are stricter —
   see the comment there on why Galaxy and YouGov are not merged.

   Products are not names: the (MRP) variants are a different piece of work on
   their own schedule and are not folded into the tracking poll. */
export const HOUSE_RENAMES = { "Redbridge": "RedBridge / Accent" };

// Canonical name for a current-term pollster/firm string.
export const canonHouse = (name) => HOUSE_RENAMES[name] || name;
