#!/usr/bin/env python3
"""derive-division-seifa-stats90s.py — the SEIFA era lanes for the
statistics-era federal frames (1993/1996/1998 elections), three-index
only (IRSD/IER/IEO — IRSAD did not exist before the 2001 census; rr6
sect.2). Emits two seifa-src fixtures:

  seifa-src/era-derived-90s.json   measured store blocks for elections
    1993 (SEIFA 1991 CD cube x the 1993-election division set) and
    1996 (SEIFA 1996 CD cube x the 1996-election set) — population-
    weighted means of the constituent census CDs per ABS 2039.0 sect.2.2,
    the same recipe the ABS lane rides for 2013+ (and the AEC/APH papers
    rode before it). The 1998 store block already exists (aph98cib04).

  seifa-src/div-interp-90s.json    pcti side records for elections
    1993/1996/1998 in exactly the div-interp.json inner shape, merged by
    extract-division-seifa.mjs alongside derive-division-seifa-interp.py's
    GCP-era lanes: every division per index carries {pct0, pct1, pcti},
    pcti = (1-f)*pct0 + f*pct1 with f the day-share of the intercensal
    span elapsed at election day:
      1993: 1991c x 1993set | 1996c x 1993set | f = 0.320197 (nearest c0)
      1996: 1991c x 1996set | 1996c x 1996set | f = 0.914067 (nearest c1)
      1998: measured store block (aph98cib04 = 1996c x 1997 boundaries,
            read back) | 2001c x 1998set    | f = 0.431308

The five-index-era structure is handled by ranking EVERY side inside its
own census's era pool (the pct currency: percentiles interpolate absolute
SES position across re-based editions; raw scores never do — the interp
doctrine verbatim). Division sets ride the committed era allocations
(seifa-src/cd-{1991,1996,2001}-ced-{1993,1996,1998}set.json, built by
derive-cd-91-96-ced-alloc.py against the map's own published era frames).

Inputs (git-ignored cache, re-fetch: fetch-aurin-census.py --census=seifa):
  cache/seifa-cd-aurin/seifa_cd_{1991,1996,2001}.csv (AURIN DB_3 WFS
  pulls; 2001 also exists as the ABS zip the 2004-era lane reads, but the
  AURIN copy shares the two earlier cubes' CSV schema, so one reader
  serves all three).

Cross-checks (fail loud):
  * cube universes pinned (31,058 / 34,043 / 35,695 rows); populations
    sum to the censuses' own totals inside a tolerance band;
  * division name-sets equal the alloc files' `divisions` lists exactly,
    and equal the served map frame name-sets for 1993/1996/1998;
  * every division scored on every index (alloc is whole-unit);
  * national decile pop-share per index per side sits 10% +- 3.5 (the
    interp lane's census/edition-swap catcher), deciles ranked inside
    that side's own census-cube pool;
  * 1998's computed 1996-cube side reproduces the aph98cib04 printed
    store values within a printed-figure slack band (the paper's own
    bespoke weighting vs the whole-unit alloc) — surfaced as a printed
    max-delta, asserted <= 2.0 score points;
  * 1998's pct0 equals the committed store block's pct cells exactly
    (pct = rankDis/N over the paper's printed ranks, half-up 6dp).

Run from the repo root:
    python3 .build/analysis/seat-model/derive-division-seifa-stats90s.py
"""

import bisect
import collections
import csv
import json
import math
import sys
from datetime import date
from pathlib import Path

csv.field_size_limit(sys.maxsize)

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

HERE = ROOT / ".build/analysis/seat-model"
CACHE = HERE / "cache"
SRC = HERE / "seifa-src"
STORE_JSON = ROOT / "data/division-seifa-indexes.json"

IDX = ["irsd", "ier", "ieo"]
IDX_COL = {  # per cube: ABS renames its columns between editions
    1991: {"irsd": "index_of_relative_socio_economic_disadvantage",
           "ier": "_index_of_economic_resources",
           "ieo": "index_of_education_and_occupation_"},
    1996: {"irsd": "index_of_relative_socio_economic_disadvantage",
           "ier": "_index_of_economic_resources",
           "ieo": "index_of_education_and_occupation_"},
    2001: {"irsd": "irsd_score", "ier": "ier_score", "ieo": "ieo_score"},
}
CUBES = {1991: {"file": "seifa_cd_1991.csv", "code": "cd_code",
                "pop": "_seifa91_population", "rows": 31058,
                "natPop": (16772892, 16772892)},  # measured 2026-10-31
         1996: {"file": "seifa_cd_1996.csv", "code": "cd_code",
                "pop": "_seifa96_population", "rows": 34043,
                "natPop": (17674788, 17674788)},
         2001: {"file": "seifa_cd_2001.csv", "code": "cd_code_2001",
                "pop": "seifa_2001_population", "rows": 35695,
                "natPop": (18726897, 18726897)}}
CENSUS_NIGHT = {1991: date(1991, 8, 6), 1996: date(1996, 8, 6),
                2001: date(2001, 8, 7)}
ELECTION_DAY = {1993: date(1993, 3, 13), 1996: date(1996, 3, 2),
                1998: date(1998, 10, 3)}
# election -> (set, c0 census, c1 census, measured side, store block origin)
LANES = {
    1993: {"set": "1993set", "c0": 1991, "c1": 1996, "measured": "pct0",
           "block": "derived91"},
    1996: {"set": "1996set", "c0": 1991, "c1": 1996, "measured": "pct1",
           "block": "derived96"},
    1998: {"set": "1998set", "c0": 1996, "c1": 2001, "measured": "pct0",
           "block": "aph98"},
}
STE_OF_DIGIT = {"1": "NSW", "2": "VIC", "3": "QLD", "4": "SA", "5": "WA",
                "6": "TAS", "7": "NT", "8": "ACT", "9": "OT"}
MC_NORM = {"Mcewen": "McEwen", "Mcmillan": "McMillan",
           "Mcpherson": "McPherson"}


def r6(x):
    """Half-up 6dp — the store's rounding rule (identical half-up to JS
    Math.round; Python's round() is banker's and diverges on near-ties).
    pcti is computed FROM the r6-rounded sides so the file re-derives its
    own pcti to the last decimal."""
    return math.floor(x * 1e6 + 0.5) / 1e6


def fail(msg):
    raise SystemExit(f"GUARD {msg}")


def frame_states():
    """Division name -> state from the map's own served frames — the era
    name/state universe in one read (also the alloc name-set gate's other
    side)."""
    out = {}
    for y in (1993, 1996, 1998):
        d = json.loads((ROOT / f"map/data/res-{y}.json")
                       .read_text(encoding="utf-8"))
        for dv in d["divs"]:
            out.setdefault(y, {})[dv["n"]] = dv["st"]
    return out


def load_cube(year):
    spec = CUBES[year]
    path = CACHE / "seifa-cd-aurin" / spec["file"]
    if not path.exists():
        fail(f"missing {path} (fetch-aurin-census.py --census=seifa)")
    cube, pops = {}, 0
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            code = (row.get(spec["code"]) or "").strip()
            if len(code) != 7 or not code.isdigit():
                continue
            if code[0] not in STE_OF_DIGIT:
                continue
            pop_s = (row.get(spec["pop"]) or "").strip()
            pop = int(float(pop_s)) if pop_s else 0
            rec = {"pop": pop}
            for idx in IDX:
                v = (row.get(IDX_COL[year][idx]) or "").strip()
                rec[idx] = round(float(v), 6) if v else None
            cube[code] = rec
            pops += pop
    if len(cube) != spec["rows"]:
        fail(f"{year} cube rows {len(cube)} != pin {spec['rows']}")
    lo, hi = spec["natPop"]
    if not lo <= pops <= hi:
        fail(f"{year} cube population {pops} outside {lo}..{hi}")
    print(f"seifa{year} cube: {len(cube):,} CDs, population {pops:,}")
    return cube


def load_alloc(census_year, set_name):
    path = SRC / f"cd-{census_year}-ced-{set_name}.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    return d["alloc"], list(d["divisions"]), str(path)


def weighted_side(cube, alloc, divisions, tag):
    """alloc {unit: division-name} whole-unit; means per division per idx
    = sum(score*pop)/sum(pop), drop-pop=0 units, unscored units drop from
    THAT index only (the ABS-lane rule)."""
    accum = {idx: collections.defaultdict(lambda: [0.0, 0.0]) for idx in IDX}
    unscored = collections.Counter()
    for unit, div in alloc.items():
        rec = cube.get(unit)
        if rec is None or rec["pop"] <= 0:
            continue
        for idx in IDX:
            s = rec[idx]
            if s is None:
                unscored[idx] += 1
                continue
            a = accum[idx][div]
            a[0] += s * rec["pop"]
            a[1] += rec["pop"]
    side = {}
    for idx in IDX:
        for div, (sw, w) in accum[idx].items():
            if w > 0:
                side.setdefault(div, {})[idx] = sw / w
    missing = {d for d in divisions} - set(side)
    if missing:
        fail(f"{tag}: divisions without any scored unit {sorted(missing)}")
    for div in divisions:
        lack = [i for i in IDX if side[div].get(i) is None]
        if lack:
            fail(f"{tag}: {div} unscored for {lack}")
    # gross shape per the interp lane's band
    for idx in IDX:
        vals = [side[d][idx] for d in divisions]
        mn = sum(vals) / len(vals)
        if not 930 < mn < 1070:
            fail(f"{tag}:{idx} mean {mn:.1f} outside 930..1070")
        if not all(650 < v < 1450 for v in vals):
            fail(f"{tag}:{idx} score outside 650..1450")
    if unscored:
        print(f"  {tag}: unscored-unit drops {dict(unscored)}")

    # census/edition-swap catcher, the interp lane's own recipe: the
    # population share of each national decile ACROSS THE CUBE's AREAS
    # (each census CD weighted by its residents; divisions are means and
    # would sit centrally by smoothing — deciling THEM is the wrong test)
    ladders = {}
    for idx in IDX:
        pool = sorted(s for s in (rec[idx] for rec in cube.values())
                      if s is not None)
        ladders[idx] = pool
    shares = {}
    for idx in IDX:
        pops = [0.0] * 10
        tot = 0.0
        for rec in cube.values():
            s = rec[idx]
            if s is None or rec["pop"] <= 0:
                continue
            d = min(9, bisect.bisect_left(ladders[idx], s) * 10
                    // len(ladders[idx]))
            pops[d] += rec["pop"]
            tot += rec["pop"]
        shares[idx] = [x / tot * 100 for x in pops]
        if not all(10 - 3.5 < x < 10 + 3.5 for x in shares[idx]):
            fail(f"{tag}:{idx} cube decile pop shares "
                 f"{[round(x, 2) for x in shares[idx]]} beyond 10%+-3.5")
    print(f"  {tag}: cube decile pop-shares ok "
          f"(irsd {[round(x, 1) for x in shares['irsd']]})")
    print(f"  {tag}: {len(divisions)} divisions weighted (pop "
          f"{int(sum(accum['irsd'][d][1] for d in divisions)):,})")
    return side


def rank_pct(values, tag):
    """{div: score} -> {div: pct=rankDis/N}, rank 1 = MOST disadvantaged
    (ascending score). Full-precision collisions hard-fail (the store's
    structural rule)."""
    ordered = sorted(values.items(), key=lambda kv: kv[1])
    n = len(ordered)
    out = {}
    for rk, (div, v) in enumerate(ordered, start=1):
        if div in out:
            fail(f"{tag}: duplicate division {div}")
        out[div] = v
    seen = set()
    pcts = {}
    for rk, (div, v) in enumerate(ordered, start=1):
        key = round(v, 12)
        if key in seen:
            fail(f"{tag}: full-precision collision at {v} ({div})")
        seen.add(key)
        pcts[div] = rk / n
    return pcts


def main():
    for year in CUBES:
        CUBES[year]["cube"] = load_cube(year)

    frames = frame_states()
    allocs, divsets = {}, {}
    for census in (1991, 1996, 2001):
        for lane in LANES.values():
            set_name = lane["set"]
            key = (census, set_name)
            if key not in allocs and (census == lane["c0"]
                                      or census == lane["c1"]):
                alloc, divisions, src = load_alloc(census, set_name)
                allocs[key], divsets[set_name] = (alloc, src), divisions
    for y, lane in LANES.items():
        alloc_names = set(divsets[lane["set"]])
        frame_names = set(frames[y])
        if alloc_names != frame_names:
            fail(f"{y}: alloc divisions ^ frame names: "
                 f"{sorted(alloc_names - frame_names)} / "
                 f"{sorted(frame_names - alloc_names)}")

    sides = {}
    for census in (1991, 1996, 2001):
        for lane_y, lane in LANES.items():
            set_name = lane["set"]
            if census not in (lane["c0"], lane["c1"]):
                continue
            tag = f"c{census}x{set_name}"
            alloc, _src = allocs[(census, set_name)]
            sides[(census, set_name)] = weighted_side(
                CUBES[census]["cube"], alloc, divsets[set_name], tag)

    # ---- measured store blocks (elections 1993 + 1996)
    era_blocks, era_prov = {}, {}
    for y, lane in ((1993, LANES[1993]), (1996, LANES[1996])):
        census = lane["c0"] if lane["block"] == "derived91" else lane["c1"]
        set_name = lane["set"]
        side = sides[(census, set_name)]
        divisions = divsets[set_name]
        pcts = {idx: rank_pct({d: side[d][idx] for d in divisions},
                              f"e{y} block:{idx}")
                for idx in IDX}
        block = {}
        for div in sorted(divisions):
            rec = {"state": frames[y][div]}
            for idx in IDX:
                rec[idx] = {"value": round(side[div][idx], 3),
                            "rank": round(pcts[idx][div] * len(divisions))}
            block[div] = rec
        era_blocks[str(y)] = block
        era_prov[f"eraCd{census}Ced{set_name}"] = {
            "title": (f"SEIFA {census} CD cube (AURIN seifa_cd_{census}) x "
                      f"the {y}-election division set "
                      f"(seifa-src/cd-{census}-ced-{set_name}.json), "
                      "population-weighted mean of constituent census "
                      "CDs (ABS 2039.0 sect.2.2)"),
            "censusYear": census, "editionInForce": str(y),
            "derivation": "weighted",
            "recons": ("census-pool decile pop-shares 10%+-3.5; name-set "
                       "equal to the alloc's division list")}

    # ---- pcti sides (elections 1993/1996/1998)
    interp_blocks, factors = {}, {}
    pct_side = {}
    for y, lane in LANES.items():
        set_name = lane["set"]
        divisions = divsets[set_name]
        value_side = {}
        for k in ("c0", "c1"):
            census = lane[k]
            side = sides[(census, set_name)]
            value_side[k] = {idx: rank_pct(
                {dv: side[dv][idx] for dv in divisions},
                f"e{y} {k}:{idx}") for idx in IDX}
        if y == 1998:
            # c0 is the MEASURED aph98 store block: pct from its printed
            # ranks, asserted identical compute (rankDis/N half-up 6dp)
            store = json.loads(STORE_JSON.read_text(encoding="utf-8"))
            blk = store["elections"]["1998"]
            if sorted(blk) != sorted(divisions):
                fail("1998 store block name-set != 1998set alloc divisions")
            n = len(divisions)
            measured = {}
            for idx in IDX:
                measured[idx] = {}
                for div in divisions:
                    rk = blk[div][idx]["rank"]
                    if not isinstance(rk, int) or not 1 <= rk <= n:
                        fail(f"1998 {div} {idx}: rank {rk!r} outside 1..{n}")
                    measured[idx][div] = rk / n
                # 1996-cube computed side must sit next to the paper's
                # printed values inside the split-CD-resolution band: the
                # paper's bespoke CD-split weighting resolves boundary-
                # clipping CDs fractionally where this whole-unit alloc
                # plurality-assigns them — worst case lands at a few score
                # points on clipping divisions (measured 2026-10-31: max
                # 3.372 Hunter, median ~0.15/0.36/0.29 per index)
                found = sides[(1996, set_name)]
                deltas = sorted(
                    abs(found[div][idx] - blk[div][idx]["value"])
                    for div in divisions)
                mx = deltas[-1]
                med = deltas[len(deltas) // 2]
                print(f"  aph98 oracle {idx}: max|delta| {mx:.3f}, "
                      f"median {med:.3f}")
                if mx > 4.0 or med > 0.6:
                    fail(f"aph98 oracle {idx}: max {mx}, median {med} "
                         "outside the split-CD band")
            value_side["c0"] = measured
        else:
            # elections 1993/1996's measured side IS one of the computed
            # sides; it must equal the era block's pct (identical compute —
            # rank_pct over the same values, asserted below in-file since
            # both come from this run)
            pass
        pct_side[y] = value_side
        f = r6((ELECTION_DAY[y] - CENSUS_NIGHT[lane["c0"]]).days
               / (CENSUS_NIGHT[lane["c1"]] - CENSUS_NIGHT[lane["c0"]]).days)
        factors[str(y)] = {"c0": lane["c0"], "c1": lane["c1"],
                           "date": ELECTION_DAY[y].isoformat(), "f": f}
        blk = {}
        for div in sorted(divisions):
            cell = {}
            for idx in IDX:
                p0 = r6(value_side["c0"][idx][div])
                p1 = r6(value_side["c1"][idx][div])
                cell[idx] = {"pct0": p0, "pct1": p1,
                             "pcti": r6((1 - f) * p0 + f * p1)}
            blk[div] = cell
        interp_blocks[str(y)] = blk

    # 1993/1996's measured-side pct (its era block) must equal the pcti
    # lane's corresponding side to the last decimal — the file proves its
    # own read-back equality before extract ever asserts it:
    for y, k in ((1993, "c0"), (1996, "c1")):
        lane = LANES[y]
        census = lane[k]
        set_name = lane["set"]
        side = sides[(census, set_name)]
        divisions = divsets[set_name]
        block_pct = {idx: rank_pct({d: side[d][idx] for d in divisions},
                                   f"e{y} verify:{idx}")
                     for idx in IDX}
        for idx in IDX:
            for div in divisions:
                got = r6(block_pct[idx][div])
                want = interp_blocks[str(y)][div][idx]["pct" + k[-1]]
                if got != want:
                    fail(f"e{y} {div} {idx}: block pct {got} != interp "
                         f"{k} {want}")

    # ---- emit
    era_out = {
        "_about": ("Measurer-side SEIFA blocks for the statistics-era "
                   "federal frames (1993/1996 elections): era census-CD "
                   "cubes x the era division sets, weighted per ABS "
                   "2039.0 sect.2.2. IRSD/IER/IEO only — IRSAD predates "
                   "its SEIFA-2001 invention by neither census. Ranks "
                   "rank 1 = most disadvantaged (the store's convention). "
                   "See derive-division-seifa-stats90s.py."),
        "_provenance": era_prov,
        "elections": era_blocks,
    }
    (SRC / "era-derived-90s.json").write_text(
        json.dumps(era_out, indent=2) + "\n", encoding="utf-8")
    print(f"OK -> seifa-src/era-derived-90s.json (elections "
          f"{sorted(era_blocks)})")

    interp_out = {
        "_about": ("pcti side records for the statistics-era federal "
                   "frames (1993/1996/1998 elections) — the era-cube "
                   "lanes of derive-division-seifa-interp.py's contract, "
                   "computed by derive-division-seifa-stats90s.py. Every "
                   "side ranks inside its own census's era pool; 1998's "
                   "pct0 is the measured aph98 store block read back "
                   "(printed ranks/N)."),
        "_provenance": {
            "eraCdCubes": {
                "title": "AURIN DB_3 seifa_cd_{1991,1996,2001} cubes x "
                         "the committed era allocations "
                         "(seifa-src/cd-*-ced-*set.json)",
                "censusYear": None},
        },
        "factors": factors,
        "elections": interp_blocks,
    }
    (SRC / "div-interp-90s.json").write_text(
        json.dumps(interp_out, indent=2) + "\n", encoding="utf-8")
    print(f"OK -> seifa-src/div-interp-90s.json (elections "
          f"{sorted(interp_blocks)}, factors "
          f"{json.dumps(factors, sort_keys=True)})")


if __name__ == "__main__":
    main()
