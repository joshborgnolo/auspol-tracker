#!/usr/bin/env python3
"""derive-division-seifa-interp.py — BETWEEN-CENSUS percentile interpolation
for the per-division SEIFA store (user directive 2026-10-24: "retain the
existing data observations for previous census values, but add an
interpolated percentile observation … used by default, and used in the flow
chart"). Emits .build/analysis/seat-model/seifa-src/div-interp.json, merged
into data/division-seifa-indexes.json by extract-division-seifa.mjs.

WHY PERCENTILES, NEVER RAW SCORES: ABS re-derives every SEIFA index per
census, so raw scores are not comparable across editions; within-chamber
ranks/deciles ARE the sanctioned cross-census currency. For an election
bracketed in time by censuses c0 < c1, each division's within-chamber
percentile rank is taken on BOTH sides and blended linearly by
census-night distance:

    pct     = rankDis/N        (rankDis 1 = MOST disadvantaged, in (0,1])
    f       = days(election - census_c0) / days(census_c1 - census_c0)
    pcti    = (1 - f) * pct(c0) + f * pct(c1)

The c0 side is ALWAYS the nearest-previous-census measured row set the
store already carries (the nearest-previous-census observation is part of
the interpolation: interpolating measured pct0 against a computed pct1
keeps the measured figure untouched). The c1 side is the NEW derivation:

  2013 (2013-09-07; CED 2011 edition; store c0 = absSa1Ced2011)
    c1 2016c — compose: weight of SA1_2016 unit u in CED C is
        sum_{v11 in C} CG_SA1_2011_SA1_2016.ratio(v,u) * urp2011(v),
      C membership from the committed 1270055003_ced_2011 allocation zip,
      South Australia re-cut to its Dec 2011 redistribution (di.ced_2013).
  2016 (2016-07-02; CED 2016 edition; store c1 = absSa1Ced2016)
    c0 2011c — direct: weight w_C(v11) = CG_SA1_2011_CED_2016.ratio(v,C)
        * urp2011(v) (the table ABS ships exactly for this geometry).
  2019 (2019-05-18; CED 2018 edition; store c0 = absSa1Ced2018)
    c1 2021c — compose: weight w_C(u21) = sum_{v16 in C}
        CG_SA1_2016_SA1_2021.RATIO_FROM_TO(v,u) * urp2016(v); C membership
      from the committed 1270055003_ced_2018 allocation zip. NOTE: the
      correspondence ratios are 2021-census-population based while these
      unit weights are 2016 counts — the mix can only misplace
      within-division 2016->2021 population shifts, which division grain
      absorbs; flagged in provenance as the "mixed-basis" lattice.

Values are 2039.0 §2.2 population-weighted means per division per index:
v(C) = sum(score * w) / sum(w), per index independently (units without a
score drop out of BOTH numerator and denominator for that index only).

Interpolable elections are the six bracketed-in-time ones: 2004, 2007,
2010, 2013, 2016, 2019. This build covers the CONCORDANCE lanes — 2013,
2016, 2019 —; the CD-era elections 2004/2007/2010 (c1 = 2006c/2011c
against 2003/2006/2009-edition CEDs) additionally need CED-edition
polygons, gated on map-api.aec.gov.au DNS recovery (outage 2026-10-23+),
and keep their oracle lanes (2006c x 2006ed vs APH RP09rp02; the
2011c x 2010-edition recon) with them — emitted placeholders for those
three elections say why, never fake values.

CG layout (verified 2026-10-24 against the staged files in
.matilda/seifa-irsad-abs/dl): ABS banner rows sit above the real header,
which is ALWAYS row 6 (0-index 5) on the correspondence sheet, data from
row 8; columns are FROM key (shipped twice), TO key (+ TO name on CED
files), RATIO, PERCENTAGE. The CG_SA1_2016_SA1_2021.csv sibling carries
SA1_MAINCODE_2016,SA1_CODE_2021,RATIO_FROM_TO,quality columns.

Hard gates (fail loudly):
  * lattice-derived division sets are NAME-EXACT vs
    data/division-classifications.json for their election;
  * full-precision score collisions hard-fail (same structural rule as
    the ABS lane's rank_and_round);
  * national population share per national decile on each new side stays
    within 10% +- 3.5 (gross census/edition-swap catcher — wider than the
    ABS lane's 2pt band because mixed-basis/composed lattices legitimately
    reshape the population a point or two further);
  * gross means sanity per index per side as in the ABS lane (mean
    940..1060, values 700..1400);
  * measured-side pct read-back is rank-structural: pct0/pct1 of the
    measured side is rankDis/N of the committed store, asserted integral
    (this script never re-derives the measured side).

Run from the repo root:
    python3 .build/analysis/seat-model/derive-division-seifa-interp.py
Requires xlrd (the CG CED xls era) and openpyxl.
"""

import collections
import csv
import datetime
import importlib.util
import json
import math

import openpyxl

HERE = __file__.rsplit("/seat-model/", 1)[0] + "/seat-model"
PROJ = HERE.rsplit("/.build/", 1)[0]
ABS_CACHE = f"{PROJ}/.matilda/seifa-irsad-abs"
DL = f"{ABS_CACHE}/dl"
OUT_JSON = f"{HERE}/seifa-src/div-interp.json"
STORE_JSON = f"{PROJ}/data/division-seifa-indexes.json"
CLASS_JSON = f"{PROJ}/data/division-classifications.json"


def _load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


di = _load_mod("derive_irsad", f"{PROJ}/.build/analysis/seifa-index/derive-irsad.py")
ablane = _load_mod("derive_division_seifa_abs",
                   f"{HERE}/derive-division-seifa-abs.py")

IDX = ["irsd", "irsad", "ier", "ieo"]   # interp covers all four indexes

CENSUS_NIGHT = {2001: datetime.date(2001, 8, 7),
                2006: datetime.date(2006, 8, 8),
                2011: datetime.date(2011, 8, 9),
                2016: datetime.date(2016, 8, 9),
                2021: datetime.date(2021, 8, 10)}

ELECTIONS = {
    "2013": {"date": datetime.date(2013, 9, 7), "c0": 2011, "c1": 2016},
    "2016": {"date": datetime.date(2016, 7, 2), "c0": 2011, "c1": 2016},
    "2019": {"date": datetime.date(2019, 5, 18), "c0": 2016, "c1": 2021},
}

PENDING_POLYGONS = {
    "2004": "c1 = 2006 census x 2003-edition CEDs — needs the 2003 "
            "redistribution polygons (map-api.aec.gov.au DNS outage, watch running)",
    "2007": "c1 = 2011 census x 2006-edition CEDs — needs the 2006 "
            "redistribution polygons (same outage)",
    "2010": "c1 = 2011 census x 2009-edition CEDs — needs the 2010 "
            "boundary-set polygons (same outage)",
}


def r6(x):
    """Half-up 6dp rounding — the store's percentile rounding rule, shared
    verbatim with the test suites (Math.round in JS is half-up on positive
    x; Python's round() is banker's, which diverges on near-ties). pcti is
    always computed FROM the r6-rounded emitted pct0/pct1/f below, so the
    file itself re-derives its pcti to the last decimal."""
    return math.floor(x * 1e6 + 0.5) / 1e6


def interp_f(day, c0_year, c1_year):
    num = (day - CENSUS_NIGHT[c0_year]).days
    den = (CENSUS_NIGHT[c1_year] - CENSUS_NIGHT[c0_year]).days
    return r6(num / den)


# ----------------------------------------------------------------- CG reads

def _key(v):
    if v in (None, ""):
        return None
    if isinstance(v, float):
        if not v.is_integer():
            return None
        v = int(v)
    return str(v)


def read_cg_xlsx(path, sheet, from_col, to_col, ratio_col):
    """Workbook correspondence sheet -> {from_key: [(to_key, ratio)]}.
    ABS banner layout: real header row 6, data from row 8. Ratio-only —
    CED names for the direct lanes come from the committed store joins'
    classification blocks, and division names below are the CG file's own
    name column when supplied."""
    wb = openpyxl.load_workbook(path, read_only=True)
    sh = wb[sheet]
    out = {}
    for row in sh.iter_rows(values_only=True, min_row=8):
        if len(row) <= max(from_col, to_col, ratio_col):
            continue
        fk, tk, r = _key(row[from_col]), _key(row[to_col]), row[ratio_col]
        if fk is None or tk is None or not isinstance(r, (int, float)) or r <= 0:
            continue
        out.setdefault(fk, []).append((tk, float(r)))
    print(f"cg {path.rsplit('/', 1)[-1]}:{sheet} -> {len(out)} from-keys, "
          f"{sum(len(v) for v in out.values())} links")
    return out


def read_cg_csv_16_21(path):
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            raw = row["RATIO_FROM_TO"].strip()
            if not raw:
                continue  # BMOS null rows carry no routed population
            r = float(raw)
            if r > 0:
                out.setdefault(row["SA1_MAINCODE_2016"], []).append(
                    (row["SA1_CODE_2021"], r))
    print(f"cg {path.rsplit('/', 1)[-1]} -> {len(out)} from-keys, "
          f"{sum(len(v) for v in out.values())} links")
    return out


# --------------------------------------------------------- lattice engines

def compose(cg, ced_alloc, cube_to, pop_of_from, tag):
    """Two-product chain: FROM units v -> TO units u (CG), v's CED target C
    (allocation). Returns links {u: [(ced_code, routed_pop)]} where
    routed_pop = sum_{v in C} ratio(v,u) * pop(v)."""
    links = collections.defaultdict(dict)
    for v, lst in cg.items():
        tgt = ced_alloc.get(v)
        p = pop_of_from.get(v, 0.0)
        if tgt is None or di.PSEUDO.search(tgt[1]) or p <= 0:
            continue
        code, _name = tgt
        for (u, r) in lst:
            if u not in cube_to:
                continue
            d = links[u]
            d[code] = d.get(code, 0.0) + r * p
    print(f"  {tag}: {len(links)} to-units routed into "
          f"{len({c for d in links.values() for c in d})} CED codes")
    return links


def direct(cg, pop_of_from):
    """Direct CG (v already carries its CED code): links
    {v: [(ced_code, ratio)]} multiplied by pop(v) downstream."""
    return {v: lst for v, lst in cg.items() if v in pop_of_from}


def weighted_means(scores_of, pop_of, links, tag):
    """Per (ced_code) and index: sum(score*w)/sum(w) with w = unit_pop *
    multiplier. unit_pop comes from pop_of(unit); compose lanes carry the
    routed population in the multiplier and pop_of(unit) = 1. Returns
    (means {code: {idx: float}}, decile pop-shares sanity payload,
    dropped counters)."""
    accum = {idx: collections.defaultdict(lambda: [0.0, 0.0]) for idx in IDX}
    dec_pops = {idx: collections.defaultdict(lambda: [0.0] * 10) for idx in IDX}
    dropped = collections.Counter()
    for unit, lst in links.items():
        base = pop_of(unit)
        if base <= 0 or not lst:
            continue
        rec = scores_of(unit)
        if rec is None:
            dropped["unscored_units"] += 1
            continue
        for (code, mult) in lst:
            w = base * mult
            if w <= 0:
                continue
            for idx in IDX:
                sc, dec = rec[idx]
                if sc is None:
                    dropped[f"{idx}_unscored"] += 1
                    continue
                a = accum[idx][code]
                a[0] += sc * w
                a[1] += w
                if dec is not None:
                    d = int(dec) - 1
                    if 0 <= d <= 9:
                        dec_pops[idx][code][d] += w
    means = collections.defaultdict(dict)
    for idx in IDX:
        for code, (s, w) in accum[idx].items():
            if w > 0:
                means[code][idx] = s / w
    for code, vals in means.items():
        missing = [i for i in IDX if i not in vals]
        assert not missing, f"{tag}: CED {code} unscored for {missing}"
    if dropped:
        print(f"  {tag}: unscored-unit drops {dict(dropped)}")
    return means, dec_pops


def national_decile_sanity(tag, dec_pops, band=3.5):
    for idx in IDX:
        nat = [sum(v[i] for v in dec_pops[idx].values()) for i in range(10)]
        tot = sum(nat)
        assert tot > 0, f"{tag}:{idx} no decile population at all"
        shares = [x / tot * 100 for x in nat]
        assert all(10 - band < x < 10 + band for x in shares), \
            f"{tag}:{idx} decile shares {[round(s, 2) for s in shares]} beyond 10%±{band}"
        print(f"  sanity {tag}:{idx}: decile pops {[round(s, 1) for s in shares]}")


def gross_shape(tag, means, names_for):
    for idx in IDX:
        vals = [v[idx] for v in means.values()]
        mn = sum(vals) / len(vals)
        assert 940 < mn < 1060, f"{tag}:{idx} mean {mn:.1f} outside 940..1060"
        assert all(700 < v < 1400 for v in vals), \
            f"{tag}:{idx} score outside 700..1400 at " \
            f"{[(names_for(k), round(v[idx],1)) for k,v in means.items() if not 700<v[idx]<1400][:3]}"


def rank_pct(values, tag):
    """{code: score} full-precision -> {code: pct} where pct = rankDis/N,
    rankDis 1 = MOST disadvantaged ascending score. Collisions hard-fail."""
    ordered = sorted(values.items(), key=lambda kv: kv[1])
    seen = {}
    for k, v in ordered:
        assert v not in seen, \
            f"{tag}: full-precision collision {v} ({seen.get(v)} vs {k})"
        seen[v] = k
    n = len(ordered)
    return {k: rk / n for rk, (k, _v) in enumerate(ordered, start=1)}


def measured_pct(store_blk, idx):
    n = len(store_blk)
    out = {}
    for name, cell in store_blk.items():
        rd = cell[idx]["rankDis"] if idx == "irsad" else cell[idx]["rank"]
        assert isinstance(rd, int) and 1 <= rd <= n, \
            f"measured pct: {idx} rank {rd!r} outside 1..{n}"
        out[name] = rd / n
    return out


# --------------------------------------------------------------- assembly

def ced_code_rows(means, names_by_code, klass_year, tag):
    """Lattice codes -> AEC division names, joined NAME-EXACT against the
    election's classification block (fails on drift before any emit)."""
    out = {}
    for code, vals in means.items():
        sc = str(code)
        nm = ablane.MC_NORM.get(names_by_code.get(sc, ""),
                                names_by_code.get(sc, ""))
        assert nm, f"{tag}: no CED name for code {code}"
        assert nm not in out, f"{tag}: duplicate CED name {nm}"
        out[nm] = vals
    ablane.name_join(tag, out, klass_year)
    assert len(out) == len(means)
    return out


def election_block(year, pct0_map, pct1_map, f, names0, names1, klass_year, tag):
    """Per division per index: {pct0, pct1, pcti}. names* map CED code ->
    division name for the computed side(s) — None for a measured side
    (keys already division names there)."""
    divs = sorted(set(pct0_map[IDX[0]]))
    n = len(divs)
    out = {}
    for div in divs:
        cell = {}
        for idx in IDX:
            p0r = r6(pct0_map[idx][div])
            p1r = r6(pct1_map[idx][div])
            cell[idx] = {"pct0": p0r, "pct1": p1r,
                         "pcti": r6((1 - f) * p0r + f * p1r)}
        out[div] = cell
    return out, n


def main():
    klass = json.load(open(CLASS_JSON))["elections"]
    store = json.load(open(STORE_JSON))["elections"]

    cube11 = ablane.load_seifa_cube(2011)
    cube16 = ablane.load_seifa_cube(2016)
    cube21 = ablane.load_seifa_cube(2021)
    bridge11 = di.load_mb_sa1_keys(2011)             # maincode2011 -> 7digit key
    # maincode2011 -> (code, name): CED_2011 with SA re-cut to the 2013
    # election's boundaries (di.ced_2013, 2026-10-25)
    ced11_alloc = di.ced_2013(di.load_ced_csv_zip("2011", 2011))
    ced18_alloc = di.load_ced_csv_zip("2018", 2018)  # maincode2016 -> (code, name)

    urp11 = {m: cube11[bridge11[m]]["urp"] for m in bridge11
             if cube11.get(bridge11[m]) and cube11[bridge11[m]]["urp"] > 0}
    urp16 = {m: rec["urp"] for m, rec in cube16.items() if rec["urp"] > 0}

    def scores11(m):
        return cube11.get(bridge11.get(m))

    # ------------------------------------------------ 2013 c1 — composed 2016c
    cg_11_16 = read_cg_xlsx(f"{DL}/CG_SA1_2011_SA1_2016.xlsx", "Table 3", 0, 2, 4)
    links_13c1 = compose(cg_11_16, ced11_alloc, cube16, urp11, "e2013c1 lattice")
    means_13c1, dec_13c1 = weighted_means(cube16.get, lambda _u: 1.0,
                                          {u: [(c, m) for c, m in tgt.items()]
                                           for u, tgt in links_13c1.items()},
                                          "e2013c1")
    national_decile_sanity("e2013c1", dec_13c1)
    # lattice codes take their names straight from the allocation table
    nm13 = {str(v[0]): v[1] for v in ced11_alloc.values()}
    rows13c1 = ced_code_rows(means_13c1, nm13, klass["2013"], "e2013c1")
    gross_shape("e2013c1", rows13c1, lambda k: k)
    pct_13c1 = {idx: rank_pct({d: vals[idx] for d, vals in rows13c1.items()}, "e2013c1")
                for idx in IDX}

    # ------------------------------------------------ 2016 c0 — direct CG to CED 2016
    cg_11_c16 = read_cg_xlsx(f"{DL}/CG_SA1_2011_CED_2016.xlsx", "Table 3", 0, 2, 4)
    links_16c0 = direct(cg_11_c16, urp11)
    means_16c0, dec_16c0 = weighted_means(scores11, lambda u: urp11.get(u, 0.0),
                                          links_16c0, "e2016c0")
    national_decile_sanity("e2016c0", dec_16c0)
    nm16 = nm16_from_cg(f"{DL}/CG_SA1_2011_CED_2016.xlsx", "Table 3", 2, 3)
    rows16c0 = ced_code_rows(means_16c0, nm16, klass["2016"], "e2016c0")
    gross_shape("e2016c0", rows16c0, lambda k: k)
    pct_16c0 = {idx: rank_pct({d: vals[idx] for d, vals in rows16c0.items()}, "e2016c0")
                for idx in IDX}

    # ------------------------------------------------ 2019 c1 — composed 2021c
    cg_16_21 = read_cg_csv_16_21(f"{DL}/CG_SA1_2016_SA1_2021.csv")
    links_19c1 = compose(cg_16_21, ced18_alloc, cube21, urp16, "e2019c1 lattice")
    means_19c1, dec_19c1 = weighted_means(cube21.get, lambda _u: 1.0,
                                          {u: [(c, m) for c, m in tgt.items()]
                                           for u, tgt in links_19c1.items()},
                                          "e2019c1")
    national_decile_sanity("e2019c1", dec_19c1)
    nm19 = {str(v[0]): v[1] for v in ced18_alloc.values()}
    rows19c1 = ced_code_rows(means_19c1, nm19, klass["2019"], "e2019c1")
    gross_shape("e2019c1", rows19c1, lambda k: k)
    pct_19c1 = {idx: rank_pct({d: vals[idx] for d, vals in rows19c1.items()}, "e2019c1")
                for idx in IDX}

    # ------------------------------------------------ measured sides (from the store)
    pct_13c0 = {idx: measured_pct(store["2013"], idx) for idx in IDX}
    pct_16c1 = {idx: measured_pct(store["2016"], idx) for idx in IDX}
    pct_19c0 = {idx: measured_pct(store["2019"], idx) for idx in IDX}

    # ------------------------------------------------ assemble + emit
    f13 = interp_f(ELECTIONS["2013"]["date"], 2011, 2016)
    f16 = interp_f(ELECTIONS["2016"]["date"], 2011, 2016)
    f19 = interp_f(ELECTIONS["2019"]["date"], 2016, 2021)
    elections, sizes = {}, {}
    blk, n = election_block("2013", pct_13c0, pct_13c1, f13, None, None,
                            klass["2013"], "e2013")
    elections["2013"], sizes["2013"] = blk, n
    blk, n = election_block("2016", pct_16c0, pct_16c1, f16, None, None,
                            klass["2016"], "e2016")
    elections["2016"], sizes["2016"] = blk, n
    blk, n = election_block("2019", pct_19c0, pct_19c1, f19, None, None,
                            klass["2019"], "e2019")
    elections["2019"], sizes["2019"] = blk, n

    assert sizes == {"2013": 150, "2016": 150, "2019": 151}, \
        f"division counts {sizes} — expected 150/150/151"

    # rank-delta logging: pcti vs the store's measured pct — the movement
    # the interpolation proposes, surfaced so the tests (and a reviewer)
    # can pin the shape. Median and top-3 movers per election per index.
    for y, side_measured in (("2013", pct_13c0), ("2016", pct_16c1),
                             ("2019", pct_19c0)):
        for idx in IDX:
            deltas = sorted(
                ((abs(elections[y][d][idx]["pcti"] - side_measured[idx][d]), d)
                 for d in elections[y]), reverse=True)
            med = sorted(d for d, _ in deltas)[len(deltas) // 2]
            top = [f"{d} {v:.4f}" for v, d in deltas[:3]]
            print(f"  delta {y}:{idx} pcti-vs-measured median {med:.4f}, "
                  f"top {', '.join(top)}")

    f_desc = lambda y: round(interp_f(ELECTIONS[y]["date"],
                                      ELECTIONS[y]["c0"], ELECTIONS[y]["c1"]), 6)
    doc = {
        "_about": {
            "summary": "Between-census percentile interpolation of per-division "
                       "SEIFA standing. pct(idx) = within-chamber percentile rank "
                       "(rankDis/N, 1/N = most disadvantaged) computed on each "
                       "bracketing census' own geometry, blended by census-night "
                       "distance, pcti = (1-f)*pct0 + f*pct1. The c0 side is the "
                       "measured store row (read back, never re-derived); the c1 "
                       "side is the new concordance lattice. Measured-only "
                       "elections (2001/2022/2025) carry no pcti. Regenerate: "
                       "python3 .build/analysis/seat-model/derive-division-seifa-interp.py",
            "percentile": "rankDis/N — 1/N = MOST disadvantaged, N/N = most ",
            "censusNights": {str(y): CENSUS_NIGHT[y].isoformat()
                              for y in (2011, 2016, 2021)},
        },
        "_pending": {"elections": PENDING_POLYGONS},
        "_provenance": {
            "e2013c1": {"title": "SA1 2016 SEIFA cube composed into CED_2011 via "
                                 "CG_SA1_2011_SA1_2016 x CG ratios weighted by "
                                 "urp2011, CED membership 1270055003_ced_2011"},
            "e2016c0": {"title": "SA1 2011 SEIFA cube mapped direct via "
                                 "CG_SA1_2011_CED_2016 ratios weighted by urp2011"},
            "e2019c1": {"title": "SA1 2021 SEIFA cube composed into CED_2018 via "
                                 "CG_SA1_2016_SA1_2021 x CG ratios weighted by "
                                 "urp2016 (mixed-basis lattice — 2021-census ratios "
                                 "on 2016 census counts; division grain absorbs it)",
                        "files": ["CG_SA1_2016_SA1_2021.csv", "1270055003_ced_2018"]},
        },
        "factors": {
            "2013": {"date": "2013-09-07", "c0": 2011, "c1": 2016, "f": f_desc("2013")},
            "2016": {"date": "2016-07-02", "c0": 2011, "c1": 2016, "f": f_desc("2016")},
            "2019": {"date": "2019-05-18", "c0": 2016, "c1": 2021, "f": f_desc("2019")},
        },
        "elections": elections,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")
    print(f"emitted {OUT_JSON}: " +
          ", ".join(f"{y}={len(blk)} divs x {len(IDX)} idx" for y, blk in
                    sorted(elections.items())))


def nm16_from_cg(path, sheet, to_col, name_col):
    """CED code -> CED name map lifted straight off the direct CG file's
    name column (row layout as read_cg_xlsx)."""
    wb = openpyxl.load_workbook(path, read_only=True)
    sh = wb[sheet]
    out = {}
    for row in sh.iter_rows(values_only=True, min_row=8):
        if len(row) <= name_col:
            continue
        code, nm = _key(row[to_col]), row[name_col]
        if code and nm:
            out.setdefault(code, str(nm).strip())
    return out


if __name__ == "__main__":
    main()
