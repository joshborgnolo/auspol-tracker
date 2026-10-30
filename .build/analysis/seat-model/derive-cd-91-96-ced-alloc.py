#!/usr/bin/env python3
"""seifa-src/cd-{1991,1996,2001}-ced-{1993,1996,1998}set.json — the
1991, 1996 and 2001 census collection districts allocated whole to the
division sets the 1993, 1996 and 1998 federal elections were fought
on — the seat-sum memberships the '90s people-interp lane's c0/c1
stores pool their census counts over (derive-booth-demo-{1993,1996,
1998}.py / -c1).

Sibling of derive-cd-2001-ced-alloc.py (the 2004 lane). Its method is
identical — whole-unit allocation of each CD by majority of a 6x6
6x6 6x6 grid-sample of the unit's inside-points, group-plurality
rescue for units that carry no division majority — the machinery is
derive-ced-era-alloc.py's via importlib exactly as the 2004 lane rides
it; the new thing here is only the inputs:

  ERA DIVISION SETS — the map's own published era frames, the
  Parliamentary Handbook historical polygons as committed by
  handbook_geo.mjs (Tim Sherratt's
  wragge/historical-federal-electorate-boundaries repo, rev
  fb76072cfa5e — see .build/map/README-history.md; regenerated on disk
  by `node .build/map/handbook_geo.mjs --fetch`):
    .matilda/handbook-boundaries/n-1993-handbook.geojson  (147, CC
        BY-NC-ND 4.0 — research-only inputs, never re-published by this
        pipeline)
    .matilda/handbook-boundaries/n-1996-handbook.geojson  (148)
    .matilda/handbook-boundaries/n-1998-handbook.geojson  (148)
  The ABS ASGC CED layers are NOT this arc's era set: the asgc1996
  vintage carries post-1997 WA geometry in its own CED frame
  (extract-asgc1996-ced.py's header warning, README-history.md's
  Collie-outside-Brand defect). The handbooks are what the map shows.

  CD POLYGONS — the same census-era gpkgs the SEIFA lanes read:
    .matilda/seifa-irsad-abs/dl/asgc/asgc1991.gpkg
        (census_collection_district_1991, 31,410 rows = 31,315 polygons
        + 95 null-spatial registry pseudos)
    .matilda/seifa-irsad-abs/dl/asgc/asgc1996.gpkg
        (census_collection_district_1996, 34,500 rows = 34,405
        polygons + 95 null-spatial offshore rows)
    .matilda/seifa-irsad-abs/dl/asgc/asgc2001.gpkg
        (Census_Collection_District_2001 — hist._geo_cd2001's own
        loader, 37,116 polygons + 93 null-spatial offshore rows)

OFFSHORE CONTRACT (per census, its own ABS-filed balance classes):
  1991 — SLA 'Off-Shore Areas and Migratory' (national single class);
  1996 — SLA 'Off-Shore Areas & Migratory - <state>' (seven per-state
         classes) plus the census-scaffold fold-ins 'Incl. in Fraser -
         ACT 802' (Jervis Bay Territory) and 'Incl. in Northern
         Territory 701' (Christmas/Cocos external territories) —
         people with no division by ABS's own filing, named with
         populations in each file's offshoreClass record and dropped
         from the seat sums;
  2001 — as derive-cd-2001-ced-alloc.py's own contract.
Any unplaced unit outside those classes must be a profile-free
registry pseudo (population-free per the census tally) — anything
else fails loud.

NAME GATE: each emitted alloc's division-name set is joined NAME-EXACT
against data/division-results.json's certified block for the election
(the AEC's own DIVS.TXT) — a 147/148/148-set equality check, no
drifting label can pass.

Run:  python3 .build/analysis/seat-model/derive-cd-91-96-ced-alloc.py
"""

import importlib.util
import json
import re
import sqlite3
import struct
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"

def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


era = _lib("alloc_era", "derive-ced-era-alloc.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail = era.fail

HANDBOOK = ROOT / ".matilda/handbook-boundaries"
DL = ROOT / ".matilda/seifa-irsad-abs/dl"
RESULTS = ROOT / "data/division-results.json"

# the six lanes this arc runs: (census, era-set, out-file)
LANES = (
    (1991, 1993, SM / "seifa-src/cd-1991-ced-1993set.json"),
    (1991, 1996, SM / "seifa-src/cd-1991-ced-1996set.json"),
    (1996, 1993, SM / "seifa-src/cd-1996-ced-1993set.json"),
    (1996, 1996, SM / "seifa-src/cd-1996-ced-1996set.json"),
    (1996, 1998, SM / "seifa-src/cd-1996-ced-1998set.json"),
    (2001, 1998, SM / "seifa-src/cd-2001-ced-1998set.json"),
)

EXPECTED_FEATURES = {1993: 147, 1996: 148, 1998: 148}
UNIT_LABEL = {1991: "CD_CODE_1991", 1996: "CD_CODE_1996",
              2001: "CD_CODE_2001"}
# per-census ABS-filed balance classes legal to leave unplaced:
# (SLA prefix, CED-name prefix) pairs — plus the census's own official
# CD->CED assignment read as the LAST rescue tier before the class
# gate (the era's Lord Howe/fold-in cases: the handbook frames stop at
# the coastline, so Lord Howe Island — ABS-filed to Sydney — genuinely
# sits outside every era polygon; the gpkg CD table's own census-era
# CED_NAME column is the ABS's own official assignment, adopted only
# when the assigned name itself belongs to the lane's certified era
# set, named in each file's absAssigned block).
OFFSHORE = {
    1991: {"sla": ("Off-Shore Areas and Migratory",), "ced": ()},
    1996: {"sla": ("Off-Shore Areas & Migratory",),
           "ced": ("Incl. in Fraser", "Incl. in Northern Territory")},
    2001: {"sla": ("Off-Shore Areas & Migratory",), "ced": ()},
}
TALLY = {1991: SM / "cache/bcp-1991-aurin-tally.json",
         1996: SM / "cache/bcp-1996-aurin-tally.json",
         2001: SM / "cache/bcp-2001-cd-tally.json"}
# official assignments that name a division the census-era era set
# its own doesn't carry (census-era eras land INSIDE the election
# era the ALLOC lane targets): per-(census, era) substitution of the
# ABS-filed official name — only ever read for the still-unplaced
# coastline cases, where the ABS's own era-era answer is the analogue
# of its 1996-era fold-in conventions ('Incl. in Northern Territory'
# for the external territories at the 1998 frame)
ERA_SUBST = {
    (2001, 1998): {"Lingiari": "Northern Territory",
                   "Solomon": "Northern Territory"},
}


# ------------------------------------------------------- era geometry

def era_divisions(year):
    """handbook geojson -> {name: (box, rings)} — rings flattened to
    the sa2013.Banded contract (interleaved x,y arrays)."""
    p = HANDBOOK / f"n-{year}-handbook.geojson"
    if not p.exists():
        fail(f"missing {p} — regenerate with "
             f"`node .build/map/handbook_geo.mjs --fetch`")
    feats = json.loads(p.read_text())["features"]
    if len(feats) != EXPECTED_FEATURES[year]:
        fail(f"handbook {year}: {len(feats)} features != "
             f"{EXPECTED_FEATURES[year]} (regenerate)")
    out = {}
    for f in feats:
        name = f["properties"]["name"]
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" \
            else [g["coordinates"]]
        rings = []
        box = [1e9, 1e9, -1e9, -1e9]
        for poly in polys:
            for ring in poly:
                r = array("d")
                for pt in ring:
                    x, y = pt[0], pt[1]
                    r.extend((x, y))
                    if x < box[0]: box[0] = x
                    if y < box[1]: box[1] = y
                    if x > box[2]: box[2] = x
                    if y > box[3]: box[3] = y
                rings.append(r)
        if name in out:
            fail(f"handbook {year}: duplicate division {name}")
        out[name] = (box, rings)
    print(f"ced{year}set: {len(out)} handbook divisions")
    return out


# ------------------------------------------------------- census units

def _wkb(b):
    """gpkg blob -> [rings ...] (hist's own reader shape, tiny fork for
    the snake-case 91/96 tables)."""
    if b is None:
        return None
    if b[:2] != b"GP":
        fail("gpkg: bad blob magic")
    env = (b[3] >> 1) & 7
    off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    if b[off] != 1:
        fail("gpkg: big-endian WKB")
    t = struct.unpack_from("<I", b, off + 1)[0]
    off += 5

    def polygon(o):
        if b[o] != 1 or struct.unpack_from("<I", b, o + 1)[0] != 3:
            fail("gpkg: polygon part broken")
        (nr,) = struct.unpack_from("<I", b, o + 5)
        o += 9
        rings = []
        for _ in range(nr):
            (n,) = struct.unpack_from("<I", b, o)
            o += 4
            pts = array("d", struct.unpack_from(f"<{n * 2}d", b, o))
            o += 16 * n
            rings.append(pts)
        return rings, o

    if t == 3:
        rings, _ = polygon(off)
        return [rings]
    if t == 6:
        (npol,) = struct.unpack_from("<I", b, off)
        off += 4
        polys = []
        for _ in range(npol):
            rings, off = polygon(off)
            polys.append(rings)
        return polys
    fail(f"gpkg: WKB type {t}")


def units_cd_aurin(year):
    """({cd: (sla, (box, rings))}, null-code list, {cd: (sla, ced)}
    labels) from the asgc gpkg's snake-case CD layer (1991/1996
    vintage)."""
    gpkg = DL / f"asgc/asgc{year}.gpkg"
    if not gpkg.exists():
        fail(f"missing {gpkg}")
    conn = sqlite3.connect(str(gpkg))
    tab = f"census_collection_district_{year}"
    exp_rows = {1991: 31410, 1996: 34500}[year]
    n_rows = conn.execute(f"SELECT COUNT(*) FROM {tab}").fetchone()[0]
    if n_rows != exp_rows:
        fail(f"{tab}: {n_rows} records != {exp_rows} (wrong edition?)")
    units, nulls, labels = {}, [], {}
    for code, sla, ced, blob in conn.execute(
            f"SELECT CD_CODE_{year}, SLA_NAME_{year}, CED_NAME_{year}, "
            f"shape FROM {tab}"):
        labels[code] = (sla or "", ced or "")
        if blob is None:
            nulls.append((code, sla or "", ced or ""))
            continue
        rings_by_poly = _wkb(blob)
        box = [1e9, 1e9, -1e9, -1e9]
        flat = []
        for rings in rings_by_poly:
            for r in rings:
                flat.append(r)
                for i in range(0, len(r), 2):
                    x, y = r[i], r[i + 1]
                    if x < box[0]: box[0] = x
                    if y < box[1]: box[1] = y
                    if x > box[2]: box[2] = x
                    if y > box[3]: box[3] = y
        units[code] = (sla or "", (box, flat))
    conn.close()
    if len(units) != n_rows - 95:
        fail(f"{year}: polygons {len(units)} != {n_rows} - 95 "
             f"(null-spatial profile drift: {len(nulls)})")
    if len(set(units)) != len(units):
        fail(f"{year}: duplicate CD codes")
    for c in units:
        if len(c) != 7 or not c.isdigit() \
                or c[0] not in hist.STE_OF_DIGIT:
            fail(f"{year}: odd CD code {c!r}")
    print(f"cd{year}: {len(units)} polygons, {len(nulls)} null-spatial")
    return units, nulls, labels


def units_cd2001():
    """hist's own 2001 loader, restated in the alloc-units shape.
    null list as (code, sla, "") triples matching units_cd_aurin."""
    polys, null_geo = hist._geo_cd2001(DL / "asgc2001.gpkg")
    conn = sqlite3.connect(str(DL / "asgc2001.gpkg"))
    meta = {c: (s or "", d or "") for c, s, d in conn.execute(
        "SELECT CD_CODE_2001, SLA_NAME_2001, CED_NAME_2001 FROM "
        "Census_Collection_District_2001")}
    conn.close()
    units = {code: (meta.get(code, ("", ""))[0], (list(box), rings))
             for code, box, rings in polys}
    labels = dict(meta)
    nulls = [(c, meta.get(c, ("", ""))[0], "") for c in sorted(null_geo)]
    print(f"cd2001: {len(units)} polygons, {len(nulls)} null-spatial")
    return units, nulls, labels


# ------------------------------------------------------- gates

def certified_names(year):
    return set(json.loads(RESULTS.read_text())["elections"][str(year)])


def gate_unplaced(census, era_year, un, units_meta):
    """Offshore-contract gate: unplaced units must all sit in the
    census's ABS-filed balance classes; everything else must be a
    registry pseudo with no census profile. units_meta: cd -> (sla,
    ced) label pairs."""
    tally = json.loads(TALLY[census].read_text())["tally"]
    spec = OFFSHORE[census]
    legal, wrong = [], []
    for u in un:
        sla, ced = units_meta[u]
        if any(sla.startswith(p) for p in spec["sla"]) or any(
                ced.startswith(p) for p in spec["ced"]):
            legal.append((u, "offshore"))
        elif ((tally.get(u) or {}).get("pers") or 0) == 0:
            legal.append((u, "profile-free"))
        else:
            wrong.append((u, sla, ced,
                          (tally.get(u) or {}).get("pers")))
    if wrong:
        fail(f"cd{census} -> ced{era_year}set: {len(wrong)} unplaced "
             f"units are neither ABS balance classes nor profile-free "
             f"pseudos: {wrong[:6]}")
    off = [u for u, k in legal if k == "offshore"]
    free = [u for u, k in legal if k == "profile-free"]
    off_cls = {}
    for u in off:
        sla, ced = units_meta[u]
        key = (f"Migratory/Off-shore scaffold: {ced}" if ced and any(
                ced.startswith(p) for p in spec["ced"])
               else sla)
        rec = off_cls.setdefault(key, {"units": 0, "population": 0})
        rec["units"] += 1
        rec["population"] += (tally.get(u) or {}).get("pers") or 0
    print(f"  cd{census} -> ced{era_year}set: {len(off)} unplaced in "
          f"{len(off_cls)} ABS balance classes ({sum(r['population'] for r in off_cls.values()):,} "
          f"people division-less by ABS's own filing), {len(free)} "
          f"profile-free registry pseudos")
    return off_cls


# ------------------------------------------------------- main

def main():
    certified = {y: certified_names(y) for y in EXPECTED_FEATURES}
    eras = {y: era_divisions(y) for y in EXPECTED_FEATURES}
    print(f"certified: 1993/1996/1998 = "
          + "/".join(str(len(certified[y])) for y in EXPECTED_FEATURES))
    units911, nulls91, labels91 = units_cd_aurin(1991)
    units961, nulls96, labels96 = units_cd_aurin(1996)
    units001, nulls01, labels01 = units_cd2001()
    units_map = {1991: (units911, nulls91, labels91),
                 1996: (units961, nulls96, labels96),
                 2001: (units001, nulls01, labels01)}

    for census, era_year, out_path in LANES:
        units, nulls, labels = units_map[census]
        divs = eras[era_year]
        alloc, split, fb, un = era.allocate(
            {k: (m[0], m[1]) for k, m in units.items()}, divs,
            f"cd{census} -> ced{era_year}set")
        # ABS-official CD->CED assignment rescue tier: the still-
        # unplaced shape-units (coastline stops on Lord Howe's island
        # and its kin) adopt the census gpkg's own census-era CED_NAME
        # assignment, but only when that name itself sits in this
        # lane's certified era set
        abs_assigned = []
        still = []
        want = certified[era_year]
        subst = ERA_SUBST.get((census, era_year), {})
        for u in un:
            assigned = (labels.get(u) or ("", ""))[1].strip()
            if re.match(r"^Incl\. in (.+?) - ", assigned):
                assigned = re.match(r"^Incl\. in (.+?) - ",
                                    assigned).group(1).strip()
            assigned = subst.get(assigned, assigned)
            if assigned and assigned in want:
                alloc[u] = assigned
                abs_assigned.append(u)
                print(f"  cd{census} -> ced{era_year}set: {u} adopts "
                      f"ABS-filed assignment {assigned!r} (era-ISO "
                      "rounds: handbook frames stop at the coastline)")
            else:
                still.append(u)
        if abs_assigned:
            print(f"  cd{census} -> ced{era_year}set: "
                  f"{len(abs_assigned)} units adopted the census-era "
                  f"ABS CD->CED assignment as the official outside-"
                  f"polygon tier: {abs_assigned}")
        # the alloc's name set must be the certified election set,
        # exactly
        want = certified[era_year]
        got = set(alloc.values())
        if got != want:
            fail(f"cd{census} -> ced{era_year}set: division-name set "
                 f"drift (alloc-only {sorted(got - want)[:6]}, "
                 f"certified-only {sorted(want - got)[:6]})")
        # unplaced = the alloc's leftover units after the ABS-
        # assignment tier, plus this census's null-spatial units
        # (never given to the allocator)
        null_codes = [n[0] for n in nulls]
        off_cls = gate_unplaced(
            census, era_year, still + null_codes, labels)
        doc = {
            "_about": (f"{census} census collection districts "
                       f"({UNIT_LABEL[census]}, ABS asgc{census}.gpkg) "
                       f"allocated whole to the divisions in force at "
                       f"the {era_year} federal election — the map's "
                       f"own published era set, the Parliamentary "
                       f"Handbook historical polygons "
                       f"(.matilda/handbook-boundaries/n-{era_year}"
                       f"-handbook.geojson via handbook_geo.mjs; "
                       f"wragge/historical-federal-electorate-boundaries"
                       f" rev fb76072cfa5e, research-use inputs) — by "
                       f"majority of a 6x6 grid-sample, the same "
                       f"machinery as derive-cd-2001-ced-alloc.py's "
                       f"2004 lane (machinery shared with "
                       f"derive-ced-era-alloc.py). The membership the "
                       f"{era_year} census-people lane pools this "
                       f"census's counts over "
                       f"(derive-booth-demo-{{…}}.py). No ABS "
                       f"CD-{census} -> election-era concordance "
                       f"exists for this period; the ABS ASGC "
                       f"{era_year}-adjacent CED frame itself carries "
                       f"post-redistribution geometry (README-history"
                       f".md). Units outside every era polygon are "
                       f"legal only as ABS-filed balance classes "
                       f"(offshoreClass) or population-free registry "
                       f"pseudos."),
            "unit": UNIT_LABEL[census],
            "divisions": sorted(set(alloc.values())),
            "unitCount": len(units) + len(nulls),
            "placed": len(alloc), "split": split, "fallback": fb,
            "absAssigned": sorted(abs_assigned),
            "unplacedUnscored": sorted(still),
            "nullSpatial": sorted(n[0] for n in nulls),
            "offshoreClass": off_cls,
            "alloc": dict(sorted(alloc.items())),
        }
        era.emit(str(out_path), doc)


if __name__ == "__main__":
    main()
