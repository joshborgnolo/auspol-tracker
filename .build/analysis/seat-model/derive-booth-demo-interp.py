#!/usr/bin/env python3
"""The venue-proxy years' people-interp blend: reads each election's
measured venue store (data/booth-demo-{year}.json) and its far-side
c1 store (data/booth-demo-{year}-c1.json), and writes the interpolated
blocks back INTO the measured store — demoI per booth and division,
counts.demoI.national, the demoInterp record, incomeCutsI.

The blend mirrors the voter-store interp lanes
(derive-booth-seifa-voter.py's INTERP pass — identical rule text, so
read both headers together): the SEIFA pcti lanes' day-share f
(hist.interp_f, the same map — cross-read keeps the factors identical
to the last decimal); each people lane is the share blend of the two
census-side blocks, a lane missing on either side staying null in
demoI so the display falls back to the measured figure for that lane.
incMed pins to the NEAREST census side; a blended dollar figure would
mix epochs. The measured store is edited read-modify-write — every
pre-existing key passes through byte-identical, only the interp keys
are (re)written, so the pass composes with anything else the measured
stores carry and is idempotent.

  2004  c0 = 2001 census (data/booth-demo-2004.json),
        c1 = 2006 (data/booth-demo-2004-c1.json)
  2007  c0 = 2006 census (data/booth-demo-2007.json),
        c1 = 2011 (data/booth-demo-2007-c1.json)
  2010  c0 = 2006, c1 = 2011
  2013  c0 = 2011, c1 = 2016 (data/booth-demo-2013-c1.json)

The income lanes blend like any lane (loinc's 25th-percentile cut is
edition-semantic), except hiinc when the two census sides' top-band
dollar edges differ (the 2001/2006 grids print $2,000+/$3,000+ tops
against 2011's $4,000+): a mixed-edge share blend would mix
definitions, so those years pin hiinc to the nearest census side —
the same doctrine incMed has always ridden. incomeCutsI carries the
nearest side's edge and a sides record of both.

Guards fail loud (booth-set drift between sides, division-set drift,
f drift against the SEIFA pcti store's own factors for the year).
Run:  python3 .build/analysis/seat-model/derive-booth-demo-interp.py
Test: node .build/analysis/seat-model/test-booth-demo-interp.mjs
"""

import importlib.util
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"
_spec = importlib.util.spec_from_file_location(
    "hist", SM / "derive-booth-seifa-hist.py")
hist = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hist)
fail = hist.fail
hash16 = hist.hash16

YEARS = {
    2004: {"c0": 2001, "c1": 2006},
    2007: {"c0": 2006, "c1": 2011},
    2010: {"c0": 2006, "c1": 2011},
    2013: {"c0": 2011, "c1": 2016},
}
LANES = ("langOther", "fborn", "uni", "blue", "loinc",
         "y12less", "atsci", "u15", "onepar")
# the select-family lanes blend per option, like the age bands
# (orders pinned to the store-level relKeys/tenKeys records)
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
TEN_KEYS = ["mort", "rent", "own", "rentPub"]
AGE_BANDS = ("0_4", "5_14", "15_19", "20_24", "25_34", "35_44",
             "45_54", "55_64", "65_74", "75_84", "85ov")


def lane_blend(a, b, f):
    return round((1 - f) * a + f * b, 4) if a is not None \
        and b is not None else None


def blend_demo(c0blk, c1blk, f, nearest_blk, hi_mixed):
    """One demoI block out of two census-side share dicts (venue-store
    shape — persons, cov, the six lanes, age, incMed): the block needs
    BOTH census sides (a one-sided block stays null whole, so the
    display falls back to the measured block), and inside it a lane
    missing on either side is null ( the per-lane pcti doctrine).
    incMed takes the nearest side. hiinc blends like any lane ONLY
    when the two sides' hi edges share a dollar (2011/2016/2021 eras
    all print $4,000+): between editions whose grids print different
    top edges (2001 $2,000+ / 2006 $3,000+ / 2011 $4,000+) a share
    blend would mix definitions, so hi_mixed years pin it to the
    nearest side like incMed."""
    if c0blk is None or c1blk is None:
        return None
    out = {"persons": None, "cov": None}
    if c0blk is not None and c1blk is not None \
            and c0blk.get("persons") is not None \
            and c1blk.get("persons") is not None:
        out["persons"] = int(round((1 - f) * c0blk["persons"]
                                   + f * c1blk["persons"]))
    for k in LANES:
        out[k] = lane_blend(c0blk.get(k) if c0blk else None,
                            c1blk.get(k) if c1blk else None, f)
    out["hiinc"] = (nearest_blk.get("hiinc") if hi_mixed else
                    lane_blend(c0blk.get("hiinc"),
                               c1blk.get("hiinc"), f))
    a0 = c0blk.get("age") if c0blk else None
    a1 = c1blk.get("age") if c1blk else None
    out["age"] = ({b: lane_blend(None if a0 is None else a0.get(b),
                                 None if a1 is None else a1.get(b), f)
                   for b in AGE_BANDS}
                  if a0 is not None or a1 is not None else None)
    for which, keys in (("rel", REL_KEYS), ("ten", TEN_KEYS)):
        d0 = c0blk.get(which) if c0blk else None
        d1 = c1blk.get(which) if c1blk else None
        out[which] = ({k: lane_blend(None if d0 is None
                                     else d0.get(k),
                                     None if d1 is None
                                     else d1.get(k), f)
                       for k in keys}
                      if d0 is not None or d1 is not None else None)
    near = nearest_blk if nearest_blk is not None else {}
    out["incMed"] = near.get("incMed")
    return out


def main():
    for year, y in YEARS.items():
        f = hist.interp_f(year, y["c0"], y["c1"])
        near = y["c1"] if f > 0.5 else y["c0"]
        mp = ROOT / f"data/booth-demo-{year}.json"
        cp = ROOT / f"data/booth-demo-{year}-c1.json"
        meas = json.loads(mp.read_text(encoding="utf-8"))
        far = json.loads(cp.read_text(encoding="utf-8"))
        if meas["censusEdition"] != y["c0"] or far["censusEdition"] != y["c1"]:
            fail(f"{year}: census editions drift "
                 f"{meas['censusEdition']}/{far['censusEdition']} vs "
                 f"{y}")

        # the SEIFA store's own factors must agree to the last decimal
        sf = json.loads((ROOT / f"data/booth-seifa-{year}.json")
                        .read_text(encoding="utf-8"))
        pcti = sf.get("_pcti")
        if pcti is None or pcti["f"] != f or (
                pcti["c0"], pcti["c1"]) != (y["c0"], y["c1"]):
            fail(f"{year}: f {f} / sides {y} drift the seifa store's "
                 f"{pcti and (pcti['f'], pcti['c0'], pcti['c1'])}")

        c1_booths = {(b["div"], b["boothId"]): b for b in far["booths"]}
        m_booths = {(b["div"], b["boothId"]): b for b in meas["booths"]}
        if set(c1_booths) != set(m_booths):
            fail(f"{year}: booth-set drift between sides "
                 f"(c1-only {len(set(c1_booths) - set(m_booths))}, "
                 f"measured-only "
                 f"{len(set(m_booths) - set(c1_booths))})")
        c1_divs = {d["div"]: d for d in far["divisions"]}
        m_divs = {d["div"]: d for d in meas["divisions"]}
        if set(c1_divs) != set(m_divs):
            fail(f"{year}: division-set drift "
                 f"{sorted(set(c1_divs) ^ set(m_divs))}")

        mc_cut = (meas.get("incomeCuts") or {}).get("hiEdgeWeekly")
        fc_cut = (far.get("incomeCuts") or {}).get("hiEdgeWeekly")
        hi_mixed = mc_cut is not None and fc_cut is not None \
            and mc_cut != fc_cut
        rows = 0
        for b in meas["booths"]:
            fblk = c1_booths[(b["div"], b["boothId"])]["demo"]
            mblk = b["demo"]
            near_blk = fblk if near == y["c1"] else mblk
            ib = blend_demo(mblk, fblk, f, near_blk, hi_mixed)
            b["demoI"] = ib
            if ib is not None:
                rows += 1
        for d in meas["divisions"]:
            fblk = c1_divs[d["div"]]
            mblk = d
            near_blk = fblk if near == y["c1"] else mblk
            d["demoI"] = blend_demo(mblk, fblk, f, near_blk, hi_mixed)

        mn, fn = meas["counts"]["national"], far["counts"]["national"]
        ni = {k: lane_blend(mn.get(k), fn.get(k), f)
              for k in LANES + ("age0_14", "age65ov")}
        ni["hiinc"] = ((fn if near == y["c1"] else mn).get("hiinc")
                       if hi_mixed
                       else lane_blend(mn.get("hiinc"),
                                       fn.get("hiinc"), f))
        for which, keys in (("rel", REL_KEYS), ("ten", TEN_KEYS)):
            d0, d1 = mn.get(which), fn.get(which)
            ni[which] = (
                {k: lane_blend(None if d0 is None else d0.get(k),
                               None if d1 is None else d1.get(k), f)
                 for k in keys}
                if d0 is not None or d1 is not None else None)
        ni["incMed"] = (fn if near == y["c1"] else mn).get("incMed")
        meas["counts"]["demoI"] = {"rows": rows, "national": ni}

        meas["demoInterp"] = {
            "f": f, "c0": y["c0"], "c1": y["c1"], "nearestSide": near,
            "censusNights": {
                str(y["c0"]): hist.CENSUS_NIGHT[y["c0"]].isoformat(),
                str(y["c1"]): hist.CENSUS_NIGHT[y["c1"]].isoformat()},
            "blend": "shares",
            "sides": {"c0": f"data/booth-demo-{year}.json",
                      "c1": f"data/booth-demo-{year}-c1.json"},
            "nullRule": ("a booth missing its demo block on either "
                         "census side, or a lane missing on either "
                         "side, shows the measured figure instead"),
        }
        # the income lane set is now edition-local on every side the
        # blend spans; a one-sided income figure would still brand a
        # hole as intercensal, so incomeCutsI rides only years whose
        # BOTH sides carry incomeCuts. When the two sides' hi edges
        # differ the demoI hiinc pins to the nearest side — record
        # that year's own edge here, never the measured side's alone
        mc, fc = meas.get("incomeCuts"), far.get("incomeCuts")
        if mc is not None and fc is not None:
            meas["incomeCutsI"] = {
            "loQuantile": mc["loQuantile"],
            "loCutWeekly": (fc if near == y["c1"] else mc)["loCutWeekly"],
            "hiEdgeWeekly":
                (fc if near == y["c1"] else mc)["hiEdgeWeekly"],
            "hiNationalShare":
                (fc if near == y["c1"] else mc)["hiNationalShare"],
            "dollarsYear": near,
            "adultsWeights": mc["adultsWeights"],
            "medianBasis": mc["medianBasis"] +
                ("; hiinc pinned to the nearest census side "
                 "(hi edges differ across the blend's editions)"
                 if hi_mixed else ""),
            "sides": {
                str(y["c0"]): {"loCutWeekly": mc["loCutWeekly"],
                               "dollarsYear": mc["dollarsYear"],
                               "hiEdgeWeekly": mc["hiEdgeWeekly"],
                               "hiNationalShare": mc["hiNationalShare"]},
                str(y["c1"]): {"loCutWeekly": fc["loCutWeekly"],
                               "dollarsYear": fc["dollarsYear"],
                               "hiEdgeWeekly": fc["hiEdgeWeekly"],
                               "hiNationalShare": fc["hiNationalShare"]},
            },
            }
        about_interp = (
            f" The demoI blocks interpolate the people figures between "
            f"the {y['c0']} and {y['c1']} censuses to election day "
            f"(day-share {f} of the intercensal span — the SEIFA pcti "
            f"lanes' own factors, asserted identical to "
            f"data/booth-seifa-{year}.json's _pcti record): each demoI "
            f"lane blends the two census sides' shares, a lane missing "
            f"on either side falling back to the measured block for "
            f"that lane; incMed and the incomeCutsI dollar figures "
            f"come from the {near} census side alone, never a "
            f"mixed-currency blend. The far side of the blend is "
            f"data/booth-demo-{year}-c1.json.")
        if about_interp.strip()[:60] not in meas["_about"]:
            meas["_about"] = meas["_about"] + about_interp
        meas["_provenance"]["files"][
            f"data/booth-demo-{year}-c1.json"] = hash16(cp)
        meas["_provenance"]["interpolatedAt"] = str(date.today())
        mp.write_text(json.dumps(meas, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
        print(f"OK -> {mp} (demoI rows {rows}, divisions "
              f"{len(meas['divisions'])}, nearest {near}, f {f})")


if __name__ == "__main__":
    main()
