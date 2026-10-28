#!/usr/bin/env python3
"""seifa-src/cd-2001-ced-2003ed.json — the 2001 census collection
districts allocated whole to the divisions in force at the 2004
federal election.

Sibling of derive-ced-era-alloc.py's 2004 lane (that one allocated the
2006 CDs for derive-division-seifa-interp.py's e2004c1 lane). The
people-interp 2004 lane needs the SAME membership on the 2001 census
CDs — the c0 side of the 2004 census-people store pools its 2001 BCP
counts over this map (derive-booth-demo-2001.py). No ABS CD-2001 to
2003-edition concordance exists either, so the same method applies:
whole-unit allocation by majority of a 6x6 grid sample of the unit's
inside-points, polygons from
.matilda/seifa-irsad-abs/dl/asgc2001.gpkg's Census_Collection_District_2001
layer, era polygons from the AEC's "Election 2003 boundary set" zip
(COM20040430_elb.zip), units' grouping carried by the gpkg's LGA.

The machinery (read_era_divisions / allocate / gate_era / emit) is
derive-ced-era-alloc.py's via importlib, the CD polygons and the
population/score availability gate ride derive-booth-seifa-hist.py's
geo and seifa-cube loaders, and the population oracle is the 2001 BCP
tally itself (cache/bcp-2001-cd-tally.json, extract-bcp-2001-tally.py):
every unplaced unit must carry zero population in the BCP tally AND no
SEIFA 2001 cube row. Run:
  python3 .build/analysis/seat-model/derive-cd-2001-ced-alloc.py
"""

import importlib.util
import json
import sqlite3
from pathlib import Path

SM = Path(__file__).resolve().parent

def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


era = _lib("alloc_era", "derive-ced-era-alloc.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail = era.fail

OUT = SM / "seifa-src" / "cd-2001-ced-2003ed.json"
TALLY = SM / "cache/bcp-2001-cd-tally.json"


def units_cd2001():
    """the gpkg's CD polygons -> {CD_CODE_2001: (sla-group, poly)}; the
    SLA name is the rescue group the group-plurality taxonomy rides
    (the ASGC 2001 Statistical Local Area), null-spatial units ride the
    null list exactly like the seifa lane"""
    print("reading CD 2001 units + SLAs (gpkg) ...")
    conn = sqlite3.connect(str(hist.DL / "asgc2001.gpkg"))
    sla = {c: s or "" for c, s in conn.execute(
        "SELECT CD_CODE_2001, SLA_NAME_2001 FROM "
        "Census_Collection_District_2001")}
    conn.close()
    polys, null_geo = hist._geo_cd2001(
        hist.DL / "asgc2001.gpkg")
    # the gpkg universe (37k units) runs ahead of the SEIFA-2001 cube
    # (35,695 rows); the population/score gate is exactly the check
    # that the extra units carry nothing
    out = {}
    for code, box, rings in polys:
        out[code] = (sla.get(code, ""), (list(box), rings))
    for code in null_geo:
        out[code] = (sla.get(code, ""), None)
    print(f"  cd01: {len(out)} units ({len(null_geo)} null-spatial)")
    return out, null_geo


def main():
    divs = era.read_era_divisions()["ced2003ed"]
    print(f"ced2003ed: {len(divs)} divisions")
    units, null_geo = units_cd2001()
    alloc, split, fb, un = era.allocate(units, divs, "cd01 -> ced2003ed")

    # the offshore contract: unplaced units are legal ONLY when the ABS
    # filed them in its own "Off-Shore Areas & Migratory" balance SLA —
    # the pre-ASGS pseudo class the GCP-era lanes also drop at the
    # division level. They can carry population (oil-rig crews, the
    # shipping count) — people with no division by ABS's own balance
    # filing, dropped from the seat sums and named in counts
    tally = json.loads(TALLY.read_text())["tally"]
    cube = hist.cube_cd2001(hist.DL / "seifa2001-aus.zip")  # the
    # quantile-recipe assertions inside re-verify the seifa-2001
    # universe on the way past, and its row set gates the pseudo class
    conn = sqlite3.connect(str(hist.DL / "asgc2001.gpkg"))
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
        fail(f"cd01 -> ced2003ed: {len(wrong)} unplaced units are "
             f"neither the ABS offshore-migratory class nor "
             f"profile-free pseudos: "
             f"{[(u, sla.get(u), (tally.get(u) or {}).get('pers')) for u in wrong[:4]]}")
    off_pop = sum((tally.get(u) or {}).get("pers") or 0 for u in oscodes)
    print(f"  cd01 -> ced2003ed: {len(oscodes)} unplaced units all the "
          f"ABS '{offshore}' balance class ({off_pop:,} people "
          "understood division-less by ABS's own filing), "
          f"{len(pseudo)} profile-free registry pseudo codes (no BCP "
          "profile, no SEIFA cube row — population-free by both "
          "oracles)")
    era.gate_era("cd01 -> ced2003ed", alloc, "2004")

    era.emit(str(OUT), {
        "_about": "2001 census collection districts (CD_CODE_2001, ABS "
                  "asgc2001.gpkg's Census_Collection_District_2001 layer) "
                  "allocated whole to the divisions in force at the 2004 "
                  "federal election (the AEC's 'Election 2003 boundary "
                  "set', COM20040430_elb.zip) by majority of a 6x6 grid "
                  "sample — the seat-sum membership the 2004 census-people "
                  "store's c0 side pools its 2001 BCP counts over "
                  "(derive-booth-demo-2001.py). No ABS CD-2001 -> "
                  "2003-edition concordance exists; sibling of "
                  "cd-2006-ced-2003ed.json's lane. Island/spillover "
                  "minorities that fall outside every era polygon are "
                  "legal only as the ABS 'Off-Shore Areas & Migratory' "
                  "balance SLA (see offshoreClass) — the pre-ASGS pseudo "
                  "rows, and people in them are division-less by ABS's "
                  "own filing. Generated by derive-cd-2001-ced-alloc.py, "
                  "machinery shared with derive-ced-era-alloc.py.",
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
