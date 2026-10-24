#!/usr/bin/env python3
"""Fold the four events' Coalition-v-One-Nation pair counters ("pc") into
counts.json, beside the existing `pa`/`paStates` blocks.

Guards (nothing is written unless all pass):
- every event's recomputed national + per-state `counts` (toALP/toCOAL/
  neither) deep-equals the committed counts.json blocks - stale or partial
  results can't move the committed file;
- every event's recomputed `pa` national + per-state blocks byte-equal the
  committed pa/paStates blocks (the pc merge must never ride a rerun that
  moved the pa figures);
- all four events' atl_flow_results-<EVENT>.json exist in AEC_RESULTS_DIR
  (default this script's dir) and their `pc` blocks carry the five PC cells
  for all five families, national and per state.

Run after `analyse_atl_flows.py <EVENT>` for each of 20499 24310 27966 31496.
Writes counts.json in place (existing keys keep their bytes; `pc` and
`pcStates` land inside each event block). Re-running is idempotent.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.environ.get("AEC_RESULTS_DIR", HERE)
EVENT_YEAR = [("20499", "2016"), ("24310", "2019"), ("27966", "2022"), ("31496", "2025")]
PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"]
PC = ["COAL_first", "COAL_only", "PHON_first", "PHON_only", "neither"]
FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"]


def aecbook(fam_block):
    return {fam: {d: int(fam_block[fam][d]) for d in ["toALP", "toCOAL", "neither"]} for fam in FAMILIES}


def pabook(fam_block):
    return {fam: {d: int(fam_block[fam][d]) for d in PA} for fam in FAMILIES}


def main():
    counts_path = os.path.join(HERE, "counts.json")
    committed = json.load(open(counts_path))
    out = {"events": {}}
    for event, year in EVENT_YEAR:
        res_path = os.path.join(RES, f"atl_flow_results-{event}.json")
        if not os.path.exists(res_path):
            sys.exit(f"missing {res_path} - run analyse_atl_flows.py {event} first")
        res = json.load(open(res_path))
        assert res.get("event") == event and res.get("year") == int(year), f"{event}: results metadata drifted"

        committed_ev = committed["events"][year]
        # the recomputed ALP-v-COAL blocks must byte-match what is committed
        assert aecbook(res["national"]) == committed_ev["counts"], \
            f"{year}: recomputed national counts differ from the committed blocks"
        for st, cstates in committed_ev["states"].items():
            assert st in res["results"], f"{year} {st}: state missing from results"
            assert aecbook(res["results"][st]["counts"]) == cstates, \
                f"{year} {st}: recomputed state counts differ from the committed blocks"
        # same discipline for the pa blocks, landed by merge_pa_counts.py
        assert pabook(res["pa"]["national"]) == committed_ev["pa"], \
            f"{year}: recomputed national pa differs from the committed blocks"
        for st, pstates in committed_ev["paStates"].items():
            assert pabook(res["pa"]["states"][st]) == pstates, \
                f"{year} {st}: recomputed state pa differs from the committed blocks"

        pc_n = res["pc"]["national"]
        pc_s = res["pc"]["states"]
        for scope, book in [("national", pc_n)] + list(pc_s.items()):
            for fam in FAMILIES:
                assert fam in book and sorted(book[fam]) == sorted(PC), f"{year} {scope} {fam}: pc cells missing"
        # states recombine to the national pc exactly
        for fam in FAMILIES:
            for cell in PC:
                ssum = sum(pc_s[st][fam][cell] for st in pc_s)
                assert ssum == pc_n[fam][cell], f"{year} pc recombination: {fam}.{cell} states={ssum} national={pc_n[fam][cell]}"

        ev = {k: v for k, v in committed_ev.items()}
        ev["pc"] = {fam: pc_n[fam] for fam in FAMILIES}
        ev["pcStates"] = {st: {fam: pc_s[st][fam] for fam in FAMILIES} for st in pc_s}
        out["events"][year] = ev
    # event order follows the committed file's
    out["events"] = {y: out["events"][y] for y in committed["events"]}
    with open(counts_path, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print("counts.json extended with pc blocks for", ", ".join(out["events"]))


if __name__ == "__main__":
    main()
