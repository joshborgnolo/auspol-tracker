#!/usr/bin/env python3
"""data/act<yy>-seifa.json — ABS SEIFA scores per the ACT
Legislative Assembly division, the wa discipline on the TEC divisions'
own assignments.

The federal seats' SEIFA lane reads the division store's published-or-
derived scores. No publisher derives scores for this state's five electoral
divisions, so this derives them: the ABS SEIFA SA1 cube's four index
scores (IRSAD, IRSD, IER, IEO) population-weighted over each division's
SA1s — the ABS's own 2039.0 §2.2 recipe the federal division store uses —
on the SAME SA1→division assignment the people-lanes pipeline computed
(.build/map/act<YY>/assign-sa1.json per frame — a cache the demo run
writes; this script never re-derives the join, so a division's people
figures and its SEIFA scores always cover the same geography).

Scores, not re-compositing: a division's index score is the usual-resident-
population-weighted average of its SA1s' index scores, weighted only where
the cube publishes a score. An SA1 the cube gives no row — or a suppressed
score — drops out of that index only; a division whose joinable cube-
population share pools under W_OBS_MIN is a guard, never an estimate. The
four migratory/offshore sentinel SA1s sit outside the join, as in the
people lanes.

Deciles are ranked among the frame's own 25 divisions (rank_bands on the
weighted scores, equal-count bands 1 = least advantaged), the same
"ranked into tenths of the seats" the federal map's venue-level deciles
carry — not the ABS's national SA1 deciles.

Inputs (caches that already ride this repo's other pipelines):
  .matilda/seifa-irsad-abs/abs-seifa-2021-sa1-indexes.xlsx  (ABS 2033.0.55.001, SEIFA 2021 SA1 Table 1)
  .matilda/seifa-irsad-abs/abs-seifa-2016-sa1-indexes.xls   (the 2016 cube, SSE2/ooxml-legacy xls)
  .build/map/act<YY>/assign-sa1.json                         (the demo run's join cache)

Score columns are resolved by header title (the federal reader's rule: the
IRSD/IRSAD lead-column order swaps between editions, a positional read
misreads silently).

Guards fail loud. usage: python3 -I .build/map/build_act<yy>_seifa.py
  (act16 runs legacy-xlrd; drop the -I if xlrd lives in user-site)
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from act_geo import (FRAMES, EXPECTED_NAMES, ACT_SENTINELS,  # noqa: E402
                    load_assign_map, assign_path)

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

CUBES = {
    2021: {
        "path": os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2021-sa1-indexes.xlsx"),
        "kind": "xlsx", "code_len": 11, "rows": 59421, "act_rows": 1111,
        "product": "ABS 2033.0.55.001 SEIFA 2021, Statistical Area Level 1 indexes (Table 1)",
    },
    2016: {
        "path": os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2016-sa1-indexes.xls"),
        "kind": "xls", "code_len": 7, "rows": 55140, "act_rows": 1023,
        "product": "ABS 2033.0.55.001 SEIFA 2016, Statistical Area Level 1 indexes (Table 1)",
    },
}
IX = ["irsad", "irsd", "ier", "ieo"]
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
W_OBS_MIN = 0.90


def fail(msg):
    raise SystemExit(f"act-seifa: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _canon(t):
    return " ".join(str(t).upper().split())


def load_cube(year):
    """SA1 code -> {urp, ix: score|None}, NT rows, columns resolved by
    header title."""
    C = CUBES[year]
    if not os.path.exists(C["path"]):
        fail(f"missing SEIFA cube {C['path']}")
    if C["kind"] == "xlsx":
        import openpyxl
        wb = openpyxl.load_workbook(C["path"], read_only=True)
        if "Table 1" not in wb.sheetnames:
            fail(f"cube sheets {wb.sheetnames} lack 'Table 1'")
        rows = list(wb["Table 1"].iter_rows(values_only=True))
    else:
        import xlrd
        wb = xlrd.open_workbook(C["path"], on_demand=True)
        sh = wb.sheet_by_name("Table 1")
        rows = [sh.row_values(r) for r in range(sh.nrows)]
    title_i = next(i for i, r in enumerate(rows) if r and any(t and "INDEX OF" in _canon(t) for t in r))
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
    urp_col = next((i for i, t in enumerate(rows[title_i])
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
        if not (len(s) == C["code_len"] and s.isdigit()):
            continue
        nrows += 1
        if not s.startswith("8"):
            continue
        def cell(i):
            return row[i] if i < len(row) else None
        rec = {"urp": float(cell(urp_col)) if isinstance(cell(urp_col), (int, float)) else 0.0}
        for ix in IX:
            x = cell(cols[ix])
            rec[ix] = float(x) if isinstance(x, (int, float)) else None
        out[s] = rec
    if nrows != C["rows"]:
        fail(f"cube {year} code rows {nrows} != pin {C['rows']}")
    if len(out) != C["act_rows"]:
        fail(f"cube {year} TAS rows {len(out)} != pin {C['act_rows']}")
    suppressed = sum(1 for r in out.values() if any(r[ix] is None for ix in IX))
    print(f"cube {year} TAS: {len(out)} rows ({suppressed} carry a suppressed index score)")
    return out


def rank_bands(scores, k=10):
    srt = sorted(scores)
    n = len(srt)
    return [min(k, k * (srt.index(v)) // n + 1) for v in scores]


def seifa_main(frame):
    year = FRAMES[frame]
    cube = load_cube(year)
    assign = load_assign_map(frame)
    order = list(sorted(EXPECTED_NAMES[frame]))

    joined = [c for c in assign if c in cube]
    unscored = [c for c in assign if c not in cube]
    if unscored:
        print(f"unscored joined SA1s: {len(unscored)} (no cube row; dropped from weightings)")

    pool = {n: {ix: [0.0, 0.0] for ix in IX} for n in order}
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
            fail(f"{ix}: pooled state mean {statewide} != direct {dnum / dden}")
    st = {ix: round(sum(pool[n][ix][0] for n in order) / sum(pool[n][ix][1] for n in order), 1) for ix in IX}

    C = CUBES[year]
    ap = assign_path(frame)
    out = {
        "year": frame,
        "jurisdiction": "ACT",
        "censusYear": year,
        "method": ("Population-weighted (ABS 2039.0 §2.2): a division's index score is the "
                   "usual-resident-population-weighted average of its SA1s' cube scores, "
                   "weighted over the SA1s whose score the cube publishes. SA1 assignment is "
                   "the people-lanes join cache, one division per SA1."),
        "weights": "cube usual-resident population",
        "seifa": {n: seifa[n] for n in order},
        "state": st,
        "src": {
            "cube": {"path": os.path.relpath(C["path"], REPO), "sha16": hash16(C["path"]),
                     "product": C["product"]},
            "assignMap": {"path": os.path.relpath(ap, REPO), "sha16": hash16(ap)},
        },
        "about": (f"ABS SEIFA {year} SA1 index scores (IRSAD, IRSD, IER, IEO) pooled to "
                  "the Northern State's 25 Legislative Assembly electoral divisions, "
                  "usual-resident-population weighted per ABS 2039.0 §2.2 — the recipe "
                  "the federal division store used for its own editions, here on the "
                  "SA1→division assignment the frame's people lanes computed. Deciles "
                  "rank the 25 division scores into tenth-equal bands (1 = least "
                  "advantaged tenth of the 25); pct is the rank fraction used for "
                  "ordering. Suppressed SA1 scores drop out of their index only "
                  f"(observed-population floor {W_OBS_MIN:.0%})."),
    }
    out_path = os.path.join(REPO, "data", f"{frame}-seifa.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {out_path} ({os.path.getsize(out_path)} bytes); state means {st}")
