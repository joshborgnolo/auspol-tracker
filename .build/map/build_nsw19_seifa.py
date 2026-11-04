#!/usr/bin/env python3
"""data/nsw19-seifa.json — ABS SEIFA 2016 per NSW district for the nsw19
map frame.

The build_nsw23_seifa.py recipe verbatim on the 2016 census vintage: the
ABS SEIFA 2016 SA1 cube's four index scores (IRSAD, IRSD, IER, IEO)
usual-resident-population-weighted over each district's SA1s — the ABS's
own 2039.0 §2.2 recipe the federal division store uses at its own
editions — on the SAME SA1→district assignment the people-lanes pipeline
computed (.build/map/nsw13/assign-sa1-2016.json, the cache nsw13_geo.py
writes and build_nsw19_demo.py rides; this script never re-derives the
join, so a district's census people figures and its SEIFA scores always
cover the same geography). The four migratory/offshore sentinel SA1s
carry no shape and sit outside the join, as in the people lanes.

Deciles are ranked among the frame's own 93 district scores (rank_bands
on the weighted scores, equal-count bands 1 = least advantaged), the
same "ranked into tenths of the seats" the federal map's venue-level
deciles carry — not the ABS's national SA1 deciles.

Inputs (both caches already ride this repo's other pipelines):
  .matilda/seifa-irsad-abs/abs-seifa-2016-sa1-indexes.xls   (ABS 2033.0.55.001,
       SEIFA 2016 SA1 Table 1 — legacy .xls; read with the qld17 frame's
       own conventions: 7-digit SA1 codes, the title row resolved by
       header text since the IRSD/IRSAD lead order swaps between
       editions)
  .build/map/nsw13/assign-sa1-2016.json   (18,395 SA1 -> district)

Score columns are resolved by header title (the federal reader's rule:
the IRSD/IRSAD lead-column order swaps between editions, a positional
read misreads silently). Guards fail loud.

usage: python3 .build/map/build_nsw19_seifa.py   (no -I: xlrd is a
  user-site package of this machine and -I hides user site)
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw13_geo import EXPECTED_NAMES, VINTAGES, load_assign_map  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2016
CUBE_XLS = os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2016-sa1-indexes.xls")
OUT = os.path.join(REPO, "data", "nsw19-seifa.json")

IX = ["irsad", "irsd", "ier", "ieo"]
# derive-division-seifa-abs.py's own canon: each index's score column is
# the column whose printed title names the index (a decile column
# follows); IEO's title drifted between editions
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
#: cube row-set pins (national/NSW), measured 2026-11-04 from the
#: committed pack: an SA1 the cube could not score carries NO row;
#: NSW rows with any suppressed score are logged by the load, never
#: estimated
CUBE_CODE_ROWS = 55140
CUBE_NSW_ROWS = 17648
CUBE_CODE_LEN = 7
W_OBS_MIN = 0.90
SEIFA_PRODUCT = ("ABS 2033.0.55.001 SEIFA 2016, Statistical Area Level 1 "
                 "indexes (Table 1)")


def fail(msg):
    raise SystemExit(f"nsw19-seifa: {msg}")


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
    """SA1 code -> {urp, ix: score|None} for New South Wales's rows,
    columns resolved by header title."""
    if not os.path.exists(CUBE_XLS):
        fail(f"missing SEIFA cube {CUBE_XLS} (see docstring refetch)")
    try:
        import xlrd
    except ImportError:
        fail("needs xlrd (user-site on this machine; run without -I "
             "like qld17's SEIFA builder)")
    wb = xlrd.open_workbook(CUBE_XLS, on_demand=True)
    if "Table 1" not in wb.sheet_names():
        fail(f"cube sheets {wb.sheet_names()} lack 'Table 1'")
    sh = wb.sheet_by_name("Table 1")
    probe_rows = [sh.row_values(r) for r in range(min(8, sh.nrows))]
    title_i = next((i for i, r in enumerate(probe_rows)
                    if any("INDEX OF" in _canon(t) for t in r if t)), None)
    if title_i is None:
        fail("cube lacks a title row naming an index")
    title_row = [_canon(t) if t is not None else "" for t in
                 sh.row_values(title_i)]
    sub_row = [_canon(t) if t is not None else "" for t in
               sh.row_values(title_i + 1)]
    cols = {}
    for ix, wanted in INDEX_TITLES.items():
        for i, t in enumerate(title_row):
            if t and any(w in t for w in wanted):
                cols[ix] = i
                break
        if ix not in cols:
            fail(f"cube header drift: no column titled {wanted!r} — {title_row!r}")
    urp_col = next((i for i, t in enumerate(title_row)
                    if "USUAL RESIDENT POPULATION" in t), None)
    if urp_col is None:
        urp_col = next((i for i, t in enumerate(sub_row)
                        if "POPULATION" in t), None)
    if urp_col is None:
        fail("cube lacks a usual-resident-population column")

    out, nrows = {}, 0
    for r in range(title_i + 1, sh.nrows):
        v = sh.cell_value(r, 0)
        if isinstance(v, float):
            v = int(v)
        s = str(v).strip() if v is not None else ""
        if not (len(s) == CUBE_CODE_LEN and s.isdigit()):
            continue
        nrows += 1
        if not s.startswith("1"):
            continue
        row = sh.row_values(r)

        def cell(i):
            return row[i] if i < len(row) else None
        rec = {"urp": float(cell(urp_col)) if isinstance(cell(urp_col), (int, float)) else 0.0}
        for ix in IX:
            x = cell(cols[ix])
            rec[ix] = float(x) if isinstance(x, (int, float)) else None
        out[s] = rec
    wb.release_resources()
    if nrows != CUBE_CODE_ROWS:
        fail(f"cube Table 1 code rows {nrows} != pin {CUBE_CODE_ROWS}")
    if len(out) != CUBE_NSW_ROWS:
        fail(f"cube NSW rows {len(out)} != pin {CUBE_NSW_ROWS}")
    suppressed = sum(1 for r in out.values() if any(r[ix] is None for ix in IX))
    print(f"cube {YEAR} NSW: {len(out)} rows ({suppressed} carry a "
          f"suppressed index score)")
    return out


# ------------------------------------------------------------------ pool
def rank_bands(scores, k=10):
    """Equal-count bands 1..k over sorted values (ties ride together),
    the federal decile_of's convention: 1 = least advantaged."""
    srt = sorted(scores)
    n = len(srt)
    return [min(k, k * (srt.index(v)) // n + 1) for v in scores]


def main():
    cube = load_cube()
    assign = load_assign_map(YEAR)

    order = list(EXPECTED_NAMES)
    if len(order) != 93:
        fail("nsw13_geo.EXPECTED_NAMES drifted")

    joined = [c for c in assign if c in cube]
    # a joined SA1 with no cube row is UNSCORED (the ABS gives no row for
    # an SA1 it could not score) — it drops out of the index weightings
    # exactly as a suppressed score would, the federal derive_weighted's
    # convention
    unscored = [c for c in assign if c not in cube]
    if unscored:
        print(f"unscored joined SA1s: {len(unscored)} (no cube row; "
              f"dropped from weightings)")

    # pool: per district, per index, a urp-weighted average of SA1 scores
    # over the SA1s whose score the cube publishes for that index
    pool = {n: {ix: [0.0, 0.0] for ix in IX} for n in order}  # ix -> [Σ w·s, Σ w over published]
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

    # deciles among the frame's own 93 scores; pct the rank fraction (the
    # sort key the federal cells carry)
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

    # ---------- reconciliation: the state-level population-weighted mean
    # of district scores must sit at the cube's own NSW mean over joined
    # SA1s (weights redistribute identically — an identity, not a
    # close-enough one)
    for ix in IX:
        num = sum(pool[n][ix][0] for n in order)
        den = sum(pool[n][ix][1] for n in order)
        if den <= 0:
            fail(f"{ix}: zero joined weight")
        statewide = num / den
        direct = [(cube[c][ix], cube[c]["urp"]) for c in joined]
        dnum = sum(s * w for s, w in direct if s is not None)
        dden = sum(w for s, w in direct if s is not None)
        if abs(statewide - dnum / dden) > 1e-6:
            fail(f"{ix}: pooled statewide mean {statewide} != direct {dnum / dden}")

    st = {ix: round(sum(pool[n][ix][0] for n in order) /
                    sum(pool[n][ix][1] for n in order), 1) for ix in IX}

    out = {
        "year": "nsw19",
        "jurisdiction": "NSW",
        "censusYear": 2016,
        "method": ("Population-weighted (ABS 2039.0 §2.2): a district's index score is the "
                   "usual-resident-population-weighted average of its SA1s' cube scores, "
                   "weighted over the SA1s whose score the cube publishes. SA1 assignment is "
                   "the people-lanes join cache, one district per SA1."),
        "weights": "cube usual-resident population",
        "seifa": {n: seifa[n] for n in order},
        "state": st,
        "src": {
            "cube": {"path": os.path.relpath(CUBE_XLS, REPO), "sha16": hash16(CUBE_XLS),
                     "product": SEIFA_PRODUCT},
            "assignMap": {"path": os.path.relpath(VINTAGES[YEAR]["assign"], REPO),
                          "sha16": hash16(VINTAGES[YEAR]["assign"])},
        },
        "about": ("ABS SEIFA 2016 SA1 index scores (IRSAD, IRSD, IER, IEO) pooled to New South "
                  "Wales's 93 state electoral districts for the 23 March 2019 election, "
                  "usual-resident-population weighted per ABS 2039.0 §2.2 — the recipe the "
                  "federal division store used for its own editions, here on the "
                  "SA1→district assignment the nsw19 people lanes computed. Deciles rank the "
                  "93 district scores into tenth-equal bands (1 = least advantaged tenth of "
                  "the 93); pct is the rank fraction used for ordering. Suppressed SA1 "
                  "scores drop out of their index only (observed-population floor "
                  f"{W_OBS_MIN:.0%})."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes); state means {st}")


main()
