#!/usr/bin/env python3
"""data/booth-demo-{1993,1996,1998}{,-c1}.json — the census-people
stores for the statistics-era federal frames at the start of the
people-interp family.

Sibling of derive-booth-demo-2001.py (the 2004 lane). The '90s
statistics-era frames have no AEC coordinate roll, so the venue side of
each store rides the identity-checked location store the map history
arc built (data/booth-locations-history.json, the map's own published
venue approximation: 6,540 of 8,431 records located for 1993). Each
store's venue rows carry that store's exact booth ids (the res frame's
own composite `id` scheme — division-id × 10,000 + place ordinal), so
the res-frame builder joins demo rows by boothId exactly like the
voter-era frames join them.

Every store is ONE CENSUS EDITION (the census the lane's vote-count
era sits in, never an intercensal blend — derive-booth-demo-interp.py
does the blending and lands the demoI blocks in the measured store):

  e1993 (13 Mar 1993): c0 = 1991 census → booth-demo-1993.json
                       c1 = 1996 census → booth-demo-1993-c1.json
  e1996  (2 Mar 1996): c0 = 1991 census → booth-demo-1996.json
                       c1 = 1996 census → booth-demo-1996-c1.json
  e1998  (3 Oct 1998): c0 = 1996 census → booth-demo-1998.json
                       c1 = 2001 census → booth-demo-1998-c1.json

A booth's demo block is the census's collection-district counts of the
CD the venue sits in (PIP of the venue's lat/lon on the census-era
district polygons of asgc{1991,1996}.gpkg and asgc2001.gpkg), the same
venue-neighbourhood doctrine the GCP-era lanes read. A division's row
is the exact census sum over the CDs whole-allocated to the era's
division polygon (seifa-src/cd-YYYY-ced-EEEEset.json via
derive-cd-91-96-ced-alloc.py — the machinery the 2004 lane rides).

The '90s census tallies are the AURIN lane extractions
(cache/bcp-{1991,1996}-aurin-tally.json via
extract-bcp-aurin-tally.py, six GCP-era lane fields per CD);
the sibling with religion/tenure select families beyond the GCP-four
is reserved for the 2001-and-later arcs — the '90s census-era lane
runs six lanes (persons, ages, language, birthplace, education,
blue-collar occupation), matching the lanes the 2001-extracted GCP
lane always had. COB/religion/tenure/y12/indig/one-parent keys are
absent on '90s stores by design; the front end hides what's absent
front the same count's era frames.

Guards fail loud: store counts pin the census tallies' registered
universe (31,401 / 34,327 / 35,289 CDs); the division set joins
NAME-EXACT against the election's certified record (the alloc files
already gate it); the national persons sum of the division rows plus
the lane's named offshore class equals the census's resident total
exactly.

Run:  python3 .build/analysis/seat-model/derive-booth-demo-90s.py
"""

import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"

def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


hist = _lib("hist", "derive-booth-seifa-hist.py")
fail = hist.fail
hash16 = hist.hash16
d13 = _lib("d13", "derive-booth-demo-2013.py")
STATE_ORDER = d13.STATE_ORDER
BANDS = ("0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
         "55_64", "65_74", "75_84", "85ov")

VENUE_LOCATIONS = ROOT / "data/booth-locations-history.json"
RESULTS = ROOT / "data/division-results.json"

# (year, census-edition-of-store, allocation file, census tally file,
#  output path)
STORES = (
    (1993, 1991, "cd-1991-ced-1993set", "bcp-1991-aurin-tally",
     "booth-demo-1993.json"),
    (1993, 1996, "cd-1996-ced-1993set", "bcp-1996-aurin-tally",
     "booth-demo-1993-c1.json"),
    (1996, 1991, "cd-1991-ced-1996set", "bcp-1991-aurin-tally",
     "booth-demo-1996.json"),
    (1996, 1996, "cd-1996-ced-1996set", "bcp-1996-aurin-tally",
     "booth-demo-1996-c1.json"),
    (1998, 1996, "cd-1996-ced-1998set", "bcp-1996-aurin-tally",
     "booth-demo-1998.json"),
    (1998, 2001, "cd-2001-ced-1998set", "bcp-2001-cd-tally",
     "booth-demo-1998-c1.json"),
)

UNIT_COUNT = {1991: 31401, 1996: 34327, 2001: 35289}
STATE_OF_ID = {1: "ACT", 2: "NSW", 3: "VIC", 4: "QLD", 5: "WA",
               6: "SA", 7: "TAS", 8: "NT"}
# '90s venue rescue cap (metres): the statistics-era location store's
# matched-venue coordinates ride the much later address-era geocodes'
# premises-points, while the era census district linework stops at survey
# drafts magnitude ±150m; measured over the missed set, point-in-poly
# resolution medians ~150m and 85% of misses land within 500m of the era
# neighbouring district's boundary. Assign the era-nearest CD within
# NEAREST_CAP_M of its boundary where no polygon contains the point —
# beyond 1,500m the venue's country itself (or the epoch of the CD
# about the assignment) can't carry the demographic meaning of the lane
# doctrine, and the booth stands unassigned exactly like the GCP-era
# short-table CDs (demo:null, no in-between figure).
NEAREST_CAP_M = 1500


def load_venues(year):
    """The frame's authoritative place registry from the published
    location store: ordered dict of boothId -> place row, in raw-order
    keyed by the registry's own place-key walk."""
    loc = json.loads(VENUE_LOCATIONS.read_text())["elections"][str(year)]
    places = loc["places"]
    out = []
    for key, rec in places.items():
        bid = int(key)
        if bid < 1000000:
            fail(f"{year}: place key {key} below the composite scheme")
        div_id, ordinal = bid // 10000, bid % 10000
        st = STATE_OF_ID.get(div_id // 100)
        if st is None:
            fail(f"{year}: odd division id {div_id}")
        match = rec.get("match") or {}
        lat, lon = match.get("lat"), match.get("lon")
        out.append({"div": rec["division"], "divId": div_id,
                    "state": st, "boothId": bid,
                    "booth": rec["name"], "type": "Polling place",
                    "_lat": lat, "_lon": lon,
                    "_status": rec.get("status")})
    return out


def shares(r):
    """One demo block out of a per-CD tally record — the 2004-era
    share recipe on the six '90s lanes. A row whose own census-
    published bases are self-inconsistent at the share level (a
    venue-adjacent zero-resident registry pseudo, or the tiny census-
    era ghost classes whose BCP quals lane outrows its persons-table
    lane — never an invented share) says nothing, not a polite clamp
    — an out-of-range figure is the census-era-of-era telling you the
    lane is meaningless here, exactly like the 2001-era balance
    classes."""
    per = r["pers"]
    if per == 0:
        return None
    eo = r["eng"] + r["oth"]
    fb = r["totc"] - r["cobns"]
    p15 = per - r["bands"][0] - r["bands"][1]
    uden = p15 - r["eduns"]
    bsum = sum(r["bands"])
    if bsum <= 0:
        return None
    vals = {
        "persons": per,
        "cov": 1.0,
        "langOther": round(r["oth"] / eo, 4) if eo > 0 else None,
        "fborn": round((fb - r["aus"]) / fb, 4) if fb > 0 else None,
        "uni": round(r["uni"] / uden, 4) if uden > 0 else None,
        "blue": round(r["bluen"] / r["occd"], 4)
        if r["occd"] > 0 else None,
        "age": {b: round(r["bands"][i] / bsum, 4)
                for i, b in enumerate(BANDS)},
        "u15": round((r["bands"][0] + r["bands"][1]) / bsum, 4),
    }
    for k in ("langOther", "fborn", "uni", "blue", "u15"):
        x = vals[k]
        if x is not None and not (0 <= x <= 1):
            return None
    return vals


def ct_index(era_polys):
    """CD polys boxed on a 1-degree lat/lon grid for venue PIP."""
    buckets = defaultdict(list)
    for code, box, rings in era_polys:
        flat = []
        for r in rings:
            flat.append(r)
        for key in _tiles(box):
            buckets[key].append((code, box, flat))
    return buckets


def _tiles(box):
    x0, y0 = int(math.floor(box[0])), int(math.floor(box[1]))
    x1, y1 = int(math.floor(box[2])), int(math.floor(box[3]))
    for tx in range(x0, x1 + 1):
        for ty in range(y0, y1 + 1):
            yield (tx, ty)


def _pip(lat, lon, buckets):
    """Point-in-poly over the bucketed CD polys; returns CD code or
    None."""
    key = (int(math.floor(lon)), int(math.floor(lat)))
    for code, box, rings in buckets.get(key, ()):
        if not (box[0] <= lon <= box[2] and box[1] <= lat <= box[3]):
            continue
        if _inside(lon, lat, rings):
            return code
    return None


def _nearest_within(lat, lon, polys, cap_m):
    """Nearest-ring-vertex era-census CD within cap_m metres (the '90s
    era-linework rescue — see NEAREST_CAP_M), else None. Returns
    (code, dist_m)."""
    best = (None, 1e18)
    coslat = math.cos(math.radians(lat))
    for code, box, rings in polys:
        if box[0] - 0.05 > lon or box[2] + 0.05 < lon \
                or box[1] - 0.05 > lat or box[3] + 0.05 < lat:
            continue
        for ring in rings:
            for i in range(0, len(ring), 2):
                dx = (ring[i] - lon) * coslat * 111320
                dy = (ring[i + 1] - lat) * 110540
                dd = dx * dx + dy * dy
                if dd < best[1]:
                    best = (code, dd)
    if best[0] is None or math.sqrt(best[1]) > cap_m:
        return None, None
    return best[0], math.sqrt(best[1])


def _inside(x, y, rings):
    hit = False
    for ring in rings:
        j = len(ring) - 2
        for i in range(0, len(ring), 2):
            yi, yj = ring[i + 1], ring[j + 1]
            if (yi > y) != (yj > y):
                xi, xj = ring[i], ring[j]
                if x < xi + (y - yi) / (yj - yi) * (xj - xi):
                    hit = not hit
    return hit


def era_polygons(census):
    """[(code, box, rings)] for the census's era CD layer."""
    if census in (1991, 1996):
        return _geo_cd_aurin(census)
    if census == 2001:
        polys, _nulls = hist._geo_cd2001(hist.DL / "asgc2001.gpkg")
        return polys
    fail(f"no polygon source for census {census}")


def _geo_cd_aurin(year):
    """CD polygons out of the snake-case asgc gpkg, in the same
    loader shape as hist._geo_cd2001: [(code, box, rings)]."""
    import sqlite3
    from array import array
    import struct
    gpkg = hist.DL / f"asgc/asgc{year}.gpkg"
    if not gpkg.exists():
        fail(f"missing {gpkg}")

    def wkb(b):
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

    conn = sqlite3.connect(str(gpkg))
    tab = f"census_collection_district_{year}"
    polys, nulls = [], 0
    for code, blob in conn.execute(
            f"SELECT CD_CODE_{year}, shape FROM {tab}"):
        if blob is None:
            nulls += 1
            continue
        rings_by_poly = wkb(blob)
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
        polys.append((code, box, flat))
    conn.close()
    exp = {1991: 31315, 1996: 34405}[year]
    if len(polys) != exp:
        fail(f"cd{year}: polygons {len(polys)} != {exp} "
             f"(null {nulls})")
    print(f"cd{year}: {len(polys)} polygons, "
          f"{nulls} null-spatial")
    return polys


def build_store(year, census, alloc_name, tally_name, out_name):
    alloc_p = SM / f"seifa-src/{alloc_name}.json"
    tally_p = SM / f"cache/{tally_name}.json"
    alloc_d = json.loads(alloc_p.read_text())
    alloc, unit = alloc_d["alloc"], alloc_d["unit"]
    people = json.loads(tally_p.read_text())["tally"]
    if len(people) != UNIT_COUNT[census]:
        fail(f"{census} tally universe {len(people)} != "
             f"{UNIT_COUNT[census]}")
    venues = load_venues(year)
    polys = era_polygons(census)
    buckets = ct_index(polys)

    # division sums over the alloc
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * 11,
                                  "eng": 0, "oth": 0, "aus": 0,
                                  "totc": 0, "cobns": 0, "uni": 0,
                                  "eduns": 0, "bluen": 0, "occd": 0})
    for code, dv in alloc.items():
        r = people.get(code)
        if r is None:
            continue
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        if r.get("shortCd"):
            # the 2001 BCP's truncated-workbook balance classes: people
            # counted, no demographic lanes tabled (2004 lane's
            # contract)
            continue
        for i in range(11):
            acc["bands"][i] += r["bands"][i]
        for k in ("eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd"):
            acc[k] += r[k]

    # venue geo blocks (PIP first, then the era-linework nearest
    # rescue within NEAREST_CAP_M metres — see its note)
    geo_missing = geo_empty = geo_hit = geo_near = 0
    near_dists = []
    out_booths = []
    for vb in venues:
        rec = {k: vb[k] for k in ("div", "divId", "state", "boothId",
                                  "booth", "type")}
        lat, lon = vb["_lat"], vb["_lon"]
        if lat is None or lon is None:
            rec["demo"] = None
            geo_missing += 1
        else:
            code = _pip(lat, lon, buckets)
            if code is None:
                code, near_m = _nearest_within(lat, lon, polys,
                                               NEAREST_CAP_M)
                if code is not None:
                    geo_near += 1
                    near_dists.append(near_m)
            r = people.get(code) if code else None
            if r is None:
                rec["demo"] = None
                geo_empty += 1
            else:
                rec["demo"] = shares(r)
                geo_hit += 1
        out_booths.append(rec)

    divname_of = {b["div"]: b["state"] for b in out_booths}
    divisions = []
    for name in sorted(divsum, key=lambda n: (
            STATE_ORDER[divname_of[n]], n)):
        divisions.append({"div": name, "state": divname_of[name],
                          **shares(divsum[name])})

    nat = defaultdict(int)
    nat["bands"] = [0] * 11
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd"):
            nat[k] += dv[k]
        for i in range(11):
            nat["bands"][i] += dv["bands"][i]
    off = alloc_d.get("offshoreClass", {}) or {}
    off_pop = sum(v.get("population", 0) for v in off.values())
    census_nat = sum(r["pers"] for r in people.values())
    if nat["pers"] + off_pop != census_nat:
        fail(f"{year} c{census}: division+offshore "
             f"{nat['pers'] + off_pop} != census resident "
             f"{census_nat} (alloc covers no square census people)")
    eo = nat["eng"] + nat["oth"]
    fb = nat["totc"] - nat["cobns"]
    p15 = nat["pers"] - nat["bands"][0] - nat["bands"][1]
    national = {
        "persons": nat["pers"],
        "langOther": round(nat["oth"] / eo, 4),
        "fborn": round((fb - nat["aus"]) / fb, 4),
        "uni": round(nat["uni"] / (p15 - nat["eduns"]), 4),
        "blue": round(nat["bluen"] / nat["occd"], 4),
        "age0_14": round((nat["bands"][0] + nat["bands"][1])
                         / nat["pers"], 4),
        "age65ov": round(sum(nat["bands"][8:]) / nat["pers"], 4),
        "u15": round((nat["bands"][0] + nat["bands"][1])
                     / nat["pers"], 4),
    }
    about = (
        "Census-people basis store for the " + str(year) + " federal "
        "election (the " + str(census) + "-census side of the "
        "people-interp lane for that frame — "
        "derive-booth-demo-90s.py's six-store output; "
        "see its header). The people-smallest-area is a "
        + str(census) + "-census collection district: a booth's demo "
        "block is that CD's census counts pinned to the venue's "
        "approximate location from data/booth-locations-history.json "
        "(the map's own published history-venue store; pre-2001 "
        "elections have no AEC coordinate roll), a division's the "
        "exact census sum over the CDs whole-allocated to the era's "
        "division set (seifa-src/" + alloc_name + ".json — the "
        "Parliamentary Handbook era polygons, the map's published "
        "era set). Venue-to-CD mapping is point-in-poly where the "
        "venue point sits inside a district, and the era-nearest CD "
        "along the era's own survey-draft linework within "
        "1,500 m (counts.boothsGeoNearest, those venues' median "
        "rescue distance counts.geoNearestDistP50, p95 "
        "counts.geoNearestDistP95) where no district contains it — "
        "the era boundaries' drafting vintage puts most venue points "
        "within a couple of hundred metres of the printed line. "
        "The '90s lane is the six GCP-era lanes measured "
        "on the census's own AURIN Basic Community Profile lane "
        "(extract-bcp-aurin-tally.py): persons, ages, "
        "home-language share, birthplace, education level, "
        "blue-collar occupation. COB country menu, religion, tenure, "
        "year-12, Indigenous status and one-parent keys ride the "
        "2001-and-later arcs' own census editions only — the '90s "
        "stores carry none of those keys by design. The census's "
        "ABS-filed balance classes named offshoreClass in the "
        "allocation file are dropped here entirely by ABS's own "
        "filing.")
    out = {
        "_about": about,
        "_provenance": {
            "files": {
                str(alloc_p.relative_to(ROOT)): hash16(alloc_p),
                str(tally_p.relative_to(ROOT)): hash16(tally_p),
                "data/booth-locations-history.json":
                    hash16(VENUE_LOCATIONS),
            },
            "extractedAt": str(date.today()),
        },
        "election": year,
        "censusEdition": census,
        "deliveryBasis": (
            f"venue PIP of the history-location-store coordinates "
            f"over the {census}-census CD polygons; exact CD sum per "
            f"division (seifa-src/{alloc_name}.json)"),
        "counts": {
            "booths": len(out_booths),
            "boothsGeo": geo_hit,
            "boothsGeoNearest": geo_near,
            "boothsGeoMissing": geo_missing,
            "boothsGeoEmpty": geo_empty,
            "geoNearestCapM": NEAREST_CAP_M,
            "geoNearestDistP50": (sorted(near_dists)[len(near_dists) // 2]
                                  if near_dists else None),
            "geoNearestDistP95": (sorted(near_dists)[int(
                0.95 * len(near_dists))] if near_dists else None),
            "divisions": len(divisions),
            "cdsTally": len(people),
            "cdsAlloc": len(alloc),
            "offshorePop": off_pop,
            "national": national,
        },
        "divisions": divisions,
        "booths": out_booths,
    }
    out_p = ROOT / f"data/{out_name}"
    out_p.write_text(json.dumps(out, indent=2, ensure_ascii=False)
                     + "\n", encoding="utf-8")
    print(f"OK -> {out_p} (booths {len(out_booths)} "
          f"[geo {geo_hit}, nearest {geo_near}, missing {geo_missing}, "
          f"empty {geo_empty}], divisions {len(divisions)}, "
          f"national {national['persons']:,} + offshore "
          f"{off_pop:,} = census-resident {census_nat:,})")


def main():
    certified = json.loads(RESULTS.read_text())["elections"]
    era_set_cached = {}
    for year, census, alloc_name, tally_name, out_name in STORES:
        era_names = certified[str(year)]
        alloc_names = set(json.loads(
            (SM / f"seifa-src/{alloc_name}.json").read_text())["divisions"])
        if set(era_names) != alloc_names:
            fail(f"{year} e{census}: division-name set drift "
                 f"(alloc-only {sorted(alloc_names - set(era_names))[:4]}, "
                 f"certified-only {sorted(set(era_names) - alloc_names)[:4]})")
        build_store(year, census, alloc_name, tally_name, out_name)


if __name__ == "__main__":
    main()
