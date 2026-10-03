// The contract shared by the wave-adjudication chain: extractor (emits
// cases, applies verdicts), adjudicate.mjs (asks the LLM, validates), and
// the test suite. One module owns the case shapes and action enums so the
// three sides of the contract can never drift.
//
// A CASE is a routing question the deterministic extractor refuses to
// answer alone. A DECISION routes it. Neither ever carries poll figures —
// see the POISON list in adjudicate.mjs; this module's checks assume the
// payloads here are evidence and routing labels only.
//
// Case and action inventory (house key as used by --house):
//
//   roymorgan
//     double:   two unfiled feed candidates within RM_DOUBLE_DAYS days or
//               with overlapping field windows; RM re-releases, specials
//               sitting on top of the weekly wave. Evidence: both slugs,
//               wave dates, field windows, parsed figure snapshots, the
//               nearest Roy Morgan rows in polls[].
//               actions: file_both | file_only (slug) | never_file (slug)
//               never_file persists to the ledger so the slug is dropped
//               from candidates on later runs; the file_only sibling is
//               recorded dup_of for the same reason.
//     reissue:  a candidate whose wave date already has a polls row, but
//               whose parsed figures diverge from it by > RM_REISSUE_PT.
//               actions: heal_absent | escalate
//               heal_absent fills fields the ROW leaves absent from the
//               parse (never touches a field the row carries); escalate
//               changes nothing — a genuine correction is repair-agent or
//               human work, noted in the run status.
//
//   pollbludger
//     pending:  an uncovered feed wave sitting in its grace window; the
//               clock says "wait", and a judgement call says file now,
//               keep waiting, or never file. Evidence: the feed point's
//               figures, first-seen age, the nearest canonical rows of
//               that house.
//               actions: file_now | defer | never_file
//               defer and never_file persist to the ledger (defer stops
//               the LLM being re-asked every slot; never_file is the
//               machine equivalent of an ignore.json entry).
//     mismatch: a feed wave sits within the canonical date slack of an
//               existing polls row yet its primaries diverge by
//               > PB_MISMATCH_PT — possible false dedupe (a second,
//               genuinely different wave of the same house in the window).
//               actions: same_wave | distinct_wave
//               same_wave persists as never_file (covered); distinct_wave
//               files immediately — this wave is a genuine miss.
export const RM_DOUBLE_DAYS = 4;
export const RM_REISSUE_PT = 0.5;
export const PB_MISMATCH_PT = 1.0;

const RULES = {
  roymorgan: {
    double: { actions: ["file_both", "file_only", "never_file"], needs: { file_only: "slug", never_file: "slug" } },
    reissue: { actions: ["heal_absent", "escalate"], needs: {} },
  },
  pollbludger: {
    pending: { actions: ["file_now", "defer", "never_file"], needs: {} },
    mismatch: { actions: ["same_wave", "distinct_wave"], needs: {} },
  },
};

// Case ids are "<kind>:<discriminator>" (e.g. "double:2026-09-27:2026-09-29",
// "pending:1583"). kindOf pulls the kind back off the id the extractor
// emitted; the discriminator is the extractor's business alone.
const kindOf = (id) => String(id || "").split(":")[0];

export function validateCases(house, cases, decisions) {
  const rules = RULES[house];
  if (!rules) return { ok: false, why: `no rules for house ${house}` };
  const ids = new Set();
  for (const c of cases) {
    if (!c || typeof c !== "object" || typeof c.case !== "string" || !c.case.includes(":"))
      return { ok: false, why: "a case is not a {case:'<kind>:<id>', …} object" };
    if (!rules[kindOf(c.case)]) return { ok: false, why: `unknown case kind in ${c.case}` };
    if (ids.has(c.case)) return { ok: false, why: `duplicate case id ${c.case}` };
    ids.add(c.case);
  }
  if (!decisions) return { ok: true };
  const seen = new Set();
  for (const d of decisions) {
    if (!d || typeof d !== "object") return { ok: false, why: "a decision is not an object" };
    if (!ids.has(d.case)) return { ok: false, why: `decision for unknown case ${d.case}` };
    if (seen.has(d.case)) return { ok: false, why: `two decisions for ${d.case}` };
    seen.add(d.case);
    const rule = rules[kindOf(d.case)];
    if (!rule.actions.includes(d.action))
      return { ok: false, why: `action ${d.action} not in ${rule.actions.join("|")} for ${kindOf(d.case)}` };
    const need = rule.needs[d.action];
    if (need && !d[need]) return { ok: false, why: `action ${d.action} on ${d.case} needs a ${need} field` };
  }
  return { ok: true };
}

// Guard for the LLM's evidence bundle: everything the extractor puts in a
// case must stringify small. Returns the serialised JSON or null when the
// case is too big to hand to the model (the extractor then keeps the case
// deterministic this run).
export function caseJson(c, maxBytes = 6000) {
  let s;
  try { s = JSON.stringify(c); } catch { return null; }
  return s.length <= maxBytes ? s : null;
}
