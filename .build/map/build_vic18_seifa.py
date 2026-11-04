#!/usr/bin/env python3
"""data/vic18-seifa.json — ABS SEIFA 2016 per Vic district for the vic18 map.

The build_vic22_seifa.py recipe on the 2016 cube (the vic18 frame's census
vintage): no publisher derives scores for Victoria's state districts, so
this derives them — the ABS SEIFA 2016 SA1 cube's four index scores
(IRSAD, IRSD, IER, IEO) usual-resident-population-weighted over each
district's SA1s (the ABS's own 2039.0 §2.2 recipe), on the SAME
SA1→district assignment the people-lanes pipeline computed
(.build/map/vic13/assign-sa1-2016.json, a cache build_vic18_demo.py
writes; this script never re-derives the join, so a district's census
people figures and its SEIFA scores always cover the same geography).

Scores, not re-compositing: an SA1 the cube gives no row — or a suppressed
score — drops out of that index only; a district whose joinable cube-
population share pools under W_OBS_MIN is a guard, never an estimate. The
four migratory/offshore sentinel SA1s carry no shape and sit outside the
join, as in the people lanes.

Deciles are ranked among the frame's own 88 district scores (rank_bands on
the weighted scores, equal-count bands 1 = least advantaged), the federal
map's convention — not the ABS's national SA1 deciles.

Inputs (caches that already ride this repo's other pipelines):
  .matilda/seifa-irsad-abs/abs-seifa-2016-sa1-indexes.xls (ABS 2033.0.55.001,
        SEIFA 2016 SA1 Table 1 — the 7-digit-code column joins the GCP's;
        score columns resolved by header title, the federal reader's rule:
        the IRSD/IRSAD lead-column order swaps between editions and the
        2016 cube leads IRSD)
  .build/map/vic13/assign-sa1-2016.json  (the demo run's join cache)

Guards fail loud. usage: python3 .build/map/build_vic18_seifa.py
(no -I: xlrd is a user-site package of this machine and -I hides user site)
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vic13_geo import EXPECTED_NAMES, VINTAGES, load_assign_map

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2016
CUBE_XLS = os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2016-sa1-indexes.xls")
OUT = os.path.join(REPO, "data", "vic18-seifa.json")

IX = ["irsad", "irsd", "ier", "ieo"]
# derive-division-seifa-abs.py's own canon: each index's score column is
# the column whose printed title names the index (a decile column follows)
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
#: cube row-set pins, counted from the committed cube 2026-11-04 (Table 1
#: carries one row per 2016 SA1 the ABS scores)
CUBE_ROWS = 55140
CUBE_VIC_ROWS = 13652
CUBE_CODE_LEN = 7
W_OBS_MIN = 0.90
CUBE_PRODUCT = ("ABS 2033.0.55.001 SEIFA 2016, Statistical Area Level 1 "
                "indexes (Table 1)")


def fail(msg):
    raise SystemExit(f"vic18-seifa: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _canon(t):
    return " ".join(str(t).upper().split())


# ------------------------------------------------------------------ the cube
def load_cube():
    """SA1 code -> {urp, ix: score|None} for Victoria's rows, columns
    resolved by header title."""
    import xlrd
    if not os.path.exists(CUBE_XLS):
        fail(f"missing SEIFA cube {CUBE_XLS} (see docstring)")
    wb = xlrd.open_workbook(CUBE_XLS, on_demand=True)
    if "Table 1" not in wb.sheet_names():
        fail(f"cube sheets {wb.sheet_names()} lack 'Table 1'")
    sh = wb.sheet_by_name("Table 1")
    rows = [sh.row_values(r) for r in range(sh.nrows)]
    wb.release_resources()
    title_i = next(i for i, r in enumerate(rows)
                   if r and any(t and "INDEX OF" in _canon(t) for t in r))
    title_row = [_canon(t) if t is not None else "" for t in rows[title_i]]
    sub_row = rows[title_i + 1] if len(rows) > title_i + 1 else []
    cols = {}
    for ix, wanted in INDEX_TITLES.items():
        for i, t in enumerate(title_row):
            if t and any(w in t for w in wanted):
                cols[ix] = i
                break
        if ix not in cols:
            fail(f"cube header drift: no column titles {wanted!r}")
    urp_col = next((i for i, t in enumerate(title_row)
                    if t and "USUAL RESIDENT POPULATION" in _canon(t)), None)
    if urp_col is None:
        urp_col = next((i for i, t in enumerate(sub_row)
                        if t and "POPULATION" in _canon(t)), None)
    if urp_col is None:
        fail("cube lacks a usual-resident-population column")

    out, nrows = {}, 0
    for row in rows[title_i + 1:]:
        if not row:
            continue
        v = row[0]
        if isinstance(v, float):
            v = int(v)
        s = str(v) if v is not None else ""
        if not (len(s) == CUBE_CODE_LEN and s.isdigit()):
            continue
        nrows += 1
        if not s.startswith("2"):
            continue

        def cell(i):
            return row[i] if i < len(row) else None
        rec = {"urp": float(cell(urp_col)) if isinstance(cell(urp_col), (int, float)) else 0.0}
        for ix in IX:
            x = cell(cols[ix])
            rec[ix] = float(x) if isinstance(x, (int, float)) else None
        out[s] = rec
    if nrows != CUBE_ROWS:
        fail(f"cube code rows {nrows} != pin {CUBE_ROWS}")
    if len(out) != CUBE_VIC_ROWS:
        fail(f"cube Vic rows {len(out)} != pin {CUBE_VIC_ROWS}")
    suppressed = sum(1 for r in out.values() if any(r[ix] is None for ix in IX))
    print(f"cube Vic: {len(out)} rows ({suppressed} carry a suppressed index score)")
    return out


# ------------------------------------------------------------------ pool
def rank_bands(scores, k=10):
    """Equal-count bands 1..k over sorted values (ties ride together):
    1 = least advantaged."""
    srt = sorted(scores)
    n = len(srt)
    return [min(k, k * (srt.index(v)) // n + 1) for v in scores]


def main():
    cube = load_cube()
    assign = load_assign_map(YEAR)

    order = list(EXPECTED_NAMES)

    joined = [c for c in assign if c in cube]
    # a joined SA1 with no cube row is UNSCORED (the ABS gives no row for an
    # SA1 it could not score) — it drops out of the index weightings exactly
    # as a suppressed score would
    unscored = [c for c in assign if c not in cube]
    if unscored:
        print(f"unscored joined SA1s: {len(unscored)} (no cube row; dropped from weightings)")

    # pool: per district, per index, a urp-weighted average of SA1 scores over
    # the SA1s whose score the cube publishes for that index
    pool = {n: {ix: [0.0, 0.0] for ix in IX} for n in order}   # ix -> [Σ w·s, Σ w over published]
    poptot = {n: 0.0 for n in order}
    for code, dist in assign.items():
        r = cube.get(code)
        if r is None:
            continue
        poptot[dist] += r["urp"]
        for ix in IX:
            if r[ix] is not None:
                pool[dist][ix][0] += r[ix] * r["urp"]
                pool[dist][ix][1] += r["urp"]
    cells = {}
    worst = ("", 1.0)
    for dist in order:
        cells[dist] = {}
        for ix in IX:
            sw, w = pool[dist][ix]
            tot = poptot[dist]
            if tot <= 0:
                fail(f"{dist}: no cube population over its SA1s")
            obs = w / tot
            if obs < worst[1]:
                worst = (f"{dist}:{ix}", obs)
            if obs < W_OBS_MIN:
                fail(f"{dist}: {ix} observed across only {100 * obs:.1f}% of joined population — cannot derive")
            cells[dist][ix] = round(sw / w, 1)
    print(f"observed share: minimum {100 * worst[1]:.2f}% joined population ({worst[0]})")

    # deciles among the frame's own 88 scores; pct the rank fraction
    decs = {ix: rank_bands([cells[n][ix] for n in order]) for ix in IX}
    seifa = {}
    srts = {ix: sorted(cells[n][ix] for n in order) for ix in IX}
    for i, dist in enumerate(order):
        row = {}
        for ix in IX:
            row[ix] = {"v": cells[dist][ix],
                       "pct": round((srts[ix].index(cells[dist][ix]) + 1) / len(order), 4),
                       "dec": decs[ix][i]}
        seifa[dist] = row

    # reconciliation: the state-level population-weighted mean of district
    # scores must equal the cube's own Vic mean over joined SA1s (weights
    # redistribute identically — an identity check, not a close-enough one)
    for ix in IX:
        num = sum(pool[n][ix][0] for n in order)
        den = sum(pool[n][ix][1] for n in order)
        statewide = num / den
        direct = [(cube[c][ix], cube[c]["urp"]) for c in joined]
        dnum = sum(s * w for s, w in direct if s is not None)
        dden = sum(w for s, w in direct if s is not None)
        if abs(statewide - dnum / dden) > 1e-6:
            fail(f"{ix}: pooled statewide mean {statewide} != direct {dnum / dden}")

    st = {}
    for ix in IX:
        num = sum(pool[n][ix][0] for n in order)
        den = sum(pool[n][ix][1] for n in order)
        st[ix] = round(num / den, 1)

    out = {
        "year": "vic18",
        "jurisdiction": "VIC",
        "censusYear": YEAR,
        "method": ("Population-weighted (ABS 2039.0 §2.2): a district's index score is the "
                   "usual-resident-population-weighted average of its SA1s' cube scores, "
                   "weighted over the SA1s whose score the cube publishes. SA1 assignment is "
                   "the people-lanes join cache, one district per SA1."),
        "weights": "cube usual-resident population",
        "seifa": {n: seifa[n] for n in order},
        "state": st,
        "src": {
            "cube": {"path": os.path.relpath(CUBE_XLS, REPO), "sha16": hash16(CUBE_XLS),
                     "product": CUBE_PRODUCT},
            "assignMap": {"path": os.path.relpath(VINTAGES[YEAR]["assign"], REPO),
                          "sha16": hash16(VINTAGES[YEAR]["assign"])},
        },
        "about": ("ABS SEIFA 2016 SA1 index scores (IRSAD, IRSD, IER, IEO) pooled to "
                  "Victoria's 88 state electoral districts for the 24 November 2018 "
                  "election, usual-resident-population weighted per ABS 2039.0 §2.2 — the "
                  "recipe the federal division store used at the 2016 edition, here "
                  "on the SA1→district assignment the vic18 people lanes computed. Deciles "
                  "rank the 88 district scores into tenth-equal bands (1 = least "
                  "advantaged tenth of the 88); pct is the rank fraction used for "
                  "ordering. Suppressed SA1 scores drop out of their index only "
                  f"(observed-population floor {W_OBS_MIN:.0%})."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes); state means {st}")


main()
