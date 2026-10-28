#!/usr/bin/env python3
"""seifa-src/cd-2001-ced-2001set.json — the 2001 census collection
districts allocated whole to the divisions the 2001 federal election
was fought on.

Sibling of derive-cd-2001-ced-alloc.py (that one allocated the same
2001 CDs to the 2003-edition set for the 2004 people-interp lane). The
/map/ 2001 federal frame needs the SAME membership on the same census
units against the 2001-election division set: the measured 2001-census
people store pools its 2001 BCP counts over this map
(derive-booth-demo-2001-frame.py → data/booth-demo-2001.json). No ABS
CD-2001 → 2001-edition concordance exists either, so the method is
identical: whole-unit allocation by majority of a 6x6 grid sample of
the unit's inside-points.

The division polygon set is the gpkg's own
Commonwealth_Electoral_Division_2001 layer — the exact source
extract-asgc2001-ced.py renders the frame's n-2001.geojson from, so
the seat-sum membership can never disagree with the boundary the map
draws (157 rows = 150 divisions + 7 shape-less ABS "Off-Shore,
Shipping and Migratory" pseudo rows, excluded exactly as the boundary
extract excludes them).

The machinery (allocate / gate_era / emit) is derive-ced-era-alloc.py's
via importlib, the CD units and the population/score oracles are
derive-cd-2001-ced-alloc.py's own (the BCP tally + the SEIFA-2001
cube). Run:
  python3 .build/analysis/seat-model/derive-cd-2001-ced-2001set.py
"""

import importlib.util
import json
import sqlite3
import struct
from array import array
from pathlib import Path

SM = Path(__file__).resolve().parent

def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


era = _lib("alloc_era", "derive-ced-era-alloc.py")
lane = _lib("lane2003", "derive-cd-2001-ced-alloc.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail = era.fail

OUT = SM / "seifa-src" / "cd-2001-ced-2001set.json"
GPKG = hist.DL / "asgc2001.gpkg"
EXCL = "Off-Shore, Shipping and Migratory"


def _wkb_multi(blob):
    """gpkg SHAPE blob -> list of polygons, each a list of flat
    [x1,y1,...] rings. Same parse as hist._geo_cd2001's nested reader."""
    if blob is None:
        return None
    if blob[:2] != b"GP":
        fail("gpkg: bad blob magic")
    env = (blob[3] >> 1) & 7
    off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    if blob[off] != 1:
        fail("gpkg: big-endian WKB")
    t = struct.unpack_from("<I", blob, off + 1)[0]
    off += 5

    def polygon(o):
        if blob[o] != 1 or struct.unpack_from("<I", blob, o + 1)[0] != 3:
            fail("gpkg: polygon part broken")
        (nr,) = struct.unpack_from("<I", blob, o + 5)
        o += 9
        rings = []
        for _ in range(nr):
            (n,) = struct.unpack_from("<I", blob, o)
            o += 4
            pts = array("d", struct.unpack_from(f"<{n * 2}d", blob, o))
            o += 16 * n
            rings.append(pts)
        return rings, o

    if t == 3:
        rings, _ = polygon(off)
        return [rings]
    if t == 6:
        (npol,) = struct.unpack_from("<I", blob, off)
        off += 4
        polys = []
        for _ in range(npol):
            rings, off = polygon(off)
            polys.append(rings)
        return polys
    fail(f"gpkg: WKB type {t}")


def divs_ced2001():
    """the gpkg's electoral layer -> {division_name: (box, flat rings)}
    in the shape era.allocate() expects; the ABS Mc-casing normalised to
    the classification store's (era.MC_NORM — the same map the era lanes
    use)."""
    print("reading CED 2001 electoral polygons (gpkg) ...")
    conn = sqlite3.connect(str(GPKG))
    rows = conn.execute("SELECT CED_NAME_2001, SHAPE FROM "
                        "Commonwealth_Electoral_Division_2001").fetchall()
    conn.close()
    assert len(rows) == 157, len(rows)
    divs = {}
    for name, blob in rows:
        if name == EXCL:
            continue  # ABS census-scaffold pseudo rows, never divisions
        polys = _wkb_multi(blob)
        assert polys, f"{name}: no geometry"
        name = era.MC_NORM.get(name, name)
        box = [1e9, 1e9, -1e9, -1e9]
        flat = []
        for rings in polys:
            for r in rings:
                flat.append(r)
                for i in range(0, len(r), 2):
                    x, y = r[i], r[i + 1]
                    if x < box[0]: box[0] = x
                    if y < box[1]: box[1] = y
                    if x > box[2]: box[2] = x
                    if y > box[3]: box[3] = y
        assert name not in divs, f"{name}: two electoral features"
        divs[name] = (box, flat)
    assert len(divs) == 150, len(divs)
    print(f"  ced2001set: {len(divs)} divisions")
    return divs


def main():
    divs = divs_ced2001()
    units, null_geo = lane.units_cd2001()
    alloc, split, fb, un = era.allocate(units, divs, "cd01 -> ced2001set")

    # the offshore contract, verbatim the 2003ed lane's: unplaced units
    # are legal ONLY as the ABS offshore-migratory balance class (which
    # can carry population — division-less by ABS's own filing) or a
    # profile-free registry pseudo (no BCP profile AND no SEIFA cube row)
    tally = json.loads(lane.TALLY.read_text())["tally"]
    cube = hist.cube_cd2001(hist.DL / "seifa2001-aus.zip")
    conn = sqlite3.connect(str(GPKG))
    sla = {c: s or "" for c, s in conn.execute(
        "SELECT CD_CODE_2001, SLA_NAME_2001 FROM "
        "Census_Collection_District_2001")}
    conn.close()
    offshore = "Off-Shore Areas & Migratory"
    oscodes = [u for u in un if sla.get(u) == offshore]
    pseudo = [u for u in un if sla.get(u) != offshore]
    wrong = [u for u in pseudo
             if tally.get(u) is not None or u in cube]
    if wrong:
        fail(f"cd01 -> ced2001set: {len(wrong)} unplaced units are "
             f"neither the ABS offshore-migratory class nor "
             f"profile-free pseudos: "
             f"{[(u, sla.get(u), (tally.get(u) or {}).get('pers')) for u in wrong[:4]]}")
    off_pop = sum((tally.get(u) or {}).get("pers") or 0 for u in oscodes)
    print(f"  cd01 -> ced2001set: {len(oscodes)} unplaced units all the "
          f"ABS '{offshore}' balance class ({off_pop:,} people "
          "understood division-less by ABS's own filing), "
          f"{len(pseudo)} profile-free registry pseudo codes (no BCP "
          "profile, no SEIFA cube row — population-free by both "
          "oracles)")
    era.gate_era("cd01 -> ced2001set", alloc, "2001")

    # era-drift digest against the 2003ed sibling: how many CDs the 2003
    # redistributions moved off this 2001-era membership (log only — the
    # two sets are SUPPOSED to differ: Gwydir out, Bonner in, etc.)
    lane03 = json.loads(lane.OUT.read_text())
    if lane03.get("unit") == "CD_CODE_2001":
        moved = sum(1 for k, v in alloc.items()
                    if k in lane03["alloc"] and lane03["alloc"][k] is not None
                    and lane03["alloc"][k] != v)
        # same-name divisions only: a CD "moving to Bonner" counts anyway
        print(f"  drift vs cd-2001-ced-2003ed.json: {moved} CDs carry a "
              "different 2001-era membership")

    era.emit(str(OUT), {
        "_about": "2001 census collection districts (CD_CODE_2001, ABS "
                  "asgc2001.gpkg's Census_Collection_District_2001 layer) "
                  "allocated whole to the divisions the 2001 federal "
                  "election was fought on (the same gpkg's own "
                  "Commonwealth_Electoral_Division_2001 layer — the exact "
                  "polygons extract-asgc2001-ced.py renders the /map/ "
                  "frame's n-2001.geojson from) by majority of a 6x6 grid "
                  "sample — the seat-sum membership the 2001 election's "
                  "measured census-people store pools its 2001 BCP counts "
                  "over (derive-booth-demo-2001-frame.py). No ABS CD-2001 "
                  "-> 2001-edition concordance exists; sibling of "
                  "cd-2001-ced-2003ed.json's lane (the 2004 election's "
                  "set). Island/spillover minorities outside every era "
                  "polygon are legal only as the ABS 'Off-Shore Areas & "
                  "Migratory' balance SLA (see offshoreClass) — people in "
                  "them are division-less by ABS's own filing. Generated "
                  "by derive-cd-2001-ced-2001set.py, machinery shared "
                  "with derive-ced-era-alloc.py and "
                  "derive-cd-2001-ced-alloc.py.",
        "unit": "CD_CODE_2001", "divisions": sorted(set(alloc.values())),
        "unitCount": len(units), "placed": len(alloc), "split": split,
        "fallback": fb, "unplacedUnscored": sorted(un),
        "offshoreClass": {"offshoreMigratory": {
                              "name": offshore, "units": len(oscodes),
                              "population": off_pop,
                              "note": "ABS 'Off-Shore Areas & Migratory' "
                                      "balance bucket — division-less "
                                      "by ABS's own filing; dropped from "
                                      "the division sums, kept in the "
                                      "universe counts"},
                          "profileFreePseudo": {
                              "units": len(pseudo),
                              "note": "ASGC-2001 registry codes no census "
                                      "product ever profiles (no BCP "
                                      "profile, no SEIFA 2001 cube row — "
                                      "population-free pseudo units)"}},
        "alloc": dict(sorted(alloc.items()))})


if __name__ == "__main__":
    main()
